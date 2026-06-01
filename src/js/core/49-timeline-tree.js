// 49-timeline-tree.js — v34.70
// History → Branching Timeline. Replaces the v33.70 horizontal Time Ribbon.
//
// Renders a vertical SVG timeline inside #timeRibbon. Two parallel lanes
// (Brand left, Life right) join a central spine. Each conversation is a node
// on its lane; click expands an inline panel underneath the timeline with the
// resume CTA + first-user-message preview.
//
// Why a tree shape instead of a horizontal ribbon: per the user's reference
// image, history reads better as time flowing top-to-bottom with explicit
// brand/life branching. Horizontal scrubbing also fights the page layout.
//
// Public API: window.BrillianceTimeline.render() — called whenever the
// History view (#tuningView) is shown. Reuses the existing TimeRibbon data
// loaders for tombstone awareness + agentCommands access.

(function(){
  var _items = [];
  var _expandedId = null;
  var _filter = 'all'; // 'all' | 'brand' | 'life'

  function _isLight() {
    try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; }
  }

  function _safeAgentCommands() {
    try { return Array.isArray(window.agentCommands) ? window.agentCommands : []; } catch(e){ return []; }
  }

  function _readTombstoneSet(key) {
    var set = {};
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return set;
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) for (var i = 0; i < arr.length; i++) set[String(arr[i])] = true;
    } catch(e){}
    return set;
  }

  function _ts(c) {
    if (!c) return 0;
    if (typeof c._modifiedAt === 'number') return c._modifiedAt;
    if (typeof c.timestamp === 'number') return c.timestamp;
    if (typeof c.timestamp === 'string') { var t = Date.parse(c.timestamp); if (!isNaN(t)) return t; }
    if (typeof c.id === 'number') return c.id;
    if (typeof c.id === 'string' && /^\d+$/.test(c.id)) return parseInt(c.id, 10);
    return 0;
  }

  function _firstUserText(c) {
    try {
      if (c && typeof c.command === 'string' && c.command) return c.command;
      if (c && Array.isArray(c.messages)) {
        for (var i = 0; i < c.messages.length; i++) {
          var m = c.messages[i];
          if (m && m.role === 'user') {
            if (typeof m.content === 'string') return m.content;
            if (m.displayContent) return String(m.displayContent);
            if (Array.isArray(m.content)) {
              for (var j = 0; j < m.content.length; j++) {
                var b = m.content[j];
                if (b && typeof b.text === 'string') return b.text;
              }
            }
          }
        }
      }
      if (c && typeof c.title === 'string') return c.title;
    } catch(e){}
    return 'Conversation';
  }

  function _loadItems() {
    var brandTomb = _readTombstoneSet('roweos_deleted_chat_ids');
    var lifeTomb  = _readTombstoneSet('roweos_deleted_life_chat_ids');
    var raw = _safeAgentCommands();
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var c = raw[i];
      if (!c) continue;
      var key = String(c.id);
      var mode = c.mode === 'life' ? 'life' : 'brand';
      if (mode === 'life' && lifeTomb[key]) continue;
      if (mode === 'brand' && brandTomb[key]) continue;
      out.push({
        id: c.id,
        mode: mode,
        ts: _ts(c) || Date.now(),
        title: _firstUserText(c).slice(0, 90),
        brandIdx: (typeof c.brandIdx === 'number') ? c.brandIdx : null,
        raw: c
      });
    }
    out.sort(function(a, b){ return b.ts - a.ts; }); // newest first
    return out;
  }

  function _fmtDate(ts) {
    try {
      var d = new Date(ts);
      var today = new Date(); today.setHours(0,0,0,0);
      var dDay  = new Date(ts); dDay.setHours(0,0,0,0);
      var diffDays = Math.round((today.getTime() - dDay.getTime()) / 86400000);
      if (diffDays === 0) return 'Today · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return diffDays + ' days ago';
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: (d.getFullYear() === today.getFullYear() ? undefined : 'numeric') });
    } catch(e) { return ''; }
  }

  function _onResume(idObj) {
    try {
      if (typeof window.chatWithHistoryItem === 'function' && idObj.raw) {
        // Find the item's index in the live agentCommands array.
        var arr = _safeAgentCommands();
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] === idObj.raw || (arr[i] && arr[i].id === idObj.id)) {
            window.chatWithHistoryItem(i);
            return;
          }
        }
      }
      if (typeof window.showView === 'function') window.showView('agent');
    } catch(e) {
      try { if (typeof showToast === 'function') showToast('Could not resume.', 'error'); } catch(_){}
    }
  }

  function _setFilter(f) {
    _filter = (f === 'brand' || f === 'life') ? f : 'all';
    _expandedId = null;
    render();
  }

  function _toggleExpand(id) {
    _expandedId = (_expandedId === id) ? null : id;
    render();
  }

  function render() {
    var host = document.getElementById('timeRibbon');
    if (!host) return;
    _items = _loadItems();
    var lt = _isLight();

    // Reset DOM — we're replacing the v33 ribbon entirely.
    host.classList.add('timeline-tree');
    host.removeAttribute('data-state');
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.gap = '14px';

    var visible = _items.filter(function(it){ return _filter === 'all' || it.mode === _filter; });

    // Header (eyebrow + count + filter pills)
    var head = '<div class="timeline-tree-head" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
      '<div>' +
        '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c9a961;font-weight:500;">Timeline</div>' +
        '<div style="font-size:13px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';margin-top:2px;">' +
          (visible.length === 0 ? 'No conversations yet.' : visible.length + ' conversation' + (visible.length === 1 ? '' : 's') + ' on ' + (_filter === 'all' ? 'both branches' : 'the ' + _filter + ' branch')) +
        '</div>' +
      '</div>' +
      '<div class="timeline-tree-filters" style="display:flex;gap:6px;">' +
        _filterPill('all', 'All', lt) +
        _filterPill('brand', 'Brand', lt) +
        _filterPill('life', 'Life', lt) +
      '</div>' +
    '</div>';

    if (visible.length === 0) {
      host.innerHTML = head + '<div style="padding:24px;border:1px dashed ' + (lt ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.10)') + ';border-radius:12px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.5)') + ';font-size:13px;text-align:center;">Start a conversation in Chat — it lands here as a node.</div>';
      return;
    }

    // SVG metrics
    var rowH = 76;
    var width = 720;
    var spineX = width / 2;
    var brandX = spineX - 140;
    var lifeX  = spineX + 140;
    var height = visible.length * rowH + 40;
    var laneStroke = lt ? 'rgba(168,140,86,0.22)' : 'rgba(201,169,97,0.22)';
    var brandTone = lt ? '#7a6741' : '#c9a961';
    var lifeTone  = lt ? '#5a7a9a' : '#7aa3c9'; // life accent

    var nodesSvg = '';
    var rowsHtml = '';
    for (var i = 0; i < visible.length; i++) {
      var it = visible[i];
      var y = 28 + i * rowH;
      var nodeX = it.mode === 'life' ? lifeX : brandX;
      var nodeColor = it.mode === 'life' ? lifeTone : brandTone;
      var isExpanded = (_expandedId === it.id);

      // Branch line from spine to node
      nodesSvg +=
        '<path d="M' + spineX + ' ' + y + ' Q ' + ((spineX + nodeX)/2) + ' ' + y + ' ' + nodeX + ' ' + y + '" fill="none" stroke="' + laneStroke + '" stroke-width="1.5"/>';
      // Node dot
      nodesSvg +=
        '<circle cx="' + nodeX + '" cy="' + y + '" r="' + (isExpanded ? 7 : 5) + '" fill="' + nodeColor + '" stroke="' + (lt ? '#fbfaf5' : '#0f0f0f') + '" stroke-width="2" style="cursor:pointer;" data-tnode-id="' + _esc(it.id) + '"/>';

      // Side label (text on the node side)
      var labelAnchor = it.mode === 'life' ? 'start' : 'end';
      var labelX      = it.mode === 'life' ? (nodeX + 14) : (nodeX - 14);
      nodesSvg +=
        '<text x="' + labelX + '" y="' + (y - 8) + '" text-anchor="' + labelAnchor + '" style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:12px;font-weight:600;fill:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';cursor:pointer;" data-tnode-id="' + _esc(it.id) + '">' + _esc(it.title || 'Conversation') + '</text>' +
        '<text x="' + labelX + '" y="' + (y + 8) + '" text-anchor="' + labelAnchor + '" style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;fill:' + (lt ? 'rgba(0,0,0,0.45)' : 'rgba(245,236,217,0.45)') + ';">' + _esc(_fmtDate(it.ts)) + '</text>';

      if (isExpanded) {
        var preview = (it.raw && (it.raw.command || _firstUserText(it.raw))) || '';
        rowsHtml +=
          '<div class="timeline-tree-expand" style="border:1px solid ' + (lt ? 'rgba(168,140,86,0.18)' : 'rgba(201,169,97,0.18)') + ';border-radius:12px;padding:14px 18px;background:' + (lt ? 'rgba(168,140,86,0.04)' : 'rgba(201,169,97,0.04)') + ';">' +
            '<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:' + nodeColor + ';font-weight:500;margin-bottom:6px;">' + (it.mode === 'life' ? 'Life' : 'Brand') + ' · ' + _esc(_fmtDate(it.ts)) + '</div>' +
            '<div style="font-family:Georgia,serif;font-size:16px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';margin-bottom:8px;">' + _esc(it.title || 'Conversation') + '</div>' +
            (preview && preview !== it.title ? '<div style="font-size:13px;color:' + (lt ? 'rgba(0,0,0,0.6)' : 'rgba(245,236,217,0.6)') + ';line-height:1.55;margin-bottom:12px;max-height:84px;overflow:hidden;">' + _esc(preview.slice(0, 240)) + (preview.length > 240 ? '…' : '') + '</div>' : '') +
            '<button data-tresume-id="' + _esc(it.id) + '" style="padding:8px 18px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;font-family:inherit;">Resume</button>' +
          '</div>';
      }
    }

    var spinePath = '<line x1="' + spineX + '" y1="14" x2="' + spineX + '" y2="' + (height - 14) + '" stroke="' + laneStroke + '" stroke-width="2"/>';

    host.innerHTML = head +
      '<div style="position:relative;width:100%;overflow-x:auto;">' +
        '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;min-height:' + Math.min(height, 480) + 'px;max-height:' + height + 'px;">' +
          spinePath + nodesSvg +
        '</svg>' +
      '</div>' +
      (rowsHtml ? '<div style="display:flex;flex-direction:column;gap:10px;">' + rowsHtml + '</div>' : '');

    // Wire interactions
    var nodes = host.querySelectorAll('[data-tnode-id]');
    for (var n = 0; n < nodes.length; n++) {
      (function(el){
        el.addEventListener('click', function(){
          var id = el.getAttribute('data-tnode-id');
          // Coerce numeric ids
          if (/^\d+$/.test(id)) id = parseInt(id, 10);
          _toggleExpand(id);
        });
      })(nodes[n]);
    }
    var resumes = host.querySelectorAll('[data-tresume-id]');
    for (var r = 0; r < resumes.length; r++) {
      (function(el){
        el.addEventListener('click', function(){
          var id = el.getAttribute('data-tresume-id');
          if (/^\d+$/.test(id)) id = parseInt(id, 10);
          for (var i = 0; i < _items.length; i++) {
            if (_items[i].id === id) { _onResume(_items[i]); return; }
          }
        });
      })(resumes[r]);
    }
  }

  function _filterPill(kind, label, lt) {
    var active = _filter === kind;
    var bg = active ? (lt ? 'rgba(168,140,86,0.12)' : 'rgba(201,169,97,0.18)') : 'transparent';
    var color = active ? (lt ? '#7a6741' : '#c9a961') : (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)');
    var border = active ? (lt ? 'rgba(168,140,86,0.40)' : 'rgba(201,169,97,0.40)') : (lt ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)');
    return '<button type="button" data-timeline-filter="' + kind + '" style="padding:6px 12px;border-radius:99px;background:' + bg + ';border:1px solid ' + border + ';color:' + color + ';font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;font-family:inherit;">' + label + '</button>';
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Delegate filter pill clicks
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest && ev.target.closest('[data-timeline-filter]');
    if (!t) return;
    if (!document.getElementById('timeRibbon') || !document.getElementById('timeRibbon').contains(t)) return;
    _setFilter(t.getAttribute('data-timeline-filter'));
  });

  window.BrillianceTimeline = { render: render, setFilter: _setFilter };

  // v34.70: Override the legacy TimeRibbon.render so existing call sites
  // (showView('tuning'), filterHistoryByMode, etc.) draw the new tree without
  // any caller changes.
  if (typeof window.TimeRibbon === 'undefined') window.TimeRibbon = {};
  window.TimeRibbon.render = render;
  window.TimeRibbon.summarizeRange = function(){ /* no-op in tree mode */ };
})();
