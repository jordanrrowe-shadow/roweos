// ============================================================================
// 33-scribe.js - Scribe Notebook System
// v29.0: Complete notebook system with CRUD, rich editing, metadata, knowledge mode
// ============================================================================

// === DATA === // v29.0:
var scribeNotebooks = []; // v29.0: loaded from localStorage
var _scribeActiveId = null; // v29.0: currently selected notebook ID
var _scribeAutoSaveTimer = null; // v29.0: debounce timer for auto-save
var _scribeKnowledgeMode = true; // v29.2: knowledge panel ON by default
var _scribeKnowledgeThread = []; // v29.0: Q&A thread messages

var SCRIBE_STORAGE_KEY = 'roweos_scribe_notebooks'; // v29.0:
var _scribeShowAllBrands = false; // v29.3: Brand filter toggle
var _scribeArchiveMode = false; // v29.3: Archive view toggle (for later)
var _scribeActivePageId = null; // v29.3: Currently editing page (null = notebook level)
var _scribeExpandedNotebooks = {}; // v29.3: Track expanded notebooks in sidebar

// v34.116: Notebook recovery utility. Scans every place a previous notebook list
// might still exist - Firestore local cache (Firebase's IndexedDB persistence
// retains the last-known document even after a destructive write to cloud),
// localStorage backup snapshot, recovery breadcrumb, server cloud doc - and
// merges everything by id into a single restored set. Surfaced as
// window.recoverNotebooks() so the user can run it from console or from a
// future Settings → Notebooks → Restore button.
window.recoverNotebooks = function recoverNotebooks() {
  return new Promise(function(resolve) {
    var sources = {};
    var add = function(name, list) {
      if (!Array.isArray(list)) return;
      var clean = list.filter(function(n) { return n && n.id; });
      if (clean.length > 0) sources[name] = clean;
    };

    // Source 1: current in-memory list (whatever loadScribeNotebooks produced)
    add('memory', scribeNotebooks);

    // Source 2: localStorage primary key
    try {
      var rawA = localStorage.getItem('roweos_scribe_notebooks');
      if (rawA) add('localStorage_primary', JSON.parse(rawA));
    } catch(e) {}

    // Source 3: rolling backup (v34.115+)
    try {
      var rawB = localStorage.getItem('roweos_scribe_notebooks_backup');
      if (rawB) add('localStorage_backup', JSON.parse(rawB));
    } catch(e) {}

    // Source 4: pending-create breadcrumb (v34.110+, single notebook)
    try {
      var rawC = localStorage.getItem('roweos_scribe_pending_create');
      if (rawC) {
        var pc = JSON.parse(rawC);
        if (pc && pc.nb && pc.nb.id) add('pending_create_breadcrumb', [pc.nb]);
      }
    } catch(e) {}

    // Source 5: any other localStorage keys that look like notebook arrays.
    // Heuristic - keys containing "scribe" or "notebook" with array-shaped JSON
    // whose first element has the notebook fields. Catches stale snapshots
    // saved by experimental code paths or earlier versions.
    try {
      for (var li = 0; li < localStorage.length; li++) {
        var k = localStorage.key(li);
        if (!k) continue;
        if (k === 'roweos_scribe_notebooks' || k === 'roweos_scribe_notebooks_backup') continue;
        if (!/scribe|notebook/i.test(k)) continue;
        try {
          var v = localStorage.getItem(k);
          if (!v || v.charAt(0) !== '[') continue;
          var parsed = JSON.parse(v);
          if (Array.isArray(parsed) && parsed.length > 0
              && parsed[0] && typeof parsed[0] === 'object'
              && parsed[0].id && (parsed[0].title !== undefined || parsed[0].content !== undefined)) {
            add('ls_' + k, parsed);
          }
        } catch(eP) {}
      }
    } catch(e) {}

    // Source 6: Firestore - read from CACHE only (no network). Firebase's
    // IndexedDB persistence retains the most recent server snapshot. Even if
    // cloud was overwritten, this cache may still hold the previous state
    // from before the wipe propagated.
    var firestorePromises = [];
    if (typeof firebase !== 'undefined' && firebase.firestore && firebaseUser && firebaseUser.uid) {
      var basePath = 'roweos_users/' + firebaseUser.uid + '/scribe/notebooks';
      firestorePromises.push(
        firebase.firestore().doc(basePath).get({ source: 'cache' }).then(function(doc) {
          if (doc.exists) {
            var data = doc.data();
            if (data && Array.isArray(data.notebooks)) add('firestore_cache', data.notebooks);
          }
        }).catch(function(){})
      );
      // Also try server source as a separate channel - if cloud somehow has
      // newer/different data, we'd want to see it.
      firestorePromises.push(
        firebase.firestore().doc(basePath).get({ source: 'server' }).then(function(doc) {
          if (doc.exists) {
            var data = doc.data();
            if (data && Array.isArray(data.notebooks)) add('firestore_server', data.notebooks);
          }
        }).catch(function(){})
      );
    }

    Promise.all(firestorePromises).then(function() {
      // Merge all sources by id, preferring the highest _modifiedAt.
      var byId = {};
      var sourceCount = Object.keys(sources).length;
      Object.keys(sources).forEach(function(srcName) {
        sources[srcName].forEach(function(nb) {
          if (!byId[nb.id]) {
            byId[nb.id] = { nb: nb, fromSources: [srcName] };
          } else {
            byId[nb.id].fromSources.push(srcName);
            // Prefer the version with higher _modifiedAt
            var existingTs = byId[nb.id].nb._modifiedAt || 0;
            var newTs = nb._modifiedAt || 0;
            if (newTs > existingTs) byId[nb.id].nb = nb;
          }
        });
      });

      var recovered = [];
      Object.keys(byId).forEach(function(id) { recovered.push(byId[id].nb); });
      // Sort by updatedAt descending so the most recent are first
      recovered.sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });

      var report = {
        sources: sourceCount,
        sourceNames: Object.keys(sources),
        recovered: recovered.length,
        notebooks: recovered,
        details: byId
      };

      console.log('[recoverNotebooks] Sources scanned:', sourceCount, '/ Notebooks recovered:', recovered.length);
      console.log('[recoverNotebooks] Sources:', report.sourceNames);
      console.log('[recoverNotebooks] Per-notebook source map:', byId);

      // v34.117: ADDITIVE-ONLY recovery. Previous version replaced the entire
      // scribeNotebooks array if recovered.length > current.length, then pushed
      // the result to cloud via writeDB. That cascade could overwrite cloud
      // with whatever happened to be in Firestore's stale local cache, which
      // is the OPPOSITE of safe. Now: union the recovered set INTO the current
      // list, only adding ids that aren't already present, never replacing or
      // removing anything. The union is then written to localStorage and only
      // pushed to cloud if at least one notebook was added (otherwise it's a
      // no-op). The cloud write goes through the normal saveScribeNotebooks
      // path which has its own empty-list guard.
      var current = Array.isArray(scribeNotebooks) ? scribeNotebooks.slice() : [];
      var existingIds = {};
      current.forEach(function(nb) { if (nb && nb.id) existingIds[nb.id] = true; });
      var added = 0;
      recovered.forEach(function(nb) {
        if (nb && nb.id && !existingIds[nb.id]) {
          current.unshift(nb);
          existingIds[nb.id] = true;
          added++;
        }
      });
      if (added > 0) {
        scribeNotebooks = current;
        // Use saveScribeNotebooks rather than direct localStorage + writeDB so
        // the safety guard + backup-snapshot + empty-list-skip protections
        // all apply to the recovered state too.
        if (typeof saveScribeNotebooks === 'function') saveScribeNotebooks();
        if (typeof renderScribeNotebookList === 'function') renderScribeNotebookList();
        if (typeof showToast === 'function') {
          showToast('Recovered ' + added + ' missing notebook' + (added === 1 ? '' : 's'), 'success');
        }
      } else if (recovered.length > 0) {
        if (typeof showToast === 'function') {
          showToast('All ' + recovered.length + ' recoverable notebook' + (recovered.length === 1 ? '' : 's') + ' already in your list', 'info');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast('No recoverable notebooks found in any source', 'warning');
        }
      }

      resolve(report);
    });
  });
};

// === LOAD / SAVE === // v29.0:

function loadScribeNotebooks() { // v29.0:
  // v34.67 Phase C #9: prefer v5 when reads flag is on; v4 fallback otherwise.
  function _v4Read() {
    try {
      var raw = localStorage.getItem(SCRIBE_STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[Scribe] Failed to load notebooks:', e);
      return [];
    }
  }
  try {
    if (typeof window !== 'undefined' && window.SyncV5 && typeof window.SyncV5.readArray === 'function') {
      scribeNotebooks = window.SyncV5.readArray('scribe_v5', _v4Read);
    } else {
      scribeNotebooks = _v4Read();
    }
    if (!Array.isArray(scribeNotebooks)) scribeNotebooks = [];
  } catch (e) {
    console.warn('[Scribe] Failed to load notebooks:', e);
    scribeNotebooks = [];
  }
}

function saveScribeNotebooks() { // v29.0:
  // v34.115: SAFETY GUARD against accidental empty-array writes. The autosave
  // path can fire during TinyMCE init / notebook-select windows where the
  // editor is briefly empty. If scribeNotebooks somehow shrank to 0 but the
  // backup says we had notebooks recently, abort the save - something corrupt
  // is happening and we don't want to write [] to localStorage AND propagate
  // it to Firestore via writeDB. The user can still explicitly delete via
  // deleteScribeNotebook which doesn't go through this path's empty check.
  try {
    if ((!scribeNotebooks || scribeNotebooks.length === 0)) {
      var _backupRaw = localStorage.getItem('roweos_scribe_notebooks_backup');
      if (_backupRaw) {
        var _backup = JSON.parse(_backupRaw);
        if (Array.isArray(_backup) && _backup.length > 0) {
          console.warn('[Scribe] Refusing to save empty list - backup has', _backup.length, 'notebooks. Restoring.');
          scribeNotebooks = _backup;
          // fall through to normal save path with restored data
        }
      }
    }
  } catch(_eGuard) {}
  try {
    localStorage.setItem(SCRIBE_STORAGE_KEY, JSON.stringify(scribeNotebooks));
    // v34.115: rolling backup. Keeps a snapshot of the last known-good
    // notebook list so the empty-write guard above can restore. Updated only
    // when the array has at least one entry, so a real "delete the last
    // notebook" still works.
    if (scribeNotebooks && scribeNotebooks.length > 0) {
      try { localStorage.setItem('roweos_scribe_notebooks_backup', JSON.stringify(scribeNotebooks)); } catch(_eBk) {}
    }
  } catch (e) {
    console.warn('[Scribe] Failed to save notebooks:', e);
  }
  // v34.110: clear the pending-create breadcrumb once the just-created notebook
  // is confirmed in the saved array. Any save that still contains the id is
  // proof of life. If the id is missing on a save (i.e. it was deleted),
  // we leave the breadcrumb alone so the next init's recovery check can see
  // it - the user may have lost the notebook to an SDK assertion.
  try {
    var _pendingRaw = localStorage.getItem('roweos_scribe_pending_create');
    if (_pendingRaw) {
      var _pending = JSON.parse(_pendingRaw);
      if (_pending && _pending.id) {
        var _stillThere = false;
        for (var _pi = 0; _pi < scribeNotebooks.length; _pi++) {
          if (scribeNotebooks[_pi] && scribeNotebooks[_pi].id === _pending.id) { _stillThere = true; break; }
        }
        if (_stillThere) localStorage.removeItem('roweos_scribe_pending_create');
      }
    }
  } catch(_eP) {}
  // v34.117: HARD SAFETY - never write empty notebooks to cloud. If the
  // in-memory array is somehow empty at this point (despite the safety guard
  // above and the backup restore), skip the writeDB call entirely. Cloud
  // overwrites are the destructive direction; localStorage was already written
  // a few lines up. The next saveScribeNotebooks call with real data will
  // push to cloud normally.
  if (!scribeNotebooks || scribeNotebooks.length === 0) {
    console.warn('[Scribe] Skipping cloud write - notebooks array is empty');
    return;
  }
  // v29.0: Write-through to Firebase (same pattern as Pulse goals).
  // v33.31 (Sprint 1 pilot): use the services/sync facade. Bridge forwards all
  // positional args including the options object, so behavior matches the legacy
  // global. Falls back gracefully if the bridge isn't loaded yet.
  try {
    if (typeof window !== 'undefined' && window.BrillianceServices && window.BrillianceServices.sync) {
      window.BrillianceServices.sync.writeDB('scribe/notebooks', { notebooks: scribeNotebooks }, { category: 'scribe' });
    } else if (typeof writeDB === 'function') {
      writeDB('scribe/notebooks', { notebooks: scribeNotebooks }, { category: 'scribe' });
    }
  } catch(e) {
    if (typeof writeDB === 'function') writeDB('scribe/notebooks', { notebooks: scribeNotebooks }, { category: 'scribe' });
  }
}

// v29.2: TinyMCE state
var _scribeTinymceReady = false;

// === INIT === // v29.0:

function initScribe() { // v29.2:
  loadScribeNotebooks();
  // v34.115: backup-restore check. If load returned empty but our rolling
  // backup has notebooks, restore from backup.
  // v34.117: REMOVED auto-invocation of recoverNotebooks(). Recovery is now
  // strictly user-initiated via the console or the Settings → Sync surface.
  // The auto-invoke combined with cloud-cache reads created an edge case
  // where stale Firestore cache state could be pushed BACK to cloud,
  // potentially overwriting newer real data. Backup-restore stays - that's
  // strictly local and additive.
  if (!scribeNotebooks || scribeNotebooks.length === 0) {
    try {
      var _bkRaw = localStorage.getItem('roweos_scribe_notebooks_backup');
      if (_bkRaw) {
        var _bk = JSON.parse(_bkRaw);
        if (Array.isArray(_bk) && _bk.length > 0) {
          scribeNotebooks = _bk;
          console.warn('[Scribe] Restored', _bk.length, 'notebooks from backup snapshot');
          // Don't call saveScribeNotebooks - that pushes to cloud. Just persist
          // the restored list to localStorage so the next save uses it.
          try { localStorage.setItem(SCRIBE_STORAGE_KEY, JSON.stringify(_bk)); } catch(_eL){}
          if (typeof showToast === 'function') {
            showToast('Restored ' + _bk.length + ' notebook' + (_bk.length === 1 ? '' : 's') + ' from backup', 'info');
          }
        }
      }
    } catch(_eBkR) {}
  }
  // v34.117: take a backup snapshot RIGHT NOW if we have notebooks but no
  // backup yet. Catches any user who loaded the app pre-v34.115 - now they
  // get a backup at the moment they next open the Notebooks view, so future
  // wipes have somewhere to restore from.
  try {
    if (scribeNotebooks && scribeNotebooks.length > 0) {
      var _existingBk = localStorage.getItem('roweos_scribe_notebooks_backup');
      if (!_existingBk) {
        localStorage.setItem('roweos_scribe_notebooks_backup', JSON.stringify(scribeNotebooks));
        console.log('[Scribe] Created initial backup snapshot of', scribeNotebooks.length, 'notebooks');
      }
    }
  } catch(_eIBK) {}
  // v34.110: recovery check. If the previous session created a notebook
  // (breadcrumb in roweos_scribe_pending_create) but it is missing from the
  // loaded list, restore it. This catches the rare "I made a notebook then
  // it vanished after I closed out" path - typically caused by a Firestore
  // SDK INTERNAL ASSERTION mid-write that left the in-memory state empty
  // before the next save persisted it. Backup is the full notebook object
  // captured at create time.
  try {
    var _recRaw = localStorage.getItem('roweos_scribe_pending_create');
    if (_recRaw) {
      var _rec = JSON.parse(_recRaw);
      if (_rec && _rec.id && _rec.nb) {
        var _foundRec = false;
        for (var _ri = 0; _ri < scribeNotebooks.length; _ri++) {
          if (scribeNotebooks[_ri] && scribeNotebooks[_ri].id === _rec.id) { _foundRec = true; break; }
        }
        if (!_foundRec) {
          console.warn('[Scribe] Recovering lost notebook from previous session:', _rec.id);
          scribeNotebooks.unshift(_rec.nb);
          saveScribeNotebooks();
          if (typeof showToast === 'function') showToast('Recovered notebook from previous session', 'info');
        } else {
          // The notebook is in the list - clear the breadcrumb.
          localStorage.removeItem('roweos_scribe_pending_create');
        }
      }
    }
  } catch(_eR) {}
  // v34.110: belt-and-suspenders save flush before the page unloads. Catches
  // the case where TinyMCE's debounced autosave (~500ms after change) hadn't
  // fired yet when the user closed the tab. Idempotent - a no-op if the
  // notebooks array is already persisted.
  if (!window._scribeUnloadWired) {
    window._scribeUnloadWired = true;
    window.addEventListener('beforeunload', function() {
      try { localStorage.setItem(SCRIBE_STORAGE_KEY, JSON.stringify(scribeNotebooks)); } catch(_eU) {}
    });
  }
  renderScribeNotebookList();
  if (scribeNotebooks.length > 0) {
    var lastActive = _scribeActiveId;
    var found = false;
    if (lastActive) {
      for (var i = 0; i < scribeNotebooks.length; i++) {
        if (scribeNotebooks[i].id === lastActive) { found = true; break; }
      }
    }
    if (!found) {
      var sorted = scribeNotebooks.filter(function(nb) { return !nb.archived; });
      sorted.sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
      if (sorted.length > 0) {
        selectScribeNotebook(sorted[0].id);
      } else {
        _showScribeEmptyState();
      }
    } else {
      selectScribeNotebook(lastActive);
    }
  } else {
    _showScribeEmptyState();
  }
  // v29.2: Defer TinyMCE init - view needs to be fully visible first
  setTimeout(function() {
    initScribeTinymce();
  }, 200);
  setTimeout(function() { initScribeResizeHandle(); }, 300); // v29.3:
}

// v29.2: Initialize TinyMCE for Scribe editor
function initScribeTinymce() {
  if (_scribeTinymceReady) return;
  if (typeof tinymce === 'undefined') return;

  var _isLightMode = document.documentElement.classList.contains('light-mode');
  tinymce.init({
    selector: '#scribeContentArea',
    skin: _isLightMode ? 'oxide' : 'oxide-dark',
    content_css: _isLightMode ? 'default' : 'dark',
    height: '100%',
    menubar: false,
    statusbar: false,
    branding: false,
    promotion: false,
    resize: false,
    // v34.114: removed `wordcount` plugin. It was loaded in addition to our own
    // updateScribeWordCount and walked the whole document on every keystroke for
    // its built-in counter. Our custom debounced counter is enough; the plugin
    // was the major typing-lag contributor on long notebooks. Toolbar entry
    // also dropped (it was just a stat readout, not an action).
    plugins: 'lists link image table code searchreplace fullscreen autolink preview',
    toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | hr blockquote | code fullscreen searchreplace',
    toolbar_mode: 'wrap',
    content_style: _isLightMode
      ? 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; color: #333; background: #fff; line-height: 1.7; padding: 16px; } a { color: #6d6352; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ddd; padding: 8px; } blockquote { border-left: 3px solid #a89878; margin: 12px 0; padding: 8px 16px; opacity: 0.85; } img { max-width: 100%; height: auto; } code { background: rgba(168,152,120,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; } pre { background: rgba(0,0,0,0.04); padding: 12px; border-radius: 8px; overflow-x: auto; }'
      : 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; color: #e8e0d4; background: #1a1816; line-height: 1.7; padding: 16px; } a { color: #a89878; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #333; padding: 8px; } blockquote { border-left: 3px solid #a89878; margin: 12px 0; padding: 8px 16px; opacity: 0.85; } img { max-width: 100%; height: auto; } code { background: rgba(168,152,120,0.15); padding: 2px 6px; border-radius: 4px; font-family: monospace; } pre { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; overflow-x: auto; }',
    setup: function(editor) {
      // v34.114: consolidated to a single keyup handler. The previous
      // `editor.on('change keyup', ...)` ran the body TWICE per keystroke since
      // both events fire per char in TinyMCE 7.
      // v34.115: REVERTED v34.114's separate SetContent/ExecCommand autosave
      // hook - it fired whenever editor.setContent() was called during a
      // notebook-select, then 1s later saveActiveScribeNotebook ran with the
      // newly-loaded editor state but on the just-selected notebook's id,
      // potentially writing partial content during the TinyMCE init timing
      // window. Toolbar formatting + paste are still caught via the keyup
      // handler (TinyMCE 7 fires keyup on most user interactions including
      // toolbar clicks via keyboard), and `change` is added back for the cases
      // keyup misses. Both are still debounced internally.
      editor.on('keyup change', function() {
        scheduleScribeAutoSave();
        updateScribeWordCount();
      });
      editor.on('init', function() {
        _scribeTinymceReady = true;
        // v29.2: If a notebook was selected before TinyMCE was ready, load its content now
        if (_scribeActiveId) {
          var nb = null;
          for (var i = 0; i < scribeNotebooks.length; i++) {
            if (scribeNotebooks[i].id === _scribeActiveId) { nb = scribeNotebooks[i]; break; }
          }
          if (nb) {
            // v29.3: Load page content if a page is active
            if (_scribeActivePageId && nb.pages) {
              for (var pi = 0; pi < nb.pages.length; pi++) {
                if (nb.pages[pi].id === _scribeActivePageId) {
                  editor.setContent(nb.pages[pi].content || '');
                  break;
                }
              }
            } else {
              editor.setContent(nb.content || '');
            }
          }
        }
        // v29.3: Initialize @-mention autocomplete
        initScribeMentions();
      });
    }
  });
}

// v34.63: Re-init TinyMCE on theme toggle so iframe content_style picks up
// the new dark/light palette. Without this, the editor body keeps the
// background it had at first init — producing the white-bleed shown in
// Image #65 when a user toggled mode after opening Scribe.
function reinitScribeTinymceForTheme() {
  try {
    if (typeof tinymce === 'undefined') return;
    if (!_scribeTinymceReady) return;
    var existing = tinymce.get('scribeContentArea');
    if (!existing) return;
    var savedContent = '';
    try { savedContent = existing.getContent() || ''; } catch (e) { savedContent = ''; }
    tinymce.remove('#scribeContentArea');
    _scribeTinymceReady = false;
    setTimeout(function() {
      initScribeTinymce();
      // restore content once new editor has finished init
      var pollAttempts = 0;
      var pollId = setInterval(function() {
        pollAttempts++;
        var ed = tinymce.get('scribeContentArea');
        if (ed && _scribeTinymceReady) {
          try { ed.setContent(savedContent); } catch (e) {}
          clearInterval(pollId);
        } else if (pollAttempts > 40) {
          clearInterval(pollId);
        }
      }, 50);
    }, 30);
  } catch (e) { /* swallow — non-critical UI refresh */ }
}

function _showScribeEmptyState() { // v29.0:
  _scribeActiveId = null;
  var editorArea = document.getElementById('scribeActiveEditor');
  var emptyState = document.getElementById('scribeEmptyState');
  if (editorArea) editorArea.style.display = 'none';
  if (emptyState) emptyState.style.display = 'flex';
}

// === CRUD === // v29.0:

function createScribeNotebook() { // v29.0:
  var now = new Date().toISOString();
  var ts = Date.now();
  var nb = {
    id: 'nb_' + ts + '_' + Math.random().toString(36).substr(2, 6),
    title: 'Untitled Notebook',
    content: '',
    pages: [],  // v29.3: Sub-pages array
    sources: [],
    linkedPeople: [],
    linkedLibraryItems: [],
    tags: [],
    brandIdx: (typeof selectedBrand !== 'undefined' ? selectedBrand : null),
    // v34.71 Life parity gap #2: was checking `currentMode === 'lifeai'` but
    // currentMode is undefined in this file AND the actual mode value is 'life',
    // not 'lifeai' — so every notebook saved as 'brandai' regardless of mode.
    // Now reads the canonical app_mode key.
    source: (function(){
      try { return localStorage.getItem('roweos_app_mode') === 'life' ? 'lifeai' : 'brandai'; }
      catch(e) { return 'brandai'; }
    })(),
    createdAt: now,
    updatedAt: now,
    _modifiedAt: ts,
    archived: false
  };
  scribeNotebooks.unshift(nb);
  saveScribeNotebooks();
  // v34.110: recovery breadcrumb. Stash a backup copy of the just-created
  // notebook so if anything between now and the next reload silently strips
  // it from scribeNotebooks (Firestore SDK assertion mid-write, in-memory
  // overwrite from a failed pull, etc.), we can detect+restore on next init.
  // Cleared on any successful subsequent save that contains this id.
  try {
    localStorage.setItem('roweos_scribe_pending_create', JSON.stringify({ id: nb.id, nb: nb, ts: ts }));
  } catch(e) {}
  renderScribeNotebookList();
  selectScribeNotebook(nb.id);
  // v29.0: Focus the title input
  var titleInput = document.getElementById('scribeTitleInput');
  if (titleInput) {
    titleInput.focus();
    titleInput.select();
  }
}

function deleteScribeNotebook(id) { // v29.0:
  if (!confirm('Delete this notebook? This cannot be undone.')) return;
  scribeNotebooks = scribeNotebooks.filter(function(nb) { return nb.id !== id; });
  saveScribeNotebooks();
  if (_scribeActiveId === id) {
    _scribeActiveId = null;
    _showScribeEmptyState();
  }
  renderScribeNotebookList();
  if (typeof showToast === 'function') showToast('Notebook deleted', 'success');
}

// v29.5: Context-aware delete - deletes page if viewing a page, notebook if at notebook level
function deleteActiveScribeItem() {
  if (_scribeActivePageId && _scribeActiveId) {
    deleteScribePage(_scribeActiveId, _scribeActivePageId);
  } else if (_scribeActiveId) {
    deleteScribeNotebook(_scribeActiveId);
  }
}

function archiveScribeNotebook(id) { // v29.0:
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === id) {
      scribeNotebooks[i].archived = !scribeNotebooks[i].archived;
      scribeNotebooks[i].updatedAt = new Date().toISOString();
      scribeNotebooks[i]._modifiedAt = Date.now();
      var isArchived = scribeNotebooks[i].archived;
      saveScribeNotebooks();
      renderScribeNotebookList();
      if (isArchived && _scribeActiveId === id) {
        _scribeActiveId = null;
        _showScribeEmptyState();
      }
      if (typeof showToast === 'function') {
        showToast(isArchived ? 'Notebook archived' : 'Notebook restored', 'success');
      }
      break;
    }
  }
}

// === LIST RENDERING === // v29.0:

function renderScribeNotebookList() { // v29.0:
  var listEl = document.getElementById('scribeNotebookList');
  if (!listEl) return;

  // v29.0: Filter out archived, sort by updatedAt descending
  // v34.71 Life parity gap #2: also filter by mode source so life users don't
  // see brand notebooks mixed in (and vice versa). Notebooks created before the
  // source-tagging fix have undefined source — those are treated as belonging
  // to the user's current mode (best guess) so legacy data doesn't disappear.
  var _appMode = (function(){ try { return localStorage.getItem('roweos_app_mode') === 'life' ? 'life' : 'brand'; } catch(e){ return 'brand'; } })();
  var visible = scribeNotebooks.filter(function(nb) {
    // v29.3: Archive mode shows only archived, normal mode hides archived
    if (_scribeArchiveMode) return nb.archived === true;
    if (nb.archived) return false;
    // Mode filter: brand mode shows brandai + untagged; life mode shows lifeai + untagged
    if (_appMode === 'life') {
      if (nb.source === 'brandai') return false;
    } else {
      if (nb.source === 'lifeai') return false;
    }
    // v29.3: Brand filtering - null brandIdx shows in all brands. Skipped in life mode.
    if (_appMode !== 'life' && !_scribeShowAllBrands && typeof selectedBrand !== 'undefined') {
      if (nb.brandIdx !== null && nb.brandIdx !== undefined && nb.brandIdx !== selectedBrand) return false;
    }
    return true;
  });
  visible.sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });

  if (visible.length === 0) {
    listEl.innerHTML = '<div class="scribe-list-empty" style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">' + (_scribeArchiveMode ? 'No archived notebooks.' : 'No notebooks yet. Create one to get started.') + '</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < visible.length; i++) {
    var nb = visible[i];
    var isNbActive = (nb.id === _scribeActiveId && !_scribeActivePageId) ? ' active' : '';
    var isExpanded = _scribeExpandedNotebooks[nb.id];
    var hasPages = nb.pages && nb.pages.length > 0;
    var snippet = (nb.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().substring(0, 80);
    if (snippet.length >= 80) snippet += '...';
    var dateStr = '';
    try {
      var d = new Date(nb.updatedAt);
      dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { dateStr = ''; }

    html += '<div class="scribe-nb-group">';
    html += '<div class="scribe-nb-item' + isNbActive + '" data-nb-id="' + nb.id + '">';
    if (hasPages) {
      html += '<span class="scribe-nb-expand" onclick="event.stopPropagation();toggleScribeNotebookExpand(\'' + nb.id + '\')">' + (isExpanded ? '&#9662;' : '&#9656;') + '</span>';
    }
    html += '<div class="scribe-nb-item-content" onclick="selectScribeNotebook(\'' + nb.id + '\')">';
    html += '<div class="scribe-nb-item-title">' + _escapeScribeHtml(nb.title || 'Untitled') + '</div>';
    html += '<div class="scribe-nb-item-meta">';
    html += '<span class="scribe-nb-item-date">' + dateStr + '</span>';
    if (nb.tags && nb.tags.length > 0) {
      html += '<span class="scribe-nb-item-tags">' + nb.tags.length + ' tag' + (nb.tags.length !== 1 ? 's' : '') + '</span>';
    }
    html += '</div>';
    if (snippet) html += '<div class="scribe-nb-item-snippet">' + _escapeScribeHtml(snippet) + '</div>';
    html += '</div>';
    if (_scribeArchiveMode) {
      html += '<div class="scribe-nb-archive-actions">';
      html += '<button class="scribe-nb-restore-btn" onclick="event.stopPropagation();archiveScribeNotebook(\'' + nb.id + '\')" title="Restore">Restore</button>';
      html += '<button class="scribe-nb-perm-delete-btn" onclick="event.stopPropagation();deleteScribeNotebook(\'' + nb.id + '\')" title="Delete permanently">Delete</button>';
      html += '</div>';
    }
    html += '</div>';

    // v29.3: Render pages if expanded
    if (isExpanded && hasPages) {
      var activePages = nb.pages.filter(function(p) { return !p.archived; });
      for (var pi = 0; pi < activePages.length; pi++) {
        var pg = activePages[pi];
        var isPgActive = (_scribeActiveId === nb.id && _scribeActivePageId === pg.id) ? ' active' : '';
        html += '<div class="scribe-pg-item' + isPgActive + '" onclick="selectScribePage(\'' + nb.id + '\', \'' + pg.id + '\')">';
        html += '<div class="scribe-pg-item-title">' + _escapeScribeHtml(pg.title || 'Untitled Page') + '</div>';
        html += '</div>';
      }
      html += '<div class="scribe-pg-add" onclick="createScribePage(\'' + nb.id + '\')">+ New Page</div>';
    }
    html += '</div>';
  }
  listEl.innerHTML = html;
}

function filterScribeNotebooks(query) { // v29.0:
  var listEl = document.getElementById('scribeNotebookList');
  if (!listEl) return;
  var q = (query || '').toLowerCase().trim();
  if (!q) {
    renderScribeNotebookList();
    return;
  }
  var visible = scribeNotebooks.filter(function(nb) {
    if (nb.archived) return false;
    // v29.3: Brand filtering
    if (!_scribeShowAllBrands && typeof selectedBrand !== 'undefined') {
      if (nb.brandIdx !== null && nb.brandIdx !== undefined && nb.brandIdx !== selectedBrand) return false;
    }
    return (nb.title || '').toLowerCase().indexOf(q) !== -1;
  });
  visible.sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });

  if (visible.length === 0) {
    listEl.innerHTML = '<div class="scribe-list-empty" style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">No matching notebooks.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < visible.length; i++) {
    var nb = visible[i];
    var isActive = (nb.id === _scribeActiveId) ? ' active' : '';
    var snippet = (nb.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().substring(0, 80);
    if (snippet.length >= 80) snippet += '...';
    var dateStr = '';
    try {
      var d = new Date(nb.updatedAt);
      dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) { dateStr = ''; }
    html += '<div class="scribe-nb-item' + isActive + '" data-nb-id="' + nb.id + '" onclick="selectScribeNotebook(\'' + nb.id + '\')">';
    html += '<div class="scribe-nb-item-title">' + _escapeScribeHtml(nb.title || 'Untitled') + '</div>';
    html += '<div class="scribe-nb-item-meta"><span class="scribe-nb-item-date">' + dateStr + '</span></div>';
    if (snippet) html += '<div class="scribe-nb-item-snippet">' + _escapeScribeHtml(snippet) + '</div>';
    html += '</div>';
  }
  listEl.innerHTML = html;
}

function toggleScribeArchiveMode() { // v29.3:
  _scribeArchiveMode = !_scribeArchiveMode;
  var btn = document.getElementById('scribeArchiveToggle');
  if (btn) btn.classList.toggle('active', _scribeArchiveMode);
  // Hide/show new notebook button
  var newBtn = document.querySelector('.scribe-new-btn');
  if (newBtn) newBtn.style.display = _scribeArchiveMode ? 'none' : '';
  var brandFilter = document.querySelector('.scribe-brand-filter');
  if (brandFilter) brandFilter.style.display = _scribeArchiveMode ? 'none' : '';
  renderScribeNotebookList();
}

function toggleScribeBrandFilter() { // v29.3:
  _scribeShowAllBrands = !_scribeShowAllBrands;
  var checkbox = document.getElementById('scribeBrandFilterCheck');
  if (checkbox) checkbox.checked = _scribeShowAllBrands;
  renderScribeNotebookList();
}

// === PAGES === // v29.3:

function createScribePage(notebookId) {
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === notebookId) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb) return;
  if (!nb.pages) nb.pages = [];

  var now = new Date().toISOString();
  var ts = Date.now();
  var page = {
    id: 'pg_' + ts + '_' + Math.random().toString(36).substr(2, 6),
    title: 'Untitled Page',
    content: '',
    createdAt: now,
    updatedAt: now,
    _modifiedAt: ts,
    archived: false
  };
  nb.pages.push(page);
  nb._modifiedAt = ts;
  nb.updatedAt = now;
  saveScribeNotebooks();

  // Auto-expand this notebook and select the new page
  _scribeExpandedNotebooks[notebookId] = true;
  selectScribePage(notebookId, page.id);
  renderScribeNotebookList();

  var titleInput = document.getElementById('scribeTitleInput');
  if (titleInput) {
    titleInput.focus();
    titleInput.select();
  }
}

function deleteScribePage(notebookId, pageId) {
  if (!confirm('Delete this page? This cannot be undone.')) return;
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === notebookId) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb || !nb.pages) return;
  nb.pages = nb.pages.filter(function(p) { return p.id !== pageId; });
  nb._modifiedAt = Date.now();
  nb.updatedAt = new Date().toISOString();
  saveScribeNotebooks();

  if (_scribeActivePageId === pageId) {
    _scribeActivePageId = null;
    selectScribeNotebook(notebookId);
  }
  renderScribeNotebookList();
  if (typeof showToast === 'function') showToast('Page deleted', 'success');
}

function selectScribePage(notebookId, pageId) {
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === notebookId) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb || !nb.pages) return;

  var page = null;
  for (var j = 0; j < nb.pages.length; j++) {
    if (nb.pages[j].id === pageId) { page = nb.pages[j]; break; }
  }
  if (!page) return;

  _scribeActiveId = notebookId;
  _scribeActivePageId = pageId;

  // Show editor, hide empty state
  var editorArea = document.getElementById('scribeActiveEditor');
  var emptyState = document.getElementById('scribeEmptyState');
  if (editorArea) editorArea.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  // Populate title with page title
  var titleInput = document.getElementById('scribeTitleInput');
  if (titleInput) titleInput.value = page.title || '';

  // Populate TinyMCE with page content
  if (!_scribeTinymceReady) {
    initScribeTinymce();
  }
  var _pgContent = page.content || '';
  var tinymceEditor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
  if (tinymceEditor && _scribeTinymceReady) {
    tinymceEditor.setContent(_pgContent);
  } else {
    setTimeout(function() {
      var ed = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
      if (ed) ed.setContent(_pgContent);
    }, 500);
  }
  setTimeout(updateScribeWordCount, 600); // v29.3

  // Render metadata (tags from parent notebook)
  renderScribeMetadata(nb);
  renderScribeNotebookList();

  // Reset knowledge thread
  _scribeKnowledgeThread = [];
  renderScribeKnowledgeThread();
}

function toggleScribeNotebookExpand(notebookId) {
  _scribeExpandedNotebooks[notebookId] = !_scribeExpandedNotebooks[notebookId];
  renderScribeNotebookList();
}

// === EDITOR === // v29.0:

function selectScribeNotebook(id) { // v29.0:
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === id) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb) return;

  _scribeActiveId = id;
  _scribeActivePageId = null; // v29.3: Clear page selection when selecting notebook
  // v29.5: Auto-expand pages in sidebar when notebook selected
  if (nb.pages && nb.pages.length > 0) _scribeExpandedNotebooks[id] = true;

  // v29.0: Show editor, hide empty state
  var editorArea = document.getElementById('scribeActiveEditor');
  var emptyState = document.getElementById('scribeEmptyState');
  if (editorArea) editorArea.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  // v29.2: Defer TinyMCE init until editor is visible (can't init on hidden element)
  if (!_scribeTinymceReady) {
    initScribeTinymce();
  }

  // v29.0: Populate title
  var titleInput = document.getElementById('scribeTitleInput');
  if (titleInput) titleInput.value = nb.title || '';

  // v29.2: Populate TinyMCE content (with retry for init timing)
  var _nbContent = nb.content || '';
  var tinymceEditor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
  if (tinymceEditor && _scribeTinymceReady) {
    tinymceEditor.setContent(_nbContent);
  } else {
    // TinyMCE not ready yet - retry after init completes
    setTimeout(function() {
      var ed = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
      if (ed) ed.setContent(_nbContent);
    }, 500);
  }
  setTimeout(updateScribeWordCount, 600); // v29.3

  // v29.0: Render metadata panel
  renderScribeMetadata(nb);

  // v29.0: Update list highlighting
  renderScribeNotebookList();

  // v29.0: Reset knowledge thread
  _scribeKnowledgeThread = [];
  renderScribeKnowledgeThread();
}

function onScribeTitleChange() { // v29.0:
  scheduleScribeAutoSave();
}

function onScribeContentChange() { // v29.0:
  scheduleScribeAutoSave();
}

function scheduleScribeAutoSave() { // v29.0:
  if (_scribeAutoSaveTimer) clearTimeout(_scribeAutoSaveTimer);
  _scribeAutoSaveTimer = setTimeout(function() {
    saveActiveScribeNotebook();
  }, 1000);
}

function saveActiveScribeNotebook() { // v29.0:
  if (!_scribeActiveId) return;
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === _scribeActiveId) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb) return;

  var titleInput = document.getElementById('scribeTitleInput');
  var tinymceEditor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;

  // v29.3: Save to page or notebook depending on active selection
  if (_scribeActivePageId && nb.pages) {
    var page = null;
    for (var pi = 0; pi < nb.pages.length; pi++) {
      if (nb.pages[pi].id === _scribeActivePageId) { page = nb.pages[pi]; break; }
    }
    if (page) {
      if (titleInput) page.title = titleInput.value || 'Untitled Page';
      if (tinymceEditor) page.content = tinymceEditor.getContent() || '';
      page.updatedAt = new Date().toISOString();
      page._modifiedAt = Date.now();
    }
  } else {
    if (titleInput) nb.title = titleInput.value || 'Untitled Notebook';
    if (tinymceEditor) nb.content = tinymceEditor.getContent() || '';
  }
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();

  saveScribeNotebooks();
  // v29.0: Update list item without full re-render to avoid losing scroll position
  var listItem = document.querySelector('.scribe-nb-item[data-nb-id="' + _scribeActiveId + '"] .scribe-nb-item-title');
  if (listItem) listItem.textContent = nb.title || 'Untitled';
}

// === AI WRITING === // v29.3:

function scribeAICompose() {
  // v29.3: Open modal to ask what to write about
  if (!_scribeActiveId) {
    if (typeof showToast === 'function') showToast('Select or create a notebook first', 'warning');
    return;
  }
  var overlay = document.getElementById('scribeAiOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  var input = document.getElementById('scribeAiTopicInput');
  if (input) { input.value = ''; input.focus(); }
}

function scribeAiModalCancel() {
  var overlay = document.getElementById('scribeAiOverlay');
  if (overlay) overlay.style.display = 'none';
}

function scribeAiModalSubmit() {
  var input = document.getElementById('scribeAiTopicInput');
  var topic = input ? input.value.trim() : '';
  if (!topic) {
    if (typeof showToast === 'function') showToast('Please enter a topic', 'warning');
    return;
  }
  var overlay = document.getElementById('scribeAiOverlay');
  if (overlay) overlay.style.display = 'none';

  // Get existing content if any
  var existingContent = '';
  var editor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
  if (editor) existingContent = editor.getContent() || '';

  scribeAIWriteExecute(topic, existingContent);
}

function _buildScribeBrandContext() {
  var brandCtx = '';
  try {
    var idx = (typeof selectedBrand !== 'undefined') ? selectedBrand : 0;
    var brand = (typeof brands !== 'undefined') ? brands[idx] : null;
    if (brand) {
      brandCtx += 'You are writing for ' + (brand.shortName || brand.name) + '.\n\n';
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
      if (brand.identity) {
        var id = brand.identity;
        if (id.voiceTone) brandCtx += 'VOICE & TONE DETAIL: ' + id.voiceTone + '\n';
        if (id.brandEssence) brandCtx += 'BRAND ESSENCE: ' + id.brandEssence + '\n';
        if (id.messaging) brandCtx += 'MESSAGING: ' + id.messaging + '\n';
        if (id.visualIdentity) brandCtx += 'VISUAL IDENTITY: ' + id.visualIdentity + '\n';
        if (id.competitivePosition) brandCtx += 'COMPETITIVE POSITION: ' + id.competitivePosition + '\n';
      }
      brandCtx += '\n';
      if (typeof getBrandIdentityIntelligence === 'function') {
        var intel = getBrandIdentityIntelligence(brand);
        if (intel) brandCtx += intel + '\n';
      }
    }
  } catch(e) {}
  return brandCtx;
}

function scribeAIWriteExecute(topic, existingContent) {
  var editor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
  if (!editor) return;

  var brandCtx = _buildScribeBrandContext();
  var systemPrompt = brandCtx + 'You are a professional writer creating notebook content. ' +
    'Write clear, well-structured content in the brand\'s voice. ' +
    'Use HTML formatting: headings (h2, h3), paragraphs, lists, bold for emphasis. ' +
    'Use hyphens instead of em-dashes or en-dashes in your writing. ' +
    'Only use REAL data from the brand context - never fabricate details.';

  var userPrompt = '';
  if (existingContent && existingContent.replace(/<[^>]*>/g, '').trim()) {
    userPrompt = 'Revise and improve this content based on the following direction: ' + topic + '\n\nExisting content:\n' + existingContent.replace(/<[^>]*>/g, '') + '\n\nReturn the full revised content as HTML.';
  } else {
    userPrompt = 'Write notebook content about: ' + topic + '\n\nReturn well-structured HTML content.';
  }

  // Show loading state
  editor.setContent('<p style="color: var(--text-muted); opacity: 0.5;">Writing...</p>');

  if (typeof callAnthropicStreaming === 'function' && typeof getApiKey === 'function') {
    var accumulated = '';
    getApiKey('anthropic').then(function(apiKey) {
      if (!apiKey) {
        editor.setContent('<p>API key not configured. Add your Anthropic API key in Settings.</p>');
        return;
      }
      callAnthropicStreaming(
        'claude-sonnet-4-20250514',
        apiKey,
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        function(chunk) {
          accumulated += chunk;
          editor.setContent(accumulated);
        },
        function() {
          scheduleScribeAutoSave();
          if (typeof showToast === 'function') showToast('Content generated', 'success');
        },
        function(err) {
          editor.setContent('<p>Error: ' + (err.message || 'Failed to generate content') + '</p>');
        }
      );
    }).catch(function(err) {
      editor.setContent('<p>Error: ' + (err.message || 'Failed to get API key') + '</p>');
    });
  } else {
    editor.setContent('<p>AI features require API key configuration in Settings.</p>');
  }
}

// === VOICE TOOLS (Rewrite with AI) === // v29.3:

function scribeShowVoiceTools() {
  var editor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
  if (!editor) return;
  var selectedText = editor.selection.getContent({ format: 'text' });
  if (!selectedText || !selectedText.trim()) {
    if (typeof showToast === 'function') showToast('Select text first to rewrite', 'warning');
    return;
  }
  var popover = document.getElementById('scribeVoicePopover');
  if (!popover) return;
  popover.style.display = popover.style.display === 'block' ? 'none' : 'block';
}

function scribeVoiceAction(action) {
  var editor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
  if (!editor) return;
  var selectedText = editor.selection.getContent({ format: 'text' });
  if (!selectedText || !selectedText.trim()) {
    if (typeof showToast === 'function') showToast('Select text first', 'warning');
    return;
  }

  var popover = document.getElementById('scribeVoicePopover');
  if (popover) popover.style.display = 'none';

  var actionPrompts = {
    rewrite: 'Rewrite this text for improved clarity and flow, maintaining the same meaning',
    professional: 'Rewrite this text in a professional, polished tone',
    friendly: 'Rewrite this text in a warm, approachable, friendly tone',
    concise: 'Make this text more concise - remove unnecessary words while keeping the meaning',
    expand: 'Expand this text with more detail and context while keeping the same tone',
    grammar: 'Fix any grammar, spelling, or punctuation errors in this text. Only fix errors, do not change the style',
    brand_voice: 'Rewrite this text to perfectly match the brand voice described in the brand context'
  };

  var instruction = actionPrompts[action] || 'Rewrite this text';
  var brandCtx = _buildScribeBrandContext();

  var systemPrompt = brandCtx + instruction + '. ' +
    'Return ONLY the rewritten text, no explanations or quotes around it. ' +
    'Use hyphens instead of em-dashes or en-dashes.';

  // Show loading in the selection
  var originalContent = editor.selection.getContent();
  editor.selection.setContent('<span style="opacity:0.5">Rewriting...</span>');

  if (typeof getApiKey === 'function') {
    getApiKey('anthropic').then(function(apiKey) {
      if (!apiKey) {
        editor.undoManager.undo();
        if (typeof showToast === 'function') showToast('API key not configured', 'warning');
        return;
      }

      var url = 'https://api.anthropic.com/v1/messages';
      var body = JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: selectedText }]
      });

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: body
      }).then(function(resp) { return resp.json(); }).then(function(data) {
        if (data.content && data.content[0] && data.content[0].text) {
          var result = data.content[0].text;
          // Undo the "Rewriting..." placeholder, then insert result
          editor.undoManager.undo();
          editor.selection.setContent(result);
          scheduleScribeAutoSave();
          if (typeof showToast === 'function') showToast('Text rewritten', 'success');
        } else {
          editor.undoManager.undo();
          if (typeof showToast === 'function') showToast('AI returned empty response', 'warning');
        }
      }).catch(function(err) {
        editor.undoManager.undo();
        if (typeof showToast === 'function') showToast('Rewrite failed: ' + err.message, 'error');
      });
    }).catch(function(err) {
      editor.undoManager.undo();
      if (typeof showToast === 'function') showToast('API key error', 'error');
    });
  }
}

// === KNOWLEDGE MODE === // v29.0:

function toggleScribeKnowledgeMode() { // v29.2:
  _scribeKnowledgeMode = !_scribeKnowledgeMode;
  var panel = document.getElementById('scribeKnowledgePanel');
  var collapsed = document.getElementById('scribeKnowledgeCollapsed');
  if (panel) {
    panel.style.display = _scribeKnowledgeMode ? '' : 'none';
  }
  if (collapsed) {
    collapsed.style.display = _scribeKnowledgeMode ? 'none' : '';
  }
}

// v29.5: Clear knowledge thread
function clearScribeKnowledgeThread() {
  _scribeKnowledgeThread = [];
  renderScribeKnowledgeThread();
  if (typeof showToast === 'function') showToast('Chat cleared', 'success');
}

function askScribeQuestion() { // v29.0:
  var inputEl = document.getElementById('scribeKnowledgeInput');
  if (!inputEl) return;
  var question = inputEl.value.trim();
  if (!question) return;

  // v29.0: Get active notebook content for context
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === _scribeActiveId) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb) {
    if (typeof showToast === 'function') showToast('No notebook selected', 'warning');
    return;
  }

  // v29.0: Add user message to thread
  _scribeKnowledgeThread.push({ role: 'user', content: question });
  inputEl.value = '';
  renderScribeKnowledgeThread();

  // v29.0: Build context from notebook
  var plainContent = (nb.content || '').replace(/<[^>]*>/g, '');
  var sourcesText = '';
  if (nb.sources && nb.sources.length > 0) {
    sourcesText = '\n\nSources:\n' + nb.sources.join('\n');
  }

  var systemPrompt = 'You are a knowledgeable assistant. Answer the user\'s question based on the following notebook content. ' +
    'Be concise and accurate. If the answer is not found in the content, say so. ' +
    'Use hyphens instead of em-dashes or en-dashes in your writing.\n\n' +
    'NOTEBOOK TITLE: ' + (nb.title || 'Untitled') + '\n\n' +
    'NOTEBOOK CONTENT:\n' + plainContent + sourcesText;

  // v29.0: Build messages for API call
  var messages = [];
  for (var j = 0; j < _scribeKnowledgeThread.length; j++) {
    messages.push({
      role: _scribeKnowledgeThread[j].role,
      content: _scribeKnowledgeThread[j].content
    });
  }

  // v29.0: Try to use existing AI infrastructure
  if (typeof callAnthropicStreaming === 'function' && typeof getApiKey === 'function') {
    // v29.0: Add placeholder for assistant response
    _scribeKnowledgeThread.push({ role: 'assistant', content: '' });
    renderScribeKnowledgeThread();
    var threadIdx = _scribeKnowledgeThread.length - 1;

    getApiKey('anthropic').then(function(apiKey) {
      if (!apiKey) {
        _scribeKnowledgeThread[threadIdx].content = 'API key not configured. Please set up your Anthropic API key in Settings.';
        renderScribeKnowledgeThread();
        return;
      }
      var model = 'claude-sonnet-4-20250514';
      callAnthropicStreaming(
        model,
        apiKey,
        messages,
        systemPrompt,
        function(chunk) { // v29.0: onChunk
          _scribeKnowledgeThread[threadIdx].content += chunk;
          renderScribeKnowledgeThread();
        },
        function() { // v29.0: onComplete
          renderScribeKnowledgeThread();
        },
        function(err) { // v29.0: onError
          _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Failed to get response');
          renderScribeKnowledgeThread();
        }
      );
    }).catch(function(err) {
      _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Failed to get API key');
      renderScribeKnowledgeThread();
    });
  } else {
    // v29.0: Fallback if streaming not available
    _scribeKnowledgeThread.push({ role: 'assistant', content: 'AI features require API key configuration. Please check Settings.' });
    renderScribeKnowledgeThread();
    if (typeof showToast === 'function') showToast('AI features coming soon', 'info');
  }
}

function synthesizeScribeNotebook() { // v29.0:
  var nb = null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === _scribeActiveId) { nb = scribeNotebooks[i]; break; }
  }
  if (!nb) {
    if (typeof showToast === 'function') showToast('No notebook selected', 'warning');
    return;
  }
  var plainContent = (nb.content || '').replace(/<[^>]*>/g, '').trim();
  if (!plainContent) {
    if (typeof showToast === 'function') showToast('Notebook is empty', 'warning');
    return;
  }

  // v29.0: Add synthesis request to thread
  _scribeKnowledgeThread.push({ role: 'user', content: '[Synthesize notebook]' });
  _scribeKnowledgeThread.push({ role: 'assistant', content: '' });
  renderScribeKnowledgeThread();
  var threadIdx = _scribeKnowledgeThread.length - 1;

  var systemPrompt = 'You are a helpful assistant. Provide a clear, well-structured summary of the following notebook content. ' +
    'Highlight key themes, insights, and action items. Use hyphens instead of em-dashes or en-dashes.\n\n' +
    'NOTEBOOK TITLE: ' + (nb.title || 'Untitled') + '\n\n' +
    'NOTEBOOK CONTENT:\n' + plainContent;

  var messages = [{ role: 'user', content: 'Please synthesize and summarize this notebook.' }];

  if (typeof callAnthropicStreaming === 'function' && typeof getApiKey === 'function') {
    getApiKey('anthropic').then(function(apiKey) {
      if (!apiKey) {
        _scribeKnowledgeThread[threadIdx].content = 'API key not configured.';
        renderScribeKnowledgeThread();
        return;
      }
      var model = 'claude-sonnet-4-20250514';
      callAnthropicStreaming(
        model,
        apiKey,
        messages,
        systemPrompt,
        function(chunk) {
          _scribeKnowledgeThread[threadIdx].content += chunk;
          renderScribeKnowledgeThread();
        },
        function() { renderScribeKnowledgeThread(); },
        function(err) {
          _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Synthesis failed');
          renderScribeKnowledgeThread();
        }
      );
    }).catch(function(err) {
      _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Failed to get API key');
      renderScribeKnowledgeThread();
    });
  } else {
    _scribeKnowledgeThread[threadIdx].content = 'AI features require API key configuration.';
    renderScribeKnowledgeThread();
    if (typeof showToast === 'function') showToast('AI features coming soon', 'info');
  }
}

function renderScribeKnowledgeThread() { // v29.3: Enhanced with markdown rendering
  var threadEl = document.getElementById('scribeKnowledgeThread');
  if (!threadEl) return;

  if (_scribeKnowledgeThread.length === 0) {
    threadEl.innerHTML = '';
    threadEl.style.display = 'none';
    return;
  }
  threadEl.style.display = '';

  var html = '';
  for (var i = 0; i < _scribeKnowledgeThread.length; i++) {
    var msg = _scribeKnowledgeThread[i];
    var content = msg.content || '';
    if (msg.role === 'assistant' && typeof marked !== 'undefined') {
      try { content = marked.parse(content); } catch(e) { content = _escapeScribeHtml(content); }
    } else {
      content = _escapeScribeHtml(content);
    }
    html += '<div class="scribe-knowledge-msg scribe-knowledge-' + (msg.role || 'user') + '">' + content + '</div>';
  }
  threadEl.innerHTML = html;
  threadEl.scrollTop = threadEl.scrollHeight;
}

// === METADATA PANEL === // v29.0:

function renderScribeMetadata(notebook) { // v29.2: Render tags inline
  var tagsEl = document.getElementById('scribeTagsList');
  if (!tagsEl || !notebook) return;
  var html = '';
  if (notebook.tags && notebook.tags.length > 0) {
    for (var t = 0; t < notebook.tags.length; t++) {
      html += '<span class="scribe-tag-pill">' + _escapeScribeHtml(notebook.tags[t]);
      html += '<span class="scribe-tag-remove" onclick="removeScribeTag(\'' + _escapeScribeAttr(notebook.tags[t]) + '\')">&times;</span>';
      html += '</span>';
    }
  }
  tagsEl.innerHTML = html;
}

function addScribeSource() { // v29.0:
  var source = prompt('Enter source (URL or description):');
  if (!source || !source.trim()) return;
  var nb = _getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.sources) nb.sources = [];
  nb.sources.push(source.trim());
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function linkScribePerson() { // v29.0:
  var name = prompt('Enter person name:');
  if (!name || !name.trim()) return;
  var nb = _getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.linkedPeople) nb.linkedPeople = [];
  nb.linkedPeople.push(name.trim());
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function linkScribeLibraryItem() { // v29.0:
  var name = prompt('Enter library item name:');
  if (!name || !name.trim()) return;
  var nb = _getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.linkedLibraryItems) nb.linkedLibraryItems = [];
  nb.linkedLibraryItems.push(name.trim());
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function addScribeTag() { // v29.0:
  var inputEl = document.getElementById('scribeTagInput');
  if (!inputEl) return;
  var tag = inputEl.value.trim();
  if (!tag) return;
  var nb = _getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.tags) nb.tags = [];
  // v29.0: Prevent duplicates
  for (var i = 0; i < nb.tags.length; i++) {
    if (nb.tags[i].toLowerCase() === tag.toLowerCase()) {
      if (typeof showToast === 'function') showToast('Tag already exists', 'warning');
      return;
    }
  }
  nb.tags.push(tag);
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  inputEl.value = '';
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function removeScribeTag(tag) { // v29.0:
  var nb = _getActiveScribeNotebook();
  if (!nb || !nb.tags) return;
  nb.tags = nb.tags.filter(function(t) { return t !== tag; });
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function removeScribeSource(idx) { // v29.0:
  var nb = _getActiveScribeNotebook();
  if (!nb || !nb.sources) return;
  nb.sources.splice(idx, 1);
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function unlinkScribePerson(idx) { // v29.0:
  var nb = _getActiveScribeNotebook();
  if (!nb || !nb.linkedPeople) return;
  nb.linkedPeople.splice(idx, 1);
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

function unlinkScribeLibraryItem(idx) { // v29.0:
  var nb = _getActiveScribeNotebook();
  if (!nb || !nb.linkedLibraryItems) return;
  nb.linkedLibraryItems.splice(idx, 1);
  nb.updatedAt = new Date().toISOString();
  nb._modifiedAt = Date.now();
  saveScribeNotebooks();
  renderScribeMetadata(nb);
}

// === RESIZE HANDLE === // v29.3:

function initScribeResizeHandle() {
  var handle = document.getElementById('scribeResizeHandle');
  if (!handle) return;
  var panel = document.getElementById('scribeKnowledgePanel');
  if (!panel) return;

  var startY = 0;
  var startHeight = 0;
  var isDragging = false;

  function onStart(e) {
    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startHeight = panel.offsetHeight;
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    e.preventDefault();
  }

  function onMove(e) {
    if (!isDragging) return;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var delta = startY - clientY;
    var newHeight = Math.max(80, Math.min(600, startHeight + delta));
    panel.style.maxHeight = newHeight + 'px';
    panel.style.height = newHeight + 'px';
    e.preventDefault();
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    handle.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }

  handle.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  handle.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}

// === WORD COUNT === // v29.3:

// v34.113: debounced word-count update. Was running on every keyup, calling
// editor.getContent({ format: 'text' }) which walks the full TinyMCE content
// tree, then split + filter on the result. On a long notebook this is
// 50-200ms of work per keystroke - directly responsible for the typing lag.
// Now debounced 300ms; the count is informational, not realtime-critical.
var _scribeWordCountTimer = null;
function updateScribeWordCount() {
  if (_scribeWordCountTimer) clearTimeout(_scribeWordCountTimer);
  _scribeWordCountTimer = setTimeout(function() {
    _scribeWordCountTimer = null;
    var el = document.getElementById('scribeWordCount');
    if (!el) return;
    var editor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
    if (!editor) { el.textContent = '0 words'; return; }
    var text = editor.getContent({ format: 'text' }) || '';
    var words = text.split(/\s+/).filter(function(s) { return s.length > 0; }).length;
    var chars = text.length;
    el.textContent = words + ' word' + (words !== 1 ? 's' : '') + '  |  ' + chars + ' characters';
  }, 300);
}

// === HELPERS === // v29.0:

function _getActiveScribeNotebook() { // v29.0:
  if (!_scribeActiveId) return null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === _scribeActiveId) return scribeNotebooks[i];
  }
  return null;
}

function _escapeScribeHtml(str) { // v29.0:
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _escapeScribeAttr(str) { // v29.0:
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function _formatScribeDate(isoStr) { // v29.0:
  if (!isoStr) return '-';
  try {
    var d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return isoStr;
  }
}

// v29.3: @-mention autocomplete system
var _scribeMentionDropdown = null;
var _scribeMentionQuery = '';
var _scribeMentionActive = false;

function initScribeMentions() {
  var editor = typeof tinymce !== 'undefined' ? tinymce.get('scribeContentArea') : null;
  if (!editor) return;

  editor.on('keyup', function(e) {
    if (_scribeMentionActive) {
      if (e.key === 'Escape') { hideScribeMentionDropdown(); return; }
      if (e.key === 'Enter') { e.preventDefault(); selectScribeMention(0); return; }
      // While the dropdown is open, every keystroke filters the list.
      checkForMentionTrigger(editor);
      return;
    }
    // v34.114: only invoke the trigger check when the user actually pressed `@`
    // (or Backspace, in case they backspaced into a mention region). Previously
    // every keyup ran getRng() + textContent + substring + lastIndexOf even on
    // pure typing - per-keystroke selection lookup is the major TinyMCE
    // editor.on cost on long notebooks.
    if (e.key === '@' || e.key === 'Backspace') {
      checkForMentionTrigger(editor);
    }
  });

  editor.on('keydown', function(e) {
    if (_scribeMentionActive && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      e.preventDefault();
    }
  });
}

function checkForMentionTrigger(editor) {
  var rng = editor.selection.getRng();
  var container = rng.startContainer;
  if (container.nodeType !== 3) { hideScribeMentionDropdown(); return; }
  var text = container.textContent;
  var cursorPos = rng.startOffset;

  var beforeCursor = text.substring(0, cursorPos);
  var atIdx = beforeCursor.lastIndexOf('@');
  if (atIdx === -1) { hideScribeMentionDropdown(); return; }

  var query = beforeCursor.substring(atIdx + 1);
  if (query.length > 30) { hideScribeMentionDropdown(); return; }

  _scribeMentionQuery = query.toLowerCase();
  _scribeMentionActive = true;
  showScribeMentionDropdown(editor, query);
}

function showScribeMentionDropdown(editor, query) {
  var results = [];

  // Search People
  if (typeof getPeople === 'function') {
    var people = getPeople();
    if (Array.isArray(people)) {
      for (var pi = 0; pi < people.length; pi++) {
        var p = people[pi];
        var name = p.name || p.companyName || '';
        if (name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
          results.push({ type: 'person', id: p.id, name: name, sub: p.personType || 'contact' });
        }
      }
    }
  }

  // Search Library files
  if (typeof getCurrentBrandLibrary === 'function') {
    var lib = getCurrentBrandLibrary();
    if (lib && lib.files) {
      for (var fi = 0; fi < lib.files.length; fi++) {
        var f = lib.files[fi];
        var fname = f.name || f.title || '';
        if (fname.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
          results.push({ type: 'library', id: f.id, name: fname, sub: 'library' });
        }
      }
    }
  }

  results = results.slice(0, 8);

  if (results.length === 0) { hideScribeMentionDropdown(); return; }

  if (!_scribeMentionDropdown) {
    _scribeMentionDropdown = document.createElement('div');
    _scribeMentionDropdown.className = 'scribe-mention-dropdown';
    document.body.appendChild(_scribeMentionDropdown);
  }

  var html = '';
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    html += '<div class="scribe-mention-item" data-idx="' + i + '" onclick="selectScribeMention(' + i + ')">' +
      '<span class="scribe-mention-name">' + _escapeScribeHtml(r.name) + '</span>' +
      '<span class="scribe-mention-type">' + _escapeScribeHtml(r.sub) + '</span></div>';
  }
  _scribeMentionDropdown.innerHTML = html;
  _scribeMentionDropdown._results = results;

  // Position near cursor
  var editorContainer = document.getElementById('scribeContentArea');
  if (editorContainer) {
    var iframe = editorContainer.closest('.tox-tinymce');
    if (iframe) {
      var rect = iframe.getBoundingClientRect();
      _scribeMentionDropdown.style.display = 'block';
      _scribeMentionDropdown.style.position = 'fixed';
      _scribeMentionDropdown.style.left = (rect.left + 40) + 'px';
      _scribeMentionDropdown.style.top = (rect.top + 60) + 'px';
      _scribeMentionDropdown.style.zIndex = '100000';
    }
  }
}

function hideScribeMentionDropdown() {
  _scribeMentionActive = false;
  _scribeMentionQuery = '';
  if (_scribeMentionDropdown) _scribeMentionDropdown.style.display = 'none';
}

function selectScribeMention(idx) {
  if (!_scribeMentionDropdown || !_scribeMentionDropdown._results) return;
  var item = _scribeMentionDropdown._results[idx];
  if (!item) return;

  var editor = typeof tinymce !== 'undefined' ? tinymce.get('scribeContentArea') : null;
  if (!editor) return;

  var rng = editor.selection.getRng();
  var container = rng.startContainer;
  if (container.nodeType === 3) {
    var text = container.textContent;
    var cursorPos = rng.startOffset;
    var beforeCursor = text.substring(0, cursorPos);
    var atIdx = beforeCursor.lastIndexOf('@');
    if (atIdx !== -1) {
      container.textContent = text.substring(0, atIdx) + text.substring(cursorPos);
      var mentionHtml = '<span class="scribe-mention" data-type="' + item.type + '" data-id="' + item.id + '" contenteditable="false">@' + _escapeScribeHtml(item.name) + '</span>&nbsp;';
      rng.setStart(container, atIdx);
      rng.setEnd(container, atIdx);
      editor.selection.setRng(rng);
      editor.insertContent(mentionHtml);
    }
  }

  // Track linked item
  if (item.type === 'person') {
    addScribeLinkedPerson(item.id, item.name);
  } else if (item.type === 'library') {
    addScribeLinkedLibraryItem(item.id, item.name);
  }

  hideScribeMentionDropdown();
  if (typeof saveActiveScribeNotebook === 'function') saveActiveScribeNotebook();
}

function addScribeLinkedPerson(id, name) {
  var nb = getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.linkedPeople) nb.linkedPeople = [];
  if (nb.linkedPeople.indexOf(id) === -1) {
    nb.linkedPeople.push(id);
    saveScribeNotebooks();
  }
}

function addScribeLinkedLibraryItem(id, name) {
  var nb = getActiveScribeNotebook();
  if (!nb) return;
  if (!nb.linkedLibraryItems) nb.linkedLibraryItems = [];
  if (nb.linkedLibraryItems.indexOf(id) === -1) {
    nb.linkedLibraryItems.push(id);
    saveScribeNotebooks();
  }
}

function getActiveScribeNotebook() {
  if (!_scribeActiveId) return null;
  for (var i = 0; i < scribeNotebooks.length; i++) {
    if (scribeNotebooks[i].id === _scribeActiveId) return scribeNotebooks[i];
  }
  return null;
}

// v33.74: Pin the active notebook to the Thought Board. Pulls the notebook
// title + first ~600 chars of the editor content. No-op if no notebook is
// active or the Thought Board module hasn't loaded.
function pinScribeToThoughtBoard() {
  try {
    var nb = getActiveScribeNotebook();
    if (!nb) {
      if (typeof showToast === 'function') showToast('Open or create a notebook first.', 'info');
      return;
    }
    var title = (nb.title || 'Untitled notebook').slice(0, 80);
    var bodyEl = document.getElementById('scribeContentArea');
    var body = '';
    try { body = (bodyEl && bodyEl.value) || nb.content || ''; } catch(e){ body = nb.content || ''; }
    // strip HTML tags for the pin body preview
    body = String(body).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
    if (window.ThoughtBoard && typeof window.ThoughtBoard.addPin === 'function') {
      window.ThoughtBoard.addPin({
        kind: 'notebook',
        title: title,
        body: body,
        source: { view: 'scribe', refId: String(nb.id || ''), label: 'Notebook · ' + title }
      });
      if (typeof showToast === 'function') showToast('Pinned notebook to Thought Board.', 'success');
    } else {
      if (typeof showToast === 'function') showToast('Thought Board not loaded.', 'error');
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('Could not pin: ' + (e && e.message || 'unknown'), 'error');
  }
}
