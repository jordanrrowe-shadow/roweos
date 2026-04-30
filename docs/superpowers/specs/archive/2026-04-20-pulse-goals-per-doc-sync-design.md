# Pulse Goals Per-Document Sync - Design Spec

> **Problem:** `savePulseGoals()` writes the entire `goals` array to a single Firestore document (`pulse/main`). Last writer wins, causing data loss when two devices edit goals concurrently.

**Goal:** Migrate Pulse goals from a single-array document to per-goal Firestore documents, matching the pattern used by brands (`roweos_users/{uid}/brands/{brand_id}`). Each goal gets its own document, so concurrent edits to different goals never conflict.

---

## Current Architecture (Broken)

```
Write: savePulseGoals() → writeDB('pulse/main', { goals: [...all goals...] })
Read:  loadFromFirebaseV2() → db.doc('pulse/main').get() → mergeByTimestamp(local, cloud, 'id')
Live:  onSnapshot('pulse/main') → mergeByTimestamp on change
```

**Failure mode:** Mac A has goals [A, B, C, D]. Mac B has goals [A, D]. Mac B saves → cloud becomes [A, D]. Mac A pulls → mergeByTimestamp sees cloud [A, D] as authoritative baseline. Goals B and C are lost if their `_modifiedAt` is older than cloud versions of A and D.

## Target Architecture

```
Write: savePulseGoal(goal) → writeDB('pulse/goals/' + goal.id, goalData)
Delete: deletePulseGoal(id) → deleteDBDoc('pulse/goals/' + id)
Read:  loadFromFirebaseV2() → db.collection('pulse/goals').get() → per-doc merge
Live:  onSnapshot(collection 'pulse/goals') → per-doc updates
```

Each goal is its own Firestore document at `roweos_users/{uid}/pulse/goals/{goal_id}`. Concurrent edits to different goals never conflict. Same-goal conflicts resolved by `_modifiedAt` timestamp (newer wins).

---

## Migration Strategy

### One-time migration (on first load after upgrade)

1. Check flag: `localStorage.getItem('roweos_pulse_goals_v2_migrated')`
2. If not migrated:
   a. Read all goals from `pulse/main` doc (cloud) and localStorage
   b. For each goal: `writeDB('pulse/goals/' + goal.id, goalData)`
   c. Set flag: `localStorage.setItem('roweos_pulse_goals_v2_migrated', 'true')`
   d. Keep `pulse/main` doc for 30 days as fallback (don't delete)
3. If already migrated: skip

### Backward compatibility

- `loadFromFirebaseV2()` checks BOTH `pulse/main` (old) and `pulse/goals` collection (new)
- If `pulse/goals` collection has documents, use those (new format)
- If only `pulse/main` exists, fall back to old format (triggers migration)
- After migration, `savePulseGoals()` writes per-doc only

---

## Changes Required

### File: `src/js/core/25-documents-lifeai.js`

**`savePulseGoals()` (line ~7397):**
Replace the single `writeDB('pulse/main', { goals: pulseGoals })` with per-goal writes:

```javascript
function savePulseGoals() {
  // ... existing backfill logic stays ...
  localStorage.setItem('roweos_pulse_goals', JSON.stringify(pulseGoals));
  
  // v30.0: Per-goal document writes (no more full-array replacement)
  pulseGoals.forEach(function(goal) {
    writeDB('pulse/goals/' + goal.id, goal, { category: 'goals' });
  });
}
```

**Optimization:** Track dirty goals to avoid writing all goals on every save:
```javascript
var _dirtyPulseGoalIds = {};

function markPulseGoalDirty(goalId) {
  _dirtyPulseGoalIds[goalId] = true;
}

function savePulseGoals() {
  // ... backfill ...
  localStorage.setItem('roweos_pulse_goals', JSON.stringify(pulseGoals));
  
  // Only write dirty goals
  var dirtyIds = Object.keys(_dirtyPulseGoalIds);
  if (dirtyIds.length === 0) {
    // Full write on first save or migration
    pulseGoals.forEach(function(goal) {
      writeDB('pulse/goals/' + goal.id, goal, { category: 'goals' });
    });
  } else {
    dirtyIds.forEach(function(id) {
      var goal = pulseGoals.find(function(g) { return g.id === id; });
      if (goal) writeDB('pulse/goals/' + goal.id, goal, { category: 'goals' });
    });
  }
  _dirtyPulseGoalIds = {};
}
```

**Every function that modifies a goal must call `markPulseGoalDirty(goalId)`:**
- `togglePulseChecklistItem(goalId, itemId)` — line ~8731
- `deleteGoalItem(goalId, itemId)` — line ~9622
- `addItemToGoal(goalId)` — line ~9657
- `editTaskInline(el, goalId, itemId)` — line ~10364
- `editGoalTitleInline(el, goalId)` 
- `saveInlineGoal()` — line ~10015 (new goal, mark dirty)
- `createPulseGoalFromAutomation()` — line ~10058
- `toggleGoalCollapse(goalId)` — line ~8719
- `setGoalDueDate(goalId)`
- `completeGoal(goalId)`
- `deleteGoal(goalId)` — needs `deleteDBDoc('pulse/goals/' + goalId)`

### File: `src/js/core/22-firebase-sync.js`

**`loadFromFirebaseV2()` — Pulse pull section (line ~9430):**

Replace the single-doc read with collection read:

```javascript
// Instead of: db.doc(basePath + '/pulse/main').get()
// Use: db.collection(basePath + '/pulse/goals').get()

// In the Promise.all array, replace the pulse/main entry:
db.collection(basePath + '/pulse/goals').get()

// In the results handler:
var pulseGoalsSnap = results[7]; // was pulseDoc
var _cloudGoals = [];
if (pulseGoalsSnap && !pulseGoalsSnap.empty) {
  pulseGoalsSnap.forEach(function(doc) {
    _cloudGoals.push(doc.data());
  });
}
// Fall back to old pulse/main if no per-goal docs exist
if (_cloudGoals.length === 0) {
  // Try legacy pulse/main
  var legacyPulse = await db.doc(basePath + '/pulse/main').get();
  if (legacyPulse.exists && legacyPulse.data().goals) {
    _cloudGoals = legacyPulse.data().goals;
  }
}
var _localGoals = [];
try { _localGoals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]'); } catch(e) {}
var _mergedGoals = mergeByTimestamp(_localGoals, _cloudGoals, 'id');
localStorage.setItem('roweos_pulse_goals', JSON.stringify(_mergedGoals));
if (typeof pulseGoals !== 'undefined') pulseGoals = _mergedGoals;
```

**Real-time listener (line ~2630):**

Replace single-doc listener with collection listener:

```javascript
// Instead of: db.doc(basePath + '/pulse/main').onSnapshot(...)
// Use: db.collection(basePath + '/pulse/goals').onSnapshot(...)

var unsubPulseGoals = db.collection(basePath + '/pulse/goals').onSnapshot(function(snapshot) {
  if (snapshot.metadata.hasPendingWrites) return;
  if (!shouldSyncCategory('goals')) return;
  
  var _cloudGoals = [];
  snapshot.forEach(function(doc) { _cloudGoals.push(doc.data()); });
  
  var _localGoals = [];
  try { _localGoals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]'); } catch(e) {}
  var _merged = mergeByTimestamp(_localGoals, _cloudGoals, 'id');
  localStorage.setItem('roweos_pulse_goals', JSON.stringify(_merged));
  if (typeof pulseGoals !== 'undefined') pulseGoals = _merged;
  
  if (typeof renderPulse3Overview === 'function') renderPulse3Overview();
  if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
}, function() {});
firebaseUnsubscribers.push(unsubPulseGoals);
```

**Goal deletion must also delete the Firestore document:**

In `deleteGoal()` (25-documents-lifeai.js), add:
```javascript
if (typeof deleteDBDoc === 'function') {
  deleteDBDoc('pulse/goals/' + goalId);
}
```

### File: `src/js/core/29-analytics-commerce.js`

**Sync inventory cloud count (line ~1078):**

Change from reading `pulse/main` to counting `pulse/goals` collection:

```javascript
// Replace: var pulseData = results[7].exists ? results[7].data() : {};
//          cloudCounts['Pulse Goals'] = pulseData.goals ? pulseData.goals.length : 0;
// With:
var pulseGoalsSnap = await db.collection(basePath + '/pulse/goals').get();
cloudCounts['Pulse Goals'] = pulseGoalsSnap.size;
```

---

## Risk Areas

1. **Migration timing:** Must run before any `savePulseGoals()` call to avoid writing old format
2. **Dual-read period:** During migration, some devices may be on old format. Both formats must be readable.
3. **`pulse/main` doc still used for:** journal, insights, entries, reminders — NOT just goals. The `writeDB('pulse/main', { goals: ... })` call must be replaced, but other `pulse/main` writes (journal, etc.) must NOT be affected.
4. **deleteDBDoc:** Must exist and work. Verify `deleteDBDoc` is defined (it is in `09-state.js`).
5. **Firestore collection reads are heavier** than single-doc reads. 57 goals = 57 doc reads per sync. Firestore pricing: 1 read per doc. Monitor costs.

## Testing

1. Create goals on Mac A, verify they appear in `pulse/goals/{id}` collection in Firebase Console
2. Create different goals on Mac B, verify Mac A gets them via real-time listener WITHOUT losing its own
3. Delete a goal on Mac A, verify it's removed from Mac B via listener
4. Check items, edit titles, mark complete — verify only the changed goal doc is written (check Firestore Console writes)
5. Legacy fallback: temporarily remove per-goal docs, verify app falls back to `pulse/main` format
