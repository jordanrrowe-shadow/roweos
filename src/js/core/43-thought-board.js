// 43-thought-board.js
// Thought Board — Tier 3 surface scaffold per
// docs/brilliance/12-surface-system.md "Thought Board" section.
//
// Free-form research surface. Each pin is a card representing an idea pulled
// from Chat / Notebook / Studio (cross-surface deep links land in v34). Two
// modes: Pinboard (grid manipulation) and Constellation (2D map).
//
// Pin shape:
//   { id, kind, title, body, source: { view, refId, label }, color, x, y, _modifiedAt }
//
// Storage: localStorage('roweos_thought_board') — array of pin objects.
// Future: SyncV5 collection in v34.

(function(){
  var KEY = 'roweos_thought_board';
  var _mode = 'pinboard'; // | 'constellation'

  function _isLight() {
    try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; }
  }

  function _readPins() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch(e){ return []; }
  }
  function _writePins(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr || [])); } catch(e){}
    // v34.81: Sync to Firestore so pins show up across devices.
    try {
      if (typeof writeDB === 'function') {
        writeDB('profile/main', { thought_board_pins: arr || [] });
      }
    } catch(e){}
  }

  function _escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _newId() { return 'pin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

  function addPin(pin) {
    if (!pin || typeof pin !== 'object') return null;
    var pins = _readPins();
    var entry = {
      id: pin.id || _newId(),
      kind: pin.kind || 'note',
      title: String(pin.title || 'Pinned thought'),
      body: String(pin.body || ''),
      source: pin.source || { view: 'manual', refId: '', label: 'Manual' },
      color: pin.color || null,
      x: typeof pin.x === 'number' ? pin.x : Math.random() * 0.7 + 0.1,
      y: typeof pin.y === 'number' ? pin.y : Math.random() * 0.7 + 0.1,
      _modifiedAt: Date.now()
    };
    pins.push(entry);
    _writePins(pins);
    render();
    return entry;
  }

  function removePin(id) {
    var pins = _readPins().filter(function(p){ return p.id !== id; });
    _writePins(pins);
    render();
  }

  // v34.69: Inline pin composer. Replaces the previous prompt() chain with a
  // panel that mounts above the pinboard / constellation pane. No popup, no
  // modal — just an editable surface that uses the workspace it's already in.
  function addPinPrompt() {
    var existing = document.getElementById('boardPinComposer');
    if (existing) {
      var titleInput = existing.querySelector('[data-pin-input="title"]');
      if (titleInput) titleInput.focus();
      return;
    }

    // Find the host: prefer the active pane; fall back to the surface line.
    var host = document.getElementById('boardPinboardPane');
    if (_mode === 'constellation') host = document.getElementById('boardConstellationPane');
    if (!host) return;

    var composer = document.createElement('div');
    composer.id = 'boardPinComposer';
    composer.style.cssText = 'border:1px solid var(--border-color);border-radius:12px;padding:14px 16px;margin-bottom:14px;background:var(--bg-secondary);';
    composer.innerHTML =
      '<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;">New pin</div>' +
      '<input data-pin-input="title" type="text" placeholder="What\'s the idea?" style="width:100%;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:9px 12px;color:var(--text-primary);font-size:14px;outline:none;font-family:inherit;margin-bottom:8px;" />' +
      '<textarea data-pin-input="body" placeholder="Optional context (Cmd+Enter to save)" rows="2" style="width:100%;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:9px 12px;color:var(--text-primary);font-size:13px;outline:none;font-family:inherit;resize:vertical;"></textarea>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">' +
        '<button type="button" data-pin-action="cancel" style="padding:7px 14px;background:transparent;border:1px solid var(--border-color);border-radius:99px;color:var(--text-secondary);font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;font-family:inherit;">Cancel</button>' +
        '<button type="button" data-pin-action="save" style="padding:7px 18px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;font-family:inherit;">Save pin</button>' +
      '</div>';
    host.insertBefore(composer, host.firstChild);

    var titleEl = composer.querySelector('[data-pin-input="title"]');
    var bodyEl  = composer.querySelector('[data-pin-input="body"]');
    var cancelBtn = composer.querySelector('[data-pin-action="cancel"]');
    var saveBtn   = composer.querySelector('[data-pin-action="save"]');
    setTimeout(function(){ if (titleEl) titleEl.focus(); }, 50);

    function _close() {
      if (composer.parentNode) composer.parentNode.removeChild(composer);
    }
    function _save() {
      var title = (titleEl && titleEl.value || '').trim();
      var body  = (bodyEl  && bodyEl.value  || '').trim();
      if (!title) { titleEl && titleEl.focus(); return; }
      addPin({ title: title, body: body, source: { view: 'manual', refId: '', label: 'Manual' } });
      try { if (typeof showToast === 'function') showToast('Pinned to Thought Board.', 'success'); } catch(e){}
      _close();
    }

    cancelBtn.onclick = _close;
    saveBtn.onclick = _save;
    function _key(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); _close(); }
      if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); _save(); }
    }
    if (titleEl) {
      titleEl.addEventListener('keydown', function(ev){
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); _save(); }
        else _key(ev);
      });
    }
    if (bodyEl) bodyEl.addEventListener('keydown', _key);
  }

  function setMode(mode) {
    if (mode !== 'pinboard' && mode !== 'constellation') return;
    _mode = mode;
    var pills = document.querySelectorAll('[data-board-mode]');
    for (var i = 0; i < pills.length; i++) {
      pills[i].classList.toggle('active', pills[i].getAttribute('data-board-mode') === mode);
    }
    var pin = document.getElementById('boardPinboardPane');
    var con = document.getElementById('boardConstellationPane');
    if (pin) pin.classList.toggle('hidden', mode !== 'pinboard');
    if (pin) pin.classList.toggle('active', mode === 'pinboard');
    if (con) con.classList.toggle('hidden', mode !== 'constellation');
    if (con) con.classList.toggle('active', mode === 'constellation');
    render();
  }

  function _kindIcon(kind) {
    switch(kind){
      case 'chat':     return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5c0 4.142-4.03 7.5-9 7.5a10.39 10.39 0 0 1-3.65-.66L3 20l1.73-4.17C3.65 14.5 3 13.07 3 11.5 3 7.36 7.03 4 12 4s9 3.36 9 7.5z"/></svg>';
      case 'notebook': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>';
      case 'studio':   return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      default:         return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L9.5 8.5 3 9.5l4.5 4.5L6 21l6-3 6 3-1.5-7L21 9.5l-6.5-1z"/></svg>';
    }
  }

  function _renderPinboard(pins) {
    var pane = document.getElementById('boardPinboardPane');
    if (!pane) return;
    if (pins.length === 0) {
      pane.innerHTML = '<div class="board-empty"><div class="board-empty-title">No pins yet.</div><div class="board-empty-desc">Click <strong>+ Pin</strong> above to add a manual idea, or use a "Pin to Thought Board" action from Chat / Notebook / Studio (cross-surface deep links land in v34).</div></div>';
      return;
    }
    var html = '<div class="board-grid">';
    for (var i = 0; i < pins.length; i++) {
      var p = pins[i];
      html += '<article class="board-card" data-pin-id="' + _escapeHtml(p.id) + '">' +
        '<div class="board-card-head">' +
          '<span class="board-card-icon">' + _kindIcon(p.kind) + '</span>' +
          '<span class="board-card-source">' + _escapeHtml((p.source && p.source.label) || p.kind || 'manual') + '</span>' +
          '<button class="board-card-close" onclick="window.ThoughtBoard.removePin(\'' + _escapeHtml(p.id) + '\')" title="Remove pin">×</button>' +
        '</div>' +
        '<h3 class="board-card-title">' + _escapeHtml(p.title) + '</h3>' +
        (p.body ? '<p class="board-card-body">' + _escapeHtml(p.body) + '</p>' : '') +
      '</article>';
    }
    html += '</div>';
    pane.innerHTML = html;
  }

  function _renderConstellation(pins) {
    var stage = document.getElementById('boardConstellationStage');
    if (!stage) return;
    stage.innerHTML = '';
    if (pins.length === 0) {
      stage.innerHTML = '<div class="board-empty board-empty-center"><div class="board-empty-title">Constellation empty.</div><div class="board-empty-desc">Pin a few thoughts and they appear here as a 2D map.</div></div>';
      return;
    }
    // Render as positioned dots with hover label.
    for (var i = 0; i < pins.length; i++) {
      var p = pins[i];
      var node = document.createElement('button');
      node.type = 'button';
      node.className = 'board-star';
      node.setAttribute('data-pin-id', p.id);
      node.style.left = ((p.x || 0.5) * 100).toFixed(2) + '%';
      node.style.top  = ((p.y || 0.5) * 100).toFixed(2) + '%';
      node.title = p.title + (p.body ? '\n\n' + p.body.slice(0, 200) : '');
      node.innerHTML = '<span class="dot"></span><span class="lbl">' + _escapeHtml(p.title.slice(0, 40)) + '</span>';
      stage.appendChild(node);
    }
  }

  // v33.79: Update sidebar pin-count badge. Called on every pin add/remove
  // and on initial boot so the count is fresh whenever the user looks at it.
  function _refreshSidebarBadge() {
    var pins = _readPins();
    var n = pins.length;
    var ids = ['boardPinCount', 'boardPinCountSubitem'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) {
        if (n > 0) {
          el.textContent = String(n);
          el.classList.add('on');
        } else {
          el.textContent = '';
          el.classList.remove('on');
        }
      }
    }
  }

  function render() {
    var pins = _readPins();
    var summary = document.getElementById('boardSummary');
    if (summary) {
      if (pins.length === 0) {
        summary.textContent = 'No pins yet. Start small: add a manual pin or pin a Chat / Notebook / Studio item.';
      } else {
        summary.textContent = pins.length + ' pin' + (pins.length === 1 ? '' : 's') + ' · mode: ' + _mode;
      }
    }
    if (_mode === 'pinboard') _renderPinboard(pins);
    else _renderConstellation(pins);
    _refreshSidebarBadge();
  }

  // Public API
  window.ThoughtBoard = {
    render: render,
    setMode: setMode,
    addPin: addPin,
    addPinPrompt: addPinPrompt,
    removePin: removePin,
    getMode: function(){ return _mode; },
    getPins: _readPins,
    refreshBadge: _refreshSidebarBadge
  };

  // v33.79: refresh the sidebar pin-count badge on initial boot so the count
  // is correct even before the user opens the Thought Board view.
  function _bootBadge() {
    try { _refreshSidebarBadge(); } catch(e){}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bootBadge);
  } else {
    setTimeout(_bootBadge, 0);
  }
})();
