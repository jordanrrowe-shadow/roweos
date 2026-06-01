// 45-folio-easel.js
// Folio → Studio at Work — Tier 2 surface from
// docs/brilliance/12-surface-system.md "Folio — Studio at Work" section.
//
// CSS-only treatment behind a body class `folio-easel`. When ON inside the
// Folio Chat tab, the chat re-flows so the active artifact is centered and the
// conversation lives in the right gutter. Existing Folio pipelines untouched.
//
// Persisted at localStorage('roweos_folio_easel') = 'true' | 'false'.

(function(){
  var KEY = 'roweos_folio_easel';

  function _read() {
    try { return localStorage.getItem(KEY) === 'true'; } catch(e){ return false; }
  }
  function _persist(on) {
    try { localStorage.setItem(KEY, on ? 'true' : 'false'); } catch(e){}
  }

  function isOn() {
    try { return document.body && document.body.classList.contains('folio-easel'); } catch(e){ return false; }
  }

  function _syncBtn(on) {
    try {
      var btn = document.getElementById('folioEaselToggle');
      if (btn) {
        btn.classList.toggle('active', !!on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    } catch(e){}
  }

  function apply(on) {
    if (!document.body) return;
    document.body.classList.toggle('folio-easel', !!on);
    _syncBtn(on);
  }

  function toggle() {
    var next = !isOn();
    apply(next);
    _persist(next);
    try {
      if (typeof showToast === 'function') {
        showToast(next ? 'Studio at Work on: artifact center, chat right.' : 'Studio at Work off.', 'info');
      }
    } catch(e){}
    return next;
  }

  function _boot() {
    if (_read()) apply(true);
    else _syncBtn(false);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  window.FolioEasel = { isOn: isOn, toggle: toggle, apply: apply };
})();
