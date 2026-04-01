# v4.0 Firebase Sync Overhaul -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the entire Firebase sync system with a clean v4 namespace, unified sync engine, field-level merge, offline queue, and conflict resolution UI.

**Architecture:** New `roweos_v4/{uid}/` Firestore namespace with standardized document schema. Single `syncEngine` object replaces all scattered write/read functions. Migration engine copies all data from old namespace with field-by-field verification. Conflict queue for high-value fields, auto-merge for settings.

**Tech Stack:** Firebase Firestore (compat SDK), vanilla ES5 JavaScript, single-file HTML app (RoweOS/dist/index.html)

**Spec:** `docs/superpowers/specs/2026-03-27-v4-firebase-sync-overhaul-design.md`

**Critical constraints:**
- ES5 only (no arrow functions, let/const, template literals)
- Single 190K-line index.html file
- Tag all changes with `// v28.0:`
- Must preserve all pre-existing brace gaps (~2-3 brace offset is normal)
- Test by deploying to roweos.com and verifying in browser console + Web Inspector

---

## Phase 1: Sync Engine Core

### Task 1: Device Registry + _normalizeTs

**Files:**
- Modify: `RoweOS/dist/index.html` (JS section, after existing sync functions ~line 63400)

- [ ] **Step 1: Add device ID generation and registration**

Insert after the existing `_normalizeTs` function (around line 63402):

```javascript
// v28.0: ═══════════════════════════════════════════════════════
// SYNC ENGINE v4.0 -- Device Registry
// ═══════════════════════════════════════════════════════════════

var SYNC_V4_NAMESPACE = 'roweos_v4';
var SYNC_V4_DEVICE_ID_KEY = 'roweos_v4_device_id';
var SYNC_V4_DEVICE_NAME_KEY = 'roweos_v4_device_name';

function _getDeviceId() {
  var id = localStorage.getItem(SYNC_V4_DEVICE_ID_KEY);
  if (id) return id;
  var platform = /iPhone|iPad/.test(navigator.userAgent) ? 'ios'
    : /Android/.test(navigator.userAgent) ? 'android'
    : /Mac/.test(navigator.userAgent) ? 'mac'
    : 'web';
  var rand = Math.random().toString(36).substring(2, 10);
  id = platform + '_' + rand;
  localStorage.setItem(SYNC_V4_DEVICE_ID_KEY, id);
  return id;
}

function _getDeviceName() {
  var cached = localStorage.getItem(SYNC_V4_DEVICE_NAME_KEY);
  if (cached) return cached;
  var ua = navigator.userAgent;
  var name = 'Unknown Device';
  if (/iPhone/.test(ua)) name = 'iPhone';
  else if (/iPad/.test(ua)) name = 'iPad';
  else if (/Macintosh/.test(ua)) name = 'MacBook';
  else if (/Android/.test(ua)) name = 'Android';
  else if (/Windows/.test(ua)) name = 'Windows PC';
  else name = 'Web Browser';
  localStorage.setItem(SYNC_V4_DEVICE_NAME_KEY, name);
  return name;
}

function _getV4BasePath() {
  if (!firebaseUser) return null;
  return SYNC_V4_NAMESPACE + '/' + firebaseUser.uid;
}

function _registerDevice() {
  var db = getDB();
  var basePath = _getV4BasePath();
  if (!db || !basePath) return;
  var deviceId = _getDeviceId();
  var deviceName = _getDeviceName();
  var update = {};
  update['devices.' + deviceId] = {
    name: deviceName,
    lastSeen: Date.now(),
    appVersion: ROWEOS_VERSION
  };
  db.doc(basePath + '/_meta/config').set(update, { merge: true }).catch(function(err) {
    console.error('[SyncV4] Failed to register device:', err.message);
  });
}
```

- [ ] **Step 2: Verify in browser console**

Deploy, open roweos.com, run in console:
```javascript
_getDeviceId()  // should return something like "mac_a1b2c3d4"
_getDeviceName() // should return "MacBook" or similar
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v28.0: Add device registry and v4 namespace constants"
```

---

### Task 2: Sync Engine -- Write Path

**Files:**
- Modify: `RoweOS/dist/index.html` (JS section, after Task 1 code)

- [ ] **Step 1: Add the syncEngine object with write method**

```javascript
// v28.0: ═══════════════════════════════════════════════════════
// SYNC ENGINE v4.0 -- Core Write/Read/Delete
// ═══════════════════════════════════════════════════════════════

var syncEngine = {
  // Merge type constants
  MERGE_AUTO: 'auto',       // last-write-wins + notification
  MERGE_CONFLICT: 'conflict', // side-by-side review for high-value fields
  MERGE_APPEND: 'append',   // always-append, never conflict

  // Collection merge type registry
  _mergeTypes: {
    brands: 'conflict',
    brand_settings: 'auto',
    life_profiles: 'conflict',
    life_settings: 'auto',
    todos: 'append',
    calendar: 'append',
    automations: 'auto',
    reminders: 'append',
    conversations: 'conflict',
    agent_history: 'auto',
    clients: 'conflict',
    inventory: 'auto',
    knowledge: 'conflict',
    folio: 'auto',
    runs: 'auto',
    logos: 'auto',
    social_tokens: 'auto',
    social_activity: 'append',
    social_posts: 'auto',
    social_workflows: 'auto',
    scavenger_configs: 'auto',
    scavenger_targets: 'auto',
    settings: 'auto',
    library: 'auto',
    pulse: 'auto',
    conflicts: 'auto'
  },

  // Offline queue (in localStorage)
  _queueKey: 'roweos_v4_sync_queue',

  // v28.0: Is v4 migration completed?
  isV4Active: function() {
    return localStorage.getItem('roweos_v4_migrated') === 'true';
  },

  // v28.0: Build _fieldMeta for changed fields
  _buildFieldMeta: function(fields) {
    var meta = {};
    var now = Date.now();
    var deviceId = _getDeviceId();
    var keys = Object.keys(fields);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.charAt(0) === '_') continue; // skip internal fields
      meta[k] = { at: now, by: deviceId };
    }
    return meta;
  },

  // v28.0: Stamp standard fields on a document
  _stampDoc: function(doc, isCreate) {
    var now = Date.now();
    doc._modifiedAt = now;
    doc._deviceId = _getDeviceId();
    if (isCreate) {
      doc._createdAt = doc._createdAt || now;
      doc._version = 1;
    } else {
      doc._version = (doc._version || 0) + 1;
    }
    return doc;
  },

  // ─── WRITE ────────────────────────────────────────────────
  // collection: string (e.g., 'brands', 'todos')
  // docId: string (stable ID)
  // fields: object of fields to write (partial update)
  // options: { merge: bool, localStorageKey: string, isCreate: bool }
  write: function(collection, docId, fields, options) {
    options = options || {};
    var isCreate = !!options.isCreate;

    // 1. Stamp fields
    var now = Date.now();
    fields._modifiedAt = now;
    fields._deviceId = _getDeviceId();
    if (isCreate) {
      fields._createdAt = fields._createdAt || now;
      fields._version = 1;
      fields.id = fields.id || docId;
    } else {
      fields._version = (fields._version || 0) + 1;
    }

    // 2. Build field meta for changed fields
    var newMeta = syncEngine._buildFieldMeta(fields);

    // 3. Apply to localStorage immediately (optimistic)
    if (options.localStorageKey) {
      try {
        var localData = JSON.parse(localStorage.getItem(options.localStorageKey) || '{}');
        if (Array.isArray(localData)) {
          // Array storage (todos, calendar, etc.) -- find by id and update
          var found = false;
          for (var i = 0; i < localData.length; i++) {
            if (localData[i].id === docId) {
              var keys = Object.keys(fields);
              for (var j = 0; j < keys.length; j++) {
                localData[i][keys[j]] = fields[keys[j]];
              }
              localData[i]._fieldMeta = localData[i]._fieldMeta || {};
              var metaKeys = Object.keys(newMeta);
              for (var m = 0; m < metaKeys.length; m++) {
                localData[i]._fieldMeta[metaKeys[m]] = newMeta[metaKeys[m]];
              }
              found = true;
              break;
            }
          }
          if (!found && isCreate) {
            fields._fieldMeta = newMeta;
            localData.push(fields);
          }
          localStorage.setItem(options.localStorageKey, JSON.stringify(localData));
        } else {
          // Object storage (settings, brand_settings, etc.)
          var oKeys = Object.keys(fields);
          for (var k = 0; k < oKeys.length; k++) {
            localData[oKeys[k]] = fields[oKeys[k]];
          }
          localData._fieldMeta = localData._fieldMeta || {};
          var omKeys = Object.keys(newMeta);
          for (var om = 0; om < omKeys.length; om++) {
            localData._fieldMeta[omKeys[om]] = newMeta[omKeys[om]];
          }
          localStorage.setItem(options.localStorageKey, JSON.stringify(localData));
        }
      } catch (e) {
        console.error('[SyncV4] localStorage write failed:', e.message);
      }
    }

    // 4. Queue operation
    var op = {
      id: 'op_' + now + '_' + Math.random().toString(36).substring(2, 6),
      collection: collection,
      docId: docId,
      operation: isCreate ? 'create' : 'update',
      fields: fields,
      fieldMeta: newMeta,
      status: 'pending',
      createdAt: now,
      deviceId: _getDeviceId(),
      retryCount: 0
    };
    syncEngine._enqueue(op);

    // 5. Flush if online
    if (navigator.onLine) {
      syncEngine._flush();
    }

    stampLocalSave();
  },

  // ─── DELETE ───────────────────────────────────────────────
  delete: function(collection, docId, options) {
    options = options || {};
    var now = Date.now();

    // Remove from localStorage
    if (options.localStorageKey) {
      try {
        var localData = JSON.parse(localStorage.getItem(options.localStorageKey) || '[]');
        if (Array.isArray(localData)) {
          localData = localData.filter(function(item) { return item.id !== docId; });
          localStorage.setItem(options.localStorageKey, JSON.stringify(localData));
        }
      } catch (e) {}
    }

    // Queue delete operation
    var op = {
      id: 'op_' + now + '_' + Math.random().toString(36).substring(2, 6),
      collection: collection,
      docId: docId,
      operation: 'delete',
      fields: {},
      fieldMeta: {},
      status: 'pending',
      createdAt: now,
      deviceId: _getDeviceId(),
      retryCount: 0
    };
    syncEngine._enqueue(op);

    if (navigator.onLine) {
      syncEngine._flush();
    }

    stampLocalSave();
  },

  // ─── QUEUE MANAGEMENT ─────────────────────────────────────
  _enqueue: function(op) {
    var queue = [];
    try { queue = JSON.parse(localStorage.getItem(syncEngine._queueKey) || '[]'); } catch (e) {}

    // Dedup: if same collection+docId+field exists as pending, replace with latest
    if (op.operation === 'update') {
      var dominated = false;
      for (var i = queue.length - 1; i >= 0; i--) {
        if (queue[i].collection === op.collection && queue[i].docId === op.docId && queue[i].status === 'pending' && queue[i].operation === 'update') {
          // Merge fields into existing op
          var fk = Object.keys(op.fields);
          for (var j = 0; j < fk.length; j++) {
            queue[i].fields[fk[j]] = op.fields[fk[j]];
          }
          var mk = Object.keys(op.fieldMeta);
          for (var m = 0; m < mk.length; m++) {
            queue[i].fieldMeta[mk[m]] = op.fieldMeta[mk[m]];
          }
          queue[i].createdAt = op.createdAt;
          dominated = true;
          break;
        }
      }
      if (!dominated) {
        queue.push(op);
      }
    } else {
      queue.push(op);
    }

    // Cap at 1000 entries
    if (queue.length > 1000) {
      queue = queue.slice(queue.length - 1000);
    }

    try { localStorage.setItem(syncEngine._queueKey, JSON.stringify(queue)); } catch (e) {}
  },

  _flush: function() {
    if (syncEngine._flushing) return;
    syncEngine._flushing = true;

    var db = getDB();
    var basePath = _getV4BasePath();
    if (!db || !basePath) {
      syncEngine._flushing = false;
      return;
    }

    var queue = [];
    try { queue = JSON.parse(localStorage.getItem(syncEngine._queueKey) || '[]'); } catch (e) {}

    var pending = queue.filter(function(op) { return op.status === 'pending'; });
    if (pending.length === 0) {
      syncEngine._flushing = false;
      return;
    }

    updateSyncIndicator('syncing');

    // Process one at a time in order
    var idx = 0;
    function processNext() {
      if (idx >= pending.length) {
        syncEngine._flushing = false;
        updateSyncIndicator('synced');
        // Clean confirmed ops from queue
        var cleaned = queue.filter(function(op) { return op.status !== 'confirmed'; });
        try { localStorage.setItem(syncEngine._queueKey, JSON.stringify(cleaned)); } catch (e) {}
        return;
      }

      var op = pending[idx];
      var docRef = db.doc(basePath + '/' + op.collection + '/' + op.docId);

      var promise;
      if (op.operation === 'delete') {
        promise = docRef.delete();
      } else {
        // Build Firestore data with nested _fieldMeta update
        var data = JSON.parse(JSON.stringify(op.fields));
        var metaKeys = Object.keys(op.fieldMeta);
        for (var m = 0; m < metaKeys.length; m++) {
          data['_fieldMeta.' + metaKeys[m]] = op.fieldMeta[metaKeys[m]];
        }
        promise = docRef.set(data, { merge: true });
      }

      promise.then(function() {
        op.status = 'confirmed';
        idx++;
        processNext();
      }).catch(function(err) {
        console.error('[SyncV4] Flush failed for', op.collection + '/' + op.docId, ':', err.message);
        op.retryCount++;
        if (op.retryCount >= 3) {
          op.status = 'error';
          console.error('[SyncV4] Operation moved to error state after 3 retries:', op.id);
        }
        // Save queue state and stop flushing (will retry later)
        try { localStorage.setItem(syncEngine._queueKey, JSON.stringify(queue)); } catch (e) {}
        syncEngine._flushing = false;
        updateSyncIndicator('error');
        // Retry after backoff
        var backoff = Math.min(1000 * Math.pow(2, op.retryCount), 8000);
        setTimeout(function() { syncEngine._flush(); }, backoff);
      });
    }

    processNext();
  },

  // ─── ONLINE/OFFLINE HANDLING ──────────────────────────────
  _setupConnectivity: function() {
    window.addEventListener('online', function() {
      console.log('[SyncV4] Back online -- flushing queue');
      syncEngine._flush();
    });
    window.addEventListener('offline', function() {
      console.log('[SyncV4] Gone offline -- writes will queue');
      updateSyncIndicator('offline');
    });
  },

  // ─── QUEUE STATUS ─────────────────────────────────────────
  getQueueStatus: function() {
    var queue = [];
    try { queue = JSON.parse(localStorage.getItem(syncEngine._queueKey) || '[]'); } catch (e) {}
    var pending = 0;
    var errors = 0;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].status === 'pending') pending++;
      if (queue[i].status === 'error') errors++;
    }
    return { pending: pending, errors: errors, total: queue.length };
  }
};
```

- [ ] **Step 2: Verify syncEngine exists in console**

Deploy, open roweos.com, run:
```javascript
typeof syncEngine          // "object"
typeof syncEngine.write    // "function"
syncEngine.getQueueStatus() // {pending: 0, errors: 0, total: 0}
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v28.0: Add syncEngine core with write, delete, queue, connectivity"
```

---

### Task 3: Sync Engine -- Field-Level Merge

**Files:**
- Modify: `RoweOS/dist/index.html` (add to syncEngine object)

- [ ] **Step 1: Add field merge and conflict detection methods to syncEngine**

Add these methods inside the `syncEngine` object, after `getQueueStatus`:

```javascript
  // ─── FIELD-LEVEL MERGE ────────────────────────────────────
  // Merges a cloud document with local data using _fieldMeta timestamps.
  // Returns: { merged: object, conflicts: array, notifications: array }
  fieldMerge: function(collection, docId, cloudDoc, localDoc) {
    var mergeType = syncEngine._mergeTypes[collection] || 'auto';
    var conflicts = [];
    var notifications = [];
    var merged = JSON.parse(JSON.stringify(cloudDoc)); // start with cloud as base
    var cloudMeta = cloudDoc._fieldMeta || {};
    var localMeta = localDoc._fieldMeta || {};
    var lastSync = 0;
    try { lastSync = parseInt(localStorage.getItem('roweos_v4_last_sync') || '0'); } catch (e) {}

    // Get all fields from both docs
    var allFields = {};
    var ck = Object.keys(cloudDoc);
    for (var ci = 0; ci < ck.length; ci++) allFields[ck[ci]] = true;
    var lk = Object.keys(localDoc);
    for (var li = 0; li < lk.length; li++) allFields[lk[li]] = true;

    var fieldNames = Object.keys(allFields);
    for (var i = 0; i < fieldNames.length; i++) {
      var field = fieldNames[i];
      // Skip internal fields
      if (field === '_fieldMeta' || field === '_modifiedAt' || field === '_createdAt' ||
          field === '_deviceId' || field === '_version' || field === 'id') continue;

      var cloudFieldTs = (cloudMeta[field] && cloudMeta[field].at) ? _normalizeTs(cloudMeta[field].at) : 0;
      var localFieldTs = (localMeta[field] && localMeta[field].at) ? _normalizeTs(localMeta[field].at) : 0;
      var cloudVal = cloudDoc[field];
      var localVal = localDoc[field];

      // Same value -- no conflict
      if (JSON.stringify(cloudVal) === JSON.stringify(localVal)) {
        continue;
      }

      // Only cloud changed (local hasn't changed since last sync)
      if (cloudFieldTs > lastSync && localFieldTs <= lastSync) {
        merged[field] = cloudVal;
        continue;
      }

      // Only local changed
      if (localFieldTs > lastSync && cloudFieldTs <= lastSync) {
        merged[field] = localVal;
        merged._fieldMeta = merged._fieldMeta || {};
        merged._fieldMeta[field] = localMeta[field];
        continue;
      }

      // Both changed -- conflict!
      if (mergeType === 'conflict') {
        // Create conflict entry
        conflicts.push({
          id: 'conflict_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          collection: collection,
          docId: docId,
          field: field,
          localValue: localVal,
          localDevice: localMeta[field] ? localMeta[field].by : _getDeviceId(),
          localDeviceName: _getDeviceName(),
          localTimestamp: localFieldTs,
          cloudValue: cloudVal,
          cloudDevice: cloudMeta[field] ? cloudMeta[field].by : 'unknown',
          cloudDeviceName: 'Other Device',
          cloudTimestamp: cloudFieldTs,
          status: 'pending',
          resolvedAt: null,
          resolvedChoice: null,
          createdAt: Date.now()
        });
        // Keep cloud value as active until resolved
        merged[field] = cloudVal;
      } else {
        // Auto-merge: latest timestamp wins
        if (localFieldTs >= cloudFieldTs) {
          merged[field] = localVal;
          merged._fieldMeta = merged._fieldMeta || {};
          merged._fieldMeta[field] = localMeta[field];
        } else {
          merged[field] = cloudVal;
        }
        // Notify user of auto-merge
        notifications.push({
          field: field,
          collection: collection,
          docId: docId,
          winner: localFieldTs >= cloudFieldTs ? 'local' : 'cloud'
        });
      }
    }

    return { merged: merged, conflicts: conflicts, notifications: notifications };
  },

  // ─── CONFLICT MANAGEMENT ──────────────────────────────────
  _saveConflicts: function(conflicts) {
    if (!conflicts || conflicts.length === 0) return;
    var db = getDB();
    var basePath = _getV4BasePath();
    if (!db || !basePath) return;

    var batch = db.batch();
    for (var i = 0; i < conflicts.length; i++) {
      var c = conflicts[i];
      batch.set(db.doc(basePath + '/conflicts/' + c.id), c);
    }
    batch.commit().then(function() {
      console.log('[SyncV4] Saved', conflicts.length, 'conflicts');
      // Show toast
      if (typeof showToast === 'function') {
        showToast(conflicts.length + ' sync conflict' + (conflicts.length > 1 ? 's' : '') + ' need' + (conflicts.length > 1 ? '' : 's') + ' review', 'warning');
      }
    }).catch(function(err) {
      console.error('[SyncV4] Failed to save conflicts:', err.message);
    });

    // Also save to localStorage for offline access
    var existing = [];
    try { existing = JSON.parse(localStorage.getItem('roweos_v4_conflicts') || '[]'); } catch (e) {}
    for (var j = 0; j < conflicts.length; j++) {
      existing.push(conflicts[j]);
    }
    try { localStorage.setItem('roweos_v4_conflicts', JSON.stringify(existing)); } catch (e) {}
  },

  resolveConflict: function(conflictId, choice) {
    // choice: 'local' | 'cloud' | 'both'
    var conflicts = [];
    try { conflicts = JSON.parse(localStorage.getItem('roweos_v4_conflicts') || '[]'); } catch (e) {}

    var conflict = null;
    for (var i = 0; i < conflicts.length; i++) {
      if (conflicts[i].id === conflictId) {
        conflict = conflicts[i];
        break;
      }
    }
    if (!conflict) return;

    // Apply the chosen value
    var value;
    if (choice === 'local') {
      value = conflict.localValue;
    } else if (choice === 'cloud') {
      value = conflict.cloudValue;
    } else {
      // 'both' -- for strings, concatenate; for other types, keep cloud
      if (typeof conflict.localValue === 'string' && typeof conflict.cloudValue === 'string') {
        value = conflict.cloudValue + '\n---\n' + conflict.localValue;
      } else {
        value = conflict.cloudValue;
      }
    }

    // Write the resolved value
    var fields = {};
    fields[conflict.field] = value;
    syncEngine.write(conflict.collection, conflict.docId, fields);

    // Mark resolved
    conflict.status = 'resolved';
    conflict.resolvedAt = Date.now();
    conflict.resolvedChoice = choice;

    // Update localStorage
    try { localStorage.setItem('roweos_v4_conflicts', JSON.stringify(conflicts)); } catch (e) {}

    // Update Firestore
    var db = getDB();
    var basePath = _getV4BasePath();
    if (db && basePath) {
      db.doc(basePath + '/conflicts/' + conflictId).update({
        status: 'resolved',
        resolvedAt: Date.now(),
        resolvedChoice: choice
      });
    }
  },

  getPendingConflicts: function() {
    var conflicts = [];
    try { conflicts = JSON.parse(localStorage.getItem('roweos_v4_conflicts') || '[]'); } catch (e) {}
    return conflicts.filter(function(c) { return c.status === 'pending'; });
  },

  resolveAllKeepNewest: function() {
    var pending = syncEngine.getPendingConflicts();
    for (var i = 0; i < pending.length; i++) {
      var choice = pending[i].cloudTimestamp >= pending[i].localTimestamp ? 'cloud' : 'local';
      syncEngine.resolveConflict(pending[i].id, choice);
    }
  }
```

- [ ] **Step 2: Verify in console**

```javascript
typeof syncEngine.fieldMerge    // "function"
typeof syncEngine.resolveConflict // "function"
syncEngine.getPendingConflicts()  // []
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v28.0: Add field-level merge and conflict resolution to syncEngine"
```

---

### Task 4: Sync Engine -- Unified Listeners

**Files:**
- Modify: `RoweOS/dist/index.html` (add to syncEngine object)

- [ ] **Step 1: Add watchCollection and watchDoc methods**

Add to syncEngine object:

```javascript
  // ─── REAL-TIME LISTENERS ──────────────────────────────────
  _unsubscribers: [],

  watchCollection: function(collectionName, localStorageKey) {
    var db = getDB();
    var basePath = _getV4BasePath();
    if (!db || !basePath) return;
    var mergeType = syncEngine._mergeTypes[collectionName] || 'auto';

    var unsub = db.collection(basePath + '/' + collectionName).onSnapshot(function(snapshot) {
      if (snapshot.metadata.hasPendingWrites) return;
      if (typeof lastLocalSaveTime !== 'undefined' && Date.now() - lastLocalSaveTime < 5000) return;

      snapshot.docChanges().forEach(function(change) {
        var docData = change.doc.data();
        var docId = change.doc.id;

        if (change.type === 'removed') {
          // Remove from localStorage
          try {
            var localArr = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
            if (Array.isArray(localArr)) {
              localArr = localArr.filter(function(item) { return item.id !== docId; });
              localStorage.setItem(localStorageKey, JSON.stringify(localArr));
            }
          } catch (e) {}
          return;
        }

        // Added or modified
        try {
          var localArr = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
          if (!Array.isArray(localArr)) return;

          var localDoc = null;
          var localIdx = -1;
          for (var i = 0; i < localArr.length; i++) {
            if (localArr[i].id === docId) {
              localDoc = localArr[i];
              localIdx = i;
              break;
            }
          }

          if (mergeType === 'append' && change.type === 'added' && !localDoc) {
            // Append: new item from another device, just add it
            localArr.push(docData);
            localStorage.setItem(localStorageKey, JSON.stringify(localArr));
            return;
          }

          if (localDoc) {
            // Merge with existing local doc
            var result = syncEngine.fieldMerge(collectionName, docId, docData, localDoc);
            localArr[localIdx] = result.merged;
            localStorage.setItem(localStorageKey, JSON.stringify(localArr));

            if (result.conflicts.length > 0) {
              syncEngine._saveConflicts(result.conflicts);
            }
          } else {
            // New doc, just add
            localArr.push(docData);
            localStorage.setItem(localStorageKey, JSON.stringify(localArr));
          }
        } catch (e) {
          console.error('[SyncV4] watchCollection error for', collectionName, ':', e.message);
        }
      });

      localStorage.setItem('roweos_v4_last_sync', String(Date.now()));
      updateSyncIndicator('synced');
    }, function(err) {
      console.error('[SyncV4] Listener error for', collectionName, ':', err.message);
    });

    syncEngine._unsubscribers.push(unsub);
  },

  watchDoc: function(docPath, localStorageKey, mergeTypeOverride) {
    var db = getDB();
    var basePath = _getV4BasePath();
    if (!db || !basePath) return;
    var parts = docPath.split('/');
    var collectionName = parts[0];
    var mergeType = mergeTypeOverride || syncEngine._mergeTypes[collectionName] || 'auto';

    var unsub = db.doc(basePath + '/' + docPath).onSnapshot(function(doc) {
      if (doc.metadata.hasPendingWrites) return;
      if (typeof lastLocalSaveTime !== 'undefined' && Date.now() - lastLocalSaveTime < 5000) return;
      if (!doc.exists) return;

      var cloudDoc = doc.data();
      try {
        var localDoc = JSON.parse(localStorage.getItem(localStorageKey) || '{}');
        var result = syncEngine.fieldMerge(collectionName, doc.id, cloudDoc, localDoc);
        localStorage.setItem(localStorageKey, JSON.stringify(result.merged));

        if (result.conflicts.length > 0) {
          syncEngine._saveConflicts(result.conflicts);
        }
      } catch (e) {
        console.error('[SyncV4] watchDoc error for', docPath, ':', e.message);
      }

      localStorage.setItem('roweos_v4_last_sync', String(Date.now()));
      updateSyncIndicator('synced');
    }, function(err) {
      console.error('[SyncV4] Listener error for', docPath, ':', err.message);
    });

    syncEngine._unsubscribers.push(unsub);
  },

  // Setup all v4 listeners
  setupListeners: function() {
    if (!syncEngine.isV4Active()) return;

    // Per-item collections
    syncEngine.watchCollection('brands', 'roweos_user_brands');
    syncEngine.watchCollection('todos', 'roweosTodos');
    syncEngine.watchCollection('calendar', 'roweosCalendar');
    syncEngine.watchCollection('automations', 'roweos_automations');
    syncEngine.watchCollection('life_profiles', 'roweos_life_profiles');
    syncEngine.watchCollection('clients', 'roweos_clients');
    syncEngine.watchCollection('reminders', 'roweos_reminders');
    syncEngine.watchCollection('knowledge', 'roweos_user_knowledge');
    syncEngine.watchCollection('runs', 'roweos_runs');

    // Single-doc stores
    syncEngine.watchDoc('settings/main', 'roweos_v4_settings');
    syncEngine.watchDoc('brand_settings/main', 'roweos_user_brand_settings');
    syncEngine.watchDoc('life_settings/main', 'roweos_v4_life_settings');
    syncEngine.watchDoc('pulse/goals', 'roweos_pulse_goals');
    syncEngine.watchDoc('pulse/reminders', 'roweos_reminders');
    syncEngine.watchDoc('library/brand', 'roweos_user_library');
    syncEngine.watchDoc('library/life', 'roweos_life_library');
    syncEngine.watchDoc('social_posts/main', 'roweos_social_posts');
    syncEngine.watchDoc('folio/main', 'roweos_folio_items');

    console.log('[SyncV4] All listeners active');
  },

  // Tear down all listeners
  teardownListeners: function() {
    for (var i = 0; i < syncEngine._unsubscribers.length; i++) {
      if (typeof syncEngine._unsubscribers[i] === 'function') {
        syncEngine._unsubscribers[i]();
      }
    }
    syncEngine._unsubscribers = [];
    console.log('[SyncV4] All listeners torn down');
  }
```

- [ ] **Step 2: Verify**

```javascript
typeof syncEngine.watchCollection  // "function"
typeof syncEngine.setupListeners   // "function"
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v28.0: Add unified real-time listeners to syncEngine"
```

---

### Task 5: Migration Engine

**Files:**
- Modify: `RoweOS/dist/index.html` (add after syncEngine)

This is the largest single task. The migration function reads every subcollection from the old namespace and writes to v4.

- [ ] **Step 1: Add migration engine**

Add after the syncEngine object:

```javascript
// v28.0: ═══════════════════════════════════════════════════════
// MIGRATION ENGINE -- Old namespace to v4
// ═══════════════════════════════════════════════════════════════

var migrationEngine = {
  _progress: {},
  _errors: [],
  _onProgress: null, // callback: function(collection, current, total)

  // Check if migration is needed
  needsMigration: function() {
    return localStorage.getItem('roweos_v4_migrated') !== 'true';
  },

  // Run full migration
  run: function(onProgress) {
    migrationEngine._onProgress = onProgress || function() {};
    migrationEngine._errors = [];

    var db = getDB();
    if (!db || !firebaseUser) {
      return Promise.reject(new Error('Not signed in'));
    }

    var uid = firebaseUser.uid;
    var oldBase = 'roweos_users/' + uid;
    var newBase = SYNC_V4_NAMESPACE + '/' + uid;

    console.log('[Migration] Starting v4 migration for user:', uid);

    // Step 1: Save localStorage backup
    try {
      var backup = {};
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('roweos') === 0) {
          backup[key] = localStorage.getItem(key);
        }
      }
      localStorage.setItem('roweos_v4_pre_migration_backup', JSON.stringify(backup));
      console.log('[Migration] localStorage backup saved:', Object.keys(backup).length, 'keys');
    } catch (e) {
      console.warn('[Migration] localStorage backup failed (non-fatal):', e.message);
    }

    // Step 2: Register device
    _registerDevice();

    // Step 3: Read ALL old data
    migrationEngine._onProgress('Reading old data', 0, 1);
    return migrationEngine._readAllOldData(db, oldBase).then(function(oldData) {
      console.log('[Migration] Read complete. Collections:', Object.keys(oldData).length);

      // Step 4: Save Firestore backup
      migrationEngine._onProgress('Backing up', 0, 1);
      return migrationEngine._saveFirestoreBackup(db, newBase, oldData).then(function() {
        // Step 5: Transform and write
        return migrationEngine._transformAndWrite(db, newBase, oldData);
      });
    }).then(function() {
      // Step 6: Verify
      migrationEngine._onProgress('Verifying', 0, 1);
      return migrationEngine._verify(db, newBase);
    }).then(function(verified) {
      if (!verified) {
        throw new Error('Verification failed -- check console for details');
      }
      // Step 7: Mark complete
      localStorage.setItem('roweos_v4_migrated', 'true');
      localStorage.setItem('roweos_v4_migration_timestamp', String(Date.now()));
      return db.doc(newBase + '/_meta/config').set({
        migrationCompleted: true,
        migrationTimestamp: Date.now(),
        schemaVersion: 4,
        migratedFrom: 'roweos_users',
        migratedBy: _getDeviceId()
      }, { merge: true });
    }).then(function() {
      console.log('[Migration] ===== MIGRATION COMPLETE =====');
      migrationEngine._onProgress('Complete', 1, 1);
    }).catch(function(err) {
      console.error('[Migration] MIGRATION FAILED:', err.message);
      migrationEngine._errors.push(err.message);
      localStorage.removeItem('roweos_v4_migrated');
      throw err;
    });
  },

  _readAllOldData: function(db, oldBase) {
    // Read every subcollection in parallel
    return Promise.all([
      db.collection(oldBase + '/brands').get(),
      db.doc(oldBase + '/profile/main').get(),
      db.doc(oldBase + '/profile/generatedBrandOps').get(),
      db.doc(oldBase + '/profile/userContact').get(),
      db.doc(oldBase + '/profile/clients').get(),
      db.doc(oldBase + '/profile/customAgents').get(),
      db.doc(oldBase + '/profile/customOps').get(),
      db.doc(oldBase + '/profile/socialPosts').get(),
      db.doc(oldBase + '/profile/socialWorkflows').get(),
      db.doc(oldBase + '/profile/notifications').get(),
      db.doc(oldBase + '/profile/bloomLibrary').get(),
      db.doc(oldBase + '/profile/researchHistory').get(),
      db.doc(oldBase + '/profile/logos').get(),
      db.doc(oldBase + '/profile/mail').get(),
      db.doc(oldBase + '/profile/people').get(),
      db.doc(oldBase + '/profile/reminders').get(),
      db.doc(oldBase + '/profile/inventory').get(),
      db.doc(oldBase + '/lifeAI/main').get(),
      db.doc(oldBase + '/lifeAI/possessions').get(),
      db.collection(oldBase + '/todos').get(),
      db.collection(oldBase + '/calendar').get(),
      db.collection(oldBase + '/automations').get(),
      db.doc(oldBase + '/conversations/current').get(),
      db.doc(oldBase + '/conversations/history').get(),
      db.doc(oldBase + '/conversations/agentHistory').get(),
      db.doc(oldBase + '/pulse/main').get(),
      db.doc(oldBase + '/library/brand').get(),
      db.doc(oldBase + '/library/life').get(),
      db.doc(oldBase + '/folio/main').get(),
      db.collection(oldBase + '/runs').get(),
      db.collection(oldBase + '/inventory').get(),
      db.collection(oldBase + '/logos').get(),
      db.collection(oldBase + '/knowledge').get(),
      db.collection(oldBase + '/social_tokens').get(),
      db.collection(oldBase + '/social_activity').get(),
      db.collection(oldBase + '/scavenger_configs').get(),
      db.collection(oldBase + '/scavenger_targets').get(),
      db.doc(oldBase + '/secure/api_keys').get(),
      db.collection(oldBase + '/push_subscriptions').get(),
      db.collection(oldBase + '/visual_assets').get(),
      db.collection(oldBase + '/cloud_outbox').get()
    ]).then(function(results) {
      return {
        brandsSnap: results[0],
        profileMain: results[1].exists ? results[1].data() : {},
        generatedBrandOps: results[2].exists ? results[2].data() : null,
        userContact: results[3].exists ? results[3].data() : null,
        clients: results[4].exists ? results[4].data() : null,
        customAgents: results[5].exists ? results[5].data() : null,
        customOps: results[6].exists ? results[6].data() : null,
        socialPosts: results[7].exists ? results[7].data() : null,
        socialWorkflows: results[8].exists ? results[8].data() : null,
        notifications: results[9].exists ? results[9].data() : null,
        bloomLibrary: results[10].exists ? results[10].data() : null,
        researchHistory: results[11].exists ? results[11].data() : null,
        profileLogos: results[12].exists ? results[12].data() : null,
        mail: results[13].exists ? results[13].data() : null,
        people: results[14].exists ? results[14].data() : null,
        profileReminders: results[15].exists ? results[15].data() : null,
        profileInventory: results[16].exists ? results[16].data() : null,
        lifeAIMain: results[17].exists ? results[17].data() : {},
        lifeAIPossessions: results[18].exists ? results[18].data() : null,
        todosSnap: results[19],
        calendarSnap: results[20],
        automationsSnap: results[21],
        convCurrent: results[22].exists ? results[22].data() : null,
        convHistory: results[23].exists ? results[23].data() : null,
        convAgentHistory: results[24].exists ? results[24].data() : null,
        pulseMain: results[25].exists ? results[25].data() : null,
        libraryBrand: results[26].exists ? results[26].data() : null,
        libraryLife: results[27].exists ? results[27].data() : null,
        folioMain: results[28].exists ? results[28].data() : null,
        runsSnap: results[29],
        inventorySnap: results[30],
        logosSnap: results[31],
        knowledgeSnap: results[32],
        socialTokensSnap: results[33],
        socialActivitySnap: results[34],
        scavengerConfigsSnap: results[35],
        scavengerTargetsSnap: results[36],
        secureApiKeys: results[37].exists ? results[37].data() : null,
        pushSubscriptionsSnap: results[38],
        visualAssetsSnap: results[39],
        cloudOutboxSnap: results[40]
      };
    });
  },

  _addStandardFields: function(doc, existingId) {
    var now = Date.now();
    doc.id = doc.id || existingId || ('doc_' + now + '_' + Math.random().toString(36).substring(2, 6));
    doc._modifiedAt = _normalizeTs(doc._modifiedAt) || now;
    doc._createdAt = _normalizeTs(doc._createdAt) || _normalizeTs(doc.createdAt) || now;
    doc._deviceId = doc._deviceId || _getDeviceId();
    doc._version = doc._version || 1;
    // Build _fieldMeta from current state
    if (!doc._fieldMeta) {
      doc._fieldMeta = {};
      var keys = Object.keys(doc);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].charAt(0) !== '_' && keys[i] !== 'id') {
          doc._fieldMeta[keys[i]] = { at: doc._modifiedAt, by: doc._deviceId };
        }
      }
    }
    return doc;
  },

  _saveFirestoreBackup: function(db, newBase, oldData) {
    // Save a summary (full data may exceed 1MB doc limit)
    var summary = {
      timestamp: Date.now(),
      brandCount: 0,
      collections: []
    };
    if (oldData.brandsSnap) summary.brandCount = oldData.brandsSnap.size;
    summary.collections = Object.keys(oldData);
    return db.doc(newBase + '/_meta/pre_migration_backup').set(summary).catch(function(err) {
      console.warn('[Migration] Firestore backup write failed (non-fatal):', err.message);
    });
  },

  _transformAndWrite: function(db, newBase, oldData) {
    var steps = [];

    // ── BRANDS ──────────────────────────────────────────────
    steps.push(migrationEngine._migrateBrands(db, newBase, oldData));

    // ── SETTINGS (from profile/main god-doc) ────────────────
    steps.push(migrationEngine._migrateSettings(db, newBase, oldData));

    // ── BRAND SETTINGS ──────────────────────────────────────
    steps.push(migrationEngine._migrateBrandSettings(db, newBase, oldData));

    // ── LIFE PROFILES ───────────────────────────────────────
    steps.push(migrationEngine._migrateLifeProfiles(db, newBase, oldData));

    // ── LIFE SETTINGS ───────────────────────────────────────
    steps.push(migrationEngine._migrateLifeSettings(db, newBase, oldData));

    // ── TODOS ───────────────────────────────────────────────
    steps.push(migrationEngine._migrateTodos(db, newBase, oldData));

    // ── CALENDAR ────────────────────────────────────────────
    steps.push(migrationEngine._migrateCalendar(db, newBase, oldData));

    // ── AUTOMATIONS ─────────────────────────────────────────
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.automationsSnap, 'automations', 'Automations'));

    // ── CONVERSATIONS ───────────────────────────────────────
    steps.push(migrationEngine._migrateConversations(db, newBase, oldData));

    // ── PULSE ───────────────────────────────────────────────
    steps.push(migrationEngine._migratePulse(db, newBase, oldData));

    // ── LIBRARY ─────────────────────────────────────────────
    steps.push(migrationEngine._migrateLibrary(db, newBase, oldData));

    // ── FOLIO ───────────────────────────────────────────────
    steps.push(migrationEngine._migrateSingleDoc(db, newBase, oldData.folioMain, 'folio/main', 'Folio'));

    // ── CLIENTS ─────────────────────────────────────────────
    steps.push(migrationEngine._migrateClients(db, newBase, oldData));

    // ── DIRECT-COPY COLLECTIONS ─────────────────────────────
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.runsSnap, 'runs', 'Runs'));
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.inventorySnap, 'inventory', 'Inventory'));
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.logosSnap, 'logos', 'Logos'));
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.knowledgeSnap, 'knowledge', 'Knowledge'));
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.socialTokensSnap, 'social_tokens', 'Social Tokens'));
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.socialActivitySnap, 'social_activity', 'Social Activity'));
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.scavengerConfigsSnap, 'scavenger_configs', 'Scavenger Configs'));
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.scavengerTargetsSnap, 'scavenger_targets', 'Scavenger Targets'));

    // ── VISUAL ASSETS → LOGOS ───────────────────────────────
    steps.push(migrationEngine._migrateCollection(db, newBase, oldData.visualAssetsSnap, 'logos', 'Visual Assets'));

    // ── SECURE API KEYS ─────────────────────────────────────
    steps.push(migrationEngine._migrateSingleDoc(db, newBase, oldData.secureApiKeys, 'settings/api_keys', 'API Keys'));

    // ── MAIL ────────────────────────────────────────────────
    steps.push(migrationEngine._migrateSingleDoc(db, newBase, oldData.mail, 'settings/mail', 'Mail'));

    // ── SOCIAL ──────────────────────────────────────────────
    steps.push(migrationEngine._migrateSingleDoc(db, newBase, oldData.socialPosts, 'social_posts/main', 'Social Posts'));
    steps.push(migrationEngine._migrateSingleDoc(db, newBase, oldData.socialWorkflows, 'social_workflows/main', 'Social Workflows'));

    // ── NOTIFICATIONS ───────────────────────────────────────
    steps.push(migrationEngine._migrateSingleDoc(db, newBase, oldData.notifications, 'settings/notifications', 'Notifications'));

    // ── PUSH SUBSCRIPTIONS ──────────────────────────────────
    steps.push(migrationEngine._migratePushSubscriptions(db, newBase, oldData));

    // ── PEOPLE ──────────────────────────────────────────────
    steps.push(migrationEngine._migrateSingleDoc(db, newBase, oldData.people, 'settings/people', 'People'));

    return Promise.all(steps);
  },

  // ── Individual migration functions ────────────────────────

  _migrateBrands: function(db, newBase, oldData) {
    if (!oldData.brandsSnap || oldData.brandsSnap.empty) {
      migrationEngine._onProgress('Brands', 0, 0);
      return Promise.resolve();
    }
    var brands = [];
    var allDoc = null;
    oldData.brandsSnap.forEach(function(doc) {
      if (doc.id === '_all') { allDoc = doc.data(); }
      else { brands.push(doc.data()); }
    });
    // Prefer _all doc if available
    if (allDoc && allDoc.items && allDoc.items.length > 0) {
      brands = allDoc.items;
    }

    var batch = db.batch();
    var total = brands.length;
    for (var i = 0; i < brands.length; i++) {
      var brand = JSON.parse(JSON.stringify(brands[i]));
      var stableId = brand.id || ('brand_name_' + (brand.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'));
      brand.id = stableId;
      brand._modifiedAt = _normalizeTs(brand._modifiedAt) || Date.now();
      migrationEngine._addStandardFields(brand, stableId);
      // Attach generated ops if available
      if (oldData.generatedBrandOps && oldData.generatedBrandOps.data) {
        brand.generatedOps = oldData.generatedBrandOps.data;
      }
      batch.set(db.doc(newBase + '/brands/' + stableId), brand);
      migrationEngine._onProgress('Brands', i + 1, total);
    }
    return batch.commit().then(function() {
      console.log('[Migration] Brands:', total, 'migrated');
    });
  },

  _migrateSettings: function(db, newBase, oldData) {
    var profile = oldData.profileMain || {};
    var settings = {};

    // Extract settings fields from profile/main
    var settingsFields = [
      'customSidebar', 'pdfScheme', 'calendarColors', 'calendarVisibility',
      'calendarScope', 'defaultCalendar', 'todoCategories', 'bloomSignals',
      'bloomContentMode', 'bloomLibrary', 'bloomKnowledge', 'bloomDefaultSource',
      'automationMemory', 'autoLabTabOrder', 'socialConnected', 'socialOutbox',
      'pendingApproval', 'journal', 'guardrails', 'apiRouting', 'brandMemory',
      'brandKnowledge', 'promoFonts', 'modelTier', 'advancedMode', 'timeFormat',
      'sidebarOrder', 'blobShape', 'ambientColor', 'commerce', 'analyticsThreshold',
      'apiBudget', 'socialConnections', 'socialTokenUpdated'
    ];
    for (var i = 0; i < settingsFields.length; i++) {
      var key = settingsFields[i];
      if (profile[key] !== undefined) {
        settings[key] = profile[key];
      }
    }
    // Extract nested settings
    if (profile.settings) {
      settings.webSearchPrefs = profile.settings.webSearchPrefs;
      settings.claudeWebSearch = profile.settings.claudeWebSearch;
      settings.geminiWebSearch = profile.settings.geminiWebSearch;
    }
    // Add sub-doc data
    if (oldData.userContact) settings.userContact = oldData.userContact.data || oldData.userContact;
    if (oldData.customAgents) settings.customAgents = oldData.customAgents.data || oldData.customAgents;
    if (oldData.customOps) settings.customOps = oldData.customOps.data || oldData.customOps;
    if (oldData.researchHistory) settings.researchHistory = oldData.researchHistory.items || oldData.researchHistory;
    if (oldData.bloomLibrary) settings.bloomLibraryData = oldData.bloomLibrary;

    migrationEngine._addStandardFields(settings, 'main');
    migrationEngine._onProgress('Settings', 1, 1);

    return db.doc(newBase + '/settings/main').set(settings).then(function() {
      console.log('[Migration] Settings: migrated', Object.keys(settings).length, 'fields');
    });
  },

  _migrateBrandSettings: function(db, newBase, oldData) {
    var profile = oldData.profileMain || {};
    if (!profile.brandSettings) {
      migrationEngine._onProgress('Brand Settings', 0, 0);
      return Promise.resolve();
    }
    var bs = JSON.parse(JSON.stringify(profile.brandSettings));
    migrationEngine._addStandardFields(bs, 'main');
    migrationEngine._onProgress('Brand Settings', 1, 1);
    return db.doc(newBase + '/brand_settings/main').set(bs).then(function() {
      console.log('[Migration] Brand Settings: migrated');
    });
  },

  _migrateLifeProfiles: function(db, newBase, oldData) {
    var life = oldData.lifeAIMain || {};
    var profiles = life.profiles || [];
    if (profiles.length === 0) {
      migrationEngine._onProgress('Life Profiles', 0, 0);
      return Promise.resolve();
    }
    var batch = db.batch();
    var total = profiles.length;
    for (var i = 0; i < profiles.length; i++) {
      var profile = JSON.parse(JSON.stringify(profiles[i]));
      var pid = profile.id || ('life_' + Date.now() + '_' + i);
      profile.id = pid;
      migrationEngine._addStandardFields(profile, pid);
      batch.set(db.doc(newBase + '/life_profiles/' + pid), profile);
      migrationEngine._onProgress('Life Profiles', i + 1, total);
    }
    return batch.commit().then(function() {
      console.log('[Migration] Life Profiles:', total, 'migrated');
    });
  },

  _migrateLifeSettings: function(db, newBase, oldData) {
    var life = oldData.lifeAIMain || {};
    var settings = {};
    var lifeFields = [
      'currentProfileIdx', 'accentColor', 'accentDark', 'accentDarkMode',
      'accentDarkModeDark', 'accentLightMode', 'accentLightModeDark',
      'blobShape', 'blobSpikeMode', 'symbioteColor', 'appMode',
      'generatedOps', 'goals', 'habits', 'routines', 'rhythmPreferences',
      'rhythmWidgetConfig', 'mainSystemPrompt', 'memory', 'todos', 'userName',
      'agentCommands', '_deletedProfiles'
    ];
    for (var i = 0; i < lifeFields.length; i++) {
      if (life[lifeFields[i]] !== undefined) {
        settings[lifeFields[i]] = life[lifeFields[i]];
      }
    }
    migrationEngine._addStandardFields(settings, 'main');
    migrationEngine._onProgress('Life Settings', 1, 1);
    return db.doc(newBase + '/life_settings/main').set(settings).then(function() {
      console.log('[Migration] Life Settings: migrated', Object.keys(settings).length, 'fields');
    });
  },

  _migrateTodos: function(db, newBase, oldData) {
    var todos = [];
    // Try single-doc format first
    var mainDoc = null;
    if (oldData.todosSnap) {
      oldData.todosSnap.forEach(function(doc) {
        if (doc.id === 'main' && doc.data().data) {
          todos = doc.data().data;
        } else if (doc.id !== 'main') {
          todos.push(doc.data());
        }
      });
    }
    if (todos.length === 0) {
      migrationEngine._onProgress('Todos', 0, 0);
      return Promise.resolve();
    }
    var batch = db.batch();
    var total = todos.length;
    for (var i = 0; i < todos.length; i++) {
      var todo = JSON.parse(JSON.stringify(todos[i]));
      var tid = todo.id || ('todo_' + Date.now() + '_' + i);
      todo.id = String(tid);
      migrationEngine._addStandardFields(todo, String(tid));
      batch.set(db.doc(newBase + '/todos/' + String(tid)), todo);
      migrationEngine._onProgress('Todos', i + 1, total);
    }
    return batch.commit().then(function() {
      console.log('[Migration] Todos:', total, 'migrated');
    });
  },

  _migrateCalendar: function(db, newBase, oldData) {
    var events = [];
    if (oldData.calendarSnap) {
      oldData.calendarSnap.forEach(function(doc) {
        if (doc.id === 'main' && doc.data().data) {
          events = doc.data().data;
        } else if (doc.id !== 'main') {
          events.push(doc.data());
        }
      });
    }
    if (events.length === 0) {
      migrationEngine._onProgress('Calendar', 0, 0);
      return Promise.resolve();
    }
    // Firestore batch max is 500
    var batches = [];
    var currentBatch = db.batch();
    var count = 0;
    var total = events.length;
    for (var i = 0; i < events.length; i++) {
      var evt = JSON.parse(JSON.stringify(events[i]));
      var eid = evt.id || ('cal_' + Date.now() + '_' + i);
      evt.id = String(eid);
      migrationEngine._addStandardFields(evt, String(eid));
      currentBatch.set(db.doc(newBase + '/calendar/' + String(eid)), evt);
      count++;
      if (count >= 499) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch();
        count = 0;
      }
      migrationEngine._onProgress('Calendar', i + 1, total);
    }
    if (count > 0) batches.push(currentBatch.commit());
    return Promise.all(batches).then(function() {
      console.log('[Migration] Calendar:', total, 'migrated');
    });
  },

  _migrateConversations: function(db, newBase, oldData) {
    var writes = [];
    if (oldData.convCurrent) {
      var cc = JSON.parse(JSON.stringify(oldData.convCurrent));
      migrationEngine._addStandardFields(cc, 'current');
      writes.push(db.doc(newBase + '/conversations/current').set(cc));
    }
    if (oldData.convHistory) {
      var ch = JSON.parse(JSON.stringify(oldData.convHistory));
      // Parse JSON string if needed
      if (ch.json && typeof ch.json === 'string') {
        try { ch.data = JSON.parse(ch.json); delete ch.json; } catch (e) {}
      }
      migrationEngine._addStandardFields(ch, 'history');
      writes.push(db.doc(newBase + '/conversations/history').set(ch));
    }
    if (oldData.convAgentHistory) {
      var ah = JSON.parse(JSON.stringify(oldData.convAgentHistory));
      if (ah.json && typeof ah.json === 'string') {
        try { ah.data = JSON.parse(ah.json); delete ah.json; } catch (e) {}
      }
      migrationEngine._addStandardFields(ah, 'main');
      writes.push(db.doc(newBase + '/agent_history/main').set(ah));
    }
    migrationEngine._onProgress('Conversations', 1, 1);
    if (writes.length === 0) return Promise.resolve();
    return Promise.all(writes).then(function() {
      console.log('[Migration] Conversations:', writes.length, 'docs migrated');
    });
  },

  _migratePulse: function(db, newBase, oldData) {
    if (!oldData.pulseMain) {
      migrationEngine._onProgress('Pulse', 0, 0);
      return Promise.resolve();
    }
    var pulse = oldData.pulseMain;
    var writes = [];

    // Goals
    var goals = pulse.goals;
    if (typeof goals === 'string') { try { goals = JSON.parse(goals); } catch (e) { goals = []; } }
    var goalsDoc = { data: goals || [] };
    migrationEngine._addStandardFields(goalsDoc, 'goals');
    writes.push(db.doc(newBase + '/pulse/goals').set(goalsDoc));

    // Reminders
    var reminders = pulse.reminders;
    if (typeof reminders === 'string') { try { reminders = JSON.parse(reminders); } catch (e) { reminders = []; } }
    var remDoc = { data: reminders || [] };
    migrationEngine._addStandardFields(remDoc, 'reminders');
    writes.push(db.doc(newBase + '/pulse/reminders').set(remDoc));

    migrationEngine._onProgress('Pulse', 1, 1);
    return Promise.all(writes).then(function() {
      console.log('[Migration] Pulse: goals + reminders migrated');
    });
  },

  _migrateLibrary: function(db, newBase, oldData) {
    var writes = [];
    if (oldData.libraryBrand) {
      var lb = JSON.parse(JSON.stringify(oldData.libraryBrand));
      // Parse JSON string if stored that way
      if (lb.data && typeof lb.data === 'string') {
        try { lb.data = JSON.parse(lb.data); } catch (e) {}
      }
      migrationEngine._addStandardFields(lb, 'brand');
      writes.push(db.doc(newBase + '/library/brand').set(lb));
    }
    if (oldData.libraryLife) {
      var ll = JSON.parse(JSON.stringify(oldData.libraryLife));
      if (ll.data && typeof ll.data === 'string') {
        try { ll.data = JSON.parse(ll.data); } catch (e) {}
      }
      migrationEngine._addStandardFields(ll, 'life');
      writes.push(db.doc(newBase + '/library/life').set(ll));
    }
    migrationEngine._onProgress('Library', 1, 1);
    if (writes.length === 0) return Promise.resolve();
    return Promise.all(writes).then(function() {
      console.log('[Migration] Library:', writes.length, 'docs migrated');
    });
  },

  _migrateClients: function(db, newBase, oldData) {
    if (!oldData.clients || !oldData.clients.data) {
      migrationEngine._onProgress('Clients', 0, 0);
      return Promise.resolve();
    }
    var clientsData = oldData.clients.data;
    // If it's an object with nested data, extract
    if (!Array.isArray(clientsData)) {
      var cd = migrationEngine._addStandardFields(JSON.parse(JSON.stringify(clientsData)), 'main');
      migrationEngine._onProgress('Clients', 1, 1);
      return db.doc(newBase + '/clients/main').set(cd);
    }
    // If array, write each
    var batch = db.batch();
    var total = clientsData.length;
    for (var i = 0; i < clientsData.length; i++) {
      var client = JSON.parse(JSON.stringify(clientsData[i]));
      var cid = client.id || ('client_' + i);
      client.id = String(cid);
      migrationEngine._addStandardFields(client, String(cid));
      batch.set(db.doc(newBase + '/clients/' + String(cid)), client);
      migrationEngine._onProgress('Clients', i + 1, total);
    }
    return batch.commit().then(function() {
      console.log('[Migration] Clients:', total, 'migrated');
    });
  },

  _migrateCollection: function(db, newBase, snap, collectionName, label) {
    if (!snap || snap.empty) {
      migrationEngine._onProgress(label, 0, 0);
      return Promise.resolve();
    }
    var docs = [];
    snap.forEach(function(doc) { docs.push({ id: doc.id, data: doc.data() }); });

    // Use batches (max 499 per batch)
    var batches = [];
    var currentBatch = db.batch();
    var count = 0;
    var total = docs.length;
    for (var i = 0; i < docs.length; i++) {
      var d = JSON.parse(JSON.stringify(docs[i].data));
      d.id = d.id || docs[i].id;
      migrationEngine._addStandardFields(d, d.id);
      currentBatch.set(db.doc(newBase + '/' + collectionName + '/' + d.id), d);
      count++;
      if (count >= 499) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch();
        count = 0;
      }
      migrationEngine._onProgress(label, i + 1, total);
    }
    if (count > 0) batches.push(currentBatch.commit());
    return Promise.all(batches).then(function() {
      console.log('[Migration]', label + ':', total, 'migrated');
    });
  },

  _migrateSingleDoc: function(db, newBase, data, docPath, label) {
    if (!data) {
      migrationEngine._onProgress(label, 0, 0);
      return Promise.resolve();
    }
    var d = JSON.parse(JSON.stringify(data));
    var parts = docPath.split('/');
    migrationEngine._addStandardFields(d, parts[parts.length - 1]);
    migrationEngine._onProgress(label, 1, 1);
    return db.doc(newBase + '/' + docPath).set(d).then(function() {
      console.log('[Migration]', label + ': migrated');
    });
  },

  _migratePushSubscriptions: function(db, newBase, oldData) {
    if (!oldData.pushSubscriptionsSnap || oldData.pushSubscriptionsSnap.empty) {
      migrationEngine._onProgress('Push Subscriptions', 0, 0);
      return Promise.resolve();
    }
    var subs = [];
    oldData.pushSubscriptionsSnap.forEach(function(doc) { subs.push(doc.data()); });
    var consolidated = { subscriptions: subs };
    migrationEngine._addStandardFields(consolidated, 'push_subscriptions');
    migrationEngine._onProgress('Push Subscriptions', 1, 1);
    return db.doc(newBase + '/settings/push_subscriptions').set(consolidated).then(function() {
      console.log('[Migration] Push Subscriptions:', subs.length, 'consolidated');
    });
  },

  _verify: function(db, newBase) {
    // Read back key collections and verify they exist
    return Promise.all([
      db.collection(newBase + '/brands').get(),
      db.doc(newBase + '/settings/main').get(),
      db.doc(newBase + '/_meta/config').get()
    ]).then(function(results) {
      var brandCount = results[0].size;
      var settingsExist = results[1].exists;
      var configExists = results[2].exists;

      console.log('[Migration] Verification: brands=' + brandCount + ' settings=' + settingsExist + ' config=' + configExists);

      if (!settingsExist) {
        console.error('[Migration] VERIFICATION FAILED: settings/main not found');
        return false;
      }
      if (!configExists) {
        console.error('[Migration] VERIFICATION FAILED: _meta/config not found');
        return false;
      }

      // Verify brands match source count
      var sourceBrandCount = 0;
      try {
        var localBrands = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]');
        sourceBrandCount = localBrands.length;
      } catch (e) {}

      if (brandCount > 0 && sourceBrandCount > 0 && brandCount < sourceBrandCount) {
        console.error('[Migration] VERIFICATION FAILED: brand count mismatch. Source:', sourceBrandCount, 'Migrated:', brandCount);
        return false;
      }

      return true;
    });
  }
};
```

- [ ] **Step 2: Verify migration engine exists**

```javascript
typeof migrationEngine         // "object"
typeof migrationEngine.run     // "function"
migrationEngine.needsMigration() // true (hasn't been run yet)
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v28.0: Add migration engine with full data transform and verification"
```

---

### Task 6: Migration UI

**Files:**
- Modify: `RoweOS/dist/index.html` (HTML section for overlay, JS for trigger)

- [ ] **Step 1: Add migration overlay HTML**

Add after the boot screen div (around line 46795):

```html
<!-- v28.0: Migration overlay -->
<div id="migrationOverlay" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:#0a0a0a;z-index:100000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:90%;max-width:480px;">
    <div style="font-size:28px;font-weight:600;margin-bottom:8px;">Upgrading RoweOS to v4.0</div>
    <div style="font-size:14px;color:#888;margin-bottom:32px;">Your data is safe. Do not close this tab.</div>
    <div style="width:100%;height:4px;background:#1a1a1a;border-radius:2px;overflow:hidden;margin-bottom:24px;">
      <div id="migrationProgressBar" style="width:0%;height:100%;background:#a89878;border-radius:2px;transition:width 0.3s;"></div>
    </div>
    <div id="migrationSteps" style="text-align:left;font-size:13px;line-height:2;color:#666;"></div>
    <div id="migrationError" style="display:none;margin-top:24px;padding:16px;background:#1a0a0a;border:1px solid #662222;border-radius:8px;color:#ff6666;font-size:13px;text-align:left;">
      <div style="font-weight:600;margin-bottom:8px;">Migration Failed</div>
      <div id="migrationErrorMsg"></div>
      <button onclick="migrationEngine.run(window._migrationProgressCb).catch(function(){})" style="margin-top:12px;padding:8px 16px;background:#a89878;color:#fff;border:none;border-radius:6px;cursor:pointer;">Retry</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add migration trigger in init flow**

Find the existing `reconcileOnStartup` call (around line 127715) and add the v4 migration check before it:

```javascript
// v28.0: Check for v4 migration before standard sync
if (firebaseUser && migrationEngine.needsMigration()) {
  var overlay = document.getElementById('migrationOverlay');
  if (overlay) overlay.style.display = 'block';
  var stepsEl = document.getElementById('migrationSteps');
  var progressBar = document.getElementById('migrationProgressBar');
  var stepLabels = ['Brands', 'Settings', 'Brand Settings', 'Life Profiles', 'Life Settings',
    'Todos', 'Calendar', 'Automations', 'Conversations', 'Pulse', 'Library', 'Folio',
    'Clients', 'Runs', 'Inventory', 'Logos', 'Knowledge', 'Social', 'Verifying', 'Complete'];
  var completedSteps = {};

  window._migrationProgressCb = function(label, current, total) {
    if (label === 'Complete') {
      if (progressBar) progressBar.style.width = '100%';
      if (overlay) {
        setTimeout(function() { overlay.style.display = 'none'; }, 1000);
      }
      return;
    }
    completedSteps[label] = true;
    var done = Object.keys(completedSteps).length;
    var pct = Math.min(95, Math.round((done / stepLabels.length) * 100));
    if (progressBar) progressBar.style.width = pct + '%';
    if (stepsEl) {
      var html = '';
      for (var i = 0; i < stepLabels.length; i++) {
        var s = stepLabels[i];
        if (completedSteps[s]) {
          html += '<div style="color:#4ade80;">&#10003; ' + s + '</div>';
        } else if (i === Object.keys(completedSteps).length) {
          html += '<div style="color:#a89878;">&#9679; ' + s + '...</div>';
        } else if (i > Object.keys(completedSteps).length) {
          html += '<div>&#9675; ' + s + '</div>';
        }
      }
      stepsEl.innerHTML = html;
    }
  };

  migrationEngine.run(window._migrationProgressCb).then(function() {
    // Setup v4 listeners after migration
    syncEngine._setupConnectivity();
    syncEngine.setupListeners();
    _registerDevice();
  }).catch(function(err) {
    var errEl = document.getElementById('migrationError');
    var errMsg = document.getElementById('migrationErrorMsg');
    if (errEl) errEl.style.display = 'block';
    if (errMsg) errMsg.textContent = err.message;
  });
} else if (firebaseUser && syncEngine.isV4Active()) {
  // Already migrated -- setup v4 listeners
  syncEngine._setupConnectivity();
  syncEngine.setupListeners();
  _registerDevice();
}
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v28.0: Add migration UI overlay and init trigger"
```

---

### Task 7: Firestore Security Rules

**Files:**
- Modify: `RoweOS/dist/firestore.rules`

- [ ] **Step 1: Add v4 namespace rules**

Add after the existing `roweos_users` rule block:

```
match /roweos_v4/{userId}/{subcollection}/{docId} {
  allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.uid == 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93');
}
```

- [ ] **Step 2: Deploy rules**

```bash
cd /Volumes/roweOS && firebase deploy --only firestore:rules
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/firestore.rules
git commit -m "v28.0: Add Firestore security rules for roweos_v4 namespace"
```

---

### Task 8: Update CLAUDE.md and Version

**Files:**
- Modify: `RoweOS/dist/index.html` (version strings)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update version to v28.0**

Update `ROWEOS_VERSION`, mobile header, sidebar display, welcome footer to v28.0.

- [ ] **Step 2: Update CLAUDE.md sync docs**

Add v4 sync engine documentation to CLAUDE.md covering:
- `syncEngine.write()` as the new write entry point
- `syncEngine.delete()` for deletions
- `migrationEngine.run()` for migration
- Field merge categories (auto, conflict, append)
- Offline queue behavior
- Conflict resolution API

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html CLAUDE.md
git commit -m "v28.0: Update version and documentation for sync v4"
```

---

## Phase 2: Rewire Write Paths (82 writeDB + 40 saveBrands + all others)

> This phase rewires every write call site to use `syncEngine.write()`. It is the largest phase and should be done collection-by-collection with testing between each.
>
> **IMPORTANT:** The old write functions (`writeDB`, `saveBrands`, etc.) must continue to work for the old namespace during the transition. The approach: modify each write function to ALSO write to v4 when `syncEngine.isV4Active()` is true. This way we don't need to change 82+ call sites immediately -- we change the write functions themselves.

### Task 9: Modify writeDB to dual-write

Modify the existing `writeDB` function to also write to v4 namespace when active. This covers all 82 call sites at once.

### Task 10: Modify saveBrands to dual-write

Same approach for the 40 saveBrands call sites.

### Task 11: Modify remaining write functions

Modify `writeDBTodos`, `writeDBCalendar`, `writeDBConversations`, `writeDBAutomation`, `_flushLifeAISync` to dual-write.

### Task 12: Modify direct Firestore writes

Update the ~14 direct `db.doc()` write paths that bypass write functions.

---

## Phase 3: Rewire Read Paths + Listeners

### Task 13: Modify loadFromFirebaseV2 for v4

When `syncEngine.isV4Active()`, read from v4 namespace instead of old.

### Task 14: Replace setupRealtimeSync with v4 listeners

When v4 is active, call `syncEngine.setupListeners()` instead of the old 8+ manual listeners.

### Task 15: Modify reconcileOnStartup for v4

Pull from v4 namespace when migrated.

---

## Phase 4: Conflict UI

### Task 16: Conflict panel in Settings > Cloud & Sync

Build the side-by-side conflict review UI in the Cloud & Sync settings folder.

### Task 17: Conflict toast notifications

Add toast when conflicts are detected.

### Task 18: Cloud & Sync enhancements

Add device list, sync log, queue status, force sync, reset sync.

---

## Phase 5: Cloud Functions + Final Integration

### Task 19: Update Cloud Functions

Modify `runScheduledTasks` and `runTaskNow` to read from v4 namespace with fallback.

### Task 20: Deploy and test

Full end-to-end testing on roweos.com with cross-device sync verification.

---

## Execution Notes

- Phases 1-3 are the critical path. Phase 4 and 5 can follow.
- The dual-write approach in Phase 2 means we can ship Phase 1 + 2 together and have both namespaces in sync, with v4 listeners taking over for real-time.
- Phase 3 can be done incrementally -- one read path at a time.
- Test each task by deploying and verifying in browser console before moving on.
- The migration can be tested by running `migrationEngine.run(console.log)` in the browser console before wiring it into the init flow.
