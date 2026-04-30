# Write-Through Sync Architecture + UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the debounced push/pull sync architecture with write-through cache pattern (localStorage + immediate Firestore writes), eliminate all tombstone/deletion-guard machinery, and fix Focus mobile margins, Focus auto-expand, and Folio desktop interactivity.

**Architecture:** Every save function writes to localStorage (instant UI) and Firestore (immediate, non-blocking) in parallel. Deletions remove from both stores atomically -- no tombstones needed. `enablePersistence()` handles offline queuing. Real-time listeners simplified to mirror Firestore state to localStorage without grace period guards. Unsigned/free users get a pending-writes queue that flushes on sign-in.

**Tech Stack:** Firebase Firestore v10.7.1 compat SDK, vanilla ES5 JavaScript, single-file HTML app

**Critical Constraints:**
- ES5 only (no arrow functions, let/const, template literals)
- All edits in `RoweOS/dist/index.html` (173,897 lines)
- `shouldSyncCategory()` gating MUST be preserved on all write paths
- Never add `margin: 0` to `* {}` reset
- Never remove iOS box-sizing reflow hacks
- `#agentConversation` must use `overflow: hidden`

**shouldSyncCategory Gating Reference:**
| Data Type | Category Key | Gated? |
|-----------|-------------|--------|
| Pulse goals | `'goals'` | Yes |
| Automations | `'automations'` | Yes |
| Todos | `'brand_todos'` | Yes |
| Calendar | `'calendar'` | Yes |
| Library | `'library'` | Yes |
| Brands | (none) | No -- always synced |
| Clients | (none) | No -- always synced |
| Mail | (none) | No -- always synced |
| Profile/settings | (none) | No -- always synced |

**Document ID Strategy (CRITICAL -- prevents orphan documents):**
- Todos: Use single document `todos/main` with `{ data: todosArray }` (NOT per-index subcollection)
- Calendar: Use `evt.id` as doc ID (NOT array index). Require ID on all events.
- Brands: Use single document `brands/{idx}` (existing pattern, OK because brand count rarely changes and full push on save)
- Automations: Use `auto.id` as doc ID (existing pattern, correct)

**Echo Guard Strategy:**
Use Firestore snapshot metadata `hasPendingWrites` to distinguish local echoes from remote updates (NOT timing-based guards). This is the canonical Firestore approach.

---

## Chunk 1: Foundation -- Write Helper Infrastructure

### Task 1: Enable Firestore Offline Persistence

**Files:**
- Modify: `RoweOS/dist/index.html` -- Firebase init section (find `firebase.initializeApp` call)

- [ ] **Step 1: Find the Firebase init call**

Search for `firebase.initializeApp` in the file. It should be in the JS section after the Firebase SDK scripts load.

- [ ] **Step 2: Add enablePersistence() immediately after Firestore init**

Add this right after `firebase.initializeApp(config)` or wherever Firestore is first configured:

```javascript
// v25.1: Enable Firestore offline persistence for write-through sync
try {
  firebase.firestore().enablePersistence({ synchronizeTabs: true })
    .then(function() { console.log('[Sync V3] Firestore offline persistence enabled'); })
    .catch(function(err) {
      if (err.code === 'failed-precondition') {
        console.warn('[Sync V3] Persistence failed: multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('[Sync V3] Persistence not available in this browser');
      }
    });
} catch(e) { console.warn('[Sync V3] enablePersistence error:', e); }
```

- [ ] **Step 3: Verify in browser console**

Open the app, check console for `[Sync V3] Firestore offline persistence enabled`. If you see it, persistence is working.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): enable Firestore offline persistence for write-through sync v25.1"
```

---

### Task 2: Create Global `db` Reference and `writeDB()` Primitive

**Files:**
- Modify: `RoweOS/dist/index.html` -- Add near sync globals (around line 60326 area, near `scheduleAutoSync`)

- [ ] **Step 1: Add the global db getter and writeDB primitive**

Place this near the existing sync globals (`_autoSyncTimer`, `isSyncing`, etc.):

```javascript
// v25.1: Write-through sync primitives
// Global Firestore reference (lazy-init)
var _dbRef = null;
function getDB() {
  if (!_dbRef && typeof firebase !== 'undefined' && firebase.firestore) {
    _dbRef = firebase.firestore();
  }
  return _dbRef;
}

// Sync mode check — shared by all write functions
function isLocalOnlyMode() {
  var mode = 'hybrid';
  try { mode = (JSON.parse(localStorage.getItem('roweos_sync_settings') || '{}')).syncMode || 'hybrid'; } catch(e) {}
  return (mode === 'perfect_local' || mode === 'local');
}

// Core write-through primitive: writes to Firestore immediately (non-blocking)
// Falls back to pending-writes queue if not signed in
// category (optional): shouldSyncCategory key (e.g. 'goals', 'automations'). If provided, checks gating.
function writeDB(docPath, data, options) {
  var db = getDB();
  if (!db) return;
  if (isLocalOnlyMode()) return;
  var writeOpts = options || {};
  // Check shouldSyncCategory if a category is specified
  if (writeOpts.category && typeof shouldSyncCategory === 'function' && !shouldSyncCategory(writeOpts.category)) return;

  if (!firebaseUser) {
    _queuePendingWrite(docPath, data, writeOpts);
    return;
  }

  var basePath = 'roweos_users/' + firebaseUser.uid;
  var fullPath = basePath + '/' + docPath;
  stampLocalSave(); // Stamp before write for echo guard

  try {
    if (writeOpts.merge !== false) {
      db.doc(fullPath).set(data, { merge: true }).then(function() {
        if (ROWEOS_DEBUG) console.log('[WriteDB] ' + docPath + ' synced');
        updateSyncIndicator('connected');
      }).catch(function(err) {
        console.warn('[WriteDB] ' + docPath + ' failed:', err.message);
        updateSyncIndicator('error');
      });
    } else {
      db.doc(fullPath).set(data).then(function() {
        if (ROWEOS_DEBUG) console.log('[WriteDB] ' + docPath + ' synced');
        updateSyncIndicator('connected');
      }).catch(function(err) {
        console.warn('[WriteDB] ' + docPath + ' failed:', err.message);
        updateSyncIndicator('error');
      });
    }
  } catch(e) {
    console.warn('[WriteDB] Error writing ' + docPath + ':', e.message);
  }
}

// Write to a subcollection document (e.g., /automations/{id})
// category (optional): shouldSyncCategory key
function writeDBDoc(collectionPath, docId, data, category) {
  var db = getDB();
  if (!db) return;
  if (isLocalOnlyMode()) return;
  if (category && typeof shouldSyncCategory === 'function' && !shouldSyncCategory(category)) return;

  if (!firebaseUser) {
    _queuePendingWrite(collectionPath + '/' + docId, data, { category: category });
    return;
  }

  var basePath = 'roweos_users/' + firebaseUser.uid;
  stampLocalSave();
  try {
    db.doc(basePath + '/' + collectionPath + '/' + docId).set(data, { merge: true }).then(function() {
      if (ROWEOS_DEBUG) console.log('[WriteDB] ' + collectionPath + '/' + docId + ' synced');
    }).catch(function(err) {
      console.warn('[WriteDB] ' + collectionPath + '/' + docId + ' failed:', err.message);
    });
  } catch(e) {}
}

// Delete a subcollection document
function deleteDBDoc(collectionPath, docId, category) {
  var db = getDB();
  if (!db) return;
  if (isLocalOnlyMode()) return;
  if (category && typeof shouldSyncCategory === 'function' && !shouldSyncCategory(category)) return;

  if (!firebaseUser) {
    _queuePendingWrite(collectionPath + '/' + docId, null, { action: 'delete', category: category });
    return;
  }

  var basePath = 'roweos_users/' + firebaseUser.uid;
  stampLocalSave();
  try {
    db.doc(basePath + '/' + collectionPath + '/' + docId).delete().then(function() {
      if (ROWEOS_DEBUG) console.log('[WriteDB] Deleted ' + collectionPath + '/' + docId);
    }).catch(function(err) {
      console.warn('[WriteDB] Delete ' + collectionPath + '/' + docId + ' failed:', err.message);
    });
  } catch(e) {}
}
```

- [ ] **Step 2: Verify writeDB is callable**

In browser console: `writeDB('_test/ping', { t: Date.now() })`. Check Firestore console for the document. Delete the test doc manually.

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): add writeDB/writeDBDoc/deleteDBDoc write-through primitives v25.1"
```

---

### Task 3: Pending Writes Queue for Unsigned Users

**Files:**
- Modify: `RoweOS/dist/index.html` -- Add right after the writeDB primitives

- [ ] **Step 1: Add the pending writes queue**

```javascript
// v25.1: Pending writes queue — stores writes when user is not signed in
function _queuePendingWrite(docPath, data, options) {
  try {
    var queue = JSON.parse(localStorage.getItem('roweos_pending_writes') || '[]');
    queue.push({
      path: docPath,
      data: data,
      options: options || {},
      timestamp: Date.now()
    });
    // Cap queue at 500 entries to prevent localStorage bloat
    if (queue.length > 500) queue = queue.slice(-500);
    localStorage.setItem('roweos_pending_writes', JSON.stringify(queue));
  } catch(e) { console.warn('[WriteDB] Queue write failed:', e.message); }
}

// Flush pending writes on sign-in
function flushPendingWrites() {
  if (!firebaseUser) return;
  var queue = [];
  try { queue = JSON.parse(localStorage.getItem('roweos_pending_writes') || '[]'); } catch(e) {}
  if (queue.length === 0) return;

  console.log('[Sync V3] Flushing ' + queue.length + ' pending writes');
  var db = getDB();
  if (!db) return;
  var basePath = 'roweos_users/' + firebaseUser.uid;

  // Use Firestore batch for atomic flush (max 500 per batch)
  var batch = db.batch();
  var batchCount = 0;
  queue.forEach(function(entry) {
    // Respect shouldSyncCategory if category was stored
    if (entry.options && entry.options.category && typeof shouldSyncCategory === 'function') {
      if (!shouldSyncCategory(entry.options.category)) return;
    }
    var fullPath = basePath + '/' + entry.path;
    try {
      var ref = db.doc(fullPath);
      if (entry.options && entry.options.action === 'delete') {
        batch.delete(ref);
      } else if (entry.data) {
        batch.set(ref, entry.data, { merge: true });
      }
      batchCount++;
      // Firestore batch limit is 500
      if (batchCount >= 499) {
        batch.commit().catch(function(e) { console.warn('[Sync V3] Batch flush error:', e.message); });
        batch = db.batch();
        batchCount = 0;
      }
    } catch(e) {}
  });
  if (batchCount > 0) {
    batch.commit().catch(function(e) { console.warn('[Sync V3] Batch flush error:', e.message); });
  }

  // Clear the queue
  localStorage.removeItem('roweos_pending_writes');
}
```

- [ ] **Step 2: Hook flushPendingWrites into Firebase auth state change**

Find the `firebase.auth().onAuthStateChanged` handler. Add `flushPendingWrites()` call after `firebaseUser` is set and confirmed non-null:

```javascript
// Inside onAuthStateChanged, after firebaseUser = user:
if (typeof flushPendingWrites === 'function') flushPendingWrites(); // v25.1
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): add pending writes queue for unsigned users v25.1"
```

---

## Chunk 2: Migrate Save Functions to Write-Through

### Task 4: Migrate Pulse Goals to Write-Through

**Files:**
- Modify: `RoweOS/dist/index.html:147310` -- `savePulseGoals()` function
- Modify: `RoweOS/dist/index.html:148463` -- `deletePulseGoal()` function
- Modify: `RoweOS/dist/index.html:129019` -- Pulse section of `loadFromFirebaseV2()`

NOTE: `savePulseGoals()` at line 147310 already has a v24.27 immediate Firebase write. This task simplifies it to use `writeDB()` and removes the tombstone pattern.

- [ ] **Step 1: Simplify savePulseGoals()**

Replace the existing `savePulseGoals()` function. Remove the `roweos_deleted_pulse_goals` filtering and the inline Firebase write. Replace with:

```javascript
function savePulseGoals() {
  // v25.1: Write-through — localStorage + immediate Firestore
  localStorage.setItem('roweos_pulse_goals', JSON.stringify(pulseGoals));
  // Only write the goals field — merge:true preserves journal/insights/entries/reminders
  writeDB('pulse/main', { goals: pulseGoals }, { category: 'goals' });
}
```

- [ ] **Step 2: Simplify deletePulseGoal()**

Replace `deletePulseGoal()` at line 148463. Remove the `roweos_deleted_pulse_goals` tombstone logic:

```javascript
function deletePulseGoal(goalId) {
  // v25.1: Write-through delete — remove from array, save immediately
  pulseGoals = pulseGoals.filter(function(g) { return g.id !== goalId; });
  savePulseGoals(); // This now writes to both localStorage and Firestore
  renderPulseGoals();
  showToast('Goal deleted', 'success');
}
```

Preserve any UI logic (closing modals, re-rendering) that exists after the deletion in the current function. Only remove the tombstone tracking (`roweos_deleted_pulse_goals` writes).

- [ ] **Step 3: Simplify Pulse pull in loadFromFirebaseV2()**

At line 129019, simplify the Pulse section. Remove the deletion-list merge and filter. Replace with:

```javascript
    // Pulse — v25.1: Write-through — Firestore is truth, no tombstone merge needed
    if (pulseDoc.exists) {
      var pulse = pulseDoc.data();
      if (pulse.goals) safeSyncWrite('roweos_pulse_goals', pulse.goals);
      if (pulse.journal) safeSyncWrite('roweos_pulse_journal', pulse.journal);
      if (pulse.insights) safeSyncWrite('roweos_pulse_insights', pulse.insights);
      if (pulse.entries) safeSyncWrite('roweos_pulse2_entries', pulse.entries);
      if (pulse.reminders) safeSyncWrite('roweos_reminders', pulse.reminders);
    }
```

- [ ] **Step 4: Remove roweos_deleted_pulse_goals references**

Search for all remaining references to `roweos_deleted_pulse_goals` in the file. Remove any reads/writes to this key. There should be references at approximately lines: 122873, 128156, 129025, 129031, 147313, 147370, 148466. Remove or simplify each one.

- [ ] **Step 5: Test Pulse goals sync**

1. Create a goal on device A
2. Verify it appears on device B within seconds (check Firestore console too)
3. Delete the goal on device A
4. Verify it disappears from Firestore immediately
5. Refresh device B -- verify the deleted goal does NOT reappear

- [ ] **Step 6: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): migrate Pulse goals to write-through, remove tombstones v25.1"
```

---

### Task 5: Migrate Automations to Write-Through

**Files:**
- Modify: `RoweOS/dist/index.html:165774` -- `saveScheduledTasks()`
- Modify: `RoweOS/dist/index.html:100870` -- `deleteAutomation()`
- Modify: `RoweOS/dist/index.html:100672` -- `_deletedAutomationIds` init
- Modify: `RoweOS/dist/index.html:127923` -- Automations section of `syncToFirebaseV2()`
- Modify: `RoweOS/dist/index.html:129077` -- Automations section of `loadFromFirebaseV2()`

- [ ] **Step 1: Create writeDBAutomation() and deleteDBAutomation() helpers**

Add near the other writeDB primitives:

```javascript
// v25.1: Write single automation to Firestore
function writeDBAutomation(auto) {
  if (!auto || !auto.id) return;
  if (!shouldSyncCategory('automations')) return;
  // Deep-strip base64 data URLs (matches syncToFirebaseV2 regex approach for nested content)
  var dataStr = JSON.stringify(auto);
  dataStr = dataStr.replace(/"data:[^"]{50000,}"/g, '""');
  var data = JSON.parse(dataStr);
  data.updatedAt = new Date().toISOString();
  writeDBDoc('automations', String(auto.id), data);
}

// v25.1: Delete automation from Firestore
function deleteDBAutomation(autoId) {
  deleteDBDoc('automations', String(autoId));
  // Also remove from profile/deletedAutomationIds if it exists (cleanup)
}
```

- [ ] **Step 2: Modify saveScheduledTasks() to use write-through**

Replace the `scheduleAutoSync()` call with individual automation writes:

```javascript
function saveScheduledTasks(tasks) {
  localStorage.setItem('roweos_scheduled_tasks', JSON.stringify(tasks));
  // v25.1: Also update roweos_automations (dual storage)
  var allAutos = [];
  try { allAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}

  // Sync each automation that changed
  tasks.forEach(function(t) {
    if (t.type === 'workflow' || t.type === 'pipeline') {
      writeDBAutomation(t);
      // Update in allAutos array
      var found = false;
      for (var i = 0; i < allAutos.length; i++) {
        if (String(allAutos[i].id) === String(t.id)) { allAutos[i] = t; found = true; break; }
      }
      if (!found) allAutos.push(t);
    }
  });
  localStorage.setItem('roweos_automations', JSON.stringify(allAutos));
  stampLocalSave();
}
```

- [ ] **Step 3: Modify deleteAutomation() to use write-through**

Replace the tombstone pattern in `deleteAutomation()` at line 100870:

```javascript
function deleteAutomation(id) {
  if (!confirm('Delete this workflow?')) return;
  var idStr = String(id);

  // v25.1: Write-through delete — remove from localStorage + Firestore immediately
  // Remove from roweos_automations
  var autos = [];
  try { autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}
  autos = autos.filter(function(a) { return String(a.id) !== idStr; });
  localStorage.setItem('roweos_automations', JSON.stringify(autos));

  // Remove from roweos_scheduled_tasks
  var tasks = [];
  try { tasks = JSON.parse(localStorage.getItem('roweos_scheduled_tasks') || '[]'); } catch(e) {}
  tasks = tasks.filter(function(t) { return String(t.id) !== idStr; });
  localStorage.setItem('roweos_scheduled_tasks', JSON.stringify(tasks));

  // Delete from Firestore
  deleteDBAutomation(idStr);

  // Re-render UI (preserve existing re-render calls from current function)
  // ... keep existing UI update logic ...
}
```

Also update `deleteScheduledTask()` (~line 165827) and `deleteAutoLabWorkflow()` (~line 91437) with the same pattern.

- [ ] **Step 4: Remove _deletedAutomationIds machinery**

Remove or comment out:
- Lines 100672-100689: `_deletedAutomationIds` initialization and `_persistDeletedIds()`
- All reads/writes to `roweos_deleted_automation_ids` localStorage key
- The deletion guard checks in `loadFromFirebaseV2()` (lines 129079-129089, 129108, 129114)
- The `profile/deletedAutomationIds` Firestore document writes in `syncToFirebaseV2()` (line 127925-127926)
- The orphan cleanup logic in `syncToFirebaseV2()` (lines 127938-127953)

- [ ] **Step 5: Simplify automations pull in loadFromFirebaseV2()**

Replace lines 129077-129153 with:

```javascript
    // v25.1: Automations — write-through, Firestore is truth
    var _automationsChain = db.collection(basePath + '/automations').get().then(function(autoSnap) {
      var cloudAutos = [];
      if (autoSnap && !autoSnap.empty) {
        autoSnap.forEach(function(doc) { cloudAutos.push(doc.data()); });
      }
      if (cloudAutos.length > 0) {
        localStorage.setItem('roweos_automations', JSON.stringify(cloudAutos));
        // Rebuild scheduled tasks from automations
        try {
          var existingTasks = JSON.parse(localStorage.getItem('roweos_scheduled_tasks') || '[]');
          var nonAutoTasks = existingTasks.filter(function(t) { return t.type !== 'workflow' && t.type !== 'pipeline'; });
          var autoTasks = cloudAutos.filter(function(a) { return a.enabled !== false; }).map(function(a) {
            var full = JSON.parse(JSON.stringify(a));
            if (!full.type) full.type = 'workflow';
            if (full.enabled === undefined) full.enabled = true;
            return full;
          });
          localStorage.setItem('roweos_scheduled_tasks', JSON.stringify(nonAutoTasks.concat(autoTasks)));
        } catch(e) {}
      }
      console.log('[Firebase V3] Automations loaded: ' + cloudAutos.length + ' from cloud');
    }).catch(function(err) { console.warn('[Firebase V3] Automations load skipped:', err.message); });
```

- [ ] **Step 6: Test automations sync**

1. Create an automation on device A -- verify it appears in Firestore immediately
2. Toggle enabled/disabled on device A -- verify Firestore doc updates
3. Delete on device A -- verify Firestore doc is deleted (not tombstoned)
4. Pull on device B -- verify deleted automation does NOT appear
5. Create on device B while device A is offline -- verify it appears on A after reconnect

- [ ] **Step 7: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): migrate automations to write-through, remove deletion guards v25.1"
```

---

### Task 6: Migrate Todos and Calendar to Write-Through

**Files:**
- Modify: `RoweOS/dist/index.html:87089` -- `saveTodos()`
- Modify: `RoweOS/dist/index.html:87070` -- `saveTodoCategories()`
- Modify: `RoweOS/dist/index.html:87125` -- `saveCalendar()`

- [ ] **Step 1: Add todo/calendar write helpers**

```javascript
// v25.1: Write-through helpers for todos and calendar
// IMPORTANT: Todos use single-document pattern to avoid orphan docs on deletion
// The existing localStorage key is 'roweosTodos' (brand mode) or 'roweos_life_todos' (life mode)
// but syncToFirebaseV2 always reads from 'roweosTodos'. Use getTodosKey() to match current mode.
function writeDBTodos() {
  var todosData = [];
  try { todosData = JSON.parse(localStorage.getItem(getTodosKey()) || '[]'); } catch(e) {}
  // Write as single document — prevents orphan docs when items are deleted
  writeDB('todos/main', { data: todosData }, { category: 'brand_todos' });
}

// Calendar events MUST have an id field. Use event.id as doc ID.
function writeDBCalendar() {
  var calData = [];
  try { calData = JSON.parse(localStorage.getItem(getCalendarKey()) || '[]'); } catch(e) {}
  // Write as single document — prevents orphan docs
  writeDB('calendar/main', { data: calData }, { category: 'calendar' });
}
```

**NOTE:** The existing `syncToFirebaseV2` writes todos and calendar as subcollections (`/todos/0`, `/todos/1`, etc.). The V3 migration (Task 13) must clean up these old per-index documents and write the single-document format. The `loadFromFirebaseV2()` pull must also be updated to read from the new single-document format, with a fallback to the old subcollection format for backward compatibility during the migration window.

- [ ] **Step 2: Modify saveTodos()**

```javascript
function saveTodos() {
  localStorage.setItem(getTodosKey(), JSON.stringify(todos));
  stampLocalSave();
  writeDBTodos(); // v25.1: Write-through replaces scheduleAutoSync
}
```

- [ ] **Step 3: Modify saveTodoCategories()**

```javascript
function saveTodoCategories() {
  localStorage.setItem(getTodoCategoriesKey(), JSON.stringify(window.todoCategories));
  // v25.1: Write-through — categories go in profile (no sync category gate — always synced with profile)
  writeDB('profile/main', {
    todoCategories: window.todoCategories
  });
}
```

Remove `roweos_deleted_todo_categories` tombstone writes from this function and from `loadFromFirebaseV2()`.

- [ ] **Step 4: Modify saveCalendar()**

```javascript
function saveCalendar() {
  localStorage.setItem(getCalendarKey(), JSON.stringify(calendar));
  stampLocalSave();
  writeDBCalendar(); // v25.1: Write-through replaces scheduleAutoSync
  rebuildMergedCalendar();
}
```

- [ ] **Step 5: Remove todo category tombstone tracking**

Search for `roweos_deleted_todo_categories` and `roweos_deleted_life_todo_categories`. Remove all reads/writes to these keys. Simplify the corresponding pull logic in `loadFromFirebaseV2()` to just accept cloud data as truth.

- [ ] **Step 6: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): migrate todos and calendar to write-through v25.1"
```

---

### Task 7: Migrate Brands, Clients, and Mail to Write-Through

**Files:**
- Modify: `RoweOS/dist/index.html:60352` -- `saveBrands()`
- Modify: `RoweOS/dist/index.html:161003` -- `saveClients()`
- Modify: `RoweOS/dist/index.html:168781` -- `saveMailOutbox()` and related mail save functions

- [ ] **Step 1: Modify saveBrands()**

In `saveBrands()` at line 60352, replace `scheduleAutoSync()` with:

```javascript
  // v25.1: Write-through — sync each brand individually
  if (typeof brands !== 'undefined' && brands.length > 0) {
    brands.forEach(function(brand, idx) {
      var data = JSON.parse(JSON.stringify(brand));
      // Strip base64 data URLs to avoid Firestore 1MB limit
      Object.keys(data).forEach(function(k) {
        if (typeof data[k] === 'string' && data[k].indexOf('data:') === 0 && data[k].length > 50000) {
          data[k] = '';
        }
      });
      data._modifiedAt = new Date().toISOString();
      writeDBDoc('brands', String(idx), data);
    });
  }
```

- [ ] **Step 2: Modify saveClients()**

```javascript
function saveClients(clients) {
  localStorage.setItem('roweos_clients', JSON.stringify(clients));
  // v25.1: Write-through
  var data = JSON.parse(JSON.stringify(clients));
  // Strip logos to stay under Firestore limit
  data.forEach(function(c) { if (c.logo && c.logo.length > 50000) c.logo = ''; });
  writeDB('profile/clients', { data: data });
}
```

Remove `roweos_deleted_clients` tombstone tracking from delete functions and from `loadFromFirebaseV2()`.

- [ ] **Step 3: Modify mail save functions**

For each mail save function (`saveMailOutbox`, `saveMailSent`, `saveMailDrafts`, `saveMailConfig`, `saveMailSignatures`, etc.), replace `scheduleAutoSync()` with a `writeDB('profile/mail', {...})` call:

```javascript
function saveMailOutbox(items) {
  _mailOutboxCache = items;
  localStorage.setItem('roweos_mail_outbox', JSON.stringify(items));
  // v25.1: Write-through
  writeDB('profile/mail', { outbox: items });
}

function saveMailSent(items) {
  _mailSentCache = items;
  localStorage.setItem('roweos_mail_sent', JSON.stringify(items));
  writeDB('profile/mail', { sent: items });
}
```

Apply the same pattern to `saveMailDrafts`, `saveMailConfig`, `saveMailSignatures`, `saveMailSignatureMap`, `saveMailAddressBook`.

Remove `roweos_mail_deleted_ids` tombstone tracking.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): migrate brands, clients, mail to write-through v25.1"
```

---

### Task 8: Migrate Remaining Save Functions

**Files:**
- Modify: `RoweOS/dist/index.html` -- All remaining functions that call `scheduleAutoSync()`

- [ ] **Step 1: Identify all remaining scheduleAutoSync callers**

Search for `scheduleAutoSync()` in the file. For each remaining caller, replace with the appropriate `writeDB()` call. Group by Firestore path:

**Profile data** (settings, social connections, guard rails, focus notes, etc.):
```javascript
writeDB('profile/main', { <field>: <value> });
```

**Library data:**
```javascript
writeDB('library/brand', { data: JSON.stringify(libraryData) });
// or
writeDB('library/life', { data: JSON.stringify(lifeLibraryData) });
```

**LifeAI data:**
```javascript
writeDB('lifeAI/main', { <field>: <value> });
```

**Conversations:**
```javascript
writeDB('conversations/current', { data: conversationData });
```

**Folio items:**
```javascript
writeDB('folio/main', { items: folioItems });
```

- [ ] **Step 2: Migrate each caller methodically**

Go through each `scheduleAutoSync()` call site. For each one:
1. Identify what data was just saved to localStorage
2. Determine the correct Firestore path from `syncToFirebaseV2()`
3. Replace `scheduleAutoSync()` with the appropriate `writeDB()` call
4. Preserve the `stampLocalSave()` call if present (still needed for real-time listener echo prevention during migration)

- [ ] **Step 3: Verify no scheduleAutoSync callers remain**

Search the file for `scheduleAutoSync`. The only remaining reference should be the function definition itself (which we'll remove in Task 10).

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): migrate all remaining save functions to write-through v25.1"
```

---

## Chunk 3: Remove Legacy Sync Infrastructure

### Task 9: Simplify loadFromFirebaseV2()

**Files:**
- Modify: `RoweOS/dist/index.html:128534` -- `loadFromFirebaseV2()` function

- [ ] **Step 1: Remove all tombstone merge logic**

In `loadFromFirebaseV2()`, for each data type section:
- Remove `deletedGoals` / `_deletedAutomationIds` / `deletedTodoCategories` / `deletedIds` merge steps
- Replace merge-by-timestamp logic with simple `safeSyncWrite()` calls
- Keep `safeSyncWrite()` (never overwrite non-empty local with empty cloud) as a safety valve

The Pulse section was already simplified in Task 4. The Automations section in Task 5. Now simplify:
- Todo categories section: Remove `deletedTodoCategories` filtering
- Clients section: Remove `deletedIds` filtering
- Mail section: Remove `deletedIds` filtering

**Todos pull -- read new single-doc format with subcollection fallback:**
```javascript
// v25.1: Try single-doc format first, fall back to old subcollection
db.doc(basePath + '/todos/main').get().then(function(todoMainDoc) {
  if (todoMainDoc.exists && todoMainDoc.data().data) {
    safeSyncWrite('roweosTodos', todoMainDoc.data().data);
  } else {
    // Fallback: old per-index subcollection format
    db.collection(basePath + '/todos').get().then(function(todosSnap) {
      if (!todosSnap.empty) {
        var todos = [];
        todosSnap.forEach(function(doc) { if (doc.id !== 'main') todos.push(doc.data()); });
        if (todos.length > 0) safeSyncWrite('roweosTodos', todos);
      }
    });
  }
});
```

Apply the same pattern for calendar (`calendar/main` with fallback).

- [ ] **Step 2: Remove brand merge complexity**

Replace `_mergeCloudBrands()` and `_mergeCloudBrandSettings()` with simple cloud-wins logic. Firestore is truth now:

```javascript
// Brands — v25.1: Firestore is truth, use safeSyncWrite to prevent empty-cloud overwriting local
if (!brandsSnap.empty) {
  var cloudBrands = [];
  brandsSnap.forEach(function(doc) { cloudBrands.push(doc.data()); });
  if (cloudBrands.length > 0) {
    safeSyncWrite(USER_DATA_KEYS.brands, cloudBrands);
  }
}
```

Keep the logo restoration step (logos are stripped before push, restored from `/logos` subcollection on pull).

- [ ] **Step 3: Remove grace period on initial load**

The `lastLocalSaveTime` check at the top of `loadFromFirebaseV2` can be simplified. On a clean install / initial load, there's no local data to protect.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "refactor(sync): simplify loadFromFirebaseV2 — Firestore is truth, no tombstones v25.1"
```

---

### Task 10: Simplify Real-Time Listeners

**Files:**
- Modify: `RoweOS/dist/index.html:123040` -- `setupRealTimeSyncV3()` function

- [ ] **Step 1: Remove grace period guards from all listeners**

In each `onSnapshot` handler, remove:
- `if (isSyncing) return;` checks
- `if (now - lastLocalSaveTime < LOCAL_SAVE_GRACE_PERIOD) return;` checks

Replace with the canonical Firestore approach -- use snapshot metadata to detect local echoes:

```javascript
// v25.1: Use hasPendingWrites to skip local echoes (canonical Firestore pattern)
if (snapshot.metadata.hasPendingWrites) return; // Our own write echoing back, skip
```

For document snapshots (`onSnapshot` on a doc), use `doc.metadata.hasPendingWrites`.
For collection snapshots, use `snapshot.metadata.hasPendingWrites`.

- [ ] **Step 2: Simplify each listener's data application**

Each listener should simply write cloud data to localStorage and re-render. No merge logic needed:

```javascript
// Example: Brands listener
var unsubBrands = db.collection(basePath + '/brands').onSnapshot(function(snapshot) {
  if (snapshot.metadata.hasPendingWrites) return; // Local echo, skip
  if (snapshot.empty) return;
  var cloudBrands = [];
  snapshot.forEach(function(doc) { cloudBrands.push(doc.data()); });
  safeSyncWrite(USER_DATA_KEYS.brands, cloudBrands);
  if (typeof loadBrands === 'function') loadBrands();
  updateSyncIndicator('connected');
}, function() {});
```

Note: Use `safeSyncWrite()` (not `localStorage.setItem`) for all listener writes to preserve the "never overwrite non-empty local with empty cloud" safety valve.

- [ ] **Step 3: Add listeners for Automations and Pulse (currently missing)**

The current `setupRealTimeSyncV3()` has listeners for library, brands, profile, todos, calendar. Add listeners for:

```javascript
// v25.1: Automations real-time listener
var unsubAutomations = db.collection(basePath + '/automations').onSnapshot(function(snapshot) {
  if (snapshot.metadata.hasPendingWrites) return; // Local echo, skip
  if (!shouldSyncCategory('automations')) return;
  var cloudAutos = [];
  snapshot.forEach(function(doc) { cloudAutos.push(doc.data()); });
  safeSyncWrite('roweos_automations', cloudAutos);
  // Rebuild scheduled tasks
  try {
    var existingTasks = JSON.parse(localStorage.getItem('roweos_scheduled_tasks') || '[]');
    var nonAutoTasks = existingTasks.filter(function(t) { return t.type !== 'workflow' && t.type !== 'pipeline'; });
    var autoTasks = cloudAutos.filter(function(a) { return a.enabled !== false; }).map(function(a) {
      var full = JSON.parse(JSON.stringify(a));
      if (!full.type) full.type = 'workflow';
      if (full.enabled === undefined) full.enabled = true;
      return full;
    });
    localStorage.setItem('roweos_scheduled_tasks', JSON.stringify(nonAutoTasks.concat(autoTasks)));
  } catch(e) {}
  if (typeof renderAutomationsList === 'function') renderAutomationsList();
  console.log('[Firebase V3] Automations real-time update:', cloudAutos.length);
}, function() {});

// v25.1: Pulse real-time listener
var unsubPulse = db.doc(basePath + '/pulse/main').onSnapshot(function(doc) {
  if (doc.metadata.hasPendingWrites) return; // Local echo, skip
  if (!shouldSyncCategory('goals')) return;
  if (!doc.exists) return;
  var pulse = doc.data();
  if (pulse.goals) safeSyncWrite('roweos_pulse_goals', pulse.goals);
  if (pulse.journal) safeSyncWrite('roweos_pulse_journal', pulse.journal);
  if (pulse.entries) safeSyncWrite('roweos_pulse2_entries', pulse.entries);
  if (pulse.reminders) safeSyncWrite('roweos_reminders', pulse.reminders);
  // Re-render if Pulse view is active
  if (typeof renderPulseGoals === 'function') renderPulseGoals();
  console.log('[Firebase V3] Pulse real-time update');
}, function() {});
```

Register unsubscribe handles explicitly:
```javascript
firebaseUnsubscribers.push(unsubAutomations);
firebaseUnsubscribers.push(unsubPulse);
```

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "refactor(sync): simplify real-time listeners, add automations+pulse listeners v25.1"
```

---

### Task 11: Remove syncToFirebaseV2() and scheduleAutoSync()

**Files:**
- Modify: `RoweOS/dist/index.html:127710` -- `syncToFirebaseV2()` (~400 lines)
- Modify: `RoweOS/dist/index.html:60326` -- `scheduleAutoSync()` (~20 lines)

- [ ] **Step 1: Verify no callers remain**

Search for `syncToFirebaseV2` and `scheduleAutoSync` in the file. The only remaining references should be:
- Their own function definitions
- The root `onSnapshot` listener which calls `loadFromFirebaseV2` on cross-device detection (this stays)
- The "Sync Now" button in Settings/Sync UI (update this to call `loadFromFirebaseV2()` instead)
- Any manual "Push to Cloud" / "Pull from Cloud" buttons

- [ ] **Step 2: Comment out syncToFirebaseV2() with deprecation note**

Do NOT delete yet -- keep as commented code for one version as safety net:

```javascript
// v25.1: DEPRECATED — replaced by write-through sync. Remove in v25.2
// function syncToFirebaseV2() { ... }
```

- [ ] **Step 3: Replace scheduleAutoSync() with no-op**

```javascript
// v25.1: DEPRECATED — write-through sync handles all writes immediately
function scheduleAutoSync() {
  // No-op: retained for backward compatibility with any remaining callers
  // All save functions now use writeDB() directly
  if (ROWEOS_DEBUG) console.log('[Sync V3] scheduleAutoSync called (no-op — write-through active)');
}
```

- [ ] **Step 4: Update Sync UI buttons**

Find the "Sync Now" / "Push to Cloud" button handlers. Update to:
- "Sync Now" → calls `loadFromFirebaseV2()` (pull from cloud)
- Remove any "Push to Cloud" standalone button (writes are immediate now)

- [ ] **Step 5: Remove tombstone-related localStorage keys**

Remove all remaining code that reads/writes:
- `roweos_deleted_pulse_goals`
- `roweos_deleted_automation_ids`
- `roweos_deleted_todo_categories`
- `roweos_deleted_life_todo_categories`
- `roweos_deleted_clients`
- `roweos_mail_deleted_ids`
- `profile/deletedAutomationIds` Firestore document

- [ ] **Step 6: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "refactor(sync): deprecate syncToFirebaseV2, remove all tombstone tracking v25.1"
```

---

## Chunk 4: Startup Reconciliation and Migration

### Task 12: Add Startup Reconciliation

**Files:**
- Modify: `RoweOS/dist/index.html` -- Add near `loadFromFirebaseV2()` or in the auth state handler

- [ ] **Step 1: Add reconciliation function**

```javascript
// v25.1: Startup reconciliation — compare local timestamps with Firestore
// Runs once on auth, ensures localStorage cache matches Firestore truth
function reconcileOnStartup() {
  if (!firebaseUser) return;
  var db = getDB();
  if (!db) return;
  var basePath = 'roweos_users/' + firebaseUser.uid;

  // Check if this is a fresh install (no local data)
  var hasBrands = localStorage.getItem(USER_DATA_KEYS.brands);
  var hasGoals = localStorage.getItem('roweos_pulse_goals');

  if (!hasBrands && !hasGoals) {
    // Fresh install — do a full pull
    console.log('[Sync V3] Fresh install detected — pulling all data from cloud');
    if (typeof loadFromFirebaseV2 === 'function') loadFromFirebaseV2();
    return;
  }

  // Existing install — check per-collection staleness
  // Compare root doc meta.lastUpdated with local last_sync timestamp
  db.doc(basePath).get().then(function(doc) {
    if (!doc.exists) return;
    var meta = doc.data().meta || {};
    // Handle Firestore Timestamp objects (have .toDate()) and date strings
    var cloudLastUpdated = 0;
    if (meta.lastUpdated) {
      cloudLastUpdated = meta.lastUpdated.toDate ? meta.lastUpdated.toDate().getTime() : new Date(meta.lastUpdated).getTime();
    }
    var localLastSync = 0;
    try { localLastSync = parseInt(localStorage.getItem('roweos_last_sync') || '0'); } catch(e) {}

    if (cloudLastUpdated > localLastSync) {
      console.log('[Sync V3] Cloud is newer than local cache — pulling updates');
      if (typeof loadFromFirebaseV2 === 'function') loadFromFirebaseV2();
    } else {
      console.log('[Sync V3] Local cache is current');
    }
  }).catch(function(err) {
    console.warn('[Sync V3] Reconciliation check failed:', err.message);
  });
}
```

- [ ] **Step 2: Call reconcileOnStartup() from auth state handler**

In the `onAuthStateChanged` handler, after `firebaseUser` is set:

```javascript
if (typeof reconcileOnStartup === 'function') reconcileOnStartup(); // v25.1
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): add startup reconciliation for write-through sync v25.1"
```

---

### Task 13: Migration Path from V2 to V3 Sync

**Files:**
- Modify: `RoweOS/dist/index.html` -- Add migration flag check

- [ ] **Step 1: Add one-time migration on first load**

This runs the first time a user loads the new version. It does a final V2-style full push to ensure Firestore has all current local data, then sets the migration flag:

```javascript
// v25.1: One-time migration from V2 push/pull to V3 write-through
function migrateToSyncV3() {
  if (localStorage.getItem('roweos_sync_v3_migrated')) return;
  if (!firebaseUser) return;
  console.log('[Sync V3] Running one-time migration from V2 to V3');

  // Push all current local data to Firestore to establish baseline
  // This ensures Firestore has the latest from this device before we switch to write-through
  var db = getDB();
  if (!db) return;
  var basePath = 'roweos_users/' + firebaseUser.uid;

  // Push Pulse
  try {
    var goals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    if (goals.length > 0) {
      db.doc(basePath + '/pulse/main').set({
        goals: goals,
        journal: JSON.parse(localStorage.getItem('roweos_pulse_journal') || '[]'),
        insights: JSON.parse(localStorage.getItem('roweos_pulse_insights') || '[]'),
        entries: JSON.parse(localStorage.getItem('roweos_pulse2_entries') || '[]'),
        reminders: JSON.parse(localStorage.getItem('roweos_reminders') || '[]')
      }, { merge: true });
    }
  } catch(e) {}

  // Push Automations
  try {
    var autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    autos.forEach(function(a) {
      if (a && a.id) {
        db.doc(basePath + '/automations/' + String(a.id)).set(a, { merge: true });
      }
    });
  } catch(e) {}

  // Push Todos (migrate from per-index subcollection to single doc)
  try {
    var todosData = JSON.parse(localStorage.getItem('roweosTodos') || '[]');
    if (todosData.length > 0) {
      db.doc(basePath + '/todos/main').set({ data: todosData }, { merge: true });
    }
  } catch(e) {}

  // Push Calendar (migrate from per-index to single doc)
  try {
    var calData = JSON.parse(localStorage.getItem('roweos_calendar') || '[]');
    if (calData.length > 0) {
      db.doc(basePath + '/calendar/main').set({ data: calData }, { merge: true });
    }
  } catch(e) {}

  // Push Brands
  try {
    var brandsData = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brands) || '[]');
    brandsData.forEach(function(brand, idx) {
      var data = JSON.parse(JSON.stringify(brand));
      Object.keys(data).forEach(function(k) {
        if (typeof data[k] === 'string' && data[k].indexOf('data:') === 0 && data[k].length > 50000) data[k] = '';
      });
      db.doc(basePath + '/brands/' + String(idx)).set(data, { merge: true });
    });
  } catch(e) {}

  // Push Clients
  try {
    var clientsData = JSON.parse(localStorage.getItem('roweos_clients') || '[]');
    if (clientsData.length > 0) {
      db.doc(basePath + '/profile/clients').set({ data: clientsData }, { merge: true });
    }
  } catch(e) {}

  // Push Mail
  try {
    var mailOutbox = JSON.parse(localStorage.getItem('roweos_mail_outbox') || '[]');
    var mailSent = JSON.parse(localStorage.getItem('roweos_mail_sent') || '[]');
    var mailConfig = JSON.parse(localStorage.getItem('roweos_mail_config') || '{}');
    db.doc(basePath + '/profile/mail').set({
      outbox: mailOutbox, sent: mailSent, config: mailConfig
    }, { merge: true });
  } catch(e) {}

  // Push Library
  try {
    var libData = localStorage.getItem('roweosLibrary');
    if (libData) db.doc(basePath + '/library/brand').set({ data: libData }, { merge: true });
    var lifeLib = localStorage.getItem('roweos_life_library');
    if (lifeLib) db.doc(basePath + '/library/life').set({ data: lifeLib }, { merge: true });
  } catch(e) {}

  // Clean up old per-index todo and calendar subcollection docs (orphan prevention)
  // Delete docs 0-99 from old subcollections (safe upper bound)
  try {
    for (var ci = 0; ci < 100; ci++) {
      db.doc(basePath + '/todos/' + String(ci)).delete().catch(function() {});
      db.doc(basePath + '/calendar/' + String(ci)).delete().catch(function() {});
    }
  } catch(e) {}

  // Clean up old tombstone keys (they're no longer needed)
  localStorage.removeItem('roweos_deleted_pulse_goals');
  localStorage.removeItem('roweos_deleted_automation_ids');
  localStorage.removeItem('roweos_deleted_todo_categories');
  localStorage.removeItem('roweos_deleted_life_todo_categories');
  localStorage.removeItem('roweos_deleted_clients');
  localStorage.removeItem('roweos_mail_deleted_ids');

  // Also clean Firestore tombstone document
  db.doc(basePath + '/profile/deletedAutomationIds').delete().catch(function() {});

  localStorage.setItem('roweos_sync_v3_migrated', 'true');
  console.log('[Sync V3] Migration complete');
}
```

- [ ] **Step 2: Call migrateToSyncV3() from auth state handler**

Place it after `flushPendingWrites()` and before `reconcileOnStartup()`:

```javascript
if (typeof flushPendingWrites === 'function') flushPendingWrites(); // v25.1
if (typeof migrateToSyncV3 === 'function') migrateToSyncV3(); // v25.1
if (typeof reconcileOnStartup === 'function') reconcileOnStartup(); // v25.1
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat(sync): add V2-to-V3 migration path, clean up tombstone keys v25.1"
```

---

## Chunk 5: UI Fixes

### Task 14: Fix Focus Mobile Margins

**Files:**
- Modify: `RoweOS/dist/index.html:18418` -- Focus grid mobile padding

- [ ] **Step 1: Fix the padding-bottom on Focus grid**

At line 18418, change:
```css
padding-bottom: calc(120px + env(safe-area-inset-bottom, 0px)) !important;
```
to:
```css
padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)) !important;
```

This matches the standard nav-height pattern (`calc(64px + var(--mobile-safe-bottom))`) used elsewhere in the app.

- [ ] **Step 2: Check parent panel padding doesn't double-stack**

Read the mobile CSS for `#signalView .panel` around line 37265/37305. If it also has `padding-bottom` with safe-area, the Focus grid's padding-bottom may need to be reduced further or removed (since the parent handles it). Adjust so only ONE layer adds the nav clearance.

- [ ] **Step 3: Deploy and test on mobile Safari**

Use Safari Web Inspector connected to iPhone. Verify:
- Focus grid bottom padding matches other views
- Content is not pushed excessively up from the bottom
- Nav pill is not overlapping Focus content

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "fix(focus): reduce mobile padding-bottom from 120px to 64px v25.1"
```

---

### Task 15: Fix Focus Auto-Expand on Mobile

**Files:**
- Modify: `RoweOS/dist/index.html:18481` -- Widget wide max-height
- Modify: `RoweOS/dist/index.html` -- Expand/collapse JS if needed

- [ ] **Step 1: Remove max-height cap on widget-wide cards**

At line 18480-18483, change:
```css
.focus-2-widget-card.focus-2-widget-wide {
  max-height: 180px !important;
  overflow-y: auto !important;
}
```
to:
```css
.focus-2-widget-card.focus-2-widget-wide {
  max-height: none !important;
  overflow: visible !important;
  height: auto !important;
}
```

This matches the treatment that `.focus-2-category-card` already gets at lines 18485-18494.

- [ ] **Step 2: Verify the expand/collapse toggle works**

Check `toggleFocus2CategoryExpand()` at line 89785. Verify that the `_all_expanded` initialization state works on first mobile load. If categories still show collapsed, check `localStorage.getItem('roweos_focus2_expanded_category')` -- clear this key and reload to test fresh state.

- [ ] **Step 3: Deploy and test on mobile**

Verify:
- Widget cards (Today, Automations, Notes, Stats) show full content, not truncated at 180px
- Category cards auto-expand on first load
- Expand/collapse toggle still works per category
- No overflow or layout issues

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "fix(focus): remove 180px max-height cap on mobile widget cards v25.1"
```

---

### Task 16: Fix Folio Desktop Interactivity and Grey Content

**Files:**
- Modify: `RoweOS/dist/index.html:98200` -- Folio iframe sandbox attribute
- Modify: `RoweOS/dist/index.html:42914` -- `.folio-preview-frame` CSS
- Modify: `RoweOS/dist/index.html:97504` -- Gallery card iframe

- [ ] **Step 1: Fix iframe sandbox for interactive content**

At line 98200, the Folio Chat preview iframe uses `sandbox="allow-scripts"`. Interactive HTML artifacts (tab switching, form inputs, animations) may need additional sandbox permissions. Change to:

```javascript
html += '<iframe sandbox="allow-scripts allow-same-origin" srcdoc="' + escapeSrcdoc(htmlCode.trim()) + '" style="width:100%;height:100%;border:none;"></iframe>';
```

**Note:** `allow-same-origin` is needed so internal JavaScript can manipulate the DOM properly (e.g., querySelector, classList, event handlers that reference internal state). The content is still sandboxed from the parent page.

- [ ] **Step 2: Fix grey appearance in preview frame**

At line 42914, the `.folio-preview-frame` has `background: #111`. This dark background bleeds through if the iframe content has any transparent areas. Make it match the content:

```css
.folio-preview-frame { height: 60vh; overflow: hidden; background: transparent; position: relative; width: 100%; }
```

Also check if `overflow: hidden` is clipping interactive dropdowns or modals inside the iframe. If so, change to `overflow: auto`.

- [ ] **Step 3: Verify Save to Folio and Expand buttons work**

The buttons depend on `window._folioPreviews[previewId]` being set during `renderFolioChatMessages()`. If these buttons don't work:
1. Check browser console for errors when clicking
2. Verify `window._folioPreviews` is populated: type `window._folioPreviews` in console
3. If empty, the issue is that `_folioMessages` was cleared (page refresh). The fix is to persist `_folioMessages` to localStorage.

If persistence is needed, add to `renderFolioChatMessages()`:

```javascript
// v25.1: Persist chat messages for cross-session continuity
try { localStorage.setItem('roweos_folio_chat_messages', JSON.stringify(_folioMessages)); } catch(e) {}
```

And in `initFolioView()`:

```javascript
function initFolioView() {
  // v25.1: Restore chat messages from localStorage
  if (_folioMessages.length === 0) {
    try {
      var saved = JSON.parse(localStorage.getItem('roweos_folio_chat_messages') || '[]');
      if (saved.length > 0) { _folioMessages = saved; renderFolioChatMessages(); }
    } catch(e) {}
  }
  renderFolioGallery();
}
```

- [ ] **Step 4: Fix gallery card iframe interactivity**

At line 97504, gallery card iframes have `pointer-events:none` (intentional -- cards are clickable, not the previews). This is correct for gallery view. No change needed here.

- [ ] **Step 5: Deploy and test on desktop**

Verify:
- Folio Chat artifacts render with proper colors (not grey)
- Tabs/buttons inside artifacts work (click through)
- "Save to Folio" button saves the artifact
- "Expand" button opens full-screen overlay
- Gallery cards still show non-interactive previews (correct behavior)

- [ ] **Step 6: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "fix(folio): fix desktop interactivity — sandbox, preview background, message persistence v25.1"
```

---

## Chunk 6: Final Verification and Cleanup

### Task 17: End-to-End Sync Verification

- [ ] **Step 1: Clean install test**

1. Open the app in an incognito/private window (simulates clean install)
2. Sign in with Firebase
3. Verify all data pulls from Firestore correctly (goals, automations, brands, todos, etc.)
4. Verify no deleted items resurrect

- [ ] **Step 2: Cross-device sync test**

1. On device A: create a Pulse goal, an automation, a todo
2. On device B: verify all three appear within 5 seconds (real-time listeners)
3. On device A: delete the goal and disable the automation
4. On device B: verify goal disappears and automation shows disabled
5. On device B: create a new automation
6. On device A: verify it appears

- [ ] **Step 3: Offline test**

1. Disconnect from network
2. Create a goal, delete an automation
3. Reconnect
4. Verify the changes sync to Firestore (check Firestore console)
5. Verify other device picks up the changes

- [ ] **Step 4: Unsigned user test**

1. Sign out of Firebase
2. Create goals, automations, todos
3. Verify everything works locally (localStorage)
4. Check `roweos_pending_writes` in localStorage -- should have queued entries
5. Sign in
6. Verify queued writes flush to Firestore

- [ ] **Step 5: Focus mobile verification**

1. Load Focus view on mobile
2. Verify margins match other views (no 120px+ gap at bottom)
3. Verify all widget cards show full content (not capped at 180px)
4. Verify category expand/collapse works

- [ ] **Step 6: Folio desktop verification**

1. Open Folio Chat on desktop
2. Send a message to generate an HTML artifact
3. Verify artifact tabs/buttons work inside the preview
4. Verify "Save to Folio" and "Expand" buttons work
5. Refresh the page -- verify chat messages persist

- [ ] **Step 7: Commit final state**

```bash
git add RoweOS/dist/index.html
git commit -m "chore: verify write-through sync + UI fixes complete v25.1"
```

---

## Summary

| Task | What | Removes | Adds |
|------|------|---------|------|
| 1 | Enable Firestore persistence | - | ~10 lines |
| 2 | writeDB/writeDBDoc/deleteDBDoc primitives | - | ~80 lines |
| 3 | Pending writes queue | - | ~40 lines |
| 4 | Migrate Pulse goals | ~30 lines tombstone code | ~10 lines writeDB |
| 5 | Migrate Automations | ~50 lines tombstone/guard code | ~30 lines writeDB |
| 6 | Migrate Todos/Calendar | ~20 lines tombstone code | ~15 lines writeDB |
| 7 | Migrate Brands/Clients/Mail | ~30 lines tombstone code | ~20 lines writeDB |
| 8 | Migrate remaining save functions | ~103 scheduleAutoSync calls | ~103 writeDB calls |
| 9 | Simplify loadFromFirebaseV2 | ~200 lines merge logic | ~50 lines simple pull |
| 10 | Simplify real-time listeners | ~50 lines grace period code | ~60 lines new listeners |
| 11 | Remove syncToFirebaseV2 | ~400 lines | ~5 lines no-op |
| 12 | Startup reconciliation | - | ~30 lines |
| 13 | V2→V3 migration | - | ~40 lines |
| 14 | Focus mobile margins | 1 line | 1 line |
| 15 | Focus auto-expand | 3 lines | 3 lines |
| 16 | Folio desktop | ~5 lines | ~15 lines |
| 17 | E2E verification | - | - |

**Net code change:** Remove ~900 lines of sync complexity, add ~450 lines of simpler write-through code. Net reduction of ~450 lines.

**Key review fixes incorporated:**
- Todos/calendar use single-document pattern (prevents orphan docs on deletion)
- `writeDB`/`writeDBDoc`/`deleteDBDoc` accept optional `category` param for `shouldSyncCategory` gating
- Pending writes queue uses Firestore batch writes and respects sync category gating
- Echo guard uses `snapshot.metadata.hasPendingWrites` (canonical Firestore approach, not timing-based)
- Migration pushes ALL data types (not just Pulse/Automations)
- Migration cleans up old per-index subcollection docs
- Reconciliation handles Firestore Timestamp objects (`.toDate()`)
- Real-time listener unsubscribes explicitly registered
- `safeSyncWrite()` used in all pull paths (including brands)
- Base64 stripping uses full JSON regex (catches nested content)
- Shared `isLocalOnlyMode()` helper eliminates duplicate sync mode checks
