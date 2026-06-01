// 41-time-ribbon.js
// History → Time Ribbon — Tier 1 surface modifier per
// docs/brilliance/12-surface-system.md "History → Time Ribbon" section.
//
// Replaces nothing — augments. Renders a horizontal scrubbing timeline at the
// top of the History view. Each marker is a conversation moment. Hover/tap
// shows summary; click resumes that conversation. The existing list view
// below stays intact (data-view="tuning" — internal id unchanged).
//
// Public API (window.TimeRibbon):
//   render()              — populates #timeRibbon from agentCommands
//   summarizeRange()      — placeholder for AI-driven period summary (v34)
//   _selectMarker(id)     — internal click handler

(function(){
  var _markers = [];
  var _selected = null;

  function _isLight() {
    try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; }
  }

  function _safeAgentCommands() {
    try { return Array.isArray(window.agentCommands) ? window.agentCommands : []; } catch(e){ return []; }
  }

  // v34: Read tombstone sets so the ribbon respects deletes the conversation
  // list already hides. Without this, iOS PWAs showed 5 ribbon markers while
  // the list section underneath correctly read 0 (because the chats were
  // tombstoned locally).
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
  function _isTombstoned(c, brandSet, lifeSet) {
    if (!c || c.id == null) return false;
    var key = String(c.id);
    if (c.mode === 'life') return !!lifeSet[key];
    return !!brandSet[key];
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

  function _ts(c) {
    if (!c) return 0;
    if (typeof c._modifiedAt === 'number') return c._modifiedAt;
    if (typeof c.timestamp === 'number') return c.timestamp;
    if (typeof c.timestamp === 'string') { var t = Date.parse(c.timestamp); if (!isNaN(t)) return t; }
    if (typeof c.id === 'number') return c.id;
    if (typeof c.id === 'string' && /^\d+$/.test(c.id)) return parseInt(c.id, 10);
    return 0;
  }

  function _formatDayLabel(ms) {
    try {
      var d = new Date(ms);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch(e){ return ''; }
  }

  function _formatRelative(ms) {
    var now = Date.now();
    var diff = now - ms;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    try {
      return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch(e){ return ''; }
  }

  function render() {
    var ribbon = document.getElementById('timeRibbon');
    if (!ribbon) return;

    // v34: Filter against the same tombstone sets renderTuningConversations uses.
    var brandTomb = _readTombstoneSet('roweos_deleted_chat_ids');
    var lifeTomb  = _readTombstoneSet('roweos_deleted_life_chat_ids');
    var convos = _safeAgentCommands().filter(function(c){
      return c && !c.preliminary && _ts(c) > 0 && !_isTombstoned(c, brandTomb, lifeTomb);
    });
    convos.sort(function(a, b){ return _ts(a) - _ts(b); });

    var summary = document.getElementById('timeRibbonSummary');
    var markersEl = document.getElementById('timeRibbonMarkers');
    var labelsEl = document.getElementById('timeRibbonAxisLabels');
    var detailEl = document.getElementById('timeRibbonDetail');
    var summarizeBtn = document.getElementById('timeRibbonSummarize');

    if (convos.length === 0) {
      ribbon.setAttribute('data-state', 'empty');
      if (summary) summary.textContent = 'No conversations yet. Start one to populate the ribbon.';
      if (markersEl) markersEl.innerHTML = '';
      if (labelsEl) labelsEl.innerHTML = '';
      if (detailEl) { detailEl.hidden = true; detailEl.innerHTML = ''; }
      if (summarizeBtn) summarizeBtn.disabled = true;
      _markers = [];
      return;
    }

    var minT = _ts(convos[0]);
    var maxT = _ts(convos[convos.length - 1]);
    if (maxT === minT) maxT = minT + 1;
    var span = maxT - minT;

    _markers = convos.map(function(c){
      var t = _ts(c);
      return {
        id: c.id,
        t: t,
        pct: ((t - minT) / span) * 100,
        title: _firstUserText(c).slice(0, 80),
        mode: c.mode || 'brand',
        agent: c.agent || c.agentId || '',
        msgs: Array.isArray(c.messages) ? c.messages.length : 0
      };
    });

    if (markersEl) {
      var lightMode = _isLight();
      var html = '';
      for (var i = 0; i < _markers.length; i++) {
        var m = _markers[i];
        var col = m.mode === 'life' ? (lightMode ? '#5a7a9a' : '#5a7a9a') : (lightMode ? '#7a6741' : '#c9a961');
        html += '<button type="button" class="time-ribbon-marker" data-marker-id="' + (m.id != null ? String(m.id) : String(i)) + '" data-marker-idx="' + i + '" style="left:' + m.pct.toFixed(2) + '%;--marker-color:' + col + ';" title="' + _escapeAttr(m.title) + ' · ' + _formatRelative(m.t) + '"><span class="dot"></span></button>';
      }
      markersEl.innerHTML = html;
      var btns = markersEl.querySelectorAll('.time-ribbon-marker');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', function(ev){
          var idx = parseInt(this.getAttribute('data-marker-idx'), 10);
          if (!isNaN(idx)) _selectMarker(idx);
        });
      }
    }

    if (labelsEl) {
      // Show 4 evenly spaced labels: start, ~33%, ~66%, end.
      var stops = [0, 0.33, 0.66, 1];
      var lhtml = '';
      for (var s = 0; s < stops.length; s++) {
        var t = minT + span * stops[s];
        lhtml += '<span class="time-ribbon-axis-label" style="left:' + (stops[s] * 100).toFixed(2) + '%;">' + _escapeHtml(_formatDayLabel(t)) + '</span>';
      }
      labelsEl.innerHTML = lhtml;
    }

    if (summary) {
      summary.textContent = _markers.length + ' conversation' + (_markers.length === 1 ? '' : 's') + ' · ' +
        _formatDayLabel(minT) + ' → ' + _formatDayLabel(maxT);
    }
    if (summarizeBtn) summarizeBtn.disabled = false;
    ribbon.setAttribute('data-state', 'ready');
  }

  function _selectMarker(idx) {
    var m = _markers[idx];
    if (!m) return;
    _selected = m;

    var detailEl = document.getElementById('timeRibbonDetail');
    var cursor = document.getElementById('timeRibbonCursor');

    if (cursor) {
      cursor.hidden = false;
      cursor.style.left = m.pct.toFixed(2) + '%';
    }

    if (detailEl) {
      detailEl.hidden = false;
      detailEl.innerHTML =
        '<div class="time-ribbon-detail-title">' + _escapeHtml(m.title || 'Conversation') + '</div>' +
        '<div class="time-ribbon-detail-meta">' +
          _escapeHtml(m.mode === 'life' ? 'LifeAI' : 'BrandAI') +
          (m.agent ? ' · ' + _escapeHtml(m.agent) : '') +
          ' · ' + m.msgs + ' messages · ' + _escapeHtml(_formatRelative(m.t)) +
        '</div>' +
        '<div class="time-ribbon-detail-actions">' +
          '<button type="button" class="time-ribbon-action" onclick="window.TimeRibbon._resumeMarker(\'' + _escapeAttr(String(m.id)) + '\')">Resume</button>' +
          '<button type="button" class="time-ribbon-action" onclick="window.TimeRibbon._branchMarker(\'' + _escapeAttr(String(m.id)) + '\')">Branch from here</button>' +
        '</div>';
    }
  }

  function _resumeMarker(id) {
    try {
      if (typeof window.resumeConversation === 'function') {
        window.resumeConversation(id);
      } else if (typeof window.openConversation === 'function') {
        window.openConversation(id);
      } else if (typeof window.showView === 'function') {
        window.showView('agent');
      }
    } catch(e){
      try { if (typeof showToast === 'function') showToast('Could not resume. Open History list below', 'error'); } catch(_){}
    }
  }

  function _branchMarker(id) {
    try {
      if (typeof showToast === 'function') {
        showToast('Branching ships in v34. For now, Resume keeps the same conversation.', 'info');
      }
    } catch(e){}
  }

  function summarizeRange() {
    if (!_markers.length) return;
    try {
      if (typeof showToast === 'function') {
        showToast('Range summary lands in v34 (Sprint 4 of Time Ribbon).', 'info');
      }
    } catch(e){}
  }

  function _escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _escapeAttr(s) { return _escapeHtml(s); }

  window.TimeRibbon = {
    render: render,
    summarizeRange: summarizeRange,
    _selectMarker: _selectMarker,
    _resumeMarker: _resumeMarker,
    _branchMarker: _branchMarker
  };
})();
