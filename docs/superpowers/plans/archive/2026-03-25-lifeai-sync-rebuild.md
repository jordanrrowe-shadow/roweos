# LifeAI Sync Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate LifeAI's dual-write data loss by consolidating all sync to Firestore, fixing broken features (Widget Builder, +Add to Rhythm), and renaming Tax Co-Pilot to Tax Intelligence.

**Architecture:** Replace all Firebase Realtime DB writes with a single debounced `syncLifeAIToFirestore()` function that wraps the existing `writeDB()`. Add write verification, beforeunload/visibilitychange guards, and index safety. Fix Widget Builder to use data-attributes instead of index-based card mapping.

**Tech Stack:** Vanilla JS (monolithic index.html), Firebase Firestore (via existing `writeDB()`), localStorage

**Spec:** `docs/superpowers/specs/2026-03-25-lifeai-sync-rebuild-design.md`

---

## File Map

All changes in a single file:
- **Modify:** `/Volumes/roweOS/RoweOS/dist/index.html`

Key regions:
| Region | Lines | Purpose |
|--------|-------|---------|
| writeDB | 62709-62746 | Core Firestore write-through |
| beforeunload | 76843-76846 | Page unload handler |
| addLifeAIInsight | 80883-80906 | Add insight to profile |
| addLifeAIGoal | 80911-80928 | Add goal to profile |
| saveLifeAIConversation | 80933-80975 | Save conversation history |
| buildLifeAISystemPromptForCategory | 80657-80855 | Agent prompt builder (taxcopilot at 80736) |
| confirmAddToRhythm | 115396-115421 | Add todo to Rhythm calendar |
| loadFromFirebaseV2 (lifeAI section) | 136000-136068 | Startup cloud pull |
| saveLifeProfiles | 139622-139645 | Profile array save + sync |
| getCurrentLifeProfile | 139648-139652 | Get active profile by index |
| deleteLifeProfile | 139689-139733 | Delete profile from array |
| syncLifeProfilesToFirebase | 139736-139753 | **DELETE** - Realtime DB multi-profile write |
| loadLifeProfilesFromFirebase | 139756-139796 | **DELETE** - Realtime DB multi-profile read |
| syncLifeProfileToFirebase | 142653-142670 | **DELETE** - Realtime DB single-profile write |
| loadLifeProfileFromFirebase | 142673-142719 | **DELETE** - Realtime DB single-profile read |
| saveLifeHabits | 154446-154448 | Habits save (localStorage only) |
| saveLifeGoals | 154450-154452 | Goals save (localStorage only) |
| saveLifeRoutines | 154454-154458 | Routines save (has writeDB call to remove) |
| applyRhythmWidgetLayout | 152845-152871 | Widget visibility/order |
| saveRhythmWidgetConfig | 152841-152843 | Widget config save (localStorage only) |
| resetRhythmWidgets | 152968-152974 | Widget config reset |
| renderLifeRhythm | 153179-153208 | Render Rhythm view |
| toggleLifeRhythmAddDropdown | 153511-153516 | +Add dropdown toggle |
| openLifeRhythmAddForm | 153521-153567 | +Add form modal |
| HTML: life-rhythm-card elements | 53388-53463 | Static card markup |
| Tax Copilot references | ~30 locations | See task 7 |

---

### Task 1: Create `syncLifeAIToFirestore()` -- the single sync entry point

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- insert new function near line 139620 (before `saveLifeProfiles`)

- [ ] **Step 1: Add the new sync function with debouncing and dirty tracking**

Insert before `saveLifeProfiles` (line 139622):

```javascript
/**
 * v26.4: Single sync entry point for all LifeAI data to Firestore
 * - Debounced at 300ms to coalesce rapid writes
 * - Tracks dirty fields, only syncs what changed
 * - Updates sync indicator based on write confirmation
 */
var _lifeAIDirtyFields = {};
var _lifeAIDebounceTimer = null;
var _lifeAIPendingWrites = 0;
var _lifeAILastLocalEdit = 0;

function syncLifeAIToFirestore(fields) {
  // Accumulate dirty fields
  Object.keys(fields).forEach(function(key) {
    _lifeAIDirtyFields[key] = fields[key];
  });
  _lifeAILastLocalEdit = Date.now();
  localStorage.setItem('roweos_lifeai_last_local_edit', String(_lifeAILastLocalEdit));

  // Show "saving" indicator (actual pending count tracked in flush)
  updateSyncIndicator('syncing');

  // Debounce: coalesce writes within 300ms
  if (_lifeAIDebounceTimer) clearTimeout(_lifeAIDebounceTimer);
  _lifeAIDebounceTimer = setTimeout(function() {
    _flushLifeAISync();
  }, 300);
}

function _flushLifeAISync() {
  if (_lifeAIDebounceTimer) {
    clearTimeout(_lifeAIDebounceTimer);
    _lifeAIDebounceTimer = null;
  }

  var fieldsToSync = _lifeAIDirtyFields;
  _lifeAIDirtyFields = {};

  if (Object.keys(fieldsToSync).length === 0) {
    if (_lifeAIPendingWrites === 0) updateSyncIndicator('connected');
    return;
  }

  // Increment ONCE per actual writeDB call (not per syncLifeAIToFirestore call)
  _lifeAIPendingWrites++;

  if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    writeDB('lifeAI/main', fieldsToSync, {
      onSuccess: function() {
        _lifeAIPendingWrites = Math.max(0, _lifeAIPendingWrites - 1);
        localStorage.setItem('roweos_lifeai_last_confirmed_sync', String(Date.now()));
        if (_lifeAIPendingWrites === 0) updateSyncIndicator('connected');
      },
      onError: function(err) {
        _lifeAIPendingWrites = Math.max(0, _lifeAIPendingWrites - 1);
        updateSyncIndicator('error');
        console.warn('[LifeAI Sync] Write failed, queueing retry:', err.message);
        // Retry: re-queue the failed fields
        _queuePendingWrite('lifeAI/main', fieldsToSync, {});
        showToast('Changes not saved -- retrying...', 'warning', 5000);
      }
    });
  } else {
    _lifeAIPendingWrites = Math.max(0, _lifeAIPendingWrites - 1);
    if (_lifeAIPendingWrites === 0) updateSyncIndicator('connected');
  }
}
```

- [ ] **Step 2: Add onSuccess/onError callback support to `writeDB`**

`writeDB` at lines 62709-62746 does NOT currently support callbacks. It has two `.then()/.catch()` chains (one for `merge: true` at line 62727, one for `merge: false` at line 62735) plus an outer `try/catch` at line 62743. All three need updating.

In the `merge: true` branch `.then()` (line 62727-62729), add after `updateSyncIndicator('connected')`:
```javascript
if (writeOpts.onSuccess) writeOpts.onSuccess();
```

In the `merge: true` branch `.catch()` (line 62730-62733), add after `updateSyncIndicator('error')`:
```javascript
if (writeOpts.onError) writeOpts.onError(err);
```

In the `merge: false` branch `.then()` (line ~62735), add the same `onSuccess` call.
In the `merge: false` branch `.catch()` (line ~62739), add the same `onError` call.

In the outer `catch` block (line 62743-62745), add:
```javascript
if (writeOpts.onError) writeOpts.onError(e);
```

- [ ] **Step 3: Add beforeunload and visibilitychange flush**

At line 76843, extend the existing `beforeunload` handler:

```javascript
window.addEventListener('beforeunload', function(e) {
  console.log('[AutoSave] Page unloading - force saving');
  autoSaveConversation(true);
  // v26.4: Flush pending LifeAI sync
  if (typeof _flushLifeAISync === 'function') _flushLifeAISync();
  // Warn if writes still pending
  if (_lifeAIPendingWrites > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});
```

Add a new `visibilitychange` listener right after (line ~76847):

```javascript
// v26.4: Flush LifeAI sync on visibility change (critical for iOS Safari)
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden' && typeof _flushLifeAISync === 'function') {
    _flushLifeAISync();
  }
});
```

- [ ] **Step 4: Verify the sync function works by testing in browser console**

Open roweOS, open browser console, run:
```javascript
syncLifeAIToFirestore({ _test: Date.now() });
```
Check that `[WriteDB] lifeAI/main synced` appears in console after 300ms.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(lifeai): add syncLifeAIToFirestore single sync entry point with debouncing"
```

---

### Task 2: Delete Realtime DB functions and wire `saveLifeProfiles` to new sync

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:139622-139645` (saveLifeProfiles)
- Delete: lines 139736-139753 (syncLifeProfilesToFirebase)
- Delete: lines 139756-139796 (loadLifeProfilesFromFirebase)
- Delete: lines 142653-142670 (syncLifeProfileToFirebase)
- Delete: lines 142673-142719 (loadLifeProfileFromFirebase)

- [ ] **Step 1: Rewrite `saveLifeProfiles` to use the new sync function**

Replace `saveLifeProfiles` (lines 139622-139645) with:

```javascript
function saveLifeProfiles(profiles) {
  localStorage.setItem('roweos_life_profiles', JSON.stringify(profiles));

  // Also update single profile for compatibility
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  if (profiles[currentIdx]) {
    localStorage.setItem('roweos_life_profile', JSON.stringify(profiles[currentIdx]));
    localStorage.setItem('roweos_user_name', profiles[currentIdx].name || 'My Life');
  }

  // v26.4: Single sync path to Firestore (replaces dual Realtime DB + Firestore writes)
  syncLifeAIToFirestore({
    profiles: profiles,
    currentProfileIdx: parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0'),
    userName: localStorage.getItem('roweos_user_name') || 'My Life',
    appMode: localStorage.getItem('roweos_app_mode') || 'brand'
  });
}
```

- [ ] **Step 2: Delete `syncLifeProfilesToFirebase` (lines 139736-139753)**

Remove the entire function.

- [ ] **Step 3: Delete `loadLifeProfilesFromFirebase` (lines 139756-139796)**

Remove the entire function.

- [ ] **Step 4: Delete `syncLifeProfileToFirebase` (lines 142653-142670)**

Remove the entire function.

- [ ] **Step 5: Delete `loadLifeProfileFromFirebase` (lines 142673-142719)**

Remove the entire function.

- [ ] **Step 6: Find and remove all call sites for deleted functions**

Search for:
- `syncLifeProfileToFirebase(` -- remove all calls (lines ~80901, 80923, 80971, 142467, 142645)
- `syncLifeProfilesToFirebase(` -- remove all calls (lines ~139633 in `saveLifeProfiles` and ~143891 in `handleIdentitySave()`)
- `loadLifeProfilesFromFirebase(` -- remove all calls
- `loadLifeProfileFromFirebase(` -- remove all calls

Replace each call site with the appropriate `syncLifeAIToFirestore()` call or remove if redundant (the calling function already routes through `saveLifeProfiles`). The call at ~143891 in `handleIdentitySave()` should be replaced with `saveLifeProfiles(profiles)` which routes through the new sync.

**Important:** Use string search, not line numbers, to find all call sites -- earlier edits may have shifted line numbers.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "refactor(lifeai): remove Realtime DB sync, route saveLifeProfiles through Firestore"
```

---

### Task 3: Wire remaining LifeAI mutations through new sync

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:80883-80906` (addLifeAIInsight)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:80911-80928` (addLifeAIGoal)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:80933-80975` (saveLifeAIConversation)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:154446-154448` (saveLifeHabits)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:154450-154452` (saveLifeGoals)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:154454-154458` (saveLifeRoutines)

- [ ] **Step 1: Refactor `addLifeAIInsight` to use profiles array directly**

Replace `addLifeAIInsight` (lines 80883-80906). The key change: use `getLifeProfiles()` / `saveLifeProfiles()` instead of the singular `getLifeAIProfile()` + manual patching:

```javascript
function addLifeAIInsight(insight) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  if (!profile) return;

  if (!profile.insights) profile.insights = [];
  profile.insights.unshift({ text: insight, timestamp: new Date().toISOString() });
  if (profile.insights.length > 50) profile.insights = profile.insights.slice(0, 50);
  profile.updatedAt = new Date().toISOString();

  profiles[currentIdx] = profile;
  saveLifeProfiles(profiles);
  console.log('[LifeAI] Insight saved:', insight);
}
```

- [ ] **Step 2: Refactor `addLifeAIGoal` to use profiles array directly**

Replace `addLifeAIGoal` (lines 80911-80928):

```javascript
function addLifeAIGoal(goal) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  if (!profile) return null;

  if (!profile.goals) profile.goals = [];
  var goalObj = { title: goal, createdAt: new Date().toISOString(), completed: false };
  profile.goals.push(goalObj);
  profile.updatedAt = new Date().toISOString();

  profiles[currentIdx] = profile;
  saveLifeProfiles(profiles);
  console.log('[LifeAI] Goal added:', goalObj.title);
  return goalObj;
}
```

- [ ] **Step 3: Refactor `saveLifeAIConversation` to use profiles array and new sync**

In `saveLifeAIConversation` (lines 80933-80975), replace all `syncLifeProfileToFirebase()` calls with routing through `saveLifeProfiles()`. The function should:
1. Read profiles via `getLifeProfiles()`
2. Update the current profile's `conversationHistory`
3. Call `saveLifeProfiles(profiles)` (which triggers `syncLifeAIToFirestore`)
4. Also sync `agentCommands` separately: `syncLifeAIToFirestore({ agentCommands: ... })`
5. Remove any direct `syncLifeProfileToFirebase()` calls

- [ ] **Step 4: Add Firestore sync to `saveLifeHabits`**

Replace lines 154446-154448:

```javascript
function saveLifeHabits() {
  localStorage.setItem('roweos_life_habits', JSON.stringify(lifeHabits));
  // v26.4: Sync habits to Firestore
  syncLifeAIToFirestore({ habits: lifeHabits });
}
```

- [ ] **Step 5: Add Firestore sync to `saveLifeGoals`**

Replace lines 154450-154452:

```javascript
function saveLifeGoals() {
  localStorage.setItem('roweos_life_goals', JSON.stringify(lifeGoals));
  // v26.4: Sync goals to Firestore
  syncLifeAIToFirestore({ goals: lifeGoals });
}
```

- [ ] **Step 6: Replace direct `writeDB` in `saveLifeRoutines` with new sync**

Replace lines 154454-154458:

```javascript
function saveLifeRoutines() {
  localStorage.setItem('roweos_life_routines', JSON.stringify(lifeRoutines));
  // v26.4: Route through single sync (replaces direct writeDB call)
  syncLifeAIToFirestore({ routines: lifeRoutines });
}
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(lifeai): wire all mutations through syncLifeAIToFirestore"
```

---

### Task 4: Delete reliability and profile index safety

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:139648-139652` (getCurrentLifeProfile)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:139689-139733` (deleteLifeProfile)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:136000-136068` (loadFromFirebaseV2 lifeAI section)

- [ ] **Step 1: Add index bounds validation to `getCurrentLifeProfile`**

Replace lines 139648-139652:

```javascript
function getCurrentLifeProfile() {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  // v26.4: Clamp index to valid range
  if (currentIdx < 0 || currentIdx >= profiles.length) {
    currentIdx = Math.max(0, profiles.length - 1);
    localStorage.setItem('roweos_current_life_profile_idx', String(currentIdx));
  }
  return profiles[currentIdx] || profiles[0] || null;
}
```

- [ ] **Step 2: Add soft-delete and write confirmation to `deleteLifeProfile`**

Replace `deleteLifeProfile` (lines 139689-139733). Key changes:
- Move deleted profile to `_deletedProfiles` array in Firestore
- Show pending toast until write confirms
- Restore on failure

```javascript
function deleteLifeProfile(idx) {
  var profiles = getLifeProfiles();
  if (profiles.length <= 1) {
    showToast('Cannot delete your only life profile', 'warning');
    return false;
  }

  var deleted = profiles.splice(idx, 1)[0];

  // v26.4: Soft-delete safety net
  deleted.deletedAt = new Date().toISOString();
  var deletedProfiles = [];
  try {
    deletedProfiles = JSON.parse(localStorage.getItem('roweos_life_deleted_profiles') || '[]');
  } catch(e) {}
  deletedProfiles.push(deleted);
  localStorage.setItem('roweos_life_deleted_profiles', JSON.stringify(deletedProfiles));

  // Adjust current index
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  if (currentIdx >= profiles.length) {
    setCurrentLifeProfileIndex(profiles.length - 1);
  } else if (currentIdx === idx) {
    setCurrentLifeProfileIndex(0);
  }

  // Save locally first (optimistic)
  saveLifeProfiles(profiles);

  // Sync deleted profiles to Firestore with confirmation
  var deletedName = deleted.name || 'Profile';
  showToast('Deleting "' + deletedName + '"...', 'info');

  if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    writeDB('lifeAI/main', {
      profiles: profiles,
      currentProfileIdx: parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0'),
      _deletedProfiles: deletedProfiles
    }, {
      onSuccess: function() {
        showToast('Deleted "' + deletedName + '"', 'success');
      },
      onError: function(err) {
        // Rollback: restore deleted profile
        console.warn('[LifeAI] Delete sync failed, rolling back:', err.message);
        profiles.splice(idx, 0, deleted);
        saveLifeProfiles(profiles);
        localStorage.setItem('roweos_life_deleted_profiles', JSON.stringify(deletedProfiles.filter(function(p) { return p !== deleted; })));
        showToast('Profile deletion failed -- please try again', 'error');
      }
    });
  }

  // Load surviving profile colors and logo
  var surviving = getCurrentLifeProfile();
  if (surviving) {
    if (surviving.accentDarkMode) localStorage.setItem('roweos_life_accent_dark_mode', surviving.accentDarkMode);
    if (surviving.accentLightMode) localStorage.setItem('roweos_life_accent_light_mode', surviving.accentLightMode);
    if (surviving.logo) localStorage.setItem('roweos_brand_logo', surviving.logo);
    applyAccentColor();
  }

  return true;
}
```

- [ ] **Step 3: Add index validation and new field restores to `loadFromFirebaseV2`**

In the lifeAI section (~line 136000-136068), after restoring profiles:

Add after line 136005 (`currentProfileIdx` restore):
```javascript
    // v26.4: Validate profile index bounds
    var restoredProfiles = life.profiles || [];
    var restoredIdx = life.currentProfileIdx || 0;
    if (restoredIdx < 0 || restoredIdx >= restoredProfiles.length) {
      restoredIdx = Math.max(0, restoredProfiles.length - 1);
      localStorage.setItem('roweos_current_life_profile_idx', String(restoredIdx));
    }
```

Add after line 136067 (`rhythmWidgetConfig` restore):
```javascript
    // v26.4: Restore prompt and agent settings
    if (life.coachPrompts) safeSyncWrite('roweos_life_coach_prompts', life.coachPrompts);
    if (life.currentAgent) {
      var agent = life.currentAgent;
      // v26.4: Tax Intelligence migration
      if (agent === 'taxcopilot') agent = 'taxintelligence';
      localStorage.setItem('roweos_life_agent', agent);
    }
    // v26.4: Clean up soft-deleted profiles older than 7 days
    if (life._deletedProfiles) {
      var cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      var kept = life._deletedProfiles.filter(function(p) {
        return p.deletedAt && new Date(p.deletedAt).getTime() > cutoff;
      });
      if (kept.length !== life._deletedProfiles.length) {
        syncLifeAIToFirestore({ _deletedProfiles: kept });
      }
      localStorage.setItem('roweos_life_deleted_profiles', JSON.stringify(kept));
    }
```

- [ ] **Step 4: Add stale data detection before cloud pull overwrites**

At the start of the lifeAI section in `loadFromFirebaseV2` (~line 136000), add:

```javascript
    // v26.4: Flush any pending debounced writes before cloud pull
    if (typeof _flushLifeAISync === 'function') _flushLifeAISync();

    // v26.4: Stale data detection
    var lastLocalEdit = parseInt(localStorage.getItem('roweos_lifeai_last_local_edit') || '0');
    var lastConfirmedSync = parseInt(localStorage.getItem('roweos_lifeai_last_confirmed_sync') || '0');
    if (lastLocalEdit > 0 && lastConfirmedSync > 0 && lastLocalEdit - lastConfirmedSync > 60000) {
      console.warn('[LifeAI Sync] Local edits newer than last confirmed sync by ' + Math.round((lastLocalEdit - lastConfirmedSync) / 1000) + 's -- potential data loss detected');
      showToast('Some recent changes may not have been saved. Check your data.', 'warning', 8000);
    }
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(lifeai): add delete confirmation, index safety, stale data detection"
```

---

### Task 5: Fix Widget Builder sync and pattern toggle

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:53388-53463` (HTML card markup)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:152841-152843` (saveRhythmWidgetConfig)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:152845-152871` (applyRhythmWidgetLayout)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:152968-152974` (resetRhythmWidgets)

- [ ] **Step 1: Add `data-widget-id` attributes to HTML card markup**

At line 53388, add attribute to first card:
```html
<div class="life-rhythm-card" data-widget-id="routine">
```

At line 53404:
```html
<div class="life-rhythm-card" data-widget-id="habits">
```

At line 53420:
```html
<div class="life-rhythm-card" data-widget-id="goals">
```

At line 53450:
```html
<div class="life-rhythm-card" data-widget-id="patterns">
```

At line 53436 (AI Goal Tasks card, currently has `id="rhythmLifeGoalTasksCard"`):
```html
<div class="life-rhythm-card" id="rhythmLifeGoalTasksCard" data-widget-id="goaltasks" style="display: none;">
```
**Note:** This card is not in the Widget Builder defaults. It's dynamically shown/hidden by AI. Adding the data-attribute ensures `applyRhythmWidgetLayout` won't break if it's ever added to the builder.

The `#rhythmSurveyWidgets` element already has an ID, but also add:
Search for `id="rhythmSurveyWidgets"` and add `data-widget-id="survey"` to the same element.

- [ ] **Step 2: Rewrite `applyRhythmWidgetLayout` to use data-attribute matching**

Replace lines 152845-152871:

```javascript
function applyRhythmWidgetLayout() {
  var config = getRhythmWidgetConfig();
  var panel = document.querySelector('.life-routine-panel');
  if (!panel) return;

  // v26.4: Use data-attribute matching instead of index-based (position-independent)
  var widgetMap = {};
  panel.querySelectorAll('[data-widget-id]').forEach(function(el) {
    widgetMap[el.dataset.widgetId] = el;
  });

  // Reorder and toggle visibility
  config.forEach(function(w) {
    var el = widgetMap[w.id];
    if (el) {
      el.style.display = w.visible ? '' : 'none';
      el.style.order = '';
      panel.appendChild(el);
    }
  });
}
```

- [ ] **Step 3: Add Firestore sync to `saveRhythmWidgetConfig`**

Replace lines 152841-152843:

```javascript
function saveRhythmWidgetConfig(config) {
  localStorage.setItem('roweos_rhythm_widget_config', JSON.stringify(config));
  // v26.4: Sync to Firestore
  syncLifeAIToFirestore({ rhythmWidgetConfig: config });
}
```

- [ ] **Step 4: Add Firestore sync to `resetRhythmWidgets`**

Replace lines 152968-152974:

```javascript
function resetRhythmWidgets() {
  localStorage.removeItem('roweos_rhythm_widget_config');
  // v26.4: Sync reset to Firestore
  syncLifeAIToFirestore({ rhythmWidgetConfig: rhythmWidgetDefaults.map(function(w) { return { id: w.id, visible: w.visible }; }) });
  var overlay = document.getElementById('rhythmWidgetBuilderOverlay');
  if (overlay) overlay.remove();
  renderLifeRhythm();
  showToast('Widgets reset to default', 'info');
}
```

- [ ] **Step 5: Test Widget Builder toggle persistence**

1. Open Rhythm view
2. Click Widgets button
3. Toggle "Patterns" OFF
4. Click Save
5. Verify Patterns card disappears
6. Reload page
7. Verify Patterns card is still hidden
8. Open Widget Builder again -- "Patterns" toggle should be OFF

- [ ] **Step 6: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix(lifeai): widget builder uses data-attributes, syncs config to Firestore"
```

---

### Task 6: Fix "+Add to Rhythm" button

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:153521-153567` (openLifeRhythmAddForm)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:153572-153621` (saveLifeRhythmAddForm)

**Key finding:** `saveLifeRhythmAddForm()` (line 153572) already calls `saveLifeRoutines()` and `saveLifeHabits()` correctly. Once Task 3 adds Firestore sync to those functions, routine and habit persistence is automatically fixed. The actual issues are:

1. Goals redirect to Pulse view (`if (type === 'goal') { addLifeGoal(); return; }` at line 153525) instead of adding inline
2. Tasks use `saveTodos()` which may not sync to Firestore for LifeAI

- [ ] **Step 1: Add inline goal creation to `saveLifeRhythmAddForm`**

In `saveLifeRhythmAddForm` (line 153572), after the `} else if (type === 'habit') {` block (line 153607-153616), add a goal handler:

```javascript
  } else if (type === 'goal') {
    lifeGoals.push({
      id: Date.now(),
      name: name,
      progress: 0,
      dueDate: null
    });
    saveLifeGoals();
    if (typeof renderLifeGoalsList === 'function') renderLifeGoalsList();
    showToast('Goal added!', 'success');
  }
```

- [ ] **Step 2: Update `openLifeRhythmAddForm` to allow inline goal creation**

At line 153525, replace:
```javascript
  if (type === 'goal') { addLifeGoal(); return; }
```
with:
```javascript
  // v26.4: Allow inline goal creation instead of redirecting to Pulse
```

Also add `'goal'` to the `typeLabels` object at line 153531:
```javascript
  var typeLabels = { routine: 'Routine Item', task: 'Task', habit: 'Habit', goal: 'Goal' };
```

- [ ] **Step 3: Ensure task saves sync to Firestore**

In `saveLifeRhythmAddForm`, the task branch (line 153594-153606) calls `saveTodos()`. Verify that `saveTodos()` calls `syncLifeAIToFirestore({ todos: todos })` or `writeDB`. If not, add:
```javascript
syncLifeAIToFirestore({ todos: todos });
```
after the `saveTodos()` call at line 153603.

- [ ] **Step 4: Test each "+Add" type**

1. Open Rhythm view
2. Click "+" button
3. Select "Routine" -> fill name -> confirm -> verify it appears in Today's Routine card
4. Select "Habit" -> fill name -> confirm -> verify it appears in Daily Habits card
5. Select "Goal" -> fill name -> confirm -> verify it appears in Active Goals card
6. Select "Task" -> fill name + date -> confirm -> verify it appears on calendar
7. Reload -> verify all four persist

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix(lifeai): +Add to Rhythm supports all types with Firestore sync"
```

---

### Task 7: Tax Co-Pilot -> Tax Intelligence rename

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- ~30 locations

**Important:** By this point, Tasks 1-6 have shifted line numbers significantly. Use string search (`taxcopilot`, `Tax Copilot`) to find all occurrences rather than relying on the line numbers below (which were accurate before earlier edits).

- [ ] **Step 1: Replace all UI-facing "Tax Copilot" / "Tax Co-Pilot" strings**

Find and replace all occurrences. Key locations (pre-edit line numbers for reference):

| Line | Current | Replacement |
|------|---------|-------------|
| 50221 | `Tax Copilot` | `Tax Intelligence` |
| 61439 | `id: 'taxcopilot', name: 'Tax Copilot'` | `id: 'taxintelligence', name: 'Tax Intelligence'` |
| 69009 | `{ name: 'Tax Copilot', value: 'taxcopilot' }` | `{ name: 'Tax Intelligence', value: 'taxintelligence' }` |
| 96406 | `<option value="taxcopilot">Tax Copilot</option>` | `<option value="taxintelligence">Tax Intelligence</option>` |
| 106508 | `{ name: 'Tax Copilot', id: 'taxcopilot' ...}` | `{ name: 'Tax Intelligence', id: 'taxintelligence' ...}` |
| 125342 | `{ id: 'taxcopilot', name: 'Tax Copilot' }` | `{ id: 'taxintelligence', name: 'Tax Intelligence' }` |
| 125419 | `'taxcopilot': 'Tax Copilot'` | `'taxintelligence': 'Tax Intelligence'` |
| 140574 | `id: 'taxcopilot', name: 'Tax Copilot'` | `id: 'taxintelligence', name: 'Tax Intelligence'` |
| 140664-140665 | `id: 'taxcopilot'` / `name: 'Tax Copilot'` | `id: 'taxintelligence'` / `name: 'Tax Intelligence'` |
| 141347 | `taxcopilot: 'Tax Copilot'` | `taxintelligence: 'Tax Intelligence'` |
| 143532 | `Tax preparation with Tax Copilot` | `Tax preparation with Tax Intelligence` |
| 147232 | `{ id: 'taxcopilot', name: 'Tax Copilot' ...}` | `{ id: 'taxintelligence', name: 'Tax Intelligence' ...}` |

- [ ] **Step 2: Replace all code-facing `taxcopilot` identifiers**

| Line | Current | Replacement |
|------|---------|-------------|
| 64365-64377 | `agent: 'taxcopilot'` | `agent: 'taxintelligence'` |
| 64793 | `taxcopilot: '#fbbf24'` | `taxintelligence: '#fbbf24'` |
| 80640 | `'taxes': 'taxcopilot'` | `'taxes': 'taxintelligence'` |
| 80736 | `if (agentType === 'taxcopilot')` | `if (agentType === 'taxintelligence')` |
| 111363 | `taxcopilot: 'taxes'` | `taxintelligence: 'taxes'` |
| 111520 | `taxcopilot: 'taxes'` | `taxintelligence: 'taxes'` |
| 141246 | `@param coachId - personal, coach, wellness, taxcopilot` | `@param coachId - personal, coach, wellness, taxintelligence` |
| 141293 | `taxcopilot: ['tax', 'work', 'personal']` | `taxintelligence: ['tax', 'work', 'personal']` |
| 141325 | `if (coachId === 'taxcopilot'` | `if (coachId === 'taxintelligence'` |
| 141361 | `coachesThatUseBrandData = ['taxcopilot', ...]` | `coachesThatUseBrandData = ['taxintelligence', ...]` |
| 141370 | `if (coachId === 'taxcopilot')` | `if (coachId === 'taxintelligence')` |
| 147333 | `if (coachId === 'taxcopilot')` | `if (coachId === 'taxintelligence')` |

- [ ] **Step 3: Update the system prompt text**

At line 80737, update the prompt text:
```
"You are Tax Outcome Copilot for ${userName}"
```
to:
```
"You are Tax Intelligence for ${userName}. Your only goal is to maximize ${userName}'s legal tax outcome while staying fully compliant."
```

- [ ] **Step 4: Update description text in onboarding/settings**

Line 139415: Replace "Tax Copilot" references in the settings description text.
Line 140703, 140707: Replace "Tax Copilot" in the brand-sharing tip text.

- [ ] **Step 5: Add startup migration for localStorage**

Add near the startup/init section:

```javascript
// v26.4: Migrate taxcopilot -> taxintelligence in localStorage
(function() {
  var agent = localStorage.getItem('roweos_life_agent');
  if (agent === 'taxcopilot') {
    localStorage.setItem('roweos_life_agent', 'taxintelligence');
  }
  // Also migrate in coach prompts if stored
  try {
    var prompts = JSON.parse(localStorage.getItem('roweos_life_coach_prompts') || '{}');
    if (prompts.taxcopilot) {
      prompts.taxintelligence = prompts.taxcopilot;
      delete prompts.taxcopilot;
      localStorage.setItem('roweos_life_coach_prompts', JSON.stringify(prompts));
    }
  } catch(e) {}
})();
```

- [ ] **Step 6: Verify no remaining references**

Search for `taxcopilot`, `Tax Copilot`, `Tax Co-Pilot`, `tax copilot` -- should find zero results.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(lifeai): rename Tax Co-Pilot to Tax Intelligence everywhere"
```

---

### Task 8: Prompt sync audit -- add missing fields to Firestore

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- prompt save locations and `loadFromFirebaseV2`

- [ ] **Step 1: Resolve dual localStorage key for main prompt**

Find all reads/writes to `roweos_lifeai_main_prompt` and `roweos_life_main_prompt`. Canonicalize on `roweos_life_main_prompt`.

Add startup migration:
```javascript
// v26.4: Migrate prompt key to canonical
(function() {
  var alt = localStorage.getItem('roweos_lifeai_main_prompt');
  var canonical = localStorage.getItem('roweos_life_main_prompt');
  if (alt && !canonical) {
    localStorage.setItem('roweos_life_main_prompt', alt);
  }
  if (alt) localStorage.removeItem('roweos_lifeai_main_prompt');
})();
```

Update all references to `roweos_lifeai_main_prompt` to use `roweos_life_main_prompt` instead.

- [ ] **Step 2: Add Firestore sync for prompt/agent changes**

Find where `roweos_life_coach_prompts` is written to localStorage (guardrails/settings UI, lines ~147284 and ~147309). After each write, add:
```javascript
syncLifeAIToFirestore({ coachPrompts: prompts });
```

Find where `roweos_life_agent` is written (agent selection, lines ~69023, ~125265, ~125413). After each write, add:
```javascript
syncLifeAIToFirestore({ currentAgent: agentId });
```

Find where `roweos_life_main_prompt` is written (main prompt editor). After each write, add:
```javascript
syncLifeAIToFirestore({ mainSystemPrompt: prompt });
```

- [ ] **Step 3: Verify `loadFromFirebaseV2` restores all fields**

Confirm that the lifeAI section in `loadFromFirebaseV2` now restores:
- `profiles` (existing)
- `currentProfileIdx` (existing)
- `userName` (existing)
- `appMode` (existing)
- `mainSystemPrompt` (existing)
- `goals`, `routines`, `habits` (existing)
- `agentCommands` (existing)
- `todos` (existing)
- `memory` (existing)
- `rhythmPreferences` (existing)
- `rhythmWidgetConfig` (existing)
- `coachPrompts` (added in Task 4)
- `currentAgent` (added in Task 4)
- `_deletedProfiles` (added in Task 4)

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(lifeai): sync prompts and agent selection to Firestore, canonicalize prompt key"
```

---

### Task 9: Final verification and deploy

- [ ] **Step 1: Full manual test pass**

Run through the testing checklist from the spec:
1. Create a new LifeAI profile, reload -- profile persists
2. Edit goals/habits/routines, reload -- changes persist
3. Have a conversation with an agent, reload -- conversation history persists
4. Delete a profile, reload -- profile stays deleted
5. Toggle widgets off in Widget Builder, reload -- toggles persist
6. Add item via "+Add to Rhythm" -- item appears and persists on reload
7. Rapid edits (color changes) -- check console for write flood (should see single writeDB per 300ms window)
8. Sync indicator shows amber while saving, green on confirm
9. Tax Intelligence appears everywhere Tax Co-Pilot was
10. Switch to brand mode, verify brand operations still work (regression)

- [ ] **Step 2: Check for console errors**

Open browser console, navigate through all LifeAI views (Studio, Rhythm, Focus, Pulse), check for any errors related to undefined functions (deleted Realtime DB functions being called).

- [ ] **Step 3: Test iOS Safari if available**

Open on iPhone, make edits, switch to another app (triggers visibilitychange), come back, reload -- data should persist.

- [ ] **Step 4: Deploy**

```bash
cd /Volumes/roweOS/RoweOS/dist && vercel --prod
```

- [ ] **Step 5: Final commit with version bump**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "v26.4: LifeAI sync rebuild -- eliminate data loss, fix widget builder, +Add to Rhythm, Tax Intelligence rename"
```
