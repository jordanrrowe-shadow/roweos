# v4.0 Firebase Sync Overhaul -- Design Spec

**Date:** 2026-03-27
**Version:** v28.0 (sync engine v4.0)
**Status:** Approved
**Author:** Jordan + Claude

---

## Problem Statement

The current sync system (V3.1) evolved incrementally from V1 through V3 with patches on patches. It has:

- 24+ subcollections under each user doc with inconsistent formats
- Mixed storage patterns (JSON strings, native arrays, single-doc wrappers, per-item collections)
- No field-level conflict resolution -- entire documents overwrite on sync
- No proper offline queue with retry/ordering
- No deletion tracking (except soft-delete for LifeAI profiles)
- Timestamp type mismatches (ISO strings vs numeric) across sync paths
- Index-based document paths for brands causing ghost resurrection on delete
- 8+ separate onSnapshot listeners each with custom merge logic
- Scattered write functions (writeDB, writeDBDoc, writeDBTodos, writeDBCalendar, etc.)

Phase 1 (v27.3) fixed the 7 most critical bugs. This spec designs the complete replacement.

---

## Goals

1. **Zero data loss** -- migration preserves every field of every document
2. **Field-level merge** -- two devices can edit different fields of the same doc simultaneously
3. **Offline-first** -- works offline for minutes to hours, syncs cleanly on reconnect
4. **Conflict resolution** -- auto-merge for low-risk fields, visual conflict queue for high-value fields
5. **Consistency** -- every collection follows the same schema, same write path, same merge logic
6. **Debuggability** -- sync log, device registry, queue visibility in UI

---

## New Firestore Schema

### Namespace: `roweos_v4/{uid}/`

All data migrated from `roweos_users/{uid}/` to new namespace. Old namespace is never modified or deleted.

### Standard Document Fields

Every document in every collection has:

```
id:          string    -- stable, human-readable ID (e.g., "brand_name_the_rowe_collection")
_modifiedAt: number    -- ms timestamp, latest of any field modification
_createdAt:  number    -- ms timestamp, when doc was first created
_deviceId:   string    -- device that last wrote the doc
_version:    number    -- incrementing integer per-document (optimistic concurrency)
_fieldMeta:  map       -- per-field timestamps: { fieldName: { at: number, by: string } }
```

### Collection Map

```
roweos_v4/{uid}/
  _meta/config              -- migration status, schema version, device registry
  _meta/sync_log            -- last 100 sync operations

  brands/{brand_id}         -- full brand profile, keyed by stable ID
  brand_settings/main       -- provider/model config per brand

  life_profiles/{profile_id}  -- each life profile as own doc
  life_settings/main          -- widget config, routines, habits, accent colors

  todos/{todo_id}           -- one doc per todo
  calendar/{event_id}       -- one doc per event
  automations/{task_id}     -- one doc per automation
  reminders/{reminder_id}   -- one doc per reminder

  conversations/{conv_id}   -- each conversation as own doc
  agent_history/{entry_id}  -- agent conversation entries

  pulse/goals               -- goals array (small, single doc OK)
  pulse/reminders           -- reminders array

  library/brand             -- brand file library (native Firestore map, NOT JSON string)
  library/life              -- life file library (native Firestore map)

  clients/{client_id}       -- one doc per client
  inventory/{item_id}       -- one doc per inventory item
  knowledge/{entry_id}      -- knowledge base entries

  social_tokens/{platform_scope}  -- OAuth tokens
  social_activity/{entry_id}      -- social action log
  social_posts/main               -- outbox + published posts
  social_workflows/main           -- workflow definitions

  settings/main             -- all UI preferences, sidebar, theme, bloom, calendar config
  settings/api_keys         -- secure API key storage
  settings/notifications    -- notification preferences
  settings/push_subscriptions -- web push subscriptions

  folio/main                -- portfolio data
  runs/{run_id}             -- studio runs
  logos/{logo_id}           -- brand logos

  scavenger_configs/{id}    -- engagement pipeline configs
  scavenger_targets/{id}    -- engagement targets

  conflicts/{conflict_id}   -- NEW: pending sync conflicts for user review
  sync_queue/{entry_id}     -- NEW: offline operation queue
```

---

## Sync Engine Architecture

### Single Write Entry Point

All writes go through `syncEngine.write()`:

```
syncEngine.write(collection, docId, fields, mergeType)
  1. Apply to localStorage immediately (optimistic UI)
  2. Stamp _modifiedAt, _deviceId, _version per FIELD in _fieldMeta
  3. Queue operation in sync_queue (persists in localStorage)
  4. If online: flush queue to Firestore
  5. If offline: queue persists, flushes on reconnect
```

Additional methods:
- `syncEngine.delete(collection, docId)` -- soft-delete with tombstone
- `syncEngine.read(collection, docId)` -- read from localStorage (fast), Firestore (authoritative)
- `syncEngine.pull(collection)` -- full pull from Firestore for a collection
- `syncEngine.pullAll()` -- full pull from all collections (replaces loadFromFirebaseV2)

### Field-Level Timestamps (_fieldMeta)

Every field in every document gets its own timestamp and device ID:

```javascript
{
  name: "The Rowe Collection",
  tagline: "Operating intelligence",
  _fieldMeta: {
    name:    { at: 1774600000000, by: "macbook_abc123" },
    tagline: { at: 1774641686000, by: "iphone_def456" }
  }
}
```

### Merge Categories

**Auto-merge (last-write-wins, with notification):**
- Brand colors, accent colors
- UI preferences, sidebar mode, theme
- Calendar colors/visibility settings
- Widget configs, pill nav state
- Sync settings, API routing config
- Bloom preferences, content mode
- Automation on/off toggles, schedule times

**Conflict queue (side-by-side review):**
- Brand profile fields (essence, voice, positioning, audience, tagline, constraints)
- Brand identity data (AI-generated insights)
- Life profile fields (aboutMe, goals, identityData)
- Conversation history (if edited/deleted on one device while continued on another)
- Custom operations, generated operations
- Client data
- Knowledge/memory entries

**Always-append (never conflict, just merge both):**
- Todos (both devices add different todos -- keep all)
- Calendar events (both add events -- keep all)
- Reminders
- Social activity log
- Automation execution history

### Field-Level Merge Algorithm

When two versions of a document are compared:

```
For each field in the document:
  cloudMeta = doc._fieldMeta[field]
  localMeta = localDoc._fieldMeta[field]

  if only one side changed the field (different .at from last sync):
    take that side's value
  if both sides changed the field:
    if field is auto-merge category:
      latest timestamp wins
      create notification: "{DeviceName} updated {field}"
    if field is conflict-queue category:
      create conflict entry in conflicts/ collection
      keep cloud value as active until user resolves
  if neither side changed:
    keep current value
```

### Offline Queue

Operations queue in localStorage at `roweos_v4_sync_queue`:

```javascript
{
  id: "op_1774641686000_abc123",
  collection: "brands",
  docId: "brand_name_the_rowe_collection",
  operation: "update",       // "create" | "update" | "delete"
  fields: { tagline: "New tagline" },
  fieldMeta: { tagline: { at: 1774641686000, by: "macbook_abc123" } },
  status: "pending",         // "pending" | "sent" | "confirmed" | "conflicted"
  createdAt: 1774641686000,
  deviceId: "macbook_abc123",
  retryCount: 0
}
```

Queue behavior:
- Flush in order (FIFO) when online
- Each operation confirmed by Firestore write success
- Failed operations retry with exponential backoff: 1s, 2s, 4s (max 3 retries)
- After 3 failures: move to error state, notify user
- Deduplication: multiple writes to same doc/field collapse into latest value
- Online detection: navigator.onLine + Firestore connectivity check

### Real-Time Listeners

One unified pattern replaces 8+ custom listeners:

```javascript
function watchCollection(collectionName, mergeType) {
  db.collection(v4Path + '/' + collectionName).onSnapshot(function(snapshot) {
    if (snapshot.metadata.hasPendingWrites) return;
    snapshot.docChanges().forEach(function(change) {
      if (change.type === 'added' || change.type === 'modified') {
        fieldMerge(collectionName, change.doc.id, change.doc.data(), mergeType);
      }
      if (change.type === 'removed') {
        removeLocal(collectionName, change.doc.id);
      }
    });
    updateSyncIndicator('synced');
  });
}
```

Collections registered at startup:
- `watchCollection('brands', 'conflict')`
- `watchCollection('todos', 'append')`
- `watchCollection('calendar', 'append')`
- `watchCollection('automations', 'auto')`
- `watchCollection('life_profiles', 'conflict')`
- etc.

Single-doc watchers for settings/pulse/library use `db.doc().onSnapshot()` with same merge logic.

### Device Registry

Stored in `_meta/config`:

```javascript
{
  devices: {
    "macbook_abc123": { name: "MacBook Pro", lastSeen: 1774641686000, appVersion: "27.3" },
    "iphone_def456": { name: "iPhone", lastSeen: 1774640000000, appVersion: "27.3" }
  },
  schemaVersion: 4,
  migrationCompleted: true,
  migrationTimestamp: 1774600000000
}
```

Device ID generated on first launch: `{platform}_{random8chars}`. Stored in localStorage at `roweos_v4_device_id`. Device name auto-detected from user agent.

---

## Migration Engine

### Trigger

On app boot, before any data loads:

```
1. Check if roweos_v4/{uid}/_meta/config exists
2. If exists AND migrationCompleted === true: boot on v4
3. If not: show migration screen, run migration
```

### Migration Steps

1. **Register device** in `_meta/config` (creates the v4 namespace)
2. **Snapshot ALL data** from `roweos_users/{uid}/` (every subcollection, every doc)
3. **Save backup** to `roweos_v4/{uid}/_meta/pre_migration_backup` (full JSON snapshot)
4. **Save localStorage backup** to `roweos_v4_pre_migration_backup`
5. **Transform + write** each collection per the migration map below
6. **Verify** every doc written: read back, compare field-by-field against source
7. **If 100% verified**: set `migrationCompleted: true` in `_meta/config`
8. **If ANY verification failure**: abort, leave old namespace as-is, show error with retry option

### Migration Map

| Old Path | New Path | Transform |
|----------|----------|-----------|
| `brands/{idx}` + `brands/_all` | `brands/{stable_id}` | Re-key by stable ID, add _fieldMeta, normalize _modifiedAt to numeric |
| `profile/main` -> settings fields | `settings/main` | Extract: timezone, displayName, sidebar prefs, bloom prefs, calendar config, todo categories, custom sidebar, pdf scheme |
| `profile/main` -> brandSettings | `brand_settings/main` | Extract brandSettings map, add _fieldMeta |
| `profile/main` -> socialConnections | `settings/main.socialConnections` | Move into settings |
| `profile/main` -> journal | `settings/main.journal` | Move into settings |
| `profile/main` -> brandMemory/Knowledge | `knowledge/{entry_id}` | Split into per-entry docs if array, single doc if map |
| `profile/main` -> socialOutbox/pendingApproval | `social_posts/main` | Combine into social posts doc |
| `profile/main` -> guardrails, apiRouting | `settings/main` | Move into settings |
| `profile/generatedBrandOps` | `brands/{brand_id}.generatedOps` | Attach to parent brand doc |
| `profile/userContact` | `settings/main.userContact` | Move into settings |
| `profile/clients` | `clients/{client_id}` | Split array into per-client docs |
| `profile/customAgents` | `settings/main.customAgents` | Move into settings |
| `profile/customOps` | `settings/main.customOps` | Move into settings |
| `profile/socialPosts` | `social_posts/main` | Merge with outbox data |
| `profile/socialWorkflows` | `social_workflows/main` | Direct copy |
| `profile/notifications` | `settings/notifications` | Direct copy |
| `profile/bloomLibrary` | `settings/main.bloomLibrary` | Move into settings |
| `profile/researchHistory` | `settings/main.researchHistory` | Move into settings |
| `profile/logos` | `logos/{logo_id}` | Split if array |
| `lifeAI/main` -> profiles array | `life_profiles/{profile_id}` | Each profile becomes its own doc |
| `lifeAI/main` -> currentProfile/Idx | `life_settings/main` | Extract to settings |
| `lifeAI/main` -> everything else | `life_settings/main` | routines, habits, goals, widget config, accent colors, symbiote, rhythmPrefs |
| `lifeAI/possessions` | `inventory/{item_id}` | Merge with existing inventory or keep as sub-key |
| `todos/main` -> data array | `todos/{todo_id}` | Each todo becomes its own doc, backfill id if missing |
| `calendar/main` -> data array | `calendar/{event_id}` | Each event becomes its own doc, backfill id if missing |
| `automations/{id}` | `automations/{id}` | Direct copy + add _fieldMeta |
| `conversations/current` | `conversations/current` | Direct copy |
| `conversations/history` | `conversations/history` | Parse JSON string into native format |
| `conversations/agentHistory` | `agent_history/main` | Parse JSON string into native format |
| `pulse/main` | `pulse/goals` + `pulse/reminders` | Split into two docs, parse JSON strings |
| `library/brand` | `library/brand` | Parse JSON string into native Firestore map |
| `library/life` | `library/life` | Parse JSON string into native Firestore map |
| `folio/main` | `folio/main` | Direct copy + add _fieldMeta |
| `runs/{id}` | `runs/{id}` | Direct copy |
| `inventory/{id}` | `inventory/{id}` | Direct copy |
| `logos/{id}` | `logos/{id}` | Direct copy |
| `knowledge/{id}` | `knowledge/{id}` | Direct copy |
| `social_tokens/{id}` | `social_tokens/{id}` | Direct copy |
| `social_activity/{id}` | `social_activity/{id}` | Direct copy |
| `scavenger_configs/{id}` | `scavenger_configs/{id}` | Direct copy |
| `scavenger_targets/{id}` | `scavenger_targets/{id}` | Direct copy |
| `secure/api_keys` | `settings/api_keys` | Direct copy |
| `cloud_outbox/{id}` | Migrate pending only | Discard picked_up entries |
| `cloud_locks/{id}` | Not migrated | Ephemeral, recreated as needed |
| `cloud_results/{id}` | Not migrated | Historical, stays in old namespace |
| `sync_status/{id}` | Not migrated | Replaced by new sync engine |
| `push_subscriptions/{id}` | `settings/push_subscriptions` | Consolidate |
| `analytics/{id}` | Not migrated | Regenerated from fresh data |
| `visual_assets/{id}` | `logos/{id}` | Merge with logos collection |

### Migration UI

Full-screen overlay:

```
Upgrading RoweOS to v4.0...

[=========>          ] 45%

 Brands (6/6)
 Settings
 Life Profiles (1/1)
> Todos (23/47)...
  Calendar
  Automations
  Conversations
  Library

Your data is safe. Do not close this tab.
```

### Safety Nets

1. Pre-migration Firestore backup at `_meta/pre_migration_backup`
2. Pre-migration localStorage backup at `roweos_v4_pre_migration_backup`
3. Old namespace `roweos_users/{uid}/` NEVER modified or deleted
4. Verification step: every doc read back and compared field-by-field
5. Abort + rollback on any mismatch
6. Idempotent: running migration twice produces the same result
7. Manual retry available in Settings > Cloud & Sync > Reset Sync

---

## Conflict Resolution UI

### Conflict Data Model

```javascript
// conflicts/{conflict_id}
{
  id: "conflict_1774641686000",
  collection: "brands",
  docId: "brand_name_the_rowe_collection",
  field: "tagline",
  localValue: "Operating intelligence, built for brands",
  localDevice: "iphone_def456",
  localDeviceName: "iPhone",
  localTimestamp: 1774641680000,
  cloudValue: "Intelligence platform for modern brands",
  cloudDevice: "macbook_abc123",
  cloudDeviceName: "MacBook Pro",
  cloudTimestamp: 1774641686000,
  status: "pending",
  resolvedAt: null,
  resolvedChoice: null,
  createdAt: 1774641690000
}
```

### Toast Notification

When a conflict is created:
- Gold left-border toast in standard bottom-right stack
- Text: "1 sync conflict needs review" with field/device context
- "Review" button navigates to Settings > Cloud & Sync
- Persists 10 seconds, auto-dismisses
- Badge count on Cloud & Sync settings folder card

### Settings Panel

In Settings > Cloud & Sync, "Sync Conflicts" section (only visible when conflicts > 0):
- Each conflict shows as expandable card
- Side-by-side comparison: device name + time on each side, field values displayed
- Actions: [Keep {Device1}] [Keep {Device2}] [Keep Both]
- Bulk action: [Resolve All: Keep Newest]
- Resolved conflicts retained 7 days for audit, then auto-purged

### Resolution Behavior

- Keep {Device}: writes that value, marks resolved
- Keep Both: for text fields, appends both with separator; for non-text, keeps newer
- Resolve All: bulk latest-timestamp-wins
- Conflicts are non-blocking: cloud (newest) value stays active until resolved
- App functions normally with unresolved conflicts

### Cloud & Sync Enhancements

- Sync Status: "Last synced 3 seconds ago" with green/amber/red indicator
- Device List: registered devices with last-seen timestamps
- Offline Queue: "2 changes waiting to sync" count when offline
- Sync Log: last 20 operations (collapsible)
- Force Sync: manual pull + push button
- Reset Sync: re-run migration from scratch (with confirmation dialog)

---

## Cloud Functions Update

`runScheduledTasks` and `runTaskNow` in `/functions/index.js` must read from `roweos_v4/{uid}/` with fallback to `roweos_users/{uid}/` during migration window.

Check `roweos_v4/{uid}/_meta/config.migrationCompleted` to determine which namespace to use per-user.

---

## Security Rules

Add to `firestore.rules`:

```
match /roweos_v4/{userId}/{subcollection}/{docId} {
  allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.uid == 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93');
}
```

Same pattern as existing `roweos_users` rules.

---

## Implementation Phases (High Level)

1. Sync engine core (syncEngine.write, read, delete, queue)
2. Migration engine + migration UI
3. Firestore security rules + schema setup
4. Rewire all write paths to use syncEngine.write
5. Rewire all read paths to use v4 namespace
6. Real-time listeners (unified watchCollection pattern)
7. Conflict detection + conflict UI
8. Cloud Functions update
9. Testing + verification
10. Deploy + monitor

---

## Non-Goals

- Multi-user real-time collaboration (single user, multiple devices only)
- End-to-end encryption of synced data
- Deleting old namespace data (stays as permanent backup)
- Changing the Firebase project or authentication system
