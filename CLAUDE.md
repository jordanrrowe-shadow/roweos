# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## QUICK REFERENCE

```
Version:  v34.82
File:     src/ (modular source) → builds to RoweOS/dist/index.html
Live:     roweos.com
```

### Session Startup
At the beginning of each session, run:
```bash
serena start-mcp-server --language-backend JetBrains
```

### Deploy to Production
```bash
bash src/build.sh && ./deploy.sh
```
Handles: version sync to CLAUDE.md, git commit+push, Vercel deploy. Manual fallback: `cd RoweOS/dist && npx vercel --prod` (needs `.vercel/project.json` or it prompts).

### Pre-deploy audit (MANDATORY before any production deploy)
v34.63: Visual regressions like stark-white slabs in light mode (Image #65/#66)
must be caught BEFORE shipping, not after. The audit ritual is:

1. **Spawn two parallel audit agents** (general-purpose):
   - **Visual-regression sweep**: scan CSS + HTML for theme-mismatch bugs
     (hardcoded `#fff` / `#ffffff` / `var(--bg-elevated)` on wrapper containers
     in light mode that paint stark slabs over the cream workspace).
   - **Em-dash sweep**: scan all user-facing HTML + JS string literals + email
     templates for `—` and replace with ` - ` (Jordan strongly dislikes em-dashes).
2. **Run mechanical checks**: `bash scripts/pre-deploy-audit.sh`
   Verifies version-string consistency across the 8 locations, build succeeds,
   257-test suite passes, no ES5 violations / base64-via-innerHTML / forbidden
   patterns. Exits 1 if anything fails.
3. **Act on every HIGH-severity finding** the agents return before invoking
   deploy.sh. MED / LOW findings can be deferred but not silently ignored.
4. Only after the script passes AND both agent reports are clean (or
   deferred-with-reason) should deploy.sh be run.

### Critical Rules
1. **Brand names:** Always `brands[idx].shortName || brands[idx].name`
2. **No emoji:** Always inline SVG icons
3. **ES5 only:** No arrow functions, let/const, template literals
4. **Bracket balance:** Pre-existing ~2-3 brace gap is normal (HTML/CSS/string contexts)
5. **Logo injection:** `document.createElement('img')` — never innerHTML for base64
6. **Init ordering:** `initBrandAccentColor()` / `initBrandLogo()` run before brand selector — re-call after restoration

### File Structure (Modular Source)
Source code lives in src/, built into RoweOS/dist/index.html by src/build.sh
```
src/css/           CSS (core themes, components, view-specific styles)
src/html/          HTML (head, shell, views organized by brand/life/shared)
src/js/core/       Core JS (foundation, state, sync, agents, features)
src/js/late/       Late JS (API bridge, mail/messaging)
src/build.sh       Concatenation build script
src/verify.sh      Diff verifier against reference

Key JS files:
  08-foundation.js   Store API, utils, constants, modal system
  09-state.js        Brand state, data initialization
  10-sync.js         Sync engine v4.0
  11-agents.js       BrandAI agent system, model switching
  12-library.js      File library, finder view
  13-studio.js       Studio panels, streaming, deep research
  14-calendar.js     Calendar, external integrations
  15-focus.js        Focus/today command center
  16-bloom.js        Bloom AI brand feed
  17-automations.js  Automations lab, folio
  18-social.js       Social media integration
  19-journal.js      Journal, inline automations
  20-ui-misc.js      Dropdowns, categories, misc UI
  21-sidebar.js      Liquid glass navigation
  22-firebase-sync.js Firebase sync, IndexedDB, admin
  23-offline.js      Offline support
  24-remaining.js    LifeAI identity + remaining features
```

### Editing Rules
- Edit src/ files only -- NEVER edit RoweOS/dist/index.html directly (it's generated)
- After any edit: run `bash src/build.sh` to regenerate index.html
- Verify with: `bash src/verify.sh` (diffs against reference)
- New features: create new file in src/js/core/ with appropriate numeric prefix
- CSS changes: edit src/css/core/01-base.css
- HTML view changes: find the view in src/html/brand/, life/, or shared/

---

## PROJECT CONTEXT

**RoweOS** — "Operating intelligence, built for brands."
Owner: Jordan - The Rowe Collection LLC - Austin, Texas

A private AI platform with two modes:
- **Brand Intelligence (BrandAI)** — Business management with specialized agents (Strategy, Marketing, Operations, Documents, Intelligence, Research)
- **Life Intelligence (LifeAI)** — Personal life management with coach archetypes

### Architecture
- Modular source (src/) concatenated into single HTML file — no bundler, no framework
- Pure vanilla HTML/CSS/JS, CDN deps: Firebase SDK, Marked.js
- Direct browser API calls to Anthropic/OpenAI/Google (keys in localStorage)
- Firebase sync (V3.1 write-through, cloud-authoritative) — every save writes to localStorage AND Firestore immediately. Cloud always wins on pull. `mergeByTimestamp()` handles per-item conflicts with `_modifiedAt` stamps. `safeSyncWrite()` applies cloud data unconditionally (no "skip empty" guard).

### Design Philosophy
- "Quiet competence" — professional elegance, Apple-like restraint
- Dark theme default, glass morphism: `backdrop-filter: blur(20px)`
- Gold accent #a89878 — per-brand customizable via `--brand-accent`

---

## BRAND PORTFOLIO

| Index | Brand | Short Name | Description |
|-------|-------|------------|-------------|
| 0 | The Rowe Collection | TRC | Parent luxury brand portfolio |
| 1 | Rowe Solo Training | Solo | Service dog certification |
| 2 | Rowe Retreats | Retreats | Luxury Airbnb in The Domain, Austin |
| 3 | Rowe Reserve | Reserve | Private concierge services |
| 4 | Rowe & Co. | R&Co | Custom goods and craftsmanship |

---

## CODING STANDARDS

### JavaScript (ES5 Required)
```javascript
// CORRECT
var items = data.filter(function(d) { return d.active; });
function renderView() { /* ... */ }

// WRONG
const items = data.filter(d => d.active);
```

### Requirements
- Explicit `function` declarations (not `var fn = function`)
- Null/undefined safety before property access
- HTML escaping for user input in innerHTML
- Wrap localStorage reads and API calls in try/catch
- Tag changes with version: `// v15.17: Fix sync`

### CSS
- CSS custom properties (`var(--accent)`) for theme values
- Light mode: `html.light-mode`, modes: `html.brand-mode` / `html.life-mode`
- Mobile: `@media (max-width: 768px)`

### Brand Color System
- Default gold: `#a89878`, CSS vars: `--brand-accent`, `--brand-accent-rgb`, `--brand-accent-10` through `--brand-accent-70`
- `applyBrandAccentColor(color)` sets both `--brand-accent-*` AND `--accent-*`
- Per-brand: `brands[idx].brandColor` (dark) / `brands[idx].brandColorLight` (light)

### SVG Icons (Never Emoji)
- ViewBox: `0 0 24 24`, stroke-width: `1.5` or `2`
- Sizes: 14px small, 16px default, 20px large

---

## KEY FEATURES (v25.2)

### Sync Architecture — Migration in Progress (v34.66+)

**Two layers in parallel.** Spec: `docs/brilliance/16-sync-v5.md`. Active migration plan: `memory/project_sync_v5_migration.md`. Read those two files first when touching sync.

**v4 (still source-of-truth, will retire after 30d observation):**
- Write-through: every save hits localStorage + Firestore simultaneously.
- Cloud always wins on pull (no "local wins" guards).
- `mergeByTimestamp()` resolves per-item conflicts using `_modifiedAt`.
- `_normalizeTs()` converts `_modifiedAt` to numeric ms.
- `safeSyncWrite()` applies cloud data unconditionally (empty = deleted).
- `manualSyncNow()` pushes brands first (3s wait), then pulls.
- Brands use stable ID doc paths (`brand_name_*`).
- `saveBrands()` fetches existing docs FIRST, then batch writes + deletes ghosts atomically.
- `deleteBrand()` deletes Firestore doc IMMEDIATELY before saveBrands runs.
- `_all` doc saves ALL brand fields (NEVER a subset). Individual docs preferred over `_all` on pull.
- Theme is device-local; cloud only seeds on first load.

**v5 (Sync v5, scaffolded + dual-writing in v34.66, behind four flags):**
- Universal envelope: `{ id, data, _modifiedAt, _createdAt, _deletedAt, _clientId, _schemaVersion }`. See `docs/brilliance/16-sync-v5.md` §1.
- Per-collection `Collection<T>` instances registered at module init in `35-sync-v5.js` `V5_REGISTRY`. 26 collections covering every v4-shadowed namespace plus profile/* sub-docs.
- Last-write-wins by `_modifiedAt`, ties broken by `_clientId` lexicographic. Implemented in `resolveConflict()`.
- Continuous `onSnapshot` per collection (read-shadow today; cloud-write when `roweos_sync_v5_writes` is on).
- Tombstones via `_deletedAt`. `runTombstoneGC` Cloud Function GCs envelopes older than 30d.
- Bootstrap migration runs once per device (gated by `roweos_sync_v5_bootstrap_done`) — seeds v5 caches from `roweos_*` localStorage so the discrepancy clock has historical data.
- `mirrorV4Write(collection, id, data)` is called from every v4 write path (writeDB, writeDBDoc, deleteDBDoc, saveBrands batch loop). No-op when `roweos_sync_v5_dual_write` flag is OFF.
- `runSyncV5Audit` Cloud Function compares v4 vs v5 daily; writes drift to `sync_v5_audit/{uid}/discrepancies`. Admin dashboard at Settings → Sync v5 → "View audit".

**Four flags (gate progression):**
1. `roweos_sync_v5` — read-shadow on (listens, never writes). Default OFF.
2. `roweos_sync_v5_writes` — v5-native cloud writes (evolve_* + every shadowed collection in `V5_NATIVE_COLLECTIONS`). Default OFF.
3. `roweos_sync_v5_dual_write` — v4 writes mirror into v5 envelopes. Default OFF.
4. `roweos_sync_v5_reads` — reads come from v5 collections (writes still hit both). Default OFF.

**Read facade** (Phase C #9, v34.67): `SyncV5.readArray(name, v4Reader)` and `SyncV5.readDoc(name, id, v4Reader)`. When `readsEnabled()` is OFF, the v4 reader runs unchanged. When ON, the v5 cache is consulted and envelopes are unwrapped to v4 shape so callers don't need to know. Already wired into `getReminders`, `loadScribeNotebooks`, `loadBrands`, `getMergedAutomations`, `pulseGoals` initializer.

**Migration phases (current state):**
- **Phase A (build dual-write)** — DONE in v34.66/v34.67. Per-collection registration, native allowlist, save-path hooks, bootstrap migration.
- **Phase B (reconciliation)** — `runSyncV5Audit` Function shipped; spec bar = 14 consecutive zero-discrepancy days. Currently waiting on production traffic to surface drift.
- **Phase C (read switch)** — facade + 5 highest-traffic readers routed in v34.67. Flag (`roweos_sync_v5_reads`) defaults OFF. Rollout: Jordan 7d → 10% 7d → 100%. Currently OFF for everyone.
- **Phase D (retire v4)** — STAGED for v35.x. Cannot run until 30 days at 100% v5 reads. Tracked in `memory/project_sync_v5_migration.md`. Items #11-#20.

**When changing sync code today:**
- Touch v4 paths normally — they remain source-of-truth.
- ALSO ensure v5 mirror happens. `writeDB` and `writeDBDoc` already do this; direct `db.batch()` calls (like `saveBrands`) need an inline `SyncV5.mirrorV4Write(coll, id, data)` after the batch.set.
- New collections need a row in `V5_REGISTRY` and matching entry in the `_v5Map` / `_subMap` in 09-state.js.
- Read sites: prefer `SyncV5.readArray('X_v5', () => v4Read())` over direct localStorage reads — gives us a binary cutover gate.
- **CRITICAL: `_all` doc must NEVER save a subset of fields.** Previously caused silent data loss when `loadFromFirebaseV2` preferred `_all` over individual docs and the subset won the timestamp merge.

### Universal Search (Hybrid)
- **Cmd+K** opens centered Spotlight modal (fast navigation + actions + inline AI)
- **Magnifying glass icon** opens right side panel (rich AI results + notifications tab)
- 3 modes: AI (default, uses BrandAI/LifeAI), Navigate (fuzzy match), Actions (command patterns)
- Tab key cycles modes, arrow keys navigate results, Enter executes
- Brand scoping: current brand or all brands toggle
- Key functions: `executeSearch()`, `searchWithAI()`, `searchNavigate()`, `searchActions()`

### Reminders (with Push Notifications)
- Data model: `{id, title, scheduledAt, status, snoozedUntil, actions, _modifiedAt}`
- In-app checker runs every 30s (`checkDueReminders()`)
- Bottom-right popup stack (max 3 visible, rest queued)
- Action buttons: Talk to AI, Add to Pulse, Add to Focus, Snooze (15m/30m/1h/3h/tomorrow), Complete
- Can't dismiss until action taken (`enablePopupDismiss()`)
- Web Push infrastructure: VAPID key, service worker (sw.js), Firestore subscriptions

### Bloom Launch Popup
- "What would you like to explore?" modal on Bloom launch
- Content types: Text, Info Graphics, Videos
- Optional topic input with suggested topics from brand/goals
- Generates custom 20-post batch via `bloomGenerateWithDirective(type, topic)`
- Preference: "Ask me each time" or "Remember my choice"

### Calendar (Multi-Platform Write-Back)
- Horizontal event cards with color-coded left borders per calendar source
- "Calendars" panel: toggle visibility, custom color picker per calendar
- +N overflow badge on days with >3 events
- "Push to" calendar picker on event creation
- Write-back: Google (existing), Outlook (MS Graph), iCloud (CalDAV via `/api/caldav-proxy`)
- Colors stored in `roweos_calendar_colors`, synced to Firestore

---

## DEPLOYMENT

### ZIP Structure
```
RoweOS.zip -> RoweOS/dist/ (with .vercel/project.json, index.html, vercel.json, etc.)
```

### Version Updates
Two-part format (v15.6, not v15.6.0). Version appears in: `ROWEOS_VERSION` constant, launch screen, mobile header, settings, sidebar footer, console logs, comments. Not in `<title>`.

### Delivery Checklist
1. RoweOS.zip (RoweOS/dist/, not bare dist/)
2. Version updated everywhere
3. Brief changelog
4. Deploy command as copyable text

---

## APP STRUCTURE

### Views (data-view -> Panel ID)

| Nav Item | data-view | Panel ID |
|----------|-----------|----------|
| Chat | agent | agentView |
| Signal | signal | signalView |
| Pulse | pulse | pulseView |
| Studio | studio | studioView |
| Rhythm | rhythm | rhythmView |
| Library | library | libraryView |
| Memory | memory | memoryView |
| Identity | tuning | tuningView |
| Settings | settings | settingsView |
| Inventory | inventory | inventoryView |
| Clients | clients | clientsView |
| Analytics | commerce | commerceView |
| Admin | admin | adminView |
| Mail | mail | mailView |
| Folio | folio | folioView |
| Social Hub | social | socialView |
| Bloom | bloom | bloomView |
| Automations | automations | automationsView |
| Section Landing | sectionLanding | sectionLandingView |

Analytics was renamed from Commerce in v15.15; internal IDs still `commerce*`.
Admin view (v22.1) is admin-only — hidden nav item, `showView('admin')` redirects non-admins to Settings.
Mail view (v22.23) — Outbox, Sent, Compose, Inbox (Gmail/Outlook), Settings tabs. localStorage: `roweos_mail_outbox`, `roweos_mail_sent`, `roweos_mail_config`. Firebase: `profile/mail`.

### BrandAI Agents: Strategy (#a78bfa), Marketing (#f472b6), Operations (#4ade80), Documents (#fbbf24), Intelligence (#22d3ee)
### LifeAI Coaches: Life Coach, Wellness Coach, Tax Copilot, Personal AI, Standard AI
### Sidebar: Always Collapsed (64px) | Auto (64px/220px hover) | Always Pinned (220px)

### Navigation System (v26.0)
- **Sidebar modes:** Grouped (Simplified, 6 groups) and Expanded (Advanced, original 20 items). Toggle in Settings > Preferences. Stored in `localStorage['roweos_sidebar_mode']`.
- **Two sidebar navs:** `#sidebarNav` (grouped) and `#sidebarNavExpanded` (original). `applySidebarMode()` toggles visibility.
- **Landing pages:** `_pageLandingConfigs` object defines per-page landing pages for all 16 views. `showPageLanding(viewId)` renders them. `enterPageSubSection(viewId, tabId)` navigates from landing to sub-section.
- **Pill nav:** `renderPillNav(containerId, items, activeId, onSelect)` replaces all tab bars. `handlePillNavClick()` and `updatePillNavActive()` manage state.
- **Tab handler wrappers must NOT call showView()** — `enterPageSubSection()` already calls it. Double-calling resets the view and breaks tab switching.
- **New views added to allViews array:** `sectionLandingView` must be in the `allViews` array in `showView()` or landing pages show blank.
- **Sidebar CSS selectors:** When adding a new fixed-position view, it MUST be added to ALL THREE sidebar state selectors: `html.sidebar-pinned`, `html.sidebar-hover-expanded`, `html.sidebar-pinned-collapsed`. Missing any = content bleeds behind sidebar.
- **Breadcrumb:** `updateNavBreadcrumb(['Home', 'Group', 'Section'])` manages nav state. `navigateBreadcrumb(index)` handles clicks.
- **Favorites:** `toggleFavorite(viewId, label)` adds/removes from sidebar favorites. Stored in `localStorage['roweos_sidebar_favorites']`.

---

## DATA REFERENCE

Detailed localStorage keys, function tables, Firebase sync architecture, brand selector sync, API key routing, and identity intelligence docs are in the **`data-reference.md`** memory file. Read it when working on those systems.

Key patterns to remember without looking up:
- `showView('agent')` to switch views
- `showToast(msg, type)` for notifications
- `escapeHtml(str)` for innerHTML sanitization
- `loadFromFirebaseV2()` for cloud pull (cloud-authoritative). `writeDB()` / `writeDBDoc()` / `deleteDBDoc()` for write-through. `syncToFirebaseV2()` is DEPRECATED (no-op). `manualSyncNow()` pushes brands first, then pulls. `reconcileOnStartup()` always pulls. `safeSyncWrite()` unconditionally applies cloud data. `mergeByTimestamp(local, cloud, idField)` for per-item conflict resolution. Tombstone tracking keys are REMOVED (v25.0+)
- **JSON.parse safety:** Every `JSON.parse` expecting an array MUST guard with `Array.isArray()`. Non-array returns (object, string) crash `.filter()/.map()` and silently break entire call chains.
- **Push/pull path matching:** When adding sync for a category, verify the push write path matches the cloud count read path. Mismatches cause "Push needed" that never resolves.
- **Writer/reader schema match (CRITICAL — caused the Feb 9 chat resurrection bug across 3 deploys):** When writing to clear/empty a Firestore doc, the WRITE schema MUST match every reader's expected fields. `writeDB('conversations/current', { data: '[]' })` left old `messages` array intact because the pull reads `convCurrent.messages`. Always grep readers FIRST and overwrite their exact field. Empty-array writes that target the wrong field are silent no-ops that resurrect data on next pull. Pull merges that prefer "longer" data must also honor empty cloud arrays as deletions, not as missing data to skip.
- **Tombstones need ALL readers patched (not just merge paths):** Adding a deletion tombstone like `roweos_deleted_chat_ids` requires filters in every reader: cloud merge (subcollection + blob fallback), History/list view render, Sync inventory counts AND extractors, AND a startup scrub that removes tombstoned items from local arrays. Patching only the cloud-merge path leaves stale local items showing forever.
- **Storage shim async race for OVERFLOW_ELIGIBLE_KEYS:** `localStorage.getItem` on `roweos_auto_lab_images`, `roweos_conversations`, `roweos_library`, etc. returns `null` synchronously when the key has been offloaded to IndexedDB, while triggering an async restore. UI rendering large data MUST use an in-memory cache (`window._studioGalleryMem` pattern) backed by direct `_idbPut`/`_idbGet`. Don't rely on the lazy-restore — it's racy and the first render after page load shows empty.
- **Chat assistant turns with images:** Set `msg.imageUrl = dataUrl` and put plain text in `content`. `renderConversation` (20-ui-misc.js:4826-4828) auto-injects the `<img>` when `imageUrl` is present and content has no `<img>`. NEVER embed raw `<img>` HTML in `content` — `formatMessageContent` will render it as escaped text.
- **Friendly model name lookup:** `_friendlyImageProvider(provider)` in 20-ui-misc.js maps internal IDs to display names ("imagen3"→"Imagen 4", "gpt-image-2"→"GPT Image 2", "gemini-3-pro-image-preview"→"Nano Banana 3.0 Pro"). Use this in any user-facing label. Add new providers to the lookup when you add them.
- **Never rely on console-based feature toggles:** Safari sandboxes/private mode throws `SecurityError` on `localStorage.setItem` from console. Always ship a UI toggle (Settings, Admin → Configs) for any user-or-admin feature flag.
- **Email log endpoints need a writer:** Any new server endpoint that sends mail (Resend, SendGrid, etc.) MUST include a `writeEmailLog` call mirroring `send-template-email.js` and depending on `FIREBASE_SERVICE_ACCOUNT` + `FIREBASE_PROJECT_ID` env vars. Without it, sends never appear in the Campaigns dashboard. Client paths should also fall back to direct Firestore write when server returns `data.logged === false`.
- `getAccentFallback()` for accent color with fallback (replaces inline `getComputedStyle` calls)
- `AGENT_COLORS` global constant for agent color map (strategy, marketing, operations, documents, coach, etc.)
- `ROWEOS_DEBUG` — `console.log` gated by `localStorage.getItem('roweos_debug') === 'true'`
- `findOperationById(id)` — unified operation lookup across ops, generatedBrandOps, custom ops, lifeOps, generatedLifeOps
- Automations dual storage: `roweos_automations` (localStorage) AND `getScheduledTasks()`/`saveScheduledTasks()` — both must be updated on save
- `executeWorkflow(workflow)` — runs multi-step pipelines; `executeWorkflowStep()` handles: post, studio, image, video, library, notify
- `generateVideoWithVeo(prompt, options)` — async Veo video gen (same API key as Nano Banana). `runVideoOperation()` for Studio. Video Lab tab: `videolab`. Ops IDs 49-52 (`isVideoOp: true`). Pipeline operations (image/video) must stay in sync across 4 locations: `renderPipelineStepConfig()`, `collectPipelineStepData()`, `executeWorkflowStep()`, pipeline step actions array
- `WORKFLOW_PRESETS` — predefined multi-step workflow templates; `resolveTemplateVars()` resolves `{{stepN_output}}` between steps

### Automation History (3 stores — all must be written on execution)
- `roweos_auto_lab_history` — Automations Lab timeline (20K char limit per entry)
- `roweos_task_history` — Used by Focus `viewCompletedAutomation()` and result modals
- `roweos_completed_automations` — Metadata only (no result text), used for completion badges
- `saveTaskResult()` writes to `roweos_task_history` — must be called from ALL execution paths (AI, post, image, pipeline)
- `addAutoLabHistory()` writes to `roweos_auto_lab_history` — called from all paths
- `addCompletedAutomation()` writes to `roweos_completed_automations` — called from all paths

### Social Connections (v18.0)
- Per-brand/per-life-profile: `getSocialKeyScope()` returns `_brand_N` or `_life_N`, appended to all social localStorage keys
- Key pattern: `roweos_social_{platform}_connected_brand_2`, `roweos_social_token_x_life_0`, etc.
- OAuth state encodes scope: `x_b2_abc123` (brand 2), `threads_l1_xyz` (life 1). v20.12: UID appended as `~u:firebaseUid` for Firestore token storage on mobile
- `social-callback.html` is a SEPARATE file that writes scoped keys independently — must be updated alongside `index.html` for any social key changes
- `roweos_social_pending_context` — stores scope before OAuth popup, read by callback
- Migration flag: `roweos_social_migration_v18` — one-time copy of global keys to `_brand_0`
- **Dual posting paths (v20.12)**: Client `postToSocial()` reads tokens via `getSocialToken()` (Firestore `social_tokens` → localStorage). Server `executeSocialPost()` in `scheduler.js` reads from `socialConnections` → Firestore `social_tokens` subcollection → legacy settings. When changing token storage format, update BOTH paths.
- `social-auth.js` writes tokens to Firestore `social_tokens` subcollection during exchange (v20.12) — enables mobile PWA access despite localStorage partitioning

### Enterprise / Access Key System
- `isAdmin()` — checks `firebaseUser.uid === ADMIN_UID`
- `getUserTier()` — cached (5min TTL), returns `'free'|'basic'|'founder'|'premium'` (v20.3: `'pro'`/`'enterprise'` still work as aliases)
- `hasFeatureAccess(feature)` — tier-based gate: sync/export (basic), brandConfig/automations/social/focus/analytics/identity (founder), whiteLabel/multiUser/privateOnboarding (premium)
- `generateAccessKey(tier, note)` / `revokeAccessKey(key)` — admin-only
- `validateAccessKey(key)` / `linkAccessKeyToUser(key)` / `checkUserAccessKey()` — user flow
- `claimBrandConfig(code)` — loads shared brand config from Firestore `brand_configs/{code}`. Replace if no existing brands, merge if existing
- `adminGenerateBrandConfig()` — admin-only, snapshots current brands/settings/memory/customOps to Firestore
- `openShareBrandModal()` / `generateShareBrandLink()` — any signed-in user can share current brand (v20.4). Snapshots single brand to `brand_configs/{code}`
- `adminLoadBrandConfigs()` — lists all shared configs with usage counts
- URL join: `?join=CODE` → stored in `roweos_pending_join` → claimed **synchronously before routing** in `showStartupScreen()` (v20.4 timing fix — no more setTimeout race with onboarding)
- Settings: "Join Brand Config" input calls `joinBrandConfigFromSettings()`. "Share This Brand" row (v20.4) calls `openShareBrandModal()`
- Identity header: "Share" button (v20.4) visible when `firebaseUser` exists, brand mode only
- Firestore collections: `access_keys`, `roweos_users`, `brand_configs`

---

## TROUBLESHOOTING

Pre-deployment validation, common errors, and known technical debt are in the **`troubleshooting.md`** memory file. Read it when debugging or before deployment.

### Cloud Functions Scheduler
- `getUserAutomations()` MUST include `doc.id` in returned data — executor needs `task.id` for locking and lastRun
- `isTaskDue()` uses 30-minute time window — tasks only execute within 0-30min of scheduled time
- `lastRun` written at START of execution with `lastExecutor: 'cloud_running'` to prevent duplicates
- Deploy: `FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions`
- Logs: `firebase functions:log --only runScheduledTasks`
- Pipeline email steps use cloud outbox pattern: Cloud Functions write to `cloud_outbox`, client picks up and sends via OAuth

### Social Hub (v25.5)
- All external API calls MUST go through proxies (CORS blocks direct calls from browser)
- Anthropic API from browser needs `anthropic-dangerous-direct-browser-access: true` header
- `getSocialKeyScope()` reads from `localStorage` (source of truth), not `selectedBrand` global (may be uninitialized)
- `postToSocial(platform, opts)` takes 2 args — set `window._socialPublisherContent` and `window._socialPublisherImage` globals before calling

### Deploy (when deploy.sh git push fails)
`export PATH="$HOME/.local/share/fnm:$PATH" && eval "$(fnm env)" && vercel --prod --yes`

### Common Bug Patterns
- **Sync data resurrection:** If deleted items reappear across devices, check: (1) `deleteBrand()` fires direct `.delete()` BEFORE `saveBrands()`, (2) `manualSyncNow()` pushes brands first (3s wait), then pulls, (3) `onSnapshot` listener has grace period check, (4) `_all` doc is updated immediately on delete. The `onSnapshot` listener is the #1 source of resurrection — it fires between async writes and ghost cleanup.
- **`_all` doc data loss:** NEVER write a subset of brand fields to `_all`. Use `JSON.parse(JSON.stringify(brand))` with only base64 stripping. `loadFromFirebaseV2` and `onSnapshot` now prefer individual docs over `_all`. `_all` is fallback only.
- **Crashes breaking call chains:** View renders called from `onBrandChange()` (like `renderFocusView`) must be wrapped in try/catch. A crash in one render prevents all subsequent brand-change logic from executing. Always guard `JSON.parse` results with `Array.isArray()` before calling `.filter()/.map()`.
- **Mail outbox stale on other devices:** Outbox merge in `loadFromFirebaseV2` must be cloud-authoritative (not local-authoritative). Cloud `[]` means all items were sent.
- **Duplicate function names:** Single-file means later definitions silently overwrite earlier ones. Before adding a function, grep for existing definitions with the same name.
- **NEVER touch `* { }` margin:** The global reset is `* { padding: 0; box-sizing: border-box; }` — do NOT add `margin: 0` to it. Margin resets are on a separate explicit element list. Do NOT re-add `min-height: 100vh` or `padding-bottom: env(safe-area-inset-bottom)` to body.
- **iOS box-sizing reflow hacks (CRITICAL — TWO locations):** (1) `DOMContentLoaded` handler toggles `box-sizing` off/on to fix initial render. (2) `visualViewport.resize` handler's keyboard-close branch does the same toggle after keyboard dismisses. BOTH hacks are required. NEVER remove either. Also NEVER remove `interactive-widget=resizes-content` from the viewport meta tag — it works with these hacks. The brief visual flash on load is acceptable.
- **Mobile CSS debugging:** Connect Safari Web Inspector to the phone (`Develop > iPhone`) before guessing. Make ONE change per deploy to isolate fixes. Chromium/Playwright CANNOT reproduce iOS Safari layout bugs (safe area, viewport, zoom).
- **Stale nav heights:** Legacy `mobile-nav` was 80px; current `liquid-nav` pill is ~50px. Use `calc(70px + var(--mobile-safe-bottom))` for scroll padding on views/panels, `calc(50px + env(safe-area-inset-bottom, 0px))` for fixed inputs above nav.
- **NEVER use `height: -webkit-fill-available` on `html`:** Use `min-height: -webkit-fill-available; min-height: 100dvh` instead. The `height` version combined with `overflow: hidden` clips at the safe area boundary on iOS, creating a black/white bar at the bottom. This was the root cause of the v29.0 mobile bottom bar regression.
- **Adding a new view (6 touch points):** `allViews` array, 8 CSS groups, sidebar nav HTML, `showView()` handler, mobile panel-view CSS selector (~L37688), light-mode mobile CSS selector (~L36374). Use `class="panel-view hidden"` (NOT `class="view hidden"` or `style="display:none"`).
- **Interface Zoom (75-150%):** Uses `appContainer.style.zoom` on BOTH desktop and mobile. Works on iOS Safari. NEVER replace with CSS variable scaling or transform — those approaches don't scale everything uniformly. NEVER add `calc(Npx * var(--zoom-scale))` patterns — they double-scale when CSS zoom is active.
- **PWA caching:** When mobile layout changes aren't showing after deploy, the user may need to delete and re-add the PWA. The installed web app caches aggressively.
- **PWA icons:** Must be RGB (no alpha channel) or macOS dock adds white border. Use sharp to flatten: `.flatten({ background: { r: 10, g: 10, b: 10 } }).removeAlpha()`
- **Keyboard handler:** `window.innerHeight` shifts on iOS with `interactive-widget=resizes-content`. Use a captured initial height for keyboard-close detection.
- **Mobile panel edge-to-edge (v29.1):** `.panel-view > .panel` has `padding-left/right: 0` on mobile. Direct children get padding via `.panel-view > .panel > * { padding-left/right: var(--space-4) }`. New view content automatically inherits this pattern.
- **deploy.sh minification:** `build.sh --minify` runs `html-minifier-terser` before Vercel deploy, then `build.sh --restore` restores unminified source. The deployed file is MINIFIED. The git repo has UNMINIFIED source.
- **Focus/Signal retired (v28.8):** `showView('signal')` redirects to Pulse. Liquid nav uses `scribe` instead of `signal`. Saved user tabs with `signal` auto-migrate to `scribe` via `getLiquidNavTabs()`.
- **Mobile nav default:** `'sidebar'` (liquid-nav off). User's saved preference in `roweos_mobile_nav` overrides.

---

## JORDAN'S PREFERENCES

- Direct and efficient — skip preamble, show work briefly
- Deploy command as copyable text, never as a file
- Always RoweOS.zip delivery with changelog
- Surgical edits over full rewrites
- No new dependencies without explanation
- Annoyances: emoji in app, Vercel setup prompts, full brand names, breaking existing features

---

## PLUGINS & WORKFLOW

Plugins activate automatically based on context:
- `/feature-dev` — non-trivial features, version updates
- `/commit`, `/commit-push-pr` — git workflow
- `/deploy`, `/logs` — Vercel (prefer `./deploy.sh` over `/deploy`)
- `/revise-claude-md` — end-of-session CLAUDE.md updates
- `/reflect` — end-of-session learning extraction
- `frontend-design` — auto-activates for UI work

Version update order: feature-dev -> frontend-design -> commit -> deploy -> revise-claude-md
