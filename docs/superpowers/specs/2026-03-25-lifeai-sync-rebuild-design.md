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

**Remove all Realtime DB writes for LifeAI:**
- Delete `syncLifeProfileToFirebase()` (~line 142653)
- Delete `syncLifeProfilesToFirebase()` (~line 139736)
- Delete `loadLifeProfilesFromFirebase()` (~line 139756) -- startup already uses Firestore via `loadFromFirebaseV2()`

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
- Routines/habits/goals saves -> `syncLifeAIToFirestore({ routines })` / `{ habits }` / `{ goals }`
- Life memory -> `syncLifeAIToFirestore({ memory })`
- Prompt/agent changes -> `syncLifeAIToFirestore({ mainSystemPrompt, coachPrompts, currentAgent })`

**Debouncing strategy:**
- 300ms debounce window
- Dirty fields accumulate during the window, flushed as a single `writeDB()` call
- Immediate flush on `beforeunload` (no debounce delay)

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

**Prompt sync audit -- add missing fields to Firestore sync:**
- `mainSystemPrompt` (custom override) -- currently `roweos_lifeai_main_prompt` in localStorage only
- `coachPrompts` (per-agent custom prompts) -- currently `roweos_life_coach_prompts` in localStorage only
- `currentAgent` (selected agent type) -- currently `roweos_life_agent` in localStorage only
- All three get added to `syncLifeAIToFirestore()` dirty field tracking
- All three get restored in `loadFromFirebaseV2()` cloud pull

---

## Files Modified

- `/Volumes/roweOS/RoweOS/dist/index.html` -- all changes (monolithic file)

## Key Functions Affected

| Function | Change |
|----------|--------|
| `syncLifeProfileToFirebase()` | **DELETE** |
| `syncLifeProfilesToFirebase()` | **DELETE** |
| `loadLifeProfilesFromFirebase()` | **DELETE** |
| `syncLifeAIToFirestore()` | **NEW** -- single sync entry point |
| `saveLifeProfiles()` | Route through new sync function |
| `addLifeAIInsight()` | Route through new sync function |
| `addLifeAIGoal()` | Route through new sync function |
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
