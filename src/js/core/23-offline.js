// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7: OFFLINE SUPPORT & ENHANCED SYNC (v9.1.14)
// Implements mycinder-style offline queue and automatic reconnection
// ═══════════════════════════════════════════════════════════════════════════════

// Offline pending changes queue
var pendingChanges = JSON.parse(localStorage.getItem('roweos_pending_changes') || '[]');
var isOnline = navigator.onLine;
var syncRetryCount = 0;
var maxSyncRetries = 3;

// Save pending changes to localStorage
function savePendingChanges() {
  localStorage.setItem('roweos_pending_changes', JSON.stringify(pendingChanges));
  updateOfflineIndicator();
}

// Add change to pending queue (for offline mode)
function addPendingChange(changeType, data) {
  pendingChanges.push({
    type: changeType,
    data: data,
    timestamp: Date.now(),
    id: 'change_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  });
  savePendingChanges();
  console.log('Firebase Offline: Queued pending change:', changeType);
}

// Process pending changes when back online
async function processPendingChanges() {
  if (!navigator.onLine || !firebaseUser || pendingChanges.length === 0) return;
  
  console.log('Firebase: Processing', pendingChanges.length, 'pending changes...');
  updateSyncIndicator('syncing');
  
  var failedChanges = [];
  
  for (var i = 0; i < pendingChanges.length; i++) {
    var change = pendingChanges[i];
    try {
      // Apply the change based on type
      switch (change.type) {
        case 'brands':
          localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(change.data));
          break;
        case 'conversation':
          localStorage.setItem('roweos_conversations', JSON.stringify(change.data));
          break;
        case 'calendar':
          localStorage.setItem('roweos_calendar', JSON.stringify(change.data));
          break;
        case 'runs':
          // v15.37: Preserve object format expected by loadRuns()
          var rtExisting = {};
          try { rtExisting = JSON.parse(localStorage.getItem('roweos_runs') || '{}'); } catch(e) { console.warn('[Sync] Corrupted roweos_runs (realtime):', e.message); }
          if (Array.isArray(rtExisting)) rtExisting = { runs: rtExisting };
          // v23.16: Merge by ID instead of replacing
          var rtLocal = rtExisting.runs || [];
          var rtCloud = Array.isArray(change.data) ? change.data : (change.data.runs || []);
          var rtLocalIds = {};
          for (var _rri = 0; _rri < rtLocal.length; _rri++) { if (rtLocal[_rri].id) rtLocalIds[rtLocal[_rri].id] = true; }
          for (var _rrj = 0; _rrj < rtCloud.length; _rrj++) { if (!rtCloud[_rrj].id || !rtLocalIds[rtCloud[_rrj].id]) rtLocal.push(rtCloud[_rrj]); }
          rtLocal.sort(function(a, b) { return (a.id || 0) - (b.id || 0); });
          rtExisting.runs = rtLocal.slice(-50);
          localStorage.setItem('roweos_runs', JSON.stringify(rtExisting));
          break;
        case 'knowledge':
          if (change.data.brandIndex !== undefined) {
            localStorage.setItem('roweos_knowledge_' + change.data.brandIndex, JSON.stringify(change.data.items));
          }
          break;
      }
    } catch (e) {
      console.error('Firebase: Failed to apply pending change:', e);
      failedChanges.push(change);
    }
  }
  
  // Keep only failed changes
  pendingChanges = failedChanges;
  savePendingChanges();
  
  // Sync everything to Firebase
  try {
    await syncToFirebase();
    showToast('Offline changes synced (' + (i - failedChanges.length) + ' items)', 'success');
  } catch (e) {
    console.error('Firebase: Sync after processing pending changes failed:', e);
    showToast('Some changes failed to sync', 'warning');
  }
}

// Enhanced triggerAutoSync with offline support
var originalTriggerAutoSync = triggerAutoSync;
triggerAutoSync = function() {
  if (!navigator.onLine) {
    // Queue for later sync instead
    console.log('Firebase Offline: Queuing change for later sync');
    updateOfflineIndicator();
    return;
  }
  originalTriggerAutoSync();
};

// Update offline indicator in UI
function updateOfflineIndicator() {
  var statusEl = document.getElementById('cloudSyncStatus');
  var dotEl = document.getElementById('firebaseSyncDot');
  var pendingRow = document.getElementById('pendingChangesRow');
  var pendingCountEl = document.getElementById('pendingChangesCount');
  
  var pendingCount = pendingChanges.length;
  
  // Update pending changes row in Settings
  if (pendingRow) {
    if (pendingCount > 0) {
      pendingRow.style.display = 'flex';
      if (pendingCountEl) {
        pendingCountEl.textContent = pendingCount + ' change' + (pendingCount > 1 ? 's' : '') + ' waiting to sync';
      }
    } else {
      pendingRow.style.display = 'none';
    }
  }
  
  if (!navigator.onLine) {
    if (dotEl) dotEl.style.background = '#f59e0b';
    if (statusEl) {
      statusEl.innerHTML = '<span style="color: #f59e0b;">●</span> Offline' + 
        (pendingCount > 0 ? ' (' + pendingCount + ' pending)' : '');
    }
  }
}

// Online/Offline Event Listeners
window.addEventListener('online', function() {
  console.log('Firebase: Device is now online');
  isOnline = true;
  syncRetryCount = 0;
  
  showToast('Back online', 'success');
  updateSyncIndicator('syncing');
  
  // Process any pending changes
  setTimeout(function() {
    processPendingChanges();
  }, 1000);
});

window.addEventListener('offline', function() {
  console.log('Firebase: Device is now offline');
  isOnline = false;
  
  showToast('You are offline. Changes will sync when reconnected.', 'warning');
  updateOfflineIndicator();
});

// Retry sync on failure with exponential backoff
async function syncWithRetry() {
  if (!navigator.onLine || !firebaseUser) return;
  
  try {
    await syncToFirebase();
    syncRetryCount = 0;
  } catch (error) {
    syncRetryCount++;
    
    if (syncRetryCount <= maxSyncRetries) {
      var delay = Math.pow(2, syncRetryCount) * 1000; // Exponential backoff
      console.log('Firebase: Sync failed, retrying in', delay/1000, 'seconds...');
      setTimeout(syncWithRetry, delay);
    } else {
      console.error('Firebase: Max sync retries reached');
      showToast('Sync failed after ' + maxSyncRetries + ' attempts', 'error');
      updateSyncIndicator('error');
      syncRetryCount = 0;
    }
  }
}

// v9.1.14: Debounce visibility sync to prevent constant refreshing on iPadOS
var lastVisibilitySync = 0;
var MIN_VISIBILITY_SYNC_INTERVAL = 30000; // 30 seconds minimum between visibility syncs

// Visibility change handler - sync when tab becomes visible
document.addEventListener('visibilitychange', function() {
  // v19.6: Track away time for Notification Center
  if (document.visibilityState === 'hidden') {
    try { localStorage.setItem('roweos_notifications_away_since', String(Date.now())); } catch(e) {}
  }
  if (document.visibilityState === 'visible') {
    try { if (typeof updateNotificationBadge === 'function') updateNotificationBadge(); } catch(e) {}
    if (navigator.onLine && firebaseUser) {
      var now = Date.now();
      if (now - lastVisibilitySync < MIN_VISIBILITY_SYNC_INTERVAL) {
        console.log('Firebase: Visibility sync skipped (too soon)');
        return;
      }
      lastVisibilitySync = now;
      console.log('Firebase: Tab visible, checking for updates...');
      // v28.5: Re-enable Firestore network after iOS background termination
      try {
        var _db = firebase.firestore();
        if (typeof _db.enableNetwork === 'function') {
          _db.enableNetwork().catch(function(e) {
            console.log('Firebase: enableNetwork failed, will retry on sync:', e.message);
          });
        }
      } catch(e) {}
      loadFromFirebase(false);
      // v19.1: Pick up any cloud-executed results
      pickUpCloudResults();
    }
  }
});

// v7.10: Periodic LOAD check (every 5 minutes when active) - separate from PUSH sync
var periodicLoadInterval = null;

function startPeriodicLoadCheck() {
  if (periodicLoadInterval) clearInterval(periodicLoadInterval);
  
  periodicLoadInterval = setInterval(function() {
    if (document.visibilityState === 'visible' && navigator.onLine && firebaseUser) {
      console.log('[Firebase] Periodic load check (5 min)');
      loadFromFirebase(false);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// v19.1: Cloud Scheduler — Background execution support

/**
 * Toggle cloud scheduler on/off
 */
function toggleCloudScheduler(enabled) {
  if (!firebaseUser) {
    showToast('Sign in to Firebase first', 'error');
    var toggle = document.getElementById('cloudSchedulerToggle');
    if (toggle) toggle.checked = false;
    return;
  }
  if (enabled) {
    enableCloudScheduler();
  } else {
    disableCloudScheduler();
  }
}

/**
 * Enable cloud scheduler — copies API keys to Firestore secure storage
 */
function enableCloudScheduler() {
  if (!firebaseUser || !firebase) {
    showToast('Not connected to Firebase', 'error');
    return;
  }
  var apiKeys = {};
  try {
    apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
  } catch(e) {}

  if (!apiKeys.anthropic && !apiKeys.openai && !apiKeys.google) {
    showToast('Add at least one API key first', 'error');
    var toggle = document.getElementById('cloudSchedulerToggle');
    if (toggle) toggle.checked = false;
    return;
  }

  var uid = firebaseUser.uid;
  var db = firebase.firestore();
  var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';

  // Write API keys to secure Firestore path
  var secureData = {
    cloudSchedulerEnabled: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (apiKeys.anthropic) secureData.anthropic = apiKeys.anthropic;
  if (apiKeys.openai) secureData.openai = apiKeys.openai;
  if (apiKeys.google) secureData.google = apiKeys.google;

  db.doc('roweos_users/' + uid + '/secure/api_keys').set(secureData, { merge: true })
    .then(function() {
      // v19.1: Ensure parent user doc exists so Cloud Function can enumerate users
      return db.doc('roweos_users/' + uid).set({
        cloudSchedulerEnabled: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    })
    .then(function() {
      // Also store timezone in profile settings
      return db.doc('roweos_users/' + uid + '/profile/main').set({
        settings: { timezone: timezone }
      }, { merge: true });
    })
    .then(function() {
      localStorage.setItem('roweos_cloud_scheduler', 'true');
      updateCloudSchedulerUI(true);
      showToast('Cloud scheduler enabled: automations will run in background', 'success');
    })
    .catch(function(err) {
      console.error('[Cloud Scheduler] Enable failed:', err);
      showToast('Failed to enable: ' + err.message, 'error');
      var toggle = document.getElementById('cloudSchedulerToggle');
      if (toggle) toggle.checked = false;
    });
}

/**
 * Disable cloud scheduler
 */
function disableCloudScheduler() {
  if (!firebaseUser || !firebase) return;
  var uid = firebaseUser.uid;
  var db = firebase.firestore();

  db.doc('roweos_users/' + uid + '/secure/api_keys').set({
    cloudSchedulerEnabled: false,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true })
    .then(function() {
      // v19.1: Update parent doc too
      return db.doc('roweos_users/' + uid).set({ cloudSchedulerEnabled: false }, { merge: true });
    })
    .then(function() {
      localStorage.setItem('roweos_cloud_scheduler', 'false');
      updateCloudSchedulerUI(false);
      showToast('Cloud scheduler disabled', 'info');
    })
    .catch(function(err) {
      console.error('[Cloud Scheduler] Disable failed:', err);
      showToast('Failed to disable: ' + err.message, 'error');
    });
}

/**
 * Update the cloud scheduler UI in Settings
 */
function updateCloudSchedulerUI(enabled) {
  var toggle = document.getElementById('cloudSchedulerToggle');
  var status = document.getElementById('cloudSchedulerStatus');
  var details = document.getElementById('cloudSchedulerDetails');
  if (toggle) toggle.checked = enabled;
  if (status) status.textContent = enabled
    ? 'Enabled: tasks run even when app is closed'
    : 'Disabled: automations only run when app is open';
  if (details) details.style.display = enabled ? 'block' : 'none';
}

/**
 * Sync API keys to Firestore if cloud scheduler is enabled
 * Called when user saves/updates an API key
 */
function syncApiKeysToCloud() {
  if (localStorage.getItem('roweos_cloud_scheduler') !== 'true') return;
  if (!firebaseUser || !firebase) return;

  var apiKeys = {};
  try { apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}

  var uid = firebaseUser.uid;
  var db = firebase.firestore();
  var update = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  if (apiKeys.anthropic) update.anthropic = apiKeys.anthropic;
  if (apiKeys.openai) update.openai = apiKeys.openai;
  if (apiKeys.google) update.google = apiKeys.google;

  db.doc('roweos_users/' + uid + '/secure/api_keys').set(update, { merge: true })
    .catch(function(err) {
      console.warn('[Cloud Scheduler] API key sync failed:', err.message);
    });
}

/**
 * v20.17: Pick up results from cloud-executed tasks
 * Per-device tracking: each device tracks which result doc IDs it has processed
 * All devices get all results (no global picked_up flag)
 */
function pickUpCloudResults() {
  if (!firebaseUser || !firebase) return;
  if (localStorage.getItem('roweos_cloud_scheduler') !== 'true') return;

  var uid = firebaseUser.uid;
  var db = firebase.firestore();

  // Per-device: track processed doc IDs locally
  var processedIds = {};
  try { processedIds = JSON.parse(localStorage.getItem('roweos_cloud_results_processed') || '{}'); } catch(e) {}

  // v22.26: Order by timestamp desc so newest results come first, and clean up old docs
  db.collection('roweos_users/' + uid + '/cloud_results')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get()
    .then(function(snap) {
      if (snap.empty) return;

      var count = 0;
      var newProcessed = false;
      var docsToDelete = []; // Old processed docs to clean up

      snap.forEach(function(doc) {
        var docId = doc.id;
        var data = doc.data();

        // If already processed by this device, mark for cleanup if older than 1 hour
        if (processedIds[docId]) {
          var processedAt = processedIds[docId];
          if (Date.now() - processedAt > 3600000) {
            docsToDelete.push(doc.ref);
          }
          return;
        }

        count++;
        processedIds[docId] = Date.now();
        newProcessed = true;

        // Write to task history
        try {
          var historyKey = 'roweos_task_history';
          var history = [];
          try { history = JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch(e) {}
          var cleanResult = data.result || '';
          if (cleanResult.length > 5000) cleanResult = cleanResult.substring(0, 5000);
          history.unshift({
            taskId: data.taskId,
            taskName: data.taskName,
            brand: data.brand,
            action: data.action,
            timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp) : new Date().toISOString(),
            result: cleanResult,
            executedBy: 'cloud'
          });
          if (history.length > 50) history = history.slice(0, 50);
          try { localStorage.setItem(historyKey, JSON.stringify(history)); } catch(e) {}
        } catch(e) {}

        // Write to auto lab history
        if (typeof addAutoLabHistory === 'function') {
          try {
            addAutoLabHistory(
              { id: data.taskId, name: data.taskName, action: data.action },
              data.success,
              (data.result || '').substring(0, 200) + ' [Cloud]'
            );
          } catch(e) {}
        }

        // Write to completed automations
        if (typeof addCompletedAutomation === 'function') {
          try {
            addCompletedAutomation(
              { id: data.taskId, name: data.taskName, action: data.action },
              data.success
            );
          } catch(e) {}
        }

        // Notification Center — pass execution timestamp so it shows when it ran, not when picked up
        try {
          var execTs = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp) : new Date().toISOString();
          addNotification('cloud_result',
            (data.success !== false ? 'Automation Completed' : 'Automation Failed'),
            (data.taskName || 'Task') + (data.brand ? ' (' + data.brand + ')' : ''),
            { taskId: data.taskId, taskName: data.taskName, brand: data.brand,
              action: data.action, success: data.success !== false, timestamp: execTs }
          );
        } catch(e) {}
      });

      if (newProcessed) {
        // Save processed IDs (cap at 200 entries, prune oldest)
        var pIds = Object.keys(processedIds);
        if (pIds.length > 200) {
          var sorted = pIds.sort(function(a, b) { return processedIds[a] - processedIds[b]; });
          for (var i = 0; i < sorted.length - 200; i++) delete processedIds[sorted[i]];
        }
        try { localStorage.setItem('roweos_cloud_results_processed', JSON.stringify(processedIds)); } catch(e) {}

        if (count > 0) {
          showToast(count + ' cloud task' + (count > 1 ? 's' : '') + ' completed', 'success');
          // v20.17: Re-render automations view if open
          if (typeof currentView !== 'undefined' && currentView === 'automations') {
            if (typeof renderAutoLabScheduler === 'function') renderAutoLabScheduler();
          }
        }
      }

      // v22.26: Clean up old processed cloud_results docs from Firestore
      if (docsToDelete.length > 0) {
        console.log('[Cloud Results] Cleaning up ' + docsToDelete.length + ' old processed docs');
        docsToDelete.forEach(function(ref) {
          ref.delete().catch(function() {}); // Fire and forget
        });
      }
    })
    .catch(function(err) {
      console.warn('[Cloud Results] Pickup failed (' + (err.code || 'unknown') + '):', err.message);
    })
    .finally(function() {
      // Poll every 60s while app is open
      if (localStorage.getItem('roweos_cloud_scheduler') === 'true') {
        setTimeout(pickUpCloudResults, 60000);
      }
    });
}

/**
 * Initialize cloud scheduler state on app load
 */
function initCloudSchedulerState() {
  var enabled = localStorage.getItem('roweos_cloud_scheduler') === 'true';
  updateCloudSchedulerUI(enabled);
  // If signed in and enabled, pick up any pending results
  if (enabled && firebaseUser) {
    setTimeout(pickUpCloudResults, 3000);
  }
}

// Enhanced conflict resolution
function resolveDataConflicts(localData, cloudData) {
  // Cloud data wins for most things, but we merge arrays intelligently
  var resolved = {};
  
  // For arrays like brands, runs - merge by ID
  ['brands', 'runs', 'customOps', 'calendar', 'automations'].forEach(function(key) {
    if (Array.isArray(localData[key]) && Array.isArray(cloudData[key])) {
      var merged = new Map();
      
      // Add local items
      localData[key].forEach(function(item) {
        var id = item.id || item.name || JSON.stringify(item);
        merged.set(id, item);
      });
      
      // Cloud items override local (cloud wins on conflict)
      cloudData[key].forEach(function(item) {
        var id = item.id || item.name || JSON.stringify(item);
        merged.set(id, item);
      });
      
      resolved[key] = Array.from(merged.values());
    } else {
      // Non-array: cloud wins
      resolved[key] = cloudData[key] !== undefined ? cloudData[key] : localData[key];
    }
  });
  
  // Settings: merge (cloud wins on same keys)
  resolved.settings = Object.assign({}, localData.settings || {}, cloudData.settings || {});
  
  return resolved;
}

// Force full sync (useful for resolving issues)
async function forceFullSync() {
  console.log('[Force Sync] Starting...');
  console.log('[Force Sync] Online:', navigator.onLine);
  console.log('[Force Sync] User:', firebaseUser ? firebaseUser.email : 'null');
  
  if (!navigator.onLine || !firebaseUser) {
    console.log('[Force Sync] ERROR: Offline or not signed in');
    showToast('Cannot sync while offline', 'warning');
    return;
  }
  
  showToast('Performing full sync...', 'info');
  updateSyncIndicator('syncing');
  
  try {
    // Push local data first
    await syncToFirebase();
    
    // Then pull and merge
    await loadFromFirebase(false);
    
    showToast('Full sync complete', 'success');
    updateSyncIndicator('connected');
  } catch (error) {
    console.error('Firebase: Full sync error:', error);
    showToast('Full sync failed: ' + error.message, 'error');
    updateSyncIndicator('error');
  }
}

/**
 * v11.0.5: Force PUSH all local data to cloud (overwrites cloud)
 * Use this when local data is the source of truth
 */
// v25.0: Force push is now a pull (write-through handles all pushes automatically)
async function forcePushToCloud() {
  console.log('[Force Push] v25.0: Write-through push all data, then pull');

  if (!navigator.onLine || !firebaseUser) {
    showToast('Cannot sync while offline or not signed in', 'warning');
    return;
  }

  showToast('Pushing data to cloud...', 'info');
  updateSyncIndicator('syncing');

  try {
    // v25.0: Push all data first using write-through
    if (typeof writeDBConversations === 'function') writeDBConversations();
    if (typeof writeDBTodos === 'function') writeDBTodos();
    if (typeof writeDBCalendar === 'function') writeDBCalendar();
    if (typeof pulseGoals !== 'undefined' && typeof writeDB === 'function') {
      writeDB('pulse/main', { goals: pulseGoals }, { category: 'goals' });
    }
    var _autos = [];
    try { _autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(ae) {}
    _autos.forEach(function(a) { if (a && a.id && typeof writeDBAutomation === 'function') writeDBAutomation(a); });
    var _cls = [];
    try { _cls = JSON.parse(localStorage.getItem('roweos_clients') || '[]'); } catch(ce) {}
    if (_cls.length > 0 && typeof writeDB === 'function') {
      var cd = JSON.parse(JSON.stringify(_cls));
      cd.forEach(function(c) { if (c.logo && c.logo.length > 50000) c.logo = ''; });
      writeDB('profile/clients', { data: cd });
    }
    // Push brands -- use saveBrands() which writes both individual docs AND _all doc
    if (typeof saveBrands === 'function') {
      saveBrands();
    }
    // Push library (v25.1: was missing from force push)
    if (typeof fileLibrary !== 'undefined' && typeof writeDB === 'function') {
      writeDB('library/brand', { data: JSON.stringify(fileLibrary) }, { category: 'library' });
    }
    var _lifeLibFP = null;
    try { _lifeLibFP = fileLibrary && fileLibrary['_life'] ? fileLibrary['_life'] : JSON.parse(localStorage.getItem('roweos_life_library') || 'null'); } catch(le) {}
    if (_lifeLibFP && typeof writeDB === 'function') {
      writeDB('library/life', { data: JSON.stringify(_lifeLibFP) }, { category: 'library' });
    }
    // Push folio
    var folioItems = [];
    try { folioItems = JSON.parse(localStorage.getItem('roweos_folio_items') || '[]'); } catch(fe) {}
    if (folioItems.length > 0 && typeof writeDB === 'function') writeDB('folio/main', { items: folioItems });

    // Wait for writes to dispatch, then pull
    await new Promise(function(resolve) { setTimeout(resolve, 2000); });
    await loadFromFirebaseV2(true);

    _saveSyncBaselines();
    var lastSync = new Date().toLocaleString();
    localStorage.setItem('roweos_last_sync', lastSync);
    localStorage.setItem('roweos_last_sync_device', getDeviceType());
    updateLastSyncDisplay(lastSync, getDeviceType());

    showToast('Cloud sync complete', 'success');
    updateSyncIndicator('connected');

  } catch (error) {
    console.error('[Force Push] Error:', error);
    showToast('Sync failed: ' + error.message, 'error');
    updateSyncIndicator('error');
  }
}

/**
 * v11.0.5: Force PULL all cloud data to local (overwrites local)
 * Use this when cloud data is the source of truth
 */
async function forcePullFromCloud() {
  console.log('[Force Pull] Starting...');
  
  if (!navigator.onLine || !firebaseUser) {
    showToast('Cannot sync while offline or not signed in', 'warning');
    return;
  }
  
  // Confirm with user - this is destructive!
  if (!confirm('⚠️ WARNING: This will DOWNLOAD all cloud data and OVERWRITE your local data. Any local changes not synced will be LOST. Continue?')) {
    return;
  }
  
  showToast('Pulling all data from cloud...', 'info');
  updateSyncIndicator('syncing');
  
  try {
    // v24.27: Use V2 pull (reads from subcollections that match V2 push)
    await loadFromFirebaseV2(true);
    showToast('Cloud data restored', 'success');
    updateSyncIndicator('connected');
    if (typeof reloadAllData === 'function') reloadAllData();
    if (typeof renderSyncInventory === 'function') renderSyncInventory();
  } catch(e) {
    console.error('[Force Pull]', e);
    showToast('Pull failed: ' + e.message, 'error');
    updateSyncIndicator('connected');
  }
  return;
  // --- Legacy V1 pull below (kept for reference, no longer executed) ---
  try {
    var doc = await firebase.firestore().collection('roweos_users').doc(firebaseUser.uid).get();

    if (!doc.exists) {
      showToast('No cloud data found', 'warning');
      updateSyncIndicator('connected');
      return;
    }
    
    var data = doc.data();
    console.log('[Force Pull] Got cloud data, applying...');
    
    // Force apply ALL data (bypass smart merge)
    
    // Brands
    if (data.brands) {
      localStorage.setItem('roweos_brands', JSON.stringify(data.brands));
      console.log('[Force Pull] Loaded brands:', data.brands.length);
    }
    
    // Inventory - FORCE OVERWRITE
    if (data.inventory) {
      var invData = typeof data.inventory === 'string' ? JSON.parse(data.inventory) : data.inventory;
      localStorage.setItem('roweos_inventory', JSON.stringify(invData));
      if (typeof inventory !== 'undefined') {
        inventory.items = invData.items || [];
        inventory.categories = invData.categories || inventory.categories;
        inventory.updatedAt = invData.updatedAt;
      }
      console.log('[Force Pull] Loaded inventory:', (invData.items || []).length, 'items');
    }
    
    // Conversations
    if (data.conversations && data.conversations.agentHistoryJson) {
      localStorage.setItem('roweos_agentCommands', data.conversations.agentHistoryJson);
    }
    
    // LifeAI
    if (data.lifeAI) {
      if (data.lifeAI.profiles) localStorage.setItem('roweos_life_profiles', JSON.stringify(data.lifeAI.profiles));
      if (data.lifeAI.generatedOps) localStorage.setItem('roweos_generated_life_ops', JSON.stringify(data.lifeAI.generatedOps));
    }
    
    // Library
    if (data.library) {
      var libraryStr = typeof data.library === 'string' ? data.library : JSON.stringify(data.library);
      localStorage.setItem('roweosLibrary', libraryStr);
    }
    
    // Calendar
    if (data.calendar) localStorage.setItem('roweos_calendar', JSON.stringify(data.calendar));
    
    // Todos
    if (data.todos) localStorage.setItem('roweosTodos', JSON.stringify(data.todos));
    
    // Runs — v23.16: Merge by ID instead of replacing (preserves local runs)
    if (data.runs) {
      var v2Existing = {};
      try { v2Existing = JSON.parse(localStorage.getItem('roweos_runs') || '{}'); } catch(e) { console.warn('[Sync] Corrupted roweos_runs (batch):', e.message); }
      if (Array.isArray(v2Existing)) v2Existing = { runs: v2Existing };
      var v2Local = v2Existing.runs || [];
      var v2Cloud = Array.isArray(data.runs) ? data.runs : (data.runs.runs || []);
      var v2LocalIds = {};
      for (var _v2i = 0; _v2i < v2Local.length; _v2i++) { if (v2Local[_v2i].id) v2LocalIds[v2Local[_v2i].id] = true; }
      for (var _v2j = 0; _v2j < v2Cloud.length; _v2j++) { if (!v2Cloud[_v2j].id || !v2LocalIds[v2Cloud[_v2j].id]) v2Local.push(v2Cloud[_v2j]); }
      v2Local.sort(function(a, b) { return (a.id || 0) - (b.id || 0); });
      v2Existing.runs = v2Local.slice(-50);
      localStorage.setItem('roweos_runs', JSON.stringify(v2Existing));
    }
    
    // Custom ops
    if (data.customOps) localStorage.setItem('roweos_custom_operations', JSON.stringify(data.customOps));
    // v16.11: Clients
    if (data.clients) localStorage.setItem('roweos_clients', JSON.stringify(data.clients));

    // v23.16: Commerce/Analytics
    if (data.commerce) localStorage.setItem('roweos_commerce', JSON.stringify(data.commerce));

    var lastSync = new Date().toLocaleString();
    localStorage.setItem('roweos_last_sync', lastSync);
    localStorage.setItem('roweos_last_sync_device', 'cloud');
    updateLastSyncDisplay(lastSync, 'cloud');
    
    showToast('All cloud data loaded ✓', 'success');
    updateSyncIndicator('connected');
    
    // Refresh UI
    if (typeof renderInventoryGrid === 'function') renderInventoryGrid();
    if (typeof updateInventoryStats === 'function') updateInventoryStats();
    if (typeof loadBrands === 'function') loadBrands();
    if (typeof loadCommerceData === 'function') loadCommerceData();
    if (typeof loadGuardrails === 'function') loadGuardrails();

  } catch (error) {
    console.error('[Force Pull] Error:', error);
    showToast('Pull failed: ' + error.message, 'error');
    updateSyncIndicator('error');
  }
}

// v9.1.14: Force reload from server while preserving localStorage
function forceReloadFromServer() {
  showToast('Checking for updates...', 'info');
  
  // Small delay so user sees the toast
  setTimeout(function() {
    // Clear service worker cache if available
    if ('caches' in window) {
      caches.keys().then(function(names) {
        names.forEach(function(name) {
          caches.delete(name);
        });
      });
    }
    
    // Unregister service workers to force fresh fetch
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        registrations.forEach(function(registration) {
          registration.unregister();
        });
      });
    }
    
    // Force reload from server with cache-busting
    // localStorage data will persist through reload
    var currentUrl = window.location.href.split('?')[0];
    var cacheBuster = '?v=' + Date.now();
    window.location.href = currentUrl + cacheBuster;
  }, 500);
}

// Initialize offline support on page load
document.addEventListener('DOMContentLoaded', function() {
  // Check initial online status
  isOnline = navigator.onLine;
  
  if (!isOnline) {
    updateOfflineIndicator();
  }
  
  // v7.10: Start both periodic sync (push) and load check when signed in
  if (firebaseUser) {
    startPeriodicSync();      // Push every 60 seconds
    startPeriodicLoadCheck(); // Load check every 5 minutes
  }

  // v20.14: Register service worker for push notifications
  if (isPushSupported()) {
    registerServiceWorker();
  }

  console.log('Firebase Phase 7: Offline support initialized');
});

// ═══════════════════════════════════════════════════════════════════════════════
// END PHASE 7: OFFLINE SUPPORT
// ═══════════════════════════════════════════════════════════════════════════════

// Model Configuration Modal Functions
async function openModelConfigModal() {
  document.getElementById('modelConfigModal').classList.add('active');
  
  // Force refresh API status before rendering to show current connection state
  console.log('[Model Config] Refreshing API status before display...');
  await checkApiConnection(true);
  
  renderModelConfigList();
}

function closeModelConfigModal() {
  document.getElementById('modelConfigModal').classList.remove('active');
}

function renderModelConfigList() {
  var container = document.getElementById('modelConfigList');
  if (!container) return;

  // v24.11: Always read fresh from localStorage — in-memory brandSettings can be stale from sync overwrites
  var freshSettings = {};
  try { freshSettings = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}'); } catch(e) {}

  var html = '';

  // Use actual brands array length
  for (var i = 0; i < brands.length; i++) {
    var brandName = brands[i].name;
    var settings = freshSettings[i] || brandSettings[i] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    
    // Validate and fix outdated model IDs
    if (providerConfigs && providerConfigs[settings.provider]) {
      var validModels = providerConfigs[settings.provider].models;
      var modelExists = validModels.some(function(m) { return m.id === settings.model; });
      
      if (!modelExists) {
        // Model ID doesn't exist in current list - migrate to first model
        console.log('[Migration] Updating outdated model:', settings.model, '→', validModels[0].id);
        settings.model = validModels[0].id;
        brandSettings[i] = settings;
        saveBrandModelConfig();
      }
    }
    
    // v24.4: RoweOS AI is connected if ANY provider key exists (it smart-routes across them)
    var connected = settings.provider === 'roweos'
      ? (providerKeys.anthropic || providerKeys.openai || providerKeys.google || false)
      : (providerKeys[settings.provider] || false);
    var providerClass = settings.provider; // 'anthropic', 'openai', 'google', or 'roweos'
    var isRoweOS = settings.provider === 'roweos';

    // Get model display name and split it
    var fullModelName = getModelDisplayName(settings.provider, settings.model);
    var modelParts = isRoweOS ? { provider: 'ROWEOS AI', model: 'Smart Routing' } : splitModelName(fullModelName);

    // v24.4: RoweOS AI gets gold connected badge
    var statusClass = connected ? (isRoweOS ? 'connected-gold' : 'connected') : 'disconnected';

    html += '<div class="model-config-card">';

    // Header with brand name and status
    html += '  <div class="model-config-card-header">';
    html += '    <div class="model-config-brand-name">' + brandName + '</div>';
    html += '    <div class="model-config-status ' + statusClass + '">';
    html += (connected ? '● Connected' : '○ Not Connected');
    html += '    </div>';
    html += '  </div>';

    // Provider display with brand colors and split model name
    html += '  <div class="model-config-provider-display ' + providerClass + '">';
    html += '    <div class="model-config-provider-name">' + modelParts.provider + '</div>';
    html += '    <div class="model-config-model-name">' + modelParts.model + '</div>';
    html += '  </div>';

    // Controls
    html += '  <div class="model-config-controls">';
    html += '    <select id="providerSelect-' + i + '" class="model-config-select" onchange="updateBrandProvider(' + i + ', this.value)">';
    html += '      <option value="roweos"' + (settings.provider === 'roweos' ? ' selected' : '') + '>RoweOS AI</option>';
    html += '      <option value="anthropic"' + (settings.provider === 'anthropic' ? ' selected' : '') + '>Anthropic, Claude</option>';
    html += '      <option value="openai"' + (settings.provider === 'openai' ? ' selected' : '') + '>OpenAI, ChatGPT</option>';
    html += '      <option value="google"' + (settings.provider === 'google' ? ' selected' : '') + '>Google</option>';
    html += '    </select>';
    html += '    <select id="modelSelect-' + i + '" class="model-config-select" onchange="updateBrandModel(' + i + ', this.value)">';
    html += getModelOptions(settings.provider, settings.model);
    html += '    </select>';
    html += '  </div>';
    
    html += '</div>';
  }
  
  container.innerHTML = html;
}

// Helper function to split model names for display
function splitModelName(fullName) {
  // Claude Sonnet 4 → { provider: "Claude", model: "Sonnet 4" }
  // GPT-5.5 → { provider: "GPT", model: "5.4" }
  // Claude Opus 4.7 → { provider: "Claude", model: "Opus 4.7" }
  
  var parts = fullName.split(' ');
  
  if (parts.length === 1) {
    // Single word model like "GPT-4o"
    if (fullName.startsWith('GPT')) {
      return { provider: 'GPT', model: fullName.replace('GPT-', '') };
    }
    return { provider: fullName, model: '' };
  }
  
  // Multi-word: first word is provider, rest is model
  var provider = parts[0];
  var model = parts.slice(1).join(' ');
  
  return { provider: provider, model: model };
}

function getModelDisplayName(provider, modelId) {
  if (!providerConfigs || !providerConfigs[provider]) return modelId;
  var models = providerConfigs[provider].models;
  for (var i = 0; i < models.length; i++) {
    if (models[i].id === modelId) return models[i].name;
  }
  return modelId;
}

function getModelOptions(provider, selectedModel) {
  if (!providerConfigs || !providerConfigs[provider]) {
    return '<option value="' + selectedModel + '">' + selectedModel + '</option>';
  }
  
  var models = providerConfigs[provider].models;
  var html = '';
  for (var i = 0; i < models.length; i++) {
    var model = models[i];
    var selected = model.id === selectedModel ? ' selected' : '';
    html += '<option value="' + model.id + '"' + selected + '>' + model.name + '</option>';
  }
  return html;
}

function updateBrandProvider(brandIndex, provider) {
  console.log('[BrandModel v24.11] updateBrandProvider called: brand=' + brandIndex + ' provider=' + provider);
  if (!brandSettings[brandIndex]) {
    brandSettings[brandIndex] = { provider: provider, model: '' };
  } else {
    brandSettings[brandIndex].provider = provider;
  }

  // Update model dropdown with new provider's models
  if (providerConfigs && providerConfigs[provider]) {
    var defaultModel = providerConfigs[provider].models[0].id;
    brandSettings[brandIndex].model = defaultModel;
    console.log('[BrandModel v24.11] Set model to:', defaultModel);
  }

  saveBrandModelConfig();
  // v24.11: Verify localStorage was written correctly
  try {
    var verify = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}');
    console.log('[BrandModel v24.11] Verified localStorage brand ' + brandIndex + ':', JSON.stringify(verify[brandIndex]));
  } catch(e) {}
  renderModelConfigList();  // Re-render to update model dropdown
  showToast('Provider updated for brand', 'success');
}

function updateBrandModel(brandIndex, model) {
  if (!brandSettings[brandIndex]) {
    brandSettings[brandIndex] = { provider: 'anthropic', model: model };
  } else {
    brandSettings[brandIndex].model = model;
  }
  
  saveBrandModelConfig();
  renderModelConfigList();  // Re-render to update display
  showToast('Model updated for brand', 'success');
}

// Onboarding Wizard Functions
var onboardingSelectedProvider = null;

function checkFirstLaunch() {
  // v4.1.2: Check if this is truly first launch
  var hasWelcomed = localStorage.getItem(USER_DATA_KEYS.welcomed);
  var hasBrands = brands.length > 0;
  // v14.2: Also check if onboarding was completed (LifeAI has no brands)
  var onboardingDone = localStorage.getItem(USER_DATA_KEYS.onboardingCompleted) === 'true';

  if (onboardingDone) {
    // Onboarding already completed - normal app start
    console.log('[checkFirstLaunch] Onboarding completed - skipping');
    return;
  }

  if (!hasWelcomed && !hasBrands) {
    // First time ever - show welcome screen
    console.log('=== First Launch Detected ===');
    console.log('Showing welcome screen...');
    setTimeout(function() {
      showWelcomeScreen();
    }, 500);
  } else if (!hasBrands) {
    // Welcomed before but no brands - go straight to onboarding
    console.log('No brands found - showing onboarding');
    setTimeout(function() {
      showOnboarding();
    }, 500);
  } else {
    // Has brands - normal app start
    console.log('[checkFirstLaunch] Found ' + brands.length + ' brands - skipping onboarding');
  }
}

// "Get Started" button from welcome screen
function startWelcomeOnboarding() {
  console.log('=== Starting onboarding from welcome screen ===');
  
  // Mark as welcomed
  localStorage.setItem(USER_DATA_KEYS.welcomed, 'true');
  
  // Hide welcome screen
  var welcomeScreen = document.getElementById('welcomeScreen');
  if (welcomeScreen) {
    welcomeScreen.style.display = 'none';
  }
  
  // Show onboarding
  showOnboarding();
}

// v15.16: Reset all onboarding state for clean re-entry
function resetOnboardingState() {
  onboardingSelectedProvider = null;
  selectedOnboardingMode = null;
  sharedUserName = '';
  sharedBrandName = '';
  sharedSelectedProvider = null;
  window.onboardingBrandName = null;
  window.onboardingPrefillData = null;
  window.onboardingOwnershipData = null;
  window.websiteSourceUrl = null;

  // Reset form inputs
  var nameInput = document.getElementById('sharedUserName');
  if (nameInput) nameInput.value = '';
  var brandInput = document.getElementById('sharedBrandName');
  if (brandInput) brandInput.value = '';

  // v26.7: Clear color, logo, and web search state to prevent bleed between flows
  window._onboardingBrandColor = null;
  window._onboardingBrandColorLight = null;
  window._onboardingLogo = null;
  window._onboardingColorMode = null;
  window._pendingWebSearchUrl = null;
  localStorage.removeItem('roweos_pending_web_search_url');
  localStorage.removeItem('roweos_web_import_state');
  // v28.4: Clear research result to prevent stale data between brand additions
  if (typeof _researchCurrentResult !== 'undefined') _researchCurrentResult = null;

  // Remove .selected from mode cards and provider cards
  var modeCards = document.querySelectorAll('#onboardingStepMode .onboarding-mode-card, #onboardingStepMode .onboarding-model-card');
  modeCards.forEach(function(card) { card.classList.remove('selected'); });
  var providerCards = document.querySelectorAll('#onboardingStepProvider .onboarding-provider-card');
  providerCards.forEach(function(card) { card.classList.remove('selected'); });

  console.log('[Onboarding] State reset for clean re-entry');
}

function showOnboarding() {
  console.log('=== RoweOS v2.81.0: showOnboarding() called ===');

  // v15.16: Reset state on re-entry
  resetOnboardingState();

  // Hide launch screen
  var launchScreen = document.getElementById('launchScreen');
  if (launchScreen) {
    launchScreen.style.display = 'none';
    launchScreen.classList.remove('active');
    console.log('✓ Launch screen hidden');
  }
  
  // Show onboarding modal - FORCE DISPLAY WITH INLINE STYLES
  var modal = document.getElementById('onboardingModal');
  if (modal) {
    modal.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 10000 !important;';
    modal.classList.add('show');
    console.log('✓ Onboarding modal forced visible with inline styles');
  } else {
    console.error('✗ onboardingModal element not found in DOM!');
    return;
  }
  
  // Show Welcome Screen (Step 0)
  goToOnboardingStep(0);
  
  console.log('=== Onboarding should now be visible ===');
}

function hideOnboarding() {
  var modal = document.getElementById('onboardingModal');
  if (modal) {
    // v15.3: Clear entire cssText to remove !important display:flex set by showOnboarding
    modal.style.cssText = 'display: none !important;';
    modal.classList.remove('show');
  }
  // v28.4: Remove onboarding history state so back button doesn't re-trigger
  if (window._onboardingHistoryPushed) {
    window._onboardingHistoryPushed = false;
  }
}

// v28.4: Update onboarding social step to show connected status for all platforms
function updateOnboardingSocialStatus() {
  var platforms = [
    { key: 'x', statusId: 'onboardingSocialXStatus' },
    { key: 'threads', statusId: 'onboardingSocialThreadsStatus' },
    { key: 'instagram', statusId: 'onboardingSocialIGStatus', actionId: 'onboardingSocialIGAction' }
  ];
  var checkmark = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><path d="M20 6L9 17l-5-5"/></svg>';
  for (var i = 0; i < platforms.length; i++) {
    var p = platforms[i];
    var connected = typeof isSocialConnected === 'function' && isSocialConnected(p.key);
    var handle = typeof getSocialHandle === 'function' ? getSocialHandle(p.key) : '';
    var statusEl = document.getElementById(p.statusId);
    if (statusEl) {
      if (connected) {
        statusEl.innerHTML = checkmark + (handle || 'Connected');
        statusEl.style.color = '#22c55e';
      } else {
        statusEl.textContent = 'Connect';
        statusEl.style.color = 'var(--text-tertiary)';
      }
    }
    if (p.actionId) {
      var actionEl = document.getElementById(p.actionId);
      if (actionEl) {
        if (connected) {
          actionEl.innerHTML = checkmark + 'Connected';
          actionEl.style.color = '#22c55e';
        } else {
          actionEl.textContent = 'Connect';
          actionEl.style.color = 'var(--text-tertiary)';
        }
      }
    }
  }
}

// v28.4: Handle browser back button during onboarding from +Add Brand
window.addEventListener('popstate', function(e) {
  if (e.state && e.state.onboardingAddBrand) {
    // Going back into the onboarding state -- ignore
    return;
  }
  // If onboarding was opened from +Add Brand and user hit back, close it
  if (window._onboardingHistoryPushed) {
    window._onboardingHistoryPushed = false;
    var onbModal = document.getElementById('onboardingModal');
    if (onbModal && onbModal.classList.contains('show')) {
      hideOnboarding();
      window._onboardingInProgress = false;
    }
  }
});

function goToOnboardingStep(step) {
  console.log('=== goToOnboardingStep called with step:', step);

  // Hide all steps (including new wizard steps 6-11 and import steps)
  var stepIds = ['onboardingStep0', 'onboardingStepPWA', 'onboardingStepMode', 'onboardingStepName', 'onboardingStepProvider', 'onboardingStep1', 'onboardingBrandName', 'onboardingBrandOwnership', 'onboardingStep2', 'onboardingTemplateSelection', 'onboardingTemplateBranding', 'onboardingStep3', 'onboardingStep4', 'onboardingStep5', 'onboardingStepLogo', 'onboardingStepFirebase', 'onboardingStepSync', 'onboardingStepCalendar', 'onboardingStepSocial', 'onboardingStepEmail', 'onboardingStepAutomations', 'onboardingStyleStep', 'onboardingStepSidebarPref', 'onboardingStepMobileNavPref', 'onboardingStepBlobPref', 'onboardingStepPush', 'onboardingStepCrossDevice', 'onboardingStepBetaWelcome', 'onboardingStep6', 'onboardingStep7', 'onboardingStep8', 'onboardingStep9', 'onboardingStep10', 'onboardingStep11', 'onboardingWebsiteImport', 'onboardingDocumentUpload', 'onboardingLifeStep1', 'onboardingLifeStep2', 'onboardingLifeStep3', 'onboardingLifeStep4', 'onboardingLifeBuilding', 'onboardingLifeStudioPreview', 'onboardingLifeStep5', 'onboardingStepCrossMode', 'onboardingWebSearchReview'];
  stepIds.forEach(function(id) {
    var stepEl = document.getElementById(id);
    if (stepEl) {
      stepEl.style.display = 'none';
      stepEl.classList.add('hidden');
      stepEl.style.visibility = 'hidden';
    }
  });
  
  // v10.5.25: Handle special step names
  var targetStepId = 'onboardingStep' + step;
  if (step === 'mode') {
    targetStepId = 'onboardingStepMode';
  } else if (step === 'pwa') {
    // v28.4: Skip PWA step if already installed as app
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      goToOnboardingStep('mode');
      return;
    }
    targetStepId = 'onboardingStepPWA';
    // v28.4: Auto-detect platform and expand matching section
    setTimeout(function() { initPWAInstallStep(); }, 50);
  } else if (step === 'name') {
    targetStepId = 'onboardingStepName';
  } else if (step === 'provider') {
    targetStepId = 'onboardingStepProvider';
    // v15.27: Reset provider state when navigating to this step
    onboardingSelectedProvider = null;
    _onboardingStep4State = 'apiKey'; // v21.0: Reset step 4 state
    // v15.27: Restore step 4 original content if model picker replaced it
    if (window._step4OriginalContent) {
      var step4El = document.getElementById('onboardingStep4');
      if (step4El) {
        var step4Content = step4El.querySelector('.onboarding-content');
        if (step4Content) step4Content.innerHTML = window._step4OriginalContent;
      }
      window._step4OriginalContent = null;
    }
    // v15.27: Dynamic back button based on mode
    var provBackBtn = document.getElementById('providerStepBackBtn');
    if (provBackBtn) {
      if (selectedOnboardingMode === 'brand') {
        provBackBtn.setAttribute('onclick', "goToOnboardingStep('ownership')");
      } else {
        provBackBtn.setAttribute('onclick', "goToOnboardingStep('name')");
      }
    }
  } else if (step === 'logo') {
    targetStepId = 'onboardingStepLogo';
  } else if (step === 'firebase') {
    targetStepId = 'onboardingStepFirebase';
  } else if (step === 'sync') {
    targetStepId = 'onboardingStepSync';
    // v15.27: Reset sync step visual state on entry
    var syncLocal = document.getElementById('syncLocalFirstScreen');
    var syncCloud = document.getElementById('syncCloudOptIn');
    if (syncLocal) syncLocal.style.display = 'block';
    if (syncCloud) syncCloud.style.display = 'none';
    // v15.27: Default-highlight local button since local-first is the initial view
    var syncLocalBtn = document.getElementById('syncLocalBtn');
    var syncCloudBtn = document.getElementById('syncCloudBtn');
    if (syncLocalBtn) {
      var accentVal = getAccentFallback();
      syncLocalBtn.style.borderColor = accentVal;
      syncLocalBtn.style.background = accentVal + '10';
      syncLocalBtn.dataset.selected = 'true';
    }
    if (syncCloudBtn) {
      syncCloudBtn.style.borderColor = 'var(--border-color)';
      syncCloudBtn.style.background = 'var(--bg-secondary)';
      delete syncCloudBtn.dataset.selected;
    }
    renderOnboardingSyncPrefs();
  } else if (step === 'calendar') {
    targetStepId = 'onboardingStepCalendar';
    // v16.12: Reset calendar step state on entry
    var gcalInputs = document.getElementById('onboardingGcalInputs');
    var icloudInputs = document.getElementById('onboardingIcloudInputs');
    if (gcalInputs) gcalInputs.style.display = 'none';
    if (icloudInputs) icloudInputs.style.display = 'none';
  } else if (step === 'social') {
    targetStepId = 'onboardingStepSocial';
    // v28.4: Update social connection statuses on step entry
    setTimeout(function() { updateOnboardingSocialStatus(); }, 100);
  } else if (step === 'email') {
    targetStepId = 'onboardingStepEmail';
    // v22.33: Update email connection status on entry
    setTimeout(function() {
      var config = typeof getMailConfig === 'function' ? getMailConfig() : {};
      var gmailStatus = document.getElementById('onboardingEmailGmailStatus');
      var outlookStatus = document.getElementById('onboardingEmailOutlookStatus');
      var gmailCard = document.getElementById('onboardingEmailGmailCard');
      var outlookCard = document.getElementById('onboardingEmailOutlookCard');
      if (config.gmailEmail && gmailStatus) {
        gmailStatus.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><path d="M20 6L9 17l-5-5"/></svg>' + config.gmailEmail;
        gmailStatus.style.color = '#22c55e';
        if (gmailCard) gmailCard.dataset.connected = 'true';
      }
      if (config.outlookEmail && outlookStatus) {
        outlookStatus.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><path d="M20 6L9 17l-5-5"/></svg>' + config.outlookEmail;
        outlookStatus.style.color = '#22c55e';
        if (outlookCard) outlookCard.dataset.connected = 'true';
      }
      // v24.26: Don't auto-fill default from during onboarding — let user enter manually
    }, 100);
  } else if (step === 'automations') {
    targetStepId = 'onboardingStepAutomations';
  } else if (step === 'workspaceStyle') {
    targetStepId = 'onboardingStyleStep';
  } else if (step === 'sidebarPref') {
    targetStepId = 'onboardingStepSidebarPref';
    // v20.20: Auto-skip to mobileNavPref on mobile
    if (window.innerWidth <= 768) {
      goToOnboardingStep('mobileNavPref');
      return;
    }
  } else if (step === 'mobileNavPref') {
    targetStepId = 'onboardingStepMobileNavPref';
    // v20.20: Auto-skip to pushSetup on desktop
    if (window.innerWidth > 768) {
      goToOnboardingStep('pushSetup');
      return;
    }
  } else if (step === 'blobPref') {
    targetStepId = 'onboardingStepBlobPref';
    // v24.26: Full reset of helix WebGL for fresh context
    stopOnbHelixAnim();
    if (_onbHelixRenderer) { try { _onbHelixRenderer.dispose(); } catch(e) {} _onbHelixRenderer = null; }
    _onbHelixMeshes = [];
    _onbHelixScene = null;
    _onbHelixInitialized = false;
    _onbHelixRetries = 0;
    // v24.26: Init both blob and helix after step is visible
    setTimeout(function() {
      // v24.26: Update blob color to user's selected accent
      var accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a89878';
      try {
        localStorage.setItem('roweos_blob_color1_dark', accentColor);
        localStorage.setItem('roweos_blob_color1_light', accentColor);
      } catch(e) {}
      // v24.26: If blob already init, just update its color uniforms; otherwise full init
      if (_onbBlobInitialized && _onbBlobUniforms) {
        try {
          _onbBlobUniforms.uColor.value = new THREE.Color(accentColor);
          var cB = new THREE.Color(accentColor);
          cB.offsetHSL(0.08, 0, 0.15);
          _onbBlobUniforms.uColorB.value = cB;
        } catch(e) {}
      } else {
        initOnboardingBlobPreview();
      }
      // v24.26: Also init helix preview
      initOnboardingHelixPreview();
      if (typeof initOnboardingBlobPrefUI === 'function') initOnboardingBlobPrefUI();
    }, 400);
  } else if (step === 'pushSetup') {
    targetStepId = 'onboardingStepPush';
  } else if (step === 'crossDevice' || step === 'addToDock') {
    targetStepId = 'onboardingStepCrossDevice';
    // v21.0: Populate cross-device content
    setTimeout(function() { populateCrossDeviceContent(); }, 50);
  } else if (step === 'crossMode') {
    targetStepId = 'onboardingStepCrossMode';
    setTimeout(function() { populateCrossModeContent(); }, 50);
  } else if (step === 'betaWelcome') {
    targetStepId = 'onboardingStepBetaWelcome';
  } else if (step === 'ownership') {
    targetStepId = 'onboardingBrandOwnership';
  } else if (step === 'lifeBuilding') {
    targetStepId = 'onboardingLifeBuilding';
  } else if (step === 'lifeStudioPreview') {
    targetStepId = 'onboardingLifeStudioPreview';
  } else if (step === 'websearch-review') {
    var wsrEl = document.getElementById('onboardingWebSearchReview');
    if (wsrEl) {
      wsrEl.classList.remove('hidden');
      wsrEl.style.display = 'flex';
      wsrEl.style.flexDirection = 'column';
      wsrEl.style.visibility = 'visible';
      wsrEl.style.opacity = '1';
    }
    _showWebSearchResults();
    return;
  } else if (typeof step === 'string' && step.startsWith('life')) {
    targetStepId = 'onboardingLifeStep' + step.replace('life', '');
  }
  
  // v14.0: Check if Firebase is already configured on firebase step load
  if (step === 'firebase') {
    if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()) {
      var fbStatus = document.getElementById('onboardingFirebaseStatus');
      if (fbStatus) {
        fbStatus.style.display = 'block';
        fbStatus.style.background = 'rgba(34, 197, 94, 0.15)';
        fbStatus.style.color = '#22c55e';
        fbStatus.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        fbStatus.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><path d="M20 6L9 17l-5-5"/></svg>Already configured - Firebase is connected';
      }
    }
  }

  // v27.0: Redirect to web search review if web search is active OR a URL is pending
  if (step === 7) {
    var _wsUrl = window._pendingWebSearchUrl || localStorage.getItem('roweos_pending_web_search_url');
    var wsState = typeof getWebSearchState === 'function' ? getWebSearchState() : null;
    if (_wsUrl) {
      // Web search already running — go straight to review
      if (wsState && wsState.status !== 'idle') {
        goToOnboardingStep('websearch-review');
        return;
      }
      // URL is pending but search hasn't started yet (mobile timing / model picker skipped)
      if (typeof startOnboardingWebSearch === 'function') {
        startOnboardingWebSearch();
      }
      goToOnboardingStep('websearch-review');
      return;
    }
  }

  // v9.1.14: Prefill step 7 (Brand Basics) with brand name from earlier step and/or extracted data
  if (step === 7) {
    var nameEl = document.getElementById('wizardBrandName');
    var taglineEl = document.getElementById('wizardBrandTagline');
    var descEl = document.getElementById('wizardBrandDescription');
    var websiteEl = document.getElementById('wizardBrandWebsite');
    
    // First, fill from brand name step
    if (nameEl && window.onboardingBrandName) {
      nameEl.value = window.onboardingBrandName;
    }
    
    // v9.1.14: Fill website from website import step
    if (websiteEl && window.websiteSourceUrl) {
      websiteEl.value = window.websiteSourceUrl;
    }
    
    // Then overlay with any extracted data
    if (window.onboardingPrefillData) {
      var data = window.onboardingPrefillData;
      console.log('[Onboarding] Prefilling step 7 with:', data);
      
      if (nameEl && data.brandName) nameEl.value = data.brandName;
      if (taglineEl && data.tagline) taglineEl.value = data.tagline;
      if (descEl) {
        var desc = data.essence || data.products || '';
        if (data.products && data.essence) {
          desc = data.essence + '\n\nProducts/Services: ' + data.products;
        }
        if (desc) descEl.value = desc;
      }
      // Also fill website from extracted source URL if available
      if (websiteEl && data.sourceUrl) {
        websiteEl.value = data.sourceUrl;
      }
    }
  }
  
  // v10.5.25: Update shared name step UI based on mode
  if (step === 'name' && typeof updateSharedNameStepUI === 'function') {
    updateSharedNameStepUI();
  }
  
  // v10.5.25: Update Step 5 UI based on mode (brand vs life)
  if (step === 5 && typeof updateStep5ForMode === 'function') {
    updateStep5ForMode();
  }
  
  // v15.26: Update logo title/subtitle based on mode
  if (step === 'logo') {
    var logoTitle = document.getElementById('onboardingLogoTitle');
    var logoSub = document.getElementById('onboardingLogoSubtitle');
    if (selectedOnboardingMode === 'life') {
      if (logoTitle) logoTitle.textContent = 'Your LifeAI Identity';
      if (logoSub) logoSub.textContent = 'Upload a logo and choose your accent colors';
    } else {
      if (logoTitle) logoTitle.textContent = 'Brand Identity';
      if (logoSub) logoSub.textContent = 'Upload your logo and choose your brand colors';
    }
  }

  // v12.2.7: Render sync preferences grid
  if (step === 'sync' && typeof renderOnboardingSyncPrefs === 'function') {
    setTimeout(function() { renderOnboardingSyncPrefs(); }, 50);
  }

  // v13.0: Render brand color presets on step 7
  if (step === 7) {
    setTimeout(function() {
      var presetsEl = document.getElementById('wizardBrandColorPresets');
      if (presetsEl) {
        var presets = ['#a89878', '#b8986a', '#6ab894', '#6a8eb8', '#b86a9e', '#b8a86a', '#e06666', '#8e7cc3', '#76a5af', '#f6b26b'];
        var html = '';
        for (var p = 0; p < presets.length; p++) {
          html += '<div onclick="var c=\'' + presets[p] + '\';var el=document.getElementById(\'wizardBrandColor\');if(el)el.value=c;this.parentElement.querySelectorAll(\'div\').forEach(function(d){d.style.borderColor=\'transparent\'});this.style.borderColor=\'var(--text-primary)\'" style="width: 28px; height: 28px; border-radius: 50%; background: ' + presets[p] + '; cursor: pointer; border: 2px solid ' + (presets[p] === '#a89878' ? 'var(--text-primary)' : 'transparent') + '; transition: border-color 0.15s;"></div>';
        }
        presetsEl.innerHTML = html;
      }
    }, 100);
  }

  // v10.5.25: Render LifeAI accent color picker on life5 step
  if (step === 'life5' && typeof renderLifeAccentPicker === 'function') {
    setTimeout(function() {
      renderLifeAccentPicker('onboardingLifeAccentPicker');
    }, 100);
  }
  
  // v15.25: Update step 3 back button based on mode (brand goes back to ownership)
  if (step === 3) {
    var step3BackBtn = document.querySelector('#onboardingStep3 .onboarding-btn-secondary');
    if (step3BackBtn && selectedOnboardingMode === 'brand') {
      step3BackBtn.setAttribute('onclick', "goToOnboardingStep('ownership')");
    } else if (step3BackBtn) {
      step3BackBtn.setAttribute('onclick', "goToOnboardingStep('name')");
    }
    // v15.25: Restore step 4 original HTML if model picker replaced it
    var step4El = document.getElementById('onboardingStep4');
    if (step4El && window._onboardingStep4OriginalHTML) {
      step4El.innerHTML = window._onboardingStep4OriginalHTML;
    }
  }

  // v15.25: Save step 4 original HTML before model picker can replace it
  if (step === 4) {
    var step4ForSave = document.getElementById('onboardingStep4');
    if (step4ForSave && !window._onboardingStep4OriginalHTML) {
      window._onboardingStep4OriginalHTML = step4ForSave.innerHTML;
    }
    // v22.2: Load API key marketplace in onboarding
    if (typeof loadOnboardingMarketplace === 'function') loadOnboardingMarketplace();
  }

  // v15.25: Initialize color mode tabs to match current theme when showing logo step
  if (step === 'logo') {
    // Save original accent so we can restore on cancel
    if (!window._onboardingOriginalAccent) {
      window._onboardingOriginalAccent = getAccentFallback();
    }
    var isLight = document.documentElement.classList.contains('light-mode');
    window._onboardingColorMode = isLight ? 'light' : 'dark';
    var onbDarkTab = document.getElementById('onbColorTabDark');
    var onbLightTab = document.getElementById('onbColorTabLight');
    if (onbDarkTab) onbDarkTab.classList.toggle('active', !isLight);
    if (onbLightTab) onbLightTab.classList.toggle('active', isLight);
    // Render color presets if not already rendered
    if (typeof renderOnboardingColorPresets === 'function') {
      setTimeout(function() { renderOnboardingColorPresets(); }, 50);
    }
  }

  // Show target step with flex display
  var targetStep = document.getElementById(targetStepId);
  if (targetStep) {
    targetStep.classList.remove('hidden');
    targetStep.style.display = 'flex';
    targetStep.style.flexDirection = 'column';
    targetStep.style.visibility = 'visible';
    targetStep.style.opacity = '1';
    console.log('✓ Step', step, 'shown (id:', targetStepId, ')');
  } else {
    console.error('✗ Step', step, 'not found! (id:', targetStepId, ')');
  }
}

// v28.4: PWA Install Step - platform detection and accordion
function detectPWAPlatform() {
  var ua = navigator.userAgent || '';
  var platform = navigator.platform || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Win/.test(platform)) return 'windows';
  if (/Mac/.test(platform)) return 'mac';
  return 'mac'; // default fallback
}

function initPWAInstallStep() {
  var detected = detectPWAPlatform();
  var sections = document.querySelectorAll('#pwaInstallAccordion .pwa-install-section');
  for (var i = 0; i < sections.length; i++) {
    var section = sections[i];
    var plat = section.getAttribute('data-platform');
    if (plat === detected) {
      // Expand detected platform
      var body = section.querySelector('.pwa-install-body');
      var toggle = section.querySelector('.pwa-install-toggle');
      var chevron = section.querySelector('.pwa-chevron');
      if (body) body.style.display = 'block';
      if (toggle) {
        toggle.style.borderRadius = '10px 10px 0 0';
        toggle.style.borderColor = 'rgba(168,152,120,0.3)';
        toggle.style.background = 'rgba(168,152,120,0.08)';
      }
      if (chevron) chevron.style.transform = 'rotate(180deg)';
      // Add "Your device" badge
      var label = section.querySelector('span[style*="font-weight:600"]');
      if (label && label.textContent.indexOf('Your device') === -1) {
        label.innerHTML = label.textContent + ' <span style="font-size:10px;font-weight:500;color:#c9a86c;background:rgba(168,152,120,0.12);padding:2px 8px;border-radius:4px;margin-left:6px;">Your device</span>';
      }
    }
  }
}

function togglePWASection(btn) {
  var section = btn.closest('.pwa-install-section');
  if (!section) return;
  var body = section.querySelector('.pwa-install-body');
  var chevron = section.querySelector('.pwa-chevron');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  if (isOpen) {
    body.style.display = 'none';
    btn.style.borderRadius = '10px';
    btn.style.borderColor = 'var(--border-color)';
    btn.style.background = 'var(--bg-secondary)';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  } else {
    body.style.display = 'block';
    btn.style.borderRadius = '10px 10px 0 0';
    btn.style.borderColor = 'rgba(168,152,120,0.3)';
    btn.style.background = 'rgba(168,152,120,0.08)';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}

// v10.5.25: Mode Selection Functions (Phase 2)
var selectedOnboardingMode = null;

function selectOnboardingMode(mode) {
  console.log('[Onboarding] Mode selected:', mode);
  selectedOnboardingMode = mode;
  
  // Update card selection UI
  var brandCard = document.getElementById('modeCardBrand');
  var lifeCard = document.getElementById('modeCardLife');
  var continueBtn = document.getElementById('modeSelectionContinue');
  
  if (brandCard) brandCard.classList.remove('selected');
  if (lifeCard) lifeCard.classList.remove('selected');
  
  if (mode === 'brand' && brandCard) {
    brandCard.classList.add('selected');
  } else if (mode === 'life' && lifeCard) {
    lifeCard.classList.add('selected');
  }
  
  // Enable continue button
  if (continueBtn) {
    continueBtn.disabled = false;
    continueBtn.style.opacity = '1';
  }
}

function proceedFromModeSelection() {
  if (!selectedOnboardingMode) {
    console.warn('[Onboarding] No mode selected');
    return;
  }
  
  console.log('[Onboarding] Proceeding with mode:', selectedOnboardingMode);
  
  // Store the selected mode
  localStorage.setItem('roweos_onboarding_mode', selectedOnboardingMode);
  
  // Set the app mode
  if (typeof setAppMode === 'function') {
    setAppMode(selectedOnboardingMode);
  } else {
    window.currentAppMode = selectedOnboardingMode;
    localStorage.setItem('roweos_app_mode', selectedOnboardingMode);
  }
  
  // v15.26: Life mode uses shared onboarding flow (no longer branches to separate modal)
  if (selectedOnboardingMode === 'life') {
    console.log('[Onboarding] Life mode — creating profile, staying in shared flow');

    // Create new life profile
    var newProfile = {
      id: 'life_' + Date.now(),
      name: '',
      createdAt: new Date().toISOString(),
      lifeAreas: [],
      goals: [],
      identityData: {},
      preferences: {},
      onboardingComplete: false,
      onboardingDismissed: false
    };

    var profiles = getLifeProfiles();
    profiles.push(newProfile);
    saveLifeProfiles(profiles);
    setCurrentLifeProfileIndex(profiles.length - 1);

    localStorage.setItem('roweos_app_mode', 'life');
    localStorage.setItem('roweos_mode', 'life');
  }

  // Both modes: go to shared name step
  goToOnboardingStep('name');
}

// v10.5.25: Shared Onboarding Functions (used by both Brand & Life modes)
var sharedUserName = '';
var sharedBrandName = '';
var sharedSelectedProvider = null;

function proceedFromSharedName() {
  var nameInput = document.getElementById('sharedUserName');
  var brandInput = document.getElementById('sharedBrandName');
  
  if (!nameInput || !nameInput.value.trim()) {
    if (nameInput) {
      nameInput.style.borderColor = '#ef4444';
      nameInput.focus();
      setTimeout(function() { nameInput.style.borderColor = ''; }, 2000);
    }
    return;
  }
  
  sharedUserName = nameInput.value.trim();
  localStorage.setItem('roweos_user_name', sharedUserName);
  console.log('[Onboarding] User name set:', sharedUserName);
  
  // For brand mode, also require brand name
  if (selectedOnboardingMode === 'brand') {
    if (!brandInput || !brandInput.value.trim()) {
      if (brandInput) {
        brandInput.style.borderColor = '#ef4444';
        brandInput.focus();
        setTimeout(function() { brandInput.style.borderColor = ''; }, 2000);
      }
      return;
    }
    sharedBrandName = brandInput.value.trim();
    localStorage.setItem('roweos_brand_name', sharedBrandName);
    window.onboardingBrandName = sharedBrandName;
    console.log('[Onboarding] Brand name set:', sharedBrandName);
  }
  
  // v15.25: Brand mode goes to ownership step first, life mode skips to provider
  if (selectedOnboardingMode === 'brand') {
    // Populate the brand name in the ownership step header
    var ownershipNameEl = document.getElementById('ownershipBrandNameDisplay');
    if (ownershipNameEl) ownershipNameEl.textContent = sharedBrandName;
    goToOnboardingStep('ownership');
  } else {
    // v15.26: Life mode skips ownership, goes straight to provider/API setup
    goToOnboardingStep('provider');
  }
}

function selectSharedProvider(provider, event) {
  if (event) event.stopPropagation();
  
  sharedSelectedProvider = provider;
  console.log('[Onboarding] Provider selected:', provider);
  
  // Update UI - highlight selected card
  var cards = document.querySelectorAll('#onboardingStepProvider .onboarding-model-card');
  cards.forEach(function(card) {
    card.classList.remove('selected');
  });
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('selected');
  }
  
  // Enable continue button
  var continueBtn = document.getElementById('sharedProviderContinue');
  if (continueBtn) {
    continueBtn.disabled = false;
    continueBtn.style.opacity = '1';
  }
}

function proceedFromSharedProvider() {
  if (!sharedSelectedProvider) {
    console.warn('[Onboarding] No provider selected');
    return;
  }
  
  console.log('[Onboarding] Proceeding with provider:', sharedSelectedProvider);
  localStorage.setItem('selectedProvider', sharedSelectedProvider);
  
  // v15.26: Both modes go to shared logo/color step after provider
  goToOnboardingStep('logo');
}

// Update name step UI based on mode when showing
function updateSharedNameStepUI() {
  var titleEl = document.getElementById('sharedNameTitle');
  var subtitleEl = document.getElementById('sharedNameSubtitle');
  var brandWrapper = document.getElementById('brandNameFieldWrapper');
  
  if (selectedOnboardingMode === 'brand') {
    if (titleEl) titleEl.textContent = "Let's get started";
    if (subtitleEl) subtitleEl.textContent = "Tell us about yourself and your brand";
    if (brandWrapper) brandWrapper.style.display = 'block';
  } else {
    if (titleEl) titleEl.textContent = "What should we call you?";
    if (subtitleEl) subtitleEl.textContent = "This is how LifeAI will address you";
    if (brandWrapper) brandWrapper.style.display = 'none';
  }
}

// v10.5.25: Update Step 5 based on mode when shown
function updateStep5ForMode() {
  var isLife = selectedOnboardingMode === 'life';
  
  var subtitle = document.getElementById('step5Subtitle');
  var nextTitle = document.getElementById('step5NextTitle');
  var nextDesc = document.getElementById('step5NextDesc');
  var thenTitle = document.getElementById('step5ThenTitle');
  var thenDesc = document.getElementById('step5ThenDesc');
  var continueBtn = document.getElementById('step5ContinueBtn');
  
  if (isLife) {
    // v12.2.7: Updated to mention logo, cloud sync, and sync preferences
    if (subtitle) subtitle.textContent = "Now let's personalize your experience";
    if (nextTitle) nextTitle.textContent = "Next: Logo, Cloud Sync & Preferences";
    if (nextDesc) nextDesc.textContent = "Upload a logo, connect Firebase, choose storage settings";
    if (thenTitle) thenTitle.textContent = "Then: Set Up LifeAI";
    if (thenDesc) thenDesc.textContent = "Life areas, goals, and personalization";
    if (continueBtn) continueBtn.textContent = "Continue Setup →";
  } else {
    // v12.2.7: Updated to mention logo, cloud sync, and sync preferences
    if (subtitle) subtitle.textContent = "Now let's finish setting up your workspace";
    if (nextTitle) nextTitle.textContent = "Next: Logo, Cloud Sync & Preferences";
    if (nextDesc) nextDesc.textContent = "Upload a logo, connect Firebase, choose storage settings";
    if (thenTitle) thenTitle.textContent = "Then: Build Your BrandAI";
    if (thenDesc) thenDesc.textContent = "Import from website, upload docs, or create manually";
    if (continueBtn) continueBtn.textContent = "Continue Setup →";
  }
}

// v10.5.25: Handle Step 5 continue button based on mode
function proceedFromStep5() {
  // v12.2.7: Route to new logo/firebase/sync steps before brand/life setup
  goToOnboardingStep('logo');
}

// v12.2.7: Onboarding Logo Upload
function handleOnboardingLogoUpload(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;

  if (!file.type.match(/^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/)) {
    showToast('Please upload a PNG, JPG, WebP, GIF, or SVG image', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image must be under 2MB', 'error');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    var base64Logo = e.target.result;
    window._onboardingLogo = base64Logo;

    var preview = document.getElementById('onboardingLogoPreview');
    if (preview) {
      var img = document.createElement('img');
      img.src = base64Logo;
      img.alt = 'Logo';
      img.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
      preview.innerHTML = '';
      preview.appendChild(img);
      preview.style.borderStyle = 'solid';
      preview.style.borderColor = 'var(--accent)';
    }
    showToast('Logo selected', 'success');
  };
  reader.onerror = function() {
    showToast('Error reading file', 'error');
  };
  reader.readAsDataURL(file);
}

function proceedFromOnboardingLogo() {
  // v15.1: Save both dark and light mode colors from onboarding
  var darkColorInput = document.getElementById('onboardingBrandColorDark');
  var lightColorInput = document.getElementById('onboardingBrandColorLight');
  var mainColorInput = document.getElementById('onboardingBrandColor');
  var hiddenColor = document.getElementById('wizardBrandColor');

  // Store the current tab's value into the hidden input
  var darkColor = darkColorInput ? darkColorInput.value : '#a89878';
  var lightColor = lightColorInput ? lightColorInput.value : '#a89878';

  // Save current editing tab value
  if (window._onboardingColorMode === 'light') {
    lightColor = mainColorInput ? mainColorInput.value : lightColor;
    if (lightColorInput) lightColorInput.value = lightColor;
  } else {
    darkColor = mainColorInput ? mainColorInput.value : darkColor;
    if (darkColorInput) darkColorInput.value = darkColor;
  }

  if (hiddenColor) hiddenColor.value = darkColor;
  window._onboardingBrandColor = darkColor;
  window._onboardingBrandColorLight = lightColor;
  // v24.26: Go to BLAKE step after logo/color so blob uses selected accent
  goToOnboardingStep('blobPref');
}

// v15.1: Onboarding color mode state
window._onboardingColorMode = 'dark';

// v15.1: Switch between dark/light color editing in onboarding
function switchOnboardingColorMode(mode) {
  var mainInput = document.getElementById('onboardingBrandColor');
  var darkInput = document.getElementById('onboardingBrandColorDark');
  var lightInput = document.getElementById('onboardingBrandColorLight');
  var darkTab = document.getElementById('onbColorTabDark');
  var lightTab = document.getElementById('onbColorTabLight');

  // Save current value to the active mode's hidden input
  if (window._onboardingColorMode === 'dark' && darkInput && mainInput) {
    darkInput.value = mainInput.value;
  } else if (window._onboardingColorMode === 'light' && lightInput && mainInput) {
    lightInput.value = mainInput.value;
  }

  window._onboardingColorMode = mode;

  // v15.25: Auto-switch theme to match the mode being edited
  if (mode === 'light' && !document.documentElement.classList.contains('light-mode')) {
    toggleTheme();
  } else if (mode === 'dark' && document.documentElement.classList.contains('light-mode')) {
    toggleTheme();
  }

  // Load the target mode's value into the main picker
  if (mode === 'light' && lightInput && mainInput) {
    mainInput.value = lightInput.value;
  } else if (mode === 'dark' && darkInput && mainInput) {
    mainInput.value = darkInput.value;
  }

  // Update tabs
  if (darkTab) darkTab.classList.toggle('active', mode === 'dark');
  if (lightTab) lightTab.classList.toggle('active', mode === 'light');

  // Update preview
  updateOnboardingColorPreview();
}

// v15.1: Update onboarding color preview
function updateOnboardingColorPreview() {
  var mainInput = document.getElementById('onboardingBrandColor');
  var color = mainInput ? mainInput.value : '#a89878';
  var rgb = typeof hexToRgb === 'function' ? hexToRgb(color) : null;
  var textColor = '#ffffff';
  if (rgb) {
    var lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    textColor = lum > 0.5 ? '#1a1a1a' : '#ffffff';
  }
  var previewBtn = document.getElementById('onbColorPreviewBtn');
  var previewText = document.getElementById('onbColorPreviewText');
  var previewIcon = document.getElementById('onbColorPreviewIcon');
  // v24.26: Gradient preview instead of solid color
  if (previewBtn) {
    var darkerColor = typeof darkenColor === 'function' ? darkenColor(color, 15) : color;
    previewBtn.style.background = 'linear-gradient(135deg, ' + color + ', ' + darkerColor + ')';
    previewBtn.style.color = textColor;
  }
  if (previewText) previewText.style.color = color;
  if (previewIcon) previewIcon.style.color = color;
  // v15.25: Apply accent color live to onboarding UI — set CSS vars directly (bypasses brand mode guard)
  var root = document.documentElement;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-hover', typeof lightenColor === 'function' ? lightenColor(color, 10) : color);
  root.style.setProperty('--accent-gold', color);
  root.style.setProperty('--gold', color);
  root.style.setProperty('--brand-accent', color);
  if (rgb) {
    root.style.setProperty('--brand-accent-rgb', rgb.r + ', ' + rgb.g + ', ' + rgb.b);
    root.style.setProperty('--accent-glow', 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0.12)');
  }
}

// v15.1: Render color presets for Brand Identity onboarding step
function renderOnboardingColorPresets() {
  var container = document.getElementById('onboardingColorPresets');
  if (!container) return;
  var presets = ['#a89878', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4'];
  var html = '';
  presets.forEach(function(color) {
    html += '<div onclick="selectOnboardingColorPreset(\'' + color + '\')" style="width:28px;height:28px;border-radius:50%;background:' + color + ';cursor:pointer;border:2px solid transparent;transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'var(--text-primary)\'" onmouseout="this.style.borderColor=\'transparent\'"></div>';
  });
  container.innerHTML = html;

  // Listen for manual color picker changes
  var mainInput = document.getElementById('onboardingBrandColor');
  if (mainInput) {
    mainInput.addEventListener('input', function() { updateOnboardingColorPreview(); });
  }
}

// v15.1: Select a preset in onboarding color picker
function selectOnboardingColorPreset(color) {
  var mainInput = document.getElementById('onboardingBrandColor');
  if (mainInput) mainInput.value = color;
  updateOnboardingColorPreview();
}

// v12.2.7: Onboarding Firebase Connect
function connectOnboardingFirebase() {
  var configInput = document.getElementById('onboardingFirebaseInput');
  var statusEl = document.getElementById('onboardingFirebaseStatus');

  if (!configInput || !configInput.value.trim()) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
      statusEl.style.color = '#ef4444';
      statusEl.textContent = 'Please paste your Firebase config';
    }
    return;
  }

  // v12.2.7: Copy config to main Firebase input and reuse connectFirebase()
  var mainInput = document.getElementById('firebaseConfigInput');
  if (mainInput) {
    mainInput.value = configInput.value;
  }

  // Set flag to prevent completeFirebaseLogin from hiding onboarding
  window._onboardingInProgress = true;

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(168, 152, 120, 0.1)';
    statusEl.style.color = 'var(--accent)';
    statusEl.textContent = 'Connecting to Firebase...';
  }

  try {
    connectFirebase().then(function() {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(74, 222, 128, 0.1)';
        statusEl.style.color = '#4ade80';
        statusEl.textContent = 'Firebase connected successfully!';
      }
    }).catch(function(err) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
        statusEl.style.color = '#ef4444';
        statusEl.textContent = 'Error: ' + (err.message || 'Connection failed');
      }
    });
  } catch (err) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
      statusEl.style.color = '#ef4444';
      statusEl.textContent = 'Error: ' + (err.message || 'Connection failed');
    }
  }
}

function proceedFromOnboardingFirebase() {
  // v22.33: After Firebase setup, go to email setup
  goToOnboardingStep('email');
}

// v14.0: Get current profile key for per-brand sync preferences
function getSyncProfileKey() {
  var mode = localStorage.getItem('roweos_app_mode') || 'brand';
  if (mode === 'life') return 'life';
  var brandName = 'default';
  if (brands && brands.length > 0 && brands[selectedBrand]) {
    brandName = (brands[selectedBrand].shortName || brands[selectedBrand].name || 'default').replace(/\s+/g, '_').toLowerCase();
  }
  return 'brand_' + brandName;
}

// v14.0: Migrate flat sync categories to per-profile structure
function migrateSyncCategories() {
  try {
    var raw = localStorage.getItem('roweos_sync_categories');
    if (!raw) return;
    var data = JSON.parse(raw);
    // If already migrated (has _migrated flag or profile keys), skip
    if (data._migrated || data._profiles) return;
    // Flat structure detected - migrate to per-profile
    var profiles = {};
    var profileKey = getSyncProfileKey();
    profiles[profileKey] = data;
    profiles._migrated = true;
    localStorage.setItem('roweos_sync_categories', JSON.stringify(profiles));
  } catch (e) {}
}

// v14.0: Get sync categories for current profile
function getSyncCategoriesForProfile() {
  migrateSyncCategories();
  var profileKey = getSyncProfileKey();
  try {
    var all = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}');
    return all[profileKey] || {};
  } catch (e) {
    return {};
  }
}

// v14.0: Save sync categories for current profile
function saveSyncCategoriesForProfile(cats) {
  migrateSyncCategories();
  var profileKey = getSyncProfileKey();
  try {
    var all = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}');
    all[profileKey] = cats;
    all._migrated = true;
    localStorage.setItem('roweos_sync_categories', JSON.stringify(all));
  } catch (e) {}
}

// v12.2.7: Onboarding Sync Preferences
function renderOnboardingSyncPrefs() {
  var container = document.getElementById('onboardingSyncGrid');
  if (!container) return;

  // v14.2: Show current profile name in header using proper brand name
  var syncHeader = document.querySelector('#onboardingStepSync .onboarding-subtitle');
  if (syncHeader) {
    var profileLabel = 'your brand';
    var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
    if (currentMode === 'life') {
      profileLabel = 'LifeAI';
    } else if (window.onboardingBrandName) {
      profileLabel = window.onboardingBrandName;
    } else if (brands && brands.length > 0 && brands[selectedBrand]) {
      profileLabel = brands[selectedBrand].shortName || brands[selectedBrand].name || 'your brand';
    }
    syncHeader.textContent = 'Choose what stays local and what syncs to the cloud for ' + profileLabel;
  }

  var syncCats = getSyncCategoriesForProfile();

  var categories = [
    { key: 'brandai_chats', name: 'BrandAI Chats', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' },
    { key: 'lifeai_chats', name: 'LifeAI Chats', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' },
    { key: 'library', name: 'Library Files', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' },
    { key: 'brand_todos', name: 'BrandAI To-Dos', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>' },
    { key: 'life_todos', name: 'LifeAI To-Dos', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>' },
    { key: 'calendar', name: 'Calendar Events', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' },
    { key: 'logos', name: 'Brand Logos', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>' },
    { key: 'goals', name: 'Pulse Goals', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>' },
    { key: 'knowledge', name: 'Brand Knowledge', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>' },
    { key: 'journal', name: 'Journal Entries', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>' },
    { key: 'inventory', name: 'Inventory Images', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>' }
  ];

  // v15.27: Removed inline "Keep Everything Local" button — now in HTML as dual-button layout
  var html = '';

  categories.forEach(function(cat) {
    var isCloud = syncCats[cat.key] !== 'local';
    html += '<div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md);">';
    html += '<div style="display: flex; align-items: center; gap: 12px;">';
    html += '<span style="color: var(--text-tertiary);">' + cat.icon + '</span>';
    html += '<span style="font-weight: 500; font-size: var(--text-sm);">' + cat.name + '</span>';
    html += '</div>';
    html += '<button onclick="toggleOnboardingSyncPref(\'' + cat.key + '\')" style="display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 16px; border: 1px solid var(--border-color); background: ' + (isCloud ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)') + '; cursor: pointer; font-size: 12px; color: ' + (isCloud ? '#3b82f6' : 'var(--text-muted)') + ';">';
    if (isCloud) {
      html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg> Cloud';
    } else {
      html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg> Local';
    }
    html += '</button>';
    html += '</div>';
  });

  container.innerHTML = html;
}

function toggleOnboardingSyncPref(categoryKey) {
  // v14.0: Per-profile sync preferences
  var syncCats = getSyncCategoriesForProfile();
  syncCats[categoryKey] = syncCats[categoryKey] === 'local' ? 'cloud' : 'local';
  saveSyncCategoriesForProfile(syncCats);
  renderOnboardingSyncPrefs();
}

// v14.2: Set all sync categories to local
function setAllSyncLocal() {
  var syncCats = getSyncCategoriesForProfile();
  var catKeys = ['brandai_chats', 'lifeai_chats', 'library', 'brand_todos', 'life_todos', 'calendar', 'logos', 'goals', 'knowledge', 'journal', 'inventory'];
  catKeys.forEach(function(key) { syncCats[key] = 'local'; });
  saveSyncCategoriesForProfile(syncCats);
  // v15.27: Reset visual state - hide cloud grid, show local info
  var cloudOptIn = document.getElementById('syncCloudOptIn');
  var localScreen = document.getElementById('syncLocalFirstScreen');
  if (cloudOptIn) cloudOptIn.style.display = 'none';
  if (localScreen) localScreen.style.display = 'block';
  // v15.27: Highlight local button, reset cloud button
  var localBtn = document.getElementById('syncLocalBtn');
  var cloudBtn = document.getElementById('syncCloudBtn');
  if (localBtn) {
    var accentColor = getAccentFallback();
    localBtn.style.borderColor = accentColor;
    localBtn.style.background = accentColor + '10';
    localBtn.dataset.selected = 'true';
  }
  if (cloudBtn) {
    cloudBtn.style.borderColor = 'var(--border-color)';
    cloudBtn.style.background = 'var(--bg-secondary)';
    delete cloudBtn.dataset.selected;
  }
  renderOnboardingSyncPrefs();
  showToast('All data set to stay on your device', 'success');
}

// v15.27: Set all sync categories to cloud
function setAllSyncCloud() {
  var syncCats = getSyncCategoriesForProfile();
  var catKeys = ['brandai_chats', 'lifeai_chats', 'library', 'brand_todos', 'life_todos', 'calendar', 'logos', 'goals', 'knowledge', 'journal', 'inventory'];
  catKeys.forEach(function(key) { syncCats[key] = 'cloud'; });
  saveSyncCategoriesForProfile(syncCats);
  // Show cloud opt-in category grid, hide local info
  var cloudOptIn = document.getElementById('syncCloudOptIn');
  var localScreen = document.getElementById('syncLocalFirstScreen');
  if (cloudOptIn) cloudOptIn.style.display = 'block';
  if (localScreen) localScreen.style.display = 'none';
  // v15.27: Highlight cloud button, reset local button
  var localBtn = document.getElementById('syncLocalBtn');
  var cloudBtn = document.getElementById('syncCloudBtn');
  if (cloudBtn) {
    cloudBtn.style.borderColor = '#3b82f6';
    cloudBtn.style.background = 'rgba(59, 130, 246, 0.06)';
    cloudBtn.dataset.selected = 'true';
  }
  if (localBtn) {
    localBtn.style.borderColor = 'var(--border-color)';
    localBtn.style.background = 'var(--bg-secondary)';
    delete localBtn.dataset.selected;
  }
  renderOnboardingSyncPrefs();
  showToast('All data set to sync to cloud', 'success');
}

// v23.0: Select onboarding sync mode card
var _onboardingSyncMode = null;
function selectOnboardingSyncMode(mode) {
  _onboardingSyncMode = mode;
  // Highlight selected card
  var cards = { perfect_cloud: 'onbSyncPerfectCloud', perfect_local: 'onbSyncPerfectLocal', advanced: 'onbSyncAdvanced' };
  var colors = { perfect_cloud: '#3b82f6', perfect_local: 'var(--accent, #a89878)', advanced: 'var(--text-secondary)' };
  for (var k in cards) {
    var el = document.getElementById(cards[k]);
    if (!el) continue;
    if (k === mode) {
      el.style.borderColor = colors[k];
      el.style.background = (k === 'perfect_cloud') ? 'rgba(59,130,246,0.06)' : 'rgba(168,152,120,0.06)';
    } else {
      el.style.borderColor = 'var(--border-color)';
      el.style.background = 'var(--bg-secondary)';
    }
  }
  // Show matching info panel
  var panels = ['onbSyncInfoDefault', 'onbSyncInfoCloud', 'onbSyncInfoLocal', 'onbSyncInfoAdvanced'];
  var showId = mode === 'perfect_cloud' ? 'onbSyncInfoCloud' : mode === 'perfect_local' ? 'onbSyncInfoLocal' : 'onbSyncInfoAdvanced';
  panels.forEach(function(pid) {
    var p = document.getElementById(pid);
    if (p) p.style.display = (pid === showId) ? 'block' : 'none';
  });
  // Render advanced grid if needed
  if (mode === 'advanced' && typeof renderOnboardingSyncPrefs === 'function') {
    renderOnboardingSyncPrefs();
  }
  // Enable continue button
  var btn = document.getElementById('onbSyncContinueBtn');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

function proceedFromOnboardingSync() {
  // v23.0: Three-mode onboarding
  if (_onboardingSyncMode === 'perfect_cloud') {
    // Set sync mode and go to Firebase setup
    try {
      var ss = JSON.parse(localStorage.getItem('roweos_sync_settings') || '{}');
      ss.syncMode = 'perfect_cloud';
      localStorage.setItem('roweos_sync_settings', JSON.stringify(ss));
    } catch(e) {}
    setAllSyncCloud();
    goToOnboardingStep('email'); // v24.25: Skip Firebase step — auto-syncs via login
  } else if (_onboardingSyncMode === 'perfect_local') {
    // Set sync mode, skip Firebase
    try {
      var ss2 = JSON.parse(localStorage.getItem('roweos_sync_settings') || '{}');
      ss2.syncMode = 'perfect_local';
      localStorage.setItem('roweos_sync_settings', JSON.stringify(ss2));
    } catch(e) {}
    setAllSyncLocal();
    goToOnboardingStep('email');
  } else if (_onboardingSyncMode === 'advanced') {
    // Hybrid mode, go to Firebase setup for cloud categories
    try {
      var ss3 = JSON.parse(localStorage.getItem('roweos_sync_settings') || '{}');
      ss3.syncMode = 'hybrid';
      localStorage.setItem('roweos_sync_settings', JSON.stringify(ss3));
    } catch(e) {}
    goToOnboardingStep('email'); // v24.25: Skip Firebase step — auto-syncs via login
  } else {
    // Fallback: no mode selected
    showToast('Please select a sync mode to continue', 'info');
  }
}

// v16.12: Calendar onboarding step functions
function proceedFromOnboardingCalendar() {
  // v18.4: Go to social step instead of directly to brand/life steps
  // v20.2: Fix — was passing full ID 'onboardingStepSocial', needs just 'social'
  goToOnboardingStep('social');
}

// v18.4: Proceed from social media onboarding step
function proceedFromOnboardingSocial() {
  // v24.26: Route to automations step before UI prefs
  goToOnboardingStep('automations');
}

// v24.26: Automations onboarding step — enable cloud scheduler if toggled
function proceedFromOnboardingAutomations() {
  // v24.26: Read the custom toggle div state
  var toggle = document.getElementById('onbCloudToggle');
  var isOn = toggle && toggle.dataset.on === 'true';
  if (isOn) {
    // v26.5: Defer scheduler enable to after onboarding completes (prevents brand color reset during setup)
    try { localStorage.setItem('roweos_cloud_scheduler_pending', 'true'); } catch(e) {}
  }
  goToOnboardingStep('workspaceStyle');
}

// v22.33: Email setup onboarding step
function proceedFromOnboardingEmail() {
  // Save default from address if entered
  var fromInput = document.getElementById('onboardingDefaultFromEmail');
  if (fromInput && fromInput.value.trim()) {
    var config = getMailConfig();
    config.defaultFromAddress = fromInput.value.trim();
    // Also add to custom from addresses if not already there
    if (!config.customFromAddresses) config.customFromAddresses = [];
    if (config.customFromAddresses.indexOf(fromInput.value.trim()) === -1) {
      config.customFromAddresses.push(fromInput.value.trim());
    }
    saveMailConfig(config);
  }
  goToOnboardingStep('calendar');
}

// v20.20: Sidebar preference selection (desktop)
function selectSidebarPref(value) {
  var ids = { auto: 'sidebarPrefAuto', open: 'sidebarPrefOpen', collapsed: 'sidebarPrefCollapsed' };
  for (var key in ids) {
    var el = document.getElementById(ids[key]);
    if (el) {
      if (key === value) {
        el.style.borderColor = 'var(--accent, #a89878)';
        el.style.background = 'rgba(168,152,120,0.08)';
      } else {
        el.style.borderColor = 'var(--border-color)';
        el.style.background = 'var(--bg-secondary)';
      }
    }
  }
  // v24.25: Map string values to numeric for changeSidebarBehavior
  var sidebarMap = { auto: '0', open: '1', collapsed: '2' };
  var numVal = sidebarMap[value] || '0';
  if (typeof changeSidebarBehavior === 'function') changeSidebarBehavior(numVal);
}

function proceedFromSidebarPref() {
  // v24.26: BLAKE moved earlier in flow; sidebarPref now goes to pushSetup
  goToOnboardingStep('pushSetup');
}

// v26.3: Workspace style selection (onboarding + settings)
var _selectedWorkspaceStyle = 'grouped';

function selectWorkspaceStyle(el, style) {
  _selectedWorkspaceStyle = style;
  var cards = document.querySelectorAll('.workspace-style-card');
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.remove('selected');
  }
  el.classList.add('selected');
}

function applyWorkspaceStyle() {
  setSidebarMode(_selectedWorkspaceStyle);
  if (_selectedWorkspaceStyle === 'customized') {
    initCustomSidebar();
  }
}

function proceedFromWorkspaceStyle() {
  applyWorkspaceStyle();
  goToOnboardingStep('sidebarPref');
}

// v26.3: Render workspace style picker in Settings > Preferences
function renderWorkspaceStylePicker() {
  var container = document.getElementById('workspaceStylePickerSettings');
  if (!container) return;
  var currentMode = _sidebarMode || 'grouped';
  var styles = [
    { id: 'grouped', title: 'Simplified', desc: 'Clean, grouped navigation. Best for a focused experience.', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>' },
    { id: 'expanded', title: 'Advanced', desc: 'All features visible. Best for power users.', icon: '<line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/>' },
    { id: 'customized', title: 'Customized', desc: 'Full control. Rename, reorder, and organize everything your way.', icon: '<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>' }
  ];
  var html = '<div class="workspace-style-cards">';
  for (var i = 0; i < styles.length; i++) {
    var s = styles[i];
    var sel = (s.id === currentMode) ? ' selected' : '';
    html += '<div class="workspace-style-card' + sel + '" data-style="' + s.id + '" onclick="applySettingsWorkspaceStyle(this, \'' + s.id + '\')">';
    html += '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">' + s.icon + '</svg>';
    html += '<div class="workspace-style-card-title">' + s.title + '</div>';
    html += '<div class="workspace-style-card-desc">' + s.desc + '</div>';
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function applySettingsWorkspaceStyle(el, style) {
  var cards = el.parentNode.querySelectorAll('.workspace-style-card');
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.remove('selected');
  }
  el.classList.add('selected');
  setSidebarMode(style);
  if (style === 'customized') {
    initCustomSidebar();
  }
  // Update the old select if it still exists
  var modeSelect = document.getElementById('sidebarModeSelect');
  if (modeSelect) modeSelect.value = style;
  // Update settings sidebar layout if present
  if (typeof renderSettingsSidebarLayout === 'function') renderSettingsSidebarLayout();
}

// v20.20: Mobile nav preference selection
function selectMobileNavPref(value) {
  var ids = { sidebar: 'mobileNavPrefSidebar', bottom: 'mobileNavPrefBottom', both: 'mobileNavPrefBoth' };
  for (var key in ids) {
    var el = document.getElementById(ids[key]);
    if (el) {
      if (key === value) {
        el.style.borderColor = 'var(--accent, #a89878)';
        el.style.background = 'rgba(168,152,120,0.08)';
      } else {
        el.style.borderColor = 'var(--border-color)';
        el.style.background = 'var(--bg-secondary)';
      }
    }
  }
  try { localStorage.setItem('roweos_mobile_nav_pref', value); } catch(e) {}
}

function proceedFromMobileNavPref() {
  // v24.26: BLAKE moved earlier in flow; mobileNavPref now goes to pushSetup
  goToOnboardingStep('pushSetup');
}

// v20.20: Push notifications onboarding
function enableOnboardingPush() {
  if (typeof subscribeToPush === 'function') {
    subscribeToPush(true);
  }
  showToast('Notifications enabled', 'success');
  proceedFromPushSetup();
}

function proceedFromPushSetup() {
  goToOnboardingStep('crossDevice');
}

// v20.20: Dock step — populate device-specific instructions
function populateDockInstructions() {
  var container = document.getElementById('dockInstructionsContainer');
  var title = document.getElementById('dockStepTitle');
  if (!container) return;

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
  var isWindows = /Windows/i.test(ua);

  var html = '';
  if (isIOS) {
    if (title) title.textContent = 'Add RoweOS to your Home Screen';
    html = '<div style="text-align:left;color:var(--text-secondary);font-size:var(--text-sm);line-height:1.8;">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">1</div><span>Tap the <strong style="color:var(--text-primary);">Share</strong> button <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> in Safari</span></div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">2</div><span>Scroll down and tap <strong style="color:var(--text-primary);">Add to Home Screen</strong></span></div>'
      + '<div style="display:flex;align-items:center;gap:10px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">3</div><span>Tap <strong style="color:var(--text-primary);">Add</strong> to confirm</span></div>'
      + '</div>';
  } else if (isAndroid) {
    if (title) title.textContent = 'Install RoweOS';
    html = '<div style="text-align:left;color:var(--text-secondary);font-size:var(--text-sm);line-height:1.8;">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">1</div><span>Tap the <strong style="color:var(--text-primary);">&#8942;</strong> menu in Chrome</span></div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">2</div><span>Tap <strong style="color:var(--text-primary);">Install app</strong> or <strong style="color:var(--text-primary);">Add to Home screen</strong></span></div>'
      + '<div style="display:flex;align-items:center;gap:10px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">3</div><span>Tap <strong style="color:var(--text-primary);">Install</strong> to confirm</span></div>'
      + '</div>';
  } else if (isMac) {
    if (title) title.textContent = 'Add RoweOS to your Dock';
    html = '<div style="text-align:left;color:var(--text-secondary);font-size:var(--text-sm);line-height:1.8;">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">1</div><span>In Safari or Chrome, look for the <strong style="color:var(--text-primary);">install</strong> icon in the address bar</span></div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">2</div><span>Or drag the site icon from the address bar to your <strong style="color:var(--text-primary);">Dock</strong></span></div>'
      + '<div style="display:flex;align-items:center;gap:10px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">3</div><span>RoweOS will open as its own window</span></div>'
      + '</div>';
  } else if (isWindows) {
    if (title) title.textContent = 'Add RoweOS to your Desktop';
    html = '<div style="text-align:left;color:var(--text-secondary);font-size:var(--text-sm);line-height:1.8;">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">1</div><span>Click the <strong style="color:var(--text-primary);">&#8942;</strong> menu in Chrome or Edge</span></div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">2</div><span>Click <strong style="color:var(--text-primary);">More tools > Create shortcut</strong></span></div>'
      + '<div style="display:flex;align-items:center;gap:10px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--text-primary);">3</div><span>Check <strong style="color:var(--text-primary);">"Open as window"</strong> and click Create</span></div>'
      + '</div>';
  } else {
    if (title) title.textContent = 'Add RoweOS to your Home';
    html = '<p style="color:var(--text-secondary);font-size:var(--text-sm);">Check your browser menu for an option to install or add to home screen.</p>';
  }
  container.innerHTML = html;
}

function proceedFromDockStep() {
  goToOnboardingStep('betaWelcome');
}

// v21.0: Cross-device step proceed
function proceedFromCrossDevice() {
  goToOnboardingStep('betaWelcome');
}

// v21.0: Populate cross-device content based on current device
function populateCrossDeviceContent() {
  var container = document.getElementById('crossDeviceContainer');
  if (!container) return;
  var isMobile = window.innerWidth <= 768;
  var hasSync = localStorage.getItem('roweos_firebase_sync') === 'true';
  var html = '';

  if (isMobile) {
    // Mobile user — show desktop wireframe + home screen instructions
    html += '<div style="display:flex;flex-direction:column;gap:20px;text-align:center;">';
    // Desktop wireframe
    html += '<div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:12px;padding:20px;max-width:320px;margin:0 auto;">';
    html += '<div style="background:var(--bg-secondary);border-radius:8px;padding:12px;margin-bottom:8px;">';
    html += '<div style="display:flex;gap:4px;margin-bottom:8px;"><div style="width:6px;height:6px;border-radius:50%;background:#ef4444;"></div><div style="width:6px;height:6px;border-radius:50%;background:#fbbf24;"></div><div style="width:6px;height:6px;border-radius:50%;background:#22c55e;"></div></div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<div style="width:40px;background:var(--bg-tertiary);border-radius:4px;padding:4px;"><div style="width:100%;height:4px;background:var(--accent);border-radius:2px;margin-bottom:3px;opacity:0.6;"></div><div style="width:100%;height:4px;background:var(--border-color);border-radius:2px;margin-bottom:3px;"></div><div style="width:100%;height:4px;background:var(--border-color);border-radius:2px;"></div></div>';
    html += '<div style="flex:1;background:var(--bg-tertiary);border-radius:4px;padding:8px;"><div style="width:60%;height:6px;background:var(--accent);border-radius:3px;margin-bottom:6px;opacity:0.5;"></div><div style="width:80%;height:4px;background:var(--border-color);border-radius:2px;margin-bottom:4px;"></div><div style="width:70%;height:4px;background:var(--border-color);border-radius:2px;"></div></div>';
    html += '</div></div>';
    html += '<div style="font-size:12px;color:var(--text-muted);">Desktop experience</div>';
    html += '</div>';
    html += '<p style="color:var(--text-primary);font-weight:600;font-size:16px;margin:0;">Sign in on desktop for the full experience</p>';
    html += '<p style="color:var(--text-secondary);font-size:14px;margin:0;">Visit <strong>roweos.com</strong> on your computer.</p>';
    if (hasSync) {
      html += '<p style="color:var(--accent);font-size:13px;margin:4px 0 0;">Everything syncs automatically between devices.</p>';
    }
    // Add to home screen instructions
    html += '<div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:10px;padding:14px;text-align:left;margin-top:8px;">';
    html += '<div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:8px;">Add to Home Screen</div>';
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">1. Tap the <strong>Share</strong> button (box with arrow)<br>2. Scroll down and tap <strong>Add to Home Screen</strong><br>3. Tap <strong>Add</strong></div>';
    } else {
      html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">1. Tap the <strong>menu</strong> (three dots)<br>2. Tap <strong>Add to Home Screen</strong> or <strong>Install App</strong><br>3. Confirm installation</div>';
    }
    html += '</div>';
    html += '</div>';
  } else {
    // Desktop user — show phone wireframe + sync messaging
    html += '<div style="display:flex;gap:32px;align-items:center;text-align:left;">';
    // Phone wireframe
    html += '<div style="flex-shrink:0;width:140px;">';
    html += '<div style="background:var(--bg-tertiary);border:2px solid var(--border-color);border-radius:20px;padding:8px;width:130px;">';
    html += '<div style="width:40px;height:4px;background:var(--border-color);border-radius:2px;margin:0 auto 6px;"></div>';
    html += '<div style="background:var(--bg-secondary);border-radius:8px;padding:8px;min-height:180px;">';
    html += '<div style="width:50%;height:5px;background:var(--accent);border-radius:2px;margin-bottom:8px;opacity:0.6;"></div>';
    html += '<div style="width:80%;height:4px;background:var(--border-color);border-radius:2px;margin-bottom:4px;"></div>';
    html += '<div style="width:60%;height:4px;background:var(--border-color);border-radius:2px;margin-bottom:12px;"></div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">';
    html += '<div style="height:28px;background:var(--bg-tertiary);border-radius:4px;"></div>';
    html += '<div style="height:28px;background:var(--bg-tertiary);border-radius:4px;"></div>';
    html += '<div style="height:28px;background:var(--bg-tertiary);border-radius:4px;"></div>';
    html += '<div style="height:28px;background:var(--bg-tertiary);border-radius:4px;"></div>';
    html += '</div></div>';
    html += '<div style="width:32px;height:32px;border:2px solid var(--border-color);border-radius:50%;margin:6px auto 0;"></div>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:6px;">Mobile</div>';
    html += '</div>';
    // Text content
    html += '<div style="flex:1;">';
    html += '<p style="color:var(--text-primary);font-weight:600;font-size:17px;margin:0 0 8px;">RoweOS works on your phone too</p>';
    html += '<p style="color:var(--text-secondary);font-size:14px;margin:0 0 16px;line-height:1.6;">Add it to your home screen for instant access. Visit <strong>roweos.com</strong> on your phone\'s browser.</p>';
    if (hasSync) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(168,152,120,0.08);border:1px solid rgba(168,152,120,0.15);border-radius:8px;margin-bottom:12px;">';
      html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      html += '<span style="font-size:13px;color:var(--text-primary);">Your data syncs seamlessly between devices. Brands, settings, conversations, and automations all travel with you.</span>';
      html += '</div>';
    } else {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(168,152,120,0.06);border:1px solid var(--border-color);border-radius:8px;margin-bottom:12px;">';
      html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
      html += '<span style="font-size:13px;color:var(--text-secondary);">Enable Cloud Sync in Settings to keep your devices in sync.</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }

  container.innerHTML = html;
}

// v20.20: Beta welcome — proceed to brand or life flow
function proceedFromBetaWelcome() {
  if (selectedOnboardingMode === 'life') {
    // v27.0: Open life onboarding modal which shows web import fork (step 0) first
    hideOnboarding();
    window.isCreatingNewLifeProfile = true;
    // Use the profile already created in proceedFromModeSelection
    if (!window.pendingNewLifeProfile) {
      var _profiles = getLifeProfiles();
      if (_profiles.length > 0) {
        window.pendingNewLifeProfile = _profiles[_profiles.length - 1];
      }
    }
    if (typeof openLifeOnboarding === 'function') {
      openLifeOnboarding();
    } else {
      goToOnboardingStep('life1');
    }
  } else {
    goToOnboardingStep(7);
  }
}

// v21.0: Populate cross-mode intelligence content
function populateCrossModeContent() {
  var container = document.getElementById('crossModeContainer');
  if (!container) return;
  var origin = window._crossModeOrigin || 'brand';
  var crossEnabled = localStorage.getItem('roweos_cross_mode_enabled') !== 'false';
  var hasBrand = brands && brands.length > 0;
  var hasLife = localStorage.getItem('roweos_life_onboarding_complete') === 'true';
  var otherMode = origin === 'life' ? 'BrandAI' : 'LifeAI';
  var hasOther = origin === 'life' ? hasBrand : hasLife;

  var html = '<div style="max-width:440px;margin:0 auto;">';
  html += '<p style="color:var(--text-secondary);font-size:14px;line-height:1.7;margin:0 0 20px;">When enabled, your Tax Intelligence knows about your businesses, your Life Coach understands your work, and brand agents know your communication style.</p>';

  // Toggle
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:20px;">';
  html += '<div><div style="font-weight:600;color:var(--text-primary);font-size:14px;">Cross-Mode Intelligence</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Share context between Brand and Life modes</div></div>';
  html += '<label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">';
  html += '<input type="checkbox" id="crossModeOnboardingToggle" onchange="toggleCrossMode(this.checked)" ' + (crossEnabled ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
  html += '<span style="position:absolute;top:0;left:0;right:0;bottom:0;background:' + (crossEnabled ? 'var(--accent)' : 'var(--bg-secondary)') + ';border-radius:12px;transition:0.2s;border:1px solid var(--border-color);" onclick="var cb=this.previousElementSibling;cb.checked=!cb.checked;cb.onchange();this.style.background=cb.checked?\'var(--accent)\':\'var(--bg-secondary)\';this.querySelector(\'span\').style.transform=cb.checked?\'translateX(20px)\':\'translateX(0)\'"><span style="position:absolute;top:2px;left:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:0.2s;' + (crossEnabled ? 'transform:translateX(20px)' : '') + '"></span></span>';
  html += '</label>';
  html += '</div>';

  // Prompt for other mode
  if (!hasOther) {
    html += '<div style="padding:14px 16px;background:rgba(168,152,120,0.06);border:1px solid var(--border-color);border-radius:var(--radius-md);">';
    html += '<div style="font-weight:600;color:var(--text-primary);font-size:14px;margin-bottom:6px;">Set up ' + otherMode + ' too?</div>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin:0 0 12px;">Get the most out of Cross-Mode Intelligence by setting up both modes.</p>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="window._crossModeSetupOther=true;proceedFromCrossMode()" class="onboarding-btn onboarding-btn-primary" style="padding:8px 20px;font-size:13px;">Yes, set up ' + otherMode + '</button>';
    html += '<button onclick="proceedFromCrossMode()" class="onboarding-btn onboarding-btn-secondary" style="padding:8px 16px;font-size:13px;">Not now</button>';
    html += '</div></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

// v21.0: Proceed from cross-mode step
function proceedFromCrossMode() {
  var origin = window._crossModeOrigin || 'brand';
  if (window._crossModeSetupOther) {
    window._crossModeSetupOther = false;
    // Route to other mode's onboarding
    if (origin === 'brand') {
      selectedOnboardingMode = 'life';
      goToOnboardingStep('life1');
    } else {
      selectedOnboardingMode = 'brand';
      goToOnboardingStep(7);
    }
    return;
  }
  // Complete the original onboarding
  if (origin === 'life') {
    finishLifeAIOnboarding();
  } else {
    completeOnboarding();
  }
}

function toggleOnboardingGcalInputs() {
  var el = document.getElementById('onboardingGcalInputs');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function toggleOnboardingIcloudInputs() {
  var el = document.getElementById('onboardingIcloudInputs');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function connectOnboardingGoogleCalendar() {
  // v23.2: Client ID is hardcoded — just connect directly
  try {
    connectGoogleCalendar();
  } catch (e) {
    showToast('Google Calendar error: ' + e.message, 'error');
    return;
  }
  // v16.12: Poll for connection status (OAuth popup is async)
  var pollCount = 0;
  var pollInterval = setInterval(function() {
    pollCount++;
    if (_gcalConnected || pollCount > 30) {
      clearInterval(pollInterval);
      if (_gcalConnected) {
        var card = document.getElementById('onboardingGcalCard');
        var status = document.getElementById('onboardingGcalStatus');
        var inputs = document.getElementById('onboardingGcalInputs');
        if (card) { card.style.borderColor = '#22c55e'; card.dataset.connected = 'true'; }
        if (status) status.style.display = 'block';
        if (inputs) inputs.style.display = 'none';
      } else if (pollCount > 30) {
        // v28.5: Show guidance if connection timed out (likely "Access blocked")
        showToast('Google Calendar connection timed out. If you saw "Access blocked", try a personal Gmail account or skip this step.', 'warning');
      }
    }
  }, 1000);
}

function connectOnboardingICloudCalendar() {
  var appleIdInput = document.getElementById('onboardingIcloudAppleId');
  var appPwInput = document.getElementById('onboardingIcloudAppPassword');
  var appleId = appleIdInput ? appleIdInput.value.trim() : '';
  var appPw = appPwInput ? appPwInput.value.trim() : '';
  if (!appleId || !appPw) {
    showToast('Enter your Apple ID and app-specific password', 'error');
    return;
  }
  // v16.12: Store credentials and delegate to existing connect function
  localStorage.setItem('roweos_icloud_apple_id', appleId);
  localStorage.setItem('roweos_icloud_app_password', appPw);
  connectICloudCalendar();
  // v16.12: Poll for connection status (async CalDAV test)
  var pollCount = 0;
  var pollInterval = setInterval(function() {
    pollCount++;
    if (_icloudConnected || pollCount > 15) {
      clearInterval(pollInterval);
      if (_icloudConnected) {
        var card = document.getElementById('onboardingIcloudCard');
        var status = document.getElementById('onboardingIcloudStatus');
        var inputs = document.getElementById('onboardingIcloudInputs');
        if (card) { card.style.borderColor = '#22c55e'; card.dataset.connected = 'true'; }
        if (status) status.style.display = 'block';
        if (inputs) inputs.style.display = 'none';
      }
    }
  }, 1000);
}

// v10.5.25: LifeAI Onboarding Functions (Phase 2/3)
var lifeAIUserName = '';
var lifeAISelectedProvider = null;

function proceedFromLifeName() {
  var nameInput = document.getElementById('lifeAIUserName');
  if (nameInput && nameInput.value.trim()) {
    lifeAIUserName = nameInput.value.trim();
    localStorage.setItem('roweos_life_username', lifeAIUserName);
    console.log('[LifeAI] User name set:', lifeAIUserName);
    goToOnboardingStep('life3');
  } else {
    // Shake animation or highlight
    if (nameInput) {
      nameInput.style.borderColor = '#ef4444';
      nameInput.focus();
      setTimeout(function() {
        nameInput.style.borderColor = '';
      }, 2000);
    }
  }
}

function selectLifeAIProvider(provider, event) {
  if (event) event.stopPropagation();
  
  lifeAISelectedProvider = provider;
  console.log('[LifeAI] Provider selected:', provider);
  
  // Update UI - highlight selected card
  var cards = document.querySelectorAll('#onboardingLifeStep3 .onboarding-model-card');
  cards.forEach(function(card) {
    card.classList.remove('selected');
  });
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('selected');
  }
  
  // Enable continue button
  var continueBtn = document.getElementById('lifeAIProviderContinue');
  if (continueBtn) {
    continueBtn.disabled = false;
    continueBtn.style.opacity = '1';
  }
}

function proceedFromLifeProvider() {
  if (!lifeAISelectedProvider) {
    console.warn('[LifeAI] No provider selected');
    return;
  }
  
  console.log('[LifeAI] Proceeding with provider:', lifeAISelectedProvider);
  localStorage.setItem('roweos_life_provider', lifeAISelectedProvider);
  
  // Set as default provider
  localStorage.setItem('selectedProvider', lifeAISelectedProvider);
  
  goToOnboardingStep('life4');
}

// ═══════════════════════════════════════════════════════════════════════════════
// v10.5.25: LIFEAI MULTI-PROFILE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// Get all life profiles (array, like brands)
function getLifeProfiles() {
  var data = localStorage.getItem('roweos_life_profiles');
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {}
  }
  
  // Migrate from single profile if exists
  var singleProfile = localStorage.getItem('roweos_life_profile');
  if (singleProfile) {
    try {
      var profile = JSON.parse(singleProfile);
      profile.id = 'life_' + Date.now();
      var profiles = [profile];
      localStorage.setItem('roweos_life_profiles', JSON.stringify(profiles));
      return profiles;
    } catch (e) {}
  }
  
  return [];
}

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

  // v26.4: Guard against writeDB early-return paths that would leave counter stuck
  var db = typeof getDB === 'function' ? getDB() : null;
  if (!db || (typeof isLocalOnlyMode === 'function' && isLocalOnlyMode())) {
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

// Save life profiles
function saveLifeProfiles(profiles) {
  // v27.0: Stamp _modifiedAt and backfill id on every profile before persisting
  var now = Date.now();
  for (var _spi = 0; _spi < profiles.length; _spi++) {
    profiles[_spi]._modifiedAt = now;
    if (!profiles[_spi].id) profiles[_spi].id = 'life_' + now + '_' + _spi;
  }

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

// Get current life profile
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

// Set current life profile index
function setCurrentLifeProfileIndex(idx) {
  var profiles = getLifeProfiles();
  if (profiles[idx]) {
    localStorage.setItem('roweos_current_life_profile_idx', idx.toString());
    localStorage.setItem('roweos_life_profile', JSON.stringify(profiles[idx]));
    localStorage.setItem('roweos_user_name', profiles[idx].name || 'My Life');
    
    if (typeof updateModeUI === 'function') {
      updateModeUI('life');
    }
  }
}

// Add new life profile
function addLifeProfile(profile) {
  var profiles = getLifeProfiles();
  profile.id = 'life_' + Date.now();
  profile.createdAt = new Date().toISOString();
  profiles.push(profile);
  saveLifeProfiles(profiles);
  return profile.id;
}

// Update life profile
function updateLifeProfile(idx, updates) {
  var profiles = getLifeProfiles();
  if (profiles[idx]) {
    Object.assign(profiles[idx], updates);
    profiles[idx].updatedAt = new Date().toISOString();
    saveLifeProfiles(profiles);
  }
}

// Delete life profile
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

  // Adjust current index (v26.4: handle all three cases including currentIdx > idx)
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  if (currentIdx >= profiles.length) {
    setCurrentLifeProfileIndex(profiles.length - 1);
  } else if (currentIdx === idx) {
    setCurrentLifeProfileIndex(0);
  } else if (currentIdx > idx) {
    setCurrentLifeProfileIndex(currentIdx - 1);
  }

  // Save locally first (optimistic), then flush immediately to avoid double-write race
  saveLifeProfiles(profiles);
  if (typeof _flushLifeAISync === 'function') _flushLifeAISync();

  // Sync _deletedProfiles to Firestore with confirmation callback
  var deletedName = deleted.name || 'Profile';
  showToast('Deleting "' + deletedName + '"...', 'info');

  if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    writeDB('lifeAI/main', {
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
    if (typeof applyAccentColor === 'function') applyAccentColor();
  }

  return true;
}

// Sync life profiles to Firebase
// v26.4: syncLifeProfilesToFirebase removed -- use syncLifeAIToFirestore instead
// ═══════════════════════════════════════════════════════════════════════════════
// v10.5.25: LIFEAI IDENTITY VIEW
// ═══════════════════════════════════════════════════════════════════════════════

// Render LifeAI Identity view (called when showing memory view in life mode)
function renderLifeIdentityView() {
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode');
  if (currentMode !== 'life') return;
  
  var profile = getCurrentLifeProfile();
  if (!profile) return;
  
  // Update header
  var titleEl = document.getElementById('memoryBrandTitle');
  var taglineEl = document.getElementById('memoryBrandTagline');
  
  if (titleEl) titleEl.textContent = profile.name || 'My Life';
  if (taglineEl) {
    // v11.0.5: Show profile completion percentage instead of counts
    var completion = calculateLifeProfileCompletion(profile);
    taglineEl.textContent = completion + '% profile complete';
  }
  
  // v10.5.25: Use SEPARATE container for Life Identity - don't touch Brand container
  var lifeContainer = document.getElementById('lifeIdentityCardsContainer');
  var brandContainer = document.getElementById('identityCardsContainer');
  var brandDocsSection = document.getElementById('brandDocUploadSection');

  // Hide Brand containers, show Life container
  if (brandContainer) brandContainer.style.display = 'none';
  if (brandDocsSection) brandDocsSection.style.display = 'none';
  // v24.15: Hide category tabs and all category panels in life mode
  var catTabs = document.getElementById('identityPillNav');
  if (catTabs) catTabs.style.display = 'none';
  ['user', 'knowledge', 'platform'].forEach(function(c) {
    var p = document.getElementById('identityCat_' + c);
    if (p) p.style.display = 'none';
  });

  if (lifeContainer) {
    lifeContainer.style.display = 'block';
    lifeContainer.innerHTML = buildLifeIdentityCards(profile);
  }

  // v12.2.4: Show LifeAI document upload section
  var lifeUploadSection = document.getElementById('lifeIdentityUploadSection');
  if (lifeUploadSection) {
    lifeUploadSection.style.display = 'block';
    renderLifeIdentityDocs();
  }
  // v20.4: Hide share button in life mode (brand-only feature)
  var shareBtn = document.getElementById('shareBrandBtn');
  if (shareBtn) shareBtn.style.display = 'none';
}

// v10.5.25: Show Brand Identity (restore when switching back)
function renderBrandIdentityView() {
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode');
  if (currentMode === 'life') return;

  // Show Brand containers, hide Life container
  var lifeContainer = document.getElementById('lifeIdentityCardsContainer');
  var brandContainer = document.getElementById('identityCardsContainer');
  var lifeUploadSection = document.getElementById('lifeIdentityUploadSection');

  if (lifeContainer) lifeContainer.style.display = 'none';
  if (lifeUploadSection) lifeUploadSection.style.display = 'none';
  if (brandContainer) brandContainer.style.display = 'block';

  // v24.15: Show pill nav and reset to Brand User tab
  var catTabs = document.getElementById('identityPillNav');
  if (catTabs) catTabs.style.display = '';
  showIdentityCategory('user');

  // v20.7: Render role badge and digital presence FIRST — before any function that could throw
  try { renderIdentityRoleBadge(); } catch(e) {}
  try { renderDigitalPresenceCard(); } catch(e) {}

  // Restore normal brand memory UI (each in own try/catch so failures don't cascade)
  try { renderMemoryBrandPills(); } catch(e) { console.warn('[Identity] renderMemoryBrandPills:', e.message); }
  try { updateMemoryUI(); } catch(e) { console.warn('[Identity] updateMemoryUI:', e.message); }
  try { loadBrandKnowledge(currentKnowledgeBrand); } catch(e) { console.warn('[Identity] loadBrandKnowledge:', e.message); }
  try { loadBrandRole(); } catch(e) { console.warn('[Identity] loadBrandRole:', e.message); }
  // v20.4: Show share button if signed in
  var shareBtn = document.getElementById('shareBrandBtn');
  if (shareBtn) shareBtn.style.display = firebaseUser ? '' : 'none';
  // v24.13: Render logo variants and visual ref photos
  try { renderLogoVariants(); } catch(e) {}
  try { renderVisualRefPhotos(); } catch(e) {}
}

// v18.4: Role badge display in Identity view
function renderIdentityRoleBadge() {
  var brand = brands[selectedBrand];
  if (!brand) return;
  var roleData = brand.roleData || {};
  var isOwner = (roleData.type || 'owner') === 'owner';
  var roleLabel = isOwner ? 'Owner / Founder' : 'Employee';
  var title = isOwner ? (roleData.ownerTitle || '') : (roleData.title || '');
  var dept = (!isOwner && roleData.profession) ? roleData.profession : '';

  var container = document.getElementById('identityRoleBadgeArea');
  if (!container) return;

  var html = '<div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); margin-bottom: var(--space-4);">';
  html += '<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--accent-20, rgba(168,152,120,0.2)); display: flex; align-items: center; justify-content: center;">';
  html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  html += '</div>';
  html += '<div style="flex: 1;">';
  html += '<div style="display: flex; align-items: center; gap: 8px;">';
  html += '<span style="font-weight: 600; font-size: var(--text-base); color: var(--text-primary);">' + escapeHtml(roleLabel) + '</span>';
  html += '<span style="padding: 2px 8px; border-radius: var(--radius-full); background: ' + (isOwner ? 'var(--accent-20, rgba(168,152,120,0.2))' : 'rgba(139,92,246,0.15)') + '; font-size: var(--text-xs); color: ' + (isOwner ? 'var(--accent)' : '#8b5cf6') + ';">' + (isOwner ? 'Owner' : 'Team') + '</span>';
  html += '</div>';
  if (title) html += '<div style="font-size: var(--text-sm); color: var(--text-secondary); margin-top: 2px;">' + escapeHtml(title) + '</div>';
  if (dept) html += '<div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-top: 1px;">' + escapeHtml(dept) + '</div>';
  html += '</div></div>';
  container.innerHTML = html;
}

// v18.9: Digital Presence card in Identity view — redesigned with website import
function renderDigitalPresenceCard() {
  try {
  var brand = (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined') ? brands[selectedBrand] : null;
  if (!brand) return;

  var container = document.getElementById('identityDigitalPresenceArea');
  if (!container) return;

  var scope = typeof getSocialKeyScope === 'function' ? getSocialKeyScope() : '';
  var website = brand.website || '';

  var platforms = [
    { key: 'x', name: 'X', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>', bg: 'rgba(29,155,240,0.08)' },
    { key: 'threads', name: 'Threads', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.781 3.632 2.698 6.542 2.717 2.227-.017 4.07-.531 5.394-1.842 1.456-1.442 1.497-3.35.085-4.792-.86-.878-2.088-1.349-3.66-1.408a9.633 9.633 0 0 0-1.313.014c.208.504.32 1.032.32 1.58 0 .127-.007.253-.02.377-.069.642-.332 1.213-.777 1.676-.665.693-1.672 1.056-2.91 1.056-1.02 0-1.96-.27-2.624-.883-.637-.587-.956-1.368-.956-2.312 0-1.92 1.634-3.478 4.315-3.573.753-.027 1.56.008 2.394.103-.12-.64-.478-1.151-1.064-1.51-.668-.41-1.553-.625-2.562-.625l.005-2.12c1.474 0 2.779.35 3.82 1.025.925.6 1.574 1.412 1.91 2.37.89-.067 1.762-.033 2.578.103 1.953.325 3.487 1.158 4.437 2.41.983 1.296 1.285 2.953.852 4.654-.598 2.35-2.488 4.018-5.336 4.713-1.215.297-2.6.442-4.095.442z"/></svg>', bg: 'rgba(0,0,0,0.08)' },
    { key: 'instagram', name: 'Instagram', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>', bg: 'rgba(225,48,108,0.08)' }
  ];

  var html = '<div class="identity-card" data-section="digital-presence" style="margin-top: var(--space-4);">';
  html += '<div class="identity-card-header" onclick="toggleIdentityCard(this)">';
  html += '<div class="identity-card-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>';
  html += '<div class="identity-card-title"><h3>Digital Presence</h3><p>Website, social accounts, and online footprint</p></div>';
  html += '<svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  html += '</div>';
  html += '<div class="identity-card-body">';

  // v20.7: Website URL bar — styled like other Identity inputs
  html += '<div class="dp-website-bar">';
  html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" style="flex-shrink:0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  html += '<input type="url" id="dpWebsiteInput" placeholder="https://yourbrand.com" value="' + escapeHtml(website) + '" onchange="saveBrandWebsite(this.value)">';
  html += '<button class="dp-scan-btn" id="dpScanBtn" onclick="scanBrandWebsite()">';
  html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>';
  html += '<span>Save</span>';
  html += '</button>';
  html += '</div>';

  // Site preview area (populated by scanBrandWebsite)
  html += '<div id="dpSitePreview"></div>';

  // Detected social links area (populated by scan)
  html += '<div id="dpDetectedLinks"></div>';

  // v20.6: Extract Brand Info — AI-powered identity extraction from website
  html += '<div style="margin-top: 16px; padding: 14px; background: var(--bg-tertiary); border-radius: var(--radius-md); border: 1px solid var(--border-color);">';
  html += '<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">';
  html += '<div style="flex: 1;">';
  html += '<div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">Research Brand</div>';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px;">Launch deep research on your website to extract brand intelligence</div>';
  html += '</div>';
  html += '<button class="dp-scan-btn" id="dpExtractBtn" onclick="launchResearchFromIdentity()" style="white-space: nowrap;">';
  html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
  html += '<span>Research Brand</span>';
  html += '</button>';
  html += '</div>';
  html += '<div id="dpExtractStatus" style="display: none; margin-top: 10px; align-items: center; gap: 8px; font-size: var(--text-xs); color: var(--text-secondary);">';
  html += '<div class="dp-spinner" style="width: 14px; height: 14px;"></div>';
  html += '<span id="dpExtractStatusText">Analyzing website...</span>';
  html += '</div>';
  html += '</div>';

  // Social accounts section
  html += '<div style="margin-top: 20px;">';
  html += '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">';
  html += '<div style="font-size:var(--text-xs); font-weight:600; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em;">Connected Accounts</div>';
  var activePlatforms = platforms.filter(function(p) { return !p.comingSoon; });
  html += '<div style="font-size:var(--text-xs); color:var(--text-muted);">' + activePlatforms.filter(function(p) { return localStorage.getItem('roweos_social_' + p.key + '_connected' + scope) === 'true'; }).length + ' of ' + activePlatforms.length + ' connected</div>';
  html += '</div>';

  html += '<div class="dp-social-grid">';
  platforms.forEach(function(p) {
    // v22.7: Coming soon platforms show badge instead of connect button
    if (p.comingSoon) {
      html += '<div class="dp-social-tile" style="opacity:0.6;">';
      html += '<div class="dp-social-icon" style="background:' + p.bg + '">' + p.icon + '</div>';
      html += '<div class="dp-social-info">';
      html += '<div class="dp-social-name">' + p.name + '</div>';
      html += '<div class="dp-social-handle" style="color:var(--text-muted);">Coming Soon</div>';
      html += '</div>';
      html += '<span style="font-size:var(--text-xs);color:var(--text-tertiary);padding:4px 10px;border:1px solid var(--border-color);border-radius:var(--radius-2xl);">Soon</span>';
      html += '</div>';
      return;
    }
    var connected = localStorage.getItem('roweos_social_' + p.key + '_connected' + scope) === 'true';
    var handle = localStorage.getItem('roweos_social_' + p.key + '_handle' + scope) || '';
    html += '<div class="dp-social-tile' + (connected ? ' connected' : '') + '">';
    html += '<div class="dp-social-icon" style="background:' + p.bg + '">' + p.icon + '</div>';
    html += '<div class="dp-social-info">';
    html += '<div class="dp-social-name">' + p.name + '</div>';
    if (connected && handle) {
      html += '<div class="dp-social-handle" style="color:var(--accent);">@' + escapeHtml(handle) + '</div>';
    } else if (connected) {
      html += '<div class="dp-social-handle" style="color:#4ade80;">Connected</div>';
    } else {
      html += '<div class="dp-social-handle" style="color:var(--text-muted);">Not connected</div>';
    }
    html += '</div>';
    if (!connected) {
      html += '<button class="btn btn-small" onclick="connect' + (p.key === 'x' ? 'X' : p.key.charAt(0).toUpperCase() + p.key.slice(1)) + '()" style="padding:5px 14px; font-size:var(--text-xs); border-radius:var(--radius-2xl);">Connect</button>';
    } else {
      html += '<div class="dp-social-status" style="background:#4ade80;" title="Connected"></div>';
    }
    html += '</div>';
  });
  html += '</div></div>';

  html += '</div></div>';
  container.innerHTML = html;

  // If brand has cached site meta, render preview
  if (brand._siteMeta) {
    renderDPSitePreview(brand._siteMeta);
  }
  } catch(dpErr) { console.warn('[Identity] Digital Presence render error:', dpErr.message); }
}

// v18.9: Scan brand website and import metadata
function scanBrandWebsite() {
  var input = document.getElementById('dpWebsiteInput');
  var btn = document.getElementById('dpScanBtn');
  if (!input || !btn) return;

  var url = input.value.trim();
  if (!url) {
    showToast('Enter a website URL first', 'warning');
    return;
  }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  // Save the URL
  saveBrandWebsite(url);
  input.value = url;

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = '<div class="dp-spinner"></div><span>Saving...</span>';

  fetch('/api/fetch-site-meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg><span>Save</span>';

    if (data.error) {
      showToast('Could not preview: ' + data.error, 'warning');
      showToast('Website URL saved', 'success');
      return;
    }

    // Cache on brand object (in-memory only, not persisted to localStorage — too large)
    var brand = brands[selectedBrand];
    if (brand) brand._siteMeta = data;

    renderDPSitePreview(data);
    renderDPDetectedLinks(data.socialLinks || {});
    showToast('Website saved', 'success');
  })
  .catch(function(err) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg><span>Save</span>';
    showToast('URL saved (preview unavailable)', 'success');
  });
}

// v18.9: Render site preview card from scan data
function renderDPSitePreview(data) {
  var container = document.getElementById('dpSitePreview');
  if (!container) return;

  var html = '<div class="dp-site-preview">';

  // OG Image if available
  if (data.ogImage) {
    html += '<img class="dp-site-preview-og" src="' + escapeHtml(data.ogImage) + '" alt="" onerror="this.style.display=\'none\'">';
  }

  html += '<div class="dp-site-preview-header">';
  if (data.favicon) {
    html += '<img class="dp-site-preview-favicon" src="' + escapeHtml(data.favicon) + '" alt="" onerror="this.style.display=\'none\'">';
  }
  html += '<div class="dp-site-preview-info">';
  html += '<div class="dp-site-preview-title">' + escapeHtml(data.title || data.domain || 'Untitled') + '</div>';
  html += '<div class="dp-site-preview-domain">' + escapeHtml(data.domain || '') + '</div>';
  html += '</div>';
  html += '<a href="' + escapeHtml(data.url || '') + '" target="_blank" rel="noopener" style="color:var(--text-muted); flex-shrink:0;" title="Visit site">';
  html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  html += '</a>';
  html += '</div>';

  if (data.description) {
    var desc = data.description.length > 200 ? data.description.substring(0, 200) + '...' : data.description;
    html += '<div class="dp-site-preview-desc">' + escapeHtml(desc) + '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

// v18.9: Render detected social links from website scan
function renderDPDetectedLinks(socialLinks) {
  var container = document.getElementById('dpDetectedLinks');
  if (!container) return;

  var keys = Object.keys(socialLinks);
  if (keys.length === 0) {
    container.innerHTML = '';
    return;
  }

  var platformIcons = {
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    threads: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.781 3.632 2.698 6.542 2.717 2.227-.017 4.07-.531 5.394-1.842 1.456-1.442 1.497-3.35.085-4.792z"/></svg>',
    instagram: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/></svg>',
    facebook: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    linkedin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    youtube: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><polygon fill="#fff" points="9.545,15.568 15.818,12 9.545,8.432"/></svg>',
    tiktok: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>'
  };
  var platformNames = { x: 'X', threads: 'Threads', instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok' };

  var html = '<div class="dp-detected-links">';
  html += '<div class="dp-detected-title">Detected Social Links</div>';
  html += '<div class="dp-detected-grid">';

  keys.forEach(function(key) {
    var link = socialLinks[key];
    var iconSvg = platformIcons[key] || '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
    html += '<a class="dp-detected-chip" href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener">';
    html += iconSvg;
    html += '<span>' + escapeHtml(platformNames[key] || key) + '</span>';
    if (link.handle) html += '<span style="color:var(--text-muted);">@' + escapeHtml(link.handle) + '</span>';
    html += '</a>';
  });

  html += '</div></div>';
  container.innerHTML = html;
}

// v18.4: Save brand website
function saveBrandWebsite(url) {
  var brand = brands[selectedBrand];
  if (!brand) return;
  brand.website = url;
  saveBrands();
  // v25.1: saveBrands() already writes through to Firestore
}

// Build LifeAI Identity cards HTML
function buildLifeIdentityCards(profile) {
  var html = '';
  
  // v11.0.5: Show onboarding prompt if not completed
  var identityCount = getIdentityDataCount();
  var showOnboardingCard = !profile.onboardingComplete && !profile.onboardingDismissed && identityCount < 5;
  
  if (showOnboardingCard) {
    html += '<div class="identity-card expanded" data-section="life-onboarding" style="background: linear-gradient(135deg, var(--life-accent-10) 0%, var(--bg-secondary) 100%); border: 2px solid var(--life-accent-30);">';
    html += '  <div class="identity-card-body" style="padding: var(--space-6); text-align: center;">';
    html += '    <div style="margin-bottom: var(--space-4);">';
    html += '      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--life-accent)" stroke-width="1.5"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 3a3 3 0 1 1-3 3 3 3 0 0 1 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-2 4-3.08 6-3.08s5.97 1.1 6 3.08a7.2 7.2 0 0 1-6 3.22z"/></svg>';
    html += '    </div>';
    html += '    <h3 style="margin: 0 0 8px; color: var(--text-primary); font-size: var(--text-xl);">Set Up Your LifeAI Profile</h3>';
    html += '    <p style="color: var(--text-secondary); margin-bottom: var(--space-5); font-size: var(--text-base);">Answer a few questions so your AI coaches can give you personalized advice.</p>';
    html += '    <button type="button" class="btn life-onboarding-btn" onclick="window.openLifeOnboarding()">';
    html += '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: var(--space-2);"><path d="M12 2v8l4-2"/><path d="M12 22c-4 0-8-2-8-8 0-3 2-6 4-8"/><path d="M12 22c4 0 8-2 8-8 0-3-2-6-4-8"/></svg>';
    html += '      Start Setup (2 min)';
    html += '    </button>';
    html += '    <div style="margin-top: var(--space-3);">';
    html += '      <button onclick="dismissOnboardingCard()" style="background: none; border: none; color: var(--text-muted); font-size: var(--text-base); cursor: pointer;">Skip for now</button>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
  } else if (profile.onboardingComplete) {
    // Show a smaller "Edit Profile" button
    html += '<div style="display: flex; justify-content: flex-end; margin-bottom: var(--space-3);">';
    html += '  <button class="btn btn-secondary btn-small" onclick="openLifeOnboarding()" style="font-size: var(--text-sm);">';
    html += '    ' + icon('edit', {size: 14, style: 'margin-right: 4px;'});
    html += '    Edit Profile Survey';
    html += '  </button>';
    html += '</div>';
  }
  
  // Profile Summary Card
  html += '<div class="identity-card" data-section="life-profile">';
  html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)">';
  html += '    <div class="identity-card-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
  html += '    <div class="identity-card-title">';
  html += '      <h3>Profile</h3>';
  html += '      <p>Your personal information</p>';
  html += '    </div>';
  html += '    <div class="identity-card-meta">';
  html += '      <span class="identity-card-badge ai" id="badge-life-profile-ai" style="' + (profile.aiInsights?.profile ? '' : 'display:none;') + '">AI</span>';
  html += '    </div>';
  html += '    <svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  html += '  </div>';
  html += '  <div class="identity-card-body">';
  html += '    <div class="identity-field-group">';
  html += '      <div class="identity-field-label">Name</div>';
  html += '      <input type="text" class="form-input" id="lifeProfileName" value="' + escapeHtml(profile.name || '') + '" onchange="updateCurrentLifeProfileField(\'name\', this.value)" placeholder="Your name...">';
  html += '    </div>';
  html += '    <div class="identity-field-group">';
  html += '      <div class="identity-field-label">';
  html += '        <span class="ai-indicator">◉ LifeAI Insights</span>';
  html += '        <span class="identity-field-hint">(click to edit)</span>';
  html += '      </div>';
  html += '      <div class="identity-ai-insights">';
  html += '        <div class="identity-ai-richtext" contenteditable="true" id="life-profile-ai-notes" data-placeholder="LifeAI-generated insights and notes about you..." onblur="saveLifeAIInsightField(\'profile\', this.innerText)">' + formatAIInsights(profile.aiInsights?.profile || '') + '</div>';
  html += '      </div>';
  html += '      <div style="display: flex; gap: 8px; flex-wrap: wrap;">';
  html += '      <button class="identity-ai-refine-btn" onclick="refineLifeIdentityWithAI(\'profile\', \'Profile & Personal Info\')">';
  html += '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
  html += '        Analyze with LifeAI';
  html += '      </button>';
  html += '      <button class="identity-ai-refine-btn" onclick="refineLifeIdentityConversation(\'profile\', \'Profile & Personal Info\')" style="background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #22c55e;">';
  html += '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  html += '        Refine with LifeAI';
  html += '      </button>';
  html += '      </div>';
  html += '    </div>';
  html += '    <div class="identity-field-group">';
  html += '      <div class="identity-field-label">Created</div>';
  html += '      <div style="color: var(--text-secondary); font-size: var(--text-base);">' + (profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Unknown') + '</div>';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';
  
  // Life Areas Card
  html += '<div class="identity-card" data-section="life-areas">';
  html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)">';
  html += '    <div class="identity-card-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>';
  html += '    <div class="identity-card-title">';
  html += '      <h3>Focus Areas</h3>';
  html += '      <p>' + (profile.lifeAreas || []).length + ' areas selected</p>';
  html += '    </div>';
  html += '    <svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  html += '  </div>';
  html += '  <div class="identity-card-body">';
  html += '    <div class="life-identity-areas-grid">';
  
  Object.keys(LIFE_AREAS).forEach(function(areaKey) {
    var area = LIFE_AREAS[areaKey];
    var isSelected = (profile.lifeAreas || []).includes(areaKey);
    html += '<button type="button" class="life-identity-area-chip' + (isSelected ? ' selected' : '') + '" data-area="' + areaKey + '" onclick="toggleLifeIdentityArea(this, \'' + areaKey + '\')">';
    html += '  <span class="life-identity-area-icon">' + area.icon + '</span>';
    html += '  <span>' + area.name + '</span>';
    html += '</button>';
  });
  
  html += '    </div>';
  html += '  </div>';
  html += '</div>';
  
  // Goals Card
  var shortGoals = (profile.goals || []).filter(function(g) { return g.type === 'short'; });
  var longGoals = (profile.goals || []).filter(function(g) { return g.type === 'long'; });
  
  html += '<div class="identity-card" data-section="life-goals">';
  html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)">';
  html += '    <div class="identity-card-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>';
  html += '    <div class="identity-card-title">';
  html += '      <h3>Goals</h3>';
  html += '      <p>' + shortGoals.length + ' short-term · ' + longGoals.length + ' long-term</p>';
  html += '    </div>';
  html += '    <svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  html += '  </div>';
  html += '  <div class="identity-card-body">';
  
  if ((profile.goals || []).length === 0) {
    html += '    <div style="color: var(--text-tertiary); font-size: var(--text-base); text-align: center; padding: var(--space-5);">No goals set yet</div>';
  } else {
    html += '    <div class="life-identity-goals-list">';
    (profile.goals || []).forEach(function(goal, idx) {
      var areaInfo = LIFE_AREAS[goal.area] || { name: goal.area, icon: '', color: '#888' };
      html += '<div class="life-identity-goal-item">';
      html += '  <div class="life-identity-goal-badge ' + goal.type + '">' + (goal.type === 'short' ? 'Short' : 'Long') + '</div>';
      html += '  <div class="life-identity-goal-content">';
      html += '    <div class="life-identity-goal-title">' + goal.title + '</div>';
      html += '    <div class="life-identity-goal-area" style="color: ' + areaInfo.color + ';">' + areaInfo.name + '</div>';
      html += '  </div>';
      html += '  <button class="life-identity-goal-delete" onclick="deleteLifeGoal(' + idx + ')">';
      html += '    ' + icon('close', {size: 14});
      html += '  </button>';
      html += '</div>';
    });
    html += '    </div>';
  }
  
  html += '    <button class="identity-ai-refine-btn" onclick="openAddGoalModal()" style="margin-top: var(--space-3);">';
  html += '      ' + icon('plus', {size: 14});
  html += '      Add Goal';
  html += '    </button>';
  html += '  </div>';
  html += '</div>';
  
  // Communication Style Card
  var commStyles = {
    supportive: { name: 'Supportive', desc: 'Encouraging, warm, celebrates wins' },
    direct: { name: 'Direct', desc: 'Straightforward, efficient, no fluff' },
    coach: { name: 'Coach', desc: 'Motivating, pushes you forward' },
    analytical: { name: 'Analytical', desc: 'Data-driven, detailed insights' }
  };
  var currentStyle = profile.preferences?.communicationStyle || 'supportive';
  var styleInfo = commStyles[currentStyle] || commStyles.supportive;
  
  html += '<div class="identity-card" data-section="life-comm">';
  html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)">';
  html += '    <div class="identity-card-icon">' + icon('chat', {size: 18}) + '</div>';
  html += '    <div class="identity-card-title">';
  html += '      <h3>Communication Style</h3>';
  html += '      <p>' + styleInfo.name + '</p>';
  html += '    </div>';
  html += '    <svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  html += '  </div>';
  html += '  <div class="identity-card-body">';
  html += '    <div class="life-identity-style-grid">';
  
  Object.keys(commStyles).forEach(function(styleKey) {
    var style = commStyles[styleKey];
    var isSelected = currentStyle === styleKey;
    html += '<button type="button" class="life-identity-style-option' + (isSelected ? ' selected' : '') + '" onclick="selectLifeCommStyle(\'' + styleKey + '\')">';
    html += '  <div class="life-identity-style-name">' + style.name + '</div>';
    html += '  <div class="life-identity-style-desc">' + style.desc + '</div>';
    html += '</button>';
  });
  
  html += '    </div>';
  html += '  </div>';
  html += '</div>';
  
  // Daily Rhythm Card
  var rhythms = {
    early: { name: 'Early Bird', desc: '5am - 9am' },
    morning: { name: 'Morning Person', desc: '9am - 12pm' },
    afternoon: { name: 'Afternoon Focus', desc: '12pm - 5pm' },
    evening: { name: 'Night Owl', desc: '5pm - Late' }
  };
  var currentRhythm = profile.preferences?.productiveTime || 'morning';
  var rhythmInfo = rhythms[currentRhythm] || rhythms.morning;
  
  html += '<div class="identity-card" data-section="life-rhythm">';
  html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)">';
  html += '    <div class="identity-card-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>';
  html += '    <div class="identity-card-title">';
  html += '      <h3>Daily Rhythm</h3>';
  html += '      <p>' + rhythmInfo.name + ' · ' + rhythmInfo.desc + '</p>';
  html += '    </div>';
  html += '    <svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  html += '  </div>';
  html += '  <div class="identity-card-body">';
  html += '    <div class="life-identity-rhythm-grid">';
  
  Object.keys(rhythms).forEach(function(rhythmKey) {
    var rhythm = rhythms[rhythmKey];
    var isSelected = currentRhythm === rhythmKey;
    html += '<button type="button" class="life-identity-rhythm-option' + (isSelected ? ' selected' : '') + '" onclick="selectLifeRhythm(\'' + rhythmKey + '\')">';
    html += '  <div class="life-identity-rhythm-name">' + rhythm.name + '</div>';
    html += '  <div class="life-identity-rhythm-desc">' + rhythm.desc + '</div>';
    html += '</button>';
  });
  
  html += '    </div>';
  html += '  </div>';
  html += '</div>';
  
  // ═══════════════════════════════════════════════════════════════
  // v11.0.5: STRUCTURED IDENTITY DATA CARDS
  // These are auto-populated from conversations via "Save to Identity"
  // ═══════════════════════════════════════════════════════════════
  
  var identityData = profile.identityData || {};
  
  // Category configuration
  var identityCategories = [
    {
      id: 'health',
      name: 'Health & Wellness',
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
      color: '#ef4444',
      fields: [
        { key: 'condition', label: 'Conditions', placeholder: 'Diabetes, asthma, etc.' },
        { key: 'medication', label: 'Medications', placeholder: 'Current medications...' },
        { key: 'dietary', label: 'Dietary', placeholder: 'Vegetarian, gluten-free, etc.' },
        { key: 'allergy', label: 'Allergies', placeholder: 'Food, medication allergies...' },
        { key: 'fitness', label: 'Fitness', placeholder: 'Activity level, goals...' }
      ]
    },
    {
      id: 'family',
      name: 'Family & Relationships',
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      color: '#ec4899',
      fields: [
        { key: 'partner', label: 'Partner', placeholder: 'Name, relationship...' },
        { key: 'children', label: 'Children', placeholder: 'Number, ages...' },
        { key: 'pet', label: 'Pets', placeholder: 'Names, types...' },
        { key: 'status', label: 'Status', placeholder: 'Married, single, etc.' }
      ]
    },
    {
      id: 'work',
      name: 'Work & Career',
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
      color: '#3b82f6',
      fields: [
        { key: 'role', label: 'Role', placeholder: 'Job title, position...' },
        { key: 'business', label: 'Business', placeholder: 'Company, industry...' },
        { key: 'schedule', label: 'Schedule', placeholder: 'Work hours, flexibility...' }
      ]
    },
    {
      id: 'personal',
      name: 'Personal Details',
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      color: '#8b5cf6',
      fields: [
        { key: 'age', label: 'Age', placeholder: 'Your age...' },
        { key: 'location', label: 'Location', placeholder: 'City, state...' },
        { key: 'trait', label: 'Traits', placeholder: 'Morning person, introvert...' },
        { key: 'neurodivergent', label: 'Neurodivergent', placeholder: 'ADHD, autism, etc.' }
      ]
    },
    {
      id: 'tax',
      name: 'Tax & Financial',
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      color: '#22c55e',
      fields: [
        { key: 'entity', label: 'Business Entity', placeholder: 'LLC, S-Corp, etc.' },
        { key: 'filing', label: 'Filing Status', placeholder: 'Single, MFJ, etc.' },
        { key: 'deduction', label: 'Deductions', placeholder: 'Home office, rental...' },
        { key: 'income', label: 'Income Sources', placeholder: 'W-2, 1099, etc.' }
      ]
    }
  ];
  
  // Render each category card
  identityCategories.forEach(function(cat) {
    var catData = identityData[cat.id] || [];
    var itemCount = catData.length;
    var aiInsights = profile.aiInsights && profile.aiInsights[cat.id] || '';
    var hasAI = aiInsights && aiInsights.trim().length > 0;
    
    html += '<div class="identity-card" data-section="identity-' + cat.id + '">';
    html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)">';
    html += '    <div class="identity-card-icon" style="color: ' + cat.color + ';">' + cat.icon + '</div>';
    html += '    <div class="identity-card-title">';
    html += '      <h3>' + cat.name + '</h3>';
    html += '      <p>' + (itemCount > 0 ? itemCount + ' item' + (itemCount > 1 ? 's' : '') + ' saved' : 'No data yet') + '</p>';
    html += '    </div>';
    html += '    <div class="identity-card-meta">';
    if (itemCount > 0) {
      html += '      <span class="identity-card-badge" style="background: ' + cat.color + '; color: #fff;">' + itemCount + '</span>';
    }
    if (hasAI) {
      html += '      <span class="identity-card-badge ai" style="background: var(--life-accent); color: #fff; margin-left: 4px;">AI</span>';
    }
    html += '    </div>';
    html += '    <svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    html += '  </div>';
    html += '  <div class="identity-card-body">';
    
    // v11.0.5: AI Insights section
    html += '    <div class="identity-field-group" style="margin-bottom: var(--space-4);">';
    html += '      <div class="identity-field-label">';
    html += '        <span class="ai-indicator" style="color: var(--life-accent);">◉ LifeAI Insights</span>';
    html += '        <span class="identity-field-hint">(click to edit)</span>';
    html += '      </div>';
    html += '      <div class="identity-ai-insights" style="margin-bottom: var(--space-2);">';
    html += '        <div class="identity-ai-richtext" contenteditable="true" id="life-' + cat.id + '-ai-notes" data-placeholder="LifeAI can analyze your ' + cat.name.toLowerCase() + ' data and provide personalized insights..." onblur="saveLifeAIInsightField(\'' + cat.id + '\', this.innerText)" style="min-height: 60px;">' + formatAIInsights(aiInsights) + '</div>';
    html += '      </div>';
    html += '      <div style="display: flex; gap: 8px; flex-wrap: wrap;">';
    html += '      <button class="identity-ai-refine-btn" onclick="refineLifeIdentityWithAI(\'' + cat.id + '\', \'' + cat.name + '\')" style="background: ' + cat.color + '15; border-color: ' + cat.color + '40; color: ' + cat.color + ';">';
    html += '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
    html += '        Analyze with LifeAI';
    html += '      </button>';
    html += '      <button class="identity-ai-refine-btn" onclick="refineLifeIdentityConversation(\'' + cat.id + '\', \'' + cat.name + '\')" style="background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #22c55e;">';
    html += '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    html += '        Refine with LifeAI';
    html += '      </button>';
    html += '      </div>';
    html += '    </div>';
    
    // Show existing items
    if (itemCount > 0) {
      html += '    <div class="identity-field-group" style="margin-bottom: var(--space-3);">';
      html += '      <div class="identity-field-label">Your Data</div>';
      html += '      <div class="identity-data-items" style="display: flex; flex-wrap: wrap; gap: var(--space-2);">';
      catData.forEach(function(item, idx) {
        html += '      <div class="identity-data-chip" style="display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: ' + cat.color + '15; border: 1px solid ' + cat.color + '40; border-radius: var(--radius-2xl); font-size: var(--text-base);">';
        html += '        <span style="color: var(--text-primary);">' + escapeHtml(item.value) + '</span>';
        html += '        <span style="font-size: var(--text-xs); color: var(--text-muted); text-transform: capitalize;">' + (item.type || '') + '</span>';
        html += '        <button onclick="removeIdentityDataItem(\'' + cat.id + '\', ' + idx + ')" style="background: none; border: none; padding: 0; cursor: pointer; color: var(--text-muted); line-height: 1;" title="Remove">';
        html += '          ' + icon('close', {size: 12});
        html += '        </button>';
        html += '      </div>';
    });
      html += '      </div>';
      html += '    </div>';
    }
    
    // Add new item section
    html += '    <div class="identity-field-group">';
    html += '      <div class="identity-field-label">Add New</div>';
    html += '      <div class="identity-add-item" style="display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center;">';
    html += '        <select id="identityType_' + cat.id + '" class="form-select" style="width: auto; min-width: 120px; font-size: var(--text-base); padding: 6px 10px;">';
    cat.fields.forEach(function(field) {
      html += '          <option value="' + field.key + '">' + field.label + '</option>';
    });
    html += '        </select>';
    html += '        <input type="text" id="identityValue_' + cat.id + '" class="form-input" style="flex: 1; min-width: 150px; font-size: var(--text-base); padding: 6px 10px;" placeholder="Enter value..." onkeypress="if(event.key===\'Enter\')addIdentityDataItem(\'' + cat.id + '\')">';
    html += '        <button class="btn btn-small" onclick="addIdentityDataItem(\'' + cat.id + '\')" style="background: ' + cat.color + '; border-color: ' + cat.color + '; padding: 6px 12px;">';
    html += '          ' + icon('plus', {size: 14});
    html += '        </button>';
    html += '      </div>';
    html += '    </div>';
    
    // Hint text
    html += '    <div style="font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--space-2);">Tip: LifeAI can auto-detect facts from your conversations and offer to save them here.</div>';
    
    html += '  </div>';
    html += '</div>';
  });

  // v11.0.5: About Me Card - Core personal context injected into ALL coaches
  var aboutMe = profile.aboutMe || '';
  html += '<div class="identity-card expanded" data-section="life-about">';
  html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)">';
  html += '    <div class="identity-card-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 3a3 3 0 1 1-3 3 3 3 0 0 1 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-2 4-3.08 6-3.08s5.97 1.1 6 3.08a7.2 7.2 0 0 1-6 3.22z"/></svg></div>';
  html += '    <div class="identity-card-title">';
  html += '      <h3>About Me</h3>';
  html += '      <p>Personal context shared with all coaches</p>';
  html += '    </div>';
  html += '    <div class="identity-card-meta">';
  html += '      <span class="identity-card-badge" style="background: var(--life-accent); color: #fff; ' + (aboutMe ? '' : 'display:none;') + '">Active</span>';
  html += '    </div>';
  html += '    <svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  html += '  </div>';
  html += '  <div class="identity-card-body">';
  html += '    <div style="background: var(--life-accent-10, rgba(34, 197, 94, 0.1)); border: 1px solid var(--life-accent-30, rgba(34, 197, 94, 0.3)); border-radius: var(--radius-sm); padding: var(--space-3); margin-bottom: var(--space-3); font-size: var(--text-base); line-height: 1.6;">';
  html += '      <strong style="color: var(--life-accent);">This context is shared with ALL coaches.</strong><br>';
  html += '      Include things like: your background, lifestyle, constraints, preferences, health conditions, family situation, work schedule, etc.';
  html += '    </div>';
  html += '    <div class="identity-field-group">';
  html += '      <textarea class="identity-textarea" id="lifeAboutMe" rows="6" placeholder="Tell your AI coaches about yourself...\n\nExamples:\n• I\'m a 35-year-old entrepreneur with 2 kids\n• I have ADHD and work best with structured routines\n• I\'m vegetarian and lactose intolerant\n• I work from home, usually 9am-6pm\n• My partner\'s name is Alex" onblur="saveLifeAboutMe(this.value)">' + escapeHtml(aboutMe) + '</textarea>';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';
  
  // v11.0.5: Coach-Specific Context Card
  var coachContexts = profile.coachContexts || {};
  var coaches = [
    { id: 'personal', name: 'Personal Assistant', icon: '◇', hint: 'General preferences, daily routines, how you like tasks organized' },
    { id: 'coach', name: 'Life Coach', icon: '◆', hint: 'Career aspirations, personal challenges, growth areas, accountability preferences' },
    { id: 'wellness', name: 'Wellness Guide', icon: '❤', hint: 'Health conditions, fitness level, dietary restrictions, sleep patterns, medications' },
    { id: 'taxintelligence', name: 'Tax Intelligence', icon: '$', hint: 'Business structure, income sources, investment accounts, past tax issues' }
  ];
  
  html += '<div class="identity-card" data-section="life-coach-context">';
  html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)">';
  html += '    <div class="identity-card-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>';
  html += '    <div class="identity-card-title">';
  html += '      <h3>Coach-Specific Context</h3>';
  html += '      <p>Additional context for specific coaches</p>';
  html += '    </div>';
  html += '    <svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  html += '  </div>';
  html += '  <div class="identity-card-body">';
  html += '    <div style="color: var(--text-secondary); font-size: var(--text-base); margin-bottom: var(--space-4);">Add specialized context that only specific coaches need. This is in addition to your "About Me" which all coaches receive.</div>';
  
  coaches.forEach(function(coach) {
    var contextValue = coachContexts[coach.id] || '';
    html += '    <div class="identity-field-group" style="margin-bottom: var(--space-4); padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md);">';
    html += '      <div class="identity-field-label" style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">';
    html += '        <span style="color: var(--life-accent); font-weight: 600;">' + coach.icon + '</span>';
    html += '        <span style="font-weight: 600;">' + coach.name + '</span>';
    html += '        ' + (contextValue ? '<span style="font-size: var(--text-xs); background: var(--life-accent); color: #fff; padding: 2px 6px; border-radius: var(--radius-xs);">Has Context</span>' : '');
    html += '      </div>';
    html += '      <div style="font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-2);">' + coach.hint + '</div>';
    html += '      <textarea class="identity-textarea" id="coachContext_' + coach.id + '" rows="3" placeholder="Additional context for ' + coach.name + '..." onblur="saveCoachContext(\'' + coach.id + '\', this.value)" style="font-size: var(--text-base);">' + escapeHtml(contextValue) + '</textarea>';
    html += '    </div>';
  });
  
  html += '  </div>';
  html += '</div>';
  
  // v11.0.5: Cross-Mode Intelligence Summary Card
  // Shows what data each coach has access to
  var hasBrands = typeof brands !== 'undefined' && brands && brands.length > 0;
  var identityItemCount = 0;
  Object.keys(profile.identityData || {}).forEach(function(cat) {
    identityItemCount += (profile.identityData[cat] || []).length;
  });
  
  html += '<div class="identity-card" data-section="life-intelligence">';
  html += '  <div class="identity-card-header" onclick="toggleIdentityCard(this)">';
  html += '    <div class="identity-card-icon" style="color: var(--life-accent);"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>';
  html += '    <div class="identity-card-title">';
  html += '      <h3>Coach Intelligence</h3>';
  html += '      <p>What your coaches know about you</p>';
  html += '    </div>';
  html += '    <svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  html += '  </div>';
  html += '  <div class="identity-card-body">';
  
  // Summary stats
  html += '    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin-bottom: var(--space-5);">';
  html += '      <div style="text-align: center; padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md);">';
  html += '        <div style="font-size: var(--text-3xl); font-weight: 700; color: var(--life-accent);">' + identityItemCount + '</div>';
  html += '        <div style="font-size: var(--text-sm); color: var(--text-muted);">Identity Items</div>';
  html += '      </div>';
  html += '      <div style="text-align: center; padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md);">';
  html += '        <div style="font-size: var(--text-3xl); font-weight: 700; color: #a89878;">' + (hasBrands ? brands.length : 0) + '</div>';
  html += '        <div style="font-size: var(--text-sm); color: var(--text-muted);">Brands</div>';
  html += '      </div>';
  html += '      <div style="text-align: center; padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md);">';
  html += '        <div style="font-size: var(--text-3xl); font-weight: 700; color: var(--text-primary);">4</div>';
  html += '        <div style="font-size: var(--text-sm); color: var(--text-muted);">AI Coaches</div>';
  html += '      </div>';
  html += '    </div>';
  
  // Coach intelligence breakdown
  var coachIntelligence = [
    { 
      id: 'personal', 
      name: 'Personal Assistant', 
      icon: '◇',
      gets: ['Health', 'Family', 'Work', 'Personal', 'Brands/Projects'],
      desc: 'Full picture for daily assistance'
    },
    { 
      id: 'coach', 
      name: 'Life Coach', 
      icon: '◆',
      gets: ['Work', 'Personal', 'Family', 'Business Ventures'],
      desc: 'Career and life goals context'
    },
    { 
      id: 'wellness', 
      name: 'Wellness Guide', 
      icon: '❤',
      gets: ['Health', 'Personal', 'Work Schedule', 'Family Time'],
      desc: 'Holistic health with lifestyle factors'
    },
    { 
      id: 'taxintelligence', 
      name: 'Tax Intelligence', 
      icon: '$',
      gets: ['Tax', 'Work', 'Personal', 'All Businesses (from BrandAI)'],
      desc: 'Complete financial picture'
    }
  ];
  
  html += '    <div style="font-weight: 600; margin-bottom: var(--space-3); color: var(--text-primary);">Each coach receives relevant data:</div>';
  
  coachIntelligence.forEach(function(coach) {
    var hasCoachContext = profile.coachContexts && profile.coachContexts[coach.id];
    html += '    <div style="padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md); margin-bottom: var(--space-2);">';
    html += '      <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: 6px;">';
    html += '        <span style="color: var(--life-accent); font-weight: 600;">' + coach.icon + '</span>';
    html += '        <span style="font-weight: 600;">' + coach.name + '</span>';
    if (hasCoachContext) {
      html += '        <span style="font-size: var(--text-2xs); background: var(--life-accent); color: #fff; padding: 1px 4px; border-radius: 3px;">+ Custom</span>';
    }
    html += '      </div>';
    html += '      <div style="font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-1);">' + coach.desc + '</div>';
    html += '      <div style="display: flex; flex-wrap: wrap; gap: var(--space-1);">';
    coach.gets.forEach(function(item) {
      var isBrandRelated = item.includes('Brand') || item.includes('Business');
      var bgColor = isBrandRelated ? 'rgba(212, 175, 55, 0.15)' : 'var(--life-accent-10, rgba(34, 197, 94, 0.1))';
      var borderColor = isBrandRelated ? 'rgba(212, 175, 55, 0.3)' : 'var(--life-accent-30, rgba(34, 197, 94, 0.3))';
      html += '        <span style="font-size: var(--text-xs); padding: 2px 6px; background: ' + bgColor + '; border: 1px solid ' + borderColor + '; border-radius: var(--radius-xs);">' + item + '</span>';
    });
    html += '      </div>';
    html += '    </div>';
  });
  
  // Cross-mode note
  if (hasBrands) {
    html += '    <div style="margin-top: var(--space-4); padding: var(--space-3); background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: var(--radius-md); font-size: var(--text-sm);">';
    html += '      <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: 6px;">';
    html += '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a89878" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    html += '        <strong style="color: #a89878;">Cross-Mode Intelligence Active</strong>';
    html += '      </div>';
    html += '      <div style="color: var(--text-secondary);">Your <strong>' + brands.length + ' BrandAI brand' + (brands.length > 1 ? 's' : '') + '</strong> (' + brands.map(function(b) { return b.name; }).join(', ') + ') are automatically shared with Tax Intelligence and Life Coach for complete business context.</div>';
    html += '    </div>';
  } else {
    html += '    <div style="margin-top: var(--space-4); padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--text-muted);">';
    html += '      <strong>Tip:</strong> Add brands in BrandAI mode to unlock cross-mode intelligence. Your Tax Intelligence and Life Coach will automatically see your business information.';
    html += '    </div>';
  }
  
  html += '  </div>';
  html += '</div>';
  
  return html;
}

// v10.5.25: Refine Life Identity section with AI
function refineLifeIdentityWithAI(section, sectionName) {
  var profile = getCurrentLifeProfile();
  if (!profile) {
    showToast('No life profile found', 'error');
    return;
  }
  
  // Build context for the AI
  var context = 'User Name: ' + (profile.name || 'Unknown') + '\n';
  context += 'Focus Areas: ' + (profile.lifeAreas || []).map(function(a) {
    return LIFE_AREAS[a] ? LIFE_AREAS[a].name : a;
  }).join(', ') + '\n';
  context += 'Goals: ' + (profile.goals || []).map(function(g) { return g.title; }).join(', ') + '\n';
  context += 'Communication Style: ' + (profile.preferences?.communicationStyle || 'Not set') + '\n';
  context += 'Productive Time: ' + (profile.preferences?.productiveTime || 'Not set') + '\n';
  
  // v11.0.5: Include structured identity data for the specific category
  var identityData = profile.identityData || {};
  var categoryData = identityData[section] || [];
  if (categoryData.length > 0) {
    context += '\n' + sectionName + ' Data:\n';
    categoryData.forEach(function(item) {
      context += '- ' + (item.type ? item.type + ': ' : '') + item.value + '\n';
    });
  }
  
  // Include About Me if available
  if (profile.aboutMe) {
    context += '\nAbout Me:\n' + profile.aboutMe + '\n';
  }
  
  // v11.0.5: Category-specific prompts
  var categoryPrompts = {
    health: 'Based on the health information provided, give personalized wellness insights. Consider:\n- Any health conditions and their implications\n- Medication interactions or lifestyle considerations\n- Dietary needs and restrictions\n- Recommendations for maintaining or improving health\nBe supportive and health-positive. Do NOT provide medical diagnoses - suggest consulting professionals when appropriate.',
    
    family: 'Based on the family information provided, give insights on:\n- Work-life balance considerations\n- Family scheduling and priorities\n- Relationship dynamics\n- Tips for managing family responsibilities\nBe warm and family-positive.',
    
    work: 'Based on the work information provided, give career and productivity insights on:\n- Work-life integration strategies\n- Schedule optimization\n- Career development opportunities\n- Managing professional responsibilities\nBe encouraging and practical.',
    
    personal: 'Based on the personal traits and preferences shared, provide insights on:\n- How these traits affect daily life\n- Strategies that work well for this personality type\n- Self-awareness tips\n- Ways to leverage personal strengths\nBe understanding and empowering.',
    
    tax: 'Based on the tax and financial information provided, give high-level insights on:\n- Tax planning considerations for the business structure\n- Common deductions to track\n- Record-keeping best practices\n- Financial organization tips\nRemind them you are not a tax professional and to consult a CPA for specific advice.'
  };
  
  var categorySpecificPrompt = categoryPrompts[section] || 'Provide helpful insights and personalized advice for the "' + sectionName + '" section.';
  
  var prompt = 'You are LifeAI, a personal life intelligence assistant. Based on this user profile:\n\n' + context + '\n\n' + categorySpecificPrompt + '\n\nBe warm, supportive, and actionable. Keep it concise (2-3 short paragraphs max). Format with clear, readable sections.';
  
  // Show loading state
  var notesEl = document.getElementById('life-' + section + '-ai-notes');
  if (notesEl) {
    notesEl.innerHTML = '<em style="color: var(--text-muted);">Analyzing with LifeAI...</em>';
    notesEl.contentEditable = 'false';
  }
  
  // Call the AI
  executeLifeAIAnalysis(prompt, section);
}

// v15.16: Format AI insights text to HTML (bold, italic, bullets, paragraphs)
function formatAIInsights(text) {
  if (!text) return '';
  var html = escapeHtml(text);
  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic: *text* or _text_
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Bullet lists: lines starting with - or *
  html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  // Numbered lists: lines starting with 1. 2. etc
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Paragraphs: double newlines
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  // Single newlines within paragraphs to <br>
  html = html.replace(/\n/g, '<br>');
  return html;
}

// Execute LifeAI analysis
// v15.14: Use getApiKey() for proper key retrieval, support all providers
async function executeLifeAIAnalysis(prompt, section) {
  try {
    var provider = localStorage.getItem('selectedProvider') || 'anthropic';
    var response = '';

    if (provider === 'anthropic') {
      var apiKey = await getApiKey('anthropic');
      if (!apiKey) {
        showToast('Please add your Anthropic API key in Settings', 'error');
        resetLifeAITextarea(section);
        return;
      }

      var res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      var data = await res.json();
      if (data.content && data.content[0]) {
        response = data.content[0].text;
      }
    } else if (provider === 'openai') {
      var apiKey = await getApiKey('openai');
      if (!apiKey) {
        showToast('Please add your OpenAI API key in Settings', 'error');
        resetLifeAITextarea(section);
        return;
      }

      var res = await fetch('https://api.openai.com/v1/responses', { // v22.18: Responses API
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: 'gpt-5.5',
          input: [{ role: 'user', content: prompt }],
          max_output_tokens: 1024,
          store: false
        })
      });

      var data = await res.json();
      if (data.output_text) {
        response = data.output_text; // v22.18: Responses API format
      }
    } else if (provider === 'google' || provider === 'gemini') {
      var apiKey = await getApiKey('google');
      if (!apiKey) {
        showToast('Please add your Google API key in Settings', 'error');
        resetLifeAITextarea(section);
        return;
      }
      var geminiModel = 'gemini-2.5-flash';
      var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + geminiModel + ':generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024 }
        })
      });
      var data = await res.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        data.candidates[0].content.parts.forEach(function(p) { if (p.text) response += p.text; });
      }
    }
    
    // v15.16: Update rich text div with formatted response
    var notesEl = document.getElementById('life-' + section + '-ai-notes');
    if (notesEl) {
      notesEl.innerHTML = formatAIInsights(response);
      notesEl.contentEditable = 'true';
      saveLifeAIInsightField(section, response);
    }
    
    // v11.0.5: Refresh the identity view to show updated badges
    renderLifeIdentityView();
    
    showToast('LifeAI analysis complete', 'success');
    
  } catch (error) {
    console.error('[LifeAI] Analysis failed:', error);
    showToast('Analysis failed: ' + error.message, 'error');
    resetLifeAITextarea(section);
  }
}

function resetLifeAITextarea(section) {
  var notesEl = document.getElementById('life-' + section + '-ai-notes');
  if (notesEl) {
    notesEl.innerHTML = '';
    notesEl.contentEditable = 'true';
  }
}

// Save LifeAI insight field
function saveLifeAIInsightField(section, value) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  
  if (profiles[currentIdx]) {
    if (!profiles[currentIdx].aiInsights) {
      profiles[currentIdx].aiInsights = {};
    }
    profiles[currentIdx].aiInsights[section] = value;
    saveLifeProfiles(profiles);
  }
}

// v15.16: Refine LifeAI identity section via conversation (mirrors BrandAI refine pattern)
function refineLifeIdentityConversation(section, sectionName) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  if (!profile) {
    showToast('No life profile found', 'error');
    return;
  }

  // Get current AI insights for this section
  var currentInsights = (profile.aiInsights && profile.aiInsights[section]) || '';
  // Get identity data items for context
  var dataItems = (profile.identityData && profile.identityData[section]) || [];
  var dataContext = dataItems.map(function(item) { return (item.type || '') + ': ' + (item.value || ''); }).join(', ');

  // Store refine context
  window.lifeIdentityRefineContext = {
    section: section,
    sectionName: sectionName,
    profileIdx: currentIdx
  };

  // Build prompt
  var prompt = 'I want to refine my ' + sectionName + ' insights in LifeAI.';
  if (currentInsights) {
    prompt += '\n\nHere are my current AI-generated insights:\n\n"' + currentInsights + '"';
  }
  if (dataContext) {
    prompt += '\n\nMy current data: ' + dataContext;
  }
  if (currentInsights) {
    prompt += '\n\nLet\'s discuss how to improve and expand on these insights. Ask me questions to better understand my situation.';
  } else {
    prompt += '\n\nI don\'t have any insights yet for this area. Help me build a comprehensive picture by asking me some questions.';
  }

  // Switch to LifeAI Chat
  if (localStorage.getItem('roweos_app_mode') !== 'life') {
    switchToLifeMode();
  }
  showView('agent');
  newConversation();

  setTimeout(function() {
    var inputField = document.getElementById('agentCommand');
    if (inputField) {
      inputField.value = prompt;
      inputField.style.height = 'auto';
      inputField.style.height = Math.min(inputField.scrollHeight, 200) + 'px';
      inputField.focus();
    }
    showToast('Discuss with LifeAI, then click "Apply to Identity" when ready', 'info');
  }, 100);

  setTimeout(function() {
    addApplyToLifeIdentityButton(section, sectionName);
  }, 200);
}

// v15.16: Add "Apply to Identity" button for LifeAI refine conversations
function addApplyToLifeIdentityButton(section, sectionName) {
  if (document.getElementById('applyToLifeIdentityBtn')) return;

  var followupContainer = document.getElementById('agentConversation');
  var chatInput = followupContainer ? followupContainer.querySelector('.chat-input-v2') : null;
  if (!chatInput) return;

  var btn = document.createElement('button');
  btn.id = 'applyToLifeIdentityBtn';
  btn.className = 'identity-apply-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Apply to ' + escapeHtml(sectionName);
  btn.onclick = function() {
    generateLifeApplyPreview(section, sectionName);
  };

  var isLightMode = document.documentElement.classList.contains('light-mode');
  var bgColor = isLightMode ? '#f0f0f0' : '#2a2a2f';
  btn.style.cssText = 'position: absolute; top: -44px; right: 0; padding: 8px 14px; background: ' + bgColor + '; border: 1px solid #22c55e; border-radius: var(--radius-md); color: #22c55e; font-size: var(--text-sm); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease; z-index: 10;';
  btn.onmouseenter = function() { btn.style.background = '#22c55e'; btn.style.color = '#fff'; };
  btn.onmouseleave = function() { btn.style.background = bgColor; btn.style.color = '#22c55e'; };

  chatInput.style.position = 'relative';
  chatInput.appendChild(btn);
}

// v15.16: Generate summary from LifeAI conversation and apply to identity section
async function generateLifeApplyPreview(section, sectionName) {
  var ctx = window.lifeIdentityRefineContext;
  if (!ctx) {
    showToast('No refine context found', 'error');
    return;
  }

  // Collect conversation messages
  var messages = currentConversation || [];
  if (messages.length < 2) {
    showToast('Have a conversation first, then apply', 'info');
    return;
  }

  var conversationText = messages.map(function(m) {
    return (m.role === 'user' ? 'User' : 'LifeAI') + ': ' + (m.content || '').substring(0, 2000);
  }).join('\n\n');

  showToast('Generating insights from conversation...', 'info');

  var summaryPrompt = 'Based on this conversation about the user\'s ' + sectionName + ', write a concise, personalized summary of insights and recommendations. Focus on actionable, specific details. Write in second person ("You..."). Keep it to 2-3 paragraphs. Use bullet points for key items.\n\nConversation:\n' + conversationText.substring(0, 8000);

  try {
    var provider = localStorage.getItem('selectedProvider') || 'anthropic';
    var response = '';

    if (provider === 'anthropic') {
      var apiKey = await getApiKey('anthropic');
      if (!apiKey) { showToast('No API key', 'error'); return; }
      var res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [{ role: 'user', content: summaryPrompt }] })
      });
      var data = await res.json();
      if (data.content && data.content[0]) response = data.content[0].text;
    } else if (provider === 'openai') {
      var apiKey = await getApiKey('openai');
      if (!apiKey) { showToast('No API key', 'error'); return; }
      var res = await fetch('https://api.openai.com/v1/responses', { // v22.18: Responses API
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ model: 'gpt-5.5', input: [{ role: 'user', content: summaryPrompt }], max_output_tokens: 1024, store: false })
      });
      var data = await res.json();
      if (data.output_text) response = data.output_text; // v22.18: Responses API
    } else if (provider === 'google' || provider === 'gemini') {
      var apiKey = await getApiKey('google');
      if (!apiKey) { showToast('No API key', 'error'); return; }
      var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }], generationConfig: { maxOutputTokens: 1024 } })
      });
      var data = await res.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        data.candidates[0].content.parts.forEach(function(p) { if (p.text) response += p.text; });
      }
    }

    if (!response) {
      showToast('Failed to generate summary', 'error');
      return;
    }

    // Save to profile
    saveLifeAIInsightField(section, response);

    // Remove the Apply button
    var applyBtn = document.getElementById('applyToLifeIdentityBtn');
    if (applyBtn) applyBtn.remove();

    // Clear refine context
    window.lifeIdentityRefineContext = null;

    showToast(sectionName + ' updated from conversation!', 'success');

    // Switch back to Identity view
    setTimeout(function() {
      showView('memory');
      var card = document.querySelector('.identity-card[data-section="life-' + section + '"]');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.transition = 'box-shadow 0.3s ease';
        card.style.boxShadow = '0 0 0 2px #22c55e';
        setTimeout(function() { card.style.boxShadow = 'none'; }, 2000);
      }
    }, 300);

  } catch (error) {
    console.error('[LifeAI Refine] Error:', error);
    showToast('Failed to apply: ' + error.message, 'error');
  }
}

// v12.0.0: escapeHtml moved to utils.escapeHtml (alias at top of JS section)

// Toggle life area in Identity view
function toggleLifeIdentityArea(btn, areaKey) {
  btn.classList.toggle('selected');
  
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  
  if (profiles[currentIdx]) {
    var areas = profiles[currentIdx].lifeAreas || [];
    
    if (btn.classList.contains('selected')) {
      if (!areas.includes(areaKey)) {
        areas.push(areaKey);
      }
    } else {
      areas = areas.filter(function(a) { return a !== areaKey; });
    }
    
    profiles[currentIdx].lifeAreas = areas;
    saveLifeProfiles(profiles);
    
    // Update card subtitle
    var card = btn.closest('.identity-card');
    if (card) {
      var subtitle = card.querySelector('.identity-card-title p');
      if (subtitle) subtitle.textContent = areas.length + ' areas selected';
    }
  }
}

// Select communication style
function selectLifeCommStyle(styleKey) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  
  if (profiles[currentIdx]) {
    if (!profiles[currentIdx].preferences) profiles[currentIdx].preferences = {};
    profiles[currentIdx].preferences.communicationStyle = styleKey;
    saveLifeProfiles(profiles);
    
    // Update UI
    document.querySelectorAll('.life-identity-style-option').forEach(function(btn) {
      btn.classList.remove('selected');
    });
    event.target.closest('.life-identity-style-option').classList.add('selected');
    
    // Update card subtitle
    var styles = { supportive: 'Supportive', direct: 'Direct', coach: 'Coach', analytical: 'Analytical' };
    var card = event.target.closest('.identity-card');
    if (card) {
      var subtitle = card.querySelector('.identity-card-title p');
      if (subtitle) subtitle.textContent = styles[styleKey] || styleKey;
    }
    
    showToast('Communication style updated', 'success');
  }
}

// Select daily rhythm
function selectLifeRhythm(rhythmKey) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  
  if (profiles[currentIdx]) {
    if (!profiles[currentIdx].preferences) profiles[currentIdx].preferences = {};
    profiles[currentIdx].preferences.productiveTime = rhythmKey;
    saveLifeProfiles(profiles);
    
    // Update UI
    document.querySelectorAll('.life-identity-rhythm-option').forEach(function(btn) {
      btn.classList.remove('selected');
    });
    event.target.closest('.life-identity-rhythm-option').classList.add('selected');
    
    // Update card subtitle
    var rhythms = { early: 'Early Bird · 5am - 9am', morning: 'Morning Person · 9am - 12pm', afternoon: 'Afternoon Focus · 12pm - 5pm', evening: 'Night Owl · 5pm - Late' };
    var card = event.target.closest('.identity-card');
    if (card) {
      var subtitle = card.querySelector('.identity-card-title p');
      if (subtitle) subtitle.textContent = rhythms[rhythmKey] || rhythmKey;
    }
    
    showToast('Daily rhythm updated', 'success');
  }
}

// Update profile field
function updateCurrentLifeProfileField(field, value) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  
  if (profiles[currentIdx]) {
    profiles[currentIdx][field] = value;
    saveLifeProfiles(profiles);
    
    // Update sidebar name if name changed
    if (field === 'name') {
      var sidebarName = document.getElementById('sidebarBrandName');
      if (sidebarName) {
        sidebarName.innerHTML = value + ' <span class="sidebar-brand-arrow">▾</span>';
      }
    }
    
    showToast('Profile updated', 'success');
  }
}

// Delete goal
function deleteLifeGoal(goalIdx) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  
  if (profiles[currentIdx] && profiles[currentIdx].goals) {
    profiles[currentIdx].goals.splice(goalIdx, 1);
    saveLifeProfiles(profiles);
    renderLifeIdentityView();
    showToast('Goal deleted', 'success');
  }
}

/**
 * v11.0.5: Save "About Me" personal context
 * This context is injected into ALL LifeAI coach prompts
 */
function saveLifeAboutMe(value) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  
  if (profiles[currentIdx]) {
    profiles[currentIdx].aboutMe = value;
    saveLifeProfiles(profiles);
    console.log('[LifeAI] About Me saved:', value.substring(0, 50) + '...');
  }
}

/**
 * v11.0.5: Save coach-specific context
 * @param coachId - personal, coach, wellness, taxintelligence
 * @param value - the context string
 */
function saveCoachContext(coachId, value) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  
  if (profiles[currentIdx]) {
    if (!profiles[currentIdx].coachContexts) {
      profiles[currentIdx].coachContexts = {};
    }
    profiles[currentIdx].coachContexts[coachId] = value;
    saveLifeProfiles(profiles);
    console.log('[LifeAI] Coach context saved for ' + coachId + ':', value.substring(0, 50) + '...');
  }
}

/**
 * v11.0.5: Get user knowledge for a specific coach
 * Returns combined "About Me" + structured identity data + coach-specific context
 */
function getLifeAIUserKnowledge(coachId) {
  var profile = getCurrentLifeProfile();
  if (!profile) return '';
  
  var knowledge = '';
  
  // Add About Me (shared with all coaches)
  if (profile.aboutMe && profile.aboutMe.trim()) {
    knowledge += 'ABOUT THE USER:\n' + profile.aboutMe.trim() + '\n\n';
  }
  
  // v11.0.5: Add structured identity data
  var identityData = profile.identityData || {};
  var categoryLabels = {
    health: 'Health & Wellness',
    family: 'Family & Relationships',
    work: 'Work & Career',
    personal: 'Personal Details',
    tax: 'Tax & Financial'
  };
  
  // Determine which categories are relevant for each coach
  var relevantCategories = {
    personal: ['health', 'family', 'work', 'personal'],
    coach: ['work', 'personal', 'family'],
    wellness: ['health', 'personal', 'work'], // v11.0.5: Added work for schedule awareness
    taxintelligence: ['tax', 'work', 'personal']
  };
  
  var categoriesToInclude = relevantCategories[coachId] || Object.keys(categoryLabels);
  
  categoriesToInclude.forEach(function(catId) {
    var items = identityData[catId] || [];
    if (items.length > 0) {
      knowledge += categoryLabels[catId].toUpperCase() + ':\n';
      items.forEach(function(item) {
        knowledge += '- ' + (item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) + ': ' : '') + item.value + '\n';
      });
      knowledge += '\n';
    }
  });
  
  // v11.0.5: CROSS-MODE INTELLIGENCE - Pull data from BrandAI brands
  var brandIntelligence = getCrossModeIntelligence(coachId);
  if (brandIntelligence) {
    knowledge += brandIntelligence;
  }
  
  // v15.25: Inject LifeAI document insights into coach knowledge
  try {
    var lifeMemory = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
    var lifeDocs = lifeMemory.documents || [];
    var docInsights = [];
    lifeDocs.forEach(function(doc) {
      if (doc.processed && doc.insights && doc.insights.length > 0) {
        doc.insights.forEach(function(insight) {
          var isRelevant = true;
          if (coachId === 'wellness' && insight.category && ['finance', 'work'].indexOf(insight.category) !== -1) isRelevant = false;
          if (coachId === 'taxintelligence' && insight.category && ['health', 'relationships'].indexOf(insight.category) !== -1) isRelevant = false;
          if (isRelevant) {
            docInsights.push((insight.category ? '[' + insight.category + '] ' : '') + (insight.title ? insight.title + ': ' : '') + (insight.content || ''));
          }
        });
      }
    });
    if (docInsights.length > 0) {
      knowledge += 'DOCUMENT INTELLIGENCE (from uploaded documents):\n';
      docInsights.slice(-30).forEach(function(di) {
        knowledge += '- ' + di + '\n';
      });
      knowledge += '\n';
    }
  } catch(e) { console.warn('[LifeAI] Error loading document insights:', e); }

  // Add coach-specific context if available
  if (profile.coachContexts && profile.coachContexts[coachId] && profile.coachContexts[coachId].trim()) {
    var coachNames = {
      personal: 'Personal Assistant',
      coach: 'Life Coach',
      wellness: 'Wellness Guide',
      taxintelligence: 'Tax Intelligence'
    };
    knowledge += 'ADDITIONAL CONTEXT FOR ' + (coachNames[coachId] || coachId).toUpperCase() + ':\n' + profile.coachContexts[coachId].trim() + '\n\n';
  }
  
  return knowledge;
}

/**
 * v11.0.5: Get cross-mode intelligence from BrandAI brands
 * Different coaches get different relevant brand data
 */
function getCrossModeIntelligence(coachId) {
  // Only certain coaches benefit from brand data
  var coachesThatUseBrandData = ['taxintelligence', 'coach', 'personal'];
  if (!coachesThatUseBrandData.includes(coachId)) return '';
  
  // Check if brands exist
  if (typeof brands === 'undefined' || !brands || brands.length === 0) return '';
  
  var intelligence = '';
  
  // Tax Intelligence: Needs detailed business information
  if (coachId === 'taxintelligence') {
    intelligence += 'USER\'S BUSINESSES (from BrandAI):\n';
    brands.forEach(function(brand, idx) {
      if (!brand || !brand.name) return;
      
      intelligence += '\n' + (idx + 1) + '. ' + brand.name + '\n';
      
      // Business type/industry
      if (brand.industry) {
        intelligence += '   - Industry: ' + brand.industry + '\n';
      }
      
      // Entity type if specified in brand settings
      var settings = brandSettings[idx] || {};
      if (settings.entityType) {
        intelligence += '   - Entity Type: ' + settings.entityType + '\n';
      }
      
      // Tagline/description gives context
      if (brand.tagline) {
        intelligence += '   - Description: ' + brand.tagline + '\n';
      }
      
      // Brand voice/positioning for understanding business nature
      if (brand.positioning) {
        intelligence += '   - Positioning: ' + brand.positioning + '\n';
      }
    });
    intelligence += '\n';
  }
  
  // Life Coach: Needs career/business context
  if (coachId === 'coach') {
    var businessNames = brands.map(function(b) { return b.name; }).filter(function(n) { return n; });
    if (businessNames.length > 0) {
      intelligence += 'USER\'S BUSINESS VENTURES:\n';
      intelligence += 'The user owns/operates: ' + businessNames.join(', ') + '\n\n';
    }
  }
  
  // Personal Assistant: Needs to know about all brands for context
  if (coachId === 'personal') {
    if (brands.length > 0) {
      intelligence += 'USER\'S BRANDS/PROJECTS:\n';
      brands.forEach(function(brand) {
        if (brand && brand.name) {
          intelligence += '- ' + brand.name + (brand.tagline ? ': ' + brand.tagline : '') + '\n';
        }
      });
      intelligence += '\n';
    }
  }
  
  return intelligence;
}

/**
 * v11.0.5: Get Wellness-relevant data from work schedule and family
 * Called by Wellness Guide for holistic health advice
 */
function getWellnessContext() {
  var profile = getCurrentLifeProfile();
  if (!profile) return '';
  
  var context = '';
  var identityData = profile.identityData || {};
  
  // Work schedule affects wellness recommendations
  var work = identityData.work || [];
  work.forEach(function(item) {
    if (item.type === 'schedule') {
      context += 'WORK SCHEDULE: ' + item.value + '\n';
    }
  });
  
  // Family responsibilities affect available time for wellness
  var family = identityData.family || [];
  var hasKids = family.some(function(item) { return item.type === 'children'; });
  if (hasKids) {
    var kidInfo = family.find(function(item) { return item.type === 'children'; });
    if (kidInfo) {
      context += 'FAMILY: Has children (' + kidInfo.value + ') - consider time constraints\n';
    }
  }
  
  // Productive time affects when to suggest activities
  if (profile.preferences && profile.preferences.productiveTime) {
    var timeLabels = {
      early: 'Early morning (5am-9am)',
      morning: 'Morning (9am-12pm)',
      afternoon: 'Afternoon (12pm-5pm)',
      evening: 'Evening (5pm+)'
    };
    context += 'PEAK ENERGY: ' + (timeLabels[profile.preferences.productiveTime] || profile.preferences.productiveTime) + '\n';
  }
  
  return context ? '\nLIFESTYLE FACTORS:\n' + context + '\n' : '';
}

/**
 * v11.0.5: Add item to Identity data
 */
function addIdentityDataItem(categoryId) {
  var typeSelect = document.getElementById('identityType_' + categoryId);
  var valueInput = document.getElementById('identityValue_' + categoryId);
  
  if (!typeSelect || !valueInput) return;
  
  var type = typeSelect.value;
  var value = valueInput.value.trim();
  
  if (!value) {
    showToast('Please enter a value', 'warning');
    return;
  }
  
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  
  if (!profile) return;
  
  // Initialize identityData if needed
  if (!profile.identityData) profile.identityData = {};
  if (!profile.identityData[categoryId]) profile.identityData[categoryId] = [];
  
  // Check for duplicates
  var exists = profile.identityData[categoryId].some(function(item) {
    return item.value.toLowerCase() === value.toLowerCase() && item.type === type;
  });
  
  if (exists) {
    showToast('This item already exists', 'warning');
    return;
  }
  
  // Add the item
  profile.identityData[categoryId].push({
    type: type,
    value: value,
    addedAt: new Date().toISOString(),
    source: 'manual'
  });
  
  saveLifeProfiles(profiles);

  // Clear input and refresh
  valueInput.value = '';
  // v15.15: Use correct render function for LifeAI identity
  if (typeof renderLifeIdentityView === 'function') {
    renderLifeIdentityView();
  }
  showToast('Added to ' + categoryId, 'success');
}

/**
 * v11.0.5: Remove item from Identity data
 */
function removeIdentityDataItem(categoryId, index) {
  var profiles = getLifeProfiles();
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  var profile = profiles[currentIdx];
  
  if (!profile || !profile.identityData || !profile.identityData[categoryId]) return;
  
  var item = profile.identityData[categoryId][index];
  if (!item) return;
  
  // Remove the item
  profile.identityData[categoryId].splice(index, 1);
  
  saveLifeProfiles(profiles);
  // v15.15: Use correct render function
  if (typeof renderLifeIdentityView === 'function') {
    renderLifeIdentityView();
  }
  showToast('Removed from ' + categoryId, 'success');
}

/**
 * v11.0.5: Get total Identity data count
 */
function getIdentityDataCount() {
  var profile = getCurrentLifeProfile();
  if (!profile || !profile.identityData) return 0;
  
  var count = 0;
  Object.keys(profile.identityData).forEach(function(cat) {
    count += (profile.identityData[cat] || []).length;
  });
  return count;
}

