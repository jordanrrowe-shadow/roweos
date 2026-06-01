// 50-lifeai-features.js — v34.72
// Three Life-mode features that close the BrandAI parity gaps from v34.71's
// audit:
//   #6  renderLifePeopleView()       — People-in-My-Life pipeline (life mode
//                                       branch from renderClientsView).
//   #9  openCreateLifeOpModal()      — Custom Life Op generation, parity with
//                                       brand aiGeneratedOps. Writes to
//                                       roweos_generated_life_ops.
//   #10 renderLifeAnalyticsDashboard() — Wellness aggregate (pulse streaks,
//                                       habit completions, journal counts,
//                                       library counts). Parity with brand
//                                       commerce dashboard.
//
// Storage:
//   roweos_life_people           — array of { id, name, stage, role, notes,
//                                  birthday, lastSeen, _modifiedAt, ... }
//   roweos_generated_life_ops    — array of life-op definitions
//   (analytics reads existing keys; no new storage)

(function(){

  // ─────────────────────────────────────────────────────────────────────
  //  #6 — People in My Life
  // ─────────────────────────────────────────────────────────────────────

  var LIFE_PEOPLE_STAGES = [
    { id: 'family',       label: 'Family',       color: '#c9a961', desc: 'Parents, partner, children, siblings' },
    { id: 'close',        label: 'Close',        color: '#7aa3c9', desc: 'Inner circle, daily orbit' },
    { id: 'friend',       label: 'Friends',      color: '#9ec79f', desc: 'Active friends and confidants' },
    { id: 'acquaintance', label: 'Acquaintance', color: '#a89878', desc: 'People you know, occasional contact' },
    { id: 'mentor',       label: 'Mentors',      color: '#b287d4', desc: 'People who guide your growth' }
  ];

  function _readLifePeople() {
    try {
      var raw = JSON.parse(localStorage.getItem('roweos_life_people') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch(e) { return []; }
  }

  function _writeLifePeople(arr) {
    try {
      localStorage.setItem('roweos_life_people', JSON.stringify(arr));
      if (typeof writeDB === 'function') writeDB('lifeAI/people', { data: arr });
    } catch(e){}
  }

  function renderLifePeopleView() {
    var container = document.getElementById('clientsCardsContainer');
    var detailPanel = document.getElementById('clientDetailPanel');
    if (!container) return;
    if (detailPanel) detailPanel.style.display = 'none';
    container.style.display = '';

    // Hide brand-only chrome (filter dropdowns, "Show all brands", category filter)
    var elsToHide = ['clientsShowAllBrandsLabel','clientsCategoryFilter'];
    for (var i = 0; i < elsToHide.length; i++) {
      var el = document.getElementById(elsToHide[i]);
      if (el) el.style.display = 'none';
    }

    var people = _readLifePeople();

    // Update header subtitle if present
    var subtitle = document.getElementById('clientsSubtitle');
    if (subtitle) {
      subtitle.textContent = people.length === 0
        ? 'Add the people who matter most.'
        : people.length + ' ' + (people.length === 1 ? 'person' : 'people') + ' across ' + LIFE_PEOPLE_STAGES.length + ' circles';
    }

    var lt = false;
    try { lt = document.documentElement.classList.contains('light-mode'); } catch(e){}

    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">';
    html += '  <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c9a961;font-weight:500;">People in my life</div>';
    html += '  <button onclick="window.openAddLifePersonModal()" style="padding:8px 18px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;font-family:inherit;">+ Add person</button>';
    html += '</div>';

    if (people.length === 0) {
      html += '<div style="padding:40px 24px;border:1px dashed ' + (lt ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.10)') + ';border-radius:12px;text-align:center;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.5)') + ';font-size:13px;">No one yet. Click <strong>+ Add person</strong> to start mapping the people who shape your life.</div>';
      container.innerHTML = html;
      return;
    }

    // Group by stage
    var byStage = {};
    for (var p = 0; p < people.length; p++) {
      var stg = people[p].stage || 'acquaintance';
      if (!byStage[stg]) byStage[stg] = [];
      byStage[stg].push(people[p]);
    }

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;">';
    for (var s = 0; s < LIFE_PEOPLE_STAGES.length; s++) {
      var stage = LIFE_PEOPLE_STAGES[s];
      var members = byStage[stage.id] || [];
      html += '<div style="border:1px solid ' + (lt ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)') + ';border-radius:12px;background:' + (lt ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)') + ';padding:14px;">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
      html += '    <div>';
      html += '      <div style="font-size:13px;font-weight:600;color:' + stage.color + ';">' + stage.label + '</div>';
      html += '      <div style="font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.5)' : 'rgba(245,236,217,0.45)') + ';">' + stage.desc + '</div>';
      html += '    </div>';
      html += '    <div style="font-size:18px;font-weight:600;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-family:Georgia,serif;">' + members.length + '</div>';
      html += '  </div>';
      if (members.length > 0) {
        html += '  <div style="display:flex;flex-direction:column;gap:6px;">';
        for (var m = 0; m < members.length; m++) {
          var per = members[m];
          html += '    <div onclick="window.editLifePerson(\'' + _esc(per.id) + '\')" style="cursor:pointer;padding:8px 10px;background:' + (lt ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)') + ';border:1px solid ' + (lt ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)') + ';border-radius:8px;">';
          html += '      <div style="font-size:13px;font-weight:500;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';">' + _esc(per.name || 'Unnamed') + '</div>';
          if (per.role) html += '      <div style="font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.5)' : 'rgba(245,236,217,0.45)') + ';margin-top:1px;">' + _esc(per.role) + '</div>';
          html += '    </div>';
        }
        html += '  </div>';
      }
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;
  }

  function _personOverlay(prefill) {
    var existing = document.getElementById('lifePersonOverlay');
    if (existing) existing.parentNode.removeChild(existing);
    var lt = false; try { lt = document.documentElement.classList.contains('light-mode'); } catch(e){}
    var p = prefill || {};
    var overlay = document.createElement('div');
    overlay.id = 'lifePersonOverlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label', p.id ? 'Edit person' : 'Add person');
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;opacity:0;transition:opacity 0.3s;';
    overlay.onclick = function(e){ if (e.target === overlay) _close(); };
    var modal = document.createElement('div');
    modal.style.cssText = 'max-width:480px;width:92%;background:' + (lt ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:24px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (lt ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';
    var stageOpts = '';
    for (var s = 0; s < LIFE_PEOPLE_STAGES.length; s++) {
      var st = LIFE_PEOPLE_STAGES[s];
      stageOpts += '<option value="' + st.id + '"' + (p.stage === st.id ? ' selected' : '') + '>' + st.label + '</option>';
    }
    modal.innerHTML =
      '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c9a961;font-weight:500;margin-bottom:6px;">' + (p.id ? 'Edit person' : 'Add person') + '</div>' +
      '<div style="font-family:Georgia,serif;font-size:22px;margin-bottom:18px;">Who is this?</div>' +
      '<label style="display:block;font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';letter-spacing:0.06em;margin-bottom:4px;">Name</label>' +
      '<input id="lpInputName" type="text" value="' + _esc(p.name || '') + '" placeholder="First and last (or what you call them)" style="width:100%;padding:10px 12px;background:' + (lt ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:12px;" />' +
      '<label style="display:block;font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';letter-spacing:0.06em;margin-bottom:4px;">Circle</label>' +
      '<select id="lpInputStage" style="width:100%;padding:10px 12px;background:' + (lt ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-size:14px;font-family:inherit;margin-bottom:12px;">' + stageOpts + '</select>' +
      '<label style="display:block;font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';letter-spacing:0.06em;margin-bottom:4px;">Role / Relationship</label>' +
      '<input id="lpInputRole" type="text" value="' + _esc(p.role || '') + '" placeholder="Mom, business partner, oldest friend, etc." style="width:100%;padding:10px 12px;background:' + (lt ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:12px;" />' +
      '<label style="display:block;font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';letter-spacing:0.06em;margin-bottom:4px;">Notes</label>' +
      '<textarea id="lpInputNotes" placeholder="Anything LifeAI should remember about them." style="width:100%;padding:10px 12px;background:' + (lt ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;resize:vertical;min-height:72px;">' + _esc(p.notes || '') + '</textarea>' +
      '<div style="margin-top:18px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
        (p.id ? '<button id="lpDelete" style="padding:8px 14px;background:transparent;color:#dc2626;border:1px solid rgba(220,38,38,0.32);border-radius:99px;font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;font-family:inherit;">Delete</button>' : '<span></span>') +
        '<div style="display:flex;gap:8px;">' +
          '<button id="lpCancel" style="padding:9px 16px;background:transparent;color:#c9a961;border:1px solid rgba(201,169,97,0.32);border-radius:99px;font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;font-family:inherit;">Cancel</button>' +
          '<button id="lpSave" style="padding:9px 20px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;font-family:inherit;">Save</button>' +
        '</div>' +
      '</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function(){ overlay.style.opacity = '1'; }, 16);
    function _close() {
      overlay.style.opacity = '0';
      setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
      document.removeEventListener('keydown', escFn);
    }
    function escFn(e){ if (e.key === 'Escape') _close(); }
    document.addEventListener('keydown', escFn);
    document.getElementById('lpCancel').onclick = _close;
    var delBtn = document.getElementById('lpDelete');
    if (delBtn) delBtn.onclick = function() {
      if (!confirm('Remove ' + (p.name || 'this person') + ' from your people?')) return;
      var arr = _readLifePeople().filter(function(x){ return x.id !== p.id; });
      _writeLifePeople(arr);
      _close();
      renderLifePeopleView();
    };
    document.getElementById('lpSave').onclick = function() {
      var name = (document.getElementById('lpInputName').value || '').trim();
      if (!name) { document.getElementById('lpInputName').focus(); return; }
      var arr = _readLifePeople();
      var person = {
        id: p.id || ('per_' + Date.now() + '_' + Math.random().toString(36).slice(2,7)),
        name: name,
        stage: document.getElementById('lpInputStage').value || 'acquaintance',
        role: (document.getElementById('lpInputRole').value || '').trim(),
        notes: (document.getElementById('lpInputNotes').value || '').trim(),
        _modifiedAt: Date.now(),
        createdAt: p.createdAt || Date.now()
      };
      var idx = -1;
      for (var i = 0; i < arr.length; i++) { if (arr[i].id === person.id) { idx = i; break; } }
      if (idx >= 0) arr[idx] = person; else arr.unshift(person);
      _writeLifePeople(arr);
      _close();
      renderLifePeopleView();
    };
    setTimeout(function(){ document.getElementById('lpInputName').focus(); }, 50);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  #9 — Custom Life Op generation
  // ─────────────────────────────────────────────────────────────────────

  function _readGeneratedLifeOps() {
    try { var raw = JSON.parse(localStorage.getItem('roweos_generated_life_ops') || '[]'); return Array.isArray(raw) ? raw : []; }
    catch(e) { return []; }
  }
  function _writeGeneratedLifeOps(arr) {
    try {
      localStorage.setItem('roweos_generated_life_ops', JSON.stringify(arr));
      if (typeof writeDB === 'function') writeDB('lifeAI/generatedOps', { data: arr });
    } catch(e){}
  }

  function openCreateLifeOpModal() {
    var existing = document.getElementById('lifeOpOverlay');
    if (existing) existing.parentNode.removeChild(existing);
    var lt = false; try { lt = document.documentElement.classList.contains('light-mode'); } catch(e){}

    var overlay = document.createElement('div');
    overlay.id = 'lifeOpOverlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Create Life Op');
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding-top:14vh;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;opacity:0;transition:opacity 0.3s;';
    overlay.onclick = function(e){ if (e.target === overlay) _close(); };
    var modal = document.createElement('div');
    modal.style.cssText = 'max-width:560px;width:92%;background:' + (lt ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:24px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (lt ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';
    modal.innerHTML =
      '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c9a961;font-weight:500;margin-bottom:6px;">Studio · Custom life op</div>' +
      '<div style="font-family:Georgia,serif;font-size:22px;margin-bottom:6px;">Create a Life Op</div>' +
      '<div style="font-size:13px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';line-height:1.5;margin-bottom:16px;">Describe what the op should do. LifeAI will design the operation and add it to your library so you can run it from Studio anytime.</div>' +
      '<label style="display:block;font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';letter-spacing:0.06em;margin-bottom:4px;">Op title</label>' +
      '<input id="loInputName" type="text" placeholder="e.g. Weekly review prompt" style="width:100%;padding:10px 12px;background:' + (lt ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:12px;" />' +
      '<label style="display:block;font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';letter-spacing:0.06em;margin-bottom:4px;">What should it do?</label>' +
      '<textarea id="loInputBrief" placeholder="One-paragraph brief: input, transformation, output." style="width:100%;padding:10px 12px;background:' + (lt ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;resize:vertical;min-height:96px;margin-bottom:12px;"></textarea>' +
      '<label style="display:block;font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';letter-spacing:0.06em;margin-bottom:4px;">Category</label>' +
      '<select id="loInputCategory" style="width:100%;padding:10px 12px;background:' + (lt ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-size:14px;font-family:inherit;">' +
        '<option value="reflection">Reflection</option>' +
        '<option value="planning">Planning</option>' +
        '<option value="health">Health &amp; Wellness</option>' +
        '<option value="finance">Finance</option>' +
        '<option value="learning">Learning</option>' +
        '<option value="relationships">Relationships</option>' +
        '<option value="custom">Custom</option>' +
      '</select>' +
      '<div style="margin-top:18px;display:flex;justify-content:flex-end;gap:8px;">' +
        '<button id="loCancel" style="padding:9px 16px;background:transparent;color:#c9a961;border:1px solid rgba(201,169,97,0.32);border-radius:99px;font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;font-family:inherit;">Cancel</button>' +
        '<button id="loSave" style="padding:9px 20px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;font-family:inherit;">Save op</button>' +
      '</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function(){ overlay.style.opacity = '1'; }, 16);
    function _close() {
      overlay.style.opacity = '0';
      setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
      document.removeEventListener('keydown', escFn);
    }
    function escFn(e){ if (e.key === 'Escape') _close(); }
    document.addEventListener('keydown', escFn);
    document.getElementById('loCancel').onclick = _close;
    document.getElementById('loSave').onclick = function() {
      var name = (document.getElementById('loInputName').value || '').trim();
      var brief = (document.getElementById('loInputBrief').value || '').trim();
      var category = document.getElementById('loInputCategory').value || 'custom';
      if (!name || !brief) { (name ? document.getElementById('loInputBrief') : document.getElementById('loInputName')).focus(); return; }
      var arr = _readGeneratedLifeOps();
      arr.unshift({
        id: 'lifeop_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
        name: name,
        prompt: brief,
        category: category,
        source: 'lifeai',
        custom: true,
        createdAt: Date.now(),
        _modifiedAt: Date.now()
      });
      _writeGeneratedLifeOps(arr);
      _close();
      try { if (typeof showToast === 'function') showToast('Life op saved. Open Studio to run it.', 'success'); } catch(e){}
    };
    setTimeout(function(){ document.getElementById('loInputName').focus(); }, 50);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  #10 — Life Analytics dashboard (Wellness aggregate)
  // ─────────────────────────────────────────────────────────────────────

  function renderLifeAnalyticsDashboard(host) {
    if (!host) host = document.getElementById('commerceContent') || document.getElementById('analyticsContent');
    if (!host) return;
    var lt = false; try { lt = document.documentElement.classList.contains('light-mode'); } catch(e){}

    // Read sources
    var pulseGoalsArr = [];
    try { var pg = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]'); pulseGoalsArr = Array.isArray(pg) ? pg : []; } catch(e){}
    var journalArr = [];
    try { var jr = JSON.parse(localStorage.getItem('roweos_journal') || '[]'); journalArr = Array.isArray(jr) ? jr : []; } catch(e){}
    var libraryRaw = '{}';
    try { libraryRaw = localStorage.getItem('roweos_life_library') || '{}'; } catch(e){}
    var libraryFiles = 0;
    try {
      var libObj = JSON.parse(libraryRaw);
      if (libObj && typeof libObj === 'object') {
        Object.keys(libObj).forEach(function(k) {
          var f = libObj[k];
          if (f && Array.isArray(f.files)) libraryFiles += f.files.length;
        });
      }
    } catch(e){}
    var people = _readLifePeople();
    var lifeOps = _readGeneratedLifeOps();
    var reminders = [];
    try { var rs = JSON.parse(localStorage.getItem('roweos_reminders') || '[]'); reminders = Array.isArray(rs) ? rs : []; } catch(e){}

    // Compute metrics
    var lifeGoals = pulseGoalsArr.filter(function(g) { return g.source === 'lifeai' || !g.source; });
    var openGoals = lifeGoals.filter(function(g) { return !g.archived && !g.completed; }).length;
    var completedGoals = lifeGoals.filter(function(g) { return g.completed; }).length;
    var todayKey = (function(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
    var completedToday = 0;
    for (var i = 0; i < lifeGoals.length; i++) {
      var g = lifeGoals[i];
      if (g.items && Array.isArray(g.items)) {
        for (var j = 0; j < g.items.length; j++) {
          var it = g.items[j];
          if (it && it.completed && it.completedAt && String(it.completedAt).indexOf(todayKey) === 0) completedToday++;
        }
      }
    }
    var streak = 0;
    try {
      var doneDay = {};
      for (var k = 0; k < lifeGoals.length; k++) {
        var gg = lifeGoals[k];
        if (!gg.items) continue;
        for (var m = 0; m < gg.items.length; m++) {
          var ii = gg.items[m];
          if (ii && ii.completedAt) {
            var dk = String(ii.completedAt).slice(0, 10);
            doneDay[dk] = true;
          }
        }
      }
      var cursor = new Date();
      cursor.setHours(0,0,0,0);
      for (var step = 0; step < 365; step++) {
        var ck = cursor.getFullYear() + '-' + String(cursor.getMonth()+1).padStart(2,'0') + '-' + String(cursor.getDate()).padStart(2,'0');
        if (doneDay[ck]) { streak++; cursor.setDate(cursor.getDate() - 1); }
        else { if (step === 0) { cursor.setDate(cursor.getDate() - 1); continue; } break; }
      }
    } catch(e){}

    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px;">';
    html += '  <div><div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c9a961;font-weight:500;">Wellness dashboard</div>';
    html += '       <div style="font-family:Georgia,serif;font-size:22px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';">How life is going</div></div>';
    html += '  <button onclick="window.openCreateLifeOpModal&&window.openCreateLifeOpModal()" style="padding:8px 18px;background:transparent;color:#c9a961;border:1px solid rgba(201,169,97,0.32);border-radius:99px;font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;font-family:inherit;">+ Custom life op</button>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">';
    html += _statTile('Streak', streak + ' day' + (streak === 1 ? '' : 's'), 'Daily completion run', '#9ec79f');
    html += _statTile('Today', completedToday, 'Items finished today', '#c9a961');
    html += _statTile('Open goals', openGoals, 'Active in your Pulse', '#7aa3c9');
    html += _statTile('Completed', completedGoals, 'Goals you finished', '#b287d4');
    html += _statTile('People', people.length, 'In your circle', '#a89878');
    html += _statTile('Custom ops', lifeOps.length, 'Life ops in Studio', '#e2c79b');
    html += _statTile('Library', libraryFiles, 'Personal documents', '#ddc090');
    html += _statTile('Journal', journalArr.length, 'Entries saved', '#7a6a52');
    html += '</div>';

    // Reminders preview
    var dueReminders = reminders.filter(function(r) {
      if (r.status === 'completed' || r.status === 'dismissed') return false;
      var t = r.scheduledAt ? (typeof r.scheduledAt === 'number' ? r.scheduledAt : Date.parse(r.scheduledAt)) : 0;
      return t && t <= Date.now() + 24 * 3600 * 1000;
    });
    if (dueReminders.length > 0) {
      html += '<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';margin-bottom:8px;">Coming up</div>';
      html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:24px;">';
      for (var d = 0; d < Math.min(5, dueReminders.length); d++) {
        var r = dueReminders[d];
        html += '<div style="padding:10px 14px;border:1px solid ' + (lt ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)') + ';border-radius:8px;display:flex;justify-content:space-between;gap:10px;">';
        html += '  <div style="font-size:13px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';">' + _esc(r.title || 'Reminder') + '</div>';
        html += '  <div style="font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.5)' : 'rgba(245,236,217,0.45)') + ';">' + (r.scheduledAt ? new Date(r.scheduledAt).toLocaleString() : '') + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    host.innerHTML = html;
  }

  function _statTile(label, value, sub, color) {
    return '<div style="border:1px solid rgba(201,169,97,0.18);border-radius:10px;padding:14px 16px;background:rgba(201,169,97,0.04);">' +
      '<div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,169,97,0.85);margin-bottom:6px;">' + _esc(label) + '</div>' +
      '<div style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:' + (color || '#c9a961') + ';">' + _esc(String(value)) + '</div>' +
      '<div style="font-size:11px;color:rgba(245,236,217,0.5);margin-top:2px;">' + _esc(sub) + '</div>' +
    '</div>';
  }

  // Hook into the brand commerce/analytics view: when in life mode, replace
  // the brand commerce dashboard with the wellness dashboard.
  function _maybeRouteAnalytics() {
    try {
      if (localStorage.getItem('roweos_app_mode') !== 'life') return false;
      var host = document.getElementById('commerceContent') || document.getElementById('analyticsContent');
      if (!host) return false;
      renderLifeAnalyticsDashboard(host);
      return true;
    } catch(e) { return false; }
  }

  // Wrap the existing renderCommerceView if it exists.
  if (typeof window !== 'undefined' && typeof window.renderCommerceView === 'function') {
    var _origCommerce = window.renderCommerceView;
    window.renderCommerceView = function() {
      if (_maybeRouteAnalytics()) return;
      return _origCommerce.apply(this, arguments);
    };
  } else {
    // If brand commerce loads later, watch for it.
    var iv = setInterval(function() {
      if (typeof window.renderCommerceView === 'function') {
        clearInterval(iv);
        var _orig = window.renderCommerceView;
        window.renderCommerceView = function() {
          if (_maybeRouteAnalytics()) return;
          return _orig.apply(this, arguments);
        };
      }
    }, 1500);
    setTimeout(function(){ clearInterval(iv); }, 30000);
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Util
  // ─────────────────────────────────────────────────────────────────────

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Public API
  window.renderLifePeopleView    = renderLifePeopleView;
  window.openAddLifePersonModal  = function() { _personOverlay(null); };
  window.editLifePerson          = function(id) {
    var arr = _readLifePeople();
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return _personOverlay(arr[i]);
  };
  window.openCreateLifeOpModal      = openCreateLifeOpModal;
  window.renderLifeAnalyticsDashboard = renderLifeAnalyticsDashboard;
  window.LIFE_PEOPLE_STAGES         = LIFE_PEOPLE_STAGES;
})();
