# v32.0 — Tombstone & Sync Overhaul + Image Edit

**Status:** Design
**Date:** 2026-04-27
**Author:** Jordan + Claude (brainstorming)
**Target version:** v32.0 (single deploy after all four specs land)
**Predecessor:** v31.20 (`fc6e4e5`)

---

## Problem statement

As of v31.20, RoweOS has a working tombstone pattern for chat IDs only (`roweos_deleted_chat_ids` ↔ `profile/deletedChatIds`). Every other list category (Pulse Goals, BrandAI/LifeAI To-Dos, Brands, Brand Logos, Calendar, Library, etc.) deletes by array-filter and Firestore overwrite, with no tombstone. Combined with `safeSyncWrite()` applying cloud data unconditionally, `mergeByTimestamp()` resurrecting cloud-only items, `_all`-blob staleness, and an under-spec'd `onSnapshot` grace window, deletes do not stick.

Specific user-reported issues, observed 2026-04-27 on production v31.20:

1. Sync Inventory `×` button claims success but rows reappear after sync (e.g., orphan "LifeAI Profile 2 Logo").
2. Pulse Goals: 1 local vs 85 cloud — 84 ghost Focus-era goals (Governance, Mobile, Theft, Settings & Sync, etc.).
3. Completed Goals shows 78 entries, ~70 of which are pre-Pulse Focus goals; manually deleting them yesterday did not stick.
4. BrandAI To-Dos: 126/126 "Synced" but contains January 2026 entries deleted long ago.
5. Brand switcher reorder swaps logos between brands and does not save / sync (Brand Logos shows Local 5 / Cloud 1, "Push needed" never resolves).
6. Pulse "Import Tasks from Focus" button surfaces stale data and no longer needed (Focus retired in v28.8).
7. BrandAI chat with image attached + edit prompt → text refusal "system cannot directly edit". Gemini handles this with a working edit endpoint.

## Goals

- Authoritative deletion across every Sync Inventory list category, surviving onSnapshot races, slow Firestore writes, `_all` blob staleness, and cross-device propagation.
- One-time purge of pre-Pulse Focus residue from Jordan's tenant, with backup + restore.
- Brand-logo association integrity through reorder, sync, and IndexedDB overflow.
- Working image edit in BrandAI/LifeAI chat via the existing Nano Banana 3.0 Pro / GPT Image 2 paths.
- Internal marker versioning (v32.0-A → v32.0-D); single deploy + version bump (v32.0) at the end.

## Non-goals

- No deletion of legacy Focus HTML/CSS files (`src/html/life/05-focus.html`, related selectors). Out of scope; risk of breaking unrelated paths.
- No automated test suite. Project has no harness — manual click-path validation.
- No cross-tenant migration. Each user's tenant is independent; auto-purge fires per device on upgrade.
- No new image-generation features beyond extending the existing v31.17 path with edit support.

## Constraints

- 10 real clients are using RoweOS in production. Data integrity > everything; pre-purge backup is mandatory.
- All four specs build locally; no deploy until all land. Single combined deploy as v32.0.
- ES5 only, no bundler, no framework — vanilla JS in `src/js/core/`.
- Pre-existing patterns to honor: write-through to localStorage + Firestore, `mergeByTimestamp` for per-item conflicts, `safeSyncWrite` for cloud-authoritative pulls, `_all` blob fallback for atomic reads, `_idbPut`/`_idbGet` for IndexedDB overflow.

---

## Spec A — Unified Tombstone & Sync Architecture

Marker: `v32.0-A`

### A.1 Category registry

New file `src/js/core/22a-tombstones.js`. Exports `SYNC_CATEGORIES` array. One entry per category:

```js
{
  id: 'pulseGoals',
  label: 'Pulse Goals',
  localKey: 'roweos_pulse_goals',
  cloudPath: 'pulse_goals',          // Firestore subcollection name (under roweos_users/{uid}/)
  cloudShape: 'subcollection',        // 'subcollection' | 'blob' | 'inline-field'
  blobField: null,                    // for 'blob' shape only, e.g. 'data'
  parentDoc: null,                    // for 'inline-field' only, e.g. 'todos/main'
  idField: 'id',
  tombstoneKey: 'roweos_deleted_pulse_goals',
  cloudTombstonePath: 'profile/deletedPulseGoals',
  scrubReaders: ['pulseGoals', 'window.pulseGoals'],
  rerender: ['renderPulseView', 'renderPulse3Checklists'],
  legacyHeuristic: function(item) { /* defined per category in Spec B */ },
  graceMs: 5000                       // optional override; brands use 8000
}
```

**Categories registered (21 total, matching the Sync Inventory rows):**

brands, brandLogos, brandAIChats, lifeAIChats, brandTodos, lifeTodos, calendar, journal, libraryFiles, inventory, possessions, studioRuns, pulseGoals, automations, customOps, clients, team, directReports, lifeAIProfiles, folioItems, notebooks.

### A.2 Universal delete API

Three exported functions, used everywhere a delete happens:

```js
tombstoneAndDelete(categoryId, itemId)        // single item; returns Promise<{ok, id, ts}>
tombstoneAndDeleteMany(categoryId, itemIds)   // bulk (used by Spec B purge); returns Promise<{ok, count, failed}>
clearTombstones(categoryId)                   // admin-only undo; returns Promise<{ok, cleared}>
```

`tombstoneAndDelete(catId, id)` performs in this exact order:

1. Append `id` to local tombstone array (`tombstoneKey`); dedupe.
2. Filter `id` out of the local data array (`localKey`); write back via `_idbPut` if key is in `OVERFLOW_ELIGIBLE_KEYS`.
3. Write tombstone array to Firestore `cloudTombstonePath` blob with `_modifiedAt: Date.now()`.
4. Delete cloud doc(s):
   - `subcollection`: `deleteDoc(cloudPath/itemId)`
   - `blob`: re-write blob without that id, with `_modifiedAt: Date.now()`
   - `inline-field`: re-write parent doc with the field array filtered
5. Set `lastLocalSaveTime[catId] = Date.now()` (per-category map; replaces single global var).
6. Trigger rerender callbacks named in `rerender`.
7. Return `{ ok: true, id, ts: Date.now() }`. On step 4/5 failure, keep local tombstone (re-pushes on next sync); return `{ ok: false, id, error }`.

`tombstoneAndDeleteMany` batches steps 3–5 into a single Firestore batch when possible. Subcollection deletes use a `WriteBatch` (max 500 ops per batch — chunk if needed).

### A.3 Pull-side enforcement

`loadFromFirebaseV2()` gets a single helper called per category:

```js
applyTombstoneFilter(categoryId, cloudItems) → filteredItems
```

Steps:

1. Load local tombstone array + cloud tombstone blob; merge as union (dedupe).
2. Write merged union back to local + cloud (`_modifiedAt: Date.now()`) so all devices converge.
3. Filter `cloudItems` excluding any id in the union.
4. Filter local `localKey` array excluding any id in the union (catches resurrected dupes).

Called for both subcollection reads AND `_all` blob fallback reads.

### A.4 onSnapshot grace period upgrade

Replace single global `lastLocalSaveTime` (current implementation in `22-firebase-sync.js:2246`) with per-category map:

```js
var lastLocalSaveTime = {};            // { brands: 0, pulseGoals: 0, ... }
var LOCAL_SAVE_GRACE_PERIOD_DEFAULT = 5000;
```

Each `SYNC_CATEGORIES` entry can override via `graceMs`. Brands use `8000` (large `_all` doc takes longer to flush).

Listener flow becomes:

1. Receive payload.
2. Run `applyTombstoneFilter(catId, payload)`.
3. Check grace: `Date.now() - (lastLocalSaveTime[catId] || 0) < (cat.graceMs || DEFAULT)`.
4. Skip with debug log if within grace.
5. Else, merge.

### A.5 Sync Inventory `×` button rewrite

`deleteSyncCategoryItem(catName, itemId)` in `29-analytics-commerce.js:1618-1656` becomes a 3-line wrapper:

```js
function deleteSyncCategoryItem(catName, itemId) {
  var cat = SYNC_CATEGORIES.find(function(c){ return c.label === catName; });
  if (!cat) { showToast('Unknown category', 'error'); return; }
  showToast('Removing…', 'info');
  tombstoneAndDelete(cat.id, itemId).then(function(res) {
    showToast(res.ok ? 'Removed' : 'Removed locally — cloud retry pending', res.ok ? 'success' : 'warning');
    renderSyncInventory();
  });
}
```

Per-category special cases (e.g., the existing Pulse Goals `deleteDBDoc('pulse_goals', itemId, 'goals')` call) are absorbed into the registry's `cloudShape` declaration — no per-category branching in the handler.

### A.6 `_all` blob hardening

For categories with `cloudShape: 'subcollection'` that also write an `_all` fallback (currently only brands), `_all` MUST be re-written atomically inside the same `WriteBatch` as the individual-doc deletes. No more "delete individual, then write `_all` separately" — that opened a window for `onSnapshot` to fire on the stale `_all` and resurrect.

### A.7 Migration

On first launch of v32.0 (`localStorage.roweos_tombstone_init_v32 !== 'done'`):

1. Copy any existing tombstone-shaped key (today only `roweos_deleted_chat_ids`) into the new uniform namespace if the new key is missing.
2. Initialize empty tombstone arrays for all 21 categories.
3. Push initial tombstone state to cloud.
4. Set `localStorage.roweos_tombstone_init_v32 = 'done'`.

This is idempotent and non-destructive — Spec B handles the actual data purge.

---

## Spec B — Focus Residue Purge & Per-List Cleanup

Marker: `v32.0-B`

### B.1 Auto-purge on first launch

`purgeLegacyFocusResidue()` runs once when v32.0 loads. Guarded by `localStorage.roweos_focus_purge_v32 === 'done'`.

**Pre-flight (mandatory):**

1. Backup current state to two keys:
   - `roweos_pre_pull_backup` (existing pattern, gets overwritten by next pull).
   - `roweos_pre_purge_backup_v32` (new — survives subsequent pulls).
2. Backup also written to Firestore `profile/preBackup_v32` for cross-device restore.
3. Show one-time confirmation modal:

   > **v32.0 Cleanup**
   > Detected legacy Focus data:
   > - 84 dead Pulse Goals
   > - 38 BrandAI To-Dos older than v28.8 cutoff
   > - 70 completed Focus goals
   >
   > A backup has been written. Proceed?
   >
   > [Proceed] [Skip (mark done)] [Restore from backup]

   Counts are computed live from heuristics; numbers above are illustrative.

**Detection heuristics:**

`FOCUS_RETIRE_DATE = Date.parse('2026-01-15')` — Focus was retired in v28.8 around mid-January per CLAUDE.md.

`FOCUS_LEGACY_TITLES = [Governance, Staff Meeting, Mobile, Theft, Onboarding, Settings & Sync, Library, Identity, Studio & Pulse, Rhythm, Taxes 2025, Infiniti, Focus, Home, BrandAI, LifeAI, Inventory, Priority, Due by Today, Proposal, Leadership Academy, Rowe Org, LAA Strategy, Craig One on One, Unassigned]`. Match exact OR with prefix `(week of N/N)` suffix.

| Category | Predicate |
|---|---|
| Pulse Goals | `goal.createdAt < FOCUS_RETIRE_DATE` OR `FOCUS_LEGACY_TITLES.some(t => goal.title === t \|\| goal.title.startsWith(t + ' (week of'))` |
| Pulse Completed Goals | Same predicate, applied to `goal.archived === true \|\| goal.completed === true` set |
| BrandAI To-Dos | `todo.createdAt < FOCUS_RETIRE_DATE` AND `todo.completed === true` |
| LifeAI To-Dos | Same as BrandAI |

**Execution:**

For each category, build the kill-list using its predicate. Call `tombstoneAndDeleteMany(categoryId, killList)` from Spec A. Single batched write per category. Set `localStorage.roweos_focus_purge_v32 = 'done'` only after all categories complete successfully. If any category fails, stay incomplete; auto-retry on next launch.

**Result modal:**

> Purged 84 Pulse Goals, 38 To-Dos, 70 Completed Focus goals. Backup at `roweos_pre_purge_backup_v32`. Re-run from Admin → Configs.

### B.2 Admin re-run + restore panel

New panel in Admin → Configs (`src/html/brand/25-admin.html`) next to the existing v31.16 "Conversation History Purge" panel.

**Card title:** "Legacy Focus Data Purge"

**Contents:**

- Three preview-count rows (live from heuristics):
  - Pulse Goals: `<count>`
  - BrandAI To-Dos: `<count>`
  - Completed Focus: `<count>`
- "Re-Run Purge" button — ignores `roweos_focus_purge_v32` flag; runs the same flow as B.1 with confirmation modal.
- "Restore from v32 Backup" button — pulls `roweos_pre_purge_backup_v32` (local) or `profile/preBackup_v32` (cloud) and re-hydrates.
- "Export Backup as JSON" button — downloads the backup for manual archival.

Admin-gated via `isAdmin()`. Non-admin tenants get the auto-flow only.

### B.3 Per-list cleanup actions

Affordances added to each affected view. All route through `tombstoneAndDeleteMany`.

| View | Action | Location |
|---|---|---|
| Pulse → Completed Goals section | "Clear All" button next to section heading | `25-documents-lifeai.js` (Pulse renderer) |
| Pulse → individual completed goal card | Existing "Delete" link rewires to `tombstoneAndDelete` | Same |
| BrandAI Chat To-Do list | "Clear Completed" button at top of list | `11-agents.js` (todo list renderer) |
| LifeAI To-Do list | Same | Same |
| Sync Inventory header | "Clear All Completed (across categories)" — admin only | `29-analytics-commerce.js` |

### B.4 "Import Tasks from Focus" removal

Per user direction (2026-04-27): the button and its panel are deleted entirely.

- `25-documents-lifeai.js:8862` — remove the `Import Tasks` button HTML from the Pulse goal card template.
- `25-documents-lifeai.js:9971` — delete the `showTodoImportForGoal()` function and the panel HTML.
- Delete `importSelectedTodosToGoal()`.
- Pulse goal cards now show only **+ Add Item** and **AI Tasks** as action buttons.

### B.5 What B does NOT do

- Does not delete legacy Focus HTML/CSS files (`src/html/life/05-focus.html`, related selectors).
- Does not migrate other tenants. They run their own auto-purge on upgrade; tenants are independent.

---

## Spec C — Brand-Logo Association Integrity

Marker: `v32.0-C`

### C.1 Storage model — hybrid, ID-keyed only

`LOGO_SIZE_THRESHOLD = 100 * 1024` bytes (100 KB base64).

**Small logos (< threshold):**

- Inline on brand object: `brand.logo` and `brand.logoLight` (base64 data URLs).
- Sync rides existing brand doc — `brands/{stableId}` and `brands/_all`.

**Large logos (≥ threshold):**

- Local: stripped from `brand.logo` to `''` for the localStorage write; full base64 stored in IndexedDB under `roweos_brand_logo_{stableId}` (and `_light` variant).
- Cloud: parallel subcollection `brand_logos/{stableId}` with `{ logo, logoLight, _modifiedAt }`.
- Brand doc carries marker `brand.logoOversize = true` (and `logoLightOversize = true`) so loaders know to fetch the subcollection.

**All cases:** localStorage logo keys are stable-ID-keyed. Position-keyed keys (`roweos_brand_0_logo`, `roweos_brand_1_logo`, etc.) are killed.

### C.2 Migration

`migrateBrandLogos_v32()` runs once. Guarded by `localStorage.roweos_brand_logo_migrated_v32 === 'done'`.

1. Scan localStorage for keys matching `/^roweos_brand_(\d+)_logo(_light)?$/` (position-keyed legacy).
2. For each match, look up `brands[idx]` to find its stable `id`.
3. If found, copy logo to new ID-keyed location (inline on brand if small, IDB if large).
4. If not found (orphan — brand was deleted), discard.
5. Delete the position-keyed key from localStorage.
6. Final pass: any brand with `logo` field but no `logoOversize` flag gets size-checked; if oversize, move to IDB + subcollection + set flag.
7. Persist via `saveBrands()` so cleaned brand objects sync to cloud.

### C.3 Reorder handler

Single function `reorderBrands(newOrderArray)`:

1. Reorders in-memory `brands` array by stable ID.
2. Writes localStorage `roweos_user_brands` with new order.
3. Calls `saveBrands()` (already does atomic batch + ghost cleanup per v28.3).
4. Calls `initBrandLogo()` to refresh sidebar logo.
5. Does NOT touch any logo localStorage key — those are bound by ID, not position.

All code paths reading a logo by index are rewritten to read by `brand.id`. Audit list:

- `roweos_brand_${idx}_logo` — every occurrence.
- `brands[idx].logo` accesses where `idx` is not `selectedBrand` — replace with `brands.find(b => b.id === id).logo`.
- `getBrandLogo()` / `setBrandLogo()` — accept `id` only.

### C.4 Push/pull sync

For brands flagged `logoOversize`:

- `saveBrands()` writes brand doc (with `logo: ''` and `logoOversize: true`) AND in the same batch writes `brand_logos/{id}` with full base64.
- `loadFromFirebaseV2()` after pulling brands runs a "logo hydration" pass: for any brand with `logoOversize === true`, fetch `brand_logos/{id}`, stash full base64 in IDB, populate `brand.logo` in-memory only (NOT in localStorage — keeps localStorage size manageable).
- Sync Inventory's "Brand Logos" row counts items in `brand_logos/*` subcollection (cloud) and IDB (local). The "Local 5 / Cloud 1" mismatch resolves to "Local 5 / Cloud 5" because the new push path actually writes them.

### C.5 Sync Inventory `×` for Brand Logos

Registry entry: `categoryId: 'brandLogos'`, `cloudShape: 'subcollection'`, `cloudPath: 'brand_logos'`.

`tombstoneAndDelete('brandLogos', stableId)` deletes the IDB entry, the subcollection doc, AND clears `brand.logo` / `brand.logoLight` / `brand.logoOversize` on the parent brand object via an inline-field follow-up write.

Orphans (e.g., "LifeAI Profile 2 Logo" with no parent brand) are detected during C.2 migration step 4. The `×` handler is also strengthened to handle orphans even if they slip past migration.

---

## Spec D — Image Edit Detection & Routing

Marker: `v32.0-D`

### D.1 Detection — combination logic

New regex constant in `20-ui-misc.js` next to `IMAGE_INTENT_RE`:

```js
var IMAGE_EDIT_INTENT_RE = /\b(edit|modify|enhance|adjust|fix|change|alter|retouch|remove|replace|crop|resize|recolor|recolour|convert|turn\s+(this\s+)?into|make\s+(this\s+)?(into\s+)?(a\s+)?(transparent|png|jpg|jpeg|webp|black\s+and\s+white|bw|grayscale)|make\s+transparent|background\s+removed?|remove\s+background|upscale|sharpen|blur|brighten|darken|saturate|desaturate|isolate|extract|cut\s*out|cleanup|clean\s*up|clean\s+this\s+up)\b/i;
```

Edit intent fires when any of:

1. **Implicit verb match:** message text matches `IMAGE_EDIT_INTENT_RE` AND ≥1 attachment with `type.startsWith('image/')` and `status === 'ready'`.
2. **Explicit model + attachment:** user has explicitly selected an image-capable model (`gemini-3-pro-image-preview` / `gemini-2.5-flash-image` / `gpt-image-2`) AND has ≥1 image attachment, regardless of prompt phrasing. Selection is "explicit" if it came from the model picker, not auto-routing.
3. **Generation match still wins for create/generate** — but if both regexes match AND there is an attachment, edit wins.

Detection runs in `runAgent()` and `sendFollowup()` in `11-agents.js` before model dispatch.

### D.2 Routing — provider-aware

New dispatcher `handleImageEditRequest(prompt, attachments, opts)` in `13-studio.js`. Routes by `roweos_image_provider_pref`:

| Provider | Endpoint | How |
|---|---|---|
| Nano Banana 3.0 Pro (default) | `gemini-3-pro-image-preview` via `generateContent` with multipart `inlineData` reference | Reuse `handleNanobananaChatImage()` (`13-studio.js:7705`). Pass attachment as reference, prompt as instruction. |
| Nano Banana 3.0 (legacy) | `gemini-2.5-flash-image` | Same path, different model id. |
| GPT Image 2 | `/v1/images/edits` (OpenAI) | Multipart form-data POST: `image` = source, `prompt` = instruction. v31.11 already wired this for explicit edit calls. |
| Imagen 4 | No edit endpoint | Fall back to Nano Banana 3.0 Pro with one-time toast: "Imagen doesn't support edits — using Nano Banana 3.0 Pro." |
| RoweOS Auto (Smart Routing) | Auto = Nano Banana 3.0 Pro for edits. |

### D.3 First-time provider picker

If `roweos_image_provider_pref` unset and user has not explicitly picked a model, show the same one-tap chooser the v31.17 generation flow uses, with header "Edit image with…" and same provider list. Choice persists to `roweos_image_provider_pref` (shared with generation).

### D.4 Removing the refusal

1. **Pre-empt:** routing in D.1 catches edit intent BEFORE the message hits the text model. Text LLM never sees the request — image edit pipeline does.
2. **System prompt fallback:** for the rare case edit intent fails detection, BrandAI/LifeAI system prompts get an addendum:

   > If the user asks to edit an image but no image is attached, say so explicitly and tell them to drag the image into the chat. Do not say the system cannot edit images — it can.

### D.5 Result rendering

Edited image renders inline in assistant turn the same way generated images do (per CLAUDE.md "Chat assistant turns with images"):

- `msg.imageUrl = dataUrl`
- `msg.content` = short text caption ("Here's the transparent PNG.").
- `msg.editMeta = { sourceAttachmentId, provider, model, instruction }` for History export and per-message actions.
- Five existing per-message actions work on the edited result: Save to Library, Save to Folio, Use as Reference, Download, Delete.
- Studio Gallery picks up the edit via existing `persistStudioGallery()` write.

### D.6 Edge cases

- **Multiple image attachments:** send all as `referenceImages` (Nano Banana supports multi-image input). Single prompt applied across them.
- **Image + non-image attachments:** non-image files stripped from edit payload; kept in chat turn for reference.
- **Streaming:** edit endpoints are non-streaming. Send button + blob state must reset on completion (per v31.20 fix). Loading state shows "Editing…".
- **Failure / quota:** on API failure, surface clear toast; leave user message visible (don't double-push). Source images > provider size limit are downscaled to ≤2048 px max edge before sending.

---

## Cross-cutting

### Versioning

Internal markers `v32.0-A` / `-B` / `-C` / `-D` in code comments. `ROWEOS_VERSION` in `09-state.js` flips to `v32.0` only at deploy time. The 8 version locations + CLAUDE.md QUICK REFERENCE update at deploy time only — per "no deploy until end" rule.

### Testing strategy

No automated harness. Manual click-path checklist per spec, run before moving to the next:

**Spec A:**
1. Delete a Pulse Goal in Sync Inventory `×`. Refresh page. Confirm gone locally.
2. Verify Firestore Console: `roweos_users/{uid}/pulse_goals/{id}` is absent, `profile/deletedPulseGoals.ids` contains the id.
3. Open another device. Confirm goal absent. Confirm tombstone synced.
4. Manually re-insert the goal id via console; trigger sync; confirm tombstone re-suppresses it.

**Spec B:**
1. Pre-purge: snapshot Sync Inventory counts.
2. Run auto-purge. Confirm modal counts match heuristic preview.
3. Verify Pulse Goals / Completed Goals / BrandAI To-Dos counts dropped as expected.
4. Click "Restore from v32 Backup". Confirm full restoration.
5. Re-run purge. Confirm idempotent.

**Spec C:**
1. Create a brand with a small logo + a brand with a large logo (>100 KB).
2. Reorder the brand switcher. Confirm logos follow brands.
3. Open another device. Confirm logos render correctly and order is preserved.
4. Delete a brand logo via Sync Inventory `×`. Confirm IDB + subcollection cleared, brand object updated.

**Spec D:**
1. Attach a JPG. Prompt: "Make this transparent PNG." Expect edited PNG inline.
2. Attach an image. Prompt: "Crop this." Expect edited result.
3. Attach an image with no prompt verb match. Expect text response unless model is image-capable.
4. Attach 2 images. Prompt: "Combine these." Expect both passed as references.
5. Switch to GPT Image 2 in picker. Repeat (1). Expect OpenAI edits endpoint hit.

### Files touched

**New:**
- `src/js/core/22a-tombstones.js` (registry + universal API)
- `docs/superpowers/specs/2026-04-27-tombstone-and-sync-overhaul-design.md` (this document)

**Modified:**
- `src/js/core/22-firebase-sync.js` — pull-side enforcement, onSnapshot per-category grace, tombstone hydration
- `src/js/core/29-analytics-commerce.js` — Sync Inventory `×` rewrite, admin Focus purge panel
- `src/js/core/25-documents-lifeai.js` — Pulse delete refactor, Import Tasks button + panel removal, per-list cleanup buttons
- `src/js/core/13-studio.js` — image edit dispatcher, brand logo path updates, edit-mode loading state
- `src/js/core/11-agents.js` — edit-intent detection in runAgent / sendFollowup, todo-list cleanup buttons, system prompt addendum
- `src/js/core/10-sync.js` — `saveBrands()` logo handling for oversize logos
- `src/js/core/20-ui-misc.js` — `IMAGE_EDIT_INTENT_RE` constant
- `src/js/core/26-smart-suggestions-onboarding.js` — provider routing additions
- `src/html/brand/25-admin.html` — Legacy Focus Data Purge panel
- `src/js/core/09-state.js` — `ROWEOS_VERSION` bump (deploy-time only)
- `CLAUDE.md` — QUICK REFERENCE version (deploy-time only)

**Deleted:**
- `showTodoImportForGoal()` function in `25-documents-lifeai.js`
- `importSelectedTodosToGoal()` function in `25-documents-lifeai.js`
- All position-keyed brand-logo readers across the codebase

### Rollback

- Spec B has explicit rollback: `profile/preBackup_v32` Firestore + `roweos_pre_purge_backup_v32` localStorage, surfaced in Admin → Configs as "Restore from v32 Backup".
- Spec A tombstones can be cleared via `clearTombstones(categoryId)` (admin function — not exposed in UI by default; callable from console).
- Migration flags (`roweos_focus_purge_v32`, `roweos_brand_logo_migrated_v32`, `roweos_tombstone_init_v32`) can be reset from Admin → Configs to re-run.
- Catastrophic deploy: `vercel rollback` to v31.20 commit `fc6e4e5`.

### Build & deploy sequence

1. Implement A → manual test → commit.
2. Implement B → manual test → commit.
3. Implement C → manual test → commit.
4. Implement D → manual test → commit.
5. Bump `ROWEOS_VERSION` to `v32.0`, update CLAUDE.md QUICK REFERENCE, update all 8 version locations.
6. Single deploy: `bash src/build.sh && ./deploy.sh`.

---

## Open questions / risks

- **Firestore batch size cap:** subcollection deletes use `WriteBatch` (max 500 ops). Spec B's bulk purge of ~84 Pulse Goals is fine, but if a future bulk delete crosses 500, chunk into multiple batches. Already handled in `tombstoneAndDeleteMany`.
- **Mid-purge crash:** if Spec B's auto-purge is interrupted mid-flight, the per-category completion check ensures it retries on next launch. Some categories may finish; those won't re-purge.
- **Race with onSnapshot during migration:** A.7 migration writes initial tombstone state to cloud. If `onSnapshot` is already attached, it'll fire. Mitigation: register listeners AFTER migration completes on first launch.
- **Logo size threshold edge case:** a brand with a logo right at 99 KB could flip across the threshold on subsequent edits. Mitigation: re-evaluate on every save, move to/from oversize as needed.
- **Provider key absence:** image edit fails gracefully if no Gemini / OpenAI key is configured. User sees a clear toast directing them to Settings → API Keys.

## Appendix — investigation summary

Source-of-truth file:line references gathered during exploration:

- Working chat tombstone: `22-firebase-sync.js:4114` (scrub), `:4220` (purge), `:9950`, `:10468` (pull merge)
- Sync Inventory `×` handler: `29-analytics-commerce.js:1618-1656`
- Sync Inventory render: `29-analytics-commerce.js:993-1262`
- Pulse Goals save: `25-documents-lifeai.js:7414-7468`
- Brand reorder + save: `10-sync.js:1417-1555` (saveBrands), `13-studio.js:4524-4614` (deleteBrand)
- onSnapshot grace period: `22-firebase-sync.js:2246-2250`, `:2442-2531` (brands listener)
- Image generation routing: `20-ui-misc.js:5991` (regex), `13-studio.js:7681-7779` (handler), `11-agents.js:6753-6780`
- Import Tasks panel: `25-documents-lifeai.js:8862` (button), `:9971` (panel)
- Logo storage hybrid: `10-sync.js:1479-1496` (`_all` write), `22-firebase-sync.js:2455-2465` (listener prefers individual docs)
