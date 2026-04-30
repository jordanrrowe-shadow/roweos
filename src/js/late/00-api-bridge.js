// ============================================
// RoweOS v6.0 API Bridge
// Provides window.roweosAPI for browser operation
// Replaces Electron IPC with direct fetch() calls
// v16.0: Converted to ES5 (var, no arrow functions, no template literals)
// ============================================

(function() {
  'use strict';

  // Skip if already defined (Electron preload)
  if (window.roweosAPI && window.roweosAPI.isElectron) {
    console.log('Brilliance: Electron API detected, skipping browser bridge');
    return;
  }

  // API Provider configs
  var PROVIDERS = {
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1/messages',
      models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001']
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1/responses',
      models: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.5-thinking']
    },
    google: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
      models: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview']
    }
  };

  // Event callbacks
  var streamCallbacks = {
    onChunk: [],
    onComplete: [],
    onError: [],
    onDebugLog: []
  };

  // Helper: emit debug log
  function debugLog(message, data) {
    console.log('[Brilliance API]', message, data || '');
    streamCallbacks.onDebugLog.forEach(function(cb) { cb(message, data); });
  }

  // API Key storage (obfuscated in localStorage)
  function getApiKey(provider) {
    // Check main storage first (roweos_api_keys)
    var storedKeys = localStorage.getItem("roweos_api_keys");
    if (storedKeys) {
      try {
        var apiKeys = JSON.parse(storedKeys);
        if (apiKeys[provider]) return apiKeys[provider];
      } catch (e) { /* ignore */ }
    }
    // Fallback to old format
    var key = localStorage.getItem('roweos_' + provider + '_key');
    if (!key) return null;
    try { return atob(key); } catch(e) { return key; }
  }

  function setApiKey(provider, key) {
    if (key) {
      // Save to main storage
      var storedKeys = localStorage.getItem("roweos_api_keys");
      var apiKeys = storedKeys ? JSON.parse(storedKeys) : {};
      apiKeys[provider] = key;
      localStorage.setItem("roweos_api_keys", JSON.stringify(apiKeys));
      // Also save to old format for compatibility
      localStorage.setItem('roweos_' + provider + '_key', btoa(key));
    } else {
      var storedKeys2 = localStorage.getItem("roweos_api_keys");
      if (storedKeys2) {
        var apiKeys2 = JSON.parse(storedKeys2);
        delete apiKeys2[provider];
        localStorage.setItem("roweos_api_keys", JSON.stringify(apiKeys2));
      }
      localStorage.removeItem('roweos_' + provider + '_key');
    }
  }

  // Anthropic streaming
  async function callAnthropicStream(messages, model, systemPrompt, onChunk) {
    var apiKey = getApiKey('anthropic');
    if (!apiKey) throw new Error('Anthropic API key not configured');

    debugLog('Calling Anthropic', { model: model, messageCount: messages.length });

    var response = await fetch(PROVIDERS.anthropic.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: systemPrompt || 'You are a helpful AI assistant.',
        messages: messages,
        stream: true
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error('Anthropic API error: ' + response.status + ' - ' + errText);
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var fullContent = '';
    var buffer = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('data: ')) {
          var data = lines[i].slice(6);
          if (data === '[DONE]') continue;

          try {
            var parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
              fullContent += parsed.delta.text;
              onChunk(parsed.delta.text);
              streamCallbacks.onChunk.forEach(function(cb) { cb(parsed.delta.text); });
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }
    }

    return fullContent;
  }

  // OpenAI streaming
  async function callOpenAIStream(messages, model, systemPrompt, onChunk) {
    var apiKey = getApiKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not configured');

    debugLog('Calling OpenAI', { model: model, messageCount: messages.length });

    var allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }].concat(messages)
      : messages;

    var response = await fetch(PROVIDERS.openai.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model || 'gpt-5.5',
        messages: allMessages,
        stream: true
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error('OpenAI API error: ' + response.status + ' - ' + errText);
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var fullContent = '';
    var buffer = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('data: ')) {
          var data = lines[i].slice(6);
          if (data === '[DONE]') continue;

          try {
            var parsed = JSON.parse(data);
            var content = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content;
            if (content) {
              fullContent += content;
              onChunk(content);
              streamCallbacks.onChunk.forEach(function(cb) { cb(content); });
            }
          } catch (e) { /* ignore */ }
        }
      }
    }

    return fullContent;
  }

  // Google Gemini streaming
  async function callGoogleStream(messages, model, systemPrompt, onChunk) {
    var apiKey = getApiKey('google');
    if (!apiKey) throw new Error('Google API key not configured');

    debugLog('Calling Google', { model: model, messageCount: messages.length });

    var modelId = model || 'gemini-3-flash-preview';
    var url = PROVIDERS.google.baseUrl + '/' + modelId + ':streamGenerateContent?key=' + apiKey + '&alt=sse';

    // v24.25: Try context caching for conversations with 3+ messages
    var cacheEntry = null;
    var body = {};
    if (messages.length >= 3 && typeof _getOrCreateGeminiCache === 'function' && typeof _geminiSupportsCaching === 'function' && _geminiSupportsCaching(modelId)) {
      var lastUserIdx = -1;
      for (var ci = messages.length - 1; ci >= 0; ci--) {
        if (messages[ci].role === 'user') { lastUserIdx = ci; break; }
      }
      if (lastUserIdx > 0) {
        cacheEntry = await _getOrCreateGeminiCache(modelId, apiKey, systemPrompt, messages.slice(0, lastUserIdx));
      }
    }

    if (cacheEntry) {
      body = {
        cachedContent: cacheEntry.name,
        contents: _buildGeminiContents(messages.slice(-1)),
        generationConfig: { maxOutputTokens: 8192 }
      };
    } else {
      body = {
        contents: _buildGeminiContents(messages),
        generationConfig: { maxOutputTokens: 8192 }
      };
      if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
      }
    }

    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error('Google API error: ' + response.status + ' - ' + errText);
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var fullContent = '';
    var buffer = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('data: ')) {
          try {
            var parsed = JSON.parse(lines[i].slice(6));
            var text = parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts && parsed.candidates[0].content.parts[0] && parsed.candidates[0].content.parts[0].text;
            if (text) {
              fullContent += text;
              onChunk(text);
              streamCallbacks.onChunk.forEach(function(cb) { cb(text); });
            }
          } catch (e) { /* ignore */ }
        }
      }
    }

    return fullContent;
  }

  // Main API bridge object
  window.roweosAPI = {
    isElectron: false,
    platform: navigator.platform.toLowerCase().indexOf('mac') !== -1 ? 'darwin' :
              navigator.platform.toLowerCase().indexOf('win') !== -1 ? 'win32' : 'linux',
    version: '12.2',

    // API key management
    getApiKey: function(provider) {
      return Promise.resolve(getApiKey(provider));
    },

    setApiKey: function(provider, key) {
      setApiKey(provider, key);
      return Promise.resolve({ success: true });
    },

    hasApiKey: function(provider) {
      return Promise.resolve(!!getApiKey(provider));
    },

    // Streaming AI calls
    streamMessage: async function(opts) {
      var chunkHandler = opts.onChunk || function() {};

      try {
        var result;
        switch (opts.provider) {
          case 'anthropic':
            result = await callAnthropicStream(opts.messages, opts.model, opts.systemPrompt, chunkHandler);
            break;
          case 'openai':
            result = await callOpenAIStream(opts.messages, opts.model, opts.systemPrompt, chunkHandler);
            break;
          case 'google':
            result = await callGoogleStream(opts.messages, opts.model, opts.systemPrompt, chunkHandler);
            break;
          default:
            throw new Error('Unknown provider: ' + opts.provider);
        }

        streamCallbacks.onComplete.forEach(function(cb) { cb(result); });
        return { success: true, content: result };
      } catch (err) {
        streamCallbacks.onError.forEach(function(cb) { cb(err.message); });
        return { success: false, error: err.message };
      }
    },

    // Non-streaming AI call
    sendMessage: async function(opts) {
      var fullContent = '';
      var result = await this.streamMessage({
        provider: opts.provider, model: opts.model, messages: opts.messages, systemPrompt: opts.systemPrompt,
        onChunk: function(chunk) { fullContent += chunk; }
      });
      return result;
    },

    // Event listeners
    onStreamChunk: function(callback) {
      streamCallbacks.onChunk.push(callback);
    },

    onStreamComplete: function(callback) {
      streamCallbacks.onComplete.push(callback);
    },

    onStreamError: function(callback) {
      streamCallbacks.onError.push(callback);
    },

    onDebugLog: function(callback) {
      streamCallbacks.onDebugLog.push(callback);
    },

    removeStreamListeners: function() {
      streamCallbacks.onChunk = [];
      streamCallbacks.onComplete = [];
      streamCallbacks.onError = [];
    },

    // File operations (browser-based)
    saveFile: async function(opts) {
      try {
        var blob = new Blob([opts.content], { type: opts.type || 'text/plain' });
        var blobUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = opts.filename || 'download.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // Window controls (no-op in browser)
    minimizeWindow: function() { return Promise.resolve(); },
    maximizeWindow: function() { return Promise.resolve(); },
    closeWindow: function() { window.close(); return Promise.resolve(); },

    // App info
    getVersion: function() {
      return Promise.resolve('6.1.0');
    }
  };

  console.log('Brilliance API Bridge v6.0 initialized (Browser Mode)');

})();

// ═══════════════════════════════════════════════════════════
// v11.5.4 - Collapsible Glass Sidebar (Three-State Pin)
// ═══════════════════════════════════════════════════════════
// States: 0 = unpinned (hover-expand), 1 = pinned-expanded, 2 = pinned-collapsed
// Cycle:  0 → 1 → 2 → 0
(function() {
  'use strict';

  var sidebar = document.querySelector('.sidebar');
  var pinBtn  = document.getElementById('sidebarPinBtn');
  var STORAGE_KEY = 'sidebarPinned';
  var hoverTimer  = null;

  if (!sidebar) return;

  // ─── State Management ───────────────────────────────────
  // Reads '0', '1', or '2' from localStorage (backward-compatible)
  function getState() {
    var val = localStorage.getItem(STORAGE_KEY);
    if (val === '1') return 1;
    if (val === '2') return 2;
    return 0;
  }

  function applyState() {
    var state = getState();
    // Clear all states first
    sidebar.classList.remove('pinned', 'expanded', 'pinned-collapsed');
    document.documentElement.classList.remove('sidebar-pinned', 'sidebar-pinned-collapsed', 'sidebar-hover-expanded');
    if (pinBtn) pinBtn.classList.remove('active');
    clearTimeout(hoverTimer);

    if (state === 1) {
      // Pinned expanded: full width, locked open
      sidebar.classList.add('pinned', 'expanded');
      document.documentElement.classList.add('sidebar-pinned');
      if (pinBtn) {
        pinBtn.classList.add('active');
        pinBtn.title = 'Pin collapsed (⌘\\)';
      }
    } else if (state === 2) {
      // Pinned collapsed: icon-only width, locked, no hover
      sidebar.classList.add('pinned-collapsed');
      document.documentElement.classList.add('sidebar-pinned-collapsed');
      if (pinBtn) {
        pinBtn.classList.add('active');
        pinBtn.title = 'Unpin sidebar (⌘\\)';
      }
    } else {
      // Unpinned: hover expand
      if (pinBtn) pinBtn.title = 'Pin sidebar open (⌘\\)';
    }
    
    // v12.2.4: Re-apply brand logo to ensure collapsed logo is updated
    if (typeof loadCurrentLogo === 'function') {
      loadCurrentLogo();
    }
    // v31.5: Recompute zoom-time sidebar margin compensation since sidebar width changed.
    // Defer past the CSS transition so getBoundingClientRect reads the post-transition width.
    if (typeof applyAccessibilityScale === 'function') {
      setTimeout(function() { try { applyAccessibilityScale(); } catch(e) {} }, 320);
    }
  }

  // ─── Pin Toggle: Cycle 0 → 1 → 2 → 0 ──────────────────
  window.toggleSidebarPin = function() {
    var state = getState();
    var next = (state + 1) % 3;
    localStorage.setItem(STORAGE_KEY, String(next));
    applyState();
  };

  // v11.5.4: Direct sidebar behavior control from settings
  window.changeSidebarBehavior = function(value) {
    var state = parseInt(value);
    localStorage.setItem(STORAGE_KEY, String(state));
    applyState();
    showToast('Sidebar behavior updated', 'success');
  };

  // v13.9: Sidebar text color preference
  window.changeSidebarTextColor = function(value) {
    localStorage.setItem('roweos_sidebar_text_color', value);
    if (value === 'white') {
      document.documentElement.classList.add('sidebar-text-white');
    } else {
      document.documentElement.classList.remove('sidebar-text-white');
    }
    showToast('Sidebar text color updated', 'success');
  };
  // Apply saved preference on load
  var savedTextColor = localStorage.getItem('roweos_sidebar_text_color') || 'grey';
  if (savedTextColor === 'white') {
    document.documentElement.classList.add('sidebar-text-white');
  }
  var textColorSelect = document.getElementById('sidebarTextColorSelect');
  if (textColorSelect) textColorSelect.value = savedTextColor;

  // v24.24: Logo shape slider (0=circle, 100=square)
  window.setLogoShapeSlider = function(val) {
    var v = parseInt(val);
    var radius = Math.round(50 - (v * 28 / 100));
    document.documentElement.style.setProperty('--logo-radius', radius + '%');
    localStorage.setItem('roweos_logo_shape_val', v);
    var label = document.getElementById('logoShapeLabel');
    if (label) label.textContent = v === 0 ? 'Circle' : v >= 90 ? 'Square' : 'Squircle';
  };
  // Legacy compat
  window.changeLogoShape = function(value) {
    var v = value === 'squircle' ? 60 : 0;
    setLogoShapeSlider(v);
    var slider = document.getElementById('logoShapeSlider');
    if (slider) slider.value = v;
  };
  function applyLogoShape(shape) {
    var radius = shape === 'squircle' ? '22%' : '50%';
    document.documentElement.style.setProperty('--logo-radius', radius);
  }
  // Init shape slider from saved value
  var savedShapeVal = localStorage.getItem('roweos_logo_shape_val');
  if (savedShapeVal !== null) {
    setLogoShapeSlider(savedShapeVal);
    var shapeSlider = document.getElementById('logoShapeSlider');
    if (shapeSlider) shapeSlider.value = savedShapeVal;
  } else {
    var savedLogoShape = localStorage.getItem('roweos_logo_shape') || 'circle';
    applyLogoShape(savedLogoShape);
    if (savedLogoShape === 'squircle') {
      var shapeSlider2 = document.getElementById('logoShapeSlider');
      if (shapeSlider2) shapeSlider2.value = 60;
      var label2 = document.getElementById('logoShapeLabel');
      if (label2) label2.textContent = 'Squircle';
    }
  }

  // v24.18: Time Format preference
  window.changeTimeFormat = function(value) {
    localStorage.setItem('roweos_time_format', value);
    showToast('Time format set to ' + (value === '24h' ? '24-hour' : '12-hour'), 'success');
    writeDB('profile/main', { timeFormat: value }); // v25.1
  };
  var savedTimeFormat = localStorage.getItem('roweos_time_format') || '12h';
  var timeFormatSelect = document.getElementById('timeFormatSelect');
  if (timeFormatSelect) timeFormatSelect.value = savedTimeFormat;

  // v11.5.4: Initialize dropdown with current state
  window.updateSidebarBehaviorDropdown = function() {
    var dropdown = document.getElementById('sidebarBehaviorSelect');
    if (dropdown) {
      dropdown.value = String(getState());
    }
  };

  // v11.5.4: Removed click-to-expand on pinned-collapsed
  // Use pin button (⌘\) or settings dropdown to change sidebar state

  // ─── Hover Expand / Collapse (only when unpinned, desktop only) ───────
  // v12.2.4: Helper to check if on mobile
  function isMobileDevice() {
    return window.innerWidth <= 768 || ('ontouchstart' in window);
  }

  sidebar.addEventListener('mouseenter', function() {
    if (isMobileDevice()) return;  // v12.2.4: Skip hover on mobile
    if (getState() !== 0) return;  // Skip hover if pinned in any state
    clearTimeout(hoverTimer);
    sidebar.classList.add('expanded');
    // v11.5.4: Shift content when sidebar expands in auto mode
    document.documentElement.classList.add('sidebar-hover-expanded');
  });

  sidebar.addEventListener('mouseleave', function() {
    if (isMobileDevice()) return;  // v12.2.4: Skip hover on mobile
    if (getState() !== 0) return;
    hoverTimer = setTimeout(function() {
      sidebar.classList.remove('expanded');
      // v11.5.4: Shift content back when sidebar collapses
      document.documentElement.classList.remove('sidebar-hover-expanded');
      // v15.4: Close brand dropdown when sidebar collapses
      var dd = document.getElementById('sidebarBrandDropdown');
      if (dd) dd.classList.remove('active');
    }, 200);
  });

  // ─── Keyboard Shortcut: Cmd/Ctrl + \ ───────────────────
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault();
      window.toggleSidebarPin();
    }
  });

  // ─── Initialize ─────────────────────────────────────────
  applyState();

  console.log('✅ v12.0.0 Collapsible Glass Sidebar initialized (3-state pin)');
})();

// ═══════════════════════════════════════════════════════════════════════════════
// v22.23: MAIL VIEW - Outbox, Sent, Compose, Inbox (Gmail/Outlook Phase 2)
// ═══════════════════════════════════════════════════════════════════════════════

// --- Data Layer ---
// v22.39: Tombstone tracking for deleted mail/draft/social outbox items
// Prevents deleted items from resurrecting during cross-device sync merges
// v22.44: Tombstones now stored as {id, ts} objects with 7-day expiry.
// Only user-initiated deletes create tombstones (not sends/approvals).
var TOMBSTONE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
function getMailDeletedIds() {
  try {
    var raw = JSON.parse(localStorage.getItem('roweos_mail_deleted_ids') || '[]');
    // v22.44: Support both old format (plain strings) and new format ({id, ts})
    var now = Date.now();
    var result = [];
    for (var i = 0; i < raw.length; i++) {
      if (typeof raw[i] === 'string') {
        result.push(raw[i]); // Legacy - will be cleaned on next addMailDeletedId
      } else if (raw[i] && raw[i].id) {
        if (now - (raw[i].ts || 0) < TOMBSTONE_EXPIRY_MS) {
          result.push(raw[i].id);
        }
        // Expired tombstones are silently dropped
      }
    }
    return result;
  } catch(e) { return []; }
}
function addMailDeletedId(id) {
  if (!id) return;
  try {
    var raw = JSON.parse(localStorage.getItem('roweos_mail_deleted_ids') || '[]');
    var now = Date.now();
    // Migrate old format and filter expired
    var entries = [];
    for (var i = 0; i < raw.length; i++) {
      if (typeof raw[i] === 'string') {
        entries.push({ id: raw[i], ts: now }); // Migrate legacy
      } else if (raw[i] && raw[i].id && (now - (raw[i].ts || 0) < TOMBSTONE_EXPIRY_MS)) {
        entries.push(raw[i]);
      }
    }
    // Check if already exists
    var exists = false;
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].id === id) { exists = true; break; }
    }
    if (!exists) {
      entries.push({ id: id, ts: now });
    }
    // Keep max 200 tombstones (reduced from 500 - only real deletes now)
    if (entries.length > 200) entries = entries.slice(entries.length - 200);
    localStorage.setItem('roweos_mail_deleted_ids', JSON.stringify(entries));
  } catch(e) {}
}

// v22.36: In-memory fallback for when data overflows to IndexedDB
var _mailOutboxCache = null;
var _mailSentCache = null;

// v22.44: Outbox folder management
var _mailOutboxSelectedFolder = 'all'; // 'all' or folder name
function getMailOutboxFolders() {
  try { return JSON.parse(localStorage.getItem('roweos_mail_outbox_folders') || '[]'); } catch(e) { return []; }
}
function saveMailOutboxFolders(folders) {
  localStorage.setItem('roweos_mail_outbox_folders', JSON.stringify(folders));
  writeDB('profile/mail', { outboxFolders: folders }); // v25.1
}
function createMailOutboxFolder(name) {
  if (!name || !name.trim()) return;
  var folders = getMailOutboxFolders();
  var trimmed = name.trim();
  if (folders.indexOf(trimmed) !== -1) { showToast('Folder already exists', 'error'); return; }
  folders.push(trimmed);
  saveMailOutboxFolders(folders);
  renderMailOutbox();
  showToast('Folder created: ' + trimmed, 'success');
}
function deleteMailOutboxFolder(name) {
  if (!confirm('Delete folder "' + name + '"? Emails will be moved to All.')) return;
  var folders = getMailOutboxFolders();
  folders = folders.filter(function(f) { return f !== name; });
  saveMailOutboxFolders(folders);
  // Move items from deleted folder to no folder
  var outbox = getMailOutbox();
  outbox.forEach(function(item) { if (item.folder === name) item.folder = ''; });
  saveMailOutbox(outbox);
  if (_mailOutboxSelectedFolder === name) _mailOutboxSelectedFolder = 'all';
  renderMailOutbox();
}
function renameMailOutboxFolder(oldName) {
  var newName = prompt('Rename folder:', oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  var trimmed = newName.trim();
  var folders = getMailOutboxFolders();
  if (folders.indexOf(trimmed) !== -1) { showToast('Folder already exists', 'error'); return; }
  for (var i = 0; i < folders.length; i++) { if (folders[i] === oldName) folders[i] = trimmed; }
  saveMailOutboxFolders(folders);
  var outbox = getMailOutbox();
  outbox.forEach(function(item) { if (item.folder === oldName) item.folder = trimmed; });
  saveMailOutbox(outbox);
  if (_mailOutboxSelectedFolder === oldName) _mailOutboxSelectedFolder = trimmed;
  renderMailOutbox();
}
function selectMailOutboxFolder(name) {
  _mailOutboxSelectedFolder = name;
  renderMailOutbox();
}
function moveMailOutboxItem(itemId, folderName) {
  var outbox = getMailOutbox();
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].id === itemId) { outbox[i].folder = folderName; break; }
  }
  saveMailOutbox(outbox);
  renderMailOutbox();
  showToast('Moved to ' + (folderName || 'All'), 'success');
}
function promptNewMailOutboxFolder() {
  var name = prompt('New folder name:');
  if (name) createMailOutboxFolder(name);
}

function getMailOutbox() {
  // Check in-memory cache first (set when IDB overflow occurs)
  if (_mailOutboxCache !== null) return _mailOutboxCache;
  try { return JSON.parse(localStorage.getItem('roweos_mail_outbox') || '[]'); } catch(e) { return []; }
}
function saveMailOutbox(items) {
  _mailOutboxCache = items; // Always keep in-memory copy
  localStorage.setItem('roweos_mail_outbox', JSON.stringify(items));
  writeDB('profile/mail', { outbox: items }); // v25.1
}
function getMailSent() {
  if (_mailSentCache !== null) return _mailSentCache;
  try { return JSON.parse(localStorage.getItem('roweos_mail_sent') || '[]'); } catch(e) { return []; }
}
function saveMailSent(items) {
  _mailSentCache = items;
  localStorage.setItem('roweos_mail_sent', JSON.stringify(items));
  writeDB('profile/mail', { sent: items }); // v25.1
}
function getMailConfig() {
  try { return JSON.parse(localStorage.getItem('roweos_mail_config') || '{}'); } catch(e) { return {}; }
}

// v23.10: Multi-account support - get all Gmail accounts (array, with legacy migration)
function getMailGmailAccounts() {
  var config = getMailConfig();
  if (config.gmailAccounts && config.gmailAccounts.length > 0) {
    // v23.10: Ensure legacy account is in the array (migration for existing users)
    if (config.gmailEmail) {
      var legacyInArray = false;
      for (var k = 0; k < config.gmailAccounts.length; k++) {
        if (config.gmailAccounts[k].email === config.gmailEmail) { legacyInArray = true; break; }
      }
      if (!legacyInArray) {
        config.gmailAccounts.unshift({ email: config.gmailEmail, token: config.gmailToken || '', refreshToken: config.gmailRefreshToken || '', expiresAt: config.gmailExpiresAt || 0, displayName: '' });
        try { localStorage.setItem('roweos_mail_config', JSON.stringify(config)); } catch(e) {}
      }
    }
    return config.gmailAccounts;
  }
  // Migrate legacy single-account fields
  if (config.gmailEmail) {
    return [{ email: config.gmailEmail, token: config.gmailToken, refreshToken: config.gmailRefreshToken, expiresAt: config.gmailExpiresAt, displayName: '' }];
  }
  return [];
}

// v23.10: Multi-account support - get all Outlook accounts (with legacy migration)
function getMailOutlookAccounts() {
  var config = getMailConfig();
  if (config.outlookAccounts && config.outlookAccounts.length > 0) {
    // v23.10: Ensure legacy account is in the array
    if (config.outlookEmail) {
      var legacyInArray = false;
      for (var k = 0; k < config.outlookAccounts.length; k++) {
        if (config.outlookAccounts[k].email === config.outlookEmail) { legacyInArray = true; break; }
      }
      if (!legacyInArray) {
        config.outlookAccounts.unshift({ email: config.outlookEmail, token: config.outlookToken || '', refreshToken: config.outlookRefreshToken || '', expiresAt: config.outlookExpiresAt || 0, displayName: '' });
        try { localStorage.setItem('roweos_mail_config', JSON.stringify(config)); } catch(e) {}
      }
    }
    return config.outlookAccounts;
  }
  if (config.outlookEmail) {
    return [{ email: config.outlookEmail, token: config.outlookToken, refreshToken: config.outlookRefreshToken, displayName: '' }];
  }
  return [];
}

// v23.9: Get credentials for a specific email address
function getMailAccountCredentials(email) {
  if (!email) return null;
  var emailLower = email.toLowerCase();
  var gmailAccts = getMailGmailAccounts();
  for (var i = 0; i < gmailAccts.length; i++) {
    if (gmailAccts[i].email && gmailAccts[i].email.toLowerCase() === emailLower) {
      return { provider: 'gmail', email: gmailAccts[i].email, token: gmailAccts[i].token, refreshToken: gmailAccts[i].refreshToken, expiresAt: gmailAccts[i].expiresAt };
    }
  }
  var outlookAccts = getMailOutlookAccounts();
  for (var j = 0; j < outlookAccts.length; j++) {
    if (outlookAccts[j].email && outlookAccts[j].email.toLowerCase() === emailLower) {
      return { provider: 'outlook', email: outlookAccts[j].email, token: outlookAccts[j].token, refreshToken: outlookAccts[j].refreshToken, expiresAt: outlookAccts[j].expiresAt || 0 };
    }
  }
  return null;
}

// v22.33: Dynamic default from address - no hardcoded emails
function getDefaultFromAddress() {
  var config = getMailConfig();
  if (config.defaultFromAddress) return config.defaultFromAddress;
  var gmailAccts = getMailGmailAccounts();
  if (gmailAccts.length > 0) return gmailAccts[0].email;
  var outlookAccts = getMailOutlookAccounts();
  if (outlookAccts.length > 0) return outlookAccts[0].email;
  if (config.customFromAddresses && config.customFromAddresses[0]) return config.customFromAddresses[0];
  return '';
}
// v22.33: Build From <option> HTML for any From dropdown - admin-only built-ins
function buildFromOptionsHtml(selectedVal) {
  var config = getMailConfig();
  var html = '';
  var sel = selectedVal || config.defaultFromAddress || '';
  // v25.3: Removed hardcoded Resend addresses (RoweOS, Jordan Rowe) - use Gmail/Outlook connected accounts only
  var custom = config.customFromAddresses || [];
  custom.forEach(function(a) { html += '<option value="' + escapeHtml(a) + '"' + (sel === a ? ' selected' : '') + '>' + escapeHtml(a) + '</option>'; });
  // v23.10: Multi-account Gmail (with display name)
  var gmailAccts = getMailGmailAccounts();
  gmailAccts.forEach(function(acct) {
    var gv = 'gmail:' + acct.email;
    var label = acct.displayName ? escapeHtml(acct.displayName) + ' - ' + escapeHtml(acct.email) + ' (Gmail)' : escapeHtml(acct.email) + ' (Gmail)';
    html += '<option value="' + escapeHtml(gv) + '"' + (sel === gv || sel === acct.email ? ' selected' : '') + '>' + label + '</option>';
  });
  // v23.10: Multi-account Outlook (with display name)
  var outlookAccts = getMailOutlookAccounts();
  outlookAccts.forEach(function(acct) {
    var ov = 'outlook:' + acct.email;
    var label = acct.displayName ? escapeHtml(acct.displayName) + ' - ' + escapeHtml(acct.email) + ' (Outlook)' : escapeHtml(acct.email) + ' (Outlook)';
    html += '<option value="' + escapeHtml(ov) + '"' + (sel === ov || sel === acct.email ? ' selected' : '') + '>' + label + '</option>';
  });
  return html;
}
function saveMailConfig(config) {
  localStorage.setItem('roweos_mail_config', JSON.stringify(config));
  writeDB('profile/mail', { config: config }); // v25.1
}

// --- Add to Outbox (called from pipeline or compose) ---
function addToMailOutbox(emailData) {
  // v22.40: Intercept - queue for approval if guardrails require it
  // v22.47: Also intercept if _forceApprovalQueue is set (per-automation requireApproval toggle)
  if ((window._forceApprovalQueue || (typeof emailApprovalRequired === 'function' && emailApprovalRequired())) && !(emailData && emailData._approvalBypass)) {
    var approvalData = {};
    for (var _ek in emailData) { if (_ek !== '_approvalBypass') approvalData[_ek] = emailData[_ek]; }
    addToPendingApproval({ type: 'email', data: approvalData });
    showToast('Email queued for approval in Automations', 'info');
    return null;
  }
  var outbox = getMailOutbox();
  var item = {
    id: 'mail_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
    to: emailData.to || '',
    from: emailData.from || getDefaultFromAddress(),
    replyTo: emailData.replyTo || getMailConfig().replyTo || '',
    fromName: emailData.fromName || getMailConfig().displayName || '',
    cc: emailData.cc || [],
    bcc: emailData.bcc || [],
    subject: emailData.subject || '',
    html: emailData.html || '',
    body: emailData.body || '',
    template: emailData.template || 'professional',
    status: 'pending',
    createdAt: Date.now(),
    sentAt: null,
    pipelineName: emailData.pipelineName || '',
    pipelineId: emailData.pipelineId || '',
    canvasHtml: emailData.canvasHtml || '',
    brandIdx: emailData.brandIdx != null ? emailData.brandIdx : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0),
    attachments: emailData.attachments || [],
    folder: emailData.folder || ''
  };
  outbox.unshift(item);
  saveMailOutbox(outbox);
  updateMailBadge();
  return item;
}

// --- Add to Sent ---
function addToMailSent(emailData) {
  var sent = getMailSent();
  var item = {
    id: emailData.id || ('sent_' + Date.now()),
    to: emailData.to || '',
    from: emailData.from || '',
    subject: emailData.subject || '',
    html: emailData.html || '',
    body: emailData.body || '',
    sentAt: Date.now(),
    pipelineName: emailData.pipelineName || '',
    emailId: emailData.emailId || '',
    attachments: emailData.attachments || []
  };
  sent.unshift(item);
  // Keep last 200 sent emails
  if (sent.length > 200) sent = sent.slice(0, 200);
  saveMailSent(sent);
  return item;
}

// --- Send from Outbox ---
function mailSendOutboxItem(itemId) {
  var outbox = getMailOutbox();
  var idx = -1;
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].id === itemId) { idx = i; break; }
  }
  if (idx === -1) { showToast('Email not found in outbox', 'error'); return; }
  var item = outbox[idx];

  if (!item.to) { showToast('No recipient email address', 'error'); return; }
  if (!item.subject) { showToast('Subject is required', 'error'); return; }

  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';

  // v23.4: Build HTML body - await logo upload if pending so Firebase URL is available
  function _buildAndSend() {
  var htmlBody = item.html;
  if (!htmlBody && item.body) {
    htmlBody = mailRenderBody(item.body, item.template);
  }

  // v24.9: Deduplicate send toasts (prevent 10+ stacked toasts on batch send)
  var _sendToastKey = 'mail_send_' + item.to;
  if (!window._mailSendToasts) window._mailSendToasts = {};
  if (!window._mailSendToasts[_sendToastKey] || Date.now() - window._mailSendToasts[_sendToastKey] > 5000) {
    showToast('Sending email to ' + item.to + '...', 'info');
    window._mailSendToasts[_sendToastKey] = Date.now();
  }
  console.log('[Mail Send] item.id:', item.id, 'to:', item.to, 'attachments:', item.attachments ? item.attachments.length : 0, 'keys:', Object.keys(item));

  // v23.9: Route through Gmail/Outlook API - multi-account aware
  var config = getMailConfig();
  var rawFrom = item.from || config.defaultFromAddress || getDefaultFromAddress();
  var fromAddr = rawFrom;
  var useGmail = false;
  var useOutlook = false;
  if (rawFrom.indexOf('gmail:') === 0) {
    fromAddr = rawFrom.substring(6);
    var gmailCreds = getMailAccountCredentials(fromAddr);
    useGmail = gmailCreds && gmailCreds.provider === 'gmail' && gmailCreds.token;
    if (useGmail) config.gmailToken = gmailCreds.token; // Use matched account's token
  } else if (rawFrom.indexOf('outlook:') === 0) {
    fromAddr = rawFrom.substring(8);
    var outlookCreds = getMailAccountCredentials(fromAddr);
    useOutlook = outlookCreds && outlookCreds.provider === 'outlook' && outlookCreds.token;
    if (useOutlook) config.outlookToken = outlookCreds.token;
  }
  var sendVia = useGmail ? 'gmail' : (useOutlook ? 'outlook' : 'resend');
  // v23.10: Get display name for the sending account
  var sendDisplayName = '';
  var _allAccts = (useGmail ? getMailGmailAccounts() : (useOutlook ? getMailOutlookAccounts() : []));
  for (var _ai = 0; _ai < _allAccts.length; _ai++) {
    if (_allAccts[_ai].email === fromAddr && _allAccts[_ai].displayName) { sendDisplayName = _allAccts[_ai].displayName; break; }
  }
  if (!sendDisplayName) sendDisplayName = item.fromName || config.displayName || '';
  console.log('[Mail Send] via:', sendVia, 'from:', fromAddr, 'displayName:', sendDisplayName);

  // v23.16: Mark email as failed in outbox so it's preserved and visible
  function handleSendFailure(errorMsg) {
    var _outbox = getMailOutbox();
    for (var _fi = 0; _fi < _outbox.length; _fi++) {
      if (_outbox[_fi].id === item.id) {
        _outbox[_fi].status = 'failed';
        _outbox[_fi].lastError = errorMsg;
        _outbox[_fi].lastAttempt = Date.now();
        break;
      }
    }
    saveMailOutbox(_outbox);
    if (typeof renderMailOutbox === 'function') renderMailOutbox();
  }

  function handleSendSuccess(emailId) {
    addToMailSent({
      id: item.id,
      to: item.to,
      from: fromAddr,
      subject: item.subject,
      html: htmlBody,
      body: item.body,
      pipelineName: item.pipelineName,
      emailId: emailId,
      sentVia: sendVia,
      attachments: item.attachments || []
    });
    // v24.9: Tombstone sent emails so they don't resurrect from cloud on other devices
    try {
      var _delIds = JSON.parse(localStorage.getItem('roweos_mail_deleted_ids') || '[]');
      if (_delIds.indexOf(item.id) === -1) _delIds.push(item.id);
      localStorage.setItem('roweos_mail_deleted_ids', JSON.stringify(_delIds));
    } catch(e) {}
    outbox.splice(idx, 1);
    saveMailOutbox(outbox);
    updateMailBadge();
    showToast('Email sent to ' + item.to + (sendVia !== 'resend' ? ' via ' + sendVia.charAt(0).toUpperCase() + sendVia.slice(1) : ''), 'success');
    renderMailView();
    // v25.3: Client Identity extraction - auto-creates client if not found when checkbox is checked
    if (item._informClient && typeof mailExtractClientIdentity === 'function') {
      mailExtractClientIdentity(item.to, item.subject, item.body || '');
    } else if (typeof mailPromptAddUnknownRecipient === 'function') {
      // v23.9: Only prompt for unknown recipients if Inform checkbox was NOT checked
      mailPromptAddUnknownRecipient(item.to, item.subject, item.body || '');
    }
  }

  if (useGmail) {
    // Send via Gmail proxy
    fetch('/api/gmail-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        accessToken: config.gmailToken,
        uid: uid,
        to: item.to,
        from: fromAddr,
        fromName: sendDisplayName,
        subject: item.subject,
        html: htmlBody,
        cc: (item.cc || []).filter(function(e) { return e && e.trim() && e.indexOf('@') !== -1; }),
        bcc: (item.bcc || []).filter(function(e) { return e && e.trim() && e.indexOf('@') !== -1; }),
        replyTo: config.replyTo || '',
        attachments: item.attachments || []
      })
    }).then(function(r) {
      if (r.status === 401) {
        // Token expired - refresh and retry
        mailRefreshGmailToken(function(newToken) {
          if (newToken) mailSendOutboxItem(itemId);
          else showToast('Gmail session expired. Please reconnect.', 'error');
        });
        return null;
      }
      return r.json();
    }).then(function(data) {
      if (!data) return;
      if (data.error) {
        showToast('Gmail send failed: ' + data.error, 'error');
        handleSendFailure('Gmail: ' + data.error);
        return;
      }
      handleSendSuccess(data.messageId || '');
    }).catch(function(err) {
      showToast('Gmail send failed: ' + err.message, 'error');
      handleSendFailure('Gmail: ' + err.message);
    });
  } else if (useOutlook) {
    // v22.28: Proactive token refresh before Outlook send
    var _doOutlookSend = function(token) {
      fetch('/api/gmail-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'outlook_send',
          accessToken: token,
          uid: uid,
          to: item.to,
          from: fromAddr,
          subject: item.subject,
          html: htmlBody,
          cc: (item.cc || []).filter(function(e) { return e && e.trim() && e.indexOf('@') !== -1; }),
          bcc: (item.bcc || []).filter(function(e) { return e && e.trim() && e.indexOf('@') !== -1; }),
          attachments: item.attachments || []
        })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          showToast('Outlook send failed: ' + data.error, 'error');
          handleSendFailure('Outlook: ' + data.error);
          return;
        }
        handleSendSuccess(data.messageId || '');
      }).catch(function(err) {
        showToast('Outlook send failed: ' + err.message, 'error');
        handleSendFailure('Outlook: ' + err.message);
      });
    };
    if (config.outlookExpiresAt && Date.now() > (config.outlookExpiresAt - 300000)) {
      mailRefreshOutlookToken(function(newToken) {
        if (newToken) _doOutlookSend(newToken);
        else showToast('Outlook session expired. Please reconnect.', 'error');
      });
    } else {
      _doOutlookSend(config.outlookToken);
    }
  } else {
    // Send via Resend
    // v23.10: Include display name in from if available
    var _resendFrom = sendDisplayName ? sendDisplayName + ' <' + fromAddr + '>' : fromAddr;
    var _resendPayload = {
      email: item.to,
      subject: item.subject,
      from: _resendFrom,
      html: htmlBody,
      cc: item.cc || [],
      bcc: item.bcc || [],
      uid: uid
    };
    // v22.31: Include attachments if present
    if (item.attachments && item.attachments.length > 0) {
      _resendPayload.attachments = item.attachments;
    }
    fetch('/api/resend-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_resendPayload)
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.error) {
        showToast('Send failed: ' + data.error, 'error');
        handleSendFailure('Resend: ' + data.error);
        return;
      }
      handleSendSuccess(data.emailId || '');
    }).catch(function(err) {
      showToast('Send failed: ' + err.message, 'error');
      handleSendFailure('Resend: ' + err.message);
    });
  }
  } // end _buildAndSend
  // v23.4: Await logo upload promise if pending, so Firebase URL is ready before rendering
  if (window._mailLogoUploadPromise) {
    window._mailLogoUploadPromise.then(_buildAndSend).catch(_buildAndSend);
  } else {
    _buildAndSend();
  }
}

// v25.6: Cloud Outbox Pickup - polls Firestore cloud_outbox for emails composed by Cloud Functions
function processCloudOutbox() {
  if (typeof firebaseUser === 'undefined' || !firebaseUser || !firebaseUser.uid) return;
  if (typeof firebase === 'undefined' || !firebase.firestore) return;
  if (window._cloudOutboxRunning) return;
  // v27.0: Don't retry if we hit a composite index error recently (prevents log spam)
  if (window._cloudOutboxIndexError && Date.now() - window._cloudOutboxIndexErrorTime < 300000) return;
  window._cloudOutboxRunning = true;

  var db = firebase.firestore();
  var userRef = db.collection('roweos_users').doc(firebaseUser.uid);
  var outboxRef = userRef.collection('cloud_outbox');

  // v25.6: First, revert stale 'processing' docs older than 5 minutes back to 'pending'
  var fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  outboxRef.where('status', '==', 'processing')
    .where('processingAt', '<', fiveMinAgo)
    .get()
    .then(function(staleSnap) {
      var revertPromises = [];
      staleSnap.forEach(function(doc) {
        console.log('[CloudOutbox] Reverting stale processing doc:', doc.id);
        revertPromises.push(doc.ref.update({ status: 'pending', processingAt: firebase.firestore.FieldValue.delete() }));
      });
      return Promise.all(revertPromises);
    })
    .then(function() {
      return outboxRef.where('status', '==', 'pending').limit(5).get();
    })
    .then(function(snapshot) {
      if (snapshot.empty) {
        window._cloudOutboxRunning = false;
        return;
      }
      console.log('[CloudOutbox] Found', snapshot.size, 'pending cloud emails');

      var docs = [];
      snapshot.forEach(function(doc) {
        var data = doc.data();
        data._docId = doc.id;
        data._ref = doc.ref;
        docs.push(data);
      });

      var idx = 0;
      function processNext() {
        if (idx >= docs.length) {
          window._cloudOutboxRunning = false;
          return;
        }
        var item = docs[idx];
        idx++;

        item._ref.update({
          status: 'processing',
          processingAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function() {
          // v28.7: Build HTML body from markdown or plain text (check bodyMarkdown + body)
          var rawBody = item.html || '';
          var mdSource = item.bodyMarkdown || item.body || '';
          var htmlBody = rawBody;
          if (!htmlBody && mdSource) {
            if (typeof marked !== 'undefined' && marked.parse) {
              try { htmlBody = marked.parse(mdSource); } catch(e) { htmlBody = mdSource.replace(/\n/g, '<br>'); }
            } else if (typeof markdownToHtml === 'function') {
              try { htmlBody = markdownToHtml(mdSource); } catch(e) { htmlBody = mdSource.replace(/\n/g, '<br>'); }
            } else {
              htmlBody = mdSource.replace(/\n/g, '<br>');
            }
          }

          // v25.6: Wrap in branded email template if available
          if (typeof generateBrandedEmail === 'function' && htmlBody) {
            try {
              htmlBody = generateBrandedEmail({ bodyHtml: htmlBody, subject: item.subject || '' });
            } catch(e) {
              console.warn('[CloudOutbox] Branded template failed, using raw HTML:', e);
            }
          }

          // v25.6: Determine send method using existing mail config
          var config = getMailConfig();
          var rawFrom = item.from || config.defaultFromAddress || getDefaultFromAddress();
          var fromAddr = rawFrom;
          var useGmail = false;
          var useOutlook = false;
          var uid = firebaseUser.uid;

          if (rawFrom.indexOf('gmail:') === 0) {
            fromAddr = rawFrom.substring(6);
            var gmailCreds = getMailAccountCredentials(fromAddr);
            useGmail = gmailCreds && gmailCreds.provider === 'gmail' && gmailCreds.token;
            if (useGmail) config.gmailToken = gmailCreds.token;
          } else if (rawFrom.indexOf('outlook:') === 0) {
            fromAddr = rawFrom.substring(8);
            var outlookCreds = getMailAccountCredentials(fromAddr);
            useOutlook = outlookCreds && outlookCreds.provider === 'outlook' && outlookCreds.token;
            if (useOutlook) config.outlookToken = outlookCreds.token;
          } else {
            var gmailAccounts = typeof getMailGmailAccounts === 'function' ? getMailGmailAccounts() : [];
            for (var gi = 0; gi < gmailAccounts.length; gi++) {
              if (gmailAccounts[gi].email === fromAddr && gmailAccounts[gi].token) {
                useGmail = true;
                config.gmailToken = gmailAccounts[gi].token;
                break;
              }
            }
          }

          var sendDisplayName = item.fromName || '';
          if (!sendDisplayName) {
            var allAccts = useGmail ? (typeof getMailGmailAccounts === 'function' ? getMailGmailAccounts() : []) :
                           (useOutlook ? (typeof getMailOutlookAccounts === 'function' ? getMailOutlookAccounts() : []) : []);
            for (var ai = 0; ai < allAccts.length; ai++) {
              if (allAccts[ai].email === fromAddr && allAccts[ai].displayName) {
                sendDisplayName = allAccts[ai].displayName;
                break;
              }
            }
            if (!sendDisplayName) sendDisplayName = config.displayName || '';
          }

          console.log('[CloudOutbox] Sending', item._docId, 'to:', item.to, 'via:', useGmail ? 'gmail' : (useOutlook ? 'outlook' : 'resend'));

          var sendPromise;
          if (useGmail) {
            sendPromise = fetch('/api/gmail-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'send',
                accessToken: config.gmailToken,
                uid: uid,
                to: item.to,
                from: fromAddr,
                fromName: sendDisplayName,
                subject: item.subject || '',
                html: htmlBody,
                cc: item.cc || [],
                bcc: item.bcc || [],
                replyTo: config.replyTo || '',
                attachments: item.attachments || []
              })
            }).then(function(r) {
              if (r.status === 401) {
                return new Promise(function(resolve) {
                  if (typeof mailRefreshGmailToken === 'function') {
                    mailRefreshGmailToken(function(newToken) {
                      if (newToken) {
                        resolve({ _retry: true, token: newToken });
                      } else {
                        resolve({ error: 'Gmail token expired, refresh failed' });
                      }
                    });
                  } else {
                    resolve({ error: 'Gmail token expired' });
                  }
                });
              }
              return r.json();
            }).then(function(data) {
              if (data && data._retry) {
                return fetch('/api/gmail-proxy', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'send',
                    accessToken: data.token,
                    uid: uid,
                    to: item.to,
                    from: fromAddr,
                    fromName: sendDisplayName,
                    subject: item.subject || '',
                    html: htmlBody,
                    cc: item.cc || [],
                    bcc: item.bcc || [],
                    replyTo: config.replyTo || '',
                    attachments: item.attachments || []
                  })
                }).then(function(r2) { return r2.json(); });
              }
              return data;
            });
          } else if (useOutlook) {
            sendPromise = fetch('/api/gmail-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'outlook_send',
                accessToken: config.outlookToken,
                uid: uid,
                to: item.to,
                from: fromAddr,
                subject: item.subject || '',
                html: htmlBody,
                cc: item.cc || [],
                bcc: item.bcc || [],
                attachments: item.attachments || []
              })
            }).then(function(r) { return r.json(); });
          } else {
            var resendFrom = sendDisplayName ? sendDisplayName + ' <' + fromAddr + '>' : fromAddr;
            var resendPayload = {
              email: item.to,
              subject: item.subject || '',
              from: resendFrom,
              html: htmlBody,
              cc: item.cc || [],
              bcc: item.bcc || [],
              uid: uid
            };
            if (item.attachments && item.attachments.length > 0) {
              resendPayload.attachments = item.attachments;
            }
            sendPromise = fetch('/api/resend-welcome', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(resendPayload)
            }).then(function(r) { return r.json(); });
          }

          return sendPromise.then(function(data) {
            if (!data || data.error) {
              var errMsg = (data && data.error) ? data.error : 'Unknown send error';
              console.error('[CloudOutbox] Send failed for', item._docId, ':', errMsg);
              return item._ref.update({
                status: 'failed',
                error: errMsg,
                failedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            console.log('[CloudOutbox] Sent successfully:', item._docId);
            return item._ref.update({
              status: 'sent',
              sentAt: firebase.firestore.FieldValue.serverTimestamp(),
              messageId: data.messageId || data.emailId || ''
            });
          });
        }).then(function() {
          processNext();
        }).catch(function(err) {
          console.error('[CloudOutbox] Error processing', item._docId, ':', err);
          try {
            item._ref.update({
              status: 'failed',
              error: err.message || String(err),
              failedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch(e) {}
          processNext();
        });
      }
      processNext();
    })
    .catch(function(err) {
      var errMsg = err && err.message ? err.message : String(err);
      // v27.0: Suppress composite index errors after first occurrence (5 min cooldown)
      if (errMsg.indexOf('index') !== -1 || errMsg.indexOf('precondition') !== -1) {
        if (!window._cloudOutboxIndexError) {
          console.error('[CloudOutbox] Missing Firestore composite index. Create index for cloud_outbox: [status ASC, processingAt ASC]. Suppressing further errors for 5 min.');
        }
        window._cloudOutboxIndexError = true;
        window._cloudOutboxIndexErrorTime = Date.now();
      } else {
        console.error('[CloudOutbox] Query error:', errMsg);
      }
      window._cloudOutboxRunning = false;
    });
}

// --- Delete from Outbox ---
function mailDeleteOutboxItem(itemId) {
  var outbox = getMailOutbox();
  outbox = outbox.filter(function(m) { return m.id !== itemId; });
  saveMailOutbox(outbox);
  addMailDeletedId(itemId); // v22.39: Tombstone for cross-device sync
  updateMailBadge();
  renderMailView();
  showToast('Email removed from outbox', 'info');
}

// v22.44: Schedule an outbox email to send at a specific time
function mailPromptScheduleOutboxItem(itemId) {
  var outbox = getMailOutbox();
  var item = null;
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].id === itemId) { item = outbox[i]; break; }
  }
  if (!item) return;

  // Build a minimal inline datetime picker
  var now = new Date();
  // Default to 1 hour from now, round to next 15min
  var defTime = new Date(now.getTime() + 3600000);
  defTime.setMinutes(Math.ceil(defTime.getMinutes() / 15) * 15, 0, 0);
  var defVal = defTime.getFullYear() + '-' + String(defTime.getMonth() + 1).padStart(2, '0') + '-' + String(defTime.getDate()).padStart(2, '0') + 'T' + String(defTime.getHours()).padStart(2, '0') + ':' + String(defTime.getMinutes()).padStart(2, '0');
  // Min = now
  var minVal = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  // Use a simple modal overlay
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = '<div style="background:var(--bg-secondary,#1a1a2e);border:1px solid var(--border-color,#333);border-radius:12px;padding:24px;max-width:340px;width:90%;">' +
    '<div style="font-size:15px;font-weight:600;color:var(--text-primary,#fff);margin-bottom:4px;">Schedule Email</div>' +
    '<div style="font-size:12px;color:var(--text-secondary,#999);margin-bottom:16px;">To: ' + escapeHtml(item.to) + '</div>' +
    '<div style="margin-bottom:16px;">' +
    '<label style="font-size:12px;color:var(--text-secondary,#999);display:block;margin-bottom:6px;">Send at</label>' +
    '<input type="datetime-local" id="mailScheduleInput" class="mail-schedule-input" value="' + defVal + '" min="' + minVal + '" style="width:100%;box-sizing:border-box;padding:8px 12px;font-size:14px;">' +
    '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
    '<button id="mailScheduleCancel" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border-color,#333);background:transparent;color:var(--text-primary,#fff);font-size:13px;cursor:pointer;">Cancel</button>' +
    '<button id="mailScheduleConfirm" style="padding:8px 16px;border-radius:8px;border:none;background:var(--brand-accent,#a89878);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Schedule</button>' +
    '</div></div>';
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(e) { if (e.target === overlay) { document.body.removeChild(overlay); } });
  document.getElementById('mailScheduleCancel').addEventListener('click', function() { document.body.removeChild(overlay); });
  document.getElementById('mailScheduleConfirm').addEventListener('click', function() {
    var input = document.getElementById('mailScheduleInput');
    if (!input || !input.value) { showToast('Select a date and time', 'error'); return; }
    var schedTime = new Date(input.value).getTime();
    if (schedTime <= Date.now()) { showToast('Scheduled time must be in the future', 'error'); return; }
    mailScheduleOutboxItem(itemId, schedTime);
    document.body.removeChild(overlay);
  });
}

function mailScheduleOutboxItem(itemId, timestamp) {
  var outbox = getMailOutbox();
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].id === itemId) {
      outbox[i].scheduledAt = timestamp;
      break;
    }
  }
  saveMailOutbox(outbox);
  // v25.1: saveMailOutbox() already writes through to Firestore
  renderMailView();
  var d = new Date(timestamp);
  showToast('Email scheduled for ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + formatDateTimeDisplay(d), 'success');
}

function mailUnscheduleOutboxItem(itemId) {
  var outbox = getMailOutbox();
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].id === itemId) {
      delete outbox[i].scheduledAt;
      break;
    }
  }
  saveMailOutbox(outbox);
  // v25.1: saveMailOutbox() already writes through to Firestore
  renderMailView();
  showToast('Schedule cancelled - email moved back to outbox', 'info');
}

// v22.44: Check for scheduled emails and send them when due
function mailCheckScheduledSends() {
  var outbox = getMailOutbox();
  var now = Date.now();
  var sent = false;
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].scheduledAt && outbox[i].scheduledAt <= now) {
      console.log('[Mail] Sending scheduled email:', outbox[i].id, outbox[i].subject);
      mailSendOutboxItem(outbox[i].id);
      sent = true;
      break; // Send one at a time, next tick will catch the rest
    }
  }
  if (sent) {
    // Re-check in 2 seconds for any remaining scheduled emails
    setTimeout(mailCheckScheduledSends, 2000);
  }
}

// Start the scheduled email checker (runs every 30 seconds)
var _mailScheduleTimer = null;
function startMailScheduleChecker() {
  if (_mailScheduleTimer) return;
  _mailScheduleTimer = setInterval(mailCheckScheduledSends, 30000);
  // Also run immediately on startup
  setTimeout(mailCheckScheduledSends, 5000);
}

// --- Edit Outbox Item (opens compose with pre-filled data) ---
function mailEditOutboxItem(itemId) {
  var outbox = getMailOutbox();
  var item = null;
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].id === itemId) { item = outbox[i]; break; }
  }
  if (!item) return;

  switchMailTab('compose');

  setTimeout(function() {
    var fromEl = document.getElementById('mailComposeFrom');
    var replyEl = document.getElementById('mailComposeReplyTo');
    var toEl = document.getElementById('mailComposeTo');
    var ccEl = document.getElementById('mailComposeCc');
    var bccEl = document.getElementById('mailComposeBcc');
    var subjectEl = document.getElementById('mailComposeSubject');
    var bodyEl = document.getElementById('mailComposeBody');
    var templateEl = document.getElementById('mailComposeTemplate');

    if (fromEl) fromEl.value = item.from || getDefaultFromAddress();
    if (replyEl) replyEl.value = item.replyTo || '';
    if (toEl) toEl.value = item.to || '';
    if (ccEl) ccEl.value = (item.cc || []).join(', ');
    if (bccEl) bccEl.value = (item.bcc || []).join(', ');
    if (subjectEl) subjectEl.value = item.subject || '';
    // v22.25: Use innerHTML for contenteditable canvas; prefer stored HTML for rich content
    if (bodyEl) bodyEl.innerHTML = item.canvasHtml || item.body || '';
    if (templateEl) templateEl.value = item.template || 'professional';
    // v22.45: Restore logo position from outbox item
    var _lpEl = document.getElementById('mailComposeLogoPos');
    if (_lpEl) _lpEl.value = item.logoPosition || 'center';
    // v22.33: Trigger template change to update preview
    if (typeof mailOnTemplateChange === 'function') mailOnTemplateChange();
    mailUpdateCanvasCounts();

    // v22.37: Restore attachments from saved outbox item
    window._mailAttachments = [];
    if (item.attachments && item.attachments.length > 0) {
      for (var ai = 0; ai < item.attachments.length; ai++) {
        var att = item.attachments[ai];
        window._mailAttachments.push({
          name: att.filename || att.name || 'attachment',
          type: att.type || 'application/octet-stream',
          size: att.size || 0,
          url: att.url || null,
          base64: att.content || null
        });
      }
      mailRenderAttachmentChips();
    }

    // Store editing ID so save/send updates the existing item
    window._mailEditingId = itemId;
  }, 50);
}

// --- Render body to HTML with template ---
function mailRenderBody(body, template, canvasHtml, hideLogo, logoPosition) {
  // v22.24: If canvas HTML is provided, use it directly (rich editor output)
  var rendered = canvasHtml || body;
  // v22.36: Strip any template chrome that may have leaked into canvas via preview sync
  if (canvasHtml && canvasHtml.indexOf('<!DOCTYPE') !== -1) {
    // Canvas contains full template HTML - extract just the body content
    var _strip = document.createElement('div');
    _strip.innerHTML = canvasHtml;
    var _contentArea = _strip.querySelector('div[style*="font-size:15px"]') || _strip.querySelector('div[style*="line-height:1.7"]');
    if (_contentArea) { rendered = _contentArea.innerHTML; }
  }
  // v22.44: Base64 image stripping removed - original issue was designMode head injection (fixed in v22.43)
  // v22.33: Auto-linkify bare URLs in canvas HTML that aren't already in <a> tags
  if (canvasHtml) {
    var _tmp = document.createElement('div');
    _tmp.innerHTML = rendered;
    var _walker = document.createTreeWalker(_tmp, NodeFilter.SHOW_TEXT, null, false);
    var _textNodes = [];
    while (_walker.nextNode()) {
      if (_walker.currentNode.parentNode.tagName !== 'A') _textNodes.push(_walker.currentNode);
    }
    _textNodes.forEach(function(node) {
      if (/(https?:\/\/[^\s]+)/i.test(node.textContent)) {
        var span = document.createElement('span');
        span.innerHTML = node.textContent.replace(/(https?:\/\/[^\s]+)/gi, '<a href="$1" style="color:#1a73e8;text-decoration:underline;">$1</a>');
        node.parentNode.replaceChild(span, node);
      }
    });
    rendered = _tmp.innerHTML;
  }
  if (!canvasHtml) {
  try {
    if (typeof marked !== 'undefined' && marked.parse) {
      rendered = marked.parse(body);
      rendered = rendered
        .replace(/<table>/g, '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:16px 0;table-layout:fixed;">')
        .replace(/<th>/g, '<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #d1d1d1;font-size:11px;font-weight:600;background:#f5f5f5;word-wrap:break-word;">')
        .replace(/<td>/g, '<td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:12px;vertical-align:top;word-wrap:break-word;">')
        .replace(/<h1>/g, '<h1 style="font-size:20px;font-weight:600;margin:24px 0 8px;line-height:1.3;">')
        .replace(/<h2>/g, '<h2 style="font-size:17px;font-weight:600;margin:20px 0 6px;line-height:1.3;">')
        .replace(/<h3>/g, '<h3 style="font-size:15px;font-weight:600;margin:16px 0 4px;line-height:1.3;">')
        .replace(/<p>/g, '<p style="margin:0 0 12px;line-height:1.6;font-size:14px;">')
        .replace(/<ul>/g, '<ul style="margin:0 0 12px;padding-left:20px;font-size:14px;">')
        .replace(/<ol>/g, '<ol style="margin:0 0 12px;padding-left:20px;font-size:14px;">')
        .replace(/<li>/g, '<li style="margin:0 0 4px;line-height:1.5;">')
        .replace(/<hr>/g, '<hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">')
        .replace(/<blockquote>/g, '<blockquote style="margin:12px 0;padding:8px 16px;border-left:3px solid #d1d1d1;color:#666;font-size:13px;">')
        .replace(/<pre>/g, '<pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto;white-space:pre-wrap;word-wrap:break-word;max-width:100%;font-size:12px;line-height:1.5;margin:12px 0;">')
        .replace(/<code>/g, '<code style="font-family:monospace;font-size:12px;word-break:break-all;">');
    } else {
      rendered = escapeHtml(body).replace(/\n/g, '<br>');
    }
  } catch(e) {
    rendered = escapeHtml(body).replace(/\n/g, '<br>');
  }
  } // end if (!canvasHtml)

  if (template === 'plain') {
    return '<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">' + rendered + '</div>';
  }

  // v22.25: AI-generated template - use stored HTML if available
  if (template === 'ai' && window._mailAiTemplateHtml) {
    return window._mailAiTemplateHtml;
  }
  // v22.45: Saved custom templates - inject current content into template placeholder
  if (template && template.indexOf('custom_') === 0) {
    try {
      var customTemplates = JSON.parse(localStorage.getItem('roweos_mail_custom_templates') || '[]');
      var found = customTemplates.find(function(t) { return ('custom_' + t.id) === template || t.id === template || ('custom_' + t.id) === template.replace('custom_custom_', 'custom_'); });
      if (found && found.html) {
        var tplHtml = found.html;
        var wrappedContent = '<div style="font-size:15px;line-height:1.7;">' + rendered + '</div>';
        // v22.45: Replace content placeholder with current email content
        if (tplHtml.indexOf('{{EMAIL_CONTENT}}') !== -1) {
          tplHtml = tplHtml.replace('{{EMAIL_CONTENT}}', wrappedContent);
        } else {
          // v22.45: Legacy saved templates without placeholder - find content area and inject
          var _tplDiv = document.createElement('div');
          _tplDiv.innerHTML = tplHtml;
          var _cArea = _tplDiv.querySelector('div[style*="line-height:1.7"]') || _tplDiv.querySelector('div[style*="line-height:1.6"]');
          if (_cArea) {
            _cArea.innerHTML = wrappedContent;
            tplHtml = _tplDiv.innerHTML;
          }
        }
        return tplHtml;
      }
    } catch(e) {}
  }

  // Use branded template if generateBrandedEmail exists
  if (typeof generateBrandedEmail === 'function' && template !== 'plain') {
    var brandName = 'Brand';
    // v22.29: Fix - use selectedBrand (the actual global), not currentBrandIndex
    var _bidx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
    try { brandName = brands[_bidx].shortName || brands[_bidx].name; } catch(e) {}
    var accent = '#a89878';
    try { accent = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#a89878'; } catch(e) {}
    // v22.31: Check temp mail logo first, then localStorage, then brands array
    var logo = '';
    try {
      if (window._mailTempLogo) { logo = window._mailTempLogo; }
      if (!logo) { logo = localStorage.getItem(getCurrentLogoKey(_bidx)) || ''; }
      if (!logo) { var _b = brands[_bidx]; logo = (_b && (_b.logo || _b.brandLogo)) || ''; }
      if (!logo) { var logoEl = document.querySelector('.brand-logo-img'); if (logoEl && logoEl.src && logoEl.src.indexOf('data:') === 0) logo = logoEl.src; }
    } catch(e) {}
    // v22.36: Upload base64 logo to Firebase Storage for email use
    if (logo && logo.indexOf('data:') === 0) {
      mailEnsureLogoUrl(logo);
    }
    // v25.0: Prefer base64 for preview (always works), HTTP URL for sent emails
    var emailLogo = '';
    if (window._mailLogoBase64) {
      emailLogo = window._mailLogoBase64;
    } else if (logo && logo.indexOf('data:') === 0) {
      emailLogo = logo;
    } else if (window._mailLogoUrl && window._mailLogoUrl.indexOf('http') === 0) {
      emailLogo = window._mailLogoUrl;
    } else if (logo && logo.indexOf('http') === 0) {
      emailLogo = logo;
    }
    // v23.2: Logo size and font family
    var _logoSizePx = typeof mailGetLogoSizePx === 'function' ? mailGetLogoSizePx() : 150;
    var _fontStack = typeof mailGetFontStack === 'function' ? mailGetFontStack() : "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    window._studioEmailContext = {
      contentHtml: '<div style="font-size:15px;line-height:1.7;font-family:' + _fontStack + ';">' + rendered + '</div>',
      brandName: brandName,
      accentColor: accent,
      brandLogo: hideLogo ? '' : emailLogo,
      logoPosition: logoPosition || 'center',
      logoSize: _logoSizePx,
      fontFamily: _fontStack,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };
    return generateBrandedEmail(template);
  }

  return '<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">' + rendered + '</div>';
}

// --- Tab Switching ---
// v22.28: Mail tab definitions (id, label, badge)
var MAIL_TAB_DEFS = {
  outbox: { label: 'Outbox', badgeId: 'mailOutboxBadge' },
  sent: { label: 'Sent' },
  drafts: { label: 'Drafts', badgeId: 'mailDraftsBadge' },
  compose: { label: 'Compose' },
  // v22.40: Social Outbox moved to Automations > Pending Approval
  inbox: { label: 'Inbox', badgeId: 'mailInboxBadge' },
  connections: { label: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Settings' }
};
var MAIL_TAB_DEFAULT_ORDER = ['outbox', 'sent', 'drafts', 'compose', 'inbox', 'connections'];

function getMailTabOrder() {
  try {
    var config = getMailConfig();
    if (config.tabOrder && Array.isArray(config.tabOrder)) {
      var order = config.tabOrder.slice();
      MAIL_TAB_DEFAULT_ORDER.forEach(function(t) { if (order.indexOf(t) === -1) order.push(t); });
      return order;
    }
  } catch(e) {}
  return MAIL_TAB_DEFAULT_ORDER.slice();
}

function saveMailTabOrder(order) {
  var config = getMailConfig();
  config.tabOrder = order;
  saveMailConfig(config);
  // v25.1: saveMailConfig() already writes through to Firestore
}

function renderMailTabs(activeTab) {
  // v26.0: Use pill nav instead of old tab buttons
  var _defaultMailTab = 'outbox';
  try { _defaultMailTab = localStorage.getItem('roweos_mail_current_tab') || localStorage.getItem('roweos_mail_default_tab') || 'outbox'; } catch(e) {}
  var active = activeTab || _defaultMailTab;
  renderPillNav('mailPillNav', [
    { id: 'inbox', label: 'Inbox' },
    { id: 'compose', label: 'Compose' },
    { id: 'drafts', label: 'Drafts' },
    { id: 'sent', label: 'Sent', secondary: true },
    { id: 'outbox', label: 'Outbox', secondary: true },
    { id: 'connections', label: 'Settings', secondary: true }
  ], active, function(tabId) { switchMailTab(tabId); }, { viewId: 'mail' });
}

// v25.4: Client-side scavenger scoring (mirrors Cloud Function algorithm)
function scoreScavengerTarget(target, keywords) {
  var matchChars = 0;
  var contentLen = (target.content || '').length;
  var matched = [];
  var contentLower = (target.content || '').toLowerCase();
  for (var k = 0; k < keywords.length; k++) {
    if (contentLower.indexOf(keywords[k].toLowerCase()) >= 0) {
      matchChars += keywords[k].length;
      matched.push(keywords[k]);
    }
  }
  var relevance = matched.length > 0 ? Math.min(100, Math.round((matchChars / Math.max(contentLen, 1)) * 500)) : 20;
  relevance = Math.max(20, Math.min(100, relevance));

  var followers = target.authorFollowers || 0;
  var authority;
  if (followers >= 50000) authority = 100;
  else if (followers >= 10000) authority = 80;
  else if (followers >= 2000) authority = 60;
  else if (followers >= 500) authority = 40;
  else authority = 20;

  var ageHours = 0;
  if (target.createdAt) {
    ageHours = (Date.now() - new Date(target.createdAt).getTime()) / (60 * 60 * 1000);
  }
  var engagement = Math.max(20, Math.round(100 - (ageHours * 10)));

  var score = Math.round(relevance * 0.5 + authority * 0.3 + engagement * 0.2);
  return {
    score: score,
    scoreBreakdown: { relevance: relevance, authority: authority, engagement: engagement },
    keywordsMatched: matched
  };
}

// v25.4: Engage tab state
var engageState = {
  targets: [],
  filter: 'all',
  lastDoc: null,
  pageSize: 20,
  listener: null,
  searchCooldown: false
};

// v25.4: Create tab AI chat state
var createChatState = {
  messages: [],         // [{role:'user'|'assistant', content:str, ts:number}]
  pendingAction: null,  // quick action pending on next send
  streaming: false
};

// v25.4: DMs tab state
var dmState = {
  conversations: [],        // [{id, participantName, lastMessage, lastAt}]
  openConversationId: null,
  openConversationName: '',
  messages: [],             // thread messages [{id, text, senderId, createdAt}]
  cacheKey: 'roweos_social_dms_cache',
  cacheTTL: 5 * 60 * 1000  // 5 minutes
};

function initEngageTab() {
  if (!firebase.auth().currentUser) return;
  // v25.5: Render keyword pills but don't auto-load feed - starts empty
  renderEngageKeywordPills();
}

// v25.5: Load Feed button - attaches Firestore listener on demand
function loadEngageFeed() {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();

  // Detach old listener if exists
  if (engageState.listener) engageState.listener();

  engageState.listener = db.collection('roweos_users/' + uid + '/scavenger_targets')
    .orderBy('discoveredAt', 'desc')
    .limit(engageState.pageSize)
    .onSnapshot(function(snap) {
      engageState.targets = [];
      engageState.lastDoc = null;
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        engageState.targets.push(data);
        engageState.lastDoc = doc;
      });
      renderEngageFeed();
    }, function(err) {
      console.warn('[Engage] Listener error:', err);
    });
}

// v25.5: Render keyword pills with group filter support
function renderEngageKeywordPills(groupFilter) {
  var el = document.getElementById('engageKeywordPills');
  var select = document.getElementById('engageKeywordGroupSelect');
  if (!el) return;
  var configs = typeof getScavengerConfigs === 'function' ? getScavengerConfigs() : [];
  var html = '';

  // Populate group dropdown
  if (select) {
    var groupHtml = '<option value="all">All Keywords</option>';
    for (var c = 0; c < configs.length; c++) {
      var groups = configs[c].keywordGroups || [];
      for (var g = 0; g < groups.length; g++) {
        groupHtml += '<option value="' + escapeHtml(groups[g].name) + '">' + escapeHtml(groups[g].name) + '</option>';
      }
    }
    select.innerHTML = groupHtml;
    if (groupFilter && groupFilter !== 'all') select.value = groupFilter;
  }

  // Build allowed keywords set for current group
  var allowedKeywords = null; // null = all
  if (groupFilter && groupFilter !== 'all') {
    allowedKeywords = {};
    for (var c2 = 0; c2 < configs.length; c2++) {
      var grps = configs[c2].keywordGroups || [];
      for (var g2 = 0; g2 < grps.length; g2++) {
        if (grps[g2].name === groupFilter) {
          var gkws = grps[g2].keywords || [];
          for (var k = 0; k < gkws.length; k++) allowedKeywords[gkws[k].toLowerCase().trim()] = true;
        }
      }
    }
  }

  for (var i = 0; i < configs.length; i++) {
    var kws = configs[i].keywords;
    if (typeof kws === 'string') kws = kws.split(',');
    if (!Array.isArray(kws)) continue;
    for (var j = 0; j < kws.length; j++) {
      var kw = kws[j].trim();
      if (!kw) continue;
      if (allowedKeywords && !allowedKeywords[kw.toLowerCase()]) continue;
      html += '<button class="scavenger-keyword-pill" onclick="quickEngageSearch(\'' + escapeHtml(kw).replace(/'/g, "\\'") + '\')" style="cursor:pointer;border:none;">' + escapeHtml(kw) + '</button>';
    }
  }
  el.innerHTML = html || '<span style="font-size:12px;color:var(--text-tertiary);">No keywords in this group</span>';
}

// v25.5: Filter keyword pills by group
function filterEngageKeywordGroup() {
  var select = document.getElementById('engageKeywordGroupSelect');
  var group = select ? select.value : 'all';
  renderEngageKeywordPills(group);
}

function quickEngageSearch(keyword) {
  var input = document.getElementById('engageSearchInput');
  if (input) input.value = keyword;
  searchEngagePosts();
}

// v25.4: Manual X API search from Engage tab
function searchEngagePosts() {
  // v25.5: Search runs independently - no auto-listener attachment

  var input = document.getElementById('engageSearchInput');
  var btn = document.getElementById('engageSearchBtn');
  if (!input || !input.value.trim()) {
    showToast('Enter keywords to search', 'error');
    return;
  }
  if (engageState.searchCooldown) {
    showToast('Please wait before searching again', 'info');
    return;
  }

  // v25.4: Read token synchronously from localStorage (getSocialToken returns a Promise)
  var token = '';
  try {
    var scope = typeof getSocialKeyScope === 'function' ? getSocialKeyScope() : '_brand_0';
    var stored = localStorage.getItem('roweos_social_token_x' + scope);
    if (stored) {
      var parsed = JSON.parse(stored);
      token = parsed.accessToken || '';
    }
  } catch(e) {}
  if (!token) {
    showToast('Connect X in Settings to search', 'error');
    return;
  }

  var keywords = input.value.trim().split(',');
  for (var i = 0; i < keywords.length; i++) keywords[i] = keywords[i].trim();
  keywords = keywords.filter(function(k) { return k; });

  var queryParts = [];
  for (var q = 0; q < keywords.length; q++) {
    var kw = keywords[q];
    queryParts.push(kw.indexOf(' ') >= 0 ? '"' + kw + '"' : kw);
  }
  var query = queryParts.join(' OR ') + ' -is:retweet -is:reply';

  // Rate limit cooldown
  engageState.searchCooldown = true;
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  setTimeout(function() {
    engageState.searchCooldown = false;
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }, 5000);

  showToast('Searching X...', 'info');

  // v25.4: Route through proxy to avoid CORS
  var searchEndpoint = '/2/tweets/search/recent' +
    '?query=' + encodeURIComponent(query) +
    '&max_results=10' +
    '&tweet.fields=author_id,created_at,public_metrics' +
    '&expansions=author_id' +
    '&user.fields=public_metrics,username';

  fetch('/api/x-dm-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'GET', endpoint: searchEndpoint, token: token })
  })
  .then(function(resp) {
    if (resp.status === 403) {
      showToast('Your X connection needs to be re-authorized with search permissions', 'error');
      return null;
    }
    if (!resp.ok) {
      showToast('Search failed (HTTP ' + resp.status + ')', 'error');
      return null;
    }
    return resp.json();
  })
  .then(function(data) {
    if (!data) return;
    // v25.4: Log full response for debugging
    console.log('[Engage] X API response:', JSON.stringify(data).substring(0, 500));
    // Check for X API errors in proxy response
    if (data.error) {
      showToast('X API error: ' + data.error, 'error');
      return;
    }
    if (data.errors) {
      showToast('X API error: ' + (data.errors[0] ? data.errors[0].message : JSON.stringify(data.errors)), 'error');
      return;
    }
    var tweets = data.data || [];
    var users = {};
    if (data.includes && data.includes.users) {
      for (var u = 0; u < data.includes.users.length; u++) {
        var user = data.includes.users[u];
        users[user.id] = user;
      }
    }

    showToast('Found ' + tweets.length + ' posts', tweets.length > 0 ? 'success' : 'info');

    var uid = firebase.auth().currentUser.uid;
    var db = firebase.firestore();
    var existingIds = {};
    for (var e = 0; e < engageState.targets.length; e++) {
      existingIds[engageState.targets[e].postId] = true;
    }

    for (var t = 0; t < tweets.length; t++) {
      var tweet = tweets[t];
      if (existingIds[tweet.id]) continue;

      var author = users[tweet.author_id] || {};
      var authorHandle = author.username || '';
      var authorFollowers = (author.public_metrics && author.public_metrics.followers_count) || 0;

      var targetData = {
        content: tweet.text || '',
        authorHandle: authorHandle,
        authorFollowers: authorFollowers,
        createdAt: tweet.created_at || ''
      };

      var scored = scoreScavengerTarget(targetData, keywords);

      var target = {
        postId: tweet.id,
        postUrl: 'https://x.com/' + authorHandle + '/status/' + tweet.id,
        platform: 'x',
        authorHandle: authorHandle,
        authorFollowers: authorFollowers,
        content: tweet.text || '',
        keywordsMatched: scored.keywordsMatched,
        score: scored.score,
        scoreBreakdown: scored.scoreBreakdown,
        status: 'scored',
        source: 'manual',
        discoveredAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      db.collection('roweos_users/' + uid + '/scavenger_targets').add(target)
        .then(function(docRef) {
          // v28.0: Dual-write scavenger target to v4
          if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
            try { syncEngine.write('scavenger_targets', docRef.id, target); } catch(_e) {}
          }
          // v25.4: Auto-draft if score meets config threshold
          var configs = typeof getScavengerConfigs === 'function' ? getScavengerConfigs() : [];
          for (var ci = 0; ci < configs.length; ci++) {
            var cfg = configs[ci];
            if (!cfg.active || !cfg.autoPostThreshold || cfg.autoPostThreshold === 0) continue;
            if (scored.score >= cfg.autoPostThreshold) {
              // Draft and decide async (don't block)
              autoDraftEngageTarget(uid, docRef.id, target, cfg, scored.score);
              break;
            }
          }
        })
        .catch(function(err) { console.warn('[Engage] Write error:', err); });
    }
  })
  .catch(function(err) {
    showToast('Search failed -- check your connection', 'error');
    console.error('[Engage] Search error:', err);
  });
}

// v25.4: Auto-draft and decide for high-scoring manual search targets
function autoDraftEngageTarget(uid, targetId, target, config, score) {
  var db = firebase.firestore();
  var toneInstructions = '';
  if (config.tonePriority === 'Thought Leader') toneInstructions = 'Respond as a thought leader.';
  else if (config.tonePriority === 'Conversational') toneInstructions = 'Respond conversationally.';
  else if (config.tonePriority === 'Professional') toneInstructions = 'Respond professionally.';
  else toneInstructions = 'Respond naturally and helpfully.';

  var systemPrompt = (config.customPrompt || 'You are a helpful brand voice.') + '\n\n' + toneInstructions +
    '\n\nRules:\n- Keep reply under 280 characters\n- Be genuine and add value\n- Never be salesy\n- Match the energy of the original post';
  var userPrompt = 'Draft a reply to this X post by @' + target.authorHandle + ':\n\n"' + target.content + '"';

  // Use the existing BrandAI chat API call pattern
  var provider = 'anthropic';
  var model = 'claude-sonnet-4-6';
  var apiKey = '';
  try {
    var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    apiKey = keys.anthropic || keys.openai || keys.google || '';
    if (keys.openai && !keys.anthropic) { provider = 'openai'; model = 'gpt-4o'; apiKey = keys.openai; }
    if (keys.google && !keys.anthropic && !keys.openai) { provider = 'google'; model = 'gemini-2.0-flash'; apiKey = keys.google; }
  } catch(e) {}

  if (!apiKey) { console.warn('[Engage] No API key for auto-draft'); return; }

  // Make AI call (reuse existing makeApiCall if available, or direct fetch)
  var makeCall = typeof makeScheduledTaskAPICall === 'function' ? makeScheduledTaskAPICall : null;
  if (!makeCall) {
    console.warn('[Engage] No API call function available for auto-draft');
    return;
  }

  makeCall(provider, model, apiKey, systemPrompt, userPrompt, function(response) {
    if (!response) return;
    var draft = response.replace(/^["']|["']$/g, '').trim();
    if (draft.length > 280) draft = draft.substring(0, 277) + '...';

    var updates = {
      draftText: draft,
      aiModel: provider + '/' + model,
      status: score >= 95 ? 'auto_approved' : 'pending_review',
      reviewedBy: score >= 95 ? 'auto' : null,
      draftedAt: new Date().toISOString(),
      decidedAt: new Date().toISOString()
    };
    db.doc('roweos_users/' + uid + '/scavenger_targets/' + targetId).update(updates);
    // v28.0: Dual-write scavenger target update to v4
    if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
      try { syncEngine.write('scavenger_targets', targetId, updates); } catch(_e) {}
    }

    // If auto-approved and score >= 95, post immediately
    if (score >= 95) {
      approveScavengerTarget(targetId);
    }
  });
}

function filterEngageFeed(filter) {
  engageState.filter = filter;
  var btns = document.querySelectorAll('#engageFilterBar .scavenger-filter-btn');
  for (var i = 0; i < btns.length; i++) {
    var btnText = btns[i].textContent.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
    btns[i].classList.toggle('active', btnText === filter || (filter === 'all' && btns[i].textContent === 'All'));
  }
  renderEngageFeed();
}

function renderEngageFeed() {
  var container = document.getElementById('engageFeedList');
  var emptyState = document.getElementById('engageEmptyState');
  var loadMore = document.getElementById('engageLoadMore');
  if (!container) return;

  var filtered = engageState.targets;
  if (engageState.filter !== 'all') {
    filtered = filtered.filter(function(t) { return t.status === engageState.filter; });
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (loadMore) loadMore.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (loadMore) loadMore.style.display = engageState.targets.length >= engageState.pageSize ? 'block' : 'none';

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    html += renderScavengerCard(filtered[i]);
  }
  container.innerHTML = html;
}

// v25.4: Draft an AI reply for a scored target
function draftEngageReply(targetId) {
  var target = null;
  for (var i = 0; i < engageState.targets.length; i++) {
    if (engageState.targets[i]._id === targetId) { target = engageState.targets[i]; break; }
  }
  if (!target) return;

  showToast('Drafting reply...', 'info');

  // Get brand AI config
  var configs = typeof getScavengerConfigs === 'function' ? getScavengerConfigs() : [];
  var config = configs[0] || { tonePriority: 'Thought Leader', customPrompt: 'You are a helpful brand voice.' };

  var toneMap = {
    'Thought Leader': 'Respond as a thought leader -- insightful, authoritative, adding genuine value.',
    'Conversational': 'Respond conversationally -- friendly, approachable, natural tone.',
    'Professional': 'Respond professionally -- polished, credible, business-appropriate.'
  };
  var toneInstr = toneMap[config.tonePriority] || 'Respond naturally and helpfully.';

  var systemPrompt = (config.customPrompt || 'You are a helpful brand voice.') +
    '\n\n' + toneInstr +
    '\n\nRules:\n- Keep reply under 280 characters\n- Be genuine and add value\n- Never be salesy or self-promotional\n- Match the energy of the original post';
  var userPrompt = 'Draft a reply to this X post by @' + target.authorHandle + ':\n\n"' + target.content + '"';

  // Get AI provider
  var provider = 'anthropic';
  var model = 'claude-sonnet-4-6';
  var apiKey = '';
  try {
    var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    apiKey = keys.anthropic || '';
    if (!apiKey && keys.openai) { provider = 'openai'; model = 'gpt-4o'; apiKey = keys.openai; }
    if (!apiKey && keys.google) { provider = 'google'; model = 'gemini-2.0-flash'; apiKey = keys.google; }
  } catch(e) {}

  if (!apiKey) { showToast('No AI API key configured', 'error'); return; }

  // Simple non-streaming call
  var apiUrl = '';
  var headers = { 'Content-Type': 'application/json' };
  var body = {};

  if (provider === 'anthropic') {
    apiUrl = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true'; // v25.5: CORS header for direct browser access
    body = { model: model, max_tokens: 300, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] };
  } else if (provider === 'openai') {
    // v25.5: Use /v1/responses endpoint (matches callStudioAPI)
    apiUrl = 'https://api.openai.com/v1/responses';
    headers['Authorization'] = 'Bearer ' + apiKey;
    body = { model: model, max_output_tokens: 300, input: [{ role: 'developer', content: systemPrompt }, { role: 'user', content: userPrompt }] };
  } else if (provider === 'google') {
    apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
    body = { contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }] };
  }

  fetch(apiUrl, { method: 'POST', headers: headers, body: JSON.stringify(body) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var draft = '';
      if (provider === 'anthropic' && data.content) draft = data.content[0].text;
      // v25.5: /v1/responses format
      else if (provider === 'openai' && data.output) draft = data.output[0].content[0].text;
      else if (provider === 'google' && data.candidates) draft = data.candidates[0].content.parts[0].text;

      draft = draft.replace(/^["']|["']$/g, '').trim();
      if (draft.length > 280) draft = draft.substring(0, 277) + '...';

      if (!draft) { showToast('Failed to generate reply', 'error'); return; }

      // Update in Firestore
      var uid = firebase.auth().currentUser.uid;
      var _draftUpdates = {
        draftText: draft,
        aiModel: provider + '/' + model,
        status: 'drafted',
        draftedAt: new Date().toISOString()
      };
      firebase.firestore().doc('roweos_users/' + uid + '/scavenger_targets/' + targetId).update(_draftUpdates);
      // v28.0: Dual-write scavenger target update to v4
      if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
        try { syncEngine.write('scavenger_targets', targetId, _draftUpdates); } catch(_e) {}
      }
      showToast('Reply drafted!', 'success');
    })
    .catch(function(err) {
      showToast('Draft failed: ' + err.message, 'error');
    });
}

// v25.4: Like an X post from Engage tab
function likeEngagePost(targetId) {
  var target = null;
  for (var i = 0; i < engageState.targets.length; i++) {
    if (engageState.targets[i]._id === targetId) { target = engageState.targets[i]; break; }
  }
  if (!target || !target.postId) return;

  // v25.5: Read token + userId for likes endpoint
  var token = '';
  var xUserId = '';
  try {
    var scope = typeof getSocialKeyScope === 'function' ? getSocialKeyScope() : '_brand_0';
    var stored = localStorage.getItem('roweos_social_token_x' + scope);
    if (stored) { var parsed = JSON.parse(stored); token = parsed.accessToken || ''; xUserId = parsed.userId || ''; }
  } catch(e) {}

  if (!token) { showToast('Connect X to like posts', 'error'); return; }

  // v25.5: Fallback - fetch userId via /2/users/me if not stored (pre-fix connections)
  var likeWithUserId = function(userId) {
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'POST',
        endpoint: '/2/users/' + userId + '/likes',
        token: token,
        body: { tweet_id: target.postId }
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        showToast('Like failed: ' + data.error, 'error');
      } else {
        showToast('Liked @' + target.authorHandle + '\'s post!', 'success');
        logSocialActivity('scavenger_reply', { platform: 'x', description: 'Liked post by @' + target.authorHandle });
        // v25.5: Visual feedback - toggle heart fill
        try {
          var btn = document.querySelector('[data-like-target="' + targetId + '"]');
          if (btn) { btn.style.color = 'var(--accent)'; btn.setAttribute('data-liked', 'true'); }
        } catch(e) {}
      }
    })
    .catch(function(err) { showToast('Like failed: ' + err.message, 'error'); });
  };

  if (xUserId) {
    likeWithUserId(xUserId);
  } else {
    // v25.5: Fetch and cache userId for pre-fix connections
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'GET', endpoint: '/2/users/me', token: token })
    }).then(function(r) { return r.json(); }).then(function(user) {
      var id = user.data && user.data.id ? user.data.id : '';
      if (id) {
        try {
          var scope = typeof getSocialKeyScope === 'function' ? getSocialKeyScope() : '_brand_0';
          var existing = JSON.parse(localStorage.getItem('roweos_social_token_x' + scope) || '{}');
          existing.userId = id;
          localStorage.setItem('roweos_social_token_x' + scope, JSON.stringify(existing));
        } catch(e) {}
        likeWithUserId(id);
      } else {
        showToast('Could not get X user ID. Reconnect in Settings.', 'error');
      }
    }).catch(function() { showToast('Like failed: could not resolve user ID', 'error'); });
  }
}

function toggleEngageKeywords() {
  var pills = document.getElementById('engageKeywordPills');
  var chevron = document.getElementById('engageKeywordsChevron');
  if (!pills) return;
  var showing = pills.style.display !== 'none';
  pills.style.display = showing ? 'none' : 'flex';
  if (chevron) chevron.style.transform = showing ? 'rotate(-90deg)' : 'rotate(0deg)';
}

function clearEngageSearch() {
  // v25.5: Detach listener and clear feed
  if (engageState.listener) { engageState.listener(); engageState.listener = null; }
  engageState.targets = [];
  engageState.lastDoc = null;
  renderEngageFeed();
  var input = document.getElementById('engageSearchInput');
  if (input) input.value = '';
}

function loadMoreEngageTargets() {
  if (!engageState.lastDoc || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();
  db.collection('roweos_users/' + uid + '/scavenger_targets')
    .orderBy('discoveredAt', 'desc')
    .startAfter(engageState.lastDoc)
    .limit(engageState.pageSize)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        document.getElementById('engageLoadMore').style.display = 'none';
        return;
      }
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        engageState.targets.push(data);
        engageState.lastDoc = doc;
      });
      renderEngageFeed();
    });
}

// v25.4: Blog Tab -- Website Analyzer
var _blogAnalysisContext = null;

function toggleBlogAnalyzer() {
  var body = document.getElementById('blogAnalyzerBody');
  var chevron = document.getElementById('blogAnalyzerChevron');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

function toggleBlogAnalysisSection(section) {
  var body = document.getElementById(section === 'content' ? 'blogContentAnalysisBody' : 'blogSeoAnalysisBody');
  var chevron = document.getElementById(section === 'content' ? 'blogContentChevron' : 'blogSeoChevron');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

async function blogAnalyzeWebsite() {
  var urlEl = document.getElementById('blogAnalyzerUrl');
  var btn = document.getElementById('blogAnalyzeBtn');
  var status = document.getElementById('blogAnalyzerStatus');
  var results = document.getElementById('blogAnalyzerResults');
  if (!urlEl) return;
  var url = (urlEl.value || '').trim();
  if (!url) { showToast('Enter a URL to analyze', 'warning'); return; }
  if (url.indexOf('http') !== 0) url = 'https://' + url;

  if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
  if (status) { status.style.display = 'block'; status.textContent = 'Fetching page...'; }
  if (results) results.style.display = 'none';

  try {
    var resp = await fetch('/api/fetch-site-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, mode: 'content' })
    });
    if (!resp.ok) throw new Error('Fetch failed: HTTP ' + resp.status);
    var data = await resp.json();

    if (status) status.textContent = 'Parsing content...';
    var analysis = blogParsePageContent(data, url);

    if (status) status.textContent = 'Analyzing SEO...';
    analysis.seo = blogCalculateSEOScore(analysis);

    blogRenderAnalysisResults(analysis);
    _blogAnalysisContext = analysis;
    window._blogAnalysisContext = analysis;

    if (results) results.style.display = '';
    if (status) { status.style.display = 'none'; }
    showToast('Analysis complete', 'success');
  } catch(e) {
    console.error('[Blog Analyzer]', e);
    showToast('Could not analyze: ' + e.message, 'error');
    if (status) { status.style.display = 'none'; }
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Analyze'; }
}

function blogParsePageContent(fetchData, url) {
  var html = fetchData.rawHtml || '';
  var title = fetchData.title || '';
  var description = fetchData.description || '';
  var bodyText = fetchData.content || '';

  // Parse with DOMParser if raw HTML available
  var headings = [];
  var imageCount = 0;
  var ogTags = {};
  var canonical = '';

  if (html && typeof DOMParser !== 'undefined') {
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      // Meta tags
      var metaDesc = doc.querySelector('meta[name="description"]');
      if (metaDesc) description = metaDesc.getAttribute('content') || description;
      var ogTitle = doc.querySelector('meta[property="og:title"]');
      var ogDesc = doc.querySelector('meta[property="og:description"]');
      var ogImage = doc.querySelector('meta[property="og:image"]');
      var ogType = doc.querySelector('meta[property="og:type"]');
      ogTags = {
        title: ogTitle ? ogTitle.getAttribute('content') : '',
        description: ogDesc ? ogDesc.getAttribute('content') : '',
        image: ogImage ? ogImage.getAttribute('content') : '',
        type: ogType ? ogType.getAttribute('content') : ''
      };
      var canonEl = doc.querySelector('link[rel="canonical"]');
      if (canonEl) canonical = canonEl.getAttribute('href') || '';

      // Headings
      var hEls = doc.querySelectorAll('h1,h2,h3,h4,h5,h6');
      for (var hi = 0; hi < hEls.length && hi < 30; hi++) {
        headings.push({ level: parseInt(hEls[hi].tagName[1], 10), text: (hEls[hi].textContent || '').trim() });
      }

      // Images
      imageCount = doc.querySelectorAll('img').length;

      // Body text
      var bodyEl = doc.querySelector('article') || doc.querySelector('main') || doc.body;
      if (bodyEl) {
        var clone = bodyEl.cloneNode(true);
        var scripts = clone.querySelectorAll('script,style,nav,header,footer');
        for (var si = 0; si < scripts.length; si++) scripts[si].parentNode.removeChild(scripts[si]);
        bodyText = (clone.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 3000);
      }
    } catch(pe) { console.warn('[Blog] DOMParser error', pe); }
  }

  var wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
  var keywords = blogExtractKeywords(bodyText);

  return {
    url: url,
    title: title,
    description: description,
    bodyText: bodyText,
    headings: headings,
    imageCount: imageCount,
    wordCount: wordCount,
    keywords: keywords,
    ogTags: ogTags,
    canonical: canonical
  };
}

var _blogStopWords = 'a,an,the,and,or,but,in,on,at,to,for,of,with,by,from,is,was,are,were,be,been,have,has,had,do,does,did,will,would,could,should,may,might,that,this,these,those,it,its,i,we,you,he,she,they,their,our,your,my,not,no,so,if,as,up,out,into,about,than,more,also,after,before,when,then,there,here,all,any,some,can,just,been,being,such,each,over,under,within,without,through,during,because,while,although,though,however,but,yet,nor,either,neither,both,whether,other,another,every,many,much,very,well,even,still,back,way,same,own,since,until,only,both,between,through,need,want,get,make,take,use,know,see,look,come,go,say,tell,give,find,think,feel,try,keep,let,put,set,turn,show,ask,work,seem,leave,call,become,move,live,believe,hold,bring,happen,play,run,write,provide,consider,appear,include,continue,follow,build,place,help'.split(',');

function blogExtractKeywords(text) {
  if (!text) return [];
  var words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  var freq = {};
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (w.length < 3) continue;
    if (_blogStopWords.indexOf(w) !== -1) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  var sorted = Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; });
  var result = [];
  for (var j = 0; j < Math.min(10, sorted.length); j++) {
    result.push({ word: sorted[j], count: freq[sorted[j]] });
  }
  return result;
}

function blogCalculateSEOScore(analysis) {
  var score = 0;
  var issues = [];
  var passes = [];

  // Title length
  var titleLen = (analysis.title || '').length;
  if (titleLen >= 50 && titleLen <= 60) { score += 20; passes.push('Title length: ' + titleLen + ' chars (ideal 50-60)'); }
  else if (titleLen > 0 && titleLen < 50) { score += 10; issues.push('Title too short: ' + titleLen + ' chars (aim for 50-60)'); }
  else if (titleLen > 60) { score += 10; issues.push('Title too long: ' + titleLen + ' chars (aim for 50-60)'); }
  else { issues.push('No title tag found'); }

  // Description
  var descLen = (analysis.description || '').length;
  if (descLen >= 150 && descLen <= 160) { score += 20; passes.push('Meta description: ' + descLen + ' chars (ideal 150-160)'); }
  else if (descLen > 0 && descLen < 150) { score += 10; issues.push('Meta description short: ' + descLen + ' chars (aim for 150-160)'); }
  else if (descLen > 160) { score += 10; issues.push('Meta description long: ' + descLen + ' chars (aim for 150-160)'); }
  else { issues.push('No meta description found'); }

  // OG tags
  var ogPresent = !!(analysis.ogTags && (analysis.ogTags.title || analysis.ogTags.description || analysis.ogTags.image));
  if (ogPresent) { score += 20; passes.push('Open Graph tags present'); }
  else { issues.push('No Open Graph tags found'); }

  // Canonical
  if (analysis.canonical) { score += 10; passes.push('Canonical URL set'); }
  else { issues.push('No canonical URL found'); }

  // H1
  var h1s = (analysis.headings || []).filter(function(h) { return h.level === 1; });
  if (h1s.length === 1) { score += 20; passes.push('One H1 tag found'); }
  else if (h1s.length === 0) { issues.push('No H1 tag found'); }
  else { score += 10; issues.push('Multiple H1 tags found (' + h1s.length + ')'); }

  // Heading hierarchy
  var hasH2 = (analysis.headings || []).some(function(h) { return h.level === 2; });
  if (hasH2) { score += 10; passes.push('H2 subheadings present'); }
  else { issues.push('No H2 subheadings found'); }

  // Readability (rough: based on avg word length)
  var readability = 'Unknown';
  if (analysis.bodyText) {
    var words = analysis.bodyText.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      var avgLen = words.reduce(function(acc, w) { return acc + w.length; }, 0) / words.length;
      if (avgLen < 4.5) readability = 'Easy';
      else if (avgLen < 5.5) readability = 'Medium';
      else readability = 'Advanced';
    }
  }

  return { score: score, issues: issues, passes: passes, readability: readability };
}

function blogRenderAnalysisResults(analysis) {
  var contentEl = document.getElementById('blogContentAnalysisBody');
  var seoEl = document.getElementById('blogSeoAnalysisBody');
  if (!contentEl || !seoEl) return;

  // Content Analysis
  var ch = '';
  ch += '<div style="margin-bottom:8px;">';
  ch += '<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:2px;">' + escapeHtml(analysis.title || '(no title)') + '</div>';
  ch += '<div style="font-size:11px;color:var(--text-secondary);">' + escapeHtml((analysis.description || '').substring(0, 200) || '(no description)') + '</div>';
  ch += '</div>';
  ch += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">';
  ch += '<span style="font-size:11px;color:var(--text-tertiary);">' + analysis.wordCount + ' words</span>';
  ch += '<span style="font-size:11px;color:var(--text-tertiary);">' + analysis.imageCount + ' images</span>';
  ch += '<span style="font-size:11px;color:var(--text-tertiary);">' + (analysis.headings || []).length + ' headings</span>';
  ch += '</div>';
  if (analysis.headings && analysis.headings.length > 0) {
    ch += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">Heading Structure</div>';
    ch += '<div style="margin-bottom:8px;">';
    for (var hi = 0; hi < Math.min(10, analysis.headings.length); hi++) {
      var h = analysis.headings[hi];
      ch += '<div style="padding-left:' + ((h.level - 1) * 10) + 'px;font-size:11px;color:var(--text-primary);border-left:2px solid var(--border-color);padding-left:' + (6 + (h.level - 1) * 8) + 'px;margin-bottom:2px;">H' + h.level + ': ' + escapeHtml((h.text || '').substring(0, 60)) + '</div>';
    }
    ch += '</div>';
  }
  if (analysis.keywords && analysis.keywords.length > 0) {
    ch += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">Top Keywords</div>';
    ch += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
    for (var ki = 0; ki < analysis.keywords.length; ki++) {
      var kw = analysis.keywords[ki];
      ch += '<span style="padding:2px 7px;border-radius:4px;background:rgba(var(--brand-accent-rgb,168,152,120),0.12);font-size:11px;color:var(--text-primary);">' + escapeHtml(kw.word) + ' <span style="opacity:.6;">(' + kw.count + ')</span></span>';
    }
    ch += '</div>';
  }
  ch += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
  ch += '<button onclick="blogUseAsContext()" style="padding:5px 10px;border-radius:6px;background:rgba(var(--brand-accent-rgb,168,152,120),0.15);border:1px solid var(--brand-accent,#a89878);color:var(--brand-accent,#a89878);font-size:11px;font-weight:600;cursor:pointer;">Use as Context</button>';
  ch += '<button onclick="blogWriteBetterVersion()" style="padding:5px 10px;border-radius:6px;background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-primary);font-size:11px;font-weight:600;cursor:pointer;">Write a Better Version</button>';
  ch += '</div>';
  contentEl.innerHTML = ch;

  // SEO Analysis
  var seo = analysis.seo || {};
  var sh = '';
  var scoreColor = seo.score >= 70 ? '#22c55e' : (seo.score >= 40 ? '#f97316' : '#ef4444');
  sh += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
  sh += '<div style="font-size:24px;font-weight:700;color:' + scoreColor + ';">' + (seo.score || 0) + '</div>';
  sh += '<div style="font-size:12px;color:var(--text-secondary);">SEO Score<br><span style="font-size:11px;color:var(--text-tertiary);">Readability: ' + escapeHtml(seo.readability || 'Unknown') + '</span></div>';
  sh += '</div>';
  if (seo.passes && seo.passes.length > 0) {
    sh += '<div style="margin-bottom:6px;">';
    for (var pi = 0; pi < seo.passes.length; pi++) {
      sh += '<div style="font-size:11px;color:#22c55e;display:flex;align-items:center;gap:4px;margin-bottom:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' + escapeHtml(seo.passes[pi]) + '</div>';
    }
    sh += '</div>';
  }
  if (seo.issues && seo.issues.length > 0) {
    sh += '<div>';
    for (var ii = 0; ii < seo.issues.length; ii++) {
      sh += '<div style="font-size:11px;color:#f97316;display:flex;align-items:center;gap:4px;margin-bottom:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' + escapeHtml(seo.issues[ii]) + '</div>';
    }
    sh += '</div>';
  }
  seoEl.innerHTML = sh;
}

function blogUseAsContext() {
  if (!_blogAnalysisContext) { showToast('Run analysis first', 'warning'); return; }
  window._blogAnalysisContext = _blogAnalysisContext;
  showToast('Website context saved for AI writing', 'success');
  // Show context note in AI write modal if open
  var note = document.getElementById('blogAIContextNote');
  if (note) note.style.display = 'block';
}

function blogWriteBetterVersion() {
  if (!_blogAnalysisContext) { showToast('Run analysis first', 'warning'); return; }
  blogUseAsContext();
  blogShowAIWriteModal();
  var promptEl = document.getElementById('blogAIWritePrompt');
  if (promptEl) {
    promptEl.value = 'Write a comprehensive, well-structured blog post that covers the same topic as the analyzed website but with better depth, clarity, and SEO optimization. Improve on their headings, add more detail, and make the content more engaging.';
  }
}

// v25.4: Blog Tab -- Rich Text Editor

function blogGetEditor() {
  return document.getElementById('blogEditor');
}

function blogExecCommand(cmd, value) {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  document.execCommand(cmd, false, value || null);
}

function blogSetHeading(tag) {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  if (tag === 'p') {
    document.execCommand('formatBlock', false, '<p>');
  } else {
    document.execCommand('formatBlock', false, '<' + tag + '>');
  }
}

function blogSetFontFamily(font) {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  // Use execCommand fontName; it generates <font face="..."> which is OK for blog HTML
  document.execCommand('fontName', false, font);
}

function blogSetFontSize(sizePx) {
  if (!sizePx) return;
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  // Use size 7 as a sentinel, then replace the <font size="7"> with <span style="font-size:Npx">
  document.execCommand('fontSize', false, 7);
  var fontEls = editor.querySelectorAll('font[size="7"]');
  for (var i = 0; i < fontEls.length; i++) {
    var span = document.createElement('span');
    span.style.fontSize = sizePx + 'px';
    span.innerHTML = fontEls[i].innerHTML;
    fontEls[i].parentNode.replaceChild(span, fontEls[i]);
  }
}

function blogSetTextColor(color) {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  document.execCommand('foreColor', false, color);
}

function blogSetTextColorHex(val) {
  if (!val) return;
  val = val.trim();
  if (val.charAt(0) !== '#') val = '#' + val;
  if (/^#[0-9a-fA-F]{3,6}$/.test(val)) blogSetTextColor(val);
}

function blogInsertLink() {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  var url = window.prompt('Enter URL:');
  if (url) {
    if (url.indexOf('http') !== 0) url = 'https://' + url;
    document.execCommand('createLink', false, url);
  }
}

function blogInsertImagePicker() {
  var input = document.getElementById('blogImageInput');
  if (input) input.click();
}

function blogHandleImageUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    var editor = blogGetEditor();
    if (!editor) return;
    editor.focus();
    var img = '<img src="' + e.target.result + '" alt="" style="max-width:100%;height:auto;">';
    document.execCommand('insertHTML', false, img);
    updateBlogWordCount();
  };
  reader.readAsDataURL(file);
  // Reset input so same file can be re-selected
  input.value = '';
}

function blogInsertCodeBlock() {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  document.execCommand('insertHTML', false, '<pre style="background:var(--bg-tertiary);padding:12px 14px;border-radius:6px;font-family:monospace;font-size:13px;overflow-x:auto;"><code>// code here</code></pre><p><br></p>');
}

function blogInsertHR() {
  var editor = blogGetEditor();
  if (!editor) return;
  editor.focus();
  document.execCommand('insertHTML', false, '<hr style="border:none;border-top:1px solid var(--border-color);margin:16px 0;">');
}

function blogShowTableModal() {
  var modal = document.getElementById('blogTableModal');
  if (modal) modal.style.display = 'block';
}

function blogInsertTable() {
  var rowsEl = document.getElementById('blogTableRows');
  var colsEl = document.getElementById('blogTableCols');
  var rows = parseInt((rowsEl && rowsEl.value) || '3', 10);
  var cols = parseInt((colsEl && colsEl.value) || '3', 10);
  if (isNaN(rows) || rows < 1) rows = 3;
  if (isNaN(cols) || cols < 1) cols = 3;

  var html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;">';
  // Header row
  html += '<tr>';
  for (var c = 0; c < cols; c++) {
    html += '<th style="border:1px solid var(--border-color);padding:6px 10px;background:var(--bg-secondary);font-weight:600;font-size:13px;">Header ' + (c + 1) + '</th>';
  }
  html += '</tr>';
  // Data rows
  for (var r = 1; r < rows; r++) {
    html += '<tr>';
    for (var cc = 0; cc < cols; cc++) {
      html += '<td style="border:1px solid var(--border-color);padding:6px 10px;font-size:13px;">Cell</td>';
    }
    html += '</tr>';
  }
  html += '</table><p><br></p>';

  var editor = blogGetEditor();
  if (editor) {
    editor.focus();
    document.execCommand('insertHTML', false, html);
  }
  var modal = document.getElementById('blogTableModal');
  if (modal) modal.style.display = 'none';
}

// v25.4: Blog Tab -- AI Writing Assistant

function blogShowAIWriteModal() {
  var modal = document.getElementById('blogAIWriteModal');
  if (!modal) return;
  modal.style.display = 'block';
  var note = document.getElementById('blogAIContextNote');
  if (note) note.style.display = window._blogAnalysisContext ? 'block' : 'none';
  var promptEl = document.getElementById('blogAIWritePrompt');
  if (promptEl) promptEl.focus();
}

async function blogAIWrite() {
  var promptEl = document.getElementById('blogAIWritePrompt');
  var statusEl = document.getElementById('blogAIWriteStatus');
  var btn = document.getElementById('blogAIWriteBtn');
  var userPrompt = (promptEl && promptEl.value || '').trim();
  if (!userPrompt) { showToast('Enter a prompt first', 'warning'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Calling AI...'; }

  try {
    var settings = (typeof brandSettings !== 'undefined' && brandSettings[selectedBrand]) ? brandSettings[selectedBrand] : {};
    var provider = settings.provider || 'anthropic';
    var model = settings.model || 'claude-sonnet-4-6';
    var apiKey = typeof getAPIKey === 'function' ? getAPIKey(provider) : '';

    var systemPrompt = 'You are an expert blog writer. Write in a clear, engaging, and well-structured style. Return the blog post as HTML using h1, h2, h3, p, ul, ol, blockquote, and strong tags as appropriate. Do not include html/body/head wrapper tags -- just the content HTML. Never use em-dashes or en-dashes; use commas, colons, semicolons, or hyphens instead.';

    var contextBlock = '';
    if (window._blogAnalysisContext) {
      var ctx = window._blogAnalysisContext;
      contextBlock = '\n\nWebsite context for reference:\nURL: ' + (ctx.url || '') +
        '\nTitle: ' + (ctx.title || '') +
        '\nDescription: ' + (ctx.description || '') +
        '\nMain content excerpt: ' + ((ctx.bodyText || '').substring(0, 1500)) +
        '\nTop keywords: ' + ((ctx.keywords || []).map(function(k) { return k.word; }).join(', '));
    }

    var messages = [{ role: 'user', content: userPrompt + contextBlock }];
    var result = '';

    if (provider === 'anthropic') {
      result = await callAnthropicAPI(model, apiKey, messages, systemPrompt);
    } else if (provider === 'openai') {
      result = await callOpenAIAPI(model, apiKey, messages, systemPrompt);
    } else if (provider === 'google') {
      if (typeof callGeminiAPI === 'function') result = await callGeminiAPI(model, apiKey, messages, systemPrompt);
    }

    if (result) {
      var editor = blogGetEditor();
      if (editor) {
        editor.focus();
        document.execCommand('insertHTML', false, result);
        updateBlogWordCount();
        scheduleBlogAutosave();
      }
      var modal = document.getElementById('blogAIWriteModal');
      if (modal) modal.style.display = 'none';
      showToast('Content generated', 'success');
    } else {
      throw new Error('No content returned from AI');
    }
  } catch(e) {
    console.error('[Blog AI]', e);
    showToast('AI error: ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Generate'; }
  if (statusEl) statusEl.style.display = 'none';
}

// v25.4: Selection-based AI actions (Improve/Expand/Shorten)
var _blogSavedRange = null;

function blogCheckSelection() {
  var sel = window.getSelection ? window.getSelection() : null;
  var text = sel ? sel.toString() : '';
  var toolbar = document.getElementById('blogSelectionToolbar');
  if (!toolbar) return;

  if (text && text.length > 2) {
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    toolbar.style.display = 'flex';
    toolbar.style.top = (rect.top + window.scrollY - 44) + 'px';
    toolbar.style.left = (rect.left + window.scrollX + (rect.width / 2) - 70) + 'px';
    _blogSavedRange = range.cloneRange();
  } else {
    toolbar.style.display = 'none';
    _blogSavedRange = null;
  }
}

document.addEventListener('mousedown', function(e) {
  var toolbar = document.getElementById('blogSelectionToolbar');
  if (toolbar && !toolbar.contains(e.target)) {
    toolbar.style.display = 'none';
  }
});

async function blogAISelectionAction(action) {
  if (!_blogSavedRange) { showToast('Select some text first', 'warning'); return; }
  var selectedText = _blogSavedRange.toString();
  if (!selectedText) return;

  var toolbar = document.getElementById('blogSelectionToolbar');
  if (toolbar) toolbar.style.display = 'none';
  showToast(action.charAt(0).toUpperCase() + action.slice(1) + 'ing...', 'info');

  try {
    var settings = (typeof brandSettings !== 'undefined' && brandSettings[selectedBrand]) ? brandSettings[selectedBrand] : {};
    var provider = settings.provider || 'anthropic';
    var model = settings.model || 'claude-sonnet-4-6';
    var apiKey = typeof getAPIKey === 'function' ? getAPIKey(provider) : '';

    var prompts = {
      improve: 'Rewrite the following text to improve clarity, impact, and readability. Keep roughly the same length. Return only the improved HTML (no wrapper tags):',
      expand: 'Expand the following text with more detail, examples, and depth. Return only the expanded HTML (no wrapper tags):',
      shorten: 'Condense the following text to its essential points in about half the length. Return only the shortened HTML (no wrapper tags):'
    };
    var systemPrompt = 'You are an expert editor. Return only the rewritten content as clean HTML. Never use em-dashes or en-dashes.';
    var messages = [{ role: 'user', content: prompts[action] + '\n\n' + selectedText }];

    var result = '';
    if (provider === 'anthropic') result = await callAnthropicAPI(model, apiKey, messages, systemPrompt);
    else if (provider === 'openai') result = await callOpenAIAPI(model, apiKey, messages, systemPrompt);
    else if (provider === 'google' && typeof callGeminiAPI === 'function') result = await callGeminiAPI(model, apiKey, messages, systemPrompt);

    if (result && _blogSavedRange) {
      _blogSavedRange.deleteContents();
      var fragment = document.createRange().createContextualFragment(result);
      _blogSavedRange.insertNode(fragment);
      _blogSavedRange = null;
      updateBlogWordCount();
      scheduleBlogAutosave();
      showToast('Text ' + action + 'd', 'success');
    } else {
      showToast('No result from AI', 'warning');
    }
  } catch(e) {
    console.error('[Blog AI Selection]', e);
    showToast('AI error: ' + e.message, 'error');
  }
}

// v25.4: Blog Tab -- Drafts System

var _blogAutosaveTimer = null;
var _blogCurrentDraftId = null;

function updateBlogWordCount() {
  var editor = blogGetEditor();
  var wordEl = document.getElementById('blogWordCount');
  var timeEl = document.getElementById('blogReadingTime');
  if (!editor || !wordEl || !timeEl) return;
  var text = (editor.textContent || editor.innerText || '').trim();
  var words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  var minutes = Math.max(1, Math.round(words / 200));
  wordEl.textContent = words + ' word' + (words !== 1 ? 's' : '');
  timeEl.textContent = minutes + ' min read';
}

function scheduleBlogAutosave() {
  clearTimeout(_blogAutosaveTimer);
  _blogAutosaveTimer = setTimeout(function() {
    autosaveBlogDraft();
  }, 2000);
}

function autosaveBlogDraft() {
  var editor = blogGetEditor();
  var titleEl = document.getElementById('blogTitleInput');
  if (!editor) return;

  var htmlContent = editor.innerHTML || '';
  var title = (titleEl && titleEl.value) || '';
  var text = (editor.textContent || editor.innerText || '').trim();
  var wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  // Skip saving empty posts
  if (!htmlContent.replace(/<[^>]+>/g, '').trim() && !title) return;

  try {
    var drafts = JSON.parse(localStorage.getItem('roweos_blog_drafts') || '[]');
    var now = new Date().toISOString();

    if (_blogCurrentDraftId) {
      var found = false;
      for (var i = 0; i < drafts.length; i++) {
        if (drafts[i].id === _blogCurrentDraftId) {
          drafts[i].title = title;
          drafts[i].htmlContent = htmlContent;
          drafts[i].wordCount = wordCount;
          drafts[i].updatedAt = now;
          drafts[i].analysisContext = window._blogAnalysisContext || null;
          found = true;
          break;
        }
      }
      if (!found) {
        // Draft was deleted -- create new
        _blogCurrentDraftId = null;
      }
    }

    if (!_blogCurrentDraftId) {
      _blogCurrentDraftId = 'blog_' + Date.now();
      drafts.unshift({
        id: _blogCurrentDraftId,
        title: title,
        htmlContent: htmlContent,
        wordCount: wordCount,
        createdAt: now,
        updatedAt: now,
        analysisContext: window._blogAnalysisContext || null
      });
    }

    // Keep max 20 drafts
    if (drafts.length > 20) drafts = drafts.slice(0, 20);
    localStorage.setItem('roweos_blog_drafts', JSON.stringify(drafts));

    var statusEl = document.getElementById('blogAutosaveStatus');
    if (statusEl) {
      var d = new Date();
      statusEl.textContent = 'Saved ' + d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    renderBlogDraftsList();
  } catch(e) { console.warn('[Blog autosave]', e); }
}

function renderBlogDraftsList() {
  var container = document.getElementById('blogDraftsList');
  if (!container) return;
  var drafts = [];
  try { drafts = JSON.parse(localStorage.getItem('roweos_blog_drafts') || '[]'); } catch(e) {}

  if (!drafts || drafts.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-tertiary);padding:8px 0;">No drafts yet. Start writing to auto-save.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < drafts.length; i++) {
    var d = drafts[i];
    var dateStr = '';
    try {
      var dt = new Date(d.updatedAt || d.createdAt);
      dateStr = (dt.getMonth() + 1) + '/' + dt.getDate();
    } catch(e) {}
    var isActive = d.id === _blogCurrentDraftId;
    html += '<div class="blog-draft-card" style="' + (isActive ? 'border-color:var(--brand-accent,#a89878);' : '') + '" onclick="blogLoadDraft(\'' + d.id + '\')" data-id="' + d.id + '">';
    html += '<div class="blog-draft-card-title">' + escapeHtml(d.title || 'Untitled') + '</div>';
    html += '<div class="blog-draft-card-meta">' + (d.wordCount || 0) + ' words &middot; ' + dateStr + '</div>';
    html += '</div>';
  }
  container.innerHTML = html;
}

function blogLoadDraft(id) {
  var drafts = [];
  try { drafts = JSON.parse(localStorage.getItem('roweos_blog_drafts') || '[]'); } catch(e) {}
  var draft = null;
  for (var i = 0; i < drafts.length; i++) {
    if (drafts[i].id === id) { draft = drafts[i]; break; }
  }
  if (!draft) { showToast('Draft not found', 'error'); return; }

  var editor = blogGetEditor();
  var titleEl = document.getElementById('blogTitleInput');
  if (editor) editor.innerHTML = draft.htmlContent || '';
  if (titleEl) titleEl.value = draft.title || '';
  _blogCurrentDraftId = id;
  if (draft.analysisContext) {
    window._blogAnalysisContext = draft.analysisContext;
    _blogAnalysisContext = draft.analysisContext;
  }
  updateBlogWordCount();
  renderBlogDraftsList();
  showToast('Draft loaded', 'success');
}

function blogNewPost() {
  var editor = blogGetEditor();
  var titleEl = document.getElementById('blogTitleInput');
  if (editor) editor.innerHTML = '';
  if (titleEl) titleEl.value = '';
  _blogCurrentDraftId = null;
  window._blogAnalysisContext = null;
  _blogAnalysisContext = null;
  updateBlogWordCount();
  var statusEl = document.getElementById('blogAutosaveStatus');
  if (statusEl) statusEl.textContent = 'Not saved';
  if (editor) editor.focus();
}

function initBlogTab() {
  renderBlogDraftsList();
  updateBlogWordCount();
  var statusEl = document.getElementById('blogAutosaveStatus');
  if (statusEl && !_blogCurrentDraftId) statusEl.textContent = 'Not saved';
}

// v25.4: Blog Tab -- Delivery Options

function blogDeliverEmail() {
  var titleEl = document.getElementById('blogTitleInput');
  var editor = blogGetEditor();
  if (!editor) return;
  var subject = (titleEl && titleEl.value) || 'Blog Post';
  var bodyHtml = editor.innerHTML || '';
  if (!bodyHtml.replace(/<[^>]+>/g, '').trim()) {
    showToast('Nothing to email -- write something first', 'warning');
    return;
  }
  // Navigate to Mail > Compose and pre-fill
  showView('mail');
  setTimeout(function() {
    if (typeof switchMailTab === 'function') switchMailTab('compose');
    setTimeout(function() {
      var subEl = document.getElementById('mailComposeSubject');
      var bodyEl = document.getElementById('mailComposeBody');
      if (subEl) subEl.value = subject;
      if (bodyEl) {
        bodyEl.innerHTML = bodyHtml;
        bodyEl.style.minHeight = '200px';
      }
      window._mailTransferredHtml = bodyHtml;
      showToast('Blog loaded into Mail compose', 'success');
    }, 200);
  }, 100);
}

function blogDeliverCopyHTML() {
  var editor = blogGetEditor();
  if (!editor) return;
  var html = editor.innerHTML || '';
  if (!html.replace(/<[^>]+>/g, '').trim()) {
    showToast('Nothing to copy -- write something first', 'warning');
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(html).then(function() {
        showToast('HTML copied to clipboard', 'success');
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = html;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('HTML copied to clipboard', 'success');
    }
  } catch(e) {
    showToast('Copy failed: ' + e.message, 'error');
  }
}

function blogDeliverPostSummary() {
  var titleEl = document.getElementById('blogTitleInput');
  var editor = blogGetEditor();
  if (!editor) return;
  var htmlContent = editor.innerHTML || '';
  var textContent = (editor.textContent || editor.innerText || '').trim();
  if (!textContent) {
    showToast('Write something first', 'warning');
    return;
  }

  showToast('Summarizing for social...', 'info');

  var settings = (typeof brandSettings !== 'undefined' && brandSettings[selectedBrand]) ? brandSettings[selectedBrand] : {};
  var provider = settings.provider || 'anthropic';
  var model = settings.model || 'claude-sonnet-4-6';
  var apiKey = typeof getAPIKey === 'function' ? getAPIKey(provider) : '';

  var title = (titleEl && titleEl.value) || '';
  var excerpt = textContent.substring(0, 3000);
  var prompt = 'Summarize this blog post in exactly two formats:\n1. X/Twitter: under 280 characters, punchy and engaging\n2. Threads: under 500 characters, conversational\n\nReturn ONLY a JSON object with keys "x" and "threads".\n\nBlog title: ' + title + '\n\nContent:\n' + excerpt;

  var systemPrompt = 'Return only valid JSON. No markdown fences. Never use em-dashes or en-dashes.';
  var messages = [{ role: 'user', content: prompt }];

  var apiPromise;
  if (provider === 'anthropic') apiPromise = callAnthropicAPI(model, apiKey, messages, systemPrompt);
  else if (provider === 'openai') apiPromise = callOpenAIAPI(model, apiKey, messages, systemPrompt);
  else if (provider === 'google' && typeof callGeminiAPI === 'function') apiPromise = callGeminiAPI(model, apiKey, messages, systemPrompt);
  else apiPromise = Promise.reject(new Error('No AI provider configured'));

  apiPromise.then(function(result) {
    var parsed = {};
    try {
      var clean = result.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(pe) {
      parsed = { x: result.substring(0, 280), threads: result.substring(0, 500) };
    }

    // Extract first image from blog if available
    var firstImg = null;
    var imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) firstImg = imgMatch[1];

    // Navigate to Publish tab with pre-filled content
    window._socialPublisherContent = parsed.x || parsed.threads || result;
    if (firstImg) window._socialPublisherImage = firstImg;
    showView('social');
    showSocialTab('publish');
    setTimeout(function() {
      if (typeof renderPublishTab === 'function') renderPublishTab();
      var xEl = document.getElementById('publishPlatformText_x');
      var threadsEl = document.getElementById('publishPlatformText_threads');
      if (xEl && parsed.x) xEl.value = parsed.x;
      if (threadsEl && parsed.threads) threadsEl.value = parsed.threads;
      var perPlat = document.getElementById('publishPerPlatformEdits');
      if (perPlat) perPlat.style.display = 'block';
      showToast('Summary posted to Publish', 'success');
    }, 100);
  }).catch(function(e) {
    console.error('[Blog Post Summary]', e);
    showToast('AI error: ' + e.message, 'error');
  });
}

function blogDeliverSaveToLibrary() {
  var titleEl = document.getElementById('blogTitleInput');
  var editor = blogGetEditor();
  if (!editor) return;
  var htmlContent = editor.innerHTML || '';
  var text = (editor.textContent || editor.innerText || '').trim();
  if (!text) { showToast('Write something first', 'warning'); return; }

  var title = (titleEl && titleEl.value) || 'Untitled Blog Post';
  var wordCount = text.split(/\s+/).filter(Boolean).length;
  var readingTime = Math.max(1, Math.round(wordCount / 200)) + ' min read';

  try {
    var lib = JSON.parse(localStorage.getItem('roweos_library') || '[]');
    var item = {
      id: 'lib_blog_' + Date.now(),
      type: 'blog',
      title: title,
      content: htmlContent,
      wordCount: wordCount,
      readingTime: readingTime,
      createdAt: new Date().toISOString()
    };
    lib.unshift(item);
    localStorage.setItem('roweos_library', JSON.stringify(lib));
    if (typeof writeDB === 'function') {
      writeDB('library/brand', { data: JSON.stringify(lib) }, { category: 'library' });
    }
    showToast('Blog saved to Library', 'success');
  } catch(e) {
    console.error('[Blog Save Library]', e);
    showToast('Save failed: ' + e.message, 'error');
  }
}

// v28.4: Media Lab Help
function showSocialHelp() {
  var modal = document.getElementById('socialHelpModal');
  if (modal) modal.style.display = 'flex';
}
function closeSocialHelp() {
  var modal = document.getElementById('socialHelpModal');
  if (modal) modal.style.display = 'none';
  localStorage.setItem('roweos_social_help_dismissed', 'true');
}

// v28.4: Media Lab Feedback
var _socialFeedbackSentiment = '';

function showSocialFeedback() {
  var modal = document.getElementById('socialFeedbackModal');
  if (modal) modal.style.display = 'flex';
  _socialFeedbackSentiment = '';
}
function closeSocialFeedback() {
  var modal = document.getElementById('socialFeedbackModal');
  if (modal) modal.style.display = 'none';
}
function setSocialFeedbackSentiment(val) {
  _socialFeedbackSentiment = val;
  var up = document.getElementById('feedbackThumbUp');
  var down = document.getElementById('feedbackThumbDown');
  if (up) up.style.borderColor = val === 'positive' ? 'var(--accent)' : 'var(--border-color)';
  if (down) down.style.borderColor = val === 'negative' ? '#e74c3c' : 'var(--border-color)';
}
function submitSocialFeedback() {
  var lastSubmit = parseInt(localStorage.getItem('roweos_feedback_last') || '0');
  if (Date.now() - lastSubmit < 60000) {
    showToast('Please wait before submitting again', 'info');
    return;
  }
  var text = document.getElementById('socialFeedbackText');
  if (!text || !text.value.trim()) { showToast('Please enter feedback', 'error'); return; }
  if (!_socialFeedbackSentiment) { showToast('Please select thumbs up or down', 'error'); return; }

  var user = firebase.auth().currentUser;
  if (!user) return;

  firebase.firestore().collection('roweos_feedback').add({
    uid: user.uid,
    section: 'social_hub',
    text: text.value.trim(),
    sentiment: _socialFeedbackSentiment,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    version: typeof ROWEOS_VERSION !== 'undefined' ? ROWEOS_VERSION : ''
  }).then(function() {
    showToast('Thanks for the feedback!', 'success');
    localStorage.setItem('roweos_feedback_last', String(Date.now()));
    text.value = '';
    _socialFeedbackSentiment = '';
    closeSocialFeedback();
  }).catch(function(err) {
    showToast('Failed to submit: ' + err.message, 'error');
  });
}

// v28.4: Media Lab - Tab switching (renamed from Social Hub)
function showSocialTab(tab) {
  // v28.4: Map legacy tab names to merged Post tab
  if (tab === 'publish' || tab === 'create') tab = 'post';
  // v26.0: Only toggle old-style tab buttons if they still exist
  var tabs = document.querySelectorAll('.social-hub-tab');
  if (tabs.length > 0) {
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
    }
  }
  // v26.0: Update pill nav active state
  if (typeof updatePillNavActive === 'function') updatePillNavActive('socialHubPillNav', tab);
  var panels = document.querySelectorAll('.social-tab-panel');
  for (var j = 0; j < panels.length; j++) {
    panels[j].style.display = 'none';
  }
  var panel = document.getElementById('socialTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panel) panel.style.display = '';
  // v28.4: Render tab content on switch
  if (tab === 'post' && typeof renderPublishTab === 'function') { renderPublishTab(); if (typeof initCreateChat === 'function') initCreateChat(); }
  if (tab === 'media' && typeof showMediaSubTab === 'function') showMediaSubTab('image');
  if (tab === 'settings' && typeof renderSocialSettings === 'function') renderSocialSettings();
  if (tab === 'engage' && typeof initEngageTab === 'function') initEngageTab();
  if (tab === 'activity' && typeof initSocialActivityLog === 'function') initSocialActivityLog();
  if (tab === 'blog' && typeof initBlogTab === 'function') initBlogTab();
  if (tab === 'analytics' && typeof initAnalyticsTab === 'function') initAnalyticsTab();
}

// v25.4: Media tab sub-tab switching
function showMediaSubTab(tab) {
  var imgPanel = document.getElementById('mediaImagePanel');
  var vidPanel = document.getElementById('mediaVideoPanel');
  var imgBtn = document.getElementById('mediaSubImage');
  var vidBtn = document.getElementById('mediaSubVideo');
  if (tab === 'image') {
    if (imgPanel) imgPanel.style.display = '';
    if (vidPanel) vidPanel.style.display = 'none';
    if (imgBtn) imgBtn.classList.add('active');
    if (vidBtn) vidBtn.classList.remove('active');
    renderMediaImageTab();
  } else {
    if (imgPanel) imgPanel.style.display = 'none';
    if (vidPanel) vidPanel.style.display = '';
    if (imgBtn) imgBtn.classList.remove('active');
    if (vidBtn) vidBtn.classList.add('active');
    renderMediaVideoTab();
  }
}

// v28.4: Post tab sub-tab switching (Compose, AI Assist, DMs)
function showPostSubTab(tab) {
  var composePanel = document.getElementById('postComposePanel');
  var aiPanel = document.getElementById('postAIPanel');
  var dmsPanel = document.getElementById('createDMsPanel');
  var composeBtn = document.getElementById('postSubCompose');
  var aiBtn = document.getElementById('postSubAI');
  var dmsBtn = document.getElementById('postSubDMs');
  // Reset all
  if (composePanel) composePanel.style.display = 'none';
  if (aiPanel) aiPanel.style.display = 'none';
  if (dmsPanel) dmsPanel.style.display = 'none';
  if (composeBtn) composeBtn.classList.remove('active');
  if (aiBtn) aiBtn.classList.remove('active');
  if (dmsBtn) dmsBtn.classList.remove('active');
  if (tab === 'compose') {
    if (composePanel) composePanel.style.display = '';
    if (composeBtn) composeBtn.classList.add('active');
  } else if (tab === 'ai') {
    if (aiPanel) aiPanel.style.display = '';
    if (aiBtn) aiBtn.classList.add('active');
    if (typeof initCreateChat === 'function') initCreateChat();
  } else if (tab === 'dms') {
    if (dmsPanel) dmsPanel.style.display = '';
    if (dmsBtn) dmsBtn.classList.add('active');
    initDMsTab();
  }
}
// v28.4: Backwards-compatible alias
function showCreateSubTab(tab) {
  if (tab === 'chat') showPostSubTab('ai');
  else if (tab === 'dms') showPostSubTab('dms');
  else showPostSubTab(tab);
}

// v25.4: Create Tab -- AI Chat
// ────────────────────────────────────────────────────────────────

function initCreateChat() {
  // Load persisted history
  try {
    var raw = localStorage.getItem('roweos_social_create_chat');
    createChatState.messages = raw ? JSON.parse(raw) : [];
  } catch(e) {
    createChatState.messages = [];
  }
  renderCreateThread();
}

function renderCreateThread() {
  var thread = document.getElementById('createChatThread');
  if (!thread) return;
  if (!createChatState.messages.length) {
    thread.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-secondary);font-size:13px;">Start a conversation to craft social posts, generate images, or get hashtag suggestions.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < createChatState.messages.length; i++) {
    var msg = createChatState.messages[i];
    html += renderCreateMessage(msg, i);
  }
  thread.innerHTML = html;
  thread.scrollTop = thread.scrollHeight;
}

function renderCreateMessage(msg, idx) {
  var isUser = msg.role === 'user';
  var bubbleStyle = isUser
    ? 'background:linear-gradient(135deg,rgba(168,152,120,0.18),rgba(184,152,106,0.12));border:1px solid rgba(168,152,120,0.3);border-radius:12px 12px 4px 12px;'
    : 'background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:12px 12px 12px 4px;';
  var align = isUser ? 'margin-left:auto;max-width:80%;' : 'max-width:88%;';
  var content = '';
  // Render markdown via marked.js if available, else plain text
  if (!isUser && typeof marked !== 'undefined') {
    try { content = marked.parse(msg.content || ''); } catch(e) { content = escapeHtml(msg.content || ''); }
  } else {
    content = escapeHtml(msg.content || '');
  }
  var sendToPublishBtn = '';
  if (!isUser && idx > 0) {
    sendToPublishBtn = '<div style="margin-top:8px;">'
      + '<button onclick="sendCreateToPublish(' + idx + ')" style="padding:4px 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-size:11px;">Send to Compose</button>'
      + '</div>';
  }
  return '<div style="display:flex;flex-direction:column;' + align + '">'
    + '<div style="padding:10px 14px;' + bubbleStyle + 'font-size:13px;line-height:1.5;color:var(--text-primary);">'
    + content
    + '</div>'
    + sendToPublishBtn
    + '</div>';
}

function handleCreateChatKey(e) {
  // Cmd/Ctrl+Enter sends; Enter alone is newline
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    sendCreateMessage();
  }
}

function sendCreateMessage() {
  if (createChatState.streaming) return;
  var input = document.getElementById('createChatInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;

  // Apply pending quick action prefix
  var finalText = text;
  if (createChatState.pendingAction) {
    finalText = createChatState.pendingAction + text;
    createChatState.pendingAction = null;
    var lbl = document.getElementById('createQuickActionLabel');
    if (lbl) lbl.style.display = 'none';
  }

  input.value = '';

  // Append user message
  createChatState.messages.push({ role: 'user', content: finalText, ts: Date.now() });
  renderCreateThread();
  _saveCreateChat();

  // Build messages array for API (last 20 to stay under limits)
  var historySlice = createChatState.messages.slice(-20);
  var apiMessages = [];
  for (var i = 0; i < historySlice.length; i++) {
    apiMessages.push({ role: historySlice[i].role, content: historySlice[i].content });
  }

  _streamCreateResponse(apiMessages);
}

function _streamCreateResponse(apiMessages) {
  createChatState.streaming = true;

  // Resolve provider + API key (same routing as BrandAI Studio)
  var provider = localStorage.getItem('selectedProvider') || 'anthropic';
  var apiKeysRaw = localStorage.getItem('roweos_api_keys') || '{}';
  var apiKeys = {};
  try { apiKeys = JSON.parse(apiKeysRaw); } catch(e) {}

  var anthropicKey = apiKeys.anthropic || localStorage.getItem('anthropicApiKey') || '';
  var openaiKey = apiKeys.openai || localStorage.getItem('openaiApiKey') || '';
  var googleKey = apiKeys.google || localStorage.getItem('googleApiKey') || '';

  if (provider === 'anthropic' && !anthropicKey) provider = openaiKey ? 'openai' : googleKey ? 'google' : '';
  if (provider === 'openai' && !openaiKey) provider = anthropicKey ? 'anthropic' : googleKey ? 'google' : '';
  if (provider === 'google' && !googleKey) provider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : '';

  if (!provider) {
    showToast('Add an API key in Settings to use AI chat.', 'warning');
    createChatState.streaming = false;
    return;
  }

  var model;
  if (provider === 'anthropic') model = localStorage.getItem('claudeModel') || 'claude-sonnet-4-6';
  else if (provider === 'openai') model = localStorage.getItem('openaiModel') || 'gpt-5.5';
  else model = localStorage.getItem('googleModel') || 'gemini-2.0-flash';

  var apiKey = provider === 'anthropic' ? anthropicKey : provider === 'openai' ? openaiKey : googleKey;

  // Build system prompt with brand voice context
  var systemPrompt = _buildCreateSystemPrompt();

  // Add streaming placeholder to DOM
  var thread = document.getElementById('createChatThread');
  var placeholderId = 'createStreamPlaceholder';
  if (thread) {
    var placeholder = document.createElement('div');
    placeholder.id = placeholderId;
    placeholder.style.cssText = 'max-width:88%;display:flex;flex-direction:column;';
    placeholder.innerHTML = '<div style="padding:10px 14px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:12px 12px 12px 4px;font-size:13px;line-height:1.5;color:var(--text-secondary);">...</div>';
    thread.appendChild(placeholder);
    thread.scrollTop = thread.scrollHeight;
  }

  // Build flattened conversation string for callStudioAPIStreaming
  var promptForAPI = systemPrompt + '\n\n---\n\n';
  for (var i = 0; i < apiMessages.length; i++) {
    var prefix = apiMessages[i].role === 'user' ? 'User: ' : 'Assistant: ';
    promptForAPI += prefix + apiMessages[i].content + '\n\n';
  }
  promptForAPI += 'Assistant:';

  var accum = '';
  callStudioAPIStreaming(
    provider,
    model,
    apiKey,
    promptForAPI,
    function onChunk(chunk, full) {
      accum = full;
      var el = document.getElementById(placeholderId);
      if (el) {
        var bubble = el.querySelector('div');
        if (bubble) {
          var rendered = '';
          if (typeof marked !== 'undefined') {
            try { rendered = marked.parse(full); } catch(ex) { rendered = escapeHtml(full); }
          } else {
            rendered = escapeHtml(full);
          }
          bubble.innerHTML = rendered;
          bubble.style.color = 'var(--text-primary)';
        }
        var thread2 = document.getElementById('createChatThread');
        if (thread2) thread2.scrollTop = thread2.scrollHeight;
      }
    },
    function onComplete(full) {
      createChatState.streaming = false;
      createChatState.messages.push({ role: 'assistant', content: full, ts: Date.now() });
      _saveCreateChat();
      renderCreateThread();
    },
    function onError(err) {
      createChatState.streaming = false;
      var el = document.getElementById(placeholderId);
      if (el) el.remove();
      showToast('AI error: ' + err, 'error');
    }
  );
}

function _buildCreateSystemPrompt() {
  var brandName = 'this brand';
  var brandVoice = '';
  var brandTagline = '';
  try {
    var brands = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]');
    var settings = JSON.parse(localStorage.getItem('roweos_user_brand_settings') || '{}');
    // v25.5: Read from localStorage (source of truth) instead of potentially stale settings
    var idx = parseInt(localStorage.getItem('roweos_selected_brand') || '0');
    var brand = brands[idx] || {};
    brandName = brand.shortName || brand.name || 'this brand';
    brandVoice = brand.voice || '';
    brandTagline = brand.tagline || '';
  } catch(e) {}
  var prompt = 'You are a social media content strategist for ' + brandName + '.';
  if (brandTagline) prompt += ' Brand tagline: "' + brandTagline + '".';
  if (brandVoice) prompt += ' Brand voice: ' + brandVoice + '.';
  prompt += '\n\nHelp craft compelling social media content. Be aware of platform character limits:'
    + '\n- X (Twitter): 280 characters'
    + '\n- Instagram: 2200 characters (caption)'
    + '\n- Threads: 500 characters'
    + '\n- TikTok: 2200 characters'
    + '\nUse hashtags strategically (5-10 max for most platforms). Write engaging, on-brand copy.'
    + ' When generating posts, present the final post text clearly, formatted for easy copying.'
    + ' When asked to generate an image, describe the image concept in vivid detail instead (image generation is handled separately by the publish flow).';
  return prompt;
}

function _saveCreateChat() {
  try {
    // Keep last 50 messages to avoid localStorage bloat
    var toSave = createChatState.messages.slice(-50);
    localStorage.setItem('roweos_social_create_chat', JSON.stringify(toSave));
  } catch(e) {}
}

function handleCreateQuickAction(action) {
  var prefixes = {
    post: 'Create a social media post about: ',
    image: 'Describe a compelling image concept for a social media post about: ',
    hashtags: 'Suggest relevant hashtags for: ',
    rewrite: 'Rewrite the following for X (280 chars), Instagram (2200 chars), and Threads (500 chars): '
  };
  createChatState.pendingAction = prefixes[action] || '';
  var lbl = document.getElementById('createQuickActionLabel');
  if (lbl) {
    lbl.textContent = 'Mode: ' + document.querySelector('[onclick="handleCreateQuickAction(\'' + action + '\')"]').textContent;
    lbl.style.display = 'block';
  }
  var input = document.getElementById('createChatInput');
  if (input) input.focus();
}

function sendCreateToPublish(messageIdx) {
  var msg = createChatState.messages[messageIdx];
  if (!msg) return;
  // v28.4: Navigate to Compose sub-tab within merged Post tab
  window._socialPublisherContent = msg.content;
  showPostSubTab('compose');
  if (typeof renderPublishTab === 'function') renderPublishTab();
  logSocialActivity('create_to_publish', { description: 'Sent AI-crafted content to Compose' });
}

function clearCreateChat() {
  createChatState.messages = [];
  createChatState.pendingAction = null;
  try { localStorage.removeItem('roweos_social_create_chat'); } catch(e) {}
  renderCreateThread();
  var lbl = document.getElementById('createQuickActionLabel');
  if (lbl) lbl.style.display = 'none';
}

// v25.4: Create Tab -- DMs
// ────────────────────────────────────────────────────────────────

function initDMsTab() {
  var listView = document.getElementById('dmListView');
  var threadView = document.getElementById('dmThreadView');
  if (threadView) threadView.style.display = 'none';
  if (listView) listView.style.display = '';
  loadDMConversations('x');
}

function loadDMConversations(platform) {
  // v25.4: X only for initial release
  var listEl = document.getElementById('dmConversationList');
  if (!listEl) return;

  // Check cache
  try {
    var cacheRaw = localStorage.getItem(dmState.cacheKey);
    if (cacheRaw) {
      var cache = JSON.parse(cacheRaw);
      if (cache.platform === platform && cache.ts && (Date.now() - cache.ts < dmState.cacheTTL)) {
        dmState.conversations = cache.conversations || [];
        renderDMList();
        return;
      }
    }
  } catch(e) {}

  listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Loading...</div>';

  getSocialToken('x').then(function(tokenData) {
    if (!tokenData || !tokenData.access_token) {
      listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">X not connected. Connect X in Media Lab Settings to view DMs.</div>';
      return;
    }
    var token = tokenData.access_token;
    // Proxy request to avoid CORS
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GET',
        endpoint: '/2/dm_conversations?dm_conversation.fields=id,created_at&participant_type=NON_GROUP',
        token: token
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error === 'scope_missing') {
        listEl.innerHTML = '<div style="padding:24px;text-align:center;"><p style="color:var(--text-secondary);font-size:13px;margin-bottom:8px;">X DMs require elevated API access.</p><p style="color:var(--text-tertiary);font-size:12px;">Upgrade your X developer account to Pro tier ($200/mo) and reconnect X to enable DM access.</p></div>';
        return;
      }
      if (data.error === 'token_expired') {
        listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">X connection expired. Please reconnect X in Settings.</div>';
        return;
      }
      if (data.error === 'rate_limited') {
        showToast('Rate limited, try again shortly.', 'warning');
        listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Rate limited. Try again in a moment.</div>';
        return;
      }
      if (data.xError || !data.data) {
        listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Could not load DMs. ' + escapeHtml(data.xError || 'Unknown error') + '</div>';
        return;
      }
      dmState.conversations = data.data || [];
      // Cache result
      try {
        localStorage.setItem(dmState.cacheKey, JSON.stringify({ platform: 'x', ts: Date.now(), conversations: dmState.conversations }));
      } catch(e) {}
      renderDMList();
    })
    .catch(function(err) {
      listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Failed to load DMs. Check network connection.</div>';
    });
  });
}

function renderDMList() {
  var listEl = document.getElementById('dmConversationList');
  if (!listEl) return;
  if (!dmState.conversations.length) {
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-secondary);font-size:13px;">No DM conversations found.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < dmState.conversations.length; i++) {
    var conv = dmState.conversations[i];
    var name = escapeHtml(conv.participantName || conv.id || 'Unknown');
    var preview = escapeHtml(conv.lastMessage || '');
    var ts = conv.lastAt ? _relativeTime(conv.lastAt) : '';
    html += '<div onclick="openDMThread(\'' + escapeHtml(conv.id) + '\',\'' + name + '\')"'
      + ' style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-secondary);cursor:pointer;margin-bottom:8px;">'
      + '<div style="width:36px;height:36px;border-radius:50%;background:var(--bg-tertiary);border:1px solid var(--border-color);flex-shrink:0;display:flex;align-items:center;justify-content:center;">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:600;color:var(--text-primary);">' + name + '</div>'
      + (preview ? '<div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + preview + '</div>' : '')
      + '</div>'
      + (ts ? '<div style="font-size:11px;color:var(--text-tertiary);flex-shrink:0;">' + ts + '</div>' : '')
      + '</div>';
  }
  listEl.innerHTML = html;
}

function openDMThread(conversationId, name) {
  dmState.openConversationId = conversationId;
  dmState.openConversationName = name;
  var listView = document.getElementById('dmListView');
  var threadView = document.getElementById('dmThreadView');
  var titleEl = document.getElementById('dmThreadTitle');
  if (listView) listView.style.display = 'none';
  if (threadView) threadView.style.display = '';
  if (titleEl) titleEl.textContent = name;

  var threadEl = document.getElementById('dmThreadMessages');
  if (threadEl) threadEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">Loading...</div>';

  getSocialToken('x').then(function(tokenData) {
    if (!tokenData || !tokenData.access_token) return;
    var token = tokenData.access_token;
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GET',
        endpoint: '/2/dm_conversations/' + conversationId + '/dm_events?dm_event.fields=id,text,sender_id,created_at',
        token: token
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error === 'rate_limited') {
        showToast('Rate limited, try again shortly.', 'warning');
        return;
      }
      if (data.error === 'token_expired') {
        showToast('X connection expired. Please reconnect X in Settings.', 'warning');
        return;
      }
      dmState.messages = (data.data || []).reverse(); // chronological
      renderDMThread();
    })
    .catch(function() {
      if (threadEl) threadEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">Failed to load messages.</div>';
    });
  });
}

function renderDMThread() {
  var threadEl = document.getElementById('dmThreadMessages');
  if (!threadEl) return;
  if (!dmState.messages.length) {
    threadEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">No messages in this conversation.</div>';
    return;
  }
  // Determine own user ID from stored token data
  var ownUserId = '';
  try {
    var scope = (typeof getSocialKeyScope === 'function') ? getSocialKeyScope() : '';
    var stored = localStorage.getItem('roweos_social_token_x' + scope);
    if (stored) { var td = JSON.parse(stored); ownUserId = td.userId || td.user_id || ''; }
  } catch(e) {}

  var html = '';
  for (var i = 0; i < dmState.messages.length; i++) {
    var msg = dmState.messages[i];
    var isOwn = ownUserId && msg.sender_id === ownUserId;
    var align = isOwn ? 'margin-left:auto;' : '';
    var bgStyle = isOwn
      ? 'background:linear-gradient(135deg,rgba(168,152,120,0.18),rgba(184,152,106,0.12));border:1px solid rgba(168,152,120,0.3);'
      : 'background:var(--bg-tertiary);border:1px solid var(--border-color);';
    var ts = msg.created_at ? _relativeTime(msg.created_at) : '';
    html += '<div style="max-width:80%;' + align + '">'
      + '<div style="padding:8px 12px;border-radius:10px;' + bgStyle + 'font-size:13px;line-height:1.4;color:var(--text-primary);">'
      + escapeHtml(msg.text || '')
      + '</div>'
      + (ts ? '<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;' + (isOwn ? 'text-align:right;' : '') + '">' + ts + '</div>' : '')
      + '</div>';
  }
  threadEl.innerHTML = html;
  threadEl.scrollTop = threadEl.scrollHeight;
}

function closeDMThread() {
  dmState.openConversationId = null;
  var listView = document.getElementById('dmListView');
  var threadView = document.getElementById('dmThreadView');
  if (threadView) threadView.style.display = 'none';
  if (listView) listView.style.display = '';
}

function handleDMReplyKey(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    sendDMReply();
  }
}

function sendDMReply() {
  var input = document.getElementById('dmReplyInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text || !dmState.openConversationId) return;
  input.value = '';
  input.disabled = true;

  getSocialToken('x').then(function(tokenData) {
    if (!tokenData || !tokenData.access_token) {
      showToast('X not connected.', 'warning');
      input.disabled = false;
      return;
    }
    var token = tokenData.access_token;
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'POST',
        endpoint: '/2/dm_conversations/' + dmState.openConversationId + '/messages',
        token: token,
        body: { text: text }
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      input.disabled = false;
      if (data.error === 'rate_limited') { showToast('Rate limited, try again shortly.', 'warning'); return; }
      if (data.error === 'token_expired') { showToast('X connection expired. Please reconnect X in Settings.', 'warning'); return; }
      if (data.xError) { showToast('Failed to send: ' + data.xError, 'error'); return; }
      // Optimistically append sent message
      dmState.messages.push({ text: text, sender_id: '__own__', created_at: new Date().toISOString() });
      renderDMThread();
      logSocialActivity('dm_reply', { description: 'Sent X DM reply' });
    })
    .catch(function() {
      input.disabled = false;
      showToast('Failed to send reply.', 'error');
    });
  });
}

// v25.4: Relative time helper (used by DMs and create thread)
function _relativeTime(isoOrMs) {
  var then = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  var diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function renderMediaImageTab() {
  renderAutoLabImageLab('mediaImagePanel');
}

function renderMediaVideoTab() {
  renderAutoLabVideoLab('mediaVideoPanel');
}

function postMediaToPublish(mediaSrc) {
  window._socialPublisherImage = mediaSrc;
  showView('social');
  showSocialTab('publish');
  setTimeout(function() { if (typeof renderPublishTab === 'function') renderPublishTab(); }, 50);
  showToast('Image attached to Publish', 'success');
  logSocialActivity('image_generated', { description: 'Attached generated image to Publish' });
}

// v28.4: Render Media Lab Settings tab
function renderSocialSettings() {
  try {
  var el = document.getElementById('socialSettingsContainer') || document.getElementById('socialTabSettings');
  if (!el) { console.error('[Social] Settings container not found'); return; }

  var html = '';
  html += '<h3 style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text-primary);">Connected Accounts</h3>';

  // Scope indicator
  var scope = '';
  try { scope = typeof getSocialKeyScope === 'function' ? getSocialKeyScope() : ''; } catch(e) { scope = '_brand_0'; }
  var brands = [];
  try { brands = JSON.parse(localStorage.getItem('roweos_brands') || '[]'); } catch(e) {}
  var brandIdx = parseInt((scope || '').replace('_brand_', '').replace('_life_', '')) || 0;
  var brandName = '';
  if (scope.indexOf('_brand_') >= 0 && brands[brandIdx]) {
    brandName = brands[brandIdx].shortName || brands[brandIdx].name || '';
  }
  if (brandName) {
    html += '<p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px;">Connections for: ' + escapeHtml(brandName) + '</p>';
  }

  // Platform cards
  var platforms = [
    { id: 'x', name: 'X', icon: '<path d="M4 4l6.5 8L4 20h2l5.5-6.8L16 20h4l-7-8.5L19.5 4H18l-5 6.2L9 4z"/>' },
    { id: 'threads', name: 'Threads', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M8.5 9.5C9.5 8.5 10.5 8 12 8s2.5.5 3.5 1.5"/>' },
    { id: 'instagram', name: 'Instagram', icon: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/>' },
    { id: 'tiktok', name: 'TikTok', icon: '<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>' }
  ];

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:24px;">';
  for (var i = 0; i < platforms.length; i++) {
    var p = platforms[i];
    var connected = false;
    var handle = '';
    try { connected = typeof isSocialConnected === 'function' ? isSocialConnected(p.id) : false; } catch(e) {}
    try { handle = typeof getSocialHandle === 'function' ? getSocialHandle(p.id) : ''; } catch(e) {}
    html += '<div style="padding:16px;border-radius:12px;border:1px solid var(--border-color);background:var(--bg-secondary);">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
    html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + p.icon + '</svg>';
    html += '<span style="font-weight:600;color:var(--text-primary);">' + p.name + '</span>';
    if (connected) {
      html += '<span style="width:8px;height:8px;border-radius:50%;background:#4ade80;margin-left:auto;"></span>';
    }
    html += '</div>';
    if (connected) {
      html += '<div style="font-size:12px;color:var(--accent);margin-bottom:8px;">@' + escapeHtml(handle || '') + '</div>';
      html += '<button onclick="disconnectSocialAccount(\'' + p.id + '\');renderSocialSettings();" style="padding:4px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:#dc2626;cursor:pointer;font-size:12px;">Disconnect</button>';
    } else {
      html += '<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px;">Not connected</div>';
      html += '<button onclick="connectSocialAccount(\'' + p.id + '\')" style="padding:4px 12px;border-radius:6px;border:1px solid var(--accent);background:var(--brand-accent-10);color:var(--accent);cursor:pointer;font-size:12px;">Connect</button>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Scavenger configs section with full CRUD
  html += '<h3 style="font-size:16px;font-weight:600;margin-bottom:16px;margin-top:32px;color:var(--text-primary);">Scavenger Configs</h3>';
  html += '<button onclick="addScavengerConfig()" style="padding:6px 14px;border-radius:8px;background:var(--brand-accent-10);color:var(--accent);border:1px solid var(--accent);cursor:pointer;font-size:12px;margin-bottom:12px;">+ Add Config</button>';
  var configs = getScavengerConfigs();
  if (configs.length === 0) {
    html += '<p style="color:var(--text-tertiary);font-size:13px;">No scavenger configs yet.</p>';
  } else {
    for (var c = 0; c < configs.length; c++) {
      var cfg = configs[c];
      html += '<div style="padding:12px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:8px;background:var(--bg-secondary);">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<span style="font-weight:600;color:var(--text-primary);">' + escapeHtml(cfg.configName || 'Unnamed') + '</span>';
      html += '<div style="display:flex;gap:8px;align-items:center;">';
      html += '<span class="scavenger-status-badge ' + (cfg.active ? 'posted' : 'rejected') + '">' + (cfg.active ? 'Active' : 'Inactive') + '</span>';
      html += '<button onclick="editScavengerConfig(' + c + ')" style="padding:2px 8px;border-radius:4px;border:1px solid var(--border-color);background:none;color:var(--text-secondary);cursor:pointer;font-size:11px;">Edit</button>';
      html += '<button onclick="deleteScavengerConfig(' + c + ')" style="padding:2px 8px;border-radius:4px;border:1px solid rgba(239,68,68,0.3);background:none;color:#dc2626;cursor:pointer;font-size:11px;">Delete</button>';
      html += '</div></div>';
      html += '<div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">' + escapeHtml((Array.isArray(cfg.keywords) ? cfg.keywords : (cfg.keywords || '').split(',')).join(', ')) + '</div>';
      // Inline editor (hidden by default, shown on Edit click)
      html += '<div id="scavConfigEditor_' + c + '" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);">';
      html += '<div style="display:grid;gap:8px;">';
      html += '<input id="scavCfg_name_' + c + '" value="' + escapeHtml(cfg.configName || '') + '" placeholder="Config Name" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<input id="scavCfg_keywords_' + c + '" value="' + escapeHtml((Array.isArray(cfg.keywords) ? cfg.keywords : (cfg.keywords || '').split(',')).join(', ')) + '" placeholder="Keywords (comma-separated)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      // v25.5: Keyword Groups editor
      html += '<div class="scavCfg_groups_' + c + '" style="margin-top:12px;"><label style="font-size:13px;color:var(--text-secondary);font-weight:500;">Keyword Groups</label>';
      var kwGroups = cfg.keywordGroups || [];
      var allCfgKws = typeof cfg.keywords === 'string' ? cfg.keywords.split(',') : (cfg.keywords || []);
      for (var gi = 0; gi < kwGroups.length; gi++) {
        html += '<div class="keyword-group-row" data-group-idx="' + gi + '" data-config-idx="' + c + '" style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">';
        html += '<input type="text" value="' + escapeHtml(kwGroups[gi].name) + '" placeholder="Group name" style="width:120px;padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;">';
        for (var ki = 0; ki < allCfgKws.length; ki++) {
          var kwTrimmed = allCfgKws[ki].trim();
          if (!kwTrimmed) continue;
          var kwChecked = (kwGroups[gi].keywords || []).indexOf(kwTrimmed) >= 0 ? ' checked' : '';
          html += '<label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:2px;"><input type="checkbox" value="' + escapeHtml(kwTrimmed) + '"' + kwChecked + '>' + escapeHtml(kwTrimmed) + '</label>';
        }
        html += '<button onclick="removeKeywordGroup(this)" style="padding:2px 6px;border:none;background:none;color:var(--text-tertiary);cursor:pointer;font-size:16px;">x</button>';
        html += '</div>';
      }
      html += '<button onclick="addKeywordGroup(this,' + c + ')" style="margin-top:8px;padding:4px 12px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;font-size:12px;">+ Add Group</button>';
      html += '</div>';
      html += '<select id="scavCfg_tone_' + c + '" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      var tones = ['Thought Leader', 'Conversational', 'Professional'];
      for (var tn = 0; tn < tones.length; tn++) {
        html += '<option' + (cfg.tonePriority === tones[tn] ? ' selected' : '') + '>' + tones[tn] + '</option>';
      }
      html += '</select>';
      html += '<textarea id="scavCfg_prompt_' + c + '" placeholder="Custom Prompt" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;min-height:60px;">' + escapeHtml(cfg.customPrompt || '') + '</textarea>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
      html += '<input id="scavCfg_interval_' + c + '" type="number" value="' + (cfg.pollingIntervalMin || 15) + '" placeholder="Poll interval (min)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<input id="scavCfg_maxHour_' + c + '" type="number" value="' + (cfg.maxPerHour || 5) + '" placeholder="Max/hour" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<input id="scavCfg_maxDay_' + c + '" type="number" value="' + (cfg.maxPerDay || 20) + '" placeholder="Max/day" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '</div>';
      html += '<input id="scavCfg_threshold_' + c + '" type="number" value="' + (cfg.autoPostThreshold || '') + '" placeholder="Auto-post threshold (0-100, blank=manual)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<input id="scavCfg_avoid_' + c + '" value="' + escapeHtml((Array.isArray(cfg.avoidAccounts) ? cfg.avoidAccounts : (cfg.avoidAccounts || '').split(',')).join(', ')) + '" placeholder="Avoid accounts (comma-separated)" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">';
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);"><input type="checkbox" id="scavCfg_active_' + c + '"' + (cfg.active ? ' checked' : '') + '> Active</label>';
      html += '<button onclick="saveScavengerConfigEdit(' + c + ')" style="padding:6px 14px;border-radius:6px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:13px;">Save</button>';
      html += '</div></div>';
      html += '</div>';
    }
  }

  el.innerHTML = html;

  // v25.5: Trigger guided tour after first connection
  if (localStorage.getItem('roweos_social_tour_complete') !== 'true') {
    var anyConnected = false;
    var tourPlatforms = ['x', 'threads', 'instagram', 'tiktok'];
    for (var ti = 0; ti < tourPlatforms.length; ti++) {
      if (isSocialConnected(tourPlatforms[ti])) { anyConnected = true; break; }
    }
    if (anyConnected) {
      setTimeout(function() { startSocialTour(); }, 500);
    }
  }

  } catch(err) {
    console.error('[Social] renderSocialSettings error:', err);
    var el2 = document.getElementById('socialSettingsContainer') || document.getElementById('socialTabSettings');
    if (el2) el2.innerHTML = '<p style="color:#ef4444;padding:20px;">Error loading settings: ' + err.message + '</p>';
  }
}

// v28.4: Media Lab Guided Tour
var _socialTourSteps = [
  { tab: 'settings', title: 'Settings', desc: 'Connect your social accounts here' },
  { tab: 'post', title: 'Post', desc: 'Compose, publish, and draft content with AI' },
  { tab: 'engage', title: 'Engage', desc: 'Find relevant posts and draft replies' },
  { tab: 'blog', title: 'Blog', desc: 'Write blog posts with AI assistance' },
  { tab: 'analytics', title: 'Analytics', desc: 'Track your social performance' }
];
var _socialTourStep = 0;

function startSocialTour() {
  if (localStorage.getItem('roweos_social_tour_complete') === 'true') return;
  _socialTourStep = 0;
  showSocialTourStep();
}

function showSocialTourStep() {
  var old = document.getElementById('socialTourOverlay');
  if (old) old.remove();

  if (_socialTourStep >= _socialTourSteps.length) {
    localStorage.setItem('roweos_social_tour_complete', 'true');
    return;
  }

  var step = _socialTourSteps[_socialTourStep];
  // v26.0: Try pill nav first, fall back to old tab buttons
  var tabBtn = document.querySelector('.social-hub-tab[data-tab="' + step.tab + '"]');
  if (!tabBtn) {
    var pillContainer = document.getElementById('socialHubPillNav');
    if (pillContainer) tabBtn = pillContainer.querySelector('[data-pill-id="' + step.tab + '"]');
  }
  if (!tabBtn) { _socialTourStep++; showSocialTourStep(); return; }

  var rect = tabBtn.getBoundingClientRect();

  var overlay = document.createElement('div');
  overlay.id = 'socialTourOverlay';
  overlay.className = 'social-tour-overlay';

  var spotlight = document.createElement('div');
  spotlight.className = 'social-tour-spotlight';
  spotlight.style.top = (rect.top - 4) + 'px';
  spotlight.style.left = (rect.left - 4) + 'px';
  spotlight.style.width = (rect.width + 8) + 'px';
  spotlight.style.height = (rect.height + 8) + 'px';

  var tooltip = document.createElement('div');
  tooltip.className = 'social-tour-tooltip';
  tooltip.style.top = (rect.bottom + 12) + 'px';
  tooltip.style.left = Math.max(8, rect.left) + 'px';
  tooltip.innerHTML = '<h4>' + step.title + '</h4>'
    + '<p>' + step.desc + '</p>'
    + '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px;">' + (_socialTourStep + 1) + ' of ' + _socialTourSteps.length + '</div>'
    + '<div class="social-tour-actions">'
    + '<button class="social-tour-skip" onclick="skipSocialTour()">Skip</button>'
    + '<button class="social-tour-next" onclick="nextSocialTourStep()">' + (_socialTourStep < _socialTourSteps.length - 1 ? 'Next' : 'Done') + '</button>'
    + '</div>';

  overlay.appendChild(spotlight);
  overlay.appendChild(tooltip);
  document.body.appendChild(overlay);
}

function nextSocialTourStep() {
  _socialTourStep++;
  showSocialTourStep();
}

function skipSocialTour() {
  var old = document.getElementById('socialTourOverlay');
  if (old) old.remove();
  localStorage.setItem('roweos_social_tour_complete', 'true');
}

function replaySocialTour() {
  // v25.5: Called from help modal "Replay guided tour" link
  var helpModal = document.getElementById('socialHelpModal');
  if (helpModal) helpModal.style.display = 'none';
  localStorage.removeItem('roweos_social_tour_complete');
  _socialTourStep = 0;
  showSocialTourStep();
}

function editScavengerConfig(index) {
  var editor = document.getElementById('scavConfigEditor_' + index);
  if (!editor) return;
  editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
}

function saveScavengerConfigEdit(index) {
  var configs = getScavengerConfigs();
  if (!configs[index]) return;
  configs[index].configName = document.getElementById('scavCfg_name_' + index).value;
  configs[index].keywords = document.getElementById('scavCfg_keywords_' + index).value.split(',').map(function(k) { return k.trim(); }).filter(function(k) { return k; });
  configs[index].tonePriority = document.getElementById('scavCfg_tone_' + index).value;
  configs[index].customPrompt = document.getElementById('scavCfg_prompt_' + index).value;
  configs[index].pollingIntervalMin = parseInt(document.getElementById('scavCfg_interval_' + index).value) || 15;
  configs[index].maxPerHour = parseInt(document.getElementById('scavCfg_maxHour_' + index).value) || 5;
  configs[index].maxPerDay = parseInt(document.getElementById('scavCfg_maxDay_' + index).value) || 20;
  configs[index].autoPostThreshold = parseInt(document.getElementById('scavCfg_threshold_' + index).value) || 0;
  configs[index].avoidAccounts = document.getElementById('scavCfg_avoid_' + index).value.split(',').map(function(a) { return a.trim(); }).filter(function(a) { return a; });
  configs[index].active = document.getElementById('scavCfg_active_' + index).checked;
  // v25.5: Extract keyword groups
  var groupsContainer = document.querySelector('.scavCfg_groups_' + index);
  var keywordGroups = [];
  if (groupsContainer) {
    var groupRows = groupsContainer.querySelectorAll('.keyword-group-row');
    for (var gi = 0; gi < groupRows.length; gi++) {
      var nameInput = groupRows[gi].querySelector('input[type="text"]');
      var checkboxes = groupRows[gi].querySelectorAll('input[type="checkbox"]:checked');
      var groupKws = [];
      for (var ci = 0; ci < checkboxes.length; ci++) groupKws.push(checkboxes[ci].value);
      if (nameInput && nameInput.value.trim()) {
        keywordGroups.push({ name: nameInput.value.trim(), keywords: groupKws });
      }
    }
  }
  configs[index].keywordGroups = keywordGroups;
  saveScavengerConfigs(configs);
  renderSocialSettings();
  logSocialActivity('config_changed', { description: 'Updated scavenger config: ' + configs[index].configName, configName: configs[index].configName });
  showToast('Config saved', 'success');
}

function addScavengerConfig() {
  var configs = getScavengerConfigs();
  configs.push({
    id: String(Date.now()),
    configName: 'New Config',
    keywords: [],
    tonePriority: 'Thought Leader',
    customPrompt: '',
    pollingIntervalMin: 15,
    maxPerHour: 5,
    maxPerDay: 20,
    autoPostThreshold: 0,
    avoidAccounts: [],
    active: false
  });
  saveScavengerConfigs(configs);
  renderSocialSettings();
  logSocialActivity('config_changed', { description: 'Added new scavenger config' });
}

function deleteScavengerConfig(index) {
  if (!confirm('Delete this scavenger config?')) return;
  var configs = getScavengerConfigs();
  configs.splice(index, 1);
  saveScavengerConfigs(configs);
  renderSocialSettings();
  logSocialActivity('config_changed', { description: 'Deleted scavenger config' });
  showToast('Config deleted', 'info');
}

// v25.5: Add/remove keyword groups in config editor
function addKeywordGroup(btn, configIdx) {
  var container = btn.parentElement;
  var idx = container.querySelectorAll('.keyword-group-row').length;
  var row = document.createElement('div');
  row.className = 'keyword-group-row';
  row.setAttribute('data-group-idx', idx);
  row.setAttribute('data-config-idx', configIdx);
  row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;';
  // Get keywords from the keywords input for this config
  var kwInput = document.getElementById('scavCfg_keywords_' + configIdx);
  var kwList = kwInput ? kwInput.value.split(',') : [];
  var rowHtml = '<input type="text" value="" placeholder="Group name" style="width:120px;padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;">';
  for (var ki = 0; ki < kwList.length; ki++) {
    var kwT = kwList[ki].trim();
    if (!kwT) continue;
    rowHtml += '<label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:2px;"><input type="checkbox" value="' + escapeHtml(kwT) + '">' + escapeHtml(kwT) + '</label>';
  }
  rowHtml += '<button onclick="removeKeywordGroup(this)" style="padding:2px 6px;border:none;background:none;color:var(--text-tertiary);cursor:pointer;font-size:16px;">x</button>';
  row.innerHTML = rowHtml;
  container.insertBefore(row, btn);
}

function removeKeywordGroup(btn) {
  var el = btn.parentElement;
  while (el && (!el.className || el.className.indexOf('keyword-group-row') === -1)) el = el.parentElement;
  if (el) el.parentElement.removeChild(el);
}

// v25.4: Render Publish tab compose area
function renderPublishTab() {
  var el = document.getElementById('socialPublishCompose');
  if (!el) return;

  var platforms = ['x', 'threads', 'instagram', 'tiktok'];
  var html = '';

  // Caption input
  html += '<textarea id="publishCaption" placeholder="What do you want to share?" style="width:100%;min-height:100px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:14px;resize:vertical;font-family:inherit;" oninput="updatePublishCharCount()"></textarea>';
  html += '<div id="publishCharCount" style="text-align:right;font-size:11px;color:var(--text-tertiary);margin-top:4px;"></div>';

  // Image attachment
  html += '<div style="margin:12px 0;">';
  html += '<div id="publishImagePreview" style="display:none;margin-bottom:8px;"></div>';
  html += '<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;font-size:13px;">';
  html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  html += 'Attach Image';
  html += '<input type="file" accept="image/*" onchange="attachPublishImage(this)" style="display:none;">';
  html += '</label>';
  html += '</div>';

  // Platform cards
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin:12px 0;">';
  for (var i = 0; i < platforms.length; i++) {
    var p = platforms[i];
    var connected = isSocialConnected(p);
    var handle = getSocialHandle(p);
    var names = { x: 'X', threads: 'Threads', instagram: 'Instagram', tiktok: 'TikTok' };
    html += '<div class="social-platform-card' + (connected ? ' connected' : '') + '" id="publishPlatform_' + p + '" onclick="togglePublishPlatform(\'' + p + '\')" style="padding:10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);cursor:pointer;text-align:center;">';
    html += '<div style="font-weight:600;font-size:13px;color:var(--text-primary);">' + names[p] + '</div>';
    if (connected) {
      html += '<div style="font-size:11px;color:var(--accent);">@' + escapeHtml(handle || '') + '</div>';
    } else {
      html += '<div style="font-size:11px;color:var(--text-tertiary);">Not connected</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Per-platform text editing
  html += '<div style="margin:8px 0;">';
  html += '<button onclick="togglePerPlatformEdit()" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border-color);background:none;color:var(--text-secondary);cursor:pointer;font-size:11px;">Per-platform text editing</button>';
  html += '<div id="publishPerPlatformEdits" style="display:none;margin-top:8px;">';
  var platNames = { x: 'X (280)', threads: 'Threads (500)', instagram: 'Instagram (2200)', tiktok: 'TikTok (2200)' };
  var platKeys = ['x', 'threads', 'instagram', 'tiktok'];
  for (var pe = 0; pe < platKeys.length; pe++) {
    html += '<div style="margin-bottom:6px;"><label style="font-size:11px;color:var(--text-tertiary);">' + platNames[platKeys[pe]] + '</label>';
    html += '<textarea id="publishPlatformText_' + platKeys[pe] + '" placeholder="Leave blank to use main caption" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;min-height:40px;resize:vertical;font-family:inherit;"></textarea></div>';
  }
  html += '</div></div>';

  // Action buttons (3 buttons per spec)
  html += '<div style="display:flex;gap:8px;margin-top:16px;">';
  html += '<button onclick="publishPostNow()" style="padding:8px 20px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;">Post Now</button>';
  html += '<button onclick="publishSchedulePost()" style="padding:8px 20px;border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:13px;">Schedule</button>';
  html += '<button onclick="addToPublishOutbox()" style="padding:8px 20px;border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:13px;">Add to Outbox</button>';
  html += '</div>';

  // Post history
  html += '<div style="margin-top:24px;">';
  html += '<h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Recent Posts</h3>';
  var history = [];
  try { history = JSON.parse(localStorage.getItem('roweos_social_post_history') || '[]'); } catch(e) {}
  if (history.length === 0) {
    html += '<p style="color:var(--text-tertiary);font-size:13px;">No posts yet.</p>';
  } else {
    for (var h = 0; h < Math.min(history.length, 10); h++) {
      var post = history[h];
      html += '<div style="padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13px;">';
      html += '<span style="color:var(--text-tertiary);">' + escapeHtml(post.platform || '') + '</span> &middot; ';
      html += '<span style="color:var(--text-secondary);">' + escapeHtml((post.content || '').substring(0, 80)) + '</span>';
      if (post.postUrl) html += ' <a href="' + escapeHtml(post.postUrl) + '" target="_blank" style="color:var(--accent);font-size:11px;">View</a>';
      html += '</div>';
    }
  }
  html += '</div>';

  el.innerHTML = html;

  // Pre-fill if content was passed via showSocialPublisher()
  if (window._socialPublisherContent) {
    var caption = document.getElementById('publishCaption');
    if (caption) caption.value = window._socialPublisherContent;
    window._socialPublisherContent = null;
    updatePublishCharCount();
  }
  if (window._socialPublisherImage) {
    showPublishImagePreview(window._socialPublisherImage);
    window._socialPublisherImage = null;
  }

  // Render outbox
  renderPublishOutbox();
}

var _publishSelectedPlatforms = { x: true, threads: true, instagram: true, tiktok: false };
var _publishAttachedImage = null;

function togglePerPlatformEdit() {
  var el = document.getElementById('publishPerPlatformEdits');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function getPublishTextForPlatform(platform) {
  var perPlat = document.getElementById('publishPlatformText_' + platform);
  if (perPlat && perPlat.value.trim()) return perPlat.value.trim();
  var main = document.getElementById('publishCaption');
  return main ? main.value.trim() : '';
}

function togglePublishPlatform(platform) {
  _publishSelectedPlatforms[platform] = !_publishSelectedPlatforms[platform];
  var card = document.getElementById('publishPlatform_' + platform);
  if (card) {
    card.style.borderColor = _publishSelectedPlatforms[platform] ? 'var(--accent)' : 'var(--border-color)';
    card.style.opacity = _publishSelectedPlatforms[platform] ? '1' : '0.5';
  }
}

function updatePublishCharCount() {
  var caption = document.getElementById('publishCaption');
  var countEl = document.getElementById('publishCharCount');
  if (!caption || !countEl) return;
  var len = caption.value.length;
  var limits = { x: 280, threads: 500, instagram: 2200, tiktok: 2200 };
  var parts = [];
  var keys = Object.keys(limits);
  for (var i = 0; i < keys.length; i++) {
    if (_publishSelectedPlatforms[keys[i]]) {
      var color = len > limits[keys[i]] ? '#ef4444' : 'var(--text-tertiary)';
      parts.push('<span style="color:' + color + ';">' + keys[i].charAt(0).toUpperCase() + keys[i].slice(1) + ': ' + len + '/' + limits[keys[i]] + '</span>');
    }
  }
  countEl.innerHTML = parts.join(' &middot; ');
}

function attachPublishImage(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    _publishAttachedImage = e.target.result;
    showPublishImagePreview(e.target.result);
  };
  reader.readAsDataURL(input.files[0]);
}

function showPublishImagePreview(src) {
  _publishAttachedImage = src;
  var preview = document.getElementById('publishImagePreview');
  if (!preview) return;
  preview.style.display = 'block';
  preview.innerHTML = '<div style="position:relative;display:inline-block;"><img src="' + src + '" style="max-height:120px;border-radius:8px;border:1px solid var(--border-color);"><button onclick="removePublishImage()" style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-secondary);cursor:pointer;font-size:14px;line-height:18px;">&times;</button></div>';
}

function removePublishImage() {
  _publishAttachedImage = null;
  var preview = document.getElementById('publishImagePreview');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
}

function publishPostNow() {
  var caption = document.getElementById('publishCaption');
  var hasContent = caption && caption.value.trim();
  var hasImage = !!_publishAttachedImage;
  // v25.5: Allow image-only posts (no caption required if image attached)
  if (!hasContent && !hasImage) {
    showToast('Enter a caption or attach an image', 'error');
    return;
  }
  var platforms = [];
  var keys = Object.keys(_publishSelectedPlatforms);
  for (var i = 0; i < keys.length; i++) {
    if (_publishSelectedPlatforms[keys[i]]) platforms.push(keys[i]);
  }
  if (platforms.length === 0) {
    showToast('Select at least one platform', 'error');
    return;
  }

  // Check TikTok requires media
  if (_publishSelectedPlatforms.tiktok && !_publishAttachedImage) {
    showToast('TikTok requires an image or video', 'error');
    return;
  }

  // v25.5: Set globals that postToSocial reads (correct 2-arg calling convention)
  var content = caption ? caption.value.trim() : '';
  window._socialPublisherContent = content;
  window._socialPublisherImage = _publishAttachedImage || null;
  // v25.5: Always build per-platform edited content map to avoid edge cases
  window._socialPublisherEditedContent = {};
  for (var pi = 0; pi < platforms.length; pi++) {
    window._socialPublisherEditedContent[platforms[pi]] = getPublishTextForPlatform(platforms[pi]);
  }

  showToast('Posting to ' + platforms.join(', ') + '...', 'info');

  var posted = 0;
  var errors = [];
  for (var j = 0; j < platforms.length; j++) {
    (function(p) {
      postToSocial(p, { silent: false })
        .then(function(result) {
          posted++;
          if (result && result.success) {
            showToast(p + ': Posted!', 'success');
            logSocialActivity('post_published', { platform: p, description: 'Posted to ' + p + ': ' + (window._socialPublisherEditedContent && window._socialPublisherEditedContent[p] ? window._socialPublisherEditedContent[p].substring(0, 80) : ''), postUrl: result.postUrl || '' });
          } else {
            errors.push(p + ': ' + (result ? result.error : 'Failed'));
          }
          if (posted === platforms.length && errors.length > 0) {
            showToast(errors.join(', '), 'error');
          }
        })
        .catch(function(err) {
          posted++;
          errors.push(p + ': ' + err.message);
          if (posted === platforms.length) showToast(errors.join(', '), 'error');
        });
    })(platforms[j]);
  }

  // v25.5: Clear publisher globals after all posts dispatched
  window._socialPublisherContent = '';
  window._socialPublisherImage = null;
  window._socialPublisherEditedContent = null;

  // Clear compose area
  caption.value = '';
  removePublishImage();
  updatePublishCharCount();
}

function togglePublishOutbox() {
  var list = document.getElementById('publishOutboxList');
  var chevron = document.getElementById('publishOutboxChevron');
  if (!list) return;
  var showing = list.style.display !== 'none';
  list.style.display = showing ? 'none' : 'block';
  if (chevron) chevron.style.transform = showing ? '' : 'rotate(180deg)';
}

function addToPublishOutbox() {
  var caption = document.getElementById('publishCaption');
  if (!caption || !caption.value.trim()) {
    showToast('Enter a caption first', 'error');
    return;
  }
  var platforms = [];
  var keys = Object.keys(_publishSelectedPlatforms);
  for (var i = 0; i < keys.length; i++) {
    if (_publishSelectedPlatforms[keys[i]]) platforms.push(keys[i]);
  }
  addToSocialOutbox(platforms.join(','), caption.value.trim(), _publishAttachedImage);
  caption.value = '';
  removePublishImage();
  updatePublishCharCount();
  renderPublishOutbox();
  showToast('Added to outbox', 'success');
}

function editOutboxItem(itemId) {
  var outbox = getSocialOutbox();
  var item = null;
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].id === itemId) { item = outbox[i]; break; }
  }
  if (!item) return;
  var newContent = prompt('Edit post content:', item.content || '');
  if (newContent === null) return;
  item.content = newContent;
  saveSocialOutbox(outbox);
  renderPublishOutbox();
  showToast('Outbox item updated', 'success');
}

function renderPublishOutbox() {
  var outbox = getSocialOutbox();
  var header = document.getElementById('publishOutboxHeader');
  if (header) header.textContent = 'Outbox (' + outbox.length + ' pending)';
  var list = document.getElementById('publishOutboxList');
  if (!list) return;
  if (outbox.length === 0) {
    list.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;padding:8px 0;">No posts in outbox</p>';
    return;
  }
  var html = '';
  for (var i = 0; i < outbox.length; i++) {
    var item = outbox[i];
    html += '<div style="padding:10px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:8px;background:var(--bg-secondary);">';
    html += '<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px;">' + escapeHtml(item.platform || '') + ' &middot; ' + (item.timestamp ? new Date(item.timestamp).toLocaleString() : '') + '</div>';
    html += '<div style="font-size:13px;color:var(--text-primary);margin-bottom:8px;">' + escapeHtml((item.content || '').substring(0, 100)) + '</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="socialOutboxSend(\'' + item.id + '\');renderPublishOutbox();" style="padding:4px 10px;border-radius:6px;background:rgba(74,222,128,0.15);color:#16a34a;border:none;cursor:pointer;font-size:12px;">Post Now</button>';
    html += '<button onclick="editOutboxItem(\'' + item.id + '\')" style="padding:4px 10px;border-radius:6px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:12px;">Edit</button>';
    html += '<button onclick="socialOutboxDelete(\'' + item.id + '\');renderPublishOutbox();" style="padding:4px 10px;border-radius:6px;background:rgba(239,68,68,0.1);color:#dc2626;border:none;cursor:pointer;font-size:12px;">Delete</button>';
    html += '</div></div>';
  }
  list.innerHTML = html;
}

function publishSchedulePost() {
  var caption = document.getElementById('publishCaption');
  if (!caption || !caption.value.trim()) {
    showToast('Enter a caption first', 'error');
    return;
  }
  // Route to automation scheduler with social post data
  scheduleSocialPost('all');
}

// v26.3: Scavenger config persistence
function getScavengerConfigs() {
  try {
    var raw = localStorage.getItem('roweos_scavenger_configs');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveScavengerConfigs(configs) {
  try {
    localStorage.setItem('roweos_scavenger_configs', JSON.stringify(configs));
  } catch (e) { console.warn('[Scavenger] localStorage save failed:', e); }
  if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
    var uid = firebase.auth().currentUser.uid;
    var db = firebase.firestore();
    for (var i = 0; i < configs.length; i++) {
      var config = configs[i];
      var docId = config.id || String(Date.now()) + '_' + i;
      config.id = docId;
      config.updatedAt = new Date().toISOString();
      if (!config.createdAt) config.createdAt = config.updatedAt;
      db.doc('roweos_users/' + uid + '/scavenger_configs/' + docId)
        .set(config, { merge: true })
        .catch(function(e) { console.warn('[Scavenger] Firestore save error:', e); });
    }
  }
}

function loadScavengerConfigsFromFirestore() {
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  firebase.firestore().collection('roweos_users/' + uid + '/scavenger_configs')
    .get()
    .then(function(snap) {
      if (snap.empty) return;
      var configs = [];
      snap.forEach(function(doc) {
        var data = doc.data();
        data.id = doc.id;
        configs.push(data);
      });
      localStorage.setItem('roweos_scavenger_configs', JSON.stringify(configs));
      console.log('[Scavenger] Loaded', configs.length, 'configs from Firestore');
    })
    .catch(function(e) { console.warn('[Scavenger] Firestore load error:', e); });
}

// v25.4: Social activity log utility
function logSocialActivity(type, details) {
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var platform = details.platform || '';
  var description = details.description || '';
  var automatic = details.automatic || false;
  // Remove fields that are top-level to avoid duplication
  var cleanDetails = {};
  var keys = Object.keys(details);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] !== 'platform' && keys[i] !== 'description' && keys[i] !== 'automatic') {
      cleanDetails[keys[i]] = details[keys[i]];
    }
  }
  var entry = {
    type: type,
    platform: platform,
    description: description,
    details: cleanDetails,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    automatic: automatic
  };
  firebase.firestore().collection('roweos_users/' + uid + '/social_activity').add(entry)
    .then(function(docRef) {
      // v28.0: Dual-write social activity to v4
      if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
        try { syncEngine.write('social_activity', docRef.id, entry); } catch(_e) {}
      }
    })
    .catch(function(e) { console.warn('[Social] Activity log error:', e); });
}

// v25.4: Activity log state
var activityLogState = {
  entries: [],
  filter: 'all',
  lastDoc: null,
  pageSize: 30,
  listener: null
};

function initSocialActivityLog() {
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();

  if (activityLogState.listener) activityLogState.listener();
  activityLogState.listener = db.collection('roweos_users/' + uid + '/social_activity')
    .orderBy('timestamp', 'desc')
    .limit(activityLogState.pageSize)
    .onSnapshot(function(snap) {
      activityLogState.entries = [];
      activityLogState.lastDoc = null;
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        activityLogState.entries.push(data);
        activityLogState.lastDoc = doc;
      });
      renderActivityLog();
    }, function(err) {
      console.warn('[Activity] Listener error:', err);
    });
}

function filterActivityLog(filter) {
  activityLogState.filter = filter;
  var btns = document.querySelectorAll('#activityFilterBar .scavenger-filter-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].textContent.toLowerCase() === filter || (filter === 'all' && btns[i].textContent === 'All'));
  }
  renderActivityLog();
}

function renderActivityLog() {
  var container = document.getElementById('activityLogList');
  var emptyState = document.getElementById('activityEmptyState');
  var loadMore = document.getElementById('activityLoadMore');
  if (!container) return;

  var typeGroups = {
    posts: ['post_published'],
    scavenger: ['scavenger_reply', 'scavenger_rejected'],
    media: ['image_generated', 'video_generated'],
    settings: ['account_connected', 'account_disconnected', 'config_changed']
  };

  var filtered = activityLogState.entries;
  if (activityLogState.filter !== 'all') {
    var allowedTypes = typeGroups[activityLogState.filter] || [];
    filtered = filtered.filter(function(e) {
      for (var i = 0; i < allowedTypes.length; i++) {
        if (e.type === allowedTypes[i]) return true;
      }
      return false;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (loadMore) loadMore.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (loadMore) loadMore.style.display = activityLogState.entries.length >= activityLogState.pageSize ? 'block' : 'none';

  var typeIcons = {
    post_published: '<path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    scavenger_reply: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    scavenger_rejected: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    image_generated: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    video_generated: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    account_connected: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    account_disconnected: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/>',
    config_changed: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
  };

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var entry = filtered[i];
    var icon = typeIcons[entry.type] || typeIcons.post_published;
    var timeAgo = typeof scavengerRelativeTime === 'function' ? scavengerRelativeTime(entry.timestamp) : '';
    var postUrl = (entry.details && entry.details.postUrl) ? entry.details.postUrl : '';

    html += '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-color);">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;">' + icon + '</svg>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:13px;color:var(--text-primary);">' + escapeHtml(entry.description || entry.type.replace(/_/g, ' ')) + '</div>';
    html += '<div style="display:flex;gap:8px;align-items:center;margin-top:4px;font-size:11px;color:var(--text-tertiary);">';
    if (entry.platform) html += '<span style="text-transform:capitalize;">' + escapeHtml(entry.platform) + '</span>';
    if (entry.automatic) html += '<span class="scavenger-status-badge auto_approved" style="font-size:10px;">Auto</span>';
    html += '<span>' + timeAgo + '</span>';
    if (postUrl) html += '<a href="' + escapeHtml(postUrl) + '" target="_blank" rel="noopener" style="color:var(--accent);">View</a>';
    html += '</div></div></div>';
  }
  container.innerHTML = html;
}

function loadMoreActivityLog() {
  if (!activityLogState.lastDoc || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  firebase.firestore().collection('roweos_users/' + uid + '/social_activity')
    .orderBy('timestamp', 'desc')
    .startAfter(activityLogState.lastDoc)
    .limit(activityLogState.pageSize)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        var el = document.getElementById('activityLoadMore');
        if (el) el.style.display = 'none';
        return;
      }
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        activityLogState.entries.push(data);
        activityLogState.lastDoc = doc;
      });
      renderActivityLog();
    });
}

function renderScavengerCard(target) {
  var scoreClass = target.score >= 95 ? 'high' : (target.score >= 70 ? 'medium' : 'low');
  var timeAgo = scavengerRelativeTime(target.discoveredAt);
  var authorDisplay = '@' + escapeHtml(target.authorHandle || 'unknown');
  var followersDisplay = scavengerFormatFollowers(target.authorFollowers || 0);
  var contentPreview = escapeHtml((target.content || '').substring(0, 140));
  if ((target.content || '').length > 140) contentPreview += '...';

  var keywordPills = '';
  var kw = target.keywordsMatched || [];
  for (var k = 0; k < kw.length; k++) {
    keywordPills += '<span class="scavenger-keyword-pill">' + escapeHtml(kw[k]) + '</span>';
  }

  var draftSection = '';
  if (target.draftText) {
    draftSection = '<div class="scavenger-draft-text">' + escapeHtml(target.draftText) + '</div>';
  }

  var replyLink = '';
  if (target.status === 'posted' && target.replyUrl) {
    replyLink = '<a href="' + escapeHtml(target.replyUrl) + '" target="_blank" rel="noopener" style="color:var(--accent);">View reply</a>';
  }

  var actions = '';
  if (target.status === 'scored' || target.status === 'discovered') {
    // v25.4: Actions for scored targets -- draft a reply or dismiss
    actions = '<div class="scavenger-actions">' +
      '<button class="approve" onclick="draftEngageReply(\'' + target._id + '\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Draft Reply</button>' +
      '<button onclick="likeEngagePost(\'' + target._id + '\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Like</button>' +
      '<button class="reject" onclick="rejectScavengerTarget(\'' + target._id + '\')">Dismiss</button>' +
      '</div>';
  } else if (target.status === 'drafted') {
    // v25.4: Drafted but not yet decided
    actions = '<div class="scavenger-actions">' +
      '<button class="approve" onclick="approveScavengerTarget(\'' + target._id + '\')">Post Reply</button>' +
      '<button onclick="editScavengerTarget(\'' + target._id + '\')">Edit & Post</button>' +
      '<button class="reject" onclick="rejectScavengerTarget(\'' + target._id + '\')">Dismiss</button>' +
      '</div>';
  } else if (target.status === 'pending_review') {
    actions = '<div class="scavenger-actions">' +
      '<button class="approve" onclick="approveScavengerTarget(\'' + target._id + '\')">Approve</button>' +
      '<button onclick="editScavengerTarget(\'' + target._id + '\')">Edit & Approve</button>' +
      '<button class="reject" onclick="rejectScavengerTarget(\'' + target._id + '\')">Reject</button>' +
      '</div>';
  }

  var errorInfo = '';
  if (target.status === 'post_failed' && target.error) {
    errorInfo = '<div style="color:#ef4444;font-size:12px;margin-top:4px;">Error: ' + escapeHtml(target.error) + '</div>';
  }

  return '<div class="scavenger-activity-card">' +
    '<div class="scavenger-target-header">' +
      '<div>' +
        '<span class="scavenger-target-author"><a href="https://x.com/' + escapeHtml(target.authorHandle || '') + '" target="_blank" rel="noopener">' + authorDisplay + '</a></span>' +
        '<span class="scavenger-target-followers">(' + followersDisplay + ')</span>' +
      '</div>' +
      '<div class="scavenger-score ' + scoreClass + '">' + (target.score || 0) + '</div>' +
    '</div>' +
    '<div class="scavenger-target-content">' + contentPreview +
      ' <a href="' + escapeHtml(target.postUrl || '#') + '" target="_blank" rel="noopener">View post</a>' +
    '</div>' +
    '<div>' + keywordPills + '</div>' +
    draftSection +
    '<div class="scavenger-target-meta">' +
      '<span class="scavenger-status-badge ' + (target.status || '') + '">' + escapeHtml(target.status || '').replace(/_/g, ' ') + '</span>' +
      '<span>' + escapeHtml(target.configName || '') + '</span>' +
      '<span>' + timeAgo + '</span>' +
      replyLink +
    '</div>' +
    errorInfo +
    actions +
    '</div>';
}

function scavengerFormatFollowers(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function scavengerRelativeTime(timestamp) {
  if (!timestamp) return '';
  var date;
  if (timestamp.toDate) date = timestamp.toDate();
  else if (typeof timestamp === 'string') date = new Date(timestamp);
  else return '';
  var diff = Date.now() - date.getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  var days = Math.floor(hours / 24);
  return days + 'd ago';
}

function approveScavengerTarget(targetId) {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var target = null;
  for (var i = 0; i < engageState.targets.length; i++) {
    if (engageState.targets[i]._id === targetId) {
      target = engageState.targets[i];
      break;
    }
  }
  if (!target || !target.draftText) return;

  showToast('Posting reply...', 'info');
  var token = getSocialToken('x');
  if (!token) {
    showToast('X not connected. Connect in Social settings.', 'error');
    return;
  }

  var payload = { text: target.draftText, reply: { in_reply_to_tweet_id: target.postId } };

  fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(function(resp) { return resp.json().then(function(data) { return { ok: resp.ok, data: data }; }); })
  .then(function(result) {
    if (result.ok && result.data.data && result.data.data.id) {
      var replyId = result.data.data.id;
      var replyUrl = 'https://x.com/i/status/' + replyId;
      var _postUpdates = {
          status: 'posted',
          replyUrl: replyUrl,
          reviewedBy: 'manual',
          postedAt: new Date().toISOString()
      };
      firebase.firestore().doc('roweos_users/' + uid + '/scavenger_targets/' + targetId)
        .update(_postUpdates);
      // v28.0: Dual-write scavenger target update to v4
      if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
        try { syncEngine.write('scavenger_targets', targetId, _postUpdates); } catch(_e) {}
      }
      showToast('Reply posted!', 'success');
      logSocialActivity('scavenger_reply', { platform: 'x', description: 'Replied to @' + (target.authorHandle || '') + ': ' + (target.draftText || '').substring(0, 80), postUrl: replyUrl });
    } else {
      showToast('Post failed: ' + JSON.stringify(result.data), 'error');
    }
  })
  .catch(function(err) {
    showToast('Post error: ' + err.message, 'error');
  });
}

function editScavengerTarget(targetId) {
  var target = null;
  for (var i = 0; i < engageState.targets.length; i++) {
    if (engageState.targets[i]._id === targetId) {
      target = engageState.targets[i];
      break;
    }
  }
  if (!target) return;
  var newDraft = prompt('Edit reply:', target.draftText || '');
  if (newDraft === null) return;
  if (newDraft.length > 280) {
    showToast('Reply must be under 280 characters', 'error');
    return;
  }
  var uid = firebase.auth().currentUser.uid;
  firebase.firestore().doc('roweos_users/' + uid + '/scavenger_targets/' + targetId)
    .update({ draftText: newDraft })
    .then(function() {
      target.draftText = newDraft;
      approveScavengerTarget(targetId);
    });
  // v28.0: Dual-write scavenger target update to v4
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try { syncEngine.write('scavenger_targets', targetId, { draftText: newDraft }); } catch(_e) {}
  }
}

function rejectScavengerTarget(targetId) {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var _rejectUpdates = {
      status: 'rejected',
      reviewedBy: 'manual',
      decidedAt: new Date().toISOString()
  };
  firebase.firestore().doc('roweos_users/' + uid + '/scavenger_targets/' + targetId)
    .update(_rejectUpdates);
  // v28.0: Dual-write scavenger target update to v4
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try { syncEngine.write('scavenger_targets', targetId, _rejectUpdates); } catch(_e) {}
  }
  logSocialActivity('scavenger_rejected', { platform: 'x', description: 'Rejected target from @' + targetId });
  showToast('Target rejected', 'info');
}

// v25.4: Analytics tab
var analyticsState = {
  activityData: [],
  targetData: [],
  postHistory: [],
  insights: null,
  competitors: []
};

function initAnalyticsTab() {
  loadAnalyticsData();
  var competitors = [];
  try { competitors = JSON.parse(localStorage.getItem('roweos_analytics_competitors') || '[]'); } catch(e) {}
  analyticsState.competitors = competitors;
  renderAnalyticsTab();
}

function loadAnalyticsData() {
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();
  var thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  var cutoff = thirtyDaysAgo.toISOString();

  // Fetch social_activity (last 30 days)
  db.collection('roweos_users/' + uid + '/social_activity')
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'desc')
    .limit(200)
    .get()
    .then(function(snap) {
      analyticsState.activityData = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d._id = doc.id;
        analyticsState.activityData.push(d);
      });
      renderAnalyticsTab();
    })
    .catch(function(err) { console.warn('[Analytics] activity fetch error:', err); });

  // Fetch scavenger_targets (last 30 days)
  db.collection('roweos_users/' + uid + '/scavenger_targets')
    .where('createdAt', '>=', cutoff)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get()
    .then(function(snap) {
      analyticsState.targetData = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d._id = doc.id;
        analyticsState.targetData.push(d);
      });
      renderAnalyticsTab();
    })
    .catch(function(err) { console.warn('[Analytics] targets fetch error:', err); });

  // Load post history from localStorage
  try {
    analyticsState.postHistory = JSON.parse(localStorage.getItem('roweos_social_post_history') || '[]');
  } catch(e) {
    analyticsState.postHistory = [];
  }
}

function renderAnalyticsTab() {
  renderAnalyticsSummary();
  renderPostPerformance();
  renderEngagementTrends();
  renderContentBreakdown();
  renderAnalyticsCompetitors();
  // Render cached insights if available
  var cached = null;
  try {
    var raw = localStorage.getItem('roweos_analytics_insights');
    if (raw) {
      cached = JSON.parse(raw);
      if (cached && cached.ts && (Date.now() - cached.ts) < 86400000) {
        analyticsState.insights = cached.insights;
        _renderInsightItems(cached.insights);
      } else {
        analyticsState.insights = null;
      }
    }
  } catch(e) {}
}

function renderAnalyticsSummary() {
  var activity = analyticsState.activityData;
  var targets = analyticsState.targetData;

  // Total posts
  var totalPosts = 0;
  var platforms = {};
  for (var i = 0; i < activity.length; i++) {
    if (activity[i].type === 'post_published') {
      totalPosts++;
      var plat = activity[i].platform || activity[i].details && activity[i].details.platform || 'unknown';
      platforms[plat] = true;
    }
  }
  // Also count from postHistory
  for (var j = 0; j < analyticsState.postHistory.length; j++) {
    var ph = analyticsState.postHistory[j];
    if (ph.platform) platforms[ph.platform] = true;
  }

  // Scavenger engagements
  var engagements = 0;
  for (var k = 0; k < activity.length; k++) {
    if (activity[k].type === 'scavenger_reply') engagements++;
  }

  // Average score
  var scoreSum = 0;
  var scoreCount = 0;
  for (var m = 0; m < targets.length; m++) {
    if (typeof targets[m].score === 'number') {
      scoreSum += targets[m].score;
      scoreCount++;
    }
  }
  var avgScore = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : '--';

  // Active platforms
  var platformCount = Object.keys(platforms).length;

  var elPosts = document.getElementById('analyticsStatPosts');
  var elEngagements = document.getElementById('analyticsStatEngagements');
  var elScore = document.getElementById('analyticsStatScore');
  var elPlatforms = document.getElementById('analyticsStatPlatforms');
  if (elPosts) elPosts.textContent = totalPosts;
  if (elEngagements) elEngagements.textContent = engagements;
  if (elScore) elScore.textContent = avgScore;
  if (elPlatforms) elPlatforms.textContent = platformCount;
}

function renderPostPerformance() {
  var container = document.getElementById('analyticsPostList');
  if (!container) return;

  // Merge activity posts + postHistory
  var posts = [];
  var activity = analyticsState.activityData;
  for (var i = 0; i < activity.length; i++) {
    if (activity[i].type === 'post_published') {
      posts.push({
        platform: activity[i].platform || (activity[i].details ? activity[i].details.platform : '') || 'x',
        content: activity[i].description || (activity[i].details ? activity[i].details.content : '') || '',
        timestamp: activity[i].timestamp || '',
        postUrl: activity[i].postUrl || (activity[i].details ? activity[i].details.postUrl : '') || '',
        tweetId: activity[i].tweetId || (activity[i].details ? activity[i].details.tweetId : '') || ''
      });
    }
  }

  if (posts.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-tertiary);font-size:13px;">No posts recorded yet. Publish content to see performance data here.</div>';
    return;
  }

  // Attempt to fetch X metrics for tweet IDs
  var tweetIds = [];
  for (var t = 0; t < posts.length; t++) {
    if (posts[t].tweetId && posts[t].platform === 'x') tweetIds.push(posts[t].tweetId);
  }
  if (tweetIds.length > 0) fetchPostMetrics(tweetIds);

  var html = '';
  var limit = Math.min(posts.length, 20);
  for (var j = 0; j < limit; j++) {
    var p = posts[j];
    var preview = (p.content || '').substring(0, 80);
    if ((p.content || '').length > 80) preview += '...';
    var ts = p.timestamp ? _analyticsFormatDate(p.timestamp) : '';
    var viewLink = '';
    if (p.postUrl) {
      viewLink = '<a href="' + _escAttr(p.postUrl) + '" target="_blank" rel="noopener" style="color:var(--accent);font-size:11px;text-decoration:none;flex-shrink:0;">View</a>';
    }
    html += '<div class="analytics-post-row">'
      + '<span class="analytics-platform-badge">' + _escHtml(p.platform) + '</span>'
      + '<span class="analytics-post-content">' + _escHtml(preview) + '</span>'
      + '<span class="analytics-post-time">' + _escHtml(ts) + '</span>'
      + viewLink
      + '</div>';
  }
  container.innerHTML = html;
}

function fetchPostMetrics(tweetIds) {
  if (!tweetIds || tweetIds.length === 0) return;
  getSocialToken('x').then(function(tokenData) {
    if (!tokenData || !tokenData.accessToken) return;
    var ids = tweetIds.slice(0, 100).join(',');
    fetch('https://api.x.com/2/tweets?ids=' + ids + '&tweet.fields=public_metrics', {
      headers: { 'Authorization': 'Bearer ' + tokenData.accessToken }
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data && data.data) {
        console.log('[Analytics] Tweet metrics:', data.data.length, 'tweets');
      }
    }).catch(function(err) {
      console.log('[Analytics] Tweet metrics unavailable:', err.message || err);
    });
  }).catch(function() {
    // No X token, silently skip
  });
}

function renderEngagementTrends() {
  var container = document.getElementById('analyticsTrends');
  if (!container) return;

  var activity = analyticsState.activityData;
  if (activity.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px;">No activity data yet.</div>';
    return;
  }

  // Group by day for last 14 days
  var days = {};
  var now = new Date();
  for (var d = 0; d < 14; d++) {
    var dt = new Date(now);
    dt.setDate(dt.getDate() - d);
    var key = dt.toISOString().substring(0, 10);
    days[key] = 0;
  }

  for (var i = 0; i < activity.length; i++) {
    var ts = activity[i].timestamp || '';
    var dayKey = ts.substring(0, 10);
    if (typeof days[dayKey] !== 'undefined') {
      days[dayKey]++;
    }
  }

  // Find max
  var dayKeys = Object.keys(days).sort();
  var maxCount = 1;
  for (var k = 0; k < dayKeys.length; k++) {
    if (days[dayKeys[k]] > maxCount) maxCount = days[dayKeys[k]];
  }

  var html = '';
  for (var m = 0; m < dayKeys.length; m++) {
    var count = days[dayKeys[m]];
    var pct = Math.round((count / maxCount) * 100);
    var label = dayKeys[m].substring(5); // MM-DD
    html += '<div class="analytics-bar-chart-row">'
      + '<span class="analytics-bar-chart-label">' + _escHtml(label) + '</span>'
      + '<div class="analytics-bar-chart-track"><div class="analytics-bar-chart-fill" style="width:' + pct + '%;"></div></div>'
      + '<span class="analytics-bar-chart-count">' + count + '</span>'
      + '</div>';
  }
  container.innerHTML = html;
}

function generateAIInsights() {
  var btn = document.getElementById('analyticsInsightsBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }

  // Collect summary stats
  var activity = analyticsState.activityData;
  var targets = analyticsState.targetData;
  var totalPosts = 0;
  var engagements = 0;
  var platformCounts = {};
  var typeCounts = {};
  for (var i = 0; i < activity.length; i++) {
    var a = activity[i];
    if (a.type === 'post_published') {
      totalPosts++;
      var plat = a.platform || (a.details ? a.details.platform : '') || 'unknown';
      platformCounts[plat] = (platformCounts[plat] || 0) + 1;
    }
    if (a.type === 'scavenger_reply') engagements++;
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }

  var avgScore = '--';
  var scoreSum = 0;
  var scoreCount = 0;
  for (var j = 0; j < targets.length; j++) {
    if (typeof targets[j].score === 'number') { scoreSum += targets[j].score; scoreCount++; }
  }
  if (scoreCount > 0) avgScore = (scoreSum / scoreCount).toFixed(1);

  var competitorSection = '';
  if (analyticsState.competitors.length > 0) {
    competitorSection = ' Competitor handles being tracked: ' + analyticsState.competitors.join(', ') + '. Comment on how the user compares.';
  }

  var prompt = 'You are a social media analytics advisor for a personal brand. '
    + 'Analyze this data from the last 30 days and provide 3-5 concise, actionable insights. '
    + 'Data: ' + totalPosts + ' posts published. '
    + engagements + ' scavenger engagements (automated replies). '
    + 'Average engagement score: ' + avgScore + '. '
    + 'Platform breakdown: ' + JSON.stringify(platformCounts) + '. '
    + 'Activity types: ' + JSON.stringify(typeCounts) + '. '
    + 'Scavenger targets found: ' + targets.length + '.'
    + competitorSection
    + ' Format as numbered list. Include: best content types, optimal posting times, recommendations for improvement.';

  // Resolve provider + API key (same pattern as Create tab)
  var provider = localStorage.getItem('selectedProvider') || 'anthropic';
  var apiKeysRaw = localStorage.getItem('roweos_api_keys') || '{}';
  var apiKeys = {};
  try { apiKeys = JSON.parse(apiKeysRaw); } catch(e) {}

  var anthropicKey = apiKeys.anthropic || localStorage.getItem('anthropicApiKey') || '';
  var openaiKey = apiKeys.openai || localStorage.getItem('openaiApiKey') || '';
  var googleKey = apiKeys.google || localStorage.getItem('googleApiKey') || '';

  if (provider === 'anthropic' && !anthropicKey) provider = openaiKey ? 'openai' : googleKey ? 'google' : '';
  if (provider === 'openai' && !openaiKey) provider = anthropicKey ? 'anthropic' : googleKey ? 'google' : '';
  if (provider === 'google' && !googleKey) provider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : '';

  if (!provider) {
    showToast('Add an API key in Settings to generate insights.', 'warning');
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Insights'; }
    return;
  }

  var model;
  if (provider === 'anthropic') model = localStorage.getItem('claudeModel') || 'claude-sonnet-4-6';
  else if (provider === 'openai') model = localStorage.getItem('openaiModel') || 'gpt-5.5';
  else model = localStorage.getItem('googleModel') || 'gemini-2.0-flash';

  var apiKey = provider === 'anthropic' ? anthropicKey : provider === 'openai' ? openaiKey : googleKey;

  callStudioAPI(provider, model, apiKey, prompt, function(response) {
    // Parse response into bullet points
    var lines = (response || '').split('\n');
    var insights = [];
    for (var l = 0; l < lines.length; l++) {
      var line = lines[l].replace(/^\d+[\.\)]\s*/, '').trim();
      if (line.length > 5) insights.push(line);
    }
    if (insights.length === 0) insights.push(response);

    analyticsState.insights = insights;
    // Cache with TTL
    try {
      localStorage.setItem('roweos_analytics_insights', JSON.stringify({ insights: insights, ts: Date.now() }));
    } catch(e) {}

    _renderInsightItems(insights);
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Insights'; }
    showToast('Insights generated', 'success');
  }, function(err) {
    console.warn('[Analytics] AI insights error:', err);
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Insights'; }
    showToast('Could not generate insights: ' + (err || 'Unknown error'), 'error');
  });
}

function _renderInsightItems(insights) {
  var container = document.getElementById('analyticsInsights');
  if (!container || !insights) return;
  var html = '';
  for (var i = 0; i < insights.length; i++) {
    html += '<div class="analytics-insight-item">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>'
      + '<span>' + _escHtml(insights[i]) + '</span>'
      + '</div>';
  }
  container.innerHTML = html;
}

function renderContentBreakdown() {
  var container = document.getElementById('analyticsBreakdown');
  if (!container) return;

  var activity = analyticsState.activityData;
  var platformCounts = {};
  var typeCounts = {};
  var total = 0;

  for (var i = 0; i < activity.length; i++) {
    var a = activity[i];
    if (a.type === 'post_published') {
      total++;
      var plat = a.platform || (a.details ? a.details.platform : '') || 'unknown';
      platformCounts[plat] = (platformCounts[plat] || 0) + 1;
    }
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }

  if (total === 0 && Object.keys(typeCounts).length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px;">No content data available yet.</div>';
    return;
  }

  var colors = { x: '#1da1f2', threads: '#000000', instagram: '#e1306c', tiktok: '#69c9d0', unknown: 'var(--accent)' };
  var html = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;">By Platform</div>';

  var platKeys = Object.keys(platformCounts);
  for (var p = 0; p < platKeys.length; p++) {
    var pName = platKeys[p];
    var pCount = platformCounts[pName];
    var pPct = total > 0 ? Math.round((pCount / total) * 100) : 0;
    var barColor = colors[pName] || 'var(--accent)';
    html += '<div class="analytics-breakdown-row">'
      + '<span class="analytics-breakdown-label">' + _escHtml(pName) + '</span>'
      + '<div class="analytics-breakdown-track"><div class="analytics-breakdown-fill" style="width:' + pPct + '%;background:' + barColor + ';"></div></div>'
      + '<span class="analytics-breakdown-pct">' + pPct + '%</span>'
      + '</div>';
  }

  // Activity types
  var totalAll = 0;
  var typeKeys = Object.keys(typeCounts);
  for (var q = 0; q < typeKeys.length; q++) totalAll += typeCounts[typeKeys[q]];

  html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:14px;margin-bottom:8px;font-weight:600;">By Activity Type</div>';
  var typeLabels = { post_published: 'Posts', scavenger_reply: 'Scavenger Replies', scavenger_rejected: 'Rejected', image_generated: 'Images', video_generated: 'Videos' };
  for (var r = 0; r < typeKeys.length; r++) {
    var tName = typeKeys[r];
    var tCount = typeCounts[tName];
    var tPct = totalAll > 0 ? Math.round((tCount / totalAll) * 100) : 0;
    var tLabel = typeLabels[tName] || tName;
    html += '<div class="analytics-breakdown-row">'
      + '<span class="analytics-breakdown-label">' + _escHtml(tLabel) + '</span>'
      + '<div class="analytics-breakdown-track"><div class="analytics-breakdown-fill" style="width:' + tPct + '%;background:var(--accent);"></div></div>'
      + '<span class="analytics-breakdown-pct">' + tPct + '%</span>'
      + '</div>';
  }

  container.innerHTML = html;
}

function addAnalyticsCompetitor() {
  var input = document.getElementById('analyticsCompetitorInput');
  if (!input) return;
  var handle = input.value.trim().replace(/^@/, '');
  if (!handle) return;
  if (analyticsState.competitors.indexOf(handle) !== -1) {
    showToast('Already tracking @' + handle, 'info');
    return;
  }
  analyticsState.competitors.push(handle);
  try { localStorage.setItem('roweos_analytics_competitors', JSON.stringify(analyticsState.competitors)); } catch(e) {}
  input.value = '';
  renderAnalyticsCompetitors();
  showToast('Tracking @' + handle, 'success');
}

function removeAnalyticsCompetitor(handle) {
  var idx = analyticsState.competitors.indexOf(handle);
  if (idx !== -1) analyticsState.competitors.splice(idx, 1);
  try { localStorage.setItem('roweos_analytics_competitors', JSON.stringify(analyticsState.competitors)); } catch(e) {}
  renderAnalyticsCompetitors();
}

function renderAnalyticsCompetitors() {
  var container = document.getElementById('analyticsCompetitorsList');
  if (!container) return;
  if (analyticsState.competitors.length === 0) {
    container.innerHTML = '<span style="font-size:12px;color:var(--text-tertiary);">No competitors tracked. Add handles to include in AI insights.</span>';
    return;
  }
  var html = '';
  for (var i = 0; i < analyticsState.competitors.length; i++) {
    var h = analyticsState.competitors[i];
    html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(168,152,120,0.12);border:1px solid rgba(168,152,120,0.25);border-radius:16px;font-size:12px;color:var(--accent);">'
      + '@' + _escHtml(h)
      + '<button onclick="removeAnalyticsCompetitor(\'' + _escAttr(h) + '\')" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);font-size:14px;padding:0 2px;line-height:1;">'
      + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      + '</button></span>';
  }
  container.innerHTML = html;
}

// Analytics helper: format date string
function _analyticsFormatDate(ts) {
  try {
    var d = new Date(ts);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  } catch(e) { return ts; }
}

// Analytics helper: escape HTML
function _escHtml(s) {
  if (typeof escapeHtml === 'function') return escapeHtml(s);
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(s || ''));
  return div.innerHTML;
}

// Analytics helper: escape attribute
function _escAttr(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function switchMailTab(tab) {
  var tabs = getMailTabOrder();
  tabs.forEach(function(t) {
    var content = document.getElementById('mail' + t.charAt(0).toUpperCase() + t.slice(1) + 'Tab');
    if (content) content.classList.toggle('hidden', t !== tab);
    // v26.0: Only toggle old-style tab buttons if they still exist
    var btn = document.querySelector('[data-mail-tab="' + t + '"]');
    if (btn) btn.classList.toggle('active', t === tab);
  });
  // v26.0: Update pill nav active state
  if (typeof updatePillNavActive === 'function') updatePillNavActive('mailPillNav', tab);
  // v23.17: Persist active mail tab across sessions
  try { localStorage.setItem('roweos_mail_current_tab', tab); } catch(e) {}
  // Hide detail view when switching tabs
  var detail = document.getElementById('mailDetailView');
  if (detail) { detail.classList.remove('active'); detail.style.display = 'none'; }
  // v23.14: Re-render active tab data to prevent stale content
  if (tab === 'outbox' && typeof renderMailOutbox === 'function') renderMailOutbox();
  if (tab === 'sent' && typeof renderMailSent === 'function') renderMailSent();
  if (tab === 'inbox' && typeof mailRenderCombinedInbox === 'function') mailRenderCombinedInbox();
  if (tab === 'drafts' && typeof renderMailDrafts === 'function') renderMailDrafts();
  if (tab === 'connections' && typeof renderMailConnections === 'function') renderMailConnections();
  // v22.28: Update writing tools labels when switching to compose
  if (tab === 'compose' && typeof mailUpdateWritingToolsLabels === 'function') mailUpdateWritingToolsLabels();
  // v24.27: Enable Cmd+B/I/U in mail compose body
  if (tab === 'compose') {
    var composeBody = document.getElementById('mailComposeBody');
    if (composeBody && !composeBody._biu24) {
      composeBody._biu24 = true;
      composeBody.addEventListener('keydown', function(e) {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
          if (e.key === 'b' || e.key === 'B') { e.preventDefault(); document.execCommand('bold', false, null); }
          if (e.key === 'i' || e.key === 'I') { e.preventDefault(); document.execCommand('italic', false, null); }
          if (e.key === 'u' || e.key === 'U') { e.preventDefault(); document.execCommand('underline', false, null); }
        }
      });
    }
  }
  // v22.37: Pre-resize brand logo for email use
  if (tab === 'compose' && typeof mailEnsureLogoUrl === 'function') {
    try {
      var _bidx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
      var _logo = '';
      if (window._mailTempLogo) { _logo = window._mailTempLogo; }
      if (!_logo) { _logo = localStorage.getItem(getCurrentLogoKey(_bidx)) || ''; }
      if (!_logo) { var _b = brands[_bidx]; _logo = (_b && (_b.logo || _b.brandLogo)) || ''; }
      if (_logo && _logo.indexOf('data:') === 0) mailEnsureLogoUrl(_logo);
    } catch(e) {}
  }
  // v25.3: Inject admin-only templates (welcome emails per tier + check-in)
  if (tab === 'compose') {
    var tplSel = document.getElementById('mailComposeTemplate');
    if (tplSel && typeof isAdmin === 'function' && isAdmin()) {
      if (!tplSel.querySelector('option[value="admin_welcome_solo"]')) {
        var adminGroup = document.createElement('optgroup');
        adminGroup.label = 'Admin Templates';
        var adminTpls = [
          { value: 'admin_welcome_solo', label: 'Welcome Solo' },
          { value: 'admin_welcome_founder', label: 'Welcome Founder' },
          { value: 'admin_welcome_premium', label: 'Welcome Premium' },
          { value: 'admin_checkin', label: 'Check-in / Feedback' }
        ];
        adminTpls.forEach(function(t) {
          var opt = document.createElement('option');
          opt.value = t.value;
          opt.textContent = t.label;
          adminGroup.appendChild(opt);
        });
        tplSel.appendChild(adminGroup);
      }
    }
  }
}

// --- Badge Update ---
function updateMailBadge() {
  var badge = document.getElementById('mailOutboxBadge');
  if (!badge) return;
  var count = getMailOutbox().length;
  badge.textContent = count > 0 ? count : '';
}

// v23.11: Inbox unread count badge
function updateMailInboxBadge() {
  var badge = document.getElementById('mailInboxBadge');
  if (!badge) return;
  var count = 0;
  var firstUnreadAcct = '';
  var keys = Object.keys(_mailCurrentMessages);
  keys.forEach(function(acctEmail) {
    (_mailCurrentMessages[acctEmail] || []).forEach(function(m) {
      if (m.isUnread) {
        count++;
        if (!firstUnreadAcct) firstUnreadAcct = acctEmail;
      }
    });
  });
  badge.textContent = count > 0 ? count : '';
  // v24.10: Also update sidebar nav count badge for mail
  var navMailBadge = document.getElementById('navMailCountBadge');
  if (navMailBadge) {
    navMailBadge.textContent = count > 0 ? count : '';
    navMailBadge.style.display = count > 0 ? 'inline-block' : 'none';
    // v25.1: Use account color for unread badge
    if (count > 0 && firstUnreadAcct && typeof mailGetAccountColor === 'function') {
      navMailBadge.style.background = mailGetAccountColor(firstUnreadAcct);
    } else {
      navMailBadge.style.background = '';
    }
  }
  // v25.1: Also color the inbox tab badge by account color
  if (count > 0 && firstUnreadAcct && typeof mailGetAccountColor === 'function') {
    badge.style.background = mailGetAccountColor(firstUnreadAcct);
  } else {
    badge.style.background = '';
  }
}

// --- Main Render ---
function renderMailView() {
  renderMailTabs(); // v22.28: Dynamic draggable tabs
  // v24.9: Properly switch to active tab to hide inactive content (fixes outbox bleeding into Settings)
  var _activeMailTab = 'outbox';
  try { _activeMailTab = localStorage.getItem('roweos_mail_current_tab') || 'outbox'; } catch(e) {}
  switchMailTab(_activeMailTab);
  renderMailComposeFrom();
  // v22.40: Social outbox moved to Automations > Pending Approval
  updateMailBadge();
  updateMailDraftsBadge();
  updateMailInboxBadge();
  if (typeof updatePendingApprovalBadge === 'function') updatePendingApprovalBadge();
  mailRenderInboxFilters();
  if (typeof mailRefreshTemplateDropdown === 'function') mailRefreshTemplateDropdown();
  if (typeof mailUpdateWritingToolsLabels === 'function') mailUpdateWritingToolsLabels();
  if (typeof mailRenderSignatureManager === 'function') mailRenderSignatureManager();
  // v23.2: Init Sprint 3 compose preferences
  if (typeof mailInitSprint3Prefs === 'function') mailInitSprint3Prefs();
  // v22.44: Start scheduled email checker
  if (typeof startMailScheduleChecker === 'function') startMailScheduleChecker();
  // v23.11: Start auto-fetch interval for inbox
  mailStartAutoFetch();
  // v22.44: Pre-upload logo to Firebase Storage so URL is ready for email templates
  if (!window._mailLogoUrl && typeof mailEnsureLogoUrl === 'function') {
    try {
      var _bidx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
      var _logo = localStorage.getItem(getCurrentLogoKey(_bidx)) || '';
      if (!_logo) { var _br = brands[_bidx]; if (_br) _logo = _br.logo || _br.brandLogo || ''; }
      if (_logo && _logo.indexOf('data:') === 0) mailEnsureLogoUrl(_logo);
    } catch(e) {}
  }
}

// --- Render Outbox ---
function renderMailOutbox() {
  var outbox = getMailOutbox();
  var list = document.getElementById('mailOutboxList');
  var empty = document.getElementById('mailOutboxEmpty');
  if (!list) return;

  if (outbox.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  var folders = getMailOutboxFolders();
  var sel = _mailOutboxSelectedFolder;

  // v22.44: Folder chips bar
  var html = '<div class="mail-outbox-folders">';
  var allCount = outbox.length;
  html += '<button class="mail-folder-chip' + (sel === 'all' ? ' active' : '') + '" onclick="selectMailOutboxFolder(\'all\')">All <span class="mail-folder-count">' + allCount + '</span></button>';
  // Unfiled count
  var unfiledCount = outbox.filter(function(it) { return !it.folder; }).length;
  if (folders.length > 0 && unfiledCount > 0 && unfiledCount < allCount) {
    html += '<button class="mail-folder-chip' + (sel === '' ? ' active' : '') + '" onclick="selectMailOutboxFolder(\'\')">Unfiled <span class="mail-folder-count">' + unfiledCount + '</span></button>';
  }
  folders.forEach(function(f) {
    var cnt = outbox.filter(function(it) { return it.folder === f; }).length;
    html += '<button class="mail-folder-chip' + (sel === f ? ' active' : '') + '" onclick="selectMailOutboxFolder(\'' + escapeHtml(f).replace(/'/g, "\\'") + '\')">' + escapeHtml(f) + ' <span class="mail-folder-count">' + cnt + '</span>';
    html += '<span class="mail-folder-actions">';
    html += '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" onclick="event.stopPropagation();renameMailOutboxFolder(\'' + escapeHtml(f).replace(/'/g, "\\'") + '\')"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
    html += '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" onclick="event.stopPropagation();deleteMailOutboxFolder(\'' + escapeHtml(f).replace(/'/g, "\\'") + '\')"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    html += '</span></button>';
  });
  html += '<button class="mail-folder-chip mail-folder-add" onclick="promptNewMailOutboxFolder()"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>';
  html += '</div>';

  // Filter by selected folder
  var filtered = outbox;
  if (sel !== 'all') {
    filtered = outbox.filter(function(it) { return (it.folder || '') === sel; });
  }

  if (filtered.length === 0) {
    html += '<div class="mail-empty" style="padding:40px 0;"><div>No emails in this folder</div></div>';
    list.innerHTML = html;
    return;
  }

  filtered.forEach(function(item) {
    var preview = (item.body || '').substring(0, 150).replace(/[<>]/g, '');
    var date = new Date(item.createdAt || item.addedAt || Date.now());
    var dateStr = isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + formatDateTimeDisplay(date);
    // v23.13: Avatar from recipient initial with muted palette
    var toName = (item.to || 'U').split(',')[0].replace(/<[^>]+>/, '').trim();
    var toInitial = toName.charAt(0).toUpperCase();
    var _outboxColors = ['#a89878','#c4a882','#b8a08c','#c9b99a','#a3b18a','#8fae8b','#7ea6a0','#8ba4b8','#9b97b8','#b89bb0','#c49b8a','#d4a87c'];
    var _oCI = 0; for (var _oci = 0; _oci < toName.length; _oci++) _oCI += toName.charCodeAt(_oci);
    var _outboxBg = _outboxColors[_oCI % _outboxColors.length];
    html += '<div class="mail-card" style="--card-accent:' + _outboxBg + ';">';
    html += '<div class="mail-card-inner">';
    html += '<div class="mail-card-avatar" style="background:' + _outboxBg + ';">' + toInitial + '</div>';
    html += '<div class="mail-card-content">';
    html += '<div class="mail-card-header">';
    html += '<div class="mail-card-to">' + escapeHtml(item.to || 'No recipient') + '</div>';
    html += '<div class="mail-card-date">' + dateStr + '</div>';
    html += '</div>';
    html += '<div class="mail-card-subject">' + escapeHtml(item.subject || '(No subject)') + '</div>';
    if (preview) html += '<div class="mail-card-preview">' + escapeHtml(preview) + '</div>';
    // v22.31: Show attachment indicator
    if (item.attachments && item.attachments.length > 0) {
      html += '<div style="display:flex;align-items:center;gap:4px;margin:4px 0;font-size:11px;color:var(--brand-accent,#a89878);opacity:0.7;">';
      html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
      html += item.attachments.length + ' file' + (item.attachments.length > 1 ? 's' : '');
      html += '</div>';
    }
    html += '</div></div>';
    // v23.12: Status badges row
    var hasBadges = item.folder || item.needsApproval || item.pipelineName || item.status === 'failed';
    if (hasBadges) {
      html += '<div style="display:flex;align-items:center;gap:6px;padding:0 18px 8px;flex-wrap:wrap;">';
      if (item.status === 'failed') html += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:600;color:#ef4444;background:rgba(239,68,68,0.08);padding:2px 8px;border-radius:4px;letter-spacing:0.3px;text-transform:uppercase;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Send Failed</span>';
      if (item.folder) html += '<span class="mail-folder-badge">' + escapeHtml(item.folder) + '</span>';
      if (item.needsApproval) html += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:600;color:#f59e0b;background:rgba(245,158,11,0.08);padding:2px 8px;border-radius:4px;letter-spacing:0.3px;text-transform:uppercase;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Approval</span>';
      if (item.pipelineName) html += '<span style="font-size:10px;color:var(--text-muted);opacity:0.6;">' + escapeHtml(item.pipelineName) + '</span>';
      html += '</div>';
    }
    // v22.44: Scheduled send indicator
    if (item.scheduledAt) {
      var schDate = new Date(item.scheduledAt);
      var schStr = schDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + schDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      html += '<div style="margin:8px 0 0;">';
      html += '<span class="mail-scheduled-badge"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Scheduled: ' + schStr + '</span>';
      html += ' <button style="background:none;border:none;color:var(--text-secondary);font-size:11px;cursor:pointer;text-decoration:underline;" onclick="mailUnscheduleOutboxItem(\'' + item.id + '\')">Cancel</button>';
      html += '</div>';
    }
    html += '<div class="mail-card-actions">';
    html += '<button onclick="mailEditOutboxItem(\'' + item.id + '\')"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> Edit</button>';
    // v22.44: Move to folder dropdown
    if (folders.length > 0) {
      html += '<select class="mail-move-folder-select" onchange="moveMailOutboxItem(\'' + item.id + '\', this.value); this.selectedIndex=0;">';
      html += '<option value="" disabled selected>Move to...</option>';
      if (item.folder) html += '<option value="">Unfiled</option>';
      folders.forEach(function(f) {
        if (f !== item.folder) html += '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>';
      });
      html += '</select>';
    }
    // v22.44: Schedule button
    if (!item.scheduledAt) {
      html += '<button onclick="mailPromptScheduleOutboxItem(\'' + item.id + '\')"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Schedule</button>';
    }
    html += '<button class="mail-send-btn" onclick="mailSendOutboxItem(\'' + item.id + '\')"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Send Now</button>';
    html += '<button class="mail-delete-btn" onclick="mailDeleteOutboxItem(\'' + item.id + '\')"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

// --- Render Sent ---
function renderMailSent() {
  var sent = getMailSent();
  var list = document.getElementById('mailSentList');
  var empty = document.getElementById('mailSentEmpty');
  if (!list) return;

  if (sent.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  var html = '';
  sent.forEach(function(item) {
    var date = new Date(item.sentAt);
    var dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    // v23.13: Avatar from recipient with muted palette + display name
    var toName = (item.to || 'U').split(',')[0].replace(/<[^>]+>/, '').trim();
    var toInitial = toName.charAt(0).toUpperCase();
    var _sentColors = ['#a89878','#c4a882','#b8a08c','#c9b99a','#a3b18a','#8fae8b','#7ea6a0','#8ba4b8','#9b97b8','#b89bb0','#c49b8a','#d4a87c'];
    var _sCI = 0; for (var _sci = 0; _sci < toName.length; _sci++) _sCI += toName.charCodeAt(_sci);
    var _sentBg = _sentColors[_sCI % _sentColors.length];
    // v24.9: Per-from-address avatar with fallback to global mail logo
    var _sentUserLogo = typeof getMailAvatarForFrom === 'function' ? getMailAvatarForFrom(item.from || '') : '';
    if (!_sentUserLogo) { try { _sentUserLogo = localStorage.getItem('roweos_mail_logo') || ''; } catch(e) {} }
    html += '<div class="mail-card mail-sent-card" onclick="mailShowSentDetail(\'' + item.id + '\')" style="cursor:pointer;--card-accent:' + _sentBg + ';">';
    html += '<div class="mail-card-inner">';
    if (_sentUserLogo) {
      html += '<div class="mail-card-avatar" style="background:transparent;padding:0;overflow:hidden;"><img src="' + _sentUserLogo + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>';
    } else {
      html += '<div class="mail-card-avatar" style="background:' + _sentBg + ';">' + toInitial + '</div>';
    }
    html += '<div class="mail-card-content">';
    html += '<div class="mail-card-header"><div class="mail-card-to">' + escapeHtml(toName) + '</div>';
    html += '<div style="text-align:right;flex-shrink:0;margin-left:12px;">';
    html += '<div class="mail-card-date">' + dateStr + ' <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#22c55e" stroke-width="2" style="vertical-align:-2px;margin-left:4px;"><path d="M20 6L9 17l-5-5"/></svg></div>';
    html += '</div></div>';
    html += '<div class="mail-card-subject">' + escapeHtml(item.subject || '(No subject)') + '</div>';
    html += '</div></div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

// --- Show Sent Detail ---
function mailShowSentDetail(itemId) {
  var sent = getMailSent();
  var item = null;
  for (var i = 0; i < sent.length; i++) {
    if (sent[i].id === itemId) { item = sent[i]; break; }
  }
  if (!item) return;

  // v22.33: Use enriched detail header
  var date = new Date(item.sentAt);
  var dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  mailSetDetailHeader(item.from || '', item.to || '', dateStr, item.subject);
  var bodyEl = document.getElementById('mailDetailBody');
  if (item.html) {
    bodyEl.innerHTML = item.html;
  } else {
    bodyEl.innerHTML = mailLinkifyText(item.body || '').replace(/\n/g, '<br>');
  }
  // v24.27: Force all links in email body to open in new tab
  var _emailLinks = bodyEl.querySelectorAll('a[href]');
  for (var _eli = 0; _eli < _emailLinks.length; _eli++) {
    _emailLinks[_eli].setAttribute('target', '_blank');
    _emailLinks[_eli].setAttribute('rel', 'noopener');
  }

  // Hide tabs, show detail
  document.getElementById('mailSentTab').classList.add('hidden');
  document.getElementById('mailDetailView').classList.add('active');
  document.getElementById('mailDetailView').style.display = 'block';
}

function mailCloseDetail() {
  document.getElementById('mailDetailView').style.display = 'none';
  document.getElementById('mailDetailView').classList.remove('active');
  // Re-show the active tab content
  var activeTab = document.querySelector('.mail-tab.active');
  if (activeTab) {
    var tab = activeTab.dataset.mailTab;
    var content = document.getElementById('mail' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab');
    if (content) content.classList.remove('hidden');
  }
  // v22.24: Re-render inbox to reflect read/unread changes
  mailRenderCombinedInbox();
}

// v22.35: Auto-resize mail iframe to fit content height
function mailAutoResizeIframe() {
  var iframe = document.getElementById('mailIframe');
  if (!iframe) return;
  function resize() {
    try {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      if (doc && doc.body) {
        var h = doc.body.scrollHeight || doc.documentElement.scrollHeight;
        iframe.style.height = Math.max(h + 40, 200) + 'px';
      }
    } catch(e) {}
  }
  iframe.onload = resize;
  // Also try after short delay in case onload already fired
  setTimeout(resize, 300);
  setTimeout(resize, 800);
}

// --- Compose: Populate From dropdown ---
function renderMailComposeFrom() {
  var fromEl = document.getElementById('mailComposeFrom');
  if (!fromEl) return;
  var config = getMailConfig();
  var defaultAddr = config.defaultFromAddress || '';
  var hiddenBuiltIn = config.hiddenBuiltIn || [];
  var html = '';
  // v22.33: Only show admin built-in addresses for admin users
  if (typeof isAdmin === 'function' && isAdmin()) {
    if (hiddenBuiltIn.indexOf('roweos@therowecollection.com') === -1) {
      html += '<option value="roweos@therowecollection.com"' + (defaultAddr === 'roweos@therowecollection.com' ? ' selected' : '') + '>Brilliance (roweos@therowecollection.com)</option>';
    }
    if (hiddenBuiltIn.indexOf('jordan@therowecollection.com') === -1) {
      html += '<option value="jordan@therowecollection.com"' + (defaultAddr === 'jordan@therowecollection.com' ? ' selected' : '') + '>Jordan Rowe (jordan@therowecollection.com)</option>';
    }
  }
  var customAddrs = config.customFromAddresses || [];
  customAddrs.forEach(function(addr) {
    html += '<option value="' + escapeHtml(addr) + '"' + (defaultAddr === addr ? ' selected' : '') + '>' + escapeHtml(addr) + '</option>';
  });
  // v23.10: Multi-account Gmail/Outlook (with display name)
  var _gAccts = getMailGmailAccounts();
  _gAccts.forEach(function(acct) {
    var gv = 'gmail:' + acct.email;
    var label = acct.displayName ? escapeHtml(acct.displayName) + ' - ' + escapeHtml(acct.email) + ' (Gmail)' : escapeHtml(acct.email) + ' (Gmail)';
    html += '<option value="' + escapeHtml(gv) + '"' + (defaultAddr === acct.email || defaultAddr === gv ? ' selected' : '') + '>' + label + '</option>';
  });
  var _oAccts = getMailOutlookAccounts();
  _oAccts.forEach(function(acct) {
    var ov = 'outlook:' + acct.email;
    var label = acct.displayName ? escapeHtml(acct.displayName) + ' - ' + escapeHtml(acct.email) + ' (Outlook)' : escapeHtml(acct.email) + ' (Outlook)';
    html += '<option value="' + escapeHtml(ov) + '"' + (defaultAddr === acct.email || defaultAddr === ov ? ' selected' : '') + '>' + label + '</option>';
  });
  fromEl.innerHTML = html;
  // v22.28: Force-select default if it exists in the options
  if (defaultAddr) {
    var opts = fromEl.options;
    for (var oi = 0; oi < opts.length; oi++) {
      if (opts[oi].value === defaultAddr || opts[oi].value === 'gmail:' + defaultAddr || opts[oi].value === 'outlook:' + defaultAddr) {
        fromEl.selectedIndex = oi;
        break;
      }
    }
  }

  // v25.3: Auto-select per-account signature when From changes
  fromEl.onchange = function() {
    var selectedFrom = fromEl.value.replace(/^(gmail|outlook):/, '');
    if (typeof getSignatureForAccount === 'function') {
      var mappedSig = getSignatureForAccount(selectedFrom);
      if (mappedSig) {
        var sigSelect = document.getElementById('mailSignatureSelect');
        if (sigSelect) { sigSelect.value = mappedSig; if (typeof mailInsertSignature === 'function') mailInsertSignature(); }
      }
    }
  };

  // v22.33: Restore BCC self preference
  var bccSelfEl = document.getElementById('mailComposeBccSelf');
  if (bccSelfEl && config.bccSelf) bccSelfEl.checked = true;

  // Pre-fill reply-to from config
  var replyEl = document.getElementById('mailComposeReplyTo');
  if (replyEl && !replyEl.value && config.replyTo) replyEl.value = config.replyTo;

  // Pre-fill connections tab
  var replyConfig = document.getElementById('mailReplyToConfig');
  if (replyConfig && config.replyTo) replyConfig.value = config.replyTo;
  var displayName = document.getElementById('mailDisplayName');
  if (displayName && config.displayName) displayName.value = config.displayName;
  // v23.2: Init auto-capitalize toggle
  var autoCapToggle = document.getElementById('mailAutoCapToggle');
  if (autoCapToggle) autoCapToggle.checked = localStorage.getItem('roweos_mail_autocap_subject') !== 'false';
}

// --- Compose: Save to Outbox ---
function mailGetCanvasContent() {
  var el = document.getElementById('mailComposeBody');
  if (!el) return '';
  return el.innerHTML || '';
}

function mailGetCanvasText() {
  var el = document.getElementById('mailComposeBody');
  if (!el) return '';
  return el.innerText || el.textContent || '';
}

function mailSaveToOutbox() {
  var to = (document.getElementById('mailComposeTo').value || '').trim();
  var subject = (document.getElementById('mailComposeSubject').value || '').trim();
  var body = mailGetCanvasText();
  var from = document.getElementById('mailComposeFrom').value || getDefaultFromAddress();
  var replyTo = (document.getElementById('mailComposeReplyTo').value || '').trim();
  var cc = (document.getElementById('mailComposeCc').value || '').split(',').map(function(e) { return e.trim(); }).filter(Boolean);
  var bcc = (document.getElementById('mailComposeBcc').value || '').split(',').map(function(e) { return e.trim(); }).filter(Boolean);
  var template = document.getElementById('mailComposeTemplate').value || 'professional';
  var bccSelfEl = document.getElementById('mailComposeBccSelf');
  var bccSelf = bccSelfEl ? bccSelfEl.checked : false;

  // v22.33: Persist BCC self preference
  if (bccSelfEl) {
    var _mc = getMailConfig();
    if (_mc.bccSelf !== bccSelf) {
      _mc.bccSelf = bccSelf;
      saveMailConfig(_mc);
    }
  }

  if (bccSelf && from) {
    var selfEmail = from.indexOf(':') !== -1 ? from.split(':')[1] : from;
    if (bcc.indexOf(selfEmail) === -1) bcc.push(selfEmail);
  }

  // v22.37: Block save if file uploads still in progress
  if (window._mailUploadsPending > 0) {
    showToast('Please wait for file upload to finish', 'warning');
    return;
  }

  // v22.35: Validation with specific toast
  var _missing = [];
  if (!to) _missing.push('recipient email');
  if (!subject) _missing.push('subject');
  if (!body.trim()) _missing.push('email body');
  if (_missing.length > 0) {
    showToast('Missing: ' + _missing.join(', '), 'error');
    return;
  }

  // If editing existing item, update it
  var _savedItem = null;
  if (window._mailEditingId) {
    var outbox = getMailOutbox();
    for (var i = 0; i < outbox.length; i++) {
      if (outbox[i].id === window._mailEditingId) {
        outbox[i].to = to;
        outbox[i].subject = subject;
        outbox[i].body = body;
        outbox[i].canvasHtml = mailGetCanvasContent();
        var _prevHtml = mailGetPreviewHtml();
        var _lp = (document.getElementById('mailComposeLogoPos') || {}).value || 'center';
        outbox[i].html = _prevHtml || mailRenderBody(body, template, outbox[i].canvasHtml, false, _lp);
        outbox[i].from = from;
        outbox[i].replyTo = replyTo;
        outbox[i].cc = cc;
        outbox[i].bcc = bcc;
        outbox[i].template = template;
        outbox[i].logoPosition = _lp;
        outbox[i].attachments = mailGetAttachments();
        _savedItem = outbox[i];
        break;
      }
    }
    saveMailOutbox(outbox);
    window._mailEditingId = null;
    showToast('Email updated in outbox', 'success');
  } else {
    var canvasHtml = mailGetCanvasContent();
    // v22.36: Use live preview HTML if available (preserves header edits like brand name changes)
    var previewHtml = mailGetPreviewHtml();
    var _lp2 = (document.getElementById('mailComposeLogoPos') || {}).value || 'center';
    var finalHtml = previewHtml || mailRenderBody(body, template, canvasHtml, false, _lp2);
    _savedItem = addToMailOutbox({
      to: to, subject: subject, body: body, canvasHtml: canvasHtml,
      html: finalHtml,
      from: from, replyTo: replyTo, cc: cc, bcc: bcc, template: template,
      logoPosition: _lp2,
      attachments: mailGetAttachments(),
      _informClient: typeof mailInformClientIdentityCheck === 'function' ? mailInformClientIdentityCheck() : false
    });
    showToast(_savedItem ? 'Email saved to outbox' : 'Email queued for approval', 'success');
  }
  // v23.16: Return saved item so mailComposeSend can use the correct ID
  window._lastSavedOutboxItem = _savedItem;

  // v22.36: Delete draft if composing from a draft
  var draftId = window._mailEditingDraftId;

  // Clear form and switch to outbox
  mailClearCompose();
  switchMailTab('outbox');
  renderMailOutbox();

  // v22.36: Remove the draft after clearing compose (mailClearCompose resets _mailEditingDraftId)
  if (draftId) {
    var drafts = getMailDrafts();
    drafts = drafts.filter(function(d) { return d.id !== draftId; });
    saveMailDrafts(drafts);
    renderMailDrafts();
    updateMailDraftsBadge();
  }
}

// v22.35: Cancel compose - clear and go back to outbox
function mailCancelCompose() {
  mailClearCompose();
  window._mailEditingId = null;
  window._mailEditingDraftId = null;
  switchMailTab('outbox');
}

// --- Compose: Send directly ---
function mailComposeSend() {
  var to = (document.getElementById('mailComposeTo').value || '').trim();
  var subject = (document.getElementById('mailComposeSubject').value || '').trim();
  var body = mailGetCanvasText();
  var from = (document.getElementById('mailComposeFrom').value || '').trim();

  // v22.37: Block send if file uploads still in progress
  if (window._mailUploadsPending > 0) {
    showToast('Please wait for file upload to finish', 'warning');
    return;
  }

  // v22.35: Detailed validation toasts
  var missing = [];
  if (!to) missing.push('recipient email');
  if (!subject) missing.push('subject');
  if (!body.trim()) missing.push('email body');
  if (!from) missing.push('from address (set in Mail Settings)');
  if (missing.length > 0) {
    showToast('Missing: ' + missing.join(', '), 'error');
    return;
  }
  // v22.35: Basic email format check (allows any TLD)
  if (to.indexOf('@') === -1 || to.indexOf('.') === -1) {
    showToast('Invalid recipient email format', 'error');
    return;
  }

  // Save to outbox first, then send the SAVED item (not blindly outbox[0])
  mailSaveToOutbox();
  var _sendItem = window._lastSavedOutboxItem;
  if (_sendItem && _sendItem.id) {
    mailSendOutboxItem(_sendItem.id);
  }
  // v23.16: If _sendItem is null, email went to approval queue - don't send random outbox item
}

// v22.31: Email Attachment System
window._mailAttachments = [];
window._mailUploadsPending = 0; // v22.37: Track in-flight Firebase uploads

function mailHandleFileAttach(input) {
  var files = input.files;
  if (!files || !files.length) return;
  var maxSize = 25 * 1024 * 1024; // v22.36: 25MB per file (uploaded to Firebase Storage, not inline)
  for (var i = 0; i < files.length; i++) {
    (function(file) {
      if (file.size > maxSize) {
        showToast(file.name + ' exceeds 25MB limit', 'error');
        return;
      }
      // v22.36: Upload to Firebase Storage for URL-based attachments (bypasses Vercel body limit)
      var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
      if (uid && typeof uploadToStorage === 'function') {
        var storagePath = 'users/' + uid + '/mail_attachments/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        showToast('Uploading ' + file.name + '...', 'info');
        window._mailUploadsPending++;
        uploadToStorage(storagePath, file, file.type).then(function(downloadUrl) {
          window._mailUploadsPending--;
          window._mailAttachments.push({
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            url: downloadUrl,
            storagePath: storagePath
          });
          mailRenderAttachmentChips();
          showToast(file.name + ' attached', 'success');
        }).catch(function(err) {
          window._mailUploadsPending--;
          showToast('Upload failed: ' + err.message, 'error');
        });
      } else {
        // Fallback: base64 inline (small files only, no Firebase)
        if (file.size > 3 * 1024 * 1024) {
          showToast('Sign in to attach files over 3MB', 'error');
          return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
          window._mailAttachments.push({
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            base64: e.target.result.split(',')[1] || e.target.result
          });
          mailRenderAttachmentChips();
        };
        reader.readAsDataURL(file);
      }
    })(files[i]);
  }
  input.value = '';
}

function mailAttachPDFData(pdfResult) {
  if (!pdfResult || !pdfResult.blob) {
    showToast('No PDF data to attach', 'error');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    window._mailAttachments.push({
      name: pdfResult.filename || 'Brilliance-Export.pdf',
      type: 'application/pdf',
      size: pdfResult.blob.size,
      base64: e.target.result.split(',')[1]
    });
    mailRenderAttachmentChips();
    showToast('PDF attached: ' + (pdfResult.filename || 'Brilliance-Export.pdf'), 'success');
  };
  reader.readAsDataURL(pdfResult.blob);
}

function mailAttachCurrentPDF() {
  if (!window.currentRun || !window.currentRun.deliv) {
    showToast('No Studio output to attach. Run an operation first.', 'warning');
    return;
  }
  var run = window.currentRun;
  var docTitle = run.contextTitle || run.brand || 'Document';
  var brandName = run.brand || 'Brilliance';
  var result = roweosPDF(run.deliv, {
    title: docTitle,
    brandName: brandName,
    coverPage: true,
    closingPage: true,
    orientation: 'portrait',
    filename: docTitle.replace(/\s+/g, '_') + '_' + brandName.replace(/\s+/g, '_') + '.pdf',
    returnBase64: true
  });
  if (result) mailAttachPDFData(result);
}

function mailRenderAttachmentChips() {
  var container = document.getElementById('mailAttachmentsList');
  var countEl = document.getElementById('mailAttachCount');
  if (!container) return;
  container.innerHTML = '';
  var attachments = window._mailAttachments || [];
  if (countEl) {
    countEl.textContent = attachments.length > 0 ? attachments.length + ' file' + (attachments.length > 1 ? 's' : '') : '';
  }
  for (var i = 0; i < attachments.length; i++) {
    (function(idx) {
      var att = attachments[idx];
      var sizeStr = att.size < 1024 ? att.size + 'B' : (att.size < 1048576 ? Math.round(att.size / 1024) + 'KB' : (att.size / 1048576).toFixed(1) + 'MB');
      var chip = document.createElement('div');
      chip.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;font-size:11px;color:var(--text-secondary);';
      var isPdf = att.name.toLowerCase().indexOf('.pdf') !== -1;
      chip.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="' + (isPdf ? '#a89878' : 'currentColor') + '" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '<span style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(att.name) + '</span>' +
        '<span style="color:var(--text-muted);">(' + sizeStr + ')</span>';
      var removeBtn = document.createElement('button');
      removeBtn.style.cssText = 'background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0;line-height:1;';
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      removeBtn.onclick = function() {
        window._mailAttachments.splice(idx, 1);
        mailRenderAttachmentChips();
      };
      chip.appendChild(removeBtn);
      container.appendChild(chip);
    })(i);
  }
}

function mailGetAttachments() {
  return (window._mailAttachments || []).map(function(a) {
    // v22.37: URL-based attachments (Firebase Storage) or base64 inline - include size for display
    if (a.url) {
      return { filename: a.name, url: a.url, type: a.type, size: a.size || 0 };
    }
    return { filename: a.name, content: a.base64, type: a.type, size: a.size || 0 };
  });
}

function mailClearAttachments() {
  window._mailAttachments = [];
  mailRenderAttachmentChips();
}

// v22.32: Drag and drop file attachments for mail compose
(function() {
  var dragCounter = 0;
  function getComposeForm() { return document.querySelector('#mailComposeTab .mail-compose-form'); }
  function getOverlay() { return document.getElementById('mailDropOverlay'); }

  document.addEventListener('dragenter', function(e) {
    var form = getComposeForm();
    if (!form || !form.offsetParent) return; // Only when compose is visible
    if (!e.dataTransfer || !e.dataTransfer.types || e.dataTransfer.types.indexOf('Files') === -1) return;
    dragCounter++;
    var overlay = getOverlay();
    if (overlay) overlay.style.display = 'flex';
  });

  document.addEventListener('dragleave', function(e) {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      var overlay = getOverlay();
      if (overlay) overlay.style.display = 'none';
    }
  });

  document.addEventListener('dragover', function(e) {
    var form = getComposeForm();
    if (!form || !form.offsetParent) return;
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') !== -1) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  document.addEventListener('drop', function(e) {
    dragCounter = 0;
    var overlay = getOverlay();
    if (overlay) overlay.style.display = 'none';
    var form = getComposeForm();
    if (!form || !form.offsetParent) return;
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    // v22.37: Use same upload logic as file input (Firebase Storage for signed-in users)
    var maxSize = 25 * 1024 * 1024;
    for (var i = 0; i < e.dataTransfer.files.length; i++) {
      (function(file) {
        if (file.size > maxSize) {
          showToast(file.name + ' exceeds 25MB limit', 'error');
          return;
        }
        var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
        if (uid && typeof uploadToStorage === 'function') {
          var storagePath = 'users/' + uid + '/mail_attachments/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          showToast('Uploading ' + file.name + '...', 'info');
          window._mailUploadsPending++;
          uploadToStorage(storagePath, file, file.type).then(function(downloadUrl) {
            window._mailUploadsPending--;
            window._mailAttachments.push({
              name: file.name, type: file.type || 'application/octet-stream',
              size: file.size, url: downloadUrl, storagePath: storagePath
            });
            mailRenderAttachmentChips();
            showToast(file.name + ' attached', 'success');
          }).catch(function(err) {
            window._mailUploadsPending--;
            showToast('Upload failed: ' + err.message, 'error');
          });
        } else {
          if (file.size > 3 * 1024 * 1024) {
            showToast('Sign in to attach files over 3MB', 'error');
            return;
          }
          var reader = new FileReader();
          reader.onload = function(ev) {
            window._mailAttachments.push({
              name: file.name, type: file.type || 'application/octet-stream',
              size: file.size, base64: ev.target.result.split(',')[1] || ev.target.result
            });
            mailRenderAttachmentChips();
            showToast('Attached: ' + file.name, 'success');
          };
          reader.readAsDataURL(file);
        }
      })(e.dataTransfer.files[i]);
    }
  });
})();

// --- Clear Compose Form ---
function mailClearCompose() {
  var fields = ['mailComposeTo', 'mailComposeCc', 'mailComposeBcc', 'mailComposeSubject', 'mailComposeReplyTo'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  // v22.24: Clear canvas (contenteditable)
  var canvas = document.getElementById('mailComposeBody');
  if (canvas) canvas.innerHTML = '';
  mailUpdateCanvasCounts();
  var bccSelf = document.getElementById('mailComposeBccSelf');
  if (bccSelf) bccSelf.checked = false;
  window._mailEditingId = null;
  window._mailEditingDraftId = null;
  window._mailAiTemplateHtml = null;
  window._mailTempLogo = null;
  window._mailHeaderEdits = null; // v25.1: Clear header edits on new compose
  // Reset template to professional and hide AI row/preview
  var templateEl = document.getElementById('mailComposeTemplate');
  if (templateEl) templateEl.value = 'professional';
  var aiRow = document.getElementById('mailAiTemplateRow');
  if (aiRow) aiRow.style.display = 'none';
  var preview = document.getElementById('mailTemplatePreview');
  if (preview) preview.style.display = 'none';
  // v22.31: Clear attachments
  mailClearAttachments();
  // v23.2: Reset Sprint 3 fields
  var informToggle = document.getElementById('mailInformClientIdentity');
  if (informToggle) informToggle.checked = localStorage.getItem('roweos_mail_inform_client') === 'true';
  var logoSize = document.getElementById('mailComposeLogoSize');
  if (logoSize) logoSize.value = 'medium';
  var fontSel = document.getElementById('mailComposeFont');
  if (fontSel) fontSel.value = 'system';
  var formatTier = document.getElementById('mailComposeFormatTier');
  if (formatTier) formatTier.value = localStorage.getItem('roweos_mail_format_tier') || 'moderate';
}

// v22.25: Drafts system
function getMailDrafts() {
  try { return JSON.parse(localStorage.getItem('roweos_mail_drafts') || '[]'); } catch(e) { return []; }
}
function saveMailDrafts(items) {
  localStorage.setItem('roweos_mail_drafts', JSON.stringify(items));
  writeDB('profile/mail', { drafts: items }); // v25.1
}
function updateMailDraftsBadge() {
  var badge = document.getElementById('mailDraftsBadge');
  if (!badge) return;
  var count = getMailDrafts().length;
  badge.textContent = count > 0 ? count : '';
}

function mailSaveDraft() {
  var to = (document.getElementById('mailComposeTo').value || '').trim();
  var subject = (document.getElementById('mailComposeSubject').value || '').trim();
  var body = mailGetCanvasText();
  var canvasHtml = mailGetCanvasContent();
  var from = document.getElementById('mailComposeFrom').value || '';
  var replyTo = (document.getElementById('mailComposeReplyTo').value || '').trim();
  var cc = (document.getElementById('mailComposeCc').value || '').split(',').map(function(e) { return e.trim(); }).filter(Boolean);
  var bcc = (document.getElementById('mailComposeBcc').value || '').split(',').map(function(e) { return e.trim(); }).filter(Boolean);
  var template = document.getElementById('mailComposeTemplate').value || 'professional';

  if (!body.trim() && !subject && !to) { showToast('Nothing to save', 'error'); return; }

  var drafts = getMailDrafts();
  // If editing an existing draft, update it
  if (window._mailEditingDraftId) {
    for (var i = 0; i < drafts.length; i++) {
      if (drafts[i].id === window._mailEditingDraftId) {
        drafts[i].to = to;
        drafts[i].subject = subject;
        drafts[i].body = body;
        drafts[i].canvasHtml = canvasHtml;
        drafts[i].from = from;
        drafts[i].replyTo = replyTo;
        drafts[i].cc = cc;
        drafts[i].bcc = bcc;
        drafts[i].template = template;
        drafts[i].attachments = mailGetAttachments();
        drafts[i].updatedAt = Date.now();
        break;
      }
    }
    showToast('Draft updated', 'success');
  } else {
    drafts.unshift({
      id: 'draft_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      to: to, subject: subject, body: body, canvasHtml: canvasHtml,
      from: from, replyTo: replyTo, cc: cc, bcc: bcc, template: template,
      attachments: mailGetAttachments(),
      createdAt: Date.now(), updatedAt: Date.now()
    });
    showToast('Draft saved', 'success');
  }
  saveMailDrafts(drafts);
  updateMailDraftsBadge();
  renderMailDrafts();

  // v22.26: Mirror draft to outbox - same email accessible from both tabs
  var draftItem = window._mailEditingDraftId
    ? drafts.find(function(d) { return d.id === window._mailEditingDraftId; })
    : drafts[0];
  if (draftItem) {
    var outbox = getMailOutbox();
    // Update existing outbox item with same draft ID, or create new
    var existingIdx = -1;
    for (var j = 0; j < outbox.length; j++) {
      if (outbox[j].draftId === draftItem.id) { existingIdx = j; break; }
    }
    var outboxEntry = {
      id: existingIdx >= 0 ? outbox[existingIdx].id : draftItem.id.replace('draft_', 'outbox_'),
      draftId: draftItem.id,
      to: draftItem.to, subject: draftItem.subject, body: draftItem.body,
      canvasHtml: draftItem.canvasHtml,
      html: typeof mailRenderBody === 'function' ? mailRenderBody(draftItem.body, draftItem.template, draftItem.canvasHtml) : draftItem.body,
      from: draftItem.from, cc: draftItem.cc || [], bcc: draftItem.bcc || [],
      template: draftItem.template, attachments: draftItem.attachments || mailGetAttachments(),
      createdAt: draftItem.createdAt || draftItem.updatedAt || Date.now(),
      addedAt: draftItem.updatedAt || Date.now()
    };
    if (existingIdx >= 0) {
      outbox[existingIdx] = outboxEntry;
    } else {
      outbox.unshift(outboxEntry);
    }
    saveMailOutbox(outbox);
    updateMailBadge();
  }
}

function mailEditDraft(draftId) {
  var drafts = getMailDrafts();
  var item = null;
  for (var i = 0; i < drafts.length; i++) {
    if (drafts[i].id === draftId) { item = drafts[i]; break; }
  }
  if (!item) return;
  switchMailTab('compose');
  setTimeout(function() {
    var fromEl = document.getElementById('mailComposeFrom');
    var replyEl = document.getElementById('mailComposeReplyTo');
    var toEl = document.getElementById('mailComposeTo');
    var ccEl = document.getElementById('mailComposeCc');
    var bccEl = document.getElementById('mailComposeBcc');
    var subjectEl = document.getElementById('mailComposeSubject');
    var bodyEl = document.getElementById('mailComposeBody');
    var templateEl = document.getElementById('mailComposeTemplate');
    if (fromEl) fromEl.value = item.from || '';
    if (replyEl) replyEl.value = item.replyTo || '';
    if (toEl) toEl.value = item.to || '';
    if (ccEl) ccEl.value = (item.cc || []).join(', ');
    if (bccEl) bccEl.value = (item.bcc || []).join(', ');
    if (subjectEl) subjectEl.value = item.subject || '';
    if (bodyEl) bodyEl.innerHTML = item.canvasHtml || item.body || '';
    if (templateEl) templateEl.value = item.template || 'professional';
    // v22.45: Restore logo position from draft
    var _lpElD = document.getElementById('mailComposeLogoPos');
    if (_lpElD) _lpElD.value = item.logoPosition || 'center';
    // v22.33: Trigger template change to update preview
    if (typeof mailOnTemplateChange === 'function') mailOnTemplateChange();
    mailUpdateCanvasCounts();
    window._mailEditingDraftId = draftId;
    window._mailEditingId = null;
  }, 50);
}

function mailDeleteDraft(draftId) {
  var drafts = getMailDrafts();
  drafts = drafts.filter(function(d) { return d.id !== draftId; });
  saveMailDrafts(drafts);
  addMailDeletedId(draftId); // v22.39: Tombstone for cross-device sync
  renderMailDrafts();
  updateMailDraftsBadge();
  showToast('Draft deleted', 'info');
}

function renderMailDrafts() {
  var drafts = getMailDrafts();
  var list = document.getElementById('mailDraftsList');
  var empty = document.getElementById('mailDraftsEmpty');
  if (!list) return;
  if (drafts.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  var html = '';
  drafts.forEach(function(item) {
    var preview = (item.body || '').substring(0, 150).replace(/[<>]/g, '');
    var date = new Date(item.updatedAt || item.createdAt);
    var dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    var draftInitial = (item.to || item.subject || 'D').charAt(0).toUpperCase();
    html += '<div class="mail-card">';
    html += '<div class="mail-card-inner">';
    html += '<div class="mail-card-avatar" style="background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid rgba(255,255,255,0.06);">' + draftInitial + '</div>';
    html += '<div class="mail-card-content">';
    html += '<div class="mail-card-header">';
    if (item.to) { html += '<div class="mail-card-to">' + escapeHtml(item.to) + '</div>'; }
    else { html += '<div class="mail-card-to" style="opacity:0.4;">No recipient</div>'; }
    html += '<div class="mail-card-date">' + dateStr + '</div>';
    html += '</div>';
    html += '<div class="mail-card-subject">' + escapeHtml(item.subject || '(No subject)') + '</div>';
    if (preview) html += '<div class="mail-card-preview">' + escapeHtml(preview) + '</div>';
    html += '</div></div>';
    html += '<div class="mail-card-actions">';
    html += '<button onclick="mailEditDraft(\'' + item.id + '\')"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> Edit</button>';
    html += '<button class="mail-delete-btn" onclick="mailDeleteDraft(\'' + item.id + '\')"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete</button>';
    html += '</div></div>';
  });
  list.innerHTML = html;
}

// v22.25: Template preview + AI template generation
function mailOnTemplateChange() {
  var sel = document.getElementById('mailComposeTemplate');
  var aiRow = document.getElementById('mailAiTemplateRow');
  if (!sel) return;
  var val = sel.value;
  // Show/hide AI template prompt
  if (aiRow) aiRow.style.display = val === 'ai' ? '' : 'none';
  // v22.45: Show/hide delete button for custom templates
  var delBtn = document.getElementById('mailCustomTemplateDeleteBtn');
  if (delBtn) delBtn.style.display = (val.indexOf('custom_') === 0) ? 'inline-flex' : 'none';
  // v25.3: Admin welcome templates - pre-fill subject + body with full styled email
  if (val.indexOf('admin_welcome_') === 0) {
    var tierMap = { admin_welcome_solo: 'solo', admin_welcome_founder: 'founder', admin_welcome_premium: 'premium' };
    var tier = tierMap[val] || 'founder';
    var tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    var subEl = document.getElementById('mailComposeSubject');
    if (subEl) subEl.value = 'Welcome to Brilliance ' + tierLabel + ' - Your Access Key';
    var body = document.getElementById('mailComposeBody');
    if (body) {
      body.innerHTML = '<h2>Welcome to Brilliance ' + tierLabel + '</h2>'
        + '<p>You\'ve been granted early access to Brilliance - an AI operating system built for brands and life. Your access key is below.</p>'
        + '<div style="background:rgba(168,152,120,0.1);border:1px solid rgba(168,152,120,0.3);border-radius:8px;padding:18px;text-align:center;margin:20px 0;">'
        + '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:8px;">Your Access Key</div>'
        + '<div style="font-size:22px;color:#a89878;letter-spacing:3px;font-weight:600;font-family:monospace;">ROWE-XXXX-XXXX</div>'
        + '</div>'
        + '<h3>Getting Started</h3>'
        + '<ol>'
        + '<li>Go to <a href="https://roweos.com">roweos.com</a></li>'
        + '<li>Create your account or sign in</li>'
        + '<li>Go to <strong>System > Account > Enter Access Key</strong></li>'
        + '<li>Paste your key and start building with AI</li>'
        + '</ol>'
        + '<p>Questions? Reply to this email or contact jordan@therowecollection.com</p>'
        + '<p>Welcome aboard.</p>';
    }
  }
  if (val === 'admin_checkin') {
    var subEl2 = document.getElementById('mailComposeSubject');
    if (subEl2) subEl2.value = 'Checking in - How\'s Brilliance going?';
    var body2 = document.getElementById('mailComposeBody');
    if (body2) {
      body2.innerHTML = '<h2>Hope you\'ve been enjoying Brilliance</h2>'
        + '<p>I wanted to personally check in and see how things are going. Your experience and feedback are incredibly valuable as we continue building.</p>'
        + '<h3>A few quick questions:</h3>'
        + '<ul>'
        + '<li>What features have you found most useful?</li>'
        + '<li>Is there anything that feels confusing or could be improved?</li>'
        + '<li>What would you love to see added next?</li>'
        + '</ul>'
        + '<h3>How to share feedback</h3>'
        + '<ol>'
        + '<li><strong>Reply to this email</strong> with your thoughts</li>'
        + '<li>Use the <strong>Feedback</strong> button inside Brilliance (bottom-left)</li>'
        + '<li>Or just message me directly at jordan@therowecollection.com</li>'
        + '</ol>'
        + '<p><strong>Quick Tip:</strong> Try asking your BrandAI to create a content calendar, write a client proposal, or brainstorm new service offerings. The more context you give it in your Brand Identity, the better it gets.</p>'
        + '<p>Thanks for being an early adopter. Your input directly shapes what we build next.</p>'
        + '<p>Best,<br><strong>Jordan Rowe</strong><br>Creator, Brilliance</p>';
    }
  }
  // Live preview
  mailUpdateTemplatePreview();
}

// v22.45: Delete a saved custom template
function mailDeleteCustomTemplate() {
  var sel = document.getElementById('mailComposeTemplate');
  if (!sel) return;
  var val = sel.value;
  if (val.indexOf('custom_') !== 0) return;
  if (!confirm('Delete this saved template?')) return;
  try {
    var templates = JSON.parse(localStorage.getItem('roweos_mail_custom_templates') || '[]');
    templates = templates.filter(function(t) { return ('custom_' + t.id) !== val && t.id !== val; });
    localStorage.setItem('roweos_mail_custom_templates', JSON.stringify(templates));
    writeDB('profile/mail', { customTemplates: templates }); // v25.1
  } catch(e) {}
  sel.value = 'professional';
  mailRefreshTemplateDropdown();
  mailOnTemplateChange();
  showToast('Template deleted', 'success');
}

// v25.0: Function-level debounce - all callers (dropdowns, canvas, logo) coalesced
var _mailPreviewDebounceTimer = null;
function mailUpdateTemplatePreview() {
  clearTimeout(_mailPreviewDebounceTimer);
  _mailPreviewDebounceTimer = setTimeout(_mailUpdateTemplatePreviewImpl, 150);
}
function _mailUpdateTemplatePreviewImpl() {
  var preview = document.getElementById('mailTemplatePreview');
  var frame = document.getElementById('mailTemplatePreviewFrame');
  if (!preview || !frame) return;
  var template = document.getElementById('mailComposeTemplate').value || 'professional';
  if (template === 'ai') { preview.style.display = 'none'; return; }
  var body = mailGetCanvasText().trim();
  if (!body) { preview.style.display = 'none'; return; }
  // v22.28: Logo toggle support
  var includeLogo = true;
  var logoCheckbox = document.getElementById('mailPreviewIncludeLogo');
  if (logoCheckbox) includeLogo = logoCheckbox.checked;
  // Temporarily override logo if toggle is off
  var savedLogo = null;
  if (!includeLogo) {
    savedLogo = window._mailPreviewLogoBackup;
  }
  var logoPosEl = document.getElementById('mailComposeLogoPos');
  var logoPos = logoPosEl ? logoPosEl.value : 'center';

  // v25.1: Preserve user edits to header/brand-name across all preview rebuilds
  // Capture current header edits from live iframe into persistent window variable
  if (!window._mailHeaderEdits) window._mailHeaderEdits = {};
  try {
    var _prevDoc = frame.contentDocument || frame.contentWindow.document;
    if (_prevDoc && _prevDoc.body && _prevDoc.body.innerHTML) {
      // Capture all header text divs that contain brand name (font-size:20px is used in all templates for brand name)
      var _brandEls = _prevDoc.querySelectorAll('div[style*="font-size:20px"], div[style*="font-size: 20px"]');
      for (var _bi = 0; _bi < _brandEls.length; _bi++) {
        var _be = _brandEls[_bi];
        var _contentDiv = _prevDoc.querySelector('div[style*="font-size:15px"]');
        // Only capture if this element is BEFORE the content area (i.e. in the header)
        if (_contentDiv && (_be.compareDocumentPosition(_contentDiv) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          window._mailHeaderEdits.brandNameHtml = _be.innerHTML;
          break;
        }
      }
      // Also capture subtitle/date text that follows the brand name
      var _dateEls = _prevDoc.querySelectorAll('div[style*="font-size:12px"][style*="color:#888"]');
      for (var _di = 0; _di < _dateEls.length; _di++) {
        var _de = _dateEls[_di];
        if (_contentDiv && (_de.compareDocumentPosition(_contentDiv) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          window._mailHeaderEdits.dateHtml = _de.innerHTML;
          break;
        }
      }
    }
  } catch(e) {}

  var _canvasHtml = mailGetCanvasContent();
  console.log('[MAIL-PREVIEW-DEBUG] body length:', body.length, 'canvasHtml length:', _canvasHtml.length, 'template:', template);
  console.log('[MAIL-PREVIEW-DEBUG] canvasHtml starts with DOCTYPE:', _canvasHtml.indexOf('<!DOCTYPE') !== -1);
  console.log('[MAIL-PREVIEW-DEBUG] canvasHtml first 200 chars:', _canvasHtml.substring(0, 200));
  var html = mailRenderBody(body, template, _canvasHtml, !includeLogo, logoPos);
  console.log('[MAIL-PREVIEW-DEBUG] rendered html length:', html.length, 'has font-size:15px div:', html.indexOf('font-size:15px') !== -1);
  preview.style.display = '';
  // v25.0: Hide iframe during write to prevent blank flash, show after content is ready
  frame.style.visibility = 'hidden';
  var doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  // Show iframe and set up designMode after content is written
  setTimeout(function() {
    frame.style.visibility = '';
    try {
      // v25.1: Restore persistent header edits (brand name, date/subtitle)
      if (window._mailHeaderEdits && window._mailHeaderEdits.brandNameHtml) {
        var _newBrandEls = doc.querySelectorAll('div[style*="font-size:20px"], div[style*="font-size: 20px"]');
        var _newContent = doc.querySelector('div[style*="font-size:15px"]');
        for (var _ri = 0; _ri < _newBrandEls.length; _ri++) {
          if (_newContent && (_newBrandEls[_ri].compareDocumentPosition(_newContent) & Node.DOCUMENT_POSITION_FOLLOWING)) {
            _newBrandEls[_ri].innerHTML = window._mailHeaderEdits.brandNameHtml;
            break;
          }
        }
      }
      if (window._mailHeaderEdits && window._mailHeaderEdits.dateHtml) {
        var _newDateEls = doc.querySelectorAll('div[style*="font-size:12px"][style*="color:#888"]');
        var _newContent2 = doc.querySelector('div[style*="font-size:15px"]');
        for (var _rj = 0; _rj < _newDateEls.length; _rj++) {
          if (_newContent2 && (_newDateEls[_rj].compareDocumentPosition(_newContent2) & Node.DOCUMENT_POSITION_FOLLOWING)) {
            _newDateEls[_rj].innerHTML = window._mailHeaderEdits.dateHtml;
            break;
          }
        }
      }
      doc.designMode = 'on';
      // v24.27: Enable Cmd+B/I/U inside template preview iframe
      doc.addEventListener('keydown', function(e) {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
          if (e.key === 'b' || e.key === 'B') { e.preventDefault(); doc.execCommand('bold', false, null); }
          if (e.key === 'i' || e.key === 'I') { e.preventDefault(); doc.execCommand('italic', false, null); }
          if (e.key === 'u' || e.key === 'U') { e.preventDefault(); doc.execCommand('underline', false, null); }
        }
      });
      var contentHeight = doc.documentElement.scrollHeight || doc.body.scrollHeight;
      if (contentHeight > 100) frame.style.height = (contentHeight + 20) + 'px';
    } catch(e) {}
  }, 50);
}

// v22.44: Get the live preview HTML (includes user edits to header/brand name)
// Only capture <body> content - excludes browser-injected <head> styles from designMode
function mailGetPreviewHtml() {
  try {
    var frame = document.getElementById('mailTemplatePreviewFrame');
    if (!frame) return null;
    var doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc || !doc.body || !doc.body.innerHTML) return null;
    // v22.44: Use body.innerHTML only - designMode can inject massive style blocks in <head>
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;">' + doc.body.innerHTML + '</body></html>';
  } catch(e) { return null; }
}

// v22.36: Sync template preview edits back to canvas
// v25.0: DISABLED - preview sync-back caused feedback loop destroying canvas content.
// Canvas is the source of truth. Preview is display-only.
// Edits made directly in the preview iframe are captured via mailGetPreviewHtml() at send time.
function mailSyncPreviewToCanvas(doc) {
  // v25.2: Re-enabled sync-back, but only called on explicit preview close (not continuous)
  if (!doc) return;
  try {
    var previewBody = doc.body || doc.querySelector('body');
    if (!previewBody) return;
    // Extract the actual content (skip template wrapper elements)
    var contentArea = previewBody.querySelector('.mail-body-content') || previewBody.querySelector('[data-mail-body]');
    var html = contentArea ? contentArea.innerHTML : previewBody.innerHTML;
    if (!html || html.trim().length < 10) return; // Safety: don't sync empty content
    var canvas = document.getElementById('mailComposeBody');
    if (canvas) {
      canvas.innerHTML = html;
      console.log('[Mail V25.2] Synced preview edits back to canvas');
    }
  } catch(e) {
    console.warn('[Mail] Preview sync-back failed:', e.message);
  }
}

// v22.36: Upload brand logo to Firebase Storage for email use (HTTP URL - email clients block base64)
window._mailLogoUrl = null;
window._mailLogoUrlSrc = null;
window._mailLogoUploadPromise = null; // v22.44: Track upload for awaiting
function mailEnsureLogoUrl(base64Src) {
  if (!base64Src || base64Src.indexOf('data:') !== 0) return;
  if (window._mailLogoUrlSrc === base64Src && window._mailLogoUrl) return;
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
  if (!uid) return;
  window._mailLogoUploadPromise = new Promise(function(resolve) {
  var img = new Image();
  img.onload = function() {
    try {
      // Proportional resize max 480x200 for good quality at 240px display
      var maxW = 480, maxH = 200;
      var w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
      if (h > maxH) { w = Math.round(w * (maxH / h)); h = maxH; }
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var resizedBase64 = c.toDataURL('image/png', 0.95);
      // v24.27: Try Firebase Storage first, fall back to storing base64 in Firestore
      if (typeof uploadToStorage === 'function') {
        var storagePath = 'users/' + uid + '/mail_logo/email_logo.png';
        uploadToStorage(storagePath, resizedBase64).then(function(url) {
          // v24.27: Also store in Firestore as backup - Storage URLs can 403
          try {
            firebase.firestore().doc('roweos_users/' + uid + '/profile/mail_logo').set({
              base64: resizedBase64.substring(0, 900000), // Firestore 1MB limit
              storageUrl: url,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          } catch(e) {}
          window._mailLogoUrl = url;
          window._mailLogoUrlSrc = base64Src;
          window._mailLogoBase64 = resizedBase64;
          if (typeof mailUpdateTemplatePreview === 'function') mailUpdateTemplatePreview();
          resolve(url);
        }).catch(function(e) {
          // Storage failed - use base64 directly as fallback
          window._mailLogoUrl = resizedBase64;
          window._mailLogoUrlSrc = base64Src;
          window._mailLogoBase64 = resizedBase64;
          resolve(resizedBase64);
        });
      } else {
        window._mailLogoUrl = resizedBase64;
        window._mailLogoBase64 = resizedBase64;
        resolve(resizedBase64);
      }
    } catch(e) { window._mailLogoUrl = null; resolve(null); }
  };
  img.onerror = function() { window._mailLogoUrl = null; resolve(null); };
  img.src = base64Src;
  }); // end Promise
}

// v22.31: Upload logo from template preview (temporary - does not replace brand logo)
function mailUploadLogo(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2MB', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    window._mailTempLogo = e.target.result;
    mailEnsureLogoUrl(e.target.result);
    showToast('Logo set for this email', 'success');
    mailUpdateTemplatePreview();
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// v22.31: Signature management
function getMailSignatures() {
  try { return JSON.parse(localStorage.getItem('roweos_mail_signatures') || '[]'); } catch(e) { return []; }
}

function saveMailSignatures(sigs) {
  localStorage.setItem('roweos_mail_signatures', JSON.stringify(sigs));
  writeDB('profile/mail', { signatures: sigs }); // v25.1
}

// v25.3: Per-account signature mapping
function getMailSignatureMap() {
  try { return JSON.parse(localStorage.getItem('roweos_mail_signature_map') || '{}'); } catch(e) { return {}; }
}
function saveMailSignatureMap(map) {
  localStorage.setItem('roweos_mail_signature_map', JSON.stringify(map));
  writeDB('profile/mail', { signatureMap: map }); // v25.1
}
function setSignatureForAccount(email, sigId) {
  var map = getMailSignatureMap();
  map[email] = sigId;
  saveMailSignatureMap(map);
}
function getSignatureForAccount(email) {
  var map = getMailSignatureMap();
  return map[email] || '';
}

function mailCreateSignature(name, html) {
  var sigs = getMailSignatures();
  sigs.push({ id: Date.now().toString(36), name: name, html: html, createdAt: new Date().toISOString() });
  saveMailSignatures(sigs);
  return sigs;
}

function mailDeleteSignature(id) {
  var sigs = getMailSignatures().filter(function(s) { return s.id !== id; });
  saveMailSignatures(sigs);
  return sigs;
}

function mailUpdateSignature(id, name, html) {
  var sigs = getMailSignatures();
  for (var i = 0; i < sigs.length; i++) {
    if (sigs[i].id === id) { sigs[i].name = name; sigs[i].html = html; break; }
  }
  saveMailSignatures(sigs);
  return sigs;
}

function mailRenderSignatureManager() {
  var container = document.getElementById('mailSignatureManager');
  if (!container) return;
  var sigs = getMailSignatures();
  var html = '';
  sigs.forEach(function(sig) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;margin-bottom:8px;">';
    html += '<div style="flex:1;"><div style="font-weight:600;font-size:13px;color:var(--text-primary);">' + escapeHtml(sig.name) + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;max-height:40px;overflow:hidden;">' + sig.html.replace(/<[^>]*>/g, '').substring(0, 80) + '</div></div>';
    html += '<button onclick="mailEditSignatureUI(\'' + sig.id + '\')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;padding:4px;" title="Edit"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>';
    html += '<button onclick="mailDeleteSignatureUI(\'' + sig.id + '\')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;padding:4px;" title="Delete"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
    html += '</div>';
  });
  if (sigs.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No signatures created yet.</div>';
  }
  container.innerHTML = html;
  // Also refresh compose dropdown
  mailRenderSignatureDropdown();
}

function mailEditSignatureUI(id) {
  var sigs = getMailSignatures();
  var sig = sigs.find(function(s) { return s.id === id; });
  if (!sig) return;
  var nameEl = document.getElementById('mailSigNewName');
  var bodyEl = document.getElementById('mailSigNewBody');
  if (nameEl) nameEl.value = sig.name;
  if (bodyEl) bodyEl.innerHTML = sig.html;
  // Store editing state
  window._mailEditingSigId = id;
  var saveBtn = document.getElementById('mailSigSaveBtn');
  if (saveBtn) saveBtn.textContent = 'Update Signature';
}

function mailDeleteSignatureUI(id) {
  mailDeleteSignature(id);
  mailRenderSignatureManager();
  showToast('Signature deleted', 'success');
}

function mailSaveSignatureUI() {
  var nameEl = document.getElementById('mailSigNewName');
  var bodyEl = document.getElementById('mailSigNewBody');
  var name = nameEl ? nameEl.value.trim() : '';
  var html = bodyEl ? bodyEl.innerHTML.trim() : '';
  if (!name) { showToast('Enter a signature name', 'error'); return; }
  if (!html || html === '<br>') { showToast('Enter signature content', 'error'); return; }
  if (window._mailEditingSigId) {
    mailUpdateSignature(window._mailEditingSigId, name, html);
    window._mailEditingSigId = null;
    var saveBtn = document.getElementById('mailSigSaveBtn');
    if (saveBtn) saveBtn.textContent = 'Save Signature';
  } else {
    mailCreateSignature(name, html);
  }
  if (nameEl) nameEl.value = '';
  if (bodyEl) bodyEl.innerHTML = '';
  mailRenderSignatureManager();
  showToast('Signature saved', 'success');
}

function mailRenderSignatureDropdown() {
  var dropdown = document.getElementById('mailSignatureSelect');
  if (!dropdown) return;
  var sigs = getMailSignatures();
  var html = '<option value="">No signature</option>';
  sigs.forEach(function(sig) {
    html += '<option value="' + sig.id + '">' + escapeHtml(sig.name) + '</option>';
  });
  dropdown.innerHTML = html;
}

function mailInsertSignature() {
  var dropdown = document.getElementById('mailSignatureSelect');
  if (!dropdown || !dropdown.value) return;
  var sigs = getMailSignatures();
  var sig = sigs.find(function(s) { return s.id === dropdown.value; });
  if (!sig) return;
  var canvas = document.getElementById('mailComposeBody');
  if (!canvas) return;
  // Remove existing signature if present
  var existing = canvas.querySelector('.mail-signature-block');
  if (existing) existing.remove();
  // Append signature
  var sigDiv = document.createElement('div');
  sigDiv.className = 'mail-signature-block';
  sigDiv.style.cssText = 'margin-top:20px;padding-top:12px;border-top:1px solid #ddd;font-size:13px;color:#666;';
  sigDiv.innerHTML = sig.html;
  canvas.appendChild(sigDiv);
  if (typeof mailUpdateWordCount === 'function') mailUpdateWordCount();
  mailUpdateTemplatePreview();
}

function mailGenerateAiTemplate() {
  var promptEl = document.getElementById('mailAiTemplatePrompt');
  var desc = promptEl ? promptEl.value.trim() : '';
  if (!desc) { showToast('Describe the template style you want', 'error'); return; }
  var canvasContent = mailGetCanvasContent();
  var canvasText = mailGetCanvasText().trim();
  if (!canvasText) { showToast('Write email content first, then generate a template for it', 'error'); return; }

  // Get brand context
  var brandName = 'Brand';
  var accent = '#a89878';
  try {
    var idx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
    if (brands[idx]) brandName = brands[idx].shortName || brands[idx].name || 'Brand';
    accent = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#a89878';
  } catch(e) {}

  // v28.4: Prefer base64 for logo (never expires). Firebase Storage URLs expire after ~1hr.
  var logoReady = Promise.resolve(window._mailLogoBase64 || window._mailLogoUrl || null);
  if (!window._mailLogoBase64 && !window._mailLogoUrl) {
    try {
      var _idx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
      var base64Logo = localStorage.getItem(getCurrentLogoKey(_idx)) || '';
      if (!base64Logo) { var _lb = brands[_idx]; if (_lb) base64Logo = _lb.logo || _lb.brandLogo || ''; }
      if (base64Logo && base64Logo.indexOf('data:') === 0) {
        mailEnsureLogoUrl(base64Logo);
        logoReady = (window._mailLogoUploadPromise || Promise.resolve(null)).then(function() {
          return window._mailLogoBase64 || window._mailLogoUrl || base64Logo;
        });
      }
    } catch(e) {}
  }

  // v23.2: Loading state for template generation
  mailShowComposeLoading(true);
  var canvas = document.getElementById('mailComposeBody');

  // v28.4/v29.0: Wait for logo then generate - use placeholder so AI doesn't need to reproduce base64
  logoReady.then(function(resolvedLogoUrl) {
  var logoUrl = window._mailLogoBase64 || resolvedLogoUrl || window._mailLogoUrl || '';
  // v29.0: Use a short placeholder in the AI prompt instead of the actual logo URL/base64.
  // LLMs can't reliably reproduce long base64 strings, causing broken logos.
  // We replace the placeholder with the real logo after AI returns.
  var hasLogo = !!logoUrl;

  var sys = 'You are an expert HTML email template designer. Create a professional, email-safe HTML template. Requirements:\n' +
    '- Complete HTML document with ALL styles inline (no <style> blocks, no CSS classes)\n' +
    '- Use a LIGHT/WHITE background for the email body area (emails must be readable in all clients)\n' +
    '- Use dark text (#333 or similar) on the light background\n' +
    '- Brand accent color: ' + accent + ' (use for headers, borders, buttons, decorative elements)\n' +
    '- Brand name: ' + brandName + '\n' +
    (hasLogo ? '- Brand logo: Include this exact img tag in the header: <img src="{{LOGO_PLACEHOLDER}}" alt="' + brandName + '" style="max-width:200px;max-height:80px;">\n' : '') +
    '- Place the email content inside the main content area\n' +
    '- IMPORTANT: Wrap the content area with a comment marker. Put <!-- EMAIL_CONTENT_START --> before the content and <!-- EMAIL_CONTENT_END --> after it.\n' +
    '- Use max-width: 600px centered layout (standard email width)\n' +
    '- The template should have: a branded header area, the content area, and a minimal footer\n' +
    '- Return ONLY the raw HTML. No markdown, no code fences, no explanation.\n' +
    '- CRITICAL: Use ONLY the exact logo img tag with {{LOGO_PLACEHOLDER}} as the src if a logo was specified.' + (!hasLogo ? ' Do NOT include any logo image.' : '');

  var user = 'Template style: ' + desc + '\n\nEmail content to wrap in this template:\n' + canvasContent;

  mailCallAI(sys, user, function(result) {
    mailShowComposeLoading(false);
    if (!result) { showToast('Template generation failed - try again', 'error'); return; }
    // v22.44: Strip markdown code fences if AI wraps HTML in them
    result = result.replace(/^[\s\S]*?```html?\s*\n?/i, '').replace(/\n?\s*```[\s\S]*$/, '').trim();
    // v29.0: Replace logo placeholder with actual base64/URL (AI can't reproduce long base64 strings)
    if (hasLogo && logoUrl) {
      result = result.replace(/\{\{LOGO_PLACEHOLDER\}\}/g, logoUrl);
    }
    // Show in preview
    var preview = document.getElementById('mailTemplatePreview');
    var frame = document.getElementById('mailTemplatePreviewFrame');
    if (preview && frame) {
      preview.style.display = '';
      var doc = frame.contentDocument || frame.contentWindow.document;
      doc.open();
      doc.write(result);
      doc.close();
      // v22.28: Auto-resize iframe to content
      setTimeout(function() {
        try {
          var h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
          if (h > 100) frame.style.height = (h + 20) + 'px';
        } catch(e) {}
      }, 150);
    }
    // Store the generated template HTML for sending
    window._mailAiTemplateHtml = result;
    window._mailAiTemplateDesc = desc;
    showToast('Custom template generated - see preview below. Use "Save Template" to keep it.', 'success');
    // v22.28: Show save template button in AI template row
    var saveBtn = document.getElementById('mailAiTemplateSaveBtn');
    if (saveBtn) saveBtn.style.display = 'flex';
  });
  }); // end logoReady.then
}

// v22.45: Save AI-generated template for reuse - strips content, saves structure only
function mailSaveAiTemplate() {
  if (!window._mailAiTemplateHtml) { showToast('Generate a template first', 'error'); return; }
  var desc = window._mailAiTemplateDesc || 'Custom AI Template';
  // v22.45: Extract template structure by replacing content with placeholder
  var templateHtml = window._mailAiTemplateHtml;
  // Try marker-based extraction first (AI adds these markers)
  var markerRegex = /<!-- EMAIL_CONTENT_START -->[\s\S]*?<!-- EMAIL_CONTENT_END -->/i;
  if (markerRegex.test(templateHtml)) {
    templateHtml = templateHtml.replace(markerRegex, '<!-- EMAIL_CONTENT_START -->{{EMAIL_CONTENT}}<!-- EMAIL_CONTENT_END -->');
  } else {
    // Fallback: find the main content area (largest div with line-height/font-size typical of body content)
    // Use a DOM parser to find and replace the content area
    var _tmpDiv = document.createElement('div');
    _tmpDiv.innerHTML = templateHtml;
    var contentArea = _tmpDiv.querySelector('div[style*="line-height:1.7"]') || _tmpDiv.querySelector('div[style*="line-height:1.6"]') || _tmpDiv.querySelector('div[style*="font-size:14px"]');
    if (contentArea) {
      contentArea.innerHTML = '{{EMAIL_CONTENT}}';
      templateHtml = _tmpDiv.innerHTML;
    }
  }
  var templates = [];
  try { templates = JSON.parse(localStorage.getItem('roweos_mail_custom_templates') || '[]'); } catch(e) {}
  templates.push({
    id: String(Date.now()),
    name: desc.substring(0, 60),
    html: templateHtml,
    createdAt: new Date().toISOString()
  });
  localStorage.setItem('roweos_mail_custom_templates', JSON.stringify(templates));
  writeDB('profile/mail', { customTemplates: templates }); // v25.1
  showToast('Template saved: ' + desc.substring(0, 40), 'success');
  // v22.28: Add to template dropdown
  mailRefreshTemplateDropdown();
}

function mailRefreshTemplateDropdown() {
  var sel = document.getElementById('mailComposeTemplate');
  if (!sel) return;
  // Remove old custom options
  var opts = sel.querySelectorAll('option[data-custom]');
  opts.forEach(function(o) { o.remove(); });
  // Add saved custom templates
  try {
    var templates = JSON.parse(localStorage.getItem('roweos_mail_custom_templates') || '[]');
    templates.forEach(function(t) {
      var opt = document.createElement('option');
      opt.value = 'custom_' + t.id;
      opt.textContent = t.name;
      opt.setAttribute('data-custom', 'true');
      sel.insertBefore(opt, sel.querySelector('option[value="ai"]'));
    });
  } catch(e) {}
}

// --- Save Reply-To Config ---
// v22.24: OAuth Client ID save helpers
function mailSaveGmailClientId() {
  var val = (document.getElementById('mailGmailClientId').value || '').trim();
  if (!val) { showToast('Please enter a Gmail Client ID', 'warning'); return; }
  localStorage.setItem('roweos_gmail_client_id', val);
  showToast('Gmail Client ID saved', 'success');
}

function mailSaveOutlookClientId() {
  var val = (document.getElementById('mailOutlookClientId').value || '').trim();
  if (!val) { showToast('Please enter an Outlook Client ID', 'warning'); return; }
  localStorage.setItem('roweos_outlook_client_id', val);
  showToast('Outlook Client ID saved', 'success');
}

function mailLoadOAuthInputs() {
  var gmailInput = document.getElementById('mailGmailClientId');
  var outlookInput = document.getElementById('mailOutlookClientId');
  if (gmailInput) gmailInput.value = localStorage.getItem('roweos_gmail_client_id') || '';
  if (outlookInput) outlookInput.value = localStorage.getItem('roweos_outlook_client_id') || '';
}

function mailSaveReplyTo() {
  var config = getMailConfig();
  var replyTo = (document.getElementById('mailReplyToConfig').value || '').trim();
  var displayName = (document.getElementById('mailDisplayName').value || '').trim();
  config.replyTo = replyTo;
  config.displayName = displayName;
  saveMailConfig(config);
  showToast('Mail settings saved', 'success');
}

// --- Connections Rendering ---
function renderMailConnections() {
  // v24.9: Render "Me" contact card
  var _mccEl = document.getElementById('mailContactCardDisplay');
  if (_mccEl && typeof getUserContact === 'function') {
    var _uc = getUserContact();
    var _fields = [
      { label: 'Name', value: _uc.name || '' },
      { label: 'Email', value: _uc.email || '' },
      { label: 'Work Email', value: _uc.workEmail || '' },
      { label: 'Phone', value: _uc.phone || '' },
      { label: 'Company', value: _uc.company || '' },
      { label: 'Title', value: _uc.title || '' }
    ];
    var _ccHtml = '';
    _fields.forEach(function(f) {
      if (f.value) {
        _ccHtml += '<div><span style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:0.03em;">' + f.label + '</span><div style="color:var(--text-primary);">' + escapeHtml(f.value) + '</div></div>';
      }
    });
    if (!_ccHtml) _ccHtml = '<div style="grid-column:span 2;color:var(--text-muted);font-size:12px;">No contact info set. Add it in Identity view.</div>';
    _mccEl.innerHTML = _ccHtml;
  }
  var config = getMailConfig();
  // v23.9: Multi-account - show all connected accounts
  var gmailAccts = getMailGmailAccounts();
  var outlookAccts = getMailOutlookAccounts();
  var gmailStatus = document.getElementById('gmailConnectionStatus');
  var gmailBtn = document.getElementById('gmailConnectBtn');
  if (gmailStatus && gmailBtn) {
    if (gmailAccts.length > 0) {
      var gmailHtml = '';
      gmailAccts.forEach(function(a) {
        var acctName = a.displayName || a.email.split('@')[0];
        gmailHtml += '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">';
        gmailHtml += '<div style="width:32px;height:32px;border-radius:50%;background:rgba(234,67,53,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">';
        gmailHtml += '<svg viewBox="0 0 24 24" width="16" height="16" fill="#ea4335"><path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z"/></svg>';
        gmailHtml += '</div>';
        gmailHtml += '<div style="flex:1;min-width:0;">';
        gmailHtml += '<div style="font-weight:500;color:var(--text-primary);font-size:13px;">' + escapeHtml(acctName) + '</div>';
        gmailHtml += '<div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(a.email) + '</div>';
        gmailHtml += '<div style="font-size:10px;color:#22c55e;margin-top:2px;display:flex;align-items:center;gap:4px;">';
        gmailHtml += '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;"></span>';
        gmailHtml += 'Gmail - Connected</div>';
        gmailHtml += '</div></div>';
      });
      gmailStatus.innerHTML = gmailHtml;
      gmailBtn.textContent = 'Add Account';
      gmailBtn.style.borderColor = '#a89878';
      gmailBtn.style.color = '#a89878';
      gmailBtn.onclick = mailConnectGmail;
    } else {
      gmailStatus.textContent = 'Not connected';
      gmailBtn.textContent = 'Connect';
      gmailBtn.style.borderColor = '#a89878';
      gmailBtn.style.color = '#a89878';
      gmailBtn.onclick = mailConnectGmail;
    }
  }
  var outlookStatus = document.getElementById('outlookConnectionStatus');
  var outlookBtn = document.getElementById('outlookConnectBtn');
  if (outlookStatus && outlookBtn) {
    if (outlookAccts.length > 0) {
      var outlookHtml = '';
      outlookAccts.forEach(function(a) {
        var acctName = a.displayName || a.email.split('@')[0];
        outlookHtml += '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">';
        outlookHtml += '<div style="width:32px;height:32px;border-radius:50%;background:rgba(0,120,212,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">';
        outlookHtml += '<svg viewBox="0 0 24 24" width="16" height="16" fill="#0078d4"><path d="M21.17 2.06A13.1 13.1 0 0019 1.87a12.94 12.94 0 00-7 2.05 12.94 12.94 0 00-7-2A13.1 13.1 0 002.83 2.06 1 1 0 002 3v12a1 1 0 001.17 1 10.9 10.9 0 012.83-.32 11 11 0 016 1.78 11 11 0 016-1.78 10.9 10.9 0 012.83.32A1 1 0 0022 15V3a1 1 0 00-.83-.94zM11 15.15a13 13 0 00-5-1.32V4.47a11 11 0 015 1.2zm2-10.48a11 11 0 015-1.2v9.36a13 13 0 00-5 1.32z"/></svg>';
        outlookHtml += '</div>';
        outlookHtml += '<div style="flex:1;min-width:0;">';
        outlookHtml += '<div style="font-weight:500;color:var(--text-primary);font-size:13px;">' + escapeHtml(acctName) + '</div>';
        outlookHtml += '<div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(a.email) + '</div>';
        outlookHtml += '<div style="font-size:10px;color:#22c55e;margin-top:2px;display:flex;align-items:center;gap:4px;">';
        outlookHtml += '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;"></span>';
        outlookHtml += 'Outlook - Connected</div>';
        outlookHtml += '</div></div>';
      });
      outlookStatus.innerHTML = outlookHtml;
      outlookBtn.textContent = 'Add Account';
      outlookBtn.onclick = mailConnectOutlook;
    } else {
      outlookStatus.textContent = 'Not connected';
      outlookBtn.textContent = 'Connect';
      outlookBtn.onclick = mailConnectOutlook;
    }
  }
  // Update inbox state
  var connected = document.getElementById('mailInboxConnected');
  var disconnected = document.getElementById('mailInboxDisconnected');
  if (gmailAccts.length > 0 || outlookAccts.length > 0) {
    if (connected) connected.style.display = '';
    if (disconnected) disconnected.style.display = 'none';
  } else {
    if (connected) connected.style.display = 'none';
    if (disconnected) disconnected.style.display = '';
  }
  // v22.24: Render from address list and load OAuth inputs
  renderMailFromAddresses();
  mailLoadOAuthInputs();
  // v24.27: Render unified account cards
  renderUnifiedAccountCards();
}

// v24.27: Unified per-account cards in mail settings
function renderUnifiedAccountCards() {
  var container = document.getElementById('mailUnifiedAccountCards');
  if (!container) return;
  var gmailAccts = typeof getMailGmailAccounts === 'function' ? getMailGmailAccounts() : [];
  var outlookAccts = typeof getMailOutlookAccounts === 'function' ? getMailOutlookAccounts() : [];
  var allAccts = [];
  for (var gi = 0; gi < gmailAccts.length; gi++) { gmailAccts[gi]._provider = 'gmail'; allAccts.push(gmailAccts[gi]); }
  for (var oi = 0; oi < outlookAccts.length; oi++) { outlookAccts[oi]._provider = 'outlook'; allAccts.push(outlookAccts[oi]); }
  if (allAccts.length === 0) { container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">No accounts connected yet. Connect Gmail or Outlook above.</div>'; return; }
  var sigs = typeof getMailSignatures === 'function' ? getMailSignatures() : [];
  var html = '';
  for (var ai = 0; ai < allAccts.length; ai++) {
    var acct = allAccts[ai];
    var provider = acct._provider;
    var providerColor = provider === 'gmail' ? '#ea4335' : '#0078d4';
    var providerLabel = provider === 'gmail' ? 'Gmail' : 'Outlook';
    var avatarKey = 'roweos_mail_avatar_' + acct.email;
    var avatar = '';
    try { avatar = localStorage.getItem(avatarKey) || ''; } catch(e) {}
    var initial = (acct.displayName || acct.email || '?').charAt(0).toUpperCase();
    var colorKey = 'roweos_mail_color_' + acct.email;
    var acctColor = '';
    try { acctColor = localStorage.getItem(colorKey) || ''; } catch(e) {}
    var currentSigId = typeof getSignatureForAccount === 'function' ? getSignatureForAccount(acct.email) : '';
    // v25.1: Multi-line account card header with all account details
    var _displayColor = acctColor || providerColor;
    html += '<div style="padding:14px;margin-bottom:10px;background:var(--bg-secondary);border-radius:var(--radius-md);border:1px solid var(--border-color);border-left:4px solid ' + _displayColor + ';">';
    // Row 1: avatar + name + email + disconnect
    html += '<div style="display:flex;align-items:flex-start;gap:12px;">';
    html += '<div style="width:48px;height:48px;border-radius:50%;background:' + _displayColor + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;cursor:pointer;border:2px solid ' + _displayColor + ';box-shadow:0 0 0 2px rgba(255,255,255,0.08);" onclick="mailUploadAccountAvatar(\'' + escapeHtml(acct.email) + '\')" title="Change photo">';
    if (avatar) {
      html += '<img src="' + avatar + '" style="width:100%;height:100%;object-fit:cover;">';
    } else {
      html += '<span style="color:#fff;font-size:20px;font-weight:700;">' + initial + '</span>';
    }
    html += '</div>';
    html += '<div style="flex:1;min-width:0;">';
    // Account name (editable)
    html += '<div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:2px;">' + escapeHtml(acct.displayName || acct.email.split('@')[0]) + '</div>';
    // Email address
    html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(acct.email) + '</div>';
    // Provider + connected status row
    html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
    html += '<span style="font-size:11px;font-weight:600;color:' + providerColor + ';padding:2px 7px;border-radius:10px;background:' + providerColor + '22;">' + providerLabel + '</span>';
    html += '<span style="display:flex;align-items:center;gap:3px;font-size:11px;color:#22c55e;"><span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;"></span>Connected</span>';
    // Selected color swatch
    html += '<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-muted);">Color: <input type="color" value="' + _displayColor + '" title="Account color" onclick="event.stopPropagation()" onchange="mailSetAccountColor(\'' + escapeHtml(acct.email) + '\', this.value); localStorage.setItem(\'' + colorKey + '\', this.value); renderUnifiedAccountCards();" style="width:20px;height:20px;border:none;background:none;cursor:pointer;padding:0;border-radius:4px;vertical-align:middle;"></span>';
    html += '</div>';
    html += '</div>';
    html += '<button onclick="mailDisconnectAccount(\'' + provider + '\', \'' + escapeHtml(acct.email) + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:none;color:#ef4444;font-size:10px;cursor:pointer;flex-shrink:0;margin-top:4px;">Remove</button>';
    html += '</div>';
    // Row 2: settings (display name, signature)
    html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    html += '<div>';
    html += '<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Display Name</div>';
    html += '<input type="text" value="' + escapeHtml(acct.displayName || '') + '" placeholder="Display name" onchange="mailSetAccountDisplayName(\'' + provider + '\',\'' + escapeHtml(acct.email) + '\', this.value)" style="width:100%;padding:5px 8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;box-sizing:border-box;">';
    html += '</div>';
    html += '<div>';
    html += '<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Auto-Signature</div>';
    html += '<select onchange="setSignatureForAccount(\'' + escapeHtml(acct.email) + '\', this.value)" style="width:100%;padding:5px 8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;box-sizing:border-box;">';
    html += '<option value="">None</option>';
    for (var si = 0; si < sigs.length; si++) {
      html += '<option value="' + sigs[si].id + '"' + (currentSigId === sigs[si].id ? ' selected' : '') + '>' + escapeHtml(sigs[si].name) + '</option>';
    }
    html += '</select>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
  }
  container.innerHTML = html;
  // Update connect buttons text
  var gmailBtn = document.getElementById('gmailConnectionStatus');
  if (gmailBtn) gmailBtn.textContent = gmailAccts.length > 0 ? 'Add Gmail' : 'Connect Gmail';
  var outlookBtn = document.getElementById('outlookConnectionStatus');
  if (outlookBtn) outlookBtn.textContent = outlookAccts.length > 0 ? 'Add Outlook' : 'Connect Outlook';
}

// v24.27: Upload per-account avatar
function mailUploadAccountAvatar(email) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function() {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      localStorage.setItem('roweos_mail_avatar_' + email, e.target.result);
      renderUnifiedAccountCards();
      showToast('Avatar updated', 'success');
    };
    reader.readAsDataURL(input.files[0]);
  };
  input.click();
}

// v22.24: From address management
function renderMailFromAddresses() {
  var listEl = document.getElementById('mailFromAddressList');
  if (!listEl) return;
  var config = getMailConfig();
  var defaultAddr = config.defaultFromAddress || getDefaultFromAddress();
  var builtIn = [];
  if (typeof isAdmin === 'function' && isAdmin()) {
    builtIn.push('roweos@therowecollection.com');
    builtIn.push('jordan@therowecollection.com');
  }
  // v22.28: Filter out hidden built-in addresses
  var hiddenBuiltIn = config.hiddenBuiltIn || [];
  builtIn = builtIn.filter(function(a) { return hiddenBuiltIn.indexOf(a) === -1; });
  var custom = config.customFromAddresses || [];
  var allAddrs = builtIn.concat(custom);
  var html = '';
  // v23.10: Multi-account Gmail/Outlook connected addresses (with display name)
  var connectedAddrs = [];
  var gmailAccts = getMailGmailAccounts();
  gmailAccts.forEach(function(acct) { connectedAddrs.push({ addr: acct.email, label: 'Gmail', displayName: acct.displayName || '' }); });
  var outlookAccts = getMailOutlookAccounts();
  outlookAccts.forEach(function(acct) { connectedAddrs.push({ addr: acct.email, label: 'Outlook', displayName: acct.displayName || '' }); });
  allAddrs.forEach(function(addr, i) {
    var isDefault = addr === defaultAddr;
    var isCustom = i >= builtIn.length;
    var customIdx = isCustom ? (i - builtIn.length) : -1;
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-secondary);border:1px solid ' + (isDefault ? 'var(--accent)' : 'var(--border-color)') + ';border-radius:8px;margin-bottom:6px;cursor:pointer;" onclick="mailSetDefaultFrom(\'' + addr.replace(/'/g, "\\'") + '\')">';
    html += '<span style="flex:1;font-size:13px;color:var(--text-primary);">' + escapeHtml(addr) + '</span>';
    if (isDefault) {
      html += '<span style="font-size:11px;color:var(--accent);font-weight:600;padding:2px 8px;border:1px solid var(--accent);border-radius:4px;">Default</span>';
    } else {
      html += '<span style="font-size:11px;color:var(--text-muted);">Tap to set default</span>';
    }
    // v22.28: All addresses can be removed (built-in and custom)
    if (isCustom) {
      html += '<button onclick="event.stopPropagation();mailRemoveFromAddress(' + customIdx + ')" style="padding:4px 10px;border-radius:6px;border:1px solid #ef4444;background:none;color:#ef4444;font-size:11px;cursor:pointer;margin-left:4px;">Remove</button>';
    } else {
      html += '<button onclick="event.stopPropagation();mailRemoveBuiltInAddress(\'' + addr.replace(/'/g, "\\'") + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid #ef4444;background:none;color:#ef4444;font-size:11px;cursor:pointer;margin-left:4px;">Remove</button>';
    }
    html += '</div>';
  });
  if (custom.length > 0) {
    html += '<p style="font-size:11px;color:var(--text-muted);margin:4px 0 8px 2px;">Custom addresses send via your connected Gmail/Outlook account</p>';
  }
  connectedAddrs.forEach(function(ca) {
    var isDefault = ca.addr === defaultAddr;
    var providerKey = ca.label.toLowerCase(); // 'gmail' or 'outlook'
    var safeAddr = ca.addr.replace(/'/g, "\\'");
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-secondary);border:1px solid ' + (isDefault ? 'var(--accent)' : 'var(--border-color)') + ';border-radius:8px;margin-bottom:6px;cursor:pointer;" onclick="mailSetDefaultFrom(\'' + safeAddr + '\')">';
    // v24.9: Per-address avatar
    var _fromAvatar = typeof getMailAvatarForFrom === 'function' ? getMailAvatarForFrom(ca.addr) : '';
    if (_fromAvatar) {
      html += '<img src="' + _fromAvatar + '" onclick="event.stopPropagation();mailUploadFromAvatar(\'' + safeAddr + '\')" style="width:28px;height:28px;border-radius:50%;object-fit:cover;cursor:pointer;flex-shrink:0;" title="Change avatar">';
    } else {
      html += '<div onclick="event.stopPropagation();mailUploadFromAvatar(\'' + safeAddr + '\')" style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);border:1px dashed var(--border-color);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;" title="Add avatar"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--text-muted)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
    }
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:13px;color:var(--text-primary);">' + escapeHtml(ca.addr) + '</div>';
    // v23.10: Editable display name
    html += '<div style="display:flex;align-items:center;gap:4px;margin-top:4px;" onclick="event.stopPropagation()">';
    html += '<input type="text" placeholder="Display name (e.g. Jordan Rowe)" value="' + escapeHtml(ca.displayName) + '" style="flex:1;font-size:11px;padding:3px 6px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);min-width:0;" onchange="mailSetAccountDisplayName(\'' + providerKey + '\',\'' + safeAddr + '\',this.value)" />';
    html += '</div>';
    html += '</div>';
    html += '<span style="font-size:10px;color:var(--text-muted);padding:2px 6px;border:1px solid var(--border-color);border-radius:4px;">' + ca.label + '</span>';
    // v23.11: Per-account color picker
    var acctColor = mailGetAccountColor(ca.addr);
    html += '<input type="color" value="' + acctColor + '" title="Account color" onclick="event.stopPropagation()" onchange="mailSetAccountColor(\'' + safeAddr + '\',this.value)" style="width:24px;height:24px;border:none;background:none;cursor:pointer;padding:0;border-radius:4px;" />';
    // v25.3: Per-account signature selector
    var _paSigs = typeof getMailSignatures === 'function' ? getMailSignatures() : [];
    var _paCurrentSigId = typeof getSignatureForAccount === 'function' ? getSignatureForAccount(ca.addr) : '';
    html += '<div style="margin-top:6px;" onclick="event.stopPropagation()"><label style="font-size:11px;color:var(--text-muted);">Auto-signature</label>';
    html += '<select onchange="setSignatureForAccount(\'' + safeAddr + '\', this.value)" style="width:100%;padding:4px 8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;margin-top:2px;">';
    html += '<option value="">None</option>';
    for (var _si = 0; _si < _paSigs.length; _si++) {
      html += '<option value="' + _paSigs[_si].id + '"' + (_paCurrentSigId === _paSigs[_si].id ? ' selected' : '') + '>' + escapeHtml(_paSigs[_si].name) + '</option>';
    }
    html += '</select></div>';
    if (isDefault) {
      html += '<span style="font-size:11px;color:var(--accent);font-weight:600;padding:2px 8px;border:1px solid var(--accent);border-radius:4px;margin-left:4px;">Default</span>';
    }
    // v23.10: Disconnect specific account (multi-account aware)
    html += '<button onclick="event.stopPropagation();mailDisconnectAccount(\'' + providerKey + '\', \'' + safeAddr + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid #ef4444;background:none;color:#ef4444;font-size:11px;cursor:pointer;margin-left:4px;">Remove</button>';
    html += '</div>';
  });
  listEl.innerHTML = html;
  // v23.13: Init mail logo preview
  if (typeof mailUpdateLogoPreview === 'function') mailUpdateLogoPreview();
}

// v24.9: Per-from-address avatar system
function getMailFromAvatars() {
  try { return JSON.parse(localStorage.getItem('roweos_mail_from_avatars') || '{}'); } catch(e) { return {}; }
}
function saveMailFromAvatars(avatars) {
  try { localStorage.setItem('roweos_mail_from_avatars', JSON.stringify(avatars)); } catch(e) {}
  writeDB('profile/mail', { fromAvatars: avatars }); // v25.1
}
function getMailAvatarForFrom(fromAddr) {
  if (!fromAddr) return '';
  var avatars = getMailFromAvatars();
  var addr = fromAddr.replace(/^(gmail|outlook):/, '').toLowerCase();
  return avatars[addr] || localStorage.getItem('roweos_mail_logo') || '';
}
function mailUploadFromAvatar(email) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function() {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        canvas.width = 100; canvas.height = 100;
        var ctx = canvas.getContext('2d');
        var sz = Math.min(img.width, img.height);
        var sx = (img.width - sz) / 2, sy = (img.height - sz) / 2;
        ctx.drawImage(img, sx, sy, sz, sz, 0, 0, 100, 100);
        var data = canvas.toDataURL('image/jpeg', 0.85);
        var avatars = getMailFromAvatars();
        avatars[email.toLowerCase()] = data;
        saveMailFromAvatars(avatars);
        renderMailFromAddresses();
        showToast('Avatar set for ' + email, 'success');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  };
  input.click();
}

function mailSetDefaultFrom(addr) {
  var config = getMailConfig();
  config.defaultFromAddress = addr;
  saveMailConfig(config);
  renderMailFromAddresses();
  renderMailComposeFrom();
  showToast('Default set to ' + addr, 'success');
}

function mailAddFromAddress() {
  var input = document.getElementById('mailNewFromAddress');
  if (!input) return;
  var addr = input.value.trim();
  if (!addr) return;
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(addr)) { showToast('Please enter a valid email address', 'warning'); return; }
  var config = getMailConfig();
  if (!config.customFromAddresses) config.customFromAddresses = [];
  if (config.customFromAddresses.indexOf(addr) !== -1) { showToast('Address already added', 'warning'); return; }
  config.customFromAddresses.push(addr);
  saveMailConfig(config);
  input.value = '';
  renderMailFromAddresses();
  renderMailComposeFrom();
  showToast('From address added: ' + addr, 'success');
}

function mailRemoveFromAddress(idx) {
  var config = getMailConfig();
  if (!config.customFromAddresses || !config.customFromAddresses[idx]) return;
  var removed = config.customFromAddresses.splice(idx, 1);
  saveMailConfig(config);
  renderMailFromAddresses();
  renderMailComposeFrom();
  showToast('Removed: ' + removed[0], 'success');
}

// v23.11: Per-account color picker
var _mailDefaultAccountColors = { gmail: '#ea4335', outlook: '#0078d4' };
function mailGetAccountColor(email) {
  var config = getMailConfig();
  if (config.accountColors && config.accountColors[email]) return config.accountColors[email];
  // Default by provider
  if (email.indexOf('gmail') !== -1 || email.indexOf('googlemail') !== -1) return _mailDefaultAccountColors.gmail;
  return _mailDefaultAccountColors.outlook;
}
function mailSetAccountColor(email, color) {
  var config = getMailConfig();
  if (!config.accountColors) config.accountColors = {};
  config.accountColors[email] = color;
  saveMailConfig(config);
  mailRenderInboxFilters();
  mailRenderCombinedInbox();
  // v25.1: saveMailConfig() already writes through to Firestore
}

// v22.28: Remove built-in from addresses (stored as hidden list in config)
function mailRemoveBuiltInAddress(addr) {
  var config = getMailConfig();
  if (!config.hiddenBuiltIn) config.hiddenBuiltIn = [];
  if (config.hiddenBuiltIn.indexOf(addr) === -1) config.hiddenBuiltIn.push(addr);
  // If removing the default, clear default
  if (config.defaultFromAddress === addr) delete config.defaultFromAddress;
  saveMailConfig(config);
  renderMailFromAddresses();
  renderMailComposeFrom();
  showToast('Removed: ' + addr, 'success');
}

// --- Gmail OAuth (Phase 2) ---
function mailConnectGmail() {
  // Gmail OAuth requires a Google Cloud project with Gmail API enabled
  // Client ID should be stored in settings/env
  var clientId = '1084193250080-lbcikta26paja1ok1sd2th4hiap57acj.apps.googleusercontent.com';
  var redirectUri = window.location.origin + '/social-callback.html';
  var scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify';
  // v22.24: Embed UID in state for Firestore token storage (cross-device)
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
  var state = 'gmail_mail_' + Date.now();
  if (uid) state += '~u:' + uid;
  localStorage.setItem('roweos_mail_oauth_state', state);
  var authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(scope) +
    '&access_type=offline' +
    '&prompt=consent' +
    '&state=' + encodeURIComponent(state);
  window.open(authUrl, 'gmail_auth', 'width=500,height=700');
}

// v22.24: Listen for Gmail/Outlook connection from callback popup
window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'gmail_mail_connected') {
    // v24.26: Removed connection toast - expected to always be connected
    // v23.1: Clear disconnected flag so sync won't block this provider
    try { var _dc = JSON.parse(localStorage.getItem('roweos_mail_disconnected') || '[]'); _dc = _dc.filter(function(p) { return p !== 'gmail'; }); localStorage.setItem('roweos_mail_disconnected', JSON.stringify(_dc)); } catch(e) {}
    renderMailConnections();
    // v24.25: Fetch ONLY the newly connected account, not all accounts
    var _connectedEmail = event.data.email || '';
    var _gmAccts = getMailGmailAccounts();
    if (_connectedEmail) {
      var _matchedAcct = _gmAccts.find(function(a) { return a.email === _connectedEmail; });
      if (_matchedAcct && _matchedAcct.token) {
        mailFetchGmailInbox(_matchedAcct);
      }
    } else if (_gmAccts.length > 0 && _gmAccts[0].token) {
      mailFetchGmailInbox(_gmAccts[0]);
    }
  }
  if (event.data && event.data.type === 'outlook_mail_connected') {
    // v24.26: Removed connection toast - expected to always be connected
    // v23.1: Clear disconnected flag
    try { var _dc2 = JSON.parse(localStorage.getItem('roweos_mail_disconnected') || '[]'); _dc2 = _dc2.filter(function(p) { return p !== 'outlook'; }); localStorage.setItem('roweos_mail_disconnected', JSON.stringify(_dc2)); } catch(e) {}
    renderMailConnections();
    // v24.25: Fetch the newly connected Outlook account
    var _connectedOutlookEmail = event.data.email || '';
    var _olAccts = getMailOutlookAccounts();
    if (_connectedOutlookEmail) {
      var _matchedOlAcct = _olAccts.find(function(a) { return a.email === _connectedOutlookEmail; });
      if (_matchedOlAcct && _matchedOlAcct.token) {
        if (typeof mailFetchOutlookInbox === 'function') mailFetchOutlookInbox(_matchedOlAcct);
      }
    }
  }
  // v22.33: Outlook Calendar connected
  if (event.data && event.data.type === 'outlook_calendar_connected') {
    _outlookCalConnected = true;
    // v24.26: Removed connection toast - expected to always be connected
    updateCalendarIntegrationUI();
    // v22.44: Fetch calendar list first, then sync events
    fetchOutlookCalendarList(function() {
      syncOutlookCalendarEvents();
    });
    // Update onboarding status if visible
    var obStatus = document.getElementById('onboardingOutlookCalStatus');
    if (obStatus) { obStatus.style.display = 'block'; }
    var obCard = document.getElementById('onboardingOutlookCalCard');
    if (obCard) { obCard.dataset.connected = 'true'; obCard.style.borderColor = '#0078d4'; }
  }
});

// v22.25: Also detect connection when user returns to tab (popup may have closed without postMessage)
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    // Check if mail config changed (connection happened in popup)
    try {
      var config = getMailConfig();
      var gmailStatus = document.getElementById('gmailConnectionStatus');
      var outlookStatus = document.getElementById('outlookConnectionStatus');
      // v23.9: Multi-account aware - check arrays or legacy fields
      var hasGmail = (config.gmailAccounts && config.gmailAccounts.length > 0) || config.gmailEmail;
      if (gmailStatus && hasGmail && gmailStatus.textContent === 'Not connected') {
        renderMailConnections();
        renderMailComposeFrom();
        var gmailLabel = config.gmailAccounts && config.gmailAccounts.length > 0 ? config.gmailAccounts[config.gmailAccounts.length - 1].email : config.gmailEmail;
        // v24.26: Removed connection toast
      }
      var hasOutlook = (config.outlookAccounts && config.outlookAccounts.length > 0) || config.outlookEmail;
      if (outlookStatus && hasOutlook && outlookStatus.textContent === 'Not connected') {
        renderMailConnections();
        renderMailComposeFrom();
        var outlookLabel = config.outlookAccounts && config.outlookAccounts.length > 0 ? config.outlookAccounts[config.outlookAccounts.length - 1].email : config.outlookEmail;
        // v24.26: Removed connection toast
      }
    } catch(e) {}
  }
});

// --- Outlook OAuth ---
function mailConnectOutlook() {
  var clientId = '41b2af7a-e6d9-45f3-a508-b59f055e7043';
  var redirectUri = window.location.origin + '/social-callback.html';
  var scope = 'User.Read Mail.Read Mail.Send Mail.ReadWrite offline_access';
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
  var state = 'outlook_mail_' + Date.now();
  if (uid) state += '~u:' + uid;
  localStorage.setItem('roweos_mail_oauth_state', state);
  var authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize' +
    '?client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(scope) +
    '&state=' + encodeURIComponent(state);
  window.open(authUrl, 'outlook_auth', 'width=500,height=700');
}

function mailDisconnectProvider(provider) {
  var config = getMailConfig();
  if (provider === 'gmail') {
    delete config.gmailEmail;
    delete config.gmailToken;
    delete config.gmailRefreshToken;
    delete config.gmailExpiresAt;
    delete config.gmailAccounts;
  } else if (provider === 'outlook') {
    delete config.outlookEmail;
    delete config.outlookToken;
    delete config.outlookRefreshToken;
    delete config.outlookAccounts;
  }
  saveMailConfig(config);
  // v23.1: Track disconnected providers so loadFromFirebaseV2 won't restore them
  try {
    var disconnected = JSON.parse(localStorage.getItem('roweos_mail_disconnected') || '[]');
    if (disconnected.indexOf(provider) === -1) disconnected.push(provider);
    localStorage.setItem('roweos_mail_disconnected', JSON.stringify(disconnected));
  } catch(e) {}
  // v25.0: Write-through push mail config to cloud
  if (typeof writeDB === 'function') writeDB('profile/mail', { config: JSON.parse(localStorage.getItem('roweos_mail_config') || '{}') });
  renderMailConnections();
  renderMailComposeFrom();
  showToast(provider.charAt(0).toUpperCase() + provider.slice(1) + ' disconnected', 'info');
}

// v23.9: Disconnect a specific account (for multi-account)
function mailDisconnectAccount(provider, email) {
  var config = getMailConfig();
  if (provider === 'gmail') {
    // Remove from array
    if (config.gmailAccounts) {
      config.gmailAccounts = config.gmailAccounts.filter(function(a) { return a.email !== email; });
      if (config.gmailAccounts.length === 0) delete config.gmailAccounts;
    }
    // Also clean legacy fields if matching
    if (config.gmailEmail === email) {
      delete config.gmailEmail;
      delete config.gmailToken;
      delete config.gmailRefreshToken;
      delete config.gmailExpiresAt;
    }
  } else if (provider === 'outlook') {
    if (config.outlookAccounts) {
      config.outlookAccounts = config.outlookAccounts.filter(function(a) { return a.email !== email; });
      if (config.outlookAccounts.length === 0) delete config.outlookAccounts;
    }
    if (config.outlookEmail === email) {
      delete config.outlookEmail;
      delete config.outlookToken;
      delete config.outlookRefreshToken;
    }
  }
  saveMailConfig(config);
  // v23.12: Track disconnected accounts so Firebase sync won't restore them
  try {
    var dcAccts = JSON.parse(localStorage.getItem('roweos_mail_disconnected_accounts') || '[]');
    var dcKey = provider + ':' + email;
    if (dcAccts.indexOf(dcKey) === -1) dcAccts.push(dcKey);
    localStorage.setItem('roweos_mail_disconnected_accounts', JSON.stringify(dcAccts));
    // Also set provider-level flag if no accounts remain
    var remaining = provider === 'gmail' ? getMailGmailAccounts() : getMailOutlookAccounts();
    if (remaining.length === 0) {
      var disconnected = JSON.parse(localStorage.getItem('roweos_mail_disconnected') || '[]');
      if (disconnected.indexOf(provider) === -1) disconnected.push(provider);
      localStorage.setItem('roweos_mail_disconnected', JSON.stringify(disconnected));
    }
  } catch(e) {}
  // v25.0: Write-through push mail config to cloud
  if (typeof writeDB === 'function') writeDB('profile/mail', { config: JSON.parse(localStorage.getItem('roweos_mail_config') || '{}') });
  renderMailConnections();
  renderMailComposeFrom();
  showToast(email + ' disconnected', 'info');
}

// v23.10: Set display name for a connected account
function mailSetAccountDisplayName(provider, email, displayName) {
  var config = getMailConfig();
  var acctKey = provider === 'gmail' ? 'gmailAccounts' : 'outlookAccounts';
  if (config[acctKey]) {
    for (var i = 0; i < config[acctKey].length; i++) {
      if (config[acctKey][i].email === email) {
        config[acctKey][i].displayName = displayName.trim();
        break;
      }
    }
  }
  saveMailConfig(config);
  renderMailComposeFrom();
  showToast('Display name updated', 'success');
}

// --- Inbox ---
// v23.10: Multi-account inbox state - keyed by email address
var _mailInboxFilter = 'all'; // 'all' or specific email address
var _mailCurrentMessages = {}; // { 'user@gmail.com': [msgs], 'user2@gmail.com': [msgs], ... }
var _mailOpenMessage = { id: null, provider: null, isUnread: false };
var _mailSelectedIds = {}; // { 'msgId': { provider, accountEmail, isUnread } }
var _mailSelectMode = false;

function mailToggleSelectMode() {
  _mailSelectMode = !_mailSelectMode;
  _mailSelectedIds = {};
  mailUpdateBulkBar();
  mailRenderCombinedInbox();
}

function mailToggleSelect(msgId, provider, accountEmail, isUnread, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  if (_mailSelectedIds[msgId]) {
    delete _mailSelectedIds[msgId];
  } else {
    _mailSelectedIds[msgId] = { provider: provider, accountEmail: accountEmail, isUnread: isUnread };
  }
  mailUpdateBulkBar();
  // Toggle visual state
  var card = document.querySelector('.mail-inbox-card[data-msg-id="' + msgId + '"]');
  if (card) {
    var isNowSelected = !!_mailSelectedIds[msgId];
    card.classList.toggle('mail-selected', isNowSelected);
    // v29.0: Also update the checkbox checked state
    var cb = card.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = isNowSelected;
  }
}

function mailSelectAll() {
  var list = document.getElementById('mailInboxList');
  if (!list) return;
  var cards = list.querySelectorAll('.mail-inbox-card[data-msg-id]');
  var allSelected = Object.keys(_mailSelectedIds).length === cards.length && cards.length > 0;
  if (allSelected) {
    _mailSelectedIds = {};
  } else {
    cards.forEach(function(c) {
      var id = c.getAttribute('data-msg-id');
      var prov = c.getAttribute('data-provider');
      var acct = c.getAttribute('data-account');
      var unread = c.classList.contains('unread');
      _mailSelectedIds[id] = { provider: prov, accountEmail: acct, isUnread: unread };
    });
  }
  mailUpdateBulkBar();
  mailRenderCombinedInbox();
}

function mailUpdateBulkBar() {
  var bar = document.getElementById('mailBulkBar');
  if (!bar) return;
  var count = Object.keys(_mailSelectedIds).length;
  if (count > 0 && _mailSelectMode) {
    bar.style.display = 'flex';
    var countEl = document.getElementById('mailBulkCount');
    if (countEl) countEl.textContent = count + ' selected';
  } else {
    bar.style.display = 'none';
  }
}

function mailBulkMarkRead() {
  var ids = Object.keys(_mailSelectedIds);
  if (!ids.length) return;
  var done = 0;
  ids.forEach(function(msgId) {
    var info = _mailSelectedIds[msgId];
    if (!info) return;
    var acctEmail = info.accountEmail;
    var config = {};
    try { config = JSON.parse(localStorage.getItem('roweos_mail_config') || '{}'); } catch(e) {}
    if (info.provider === 'gmail') {
      var gmailAcct = (config.gmailAccounts || []).find(function(a) { return a.email === acctEmail; });
      if (!gmailAcct) return;
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msgId + '/modify', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + gmailAcct.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
      }).then(function() {
        var msgs = _mailCurrentMessages[acctEmail] || [];
        var msg = msgs.find(function(m) { return m.id === msgId; });
        if (msg) msg.isUnread = false;
        done++; if (done === ids.length) { _mailSelectedIds = {}; mailUpdateBulkBar(); mailRenderCombinedInbox(); updateMailInboxBadge(); }
      });
    } else {
      var outlookAcct = (config.outlookAccounts || []).find(function(a) { return a.email === acctEmail; });
      if (!outlookAcct) return;
      fetch('https://graph.microsoft.com/v1.0/me/messages/' + msgId, {
        method: 'PATCH', headers: { 'Authorization': 'Bearer ' + outlookAcct.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true })
      }).then(function() {
        var msgs = _mailCurrentMessages[acctEmail] || [];
        var msg = msgs.find(function(m) { return m.id === msgId; });
        if (msg) msg.isUnread = false;
        done++; if (done === ids.length) { _mailSelectedIds = {}; mailUpdateBulkBar(); mailRenderCombinedInbox(); updateMailInboxBadge(); }
      });
    }
  });
  showToast('Marking ' + ids.length + ' as read...', 'info');
}

function mailBulkMarkUnread() {
  var ids = Object.keys(_mailSelectedIds);
  if (!ids.length) return;
  var done = 0;
  ids.forEach(function(msgId) {
    var info = _mailSelectedIds[msgId];
    if (!info) return;
    var acctEmail = info.accountEmail;
    var config = {};
    try { config = JSON.parse(localStorage.getItem('roweos_mail_config') || '{}'); } catch(e) {}
    if (info.provider === 'gmail') {
      var gmailAcct = (config.gmailAccounts || []).find(function(a) { return a.email === acctEmail; });
      if (!gmailAcct) return;
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msgId + '/modify', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + gmailAcct.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds: ['UNREAD'] })
      }).then(function() {
        var msgs = _mailCurrentMessages[acctEmail] || [];
        var msg = msgs.find(function(m) { return m.id === msgId; });
        if (msg) msg.isUnread = true;
        done++; if (done === ids.length) { _mailSelectedIds = {}; mailUpdateBulkBar(); mailRenderCombinedInbox(); updateMailInboxBadge(); }
      });
    } else {
      var outlookAcct = (config.outlookAccounts || []).find(function(a) { return a.email === acctEmail; });
      if (!outlookAcct) return;
      fetch('https://graph.microsoft.com/v1.0/me/messages/' + msgId, {
        method: 'PATCH', headers: { 'Authorization': 'Bearer ' + outlookAcct.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: false })
      }).then(function() {
        var msgs = _mailCurrentMessages[acctEmail] || [];
        var msg = msgs.find(function(m) { return m.id === msgId; });
        if (msg) msg.isUnread = true;
        done++; if (done === ids.length) { _mailSelectedIds = {}; mailUpdateBulkBar(); mailRenderCombinedInbox(); updateMailInboxBadge(); }
      });
    }
  });
  showToast('Marking ' + ids.length + ' as unread...', 'info');
}

function mailBulkDelete() {
  var ids = Object.keys(_mailSelectedIds);
  if (!ids.length) return;
  if (!confirm('Delete ' + ids.length + ' message' + (ids.length > 1 ? 's' : '') + '?')) return;
  var done = 0;
  ids.forEach(function(msgId) {
    var info = _mailSelectedIds[msgId];
    if (!info) return;
    var acctEmail = info.accountEmail;
    var config = {};
    try { config = JSON.parse(localStorage.getItem('roweos_mail_config') || '{}'); } catch(e) {}
    if (info.provider === 'gmail') {
      var gmailAcct = (config.gmailAccounts || []).find(function(a) { return a.email === acctEmail; });
      if (!gmailAcct) return;
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msgId + '/trash', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + gmailAcct.token }
      }).then(function() {
        mailRemoveFromLocal(msgId, acctEmail);
        done++; if (done === ids.length) { _mailSelectedIds = {}; mailUpdateBulkBar(); mailRenderCombinedInbox(); updateMailInboxBadge(); showToast(ids.length + ' deleted', 'success'); }
      });
    } else {
      var outlookAcct = (config.outlookAccounts || []).find(function(a) { return a.email === acctEmail; });
      if (!outlookAcct) return;
      fetch('https://graph.microsoft.com/v1.0/me/messages/' + msgId + '/move', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + outlookAcct.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationId: 'deleteditems' })
      }).then(function() {
        mailRemoveFromLocal(msgId, acctEmail);
        done++; if (done === ids.length) { _mailSelectedIds = {}; mailUpdateBulkBar(); mailRenderCombinedInbox(); updateMailInboxBadge(); showToast(ids.length + ' deleted', 'success'); }
      });
    }
  });
  showToast('Deleting ' + ids.length + '...', 'info');
}

function mailRenderInboxFilters() {
  var el = document.getElementById('mailInboxFilters');
  if (!el) return;
  var gmailAccts = getMailGmailAccounts();
  var outlookAccts = getMailOutlookAccounts();
  var totalAccounts = gmailAccts.length + outlookAccts.length;
  // Only show filters if 2+ accounts connected
  if (totalAccounts < 2) { el.innerHTML = ''; _mailInboxFilter = 'all'; return; }
  var html = '';
  // v23.13: No inline border-left, no inline color overrides - CSS handles gradient styling
  html += '<span class="mail-filter-pill' + (_mailInboxFilter === 'all' ? ' active' : '') + '" onclick="mailSetInboxFilter(\'all\')">All</span>';
  gmailAccts.forEach(function(acct) {
    var label = acct.displayName || acct.email;
    html += '<span class="mail-filter-pill' + (_mailInboxFilter === acct.email ? ' active' : '') + '" onclick="mailSetInboxFilter(\'' + escapeHtml(acct.email) + '\')">' + escapeHtml(label) + '</span>';
  });
  outlookAccts.forEach(function(acct) {
    var label = acct.displayName || acct.email;
    html += '<span class="mail-filter-pill' + (_mailInboxFilter === acct.email ? ' active' : '') + '" onclick="mailSetInboxFilter(\'' + escapeHtml(acct.email) + '\')">' + escapeHtml(label) + '</span>';
  });
  el.innerHTML = html;
}

function mailSetInboxFilter(filter) {
  _mailInboxFilter = filter;
  mailRenderInboxFilters();
  mailRenderCombinedInbox();
}

// v25.6: Convert email date string to local time display
function formatMailDate(rawDate) {
  if (!rawDate) return '';
  try {
    var d = new Date(rawDate);
    if (isNaN(d.getTime())) return rawDate;
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var hours = d.getHours();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    var h12 = hours % 12 || 12;
    var mins = d.getMinutes();
    mins = mins < 10 ? '0' + mins : String(mins);
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ' ' + h12 + ':' + mins + ' ' + ampm;
  } catch(e) {
    return rawDate;
  }
}

function mailRenderCombinedInbox() {
  var gmailAccts = getMailGmailAccounts();
  var outlookAccts = getMailOutlookAccounts();
  var totalAccounts = gmailAccts.length + outlookAccts.length;
  // v24.25: Ensure connected/disconnected panels match actual account state
  var _connPanel = document.getElementById('mailInboxConnected');
  var _disconnPanel = document.getElementById('mailInboxDisconnected');
  if (totalAccounts > 0) {
    if (_connPanel) _connPanel.style.display = '';
    if (_disconnPanel) _disconnPanel.style.display = 'none';
  } else {
    if (_connPanel) _connPanel.style.display = 'none';
    if (_disconnPanel) _disconnPanel.style.display = '';
    // v24.25: Clear stale badge when no accounts connected
    updateMailInboxBadge();
    return;
  }
  // v23.10: Build account label lookup for badges
  var acctLabels = {};
  gmailAccts.forEach(function(a) { acctLabels[a.email] = a.displayName || a.email; });
  outlookAccts.forEach(function(a) { acctLabels[a.email] = a.displayName || a.email; });
  var msgs = [];
  var keys = Object.keys(_mailCurrentMessages);
  keys.forEach(function(acctEmail) {
    if (_mailInboxFilter === 'all' || _mailInboxFilter === acctEmail) {
      _mailCurrentMessages[acctEmail].forEach(function(m) { msgs.push(m); });
    }
  });
  // Sort by date descending
  msgs.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
  if (msgs.length === 0) {
    document.getElementById('mailInboxList').innerHTML = '<div class="mail-empty">No messages</div>';
    document.getElementById('mailInboxStatus').textContent = '0 messages';
    return;
  }
  var html = '';
  var showBadge = totalAccounts > 1;
  msgs.forEach(function(msg) {
    // v23.12: Parse sender for avatar initial
    var senderName = (msg.from || '').replace(/<[^>]+>/, '').trim() || 'U';
    var avatarInitial = senderName.charAt(0).toUpperCase();
    // v23.12: Muted RoweOS palette
    var avatarColors = ['#a89878','#c4a882','#b8a08c','#c9b99a','#a3b18a','#8fae8b','#7ea6a0','#8ba4b8','#9b97b8','#b89bb0','#c49b8a','#d4a87c'];
    var colorIdx = 0;
    for (var ci = 0; ci < senderName.length; ci++) colorIdx += senderName.charCodeAt(ci);
    var avatarBg = avatarColors[colorIdx % avatarColors.length];
    // v25.6: Convert to local timezone
    var dateStr = formatMailDate(msg.date);
    // v23.12: Get display name for the account receiving this message
    var displayName = showBadge ? (acctLabels[msg.accountEmail] || '') : '';
    var _isSelected = !!_mailSelectedIds[msg.id];
    html += '<div class="mail-card mail-inbox-card' + (msg.isUnread ? ' unread' : '') + (_isSelected ? ' mail-selected' : '') + '" data-msg-id="' + escapeHtml(msg.id) + '" data-provider="' + msg.provider + '" data-account="' + escapeHtml(msg.accountEmail || '') + '" style="--card-accent:' + avatarBg + ';" onclick="' + (_mailSelectMode ? 'mailToggleSelect(\'' + escapeHtml(msg.id) + '\',\'' + msg.provider + '\',\'' + escapeHtml(msg.accountEmail || '') + '\',' + msg.isUnread + ',event)' : (msg.provider === 'gmail' ? 'mailOpenGmailMessage' : 'mailOpenOutlookMessage') + '(\'' + escapeHtml(msg.id) + '\', false, ' + (msg.isUnread ? 'true' : 'false') + ', \'' + escapeHtml(msg.accountEmail || '') + '\')') + '">';
    html += '<div class="mail-card-inner">';
    if (_mailSelectMode) {
      html += '<div style="display:flex;align-items:center;margin-right:10px;flex-shrink:0;"><input type="checkbox"' + (_isSelected ? ' checked' : '') + ' onclick="mailToggleSelect(\'' + escapeHtml(msg.id) + '\',\'' + msg.provider + '\',\'' + escapeHtml(msg.accountEmail || '') + '\',' + msg.isUnread + ',event)" style="width:16px;height:16px;accent-color:var(--brand-accent,#a89878);cursor:pointer;"></div>';
    }
    html += '<div class="mail-card-avatar" style="background:' + avatarBg + ';">' + avatarInitial + '</div>';
    html += '<div class="mail-card-content">';
    html += '<div class="mail-card-header"><div class="mail-card-to">' + escapeHtml(senderName) + '</div>';
    // v23.12: Display name + date on right side
    html += '<div style="text-align:right;flex-shrink:0;margin-left:12px;">';
    if (displayName) {
      var acctColor = mailGetAccountColor(msg.accountEmail || '') || avatarBg;
      html += '<div style="font-size:10px;font-weight:600;color:' + acctColor + ';margin-bottom:2px;white-space:nowrap;">' + escapeHtml(displayName) + '</div>';
    }
    html += '<div class="mail-card-date">' + escapeHtml(dateStr) + '</div>';
    html += '</div></div>';
    html += '<div class="mail-card-subject">' + escapeHtml(msg.subject || '(No subject)') + '</div>';
    if (msg.snippet) html += '<div class="mail-card-preview">' + escapeHtml(msg.snippet) + '</div>';
    html += '</div></div></div>';
  });
  document.getElementById('mailInboxList').innerHTML = html;
  document.getElementById('mailInboxStatus').textContent = msgs.length + ' messages';
}

// v23.12: Glowing fetch indicator (replaces toast notifications)
var _mailFetchCount = 0;
function mailShowFetchIndicator(label) {
  _mailFetchCount++;
  var el = document.getElementById('mailFetchIndicator');
  var textEl = document.getElementById('mailFetchText');
  if (el) el.classList.add('active');
  if (textEl) textEl.innerHTML = 'Fetching <span>' + escapeHtml(label || 'inbox') + '</span>...';
}
function mailHideFetchIndicator() {
  _mailFetchCount--;
  if (_mailFetchCount <= 0) {
    _mailFetchCount = 0;
    var el = document.getElementById('mailFetchIndicator');
    if (el) el.classList.remove('active');
  }
}

// v23.13: Mail logo upload/remove
function mailHandleLogoUpload(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 500000) { showToast('Image too large (max 500KB)', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      localStorage.setItem('roweos_mail_logo', e.target.result);
      mailUpdateLogoPreview();
      showToast('Mail logo saved', 'success');
      writeDB('profile/mail', { logo: e.target.result }); // v25.1
    } catch(err) { showToast('Failed to save logo', 'error'); }
  };
  reader.readAsDataURL(file);
}
function mailRemoveLogo() {
  localStorage.removeItem('roweos_mail_logo');
  mailUpdateLogoPreview();
  showToast('Mail logo removed', 'success');
  writeDB('profile/mail', { logo: '' }); // v25.1
}
function mailUpdateLogoPreview() {
  var logo = '';
  try { logo = localStorage.getItem('roweos_mail_logo') || ''; } catch(e) {}
  var preview = document.getElementById('mailLogoPreview');
  var removeBtn = document.getElementById('mailLogoRemoveBtn');
  var downloadBtn = document.getElementById('mailLogoDownloadBtn');
  var placeholder = document.getElementById('mailLogoPlaceholderIcon');
  if (!preview) return;
  if (logo) {
    preview.innerHTML = '<img src="' + logo + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    if (removeBtn) removeBtn.style.display = '';
    if (downloadBtn) downloadBtn.style.display = '';
  } else {
    preview.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-muted)" stroke-width="1.5" id="mailLogoPlaceholderIcon"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    if (removeBtn) removeBtn.style.display = 'none';
    if (downloadBtn) downloadBtn.style.display = 'none';
  }
}

// v25.1: Download mail logo as PNG
function downloadMailLogo() {
  var logo = localStorage.getItem('roweos_mail_logo');
  if (!logo) { showToast('No mail logo found', 'error'); return; }
  var a = document.createElement('a');
  a.href = logo;
  a.download = 'roweos_mail_logo.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// v24.13: Toggle compact mail view (hide/show content preview)
function toggleMailCompact() {
  var mailView = document.getElementById('mailView');
  if (!mailView) return;
  var isCompact = mailView.classList.toggle('mail-compact');
  localStorage.setItem('roweos_mail_compact', isCompact ? '1' : '0');
  var btn = document.getElementById('mailCompactToggle');
  if (btn) btn.style.color = isCompact ? 'var(--accent)' : 'var(--text-secondary)';
}

function mailRefreshInbox() {
  var fetching = false;
  // v23.10: Fetch from all connected Gmail accounts
  // v24.20: Proactive token refresh for Gmail (same pattern as Outlook) - prevents 401 round-trip
  var gmailAccts = getMailGmailAccounts();
  gmailAccts.forEach(function(acct) {
    if (acct.email && acct.token) {
      if (acct.expiresAt && Date.now() > (acct.expiresAt - 300000)) {
        mailRefreshGmailToken(function(newToken) {
          if (newToken) {
            acct.token = newToken;
            mailFetchGmailInbox(acct);
          } else {
            showToast('Gmail token expired for ' + acct.email + '. Please reconnect.', 'error');
          }
        }, acct.email);
      } else {
        mailFetchGmailInbox(acct);
      }
      fetching = true;
    }
  });
  // v23.10: Fetch from all connected Outlook accounts
  var outlookAccts = getMailOutlookAccounts();
  outlookAccts.forEach(function(acct) {
    if (acct.email && acct.token) {
      if (acct.expiresAt && Date.now() > (acct.expiresAt - 300000)) {
        mailRefreshOutlookTokenForAccount(acct, function(newToken) {
          if (newToken) mailFetchOutlookInbox(newToken, false, acct.email);
          else showToast('Outlook token expired for ' + acct.email + '. Please reconnect.', 'error');
        });
      } else {
        mailFetchOutlookInbox(acct.token, false, acct.email);
      }
      fetching = true;
    }
  });
  if (!fetching) {
    showToast('No email account connected', 'error');
  }
  mailRenderInboxFilters();
}

// v23.11: Auto-fetch inbox on interval (every 3 minutes when mail view active)
var _mailAutoFetchInterval = null;
function mailStartAutoFetch() {
  if (_mailAutoFetchInterval) return;
  _mailAutoFetchInterval = setInterval(function() {
    // Only auto-fetch if mail view is visible
    var mailView = document.getElementById('mailView');
    if (!mailView || mailView.classList.contains('hidden')) return;
    // Only fetch if inbox tab is active
    var inboxTab = document.querySelector('[data-mail-tab="inbox"].active');
    if (!inboxTab) return;
    mailRefreshInbox();
  }, 180000); // 3 minutes
}
function mailStopAutoFetch() {
  if (_mailAutoFetchInterval) { clearInterval(_mailAutoFetchInterval); _mailAutoFetchInterval = null; }
}

// v23.10: Gmail token refresh helper - supports per-account refresh
function mailRefreshGmailToken(callback, accountEmail) {
  var config = getMailConfig();
  var refreshToken = '';
  if (accountEmail && config.gmailAccounts) {
    for (var i = 0; i < config.gmailAccounts.length; i++) {
      if (config.gmailAccounts[i].email === accountEmail) {
        refreshToken = config.gmailAccounts[i].refreshToken || '';
        break;
      }
    }
  }
  if (!refreshToken) refreshToken = config.gmailRefreshToken || '';
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
  fetch('/api/gmail-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'refresh', refreshToken: refreshToken, uid: uid })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) {
      showToast('Gmail session expired for ' + (accountEmail || '') + '. Please reconnect.', 'error');
      callback(null);
      return;
    }
    // Update stored tokens in the account array
    if (accountEmail && config.gmailAccounts) {
      for (var j = 0; j < config.gmailAccounts.length; j++) {
        if (config.gmailAccounts[j].email === accountEmail) {
          config.gmailAccounts[j].token = data.accessToken;
          if (data.refreshToken) config.gmailAccounts[j].refreshToken = data.refreshToken;
          config.gmailAccounts[j].expiresAt = data.expiresAt || 0;
          break;
        }
      }
    }
    // Also update legacy fields if applicable
    if (!accountEmail || accountEmail === config.gmailEmail) {
      config.gmailToken = data.accessToken;
      if (data.refreshToken) config.gmailRefreshToken = data.refreshToken;
      config.gmailExpiresAt = data.expiresAt || 0;
    }
    saveMailConfig(config);
    callback(data.accessToken);
  }).catch(function() {
    showToast('Gmail refresh failed. Please reconnect.', 'error');
    callback(null);
  });
}

// v22.28: Outlook token refresh helper - returns fresh access token or null
function mailRefreshOutlookToken(callback) {
  var config = getMailConfig();
  var refreshToken = config.outlookRefreshToken || '';
  if (!refreshToken) {
    showToast('Outlook session expired. Please reconnect.', 'error');
    mailDisconnectProvider('outlook');
    callback(null);
    return;
  }
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
  fetch('/api/gmail-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'outlook_refresh', refreshToken: refreshToken, uid: uid })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) {
      showToast('Outlook session expired. Please reconnect.', 'error');
      mailDisconnectProvider('outlook');
      callback(null);
      return;
    }
    config.outlookToken = data.accessToken;
    if (data.refreshToken) config.outlookRefreshToken = data.refreshToken;
    config.outlookExpiresAt = data.expiresAt || 0;
    saveMailConfig(config);
    callback(data.accessToken);
  }).catch(function() {
    showToast('Outlook refresh failed. Please reconnect.', 'error');
    callback(null);
  });
}

// v23.10: Accepts account object { email, token, refreshToken, ... }
function mailFetchGmailInbox(acct, retried) {
  if (!acct) {
    // v24.20: Fallback - resolve first Gmail account if no acct passed
    var _fallbackAccts = getMailGmailAccounts();
    if (_fallbackAccts.length > 0) { acct = _fallbackAccts[0]; }
    else { showToast('No Gmail account connected', 'error'); return; }
  }
  var token = acct.token;
  var acctEmail = acct.email;
  if (!token) { showToast('Gmail not connected for ' + acctEmail, 'error'); return; }
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
  // v23.12: Show glowing fetch indicator instead of toast
  mailShowFetchIndicator(acct.displayName || acctEmail);
  fetch('/api/gmail-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'inbox', accessToken: token, uid: uid, maxResults: 20 })
  }).then(function(r) {
    if (r.status === 401 && !retried) {
      // Token expired - refresh and retry
      mailRefreshGmailToken(function(newToken) {
        if (newToken) {
          acct.token = newToken;
          mailFetchGmailInbox(acct, true);
        }
      }, acctEmail);
      return null;
    }
    return r.json();
  }).then(function(data) {
    if (!data) return;
    if (data.error) {
      showToast('Gmail error (' + acctEmail + '): ' + data.error, 'error');
      return;
    }
    var messages = data.messages || [];
    // v23.10: Store keyed by account email
    _mailCurrentMessages[acctEmail] = messages.map(function(msg) {
      return { id: msg.id, from: msg.from, subject: msg.subject, snippet: msg.snippet, date: msg.date, isUnread: msg.isUnread, provider: 'gmail', accountEmail: acctEmail, timestamp: msg.internalDate ? parseInt(msg.internalDate) : new Date(msg.date).getTime() };
    });
    mailRenderCombinedInbox();
    updateMailInboxBadge(); // v23.11
    mailHideFetchIndicator(); // v23.12
  }).catch(function(err) {
    mailHideFetchIndicator(); // v23.12
    showToast('Failed to fetch inbox for ' + acctEmail + ': ' + err.message, 'error');
  });
}

// v23.10: Added accountEmail param for multi-account token lookup
function mailOpenGmailMessage(msgId, retried, isUnread, accountEmail) {
  var creds = accountEmail ? getMailAccountCredentials(accountEmail) : null;
  var token = creds ? creds.token : getMailConfig().gmailToken;
  if (!token) return;
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
  fetch('/api/gmail-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'message', accessToken: token, messageId: msgId, uid: uid })
  }).then(function(r) {
    if (r.status === 401 && !retried) {
      mailRefreshGmailToken(function(newToken) {
        if (newToken) mailOpenGmailMessage(msgId, true, isUnread, accountEmail);
      }, accountEmail);
      return null;
    }
    return r.json();
  }).then(function(data) {
    if (!data) return;
    if (data.error) {
      showToast('Failed to open message: ' + data.error, 'error');
      return;
    }
    // v22.33: Use enriched detail header
    // v25.6: Convert Gmail date to local time for detail view
    mailSetDetailHeader(data.from || '', data.to || '', formatMailDate(data.date), data.subject);
    // Render body - use iframe sandbox for HTML emails, thread cards for plain text
    var bodyEl = document.getElementById('mailDetailBody');
    if (data.isHtml && data.body) {
      bodyEl.innerHTML = '<iframe id="mailIframe" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" style="width:100%;border:none;background:#fff;" srcdoc="' + escapeHtml(data.body) + '"></iframe>';
    } else {
      var _userEmail = (getMailConfig().gmailEmail || getMailConfig().outlookEmail || '').toLowerCase();
      var threadHtml = mailRenderThreadCards(data.body || '', _userEmail);
      if (threadHtml) {
        bodyEl.innerHTML = threadHtml;
      } else {
        bodyEl.innerHTML = '<div style="white-space:pre-wrap;font-family:inherit;line-height:1.7;">' + mailLinkifyText(data.body || '') + '</div>';
      }
    }
    // v22.24: Track open message for read/unread toggle
    _mailOpenMessage = { id: msgId, provider: 'gmail', isUnread: !!isUnread, accountEmail: accountEmail || '' };
    var toggleBtn = document.getElementById('mailDetailReadToggle');
    if (toggleBtn) toggleBtn.textContent = isUnread ? 'Mark as Read' : 'Mark as Unread';
    document.getElementById('mailInboxTab').classList.add('hidden');
    document.getElementById('mailDetailView').style.display = 'flex';
    mailAutoResizeIframe();
  }).catch(function(err) {
    showToast('Failed to open message: ' + err.message, 'error');
  });
}

// v23.10: Added accountEmail param for multi-account token lookup
function mailOpenOutlookMessage(msgId, retried, isUnread, accountEmail) {
  var creds = accountEmail ? getMailAccountCredentials(accountEmail) : null;
  var token = creds ? creds.token : getMailConfig().outlookToken;
  if (!token) return;
  fetch('https://graph.microsoft.com/v1.0/me/messages/' + msgId + '?$select=subject,from,toRecipients,receivedDateTime,body,isRead', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function(r) {
    // v22.28: Token expired - refresh and retry
    if (r.status === 401 && !retried) {
      mailRefreshOutlookTokenForAccount({ email: accountEmail }, function(newToken) {
        if (newToken) mailOpenOutlookMessage(msgId, true, isUnread, accountEmail);
      });
      return null;
    }
    return r.json();
  }).then(function(data) {
    if (!data) return;
    if (data.error) {
      showToast('Failed to open message: ' + (data.error.message || data.error), 'error');
      return;
    }
    // v22.33: Use enriched detail header
    var fromAddr = data.from && data.from.emailAddress ? data.from.emailAddress.address : '';
    var fromName = data.from && data.from.emailAddress && data.from.emailAddress.name ? data.from.emailAddress.name : '';
    var fromDisplay = fromName ? fromName + ' <' + fromAddr + '>' : fromAddr;
    var toAddrs = (data.toRecipients || []).map(function(r) { return r.emailAddress ? r.emailAddress.address : ''; }).join(', ');
    var dateStr = data.receivedDateTime ? new Date(data.receivedDateTime).toLocaleString() : '';
    mailSetDetailHeader(fromDisplay, toAddrs, dateStr, data.subject);
    var bodyEl = document.getElementById('mailDetailBody');
    if (data.body && data.body.contentType === 'html') {
      bodyEl.innerHTML = '<iframe id="mailIframe" sandbox="allow-same-origin" style="width:100%;border:none;background:#fff;" srcdoc="' + escapeHtml(data.body.content || '') + '"></iframe>';
    } else {
      var _plainContent = (data.body && data.body.content) || '';
      var _userEmail2 = (getMailConfig().gmailEmail || getMailConfig().outlookEmail || '').toLowerCase();
      var threadHtml2 = mailRenderThreadCards(_plainContent, _userEmail2);
      if (threadHtml2) {
        bodyEl.innerHTML = threadHtml2;
      } else {
        bodyEl.innerHTML = '<div style="white-space:pre-wrap;font-family:inherit;line-height:1.7;">' + mailLinkifyText(_plainContent) + '</div>';
      }
    }
    _mailOpenMessage = { id: msgId, provider: 'outlook', isUnread: !!isUnread, accountEmail: accountEmail || '' };
    var toggleBtn = document.getElementById('mailDetailReadToggle');
    if (toggleBtn) toggleBtn.textContent = isUnread ? 'Mark as Read' : 'Mark as Unread';
    document.getElementById('mailInboxTab').classList.add('hidden');
    document.getElementById('mailDetailView').style.display = 'flex';
    mailAutoResizeIframe();
  }).catch(function(err) {
    showToast('Failed to open message: ' + err.message, 'error');
  });
}

// v23.10: Added accountEmail param for multi-account support
function mailFetchOutlookInbox(token, retried, accountEmail) {
  var acctLabel = accountEmail || 'Outlook';
  // v23.12: Show glowing fetch indicator instead of toast
  mailShowFetchIndicator(acctLabel);
  fetch('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=20&$select=from,subject,receivedDateTime,isRead,bodyPreview', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function(r) {
    if (r.status === 401 && !retried) {
      mailRefreshOutlookTokenForAccount({ email: accountEmail, refreshToken: '' }, function(newToken) {
        if (newToken) mailFetchOutlookInbox(newToken, true, accountEmail);
      });
      return null;
    }
    return r.json();
  }).then(function(data) {
    if (!data) return;
    if (data.error) {
      var errMsg = data.error.message || data.error.code || '';
      if (!retried && (errMsg.indexOf('expired') !== -1 || errMsg.indexOf('Lifetime validation') !== -1 || errMsg.indexOf('InvalidAuthenticationToken') !== -1)) {
        mailRefreshOutlookTokenForAccount({ email: accountEmail, refreshToken: '' }, function(newToken) {
          if (newToken) mailFetchOutlookInbox(newToken, true, accountEmail);
        });
        return;
      }
      showToast('Outlook error (' + acctLabel + '): ' + (data.error.message || data.error), 'error');
      return;
    }
    if (!data.value || data.value.length === 0) {
      _mailCurrentMessages[accountEmail || 'outlook'] = [];
      mailRenderCombinedInbox();
      updateMailInboxBadge(); // v23.11
      mailHideFetchIndicator(); // v23.12
      return;
    }
    // v23.10: Store keyed by account email
    var storeKey = accountEmail || 'outlook';
    _mailCurrentMessages[storeKey] = data.value.map(function(msg) {
      var from = msg.from && msg.from.emailAddress ? msg.from.emailAddress.address : '';
      return { id: msg.id, from: from, subject: msg.subject || '(No subject)', snippet: msg.bodyPreview || '', date: new Date(msg.receivedDateTime).toLocaleString(), isUnread: !msg.isRead, provider: 'outlook', accountEmail: storeKey, timestamp: new Date(msg.receivedDateTime).getTime() };
    });
    mailRenderCombinedInbox();
    updateMailInboxBadge(); // v23.11
    mailHideFetchIndicator(); // v23.12
  }).catch(function(err) {
    mailHideFetchIndicator(); // v23.12
    showToast('Failed to fetch inbox for ' + acctLabel + ': ' + err.message, 'error');
  });
}

// v23.10: Per-account Outlook token refresh
function mailRefreshOutlookTokenForAccount(acct, callback) {
  var config = getMailConfig();
  var refreshToken = '';
  if (acct.email && config.outlookAccounts) {
    for (var i = 0; i < config.outlookAccounts.length; i++) {
      if (config.outlookAccounts[i].email === acct.email) {
        refreshToken = config.outlookAccounts[i].refreshToken || '';
        break;
      }
    }
  }
  if (!refreshToken) refreshToken = config.outlookRefreshToken || '';
  if (!refreshToken) {
    showToast('Outlook session expired for ' + (acct.email || '') + '. Please reconnect.', 'error');
    callback(null);
    return;
  }
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
  fetch('/api/gmail-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'outlook_refresh', refreshToken: refreshToken, uid: uid })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) {
      showToast('Outlook session expired for ' + (acct.email || '') + '. Please reconnect.', 'error');
      callback(null);
      return;
    }
    // Update in account array
    if (acct.email && config.outlookAccounts) {
      for (var j = 0; j < config.outlookAccounts.length; j++) {
        if (config.outlookAccounts[j].email === acct.email) {
          config.outlookAccounts[j].token = data.accessToken;
          if (data.refreshToken) config.outlookAccounts[j].refreshToken = data.refreshToken;
          config.outlookAccounts[j].expiresAt = data.expiresAt || 0;
          break;
        }
      }
    }
    // Also update legacy fields if applicable
    if (!acct.email || acct.email === config.outlookEmail) {
      config.outlookToken = data.accessToken;
      if (data.refreshToken) config.outlookRefreshToken = data.refreshToken;
      config.outlookExpiresAt = data.expiresAt || 0;
    }
    saveMailConfig(config);
    callback(data.accessToken);
  }).catch(function() {
    showToast('Outlook refresh failed. Please reconnect.', 'error');
    callback(null);
  });
}

// --- Mark Read/Unread ---
// v23.10: Updated to use per-account tokens
function mailToggleReadState() {
  var msg = _mailOpenMessage;
  if (!msg.id || !msg.provider) return;
  var markAsRead = msg.isUnread;
  var creds = msg.accountEmail ? getMailAccountCredentials(msg.accountEmail) : null;
  if (msg.provider === 'gmail') {
    var gmailToken = creds ? creds.token : getMailConfig().gmailToken;
    if (!gmailToken) return;
    var body = markAsRead ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] };
    fetch('https://www.googleapis.com/gmail/v1/users/me/messages/' + msg.id + '/modify', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + gmailToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) {
      if (r.ok) {
        msg.isUnread = !markAsRead;
        _mailOpenMessage.isUnread = msg.isUnread;
        var toggleBtn = document.getElementById('mailDetailReadToggle');
        if (toggleBtn) toggleBtn.textContent = msg.isUnread ? 'Mark as Read' : 'Mark as Unread';
        var acctMsgs = _mailCurrentMessages[msg.accountEmail || 'gmail'] || [];
        acctMsgs.forEach(function(m) { if (m.id === msg.id) m.isUnread = msg.isUnread; });
        updateMailInboxBadge(); // v23.11
        showToast(markAsRead ? 'Marked as read' : 'Marked as unread', 'info');
      } else {
        showToast('Failed to update read state', 'error');
      }
    }).catch(function() { showToast('Failed to update read state', 'error'); });
  } else if (msg.provider === 'outlook') {
    var outlookToken = creds ? creds.token : getMailConfig().outlookToken;
    if (!outlookToken) return;
    fetch('https://graph.microsoft.com/v1.0/me/messages/' + msg.id, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + outlookToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: markAsRead })
    }).then(function(r) {
      if (r.ok) {
        msg.isUnread = !markAsRead;
        _mailOpenMessage.isUnread = msg.isUnread;
        var toggleBtn = document.getElementById('mailDetailReadToggle');
        if (toggleBtn) toggleBtn.textContent = msg.isUnread ? 'Mark as Read' : 'Mark as Unread';
        var acctMsgs2 = _mailCurrentMessages[msg.accountEmail || 'outlook'] || [];
        acctMsgs2.forEach(function(m) { if (m.id === msg.id) m.isUnread = msg.isUnread; });
        updateMailInboxBadge(); // v23.11
        showToast(markAsRead ? 'Marked as read' : 'Marked as unread', 'info');
      } else {
        showToast('Failed to update read state', 'error');
      }
    }).catch(function() { showToast('Failed to update read state', 'error'); });
  }
}

// v23.11: Delete email from provider and remove from local list
function mailDeleteMessage() {
  var msg = _mailOpenMessage;
  if (!msg.id || !msg.provider) return;
  if (!confirm('Delete this email? This will move it to trash.')) return;
  var creds = msg.accountEmail ? getMailAccountCredentials(msg.accountEmail) : null;
  if (msg.provider === 'gmail') {
    var gmailToken = creds ? creds.token : getMailConfig().gmailToken;
    if (!gmailToken) { showToast('No Gmail token', 'error'); return; }
    fetch('https://www.googleapis.com/gmail/v1/users/me/messages/' + msg.id + '/trash', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + gmailToken }
    }).then(function(r) {
      if (r.ok) {
        mailRemoveFromLocal(msg.id, msg.accountEmail || 'gmail');
        showToast('Email moved to trash', 'info');
      } else { showToast('Failed to delete email', 'error'); }
    }).catch(function() { showToast('Failed to delete email', 'error'); });
  } else if (msg.provider === 'outlook') {
    var outlookToken = creds ? creds.token : getMailConfig().outlookToken;
    if (!outlookToken) { showToast('No Outlook token', 'error'); return; }
    // Outlook: move to deletedItems folder
    fetch('https://graph.microsoft.com/v1.0/me/messages/' + msg.id + '/move', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + outlookToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId: 'deleteditems' })
    }).then(function(r) {
      if (r.ok) {
        mailRemoveFromLocal(msg.id, msg.accountEmail || 'outlook');
        showToast('Email moved to trash', 'info');
      } else { showToast('Failed to delete email', 'error'); }
    }).catch(function() { showToast('Failed to delete email', 'error'); });
  }
}

function mailRemoveFromLocal(msgId, acctKey) {
  var msgs = _mailCurrentMessages[acctKey] || [];
  _mailCurrentMessages[acctKey] = msgs.filter(function(m) { return m.id !== msgId; });
  // v24.27: Close detail view and switch back to inbox tab
  var detail = document.getElementById('mailDetailView');
  if (detail) { detail.classList.remove('active'); detail.style.display = 'none'; }
  if (typeof switchMailTab === 'function') switchMailTab('inbox');
  updateMailInboxBadge();
}

// --- Reply/Forward stubs ---
function mailReplyTo() {
  var from = document.getElementById('mailDetailFrom').textContent;
  var subject = document.getElementById('mailDetailSubject').textContent;
  switchMailTab('compose');
  setTimeout(function() {
    document.getElementById('mailComposeTo').value = from;
    document.getElementById('mailComposeSubject').value = 'Re: ' + subject;
    document.getElementById('mailComposeBody').focus();
  }, 50);
}
function mailForward() {
  var subject = document.getElementById('mailDetailSubject').textContent;
  var body = document.getElementById('mailDetailBody').innerText || '';
  switchMailTab('compose');
  setTimeout(function() {
    document.getElementById('mailComposeSubject').value = 'Fwd: ' + subject;
    var canvas = document.getElementById('mailComposeBody');
    if (canvas) canvas.innerHTML = '<br><br><hr><p style="color:#888;font-size:13px;">--- Forwarded Message ---</p><p>' + escapeHtml(body).replace(/\n/g, '<br>') + '</p>';
    document.getElementById('mailComposeTo').focus();
    mailUpdateCanvasCounts();
  }, 50);
}

// ═══════════════════════════════════════════════════════════════
// v22.24: Rich Email Canvas - Commands, Voice Tools, AI Compose
// ═══════════════════════════════════════════════════════════════

// v23.2: Email compose loading overlay
var _mailLoadingTimer = null;
var _mailSlowTimer = null;
function mailShowComposeLoading(show) {
  var el = document.getElementById('mailComposeLoading');
  var textEl = document.getElementById('mailComposeLoadingText');
  var aiBtn = document.querySelector('.toolbar-ai-btn');
  if (!el) return;
  if (show) {
    if (textEl) textEl.textContent = 'Generating...';
    el.style.display = 'flex';
    // Disable AI buttons during generation
    var btns = document.querySelectorAll('.toolbar-ai-btn');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
    // Show slow message after 15s
    clearTimeout(_mailSlowTimer);
    _mailSlowTimer = setTimeout(function() {
      if (textEl && el.style.display !== 'none') textEl.textContent = 'Still crafting your email...';
    }, 15000);
  } else {
    el.style.display = 'none';
    clearTimeout(_mailSlowTimer);
    var btns = document.querySelectorAll('.toolbar-ai-btn');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = false;
  }
}

// v23.2: Title case utility
function toTitleCase(str) {
  if (!str) return '';
  var small = ['a','an','the','and','but','or','nor','for','yet','so','in','on','at','to','for','with','from','by','of','up','as','is'];
  var words = str.split(/\s+/);
  return words.map(function(word, idx) {
    if (!word) return word;
    // v25.3: Preserve words with intentional mixed case (e.g. RoweOS, iPhone, AI)
    var hasInternalCaps = /[a-z][A-Z]|[A-Z]{2,}/.test(word);
    if (hasInternalCaps) return word;
    var lower = word.toLowerCase();
    // Always capitalize first and last word
    if (idx === 0 || idx === words.length - 1) return lower.charAt(0).toUpperCase() + lower.slice(1);
    // Don't capitalize small words
    if (small.indexOf(lower) !== -1) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

// v23.2: Auto-capitalize subject line
function mailAutoCapitalizeSubject() {
  var autoCapEnabled = localStorage.getItem('roweos_mail_autocap_subject') !== 'false';
  if (!autoCapEnabled) return;
  var subjectEl = document.getElementById('mailComposeSubject');
  if (subjectEl && subjectEl.value.trim()) {
    subjectEl.value = toTitleCase(subjectEl.value.trim());
  }
}

// ═══════════════════════════════════════════════════════════════
// v23.2: Sprint 3 - Email System Expansion
// ═══════════════════════════════════════════════════════════════

// --- 3.2: Address Book ---
function getMailAddressBook() {
  try { return JSON.parse(localStorage.getItem('roweos_mail_address_book') || '[]'); } catch(e) { return []; }
}
function saveMailAddressBook(contacts) {
  localStorage.setItem('roweos_mail_address_book', JSON.stringify(contacts));
  writeDB('profile/mail', { addressBook: contacts }); // v25.1
}

function mailGetAllContacts() {
  // Merge: address book + clients + sent history (deduplicated by email)
  var seen = {};
  var results = [];
  // v24.8: Add user's own contact info as "Me" entries at top
  var _uc = typeof getUserContact === 'function' ? getUserContact() : {};
  if (_uc.email) {
    var _ucKey = _uc.email.toLowerCase();
    seen[_ucKey] = true;
    results.push({ name: (_uc.name || 'Me') + ' (Personal)', email: _uc.email, source: 'Me', company: _uc.company || '', lastContacted: '', category: 'owner' });
  }
  if (_uc.workEmail) {
    var _ucWKey = _uc.workEmail.toLowerCase();
    if (!seen[_ucWKey]) {
      seen[_ucWKey] = true;
      results.push({ name: (_uc.name || 'Me') + ' (Work)', email: _uc.workEmail, source: 'Me', company: _uc.company || '', lastContacted: '', category: 'owner' });
    }
  }
  // v23.10: Hidden recents list
  var hiddenRecents = [];
  try { hiddenRecents = JSON.parse(localStorage.getItem('roweos_mail_hidden_recents') || '[]'); } catch(e) {}
  // 1. Address book (manual entries)
  var book = getMailAddressBook();
  book.forEach(function(c) {
    if (!c.email) return;
    var key = c.email.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    results.push({ name: c.name || '', email: c.email, source: 'Address Book', company: c.company || '', lastContacted: c.lastContacted || '', category: c.category || '' });
  });
  // 2. v25.3: All people (clients, team, reports) instead of just clients
  try {
    var people = getPeople();
    var _typeLabels = { client: 'Client', team: 'Team', report: 'Report' };
    people.forEach(function(c) {
      if (!c.email) return;
      var key = c.email.toLowerCase();
      if (seen[key]) { return; }
      seen[key] = true;
      var srcLabel = _typeLabels[c.personType] || 'Client';
      results.push({ name: c.name || '', email: c.email, source: srcLabel, company: c.company || '', lastContacted: '', category: c.stage || '', personType: c.personType || 'client' });
    });
  } catch(e) {}
  // 3. Sent history (filtered by hidden recents)
  try {
    var sent = getMailSent();
    sent.forEach(function(s) {
      if (!s.to) return;
      var key = s.to.toLowerCase();
      if (seen[key]) return;
      if (hiddenRecents.indexOf(key) !== -1) return; // v23.10: Skip hidden recents
      seen[key] = true;
      var dateStr = s.sentAt ? new Date(s.sentAt).toLocaleDateString() : '';
      results.push({ name: '', email: s.to, source: 'Previous', company: '', lastContacted: dateStr, category: '' });
    });
  } catch(e) {}
  return results;
}

// --- 3.1: Contact Suggestions / Autocomplete ---
var _mailSuggestionTarget = null;
function mailShowContactSuggestions(input, field) {
  var containerId = 'mailSuggestions' + field.charAt(0).toUpperCase() + field.slice(1);
  var container = document.getElementById(containerId);
  if (!container) return;
  var val = input.value.trim();
  // For CC/BCC, only search after the last comma
  var searchVal = val;
  if (field === 'cc' || field === 'bcc') {
    var parts = val.split(',');
    searchVal = parts[parts.length - 1].trim();
  }
  if (searchVal.length < 1) { container.classList.remove('visible'); container.innerHTML = ''; return; }
  var contacts = mailGetAllContacts();
  var term = searchVal.toLowerCase();
  var matches = contacts.filter(function(c) {
    return (c.name && c.name.toLowerCase().indexOf(term) !== -1) ||
           (c.email && c.email.toLowerCase().indexOf(term) !== -1) ||
           (c.company && c.company.toLowerCase().indexOf(term) !== -1);
  }).slice(0, 8);
  if (matches.length === 0) { container.classList.remove('visible'); container.innerHTML = ''; return; }
  var html = '';
  matches.forEach(function(c) {
    html += '<div class="mail-contact-suggestion" onclick="mailSelectSuggestion(\'' + escapeHtml(c.email) + '\', \'' + field + '\')">';
    html += '<div><div class="suggestion-name">' + escapeHtml(c.name || c.email.split('@')[0]) + '</div>';
    html += '<div class="suggestion-email">' + escapeHtml(c.email) + (c.company ? ' - ' + escapeHtml(c.company) : '') + '</div></div>';
    html += '<span class="suggestion-source">' + c.source + '</span>';
    html += '</div>';
  });
  container.innerHTML = html;
  container.classList.add('visible');
}

function mailSelectSuggestion(email, field) {
  var inputId = field === 'to' ? 'mailComposeTo' : (field === 'cc' ? 'mailComposeCc' : 'mailComposeBcc');
  var input = document.getElementById(inputId);
  if (!input) return;
  if (field === 'cc' || field === 'bcc') {
    var parts = input.value.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
    parts.pop(); // Remove the partial search term
    parts.push(email);
    input.value = parts.join(', ') + ', ';
  } else {
    input.value = email;
  }
  var containerId = 'mailSuggestions' + field.charAt(0).toUpperCase() + field.slice(1);
  var container = document.getElementById(containerId);
  if (container) { container.classList.remove('visible'); container.innerHTML = ''; }
  input.focus();
}

// Hide suggestions when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.mail-compose-field')) {
    var allSugs = document.querySelectorAll('.mail-contact-suggestions');
    for (var i = 0; i < allSugs.length; i++) { allSugs[i].classList.remove('visible'); allSugs[i].innerHTML = ''; }
  }
});

// --- Address Book UI ---
var _mailAddressBookField = null;
function mailOpenAddressBook(field) {
  _mailAddressBookField = field || null;
  var overlay = document.getElementById('mailAddressBookOverlay');
  if (overlay) {
    // v25.0: Move overlay to body so it works from any view (Automations, Mail, etc.)
    if (overlay.parentNode !== document.body) {
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  }
  mailRenderAddressBook();
}

function mailCloseAddressBook() {
  var overlay = document.getElementById('mailAddressBookOverlay');
  if (overlay) overlay.style.display = 'none';
}

function mailRenderAddressBook() {
  var body = document.getElementById('mailAddressBookBody');
  if (!body) return;
  var contacts = mailGetAllContacts();
  var searchTerm = (document.getElementById('mailAddressBookSearch') || {}).value || '';
  if (searchTerm) {
    var term = searchTerm.toLowerCase();
    contacts = contacts.filter(function(c) {
      return (c.name && c.name.toLowerCase().indexOf(term) !== -1) ||
             (c.email && c.email.toLowerCase().indexOf(term) !== -1) ||
             (c.company && c.company.toLowerCase().indexOf(term) !== -1);
    });
  }
  if (contacts.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px;">No contacts found</div>';
    return;
  }
  var html = '';
  contacts.forEach(function(c) {
    var initials = (c.name || c.email.split('@')[0]).split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    html += '<div class="mail-addressbook-contact" onclick="mailAddressBookSelect(\'' + escapeHtml(c.email) + '\')">';
    html += '<div class="contact-avatar">' + initials + '</div>';
    html += '<div class="contact-info"><div class="contact-name">' + escapeHtml(c.name || c.email) + '</div>';
    html += '<div class="contact-email">' + escapeHtml(c.email) + (c.company ? ' - ' + escapeHtml(c.company) : '') + '</div></div>';
    html += '<span class="contact-source">' + c.source + '</span>';
    if (c.lastContacted) html += '<span class="contact-last">' + c.lastContacted + '</span>';
    // v23.4: Edit, Sync, Delete buttons for address book entries
    if (c.source === 'Address Book') {
      html += '<button class="contact-edit-btn" onclick="event.stopPropagation(); mailEditContact(\'' + escapeHtml(c.email) + '\')" title="Edit"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
      html += '<button class="contact-sync-btn" onclick="event.stopPropagation(); mailSyncContactToClient(\'' + escapeHtml(c.email) + '\')" title="Sync to Clients">Sync</button>';
      html += '<button onclick="event.stopPropagation(); mailRemoveContact(\'' + escapeHtml(c.email) + '\')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;padding:4px;" title="Remove"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
    }
    // v25.3: Sync to address book for people entries (client, team, report)
    if (c.source === 'Client' || c.source === 'Team' || c.source === 'Report') {
      html += '<button class="contact-sync-btn" onclick="event.stopPropagation(); mailSyncClientToAddressBook(mailFindClientIdByEmail(\'' + escapeHtml(c.email) + '\'))" title="Sync to Address Book">Sync</button>';
    }
    html += '</div>';
  });
  body.innerHTML = html;
}

function mailFilterAddressBook() { mailRenderAddressBook(); }

function mailAddressBookSelect(email) {
  if (!_mailAddressBookField) return;
  var f = _mailAddressBookField;
  var inputId, isMulti = false;
  // v24.2: Support pipeline email fields from Automations Lab
  if (f.indexOf('pipelineTo_') === 0) {
    inputId = 'pipelineStepEmailTo_' + f.replace('pipelineTo_', '');
  } else if (f.indexOf('pipelineCc_') === 0) {
    inputId = 'pipelineStepEmailCc_' + f.replace('pipelineCc_', '');
    isMulti = true;
  } else if (f.indexOf('pipelineBcc_') === 0) {
    inputId = 'pipelineStepEmailBcc_' + f.replace('pipelineBcc_', '');
    isMulti = true;
  } else {
    inputId = f === 'to' ? 'mailComposeTo' : (f === 'cc' ? 'mailComposeCc' : 'mailComposeBcc');
    isMulti = (f === 'cc' || f === 'bcc');
  }
  var input = document.getElementById(inputId);
  if (input) {
    if (isMulti) {
      var existing = input.value.trim();
      input.value = existing ? existing + ', ' + email : email;
    } else {
      input.value = email;
    }
  }
  mailCloseAddressBook();
}

function mailAddContact() {
  var nameEl = document.getElementById('mailAddressBookNewName');
  var emailEl = document.getElementById('mailAddressBookNewEmail');
  var name = nameEl ? nameEl.value.trim() : '';
  var email = emailEl ? emailEl.value.trim() : '';
  if (!email || email.indexOf('@') === -1) { showToast('Valid email required', 'error'); return; }
  var book = getMailAddressBook();
  // Check duplicate
  var exists = book.some(function(c) { return c.email.toLowerCase() === email.toLowerCase(); });
  if (exists) { showToast('Contact already exists', 'warning'); return; }
  book.push({ name: name, email: email, company: '', createdAt: new Date().toISOString() });
  saveMailAddressBook(book);
  if (nameEl) nameEl.value = '';
  if (emailEl) emailEl.value = '';
  mailRenderAddressBook();
  showToast('Contact added', 'success');
}

function mailRemoveContact(email) {
  var book = getMailAddressBook().filter(function(c) { return c.email.toLowerCase() !== email.toLowerCase(); });
  saveMailAddressBook(book);
  mailRenderAddressBook();
}

// v23.10: Remove a "Previous" (recent/sent) contact by hiding it from the merged list
function mailRemoveRecent(email) {
  if (!email) return;
  var hidden = [];
  try { hidden = JSON.parse(localStorage.getItem('roweos_mail_hidden_recents') || '[]'); } catch(e) {}
  if (hidden.indexOf(email.toLowerCase()) === -1) {
    hidden.push(email.toLowerCase());
  }
  localStorage.setItem('roweos_mail_hidden_recents', JSON.stringify(hidden));
  showToast('Removed from recents', 'success');
}

// v23.4: Find client ID by email for address book sync
function mailFindClientIdByEmail(email) {
  if (!email) return '';
  var clients = getClients();
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].email && clients[i].email.toLowerCase() === email.toLowerCase()) return clients[i].id;
  }
  return '';
}

function mailPopulateAddressBookFromClients() {
  var clients = getClients();
  var book = getMailAddressBook();
  var existing = {};
  book.forEach(function(c) { existing[c.email.toLowerCase()] = true; });
  var added = 0;
  clients.forEach(function(c) {
    if (c.email && !existing[c.email.toLowerCase()]) {
      book.push({ name: c.name || '', email: c.email, company: c.company || '', createdAt: new Date().toISOString() });
      existing[c.email.toLowerCase()] = true;
      added++;
    }
  });
  if (added > 0) {
    saveMailAddressBook(book);
    showToast('Added ' + added + ' contact' + (added > 1 ? 's' : '') + ' from clients', 'success');
  } else {
    showToast('No new contacts to add', 'info');
  }
}

function mailPopulateAddressBookFromSent() {
  var sent = getMailSent();
  var book = getMailAddressBook();
  var existing = {};
  book.forEach(function(c) { existing[c.email.toLowerCase()] = true; });
  var added = 0;
  sent.forEach(function(s) {
    if (s.to && !existing[s.to.toLowerCase()]) {
      book.push({ name: '', email: s.to, company: '', createdAt: new Date().toISOString(), lastContacted: s.sentAt ? new Date(s.sentAt).toISOString() : '' });
      existing[s.to.toLowerCase()] = true;
      added++;
    }
  });
  if (added > 0) {
    saveMailAddressBook(book);
    showToast('Imported ' + added + ' recipient' + (added > 1 ? 's' : '') + ' from sent emails', 'success');
  } else {
    showToast('No new recipients to import', 'info');
  }
}

// --- 3.3: Final Preview ---
function mailShowFinalPreview() {
  var to = (document.getElementById('mailComposeTo').value || '').trim();
  var subject = (document.getElementById('mailComposeSubject').value || '').trim();
  var body = mailGetCanvasText().trim();
  var from = (document.getElementById('mailComposeFrom').value || '').trim();
  if (!body) { showToast('Write email content first', 'warning'); return; }
  // Auto-capitalize before preview
  mailAutoCapitalizeSubject();
  subject = (document.getElementById('mailComposeSubject').value || '').trim();
  // Build metadata bar
  var metaEl = document.getElementById('mailPreviewMeta');
  if (metaEl) {
    var metaHtml = '';
    if (from) metaHtml += '<div><strong>From:</strong> ' + escapeHtml(from.indexOf(':') !== -1 ? from.split(':')[1] : from) + '</div>';
    if (to) metaHtml += '<div><strong>To:</strong> ' + escapeHtml(to) + '</div>';
    var cc = (document.getElementById('mailComposeCc').value || '').trim();
    var bcc = (document.getElementById('mailComposeBcc').value || '').trim();
    if (cc) metaHtml += '<div><strong>CC:</strong> ' + escapeHtml(cc) + '</div>';
    if (bcc) metaHtml += '<div><strong>BCC:</strong> ' + escapeHtml(bcc) + '</div>';
    metaHtml += '<div><strong>Subject:</strong> ' + escapeHtml(subject || '(No subject)') + '</div>';
    // Show attachments count
    var atts = window._mailAttachments || [];
    if (atts.length > 0) metaHtml += '<div><strong>Attachments:</strong> ' + atts.length + ' file' + (atts.length > 1 ? 's' : '') + '</div>';
    metaEl.innerHTML = metaHtml;
  }
  // Render preview
  var template = document.getElementById('mailComposeTemplate').value || 'professional';
  var logoPos = (document.getElementById('mailComposeLogoPos') || {}).value || 'center';
  var canvasHtml = mailGetCanvasContent();
  var previewHtml = mailGetPreviewHtml();
  var finalHtml = previewHtml || mailRenderBody(body, template, canvasHtml, false, logoPos);
  var frame = document.getElementById('mailPreviewFrame');
  if (frame) {
    var doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(finalHtml);
    doc.close();
    setTimeout(function() {
      try {
        var h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
        if (h > 100) frame.style.height = Math.max(h + 20, 300) + 'px';
      } catch(e) {}
    }, 150);
  }
  // Reset edit mode
  var editToggle = document.getElementById('mailPreviewEditMode');
  if (editToggle) editToggle.checked = false;
  var overlay = document.getElementById('mailPreviewOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function mailClosePreview() {
  var overlay = document.getElementById('mailPreviewOverlay');
  if (overlay) overlay.style.display = 'none';
  // Sync any edits back to canvas
  try {
    var frame = document.getElementById('mailPreviewFrame');
    if (frame) {
      var doc = frame.contentDocument || frame.contentWindow.document;
      if (doc.designMode === 'on') {
        mailSyncPreviewToCanvas(doc);
      }
    }
  } catch(e) {}
}

// --- 3.4: Rich Text in Preview ---
function mailTogglePreviewEdit(enabled) {
  try {
    var frame = document.getElementById('mailPreviewFrame');
    if (!frame) return;
    var doc = frame.contentDocument || frame.contentWindow.document;
    doc.designMode = enabled ? 'on' : 'off';
    if (enabled) {
      // Listen for text selection to show floating toolbar
      doc.addEventListener('mouseup', mailPreviewShowToolbar);
      doc.addEventListener('keyup', mailPreviewShowToolbar);
    }
  } catch(e) {}
}

function mailPreviewExec(cmd) {
  try {
    var frame = document.getElementById('mailPreviewFrame');
    if (!frame) return;
    var doc = frame.contentDocument || frame.contentWindow.document;
    doc.execCommand(cmd, false, null);
  } catch(e) {}
}

function mailPreviewShowToolbar() {
  try {
    var frame = document.getElementById('mailPreviewFrame');
    if (!frame) return;
    var doc = frame.contentDocument || frame.contentWindow.document;
    var sel = doc.getSelection();
    var toolbar = document.getElementById('mailPreviewFloatToolbar');
    if (!toolbar) return;
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      toolbar.style.display = 'none';
      return;
    }
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    var frameRect = frame.getBoundingClientRect();
    toolbar.style.display = 'flex';
    toolbar.style.left = (frameRect.left + rect.left + rect.width / 2 - 60) + 'px';
    toolbar.style.top = (frameRect.top + rect.top - 40) + 'px';
  } catch(e) {}
}

// --- 3.5: Logo Size Controls ---
function mailGetLogoSize() {
  var sel = document.getElementById('mailComposeLogoSize');
  return sel ? sel.value : 'medium';
}

function mailGetLogoSizePx() {
  var size = mailGetLogoSize();
  if (size === 'small') return 80;
  if (size === 'large') return 250;
  return 150; // medium default
}

// --- 3.6: Font Family ---
var MAIL_FONT_STACKS = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  verdana: "Verdana, Geneva, sans-serif",
  palatino: "'Palatino Linotype', Palatino, 'Book Antiqua', serif",
  brand: '' // resolved dynamically
};

function mailGetFontStack() {
  var sel = document.getElementById('mailComposeFont');
  var val = sel ? sel.value : 'system';
  if (val === 'brand') {
    // Pull from brand identity
    try {
      var idx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
      var brand = brands[idx];
      if (brand && brand.identity && brand.identity.fonts) return brand.identity.fonts;
      if (brand && brand.font) return brand.font + ', sans-serif';
    } catch(e) {}
    return MAIL_FONT_STACKS.system;
  }
  return MAIL_FONT_STACKS[val] || MAIL_FONT_STACKS.system;
}

// --- 3.7: Formatting Tier ---
function mailSaveFormatTier() {
  var sel = document.getElementById('mailComposeFormatTier');
  if (sel) localStorage.setItem('roweos_mail_format_tier', sel.value);
}

function mailGetFormatTier() {
  var sel = document.getElementById('mailComposeFormatTier');
  return sel ? sel.value : (localStorage.getItem('roweos_mail_format_tier') || 'moderate');
}

function mailGetFormatTierPrompt() {
  var tier = mailGetFormatTier();
  if (tier === 'minimal') {
    return '\n\nFORMATTING LEVEL: MINIMAL - Use plain text style. No headers, no bullets, no bold. Simple paragraphs only. Clean and unformatted like a personal email.';
  }
  if (tier === 'max') {
    return '\n\nFORMATTING LEVEL: MAXIMUM - Use rich formatting: section headers, bold for emphasis, bullet points, numbered lists, dividers, and clear visual structure. Make it comprehensive and well-organized.';
  }
  return '\n\nFORMATTING LEVEL: MODERATE - Use professional formatting: occasional bold for emphasis, short bullet lists where appropriate, clear paragraph breaks. Not too plain, not too heavy.';
}

// --- 3.8: Inform to Client Identity ---
var _mailPendingClientIdentity = null;
function mailInformClientIdentityCheck() {
  var toggle = document.getElementById('mailInformClientIdentity');
  return toggle ? toggle.checked : false;
}

function mailExtractClientIdentity(to, subject, body) {
  if (!to) return;
  // v25.3: Search all person types (clients, team, reports) not just clients
  var allPeople = getPeople();
  var client = null;
  var toLower = to.toLowerCase();
  for (var i = 0; i < allPeople.length; i++) {
    if (allPeople[i].email && allPeople[i].email.toLowerCase() === toLower) {
      client = allPeople[i];
      break;
    }
    // Also check secondary emails
    if (allPeople[i].secondaryEmails) {
      for (var se = 0; se < allPeople[i].secondaryEmails.length; se++) {
        if (allPeople[i].secondaryEmails[se] && allPeople[i].secondaryEmails[se].toLowerCase() === toLower) {
          client = allPeople[i];
          break;
        }
      }
      if (client) break;
    }
  }
  if (!client) {
    // v25.3: Auto-create client when "Inform to Client Identity" is checked
    var namePart = to.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    var companyPart = '';
    var domain = to.split('@')[1];
    if (domain && ['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','protonmail.com','me.com'].indexOf(domain) === -1) {
      companyPart = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    }
    var now = new Date().toISOString();
    client = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      brandIndex: typeof selectedBrand !== 'undefined' ? selectedBrand : 0,
      name: namePart,
      email: to,
      company: companyPart,
      phone: '', website: '', industry: '', role: '', location: '', notes: '',
      logo: '',
      stage: 'lead',
      stageHistory: [{ stage: 'lead', date: now }],
      category: 'lead',
      priority: 'low',
      scope: 'brand',
      secondaryEmails: [],
      customFields: [],
      relationshipStatus: 'prospecting',
      relationshipStatusHistory: [],
      dialogueHistory: [],
      timeline: [{ id: Date.now().toString(36), date: now, category: 'key_date', title: 'Client created from email', description: 'Auto-added via Inform to Client Identity when sending: ' + (subject || '').substring(0, 100), source: 'email_inform', createdAt: now }],
      createdAt: now,
      lastContacted: now
    };
    clients.push(client);
    saveClients(clients);
    showToast('Client added: ' + namePart, 'success');
    if (typeof renderClientsView === 'function') renderClientsView();
  }
  // Use AI to extract key points
  var sys = 'You are a CRM assistant. Extract key dialogue points from the following email that should be saved to the client profile. Identify: decisions made, action items, deadlines, sentiment/relationship status, and any new information learned about the client. Format as a concise bulleted list. Be brief - only include genuinely useful information for future reference. Do NOT use em-dashes.';
  var user = 'Email to: ' + to + '\nSubject: ' + subject + '\n\nBody:\n' + body;
  mailCallAI(sys, user, function(result) {
    if (!result) return;
    _mailPendingClientIdentity = { clientId: client.id, clientName: client.name, notes: result, to: to };
    var contentEl = document.getElementById('mailClientIdentityContent');
    if (contentEl) contentEl.textContent = result;
    var overlay = document.getElementById('mailClientIdentityOverlay');
    if (overlay) overlay.style.display = 'flex';
  });
}

function mailCloseClientIdentity() {
  var overlay = document.getElementById('mailClientIdentityOverlay');
  if (overlay) overlay.style.display = 'none';
  _mailPendingClientIdentity = null;
}

function mailConfirmClientIdentity() {
  if (!_mailPendingClientIdentity) return;
  var clients = getClients();
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === _mailPendingClientIdentity.clientId) {
      // v23.3: Write to dialogueHistory instead of just notes
      if (!clients[i].dialogueHistory) clients[i].dialogueHistory = [];
      clients[i].dialogueHistory.unshift({
        id: Date.now().toString(36),
        timestamp: new Date().toISOString(),
        source: 'Email',
        summary: _mailPendingClientIdentity.notes || '',
        fullText: _mailPendingClientIdentity.notes || ''
      });
      if (clients[i].dialogueHistory.length > 50) clients[i].dialogueHistory = clients[i].dialogueHistory.slice(0, 50);
      // Also add timeline entry
      if (!clients[i].timeline) clients[i].timeline = [];
      clients[i].timeline.push({
        id: Date.now().toString(36) + 'e',
        date: new Date().toISOString(),
        category: 'event',
        title: 'Email exchange logged',
        description: (_mailPendingClientIdentity.notes || '').substring(0, 200),
        source: 'email_inform',
        createdAt: new Date().toISOString()
      });
      // Update last contacted
      clients[i].lastContacted = new Date().toISOString();
      break;
    }
  }
  saveClients(clients);
  showToast('Client profile updated for ' + _mailPendingClientIdentity.clientName, 'success');
  mailCloseClientIdentity();
}

// --- Initialize Sprint 3 compose preferences ---
function mailInitSprint3Prefs() {
  // Format tier
  var tierSel = document.getElementById('mailComposeFormatTier');
  var defaultTierSel = document.getElementById('mailDefaultFormatTier');
  var savedTier = localStorage.getItem('roweos_mail_format_tier') || 'moderate';
  if (tierSel) tierSel.value = savedTier;
  if (defaultTierSel) defaultTierSel.value = savedTier;
  // v23.13: Default mailbox tab
  var defTabSel = document.getElementById('mailDefaultTabSelect');
  if (defTabSel) defTabSel.value = localStorage.getItem('roweos_mail_default_tab') || 'outbox';
  // Inform client toggle default
  var informToggle = document.getElementById('mailInformClientIdentity');
  if (informToggle) informToggle.checked = localStorage.getItem('roweos_mail_inform_client') === 'true';
  var informSettingsToggle = document.getElementById('mailInformClientToggle');
  if (informSettingsToggle) informSettingsToggle.checked = localStorage.getItem('roweos_mail_inform_client') === 'true';
  // Show/hide hint
  if (informToggle) {
    informToggle.onchange = function() {
      var hint = document.getElementById('mailInformClientHint');
      if (hint) hint.style.display = this.checked ? '' : 'none';
    };
  }
}

// --- Canvas text commands ---
function mailExecCmd(cmd, val) {
  var canvas = document.getElementById('mailComposeBody');
  if (!canvas) return;
  canvas.focus();
  if (cmd === 'formatBlock' && val) {
    document.execCommand('formatBlock', false, '<' + val + '>');
  } else {
    document.execCommand(cmd, false, val || null);
  }
  mailUpdateCanvasCounts();
}

function mailInsertLink() {
  var url = prompt('Enter URL:');
  if (url) {
    // v22.33: Auto-add protocol if missing
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    document.getElementById('mailComposeBody').focus();
    document.execCommand('createLink', false, url);
  }
}

// v22.33: Font size command for mail compose
function mailSetFontSize(size) {
  if (!size) return;
  var canvas = document.getElementById('mailComposeBody');
  if (!canvas) return;
  canvas.focus();
  document.execCommand('fontSize', false, size);
  mailUpdateCanvasCounts();
}

// v22.33: Auto-linkify URLs in plain text for mail detail view
function mailLinkifyText(text) {
  var escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/gi, '<a href="$1" target="_blank" rel="noopener" style="color:var(--brand-accent, #a89878);text-decoration:underline;">$1</a>')
    .replace(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1" style="color:var(--brand-accent, #a89878);text-decoration:underline;">$1</a>');
}

// v22.33: Extract sender display name and initial from email address
function mailParseSender(fromStr) {
  var name = '';
  var email = fromStr || '';
  // "Name <email>" format
  var match = fromStr ? fromStr.match(/^(.+?)\s*<(.+?)>/) : null;
  if (match) {
    name = match[1].replace(/"/g, '').trim();
    email = match[2].trim();
  } else if (fromStr && fromStr.indexOf('@') !== -1) {
    email = fromStr.trim();
    name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }
  var initial = name ? name.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : '?');
  return { name: name, email: email, initial: initial };
}

// v22.33: Populate enriched detail header
function mailSetDetailHeader(fromStr, toStr, dateStr, subject) {
  var parsed = mailParseSender(fromStr);
  var subjectEl = document.getElementById('mailDetailSubject');
  var avatarEl = document.getElementById('mailDetailAvatar');
  var senderNameEl = document.getElementById('mailDetailSenderName');
  var fromEl = document.getElementById('mailDetailFrom');
  var toEl = document.getElementById('mailDetailTo');
  var dateEl = document.getElementById('mailDetailDate');
  if (subjectEl) subjectEl.textContent = subject || '(No subject)';
  if (avatarEl) avatarEl.textContent = parsed.initial;
  if (senderNameEl) senderNameEl.textContent = parsed.name || parsed.email;
  if (fromEl) fromEl.textContent = parsed.email;
  // v24.9: Make TO email clickable to add to address book / clients
  if (toEl) {
    var _toEmail = (toStr || '').trim();
    if (_toEmail) {
      var _inBook = false;
      try {
        var _ab = typeof getMailAddressBook === 'function' ? getMailAddressBook() : [];
        _inBook = _ab.some(function(c) { return c.email && c.email.toLowerCase() === _toEmail.toLowerCase(); });
      } catch(e) {}
      if (_inBook) {
        toEl.innerHTML = '<span style="color:var(--accent);cursor:pointer;" onclick="if(typeof addClientFromContact===\'function\')addClientFromContact(\'' + escapeHtml(_toEmail.replace(/'/g, "\\'")) + '\',\'\',\'\');event.stopPropagation();" title="Add as client">' + escapeHtml(_toEmail) + '</span> <span style="font-size:10px;color:var(--text-muted);">In Address Book</span>';
      } else {
        toEl.innerHTML = '<span style="color:var(--accent);cursor:pointer;" onclick="if(typeof mailQuickAddContact===\'function\')mailQuickAddContact(\'' + escapeHtml(_toEmail.replace(/'/g, "\\'")) + '\');event.stopPropagation();" title="Add to contacts">' + escapeHtml(_toEmail) + '</span> <span style="font-size:9px;padding:2px 5px;border-radius:3px;background:var(--accent);color:#fff;cursor:pointer;vertical-align:1px;" onclick="if(typeof mailQuickAddContact===\'function\')mailQuickAddContact(\'' + escapeHtml(_toEmail.replace(/'/g, "\\'")) + '\');event.stopPropagation();">+ Add</span>';
      }
    } else {
      toEl.textContent = '';
    }
  }
  if (dateEl) dateEl.textContent = dateStr || '';
}

// v24.9: Quick-add email to address book from sent detail
function mailQuickAddContact(email) {
  if (!email) return;
  var book = typeof getMailAddressBook === 'function' ? getMailAddressBook() : [];
  var exists = book.some(function(c) { return c.email && c.email.toLowerCase() === email.toLowerCase(); });
  if (exists) {
    showToast('Already in address book', 'info');
  } else {
    var name = email.split('@')[0].replace(/[._-]/g, ' ');
    name = name.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    book.push({ name: name, email: email, company: '', createdAt: new Date().toISOString() });
    if (typeof saveMailAddressBook === 'function') saveMailAddressBook(book);
    showToast('Added to address book: ' + email, 'success');
  }
  // Also offer to add as client
  if (typeof addClientFromContact === 'function') addClientFromContact(email, '', '');
}

// v22.33: Parse plain text email into thread messages and render as cards
function mailRenderThreadCards(plainText, currentUserEmail) {
  // Split on "On [date], [name] <email> wrote:" pattern
  var splitPattern = /(?:^|\n)(On .{10,80}wrote:\s*$)/gm;
  var parts = [];
  var lastIdx = 0;
  var markers = [];
  var m;
  while ((m = splitPattern.exec(plainText)) !== null) {
    markers.push({ idx: m.index, marker: m[1], end: m.index + m[0].length });
  }

  if (markers.length === 0) {
    // No thread detected - return null to use default rendering
    return null;
  }

  // First part is the newest message (before first "On... wrote:")
  var firstBody = plainText.substring(0, markers[0].idx).trim();
  if (firstBody) {
    parts.push({ from: null, date: null, body: firstBody, isNewest: true });
  }

  // Each subsequent part
  for (var i = 0; i < markers.length; i++) {
    var markerText = markers[i].marker;
    var bodyStart = markers[i].end;
    var bodyEnd = (i + 1 < markers.length) ? markers[i + 1].idx : plainText.length;
    var body = plainText.substring(bodyStart, bodyEnd).trim();
    // Remove leading > quote markers
    body = body.replace(/^>\s?/gm, '').trim();
    // Extract sender from marker
    var senderMatch = markerText.match(/On .+?,\s*(.+?)\s*<(.+?)>\s*wrote/);
    var senderName = senderMatch ? senderMatch[1].trim() : '';
    var senderEmail = senderMatch ? senderMatch[2].trim() : '';
    // Extract date
    var dateMatch = markerText.match(/On (.+?),\s*(?:at\s+)?(\d{1,2}:\d{2})/);
    var dateStr = dateMatch ? dateMatch[1] : '';
    if (!senderName && senderEmail) senderName = senderEmail.split('@')[0];
    parts.push({ from: senderName, email: senderEmail, date: dateStr, body: body, isNewest: false });
  }

  if (parts.length <= 1) return null; // Not really a thread

  // Build thread card HTML
  var userEmail = (currentUserEmail || '').toLowerCase();
  var html = '';
  parts.forEach(function(part, idx) {
    var isYou = part.email && userEmail && part.email.toLowerCase() === userEmail;
    var initial = part.from ? part.from.charAt(0).toUpperCase() : (isYou ? 'Y' : '?');
    var displayName = isYou ? 'You' : (part.from || 'Unknown');
    if (part.isNewest) {
      displayName = 'Latest Reply';
      initial = ''; // Will be set by the header avatar
    }
    var preview = part.body.substring(0, 120).replace(/\n/g, ' ');
    var expanded = idx === 0 ? ' expanded' : '';
    var avatarClass = isYou && !part.isNewest ? ' you' : '';
    var linkedBody = mailLinkifyText(part.body).replace(/\n/g, '<br>');

    html += '<div class="mail-thread-card' + expanded + '">';
    html += '<div class="mail-thread-card-header" onclick="this.parentElement.classList.toggle(\'expanded\')">';
    html += '<div class="mail-thread-card-avatar' + avatarClass + '">' + escapeHtml(initial) + '</div>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div class="mail-thread-card-sender">' + escapeHtml(displayName) + (part.date ? ' <span style="font-weight:400;color:var(--text-tertiary);font-size:11px;">' + escapeHtml(part.date) + '</span>' : '') + '</div>';
    html += '<div class="mail-thread-card-preview">' + escapeHtml(preview) + '</div>';
    html += '</div>';
    html += '<svg class="mail-thread-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    html += '</div>';
    html += '<div class="mail-thread-card-body">' + linkedBody + '</div>';
    html += '</div>';
  });

  return html;
}

function mailInsertHR() {
  document.getElementById('mailComposeBody').focus();
  document.execCommand('insertHTML', false, '<hr style="border:none;border-top:1px solid #ccc;margin:16px 0;">');
}

// v22.33: Auto-link URLs pasted into compose body
function mailHandleCanvasPaste(e) {
  var text = (e.clipboardData || window.clipboardData).getData('text/plain');
  if (text && /^https?:\/\/\S+$/i.test(text.trim())) {
    e.preventDefault();
    var url = text.trim();
    document.execCommand('insertHTML', false, '<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>');
  }
}

function mailClearFormat() {
  document.getElementById('mailComposeBody').focus();
  document.execCommand('removeFormat', false, null);
  document.execCommand('formatBlock', false, '<div>');
}

function mailUpdateCanvasCounts() {
  var el = document.getElementById('mailComposeBody');
  if (!el) return;
  var text = el.innerText || '';
  var words = text.trim() ? text.trim().split(/\s+/).length : 0;
  var chars = text.length;
  var wc = document.getElementById('mailCanvasWordCount');
  var cc = document.getElementById('mailCanvasCharCount');
  if (wc) wc.textContent = words + ' word' + (words !== 1 ? 's' : '');
  if (cc) cc.textContent = chars + ' character' + (chars !== 1 ? 's' : '');
}

// Initialize canvas event listeners
(function() {
  function init() {
    var canvas = document.getElementById('mailComposeBody');
    if (canvas) {
      canvas.addEventListener('input', mailUpdateCanvasCounts);
      // v25.0: Live-update template preview on canvas input (debounced 1.5s)
      // mailUpdateTemplatePreview itself has a 150ms function-level debounce
      var _previewTimer = null;
      canvas.addEventListener('input', function() {
        clearTimeout(_previewTimer);
        _previewTimer = setTimeout(function() {
          if (typeof mailUpdateTemplatePreview === 'function') mailUpdateTemplatePreview();
        }, 1500);
      });
      canvas.addEventListener('mouseup', function() {
        // Check for selection - show voice tools hint
        var sel = window.getSelection();
        if (sel && sel.toString().trim().length > 0) {
          // Selection exists - voice tools available
        }
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// --- BrandAI Voice Tools ---
var _mailVoiceSelection = '';

function mailUpdateWritingToolsLabels() {
  // v22.28: Mode-aware labels for writing tools
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var aiName = mode === 'life' ? 'LifeAI' : 'BrandAI';
  var btnLabel = document.getElementById('mailVoiceToolsLabel');
  if (btnLabel) btnLabel.textContent = aiName + ' Tools';
  var popLabel = document.getElementById('mailVoicePopoverLabel');
  if (popLabel) popLabel.textContent = aiName + ' Writing Tools';
}

function mailShowVoiceTools(e) {
  var popover = document.getElementById('mailVoicePopover');
  if (!popover) return;
  mailUpdateWritingToolsLabels();
  // Get selected text from canvas
  var sel = window.getSelection();
  _mailVoiceSelection = sel ? sel.toString().trim() : '';
  if (!_mailVoiceSelection) {
    showToast('Select text in the email first, then use writing tools', 'info');
    return;
  }
  // Position near the button (mobile-safe)
  var rect = e.target.getBoundingClientRect();
  popover.style.top = (rect.bottom + 4) + 'px';
  if (window.innerWidth <= 768) {
    popover.style.left = '10px';
    popover.style.right = '10px';
  } else {
    popover.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
    popover.style.right = '';
  }
  popover.classList.add('visible');
  // Close on outside click
  setTimeout(function() {
    document.addEventListener('click', function closeVoice(ev) {
      if (!popover.contains(ev.target)) {
        popover.classList.remove('visible');
        document.removeEventListener('click', closeVoice);
      }
    });
  }, 10);
}

function mailVoiceAction(action) {
  var popover = document.getElementById('mailVoicePopover');
  if (popover) popover.classList.remove('visible');
  if (!_mailVoiceSelection) { showToast('No text selected', 'error'); return; }

  var prompts = {
    rewrite: 'Rewrite the following text, keeping the same meaning but with improved clarity and flow:\n\n',
    professional: 'Rewrite the following text in a professional, business-appropriate tone:\n\n',
    friendly: 'Rewrite the following text in a warm, friendly, approachable tone:\n\n',
    concise: 'Make the following text more concise and direct. Remove unnecessary words while keeping the key message:\n\n',
    expand: 'Expand the following text with more detail, examples, or context while keeping the same tone:\n\n',
    grammar: 'Fix any grammar, spelling, or punctuation errors in the following text. Only fix errors, do not change the style or meaning:\n\n',
    brand_voice: '' // special handling below
  };

  var systemPrompt = 'You are a professional writing assistant. Use ONLY real brand data when referencing brand details - never invent pricing, services, or facts. Return ONLY the rewritten text with no preamble, no quotes, no explanation.';
  var userPrompt = '';

  // v22.25: Build full brand context for ALL voice actions (not just brand_voice)
  var _vBrandCtx = '';
  try {
    var _vIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
    var _vB = brands[_vIdx];
    if (_vB) {
      _vBrandCtx = 'Brand: ' + (_vB.shortName || _vB.name || '') + '. ';
      if (_vB.voice) _vBrandCtx += 'Voice: ' + _vB.voice + '. ';
      if (_vB.tone) _vBrandCtx += 'Tone: ' + _vB.tone + '. ';
      if (_vB.vocabDo) _vBrandCtx += 'Vocabulary DO: ' + _vB.vocabDo + '. ';
      if (_vB.vocabDont) _vBrandCtx += 'Vocabulary DONT: ' + _vB.vocabDont + '. ';
      if (_vB.pricing) _vBrandCtx += 'PRICING: ' + _vB.pricing + '. ';
      if (_vB.services) _vBrandCtx += 'SERVICES: ' + _vB.services + '. ';
      if (_vB.products || _vB.positioning) _vBrandCtx += 'PRODUCTS: ' + (_vB.products || _vB.positioning) + '. ';
      if (_vB.audience) _vBrandCtx += 'AUDIENCE: ' + _vB.audience + '. ';
      if (_vB.promise) _vBrandCtx += 'PROMISE: ' + _vB.promise + '. ';
      if (_vB.tagline) _vBrandCtx += 'TAGLINE: ' + _vB.tagline + '. ';
      if (_vB.mission) _vBrandCtx += 'MISSION: ' + _vB.mission + '. ';
      if (_vB.location) _vBrandCtx += 'LOCATION: ' + _vB.location + '. ';
      if (_vB.contacts) _vBrandCtx += 'CONTACTS: ' + _vB.contacts + '. ';
      if (_vB.deliverables) _vBrandCtx += 'DELIVERABLES: ' + _vB.deliverables + '. ';
      if (_vB.experience) _vBrandCtx += 'EXPERIENCE: ' + _vB.experience + '. ';
      if (_vB.identity) {
        if (_vB.identity.voiceTone) _vBrandCtx += 'VOICE DETAIL: ' + _vB.identity.voiceTone + '. ';
        if (_vB.identity.brandEssence) _vBrandCtx += 'BRAND ESSENCE: ' + _vB.identity.brandEssence + '. ';
        if (_vB.identity.messaging) _vBrandCtx += 'MESSAGING: ' + _vB.identity.messaging + '. ';
        if (_vB.identity.competitivePosition) _vBrandCtx += 'COMPETITIVE POSITION: ' + _vB.identity.competitivePosition + '. ';
      }
      // Brand intelligence
      if (typeof getBrandIdentityIntelligence === 'function') {
        var _vIntel = getBrandIdentityIntelligence(_vB);
        if (_vIntel) _vBrandCtx += '\n' + _vIntel;
      }
    }
  } catch(e) {}

  if (action === 'brand_voice') {
    systemPrompt = 'You are a brand voice writing assistant. Use ONLY real brand data - never invent facts.\n\n' + _vBrandCtx + '\n\nRewrite the text to match this brand\'s voice and tone perfectly. Return ONLY the rewritten text.';
    userPrompt = _mailVoiceSelection;
  } else {
    // v22.25: Inject brand context into all actions so rewrites stay on-brand
    if (_vBrandCtx) systemPrompt += '\n\nBRAND CONTEXT:\n' + _vBrandCtx;
    userPrompt = prompts[action] + _mailVoiceSelection;
  }

  // v23.2: Loading state for voice actions
  mailShowComposeLoading(true);

  // Use the AI provider
  mailCallAI(systemPrompt, userPrompt, function(result) {
    mailShowComposeLoading(false);
    if (!result) { showToast('AI rewrite failed - try again', 'error'); return; }
    // Replace selected text in canvas
    var canvas = document.getElementById('mailComposeBody');
    if (canvas) {
      canvas.focus();
      // Restore selection and replace
      document.execCommand('insertText', false, result);
      mailUpdateCanvasCounts();
      showToast('Text updated by BrandAI', 'success');
    }
  });
}

// --- AI Compose (Write with AI) --- v22.25: Always show modal for direction
function mailAICompose() {
  var overlay = document.getElementById('mailAiOverlay');
  var input = document.getElementById('mailAiPromptInput');
  var label = overlay ? overlay.querySelector('label') : null;
  if (!overlay || !input) return;
  var existing = mailGetCanvasText().trim();
  var subject = (document.getElementById('mailComposeSubject').value || '').trim();
  // v22.28: Mode-aware labels
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var aiName = mode === 'life' ? 'LifeAI' : 'BrandAI';
  var titleEl = document.getElementById('mailAiModalTitle');
  if (titleEl) titleEl.textContent = 'Write with ' + aiName;
  var hintEl = document.getElementById('mailAiModalHint');
  if (hintEl) hintEl.textContent = aiName + ' will use your ' + (mode === 'life' ? 'personal profile and preferences' : 'brand identity, knowledge, and voice') + ' to draft the email.';
  // Adjust label based on whether there's existing content
  if (label) {
    label.textContent = existing ? 'What changes should ' + aiName + ' make?' : 'What should the email be about?';
  }
  input.value = '';
  input.placeholder = existing
    ? 'e.g. Make it more concise, add pricing details, change the tone...'
    : 'e.g. Follow up on pricing inquiry, introduce our new service...';
  overlay.style.display = 'flex';
  setTimeout(function() { input.focus(); }, 100);
  input.onkeydown = function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mailAiModalSubmit(); } };
}

function mailAiModalClose() {
  var overlay = document.getElementById('mailAiOverlay');
  if (overlay) overlay.style.display = 'none';
}

function mailAiModalSubmit() {
  var input = document.getElementById('mailAiPromptInput');
  var val = input ? input.value.trim() : '';
  if (!val) { showToast('Please describe what the email should be about', 'error'); return; }
  mailAiModalClose();
  var existing = mailGetCanvasText().trim();
  mailAIComposeExecute(val, existing || null);
}

function mailAIComposeExecute(topic, existingDraft) {
  var subject = (document.getElementById('mailComposeSubject').value || '').trim();
  var to = (document.getElementById('mailComposeTo').value || '').trim();

  // v22.25: Build full brand context (same as chat agent)
  var brandCtx = '';
  var brandName = '';
  try {
    var idx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
    var brand = brands[idx];
    if (brand) {
      brandName = brand.shortName || brand.name || '';
      brandCtx += 'You are the email writer for ' + brand.name + '.\n\n';
      brandCtx += '===== BRAND: ' + brand.name + ' =====\n';
      if (brand.tagline) brandCtx += 'TAGLINE: ' + brand.tagline + '\n';
      if (brand.philosophy) brandCtx += 'PHILOSOPHY: ' + brand.philosophy + '\n';
      if (brand.coreBelief) brandCtx += 'CORE BELIEF: ' + brand.coreBelief + '\n';
      if (brand.mission) brandCtx += 'MISSION: ' + brand.mission + '\n';
      if (brand.ethos) brandCtx += 'ETHOS: ' + brand.ethos + '\n';
      if (brand.products || brand.positioning) brandCtx += 'PRODUCTS: ' + (brand.products || brand.positioning || '') + '\n';
      if (brand.audience) brandCtx += 'TARGET AUDIENCE: ' + brand.audience + '\n';
      if (brand.promise) brandCtx += 'BRAND PROMISE: ' + brand.promise + '\n';
      if (brand.cta) brandCtx += 'PRIMARY CTA: ' + brand.cta + '\n';
      if (brand.voice) brandCtx += 'VOICE: ' + brand.voice + '\n';
      if (brand.tone) brandCtx += 'TONE: ' + brand.tone + '\n';
      if (brand.approach) brandCtx += 'APPROACH: ' + brand.approach + '\n';
      if (brand.vocabDo) brandCtx += 'VOCABULARY DO: ' + brand.vocabDo + '\n';
      if (brand.vocabDont) brandCtx += 'VOCABULARY DONT: ' + brand.vocabDont + '\n';
      if (brand.constraints) brandCtx += 'CONSTRAINTS: ' + brand.constraints + '\n';
      if (brand.pricing) brandCtx += 'PRICING: ' + brand.pricing + '\n';
      if (brand.services) brandCtx += 'SERVICES: ' + brand.services + '\n';
      if (brand.experience) brandCtx += 'EXPERIENCE: ' + brand.experience + '\n';
      if (brand.location) brandCtx += 'LOCATION: ' + brand.location + '\n';
      if (brand.contacts) brandCtx += 'CONTACTS: ' + brand.contacts + '\n';
      if (brand.deliverables) brandCtx += 'DELIVERABLES: ' + brand.deliverables + '\n';
      if (brand.partnerships) brandCtx += 'PARTNERSHIPS: ' + brand.partnerships + '\n';
      // Identity data
      if (brand.identity) {
        var id = brand.identity;
        if (id.voiceTone) brandCtx += 'VOICE & TONE DETAIL: ' + id.voiceTone + '\n';
        if (id.brandEssence) brandCtx += 'BRAND ESSENCE: ' + id.brandEssence + '\n';
        if (id.messaging) brandCtx += 'MESSAGING: ' + id.messaging + '\n';
        if (id.visualIdentity) brandCtx += 'VISUAL IDENTITY: ' + id.visualIdentity + '\n';
        if (id.competitivePosition) brandCtx += 'COMPETITIVE POSITION: ' + id.competitivePosition + '\n';
      }
      brandCtx += '\n';
      // Brand intelligence (knowledge, documents, memory)
      if (typeof getBrandIdentityIntelligence === 'function') {
        var intel = getBrandIdentityIntelligence(brand);
        if (intel) brandCtx += intel + '\n';
      }
    }
  } catch(e) {}

  var prompt = '';
  if (existingDraft && topic) {
    // User has existing content AND gave a new direction
    prompt = 'Revise this email draft based on the following direction: ' + topic + '\n\nSubject: ' + (subject || 'N/A') + '\nTo: ' + (to || 'N/A') + '\nCurrent draft:\n' + existingDraft + '\n\nApply the requested changes while maintaining the brand voice. Return the full revised body.';
  } else if (existingDraft) {
    prompt = 'Improve this email draft:\n\nSubject: ' + (subject || 'N/A') + '\nTo: ' + (to || 'N/A') + '\nCurrent draft:\n' + existingDraft + '\n\nImprove the email while maintaining the brand voice. Return the full body.';
  } else {
    prompt = 'Write a branded email about: ' + topic;
    if (to) prompt += '\nRecipient: ' + to;
    if (subject) prompt += '\nSubject: ' + subject;
    prompt += '\n\nWrite ONLY the email body HTML. No subject line. Start with the greeting. Use the brand context above for accurate details - never invent pricing, services, or facts not in the brand data.';
  }

  // v23.2: Include formatting tier and font preference
  var _formatTierPrompt = typeof mailGetFormatTierPrompt === 'function' ? mailGetFormatTierPrompt() : '';
  var _fontPref = typeof mailGetFontStack === 'function' ? '\n- Use font-family: ' + mailGetFontStack() + ' for all text.' : '';
  var sys = brandCtx + 'INSTRUCTIONS:\n- Write clear, well-structured emails in this brand\'s voice.\n- Use HTML formatting (paragraphs, bold for emphasis, bullet lists if needed).\n- Use ONLY real brand data for pricing, services, products - never fabricate details.\n- If specific data is not available, keep it general rather than inventing numbers.\n- Do NOT use em-dashes in any text.\n- Return ONLY the email body HTML, no wrappers.' + _formatTierPrompt + _fontPref;

  // v23.2: Loading state with spinner overlay
  mailShowComposeLoading(true);
  mailCallAI(sys, prompt, function(result) {
    mailShowComposeLoading(false);
    if (!result) { showToast('AI compose failed - try again', 'error'); return; }
    // v22.44: Strip markdown code fences if present
    result = result.replace(/^[\s\S]*?```html?\s*\n?/i, '').replace(/\n?\s*```[\s\S]*$/, '').trim();
    result = result.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
    var canvas = document.getElementById('mailComposeBody');
    if (canvas) {
      canvas.innerHTML = result;
      mailUpdateCanvasCounts();
      // v23.2: Auto-capitalize subject line after AI generation
      mailAutoCapitalizeSubject();
      showToast('Email drafted by BrandAI' + (brandName ? ' for ' + brandName : ''), 'success');
    }
  });
}

// --- AI call helper (uses current API key setup) ---
function mailCallAI(system, user, callback) {
  // v25.1: Wrap callback to strip em-dashes from all mail AI output
  var _origCb = callback;
  callback = function(text) {
    if (text && typeof text === 'string') {
      text = text.replace(/\u2014/g, ' - ').replace(/\u2013/g, ' - ').replace(/\u2015/g, ' - ');
    }
    _origCb(text);
  };
  // v24.25: Use brand's configured API keys - try all available providers
  var apiKeys = {};
  try { apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}

  // v24.25: Determine preferred provider order from brand API routing
  var routing = {};
  try { routing = JSON.parse(localStorage.getItem('roweos_api_routing') || '{}'); } catch(e) {}
  var preferredProvider = (routing.email && routing.email.provider) || '';
  var providerOrder = ['anthropic', 'openai', 'google'];
  if (preferredProvider && providerOrder.indexOf(preferredProvider) !== -1) {
    providerOrder = [preferredProvider].concat(providerOrder.filter(function(p) { return p !== preferredProvider; }));
  }

  // Find first available provider
  var chosenProvider = '';
  for (var pi = 0; pi < providerOrder.length; pi++) {
    if (apiKeys[providerOrder[pi]]) { chosenProvider = providerOrder[pi]; break; }
  }

  if (chosenProvider === 'anthropic') {
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKeys.anthropic,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: system,
        messages: [{ role: 'user', content: user }]
      })
    }).then(function(r) { return r.json(); }).then(function(data) {
      var text = data.content && data.content[0] ? data.content[0].text : '';
      callback(text);
    }).catch(function() { callback(null); });
  } else if (chosenProvider === 'openai') {
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKeys.openai },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: 2000
      })
    }).then(function(r) { return r.json(); }).then(function(data) {
      var text = data.choices && data.choices[0] ? data.choices[0].message.content : '';
      callback(text);
    }).catch(function() { callback(null); });
  } else if (chosenProvider === 'google') {
    fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKeys.google, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }]
      })
    }).then(function(r) { return r.json(); }).then(function(data) {
      var text = data.candidates && data.candidates[0] && data.candidates[0].content ? data.candidates[0].content.parts[0].text : '';
      callback(text);
    }).catch(function() { callback(null); });
  } else {
    showToast('No AI API key configured. Add one in Settings.', 'error');
    callback(null);
  }
}

// --- Chat: Send as Email ---
function chatSendAsEmail(btn) {
  // Find the message bubble containing this button
  var bubble = btn.closest('.assistant-msg') || btn.closest('.conversation-message');
  if (!bubble) { showToast('Could not find message content', 'error'); return; }

  var contentEl = bubble.querySelector('.msg-content') || bubble.querySelector('.markdown-content') || bubble;
  var html = contentEl.innerHTML || '';
  var text = contentEl.innerText || '';
  var firstLine = text.split('\n')[0].substring(0, 80);

  // v22.25: Show inline email compose form directly in chat
  var existing = bubble.querySelector('.chat-email-inline');
  if (existing) { existing.remove(); return; } // toggle off

  var config = getMailConfig ? getMailConfig() : {};
  // v23.9: buildFromOptionsHtml already includes all multi-account Gmail/Outlook
  var fromOptions = (typeof buildFromOptionsHtml === 'function') ? buildFromOptionsHtml('') : '<option value="">Select address...</option>';

  var formDiv = document.createElement('div');
  formDiv.className = 'chat-email-inline';
  formDiv.innerHTML = '<div style="border:1px solid var(--border-color);border-radius:10px;margin-top:10px;overflow:hidden;background:var(--bg-secondary);">' +
    '<div style="padding:10px 14px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:8px;">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>' +
      '<span style="font-size:13px;font-weight:600;color:var(--text-primary);">Send as Email</span>' +
    '</div>' +
    '<div style="padding:10px 14px;display:flex;flex-direction:column;gap:6px;">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<select class="chat-email-from" style="flex:1;min-width:120px;padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;">' + fromOptions + '</select>' +
      '</div>' +
      '<input class="chat-email-to" type="text" inputmode="email" placeholder="To: recipient@example.com" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;">' +
      '<input class="chat-email-cc" type="text" placeholder="CC (optional)" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;">' +
      '<input class="chat-email-subject" type="text" value="' + escapeHtml(firstLine) + '" placeholder="Subject" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;">' +
      '<select class="chat-email-template" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;">' +
        '<option value="professional">Professional Template</option><option value="minimal">Minimal</option><option value="bold">Bold</option><option value="newsletter">Newsletter</option><option value="plain">Plain Text</option>' +
      '</select>' +
      '<div style="display:flex;gap:6px;justify-content:flex-end;margin-top:4px;">' +
        '<button onclick="chatEmailCancel(this)" style="padding:6px 14px;border:1px solid var(--border-color);border-radius:6px;background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;">Cancel</button>' +
        '<button onclick="chatEmailToOutbox(this)" style="padding:6px 14px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-tertiary);color:var(--text-primary);font-size:12px;cursor:pointer;">Save to Outbox</button>' +
        '<button onclick="chatEmailSend(this)" style="padding:6px 14px;border:none;border-radius:6px;background:var(--brand-accent, #a89878);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Send</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  // Store the HTML content on the form element
  formDiv._emailHtml = html;
  formDiv._emailText = text;
  bubble.appendChild(formDiv);
  // Focus the To field
  var toInput = formDiv.querySelector('.chat-email-to');
  if (toInput) setTimeout(function() { toInput.focus(); }, 50);
}

function chatEmailCancel(btn) {
  var inline = btn.closest('.chat-email-inline');
  if (inline) inline.remove();
}

function chatEmailToOutbox(btn) {
  var inline = btn.closest('.chat-email-inline');
  if (!inline) return;
  var to = inline.querySelector('.chat-email-to').value.trim();
  var subject = inline.querySelector('.chat-email-subject').value.trim();
  var cc = inline.querySelector('.chat-email-cc').value.split(',').map(function(e) { return e.trim(); }).filter(Boolean);
  var from = inline.querySelector('.chat-email-from').value;
  var template = inline.querySelector('.chat-email-template').value;
  var body = inline._emailText || '';
  var canvasHtml = inline._emailHtml || '';

  if (typeof addToMailOutbox === 'function') {
    addToMailOutbox({
      to: to, subject: subject || 'From BrandAI Chat', body: body,
      canvasHtml: canvasHtml,
      html: mailRenderBody(body, template, canvasHtml),
      from: from, cc: cc, template: template
    });
  }
  inline.remove();
  showToast('Email saved to outbox', 'success');
}

function chatEmailSend(btn) {
  var inline = btn.closest('.chat-email-inline');
  if (!inline) return;
  var to = inline.querySelector('.chat-email-to').value.trim();
  if (!to) { showToast('Recipient email is required', 'error'); return; }
  var subject = inline.querySelector('.chat-email-subject').value.trim();
  var cc = inline.querySelector('.chat-email-cc').value.split(',').map(function(e) { return e.trim(); }).filter(Boolean);
  var from = inline.querySelector('.chat-email-from').value;
  var template = inline.querySelector('.chat-email-template').value;
  var body = inline._emailText || '';
  var canvasHtml = inline._emailHtml || '';
  var htmlBody = mailRenderBody(body, template, canvasHtml);

  // Save to outbox first
  var item = null;
  if (typeof addToMailOutbox === 'function') {
    item = addToMailOutbox({
      to: to, subject: subject || 'From BrandAI Chat', body: body,
      canvasHtml: canvasHtml, html: htmlBody,
      from: from, cc: cc, template: template
    });
  }
  // Then send it
  if (item && typeof mailSendOutboxItem === 'function') {
    mailSendOutboxItem(item.id);
  }
  inline.remove();
  showToast('Sending email to ' + to + '...', 'info');
}

// --- Initialize badge on load ---
if (typeof updateMailBadge === 'function') {
  try { updateMailBadge(); } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
// v22.26: Email Publisher - auto-shown after Email Writer op in Studio
// ═══════════════════════════════════════════════════════════════
function showEmailPublisher(content, op) {
  var outputPanel = document.getElementById('studioOutput');
  if (!outputPanel) return;

  var config = getMailConfig ? getMailConfig() : {};
  var defaultFrom = config.defaultFromAddress || getDefaultFromAddress();
  var fromOptions = '';
  // v22.33: Only show admin addresses for admin
  if (typeof isAdmin === 'function' && isAdmin()) {
    fromOptions += '<option value="roweos@therowecollection.com"' + (defaultFrom === 'roweos@therowecollection.com' ? ' selected' : '') + '>Brilliance</option>';
    fromOptions += '<option value="jordan@therowecollection.com"' + (defaultFrom === 'jordan@therowecollection.com' ? ' selected' : '') + '>Jordan Rowe</option>';
  }
  // v23.10: Multi-account Gmail (with display name)
  var gmailAccts = getMailGmailAccounts();
  gmailAccts.forEach(function(acct) {
    var gv = 'gmail:' + acct.email;
    var label = acct.displayName ? escapeHtml(acct.displayName) + ' - ' + escapeHtml(acct.email) + ' (Gmail)' : escapeHtml(acct.email) + ' (Gmail)';
    fromOptions += '<option value="' + escapeHtml(gv) + '"' + (defaultFrom === gv || defaultFrom === acct.email ? ' selected' : '') + '>' + label + '</option>';
  });
  // v23.10: Multi-account Outlook (with display name)
  var outlookAccts = getMailOutlookAccounts();
  outlookAccts.forEach(function(acct) {
    var ov = 'outlook:' + acct.email;
    var label = acct.displayName ? escapeHtml(acct.displayName) + ' - ' + escapeHtml(acct.email) + ' (Outlook)' : escapeHtml(acct.email) + ' (Outlook)';
    fromOptions += '<option value="' + escapeHtml(ov) + '"' + (defaultFrom === ov || defaultFrom === acct.email ? ' selected' : '') + '>' + label + '</option>';
  });
  var custom = config.customFromAddresses || [];
  custom.forEach(function(a) { fromOptions += '<option value="' + escapeHtml(a) + '"' + (defaultFrom === a ? ' selected' : '') + '>' + escapeHtml(a) + '</option>'; });

  // Extract first line as potential subject
  var lines = content.split('\n').filter(function(l) { return l.trim(); });
  var suggestedSubject = lines[0] ? lines[0].replace(/^(Subject:|Re:|Fwd:)\s*/i, '').substring(0, 100) : '';

  var templateOpts = '<option value="professional">Professional</option><option value="minimal">Minimal</option><option value="bold">Bold</option><option value="newsletter">Newsletter</option><option value="plain">Plain Text</option>';

  var panel = document.createElement('div');
  panel.id = 'emailPublisherPanel';
  panel.className = 'social-publisher-panel visible';
  panel.innerHTML = '<div style="padding:16px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);margin-top:16px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>' +
      '<span style="font-size:15px;font-weight:600;color:var(--text-primary);">Send Email</span>' +
      '<button onclick="document.getElementById(\'emailPublisherPanel\').remove()" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">x</button>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<select id="emailPubFrom" style="flex:1;min-width:140px;padding:8px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">' + fromOptions + '</select>' +
      '</div>' +
      '<input id="emailPubTo" type="text" inputmode="email" placeholder="To: recipient@example.com" style="padding:8px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">' +
      '<input id="emailPubSubject" type="text" value="' + escapeHtml(suggestedSubject) + '" placeholder="Subject" style="padding:8px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<select id="emailPubTemplate" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;">' + templateOpts + '</select>' +
        '<select id="emailPubLogoPos" style="padding:8px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;"><option value="center">Logo: Center</option><option value="left">Logo: Left</option><option value="right">Logo: Right</option></select>' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;flex-wrap:wrap;">' +
        '<button onclick="emailPubOpenInMail()" style="padding:8px 18px;border:1px solid var(--border-color);border-radius:8px;background:transparent;color:var(--text-secondary);font-size:13px;cursor:pointer;display:flex;align-items:center;gap:5px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg> Open in Mail</button>' +
        '<button onclick="emailPubToOutbox()" style="padding:8px 18px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;cursor:pointer;">Save to Outbox</button>' +
        '<button onclick="emailPubSend()" style="padding:8px 18px;border:none;border-radius:8px;background:var(--brand-accent, #a89878);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Send</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  panel._emailContent = content;

  // Remove any existing publisher
  var existing = document.getElementById('emailPublisherPanel');
  if (existing) existing.remove();

  // Insert after the output panel
  var outputEl = outputPanel.querySelector('.studio-output-content') || outputPanel;
  outputEl.parentNode.insertBefore(panel, outputEl.nextSibling);
}

function _getEmailPubData() {
  var panel = document.getElementById('emailPublisherPanel');
  if (!panel) return null;
  return {
    content: panel._emailContent || '',
    to: (document.getElementById('emailPubTo') || {}).value || '',
    subject: (document.getElementById('emailPubSubject') || {}).value || '',
    from: (document.getElementById('emailPubFrom') || {}).value || '',
    template: (document.getElementById('emailPubTemplate') || {}).value || 'professional',
    logoPosition: (document.getElementById('emailPubLogoPos') || {}).value || 'center'
  };
}

function emailPubSaveDraft() {
  var d = _getEmailPubData();
  if (!d) return;
  if (typeof mailSaveDraft === 'function') {
    // Set compose fields temporarily for draft save
    var toEl = document.getElementById('mailComposeTo');
    var subEl = document.getElementById('mailComposeSubject');
    var bodyEl = document.getElementById('mailComposeCanvas');
    var fromEl = document.getElementById('mailComposeFrom');
    // Save to drafts via mail system
    if (typeof addToMailOutbox === 'function') {
      var item = addToMailOutbox({
        to: d.to, subject: d.subject || 'From Studio', body: d.content,
        html: mailRenderBody(d.content, d.template),
        from: d.from, template: d.template, isDraft: true
      });
    }
    // Also save as draft
    var drafts = [];
    try { drafts = JSON.parse(localStorage.getItem('roweos_mail_drafts') || '[]'); } catch(e) {}
    drafts.unshift({
      id: 'draft_' + Date.now(), to: d.to, subject: d.subject, body: d.content,
      from: d.from, template: d.template, savedAt: Date.now()
    });
    try { localStorage.setItem('roweos_mail_drafts', JSON.stringify(drafts)); } catch(e) {}
    writeDB('profile/mail', { drafts: drafts }); // v25.1
  }
  showToast('Email saved as draft', 'success');
}

function emailPubToOutbox() {
  var d = _getEmailPubData();
  if (!d) return;
  if (typeof addToMailOutbox === 'function') {
    addToMailOutbox({
      to: d.to, subject: d.subject || 'From Studio', body: d.content,
      html: mailRenderBody(d.content, d.template, null, false, d.logoPosition),
      from: d.from, template: d.template, logoPosition: d.logoPosition
    });
  }
  showToast('Email saved to outbox', 'success');
}

// v22.33: Open in Mail tab compose with full rich content
function emailPubOpenInMail() {
  var d = _getEmailPubData();
  if (!d) return;
  // Switch to Mail view, compose tab
  showView('mail');
  setTimeout(function() {
    if (typeof switchMailTab === 'function') switchMailTab('compose');
    setTimeout(function() {
      var toEl = document.getElementById('mailComposeTo');
      var subEl = document.getElementById('mailComposeSubject');
      var bodyEl = document.getElementById('mailComposeBody');
      var fromEl = document.getElementById('mailComposeFrom');
      var templateEl = document.getElementById('mailComposeTemplate');
      if (toEl && d.to) toEl.value = d.to;
      if (subEl) subEl.value = d.subject || '';
      if (fromEl && d.from) fromEl.value = d.from;
      if (templateEl) {
        templateEl.value = d.template || 'professional';
        var _lpPub = document.getElementById('mailComposeLogoPos');
        if (_lpPub) _lpPub.value = d.logoPosition || 'center';
        if (typeof mailOnTemplateChange === 'function') mailOnTemplateChange();
      }
      // Insert rich content into compose body
      if (bodyEl && d.content) {
        var richHtml = d.content;
        // Convert markdown to HTML if marked is available
        if (typeof marked !== 'undefined' && marked.parse) {
          try { richHtml = marked.parse(d.content); } catch(e) {}
        } else {
          richHtml = escapeHtml(d.content).replace(/\n/g, '<br>');
        }
        bodyEl.innerHTML = richHtml;
      }
      if (typeof mailUpdateCanvasCounts === 'function') mailUpdateCanvasCounts();
      // Remove the publisher panel
      var panel = document.getElementById('emailPublisherPanel');
      if (panel) panel.remove();
      showToast('Email loaded in Mail compose', 'success');
    }, 100);
  }, 50);
}

function emailPubSend() {
  var d = _getEmailPubData();
  if (!d) return;
  if (!d.to) { showToast('Recipient email is required', 'error'); return; }
  if (typeof addToMailOutbox === 'function') {
    var item = addToMailOutbox({
      to: d.to, subject: d.subject || 'From Studio', body: d.content,
      html: mailRenderBody(d.content, d.template, null, false, d.logoPosition),
      from: d.from, template: d.template, logoPosition: d.logoPosition
    });
    if (item && typeof mailSendOutboxItem === 'function') {
      mailSendOutboxItem(item.id);
    }
  }
  var panel = document.getElementById('emailPublisherPanel');
  if (panel) panel.remove();
}

// ═══════════════════════════════════════════════════════════════
// v22.24: Sidebar drag-and-drop reorder
// ═══════════════════════════════════════════════════════════════
(function() {
  var _dragItem = null;
  var _dragOverItem = null;

  function getAllNavItems() {
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return [];
    return Array.prototype.slice.call(nav.querySelectorAll('.nav-item[data-view]'));
  }

  // v22.24: Save per-section order as array of arrays
  function saveSidebarOrder() {
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    var sections = Array.prototype.slice.call(nav.querySelectorAll('.nav-section'));
    var order = sections.map(function(sec) {
      var items = Array.prototype.slice.call(sec.querySelectorAll('.nav-item[data-view]'));
      return items.map(function(el) { return el.getAttribute('data-view'); });
    });
    try {
      localStorage.setItem('roweos_sidebar_order', JSON.stringify(order));
    } catch(e) {}
    writeDB('profile/main', { sidebarOrder: order }); // v25.1
  }

  // v22.24: Restore order within each section - preserves section titles
  function applySidebarOrder() {
    try {
      var saved = JSON.parse(localStorage.getItem('roweos_sidebar_order'));
      if (!saved || !Array.isArray(saved) || saved.length === 0) return;
      // Support legacy flat array format - convert to per-section
      if (typeof saved[0] === 'string') {
        // Legacy flat format - just clear it and re-save properly
        localStorage.removeItem('roweos_sidebar_order');
        return;
      }
      var nav = document.querySelector('.sidebar-nav');
      if (!nav) return;
      var sections = Array.prototype.slice.call(nav.querySelectorAll('.nav-section'));
      // Build map of all items
      var itemMap = {};
      getAllNavItems().forEach(function(el) {
        itemMap[el.getAttribute('data-view')] = el;
      });
      // For each section, pull items from saved order and re-append
      saved.forEach(function(sectionViews, sIdx) {
        if (sIdx >= sections.length || !Array.isArray(sectionViews)) return;
        var sec = sections[sIdx];
        // Remove existing nav-items from this section
        var existing = Array.prototype.slice.call(sec.querySelectorAll('.nav-item[data-view]'));
        existing.forEach(function(el) { sec.removeChild(el); });
        // Append items in saved order
        sectionViews.forEach(function(view) {
          if (itemMap[view]) {
            sec.appendChild(itemMap[view]);
            delete itemMap[view]; // track placed items
          }
        });
      });
      // Any unplaced items (new features) go to their original section or last section
      Object.keys(itemMap).forEach(function(view) {
        var lastSec = sections[sections.length - 1];
        if (lastSec) lastSec.appendChild(itemMap[view]);
      });
      initSidebarDrag();
    } catch(e) {}
  }

  function initSidebarDrag() {
    var items = getAllNavItems();
    items.forEach(function(item) {
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', function(e) {
        _dragItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.getAttribute('data-view'));
      });
      item.addEventListener('dragend', function() {
        item.classList.remove('dragging');
        getAllNavItems().forEach(function(el) { el.classList.remove('drag-over'); });
        _dragItem = null;
        _dragOverItem = null;
      });
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (item !== _dragItem) {
          getAllNavItems().forEach(function(el) { el.classList.remove('drag-over'); });
          item.classList.add('drag-over');
          _dragOverItem = item;
        }
      });
      item.addEventListener('dragleave', function() {
        item.classList.remove('drag-over');
      });
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (!_dragItem || _dragItem === item) return;
        // Move into the drop target's section
        var targetSection = item.parentElement;
        var itemsInSection = Array.prototype.slice.call(targetSection.querySelectorAll('.nav-item[data-view]'));
        var dropIdx = itemsInSection.indexOf(item);
        var dragIdx = itemsInSection.indexOf(_dragItem);
        // If dragging from another section, dragIdx will be -1
        if (dragIdx === -1 || dragIdx > dropIdx) {
          targetSection.insertBefore(_dragItem, item);
        } else {
          targetSection.insertBefore(_dragItem, item.nextSibling);
        }
        saveSidebarOrder();
      });
    });
  }

  window.applySidebarOrder = applySidebarOrder;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      applySidebarOrder();
      initSidebarDrag();
    });
  } else {
    applySidebarOrder();
    initSidebarDrag();
  }

  // Touch drag for mobile
  var _touchDragItem = null;
  var _touchStartY = 0;

  function initTouchDrag() {
    var items = getAllNavItems();
    items.forEach(function(item) {
      var longPressTimer = null;
      var isDragging = false;
      item.addEventListener('touchstart', function(e) {
        longPressTimer = setTimeout(function() {
          isDragging = true;
          _touchDragItem = item;
          _touchStartY = e.touches[0].clientY;
          item.classList.add('dragging');
          e.preventDefault();
        }, 400);
      }, { passive: false });
      item.addEventListener('touchmove', function(e) {
        if (!isDragging || !_touchDragItem) return;
        e.preventDefault();
        var touch = e.touches[0];
        var target = document.elementFromPoint(touch.clientX, touch.clientY);
        while (target && !target.classList.contains('nav-item')) target = target.parentElement;
        getAllNavItems().forEach(function(el) { el.classList.remove('drag-over'); });
        if (target && target !== _touchDragItem && target.getAttribute('data-view')) {
          target.classList.add('drag-over');
          _dragOverItem = target;
        }
      }, { passive: false });
      item.addEventListener('touchend', function() {
        clearTimeout(longPressTimer);
        if (isDragging && _touchDragItem && _dragOverItem) {
          var targetSection = _dragOverItem.parentElement;
          var itemsInSection = Array.prototype.slice.call(targetSection.querySelectorAll('.nav-item[data-view]'));
          var dropIdx = itemsInSection.indexOf(_dragOverItem);
          var dragIdx = itemsInSection.indexOf(_touchDragItem);
          if (dragIdx === -1 || dragIdx > dropIdx) {
            targetSection.insertBefore(_touchDragItem, _dragOverItem);
          } else {
            targetSection.insertBefore(_touchDragItem, _dragOverItem.nextSibling);
          }
          saveSidebarOrder();
        }
        if (_touchDragItem) _touchDragItem.classList.remove('dragging');
        getAllNavItems().forEach(function(el) { el.classList.remove('drag-over'); });
        _touchDragItem = null; _dragOverItem = null; isDragging = false;
      });
      item.addEventListener('touchcancel', function() {
        clearTimeout(longPressTimer);
        if (_touchDragItem) _touchDragItem.classList.remove('dragging');
        getAllNavItems().forEach(function(el) { el.classList.remove('drag-over'); });
        _touchDragItem = null; _dragOverItem = null; isDragging = false;
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTouchDrag);
  } else {
    initTouchDrag();
  }
})();

// ============================================================
// v24.20: WebGL Blob - Ambient AI Presence with Shape & Color Control
// ============================================================
var _blobScene, _blobCamera, _blobRenderer, _blobMesh, _blobUniforms;
var _blobAnimId = null;
var _blobMouse = { x: 0, y: 0 };
var _blobState = 'idle'; // idle | thinking | responding
var _blobInitialized = false;
// v24.21: Blob color stored per light/dark mode as gradient pairs in localStorage

// v24.21: Blob shape presets - control noise, detail, speed for distinct looks
var BLOB_SHAPES = {
  none:    null,
  smooth:  { amp: 0.18, freq: 0.7, speed: 0.2, detail: 0.0, fresnel: 3.0, label: 'Smooth' },
  fluid:   { amp: 0.25, freq: 0.9, speed: 0.35, detail: 0.2, fresnel: 2.8, label: 'Fluid' },
  organic: { amp: 0.22, freq: 1.1, speed: 0.25, detail: 0.5, fresnel: 2.5, label: 'Organic' },
  crystal: { amp: 0.35, freq: 1.5, speed: 0.3, detail: 1.0, fresnel: 2.5, label: 'Crystal' },
  sphere:  { amp: 0.06, freq: 0.4, speed: 0.12, detail: 0.0, fresnel: 3.5, label: 'Sphere' }
};
var _blobCurrentShape = 'crystal';
var _blobShapeTarget = BLOB_SHAPES.crystal;

function initBlob() {
  if (_blobInitialized) return;
  if (typeof THREE === 'undefined') {
    setTimeout(initBlob, 200);
    return;
  }
  var canvas = document.getElementById('blobCanvas');
  var container = document.getElementById('blobContainer');
  if (!canvas || !container) return;

  var w = container.offsetWidth || 280;
  var h = container.offsetHeight || 280;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Scene
  _blobScene = new THREE.Scene();
  _blobCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  _blobCamera.position.z = 4;

  // Renderer
  _blobRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, premultipliedAlpha: false });
  _blobRenderer.setSize(w, h);
  _blobRenderer.setPixelRatio(dpr);
  _blobRenderer.setClearColor(0x000000, 0);

  // v24.21: Load saved shape & color
  var savedShape = localStorage.getItem('roweos_blob_shape') || 'crystal';
  // v29.0: Symbiote removed - fallback to crystal
  if (savedShape === 'symbiote') { savedShape = 'crystal'; localStorage.setItem('roweos_blob_shape', 'crystal'); }
  // v24.27: Handle "both" mode on init
  if (savedShape === 'both') {
    var lastBlobShape = localStorage.getItem('roweos_blob_last_shape') || 'crystal';
    _blobCurrentShape = lastBlobShape;
    if (lastBlobShape in BLOB_SHAPES) _blobShapeTarget = BLOB_SHAPES[lastBlobShape];
    // Init helix
    var savedPreset = localStorage.getItem('roweos_helix_preset') || 'brand';
    _helixColorPreset = savedPreset;
    if (savedPreset === 'custom') {
      var savedCustom = localStorage.getItem('roweos_helix_custom_colors');
      if (savedCustom) { try { _helixCustomColors = JSON.parse(savedCustom); } catch(e) {} }
    }
    var helixC = document.getElementById('helixContainer');
    if (helixC) helixC.style.display = '';
    // v30.1: Delay helix init - if agentView is hidden (display:none !important),
    // WebGL can't render. showView('agent') will re-trigger initHelix when visible.
    if (typeof initHelix === 'function') {
      setTimeout(function() { initHelix(); }, 500);
      setTimeout(function() { initHelix(); }, 2000); // retry in case view wasn't visible yet
    }
    // Continue to init blob below (don't return)
  }
  if (savedShape !== 'both') {
    _blobCurrentShape = (savedShape in BLOB_SHAPES || savedShape === 'helix') ? savedShape : 'crystal';
  }
  if (_blobCurrentShape === 'none') { return; }
  // v24.24: Helix mode - init helix instead of blob
  if (_blobCurrentShape === 'helix' && savedShape !== 'both') {
    // v24.24: Load helix color preset before init
    var savedPreset = localStorage.getItem('roweos_helix_preset') || 'brand';
    _helixColorPreset = savedPreset;
    if (savedPreset === 'custom') {
      var savedCustom = localStorage.getItem('roweos_helix_custom_colors');
      if (savedCustom) { try { _helixCustomColors = JSON.parse(savedCustom); } catch(e) {} }
    }
    var bc = document.getElementById('blobContainer');
    var hc = document.getElementById('helixContainer');
    if (bc) bc.style.display = 'none';
    if (hc) hc.style.display = '';
    if (typeof initHelix === 'function') initHelix();
    return;
  }
  _blobShapeTarget = BLOB_SHAPES[_blobCurrentShape];

  // Shader uniforms
  var colors = getBlobColors();
  var shape = _blobShapeTarget;
  _blobUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(colors.color) },
    uColorB: { value: (function() { var c = new THREE.Color(colors.colorB || colors.color); if (!colors.colorB) { try { c.offsetHSL(0.08, 0, 0.15); } catch(e) {} } return c; })() },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uNoiseAmp: { value: shape.amp },
    uNoiseFreq: { value: shape.freq },
    uSpeed: { value: shape.speed },
    uDetailMix: { value: shape.detail },
    uFresnelPower: { value: shape.fresnel },
    uOpacity: { value: 0.92 }
  };

  // v24.20: Read shaders from DOM script tags (minifier-safe)
  var vertexShader = document.getElementById('blobVertexShader').textContent;
  var fragmentShader = document.getElementById('blobFragmentShader').textContent;

  // Geometry - high-poly sphere for smooth deformation
  var geometry = new THREE.IcosahedronGeometry(1, 5);

  var material = new THREE.ShaderMaterial({
    uniforms: _blobUniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  _blobMesh = new THREE.Mesh(geometry, material);
  _blobScene.add(_blobMesh);

  // Initial render
  _blobRenderer.render(_blobScene, _blobCamera);

  // Mouse tracking
  container.addEventListener('mousemove', function(e) {
    var rect = container.getBoundingClientRect();
    _blobMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _blobMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  });
  container.addEventListener('mouseleave', function() {
    _blobMouse.x = 0;
    _blobMouse.y = 0;
  });
  // Touch
  container.addEventListener('touchmove', function(e) {
    var rect = container.getBoundingClientRect();
    var touch = e.touches[0];
    _blobMouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    _blobMouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
  }, { passive: true });

  _blobInitialized = true;
  startBlobAnimation();
}

// v24.21: Get accent color for current mode (brand or life)
function getBlobColor() {
  var root = document.documentElement;
  var isLife = root.classList.contains('life-mode');
  var prop = isLife ? '--life-accent' : '--brand-accent';
  var accent = getComputedStyle(root).getPropertyValue(prop).trim();
  return accent || '#a89878';
}

// v24.21: Get blob colors - respects light/dark mode, custom gradient, or brand accent
function getBlobColors() {
  var isLight = document.documentElement.classList.contains('light-mode');
  var suffix = isLight ? '_light' : '_dark';
  var c1 = localStorage.getItem('roweos_blob_color1' + suffix);
  var c2 = localStorage.getItem('roweos_blob_color2' + suffix);
  if (c1) return { color: c1, colorB: c2 || c1 };
  // Fallback to brand/life accent
  var base = getBlobColor();
  return { color: base, colorB: null }; // null = auto-derive
}

function updateBlobColor() {
  if (!_blobUniforms) return;

  var colors = getBlobColors();
  _blobUniforms.uColor.value.set(colors.color);
  if (colors.colorB) {
    _blobUniforms.uColorB.value.set(colors.colorB);
  } else {
    _blobUniforms.uColorB.value.set(colors.color);
    try { _blobUniforms.uColorB.value.offsetHSL(0.08, 0, 0.15); } catch(e) { _blobUniforms.uColorB.value.multiplyScalar(1.3); }
  }
}

function setBlobState(state) {
  _blobState = state;
}

// v24.24: Blob shape names for cycling (excludes 'none' and 'helix')
var _blobShapeNames = ['smooth', 'fluid', 'organic', 'crystal', 'sphere'];

// v26.5: Advanced Web Search module - reusable deep crawl + AI analysis pipeline
var _webSearchState = {
  status: 'idle', // idle|discovering|crawling|analyzing|searching|synthesizing|complete|error
  url: '',
  provider: '',
  apiKey: '',
  model: '',
  brandName: '',
  mode: 'brand', // brand|life
  pages: [],
  gapAnalysis: null,
  externalResults: '',
  finalResults: null,
  error: null,
  _callbacks: { onProgress: null, onComplete: null, onError: null },
  _aborted: false
};

function startWebSearch(url, provider, apiKey, model, brandName, mode, callbacks, context) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = url.replace(/\/+$/, '');
  _webSearchState = {
    status: 'discovering',
    url: url, provider: provider, apiKey: apiKey, model: model,
    brandName: brandName, mode: mode || 'brand',
    researchContext: context || '', // v27.0: Optional research focus/guidance
    pages: [], gapAnalysis: null, externalResults: '', finalResults: null,
    error: null, _callbacks: callbacks || {}, _aborted: false
  };
  _saveWebSearchState();
  _fireProgress('discovering', 'Discovering pages...');
  _wsStage1Discover(url);
}

function cancelWebSearch() {
  _webSearchState._aborted = true;
  _webSearchState.status = 'idle';
  localStorage.removeItem('roweos_web_import_state');
}

function getWebSearchState() { return _webSearchState; }

function _fireProgress(status, message) {
  _webSearchState.status = status;
  if (_webSearchState._callbacks.onProgress) _webSearchState._callbacks.onProgress(_webSearchState, message);
}

function _saveWebSearchState() {
  try {
    var toSave = { status: _webSearchState.status, url: _webSearchState.url, provider: _webSearchState.provider, brandName: _webSearchState.brandName, mode: _webSearchState.mode,
      pages: _webSearchState.pages.map(function(p) { return { url: p.url, title: p.title, status: p.status, depth: p.depth, priority: p.priority }; })
    };
    localStorage.setItem('roweos_web_import_state', JSON.stringify(toSave));
  } catch (e) {}
}

async function _wsStage1Discover(url) {
  if (_webSearchState._aborted) return;
  try {
    var resp = await fetch('/api/fetch-site-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, mode: 'deep' })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    if (data.error) throw new Error(data.error);
    _webSearchState.pages.push({ url: data.url || url, title: data.title || '', content: data.content || '', status: 'done', depth: 0, priority: 0 });
    var links = data.links || [];
    for (var i = 0; i < links.length && i < 20; i++) {
      _webSearchState.pages.push({ url: links[i].url, title: links[i].text || '', content: '', status: 'pending', depth: 1, priority: links[i].priority || 5 });
    }
    _saveWebSearchState();
    _fireProgress('crawling', 'Found ' + links.length + ' pages. Crawling...');
    _wsStage2Crawl();
  } catch (err) {
    _webSearchState.error = err.message;
    _fireProgress('error', 'Failed to reach website: ' + err.message);
    if (_webSearchState._callbacks.onError) _webSearchState._callbacks.onError(err);
  }
}

async function _wsStage2Crawl() {
  if (_webSearchState._aborted) return;
  var pending = _webSearchState.pages.filter(function(p) { return p.status === 'pending'; });
  var batchSize = 5;
  var totalCrawled = 1;
  var maxPages = 20;
  while (pending.length > 0 && totalCrawled < maxPages) {
    if (_webSearchState._aborted) return;
    var batch = pending.splice(0, batchSize);
    var promises = batch.map(function(page) {
      page.status = 'fetching';
      _fireProgress('crawling', 'Crawling ' + totalCrawled + ' of ' + Math.min(_webSearchState.pages.length, maxPages) + ' pages...');
      return fetch('/api/fetch-site-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: page.url, mode: 'content' })
      }).then(function(r) { return r.json(); }).then(function(data) {
        page.content = data.content || '';
        page.title = data.title || page.title;
        page.status = 'done';
        totalCrawled++;
        _saveWebSearchState();
        _fireProgress('crawling', 'Crawled ' + totalCrawled + ' pages...');
      }).catch(function(err) {
        page.status = 'error';
        page.content = '';
      });
    });
    await Promise.all(promises);
    pending = _webSearchState.pages.filter(function(p) { return p.status === 'pending'; });
  }
  _webSearchState.pages.forEach(function(p) { if (p.status === 'pending') p.status = 'error'; });
  _saveWebSearchState();
  _fireProgress('analyzing', 'Analyzing content...');
  _wsStage3GapAnalysis();
}

async function _wsStage3GapAnalysis() {
  if (_webSearchState._aborted) return;
  var allContent = _webSearchState.pages
    .filter(function(p) { return p.status === 'done' && p.content; })
    .map(function(p) { return '--- PAGE: ' + p.url + ' ---\n' + p.content; })
    .join('\n\n');
  var maxChars = _webSearchState.provider === 'google' ? 100000 : (_webSearchState.provider === 'anthropic' ? 80000 : 60000);
  if (allContent.length > maxChars) allContent = allContent.substring(0, maxChars);

  var sections = _webSearchState.mode === 'brand'
    ? ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive']
    : ['role', 'skills', 'communication', 'interests', 'goals', 'routine', 'personality'];
  var sectionLabels = _webSearchState.mode === 'brand'
    ? { essence: 'Brand Essence', voice: 'Voice & Tone', audience: 'Target Audience', messaging: 'Key Messaging', products: 'Products & Services', visual: 'Visual Identity', competitive: 'Competitive Positioning' }
    : { role: 'Role & Profession', skills: 'Skills & Expertise', communication: 'Communication Style', interests: 'Interests & Passions', goals: 'Goals', routine: 'Daily Routine', personality: 'Personality Traits' };

  var _rcx = _webSearchState.researchContext ? '\n\nRESEARCH FOCUS: The user has asked you to pay special attention to: ' + _webSearchState.researchContext + '\nPrioritize finding information related to this focus.\n' : '';
  var prompt = 'You are analyzing website content for a ' + (_webSearchState.mode === 'brand' ? 'brand' : 'person') + ' called "' + _webSearchState.brandName + '" (URL: ' + _webSearchState.url + ').' + _rcx + '\n\n'
    + 'Here is the scraped content from their website:\n\n' + allContent + '\n\n'
    + 'Assess which of these identity sections have strong data coverage from the website content, which are partially covered, and which are missing entirely:\n'
    + sections.map(function(s) { return '- ' + sectionLabels[s]; }).join('\n') + '\n\n'
    + 'Return ONLY valid JSON in this exact format (no markdown, no code blocks):\n'
    + '{"covered":["section_key",...],"partial":["section_key",...],"missing":["section_key",...],"searchQueries":["query 1","query 2","query 3"]}\n\n'
    + 'The searchQueries should be web search queries to find information about the missing/partial sections. Use the brand name in queries. Max 5 queries.';

  try {
    var gapResult = await _wsCallAI(prompt, false);
    var jsonMatch = gapResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      _webSearchState.gapAnalysis = JSON.parse(jsonMatch[0]);
    } else { throw new Error('No JSON in gap analysis response'); }
    _saveWebSearchState();
    _fireProgress('searching', 'Searching the web for additional info...');
    _wsStage4WebSearch();
  } catch (err) {
    console.warn('[WebSearch] Gap analysis failed, skipping to synthesis:', err.message);
    _webSearchState.gapAnalysis = { covered: [], partial: [], missing: sections, searchQueries: [] };
    _fireProgress('synthesizing', 'Synthesizing brand identity...');
    _wsStage5Synthesis();
  }
}

async function _wsStage4WebSearch() {
  if (_webSearchState._aborted) return;
  var gap = _webSearchState.gapAnalysis;
  if (!gap || (!gap.missing.length && !gap.partial.length) || !gap.searchQueries || !gap.searchQueries.length) {
    _fireProgress('synthesizing', 'Synthesizing identity...');
    _wsStage5Synthesis();
    return;
  }
  var prompt = 'You are researching a ' + (_webSearchState.mode === 'brand' ? 'brand' : 'person') + ' called "' + _webSearchState.brandName + '" (website: ' + _webSearchState.url + ').\n\n'
    + 'I need you to search the web for information about these aspects that are missing or incomplete from their website:\n'
    + gap.searchQueries.map(function(q, i) { return (i + 1) + '. ' + q; }).join('\n') + '\n\n'
    + 'Search for each query and compile your findings. Focus on factual information -- reviews, press mentions, competitor comparisons, social media presence, and public perception.\n\n'
    + 'Return your findings organized by topic. Be specific and cite sources where possible.';
  try {
    var searchResult = await _wsCallAI(prompt, true);
    _webSearchState.externalResults = searchResult;
    var extPages = (gap.searchQueries || []).slice(0, 5);
    for (var ei = 0; ei < extPages.length; ei++) {
      _webSearchState.pages.push({ url: 'search://' + extPages[ei].substring(0, 40), title: extPages[ei], content: '', status: 'done', depth: 2, priority: 6, isExternal: true });
    }
    _saveWebSearchState();
    _fireProgress('synthesizing', 'Synthesizing identity...');
    _wsStage5Synthesis();
  } catch (err) {
    console.warn('[WebSearch] Web search failed, continuing with scraped data:', err.message);
    _fireProgress('synthesizing', 'Synthesizing identity...');
    _wsStage5Synthesis();
  }
}

async function _wsStage5Synthesis() {
  if (_webSearchState._aborted) return;
  var allContent = _webSearchState.pages
    .filter(function(p) { return p.status === 'done' && p.content && !p.isExternal; })
    .map(function(p) { return '--- ' + p.url + ' ---\n' + p.content; })
    .join('\n\n');
  var maxChars = _webSearchState.provider === 'google' ? 100000 : (_webSearchState.provider === 'anthropic' ? 80000 : 60000);
  var extLen = (_webSearchState.externalResults || '').length;
  var contentBudget = maxChars - extLen - 3000;
  if (allContent.length > contentBudget) allContent = allContent.substring(0, contentBudget);

  var isBrand = _webSearchState.mode === 'brand';
  var sectionsJson = isBrand
    ? '{"essence":"...","voice":"...","audience":"...","messaging":"...","products":"...","visual":"...","competitive":"..."}'
    : '{"role":"...","skills":"...","communication":"...","interests":"...","goals":"...","routine":"...","personality":"..."}';
  var _rcx5 = _webSearchState.researchContext ? '\nRESEARCH FOCUS: The user wants special attention to: ' + _webSearchState.researchContext + '\nEnsure the relevant sections are especially detailed on this topic.\n' : '';
  var prompt = 'You are a ' + (isBrand ? 'brand strategist' : 'personal branding expert') + ' creating a comprehensive identity profile for "' + _webSearchState.brandName + '".' + _rcx5 + '\n\n'
    + 'WEBSITE CONTENT:\n' + allContent + '\n\n';
  if (_webSearchState.externalResults) prompt += 'EXTERNAL RESEARCH:\n' + _webSearchState.externalResults + '\n\n';
  prompt += 'Synthesize all information into a polished identity profile. Write 2-4 paragraphs for each section. Be specific to this ' + (isBrand ? 'brand' : 'person') + ' -- no generic filler. Professional tone.\n\n'
    + 'Return ONLY valid JSON (no markdown, no code blocks) in this exact format:\n' + sectionsJson + '\n\nEach value should be 2-4 paragraphs of rich, specific content.';
  try {
    var result = await _wsCallAI(prompt, false);
    var jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in synthesis response');
    _webSearchState.finalResults = JSON.parse(jsonMatch[0]);
    _webSearchState.status = 'complete';
    _saveWebSearchState();
    _fireProgress('complete', 'Identity profile complete!');
    if (_webSearchState._callbacks.onComplete) _webSearchState._callbacks.onComplete(_webSearchState.finalResults);
  } catch (err) {
    _webSearchState.error = err.message;
    _fireProgress('error', 'Synthesis failed: ' + err.message);
    if (_webSearchState._callbacks.onError) _webSearchState._callbacks.onError(err);
  }
  localStorage.removeItem('roweos_web_import_state');
}

async function _wsCallAI(prompt, enableWebSearch, _retryCount) {
  var provider = _webSearchState.provider;
  var apiKey = _webSearchState.apiKey;
  // v27.0: Force known-good model names at call time
  var model;
  if (provider === 'anthropic') model = 'claude-sonnet-4-6';
  else if (provider === 'openai') model = 'gpt-5.5';
  else if (provider === 'google') model = 'gemini-3.1-pro-preview';
  else model = _webSearchState.model;
  _retryCount = _retryCount || 0;
  try {
    if (provider === 'anthropic') return await _wsCallClaude(prompt, apiKey, model, enableWebSearch);
    else if (provider === 'openai') return await _wsCallGPT(prompt, apiKey, model, enableWebSearch);
    else if (provider === 'google') return await _wsCallGemini(prompt, apiKey, model, enableWebSearch);
    throw new Error('Unknown provider: ' + provider);
  } catch (err) {
    var errMsg = err.message || '';
    // v28.4: Detect billing/auth errors and failover to another provider
    var isBillingError = errMsg.indexOf('credit balance') !== -1 || errMsg.indexOf('billing') !== -1 ||
      errMsg.indexOf('quota') !== -1 || errMsg.indexOf('rate_limit') !== -1 ||
      errMsg.indexOf('402') !== -1 || errMsg.indexOf('429') !== -1 ||
      (errMsg.indexOf('400') !== -1 && errMsg.indexOf('invalid_request') !== -1);
    if (isBillingError && !_webSearchState._aborted) {
      console.warn('[WebSearch] Provider ' + provider + ' billing/quota error, trying failover...');
      showToast(provider + ' API limit reached, switching provider...', 'warning');
      var _allProviders = ['anthropic', 'openai', 'google'];
      var _triedProviders = _webSearchState._triedProviders || [provider];
      for (var _fi = 0; _fi < _allProviders.length; _fi++) {
        var _alt = _allProviders[_fi];
        if (_triedProviders.indexOf(_alt) !== -1) continue;
        var _altKey = '';
        try { _altKey = await (typeof getApiKey === 'function' ? getApiKey(_alt) : Promise.resolve('')); } catch(e) {}
        if (_altKey) {
          _triedProviders.push(_alt);
          _webSearchState._triedProviders = _triedProviders;
          _webSearchState.provider = _alt;
          _webSearchState.apiKey = _altKey;
          console.log('[WebSearch] Failing over to ' + _alt);
          showToast('Switched to ' + _alt + ' for research', 'info');
          return _wsCallAI(prompt, enableWebSearch, 0);
        }
      }
      // All providers tried
      throw new Error('All API providers failed (tried: ' + _triedProviders.join(', ') + '). Check API key balances in Settings.');
    }
    // Non-billing error: retry same provider with backoff
    console.error('[WebSearch] AI call failed (attempt ' + (_retryCount + 1) + '/3):', errMsg);
    if (_retryCount < 2 && !_webSearchState._aborted) {
      var delay = Math.pow(2, _retryCount + 1) * 1000;
      await new Promise(function(resolve) { setTimeout(resolve, delay); });
      return _wsCallAI(prompt, enableWebSearch, _retryCount + 1);
    }
    throw err;
  }
}

async function _wsCallClaude(prompt, apiKey, model, enableWebSearch) {
  // v27.0: Always use known-good model name (brandSettings may have truncated values like "claude-son")
  var safeModel = (model && model.indexOf('claude-') === 0 && model.length > 12) ? model : 'claude-sonnet-4-6';
  var body = { model: safeModel, max_tokens: 8192, messages: [{ role: 'user', content: prompt }] };
  if (enableWebSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];
  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) { var errText = await resp.text(); throw new Error('Claude API error: ' + resp.status + ' ' + errText.substring(0, 200)); }
  var data = await resp.json();
  var text = '';
  if (data.content) { for (var i = 0; i < data.content.length; i++) { if (data.content[i].type === 'text') text += data.content[i].text; } }
  return text;
}

async function _wsCallGPT(prompt, apiKey, model, enableWebSearch) {
  var body = { model: model || 'gpt-5.5', messages: [{ role: 'user', content: prompt }], max_tokens: 8192 };
  if (enableWebSearch) body.tools = [{ type: 'web_search_preview' }];
  var resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify(body)
  });
  if (!resp.ok) { var errText = await resp.text(); throw new Error('GPT API error: ' + resp.status + ' ' + errText.substring(0, 200)); }
  var data = await resp.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

async function _wsCallGemini(prompt, apiKey, model, enableWebSearch) {
  var gemModel = model || 'gemini-3.1-pro-preview';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + gemModel + ':generateContent?key=' + apiKey;
  var body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8192 } };
  if (enableWebSearch) body.tools = [{ googleSearch: {} }];
  var resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) { var errText = await resp.text(); throw new Error('Gemini API error: ' + resp.status + ' ' + errText.substring(0, 200)); }
  var data = await resp.json();
  var text = '';
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    data.candidates[0].content.parts.forEach(function(p) { if (p.text) text += p.text; });
  }
  return text;
}

// v26.5: WebSearchVisualizer - network graph + identity cards + floating pill
var _wsGraphNodes = [];
var _wsGraphAnimId = null;

function renderNetworkGraph(canvasEl, state) {
  if (!canvasEl) return;
  var ctx = canvasEl.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasEl.width = canvasEl.offsetWidth * dpr;
  canvasEl.height = canvasEl.offsetHeight * dpr;
  var cw = canvasEl.width / dpr;
  var ch = canvasEl.height / dpr;

  _wsGraphNodes = [];
  var pages = state.pages || [];
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    var angle = (i === 0) ? 0 : ((i / pages.length) * Math.PI * 2 + Math.random() * 0.3);
    var dist = p.depth === 0 ? 0 : (p.depth === 1 ? 80 + Math.random() * 40 : 140 + Math.random() * 30);
    _wsGraphNodes.push({
      x: cw / 2 + Math.cos(angle) * dist,
      y: ch / 2 + Math.sin(angle) * dist,
      tx: cw / 2 + Math.cos(angle) * dist,
      ty: ch / 2 + Math.sin(angle) * dist,
      url: p.url, title: p.title, status: p.status, depth: p.depth,
      isExternal: p.isExternal || false,
      radius: p.depth === 0 ? 8 : (p.depth === 1 ? 5 : 3)
    });
  }

  if (_wsGraphAnimId) cancelAnimationFrame(_wsGraphAnimId);

  function drawGraph() {
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Draw edges
    for (var i = 1; i < _wsGraphNodes.length; i++) {
      var node = _wsGraphNodes[i];
      var parent = _wsGraphNodes[0];
      ctx.beginPath();
      ctx.moveTo(parent.x, parent.y);
      ctx.lineTo(node.x, node.y);
      if (node.isExternal) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(120, 160, 200, 0.25)';
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(168, 152, 120, ' + (node.status === 'done' ? '0.35' : '0.12') + ')';
      }
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw nodes
    for (var j = 0; j < _wsGraphNodes.length; j++) {
      var n = _wsGraphNodes[j];
      n.x += (n.tx - n.x) * 0.05;
      n.y += (n.ty - n.y) * 0.05;
      var alpha = n.status === 'done' ? 0.9 : (n.status === 'fetching' ? 0.6 : 0.25);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = n.isExternal ? 'rgba(120, 160, 200, ' + alpha + ')' : 'rgba(168, 152, 120, ' + alpha + ')';
      ctx.fill();

      if (n.status === 'fetching') {
        var pulseR = n.radius + 4 + Math.sin(Date.now() * 0.005) * 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(168, 152, 120, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (n.depth <= 1 && n.status === 'done') {
        var label;
        try { label = n.depth === 0 ? (new URL(n.url)).hostname : ('/' + n.url.split('/').slice(3).join('/')); } catch(e) { label = n.url; }
        if (label.length > 20) label = label.substring(0, 20) + '...';
        ctx.fillStyle = 'rgba(150, 140, 125, 0.6)';
        ctx.font = '9px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, n.x, n.y + n.radius + 12);
      }
    }

    if (_wsGraphNodes.length > 0 && (state.status === 'discovering' || state.status === 'crawling')) {
      var cn = _wsGraphNodes[0];
      var pr = cn.radius + 6 + Math.sin(Date.now() * 0.003) * 3;
      ctx.beginPath();
      ctx.arc(cn.x, cn.y, pr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168, 152, 120, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
    _wsGraphAnimId = requestAnimationFrame(drawGraph);
  }
  drawGraph();
}

// v26.5: Collapse all nodes to center, then fade to summary
function collapseNetworkGraph(canvasEl, state, onDone) {
  if (!canvasEl || !_wsGraphNodes.length) { if (onDone) onDone(); return; }
  var cw = canvasEl.offsetWidth;
  var ch = canvasEl.offsetHeight;
  var cx = cw / 2;
  var cy = ch / 2;
  // Set all targets to center
  for (var i = 0; i < _wsGraphNodes.length; i++) {
    _wsGraphNodes[i].tx = cx;
    _wsGraphNodes[i].ty = cy;
  }
  // Wait for collapse (nodes lerp at 0.05 per frame, ~60 frames to converge)
  var collapseStart = Date.now();
  var checkCollapse = setInterval(function() {
    var elapsed = Date.now() - collapseStart;
    if (elapsed > 1500) {
      clearInterval(checkCollapse);
      stopNetworkGraph();
      // Fade canvas out
      canvasEl.style.transition = 'opacity 0.5s ease';
      canvasEl.style.opacity = '0';
      setTimeout(function() {
        if (onDone) onDone();
      }, 500);
    }
  }, 100);
}

function stopNetworkGraph() {
  if (_wsGraphAnimId) { cancelAnimationFrame(_wsGraphAnimId); _wsGraphAnimId = null; }
}

function renderIdentityCards(containerEl, state) {
  if (!containerEl) return;
  var isBrand = state.mode === 'brand';
  var sections = isBrand
    ? [
        { key: 'essence', label: 'Brand Essence', icon: '\u2726' },
        { key: 'voice', label: 'Voice & Tone', icon: '\u25CE' },
        { key: 'audience', label: 'Target Audience', icon: '\u25C7' },
        { key: 'messaging', label: 'Key Messaging', icon: '\u25C6' },
        { key: 'products', label: 'Products & Services', icon: '\u25A3' },
        { key: 'visual', label: 'Visual Identity', icon: '\u2727' },
        { key: 'competitive', label: 'Competitive Positioning', icon: '\u2B21' }
      ]
    : [
        { key: 'role', label: 'Role & Profession', icon: '\u25CE' },
        { key: 'skills', label: 'Skills & Expertise', icon: '\u2726' },
        { key: 'communication', label: 'Communication Style', icon: '\u25C7' },
        { key: 'interests', label: 'Interests & Passions', icon: '\u25C6' },
        { key: 'goals', label: 'Goals', icon: '\u25A3' },
        { key: 'routine', label: 'Daily Routine', icon: '\u2727' },
        { key: 'personality', label: 'Personality Traits', icon: '\u2B21' }
      ];

  var html = '';
  for (var i = 0; i < sections.length; i++) {
    var s = sections[i];
    var filled = state.finalResults && state.finalResults[s.key];
    var analyzing = state.status === 'synthesizing' || state.status === 'analyzing' || state.status === 'searching';
    var cssClass = filled ? 'filled' : (analyzing ? 'analyzing' : '');
    html += '<div class="ws-identity-card ' + cssClass + '" data-section="' + s.key + '">';
    html += '<div class="ws-card-label">' + s.icon + ' ' + s.label + '</div>';
    if (filled) {
      var content = state.finalResults[s.key];
      if (content.length > 200) content = content.substring(0, 200) + '...';
      html += '<div class="ws-card-content">' + content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
    } else if (analyzing) {
      html += '<div class="ws-card-status">Analyzing...</div>';
    } else {
      html += '<div class="ws-card-status">Waiting...</div>';
    }
    html += '</div>';
  }
  containerEl.innerHTML = html;
}

function renderFloatingIndicator(state) {
  var el = document.getElementById('webSearchFloatingIndicator');
  if (!el) return;
  if (state.status === 'idle') {
    el.classList.remove('visible');
    return;
  }
  el.classList.add('visible');
  var doneCount = state.pages.filter(function(p) { return p.status === 'done'; }).length;
  var totalCount = state.pages.length;
  var labelEl = el.querySelector('.ws-label');
  var countEl = el.querySelector('.ws-count');
  if (labelEl) {
    var labels = { discovering: 'DISCOVERING', crawling: 'SCANNING', analyzing: 'ANALYZING', searching: 'SEARCHING WEB', synthesizing: 'SYNTHESIZING', complete: 'COMPLETE', error: 'ISSUE' };
    labelEl.textContent = labels[state.status] || 'WORKING';
  }
  if (countEl) countEl.textContent = doneCount + ' of ' + totalCount + ' pages';
  var miniCanvas = el.querySelector('.ws-mini-canvas');
  if (miniCanvas) renderMiniGraph(miniCanvas, state);
}

function renderMiniGraph(canvas, state) {
  var ctx = canvas.getContext('2d');
  var s = 36;
  canvas.width = s * 2;
  canvas.height = s * 2;
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, s, s);
  var cx = s / 2, cy = s / 2;
  var pages = state.pages || [];
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#a89878';
  ctx.fill();
  for (var i = 1; i < Math.min(pages.length, 12); i++) {
    var angle = (i / Math.min(pages.length, 12)) * Math.PI * 2;
    var r = 10 + (pages[i].depth || 1) * 3;
    var nx = cx + Math.cos(angle) * r;
    var ny = cy + Math.sin(angle) * r;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = 'rgba(168, 152, 120, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(nx, ny, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = pages[i].status === 'done' ? 'rgba(168, 152, 120, 0.7)' : 'rgba(168, 152, 120, 0.2)';
    ctx.fill();
  }
  var pulseR = 5 + Math.sin(Date.now() * 0.004) * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(168, 152, 120, 0.15)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

// v24.21: Set blob shape preset (including 'none' and 'helix')
function setBlobShape(shapeName) {
  // v24.27: Handle "both" mode - delegate to setBothAmbient
  if (shapeName === 'both') { setBothAmbient(); return; }
  if (shapeName !== 'helix' && !(shapeName in BLOB_SHAPES)) return;
  // v24.27: Check if "both" mode is active - preserve it when changing blob sub-shape
  var _isBothMode = (localStorage.getItem('roweos_blob_shape') === 'both');
  _blobCurrentShape = shapeName;
  if (shapeName !== 'helix' && shapeName !== 'none') _blobShapeTarget = BLOB_SHAPES[shapeName];
  // Only overwrite localStorage BEFORE updateBlobColor (it reads shape from localStorage)
  if (!_isBothMode || shapeName === 'none' || shapeName === 'helix') {
    localStorage.setItem('roweos_blob_shape', shapeName);
  } else {
    localStorage.setItem('roweos_blob_last_shape', shapeName);
  }
  if (typeof updateBlobColor === 'function') updateBlobColor();
  // Sync blob shape to Firestore
  if (typeof syncLifeAIToFirestore === 'function') {
    syncLifeAIToFirestore({ blobShape: shapeName });
  }
  var blobC = document.getElementById('blobContainer');
  var helixC = document.getElementById('helixContainer');
  var title = document.getElementById('desktopPlatformTitle');
  var group = document.getElementById('blobTitleGroup');
  if (shapeName === 'none') {
    if (blobC) blobC.style.display = 'none';
    if (helixC) helixC.style.display = 'none';
    if (typeof stopHelix === 'function') stopHelix();
    if (title) { title.style.marginTop = '0'; title.style.fontSize = ''; }
    if (group) group.style.marginTop = '-60px';
  } else if (shapeName === 'helix') {
    if (blobC) blobC.style.display = 'none';
    if (helixC) helixC.style.display = '';
    if (_blobAnimId) { cancelAnimationFrame(_blobAnimId); _blobAnimId = null; }
    if (!_helixInitialized) { if (typeof initHelix === 'function') initHelix(); }
    else if (!_helixAnimId) { if (typeof startHelixAnimation === 'function') startHelixAnimation(); }
    if (title) { title.style.marginTop = ''; title.style.fontSize = ''; }
    var savedOffset = localStorage.getItem('roweos_blob_vertical_offset');
    if (group) group.style.marginTop = (savedOffset !== null ? savedOffset : (window.innerWidth <= 768 ? -400 : -350)) + 'px';
  } else {
    if (blobC) blobC.style.display = '';
    // v24.27: Keep helix visible in "both" mode
    if (_isBothMode) {
      if (helixC) helixC.style.display = '';
      if (!_helixInitialized) { if (typeof initHelix === 'function') initHelix(); }
      else if (!_helixAnimId) { if (typeof startHelixAnimation === 'function') startHelixAnimation(); }
    } else {
      if (helixC) helixC.style.display = 'none';
      if (typeof stopHelix === 'function') stopHelix();
    }
    // v24.25: Re-init blob if it was never fully built (e.g. initial shape was helix/none)
    if (!_blobMesh) {
      _blobInitialized = false;
      if (typeof initBlob === 'function') initBlob();
    } else if (!_blobAnimId) {
      if (typeof startBlobAnimation === 'function') startBlobAnimation();
    }
    if (title) { title.style.marginTop = ''; title.style.fontSize = ''; }
    var savedOffset = localStorage.getItem('roweos_blob_vertical_offset');
    if (group) group.style.marginTop = (savedOffset !== null ? savedOffset : (window.innerWidth <= 768 ? -400 : -350)) + 'px';
  }
  // Update settings UI - blob shape buttons
  var btns = document.querySelectorAll('#blobShapeSelector .blob-shape-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-shape') === shapeName);
  }
  // v24.25: Helix toggle button state
  // v24.26: Helix button state managed by updateAmbientSubPanels()
  // v24.26: Show/hide helix vs blob customization sections + sub-panels
  var helixSection = document.getElementById('helixColorSection');
  var blobColorControls = document.getElementById('blobColorControls');
  var isBlob = (shapeName !== 'helix' && shapeName !== 'none');
  // Always show inner sections - parent panels control visibility
  if (helixSection) helixSection.style.display = '';
  if (blobColorControls) blobColorControls.style.display = isBlob ? '' : 'none';
  if (shapeName === 'helix') initHelixColorSettings();
  if (isBlob && typeof initBlobPresetUI === 'function') initBlobPresetUI();
  // v24.24: Switch preview thumbnail
  if (typeof updateAmbientPreviewVisibility === 'function') updateAmbientPreviewVisibility();
  // v24.25: Show/hide reduce-transparency button
  if (typeof updateHelixDimBtn === 'function') updateHelixDimBtn();
  // v24.26: Update sub-option panels
  if (typeof updateAmbientSubPanels === 'function') updateAmbientSubPanels();
}

// v24.26: Open B.L.A.K.E. shape options - select crystal if currently none/helix
function openBlakeShapes() {
  if (_blobCurrentShape === 'none' || _blobCurrentShape === 'helix') {
    setBlobShape('crystal');
  }
  updateAmbientSubPanels();
}

// v24.26: Update sub-option panel visibility based on current shape
function updateAmbientSubPanels() {
  var blakeSub = document.getElementById('blakeSubOptions');
  var helixSub = document.getElementById('helixSubOptions');
  var savedShape = localStorage.getItem('roweos_blob_shape');
  var isBoth = (savedShape === 'both');
  var isBlob = isBoth || (_blobCurrentShape !== 'helix' && _blobCurrentShape !== 'none');
  var isHelix = isBoth || (_blobCurrentShape === 'helix');
  if (blakeSub) blakeSub.style.display = isBlob ? '' : 'none';
  if (helixSub) helixSub.style.display = isHelix ? '' : 'none';
  // Update shape type buttons
  var typeBtns = document.querySelectorAll('[data-shape="none"],[data-shape="blake"],[data-shape="helix"],[data-shape="both"]');
  for (var i = 0; i < typeBtns.length; i++) {
    var s = typeBtns[i].getAttribute('data-shape');
    typeBtns[i].classList.toggle('active', (s === 'both' && isBoth) || (s === 'none' && _blobCurrentShape === 'none' && !isBoth) || (s === 'blake' && isBlob && !isBoth && !isHelix) || (s === 'helix' && _blobCurrentShape === 'helix' && !isBoth));
  }
  // Update live preview
  var previewBlake = document.getElementById('blobPreviewCanvas');
  var previewHelix = document.getElementById('helixPreviewCanvas');
  var previewNone = document.getElementById('ambientPreviewNone');
  if (previewBlake) previewBlake.style.display = isBlob ? '' : 'none';
  if (previewHelix) previewHelix.style.display = isHelix ? '' : 'none';
  if (previewNone) previewNone.style.display = (!isBlob && !isHelix) ? '' : 'none';
}

// v24.27: Enable both B.L.A.K.E. and Helix at the same time
function setBothAmbient() {
  _blobCurrentShape = localStorage.getItem('roweos_blob_last_shape') || 'crystal';
  if (_blobCurrentShape === 'none' || _blobCurrentShape === 'helix' || _blobCurrentShape === 'both') _blobCurrentShape = 'crystal';
  _blobShapeTarget = BLOB_SHAPES[_blobCurrentShape] || BLOB_SHAPES.crystal;
  localStorage.setItem('roweos_blob_shape', 'both');
  localStorage.setItem('roweos_blob_last_shape', _blobCurrentShape);
  var blobC = document.getElementById('blobContainer');
  var helixC = document.getElementById('helixContainer');
  var group = document.getElementById('blobTitleGroup');
  // Show BOTH
  if (blobC) blobC.style.display = '';
  if (helixC) helixC.style.display = '';
  // Init blob if needed
  if (!_blobMesh) { _blobInitialized = false; if (typeof initBlob === 'function') initBlob(); }
  else if (!_blobAnimId) { if (typeof startBlobAnimation === 'function') startBlobAnimation(); }
  // Init helix if needed
  if (!_helixInitialized) { if (typeof initHelix === 'function') initHelix(); }
  else if (!_helixAnimId) { if (typeof startHelixAnimation === 'function') startHelixAnimation(); }
  var savedOffset = localStorage.getItem('roweos_blob_vertical_offset');
  if (group) group.style.marginTop = (savedOffset !== null ? savedOffset : (window.innerWidth <= 768 ? -400 : -350)) + 'px';
  updateAmbientSubPanels();
  writeDB('profile/main', { blobShape: 'both' }); // v25.1
}

// v24.25: Toggle helix mode on/off
function toggleHelixMode() {
  if (_blobCurrentShape === 'helix') {
    setBlobShape('crystal'); // default blob shape when turning helix off
  } else {
    setBlobShape('helix');
  }
}

// v24.25: Reduce ambient shape transparency for readability
function toggleReduceAmbient() {
  var html = document.documentElement;
  var isReduced = html.classList.toggle('reduce-ambient');
  localStorage.setItem('roweos_reduce_ambient', isReduced ? '1' : '0');
  var btn = document.getElementById('helixDimBtn');
  if (btn) {
    if (isReduced) btn.classList.add('active');
    else btn.classList.remove('active');
  }
}

// v24.25: Show/hide reduce-ambient buttons (header + input bar)
function updateHelixDimBtn() {
  var shape = _blobCurrentShape || localStorage.getItem('roweos_blob_shape') || 'crystal';
  var show = (shape !== 'none');
  var isActive = localStorage.getItem('roweos_reduce_ambient') === '1';
  var btn = document.getElementById('helixDimBtn');
  if (btn) {
    btn.style.display = show ? 'flex' : 'none';
    if (isActive) btn.classList.add('active');
    else btn.classList.remove('active');
  }
}

// v24.24: Click blob to cycle through blob shapes (helix excluded - it's a separate mode)
function cycleBlobShape() {
  var current = _blobCurrentShape;
  if (current === 'none' || current === 'helix') return;

  var idx = _blobShapeNames.indexOf(current);
  var next = _blobShapeNames[(idx + 1) % _blobShapeNames.length];
  setBlobShape(next);
}

// v24.24: Blob vertical position slider
function setBlobVerticalOffset(val) {
  var v = parseInt(val);
  document.documentElement.style.setProperty('--blob-vertical-offset', v + 'px');
  var group = document.getElementById('blobTitleGroup');
  if (group) group.style.marginTop = v + 'px';
  localStorage.setItem('roweos_blob_vertical_offset', v);
  var label = document.getElementById('blobVerticalLabel');
  if (label) label.textContent = v === -300 ? 'Default' : v + 'px';
}

// v24.24: Blob text gap slider
function setBlobTextGap(val) {
  var v = parseInt(val);
  document.documentElement.style.setProperty('--blob-text-gap', v + 'px');
  localStorage.setItem('roweos_blob_text_gap', v);
  var label = document.getElementById('blobTextGapLabel');
  if (label) label.textContent = v === -20 ? 'Default' : v + 'px';
}

// v24.24: Init blob position sliders from localStorage
function initBlobPositionSliders() {
  var vOffset = localStorage.getItem('roweos_blob_vertical_offset');
  if (vOffset !== null) {
    var v = parseInt(vOffset);
    document.documentElement.style.setProperty('--blob-vertical-offset', v + 'px');
    var group = document.getElementById('blobTitleGroup');
    if (group && _blobCurrentShape !== 'none') group.style.marginTop = v + 'px';
    var slider = document.getElementById('blobVerticalSlider');
    if (slider) slider.value = v;
    var label = document.getElementById('blobVerticalLabel');
    if (label) label.textContent = v === -300 ? 'Default' : v + 'px';
  }
  var tGap = localStorage.getItem('roweos_blob_text_gap');
  if (tGap !== null) {
    var g = parseInt(tGap);
    document.documentElement.style.setProperty('--blob-text-gap', g + 'px');
    var slider2 = document.getElementById('blobTextGapSlider');
    if (slider2) slider2.value = g;
    var label2 = document.getElementById('blobTextGapLabel');
    if (label2) label2.textContent = g === -20 ? 'Default' : g + 'px';
  }
}

// v24.21: Set blob gradient colors (two pickers per mode)
function setBlobGradientColor(which, color) {
  var isLight = document.documentElement.classList.contains('light-mode');
  var suffix = isLight ? '_light' : '_dark';
  localStorage.setItem('roweos_blob_color' + which + suffix, color);
  localStorage.setItem('roweos_blob_preset', 'custom');
  updateBlobColor();
  if (typeof updateBlobPreviewColor === 'function') updateBlobPreviewColor();
}

function resetBlobColor() {
  localStorage.removeItem('roweos_blob_color1_dark');
  localStorage.removeItem('roweos_blob_color2_dark');
  localStorage.removeItem('roweos_blob_color1_light');
  localStorage.removeItem('roweos_blob_color2_light');
  localStorage.setItem('roweos_blob_preset', 'brand');
  updateBlobColor();
  if (typeof updateBlobPreviewColor === 'function') updateBlobPreviewColor();
  if (typeof initBlobPresetUI === 'function') initBlobPresetUI();
}

// v24.25: Blob color presets (dark/light pairs)
var BLOB_COLOR_PRESETS = {
  gold:     { dark: { c1: '#a89878', c2: '#c0a86e' }, light: { c1: '#8b7355', c2: '#a89060' } },
  aurora:   { dark: { c1: '#00e676', c2: '#00bcd4' }, light: { c1: '#00c853', c2: '#0097a7' } },
  sunset:   { dark: { c1: '#ff6b6b', c2: '#ffa726' }, light: { c1: '#d32f2f', c2: '#e65100' } },
  ocean:    { dark: { c1: '#0288d1', c2: '#00bcd4' }, light: { c1: '#01579b', c2: '#00838f' } },
  neon:     { dark: { c1: '#ff00ff', c2: '#00ffff' }, light: { c1: '#aa00ff', c2: '#00b8d4' } },
  ember:    { dark: { c1: '#4a1a0a', c2: '#e74c3c' }, light: { c1: '#922b21', c2: '#d35400' } },
  midnight: { dark: { c1: '#0d0d2b', c2: '#2d1b69' }, light: { c1: '#1a237e', c2: '#4527a0' } }
};

// v24.27: Unified ambient colors - sets both blob and helix together
var AMBIENT_COLOR_PRESETS = {
  gold: { c1: '#a89878', c2: '#c0a86e' },
  green: { c1: '#00e676', c2: '#00bcd4' },
  orange: { c1: '#ff6b6b', c2: '#ffa726' },
  teal: { c1: '#0288d1', c2: '#00bcd4' },
  purple: { c1: '#9c27b0', c2: '#7c4dff' },
  red: { c1: '#e74c3c', c2: '#ff5252' },
  pink: { c1: '#f8bbd0', c2: '#e1bee7' },
  blue: { c1: '#42a5f5', c2: '#1565c0' },
  cyan: { c1: '#00e5ff', c2: '#18ffff' }
};

function setUnifiedAmbientColor(name) {
  var preset = AMBIENT_COLOR_PRESETS[name];
  if (!preset) return;
  // Set blob colors for both dark and light modes
  localStorage.setItem('roweos_blob_color1_dark', preset.c1);
  localStorage.setItem('roweos_blob_color2_dark', preset.c2);
  localStorage.setItem('roweos_blob_color1_light', preset.c1);
  localStorage.setItem('roweos_blob_color2_light', preset.c2);
  localStorage.setItem('roweos_blob_preset', 'custom');
  if (typeof updateBlobColor === 'function') updateBlobColor();
  // Set helix - use matching preset if exists, otherwise set custom colors derived from swatch
  if (typeof HELIX_PRESETS !== 'undefined' && HELIX_PRESETS[name]) {
    if (typeof setHelixPreset === 'function') setHelixPreset(name);
  } else {
    // Generate 4 ribbon colors from the two swatch colors - set BEFORE calling setHelixPreset
    var customColors = [
      { a: preset.c1, b: preset.c2 },
      { a: preset.c2, b: preset.c1 },
      { a: preset.c1, b: preset.c1 },
      { a: preset.c2, b: preset.c2 }
    ];
    _helixCustomColors = customColors;
    localStorage.setItem('roweos_helix_custom_colors', JSON.stringify(customColors));
    if (typeof setHelixPreset === 'function') setHelixPreset('custom');
  }
  if (typeof applyHelixColors === 'function') applyHelixColors();
  if (typeof updateHelixColors === 'function') updateHelixColors();
  if (typeof updateBlobPreviewColor === 'function') updateBlobPreviewColor();
  // Update active swatch
  localStorage.setItem('roweos_ambient_color', name);
  var swatches = document.querySelectorAll('.ambient-color-swatch');
  for (var i = 0; i < swatches.length; i++) {
    swatches[i].classList.toggle('active', swatches[i].getAttribute('data-color') === name);
  }
  writeDB('profile/main', { ambientColor: name }); // v25.1
}

function setBlobPreset(preset) {
  localStorage.setItem('roweos_blob_preset', preset);
  var isLight = document.documentElement.classList.contains('light-mode');
  var suffix = isLight ? '_light' : '_dark';
  if (preset === 'brand') {
    // Remove custom colors, revert to accent
    localStorage.removeItem('roweos_blob_color1_dark');
    localStorage.removeItem('roweos_blob_color2_dark');
    localStorage.removeItem('roweos_blob_color1_light');
    localStorage.removeItem('roweos_blob_color2_light');
  } else if (preset === 'custom') {
    // Show custom pickers, don't change colors
  } else if (BLOB_COLOR_PRESETS[preset]) {
    var modeKey = isLight ? 'light' : 'dark';
    var colors = BLOB_COLOR_PRESETS[preset][modeKey];
    // Set for both modes
    var darkC = BLOB_COLOR_PRESETS[preset].dark;
    var lightC = BLOB_COLOR_PRESETS[preset].light;
    localStorage.setItem('roweos_blob_color1_dark', darkC.c1);
    localStorage.setItem('roweos_blob_color2_dark', darkC.c2);
    localStorage.setItem('roweos_blob_color1_light', lightC.c1);
    localStorage.setItem('roweos_blob_color2_light', lightC.c2);
  }
  updateBlobColor();
  if (typeof updateBlobPreviewColor === 'function') updateBlobPreviewColor();
  initBlobPresetUI();
}

function initBlobPresetUI() {
  var saved = localStorage.getItem('roweos_blob_preset') || 'brand';
  var btns = document.querySelectorAll('[data-blob-preset]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-blob-preset') === saved);
  }
  var customControls = document.getElementById('blobCustomColorControls');
  if (customControls) customControls.style.display = (saved === 'custom') ? '' : 'none';
  // Update pickers to current values
  var colors = getBlobColors();
  var p1 = document.getElementById('blobColorPicker1');
  var p2 = document.getElementById('blobColorPicker2');
  var modeLabel = document.getElementById('blobColorModeLabel');
  if (p1) p1.value = colors.color;
  if (p2) p2.value = colors.colorB || colors.color;
  if (modeLabel) modeLabel.textContent = document.documentElement.classList.contains('light-mode') ? 'Light mode' : 'Dark mode';
  // v24.27: Render unified ambient color swatches
  var swatchContainer = document.getElementById('ambientColorSwatches');
  if (swatchContainer) {
    var savedColor = localStorage.getItem('roweos_ambient_color') || 'gold';
    var swatchHtml = '';
    var colorKeys = ['gold', 'green', 'orange', 'teal', 'purple', 'red', 'pink', 'blue', 'cyan'];
    for (var sci = 0; sci < colorKeys.length; sci++) {
      var ck = colorKeys[sci];
      var cp = AMBIENT_COLOR_PRESETS[ck];
      if (cp) {
        swatchHtml += '<div class="ambient-color-swatch' + (ck === savedColor ? ' active' : '') + '" data-color="' + ck + '" style="background:linear-gradient(135deg,' + cp.c1 + ',' + cp.c2 + ');" onclick="setUnifiedAmbientColor(\'' + ck + '\')"></div>';
      }
    }
    swatchContainer.innerHTML = swatchHtml;
  }
}

// v24.21: Initialize blob settings UI
function initBlobSettings() {
  var saved = localStorage.getItem('roweos_blob_shape') || 'crystal';
  var btns = document.querySelectorAll('#blobShapeSelector .blob-shape-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-shape') === saved);
  }
  if (typeof initBlobPresetUI === 'function') initBlobPresetUI();
  if (typeof initBlobPositionSliders === 'function') initBlobPositionSliders();
  // Init mini preview - blob or helix depending on current shape
  setTimeout(function() {
    if (saved === 'both') {
      if (typeof initBlobPreview === 'function') initBlobPreview();
      if (typeof initHelixPreview === 'function') initHelixPreview();
    } else if (saved === 'helix') {
      if (typeof initHelixPreview === 'function') initHelixPreview();
    } else {
      if (typeof initBlobPreview === 'function') initBlobPreview();
    }
    if (typeof updateAmbientPreviewVisibility === 'function') updateAmbientPreviewVisibility();
  }, 100);
}

// v24.20: Mini blob preview for Settings
var _blobPreviewScene, _blobPreviewCamera, _blobPreviewRenderer, _blobPreviewMesh, _blobPreviewUniforms;
var _blobPreviewAnimId = null;
var _blobPreviewInitialized = false;

function initBlobPreview() {
  if (_blobPreviewInitialized) return;
  if (typeof THREE === 'undefined') return;
  var canvas = document.getElementById('blobPreviewCanvas');
  if (!canvas) return;
  var w = 80, h = 80;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  _blobPreviewScene = new THREE.Scene();
  _blobPreviewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  _blobPreviewCamera.position.z = 4;
  _blobPreviewRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  _blobPreviewRenderer.setSize(w, h);
  _blobPreviewRenderer.setPixelRatio(dpr);
  _blobPreviewRenderer.setClearColor(0x000000, 0);

  var previewColors = getBlobColors();
  var shape = _blobShapeTarget || BLOB_SHAPES.crystal;
  _blobPreviewUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(previewColors.color) },
    uColorB: { value: (function() { var c = new THREE.Color(previewColors.colorB || previewColors.color); if (!previewColors.colorB) { try { c.offsetHSL(0.08, 0, 0.15); } catch(e) {} } return c; })() },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uNoiseAmp: { value: shape.amp },
    uNoiseFreq: { value: shape.freq },
    uSpeed: { value: shape.speed },
    uDetailMix: { value: shape.detail },
    uFresnelPower: { value: shape.fresnel },
    uOpacity: { value: 0.92 }
  };

  var vertexShader = document.getElementById('blobVertexShader').textContent;
  var fragmentShader = document.getElementById('blobFragmentShader').textContent;
  var geometry = new THREE.IcosahedronGeometry(1, 4);
  var material = new THREE.ShaderMaterial({
    uniforms: _blobPreviewUniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  _blobPreviewMesh = new THREE.Mesh(geometry, material);
  _blobPreviewScene.add(_blobPreviewMesh);
  _blobPreviewInitialized = true;
  startBlobPreviewAnimation();
}

function startBlobPreviewAnimation() {
  if (_blobPreviewAnimId) return;
  var clock = new THREE.Clock();
  function animate() {
    _blobPreviewAnimId = requestAnimationFrame(animate);
    if (!_blobPreviewRenderer || !_blobPreviewScene || !_blobPreviewCamera) return;
    var dt = clock.getDelta();
    _blobPreviewUniforms.uTime.value += dt;
    _blobPreviewMesh.rotation.y += dt * 0.2;
    _blobPreviewMesh.rotation.x += dt * 0.1;
    // Lerp toward current shape
    var base = _blobShapeTarget;
    _blobPreviewUniforms.uNoiseAmp.value += (base.amp - _blobPreviewUniforms.uNoiseAmp.value) * 0.04;
    _blobPreviewUniforms.uSpeed.value += (base.speed - _blobPreviewUniforms.uSpeed.value) * 0.04;
    _blobPreviewUniforms.uNoiseFreq.value += (base.freq - _blobPreviewUniforms.uNoiseFreq.value) * 0.04;
    _blobPreviewUniforms.uDetailMix.value += (base.detail - _blobPreviewUniforms.uDetailMix.value) * 0.04;
    _blobPreviewUniforms.uFresnelPower.value += (base.fresnel - _blobPreviewUniforms.uFresnelPower.value) * 0.04;
    _blobPreviewRenderer.render(_blobPreviewScene, _blobPreviewCamera);
  }
  animate();
}

function stopBlobPreview() {
  if (_blobPreviewAnimId) {
    cancelAnimationFrame(_blobPreviewAnimId);
    _blobPreviewAnimId = null;
  }
}

// v24.24: Helix preview in settings
var _helixPreviewScene, _helixPreviewCamera, _helixPreviewRenderer;
var _helixPreviewAnimId = null;
var _helixPreviewInitialized = false;
var _helixPreviewUniforms = [];
var _helixPreviewGroup = null;

function initHelixPreview() {
  if (_helixPreviewInitialized) return;
  if (typeof THREE === 'undefined') return;
  var canvas = document.getElementById('helixPreviewCanvas');
  if (!canvas) return;
  var w = 80, h = 80;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  _helixPreviewScene = new THREE.Scene();
  _helixPreviewCamera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
  _helixPreviewCamera.position.z = 10;
  _helixPreviewRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  _helixPreviewRenderer.setSize(w, h);
  _helixPreviewRenderer.setPixelRatio(dpr);
  _helixPreviewRenderer.setClearColor(0x000000, 0);

  var vertexShader = document.getElementById('helixVertexShader').textContent;
  var fragmentShader = document.getElementById('helixFragmentShader').textContent;
  var colors = getHelixColors();
  _helixPreviewGroup = new THREE.Group();

  for (var i = 0; i < 4; i++) {
    var curve = generateHelixCurve(i);
    var geometry = new THREE.TubeGeometry(curve, 80, 1.1, 12, false);
    var uniforms = {
      uTime: { value: i * 2.0 },
      uColorA: { value: colors[i].a },
      uColorB: { value: colors[i].b },
      uOpacity: { value: 0.85 }
    };
    var material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(geometry, material);
    _helixPreviewGroup.add(mesh);
    _helixPreviewUniforms.push(uniforms);
  }

  _helixPreviewScene.add(_helixPreviewGroup);
  _helixPreviewInitialized = true;
  startHelixPreviewAnimation();
}

function startHelixPreviewAnimation() {
  if (_helixPreviewAnimId) return;
  var clock = new THREE.Clock();
  function animate() {
    _helixPreviewAnimId = requestAnimationFrame(animate);
    if (!_helixPreviewRenderer || !_helixPreviewScene || !_helixPreviewCamera) return;
    var dt = clock.getDelta();
    for (var i = 0; i < _helixPreviewUniforms.length; i++) {
      _helixPreviewUniforms[i].uTime.value += dt;
    }
    if (_helixPreviewGroup) {
      _helixPreviewGroup.rotation.z += dt * 0.03;
      _helixPreviewGroup.rotation.y += dt * 0.015;
    }
    _helixPreviewRenderer.render(_helixPreviewScene, _helixPreviewCamera);
  }
  animate();
}

function stopHelixPreview() {
  if (_helixPreviewAnimId) {
    cancelAnimationFrame(_helixPreviewAnimId);
    _helixPreviewAnimId = null;
  }
}

function updateHelixPreviewColors() {
  if (!_helixPreviewInitialized || _helixPreviewUniforms.length === 0) return;
  var colors = getHelixColors();
  for (var i = 0; i < _helixPreviewUniforms.length; i++) {
    _helixPreviewUniforms[i].uColorA.value.copy(colors[i].a);
    _helixPreviewUniforms[i].uColorB.value.copy(colors[i].b);
  }
}

// v24.24: Onboarding blob picker
var _onbBlobScene, _onbBlobCamera, _onbBlobRenderer, _onbBlobMesh, _onbBlobUniforms;
var _onbBlobAnimId = null;
var _onbBlobInitialized = false;

function initOnboardingBlobPreview() {
  if (_onbBlobInitialized) return;
  if (typeof THREE === 'undefined') return;
  var canvas = document.getElementById('onboardingBlobCanvas');
  if (!canvas) return;
  var w = 160, h = 160;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  _onbBlobScene = new THREE.Scene();
  _onbBlobCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  _onbBlobCamera.position.z = 4;
  _onbBlobRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  _onbBlobRenderer.setSize(w, h);
  _onbBlobRenderer.setPixelRatio(dpr);
  _onbBlobRenderer.setClearColor(0x000000, 0);

  var colors = getBlobColors();
  var saved = localStorage.getItem('roweos_blob_shape') || 'crystal';
  var shape = BLOB_SHAPES[saved] || BLOB_SHAPES.crystal;
  _onbBlobUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(colors.color) },
    uColorB: { value: (function() { var c = new THREE.Color(colors.colorB || colors.color); if (!colors.colorB) { try { c.offsetHSL(0.08, 0, 0.15); } catch(e) {} } return c; })() },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uNoiseAmp: { value: shape.amp },
    uNoiseFreq: { value: shape.freq },
    uSpeed: { value: shape.speed },
    uDetailMix: { value: shape.detail },
    uFresnelPower: { value: shape.fresnel },
    uOpacity: { value: 0.92 }
  };

  var vertexShader = document.getElementById('blobVertexShader').textContent;
  var fragmentShader = document.getElementById('blobFragmentShader').textContent;
  var geometry = new THREE.IcosahedronGeometry(1, 4);
  var material = new THREE.ShaderMaterial({
    uniforms: _onbBlobUniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  _onbBlobMesh = new THREE.Mesh(geometry, material);
  _onbBlobScene.add(_onbBlobMesh);
  _onbBlobInitialized = true;

  // Highlight current selection
  var btns = document.querySelectorAll('#onboardingBlobShapes .blob-shape-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-shape') === saved);
  }

  // Start animation loop
  var clock = new THREE.Clock();
  function animateOnbBlob() {
    _onbBlobAnimId = requestAnimationFrame(animateOnbBlob);
    if (!_onbBlobRenderer || !_onbBlobScene || !_onbBlobCamera) return;
    var dt = clock.getDelta();
    _onbBlobUniforms.uTime.value += dt;
    _onbBlobMesh.rotation.y += dt * 0.3;
    _onbBlobMesh.rotation.x += dt * 0.15;
    // Lerp toward target shape
    var target = _blobShapeTarget || BLOB_SHAPES.crystal;
    _onbBlobUniforms.uNoiseAmp.value += (target.amp - _onbBlobUniforms.uNoiseAmp.value) * 0.06;
    _onbBlobUniforms.uSpeed.value += (target.speed - _onbBlobUniforms.uSpeed.value) * 0.06;
    _onbBlobUniforms.uNoiseFreq.value += (target.freq - _onbBlobUniforms.uNoiseFreq.value) * 0.06;
    _onbBlobUniforms.uDetailMix.value += (target.detail - _onbBlobUniforms.uDetailMix.value) * 0.06;
    _onbBlobUniforms.uFresnelPower.value += (target.fresnel - _onbBlobUniforms.uFresnelPower.value) * 0.06;
    _onbBlobRenderer.render(_onbBlobScene, _onbBlobCamera);
  }
  animateOnbBlob();
}

function selectOnboardingBlob(shapeName) {
  if (shapeName !== 'helix' && shapeName !== 'none' && !(shapeName in BLOB_SHAPES)) return;
  _blobCurrentShape = shapeName;
  if (shapeName !== 'helix' && shapeName !== 'none') _blobShapeTarget = BLOB_SHAPES[shapeName];
  try { localStorage.setItem('roweos_blob_shape', shapeName); } catch(e) {}
  // Update button states in onboarding
  var btns = document.querySelectorAll('#onboardingBlobShapes .blob-shape-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-shape') === shapeName);
  }
  var isHelix = (shapeName === 'helix');
  // v24.25: Both previews stay visible in side-by-side layout; just highlight active type
  var onbHelixWrap = document.getElementById('onboardingHelixPreviewWrap');
  if (onbHelixWrap && isHelix) initOnboardingHelixPreview();
  // Update B.L.A.K.E. type highlight (skip if 'both' mode is active - handled by selectOnboardingBlakeType)
  var isBothMode = (localStorage.getItem('roweos_blob_shape') === 'both');
  if (typeof selectOnboardingBlakeType === 'function' && !isBothMode) {
    var blobCard = document.getElementById('onbBlakeBlob');
    var helixCard = document.getElementById('onbBlakeHelix');
    var bothCard = document.getElementById('onbBlakeBoth');
    if (blobCard && helixCard) {
      blobCard.style.borderColor = isHelix ? 'var(--border-color)' : 'var(--brand-accent, #a89878)';
      helixCard.style.borderColor = isHelix ? 'var(--brand-accent, #a89878)' : 'var(--border-color)';
      if (bothCard) bothCard.style.borderColor = 'var(--border-color)';
    }
  }
  // Show/hide main containers
  var blobC = document.getElementById('blobContainer');
  var helixC = document.getElementById('helixContainer');
  if (isHelix) {
    if (blobC) blobC.style.display = 'none';
    if (helixC) { helixC.style.display = ''; if (typeof initHelix === 'function' && !_helixInitialized) initHelix(); }
  } else {
    if (blobC) blobC.style.display = (shapeName === 'none') ? 'none' : '';
    if (helixC) helixC.style.display = 'none';
    if (typeof stopHelix === 'function') stopHelix();
  }
}

// v24.24: Onboarding helix preview (mini WebGL)
var _onbHelixScene, _onbHelixCamera, _onbHelixRenderer, _onbHelixMeshes = [];
var _onbHelixAnimId = null;
var _onbHelixInitialized = false;

var _onbHelixRetries = 0;
function initOnboardingHelixPreview() {
  if (_onbHelixInitialized) { startOnbHelixAnim(); return; }
  if (typeof THREE === 'undefined') {
    if (_onbHelixRetries < 10) { _onbHelixRetries++; setTimeout(initOnboardingHelixPreview, 500); }
    return;
  }
  var wrap = document.getElementById('onboardingHelixPreviewWrap');
  if (!wrap) return;
  _onbHelixRetries = 0;
  try {
    // v24.26: Use full-screen background canvas for helix preview
    var bgCanvas = document.getElementById('onboardingHelixBgCanvas');
    var canvas = bgCanvas || document.getElementById('onboardingHelixCanvas');
    if (!canvas) { console.error('[Helix] No canvas found'); return; }
    var step = document.getElementById('onboardingStepBlobPref');
    var w = (step ? step.offsetWidth : 800) || 800;
    var h = (step ? step.offsetHeight : 600) || 600;
    canvas.width = w; canvas.height = h;
    canvas.style.width = '100%'; canvas.style.height = '100%';
    _onbHelixScene = new THREE.Scene();
    // v24.26: Match main helix camera - wide FOV, close position for edge-to-edge coverage
    _onbHelixCamera = new THREE.PerspectiveCamera(65, w / h, 0.1, 100);
    _onbHelixCamera.position.z = 10;
    _onbHelixRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    _onbHelixRenderer.setSize(w, h);
    _onbHelixRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _onbHelixRenderer.setClearColor(0x000000, 0);

    var colors = getHelixColors();
    // v24.26: Use same curve params as main helix - full diagonal span, thick ribbons
    for (var i = 0; i < 4; i++) {
      var curve = typeof generateHelixCurve === 'function' ? generateHelixCurve(i) : (function() {
        var pts2 = [];
        var cfgs2 = [
          { xS: 12, yS: 8, xE: -12, yE: -8, ph: 0, fr: 1.2, am: 3.0, zA: 2.5, xW: 1.5 },
          { xS: 13, yS: 7, xE: -11, yE: -9, ph: 1.8, fr: 0.9, am: 3.5, zA: 2.0, xW: 1.8 },
          { xS: 11, yS: 9, xE: -13, yE: -7, ph: 3.5, fr: 1.5, am: 2.5, zA: 3.0, xW: 1.0 },
          { xS: 14, yS: 6, xE: -10, yE: -10, ph: 5.0, fr: 1.1, am: 3.2, zA: 2.2, xW: 1.3 }
        ];
        var cc = cfgs2[i];
        for (var j2 = 0; j2 <= 60; j2++) {
          var t2 = j2 / 60;
          var xx = cc.xS + (cc.xE - cc.xS) * t2 + Math.sin(t2 * Math.PI * cc.fr + cc.ph) * cc.xW;
          var yy = cc.yS + (cc.yE - cc.yS) * t2 + Math.sin(t2 * Math.PI * cc.fr * 1.3 + cc.ph) * cc.am * 0.4;
          var zz = Math.cos(t2 * Math.PI * 2.0 + cc.ph) * cc.zA;
          pts2.push(new THREE.Vector3(xx, yy, zz));
        }
        return new THREE.CatmullRomCurve3(pts2);
      })();
      var geom = new THREE.TubeGeometry(curve, 120, 1.1, 16, false);
      var mat = new THREE.ShaderMaterial({
        uniforms: { colorA: { value: colors[i].a }, colorB: { value: colors[i].b }, time: { value: i * 2.0 }, opacity: { value: 0.85 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 colorA; uniform vec3 colorB; uniform float time; uniform float opacity; varying vec2 vUv; void main(){ vec3 c = mix(colorA, colorB, vUv.x + 0.15*sin(vUv.x*6.28+time)); gl_FragColor = vec4(c, opacity * (0.7 + 0.3*sin(vUv.x*3.14))); }',
        transparent: true, depthWrite: false, side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geom, mat);
      _onbHelixScene.add(mesh);
      _onbHelixMeshes.push(mesh);
    }
    _onbHelixInitialized = true;
    startOnbHelixAnim();
  } catch(e) { console.error('[Onboarding Helix] WebGL init failed:', e.message || e); }
}

function startOnbHelixAnim() {
  if (_onbHelixAnimId) return;
  var t0 = performance.now();
  function loop() {
    _onbHelixAnimId = requestAnimationFrame(loop);
    var elapsed = (performance.now() - t0) / 1000;
    for (var i = 0; i < _onbHelixMeshes.length; i++) {
      _onbHelixMeshes[i].material.uniforms.time.value = elapsed * 0.5;
      _onbHelixMeshes[i].rotation.z = Math.sin(elapsed * 0.3 + i) * 0.05;
    }
    _onbHelixRenderer.render(_onbHelixScene, _onbHelixCamera);
  }
  loop();
}

function stopOnbHelixAnim() {
  if (_onbHelixAnimId) { cancelAnimationFrame(_onbHelixAnimId); _onbHelixAnimId = null; }
}

function updateOnbHelixColors() {
  if (!_onbHelixMeshes.length) return;
  var colors = getHelixColors();
  for (var i = 0; i < _onbHelixMeshes.length && i < colors.length; i++) {
    _onbHelixMeshes[i].material.uniforms.colorA.value = colors[i].a;
    _onbHelixMeshes[i].material.uniforms.colorB.value = colors[i].b;
  }
}

// v24.24: Onboarding helix preset selection
function selectOnboardingHelixPreset(preset) {
  if (typeof setHelixPreset === 'function') setHelixPreset(preset);
  // Update onboarding-specific buttons
  var btns = document.querySelectorAll('[data-onb-helix]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-onb-helix') === preset);
  }
  // Update preview colors
  updateOnbHelixColors();
  // Update main helix too
  if (typeof applyHelixColors === 'function') applyHelixColors();
  // v24.26: Also update organism/blob color to match preset primary
  if (_onbBlobUniforms && typeof THREE !== 'undefined') {
    try {
      var colors = getHelixColors();
      if (colors && colors[0]) {
        _onbBlobUniforms.uColor.value = colors[0].a.clone();
        _onbBlobUniforms.uColorB.value = colors[0].b.clone();
      }
    } catch(e) {}
  }
}

// v24.24: Onboarding theme toggle
function setOnboardingTheme(mode) {
  var html = document.documentElement;
  if (mode === 'light') {
    html.classList.add('light-mode');
    try { localStorage.setItem('roweos_theme', 'light'); localStorage.setItem('roweos-theme', 'light'); } catch(e) {}
  } else {
    html.classList.remove('light-mode');
    try { localStorage.setItem('roweos_theme', 'dark'); localStorage.setItem('roweos-theme', 'dark'); } catch(e) {}
  }
  // Update button states
  var darkBtn = document.getElementById('onbThemeDark');
  var lightBtn = document.getElementById('onbThemeLight');
  if (darkBtn) darkBtn.classList.toggle('active', mode === 'dark');
  if (lightBtn) lightBtn.classList.toggle('active', mode === 'light');
  // Refresh helix colors for new theme
  updateOnbHelixColors();
  if (typeof applyHelixColors === 'function') applyHelixColors();
}

// v24.25: Select blob vs helix type in B.L.A.K.E. onboarding
function selectOnboardingBlakeType(type) {
  var blobCard = document.getElementById('onbBlakeBlob');
  var helixCard = document.getElementById('onbBlakeHelix');
  var bothCard = document.getElementById('onbBlakeBoth');
  var blobShapes = document.getElementById('onboardingBlobShapes');
  var bgCanvas = document.getElementById('onboardingHelixBgCanvas');
  // v28.4: Reset all card borders
  if (blobCard) blobCard.style.borderColor = 'var(--border-color)';
  if (helixCard) helixCard.style.borderColor = 'var(--border-color)';
  if (bothCard) bothCard.style.borderColor = 'var(--border-color)';
  if (type === 'helix') {
    if (helixCard) helixCard.style.borderColor = 'var(--brand-accent, #a89878)';
    if (blobShapes) blobShapes.style.display = 'none';
    selectOnboardingBlob('helix');
    // v24.26: Show helix as full background - dramatic edge-to-edge like chat view
    if (bgCanvas) bgCanvas.style.opacity = '0.6';
    setTimeout(function() { initOnboardingHelixPreview(); }, 100);
  } else if (type === 'both') {
    // v28.4: Both mode - show blob shapes and helix background
    if (bothCard) bothCard.style.borderColor = 'var(--brand-accent, #a89878)';
    if (blobShapes) blobShapes.style.display = 'flex';
    if (bgCanvas) bgCanvas.style.opacity = '0.4';
    // Set 'both' in localStorage BEFORE selectOnboardingBlob so isBothMode guard works
    try { localStorage.setItem('roweos_blob_shape', 'both'); } catch(e) {}
    var current = _blobCurrentShape || 'crystal';
    if (current === 'helix' || current === 'both') current = 'crystal';
    selectOnboardingBlob(current);
    // Re-set 'both' since selectOnboardingBlob overwrites localStorage with the blob shape
    try { localStorage.setItem('roweos_blob_shape', 'both'); } catch(e) {}
    setTimeout(function() { initOnboardingHelixPreview(); }, 100);
  } else {
    // v24.26: Hide helix background when blob selected
    if (bgCanvas) bgCanvas.style.opacity = '0';
    if (blobCard) blobCard.style.borderColor = 'var(--brand-accent, #a89878)';
    if (blobShapes) blobShapes.style.display = 'flex';
    // Default to crystal if currently helix
    var current = _blobCurrentShape || 'crystal';
    if (current === 'helix') current = 'crystal';
    selectOnboardingBlob(current);
  }
}

// v24.25: Init onboarding blobPref step UI - both blob and helix previews visible
function initOnboardingBlobPrefUI() {
  // Set theme buttons active state
  var isLight = document.documentElement.classList.contains('light-mode');
  var darkBtn = document.getElementById('onbThemeDark');
  var lightBtn = document.getElementById('onbThemeLight');
  if (darkBtn) darkBtn.classList.toggle('active', !isLight);
  if (lightBtn) lightBtn.classList.toggle('active', isLight);
  // Set helix preset buttons active state
  var preset = _helixColorPreset || 'brand';
  var btns = document.querySelectorAll('[data-onb-helix]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-onb-helix') === preset);
  }
  // v24.25: Always show both blob and helix previews in side-by-side layout
  var blobWrap = document.getElementById('onboardingBlobPreviewWrap');
  var helixWrap = document.getElementById('onboardingHelixPreviewWrap');
  var helixColors = document.getElementById('onboardingHelixColors');
  if (blobWrap) blobWrap.style.display = '';
  if (helixWrap) helixWrap.style.display = '';
  if (helixColors) helixColors.style.display = '';
  // Init both previews
  if (typeof initOnboardingBlobPreview === 'function') initOnboardingBlobPreview();
  initOnboardingHelixPreview();
  // Highlight current selection
  var savedShape = _blobCurrentShape || localStorage.getItem('roweos_blob_shape') || 'crystal';
  var initType = savedShape === 'helix' ? 'helix' : (savedShape === 'both' ? 'both' : 'blob');
  selectOnboardingBlakeType(initType);
}

function proceedFromBlobPref() {
  // Stop onboarding blob animation to save resources
  if (_onbBlobAnimId) {
    cancelAnimationFrame(_onbBlobAnimId);
    _onbBlobAnimId = null;
  }
  stopOnbHelixAnim();
  // v24.26: BLAKE now comes after logo/color, proceed to sync
  goToOnboardingStep('sync');
}

// ============================================================
// v24.24: WebGL Helix - Flowing Gradient Ribbons
// ============================================================
var _helixScene, _helixCamera, _helixRenderer, _helixMeshes = [];
var _helixAnimId = null;
var _helixInitialized = false;
var _helixUniforms = [];
var _helixGroup = null;

function getHelixColors() {
  // v24.24: Check preset/custom colors first
  var isLight = document.documentElement.classList.contains('light-mode');
  if (_helixColorPreset !== 'brand') {
    var presetData = (_helixColorPreset === 'custom' && _helixCustomColors) ? _helixCustomColors : null;
    if (!presetData && HELIX_PRESETS[_helixColorPreset]) {
      var p = HELIX_PRESETS[_helixColorPreset];
      presetData = (p.dark && p.light) ? (isLight ? p.light : p.dark) : p;
    }
    if (presetData) {
      return presetData.map(function(c) {
        return { a: new THREE.Color(c.a), b: new THREE.Color(c.b) };
      });
    }
  }
  // Brand mode: derive from brand accent
  var accent = getBlobColors().color;
  var c = new THREE.Color(accent);
  var hsl = {};
  c.getHSL(hsl);
  var sat = Math.max(hsl.s, 0.6);
  var lit = Math.max(hsl.l, 0.5);
  return [
    { a: new THREE.Color().setHSL((hsl.h + 0.92) % 1.0, Math.min(sat + 0.35, 0.95), Math.min(lit + 0.12, 0.72)),
      b: new THREE.Color().setHSL((hsl.h + 0.03) % 1.0, Math.min(sat + 0.3, 0.92), Math.min(lit + 0.18, 0.75)) },
    { a: new THREE.Color().setHSL(hsl.h, Math.min(sat + 0.3, 0.9), Math.min(lit + 0.08, 0.68)),
      b: new THREE.Color().setHSL((hsl.h + 0.08) % 1.0, Math.min(sat + 0.4, 0.95), Math.min(lit + 0.15, 0.73)) },
    { a: new THREE.Color().setHSL((hsl.h + 0.55) % 1.0, Math.min(sat + 0.35, 0.92), Math.min(lit + 0.08, 0.65)),
      b: new THREE.Color().setHSL((hsl.h + 0.42) % 1.0, Math.min(sat + 0.38, 0.94), Math.min(lit + 0.15, 0.72)) },
    { a: new THREE.Color().setHSL((hsl.h + 0.78) % 1.0, Math.min(sat + 0.35, 0.92), Math.min(lit + 0.1, 0.68)),
      b: new THREE.Color().setHSL((hsl.h + 0.65) % 1.0, Math.min(sat + 0.32, 0.9), Math.min(lit + 0.18, 0.75)) }
  ];
}

function generateHelixCurve(index) {
  var points = [];
  var segs = 60;
  // v24.24: Ribbons span full panel diagonally with wider spread
  var configs = [
    { xStart: 12, yStart: 8, xEnd: -12, yEnd: -8, phase: 0, freq: 1.2, amp: 3.0, zAmp: 2.5, xWave: 1.5 },
    { xStart: 13, yStart: 7, xEnd: -11, yEnd: -9, phase: 1.8, freq: 0.9, amp: 3.5, zAmp: 2.0, xWave: 1.8 },
    { xStart: 11, yStart: 9, xEnd: -13, yEnd: -7, phase: 3.5, freq: 1.5, amp: 2.5, zAmp: 3.0, xWave: 1.0 },
    { xStart: 14, yStart: 6, xEnd: -10, yEnd: -10, phase: 5.0, freq: 1.1, amp: 3.2, zAmp: 2.2, xWave: 1.3 }
  ];
  var cfg = configs[index] || configs[0];
  for (var i = 0; i <= segs; i++) {
    var t = i / segs;
    var x = cfg.xStart + (cfg.xEnd - cfg.xStart) * t;
    var y = cfg.yStart + (cfg.yEnd - cfg.yStart) * t;
    // S-curve wave perpendicular to diagonal
    x += Math.sin(t * Math.PI * cfg.freq + cfg.phase) * cfg.xWave;
    y += Math.sin(t * Math.PI * cfg.freq * 1.3 + cfg.phase) * cfg.amp * 0.4;
    var z = Math.cos(t * Math.PI * 2.0 + cfg.phase) * cfg.zAmp;
    points.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(points);
}

function initHelix() {
  if (_helixInitialized) return;
  if (typeof THREE === 'undefined') { setTimeout(initHelix, 200); return; }
  var canvas = document.getElementById('helixCanvas');
  var container = document.getElementById('helixContainer');
  if (!canvas || !container) return;

  var w = container.offsetWidth || window.innerWidth;
  var h = container.offsetHeight || window.innerHeight;
  if (w < 10 || h < 10) { w = window.innerWidth; h = window.innerHeight; }
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  _helixScene = new THREE.Scene();
  // v24.24: Wider FOV + closer camera for full-panel coverage
  _helixCamera = new THREE.PerspectiveCamera(65, w / h, 0.1, 100);
  _helixCamera.position.z = 10;

  _helixRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  _helixRenderer.setSize(w, h);
  _helixRenderer.setPixelRatio(dpr);
  _helixRenderer.setClearColor(0x000000, 0);

  var vertexShader = document.getElementById('helixVertexShader').textContent;
  var fragmentShader = document.getElementById('helixFragmentShader').textContent;
  var colors = getHelixColors();

  _helixGroup = new THREE.Group();

  for (var i = 0; i < 4; i++) {
    var curve = generateHelixCurve(i);
    // v24.24: Wider tubes for more prominent ribbons
    var geometry = new THREE.TubeGeometry(curve, 160, 1.1, 20, false);
    var uniforms = {
      uTime: { value: i * 2.0 },
      uColorA: { value: colors[i].a },
      uColorB: { value: colors[i].b },
      uOpacity: { value: 0.85 }
    };
    var material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(geometry, material);
    _helixGroup.add(mesh);
    _helixMeshes.push(mesh);
    _helixUniforms.push(uniforms);
  }

  _helixScene.add(_helixGroup);
  _helixInitialized = true;
  _helixRenderer.render(_helixScene, _helixCamera);
  startHelixAnimation();
  // v24.26: Force resize after layout settles to eliminate bottom gap on initial load
  setTimeout(resizeHelix, 100);
  setTimeout(resizeHelix, 500);
  setTimeout(resizeHelix, 1500);
}

function startHelixAnimation() {
  if (_helixAnimId) return;
  var clock = new THREE.Clock();
  function animate() {
    _helixAnimId = requestAnimationFrame(animate);
    if (!_helixRenderer || !_helixScene || !_helixCamera) return;
    var dt = clock.getDelta();
    for (var i = 0; i < _helixUniforms.length; i++) {
      _helixUniforms[i].uTime.value += dt;
    }
    // Gentle overall rotation for flowing effect
    if (_helixGroup) {
      _helixGroup.rotation.z += dt * 0.015;
      _helixGroup.rotation.y += dt * 0.008;
    }
    _helixRenderer.render(_helixScene, _helixCamera);
  }
  animate();
}

function stopHelix() {
  if (_helixAnimId) {
    cancelAnimationFrame(_helixAnimId);
    _helixAnimId = null;
  }
}

function updateHelixColors() {
  applyHelixColors();
}

function resizeHelix() {
  var container = document.getElementById('helixContainer');
  if (!container || !_helixRenderer || !_helixCamera) return;
  var w = container.clientWidth || window.innerWidth;
  var h = container.clientHeight || window.innerHeight;
  if (w < 10) w = window.innerWidth;
  if (h < 10) h = window.innerHeight;
  _helixCamera.aspect = w / h;
  _helixCamera.updateProjectionMatrix();
  _helixRenderer.setSize(w, h);
  _helixRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}
// v24.26: Resize helix on window resize and orientation change
window.addEventListener('resize', function() { if (typeof resizeHelix === 'function') resizeHelix(); });
window.addEventListener('orientationchange', function() { setTimeout(function() { if (typeof resizeHelix === 'function') resizeHelix(); }, 200); });

// v24.24: Helix color presets and custom colors
var _helixColorPreset = 'brand';
var _helixCustomColors = null;

var HELIX_PRESETS = {
  gold: {
    dark: [
      { a: '#a89878', b: '#c0a86e' },
      { a: '#8b7355', b: '#d4b86a' },
      { a: '#6b5b3e', b: '#b8976a' },
      { a: '#9c8a6a', b: '#e0c878' }
    ],
    light: [
      { a: '#8b7355', b: '#a89060' },
      { a: '#6d5a3a', b: '#b89850' },
      { a: '#5a4830', b: '#9a7e50' },
      { a: '#7a6848', b: '#c0a060' }
    ]
  },
  aurora: {
    dark: [
      { a: '#00e676', b: '#00bcd4' },
      { a: '#1de9b6', b: '#7c4dff' },
      { a: '#18ffff', b: '#651fff' },
      { a: '#69f0ae', b: '#448aff' }
    ],
    light: [
      { a: '#00c853', b: '#0097a7' },
      { a: '#00bfa5', b: '#6200ea' },
      { a: '#00b8d4', b: '#4527a0' },
      { a: '#2e7d32', b: '#1565c0' }
    ]
  },
  sunset: {
    dark: [
      { a: '#ff6b6b', b: '#ffa726' },
      { a: '#ff8a65', b: '#ffee58' },
      { a: '#ef5350', b: '#ff7043' },
      { a: '#ffa000', b: '#ff5252' }
    ],
    light: [
      { a: '#d32f2f', b: '#e65100' },
      { a: '#bf360c', b: '#f9a825' },
      { a: '#c62828', b: '#d84315' },
      { a: '#e65100', b: '#b71c1c' }
    ]
  },
  ocean: {
    dark: [
      { a: '#0288d1', b: '#00bcd4' },
      { a: '#0097a7', b: '#4fc3f7' },
      { a: '#006064', b: '#26c6da' },
      { a: '#00838f', b: '#80deea' }
    ],
    light: [
      { a: '#01579b', b: '#00838f' },
      { a: '#006064', b: '#0277bd' },
      { a: '#004d40', b: '#00695c' },
      { a: '#005662', b: '#0288d1' }
    ]
  },
  neon: {
    dark: [
      { a: '#ff00ff', b: '#00ffff' },
      { a: '#ff1744', b: '#f50057' },
      { a: '#00e5ff', b: '#76ff03' },
      { a: '#d500f9', b: '#ffea00' }
    ],
    light: [
      { a: '#aa00ff', b: '#00b8d4' },
      { a: '#c51162', b: '#880e4f' },
      { a: '#0091ea', b: '#64dd17' },
      { a: '#6200ea', b: '#ffd600' }
    ]
  },
  pastel: {
    dark: [
      { a: '#f8bbd0', b: '#e1bee7' },
      { a: '#b3e5fc', b: '#c8e6c9' },
      { a: '#fff9c4', b: '#ffccbc' },
      { a: '#d1c4e9', b: '#b2dfdb' }
    ],
    light: [
      { a: '#f48fb1', b: '#ce93d8' },
      { a: '#81d4fa', b: '#a5d6a7' },
      { a: '#fff176', b: '#ffab91' },
      { a: '#b39ddb', b: '#80cbc4' }
    ]
  },
  ember: {
    dark: [
      { a: '#4a1a0a', b: '#c0392b' },
      { a: '#2c1810', b: '#e74c3c' },
      { a: '#3d1408', b: '#d35400' },
      { a: '#1a0a04', b: '#e67e22' }
    ],
    light: [
      { a: '#922b21', b: '#e74c3c' },
      { a: '#6e2c00', b: '#d35400' },
      { a: '#7b241c', b: '#c0392b' },
      { a: '#784212', b: '#e67e22' }
    ]
  },
  midnight: {
    dark: [
      { a: '#0d0d2b', b: '#1a1a4e' },
      { a: '#120a2e', b: '#2d1b69' },
      { a: '#0a1628', b: '#1b3a5c' },
      { a: '#14082e', b: '#3a1878' }
    ],
    light: [
      { a: '#1a237e', b: '#283593' },
      { a: '#311b92', b: '#4527a0' },
      { a: '#0d47a1', b: '#1565c0' },
      { a: '#4a148c', b: '#6a1b9a' }
    ]
  }
};

function setHelixPreset(preset) {
  _helixColorPreset = preset;
  localStorage.setItem('roweos_helix_preset', preset);
  // Update preset button UI
  var btns = document.querySelectorAll('[data-helix-preset]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-helix-preset') === preset);
  }
  // Show/hide custom color pickers
  var customEl = document.getElementById('helixCustomColors');
  if (customEl) customEl.style.display = (preset === 'custom') ? '' : 'none';
  if (preset === 'custom') {
    // Load saved custom colors into pickers
    var saved = localStorage.getItem('roweos_helix_custom_colors');
    if (saved) {
      try { _helixCustomColors = JSON.parse(saved); } catch(e) { _helixCustomColors = null; }
    }
    if (_helixCustomColors) updateHelixCustomPickers();
  } else {
    _helixCustomColors = null;
    localStorage.removeItem('roweos_helix_custom_colors');
  }
  applyHelixColors();
}

function setHelixCustomColor(ribbonIdx, ab, hexVal) {
  if (!_helixCustomColors) {
    _helixCustomColors = [
      { a: '#ff6b9d', b: '#ff8a65' },
      { a: '#a89878', b: '#ffa726' },
      { a: '#42a5f5', b: '#7c4dff' },
      { a: '#66bb6a', b: '#ffee58' }
    ];
  }
  _helixCustomColors[ribbonIdx][ab] = hexVal;
  localStorage.setItem('roweos_helix_custom_colors', JSON.stringify(_helixCustomColors));
  applyHelixColors();
}

function updateHelixCustomPickers() {
  if (!_helixCustomColors) return;
  for (var i = 0; i < 4; i++) {
    var elA = document.getElementById('helixColor' + (i+1) + 'a');
    var elB = document.getElementById('helixColor' + (i+1) + 'b');
    if (elA && _helixCustomColors[i]) elA.value = _helixCustomColors[i].a;
    if (elB && _helixCustomColors[i]) elB.value = _helixCustomColors[i].b;
  }
}

function applyHelixColors() {
  var colors = getHelixColors();
  if (_helixInitialized && _helixUniforms.length > 0) {
    for (var i = 0; i < _helixUniforms.length; i++) {
      _helixUniforms[i].uColorA.value.copy(colors[i].a);
      _helixUniforms[i].uColorB.value.copy(colors[i].b);
    }
  }
  // Also update preview
  if (typeof updateHelixPreviewColors === 'function') updateHelixPreviewColors();
}

function initHelixColorSettings() {
  var preset = localStorage.getItem('roweos_helix_preset') || 'brand';
  _helixColorPreset = preset;
  var btns = document.querySelectorAll('[data-helix-preset]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-helix-preset') === preset);
  }
  if (preset === 'custom') {
    var saved = localStorage.getItem('roweos_helix_custom_colors');
    if (saved) { try { _helixCustomColors = JSON.parse(saved); } catch(e) {} }
    var customEl = document.getElementById('helixCustomColors');
    if (customEl) customEl.style.display = '';
    updateHelixCustomPickers();
  }
}

// v24.25: Called when blob/helix expander opens - init sections
function onBlobExpanderOpen() {
  var helixSection = document.getElementById('helixColorSection');
  var blobColorControls = document.getElementById('blobColorControls');
  var isHelix = (_blobCurrentShape === 'helix');
  var isBlob = (!isHelix && _blobCurrentShape !== 'none');
  // v24.26: Always show inner sections - parent sub-panels control visibility
  if (helixSection) helixSection.style.display = '';
  if (blobColorControls) blobColorControls.style.display = isBlob ? '' : 'none';
  if (isBlob && typeof initBlobPresetUI === 'function') initBlobPresetUI();
  if (isHelix) initHelixColorSettings();
  // Toggle preview thumbnails
  updateAmbientPreviewVisibility();
  // Update mode label
  var modeLabel = document.getElementById('ambientModeName');
  if (modeLabel) {
    var isLife = document.documentElement.classList.contains('life-mode');
    modeLabel.textContent = isLife ? 'LifeAI' : 'BrandAI';
  }
  // Init title color buttons
  initTitleColorSettings();
  // v24.26: Show/hide B.L.A.K.E. / Helix sub-panels
  if (typeof updateAmbientSubPanels === 'function') updateAmbientSubPanels();
}

// v24.24: Platform title text color customization
var _titleColorMode = localStorage.getItem('roweos_title_color_mode') || 'auto';
var _titleCustomColor = localStorage.getItem('roweos_title_custom_color') || '#c0b090';

function setTitleColorMode(mode) {
  _titleColorMode = mode;
  localStorage.setItem('roweos_title_color_mode', mode);
  // Update button UI
  var btns = document.querySelectorAll('[data-title-color]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-title-color') === mode);
  }
  // Show/hide custom picker
  var picker = document.getElementById('titleCustomColor1');
  if (picker) picker.style.display = (mode === 'custom') ? '' : 'none';
  applyTitleColor();
}

function setTitleCustomColor(color) {
  _titleCustomColor = color;
  localStorage.setItem('roweos_title_custom_color', color);
  applyTitleColor();
}

function applyTitleColor() {
  var el = document.querySelector('.landing-platform-title');
  if (!el) return;
  var isLife = document.documentElement.classList.contains('life-mode');

  if (_titleColorMode === 'auto') {
    // Reset to default CSS (remove inline override)
    el.style.removeProperty('background');
    el.style.removeProperty('-webkit-background-clip');
    el.style.removeProperty('-webkit-text-fill-color');
    el.style.removeProperty('background-clip');
    return;
  }

  var grad;
  if (_titleColorMode === 'light') {
    grad = isLife
      ? 'linear-gradient(135deg, #a8e6cf, #88d4ab)'
      : 'linear-gradient(135deg, #e8dcc8, #d4c4a8, #c0b090)';
  } else if (_titleColorMode === 'dark') {
    grad = isLife
      ? 'linear-gradient(135deg, #1b5e20, #2e7d32)'
      : 'linear-gradient(135deg, #5a4e3a, #4a3f2e, #3d3425)';
  } else if (_titleColorMode === 'custom') {
    grad = _titleCustomColor;
  }

  el.style.background = grad;
  el.style.webkitBackgroundClip = 'text';
  el.style.webkitTextFillColor = 'transparent';
  el.style.backgroundClip = 'text';
}

function initTitleColorSettings() {
  // Set active button
  var btns = document.querySelectorAll('[data-title-color]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-title-color') === _titleColorMode);
  }
  // Show custom picker if needed
  var picker = document.getElementById('titleCustomColor1');
  if (picker) {
    picker.style.display = (_titleColorMode === 'custom') ? '' : 'none';
    picker.value = _titleCustomColor;
  }
}

// v24.24: Show blob or helix preview thumbnail
function updateAmbientPreviewVisibility() {
  var blobPrev = document.getElementById('blobPreviewContainer');
  var helixPrev = document.getElementById('helixPreviewContainer');
  var isHelix = (_blobCurrentShape === 'helix');
  if (blobPrev) {
    blobPrev.style.display = isHelix ? 'none' : '';
    // Lazy-init blob preview if switching to blob and not yet initialized
    if (!isHelix && !_blobPreviewInitialized) {
      if (typeof initBlobPreview === 'function') initBlobPreview();
    }
  }
  if (helixPrev) {
    helixPrev.style.display = isHelix ? '' : 'none';
    if (isHelix && !_helixPreviewInitialized) {
      if (typeof initHelixPreview === 'function') initHelixPreview();
    } else if (isHelix) {
      updateHelixPreviewColors();
      if (!_helixPreviewAnimId && typeof startHelixPreviewAnimation === 'function') startHelixPreviewAnimation();
    }
  }
}

function updateBlobPreviewColor() {
  if (!_blobPreviewUniforms) return;
  var colors = getBlobColors();
  _blobPreviewUniforms.uColor.value.set(colors.color);
  if (colors.colorB) {
    _blobPreviewUniforms.uColorB.value.set(colors.colorB);
  } else {
    _blobPreviewUniforms.uColorB.value.set(colors.color);
    try { _blobPreviewUniforms.uColorB.value.offsetHSL(0.08, 0, 0.15); } catch(e) {}
  }
}

function startBlobAnimation() {
  if (_blobAnimId) return;
  var clock = new THREE.Clock();

  function animate() {
    _blobAnimId = requestAnimationFrame(animate);
    if (!_blobRenderer || !_blobScene || !_blobCamera) return;

    var dt = clock.getDelta();
    _blobUniforms.uTime.value += dt;

    // v24.20: Smooth transitions toward shape preset + state modifier
    var base = _blobShapeTarget;

    // Smooth mouse follow
    var ux = _blobUniforms.uMouse.value;
    ux.x += (_blobMouse.x * 1.5 - ux.x) * 0.05;
    ux.y += (_blobMouse.y * 1.5 - ux.y) * 0.05;


    // Gentle rotation
    _blobMesh.rotation.y += dt * 0.15;
    _blobMesh.rotation.x += dt * 0.08;
    var ampMod = 0, speedMod = 0, freqMod = 0;

    if (_blobState === 'thinking') {
      ampMod = 0.2; speedMod = 0.5; freqMod = 0.5;
    } else if (_blobState === 'responding') {
      ampMod = 0.1; speedMod = 0.2; freqMod = 0.3;
    }

    var tAmp = base.amp + ampMod;
    var tSpeed = base.speed + speedMod;
    var tFreq = base.freq + freqMod;
    var tDetail = base.detail;
    var tFresnel = base.fresnel;
    _blobUniforms.uNoiseAmp.value += (tAmp - _blobUniforms.uNoiseAmp.value) * 0.02;
    _blobUniforms.uSpeed.value += (tSpeed - _blobUniforms.uSpeed.value) * 0.02;
    _blobUniforms.uNoiseFreq.value += (tFreq - _blobUniforms.uNoiseFreq.value) * 0.02;
    _blobUniforms.uDetailMix.value += (tDetail - _blobUniforms.uDetailMix.value) * 0.02;
    _blobUniforms.uFresnelPower.value += (tFresnel - _blobUniforms.uFresnelPower.value) * 0.02;

    _blobRenderer.render(_blobScene, _blobCamera);
  }
  animate();
}

function stopBlobAnimation() {
  if (_blobAnimId) {
    cancelAnimationFrame(_blobAnimId);
    _blobAnimId = null;
  }
}

function resizeBlob() {
  var container = document.getElementById('blobContainer');
  if (!container || !_blobRenderer || !_blobCamera) return;
  var w = container.offsetWidth;
  var h = container.offsetHeight;
  _blobRenderer.setSize(w, h);
  _blobCamera.aspect = w / h;
  _blobCamera.updateProjectionMatrix();
}

// Initialize blob - retry until container is in DOM and visible
function tryInitBlob() {
  if (_blobInitialized) return;
  var container = document.getElementById('blobContainer');
  if (!container || typeof THREE === 'undefined') return;
  try { initBlob(); } catch(e) { /* silent */ }
}

// v24.21: Apply saved shape on load (handle 'none')
(function() {
  var savedShape = localStorage.getItem('roweos_blob_shape') || 'crystal';
  // v24.24: Apply saved vertical offset and text gap on load
  var vOffset = localStorage.getItem('roweos_blob_vertical_offset');
  var tGap = localStorage.getItem('roweos_blob_text_gap');
  if (vOffset !== null) document.documentElement.style.setProperty('--blob-vertical-offset', vOffset + 'px');
  if (tGap !== null) document.documentElement.style.setProperty('--blob-text-gap', tGap + 'px');
  if (savedShape === 'none') {
    var c = document.getElementById('blobContainer');
    var g = document.getElementById('blobTitleGroup');
    if (c) c.style.display = 'none';
    if (g) g.style.marginTop = '0';
    _blobInitialized = true;
    return;
  }
  // Apply vertical offset to group
  var g2 = document.getElementById('blobTitleGroup');
  if (g2 && vOffset !== null) g2.style.marginTop = vOffset + 'px';
})();
// v24.24: Apply saved title color after DOM ready
document.addEventListener('DOMContentLoaded', function() {
  if (typeof applyTitleColor === 'function') applyTitleColor();
});

tryInitBlob();

window.addEventListener('load', function() {
  tryInitBlob();
  setTimeout(tryInitBlob, 500);
  setTimeout(tryInitBlob, 2000);
});

// Resize handler
window.addEventListener('resize', function() { resizeBlob(); if (typeof resizeHelix === 'function') resizeHelix(); });

// Fallback: poll until initialized (max 10 seconds)
(function() {
  var attempts = 0;
  var pollId = setInterval(function() {
    attempts++;
    if (_blobInitialized || attempts > 20) {
      clearInterval(pollId);
      if (!_blobInitialized) {
        console.warn('[Blob] Failed to initialize after 20 attempts -- hiding container');
        var _bc = document.getElementById('blobContainer');
        if (_bc) _bc.style.display = 'none';
      }
      return;
    }
    tryInitBlob();
  }, 500);
})();

// Hook into showView for blob lifecycle
(function() {
  var _checkInterval = setInterval(function() {
    if (typeof showView !== 'function') return;
    clearInterval(_checkInterval);
    var _origShow = showView;
    showView = function(view) {
      _origShow.apply(this, arguments);
      if (view === 'agent') {
        if (!_blobInitialized) {
          tryInitBlob();
        } else if (_blobCurrentShape === 'helix') {
          // v24.24: Resume helix when returning to chat
          if (typeof updateHelixColors === 'function') updateHelixColors();
          if (typeof resizeHelix === 'function') resizeHelix();
          if (!_helixAnimId && typeof startHelixAnimation === 'function') startHelixAnimation();
        } else {
          updateBlobColor();
          resizeBlob();
          if (!_blobAnimId) startBlobAnimation();
        }
        stopBlobPreview();
      } else if (view === 'settings') {
        // v24.20: Start preview when entering settings
        setTimeout(function() {
          if (!_blobPreviewInitialized && typeof initBlobPreview === 'function') initBlobPreview();
          else if (_blobPreviewInitialized && !_blobPreviewAnimId) startBlobPreviewAnimation();
        }, 200);
      } else {
        stopBlobPreview();
      }
    };
  }, 200);
})();

