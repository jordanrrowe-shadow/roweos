// ═══════════════════════════════════════════════════════════════════════════════
// RoweOS v12.0.1 - FOUNDATION LAYER
// Centralized systems for storage, utilities, and constants
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// STORAGE API (store)
// Centralized localStorage wrapper with error handling, JSON parsing, and sync
// Replaces 700+ scattered localStorage calls with consistent interface
// ─────────────────────────────────────────────────────────────────────────────────

var store = (function() {
  var PREFIX = 'roweos_';
  var syncTimeout = null;

  function scheduleSync() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(function() {
      if (typeof syncToFirebase === 'function') {
        syncToFirebase();
      }
    }, 500);
  }

  return {
    // Get with automatic JSON parsing and default value
    get: function(key, defaultVal) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        if (raw === null) return defaultVal !== undefined ? defaultVal : null;
        return JSON.parse(raw);
      } catch(e) {
        console.warn('[store.get] Parse error for key:', key, e);
        return defaultVal !== undefined ? defaultVal : null;
      }
    },

    // Set with automatic JSON stringify
    set: function(key, val, options) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(val));
        if (!options || !options.skipSync) {
          scheduleSync();
        }
        return true;
      } catch(e) {
        console.error('[store.set] Error for key:', key, e);
        if (e.name === 'QuotaExceededError') {
          if (typeof showToast === 'function') {
            showToast('Storage full. Please clear some data.', 'error');
          }
        }
        return false;
      }
    },

    // Remove a key
    remove: function(key) {
      localStorage.removeItem(PREFIX + key);
      scheduleSync();
    },

    // Check if key exists
    has: function(key) {
      return localStorage.getItem(PREFIX + key) !== null;
    },

    // Get raw string (no JSON parsing)
    getRaw: function(key, defaultVal) {
      var val = localStorage.getItem(PREFIX + key);
      return val !== null ? val : (defaultVal || null);
    },

    // Set raw string (no JSON stringify)
    setRaw: function(key, val, options) {
      try {
        localStorage.setItem(PREFIX + key, val);
        if (!options || !options.skipSync) {
          scheduleSync();
        }
        return true;
      } catch(e) {
        console.error('[store.setRaw] Error for key:', key, e);
        return false;
      }
    },

    // Get without prefix (for legacy keys like 'brand_0')
    getLegacy: function(key, defaultVal) {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) return defaultVal !== undefined ? defaultVal : null;
        return JSON.parse(raw);
      } catch(e) {
        console.warn('[store.getLegacy] Parse error for key:', key, e);
        return defaultVal !== undefined ? defaultVal : null;
      }
    },

    // Set without prefix (for legacy keys)
    setLegacy: function(key, val, options) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
        if (!options || !options.skipSync) {
          scheduleSync();
        }
        return true;
      } catch(e) {
        console.error('[store.setLegacy] Error for key:', key, e);
        return false;
      }
    },

    // Batch get multiple keys
    getMany: function(keys) {
      var result = {};
      var self = this;
      keys.forEach(function(key) {
        result[key] = self.get(key);
      });
      return result;
    },

    // Batch set multiple keys
    setMany: function(obj, options) {
      var self = this;
      Object.keys(obj).forEach(function(key) {
        self.set(key, obj[key], { skipSync: true });
      });
      if (!options || !options.skipSync) {
        scheduleSync();
      }
    }
  };
})();

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS (utils)
// Consolidated utility functions - single source of truth
// Replaces duplicate function definitions throughout codebase
// ─────────────────────────────────────────────────────────────────────────────────

var utils = {
  // HTML escaping for XSS prevention
  escapeHtml: function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Time ago formatting (e.g., "2 hours ago")
  timeAgo: function(date) {
    if (!date) return '';
    var now = new Date();
    // v25.2: Handle epoch ms (numeric or numeric string)
    var parsed = typeof date === 'string' ? parseInt(date) : date;
    var then = (typeof parsed === 'number' && !isNaN(parsed) && String(parsed).length >= 10) ? new Date(parsed) : new Date(date);
    var diff = Math.floor((now - then) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    if (diff < 2592000) return Math.floor(diff / 604800) + 'w ago';

    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  // v24.18: Format time respecting user's 12h/24h preference
  formatTime12h: function(date) {
    if (!date) return '';
    var d = typeof date === 'string' && date.includes(':') && !date.includes('T')
      ? new Date('1970-01-01T' + date)
      : new Date(date);
    if (isNaN(d.getTime())) return '';
    var pref = localStorage.getItem('roweos_time_format') || '12h';
    if (pref === '24h') {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  },

  // Format date short (e.g., "Jan 15")
  formatDateShort: function(date) {
    if (!date) return '';
    var d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  // Format date full (e.g., "January 15, 2026")
  formatDateFull: function(date) {
    if (!date) return '';
    var d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  },

  // v24.18: Format date + time respecting user's 12h/24h preference
  formatDateTime: function(date) {
    if (!date) return '';
    var d = new Date(date);
    if (isNaN(d.getTime())) return '';
    var pref = localStorage.getItem('roweos_time_format') || '12h';
    var timeOpts = pref === '24h'
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : { hour: 'numeric', minute: '2-digit', hour12: true };
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
           d.toLocaleTimeString('en-US', timeOpts);
  },

  // Generate unique ID
  generateId: function(prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  // Debounce function calls
  debounce: function(func, wait) {
    var timeout;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        func.apply(context, args);
      }, wait);
    };
  },

  // Throttle function calls
  throttle: function(func, limit) {
    var inThrottle;
    return function() {
      var context = this;
      var args = arguments;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(function() { inThrottle = false; }, limit);
      }
    };
  },

  // Truncate text with ellipsis
  truncate: function(str, maxLength) {
    if (!str || str.length <= maxLength) return str || '';
    return str.substring(0, maxLength - 3) + '...';
  },

  // Deep clone an object
  clone: function(obj) {
    if (!obj) return obj;
    return JSON.parse(JSON.stringify(obj));
  },

  // Check if object is empty
  isEmpty: function(obj) {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  },

  // Safe array access
  safeGet: function(obj, path, defaultVal) {
    if (!obj || !path) return defaultVal;
    var keys = path.split('.');
    var result = obj;
    for (var i = 0; i < keys.length; i++) {
      if (result === null || result === undefined) return defaultVal;
      result = result[keys[i]];
    }
    return result !== undefined ? result : defaultVal;
  },

  // Capitalize first letter
  capitalize: function(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // Format number with commas
  formatNumber: function(num) {
    if (num === null || num === undefined) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // Format currency
  formatCurrency: function(amount, currency) {
    if (amount === null || amount === undefined) return '';
    return (currency || '$') + parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
};

// Backwards compatibility aliases (will be deprecated)
function escapeHtml(str) { return utils.escapeHtml(str); }
function formatTimeAgo(date) { return utils.timeAgo(date); }
function getTimeAgo(date) { return utils.timeAgo(date); }
// v12.0.0: formatTime12h takes "HH:MM" string and converts to "H:MM AM/PM"
function formatTime12h(time24) {
  if (!time24) return '';
  var parts = time24.split(':');
  var hours = parseInt(parts[0]);
  var mins = parts[1];
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return hours + ':' + mins + ' ' + ampm;
}

// v24.18: Format time string respecting user's 12h/24h preference
// Takes "HH:MM" 24h string and returns formatted per preference
function formatTimeDisplay(time24) {
  if (!time24) return '';
  var pref = localStorage.getItem('roweos_time_format') || '12h';
  if (pref === '24h') return time24;
  return formatTime12h(time24);
}

// v24.18: Format Date object's time respecting user's 12h/24h preference
function formatDateTimeDisplay(date) {
  if (!date) return '';
  var d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  var pref = localStorage.getItem('roweos_time_format') || '12h';
  if (pref === '24h') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS (CONST)
// Centralized constants for maintainability
// ─────────────────────────────────────────────────────────────────────────────────

var CONST = {
  // App version
  VERSION: '12.0.1',

  // View names
  VIEWS: {
    AGENT: 'agent',
    SIGNAL: 'signal',
    PULSE: 'pulse',
    STUDIO: 'studio',
    RHYTHM: 'rhythm',
    LIBRARY: 'library',
    MEMORY: 'memory',
    TUNING: 'tuning',
    SETTINGS: 'settings',
    INVENTORY: 'inventory',
    COMMERCE: 'commerce'
  },

  // App modes
  MODES: {
    BRAND: 'brand',
    LIFE: 'life'
  },

  // BrandAI Agents
  AGENTS: {
    STRATEGY: { id: 'strategy', name: 'Strategy', color: '#a78bfa' },
    MARKETING: { id: 'marketing', name: 'Marketing', color: '#f472b6' },
    OPERATIONS: { id: 'operations', name: 'Operations', color: '#4ade80' },
    DOCUMENTS: { id: 'documents', name: 'Documents', color: '#fbbf24' }
  },

  // LifeAI Coaches
  COACHES: {
    LIFE: { id: 'coach', name: 'Life Coach' },
    WELLNESS: { id: 'wellness', name: 'Wellness Coach' },
    TAX: { id: 'taxintelligence', name: 'Tax Intelligence' },
    PERSONAL: { id: 'personal', name: 'Personal AI' },
    STANDARD: { id: 'standard', name: 'Standard AI' }
  },

  // Theme
  THEMES: {
    DARK: 'dark',
    LIGHT: 'light'
  },

  // Sidebar behaviors
  SIDEBAR: {
    AUTO: 'auto',
    ALWAYS_OPEN: 'always-open',
    ALWAYS_COLLAPSED: 'always-collapsed'
  },

  // File/storage limits
  LIMITS: {
    MAX_FILE_SIZE: 5 * 1024 * 1024,      // 5MB
    MAX_CONVERSATION_LENGTH: 100,
    MAX_BRANDS: 10,
    MAX_CUSTOM_OPS: 50,
    TOAST_DURATION: 4000
  },

  // localStorage key names (without prefix)
  STORAGE_KEYS: {
    BRANDS: 'brands',
    API_KEYS: 'api_keys',
    MODE: 'app_mode',
    THEME: 'theme',
    CONVERSATIONS: 'conversations',
    SIDEBAR_BEHAVIOR: 'sidebar_behavior',
    SIDEBAR_COLLAPSED: 'sidebar_collapsed',
    CUSTOM_LOGO: 'custom_brand_logo',
    CUSTOM_LOGO_SIZE: 'custom_brand_logo_size',
    CALENDAR: 'calendar',
    AUTOMATIONS: 'automations',
    TODOS: 'Todos',
    TODO_CATEGORIES: 'todo_categories',
    RUNS: 'runs',
    CUSTOM_OPS: 'customOps',
    PINNED_OPS: 'pinnedOps',
    LIFE_LIBRARY: 'life_library',
    LIFE_PROFILES: 'life_profiles',
    LIFE_AGENT: 'life_agent'
  }
};

console.log('[RoweOS] Foundation layer loaded - v' + CONST.VERSION);

// ─────────────────────────────────────────────────────────────────────────────────
// v22.36: INDEXEDDB OVERFLOW STORAGE
// Transparent overflow layer — when localStorage is near capacity, large values
// spill to IndexedDB automatically. No data loss, no user-facing errors.
// ─────────────────────────────────────────────────────────────────────────────────
var _idb = null;
var _idbReady = false;
var _idbQueue = []; // queued writes before DB is ready

(function initIndexedDB() {
  if (!window.indexedDB) { console.warn('[Storage] IndexedDB not available'); return; }
  var req = indexedDB.open('RoweOS_Overflow', 1);
  req.onupgradeneeded = function(e) {
    var db = e.target.result;
    if (!db.objectStoreNames.contains('kv')) {
      db.createObjectStore('kv');
    }
  };
  req.onsuccess = function(e) {
    _idb = e.target.result;
    _idbReady = true;
    // Flush queued writes
    for (var i = 0; i < _idbQueue.length; i++) {
      _idbPut(_idbQueue[i].key, _idbQueue[i].value);
    }
    _idbQueue = [];
    console.log('[Storage] IndexedDB overflow store ready');
  };
  req.onerror = function() { console.warn('[Storage] IndexedDB init failed'); };
})();

function _idbPut(key, value) {
  if (!_idb) { _idbQueue.push({ key: key, value: value }); return; }
  try {
    var tx = _idb.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
  } catch(e) { console.warn('[Storage] IDB put error:', key, e.message); }
}

function _idbGet(key, callback) {
  if (!_idb) { callback(null); return; }
  try {
    var tx = _idb.transaction('kv', 'readonly');
    var req = tx.objectStore('kv').get(key);
    req.onsuccess = function() { callback(req.result !== undefined ? req.result : null); };
    req.onerror = function() { callback(null); };
  } catch(e) { callback(null); }
}

function _idbDelete(key) {
  if (!_idb) return;
  try {
    var tx = _idb.transaction('kv', 'readwrite');
    tx.objectStore('kv').delete(key);
  } catch(e) {}
}

// v22.36: Storage usage calculator
function _getStorageUsage() {
  var total = 0;
  for (var k in localStorage) {
    if (localStorage.hasOwnProperty(k)) {
      total += (localStorage[k].length + k.length) * 2;
    }
  }
  return total;
}

// v22.36: Keys tracked in IndexedDB (for getItem fallback)
var _idbKeys = {};
try {
  var _idbKeysList = localStorage.getItem('_roweos_idb_keys');
  if (_idbKeysList) _idbKeys = JSON.parse(_idbKeysList);
} catch(e) {}

function _markIdbKey(key) {
  _idbKeys[key] = 1;
  try { _origSetItem.call(localStorage, '_roweos_idb_keys', JSON.stringify(_idbKeys)); } catch(e) {}
}

function _unmarkIdbKey(key) {
  delete _idbKeys[key];
  try { _origSetItem.call(localStorage, '_roweos_idb_keys', JSON.stringify(_idbKeys)); } catch(e) {}
}

// v22.36: Safe localStorage.setItem — overflows to IndexedDB on QuotaExceeded
var _origSetItem = Storage.prototype.setItem;
var _origRemoveItem = Storage.prototype.removeItem;
var _origGetItemFn = Storage.prototype.getItem;

// Threshold: start offloading when over 4MB (of ~5MB limit)
var STORAGE_WARN_BYTES = 4 * 1024 * 1024;
// Keys eligible for offloading (large, non-critical-path data)
// NOTE: mail_outbox/mail_sent NOT included — they're small and UI reads them synchronously
var OVERFLOW_ELIGIBLE_KEYS = [
  'roweos_conversations', 'roweos_auto_lab_history', 'roweos_task_history',
  'roweos_completed_automations', 'roweos_library', 'roweos_life_library',
  'roweos_auto_lab_images', 'roweos_auto_lab_videos', 'roweos_bloom_history'
];

function safeSetItem(key, value) {
  try {
    _origSetItem.call(localStorage, key, value);
    // If this key was previously in IDB, remove it from there
    if (_idbKeys[key]) {
      _idbDelete(key);
      _unmarkIdbKey(key);
    }
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('[Storage] Quota exceeded on key:', key, '- offloading large items to IndexedDB');
      // Try to free space by offloading eligible large keys to IndexedDB
      var freed = _offloadLargestKeys();
      if (freed) {
        // Retry the original write
        try {
          _origSetItem.call(localStorage, key, value);
          return;
        } catch(e2) {
          // Still full — offload THIS key to IDB
        }
      }
      // Fallback: store this value in IndexedDB instead
      console.warn('[Storage] Storing', key, 'in IndexedDB overflow');
      _idbPut(key, value);
      _markIdbKey(key);
      // Remove from localStorage to free space
      try { _origRemoveItem.call(localStorage, key); } catch(e3) {}
      // v22.37: Silent — just log, no toast (fires too frequently)
      if (typeof ROWEOS_DEBUG !== 'undefined' && localStorage.getItem('roweos_debug') === 'true') {
        console.log('[Storage] Optimized:', key, '→ IndexedDB');
      }
    } else {
      throw e;
    }
  }
}

function _offloadLargestKeys() {
  // Find the largest eligible keys in localStorage and move them to IndexedDB
  var candidates = [];
  for (var i = 0; i < OVERFLOW_ELIGIBLE_KEYS.length; i++) {
    var k = OVERFLOW_ELIGIBLE_KEYS[i];
    var val = _origGetItemFn.call(localStorage, k);
    if (val && val.length > 1000) {
      candidates.push({ key: k, size: val.length, value: val });
    }
  }
  // Also check pattern-matched keys (brand-specific variants)
  for (var lk in localStorage) {
    if (localStorage.hasOwnProperty(lk)) {
      for (var j = 0; j < OVERFLOW_ELIGIBLE_KEYS.length; j++) {
        if (lk.indexOf(OVERFLOW_ELIGIBLE_KEYS[j]) === 0 && lk !== OVERFLOW_ELIGIBLE_KEYS[j]) {
          var v = _origGetItemFn.call(localStorage, lk);
          if (v && v.length > 1000) {
            candidates.push({ key: lk, size: v.length, value: v });
          }
        }
      }
    }
  }
  candidates.sort(function(a, b) { return b.size - a.size; });
  var freed = false;
  for (var c = 0; c < candidates.length; c++) {
    var cand = candidates[c];
    console.log('[Storage] Offloading', cand.key, '(' + Math.round(cand.size * 2 / 1024) + 'KB) to IndexedDB');
    _idbPut(cand.key, cand.value);
    _markIdbKey(cand.key);
    try { _origRemoveItem.call(localStorage, cand.key); } catch(e) {}
    freed = true;
  }
  return freed;
}

// v22.36: Override localStorage methods globally via Storage.prototype
// (Safari doesn't allow overriding instance methods directly)
Storage.prototype.setItem = function(key, value) {
  safeSetItem(key, value);
};

Storage.prototype.removeItem = function(key) {
  _origRemoveItem.call(this, key);
  if (_idbKeys[key]) {
    _idbDelete(key);
    _unmarkIdbKey(key);
  }
};

Storage.prototype.getItem = function(key) {
  var val = _origGetItemFn.call(this, key);
  if (val !== null) return val;
  if (_idbKeys[key]) {
    _idbGet(key, function(idbVal) {
      if (idbVal !== null) {
        try {
          _origSetItem.call(localStorage, key, idbVal);
          _idbDelete(key);
          _unmarkIdbKey(key);
          console.log('[Storage] Lazy-restored', key, 'from IndexedDB');
        } catch(e) { /* leave in IDB */ }
      }
    });
  }
  return val;
};

// v22.36: Storage health monitor — runs periodically
function checkStorageHealth() {
  var usage = _getStorageUsage();
  var usageMB = (usage / (1024 * 1024)).toFixed(2);
  var idbKeyCount = Object.keys(_idbKeys).length;
  if (usage > STORAGE_WARN_BYTES) {
    console.warn('[Storage] Usage high:', usageMB, 'MB / ~5MB.', idbKeyCount, 'keys in IndexedDB overflow');
    // Proactively offload before hitting the wall
    _offloadLargestKeys();
  }
  return { bytes: usage, mb: parseFloat(usageMB), idbKeys: idbKeyCount };
}

// v22.36: On boot, attempt to restore IDB overflow keys back to localStorage
function _restoreFromIdb() {
  var keys = Object.keys(_idbKeys);
  if (keys.length === 0) return;
  console.log('[Storage] Attempting to restore', keys.length, 'keys from IndexedDB');
  keys.forEach(function(key) {
    _idbGet(key, function(val) {
      if (val === null) { _unmarkIdbKey(key); return; }
      var usage = _getStorageUsage();
      var valSize = (val.length + key.length) * 2;
      // Only restore if we have room (keep 500KB buffer)
      if (usage + valSize < (4.5 * 1024 * 1024)) {
        try {
          _origSetItem.call(localStorage, key, val);
          _idbDelete(key);
          _unmarkIdbKey(key);
          console.log('[Storage] Restored', key, 'from IndexedDB to localStorage');
        } catch(e) { /* leave in IDB */ }
      }
    });
  });
}

// Run restore after IDB is ready, then health check
setTimeout(function() {
  if (_idbReady) _restoreFromIdb();
  else {
    var _waitRestore = setInterval(function() {
      if (_idbReady) { clearInterval(_waitRestore); _restoreFromIdb(); }
    }, 200);
    setTimeout(function() { clearInterval(_waitRestore); }, 5000);
  }
}, 1000);

// Run health check after init
setTimeout(checkStorageHealth, 5000);
// Run periodically (every 5 minutes)
setInterval(checkStorageHealth, 5 * 60 * 1000);

console.log('[RoweOS] Storage overflow system loaded');

// ─────────────────────────────────────────────────────────────────────────────────
// SVG ICON SYSTEM (ICONS + icon())
// Centralized icon library - no more inline SVGs
// ─────────────────────────────────────────────────────────────────────────────────

var ICONS = {
  // ─── Navigation ───
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',

  // ─── Actions ───
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  refresh: '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',

  // ─── Communication ───
  send: '<path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  message: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',

  // ─── Documents ───
  document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  folderOpen: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1"/><path d="M2 10h20l-2.5 9H4.5L2 10z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',

  // ─── UI Elements ───
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  chevronUp: '<polyline points="18 15 12 9 6 15"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  arrowDown: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  externalLink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  expand: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  collapse: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
  moreHorizontal: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  moreVertical: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',

  // ─── Status ───
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',

  // ─── Media ───
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  stop: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  volumeOff: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',

  // ─── Data ───
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  pieChart: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',

  // ─── Calendar/Time ───
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/><path d="M6.38 18.7L4 21"/><path d="M17.64 18.67L20 21"/>',

  // ─── People ───
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',

  // ─── Misc ───
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  starFilled: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  heartFilled: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor"/>',
  lightning: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  sparkles: '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z"/><path d="M19 10l.5 1.5L21 12l-1.5.5L19 14l-.5-1.5L17 12l1.5-.5L19 10z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  attach: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  bluetooth: '<polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>',
  battery: '<rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="13" x2="23" y2="11"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  toggleLeft: '<rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="8" cy="12" r="3"/>',
  toggleRight: '<rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="16" cy="12" r="3"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  bellOff: '<path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  share2: '<polyline points="15 3 21 3 21 9"/><line x1="21" y1="3" x2="14" y2="10"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  rotate: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  alertCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  minusCircle: '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
  plusCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
  sunrise: '<path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/>',
  sunset: '<path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="16 6 12 10 8 6"/>',
  thumbsUp: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  thumbsDown: '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  frown: '<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>'
};

/**
 * Generate SVG icon HTML
 * @param {string} name - Icon name from ICONS registry
 * @param {Object} opts - Optional settings
 * @param {number} opts.size - Icon size in pixels (default: 16)
 * @param {string} opts.class - Additional CSS class(es)
 * @param {string} opts.color - Stroke color (default: currentColor)
 * @param {number} opts.strokeWidth - Stroke width (default: 2)
 * @param {string} opts.fill - Fill color (default: none)
 * @param {string} opts.style - Additional inline styles
 * @returns {string} SVG HTML string
 */
function icon(name, opts) {
  opts = opts || {};
  var size = opts.size || 16;
  var className = opts.class ? 'icon ' + opts.class : 'icon';
  var color = opts.color || 'currentColor';
  var strokeWidth = opts.strokeWidth || 2;
  var fill = opts.fill || 'none';
  var style = opts.style || '';

  var path = ICONS[name];
  if (!path) {
    console.warn('[icon] Unknown icon:', name);
    return '<span class="icon-missing" title="Missing: ' + name + '">?</span>';
  }

  return '<svg class="' + className + '" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" ' +
         'fill="' + fill + '" stroke="' + color + '" stroke-width="' + strokeWidth + '" ' +
         'stroke-linecap="round" stroke-linejoin="round"' + (style ? ' style="' + style + '"' : '') + '>' +
         path + '</svg>';
}

// Shorthand functions for common sizes
function iconSm(name, opts) {
  return icon(name, Object.assign({ size: 14 }, opts || {}));
}

function iconMd(name, opts) {
  return icon(name, Object.assign({ size: 16 }, opts || {}));
}

function iconLg(name, opts) {
  return icon(name, Object.assign({ size: 20 }, opts || {}));
}

function iconXl(name, opts) {
  return icon(name, Object.assign({ size: 24 }, opts || {}));
}

console.log('[RoweOS] Icon system loaded - ' + Object.keys(ICONS).length + ' icons available');

// ═══════════════════════════════════════════════════════════════════════════════
// v12.0.0: MODAL SYSTEM
// Unified modal rendering and management
// ═══════════════════════════════════════════════════════════════════════════════

var modalRegistry = {};
var activeModals = [];

/**
 * Register a modal configuration
 */
function registerModal(id, config) {
  modalRegistry[id] = Object.assign({
    title: '',
    icon: null,
    width: 500,
    closable: true,
    closeOnBackdrop: true,
    render: function() { return ''; },
    footer: null,
    onOpen: null,
    onClose: null
  }, config);
}

/**
 * Open a modal by ID
 */
function openModal(id, data) {
  var config = modalRegistry[id];
  if (!config) {
    console.warn('[Modal] Unknown modal:', id);
    return null;
  }

  // Store data for later reference
  config._data = data || {};

  // Build modal HTML
  var html = '<div id="modal-' + id + '" class="modal-overlay modal-dynamic" data-modal-id="' + id + '" style="display: flex;">';
  html += '<div class="modal" style="max-width: ' + config.width + 'px;">';

  // Header
  if (config.title) {
    html += '<div class="modal-header">';
    html += '<div class="modal-title">';
    if (config.icon) {
      html += icon(config.icon, { size: 20 }) + ' ';
    }
    html += '<span>' + config.title + '</span>';
    html += '</div>';
    if (config.closable) {
      html += '<button class="modal-close" onclick="closeModal(\'' + id + '\')">' + icon('close') + '</button>';
    }
    html += '</div>';
  }

  // Body
  html += '<div class="modal-body">';
  html += config.render(config._data);
  html += '</div>';

  // Footer (optional)
  if (config.footer) {
    html += '<div class="modal-footer">';
    html += config.footer(config._data);
    html += '</div>';
  }

  html += '</div></div>';

  // Insert into DOM
  var container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container.firstChild);

  // Track active modal
  activeModals.push(id);

  // Backdrop click handler
  var overlay = document.getElementById('modal-' + id);
  if (overlay && config.closeOnBackdrop) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        closeModal(id);
      }
    });
  }

  // Callback
  if (config.onOpen) {
    setTimeout(function() {
      config.onOpen(config._data);
    }, 0);
  }

  return overlay;
}

/**
 * Close a modal by ID
 */
function closeModal(id) {
  var overlay = document.getElementById('modal-' + id);
  if (!overlay) return;

  var config = modalRegistry[id];

  // Remove from DOM
  if (overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }

  // Remove from active list
  var idx = activeModals.indexOf(id);
  if (idx > -1) activeModals.splice(idx, 1);

  // Callback
  if (config && config.onClose) {
    config.onClose(config._data);
  }
}

/**
 * Close all open dynamic modals
 */
function closeAllModals() {
  activeModals.slice().forEach(function(id) {
    closeModal(id);
  });
}

/**
 * Get data passed to currently open modal
 */
function getModalData(id) {
  var config = modalRegistry[id];
  return config ? config._data : null;
}

/**
 * Update modal body content dynamically
 */
function updateModalBody(id, html) {
  var modal = document.getElementById('modal-' + id);
  if (!modal) return;
  var body = modal.querySelector('.modal-body');
  if (body) body.innerHTML = html;
}

/**
 * Check if a modal is currently open
 */
function isModalOpen(id) {
  return activeModals.indexOf(id) !== -1;
}

console.log('[RoweOS] Modal system loaded');

// ═══════════════════════════════════════════════════════════════════════════════
// v12.0.0: FORM COMPONENTS
// Reusable form field generators for consistent UI
// ═══════════════════════════════════════════════════════════════════════════════

var form = {
  /**
   * Generate a form field
   * @param {Object} config - Field configuration
   * @param {string} config.type - Field type (text, email, password, number, url, textarea, select, toggle, checkbox, radio, range, color)
   * @param {string} config.id - Field ID
   * @param {string} config.label - Field label
   * @param {string} config.value - Current value
   * @param {string} config.placeholder - Placeholder text
   * @param {boolean} config.required - Is field required
   * @param {boolean} config.disabled - Is field disabled
   * @param {boolean} config.readonly - Is field readonly
   * @param {string} config.hint - Hint text below field
   * @param {string} config.error - Error message
   * @param {string} config.onchange - Onchange handler
   * @param {Array} config.options - Options for select/radio
   */
  field: function(config) {
    var id = config.id || utils.generateId('field');
    var required = config.required ? ' *' : '';
    var html = '<div class="form-group' + (config.inline ? ' form-group-inline' : '') + '">';

    // Label
    if (config.label) {
      html += '<label class="form-label" for="' + id + '">' + config.label + required;
      if (config.labelHint) {
        html += ' <span class="form-label-hint">(' + config.labelHint + ')</span>';
      }
      html += '</label>';
    }

    // Field based on type
    switch (config.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
      case 'url':
        html += '<input type="' + config.type + '" id="' + id + '" class="form-input' + (config.error ? ' error' : '') + '"';
        if (config.value !== undefined) html += ' value="' + utils.escapeHtml(config.value) + '"';
        if (config.placeholder) html += ' placeholder="' + config.placeholder + '"';
        if (config.disabled) html += ' disabled';
        if (config.readonly) html += ' readonly';
        if (config.maxlength) html += ' maxlength="' + config.maxlength + '"';
        if (config.min !== undefined) html += ' min="' + config.min + '"';
        if (config.max !== undefined) html += ' max="' + config.max + '"';
        if (config.step) html += ' step="' + config.step + '"';
        if (config.onchange) html += ' onchange="' + config.onchange + '"';
        if (config.oninput) html += ' oninput="' + config.oninput + '"';
        html += '>';
        break;

      case 'textarea':
        html += '<textarea id="' + id + '" class="form-textarea' + (config.error ? ' error' : '') + '"';
        if (config.placeholder) html += ' placeholder="' + config.placeholder + '"';
        if (config.disabled) html += ' disabled';
        if (config.readonly) html += ' readonly';
        if (config.rows) html += ' rows="' + config.rows + '"';
        if (config.onchange) html += ' onchange="' + config.onchange + '"';
        html += '>' + utils.escapeHtml(config.value || '') + '</textarea>';
        break;

      case 'select':
        html += '<select id="' + id + '" class="form-select' + (config.error ? ' error' : '') + '"';
        if (config.disabled) html += ' disabled';
        if (config.onchange) html += ' onchange="' + config.onchange + '"';
        html += '>';
        if (config.placeholder) {
          html += '<option value="">' + config.placeholder + '</option>';
        }
        (config.options || []).forEach(function(opt) {
          var optValue = typeof opt === 'object' ? opt.value : opt;
          var optLabel = typeof opt === 'object' ? opt.label : opt;
          var selected = String(optValue) === String(config.value) ? ' selected' : '';
          var disabled = opt.disabled ? ' disabled' : '';
          html += '<option value="' + optValue + '"' + selected + disabled + '>' + optLabel + '</option>';
        });
        html += '</select>';
        break;

      case 'toggle':
        html += '<label class="toggle-switch">';
        html += '<input type="checkbox" id="' + id + '"';
        if (config.checked) html += ' checked';
        if (config.disabled) html += ' disabled';
        if (config.onchange) html += ' onchange="' + config.onchange + '"';
        html += '>';
        html += '<span class="toggle-slider"></span>';
        html += '</label>';
        break;

      case 'checkbox':
        html += '<label class="checkbox-label">';
        html += '<input type="checkbox" id="' + id + '" class="form-checkbox"';
        if (config.checked) html += ' checked';
        if (config.disabled) html += ' disabled';
        if (config.onchange) html += ' onchange="' + config.onchange + '"';
        html += '>';
        html += '<span class="checkbox-text">' + (config.checkboxLabel || '') + '</span>';
        html += '</label>';
        break;

      case 'radio':
        (config.options || []).forEach(function(opt) {
          var optValue = typeof opt === 'object' ? opt.value : opt;
          var optLabel = typeof opt === 'object' ? opt.label : opt;
          var checked = String(optValue) === String(config.value) ? ' checked' : '';
          html += '<label class="radio-label">';
          html += '<input type="radio" name="' + id + '" value="' + optValue + '"' + checked;
          if (config.onchange) html += ' onchange="' + config.onchange + '"';
          html += '>';
          html += '<span class="radio-text">' + optLabel + '</span>';
          html += '</label>';
        });
        break;

      case 'range':
        html += '<div class="form-range-wrapper">';
        html += '<input type="range" id="' + id + '" class="form-range"';
        if (config.value !== undefined) html += ' value="' + config.value + '"';
        if (config.min !== undefined) html += ' min="' + config.min + '"';
        if (config.max !== undefined) html += ' max="' + config.max + '"';
        if (config.step) html += ' step="' + config.step + '"';
        if (config.oninput) html += ' oninput="' + config.oninput + '"';
        html += '>';
        if (config.showValue) {
          html += '<span class="form-range-value" id="' + id + '-value">' + (config.value || config.min || 0) + '</span>';
        }
        html += '</div>';
        break;

      case 'color':
        html += '<div class="form-color-wrapper">';
        html += '<input type="color" id="' + id + '" class="form-color"';
        if (config.value) html += ' value="' + config.value + '"';
        if (config.onchange) html += ' onchange="' + config.onchange + '"';
        html += '>';
        html += '</div>';
        break;
    }

    // Hint text
    if (config.hint) {
      html += '<div class="form-hint">' + config.hint + '</div>';
    }

    // Error message
    if (config.error) {
      html += '<div class="form-error">' + config.error + '</div>';
    }

    html += '</div>';
    return html;
  },

  /**
   * Generate a row of fields (for multi-column layouts)
   */
  row: function(fields, options) {
    var opts = options || {};
    var cols = opts.cols || fields.length;
    var html = '<div class="form-row form-row-' + cols + '">';
    var self = this;
    fields.forEach(function(field) {
      html += self.field(field);
    });
    html += '</div>';
    return html;
  },

  /**
   * Generate a button
   */
  button: function(config) {
    var type = config.type || 'button';
    var variant = config.variant || 'secondary';
    var size = config.size || '';
    var className = 'btn btn-' + variant + (size ? ' btn-' + size : '');
    if (config.class) className += ' ' + config.class;

    var html = '<button type="' + type + '" class="' + className + '"';
    if (config.id) html += ' id="' + config.id + '"';
    if (config.disabled) html += ' disabled';
    if (config.onclick) html += ' onclick="' + config.onclick + '"';
    if (config.style) html += ' style="' + config.style + '"';
    html += '>';
    if (config.icon) html += icon(config.icon, { size: 14 }) + ' ';
    html += config.label || '';
    html += '</button>';

    return html;
  },

  /**
   * Generate a row of buttons
   */
  buttons: function(buttons, options) {
    var opts = options || {};
    var align = opts.align || 'right';
    var html = '<div class="form-buttons form-buttons-' + align + '">';
    var self = this;
    buttons.forEach(function(btn) {
      html += self.button(btn);
    });
    html += '</div>';
    return html;
  },

  /**
   * Get value from a form field
   */
  getValue: function(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  },

  /**
   * Set value of a form field
   */
  setValue: function(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!value;
    } else {
      el.value = value;
    }
  }
};

console.log('[RoweOS] Form components loaded');

// ═══════════════════════════════════════════════════════════════════════════════
// v12.0.0: RENDER UTILITIES
// Generic rendering functions for lists, cards, tables, and common patterns
// ═══════════════════════════════════════════════════════════════════════════════

var render = {
  /**
   * Render a grid of cards
   */
  cardGrid: function(containerId, items, cardRenderer, options) {
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = opts.emptyState || '<div class="empty-state">No items found</div>';
      return;
    }

    var html = items.map(function(item, idx) {
      return cardRenderer(item, idx);
    }).join('');

    container.innerHTML = html;

    if (opts.onRendered) {
      opts.onRendered(container);
    }
  },

  /**
   * Render a list
   */
  list: function(containerId, items, itemRenderer, options) {
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = opts.emptyState || '<div class="empty-state">No items</div>';
      return;
    }

    var html = '<ul class="' + (opts.listClass || 'item-list') + '">';
    items.forEach(function(item, idx) {
      html += '<li class="' + (opts.itemClass || 'item') + '">' + itemRenderer(item, idx) + '</li>';
    });
    html += '</ul>';

    container.innerHTML = html;
  },

  /**
   * Render a data table
   */
  table: function(containerId, data, columns, options) {
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = opts.emptyState || '<div class="empty-state">No data</div>';
      return;
    }

    var html = '<table class="data-table">';

    // Header
    html += '<thead><tr>';
    columns.forEach(function(col) {
      html += '<th>' + (col.label || col.key) + '</th>';
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    data.forEach(function(row, rowIdx) {
      html += '<tr>';
      columns.forEach(function(col) {
        var value = row[col.key];
        if (col.render) {
          value = col.render(value, row, rowIdx);
        }
        html += '<td>' + (value !== undefined && value !== null ? value : '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;
  },

  /**
   * Render file chips (used in agent file attachments, library, etc.)
   */
  fileChips: function(containerId, files, options) {
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    if (!files || files.length === 0) {
      container.innerHTML = '';
      return;
    }

    var html = files.map(function(file) {
      var statusText = '';
      var statusClass = file.status || 'ready';

      if (file.status === 'loading') statusText = 'Reading...';
      else if (file.status === 'ready') statusText = file.pages ? file.pages + ' pages' : '';
      else if (file.status === 'error') statusText = 'Error';

      return '<div class="file-chip ' + statusClass + '" data-file-id="' + (file.id || '') + '">' +
        '<span class="file-chip-icon">' + render.fileIcon(file.name) + '</span>' +
        '<span class="file-chip-name" title="' + utils.escapeHtml(file.name) + '">' + utils.escapeHtml(file.name) + '</span>' +
        (statusText ? '<span class="file-chip-status">' + statusText + '</span>' : '') +
        '<button class="file-chip-remove" onclick="' + (opts.onRemove || 'removeFile') + '(\'' + (file.id || '') + '\')" title="Remove">' + icon('close', { size: 12 }) + '</button>' +
      '</div>';
    }).join('');

    container.innerHTML = html;
  },

  /**
   * Get icon for file type based on extension
   */
  fileIcon: function(filename) {
    var ext = (filename || '').toLowerCase().split('.').pop();
    var iconName = 'file';

    if (ext === 'pdf') iconName = 'document';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].indexOf(ext) !== -1) iconName = 'image';
    else if (['csv', 'xlsx', 'xls'].indexOf(ext) !== -1) iconName = 'chart';
    else if (['mp3', 'wav', 'ogg', 'm4a'].indexOf(ext) !== -1) iconName = 'mic';
    else if (['mp4', 'mov', 'avi', 'webm'].indexOf(ext) !== -1) iconName = 'play';
    else if (['zip', 'rar', 'tar', 'gz'].indexOf(ext) !== -1) iconName = 'folder';
    else if (['doc', 'docx', 'txt', 'rtf'].indexOf(ext) !== -1) iconName = 'document';

    return icon(iconName, { size: 14 });
  },

  /**
   * Render a stats card
   */
  statCard: function(config) {
    return '<div class="stat-card">' +
      '<div class="stat-card-icon">' + (config.icon ? icon(config.icon, { size: 20 }) : '') + '</div>' +
      '<div class="stat-card-content">' +
        '<div class="stat-card-value">' + (config.value || '0') + '</div>' +
        '<div class="stat-card-label">' + (config.label || '') + '</div>' +
      '</div>' +
    '</div>';
  },

  /**
   * Render an empty state with icon and message
   */
  emptyState: function(config) {
    return '<div class="empty-state">' +
      (config.icon ? '<div class="empty-state-icon">' + icon(config.icon, { size: 48, color: 'var(--text-muted)' }) + '</div>' : '') +
      '<div class="empty-state-title">' + (config.title || 'No items') + '</div>' +
      (config.message ? '<div class="empty-state-message">' + config.message + '</div>' : '') +
      (config.action ? '<button class="btn btn-primary" onclick="' + config.action.onclick + '">' + config.action.label + '</button>' : '') +
    '</div>';
  },

  /**
   * Render a loading state
   */
  loading: function(message) {
    return '<div class="loading-state">' +
      '<div class="loading-spinner"></div>' +
      '<div class="loading-message">' + (message || 'Loading...') + '</div>' +
    '</div>';
  }
};

console.log('[RoweOS] Render utilities loaded');

// ═══════════════════════════════════════════════════════════════════════════════
// v12.0.0: EVENT DELEGATION
// Centralized event handling for cleaner HTML
// ═══════════════════════════════════════════════════════════════════════════════

var actions = {};

/**
 * Register an action handler
 * @param {string} name - Action name (used in data-action attribute)
 * @param {function} handler - Handler function receiving (dataset, event, element)
 */
function registerAction(name, handler) {
  actions[name] = handler;
}

/**
 * Initialize delegated event listeners
 * Call this once on DOMContentLoaded
 */
function initEventDelegation() {
  // Click delegation
  document.addEventListener('click', function(e) {
    var actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      var actionName = actionEl.dataset.action;
      var handler = actions[actionName];
      if (handler) {
        e.preventDefault();
        handler(actionEl.dataset, e, actionEl);
      }
    }
  });

  // Change delegation
  document.addEventListener('change', function(e) {
    var actionEl = e.target.closest('[data-change]');
    if (actionEl) {
      var actionName = actionEl.dataset.change;
      var handler = actions[actionName];
      if (handler) {
        handler(actionEl.dataset, e, actionEl);
      }
    }
  });

  // Input delegation (for live updates)
  document.addEventListener('input', function(e) {
    var actionEl = e.target.closest('[data-input]');
    if (actionEl) {
      var actionName = actionEl.dataset.input;
      var handler = actions[actionName];
      if (handler) {
        handler(actionEl.dataset, e, actionEl);
      }
    }
  });

  // Submit delegation
  document.addEventListener('submit', function(e) {
    var actionEl = e.target.closest('[data-submit]');
    if (actionEl) {
      var actionName = actionEl.dataset.submit;
      var handler = actions[actionName];
      if (handler) {
        e.preventDefault();
        handler(actionEl.dataset, e, actionEl);
      }
    }
  });

  console.log('[RoweOS] Event delegation initialized');
}

// Register common built-in actions
registerAction('show-view', function(data) {
  if (data.view && typeof showView === 'function') {
    showView(data.view);
  }
});

registerAction('toggle-sidebar', function() {
  if (typeof toggleSidebar === 'function') {
    toggleSidebar();
  }
});

registerAction('select-brand', function(data) {
  if (data.brand && typeof selectBrandFromDropdown === 'function') {
    selectBrandFromDropdown(data.brand);  // v29.0: Accept ID or index
  }
});

registerAction('toggle-theme', function() {
  if (typeof toggleTheme === 'function') {
    toggleTheme();
  }
});

registerAction('toggle-mode', function() {
  if (typeof toggleMode === 'function') {
    toggleMode();
  }
});

registerAction('copy-text', function(data, e, el) {
  var textToCopy = data.text || el.textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(textToCopy).then(function() {
      if (typeof showToast === 'function') {
        showToast('Copied to clipboard', 'success');
      }
    });
  }
});

console.log('[RoweOS] Event delegation loaded - ' + Object.keys(actions).length + ' actions registered');

// ═══════════════════════════════════════════════════════════════════════════════
// END FOUNDATION LAYER
// ═══════════════════════════════════════════════════════════════════════════════
