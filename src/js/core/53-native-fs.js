
// ═══════════════════════════════════════════════════════════════
// NATIVE WORKSPACE - File System Access bridge for Brilliance
// v34.87
// ═══════════════════════════════════════════════════════════════
// Gives any LLM connected to Brilliance read / search / write access
// to a folder on the user's actual computer (macOS or Windows). Uses
// the File System Access API (Chromium browsers + the desktop PWA).
// Falls back gracefully on Safari / iOS where the API is missing.
//
// Architecture:
//   - User picks ONE root folder via showDirectoryPicker (one-time grant).
//   - The FileSystemDirectoryHandle is persisted in IndexedDB so the
//     grant survives reload. Permission is re-requested via
//     requestPermission() if the browser dropped it.
//   - Tool calls receive paths RELATIVE to that root. Walking the
//     filesystem above the root is impossible — sandbox is enforced
//     by the browser.
//   - Writes / deletes always prompt the user via _confirmWrite()
//     unless the workspace is in trusted mode (off by default).
//
// Public API (window.NativeFS):
//   isSupported()          → bool
//   isConnected()          → Promise<bool>
//   getRootName()          → Promise<string|null>
//   connect()              → Promise<{ ok, name?, error? }>
//   disconnect()           → Promise<void>
//   listDirectory(path)    → Promise<entries[]>     // entries: { name, path, type, size?, modified? }
//   readFile(path)         → Promise<{ kind, text?|dataUrl?, mime, size }>
//   readImage(path)        → Promise<{ dataUrl, mime, width?, height? }>
//   writeFile(path, str)   → Promise<{ ok, bytes? }>     // confirms first
//   deleteFile(path)       → Promise<{ ok }>             // confirms first
//   searchFiles(opts)      → Promise<results[]>
//   getAnthropicTools()    → tool[] for Anthropic API
//   getOpenAITools()       → tool[] for OpenAI API
//   getGoogleTools()       → tool[] for Google API
//   executeTool(name,args) → Promise<{ ok, result?, error? }>
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  var IDB_NAME = 'brilliance_native_fs';
  var IDB_STORE = 'handles';
  var IDB_KEY = 'workspace_root';
  var TRUST_KEY = 'roweos_native_fs_trust_writes';
  var MODE_KEY = 'roweos_native_fs_mode'; // 'read' | 'readwrite'

  // ─── IndexedDB plumbing for handle persistence ────────────────
  function _openIDB() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function() {
        try { req.result.createObjectStore(IDB_STORE); } catch(e){}
      };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  }
  function _idbPut(key, value) {
    return _openIDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }
  function _idbGet(key) {
    return _openIDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { resolve(null); };
      });
    });
  }
  function _idbDel(key) {
    return _openIDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { resolve(); };
      });
    });
  }

  // ─── Feature detection ────────────────────────────────────────
  // v34.95: Two backends.
  //   - Native (Chromium): showDirectoryPicker + persistent FileSystemDirectoryHandle.
  //   - Fallback (Safari, Firefox): <input webkitdirectory> + in-memory FileList.
  // Fallback is read-only and resets per session (browser security limit).
  // Writes degrade to a browser download with the suggested filename.
  function _hasNativeAPI() {
    try { return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'; }
    catch(e) { return false; }
  }
  // v34.96: iOS Safari claims webkitdirectory but ignores it (picker
  // returns nothing). Detect iOS so we degrade to multi-file picker.
  function _isIOS() {
    try {
      var ua = navigator.userAgent || '';
      // iPad on iPadOS 13+ reports as Mac; Touch points distinguish.
      if (/iPhone|iPod/.test(ua)) return true;
      if (/iPad/.test(ua)) return true;
      if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
      return false;
    } catch(e) { return false; }
  }
  function _hasFallbackAPI() {
    try {
      if (typeof document === 'undefined') return false;
      // Folder fallback only works where the BROWSER actually honors
      // the webkitdirectory attribute. iOS Safari lies about it.
      if (_isIOS()) return true; // we'll use multi-file picker instead
      var input = document.createElement('input');
      return ('webkitdirectory' in input);
    } catch(e) { return false; }
  }
  function isSupported() {
    return _hasNativeAPI() || _hasFallbackAPI();
  }
  function getBackend() {
    if (_hasNativeAPI()) return 'native';
    if (_hasFallbackAPI()) return 'fallback';
    return 'none';
  }
  function getFallbackVariant() {
    return _isIOS() ? 'ios-files' : 'webkitdirectory';
  }

  function getMode() {
    try { return localStorage.getItem(MODE_KEY) === 'read' ? 'read' : 'readwrite'; }
    catch(e) { return 'readwrite'; }
  }
  function setMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode === 'read' ? 'read' : 'readwrite'); } catch(e){}
  }
  function isTrustedWrites() {
    try { return localStorage.getItem(TRUST_KEY) === 'true'; } catch(e) { return false; }
  }
  function setTrustedWrites(on) {
    try { localStorage.setItem(TRUST_KEY, on ? 'true' : 'false'); } catch(e){}
  }

  // ─── Permission helpers (native backend) ──────────────────────
  function _ensurePermission(handle, mode) {
    if (!handle || typeof handle.queryPermission !== 'function') return Promise.resolve(false);
    var opts = { mode: mode || getMode() };
    return handle.queryPermission(opts).then(function(state) {
      if (state === 'granted') return true;
      return handle.requestPermission(opts).then(function(s) { return s === 'granted'; });
    }).catch(function(){ return false; });
  }

  function _getRoot() {
    return _idbGet(IDB_KEY).then(function(handle) {
      if (!handle) return null;
      // Native handle has queryPermission; fallback "handle" is just metadata { name }.
      if (typeof handle.queryPermission === 'function') {
        return _ensurePermission(handle, getMode()).then(function(ok) {
          if (!ok) return null;
          return handle;
        });
      }
      return null; // fallback handles aren't browseable directly — _fallbackFiles must be populated
    });
  }

  // ─── Fallback: in-memory FileList ─────────────────────────────
  // Map: relative path (without root prefix) → File object.
  var _fallbackFiles = null;
  var _fallbackRootName = null;
  // v34.96: Sync-cached "is connected" so click handlers can decide
  // connect-vs-disconnect WITHOUT awaiting IDB. Hydrated on module load.
  var _isConnectedSync = false;
  // Hydrate from IDB on module load
  try {
    _idbGet(IDB_KEY).then(function(handle) {
      if (handle && handle.name) _isConnectedSync = true;
    });
  } catch(e){}

  function _fallbackHasFiles() { return !!(_fallbackFiles && _fallbackFiles.size > 0); }
  function isConnectedSync() { return _isConnectedSync || _fallbackHasFiles(); }

  function isConnected() {
    if (_fallbackHasFiles()) return Promise.resolve(true);
    return _getRoot().then(function(h){ return !!h; });
  }

  function getRootName() {
    if (_fallbackHasFiles()) return Promise.resolve(_fallbackRootName);
    return _idbGet(IDB_KEY).then(function(h) {
      return h ? (h.name || null) : null;
    });
  }

  function _connectNative() {
    return window.showDirectoryPicker({
      mode: getMode(),
      id: 'brilliance-workspace',
      startIn: 'documents'
    }).then(function(handle) {
      _isConnectedSync = true;
      return _idbPut(IDB_KEY, handle).then(function() {
        return { ok: true, name: handle.name, backend: 'native' };
      });
    }).catch(function(err) {
      return { ok: false, error: (err && err.message) || 'Folder picker dismissed' };
    });
  }

  // v34.96: Critical — this MUST be called synchronously inside the click
  // handler. Safari requires the input.click() to happen on the same JS
  // task as the user gesture; an async hop (e.g. await IDB) breaks the
  // gesture token and the picker silently no-ops.
  function _connectFallback() {
    return new Promise(function(resolve) {
      var ios = _isIOS();
      var input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('multiple', '');
      if (!ios) {
        // macOS Safari + desktop Firefox: real folder picker.
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
      } else {
        // iOS Safari: there is no folder picker. accept= keeps the system
        // picker filtered to common content types so the user can grab
        // multiple from Files / iCloud Drive in one go.
        input.setAttribute('accept', '*/*');
      }
      // Visible-but-tiny + inside the viewport. Safari rejects file inputs
      // positioned off-screen (display:none, position:absolute left:-9999).
      input.style.cssText = 'position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:auto;z-index:99999;';

      var resolved = false;
      function done(result) {
        if (resolved) return;
        resolved = true;
        try { input.remove(); } catch(e){}
        resolve(result);
      }
      input.addEventListener('change', function() {
        var files = input.files;
        if (!files || files.length === 0) return done({ ok: false, error: 'No files selected' });
        _fallbackFiles = new Map();
        var rootName = null;
        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          var rel = f.webkitRelativePath || '';
          if (rel) {
            var firstSlash = rel.indexOf('/');
            if (!rootName && firstSlash !== -1) rootName = rel.slice(0, firstSlash);
            var pathInside = firstSlash === -1 ? f.name : rel.slice(firstSlash + 1);
            _fallbackFiles.set(pathInside, f);
          } else {
            // iOS / multi-file selection: no folder grouping, just file names.
            _fallbackFiles.set(f.name, f);
          }
        }
        if (!rootName) rootName = ios ? ('Selection (' + files.length + ' files)') : 'Workspace';
        _fallbackRootName = rootName;
        _isConnectedSync = true;
        _idbPut(IDB_KEY, { name: _fallbackRootName, _fallback: true, _ios: ios, connectedAt: Date.now() }).then(function() {
          done({ ok: true, name: _fallbackRootName, backend: 'fallback', variant: ios ? 'ios-files' : 'webkitdirectory', fileCount: _fallbackFiles.size });
        });
      });
      input.addEventListener('cancel', function() { done({ ok: false, error: 'Picker dismissed' }); });
      document.body.appendChild(input);
      // Force focus before click — some Safari builds need the element
      // to be the active element to honor the picker request.
      try { input.focus(); } catch(e){}
      input.click();
      setTimeout(function() { done({ ok: false, error: 'Picker timed out' }); }, 60000);
    });
  }

  function connect() {
    if (_hasNativeAPI()) return _connectNative();
    if (_hasFallbackAPI()) return _connectFallback();
    return Promise.resolve({ ok: false, error: 'File System Access not supported in this browser. Use Chrome, Edge, or the Brilliance desktop app.' });
  }

  function disconnect() {
    _fallbackFiles = null;
    _fallbackRootName = null;
    _isConnectedSync = false;
    return _idbDel(IDB_KEY);
  }

  // ─── Path resolver (walks the relative path) ──────────────────
  function _splitPath(p) {
    if (!p || p === '/' || p === '.') return [];
    return String(p).replace(/^\/+/, '').replace(/\/+$/, '').split('/').filter(Boolean);
  }

  function _resolveDir(root, parts, create) {
    var p = Promise.resolve(root);
    parts.forEach(function(segment) {
      p = p.then(function(dir) {
        return dir.getDirectoryHandle(segment, { create: !!create });
      });
    });
    return p;
  }

  function _resolveFile(root, fullPath, create) {
    var parts = _splitPath(fullPath);
    if (parts.length === 0) return Promise.reject(new Error('No file path'));
    var fileName = parts.pop();
    return _resolveDir(root, parts, create).then(function(dir) {
      return dir.getFileHandle(fileName, { create: !!create });
    });
  }

  // ─── List directory ───────────────────────────────────────────
  function listDirectory(path) {
    if (_fallbackHasFiles()) return _fallbackListDirectory(path);
    return _getRoot().then(function(root) {
      if (!root) throw new Error('No workspace connected. Ask the user to connect a folder in Settings.');
      var parts = _splitPath(path || '');
      return _resolveDir(root, parts, false).then(function(dir) {
        var entries = [];
        var iter = dir.entries();
        function step() {
          return iter.next().then(function(res) {
            if (res.done) return entries;
            var name = res.value[0];
            var handle = res.value[1];
            var entry = {
              name: name,
              path: (parts.length ? parts.join('/') + '/' : '') + name,
              type: handle.kind
            };
            if (handle.kind === 'file') {
              return handle.getFile().then(function(f) {
                entry.size = f.size;
                entry.modified = f.lastModified;
                entries.push(entry);
                return step();
              }).catch(function() { entries.push(entry); return step(); });
            }
            entries.push(entry);
            return step();
          });
        }
        return step();
      });
    });
  }

  // v34.95: Fallback (Safari) — derive directory listing from cached FileList.
  function _fallbackListDirectory(path) {
    var prefix = _splitPath(path || '').join('/');
    if (prefix) prefix += '/';
    var dirs = new Set();
    var files = [];
    _fallbackFiles.forEach(function(file, key) {
      if (prefix && key.indexOf(prefix) !== 0) return;
      var rest = key.slice(prefix.length);
      var slash = rest.indexOf('/');
      if (slash === -1) {
        files.push({ name: rest, path: prefix + rest, type: 'file', size: file.size, modified: file.lastModified });
      } else {
        var dirName = rest.slice(0, slash);
        if (!dirs.has(dirName)) {
          dirs.add(dirName);
        }
      }
    });
    var dirEntries = [];
    dirs.forEach(function(d) {
      dirEntries.push({ name: d, path: prefix + d, type: 'directory' });
    });
    return Promise.resolve(dirEntries.concat(files));
  }

  // ─── Read file (text or binary) ──────────────────────────────
  var TEXT_EXT = ['txt','md','markdown','json','js','jsx','ts','tsx','css','scss','html','htm','xml','yaml','yml','csv','log','py','rb','go','rs','java','c','h','cpp','hpp','swift','kt','sh','bash','zsh','env','toml','ini','conf','sql','vue','svelte','sol','php','lua','r','m','mm','dart','elm','clj','ex','exs'];
  var IMAGE_EXT = ['png','jpg','jpeg','gif','webp','svg','bmp','heic','heif','avif'];

  function _ext(name) {
    var dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  }
  function _isTextExt(e) { return TEXT_EXT.indexOf(e) !== -1; }
  function _isImageExt(e) { return IMAGE_EXT.indexOf(e) !== -1; }

  function readFile(path) {
    if (_fallbackHasFiles()) {
      var key = _splitPath(path).join('/');
      var f = _fallbackFiles.get(key);
      if (!f) return Promise.reject(new Error('File not found in workspace: ' + path));
      return _readFileObject(f, path);
    }
    return _getRoot().then(function(root) {
      if (!root) throw new Error('No workspace connected.');
      return _resolveFile(root, path, false).then(function(handle) {
        return handle.getFile().then(function(file) { return _readFileObject(file, path); });
      });
    });
  }

  function _readFileObject(file, path) {
    var ext = _ext(file.name);
    var meta = { name: file.name, path: path, mime: file.type || '', size: file.size, modified: file.lastModified };
    if (_isImageExt(ext)) {
      return _fileToDataUrl(file).then(function(dataUrl) {
        return Object.assign(meta, { kind: 'image', dataUrl: dataUrl });
      });
    }
    if (_isTextExt(ext) || (file.type && file.type.indexOf('text/') === 0)) {
      var slice = file.size > 524288 ? file.slice(0, 524288) : file;
      return slice.text().then(function(text) {
        return Object.assign(meta, { kind: 'text', text: text, truncated: file.size > 524288 });
      });
    }
    var binSlice = file.size > 262144 ? file.slice(0, 262144) : file;
    return _fileToDataUrl(binSlice).then(function(dataUrl) {
      return Object.assign(meta, { kind: 'binary', dataUrl: dataUrl, truncated: file.size > 262144 });
    });
  }

  function _fileToDataUrl(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  function readImage(path) {
    return readFile(path).then(function(res) {
      if (res.kind !== 'image') throw new Error('File is not an image: ' + path);
      return { dataUrl: res.dataUrl, mime: res.mime, size: res.size };
    });
  }

  // ─── Write file (with confirmation) ──────────────────────────
  function _confirmWrite(action, path, preview) {
    if (isTrustedWrites()) return Promise.resolve(true);
    return new Promise(function(resolve) {
      var modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.cssText = 'display:flex;visibility:visible;opacity:1;position:fixed;top:0;left:0;width:100%;height:100%;z-index:10001;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);align-items:center;justify-content:center;';
      var verb = action === 'delete' ? 'Delete' : (action === 'edit' ? 'Edit' : 'Write');
      var safePath = _escapeHtml(path);
      var safePreview = preview ? _escapeHtml(String(preview).slice(0, 800)) : '';
      modal.innerHTML =
        '<div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:14px;padding:24px;max-width:560px;width:90%;color:var(--text-primary);">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + (action === 'delete' ? '#ef4444' : 'var(--accent)') + '" stroke-width="2"><path d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z"/></svg>' +
            '<div style="font-size:16px;font-weight:600;">' + verb + ' file in your workspace?</div>' +
          '</div>' +
          '<div style="font-family:\'JetBrains Mono\',ui-monospace,monospace;font-size:12px;background:var(--bg-secondary);padding:10px 12px;border-radius:8px;margin-bottom:12px;word-break:break-all;">' + safePath + '</div>' +
          (safePreview ? '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;">Preview</div><pre style="font-size:11px;color:var(--text-secondary);background:var(--bg-secondary);padding:10px 12px;border-radius:8px;max-height:200px;overflow:auto;white-space:pre-wrap;margin-bottom:14px;">' + safePreview + '</pre>' : '') +
          '<div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;">' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-tertiary);margin-right:auto;cursor:pointer;"><input type="checkbox" id="_nfsTrust"> Trust writes for this session</label>' +
            '<button id="_nfsCancel" style="padding:8px 16px;background:transparent;border:1px solid var(--border-color);border-radius:8px;color:var(--text-secondary);cursor:pointer;font-family:inherit;font-size:13px;">Cancel</button>' +
            '<button id="_nfsApprove" style="padding:8px 16px;background:' + (action === 'delete' ? '#ef4444' : 'var(--accent, #a89878)') + ';border:none;border-radius:8px;color:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;">' + verb + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
      var trustEl = modal.querySelector('#_nfsTrust');
      modal.querySelector('#_nfsCancel').onclick = function() {
        modal.remove();
        resolve(false);
      };
      modal.querySelector('#_nfsApprove').onclick = function() {
        if (trustEl && trustEl.checked) setTrustedWrites(true);
        modal.remove();
        resolve(true);
      };
    });
  }

  function _escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function writeFile(path, content) {
    if (getMode() !== 'readwrite') {
      return Promise.resolve({ ok: false, error: 'Workspace is read-only. Switch to read+write in Settings.' });
    }
    // v34.95: Fallback (Safari) can't write back to disk. Trigger a download
    // with the same path/filename so the user can drop the updated file
    // back into their folder. We tell the model what happened via the result.
    if (_fallbackHasFiles()) {
      return _confirmWrite('write', path, content).then(function(approved) {
        if (!approved) return { ok: false, error: 'User declined write' };
        try {
          var parts = _splitPath(path);
          var fname = parts[parts.length - 1] || 'file.txt';
          var blob = new Blob([String(content || '')], { type: 'text/plain' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = fname;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(function() { try { a.remove(); URL.revokeObjectURL(url); } catch(e){} }, 1000);
          if (typeof showToast === 'function') {
            showToast('Saved as a download. Drop it back into your folder to apply the edit.', 'info');
          }
          return {
            ok: true,
            bytes: String(content || '').length,
            note: 'Safari/fallback mode: file was downloaded as "' + fname + '" rather than written in place. Tell the user to move it back into their workspace folder, replacing the original.'
          };
        } catch (err) {
          return { ok: false, error: (err && err.message) || 'Download failed' };
        }
      });
    }
    return _confirmWrite('write', path, content).then(function(approved) {
      if (!approved) return { ok: false, error: 'User declined write' };
      return _getRoot().then(function(root) {
        if (!root) return { ok: false, error: 'No workspace connected.' };
        return _resolveFile(root, path, true).then(function(handle) {
          return handle.createWritable().then(function(writable) {
            return writable.write(String(content || '')).then(function() {
              return writable.close();
            }).then(function() {
              return { ok: true, bytes: String(content || '').length };
            });
          });
        });
      });
    }).catch(function(err) {
      return { ok: false, error: (err && err.message) || 'Write failed' };
    });
  }

  function deleteFile(path) {
    if (getMode() !== 'readwrite') {
      return Promise.resolve({ ok: false, error: 'Workspace is read-only.' });
    }
    // v34.95: Fallback can't delete. Tell the model + user.
    if (_fallbackHasFiles()) {
      return Promise.resolve({
        ok: false,
        error: 'Safari/fallback mode cannot delete files. Ask the user to delete "' + path + '" manually in Finder, or open Brilliance in Chrome/Edge for full delete support.'
      });
    }
    return _confirmWrite('delete', path, null).then(function(approved) {
      if (!approved) return { ok: false, error: 'User declined delete' };
      return _getRoot().then(function(root) {
        if (!root) return { ok: false, error: 'No workspace connected.' };
        var parts = _splitPath(path);
        var fileName = parts.pop();
        return _resolveDir(root, parts, false).then(function(dir) {
          return dir.removeEntry(fileName).then(function() { return { ok: true }; });
        });
      });
    }).catch(function(err) {
      return { ok: false, error: (err && err.message) || 'Delete failed' };
    });
  }

  // ─── Search files (recursive, name + optional content) ───────
  // opts: { query, includeContent (bool), maxResults (default 50), maxDepth (default 6) }
  function searchFiles(opts) {
    opts = opts || {};
    var query = String(opts.query || '').toLowerCase();
    if (!query) return Promise.resolve([]);
    var includeContent = !!opts.includeContent;
    var maxResults = opts.maxResults || 50;
    var maxDepth = opts.maxDepth || 6;
    var results = [];

    // v34.95: Fallback search walks the cached FileList by relative path.
    if (_fallbackHasFiles()) {
      var iter = _fallbackFiles.entries();
      var pending = [];
      var entries = Array.from(_fallbackFiles.entries());
      function fbStep(i) {
        if (i >= entries.length || results.length >= maxResults) return Promise.resolve();
        var key = entries[i][0];
        var file = entries[i][1];
        var name = key.split('/').pop();
        if (name.charAt(0) === '.' || key.indexOf('node_modules/') !== -1 || key.indexOf('.git/') !== -1) {
          return fbStep(i + 1);
        }
        var nameMatch = name.toLowerCase().indexOf(query) !== -1 || key.toLowerCase().indexOf(query) !== -1;
        if (nameMatch) {
          results.push({ path: key, name: name, match: 'name' });
          return fbStep(i + 1);
        }
        if (includeContent && _isTextExt(_ext(name)) && file.size <= 524288) {
          return file.text().then(function(text) {
            var idx = text.toLowerCase().indexOf(query);
            if (idx !== -1) {
              var start = Math.max(0, idx - 60);
              var end = Math.min(text.length, idx + query.length + 60);
              results.push({
                path: key,
                name: name,
                match: 'content',
                snippet: (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
              });
            }
            return fbStep(i + 1);
          }).catch(function(){ return fbStep(i + 1); });
        }
        return fbStep(i + 1);
      }
      return fbStep(0).then(function() { return results; });
    }

    return _getRoot().then(function(root) {
      if (!root) throw new Error('No workspace connected.');
      function walk(dir, prefix, depth) {
        if (results.length >= maxResults || depth > maxDepth) return Promise.resolve();
        var iter = dir.entries();
        function step() {
          if (results.length >= maxResults) return Promise.resolve();
          return iter.next().then(function(res) {
            if (res.done) return;
            var name = res.value[0];
            var handle = res.value[1];
            // skip dotfiles + node_modules + common heavy dirs
            if (name.charAt(0) === '.' || name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') {
              return step();
            }
            var fullPath = prefix + name;
            if (handle.kind === 'directory') {
              return walk(handle, fullPath + '/', depth + 1).then(step);
            }
            // file: check name match first
            var nameMatch = name.toLowerCase().indexOf(query) !== -1;
            if (nameMatch) {
              results.push({ path: fullPath, name: name, match: 'name' });
              return step();
            }
            if (includeContent && _isTextExt(_ext(name))) {
              return handle.getFile().then(function(file) {
                if (file.size > 524288) return step(); // skip giants
                return file.text().then(function(text) {
                  var idx = text.toLowerCase().indexOf(query);
                  if (idx !== -1) {
                    var start = Math.max(0, idx - 60);
                    var end = Math.min(text.length, idx + query.length + 60);
                    results.push({
                      path: fullPath,
                      name: name,
                      match: 'content',
                      snippet: (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
                    });
                  }
                  return step();
                });
              }).catch(step);
            }
            return step();
          });
        }
        return step();
      }
      return walk(root, '', 0).then(function() { return results; });
    });
  }

  // ─── Tool definitions for each provider ───────────────────────
  var TOOL_SPECS = [
    {
      name: 'workspace_list_directory',
      description: 'List the files and folders inside a directory of the user\'s connected workspace. Pass an empty path or "." for the root. Returns an array of entries with name, path, type (file|directory), size (bytes, files only), and modified (epoch ms, files only). Use this to discover the structure before reading specific files.',
      input: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path inside the workspace. Empty string or "." for the root. Forward slashes only.' }
        },
        required: []
      }
    },
    {
      name: 'workspace_read_file',
      description: 'Read the contents of a file from the user\'s connected workspace. Returns text for code / markdown / json / csv / config files, a data URL for images, or a base64 data URL for other binary files. Files over 512KB are truncated; check the truncated flag.',
      input: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file inside the workspace.' }
        },
        required: ['path']
      }
    },
    {
      name: 'workspace_search_files',
      description: 'Search the workspace for files by filename or content substring. Returns up to 50 matches with path, name, match type ("name" or "content"), and a snippet for content matches. Skips dotfiles, node_modules, .git, dist, build.',
      input: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Substring to match (case-insensitive) against filenames and, optionally, file contents.' },
          include_content: { type: 'boolean', description: 'If true, also grep inside text files (slower). Default false.' },
          max_results: { type: 'number', description: 'Maximum number of matches to return (default 50).' }
        },
        required: ['query']
      }
    },
    {
      name: 'workspace_write_file',
      description: 'Write a text file to the user\'s connected workspace. Creates parent directories as needed. The user is prompted to confirm every write unless they granted session-trust. Use this for code edits, generated docs, exports.',
      input: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path inside the workspace. Will overwrite if the file exists.' },
          content: { type: 'string', description: 'Full file content. Always pass the complete intended file body, never a diff.' }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'workspace_delete_file',
      description: 'Delete a file from the user\'s connected workspace. The user is prompted to confirm every delete unless they granted session-trust. Use sparingly.',
      input: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path inside the workspace.' }
        },
        required: ['path']
      }
    }
  ];

  function getAnthropicTools() {
    return TOOL_SPECS.map(function(t) {
      return { name: t.name, description: t.description, input_schema: t.input };
    });
  }
  function getOpenAITools() {
    return TOOL_SPECS.map(function(t) {
      return { type: 'function', function: { name: t.name, description: t.description, parameters: t.input } };
    });
  }
  function getGoogleTools() {
    return [{
      function_declarations: TOOL_SPECS.map(function(t) {
        return { name: t.name, description: t.description, parameters: t.input };
      })
    }];
  }

  // ─── Tool dispatcher ──────────────────────────────────────────
  // v34.94: Normalize incoming paths so absolute /Users/.../<root>/foo
  // becomes "foo" automatically. Saves the model a step.
  function executeTool(name, args) {
    args = args || {};
    return _idbGet(IDB_KEY).then(function(handle) {
      var rootName = handle && handle.name;
      function p(raw) { return _normalizePath(raw, rootName); }
      try {
        switch (name) {
          case 'workspace_list_directory':
            return listDirectory(p(args.path || '')).then(function(r){ return { ok: true, result: r }; });
          case 'workspace_read_file':
            return readFile(p(args.path)).then(function(r){ return { ok: true, result: r }; });
          case 'workspace_search_files':
            return searchFiles({ query: args.query, includeContent: args.include_content, maxResults: args.max_results })
              .then(function(r){ return { ok: true, result: r }; });
          case 'workspace_write_file':
            return writeFile(p(args.path), args.content);
          case 'workspace_delete_file':
            return deleteFile(p(args.path));
          default:
            return Promise.resolve({ ok: false, error: 'Unknown workspace tool: ' + name });
        }
      } catch (err) {
        return Promise.resolve({ ok: false, error: (err && err.message) || String(err) });
      }
    }).catch(function(err) {
      return { ok: false, error: (err && err.message) || String(err) };
    });
  }

  // ─── Capability advertisement for system prompts ──────────────
  // v34.94: Returns a context-aware addendum. When connected, includes the
  // root folder name and tells the model how to translate absolute paths.
  // When NOT connected, instructs the model to direct the user to Settings
  // instead of saying "I don't have access".
  function getSystemPromptAddendum() {
    var backend = getBackend();
    return _idbGet(IDB_KEY).then(function(handle) {
      var isFallbackConn = _fallbackHasFiles();
      if ((handle && handle.name) || isFallbackConn) {
        var rootName = isFallbackConn ? _fallbackRootName : handle.name;
        var fallbackNote = isFallbackConn
          ? [
              '',
              '⚠ FALLBACK MODE (Safari / iOS PWA): you have READ access only this session.',
              '   Writes degrade to a browser download for the user to drop back into the folder.',
              '   Deletes are not supported — ask the user to delete in Finder.',
              '   The connection resets when the user closes Brilliance — they\'ll need to re-pick the folder next time.',
              ''
            ].join('\n')
          : '';
        return [
          '',
          '── NATIVE WORKSPACE (CONNECTED) ──',
          'The user has connected the folder "' + rootName + '" to Brilliance.',
          'You have read, search, and (with confirmation) write access via the',
          'workspace_* tools. PATHS ARE RELATIVE to the workspace root.',
          fallbackNote,
          'Path handling rules:',
          '- The workspace root is named "' + rootName + '". An empty string or "." refers to the root.',
          '- If the user gives an absolute path like /Users/<name>/Downloads/' + rootName + '/foo,',
          '  the relative path is just "foo". Strip everything up to and including "' + rootName + '/".',
          '- If the user gives an absolute path that does NOT contain "' + rootName + '",',
          '  it is OUTSIDE your sandbox. Tell them to either reconnect the parent folder',
          '  or move the file inside the connected workspace.',
          '',
          'Tool guidance:',
          '- Start with workspace_list_directory("") when exploring.',
          '- Reads are silent. Writes and deletes always prompt the user, so use them freely.',
          '- When the user asks for a file, ALWAYS try the tool first instead of saying you can\'t access it.',
          ''
        ].join('\n');
      }
      // Not connected — still tell the model the feature exists.
      var supportedNote;
      if (backend === 'native') {
        supportedNote = 'Direct them to Settings → Connections → Native Workspace and click "Connect a folder". Full read + write.';
      } else if (backend === 'fallback') {
        supportedNote = 'They\'re on Safari, which only supports a read-only fallback. Direct them to Settings → Connections → Native Workspace → Connect a folder. Reads will work; writes will produce downloads they drop back into the folder.';
      } else {
        supportedNote = 'Their browser does not support folder access at all. Tell them to use Chrome, Edge, or the Brilliance desktop app.';
      }
      return [
        '',
        '── NATIVE WORKSPACE (NOT CONNECTED) ──',
        'The user has NOT connected a local folder to Brilliance yet.',
        'If they reference a local file path (e.g. /Users/.../Downloads/...) or',
        'ask you to read, search, or edit files on their computer, do not say',
        '"I don\'t have access". Instead: ' + supportedNote,
        'After they connect, ask them to repeat the request and you can use',
        'the workspace_* tools to fulfill it.',
        ''
      ].join('\n');
    }).catch(function() { return ''; });
  }

  // v34.94: Path normalizer. Accepts either a relative path inside the
  // workspace OR an absolute path that contains the workspace root name,
  // and returns the relative form. Used by every tool entry point.
  function _normalizePath(p, rootName) {
    if (!p) return '';
    var s = String(p).trim();
    if (!s) return '';
    // Strip file:// if present
    s = s.replace(/^file:\/\//, '');
    // Already relative — done
    if (s.charAt(0) !== '/' && !/^[A-Za-z]:[\\\/]/.test(s)) return s;
    // Absolute — try to strip up through the workspace root segment
    if (rootName) {
      var marker = '/' + rootName + '/';
      var idx = s.indexOf(marker);
      if (idx !== -1) return s.slice(idx + marker.length);
      if (s.endsWith('/' + rootName) || s === '/' + rootName) return '';
    }
    // Couldn't translate — return as-is and let the resolver throw a useful error.
    return s;
  }

  // ─── Settings UI helpers ──────────────────────────────────────
  function refreshNativeWorkspaceUI() {
    var statusEl = document.getElementById('nativeWorkspaceStatus');
    var descEl = document.getElementById('nativeWorkspaceDesc');
    var modeRow = document.getElementById('nativeWorkspaceModeRow');
    var modeText = document.getElementById('nativeWorkspaceModeText');
    var modeDesc = document.getElementById('nativeWorkspaceModeDesc');
    var trustRow = document.getElementById('nativeWorkspaceTrustRow');
    var trustText = document.getElementById('nativeWorkspaceTrustText');
    if (!statusEl) return;

    if (!isSupported()) {
      statusEl.textContent = 'Unsupported';
      if (descEl) descEl.textContent = 'Your browser does not support folder access. Use Chrome, Edge, or the Brilliance desktop app.';
      if (modeRow) modeRow.style.display = 'none';
      if (trustRow) trustRow.style.display = 'none';
      return;
    }
    var backend = getBackend();
    // v34.108: pull the other-device folder name (set by 22-firebase-sync.js when a cloud
    // pull sees native_workspace.lastFolderName). We surface it inline in the description
    // so the user knows another device is connected and can choose to connect locally
    // here, instead of getting a repeating toast on every sync.
    var _xdName = '';
    try { _xdName = localStorage.getItem('roweos_native_fs_xdevice_name') || ''; } catch(_e){}
    getRootName().then(function(name) {
      if (name) {
        statusEl.textContent = 'Disconnect';
        if (descEl) {
          if (backend === 'fallback' && _fallbackHasFiles()) {
            descEl.textContent = 'Connected (read-only): ' + name + ' · ' + _fallbackFiles.size + ' files cached this session';
          } else if (backend === 'fallback') {
            descEl.textContent = 'Last folder: ' + name + ' · re-pick to reconnect (Safari fallback)';
          } else {
            descEl.textContent = 'Connected: ' + name;
          }
        }
        if (modeRow) modeRow.style.display = backend === 'native' ? '' : 'none';
        if (trustRow) trustRow.style.display = backend === 'native' ? '' : 'none';
        var mode = getMode();
        if (modeText) modeText.textContent = mode === 'read' ? 'Read only' : 'Read + Write';
        if (modeDesc) modeDesc.textContent = mode === 'read' ? 'Brilliance can read but cannot edit files.' : 'Brilliance can edit files (each write confirms).';
        if (trustText) trustText.textContent = isTrustedWrites() ? 'On' : 'Off';
      } else {
        statusEl.textContent = backend === 'fallback' ? 'Connect (Safari)' : 'Connect';
        if (descEl) {
          // v34.108: when not connected locally but another device IS connected,
          // tell the user inline (no toast) so they can choose to connect here.
          if (_xdName) {
            descEl.textContent = backend === 'fallback'
              ? 'Read-only Safari fallback. Connected on another device as "' + _xdName + '". Pick a folder here to connect this device.'
              : 'Connected on another device as "' + _xdName + '". Pick a folder here to connect this device too, or change which folder.';
          } else {
            descEl.textContent = backend === 'fallback'
              ? 'Read-only Safari fallback. For full read+write, use Chrome or Edge.'
              : 'Not connected';
          }
        }
        if (modeRow) modeRow.style.display = 'none';
        if (trustRow) trustRow.style.display = 'none';
      }
    });
  }

  // v34.93: Mirror local intent to Firestore so a second device can prompt
  // the user to connect a local folder. Folder NAMES + mode + onboarded
  // flag only — the FileSystemDirectoryHandle is per-device by design.
  function _pushPreferenceToCloud(folderName) {
    try {
      if (typeof writeDB !== 'function') return;
      var pref = {
        onboarded: true,
        onboardedAt: Date.now(),
        lastFolderName: folderName || null,
        mode: getMode(),
        lastConnectedAt: folderName ? Date.now() : null
      };
      writeDB('profile/main', { native_workspace: pref });
    } catch(e){}
  }

  // v34.96: SYNCHRONOUSLY decide connect-vs-disconnect based on the
  // hydrated _isConnectedSync flag, then fire the picker on the same JS
  // task as the click. Awaiting IDB here (the previous bug) breaks the
  // user-gesture token in Safari and the picker silently no-ops.
  function toggleNativeWorkspace() {
    if (!isSupported()) {
      if (typeof showToast === 'function') showToast('Your browser does not support folder access. Use Chrome or Edge.', 'warning');
      return;
    }
    if (isConnectedSync()) {
      // disconnect can be async without breaking gestures
      var name = _fallbackRootName || '(workspace)';
      if (!confirm('Disconnect the workspace folder "' + name + '"?')) return;
      disconnect().then(function() {
        if (typeof showToast === 'function') showToast('Workspace disconnected.', 'info');
        refreshNativeWorkspaceUI();
        _pushPreferenceToCloud(null);
      });
      return;
    }
    // Picker MUST fire synchronously inside this gesture.
    if (typeof showToast === 'function') showToast('Opening folder picker...', 'info');
    var pickerPromise = connect();
    pickerPromise.then(function(res) {
      if (res.ok) {
        if (typeof showToast === 'function') {
          var msg = 'Workspace connected: ' + res.name;
          if (res.fileCount) msg += ' (' + res.fileCount + ' files)';
          showToast(msg, 'success');
        }
        _pushPreferenceToCloud(res.name);
      } else if (res.error && res.error.indexOf('dismissed') === -1 && res.error.indexOf('No files') === -1) {
        if (typeof showToast === 'function') showToast('Could not connect: ' + res.error, 'error');
        console.warn('[NativeFS] connect failed:', res.error);
      }
      refreshNativeWorkspaceUI();
    });
  }

  function toggleNativeWorkspaceMode() {
    var next = getMode() === 'read' ? 'readwrite' : 'read';
    setMode(next);
    if (typeof showToast === 'function') showToast(next === 'read' ? 'Workspace is now read-only.' : 'Workspace is now read + write.', 'info');
    refreshNativeWorkspaceUI();
    getRootName().then(function(n) { _pushPreferenceToCloud(n); });
  }

  function toggleNativeWorkspaceTrust() {
    var next = !isTrustedWrites();
    setTrustedWrites(next);
    if (typeof showToast === 'function') showToast(next ? 'Trusted writes for this session.' : 'Confirmations re-enabled.', 'info');
    refreshNativeWorkspaceUI();
  }

  // ─── Export ───────────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    window.refreshNativeWorkspaceUI = refreshNativeWorkspaceUI;
    window.toggleNativeWorkspace = toggleNativeWorkspace;
    window.toggleNativeWorkspaceMode = toggleNativeWorkspaceMode;
    window.toggleNativeWorkspaceTrust = toggleNativeWorkspaceTrust;
    window.NativeFS = {
      isSupported: isSupported,
      getBackend: getBackend,
      getFallbackVariant: getFallbackVariant,
      isConnected: isConnected,
      isConnectedSync: isConnectedSync,
      getRootName: getRootName,
      connect: connect,
      disconnect: disconnect,
      getMode: getMode,
      setMode: setMode,
      isTrustedWrites: isTrustedWrites,
      setTrustedWrites: setTrustedWrites,
      listDirectory: listDirectory,
      readFile: readFile,
      readImage: readImage,
      writeFile: writeFile,
      deleteFile: deleteFile,
      searchFiles: searchFiles,
      executeTool: executeTool,
      getAnthropicTools: getAnthropicTools,
      getOpenAITools: getOpenAITools,
      getGoogleTools: getGoogleTools,
      getSystemPromptAddendum: getSystemPromptAddendum
    };
  }
})();
