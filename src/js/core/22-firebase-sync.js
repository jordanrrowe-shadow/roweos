// ═══════════════════════════════════════════════════════════════════════════════
// v23.0: SYNC SAFETY — IndexedDB Snapshots + Backup Engine
// Pre-sync snapshots prevent data loss during cross-device conflicts
// ═══════════════════════════════════════════════════════════════════════════════

var _syncDB = null;
var _syncDBReady = false;
var _syncDBQueue = [];

// v23.0: All localStorage keys that loadFromFirebaseV2 can overwrite
var SNAPSHOT_KEYS = [
  'roweos_user_brands', 'roweos_user_brand_settings',
  'roweos_knowledge_0', 'roweos_knowledge_1', 'roweos_knowledge_2',
  'roweos_knowledge_3', 'roweos_knowledge_4', 'roweos_user_knowledge',
  'roweos_brand_memory', 'roweos_life_memory',
  'roweos_conversations', 'roweos_agentCommands', 'roweos_runs',
  'roweos_life_profiles', 'roweos_current_life_profile_idx', 'roweos_life_profile',
  'roweos_user_name', 'roweos_app_mode', 'roweos_life_main_prompt',
  'roweos_generated_life_ops', 'roweos_life_goals', 'roweos_life_routines', 'roweos_life_habits',
  'roweos_pulse_goals', 'roweos_pulse_journal', 'roweos_pulse_insights', 'roweos_pulse2_entries', 'roweos_reminders',
  'roweosTodos', 'roweos_calendar', 'roweos_life_todos', 'roweos_life_calendar',
  'roweos_automations', 'roweos_scheduled_tasks',
  'roweos_bloom_library', 'roweos_bloom_knowledge',
  'roweos_mail_outbox', 'roweos_mail_sent', 'roweos_mail_config',
  'roweos_mail_signatures', 'roweos_mail_drafts', 'roweos_mail_address_book',
  'roweos_auto_lab_history', 'roweos_completed_automations', 'roweos_task_history',
  'roweos_custom_operations', 'roweos_custom_agents', 'roweos_generated_brand_ops',
  'roweos_social_posts', 'roweos_social_workflows',
  'roweos_notifications', 'roweos_guardrails', 'roweos_identity_config',
  'roweos_theme', 'roweos_primary_brand', 'roweos_calendar_scope',
  'roweos_bloom_default_source', 'roweos_bloom_content_mode', 'roweos_bloom_length',
  'roweos_api_routing', 'roweos_sidebar_order', 'roweos_sidebar_mode', 'roweos_app_zoom', 'roweos_text_size',
  'roweosLibrary', 'roweos_life_library',
  'roweos_commerce', 'roweos_analytics',
  'roweos_api_budget_claude', 'roweos_api_budget_openai', 'roweos_api_budget_gemini',
  'roweos_custom_presets', // v24.25: Sync workflow presets across devices
  'roweos_promo_fonts' // v24.26: Sync promo font preference
];

function initSyncIndexedDB() {
  try {
    if (!window.indexedDB) { console.warn('[SyncDB] IndexedDB not available'); return; }
    var request = indexedDB.open('roweos_sync_v1', 1);
    request.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('snapshots')) {
        var snapStore = db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
        snapStore.createIndex('timestamp', 'timestamp', { unique: false });
        snapStore.createIndex('uid', 'uid', { unique: false });
      }
      if (!db.objectStoreNames.contains('backups')) {
        var backupStore = db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
        backupStore.createIndex('timestamp', 'timestamp', { unique: false });
        backupStore.createIndex('uid', 'uid', { unique: false });
      }
    };
    request.onsuccess = function(e) {
      _syncDB = e.target.result;
      _syncDBReady = true;
      console.log('[SyncDB] IndexedDB ready');
      for (var i = 0; i < _syncDBQueue.length; i++) {
        try { _syncDBQueue[i](); } catch(qe) { console.warn('[SyncDB] Queue callback error:', qe); }
      }
      _syncDBQueue = [];
    };
    request.onerror = function(e) {
      console.warn('[SyncDB] IndexedDB open failed:', e.target.error);
      _syncDB = null;
      _syncDBReady = true; // v25.0: Mark ready even on failure so queue callbacks can fire (they check _syncDB)
    };
  } catch(e) {
    console.warn('[SyncDB] IndexedDB init error:', e);
    _syncDB = null;
    _syncDBReady = true; // v25.0: Same — prevent queue from hanging forever
  }
}

function _whenSyncDBReady(cb) {
  if (_syncDBReady && _syncDB) { cb(); return; }
  if (!_syncDB && _syncDBReady) { return; } // DB failed, skip
  _syncDBQueue.push(cb);
}

// v23.1: Renamed to _syncIdb* to avoid colliding with existing _idb* (kv store at ~line 56164)
function _syncIdbPut(storeName, record, cb) {
  if (!_syncDB) { if (cb) cb(null); return; }
  try {
    var tx = _syncDB.transaction(storeName, 'readwrite');
    var store = tx.objectStore(storeName);
    var req = store.put(record);
    req.onsuccess = function() { if (cb) cb(req.result); };
    req.onerror = function() { console.warn('[SyncDB] Put error:', req.error); if (cb) cb(null); };
  } catch(e) { console.warn('[SyncDB] Put exception:', e); if (cb) cb(null); }
}

function _syncIdbGet(storeName, key, cb) {
  if (!_syncDB) { if (cb) cb(null); return; }
  try {
    var tx = _syncDB.transaction(storeName, 'readonly');
    var req = tx.objectStore(storeName).get(key);
    req.onsuccess = function() { cb(req.result || null); };
    req.onerror = function() { cb(null); };
  } catch(e) { cb(null); }
}

function _syncIdbGetAllByIndex(storeName, indexName, value, cb) {
  if (!_syncDB) { if (cb) cb([]); return; }
  try {
    var tx = _syncDB.transaction(storeName, 'readonly');
    var idx = tx.objectStore(storeName).index(indexName);
    var req = idx.getAll(value);
    req.onsuccess = function() { cb(req.result || []); };
    req.onerror = function() { cb([]); };
  } catch(e) { cb([]); }
}

function _syncIdbDelete(storeName, key, cb) {
  if (!_syncDB) { if (cb) cb(); return; }
  try {
    var tx = _syncDB.transaction(storeName, 'readwrite');
    var req = tx.objectStore(storeName).delete(key);
    req.onsuccess = function() { if (cb) cb(); };
    req.onerror = function() { if (cb) cb(); };
  } catch(e) { if (cb) cb(); }
}

// ─────────────────────────────────────────────────────────────────────
// v23.0: Pre-Sync Snapshot Engine
// Takes snapshots of all synced data BEFORE loadFromFirebaseV2() runs
// ─────────────────────────────────────────────────────────────────────

function takePreSyncSnapshot(label, cb) {
  if (!_syncDB) { if (cb) cb(null); return; }
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : 'local';
  var data = {};
  for (var i = 0; i < SNAPSHOT_KEYS.length; i++) {
    var val = localStorage.getItem(SNAPSHOT_KEYS[i]);
    if (val !== null) data[SNAPSHOT_KEYS[i]] = val;
  }
  var record = {
    uid: uid,
    timestamp: Date.now(),
    deviceId: deviceId || 'unknown',
    deviceType: (typeof getDeviceType === 'function') ? getDeviceType() : 'unknown',
    label: label || 'Pre-sync snapshot',
    data: data
  };
  _syncIdbPut('snapshots', record, function(id) {
    if (id) {
      localStorage.setItem('roweos_last_snapshot_id', String(id));
      console.log('[SyncDB] Snapshot saved, id=' + id + ', label="' + label + '"');
    }
    _purgeOldSnapshots(uid);
    if (cb) cb(id);
  });
}

function listSnapshots(cb) {
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : 'local';
  _syncIdbGetAllByIndex('snapshots', 'uid', uid, function(results) {
    results.sort(function(a, b) { return b.timestamp - a.timestamp; });
    cb(results);
  });
}

function restoreSnapshot(snapshotId, cb) {
  _syncIdbGet('snapshots', snapshotId, function(snapshot) {
    if (!snapshot || !snapshot.data) {
      showToast('Snapshot not found', 'error');
      if (cb) cb(false);
      return;
    }
    // Restore all keys from snapshot
    var keys = Object.keys(snapshot.data);
    for (var i = 0; i < keys.length; i++) {
      localStorage.setItem(keys[i], snapshot.data[keys[i]]);
    }
    // Clear any keys in SNAPSHOT_KEYS that weren't in the snapshot (they didn't exist then)
    for (var j = 0; j < SNAPSHOT_KEYS.length; j++) {
      if (!snapshot.data[SNAPSHOT_KEYS[j]]) {
        localStorage.removeItem(SNAPSHOT_KEYS[j]);
      }
    }
    stampLocalSave();
    console.log('[SyncDB] Snapshot ' + snapshotId + ' restored (' + keys.length + ' keys)');
    showToast('Data restored from snapshot: ' + snapshot.label, 'success');
    if (typeof reloadAllData === 'function') reloadAllData();
    if (cb) cb(true);
  });
}

function deleteSnapshot(snapshotId, cb) {
  _syncIdbDelete('snapshots', snapshotId, cb);
}

function _purgeOldSnapshots(uid) {
  _syncIdbGetAllByIndex('snapshots', 'uid', uid, function(results) {
    if (results.length <= 10) return;
    results.sort(function(a, b) { return b.timestamp - a.timestamp; });
    var cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    for (var i = 10; i < results.length; i++) {
      // v30.1: Remove redundant i >= 10 (loop already starts at 10, and this deleted ALL older snapshots)
      if (results[i].timestamp < cutoff) {
        _syncIdbDelete('snapshots', results[i].id);
      }
    }
  });
}

// v23.0: Undo Last Sync — restores the most recent snapshot
function undoLastSync() {
  var lastId = parseInt(localStorage.getItem('roweos_last_snapshot_id') || '0');
  if (!lastId) {
    showToast('No snapshot available to restore', 'info');
    return;
  }
  if (confirm('Undo Last Sync?\n\nThis will restore your data to the state before the last cloud pull. Any changes made since then will be lost.')) {
    restoreSnapshot(lastId);
  }
}

// ─────────────────────────────────────────────────────────────────────
// v23.0: Full Backup / Export Engine
// Downloads all RoweOS data as a structured JSON file
// ─────────────────────────────────────────────────────────────────────

// v23.0: All localStorage keys for complete backup (superset of SNAPSHOT_KEYS)
var BACKUP_KEYS_EXTRA = [
  'roweos_pinnedOps', 'roweos_recentOps',
  'roweos_social_outbox', 'roweos_pending_approval',
  'roweos_mail_outbox_folders', 'roweos_mail_deleted_ids',
  'roweos_todo_categories', 'roweos_life_todo_categories',
  'roweos_library_favorites', 'roweos_journal',
  'roweos_inventory', 'roweos_life_inventory',
  'roweos_sidebar_collapsed', 'roweos_default_view',
  'roweos_web_search_prefs', 'roweos_feature_autoPilot',
  'roweos_cross_mode_enabled', 'roweos_focus2_widget_order',
  'roweos_focus2_widget_sizes', 'roweos_focus2_category_order',
  'roweos_calendar_visibility', 'roweosStreak', 'roweosLastStreakDate',
  'roweosTodoFilterMode', 'roweos_task_view_mode',
  'roweos_life_accent_0', 'roweos_life_accent_1',
  'roweos_sync_settings', 'roweos_sync_categories',
  'roweos_onboarding_completed', 'roweos_data_version'
];

function createFullBackup() {
  var data = {};
  var allKeys = SNAPSHOT_KEYS.concat(BACKUP_KEYS_EXTRA);
  for (var i = 0; i < allKeys.length; i++) {
    var val = localStorage.getItem(allKeys[i]);
    if (val !== null) {
      try { data[allKeys[i]] = JSON.parse(val); } catch(e) { data[allKeys[i]] = val; }
    }
  }
  // Add bloom saved posts (dynamic keys)
  if (typeof brands !== 'undefined') {
    for (var bi = 0; bi < brands.length; bi++) {
      var shortName = (brands[bi].shortName || brands[bi].name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      var savedKey = 'roweos_bloom_saved_' + shortName;
      var sigKey = 'roweos_bloom_signals_' + shortName;
      var sv = localStorage.getItem(savedKey);
      var sg = localStorage.getItem(sigKey);
      if (sv) { try { data[savedKey] = JSON.parse(sv); } catch(e) { data[savedKey] = sv; } }
      if (sg) { try { data[sigKey] = JSON.parse(sg); } catch(e) { data[sigKey] = sg; } }
    }
  }
  return {
    version: ROWEOS_VERSION || 'v23.0',
    timestamp: Date.now(),
    date: new Date().toISOString(),
    device: (typeof getDeviceType === 'function') ? getDeviceType() : 'unknown',
    deviceId: deviceId || 'unknown',
    uid: (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : 'local',
    keyCount: Object.keys(data).length,
    data: data
  };
}

function downloadFullBackup() {
  try {
    var backup = createFullBackup();
    var json = JSON.stringify(backup, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = 'roweos-backup-' + dateStr + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded (' + backup.keyCount + ' data categories)', 'success');
    localStorage.setItem('roweos_last_manual_backup', String(Date.now()));
  } catch(e) {
    console.error('[Backup] Download failed:', e);
    showToast('Backup download failed: ' + e.message, 'error');
  }
}

function downloadCategoryBackup(category) {
  try {
    var categoryKeys = {
      library: ['roweosLibrary', 'roweos_life_library', 'roweos_library_favorites'],
      bloom: ['roweos_bloom_library', 'roweos_bloom_knowledge'],
      knowledge: ['roweos_knowledge_0', 'roweos_knowledge_1', 'roweos_knowledge_2', 'roweos_knowledge_3', 'roweos_knowledge_4', 'roweos_user_knowledge', 'roweos_brand_memory', 'roweos_identity_config'],
      conversations: ['roweos_conversations', 'roweos_agentCommands', 'roweos_runs'],
      automations: ['roweos_automations', 'roweos_scheduled_tasks', 'roweos_auto_lab_history'],
      mail: ['roweos_mail_outbox', 'roweos_mail_sent', 'roweos_mail_config', 'roweos_mail_signatures', 'roweos_mail_drafts', 'roweos_mail_address_book'],
      todos: ['roweosTodos', 'roweos_life_todos', 'roweos_todo_categories', 'roweos_life_todo_categories'],
      calendar: ['roweos_calendar', 'roweos_life_calendar'],
      brands: ['roweos_user_brands', 'roweos_user_brand_settings'],
      settings: ['roweos_theme', 'roweos_sidebar_collapsed', 'roweos_default_view', 'roweos_sync_settings', 'roweos_api_routing'],
      social: ['roweos_social_posts', 'roweos_social_workflows', 'roweos_social_outbox'],
      identity: ['roweos_user_brands', 'roweos_user_brand_settings', 'roweos_knowledge_0', 'roweos_knowledge_1', 'roweos_knowledge_2', 'roweos_knowledge_3', 'roweos_knowledge_4', 'roweos_user_knowledge', 'roweos_brand_memory', 'roweos_identity_config', 'roweos_guardrails']
    };
    var keys = categoryKeys[category];
    if (!keys) { showToast('Unknown category: ' + category, 'error'); return; }
    // Add dynamic bloom keys
    if (category === 'bloom' && typeof brands !== 'undefined') {
      for (var bi = 0; bi < brands.length; bi++) {
        var sn = (brands[bi].shortName || brands[bi].name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        keys.push('roweos_bloom_saved_' + sn);
        keys.push('roweos_bloom_signals_' + sn);
      }
    }
    var data = {};
    for (var i = 0; i < keys.length; i++) {
      var val = localStorage.getItem(keys[i]);
      if (val !== null) { try { data[keys[i]] = JSON.parse(val); } catch(e) { data[keys[i]] = val; } }
    }
    var backup = {
      version: ROWEOS_VERSION || 'v23.0',
      category: category,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      data: data
    };
    var json = JSON.stringify(backup, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'roweos-' + category + '-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(category.charAt(0).toUpperCase() + category.slice(1) + ' backup downloaded', 'success');
  } catch(e) {
    console.error('[Backup] Category download failed:', e);
    showToast('Export failed: ' + e.message, 'error');
  }
}

function importFullBackup(fileInput) {
  var file = fileInput && fileInput.files ? fileInput.files[0] : null;
  if (!file) { showToast('No file selected', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var backup = JSON.parse(e.target.result);
      if (!backup.data || !backup.version) {
        showToast('Invalid backup file - missing version or data', 'error');
        return;
      }
      var keyCount = Object.keys(backup.data).length;
      var dateStr = backup.date || new Date(backup.timestamp).toLocaleDateString();
      var msg = 'Restore backup from ' + dateStr + '?\n' + keyCount + ' data categories found.\nVersion: ' + backup.version + '\n\nThis will replace your current data. A snapshot will be taken first.';
      if (confirm(msg)) {
        _executeBackupImport(backup);
      }
    } catch(parseErr) {
      showToast('Invalid backup file: ' + parseErr.message, 'error');
    }
  };
  reader.readAsText(file);
}

function _executeBackupImport(backup) {
  // Take snapshot before import
  takePreSyncSnapshot('Before backup import ' + new Date().toLocaleString(), function() {
    var keys = Object.keys(backup.data);
    var restored = 0;
    for (var i = 0; i < keys.length; i++) {
      var val = backup.data[keys[i]];
      var toStore = (typeof val === 'string') ? val : JSON.stringify(val);
      localStorage.setItem(keys[i], toStore);
      restored++;
    }
    stampLocalSave();
    console.log('[Backup] Imported ' + restored + ' keys from backup');
    showToast('Backup restored! ' + restored + ' data categories imported.', 'success');
    if (typeof reloadAllData === 'function') reloadAllData();
  });
}

// ─────────────────────────────────────────────────────────────────────
// v23.9: Smart Restore — Add Brand, Merge, Full Overwrite
// ─────────────────────────────────────────────────────────────────────

var _pendingRestoreBackup = null;
var _restoreMode = 'merge';

// v23.9: Restore category definitions — maps display name to localStorage keys
var RESTORE_CATEGORIES = {
  brands: { label: 'Brands & Identity', keys: ['roweos_user_brands', 'roweos_user_brand_settings', 'roweos_identity_config', 'roweos_guardrails', 'roweos_primary_brand'] },
  knowledge: { label: 'Knowledge', keys: ['roweos_knowledge_0', 'roweos_knowledge_1', 'roweos_knowledge_2', 'roweos_knowledge_3', 'roweos_knowledge_4', 'roweos_user_knowledge', 'roweos_brand_memory', 'roweos_life_memory'] },
  automations: { label: 'Automations', keys: ['roweos_automations', 'roweos_scheduled_tasks', 'roweos_auto_lab_history', 'roweos_completed_automations', 'roweos_task_history'] },
  todos: { label: 'Focus Tasks', keys: ['roweosTodos', 'roweos_life_todos', 'roweos_todo_categories', 'roweos_life_todo_categories'] },
  pulse: { label: 'Pulse Goals', keys: ['roweos_pulse_goals', 'roweos_pulse_journal', 'roweos_pulse_insights', 'roweos_pulse2_entries', 'roweos_reminders'] },
  calendar: { label: 'Calendar', keys: ['roweos_calendar', 'roweos_life_calendar'] },
  conversations: { label: 'Conversations', keys: ['roweos_conversations', 'roweos_agentCommands', 'roweos_runs'] },
  library: { label: 'Library', keys: ['roweosLibrary', 'roweos_life_library', 'roweos_library_favorites'] },
  bloom: { label: 'Bloom', keys: ['roweos_bloom_library', 'roweos_bloom_knowledge'] },
  mail: { label: 'Mail', keys: ['roweos_mail_outbox', 'roweos_mail_sent', 'roweos_mail_config', 'roweos_mail_signatures', 'roweos_mail_drafts', 'roweos_mail_address_book'] },
  social: { label: 'Social', keys: ['roweos_social_posts', 'roweos_social_workflows', 'roweos_social_outbox'] },
  customOps: { label: 'Custom Operations', keys: ['roweos_custom_operations', 'roweos_custom_agents', 'roweos_generated_brand_ops'] },
  clients: { label: 'Clients', keys: ['roweos_clients'] },
  settings: { label: 'Settings', keys: ['roweos_theme', 'roweos_sidebar_order', 'roweos_sidebar_mode', 'roweos_app_zoom', 'roweos_text_size', 'roweos_api_routing', 'roweos_sync_settings', 'roweos_default_view'] },
  life: { label: 'LifeAI Profiles', keys: ['roweos_life_profiles', 'roweos_current_life_profile_idx', 'roweos_life_profile', 'roweos_life_main_prompt', 'roweos_generated_life_ops', 'roweos_life_goals', 'roweos_life_routines', 'roweos_life_habits'] }
};

function openRestoreFromBackup(fileInput) {
  var file = fileInput && fileInput.files ? fileInput.files[0] : null;
  if (!file) { showToast('No file selected', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var backup = JSON.parse(e.target.result);
      if (!backup.data || !backup.version) {
        showToast('Invalid backup file - missing version or data', 'error');
        return;
      }
      _pendingRestoreBackup = backup;
      _restoreMode = 'merge';
      renderRestoreModal(backup);
      openModal('backupRestoreModal');
    } catch(parseErr) {
      showToast('Invalid backup file: ' + parseErr.message, 'error');
    }
  };
  reader.readAsText(file);
  // Reset file input so same file can be re-selected
  fileInput.value = '';
}

function renderRestoreModal(backup) {
  // Render backup info header
  var info = document.getElementById('restoreBackupInfo');
  if (info) {
    var dateStr = backup.date ? new Date(backup.date).toLocaleDateString() : new Date(backup.timestamp).toLocaleDateString();
    var keyCount = Object.keys(backup.data).length;
    var backupBrands = [];
    try {
      var brandsData = backup.data.roweos_user_brands;
      if (brandsData) {
        var bArr = typeof brandsData === 'string' ? JSON.parse(brandsData) : brandsData;
        if (Array.isArray(bArr)) {
          backupBrands = bArr;
        }
      }
    } catch(e) {}
    var brandNames = backupBrands.map(function(b) { return b.shortName || b.name || 'Unknown'; }).join(', ');
    info.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
      '<div>' +
        '<div style="font-weight:600;font-size:14px;color:var(--text-primary);">' + escapeHtml(backup.version || 'Unknown') + ' Backup</div>' +
        '<div style="font-size:12px;color:var(--text-muted);">' + dateStr + ' - ' + keyCount + ' data keys</div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);">' +
        '<span style="font-weight:500;">Brands:</span> ' + escapeHtml(brandNames || 'None') +
      '</div>' +
    '</div>';
  }
  // Reset tabs
  selectRestoreMode(_restoreMode);
}

function selectRestoreMode(mode) {
  _restoreMode = mode;
  // Update tab styling
  var tabs = document.querySelectorAll('.restore-mode-tab');
  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    if (tab.getAttribute('data-restore-mode') === mode) {
      tab.style.borderBottomColor = 'var(--accent)';
      tab.style.color = 'var(--text-primary)';
      tab.classList.add('active');
    } else {
      tab.style.borderBottomColor = 'transparent';
      tab.style.color = 'var(--text-muted)';
      tab.classList.remove('active');
    }
  }
  renderRestoreModeContent(mode);
}

function renderRestoreModeContent(mode) {
  var container = document.getElementById('restoreModeContent');
  if (!container || !_pendingRestoreBackup) return;
  var backup = _pendingRestoreBackup;

  if (mode === 'addBrand') {
    renderAddBrandMode(container, backup);
  } else if (mode === 'merge') {
    renderMergeMode(container, backup);
  } else if (mode === 'overwrite') {
    renderOverwriteMode(container, backup);
  }
}

function renderAddBrandMode(container, backup) {
  var backupBrands = [];
  try {
    var raw = backup.data.roweos_user_brands;
    backupBrands = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  } catch(e) {}

  if (backupBrands.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No brands found in this backup file.</p>';
    return;
  }

  var html = '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">Select a brand from the backup to add to your current portfolio. Existing brands are not affected.</p>';
  html += '<div style="display:flex;flex-direction:column;gap:8px;">';
  for (var i = 0; i < backupBrands.length; i++) {
    var b = backupBrands[i];
    var name = b.shortName || b.name || 'Brand ' + i;
    var desc = b.description || '';
    html += '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);cursor:pointer;">' +
      '<input type="checkbox" name="restoreBrand" value="' + i + '" style="width:18px;height:18px;flex-shrink:0;">' +
      '<div>' +
        '<div style="font-weight:600;font-size:13px;color:var(--text-primary);">' + escapeHtml(name) + '</div>' +
        (desc ? '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(desc.substring(0, 80)) + '</div>' : '') +
      '</div>' +
    '</label>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderMergeMode(container, backup) {
  var html = '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">Select which categories to restore from the backup. Selected categories will <strong>replace</strong> your current data for that category. Unselected categories are untouched.</p>';
  html += '<div style="display:flex;flex-direction:column;gap:6px;">';

  var catKeys = Object.keys(RESTORE_CATEGORIES);
  for (var i = 0; i < catKeys.length; i++) {
    var catId = catKeys[i];
    var cat = RESTORE_CATEGORIES[catId];
    // Check if backup has any data for this category
    var hasData = false;
    var itemCount = 0;
    for (var k = 0; k < cat.keys.length; k++) {
      if (backup.data[cat.keys[k]] !== undefined) {
        hasData = true;
        var val = backup.data[cat.keys[k]];
        if (Array.isArray(val)) itemCount += val.length;
        else if (typeof val === 'object' && val !== null) itemCount += Object.keys(val).length;
        else itemCount++;
      }
    }
    var opacity = hasData ? '1' : '0.4';
    var detail = hasData ? (itemCount > 0 ? itemCount + ' items' : 'has data') : 'empty in backup';
    html += '<label style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);cursor:pointer;opacity:' + opacity + ';">' +
      '<input type="checkbox" name="restoreCategory" value="' + catId + '"' + (hasData ? '' : ' disabled') + ' style="width:18px;height:18px;flex-shrink:0;">' +
      '<div style="flex:1;display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="font-weight:500;font-size:13px;color:var(--text-primary);">' + cat.label + '</span>' +
        '<span style="font-size:11px;color:var(--text-muted);">' + detail + '</span>' +
      '</div>' +
    '</label>';
  }
  html += '</div>';
  html += '<div style="margin-top:12px;display:flex;gap:8px;">' +
    '<button onclick="toggleAllRestoreCategories(true)" class="btn" style="padding:4px 10px;font-size:11px;">Select All</button>' +
    '<button onclick="toggleAllRestoreCategories(false)" class="btn" style="padding:4px 10px;font-size:11px;">Deselect All</button>' +
  '</div>';
  container.innerHTML = html;
}

function renderOverwriteMode(container, backup) {
  var keyCount = Object.keys(backup.data).length;
  container.innerHTML = '<div style="padding:16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md);">' +
    '<div style="font-weight:600;font-size:14px;color:#ef4444;margin-bottom:8px;">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="vertical-align:-3px;margin-right:6px;"><path d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.97L13.75 4a2 2 0 00-3.5 0L3.32 16.03A2 2 0 005.07 19z"/></svg>' +
      'Full Overwrite' +
    '</div>' +
    '<p style="font-size:13px;color:var(--text-primary);margin-bottom:8px;">This will <strong>completely replace</strong> all your current data with the backup (' + keyCount + ' keys). Your current data will be lost.</p>' +
    '<p style="font-size:12px;color:var(--text-muted);">A snapshot will be taken automatically before the overwrite so you can undo if needed.</p>' +
  '</div>';
}

function toggleAllRestoreCategories(checked) {
  var checkboxes = document.querySelectorAll('input[name="restoreCategory"]');
  for (var i = 0; i < checkboxes.length; i++) {
    if (!checkboxes[i].disabled) checkboxes[i].checked = checked;
  }
}

function executeSmartRestore() {
  if (!_pendingRestoreBackup) {
    showToast('No backup loaded', 'error');
    return;
  }
  var backup = _pendingRestoreBackup;

  if (_restoreMode === 'overwrite') {
    if (!confirm('Full Overwrite - are you sure?\n\nAll current data will be replaced with the backup. A snapshot will be saved first.')) return;
    _executeBackupImport(backup);
    closeModal('backupRestoreModal');
    _pendingRestoreBackup = null;
    return;
  }

  if (_restoreMode === 'addBrand') {
    var checked = document.querySelectorAll('input[name="restoreBrand"]:checked');
    if (checked.length === 0) {
      showToast('Select at least one brand to add', 'info');
      return;
    }
    var backupBrands = [];
    try {
      var raw = backup.data.roweos_user_brands;
      backupBrands = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
    } catch(e) { showToast('Could not parse brands from backup', 'error'); return; }

    var backupBrandSettings = {};
    try {
      var rawBS = backup.data.roweos_user_brand_settings;
      backupBrandSettings = typeof rawBS === 'string' ? JSON.parse(rawBS) : (rawBS || {});
    } catch(e) {}

    // Take snapshot first
    takePreSyncSnapshot('Before add-brand restore ' + new Date().toLocaleString(), function() {
      var currentBrands = [];
      try { currentBrands = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]'); } catch(e) {}
      var currentSettings = {};
      try { currentSettings = JSON.parse(localStorage.getItem('roweos_user_brand_settings') || '{}'); } catch(e) {}

      var added = 0;
      for (var i = 0; i < checked.length; i++) {
        var idx = parseInt(checked[i].value);
        if (idx >= 0 && idx < backupBrands.length) {
          var newBrand = backupBrands[idx];
          var newIdx = currentBrands.length;
          currentBrands.push(newBrand);
          // Copy brand settings if they exist
          if (backupBrandSettings[idx] || backupBrandSettings[String(idx)]) {
            currentSettings[newIdx] = backupBrandSettings[idx] || backupBrandSettings[String(idx)];
          }
          // Copy knowledge for this brand index
          var knowledgeKey = 'roweos_knowledge_' + idx;
          if (backup.data[knowledgeKey] !== undefined) {
            var newKnowledgeKey = 'roweos_knowledge_' + newIdx;
            var kVal = backup.data[knowledgeKey];
            localStorage.setItem(newKnowledgeKey, typeof kVal === 'string' ? kVal : JSON.stringify(kVal));
          }
          // Copy logo if available
          var logoKey = 'roweos_brand_' + idx + '_logo';
          if (backup.data[logoKey]) {
            var newLogoKey = 'roweos_brand_' + newIdx + '_logo';
            var lVal = backup.data[logoKey];
            localStorage.setItem(newLogoKey, typeof lVal === 'string' ? lVal : JSON.stringify(lVal));
          }
          added++;
        }
      }

      localStorage.setItem('roweos_user_brand_settings', JSON.stringify(currentSettings));
      brands = currentBrands;
      saveBrands(); // v25.1: Handles localStorage + write-through to Firestore

      console.log('[Restore] Added ' + added + ' brand(s) from backup');
      showToast(added + ' brand(s) added from backup', 'success');
      if (typeof reloadAllData === 'function') reloadAllData();
      if (typeof loadBrands === 'function') loadBrands();
    });

    closeModal('backupRestoreModal');
    _pendingRestoreBackup = null;
    return;
  }

  if (_restoreMode === 'merge') {
    var checked = document.querySelectorAll('input[name="restoreCategory"]:checked');
    if (checked.length === 0) {
      showToast('Select at least one category to restore', 'info');
      return;
    }

    var selectedCats = [];
    var selectedLabels = [];
    for (var i = 0; i < checked.length; i++) {
      var catId = checked[i].value;
      selectedCats.push(catId);
      selectedLabels.push(RESTORE_CATEGORIES[catId] ? RESTORE_CATEGORIES[catId].label : catId);
    }

    if (!confirm('Merge restore - replace these categories?\n\n' + selectedLabels.join(', ') + '\n\nYour current data for these categories will be replaced. A snapshot will be saved first.')) return;

    takePreSyncSnapshot('Before merge restore ' + new Date().toLocaleString(), function() {
      var restored = 0;
      for (var ci = 0; ci < selectedCats.length; ci++) {
        var catId = selectedCats[ci];
        var cat = RESTORE_CATEGORIES[catId];
        if (!cat) continue;
        for (var ki = 0; ki < cat.keys.length; ki++) {
          var key = cat.keys[ki];
          if (backup.data[key] !== undefined) {
            var val = backup.data[key];
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            restored++;
          }
        }
      }
      // Also handle dynamic bloom keys if bloom is selected
      if (selectedCats.indexOf('bloom') !== -1) {
        var dataKeys = Object.keys(backup.data);
        for (var di = 0; di < dataKeys.length; di++) {
          if (dataKeys[di].indexOf('roweos_bloom_saved_') === 0 || dataKeys[di].indexOf('roweos_bloom_signals_') === 0) {
            var val = backup.data[dataKeys[di]];
            localStorage.setItem(dataKeys[di], typeof val === 'string' ? val : JSON.stringify(val));
            restored++;
          }
        }
      }

      stampLocalSave();
      console.log('[Restore] Merged ' + restored + ' keys from ' + selectedCats.length + ' categories');
      showToast('Restored ' + selectedCats.length + ' categories (' + restored + ' keys)', 'success');
      if (typeof reloadAllData === 'function') reloadAllData();
      if (typeof loadBrands === 'function') loadBrands();
      // v25.1: Trigger write-through for restored categories
      if (selectedCats.indexOf('brands') !== -1 && typeof saveBrands === 'function') {
        saveBrands();
      }
      if (selectedCats.indexOf('library') !== -1 && typeof saveLibrary === 'function') {
        saveLibrary();
      }
    });

    closeModal('backupRestoreModal');
    _pendingRestoreBackup = null;
    return;
  }
}

// v23.0: Auto-backup to IndexedDB every 24 hours
function _saveAutoBackupToIDB() {
  if (!_syncDB) return;
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : 'local';
  var backup = createFullBackup();
  var record = {
    uid: uid,
    timestamp: Date.now(),
    label: 'Auto-backup ' + new Date().toLocaleString(),
    isAuto: true,
    sizeBytes: JSON.stringify(backup).length,
    data: backup
  };
  _syncIdbPut('backups', record, function(id) {
    if (id) {
      localStorage.setItem('roweos_last_auto_backup', String(Date.now()));
      console.log('[SyncDB] Auto-backup saved, id=' + id);
    }
    // Purge old auto-backups (keep last 5)
    _syncIdbGetAllByIndex('backups', 'uid', uid, function(results) {
      var autos = results.filter(function(r) { return r.isAuto; });
      if (autos.length <= 5) return;
      autos.sort(function(a, b) { return b.timestamp - a.timestamp; });
      for (var i = 5; i < autos.length; i++) {
        _syncIdbDelete('backups', autos[i].id);
      }
    });
  });
}

function scheduleAutoBackup() {
  var last = parseInt(localStorage.getItem('roweos_last_auto_backup') || '0');
  var now = Date.now();
  var interval = 24 * 60 * 60 * 1000;
  if (now - last > interval) {
    setTimeout(function() {
      _whenSyncDBReady(function() { _saveAutoBackupToIDB(); });
    }, 10000);
  }
  // Check again in 1 hour
  setTimeout(scheduleAutoBackup, 60 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE REAL-TIME SYNC v2.0 (mycinder-style)
// Cross-device continuity with real-time subscriptions
// ═══════════════════════════════════════════════════════════════════════════════

// Real-time subscription unsubscribers
var firebaseUnsubscribers = [];
var isSyncing = false;
var _syncQueued = false; // v24.15: Queue sync when isSyncing is true
var lastCloudUpdate = null;
var deviceId = localStorage.getItem('roweos_device_id') || generateDeviceId();

function generateDeviceId() {
  var id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('roweos_device_id', id);
  return id;
}

// Detect device type
function getDeviceType() {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  if (/Mobile/i.test(navigator.userAgent)) return 'mobile';
  return 'desktop';
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE DATA SYNC
// ═══════════════════════════════════════════════════════════════════════════════

// v12.2.4: Sync Settings - User controls for what data syncs
var syncSettings = {
  conversations: true,      // Sync chat history (can be large)
  libraryContent: false,    // Sync full file contents (metadata always syncs)
  deferDuringChat: true,    // Don't sync while actively chatting
  syncMode: 'perfect_cloud'  // v24.25: Default to cloud sync on. 'cloud' = all cloud, 'local' = 100% on device, 'hybrid' = selective
};

// v12.2.4: Track chat activity for deferred sync
var lastChatActivity = 0;
var deferredSyncTimer = null;
var CHAT_IDLE_THRESHOLD = 10000; // 10 seconds of idle before sync

function loadSyncSettings() {
  try {
    var saved = localStorage.getItem('roweos_sync_settings');
    if (saved) {
      var parsed = JSON.parse(saved);
      syncSettings.conversations = parsed.conversations !== false;
      syncSettings.libraryContent = parsed.libraryContent === true;
      syncSettings.deferDuringChat = parsed.deferDuringChat !== false;
      syncSettings.syncMode = parsed.syncMode || 'hybrid';
    }
    updateSyncSettingsUI();
  } catch (e) {
    console.warn('[SyncSettings] Error loading:', e);
  }
}

function saveSyncSettings() {
  try {
    localStorage.setItem('roweos_sync_settings', JSON.stringify(syncSettings));
  } catch (e) {
    console.warn('[SyncSettings] Error saving:', e);
  }
}

function toggleSyncSetting(setting) {
  // v12.2.4: Read from checkbox state
  var checkbox = null;
  if (setting === 'conversations') {
    checkbox = document.getElementById('syncConversationsToggle');
    syncSettings.conversations = checkbox ? checkbox.checked : !syncSettings.conversations;
  } else if (setting === 'libraryContent') {
    checkbox = document.getElementById('syncLibraryContentToggle');
    syncSettings.libraryContent = checkbox ? checkbox.checked : !syncSettings.libraryContent;
  } else if (setting === 'deferDuringChat') {
    checkbox = document.getElementById('syncDeferDuringChatToggle');
    syncSettings.deferDuringChat = checkbox ? checkbox.checked : !syncSettings.deferDuringChat;
  }
  saveSyncSettings();
  showToast('Sync setting updated', 'info');
}

function updateSyncSettingsUI() {
  // v12.2.4: Update checkbox checked state
  var convToggle = document.getElementById('syncConversationsToggle');
  var libToggle = document.getElementById('syncLibraryContentToggle');
  var deferToggle = document.getElementById('syncDeferDuringChatToggle');

  if (convToggle) {
    convToggle.checked = syncSettings.conversations;
  }
  if (libToggle) {
    libToggle.checked = syncSettings.libraryContent;
  }
  if (deferToggle) {
    deferToggle.checked = syncSettings.deferDuringChat;
  }

  // v15.4: Update sync mode toggle buttons
  var modes = ['cloud', 'hybrid', 'local'];
  modes.forEach(function(m) {
    var btn = document.getElementById('syncMode_' + m);
    if (btn) {
      if (syncSettings.syncMode === m) {
        btn.style.background = 'var(--brand-accent, var(--accent))';
        btn.style.color = '#000';
        btn.style.borderColor = 'var(--brand-accent, var(--accent))';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border-color)';
      }
    }
  });

  // v15.4: Show/hide granular settings based on sync mode
  var granularSettings = document.getElementById('syncGranularSettings');
  if (granularSettings) {
    granularSettings.style.display = syncSettings.syncMode === 'hybrid' ? 'flex' : 'none';
  }
}

// v12.2.4: Mark chat activity for deferred sync
function markChatActivity() {
  lastChatActivity = Date.now();
  // Clear any pending deferred sync
  if (deferredSyncTimer) {
    clearTimeout(deferredSyncTimer);
    deferredSyncTimer = null;
  }
  // v25.0: Write-through — sync conversations (deferred 5s)
  if (typeof writeDBConversations === 'function') writeDBConversations();
}

// v25.0: Request sync — triggers conversation write-through
function requestSync() {
  if (typeof writeDBConversations === 'function') writeDBConversations();
}

// v12.2.7: Check if a sync category should go to cloud
function shouldSyncCategory(key) {
  var syncCats = {};
  try { syncCats = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}'); } catch(e) {}
  return syncCats[key] !== 'local';
}

// v25.0: syncToFirebase is now a no-op (write-through handles all pushes)
function syncToFirebase() {
  return Promise.resolve();
}

// v28.7: Push brand logos to Firestore logos/ subcollection (extracted from deprecated syncToFirebaseV2)
// Logos are too large for brand docs (stripped at 50KB), so they need their own push path.
function pushBrandLogos() {
  if (!firebaseUser || !firebase) return;
  if (!shouldSyncCategory('logos')) return;
  var db = firebase.firestore();
  var basePath = 'roweos_users/' + firebaseUser.uid;
  var MAX_LOGO_SYNC_SIZE = 900000;
  var logoKeys = [];
  try {
    var lifeProfiles = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]');
    for (var lpi = 0; lpi < Math.max(lifeProfiles.length, 1); lpi++) {
      var lpKey = (lifeProfiles[lpi] && lifeProfiles[lpi].logoKey) || ('roweos_lifeai_logo_profile_' + lpi);
      logoKeys.push(lpKey);
    }
  } catch(e) {}
  for (var li = 0; li < 10; li++) {
    logoKeys.push('roweos_brand_' + li + '_logo');
  }
  var batch = db.batch();
  var logoIndex = {};
  var count = 0;
  logoKeys.forEach(function(lk) {
    var logoData = localStorage.getItem(lk);
    if (logoData && logoData.length < MAX_LOGO_SYNC_SIZE) {
      var docId = lk.replace(/[\/\.]/g, '_');
      batch.set(db.doc(basePath + '/logos/' + docId), {
        key: lk,
        base64: logoData,
        size: parseInt(localStorage.getItem(lk + '_size') || '100')
      });
      logoIndex[docId] = lk;
      count++;
    }
  });
  if (count > 0) {
    batch.set(db.doc(basePath + '/profile/logos'), { _index: logoIndex, _version: 2 });
    batch.commit().then(function() {
      console.log('[pushBrandLogos] Pushed ' + count + ' logos to cloud');
    }).catch(function(err) {
      console.warn('[pushBrandLogos] Failed:', err.message);
    });
  }
}

async function syncToFirebaseV1_legacy() {
  console.log('[Firebase Sync V1] Starting legacy sync...');
  console.log('[Firebase Sync V1] firebaseUser:', firebaseUser ? firebaseUser.email : 'null');
  console.log('[Firebase Sync V1] firebase:', typeof firebase);

  if (!firebaseUser || !firebase) {
    console.log('[Firebase Sync V1] ERROR: Not connected');
    showToast('Not connected to Firebase', 'error');
    return;
  }
  
  if (isSyncing) {
    console.log('[Firebase Sync] Already in progress, skipping');
    return;
  }
  
  isSyncing = true;
  console.log('[Firebase Sync] Collecting data...');
  
  try {
    // v11.0.5: Silent sync - no toast spam
    // showToast('Syncing to cloud...', 'info');
    updateSyncIndicator('syncing');
    
    // v22.32: Removed autoTrimDataForSync — sync functions trim their own copies for Firestore

    // v12.2.7: Respect both syncSettings and per-category sync preferences
    var conversationsData = {};
    if (syncSettings.conversations && shouldSyncCategory('brandai_chats')) {
      conversationsData = collectConversationsWithLimit();
    } else {
      console.log('[Firebase Sync] Skipping conversations (disabled or set to local)');
    }

    // v12.2.4: Handle library content based on settings
    var brandLibrary = '{}';
    var lifeLibrary = '{"files":[],"folders":[]}';

    if (syncSettings.libraryContent && shouldSyncCategory('library')) {
      // Full library with content
      brandLibrary = localStorage.getItem('roweosLibrary') || '{}';
      lifeLibrary = localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}';
    } else if (!shouldSyncCategory('library')) {
      console.log('[Firebase Sync] Library set to local-only, skipping');
    } else {
      // Metadata only - strip file contents
      try {
        var bl = JSON.parse(localStorage.getItem('roweosLibrary') || '{}');
        if (bl.files) {
          bl.files = bl.files.map(function(f) {
            return { id: f.id, name: f.name, type: f.type, size: f.size, uploadedAt: f.uploadedAt, folderId: f.folderId };
          });
        }
        brandLibrary = JSON.stringify(bl);
      } catch (e) {}
      try {
        var ll = JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
        if (ll.files) {
          ll.files = ll.files.map(function(f) {
            return { id: f.id, name: f.name, type: f.type, size: f.size, uploadedAt: f.uploadedAt, folderId: f.folderId };
          });
        }
        lifeLibrary = JSON.stringify(ll);
      } catch (e) {}
      console.log('[Firebase Sync] Using metadata-only for libraries (content sync disabled)');
    }

    // Estimate base size (everything except big items)
    var baseSizeEstimate = 200000; // ~200KB for brands, settings, etc.
    var convSize = conversationsData.agentHistoryJson ? conversationsData.agentHistoryJson.length : 0;
    var brandLibSize = brandLibrary.length;
    var lifeLibSize = lifeLibrary.length;
    var totalEstimate = baseSizeEstimate + convSize + brandLibSize + lifeLibSize;

    console.log('[Firebase Sync] Size estimate:', {
      base: baseSizeEstimate,
      conversations: convSize,
      brandLib: brandLibSize,
      lifeLib: lifeLibSize,
      total: totalEstimate,
      syncConversations: syncSettings.conversations,
      syncLibraryContent: syncSettings.libraryContent
    });

    // If over ~900KB, start trimming (leave buffer)
    var MAX_SIZE = 900000;
    if (totalEstimate > MAX_SIZE) {
      console.log('[Firebase Sync] Data too large, trimming...');

      // Strategy: Trim oldest conversation history first
      if (syncSettings.conversations && conversationsData.agentHistoryJson && convSize > 100000) {
        var historyArr = JSON.parse(conversationsData.agentHistoryJson);
        // Keep only last 20 conversations
        if (historyArr.length > 20) {
          historyArr = historyArr.slice(-20);
          conversationsData.agentHistoryJson = JSON.stringify(historyArr);
          console.log('[Firebase Sync] Trimmed history to 20 entries');
        }
        // If still too big, trim conversation content within each
        if (conversationsData.agentHistoryJson.length > 300000) {
          historyArr = historyArr.map(function(cmd) {
            if (cmd.conversation && cmd.conversation.length > 10) {
              cmd.conversation = cmd.conversation.slice(-10);
            }
            return cmd;
          });
          conversationsData.agentHistoryJson = JSON.stringify(historyArr);
          console.log('[Firebase Sync] Trimmed conversation lengths');
        }
      }

      // v16.6: Removed library content trimming — full file content should sync
      // Only strip base64 from library file content to prevent Firestore errors
      if (syncSettings.libraryContent && brandLibSize > 300000) {
        try {
          var libObj = JSON.parse(brandLibrary);
          if (libObj.files) {
            libObj.files = libObj.files.map(function(f) {
              if (f.content && typeof f.content === 'string') {
                f.content = f.content.replace(/data:(image|application)\/[^;]+;base64,[A-Za-z0-9+\/=]+/g, '[image-data-stripped]');
              }
              return f;
            });
          }
          brandLibrary = JSON.stringify(libObj);
        } catch (e) {}
      }

      if (lifeLibSize > 300000) {
        try {
          var libObj = JSON.parse(lifeLibrary);
          if (libObj.files) {
            libObj.files = libObj.files.map(function(f) {
              if (f.content && typeof f.content === 'string') {
                f.content = f.content.replace(/data:(image|application)\/[^;]+;base64,[A-Za-z0-9+\/=]+/g, '[image-data-stripped]');
              }
              return f;
            });
          }
          lifeLibrary = JSON.stringify(libObj);
        } catch (e) {}
      }
    }
    
    // v15.13: Safe JSON parse helper — prevents corrupted localStorage from crashing sync
    function safeParse(key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        console.warn('[Firebase Sync] Corrupt data in ' + key + ', using fallback:', e.message);
        return fallback;
      }
    }

    // Collect ALL user data
    var syncData = {
      // Core brand data
      brands: safeParse(USER_DATA_KEYS.brands, []),
      brandSettings: safeParse(USER_DATA_KEYS.brandSettings, {}),

      // v7.10: Brand Memory (document uploads with AI summaries)
      brandMemory: safeParse('roweos_brand_memory', null) || safeParse('brandMemory', {}),

      // BrandAI conversations (CRITICAL for continuity)
      conversations: conversationsData,

      // v12.2.7: User knowledge (gated by sync category)
      knowledge: shouldSyncCategory('knowledge') ? collectKnowledge() : {},

      // v12.2.7: Operations & runs (gated by sync category)
      runs: shouldSyncCategory('runs') ? (function() { var rd = safeParse('roweos_runs', {}); return Array.isArray(rd) ? rd : (rd.runs || []); })() : [],
      customOps: safeParse('roweos_custom_operations', []),
      clients: safeParse('roweos_clients', []), // v16.11
      pinnedOps: safeParse('roweos_pinnedOps', {}),
      recentOps: safeParse('roweos_recentOps', {}),
      generatedBrandOps: safeParse('roweos_generated_brand_ops', []),

      // v12.2.7: Calendar & scheduling (gated by sync category)
      calendar: shouldSyncCategory('calendar') ? safeParse('roweos_calendar', []) : [],
      // v22.26: Filter deleted IDs from V1 write to prevent zombie re-upload
      automations: shouldSyncCategory('calendar') ? safeParse('roweos_automations', []).filter(function(a) { return !(typeof _deletedAutomationIds !== 'undefined' && _deletedAutomationIds[String(a.id)]); }) : [],
      scheduledTasks: shouldSyncCategory('calendar') ? safeParse('roweos_scheduled_tasks', []).filter(function(t) { return !(typeof _deletedAutomationIds !== 'undefined' && _deletedAutomationIds[String(t.id)]); }) : [],
      scheduledPrompts: shouldSyncCategory('calendar') ? safeParse('roweosScheduledPrompts', []) : [],
      // v22.26: Sync deleted automation IDs to V1 doc (prevents zombie restoration across devices)
      deletedAutomationIds: typeof _deletedAutomationIds !== 'undefined' ? _deletedAutomationIds : {},

      // v12.2.7: To-Do items (gated by sync category)
      todos: shouldSyncCategory('brand_todos') ? safeParse('roweosTodos', []) : [],
      todoCategories: shouldSyncCategory('brand_todos') ? safeParse('roweos_todo_categories', []) : [],
      taskHistory: shouldSyncCategory('brand_todos') ? safeParse('roweos_task_history', []) : [],
      // v22.25: Automation execution history (was missing from sync)
      autoLabHistory: shouldSyncCategory('calendar') ? safeParse('roweos_auto_lab_history', []) : [],
      completedAutomations: shouldSyncCategory('calendar') ? safeParse('roweos_completed_automations', []) : [],

      // Settings & preferences
      settings: {
        theme: document.documentElement.classList.contains('light-mode') ? 'light' : 'dark',
        sidebarCollapsed: localStorage.getItem('roweos_sidebar_collapsed'),
        defaultView: localStorage.getItem('roweos_default_view'),
        // v12.0.2: Advanced feature settings
        webSearchPrefs: safeParse('roweos_web_search_prefs', {}),
        claudeWebSearch: localStorage.getItem('roweos_claude_web_search') === 'true',
        geminiWebSearch: localStorage.getItem('roweos_gemini_web_search') === 'true',
        autoPilot: localStorage.getItem('roweos_feature_autoPilot') === 'true',
        responseCache: localStorage.getItem('roweos_feature_responseCache') === 'true',
        crossModeEnabled: localStorage.getItem('roweos_cross_mode_enabled') !== 'false',
        sidebarOrder: localStorage.getItem('roweos_sidebar_order') || null,
        sidebarMode: localStorage.getItem('roweos_sidebar_mode') || 'expanded', // v30.1
        appZoom: localStorage.getItem('roweos_app_zoom') || '75', // v30.1: default 75%
        textSize: localStorage.getItem('roweos_text_size') || '100'
      },

      // v9.1.14: Focus view settings
      focus: {
        streak: parseInt(localStorage.getItem('roweosStreak') || '0'),
        todoFilterMode: localStorage.getItem('roweosTodoFilterMode') || 'all',
        taskViewMode: localStorage.getItem('roweos_task_view_mode') || 'category',
        lastStreakDate: localStorage.getItem('roweosLastStreakDate') || ''
      },
      
      // v12.2.7: Inventory (gated by sync category)
      inventory: !shouldSyncCategory('inventory') ? {items:[], categories:[]} : (function() {
        var inv = safeParse('roweos_inventory', {items:[], categories:['General','Products','Services','Digital','Consulting']});
        // Trim large images to prevent sync size issues
        if (inv.items && inv.items.length > 0) {
          inv.items = inv.items.map(function(item) {
            if (item.imageData && item.imageData.length > 50000) {
              // Keep a smaller version of the image (first 50KB)
              console.log('[Sync] Trimming large image for:', item.name);
              item.imageData = item.imageData.substring(0, 50000);
            }
            return item;
          });
        }
        console.log('[Sync] Including inventory:', (inv.items || []).length, 'items');
        return inv;
      })(),
      
      // v10.5.27: Libraries (trimmed if needed)
      library: brandLibrary,
      
      // v10.5.25: LifeAI data (profiles, user name, mode, mode-specific accent colors)
      lifeAI: {
        profiles: safeParse('roweos_life_profiles', []),
        currentProfileIdx: parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0'),
        currentProfile: safeParse('roweos_life_profile', null),
        userName: localStorage.getItem('roweos_user_name') || 'My Life',
        appMode: localStorage.getItem('roweos_app_mode') || 'brand',
        mainSystemPrompt: localStorage.getItem('roweos_life_main_prompt') || '',
        generatedOps: safeParse('roweos_generated_life_ops', []),
        library: lifeLibrary,
        accentLightMode: localStorage.getItem('roweos_life_accent_light_mode') || '#22c55e',
        accentLightModeDark: localStorage.getItem('roweos_life_accent_light_mode_dark') || '#16a34a',
        accentDarkMode: localStorage.getItem('roweos_life_accent_dark_mode') || '#22c55e',
        accentDarkModeDark: localStorage.getItem('roweos_life_accent_dark_mode_dark') || '#16a34a',
        accentColor: localStorage.getItem('roweos_life_accent_color') || '#22c55e',
        accentDark: localStorage.getItem('roweos_life_accent_dark') || '#16a34a',
        goals: safeParse('roweos_life_goals', []),
        routines: safeParse('roweos_life_routines', []),
        habits: safeParse('roweos_life_habits', []),
        todoCategories: shouldSyncCategory('life_todos') ? safeParse('roweos_life_todo_categories', []) : [],
        todos: shouldSyncCategory('life_todos') ? safeParse('roweos_life_todos', []) : [],
        calendar: shouldSyncCategory('calendar') ? safeParse('roweos_life_calendar', []) : [],
        agentCommands: shouldSyncCategory('lifeai_chats') ? safeParse('roweos_life_agentCommands', []) : [],
        // v12.2.4: LifeAI Identity document uploads
        memory: JSON.parse(localStorage.getItem('roweos_life_memory') || '{}')
      },

      // v12.2.7: Journal & Pulse data (gated by sync category)
      journal: shouldSyncCategory('journal') ? JSON.parse(localStorage.getItem('roweos_journal') || '[]') : [],
      pulse: {
        goals: shouldSyncCategory('goals') ? JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]') : [],
        journal: JSON.parse(localStorage.getItem('roweos_pulse_journal') || '[]'),
        insights: JSON.parse(localStorage.getItem('roweos_pulse_insights') || '[]'),
        entries: JSON.parse(localStorage.getItem('roweos_pulse2_entries') || '[]')
      },

      // v12.2.4: Guardrails (feature flags)
      guardrails: JSON.parse(localStorage.getItem('roweos_guardrails') || '{}'),

      // v12.2.4: Focus 2.0 widget layouts
      focus2Layouts: {
        widgetOrder: JSON.parse(localStorage.getItem('roweos_focus2_widget_order') || '[]'),
        widgetSizes: JSON.parse(localStorage.getItem('roweos_focus2_widget_sizes') || '{}'),
        categoryOrder: JSON.parse(localStorage.getItem('roweos_focus2_category_order') || '[]'),
        unifiedOrder: JSON.parse(localStorage.getItem('roweos_focus2_unified_order') || '[]'),
        calendarOrientation: localStorage.getItem('roweos_focus2_calendar_orientation') || 'horizontal'
      },

      // v12.2.4: AutoPilot data
      autoPilot: {
        learnings: JSON.parse(localStorage.getItem('roweos_autopilot_learnings') || '[]'),
        queue: JSON.parse(localStorage.getItem('roweos_autopilot_queue') || '[]')
      },

      // v12.2.4: Per-brand and LifeAI logos
      logos: (function() {
        var logoData = {};
        // v15.37: Per-profile LifeAI logos (no shared key)
        try {
          var lps = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]');
          for (var pi = 0; pi < Math.max(lps.length, 1); pi++) {
            var lpk = (lps[pi] && lps[pi].logoKey) || ('roweos_lifeai_logo_profile_' + pi);
            var lpd = localStorage.getItem(lpk);
            if (lpd) {
              logoData[lpk] = {
                base64: lpd,
                size: parseInt(localStorage.getItem(lpk + '_size') || '100')
              };
            }
          }
        } catch(e) {}
        // Per-brand logos (0-9)
        for (var i = 0; i < 10; i++) {
          var brandLogo = localStorage.getItem('roweos_brand_' + i + '_logo');
          if (brandLogo) {
            logoData['roweos_brand_' + i + '_logo'] = {
              base64: brandLogo,
              size: parseInt(localStorage.getItem('roweos_brand_' + i + '_logo_size') || '100')
            };
          }
        }
        return logoData;
      })(),

      // v23.16: Commerce/Analytics data
      commerce: JSON.parse(localStorage.getItem('roweos_commerce') || 'null'),

      // Metadata
      meta: {
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        lastDevice: getDeviceType(),
        lastDeviceId: deviceId,
        version: '12.2',
        userAgent: navigator.userAgent.substring(0, 100)
      }
    };
    
    // Save to Firestore
    console.log('[Firebase Sync] Brands to sync:', syncData.brands.length);
    console.log('[Firebase Sync] Inventory to sync:', (syncData.inventory && syncData.inventory.items) ? syncData.inventory.items.length : 0, 'items');
    console.log('[Firebase Sync] Writing to Firestore...');
    await firebase.firestore()
      .collection('roweos_users')
      .doc(firebaseUser.uid)
      .set(syncData, { merge: true });
    console.log('[Firebase Sync] Write complete!');
    
    // Update sync status
    updateSyncStatus('push');

    var lastSync = new Date().toLocaleString();
    var lastDevice = getDeviceType();
    updateLastSyncDisplay(lastSync, lastDevice);
    localStorage.setItem('roweos_last_sync', lastSync);
    localStorage.setItem('roweos_last_sync_device', lastDevice);
    
    updateSyncIndicator('connected');
    // v11.0.5: Silent sync - no toast spam
    // showToast('Synced to cloud ✓', 'success');

    // v19.6: Notification Center — throttled sync success
    try {
      var _now = Date.now();
      if (_now - _lastSyncNotifTime > 60000) {
        _lastSyncNotifTime = _now;
        addNotification('sync', 'Sync Complete', 'All data synced to cloud', { direction: 'push', success: true });
      }
    } catch(e) {}

  } catch (error) {
    console.error('Firebase sync error:', error);
    updateSyncIndicator('error');

    // v19.6: Notification Center — sync error
    try {
      var _nowErr = Date.now();
      if (_nowErr - _lastSyncNotifTime > 60000) {
        _lastSyncNotifTime = _nowErr;
        addNotification('sync', 'Sync Failed', (error.message || 'Unknown error').substring(0, 80), { direction: 'push', success: false });
      }
    } catch(e) {}

    // v10.5.27: Cleaner error messages
    var errorMsg = error.message || 'Unknown error';
    if (errorMsg.indexOf('exceeds the maximum allowed size') !== -1 || errorMsg.indexOf('1,048,576 bytes') !== -1) {
      // v11.0.5: Auto-trim more aggressively and notify user
      console.log('[Firebase Sync] Hit size limit, performing emergency trim...');
      emergencyDataTrim();
      showToast('Data trimmed. Please try syncing again.', 'warning');
    } else if (errorMsg.indexOf('PERMISSION_DENIED') !== -1) {
      showToast('Sync permission denied. Try signing out and back in.', 'error');
    } else if (errorMsg.indexOf('network') !== -1 || errorMsg.indexOf('UNAVAILABLE') !== -1) {
      showToast('Network error. Will retry when connected.', 'warning');
    } else {
      showToast('Sync error: ' + errorMsg.substring(0, 50), 'error');
    }
  } finally {
    isSyncing = false;
  }
}

// v10.5.27: Collect conversations with size limit
/**
 * v11.0.5: Aggressive auto-trimming to stay under Firestore 1MB limit
 * This trims localStorage BEFORE sync to prevent "Data too large" errors
 */
function autoTrimDataForSync() {
  console.log('[AutoTrim] Starting aggressive data trimming...');
  var trimmed = false;
  
  // 1. Trim Studio runs (keep last 15 max)
  // v15.37: Handle object format {runs: [], calendar: [], agentCommands: []}
  try {
    var runsRaw = JSON.parse(localStorage.getItem('roweos_runs') || '{}');
    var runsArr = Array.isArray(runsRaw) ? runsRaw : (runsRaw.runs || []);
    if (runsArr.length > 15) {
      var trimmedRuns = runsArr.slice(-15);
      if (Array.isArray(runsRaw)) {
        runsRaw = { runs: trimmedRuns };
      } else {
        runsRaw.runs = trimmedRuns;
      }
      localStorage.setItem('roweos_runs', JSON.stringify(runsRaw));
      console.log('[AutoTrim] Trimmed runs:', runsArr.length, '→', trimmedRuns.length);
      trimmed = true;
    }
  } catch (e) { console.warn('[AutoTrim] runs error:', e); }
  
  // 2. Trim BrandAI agent commands (keep last 20 max)
  try {
    var cmds = JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]');
    if (cmds.length > 20) {
      var newCmds = cmds.slice(-20);
      localStorage.setItem('roweos_agentCommands', JSON.stringify(newCmds));
      console.log('[AutoTrim] Trimmed agentCommands:', cmds.length, '→', newCmds.length);
      trimmed = true;
    }
    // Also trim conversation content within each command
    cmds = JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]');
    cmds = cmds.map(function(cmd) {
      if (cmd.conversation && cmd.conversation.length > 15) {
        cmd.conversation = cmd.conversation.slice(-15);
      }
      return cmd;
    });
    localStorage.setItem('roweos_agentCommands', JSON.stringify(cmds));
  } catch (e) { console.warn('[AutoTrim] agentCommands error:', e); }
  
  // 3. Trim LifeAI agent commands (keep last 20 max)
  try {
    var lifeCmds = JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]');
    if (lifeCmds.length > 20) {
      var newLifeCmds = lifeCmds.slice(-20);
      localStorage.setItem('roweos_life_agentCommands', JSON.stringify(newLifeCmds));
      console.log('[AutoTrim] Trimmed life agentCommands:', lifeCmds.length, '→', newLifeCmds.length);
      trimmed = true;
    }
    // Also trim conversation content within each command
    lifeCmds = JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]');
    lifeCmds = lifeCmds.map(function(cmd) {
      if (cmd.conversation && cmd.conversation.length > 15) {
        cmd.conversation = cmd.conversation.slice(-15);
      }
      return cmd;
    });
    localStorage.setItem('roweos_life_agentCommands', JSON.stringify(lifeCmds));
  } catch (e) { console.warn('[AutoTrim] life agentCommands error:', e); }
  
  // 4. Library files — v15.37: Do NOT trim library content. User explicitly saved these outputs.
  // Only cap file count per brand (keep last 100) to prevent unbounded growth.
  try {
    var library = JSON.parse(localStorage.getItem('roweosLibrary') || '{}');
    var libChanged = false;
    Object.keys(library).forEach(function(brandKey) {
      var brandLib = library[brandKey];
      if (brandLib && brandLib.files && brandLib.files.length > 100) {
        brandLib.files = brandLib.files.slice(-100);
        trimmed = true;
        libChanged = true;
      }
    });
    if (libChanged) {
      localStorage.setItem('roweosLibrary', JSON.stringify(library));
    }
  } catch (e) { console.warn('[AutoTrim] library error:', e); }

  // 5. LifeAI Library — v15.37: Same — preserve content, only cap file count
  try {
    var lifeLib = JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
    if (lifeLib.files && lifeLib.files.length > 100) {
      lifeLib.files = lifeLib.files.slice(-100);
      trimmed = true;
      localStorage.setItem('roweos_life_library', JSON.stringify(lifeLib));
    }
  } catch (e) { console.warn('[AutoTrim] life library error:', e); }
  
  // 6. Trim task history (keep last 30)
  try {
    var taskHistory = JSON.parse(localStorage.getItem('roweos_task_history') || '[]');
    if (taskHistory.length > 30) {
      localStorage.setItem('roweos_task_history', JSON.stringify(taskHistory.slice(-30)));
      console.log('[AutoTrim] Trimmed task history:', taskHistory.length, '→ 30');
      trimmed = true;
    }
  } catch (e) {}
  
  // 7. Clear old conversations storage
  try {
    var convos = JSON.parse(localStorage.getItem('roweos_conversations') || '{}');
    if (convos.history && convos.history.length > 10) {
      convos.history = convos.history.slice(-10);
      localStorage.setItem('roweos_conversations', JSON.stringify(convos));
      trimmed = true;
    }
  } catch (e) {}
  
  if (trimmed) {
    console.log('[AutoTrim] Data trimmed successfully for sync');
  } else {
    console.log('[AutoTrim] No trimming needed');
  }
}

/**
 * v11.0.5: Emergency data trim when sync still fails
 * This is more aggressive - clears more data to ensure sync works
 */
function emergencyDataTrim() {
  console.log('[EmergencyTrim] Performing aggressive data cleanup...');
  
  // Clear ALL runs (Studio outputs can be regenerated)
  // v15.37: Handle object format
  try {
    var eRunsRaw = JSON.parse(localStorage.getItem('roweos_runs') || '{}');
    var eRunsArr = Array.isArray(eRunsRaw) ? eRunsRaw : (eRunsRaw.runs || []);
    if (eRunsArr.length > 5) {
      if (Array.isArray(eRunsRaw)) { eRunsRaw = { runs: eRunsArr.slice(-5) }; }
      else { eRunsRaw.runs = eRunsArr.slice(-5); }
      localStorage.setItem('roweos_runs', JSON.stringify(eRunsRaw));
      console.log('[EmergencyTrim] Trimmed runs to 5');
    }
  } catch (e) {}
  
  // Clear most agent commands (keep only last 5)
  try {
    var cmds = JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]');
    if (cmds.length > 5) {
      localStorage.setItem('roweos_agentCommands', JSON.stringify(cmds.slice(-5)));
      console.log('[EmergencyTrim] Trimmed agentCommands to 5');
    }
  } catch (e) {}
  
  try {
    var lifeCmds = JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]');
    if (lifeCmds.length > 5) {
      localStorage.setItem('roweos_life_agentCommands', JSON.stringify(lifeCmds.slice(-5)));
      console.log('[EmergencyTrim] Trimmed life agentCommands to 5');
    }
  } catch (e) {}
  
  // Clear conversation history completely
  localStorage.removeItem('roweos_conversations');
  
  // v15.37: Emergency trim — cap library file count only, never trim content
  try {
    var library = JSON.parse(localStorage.getItem('roweosLibrary') || '{}');
    var elibChanged = false;
    Object.keys(library).forEach(function(brandKey) {
      var brandLib = library[brandKey];
      if (brandLib && brandLib.files && brandLib.files.length > 50) {
        brandLib.files = brandLib.files.slice(-50);
        elibChanged = true;
      }
    });
    if (elibChanged) localStorage.setItem('roweosLibrary', JSON.stringify(library));
  } catch (e) {}

  try {
    var lifeLib = JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
    if (lifeLib.files && lifeLib.files.length > 50) {
      lifeLib.files = lifeLib.files.slice(-50);
      localStorage.setItem('roweos_life_library', JSON.stringify(lifeLib));
    }
  } catch (e) {}
  
  // Clear task history
  localStorage.removeItem('roweos_task_history');
  
  console.log('[EmergencyTrim] Emergency cleanup complete');
}

// v30.3: Sanitize a single chat entry for Firestore storage
function sanitizeChatEntry(cmd) {
  if (!cmd) return null;
  var clean = {};
  for (var k in cmd) {
    if (cmd.hasOwnProperty(k)) clean[k] = cmd[k];
  }
  if (clean.conversation && Array.isArray(clean.conversation)) {
    clean.conversation = clean.conversation.map(function(msg) {
      var m = {};
      for (var mk in msg) {
        if (msg.hasOwnProperty(mk)) m[mk] = msg[mk];
      }
      // Strip base64 images from content
      if (typeof m.content === 'string' && m.content.length > 50000) {
        m.content = m.content.substring(0, 500) + '...[truncated]';
      }
      if (Array.isArray(m.content)) {
        m.content = m.content.map(function(part) {
          if (part && part.type === 'image_url' && part.image_url && part.image_url.url && part.image_url.url.length > 1000) {
            return { type: 'image_url', image_url: { url: '[base64 removed]' } };
          }
          return part;
        });
      }
      return m;
    });
  }
  clean._modifiedAt = Date.now();
  return clean;
}

function collectConversationsWithLimit() {
  var convos = {};

  // v15.18: Sanitize a message for Firestore (strip base64, remove undefined)
  // v16.6: Increased limits — preserve full content for sync, only strip binary data
  function sanitizeMessage(msg) {
    var clean = { role: msg.role || 'user' };
    if (msg.displayContent !== undefined && msg.displayContent !== null) {
      clean.displayContent = String(msg.displayContent).substring(0, 5000);
    }
    if (msg.content !== undefined && msg.content !== null) {
      if (typeof msg.content === 'string') {
        // Strip base64 data URLs (images embedded in markdown)
        var c = msg.content.replace(/data:(image|application)\/[^;]+;base64,[A-Za-z0-9+\/=]+/g, '[image-data-stripped]');
        // v16.6: Raised limit from 8KB to 200KB — full messages should sync
        if (c.length > 200000) c = c.substring(0, 200000) + '\n...[trimmed for sync]';
        clean.content = c;
      } else if (Array.isArray(msg.content)) {
        // Multipart content: sanitize each part
        clean.content = JSON.stringify(msg.content.map(function(part) {
          if (part && part.source && part.source.data) return { type: 'image', note: '[stripped]' };
          if (part && part.type === 'image_url') return { type: 'image_url', note: '[stripped]' };
          if (part && part.text && part.text.length > 50000) return { type: 'text', text: part.text.substring(0, 50000) };
          return part || {};
        }));
      } else {
        clean.content = String(msg.content).substring(0, 50000);
      }
    } else {
      clean.content = '';
    }
    return clean;
  }

  // Current conversation
  if (typeof currentConversation !== 'undefined' && currentConversation.length > 0) {
    var brandEl = document.getElementById('brand');
    convos.current = {
      messages: currentConversation.map(sanitizeMessage),
      brandIndex: parseInt(brandEl ? brandEl.value : 0),
      timestamp: new Date().toISOString()
    };
  }

  // Saved conversations from localStorage
  var saved = localStorage.getItem('roweos_conversations');
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      // v15.18: Stringify history to avoid nested entity errors
      convos.historyJson = JSON.stringify(parsed);
    } catch (e) {}
  }

  // Agent history — stringify and limit size
  // v16.6: Raised limits to preserve full conversation content for sync
  if (typeof agentCommands !== 'undefined' && agentCommands.length > 0) {
    try {
      var MAX_FIELD_BYTES = 800000; // v16.6: 800KB (Firestore field limit ~1MB)
      var counts = [30, 20, 15, 10, 5];
      var historyJson = '';
      for (var ci = 0; ci < counts.length; ci++) {
        var toSync = agentCommands.slice(-counts[ci]).map(function(cmd) {
          var clean = {};
          for (var k in cmd) {
            if (k === 'conversation' && cmd[k]) {
              clean[k] = cmd[k].map(function(m) {
                var c = typeof m.content === 'string' ? m.content : '';
                // Strip base64 data URLs from synced content
                c = c.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[image-data]');
                // v16.6: Raised per-message limit (was 2000/20000)
                var maxLen = cmd.source === 'studio' ? 100000 : 50000;
                if (c.length > maxLen) c = c.substring(0, maxLen) + '...[truncated]';
                return { role: m.role, content: c };
              });
            } else {
              clean[k] = cmd[k];
            }
          }
          return clean;
        });
        historyJson = JSON.stringify(toSync);
        if (historyJson.length <= MAX_FIELD_BYTES) break;
      }
      // Last resort: minimal metadata only
      if (historyJson.length > MAX_FIELD_BYTES) {
        var minimal = agentCommands.slice(-10).map(function(cmd) {
          return { id: cmd.id, brand: cmd.brand, mode: cmd.mode, time: cmd.time, command: (cmd.command || '').substring(0, 100) };
        });
        historyJson = JSON.stringify(minimal);
      }
      convos.agentHistoryJson = historyJson;
    } catch (e) {
      console.warn('[Firebase Sync] Could not stringify agentCommands:', e.message);
    }
  }

  return convos;
}

// Collect user knowledge for sync
function collectKnowledge() {
  var knowledge = {};

  // Brand knowledge
  // v30.1: Wrap JSON.parse in try/catch with type guard to prevent malformed data crashes
  for (var i = 0; i < 5; i++) {
    var brandKnowledge = localStorage.getItem('roweos_knowledge_' + i);
    if (brandKnowledge) {
      try { var _bk = JSON.parse(brandKnowledge); if (typeof _bk === 'object') knowledge['brand_' + i] = _bk; } catch(e) { console.warn('[collectKnowledge] malformed brand_' + i); }
    }
  }

  // Global user knowledge
  var userKnowledge = localStorage.getItem('roweos_user_knowledge');
  if (userKnowledge) {
    try { var _uk = JSON.parse(userKnowledge); if (typeof _uk === 'object') knowledge.user = _uk; } catch(e) { console.warn('[collectKnowledge] malformed user knowledge'); }
  }
  
  return knowledge;
}

// Load data from Firebase
function loadFromFirebase(showNotification) {
  // v15.0: Redirect to subcollection-based load
  if (showNotification === undefined) showNotification = true;
  console.log('[Firebase] Redirecting to loadFromFirebaseV2...');
  // v24.4: Always skip mode sync on login — mode is per-device, user picks from welcome screen
  return loadFromFirebaseV2(showNotification, true);
}

async function loadFromFirebaseV1_legacy(showNotification) {
  if (showNotification === undefined) showNotification = true;
  console.log('Firebase: loadFromFirebaseV1_legacy called, firebaseUser =', firebaseUser ? firebaseUser.uid : 'null');

  if (!firebaseUser || !firebase) {
    console.log('Firebase: loadFromFirebaseV1_legacy aborted - firebaseUser:', !!firebaseUser, 'firebase:', !!firebase);
    return Promise.resolve();
  }

  updateSyncIndicator('syncing');

  return firebase.firestore()
    .collection('roweos_users')
    .doc(firebaseUser.uid)
    .get()
    .then(function(doc) {
      if (doc.exists) {
        var data = doc.data();
        applyCloudData(data);
        updateSyncStatus('pull');

        var lastSync = new Date().toLocaleString();
        var cloudDevice = (data.meta && data.meta.lastDevice) ? data.meta.lastDevice : null;
        updateLastSyncDisplay(lastSync, cloudDevice);
        localStorage.setItem('roweos_last_sync', lastSync);
        if (cloudDevice) localStorage.setItem('roweos_last_sync_device', cloudDevice);

        updateSyncIndicator('connected');

        if (showNotification) {
          showToast('Loaded from cloud', 'success');
        }
        reloadAllData();
      }
    })
    .catch(function(error) {
      console.error('Firebase load error:', error);
      updateSyncIndicator('error');
    });
}

// Apply cloud data to local storage
function applyCloudData(data) {
  // Brands — v20.9: Don't overwrite if local has more brands than cloud
  if (data.brands && data.brands.length > 0) {
    var localBCount = 0;
    try { localBCount = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brands) || '[]').length; } catch(e) {}
    if (data.brands.length >= localBCount) {
      localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(data.brands));
      console.log('Firebase: Loaded', data.brands.length, 'brands');
    } else {
      console.warn('Firebase: Cloud has', data.brands.length, 'brands but local has', localBCount, '— keeping local');
    }
  }
  
  if (data.brandSettings) {
    // v24.10: Skip if user just saved model config locally
    var _skipApply = (typeof _brandModelConfigSavedAt !== 'undefined' && _brandModelConfigSavedAt > 0 && (Date.now() - _brandModelConfigSavedAt) < _BRAND_MODEL_CONFIG_GRACE);
    if (!_skipApply) {
      localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(data.brandSettings));
      // v24.4: Also update in-memory brandSettings so UI reflects cloud data without page reload
      try { brandSettings = JSON.parse(JSON.stringify(data.brandSettings)); } catch(e) {}
    } else {
      console.log('[applyCloudData] Skipping brandSettings overwrite — local model config saved recently');
    }
  }

  // v12.2.7: Conversations (gated by sync category)
  if (data.conversations && shouldSyncCategory('brandai_chats')) {
    if (data.conversations.history) {
      localStorage.setItem('roweos_conversations', JSON.stringify(data.conversations.history));
    }
    if (data.conversations.current && data.conversations.current.messages) {
      if (typeof currentConversation !== 'undefined') {
        currentConversation.length = 0;
        Array.prototype.push.apply(currentConversation, data.conversations.current.messages);
      }
    }
    if (data.conversations.agentHistoryJson) {
      try {
        var parsed = JSON.parse(data.conversations.agentHistoryJson);
        if (typeof agentCommands !== 'undefined' && Array.isArray(parsed)) {
          agentCommands.length = 0;
          Array.prototype.push.apply(agentCommands, parsed);
        }
      } catch (e) {
        console.warn('[Firebase] Could not parse agentHistoryJson:', e.message);
      }
    } else if (data.conversations.agentHistory) {
      if (typeof agentCommands !== 'undefined') {
        agentCommands.length = 0;
        Array.prototype.push.apply(agentCommands, data.conversations.agentHistory);
      }
    }
  }
  
  // v12.2.7: Knowledge (gated by sync category)
  if (data.knowledge && shouldSyncCategory('knowledge')) {
    Object.keys(data.knowledge).forEach(function(key) {
      if (key.startsWith('brand_')) {
        localStorage.setItem('roweos_knowledge_' + key.replace('brand_', ''), JSON.stringify(data.knowledge[key]));
      } else if (key === 'user') {
        localStorage.setItem('roweos_user_knowledge', JSON.stringify(data.knowledge[key]));
      }
    });
  }
  
  // v12.2.7: Operations (gated by sync category)
  // v23.16: Merge runs by ID instead of replacing — prevents sync from wiping local runs
  if (data.runs && shouldSyncCategory('runs')) {
    var existingRunsObj = {};
    try { existingRunsObj = JSON.parse(localStorage.getItem('roweos_runs') || '{}'); } catch(e) { console.warn('[Sync] Corrupted roweos_runs data:', e.message); }
    if (Array.isArray(existingRunsObj)) existingRunsObj = { runs: existingRunsObj };
    var localRuns = existingRunsObj.runs || [];
    var cloudRuns = Array.isArray(data.runs) ? data.runs : (data.runs.runs || []);
    // Merge: keep all local runs, add cloud runs not already present
    var localIds = {};
    for (var _ri = 0; _ri < localRuns.length; _ri++) {
      if (localRuns[_ri].id) localIds[localRuns[_ri].id] = true;
    }
    for (var _rj = 0; _rj < cloudRuns.length; _rj++) {
      if (!cloudRuns[_rj].id || !localIds[cloudRuns[_rj].id]) {
        localRuns.push(cloudRuns[_rj]);
      }
    }
    // Sort by id (timestamp) and keep last 50
    localRuns.sort(function(a, b) { return (a.id || 0) - (b.id || 0); });
    existingRunsObj.runs = localRuns.slice(-50);
    localStorage.setItem('roweos_runs', JSON.stringify(existingRunsObj));
  }
  if (data.customOps) localStorage.setItem('roweos_custom_operations', JSON.stringify(data.customOps));
  // v30.0: Legacy roweos_clients restore disabled — data now in roweos_people
  if (data.pinnedOps) localStorage.setItem('roweos_pinnedOps', JSON.stringify(data.pinnedOps));
  if (data.recentOps) localStorage.setItem('roweos_recentOps', JSON.stringify(data.recentOps));
  
  // v9.1.14: AI-generated brand operations
  if (data.generatedBrandOps) {
    localStorage.setItem('roweos_generated_brand_ops', JSON.stringify(data.generatedBrandOps));
    if (typeof generatedBrandOps !== 'undefined') {
      generatedBrandOps.length = 0;
      Array.prototype.push.apply(generatedBrandOps, data.generatedBrandOps);
    }
    console.log('[Firebase] Loaded', data.generatedBrandOps.length, 'generated brand ops');
  }
  
  // v7.10: Brand Memory (document uploads with AI summaries)
  if (data.brandMemory) {
    localStorage.setItem('roweos_brand_memory', JSON.stringify(data.brandMemory)); // v12.2.6: Use canonical key
    if (typeof brandMemory !== 'undefined') {
      Object.assign(brandMemory, data.brandMemory);
    }
    console.log('[Firebase] Loaded brandMemory');
  }
  
  // v22.26: Restore deleted automation IDs from V1 BEFORE loading automations
  if (data.deletedAutomationIds && typeof _deletedAutomationIds !== 'undefined') {
    var v1Deleted = data.deletedAutomationIds;
    Object.keys(v1Deleted).forEach(function(k) {
      if (!_deletedAutomationIds[k]) _deletedAutomationIds[k] = v1Deleted[k];
    });
    _persistDeletedIds();
  }

  // v12.2.7: Calendar (gated by sync category)
  if (data.calendar && shouldSyncCategory('calendar')) localStorage.setItem('roweos_calendar', JSON.stringify(data.calendar));
  // v24.14: V1 automation load — merge by updatedAt like V2 (was raw overwrite, clobbering local edits)
  if (data.automations) {
    var v1Autos = data.automations;
    if (typeof _deletedAutomationIds !== 'undefined' && Object.keys(_deletedAutomationIds).length > 0) {
      v1Autos = v1Autos.filter(function(a) { return !_deletedAutomationIds[String(a.id)]; });
    }
    var localAutos = [];
    try { localAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}
    var v1Merged = {};
    v1Autos.forEach(function(a) { v1Merged[String(a.id)] = a; });
    localAutos.forEach(function(a) {
      var aId = String(a.id);
      if (typeof _deletedAutomationIds !== 'undefined' && _deletedAutomationIds[aId]) return;
      if (!v1Merged[aId]) {
        v1Merged[aId] = a;
      } else {
        var cloudUp = v1Merged[aId].updatedAt ? new Date(v1Merged[aId].updatedAt).getTime() : 0;
        var localUp = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        if (localUp >= cloudUp) v1Merged[aId] = a;
      }
    });
    localStorage.setItem('roweos_automations', JSON.stringify(Object.keys(v1Merged).map(function(k) { return v1Merged[k]; })));
  }
  if (data.scheduledTasks) {
    var v1Tasks = data.scheduledTasks;
    if (typeof _deletedAutomationIds !== 'undefined' && Object.keys(_deletedAutomationIds).length > 0) {
      v1Tasks = v1Tasks.filter(function(t) { return !_deletedAutomationIds[String(t.id)]; });
    }
    localStorage.setItem('roweos_scheduled_tasks', JSON.stringify(v1Tasks));
  }
  if (data.scheduledPrompts) localStorage.setItem('roweosScheduledPrompts', JSON.stringify(data.scheduledPrompts));
  
  // v25.0: BrandAI To-Do items (gated by sync category) — Firestore is truth
  if (data.todos && shouldSyncCategory('brand_todos')) localStorage.setItem('roweosTodos', JSON.stringify(data.todos));
  if (data.todoCategories && shouldSyncCategory('brand_todos')) {
    localStorage.setItem('roweos_todo_categories', JSON.stringify(data.todoCategories));
  }
  if (data.taskHistory && shouldSyncCategory('brand_todos')) localStorage.setItem('roweos_task_history', JSON.stringify(data.taskHistory));
  // v26.3: Custom sidebar layout from Firestore
  if (data.customSidebar) {
    try { localStorage.setItem('roweos_custom_sidebar', JSON.stringify(data.customSidebar)); } catch(e) {}
  }
  // v22.25: Automation execution history
  if (data.autoLabHistory && shouldSyncCategory('calendar')) {
    var localALH = [];
    try { localALH = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]'); } catch(e) {}
    // Merge: cloud + local, dedup by timestamp, keep newest 50
    var alhMap = {};
    localALH.forEach(function(h) { alhMap[h.timestamp || h.id || JSON.stringify(h)] = h; });
    (data.autoLabHistory || []).forEach(function(h) { alhMap[h.timestamp || h.id || JSON.stringify(h)] = h; });
    var mergedALH = Object.keys(alhMap).map(function(k) { return alhMap[k]; });
    mergedALH.sort(function(a, b) { return new Date(b.timestamp || 0) - new Date(a.timestamp || 0); });
    if (mergedALH.length > 50) mergedALH = mergedALH.slice(0, 50);
    localStorage.setItem('roweos_auto_lab_history', JSON.stringify(mergedALH));
  }
  if (data.completedAutomations && shouldSyncCategory('calendar')) {
    var localCA = [];
    try { localCA = JSON.parse(localStorage.getItem('roweos_completed_automations') || '[]'); } catch(e) {}
    var caMap = {};
    localCA.forEach(function(c) { caMap[c.id || c.taskId || JSON.stringify(c)] = c; });
    (data.completedAutomations || []).forEach(function(c) { caMap[c.id || c.taskId || JSON.stringify(c)] = c; });
    var mergedCA = Object.keys(caMap).map(function(k) { return caMap[k]; });
    mergedCA.sort(function(a, b) { return new Date(b.timestamp || 0) - new Date(a.timestamp || 0); });
    if (mergedCA.length > 100) mergedCA = mergedCA.slice(0, 100);
    localStorage.setItem('roweos_completed_automations', JSON.stringify(mergedCA));
  }

  // Settings
  if (data.settings) {
    // v30.1: Respect device-local theme preference (matches V3 guard)
    var _hasLocalTheme = localStorage.getItem('roweos-theme') || localStorage.getItem('roweos_theme');
    if (!_hasLocalTheme) {
      if (data.settings.theme === 'light' && !document.documentElement.classList.contains('light-mode')) {
        toggleTheme();
      } else if (data.settings.theme === 'dark' && document.documentElement.classList.contains('light-mode')) {
        toggleTheme();
      }
    }
    // v12.0.2: Restore advanced feature settings
    if (data.settings.webSearchPrefs) {
      localStorage.setItem('roweos_web_search_prefs', JSON.stringify(data.settings.webSearchPrefs));
    }
    if (data.settings.claudeWebSearch !== undefined) {
      localStorage.setItem('roweos_claude_web_search', data.settings.claudeWebSearch ? 'true' : 'false');
    }
    if (data.settings.geminiWebSearch !== undefined) {
      localStorage.setItem('roweos_gemini_web_search', data.settings.geminiWebSearch ? 'true' : 'false');
    }
    if (data.settings.autoPilot !== undefined) {
      localStorage.setItem('roweos_feature_autoPilot', data.settings.autoPilot ? 'true' : 'false');
    }
    if (data.settings.responseCache !== undefined) {
      localStorage.setItem('roweos_feature_responseCache', data.settings.responseCache ? 'true' : 'false');
    }
    if (data.settings.crossModeEnabled !== undefined) {
      localStorage.setItem('roweos_cross_mode_enabled', data.settings.crossModeEnabled ? 'true' : 'false');
    }
    // v22.24: Sidebar order
    if (data.settings.sidebarOrder) {
      // v22.24: Stored as JSON string in Firestore (nested arrays not supported)
      var sidebarVal = typeof data.settings.sidebarOrder === 'string' ? data.settings.sidebarOrder : JSON.stringify(data.settings.sidebarOrder);
      localStorage.setItem('roweos_sidebar_order', sidebarVal);
      if (typeof applySidebarOrder === 'function') applySidebarOrder();
    }
    // v30.1: Restore sidebar mode preference
    if (data.settings.sidebarMode) {
      localStorage.setItem('roweos_sidebar_mode', data.settings.sidebarMode);
      if (typeof applySidebarMode === 'function') applySidebarMode();
    }
    // v22.39: App zoom level
    if (data.settings.appZoom) {
      localStorage.setItem('roweos_app_zoom', data.settings.appZoom);
      if (typeof setAppZoom === 'function') setAppZoom(parseInt(data.settings.appZoom));
    }
    if (data.settings.textSize) {
      localStorage.setItem('roweos_text_size', data.settings.textSize);
      if (typeof setTextSize === 'function') setTextSize(parseInt(data.settings.textSize));
    }
  }

  // v9.1.14: Focus view settings
  if (data.focus) {
    if (data.focus.streak !== undefined) localStorage.setItem('roweosStreak', String(data.focus.streak));
    if (data.focus.todoFilterMode) localStorage.setItem('roweosTodoFilterMode', data.focus.todoFilterMode);
    if (data.focus.taskViewMode) localStorage.setItem('roweos_task_view_mode', data.focus.taskViewMode);
    if (data.focus.lastStreakDate) localStorage.setItem('roweosLastStreakDate', data.focus.lastStreakDate);
  }
  
  // v12.2.7: Inventory (gated by sync category)
  if (data.inventory && shouldSyncCategory('inventory')) {
    var fbInvData = typeof data.inventory === 'string' ? JSON.parse(data.inventory) : data.inventory;
    var fbItems = fbInvData.items || [];
    var fbUpdatedAt = fbInvData.updatedAt || '1970-01-01';
    
    // Get local inventory
    var localInvRaw = localStorage.getItem('roweos_inventory');
    var localInv = localInvRaw ? JSON.parse(localInvRaw) : { items: [], categories: [] };
    var localItems = localInv.items || [];
    var localUpdatedAt = localInv.updatedAt || '1970-01-01';
    
    console.log('[Firebase] Inventory comparison - Local:', localItems.length, 'items @', localUpdatedAt, '| Cloud:', fbItems.length, 'items @', fbUpdatedAt);
    
    // SMART MERGE: Only overwrite if Firebase has MORE items OR is NEWER
    // This prevents losing locally added items
    if (fbItems.length > localItems.length || (fbItems.length === localItems.length && fbUpdatedAt > localUpdatedAt)) {
      localStorage.setItem('roweos_inventory', JSON.stringify(fbInvData));
      if (typeof inventory !== 'undefined') {
        inventory.items = fbItems;
        inventory.categories = fbInvData.categories || ['General', 'Products', 'Services', 'Digital', 'Consulting'];
        inventory.updatedAt = fbUpdatedAt;
      }
      console.log('[Firebase] Loaded inventory from cloud:', fbItems.length, 'items');
      if (typeof renderInventoryGrid === 'function') renderInventoryGrid();
      if (typeof updateInventoryStats === 'function') updateInventoryStats();
    } else if (localItems.length > fbItems.length) {
      // Local has MORE items - keep local and push to Firebase
      console.log('[Firebase] Keeping local inventory (more items):', localItems.length, 'vs', fbItems.length);
      // Trigger a sync to push local data to Firebase
      if (typeof syncInventoryToFirebase === 'function') {
        setTimeout(function() { syncInventoryToFirebase(); }, 1000);
      }
    } else {
      console.log('[Firebase] Keeping local inventory (same or newer)');
    }
  } else if (typeof inventory !== 'undefined' && inventory.items && inventory.items.length > 0) {
    // Firebase has NO inventory but local does - push local to Firebase
    console.log('[Firebase] No cloud inventory, keeping local:', inventory.items.length, 'items');
    if (typeof syncInventoryToFirebase === 'function') {
      setTimeout(function() { syncInventoryToFirebase(); }, 1000);
    }
  }
  
  // v12.2.7: Library (gated by sync category)
  if (data.library && shouldSyncCategory('library')) {
    var libraryStr = typeof data.library === 'string' ? data.library : JSON.stringify(data.library);
    localStorage.setItem('roweosLibrary', libraryStr);
    if (typeof fileLibrary !== 'undefined') {
      try {
        var libData = typeof data.library === 'string' ? JSON.parse(data.library) : data.library;
        Object.keys(fileLibrary).forEach(function(key) { delete fileLibrary[key]; });
        Object.assign(fileLibrary, libData);
      } catch (e) { console.warn('[Firebase] Library parse error:', e.message); }
    }
    console.log('[Firebase] Loaded library data');
  }
  
  // v10.5.25: LifeAI data (profiles, user name, mode, accent color)
  if (data.lifeAI) {
    if (data.lifeAI.profiles && Array.isArray(data.lifeAI.profiles) && data.lifeAI.profiles.length > 0) {
      localStorage.setItem('roweos_life_profiles', JSON.stringify(data.lifeAI.profiles));
    }
    if (data.lifeAI.currentProfileIdx !== undefined) {
      localStorage.setItem('roweos_current_life_profile_idx', String(data.lifeAI.currentProfileIdx));
    }
    if (data.lifeAI.currentProfile) {
      localStorage.setItem('roweos_life_profile', JSON.stringify(data.lifeAI.currentProfile));
    }
    if (data.lifeAI.userName) {
      localStorage.setItem('roweos_user_name', data.lifeAI.userName);
    }
    // v24.4: Don't overwrite mode if user explicitly selected one from welcome screen or cross-device sync
    // v30.1: App mode is DEVICE-LOCAL — cloud never overwrites it (like theme)
    // Each device remembers its own last mode. Cloud mode caused cross-device mode switching
    // (e.g. iOS in LifeAI mode would force desktop to LifeAI on next load)
    if (data.lifeAI.appMode && !localStorage.getItem('roweos_app_mode')) {
      // Only seed on first load (no local preference yet)
      localStorage.setItem('roweos_app_mode', data.lifeAI.appMode);
      localStorage.setItem('roweos_mode', data.lifeAI.appMode);
    }
    // v10.5.25: Restore mode-specific accent colors from Firebase
    // Sync light mode accent if available
    if (data.lifeAI.accentLightMode) {
      localStorage.setItem('roweos_life_accent_light_mode', data.lifeAI.accentLightMode);
      localStorage.setItem('roweos_life_accent_light_mode_dark', data.lifeAI.accentLightModeDark || darkenColor(data.lifeAI.accentLightMode, 20));
    }
    // Sync dark mode accent if available
    if (data.lifeAI.accentDarkMode) {
      localStorage.setItem('roweos_life_accent_dark_mode', data.lifeAI.accentDarkMode);
      localStorage.setItem('roweos_life_accent_dark_mode_dark', data.lifeAI.accentDarkModeDark || darkenColor(data.lifeAI.accentDarkMode, 20));
    }
    // Legacy: only use single accentColor if no mode-specific colors exist
    if (data.lifeAI.accentColor && !data.lifeAI.accentLightMode && !data.lifeAI.accentDarkMode) {
      localStorage.setItem('roweos_life_accent_color', data.lifeAI.accentColor);
      localStorage.setItem('roweos_life_accent_dark', data.lifeAI.accentDark || darkenColor(data.lifeAI.accentColor, 20));
    }
    // v10.5.25: Reload JS variables from localStorage to keep picker UI in sync
    if (typeof initLifeAccentColor === 'function') {
      initLifeAccentColor();
    }
    // Apply the correct accent for current theme mode
    if (typeof applyCurrentModeAccent === 'function') {
      applyCurrentModeAccent();
    }
    // Update the System view picker UI if visible
    if (typeof updateLifeAccentPickerUI === 'function') {
      updateLifeAccentPickerUI();
    }
    // v10.5.25: Restore LifeAI main system prompt
    if (data.lifeAI.mainSystemPrompt) {
      localStorage.setItem('roweos_life_main_prompt', data.lifeAI.mainSystemPrompt);
    }
    // v10.5.25: Restore LifeAI generated operations
    if (data.lifeAI.generatedOps && Array.isArray(data.lifeAI.generatedOps)) {
      localStorage.setItem('roweos_generated_life_ops', JSON.stringify(data.lifeAI.generatedOps));
      if (typeof generatedLifeOps !== 'undefined') {
        generatedLifeOps.length = 0;
        Array.prototype.push.apply(generatedLifeOps, data.lifeAI.generatedOps);
      }
      console.log('[Firebase] Loaded', data.lifeAI.generatedOps.length, 'generated LifeAI ops');
    }
    // v12.2.7: Restore LifeAI Library (gated by sync category)
    if (data.lifeAI.library && shouldSyncCategory('library')) {
      var lifeLibStr = typeof data.lifeAI.library === 'string' ? data.lifeAI.library : JSON.stringify(data.lifeAI.library);
      localStorage.setItem('roweos_life_library', lifeLibStr);
      console.log('[Firebase] Loaded LifeAI library');
    }
    // v12.2.4: Restore LifeAI goals, routines, habits
    if (data.lifeAI.goals) localStorage.setItem('roweos_life_goals', JSON.stringify(data.lifeAI.goals));
    if (data.lifeAI.routines) localStorage.setItem('roweos_life_routines', JSON.stringify(data.lifeAI.routines));
    if (data.lifeAI.habits) localStorage.setItem('roweos_life_habits', JSON.stringify(data.lifeAI.habits));
    // v25.0: LifeAI todo categories — Firestore is truth, no tombstone merge
    if (data.lifeAI.todoCategories) {
      localStorage.setItem('roweos_life_todo_categories', JSON.stringify(data.lifeAI.todoCategories));
    }
    // v12.2.7: Restore LifeAI todos (gated by sync category)
    if (data.lifeAI.todos && shouldSyncCategory('life_todos')) localStorage.setItem('roweos_life_todos', JSON.stringify(data.lifeAI.todos));
    if (data.lifeAI.todoCategories && shouldSyncCategory('life_todos')) {
      localStorage.setItem('roweos_life_todo_categories', JSON.stringify(data.lifeAI.todoCategories));
    }
    // v12.2.7: Restore LifeAI calendar (gated by sync category)
    if (data.lifeAI.calendar && shouldSyncCategory('calendar')) localStorage.setItem('roweos_life_calendar', JSON.stringify(data.lifeAI.calendar));
    // v12.2.7: Restore LifeAI conversations (gated by sync category)
    if (data.lifeAI.agentCommands && Array.isArray(data.lifeAI.agentCommands) && shouldSyncCategory('lifeai_chats')) {
      localStorage.setItem('roweos_life_agentCommands', JSON.stringify(data.lifeAI.agentCommands));
      console.log('[Firebase] Loaded LifeAI conversations:', data.lifeAI.agentCommands.length);
    }
    console.log('[Firebase] Loaded LifeAI data, userName:', data.lifeAI.userName, 'accentLight:', data.lifeAI.accentLightMode, 'accentDark:', data.lifeAI.accentDarkMode);
  }

  // v12.2.7: Journal (gated by sync category)
  if (data.journal && Array.isArray(data.journal) && shouldSyncCategory('journal')) {
    localStorage.setItem('roweos_journal', JSON.stringify(data.journal));
    console.log('[Firebase] Loaded journal entries:', data.journal.length);
  }
  // v25.0: Pulse — Firestore is truth, no tombstone merge needed
  if (data.pulse) {
    if (data.pulse.goals && shouldSyncCategory('goals')) {
      localStorage.setItem('roweos_pulse_goals', JSON.stringify(data.pulse.goals));
    }
    if (data.pulse.journal) localStorage.setItem('roweos_pulse_journal', JSON.stringify(data.pulse.journal));
    if (data.pulse.insights) localStorage.setItem('roweos_pulse_insights', JSON.stringify(data.pulse.insights));
    if (data.pulse.entries) localStorage.setItem('roweos_pulse2_entries', JSON.stringify(data.pulse.entries));
    console.log('[Firebase] Loaded Pulse data');
  }

  // v12.2.4: Guardrails
  if (data.guardrails) {
    localStorage.setItem('roweos_guardrails', JSON.stringify(data.guardrails));
    console.log('[Firebase] Loaded guardrails');
  }

  // v23.16: Commerce/Analytics data
  if (data.commerce) {
    localStorage.setItem('roweos_commerce', JSON.stringify(data.commerce));
    console.log('[Firebase] Loaded commerce data');
  }

  // v12.2.4: Focus 2.0 layouts
  if (data.focus2Layouts) {
    if (data.focus2Layouts.widgetOrder) localStorage.setItem('roweos_focus2_widget_order', JSON.stringify(data.focus2Layouts.widgetOrder));
    if (data.focus2Layouts.widgetSizes) localStorage.setItem('roweos_focus2_widget_sizes', JSON.stringify(data.focus2Layouts.widgetSizes));
    if (data.focus2Layouts.categoryOrder) localStorage.setItem('roweos_focus2_category_order', JSON.stringify(data.focus2Layouts.categoryOrder));
    if (data.focus2Layouts.unifiedOrder) localStorage.setItem('roweos_focus2_unified_order', JSON.stringify(data.focus2Layouts.unifiedOrder));
    if (data.focus2Layouts.calendarOrientation) localStorage.setItem('roweos_focus2_calendar_orientation', data.focus2Layouts.calendarOrientation);
    console.log('[Firebase] Loaded Focus 2.0 layouts');
  }

  // v12.2.4: AutoPilot data
  if (data.autoPilot) {
    if (data.autoPilot.learnings) localStorage.setItem('roweos_autopilot_learnings', JSON.stringify(data.autoPilot.learnings));
    if (data.autoPilot.queue) localStorage.setItem('roweos_autopilot_queue', JSON.stringify(data.autoPilot.queue));
    console.log('[Firebase] Loaded AutoPilot data');
  }

  // v12.2.4: Load per-brand/mode logos from Firebase
  // v23.9: Skip logo restoration from root doc — logos are stored in V2 subcollection.
  // Root doc logos field may contain truncated data from V1 era (50% cut off).
  // loadFromFirebaseV2() will load full logos from the subcollection instead.
  if (data.logos || data.brandLogo) {
    console.log('[Firebase] Skipping logo restore from root doc (V2 subcollection handles logos)');
  }
  
  // v15.7: ES5-safe optional chaining replacement
  lastCloudUpdate = (data.meta && data.meta.lastUpdated && typeof data.meta.lastUpdated.toDate === 'function') ? data.meta.lastUpdated.toDate() : new Date();
}

// v9.1.14: Debounce reloadAllData to prevent constant refreshing (especially on iPadOS)
var lastReloadTime = 0;
var MIN_RELOAD_INTERVAL = 10000; // 10 seconds minimum between reloads
// v24.4: Persist lastLocalSaveTime across page reloads so onSnapshot doesn't overwrite unsent changes
var lastLocalSaveTime = parseInt(localStorage.getItem('roweos_last_local_save') || '0', 10);
var LOCAL_SAVE_GRACE_PERIOD = 5000; // 5 seconds grace period after local save
function stampLocalSave() { lastLocalSaveTime = Date.now(); try { localStorage.setItem('roweos_last_local_save', String(lastLocalSaveTime)); } catch(e) {} }

function reloadAllData() {
  // v11.0.5: Skip reload if we just saved locally (prevents animation glitch on same device)
  var now = Date.now();
  if (now - lastLocalSaveTime < LOCAL_SAVE_GRACE_PERIOD) {
    console.log('[Firebase] reloadAllData skipped (local save grace period, ' + Math.floor((now - lastLocalSaveTime) / 1000) + 's ago)');
    return;
  }
  
  // Prevent reloading more than once every 10 seconds
  if (now - lastReloadTime < MIN_RELOAD_INTERVAL) {
    console.log('Firebase: reloadAllData skipped (too soon, last reload was ' + Math.floor((now - lastReloadTime) / 1000) + 's ago)');
    return;
  }
  lastReloadTime = now;
  console.log('Firebase: reloadAllData called - refreshing all UI');
  try {
    if (typeof loadBrands === 'function') {
      loadBrands();
      console.log('Firebase: loadBrands completed');
    }
    // v15.13: Re-apply mode UI (fixes brand name showing in LifeAI mode after sync)
    var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    if (typeof updateModeUI === 'function') {
      updateModeUI(currentMode);
    }
    // v15.8: Re-apply accent color after Firebase sync updates brands
    if (typeof applyCurrentBrandAccent === 'function') {
      applyCurrentBrandAccent();
    }
    // v15.13: Re-apply LifeAI accent color after sync
    if (typeof initLifeAccentColor === 'function') {
      initLifeAccentColor();
    }
    if (typeof loadCurrentLogo === 'function') {
      loadCurrentLogo();
    }
    if (typeof loadRuns === 'function') loadRuns();
    if (typeof loadCustomOperations === 'function') loadCustomOperations(); // v16.11: Reload custom ops after sync
    if (typeof renderOperations === 'function') renderOperations();
    // v16.11: Re-render clients view after sync
    if (currentView === 'clients' && typeof renderClientsView === 'function') renderClientsView();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderAgentHistory === 'function') renderAgentHistory();
    if (typeof updateMemoryUI === 'function') updateMemoryUI();
    if (typeof syncMobileBrandV2 === 'function') syncMobileBrandV2();
    if (typeof renderScheduleCalendar === 'function') renderScheduleCalendar();
    if (typeof initScheduledPrompts === 'function') initScheduledPrompts();
    if (typeof initTodos === 'function') initTodos();
    if (typeof initTodoCategories === 'function') initTodoCategories();
    // v23.16: Reload guardrails after sync so in-memory config matches localStorage
    if (typeof loadGuardrails === 'function') loadGuardrails();
    // v23.16: Reload commerce data after sync
    if (typeof loadCommerceData === 'function') loadCommerceData();
    
    // v9.1.14: Render Focus view to show synced To-Do items
    if (typeof renderFocusView === 'function') renderFocusView();
    
    // v10.5.25: Reload library from localStorage after Firebase sync
    if (typeof initLibrary === 'function') initLibrary();
    if (typeof renderLibrary === 'function') renderLibrary();
    
    // Also update brand dropdowns
    if (typeof updateBrandSelectors === 'function') {
      setTimeout(function() {
        updateBrandSelectors(true);
        // v18.8: Re-apply brand name + logo AFTER selectors are rebuilt to prevent stale display
        if (typeof updateBrandName === 'function') updateBrandName();
        if (typeof loadCurrentLogo === 'function') loadCurrentLogo();
        if (typeof populateSidebarBrandDropdown === 'function') populateSidebarBrandDropdown();
      }, 100);
    }

    // v15.9: Refresh sync hub displays after data reload
    if (typeof updateSyncHubStatus === 'function') updateSyncHubStatus();
    if (typeof renderSyncInventory === 'function') renderSyncInventory().then(function() {
      if (typeof refreshStorageDisplays === 'function') refreshStorageDisplays();
    });

    // Show toast if brands loaded
    var brandsStr = localStorage.getItem(USER_DATA_KEYS.brands);
    if (brandsStr) {
      try {
        var reloadedBrands = JSON.parse(brandsStr);
        if (reloadedBrands && reloadedBrands.length > 0) {
          console.log('Firebase: Brands loaded successfully, count:', reloadedBrands.length);
        }
      } catch(e2) {}
    }
  } catch (e) {
    console.error('Firebase: Error in reloadAllData:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS (mycinder-style)
// ═══════════════════════════════════════════════════════════════════════════════

function setupRealtimeSync() {
  if (!firebaseUser || !firebase) return;

  // v28.0: Use v4 unified listeners instead of old per-collection listeners
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    console.log('[SetupSync] v4 active -- using syncEngine.setupListeners() instead');
    syncEngine.setupListeners();
    return;
  }

  try {
    // Clear existing subscriptions
    firebaseUnsubscribers.forEach(function(unsub) {
      if (typeof unsub === 'function') unsub();
    });
    firebaseUnsubscribers = [];

    console.log('[Firebase] Setting up real-time sync (V3)...');

    var db = firebase.firestore();
    var basePath = 'roweos_users/' + firebaseUser.uid;

    // v15.7: Listen to root doc for cross-device detection
    var unsubRoot = db.doc(basePath).onSnapshot(function(doc) {
      if (!doc.exists) return;
      var data = doc.data();
      // v24.15: Cross-device check BEFORE grace period — never block updates from other devices
      if (data.meta && data.meta.lastDeviceId && data.meta.lastDeviceId !== deviceId) {
        console.log('[Firebase V3] Cross-device update detected from ' + data.meta.lastDeviceId + ', pulling V2 data...');
        if (typeof loadFromFirebaseV2 === 'function') {
          // v24.2: Skip mode sync on cross-device updates to prevent mode flipping
          loadFromFirebaseV2(false, true);
        } else {
          applyCloudData(data);
          reloadAllData();
        }
        updateSyncIndicator('connected');
        return;
      }
      // v24.15: Same-device echo — short grace period only (was 30s, now 5s)
      var now = Date.now();
      if (now - lastLocalSaveTime < 5000) {
        console.log('[Firebase V3] Same-device echo skipped (' + Math.floor((now - lastLocalSaveTime) / 1000) + 's ago)');
        return;
      }
    }, function(error) {
      if (error.code === 'permission-denied') {
        console.log('[Firebase] Real-time sync unavailable - check Firestore rules');
        updateSyncIndicator('offline');
      } else {
        console.log('[Firebase] Real-time sync error:', error.message || error);
        updateSyncIndicator('error');
      }
    });
    firebaseUnsubscribers.push(unsubRoot);

    // v15.7: Listen to library subcollection for cross-device library changes
    var unsubLibrary = db.doc(basePath + '/library/brand').onSnapshot(function(doc) {
      if (doc.metadata.hasPendingWrites) return; // v25.0: Local echo, skip
      if (!doc.exists) return;
      var libData = doc.data();
      if (libData && libData.data && shouldSyncCategory('library')) {
        console.log('[Firebase V3] Library update from cloud');
        safeSyncWrite('roweosLibrary', libData.data);
        try {
          var parsed = typeof libData.data === 'string' ? JSON.parse(libData.data) : libData.data;
          Object.keys(fileLibrary).forEach(function(key) { if (key !== '_life') delete fileLibrary[key]; });
          var keys = Object.keys(parsed);
          for (var i = 0; i < keys.length; i++) { fileLibrary[keys[i]] = parsed[keys[i]]; }
        } catch(e) { console.warn('[Firebase V3] Library parse error:', e); }
        if (typeof renderLibrary === 'function') renderLibrary();
      }
    }, function() { /* silent */ });
    firebaseUnsubscribers.push(unsubLibrary);

    // v15.7: Listen to LifeAI library
    var unsubLifeLib = db.doc(basePath + '/library/life').onSnapshot(function(doc) {
      if (doc.metadata.hasPendingWrites) return; // v25.0: Local echo, skip
      if (!doc.exists) return;
      var libData = doc.data();
      if (libData && libData.data && shouldSyncCategory('library')) {
        console.log('[Firebase V3] LifeAI library update from cloud');
        safeSyncWrite('roweos_life_library', libData.data);
        try {
          fileLibrary['_life'] = typeof libData.data === 'string' ? JSON.parse(libData.data) : libData.data;
        } catch(e) { /* silent */ }
      }
    }, function() { /* silent */ });
    firebaseUnsubscribers.push(unsubLifeLib);

    // v15.9: Listen to brands subcollection for cross-device brand color/identity changes
    var unsubBrands = db.collection(basePath + '/brands').onSnapshot(function(snapshot) {
      if (snapshot.metadata.hasPendingWrites) return; // v25.0: Local echo, skip
      // v27.0: Skip if we just saved locally (grace period prevents race condition)
      if (typeof lastLocalSaveTime !== 'undefined' && Date.now() - lastLocalSaveTime < 10000) {
        console.log('[Firebase V3] Brands listener skipped -- local save within 10s');
        return;
      }
      // v25.2: Brands should never be truly empty (default brand exists).
      // Log instead of silently returning.
      if (snapshot.empty) {
        console.warn('[Firebase V3.1] Brands snapshot is empty -- skipping (safety net)');
        return;
      }
      console.log('[Firebase V3] Brands update from cloud -', snapshot.size, 'docs');
      // v28.3: Always prefer individual docs over _all doc (prevents data loss from subset fields)
      var brandsArr = [];
      snapshot.forEach(function(doc) {
        if (doc.id !== '_all') { brandsArr.push(doc.data()); }
      });
      if (brandsArr.length === 0) {
        // Fallback only if no individual docs
        snapshot.forEach(function(doc) {
          if (doc.id === '_all' && doc.data().items) { brandsArr = doc.data().items; }
        });
        console.log('[Firebase V3] Brands: fallback to _all doc (' + brandsArr.length + ')');
      }
      // v27.0: Merge using brand name as stable ID (old brands lack id field, name is always unique)
      var _localBrandsForMerge = [];
      try { _localBrandsForMerge = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brands) || '[]'); } catch(e) {}
      // Backfill id using name-based hash for brands that lack a proper id
      function _brandStableId(b, idx) {
        if (b.id && b.id.indexOf('brand_cloud_') !== 0 && b.id.indexOf('brand_local_') !== 0) return b.id;
        return 'brand_name_' + (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
      }
      for (var _cbi = 0; _cbi < brandsArr.length; _cbi++) {
        brandsArr[_cbi].id = _brandStableId(brandsArr[_cbi], _cbi);
      }
      for (var _lbi = 0; _lbi < _localBrandsForMerge.length; _lbi++) {
        _localBrandsForMerge[_lbi].id = _brandStableId(_localBrandsForMerge[_lbi], _lbi);
      }
      // v27.0: Safe merge -- NEVER drop local-only brands (same logic as loadFromFirebaseV2)
      var _bmRt = {};
      var _bmRtOrder = [];
      for (var _ri1 = 0; _ri1 < brandsArr.length; _ri1++) {
        var _rk1 = brandsArr[_ri1].id;
        if (_rk1) { _bmRt[_rk1] = brandsArr[_ri1]; _bmRtOrder.push(_rk1); }
      }
      for (var _ri2 = 0; _ri2 < _localBrandsForMerge.length; _ri2++) {
        var _rk2 = _localBrandsForMerge[_ri2].id;
        if (!_rk2) continue;
        if (_bmRt[_rk2]) {
          var _cTs = _normalizeTs(_bmRt[_rk2]._modifiedAt);
          var _lTs = _normalizeTs(_localBrandsForMerge[_ri2]._modifiedAt);
          if (_lTs >= _cTs) _bmRt[_rk2] = _localBrandsForMerge[_ri2];
        } else {
          _bmRt[_rk2] = _localBrandsForMerge[_ri2];
          _bmRtOrder.push(_rk2);
        }
      }
      var _mergedBrands = [];
      _bmRtOrder.forEach(function(k) { if (_bmRt[k]) _mergedBrands.push(_bmRt[k]); });
      console.log('[Firebase V3] Brands safe merge: cloud=' + brandsArr.length + ' local=' + _localBrandsForMerge.length + ' merged=' + _mergedBrands.length);
      localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(_mergedBrands));
      // Update in-memory brands array
      if (typeof brands !== 'undefined') {
        brands.length = 0;
        for (var bi = 0; bi < _mergedBrands.length; bi++) { brands.push(_mergedBrands[bi]); }
      }
      // v27.3: Clamp selectedBrand against MERGED brands (not cloud-only brandsArr)
      if (typeof selectedBrand === 'number' && selectedBrand >= _mergedBrands.length) {
        selectedBrand = Math.max(0, _mergedBrands.length - 1);
        try { localStorage.setItem('roweos_selected_brand', String(selectedBrand)); } catch(e) {}
      }
      // Re-apply brand accent color and refresh UI
      if (typeof applyCurrentBrandAccent === 'function') applyCurrentBrandAccent();
      // v15.15: Only reload logo if brand logo data actually changed
      try {
        var curLogoKey = typeof getCurrentLogoKey === 'function' ? getCurrentLogoKey() : '';
        var curLogo = curLogoKey ? localStorage.getItem(curLogoKey) : '';
        var cloudBrand = brandsArr[selectedBrand || 0];
        if (cloudBrand && cloudBrand.logo !== curLogo) {
          if (typeof loadCurrentLogo === 'function') loadCurrentLogo();
        }
      } catch(logoE) {
        if (typeof loadCurrentLogo === 'function') loadCurrentLogo();
      }
      if (typeof updateBrandName === 'function') updateBrandName();
      if (typeof populateSidebarBrandDropdown === 'function') populateSidebarBrandDropdown();
      if (typeof syncBrandDropdowns === 'function') syncBrandDropdowns();
    }, function() { /* silent */ });
    firebaseUnsubscribers.push(unsubBrands);

    // v15.9: Listen to profile doc for cross-device settings/brandSettings changes
    var unsubProfile = db.doc(basePath + '/profile/main').onSnapshot(function(doc) {
      if (doc.metadata.hasPendingWrites) return; // v25.0: Local echo, skip
      if (!doc.exists) return;
      var profile = doc.data();
      console.log('[Firebase V3] Profile update from cloud');
      // v24.10: Skip brandSettings merge if user just saved model config locally (prevents revert)
      var _skipBrandSettingsMerge = (typeof _brandModelConfigSavedAt !== 'undefined' && (Date.now() - _brandModelConfigSavedAt) < _BRAND_MODEL_CONFIG_GRACE);
      if (profile.brandSettings && !_skipBrandSettingsMerge) {
        _mergeCloudBrandSettings(profile.brandSettings);
        // Refresh in-memory brandSettings from localStorage (merge may have kept local)
        if (typeof brandSettings !== 'undefined') {
          try {
            var mergedSettings = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}');
            Object.keys(mergedSettings).forEach(function(k) { brandSettings[k] = mergedSettings[k]; });
          } catch(e3) {}
        }
      } else if (_skipBrandSettingsMerge) {
        console.log('[Firebase V3] Skipping brandSettings merge — local model config saved ' + (Date.now() - _brandModelConfigSavedAt) + 'ms ago');
      }
      // v28.3: Theme is device-local, never overwrite from real-time sync
      // v29.0: Real-time primary brand sync across devices
      if (profile.settings && profile.settings.primaryBrandId) {
        var _currentPrimaryId = localStorage.getItem('roweos_primary_brand_id');
        if (_currentPrimaryId !== profile.settings.primaryBrandId) {
          localStorage.setItem('roweos_primary_brand_id', profile.settings.primaryBrandId);
          if (profile.settings.primaryBrand != null) {
            localStorage.setItem('roweos_primary_brand', String(profile.settings.primaryBrand));
          }
          // Resolve index from ID in case brands were reordered on this device
          if (typeof brands !== 'undefined') {
            for (var _pbi = 0; _pbi < brands.length; _pbi++) {
              if (brands[_pbi].id === profile.settings.primaryBrandId) {
                localStorage.setItem('roweos_primary_brand', String(_pbi));
                // v28.6: Also update selected brand if no explicit selection was made on this device
                if (!localStorage.getItem('roweos_selected_brand_id')) {
                  selectedBrand = _pbi;
                  localStorage.setItem('roweos_selected_brand', String(_pbi));
                  localStorage.setItem('roweos_selected_brand_id', profile.settings.primaryBrandId);
                  if (typeof onBrandChange === 'function') try { onBrandChange(); } catch(e) {}
                }
                break;
              }
            }
          }
          console.log('[Firebase V3] Primary brand synced from cloud:', profile.settings.primaryBrandId);
        }
      }
      // v28.6: Real-time todoCategories sync (prevents Focus category resurrection)
      if (profile.todoCategories && Array.isArray(profile.todoCategories)) {
        var _catKey = typeof getTodoCategoriesKey === 'function' ? getTodoCategoriesKey() : 'roweos_todo_categories';
        localStorage.setItem(_catKey, JSON.stringify(profile.todoCategories));
        if (typeof window !== 'undefined') window.todoCategories = profile.todoCategories;
        console.log('[Firebase V3] Todo categories synced from cloud:', profile.todoCategories.length);
      }
      // v19.0: Real-time social connection sync (desktop → mobile)
      if (profile.socialConnections) {
        var sc = profile.socialConnections;
        Object.keys(sc).forEach(function(key) {
          var parts = key.match(/^(x|threads|instagram)(_brand_\d+|_life_\d+)$/);
          if (!parts) return;
          var p = parts[1];
          var s = parts[2];
          var entry = sc[key];
          if (entry.connected) {
            localStorage.setItem('roweos_social_' + p + '_connected' + s, 'true');
            if (entry.handle) localStorage.setItem('roweos_social_' + p + '_handle' + s, entry.handle);
            if (entry.token) localStorage.setItem('roweos_social_token_' + p + s, entry.token);
          } else {
            localStorage.removeItem('roweos_social_' + p + '_connected' + s);
            localStorage.removeItem('roweos_social_' + p + '_handle' + s);
            localStorage.removeItem('roweos_social_token_' + p + s);
          }
        });
        if (typeof refreshSocialAccountCards === 'function') refreshSocialAccountCards();
      }
    }, function() { /* silent */ });
    firebaseUnsubscribers.push(unsubProfile);

    // v15.9: Listen to todos subcollection for cross-device todo sync
    // v27.3: Listen to todos/main doc directly (not the collection -- collection push created nested {data:[...]} corruption)
    var unsubTodos = db.doc(basePath + '/todos/main').onSnapshot(function(doc) {
      if (doc.metadata.hasPendingWrites) return; // v25.0: Local echo, skip
      if (!shouldSyncCategory('brand_todos')) return;
      if (!doc.exists) {
        safeSyncWrite('roweosTodos', []);
        return;
      }
      var todosArr = doc.data().data || [];
      safeSyncWrite('roweosTodos', todosArr);
      console.log('[Firebase V3] Todos update from cloud -', todosArr.length, 'items');
      if (typeof initTodos === 'function') initTodos();
      if (typeof renderFocusView === 'function') renderFocusView();
    }, function() { /* silent */ });
    firebaseUnsubscribers.push(unsubTodos);

    // v27.3: Listen to calendar/main doc directly (same fix as todos -- collection push corrupted data)
    var unsubCalendar = db.doc(basePath + '/calendar/main').onSnapshot(function(doc) {
      if (doc.metadata.hasPendingWrites) return; // v25.0: Local echo, skip
      if (!shouldSyncCategory('calendar')) return;
      if (!doc.exists) {
        safeSyncWrite('roweos_calendar', []);
        return;
      }
      var calArr = doc.data().data || [];
      safeSyncWrite('roweos_calendar', calArr);
      console.log('[Firebase V3] Calendar update from cloud -', calArr.length, 'events');
      if (typeof renderCalendar === 'function') renderCalendar();
    }, function() { /* silent */ });
    firebaseUnsubscribers.push(unsubCalendar);

    // v25.0: Automations real-time listener
    var unsubAutomations = db.collection(basePath + '/automations').onSnapshot(function(snapshot) {
      if (snapshot.metadata.hasPendingWrites) return;
      if (!shouldSyncCategory('automations')) return;
      // v25.2: Cloud-authoritative -- empty snapshot means all automations deleted, safeSyncWrite handles it
      var cloudAutos = [];
      snapshot.forEach(function(doc) { cloudAutos.push(doc.data()); });
      // v28.6: Filter out deleted automations before merge (prevents resurrection)
      if (typeof _deletedAutomationIds !== 'undefined' && Object.keys(_deletedAutomationIds).length > 0) {
        cloudAutos = cloudAutos.filter(function(a) { return !_deletedAutomationIds[String(a.id)]; });
      }
      // v25.2: Use mergeByTimestamp for automations (per-item array needing merge)
      var _localAutos = [];
      try { _localAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}
      var _mergedAutos = mergeByTimestamp(_localAutos, cloudAutos, 'id');
      localStorage.setItem('roweos_automations', JSON.stringify(_mergedAutos));
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
    firebaseUnsubscribers.push(unsubAutomations);

    // v29.3: Pulse goals collection listener (per-goal documents)
    var unsubPulseGoals = db.collection(basePath + '/pulse_goals').onSnapshot(function(snapshot) {
      if (snapshot.metadata.hasPendingWrites) return;
      if (!shouldSyncCategory('goals')) return;
      var cloudGoals = [];
      snapshot.forEach(function(doc) {
        var g = doc.data();
        if (!g.id) g.id = doc.id;
        cloudGoals.push(g);
      });
      var _localGoals = [];
      try { _localGoals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]'); } catch(e) {}
      // Merge cloud goals with local via timestamp
      var _mergedGoals = mergeByTimestamp(_localGoals, cloudGoals, 'id');
      // v29.5: Only filter deletions if cloud has goals (empty collection = not yet migrated)
      if (cloudGoals.length > 0) {
        var cloudIdMap = {};
        cloudGoals.forEach(function(g) { if (g.id) cloudIdMap[g.id] = true; });
        var graceCutoff = Date.now() - 10000;
        _mergedGoals = _mergedGoals.filter(function(g) {
          if (cloudIdMap[g.id]) return true;
          if (g._modifiedAt && g._modifiedAt > graceCutoff) return true;
          return false;
        });
      }
      localStorage.setItem('roweos_pulse_goals', JSON.stringify(_mergedGoals));
      if (typeof pulseGoals !== 'undefined') pulseGoals = _mergedGoals;
      if (typeof renderPulseGoals === 'function') renderPulseGoals();
      if (typeof renderPulse3Overview === 'function') renderPulse3Overview();
      if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
      console.log('[Firebase V3.1] Pulse goals collection update:', cloudGoals.length, 'docs');
    }, function() {});
    firebaseUnsubscribers.push(unsubPulseGoals);

    // v29.3: Pulse/main doc listener for non-goal data (journal, entries, reminders)
    var unsubPulseMain = db.doc(basePath + '/pulse/main').onSnapshot(function(doc) {
      if (doc.metadata.hasPendingWrites) return;
      if (!doc.exists) return;
      var pulse = doc.data();
      if (pulse.journal !== undefined) safeSyncWrite('roweos_pulse_journal', pulse.journal);
      if (pulse.entries !== undefined) safeSyncWrite('roweos_pulse2_entries', pulse.entries);
      if (pulse.reminders !== undefined) safeSyncWrite('roweos_reminders', pulse.reminders);
      console.log('[Firebase V3.1] Pulse/main non-goal update');
    }, function() {});
    firebaseUnsubscribers.push(unsubPulseMain);

    console.log('[Firebase] Real-time sync V3 active (root + library + brands + profile + todos + calendar + automations + pulse listeners)');
  } catch (error) {
    console.log('[Firebase] Real-time sync setup failed - continuing offline');
    updateSyncIndicator('offline');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC STATUS TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

async function updateSyncStatus(action) {
  if (!firebaseUser || !firebase) return;
  
  try {
    await firebase.firestore()
      .collection('roweos_users')
      .doc(firebaseUser.uid)
      .collection('sync_status')
      .doc('latest')
      .set({
        action: action,
        device: getDeviceType(),
        deviceId: deviceId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent.substring(0, 50)
      });
  } catch (e) {
    // This is non-critical metadata - main data sync may still work
    // If this fails, it usually means Firestore rules need to be updated
    // to allow subcollection writes
    console.log('[Firebase] Sync status metadata skipped - non-critical');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function updateSyncIndicator(status) {
  var dotEl = document.getElementById('firebaseSyncDot');
  var statusEl = document.getElementById('firebaseSyncStatus');
  var diamondEl = document.getElementById('sidebarApiDiamond');
  
  if (!dotEl) return;
  
  // v11.0.5: Update diamond glow for sync status
  if (diamondEl) {
    // Check if we're transitioning from syncing to connected (sync success)
    var wasSyncing = diamondEl.classList.contains('syncing');
    
    diamondEl.classList.remove('syncing', 'sync-success');
    
    if (status === 'syncing') {
      diamondEl.classList.add('syncing');
      diamondEl.title = 'Syncing to cloud...';
    } else if (status === 'connected') {
      diamondEl.title = 'API Connected • Cloud synced';
      // v11.0.5: Flash success glow if we just finished syncing
      if (wasSyncing) {
        diamondEl.classList.add('sync-success');
        // Remove the class after animation completes so it can be triggered again
        setTimeout(function() {
          if (diamondEl) diamondEl.classList.remove('sync-success');
        }, 1200);
      }
    } else if (status === 'error') {
      diamondEl.title = 'Sync error';
    }
  }
  
  switch(status) {
    case 'connected':
      dotEl.style.background = '#22c55e';
      if (statusEl) statusEl.textContent = 'Connected • ' + ((firebaseUser ? firebaseUser.email : 'Synced')) // v30.1: ES5 fix;
      break;
    case 'syncing':
      dotEl.style.background = '#f59e0b';
      if (statusEl) statusEl.textContent = 'Syncing...';
      break;
    case 'error':
      dotEl.style.background = '#ef4444';
      if (statusEl) statusEl.textContent = 'Sync error';
      break;
    default:
      dotEl.style.background = '#888';
      if (statusEl) statusEl.textContent = 'Not connected';
  }
}

function updateLastSyncDisplay(time, device) {
  var el = document.getElementById('lastSyncedTime');
  var row = document.getElementById('lastSyncedRow');
  var badge = document.getElementById('syncStatusBadge');
  var deviceEl = document.getElementById('lastSyncedDevice');
  
  if (el) el.textContent = time || 'Never';
  if (row) row.style.display = firebaseUser ? 'flex' : 'none';
  if (badge) badge.style.display = firebaseUser ? 'inline' : 'none';
  
  // v7.10: Show which device last synced
  if (deviceEl && device) {
    var deviceIcon = getDeviceIcon(device);
    var deviceLabel = getDeviceLabel(device);
    deviceEl.innerHTML = deviceIcon + ' ' + deviceLabel;
    deviceEl.style.display = 'inline';
  } else if (deviceEl) {
    deviceEl.style.display = 'none';
  }
}

// v7.10: Get device icon for display
function getDeviceIcon(device) {
  // v9.1.14: SVG icons with explicit gold color for visibility in both modes
  var mobileIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a89878" stroke-width="2" style="vertical-align: middle;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>';
  var desktopIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a89878" stroke-width="2" style="vertical-align: middle;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
  var syncIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a89878" stroke-width="2" style="vertical-align: middle;"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';
  
  switch(device) {
    case 'ios': return mobileIcon;
    case 'android': return mobileIcon;
    case 'mobile': return mobileIcon;
    case 'desktop': return desktopIcon;
    default: return syncIcon;
  }
}

// v7.10: Get friendly device label
function getDeviceLabel(device) {
  switch(device) {
    case 'ios': return 'iOS';
    case 'android': return 'Android';
    case 'mobile': return 'Mobile';
    case 'desktop': return 'Desktop';
    default: return device || 'Unknown';
  }
}

// v7.10: Show/hide syncing indicator
function showSyncingIndicator(show) {
  var indicator = document.getElementById('syncingIndicator');
  if (indicator) indicator.style.display = show ? 'inline-flex' : 'none';
}

// v7.10: Periodic background sync (every 60 seconds, silent)
var periodicSyncInterval = null;

// v9.1.14: Periodic sync is now just a fallback (5 min) - primary sync is event-driven
function startPeriodicSync() {
  if (periodicSyncInterval) clearInterval(periodicSyncInterval);
  
  // 5 minute fallback - most syncs happen via queueBackgroundSync()
  periodicSyncInterval = setInterval(function() {
    if (firebaseUser && !isSyncing) {
      console.log('[Firebase] Fallback periodic sync (5min)');
      silentSyncToFirebase();
    }
  }, 300000); // 5 minutes
  
  console.log('[Firebase] Fallback periodic sync started (5min interval)');
}

function stopPeriodicSync() {
  if (periodicSyncInterval) {
    clearInterval(periodicSyncInterval);
    periodicSyncInterval = null;
    console.log('[Firebase] Periodic sync stopped');
  }
}

// v15.9: Silent sync — redirect to V2 subcollection sync (was V1 root doc, caused cross-device sync failure)
// v25.0: Silent sync is now a no-op (write-through handles all pushes)
async function silentSyncToFirebase() {
  // No-op: retained for backward compatibility
}

// ═══════════════════════════════════════════════════════════════════════════════
// v9.1.14: EVENT-DRIVEN BACKGROUND SYNC (replaces periodic sync)
// ═══════════════════════════════════════════════════════════════════════════════

var backgroundSyncTimeout = null;
var BACKGROUND_SYNC_DELAY = 2000; // 2 seconds debounce

// v9.1.14: Queue a background sync after user actions (no toast)
function queueBackgroundSync() {
  if (!firebaseUser) return;
  
  // Clear any pending sync
  if (backgroundSyncTimeout) clearTimeout(backgroundSyncTimeout);
  
  // Debounce: wait 2s after last action before syncing
  backgroundSyncTimeout = setTimeout(function() {
    if (firebaseUser && !isSyncing) {
      console.log('[Firebase] Background sync triggered by user action');
      silentSyncToFirebase();
    }
  }, BACKGROUND_SYNC_DELAY);
}

// Legacy support - redirect to new function
function triggerAutoSync() {
  queueBackgroundSync();
}

// v9.1.14: Hook into all data-changing functions
function setupBackgroundSyncHooks() {
  console.log('[Firebase] Installing background sync hooks...');
  
  // Brand changes
  var originalSaveBrands = typeof saveBrands === 'function' ? saveBrands : function(){};
  window.saveBrands = function() {
    originalSaveBrands.apply(this, arguments);
    queueBackgroundSync();
  };
  
  // Runs/conversations
  var originalSaveRuns = typeof saveRuns === 'function' ? saveRuns : function(){};
  window.saveRuns = function() {
    originalSaveRuns.apply(this, arguments);
    queueBackgroundSync();
  };
  
  // Calendar
  var originalSaveCalendar = typeof saveCalendar === 'function' ? saveCalendar : function(){};
  window.saveCalendar = function() {
    originalSaveCalendar.apply(this, arguments);
    queueBackgroundSync();
  };
  
  // Todos
  var originalSaveTodos = typeof saveTodos === 'function' ? saveTodos : function(){};
  window.saveTodos = function() {
    originalSaveTodos.apply(this, arguments);
    queueBackgroundSync();
  };
  
  // Automations
  var originalSaveAutomations = typeof saveAutomations === 'function' ? saveAutomations : function(){};
  window.saveAutomations = function() {
    originalSaveAutomations.apply(this, arguments);
    queueBackgroundSync();
  };
  
  // Custom operations
  var originalSaveCustomOps = typeof saveCustomOps === 'function' ? saveCustomOps : function(){};
  window.saveCustomOps = function() {
    originalSaveCustomOps.apply(this, arguments);
    queueBackgroundSync();
  };
  
  // Brand memory (documents)
  var originalSaveBrandMemory = typeof saveBrandMemory === 'function' ? saveBrandMemory : function(){};
  window.saveBrandMemory = function() {
    originalSaveBrandMemory.apply(this, arguments);
    queueBackgroundSync();
  };
  
  // Task history
  var originalSaveTaskHistory = typeof saveTaskHistory === 'function' ? saveTaskHistory : function(){};
  window.saveTaskHistory = function() {
    originalSaveTaskHistory.apply(this, arguments);
    queueBackgroundSync();
  };
  
  console.log('[Firebase] Background sync hooks installed');
}

// Legacy function name support
function setupAutoSyncHooks() {
  setupBackgroundSyncHooks();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED AUTH HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

function onFirebaseAuthReady(user) {
  firebaseUser = user;
  updateFirebaseSyncUI();
  updateFirebaseModalUI();
      updateCloudSyncUI();
  
  if (user) {
    console.log('Firebase: Signed in as', user.email);
    
    // Load cloud data
    loadFromFirebase(false).then(function() {
      // Set up real-time sync
      setupRealtimeSync();
      
      // Install auto-sync hooks
      setupAutoSyncHooks();
    });
    
    updateSyncIndicator('connected');
  } else {
    console.log('Firebase: Signed out');
    updateSyncIndicator('offline');
    
    // Clear subscriptions
    firebaseUnsubscribers.forEach(function(unsub) {
      if (typeof unsub === 'function') unsub();
    });
    firebaseUnsubscribers = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// v15.0: ACCESS KEY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

var ACCESS_KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1

function generateAccessKeyString() {
  var key = 'ROWE-';
  for (var i = 0; i < 4; i++) {
    key += ACCESS_KEY_CHARS.charAt(Math.floor(Math.random() * ACCESS_KEY_CHARS.length));
  }
  key += '-';
  for (var j = 0; j < 4; j++) {
    key += ACCESS_KEY_CHARS.charAt(Math.floor(Math.random() * ACCESS_KEY_CHARS.length));
  }
  return key;
}

// v27.1: Auto-generate access key for new users (Early Access)
// v30.4: Accept optional tier parameter from tier selection
function autoGenerateAccessKey(user, selectedTier) {
  if (!user || !user.uid || !firebase) return Promise.resolve(null);
  var db = firebase.firestore();
  var uid = user.uid;
  var email = user.email || '';
  var tierToUse = selectedTier || 'founder';

  // Check if user already has an access key
  return db.doc('roweos_users/' + uid).get().then(function(doc) {
    if (doc.exists && doc.data().accessKey) {
      console.log('[EarlyAccess] User already has key:', doc.data().accessKey);
      return doc.data().accessKey;
    }

    // Generate ROWE-XXXX-XXXX format key
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var part1 = '';
    var part2 = '';
    for (var i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    var accessKey = 'ROWE-' + part1 + '-' + part2;
    console.log('[EarlyAccess] Generated key:', accessKey, 'for', email, 'tier:', tierToUse);

    // Write to access_keys collection
    // v30.4: Trial keys get 14-day expiry (2 weeks)
    return db.doc('access_keys/' + accessKey).set({
      key: accessKey,
      email: email,
      status: 'active',
      tier: tierToUse,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      expiryAction: 'expire',
      autoGenerated: true,
      usedBy: uid,
      usedAt: new Date().toISOString()
    }).then(function() {
      // Link key to user profile
      return db.doc('roweos_users/' + uid).set({
        accessKey: accessKey,
        accessKeyAutoGenerated: true,
        email: email
      }, { merge: true });
    }).then(function() {
      console.log('[EarlyAccess] Key saved and linked:', accessKey);
      // v30.5: Update newsletter_subscribers with key + tier so Admin Signups tab shows it
      _updateSignupWithKey(email, accessKey, tierToUse);
      return accessKey;
    });
  }).catch(function(err) {
    console.error('[EarlyAccess] Key generation failed:', err);
    return null;
  });
}

// v30.5: Update the newsletter_subscribers doc with access key and tier after key is linked
function _updateSignupWithKey(email, accessKey, tier) {
  if (!email || !accessKey || !firebase) return;
  try {
    firebase.firestore().collection('newsletter_subscribers')
      .where('email', '==', email)
      .limit(1)
      .get()
      .then(function(snap) {
        if (!snap.empty) {
          snap.docs[0].ref.update({
            accessKey: accessKey,
            tier: tier || 'founder'
          }).then(function() {
            console.log('[Auth] Updated newsletter_subscribers with key for', email);
          });
        }
      }).catch(function(e) { console.warn('[Auth] _updateSignupWithKey error:', e.message); });
  } catch(e) {}
}

// v27.1: Send Early Access welcome email with access key
function sendEarlyAccessEmail(user, accessKey) {
  if (!user || !accessKey) return;
  var email = user.email;
  if (!email) return;

  var htmlBody = '';
  if (typeof generateBetaWelcomeEmail === 'function') {
    htmlBody = generateBetaWelcomeEmail(accessKey, 'Founder');
  } else {
    htmlBody = '<div style="font-family:sans-serif;padding:40px;"><h2>Welcome to RoweOS Early Access</h2><p>Your access key: <strong>' + accessKey + '</strong></p><p>Visit <a href="https://roweos.com">roweos.com</a> to get started.</p></div>';
  }

  fetch('/api/resend-welcome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email,
      subject: 'Welcome to RoweOS - Your Account is Ready',
      from: 'roweos@therowecollection.com',
      html: htmlBody,
      bcc: ['jordan@therowecollection.com'],
      uid: user.uid
    })
  }).then(function(res) {
    if (res.ok) {
      console.log('[EarlyAccess] Welcome email sent to', email);
    } else {
      console.warn('[EarlyAccess] Email send failed:', res.status);
    }
  }).catch(function(err) {
    console.error('[EarlyAccess] Email send error:', err);
  });
}

// v30.1: Use Firestore transaction to prevent TOCTOU race on access key claim
function validateAccessKey(keyString) {
  if (!keyString || !firebase) return Promise.resolve({ valid: false, error: 'No key provided' });

  var db = firebase.firestore();
  var keyRef = db.collection('access_keys').doc(keyString);
  return db.runTransaction(function(tx) {
    return tx.get(keyRef).then(function(doc) {
      if (!doc.exists) throw { valid: false, error: 'Invalid access key' };
      var data = doc.data();
      if (data.status === 'revoked') throw { valid: false, error: 'This key has been revoked' };
      if (data.usedBy && data.usedBy !== firebaseUser.uid) throw { valid: false, error: 'This key is already in use' };
      return { valid: true, data: data };
    });
  }).catch(function(err) {
    if (err && err.valid === false) return err;
    return { valid: false, error: 'Validation failed: ' + (err.message || err) };
  });
}

function linkAccessKeyToUser(keyString) {
  if (!firebaseUser || !firebase) return Promise.reject(new Error('Not signed in'));

  // v15.0: Write user profile first (user has permission for their own doc)
  var userRef = firebase.firestore().collection('roweos_users').doc(firebaseUser.uid);
  return userRef.set({
    accessKey: keyString,
    email: firebaseUser.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(function() {
    // Then try to mark key as used (requires write permission on access_keys)
    var keyRef = firebase.firestore().collection('access_keys').doc(keyString);
    return keyRef.update({
      usedBy: firebaseUser.uid,
      usedAt: firebase.firestore.FieldValue.serverTimestamp(),
      email: firebaseUser.email
    }).catch(function(err) {
      // If no permission to update key doc, that's OK - user profile has the key
      console.warn('[Auth] Could not update key doc (expected if rules restrict writes):', err.message);
    });
  });
}

// v20.6: Auto-detect unlinked access key by email on login
function autoDetectAccessKey() {
  if (!firebaseUser || !firebaseUser.email || !firebase) return Promise.resolve(false);

  // First check if user already has a key
  return checkUserAccessKey().then(function(existing) {
    if (existing.valid) return false; // Already has active key

    // Query access_keys collection for unlinked keys matching this email
    return firebase.firestore().collection('access_keys')
      .where('email', '==', firebaseUser.email)
      .where('status', '==', 'active')
      .limit(1)
      .get()
      .then(function(snap) {
        if (snap.empty) return false;
        var keyDoc = snap.docs[0];
        var keyData = keyDoc.data();
        var keyString = keyDoc.id;

        // Check if already used by someone else
        if (keyData.usedBy && keyData.usedBy !== firebaseUser.uid) return false;

        console.log('[RoweOS] Auto-detected access key for', firebaseUser.email, ':', keyString);

        // Link it to this user
        return linkAccessKeyToUser(keyString).then(function() {
          // v30.5: Update signup record with key + tier
          _updateSignupWithKey(firebaseUser.email, keyString, keyData.tier);
          // Store Stripe customer ID if present
          if (keyData.stripeCustomerId) {
            return firebase.firestore().collection('roweos_users').doc(firebaseUser.uid).set({
              stripeCustomerId: keyData.stripeCustomerId
            }, { merge: true }).then(function() {
              return true;
            });
          }
          return true;
        }).then(function(linked) {
          if (linked) {
            var tierLabel = (keyData.tier || 'solo').charAt(0).toUpperCase() + (keyData.tier || 'solo').slice(1);
            showToast('Access key auto-activated: ' + tierLabel + ' tier', 'success', 5000);
            _cachedUserTier = keyData.tier || 'solo';
            _cachedUserTierExpiry = Date.now() + 300000;
          }
          return linked;
        });
      }).catch(function(err) {
        console.warn('[RoweOS] Auto-detect key error:', err.message);
        return false;
      });
  });
}

// v21.0: Expiry enforcement added
function checkUserAccessKey() {
  if (!firebaseUser || !firebase) return Promise.resolve({ valid: false });

  return firebase.firestore().collection('roweos_users').doc(firebaseUser.uid).get()
    .then(function(doc) {
      if (!doc.exists || !doc.data().accessKey) return { valid: false };
      var keyString = doc.data().accessKey;
      return firebase.firestore().collection('access_keys').doc(keyString).get()
        .then(function(keyDoc) {
          if (!keyDoc.exists) return { valid: false };
          var keyData = keyDoc.data();
          var tier = keyData.tier;
          var isActive = keyData.status === 'active';
          // v21.0: Check expiry
          if (isActive && keyData.expiresAt) {
            var now = new Date();
            var expiry = new Date(keyData.expiresAt);
            if (now > expiry) {
              var action = keyData.expiryAction || 'expire';
              if (action === 'expire') {
                return { valid: false, tier: tier, key: keyString, expired: true };
              } else if (action === 'downgrade') {
                tier = 'solo';
              }
              // 'flag' — return actual tier, admin sees badge
            }
          }
          return { valid: isActive, tier: tier, key: keyString };
        });
    }).catch(function(err) {
      console.warn('[Auth] checkUserAccessKey error:', err.message);
      return { valid: false };
    });
}

// v21.0: Added expiresAt + expiryAction fields
function generateAccessKey(tier, note, expiresAt, expiryAction) {
  if (!isAdmin()) return Promise.reject(new Error('Admin only'));
  var keyString = generateAccessKeyString();
  var docData = {
    status: 'active',
    tier: tier || 'solo',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    usedBy: null,
    usedAt: null,
    email: null,
    note: note || ''
  };
  if (expiresAt) {
    docData.expiresAt = expiresAt;
    docData.expiryAction = expiryAction || 'expire';
  }
  return firebase.firestore().collection('access_keys').doc(keyString).set(docData)
    .then(function() { return keyString; });
}

function revokeAccessKey(keyString) {
  if (!isAdmin()) return Promise.reject(new Error('Admin only'));
  return firebase.firestore().collection('access_keys').doc(keyString).update({ status: 'revoked' });
}

// v16.0: Cached user tier for feature-gating
// v24.11: Default to 'founder' during beta so sidebar locks don't flash on first load
var _cachedUserTier = 'founder';
var _cachedUserTierExpiry = 0;

function getUserTier(forceRefresh) {
  // v20.7: Admin always gets premium — no key needed
  if (typeof isAdmin === 'function' && isAdmin()) {
    _cachedUserTier = 'premium';
    _cachedUserTierExpiry = Date.now() + 300000;
    return Promise.resolve('premium');
  }
  var now = Date.now();
  if (!forceRefresh && _cachedUserTier && now < _cachedUserTierExpiry) {
    return Promise.resolve(_cachedUserTier);
  }
  return checkUserAccessKey().then(function(result) {
    if (result.valid) {
      _cachedUserTier = result.tier || 'basic';
    } else {
      _cachedUserTier = 'free';
    }
    _cachedUserTierExpiry = now + 300000; // 5 min cache
    return _cachedUserTier;
  }).catch(function() {
    _cachedUserTier = 'free';
    _cachedUserTierExpiry = now + 60000; // 1 min on error
    return _cachedUserTier;
  });
}

function hasFeatureAccess(feature) {
  // v30.1: Tier alignment update — studio, identity, analytics, mail moved to Solo
  // Solo ($29): 1 brand, 1 life, chat, library, memory, pulse, rhythm, studio, identity, analytics, mail
  // Founder ($59): Everything in Solo + 5 brands, 5 life, automations agent, pipelines, social, pulse, sync
  // Premium ($79): Everything in Founder + 15 brands, 15 life, private onboarding, white-label, multi-user
  // Backwards compat: 'basic' = solo (rank 1), 'pro' = founder (rank 2), 'enterprise' = premium (rank 3)
  var tierRank = { free: 0, basic: 1, solo: 1, founder: 2, pro: 2, premium: 3, enterprise: 3 };
  var featureMinTier = {
    // Solo tier — basic access, basic automations, studio, identity, analytics, mail
    export: 'solo',
    basicAutomations: 'solo',
    studio: 'solo',       // v30.1: moved from founder
    identity: 'solo',     // v30.1: moved from founder
    analytics: 'solo',    // v30.1: moved from founder
    mail: 'solo',         // v30.1: moved from founder
    // Founder tier — advanced automation, social, sync
    sync: 'founder',
    brandConfig: 'founder',
    automations: 'founder',
    automationsAgent: 'founder',
    pipelines: 'founder',
    social: 'founder',
    focus: 'founder',
    // Premium tier — expensive/exclusive features
    bloom: 'premium',
    brandSharing: 'premium',
    whiteLabel: 'premium',
    multiUser: 'premium',
    privateOnboarding: 'premium'
  };
  var minTier = featureMinTier[feature] || 'solo';
  var userRank = tierRank[_cachedUserTier] || 0;
  var minRank = tierRank[minTier] || 0;
  return userRank >= minRank;
}

// v20.7: Brand/profile count limits per tier
function getMaxBrands() {
  var tier = _cachedUserTier || 'free';
  var limits = { free: 1, solo: 1, basic: 1, founder: 5, pro: 5, premium: 15, enterprise: 15 };
  return limits[tier] || 1;
}

function getMaxLifeProfiles() {
  var tier = _cachedUserTier || 'free';
  var limits = { free: 1, solo: 1, basic: 1, founder: 5, pro: 5, premium: 15, enterprise: 15 };
  return limits[tier] || 1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// v24.11: TIER ENFORCEMENT — Upgrade Modal, View Gates, Sidebar Locks
// ═══════════════════════════════════════════════════════════════════════════════

// v24.11: Feature-friendly display names
var FEATURE_DISPLAY_NAMES = {
  bloom: 'Bloom', studio: 'Studio', automations: 'Automations', automationsAgent: 'Automations Agent',
  pipelines: 'Pipelines', social: 'Social Publishing', focus: 'Pulse', analytics: 'Analytics', // v30.1: Focus renamed to Pulse
  identity: 'Identity', mail: 'Mail', sync: 'Cloud Sync', brandSharing: 'Brand Sharing',
  whiteLabel: 'White Label', multiUser: 'Multi-User', privateOnboarding: 'Private Onboarding'
};

// v24.11: Map view names to feature keys for gate checks
var VIEW_FEATURE_MAP = {
  bloom: 'bloom', studio: 'studio', signal: 'focus', commerce: 'analytics',
  memory: 'identity', mail: 'mail', sync: 'sync', research: 'research'
};

// v24.11: Upgrade modal — shows contextual upgrade options based on current tier
function showUpgradeModal(feature, requiredTier) {
  // Admin always bypasses
  if (typeof isAdmin === 'function' && isAdmin()) return false;

  var currentTier = _cachedUserTier || 'free';
  var featureName = FEATURE_DISPLAY_NAMES[feature] || feature;
  var tierLabel = requiredTier === 'premium' ? 'Premium' : 'Founder';

  // Build tier cards based on what the user can upgrade to
  var cards = '';
  if (currentTier === 'solo' || currentTier === 'basic' || currentTier === 'free') {
    cards += '<div style="flex:1;min-width:200px;padding:20px;border:1px solid var(--border-color);border-radius:var(--radius-lg);background:var(--bg-secondary);cursor:pointer;transition:all 0.2s;" ' +
      'onclick="closeUpgradeModal();if(typeof openCheckoutForTier===\'function\')openCheckoutForTier(\'founder\');" ' +
      'onmouseover="this.style.borderColor=\'#a89878\'" onmouseout="this.style.borderColor=\'var(--border-color)\'">' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:8px;">Recommended</div>' +
      '<div style="font-size:20px;font-weight:700;color:#a89878;margin-bottom:4px;">Founder</div>' +
      '<div style="font-size:24px;font-weight:700;color:var(--text-primary);">$59<span style="font-size:13px;font-weight:400;color:var(--text-muted);">/mo</span></div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-top:10px;line-height:1.6;">Automations Agent, Pipelines, Social, Pulse, Cloud Sync</div>' + // v30.1: updated for tier changes
      '<div style="margin-top:14px;padding:10px;background:linear-gradient(135deg,#a89878,#d4b896);color:#0a0a0a;border-radius:var(--radius-md);text-align:center;font-size:13px;font-weight:600;">Upgrade to Founder</div>' +
      '</div>';
  }
  cards += '<div style="flex:1;min-width:200px;padding:20px;border:1px solid var(--border-color);border-radius:var(--radius-lg);background:var(--bg-secondary);cursor:pointer;transition:all 0.2s;" ' +
    'onclick="closeUpgradeModal();if(typeof openCheckoutForTier===\'function\')openCheckoutForTier(\'premium\');" ' +
    'onmouseover="this.style.borderColor=\'#d4af37\'" onmouseout="this.style.borderColor=\'var(--border-color)\'">' +
    '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:8px;">Full Access</div>' +
    '<div style="font-size:20px;font-weight:700;color:#d4af37;margin-bottom:4px;">Premium</div>' +
    '<div style="font-size:24px;font-weight:700;color:var(--text-primary);">$79<span style="font-size:13px;font-weight:400;color:var(--text-muted);">/mo</span></div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-top:10px;line-height:1.6;">Everything in Founder + Bloom, Brand Sharing, Private Onboarding</div>' +
    '<div style="margin-top:14px;padding:10px;background:linear-gradient(135deg,#d4af37,#f0d060);color:#0a0a0a;border-radius:var(--radius-md);text-align:center;font-size:13px;font-weight:600;">Upgrade to Premium</div>' +
    '</div>';

  var existing = document.getElementById('upgradeModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'upgradeModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);animation:fadeIn 0.2s ease;';
  modal.onclick = function(e) { if (e.target === modal) closeUpgradeModal(); };
  modal.innerHTML =
    '<div style="max-width:520px;width:90%;padding:28px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-xl);box-shadow:0 20px 60px rgba(0,0,0,0.4);" onclick="event.stopPropagation()">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#d4af37" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        '<span style="font-size:18px;font-weight:700;color:var(--text-primary);">' + tierLabel + ' Feature</span>' +
      '</div>' +
      '<p style="font-size:13px;color:var(--text-muted);margin:0 0 20px;line-height:1.5;">' +
        '<strong style="color:var(--text-primary);">' + escapeHtml(featureName) + '</strong> requires a ' + tierLabel + ' plan or higher.' +
      '</p>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;">' + cards + '</div>' +
      '<div style="text-align:center;margin-top:16px;">' +
        '<button onclick="closeUpgradeModal()" style="background:none;border:none;color:var(--text-muted);font-size:12px;cursor:pointer;padding:8px 16px;">Maybe later</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  return true; // blocked
}

function closeUpgradeModal() {
  var modal = document.getElementById('upgradeModal');
  if (modal) modal.remove();
}

// v24.11: Check view access and show upgrade modal if blocked. Returns true if blocked.
function checkViewAccess(viewName) {
  // Admin always passes
  if (typeof isAdmin === 'function' && isAdmin()) return false;
  var feature = VIEW_FEATURE_MAP[viewName];
  if (!feature) return false; // no gate for this view
  if (hasFeatureAccess(feature)) return false; // user has access
  // Blocked — show upgrade modal
  // v30.1: studio, analytics, identity, mail moved to solo
  var featureMinTier = { bloom: 'premium', brandSharing: 'premium', studio: 'solo', automations: 'founder', automationsAgent: 'founder', pipelines: 'founder', social: 'founder', focus: 'founder', analytics: 'solo', identity: 'solo', mail: 'solo', sync: 'founder' };
  var requiredTier = featureMinTier[feature] || 'founder';
  showUpgradeModal(feature, requiredTier);
  return true; // blocked
}

// v24.11: Update sidebar lock icons based on tier
function updateSidebarTierLocks() {
  // v30.1: Default to hidden - locked features shown only when user enables
  var showLocked = localStorage.getItem('roweos_show_locked_features') === 'true';
  var navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
  for (var i = 0; i < navItems.length; i++) {
    var item = navItems[i];
    var viewName = item.getAttribute('data-view');
    var feature = VIEW_FEATURE_MAP[viewName];
    // Remove existing lock
    var existingLock = item.querySelector('.nav-tier-lock');
    if (existingLock) existingLock.remove();

    if (!feature) continue; // no gate
    var hasAccess = (typeof isAdmin === 'function' && isAdmin()) || hasFeatureAccess(feature);
    if (hasAccess) {
      item.style.display = '';
      continue;
    }
    // User doesn't have access
    if (!showLocked) {
      item.style.display = 'none';
    } else {
      item.style.display = '';
      var lock = document.createElement('span');
      lock.className = 'nav-tier-lock';
      lock.style.cssText = 'margin-left:auto;opacity:0.4;display:flex;align-items:center;flex-shrink:0;';
      lock.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      item.appendChild(lock);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// v20.3: BRAND CONFIG SHARING
// ═══════════════════════════════════════════════════════════════════════════════

function claimBrandConfig(code) {
  if (!firebase || !firebaseUser) {
    showToast('Please sign in first', 'error');
    return Promise.reject(new Error('Not signed in'));
  }
  code = (code || '').trim();
  if (!code) {
    showToast('Invalid config code', 'error');
    return Promise.reject(new Error('No code'));
  }

  console.log('[BrandConfig] Claiming config:', code);
  showToast('Loading brand config...', 'info');

  return firebase.firestore().collection('brand_configs').doc(code).get()
    .then(function(doc) {
      if (!doc.exists) {
        showToast('Config code not found', 'error');
        throw new Error('Config not found');
      }
      var config = doc.data();
      if (!config.active) {
        showToast('This config has been deactivated', 'error');
        throw new Error('Config inactive');
      }
      // v20.3: Invite-only configs have no brands — just validate and welcome
      if (!config.brands || !config.brands.length) {
        firebase.firestore().collection('brand_configs').doc(code).update({
          usageCount: firebase.firestore.FieldValue.increment(1)
        }).catch(function(e) {});
        try { localStorage.removeItem('roweos_pending_join'); } catch(e) {}
        var inviteName = config.name || 'RoweOS';
        showToast('Welcome to ' + inviteName + '! Set up your brand to get started.', 'success');
        console.log('[BrandConfig] Invite-only config claimed:', code);
        return;
      }

      var existingCount = (brands && brands.length) ? brands.length : 0;
      var isReplace = existingCount === 0;

      if (isReplace) {
        // v20.3: Fresh user — replace entirely
        brands = config.brands.slice();
        saveBrands();

        // Write brandSettings
        if (config.brandSettings) {
          try { localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(config.brandSettings)); } catch(e) {}
        }

        // Write brand memory for each index
        if (config.memory) {
          Object.keys(config.memory).forEach(function(key) {
            try { localStorage.setItem(key, JSON.stringify(config.memory[key])); } catch(e) {}
          });
        }

        // Write custom ops
        if (config.customOps && config.customOps.length) {
          try {
            generatedBrandOps = config.customOps.slice();
            localStorage.setItem('roweos_generated_brand_ops', JSON.stringify(generatedBrandOps));
          } catch(e) {}
        }
      } else {
        // v20.3: Existing user — merge/append brands
        var offset = existingCount;
        config.brands.forEach(function(brand) {
          // Check for duplicate by name
          var dup = brands.some(function(b) { return b.name && b.name.toLowerCase() === (brand.name || '').toLowerCase(); });
          if (!dup) {
            brands.push(brand);
          }
        });
        saveBrands();

        // Offset brandSettings keys
        if (config.brandSettings) {
          var existing = {};
          try { existing = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}'); } catch(e) {}
          Object.keys(config.brandSettings).forEach(function(key) {
            var newKey = String(parseInt(key, 10) + offset);
            if (!existing[newKey]) {
              existing[newKey] = config.brandSettings[key];
            }
          });
          try { localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(existing)); } catch(e) {}
        }

        // Offset memory keys
        if (config.memory) {
          Object.keys(config.memory).forEach(function(key) {
            // key format: "brand_0", "brand_1", etc.
            var match = key.match(/^brand_(\d+)$/);
            if (match) {
              var newKey = 'brand_' + (parseInt(match[1], 10) + offset);
              if (!localStorage.getItem(newKey)) {
                try { localStorage.setItem(newKey, JSON.stringify(config.memory[key])); } catch(e) {}
              }
            }
          });
        }

        // Merge custom ops (avoid duplicates by name)
        if (config.customOps && config.customOps.length) {
          var existingNames = generatedBrandOps.map(function(o) { return o.name; });
          config.customOps.forEach(function(op) {
            if (existingNames.indexOf(op.name) === -1) {
              generatedBrandOps.push(op);
            }
          });
          try { localStorage.setItem('roweos_generated_brand_ops', JSON.stringify(generatedBrandOps)); } catch(e) {}
        }
      }

      // Increment usage count on Firestore doc
      firebase.firestore().collection('brand_configs').doc(code).update({
        usageCount: firebase.firestore.FieldValue.increment(1)
      }).catch(function(e) { console.warn('[BrandConfig] Could not increment usage:', e.message); });

      // Refresh UI
      selectedBrandIdx = 0;
      syncBrandDropdowns();
      onBrandChange();

      // Remove pending join
      try { localStorage.removeItem('roweos_pending_join'); } catch(e) {}

      var configName = config.name || config.brands[0].name || 'Brand';
      showToast('Welcome to ' + configName + '! Brand config loaded.', 'success');
      console.log('[BrandConfig] Config claimed successfully:', code, '(' + config.brands.length + ' brands)');

      // v25.1: saveBrands() already writes through to Firestore
    })
    .catch(function(err) {
      console.error('[BrandConfig] Error claiming config:', err);
      if (err.message !== 'Config not found' && err.message !== 'Config inactive' && err.message !== 'No brands in config') {
        showToast('Error loading brand config', 'error');
      }
      try { localStorage.removeItem('roweos_pending_join'); } catch(e) {}
      throw err;
    });
}

function joinBrandConfigFromSettings() {
  var input = document.getElementById('joinBrandConfigInput');
  if (!input || !input.value.trim()) {
    showToast('Please enter a config code', 'error');
    return;
  }
  claimBrandConfig(input.value.trim()).then(function() {
    if (input) input.value = '';
  }).catch(function() {});
}

function adminGenerateBrandConfig() {
  if (!isAdmin()) return;

  // v20.3: Name field — required for invite-only, auto-filled for brand data configs
  var nameInput = document.getElementById('adminBrandConfigName');
  var configName = nameInput ? nameInput.value.trim() : '';

  // v20.3: Custom slug or auto-generated code
  var slugInput = document.getElementById('adminBrandConfigSlug');
  var customSlug = slugInput ? slugInput.value.trim() : '';
  var code;
  if (customSlug) {
    code = customSlug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    if (!code) {
      showToast('Invalid slug: use letters, numbers, hyphens', 'error');
      return;
    }
  } else {
    code = generateAccessKeyString();
  }

  // v20.3: Brand selection — invite only, single brand, or all
  var brandSelect = document.getElementById('adminBrandConfigBrand');
  var brandVal = brandSelect ? brandSelect.value : 'invite';
  var configBrands = [];
  var configSettings = {};
  var configMemory = {};
  var configOps = [];

  if (brandVal === 'invite') {
    // Invite-only: no brand data, client sets up their own
    if (!configName) {
      showToast('Enter a brand or client name', 'error');
      if (nameInput) nameInput.focus();
      return;
    }
    // Empty arrays — claimBrandConfig will see brands.length === 0 and skip data load
    configBrands = [];
  } else {
    if (!brands || !brands.length) {
      showToast('No brands to share', 'error');
      return;
    }

    var allSettings = {};
    try { allSettings = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}'); } catch(e) {}
    var allOps = [];
    try { allOps = JSON.parse(localStorage.getItem('roweos_generated_brand_ops') || '[]'); } catch(e) {}

    if (brandVal === 'all') {
      configBrands = brands.slice();
      configSettings = allSettings;
      brands.forEach(function(b, idx) {
        try {
          var mem = localStorage.getItem('brand_' + idx);
          if (mem) configMemory['brand_' + idx] = JSON.parse(mem);
        } catch(e) {}
      });
      configOps = allOps;
    } else {
      var idx = parseInt(brandVal, 10);
      if (!brands[idx]) {
        showToast('Brand not found', 'error');
        return;
      }
      configBrands = [brands[idx]];
      if (allSettings[String(idx)]) {
        configSettings['0'] = allSettings[String(idx)];
      }
      try {
        var mem = localStorage.getItem('brand_' + idx);
        if (mem) configMemory['brand_0'] = JSON.parse(mem);
      } catch(e) {}
      var brandName = brands[idx].name;
      configOps = allOps.filter(function(o) {
        return !o.generatedForBrand || o.generatedForBrand === brandName;
      });
    }

    // Fall back to brand name if no custom name entered
    if (!configName && configBrands.length) {
      configName = configBrands[0].shortName || configBrands[0].name || 'Brand Config';
    }
  }

  if (!configName) configName = 'Brand Config';

  var configDoc = {
    code: code,
    name: configName,
    brands: configBrands,
    brandSettings: configSettings,
    memory: configMemory,
    customOps: configOps,
    type: brandVal === 'invite' ? 'invite' : 'data',
    createdBy: firebaseUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    usageCount: 0,
    active: true
  };

  firebase.firestore().collection('brand_configs').doc(code).set(configDoc)
    .then(function() {
      var url = 'https://roweos.com?join=' + encodeURIComponent(code);
      var resultEl = document.getElementById('adminBrandConfigResult');
      var urlEl = document.getElementById('adminBrandConfigUrl');
      if (resultEl) resultEl.style.display = 'block';
      if (urlEl) urlEl.textContent = url;
      window._lastBrandConfigUrl = url;
      if (slugInput) slugInput.value = '';
      if (nameInput) nameInput.value = '';
      showToast('Config link generated for ' + configName, 'success');
      console.log('[BrandConfig] Generated config:', code, 'type:', brandVal, '(' + configBrands.length + ' brands)');
      adminLoadBrandConfigs();
    })
    .catch(function(err) {
      showToast('Error generating config: ' + err.message, 'error');
    });
}

function copyBrandConfigUrl() {
  var url = window._lastBrandConfigUrl;
  if (!url) return;
  try {
    navigator.clipboard.writeText(url).then(function() {
      showToast('Link copied', 'success');
    });
  } catch(e) {
    // Fallback
    var ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Link copied', 'success');
  }
}

// v20.4: Share My Brand — any signed-in user can share their current brand
function openShareBrandModal() {
  if (!firebaseUser) {
    showToast('Sign in to share your brand', 'error');
    return;
  }
  // v24.11: Brand sharing is Premium-only
  if (typeof hasFeatureAccess === 'function' && !hasFeatureAccess('brandSharing')) {
    if (typeof showUpgradeModal === 'function') showUpgradeModal('brandSharing', 'premium');
    return;
  }
  var brand = brands[selectedBrand];
  if (!brand) {
    showToast('No brand selected to share', 'error');
    return;
  }

  // Populate preview
  var nameEl = document.getElementById('shareBrandName');
  var taglineEl = document.getElementById('shareBrandTagline');
  var swatchEl = document.getElementById('shareBrandColorSwatch');
  var slugInput = document.getElementById('shareBrandSlugInput');
  var resultEl = document.getElementById('shareBrandResult');
  var genBtn = document.getElementById('shareBrandGenerateBtn');

  if (nameEl) nameEl.textContent = brand.shortName || brand.name || 'My Brand';
  if (taglineEl) taglineEl.textContent = brand.tagline || '';
  if (swatchEl) swatchEl.style.background = brand.brandColor || '#a89878';
  if (slugInput) slugInput.value = '';
  if (resultEl) resultEl.style.display = 'none';
  if (genBtn) {
    genBtn.disabled = false;
    genBtn.textContent = 'Generate Share Link';
  }

  openModal('shareBrandModal');
}

function generateShareBrandLink() {
  if (!firebaseUser) {
    showToast('Sign in required', 'error');
    return;
  }
  var brand = brands[selectedBrand];
  if (!brand) {
    showToast('No brand to share', 'error');
    return;
  }

  var genBtn = document.getElementById('shareBrandGenerateBtn');
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.textContent = 'Generating...';
  }

  // Custom slug or auto-generated code
  var slugInput = document.getElementById('shareBrandSlugInput');
  var customSlug = slugInput ? slugInput.value.trim() : '';
  var code;
  if (customSlug) {
    code = customSlug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    if (!code) {
      showToast('Invalid slug: use letters, numbers, hyphens', 'error');
      if (genBtn) { genBtn.disabled = false; genBtn.textContent = 'Generate Share Link'; }
      return;
    }
  } else {
    code = generateAccessKeyString();
  }

  // Snapshot current brand only (index selectedBrand → saved as index 0)
  var idx = selectedBrand;
  var configBrands = [brands[idx]];
  var configSettings = {};
  var configMemory = {};
  var configOps = [];

  try {
    var allSettings = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}');
    if (allSettings[String(idx)]) {
      configSettings['0'] = allSettings[String(idx)];
    }
  } catch(e) {}

  try {
    var mem = localStorage.getItem('brand_' + idx);
    if (mem) configMemory['brand_0'] = JSON.parse(mem);
  } catch(e) {}

  try {
    var allOps = JSON.parse(localStorage.getItem('roweos_generated_brand_ops') || '[]');
    var brandName = brands[idx].name;
    configOps = allOps.filter(function(o) {
      return !o.generatedForBrand || o.generatedForBrand === brandName;
    });
  } catch(e) {}

  var configName = brand.shortName || brand.name || 'Shared Brand';

  var configDoc = {
    code: code,
    name: configName,
    brands: configBrands,
    brandSettings: configSettings,
    memory: configMemory,
    customOps: configOps,
    type: 'data',
    createdBy: firebaseUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    usageCount: 0,
    active: true
  };

  firebase.firestore().collection('brand_configs').doc(code).set(configDoc)
    .then(function() {
      var url = 'https://roweos.com?join=' + encodeURIComponent(code);
      window._lastShareBrandUrl = url;
      var resultEl = document.getElementById('shareBrandResult');
      var urlEl = document.getElementById('shareBrandUrl');
      if (resultEl) resultEl.style.display = 'block';
      if (urlEl) urlEl.textContent = url;
      if (genBtn) { genBtn.disabled = false; genBtn.textContent = 'Generate Share Link'; }
      showToast('Share link generated for ' + configName, 'success');
    })
    .catch(function(err) {
      showToast('Error generating link: ' + err.message, 'error');
      if (genBtn) { genBtn.disabled = false; genBtn.textContent = 'Generate Share Link'; }
    });
}

function copyShareBrandUrl() {
  var url = window._lastShareBrandUrl;
  if (!url) return;
  try {
    navigator.clipboard.writeText(url).then(function() {
      showToast('Link copied', 'success');
    });
  } catch(e) {
    var ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Link copied', 'success');
  }
}

function adminLoadBrandConfigs() {
  if (!isAdmin() || !firebase) return;
  var listEl = document.getElementById('adminBrandConfigList');
  if (!listEl) return;
  listEl.textContent = 'Loading...';

  firebase.firestore().collection('brand_configs').orderBy('createdAt', 'desc').limit(20).get()
    .then(function(snap) {
      if (snap.empty) {
        listEl.textContent = 'No shared configs yet';
        return;
      }
      var html = '';
      snap.forEach(function(doc) {
        var d = doc.data();
        var statusColor = d.active ? '#4ade80' : '#ef4444';
        var statusText = d.active ? 'Active' : 'Inactive';
        var typeLabel = d.type === 'invite' ? 'Invite' : (d.brands ? d.brands.length : 0) + ' brands';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);">';
        html += '<div style="min-width:0;flex:1;">';
        html += '<div style="font-family:\'SF Mono\',Monaco,monospace;font-size:12px;color:#a89878;">' + escapeHtml(doc.id) + '</div>';
        html += '<div style="font-size:11px;color:var(--text-tertiary);">' + escapeHtml(d.name || 'Unnamed') + ' &middot; ' + typeLabel + ' &middot; ' + (d.usageCount || 0) + ' claims</div>';
        html += '</div>';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">';
        html += '<span style="font-size:11px;color:' + statusColor + ';">' + statusText + '</span>';
        html += '<button onclick="adminCopyBrandConfigLink(\'' + escapeHtml(doc.id) + '\')" style="padding:2px 8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:10px;" title="Copy join link">Copy Link</button>';
        html += '<button onclick="adminToggleBrandConfig(\'' + escapeHtml(doc.id) + '\', ' + !d.active + ')" style="padding:2px 8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:10px;">' + (d.active ? 'Deactivate' : 'Activate') + '</button>';
        html += '<button onclick="adminDeleteBrandConfig(\'' + escapeHtml(doc.id) + '\')" style="padding:2px 8px;background:var(--bg-tertiary);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-sm);color:#ef4444;cursor:pointer;font-size:10px;">Delete</button>';
        html += '</div></div>';
      });
      listEl.innerHTML = html;
    })
    .catch(function(err) {
      listEl.textContent = 'Error loading configs';
      console.error('[BrandConfig] Error loading configs:', err);
    });
}

function adminToggleBrandConfig(code, newActive) {
  if (!isAdmin() || !firebase) return;
  firebase.firestore().collection('brand_configs').doc(code).update({ active: newActive })
    .then(function() {
      showToast('Config ' + (newActive ? 'activated' : 'deactivated'), 'success');
      adminLoadBrandConfigs();
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

function adminDeleteBrandConfig(code) {
  if (!isAdmin() || !firebase) return;
  if (!confirm('Delete config "' + code + '"? This cannot be undone.')) return;
  firebase.firestore().collection('brand_configs').doc(code).delete()
    .then(function() {
      showToast('Config deleted', 'success');
      adminLoadBrandConfigs();
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

// v22.2: Copy brand config join link
function adminCopyBrandConfigLink(code) {
  var url = 'https://roweos.com?join=' + encodeURIComponent(code);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function() {
      showToast('Join link copied', 'success');
    }).catch(function() {
      showToast('Could not copy link', 'error');
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// v15.0: AUTH GATE & LOGIN FLOW
// ═══════════════════════════════════════════════════════════════════════════════

var _pendingRestoreData = null;

// v31.0: Parse signup prefill from URL query (?email=...&name=...&source=info)
// Used when /api/info-signup 302-redirects from the /info page form.
function _parseSignupURLParams() {
  try {
    if (typeof window === 'undefined' || !window.location) return { email: '', name: '', source: '' };
    var qs = new URLSearchParams(window.location.search);
    return {
      email: (qs.get('email') || '').trim(),
      name: (qs.get('name') || '').trim(),
      source: (qs.get('source') || '').trim()
    };
  } catch (e) {
    return { email: '', name: '', source: '' };
  }
}

// v31.0: Apply /info-page prefill to the auth gate.
// - Skips the splash screen and reveals the email/password form
// - Switches the form into Create Account mode (only if not already)
// - Populates email + name inputs
// - Stamps window._signupSource so the notify-signup call in handleAuthState
//   tags the resulting admin email "Source: Info Page Lead"
function _applySignupPrefill() {
  try {
    var prefill = _parseSignupURLParams();
    if (!prefill.email) return false;

    var splash = document.getElementById('authSplash');
    var login = document.getElementById('authLogin');
    if (splash) splash.style.display = 'none';
    if (login) {
      login.style.display = 'block';
      login.style.opacity = '1';
    }

    // Reveal the email form (it starts hidden behind the email-card click target)
    var emailForm = document.getElementById('authEmailForm');
    if (emailForm && emailForm.style.display === 'none') {
      if (typeof toggleEmailForm === 'function') {
        toggleEmailForm();
      } else {
        emailForm.style.display = 'block';
      }
    }

    // Force Create Account mode if not already there.
    // _authEmailMode lives in 21-sidebar.js and starts at 'signin'.
    if (typeof toggleEmailAuthMode === 'function' &&
        typeof _authEmailMode !== 'undefined' && _authEmailMode !== 'create') {
      toggleEmailAuthMode();
    }

    var emailInput = document.getElementById('authEmailInput');
    var nameInput = document.getElementById('authNameInput');
    if (emailInput) emailInput.value = prefill.email;
    if (nameInput) {
      nameInput.style.display = 'block';
      if (prefill.name) nameInput.value = prefill.name;
    }

    if (prefill.source === 'info') {
      window._signupSource = 'Info Page Lead';
    }
    return true;
  } catch (e) {
    console.warn('[auth] prefill failed:', e && e.message);
    return false;
  }
}

function showAuthGate() {
  // v22.53: Remove boot screen when auth gate shows
  var boot = document.getElementById('bootScreen');
  if (boot) boot.remove();
  // v30.5: Don't reset to splash if tier selection is actively shown
  if (window._tierSelectionActive) {
    console.log('[Auth] showAuthGate blocked - tier selection is active');
    return;
  }
  var gate = document.getElementById('authGate');
  if (gate) {
    gate.style.display = 'flex';
    gate.style.opacity = '1';
  }
  // v20.14: Always reset to splash view (Phase 1) — never show login form directly.
  // The splash has no email/password fields so iOS autofill won't trigger.
  var splash = document.getElementById('authSplash');
  var login = document.getElementById('authLogin');
  if (splash) splash.style.display = 'flex';
  if (login) login.style.display = 'none';
  // Reset sign-in sub-views within login
  var signInEl = document.getElementById('authGateSignIn');
  var keyEl = document.getElementById('authGateAccessKey');
  var tierEl = document.getElementById('authGateTierSelect');
  if (signInEl) signInEl.style.display = 'block';
  if (keyEl) keyEl.style.display = 'none';
  if (tierEl) tierEl.style.display = 'none';

  // v31.0: If the user arrived from /info with ?email=&name=&source=info,
  // skip the splash and prefill the create-account form. Run after the
  // resets above so the splash hide/email-form reveal sticks.
  _applySignupPrefill();
}

function hideAuthGate() {
  console.log('[Auth] hideAuthGate called from:', new Error().stack.split('\n')[2]);
  // v30.5: Reset tier selection flag
  window._tierSelectionActive = false;
  var gate = document.getElementById('authGate');
  if (gate) {
    gate.style.opacity = '0';
    setTimeout(function() { gate.style.display = 'none'; }, 400);
  }
}

function showAccessKeyPrompt() {
  var signInEl = document.getElementById('authGateSignIn');
  var keyEl = document.getElementById('authGateAccessKey');
  if (signInEl) signInEl.style.display = 'none';
  if (keyEl) keyEl.style.display = 'block';
}

// v30.5: Show tier selection screen for new users
// tierSelect is a direct child of authGate (not inside authLogin), so hiding authLogin won't hide it
function showTierSelection() {
  // v30.5: Never show if Stripe payment was already processed
  if (window._stripeReturnProcessed) {
    console.log('[Auth] showTierSelection blocked - Stripe return already processed');
    return;
  }
  console.log('[Auth] showTierSelection called');
  // v30.5: Set flag so showAuthGate() won't override us
  window._tierSelectionActive = true;

  var gate = document.getElementById('authGate');
  var splash = document.getElementById('authSplash');
  var login = document.getElementById('authLogin');
  var tierSelect = document.getElementById('authGateTierSelect');
  var goldOverlay = document.getElementById('goldTransitionOverlay');
  var migrationOverlay = document.getElementById('migrationOverlay');

  // Force gate visible
  if (gate) {
    gate.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#0a0a0a;display:flex;align-items:center;justify-content:center;flex-direction:column;opacity:1;';
  }
  // Hide everything inside the gate except tier select
  if (splash) { splash.style.display = 'none'; splash.style.opacity = '0'; }
  if (login) { login.style.display = 'none'; login.style.opacity = '0'; }
  if (goldOverlay) { goldOverlay.style.display = 'none'; goldOverlay.style.opacity = '0'; goldOverlay.style.pointerEvents = 'none'; }
  if (migrationOverlay) { migrationOverlay.style.display = 'none'; }
  // Show tier select
  if (tierSelect) {
    tierSelect.style.display = 'block';
    console.log('[Auth] Tier select shown, children:', tierSelect.childElementCount);
  } else {
    console.error('[Auth] #authGateTierSelect NOT FOUND in DOM');
  }
}

// v30.4: Handle tier selection
// v30.5: All tiers go through Stripe checkout with trial periods
function selectTier(tier) {
  if (!firebaseUser) {
    console.error('[TierSelect] No firebase user');
    return;
  }
  var statusEl = document.getElementById('tierSelectStatus');
  var validTiers = { founder: true, solo: true, premium: true };
  if (!validTiers[tier]) {
    if (statusEl) { statusEl.style.color = '#ef4444'; statusEl.textContent = 'Invalid tier selected.'; }
    return;
  }

  // All tiers redirect to Stripe checkout (trial periods configured server-side)
  if (statusEl) { statusEl.style.color = '#a89878'; statusEl.textContent = 'Opening checkout...'; }
  // Store pending tier so we can complete on return
  try { localStorage.setItem('roweos_pending_tier', tier); } catch(e) {}
  var email = firebaseUser.email || '';
  fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: tier, email: email })
  })
  .then(function(resp) { return resp.json(); })
  .then(function(data) {
    if (data.url) {
      window.location.href = data.url;
    } else {
      if (statusEl) { statusEl.style.color = '#ef4444'; statusEl.textContent = data.error || 'Could not start checkout'; }
    }
  })
  .catch(function(err) {
    console.error('[TierSelect] Checkout error:', err);
    if (statusEl) { statusEl.style.color = '#ef4444'; statusEl.textContent = 'Unable to start checkout. Please try again.'; }
  });
}

// v27.1: Show access key verification screen after signup email sent
// v30.2: Skip key display entirely - show brief setup message then proceed
function showAccessKeyVerification(email) {
  // Show a brief "Setting up" message instead of the key input screen
  var statusEl = document.getElementById('authGateStatus');
  if (statusEl) {
    statusEl.style.color = '#a89878';
    statusEl.textContent = 'Setting up your account...';
  }

  // Hide the sign-in options since user is already authenticated
  var signInSection = document.getElementById('authGateSignIn');
  if (signInSection) signInSection.style.display = 'none';

  // Don't show the access key section at all
  var keySection = document.getElementById('authGateAccessKey');
  if (keySection) keySection.style.display = 'none';

  // Proceed to app after a brief delay (auth state handler will take over)
  setTimeout(function() {
    if (typeof firebaseUser !== 'undefined' && firebaseUser) {
      proceedToApp();
    }
  }, 1500);
}

// v27.1: Resend the Early Access welcome email
function resendAccessKeyEmail() {
  if (!firebaseUser) return;
  var resendLink = document.getElementById('accessKeyResend');
  if (resendLink) resendLink.innerHTML = '<span style="font-size:12px;color:rgba(201,181,122,0.5);">Sending...</span>';

  autoGenerateAccessKey(firebaseUser).then(function(key) {
    if (key) {
      sendEarlyAccessEmail(firebaseUser, key);
      if (resendLink) resendLink.innerHTML = '<span style="font-size:12px;color:#22c55e;">Email resent!</span>';
      setTimeout(function() {
        if (resendLink) resendLink.innerHTML = '<span onclick="resendAccessKeyEmail()" style="font-size:12px;color:rgba(201,181,122,0.5);cursor:pointer;">Didn\'t receive it? Resend</span>';
      }, 3000);
    }
  });
}

function handleAccessKeySubmit() {
  var input = document.getElementById('accessKeyInput');
  var status = document.getElementById('accessKeyStatus');
  if (!input || !input.value.trim()) {
    if (status) { status.style.color = '#ef4444'; status.textContent = 'Please enter an access key'; }
    return;
  }
  var keyVal = input.value.trim().toUpperCase();
  if (status) { status.style.color = 'rgba(255,255,255,0.4)'; status.textContent = 'Validating...'; }

  validateAccessKey(keyVal).then(function(result) {
    if (!result.valid) {
      if (status) { status.style.color = '#ef4444'; status.textContent = result.error; }
      return;
    }
    if (status) { status.style.color = '#a89878'; status.textContent = 'Activating...'; }
    return linkAccessKeyToUser(keyVal).then(function() {
      if (status) { status.style.color = '#22c55e'; status.textContent = 'Activated!'; }
      // Re-trigger auth flow
      setTimeout(function() { handleAuthState(firebaseUser); }, 500);
    });
  }).catch(function(err) {
    if (status) { status.style.color = '#ef4444'; status.textContent = 'Error: ' + err.message; }
  });
}

function showDataRestorePrompt(data) {
  _pendingRestoreData = data;
  // v18.9: Hide auth gate first — its z-index (100000) covers the restore prompt (99999)
  hideAuthGate();
  var prompt = document.getElementById('dataRestorePrompt');
  var greeting = document.getElementById('restoreGreeting');
  if (greeting && firebaseUser) {
    var name = firebaseUser.displayName || firebaseUser.email;
    greeting.textContent = 'Welcome back, ' + name.split(' ')[0] + '!';
  }
  if (prompt) prompt.style.display = 'flex';
}

function acceptDataRestore() {
  var prompt = document.getElementById('dataRestorePrompt');
  if (prompt) prompt.style.display = 'none';
  if (_pendingRestoreData) {
    // v24.27: Don't block the app — restore in background, let user proceed immediately
    try {
      applyCloudData(_pendingRestoreData);
      reloadAllData();
      // v30.2: Call loadBrands() directly — reloadAllData() may be throttled
      if (typeof loadBrands === 'function') loadBrands();
      if (typeof initBrandLogo === 'function') initBrandLogo();
      showToast('Data restored from cloud — check Sync for details', 'success');
    } catch(e) {
      console.error('[Restore] Error:', e);
      showToast('Some data may not have restored. Check Sync.', 'warning');
    }
  }
  _pendingRestoreData = null;
  proceedToApp();
  // v25.3: Remind user to configure API keys after restore (keys are not synced)
  setTimeout(function() { showApiKeyReminderAfterRestore(); }, 1500);
}

function skipDataRestore() {
  var prompt = document.getElementById('dataRestorePrompt');
  if (prompt) prompt.style.display = 'none';
  _pendingRestoreData = null;
  proceedToApp();
}

// v25.3: Post-restore API key reminder (keys are local-only, never synced)
function showApiKeyReminderAfterRestore() {
  try {
    var stored = localStorage.getItem('roweos_api_keys');
    var keys = stored ? JSON.parse(stored) : {};
    if (keys.anthropic || keys.openai || keys.google) return; // already configured
  } catch(e) {}

  // Show a dismissible banner overlay
  var el = document.createElement('div');
  el.id = 'apiKeyRestoreReminder';
  el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99998;background:var(--bg-primary, #1a1a1a);border:1px solid var(--border-color, rgba(255,255,255,0.1));border-radius:14px;padding:20px 24px;max-width:420px;width:calc(100% - 48px);box-shadow:0 8px 32px rgba(0,0,0,0.4);backdrop-filter:blur(20px);';
  el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:14px;">'
    + '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="' + getAccentFallback() + '" stroke-width="1.5" style="flex-shrink:0;margin-top:2px;"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>'
    + '<div style="flex:1;">'
    + '<div style="font-size:14px;font-weight:600;color:var(--text-primary, #fff);margin-bottom:4px;">Configure your API keys</div>'
    + '<div style="font-size:12px;color:var(--text-muted, rgba(255,255,255,0.5));line-height:1.5;">Your data has been restored, but API keys are stored locally for security and need to be re-entered.</div>'
    + '<div style="display:flex;gap:8px;margin-top:12px;">'
    + '<button onclick="document.getElementById(\'apiKeyRestoreReminder\').remove(); openApiKeyModal();" style="padding:8px 16px;background:' + getAccentFallback() + ';color:#000;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Set Up Keys</button>'
    + '<button onclick="document.getElementById(\'apiKeyRestoreReminder\').remove();" style="padding:8px 16px;background:transparent;color:var(--text-muted, rgba(255,255,255,0.5));border:1px solid var(--border-color, rgba(255,255,255,0.1));border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;">Later</button>'
    + '</div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(el);
}

function proceedToApp() {
  hideAuthGate();
  // v29.1: Mark this device as initialized (prevents false "restore from cloud" on refresh)
  if (brands && brands.length > 0) {
    localStorage.setItem('roweos_initialized', 'true');
  }
  // v25.3: Migrate clients to unified people storage
  migratePeopleData();
  // v25.3: Schedule check-in reminders for direct reports
  if (typeof scheduleCheckInReminders === 'function') scheduleCheckInReminders();
  setInterval(function() { try { if (typeof scheduleCheckInReminders === 'function') scheduleCheckInReminders(); } catch(e) {} }, 1800000);
  // Check if onboarding needed
  if (!brands || brands.length === 0) {
    var onboardingDone = localStorage.getItem('roweos_onboarding_complete');
    if (!onboardingDone) {
      showOnboarding();
      return;
    }
  }
  showStartupScreen();
  // v19.1: Initialize cloud scheduler state and pick up results
  if (typeof initCloudSchedulerState === 'function') initCloudSchedulerState();
  // v19.6: Initialize Notification Center badge
  if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
  if (typeof updateSidebarBadges === 'function') updateSidebarBadges(); // v24.13
  // v24.13: Refresh sidebar badges every 60s
  setInterval(function() { try { if (typeof updateSidebarBadges === 'function') updateSidebarBadges(); } catch(e) {} }, 60000);
  window._lastNotifBrand = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
}

// v30.5: Notify admin of new signup (fire-and-forget, deduped per session)
// Called right before showTierSelection — if we're showing tier selection, user IS new
function _notifyNewSignup(user, source) {
  if (!user || window._signupNotified) return;
  window._signupNotified = true;
  console.log('[Auth] Sending signup notification for', user.email, 'source:', source);
  var signInMethod = 'Email';
  if (user.providerData && user.providerData.length > 0) {
    var pid = user.providerData[0].providerId || '';
    if (pid.indexOf('google') !== -1) signInMethod = 'Google';
    else if (pid.indexOf('twitter') !== -1) signInMethod = 'X';
  }
  try {
    fetch('/api/notify-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email || '',
        displayName: user.displayName || '',
        method: signInMethod,
        uid: user.uid,
        createdAt: new Date().toISOString(),
        source: source || 'Direct'
      })
    }).catch(function(e) { console.warn('[Auth] Signup notification failed:', e.message); });
  } catch(e) {}
}

// v15.0: Central auth state handler
function handleAuthState(user) {
  if (!user) {
    // Not signed in - show auth gate
    console.log('[Auth] No user - showing auth gate');
    showAuthGate();
    return;
  }

  console.log('[Auth] User signed in:', user.email);
  var statusEl = document.getElementById('authGateStatus');

  // v15.0: Admin bypasses access key requirement
  if (isAdmin()) {
    console.log('[Auth] Admin user detected - bypassing access key check');
    if (statusEl) { statusEl.style.color = '#4ade80'; statusEl.textContent = 'Admin access granted'; }
    // v30.3: Ensure admin nav is visible immediately
    if (typeof updateAdminNavVisibility === 'function') updateAdminNavVisibility();
    // Fall through to cloud data check below
    firebase.firestore().collection('roweos_users').doc(user.uid).get()
      .then(function(doc) {
        if (doc.exists && doc.data().brands && doc.data().brands.length > 0) {
          if (!brands || brands.length === 0) {
            // v29.1: If device was previously initialized, silently restore instead of scary prompt
            var _wasInit = localStorage.getItem('roweos_initialized') === 'true';
            if (_wasInit) {
              console.log('[Auth] Previously initialized device - silent restore from cloud');
              try {
                applyCloudData(doc.data());
                reloadAllData();
                // v30.2: Call loadBrands() directly — reloadAllData() may be throttled
                if (typeof loadBrands === 'function') loadBrands();
                if (typeof initBrandLogo === 'function') initBrandLogo();
              } catch(e) { console.warn('[Auth] Silent restore error:', e); }
              hideAuthGate();
              // v30.1: Chain setupRealtimeSync after loadFromFirebase to prevent concurrent writers
              loadFromFirebase(false).then(function() {
                setupRealtimeSync();
                showStartupScreen();
              });
            } else {
              showDataRestorePrompt(doc.data());
            }
          } else {
            hideAuthGate();
            // v30.1: Chain setupRealtimeSync after loadFromFirebase to prevent concurrent writers
            loadFromFirebase(false).then(function() {
              setupRealtimeSync();
              showStartupScreen();
            });
          }
        } else {
          hideAuthGate();
          setupRealtimeSync();
          showStartupScreen();
        }
      })
      .catch(function(err) {
        console.warn('[Auth] Error checking cloud data:', err);
        hideAuthGate();
        showStartupScreen();
      });
    return;
  }

  // v30.4: If user has no brands locally, they're a new user.
  if (!brands || brands.length === 0) {
    // Check if returning from Stripe first
    // v30.5: Also check window._stripeSubscriptionSuccess — initApp() cleans the URL before this runs
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('subscription') === 'success' || window._stripeSubscriptionSuccess) {
      var stripeTier = urlParams.get('tier') || window._stripeSubscriptionTier || localStorage.getItem('roweos_pending_tier') || 'solo';
      console.log('[Auth] Stripe return for new user - generating key for tier:', stripeTier);
      window._stripeReturnProcessed = true;
      window._stripeSubscriptionSuccess = false; // consume it
      try { localStorage.setItem('roweos_tier_selected', stripeTier); } catch(e) {}
      try { localStorage.removeItem('roweos_pending_tier'); } catch(e) {}
      try { window.history.replaceState({}, '', window.location.pathname); } catch(e) {}
      var _keyP = (typeof autoGenerateAccessKey === 'function') ? autoGenerateAccessKey(user, stripeTier) : Promise.resolve(null);
      _keyP.then(function() { _handlePostKeyCloudCheck(user); }).catch(function() { _handlePostKeyCloudCheck(user); });
      return;
    }
    // v30.5: Always check for a valid access key before showing tier selection.
    // The user may be returning on a new device/browser where they already paid.
    if (window._stripeReturnProcessed) {
      // Already handled this page load — go straight to cloud check
      _handlePostKeyCloudCheck(user);
      return;
    }
    console.log('[Auth] No brands locally - checking for existing access key');
    checkUserAccessKey().then(function(keyResult) {
      if (keyResult.valid) {
        console.log('[Auth] User has valid key (tier:', keyResult.tier, ') - proceeding to app');
        _handlePostKeyCloudCheck(user);
      } else {
        // v30.5: Try auto-detecting a key by email (Stripe webhook creates keys before client sees them)
        console.log('[Auth] No linked key - trying auto-detect by email');
        if (typeof autoDetectAccessKey === 'function') {
          autoDetectAccessKey().then(function(linked) {
            if (linked) {
              console.log('[Auth] Auto-detected and linked access key - proceeding to app');
              _handlePostKeyCloudCheck(user);
            } else {
              console.log('[Auth] No key found for email - showing tier selection');
              _notifyNewSignup(user, 'Welcome Screen');
              showTierSelection();
            }
          }).catch(function() {
            _notifyNewSignup(user, 'Welcome Screen');
            showTierSelection();
          });
        } else {
          _notifyNewSignup(user, 'Welcome Screen');
          showTierSelection();
        }
      }
    }).catch(function(err) {
      console.warn('[Auth] Key check failed:', err);
      showTierSelection();
    });
    return;
  }

  // Existing user with brands - check access key
  checkUserAccessKey().then(function(keyResult) {
    if (!keyResult.valid) {
      // v30.4: Check if returning from Stripe checkout (subscription success)
      var urlParams = new URLSearchParams(window.location.search);
      var pendingTier = null;
      try { pendingTier = localStorage.getItem('roweos_pending_tier'); } catch(e) {}
      if (urlParams.get('subscription') === 'success' || window._stripeSubscriptionSuccess) {
        // Returning from Stripe - auto-generate key with purchased tier
        var stripeTier = urlParams.get('tier') || window._stripeSubscriptionTier || pendingTier || 'solo';
        console.log('[Auth] Subscription success - generating access key for tier:', stripeTier);
        // v30.5: Mark Stripe return handled
        window._stripeReturnProcessed = true;
        window._stripeSubscriptionSuccess = false;
        try { localStorage.setItem('roweos_tier_selected', stripeTier); } catch(e) {}
        try { localStorage.removeItem('roweos_pending_tier'); } catch(e) {}
        // Clean URL
        try { window.history.replaceState({}, '', window.location.pathname); } catch(e) {}
        if (statusEl) { statusEl.style.color = '#a89878'; statusEl.textContent = 'Activating your subscription...'; }
        var _subKeyPromise = (typeof autoGenerateAccessKey === 'function')
          ? autoGenerateAccessKey(user, stripeTier)
          : Promise.resolve(null);
        _subKeyPromise.then(function(generatedKey) {
          if (generatedKey) {
            console.log('[Auth] Subscription key generated:', generatedKey);
            if (typeof sendEarlyAccessEmail === 'function') {
              sendEarlyAccessEmail(user, generatedKey);
            }
          }
          _handlePostKeyCloudCheck(user);
        }).catch(function(err) {
          console.warn('[Auth] Subscription key generation failed, proceeding:', err);
          _handlePostKeyCloudCheck(user);
        });
        return;
      }

      // v30.4: Show tier selection for new users (replaces silent auto-generate)
      console.log('[Auth] No valid access key - showing tier selection');
      showTierSelection();
      return;
    }

    console.log('[Auth] Valid access key:', keyResult.key, 'tier:', keyResult.tier);

    // Check for existing cloud data
    _handlePostKeyCloudCheck(user);
  }).catch(function(err) {
    console.warn('[Auth] Error checking access key:', err);
    // v30.4: If access key check fails, show tier selection instead of blank screen
    showTierSelection();
  });
}

// v30.2: Extracted cloud data check after key validation (shared by valid-key and auto-generated paths)
function _handlePostKeyCloudCheck(user) {
  firebase.firestore().collection('roweos_users').doc(user.uid).get()
    .then(function(doc) {
      if (doc.exists && doc.data().brands && doc.data().brands.length > 0) {
        // Has cloud data
        if (!brands || brands.length === 0) {
          // v29.1: If device was previously initialized, silently restore instead of scary prompt
          var _wasInit = localStorage.getItem('roweos_initialized') === 'true';
          if (_wasInit) {
            console.log('[Auth] Previously initialized device - silent restore from cloud');
            try {
              applyCloudData(doc.data());
              reloadAllData();
              // v30.2: Call loadBrands() directly — reloadAllData() may be throttled
              if (typeof loadBrands === 'function') loadBrands();
              if (typeof initBrandLogo === 'function') initBrandLogo();
            } catch(e) { console.warn('[Auth] Silent restore error:', e); }
            hideAuthGate();
            // v30.1: Chain setupRealtimeSync after loadFromFirebase to prevent concurrent writers
            loadFromFirebase(false).then(function() {
              setupRealtimeSync();
              showStartupScreen();
            });
          } else {
            // No local data, first visit — offer restore
            showDataRestorePrompt(doc.data());
          }
        } else {
          // Has local data - just proceed
          hideAuthGate();
          // v30.1: Chain setupRealtimeSync after loadFromFirebase to prevent concurrent writers
          loadFromFirebase(false).then(function() {
            setupRealtimeSync();
            showStartupScreen();
          });
        }
      } else {
        // No cloud data
        hideAuthGate();
        setupRealtimeSync();
        if (!brands || brands.length === 0) {
          var onboardingDone = localStorage.getItem('roweos_onboarding_complete');
          if (!onboardingDone) {
            showOnboarding();
          } else {
            showStartupScreen();
          }
        } else {
          showStartupScreen();
        }
      }
    })
    .catch(function(err) {
      console.warn('[Auth] Error checking cloud data:', err);
      hideAuthGate();
      showStartupScreen();
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// v15.0: FIREBASE STORAGE FOR LARGE FILES
// ═══════════════════════════════════════════════════════════════════════════════

function uploadToStorage(path, data, contentType) {
  if (!firebase || !firebase.storage) return Promise.reject(new Error('Storage not available'));
  var ref = firebase.storage().ref(path);
  if (typeof data === 'string' && data.indexOf('data:') === 0) {
    // v15.27: Validate data URL header before uploading — must match data:[type];base64,
    if (!/^data:[a-zA-Z]+\/[a-zA-Z0-9.+-]+;base64,/.test(data)) {
      console.warn('[Storage] Invalid data URL format, skipping upload for:', path);
      return Promise.reject(new Error('Invalid data URL format'));
    }
    // Base64 data URL — wrap in try/catch to prevent uncaught format errors
    try {
      return ref.putString(data, 'data_url').then(function(snapshot) {
        return snapshot.ref.getDownloadURL();
      });
    } catch (formatErr) {
      console.warn('[Storage] putString format error for:', path, formatErr.message);
      return Promise.reject(formatErr);
    }
  } else {
    var metadata = contentType ? { contentType: contentType } : undefined;
    return ref.put(data, metadata).then(function(snapshot) {
      return snapshot.ref.getDownloadURL();
    });
  }
}

function downloadFromStorage(path) {
  if (!firebase || !firebase.storage) return Promise.reject(new Error('Storage not available'));
  return firebase.storage().ref(path).getDownloadURL();
}

function deleteFromStorage(path) {
  if (!firebase || !firebase.storage) return Promise.reject(new Error('Storage not available'));
  return firebase.storage().ref(path).delete().catch(function(err) {
    if (err.code === 'storage/object-not-found') return; // Already deleted
    throw err;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// v20.6: YOUR PLAN (Settings — visible to any signed-in user)
// ═══════════════════════════════════════════════════════════════════════════════

function renderSettingsPlan() {
  var section = document.getElementById('settingsPlanSection');
  if (!section) return;
  if (!firebaseUser) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  var badge = document.getElementById('settingsPlanBadge');
  var emailEl = document.getElementById('settingsPlanEmail');
  var featuresEl = document.getElementById('settingsPlanFeatures');
  var upgradeBtn = document.getElementById('settingsUpgradeBtn');
  var manageSubBtn = document.getElementById('settingsManageSubBtn');

  if (emailEl) emailEl.textContent = firebaseUser.email || '';

  getUserTier(true).then(function(tier) {
    var tierLabels = { free: 'Free', basic: 'Solo', solo: 'Solo', founder: 'Founder', premium: 'Premium' };
    var tierColors = { free: 'rgba(255,255,255,0.06)', basic: 'rgba(96,165,250,0.15)', solo: 'rgba(96,165,250,0.15)', founder: 'rgba(168,152,120,0.2)', premium: 'rgba(212,175,55,0.2)' };
    var tierTextColors = { free: 'var(--text-secondary)', basic: '#60a5fa', solo: '#60a5fa', founder: '#a89878', premium: '#d4af37' };
    var tierFeatures = {
      free: 'Sign up for a plan to unlock RoweOS. Chat, Library, Memory, Pulse, and Rhythm included in all tiers.',
      basic: 'Solo: 1 Brand, 1 Life profile. Chat, Library, Memory, Pulse, Rhythm, basic automations.',
      solo: 'Solo: 1 Brand, 1 Life profile. Chat, Library, Memory, Pulse, Rhythm, basic automations.',
      founder: 'Founder: Up to 5 Brands and 5 Life profiles. Studio, full automations, mail, social, focus, analytics, identity, and cloud sync.',
      premium: 'Premium: Up to 15 Brands and 15 Life profiles. Everything in Founder plus Bloom, brand sharing, private onboarding, and 24/7 support.'
    };

    if (badge) {
      badge.textContent = tierLabels[tier] || tier;
      badge.style.background = tierColors[tier] || tierColors.free;
      badge.style.color = tierTextColors[tier] || tierTextColors.free;
    }
    if (featuresEl) featuresEl.textContent = tierFeatures[tier] || tierFeatures.free;
    if (upgradeBtn) {
      // v24.27: Hide upgrade for premium AND founder tiers
      upgradeBtn.style.display = (tier === 'premium' || tier === 'founder') ? 'none' : '';
    }

    // v20.6: Show Manage Subscription button if user has Stripe customer ID
    if (manageSubBtn && firebaseUser && tier !== 'free') {
      firebase.firestore().collection('roweos_users').doc(firebaseUser.uid).get()
        .then(function(doc) {
          if (doc.exists && doc.data().stripeCustomerId) {
            manageSubBtn.style.display = '';
          }
        }).catch(function() {});
    }

    // v24.11: Update sidebar locks after tier resolves
    if (typeof updateSidebarTierLocks === 'function') updateSidebarTierLocks();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// v24.11: ACCOUNT FOLDER — Profile, Tier, API Keys, Plan Comparison
// ═══════════════════════════════════════════════════════════════════════════════

function renderAccountFolder() {
  var container = document.getElementById('accountFolderContent');
  if (!container) return;

  var userName = '';
  var userEmail = '';
  if (firebaseUser) {
    userName = firebaseUser.displayName || '';
    userEmail = firebaseUser.email || '';
  }
  if (!userName && userEmail) userName = userEmail.split('@')[0];

  // v30.3: Admin always premium — force cache before reading
  if (typeof isAdmin === 'function' && isAdmin()) {
    _cachedUserTier = 'premium';
  }
  var tier = _cachedUserTier || 'free';
  var tierLabels = { free: 'Free', basic: 'Solo', solo: 'Solo', founder: 'Founder', premium: 'Premium' };
  var tierColors = { free: '#666', basic: '#60a5fa', solo: '#60a5fa', founder: '#a89878', premium: '#d4af37' };
  var tierBg = { free: 'rgba(255,255,255,0.06)', basic: 'rgba(96,165,250,0.12)', solo: 'rgba(96,165,250,0.12)', founder: 'rgba(168,152,120,0.15)', premium: 'rgba(212,175,55,0.15)' };
  var tierLabel = tierLabels[tier] || tier;
  var tierColor = tierColors[tier] || '#666';

  // Collect brand and life profile names
  var brandNames = [];
  if (typeof brands !== 'undefined' && brands.length) {
    for (var i = 0; i < brands.length; i++) {
      brandNames.push(escapeHtml(brands[i].shortName || brands[i].name || 'Brand ' + (i + 1)));
    }
  }
  var lifeNames = [];
  if (typeof lifeProfiles !== 'undefined' && lifeProfiles.length) {
    for (var j = 0; j < lifeProfiles.length; j++) {
      lifeNames.push(escapeHtml(lifeProfiles[j].name || 'Profile ' + (j + 1)));
    }
  }

  // v30.1: Default to hidden - locked features shown only when user enables
  var showLocked = localStorage.getItem('roweos_show_locked_features') === 'true';

  var html = '';

  // Section title - Account (styled like System)
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title" style="color:' + tierColor + ';font-size:15px;font-weight:600;">';
  html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  html += 'Account</div>';

  // Welcome card
  html += '<div style="padding:24px 20px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);margin-bottom:16px;">';
  html += '<div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Welcome,</div>';
  html += '<div style="font-size:28px;font-weight:700;color:var(--text-primary);line-height:1.2;margin-bottom:12px;">' + escapeHtml(userName || 'User') + '</div>';
  // Tier badge
  html += '<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:var(--radius-full);background:' + (tierBg[tier] || tierBg.free) + ';border:1px solid ' + tierColor + '30;">';
  html += '<span style="font-size:12px;font-weight:700;color:' + tierColor + ';letter-spacing:0.5px;text-transform:uppercase;">' + escapeHtml(tierLabel) + '</span>';
  html += '</div>';
  html += '</div>';

  // Profile info
  html += '<div style="padding:16px 20px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);margin-bottom:16px;">';
  if (userEmail) {
    html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);">';
    html += '<span style="font-size:12px;color:var(--text-muted);">Email</span>';
    html += '<span style="font-size:12px;color:var(--text-primary);">' + escapeHtml(userEmail) + '</span>';
    html += '</div>';
  }
  if (brandNames.length) {
    html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);">';
    html += '<span style="font-size:12px;color:var(--text-muted);">Brands</span>';
    html += '<span style="font-size:12px;color:var(--text-primary);">' + brandNames.join(', ') + '</span>';
    html += '</div>';
  }
  if (lifeNames.length) {
    html += '<div style="display:flex;justify-content:space-between;padding:8px 0;">';
    html += '<span style="font-size:12px;color:var(--text-muted);">Life Profiles</span>';
    html += '<span style="font-size:12px;color:var(--text-primary);">' + lifeNames.join(', ') + '</span>';
    html += '</div>';
  }
  html += '</div>';

  // Plan actions
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">';
  if (tier !== 'premium') {
    html += '<button onclick="openTierPicker()" style="padding:10px 24px;background:linear-gradient(135deg,#a89878,#d4b896);color:#0a0a0a;border:none;border-radius:var(--radius-md);font-size:13px;font-weight:600;cursor:pointer;">Change Plan</button>';
  }
  html += '<button onclick="openManageSubscription()" style="padding:10px 16px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:13px;cursor:pointer;">Manage Billing</button>';
  html += '<button onclick="showAccessKeyInput()" style="padding:10px 16px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:13px;cursor:pointer;">Enter Access Key</button>';
  html += '<button onclick="signOutFirebase()" style="padding:10px 16px;background:var(--bg-tertiary);color:#ef4444;border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md);font-size:13px;cursor:pointer;margin-left:auto;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
  html += 'Sign Out</button>';
  html += '</div>';

  // Show/hide locked features toggle
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:24px;">';
  html += '<div>';
  html += '<div style="font-size:13px;color:var(--text-primary);font-weight:500;">Show locked features</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);">Display locked views in sidebar with a lock icon</div>';
  html += '</div>';
  html += '<label style="position:relative;display:inline-block;width:40px;height:22px;cursor:pointer;">';
  // v30.1: Toggle onchange now updates visual state (slider dot + background) immediately
  html += '<input type="checkbox" ' + (showLocked ? 'checked' : '') + ' onchange="var on=this.checked;localStorage.setItem(\'roweos_show_locked_features\', on ? \'true\' : \'false\'); var bg=this.nextElementSibling; var dot=bg.nextElementSibling; bg.style.background=on?\'var(--brand-accent, #a89878)\':\'var(--bg-tertiary)\'; dot.style.left=on?\'20px\':\'2px\'; if(typeof updateSidebarTierLocks===\'function\') updateSidebarTierLocks();" style="opacity:0;width:0;height:0;">';
  html += '<span style="position:absolute;inset:0;background:' + (showLocked ? 'var(--brand-accent, #a89878)' : 'var(--bg-tertiary)') + ';border-radius:11px;transition:0.2s;border:1px solid var(--border-color);"></span>';
  html += '<span style="position:absolute;top:2px;left:' + (showLocked ? '20px' : '2px') + ';width:16px;height:16px;background:white;border-radius:50%;transition:0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></span>';
  html += '</label>';
  html += '</div>';

  html += '</div>'; // close settings-section

  // Tier comparison cards
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title" style="font-size:14px;">Plans</div>';
  html += '<div style="display:flex;gap:12px;flex-wrap:wrap;">';

  // v25.1: Tier rank for upgrade/downgrade label logic
  var tierRank = { solo: 1, basic: 1, founder: 2, pro: 2, premium: 3, enterprise: 3 };
  var currentRank = tierRank[tier] || 1;

  // Solo card
  var isSolo = (tier === 'solo' || tier === 'basic');
  html += '<div style="flex:1;min-width:180px;padding:18px;border:1px solid ' + (isSolo ? '#60a5fa' : 'var(--border-color)') + ';border-radius:var(--radius-lg);background:var(--bg-secondary);">';
  html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);">Essentials</div>';
  html += '<div style="font-size:18px;font-weight:700;color:#60a5fa;margin:4px 0;">Solo</div>';
  html += '<div style="font-size:20px;font-weight:700;color:var(--text-primary);">$29<span style="font-size:12px;color:var(--text-muted);font-weight:400;">/mo</span></div>';
  // v30.1: Solo now includes studio, identity, analytics, mail
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:10px;line-height:1.7;">1 Brand, 1 Life profile<br>Studio, Identity, Analytics, Mail<br>Library, Pulse, Rhythm<br>Basic automations</div>';
  if (isSolo) {
    html += '<div style="margin-top:12px;padding:8px;text-align:center;border-radius:var(--radius-md);background:rgba(96,165,250,0.1);color:#60a5fa;font-size:12px;font-weight:600;">Current Plan</div>';
  } else if (currentRank > 1) {
    html += '<div onclick="if(typeof openCheckoutForTier===\'function\')openCheckoutForTier(\'solo\')" style="margin-top:12px;padding:8px;text-align:center;border-radius:var(--radius-md);border:1px solid var(--border-color);color:var(--text-secondary);font-size:12px;cursor:pointer;">Downgrade</div>';
  } else {
    html += '<div onclick="if(typeof openCheckoutForTier===\'function\')openCheckoutForTier(\'solo\')" style="margin-top:12px;padding:8px;text-align:center;border-radius:var(--radius-md);border:1px solid var(--border-color);color:var(--text-secondary);font-size:12px;cursor:pointer;">Select</div>';
  }
  html += '</div>';

  // Founder card
  var isFounder = (tier === 'founder' || tier === 'pro');
  html += '<div style="flex:1;min-width:180px;padding:18px;border:1px solid ' + (isFounder ? '#a89878' : 'var(--border-color)') + ';border-radius:var(--radius-lg);background:var(--bg-secondary);">';
  html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);">Full Access</div>';
  html += '<div style="font-size:18px;font-weight:700;color:#a89878;margin:4px 0;">Founder</div>';
  html += '<div style="font-size:20px;font-weight:700;color:var(--text-primary);">$59<span style="font-size:12px;color:var(--text-muted);font-weight:400;">/mo</span></div>';
  // v30.1: Updated for tier changes - studio/analytics/identity/mail now in Solo
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:10px;line-height:1.7;">Up to 5 Brands & Life profiles<br>Automations Agent, Pipelines<br>Social, Pulse, Cloud Sync</div>';
  if (isFounder) {
    html += '<div style="margin-top:12px;padding:8px;text-align:center;border-radius:var(--radius-md);background:rgba(168,152,120,0.15);color:#a89878;font-size:12px;font-weight:600;">Current Plan</div>';
  } else if (currentRank > 2) {
    html += '<div onclick="if(typeof openCheckoutForTier===\'function\')openCheckoutForTier(\'founder\')" style="margin-top:12px;padding:8px;text-align:center;border-radius:var(--radius-md);border:1px solid var(--border-color);color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer;">Downgrade</div>';
  } else {
    html += '<div onclick="if(typeof openCheckoutForTier===\'function\')openCheckoutForTier(\'founder\')" style="margin-top:12px;padding:8px;text-align:center;border-radius:var(--radius-md);background:linear-gradient(135deg,#a89878,#d4b896);color:#0a0a0a;font-size:12px;font-weight:600;cursor:pointer;">Upgrade</div>';
  }
  html += '</div>';

  // Premium card
  var isPremium = (tier === 'premium' || tier === 'enterprise');
  html += '<div style="flex:1;min-width:180px;padding:18px;border:1px solid ' + (isPremium ? '#d4af37' : 'var(--border-color)') + ';border-radius:var(--radius-lg);background:var(--bg-secondary);">';
  html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);">Professional</div>';
  html += '<div style="font-size:18px;font-weight:700;color:#d4af37;margin:4px 0;">Premium</div>';
  html += '<div style="font-size:20px;font-weight:700;color:var(--text-primary);">$79<span style="font-size:12px;color:var(--text-muted);font-weight:400;">/mo</span></div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:10px;line-height:1.7;">Up to 15 Brands & Life profiles<br>Bloom<br>Brand sharing & config export<br>Private onboarding, 24/7 support</div>';
  if (isPremium) {
    html += '<div style="margin-top:12px;padding:8px;text-align:center;border-radius:var(--radius-md);background:rgba(212,175,55,0.15);color:#d4af37;font-size:12px;font-weight:600;">Current Plan</div>';
  } else {
    html += '<div onclick="if(typeof openCheckoutForTier===\'function\')openCheckoutForTier(\'premium\')" style="margin-top:12px;padding:8px;text-align:center;border-radius:var(--radius-md);background:linear-gradient(135deg,#d4af37,#f0d060);color:#0a0a0a;font-size:12px;font-weight:600;cursor:pointer;">Upgrade</div>';
  }
  html += '</div>';

  html += '</div>'; // close flex
  html += '</div>'; // close settings-section

  // v25.3: Purchase API Keys section (marketplace only, config moved to AI & Models)
  html += '<div class="settings-section">';
  html += '<div class="settings-section-title" style="font-size:14px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>';
  html += 'Purchase API Keys</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Buy pre-loaded API keys, or configure your own in <a href="#" onclick="closeSettingsFolder();setTimeout(function(){openSettingsFolder(\'ai\')},100);return false;" style="color:var(--brand-accent, #a89878);text-decoration:none;">AI & Models</a></div>';

  // API Key Marketplace
  html += '<div id="accountApiKeyMarketplace" style="margin-top:12px;"></div>';
  html += '</div>'; // close settings-section

  container.innerHTML = html;

  // Load API key marketplace into account folder too
  if (typeof loadApiKeyMarketplace === 'function') {
    loadApiKeyMarketplace('accountApiKeyMarketplace');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// v20.19: USER FEEDBACK SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

var _feedbackRating = 0;
var _feedbackScreenshots = [];
var _feedbackCategory = 'general';
var _feedbackAreas = [];
var _feedbackPlatform = [];
var _feedbackOS = [];

// v21.0: Dedicated close — completely self-contained, no reliance on generic closeModal
// v25.1: Robust reset — clear all state so modal can reopen cleanly
function closeFeedbackModal() {
  var modal = document.getElementById('feedbackModal');
  if (modal) {
    modal.removeAttribute('style');
    modal.style.cssText = 'display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;';
    modal.classList.remove('open');
  }
  document.body.style.overflow = '';
  // v25.1: Reset global state flags
  _feedbackRating = 0;
  _feedbackScreenshots = [];
  _feedbackCategory = 'general';
  _feedbackAreas = [];
  _feedbackPlatform = [];
  _feedbackOS = [];
}

function openFeedbackModal(preselectedArea) {
  var modal = document.getElementById('feedbackModal');
  if (!modal) return;
  // v21.0: Show modal FIRST — set all visibility properties before any UI reset
  // This ensures the modal is visible even if reset code throws
  modal.removeAttribute('style');
  modal.classList.remove('open');
  // Force a reflow so the browser recognizes the style reset
  void modal.offsetHeight;
  // Now apply all visibility styles in one cssText assignment (atomic, no race)
  modal.style.cssText = 'display:flex !important;visibility:visible !important;opacity:1 !important;position:fixed !important;top:0 !important;left:0 !important;width:100% !important;height:100% !important;z-index:10000 !important;pointer-events:auto !important;background:rgba(0,0,0,0.8) !important;backdrop-filter:blur(8px) !important;align-items:center !important;justify-content:center !important;animation:none !important;transition:none !important;';
  document.body.style.overflow = 'hidden';
  // Now safely reset form state (wrapped in try/catch so modal stays visible)
  try {
    _feedbackRating = 0;
    _feedbackScreenshots = [];
    _feedbackCategory = 'general';
    _feedbackAreas = [];
    _feedbackPlatform = [];
    _feedbackOS = [];
    var desc = document.getElementById('feedbackDescription');
    if (desc) desc.value = '';
    var catCards = document.querySelectorAll('.feedback-category-card');
    for (var i = 0; i < catCards.length; i++) {
      catCards[i].classList.remove('selected');
      if (i === 2) catCards[i].classList.add('selected');
    }
    var areaCards = document.querySelectorAll('.feedback-area-card');
    for (var j = 0; j < areaCards.length; j++) { areaCards[j].classList.remove('selected'); }
    var chips = document.querySelectorAll('.feedback-chip');
    for (var k = 0; k < chips.length; k++) { chips[k].classList.remove('selected'); }
    renderFeedbackStars(0);
    renderFeedbackScreenshotPreviews();
    var btn = document.getElementById('feedbackSubmitBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Feedback'; }
    // Pre-select area if provided (e.g. from ? button)
    if (preselectedArea) {
      toggleFeedbackArea(preselectedArea);
    }
  } catch(e) { console.warn('[Feedback] Reset error:', e); }
}

// v20.20: Card-based category selection
function selectFeedbackCategory(cat) {
  _feedbackCategory = cat;
  var cards = document.querySelectorAll('.feedback-category-card');
  var cats = ['bug', 'feature', 'general', 'ui_ux'];
  for (var i = 0; i < cards.length; i++) {
    if (cats[i] === cat) {
      cards[i].classList.add('selected');
    } else {
      cards[i].classList.remove('selected');
    }
  }
}

// v20.20: Multi-select feature area toggle
function toggleFeedbackArea(area) {
  var idx = _feedbackAreas.indexOf(area);
  if (idx === -1) {
    _feedbackAreas.push(area);
  } else {
    _feedbackAreas.splice(idx, 1);
  }
  // Update card visual
  var cards = document.querySelectorAll('.feedback-area-card');
  var areas = ['chat','studio','focus','pulse','rhythm','library','automations','identity','memory','inventory','clients','analytics','settings','notifications','mail','bloom','sync','onboarding','admin','other'];
  for (var i = 0; i < cards.length; i++) {
    if (_feedbackAreas.indexOf(areas[i]) !== -1) {
      cards[i].classList.add('selected');
    } else {
      cards[i].classList.remove('selected');
    }
  }
}

// v21.0: Platform/OS chip toggle (multi-select)
function toggleFeedbackChip(type, value, el) {
  if (type === 'platform') {
    if (!Array.isArray(_feedbackPlatform)) _feedbackPlatform = [];
    var idx = _feedbackPlatform.indexOf(value);
    if (idx === -1) {
      _feedbackPlatform.push(value);
      el.classList.add('selected');
    } else {
      _feedbackPlatform.splice(idx, 1);
      el.classList.remove('selected');
    }
  } else if (type === 'os') {
    if (!Array.isArray(_feedbackOS)) _feedbackOS = [];
    var idx2 = _feedbackOS.indexOf(value);
    if (idx2 === -1) {
      _feedbackOS.push(value);
      el.classList.add('selected');
    } else {
      _feedbackOS.splice(idx2, 1);
      el.classList.remove('selected');
    }
  }
}

function setFeedbackRating(e) {
  var target = e.target.closest('.feedback-star');
  if (!target) return;
  var star = parseInt(target.getAttribute('data-star'));
  if (isNaN(star)) return;
  _feedbackRating = star;
  renderFeedbackStars(star);
}

function renderFeedbackStars(rating) {
  var container = document.getElementById('feedbackStars');
  if (!container) return;
  var stars = container.querySelectorAll('.feedback-star');
  for (var i = 0; i < stars.length; i++) {
    var starNum = parseInt(stars[i].getAttribute('data-star'));
    if (starNum <= rating) {
      stars[i].classList.add('active');
    } else {
      stars[i].classList.remove('active');
    }
  }
}

function addFeedbackScreenshot() {
  if (_feedbackScreenshots.length >= 3) {
    showToast('Maximum 3 screenshots', 'warning');
    return;
  }
  document.getElementById('feedbackFileInput').click();
}

function handleFeedbackFileSelect(input) {
  var files = input.files;
  if (!files || !files.length) return;
  var remaining = 3 - _feedbackScreenshots.length;
  for (var i = 0; i < Math.min(files.length, remaining); i++) {
    resizeImageForFeedback(files[i], function(dataUrl) {
      _feedbackScreenshots.push(dataUrl);
      renderFeedbackScreenshotPreviews();
    });
  }
  input.value = '';
}

function resizeImageForFeedback(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var maxW = 800;
      var w = img.width;
      var h = img.height;
      if (w > maxW) {
        h = Math.round(h * (maxW / w));
        w = maxW;
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderFeedbackScreenshotPreviews() {
  var container = document.getElementById('feedbackScreenshotPreviews');
  if (!container) return;
  var html = '';
  for (var i = 0; i < _feedbackScreenshots.length; i++) {
    html += '<div class="feedback-screenshot-thumb">'
      + '<img src="' + _feedbackScreenshots[i] + '" alt="Screenshot ' + (i + 1) + '">'
      + '<button class="feedback-screenshot-remove" onclick="removeFeedbackScreenshot(' + i + ')">&times;</button>'
      + '</div>';
  }
  container.innerHTML = html;
  var addBtn = document.getElementById('feedbackAddScreenshotBtn');
  if (addBtn) addBtn.style.display = _feedbackScreenshots.length >= 3 ? 'none' : '';
  var dropZone = document.getElementById('feedbackDropZone');
  if (dropZone) dropZone.style.display = _feedbackScreenshots.length >= 3 ? 'none' : '';
}

function removeFeedbackScreenshot(index) {
  _feedbackScreenshots.splice(index, 1);
  renderFeedbackScreenshotPreviews();
}

function handleFeedbackDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  var dz = document.getElementById('feedbackDropZone');
  if (dz) {
    dz.style.borderColor = 'var(--accent, #a89878)';
    dz.style.background = 'rgba(168,152,120,0.08)';
  }
}

function handleFeedbackDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  var dz = document.getElementById('feedbackDropZone');
  if (dz) {
    dz.style.borderColor = 'var(--border-color)';
    dz.style.background = '';
  }
}

function handleFeedbackDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  var dz = document.getElementById('feedbackDropZone');
  if (dz) {
    dz.style.borderColor = 'var(--border-color)';
    dz.style.background = '';
  }
  var files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length) return;
  if (_feedbackScreenshots.length >= 3) {
    showToast('Maximum 3 screenshots', 'warning');
    return;
  }
  var remaining = 3 - _feedbackScreenshots.length;
  var added = 0;
  for (var i = 0; i < files.length && added < remaining; i++) {
    if (files[i].type && files[i].type.indexOf('image') === 0) {
      resizeImageForFeedback(files[i], function(dataUrl) {
        _feedbackScreenshots.push(dataUrl);
        renderFeedbackScreenshotPreviews();
      });
      added++;
    }
  }
  if (added === 0) {
    showToast('Please drop image files only', 'warning');
  }
}

// v21.11: Firestore direct write — NO screenshots in doc (1MB limit), API fire-and-forget for notify
function submitFeedback() {
  var btn = document.getElementById('feedbackSubmitBtn');
  function resetBtn() { if (btn) { btn.disabled = false; btn.textContent = 'Submit Feedback'; btn.style.background = ''; btn.style.color = ''; } }

  try {
    var description = (document.getElementById('feedbackDescription').value || '').trim();
    if (!description) { showToast('Please enter a description', 'warning'); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    var category = _feedbackCategory || 'general';
    var deviceInfo = '';
    try { deviceInfo = JSON.stringify({ platform: navigator.platform || '', userAgent: navigator.userAgent || '', screenSize: window.innerWidth + 'x' + window.innerHeight, appVersion: ROWEOS_VERSION }); } catch(e) { deviceInfo = '{}'; }

    var currentBrandName = '';
    try { currentBrandName = brands[selectedBrand] ? (brands[selectedBrand].shortName || brands[selectedBrand].name) : ''; } catch(e) {}

    var platformVal = Array.isArray(_feedbackPlatform) ? _feedbackPlatform.join(', ') : (_feedbackPlatform || '');
    var osVal = Array.isArray(_feedbackOS) ? _feedbackOS.join(', ') : (_feedbackOS || '');
    var screenshotCount = 0;
    try { screenshotCount = (_feedbackScreenshots || []).length; } catch(e) {}

    var feedbackId = 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

    // v21.11: NEVER put screenshots in Firestore doc (1MB limit kills it)
    var fbData = {
      uid: firebaseUser ? firebaseUser.uid : '',
      email: firebaseUser ? (firebaseUser.email || '') : '',
      category: category,
      description: description,
      rating: 0,
      deviceInfo: deviceInfo,
      tier: _cachedUserTier || 'unknown',
      brand: currentBrandName,
      mode: (localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand'),
      status: 'new',
      createdAt: new Date().toISOString(),
      platform: platformVal,
      os: osVal,
      featureAreas: _feedbackAreas || [],
      screenshotCount: screenshotCount
    };

    console.log('[Feedback] Submitting:', feedbackId, category, 'screenshots:', screenshotCount);

    // Safety timeout — 10s
    var safetyTimer = setTimeout(function() {
      console.warn('[Feedback] Safety timeout fired');
      showToast('Request timed out', 'warning');
      resetBtn();
    }, 10000);

    function onSuccess() {
      clearTimeout(safetyTimer);
      console.log('[Feedback] Success:', feedbackId);
      showToast('Feedback sent! Thank you.', 'success');
      if (btn) { btn.textContent = 'Sent!'; btn.style.background = '#4ade80'; btn.style.color = '#000'; }
      setTimeout(function() { closeFeedbackModal(); resetBtn(); }, 800);

      // v21.12: Store screenshots in subcollection (each under 1MB)
      if (screenshotCount > 0 && typeof firebase !== 'undefined' && firebase.firestore && firebaseUser) {
        var ssArr = _feedbackScreenshots || [];
        for (var si = 0; si < ssArr.length; si++) {
          (function(idx, dataUrl) {
            try {
              firebase.firestore().collection('feedback').doc(feedbackId)
                .collection('screenshots').doc(String(idx))
                .set({ data: dataUrl, index: idx, createdAt: new Date().toISOString() })
                .then(function() { console.log('[Feedback] Screenshot ' + idx + ' saved'); })
                .catch(function(e) { console.warn('[Feedback] Screenshot ' + idx + ' failed:', e.message); });
            } catch(e) { console.warn('[Feedback] Screenshot write error:', e.message); }
          })(si, ssArr[si]);
        }
      }

      // v21.12: Fire-and-forget: notify admin via API (email + push) — include screenshot data for email
      try {
        var notifyScreenshots = [];
        try { notifyScreenshots = (_feedbackScreenshots || []).slice(0, 3); } catch(e) {}
        fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notifyOnly: true, feedbackId: feedbackId, category: category, description: description, email: fbData.email, tier: fbData.tier, brand: fbData.brand, mode: fbData.mode, deviceInfo: deviceInfo, screenshots: notifyScreenshots })
        }).catch(function() {});
      } catch(e) {}
    }

    function onError(errMsg) {
      clearTimeout(safetyTimer);
      console.error('[Feedback] Error:', errMsg);
      showToast('Failed: ' + errMsg, 'error');
      resetBtn();
    }

    // PRIMARY: Firestore SDK direct write
    if (typeof firebase !== 'undefined' && firebase.firestore && firebaseUser) {
      console.log('[Feedback] Using Firestore SDK path');
      try {
        var db = firebase.firestore();
        var docRef = db.collection('feedback').doc(feedbackId);
        docRef.set(fbData).then(onSuccess).catch(function(err) { onError(err.message || 'Firestore write failed'); });
      } catch(syncErr) {
        console.error('[Feedback] Sync error in Firestore path:', syncErr);
        onError(syncErr.message || 'Firestore error');
      }
    } else {
      // Fallback: API call (may fail due to CORS)
      console.log('[Feedback] Using API fallback path, firebase:', typeof firebase, 'firestore:', typeof firebase !== 'undefined' && !!firebase.firestore, 'user:', !!firebaseUser);
      try {
        fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fbData)
        }).then(function(resp) {
          if (!resp.ok) throw new Error('Server ' + resp.status);
          return resp.json();
        }).then(function(data) {
          if (data && data.success) onSuccess();
          else throw new Error((data && data.error) || 'Unknown error');
        }).catch(function(err) { onError(err.message); });
      } catch(e) { onError(e.message); }
    }
  } catch(outerErr) {
    console.error('[Feedback] Outer error:', outerErr);
    showToast('Error: ' + (outerErr.message || 'Unknown'), 'error');
    resetBtn();
  }
}

// v21.0: Floating feedback button removed — accessible via System > Feedback

// v20.19: Admin feedback panel — query and render feedback from Firestore
function renderAdminFeedback() {
  if (!isAdmin()) return;
  var container = document.getElementById('adminFeedbackList');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-tertiary);">Loading feedback...</div>';

  var filter = document.getElementById('adminFeedbackFilter');
  var filterVal = filter ? filter.value : 'all';

  firebase.firestore().collection('feedback')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
    .then(function(snapshot) {
      var items = [];
      snapshot.forEach(function(doc) {
        var d = doc.data();
        d._id = doc.id;
        // Apply filter
        if (filterVal === 'new' && d.status !== 'new') return;
        if (filterVal === 'bug' && d.category !== 'bug') return;
        if (filterVal === 'feature' && d.category !== 'feature') return;
        if (filterVal === 'reviewed' && d.status !== 'reviewed') return;
        if (filterVal === 'resolved' && d.status !== 'resolved') return;
        items.push(d);
      });

      if (items.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-tertiary);">No feedback found</div>';
        return;
      }

      var categoryColors = { bug: '#ff4444', feature: '#60a5fa', general: '#a89878', ui_ux: '#f472b6' };
      var categoryLabels = { bug: 'Bug', feature: 'Feature', general: 'General', ui_ux: 'UI/UX' };
      var statusLabels = { 'new': 'New', reviewed: 'Reviewed', resolved: 'Resolved' };

      var html = '<div id="fbBulkBar" style="display:none;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--accent);border-radius:var(--radius-md);margin-bottom:12px;align-items:center;gap:10px;flex-wrap:wrap;">'
        + '<span id="fbBulkCount" style="font-size:13px;color:var(--text-primary);font-weight:600;">0 selected</span>'
        + '<button onclick="bulkUpdateFeedback(\'reviewed\')" style="padding:4px 12px;font-size:12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;">Mark Reviewed</button>'
        + '<button onclick="bulkUpdateFeedback(\'resolved\')" style="padding:4px 12px;font-size:12px;border-radius:var(--radius-sm);border:1px solid #4ade80;background:#4ade80;color:#000;cursor:pointer;">Resolve All</button>'
        + '<button onclick="bulkUpdateFeedback(\'new\')" style="padding:4px 12px;font-size:12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;">Reopen All</button>'
        + '<button onclick="bulkDeleteFeedback()" style="padding:4px 12px;font-size:12px;border-radius:var(--radius-sm);border:1px solid #ff4444;background:transparent;color:#ff4444;cursor:pointer;">Delete Selected</button>'
        + '<button onclick="clearFeedbackSelection()" style="padding:4px 12px;font-size:12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;">Clear</button>'
        + '</div>';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var catColor = categoryColors[item.category] || '#a89878';
        var catLabel = categoryLabels[item.category] || item.category;
        var isResolved = item.status === 'resolved';
        var escapedId = escapeHtml(item._id);

        // v21.12: Screenshots loaded from subcollection after render
        var screenshotHtml = '';
        var ssCount = item.screenshotCount || (item.screenshots ? item.screenshots.length : 0);
        if (ssCount > 0) {
          screenshotHtml = '<div class="fb-screenshots" id="fbSS_' + escapedId + '">';
          for (var j = 0; j < ssCount; j++) {
            screenshotHtml += '<div class="fb-ss-loading">Loading...</div>';
          }
          screenshotHtml += '</div>';
        }

        var deviceStr = '';
        if (item.deviceInfo) {
          try {
            var dev = typeof item.deviceInfo === 'string' ? JSON.parse(item.deviceInfo) : item.deviceInfo;
            var deviceParts = [];
            if (dev.platform) deviceParts.push(dev.platform);
            if (dev.screenSize) deviceParts.push(dev.screenSize);
            if (dev.appVersion) deviceParts.push(dev.appVersion);
            deviceStr = deviceParts.join(' \u00b7 ');
          } catch(e) {}
        }

        var createdDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

        // v21.10: Notes section
        var notesHtml = '<div class="fb-notes-area">';
        if (item.adminNotes) {
          notesHtml += '<div class="fb-notes-label">Admin Notes</div>'
            + '<div class="fb-notes-saved" id="fbNotesDisplay_' + escapedId + '">' + escapeHtml(item.adminNotes) + '</div>'
            + '<div class="fb-actions">'
            + '<button onclick="toggleFeedbackNoteEdit(\'' + escapedId + '\')">Edit</button>'
            + (item.status !== 'resolved' ? '<button onclick="updateFeedbackStatus(\'' + escapedId + '\', \'resolved\')" style="background:#4ade80;color:#000;border-color:#4ade80;">Resolve</button>' : '<button onclick="updateFeedbackStatus(\'' + escapedId + '\', \'new\')">Reopen</button>')
            + '<button onclick="deleteFeedbackItem(\'' + escapedId + '\')" style="color:#ff4444;">Delete</button>'
            + '</div>'
            + '<div id="fbNoteEdit_' + escapedId + '" style="display:none;margin-top:6px;">'
            + '<textarea id="fbNoteText_' + escapedId + '">' + escapeHtml(item.adminNotes) + '</textarea>'
            + '<div style="display:flex;gap:6px;margin-top:4px;">'
            + '<button onclick="saveFeedbackNote(\'' + escapedId + '\')" class="fb-actions" style="padding:3px 10px;border-radius:var(--radius-sm);font-size:11px;cursor:pointer;border:1px solid var(--accent);background:var(--accent);color:#000;">Save</button>'
            + '<button onclick="toggleFeedbackNoteEdit(\'' + escapedId + '\')" class="fb-actions" style="padding:3px 10px;border-radius:var(--radius-sm);font-size:11px;cursor:pointer;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);">Cancel</button>'
            + '</div></div>';
        } else {
          notesHtml += '<div id="fbNoteEdit_' + escapedId + '" style="display:none;">'
            + '<div class="fb-notes-label">Add Note</div>'
            + '<textarea id="fbNoteText_' + escapedId + '" placeholder="Add admin notes..."></textarea>'
            + '<div style="display:flex;gap:6px;margin-top:4px;">'
            + '<button onclick="saveFeedbackNote(\'' + escapedId + '\')" class="fb-actions" style="padding:3px 10px;border-radius:var(--radius-sm);font-size:11px;cursor:pointer;border:1px solid var(--accent);background:var(--accent);color:#000;">Save</button>'
            + '<button onclick="toggleFeedbackNoteEdit(\'' + escapedId + '\')" class="fb-actions" style="padding:3px 10px;border-radius:var(--radius-sm);font-size:11px;cursor:pointer;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);">Cancel</button>'
            + '</div></div>'
            + '<div class="fb-actions">'
            + '<button onclick="toggleFeedbackNoteEdit(\'' + escapedId + '\')">Add Note</button>'
            + (item.status !== 'resolved' ? '<button onclick="updateFeedbackStatus(\'' + escapedId + '\', \'resolved\')" style="background:#4ade80;color:#000;border-color:#4ade80;">Resolve</button>' : '<button onclick="updateFeedbackStatus(\'' + escapedId + '\', \'new\')">Reopen</button>')
            + '<button onclick="deleteFeedbackItem(\'' + escapedId + '\')" style="color:#ff4444;">Delete</button>'
            + '</div>';
        }
        notesHtml += '</div>';

        html += '<div class="admin-feedback-card' + (isResolved ? ' fb-resolved' : '') + '" data-feedback-id="' + escapedId + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">'
          + '<div style="display:flex;align-items:center;gap:8px;">'
          + '<input type="checkbox" class="fb-select-cb" data-fb-id="' + escapedId + '" onchange="toggleFeedbackSelect(this)" style="width:18px;height:18px;margin-right:8px;cursor:pointer;accent-color:var(--accent);flex-shrink:0;">'
          + '<span class="fb-category-badge" style="background:' + catColor + ';color:#000;">' + catLabel + '</span>'
          + '<span style="font-size:11px;color:var(--text-tertiary);">' + createdDate + '</span>'
          + (isResolved ? '<span style="font-size:10px;color:#4ade80;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Resolved</span>' : '')
          + '</div>'
          + '<select onchange="updateFeedbackStatus(\'' + escapedId + '\', this.value)" style="padding:3px 8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:11px;">'
          + '<option value="new"' + (item.status === 'new' ? ' selected' : '') + '>New</option>'
          + '<option value="reviewed"' + (item.status === 'reviewed' ? ' selected' : '') + '>Reviewed</option>'
          + '<option value="resolved"' + (item.status === 'resolved' ? ' selected' : '') + '>Resolved</option>'
          + '</select>'
          + '</div>'
          + '<div class="fb-desc">' + escapeHtml(item.description || '') + '</div>'
          + screenshotHtml
          + '<div class="fb-meta">'
          + (item.email ? escapeHtml(item.email) : 'Anonymous')
          + (item.tier && item.tier !== 'unknown' ? ' &middot; ' + escapeHtml(item.tier) : '')
          + (item.brand ? ' &middot; ' + escapeHtml(item.brand) : '')
          + (item.mode ? ' &middot; ' + escapeHtml(item.mode) : '')
          + (item.platform ? ' &middot; ' + escapeHtml(item.platform) : '')
          + (item.os ? ' &middot; ' + escapeHtml(item.os) : '')
          + (deviceStr ? '<br>' + escapeHtml(deviceStr) : '')
          + (item.featureAreas && item.featureAreas.length ? '<br>Areas: ' + item.featureAreas.map(function(a) { return escapeHtml(a); }).join(', ') : '')
          + '</div>'
          + notesHtml
          + '</div>';
      }
      container.innerHTML = html;

      // v21.12: Load screenshots from subcollections
      for (var k = 0; k < items.length; k++) {
        (function(feedbackItem) {
          var ssCount = feedbackItem.screenshotCount || (feedbackItem.screenshots ? feedbackItem.screenshots.length : 0);
          if (ssCount < 1) return;
          var ssContainer = document.getElementById('fbSS_' + feedbackItem._id);
          if (!ssContainer) return;
          firebase.firestore().collection('feedback').doc(feedbackItem._id)
            .collection('screenshots').orderBy('index').get()
            .then(function(ssSnap) {
              if (ssSnap.empty) {
                // Fallback: check if screenshots are inline on the doc (legacy)
                if (feedbackItem.screenshots && feedbackItem.screenshots.length > 0) {
                  var legacyHtml = '';
                  for (var m = 0; m < feedbackItem.screenshots.length; m++) {
                    legacyHtml += '<img src="' + escapeHtml(feedbackItem.screenshots[m]) + '" onclick="openFeedbackLightbox(this.src)" title="Click to enlarge">';
                  }
                  ssContainer.innerHTML = legacyHtml;
                } else {
                  ssContainer.innerHTML = '<span style="font-size:11px;color:var(--text-tertiary);">' + ssCount + ' screenshot(s), data not available</span>';
                }
                return;
              }
              var ssHtml = '';
              ssSnap.forEach(function(ssDoc) {
                var ssData = ssDoc.data();
                if (ssData.data) {
                  ssHtml += '<img src="' + escapeHtml(ssData.data) + '" onclick="openFeedbackLightbox(this.src)" title="Click to enlarge">';
                }
              });
              ssContainer.innerHTML = ssHtml || '<span style="font-size:11px;color:var(--text-tertiary);">Screenshots unavailable</span>';
            })
            .catch(function(e) {
              console.warn('[Feedback] Failed to load screenshots for', feedbackItem._id, e.message);
              ssContainer.innerHTML = '<span style="font-size:11px;color:var(--text-tertiary);">Failed to load screenshots</span>';
            });
        })(items[k]);
      }
    })
    .catch(function(err) {
      container.innerHTML = '<div style="color:#ff4444;padding:8px;">Failed to load: ' + escapeHtml(err.message) + '</div>';
    });
}

// v24.25: Export reviewed feedback grouped by feature area with screenshots
// v24.27: Unified export — supports any status filter
function exportFeedbackByStatus(status) {
  if (!isAdmin()) return;
  var statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  showToast('Exporting ' + status + ' feedback...', 'info');

  firebase.firestore().collection('feedback')
    .where('status', '==', status)
    .orderBy('createdAt', 'desc')
    .get()
    .then(function(snapshot) {
      var items = [];
      snapshot.forEach(function(doc) {
        var d = doc.data();
        d._id = doc.id;
        items.push(d);
      });

      if (items.length === 0) {
        showToast('No ' + status + ' feedback to export', 'info');
        return;
      }

      // Group by feature area (items can appear in multiple groups)
      var grouped = {};
      var noArea = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.featureAreas && item.featureAreas.length > 0) {
          for (var j = 0; j < item.featureAreas.length; j++) {
            var area = item.featureAreas[j];
            if (!grouped[area]) grouped[area] = [];
            grouped[area].push(item);
          }
        } else {
          noArea.push(item);
        }
      }

      // Sort area keys alphabetically
      var areaKeys = Object.keys(grouped).sort();
      if (noArea.length > 0) areaKeys.push('_uncategorized');

      // Collect all screenshot promises
      var ssPromises = [];
      var ssMap = {};
      for (var k = 0; k < items.length; k++) {
        (function(feedbackItem) {
          var ssCount = feedbackItem.screenshotCount || (feedbackItem.screenshots ? feedbackItem.screenshots.length : 0);
          if (ssCount < 1) return;
          var p = firebase.firestore().collection('feedback').doc(feedbackItem._id)
            .collection('screenshots').orderBy('index').get()
            .then(function(ssSnap) {
              var urls = [];
              ssSnap.forEach(function(ssDoc) {
                var ssData = ssDoc.data();
                if (ssData.data) urls.push(ssData.data);
              });
              if (urls.length === 0 && feedbackItem.screenshots) {
                urls = feedbackItem.screenshots;
              }
              ssMap[feedbackItem._id] = urls;
            })
            .catch(function() {
              if (feedbackItem.screenshots) ssMap[feedbackItem._id] = feedbackItem.screenshots;
            });
          ssPromises.push(p);
        })(items[k]);
      }

      Promise.all(ssPromises).then(function() {
        var categoryLabels = { bug: 'Bug', feature: 'Feature', general: 'General', ui_ux: 'UI/UX' };
        var areaLabels = {
          chat: 'Chat', studio: 'Studio', focus: 'Pulse', pulse: 'Pulse', rhythm: 'Rhythm', // v30.1: Focus renamed to Pulse
          library: 'Library', automations: 'Automations', identity: 'Identity', memory: 'Memory',
          inventory: 'Inventory', clients: 'Clients', analytics: 'Analytics', settings: 'Settings',
          notifications: 'Notifications', other: 'Other', _uncategorized: 'Uncategorized'
        };

        // Build HTML for export window
        var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>RoweOS Feedback Export</title>'
          + '<style>'
          + 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 32px 24px; background: #111; color: #e0e0e0; }'
          + 'h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; color: #fff; }'
          + '.export-subtitle { font-size: 13px; color: #888; margin-bottom: 32px; }'
          + 'h2 { font-size: 17px; font-weight: 600; margin: 32px 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #333; color: #a89878; }'
          + '.fb-item { padding: 14px 16px; margin-bottom: 12px; background: #1a1a1a; border-radius: 10px; border: 1px solid #2a2a2a; }'
          + '.fb-item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }'
          + '.fb-cat { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 2px 8px; border-radius: 4px; color: #000; }'
          + '.fb-date { font-size: 11px; color: #666; }'
          + '.fb-user { font-size: 11px; color: #777; }'
          + '.fb-desc { font-size: 14px; line-height: 1.55; color: #ccc; margin: 6px 0; }'
          + '.fb-notes { font-size: 12px; color: #999; margin-top: 6px; padding-top: 6px; border-top: 1px solid #2a2a2a; }'
          + '.fb-notes strong { color: #aaa; }'
          + '.fb-screenshots { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }'
          + '.fb-screenshots img { max-width: 320px; max-height: 240px; border-radius: 6px; border: 1px solid #333; cursor: pointer; }'
          + '.export-actions { display: flex; gap: 10px; margin-bottom: 24px; }'
          + '.export-actions button { padding: 8px 20px; border-radius: 8px; border: 1px solid #444; background: #222; color: #e0e0e0; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.2s; }'
          + '.export-actions button:hover { background: #333; }'
          + '@media print { .export-actions { display: none !important; } body { background: #fff; color: #222; } .fb-item { background: #f8f8f8; border-color: #ddd; } h2 { color: #333; border-color: #ccc; } .fb-desc { color: #333; } .fb-notes { color: #555; } .fb-notes strong { color: #333; } }'
          + '</style></head><body>';

        html += '<h1>RoweOS Feedback - ' + statusLabel + '</h1>';
        html += '<div class="export-subtitle">' + items.length + ' items - exported ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '</div>';
        html += '<div class="export-actions">'
          + '<button onclick="window.print()">Download PDF</button>'
          + '<button onclick="captureAsImage()">Download Image</button>'
          + '</div>';
        html += '<script>'
          + 'function captureAsImage() {'
          + '  var el = document.body;'
          + '  var btn = document.querySelector(".export-actions");'
          + '  if (btn) btn.style.display = "none";'
          + '  import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js")'
          + '    .then(function(mod) { return mod.default(el, { backgroundColor: "#111", scale: 2, useCORS: true }); })'
          + '    .then(function(canvas) {'
          + '      if (btn) btn.style.display = "flex";'
          + '      var a = document.createElement("a");'
          + '      a.download = "roweos-feedback-export.png";'
          + '      a.href = canvas.toDataURL("image/png");'
          + '      a.click();'
          + '    })'
          + '    .catch(function(err) {'
          + '      if (btn) btn.style.display = "flex";'
          + '      alert("Image capture failed: " + err.message);'
          + '    });'
          + '}'
          + '<\/script>';

        var categoryColors = { bug: '#ff4444', feature: '#60a5fa', general: '#a89878', ui_ux: '#f472b6' };
        var rendered = {};

        for (var a = 0; a < areaKeys.length; a++) {
          var areaKey = areaKeys[a];
          var areaItems = areaKey === '_uncategorized' ? noArea : grouped[areaKey];
          var areaLabel = areaLabels[areaKey] || areaKey;

          html += '<h2>' + areaLabel + ' (' + areaItems.length + ')</h2>';

          for (var b = 0; b < areaItems.length; b++) {
            var fb = areaItems[b];
            // Skip duplicates (item may appear in multiple areas - only render once per area group, but allow across groups)
            var dupeKey = areaKey + '_' + fb._id;
            if (rendered[dupeKey]) continue;
            rendered[dupeKey] = true;

            var catLabel = categoryLabels[fb.category] || fb.category || 'General';
            var catColor = categoryColors[fb.category] || '#a89878';
            var createdDate = fb.createdAt ? new Date(fb.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

            html += '<div class="fb-item">';
            html += '<div class="fb-item-header">';
            html += '<span class="fb-cat" style="background:' + catColor + ';">' + catLabel + '</span>';
            if (createdDate) html += '<span class="fb-date">' + createdDate + '</span>';
            if (fb.email) html += '<span class="fb-user">' + fb.email + '</span>';
            if (fb.brand) html += '<span class="fb-user">' + fb.brand + '</span>';
            html += '</div>';
            html += '<div class="fb-desc">' + (fb.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</div>';
            if (fb.adminNotes) {
              html += '<div class="fb-notes"><strong>Notes:</strong> ' + fb.adminNotes.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</div>';
            }
            // Screenshots
            var screenshots = ssMap[fb._id];
            if (screenshots && screenshots.length > 0) {
              html += '<div class="fb-screenshots">';
              for (var s = 0; s < screenshots.length; s++) {
                html += '<img src="' + screenshots[s] + '">';
              }
              html += '</div>';
            }
            html += '</div>';
          }
        }

        html += '</body></html>';

        // Open in new window
        var win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
          showToast('Exported ' + items.length + ' ' + status + ' items', 'success');
        } else {
          showToast('Popup blocked - allow popups and try again', 'error');
        }
      });
    })
    .catch(function(err) {
      showToast('Export failed: ' + err.message, 'error');
    });
}
// v24.27: Backward compat alias
function exportReviewedFeedback() { exportFeedbackByStatus('reviewed'); }

// v21.12: Lightbox for feedback screenshots
function openFeedbackLightbox(src) {
  var lb = document.getElementById('feedbackLightbox');
  var img = document.getElementById('feedbackLightboxImg');
  if (!lb || !img) return;
  img.src = src;
  lb.style.display = 'flex';
}

// v24.27: Update status in-place without re-rendering (preserves scroll position)
function updateFeedbackStatus(feedbackId, newStatus) {
  if (!isAdmin()) return;
  firebase.firestore().collection('feedback').doc(feedbackId).update({
    status: newStatus,
    updatedAt: new Date().toISOString()
  }).then(function() {
    showToast('Status updated to ' + newStatus, 'success');
    // v25.1: Update card class for strikethrough CSS AND resolved badge in-place
    var card = document.querySelector('[data-feedback-id="' + feedbackId + '"]');
    if (card) {
      // Toggle fb-resolved class (drives .fb-desc strikethrough via CSS)
      if (newStatus === 'resolved') {
        card.classList.add('fb-resolved');
      } else {
        card.classList.remove('fb-resolved');
      }
      var badge = card.querySelector('.fb-resolved-badge');
      if (newStatus === 'resolved') {
        if (!badge) {
          var header = card.querySelector('.fb-item-header, div');
          if (header) {
            var span = document.createElement('span');
            span.className = 'fb-resolved-badge';
            span.style.cssText = 'font-size:10px;color:#4ade80;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;';
            span.textContent = 'Resolved';
            header.appendChild(span);
          }
        }
      } else if (badge) {
        badge.remove();
      }
      // Sync the select dropdown if it wasn't the trigger
      var sel = card.querySelector('select');
      if (sel && sel.value !== newStatus) sel.value = newStatus;
    }
  }).catch(function(err) {
    showToast('Failed to update: ' + err.message, 'error');
  });
}

// v25.2: Multi-select feedback
var _fbSelectedIds = [];

function toggleFeedbackSelect(cb) {
  var id = cb.getAttribute('data-fb-id');
  if (cb.checked) {
    if (_fbSelectedIds.indexOf(id) === -1) _fbSelectedIds.push(id);
  } else {
    _fbSelectedIds = _fbSelectedIds.filter(function(x) { return x !== id; });
  }
  var bar = document.getElementById('fbBulkBar');
  var countEl = document.getElementById('fbBulkCount');
  if (bar) bar.style.display = _fbSelectedIds.length > 0 ? 'flex' : 'none';
  if (countEl) countEl.textContent = _fbSelectedIds.length + ' selected';
}

function clearFeedbackSelection() {
  _fbSelectedIds = [];
  var cbs = document.querySelectorAll('.fb-select-cb');
  for (var i = 0; i < cbs.length; i++) cbs[i].checked = false;
  var bar = document.getElementById('fbBulkBar');
  if (bar) bar.style.display = 'none';
}

function toggleAllFeedbackSelect(checked) {
  var cbs = document.querySelectorAll('.fb-select-cb');
  for (var i = 0; i < cbs.length; i++) {
    cbs[i].checked = checked;
    toggleFeedbackSelect(cbs[i]);
  }
}

function bulkUpdateFeedback(newStatus) {
  if (_fbSelectedIds.length === 0) return;
  var batch = firebase.firestore().batch();
  _fbSelectedIds.forEach(function(id) {
    batch.update(firebase.firestore().collection('feedback').doc(id), { status: newStatus });
  });
  batch.commit().then(function() {
    showToast(_fbSelectedIds.length + ' items updated to ' + newStatus, 'success');
    _fbSelectedIds = [];
    renderAdminFeedback();
  }).catch(function(e) {
    showToast('Bulk update failed: ' + e.message, 'error');
  });
}

function bulkDeleteFeedback() {
  if (_fbSelectedIds.length === 0) return;
  if (!confirm('Delete ' + _fbSelectedIds.length + ' feedback items? This cannot be undone.')) return;
  var batch = firebase.firestore().batch();
  _fbSelectedIds.forEach(function(id) {
    batch.delete(firebase.firestore().collection('feedback').doc(id));
  });
  batch.commit().then(function() {
    showToast(_fbSelectedIds.length + ' items deleted', 'success');
    _fbSelectedIds = [];
    renderAdminFeedback();
  }).catch(function(e) {
    showToast('Bulk delete failed: ' + e.message, 'error');
  });
}

// v21.10: Toggle note editor visibility
function toggleFeedbackNoteEdit(feedbackId) {
  var editArea = document.getElementById('fbNoteEdit_' + feedbackId);
  if (!editArea) return;
  editArea.style.display = editArea.style.display === 'none' ? 'block' : 'none';
}

// v21.10: Save admin note to Firestore
function saveFeedbackNote(feedbackId) {
  if (!isAdmin()) return;
  var textarea = document.getElementById('fbNoteText_' + feedbackId);
  if (!textarea) return;
  var note = textarea.value.trim();
  firebase.firestore().collection('feedback').doc(feedbackId).update({
    adminNotes: note,
    updatedAt: new Date().toISOString()
  }).then(function() {
    showToast('Note saved', 'success');
    renderAdminFeedback();
  }).catch(function(err) {
    showToast('Failed to save note: ' + err.message, 'error');
  });
}

// v21.10: Delete feedback item
function deleteFeedbackItem(feedbackId) {
  if (!isAdmin()) return;
  if (!confirm('Delete this feedback permanently?')) return;
  firebase.firestore().collection('feedback').doc(feedbackId).delete().then(function() {
    showToast('Feedback deleted', 'success');
    renderAdminFeedback();
  }).catch(function(err) {
    showToast('Failed to delete: ' + err.message, 'error');
  });
}

// v20.7: Tier picker modal — shows all 3 plans, highlights current, upgrade/downgrade
function openTierPicker() {
  var currentTier = _cachedUserTier || 'free';
  var tierRank = { free: 0, solo: 1, basic: 1, founder: 2, premium: 3 };
  var currentRank = tierRank[currentTier] || 0;

  var tiers = [
    {
      // v30.1: Solo now includes studio, identity, analytics, mail
      id: 'solo', name: 'Solo', price: '$29', period: '/mo', stage: 'Essentials',
      features: ['1 Brand profile', '1 LifeAI profile', 'Studio, Identity, Analytics, Mail', 'Library, Pulse, Rhythm', 'Chat with all AI agents', 'Basic automations']
    },
    {
      // v30.1: Founder updated - studio/analytics/identity/mail moved to Solo, Focus renamed to Pulse
      id: 'founder', name: 'Founder', price: '$59', period: '/mo', stage: 'Full Access',
      features: ['Everything in Solo', 'Up to 5 Brand profiles', 'Up to 5 LifeAI profiles', 'Automations Agent & Pipelines', 'Social publishing', 'Pulse & Cloud Sync']
    },
    {
      id: 'premium', name: 'Premium', price: '$79', period: '/mo', stage: 'Professional',
      features: ['Everything in Founder', 'Up to 15 Brand profiles', 'Up to 15 LifeAI profiles', 'White-label branding', 'Multi-user teams', 'Private onboarding', '24/7 Priority support']
    }
  ];

  var container = document.getElementById('tierPickerCards');
  if (!container) return;
  container.innerHTML = '';

  tiers.forEach(function(t) {
    var rank = tierRank[t.id] || 0;
    var isCurrent = (t.id === currentTier || (currentTier === 'basic' && t.id === 'solo'));
    var isUpgrade = rank > currentRank;
    var isDowngrade = rank < currentRank;

    var borderColor = isCurrent ? 'var(--accent)' : 'var(--border-color)';
    var bgColor = isCurrent ? 'rgba(168,152,120,0.08)' : 'var(--bg-secondary)';

    var card = document.createElement('div');
    card.style.cssText = 'border:1px solid ' + borderColor + ';border-radius:12px;padding:20px 16px;background:' + bgColor + ';display:flex;flex-direction:column;position:relative;';

    var html = '';
    if (isCurrent) {
      html += '<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--accent);color:#000;font-size:10px;font-weight:700;padding:2px 10px;border-radius:10px;text-transform:uppercase;letter-spacing:1px;">Current</div>';
    }
    html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:4px;">' + escapeHtml(t.stage) + '</div>';
    html += '<div style="font-size:20px;font-weight:700;color:var(--text-primary);font-family:var(--font-serif,Georgia,serif);">' + escapeHtml(t.name) + '</div>';
    html += '<div style="margin:8px 0 12px;"><span style="font-size:24px;font-weight:700;color:var(--text-primary);">' + t.price + '</span><span style="font-size:12px;color:var(--text-muted);">' + t.period + '</span></div>';

    html += '<ul style="list-style:none;padding:0;margin:0 0 16px;flex:1;">';
    t.features.forEach(function(f) {
      html += '<li style="font-size:11px;color:var(--text-muted);padding:3px 0;display:flex;align-items:center;gap:5px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--accent)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' + escapeHtml(f) + '</li>';
    });
    html += '</ul>';

    if (isCurrent) {
      html += '<button disabled style="padding:10px;border:1px solid var(--border-color);border-radius:8px;background:transparent;color:var(--text-muted);font-size:12px;font-weight:600;cursor:default;">Current Plan</button>';
    } else if (isUpgrade) {
      html += '<button onclick="selectTierChange(\'' + t.id + '\')" style="padding:10px;border:none;border-radius:8px;background:linear-gradient(135deg,#a89878,#d4b896);color:#0a0a0a;font-size:12px;font-weight:700;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">Upgrade to ' + escapeHtml(t.name) + '</button>';
    } else if (isDowngrade) {
      html += '<button onclick="selectTierChange(\'' + t.id + '\')" style="padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer;">Downgrade to ' + escapeHtml(t.name) + '</button>';
    }

    card.innerHTML = html;
    container.appendChild(card);
  });

  var note = document.getElementById('tierPickerNote');
  if (note) {
    if (currentRank > 0) {
      note.textContent = 'Plan changes are handled by Stripe. Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of your current billing period.';
    } else {
      note.textContent = 'Select a plan to get started. You can change or cancel anytime.';
    }
  }

  openModal('tierPickerModal');
}

// v20.7: Handle tier change from picker — routes to portal (existing sub) or new checkout
function selectTierChange(tier) {
  closeModal('tierPickerModal');
  var currentTier = _cachedUserTier || 'free';
  var tierRank = { free: 0, solo: 1, basic: 1, founder: 2, premium: 3 };
  var hasSubscription = false;

  // Check if user has existing Stripe subscription
  if (firebaseUser) {
    firebase.firestore().collection('roweos_users').doc(firebaseUser.uid).get()
      .then(function(doc) {
        if (doc.exists && doc.data().stripeCustomerId) {
          // Existing subscriber — send to Customer Portal for plan change
          showToast('Opening subscription management...', 'info');
          var customerId = doc.data().stripeCustomerId;
          return fetch('/api/create-portal-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: customerId })
          })
          .then(function(resp) { return resp.json(); })
          .then(function(data) {
            if (data.url) {
              window.location.href = data.url;
            } else {
              showToast(data.error || 'Could not open portal', 'error');
            }
          });
        } else {
          // No existing subscription — create new checkout
          openCheckoutForTier(tier);
        }
      })
      .catch(function() {
        openCheckoutForTier(tier);
      });
  } else {
    openCheckoutForTier(tier);
  }
}

// v20.7: Create new Stripe Checkout Session
function openCheckoutForTier(tier) {
  var email = (firebaseUser && firebaseUser.email) ? firebaseUser.email : null;
  showToast('Opening checkout...', 'info');

  fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: tier, email: email })
  })
  .then(function(resp) { return resp.json(); })
  .then(function(data) {
    if (data.url) {
      window.location.href = data.url;
    } else {
      showToast(data.error || 'Could not start checkout', 'error');
    }
  })
  .catch(function(err) {
    console.error('[Checkout] Error:', err);
    showToast('Unable to start checkout. Please try again.', 'error');
  });
}

// v20.6: Manage subscription via Stripe Customer Portal
function openManageSubscription() {
  if (!firebaseUser) {
    showToast('Please sign in first', 'warning');
    return;
  }

  showToast('Opening subscription portal...', 'info');

  // Get stripeCustomerId from Firestore user doc
  firebase.firestore().collection('roweos_users').doc(firebaseUser.uid).get()
    .then(function(doc) {
      if (!doc.exists || !doc.data().stripeCustomerId) {
        showToast('No subscription found. Use Upgrade Plan to subscribe.', 'warning');
        return;
      }

      var customerId = doc.data().stripeCustomerId;

      return fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerId })
      })
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        if (data.url) {
          window.location.href = data.url;
        } else {
          showToast(data.error || 'Could not open portal', 'error');
        }
      });
    })
    .catch(function(err) {
      console.error('[Portal] Error:', err);
      showToast('Unable to open subscription portal', 'error');
    });
}

function showAccessKeyInput() {
  var area = document.getElementById('settingsAccessKeyArea');
  if (!area) return;
  area.style.display = area.style.display === 'none' ? 'block' : 'none';
  if (area.style.display === 'block') {
    var inp = document.getElementById('settingsAccessKeyInput');
    if (inp) { inp.value = ''; inp.focus(); }
    var st = document.getElementById('settingsAccessKeyStatus');
    if (st) st.textContent = '';
  }
}

function activateSettingsAccessKey() {
  var inp = document.getElementById('settingsAccessKeyInput');
  var st = document.getElementById('settingsAccessKeyStatus');
  if (!inp) return;
  var key = inp.value.trim().toUpperCase();
  if (!key || key.length < 10) {
    if (st) { st.textContent = 'Please enter a valid access key.'; st.style.color = '#ef4444'; }
    return;
  }
  if (!firebaseUser) {
    if (st) { st.textContent = 'Please sign in first.'; st.style.color = '#ef4444'; }
    return;
  }
  if (st) { st.textContent = 'Validating...'; st.style.color = 'var(--text-muted)'; }

  // v20.6: Validate key exists and is active, then link to user
  validateAccessKey(key).then(function(result) {
    if (!result.valid) {
      if (st) { st.textContent = 'Invalid or expired key.'; st.style.color = '#ef4444'; }
      return;
    }
    return linkAccessKeyToUser(key).then(function() {
      _cachedUserTier = null;
      _cachedUserTierExpiry = 0;
      if (st) { st.textContent = 'Key activated! Tier: ' + (result.tier || 'basic').toUpperCase(); st.style.color = '#22c55e'; }
      showToast('Access key activated: ' + (result.tier || 'basic') + ' tier', 'success');
      renderSettingsPlan();
    });
  }).catch(function(err) {
    if (st) { st.textContent = 'Error: ' + (err.message || 'Could not validate key'); st.style.color = '#ef4444'; }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// v15.0: ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function renderAdminPanel() {
  // v22.1: Admin panel is now in its own view, no show/hide needed
  if (!isAdmin()) return;
  adminLoadKeys();
  adminLoadUsers();
  adminLoadBrandConfigs(); // v20.3
  adminLoadApiKeyPool(); // v20.9

  // v20.3: Populate brand config brand dropdown
  var brandSelect = document.getElementById('adminBrandConfigBrand');
  if (brandSelect) {
    var currentVal = brandSelect.value;
    brandSelect.innerHTML = '<option value="invite">Invite Only (no brand data)</option><option value="all">All My Brands</option>';
    if (brands && brands.length) {
      brands.forEach(function(b, idx) {
        var opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = b.shortName || b.name || ('Brand ' + idx);
        brandSelect.appendChild(opt);
      });
    }
    brandSelect.value = currentVal || 'invite';
  }

  // v22.1: Show admin nav item
  if (typeof updateAdminNavVisibility === 'function') updateAdminNavVisibility();
}

// v22.1: Admin tab switcher
function showAdminTab(tabName) {
  // Hide all tab content
  var tabs = document.querySelectorAll('.admin-tab-content');
  tabs.forEach(function(t) { t.style.display = 'none'; });
  // Deactivate all tab buttons
  var btns = document.querySelectorAll('#adminTabBar .admin-tab');
  btns.forEach(function(b) {
    b.style.borderBottomColor = 'transparent';
    b.style.color = 'var(--text-secondary)';
    b.style.fontWeight = '500';
    b.classList.remove('active');
  });
  // Show selected tab
  // v31.0: campaigns tab added
  var tabMap = { keys: 'adminTabKeys', users: 'adminTabUsers', configs: 'adminTabConfigs', pool: 'adminTabPool', feedback: 'adminTabFeedback', signups: 'adminTabSignups', emails: 'adminTabEmails', campaigns: 'adminTabCampaigns' };
  var targetId = tabMap[tabName];
  if (targetId) {
    var el = document.getElementById(targetId);
    if (el) el.style.display = 'block';
  }
  // Activate selected button
  var activeBtn = document.querySelector('#adminTabBar .admin-tab[data-tab="' + tabName + '"]');
  if (activeBtn) {
    activeBtn.style.borderBottomColor = 'var(--accent)';
    activeBtn.style.color = 'var(--accent)';
    activeBtn.style.fontWeight = '600';
    activeBtn.classList.add('active');
  }
  // Load data for the selected tab
  if (tabName === 'feedback' && typeof renderAdminFeedback === 'function') renderAdminFeedback();
  if (tabName === 'signups' && typeof adminLoadSignups === 'function') adminLoadSignups();
  if (tabName === 'emails' && typeof adminLoadEmailData === 'function') adminLoadEmailData();
  // v31.0: Auto-load Campaigns tab — prefer modular adminLoadCampaigns (25-admin-campaigns.js),
  // fall back to legacy adminRenderCampaigns (25-admin-emails.js) if the modular file isn't loaded.
  if (tabName === 'campaigns') {
    if (typeof adminLoadCampaigns === 'function') {
      adminLoadCampaigns();
    } else if (typeof adminRenderCampaigns === 'function') {
      adminRenderCampaigns();
    }
  }
}

// v22.1: Show/hide admin nav based on admin status
function updateAdminNavVisibility() {
  var show = isAdmin();
  var navItem = document.getElementById('adminNavItem');
  var navItemExp = document.getElementById('adminNavItemExp');
  if (navItem) navItem.style.display = show ? '' : 'none';
  if (navItemExp) navItemExp.style.display = show ? '' : 'none';
}

function adminGenerateKey() {
  if (!isAdmin()) return;
  var tier = document.getElementById('adminKeyTier').value;
  var note = document.getElementById('adminKeyNote').value;
  var resultEl = document.getElementById('adminKeyResult');
  // v21.0: Read expiry fields
  var expiryEl = document.getElementById('adminKeyExpiry');
  var expiryActionEl = document.getElementById('adminKeyExpiryAction');
  var expiresAt = expiryEl && expiryEl.value ? expiryEl.value : null;
  var expiryAction = expiryActionEl ? expiryActionEl.value : 'expire';

  generateAccessKey(tier, note, expiresAt, expiryAction).then(function(key) {
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.textContent = key;
    }
    // v21.14: Store key + tier for email generator, show button
    window._lastGeneratedKey = key;
    window._lastGeneratedTier = tier;
    var emailBtn = document.getElementById('adminGenEmailBtn');
    if (emailBtn) emailBtn.style.display = 'block';
    if (document.getElementById('adminKeyNote')) document.getElementById('adminKeyNote').value = '';
    if (expiryEl) expiryEl.value = '';
    adminLoadKeys();
  }).catch(function(err) {
    showToast('Error generating key: ' + err.message, 'error');
  });
}

// v22.4: Admin Signups tab — load newsletter subscribers
function adminLoadSignups() {
  if (!isAdmin() || !firebase) return;
  var listEl = document.getElementById('adminSignupsList');
  if (!listEl) return;
  listEl.innerHTML = '<div style="color:var(--text-muted);padding:8px 0;">Loading signups...</div>';

  // v30.1: One-time migration — flip existing 'unknown' sources to 'info_page'
  var _migKey = 'roweos_signup_source_migrated';
  var _migDone = localStorage.getItem(_migKey);
  var _migPromise = Promise.resolve();
  if (!_migDone) {
    _migPromise = firebase.firestore().collection('newsletter_subscribers')
      .where('source', '==', 'unknown')
      .get()
      .then(function(migSnap) {
        if (migSnap.empty) { localStorage.setItem(_migKey, 'true'); return; }
        var db = firebase.firestore();
        var batch = db.batch();
        migSnap.docs.forEach(function(d) {
          batch.update(d.ref, { source: 'info_page' });
          // v30.1: Also fix the access key note from "Newsletter signup" to "Info Page signup"
          var ak = d.data().accessKey;
          if (ak) {
            var akRef = db.collection('access_keys').doc(ak);
            batch.update(akRef, { note: 'Info Page signup' });
          }
        });
        return batch.commit().then(function() {
          console.log('[Admin] Migrated ' + migSnap.size + ' signups from unknown to info_page (+ access key notes)');
          localStorage.setItem(_migKey, 'true');
        });
      }).catch(function(e) { console.warn('[Admin] Source migration failed:', e.message); });
  }

  _migPromise.then(function() {
  firebase.firestore().collection('newsletter_subscribers')
    .orderBy('subscribedAt', 'desc')
    .limit(100)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        listEl.innerHTML = '<div style="color:var(--text-muted);padding:8px 0;">No signups yet</div>';
        return;
      }
      var html = '';
      snap.docs.forEach(function(doc) {
        var d = doc.data();
        var email = d.email || 'Unknown';
        var name = d.name || '';
        var type = d.type || 'individual';
        var tier = d.tier || '';
        var company = d.companyName || '';
        var key = d.accessKey || '';
        var srcField = d.source || '';
        var date = d.subscribedAt ? new Date(d.subscribedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        var time = d.subscribedAt ? new Date(d.subscribedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

        // v30.1: Source badge with expanded labels
        var sourceBadge = '';
        var _srcLabels = { info_page: 'Info Page', newsletter_page: 'Newsletter', main_app: 'App', direct: 'Direct', unknown: 'Unknown Source', 'Welcome Screen': 'Welcome Screen', 'Google/X Auth': 'Google/X Auth' };
        var _srcColors = { info_page: '#2dd4bf', newsletter_page: '#fb923c', main_app: '#a78bfa', direct: '#94a3b8', unknown: '#94a3b8', 'Welcome Screen': '#38bdf8', 'Google/X Auth': '#fb923c' };
        var _srcLabel = _srcLabels[srcField] || (srcField || 'Unknown Source');
        var _srcColor = _srcColors[srcField] || '#94a3b8';
        if (srcField || true) {
          sourceBadge = ' <span style="display:inline-block;padding:2px 8px;background:' + _srcColor + '22;border:1px solid ' + _srcColor + '44;border-radius:4px;font-size:10px;font-weight:600;color:' + _srcColor + ';text-transform:uppercase;letter-spacing:0.5px;">' + escapeHtml(_srcLabel) + '</span>';
        }

        // Type badge
        var typeBadge = type === 'company'
          ? '<span style="display:inline-block;padding:2px 8px;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:4px;font-size:10px;font-weight:600;color:#a78bfa;text-transform:uppercase;letter-spacing:0.5px;">Company</span>'
          : '<span style="display:inline-block;padding:2px 8px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:4px;font-size:10px;font-weight:600;color:#60a5fa;text-transform:uppercase;letter-spacing:0.5px;">Individual</span>';

        // Tier badge
        var tierBadge = '';
        if (tier) {
          var tierColor = tier === 'founder' ? '#a89878' : (tier === 'premium' ? '#f472b6' : '#4ade80');
          tierBadge = ' <span style="display:inline-block;padding:2px 8px;background:rgba(168,152,120,0.1);border:1px solid ' + tierColor + '44;border-radius:4px;font-size:10px;font-weight:600;color:' + tierColor + ';text-transform:uppercase;letter-spacing:0.5px;">' + escapeHtml(tier) + '</span>';
        }

        html += '<div style="padding:14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:8px;">';
        // Top row: email + badges
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:8px;">';
        html += '<div style="font-weight:600;color:var(--text-primary);font-size:13px;">' + escapeHtml(email) + '</div>';
        html += '<div style="display:flex;gap:6px;align-items:center;">' + typeBadge + tierBadge + sourceBadge + '</div>';
        html += '</div>';
        // Info row
        html += '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);">';
        if (name) html += '<span>' + escapeHtml(name) + '</span>';
        if (company) html += '<span style="color:var(--text-secondary);font-weight:500;">' + escapeHtml(company) + '</span>';
        if (date) html += '<span>' + date + ' ' + time + '</span>';
        html += '</div>';
        // Key + action row
        if (key) {
          html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);">';
          html += '<code style="font-size:12px;color:var(--accent);letter-spacing:1px;font-weight:600;">' + escapeHtml(key) + '</code>';
          html += '<div style="display:flex;gap:6px;">';
          html += '<button onclick="adminSendWelcomeEmail(\'' + escapeHtml(email).replace(/'/g, "\\'") + '\', \'' + escapeHtml(key).replace(/'/g, "\\'") + '\', \'' + escapeHtml(tier).replace(/'/g, "\\'") + '\')" style="padding:4px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:var(--text-xs);">';
          html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';
          html += 'Email</button>';
          html += '<button onclick="adminDeleteSignup(\'' + escapeHtml(email).replace(/'/g, "\\'") + '\', \'' + escapeHtml(key).replace(/'/g, "\\'") + '\', this)" style="padding:4px 12px;background:var(--bg-tertiary);border:1px solid rgba(220,100,100,0.3);border-radius:var(--radius-sm);color:#dc6464;cursor:pointer;font-size:var(--text-xs);">';
          html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
          html += 'Delete</button>';
          html += '</div>';
          html += '</div>';
        } else {
          html += '<div style="display:flex;justify-content:flex-end;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);">';
          html += '<button onclick="adminDeleteSignup(\'' + escapeHtml(email).replace(/'/g, "\\'") + '\', \'\', this)" style="padding:4px 12px;background:var(--bg-tertiary);border:1px solid rgba(220,100,100,0.3);border-radius:var(--radius-sm);color:#dc6464;cursor:pointer;font-size:var(--text-xs);">';
          html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
          html += 'Delete</button>';
          html += '</div>';
        }
        html += '</div>';
      });
      // v30.1: Add total count header
      var countHtml = '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;margin-bottom:12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);">';
      countHtml += '<div style="font-size:14px;font-weight:600;color:var(--text-primary);">' + snap.size + ' Total Signups</div>';
      countHtml += '<button onclick="adminLoadSignups()" style="padding:4px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:var(--text-xs);">Refresh</button>';
      countHtml += '</div>';
      listEl.innerHTML = countHtml + html;
    })
    .catch(function(err) {
      console.error('[Admin] Load signups error:', err);
      listEl.innerHTML = '<div style="color:#dc6464;padding:8px 0;">Error loading signups: ' + escapeHtml(err.message) + '</div>';
    });
  }); // v30.1: close _migPromise.then
}

// v22.5: Delete signup — removes subscriber doc + access key doc
function adminDeleteSignup(email, accessKey, btnEl) {
  if (!isAdmin() || !firebase) return;
  if (!confirm('Delete signup for ' + email + '?\n\nThis will also revoke access key ' + accessKey + '.')) return;
  var btn = btnEl;
  btn.textContent = '...';
  btn.disabled = true;
  var db = firebase.firestore();
  // Doc ID is sha256(email).substring(0,20) — same as newsletter.js
  // We can't compute sha256 client-side easily, so query by email instead
  var promises = [];
  // Delete subscriber doc by querying email
  promises.push(
    db.collection('newsletter_subscribers').where('email', '==', email).get().then(function(snap) {
      var batch = db.batch();
      snap.docs.forEach(function(doc) { batch.delete(doc.ref); });
      return batch.commit();
    })
  );
  // Delete access key doc (doc ID = the key string)
  if (accessKey) {
    promises.push(db.collection('access_keys').doc(accessKey).delete().catch(function(e) {
      console.warn('[Admin] Access key delete failed (may not exist):', e.message);
    }));
  }
  Promise.all(promises).then(function() {
    showToast('Deleted signup for ' + email, 'success');
    // Remove the card from DOM
    var card = btn.closest('div[style*="padding:14px"]');
    if (card) card.remove();
  }).catch(function(err) {
    console.error('[Admin] Delete signup error:', err);
    showToast('Delete failed: ' + err.message, 'error');
    btn.textContent = 'Delete';
    btn.disabled = false;
  });
}

// v22.4: Company welcome email template (mirrors server-side buildCompanyWelcomeEmail)
function generateCompanyWelcomeEmail(vars) {
  var accessKey = vars.accessKey || 'ROWE-XXXX-XXXX';
  var companyName = vars.companyName || 'Company Name';
  var firstName = vars.firstName || '';
  var gold = '#a89878';
  var bg = '#0a0a0a';
  var cardBg = '#141414';
  var borderColor = '#1e1e1e';
  var textColor = '#e8e4df';
  var dimText = '#8a857f';
  var greeting = firstName ? ('Welcome, ' + firstName) : 'Welcome';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:' + bg + ';">'
    + '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:600px;margin:0 auto;background:' + bg + ';color:' + dimText + ';">'
    // Header
    + '<div style="background:linear-gradient(135deg,#1a1a1a 0%,' + bg + ' 100%);padding:48px 40px 32px;border-radius:12px 12px 0 0;text-align:center;">'
    + '<img src="https://roweos.com/logo.png" alt="RoweOS" style="width:80px;height:80px;border-radius:16px;margin-bottom:16px;">'
    + '<h1 style="color:' + gold + ';margin:0;font-size:28px;font-weight:300;letter-spacing:3px;">RoweOS</h1>'
    + '<p style="color:#666;margin:8px 0 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Operating intelligence, built for brands &amp; life</p>'
    + '<div style="display:inline-block;padding:6px 20px;background:rgba(168,152,120,0.1);border:1px solid rgba(168,152,120,0.2);border-radius:20px;margin-top:16px;">'
    + '<span style="font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:' + gold + ';">' + escapeHtml(companyName) + '</span>'
    + '</div>'
    + '</div>'
    // Content
    + '<div style="background:#111;padding:36px 40px 40px;">'
    + '<h2 style="color:#fff;font-size:22px;font-weight:500;margin:0 0 8px;">' + greeting + '</h2>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 28px;">You\'ve been granted Founder access to RoweOS for <strong style="color:#fff;">' + escapeHtml(companyName) + '</strong> - a private AI operating system for managing your brands, team, and operations from a single platform.</p>'
    // Key block
    + '<div style="background:#1a1a1a;border:1px solid ' + gold + '44;border-radius:8px;padding:18px;text-align:center;margin-bottom:28px;">'
    + '<p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">Your Access Key</p>'
    + '<code style="font-size:22px;color:' + gold + ';letter-spacing:3px;font-weight:600;">' + accessKey + '</code>'
    + '<p style="color:#666;font-size:11px;margin:10px 0 0;">Founder Tier - Full platform + advanced features</p>'
    + '</div>'
    // Admin Setup
    + '<div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:28px;">'
    + '<p style="color:#fff;font-size:14px;font-weight:500;margin:0 0 12px;">Admin Setup</p>'
    + '<ol style="line-height:2;color:#ccc;margin:0;padding-left:20px;font-size:13px;">'
    + '<li>Go to <a href="https://roweos.com" style="color:' + gold + ';text-decoration:none;">roweos.com</a> and create your account</li>'
    + '<li>Open <strong style="color:#fff;">Settings</strong> and enter your Access Key</li>'
    + '<li>Set up your company brand in <strong style="color:#fff;">Identity</strong> (name, logo, colors, voice)</li>'
    + '<li>Configure your AI agents and operations in <strong style="color:#fff;">Studio</strong></li>'
    + '<li>Connect social accounts in <strong style="color:#fff;">Settings &gt; Social</strong></li>'
    + '</ol>'
    + '</div>'
    // Team invitation
    + '<div style="background:rgba(168,152,120,0.06);border:1px solid rgba(168,152,120,0.15);border-radius:8px;padding:20px;margin-bottom:28px;">'
    + '<p style="color:#fff;font-size:14px;font-weight:500;margin:0 0 8px;">Inviting Team Members</p>'
    + '<p style="color:#ccc;font-size:13px;line-height:1.6;margin:0;">As a Founder, you can share your brand configuration with team members. Use the <strong style="color:#fff;">Share Brand</strong> button in Identity to generate a join link. Team members will need their own RoweOS accounts and access keys.</p>'
    + '</div>'
    // Footer
    + '<p style="color:#555;font-size:12px;margin:28px 0 0;padding-top:20px;border-top:1px solid #222;">'
    + 'Questions? Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color:' + gold + ';text-decoration:none;">jordan@therowecollection.com</a>'
    + '</p>'
    + '</div>'
    + '</div>'
    + '</body></html>';
}

// v22.4: Load template into composer
function loadComposerTemplate(name) {
  var key = window._composerKey || 'ROWE-XXXX-XXXX';
  var tier = window._composerTier || 'solo';
  var html = '';
  var subjectEl = document.getElementById('composerSubject');

  // v22.7: Branded template support
  var isBrandedTemplate = name && name.indexOf('brand-') === 0;
  if (isBrandedTemplate) {
    var layout = name.replace('brand-', '');
    html = generateBrandedEmail(layout);
  } else if (name === 'check-in') {
    html = generateCheckInEmail(key);
    if (subjectEl) subjectEl.value = 'How\'s RoweOS working for you?';
  } else if (name === 'onboarding_survey') {
    html = generateOnboardingSurveyPreview();
    if (subjectEl) subjectEl.value = 'Quick questions about your RoweOS experience';
  } else if (name === 'reengagement') {
    html = generateReengagementPreview();
    if (subjectEl) subjectEl.value = 'Your AI brand team is waiting for you';
  } else if (name === 'feature_announcement') {
    html = generateFeatureAnnouncementPreview();
    if (subjectEl) subjectEl.value = 'New in RoweOS: [Feature Name]';
  } else if (name === 'checkin_new') {
    html = generateCheckinRatingPreview();
    if (subjectEl) subjectEl.value = 'How\'s RoweOS working for you?';
  } else if (name === 'subscription_info') {
    html = generateSubscriptionInfoPreview();
    if (subjectEl) subjectEl.value = 'RoweOS Plans, API Keys, and AI Routing';
  } else if (name === 'individual') {
    html = generateBetaWelcomeEmail(key, 'solo');
    if (subjectEl) subjectEl.value = 'Welcome to RoweOS Solo - Your Access Key';
  } else if (name === 'company') {
    html = generateCompanyWelcomeEmail({ accessKey: key, companyName: 'Company Name', firstName: '' });
    if (subjectEl) subjectEl.value = 'Welcome to RoweOS Founder - Company Access Key';
  } else {
    // default: original beta template
    html = generateBetaWelcomeEmail(key, tier);
    var tierLabel = (tier || 'solo').charAt(0).toUpperCase() + (tier || 'solo').slice(1);
    if (subjectEl) subjectEl.value = 'Welcome to RoweOS ' + tierLabel + ' - Your Access Key';
  }

  // v22.7: Determine if template has light or dark background
  var isLightBg = isBrandedTemplate && (layout === 'professional' || layout === 'minimal' || layout === 'newsletter');

  // Load into iframe
  var preview = document.getElementById('betaEmailPreviewContent');
  if (preview) {
    var iframeBg = isLightBg ? '#f5f5f5' : '#0a0a0a';
    preview.innerHTML = '<iframe id="betaEmailIframe" style="width:100%;min-height:300px;border:none;border-radius:8px;background:' + iframeBg + ';" frameborder="0"></iframe>';
    var iframe = document.getElementById('betaEmailIframe');
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    var style = doc.createElement('style');
    if (isLightBg) {
      // v22.7: Light styles for white-bg branded templates
      style.textContent = '* { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; } body { color: #333; background: #f5f5f5 !important; } a { color: inherit !important; }';
    } else {
      style.textContent = '* { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; } body { color: #ccc; background: #0a0a0a !important; } div, p, span, td, li, br, section, article { color: #ccc; } ol, ul { color: #ccc; } ol li::marker, ul li::marker { color: #ccc; } font[color="#000000"], font[color="black"] { color: #ccc !important; } [style*="color: rgb(0, 0, 0)"], [style*="color:rgb(0, 0, 0)"], [style*="color: black"] { color: #ccc !important; } code { color: #a89878 !important; font-family: "SF Mono", Monaco, "Courier New", monospace !important; } h1, h2, h3, strong { color: #fff !important; } a { color: #a89878 !important; }';
    }
    doc.head.appendChild(style);
    doc.designMode = 'on';
    doc.addEventListener('selectionchange', function() { composerSaveSelection(); });
    doc.addEventListener('mouseup', function() { composerSaveSelection(); });
    doc.addEventListener('keyup', function() { composerSaveSelection(); });
    doc.addEventListener('input', function() {
      try {
        var blacks = doc.querySelectorAll('font[color="#000000"], font[color="black"]');
        for (var i = 0; i < blacks.length; i++) { blacks[i].removeAttribute('color'); }
        var inlineBlacks = doc.querySelectorAll('[style*="color: rgb(0, 0, 0)"], [style*="color:rgb(0, 0, 0)"]');
        for (var j = 0; j < inlineBlacks.length; j++) { inlineBlacks[j].style.removeProperty('color'); }
      } catch(e) {}
    });
    // v23.14: If Studio content is pending, inject it into the template body
    if (window._composerStudioContent) {
      setTimeout(function() {
        try {
          var studioHtml = window._composerStudioContent;
          // Find the main content area in the template and replace/append
          var bodyEl = doc.body;
          if (bodyEl) {
            // For branded templates, find the content container; for others, replace body
            var contentArea = bodyEl.querySelector('td[style*="padding"]') || bodyEl.querySelector('div[style*="padding"]') || bodyEl;
            if (contentArea && contentArea !== bodyEl) {
              contentArea.innerHTML = studioHtml;
            } else {
              bodyEl.innerHTML = studioHtml;
            }
          }
        } catch(e) { console.warn('[Composer] Studio content inject error:', e); }
      }, 100);
    }
    setTimeout(function() {
      try { iframe.style.height = Math.min(Math.max(doc.body.scrollHeight + 20, 300), 900) + 'px'; } catch(e) { iframe.style.height = '500px'; }
    }, 250);
  }
}

// v30.1: Shared email preview wrapper with logo and dark background
function _emailPreviewWrap(subtitle, body) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
    + '<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center">'
    + '<table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:12px;border:1px solid #2a2a2a;">'
    + '<tr><td style="background:linear-gradient(135deg,#1a1a1a 0%,#0a0a0a 100%);padding:40px 32px 24px;text-align:center;border-bottom:1px solid #1e1e1e;border-radius:12px 12px 0 0;">'
    + '<img src="https://roweos.com/logo.png" alt="RoweOS" style="width:64px;height:64px;border-radius:12px;margin-bottom:12px;">'
    + '<h1 style="margin:0;font-size:28px;font-weight:300;color:#a89878;letter-spacing:2px;">RoweOS</h1>'
    + (subtitle ? '<p style="margin:8px 0 0;font-size:12px;color:#666;letter-spacing:1.5px;text-transform:uppercase;">' + subtitle + '</p>' : '<p style="margin:8px 0 0;font-size:12px;color:#666;letter-spacing:1.5px;text-transform:uppercase;">Operating intelligence, built for brands &amp; life</p>')
    + '</td></tr><tr><td style="padding:32px;background:#111;">' + body + '</td></tr>'
    + '<tr><td style="padding:24px 32px 0;text-align:center;border-top:1px solid #2a2a2a;">'
    + '<p style="font-family:\'DM Sans\',sans-serif;font-size:20px;font-weight:300;color:#a89878;letter-spacing:1px;margin:0 0 4px;">Intelligence, accessible.</p>'
    + '<p style="font-family:\'DM Sans\',sans-serif;font-size:13px;color:#888;margin:0 0 16px;">Simple plans. No hidden fees.</p>'
    + '<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>'
    + '<td style="padding-right:8px;"><a href="https://roweos.com/purchase" style="display:inline-block;padding:10px 24px;border:1px solid #a89878;border-radius:6px;color:#a89878;text-decoration:none;font-family:\'DM Sans\',sans-serif;font-size:13px;font-weight:500;">View Plans</a></td>'
    + '<td style="padding-left:8px;"><a href="https://roweos.com/purchase" style="display:inline-block;padding:10px 24px;border:1px solid #a89878;border-radius:6px;color:#a89878;text-decoration:none;font-family:\'DM Sans\',sans-serif;font-size:13px;font-weight:500;">Get API Keys</a></td>'
    + '</tr></table>'
    + '</td></tr>'
    + '<tr><td style="padding:16px 32px 24px;border-top:1px solid #1e1e1e;text-align:center;">'
    + '<p style="margin:0;font-size:11px;color:#555;">The Rowe Collection, LLC - Austin, TX</p>'
    + '<p style="margin:6px 0 0;font-size:11px;color:#444;">Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color:#a89878;text-decoration:none;">jordan@therowecollection.com</a></p>'
    + '</td></tr></table></td></tr></table></body></html>';
}

// v30.1: Get auto-filled greeting from stored recipient name
function _emailGreeting() {
  var name = window._composerRecipientName || '';
  var firstName = name ? name.split(' ')[0] : '';
  return firstName ? 'Hi ' + firstName + ',' : 'Hi there,';
}

// v30.1: Onboarding Survey email preview
function generateOnboardingSurveyPreview() {
  var btn = function(label) { return '<a href="#" style="display:inline-block;padding:10px 20px;background:#1a1a1a;border:1px solid rgba(168,152,120,0.27);border-radius:8px;color:#e0e0e0;text-decoration:none;font-size:13px;font-weight:500;margin:0 6px 8px 0;">' + label + '</a>'; };
  var body = '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">' + _emailGreeting() + '</p>'
    + '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 28px;">We\'d love to learn about your experience with RoweOS so far. A few quick questions (just click your answer):</p>'
    + '<div style="margin-bottom:28px;"><p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">Do you know how to set up your own AI API key?</p>'
    + '<div>' + btn('Yes, I have my own') + '<a href="https://roweos.com/info" style="display:inline-block;padding:10px 20px;background:#1a1a1a;border:1px solid rgba(168,152,120,0.27);border-radius:8px;color:#e0e0e0;text-decoration:none;font-size:13px;font-weight:500;margin:0 6px 8px 0;">No, help me get one</a>' + '</div></div>'
    + '<div style="margin-bottom:28px;"><p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">Do you need a beta API key?</p>'
    + '<div>' + btn('Yes, I need one') + btn('No, I have my own') + btn('Not sure what this means') + '</div></div>'
    + '<div style="margin-bottom:28px;"><p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">How did you hear about RoweOS?</p>'
    + '<div>' + btn('Twitter / X') + btn('Google Search') + btn('Friend / Referral') + btn('LinkedIn') + btn('Product Hunt') + btn('Other') + '</div></div>'
    + '<div style="margin-bottom:28px;"><p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">How has your experience been so far?</p>'
    + '<div>' + btn('Smooth, love it') + btn('Good, some questions') + btn('Hit some bumps') + btn('Need help') + '</div></div>'
    + '<p style="color:#888;font-size:13px;line-height:1.6;margin:0;">Have more to share? Just reply to this email. We read every response.</p>';
  return _emailPreviewWrap('Onboarding', body);
}

// v30.1: Re-engagement email preview
function generateReengagementPreview() {
  var card = function(title, desc) {
    return '<div style="padding:16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;margin-bottom:10px;">'
      + '<p style="color:#e0e0e0;font-size:14px;font-weight:500;margin:0 0 4px;">' + title + '</p>'
      + '<p style="color:#888;font-size:12px;margin:0;">' + desc + '</p></div>';
  };
  var body = '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">' + _emailGreeting() + '</p>'
    + '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 28px;">We noticed you haven\'t been back in a while. Here are a few things you can try in under 5 minutes:</p>'
    + card('Run a Studio operation', '200+ pre-built AI operations for strategy, marketing, content, and more.')
    + card('Set up your brand identity', 'Give your AI agents the context they need to write in your voice.')
    + card('Ask BLAKE anything', 'Your brand\'s AI is ready. Start a conversation in Chat.')
    + '<div style="text-align:center;margin:28px 0 12px;"><a href="https://roweos.com" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a89878,#c4a882);color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Open RoweOS</a></div>'
    + '<p style="color:#888;font-size:13px;text-align:center;margin:0;">Need help getting started? Just reply to this email.</p>';
  return _emailPreviewWrap(null, body);
}

// v30.1: Feature Announcement email preview
function generateFeatureAnnouncementPreview() {
  var body = '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">' + _emailGreeting() + '</p>'
    + '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 24px;">We just shipped something new:</p>'
    + '<div style="padding:24px;background:#1a1a1a;border:1px solid rgba(168,152,120,0.27);border-radius:12px;margin-bottom:24px;">'
    + '<h2 style="color:#a89878;font-size:20px;font-weight:500;margin:0 0 12px;">[Feature Name]</h2>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0;">[Feature description goes here. Edit this text to describe the new capability.]</p></div>'
    + '<div style="text-align:center;margin:28px 0 12px;"><a href="https://roweos.com" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a89878,#c4a882);color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Try it now</a></div>';
  return _emailPreviewWrap('What\'s New', body);
}

// v30.1: Check-in Rating email preview
function generateCheckinRatingPreview() {
  var btn = function(label) { return '<a href="#" style="display:inline-block;padding:10px 20px;background:#1a1a1a;border:1px solid rgba(168,152,120,0.27);border-radius:8px;color:#e0e0e0;text-decoration:none;font-size:13px;font-weight:500;margin:0 6px 8px 0;">' + label + '</a>'; };
  var body = '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">' + _emailGreeting() + '</p>'
    + '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 28px;">How\'s everything going with RoweOS? We\'d love a quick pulse check:</p>'
    + '<div style="margin-bottom:28px;"><p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">How would you rate your experience?</p>'
    + '<div>' + btn('Loving it') + btn('It\'s good') + btn('Could be better') + btn('Having issues') + '</div></div>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 24px;">What would make RoweOS better for you? Just reply to this email with your thoughts.</p>'
    + '<div style="text-align:center;margin:20px 0 12px;"><a href="https://roweos.com" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a89878,#c4a882);color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Open RoweOS</a></div>';
  return _emailPreviewWrap('Check-In', body);
}

// v30.4: Subscription Info email preview
function generateSubscriptionInfoPreview() {
  var cta = function(url, label) {
    return '<a href="' + url + '" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#a89878,#c4a882);color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">' + label + '</a>';
  };
  var body = '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 16px;">' + _emailGreeting() + '</p>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 24px;">Here is everything you need to know about RoweOS plans, AI API keys, and smart model routing.</p>'
    // Section 1: Choose Your Plan
    + '<h2 style="margin:0 0 16px;font-size:18px;color:#a89878;font-weight:500;letter-spacing:0.5px;">Choose Your Plan</h2>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:separate;border-spacing:0;">'
    // Header
    + '<tr>'
    + '<td style="padding:10px 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #2a2a2a;"></td>'
    + '<td style="padding:10px 8px;font-size:11px;color:#a89878;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:1px solid #2a2a2a;text-align:center;">Solo</td>'
    + '<td style="padding:10px 8px;font-size:11px;color:#a89878;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:1px solid #2a2a2a;text-align:center;">Founder</td>'
    + '<td style="padding:10px 8px;font-size:11px;color:#a89878;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:1px solid #2a2a2a;text-align:center;">Premium</td>'
    + '</tr>'
    // Price
    + '<tr>'
    + '<td style="padding:10px 8px;font-size:12px;color:#888;border-bottom:1px solid #1e1e1e;">Price</td>'
    + '<td style="padding:10px 8px;font-size:14px;color:#e0e0e0;font-weight:600;text-align:center;border-bottom:1px solid #1e1e1e;">$29/mo</td>'
    + '<td style="padding:10px 8px;font-size:14px;color:#e0e0e0;font-weight:600;text-align:center;border-bottom:1px solid #1e1e1e;">$59/mo</td>'
    + '<td style="padding:10px 8px;font-size:14px;color:#e0e0e0;font-weight:600;text-align:center;border-bottom:1px solid #1e1e1e;">$79/mo</td>'
    + '</tr>'
    // Trial
    + '<tr>'
    + '<td style="padding:10px 8px;font-size:12px;color:#888;border-bottom:1px solid #1e1e1e;">Trial</td>'
    + '<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">7 days free</td>'
    + '<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">14 days free</td>'
    + '<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">14 days free</td>'
    + '</tr>'
    // Brands
    + '<tr>'
    + '<td style="padding:10px 8px;font-size:12px;color:#888;border-bottom:1px solid #1e1e1e;">Brands</td>'
    + '<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">1 Brand</td>'
    + '<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">Up to 5</td>'
    + '<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">Up to 15</td>'
    + '</tr>'
    // Features
    + '<tr>'
    + '<td style="padding:10px 8px;font-size:12px;color:#888;">Features</td>'
    + '<td style="padding:10px 8px;font-size:12px;color:#ccc;text-align:center;line-height:1.5;">Studio, Identity, Analytics, Mail</td>'
    + '<td style="padding:10px 8px;font-size:12px;color:#ccc;text-align:center;line-height:1.5;">+ Automations, Pipelines, Social, Cloud Sync</td>'
    + '<td style="padding:10px 8px;font-size:12px;color:#ccc;text-align:center;line-height:1.5;">+ Bloom, Brand Sharing, Priority Support</td>'
    + '</tr>'
    + '</table>'
    + '<div style="text-align:center;margin:0 0 32px;">' + cta('https://roweos.com', 'Choose Your Plan') + '</div>'
    // Divider
    + '<div style="border-top:1px solid #2a2a2a;margin:0 0 24px;"></div>'
    // Section 2: AI API Keys
    + '<h2 style="margin:0 0 16px;font-size:18px;color:#a89878;font-weight:500;letter-spacing:0.5px;">AI API Keys - Pay As You Go</h2>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 20px;">RoweOS works with your own API keys from three providers:</p>'
    + '<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px 16px;margin:0 0 10px;">'
    + '<p style="margin:0 0 4px;font-size:14px;color:#e0e0e0;font-weight:500;">Anthropic (Claude)</p>'
    + '<p style="margin:0;font-size:12px;color:#888;">Latest: Sonnet 4.6, Opus 4.7, Haiku 4.5</p></div>'
    + '<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px 16px;margin:0 0 10px;">'
    + '<p style="margin:0 0 4px;font-size:14px;color:#e0e0e0;font-weight:500;">OpenAI (ChatGPT)</p>'
    + '<p style="margin:0;font-size:12px;color:#888;">Latest: GPT-5.4, GPT-5.4 Pro, GPT-5.4 Thinking</p></div>'
    + '<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px 16px;margin:0 0 10px;">'
    + '<p style="margin:0 0 4px;font-size:14px;color:#e0e0e0;font-weight:500;">Google (Gemini)</p>'
    + '<p style="margin:0;font-size:12px;color:#888;">Latest: Gemini 3.1 Pro, Deep Research, NanoBanana 3 Pro</p></div>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:16px 0 20px;">Bring your own keys and pay only for what you use. Or purchase pre-loaded keys from The Rowe Collection.</p>'
    + '<div style="text-align:center;margin:0 0 32px;">' + cta('https://roweos.com/purchase', 'Get API Keys') + '</div>'
    // Divider
    + '<div style="border-top:1px solid #2a2a2a;margin:0 0 24px;"></div>'
    // Section 3: RoweOS AI
    + '<h2 style="margin:0 0 16px;font-size:18px;color:#a89878;font-weight:500;letter-spacing:0.5px;">RoweOS AI - Unlock Smart Routing</h2>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.7;margin:0 0 16px;">When you have all three AI providers configured, RoweOS AI automatically selects the best model for each task. Strategy questions route to Claude. Creative content routes to GPT. Research and analysis routes to Gemini.</p>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.7;margin:0;">One prompt, the right model, every time.</p>';
  return _emailPreviewWrap('Subscription', body);
}

// v21.14: Beta Welcome Email Generator
// v30.2: Redesigned - key is saved for records only, not primary CTA
function generateBetaWelcomeEmail(accessKey, tier) {
  var tierLabel = (tier || 'founder').charAt(0).toUpperCase() + (tier || 'founder').slice(1);
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:#0a0a0a;">'
    + '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e0e0e0;">'
    // Header
    + '<div style="background:linear-gradient(135deg,#1a1a1a 0%,#0a0a0a 100%);padding:48px 40px 32px;border-radius:12px 12px 0 0;text-align:center;">'
    + '<img src="https://roweos.com/logo.png" alt="RoweOS" style="width:80px;height:80px;border-radius:16px;margin-bottom:16px;">'
    + '<h1 style="color:#a89878;margin:0;font-size:28px;font-weight:300;letter-spacing:3px;">RoweOS</h1>'
    + '<p style="color:#666;margin:8px 0 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Operating intelligence, built for brands &amp; life</p>'
    + '</div>'
    // Content
    + '<div style="background:#111;padding:36px 40px 40px;">'
    + '<h2 style="color:#fff;font-size:22px;font-weight:500;margin:0 0 8px;">Welcome to RoweOS ' + tierLabel + '</h2>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 28px;">Your 14-day free trial is now active. Here is everything you need to get started.</p>'
    // Getting Started
    + '<div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:28px;">'
    + '<p style="color:#a89878;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">Getting Started</p>'
    + '<ol style="line-height:2;color:#ccc;margin:0;padding-left:20px;font-size:13px;">'
    + '<li>Sign in at <a href="https://roweos.com" style="color:#a89878;text-decoration:none;">roweos.com</a> - your key activates automatically</li>'
    + '<li>Set up your brand in the onboarding wizard</li>'
    + '<li>Start chatting with your BrandAI agents</li>'
    + '</ol>'
    + '</div>'
    // What you get
    + '<div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:28px;">'
    + '<p style="color:#a89878;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">What You Get</p>'
    + '<ul style="line-height:2;color:#ccc;margin:0;padding-left:20px;font-size:13px;list-style:none;">'
    + '<li style="padding:2px 0;"><span style="color:#a89878;margin-right:8px;">&#10003;</span> 5 BrandAI agents (Strategy, Marketing, Operations, Documents, Intelligence)</li>'
    + '<li style="padding:2px 0;"><span style="color:#a89878;margin-right:8px;">&#10003;</span> Studio automations and pipelines</li>'
    + '<li style="padding:2px 0;"><span style="color:#a89878;margin-right:8px;">&#10003;</span> Mail, social publishing, and scheduling</li>'
    + '<li style="padding:2px 0;"><span style="color:#a89878;margin-right:8px;">&#10003;</span> Focus, Analytics, Inventory, and Calendar</li>'
    + '<li style="padding:2px 0;"><span style="color:#a89878;margin-right:8px;">&#10003;</span> Cloud sync across all your devices</li>'
    + '</ul>'
    + '</div>'
    // API Keys
    + '<div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:28px;">'
    + '<p style="color:#a89878;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">AI Model Access</p>'
    + '<p style="color:#ccc;font-size:13px;line-height:1.6;margin:0;">RoweOS works with Claude, GPT, and Google AI. Add your own API keys in <strong style="color:#fff;">Settings</strong>, or purchase pre-loaded keys directly inside the app.</p>'
    + '</div>'
    // CTA button
    + '<div style="text-align:center;margin-bottom:28px;">'
    + '<a href="https://roweos.com" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#a89878,#c4a882);color:#0a0a0a;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">Open RoweOS</a>'
    + '</div>'
    // Other plans
    + '<p style="color:#666;font-size:12px;text-align:center;margin:0 0 28px;">Explore all plans at <a href="https://roweos.com/purchase" style="color:#a89878;text-decoration:none;">roweos.com/purchase</a></p>'
    // Key for records (de-emphasized)
    + '<div style="background:#1a1a1a;border-radius:8px;padding:14px 18px;margin-bottom:28px;">'
    + '<p style="color:#666;font-size:11px;margin:0 0 6px;">Your access key (save for your records):</p>'
    + '<code style="font-size:14px;color:#888;letter-spacing:2px;">' + accessKey + '</code>'
    + '</div>'
    // Footer
    + '<p style="color:#555;font-size:12px;margin:28px 0 0;padding-top:20px;border-top:1px solid #222;">'
    + 'Questions? Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color:#a89878;text-decoration:none;">jordan@therowecollection.com</a>'
    + '</p>'
    + '</div>'
    + '</div>'
    + '</body></html>';
}

// v25.1: Check-in / feedback email template for existing clients
function generateCheckInEmail(accessKey) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:#0a0a0a;">'
    + '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e0e0e0;">'
    // Header
    + '<div style="background:linear-gradient(135deg,#1a1a1a 0%,#0a0a0a 100%);padding:48px 40px 32px;border-radius:12px 12px 0 0;text-align:center;">'
    + '<img src="https://roweos.com/logo.png" alt="RoweOS" style="width:80px;height:80px;border-radius:16px;margin-bottom:16px;">'
    + '<h1 style="color:#a89878;margin:0;font-size:28px;font-weight:300;letter-spacing:3px;">RoweOS</h1>'
    + '<p style="color:#666;margin:8px 0 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Operating intelligence, built for brands &amp; life</p>'
    + '</div>'
    // Content
    + '<div style="background:#111;padding:36px 40px 40px;">'
    + '<h2 style="color:#fff;font-size:22px;font-weight:500;margin:0 0 8px;">Hope you\'ve been enjoying RoweOS</h2>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.7;margin:0 0 24px;">I wanted to personally check in and see how things are going. Your experience and feedback are incredibly valuable as we continue building.</p>'
    // Feedback section
    + '<div style="background:#1a1a1a;border:1px solid #a8987844;border-radius:8px;padding:24px;margin-bottom:24px;">'
    + '<p style="color:#fff;font-size:15px;font-weight:500;margin:0 0 16px;">A few quick questions:</p>'
    + '<ul style="line-height:2;color:#ccc;margin:0;padding-left:20px;font-size:13px;">'
    + '<li>What features have you found most useful?</li>'
    + '<li>Is there anything that feels confusing or could be improved?</li>'
    + '<li>What would you love to see added next?</li>'
    + '</ul>'
    + '</div>'
    // How to share feedback
    + '<div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:24px;">'
    + '<p style="color:#fff;font-size:14px;font-weight:500;margin:0 0 12px;">How to share feedback</p>'
    + '<ol style="line-height:2;color:#ccc;margin:0;padding-left:20px;font-size:13px;">'
    + '<li><strong style="color:#fff;">Reply to this email</strong> with your thoughts</li>'
    + '<li>Use the <strong style="color:#fff;">Feedback</strong> button inside RoweOS (bottom-left)</li>'
    + '<li>Or just message me directly at <a href="mailto:jordan@therowecollection.com" style="color:#a89878;text-decoration:none;">jordan@therowecollection.com</a></li>'
    + '</ol>'
    + '</div>'
    // Tip
    + '<div style="background:rgba(168,152,120,0.08);border-left:3px solid #a89878;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">'
    + '<p style="color:#a89878;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;font-weight:600;">Quick Tip</p>'
    + '<p style="color:#ccc;font-size:13px;line-height:1.6;margin:0;">Try asking your BrandAI to create a content calendar, write a client proposal, or brainstorm new service offerings. The more context you give it in your Brand Identity, the better it gets.</p>'
    + '</div>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.7;margin:0;">Thanks for being an early adopter. Your input directly shapes what we build next.</p>'
    + '<p style="color:#ccc;font-size:14px;line-height:1.7;margin:16px 0 0;">Best,<br><strong style="color:#fff;">Jordan Rowe</strong><br><span style="color:#888;font-size:12px;">Creator, RoweOS</span></p>'
    // Footer
    + '<p style="color:#555;font-size:12px;margin:28px 0 0;padding-top:20px;border-top:1px solid #222;">'
    + 'Your access key: <code style="color:#a89878;letter-spacing:1px;">' + (accessKey || 'ROWE-XXXX-XXXX') + '</code>'
    + ' &middot; <a href="https://roweos.com" style="color:#a89878;text-decoration:none;">roweos.com</a>'
    + '</p>'
    + '</div>'
    + '</div>'
    + '</body></html>';
}

// v22.2: Open email composer modal
function openEmailComposer(accessKey, tier, recipientEmail) {
  if (!accessKey) { showToast('No access key provided', 'error'); return; }
  var tierLabel = (tier || 'solo').charAt(0).toUpperCase() + (tier || 'solo').slice(1);
  window._composerKey = accessKey;
  window._composerTier = tier || 'solo';
  // Fill fields
  var toEl = document.getElementById('composerTo');
  var subjectEl = document.getElementById('composerSubject');
  var fromEl = document.getElementById('composerFrom');
  if (toEl) toEl.value = recipientEmail || '';
  if (subjectEl) subjectEl.value = 'Welcome to RoweOS ' + tierLabel + ' - Your Access Key';
  // v22.33: Populate From dropdown dynamically
  if (fromEl && typeof buildFromOptionsHtml === 'function') {
    var _defFrom = (typeof getDefaultFromAddress === 'function' ? getDefaultFromAddress() : '');
    fromEl.innerHTML = buildFromOptionsHtml(_defFrom);
    fromEl.value = _defFrom;
  }
  // Render editable body in iframe with designMode
  var html = generateBetaWelcomeEmail(accessKey, tier);
  var preview = document.getElementById('betaEmailPreviewContent');
  if (preview) {
    preview.innerHTML = '<iframe id="betaEmailIframe" style="width:100%;min-height:300px;border:none;border-radius:8px;background:#0a0a0a;" frameborder="0"></iframe>';
    var iframe = document.getElementById('betaEmailIframe');
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    // v22.2: Force consistent font and light text on dark bg for all elements
    var style = doc.createElement('style');
    style.textContent = '* { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; } body { color: #ccc; background: #0a0a0a !important; } div, p, span, td, li, br, section, article { color: #ccc; } ol, ul { color: #ccc; } ol li::marker, ul li::marker { color: #ccc; } font[color="#000000"], font[color="black"] { color: #ccc !important; } [style*="color: rgb(0, 0, 0)"], [style*="color:rgb(0, 0, 0)"], [style*="color: black"] { color: #ccc !important; } code { color: #a89878 !important; font-family: "SF Mono", Monaco, "Courier New", monospace !important; } h1, h2, h3, strong { color: #fff !important; } a { color: #a89878 !important; }';
    doc.head.appendChild(style);
    doc.designMode = 'on';
    // v22.2: Continuously save selection so toolbar buttons can restore it
    doc.addEventListener('selectionchange', function() { composerSaveSelection(); });
    doc.addEventListener('mouseup', function() { composerSaveSelection(); });
    doc.addEventListener('keyup', function() { composerSaveSelection(); });
    // v22.2: Strip browser-injected black color on new lines
    doc.addEventListener('input', function() {
      try {
        var blacks = doc.querySelectorAll('font[color="#000000"], font[color="black"]');
        for (var i = 0; i < blacks.length; i++) { blacks[i].removeAttribute('color'); }
        var inlineBlacks = doc.querySelectorAll('[style*="color: rgb(0, 0, 0)"], [style*="color:rgb(0, 0, 0)"]');
        for (var j = 0; j < inlineBlacks.length; j++) { inlineBlacks[j].style.removeProperty('color'); }
      } catch(e) {}
    });
    setTimeout(function() {
      try { iframe.style.height = Math.min(Math.max(doc.body.scrollHeight + 20, 300), 900) + 'px'; } catch(e) { iframe.style.height = '500px'; }
    }, 150);
  }
  openModal('betaEmailPreviewModal');
}

// v22.2: Save iframe selection before toolbar steals focus
var _composerSavedRange = null;
function composerSaveSelection() {
  try {
    var iframe = document.getElementById('betaEmailIframe');
    if (!iframe) return;
    var win = iframe.contentWindow;
    var sel = win.getSelection();
    if (sel && sel.rangeCount > 0) {
      _composerSavedRange = sel.getRangeAt(0).cloneRange();
    }
  } catch(e) {}
}
function composerRestoreSelection() {
  try {
    var iframe = document.getElementById('betaEmailIframe');
    if (!iframe || !_composerSavedRange) return;
    var win = iframe.contentWindow;
    win.focus();
    var sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(_composerSavedRange);
  } catch(e) {}
}
// v22.2: Formatting toolbar commands for email composer
function composerExec(cmd) {
  var iframe = document.getElementById('betaEmailIframe');
  if (!iframe) return;
  composerRestoreSelection();
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.execCommand(cmd, false, null);
  composerSaveSelection();
}
function composerExecColor(color) {
  var iframe = document.getElementById('betaEmailIframe');
  if (!iframe) return;
  composerRestoreSelection();
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.execCommand('foreColor', false, color);
  composerSaveSelection();
}
function composerExecLink() {
  var iframe = document.getElementById('betaEmailIframe');
  if (!iframe) return;
  composerRestoreSelection();
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  var url = prompt('Enter URL:');
  if (url) doc.execCommand('createLink', false, url);
  composerSaveSelection();
}
function composerExecFontSize(size) {
  if (!size) return;
  var iframe = document.getElementById('betaEmailIframe');
  if (!iframe) return;
  composerRestoreSelection();
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.execCommand('fontSize', false, size);
  composerSaveSelection();
  var sel = document.getElementById('composerFontSize');
  if (sel) sel.selectedIndex = 0;
}

// v22.2: Show email preview for newly generated key
function showBetaEmailPreview() {
  var key = window._lastGeneratedKey;
  var tier = window._lastGeneratedTier || 'solo';
  if (!key) { showToast('Generate a key first', 'error'); return; }
  openEmailComposer(key, tier, '');
}

// v22.2: Open composer from key/user cards (replaces auto-send)
function adminSendWelcomeEmail(email, accessKey, tier) {
  if (!isAdmin()) { showToast('Admin access required', 'error'); return; }
  if (!accessKey) { showToast('Missing access key', 'error'); return; }
  openEmailComposer(accessKey, tier, email);
}

// v22.2: Get composed email HTML from editable iframe
function getComposerBodyHTML() {
  var iframe = document.getElementById('betaEmailIframe');
  if (!iframe) return '';
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#0a0a0a;">' + doc.body.innerHTML + '</body></html>';
}

// v22.2: Get plain text from composer body
function getComposerBodyText() {
  var iframe = document.getElementById('betaEmailIframe');
  if (!iframe) return '';
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  return (doc.body.innerText || doc.body.textContent || '').trim();
}

// v22.2: Send composed email via API
// v22.7: Toggle CC/BCC fields visibility
function toggleComposerCcBcc() {
  var fields = document.getElementById('composerCcBccFields');
  var toggle = document.getElementById('composerCcBccToggle');
  if (!fields) return;
  var show = fields.style.display === 'none';
  fields.style.display = show ? 'block' : 'none';
  if (toggle) toggle.innerHTML = show
    ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:2px;"><path d="M5 12h14"/></svg>CC / BCC'
    : '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:2px;"><path d="M12 5v14M5 12h14"/></svg>CC / BCC';
}

// v22.7: Parse comma-separated email list
function parseEmailList(str) {
  if (!str) return [];
  return str.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e.length > 0; });
}

function sendComposedEmail() {
  var to = (document.getElementById('composerTo').value || '').trim();
  var subject = (document.getElementById('composerSubject').value || '').trim();
  var from = (document.getElementById('composerFrom').value || '').trim();
  var cc = parseEmailList(document.getElementById('composerCc') ? document.getElementById('composerCc').value : '');
  var bcc = parseEmailList(document.getElementById('composerBcc') ? document.getElementById('composerBcc').value : '');
  if (!to) { showToast('Enter a recipient email', 'error'); return; }
  if (!subject) { showToast('Enter a subject', 'error'); return; }

  // v30.1: For interactive templates (onboarding_survey, checkin_new), use the API endpoint
  // which generates HMAC-signed response links. The compose preview is just a preview.
  var selectedTemplate = (document.getElementById('composerTemplate') || {}).value || '';
  var apiTemplates = { 'onboarding_survey': 'onboarding_survey', 'checkin_new': 'checkin', 'reengagement': 'reengagement', 'feature_announcement': 'feature_announcement', 'subscription_info': 'subscription_info' };
  if (apiTemplates[selectedTemplate] && isAdmin()) {
    if (!confirm('Send ' + selectedTemplate.replace(/_/g, ' ') + ' email to ' + to + '?')) return;
    var recipientName = window._composerRecipientName || '';
    showToast('Sending via template API...', 'info');
    fetch('/api/send-template-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: apiTemplates[selectedTemplate],
        userId: '',
        userEmail: to,
        userName: recipientName,
        callerUid: firebaseUser ? firebaseUser.uid : '',
        metadata: {}
      })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.success) {
        showToast('Email sent to ' + to, 'success');
        _logSentEmail(to, subject, selectedTemplate);
        closeModal('betaEmailPreviewModal');
        // v30.3: Refresh admin email tab if open so new log entry appears
        if (typeof adminLoadEmailData === 'function') {
          setTimeout(function() { adminLoadEmailData(); }, 1500);
        }
      } else {
        showToast('Failed: ' + (data.error || 'Unknown error'), 'error');
      }
    }).catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
    return;
  }

  var bodyHtml = getComposerBodyHTML();
  if (!bodyHtml) { showToast('Email body is empty', 'error'); return; }
  var confirmMsg = 'Send email to ' + to;
  if (cc.length) confirmMsg += '\nCC: ' + cc.join(', ');
  if (bcc.length) confirmMsg += '\nBCC: ' + bcc.join(', ');
  if (!confirm(confirmMsg + '?')) return;
  showToast('Sending...', 'info');
  var uid = firebaseUser ? firebaseUser.uid : '';

  // v25.1: Route Gmail/Outlook through their APIs (matches mailSendOutboxItem logic)
  var fromAddr = from;
  var useGmail = false;
  var useOutlook = false;
  var config = typeof getMailConfig === 'function' ? getMailConfig() : {};
  if (from.indexOf('gmail:') === 0) {
    fromAddr = from.substring(6);
    var gmailCreds = typeof getMailAccountCredentials === 'function' ? getMailAccountCredentials(fromAddr) : null;
    useGmail = gmailCreds && gmailCreds.provider === 'gmail' && gmailCreds.token;
    if (useGmail) config.gmailToken = gmailCreds.token;
  } else if (from.indexOf('outlook:') === 0) {
    fromAddr = from.substring(8);
    var outlookCreds = typeof getMailAccountCredentials === 'function' ? getMailAccountCredentials(fromAddr) : null;
    useOutlook = outlookCreds && outlookCreds.provider === 'outlook' && outlookCreds.token;
    if (useOutlook) config.outlookToken = outlookCreds.token;
  }

  // Get display name for sending account
  var sendDisplayName = '';
  var _allAccts = useGmail ? (typeof getMailGmailAccounts === 'function' ? getMailGmailAccounts() : []) : (useOutlook ? (typeof getMailOutlookAccounts === 'function' ? getMailOutlookAccounts() : []) : []);
  for (var _ai = 0; _ai < _allAccts.length; _ai++) {
    if (_allAccts[_ai].email === fromAddr && _allAccts[_ai].displayName) { sendDisplayName = _allAccts[_ai].displayName; break; }
  }

  var cleanCc = cc.filter(function(e) { return e && e.trim() && e.indexOf('@') !== -1; });
  var cleanBcc = bcc.filter(function(e) { return e && e.trim() && e.indexOf('@') !== -1; });

  if (useGmail) {
    fetch('/api/gmail-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        accessToken: config.gmailToken,
        uid: uid,
        to: to,
        from: fromAddr,
        fromName: sendDisplayName,
        subject: subject,
        html: bodyHtml,
        cc: cleanCc,
        bcc: cleanBcc,
        replyTo: config.replyTo || ''
      })
    }).then(function(r) {
      if (r.status === 401) {
        if (typeof mailRefreshGmailToken === 'function') {
          mailRefreshGmailToken(function(newToken) {
            if (newToken) {
              // v25.3: Retry send directly without re-showing confirm dialog
              config.gmailToken = newToken;
              fetch('/api/gmail-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send', accessToken: newToken, uid: uid, to: to, from: fromAddr, fromName: sendDisplayName, subject: subject, html: bodyHtml, cc: cleanCc, bcc: cleanBcc, replyTo: config.replyTo || '' })
              }).then(function(r2) { return r2.json(); }).then(function(d2) {
                if (d2 && d2.error) showToast('Gmail send failed: ' + d2.error, 'error');
                else showToast('Email sent to ' + to + ' via Gmail', 'success');
              }).catch(function(e2) { showToast('Gmail retry failed: ' + e2.message, 'error'); });
            } else {
              showToast('Gmail session expired. Please reconnect in Mail settings.', 'error');
            }
          });
        } else {
          showToast('Gmail session expired. Please reconnect.', 'error');
        }
        return null;
      }
      return r.json();
    }).then(function(data) {
      if (!data) return;
      if (data.error) { showToast('Gmail send failed: ' + data.error, 'error'); return; }
      showToast('Email sent to ' + to + ' via Gmail', 'success');
      _logSentEmail(to, subject, (document.getElementById('composerTemplate') || {}).value || 'custom');
    }).catch(function(err) {
      showToast('Gmail send failed: ' + err.message, 'error');
    });
  } else if (useOutlook) {
    var _doSend = function(token) {
      fetch('/api/gmail-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'outlook_send',
          accessToken: token,
          uid: uid,
          to: to,
          from: fromAddr,
          subject: subject,
          html: bodyHtml,
          cc: cleanCc,
          bcc: cleanBcc
        })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) { showToast('Outlook send failed: ' + data.error, 'error'); return; }
        showToast('Email sent to ' + to + ' via Outlook', 'success');
        _logSentEmail(to, subject, (document.getElementById('composerTemplate') || {}).value || 'custom');
      }).catch(function(err) {
        showToast('Outlook send failed: ' + err.message, 'error');
      });
    };
    if (config.outlookExpiresAt && Date.now() > (config.outlookExpiresAt - 300000) && typeof mailRefreshOutlookToken === 'function') {
      mailRefreshOutlookToken(function(newToken) {
        if (newToken) _doSend(newToken);
        else showToast('Outlook session expired. Please reconnect.', 'error');
      });
    } else {
      _doSend(config.outlookToken);
    }
  } else {
    // Send via Resend (for verified domain addresses)
    var payload = {
      email: to,
      subject: subject,
      from: fromAddr,
      html: bodyHtml,
      uid: uid,
      adminUid: uid
    };
    if (cleanCc.length) payload.cc = cleanCc;
    if (cleanBcc.length) payload.bcc = cleanBcc;
    fetch('/api/resend-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(resp) {
      return resp.json();
    }).then(function(data) {
      if (data.success) {
        showToast('Email sent to ' + to, 'success');
        _logSentEmail(to, subject, (document.getElementById('composerTemplate') || {}).value || 'custom');
      } else {
        showToast('Failed: ' + (data.error || 'Unknown error'), 'error');
      }
    }).catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
  }
}

// v30.1: Log sent email to Firestore email_log for admin Email Management tracking
function _logSentEmail(recipientEmail, subject, templateName) {
  try {
    if (!firebase) { console.warn('[email_log] No firebase'); return; }
    // v30.1: Fallback to direct UID check if isAdmin() fails (firebaseUser may not have resolved yet)
    var adminOk = false;
    if (typeof isAdmin === 'function' && isAdmin()) {
      adminOk = true;
    } else if (firebaseUser && firebaseUser.uid === 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93') {
      adminOk = true;
    }
    if (!adminOk) { console.warn('[email_log] Not admin, skipping'); return; }
    var db = firebase.firestore();
    console.log('[email_log] Writing:', recipientEmail, templateName);
    db.collection('email_log').add({
      userId: '',
      userEmail: recipientEmail || '',
      template: templateName || 'custom',
      subject: subject || '',
      sentAt: new Date().toISOString(),
      status: 'sent',
      error: '',
      sentBy: 'admin_composer'
    }).then(function(docRef) {
      console.log('[email_log] Written successfully:', docRef.id);
    }).catch(function(err) {
      console.error('[email_log] Firestore write FAILED:', err.message, err.code);
    });
  } catch (e) {
    console.error('[email_log] Exception:', e.message);
  }
}

// v22.4: Open in macOS Mail app via mailto: — fire <a>.click() synchronously for user gesture
function openComposerInMail() {
  // v25.3: Transfer Admin composer email into RoweOS Mail compose
  var to = (document.getElementById('composerTo').value || '').trim();
  var subject = (document.getElementById('composerSubject').value || '').trim();
  var from = (document.getElementById('composerFrom').value || '').trim();
  var bodyHtml = getComposerBodyHTML();
  var bodyText = getComposerBodyText();
  // Close admin modal
  closeModal('betaEmailPreviewModal');
  // Navigate to Mail > Compose
  showView('mail');
  setTimeout(function() {
    if (typeof switchMailTab === 'function') switchMailTab('compose');
    setTimeout(function() {
      var toEl = document.getElementById('mailComposeTo');
      var subEl = document.getElementById('mailComposeSubject');
      var fromEl = document.getElementById('mailComposeFrom');
      if (toEl) toEl.value = to;
      if (subEl) subEl.value = subject;
      if (fromEl && from) fromEl.value = from;
      // v25.3: Set body in the compose body (contenteditable div)
      var canvas = document.getElementById('mailComposeBody');
      if (canvas) {
        canvas.innerHTML = bodyText || bodyHtml;
        canvas.style.minHeight = '200px';
      }
      // Store the full HTML for send
      window._mailTransferredHtml = bodyHtml;
      showToast('Email imported to Mail compose', 'success');
    }, 200);
  }, 100);
}

// v22.7: Open email composer from Studio with branded template
function openStudioEmailComposer() {
  if (!window.currentRun || !window.currentRun.deliv) {
    showToast('Run a Studio operation first', 'error');
    return;
  }
  if (!firebaseUser) {
    showToast('Sign in to send emails', 'error');
    return;
  }
  var run = window.currentRun;
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : {};
  var brandName = brand.shortName || brand.name || 'Brand';
  var accentColor = brand.brandColor || '#a89878';
  var brandLogo = '';
  try { brandLogo = localStorage.getItem('roweos_brand_' + brandIdx + '_logo') || ''; } catch(e) {}
  var contentHtml = '';
  try { contentHtml = markdownToHtml(run.deliv); } catch(e) { contentHtml = '<p>' + escapeHtml(run.deliv) + '</p>'; }
  var opName = run.op || 'Studio Output';
  window._studioEmailContext = {
    contentHtml: contentHtml,
    opName: opName,
    brandName: brandName,
    accentColor: accentColor,
    brandLogo: brandLogo,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  };
  // Fill composer fields
  var toEl = document.getElementById('composerTo');
  var subjectEl = document.getElementById('composerSubject');
  var fromEl = document.getElementById('composerFrom');
  var templateEl = document.getElementById('composerTemplate');
  if (toEl) toEl.value = '';
  if (subjectEl) subjectEl.value = opName + ' - ' + brandName;
  // v22.33: Populate From dropdown dynamically
  if (fromEl && typeof buildFromOptionsHtml === 'function') {
    var _defFrom = (typeof getDefaultFromAddress === 'function' ? getDefaultFromAddress() : '');
    fromEl.innerHTML = buildFromOptionsHtml(_defFrom);
    fromEl.value = _defFrom;
  }
  if (templateEl) templateEl.value = 'brand-professional';
  loadComposerTemplate('brand-professional');
  openModal('betaEmailPreviewModal');
}

// v22.45: Generate branded email template with logo position support
function generateBrandedEmail(layout) {
  var ctx = window._studioEmailContext || {};
  var content = ctx.contentHtml || '<p>No content</p>';
  var brandName = ctx.brandName || 'Brand';
  var accent = ctx.accentColor || '#a89878';
  var logo = ctx.brandLogo || '';
  var date = ctx.date || '';
  // v28.4: Prefer base64 over Firebase Storage URLs (Storage URLs expire after ~1hr, causing "?" in email clients)
  // Base64 data URIs work reliably in Apple Mail, Gmail, and most modern email clients.
  if (logo && logo.indexOf('http') === 0 && window._mailLogoBase64) {
    // Replace expiring HTTP URL with permanent base64
    logo = window._mailLogoBase64;
  } else if (logo && logo.indexOf('data:') === 0) {
    // Already base64 — use as-is (no need to upload to Storage)
  }
  var logoPos = ctx.logoAlignment || ctx.logoPosition || 'center'; // v22.45/v23.11: left, center, right
  // v23.2: Logo size and font from context
  var logoSizePx = ctx.logoSize || 150;
  var maxH = Math.round(logoSizePx * 0.4);
  var fontFamily = ctx.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  // v22.45: Build logo HTML — position-aware with proper centering
  var logoHtml = '';
  var logoAlign = logoPos === 'left' ? 'left' : logoPos === 'right' ? 'right' : 'center';
  var logoMargin = logoPos === 'center' ? 'margin:0 auto;' : logoPos === 'right' ? 'margin:0 0 0 auto;' : '';
  // v28.4: Use base64 data URIs directly — they work in Apple Mail, Gmail, and most modern clients.
  // Firebase Storage URLs expire after ~1hr causing logos to show "?" placeholder.
  if (logo && (logo.indexOf('http') === 0 || logo.indexOf('data:') === 0)) {
    // v28.4: Accept both HTTP URLs and base64 data URIs — base64 never expires
    logoHtml = '<img src="' + logo + '" alt="' + escapeHtml(brandName) + '" width="' + logoSizePx + '" height="auto" style="display:block;' + logoMargin + 'max-width:' + logoSizePx + 'px;max-height:' + maxH + 'px;width:' + logoSizePx + 'px;border-radius:6px;object-fit:contain;">';
  }
  // v29.x: No logo = no logo section (no fallback initial/empty box)
  // v23.2: Store font family globally for template use
  window._mailEmailFont = fontFamily;
  if (layout === 'professional') return generateBrandedProfessional(content, brandName, accent, logoHtml, date, logoAlign);
  if (layout === 'minimal') return generateBrandedMinimal(content, brandName, accent, logoHtml, date, logoAlign);
  if (layout === 'bold') return generateBrandedBold(content, brandName, accent, logoHtml, date, logoAlign);
  if (layout === 'newsletter') return generateBrandedNewsletter(content, brandName, accent, logoHtml, date, logoAlign);
  return generateBrandedProfessional(content, brandName, accent, logoHtml, date, logoAlign);
}

// v22.45: Professional — white bg, accent border under header, logo position-aware
function generateBrandedProfessional(content, brandName, accent, logoHtml, date, logoAlign) {
  logoAlign = logoAlign || 'center';
  var headerHtml;
  var hasLogo = logoHtml && logoHtml.length > 0;
  if (!hasLogo) {
    // No logo — just brand name + date, centered
    headerHtml = '<div style="text-align:center;font-size:20px;font-weight:600;color:#1a1a1a;letter-spacing:0.5px;">' + escapeHtml(brandName) + '</div>'
      + (date ? '<div style="text-align:center;font-size:12px;color:#888;margin-top:2px;">' + date + '</div>' : '');
  } else if (logoAlign === 'center') {
    headerHtml = '<div style="text-align:center;margin-bottom:12px;">' + logoHtml + '</div>'
      + '<div style="text-align:center;font-size:20px;font-weight:600;color:#1a1a1a;letter-spacing:0.5px;">' + escapeHtml(brandName) + '</div>'
      + (date ? '<div style="text-align:center;font-size:12px;color:#888;margin-top:2px;">' + date + '</div>' : '');
  } else {
    headerHtml = '<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>'
      + (logoAlign === 'right' ? '<td style="vertical-align:middle;padding-right:16px;text-align:right;">'
        + '<div style="font-size:20px;font-weight:600;color:#1a1a1a;letter-spacing:0.5px;">' + escapeHtml(brandName) + '</div>'
        + (date ? '<div style="font-size:12px;color:#888;margin-top:2px;">' + date + '</div>' : '')
        + '</td><td style="vertical-align:middle;">' + logoHtml + '</td>'
        : '<td style="vertical-align:middle;">' + logoHtml + '</td>'
        + '<td style="vertical-align:middle;padding-left:16px;">'
        + '<div style="font-size:20px;font-weight:600;color:#1a1a1a;letter-spacing:0.5px;">' + escapeHtml(brandName) + '</div>'
        + (date ? '<div style="font-size:12px;color:#888;margin-top:2px;">' + date + '</div>' : '')
        + '</td>')
      + '</tr></table>';
  }
  // v23.2: Use font family from context
  var ff = (window._mailEmailFont || "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif").replace(/'/g, "\\'");
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:#f5f5f5;">'
    + '<div style="font-family:' + ff + ';max-width:600px;margin:0 auto;background:#ffffff;">'
    // Header
    + '<div style="padding:32px 40px 24px;border-bottom:3px solid ' + accent + ';">'
    + headerHtml
    + '</div>'
    // Body
    + '<div style="padding:32px 40px;color:#333;font-size:14px;line-height:1.7;">'
    + content
    + '</div>'
    // Footer
    + '<div style="padding:20px 40px;border-top:1px solid #eee;text-align:right;">'
    + '<p style="color:#bbb;font-size:10px;margin:0;font-style:italic;">Sent via RoweOS</p>'
    + '</div>'
    + '</div>'
    + '</body></html>';
}

// v22.45: Minimal — no bg box, uppercase brand name in accent, logo position-aware
function generateBrandedMinimal(content, brandName, accent, logoHtml, date, logoAlign) {
  logoAlign = logoAlign || 'center';
  var textAlign = logoAlign === 'right' ? 'text-align:right;' : logoAlign === 'center' ? 'text-align:center;' : '';
  var ff = (window._mailEmailFont || "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif").replace(/'/g, "\\'");
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:#ffffff;">'
    + '<div style="font-family:' + ff + ';max-width:600px;margin:0 auto;padding:48px 40px;">'
    // Header
    + '<div style="margin-bottom:40px;' + textAlign + '">'
    + (logoHtml ? '<div style="margin-bottom:12px;">' + logoHtml + '</div>' : '')
    + '<div style="font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:' + accent + ';margin-bottom:4px;">' + escapeHtml(brandName) + '</div>'
    + (date ? '<div style="font-size:11px;color:#aaa;">' + date + '</div>' : '')
    + '</div>'
    // Body
    + '<div style="color:#333;font-size:14px;line-height:1.8;">'
    + content
    + '</div>'
    // Footer
    + '<div style="margin-top:48px;padding-top:20px;border-top:1px solid #eee;">'
    + '<p style="color:#bbb;font-size:10px;margin:0;letter-spacing:1px;text-transform:uppercase;">' + escapeHtml(brandName) + '</p>'
    + '</div>'
    + '</div>'
    + '</body></html>';
}

// v22.45: Bold — dark bg (#0a0a0a), full-width accent header band, logo position-aware
function generateBrandedBold(content, brandName, accent, logoHtml, date, logoAlign) {
  logoAlign = logoAlign || 'center';
  var textAlign = logoAlign === 'right' ? 'text-align:right;' : logoAlign === 'center' ? 'text-align:center;' : 'text-align:left;';
  var ff = (window._mailEmailFont || "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif").replace(/'/g, "\\'");
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:#0a0a0a;">'
    + '<div style="font-family:' + ff + ';max-width:600px;margin:0 auto;background:#0a0a0a;">'
    // Header band
    + '<div style="background:' + accent + ';padding:32px 40px;' + textAlign + '">'
    + (logoHtml ? '<div style="margin-bottom:12px;">' + logoHtml.replace('border-radius:10px', 'border-radius:12px;border:2px solid rgba(255,255,255,0.3)') + '</div>' : '')
    + '<div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">' + escapeHtml(brandName) + '</div>'
    + (date ? '<div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:6px;">' + date + '</div>' : '')
    + '</div>'
    // Body
    + '<div style="padding:36px 40px;color:#ddd;font-size:14px;line-height:1.7;">'
    + content
    + '</div>'
    // Footer
    + '<div style="padding:20px 40px 32px;text-align:center;">'
    + '<div style="width:40px;height:2px;background:' + accent + ';margin:0 auto 12px;"></div>'
    + '<p style="color:#666;font-size:11px;margin:0;">' + escapeHtml(brandName) + '</p>'
    + '</div>'
    + '</div>'
    + '</body></html>';
}

// v22.45: Newsletter — dark gradient header, accent divider, white body, logo position-aware
function generateBrandedNewsletter(content, brandName, accent, logoHtml, date, logoAlign) {
  logoAlign = logoAlign || 'center';
  var textAlign = logoAlign === 'right' ? 'text-align:right;' : logoAlign === 'center' ? 'text-align:center;' : 'text-align:left;';
  var ff = (window._mailEmailFont || "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif").replace(/'/g, "\\'");
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:#f0f0f0;">'
    + '<div style="font-family:' + ff + ';max-width:600px;margin:0 auto;">'
    // Header
    + '<div style="background:linear-gradient(135deg,#1a1a1a 0%,#2a2a2a 100%);padding:36px 40px;' + textAlign + 'border-radius:8px 8px 0 0;">'
    + (logoHtml ? '<div style="margin-bottom:10px;">' + logoHtml + '</div>' : '')
    + '<div style="font-size:18px;font-weight:600;color:#fff;letter-spacing:0.5px;">' + escapeHtml(brandName) + '</div>'
    + (date ? '<div style="font-size:11px;color:#888;margin-top:6px;">' + date + '</div>' : '')
    + '</div>'
    // Accent divider
    + '<div style="height:3px;background:' + accent + ';"></div>'
    // Body
    + '<div style="background:#ffffff;padding:36px 40px;color:#333;font-size:14px;line-height:1.7;">'
    + content
    + '</div>'
    // Footer
    + '<div style="background:#fafafa;padding:24px 40px;text-align:center;border-top:1px solid #eee;border-radius:0 0 8px 8px;">'
    + '<p style="color:#999;font-size:11px;margin:0;">Designed &amp; Sent from RoweOS</p>'
    + '</div>'
    + '</div>'
    + '</body></html>';
}

// v20.11: Revoke key + release any pool keys assigned to that email
function adminRevokeKey(keyId) {
  if (!confirm('Revoke key ' + keyId + '?\n\nThis will also release any API pool keys assigned to this user.')) return;
  if (!isAdmin() || !firebase) return;
  // Get the key's email first so we can release pool keys
  firebase.firestore().collection('access_keys').doc(keyId).get().then(function(doc) {
    var email = doc.exists ? (doc.data().email || '') : '';
    return revokeAccessKey(keyId).then(function() {
      if (email) return adminReleasePoolKeysForEmail(email);
    });
  }).then(function() {
    showToast('Key revoked & pool keys released', 'success');
    adminLoadKeys();
    adminLoadApiKeyPool();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// v20.11: Delete access key + release pool keys
function adminDeleteKey(keyId) {
  if (!confirm('Permanently delete key ' + keyId + '?\n\nThis will also release any API pool keys assigned to this user.')) return;
  if (!isAdmin() || !firebase) return;
  // Get email before deleting
  firebase.firestore().collection('access_keys').doc(keyId).get().then(function(doc) {
    var email = doc.exists ? (doc.data().email || '') : '';
    return firebase.firestore().collection('access_keys').doc(keyId).delete().then(function() {
      if (email) return adminReleasePoolKeysForEmail(email);
    });
  }).then(function() {
    showToast('Key deleted & pool keys released', 'success');
    adminLoadKeys();
    adminLoadApiKeyPool();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// v20.11: Shared helper — release all pool keys assigned to an email
function adminReleasePoolKeysForEmail(email) {
  if (!email || !firebase) return Promise.resolve();
  return firebase.firestore().collection('api_key_pool').where('assignedToEmail', '==', email).get().then(function(snap) {
    if (snap.empty) return;
    var batch = firebase.firestore().batch();
    snap.docs.forEach(function(doc) {
      batch.update(doc.ref, { status: 'available', assignedToEmail: '', assignedAt: '', stripeSessionId: '' });
    });
    return batch.commit();
  });
}

// v21.0: Edit access key — inline form for tier, expiry, action (v22.2: renders in-place)
function adminEditKey(keyId) {
  if (!isAdmin() || !firebase) return;
  firebase.firestore().collection('access_keys').doc(keyId).get().then(function(doc) {
    if (!doc.exists) { showToast('Key not found', 'error'); return; }
    var d = doc.data();
    var card = document.getElementById('adminKeyCard_' + keyId);
    if (!card) { showToast('Card not found', 'error'); return; }
    var tierOptions = ['solo', 'founder', 'premium'];
    var actionOptions = [['expire', 'Auto-revoke'], ['downgrade', 'Downgrade to Solo'], ['flag', 'Flag for review']];
    var html = '<div style="font-weight:600;margin-bottom:10px;color:var(--text-primary);font-size:13px;">';
    html += '<span style="font-family:monospace;letter-spacing:0.5px;">' + escapeHtml(keyId) + '</span>';
    if (d.email) html += ' <span style="font-weight:400;font-size:12px;color:var(--text-secondary);">' + escapeHtml(d.email) + '</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">';
    html += '<div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Tier</label>';
    html += '<select id="adminEditTier" style="padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-xs);">';
    for (var i = 0; i < tierOptions.length; i++) {
      html += '<option value="' + tierOptions[i] + '"' + (d.tier === tierOptions[i] ? ' selected' : '') + '>' + tierOptions[i].charAt(0).toUpperCase() + tierOptions[i].slice(1) + '</option>';
    }
    html += '</select></div>';
    html += '<div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Expiry Date</label>';
    html += '<input type="date" id="adminEditExpiry" value="' + escapeHtml(d.expiresAt || '') + '" style="padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-xs);"></div>';
    html += '<div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Expiry Action</label>';
    html += '<select id="adminEditExpiryAction" style="padding:6px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-xs);">';
    for (var j = 0; j < actionOptions.length; j++) {
      html += '<option value="' + actionOptions[j][0] + '"' + ((d.expiryAction || 'expire') === actionOptions[j][0] ? ' selected' : '') + '>' + actionOptions[j][1] + '</option>';
    }
    html += '</select></div>';
    html += '</div>';
    html += '<div style="display:flex;gap:6px;justify-content:flex-end;">';
    html += '<button onclick="adminLoadKeys()" style="padding:5px 14px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-secondary);cursor:pointer;font-size:12px;">Cancel</button>';
    html += '<button onclick="adminUpdateKey(\'' + escapeHtml(keyId) + '\')" style="padding:5px 14px;background:var(--accent);color:#000;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px;">Save</button>';
    html += '</div>';
    card.style.border = '1px solid var(--accent)';
    card.innerHTML = html;
  });
}

function adminUpdateKey(keyString) {
  if (!isAdmin() || !firebase) return;
  var tier = document.getElementById('adminEditTier').value;
  var expiresAt = document.getElementById('adminEditExpiry').value || null;
  var expiryAction = document.getElementById('adminEditExpiryAction').value || 'expire';
  var updates = { tier: tier };
  if (expiresAt) {
    updates.expiresAt = expiresAt;
    updates.expiryAction = expiryAction;
  } else {
    updates.expiresAt = firebase.firestore.FieldValue.delete();
    updates.expiryAction = firebase.firestore.FieldValue.delete();
  }
  firebase.firestore().collection('access_keys').doc(keyString).update(updates).then(function() {
    showToast('Key updated', 'success');
    adminLoadKeys();
  }).catch(function(err) {
    showToast('Error updating key: ' + err.message, 'error');
  });
}

// v20.9: Redesigned admin key list — card layout for mobile
function adminLoadKeys() {
  if (!isAdmin() || !firebase) return;
  var listEl = document.getElementById('adminKeyList');
  if (!listEl) return;

  firebase.firestore().collection('access_keys').get().then(function(snap) {
    if (snap.empty) {
      listEl.innerHTML = '<div style="color:var(--text-muted);padding:8px 0;">No keys generated yet</div>';
      return;
    }
    // v22.2: Sort by order field, fallback to creation
    var keyDocs = [];
    snap.forEach(function(doc) { var dd = doc.data(); dd._id = doc.id; keyDocs.push(dd); });
    keyDocs.sort(function(a, b) { return (a.order || 9999) - (b.order || 9999); });

    var html = '<div id="adminKeysGrid" style="display:grid;gap:8px;">';
    for (var ki = 0; ki < keyDocs.length; ki++) {
      var d = keyDocs[ki];
      var statusColor = d.status === 'active' ? '#22c55e' : '#ef4444';
      var tierStr = (d.tier || 'basic').charAt(0).toUpperCase() + (d.tier || 'basic').slice(1);
      var tierColors = { solo: '#a89878', founder: '#c4a882', premium: '#d4af37', basic: '#888' };
      var tColor = tierColors[d.tier || 'basic'] || '#888';
      // v21.0: Check expiry status
      var isExpired = false;
      if (d.expiresAt) {
        var expDate = new Date(d.expiresAt);
        isExpired = new Date() > expDate;
      }
      html += '<div class="admin-drag-card" draggable="true" data-id="' + escapeHtml(d._id) + '" data-list="keys" id="adminKeyCard_' + escapeHtml(d._id) + '" style="padding:12px 14px;background:var(--bg-tertiary);border-radius:var(--radius-md);border:1px solid var(--border-color);cursor:grab;transition:opacity 0.15s,border-color 0.15s;">';
      // Row 1: Drag handle + Key + tier badge + expiry badge
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">';
      html += '<div style="display:flex;align-items:center;gap:8px;min-width:0;">';
      html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--text-tertiary)" stroke-width="2" style="flex-shrink:0;cursor:grab;"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
      html += '<span style="color:' + statusColor + ';font-size:8px;flex-shrink:0;">&#9679;</span>';
      html += '<span style="font-family:monospace;font-weight:600;font-size:13px;letter-spacing:0.5px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(d._id) + '</span>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">';
      if (isExpired) {
        html += '<span style="padding:2px 8px;background:rgba(251,146,60,0.15);border:1px solid rgba(251,146,60,0.3);border-radius:4px;font-size:10px;font-weight:600;color:#fb923c;text-transform:uppercase;letter-spacing:0.5px;">Expired</span>';
      } else if (d.expiresAt) {
        html += '<span style="padding:2px 6px;border-radius:4px;font-size:9px;color:var(--text-muted);" title="Expires ' + escapeHtml(d.expiresAt) + '">&#x23F3; ' + escapeHtml(d.expiresAt) + '</span>';
      }
      html += '<span style="padding:2px 8px;background:' + tColor + '18;border:1px solid ' + tColor + '33;border-radius:4px;font-size:10px;font-weight:600;color:' + tColor + ';text-transform:uppercase;letter-spacing:0.5px;">' + escapeHtml(tierStr) + '</span>';
      html += '</div>';
      html += '</div>';
      // Row 2: Email + note
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">';
      if (d.email) {
        html += '<span style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(d.email) + '</span>';
      } else {
        html += '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">Unused</span>';
      }
      if (d.note) html += '<span style="font-size:11px;color:var(--text-muted);">' + escapeHtml(d.note) + '</span>';
      html += '</div>';
      // Row 3: Actions (v21.0: added Edit button, v22.2: added Send Email)
      html += '<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">';
      html += '<button onclick="event.stopPropagation();adminSendWelcomeEmail(\'' + escapeHtml(d.email || '').replace(/'/g, "\\'") + '\', \'' + escapeHtml(d._id) + '\', \'' + escapeHtml(d.tier || 'solo') + '\')" style="padding:4px 12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:6px;color:#3b82f6;cursor:pointer;font-size:11px;font-weight:500;" title="Compose welcome email"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>Email</button>';
      html += '<button onclick="event.stopPropagation();adminEditKey(\'' + escapeHtml(d._id) + '\')" style="padding:4px 12px;background:rgba(168,152,120,0.1);border:1px solid rgba(168,152,120,0.3);border-radius:6px;color:#a89878;cursor:pointer;font-size:11px;font-weight:500;">Edit</button>';
      if (d.status === 'active') {
        html += '<button onclick="event.stopPropagation();adminRevokeKey(\'' + escapeHtml(d._id) + '\')" style="padding:4px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#ef4444;cursor:pointer;font-size:11px;font-weight:500;">Revoke</button>';
      }
      html += '<button onclick="event.stopPropagation();adminDeleteKey(\'' + escapeHtml(d._id) + '\')" style="padding:4px 10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-color);border-radius:6px;color:var(--text-muted);cursor:pointer;font-size:11px;" title="Delete permanently">&times;</button>';
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';
    listEl.innerHTML = html;
  }).catch(function(err) {
    listEl.innerHTML = '<div style="color:#ef4444;">Error loading keys: ' + escapeHtml(err.message) + '</div>';
  });
}

// v20.9: Redesigned admin user list — card layout with Remove button
function adminLoadUsers() {
  if (!isAdmin() || !firebase) return;
  var listEl = document.getElementById('adminUserList');
  if (!listEl) return;

  firebase.firestore().collection('roweos_users').get().then(function(snap) {
    if (snap.empty) {
      listEl.innerHTML = '<div style="color:var(--text-muted);padding:8px 0;">No registered users</div>';
      return;
    }
    var html = '<div style="display:grid;gap:8px;">';
    snap.forEach(function(doc) {
      var d = doc.data();
      var displayName = d.adminLabel || '';
      var safeDocId = escapeHtml(doc.id);
      var safeEmail = escapeHtml(d.email || doc.id);
      html += '<div style="padding:12px 14px;background:var(--bg-tertiary);border-radius:var(--radius-md);border:1px solid var(--border-color);">';
      // Row 1: Name (editable) + device + tier
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">';
      html += '<div id="adminUserName_' + safeDocId + '" style="min-width:0;flex:1;">';
      if (displayName) {
        html += '<span onclick="adminStartRename(\'' + safeDocId + '\')" style="font-size:14px;font-weight:600;color:var(--text-primary);cursor:pointer;" title="Click to rename">' + escapeHtml(displayName) + '</span>';
      } else {
        html += '<span onclick="adminStartRename(\'' + safeDocId + '\')" style="font-size:12px;color:var(--text-muted);cursor:pointer;font-style:italic;" title="Click to add a name">+ Add name</span>';
      }
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">';
      if (d.meta && d.meta.lastDevice) html += '<span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">' + escapeHtml(d.meta.lastDevice) + '</span>';
      if (d.tier) {
        var uTierColors = { solo: '#a89878', founder: '#c4a882', premium: '#d4af37', basic: '#888' };
        var uTColor = uTierColors[d.tier] || '#888';
        html += '<span style="padding:2px 8px;background:' + uTColor + '18;border:1px solid ' + uTColor + '33;border-radius:4px;font-size:10px;font-weight:600;color:' + uTColor + ';text-transform:uppercase;letter-spacing:0.5px;">' + escapeHtml(d.tier) + '</span>';
      }
      html += '</div>';
      html += '</div>';
      // Row 2: Email
      html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeEmail + '</div>';
      // Row 3: Access key
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">';
      if (d.accessKey) {
        html += '<span style="font-family:monospace;font-size:11px;color:var(--accent);letter-spacing:0.5px;">' + escapeHtml(d.accessKey) + '</span>';
      } else {
        html += '<span style="font-size:11px;color:var(--text-muted);font-style:italic;">No access key</span>';
      }
      html += '</div>';
      // Row 4: Actions (v22.2: added Send Email)
      html += '<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">';
      if (d.accessKey) {
        html += '<button onclick="adminSendWelcomeEmail(\'' + escapeHtml(d.email || '').replace(/'/g, "\\'") + '\', \'' + escapeHtml(d.accessKey) + '\', \'' + escapeHtml(d.tier || 'solo') + '\')" style="padding:4px 12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:6px;color:#3b82f6;cursor:pointer;font-size:11px;font-weight:500;" title="Compose welcome email"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>Email</button>';
      }
      html += '<button onclick="adminDeleteUserData(\'' + safeDocId + '\', \'' + safeEmail + '\')" style="padding:4px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#ef4444;cursor:pointer;font-size:11px;font-weight:500;">Delete All Data</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    listEl.innerHTML = html;
  }).catch(function(err) {
    listEl.innerHTML = '<div style="color:#ef4444;">Error loading users: ' + escapeHtml(err.message) + '</div>';
  });
}

// v20.9: Admin — delete ALL data for a user (Firestore subcollections + access key + registration)
async function adminDeleteUserData(uid, email) {
  if (!confirm('Delete ALL data for ' + email + '?\n\nThis will remove:\n- All synced data (brands, conversations, library, etc.)\n- Their access key\n- Their registration record\n\nFirebase Auth account must be deleted from Firebase Console separately.')) return;
  if (!isAdmin() || !firebase) return;

  try {
    showToast('Deleting data for ' + email + '...', 'info');

    // 1. Delete all Firestore user data (subcollections + root doc)
    await deleteUserFirestoreData(uid);

    // 2. Delete their access key(s)
    if (email) {
      try {
        var akSnap = await firebase.firestore().collection('access_keys').where('email', '==', email).get();
        if (!akSnap.empty) {
          var batch = firebase.firestore().batch();
          akSnap.docs.forEach(function(doc) { batch.delete(doc.ref); });
          await batch.commit();
        }
      } catch(akErr) { console.error('[Admin Delete] Access key cleanup error:', akErr.message); }
    }

    // 3. Release any API pool keys assigned to this email back to available
    if (email) {
      try {
        var poolSnap = await firebase.firestore().collection('api_key_pool').where('assignedToEmail', '==', email).get();
        if (!poolSnap.empty) {
          var poolBatch = firebase.firestore().batch();
          poolSnap.docs.forEach(function(doc) {
            poolBatch.update(doc.ref, { status: 'available', assignedToEmail: '', assignedAt: '', stripeSessionId: '' });
          });
          await poolBatch.commit();
        }
      } catch(poolErr) { console.error('[Admin Delete] Pool key release error:', poolErr.message); }
    }

    showToast('All data deleted for ' + email, 'success');
    adminLoadUsers();
    adminLoadKeys();
    adminLoadApiKeyPool();
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
    console.error('[Admin Delete] Error:', err);
  }
}

// v20.9: Admin — inline rename a registered user
function adminStartRename(docId) {
  var container = document.getElementById('adminUserName_' + docId);
  if (!container) return;
  // Get current name from the span text
  var currentSpan = container.querySelector('span');
  var currentName = (currentSpan && currentSpan.style.fontStyle !== 'italic') ? currentSpan.textContent : '';
  container.innerHTML = '<div style="display:flex;align-items:center;gap:4px;">' +
    '<input id="adminRenameInput_' + docId + '" type="text" value="' + escapeHtml(currentName) + '" placeholder="Name" ' +
    'style="flex:1;min-width:0;padding:4px 8px;font-size:13px;font-weight:600;background:var(--bg-primary);border:1px solid var(--accent);border-radius:6px;color:var(--text-primary);outline:none;" ' +
    'onkeydown="if(event.key===\'Enter\')adminSaveRename(\'' + docId + '\')">' +
    '<button onclick="adminSaveRename(\'' + docId + '\')" style="flex-shrink:0;padding:4px 10px;background:var(--accent);border:none;border-radius:6px;color:#0a0a0a;cursor:pointer;font-size:11px;font-weight:600;">Save</button>' +
    '<button onclick="adminLoadUsers()" style="flex-shrink:0;padding:4px 8px;background:none;border:1px solid var(--border-color);border-radius:6px;color:var(--text-muted);cursor:pointer;font-size:11px;">Cancel</button>' +
    '</div>';
  var input = document.getElementById('adminRenameInput_' + docId);
  if (input) { input.focus(); input.select(); }
}

function adminSaveRename(docId) {
  if (!isAdmin() || !firebase) return;
  var input = document.getElementById('adminRenameInput_' + docId);
  if (!input) return;
  var name = input.value.trim();
  firebase.firestore().collection('roweos_users').doc(docId).update({
    adminLabel: name
  }).then(function() {
    showToast(name ? 'Saved' : 'Name cleared', 'success');
    adminLoadUsers();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// v20.9: API KEY POOL MANAGEMENT & MARKETPLACE
// ═══════════════════════════════════════════════════════════════════════════════

// --- Admin: Add API key to pool ---
function adminAddToApiKeyPool() {
  if (!isAdmin() || !firebase) return;
  var provider = document.getElementById('poolKeyProvider').value;
  var apiKey = document.getElementById('poolKeyInput').value.trim();
  var tierSelect = document.getElementById('poolKeyCreditTier');
  var creditTier = tierSelect ? tierSelect.value : '5';
  var creditAmount = parseInt(creditTier) || 5;

  if (!apiKey) { showToast('Enter an API key', 'warning'); return; }
  if (apiKey.length < 10) { showToast('API key seems too short', 'warning'); return; }

  firebase.firestore().collection('api_key_pool').add({
    provider: provider,
    apiKey: apiKey,
    creditTier: creditTier,
    creditAmount: creditAmount,
    status: 'available',
    assignedToEmail: null,
    assignedAt: null,
    addedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    showToast(provider + ' key added to pool ($' + creditAmount + ' credit)', 'success');
    document.getElementById('poolKeyInput').value = '';
    adminLoadApiKeyPool();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// --- Admin: Load and render pool inventory ---
function adminLoadApiKeyPool() {
  if (!isAdmin() || !firebase) return;
  var listEl = document.getElementById('apiKeyPoolList');
  if (!listEl) return;

  // v22.7: Fetch all, sort client-side by order field (order may not exist on all docs)
  firebase.firestore().collection('api_key_pool').get()
    .then(function(snap) {
      if (snap.empty) {
        listEl.innerHTML = '<div style="color:var(--text-muted);padding:8px 0;font-size:var(--text-xs);">No keys in pool. Add API keys above to sell to customers.</div>';
        return;
      }

      var counts = { available: 0, assigned: 0, delivered: 0 };
      snap.forEach(function(doc) { var s = doc.data().status || 'unknown'; counts[s] = (counts[s] || 0) + 1; });

      var html = '<div style="display:flex;gap:12px;margin-bottom:10px;font-size:var(--text-xs);">';
      html += '<span style="color:#4ade80;">' + (counts.available || 0) + ' available</span>';
      html += '<span style="color:#fbbf24;">' + (counts.assigned || 0) + ' assigned</span>';
      html += '<span style="color:var(--text-muted);">' + (counts.delivered || 0) + ' delivered</span>';
      html += '</div>';

      // v20.9: Card layout for mobile
      html += '<div id="apiKeyPoolGrid" style="display:grid;gap:6px;">';
      // v22.2: Sort by order field, fallback to addedAt
      var poolDocs = [];
      snap.forEach(function(doc) { var dd = doc.data(); dd._id = doc.id; poolDocs.push(dd); });
      poolDocs.sort(function(a, b) { return (a.order || 9999) - (b.order || 9999); });

      for (var pi = 0; pi < poolDocs.length; pi++) {
        var d = poolDocs[pi];
        var maskedKey = d.apiKey ? (d.apiKey.substring(0, 8) + '...' + d.apiKey.substring(d.apiKey.length - 4)) : '?';
        var statusColors = { available: '#4ade80', assigned: '#fbbf24', delivered: '#888' };
        var statusColor = statusColors[d.status] || 'var(--text-muted)';
        var providerColors = { anthropic: '#d4a574', openai: '#10a37f', google: '#4285f4' };
        var pColor = providerColors[d.provider] || 'var(--text-secondary)';
        var providerLabel = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google' }[d.provider] || d.provider || '?';

        html += '<div class="admin-drag-card" draggable="true" data-id="' + escapeHtml(d._id) + '" data-list="pool" style="padding:10px 12px;background:var(--bg-tertiary);border-radius:var(--radius-md);border:1px solid var(--border-color);cursor:grab;transition:opacity 0.15s,border-color 0.15s;">';
        // Row 1: Drag handle + Provider + credit + status
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">';
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--text-tertiary)" stroke-width="2" style="flex-shrink:0;cursor:grab;"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
        html += '<span style="color:' + pColor + ';font-weight:600;font-size:12px;">' + escapeHtml(providerLabel) + '</span>';
        html += '<span style="color:var(--text-muted);font-size:11px;">$' + (d.creditTier || d.creditAmount || 0) + '</span>';
        html += '</div>';
        html += '<span style="color:' + statusColor + ';font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">' + escapeHtml(d.status || '?') + '</span>';
        html += '</div>';
        // Row 2: Masked key + email or delete
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">';
        html += '<span style="font-family:monospace;font-size:11px;color:var(--text-secondary);">' + escapeHtml(maskedKey) + '</span>';
        if (d.assignedToEmail) {
          html += '<span style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50%;" title="' + escapeHtml(d.assignedToEmail) + '">' + escapeHtml(d.assignedToEmail) + '</span>';
        }
        if (d.status === 'available') {
          html += '<button onclick="event.stopPropagation();adminRemovePoolKey(\'' + d._id + '\')" style="flex-shrink:0;padding:3px 10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#ef4444;cursor:pointer;font-size:11px;" title="Delete">&times;</button>';
        }
        // v20.11: Release button for assigned/delivered keys
        if (d.status === 'assigned' || d.status === 'delivered') {
          html += '<button onclick="event.stopPropagation();adminReleasePoolKey(\'' + d._id + '\')" style="flex-shrink:0;padding:3px 10px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:6px;color:#fbbf24;cursor:pointer;font-size:11px;" title="Release back to available">Release</button>';
        }
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
      listEl.innerHTML = html;
    }).catch(function(err) {
      listEl.innerHTML = '<div style="color:#ef4444;font-size:var(--text-xs);">Error: ' + escapeHtml(err.message) + '</div>';
    });
}

// --- Admin: Remove key from pool ---
function adminRemovePoolKey(docId) {
  if (!confirm('Delete this pool key? This cannot be undone.')) return;
  if (!isAdmin() || !firebase) return;
  firebase.firestore().collection('api_key_pool').doc(docId).delete().then(function() {
    showToast('Pool key removed', 'success');
    adminLoadApiKeyPool();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// v20.11: Release assigned/delivered pool key back to available
function adminReleasePoolKey(docId) {
  if (!confirm('Release this key back to the available pool?\n\nThe customer who had it will lose access.')) return;
  if (!isAdmin() || !firebase) return;
  firebase.firestore().collection('api_key_pool').doc(docId).update({
    status: 'available',
    assignedToEmail: '',
    assignedAt: '',
    stripeSessionId: ''
  }).then(function() {
    showToast('Key released back to pool', 'success');
    adminLoadApiKeyPool();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// v22.2: Admin drag-and-drop reorder for Keys and Pool lists
var _adminDragItem = null;
var _adminDragList = '';

function initAdminDragDrop() {
  document.addEventListener('dragstart', function(e) {
    var card = e.target.closest('.admin-drag-card');
    if (!card) return;
    _adminDragItem = card;
    _adminDragList = card.getAttribute('data-list');
    card.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
  });

  document.addEventListener('dragend', function(e) {
    var card = e.target.closest('.admin-drag-card');
    if (card) card.style.opacity = '1';
    // Remove all drag-over borders
    var overs = document.querySelectorAll('.admin-drag-over');
    for (var i = 0; i < overs.length; i++) {
      overs[i].classList.remove('admin-drag-over');
    }
    _adminDragItem = null;
    _adminDragList = '';
  });

  document.addEventListener('dragover', function(e) {
    var card = e.target.closest('.admin-drag-card');
    if (!card || !_adminDragItem || card === _adminDragItem) return;
    if (card.getAttribute('data-list') !== _adminDragList) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Visual indicator
    var overs = card.parentElement.querySelectorAll('.admin-drag-over');
    for (var i = 0; i < overs.length; i++) overs[i].classList.remove('admin-drag-over');
    card.classList.add('admin-drag-over');
  });

  document.addEventListener('dragleave', function(e) {
    var card = e.target.closest('.admin-drag-card');
    if (card) card.classList.remove('admin-drag-over');
  });

  document.addEventListener('drop', function(e) {
    var target = e.target.closest('.admin-drag-card');
    if (!target || !_adminDragItem || target === _adminDragItem) return;
    if (target.getAttribute('data-list') !== _adminDragList) return;
    e.preventDefault();
    target.classList.remove('admin-drag-over');
    // Reorder DOM
    var container = _adminDragItem.parentElement;
    var cards = Array.prototype.slice.call(container.children);
    var fromIdx = cards.indexOf(_adminDragItem);
    var toIdx = cards.indexOf(target);
    if (fromIdx < toIdx) {
      container.insertBefore(_adminDragItem, target.nextSibling);
    } else {
      container.insertBefore(_adminDragItem, target);
    }
    _adminDragItem.style.opacity = '1';
    // Save new order to Firestore
    adminSaveDragOrder(_adminDragList, container);
  });
}

function adminSaveDragOrder(listType, container) {
  if (!isAdmin() || !firebase) return;
  var collection = listType === 'pool' ? 'api_key_pool' : 'access_keys';
  var cards = container.querySelectorAll('.admin-drag-card[data-list="' + listType + '"]');
  if (!cards.length) return;
  // v22.7: Use individual writes instead of batch for reliability
  var promises = [];
  for (var i = 0; i < cards.length; i++) {
    var docId = cards[i].getAttribute('data-id');
    if (docId) {
      promises.push(
        firebase.firestore().collection(collection).doc(docId).update({ order: i })
      );
    }
  }
  Promise.all(promises).then(function() {
    showToast('Order saved', 'success');
  }).catch(function(err) {
    showToast('Failed to save order: ' + err.message, 'error');
  });
}

// Init on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminDragDrop);
  } else {
    initAdminDragDrop();
  }
}

// --- User: Purchase API key via Stripe checkout ---
function purchaseApiKey(provider, amount) {
  if (!firebaseUser) {
    showToast('Please sign in first', 'warning');
    return;
  }
  var email = firebaseUser.email || null;
  var tierAmount = parseInt(amount) || 5;
  showToast('Opening checkout for $' + tierAmount + '...', 'info');

  fetch('/api/create-api-key-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: provider, amount: tierAmount, email: email })
  })
  .then(function(resp) { return resp.json(); })
  .then(function(data) {
    if (data.url) {
      window.location.href = data.url;
    } else {
      showToast(data.error || 'Could not start checkout', 'error');
    }
  })
  .catch(function(err) {
    console.error('[API Key Purchase] Error:', err);
    showToast('Unable to start checkout. Please try again.', 'error');
  });
}

// --- User: Load marketplace availability ---
function loadApiKeyMarketplace(targetContainerId) {
  // v24.25: Support rendering into Account folder via targetContainerId
  var container, wrapper, emptyEl;
  if (targetContainerId) {
    container = document.getElementById(targetContainerId);
    wrapper = container;
    emptyEl = null;
  } else {
    container = document.getElementById('apiKeyMarketplaceCards');
    wrapper = document.getElementById('apiKeyMarketplaceSection');
    emptyEl = document.getElementById('apiKeyMarketplaceEmpty');
  }
  if (!container || !firebase || !firebaseUser) return;

  var providerLabels = { anthropic: 'Anthropic (Claude)', openai: 'OpenAI (ChatGPT)', google: 'Google (Gemini)' };
  var providerColors = { anthropic: '#d4a574', openai: '#10a37f', google: '#4285f4' };
  var tiers = [5, 10, 20];

  firebase.firestore().collection('api_key_pool')
    .where('status', '==', 'available')
    .get()
    .then(function(snap) {
      if (snap.empty) {
        wrapper.style.display = 'none';
        return;
      }

      // Count available per provider+tier
      var inventory = {};
      snap.forEach(function(doc) {
        var d = doc.data();
        var p = d.provider;
        var tier = d.creditTier || String(d.creditAmount || 5);
        var key = p + '_' + tier;
        inventory[key] = (inventory[key] || 0) + 1;
        if (!inventory[p]) inventory[p] = 0;
        inventory[p] += 1;
      });

      // Check if any provider has stock
      var hasAny = false;
      ['anthropic', 'openai', 'google'].forEach(function(p) { if (inventory[p]) hasAny = true; });
      if (!hasAny) {
        wrapper.style.display = 'none';
        return;
      }

      wrapper.style.display = 'block';
      var html = '';
      ['anthropic', 'openai', 'google'].forEach(function(p) {
        if (!inventory[p]) return;
        var label = providerLabels[p] || p;
        var color = providerColors[p] || 'var(--accent)';

        html += '<div style="flex:1;min-width:200px;padding:16px 14px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);text-align:center;">';
        html += '<div style="font-size:13px;font-weight:600;color:' + color + ';margin-bottom:10px;">' + escapeHtml(label) + '</div>';
        html += '<div style="display:flex;gap:6px;justify-content:center;">';

        tiers.forEach(function(tier) {
          var count = inventory[p + '_' + tier] || 0;
          var disabled = count === 0;
          var opacity = disabled ? '0.35' : '1';
          var cursor = disabled ? 'default' : 'pointer';
          var onclick = disabled ? '' : 'onclick="purchaseApiKey(\'' + p + '\',' + tier + ')"';
          var hoverOn = disabled ? '' : 'onmouseover="this.style.borderColor=\'' + color + '\';this.style.transform=\'translateY(-2px)\'"';
          var hoverOff = disabled ? '' : 'onmouseout="this.style.borderColor=\'' + color + '44\';this.style.transform=\'none\'"';

          html += '<div style="flex:1;padding:10px 6px;background:' + color + '11;border:1px solid ' + color + '44;border-radius:var(--radius-sm);cursor:' + cursor + ';opacity:' + opacity + ';transition:all 0.2s;" ' + onclick + ' ' + hoverOn + ' ' + hoverOff + '>';
          html += '<div style="font-size:16px;font-weight:700;color:' + color + ';">$' + tier + '</div>';
          html += '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">credit</div>';
          if (!disabled) {
            html += '<div style="font-size:9px;color:var(--text-tertiary);margin-top:4px;">' + count + ' in stock</div>';
          } else {
            html += '<div style="font-size:9px;color:var(--text-tertiary);margin-top:4px;">sold out</div>';
          }
          html += '</div>';
        });

        html += '</div></div>';
      });
      container.innerHTML = html;
      if (emptyEl) emptyEl.style.display = 'none';
    })
    .catch(function(err) {
      console.warn('[Marketplace] Error loading:', err.message);
    });
}

// v22.2: Load marketplace into onboarding step 4
function loadOnboardingMarketplace() {
  var container = document.getElementById('onboardingMarketplaceCards');
  var wrapper = document.getElementById('onboardingMarketplaceSection');
  if (!container || !wrapper || !firebase || !firebaseUser) return;

  var providerLabels = { anthropic: 'Anthropic (Claude)', openai: 'OpenAI (ChatGPT)', google: 'Google (Gemini)' };
  var providerColors = { anthropic: '#d4a574', openai: '#10a37f', google: '#4285f4' };
  var tiers = [5, 10, 20];

  firebase.firestore().collection('api_key_pool')
    .where('status', '==', 'available')
    .get()
    .then(function(snap) {
      if (snap.empty) {
        wrapper.style.display = 'none';
        return;
      }

      var inventory = {};
      snap.forEach(function(doc) {
        var d = doc.data();
        var p = d.provider;
        var tier = d.creditTier || String(d.creditAmount || 5);
        var key = p + '_' + tier;
        inventory[key] = (inventory[key] || 0) + 1;
        if (!inventory[p]) inventory[p] = 0;
        inventory[p] += 1;
      });

      var hasAny = false;
      ['anthropic', 'openai', 'google'].forEach(function(p) { if (inventory[p]) hasAny = true; });
      if (!hasAny) {
        wrapper.style.display = 'none';
        return;
      }

      wrapper.style.display = 'block';
      var html = '';
      ['anthropic', 'openai', 'google'].forEach(function(p) {
        if (!inventory[p]) return;
        var label = providerLabels[p] || p;
        var color = providerColors[p] || 'var(--accent)';

        html += '<div style="flex:1;min-width:160px;max-width:220px;padding:14px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);text-align:center;">';
        html += '<div style="font-size:12px;font-weight:600;color:' + color + ';margin-bottom:8px;">' + escapeHtml(label) + '</div>';
        html += '<div style="display:flex;gap:5px;justify-content:center;">';

        tiers.forEach(function(tier) {
          var count = inventory[p + '_' + tier] || 0;
          var disabled = count === 0;
          var opacity = disabled ? '0.35' : '1';
          var cursor = disabled ? 'default' : 'pointer';
          var onclick = disabled ? '' : 'onclick="purchaseApiKey(\'' + p + '\',' + tier + ')"';

          html += '<div style="flex:1;padding:8px 4px;background:' + color + '11;border:1px solid ' + color + '44;border-radius:var(--radius-sm);cursor:' + cursor + ';opacity:' + opacity + ';transition:all 0.2s;" ' + onclick + '>';
          html += '<div style="font-size:15px;font-weight:700;color:' + color + ';">$' + tier + '</div>';
          html += '<div style="font-size:9px;color:var(--text-muted);margin-top:2px;">credit</div>';
          html += '</div>';
        });

        html += '</div></div>';
      });
      container.innerHTML = html;
    })
    .catch(function(err) {
      console.warn('[Onboarding Marketplace] Error:', err.message);
    });
}

// --- User: Auto-deliver purchased API keys on login ---
function checkAndDeliverPurchasedApiKeys() {
  if (!firebaseUser || !firebaseUser.email || !firebase) return;

  firebase.firestore().collection('api_key_pool')
    .where('assignedToEmail', '==', firebaseUser.email)
    .where('status', '==', 'assigned')
    .get()
    .then(function(snap) {
      if (snap.empty) return;

      snap.forEach(function(doc) {
        var d = doc.data();
        var provider = d.provider;
        var apiKey = d.apiKey;

        // Map provider to localStorage key
        var keyMap = {
          anthropic: 'roweos_anthropic_key',
          openai: 'roweos_openai_key',
          google: 'roweos_google_key'
        };

        var storageKey = keyMap[provider];
        if (storageKey && apiKey) {
          try {
            // Only auto-fill if user doesn't already have a key for this provider
            var existingKey = localStorage.getItem(storageKey);
            if (existingKey && existingKey.length > 5) {
              // User already has a key — mark as delivered but don't overwrite
              doc.ref.update({
                status: 'delivered',
                deliveredAt: firebase.firestore.FieldValue.serverTimestamp(),
                deliveredToUid: firebaseUser.uid,
                note: 'User already had a key, not overwritten'
              });
              var providerLabel2 = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google' }[provider] || provider;
              showToast('You purchased a ' + providerLabel2 + ' key but already have one configured. Check your email for the key.', 'info', 8000);
              return;
            }

            localStorage.setItem(storageKey, apiKey);

            // Mark as delivered in Firestore
            doc.ref.update({
              status: 'delivered',
              deliveredAt: firebase.firestore.FieldValue.serverTimestamp(),
              deliveredToUid: firebaseUser.uid
            });

            var providerLabel = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google' }[provider] || provider;
            showToast(providerLabel + ' API key activated: $' + (d.creditAmount || 0) + ' credit ready to use', 'success', 6000);
          } catch(e) {
            console.warn('[API Delivery] Error storing key:', e.message);
          }
        }
      });
    })
    .catch(function(err) {
      console.warn('[API Delivery] Error checking purchased keys:', err.message);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// v15.0: FIRESTORE SUBCOLLECTION SYNC (replaces single-doc sync)
// ═══════════════════════════════════════════════════════════════════════════════

// v15.12: Clear all docs in a Firestore subcollection before re-writing
// Prevents orphaned docs when items are deleted locally
function clearFirestoreSubcollection(db, collectionPath) {
  return db.collection(collectionPath).get().then(function(snapshot) {
    if (snapshot.empty) return Promise.resolve();
    var batch = db.batch();
    snapshot.docs.forEach(function(doc) {
      batch.delete(doc.ref);
    });
    return batch.commit();
  });
}

// v29.1: Purge cloud todos — force-replaces Firestore with current local todos
// Use when deleted tasks have resurrected from cloud. Writes with set() (no merge)
// and removes orphaned individual docs from the todos subcollection.
function purgeCloudTodos() {
  if (!firebaseUser || !firebase) {
    showToast('Not connected to cloud', 'error');
    return;
  }
  var db = getDB();
  if (!db) { showToast('Database not available', 'error'); return; }

  var todosData = [];
  try { todosData = JSON.parse(localStorage.getItem(getTodosKey()) || '[]'); } catch(e) {}

  var basePath = 'roweos_users/' + firebaseUser.uid;

  // 1. Overwrite todos/main with current local array (no merge)
  db.doc(basePath + '/todos/main').set({ data: todosData }).then(function() {
    console.log('[purgeCloudTodos] Wrote', todosData.length, 'todos to cloud');

    // 2. Build set of current IDs
    var currentIds = {};
    for (var i = 0; i < todosData.length; i++) {
      if (todosData[i].id) currentIds[String(todosData[i].id)] = true;
    }

    // 3. Delete orphaned individual docs
    db.collection(basePath + '/todos').get().then(function(snap) {
      var deleted = 0;
      var batch = db.batch();
      snap.forEach(function(doc) {
        if (doc.id !== 'main' && !currentIds[doc.id]) {
          batch.delete(doc.ref);
          deleted++;
        }
      });
      if (deleted > 0) {
        batch.commit().then(function() {
          console.log('[purgeCloudTodos] Removed', deleted, 'orphaned cloud todo docs');
          showToast('Cloud tasks purged and synced (' + deleted + ' orphans removed)', 'success');
        }).catch(function(err) {
          console.warn('[purgeCloudTodos] Batch delete failed:', err.message);
          showToast('Cloud tasks synced but orphan cleanup failed', 'warning');
        });
      } else {
        showToast('Cloud tasks purged and synced', 'success');
      }
    }).catch(function(err) {
      console.warn('[purgeCloudTodos] Collection read failed:', err.message);
      showToast('Cloud tasks synced (could not check for orphans)', 'warning');
    });

    // 4. Also clean V4 if active
    if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
      try {
        for (var j = 0; j < todosData.length; j++) {
          var todo = todosData[j];
          if (todo.id) syncEngine.write('todos', String(todo.id), todo);
        }
      } catch(e) {}
    }
  }).catch(function(err) {
    console.error('[purgeCloudTodos] Write failed:', err.message);
    showToast('Failed to purge cloud tasks: ' + err.message, 'error');
  });
}

// v25.0: DEPRECATED -- replaced by write-through sync. Remove in v25.1
// syncToFirebaseV2 is now a no-op stub that just resolves. The full body is commented out below.
function syncToFirebaseV2() {
  if (typeof ROWEOS_DEBUG !== 'undefined' && ROWEOS_DEBUG) console.log('[Sync V3] syncToFirebaseV2 called (no-op)');
  return Promise.resolve();
}
/* --- BEGIN DEPRECATED syncToFirebaseV2 (v25.0) ---
function _syncToFirebaseV2_DEPRECATED() {
  if (!firebaseUser || !firebase) {
    showToast('Not connected to Firebase', 'error');
    return Promise.resolve();
  }
  if (isSyncing) {
    // v24.15: Queue sync instead of silently dropping it
    _syncQueued = true;
    console.log('[Firebase V2] Sync queued — already in progress');
    return Promise.resolve();
  }
  isSyncing = true;
  // v24.15: stampLocalSave() moved to .then() — stamping at start was blocking cross-device updates
  updateSyncIndicator('syncing');

  // v22.32: Removed autoTrimDataForSync — it was mutating localStorage permanently,
  // destroying conversation history. Sync functions (collectConversationsWithLimit etc.)
  // already trim their OWN copies for Firestore without touching local data.

  var uid = firebaseUser.uid;
  var db = firebase.firestore();
  var basePath = 'roweos_users/' + uid;

  // Collect all data
  var brandsArr = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brands) || '[]');
  var brandSettingsObj = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}');

  // Profile doc
  var profileData = {
    email: firebaseUser.email,
    accessKey: null, // populated from Firestore
    brandSettings: brandSettingsObj,
    settings: {
      theme: document.documentElement.classList.contains('light-mode') ? 'light' : 'dark',
      sidebarCollapsed: localStorage.getItem('roweos_sidebar_collapsed'),
      defaultView: localStorage.getItem('roweos_default_view'),
      webSearchPrefs: JSON.parse(localStorage.getItem('roweos_web_search_prefs') || '{}'),
      claudeWebSearch: localStorage.getItem('roweos_claude_web_search') === 'true',
      geminiWebSearch: localStorage.getItem('roweos_gemini_web_search') === 'true',
      autoPilot: localStorage.getItem('roweos_feature_autoPilot') === 'true',
      responseCache: localStorage.getItem('roweos_feature_responseCache') === 'true',
      crossModeEnabled: localStorage.getItem('roweos_cross_mode_enabled') !== 'false',
      primaryBrand: localStorage.getItem('roweos_primary_brand') || '0',
      calendarScope: localStorage.getItem('roweos_calendar_scope') || 'shared',
      bloomDefaultSource: localStorage.getItem('roweos_bloom_default_source') || 'match_brand',
      bloomContentMode: localStorage.getItem('roweos_bloom_content_mode') || 'text_only',
      bloomPostLength: localStorage.getItem('roweos_bloom_length') || 'short',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      sidebarOrder: localStorage.getItem('roweos_sidebar_order') || null,
      sidebarMode: localStorage.getItem('roweos_sidebar_mode') || 'expanded', // v30.1
      appZoom: localStorage.getItem('roweos_app_zoom') || '100',
      textSize: localStorage.getItem('roweos_text_size') || '100',
      apiRouting: JSON.parse(localStorage.getItem('roweos_api_routing') || '{}'),
      // v23.17: Sync help dismissals and mail tab preference
      helpDismissed: JSON.parse(localStorage.getItem('roweos_help_dismissed') || '{}'),
      mailCurrentTab: localStorage.getItem('roweos_mail_current_tab') || ''
    },
    // v16.15: Calendar integration credentials (synced across devices)
    // v23.2: gcalClientId removed — hardcoded in app
    // v30.1: icloudAppPassword excluded — device-local only, NEVER pushed to Firestore
    calendarIntegration: {
      icloudAppleId: localStorage.getItem('roweos_icloud_apple_id') || '',
      icloudCalHome: localStorage.getItem('roweos_icloud_cal_home') || '',
      icloudCalendars: localStorage.getItem('roweos_icloud_calendars') || ''
    },
    focus: {
      streak: parseInt(localStorage.getItem('roweosStreak') || '0'),
      todoFilterMode: localStorage.getItem('roweosTodoFilterMode') || 'all',
      taskViewMode: localStorage.getItem('roweos_task_view_mode') || 'category',
      lastStreakDate: localStorage.getItem('roweosLastStreakDate') || ''
    },
    guardrails: JSON.parse(localStorage.getItem('roweos_guardrails') || '{}'),
    focus2Layouts: {
      widgetOrder: JSON.parse(localStorage.getItem('roweos_focus2_widget_order') || '[]'),
      widgetSizes: JSON.parse(localStorage.getItem('roweos_focus2_widget_sizes') || '{}'),
      categoryOrder: JSON.parse(localStorage.getItem('roweos_focus2_category_order') || '[]'),
      unifiedOrder: JSON.parse(localStorage.getItem('roweos_focus2_unified_order') || '[]'),
      calendarOrientation: localStorage.getItem('roweos_focus2_calendar_orientation') || 'horizontal'
    },
    // v19.0: Social connections synced across devices (desktop OAuth → mobile)
    socialConnections: (function() {
      var sc = {};
      var sp = ['x', 'threads', 'instagram'];
      var scopes = [];
      for (var bi = 0; bi < brandsArr.length; bi++) scopes.push('_brand_' + bi);
      try {
        var lp = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]');
        for (var li = 0; li < lp.length; li++) scopes.push('_life_' + li);
      } catch(e) {}
      // v19.1: Only sync platforms that ARE connected — writing connected:false
      // from a device without the connection would overwrite another device's valid connection
      sp.forEach(function(p) {
        scopes.forEach(function(s) {
          var connKey = 'roweos_social_' + p + '_connected' + s;
          var isConn = localStorage.getItem(connKey) === 'true';
          if (isConn) {
            sc[p + s] = {
              connected: true,
              handle: localStorage.getItem('roweos_social_' + p + '_handle' + s) || '',
              token: localStorage.getItem('roweos_social_token_' + p + s) || ''
            };
          }
          // v19.1: Skip writing connected:false — disconnection is per-device
        });
      });
      return sc;
    })(),
    // v23.17: Sync todo categories and deletion tracking to prevent resurrection
    todoCategories: sp('roweos_todo_categories', []),
    deletedTodoCategories: sp('roweos_deleted_todo_categories', []),
    meta: {
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      lastDevice: getDeviceType(),
      lastDeviceId: deviceId,
      version: '15.3'
    }
  };

  // v15.12: Clear orphaned subcollection docs before writing new data
  // Without this, deleted items persist in Firestore and counts never decrease
  var clearPromises = [];
  clearPromises.push(clearFirestoreSubcollection(db, basePath + '/brands'));
  if (shouldSyncCategory('brand_todos')) clearPromises.push(clearFirestoreSubcollection(db, basePath + '/todos'));
  if (shouldSyncCategory('calendar')) clearPromises.push(clearFirestoreSubcollection(db, basePath + '/calendar'));
  if (shouldSyncCategory('runs')) clearPromises.push(clearFirestoreSubcollection(db, basePath + '/runs'));
  if (shouldSyncCategory('inventory')) clearPromises.push(clearFirestoreSubcollection(db, basePath + '/inventory'));
  clearPromises.push(clearFirestoreSubcollection(db, basePath + '/automations'));

  return Promise.all(clearPromises).then(function() {
    console.log('[Firebase V2] Subcollections cleared, writing fresh data...');

  var writes = [];
  var cleanupPromises = []; // v20.17: Async cleanup operations (delete orphaned cloud docs)

  // v24.4: Moved sp() before first use — minifier breaks function hoisting
  function sp(key, fallback) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
    catch (e) { console.warn('[Firebase V2] Corrupt data in ' + key, e.message); return fallback; }
  }

  // Profile doc
  writes.push(db.doc(basePath + '/profile/main').set(profileData, { merge: true }));

  // Brands subcollection — v15.27: Strip base64 data URLs to prevent Firestore/Storage format errors
  brandsArr.forEach(function(brand, idx) {
    var cleanBrand = JSON.parse(JSON.stringify(brand));
    // Recursively strip base64 data URLs from brand objects
    var brandStr = JSON.stringify(cleanBrand);
    if (brandStr.indexOf('data:') !== -1) {
      brandStr = brandStr.replace(/data:(image|application|audio|video)\/[^;]+;base64,[A-Za-z0-9+\/=]+/g, '[base64-stripped]');
      try { cleanBrand = JSON.parse(brandStr); } catch(pe) { /* use original * / }
    }
    writes.push(db.doc(basePath + '/brands/' + idx).set(cleanBrand));
  });

  // Conversations
  // v23.7: Guard against pushing empty data to cloud (prevents wiping other devices)
  if (shouldSyncCategory('brandai_chats')) {
    var convData = collectConversationsWithLimit();
    if (convData.current && convData.current.messages && convData.current.messages.length > 0) {
      writes.push(db.doc(basePath + '/conversations/current').set(convData.current));
    }
    if (convData.historyJson) {
      // Don't overwrite cloud history with empty array
      try {
        var histCheck = JSON.parse(convData.historyJson);
        if (Array.isArray(histCheck) && histCheck.length > 0) {
          writes.push(db.doc(basePath + '/conversations/history').set({ json: convData.historyJson }));
        } else {
          console.log('[Sync] Skipping empty conversation history push');
        }
      } catch(hce) {
        writes.push(db.doc(basePath + '/conversations/history').set({ json: convData.historyJson }));
      }
    }
    if (convData.agentHistoryJson) {
      try {
        var agentCheck = JSON.parse(convData.agentHistoryJson);
        if (Array.isArray(agentCheck) && agentCheck.length > 0) {
          writes.push(db.doc(basePath + '/conversations/agentHistory').set({ json: convData.agentHistoryJson }));
        } else {
          console.log('[Sync] Skipping empty agent history push');
        }
      } catch(ace) {
        writes.push(db.doc(basePath + '/conversations/agentHistory').set({ json: convData.agentHistoryJson }));
      }
    }
  }

  // Knowledge
  if (shouldSyncCategory('knowledge')) {
    var knowledge = collectKnowledge();
    Object.keys(knowledge).forEach(function(key) {
      writes.push(db.doc(basePath + '/knowledge/' + key).set({ data: knowledge[key] }));
    });
  }

  // v15.13: Runs (roweos_runs is object { runs:[], agentCommands:[], ... }, not flat array)
  if (shouldSyncCategory('runs')) {
    var runsData = sp('roweos_runs', {});
    var runsArr = Array.isArray(runsData) ? runsData : (runsData.runs || []);
    runsArr.forEach(function(run, idx) {
      writes.push(db.doc(basePath + '/runs/' + (run.id || idx)).set(run));
    });
  }

  // Calendar events
  if (shouldSyncCategory('calendar')) {
    var calendar = sp('roweos_calendar', []);
    calendar.forEach(function(evt, idx) {
      writes.push(db.doc(basePath + '/calendar/' + (evt.id || idx)).set(evt));
    });
  }

  // v20.17: Automations — sync with deletion support
  // v22.9: Sync deleted IDs to Firestore so cross-device deletes persist
  if (typeof _deletedAutomationIds !== 'undefined' && Object.keys(_deletedAutomationIds).length > 0) {
    writes.push(db.doc(basePath + '/profile/deletedAutomationIds').set({ data: _deletedAutomationIds }));
  }
  var automations = sp('roweos_automations', []);
  // Write current automations — v22.9: skip deleted IDs to prevent zombie re-upload
  var localAutoIds = {};
  automations.forEach(function(auto, idx) {
    var docId = String(auto.id || idx);
    if (typeof _deletedAutomationIds !== 'undefined' && _deletedAutomationIds[docId]) return;
    localAutoIds[docId] = true;
    writes.push(db.doc(basePath + '/automations/' + docId).set(auto));
  });
  // v21.13: Delete cloud automations that no longer exist locally OR are in deletion guard
  cleanupPromises.push(
    db.collection(basePath + '/automations').get().then(function(snap) {
      var delBatch = db.batch();
      var delCount = 0;
      snap.forEach(function(doc) {
        var isOrphan = !localAutoIds[doc.id];
        var isDeleted = typeof _deletedAutomationIds !== 'undefined' && _deletedAutomationIds[doc.id];
        if (isOrphan || isDeleted) {
          delBatch.delete(doc.ref);
          delCount++;
          console.log('[Sync] Deleting ' + (isDeleted ? 'deleted' : 'orphaned') + ' cloud automation:', doc.id);
        }
      });
      if (delCount > 0) return delBatch.commit();
    }).catch(function(e) { console.warn('[Sync] Automation cleanup error:', e.message); })
  );
  // v25.0: Sync Folio items + knowledge
  var folioItems = sp('roweos_folio_items', []);
  if (folioItems.length > 0) {
    writes.push(db.doc(basePath + '/folio/main').set({ data: folioItems }));
  }
  var folioKnowledge = sp('roweos_folio_knowledge', []);
  if (folioKnowledge.length > 0) {
    writes.push(db.doc(basePath + '/folio/knowledge').set({ data: folioKnowledge }));
  }
  // v16.11: Also sync customOps (fixed key: was roweos_customOps, now roweos_custom_operations)
  var customOps = sp('roweos_custom_operations', []);
  if (customOps.length > 0) {
    writes.push(db.doc(basePath + '/profile/customOps').set({ data: customOps }));
  }
  // v30.0: Always clear legacy profile/clients cloud doc — all data via profile/people
  writes.push(db.doc(basePath + '/profile/clients').set({ data: [], deletedIds: [] }));
  // v16.8: Sync AI-generated brand ops (were missing from V2 sync)
  // v24.12: Always write even when empty so deletions sync
  var genBrandOps = sp('roweos_generated_brand_ops', []);
  writes.push(db.doc(basePath + '/profile/generatedBrandOps').set({ data: genBrandOps }));
  // v16.8: Sync custom agents (Agents Lab)
  var customAgents = sp('roweos_custom_agents', []);
  if (customAgents.length > 0) {
    writes.push(db.doc(basePath + '/profile/customAgents').set({ data: customAgents }));
  }
  // v17.0: Sync social posts (last 50 only)
  var socialPosts = sp('roweos_social_posts', []);
  if (socialPosts.length > 0) {
    writes.push(db.doc(basePath + '/profile/socialPosts').set({ data: socialPosts.slice(0, 50) }));
  }
  // v17.0: Sync social workflows
  var socialWf = sp('roweos_social_workflows', []);
  if (socialWf.length > 0) {
    writes.push(db.doc(basePath + '/profile/socialWorkflows').set({ data: socialWf }));
  }
  // v22.25: Sync automation execution history (was missing — caused stale data on mobile)
  if (shouldSyncCategory('calendar')) {
    var autoLabHist = sp('roweos_auto_lab_history', []);
    if (autoLabHist.length > 0) {
      writes.push(db.doc(basePath + '/profile/autoLabHistory').set({ data: autoLabHist.slice(0, 50) }));
    }
    var compAutos = sp('roweos_completed_automations', []);
    if (compAutos.length > 0) {
      writes.push(db.doc(basePath + '/profile/completedAutomations').set({ data: compAutos.slice(0, 100) }));
    }
    var taskHistV2 = sp('roweos_task_history', []);
    if (taskHistV2.length > 0) {
      writes.push(db.doc(basePath + '/profile/taskHistory').set({ data: taskHistV2.slice(0, 50) }));
    }
  }

  // v22.16: Sync bloom content library metadata (strip base64 for Firestore)
  var bloomLib = getBloomLibrary();
  var bloomLibScopes = Object.keys(bloomLib);
  if (bloomLibScopes.length > 0) {
    var bloomLibMeta = {};
    for (var bls = 0; bls < bloomLibScopes.length; bls++) {
      var blScope = bloomLibScopes[bls];
      bloomLibMeta[blScope] = (bloomLib[blScope] || []).map(function(item) {
        return { id: item.id, mimeType: item.mimeType, agentType: item.agentType, active: item.active, name: item.name, addedAt: item.addedAt, thumbnailUrl: item.thumbnailUrl || '' };
      });
    }
    writes.push(db.doc(basePath + '/profile/bloomLibrary').set({ data: bloomLibMeta }));
  }

  // v22.17: Sync bloom knowledge repository
  var bloomKnow = getBloomKnowledge();
  if (Object.keys(bloomKnow).length > 0) {
    writes.push(db.doc(basePath + '/profile/bloomKnowledge').set({ data: bloomKnow }));
  }

  // v24.8: Sync user contact card and automation memory
  var _ucData = typeof getUserContact === 'function' ? getUserContact() : {};
  if (Object.keys(_ucData).length > 0) {
    writes.push(db.doc(basePath + '/profile/userContact').set({ data: _ucData }));
  }
  var _amData = typeof getAutomationMemory === 'function' ? getAutomationMemory() : [];
  var _amTracking = typeof getAutomationMemoryTracking === 'function' ? getAutomationMemoryTracking() : {};
  if (_amData.length > 0 || Object.keys(_amTracking).length > 0) {
    writes.push(db.doc(basePath + '/profile/automationMemory').set({ data: _amData, tracking: _amTracking }));
  }

  // v19.7: Sync notifications across devices (last 100)
  var notifData = sp('roweos_notifications', []);
  writes.push(db.doc(basePath + '/profile/notifications').set({
    items: notifData.slice(0, 100),
    lastSeen: localStorage.getItem('roweos_notifications_last_seen') || '0'
  }));

  // v22.23: Sync Mail outbox, sent, config
  var mailOutbox = sp('roweos_mail_outbox', []);
  var mailSent = sp('roweos_mail_sent', []).slice(0, 200);
  var mailDrafts = sp('roweos_mail_drafts', []);
  var mailConfig = sp('roweos_mail_config', {});
  var mailSignatures = sp('roweos_mail_signatures', []);
  var socialOutbox = sp('roweos_social_outbox', []); // v22.39
  var pendingApproval = sp('roweos_pending_approval', []); // v22.40
  var mailDeletedIds = sp('roweos_mail_deleted_ids', []); // v22.39: Tombstones
  var mailOutboxFolders = sp('roweos_mail_outbox_folders', []); // v22.44: Outbox folders
  var mailAddressBook = sp('roweos_mail_address_book', []); // v23.2
  // v23.17: Include mail logo and disconnected accounts in sync
  var _mailLogo = '';
  try { _mailLogo = localStorage.getItem('roweos_mail_logo') || ''; } catch(e) {}
  var _mailDcAccts = [];
  try { _mailDcAccts = JSON.parse(localStorage.getItem('roweos_mail_disconnected_accounts') || '[]'); } catch(e) {}
  var _mailDcProviders = [];
  try { _mailDcProviders = JSON.parse(localStorage.getItem('roweos_mail_disconnected') || '[]'); } catch(e) {}
  writes.push(db.doc(basePath + '/profile/mail').set({
    outbox: mailOutbox,
    sent: mailSent,
    drafts: mailDrafts,
    config: mailConfig,
    signatures: mailSignatures,
    socialOutbox: socialOutbox,
    pendingApproval: pendingApproval,
    deletedIds: mailDeletedIds,
    outboxFolders: mailOutboxFolders,
    addressBook: mailAddressBook,
    mailLogo: _mailLogo,
    fromAvatars: typeof getMailFromAvatars === 'function' ? getMailFromAvatars() : {},
    disconnectedAccounts: _mailDcAccts,
    disconnectedProviders: _mailDcProviders
  }));

  // Todos
  if (shouldSyncCategory('brand_todos')) {
    var todos = sp('roweosTodos', []);
    todos.forEach(function(todo, idx) {
      writes.push(db.doc(basePath + '/todos/' + (todo.id || idx)).set(todo));
    });
  }

  // Inventory (brand)
  if (shouldSyncCategory('inventory')) {
    var inventory = sp('roweos_inventory', {items:[], categories:[]});
    if (inventory.items) {
      inventory.items.forEach(function(item, idx) {
        var itemData = Object.assign({}, item);
        // Upload large images to Storage instead
        if (itemData.imageData && itemData.imageData.length > 10000 && firebase.storage) {
          var storagePath = 'users/' + uid + '/inventory/' + (item.id || idx) + '/image';
          uploadToStorage(storagePath, itemData.imageData, 'image/jpeg').then(function(url) {
            db.doc(basePath + '/inventory/' + (item.id || idx)).update({ imageUrl: url, imageData: null });
          }).catch(function() {});
          itemData.imageData = null; // Don't store in Firestore
        }
        writes.push(db.doc(basePath + '/inventory/' + (item.id || idx)).set(itemData));
      });
    }
  }

  // v15.16: Possessions (life inventory)
  if (shouldSyncCategory('possessions') || shouldSyncCategory('inventory')) {
    var lifeInv = sp('roweos_life_inventory', {items:[], categories:[]});
    if (lifeInv.items && lifeInv.items.length > 0) {
      var possItems = lifeInv.items.map(function(item) {
        var itemData = Object.assign({}, item);
        if (itemData.imageData && itemData.imageData.length > 10000) {
          itemData.imageData = null; // Strip large images for Firestore
        }
        return itemData;
      });
      writes.push(db.doc(basePath + '/lifeAI/possessions').set({ items: possItems, categories: lifeInv.categories || [] }));
    }
  }

  // v15.3: Library (sync to V2 subcollection)
  // v15.30: Per-profile life library sync — bundle all profile libraries
  if (shouldSyncCategory('library')) {
    var libraryData = localStorage.getItem('roweosLibrary') || '{}';
    // v24.9: Include library favorites in sync
    var _libFavs = sp('roweos_library_favorites', []);
    writes.push(db.doc(basePath + '/library/brand').set({ data: libraryData, favorites: _libFavs }));
    // v15.30: Sync per-profile life libraries
    var lifeLibProfiles = {};
    var lifeProfileCount = 0;
    try {
      var lps = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]');
      lifeProfileCount = lps.length || 1;
    } catch(e) { lifeProfileCount = 1; }
    for (var lpi = 0; lpi < Math.max(lifeProfileCount, 1); lpi++) {
      var lpKey = 'roweos_life_library_profile_' + lpi;
      var lpData = localStorage.getItem(lpKey);
      // v15.30: Migrate old shared key for profile 0
      if (!lpData && lpi === 0) lpData = localStorage.getItem('roweos_life_library');
      if (lpData) lifeLibProfiles['profile_' + lpi] = lpData;
    }
    writes.push(db.doc(basePath + '/library/life').set({ data: JSON.stringify(lifeLibProfiles) }));
  }

  // v29.3: Pulse — write goals to per-goal subcollection, non-goal data to pulse/main
  if (shouldSyncCategory('goals')) {
    var _pushGoals = sp('roweos_pulse_goals', []);
    _pushGoals.forEach(function(goal) {
      if (goal && goal.id) {
        writes.push(db.doc(basePath + '/pulse_goals/' + goal.id).set(goal, { merge: true }));
      }
    });
  }
  writes.push(db.doc(basePath + '/pulse/main').set({
    journal: sp('roweos_pulse_journal', []),
    insights: sp('roweos_pulse_insights', []),
    entries: sp('roweos_pulse2_entries', []),
    reminders: sp('roweos_reminders', [])
  }));

  // v15.12: Sync journal to profile doc too (Data Inventory reads it from here)
  writes.push(db.doc(basePath + '/profile/main').set({
    journal: sp('roweos_journal', [])
  }, { merge: true }));

  // LifeAI
  writes.push(db.doc(basePath + '/lifeAI/main').set({
    profiles: sp('roweos_life_profiles', []),
    currentProfileIdx: parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0'),
    currentProfile: sp('roweos_life_profile', null),
    userName: localStorage.getItem('roweos_user_name') || 'My Life',
    appMode: localStorage.getItem('roweos_app_mode') || 'brand',
    mainSystemPrompt: localStorage.getItem('roweos_life_main_prompt') || '',
    generatedOps: sp('roweos_generated_life_ops', []),
    goals: sp('roweos_life_goals', []),
    routines: sp('roweos_life_routines', []),
    habits: sp('roweos_life_habits', []),
    accentColor: localStorage.getItem('roweos_life_accent_color') || '#22c55e',
    accentDark: localStorage.getItem('roweos_life_accent_dark') || '#16a34a',
    // v15.13: Per-theme accent colors
    accentDarkMode: localStorage.getItem('roweos_life_accent_dark_mode') || '',
    accentDarkModeDark: localStorage.getItem('roweos_life_accent_dark_mode_dark') || '',
    accentLightMode: localStorage.getItem('roweos_life_accent_light_mode') || '',
    accentLightModeDark: localStorage.getItem('roweos_life_accent_light_mode_dark') || '',
    // v15.12: Include LifeAI chats and todos for cross-device sync
    agentCommands: shouldSyncCategory('lifeai_chats') ? sp('roweos_life_agentCommands', []) : [],
    todos: shouldSyncCategory('life_todos') ? sp('roweos_life_todos', []) : [],
    // v23.17: Sync LifeAI todo categories and deletion tracking
    todoCategories: sp('roweos_life_todo_categories', []),
    deletedTodoCategories: sp('roweos_deleted_life_todo_categories', []),
    // v15.25: Strip raw content from sync payload
    memory: (function() {
      var lm = sp('roweos_life_memory', {});
      if (lm.documents) {
        lm.documents = lm.documents.map(function(d) {
          var clean = {};
          Object.keys(d).forEach(function(k) { if (k !== 'content') clean[k] = d[k]; });
          return clean;
        });
      }
      return lm;
    })(),
    // v15.21: Sync Rhythm preferences and widget config
    rhythmPreferences: sp('roweos_life_rhythm_preferences', null),
    rhythmWidgetConfig: sp('roweos_rhythm_widget_config', null)
  }));

  // v25.1: Sync daily focus notes (roweos_focus_notes_*) across devices
  var focusNotesData = {};
  for (var fnI = 0; fnI < localStorage.length; fnI++) {
    var fnKey = localStorage.key(fnI);
    if (fnKey && fnKey.indexOf('roweos_focus_notes_') === 0) {
      var fnDateStr = fnKey.replace('roweos_focus_notes_', '');
      var fnVal = localStorage.getItem(fnKey);
      if (fnVal) focusNotesData[fnDateStr] = fnVal;
    }
  }
  if (Object.keys(focusNotesData).length > 0) {
    // Keep only the most recent 90 days of notes to stay within Firestore limits
    var fnKeys = Object.keys(focusNotesData).sort().reverse().slice(0, 90);
    var fnTrimmed = {};
    for (var fnJ = 0; fnJ < fnKeys.length; fnJ++) { fnTrimmed[fnKeys[fnJ]] = focusNotesData[fnKeys[fnJ]]; }
    writes.push(db.doc(basePath + '/profile/focusNotes').set({ data: fnTrimmed }));
  }

  // v16.5: Sync logos to cloud — one Firestore doc per logo (fixes 1MB doc limit overflow)
  if (shouldSyncCategory('logos')) {
    var MAX_LOGO_SYNC_SIZE = 900000; // 900KB max per logo
    var logoKeys = [];
    // v15.37: Collect per-profile LifeAI logos (no shared key)
    try {
      var lifeProfiles = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]');
      for (var lpi = 0; lpi < Math.max(lifeProfiles.length, 1); lpi++) {
        var lpKey = (lifeProfiles[lpi] && lifeProfiles[lpi].logoKey) || ('roweos_lifeai_logo_profile_' + lpi);
        logoKeys.push(lpKey);
      }
    } catch(e) { console.warn('[Firebase V2] Error collecting LifeAI logo keys:', e); }
    for (var li = 0; li < 10; li++) {
      logoKeys.push('roweos_brand_' + li + '_logo');
    }
    // Write each logo as its own Firestore document under logos/ subcollection
    var logoIndex = {};
    logoKeys.forEach(function(lk) {
      var logoData = localStorage.getItem(lk);
      if (logoData && logoData.length < MAX_LOGO_SYNC_SIZE) {
        var docId = lk.replace(/[\/\.]/g, '_'); // safe Firestore doc ID
        writes.push(db.doc(basePath + '/logos/' + docId).set({
          key: lk,
          base64: logoData,
          size: parseInt(localStorage.getItem(lk + '_size') || '100')
        }));
        logoIndex[docId] = lk;
      } else if (logoData) {
        console.warn('[Firebase V2] Logo ' + lk + ' too large (' + Math.round(logoData.length / 1024) + 'KB), skipping');
      }
    });
    // Write an index doc so pull knows which logo docs exist
    writes.push(db.doc(basePath + '/profile/logos').set({ _index: logoIndex, _version: 2 }));
  }

  // v15.16: Sync brand memory docs (metadata + insights only, strip raw content for Firestore 1MB limit)
  if (shouldSyncCategory('knowledge')) {
    try {
      var bmRaw = localStorage.getItem('roweos_brand_memory');
      if (bmRaw) {
        var bmData = JSON.parse(bmRaw);
        var bmSync = {};
        Object.keys(bmData).forEach(function(bKey) {
          var entry = bmData[bKey];
          if (entry && entry.documents) {
            bmSync[bKey] = {
              documents: entry.documents.map(function(d) {
                return { id: d.id, name: d.name, size: d.size, docType: d.docType, uploadedAt: d.uploadedAt, processed: d.processed, insights: d.insights || [], summary: d.summary || '' };
              })
            };
          }
        });
        writes.push(db.doc(basePath + '/knowledge/brandMemory').set({ data: JSON.stringify(bmSync) }));
      }
    } catch(e) { console.warn('[Firebase V2] brandMemory sync error:', e.message); }

    try {
      var lmRaw = localStorage.getItem('roweos_life_memory');
      if (lmRaw) {
        var lmData = JSON.parse(lmRaw);
        var lmSync = {};
        if (lmData.documents) {
          lmSync.documents = lmData.documents.map(function(d) {
            return { id: d.id, name: d.name, type: d.type, size: d.size, docType: d.docType, instructions: d.instructions || '', uploadedAt: d.uploadedAt, processed: d.processed, insights: d.insights || [], summary: d.summary || '' };
          });
        }
        writes.push(db.doc(basePath + '/knowledge/lifeMemory').set({ data: JSON.stringify(lmSync) }));
      }
    } catch(e) { console.warn('[Firebase V2] lifeMemory sync error:', e.message); }
  }

  // Also write v1 format for backwards compatibility during migration period
  // v15.27: Sanitize brands for legacy doc — strip base64 and undefined values
  var legacyBrands = brandsArr.map(function(b) {
    try {
      var s = JSON.stringify(b);
      if (s.indexOf('data:') !== -1) {
        s = s.replace(/data:(image|application|audio|video)\/[^;]+;base64,[A-Za-z0-9+\/=]+/g, '[base64-stripped]');
      }
      return JSON.parse(s);
    } catch(e) { return { name: b.name || 'Unknown', error: 'sanitize-failed' }; }
  });
  var legacySyncData = {
    brands: legacyBrands,
    brandSettings: brandSettingsObj,
    _migrated: true,
    _v2: true,
    meta: profileData.meta,
    // v23.9: Delete old logos field from root doc — V2 uses subcollection, root logos may be truncated
    logos: firebase.firestore.FieldValue.delete(),
    brandLogo: firebase.firestore.FieldValue.delete()
  };
  writes.push(db.doc(basePath).set(legacySyncData, { merge: true }));

  // v18.4: Sync analytics data to Firebase
  try {
    var analyticsRaw = localStorage.getItem('roweos_analytics');
    if (analyticsRaw) {
      var analyticsObj = JSON.parse(analyticsRaw);
      var entries = analyticsObj.entries || [];
      // Cap to last 90 days and max 500 entries for Firestore size limits
      var ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
      entries = entries.filter(function(e) { return e.timestamp > ninetyDaysAgo; });
      if (entries.length > 500) entries = entries.slice(entries.length - 500);
      writes.push(db.doc(basePath + '/analytics/main').set({ entries: entries, updatedAt: Date.now() }));
    }
  } catch(e) { console.warn('[Sync] Analytics sync error:', e); }

  // v20.2: Sync per-provider spending thresholds + v24.25: API budget
  var thresholds = {};
  ['claude', 'openai', 'gemini'].forEach(function(p) {
    var v = localStorage.getItem('roweos_analytics_threshold_' + p);
    if (v) thresholds[p] = v;
  });
  var _analyticsSettings = { thresholds: thresholds, updatedAt: Date.now() };
  // v24.25: Sync per-provider budgets
  var _provBudgets = {};
  ['claude', 'openai', 'gemini'].forEach(function(p) {
    var bRaw = localStorage.getItem('roweos_api_budget_' + p);
    if (bRaw) { try { _provBudgets[p] = JSON.parse(bRaw); } catch(e) {} }
  });
  _analyticsSettings.providerBudgets = _provBudgets;
  writes.push(db.doc(basePath + '/analytics/settings').set(_analyticsSettings));

  // v22.12: Sync Bloom signals to Firebase
  try {
    var bloomSignalsData = {};
    for (var bi = 0; bi < brands.length; bi++) {
      var bKey = (brands[bi].shortName || brands[bi].name).replace(/\s+/g, '_').toLowerCase();
      var bRaw = localStorage.getItem('roweos_bloom_signals_' + bKey);
      if (bRaw) bloomSignalsData[bKey] = JSON.parse(bRaw);
    }
    if (Object.keys(bloomSignalsData).length > 0) {
      writes.push(db.doc(basePath + '/profile/bloomSignals').set({ signals: bloomSignalsData, updatedAt: Date.now() }));
    }
  } catch(e) { console.warn('[Sync] Bloom signals sync error:', e); }

  // v20.17: Run writes + cleanup in parallel
  return Promise.all(writes.concat(cleanupPromises));

  }).then(function(results) {
    console.log('[Firebase V2] Sync complete -', results.length, 'operations');
    var lastSync = new Date().toLocaleString();
    var lastDevice = getDeviceType();
    updateLastSyncDisplay(lastSync, lastDevice);
    localStorage.setItem('roweos_last_sync', lastSync);
    localStorage.setItem('roweos_last_sync_device', lastDevice);
    // v15.4: Also update Sync Hub status display
    if (typeof updateSyncHubStatus === 'function') updateSyncHubStatus();
    // v15.20: Re-render sync inventory counts after successful sync
    if (typeof renderSyncInventory === 'function' && document.getElementById('syncDataInventory')) {
      setTimeout(function() { renderSyncInventory(); }, 1500);
    }
    updateSyncIndicator('connected');
    // v24.15: Stamp local save AFTER sync completes (was at start, blocking cross-device updates)
    stampLocalSave();
    syncRetryCount = 0; // v24.15: Reset retry count on success
  }).catch(function(error) {
    console.error('[Firebase V2] Sync error:', error);
    updateSyncIndicator('error');
    var msg = error.message || 'Unknown error';
    if (msg.indexOf('PERMISSION_DENIED') !== -1) {
      showToast('Sync permission denied. Try signing out and back in.', 'error');
    } else if (msg.indexOf('does not match format') !== -1 || msg.indexOf('invalid-format') !== -1) {
      // v15.27: Suppress storage format errors — non-critical, data still syncs via Firestore
      console.warn('[Firebase V2] Storage format error (non-critical):', msg);
    } else {
      showToast('Sync error: ' + msg.substring(0, 50), 'error');
      // v24.15: Retry once on non-permission errors
      if (syncRetryCount < 1) {
        syncRetryCount++;
        setTimeout(function() { scheduleAutoSync(); }, 5000);
      }
    }
  }).then(function() {
    isSyncing = false;
    // v24.15: Process queued sync
    if (_syncQueued) {
      _syncQueued = false;
      scheduleAutoSync();
    }
  });

  // v15.7: Safety timeout — reset isSyncing if stuck for > 30s
  setTimeout(function() {
    if (isSyncing) {
      console.warn('[Firebase V2] Sync timeout — resetting isSyncing flag');
      isSyncing = false;
      updateSyncIndicator('error');
    }
  }, 30000);
}
--- END DEPRECATED syncToFirebaseV2 (v25.0) --- */

// ─────────────────────────────────────────────────────────────────────
// v23.0: Conflict Resolution Helpers for loadFromFirebaseV2
// Newer data wins. Missing timestamps = keep local (safe default).
// ─────────────────────────────────────────────────────────────────────

function _mergeCloudBrands(cloudBrandsArr) {
  var localBrands = [];
  try { localBrands = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brands) || '[]'); } catch(e) {}
  if (!Array.isArray(localBrands)) localBrands = [];

  // Never reduce brand count below local
  var maxLen = Math.max(cloudBrandsArr.length, localBrands.length);
  var merged = [];
  for (var i = 0; i < maxLen; i++) {
    var cloud = cloudBrandsArr[i] || null;
    var local = localBrands[i] || null;
    if (!cloud && local) {
      merged.push(local); // local-only brand, keep it
      continue;
    }
    if (cloud && !local) {
      merged.push(cloud); // cloud-only brand, take it
      continue;
    }
    if (!cloud && !local) continue;
    // Both exist -- compare timestamps (v27.3: normalize for type safety)
    var cloudTs = _normalizeTs(cloud._modifiedAt);
    var localTs = _normalizeTs(local._modifiedAt);
    if (cloudTs === 0 && localTs === 0) {
      // No timestamps on either — keep local (safe default for v23.0 upgrade)
      merged.push(local);
      console.log('[Sync v23] Brand ' + i + ': no timestamps, keeping local');
    } else if (localTs > cloudTs) {
      merged.push(local);
      console.log('[Sync v23] Brand ' + i + ': local newer (' + localTs + ' > ' + cloudTs + '), keeping local');
    } else if (cloudTs > localTs) {
      // Cloud is newer — but preserve local _modifiedAt fields that might be on sub-objects
      cloud._modifiedAt = cloudTs;
      merged.push(cloud);
      console.log('[Sync v23] Brand ' + i + ': cloud newer (' + cloudTs + ' > ' + localTs + '), using cloud');
    } else {
      // Same timestamp — keep local
      merged.push(local);
    }
  }
  localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(merged));
  console.log('[Sync v23] Merged brands: ' + merged.length + ' (local had ' + localBrands.length + ', cloud had ' + cloudBrandsArr.length + ')');
}

function _mergeCloudBrandSettings(cloudSettings) {
  // v24.10: Hard block — if user just saved model config, never overwrite
  if (typeof _brandModelConfigSavedAt !== 'undefined' && _brandModelConfigSavedAt > 0 && (Date.now() - _brandModelConfigSavedAt) < _BRAND_MODEL_CONFIG_GRACE) {
    console.log('[Sync v24.10] BrandSettings: BLOCKED — user saved model config ' + (Date.now() - _brandModelConfigSavedAt) + 'ms ago');
    return;
  }
  var local = {};
  try { local = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}'); } catch(e) {}
  // v27.3: Normalize timestamps (handles ISO string from Firestore vs numeric from localStorage)
  var cloudTs = _normalizeTs(cloudSettings._modifiedAt);
  var localTs = _normalizeTs(local._modifiedAt);
  if (cloudTs === 0 && localTs > 0) {
    console.log('[Sync v23] BrandSettings: cloud has no timestamp, keeping local');
    return;
  }
  if (localTs > cloudTs) {
    console.log('[Sync v23] BrandSettings: local newer (' + localTs + ' > ' + cloudTs + '), keeping local');
    return;
  }
  // Cloud is newer or same -- use cloud
  cloudSettings._modifiedAt = cloudTs || Date.now();
  localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(cloudSettings));
  console.log('[Sync v23] BrandSettings: cloud newer (' + cloudTs + ' > ' + localTs + '), using cloud');
}

function _mergeCloudKnowledge(localKey, cloudData) {
  var localRaw = localStorage.getItem(localKey);
  if (!localRaw) {
    // No local data — take cloud
    localStorage.setItem(localKey, JSON.stringify(cloudData));
    return;
  }
  var local = {};
  try { local = JSON.parse(localRaw); } catch(e) {}
  // v27.3: Normalize timestamps
  var cloudTs = _normalizeTs(cloudData && cloudData._modifiedAt);
  var localTs = _normalizeTs(local && local._modifiedAt);
  if (cloudTs === 0 && localTs > 0) {
    console.log('[Sync v23] Knowledge ' + localKey + ': cloud has no timestamp, keeping local');
    return;
  }
  if (localTs > cloudTs) {
    console.log('[Sync v23] Knowledge ' + localKey + ': local newer, keeping local');
    return;
  }
  // Cloud is newer or equal — use cloud
  localStorage.setItem(localKey, JSON.stringify(cloudData));
  console.log('[Sync v23] Knowledge ' + localKey + ': cloud newer, using cloud');
}

// v23.7: Safe sync write — never overwrite non-empty local data with empty cloud data
function safeSyncWrite(key, cloudData) {
  if (cloudData === null || cloudData === undefined) return;

  // v27.0: For array data with id fields, merge instead of blind overwrite
  // This prevents cloud sync from erasing locally-created items not yet synced
  var cloudArr = null;
  try {
    cloudArr = typeof cloudData === 'string' ? JSON.parse(cloudData) : cloudData;
  } catch(e) {}

  if (Array.isArray(cloudArr) && cloudArr.length > 0 && cloudArr[0] && typeof cloudArr[0] === 'object') {
    // Detect id field: try 'id', '_id', 'key'
    var idField = cloudArr[0].id ? 'id' : (cloudArr[0]._id ? '_id' : (cloudArr[0].key ? 'key' : null));
    if (idField && typeof mergeByTimestamp === 'function') {
      var localArr = [];
      try { localArr = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
      if (Array.isArray(localArr)) {
        // Backfill _modifiedAt on items that lack it
        var now = Date.now();
        for (var _mi = 0; _mi < localArr.length; _mi++) {
          if (!localArr[_mi]._modifiedAt) localArr[_mi]._modifiedAt = localArr[_mi].createdAt || localArr[_mi].updatedAt || now;
          // v30.1: Skip items missing id instead of assigning synthetic IDs that corrupt merges
          if (!localArr[_mi][idField]) { console.warn('[safeSyncWrite] item missing id in', key, '- skipping merge for this item'); continue; }
        }
        for (var _ci = 0; _ci < cloudArr.length; _ci++) {
          if (!cloudArr[_ci]._modifiedAt) cloudArr[_ci]._modifiedAt = cloudArr[_ci].createdAt || cloudArr[_ci].updatedAt || 0;
          // v30.1: Skip items missing id instead of assigning synthetic IDs that corrupt merges
          if (!cloudArr[_ci][idField]) { console.warn('[safeSyncWrite] cloud item missing id in', key, '- skipping merge for this item'); continue; }
        }
        var merged = mergeByTimestamp(localArr, cloudArr, idField);
        localStorage.setItem(key, JSON.stringify(merged));
        return;
      }
    }
  }

  // Fallback for non-array or non-mergeable data: direct write (settings, strings, etc.)
  var cloudStr = typeof cloudData === 'string' ? cloudData : JSON.stringify(cloudData);
  localStorage.setItem(key, cloudStr);
}

function loadFromFirebaseV2(showNotification, skipModeSync) {
  if (!firebaseUser || !firebase) return Promise.resolve();

  // v25.2: Safety snapshot before cloud pull -- protection against Firestore outage
  try {
    var _prePullBackup = {};
    var _backupKeys = ['roweos_pulse_goals', 'roweos_automations', 'roweosTodos', 'roweos_calendar',
      'roweos_clients', 'roweos_people', 'roweos_scheduled_tasks', 'roweos_folio_items',
      'roweos_agentCommands', 'roweos_life_agentCommands', 'roweos_runs', 'roweos_journal'];
    if (typeof USER_DATA_KEYS !== 'undefined' && USER_DATA_KEYS.brands) _backupKeys.push(USER_DATA_KEYS.brands);
    _backupKeys.forEach(function(k) {
      var v = localStorage.getItem(k);
      if (v) _prePullBackup[k] = v;
    });
    localStorage.setItem('roweos_pre_pull_backup', JSON.stringify(_prePullBackup));
    localStorage.setItem('roweos_pre_pull_backup_time', String(Date.now()));
  } catch(_bErr) { console.warn('[Sync V3.1] Pre-pull backup failed:', _bErr.message); }

  // v24.20: Local helper for safe localStorage reads (mirrors syncToFirebaseV2's sp)
  function sp(key, fallback) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
    catch (e) { console.warn('[Firebase V2] Corrupt data in ' + key, e.message); return fallback; }
  }

  // v23.0: Take snapshot before pulling from cloud (fire-and-forget)
  takePreSyncSnapshot('Before cloud pull ' + new Date().toLocaleTimeString());

  var uid = firebaseUser.uid;
  var db = firebase.firestore();
  // v28.4: Always read from old path (reliable). V4 dual-write is secondary and incomplete.
  // writeDB always writes to roweos_users/{uid}, so this path always has the latest data.
  var basePath = 'roweos_users/' + uid;
  updateSyncIndicator('syncing');

  return Promise.all([
    db.doc(basePath + '/profile/main').get(),
    db.collection(basePath + '/brands').get(),
    db.doc(basePath + '/conversations/current').get(),
    db.doc(basePath + '/conversations/history').get(),
    db.doc(basePath + '/conversations/agentHistory').get(),
    db.collection(basePath + '/knowledge').get(),
    db.doc(basePath + '/lifeAI/main').get(),
    db.collection(basePath + '/pulse_goals').get(), // v29.3: Per-goal collection
    db.collection(basePath + '/todos').get(),
    db.collection(basePath + '/calendar').get(),
    db.collection(basePath + '/runs').get(),
    db.collection(basePath + '/inventory').get(),
    db.doc(basePath + '/library/brand').get(),
    db.doc(basePath + '/library/life').get(),
    db.doc(basePath + '/profile/logos').get(),
    db.doc(basePath + '/lifeAI/possessions').get(),
    db.collection(basePath + '/logos').get(),
    db.doc(basePath + '/profile/generatedBrandOps').get(),
    db.doc(basePath + '/profile/customAgents').get(),
    db.doc(basePath + '/profile/customOps').get(),
    db.doc(basePath + '/profile/clients').get(),
    db.doc(basePath + '/profile/socialPosts').get(),
    db.doc(basePath + '/profile/socialWorkflows').get(),
    db.doc(basePath + '/profile/notifications').get(),
    db.doc(basePath + '/profile/bloomLibrary').get(),
    db.doc(basePath + '/profile/bloomKnowledge').get(),
    db.doc(basePath + '/profile/mail').get(),
    db.doc(basePath + '/profile/autoLabHistory').get(),
    db.doc(basePath + '/profile/completedAutomations').get(),
    db.doc(basePath + '/profile/taskHistory').get(),
    db.doc(basePath + '/profile/userContact').get(),
    db.doc(basePath + '/profile/automationMemory').get(),
    db.doc(basePath + '/profile/focusNotes').get(),
    db.doc(basePath + '/folio/main').get(),
    db.doc(basePath + '/profile/people').get(),
    db.doc(basePath + '/profile/inventory').get(),
    db.doc(basePath + '/profile/researchHistory').get(),
    db.doc(basePath + '/profile/deletedAutomationIds').get(), // v28.6: Load deletion tombstones
    db.doc(basePath + '/scribe/notebooks').get(), // v29.2: Scribe notebooks
    db.doc(basePath + '/pulse/main').get(), // v29.3: Legacy pulse/main for non-goal data + migration fallback
    db.collection(basePath + '/chats').get() // v30.3: Per-doc chat subcollection
  ]).then(function(results) {
    var profileDoc = results[0];
    var brandsSnap = results[1];
    var convCurrentDoc = results[2];
    var convHistoryDoc = results[3];
    var convAgentDoc = results[4];
    var knowledgeSnap = results[5];
    var lifeDoc = results[6];
    var pulseGoalsSnap = results[7]; // v29.3: Per-goal collection snapshot
    var todosSnap = results[8];
    var calendarSnap = results[9];
    var runsSnap = results[10];
    var inventorySnap = results[11];
    var libraryBrandDoc = results[12];
    var libraryLifeDoc = results[13];
    var logosDoc = results[14];
    var possessionsDoc = results[15];
    var logosSnap = results[16];
    var genBrandOpsDoc = results[17];
    var customAgentsDoc = results[18];
    var customOpsDoc = results[19];
    var clientsDoc = results[20]; // v16.11
    var socialPostsDoc = results[21]; // v17.0
    var socialWorkflowsDoc = results[22]; // v17.0
    var notificationsDoc = results[23]; // v19.7
    var bloomLibraryDoc = results[24]; // v22.16
    var bloomKnowledgeDoc = results[25]; // v22.17
    var mailDoc = results[26]; // v22.23
    var autoLabHistDoc = results[27]; // v22.25
    var compAutosDoc = results[28]; // v22.25
    var taskHistDoc = results[29]; // v22.25
    var userContactDoc = results[30]; // v24.8
    var automationMemoryDoc = results[31]; // v24.8
    var focusNotesDoc = results[32]; // v25.1
    var folioDoc = results[33]; // v25.0
    var peopleDoc = results[34]; // v25.3
    var inventoryV3Doc = results[35]; // v25.3
    var researchHistDoc = results[36]; // v27.0
    var deletedAutoIdsDoc = results[37]; // v28.6
    var scribeDoc = results[38]; // v29.2
    var pulseMainDoc = results[39]; // v29.3: Legacy pulse/main for non-goal data
    var chatsSubSnap = results[40]; // v30.3: Per-doc chat subcollection

    // Profile
    var cloudLastDevice = null;
    if (profileDoc.exists) {
      var profile = profileDoc.data();
      if (profile.brandSettings) {
        // v23.0: Timestamp-based conflict resolution for brandSettings
        _mergeCloudBrandSettings(profile.brandSettings);
      }
      // v28.3: Cloud theme only applies on first load (no local preference yet)
      // Theme is device-local — user's toggle is always authoritative
      if (profile.settings && profile.settings.theme) {
        // v30.1: Check both hyphen and underscore variants of theme key
        var _hasLocalTheme = localStorage.getItem('roweos-theme') || localStorage.getItem('roweos_theme');
        if (!_hasLocalTheme) {
          localStorage.setItem('roweos_theme', profile.settings.theme);
          localStorage.setItem('roweos-theme', profile.settings.theme);
          if (profile.settings.theme === 'light') {
            document.documentElement.classList.add('light-mode');
          } else {
            document.documentElement.classList.remove('light-mode');
          }
        }
      }
      // v18.3 / v29.0: Restore primary brand setting (index + stable ID)
      if (profile.settings && profile.settings.primaryBrand != null) {
        localStorage.setItem('roweos_primary_brand', String(profile.settings.primaryBrand));
      }
      if (profile.settings && profile.settings.primaryBrandId) {
        localStorage.setItem('roweos_primary_brand_id', profile.settings.primaryBrandId);
      }
      // v29.0: Restore selected brand from cloud (cross-device)
      if (profile.settings && profile.settings.selectedBrandId) {
        localStorage.setItem('roweos_selected_brand_id', profile.settings.selectedBrandId);
      }
      // v18.4: Restore calendar scope setting
      if (profile.settings && profile.settings.calendarScope) {
        localStorage.setItem('roweos_calendar_scope', profile.settings.calendarScope);
      }
      // v22.20: Restore Bloom default feed source
      if (profile.settings && profile.settings.bloomDefaultSource) {
        localStorage.setItem('roweos_bloom_default_source', profile.settings.bloomDefaultSource);
      }
      // v22.22: Restore Bloom content mode and post length
      if (profile.settings && profile.settings.bloomContentMode) {
        localStorage.setItem('roweos_bloom_content_mode', profile.settings.bloomContentMode);
        _bloomContentMode = profile.settings.bloomContentMode;
      }
      if (profile.settings && profile.settings.bloomPostLength) {
        localStorage.setItem('roweos_bloom_length', profile.settings.bloomPostLength);
        _bloomPostLength = profile.settings.bloomPostLength;
      }
      // v22.45: Restore API routing preferences
      if (profile.settings && profile.settings.apiRouting && typeof profile.settings.apiRouting === 'object') {
        localStorage.setItem('roweos_api_routing', JSON.stringify(profile.settings.apiRouting));
      }
      // v23.17: Restore help dismissals and mail tab preference
      if (profile.settings && profile.settings.helpDismissed && typeof profile.settings.helpDismissed === 'object') {
        var _localHelp = {};
        try { _localHelp = JSON.parse(localStorage.getItem('roweos_help_dismissed') || '{}'); } catch(e) {}
        Object.keys(profile.settings.helpDismissed).forEach(function(k) { _localHelp[k] = true; });
        localStorage.setItem('roweos_help_dismissed', JSON.stringify(_localHelp));
      }
      if (profile.settings && profile.settings.mailCurrentTab) {
        localStorage.setItem('roweos_mail_current_tab', profile.settings.mailCurrentTab);
      }
      // v20.11: Check cloud scheduler status AND sync API keys cross-device from Firestore
      if (firebaseUser) {
        db.doc('roweos_users/' + uid + '/secure/api_keys').get().then(function(secDoc) {
          if (secDoc.exists) {
            var secData = secDoc.data();
        // v28.3: Always sync API keys cross-device (not gated by scheduler)
            if (secData.cloudSchedulerEnabled) {
              localStorage.setItem('roweos_cloud_scheduler', 'true');
              if (typeof updateCloudSchedulerUI === 'function') updateCloudSchedulerUI(true);
            }
            // Cross-device API key sync — always run
            try {
              var localKeys = {};
              try { localKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
              var updated = false;
              if (secData.anthropic && !localKeys.anthropic) { localKeys.anthropic = secData.anthropic; updated = true; }
              if (secData.openai && !localKeys.openai) { localKeys.openai = secData.openai; updated = true; }
              if (secData.google && !localKeys.google) { localKeys.google = secData.google; updated = true; }
              if (updated) {
                localStorage.setItem('roweos_api_keys', JSON.stringify(localKeys));
                console.log('[Sync] API keys synced from cloud to this device');
                if (typeof renderProviderSettings === 'function') renderProviderSettings();
                if (typeof checkApiConnection === 'function') checkApiConnection(true);
                if (typeof updateProviderStatuses === 'function') updateProviderStatuses();
              }
            } catch(e) {}
          }
        }).catch(function() {});
      }
      // v16.15: Restore calendar integration credentials
      if (profile.calendarIntegration) {
        var calInt = profile.calendarIntegration;
        // v23.2: gcalClientId no longer synced — hardcoded in app
        if (calInt.icloudAppleId) localStorage.setItem('roweos_icloud_apple_id', calInt.icloudAppleId);
        // v30.1: iCloud app password is device-local only — NEVER sync to Firestore
        if (calInt.icloudAppPassword) localStorage.setItem('roweos_icloud_app_password', calInt.icloudAppPassword);
        if (calInt.icloudCalHome) localStorage.setItem('roweos_icloud_cal_home', calInt.icloudCalHome);
        // v17.3: Restore calendar list from Firebase
        if (calInt.icloudCalendars) {
          localStorage.setItem('roweos_icloud_calendars', calInt.icloudCalendars);
          try { _icloudCalendars = JSON.parse(calInt.icloudCalendars); } catch(e) {}
        }
        // v16.15: Auto-connect iCloud on other devices if credentials were synced
        if (calInt.icloudAppleId && calInt.icloudAppPassword && !_icloudConnected) {
          _icloudConnected = true;
          localStorage.setItem('roweos_icloud_connected', 'true');
          // v17.3: Re-discover calendars if list is empty, then sync events
          if (_icloudCalendars.length === 0) {
            fetchICloudCalendars(calInt.icloudAppleId, calInt.icloudAppPassword).then(function(cals) {
              if (cals && cals.length > 0) {
                _icloudCalendars = cals;
                try { localStorage.setItem('roweos_icloud_calendars', JSON.stringify(cals)); } catch(e) {}
              }
              syncICloudCalendarEvents();
              updateCalendarIntegrationUI();
            }).catch(function() { syncICloudCalendarEvents(); });
          } else {
            syncICloudCalendarEvents();
          }
        }
        // v23.2: Re-init Google Calendar auth (Client ID is hardcoded)
        if (!_gcalConnected) {
          initGoogleCalendarAuth();
        }
      }
      // v19.0: Restore social connections from Firebase (desktop OAuth → mobile sync)
      // v19.1: Only apply connected:true entries — don't remove local connections
      // that may not be in Firebase yet (avoids cross-device disconnection)
      if (profile.socialConnections) {
        var sc = profile.socialConnections;
        Object.keys(sc).forEach(function(key) {
          var parts = key.match(/^(x|threads|instagram)(_brand_\d+|_life_\d+)$/);
          if (!parts) return;
          var p = parts[1];
          var s = parts[2];
          var entry = sc[key];
          if (entry.connected) {
            localStorage.setItem('roweos_social_' + p + '_connected' + s, 'true');
            if (entry.handle) localStorage.setItem('roweos_social_' + p + '_handle' + s, entry.handle);
            if (entry.token) localStorage.setItem('roweos_social_token_' + p + s, entry.token);
          }
          // v19.1: Don't remove local connections — connected:false entries are
          // no longer synced to Firebase, so absence means "not connected on that device"
        });
        if (typeof refreshSocialAccountCards === 'function') {
          setTimeout(function() { refreshSocialAccountCards(); }, 500);
        }
      }
      // v24.1: Also check social_tokens subcollection for tokens stored by social-auth.js
      // This catches cross-device connections where social-callback wrote to Firestore
      // but never triggered syncToFirebaseV2 (separate page, no main app code)
      try {
        var uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
        if (uid) {
          firebase.firestore().collection('roweos_users').doc(uid).collection('social_tokens').get().then(function(tokenSnap) { // v26.7: Fix collection name
            if (tokenSnap.empty) return;
            var foundNew = false;
            tokenSnap.forEach(function(doc) {
              var docId = doc.id; // e.g. "instagram_brand_0"
              var parts = docId.match(/^(x|threads|instagram)(_brand_\d+|_life_\d+)$/);
              if (!parts) return;
              var p = parts[1];
              var s = parts[2];
              var connKey = 'roweos_social_' + p + '_connected' + s;
              // If Firestore has a valid token but localStorage doesn't show connected, restore it
              if (localStorage.getItem(connKey) !== 'true') {
                var tData = doc.data();
                if (tData && tData.accessToken) {
                  localStorage.setItem(connKey, 'true');
                  localStorage.setItem('roweos_social_token_' + p + s, JSON.stringify(tData));
                  foundNew = true;
                }
              }
            });
            if (foundNew && typeof refreshSocialAccountCards === 'function') {
              refreshSocialAccountCards();
            }
          }).catch(function() {});
        }
      } catch(e) {}
      // v15.13: Read last device from cloud metadata
      if (profile.meta && profile.meta.lastDevice) {
        cloudLastDevice = profile.meta.lastDevice;
      }
    }

    // v28.1: When v4 active, profile/main doesn't exist -- read brand_settings/main + settings/api_keys
    var _v4SettingsChain = Promise.resolve();
    if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active() && !profileDoc.exists) {
      _v4SettingsChain = db.doc(basePath + '/brand_settings/main').get().then(function(bsDoc) {
        if (bsDoc.exists) {
          var bsData = bsDoc.data();
          if (bsData && typeof bsData === 'object') {
            var cleanBS = {};
            Object.keys(bsData).forEach(function(k) {
              if (k.charAt(0) !== '_' && k !== 'id') cleanBS[k] = bsData[k];
            });
            if (Object.keys(cleanBS).length > 0) {
              _mergeCloudBrandSettings(cleanBS);
              console.log('[LoadV4] brandSettings loaded from brand_settings/main');
            }
          }
        }
      }).catch(function(err) {
        console.warn('[LoadV4] brand_settings/main read failed:', err.message);
      }).then(function() {
        return db.doc(basePath + '/settings/api_keys').get().then(function(akDoc) {
          if (akDoc.exists) {
            var akData = akDoc.data();
            try {
              var localKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
              var updated = false;
              if (akData.anthropic && !localKeys.anthropic) { localKeys.anthropic = akData.anthropic; updated = true; }
              if (akData.openai && !localKeys.openai) { localKeys.openai = akData.openai; updated = true; }
              if (akData.google && !localKeys.google) { localKeys.google = akData.google; updated = true; }
              if (updated) {
                localStorage.setItem('roweos_api_keys', JSON.stringify(localKeys));
                console.log('[LoadV4] API keys synced from v4');
                // v28.2: Re-check API connection after keys loaded from cloud
                if (typeof checkApiConnection === 'function') checkApiConnection(true);
                if (typeof updateProviderStatuses === 'function') updateProviderStatuses();
              }
            } catch(e) {}
          }
        }).catch(function() {});
      });
    }

    // Brands — v27.0: Merge cloud with local instead of blind overwrite
    // v27.0: Skip brands merge if we just saved locally
    var _brandSkipMerge = typeof lastLocalSaveTime !== 'undefined' && Date.now() - lastLocalSaveTime < 10000;
    if (!brandsSnap.empty && !_brandSkipMerge) {
      var cloudBrands = [];
      // v28.3: ALWAYS prefer individual docs over _all doc.
      // Individual docs have ALL fields. _all doc was previously a subset and caused data loss.
      // _all doc is only used as fallback when NO individual docs exist.
      brandsSnap.forEach(function(doc) {
        if (doc.id !== '_all') { cloudBrands.push(doc.data()); }
      });
      if (cloudBrands.length === 0) {
        // Fallback: no individual docs, try _all doc
        var _allDoc = null;
        brandsSnap.forEach(function(doc) {
          if (doc.id === '_all') { _allDoc = doc.data(); }
        });
        if (_allDoc && _allDoc.items && _allDoc.items.length > 0) {
          cloudBrands = _allDoc.items;
          console.log('[Sync V3.1] Brands: fallback to _all doc (' + cloudBrands.length + ' brands, no individual docs found)');
        }
      } else {
        console.log('[Sync V3.1] Brands: using individual docs (' + cloudBrands.length + ' brands)');
      }
      if (cloudBrands.length > 0) {
        var _localBrandsV2 = [];
        try { _localBrandsV2 = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brands) || '[]'); } catch(e) {}
        // v27.0: Backfill id using brand name as stable identifier
        function _brandStableId2(b) {
          if (b.id && b.id.indexOf('brand_cloud_') !== 0 && b.id.indexOf('brand_local_') !== 0) return b.id;
          return 'brand_name_' + (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        }
        for (var _cb2 = 0; _cb2 < cloudBrands.length; _cb2++) {
          cloudBrands[_cb2].id = _brandStableId2(cloudBrands[_cb2]);
        }
        for (var _lb2 = 0; _lb2 < _localBrandsV2.length; _lb2++) {
          _localBrandsV2[_lb2].id = _brandStableId2(_localBrandsV2[_lb2]);
        }
        // v27.0: For brands, use a SAFE merge that NEVER drops local-only items.
        // Brands are too important to auto-delete via sync. Users delete via UI which
        // also deletes from Firestore. Local-only brands = not yet synced, not deleted.
        var _brandMerged = {};
        var _brandOrder = [];
        // Cloud brands are baseline
        for (var _bm1 = 0; _bm1 < cloudBrands.length; _bm1++) {
          var _bk1 = cloudBrands[_bm1].id;
          if (_bk1) { _brandMerged[_bk1] = cloudBrands[_bm1]; _brandOrder.push(_bk1); }
        }
        // Local brands: ALWAYS keep (override cloud if newer, add if local-only)
        for (var _bm2 = 0; _bm2 < _localBrandsV2.length; _bm2++) {
          var _bk2 = _localBrandsV2[_bm2].id;
          if (!_bk2) continue;
          if (_brandMerged[_bk2]) {
            // Exists in both -- keep whichever is newer
            var _cloudBTs = _normalizeTs(_brandMerged[_bk2]._modifiedAt);
            var _localBTs = _normalizeTs(_localBrandsV2[_bm2]._modifiedAt);
            if (_localBTs >= _cloudBTs) _brandMerged[_bk2] = _localBrandsV2[_bm2];
          } else {
            // Local-only -- ALWAYS keep (not yet synced to cloud)
            _brandMerged[_bk2] = _localBrandsV2[_bm2];
            _brandOrder.push(_bk2);
          }
        }
        var _mergedBrandsV2 = [];
        _brandOrder.forEach(function(k) { if (_brandMerged[k]) _mergedBrandsV2.push(_brandMerged[k]); });
        console.log('[Sync V3.1] Brands merge: cloud=' + cloudBrands.length + ' local=' + _localBrandsV2.length + ' merged=' + _mergedBrandsV2.length);
        // v28.1: Backfill _order if missing (migration ran before _order was added)
        if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
          var _orderMap = {
            'brand_name_the_rowe_collection': 0,
            'brand_name_solo': 1,
            'brand_name_solo_jordan_rowe': 1,
            'brand_name_retreats': 2,
            'brand_name_retreats_by_trc': 2,
            'brand_name_the_reserve': 3,
            'brand_name_reserve': 3,
            'brand_name_r_co': 4,
            'brand_name_r_co_': 4,
            'brand_name_roweos': 5
          };
          var _needsOrderWrite = false;
          for (var _bo = 0; _bo < _mergedBrandsV2.length; _bo++) {
            if (typeof _mergedBrandsV2[_bo]._order !== 'number') {
              var _bid = _mergedBrandsV2[_bo].id || '';
              _mergedBrandsV2[_bo]._order = (_orderMap[_bid] !== undefined) ? _orderMap[_bid] : (_bo + 100);
              _needsOrderWrite = true;
            }
          }
          // Sort by _order
          _mergedBrandsV2.sort(function(a, b) { return (a._order || 0) - (b._order || 0); });
          // Write _order back to v4 Firestore if we had to backfill
          if (_needsOrderWrite && firebaseUser) {
            var _orderDB = typeof getDB === 'function' ? getDB() : null;
            if (_orderDB) {
              var _v4BrandsBase = SYNC_V4_NAMESPACE + '/' + firebaseUser.uid + '/brands/';
              for (var _ow = 0; _ow < _mergedBrandsV2.length; _ow++) {
                if (_mergedBrandsV2[_ow].id) {
                  _orderDB.doc(_v4BrandsBase + _mergedBrandsV2[_ow].id).set({ _order: _mergedBrandsV2[_ow]._order }, { merge: true }).catch(function() {});
                }
              }
              console.log('[SyncV4] Wrote _order to', _mergedBrandsV2.length, 'brands');
            }
          }
        }
        localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(_mergedBrandsV2));
        // Also update in-memory brands array
        if (typeof brands !== 'undefined') {
          brands.length = 0;
          for (var _mb2 = 0; _mb2 < _mergedBrandsV2.length; _mb2++) { brands.push(_mergedBrandsV2[_mb2]); }
        }
      }
    }

    // Conversations
    // v23.7: Merge-based sync — never overwrite local with fewer conversations
    if (convCurrentDoc.exists && shouldSyncCategory('brandai_chats')) {
      var convCurrent = convCurrentDoc.data();
      if (convCurrent.messages && typeof currentConversation !== 'undefined') {
        // Only apply cloud current conversation if local is empty or cloud has more messages
        if (currentConversation.length === 0 || (convCurrent.messages.length > currentConversation.length)) {
          currentConversation.length = 0;
          Array.prototype.push.apply(currentConversation, convCurrent.messages);
        }
      }
    }
    if (convHistoryDoc.exists && shouldSyncCategory('brandai_chats')) {
      var histData = convHistoryDoc.data();
      var cloudHistJson = histData.json || (histData.data ? JSON.stringify(histData.data) : null);
      if (cloudHistJson) {
        // v23.7: Merge cloud history with local — never lose local conversations
        try {
          var cloudHist = JSON.parse(cloudHistJson);
          var localHist = [];
          try { localHist = JSON.parse(localStorage.getItem('roweos_conversations') || '[]'); } catch(lhe) {}
          if (!Array.isArray(cloudHist)) cloudHist = [];
          if (!Array.isArray(localHist)) localHist = [];
          if (localHist.length === 0) {
            // Local empty — take cloud as-is
            localStorage.setItem('roweos_conversations', cloudHistJson);
          } else if (cloudHist.length === 0) {
            // Cloud empty — keep local (don't overwrite with nothing)
            console.log('[Sync] Cloud history empty, preserving ' + localHist.length + ' local conversations');
          } else {
            // Both have data — merge by ID, cloud wins for matching IDs (newer), keep local-only entries
            var cloudById = {};
            cloudHist.forEach(function(conv) {
              var cId = conv.id || conv.timestamp || JSON.stringify(conv.messages && conv.messages[0]);
              cloudById[cId] = conv;
            });
            var merged = [];
            var mergedIds = {};
            // Add all cloud conversations first
            cloudHist.forEach(function(conv) {
              var cId = conv.id || conv.timestamp || JSON.stringify(conv.messages && conv.messages[0]);
              merged.push(conv);
              mergedIds[cId] = true;
            });
            // Add local-only conversations (not in cloud)
            localHist.forEach(function(conv) {
              var cId = conv.id || conv.timestamp || JSON.stringify(conv.messages && conv.messages[0]);
              if (!mergedIds[cId]) {
                merged.push(conv);
              }
            });
            localStorage.setItem('roweos_conversations', JSON.stringify(merged));
            if (merged.length > localHist.length || merged.length > cloudHist.length) {
              console.log('[Sync] Merged conversations: cloud=' + cloudHist.length + ' local=' + localHist.length + ' merged=' + merged.length);
            }
          }
        } catch(mergeErr) {
          console.warn('[Sync] Conversation merge error, keeping local:', mergeErr.message);
          // On error, keep local data — never lose it
        }
      }
    }
    // v30.3: Prefer per-doc subcollection over blob for BrandAI chats
    var _useSubcollection = chatsSubSnap && !chatsSubSnap.empty;

    if (_useSubcollection && shouldSyncCategory('brandai_chats') && typeof agentCommands !== 'undefined') {
      try {
        var _cloudChats = [];
        chatsSubSnap.forEach(function(doc) { _cloudChats.push(doc.data()); });
        // Same merge logic as blob path — merge cloud with local by ID
        var _subCloudById = {};
        _cloudChats.forEach(function(cmd) { if (cmd.id) _subCloudById[cmd.id] = cmd; });
        var _subLocalOnly = [];
        agentCommands.forEach(function(cmd) {
          if (cmd.id && !_subCloudById[cmd.id]) _subLocalOnly.push(cmd);
        });
        var _subAllMerged = _subLocalOnly.concat(_cloudChats);
        // v28.4: Split merged chats by mode — agentHistory stores both brand+life
        var _subBrandChats = _subAllMerged.filter(function(cmd) { return cmd.mode !== 'life'; });
        var _subLifeChats = _subAllMerged.filter(function(cmd) { return cmd.mode === 'life'; });
        agentCommands.length = 0;
        Array.prototype.push.apply(agentCommands, _subBrandChats);
        try { localStorage.setItem('roweos_agentCommands', JSON.stringify(_subBrandChats)); } catch(e2) {}
        // Merge life chats into existing life commands (don't overwrite)
        try {
          var _subExistingLife = JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]');
          var _subLifeIds = {};
          _subExistingLife.forEach(function(c) { if (c.id) _subLifeIds[c.id] = true; });
          _subLifeChats.forEach(function(c) { if (c.id && !_subLifeIds[c.id]) _subExistingLife.push(c); });
          localStorage.setItem('roweos_life_agentCommands', JSON.stringify(_subExistingLife));
        } catch(e3) {}
        console.log('[Firebase V3] Chat subcollection merge: ' + _subBrandChats.length + ' brand, ' + _subLifeChats.length + ' life');
      } catch(e) {
        console.warn('[Firebase V3] Chat subcollection merge error:', e.message);
      }
    } else if (convAgentDoc.exists && shouldSyncCategory('brandai_chats')) {
      // Existing blob fallback — keep ALL existing code unchanged
      var agentData = convAgentDoc.data();
      if (agentData.json && typeof agentCommands !== 'undefined') {
        try {
          var parsed = JSON.parse(agentData.json);
          // v22.32: Merge cloud with local — cloud may be trimmed (max 30), local may have more
          // Keep local entries not found in cloud, then add cloud entries (cloud wins for matching IDs)
          var cloudById = {};
          parsed.forEach(function(cmd) { if (cmd.id) cloudById[cmd.id] = cmd; });
          var localOnly = [];
          agentCommands.forEach(function(cmd) {
            if (cmd.id && !cloudById[cmd.id]) localOnly.push(cmd);
          });
          var allMerged = localOnly.concat(parsed);
          // v28.4: Split merged chats by mode — agentHistory stores both brand+life
          var _brandChats = allMerged.filter(function(cmd) { return cmd.mode !== 'life'; });
          var _lifeChats = allMerged.filter(function(cmd) { return cmd.mode === 'life'; });
          agentCommands.length = 0;
          Array.prototype.push.apply(agentCommands, _brandChats);
          // v28.4: Write brand chats to roweos_agentCommands, life chats to roweos_life_agentCommands
          try { localStorage.setItem('roweos_agentCommands', JSON.stringify(_brandChats)); } catch(e2) {}
          // Merge life chats into existing life commands (don't overwrite)
          try {
            var existingLife = JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]');
            var lifeIds = {};
            existingLife.forEach(function(c) { if (c.id) lifeIds[c.id] = true; });
            _lifeChats.forEach(function(c) { if (c.id && !lifeIds[c.id]) existingLife.push(c); });
            localStorage.setItem('roweos_life_agentCommands', JSON.stringify(existingLife));
          } catch(e3) {}
        } catch (e) {}
      }
    }

    // v30.3: Fire-and-forget migration to subcollection (runs once per user)
    migrateChatBlobToSubcollection();

    // Knowledge
    // v23.0: Timestamp-based conflict resolution for knowledge
    if (!knowledgeSnap.empty) {
      knowledgeSnap.forEach(function(doc) {
        var key = doc.id;
        var kData = doc.data();
        if (key.indexOf('brand_') === 0) {
          _mergeCloudKnowledge('roweos_knowledge_' + key.replace('brand_', ''), kData.data || kData);
        } else if (key === 'user') {
          _mergeCloudKnowledge('roweos_user_knowledge', kData.data || kData);
        } else if (key === 'brandMemory') {
          // v15.16: Restore brand memory documents (metadata + insights)
          try {
            var bmCloud = JSON.parse(kData.data || '{}');
            var bmLocal = JSON.parse(localStorage.getItem('roweos_brand_memory') || '{}');
            // Merge cloud docs with local — cloud provides metadata/insights, local keeps raw content
            Object.keys(bmCloud).forEach(function(bKey) {
              if (!bmLocal[bKey]) bmLocal[bKey] = { documents: [] };
              var cloudDocs = bmCloud[bKey].documents || [];
              var localDocs = bmLocal[bKey].documents || [];
              cloudDocs.forEach(function(cd) {
                var existing = localDocs.find(function(ld) { return ld.id === cd.id; });
                if (!existing) {
                  // Doc exists in cloud but not locally — restore it (without raw content)
                  localDocs.push(cd);
                }
              });
              bmLocal[bKey].documents = localDocs;
            });
            localStorage.setItem('roweos_brand_memory', JSON.stringify(bmLocal));
            // Also update in-memory brandMemory var
            if (typeof brandMemory !== 'undefined') {
              Object.keys(bmLocal).forEach(function(bk) { brandMemory[bk] = bmLocal[bk]; });
            }
            // v29.1: Migrate any restored index-based keys to ID-based
            if (typeof migrateBrandMemoryKeys === 'function') migrateBrandMemoryKeys();
          } catch(e) { console.warn('[Firebase V2] brandMemory restore error:', e.message); }
        } else if (key === 'lifeMemory') {
          // v15.16: Restore life memory documents (metadata + insights)
          try {
            var lmCloud = JSON.parse(kData.data || '{}');
            var lmLocal = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
            if (lmCloud.documents) {
              if (!lmLocal.documents) lmLocal.documents = [];
              lmCloud.documents.forEach(function(cd) {
                var existing = lmLocal.documents.find(function(ld) { return ld.id === cd.id; });
                if (!existing) {
                  lmLocal.documents.push(cd);
                }
              });
            }
            localStorage.setItem('roweos_life_memory', JSON.stringify(lmLocal));
          } catch(e) { console.warn('[Firebase V2] lifeMemory restore error:', e.message); }
        }
      });
    }

    // LifeAI
    if (lifeDoc.exists) {
      var life = lifeDoc.data();
      // v26.4: Flush any pending debounced writes before cloud pull
      if (typeof _flushLifeAISync === 'function') _flushLifeAISync();

      // v26.4: Stale data detection (suppressed during onboarding to avoid false positives)
      // v26.4: Stale data detection -- disabled (was producing false positives, needs redesign)
      // TODO: Redesign stale data detection to compare actual data hashes instead of timestamps

      // v23.7: Use safeSyncWrite for array/object fields to prevent empty cloud overwrites
      // v27.0: Merge life profiles instead of blind overwrite
      if (life.profiles) {
        var _localLifeProfiles = [];
        try { _localLifeProfiles = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]'); } catch(e) {}
        // Backfill id on cloud profiles that may predate migration
        for (var _clp = 0; _clp < (life.profiles || []).length; _clp++) {
          if (!life.profiles[_clp].id) life.profiles[_clp].id = 'life_cloud_' + _clp;
        }
        for (var _llp = 0; _llp < _localLifeProfiles.length; _llp++) {
          if (!_localLifeProfiles[_llp].id) _localLifeProfiles[_llp].id = 'life_local_' + _llp;
        }
        var _mergedLifeProfiles = mergeByTimestamp(_localLifeProfiles, life.profiles, 'id');
        localStorage.setItem('roweos_life_profiles', JSON.stringify(_mergedLifeProfiles));
      }
      if (life.currentProfileIdx !== undefined) localStorage.setItem('roweos_current_life_profile_idx', String(life.currentProfileIdx));
      // v26.4: Validate profile index bounds
      var restoredProfiles = life.profiles || [];
      var restoredIdx = life.currentProfileIdx || 0;
      if (restoredIdx < 0 || restoredIdx >= restoredProfiles.length) {
        restoredIdx = Math.max(0, restoredProfiles.length - 1);
        localStorage.setItem('roweos_current_life_profile_idx', String(restoredIdx));
      }
      if (life.currentProfile) safeSyncWrite('roweos_life_profile', life.currentProfile);
      if (life.userName) localStorage.setItem('roweos_user_name', life.userName);
      // v30.1: App mode is DEVICE-LOCAL — cloud/onSnapshot never overwrites it
      // Only seed if no local preference exists (first load on new device)
      if (life.mainSystemPrompt) localStorage.setItem('roweos_life_main_prompt', life.mainSystemPrompt);
      if (life.generatedOps) safeSyncWrite('roweos_generated_life_ops', life.generatedOps);
      if (life.goals) safeSyncWrite('roweos_life_goals', life.goals);
      if (life.routines) safeSyncWrite('roweos_life_routines', life.routines);
      if (life.habits) safeSyncWrite('roweos_life_habits', life.habits);
      // v15.13: Restore LifeAI accent colors (legacy + per-theme)
      if (life.accentColor) localStorage.setItem('roweos_life_accent_color', life.accentColor);
      if (life.accentDark) localStorage.setItem('roweos_life_accent_dark', life.accentDark);
      if (life.accentDarkMode) localStorage.setItem('roweos_life_accent_dark_mode', life.accentDarkMode);
      if (life.accentDarkModeDark) localStorage.setItem('roweos_life_accent_dark_mode_dark', life.accentDarkModeDark);
      if (life.accentLightMode) localStorage.setItem('roweos_life_accent_light_mode', life.accentLightMode);
      if (life.accentLightModeDark) localStorage.setItem('roweos_life_accent_light_mode_dark', life.accentLightModeDark);
      // v15.13: Restore LifeAI chats, todos, memory
      // v23.7: Merge LifeAI chats — never overwrite local with fewer or empty
      if (life.agentCommands && shouldSyncCategory('lifeai_chats')) {
        var localLifeChats = [];
        try { localLifeChats = JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]'); } catch(e) {}
        if (!Array.isArray(localLifeChats)) localLifeChats = [];
        if (!Array.isArray(life.agentCommands)) life.agentCommands = [];
        if (life.agentCommands.length === 0 && localLifeChats.length > 0) {
          console.log('[Sync] Cloud life chats empty, preserving ' + localLifeChats.length + ' local chats');
        } else if (localLifeChats.length === 0 || life.agentCommands.length >= localLifeChats.length) {
          localStorage.setItem('roweos_life_agentCommands', JSON.stringify(life.agentCommands));
        } else {
          console.log('[Sync] Cloud life chats (' + life.agentCommands.length + ') fewer than local (' + localLifeChats.length + '), keeping local');
        }
      }
      if (life.todos && shouldSyncCategory('life_todos')) safeSyncWrite('roweos_life_todos', life.todos);
      // v15.25: Merge life memory instead of overwrite (preserves local docs not yet synced)
      if (life.memory) {
        try {
          var lmCloud = life.memory;
          var lmLocal = JSON.parse(localStorage.getItem('roweos_life_memory') || '{}');
          if (lmCloud.documents && lmCloud.documents.length > 0) {
            if (!lmLocal.documents) lmLocal.documents = [];
            lmCloud.documents.forEach(function(cd) {
              var existingIdx = lmLocal.documents.findIndex(function(ld) { return ld.id === cd.id; });
              if (existingIdx >= 0) {
                if ((cd.insights || []).length >= (lmLocal.documents[existingIdx].insights || []).length) {
                  lmLocal.documents[existingIdx] = cd;
                }
              } else {
                lmLocal.documents.push(cd);
              }
            });
          }
          // Preserve non-document fields from cloud
          Object.keys(lmCloud).forEach(function(k) {
            if (k !== 'documents') lmLocal[k] = lmCloud[k];
          });
          localStorage.setItem('roweos_life_memory', JSON.stringify(lmLocal));
        } catch(e) { console.warn('[Firebase V2] lifeMemory merge error:', e.message); }
      }
      // v15.21: Restore Rhythm preferences and widget config
      if (life.rhythmPreferences) safeSyncWrite('roweos_life_rhythm_preferences', life.rhythmPreferences);
      if (life.rhythmWidgetConfig) safeSyncWrite('roweos_rhythm_widget_config', life.rhythmWidgetConfig);
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
    }

    // v29.3: Pulse goals — read from per-goal collection, fallback to legacy pulse/main
    var _cloudGoalsFromCollection = [];
    pulseGoalsSnap.forEach(function(doc) {
      var g = doc.data();
      if (!g.id) g.id = doc.id;
      _cloudGoalsFromCollection.push(g);
    });
    if (_cloudGoalsFromCollection.length === 0 && pulseMainDoc && pulseMainDoc.exists) {
      // Fallback to legacy pulse/main document for goals
      var _legacyPulse = pulseMainDoc.data();
      var _legacyGoals = _legacyPulse.goals;
      if (_legacyGoals === undefined && _legacyPulse.data !== undefined) _legacyGoals = _legacyPulse.data;
      if (typeof _legacyGoals === 'string') { try { _legacyGoals = JSON.parse(_legacyGoals); } catch(e) { _legacyGoals = undefined; } }
      if (_legacyGoals && Array.isArray(_legacyGoals)) _cloudGoalsFromCollection = _legacyGoals;
    }
    if (_cloudGoalsFromCollection.length > 0) {
      var _localGoals2 = [];
      try {
        var _lgRaw = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
        _localGoals2 = Array.isArray(_lgRaw) ? _lgRaw : (Array.isArray(_lgRaw.data) ? _lgRaw.data : []);
      } catch(e) {}
      var _mergedGoals2 = mergeByTimestamp(_localGoals2, _cloudGoalsFromCollection, 'id');
      localStorage.setItem('roweos_pulse_goals', JSON.stringify(_mergedGoals2));
      if (typeof pulseGoals !== 'undefined') pulseGoals = _mergedGoals2;
    }
    // v29.3: Non-goal data from pulse/main doc
    if (pulseMainDoc && pulseMainDoc.exists) {
      var _pulseMain = pulseMainDoc.data();
      if (_pulseMain.journal !== undefined) safeSyncWrite('roweos_pulse_journal', _pulseMain.journal);
      if (_pulseMain.insights !== undefined) safeSyncWrite('roweos_pulse_insights', _pulseMain.insights);
      if (_pulseMain.entries !== undefined) safeSyncWrite('roweos_pulse2_entries', _pulseMain.entries);
      if (_pulseMain.reminders !== undefined) safeSyncWrite('roweos_reminders', _pulseMain.reminders);
    }

    // v27.3: Todos -- use already-fetched collection snapshot (no second async fetch needed)
    if (shouldSyncCategory('brand_todos')) {
      var _todoMainDoc = null;
      todosSnap.forEach(function(doc) { if (doc.id === 'main') _todoMainDoc = doc; });
      if (_todoMainDoc && _todoMainDoc.exists && _todoMainDoc.data().data) {
        safeSyncWrite('roweosTodos', _todoMainDoc.data().data);
      } else if (!todosSnap.empty) {
        // Fallback: old per-index subcollection format
        var todos = [];
        todosSnap.forEach(function(doc) { if (doc.id !== 'main') todos.push(doc.data()); });
        if (todos.length > 0) safeSyncWrite('roweosTodos', todos);
      }
    }

    // v27.3: Calendar -- use already-fetched collection snapshot (no second async fetch needed)
    if (shouldSyncCategory('calendar')) {
      var _calMainDoc = null;
      calendarSnap.forEach(function(doc) { if (doc.id === 'main') _calMainDoc = doc; });
      if (_calMainDoc && _calMainDoc.exists && _calMainDoc.data().data) {
        safeSyncWrite('roweos_calendar', _calMainDoc.data().data);
      } else if (!calendarSnap.empty) {
        var calendar = [];
        calendarSnap.forEach(function(doc) { if (doc.id !== 'main') calendar.push(doc.data()); });
        if (calendar.length > 0) safeSyncWrite('roweos_calendar', calendar);
      }
    }

    // Runs
    // v15.37: Preserve object format expected by loadRuns()
    // v23.16: Merge cloud runs by ID instead of replacing
    if (!runsSnap.empty && shouldSyncCategory('runs')) {
      var cloudRuns = [];
      runsSnap.forEach(function(doc) { cloudRuns.push(doc.data()); });
      var existingObj = {};
      try { existingObj = JSON.parse(localStorage.getItem('roweos_runs') || '{}'); } catch(e) { console.warn('[Sync] Corrupted roweos_runs:', e.message); }
      if (Array.isArray(existingObj)) existingObj = { runs: existingObj };
      var _localR = existingObj.runs || [];
      var _localIds = {};
      for (var _lr = 0; _lr < _localR.length; _lr++) { if (_localR[_lr].id) _localIds[_localR[_lr].id] = true; }
      for (var _cr = 0; _cr < cloudRuns.length; _cr++) { if (!cloudRuns[_cr].id || !_localIds[cloudRuns[_cr].id]) _localR.push(cloudRuns[_cr]); }
      _localR.sort(function(a, b) { return (a.id || 0) - (b.id || 0); });
      existingObj.runs = _localR.slice(-50);
      localStorage.setItem('roweos_runs', JSON.stringify(existingObj));
    }

    // v28.6: Load deletion tombstones BEFORE automations (prevents resurrection)
    if (deletedAutoIdsDoc && deletedAutoIdsDoc.exists) {
      var _cloudDeleted = deletedAutoIdsDoc.data();
      if (_cloudDeleted && _cloudDeleted.data && typeof _deletedAutomationIds !== 'undefined') {
        var _delKeys = Object.keys(_cloudDeleted.data);
        for (var _dk = 0; _dk < _delKeys.length; _dk++) {
          if (!_deletedAutomationIds[_delKeys[_dk]]) {
            _deletedAutomationIds[_delKeys[_dk]] = _cloudDeleted.data[_delKeys[_dk]];
          }
        }
        console.log('[Firebase V3] Loaded ' + _delKeys.length + ' deleted automation tombstones from cloud');
        // v28.7: Persist to localStorage so tombstones survive page refresh
        if (typeof _persistDeletedIds === 'function') _persistDeletedIds();
      }
    }

    // v25.0: Automations — write-through, Firestore is truth
    var _automationsChain = db.collection(basePath + '/automations').get().then(function(autoSnap) {
      var cloudAutos = [];
      if (autoSnap && !autoSnap.empty) {
        autoSnap.forEach(function(doc) { cloudAutos.push(doc.data()); });
      }
      // v28.6: Filter out deleted automations before writing to local
      if (typeof _deletedAutomationIds !== 'undefined' && Object.keys(_deletedAutomationIds).length > 0) {
        var _beforeCount = cloudAutos.length;
        cloudAutos = cloudAutos.filter(function(a) { return !_deletedAutomationIds[String(a.id)]; });
        if (_beforeCount !== cloudAutos.length) {
          console.log('[Firebase V3] Filtered ' + (_beforeCount - cloudAutos.length) + ' deleted automations from cloud pull');
        }
      }
      if (cloudAutos.length > 0) {
        // v27.0: Use safeSyncWrite (now merges arrays) instead of blind overwrite
        safeSyncWrite('roweos_automations', cloudAutos);
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

    // Inventory (brand) — v20.5: smart merge, never blindly overwrite
    if (shouldSyncCategory('inventory')) {
      var cloudInvItems = [];
      if (!inventorySnap.empty) {
        inventorySnap.forEach(function(doc) { cloudInvItems.push(doc.data()); });
      }
      try {
        var localInv = JSON.parse(localStorage.getItem('roweos_inventory') || '{}');
        var localCount = (localInv.items || []).length;
        var cloudCount = cloudInvItems.length;
        var localTs = localInv.updatedAt || '1970-01-01';
        // Find most recent updatedAt from cloud items
        var cloudTs = '1970-01-01';
        cloudInvItems.forEach(function(ci) { if (ci.updatedAt && ci.updatedAt > cloudTs) cloudTs = ci.updatedAt; });
        // Only overwrite local if cloud is genuinely newer AND has at least as many items
        if (cloudCount > 0 && (cloudTs > localTs || localCount === 0)) {
          if (cloudCount >= localCount || localCount === 0) {
            localStorage.setItem('roweos_inventory', JSON.stringify({
              items: cloudInvItems,
              categories: localInv.categories || ['General', 'Products', 'Services', 'Digital', 'Consulting'],
              updatedAt: cloudTs
            }));
            console.log('[Firebase V2] Inventory restored:', cloudCount, 'items (cloud newer)');
          } else {
            console.log('[Firebase V2] Inventory: local has more items (' + localCount + ' vs ' + cloudCount + '), keeping local');
          }
        } else {
          console.log('[Firebase V2] Inventory: local is current (' + localCount + ' items, ts=' + localTs + ')');
        }
      } catch(invErr) {
        console.warn('[Firebase V2] Inventory merge error:', invErr);
      }
    }

    // v15.16: Possessions (life inventory)
    if (possessionsDoc && possessionsDoc.exists) {
      var possData = possessionsDoc.data();
      if (possData.items && possData.items.length > 0) {
        var lifeCats = possData.categories || ['Electronics', 'Home & Furniture', 'Vehicles', 'Clothing & Accessories', 'Collectibles & Art', 'Sports & Outdoors', 'Tools & Equipment', 'Other'];
        localStorage.setItem('roweos_life_inventory', JSON.stringify({ items: possData.items, categories: lifeCats }));
      }
    }

    // v15.3: Library (restore from V2 subcollections)
    if (libraryBrandDoc.exists && shouldSyncCategory('library')) {
      var libData = libraryBrandDoc.data();
      if (libData.data) localStorage.setItem('roweosLibrary', libData.data);
      // v24.9: Restore library favorites
      if (libData.favorites && Array.isArray(libData.favorites)) {
        var _localFavs = sp('roweos_library_favorites', []);
        var _mergedFavs = _localFavs.slice();
        libData.favorites.forEach(function(f) { if (_mergedFavs.indexOf(f) === -1) _mergedFavs.push(f); });
        localStorage.setItem('roweos_library_favorites', JSON.stringify(_mergedFavs));
      }
    }
    // v15.30: Restore per-profile life libraries from cloud
    if (libraryLifeDoc.exists && shouldSyncCategory('library')) {
      var lifeLibData = libraryLifeDoc.data();
      if (lifeLibData.data) {
        try {
          // v28.1: In v4, data is a native Firestore map (object), not a JSON string
          var lifeProfiles = (typeof lifeLibData.data === 'string') ? JSON.parse(lifeLibData.data) : lifeLibData.data;
          var _lifeLibStr = (typeof lifeLibData.data === 'string') ? lifeLibData.data : JSON.stringify(lifeLibData.data);
          if (lifeProfiles && typeof lifeProfiles === 'object' && lifeProfiles.profile_0) {
            // v15.30: Per-profile format -- restore each profile's library
            Object.keys(lifeProfiles).forEach(function(pk) {
              var idx = pk.replace('profile_', '');
              var val = lifeProfiles[pk];
              localStorage.setItem('roweos_life_library_profile_' + idx, typeof val === 'string' ? val : JSON.stringify(val));
            });
          } else {
            // Legacy format -- store as profile 0
            localStorage.setItem('roweos_life_library_profile_0', _lifeLibStr);
          }
          // v15.30: Also keep legacy key for backwards compatibility
          localStorage.setItem('roweos_life_library', _lifeLibStr);
        } catch(e) {
          // Fallback: store raw value as profile 0
          var _fallbackStr = (typeof lifeLibData.data === 'string') ? lifeLibData.data : JSON.stringify(lifeLibData.data);
          localStorage.setItem('roweos_life_library_profile_0', _fallbackStr);
          localStorage.setItem('roweos_life_library', _fallbackStr);
        }
        // Invalidate cache
        fileLibrary['_life'] = null;
      }
    }

    // v16.5: Restore logos from per-logo subcollection docs (new format)
    if (logosSnap && !logosSnap.empty && shouldSyncCategory('logos')) {
      logosSnap.forEach(function(doc) {
        var logoInfo = doc.data();
        if (logoInfo && logoInfo.base64 && logoInfo.key) {
          var logoKey = logoInfo.key;
          // v15.37: Skip shared LifeAI key — migrate to per-profile key instead
          if (logoKey === 'roweos_lifeai_logo') {
            var profileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
            var perProfileKey = 'roweos_lifeai_logo_profile_' + profileIdx;
            if (!localStorage.getItem(perProfileKey)) {
              localStorage.setItem(perProfileKey, logoInfo.base64);
              if (logoInfo.size) localStorage.setItem(perProfileKey + '_size', String(logoInfo.size));
            }
            return;
          }
          localStorage.setItem(logoKey, logoInfo.base64);
          // v25.0: Only set cloud size if no local size exists (prevents sync resetting user's custom size)
          if (logoInfo.size && !localStorage.getItem(logoKey + '_size')) {
            localStorage.setItem(logoKey + '_size', String(logoInfo.size));
          }
        }
      });
    } else if (logosDoc.exists && shouldSyncCategory('logos')) {
      // v15.37 fallback: Restore from legacy single-doc format
      var logosData = logosDoc.data();
      if (!logosData._version) { // Only use if not a v2 index doc
        Object.keys(logosData).forEach(function(logoKey) {
          var logoInfo = logosData[logoKey];
          if (logoInfo && logoInfo.base64) {
            if (logoKey === 'roweos_lifeai_logo') {
              var profileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
              var perProfileKey = 'roweos_lifeai_logo_profile_' + profileIdx;
              if (!localStorage.getItem(perProfileKey)) {
                localStorage.setItem(perProfileKey, logoInfo.base64);
                if (logoInfo.size) localStorage.setItem(perProfileKey + '_size', String(logoInfo.size));
              }
              return;
            }
            localStorage.setItem(logoKey, logoInfo.base64);
            // v25.0: Only set cloud size if no local size exists
            if (logoInfo.size && !localStorage.getItem(logoKey + '_size')) {
              localStorage.setItem(logoKey + '_size', String(logoInfo.size));
            }
          }
        });
      }
    }

    // v16.8: Restore generated brand ops, custom agents, custom ops from V2 subcollections
    if (genBrandOpsDoc && genBrandOpsDoc.exists) {
      var gbo = genBrandOpsDoc.data();
      if (gbo && gbo.data) {
        // v24.12: ID-based merge to prevent cross-device overwrites
        var _localGenOps = [];
        try { _localGenOps = JSON.parse(localStorage.getItem('roweos_generated_brand_ops') || '[]'); } catch(e) {}
        var _cloudOps = gbo.data || [];
        var _mergedIds = {};
        var _mergedGenOps = [];
        // Local ops take priority (may have newer edits)
        _localGenOps.forEach(function(op) { _mergedIds[op.id] = true; _mergedGenOps.push(op); });
        _cloudOps.forEach(function(op) { if (!_mergedIds[op.id]) { _mergedIds[op.id] = true; _mergedGenOps.push(op); } });
        localStorage.setItem('roweos_generated_brand_ops', JSON.stringify(_mergedGenOps));
        if (typeof generatedBrandOps !== 'undefined') {
          generatedBrandOps.length = 0;
          _mergedGenOps.forEach(function(op) { generatedBrandOps.push(op); });
        }
      }
    }
    if (customAgentsDoc && customAgentsDoc.exists) {
      var ca = customAgentsDoc.data();
      if (ca && ca.data && ca.data.length > 0) {
        localStorage.setItem('roweos_custom_agents', JSON.stringify(ca.data));
      }
    }
    if (customOpsDoc && customOpsDoc.exists) {
      var co = customOpsDoc.data();
      if (co && co.data && co.data.length > 0) {
        localStorage.setItem('roweos_custom_operations', JSON.stringify(co.data));
      }
    }
    // v30.0: Legacy roweos_clients restore DISABLED — all client data now in roweos_people
    // profile/clients cloud doc is stale. getClients() reads from roweos_people.
    // v25.3: Restore people from Firebase (unified people storage)
    if (peopleDoc && peopleDoc.exists) {
      var pd = peopleDoc.data();
      if (pd && pd.data && pd.data.length > 0) {
        safeSyncWrite('roweos_people', pd.data);
      }
    }
    // v25.3: Restore inventory from dedicated doc
    if (inventoryV3Doc && inventoryV3Doc.exists) {
      var invData = inventoryV3Doc.data();
      if (invData && invData.data && invData.data.items && invData.data.items.length > 0) {
        var localInvRaw = localStorage.getItem('roweos_inventory');
        var localInv = localInvRaw ? JSON.parse(localInvRaw) : { items: [] };
        var localCount = (localInv.items || []).length;
        var cloudCount = invData.data.items.length;
        var localTs = localInv.updatedAt || '1970-01-01';
        var cloudTs = invData.data.updatedAt || '1970-01-01';
        if (cloudCount > 0 && (cloudTs > localTs || localCount === 0)) {
          localStorage.setItem('roweos_inventory', JSON.stringify(invData.data));
          console.log('[Firebase V3] Inventory restored:', cloudCount, 'items');
        }
      }
    }
    // v17.0: Restore social posts
    if (socialPostsDoc && socialPostsDoc.exists) {
      var spd = socialPostsDoc.data();
      if (spd && spd.data && spd.data.length > 0) {
        localStorage.setItem('roweos_social_posts', JSON.stringify(spd.data));
      }
    }
    // v17.0: Restore social workflows
    if (socialWorkflowsDoc && socialWorkflowsDoc.exists) {
      var swd = socialWorkflowsDoc.data();
      if (swd && swd.data && swd.data.length > 0) {
        localStorage.setItem('roweos_social_workflows', JSON.stringify(swd.data));
      }
    }
    // v22.16: Restore bloom content library metadata
    if (bloomLibraryDoc && bloomLibraryDoc.exists) {
      var bld = bloomLibraryDoc.data();
      if (bld && bld.data) {
        var localLib = getBloomLibrary();
        var cloudScopes = Object.keys(bld.data);
        for (var cls = 0; cls < cloudScopes.length; cls++) {
          var clScope = cloudScopes[cls];
          if (!localLib[clScope]) localLib[clScope] = [];
          var localIds = {};
          for (var cli = 0; cli < localLib[clScope].length; cli++) {
            localIds[localLib[clScope][cli].id] = true;
          }
          var cloudItems = bld.data[clScope] || [];
          for (var cci = 0; cci < cloudItems.length; cci++) {
            var ci = cloudItems[cci];
            if (!localIds[ci.id] && ci.thumbnailUrl) {
              // Download from Storage
              (function(scope, item) {
                fetch(item.thumbnailUrl).then(function(resp) { return resp.blob(); }).then(function(blob) {
                  var reader = new FileReader();
                  reader.onloadend = function() {
                    item.base64 = reader.result;
                    var lib = getBloomLibrary();
                    if (!lib[scope]) lib[scope] = [];
                    if (lib[scope].length < BLOOM_LIBRARY_MAX) {
                      lib[scope].push(item);
                      try { localStorage.setItem('roweos_bloom_library', JSON.stringify(lib)); } catch(e) {}
                    }
                  };
                  reader.readAsDataURL(blob);
                }).catch(function() {});
              })(clScope, { id: ci.id, base64: '', mimeType: ci.mimeType, agentType: ci.agentType, active: ci.active, name: ci.name, addedAt: ci.addedAt, thumbnailUrl: ci.thumbnailUrl });
            } else if (localIds[ci.id]) {
              // Sync metadata from cloud
              for (var uli = 0; uli < localLib[clScope].length; uli++) {
                if (localLib[clScope][uli].id === ci.id) {
                  localLib[clScope][uli].active = ci.active;
                  localLib[clScope][uli].agentType = ci.agentType;
                  break;
                }
              }
            }
          }
        }
        try { localStorage.setItem('roweos_bloom_library', JSON.stringify(localLib)); } catch(e) {}
      }
    }
    // v22.17: Restore bloom knowledge from cloud — merge with local by id dedup
    if (bloomKnowledgeDoc && bloomKnowledgeDoc.exists) {
      var bkd = bloomKnowledgeDoc.data();
      if (bkd && bkd.data) {
        var localKnow = getBloomKnowledge();
        var bkScopes = Object.keys(bkd.data);
        for (var bks = 0; bks < bkScopes.length; bks++) {
          var bkScope = bkScopes[bks];
          if (!localKnow[bkScope]) localKnow[bkScope] = [];
          var localKIds = {};
          for (var lki = 0; lki < localKnow[bkScope].length; lki++) {
            localKIds[localKnow[bkScope][lki].id] = true;
          }
          var cloudKItems = bkd.data[bkScope] || [];
          for (var cki = 0; cki < cloudKItems.length; cki++) {
            if (!localKIds[cloudKItems[cki].id]) {
              localKnow[bkScope].push(cloudKItems[cki]);
            }
          }
          if (localKnow[bkScope].length > BLOOM_KNOWLEDGE_MAX) {
            localKnow[bkScope] = localKnow[bkScope].slice(0, BLOOM_KNOWLEDGE_MAX);
          }
        }
        try { localStorage.setItem('roweos_bloom_knowledge', JSON.stringify(localKnow)); } catch(e) {}
      }
    }
    // v24.8: Restore user contact card from cloud — cloud wins if local is empty
    if (userContactDoc && userContactDoc.exists) {
      var _ucd = userContactDoc.data();
      if (_ucd && _ucd.data) {
        var localUC = getUserContact();
        if (!localUC.name && !localUC.email) {
          try { localStorage.setItem('roweos_user_contact', JSON.stringify(_ucd.data)); } catch(e) {}
        } else if (_ucd.data.updatedAt && (!localUC.updatedAt || _ucd.data.updatedAt > localUC.updatedAt)) {
          try { localStorage.setItem('roweos_user_contact', JSON.stringify(_ucd.data)); } catch(e) {}
        }
      }
    }
    // v24.8: Restore automation memory from cloud — merge by ID
    if (automationMemoryDoc && automationMemoryDoc.exists) {
      var _amd = automationMemoryDoc.data();
      if (_amd && _amd.data && Array.isArray(_amd.data)) {
        var localAM = getAutomationMemory();
        var amById = {};
        for (var ami = 0; ami < localAM.length; ami++) { amById[localAM[ami].id] = localAM[ami]; }
        for (var amj = 0; amj < _amd.data.length; amj++) {
          var cloudEntry = _amd.data[amj];
          if (!amById[cloudEntry.id]) {
            localAM.push(cloudEntry);
          } else if (cloudEntry.count > (amById[cloudEntry.id].count || 1)) {
            amById[cloudEntry.id].count = cloudEntry.count;
            amById[cloudEntry.id].lastSeen = cloudEntry.lastSeen;
          }
        }
        if (localAM.length > AUTOMATION_MEMORY_MAX) localAM = localAM.slice(0, AUTOMATION_MEMORY_MAX);
        try { localStorage.setItem('roweos_automation_memory', JSON.stringify(localAM)); } catch(e) {}
      }
      // v24.9: Merge automation memory tracking (higher counts win)
      if (_amd && _amd.tracking && typeof _amd.tracking === 'object') {
        var _localTrack = getAutomationMemoryTracking();
        var _keys = Object.keys(_amd.tracking);
        for (var _ti = 0; _ti < _keys.length; _ti++) {
          var _tk = _keys[_ti];
          if (!_localTrack[_tk] || _amd.tracking[_tk] > _localTrack[_tk]) {
            _localTrack[_tk] = _amd.tracking[_tk];
          }
        }
        saveAutomationMemoryTracking(_localTrack);
      }
    }
    // v25.1: Restore focus notes from cloud
    if (focusNotesDoc && focusNotesDoc.exists) {
      var _fnd = focusNotesDoc.data();
      if (_fnd && _fnd.data && typeof _fnd.data === 'object') {
        var fnDateKeys = Object.keys(_fnd.data);
        for (var fnR = 0; fnR < fnDateKeys.length; fnR++) {
          var fnDateKey = 'roweos_focus_notes_' + fnDateKeys[fnR];
          // Only restore if not already present locally (local wins for today)
          if (!localStorage.getItem(fnDateKey)) {
            try { localStorage.setItem(fnDateKey, _fnd.data[fnDateKeys[fnR]]); } catch(e) {}
          }
        }
      }
    }
    // v25.0: Restore Folio items from cloud
    if (folioDoc && folioDoc.exists) {
      var _folioData = folioDoc.data();
      // v25.3: Check both 'data' and 'items' fields (write-through used 'items' before fix)
      var cloudItems = (_folioData && _folioData.data) || (_folioData && _folioData.items) || [];
      if (cloudItems.length > 0) {
        var localFolio = [];
        try {
          var _rawFolio = JSON.parse(localStorage.getItem('roweos_folio_items') || '[]');
          // v28.1: v4 may store as { data: [...] } or { items: [...] } wrapper
          if (Array.isArray(_rawFolio)) { localFolio = _rawFolio; }
          else if (_rawFolio && Array.isArray(_rawFolio.data)) { localFolio = _rawFolio.data; }
          else if (_rawFolio && Array.isArray(_rawFolio.items)) { localFolio = _rawFolio.items; }
        } catch(e) {}
        // Merge: cloud items that don't exist locally get added
        var localIds = {};
        localFolio.forEach(function(f) { if (f.id) localIds[f.id] = true; });
        cloudItems.forEach(function(cf) {
          if (cf.id && !localIds[cf.id]) localFolio.push(cf);
        });
        localStorage.setItem('roweos_folio_items', JSON.stringify(localFolio));
      }
    }
    // v27.0: Research history
    if (researchHistDoc && researchHistDoc.exists) {
      var _rhData = researchHistDoc.data();
      if (_rhData && _rhData.items) {
        safeSyncWrite('roweos_research_history', _rhData.items);
      }
    }
    // v19.7: Restore notifications from cloud — merge with local by timestamp dedup
    if (notificationsDoc && notificationsDoc.exists) {
      var nfd = notificationsDoc.data();
      if (nfd && nfd.items) {
        var localNotifs = [];
        try { localNotifs = JSON.parse(localStorage.getItem('roweos_notifications') || '[]'); } catch(e) {}
        // Merge: combine cloud + local, dedup by id, sort newest first, cap at 100
        var merged = {};
        localNotifs.forEach(function(n) { if (n.id) merged[n.id] = n; });
        nfd.items.forEach(function(n) { if (n.id) merged[n.id] = n; });
        var mergedArr = Object.keys(merged).map(function(k) { return merged[k]; });
        mergedArr.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
        if (mergedArr.length > 100) mergedArr = mergedArr.slice(0, 100);
        localStorage.setItem('roweos_notifications', JSON.stringify(mergedArr));
        // Sync last-seen: use the more recent value
        if (nfd.lastSeen) {
          var localLastSeen = parseInt(localStorage.getItem('roweos_notifications_last_seen') || '0');
          var cloudLastSeen = parseInt(nfd.lastSeen || '0');
          if (cloudLastSeen > localLastSeen) {
            localStorage.setItem('roweos_notifications_last_seen', String(cloudLastSeen));
          }
        }
        if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
      }
    }
    // v22.23: Restore mail outbox, sent, config from cloud
    // v22.39: Tombstone-aware merge — deleted items stay deleted across devices
    if (mailDoc && mailDoc.exists) {
      var md = mailDoc.data();
      if (md) {
        // v22.44: Build tombstone set using getMailDeletedIds() which handles expiry
        var localDelIds = getMailDeletedIds(); // Already filtered for expiry
        var cloudDelIds = md.deletedIds || [];
        var _tombSet = {};
        localDelIds.forEach(function(id) { _tombSet[id] = true; });
        // Cloud tombstones: support both old (string) and new ({id,ts}) format
        cloudDelIds.forEach(function(item) {
          var tid = typeof item === 'string' ? item : (item && item.id ? item.id : null);
          if (tid) _tombSet[tid] = true;
        });
        // Don't persist merged tombstones back — let getMailDeletedIds() handle expiry naturally

        if (md.outbox !== undefined) {
          // v25.2: Cloud-authoritative for outbox. If cloud outbox is empty [],
          // that means all items were sent/removed. Do NOT preserve stale local items.
          var cloudOutbox = (md.outbox || []).filter(function(m) { return m.id && !_tombSet[m.id]; });
          localStorage.setItem('roweos_mail_outbox', JSON.stringify(cloudOutbox));
        }
        if (md.sent !== undefined) {
          // v25.2: Cloud-authoritative for sent. Cloud wins over local.
          var sentMap = {};
          (md.sent || []).forEach(function(m) { if (m.id) sentMap[m.id] = m; });
          // Also include local sent items not in cloud (recently sent offline)
          var localSent = [];
          try { localSent = JSON.parse(localStorage.getItem('roweos_mail_sent') || '[]'); } catch(e) {}
          var lastSync = 0;
          try { lastSync = parseInt(localStorage.getItem('roweos_last_sync') || '0'); } catch(e) {}
          localSent.forEach(function(m) { if (m.id && !sentMap[m.id] && m.sentAt && m.sentAt > lastSync) sentMap[m.id] = m; });
          var mergedSent = Object.keys(sentMap).map(function(k) { return sentMap[k]; });
          mergedSent.sort(function(a, b) { return (b.sentAt || 0) - (a.sentAt || 0); });
          if (mergedSent.length > 200) mergedSent = mergedSent.slice(0, 200);
          localStorage.setItem('roweos_mail_sent', JSON.stringify(mergedSent));
        }
        if (md.config) {
          var localConfig = {};
          try { localConfig = JSON.parse(localStorage.getItem('roweos_mail_config') || '{}'); } catch(e) {}
          // v23.1: Check explicitly disconnected providers — never restore their keys
          var _disconnected = [];
          try { _disconnected = JSON.parse(localStorage.getItem('roweos_mail_disconnected') || '[]'); } catch(e) {}
          var _gmailKeys = ['gmailEmail','gmailToken','gmailRefreshToken','gmailExpiresAt'];
          var _outlookKeys = ['outlookEmail','outlookToken','outlookRefreshToken'];
          var _providerKeys = _gmailKeys.concat(_outlookKeys);
          // v23.12: Also check account-level disconnects
          var _dcAccts = [];
          try { _dcAccts = JSON.parse(localStorage.getItem('roweos_mail_disconnected_accounts') || '[]'); } catch(e) {}
          Object.keys(md.config).forEach(function(k) {
            if (_providerKeys.indexOf(k) !== -1) {
              // v23.1: Skip if this provider was explicitly disconnected
              if (_gmailKeys.indexOf(k) !== -1 && _disconnected.indexOf('gmail') !== -1) return;
              if (_outlookKeys.indexOf(k) !== -1 && _disconnected.indexOf('outlook') !== -1) return;
              // Only set provider keys if local doesn't already exist
              if (!localConfig[k] && md.config[k]) localConfig[k] = md.config[k];
            } else if (k === 'gmailAccounts' || k === 'outlookAccounts') {
              // v23.12: Filter out individually disconnected accounts
              if (md.config[k] && Array.isArray(md.config[k])) {
                var provider = k === 'gmailAccounts' ? 'gmail' : 'outlook';
                if (_disconnected.indexOf(provider) !== -1) return;
                var filtered = md.config[k].filter(function(a) {
                  return _dcAccts.indexOf(provider + ':' + a.email) === -1;
                });
                if (filtered.length > 0) localConfig[k] = filtered;
              }
            } else if (md.config[k]) {
              localConfig[k] = md.config[k];
            }
          });
          localStorage.setItem('roweos_mail_config', JSON.stringify(localConfig));
        }
        // v22.25: Merge drafts (tombstone-aware)
        if (md.drafts) {
          var localDrafts = [];
          try { localDrafts = JSON.parse(localStorage.getItem('roweos_mail_drafts') || '[]'); } catch(e) {}
          var draftsMap = {};
          localDrafts.forEach(function(m) { if (m.id && !_tombSet[m.id]) draftsMap[m.id] = m; });
          (md.drafts || []).forEach(function(m) { if (m.id && !_tombSet[m.id]) draftsMap[m.id] = m; });
          var mergedDrafts = Object.keys(draftsMap).map(function(k) { return draftsMap[k]; });
          mergedDrafts.sort(function(a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); });
          localStorage.setItem('roweos_mail_drafts', JSON.stringify(mergedDrafts));
        }
        // v22.31: Restore signatures
        if (md.signatures && Array.isArray(md.signatures)) {
          var localSigs = [];
          try { localSigs = JSON.parse(localStorage.getItem('roweos_mail_signatures') || '[]'); } catch(e) {}
          var sigsMap = {};
          localSigs.forEach(function(s) { if (s.id) sigsMap[s.id] = s; });
          (md.signatures || []).forEach(function(s) { if (s.id) sigsMap[s.id] = s; });
          localStorage.setItem('roweos_mail_signatures', JSON.stringify(Object.keys(sigsMap).map(function(k) { return sigsMap[k]; })));
        }
        // v22.44: Merge outbox folders (union of local + cloud)
        if (md.outboxFolders && Array.isArray(md.outboxFolders)) {
          var localFolders = [];
          try { localFolders = JSON.parse(localStorage.getItem('roweos_mail_outbox_folders') || '[]'); } catch(e) {}
          var folderSet = {};
          localFolders.forEach(function(f) { folderSet[f] = true; });
          md.outboxFolders.forEach(function(f) { folderSet[f] = true; });
          localStorage.setItem('roweos_mail_outbox_folders', JSON.stringify(Object.keys(folderSet)));
        }
        // v23.2: Merge address book
        if (md.addressBook && Array.isArray(md.addressBook)) {
          var localBook = [];
          try { localBook = JSON.parse(localStorage.getItem('roweos_mail_address_book') || '[]'); } catch(e) {}
          var bookMap = {};
          localBook.forEach(function(c) { if (c.email) bookMap[c.email.toLowerCase()] = c; });
          md.addressBook.forEach(function(c) { if (c.email) bookMap[c.email.toLowerCase()] = bookMap[c.email.toLowerCase()] || c; });
          localStorage.setItem('roweos_mail_address_book', JSON.stringify(Object.keys(bookMap).map(function(k) { return bookMap[k]; })));
        }
        // v23.17: Restore mail logo from cloud
        if (md.mailLogo && !localStorage.getItem('roweos_mail_logo')) {
          localStorage.setItem('roweos_mail_logo', md.mailLogo);
        }
        // v24.9: Restore per-from-address avatars
        if (md.fromAvatars && typeof md.fromAvatars === 'object') {
          var _localAvatars = typeof getMailFromAvatars === 'function' ? getMailFromAvatars() : {};
          var _avKeys = Object.keys(md.fromAvatars);
          for (var _avi = 0; _avi < _avKeys.length; _avi++) {
            if (!_localAvatars[_avKeys[_avi]]) _localAvatars[_avKeys[_avi]] = md.fromAvatars[_avKeys[_avi]];
          }
          localStorage.setItem('roweos_mail_from_avatars', JSON.stringify(_localAvatars));
        }
        // v23.17: Merge disconnected accounts/providers from cloud
        if (md.disconnectedAccounts && md.disconnectedAccounts.length > 0) {
          var _localDcA = [];
          try { _localDcA = JSON.parse(localStorage.getItem('roweos_mail_disconnected_accounts') || '[]'); } catch(e) {}
          md.disconnectedAccounts.forEach(function(a) { if (_localDcA.indexOf(a) === -1) _localDcA.push(a); });
          localStorage.setItem('roweos_mail_disconnected_accounts', JSON.stringify(_localDcA));
        }
        if (md.disconnectedProviders && md.disconnectedProviders.length > 0) {
          var _localDcP = [];
          try { _localDcP = JSON.parse(localStorage.getItem('roweos_mail_disconnected') || '[]'); } catch(e) {}
          md.disconnectedProviders.forEach(function(p) { if (_localDcP.indexOf(p) === -1) _localDcP.push(p); });
          localStorage.setItem('roweos_mail_disconnected', JSON.stringify(_localDcP));
        }
        // v22.39: Merge social outbox (tombstone-aware)
        if (md.socialOutbox && Array.isArray(md.socialOutbox)) {
          var localSocOutbox = [];
          try { localSocOutbox = JSON.parse(localStorage.getItem('roweos_social_outbox') || '[]'); } catch(e) {}
          var socMap = {};
          localSocOutbox.forEach(function(s) { if (s.id && !_tombSet[s.id]) socMap[s.id] = s; });
          (md.socialOutbox || []).forEach(function(s) { if (s.id && !_tombSet[s.id]) socMap[s.id] = s; });
          var mergedSoc = Object.keys(socMap).map(function(k) { return socMap[k]; });
          mergedSoc.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
          localStorage.setItem('roweos_social_outbox', JSON.stringify(mergedSoc));
        }
        // v22.40: Merge pending approval queue (tombstone-aware)
        if (md.pendingApproval && Array.isArray(md.pendingApproval)) {
          var localPA = [];
          try { localPA = JSON.parse(localStorage.getItem('roweos_pending_approval') || '[]'); } catch(e) {}
          var paMap = {};
          localPA.forEach(function(p) { if (p.id && !_tombSet[p.id]) paMap[p.id] = p; });
          (md.pendingApproval || []).forEach(function(p) { if (p.id && !_tombSet[p.id]) paMap[p.id] = p; });
          var mergedPA = Object.keys(paMap).map(function(k) { return paMap[k]; });
          mergedPA.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
          localStorage.setItem('roweos_pending_approval', JSON.stringify(mergedPA));
        }
        if (typeof updateMailBadge === 'function') updateMailBadge();
        if (typeof updateMailDraftsBadge === 'function') updateMailDraftsBadge();
        if (typeof updateSocialOutboxBadge === 'function') updateSocialOutboxBadge();
        if (typeof updatePendingApprovalBadge === 'function') updatePendingApprovalBadge();
      }
    }
    // v22.25: Restore automation execution history
    if (autoLabHistDoc && autoLabHistDoc.exists) {
      var alhData = autoLabHistDoc.data();
      if (alhData && alhData.data) {
        var localALH2 = [];
        try { localALH2 = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]'); } catch(e) {}
        var alhMap2 = {};
        localALH2.forEach(function(h) { alhMap2[h.timestamp || h.id || Math.random()] = h; });
        alhData.data.forEach(function(h) { alhMap2[h.timestamp || h.id || Math.random()] = h; });
        var merged2 = Object.keys(alhMap2).map(function(k) { return alhMap2[k]; });
        merged2.sort(function(a, b) { return new Date(b.timestamp || 0) - new Date(a.timestamp || 0); });
        localStorage.setItem('roweos_auto_lab_history', JSON.stringify(merged2.slice(0, 50)));
      }
    }
    if (compAutosDoc && compAutosDoc.exists) {
      var caData = compAutosDoc.data();
      if (caData && caData.data) {
        var localCA2 = [];
        try { localCA2 = JSON.parse(localStorage.getItem('roweos_completed_automations') || '[]'); } catch(e) {}
        var caMap2 = {};
        localCA2.forEach(function(c) { caMap2[c.id || c.taskId || Math.random()] = c; });
        caData.data.forEach(function(c) { caMap2[c.id || c.taskId || Math.random()] = c; });
        var mergedCA2 = Object.keys(caMap2).map(function(k) { return caMap2[k]; });
        mergedCA2.sort(function(a, b) { return new Date(b.timestamp || 0) - new Date(a.timestamp || 0); });
        localStorage.setItem('roweos_completed_automations', JSON.stringify(mergedCA2.slice(0, 100)));
      }
    }
    if (taskHistDoc && taskHistDoc.exists) {
      var thData = taskHistDoc.data();
      if (thData && thData.data) {
        var localTH = [];
        try { localTH = JSON.parse(localStorage.getItem('roweos_task_history') || '[]'); } catch(e) {}
        var thMap = {};
        localTH.forEach(function(h) { thMap[h.id || h.taskId || Math.random()] = h; });
        thData.data.forEach(function(h) { thMap[h.id || h.taskId || Math.random()] = h; });
        var mergedTH = Object.keys(thMap).map(function(k) { return thMap[k]; });
        mergedTH.sort(function(a, b) { return new Date(b.timestamp || 0) - new Date(a.timestamp || 0); });
        localStorage.setItem('roweos_task_history', JSON.stringify(mergedTH.slice(0, 50)));
      }
    }

    // v17.0: Restore social connection state from Firestore tokens
    if (typeof refreshSocialAccountCards === 'function') refreshSocialAccountCards();

    // v18.4: Restore analytics data from Firebase
    db.doc(basePath + '/analytics/main').get().then(function(analyticsDoc) {
      if (analyticsDoc.exists) {
        var cloudAnalytics = analyticsDoc.data();
        if (cloudAnalytics && cloudAnalytics.entries) {
          var localAnalytics = getAnalyticsData();
          var localEntries = localAnalytics.entries || [];
          // Merge: deduplicate by timestamp
          var seen = {};
          localEntries.forEach(function(e) { seen[e.timestamp] = true; });
          cloudAnalytics.entries.forEach(function(e) {
            if (!seen[e.timestamp]) {
              localEntries.push(e);
              seen[e.timestamp] = true;
            }
          });
          // Sort by timestamp and cap to 90 days
          var ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
          localEntries = localEntries.filter(function(e) { return e.timestamp > ninetyDaysAgo; });
          localEntries.sort(function(a, b) { return a.timestamp - b.timestamp; });
          saveAnalyticsData({ entries: localEntries });
        }
      }
    }).catch(function(e) { console.warn('[Firebase V2] Analytics load skipped:', e); });
    // v20.2: Restore per-provider analytics thresholds
    db.doc(basePath + '/analytics/settings').get().then(function(settingsDoc) {
      if (settingsDoc.exists) {
        var sd = settingsDoc.data();
        if (sd && sd.thresholds) {
          ['claude', 'openai', 'gemini'].forEach(function(p) {
            if (sd.thresholds[p]) localStorage.setItem('roweos_analytics_threshold_' + p, sd.thresholds[p]);
            else localStorage.removeItem('roweos_analytics_threshold_' + p);
          });
        } else if (sd && sd.threshold) {
          // v20.2: Backwards compat — old global threshold
          ['claude', 'openai', 'gemini'].forEach(function(p) {
            localStorage.setItem('roweos_analytics_threshold_' + p, sd.threshold);
          });
        }
        // v24.25: Restore per-provider budgets
        if (sd && sd.providerBudgets) {
          ['claude', 'openai', 'gemini'].forEach(function(p) {
            if (sd.providerBudgets[p]) localStorage.setItem('roweos_api_budget_' + p, JSON.stringify(sd.providerBudgets[p]));
          });
        }
      }
    }).catch(function(e) {});

    // v22.12: Restore Bloom signals from Firebase
    db.doc(basePath + '/profile/bloomSignals').get().then(function(bloomSigDoc) {
      if (bloomSigDoc.exists) {
        var data = bloomSigDoc.data();
        if (data && data.signals) {
          var cloudUpdated = data.updatedAt || 0;
          var bKeys = Object.keys(data.signals);
          for (var b = 0; b < bKeys.length; b++) {
            var localKey = 'roweos_bloom_signals_' + bKeys[b];
            var localRaw = localStorage.getItem(localKey);
            var localUpdated = 0;
            if (localRaw) {
              try { localUpdated = JSON.parse(localRaw).lastUpdated || 0; } catch(e) {}
            }
            // Cloud wins if newer
            if (cloudUpdated > localUpdated) {
              localStorage.setItem(localKey, JSON.stringify(data.signals[bKeys[b]]));
            }
          }
        }
      }
    }).catch(function(e) { console.warn('[Firebase V2] Bloom signals load skipped:', e); });

    // v15.4: Update last sync timestamp after pull (both Settings and Sync Hub displays)
    // v15.13: Show cloud's lastDevice (who pushed), not this device
    var now = new Date();
    var syncTimeStr = now.toLocaleString();
    localStorage.setItem('roweos_last_sync', syncTimeStr);
    var deviceToShow = cloudLastDevice || getDeviceType();
    localStorage.setItem('roweos_last_sync_device', deviceToShow);
    updateLastSyncDisplay(syncTimeStr, deviceToShow);
    if (typeof updateSyncHubStatus === 'function') updateSyncHubStatus();

    updateSyncIndicator('connected');
    // v24.15: Force reload for cross-device pulls (bypass grace period)
    lastLocalSaveTime = 0;
    lastReloadTime = 0;
    reloadAllData();
    // v15.13: Show notification with device info on pull (only for cross-device syncs, not same-device reloads)
    if (showNotification !== false) {
      var deviceLabel = cloudLastDevice || 'cloud';
      var currentDevice = typeof getDeviceType === 'function' ? getDeviceType() : 'web';
      // v28.1: Re-enabled cross-device toast with v4 _deviceId check
      if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
        // v4: Use precise device IDs for cross-device detection
        var _localDevId = typeof _getDeviceId === 'function' ? _getDeviceId() : '';
        // Check if any brand doc has a different _deviceId (means another device pushed)
        try {
          var _bArr = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]');
          var _crossDeviceDetected = false;
          for (var _cd = 0; _cd < _bArr.length; _cd++) {
            if (_bArr[_cd]._deviceId && _bArr[_cd]._deviceId !== _localDevId) {
              _crossDeviceDetected = true;
              var _remoteName = _bArr[_cd]._deviceId.split('_')[0] || 'another device';
              deviceLabel = _remoteName.charAt(0).toUpperCase() + _remoteName.slice(1);
              break;
            }
          }
          if (_crossDeviceDetected) {
            showToast('Synced from ' + deviceLabel, 'success');
          }
        } catch(e) {}
      } else {
        // Legacy: use device type string comparison
        if (deviceLabel !== currentDevice && deviceLabel !== 'cloud') {
          showToast('Synced from ' + deviceLabel, 'success');
        }
      }
    }
    // v29.2: Scribe notebooks — cloud-authoritative merge
    if (scribeDoc && scribeDoc.exists) {
      var _scribeCloud = scribeDoc.data();
      var _cloudNbs = (_scribeCloud && _scribeCloud.notebooks) ? _scribeCloud.notebooks : [];
      if (Array.isArray(_cloudNbs) && _cloudNbs.length > 0) {
        var _localNbs = [];
        try { _localNbs = JSON.parse(localStorage.getItem('roweos_scribe_notebooks') || '[]'); } catch(e) { _localNbs = []; }
        if (!Array.isArray(_localNbs)) _localNbs = [];
        var _mergedNbs = mergeByTimestamp(_localNbs, _cloudNbs, 'id');
        localStorage.setItem('roweos_scribe_notebooks', JSON.stringify(_mergedNbs));
        if (typeof scribeNotebooks !== 'undefined') scribeNotebooks = _mergedNbs;
        console.log('[Firebase V3] Scribe notebooks synced: ' + _mergedNbs.length);
      }
    }

    // v25.2: Mark first sync completed for mergeByTimestamp offline detection
    localStorage.setItem('roweos_first_sync_completed', 'true');
    localStorage.setItem('roweos_last_sync', String(Date.now()));
    console.log('[Firebase V2] Load complete');
  }).catch(function(error) {
    console.error('[Firebase V2] Load error:', error);
    // Fallback to v1 single-doc load
    console.log('[Firebase V2] Falling back to v1 load...');
    return loadFromFirebaseV1_legacy(false);
  });
}

// v30.3: One-time migration — split agentHistory blob into per-doc subcollection
function migrateChatBlobToSubcollection() {
  if (localStorage.getItem('roweos_chat_subcollection_migrated') === 'true') return;
  if (typeof firebase === 'undefined' || !firebase.firestore || typeof firebaseUser === 'undefined' || !firebaseUser) return;
  var db = firebase.firestore();
  var basePath = 'roweos_users/' + firebaseUser.uid;

  db.doc(basePath + '/chat_migration').get().then(function(doc) {
    if (doc.exists && doc.data().chatSubcollectionMigrated) {
      localStorage.setItem('roweos_chat_subcollection_migrated', 'true');
      return;
    }

    // Get all chats from in-memory agentCommands
    var chats = (typeof agentCommands !== 'undefined' ? agentCommands : []).filter(function(c) {
      return c && c.id && !c.preliminary;
    });

    if (chats.length === 0) {
      localStorage.setItem('roweos_chat_subcollection_migrated', 'true');
      return;
    }

    // Batch write in groups of 400
    var batchSize = 400;
    var promises = [];
    for (var i = 0; i < chats.length; i += batchSize) {
      var chunk = chats.slice(i, i + batchSize);
      var batch = db.batch();
      for (var j = 0; j < chunk.length; j++) {
        var clean = typeof sanitizeChatEntry === 'function' ? sanitizeChatEntry(chunk[j]) : chunk[j];
        var ref = db.doc(basePath + '/chats/' + String(chunk[j].id));
        batch.set(ref, clean, { merge: true });
      }
      promises.push(batch.commit());
    }

    Promise.all(promises).then(function() {
      db.doc(basePath + '/chat_migration').set({
        chatSubcollectionMigrated: true,
        migratedAt: Date.now(),
        chatCount: chats.length
      });
      localStorage.setItem('roweos_chat_subcollection_migrated', 'true');
      console.log('[Migration] Chat subcollection: migrated ' + chats.length + ' entries');
    }).catch(function(err) {
      console.warn('[Migration] Chat subcollection batch error:', err);
    });
  }).catch(function(err) {
    console.warn('[Migration] Chat subcollection check error:', err);
  });
}

// v15.0: Migrate old single-doc format to subcollections
function migrateToSubcollections(uid, oldData) {
  if (!oldData || oldData._migrated) return Promise.resolve();
  console.log('[Migration] Starting subcollection migration for', uid);

  var db = firebase.firestore();
  var basePath = 'roweos_users/' + uid;
  var writes = [];

  // Write brands as individual docs
  if (oldData.brands && oldData.brands.length > 0) {
    oldData.brands.forEach(function(brand, idx) {
      writes.push(db.doc(basePath + '/brands/' + idx).set(brand));
    });
  }

  // Write conversations
  if (oldData.conversations) {
    if (oldData.conversations.current) {
      writes.push(db.doc(basePath + '/conversations/current').set(oldData.conversations.current));
    }
    if (oldData.conversations.history) {
      writes.push(db.doc(basePath + '/conversations/history').set({ json: JSON.stringify(oldData.conversations.history) }));
    }
    if (oldData.conversations.agentHistoryJson) {
      writes.push(db.doc(basePath + '/conversations/agentHistory').set({ json: oldData.conversations.agentHistoryJson }));
    }
  }

  // Mark original doc as migrated (preserve as backup)
  writes.push(db.doc(basePath).update({ _migrated: true, _migratedAt: firebase.firestore.FieldValue.serverTimestamp() }));

  return Promise.all(writes).then(function() {
    console.log('[Migration] Complete -', writes.length, 'docs written');
  }).catch(function(err) {
    console.error('[Migration] Error:', err);
  });
}

// v15.0: Auto-init Firebase on page load (always configured)
document.addEventListener('DOMContentLoaded', function() {
  try {
    initializeFirebase(false);
  } catch (e) {
    console.log('Firebase auto-init failed:', e.message);
  }
  // v23.0: Initialize sync safety systems
  initSyncIndexedDB();
  scheduleAutoBackup();
});

// ═══════════════════════════════════════════════════════════════════════════════
// END FIREBASE REAL-TIME SYNC v2.0
// ═══════════════════════════════════════════════════════════════════════════════

