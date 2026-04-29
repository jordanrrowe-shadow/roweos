# Sync v5 — Continuous, Timestamp-Based, Type-Safe

**Status:** Architecture spec, draft v0.1
**Replaces:** Sync v4 (current production), v3.1, v3, v2, v1
**Companion:** `15-architecture-playbook.md` (the playbook), `13-integration-strategy.md` (the no-rewrite stance)
**Mockup:** `/brilliance-mockups/14-sync-state-preview.html`

---

## What you asked for

1. **Firebase syncs properly** — no data loss, no resurrection, no ghost items, no overwrites
2. **All proper coding across the board** — one typed contract, one place to read, one place to write
3. **Timestamp-based** — every item knows when it changed, last-write-wins resolves conflicts
4. **Auto continuous sync** — onSnapshot listeners always on, writes flush within 200ms, no manual sync button

This doc specifies how we get there without throwing away the four hardened iterations of the current sync layer.

---

## The core idea

**Sync v5 is built BEHIND the existing v4, not instead of it.** Same Firestore data. Same localStorage. Same auth. New typed interface on top, new implementation underneath, dual-writes during migration. When v5 has run pure for 30 days with zero discrepancies, v4 retires.

This is the dual-write pattern. It's how every successful at-scale sync rewrite has been done. It's the only path that does not put 10 paying clients at risk.

---

## The 10 principles

### 1. Universal item shape
Every synced item — brand, conversation, automation, scribe page, evolve skill, anything — has the same envelope:

```typescript
interface Synced<T> {
  id: string;                     // UUID v4, generated client-side
  data: T;                        // the actual payload
  _modifiedAt: number;            // ms epoch, client clock at write time
  _createdAt: number;             // ms epoch
  _deletedAt?: number;            // tombstone marker; readers filter unless includeDeleted
  _clientId: string;              // UUID for the browser session that wrote this
  _schemaVersion: number;         // for migrations
}
```

No exceptions. If it lives in Firestore, it has this envelope. If it doesn't have this envelope, it can't sync.

### 2. Per-collection sync engine
Each kind of synced data is a `Collection<T>`. Brands, conversations, automations, scribes, evolve_skills, evolve_sources, evolve_reflections, evolve_sops — each is its own Collection instance. Each owns its sync lifecycle independently.

```typescript
const brands = new Collection<Brand>({
  name: 'brands',
  firestorePath: (uid) => `users/${uid}/brands_v5`,
  localStorageKey: 'brilliance_v5_brands',
  schemaVersion: 1,
});
```

Collections don't know about each other. Cross-collection consistency (e.g., deleting a brand cascades to its conversations) lives in services, not in sync.

### 3. Continuous by default
Every Collection sets up a Firestore `onSnapshot()` listener at boot, scoped to the current user. Changes from any device stream into local state in real-time, debounced to 50ms to coalesce bursts.

No "Sync Now" button. The button can stay in the UI for user reassurance, but it's a no-op (or a "force pull" for paranoia mode).

### 4. Last-write-wins by `_modifiedAt`, ties broken by `_clientId`
When two clients write the same item:
- The item with the higher `_modifiedAt` wins
- If `_modifiedAt` is identical (millisecond clash), the one with the lexicographically higher `_clientId` wins (deterministic, no ping-pong)

This is a CRDT pattern. No server coordination needed. Firestore's `onSnapshot` gives us causal ordering for free.

### 5. Client-side IDs (never server-generated)
Every new item gets an ID from `crypto.randomUUID()` at creation time, on the client. This means:
- Offline writes have stable IDs from the moment they're created
- No "temp ID → real ID" remapping nightmare
- Foreign keys (e.g. `linkedSkillId`) are always valid the moment the item exists

UUID v4 collision probability is ~zero. Don't worry about it.

### 6. Tombstones, never raw deletes
Deleting an item sets `_deletedAt = Date.now()`. The item stays in Firestore. Readers filter `_deletedAt` out by default. This guarantees:
- Multi-device delete propagates (the tombstone is the signal)
- "Resurrected" items are impossible (a stale write with older `_modifiedAt` than the tombstone still loses)
- Undo within a session is trivial (clear `_deletedAt`)

Garbage collection: tombstones older than 30 days are hard-deleted by a periodic cleanup (server-side function, runs daily).

### 7. Offline queue
Writes go to localStorage immediately AND enqueue for Firestore. The queue is `brilliance_v5_write_queue` in localStorage, an array of `{ collection, op, id, payload, queuedAt }`.

The queue flushes:
- Every 200ms while online
- On `online` event (network returns)
- On `visibilitychange` to visible (tab returns to foreground)

Failed writes retry with exponential backoff up to 5 minutes. After 1 hour of failure, surface a UI banner "some changes haven't synced — check connection."

### 8. Schema versioning + migrations
`_schemaVersion` on every item. Each Collection registers migrations:

```typescript
const brandsCollection = new Collection<Brand>({
  // ...
  schemaVersion: 3,
  migrations: {
    1: (data: BrandV1) => migrateV1ToV2(data),
    2: (data: BrandV2) => migrateV2ToV3(data),
  },
});
```

On read, if `item._schemaVersion < spec.schemaVersion`, the migration chain runs. The migrated item is saved back at the new version (write-through), so future reads are clean.

This means the schema can evolve without coordinated migration scripts. Each item migrates lazily on first read.

### 9. Backpressure and limits
- Write queue capped at 1000 items. If exceeded, oldest dropped, warning logged, UI surfaces "queue full" state.
- Per-collection in-memory cache capped at 5000 items. Beyond that, items load on demand from local IndexedDB (pre-existing storage shim).
- Snapshot listeners paginate at 500 items per snapshot for collections with high churn (conversations).

### 10. Observable state
Every Collection exposes its sync state. The platform's status dot (Brilli's pulse) reads from `SyncEngine.aggregateStatus()`:

```typescript
type SyncStatus = 'idle' | 'pushing' | 'pulling' | 'offline' | 'error';

SyncEngine.aggregateStatus();   // worst across all collections
SyncEngine.pendingWrites();     // sum of all queued writes
SyncEngine.lastSyncedAt();      // most recent successful flush
brands.status();                // per-collection
```

UI consumes these via `watch()` callbacks. No polling.

---

## Public API

`services/sync` exports exactly this surface. Nothing else.

```typescript
// services/sync/index.ts

// The Collection class - main API
export class Collection<T> {
  constructor(spec: CollectionSpec<T>);

  // Reads (synchronous from in-memory cache)
  list(opts?: ListOpts): Synced<T>[];
  get(id: string): Synced<T> | null;
  count(opts?: ListOpts): number;

  // Writes (immediate local + queued cloud)
  put(payload: T, opts?: PutOpts): Synced<T>;
  patch(id: string, patch: Partial<T>): Synced<T>;
  delete(id: string): void;
  undelete(id: string): void;     // clears _deletedAt within a 30-day window

  // Subscriptions
  watch(cb: (items: Synced<T>[]) => void, opts?: ListOpts): Unsubscribe;
  watchOne(id: string, cb: (item: Synced<T> | null) => void): Unsubscribe;
  watchStatus(cb: (status: SyncStatus) => void): Unsubscribe;

  // State
  status(): SyncStatus;
  pendingWrites(): number;
  lastSyncedAt(): number;

  // Manual control (rarely needed)
  forcePull(): Promise<void>;
  forceFlush(): Promise<void>;
}

// Aggregate engine
export const SyncEngine: {
  registerCollection(c: Collection<unknown>): void;
  aggregateStatus(): SyncStatus;
  pendingWrites(): number;
  lastSyncedAt(): number;
  watchStatus(cb: (status: SyncStatus) => void): Unsubscribe;
  collections(): Collection<unknown>[];
  bootstrap(uid: string): Promise<void>;   // called once on auth resolved
  shutdown(): Promise<void>;                // called on sign-out
};

// Types
export type {
  Synced,
  SyncStatus,
  CollectionSpec,
  ListOpts,
  PutOpts,
  Unsubscribe,
};
```

That's it. ~30 exported symbols. The entire app's sync needs through one door.

---

## The state machine

### Per-collection states

```
idle ─── put/patch/delete ───────→ writing
  ▲                                   │
  │                                   ↓
  │                               (firestore ack)
  │                                   │
  └─────────────────────────────── ◄──┘

idle ─── network drop ────────────→ offline
  ▲                                   │
  │                                   ↓
  │                              (queue grows)
  │                                   │
  │                              (network back)
  │                                   ↓
  └─────────────────────────────── flushing → idle

idle ─── snapshot event ──────────→ pulling → idle

any state ─── unrecoverable error ─→ error (with retry timer)
```

### Aggregate states (across all collections)
- `idle` if all idle
- `pushing` if any writing
- `pulling` if any pulling and none writing
- `offline` if any offline
- `error` if any error
- The aggregate is the worst state in the lattice: error > offline > pushing > pulling > idle

---

## Conflict resolution algorithm

When `onSnapshot` delivers an update, for each item:

```
incoming = the new version from Firestore
local = the current local version (or null if new)

if !local:
  apply(incoming)
elif incoming._modifiedAt > local._modifiedAt:
  apply(incoming)
elif incoming._modifiedAt < local._modifiedAt:
  ignore (we have newer data; will push next flush)
else:  // _modifiedAt equal
  if incoming._clientId > local._clientId:
    apply(incoming)
  else:
    ignore
```

Tombstones are handled identically. A `_deletedAt` is just another field; the item with the higher `_modifiedAt` wins regardless of whether it's a delete or an update.

This algorithm has the critical property: **idempotent and commutative.** Apply the same set of writes in any order, end up with the same final state. This is what we lost in some of v3.x's edge cases (the Feb 9 chat resurrection bug).

---

## Continuous sync mechanics

```typescript
// services/sync/engine.ts (sketch)

class CollectionImpl<T> {
  private cache = new Map<string, Synced<T>>();
  private writeQueue: WriteOp[] = [];
  private snapshotUnsub?: () => void;
  private flushTimer?: number;
  private status: SyncStatus = 'idle';
  private listeners = new Set<(items: Synced<T>[]) => void>();

  constructor(private spec: CollectionSpec<T>) {
    this.loadFromLocalStorage();    // bootstrap from cache instantly
  }

  bootstrap(uid: string): void {
    this.subscribeFirestore(uid);
    this.scheduleFlush();
  }

  put(payload: T): Synced<T> {
    const id = crypto.randomUUID();
    const item: Synced<T> = {
      id,
      data: payload,
      _modifiedAt: Date.now(),
      _createdAt: Date.now(),
      _clientId: getClientId(),
      _schemaVersion: this.spec.schemaVersion,
    };
    this.cache.set(id, item);
    this.persistLocal();
    this.enqueueWrite({ op: 'set', id, item });
    this.notifyListeners();
    return item;
  }

  // ... patch, delete, etc. similar pattern

  private subscribeFirestore(uid: string): void {
    const path = this.spec.firestorePath(uid);
    this.snapshotUnsub = onSnapshot(query(collection(db, path)), (snap) => {
      this.status = 'pulling';
      snap.docChanges().forEach((change) => {
        const incoming = change.doc.data() as Synced<T>;
        const local = this.cache.get(incoming.id);
        if (this.shouldApply(incoming, local)) {
          this.cache.set(incoming.id, incoming);
        }
      });
      this.persistLocal();
      this.notifyListeners();
      this.status = 'idle';
    });
  }

  private shouldApply(incoming: Synced<T>, local?: Synced<T>): boolean {
    if (!local) return true;
    if (incoming._modifiedAt > local._modifiedAt) return true;
    if (incoming._modifiedAt < local._modifiedAt) return false;
    return incoming._clientId > local._clientId;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = window.setTimeout(() => this.flush(), 200);
  }

  private async flush(): Promise<void> {
    this.flushTimer = undefined;
    if (!navigator.onLine) { this.status = 'offline'; return; }
    if (this.writeQueue.length === 0) return;
    this.status = 'pushing';
    const batch = this.writeQueue.splice(0, 100);
    try {
      await this.firestoreBatchWrite(batch);
      this.lastSyncedAt = Date.now();
      this.status = 'idle';
    } catch (e) {
      this.status = 'error';
      this.writeQueue.unshift(...batch);
      this.scheduleRetry();
    }
    if (this.writeQueue.length > 0) this.scheduleFlush();
  }
}
```

Real implementation will be ~400-600 lines of TypeScript with full edge cases. This sketch shows the shape.

---

## Migration from v4 to v5

This is the careful part.

### Phase A — Build v5, dual-write (4 weeks)
- Build `services/sync` as the v5 implementation
- Wire it up to read from existing `roweos_*` localStorage keys (backward compat read)
- Wire it to read from existing Firestore paths (`users/{uid}/brands`, `users/{uid}/conversations/...`)
- Every legacy write site (e.g. `saveBrands()`, `saveConversation()`) gets a parallel call to the v5 Collection
- v5 writes go to NEW paths (`users/{uid}/brands_v5`) AND new localStorage keys (`brilliance_v5_brands`)
- Reads still come from v4 paths
- Deploy. Everyone's data flows to both v4 and v5 simultaneously. v5 is dormant from a UI perspective.

### Phase B — Reconciliation (2 weeks)
- Daily cron compares v4 and v5 data per user
- Discrepancies logged to a Firestore `sync_v5_audit` collection
- We watch the discrepancy log. Zero discrepancies for 14 consecutive days = v5 is correct.
- During this phase, fix bugs in v5 wherever discrepancies arise. The goal: get to zero.

### Phase C — Read switch (1 week)
- Flip a server-side flag (`sync_v5_reads_enabled`) for one user (Jordan) first
- Reads now come from v5 paths
- Writes still go to both
- Monitor for 7 days
- If stable, expand the flag to 10% of users, then 100%

### Phase D — v4 retirement (after 30 days at 100%)
- Stop writing to v4 paths
- Delete v4 implementation files
- Migrate any user's last-known v4 data into v5 paths (one-time backfill)
- Memory files updated. CLAUDE.md updated. Done.

This is **3 months of overlap.** That's correct. It is the price of not breaking 10 paying clients.

---

## Backwards compatibility (existing data)

When v5 boots for the first time on a user's device:

1. Read existing v4 localStorage keys (`roweos_brands`, `roweos_conversations`, etc.)
2. For each item, normalize to `Synced<T>` shape:
   - `id` from existing field if present, else `crypto.randomUUID()`
   - `_modifiedAt` from existing `_modifiedAt`/`updatedAt` field, else `Date.now()`
   - `_createdAt` from existing `createdAt` field, else `Date.now()`
   - `_clientId` is the current session's client ID (acceptable, won't collide because no other client is writing this v5 path yet)
   - `_schemaVersion: 1` (initial v5 version)
3. Write to v5 localStorage AND v5 Firestore paths
4. Existing v4 paths are untouched

After this one-time migration per device, v5 is the source of truth from that device's perspective. v4 still exists and is still being written to (Phase A) for safety.

---

## Client identity

Every browser session gets a `_clientId`:

```typescript
function getClientId(): string {
  let id = localStorage.getItem('brilliance_client_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('brilliance_client_id', id);
  }
  return id;
}
```

Persists across sessions. New if localStorage is cleared. Stable enough for tiebreaks.

This is also useful for:
- "Last edited from: Jordan's MacBook" UI strings
- Multi-device debugging — which device wrote this?
- Conflict audit logs — which clients disagreed and what won

---

## Schema versioning + migrations

```typescript
// Example: brands collection migrating from v2 to v3 (renaming field)
const brands = new Collection<Brand>({
  // ...
  schemaVersion: 3,
  migrations: {
    1: (raw: BrandV1) => ({ ...raw, contactEmail: '' }),       // v1 → v2: add contactEmail
    2: (raw: BrandV2) => ({ ...raw, voice: raw.tone, tone: undefined }),  // v2 → v3: rename tone → voice
  },
});
```

On read, if `item._schemaVersion < 3`, run migrations 1, 2 in order (or just 2 if at v2). Save back at v3. Future reads are clean.

This means **no flag-day migration scripts.** No coordinated downtime. Items migrate when they're first read, lazily.

---

## Tombstone garbage collection

Tombstones (items with `_deletedAt` set) accumulate forever if not GC'd. After 30 days, they're hard-deleted.

Options:
- **Server-side Firebase Function** running daily — preferred for accuracy
- **Client-side cleanup on bootstrap** — simpler, but unreliable across multi-device

Recommended: server-side Function. Already have Cloud Functions deployed (`runScheduledTasks`). Add `runTombstoneGC` as a sibling.

```typescript
// functions/src/runTombstoneGC.ts (sketch)
export const runTombstoneGC = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const collections = ['brands_v5', 'conversations_v5', /* ... */];
    for (const c of collections) {
      const stale = await db.collectionGroup(c)
        .where('_deletedAt', '<', cutoff)
        .get();
      const batch = db.batch();
      stale.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  });
```

---

## Performance budget

| Metric | Target | How |
|---|---|---|
| Write to local cache | < 1ms | In-memory Map.set + sync localStorage write |
| Write to cloud (queued, online) | < 500ms p95 | Batched 100-write Firestore writes every 200ms |
| Read from cache | < 0.1ms | In-memory Map.get |
| Initial load (1000 items, online) | < 2s | onSnapshot + paginated bootstrap |
| Reconnect after offline | < 5s | Firestore SDK auto-reconnect, queue flushes |
| Memory per 1000 items | < 5MB | LRU cache, lazy IndexedDB load for cold items |

If we miss any of these, we have a regression. Tests verify the budgets.

---

## UI surfaces

Sync state needs to surface in three places:

### 1. Brilli status dot (sidebar / liquid-nav)
- `idle` → soft pulse, gold-1
- `pushing` → faster pulse, gold-2
- `pulling` → slow pulse, gold-2
- `offline` → static gold-5, dim
- `error` → ring around dot, gold-3

Tooltip on hover: "All synced" / "Saving 3 changes..." / "Offline — 12 changes queued" / "Sync error — retrying"

### 2. Settings → Sync tab
- Per-collection status table: brands, conversations, automations, scribes, evolve_*
- For each: status, pending writes, last synced time, item count
- "Force pull" button per collection (debug only)
- Audit log of recent conflicts (debug)

### 3. Banner (only when needed)
- Persistent banner if offline > 5 minutes with pending writes: "12 changes haven't synced. Connect to save."
- Persistent banner if error state > 1 minute: "Sync error. Retrying. Click to view details."
- Auto-dismisses on resolution

---

## Testing plan

### Unit tests (Vitest)
```
services/sync/__tests__/
  collection.test.ts            # Collection<T> CRUD, watch, subscribe
  conflict-resolution.test.ts   # LWW + clientId tiebreaker
  offline-queue.test.ts         # queue flush, retry, capacity
  tombstone.test.ts             # delete sets _deletedAt, undelete clears it
  schema-migration.test.ts      # lazy migration on read
  client-id.test.ts             # persistence, generation
  status.test.ts                # state machine transitions
```

### Integration tests (Vitest + Firebase emulator)
```
services/sync/__tests__/
  sync.integration.test.ts      # full write → cloud → other-client read flow
  multi-client.integration.test.ts  # two simulated clients, conflict resolution
  offline-online.integration.test.ts # disconnect, write, reconnect, verify
```

### E2E tests (Playwright)
```
e2e/sync/
  brand-create-syncs.spec.ts    # create brand on device A, appears on device B
  brand-delete-tombstones.spec.ts  # delete propagates, no resurrection
  offline-write-recovers.spec.ts   # write offline, come online, change visible
```

### Regression tests (every past production bug)
Each bug from CLAUDE.md "Common Bug Patterns" gets a test:
- `_normalizeTs` ISO vs ms numeric
- `_all` doc subset preventing data loss
- Empty cloud array as deletion signal
- Tombstone resurrection from stale write
- Brand stable IDs vs array indices

---

## Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| v5 has bugs that v4 didn't have | High | Phase B reconciliation period. Audit log. Zero-discrepancy bar before read switch. |
| Dual-write doubles Firestore costs | Medium | Phase A is 4 weeks max. Cost tolerable. Plan terminates Phase D after 60 days. |
| Schema migration breaks unread data | Medium | Migrations are pure functions, tested. If a migration throws, item is marked `_migrationFailed` and surfaces in UI for manual intervention. |
| Tombstone GC deletes recent items | Medium | 30-day window is generous. Configurable per collection. Manual override for collections with high churn. |
| Client ID collision | Vanishingly low | UUID v4 — 1 in 10^36. Not a real risk. |
| Snapshot listener disconnects on iOS PWA background | Medium | Firebase SDK auto-reconnects. Local writes queue during disconnect. visibilitychange flushes on return. |
| User signs out mid-flush | Medium | shutdown() cancels pending writes. Items remain in localStorage; flush resumes on next sign-in. |
| Cross-collection consistency (delete brand, orphan conversations) | High | Sync layer doesn't know about cross-collection. Services layer (e.g. `services/brand`) handles cascading on delete. |
| Stripe webhook writes (server-side) bypass sync | Medium | Server writes use the same `Synced<T>` envelope. Document a server-side helper `markSyncedWrite()`. |
| Existing v4 data has malformed items (e.g. missing `_modifiedAt`) | Medium | Bootstrap normalizer handles all defaults. Items are not skipped; they're given defaults and saved at v5 schema. |

---

## What sync v5 deliberately does NOT do

- **CRDT for nested objects.** We do LWW per-item. If you edit `brand.voice` on device A and `brand.standards` on device B at the same time, one device's edits to the brand are lost. We accept this trade-off because real CRDTs are 10x the complexity. Workaround: split big objects into multiple small synced items if that's a problem (e.g., `brand_voice` and `brand_standards` as separate Collection items).
- **End-to-end encryption.** Firestore sees the data. If E2EE matters, that's a separate v6 conversation.
- **Real-time collaboration on the same item.** We sync at the item level, not the field level. Two users editing the same brand at the exact same second — one wins. Multi-user collab needs operational transform; out of scope.
- **Custom conflict-resolution callbacks.** LWW is the rule. No app-level "merge" hooks. Keeps the system understandable.

---

## Rollout plan (concrete weeks)

| Week | Work |
|---|---|
| 1 | services/sync skeleton, Collection<T> class, in-memory cache, localStorage write |
| 2 | Firestore subscribe + write paths, conflict resolution, tests |
| 3 | Offline queue, retry, capacity limits, status state machine |
| 4 | Schema migrations, tombstone semantics, client ID |
| 5-6 | Wire up first 3 Collections (brands, conversations, automations) in dual-write mode. Deploy. |
| 7-8 | Wire up remaining Collections. Reconciliation cron deployed. Watch logs. |
| 9-10 | Reconciliation must hit zero discrepancies for 14 consecutive days |
| 11 | Read switch for Jordan only. Watch closely. |
| 12-13 | Read switch for 10% → 100% of users |
| 14-17 | 30-day stability period |
| 18 | Decommission v4. Update memory files. Update CLAUDE.md. |

Total: **~4.5 months from start to v4 retirement.** Faster if Evolve doesn't ship in parallel; slower if it does (which it will).

This is sequenced AFTER v33.0 brand layer ships. v33.0 doesn't touch sync. Sync v5 is the headline of v34.

---

## Open questions for Jordan

1. **Confirm Sync v5 starts AFTER v33.0 brand launch?** Don't want a brand launch and a sync rewrite simultaneously. v33.0 first, v34 = sync v5 + Evolve.

2. **Tombstone GC server-side or client-side?** Recommend server-side via Cloud Functions. Confirm.

3. **Dual-write Firestore cost** — at current 10 clients, the doubled writes are negligible. As we grow, monitor. Ok to proceed?

4. **Sync UI surfaces** — okay to add the Sync tab to Settings (currently no Settings > Sync)? Recommend yes.

5. **Banner thresholds** — 5 minutes offline before banner, 1 minute error before banner. Adjust to taste. Recommend defaults.

6. **Cross-collection cascade** — services layer handles "delete brand → tombstone conversations." **CONFIRMED 2026-04-29.** Each `services/<domain>` module is responsible for cascading. Pattern:
   ```typescript
   // services/brand/index.ts
   export async function deleteBrand(id: BrandId): Promise<void> {
     const conversations = await brandConversations(id);
     conversations.forEach(c => services.conversations.delete(c.id));
     services.bloom.scrubForBrand(id);
     services.automations.unbindBrand(id);
     services.brand.collection.delete(id);  // last
   }
   ```
   Sync layer never knows about cross-collection relationships. Services layer is the orchestrator. Tested at the services layer.

7. **Multi-user / team mode** — strictly out of scope for v5. Confirm.

8. **Server-side writes (Stripe webhook, scheduler)** — do they pass through `services/sync` or have their own helper that produces the same envelope? Recommend a thin `markSyncedWrite()` server helper that writes the envelope manually.

---

## Bottom line

Sync v5 is the **redo** you asked for, done the way every successful at-scale sync rewrite has been done: parallel, dual-write, observable, retired only after a long stability period.

You'll feel the difference: no Sync Now button. No "did it save?" anxiety. No resurrection bugs. No special-case branches in your code. Every synced thing has the same shape, the same lifecycle, the same UI status surface.

The 4 prior rewrites were tactical (each fixed a specific class of bug). Sync v5 is structural (it makes the bug class impossible). That's the difference between rewriting again and getting it right.
