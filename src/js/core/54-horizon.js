// ============================================================
// v35.13: HorizonBridge — integration glue for the Horizon
// personal-finance SPA vendored at /horizon/ (React build,
// stores everything in the single localStorage key horizon_v1).
//
// Responsibilities:
//  1. Lazy-load the iframe the first time the view opens (the
//     React bundle should not load on every app boot).
//  2. Firebase backup: push horizon_v1 to roweos_users/{uid}/
//     horizon/main whenever it changes (10s poll, only-on-change),
//     and restore from cloud ONLY when local is empty — cloud
//     never overwrites non-empty local data automatically.
//  3. Import/Export so data can be moved from the standalone
//     horizon-*.vercel.app deployment (different origin, so its
//     localStorage does not carry over).
//
// Same-origin note: the iframe at /horizon/ shares localStorage
// with the parent app, so this file can read/write horizon_v1
// directly. ES5 only.
// ============================================================

(function() {
  var HORIZON_KEY = 'horizon_v1';
  var _lastPushed = null;
  var _pollTimer = null;
  var _frameLoaded = false;

  function _readLocal() {
    try { return localStorage.getItem(HORIZON_KEY); } catch (e) { return null; }
  }

  // 1. View init — called from showView('horizon') (already admin-gated there)
  function initView() {
    // The /horizon/ page refuses to boot without this flag (its bundle carries
    // personal seed data); setting it here means only the admin-gated view
    // (or a browser that already has horizon_v1) can open the app.
    try { localStorage.setItem('horizon_host_ok', '1'); } catch (eF) {}
    var frame = document.getElementById('horizonFrame');
    if (frame && !_frameLoaded) {
      frame.src = '/horizon/';
      _frameLoaded = true;
    }
    _startBackupPoll();
  }

  // 2a. Backup push: poll for changes while the app is open.
  // 10s poll is negligible (string compare) and avoids patching the
  // React app's own save path inside a minified bundle.
  function _startBackupPoll() {
    if (_pollTimer) return;
    _pollTimer = setInterval(function() {
      var cur = _readLocal();
      if (cur == null || cur === _lastPushed) return;
      if (typeof firebaseUser === 'undefined' || !firebaseUser) return;
      if (typeof writeDB !== 'function') return;
      _lastPushed = cur;
      // Store as a field (not raw doc) so Firestore's 1MB doc limit is the
      // only cap; horizon_v1 is small (a few KB of plans/accounts).
      writeDB('horizon/main', { data: cur, savedAt: Date.now() }, { category: 'horizon', merge: false });
      if (typeof ROWEOS_DEBUG !== 'undefined' && ROWEOS_DEBUG) console.log('[Horizon] Backed up to cloud (' + cur.length + ' chars)');
    }, 10000);
  }

  // 2b. Restore: ONLY when local is empty (fresh device / cleared storage).
  // Never clobbers existing local data — user-initiated import handles that.
  function restoreIfEmpty() {
    try {
      if (_readLocal()) return; // local data exists — never touch it
      if (typeof firebaseUser === 'undefined' || !firebaseUser) return;
      if (typeof firebase === 'undefined' || !firebase.firestore) return;
      firebase.firestore().doc('roweos_users/' + firebaseUser.uid + '/horizon/main').get().then(function(doc) {
        if (!doc.exists) return;
        var d = doc.data();
        if (!d || !d.data) return;
        if (_readLocal()) return; // re-check: something wrote it meanwhile
        try { JSON.parse(d.data); } catch (ePv) { return; } // refuse corrupt payloads
        localStorage.setItem(HORIZON_KEY, d.data);
        _lastPushed = d.data;
        console.log('[Horizon] Restored finance data from cloud backup');
        // If the frame is already open, reload it so the app picks up the data
        var frame = document.getElementById('horizonFrame');
        if (frame && _frameLoaded) frame.src = '/horizon/';
      }).catch(function() {});
    } catch (e) {}
  }

  // 3a. Import — paste the horizon_v1 JSON copied from the standalone
  // deployment's DevTools (localStorage.getItem('horizon_v1')).
  function importData() {
    var pasted = prompt('Paste your Horizon data (the horizon_v1 JSON from the old site\'s DevTools):');
    if (!pasted) return;
    var trimmed = pasted.trim();
    // Accept either the raw JSON or a quoted string copied from the console
    if (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"') {
      try { trimmed = JSON.parse(trimmed); } catch (eQ) {}
    }
    try {
      JSON.parse(trimmed);
    } catch (e) {
      if (typeof showToast === 'function') showToast('That is not valid Horizon JSON - nothing was changed', 'error');
      return;
    }
    var existing = _readLocal();
    if (existing && !confirm('This will REPLACE your current Horizon data in this app. Continue?')) return;
    localStorage.setItem(HORIZON_KEY, trimmed);
    _lastPushed = null; // force next poll to push the imported data to cloud
    var frame = document.getElementById('horizonFrame');
    if (frame && _frameLoaded) frame.src = '/horizon/';
    if (typeof showToast === 'function') showToast('Horizon data imported', 'success');
  }

  // 3b. Export — copy the blob to clipboard for backup/migration.
  function exportData() {
    var cur = _readLocal();
    if (!cur) {
      if (typeof showToast === 'function') showToast('No Horizon data to export yet', 'warning');
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cur).then(function() {
          if (typeof showToast === 'function') showToast('Horizon data copied to clipboard', 'success');
        }, function() { prompt('Copy your Horizon data:', cur); });
      } else {
        prompt('Copy your Horizon data:', cur);
      }
    } catch (e) {
      prompt('Copy your Horizon data:', cur);
    }
  }

  window.HorizonBridge = {
    initView: initView,
    restoreIfEmpty: restoreIfEmpty,
    importData: importData,
    exportData: exportData
  };
})();
