// 47-changelog-render.js
// v33.82: Settings → Update Changelog renderer. Reads a baked-in array of
// recent versions (kept in sync with the v33.x ship cadence) and renders
// them into #updateChangelog. Replaces the hard-coded v25/v26 entries that
// had gone stale.
//
// To update: prepend a new entry to RECENT_VERSIONS when CHANGELOG.md gets
// a new ## heading. The renderer shows the most recent 12.

(function(){
  // Most recent first. Each entry: { v, date, items[] }
  // Synced with /CHANGELOG.md heads.
  var RECENT_VERSIONS = [
    { v: 'v33.81', date: 'Apr 30, 2026', items: [
      'Sync reconcile + UUID purge tooling. Sync Hub gets Preview drift / Reconcile tombstones / Purge stale UUID buttons',
      'Resolves perpetual "Aligning… (-N)" state by deleting cloud items that match local tombstones',
      'Two-step PURGE confirm before any destructive write'
    ]},
    { v: 'v33.80', date: 'Apr 30, 2026', items: [
      'Thought Board guided tour (5 steps)',
      'What\'s New modal refreshed with the v33.50 to v33.80 ship list, light-mode aware'
    ]},
    { v: 'v33.79', date: 'Apr 30, 2026', items: [
      'Thought Board pin-count badge in sidebar. Gold pill shows live total'
    ]},
    { v: 'v33.78', date: 'Apr 30, 2026', items: [
      '+16 critical-path tests for the new surface modules. 255 total'
    ]},
    { v: 'v33.76', date: 'Apr 30, 2026', items: [
      'Folio routed to Studio at Work mode (Tier 2). Artifact center, chat in right gutter'
    ]},
    { v: 'v33.75', date: 'Apr 30, 2026', items: [
      'Studio routed to Split-Pane Workspace mode (Tier 2). Input left, sticky output right'
    ]},
    { v: 'v33.74', date: 'Apr 30, 2026', items: [
      'Pin-to-Thought-Board hooks across Chat / Notebook / Studio'
    ]},
    { v: 'v33.73', date: 'Apr 30, 2026', items: [
      'Thought Board scaffold (Tier 3 surface). Pinboard + Constellation modes'
    ]},
    { v: 'v33.71', date: 'Apr 30, 2026', items: [
      'Notebook routed to Letter Series toggle. Cream paper, narrow column, gold drop caps'
    ]},
    { v: 'v33.70', date: 'Apr 30, 2026', items: [
      'History routed to Time Ribbon. Horizontal scrubbing timeline'
    ]},
    { v: 'v33.67', date: 'Apr 30, 2026', items: [
      'Focus Mode (⌘⇧F) strips ambient chrome on any surface'
    ]},
    { v: 'v33.63', date: 'Apr 30, 2026', items: [
      'CRITICAL: Rhythm calendar restored after months of silent failure',
      'Fixed orphan ReferenceErrors from v28.8 Focus retirement'
    ]}
  ];

  function _escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function renderUpdateChangelog() {
    var verEl = document.getElementById('updateCurrentVersionValue');
    if (verEl) verEl.textContent = (typeof ROWEOS_VERSION === 'string') ? ROWEOS_VERSION : 'v33.x';
    var host = document.getElementById('updateChangelog');
    if (!host) return;
    var html = '';
    for (var i = 0; i < Math.min(RECENT_VERSIONS.length, 12); i++) {
      var e = RECENT_VERSIONS[i];
      html += '<div style="margin-bottom:14px;">' +
        '<strong style="color:var(--text-primary);">' + _escapeHtml(e.v) + '</strong>' +
        ' <span style="color:var(--text-tertiary);">' + _escapeHtml(e.date) + '</span>' +
        '<ul style="margin:4px 0 0 16px;padding:0;">';
      for (var j = 0; j < e.items.length; j++) {
        html += '<li>' + _escapeHtml(e.items[j]) + '</li>';
      }
      html += '</ul></div>';
    }
    host.innerHTML = html;
  }

  // Hook: render on settings open + on initial load.
  function _boot() {
    try { renderUpdateChangelog(); } catch(e){}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    setTimeout(_boot, 0);
  }

  window.BRILLIANCE_CHANGELOG = RECENT_VERSIONS;
  window.renderUpdateChangelog = renderUpdateChangelog;
})();
