// 51-a11y-pass.js — v34.72
// Lightweight runtime accessibility sweep. Finds buttons that are icon-only
// (no visible text content, just an SVG/img child) and missing an aria-label,
// then synthesizes one from their title attribute (or a fallback). Runs once
// on DOMContentLoaded and on a 2s interval to catch dynamically-mounted UI.
//
// Why runtime instead of touching every <button> in HTML:
// - Several thousand icon buttons across the codebase, many in JS-built strings.
// - One pass covers them all + future additions.
// - Title attributes are already populated for most buttons, so the work is
//   really just promoting title → aria-label.

(function(){
  if (typeof document === 'undefined') return;

  function _hasVisibleText(el) {
    var txt = (el.textContent || '').replace(/\s+/g, '').trim();
    return txt.length > 0;
  }
  function _hasIconChild(el) {
    return !!el.querySelector('svg, img');
  }

  function _label(el) {
    if (el.getAttribute('aria-label')) return; // already labeled
    if (_hasVisibleText(el)) return; // text content is already its name
    if (!_hasIconChild(el)) return; // not icon-only

    var title = el.getAttribute('title');
    if (title && title.trim()) {
      el.setAttribute('aria-label', title.trim());
      return;
    }
    // Fallback: try data-action / id / class hint
    var hint = el.getAttribute('data-action')
      || el.id
      || (el.className && typeof el.className === 'string' ? el.className.split(/\s+/).find(function(c){ return /-btn$/.test(c) || /^icon-/.test(c); }) : '');
    if (hint) {
      var pretty = String(hint).replace(/[-_]/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
      el.setAttribute('aria-label', pretty.trim() || 'Button');
    } else {
      el.setAttribute('aria-label', 'Button');
    }
  }

  function sweep() {
    try {
      var buttons = document.querySelectorAll('button:not([aria-label])');
      for (var i = 0; i < buttons.length; i++) _label(buttons[i]);
      // Also sweep clickable [role="button"] divs
      var roleBtns = document.querySelectorAll('[role="button"]:not([aria-label])');
      for (var j = 0; j < roleBtns.length; j++) _label(roleBtns[j]);
    } catch (e) {
      if (window.ROWEOS_DEBUG) console.warn('[a11y sweep]', e && e.message);
    }
  }

  function init() {
    sweep();
    // Repeat periodically for dynamically-mounted UI (modals, overlays, lists).
    setInterval(sweep, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.A11ySweep = { run: sweep };
})();
