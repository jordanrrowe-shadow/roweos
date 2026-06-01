// 40-focus-mode.js
// Focus Mode (Negative Space) — Tier 1 surface modifier per
// docs/brilliance/12-surface-system.md "Focus Mode" section.
//
// Strips the active surface to: one message + Brilli + input. Ambient elements
// (sidebar, nav, breadcrumbs, secondary cards) fade out. Toggle is a system-wide
// modifier — works on every surface.
//
// Activation:
//   Keyboard: Cmd+Shift+F (or Ctrl+Shift+F)
//   ESC exits focus mode without toggling other modes
//
// Disable: localStorage('roweos_focus_mode_disabled') === 'true' silences the
// keyboard shortcut entirely (Settings UI hook for v33.x).

(function(){
  var FLAG_KEY = 'roweos_focus_mode_disabled';

  function isAllowed() {
    try { return localStorage.getItem(FLAG_KEY) !== 'true'; } catch(e) { return true; }
  }

  function toggle() {
    if (!isAllowed()) return false;
    var b = document.body;
    if (!b) return false;
    var on = b.classList.toggle('focus-mode');
    try {
      if (typeof showToast === 'function') {
        showToast(on
          ? 'Focus mode on. ⌘⇧F or Esc to exit.'
          : 'Focus mode off.',
          'info');
      }
    } catch(e){}
    try {
      if (window.Brilli && typeof window.Brilli.setState === 'function') {
        window.Brilli.setState(on ? 'attending' : 'idle');
      }
    } catch(e){}
    return on;
  }

  function exit() {
    var b = document.body;
    if (b && b.classList.contains('focus-mode')) {
      b.classList.remove('focus-mode');
      try {
        if (window.Brilli && typeof window.Brilli.setState === 'function') {
          window.Brilli.setState('idle');
        }
      } catch(e){}
    }
  }

  document.addEventListener('keydown', function(e) {
    if (!e) return;
    var mod = e.metaKey || e.ctrlKey;
    var key = e.key || '';
    if (mod && e.shiftKey && (key === 'F' || key === 'f')) {
      try { e.preventDefault(); } catch(_){}
      toggle();
      return;
    }
    if (key === 'Escape' && document.body && document.body.classList.contains('focus-mode')) {
      exit();
    }
  });

  window.FocusMode = {
    toggle: toggle,
    exit: exit,
    isAllowed: isAllowed,
    isOn: function(){ return !!(document.body && document.body.classList.contains('focus-mode')); }
  };
})();
