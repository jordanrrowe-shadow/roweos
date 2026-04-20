# Pulse Goals Per-Document Sync - Implementation Plan

**Goal:** Migrate Pulse goals from a single Firestore document (`pulse/main.goals`) to per-goal documents (`pulse/goals/{goal_id}`), eliminating last-writer-wins data loss on concurrent multi-device edits.

**Architecture:** ES5 vanilla JS, Firebase Firestore, localStorage write-through. No bundler, no framework, no test runner.

**Tech Stack:** Firestore subcollection per goal, dirty-tracking object for write optimization, collection-level `onSnapshot` listener, one-time migration with fallback reads.

---

## File Structure

All changes are in `src/js/core/` (edits only, no new files):

| File | What Changes |
|------|-------------|
| `25-documents-lifeai.js` | `savePulseGoals()` rewrite, `markGoalDirty()` helper, dirty calls in all 17 modifier functions, `deleteGoal()` Firestore doc delete, migration function |
| `22-firebase-sync.js` | `onSnapshot` listener (single-doc to collection), `loadFromFirebaseV2()` pulse section (collection read + fallback), push path in `syncToFirebaseV2` |
| `29-analytics-commerce.js` | `renderSyncInventory()` cloud count for Pulse Goals (collection size instead of array length) |
| `09-state.js` | `writeDB()` v4 dual-write map entry for `pulse/goals/*` (if v4 active) |

---

## Task 1: Add Dirty-Goal Tracking and Rewrite `savePulseGoals()`

**Files:** `src/js/core/25-documents-lifeai.js`

### Step 1.1: Add dirty-tracking global and helper

Insert immediately before `savePulseGoals()` (before line 7397):

```javascript
// v30.0: Dirty-goal tracking for per-doc sync
// Only goals whose IDs are in this object get written to Firestore on save.
// Reset after each savePulseGoals() call.
var _dirtyPulseGoalIds = {};

function markGoalDirty(goalId) {
  if (goalId) _dirtyPulseGoalIds[goalId] = true;
}
```

### Step 1.2: Rewrite `savePulseGoals()`

Replace the entire `savePulseGoals()` function body (lines 7397-7439):

```javascript
function savePulseGoals() {
  // v30.0: Per-goal document sync (replaces single-array pulse/main write)
  // Backfill id and _modifiedAt for merge support
  var now = Date.now();
  pulseGoals.forEach(function(g) {
    if (!g.id) {
      g.id = 'goal_' + now + '_' + Math.random().toString(36).substr(2, 6);
      markGoalDirty(g.id);
    }
    if (!g._modifiedAt) g._modifiedAt = now;
    // v28.8: Backfill new goal-level fields
    if (typeof g.isDefault === 'undefined') g.isDefault = false;
    if (typeof g.color === 'undefined') g.color = null;
    if (typeof g.icon === 'undefined') g.icon = null;
    if (typeof g.brandIdx === 'undefined') g.brandIdx = null;
    // v28.8: Backfill new item-level fields on flat items
    if (g.items && Array.isArray(g.items)) {
      g.items.forEach(function(item) {
        if (typeof item.date === 'undefined') item.date = null;
        if (typeof item.assignedTo === 'undefined') item.assignedTo = null;
        if (typeof item.notes === 'undefined') item.notes = null;
        if (typeof item.priority === 'undefined') item.priority = null;
        if (!item.createdAt) item.createdAt = new Date(now).toISOString();
        if (!item._modifiedAt) item._modifiedAt = now;
      });
    }
    // v28.8: Backfill new item-level fields on section items
    if (g.sections && Array.isArray(g.sections)) {
      g.sections.forEach(function(sec) {
        if (sec.items && Array.isArray(sec.items)) {
          sec.items.forEach(function(item) {
            if (typeof item.date === 'undefined') item.date = null;
            if (typeof item.assignedTo === 'undefined') item.assignedTo = null;
            if (typeof item.notes === 'undefined') item.notes = null;
            if (typeof item.priority === 'undefined') item.priority = null;
            if (!item.createdAt) item.createdAt = new Date(now).toISOString();
            if (!item._modifiedAt) item._modifiedAt = now;
          });
        }
      });
    }
  });

  // v25.1: Write-through -- localStorage always gets full array
  localStorage.setItem('roweos_pulse_goals', JSON.stringify(pulseGoals));

  // v30.0: Per-goal Firestore writes (dirty-only optimization)
  var dirtyIds = Object.keys(_dirtyPulseGoalIds);
  if (dirtyIds.length === 0) {
    // No specific dirty goals -- write all (happens on migration, first load, etc.)
    pulseGoals.forEach(function(goal) {
      if (goal.id) {
        writeDBDoc('pulse/goals', goal.id, goal, 'goals');
      }
    });
  } else {
    // Only write the goals that changed
    dirtyIds.forEach(function(id) {
      var goal = null;
      for (var i = 0; i < pulseGoals.length; i++) {
        if (pulseGoals[i].id === id) { goal = pulseGoals[i]; break; }
      }
      if (goal) {
        writeDBDoc('pulse/goals', goal.id, goal, 'goals');
      }
    });
  }
  _dirtyPulseGoalIds = {};
}
```

**Key decisions:**
- Uses `writeDBDoc('pulse/goals', goal.id, goal, 'goals')` instead of `writeDB('pulse/goals/' + goal.id, ...)`. This routes through the subcollection write path (which uses `merge: true`), matching the brand/automation pattern.
- When `_dirtyPulseGoalIds` is empty, writes ALL goals. This covers migration, first load, and any caller that forgot to dirty-mark.
- Clears dirty set after every save.

### Step 1.3: Verify

1. Open browser console, set a breakpoint on the new `savePulseGoals()`
2. Create a goal, confirm only 1 `writeDBDoc` call fires (the new goal)
3. Check Firebase Console: `roweos_users/{uid}/pulse/goals/{goal_id}` document exists with full goal data
4. localStorage `roweos_pulse_goals` still contains the full array

### Commit point: "v30.0: Per-goal Firestore writes in savePulseGoals with dirty tracking"

---

## Task 2: Add `markGoalDirty()` Calls to All 17 Modifier Functions

**Files:** `src/js/core/25-documents-lifeai.js`

Every function that mutates a goal and calls `savePulseGoals()` must call `markGoalDirty(goalId)` BEFORE `savePulseGoals()`. Here is the complete list with exact insertion points:

### Step 2.1: `addItemToPulseGoal` (line ~7474)

Add `markGoalDirty(goal.id);` before `savePulseGoals();` on line ~7497:

```javascript
  goal.items.push(item);
  goal._modifiedAt = now;
  markGoalDirty(goal.id);
  savePulseGoals();
```

### Step 2.2: `removeItemFromPulseGoal` (line ~7502)

Add after the item removal logic, before `savePulseGoals()` (the function currently has `savePulseGoals()` after the section filtering). Insert `markGoalDirty(goalId);` immediately before the `savePulseGoals()` call at the end of the function:

```javascript
  goal._modifiedAt = Date.now();
  markGoalDirty(goalId);
  savePulseGoals();
```

### Step 2.3: `toggleGoalCollapse` (line ~8769)

```javascript
function toggleGoalCollapse(goalId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;
  goal.collapsed = !goal.collapsed;
  markGoalDirty(goalId);
  savePulseGoals();
  var card = document.querySelector('.pulse-3-checklist-card[data-goal-id="' + goalId + '"]');
  if (card) card.classList.toggle('collapsed', goal.collapsed);
}
```

### Step 2.4: `togglePulseChecklistItem` (line ~8781)

Add `markGoalDirty(goalId);` before the `savePulseGoals()` call within the function:

```javascript
  goal._modifiedAt = Date.now();
  markGoalDirty(goalId);
  savePulseGoals();
```

### Step 2.5: `createNewGoal` (line ~9563)

New goals need their ID dirty-marked after being pushed:

```javascript
  pulseGoals.unshift(newGoal);
  markGoalDirty(newGoal.id);
  savePulseGoals();
```

### Step 2.6: `createGoalFromAI` (line ~9414)

Same pattern -- after the new goal object is created and pushed:

```javascript
  pulseGoals.unshift(newGoal);
  markGoalDirty(newGoal.id);
  savePulseGoals();
```

### Step 2.7: `setGoalDueDate` (line ~9632)

Inside the `change` event listener:

```javascript
  input.addEventListener('change', function() {
    goal.dueDate = input.value || null;
    goal._modifiedAt = Date.now();
    markGoalDirty(goalId);
    savePulseGoals();
    renderPulse3Checklists();
    showToast(input.value ? 'Due date set' : 'Due date removed', 'success');
  });
```

### Step 2.8: `deleteGoal` (line ~9662)

Special case -- the goal is REMOVED from the array. It needs a Firestore doc delete, NOT a write. See Task 3 for the full change.

### Step 2.9: `deleteGoalItem` (line ~9676)

```javascript
  goal._modifiedAt = Date.now();
  markGoalDirty(goalId);
  savePulseGoals();
```

### Step 2.10: `addItemToGoal` (line ~9727)

Inside the `submitItem` function that handles the inline input:

```javascript
  goal._modifiedAt = Date.now();
  markGoalDirty(goalId);
  savePulseGoals();
```

### Step 2.11: `saveInlineGoal` (line ~10086, called from `createInlineGoal`)

New goal being created:

```javascript
  pulseGoals.unshift(newGoal);
  markGoalDirty(newGoal.id);
  savePulseGoals();
```

### Step 2.12: `createPulseGoalFromAutomation` (line ~10136)

```javascript
  pulseGoals.unshift(newGoal);
  markGoalDirty(newGoal.id);
  savePulseGoals();
```

### Step 2.13: `addPendingPulseGoal` (line ~10240)

This calls `createPulseGoalFromAutomation()` which already marks dirty (from 2.12). No additional change needed.

### Step 2.14: `editGoal` (line ~10567)

```javascript
  if (newTitle && newTitle.trim()) {
    goal.title = newTitle.trim();
    goal._modifiedAt = Date.now();
    markGoalDirty(goalId);
    savePulseGoals();
    renderPulse3Checklists();
  }
```

### Step 2.15: `editGoalTitleInline` (line ~10400)

Inside the `save()` closure:

```javascript
  function save() {
    el.contentEditable = 'false';
    var newTitle = el.textContent.trim();
    if (newTitle && newTitle !== goal.title) {
      goal.title = newTitle;
      goal._modifiedAt = Date.now();
      markGoalDirty(goalId);
      savePulseGoals();
    } else {
      el.textContent = goal.title;
    }
    el.removeEventListener('blur', save);
    el.removeEventListener('keydown', handleKey);
  }
```

### Step 2.16: `completeGoal` (line ~10582)

```javascript
  goal.completed = true;
  goal.completedAt = new Date().toISOString();
  goal._modifiedAt = Date.now();
  markGoalDirty(goalId);
  savePulseGoals();
```

### Step 2.17: `importChecklistFromChat` (line ~10599)

This creates a new goal. Add dirty mark after push:

```javascript
  pulseGoals.unshift(newGoal);
  markGoalDirty(newGoal.id);
  savePulseGoals();
```

### Step 2.18: `editTaskInline` (line ~10437)

Inside the `save()` closure:

```javascript
  function save() {
    el.contentEditable = 'false';
    var newText = el.textContent.trim();
    if (newText && newText !== item.text) {
      item.text = newText;
      goal._modifiedAt = Date.now();
      markGoalDirty(goalId);
      savePulseGoals();
    } else {
      el.textContent = item.text;
    }
    el.removeEventListener('blur', save);
    el.removeEventListener('keydown', handleKey);
  }
```

### Step 2.19: `getUnassignedGoal` (line ~7442)

This also calls `savePulseGoals()` when creating a new default goal:

```javascript
  pulseGoals.push(goal);
  markGoalDirty(goal.id);
  savePulseGoals();
  return goal;
```

### Verify

1. Edit a task title inline -- check Firebase Console, only that goal's doc should have a new `_modifiedAt`
2. Toggle a checkbox -- same check
3. Create a goal via Quick Goal -- new doc appears in `pulse/goals/` collection
4. Monitor browser console for `[WriteDB] pulse/goals/{id} synced` messages -- should see exactly 1 per action

### Commit point: "v30.0: Add markGoalDirty() calls to all 19 goal modifier functions"

---

## Task 3: Fix `deleteGoal()` to Delete Firestore Document

**Files:** `src/js/core/25-documents-lifeai.js`

### Step 3.1: Rewrite `deleteGoal()`

Replace the current `deleteGoal` function (line ~9662):

```javascript
function deleteGoal(goalId) {
  if (!confirm('Delete this goal? This cannot be undone.')) return;

  // v30.0: Delete the per-goal Firestore document immediately
  // Must happen BEFORE savePulseGoals to prevent onSnapshot resurrection
  if (typeof deleteDBDoc === 'function') {
    deleteDBDoc('pulse/goals', goalId, 'goals');
  }

  // v25.1: Write-through delete -- remove from array, save immediately
  pulseGoals = pulseGoals.filter(function(g) { return g.id !== goalId; });
  // Don't mark dirty -- the goal is gone. savePulseGoals will write localStorage
  // and won't re-write this goal because it's no longer in the array.
  savePulseGoals();
  renderPulse3Overview();
  renderPulse3Checklists();
  showToast('Goal deleted', 'success');
}
```

**Key decision:** `deleteDBDoc` fires BEFORE `savePulseGoals()`, matching the pattern used by `deleteBrand()` (v28.3 lesson: delete Firestore doc immediately to prevent onSnapshot resurrection).

### Verify

1. Create a goal, confirm it appears in Firebase Console under `pulse/goals/{id}`
2. Delete the goal, confirm the Firestore document is gone within seconds
3. On a second device, confirm the goal disappears via real-time listener (Task 5)
4. Refresh the page -- goal should NOT reappear

### Commit point: "v30.0: deleteGoal() deletes per-goal Firestore doc immediately"

---

## Task 4: Rewrite `onSnapshot` Listener for Collection

**Files:** `src/js/core/22-firebase-sync.js`

### Step 4.1: Replace single-doc pulse listener with collection listener

Replace the entire pulse onSnapshot block (lines 2630-2663):

```javascript
    // v30.0: Pulse goals real-time listener -- per-goal collection
    var unsubPulseGoals = db.collection(basePath + '/pulse/goals').onSnapshot(function(snapshot) {
      if (snapshot.metadata.hasPendingWrites) return;
      if (!shouldSyncCategory('goals')) return;

      var _cloudGoals = [];
      snapshot.forEach(function(doc) {
        var goalData = doc.data();
        if (goalData && goalData.id) _cloudGoals.push(goalData);
      });

      var _localGoals = [];
      try { _localGoals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]'); } catch(e) {}
      if (!Array.isArray(_localGoals)) _localGoals = [];

      // v30.0: Per-goal merge -- cloud goals replace matching local goals by ID,
      // local-only goals (not in cloud) are kept, cloud-only goals are added.
      // Uses mergeByTimestamp for conflict resolution on same-ID goals.
      var _mergedGoals = mergeByTimestamp(_localGoals, _cloudGoals, 'id');

      // v30.0: Handle deletions -- goals in local but NOT in cloud snapshot
      // are deleted on cloud. Remove them locally.
      var _cloudIdSet = {};
      _cloudGoals.forEach(function(g) { if (g.id) _cloudIdSet[g.id] = true; });
      _mergedGoals = _mergedGoals.filter(function(g) {
        // Keep if it exists in cloud, OR if it was just created locally
        // (has _modifiedAt within last 10 seconds -- grace period for write propagation)
        if (_cloudIdSet[g.id]) return true;
        var age = Date.now() - (g._modifiedAt || 0);
        return age < 10000; // 10s grace period for local-only goals
      });

      localStorage.setItem('roweos_pulse_goals', JSON.stringify(_mergedGoals));
      if (typeof pulseGoals !== 'undefined') pulseGoals = _mergedGoals;
      if (typeof renderPulseGoals === 'function') renderPulseGoals();
      if (typeof renderPulse3Overview === 'function') renderPulse3Overview();
      if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
      console.log('[Firebase V3.1] Pulse goals real-time update:', _cloudGoals.length, 'cloud goals');
    }, function(err) {
      console.warn('[Firebase] Pulse goals listener error:', err.message);
    });
    firebaseUnsubscribers.push(unsubPulseGoals);

    // v30.0: Pulse non-goals real-time listener -- keep pulse/main for journal, insights, entries, reminders
    var unsubPulseMain = db.doc(basePath + '/pulse/main').onSnapshot(function(doc) {
      if (doc.metadata.hasPendingWrites) return;
      if (!doc.exists) {
        // v25.2: Document deleted from cloud -- clear non-goal pulse data
        localStorage.setItem('roweos_pulse_journal', '[]');
        localStorage.setItem('roweos_pulse2_entries', '[]');
        localStorage.setItem('roweos_reminders', '[]');
        return;
      }
      var pulse = doc.data();
      // Keep safeSyncWrite for non-per-item data (cloud-authoritative)
      if (pulse.journal !== undefined) safeSyncWrite('roweos_pulse_journal', pulse.journal);
      if (pulse.entries !== undefined) safeSyncWrite('roweos_pulse2_entries', pulse.entries);
      if (pulse.reminders !== undefined) safeSyncWrite('roweos_reminders', pulse.reminders);
      console.log('[Firebase V3.1] Pulse main real-time update (non-goals)');
    }, function() {});
    firebaseUnsubscribers.push(unsubPulseMain);
```

**Key decisions:**
- Split into TWO listeners: collection listener for goals, single-doc listener for journal/insights/entries/reminders on `pulse/main`.
- The collection listener handles deletion detection: if a goal is in local but not in the cloud snapshot, it was deleted on another device. A 10-second grace period prevents deleting goals that were just created locally but haven't propagated yet.
- `mergeByTimestamp` still resolves same-ID conflicts by `_modifiedAt` (newer wins).

### Verify

1. Open RoweOS on two devices/tabs
2. Create a goal on device A -- device B should see it appear within seconds
3. Edit a task on device A -- device B should see the updated text
4. Delete a goal on device A -- device B should see it disappear
5. Create goals simultaneously on both devices -- both should appear on both, no data loss

### Commit point: "v30.0: Split pulse onSnapshot into collection (goals) + doc (non-goals) listeners"

---

## Task 5: Rewrite `loadFromFirebaseV2()` Pulse Section

**Files:** `src/js/core/22-firebase-sync.js`

### Step 5.1: Add collection read to Promise.all

In the `Promise.all` array (line ~8540), the current entry at index 7 is:

```javascript
db.doc(basePath + '/pulse/main').get(),
```

Replace it with the collection read:

```javascript
db.collection(basePath + '/pulse/goals').get(),
```

**Important:** `pulse/main` is still needed for journal/insights/entries/reminders. It was already being read for those. We need to add a SEPARATE read for pulse/main. Add it at the END of the Promise.all array to avoid shifting indices:

```javascript
db.doc(basePath + '/pulse/main').get(),  // v30.0: Moved to end for non-goal pulse data
```

Note the new index. Count the existing entries to determine the correct index. Currently the Promise.all has entries at indices 0-33 (approximately). The new `pulse/main` read will be at the end.

### Step 5.2: Replace the pulse goals processing section

Replace lines 9234-9259 (the `if (pulseDoc.exists)` block):

```javascript
    // v30.0: Pulse goals -- per-goal collection read (index 7 is now collection snapshot)
    var pulseGoalsSnap = results[7]; // Was pulse/main doc, now pulse/goals collection
    var _cloudGoals3 = [];
    if (pulseGoalsSnap && !pulseGoalsSnap.empty) {
      pulseGoalsSnap.forEach(function(doc) {
        var gd = doc.data();
        if (gd && gd.id) _cloudGoals3.push(gd);
      });
    }

    // v30.0: Fallback to legacy pulse/main if no per-goal docs exist
    // This handles the first load before migration runs
    if (_cloudGoals3.length === 0) {
      // Find the pulse/main doc (added at end of Promise.all)
      var _pulseMainFallback = results[results.length - 1]; // pulse/main at end
      if (_pulseMainFallback && _pulseMainFallback.exists) {
        var _legacyPulse = _pulseMainFallback.data();
        var _legacyGoals = _legacyPulse.goals;
        if (_legacyGoals === undefined && _legacyPulse.data !== undefined) _legacyGoals = _legacyPulse.data;
        if (typeof _legacyGoals === 'string') { try { _legacyGoals = JSON.parse(_legacyGoals); } catch(e) { _legacyGoals = undefined; } }
        if (_legacyGoals !== undefined && Array.isArray(_legacyGoals)) {
          _cloudGoals3 = _legacyGoals;
        }
      }
    }

    if (_cloudGoals3.length > 0) {
      var _localGoals3 = [];
      try {
        var _lgRaw3 = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
        _localGoals3 = Array.isArray(_lgRaw3) ? _lgRaw3 : (Array.isArray(_lgRaw3.data) ? _lgRaw3.data : []);
      } catch(e) {}
      var _mergedGoals3 = mergeByTimestamp(_localGoals3, _cloudGoals3, 'id');
      localStorage.setItem('roweos_pulse_goals', JSON.stringify(_mergedGoals3));
      if (typeof pulseGoals !== 'undefined') pulseGoals = _mergedGoals3;
    }

    // v30.0: Pulse non-goal data still from pulse/main
    var _pulseMainDoc = results[results.length - 1];
    if (_pulseMainDoc && _pulseMainDoc.exists) {
      var _pmData = _pulseMainDoc.data();
      if (_pmData.journal !== undefined) safeSyncWrite('roweos_pulse_journal', _pmData.journal);
      if (_pmData.insights !== undefined) safeSyncWrite('roweos_pulse_insights', _pmData.insights);
      if (_pmData.entries !== undefined) safeSyncWrite('roweos_pulse2_entries', _pmData.entries);
      if (_pmData.reminders !== undefined) safeSyncWrite('roweos_reminders', _pmData.reminders);
    }
```

### Step 5.3: Verify

1. Sign out and back in (triggers `loadFromFirebaseV2`)
2. All existing goals should load correctly (fallback to pulse/main if migration hasn't run)
3. After migration (Task 7), goals load from `pulse/goals` collection
4. Journal, insights, entries, reminders still load from `pulse/main`

### Commit point: "v30.0: loadFromFirebaseV2 reads pulse goals from per-goal collection with legacy fallback"

---

## Task 6: Update Push Path in `syncToFirebaseV2`

**Files:** `src/js/core/22-firebase-sync.js`

### Step 6.1: Replace single-doc pulse write with per-goal writes

Replace the pulse section (lines 8097-8106):

```javascript
  // v30.0: Pulse -- per-goal document writes (replaces single-array push)
  if (shouldSyncCategory('goals')) {
    var _pushGoals = sp('roweos_pulse_goals', []);
    if (Array.isArray(_pushGoals)) {
      _pushGoals.forEach(function(goal) {
        if (goal && goal.id) {
          writes.push(db.doc(basePath + '/pulse/goals/' + goal.id).set(goal, { merge: true }));
        }
      });
    }
  }
  // v30.0: Non-goal pulse data still goes to pulse/main
  writes.push(db.doc(basePath + '/pulse/main').set({
    deletedGoals: sp('roweos_deleted_pulse_goals', []),
    journal: sp('roweos_pulse_journal', []),
    insights: sp('roweos_pulse_insights', []),
    entries: sp('roweos_pulse2_entries', []),
    reminders: sp('roweos_reminders', [])
  }));
```

**Key decision:** The `goals` field is no longer written to `pulse/main`. Only journal/insights/entries/reminders remain there. The `deletedGoals` field is kept for legacy tracking but is no longer the primary deletion mechanism (per-doc `deleteDBDoc` handles that now).

### Verify

1. Trigger a manual push (Settings > Sync Hub > Push)
2. Check Firebase Console: each goal has its own doc in `pulse/goals/`
3. `pulse/main` no longer has a `goals` field (only journal, insights, entries, reminders)

### Commit point: "v30.0: syncToFirebaseV2 push writes per-goal docs instead of single array"

---

## Task 7: One-Time Migration

**Files:** `src/js/core/25-documents-lifeai.js`

### Step 7.1: Add migration function

Insert after `savePulseGoals()` (after the closing brace):

```javascript
/**
 * v30.0: One-time migration from pulse/main.goals array to per-goal documents.
 * Runs on first load after upgrade. Reads goals from both localStorage and
 * pulse/main cloud doc, merges, then writes each goal to its own Firestore doc.
 * Keeps pulse/main intact for 30-day fallback period.
 */
function migratePulseGoalsToPerDoc() {
  if (localStorage.getItem('roweos_pulse_goals_v2_migrated') === 'true') return;
  if (!firebaseUser) return;

  var db = getDB();
  if (!db) return;

  var basePath = 'roweos_users/' + firebaseUser.uid;

  // Read current goals from localStorage
  var localGoals = [];
  try {
    var raw = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    localGoals = Array.isArray(raw) ? raw : [];
  } catch(e) {}

  // Read from cloud pulse/main as well and merge
  db.doc(basePath + '/pulse/main').get().then(function(doc) {
    var cloudGoals = [];
    if (doc.exists) {
      var pulse = doc.data();
      var cg = pulse.goals;
      if (cg === undefined && pulse.data !== undefined) cg = pulse.data;
      if (typeof cg === 'string') { try { cg = JSON.parse(cg); } catch(e) { cg = []; } }
      if (Array.isArray(cg)) cloudGoals = cg;
    }

    // Merge local and cloud (same logic as loadFromFirebaseV2)
    var merged = mergeByTimestamp(localGoals, cloudGoals, 'id');
    if (merged.length === 0) {
      // Nothing to migrate
      localStorage.setItem('roweos_pulse_goals_v2_migrated', 'true');
      console.log('[Pulse Migration] No goals to migrate');
      return;
    }

    // Backfill IDs for any goals missing them
    var now = Date.now();
    merged.forEach(function(g) {
      if (!g.id) g.id = 'goal_' + now + '_' + Math.random().toString(36).substr(2, 6);
      if (!g._modifiedAt) g._modifiedAt = now;
    });

    // Write each goal to its own document
    var writeCount = 0;
    merged.forEach(function(goal) {
      if (goal.id) {
        writeDBDoc('pulse/goals', goal.id, goal, 'goals');
        writeCount++;
      }
    });

    // Update localStorage with merged result
    localStorage.setItem('roweos_pulse_goals', JSON.stringify(merged));
    if (typeof pulseGoals !== 'undefined') pulseGoals = merged;

    // Set migration flag
    localStorage.setItem('roweos_pulse_goals_v2_migrated', 'true');
    console.log('[Pulse Migration] Migrated ' + writeCount + ' goals to per-doc format');

    // Re-render if visible
    if (typeof renderPulse3Overview === 'function') renderPulse3Overview();
    if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
  }).catch(function(err) {
    console.warn('[Pulse Migration] Failed:', err.message);
    // Don't set flag -- retry on next load
  });
}
```

### Step 7.2: Trigger migration on auth

The migration should run after Firebase auth resolves and before any goal edits are possible. Find the post-auth initialization sequence (the function that calls `loadFromFirebaseV2()` on sign-in, typically in `22-firebase-sync.js` around the `onAuthStateChanged` handler) and add:

```javascript
// v30.0: Migrate pulse goals to per-doc format (one-time, after first cloud pull)
if (typeof migratePulseGoalsToPerDoc === 'function') {
  setTimeout(function() { migratePulseGoalsToPerDoc(); }, 3000);
}
```

The 3-second delay ensures `loadFromFirebaseV2()` has completed first, so localStorage has the latest merged data. The migration then reads this merged data and writes individual docs.

### Step 7.3: Verify

1. Clear `roweos_pulse_goals_v2_migrated` from localStorage
2. Reload the page (signed in)
3. Console should show `[Pulse Migration] Migrated N goals to per-doc format`
4. Firebase Console: `pulse/goals/` collection has N documents
5. localStorage has `roweos_pulse_goals_v2_migrated` = `'true'`
6. Reload again -- migration does NOT run (flag check)
7. `pulse/main` still exists with journal/insights/entries/reminders intact

### Commit point: "v30.0: One-time migration from pulse/main.goals to per-goal Firestore docs"

---

## Task 8: Update `renderSyncInventory()` Cloud Count

**Files:** `src/js/core/29-analytics-commerce.js`

### Step 8.1: Change Promise.all entry for pulse

In `renderSyncInventory()` (line ~1029), the Promise.all has `pulse/main` at index 7:

```javascript
db.doc(basePath + '/pulse/main').get(),
```

Replace with:

```javascript
db.collection(basePath + '/pulse/goals').get(),
```

### Step 8.2: Change cloud count extraction

Replace line ~1078-1079:

```javascript
        var pulseData = results[7].exists ? results[7].data() : {};
        cloudCounts['Pulse Goals'] = pulseData.goals ? pulseData.goals.length : 0;
```

With:

```javascript
        // v30.0: Per-goal collection -- count docs directly
        cloudCounts['Pulse Goals'] = results[7].size || 0;
```

### Verify

1. Open Settings > Sync Hub
2. Cloud count for "Pulse Goals" should match the number of docs in `pulse/goals/` collection
3. Local count should match `JSON.parse(localStorage.getItem('roweos_pulse_goals')).length`

### Commit point: "v30.0: renderSyncInventory reads pulse goal count from per-goal collection"

---

## Task 9: Update `writeDB()` v4 Dual-Write Map

**Files:** `src/js/core/09-state.js`

### Step 9.1: Update the v4 map

The current v4 map (line ~112) has:

```javascript
'pulse/main': 'pulse/goals',
```

This maps the old single-doc path to v4. Since we now use `writeDBDoc('pulse/goals', goalId, ...)` instead of `writeDB('pulse/main', ...)`, the v4 dual-write in `writeDBDoc` already handles it (line ~152-154):

```javascript
if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
  try { syncEngine.write(collectionPath, docId, data); } catch(_v4e) {}
}
```

This means `writeDBDoc('pulse/goals', goal.id, goal)` will call `syncEngine.write('pulse/goals', goal.id, goal)` automatically. No change needed to `writeDB()` v4 map.

However, we should update the `writeDB` v4 map to remove the stale `'pulse/main': 'pulse/goals'` mapping, since `pulse/main` no longer carries goals data:

```javascript
'pulse/main': 'pulse/main',  // v30.0: Now only journal/insights/entries/reminders
```

### Verify

1. If v4 sync engine is active, check that per-goal writes propagate to v4 namespace
2. If v4 is not active (likely), this is a no-op and the map change is cosmetic/correctness only

### Commit point: "v30.0: Update v4 dual-write map for pulse/main (goals removed)"

---

## Task 10: Integration Testing

No automated tests exist. Manual browser verification:

### Test Matrix

| # | Scenario | Expected | How to Verify |
|---|----------|----------|--------------|
| 1 | Create goal on device A | Doc appears in `pulse/goals/{id}` | Firebase Console |
| 2 | Edit goal title on device A | Only that goal's doc updated | Firebase Console timestamp |
| 3 | Check/uncheck task on device A | Only that goal's doc updated | Firebase Console |
| 4 | Delete goal on device A | Doc deleted from `pulse/goals/` | Firebase Console |
| 5 | Create goal on device A, see on B | Goal appears on B via listener | Open 2 tabs |
| 6 | Edit on A, see on B | Edit appears on B | Open 2 tabs |
| 7 | Delete on A, gone on B | Goal disappears from B | Open 2 tabs |
| 8 | Create different goals simultaneously | Both goals exist on both devices | Open 2 tabs, create at same time |
| 9 | Fresh account (no migration) | Goals work from scratch | New account or clear data |
| 10 | Migration from old format | Existing goals moved to per-doc | Clear migration flag, reload |
| 11 | Sync inventory counts match | Cloud = local count | Settings > Sync Hub |
| 12 | Manual push writes per-doc | Goals in collection, not array | Push then check Firebase Console |
| 13 | Manual pull reads per-doc | Goals load from collection | Pull then check localStorage |
| 14 | Journal/insights/reminders unaffected | Still save/load from pulse/main | Create journal entry, check Firebase |
| 15 | Offline create, then sync | Goal writes on reconnect | Airplane mode test |

### Console Verification Commands

```javascript
// Check local goals
JSON.parse(localStorage.getItem('roweos_pulse_goals')).length

// Check migration flag
localStorage.getItem('roweos_pulse_goals_v2_migrated')

// Check dirty tracker is empty after save
Object.keys(_dirtyPulseGoalIds)  // Should be {}

// Manual cloud read (paste in console)
firebase.firestore().collection('roweos_users/' + firebaseUser.uid + '/pulse/goals').get().then(function(s) { console.log('Cloud goals:', s.size); s.forEach(function(d) { console.log(' -', d.id, d.data().title); }); });
```

---

## Rollback Plan

If issues are found post-deploy:

1. **Revert `savePulseGoals()`** to write `pulse/main` again (restore the `writeDB('pulse/main', { goals: pulseGoals })` line)
2. **Revert `onSnapshot`** to single-doc listener
3. **Revert `loadFromFirebaseV2`** to single-doc read
4. The per-goal docs in Firestore are harmless (orphaned but not read)
5. `pulse/main` still has journal/insights/entries/reminders -- no data loss for those
6. Clear `roweos_pulse_goals_v2_migrated` flag if needed to re-trigger migration later

**Data is never deleted from `pulse/main`** during this migration. The old `goals` field simply stops being written. It remains readable for 30+ days as a fallback.

---

## Execution Order

1. **Task 1** (savePulseGoals rewrite + dirty tracking) -- foundation
2. **Task 2** (markGoalDirty in all modifiers) -- depends on Task 1
3. **Task 3** (deleteGoal Firestore delete) -- depends on Task 1
4. **Task 4** (onSnapshot collection listener) -- independent of 1-3 but deploy together
5. **Task 5** (loadFromFirebaseV2 collection read) -- independent
6. **Task 6** (syncToFirebaseV2 push path) -- independent
7. **Task 7** (migration) -- depends on Tasks 1-6 being in place
8. **Task 8** (renderSyncInventory) -- independent
9. **Task 9** (v4 dual-write map) -- cosmetic, low priority
10. **Task 10** (integration testing) -- after all tasks

Tasks 1-3 should be deployed together (write path). Tasks 4-6 should be deployed together (read path). Task 7 triggers on first load after both are live.
