
// DATA INITIALIZATION & MIGRATION - v4.8.0
// ═══════════════════════════════════════════════════════════════

var ROWEOS_VERSION = 'v30.0';
var ROWEOS_DATA_VERSION_KEY = 'roweos_data_version';
var ROWEOS_UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/YOUR-REPO/roweos-updates/main/latest-version.json';
var ROWEOS_LAST_UPDATE_CHECK = 'roweos_last_update_check';

// User data keys (v4.8.0 standardized)
var USER_DATA_KEYS = {
  brands: 'roweos_user_brands',
  brandSettings: 'roweos_user_brand_settings',
  apiKeys: 'roweos_api_keys',
  onboardingCompleted: 'roweos_onboarding_completed',
  dataVersion: 'roweos_data_version',
  welcomed: 'roweos_welcomed',
  fileLibrary: 'roweos_user_library',
  promptLibrary: 'roweos_prompt_library',
  brandMemory: 'roweos_brand_memory',
  tourCompleted: 'roweos_tour_completed'
};

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
// category (optional via options.category): shouldSyncCategory key (e.g. 'goals', 'automations')
function writeDB(docPath, data, options) {
  var db = getDB();
  if (!db) return;
  if (isLocalOnlyMode()) return;
  var writeOpts = options || {};
  if (writeOpts.category && typeof shouldSyncCategory === 'function' && !shouldSyncCategory(writeOpts.category)) return;

  if (!firebaseUser) {
    _queuePendingWrite(docPath, data, writeOpts);
    return;
  }

  var basePath = 'roweos_users/' + firebaseUser.uid;
  var fullPath = basePath + '/' + docPath;
  stampLocalSave();

  try {
    if (writeOpts.merge !== false) {
      db.doc(fullPath).set(data, { merge: true }).then(function() {
        if (ROWEOS_DEBUG) console.log('[WriteDB] ' + docPath + ' synced');
        // v28.4: Stamp last sync time on successful write-through
        var _now = new Date().toLocaleString();
        localStorage.setItem('roweos_last_sync', _now);
        localStorage.setItem('roweos_last_sync_device', typeof getDeviceType === 'function' ? getDeviceType() : 'unknown');
        updateSyncIndicator('connected');
        if (writeOpts.onSuccess) writeOpts.onSuccess();
      }).catch(function(err) {
        console.warn('[WriteDB] ' + docPath + ' failed:', err.message);
        updateSyncIndicator('error');
        if (writeOpts.onError) writeOpts.onError(err);
      });
    } else {
      db.doc(fullPath).set(data).then(function() {
        if (ROWEOS_DEBUG) console.log('[WriteDB] ' + docPath + ' synced');
        updateSyncIndicator('connected');
        if (writeOpts.onSuccess) writeOpts.onSuccess();
      }).catch(function(err) {
        console.warn('[WriteDB] ' + docPath + ' failed:', err.message);
        updateSyncIndicator('error');
        if (writeOpts.onError) writeOpts.onError(err);
      });
    }
  } catch(e) {
    console.warn('[WriteDB] Error writing ' + docPath + ':', e.message);
    if (writeOpts.onError) writeOpts.onError(e);
  }

  // v28.0: Dual-write to v4 namespace
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try {
      var _v4Map = {
        'profile/main': 'settings/main',
        'profile/userContact': 'settings/main',
        'profile/customAgents': 'settings/main',
        'profile/customOps': 'settings/main',
        'profile/clients': 'clients/main',
        'profile/socialPosts': 'social_posts/main',
        'profile/socialWorkflows': 'social_workflows/main',
        'profile/notifications': 'settings/notifications',
        'profile/researchHistory': 'settings/main',
        'profile/mail': 'settings/mail',
        'profile/people': 'settings/people',
        'profile/reminders': 'settings/main',
        'profile/inventory': 'settings/main',
        'profile/generatedBrandOps': 'settings/main',
        'conversations/current': 'conversations/current',
        'conversations/history': 'conversations/history',
        'conversations/agentHistory': 'agent_history/main',
        'pulse/main': 'pulse/main', // v29.3: pulse/main no longer carries goals
        'library/brand': 'library/brand',
        'library/life': 'library/life',
        'folio/main': 'folio/main',
        'lifeAI/main': 'life_settings/main'
      };
      var _v4Target = _v4Map[docPath];
      if (_v4Target) {
        var _v4Parts = _v4Target.split('/');
        var _v4Collection = _v4Parts[0];
        var _v4DocId = _v4Parts[1];
        syncEngine.write(_v4Collection, _v4DocId, data);
      }
    } catch (_v4e) {
      console.warn('[WriteDB] v4 dual-write failed for', docPath, ':', _v4e.message);
    }
  }
}

// Write to a subcollection document (e.g., /automations/{id})
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
  // v28.0: Dual-write to v4
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try { syncEngine.write(collectionPath, docId, data); } catch(_v4e) {}
  }
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
  // v28.0: Dual-write delete to v4
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try { syncEngine.delete(collectionPath, docId); } catch(_e) {}
  }
}

// v25.1: Write single automation to Firestore
function writeDBAutomation(auto) {
  if (!auto || !auto.id) return;
  if (!shouldSyncCategory('automations')) return;
  // v25.2: Stamp _modifiedAt for merge support
  // v28.4: Always update _modifiedAt so lastRun changes win in mergeByTimestamp across devices
  auto._modifiedAt = Date.now();
  // Deep-strip base64 data URLs (matches syncToFirebaseV2 regex approach for nested content)
  var dataStr = JSON.stringify(auto);
  dataStr = dataStr.replace(/"data:[^"]{50000,}"/g, '""');
  var data = JSON.parse(dataStr);
  data.updatedAt = new Date().toISOString();
  writeDBDoc('automations', String(auto.id), data);
}

// v25.1: Write-through helpers for todos and calendar
// Uses single-document pattern to avoid orphan docs on deletion
// v29.1: Uses merge:false so cloud array is fully replaced (prevents zombie resurrection)
function writeDBTodos() {
  var todosData = [];
  try { todosData = JSON.parse(localStorage.getItem(getTodosKey()) || '[]'); } catch(e) {}
  writeDB('todos/main', { data: todosData }, { category: 'brand_todos', merge: false });
  // v29.1: Clean up orphaned V4 individual docs that no longer exist locally
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try {
      // Build set of current todo IDs
      var _currentIds = {};
      for (var _ti = 0; _ti < todosData.length; _ti++) {
        var _todo = todosData[_ti];
        var _tid = String(_todo.id || ('todo_' + Date.now() + '_' + _ti));
        _todo.id = _tid;
        _currentIds[_tid] = true;
        syncEngine.write('todos', _tid, _todo);
      }
      // Delete V4 docs for todos that were removed locally
      var db = getDB();
      if (db && firebaseUser) {
        var _todosPath = 'roweos_users/' + firebaseUser.uid + '/todos';
        db.collection(_todosPath).get().then(function(snap) {
          snap.forEach(function(doc) {
            if (doc.id !== 'main' && !_currentIds[doc.id]) {
              doc.ref.delete().then(function() {
                if (typeof ROWEOS_DEBUG !== 'undefined' && ROWEOS_DEBUG) console.log('[WriteDB] Cleaned orphan todo doc:', doc.id);
              }).catch(function() {});
            }
          });
        }).catch(function() {});
      }
    } catch(_v4e) {}
  }
}

function writeDBCalendar() {
  var calData = [];
  try { calData = JSON.parse(localStorage.getItem(getCalendarKey()) || '[]'); } catch(e) {}
  writeDB('calendar/main', { data: calData }, { category: 'calendar' });
  // v28.0: Write individual calendar docs to v4
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try {
      for (var _ci = 0; _ci < calData.length; _ci++) {
        var _evt = calData[_ci];
        var _eid = String(_evt.id || ('cal_' + Date.now() + '_' + _ci));
        _evt.id = _eid;
        syncEngine.write('calendar', _eid, _evt);
      }
    } catch(_v4e) {}
  }
}

// v25.0: Write-through for conversations (deferred 5s after last message to avoid spam during active chat)
var _convSyncTimer = null;
function writeDBConversations() {
  if (_convSyncTimer) clearTimeout(_convSyncTimer);
  _convSyncTimer = setTimeout(function() {
    _convSyncTimer = null;
    if (!shouldSyncCategory('conversations')) return;
    if (typeof collectConversationsWithLimit !== 'function') return;
    var convData = collectConversationsWithLimit();
    if (convData.current && convData.current.messages && convData.current.messages.length > 0) {
      writeDB('conversations/current', convData.current);
    }
    if (convData.historyJson) {
      try {
        var histCheck = JSON.parse(convData.historyJson);
        if (Array.isArray(histCheck) && histCheck.length > 0) {
          writeDB('conversations/history', { json: convData.historyJson });
        }
      } catch(e) {
        writeDB('conversations/history', { json: convData.historyJson });
      }
    }
    if (convData.agentHistoryJson) {
      writeDB('conversations/agentHistory', { json: convData.agentHistoryJson });
    }
  }, 5000);
}

// v25.0: Pending writes queue -- stores writes when user is not signed in
function _queuePendingWrite(docPath, data, options) {
  try {
    var queue = JSON.parse(localStorage.getItem('roweos_pending_writes') || '[]');
    queue.push({
      path: docPath,
      data: data,
      options: options || {},
      timestamp: Date.now()
    });
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

  var batch = db.batch();
  var batchCount = 0;
  queue.forEach(function(entry) {
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

  localStorage.removeItem('roweos_pending_writes');
}

// v25.0: One-time migration from V2 push/pull to V3 write-through
// CRITICAL: This must preserve all existing user data -- zero data loss
// v25.0: One-time migration from V2 push/pull to V3 write-through
// v25.2: DISABLED -- migration push was a resurrection vector.
// Each device independently re-uploaded stale local data, resurrecting items
// deleted on other devices. Cloud-authoritative model means cloud has truth;
// no local-to-cloud push is needed on migration.
function migrateToSyncV3() {
  if (!localStorage.getItem('roweos_sync_v3_migrated')) {
    localStorage.setItem('roweos_sync_v3_migrated', 'true');
    console.log('[Sync V3.1] Migration flag set (cloud-authoritative, no push needed)');
  }
}

// v25.0: Startup reconciliation -- compare local timestamps with Firestore
// v25.2: Startup reconciliation -- always pull from cloud (cloud-authoritative)
function reconcileOnStartup() {
  if (!firebaseUser) return;
  // v27.1: Skip cloud pull while onboarding is in progress -- freshly created
  // profiles haven't reached Firestore yet, so cloud-authoritative merge would
  // discard them. reconcileOnStartup will run naturally on next app load.
  if (window._onboardingInProgress || localStorage.getItem(USER_DATA_KEYS.onboardingCompleted) !== 'true') {
    console.log('[Sync V3.1] Startup -- SKIPPED (onboarding in progress)');
    return;
  }
  // v25.2: Always pull from cloud on startup. Cloud is the single source of truth.
  // The V2-era timestamp comparison was unreliable and the "local cache is current"
  // early exit prevented pulling authoritative cloud data after cross-device deletions.
  console.log('[Sync V3.1] Startup -- pulling from cloud (cloud-authoritative)');
  if (typeof loadFromFirebaseV2 === 'function') {
    loadFromFirebaseV2().then(function() {
      localStorage.setItem('roweos_first_sync_completed', 'true');
      localStorage.setItem('roweos_last_sync', String(Date.now()));
      // v28.2: Re-check API keys after cloud pull — keys may have been synced from Firestore
      if (typeof checkApiConnection === 'function') checkApiConnection(true);
      if (typeof updateProviderStatuses === 'function') updateProviderStatuses();
    });
  }
}

// v25.2: Timestamp-aware merge for array-based data
// Cloud is authoritative baseline. Local items only win if _modifiedAt is newer.
// Items that exist locally but NOT in cloud are treated as DELETED (not resurrected),
// UNLESS created after last successful sync (genuinely new offline items).
// REQUIRES: all items must have a stable id field.
// v27.3: Normalize _modifiedAt to numeric ms (handles ISO strings from Firestore and numeric from localStorage)
function _normalizeTs(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    var parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

