# LifeAI Sync Rebuild & Feature Fixes

**Date:** 2026-03-25
**Status:** Approved
**Scope:** LifeAI sync layer consolidation, data persistence fixes, feature repairs, Tax Intelligence rename

---

## Problem Statement

LifeAI has critical data persistence failures:

1. **Data loss on reload** -- users lose 8+ hours of work (conversations, goals, habits, routines, profile edits) because writes silently fail
2. **Deleted profiles resurrect** -- deleting a profile and reloading brings it back
3. **"+Add to Rhythm" button broken** -- dropdown opens but items are never saved or rendered
4. **Widget Builder toggles don't persist** -- pattern/widget visibility resets on reload, config never syncs to Firestore
5. **Sync indicator lies** -- shows "connected" (green) while writes are silently dropping
6. **Prompt customizations lost** -- per-agent prompts and settings only in localStorage, not synced to Firestore

### Root Cause

LifeAI uses a **dual-write architecture** that writes to both Firebase Realtime Database and Firestore simultaneously with no coordination:

- `syncLifeProfileToFirebase()` / `syncLifeProfilesToFirebase()` write to Realtime DB at `/users/{uid}/lifeai` with **no offline queue, no retry, and silent failure** (console.warn only)
- `writeDB('lifeAI/main', ...)` writes to Firestore at `roweos_users/{uid}/lifeAI/main` with proper offline queueing and merge support
- Many LifeAI functions (`addLifeAIInsight`, `addLifeAIGoal`, `saveLifeAIConversation`) only write to Realtime DB, bypassing `writeDB()` entirely
- On reload, `loadFromFirebaseV2()` pulls from Firestore (cloud-authoritative) and overwrites localStorage -- if Firestore writes never landed, local work is replaced with stale data
- The sync indicator only tracks Firestore `writeDB()` calls, so Realtime DB failures show as "connected"

---

## Design

### Section 1: Sync Layer Consolidation

**Remove all Realtime DB writes and reads for LifeAI:**
- Delete `syncLifeProfileToFirebase()` (~line 142653) -- Realtime DB single-profile write
- Delete `syncLifeProfilesToFirebase()` (~line 139736) -- Realtime DB multi-profile write
- Delete `loadLifeProfilesFromFirebase()` (~line 139756) -- Realtime DB multi-profile read
- Delete `loadLifeProfileFromFirebase()` (~line 142673) -- Realtime DB single-profile read
- Startup already uses Firestore via `loadFromFirebaseV2()`, so all Realtime DB paths are redundant

**Remove existing ad-hoc `writeDB` calls that will be replaced:**
- Remove `writeDB` call inside `saveLifeRoutines()` (~line 154457) -- replaced by `syncLifeAIToFirestore`
- Note: `saveLifeHabits()` and `saveLifeGoals()` have NO Firestore sync today -- they only write to localStorage

**Create a single sync entry point:**
```javascript
// New function: syncLifeAIToFirestore(fields)
// - Wraps writeDB('lifeAI/main', fields)
// - Debounced at 300ms to coalesce rapid writes
// - Tracks dirty fields -- only syncs what changed
// - Updates sync indicator based on write confirmation
```

**Route every LifeAI mutation through this function:**
- `saveLifeProfiles()` -> `syncLifeAIToFirestore({ profiles, currentProfileIdx, userName, appMode })`
- `addLifeAIInsight()` -> updates profile locally -> `syncLifeAIToFirestore({ profiles })`
- `addLifeAIGoal()` -> updates profile locally -> `syncLifeAIToFirestore({ profiles })`
- `saveLifeAIConversation()` -> updates profile locally -> `syncLifeAIToFirestore({ profiles, agentCommands })`
- `saveRhythmWidgetConfig()` -> `syncLifeAIToFirestore({ rhythmWidgetConfig })`
- Rhythm preferences -> `syncLifeAIToFirestore({ rhythmPreferences })`
- `saveLifeRoutines()` -> `syncLifeAIToFirestore({ routines })` (remove existing direct `writeDB` call)
- `saveLifeHabits()` -> `syncLifeAIToFirestore({ habits })` (net-new Firestore sync -- none exists today)
- `saveLifeGoals()` -> `syncLifeAIToFirestore({ goals })` (net-new Firestore sync -- none exists today)
- Life memory -> `syncLifeAIToFirestore({ memory })`
- Prompt/agent changes -> `syncLifeAIToFirestore({ mainSystemPrompt, coachPrompts, currentAgent })`

**Refactor insight/goal functions to use profiles array directly:**
- `addLifeAIInsight()` and `addLifeAIGoal()` currently read from `roweos_life_profile` (singular key) and write back to it, then separately patch the profiles array in a try-catch that swallows errors
- Refactor both to work directly with `getLifeProfiles()` / `saveLifeProfiles()` so changes flow through the single sync path reliably

**Debouncing strategy:**
- 300ms debounce window
- Dirty fields accumulate during the window, flushed as a single `writeDB()` call
- Immediate flush on `beforeunload` AND `visibilitychange` (hidden state) -- iOS Safari often skips `beforeunload` when switching apps or closing tabs
- Flush pending debounced writes immediately before any `loadFromFirebaseV2()` call to prevent cloud pull from overwriting un-flushed local changes

### Section 2: Write Verification and Sync Indicator Honesty

**Pending write tracking:**
- `syncLifeAIToFirestore` maintains a `pendingWrites` counter
- Incremented on write dispatch, decremented on Firestore success/failure callback

**Sync indicator states:**
- `pendingWrites > 0` -> **"saving"** (amber)
- `pendingWrites === 0`, no errors -> **"saved"** (green)
- Any write failure -> **"error"** (red)

**Failure handling:**
- On `writeDB` failure, queue for retry via existing `_queuePendingWrite` mechanism
- Show non-dismissable toast: "Changes not saved -- retrying..."
- Retry with exponential backoff (existing `syncWithRetry` pattern)

**Unsaved changes guard:**
- On `beforeunload`, if `pendingWrites > 0`, trigger browser's native "unsaved changes" warning
- Flush any debounced writes immediately before unload
- On `visibilitychange` (hidden), flush debounced writes immediately -- critical for iOS Safari where `beforeunload` is unreliable

**Stale data detection:**
- Store `lastConfirmedSync` timestamp in localStorage after each successful Firestore write
- On reload, during `loadFromFirebaseV2()`, compare `lastConfirmedSync` against last local edit timestamp
- If gap is large (local edits newer than last confirmed sync), warn user before overwriting local data with cloud data

### Section 3: Delete Reliability and Profile Index Safety

**Confirmed deletion:**
- `deleteLifeProfile()` calls `saveLifeProfiles(shorterArray)` and waits for Firestore write confirmation
- On success: show success toast, proceed normally
- On failure: restore deleted profile to local array, show error toast "Profile deletion failed -- please try again"

**Index bounds validation:**
- `getCurrentLifeProfile()`: if `currentProfileIdx >= profiles.length`, clamp to `profiles.length - 1` and persist corrected index
- `loadFromFirebaseV2()`: after restoring profiles from cloud, validate `currentProfileIdx` is within bounds

**Soft-delete safety net:**
- Deleted profiles get a `deletedAt` ISO timestamp and move to a `_deletedProfiles` array in the Firestore document
- Retained for 7 days
- Cleanup pass on startup removes profiles older than 7 days from `_deletedProfiles`

### Section 4: Widget Builder Sync + Pattern Toggle Fix

**Sync widget config to Firestore:**
- `saveRhythmWidgetConfig(config)` now calls `syncLifeAIToFirestore({ rhythmWidgetConfig: config })`
- `resetRhythmWidgets()` also syncs the reset state

**Fix position-independent widget mapping:**
- Add `data-widget-id` attributes to each `.life-rhythm-card` during render: `data-widget-id="routine"`, `data-widget-id="habits"`, `data-widget-id="goals"`, `data-widget-id="patterns"`
- Add `data-widget-id="survey"` to the `#rhythmSurveyWidgets` element
- Replace `applyRhythmWidgetLayout()` index-based mapping:
  ```javascript
  // Before (fragile):
  widgetMap['routine'] = cards[0];
  widgetMap['habits'] = cards[1];

  // After (robust):
  widgetMap['routine'] = panel.querySelector('[data-widget-id="routine"]');
  widgetMap['habits'] = panel.querySelector('[data-widget-id="habits"]');
  ```

### Section 5: "+Add to Rhythm" Button Fix

**Wire form submissions to proper save functions:**
- "Add Routine" form submit -> push to `lifeRoutines` -> `saveLifeRoutines()` -> `syncLifeAIToFirestore({ routines })`
- "Add Habit" form submit -> push to `lifeHabits` -> `saveLifeHabits()` -> `syncLifeAIToFirestore({ habits })`
- "Add Goal" form submit -> push to `lifeGoals` -> `saveLifeGoals()` -> `syncLifeAIToFirestore({ goals })`
- "Add Task" -> existing `confirmAddToRhythm()` path (already works for todos, just needs Firestore sync)

**Re-render after adding:**
- After each successful add, call `renderLifeRhythm()` to show the new item immediately
- Show success toast confirming the add

### Section 6: Tax Intelligence Rename + Prompt Sync Audit

**Rename "Tax Co-Pilot" to "Tax Intelligence":**
- All UI labels and sidebar entries
- `window.lifeOps` tax category and operation names
- Agent type identifier: `taxcopilot` -> `taxintelligence`
- `buildLifeAISystemPromptForCategory()` case handlers
- localStorage key values (agent selection)
- System prompt text references
- Migration: on startup, if localStorage has `taxcopilot` as selected agent, auto-migrate to `taxintelligence`
- Migration must also apply during `loadFromFirebaseV2()` cloud pull -- if Firestore returns `taxcopilot`, convert to `taxintelligence` before writing to localStorage (prevents older device from re-syncing the old name)

**Resolve dual localStorage key for main prompt:**
- Two keys exist: `roweos_lifeai_main_prompt` (used by prompt editor UI) and `roweos_life_main_prompt` (used by Firestore sync and some read paths)
- Canonicalize on `roweos_life_main_prompt` -- migrate `roweos_lifeai_main_prompt` on startup if it exists and the canonical key is empty
- Update prompt editor UI to read/write from canonical key

**Prompt sync audit -- add missing fields to Firestore sync:**
- `mainSystemPrompt` (custom override) -- partially synced today under `roweos_life_main_prompt`, but the prompt editor UI writes to `roweos_lifeai_main_prompt` which is NOT synced. Canonicalizing the key (above) fixes this.
- `coachPrompts` (per-agent custom prompts) -- currently `roweos_life_coach_prompts` in localStorage only, NOT synced. Net-new restore path needed in `loadFromFirebaseV2()`.
- `currentAgent` (selected agent type) -- currently `roweos_life_agent` in localStorage only, NOT synced. Net-new restore path needed in `loadFromFirebaseV2()`.
- All three get added to `syncLifeAIToFirestore()` dirty field tracking
- All three get net-new restore lines in `loadFromFirebaseV2()` cloud pull (these are additions, not modifications to existing restore code)

---

## Files Modified

- `/Volumes/roweOS/RoweOS/dist/index.html` -- all changes (monolithic file)

## Key Functions Affected

| Function | Change |
|----------|--------|
| `syncLifeProfileToFirebase()` | **DELETE** |
| `syncLifeProfilesToFirebase()` | **DELETE** |
| `loadLifeProfilesFromFirebase()` | **DELETE** |
| `loadLifeProfileFromFirebase()` | **DELETE** (singular variant, also Realtime DB) |
| `syncLifeAIToFirestore()` | **NEW** -- single sync entry point |
| `saveLifeProfiles()` | Route through new sync function |
| `addLifeAIInsight()` | Refactor to use profiles array directly, route through new sync function |
| `addLifeAIGoal()` | Refactor to use profiles array directly, route through new sync function |
| `saveLifeAIConversation()` | Route through new sync function |
| `deleteLifeProfile()` | Add write confirmation, soft-delete |
| `getCurrentLifeProfile()` | Add index bounds validation |
| `saveRhythmWidgetConfig()` | Add Firestore sync |
| `resetRhythmWidgets()` | Add Firestore sync |
| `applyRhythmWidgetLayout()` | Use data-attribute matching |
| `openLifeRhythmAddForm()` | Wire to proper save functions |
| `confirmAddToRhythm()` | Add Firestore sync |
| `buildLifeAISystemPromptForCategory()` | Rename taxcopilot -> taxintelligence |
| `loadFromFirebaseV2()` | Add new fields to cloud pull, index validation |
| `renderLifeRhythm()` | Add data-widget-id attributes to cards |

## Testing Checklist

- [ ] Create a new LifeAI profile, reload -- profile persists
- [ ] Edit goals/habits/routines, reload -- changes persist
- [ ] Have a conversation with an agent, reload -- conversation history persists
- [ ] Delete a profile, reload -- profile stays deleted
- [ ] Toggle widgets off in Widget Builder, reload -- toggles persist
- [ ] Add item via "+Add to Rhythm" -- item appears and persists on reload
- [ ] Go offline, make changes, come back online -- changes sync
- [ ] Rapid edits (color changes, typing) -- no write floods, debounce works
- [ ] Close tab during unsaved writes -- browser warns
- [ ] Sync indicator shows amber while saving, green on confirm, red on failure
- [ ] Tax Intelligence rename appears everywhere Tax Co-Pilot was
- [ ] Custom prompts persist across reload and devices
- [ ] Profile index stays valid after cross-device deletion
- [ ] Brand mode operations unaffected (regression check)
- [ ] iOS Safari: switch apps mid-edit, return -- data persists (visibilitychange flush)
- [ ] Prompt editor saves persist across reload (canonical key migration)

---

## Risks and Notes

1. **Firestore document size:** `lifeAI/main` holds profiles with conversation histories (50 per profile, 500 chars each), plus goals, habits, routines, memory, widget config, and prompts. Firestore has a 1 MB document limit. Monitor document size -- if users approach the limit, a splitting strategy will be needed in a future iteration.

2. **Soft-delete merge limitation:** With `merge: true`, the `_deletedProfiles` array replaces the previous one on each write. If two devices delete different profiles simultaneously, one device's deletions could be lost. Acceptable risk for now given the rarity of concurrent cross-device deletes.

3. **Debounce masking:** If a Firestore error persists on one field, the dirty-field accumulation means all subsequent fields are also blocked. The retry mechanism should be monitored -- if a specific field consistently fails, it should be isolated in error logs for debugging.
