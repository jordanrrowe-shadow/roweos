// 42-letter-series.js
// Notebook → Letter Series — Tier 2 surface from
// docs/brilliance/12-surface-system.md "Notebook — Letter Series" section.
//
// Toggleable visual mode for Scribe (Notebook). When ON: cream paper background,
// Cormorant Garamond serif headings, narrow center column (max-width 720px),
// gold drop cap on the first paragraph of every page, marginalia hooks.
// Existing Scribe data + flows preserved — this is purely a visual treatment
// applied via the body class `letter-series`.
//
// Public API:
//   isOn()           — current state
//   toggle()         — flip state, persist, update toggle btn
//   apply(on)        — explicit set (used at boot to restore preference)
//
// Persisted at localStorage('roweos_letter_series') = 'true' | 'false'.

(function(){
  var KEY = 'roweos_letter_series';

  function _persist(on) {
    try { localStorage.setItem(KEY, on ? 'true' : 'false'); } catch(e){}
  }
  function _read() {
    try { return localStorage.getItem(KEY) === 'true'; } catch(e){ return false; }
  }

  function isOn() {
    try { return document.body && document.body.classList.contains('letter-series'); } catch(e){ return false; }
  }

  function _syncBtn(on) {
    try {
      var btn = document.getElementById('scribeLetterToggle');
      if (btn) {
        btn.classList.toggle('active', !!on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    } catch(e){}
  }

  function apply(on) {
    if (!document.body) return;
    document.body.classList.toggle('letter-series', !!on);
    _syncBtn(on);
  }

  function toggle() {
    var next = !isOn();
    apply(next);
    _persist(next);
    try {
      if (typeof showToast === 'function') {
        showToast(next ? 'Letter Series on: cream paper, narrow column.' : 'Letter Series off.', 'info');
      }
    } catch(e){}
    return next;
  }

  // Restore preference on boot.
  function _boot() {
    if (_read()) apply(true);
    else _syncBtn(false);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  window.LetterSeries = { isOn: isOn, toggle: toggle, apply: apply };
})();
