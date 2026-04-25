// v28.0: ═══════════════════════════════════════════════════════
// SYNC ENGINE v4.0 -- Device Registry & Namespace
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

// v28.2: Rename this device — persists to localStorage and Firestore
function renameThisDevice(newName) {
  if (!newName || !newName.trim()) return;
  newName = newName.trim().substring(0, 40);
  localStorage.setItem(SYNC_V4_DEVICE_NAME_KEY, newName);
  // Update Firestore device registration
  var db = typeof getDB === 'function' ? getDB() : null;
  var basePath = _getV4BasePath();
  if (db && basePath) {
    var deviceId = _getDeviceId();
    var update = {};
    update['devices.' + deviceId + '.name'] = newName;
    db.doc(basePath + '/_meta/config').set(update, { merge: true }).catch(function(err) {
      console.warn('[SyncV4] Failed to update device name:', err.message);
    });
  }
  // v28.2: Re-render both sync status panels and the conflicts panel (uses device name)
  if (typeof renderSyncStatus === 'function') {
    renderSyncStatus('syncHubStatusPanel');
    renderSyncStatus('syncStatusPanel');
  }
  if (typeof renderSyncConflicts === 'function') {
    renderSyncConflicts('syncHubConflictsPanel');
    renderSyncConflicts('syncConflictsPanel');
  }
  showToast('Device renamed to "' + escapeHtml(newName) + '"', 'success');
}

function _getV4BasePath() {
  if (!firebaseUser) return null;
  return SYNC_V4_NAMESPACE + '/' + firebaseUser.uid;
}

function _registerDevice() {
  var db = typeof getDB === 'function' ? getDB() : null;
  var basePath = _getV4BasePath();
  if (!db || !basePath) return;
  var deviceId = _getDeviceId();
  var deviceName = _getDeviceName();
  var update = {};
  update['devices.' + deviceId] = {
    name: deviceName,
    lastSeen: Date.now(),
    appVersion: typeof ROWEOS_VERSION !== 'undefined' ? ROWEOS_VERSION : 'unknown'
  };
  db.doc(basePath + '/_meta/config').set(update, { merge: true }).catch(function(err) {
    console.error('[SyncV4] Failed to register device:', err.message);
  });
}

// v28.0: ═══════════════════════════════════════════════════════
// SYNC ENGINE v4.0 -- Core Write/Delete/Queue
// ═══════════════════════════════════════════════════════════════

var syncEngine = {
  MERGE_AUTO: 'auto',
  MERGE_CONFLICT: 'conflict',
  MERGE_APPEND: 'append',

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

  _queueKey: 'roweos_v4_sync_queue',
  _flushing: false,

  isV4Active: function() {
    // v28.4: V4 disabled — incomplete migration caused data loss (chat contamination,
    // folio overwrites, missing categories). All reads/writes use old roweos_users/ path.
    // V4 data preserved in Firestore for future re-migration when properly implemented.
    return false;
  },

  _buildFieldMeta: function(fields) {
    var meta = {};
    var now = Date.now();
    var deviceId = _getDeviceId();
    var keys = Object.keys(fields);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.charAt(0) === '_') continue;
      meta[k] = { at: now, by: deviceId };
    }
    return meta;
  },

  write: function(collection, docId, fields, options) {
    options = options || {};
    var isCreate = !!options.isCreate;
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

    var newMeta = syncEngine._buildFieldMeta(fields);

    if (options.localStorageKey) {
      try {
        var localData = JSON.parse(localStorage.getItem(options.localStorageKey) || '{}');
        if (Array.isArray(localData)) {
          var found = false;
          for (var i = 0; i < localData.length; i++) {
            if (localData[i].id === docId) {
              var uKeys = Object.keys(fields);
              for (var j = 0; j < uKeys.length; j++) {
                localData[i][uKeys[j]] = fields[uKeys[j]];
              }
              localData[i]._fieldMeta = localData[i]._fieldMeta || {};
              var mKeys = Object.keys(newMeta);
              for (var m = 0; m < mKeys.length; m++) {
                localData[i]._fieldMeta[mKeys[m]] = newMeta[mKeys[m]];
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
          var oKeys = Object.keys(fields);
          for (var ok = 0; ok < oKeys.length; ok++) {
            localData[oKeys[ok]] = fields[oKeys[ok]];
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

    if (navigator.onLine) {
      syncEngine._flush();
    }

    if (typeof stampLocalSave === 'function') stampLocalSave();
  },

  delete: function(collection, docId, options) {
    options = options || {};
    var now = Date.now();

    if (options.localStorageKey) {
      try {
        var localData = JSON.parse(localStorage.getItem(options.localStorageKey) || '[]');
        if (Array.isArray(localData)) {
          localData = localData.filter(function(item) { return item.id !== docId; });
          localStorage.setItem(options.localStorageKey, JSON.stringify(localData));
        }
      } catch (e) {}
    }

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

    if (typeof stampLocalSave === 'function') stampLocalSave();
  },

  _enqueue: function(op) {
    var queue = [];
    try { queue = JSON.parse(localStorage.getItem(syncEngine._queueKey) || '[]'); } catch (e) {}

    if (op.operation === 'update') {
      var dominated = false;
      for (var i = queue.length - 1; i >= 0; i--) {
        if (queue[i].collection === op.collection && queue[i].docId === op.docId && queue[i].status === 'pending' && queue[i].operation === 'update') {
          var fk = Object.keys(op.fields);
          for (var j = 0; j < fk.length; j++) {
            queue[i].fields[fk[j]] = op.fields[fk[j]];
          }
          var mk = Object.keys(op.fieldMeta);
          for (var mi = 0; mi < mk.length; mi++) {
            queue[i].fieldMeta[mk[mi]] = op.fieldMeta[mk[mi]];
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

    if (queue.length > 1000) {
      queue = queue.slice(queue.length - 1000);
    }

    try { localStorage.setItem(syncEngine._queueKey, JSON.stringify(queue)); } catch (e) {}
  },

  _flush: function() {
    if (syncEngine._flushing) return;
    syncEngine._flushing = true;

    var db = typeof getDB === 'function' ? getDB() : null;
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

    if (typeof updateSyncIndicator === 'function') updateSyncIndicator('syncing');

    // v30.1: Track confirmed op IDs to avoid overwriting ops enqueued during flush
    var confirmedIds = [];
    var idx = 0;
    function processNext() {
      if (idx >= pending.length) {
        syncEngine._flushing = false;
        if (typeof updateSyncIndicator === 'function') updateSyncIndicator('synced');
        // v30.1: Re-read queue from localStorage to avoid overwriting ops enqueued during flush
        var _currentQueue = [];
        try { _currentQueue = JSON.parse(localStorage.getItem(syncEngine._queueKey) || '[]'); } catch(e) {}
        var cleaned = _currentQueue.filter(function(op) { return confirmedIds.indexOf(op.id) === -1; });
        try { localStorage.setItem(syncEngine._queueKey, JSON.stringify(cleaned)); } catch (e) {}
        return;
      }

      var op = pending[idx];
      var docRef = db.doc(basePath + '/' + op.collection + '/' + op.docId);

      var promise;
      if (op.operation === 'delete') {
        promise = docRef.delete();
      } else {
        var data = JSON.parse(JSON.stringify(op.fields));
        var metaKeys = Object.keys(op.fieldMeta);
        for (var mi = 0; mi < metaKeys.length; mi++) {
          data['_fieldMeta.' + metaKeys[mi]] = op.fieldMeta[metaKeys[mi]];
        }
        promise = docRef.set(data, { merge: true });
      }

      promise.then(function() {
        op.status = 'confirmed';
        confirmedIds.push(op.id);
        idx++;
        processNext();
      }).catch(function(err) {
        console.error('[SyncV4] Flush failed for', op.collection + '/' + op.docId, ':', err.message);
        op.retryCount++;
        if (op.retryCount >= 3) {
          op.status = 'error';
          console.error('[SyncV4] Operation moved to error state after 3 retries:', op.id);
        }
        try { localStorage.setItem(syncEngine._queueKey, JSON.stringify(queue)); } catch (e) {}
        if (typeof updateSyncIndicator === 'function') updateSyncIndicator('error');
        var backoff = Math.min(1000 * Math.pow(2, op.retryCount), 8000);
        // v30.1: Only clear flushing flag inside the retry callback to prevent concurrent flushes
        setTimeout(function() { syncEngine._flushing = false; syncEngine._flush(); }, backoff);
      });
    }

    processNext();
  },

  _setupConnectivity: function() {
    window.addEventListener('online', function() {
      console.log('[SyncV4] Back online -- flushing queue');
      syncEngine._flush();
    });
    window.addEventListener('offline', function() {
      console.log('[SyncV4] Gone offline -- writes will queue');
      if (typeof updateSyncIndicator === 'function') updateSyncIndicator('offline');
    });
  },

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
  },

  // v28.0: ─── FIELD-LEVEL MERGE ────────────────────────────
  fieldMerge: function(collection, docId, cloudDoc, localDoc) {
    var mergeType = syncEngine._mergeTypes[collection] || 'auto';
    var conflicts = [];
    var notifications = [];
    var merged = JSON.parse(JSON.stringify(cloudDoc));
    var cloudMeta = cloudDoc._fieldMeta || {};
    var localMeta = (localDoc && localDoc._fieldMeta) ? localDoc._fieldMeta : {};
    var lastSync = 0;
    try { lastSync = parseInt(localStorage.getItem('roweos_v4_last_sync') || '0'); } catch (e) {}

    var allFields = {};
    var ck = Object.keys(cloudDoc || {});
    for (var ci = 0; ci < ck.length; ci++) allFields[ck[ci]] = true;
    var lk = Object.keys(localDoc || {});
    for (var li = 0; li < lk.length; li++) allFields[lk[li]] = true;

    var fieldNames = Object.keys(allFields);
    for (var i = 0; i < fieldNames.length; i++) {
      var field = fieldNames[i];
      // v28.3: Theme is device-local, never overwrite from cloud merge
      if (field === 'theme') continue;
      if (field === '_fieldMeta' || field === '_modifiedAt' || field === '_createdAt' ||
          field === '_deviceId' || field === '_version' || field === 'id') continue;

      var cloudFieldTs = (cloudMeta[field] && cloudMeta[field].at) ? _normalizeTs(cloudMeta[field].at) : 0;
      var localFieldTs = (localMeta[field] && localMeta[field].at) ? _normalizeTs(localMeta[field].at) : 0;
      var cloudVal = cloudDoc ? cloudDoc[field] : undefined;
      var localVal = localDoc ? localDoc[field] : undefined;

      // v28.0: Deep equal with sorted keys (prevents false conflicts from key reordering)
      var _cv = typeof cloudVal === 'object' && cloudVal !== null ? JSON.stringify(cloudVal, Object.keys(cloudVal).sort()) : JSON.stringify(cloudVal);
      var _lv = typeof localVal === 'object' && localVal !== null ? JSON.stringify(localVal, Object.keys(localVal).sort()) : JSON.stringify(localVal);
      if (_cv === _lv) continue;

      if (cloudFieldTs > lastSync && localFieldTs <= lastSync) {
        merged[field] = cloudVal;
        continue;
      }

      if (localFieldTs > lastSync && cloudFieldTs <= lastSync) {
        merged[field] = localVal;
        merged._fieldMeta = merged._fieldMeta || {};
        merged._fieldMeta[field] = localMeta[field];
        continue;
      }

      if (mergeType === 'conflict') {
        conflicts.push({
          id: 'conflict_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          collection: collection,
          docId: docId,
          field: field,
          localValue: localVal !== undefined ? localVal : null,
          localDevice: localMeta[field] ? localMeta[field].by : _getDeviceId(),
          localDeviceName: _getDeviceName(),
          localTimestamp: localFieldTs,
          cloudValue: cloudVal !== undefined ? cloudVal : null,
          cloudDevice: cloudMeta[field] ? cloudMeta[field].by : 'unknown',
          cloudDeviceName: 'Other Device',
          cloudTimestamp: cloudFieldTs,
          status: 'pending',
          resolvedAt: null,
          resolvedChoice: null,
          createdAt: Date.now()
        });
        merged[field] = cloudVal;
      } else {
        if (localFieldTs >= cloudFieldTs) {
          merged[field] = localVal;
          merged._fieldMeta = merged._fieldMeta || {};
          merged._fieldMeta[field] = localMeta[field];
        } else {
          merged[field] = cloudVal;
        }
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

  // v28.0: ─── CONFLICT MANAGEMENT ──────────────────────────
  _saveConflicts: function(conflicts) {
    if (!conflicts || conflicts.length === 0) return;
    var db = typeof getDB === 'function' ? getDB() : null;
    var basePath = _getV4BasePath();
    if (db && basePath) {
      var batch = db.batch();
      for (var i = 0; i < conflicts.length; i++) {
        batch.set(db.doc(basePath + '/conflicts/' + conflicts[i].id), conflicts[i]);
      }
      batch.commit().then(function() {
        console.log('[SyncV4] Saved', conflicts.length, 'conflicts');
      }).catch(function(err) {
        console.error('[SyncV4] Failed to save conflicts:', err.message);
      });
    }
    var existing = [];
    try { existing = JSON.parse(localStorage.getItem('roweos_v4_conflicts') || '[]'); } catch (e) {}
    for (var j = 0; j < conflicts.length; j++) {
      existing.push(conflicts[j]);
    }
    try { localStorage.setItem('roweos_v4_conflicts', JSON.stringify(existing)); } catch (e) {}
    // v29.0: Debounce conflict toast — show 1 summary toast instead of per-category spam
    if (window._conflictToastTimer) clearTimeout(window._conflictToastTimer);
    window._conflictToastTimer = setTimeout(function() {
      try {
        var total = JSON.parse(localStorage.getItem('roweos_v4_conflicts') || '[]').length;
        if (total > 0 && typeof showToast === 'function') {
          showToast(total + ' sync conflict' + (total > 1 ? 's' : '') + ' need' + (total > 1 ? '' : 's') + ' review', 'warning');
        }
      } catch(e) {}
    }, 2000);
  },

  resolveConflict: function(conflictId, choice) {
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
    var value;
    if (choice === 'local') {
      value = conflict.localValue;
    } else if (choice === 'cloud') {
      value = conflict.cloudValue;
    } else {
      if (typeof conflict.localValue === 'string' && typeof conflict.cloudValue === 'string') {
        value = conflict.cloudValue + '\n---\n' + conflict.localValue;
      } else {
        value = conflict.cloudValue;
      }
    }
    var fields = {};
    fields[conflict.field] = value;
    syncEngine.write(conflict.collection, conflict.docId, fields);
    conflict.status = 'resolved';
    conflict.resolvedAt = Date.now();
    conflict.resolvedChoice = choice;
    try { localStorage.setItem('roweos_v4_conflicts', JSON.stringify(conflicts)); } catch (e) {}
    var db = typeof getDB === 'function' ? getDB() : null;
    var basePath = _getV4BasePath();
    if (db && basePath) {
      db.doc(basePath + '/conflicts/' + conflictId).update({
        status: 'resolved',
        resolvedAt: Date.now(),
        resolvedChoice: choice
      }).catch(function() {});
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
  },

  // v28.0: ─── REAL-TIME LISTENERS ──────────────────────────
  _unsubscribers: [],

  watchCollection: function(collectionName, localStorageKey) {
    var db = typeof getDB === 'function' ? getDB() : null;
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
          try {
            var remArr = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
            if (Array.isArray(remArr)) {
              remArr = remArr.filter(function(item) { return item.id !== docId; });
              localStorage.setItem(localStorageKey, JSON.stringify(remArr));
            }
          } catch (e) {}
          return;
        }

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
            localArr.push(docData);
            localStorage.setItem(localStorageKey, JSON.stringify(localArr));
            return;
          }

          if (localDoc) {
            var result = syncEngine.fieldMerge(collectionName, docId, docData, localDoc);
            localArr[localIdx] = result.merged;
            localStorage.setItem(localStorageKey, JSON.stringify(localArr));
            if (result.conflicts.length > 0) {
              syncEngine._saveConflicts(result.conflicts);
            }
          } else {
            // v29.0: Dedup by name before appending (catches temp-ID-to-stable-ID rename race)
            var _isDup = false;
            if (collectionName === 'brands' && docData.name) {
              for (var _ddi = 0; _ddi < localArr.length; _ddi++) {
                if (localArr[_ddi].name && localArr[_ddi].name.toLowerCase() === docData.name.toLowerCase()) {
                  // Same brand, different ID -- update to cloud ID and merge
                  localArr[_ddi].id = docId;
                  var _mergeResult = syncEngine.fieldMerge(collectionName, docId, docData, localArr[_ddi]);
                  localArr[_ddi] = _mergeResult.merged;
                  _isDup = true;
                  break;
                }
              }
            }
            if (!_isDup) {
              localArr.push(docData);
            }
            localStorage.setItem(localStorageKey, JSON.stringify(localArr));
          }
        } catch (e) {
          console.error('[SyncV4] watchCollection error for', collectionName, ':', e.message);
        }
      });

      localStorage.setItem('roweos_v4_last_sync', String(Date.now()));
      if (typeof updateSyncIndicator === 'function') updateSyncIndicator('synced');
    }, function(err) {
      console.error('[SyncV4] Listener error for', collectionName, ':', err.message);
    });

    syncEngine._unsubscribers.push(unsub);
  },

  watchDoc: function(docPath, localStorageKey, mergeTypeOverride) {
    var db = typeof getDB === 'function' ? getDB() : null;
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
        // v28.4: Array-stored keys need special handling — cloud stores { data: [...] }
        // but localStorage stores the raw array [...]. fieldMerge can't reconcile these shapes.
        var _cloudArr = (cloudDoc && Array.isArray(cloudDoc.data)) ? cloudDoc.data :
                        (cloudDoc && Array.isArray(cloudDoc.items)) ? cloudDoc.items : null;
        var _localRaw = localStorage.getItem(localStorageKey);
        var _localParsed = null;
        try { _localParsed = JSON.parse(_localRaw || '[]'); } catch(_pe) {}
        var _localArr = Array.isArray(_localParsed) ? _localParsed :
                        (_localParsed && Array.isArray(_localParsed.data)) ? _localParsed.data :
                        (_localParsed && Array.isArray(_localParsed.items)) ? _localParsed.items : null;

        if (_cloudArr && _localArr !== null) {
          // Both sides are arrays — merge by ID, keeping all items from both
          var _mergedIds = {};
          var _merged = [];
          // Local items first (preserve local edits)
          for (var _mi = 0; _mi < _localArr.length; _mi++) {
            var _li = _localArr[_mi];
            if (_li && _li.id) _mergedIds[_li.id] = true;
            _merged.push(_li);
          }
          // Add cloud-only items
          for (var _ci = 0; _ci < _cloudArr.length; _ci++) {
            var _cItem = _cloudArr[_ci];
            if (_cItem && _cItem.id && !_mergedIds[_cItem.id]) _merged.push(_cItem);
          }
          localStorage.setItem(localStorageKey, JSON.stringify(_merged));
        } else {
          // Non-array doc — use standard fieldMerge
          var localDoc = _localParsed && typeof _localParsed === 'object' && !Array.isArray(_localParsed) ? _localParsed : {};
          var result = syncEngine.fieldMerge(collectionName, doc.id, cloudDoc, localDoc);
          localStorage.setItem(localStorageKey, JSON.stringify(result.merged));
          if (result.conflicts.length > 0) {
            syncEngine._saveConflicts(result.conflicts);
          }
        }
      } catch (e) {
        console.error('[SyncV4] watchDoc error for', docPath, ':', e.message);
      }

      localStorage.setItem('roweos_v4_last_sync', String(Date.now()));
      if (typeof updateSyncIndicator === 'function') updateSyncIndicator('synced');
    }, function(err) {
      console.error('[SyncV4] Listener error for', docPath, ':', err.message);
    });

    syncEngine._unsubscribers.push(unsub);
  },

  setupListeners: function() {
    if (!syncEngine.isV4Active()) return;

    // v28.0: Custom brands watcher that preserves _order
    syncEngine.watchCollection('brands', 'roweos_user_brands');
    // Sort brands by _order after any update
    var _origBrandsUnsub = syncEngine._unsubscribers[syncEngine._unsubscribers.length - 1];
    syncEngine._unsubscribers[syncEngine._unsubscribers.length - 1] = function() {
      if (typeof _origBrandsUnsub === 'function') _origBrandsUnsub();
    };
    // v29.0: Removed destructive 3-second brand sort interval (was breaking ID-based selection)
    syncEngine.watchCollection('todos', 'roweosTodos');
    syncEngine.watchCollection('calendar', 'roweosCalendar');
    syncEngine.watchCollection('automations', 'roweos_automations');
    syncEngine.watchCollection('life_profiles', 'roweos_life_profiles');
    syncEngine.watchCollection('clients', 'roweos_clients');
    syncEngine.watchCollection('reminders', 'roweos_reminders');
    syncEngine.watchCollection('knowledge', 'roweos_user_knowledge');
    syncEngine.watchCollection('runs', 'roweos_runs');

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

  teardownListeners: function() {
    for (var i = 0; i < syncEngine._unsubscribers.length; i++) {
      if (typeof syncEngine._unsubscribers[i] === 'function') {
        syncEngine._unsubscribers[i]();
      }
    }
    syncEngine._unsubscribers = [];
    console.log('[SyncV4] All listeners torn down');
  }
};

// v28.0: ═══════════════════════════════════════════════════════
// MIGRATION ENGINE -- Old namespace to v4
// ═══════════════════════════════════════════════════════════════

var migrationEngine = {
  _errors: [],
  _onProgress: null,

  needsMigration: function() {
    // v28.0.2: Force reset if migration schema version doesn't match current
    var MIGRATION_SCHEMA = '2';
    if (localStorage.getItem('roweos_v4_migrated') === 'true' && localStorage.getItem('roweos_v4_schema') !== MIGRATION_SCHEMA) {
      console.warn('[Migration] Schema mismatch (expected ' + MIGRATION_SCHEMA + ', got ' + localStorage.getItem('roweos_v4_schema') + ') -- forcing re-migration');
      localStorage.removeItem('roweos_v4_migrated');
      localStorage.removeItem('roweos_v4_migration_timestamp');
    }
    if (localStorage.getItem('roweos_v4_migrated') === 'true') return false;
    // v30.1: New users have no data to migrate — skip and mark done immediately
    var hasBrands = localStorage.getItem('roweosBrands') || localStorage.getItem('roweos_brands');
    var hasOnboarding = localStorage.getItem('roweos_onboarding_completed');
    if (!hasBrands && !hasOnboarding) {
      console.log('[Migration] New user — no existing data, skipping migration');
      localStorage.setItem('roweos_v4_migrated', 'true');
      localStorage.setItem('roweos_v4_schema', MIGRATION_SCHEMA);
      return false;
    }
    return true;
  },

  run: function(onProgress) {
    migrationEngine._onProgress = onProgress || function() {};
    migrationEngine._errors = [];

    var db = typeof getDB === 'function' ? getDB() : null;
    if (!db || !firebaseUser) {
      return Promise.reject(new Error('Not signed in'));
    }

    var uid = firebaseUser.uid;
    var oldBase = 'roweos_users/' + uid;
    var newBase = SYNC_V4_NAMESPACE + '/' + uid;

    console.log('[Migration] Starting v4 migration for user:', uid);

    // Save localStorage backup
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

    _registerDevice();
    migrationEngine._onProgress('Reading data', 0, 1);

    return migrationEngine._readAllOldData(db, oldBase).then(function(oldData) {
      console.log('[Migration] Read complete. Keys:', Object.keys(oldData).length);
      migrationEngine._onProgress('Backing up', 0, 1);
      return migrationEngine._saveBackup(db, newBase, oldData).then(function() {
        return migrationEngine._transformAndWrite(db, newBase, oldData);
      });
    }).then(function() {
      migrationEngine._onProgress('Verifying', 0, 1);
      return migrationEngine._verify(db, newBase);
    }).then(function(verified) {
      if (!verified) throw new Error('Verification failed');
      localStorage.setItem('roweos_v4_migrated', 'true');
      localStorage.setItem('roweos_v4_migration_timestamp', String(Date.now()));
      localStorage.setItem('roweos_v4_schema', '2');
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
      console.error('[Migration] FAILED:', err.message);
      migrationEngine._errors.push(err.message);
      localStorage.removeItem('roweos_v4_migrated');
      throw err;
    });
  },

  _readAllOldData: function(db, oldBase) {
    console.log('[Migration] Reading all data from:', oldBase);
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
    ]).then(function(r) {
      var _d = function(doc) { return doc.exists ? doc.data() : null; };
      return {
        brandsSnap: r[0], profileMain: _d(r[1]) || {},
        generatedBrandOps: _d(r[2]), userContact: _d(r[3]),
        clients: _d(r[4]), customAgents: _d(r[5]),
        customOps: _d(r[6]), socialPosts: _d(r[7]),
        socialWorkflows: _d(r[8]), notifications: _d(r[9]),
        bloomLibrary: _d(r[10]), researchHistory: _d(r[11]),
        profileLogos: _d(r[12]), mail: _d(r[13]),
        people: _d(r[14]), profileReminders: _d(r[15]),
        profileInventory: _d(r[16]),
        lifeAIMain: _d(r[17]) || {}, lifeAIPossessions: _d(r[18]),
        todosSnap: r[19], calendarSnap: r[20],
        automationsSnap: r[21], convCurrent: _d(r[22]),
        convHistory: _d(r[23]), convAgentHistory: _d(r[24]),
        pulseMain: _d(r[25]),
        libraryBrand: _d(r[26]), libraryLife: _d(r[27]),
        folioMain: _d(r[28]),
        runsSnap: r[29], inventorySnap: r[30],
        logosSnap: r[31], knowledgeSnap: r[32],
        socialTokensSnap: r[33], socialActivitySnap: r[34],
        scavengerConfigsSnap: r[35], scavengerTargetsSnap: r[36],
        secureApiKeys: _d(r[37]),
        pushSubscriptionsSnap: r[38], visualAssetsSnap: r[39],
        cloudOutboxSnap: r[40]
      };
    });
  },

  _addStdFields: function(doc, existingId) {
    var now = Date.now();
    doc.id = doc.id || existingId || ('doc_' + now + '_' + Math.random().toString(36).substring(2, 6));
    doc._modifiedAt = _normalizeTs(doc._modifiedAt) || now;
    doc._createdAt = _normalizeTs(doc._createdAt) || _normalizeTs(doc.createdAt) || now;
    doc._deviceId = doc._deviceId || _getDeviceId();
    doc._version = doc._version || 1;
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

  _saveBackup: function(db, newBase, oldData) {
    var summary = { timestamp: Date.now(), collections: Object.keys(oldData) };
    return db.doc(newBase + '/_meta/pre_migration_backup').set(summary).catch(function(err) {
      console.warn('[Migration] Backup write failed (non-fatal):', err.message);
    });
  },

  // v28.0: Each step wrapped in catch so one failure doesn't block the chain
  _safeStep: function(fn, label) {
    return fn().catch(function(err) {
      console.error('[Migration] ' + label + ' FAILED (continuing):', err.message);
      migrationEngine._errors.push(label + ': ' + err.message);
      migrationEngine._onProgress(label, 1, 1); // mark as done so UI progresses
    });
  },

  _transformAndWrite: function(db, newBase, oldData) {
    var me = migrationEngine;
    return me._safeStep(function() { return me._migrateBrands(db, newBase, oldData); }, 'Brands')
    .then(function() { return me._safeStep(function() { return me._migrateSettings(db, newBase, oldData); }, 'Settings'); })
    .then(function() { return me._safeStep(function() { return me._migrateBrandSettings(db, newBase, oldData); }, 'Brand Settings'); })
    .then(function() { return me._safeStep(function() { return me._migrateLifeProfiles(db, newBase, oldData); }, 'Life Profiles'); })
    .then(function() { return me._safeStep(function() { return me._migrateLifeSettings(db, newBase, oldData); }, 'Life Settings'); })
    .then(function() { return me._safeStep(function() { return me._migrateTodos(db, newBase, oldData); }, 'Todos'); })
    .then(function() { return me._safeStep(function() { return me._migrateCalendar(db, newBase, oldData); }, 'Calendar'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.automationsSnap, 'automations', 'Automations'); }, 'Automations'); })
    .then(function() { return me._safeStep(function() { return me._migrateConversations(db, newBase, oldData); }, 'Conversations'); })
    .then(function() { return me._safeStep(function() { return me._migratePulse(db, newBase, oldData); }, 'Pulse'); })
    .then(function() { return me._safeStep(function() { return me._migrateLibrary(db, newBase, oldData); }, 'Library'); })
    .then(function() { return me._safeStep(function() { return me._migrateSingleDoc(db, newBase, oldData.folioMain, 'folio/main', 'Folio'); }, 'Folio'); })
    .then(function() { return me._safeStep(function() { return me._migrateClients(db, newBase, oldData); }, 'Clients'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.runsSnap, 'runs', 'Runs'); }, 'Runs'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.inventorySnap, 'inventory', 'Inventory'); }, 'Inventory'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.logosSnap, 'logos', 'Logos'); }, 'Logos'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.knowledgeSnap, 'knowledge', 'Knowledge'); }, 'Knowledge'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.socialTokensSnap, 'social_tokens', 'Social Tokens'); }, 'Social Tokens'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.socialActivitySnap, 'social_activity', 'Social Activity'); }, 'Social Activity'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.scavengerConfigsSnap, 'scavenger_configs', 'Scavenger Configs'); }, 'Scavenger Configs'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.scavengerTargetsSnap, 'scavenger_targets', 'Scavenger Targets'); }, 'Scavenger Targets'); })
    .then(function() { return me._safeStep(function() { return me._migrateCollection(db, newBase, oldData.visualAssetsSnap, 'logos', 'Visual Assets'); }, 'Visual Assets'); })
    .then(function() { return me._safeStep(function() { return me._migrateSingleDoc(db, newBase, oldData.secureApiKeys, 'settings/api_keys', 'API Keys'); }, 'API Keys'); })
    .then(function() { return me._safeStep(function() { return me._migrateSingleDoc(db, newBase, oldData.mail, 'settings/mail', 'Mail'); }, 'Mail'); })
    .then(function() { return me._safeStep(function() { return me._migrateSingleDoc(db, newBase, oldData.socialPosts, 'social_posts/main', 'Social Posts'); }, 'Social Posts'); })
    .then(function() { return me._safeStep(function() { return me._migrateSingleDoc(db, newBase, oldData.socialWorkflows, 'social_workflows/main', 'Social Workflows'); }, 'Social Workflows'); })
    .then(function() { return me._safeStep(function() { return me._migrateSingleDoc(db, newBase, oldData.notifications, 'settings/notifications', 'Notifications'); }, 'Notifications'); })
    .then(function() { return me._safeStep(function() { return me._migrateSingleDoc(db, newBase, oldData.people, 'settings/people', 'People'); }, 'People'); })
    .then(function() { return me._safeStep(function() { return me._migratePushSubs(db, newBase, oldData); }, 'Push Subscriptions'); });
  },

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
    if (allDoc && allDoc.items && allDoc.items.length > 0) brands = allDoc.items;

    var batch = db.batch();
    for (var i = 0; i < brands.length; i++) {
      var brand = JSON.parse(JSON.stringify(brands[i]));
      var sid = brand.id || ('brand_name_' + (brand.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'));
      brand.id = sid;
      brand._order = i; // v28.0: Preserve original brand order
      brand._modifiedAt = _normalizeTs(brand._modifiedAt) || Date.now();
      migrationEngine._addStdFields(brand, sid);
      if (oldData.generatedBrandOps && oldData.generatedBrandOps.data) {
        brand.generatedOps = oldData.generatedBrandOps.data;
      }
      batch.set(db.doc(newBase + '/brands/' + sid), brand);
    }
    migrationEngine._onProgress('Brands', brands.length, brands.length);
    return batch.commit().then(function() {
      console.log('[Migration] Brands:', brands.length, 'migrated');
    });
  },

  _migrateSettings: function(db, newBase, oldData) {
    var p = oldData.profileMain || {};
    // v28.0: Split settings into main (small) + separate docs for large fields
    var s = {};
    // Small fields only in settings/main (avoid 1MB Firestore doc limit)
    var sf = ['customSidebar','pdfScheme','calendarColors','calendarVisibility','calendarScope',
      'defaultCalendar','todoCategories','bloomContentMode',
      'bloomDefaultSource','automationMemory','autoLabTabOrder','socialConnected',
      'pendingApproval','guardrails','apiRouting',
      'promoFonts','modelTier','advancedMode','timeFormat','sidebarOrder',
      'blobShape','ambientColor','commerce','analyticsThreshold','apiBudget','socialConnections',
      'socialTokenUpdated'];
    for (var i = 0; i < sf.length; i++) {
      if (p[sf[i]] !== undefined) s[sf[i]] = p[sf[i]];
    }
    if (p.settings) {
      s.webSearchPrefs = p.settings.webSearchPrefs;
      s.claudeWebSearch = p.settings.claudeWebSearch;
      s.geminiWebSearch = p.settings.geminiWebSearch;
    }
    if (oldData.userContact) s.userContact = oldData.userContact.data || oldData.userContact;
    if (oldData.customAgents) s.customAgents = oldData.customAgents.data || oldData.customAgents;
    if (oldData.customOps) s.customOps = oldData.customOps.data || oldData.customOps;
    migrationEngine._addStdFields(s, 'main');
    migrationEngine._onProgress('Settings', 1, 1);
    // Write main settings doc (small)
    var writes = [
      db.doc(newBase + '/settings/main').set(s).then(function() {
        console.log('[Migration] Settings/main: migrated', Object.keys(s).length, 'fields');
      })
    ];
    // Large fields go to separate docs to avoid 1MB limit
    if (p.journal) {
      writes.push(db.doc(newBase + '/settings/journal').set(
        migrationEngine._addStdFields({ data: p.journal }, 'journal')
      ).catch(function(e) { console.warn('[Migration] settings/journal skipped:', e.message); }));
    }
    if (p.brandMemory) {
      writes.push(db.doc(newBase + '/settings/brand_memory').set(
        migrationEngine._addStdFields({ data: p.brandMemory }, 'brand_memory')
      ).catch(function(e) { console.warn('[Migration] settings/brand_memory skipped:', e.message); }));
    }
    if (p.brandKnowledge) {
      writes.push(db.doc(newBase + '/settings/brand_knowledge').set(
        migrationEngine._addStdFields({ data: p.brandKnowledge }, 'brand_knowledge')
      ).catch(function(e) { console.warn('[Migration] settings/brand_knowledge skipped:', e.message); }));
    }
    if (p.bloomSignals) {
      writes.push(db.doc(newBase + '/settings/bloom_signals').set(
        migrationEngine._addStdFields({ data: p.bloomSignals }, 'bloom_signals')
      ).catch(function(e) { console.warn('[Migration] settings/bloom_signals skipped:', e.message); }));
    }
    if (p.bloomKnowledge) {
      writes.push(db.doc(newBase + '/settings/bloom_knowledge').set(
        migrationEngine._addStdFields({ data: p.bloomKnowledge }, 'bloom_knowledge')
      ).catch(function(e) { console.warn('[Migration] settings/bloom_knowledge skipped:', e.message); }));
    }
    if (p.socialOutbox) {
      writes.push(db.doc(newBase + '/settings/social_outbox').set(
        migrationEngine._addStdFields({ data: p.socialOutbox }, 'social_outbox')
      ).catch(function(e) { console.warn('[Migration] settings/social_outbox skipped:', e.message); }));
    }
    if (oldData.bloomLibrary) {
      writes.push(db.doc(newBase + '/settings/bloom_library').set(
        migrationEngine._addStdFields(oldData.bloomLibrary, 'bloom_library')
      ).catch(function(e) { console.warn('[Migration] settings/bloom_library skipped:', e.message); }));
    }
    if (oldData.researchHistory) {
      writes.push(db.doc(newBase + '/settings/research_history').set(
        migrationEngine._addStdFields({ items: oldData.researchHistory.items || oldData.researchHistory }, 'research_history')
      ).catch(function(e) { console.warn('[Migration] settings/research_history skipped:', e.message); }));
    }
    return Promise.all(writes);
  },

  _migrateBrandSettings: function(db, newBase, oldData) {
    var p = oldData.profileMain || {};
    if (!p.brandSettings) { migrationEngine._onProgress('Brand Settings', 0, 0); return Promise.resolve(); }
    var bs = JSON.parse(JSON.stringify(p.brandSettings));
    migrationEngine._addStdFields(bs, 'main');
    migrationEngine._onProgress('Brand Settings', 1, 1);
    return db.doc(newBase + '/brand_settings/main').set(bs);
  },

  _migrateLifeProfiles: function(db, newBase, oldData) {
    var life = oldData.lifeAIMain || {};
    var profiles = life.profiles || [];
    if (profiles.length === 0) { migrationEngine._onProgress('Life Profiles', 0, 0); return Promise.resolve(); }
    var batch = db.batch();
    for (var i = 0; i < profiles.length; i++) {
      var pr = JSON.parse(JSON.stringify(profiles[i]));
      var pid = pr.id || ('life_' + Date.now() + '_' + i);
      pr.id = pid;
      migrationEngine._addStdFields(pr, pid);
      batch.set(db.doc(newBase + '/life_profiles/' + pid), pr);
    }
    migrationEngine._onProgress('Life Profiles', profiles.length, profiles.length);
    return batch.commit().then(function() { console.log('[Migration] Life Profiles:', profiles.length); });
  },

  _migrateLifeSettings: function(db, newBase, oldData) {
    var life = oldData.lifeAIMain || {};
    var s = {};
    var lf = ['currentProfileIdx','accentColor','accentDark','accentDarkMode','accentDarkModeDark',
      'accentLightMode','accentLightModeDark','blobShape','appMode',
      'generatedOps','goals','habits','routines','rhythmPreferences','rhythmWidgetConfig',
      'mainSystemPrompt','memory','todos','userName','agentCommands','_deletedProfiles'];
    for (var i = 0; i < lf.length; i++) {
      if (life[lf[i]] !== undefined) s[lf[i]] = life[lf[i]];
    }
    migrationEngine._addStdFields(s, 'main');
    migrationEngine._onProgress('Life Settings', 1, 1);
    return db.doc(newBase + '/life_settings/main').set(s);
  },

  _migrateTodos: function(db, newBase, oldData) {
    var todos = [];
    if (oldData.todosSnap) {
      oldData.todosSnap.forEach(function(doc) {
        if (doc.id === 'main' && doc.data().data) { todos = doc.data().data; }
        else if (doc.id !== 'main' && doc.id !== '_all') { todos.push(doc.data()); }
      });
    }
    if (todos.length === 0) { migrationEngine._onProgress('Todos', 0, 0); return Promise.resolve(); }
    var batch = db.batch();
    for (var i = 0; i < todos.length; i++) {
      var t = JSON.parse(JSON.stringify(todos[i]));
      var tid = String(t.id || ('todo_' + Date.now() + '_' + i));
      t.id = tid;
      migrationEngine._addStdFields(t, tid);
      batch.set(db.doc(newBase + '/todos/' + tid), t);
    }
    migrationEngine._onProgress('Todos', todos.length, todos.length);
    return batch.commit().then(function() { console.log('[Migration] Todos:', todos.length); });
  },

  _migrateCalendar: function(db, newBase, oldData) {
    var events = [];
    if (oldData.calendarSnap) {
      oldData.calendarSnap.forEach(function(doc) {
        if (doc.id === 'main' && doc.data().data) { events = doc.data().data; }
        else if (doc.id !== 'main' && doc.id !== '_all') { events.push(doc.data()); }
      });
    }
    if (events.length === 0) { migrationEngine._onProgress('Calendar', 0, 0); return Promise.resolve(); }
    var batches = [];
    var cb = db.batch();
    var cnt = 0;
    for (var i = 0; i < events.length; i++) {
      var ev = JSON.parse(JSON.stringify(events[i]));
      var eid = String(ev.id || ('cal_' + Date.now() + '_' + i));
      ev.id = eid;
      migrationEngine._addStdFields(ev, eid);
      cb.set(db.doc(newBase + '/calendar/' + eid), ev);
      cnt++;
      if (cnt >= 499) { batches.push(cb.commit()); cb = db.batch(); cnt = 0; }
    }
    if (cnt > 0) batches.push(cb.commit());
    migrationEngine._onProgress('Calendar', events.length, events.length);
    return Promise.all(batches).then(function() { console.log('[Migration] Calendar:', events.length); });
  },

  _migrateConversations: function(db, newBase, oldData) {
    var writes = [];
    if (oldData.convCurrent) {
      var cc = JSON.parse(JSON.stringify(oldData.convCurrent));
      migrationEngine._addStdFields(cc, 'current');
      writes.push(db.doc(newBase + '/conversations/current').set(cc));
    }
    if (oldData.convHistory) {
      var ch = JSON.parse(JSON.stringify(oldData.convHistory));
      if (ch.json && typeof ch.json === 'string') { try { ch.data = JSON.parse(ch.json); delete ch.json; } catch (e) {} }
      migrationEngine._addStdFields(ch, 'history');
      writes.push(db.doc(newBase + '/conversations/history').set(ch));
    }
    if (oldData.convAgentHistory) {
      var ah = JSON.parse(JSON.stringify(oldData.convAgentHistory));
      if (ah.json && typeof ah.json === 'string') { try { ah.data = JSON.parse(ah.json); delete ah.json; } catch (e) {} }
      migrationEngine._addStdFields(ah, 'main');
      writes.push(db.doc(newBase + '/agent_history/main').set(ah));
    }
    migrationEngine._onProgress('Conversations', 1, 1);
    return writes.length > 0 ? Promise.all(writes) : Promise.resolve();
  },

  _migratePulse: function(db, newBase, oldData) {
    if (!oldData.pulseMain) { migrationEngine._onProgress('Pulse', 0, 0); return Promise.resolve(); }
    var pulse = oldData.pulseMain;
    var writes = [];
    var goals = pulse.goals;
    if (typeof goals === 'string') { try { goals = JSON.parse(goals); } catch (e) { goals = []; } }
    var gd = { data: goals || [] };
    migrationEngine._addStdFields(gd, 'goals');
    writes.push(db.doc(newBase + '/pulse/goals').set(gd));
    var rem = pulse.reminders;
    if (typeof rem === 'string') { try { rem = JSON.parse(rem); } catch (e) { rem = []; } }
    var rd = { data: rem || [] };
    migrationEngine._addStdFields(rd, 'reminders');
    writes.push(db.doc(newBase + '/pulse/reminders').set(rd));
    migrationEngine._onProgress('Pulse', 1, 1);
    return Promise.all(writes);
  },

  _migrateLibrary: function(db, newBase, oldData) {
    var writes = [];
    if (oldData.libraryBrand) {
      var lb = JSON.parse(JSON.stringify(oldData.libraryBrand));
      if (lb.data && typeof lb.data === 'string') { try { lb.data = JSON.parse(lb.data); } catch (e) {} }
      migrationEngine._addStdFields(lb, 'brand');
      writes.push(db.doc(newBase + '/library/brand').set(lb));
    }
    if (oldData.libraryLife) {
      var ll = JSON.parse(JSON.stringify(oldData.libraryLife));
      if (ll.data && typeof ll.data === 'string') { try { ll.data = JSON.parse(ll.data); } catch (e) {} }
      migrationEngine._addStdFields(ll, 'life');
      writes.push(db.doc(newBase + '/library/life').set(ll));
    }
    migrationEngine._onProgress('Library', 1, 1);
    return writes.length > 0 ? Promise.all(writes) : Promise.resolve();
  },

  _migrateClients: function(db, newBase, oldData) {
    if (!oldData.clients || !oldData.clients.data) { migrationEngine._onProgress('Clients', 0, 0); return Promise.resolve(); }
    var cd = oldData.clients.data;
    if (!Array.isArray(cd)) {
      var d = migrationEngine._addStdFields(JSON.parse(JSON.stringify(cd)), 'main');
      migrationEngine._onProgress('Clients', 1, 1);
      return db.doc(newBase + '/clients/main').set(d);
    }
    var batch = db.batch();
    for (var i = 0; i < cd.length; i++) {
      var c = JSON.parse(JSON.stringify(cd[i]));
      var cid = String(c.id || ('client_' + i));
      c.id = cid;
      migrationEngine._addStdFields(c, cid);
      batch.set(db.doc(newBase + '/clients/' + cid), c);
    }
    migrationEngine._onProgress('Clients', cd.length, cd.length);
    return batch.commit();
  },

  _migrateCollection: function(db, newBase, snap, collectionName, label) {
    if (!snap || snap.empty) { migrationEngine._onProgress(label, 0, 0); return Promise.resolve(); }
    var docs = [];
    snap.forEach(function(doc) { docs.push({ id: doc.id, data: doc.data() }); });
    var batches = [];
    var cb = db.batch();
    var cnt = 0;
    for (var i = 0; i < docs.length; i++) {
      var d = JSON.parse(JSON.stringify(docs[i].data));
      d.id = d.id || docs[i].id;
      migrationEngine._addStdFields(d, d.id);
      cb.set(db.doc(newBase + '/' + collectionName + '/' + d.id), d);
      cnt++;
      if (cnt >= 499) { batches.push(cb.commit()); cb = db.batch(); cnt = 0; }
    }
    if (cnt > 0) batches.push(cb.commit());
    migrationEngine._onProgress(label, docs.length, docs.length);
    return Promise.all(batches).then(function() { console.log('[Migration]', label + ':', docs.length); });
  },

  _migrateSingleDoc: function(db, newBase, data, docPath, label) {
    if (!data) { migrationEngine._onProgress(label, 0, 0); return Promise.resolve(); }
    var d = JSON.parse(JSON.stringify(data));
    var parts = docPath.split('/');
    migrationEngine._addStdFields(d, parts[parts.length - 1]);
    migrationEngine._onProgress(label, 1, 1);
    return db.doc(newBase + '/' + docPath).set(d);
  },

  _migratePushSubs: function(db, newBase, oldData) {
    if (!oldData.pushSubscriptionsSnap || oldData.pushSubscriptionsSnap.empty) {
      migrationEngine._onProgress('Push Subscriptions', 0, 0);
      return Promise.resolve();
    }
    var subs = [];
    oldData.pushSubscriptionsSnap.forEach(function(doc) { subs.push(doc.data()); });
    var consolidated = { subscriptions: subs };
    migrationEngine._addStdFields(consolidated, 'push_subscriptions');
    migrationEngine._onProgress('Push Subscriptions', 1, 1);
    return db.doc(newBase + '/settings/push_subscriptions').set(consolidated);
  },

  _verify: function(db, newBase) {
    return Promise.all([
      db.collection(newBase + '/brands').get(),
      db.doc(newBase + '/settings/main').get(),
      db.doc(newBase + '/_meta/config').get()
    ]).then(function(results) {
      var bc = results[0].size;
      var se = results[1].exists;
      var ce = results[2].exists;
      console.log('[Migration] Verify: brands=' + bc + ' settings=' + se + ' config=' + ce);
      // v28.0: Require at least settings/main to exist
      if (!se) { console.error('[Migration] VERIFY FAIL: settings/main missing'); return false; }
      // v28.0: If local has brands, v4 must also have brands (0 in v4 = migration failed)
      var srcCount = 0;
      try { srcCount = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]').length; } catch (e) {}
      if (srcCount > 0 && bc === 0) {
        console.error('[Migration] VERIFY FAIL: 0 brands in v4 but', srcCount, 'locally');
        return false;
      }
      if (srcCount > 0 && bc < srcCount) {
        console.error('[Migration] VERIFY FAIL: brand count mismatch:', srcCount, 'vs', bc);
        return false;
      }
      // v28.0: Log any migration errors that were caught by _safeStep
      if (migrationEngine._errors.length > 0) {
        console.warn('[Migration] Completed with', migrationEngine._errors.length, 'non-fatal errors:', migrationEngine._errors);
      }
      return true;
    });
  }
};

function mergeByTimestamp(localItems, cloudItems, idField) {
  var merged = {};
  var cloudOrder = [];
  var lastSync = 0;
  // v30.1: Handle both numeric timestamps and ISO date strings in roweos_last_sync
  try {
    var _rawSync = localStorage.getItem('roweos_last_sync') || '0';
    lastSync = parseInt(_rawSync, 10);
    if (isNaN(lastSync)) { try { lastSync = new Date(_rawSync).getTime() || 0; } catch(e) { lastSync = 0; } }
  } catch(e) {}
  var firstSyncCompleted = localStorage.getItem('roweos_first_sync_completed') === 'true';

  // Cloud items are the authoritative baseline
  (cloudItems || []).forEach(function(item) {
    var key = item[idField];
    if (!key) {
      console.warn('[mergeByTimestamp] Item missing id field "' + idField + '":', JSON.stringify(item).substring(0, 100));
      return;
    }
    merged[key] = item;
    cloudOrder.push(key);
  });

  // Local items: only keep if (a) newer than cloud version or (b) created after last sync
  (localItems || []).forEach(function(item) {
    var key = item[idField];
    if (!key) return;
    if (merged[key]) {
      var cloudTs = _normalizeTs(merged[key]._modifiedAt);
      var localTs = _normalizeTs(item._modifiedAt);
      if (localTs > cloudTs) {
        merged[key] = item;
      }
    } else if (firstSyncCompleted) {
      var createdAt = _normalizeTs(item._modifiedAt || item._createdAt);
      // v27.1: Also preserve local items when lastSync is 0 (first sync scenario)
      // -- a local item with a valid timestamp that doesn't exist in cloud is genuinely
      // new, not a cloud deletion. Only treat as deleted if lastSync > 0 AND item
      // was created before that sync (meaning cloud had a chance to see it and chose
      // not to keep it).
      if (lastSync === 0 || createdAt > lastSync) {
        merged[key] = item;
        cloudOrder.push(key);
      }
    } else {
      merged[key] = item;
      cloudOrder.push(key);
    }
  });

  var result = [];
  cloudOrder.forEach(function(k) { if (merged[k]) result.push(merged[k]); });
  return result;
}

// v23.0: Mode-aware debounced auto-sync
var _autoSyncTimer = null;
// v25.0: DEPRECATED -- write-through sync handles all writes immediately
function scheduleAutoSync() {
  // No-op: retained for backward compatibility with any remaining callers
  if (typeof ROWEOS_DEBUG !== 'undefined' && ROWEOS_DEBUG) console.log('[Sync V3] scheduleAutoSync called (no-op)');
}

// v9.1.14: Global saveBrands function
// v23.0: Also stamps brandSettings._modifiedAt for conflict resolution
function saveBrands() {
  console.log('[saveBrands] v27.1 CALLED. brands=' + (typeof brands !== 'undefined' ? brands.length : 'UNDEFINED'));
  try {
    // v27.0: Backfill id using name-based stable ID (must match merge backfill in listeners)
    var now = Date.now();
    for (var i = 0; i < brands.length; i++) {
      brands[i]._modifiedAt = now;
    }
    localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brands));
    try {
      var _bs = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}');
      _bs._modifiedAt = now;
      localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(_bs));
    } catch(_bse) {}
    stampLocalSave();
    console.log('[saveBrands] Saved', brands.length, 'brands to localStorage');
    // v27.0: Write-through to Firestore -- write each brand individually, then _all doc
    var db = typeof getDB === 'function' ? getDB() : null;
    var _fbUser = typeof firebaseUser !== 'undefined' ? firebaseUser : null;
    var _localOnly = typeof isLocalOnlyMode === 'function' ? isLocalOnlyMode() : false;
    console.log('[saveBrands] Firestore check: db=' + !!db + ' firebaseUser=' + !!_fbUser + ' localOnly=' + _localOnly);
    if (!db) console.error('[saveBrands] BLOCKED: getDB() returned null -- Firebase not initialized');
    else if (!_fbUser) console.error('[saveBrands] BLOCKED: firebaseUser is null -- not signed in');
    else if (_localOnly) console.error('[saveBrands] BLOCKED: isLocalOnlyMode=true -- sync mode is local-only');
    if (db && _fbUser && !_localOnly) {
      var basePath = 'roweos_users/' + firebaseUser.uid;
      // v28.3: Fetch existing docs FIRST, then batch write + delete ghosts atomically
      // This prevents the onSnapshot listener from seeing ghost docs between write and cleanup
      var _writtenBrandIds = [];
      brands.forEach(function(brand) {
        var docId = brand.id || ('brand_name_' + (brand.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'));
        _writtenBrandIds.push(docId);
      });
      db.collection(basePath + '/brands').get().then(function(existingSnap) {
        var batch = db.batch();
        // Write all current brands
        brands.forEach(function(brand, idx) {
          var data = JSON.parse(JSON.stringify(brand));
          Object.keys(data).forEach(function(k) {
            if (typeof data[k] === 'string' && data[k].indexOf('data:') === 0 && data[k].length > 50000) {
              data[k] = '';
            }
          });
          data._modifiedAt = brand._modifiedAt || now;
          var docId = brand.id || ('brand_name_' + (brand.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'));
          batch.set(db.doc(basePath + '/brands/' + docId), data, { merge: true });
        });
        // Delete ghosts in the SAME batch (atomic — no window for onSnapshot to resurrect)
        existingSnap.forEach(function(doc) {
          if (doc.id === '_all') return;
          if (_writtenBrandIds.indexOf(doc.id) === -1) {
            console.log('[saveBrands] v28.3 Deleting ghost brand doc in batch:', doc.id);
            batch.delete(doc.ref);
          }
        });
        return batch.commit();
      }).then(function() {
        console.log('[saveBrands] v28.3 batch: All', brands.length, 'brands synced + ghosts deleted atomically');
        localStorage.setItem('roweos_last_sync', String(Date.now()));
      }).catch(function(err) {
        console.error('[saveBrands] v28.3 batch write failed:', err.message);
      });
      // v28.3: Write _all doc with ALL brand fields (not a subset). Strip only large base64 data.
      try {
        var allBrandsData = brands.map(function(b) {
          var d = JSON.parse(JSON.stringify(b));
          // Strip large base64 to fit Firestore 1MB doc limit
          Object.keys(d).forEach(function(k) {
            if (typeof d[k] === 'string' && d[k].indexOf('data:') === 0 && d[k].length > 50000) {
              d[k] = '';
            }
          });
          return d;
        });
        db.doc(basePath + '/brands/_all').set({
          items: allBrandsData, count: allBrandsData.length, updatedAt: new Date().toISOString()
        }).catch(function(err) {
          console.warn('[saveBrands] _all doc write failed (OK, individual docs are primary):', err.message);
        });
      } catch(e) {}
    }

    // v28.0: Dual-write brands to v4 namespace
    if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
      try {
        var _v4db = typeof getDB === 'function' ? getDB() : null;
        var _v4base = _getV4BasePath();
        if (_v4db && _v4base) {
          var _v4batch = _v4db.batch();
          var _v4ids = [];
          for (var _v4i = 0; _v4i < brands.length; _v4i++) {
            var _v4brand = JSON.parse(JSON.stringify(brands[_v4i]));
            var _v4id = _v4brand.id || ('brand_name_' + (_v4brand.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'));
            _v4brand.id = _v4id;
            _v4brand._modifiedAt = _v4brand._modifiedAt || now;
            _v4brand._createdAt = _v4brand._createdAt || now;
            _v4brand._deviceId = _getDeviceId();
            _v4brand._version = (_v4brand._version || 0) + 1;
            if (!_v4brand._fieldMeta) {
              _v4brand._fieldMeta = {};
              var _v4fk = Object.keys(_v4brand);
              for (var _v4fi = 0; _v4fi < _v4fk.length; _v4fi++) {
                if (_v4fk[_v4fi].charAt(0) !== '_' && _v4fk[_v4fi] !== 'id') {
                  _v4brand._fieldMeta[_v4fk[_v4fi]] = { at: now, by: _getDeviceId() };
                }
              }
            }
            // Strip large data URIs
            var _v4keys = Object.keys(_v4brand);
            for (var _v4ki = 0; _v4ki < _v4keys.length; _v4ki++) {
              if (typeof _v4brand[_v4keys[_v4ki]] === 'string' && _v4brand[_v4keys[_v4ki]].indexOf('data:') === 0 && _v4brand[_v4keys[_v4ki]].length > 50000) {
                _v4brand[_v4keys[_v4ki]] = '';
              }
            }
            _v4ids.push(_v4id);
            _v4batch.set(_v4db.doc(_v4base + '/brands/' + _v4id), _v4brand, { merge: true });
          }
          _v4batch.commit().then(function() {
            console.log('[saveBrands] v28.0 v4 dual-write:', brands.length, 'brands');
            // Clean ghosts in v4 namespace
            _v4db.collection(_v4base + '/brands').get().then(function(snap) {
              snap.forEach(function(doc) {
                if (_v4ids.indexOf(doc.id) === -1) {
                  doc.ref.delete();
                }
              });
            });
          }).catch(function(err) {
            console.warn('[saveBrands] v4 dual-write failed:', err.message);
          });
        }
      } catch (_v4e) {
        console.warn('[saveBrands] v4 dual-write error:', _v4e.message);
      }
    }
  } catch (e) {
    console.error('[saveBrands] Error saving brands:', e);
  }
}

// Data migration from v3.x to v4.8.0
function migrateDataToV4() {
  console.log('=== RoweOS v4.8.0: Checking for data migration ===');
  
  var storedVersion = localStorage.getItem(ROWEOS_DATA_VERSION_KEY);
  
  // First time on v4.8.0 or upgrading from v3.x
  if (!storedVersion || storedVersion.startsWith('3.')) {
    console.log('Migrating data from v3.x to v4.8.0...');
    
    // OLD KEYS (v3.x)
    var OLD_KEYS = {
      brands: 'roweosBrands',
      brandSettings: 'roweos_brand_settings', 
      onboarding: 'onboardingCompleted',
      anthropicKey: 'roweos_anthropic_key',
      openaiKey: 'roweos_openai_key',
      googleKey: 'roweos_google_key'
    };
    
    // Migrate brands (most critical)
    var oldBrands = localStorage.getItem(OLD_KEYS.brands);
    if (oldBrands && !localStorage.getItem(USER_DATA_KEYS.brands)) {
      localStorage.setItem(USER_DATA_KEYS.brands, oldBrands);
      console.log('✓ Migrated brands data:', JSON.parse(oldBrands).length, 'brands');
    }
    
    // Migrate brand settings
    var oldSettings = localStorage.getItem(OLD_KEYS.brandSettings);
    if (oldSettings && !localStorage.getItem(USER_DATA_KEYS.brandSettings)) {
      localStorage.setItem(USER_DATA_KEYS.brandSettings, oldSettings);
      console.log('✓ Migrated brand settings');
    }
    
    // Migrate onboarding completion
    var oldOnboarding = localStorage.getItem(OLD_KEYS.onboarding);
    if (oldOnboarding && !localStorage.getItem(USER_DATA_KEYS.onboardingCompleted)) {
      localStorage.setItem(USER_DATA_KEYS.onboardingCompleted, oldOnboarding);
      console.log('✓ Migrated onboarding status');
    }
    
    // API keys don't need migration - they use same keys
    console.log('✓ API keys preserved (using same keys)');
    
    // Set version
    localStorage.setItem(ROWEOS_DATA_VERSION_KEY, ROWEOS_VERSION);
    console.log('✓ Data migration complete - now on v' + ROWEOS_VERSION);
    console.log('=== All user data safely migrated ===');
  } else if (storedVersion === ROWEOS_VERSION) {
    console.log('✓ Data already on v' + storedVersion + ' - no migration needed');
  } else {
    console.log('✓ Data on v' + storedVersion + ' - future version?');
  }
}

// Initialize brands array from localStorage
function initializeBrands() {
  console.log('=== INITIALIZING BRANDS ===');
  console.log('Looking for key:', USER_DATA_KEYS.brands);
  
  var stored = localStorage.getItem(USER_DATA_KEYS.brands);
  console.log('Raw localStorage value:', stored ? 'Found (' + stored.length + ' chars)' : 'NULL');
  
  if (stored) {
    try {
      var parsed = JSON.parse(stored);
      console.log('✓ Successfully parsed brands from localStorage');
      console.log('✓ Brand count:', parsed.length);
      if (parsed.length > 0) {
        console.log('✓ Brands loaded:', parsed.map(function(b) { return b.name; }).join(', '));
      }
      return parsed;
    } catch (e) {
      console.error('✗ Error parsing brands:', e);
      console.error('✗ Raw data that failed to parse:', stored);
      return [];
    }
  }
  
  console.log('⚠ No brands found in localStorage - starting with empty array');
  console.log('⚠ This is normal for a fresh install');
  return [];
}

// Load/reload brands from localStorage (used by Firebase sync)
function loadBrands() {
  console.log('=== LOADING BRANDS (Firebase sync) ===');
  
  var stored = localStorage.getItem(USER_DATA_KEYS.brands);
  console.log('loadBrands: localStorage value:', stored ? 'Found (' + stored.length + ' chars)' : 'NULL');
  
  if (stored) {
    try {
      var parsed = JSON.parse(stored);
      console.log('loadBrands: Parsed', parsed.length, 'brands');

      // v27.0: Backfill name-based stable id on all brands (must match merge ID scheme)
      var _needsIdSave = false;
      for (var _bi = 0; _bi < parsed.length; _bi++) {
        var _nameId = 'brand_name_' + (parsed[_bi].name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (!parsed[_bi].id || parsed[_bi].id.indexOf('brand_name_') !== 0) {
          parsed[_bi].id = _nameId;
          _needsIdSave = true;
        }
      }
      if (_needsIdSave) {
        localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(parsed));
        console.log('[loadBrands] Backfilled name-based brand IDs');
      }
      // Update the global brands array
      brands.length = 0; // Clear existing
      for (var i = 0; i < parsed.length; i++) {
        brands.push(parsed[i]);
      }
      
      console.log('loadBrands: Global brands array updated, count:', brands.length);

      // v28.1: Resolve selectedBrand by stable brand ID (survives reorder)
      var _savedBrandId = localStorage.getItem('roweos_selected_brand_id');
      // v28.6: Fall back to primary brand if no selected brand saved on this device
      if (!_savedBrandId) _savedBrandId = localStorage.getItem('roweos_primary_brand_id');
      if (_savedBrandId && brands.length > 0) {
        var _resolvedIdx = -1;
        for (var _ri = 0; _ri < brands.length; _ri++) {
          if (brands[_ri].id === _savedBrandId) { _resolvedIdx = _ri; break; }
        }
        if (_resolvedIdx >= 0) {
          selectedBrand = _resolvedIdx;
          localStorage.setItem('roweos_selected_brand', String(_resolvedIdx));
          console.log('[loadBrands] Resolved brand by ID: ' + _savedBrandId + ' -> index ' + _resolvedIdx);
        }
      }

      // Ensure brand settings exist for all brands
      var storedSettings = localStorage.getItem(USER_DATA_KEYS.brandSettings);
      var settings = storedSettings ? JSON.parse(storedSettings) : {};
      var settingsUpdated = false;
      for (var j = 0; j < brands.length; j++) {
        if (!settings[j]) {
          settings[j] = {
            provider: 'anthropic',
            model: 'claude-sonnet-4-6'
          };
          settingsUpdated = true;
          console.log('loadBrands: Created missing settings for brand', j, '(' + brands[j].name + ')');
        }
      }
      if (settingsUpdated) {
        localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(settings));
        console.log('loadBrands: Saved auto-created brand settings');
      }
      // v24.10: Only refresh in-memory brandSettings if user didn't just save model config
      var _skipBsRefresh = (typeof _brandModelConfigSavedAt !== 'undefined' && _brandModelConfigSavedAt > 0 && (Date.now() - _brandModelConfigSavedAt) < (typeof _BRAND_MODEL_CONFIG_GRACE !== 'undefined' ? _BRAND_MODEL_CONFIG_GRACE : 15000));
      if (!_skipBsRefresh) {
        brandSettings = settings;
      } else {
        console.log('[loadBrands] Skipping brandSettings overwrite — local model config saved recently');
      }
      
      // Re-render brand UI
      if (typeof renderBrands === 'function') {
        renderBrands();
        console.log('loadBrands: renderBrands called');
      }
      
      // Update all brand selectors (including task modal)
      if (typeof updateBrandSelectors === 'function') {
        updateBrandSelectors(true); // Force update
        console.log('loadBrands: updateBrandSelectors called');
      }
      
      // Sync mobile brand selector
      if (typeof syncMobileBrandV2 === 'function') {
        syncMobileBrandV2();
      }
      
      return true;
    } catch (e) {
      console.error('loadBrands: Parse error:', e);
      return false;
    }
  }
  
  console.log('loadBrands: No brands in localStorage');
  return false;
}

// Export brands to JSON file
function exportBrands() {
  console.log('=== EXPORTING BRANDS ===');
  
  if (brands.length === 0) {
    showToast('No brands to export', 'error');
    console.warn('⚠ Export cancelled - no brands found');
    return;
  }
  
  // Create export data
  var exportData = {
    version: '4.3.2',
    exportDate: new Date().toISOString(),
    brandCount: brands.length,
    brands: brands,
    brandSettings: JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}')
  };
  
  // Create blob and download
  var dataStr = JSON.stringify(exportData, null, 2);
  var dataBlob = new Blob([dataStr], { type: 'application/json' });
  var url = URL.createObjectURL(dataBlob);
  
  // Create download link
  var link = document.createElement('a');
  link.href = url;
  link.download = 'roweos-brands-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log('✓ Exported', brands.length, 'brands');
  console.log('✓ File:', link.download);
  showToast('Exported ' + brands.length + ' brands successfully', 'success');
}

// Import brands from JSON file
// ═══════════════════════════════════════════════════════════════════════════════
// RECOVERY SCRIPT HANDLER (v9.1.14)
// Extracts brand data from RTF/TXT recovery scripts and applies directly
// ═══════════════════════════════════════════════════════════════════════════════

function runRecoveryScript(event) {
  console.log('=== RUNNING RECOVERY SCRIPT ===');
  
  var file = event.target.files[0];
  if (!file) {
    console.warn('No file selected');
    return;
  }
  
  console.log('Reading recovery script:', file.name);
  showToast('Processing recovery script...', 'info');
  
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var content = e.target.result;
      console.log('File size:', content.length, 'chars');

      var extractedBrands = null;

      // v15.27: Try JSON export format first (from exportBrands())
      if (file.name.endsWith('.json')) {
        try {
          var jsonData = JSON.parse(content);
          if (jsonData.brands && Array.isArray(jsonData.brands)) {
            extractedBrands = jsonData.brands;
            console.log('[Recovery] Parsed JSON export with', extractedBrands.length, 'brands');
            // Also restore brandSettings if present
            if (jsonData.brandSettings) {
              try {
                localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(jsonData.brandSettings));
                console.log('[Recovery] Restored brandSettings from JSON export');
              } catch (bsErr) { console.warn('[Recovery] brandSettings restore error:', bsErr); }
            }
          } else if (Array.isArray(jsonData)) {
            // Plain array of brand objects
            extractedBrands = jsonData;
            console.log('[Recovery] Parsed JSON array with', extractedBrands.length, 'brands');
          }
        } catch (jsonErr) {
          console.warn('[Recovery] JSON parse failed, falling back to script extraction');
        }
      }

      // Fallback: legacy RTF/TXT/JS recovery script extraction
      if (!extractedBrands || extractedBrands.length === 0) {
        extractedBrands = extractBrandsFromRecoveryScript(content);
      }

      if (!extractedBrands || extractedBrands.length === 0) {
        throw new Error('Could not extract brand data from file');
      }

      console.log('Extracted', extractedBrands.length, 'brands');

      // v15.27: Show brand recovery modal with selection
      window._recoveryBrands = extractedBrands;
      showBrandRecoveryModal(extractedBrands);

    } catch (error) {
      console.error('Recovery failed:', error.message);
      showToast('Recovery failed: ' + error.message, 'error');
    }
  };
  
  reader.onerror = function() {
    console.error('File read error');
    showToast('Failed to read file', 'error');
  };
  
  reader.readAsText(file);
  event.target.value = '';
}

function extractBrandsFromRecoveryScript(content) {
  console.log('Extracting brands from content...');
  
  var text = content;
  
  // Find start of actual content
  var jsStart = text.indexOf('// RoweOS');
  if (jsStart === -1) jsStart = text.indexOf('var recoveredBrands');
  if (jsStart === -1) jsStart = text.indexOf('//');
  if (jsStart > 0) {
    text = text.substring(jsStart);
  }
  
  // Clean RTF line by line
  var lines = text.split('\n');
  var cleaned = [];
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    
    // Remove trailing backslash
    while (line.length > 0 && line.charAt(line.length - 1) === '\\') {
      line = line.substring(0, line.length - 1);
    }
    
    // Remove RTF hex codes
    line = line.replace(/\\'[0-9a-fA-F]{2}/g, '');
    
    // Remove RTF unicode
    line = line.replace(/\\u\d+/g, '');
    
    // Convert RTF braces
    line = line.split('\\{').join('{');
    line = line.split('\\}').join('}');
    
    // Handle escaped apostrophes
    line = line.split("\\\\'").join("'");
    
    // Remove other RTF control words
    line = line.replace(/\\[a-z]+\d*/gi, '');
    
    cleaned.push(line);
  }
  
  text = cleaned.join('\n');
  
  // Find recoveredBrands array bounds
  var startMarker = 'var recoveredBrands = [';
  var startIdx = text.indexOf(startMarker);
  if (startIdx === -1) {
    startMarker = 'recoveredBrands = [';
    startIdx = text.indexOf(startMarker);
  }
  
  if (startIdx === -1) {
    console.error('Could not find recoveredBrands');
    return null;
  }
  
  var arrayStart = text.indexOf('[', startIdx);
  var bracketCount = 0;
  var arrayEnd = -1;
  
  for (var i = arrayStart; i < text.length; i++) {
    if (text.charAt(i) === '[') bracketCount++;
    if (text.charAt(i) === ']') {
      bracketCount--;
      if (bracketCount === 0) {
        arrayEnd = i;
        break;
      }
    }
  }
  
  if (arrayEnd === -1) {
    console.error('Could not find end of brands array');
    return null;
  }
  
  var arrayText = text.substring(arrayStart + 1, arrayEnd);
  
  // Extract each brand object
  var brandsData = [];
  var braceDepth = 0;
  var currentObjStart = -1;
  
  for (var i = 0; i < arrayText.length; i++) {
    var ch = arrayText.charAt(i);
    if (ch === '{') {
      if (braceDepth === 0) currentObjStart = i;
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
      if (braceDepth === 0 && currentObjStart !== -1) {
        brandsData.push(arrayText.substring(currentObjStart, i + 1));
        currentObjStart = -1;
      }
    }
  }
  
  console.log('Found ' + brandsData.length + ' brand objects');
  
  // Parse each brand using simple string extraction
  var brands = [];
  
  for (var b = 0; b < brandsData.length; b++) {
    var objText = brandsData[b];
    var brand = {};
    
    // Extract name (required)
    var nameMatch = objText.match(/name:\s*['"]([^'"]+)['"]/);
    if (nameMatch) brand.name = nameMatch[1];
    
    // Extract other simple fields
    var taglineMatch = objText.match(/tagline:\s*['"]([^'"]+)['"]/);
    if (taglineMatch) brand.tagline = taglineMatch[1];
    
    var locationMatch = objText.match(/location:\s*['"]([^'"]+)['"]/);
    if (locationMatch) brand.location = locationMatch[1];
    
    var industryMatch = objText.match(/industry:\s*['"]([^'"]+)['"]/);
    if (industryMatch) brand.industry = industryMatch[1];
    
    var audienceMatch = objText.match(/audience:\s*['"]([^'"]+)['"]/);
    if (audienceMatch) brand.audience = audienceMatch[1];
    
    // For longer fields, use a more flexible pattern
    var essenceStart = objText.indexOf("essence:");
    if (essenceStart !== -1) {
      var essenceQuote = objText.indexOf("'", essenceStart);
      if (essenceQuote !== -1) {
        var essenceEnd = objText.indexOf("',", essenceQuote + 1);
        if (essenceEnd !== -1) {
          brand.essence = objText.substring(essenceQuote + 1, essenceEnd);
        }
      }
    }
    
    var voiceStart = objText.indexOf("voice:");
    if (voiceStart !== -1) {
      var voiceQuote = objText.indexOf("'", voiceStart);
      if (voiceQuote !== -1) {
        var voiceEnd = objText.indexOf("',", voiceQuote + 1);
        if (voiceEnd !== -1) {
          brand.voice = objText.substring(voiceQuote + 1, voiceEnd);
        }
      }
    }
    
    var positioningMatch = objText.match(/positioning:\s*['"]([^'"]+)['"]/);
    if (positioningMatch) brand.positioning = positioningMatch[1];
    
    // Extract values array
    var valuesMatch = objText.match(/values:\s*\[([^\]]+)\]/);
    if (valuesMatch) {
      brand.values = [];
      var valueItems = valuesMatch[1].match(/['"]([^'"]+)['"]/g);
      if (valueItems) {
        for (var v = 0; v < valueItems.length; v++) {
          brand.values.push(valueItems[v].replace(/['"]/g, ''));
        }
      }
    }
    
    // Extract visual colors
    var colorsMatch = objText.match(/colors:\s*\[([^\]]+)\]/);
    if (colorsMatch) {
      brand.visual = brand.visual || {};
      brand.visual.colors = [];
      var colorItems = colorsMatch[1].match(/['"]([^'"]+)['"]/g);
      if (colorItems) {
        for (var c = 0; c < colorItems.length; c++) {
          brand.visual.colors.push(colorItems[c].replace(/['"]/g, ''));
        }
      }
    }
    
    // Extract visual fonts
    var fontsMatch = objText.match(/fonts:\s*\[([^\]]+)\]/);
    if (fontsMatch) {
      brand.visual = brand.visual || {};
      brand.visual.fonts = [];
      var fontItems = fontsMatch[1].match(/['"]([^'"]+)['"]/g);
      if (fontItems) {
        for (var f = 0; f < fontItems.length; f++) {
          brand.visual.fonts.push(fontItems[f].replace(/['"]/g, ''));
        }
      }
    }
    
    if (brand.name) {
      brands.push(brand);
      console.log('Parsed brand: ' + brand.name);
    }
  }
  
  return brands;
}


// v15.27: Brand Recovery Modal — select brands to add or replace all
function showBrandRecoveryModal(extractedBrands) {
  // Remove any existing recovery modal
  var existing = document.getElementById('brandRecoveryModal');
  if (existing) existing.parentNode.removeChild(existing);

  var listHtml = '';
  for (var i = 0; i < extractedBrands.length; i++) {
    var b = extractedBrands[i];
    var displayName = escapeHtml(b.shortName || b.name);
    var detail = b.tagline ? escapeHtml(b.tagline) : (b.industry ? escapeHtml(b.industry) : '');
    listHtml += '<label style="display: flex; align-items: center; gap: var(--space-3); padding: 10px 12px; border-radius: var(--radius-md); cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'transparent\'">';
    listHtml += '<input type="checkbox" class="recovery-brand-cb" data-brand-index="' + i + '" checked style="width: 18px; height: 18px; accent-color: var(--accent, #a89878); cursor: pointer;">';
    listHtml += '<div style="flex: 1; min-width: 0;">';
    listHtml += '<div style="font-weight: 600; color: var(--text-primary);">' + displayName + '</div>';
    if (detail) {
      listHtml += '<div style="font-size: var(--text-sm); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + detail + '</div>';
    }
    listHtml += '</div></label>';
  }

  var modalHtml = '<div id="brandRecoveryModal" class="modal-overlay" style="display: none;">';
  modalHtml += '<div class="modal" style="max-width: 540px;">';

  // Header
  modalHtml += '<div class="modal-header">';
  modalHtml += '<div class="modal-title">';
  modalHtml += '<svg class="svg-icon-lg" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  modalHtml += ' Brand Recovery';
  modalHtml += '</div>';
  modalHtml += '<button class="modal-close" onclick="closeModal(\'brandRecoveryModal\')">';
  modalHtml += '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  modalHtml += '</button></div>';

  // Body
  modalHtml += '<div class="modal-body">';
  modalHtml += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">';
  modalHtml += '<span style="font-size: var(--text-sm); color: var(--text-secondary);">Found ' + extractedBrands.length + ' brand' + (extractedBrands.length !== 1 ? 's' : '') + '</span>';
  modalHtml += '<a href="#" onclick="toggleRecoverySelectAll(event)" id="recoveryToggleAll" style="font-size: var(--text-sm); color: var(--accent, #a89878); text-decoration: none;">Deselect All</a>';
  modalHtml += '</div>';
  modalHtml += '<div style="max-height: 320px; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: var(--space-2);">';
  modalHtml += listHtml;
  modalHtml += '</div></div>';

  // Footer
  modalHtml += '<div class="modal-footer" style="display: flex; gap: var(--space-3); justify-content: flex-end;">';
  modalHtml += '<button class="modal-button-secondary" onclick="closeModal(\'brandRecoveryModal\')" style="min-width: 80px;">Cancel</button>';
  modalHtml += '<button class="modal-button-secondary" onclick="applyBrandRecovery(window._recoveryBrands)" style="min-width: 140px; color: var(--status-error, #ef4444);">Replace All Brands</button>';
  modalHtml += '<button class="modal-button-primary" onclick="applyBrandRecoveryMerge(window._recoveryBrands)" style="min-width: 120px;">Add Selected</button>';
  modalHtml += '</div>';

  modalHtml += '</div></div>';

  // Inject and open
  var container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container.firstChild);
  openModal('brandRecoveryModal');
}

function toggleRecoverySelectAll(e) {
  e.preventDefault();
  var checkboxes = document.querySelectorAll('.recovery-brand-cb');
  var toggle = document.getElementById('recoveryToggleAll');
  // If any unchecked, select all; otherwise deselect all
  var anyUnchecked = false;
  for (var i = 0; i < checkboxes.length; i++) {
    if (!checkboxes[i].checked) { anyUnchecked = true; break; }
  }
  var newState = anyUnchecked;
  for (var k = 0; k < checkboxes.length; k++) {
    checkboxes[k].checked = newState;
  }
  toggle.textContent = newState ? 'Deselect All' : 'Select All';
}

function applyBrandRecoveryMerge(extractedBrands) {
  // v15.27: Merge selected brands into existing portfolio
  var checkboxes = document.querySelectorAll('.recovery-brand-cb');
  var selectedIndices = [];
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) {
      selectedIndices.push(parseInt(checkboxes[i].getAttribute('data-brand-index'), 10));
    }
  }

  if (selectedIndices.length === 0) {
    showToast('No brands selected', 'info');
    return;
  }

  closeModal('brandRecoveryModal');

  // Filter to selected brands
  var selectedBrands = [];
  for (var s = 0; s < selectedIndices.length; s++) {
    selectedBrands.push(extractedBrands[selectedIndices[s]]);
  }

  // Check for duplicates by name
  var existingNames = {};
  for (var e = 0; e < brands.length; e++) {
    var eName = (brands[e].shortName || brands[e].name || '').toLowerCase().trim();
    if (eName) existingNames[eName] = true;
  }

  var added = [];
  var skipped = [];
  for (var n = 0; n < selectedBrands.length; n++) {
    var bName = (selectedBrands[n].shortName || selectedBrands[n].name || '').toLowerCase().trim();
    if (existingNames[bName]) {
      skipped.push(selectedBrands[n].shortName || selectedBrands[n].name);
    } else {
      added.push(selectedBrands[n]);
      existingNames[bName] = true;
    }
  }

  if (added.length === 0) {
    showToast('All selected brands already exist: ' + skipped.length + ' skipped', 'info');
    return;
  }

  // Append new brands and save
  var startIdx = brands.length;
  for (var a = 0; a < added.length; a++) {
    brands.push(added[a]);
  }
  localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brands));

  // Create brandSettings entries for new indices only (preserve existing)
  var brandSettings = {};
  try { brandSettings = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings)) || {}; } catch (ex) { brandSettings = {}; }
  for (var b = 0; b < added.length; b++) {
    brandSettings[startIdx + b] = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6'
    };
  }
  localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(brandSettings));

  // Toast with results
  var msg = added.length + ' brand' + (added.length !== 1 ? 's' : '') + ' added';
  if (skipped.length > 0) {
    msg += ', ' + skipped.length + ' duplicate' + (skipped.length !== 1 ? 's' : '') + ' skipped';
  }
  showToast(msg, 'success');
  console.log('[BrandRecovery] Merge complete —', msg);

  // Reload after 2s
  setTimeout(function() {
    location.reload();
  }, 2000);
}

function applyBrandRecovery(extractedBrands) {
  closeModal('brandRecoveryModal');
  // v15.27: Clean up dynamic modal element
  var recoveryEl = document.getElementById('brandRecoveryModal');
  if (recoveryEl && recoveryEl.parentNode) recoveryEl.parentNode.removeChild(recoveryEl);
  console.log('Applying brand recovery...');
  
  // Store brands
  brands = extractedBrands;
  localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brands));
  console.log('Stored', brands.length, 'brands');
  
  // Create default brand settings
  var brandSettings = {};
  for (var i = 0; i < brands.length; i++) {
    brandSettings[i] = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6'
    };
  }
  localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(brandSettings));
  console.log('Created brand settings');
  
  // Mark onboarding as complete
  localStorage.setItem('roweos_onboarding_completed', 'true');
  localStorage.setItem('roweos_welcomed', 'true');
  // v30.5: Clear tier selection flag — onboarding is done, no longer needed
  try { localStorage.removeItem('roweos_tier_selected'); } catch(e) {}
  
  // Initialize empty libraries if not present
  if (!localStorage.getItem(USER_DATA_KEYS.library)) {
    localStorage.setItem(USER_DATA_KEYS.library, JSON.stringify([]));
  }
  if (!localStorage.getItem(USER_DATA_KEYS.promptLibrary)) {
    localStorage.setItem(USER_DATA_KEYS.promptLibrary, JSON.stringify([]));
  }
  
  console.log('Recovery complete!');
  showToast('Recovery complete! ' + brands.length + ' brands restored', 'success');
  
  // Reload after 2 seconds
  setTimeout(function() {
    console.log('Reloading app...');
    location.reload();
  }, 2000);
}


// Brand Health Check System
function checkBrandHealth() {
  console.log('=== BRAND HEALTH CHECK ===');
  
  var issues = [];
  var warnings = [];
  
  // Check 1: Brand count
  if (brands.length === 0) {
    warnings.push('No brands configured');
  } else {
    console.log('✓ Brand count:', brands.length);
  }
  
  // Check 2: Validate each brand
  brands.forEach(function(brand, idx) {
    var brandIssues = [];
    
    // Required fields
    if (!brand.name || brand.name.trim() === '') {
      brandIssues.push('Missing brand name');
    }
    if (!brand.tagline) {
      warnings.push('Brand "' + (brand.name || idx) + '" missing tagline');
    }
    if (!brand.voice) {
      warnings.push('Brand "' + (brand.name || idx) + '" missing voice');
    }
    
    // Data integrity
    if (brand.name && brand.name.length > 100) {
      warnings.push('Brand "' + brand.name + '" has unusually long name');
    }
    
    if (brandIssues.length > 0) {
      issues.push('Brand #' + idx + ': ' + brandIssues.join(', '));
    }
  });
  
  // Check 3: Brand settings alignment
  var brandSettings = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}');
  var missingSettings = [];
  brands.forEach(function(brand, idx) {
    if (!brandSettings[idx]) {
      missingSettings.push(brand.name);
    }
  });
  if (missingSettings.length > 0) {
    warnings.push('Missing settings for: ' + missingSettings.join(', '));
  }
  
  // Check 4: localStorage size
  var totalSize = 0;
  for (var key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      totalSize += (localStorage[key].length + key.length) * 2; // UTF-16 = 2 bytes per char
    }
  }
  var sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  console.log('✓ localStorage usage:', sizeMB, 'MB');
  if (totalSize > 8 * 1024 * 1024) { // 8MB
    warnings.push('localStorage getting large (' + sizeMB + ' MB)');
  }
  
  // Report results
  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ Brand health: EXCELLENT');
    console.log('✓ All brands valid');
    console.log('✓ All settings configured');
    console.log('✓ localStorage healthy');
    return { status: 'excellent', issues: [], warnings: [] };
  }
  
  if (issues.length > 0) {
    console.warn('❌ Brand health: ISSUES FOUND');
    issues.forEach(function(issue) {
      console.error('  ✗', issue);
    });
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ Brand health: WARNINGS');
    warnings.forEach(function(warning) {
      console.warn('  ⚠', warning);
    });
  }
  
  console.log('=== HEALTH CHECK COMPLETE ===');
  return { status: issues.length > 0 ? 'critical' : 'warning', issues: issues, warnings: warnings };
}

// Auto-run health check on brand changes
function validateAndSaveBrands() {
  // Save brands
  localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brands));
  
  // Run health check (throttled)
  if (!window.lastHealthCheck || Date.now() - window.lastHealthCheck > 5000) {
    window.lastHealthCheck = Date.now();
    checkBrandHealth();
  }
  
  // Update UI
  updateBrandSelectors();
}

// Manual health check trigger (from Settings button)
function runBrandHealthCheck() {
  console.log('');
  console.log('🏥 RUNNING MANUAL HEALTH CHECK...');
  console.log('');
  
  var result = checkBrandHealth();
  
  if (result.status === 'excellent') {
    showToast('✅ All brands healthy!', 'success');
  } else if (result.status === 'warning') {
    showToast('⚠️ ' + result.warnings.length + ' warnings found (check console)', 'warning');
  } else {
    showToast('❌ ' + result.issues.length + ' issues found (check console)', 'error');
  }
}

// Performance monitoring utilities
var perfMonitor = {
  marks: {},
  measures: [],
  
  start: function(label) {
    this.marks[label] = Date.now();
    console.log('⏱️ [PERF] Started:', label);
  },
  
  end: function(label) {
    if (!this.marks[label]) {
      console.warn('⚠️ [PERF] No start mark for:', label);
      return;
    }
    
    var duration = Date.now() - this.marks[label];
    this.measures.push({ label: label, duration: duration });
    
    // Color code by performance
    var emoji = duration < 100 ? '⚡' : duration < 500 ? '✓' : '⚠️';
    console.log(emoji + ' [PERF] Completed:', label, '-', duration + 'ms');
    
    delete this.marks[label];
    return duration;
  },
  
  report: function() {
    console.log('');
    console.log('=== PERFORMANCE REPORT ===');
    if (this.measures.length === 0) {
      console.log('No measurements recorded');
      return;
    }
    
    // Sort by duration
    var sorted = this.measures.slice().sort(function(a, b) {
      return b.duration - a.duration;
    });
    
    console.log('Slowest operations:');
    sorted.slice(0, 5).forEach(function(m, idx) {
      console.log((idx+1) + '. ' + m.label + ': ' + m.duration + 'ms');
    });
    
    var total = this.measures.reduce(function(sum, m) { return sum + m.duration; }, 0);
    var avg = Math.round(total / this.measures.length);
    console.log('');
    console.log('Total operations:', this.measures.length);
    console.log('Average duration:', avg + 'ms');
    console.log('Total time:', total + 'ms');
    console.log('======================');
  },
  
  clear: function() {
    this.marks = {};
    this.measures = [];
    console.log('🗑️ Performance data cleared');
  }
};

// Expose performance monitor globally for debugging
window.perfMonitor = perfMonitor;

// Run migration before initializing
migrateDataToV4();

// Initialize brands from localStorage (empty if none exist)
perfMonitor.start('Brand Initialization');
var brands = initializeBrands();
perfMonitor.end('Brand Initialization');

// Initial health check (silent)
if (brands.length > 0) {
  checkBrandHealth();
}

// Check for updates (once per day)
function checkForUpdates() {
  var lastCheck = localStorage.getItem(ROWEOS_LAST_UPDATE_CHECK);
  var now = Date.now();
  var oneDay = 24 * 60 * 60 * 1000;
  
  // Skip if checked recently
  if (lastCheck && (now - parseInt(lastCheck)) < oneDay) {
    return;
  }
  
  // Note: Update check URL is a placeholder
  // For manual distribution, you can remove this or point to your own server
  console.log('Checking for updates...');
  localStorage.setItem(ROWEOS_LAST_UPDATE_CHECK, now.toString());
  
  // Actual update check would go here
  // For now, just log
}

// v26.0: Software update check
function checkForUpdate() {
  var btn = document.getElementById('updateCheckBtn');
  var status = document.getElementById('updateStatus');
  var versionEl = document.getElementById('updateCurrentVersion');

  if (btn) btn.textContent = 'Checking...';
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Checking for updates...';

  // Update current version display
  if (versionEl && typeof ROWEOS_VERSION !== 'undefined') {
    versionEl.textContent = 'Current Version: ' + ROWEOS_VERSION;
  }

  // Check by fetching the live version from the deployed site
  fetch('/index.html?_=' + Date.now(), { cache: 'no-store' })
    .then(function(r) { return r.text(); })
    .then(function(html) {
      // Extract version from the fetched page
      var match = html.match(/var ROWEOS_VERSION = '([^']+)'/);
      var latestVersion = match ? match[1] : null;
      var currentVersion = typeof ROWEOS_VERSION !== 'undefined' ? ROWEOS_VERSION : 'unknown';

      if (btn) btn.textContent = 'Check for Updates';
      if (btn) btn.disabled = false;

      if (!latestVersion) {
        if (status) status.textContent = 'Could not determine latest version.';
        return;
      }

      if (latestVersion === currentVersion) {
        if (status) status.textContent = 'You are up to date! (' + currentVersion + ')';
        if (status) status.style.color = 'var(--accent)';
      } else {
        if (status) status.textContent = 'Update available: ' + latestVersion + ' (you have ' + currentVersion + '). Refresh to update.';
        if (status) status.style.color = 'var(--accent)';
        // Add refresh button
        if (btn) {
          btn.textContent = 'Refresh to Update';
          btn.onclick = function() { window.location.reload(true); };
        }
      }
    })
    .catch(function(err) {
      if (btn) btn.textContent = 'Check for Updates';
      if (btn) btn.disabled = false;
      if (status) status.textContent = 'Update check failed: ' + err.message;
    });
}

// Check if this is the first time the user has launched the app
function isFirstLaunch() {
  return !localStorage.getItem(USER_DATA_KEYS.welcomed);
}

// Mark welcome as complete
function markWelcomed() {
  localStorage.setItem(USER_DATA_KEYS.welcomed, 'true');
}

// Show welcome screen (first launch only)
function showWelcomeScreen() {
  console.log('=== Showing welcome screen (first launch) ===');
  
  var welcome = document.getElementById('welcomeScreen');
  if (welcome) {
    welcome.style.display = 'flex';
  }
}

// Hide welcome screen
function hideWelcomeScreen() {
  var welcome = document.getElementById('welcomeScreen');
  if (welcome) {
    welcome.style.display = 'none';
  }
}

// Start setup from welcome screen
function startSetup() {
  console.log('=== Starting setup from welcome screen ===');
  
  // Mark as welcomed
  markWelcomed();
  
  // Hide welcome screen
  hideWelcomeScreen();
  
  // Show onboarding
  showOnboarding();
}

// ═══════════════════════════════════════════════════════════════
// LOCALSTORAGE HELPER FUNCTION
// ═══════════════════════════════════════════════════════════════

function saveToLocalStorage(key, value) {
  try {
    // Handle different data structures
    if (key === 'brands') {
      // Brands array - save to roweosBrands
      localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(value));
    } else if (key.startsWith('brand_')) {
      // Individual brand memory - save to roweos_brand_memory using brand key directly
      var brandMemory = JSON.parse(localStorage.getItem('roweos_brand_memory') || '{}');
      brandMemory[key] = value;
      localStorage.setItem('roweos_brand_memory', JSON.stringify(brandMemory));
    } else if (key.startsWith('model_')) {
      // Model configuration - save to roweos_brand_settings
      var brandIdx = parseInt(key.replace('model_', ''));
      var brandSettings = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}');
      if (!brandSettings[brandIdx]) {
        brandSettings[brandIdx] = {};
      }
      brandSettings[brandIdx].provider = value.provider;
      brandSettings[brandIdx].model = value.model;
      localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(brandSettings));
    } else if (key.startsWith('files_brand_')) {
      // Files for brand - custom key
      localStorage.setItem('roweos_' + key, JSON.stringify(value));
    } else {
      // Generic fallback
      localStorage.setItem('roweos_' + key, JSON.stringify(value));
    }
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

var ops = [
  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL OPERATIONS (All Brands) - IDs 1-15
  // ═══════════════════════════════════════════════════════════════
  { id: 1, name: 'Weekly Content Calendar', desc: '7-day social posts with complete copy', category: 'marketing', brand: null, outputs: ['Content calendar', 'Post copy', 'Captions', 'Story scripts', 'Hashtag sets'], params: [
    { id: 'platforms', label: 'Platforms', type: 'multi', options: ['Instagram', 'Facebook', 'LinkedIn', 'Twitter/X', 'TikTok', 'Pinterest'], default: ['Instagram', 'Facebook'] },
    { id: 'postsPerDay', label: 'Posts Per Day', type: 'select', options: ['1', '2', '3'], default: '1' },
    { id: 'theme', label: 'Weekly Theme', type: 'text', placeholder: 'e.g., Product launch, Holiday promo' }
  ]},
  { id: 2, name: 'Monthly Campaign Sprint', desc: 'Full campaign strategy and assets', category: 'marketing', brand: null, outputs: ['Campaign strategy', 'Email sequence', 'Social assets', 'Landing copy', 'Ad variations'], params: [
    { id: 'campaignGoal', label: 'Campaign Goal', type: 'select', options: ['Brand Awareness', 'Lead Generation', 'Sales/Conversions', 'Product Launch', 'Event Promotion'], default: 'Brand Awareness' },
    { id: 'budget', label: 'Budget Range', type: 'select', options: ['Under $1K', '$1K-$5K', '$5K-$10K', '$10K+', 'Not specified'], default: 'Not specified' },
    { id: 'duration', label: 'Campaign Duration', type: 'select', options: ['1 week', '2 weeks', '1 month', '3 months'], default: '1 month' }
  ]},
  { id: 3, name: 'Email Nurture Sequence', desc: '5-7 email welcome/nurture flow', category: 'marketing', brand: null, outputs: ['Email sequence', 'Subject lines', 'Preview text', 'CTAs', 'Timing strategy'], params: [
    { id: 'sequenceType', label: 'Sequence Type', type: 'select', options: ['Welcome Series', 'Nurture/Education', 'Sales Funnel', 'Re-engagement', 'Onboarding'], default: 'Welcome Series' },
    { id: 'emailCount', label: 'Number of Emails', type: 'select', options: ['3', '5', '7', '10'], default: '5' },
    { id: 'tone', label: 'Email Tone', type: 'select', options: ['Professional', 'Friendly', 'Casual', 'Luxury', 'Urgent'], default: 'Friendly' }
  ]},
  { id: 4, name: 'Competitor Analysis', desc: 'Market research and positioning analysis', category: 'strategic', brand: null, outputs: ['Competitor profiles', 'Feature comparison', 'Pricing analysis', 'Gap opportunities', 'Recommendations'], params: [
    { id: 'competitors', label: 'Competitor Names', type: 'text', placeholder: 'e.g., Company A, Company B, Company C' },
    { id: 'focusAreas', label: 'Focus Areas', type: 'multi', options: ['Pricing', 'Features', 'Marketing', 'Customer Service', 'Brand Position'], default: ['Pricing', 'Features'] }
  ]},
  { id: 5, name: 'Customer Persona Builder', desc: 'Detailed buyer persona document', category: 'strategic', brand: null, outputs: ['Demographics', 'Psychographics', 'Pain points', 'Buying behavior', 'Channel preferences'], params: [
    { id: 'personaType', label: 'Persona Type', type: 'select', options: ['Primary Buyer', 'Secondary Buyer', 'Influencer', 'Decision Maker', 'End User'], default: 'Primary Buyer' },
    { id: 'industry', label: 'Industry/Niche', type: 'text', placeholder: 'e.g., Tech professionals, Fitness enthusiasts' }
  ]},
  { id: 6, name: 'SWOT Analysis', desc: 'Strengths, weaknesses, opportunities, threats', category: 'strategic', brand: null, outputs: ['SWOT matrix', 'Priority actions', 'Risk mitigation', 'Opportunity ranking'] },
  { id: 7, name: 'Brand Voice Guide', desc: 'Tone, vocabulary, and style guidelines', category: 'strategic', brand: null, outputs: ['Voice attributes', 'Vocabulary list', 'Tone examples', 'Channel adaptations'], params: [
    { id: 'toneStyle', label: 'Primary Tone', type: 'select', options: ['Professional', 'Friendly', 'Authoritative', 'Playful', 'Luxurious', 'Minimalist'], default: 'Professional' },
    { id: 'channels', label: 'Key Channels', type: 'multi', options: ['Website', 'Email', 'Social Media', 'Ads', 'Customer Service'], default: ['Website', 'Social Media'] }
  ]},
  { id: 8, name: 'SEO Content Brief', desc: 'Keyword strategy and article outlines', category: 'marketing', brand: null, outputs: ['Keyword research', 'Content outline', 'Meta descriptions', 'Internal linking'], params: [
    { id: 'targetKeyword', label: 'Target Keyword', type: 'text', placeholder: 'e.g., best project management software' },
    { id: 'contentType', label: 'Content Type', type: 'select', options: ['Blog Post', 'Pillar Page', 'Product Page', 'Landing Page', 'How-to Guide'], default: 'Blog Post' },
    { id: 'wordCount', label: 'Target Word Count', type: 'select', options: ['500-800', '1000-1500', '1500-2000', '2000+'], default: '1000-1500' }
  ]},
  { id: 9, name: 'Ad Copy Kit', desc: 'Facebook, Instagram, Google ad variations', category: 'marketing', brand: null, outputs: ['Headlines', 'Primary text', 'Descriptions', 'CTA variations', 'A/B versions'], params: [
    { id: 'adPlatforms', label: 'Ad Platforms', type: 'multi', options: ['Facebook', 'Instagram', 'Google Search', 'Google Display', 'LinkedIn', 'TikTok'], default: ['Facebook', 'Instagram'] },
    { id: 'objective', label: 'Ad Objective', type: 'select', options: ['Traffic', 'Conversions', 'Lead Gen', 'Brand Awareness', 'App Installs'], default: 'Conversions' },
    { id: 'offer', label: 'Offer/Hook', type: 'text', placeholder: 'e.g., 20% off, Free trial, Limited time' }
  ]},
  { id: 10, name: 'Landing Page Copy', desc: 'Complete landing page with all sections', category: 'marketing', brand: null, outputs: ['Hero section', 'Benefits', 'Social proof', 'FAQ', 'CTA blocks'], params: [
    { id: 'pageGoal', label: 'Page Goal', type: 'select', options: ['Lead Capture', 'Product Sales', 'Webinar Signup', 'Free Trial', 'Contact Request'], default: 'Lead Capture' },
    { id: 'pageLength', label: 'Page Length', type: 'select', options: ['Short (above fold)', 'Medium (2-3 scrolls)', 'Long-form (sales page)'], default: 'Medium (2-3 scrolls)' }
  ]},
  { id: 11, name: 'Review Response Pack', desc: 'Templates for 1-5 star reviews', category: 'operations', brand: null, outputs: ['5-star responses', '4-star responses', '3-star responses', 'Negative response templates', 'Escalation scripts'] },
  { id: 12, name: 'Crisis Response Playbook', desc: 'Scenario protocols and messaging', category: 'operations', brand: null, outputs: ['Crisis scenarios', 'Response protocols', 'Messaging templates', 'Escalation paths'], params: [
    { id: 'crisisTypes', label: 'Crisis Types', type: 'multi', options: ['PR/Reputation', 'Product Issue', 'Customer Complaint', 'Data Breach', 'Employee Issue'], default: ['PR/Reputation', 'Customer Complaint'] }
  ]},
  { id: 13, name: 'Influencer Outreach Pack', desc: 'Pitch emails and follow-up sequences', category: 'marketing', brand: null, outputs: ['Initial pitch', 'Follow-up sequence', 'Collaboration terms', 'Partnership proposal'], params: [
    { id: 'influencerTier', label: 'Influencer Tier', type: 'select', options: ['Nano (1K-10K)', 'Micro (10K-50K)', 'Mid-tier (50K-500K)', 'Macro (500K-1M)', 'Mega (1M+)'], default: 'Micro (10K-50K)' },
    { id: 'collaborationType', label: 'Collaboration Type', type: 'select', options: ['Sponsored Post', 'Product Review', 'Brand Ambassador', 'Affiliate', 'Event Appearance'], default: 'Sponsored Post' }
  ]},
  { id: 14, name: 'Press Release Template', desc: 'News announcement format', category: 'marketing', brand: null, outputs: ['Press release', 'Media kit outline', 'Quote blocks', 'Boilerplate'], params: [
    { id: 'announcementType', label: 'Announcement Type', type: 'select', options: ['Product Launch', 'Company News', 'Partnership', 'Award/Recognition', 'Event', 'Funding'], default: 'Product Launch' }
  ]},
  { id: 15, name: 'Customer Journey Map', desc: 'Touchpoint analysis and opportunities', category: 'strategic', brand: null, outputs: ['Journey stages', 'Touchpoint inventory', 'Pain points', 'Opportunities', 'Emotion mapping'] },

  // ═══════════════════════════════════════════════════════════════
  // DEEP RESEARCH OPERATIONS (Gemini Interactions API) - IDs 16-25
  // ═══════════════════════════════════════════════════════════════
  { id: 16, name: 'Market Research Report', desc: 'Comprehensive industry analysis with data', category: 'research', brand: null, outputs: ['Market size/growth', 'Key players', 'Trends analysis', 'Opportunity gaps', 'Strategic recommendations'] },
  { id: 17, name: 'Competitive Landscape Analysis', desc: 'Deep dive into top 5-10 competitors', category: 'research', brand: null, outputs: ['Competitor profiles', 'Pricing comparison', 'Feature matrix', 'Market positioning', 'Differentiation opportunities'] },
  { id: 18, name: 'Industry Trend Report', desc: 'Emerging trends and future predictions', category: 'research', brand: null, outputs: ['Current trends', 'Emerging technologies', 'Market shifts', 'Future predictions', 'Strategic implications'] },
  { id: 19, name: 'Customer Insights Study', desc: 'Research on target audience behavior', category: 'research', brand: null, outputs: ['Demographics', 'Buying patterns', 'Pain points', 'Decision factors', 'Channel preferences'] },
  { id: 20, name: 'Technology Assessment', desc: 'Evaluation of tools, platforms, or solutions', category: 'research', brand: null, outputs: ['Solution comparison', 'Feature analysis', 'Pricing breakdown', 'Integration requirements', 'Recommendations'] },
  { id: 21, name: 'Regulatory Compliance Review', desc: 'Industry regulations and requirements', category: 'research', brand: null, outputs: ['Regulatory landscape', 'Compliance requirements', 'Risk assessment', 'Implementation steps', 'Resources'] },
  { id: 22, name: 'Partnership Opportunity Research', desc: 'Potential collaboration and vendor analysis', category: 'research', brand: null, outputs: ['Partner profiles', 'Synergy assessment', 'Integration possibilities', 'Risk/benefit analysis', 'Outreach strategy'] },
  { id: 23, name: 'Funding Landscape Report', desc: 'Investor research and funding opportunities', category: 'research', brand: null, outputs: ['Investor profiles', 'Funding trends', 'Requirements analysis', 'Success patterns', 'Application strategy'] },
  { id: 24, name: 'Geographic Market Analysis', desc: 'Regional market entry research', category: 'research', brand: null, outputs: ['Market characteristics', 'Competitive landscape', 'Cultural considerations', 'Entry barriers', 'Opportunity assessment'] },
  { id: 25, name: 'Supply Chain Research', desc: 'Vendor, supplier, and logistics analysis', category: 'research', brand: null, outputs: ['Supplier profiles', 'Pricing comparison', 'Quality assessment', 'Lead times', 'Risk analysis'] },
  // v22.9: Dedicated Deep Research Agent — always uses Gemini Deep Research
  { id: 53, name: 'Deep Research', desc: 'Comprehensive deep research powered by Gemini', category: 'research', brand: null, outputs: ['In-depth analysis', 'Source citations', 'Key findings', 'Strategic recommendations', 'Action items'], requiresDeepResearch: true },

  // ═══════════════════════════════════════════════════════════════
  // ROWEOS PLATFORM OPERATIONS - IDs 26-35
  // ═══════════════════════════════════════════════════════════════
  { id: 26, name: 'Feature Explanation', desc: 'Learn how to use specific RoweOS features', category: 'platform', brand: null, outputs: ['Step-by-step guide', 'Best practices', 'Common pitfalls', 'Pro tips', 'Related features'] },
  { id: 27, name: 'Agent Capabilities Overview', desc: 'Understand what each agent can do', category: 'platform', brand: null, outputs: ['Agent purpose', 'Example use cases', 'When to use', 'Output types', 'Integration tips'] },
  { id: 28, name: 'Workflow Design Help', desc: 'Create custom workflows for your brand', category: 'platform', brand: null, outputs: ['Workflow steps', 'Agent sequencing', 'Automation opportunities', 'Integration points', 'Efficiency tips'] },
  { id: 29, name: 'Custom Operation Builder', desc: 'Design and template custom operations', category: 'platform', brand: null, outputs: ['Operation template', 'Prompt structure', 'Variable placeholders', 'Output format', 'Testing checklist'] },
  { id: 30, name: 'API Integration Guide', desc: 'Set up and troubleshoot API connections', category: 'platform', brand: null, outputs: ['API setup steps', 'Key configuration', 'Model selection guide', 'Error troubleshooting', 'Best practices'] },
  { id: 31, name: 'Scheduling Strategy', desc: 'Optimize your operation scheduling', category: 'platform', brand: null, outputs: ['Scheduling recommendations', 'Frequency guidelines', 'Time optimization', 'Calendar organization', 'Automation ideas'] },
  { id: 32, name: 'Brand Setup Walkthrough', desc: 'Configure brand identity for optimal results', category: 'platform', brand: null, outputs: ['Identity checklist', 'Required fields', 'Optional enhancements', 'Voice definition', 'Testing strategy'] },
  { id: 33, name: 'Platform Troubleshooting', desc: 'Diagnose and fix common issues', category: 'platform', brand: null, outputs: ['Problem diagnosis', 'Solution steps', 'Prevention tips', 'When to reset', 'Support escalation'] },
  { id: 34, name: 'Export & Data Management', desc: 'Backup, export, and manage your data', category: 'platform', brand: null, outputs: ['Export procedures', 'Backup strategy', 'Data recovery', 'Import process', 'Best practices'] },
  { id: 35, name: 'Advanced Features Guide', desc: 'Unlock power user capabilities', category: 'platform', brand: null, outputs: ['Advanced techniques', 'Hidden features', 'Keyboard shortcuts', 'Efficiency hacks', 'Integration tips'] },

  // ═══════════════════════════════════════════════════════════════
  // GUIDED GENERATORS - IDs 36-39 (v9.1.14)
  // Multi-turn conversational operations for complex document creation
  // ═══════════════════════════════════════════════════════════════
  { id: 36, name: 'PDF Invoice Generator', desc: 'Guided invoice creation with logo upload', category: 'documents', brand: null, outputs: ['Professional PDF invoice', 'Line items breakdown', 'Client details', 'Payment terms', 'Company branding'], isConversational: true, conversationType: 'invoice' },
  { id: 37, name: 'Proposal Builder', desc: 'Step-by-step proposal creation', category: 'documents', brand: null, outputs: ['Executive summary', 'Scope of work', 'Pricing breakdown', 'Timeline', 'Terms and conditions'], isConversational: true, conversationType: 'proposal' },
  { id: 38, name: 'Contract Generator', desc: 'Guided contract drafting assistant', category: 'documents', brand: null, outputs: ['Service agreement', 'Terms and conditions', 'Payment schedule', 'Deliverables', 'Signatures block'], isConversational: true, conversationType: 'contract' },
  { id: 39, name: 'Brand Guidelines Builder', desc: 'Create comprehensive brand style guide', category: 'guided', brand: null, outputs: ['Logo usage', 'Color palette', 'Typography', 'Voice guidelines', 'Do/Don\'t examples'], isConversational: true, conversationType: 'brandguide' },

  // ═══════════════════════════════════════════════════════════════
  // CREATIVE & IMAGE OPERATIONS - IDs 40-45 (v9.1.14)
  // ═══════════════════════════════════════════════════════════════
  { id: 40, name: 'Brand Image Concepts', desc: 'AI-generated image prompts for brand visuals', category: 'image', brand: null, outputs: ['Hero image concepts', 'Social media visuals', 'Product photography ideas', 'Lifestyle imagery', 'Color palette suggestions'], isImageOp: true, params: [
    { id: 'imageStyle', label: 'Visual Style', type: 'select', options: ['Photorealistic', 'Minimalist', 'Luxury', 'Vibrant', 'Moody', 'Editorial'], default: 'Photorealistic' },
    { id: 'platform', label: 'Target Platform', type: 'select', options: ['Instagram', 'Website Hero', 'Facebook', 'LinkedIn', 'Pinterest', 'Print'], default: 'Instagram' }
  ]},
  { id: 41, name: 'Product Mockup Brief', desc: 'Creative direction for product photography', category: 'image', brand: null, outputs: ['Shot list', 'Styling notes', 'Background options', 'Lighting direction', 'Prop suggestions'], isImageOp: true },
  { id: 42, name: 'Social Media Visual Kit', desc: 'Image concepts for a social campaign', category: 'image', brand: null, outputs: ['Feed post concepts', 'Story templates', 'Carousel ideas', 'Reel thumbnails', 'Cover images'], isImageOp: true, params: [
    { id: 'campaign', label: 'Campaign Theme', type: 'text', placeholder: 'e.g., Summer sale, Product launch' }
  ]},
  { id: 43, name: 'Brand Mood Board', desc: 'Visual inspiration collection for brand identity', category: 'image', brand: null, outputs: ['Color inspiration', 'Typography mood', 'Texture references', 'Photography style', 'Design direction'], isImageOp: true },
  { id: 44, name: 'AI Image Prompt Generator', desc: 'Generate images with Nano Banana or DALL-E', category: 'image', brand: null, outputs: ['Primary prompt', 'Style variations', 'Negative prompts', 'Aspect ratio suggestions', 'Seed recommendations'], isImageOp: true, params: [
    { id: 'subject', label: 'Image Subject', type: 'text', placeholder: 'e.g., Product photo, Lifestyle scene' },
    { id: 'style', label: 'Style', type: 'select', options: ['Photorealistic', 'Digital Art', 'Illustration', 'Minimalist', '3D Render'], default: 'Photorealistic' }
  ]},

  // v21.15: Video Operations
  { id: 49, name: 'Brand Video Concept', desc: 'Generate a short brand video from a creative brief', category: 'video', brand: null, outputs: ['Generated video', 'Creative direction'], isVideoOp: true, params: [
    { id: 'videoDuration', label: 'Duration', type: 'select', options: ['4s', '6s', '8s'], default: '8s' },
    { id: 'videoStyle', label: 'Style', type: 'select', options: ['Cinematic', 'Product Showcase', 'Lifestyle', 'Abstract', 'Motion Graphics'], default: 'Cinematic' }
  ]},
  { id: 50, name: 'Product Video Generator', desc: 'Create product showcase videos with brand styling', category: 'video', brand: null, outputs: ['Product video', 'Shot description'], isVideoOp: true, params: [
    { id: 'videoDuration', label: 'Duration', type: 'select', options: ['4s', '6s', '8s'], default: '8s' }
  ]},
  { id: 51, name: 'Social Video Creator', desc: 'Generate short-form videos for social platforms', category: 'video', brand: null, outputs: ['Social video', 'Caption'], isVideoOp: true, isSocialOp: true, params: [
    { id: 'videoPlatform', label: 'Platform', type: 'select', options: ['Instagram Reels', 'TikTok', 'YouTube Shorts', 'X/Twitter'], default: 'Instagram Reels' },
    { id: 'videoDuration', label: 'Duration', type: 'select', options: ['4s', '6s', '8s'], default: '6s' }
  ]},
  { id: 52, name: 'AI Video Generator', desc: 'Generate videos directly from any prompt using Veo', category: 'video', brand: null, outputs: ['Generated video'], isVideoOp: true, params: [
    { id: 'videoDuration', label: 'Duration', type: 'select', options: ['4s', '6s', '8s'], default: '8s' },
    { id: 'videoAspect', label: 'Aspect Ratio', type: 'select', options: ['16:9 Landscape', '9:16 Portrait'], default: '16:9 Landscape' }
  ]},

  // v17.0: Social Media Operations
  { id: 45, name: 'Social Media Post', desc: 'Platform-optimized post with caption, hashtags, CTA', category: 'social', brand: null, outputs: ['Post content', 'Hashtags', 'Call to action', 'Platform notes'], isSocialOp: true, params: [
    { id: 'platforms', label: 'Platforms', type: 'multi', options: ['X (Twitter)', 'Threads', 'Instagram', 'TikTok'], default: 'X (Twitter)' },
    { id: 'tone', label: 'Tone', type: 'select', options: ['Professional', 'Casual', 'Witty', 'Inspirational', 'Urgent', 'Storytelling'], default: 'Professional' },
    { id: 'includeImage', label: 'Include Image Prompt', type: 'select', options: ['Yes', 'No'], default: 'No' }
  ]},
  { id: 46, name: 'Thread / Story Series', desc: 'Multi-part thread or story series for deeper engagement', category: 'social', brand: null, outputs: ['Thread parts', 'Story frames', 'Hook', 'Engagement strategy'], isSocialOp: true, params: [
    { id: 'platform', label: 'Platform', type: 'select', options: ['X Thread', 'Instagram Stories', 'Threads Series'], default: 'X Thread' },
    { id: 'partCount', label: 'Number of Parts', type: 'select', options: ['3', '5', '7', '10'], default: '5' },
    { id: 'topic', label: 'Topic', type: 'text', placeholder: 'e.g., Behind the brand story, Product launch countdown' }
  ]},
  { id: 47, name: 'Cross-Platform Campaign', desc: 'Same message adapted for X, Threads, Instagram, TikTok', category: 'social', brand: null, outputs: ['X version (280 char)', 'Threads version (500 char)', 'Instagram caption (2200 char)', 'TikTok caption', 'Hashtag strategy'], isSocialOp: true, params: [
    { id: 'topic', label: 'Campaign Topic', type: 'text', placeholder: 'e.g., New product launch, Sale announcement' },
    { id: 'tone', label: 'Brand Tone', type: 'select', options: ['Professional', 'Casual', 'Witty', 'Inspirational', 'Luxury'], default: 'Professional' }
  ]},
  // v18.5: Raw social caption writer — outputs ONLY the post text, nothing else
  { id: 48, name: 'Social Caption Writer', desc: 'Write a single social media caption ready to post immediately. Output ONLY the caption text itself. Nothing else. No titles, no headers, no analysis, no brand voice scores, no tone variants, no posting time suggestions, no hashtag lists, no markdown formatting, no explanations. Just the exact words that will appear as the social media post.', category: 'social', brand: null, outputs: ['Caption text'], isRawOutput: true, isSocialOp: true, params: [
    { id: 'platform', label: 'Platform', type: 'select', options: ['X (Twitter)', 'Threads', 'Instagram', 'TikTok'], default: 'Threads' },
    { id: 'tone', label: 'Tone', type: 'select', options: ['Professional', 'Casual', 'Witty', 'Inspirational', 'Urgent', 'Storytelling', 'Founder-Forward'], default: 'Professional' },
    { id: 'topic', label: 'Topic', type: 'text', placeholder: 'e.g., Brand launch, Product update, Behind the scenes' }
  ]},

  // v13.0: Brand-specific operations removed. Adaptive Operations (v13.1) will
  // generate custom ops from Identity data. Universal ops (1-44) + Parent ops (501-507) remain.

  // ═══════════════════════════════════════════════════════════════
  // THE ROWE COLLECTION (Parent Brand) - IDs 501-507
  // ═══════════════════════════════════════════════════════════════
  { id: 501, name: 'Master Brand Guide', desc: 'Umbrella positioning and architecture', category: 'strategic', brand: null, outputs: ['Brand essence', 'Sub-brand relationships', 'Visual identity', 'Voice guidelines', 'Usage rules'] },
  { id: 502, name: 'Portfolio SWOT Analysis', desc: 'Cross-brand synergies assessment', category: 'strategic', brand: null, outputs: ['Portfolio strengths', 'Shared weaknesses', 'Cross-sell opportunities', 'Market threats', 'Synergy actions'] },
  { id: 503, name: 'Unified Messaging Framework', desc: 'L1/L2/L3 messaging hierarchy', category: 'strategic', brand: null, outputs: ['Core promise (L1)', 'Benefit pillars (L2)', 'Proof points (L3)', 'Brand-specific adaptations'] },
  { id: 504, name: 'Cross-Brand Campaign', desc: 'Multi-brand promotional strategy', category: 'marketing', brand: null, outputs: ['Campaign concept', 'Brand integration plan', 'Shared assets', 'Individual activations', 'Measurement framework'] },
  { id: 505, name: 'Annual Report Template', desc: 'Year in review document', category: 'documents', brand: null, outputs: ['Executive summary', 'Brand highlights', 'Metrics dashboard', 'Client testimonials', 'Future vision'] },
  { id: 506, name: 'Investor/Partner Deck', desc: 'Business overview presentation', category: 'strategic', brand: null, outputs: ['Company overview', 'Market opportunity', 'Brand portfolio', 'Financials framework', 'Partnership opportunities'] },
  { id: 507, name: 'Brand Architecture Document', desc: 'Sub-brand relationships and hierarchy', category: 'strategic', brand: null, outputs: ['Architecture diagram', 'Brand relationships', 'Naming conventions', 'Extension guidelines', 'Co-branding rules'] },
  // v22.6: Email Template Generator operations
  { id: 508, name: 'Email Writer', desc: 'Write a complete, ready-to-send professional email. Output ONLY the email content itself: a greeting, the body, and a sign-off with signature. No options, no alternatives, no subject line suggestions, no analysis. Just the exact email text ready to send to a client. Use the brand voice and identity. Do not use em-dashes.', category: 'documents', brand: null, outputs: ['Email content'], isRawOutput: true, isEmailOp: true, params: [
    { id: 'recipientName', label: 'Recipient Name', type: 'text', placeholder: 'e.g. Sarah, Mr. Johnson, Team' },
    { id: 'topic', label: 'What is this email about?', type: 'text', placeholder: 'e.g. Follow up on pricing inquiry, Partnership proposal, Project update' },
    { id: 'tone', label: 'Tone', type: 'select', options: ['Professional', 'Friendly', 'Casual', 'Luxury', 'Warm', 'Formal', 'Persuasive'], default: 'Professional' },
    { id: 'context', label: 'Additional Context (optional)', type: 'textarea', placeholder: 'Any details, background, or specific points to include...' }
  ] },
  { id: 509, name: 'Email Campaign Copy', desc: 'Write persuasive email campaigns with A/B subject lines and send timing', category: 'marketing', brand: null, outputs: ['Email copy', 'Subject line A/B options', 'Preview text', 'CTA copy', 'Send timing'], params: [
    { id: 'campaignType', label: 'Campaign Type', type: 'select', options: ['Product Launch', 'Sale / Promotion', 'Re-engagement', 'Abandoned Cart', 'Seasonal', 'Brand Story', 'Event Promo'], default: 'Product Launch' },
    { id: 'senderName', label: 'Sender Name', type: 'text', placeholder: 'e.g. The RoweOS Team' },
    { id: 'recipientDesc', label: 'Target Audience', type: 'text', placeholder: 'e.g. lapsed customers, VIP list' },
    { id: 'subjectLine', label: 'Key Message / Subject', type: 'text', placeholder: 'Main message or offer' },
    { id: 'tone', label: 'Tone', type: 'select', options: ['Persuasive', 'Friendly', 'Urgent', 'Exclusive', 'Playful', 'Bold'], default: 'Persuasive' },
    { id: 'format', label: 'Output Format', type: 'select', options: ['HTML Template', 'Plain Text', 'Markdown'], default: 'HTML Template' },
    { id: 'emailCount', label: 'Email Count', type: 'select', options: ['Single Email', '2-Email Sequence', '3-Email Sequence'], default: 'Single Email' }
  ] },
  // v22.33: Pitch Document Generator — produces portfolio-style markdown for PDF conversion
  { id: 510, name: 'Pitch Document Generator', desc: 'Generate a polished, portfolio-style pitch document in structured markdown. Output ONLY the document. Structure with Roman numeral chapters: I. Executive Summary, II. Services and Capabilities, III. Strategic Approach, IV. Key Differentiators, V. Engagement Model. Use ## for chapters, ### for subsections, > for callouts, bold for key terms. Start with brand name, tagline, and Prepared for [Client]. Reference client by name throughout. Under 1200 words. No em-dashes.', category: 'documents', brand: null, outputs: ['Branded pitch document in markdown'], prompt: 'Generate a polished, portfolio-style pitch document for the client specified below. Output ONLY the document content in clean markdown.\n\nFORMAT INSTRUCTIONS:\n- Structure the document with clear chapter sections using Roman numerals (I, II, III, etc.)\n- Start with a title page section: brand name, tagline, and \"Prepared for [Client Name]\"\n- Chapter I: Executive Summary - brief overview of the brand and why this client is a fit\n- Chapter II: Services and Capabilities - what the brand offers, tailored to this client\n- Chapter III: Strategic Approach - how the brand would specifically help this client, referencing their industry and needs\n- Chapter IV: Key Differentiators - competitive advantages and unique value\n- Chapter V: Engagement Model - how working together would look, next steps, and call to action\n- Use markdown headings (## for chapters, ### for subsections)\n- Use blockquotes (>) for key callouts or brand philosophy statements\n- Use bullet points for feature lists and deliverables\n- Use bold text for emphasis on key terms\n- Keep professional, confident tone - not sales-y\n- Reference the client by name throughout\n- If a client website is provided, reference specific details about their business\n- Keep under 1200 words total\n- Do not use em-dashes or en-dashes\n\n{context}', params: [
    { id: 'recipientName', label: 'Client / Company Name', type: 'text', placeholder: 'e.g. Acme Corp, Sarah Chen' },
    { id: 'clientWebsite', label: 'Client Website (optional)', type: 'text', placeholder: 'e.g. acmecorp.com' },
    { id: 'context', label: 'Research / Context', type: 'textarea', placeholder: 'Paste client research, notes, or details to personalize the pitch...' }
  ] },
  // v31.0: INTELLIGENCE OPERATIONS (Web Search powered, GPT-5.5)
  // Market Intelligence (1101-1104)
  { id: 1101, name: 'Competitor Analysis', desc: 'Deep research on a specific competitor\'s current market position, pricing, recent moves, and vulnerabilities', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Market position summary', 'Pricing comparison', 'Strengths & weaknesses', 'Strategic opportunities'], params: [
    { id: 'competitor', label: 'Competitor Name or URL', type: 'text' }
  ]},
  { id: 1102, name: 'Market Opportunity Scanner', desc: 'Identify untapped market gaps and emerging opportunities in your industry using current data', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Market gaps identified', 'Opportunity ranking', 'Entry strategy', 'Risk assessment'], params: [
    { id: 'focus', label: 'Focus Area (optional)', type: 'text' }
  ]},
  { id: 1103, name: 'Industry Intelligence Brief', desc: 'Latest news, trends, regulations, and competitive moves affecting your industry', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Key developments', 'Trend analysis', 'Regulatory updates', 'Action items'], params: [
    { id: 'timeframe', label: 'Timeframe', type: 'select', options: ['Past Week', 'Past Month', 'Past Quarter'], default: 'Past Month' }
  ]},
  { id: 1104, name: 'Pricing & Positioning Research', desc: 'Research competitor pricing strategies, market rates, and positioning to optimize your pricing', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Pricing landscape', 'Competitor comparison', 'Positioning recommendations', 'Price optimization'], params: [
    { id: 'product', label: 'Product or Service to Research', type: 'text' }
  ]},
  // Client Acquisition (1105-1108)
  { id: 1105, name: 'Research Potential Clients', desc: 'Find potential clients matching your ideal customer profile with company details and contact information', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Prospect list with details', 'Contact information', 'Company profiles', 'Outreach priority ranking'], params: [
    { id: 'criteria', label: 'Target Client Criteria', type: 'text' },
    { id: 'location', label: 'Location', type: 'text' },
    { id: 'count', label: 'Number of Leads', type: 'select', options: ['5', '10', '15', '20'], default: '10' }
  ]},
  { id: 1106, name: 'Client Deep Research', desc: 'Comprehensive research on a specific company or person before outreach or a meeting', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Company overview', 'Key decision makers', 'Recent news & activity', 'Talking points & angles'], params: [
    { id: 'target', label: 'Company or Person Name', type: 'text' }
  ]},
  { id: 1107, name: 'Smart Outreach Generator', desc: 'Research a prospect and generate personalized outreach messages backed by real intelligence', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Personalized outreach messages', 'Research-backed talking points', 'Follow-up sequence', 'Conversation starters'], params: [
    { id: 'target', label: 'Prospect Name or Company', type: 'text' },
    { id: 'channel', label: 'Channel', type: 'select', options: ['Email', 'LinkedIn', 'Cold Call Script', 'All'], default: 'Email' }
  ]},
  { id: 1108, name: 'Partnership Scout', desc: 'Find and evaluate potential business partners, collaborators, or strategic alliances', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Partner candidates', 'Fit analysis', 'Approach strategy', 'Deal structure ideas'], params: [
    { id: 'type', label: 'Partnership Type', type: 'select', options: ['Strategic Alliance', 'Distribution', 'Co-Marketing', 'Technology', 'Any'], default: 'Any' }
  ]},
  // Grant & Funding (1109-1112)
  { id: 1109, name: 'Grant Finder', desc: 'Search for grants and funding opportunities matching your business type, industry, and location', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Matching grants list', 'Eligibility requirements', 'Deadlines & timelines', 'Application tips'], params: [
    { id: 'focus', label: 'Funding Focus (optional)', type: 'text' },
    { id: 'amount', label: 'Amount Range', type: 'select', options: ['Under $10K', '$10K-$50K', '$50K-$250K', '$250K+', 'Any'], default: 'Any' }
  ]},
  { id: 1110, name: 'Grant Application Assistant', desc: 'Help prepare grant application content, narratives, and supporting materials', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Application narrative', 'Budget justification', 'Impact statement', 'Supporting materials checklist'], params: [
    { id: 'grant', label: 'Grant Name or Program', type: 'text' }
  ]},
  { id: 1111, name: 'Vendor & Supplier Research', desc: 'Find and evaluate vendors, suppliers, or service providers for your business needs', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Vendor comparison', 'Pricing estimates', 'Reviews & reputation', 'Recommendation'], params: [
    { id: 'need', label: 'What You Need', type: 'text' },
    { id: 'location', label: 'Preferred Location', type: 'text' }
  ]},
  { id: 1112, name: 'Local Market Intelligence', desc: 'Research local market conditions, demographics, competitors, and opportunities in a specific area', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Market overview', 'Local competition', 'Demographics & trends', 'Opportunities'], params: [
    { id: 'location', label: 'Target Location', type: 'text' },
    { id: 'focus', label: 'Focus', type: 'select', options: ['General Overview', 'Competition', 'Demographics', 'Real Estate', 'Events & Networking'], default: 'General Overview' }
  ]},
  // v22.31: Client pitch packet generation
  { id: 1113, name: 'Client Pitch Packet', desc: 'Research a potential client and generate a branded RoweOS pitch document showing how each feature benefits their specific business', category: 'intelligence', brand: null, preferredProvider: 'openai', preferredModel: 'gpt-5.5', outputs: ['Client profile', 'Feature benefits map', 'Implementation roadmap', 'Outreach email draft'], params: [
    { id: 'clientName', label: 'Client / Company Name', type: 'text' },
    { id: 'clientUrl', label: 'Website URL (optional)', type: 'text' },
    { id: 'industry', label: 'Industry', type: 'text' },
    { id: 'notes', label: 'Additional Context', type: 'textarea' }
  ]},

  // ═══════════════════════════════════════════════════════════════
  // INFOGRAPHIC OPERATIONS (v23.8) — AI-generated data infographics
  // ═══════════════════════════════════════════════════════════════
  { id: 1200, name: 'Brand Performance Dashboard', desc: 'Generate a visual dashboard infographic showing key brand metrics, KPIs, and performance indicators', category: 'infographic', brand: null, isInfographicOp: true, outputs: ['Performance metrics', 'KPI visualizations', 'Trend indicators', 'Action items'], params: [
    { id: 'metrics', label: 'Key Metrics / Focus Areas', type: 'textarea' },
    { id: 'period', label: 'Time Period', type: 'text' }
  ]},
  { id: 1201, name: 'Market Analysis Overview', desc: 'Create a market analysis infographic with competitive positioning, market segments, and opportunity areas', category: 'infographic', brand: null, isInfographicOp: true, outputs: ['Market landscape', 'Competitive positioning', 'Opportunity map', 'Key statistics'], params: [
    { id: 'market', label: 'Market / Industry', type: 'text' },
    { id: 'competitors', label: 'Key Competitors', type: 'textarea' }
  ]},
  { id: 1202, name: 'Strategy Roadmap', desc: 'Design a visual strategy roadmap infographic showing phases, milestones, and strategic initiatives over time', category: 'infographic', brand: null, isInfographicOp: true, outputs: ['Phase breakdown', 'Timeline visualization', 'Milestone markers', 'Initiative details'], params: [
    { id: 'goal', label: 'Strategic Goal', type: 'text' },
    { id: 'timeframe', label: 'Timeframe', type: 'text' },
    { id: 'phases', label: 'Key Phases / Milestones', type: 'textarea' }
  ]},
  { id: 1203, name: 'Competitive Comparison', desc: 'Build a side-by-side competitive comparison infographic highlighting differentiators and advantages', category: 'infographic', brand: null, isInfographicOp: true, outputs: ['Feature comparison', 'Strength analysis', 'Differentiators', 'Visual scoring'], params: [
    { id: 'competitors', label: 'Competitors to Compare', type: 'textarea' },
    { id: 'criteria', label: 'Comparison Criteria', type: 'textarea' }
  ]},
  { id: 1204, name: 'Custom Infographic', desc: 'Generate a custom infographic on any topic with AI-selected layout, charts, and data visualizations', category: 'infographic', brand: null, isInfographicOp: true, outputs: ['Custom layout', 'Data visualizations', 'Key insights', 'Visual summary'], params: [
    { id: 'topic', label: 'Infographic Topic', type: 'text' },
    { id: 'data', label: 'Data / Key Points', type: 'textarea' },
    { id: 'style', label: 'Visual Style (optional)', type: 'text' }
  ]}
];

// ═══════════════════════════════════════════════════════════════
// LIFEAI OPERATIONS - Personal Life Management Operations
// v10.5.25: LifeAI-specific Studio operations for personal life
// ═══════════════════════════════════════════════════════════════
window.lifeOps = [
  // LIFE PLANNING
  { id: 1001, name: 'Weekly Life Review', desc: 'Reflect on week, plan next week', category: 'planning', outputs: ['Week highlights', 'Lessons learned', 'Next week priorities', 'Habit check-in', 'Gratitude list'] },
  { id: 1002, name: 'Monthly Goals Setting', desc: 'Set and track monthly personal goals', category: 'planning', outputs: ['Goal categories', 'SMART goals', 'Action items', 'Success metrics', 'Accountability plan'] },
  { id: 1003, name: 'Annual Life Vision', desc: 'Create your year ahead vision', category: 'planning', outputs: ['Vision statement', 'Life areas review', 'Key objectives', 'Milestone timeline', 'Quarterly themes'] },
  { id: 1004, name: 'Decision Framework', desc: 'Structured approach to major decisions', category: 'planning', outputs: ['Options analysis', 'Pros/cons matrix', 'Values alignment', 'Risk assessment', 'Recommended action'] },
  { id: 1005, name: 'Priority Matrix', desc: 'Organize tasks by importance and urgency', category: 'planning', outputs: ['Priority quadrants', 'Do now items', 'Schedule items', 'Delegate items', 'Eliminate items'] },
  
  // PERSONAL DEVELOPMENT
  { id: 1010, name: 'Skills Assessment', desc: 'Evaluate and plan skill development', category: 'development', outputs: ['Current skills inventory', 'Gap analysis', 'Learning priorities', 'Resources list', 'Development timeline'] },
  { id: 1011, name: 'Career Reflection', desc: 'Assess career path and opportunities', category: 'development', outputs: ['Current role analysis', 'Strengths/growth areas', 'Career options', 'Next steps', 'Networking plan'] },
  { id: 1012, name: 'Learning Plan', desc: 'Structured approach to learning new things', category: 'development', outputs: ['Learning goals', 'Resource curation', 'Study schedule', 'Practice activities', 'Progress milestones'] },
  { id: 1013, name: 'Habit Tracker Setup', desc: 'Design habits for success', category: 'development', outputs: ['Habit categories', 'Keystone habits', 'Triggers/cues', 'Rewards system', 'Tracking method'] },
  { id: 1014, name: 'Personal SWOT', desc: 'Strengths, weaknesses, opportunities, threats', category: 'development', outputs: ['Strengths list', 'Growth areas', 'Opportunities', 'Challenges', 'Action plan'] },
  
  // WELLNESS & HEALTH
  { id: 1020, name: 'Wellness Check-In', desc: 'Holistic health assessment', category: 'wellness', outputs: ['Physical health', 'Mental wellness', 'Sleep quality', 'Nutrition review', 'Improvement areas'] },
  { id: 1021, name: 'Stress Management Plan', desc: 'Strategies for managing stress', category: 'wellness', outputs: ['Stress triggers', 'Coping strategies', 'Relaxation techniques', 'Support resources', 'Prevention plan'] },
  { id: 1022, name: 'Fitness Planning', desc: 'Exercise routine and goals', category: 'wellness', outputs: ['Fitness goals', 'Weekly routine', 'Exercise list', 'Progress tracking', 'Recovery plan'] },
  { id: 1023, name: 'Sleep Optimization', desc: 'Improve sleep quality', category: 'wellness', outputs: ['Sleep analysis', 'Bedtime routine', 'Environment tips', 'Habit changes', 'Tracking method'] },
  { id: 1024, name: 'Mindfulness Practice', desc: 'Meditation and awareness exercises', category: 'wellness', outputs: ['Practice types', 'Daily routine', 'Guided sessions', 'Progress journal', 'Benefits tracking'] },
  
  // RELATIONSHIPS
  { id: 1030, name: 'Relationship Inventory', desc: 'Map and nurture key relationships', category: 'relationships', outputs: ['Relationship map', 'Priority connections', 'Nurture plan', 'Communication schedule', 'Quality time ideas'] },
  { id: 1031, name: 'Communication Improvement', desc: 'Better express and listen', category: 'relationships', outputs: ['Communication style', 'Active listening tips', 'Difficult conversations', 'Feedback techniques', 'Practice scenarios'] },
  { id: 1032, name: 'Networking Strategy', desc: 'Build meaningful professional connections', category: 'relationships', outputs: ['Network goals', 'Target connections', 'Outreach plan', 'Follow-up system', 'Value offering'] },
  { id: 1033, name: 'Family Connection Plan', desc: 'Strengthen family relationships', category: 'relationships', outputs: ['Family priorities', 'Quality time activities', 'Tradition ideas', 'Communication plan', 'Conflict resolution'] },
  
  // FINANCES
  { id: 1040, name: 'Budget Review', desc: 'Analyze and optimize spending', category: 'finances', outputs: ['Income overview', 'Expense categories', 'Savings rate', 'Optimization tips', 'Budget plan'] },
  { id: 1041, name: 'Financial Goals', desc: 'Set and track money objectives', category: 'finances', outputs: ['Financial vision', 'Short-term goals', 'Long-term goals', 'Action steps', 'Timeline'] },
  { id: 1042, name: 'Debt Strategy', desc: 'Plan to eliminate debt', category: 'finances', outputs: ['Debt inventory', 'Payoff strategy', 'Priority order', 'Monthly plan', 'Progress tracking'] },
  { id: 1043, name: 'Investment Planning', desc: 'Approach to growing wealth', category: 'finances', outputs: ['Investment goals', 'Risk tolerance', 'Asset allocation', 'Account strategy', 'Review schedule'] },
  
  // TAX COPILOT - v10.5.25 Evidence-first tax optimization
  { id: 1080, name: 'Tax Document Intake', desc: 'Create checklist of required tax documents', category: 'taxes', agent: 'taxintelligence', outputs: ['Document checklist', 'Missing forms list', 'Late-arriving forms (5498)', 'Priority collection', 'Folder structure'] },
  { id: 1081, name: 'W-2/1099 Extraction', desc: 'Extract key fields from tax forms', category: 'taxes', agent: 'taxintelligence', outputs: ['Field-by-field table', 'Payer/recipient info', 'Validation notes', 'IRS form mapping', 'Reconciliation needs'] },
  { id: 1082, name: 'Deduction Discovery', desc: 'Find missed deductions and credits', category: 'taxes', agent: 'taxintelligence', outputs: ['Opportunity list', 'Estimated $ impact', 'Required evidence', 'Risk assessment', 'Allocation methods'] },
  { id: 1083, name: '1099-K Reconciliation', desc: 'Match payment app income to deposits', category: 'taxes', agent: 'taxintelligence', outputs: ['Gross vs net breakdown', 'Refunds/returns', 'Fees analysis', 'Reporting guidance', 'Documentation checklist'] },
  { id: 1084, name: 'Business vs Personal Split', desc: 'Allocate mixed-use expenses properly', category: 'taxes', agent: 'taxintelligence', outputs: ['Expense categorization', 'Allocation method', 'Business use %', 'Supporting docs needed', 'Risk notes'] },
  { id: 1085, name: 'Home Office Deduction', desc: 'Calculate and substantiate home office', category: 'taxes', agent: 'taxintelligence', outputs: ['Square footage calc', 'Direct vs indirect expenses', 'Simplified vs actual', 'Required documentation', 'Deduction amount'] },
  { id: 1086, name: 'Vehicle/Mileage Deduction', desc: 'Optimize car expense deductions', category: 'taxes', agent: 'taxintelligence', outputs: ['Standard vs actual analysis', 'Mileage log requirements', 'Business use allocation', 'Documentation checklist', 'Recommended method'] },
  { id: 1087, name: 'Travel & Meals Review', desc: 'Substantiate business travel expenses', category: 'taxes', agent: 'taxintelligence', outputs: ['Who/what/when/where/why', 'Receipt requirements', 'Meal deduction rules', 'Per diem options', 'Audit-ready pack'] },
  { id: 1088, name: 'Retirement/HSA Optimization', desc: 'Maximize tax-advantaged accounts', category: 'taxes', agent: 'taxintelligence', outputs: ['Contribution limits', 'Deduction eligibility', 'HSA distribution rules', 'Form 8889 prep', 'Optimization strategy'] },
  { id: 1089, name: 'Capital Gains Review', desc: 'Analyze investment tax implications', category: 'taxes', agent: 'taxintelligence', outputs: ['1099-B reconciliation', 'Cost basis verification', 'Wash sale check', 'Holding period analysis', 'Loss harvesting opportunities'] },
  { id: 1090, name: 'Pre-File Review', desc: 'Final check before filing', category: 'taxes', agent: 'taxintelligence', outputs: ['Notice trigger check', 'Missing documents', 'Reconciliation verification', 'Substantiation gaps', 'Filing punch list'] },
  { id: 1091, name: 'Audit-Ready Pack', desc: 'Create substantiation documentation', category: 'taxes', agent: 'taxintelligence', outputs: ['Category summaries', 'Evidence inventory', 'Allocation workpapers', 'Narrative explanations', 'Document index'] },
  { id: 1092, name: 'Tax Calendar Setup', desc: 'Key dates and deadlines tracker', category: 'taxes', agent: 'taxintelligence', outputs: ['Filing deadlines', 'Estimated tax dates', 'Extension options', 'Document due dates', 'Reminder schedule'] },
  
  // HOME & ORGANIZATION
  { id: 1050, name: 'Home Organization', desc: 'Declutter and organize living space', category: 'home', outputs: ['Room priorities', 'Declutter plan', 'Organization systems', 'Maintenance routine', 'Shopping list'] },
  { id: 1051, name: 'Meal Planning', desc: 'Weekly meal prep and nutrition', category: 'home', outputs: ['Weekly menu', 'Shopping list', 'Prep schedule', 'Nutrition balance', 'Recipe ideas'] },
  { id: 1052, name: 'Home Maintenance', desc: 'Schedule home upkeep tasks', category: 'home', outputs: ['Task inventory', 'Seasonal schedule', 'Vendor contacts', 'Budget estimate', 'Priority items'] },
  { id: 1053, name: 'Digital Cleanup', desc: 'Organize digital life', category: 'home', outputs: ['File organization', 'Password audit', 'App cleanup', 'Subscription review', 'Backup plan'] },
  
  // CREATIVITY & HOBBIES
  { id: 1060, name: 'Creative Project Plan', desc: 'Structure a creative endeavor', category: 'creativity', outputs: ['Project vision', 'Milestones', 'Resource needs', 'Time allocation', 'Sharing plan'] },
  { id: 1061, name: 'Hobby Exploration', desc: 'Discover and develop new interests', category: 'creativity', outputs: ['Interest assessment', 'Hobby options', 'Getting started guide', 'Resources list', 'Community connections'] },
  { id: 1062, name: 'Quick Trip Plan', desc: 'Quick trip overview (for full planning, switch to Travel Planner agent)', category: 'creativity', agent: 'travel', outputs: ['Destination ideas', 'Itinerary draft', 'Budget estimate', 'Booking checklist', 'Packing list'] },
  { id: 1063, name: 'Bucket List', desc: 'Dreams and experiences to pursue', category: 'creativity', outputs: ['Life experiences', 'Categorized goals', 'Priority ranking', 'First steps', 'Timeline ideas'] },
  
  // REFLECTION & JOURNALING
  { id: 1070, name: 'Daily Journal Prompt', desc: 'Guided reflection exercise', category: 'reflection', outputs: ['Journal prompt', 'Reflection questions', 'Gratitude focus', 'Tomorrow intentions'] },
  { id: 1071, name: 'Life Story Reflection', desc: 'Explore your personal narrative', category: 'reflection', outputs: ['Key chapters', 'Turning points', 'Lessons learned', 'Values revealed', 'Future vision'] },
  { id: 1072, name: 'Values Clarification', desc: 'Identify and prioritize core values', category: 'reflection', outputs: ['Values list', 'Priority ranking', 'Alignment check', 'Living values plan', 'Decision filter'] },
  { id: 1073, name: 'Gratitude Practice', desc: 'Cultivate appreciation', category: 'reflection', outputs: ['Gratitude list', 'Why it matters', 'Sharing ideas', 'Daily practice', 'Reflection prompts'] },

  // v13.9: IMAGE GENERATION
  { id: 1100, name: 'AI Image Generator', desc: 'Generate images with Nano Banana or DALL-E', category: 'image', outputs: ['Generated image', 'Style variations', 'Prompt refinement', 'Aspect ratio options'], isImageOp: true, params: [
    { id: 'subject', label: 'Image Subject', type: 'text', placeholder: 'e.g., Serene landscape, Abstract art' },
    { id: 'style', label: 'Style', type: 'select', options: ['Photorealistic', 'Digital Art', 'Illustration', 'Watercolor', 'Oil Painting', 'Minimalist'], default: 'Photorealistic' }
  ]},

  // v26.3: VIDEO
  { id: 1110, name: 'Personal Video Script', desc: 'Script a personal video message or update', category: 'video', outputs: ['Script', 'Shot list', 'Talking points', 'Call to action'], isVideoOp: true },
  { id: 1111, name: 'Life Update Vlog', desc: 'Structure a life update or milestone video', category: 'video', outputs: ['Outline', 'Key moments', 'B-roll ideas', 'Intro/outro'], isVideoOp: true },
  { id: 1112, name: 'Tutorial or How-To', desc: 'Create a step-by-step personal tutorial', category: 'video', outputs: ['Script', 'Steps breakdown', 'Visual aids', 'Screen recording notes'], isVideoOp: true },

  // v26.3: SOCIAL
  { id: 1120, name: 'Social Media Post', desc: 'Craft a personal social media post', category: 'social', outputs: ['Post copy', 'Hashtags', 'Best posting time', 'Platform tips'], isSocialOp: true },
  { id: 1121, name: 'LinkedIn Profile Update', desc: 'Refresh your professional profile', category: 'social', outputs: ['Headline options', 'Summary draft', 'Experience highlights', 'Skills recommendations'], isSocialOp: true },
  { id: 1122, name: 'Personal Brand Content', desc: 'Plan content for your personal brand', category: 'social', outputs: ['Content themes', 'Weekly schedule', 'Platform strategy', 'Engagement tips'], isSocialOp: true },

  // v26.3: GUIDED
  { id: 1130, name: 'Life Coaching Session', desc: 'Interactive guided coaching conversation', category: 'guided', outputs: ['Key insights', 'Action items', 'Follow-up questions'], isConversational: true },
  { id: 1131, name: 'Goal Setting Workshop', desc: 'Step-by-step guided goal creation', category: 'guided', outputs: ['Vision statement', 'SMART goals', 'Accountability plan'], isConversational: true },
  { id: 1132, name: 'Decision Making Guide', desc: 'Walk through a major life decision', category: 'guided', outputs: ['Decision framework', 'Weighted analysis', 'Recommended path'], isConversational: true },

  // v26.3: RESEARCH
  { id: 1140, name: 'Topic Deep Dive', desc: 'Research any personal interest topic', category: 'research', outputs: ['Key findings', 'Expert sources', 'Actionable takeaways', 'Further reading'] },
  { id: 1141, name: 'Local Services Research', desc: 'Find and compare local service providers', category: 'research', outputs: ['Provider list', 'Comparison matrix', 'Reviews summary', 'Recommendation'] },
  { id: 1142, name: 'Health & Wellness Research', desc: 'Research health topics and treatments', category: 'research', outputs: ['Evidence summary', 'Expert opinions', 'Risks/benefits', 'Questions for doctor'] },

  // v30.0: TRAVEL PLANNER
  { id: 1201, name: 'Plan a Trip', desc: 'Full trip planning with destination research, timing, and logistics', category: 'travel', agent: 'travel', outputs: ['Destination overview', 'Best time to visit', 'Trip duration recommendation', 'Logistics summary', 'Next steps checklist'], params: [
    { id: 'destination', label: 'Destination', type: 'text', placeholder: 'e.g., Tokyo, Amalfi Coast, Iceland' },
    { id: 'dates', label: 'Travel Dates (approx)', type: 'text', placeholder: 'e.g., July 2026, 2 weeks' },
    { id: 'travelers', label: 'Number of Travelers', type: 'select', options: ['1 (Solo)', '2 (Couple)', '3-4 (Small Group)', '5+ (Large Group/Family)'], default: '2 (Couple)' },
    { id: 'style', label: 'Travel Style', type: 'select', options: ['Budget', 'Mid-Range', 'Luxury', 'Adventure', 'Family-Friendly', 'Business'], default: 'Mid-Range' }
  ]},
  { id: 1202, name: 'Create Itinerary', desc: 'Day-by-day travel schedule with activities, meals, and transport', category: 'travel', agent: 'travel', outputs: ['Day-by-day schedule', 'Activity recommendations', 'Meal suggestions', 'Transport between stops', 'Timing and logistics'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'days', label: 'Number of Days', type: 'select', options: ['3', '5', '7', '10', '14', '21'], default: '7' },
    { id: 'pace', label: 'Pace Preference', type: 'select', options: ['Relaxed (2-3 activities/day)', 'Moderate (3-4 activities/day)', 'Packed (5+ activities/day)'], default: 'Moderate (3-4 activities/day)' }
  ]},
  { id: 1203, name: 'Budget Estimate', desc: 'Detailed cost breakdown by category with money-saving tips', category: 'travel', agent: 'travel', outputs: ['Flights estimate', 'Accommodation estimate', 'Food and dining budget', 'Activities and entrance fees', 'Transport and miscellaneous', 'Total estimated cost', 'Money-saving tips'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'days', label: 'Number of Days', type: 'select', options: ['3', '5', '7', '10', '14', '21'], default: '7' },
    { id: 'style', label: 'Budget Level', type: 'select', options: ['Backpacker', 'Budget', 'Mid-Range', 'Comfort', 'Luxury'], default: 'Mid-Range' },
    { id: 'currency', label: 'Home Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'], default: 'USD' }
  ]},
  { id: 1204, name: 'Packing List', desc: 'Climate-based and activity-specific packing checklist', category: 'travel', agent: 'travel', outputs: ['Clothing essentials', 'Toiletries and personal care', 'Electronics and gear', 'Documents and money', 'Activity-specific items', 'Carry-on vs checked strategy'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'season', label: 'Season/Weather', type: 'select', options: ['Summer/Hot', 'Winter/Cold', 'Spring/Mild', 'Fall/Cool', 'Tropical/Humid', 'Mixed/Varied'], default: 'Summer/Hot' },
    { id: 'duration', label: 'Trip Duration', type: 'select', options: ['Weekend (2-3 days)', '1 Week', '2 Weeks', '3+ Weeks'], default: '1 Week' },
    { id: 'activities', label: 'Planned Activities', type: 'text', placeholder: 'e.g., hiking, beach, business meetings, formal dining' }
  ]},
  { id: 1205, name: 'Visa and Documents Check', desc: 'Entry requirements, visa needs, and travel document checklist', category: 'travel', agent: 'travel', outputs: ['Visa requirements', 'Passport validity check', 'Required documents list', 'Travel insurance recommendations', 'Health requirements', 'Application timeline'], params: [
    { id: 'destination', label: 'Destination Country', type: 'text' },
    { id: 'passport', label: 'Passport Country', type: 'text', placeholder: 'e.g., United States' },
    { id: 'purpose', label: 'Purpose of Travel', type: 'select', options: ['Tourism', 'Business', 'Study', 'Transit', 'Work'], default: 'Tourism' }
  ]},
  { id: 1206, name: 'Restaurant and Food Guide', desc: 'Local cuisine recommendations, restaurant picks, and dietary tips', category: 'travel', agent: 'travel', outputs: ['Must-try local dishes', 'Restaurant recommendations by meal', 'Street food guide', 'Dietary accommodation tips', 'Food etiquette and customs', 'Budget dining options'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'dietary', label: 'Dietary Preferences', type: 'select', options: ['No Restrictions', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher', 'Allergies (specify in notes)'], default: 'No Restrictions' },
    { id: 'budget', label: 'Dining Budget', type: 'select', options: ['Street Food/Budget', 'Mid-Range', 'Fine Dining', 'Mixed'], default: 'Mixed' }
  ]},
  { id: 1207, name: 'Local Culture and Safety Brief', desc: 'Cultural norms, safety tips, and practical local knowledge', category: 'travel', agent: 'travel', outputs: ['Cultural norms and etiquette', 'Safety considerations', 'Common scams to avoid', 'Tipping customs', 'Useful local phrases', 'Emergency contacts and resources'], params: [
    { id: 'destination', label: 'Destination', type: 'text' }
  ]},
  { id: 1208, name: 'Flight and Hotel Research', desc: 'Best booking strategies, airline and hotel recommendations', category: 'travel', agent: 'travel', outputs: ['Best time to book', 'Recommended airlines', 'Hotel area recommendations', 'Accommodation alternatives', 'Price comparison tips', 'Loyalty program advice'], params: [
    { id: 'origin', label: 'Departing From', type: 'text', placeholder: 'e.g., Austin, TX' },
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'dates', label: 'Travel Dates', type: 'text', placeholder: 'e.g., July 10-20, 2026' },
    { id: 'class', label: 'Preferred Class', type: 'select', options: ['Economy', 'Premium Economy', 'Business', 'First', 'Flexible'], default: 'Economy' }
  ]},
  { id: 1209, name: 'Activity Recommendations', desc: 'Curated activities, excursions, and experiences for your destination', category: 'travel', agent: 'travel', outputs: ['Top attractions', 'Hidden gems and local favorites', 'Outdoor and adventure activities', 'Cultural experiences', 'Family-friendly options', 'Evening and nightlife'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'interests', label: 'Interests', type: 'text', placeholder: 'e.g., history, nature, art, nightlife, adventure sports' },
    { id: 'travelers', label: 'Group Type', type: 'select', options: ['Solo', 'Couple', 'Family with Kids', 'Friends Group', 'Seniors'], default: 'Couple' }
  ]},
  { id: 1210, name: 'Travel Checklist', desc: 'Pre-departure preparation checklist with timeline', category: 'travel', agent: 'travel', outputs: ['4 weeks before', '2 weeks before', '1 week before', 'Day before departure', 'Day of travel', 'At destination arrival'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'type', label: 'Trip Type', type: 'select', options: ['Domestic', 'International', 'Cruise', 'Road Trip'], default: 'International' }
  ]},
  { id: 1211, name: 'Emergency Travel Help', desc: 'Handling flight delays, lost luggage, medical emergencies, and travel disruptions', category: 'travel', agent: 'travel', outputs: ['Immediate action steps', 'Contact information', 'Rights and compensation', 'Alternative arrangements', 'Insurance claim guidance'], params: [
    { id: 'situation', label: 'Situation', type: 'select', options: ['Flight Delayed/Cancelled', 'Lost/Delayed Luggage', 'Medical Emergency', 'Lost Passport', 'Natural Disaster/Disruption', 'Missed Connection', 'Other Emergency'], default: 'Flight Delayed/Cancelled' },
    { id: 'location', label: 'Current Location', type: 'text' }
  ]},
  { id: 1212, name: 'Trip Summary and Export', desc: 'Compile all trip details into a shareable travel brief', category: 'travel', agent: 'travel', outputs: ['Trip overview', 'Key dates and bookings', 'Daily highlights', 'Budget summary', 'Important contacts', 'Shareable travel brief'] }
];

