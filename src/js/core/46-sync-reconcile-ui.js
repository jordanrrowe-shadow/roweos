// 46-sync-reconcile-ui.js
// v33.81: Sync Hub reconcile + purge UI handler. Wraps the registry-level
// helpers in 22a-tombstones.js (reconcileAllWithTombstones, purgeUUIDStale,
// buildSyncReconciliationReport) with confirm-gated user-facing actions and
// renders results into the Sync Hub's #syncReconcileReport panel.
//
// User flow:
//   Preview drift   → buildSyncReconciliationReport(); render counts
//   Reconcile       → reconcileAllWithTombstones(); show what was deleted
//   Purge stale     → buildSyncReconciliationReport() preview, then a 2-step
//                     confirm, then purgeUUIDStale({ confirmed: true }).

(function(){
  function _el(id) { return document.getElementById(id); }

  function _setBusy(on) {
    var ids = ['syncReconcilePreviewBtn','syncReconcileRunBtn','syncPurgeStaleBtn'];
    for (var i = 0; i < ids.length; i++) {
      var b = _el(ids[i]);
      if (b) {
        b.disabled = !!on;
        b.style.opacity = on ? '0.55' : '';
        b.style.cursor = on ? 'progress' : 'pointer';
      }
    }
  }

  function _renderReport(text) {
    var pre = _el('syncReconcileReport');
    if (!pre) return;
    pre.textContent = text;
    pre.style.display = 'block';
  }

  function _formatRow(r) {
    if (!r) return '';
    if (r.skipped) return r.label + ' - skipped (' + r.skipped + ')';
    if (r.error)   return r.label + ' - error: ' + r.error;
    return r.label.padEnd(22, ' ') +
      ' local=' + (r.localCount != null ? r.localCount : '?').toString().padStart(4) +
      '  cloud=' + (r.cloudCount != null ? r.cloudCount : '?').toString().padStart(4) +
      '  tombs=' + (r.tombstoneCount != null ? r.tombstoneCount : '?').toString().padStart(4) +
      '  cloud-stale=' + (r.cloudStaleCount != null ? r.cloudStaleCount : '?').toString().padStart(4) +
      '  cloud-orphan=' + (r.cloudOrphanCount != null ? r.cloudOrphanCount : '?').toString().padStart(4);
  }

  function preview() {
    if (typeof window.buildSyncReconciliationReport !== 'function') {
      try { if (typeof showToast === 'function') showToast('Tombstone registry not loaded.', 'error'); } catch(e){}
      return;
    }
    _setBusy(true);
    _renderReport('Reading cloud subcollections… (this can take a few seconds for large UUIDs)');
    window.buildSyncReconciliationReport().then(function(rep) {
      var lines = ['Sync drift report - ' + new Date().toLocaleString(), ''];
      var totalStale = 0, totalOrphan = 0;
      for (var i = 0; i < rep.perCategory.length; i++) {
        lines.push(_formatRow(rep.perCategory[i]));
        if (rep.perCategory[i].cloudStaleCount) totalStale += rep.perCategory[i].cloudStaleCount;
        if (rep.perCategory[i].cloudOrphanCount) totalOrphan += rep.perCategory[i].cloudOrphanCount;
      }
      lines.push('');
      lines.push('Summary:');
      lines.push('  cloud items already tombstoned (would delete on Reconcile): ' + totalStale);
      lines.push('  cloud items missing locally without tombstone (Purge candidates): ' + totalOrphan);
      _renderReport(lines.join('\n'));
      _setBusy(false);
    }, function(err) {
      _renderReport('Preview failed: ' + (err && err.message || err));
      _setBusy(false);
    });
  }

  function runReconcile() {
    if (typeof window.reconcileAllWithTombstones !== 'function') {
      try { if (typeof showToast === 'function') showToast('Tombstone registry not loaded.', 'error'); } catch(e){}
      return;
    }
    if (!confirm('Reconcile tombstones?\n\nFor every category, any cloud item that this device has already tombstoned will be deleted from the cloud.\n\nThis is safe: it only removes items you previously deleted that the cloud is keeping alive.\n\nContinue?')) return;
    _setBusy(true);
    _renderReport('Reconciling… do not close this tab.');
    window.reconcileAllWithTombstones().then(function(res) {
      var lines = ['Reconcile complete - ' + new Date().toLocaleString(), ''];
      lines.push('Total cloud items deleted: ' + (res.totalDeleted || 0));
      lines.push('');
      for (var i = 0; i < res.perCategory.length; i++) {
        var r = res.perCategory[i];
        if (r.skipped) continue;
        if (r.alreadyClean) {
          lines.push(r.cat + ' - already clean');
        } else {
          lines.push(r.cat + ' - deleted ' + r.deleted +
            (r.failed && r.failed.length ? '  (failed ' + r.failed.length + ')' : ''));
        }
      }
      _renderReport(lines.join('\n'));
      _setBusy(false);
      try { if (typeof showToast === 'function') showToast('Reconcile complete: ' + (res.totalDeleted || 0) + ' cloud items deleted.', 'success'); } catch(e){}
      try { if (typeof renderSyncInventory === 'function') renderSyncInventory(); } catch(e){}
    }, function(err) {
      _renderReport('Reconcile failed: ' + (err && err.message || err));
      _setBusy(false);
    });
  }

  function runPurge() {
    if (typeof window.purgeUUIDStale !== 'function' || typeof window.buildSyncReconciliationReport !== 'function') {
      try { if (typeof showToast === 'function') showToast('Tombstone registry not loaded.', 'error'); } catch(e){}
      return;
    }
    _setBusy(true);
    _renderReport('Building purge plan…');
    window.buildSyncReconciliationReport().then(function(rep) {
      var totalOrphan = 0;
      var bullets = [];
      for (var i = 0; i < rep.perCategory.length; i++) {
        var r = rep.perCategory[i];
        if (r && r.cloudOrphanCount) {
          totalOrphan += r.cloudOrphanCount;
          bullets.push('  - ' + r.label + ': ' + r.cloudOrphanCount);
        }
      }
      if (totalOrphan === 0) {
        _renderReport('Nothing to purge: every cloud item is either present locally or already tombstoned.');
        _setBusy(false);
        return;
      }
      var msg = 'PURGE STALE UUID DATA?\n\n' +
        'This device shows ' + totalOrphan + ' cloud item(s) that are NOT in your local data and NOT yet tombstoned.\n\n' +
        bullets.join('\n') + '\n\n' +
        'Pressing OK will TOMBSTONE and DELETE those cloud items so they never resurrect on any device. ' +
        'This is irreversible. Use only if you are certain those items are stale (e.g. left over from a previous version).';
      if (!confirm(msg)) {
        _renderReport('Purge cancelled.');
        _setBusy(false);
        return;
      }
      // Second confirm — type-to-confirm pattern.
      var typed = prompt('Type PURGE to confirm (this will delete ' + totalOrphan + ' cloud items):');
      if (typed !== 'PURGE') {
        _renderReport('Purge cancelled (confirmation phrase did not match).');
        _setBusy(false);
        return;
      }
      _renderReport('Purging… do not close this tab.');
      return window.purgeUUIDStale({ confirmed: true }).then(function(res) {
        var lines = ['Purge complete - ' + new Date().toLocaleString(), ''];
        lines.push('Total cloud items tombstoned + deleted: ' + (res.totalPurged || 0));
        lines.push('');
        for (var j = 0; j < res.perCategory.length; j++) {
          var rj = res.perCategory[j];
          lines.push(rj.id + ' - ' + (rj.count || 0) + (rj.ok === false ? '  (had failures)' : ''));
        }
        _renderReport(lines.join('\n'));
        _setBusy(false);
        try { if (typeof showToast === 'function') showToast('Purged ' + (res.totalPurged || 0) + ' stale cloud items.', 'success'); } catch(e){}
        try { if (typeof renderSyncInventory === 'function') renderSyncInventory(); } catch(e){}
      }, function(err) {
        _renderReport('Purge failed: ' + (err && err.message || err));
        _setBusy(false);
      });
    }, function(err) {
      _renderReport('Plan-build failed: ' + (err && err.message || err));
      _setBusy(false);
    });
  }

  // v33.9: PWA hard-refresh. Clears Cache Storage + unregisters Service Workers
  // so iOS PWAs can pick up the latest deployed assets + a fresh cloud pull.
  // The user has seen iOS Safari show stale data (e.g. 8 Studio Outputs while
  // Chrome desktop showed 3) because the PWA caches aggressively.
  function hardRefresh() {
    if (!confirm('Hard refresh?\n\nThis clears the PWA cache and reloads. Use if iOS shows different data than desktop.\n\nYour local data is NOT deleted; only the cached HTML/JS assets are cleared so the app reloads fresh.')) return;
    _setBusy(true);
    _renderReport('Clearing PWA cache + service workers…');
    var jobs = [];
    try {
      if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
        jobs.push(caches.keys().then(function(keys) {
          return Promise.all(keys.map(function(k) { return caches.delete(k); }));
        }));
      }
    } catch(e){}
    try {
      if (navigator && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
        jobs.push(navigator.serviceWorker.getRegistrations().then(function(regs) {
          return Promise.all((regs || []).map(function(r) { return r.unregister(); }));
        }));
      }
    } catch(e){}
    Promise.all(jobs).then(function(){
      // Force a fresh pull from the cloud before reload, so even if assets are
      // cached the data layer is current.
      try { if (typeof loadFromFirebaseV2 === 'function') loadFromFirebaseV2(); } catch(e){}
      _renderReport('Cache cleared. Reloading…');
      setTimeout(function(){
        try { window.location.reload(true); } catch(e){ window.location.reload(); }
      }, 600);
    }, function(err) {
      _renderReport('Hard refresh partial failure: ' + (err && err.message || err));
      _setBusy(false);
    });
  }

  window.SyncReconcileUI = {
    preview: preview,
    runReconcile: runReconcile,
    runPurge: runPurge,
    hardRefresh: hardRefresh
  };
})();
