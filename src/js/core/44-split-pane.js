// 44-split-pane.js
// Studio → Split-Pane Workspace — Tier 2 surface from
// docs/brilliance/12-surface-system.md "Studio — Split-Pane Workspace" section.
//
// CSS-only treatment behind a body class `studio-split-pane`. When ON inside
// the Studio view, the input section + output section flow into a 2-column
// layout (input left, output right). Existing Studio operations + flows are
// untouched — this is purely visual chrome.
//
// Persisted at localStorage('roweos_studio_split_pane') = 'true' | 'false'.

(function(){
  var KEY = 'roweos_studio_split_pane';

  function _read() {
    try { return localStorage.getItem(KEY) === 'true'; } catch(e){ return false; }
  }
  function _persist(on) {
    try { localStorage.setItem(KEY, on ? 'true' : 'false'); } catch(e){}
  }

  function isOn() {
    try { return document.body && document.body.classList.contains('studio-split-pane'); } catch(e){ return false; }
  }

  function _syncBtn(on) {
    try {
      var btn = document.getElementById('studioSplitToggle');
      if (btn) {
        btn.classList.toggle('active', !!on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    } catch(e){}
  }

  function apply(on) {
    if (!document.body) return;
    document.body.classList.toggle('studio-split-pane', !!on);
    _syncBtn(on);
  }

  function toggle() {
    var next = !isOn();
    apply(next);
    _persist(next);
    try {
      if (typeof showToast === 'function') {
        showToast(next ? 'Split-Pane Workspace on: input + output side-by-side.' : 'Split-Pane Workspace off: single-column flow.', 'info');
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

  // v34.11: ⌘ ⌥ P / Ctrl + Alt + P toggles split-pane while in Studio.
  // Mirrors the v34.9 ⌘ ⌥ B Brilli-cycle keybinding pattern (skip when typing).
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  function _isStudioVisible(){
    try {
      var sv = document.getElementById('studioView');
      if (!sv) return false;
      if (sv.classList.contains('hidden')) return false;
      // Account for the legacy display:none gating used elsewhere.
      var disp = sv.style.display || '';
      if (disp === 'none') return false;
      return true;
    } catch(e){ return false; }
  }
  document.addEventListener('keydown', function(ev){
    if (_isInputTarget(ev.target)) return;
    var key = (ev.key || '').toLowerCase();
    // ⌥P emits π on macOS.
    if (key !== 'p' && key !== 'π') return;
    var modOK = (ev.metaKey && ev.altKey) || (ev.ctrlKey && ev.altKey);
    if (!modOK) return;
    if (!_isStudioVisible()) return;
    ev.preventDefault();
    toggle();
  });

  window.SplitPane = { isOn: isOn, toggle: toggle, apply: apply };
})();
