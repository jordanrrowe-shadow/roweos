// 48-sync-freshness.js
// v33.92: Live freshness clock for the Sync Hub header. Reads the most recent
// `roweos_last_local_save` timestamp every 5 seconds and updates
// #syncHubFreshness with a relative-time string ("just now", "12s ago",
// "3 min ago"). Closes the user's request to see proof that timestamps update
// on every save.
//
// The clock auto-stops when the Sync view is hidden (no DOM hook) and resumes
// when shown.

(function(){
  var TIMER_KEY = '_brillianceFreshnessTimer';

  function _readLastSave() {
    try {
      var v = parseInt(localStorage.getItem('roweos_last_local_save') || '0', 10);
      return isNaN(v) ? 0 : v;
    } catch(e){ return 0; }
  }

  function _format(ms) {
    if (!ms) return 'never';
    var diff = Date.now() - ms;
    if (diff < 0) return 'just now';
    if (diff < 5000) return 'just now';
    if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    try { return new Date(ms).toLocaleString(); } catch(e){ return 'older'; }
  }

  function tick() {
    var el = document.getElementById('syncHubFreshness');
    if (!el) return;
    el.textContent = _format(_readLastSave());
  }

  function _start() {
    if (window[TIMER_KEY]) return;
    tick();
    window[TIMER_KEY] = setInterval(tick, 5000);
  }
  function _stop() {
    if (window[TIMER_KEY]) {
      clearInterval(window[TIMER_KEY]);
      window[TIMER_KEY] = null;
    }
  }

  // Tick whenever the Sync view becomes visible. Use a MutationObserver on
  // #syncView to detect class changes (the existing showView pattern toggles
  // .hidden).
  function _boot() {
    var view = document.getElementById('syncView');
    if (!view) {
      // Maybe boot before view is registered — try again later.
      setTimeout(_boot, 1000);
      return;
    }
    if (!view.classList.contains('hidden')) _start();
    if (typeof MutationObserver !== 'undefined') {
      try {
        new MutationObserver(function() {
          if (view.classList.contains('hidden')) _stop();
          else _start();
        }).observe(view, { attributes: true, attributeFilter: ['class'] });
      } catch(e){}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    setTimeout(_boot, 100);
  }

  window.SyncFreshness = { tick: tick, _start: _start, _stop: _stop };
})();
