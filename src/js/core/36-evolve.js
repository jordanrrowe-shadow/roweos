// 36-evolve.js
// Evolve — Educational Intelligence Module — scaffold (NOT YET ACTIVATED)
// v33.1 — first scaffold per docs/brilliance/14-evolve.md
//
// Activation gate:
//   localStorage.roweos_evolve_enabled === 'true'
//
// What this scaffold provides:
//   - EvolveProfile state shape (Pillar 0 — Memory as Learner Identity)
//   - generateEvolveSystemPrompt(profile) — the Translator pattern stub
//   - showEvolveView() — Pulse Dashboard (Pillar 1) placeholder
//   - Feature-flag-gated entry point so v33.5 Sprint 4 can take over
//
// What this scaffold does NOT do (deferred to v33.5+):
//   - Liquid Rhythm Planner (Pillar 2)
//   - Infinite Assessment Engine (Pillar 3 — multi-model quiz)
//   - Context Translator full pipeline (Pillar 4)
//   - Deep Verification Studio (Pillar 5)
//   - Veo 3.1 spatial-concept video bonus
//   - sync-v5 collections for Skills/Sources/Reflections/SOPs
//
// Consumers should check Evolve.isEnabled() before importing data; otherwise stay invisible.

var Evolve = (function(){
  var FLAG_KEY = 'roweos_evolve_enabled';
  var PROFILE_KEY = 'roweos_evolve_profile';

  function isEnabled() {
    try { return localStorage.getItem(FLAG_KEY) === 'true'; } catch(e){ return false; }
  }

  // v33.68: light-mode-aware color picker. Many Today-pane elements use inline
  // styles which can't be overridden by CSS — pick contrast-correct colors at
  // render time instead. d = dark-mode color, l = light-mode color.
  function _isLight() {
    try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; }
  }
  function _c(d, l) { return _isLight() ? l : d; }

  function getProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return defaultProfile();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultProfile();
      return mergeProfile(defaultProfile(), parsed);
    } catch(e){ return defaultProfile(); }
  }

  function setProfile(patch) {
    var prev = getProfile();
    var next = mergeProfile(prev, patch || {});
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch(e){}
    // v34.81: Sync profile to cloud so it picks up across devices.
    try {
      if (typeof writeDB === 'function') {
        writeDB('profile/main', { 'evolve.profile': next });
      }
    } catch(e){}
    // v34.81: When the goal or known-context changes, the existing quiz pool
    // is stale (questions were generated for the old goal). Wipe it so the
    // next Practice render triggers a fresh refill against the new context.
    try {
      var goalChanged = prev.targetGoal !== next.targetGoal;
      var ctxChanged = JSON.stringify(prev.knownContext || []) !== JSON.stringify(next.knownContext || []);
      if ((goalChanged || ctxChanged) && typeof QuizEngine !== 'undefined') {
        try { localStorage.removeItem('roweos_evolve_quiz_pool'); } catch(e){}
        try { localStorage.removeItem('roweos_evolve_quiz_completed'); } catch(e){}
        // Kick a fresh refill in the background
        if (QuizEngine.refillPool) QuizEngine.refillPool();
      }
    } catch(e){}
    try {
      if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('evolve:profile-changed', { detail: { profile: next } }));
      }
    } catch(e){}
    return next;
  }

  function defaultProfile() {
    return {
      targetGoal: '',
      deadlineDate: '',
      knownContext: [],
      cognitiveProfile: '',
      brandScope: null,
      currentXP: 0,
      dailyStreak: 0,
      lastSessionAt: 0
    };
  }

  // v33.5: Evolve storage layer per Sprint F. Skills/Sources/Reflections live
  // in SyncV5 collections directly (new data types — no v4 dual-write concern).
  // Cloud writes activate when SyncV5.isEnabled() is true.
  function _getCollection(name) {
    if (typeof SyncV5 === 'undefined') return null;
    return SyncV5.collection('evolve_' + name, {
      firestorePath: function(uid) { return 'users/' + uid + '/evolve_' + name; },
      localStorageKey: 'brilliance_v5_evolve_' + name,
      schemaVersion: 1
    });
  }

  function listSkills()      { var c = _getCollection('skills');      return c ? c.list() : []; }
  function listSources()     { var c = _getCollection('sources');     return c ? c.list() : []; }
  function listReflections() { var c = _getCollection('reflections'); return c ? c.list() : []; }
  function listSops()        { var c = _getCollection('sops');        return c ? c.list() : []; }

  function addSkill(skill) {
    var c = _getCollection('skills');
    if (!c) return null;
    var id = (skill && skill.id) || (typeof SyncV5 !== 'undefined' ? SyncV5._uuid() : ('skill_' + Date.now()));
    return c.write(id, skill || {});
  }
  function addReflection(text, links) {
    var c = _getCollection('reflections');
    if (!c) return null;
    var id = typeof SyncV5 !== 'undefined' ? SyncV5._uuid() : ('refl_' + Date.now());
    return c.write(id, { text: text || '', links: links || [], at: Date.now() });
  }
  function addSource(source) {
    var c = _getCollection('sources');
    if (!c) return null;
    var id = (source && source.id) || (typeof SyncV5 !== 'undefined' ? SyncV5._uuid() : ('src_' + Date.now()));
    return c.write(id, source || {});
  }
  function addSop(sop) {
    var c = _getCollection('sops');
    if (!c) return null;
    var id = (sop && sop.id) || (typeof SyncV5 !== 'undefined' ? SyncV5._uuid() : ('sop_' + Date.now()));
    return c.write(id, sop || {});
  }

  function mergeProfile(base, patch) {
    var out = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (var k2 in patch) if (Object.prototype.hasOwnProperty.call(patch, k2)) out[k2] = patch[k2];
    return out;
  }

  // Pillar 0 — Translator pattern.
  // Real prompt assembly happens in v33.5 Sprint 4. For now, return a usable stub
  // that matches the structure described in 14-evolve.md §Foundation.
  function generateEvolveSystemPrompt(profile) {
    profile = profile || getProfile();
    var lines = [];
    lines.push('You are tutoring a learner inside Brilliance.');
    if (profile.targetGoal) lines.push('Target goal: ' + profile.targetGoal + (profile.deadlineDate ? ' by ' + profile.deadlineDate : '') + '.');
    if (profile.knownContext && profile.knownContext.length) {
      lines.push('Known context: ' + profile.knownContext.join(', ') + '.');
      lines.push('Translate new concepts using these known frames first; never explain in a vacuum.');
    }
    if (profile.cognitiveProfile) {
      lines.push('Cognitive profile: ' + profile.cognitiveProfile + '.');
      lines.push('Use bolded keywords, short bullet points, zero fluff. Default to micro-task framing.');
    }
    lines.push('Pull from current peer-reviewed sources where freshness matters; cite when used.');
    return lines.join('\n');
  }

  // Days remaining to deadline.
  function daysToDeadline(profile) {
    profile = profile || getProfile();
    if (!profile.deadlineDate) return null;
    var d = new Date(profile.deadlineDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    var now = new Date();
    var diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    return diff;
  }

  // Pillar I — Pulse Dashboard. Renders countdown + profile summary
  // + edit panel + daily load. Liquid Rhythm Planner and Quiz Engine
  // populate the daily blocks live (v34.79).
  function renderPulseDashboard(host) {
    if (!host) return;
    host.innerHTML = '';
    var profile = getProfile();
    var daysLeft = daysToDeadline(profile);
    var hasGoal = !!profile.targetGoal;

    // Hero card: countdown + goal.
    var hero = document.createElement('div');
    hero.style.cssText = 'padding:28px;border:1px solid ' + _c('rgba(201,181,122,0.22)','rgba(168,140,86,0.35)') + ';border-radius:14px;background:linear-gradient(135deg,' + _c('rgba(201,169,97,0.06)','rgba(168,140,86,0.08)') + ',' + _c('rgba(255,255,255,0.02)','rgba(0,0,0,0.02)') + ');margin-bottom:18px;';

    var eyebrow = document.createElement('div');
    eyebrow.style.cssText = 'font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:' + _c('rgba(201,169,97,0.85)','#7a6741') + ';margin-bottom:10px;';
    eyebrow.textContent = 'Evolve · Today';
    hero.appendChild(eyebrow);

    if (hasGoal) {
      var goalRow = document.createElement('div');
      goalRow.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px;';

      var goalText = document.createElement('div');
      goalText.style.cssText = 'font-size:24px;font-weight:600;letter-spacing:-0.01em;flex:1;min-width:240px;color:' + _c('#f5ecd9','#1a1a1a') + ';';
      goalText.textContent = profile.targetGoal;
      goalRow.appendChild(goalText);

      if (daysLeft != null) {
        var count = document.createElement('div');
        var label = (daysLeft >= 0) ? (daysLeft === 0 ? 'today' : (daysLeft + ' days')) : (Math.abs(daysLeft) + ' days past');
        var sub   = (daysLeft >= 0) ? 'remaining' : 'deadline';
        count.style.cssText = 'text-align:right;';
        count.innerHTML = '<div class="brilliance-serif" style="font-size:32px;font-weight:300;color:' + _c('#f5e6c8','#5a4d2e') + ';letter-spacing:-0.02em;">' + escapeHtml(label) + '</div>' +
          '<div style="font-size:11px;color:' + _c('rgba(255,255,255,0.45)','rgba(0,0,0,0.45)') + ';letter-spacing:0.18em;text-transform:uppercase;margin-top:2px;">' + escapeHtml(sub) + '</div>';
        goalRow.appendChild(count);
      }
      hero.appendChild(goalRow);

      var stats = document.createElement('div');
      stats.style.cssText = 'display:flex;gap:24px;font-size:12px;color:' + _c('rgba(255,255,255,0.55)','rgba(0,0,0,0.6)') + ';flex-wrap:wrap;';
      var statGold = _c('#c9b57a','#7a6741');
      stats.innerHTML =
        '<span><strong style="color:' + statGold + ';font-weight:600;">XP</strong> ' + (profile.currentXP || 0) + '</span>' +
        '<span><strong style="color:' + statGold + ';font-weight:600;">Streak</strong> ' + (profile.dailyStreak || 0) + ' days</span>' +
        (profile.cognitiveProfile ? '<span><strong style="color:' + statGold + ';font-weight:600;">Profile</strong> ' + escapeHtml(profile.cognitiveProfile.slice(0, 60)) + '</span>' : '');
      hero.appendChild(stats);
    } else {
      var empty = document.createElement('div');
      empty.style.cssText = 'font-size:18px;font-weight:500;color:' + _c('rgba(255,255,255,0.85)','#1a1a1a') + ';margin-bottom:8px;';
      empty.textContent = 'Set a target goal to begin.';
      hero.appendChild(empty);

      var emptyDesc = document.createElement('div');
      emptyDesc.style.cssText = 'font-size:13px;color:' + _c('rgba(255,255,255,0.45)','rgba(0,0,0,0.6)') + ';line-height:1.6;margin-bottom:14px;';
      emptyDesc.textContent = 'Evolve uses your goal, deadline, and known context to translate every concept into your existing mental models. Tell it what you are building toward.';
      hero.appendChild(emptyDesc);
    }

    var editBtn = document.createElement('button');
    editBtn.style.cssText = 'margin-top:16px;padding:9px 16px;background:transparent;border:1px solid ' + _c('rgba(201,181,122,0.4)','rgba(168,140,86,0.5)') + ';border-radius:8px;color:' + _c('#c9b57a','#7a6741') + ';font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;';
    editBtn.textContent = hasGoal ? 'Edit profile' : 'Set up profile';
    editBtn.onmouseover = function(){ editBtn.style.background = 'rgba(201,181,122,0.08)'; editBtn.style.borderColor = 'rgba(201,181,122,0.6)'; };
    editBtn.onmouseout  = function(){ editBtn.style.background = 'transparent'; editBtn.style.borderColor = 'rgba(201,181,122,0.4)'; };
    editBtn.onclick = function(){ openEvolveProfileEditor(host); };
    hero.appendChild(editBtn);

    host.appendChild(hero);

    // Sprint B: Liquid Rhythm — re-flow load. Banner appears only when recalibrated.
    var rhythm = recalibrateMomentum(profile);
    if (rhythm.recalibrated) {
      var banner = document.createElement('div');
      banner.style.cssText = 'padding:12px 16px;border-left:none;border:1px solid ' + _c('rgba(201,181,122,0.30)','rgba(168,140,86,0.4)') + ';background:' + _c('rgba(201,181,122,0.04)','rgba(168,140,86,0.06)') + ';border-radius:8px;margin-bottom:14px;font-size:12px;color:' + _c('rgba(245,236,217,0.85)','rgba(0,0,0,0.7)') + ';line-height:1.5;';
      banner.innerHTML = '<strong style="color:' + _c('#c9b57a','#7a6741') + ';">Recalibrated.</strong> ' + escapeHtml(rhythm.reason) + ' Today’s target is ' + rhythm.dailyMinutesTarget + ' min across ' + rhythm.tasks.length + ' tasks. No overdue alerts; just keep moving.';
      host.appendChild(banner);
    }

    // Daily load — Sprint B Liquid Rhythm-driven cards.
    var loadGrid = document.createElement('div');
    loadGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:18px;';
    for (var i = 0; i < rhythm.tasks.length; i++) {
      loadGrid.appendChild(renderDailyTaskCard(rhythm.tasks[i]));
    }
    host.appendChild(loadGrid);

    // v34.69: footer note dropped — was leaking internal copy ("Sprints A + B
    // live", "Sprint C", "docs/brilliance/14-evolve.md"). Users don't care
    // about our sprint plan.
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function synthesizeDailyLoad(profile) {
    // Sprint B: Liquid Rhythm Planner — recalibrateMomentum() drives daily load.
    // Anti-ADHD: no red overdue alerts; missed days re-flow into remaining days.
    var rhythm = recalibrateMomentum(profile);
    return rhythm.tasks;
  }

  // Pillar II — Liquid Rhythm Planner.
  // Re-flows total target effort across remaining days so the user is never
  // confronted with a guilt-inducing overdue stack. Returns:
  //   { tasks: [...], dailyMinutesTarget, recalibrated: bool, reason: '' }
  function recalibrateMomentum(profile) {
    profile = profile || getProfile();
    var adhd = (profile.cognitiveProfile || '').toLowerCase().indexOf('adhd') !== -1;
    var visual = (profile.cognitiveProfile || '').toLowerCase().indexOf('visual') !== -1;
    var unit = adhd ? 10 : 25;
    var dailyTargetCount = adhd ? 3 : 4; // micro-tasks for ADHD, slightly more for default
    var dailyMinutesTarget = dailyTargetCount * unit;

    // Re-flow logic: if a deadline exists and the user has missed days, total
    // remaining minutes spread across remaining days raises the daily target.
    var daysLeft = daysToDeadline(profile);
    var recalibrated = false;
    var reason = '';
    var multiplier = 1;
    if (daysLeft != null && daysLeft > 0) {
      var lastDay = profile.lastSessionAt ? new Date(profile.lastSessionAt) : null;
      var today = new Date(); today.setHours(0,0,0,0);
      var daysSinceLastSession = lastDay ? Math.floor((today.getTime() - new Date(lastDay).setHours(0,0,0,0)) / 86400000) : 0;
      if (daysSinceLastSession >= 2) {
        // Spread the missed days' target across remaining days (capped at 1.6x).
        multiplier = Math.min(1.6, 1 + (daysSinceLastSession - 1) * 0.15);
        recalibrated = true;
        reason = 'Re-flowed ' + daysSinceLastSession + ' missed days across the remaining schedule.';
      }
    }
    var todayMinutes = Math.round(dailyMinutesTarget * multiplier);
    // Re-derive task count and minutes-per-task from the recalibrated daily total.
    var taskCount = Math.max(2, Math.min(5, Math.round(todayMinutes / unit)));
    var perTask = Math.max(unit, Math.round(todayMinutes / taskCount));

    var goal = profile.targetGoal || 'your target';
    var tasks = [];
    var menu = [
      { kind: 'study',  title: 'Warm-up review',   hint: 'Quick recall on yesterday\'s key concepts.' },
      { kind: 'quiz',   title: 'Adaptive quiz',    hint: 'Multi-model questions tuned to your weak areas.' },
      { kind: 'apply',  title: 'Apply',            hint: 'One concept mapped to your work on ' + goal + '.' },
      { kind: 'study',  title: 'Synthesis pass',   hint: visual ? 'Sketch the concept map; visual learners reinforce by drawing.' : 'Re-state the concept in your own words.' },
      { kind: 'apply',  title: 'Edge-case stretch',hint: 'Push at the boundaries: where does the concept break?' }
    ];
    for (var i = 0; i < taskCount; i++) {
      var seed = menu[i % menu.length];
      tasks.push({ kind: seed.kind, title: seed.title, minutes: perTask, hint: seed.hint, completed: false, idx: i });
    }
    return {
      tasks: tasks,
      dailyMinutesTarget: todayMinutes,
      recalibrated: recalibrated,
      reason: reason
    };
  }

  function renderDailyTaskCard(task) {
    var todayKey = todayDateKey();
    var profile = getProfile();
    var completedToday = (profile.completedToday && profile.completedToday[todayKey]) || {};
    var isDone = !!completedToday[task.idx];

    var card = document.createElement('div');
    var doneBorder = _c('rgba(120,200,140,0.45)','rgba(34,134,80,0.5)');
    var idleBorder = _c('rgba(255,255,255,0.08)','rgba(0,0,0,0.1)');
    var doneBg = _c('rgba(120,200,140,0.05)','rgba(34,134,80,0.06)');
    var idleBg = _c('rgba(255,255,255,0.02)','rgba(0,0,0,0.02)');
    var hoverBorder = _c('rgba(201,181,122,0.35)','rgba(168,140,86,0.5)');
    card.style.cssText = 'padding:16px;border:1px solid ' + (isDone ? doneBorder : idleBorder) + ';border-radius:10px;background:' + (isDone ? doneBg : idleBg) + ';transition:all 0.2s;cursor:pointer;position:relative;';
    card.onmouseover = function(){ if (!isDone) card.style.borderColor = hoverBorder; };
    card.onmouseout  = function(){ if (!isDone) card.style.borderColor = idleBorder; };

    var kindLabel = { study: 'Review', quiz: 'Quiz', apply: 'Apply' }[task.kind] || 'Task';
    var checkColor = _c('#9be0b4','#15803d');
    var checkmark = isDone ? '<span style="position:absolute;top:10px;right:10px;width:18px;height:18px;border-radius:50%;background:' + _c('rgba(120,200,140,0.18)','rgba(34,134,80,0.18)') + ';display:inline-flex;align-items:center;justify-content:center;color:' + checkColor + ';font-size:11px;">✓</span>' : '';
    var kindColor = isDone ? _c('rgba(155,224,180,0.85)','#15803d') : _c('rgba(201,169,97,0.7)','#7a6741');
    var titleColor = isDone ? _c('rgba(245,236,217,0.6)','rgba(0,0,0,0.45)') : _c('#f5ecd9','#1a1a1a');
    var hintColor = _c('rgba(255,255,255,0.5)','rgba(0,0,0,0.6)');
    card.innerHTML = checkmark +
      '<div style="font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:' + kindColor + ';margin-bottom:6px;">' + escapeHtml(kindLabel) + ' · ' + task.minutes + ' min</div>' +
      '<div style="font-size:15px;font-weight:600;color:' + titleColor + ';margin-bottom:6px;text-decoration:' + (isDone ? 'line-through' : 'none') + ';">' + escapeHtml(task.title) + '</div>' +
      '<div style="font-size:12px;color:' + hintColor + ';line-height:1.5;">' + escapeHtml(task.hint) + '</div>';

    // v34.69: click-to-expand-in-place. Previously a click marked the task done
    // immediately, which was easy to do by accident. Now click toggles an
    // expansion panel underneath that wires the right tool (Translator / Quiz /
    // Apply / Synthesis) and exposes a deliberate "Mark complete" action.
    if (!isDone) {
      card.onclick = function(ev){
        // Don't re-toggle if click came from inside the expansion.
        if (ev && ev.target && ev.target.closest && ev.target.closest('[data-evolve-expand]')) return;
        var existing = card.querySelector('[data-evolve-expand]');
        if (existing) {
          // collapse
          existing.parentNode.removeChild(existing);
          return;
        }
        // collapse any other open expansion in the grid
        var siblings = card.parentNode ? card.parentNode.querySelectorAll('[data-evolve-expand]') : [];
        for (var s = 0; s < siblings.length; s++) {
          if (siblings[s].parentNode) siblings[s].parentNode.removeChild(siblings[s]);
        }
        var panel = document.createElement('div');
        panel.setAttribute('data-evolve-expand', 'true');
        panel.style.cssText = 'margin-top:14px;padding:14px;border:1px solid ' + _c('rgba(201,169,97,0.18)','rgba(168,140,86,0.18)') + ';border-radius:8px;background:' + _c('rgba(201,169,97,0.04)','rgba(168,140,86,0.04)') + ';';
        var actionBtnStyle = 'padding:8px 18px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;font-family:inherit;';
        var doneBtnStyle = 'padding:8px 14px;background:transparent;border:1px solid ' + _c('rgba(155,224,180,0.45)','rgba(34,134,80,0.45)') + ';border-radius:99px;color:' + _c('#9be0b4','#15803d') + ';font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;font-family:inherit;';

        var actionLabel, actionHandler;
        function _gotoTab(tab) {
          if (typeof window.showEvolveSection === 'function') return window.showEvolveSection(tab);
          if (window.Evolve && typeof window.Evolve.renderEvolveTabContent === 'function') return window.Evolve.renderEvolveTabContent(tab);
        }
        if (task.kind === 'quiz') {
          actionLabel = 'Start quiz';
          actionHandler = function(){ _gotoTab('practice'); };
        } else if (task.kind === 'apply') {
          actionLabel = 'Open Translator';
          actionHandler = function(){ _gotoTab('translate'); };
        } else {
          actionLabel = 'Begin review';
          actionHandler = function(){ _gotoTab('practice'); };
        }

        panel.innerHTML =
          '<div style="font-size:13px;color:' + _c('#f5ecd9','#1a1a1a') + ';line-height:1.55;margin-bottom:12px;">' + escapeHtml(task.hint) + '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<button data-evolve-action style="' + actionBtnStyle + '">' + escapeHtml(actionLabel) + '</button>' +
            '<button data-evolve-complete style="' + doneBtnStyle + '">Mark complete</button>' +
          '</div>';
        card.appendChild(panel);
        var actBtn = panel.querySelector('[data-evolve-action]');
        var compBtn = panel.querySelector('[data-evolve-complete]');
        if (actBtn) actBtn.onclick = function(ev){ ev.stopPropagation(); try { actionHandler(); } catch(e){} };
        if (compBtn) compBtn.onclick = function(ev){
          ev.stopPropagation();
          completeTask(task.idx, task.minutes);
        };
      };
    }
    return card;
  }

  function todayDateKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function completeTask(idx, minutes) {
    var profile = getProfile();
    var todayKey = todayDateKey();
    var completedToday = profile.completedToday || {};
    var todayMap = completedToday[todayKey] || {};
    if (todayMap[idx]) return; // already done

    todayMap[idx] = { at: Date.now(), minutes: minutes || 0 };
    completedToday[todayKey] = todayMap;

    // v33.7: Cross-mode integration — log Evolve completions to Pulse insights.
    try {
      var pulseRaw = localStorage.getItem('roweos_pulse_insights');
      var insights = pulseRaw ? JSON.parse(pulseRaw) : [];
      if (!Array.isArray(insights)) insights = [];
      insights.unshift({
        id: 'evolve_' + Date.now(),
        kind: 'evolve_completion',
        text: 'Completed an Evolve task (' + (minutes || 0) + ' min)',
        at: Date.now(),
        _modifiedAt: Date.now()
      });
      // Keep last 50.
      if (insights.length > 50) insights.length = 50;
      localStorage.setItem('roweos_pulse_insights', JSON.stringify(insights));
      if (typeof scheduleAutoSync === 'function') scheduleAutoSync();
    } catch(e){}

    // XP per task = minutes (1 XP per minute completed). Streak: tick on first completion of the day.
    var xpGain = minutes || 0;
    var newXP = (profile.currentXP || 0) + xpGain;
    var newStreak = profile.dailyStreak || 0;
    var prevDay = profile.lastSessionDay;
    if (prevDay !== todayKey) {
      // First task today.
      var yesterday = previousDateKey(todayKey);
      newStreak = (prevDay === yesterday) ? (newStreak + 1) : 1;
    }

    setProfile({
      completedToday: completedToday,
      currentXP: newXP,
      dailyStreak: newStreak,
      lastSessionAt: Date.now(),
      lastSessionDay: todayKey
    });

    // Brilli pleased flash for the dopamine hit.
    try {
      if (typeof Brilli !== 'undefined' && window._brilliHeroInst) {
        Brilli.setMode(window._brilliHeroInst, 'pleased');
        setTimeout(function(){ try { Brilli.setMode(window._brilliHeroInst, 'idle'); } catch(e){} }, 1200);
      }
      if (typeof Brilli !== 'undefined' && window._sidebarBrilliInst) {
        Brilli.setMode(window._sidebarBrilliInst, 'pleased');
        setTimeout(function(){ try { Brilli.setMode(window._sidebarBrilliInst, 'idle'); } catch(e){} }, 1200);
      }
    } catch(e){}

    // Re-render the dashboard if it's mounted.
    var host = document.getElementById('evolveDashboardHost');
    if (host) renderPulseDashboard(host);

    if (typeof showToast === 'function') showToast('+' + xpGain + ' XP · ' + newStreak + '-day streak', 'success');
  }

  function previousDateKey(key) {
    var d = new Date(key + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function openEvolveProfileEditor(rerenderHost) {
    var existing = document.getElementById('evolveProfileEditorOverlay');
    if (existing) existing.parentNode.removeChild(existing);

    var profile = getProfile();
    var overlay = document.createElement('div');
    overlay.id = 'evolveProfileEditorOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:99000;';
    overlay.onclick = function(e){ if (e.target === overlay) overlay.parentNode.removeChild(overlay); };

    var modal = document.createElement('div');
    modal.style.cssText = 'max-width:560px;width:92%;max-height:88vh;overflow:auto;background:' + _c('#0f0f0f','#ffffff') + ';border:1px solid ' + _c('rgba(201,181,122,0.18)','rgba(168,140,86,0.3)') + ';border-radius:14px;padding:24px;color:' + _c('#f5ecd9','#1a1a1a') + ';font-family:inherit;';
    modal.innerHTML =
      '<div style="font-size:18px;font-weight:600;margin-bottom:6px;">Evolve · Profile</div>' +
      '<div style="font-size:13px;color:' + _c('rgba(255,255,255,0.55)','rgba(0,0,0,0.6)') + ';margin-bottom:18px;line-height:1.5;">Memory becomes pedagogy. The fields below shape every Evolve prompt.</div>' +
      buildField('Target goal', 'evolveGoalInput', 'text', profile.targetGoal, 'e.g. Pass IBHRE-CCDS, Aug 5 2026') +
      buildField('Deadline date', 'evolveDeadlineInput', 'date', profile.deadlineDate, '') +
      buildField('Known context', 'evolveContextInput', 'textarea', (profile.knownContext || []).join('\n'), 'One per line. e.g.\nField Clinical Specialist\n2 yrs at Biotronik\nActive in CRT-D') +
      buildField('Cognitive profile', 'evolveCognitiveInput', 'textarea', profile.cognitiveProfile, 'e.g. severe ADHD, visual learner, micro-tasks, no red overdue alerts') +
      '<div style="margin-top:18px;display:flex;justify-content:space-between;gap:8px;">' +
        '<button id="evolveProfileResetBtn" style="padding:9px 16px;background:transparent;border:1px solid rgba(255,80,80,0.35);border-radius:8px;color:rgba(255,150,150,0.85);font-size:12px;cursor:pointer;">Reset</button>' +
        '<div style="display:flex;gap:8px;">' +
          '<button id="evolveProfileCancelBtn" style="padding:9px 16px;background:transparent;border:1px solid ' + _c('rgba(255,255,255,0.18)','rgba(0,0,0,0.2)') + ';border-radius:8px;color:' + _c('rgba(255,255,255,0.6)','rgba(0,0,0,0.65)') + ';font-size:12px;cursor:pointer;">Cancel</button>' +
          '<button id="evolveProfileSaveBtn" style="padding:9px 18px;background:' + _c('rgba(201,181,122,0.12)','rgba(168,140,86,0.18)') + ';border:1px solid ' + _c('rgba(201,181,122,0.5)','rgba(168,140,86,0.6)') + ';border-radius:8px;color:' + _c('#f5e6c8','#5a4d2e') + ';font-size:12px;font-weight:600;cursor:pointer;">Save</button>' +
        '</div>' +
      '</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    document.getElementById('evolveProfileCancelBtn').onclick = close;
    document.getElementById('evolveProfileResetBtn').onclick = function(){
      try { localStorage.removeItem(PROFILE_KEY); } catch(e){}
      close();
      if (rerenderHost) renderPulseDashboard(rerenderHost);
    };
    document.getElementById('evolveProfileSaveBtn').onclick = function(){
      var goal = (document.getElementById('evolveGoalInput').value || '').trim();
      var deadline = (document.getElementById('evolveDeadlineInput').value || '').trim();
      var contextRaw = (document.getElementById('evolveContextInput').value || '').trim();
      var cognitive = (document.getElementById('evolveCognitiveInput').value || '').trim();
      var contextLines = contextRaw ? contextRaw.split(/\n+/).map(function(l){ return l.trim(); }).filter(function(l){ return !!l; }) : [];
      setProfile({
        targetGoal: goal,
        deadlineDate: deadline,
        knownContext: contextLines,
        cognitiveProfile: cognitive
      });
      close();
      if (rerenderHost) renderPulseDashboard(rerenderHost);
    };
  }

  function buildField(label, id, type, value, placeholder) {
    var input;
    if (type === 'textarea') {
      input = '<textarea id="' + id + '" placeholder="' + escapeHtml(placeholder || '') + '" style="width:100%;min-height:84px;padding:10px 12px;background:' + _c('rgba(255,255,255,0.04)','rgba(0,0,0,0.04)') + ';border:1px solid ' + _c('rgba(255,255,255,0.1)','rgba(0,0,0,0.15)') + ';border-radius:8px;color:' + _c('#f5ecd9','#1a1a1a') + ';font-size:13px;font-family:inherit;line-height:1.5;resize:vertical;box-sizing:border-box;">' + escapeHtml(value || '') + '</textarea>';
    } else {
      input = '<input id="' + id + '" type="' + type + '" value="' + escapeHtml(value || '') + '" placeholder="' + escapeHtml(placeholder || '') + '" style="width:100%;padding:10px 12px;background:' + _c('rgba(255,255,255,0.04)','rgba(0,0,0,0.04)') + ';border:1px solid ' + _c('rgba(255,255,255,0.1)','rgba(0,0,0,0.15)') + ';border-radius:8px;color:' + _c('#f5ecd9','#1a1a1a') + ';font-size:13px;font-family:inherit;box-sizing:border-box;" />';
    }
    return '<div style="margin-bottom:14px;">' +
      '<label style="display:block;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:rgba(201,169,97,0.7);margin-bottom:6px;">' + escapeHtml(label) + '</label>' +
      input +
      '</div>';
  }

  function showEvolveView() {
    // v33.44: Always render the Evolve view. The roweos_evolve_enabled flag now ONLY
    // gates Translator-pattern injection into chat agent system prompts — the visual
    // experience is open to everyone so Settings → Evolve toggle becomes meaningful
    // (you see it before deciding whether to opt the chat into Translator mode).
    var view = document.getElementById('evolveView');
    if (!view) return;
    if (typeof showView === 'function') showView('evolve');
    renderEvolveShell();
    // v33.10: Register the nightly content-gen automation if user has a goal.
    _ensureNightlyAutomation();
  }

  // v34.79: Nightly content-gen automation. Wires the QuizEngine pipeline
  // (Gemini outline → Claude question generation → schema validator) into
  // a 3am cron job. Enabled by default once the user has a goal — the
  // pipeline is gated by API keys, so it no-ops if none are present.
  function _ensureNightlyAutomation() {
    try {
      var profile = getProfile();
      if (!profile.targetGoal) return;
      var raw = localStorage.getItem('roweos_automations');
      var autos = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(autos)) autos = [];
      var existing = autos.find(function(a){ return a && a.id === 'evolve_nightly_content'; });
      if (existing) {
        // Migrate legacy disabled scaffold entries into active automations
        if (existing._v33scaffold) {
          existing.enabled = true;
          existing.description = 'Generate tomorrow\'s adaptive quiz pool from your goal and known context.';
          delete existing._v33scaffold;
          existing._modifiedAt = Date.now();
          localStorage.setItem('roweos_automations', JSON.stringify(autos));
          if (typeof scheduleAutoSync === 'function') scheduleAutoSync();
        }
        return;
      }
      autos.push({
        id: 'evolve_nightly_content',
        name: 'Evolve · Nightly content gen',
        description: 'Generate tomorrow\'s adaptive quiz pool from your goal and known context.',
        type: 'evolve',
        enabled: true,
        schedule: { kind: 'cron', expr: '0 3 * * *' },
        _modifiedAt: Date.now()
      });
      localStorage.setItem('roweos_automations', JSON.stringify(autos));
      if (typeof scheduleAutoSync === 'function') scheduleAutoSync();
    } catch(e){}
  }

  // v33.4: Full Evolve UI per docs/brilliance/13-evolve-preview.html.
  // Multi-tab: Today / Practice / Translator / Verify / Skills.
  // Mobile-first: side rail collapses to a top strip on narrow viewports (CSS).
  var _activeEvolveTab = 'today';

  function renderEvolveShell() {
    renderEvolveSideRail();
    renderEvolveTabContent(_activeEvolveTab);
    wireEvolveTabClicks();
  }

  // v33.50: renamed from renderEvolveSideRail — now populates the flat stats strip
  // (countdown + goal + XP/streak/progress) instead of a side rail.
  function renderEvolveSideRail() {
    var profile = getProfile();
    var daysLeft = daysToDeadline(profile);
    var titleEl = document.getElementById('evolveSideHeadTitle');
    var goalEl = document.getElementById('evolveSideGoal');
    var countdownEl = document.getElementById('evolveSideCountdown');
    var fillEl = document.getElementById('evolveSideProgressFill');
    var statsEl = document.getElementById('evolveSideStats');
    var ctxEl = document.getElementById('evolveSideContext');

    if (titleEl) titleEl.innerHTML = 'Ev<em>o</em>lve';
    if (goalEl) {
      // v33.53: When a goal is set, wrap it in the same edit-profile link so the user
      // never has to hunt for the editor entry point.
      goalEl.innerHTML = profile.targetGoal
        ? '<a href="#" onclick="event.preventDefault();Evolve.openProfileEditor(document.getElementById(\'evolveTabToday\'))" title="Edit your profile">'
            + escapeHtml(profile.targetGoal)
            + (profile.deadlineDate ? ' <span style="color:rgba(255,255,255,0.4);">&middot; ' + escapeHtml(profile.deadlineDate) + '</span>' : '')
          + '</a>'
        : '<a href="#" onclick="event.preventDefault();Evolve.openProfileEditor(document.getElementById(\'evolveTabToday\'))">Set up your profile to begin</a>';
    }
    if (countdownEl) {
      if (daysLeft != null) {
        var lab = (daysLeft >= 0) ? 'days remaining' : 'days past deadline';
        countdownEl.innerHTML = '<span class="num">' + Math.abs(daysLeft) + '</span><span class="lab">' + escapeHtml(lab) + '</span>';
      } else {
        countdownEl.innerHTML = '<span class="num">—</span><span class="lab">no deadline</span>';
      }
    }
    if (fillEl) {
      var pct = computeProgressPct(profile);
      fillEl.style.width = pct + '%';
    }
    if (statsEl) {
      statsEl.innerHTML =
        '<span class="stat"><strong>' + (profile.currentXP || 0) + '</strong>XP</span>' +
        '<span class="stat"><strong>' + (profile.dailyStreak || 0) + '</strong>day streak</span>';
    }
    if (ctxEl) {
      // v33.53: Empty-state link routes to the profile editor.
      if (profile.knownContext && profile.knownContext.length) {
        ctxEl.textContent = profile.knownContext.join(', ');
      } else {
        ctxEl.innerHTML = '<a href="#" onclick="event.preventDefault();Evolve.openProfileEditor(document.getElementById(\'evolveTabToday\'))">No known context yet. Add some in your profile</a>';
      }
    }
  }

  function computeProgressPct(profile) {
    if (!profile.completedToday) return 0;
    var total = 0;
    for (var k in profile.completedToday) {
      if (Object.prototype.hasOwnProperty.call(profile.completedToday, k)) {
        var m = profile.completedToday[k];
        for (var t in m) if (Object.prototype.hasOwnProperty.call(m, t)) total++;
      }
    }
    var daysLeft = daysToDeadline(profile);
    if (daysLeft == null || daysLeft <= 0) return Math.min(100, total * 5);
    // rough: each completed task = 1% toward 100 days of work
    return Math.min(100, total * 1);
  }

  function renderEvolveTabContent(tab) {
    _activeEvolveTab = tab;
    // toggle pane visibility
    var panes = document.querySelectorAll('.evolve-tab-pane');
    for (var i = 0; i < panes.length; i++) panes[i].classList.add('hidden');
    var paneId = 'evolveTab' + tab.charAt(0).toUpperCase() + tab.slice(1);
    var pane = document.getElementById(paneId);
    if (!pane) return;
    pane.classList.remove('hidden');
    // toggle tab nav active state
    var tabs = document.querySelectorAll('[data-evolve-tab]');
    for (var j = 0; j < tabs.length; j++) {
      tabs[j].classList.toggle('active', tabs[j].getAttribute('data-evolve-tab') === tab);
    }
    // render content
    if (tab === 'today')      renderTodayPane(pane);
    else if (tab === 'practice')  renderPracticePane(pane);
    else if (tab === 'translate') renderTranslatePane(pane);
    else if (tab === 'verify')    renderVerifyPane(pane);
    else if (tab === 'skills')    renderSkillsPane(pane);

    // v33.13: Quiz hotkeys — wire/unwire based on active tab.
    if (tab === 'practice') _wireQuizHotkeys();
    else _unwireQuizHotkeys();
  }

  var _quizHotkeyHandler = null;
  function _wireQuizHotkeys() {
    if (_quizHotkeyHandler) return;
    _quizHotkeyHandler = function(ev){
      // Don't interfere with text input.
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      var key = ev.key;
      if (['1','2','3','4'].indexOf(key) !== -1) {
        var letter = ['A','B','C','D'][parseInt(key, 10) - 1];
        _selectQuizOption(letter);
        ev.preventDefault();
      } else if (key === 'a' || key === 'A') { _selectQuizOption('A'); ev.preventDefault(); }
      else if (key === 'b' || key === 'B') { _selectQuizOption('B'); ev.preventDefault(); }
      else if (key === 'c' || key === 'C') { _selectQuizOption('C'); ev.preventDefault(); }
      else if (key === 'd' || key === 'D') { _selectQuizOption('D'); ev.preventDefault(); }
      else if (key === 'Enter') {
        // Enter reveals if selection is made; if revealed, advance.
        var quiz = _getDemoQuiz();
        var state = _getQuizState(quiz.id);
        if (!state.revealed && state.selected) { _revealQuiz(); ev.preventDefault(); }
        else if (state.revealed) { _nextQuiz(); ev.preventDefault(); }
      } else if (key === 'n' || key === 'N') { _nextQuiz(); ev.preventDefault(); }
      else if (key === 'r' || key === 'R') { _retryQuiz(); ev.preventDefault(); }
    };
    document.addEventListener('keydown', _quizHotkeyHandler);
  }
  function _unwireQuizHotkeys() {
    if (!_quizHotkeyHandler) return;
    document.removeEventListener('keydown', _quizHotkeyHandler);
    _quizHotkeyHandler = null;
  }

  function wireEvolveTabClicks() {
    var tabs = document.querySelectorAll('[data-evolve-tab]');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      if (t._evolveWired) continue;
      t._evolveWired = true;
      t.addEventListener('click', function(ev){
        ev.preventDefault();
        var name = ev.currentTarget.getAttribute('data-evolve-tab');
        if (name) renderEvolveTabContent(name);
      });
    }
  }

  function renderTodayPane(host) {
    // host gets the existing Pulse Dashboard.
    renderPulseDashboard(host);
  }

  function renderPracticePane(host) {
    // v34.79: Live multi-model pipeline. Pull from QuizEngine pool first;
    // fall back to demo bank only if the engine is disabled or unkeyed.
    // v34.81: Validate that the cached quiz topic still matches the active goal.
    // If it doesn't (user changed goal mid-session, or the pool was generated
    // from stale context), wipe the pool and force a refill.
    var quiz = null;
    var sourceLabel = '';
    var refilling = false;
    if (typeof QuizEngine !== 'undefined' && QuizEngine.isEnabled()) {
      var profile = getProfile();
      var goalLower = (profile.targetGoal || '').toLowerCase();
      quiz = QuizEngine.nextQuiz();
      // If the next quiz's topic and citation don't reference anything related
      // to the user's goal, treat the pool as stale.
      if (quiz && goalLower) {
        var topicLower = (quiz.topic || '').toLowerCase();
        var citationLower = (quiz.citation || '').toLowerCase();
        var goalWords = goalLower.split(/\s+/).filter(function(w){ return w.length > 3; });
        var anyMatch = goalWords.length === 0 || goalWords.some(function(w) {
          return topicLower.indexOf(w) !== -1 || citationLower.indexOf(w) !== -1 || (quiz.question || '').toLowerCase().indexOf(w) !== -1;
        });
        if (!anyMatch) {
          // Stale — wipe and refill
          try { localStorage.removeItem('roweos_evolve_quiz_pool'); } catch(e){}
          quiz = null;
        }
      }
      if (!quiz) {
        // Pool empty (or wiped) — kick a refill in the background and fall back to demo for now
        refilling = true;
        sourceLabel = 'Generating new quizzes from your goal: ' + (profile.targetGoal || 'set a goal first') + '.';
        QuizEngine.refillPool().then(function(res) {
          if (res && !res.skipped && res.added > 0) {
            try { renderPracticePane(host); } catch(e){}
          }
        });
      } else {
        sourceLabel = 'Generated from your goal: ' + (quiz.topic || '');
      }
    }
    if (!quiz) quiz = _getDemoQuiz();
    var state = _getQuizState(quiz.id);
    var attempts = 0;
    try { attempts = parseInt(localStorage.getItem('roweos_evolve_quiz_attempts_' + quiz.id) || '0', 10); if (isNaN(attempts)) attempts = 0; } catch(e){}
    host.innerHTML =
      '<div class="evolve-pane-inner">' +
        '<p class="today-section-tag">Pillar III &middot; Practice</p>' +
        '<h2 class="today-h">Adaptive <em>quiz engine</em></h2>' +
        '<p style="font-size:13px;color:' + _c('rgba(255,255,255,0.55)','rgba(0,0,0,0.6)') + ';line-height:1.7;margin-bottom:24px;">' +
          (refilling
            ? 'Generating fresh questions from your goal and known context. This usually takes a few seconds. Refresh in a moment.'
            : (sourceLabel || 'Four options, one correct. Reveal opens the Why and Why-Not matrix plus the source citation.')) +
        '</p>' +
        '<div class="evolve-quiz-card" id="evolveQuizCard">' +
          '<div class="evolve-quiz-meta">' +
            '<span class="topic">' + escapeHtml(quiz.topic) + (attempts > 0 ? ' · attempt ' + (attempts + 1) : '') + '</span>' +
            '<span class="diff">' + _renderDiff(quiz.difficulty) + '</span>' +
          '</div>' +
          '<div class="evolve-quiz-q">' + escapeHtml(quiz.question) + '</div>' +
          '<div class="evolve-quiz-options" id="evolveQuizOptions">' + _renderQuizOptions(quiz, state) + '</div>' +
          (state.revealed ? _renderQuizMatrix(quiz, state) : '') +
          '<div class="evolve-quiz-actions">' +
            (state.revealed
              ? (function(){
                  var correct = quiz.options.find(function(o){ return o.correct; });
                  var wasCorrect = correct && state.selected === correct.letter;
                  var btns = '';
                  if (!wasCorrect) {
                    btns += '<button class="evolve-quiz-btn" onclick="Evolve._retryQuiz()">Retry (Drill)</button>';
                  }
                  btns += '<button class="evolve-quiz-btn primary" onclick="Evolve._nextQuiz()">Next question</button>';
                  return btns;
                })()
              : '<button class="evolve-quiz-btn" id="evolveQuizSubmit" disabled onclick="Evolve._revealQuiz()">Reveal</button>') +
            // v34.81: manual regenerate — wipe pool + force fresh refill against current goal
            '<button class="evolve-quiz-btn" onclick="Evolve._regenerateQuiz()" style="margin-left:auto;opacity:0.7;" title="Regenerate quizzes from your current goal">Regenerate</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // Fallback demo bank — used only when QuizEngine is disabled or unkeyed.
  // Live quizzes come from QuizEngine.nextQuiz() (Gemini → Claude pipeline, v34.79).
  var _DEMO_QUIZZES = [
    {
      id: 'demo-1',
      topic: 'Reading',
      difficulty: 3,
      question: 'In a learning system designed to translate new concepts via the user\'s existing mental models, which design pattern best supports retention without overwhelming cognitive load?',
      options: [
        { letter: 'A', body: 'Show the new concept first, then map to known terms only on request.' },
        { letter: 'B', body: 'Translate via known mental models FIRST; only then introduce generalized terminology.', correct: true },
        { letter: 'C', body: 'Force the user to memorize generalized terminology before any translation.' },
        { letter: 'D', body: 'Skip translation entirely and rely on spaced repetition.' }
      ],
      whyMatrix: {
        A: 'Reverses the polarity. Showing new first then translating means the brain has already burned cognitive load on unfamiliar material before the bridge appears.',
        B: 'Correct. The Translator pattern: known mental models are the bridge. Generalized terminology is layered on AFTER the bridge is in place.',
        C: 'Punitive and slow. Memorizing without context is what most learning platforms do, and what Brilliance was built to NOT do.',
        D: 'Spaced repetition is necessary but insufficient. Without translation, the user is repeating unfamiliar material in a vacuum.'
      },
      citation: 'docs/brilliance/14-evolve.md §Foundation: Memory as Learner Identity'
    },
    {
      id: 'demo-2',
      topic: 'Architecture',
      difficulty: 4,
      question: 'When v5 sync runs in read-shadow mode, what counts as a "discrepancy"?',
      options: [
        { letter: 'A', body: 'Any cloud doc the local cache does not have.' },
        { letter: 'B', body: 'Any cloud doc whose _modifiedAt differs from local by more than the configured threshold.', correct: true },
        { letter: 'C', body: 'Every cloud onSnapshot event.' },
        { letter: 'D', body: 'Network errors during shadow listener.' }
      ],
      whyMatrix: {
        A: 'False positives. Cloud-only doc may simply be a new item that has not propagated yet. v5 needs to distinguish "new" from "drift".',
        B: 'Correct. Drift is what dual-write needs to fix. The compareV4 callback in 35-sync-v5.js exits early if timestamps match within tolerance.',
        C: 'Events are not discrepancies. Most events are zero-drift confirmations.',
        D: 'Errors are tracked separately as lastError; they don\'t bump the discrepancy counter.'
      },
      citation: 'docs/brilliance/16-sync-v5.md §Read-shadow + 35-sync-v5.js'
    }
  ];

  function _getDemoQuiz() {
    try {
      var idx = parseInt(localStorage.getItem('roweos_evolve_quiz_idx') || '0', 10);
      if (isNaN(idx)) idx = 0;
      return _DEMO_QUIZZES[idx % _DEMO_QUIZZES.length];
    } catch(e) { return _DEMO_QUIZZES[0]; }
  }

  function _getQuizState(quizId) {
    try {
      var raw = localStorage.getItem('roweos_evolve_quiz_state_' + quizId);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return { selected: null, revealed: false };
  }

  function _saveQuizState(quizId, state) {
    try { localStorage.setItem('roweos_evolve_quiz_state_' + quizId, JSON.stringify(state)); } catch(e) {}
  }

  function _renderDiff(level) {
    var dots = '';
    for (var i = 0; i < 5; i++) {
      dots += '<span class="diff-dot' + (i < level ? ' on' : '') + '"></span>';
    }
    return dots;
  }

  function _renderQuizOptions(quiz, state) {
    return quiz.options.map(function(opt) {
      var classes = 'evolve-quiz-opt';
      if (state.selected === opt.letter) classes += ' selected';
      if (state.revealed) {
        if (opt.correct) classes += ' right';
        else if (state.selected === opt.letter) classes += ' wrong';
      }
      var attr = state.revealed
        ? ''
        : ' onclick="Evolve._selectQuizOption(\'' + opt.letter + '\')"';
      return '<div class="' + classes + '" data-letter="' + opt.letter + '"' + attr + '>' +
        '<span class="letter">' + opt.letter + '</span>' +
        '<span class="body">' + escapeHtml(opt.body) + '</span>' +
        '</div>';
    }).join('');
  }

  function _renderQuizMatrix(quiz, state) {
    var rows = quiz.options.map(function(opt) {
      var why = quiz.whyMatrix[opt.letter];
      var row = 'wrong';
      if (opt.correct) row = 'correct';
      if (state.selected === opt.letter && !opt.correct) row = 'wrong';
      var label = opt.correct ? 'Correct.' : (state.selected === opt.letter ? 'Why your choice (' + opt.letter + ') is incorrect.' : 'Why ' + opt.letter + ' is incorrect.');
      return '<div class="evolve-quiz-matrix-row ' + row + '">' +
        '<span class="lett">' + opt.letter + '</span>' +
        '<span class="body"><strong>' + label + '</strong> ' + escapeHtml(why) + '</span>' +
      '</div>';
    }).join('');
    return '<div class="evolve-quiz-matrix">' +
      '<p class="evolve-quiz-citation">Citation: <em>' + escapeHtml(quiz.citation) + '</em></p>' +
      rows +
    '</div>';
  }

  function _selectQuizOption(letter) {
    var quiz = _getDemoQuiz();
    var state = _getQuizState(quiz.id);
    if (state.revealed) return;
    state.selected = letter;
    _saveQuizState(quiz.id, state);
    var pane = document.getElementById('evolveTabPractice');
    if (pane) renderPracticePane(pane);
    var btn = document.getElementById('evolveQuizSubmit');
    if (btn) btn.disabled = false;
  }

  function _revealQuiz() {
    var quiz = _getDemoQuiz();
    var state = _getQuizState(quiz.id);
    if (state.revealed || !state.selected) return;
    state.revealed = true;
    _saveQuizState(quiz.id, state);

    // XP only on first reveal AND correct answer.
    var correctOpt = quiz.options.find(function(o){ return o.correct; });
    if (correctOpt && state.selected === correctOpt.letter) {
      var profile = getProfile();
      var newXP = (profile.currentXP || 0) + 12;
      setProfile({ currentXP: newXP });
      try {
        if (typeof Brilli !== 'undefined' && window._brilliHeroInst) {
          Brilli.setMode(window._brilliHeroInst, 'pleased');
          setTimeout(function(){ try { Brilli.setMode(window._brilliHeroInst, 'idle'); } catch(e){} }, 1200);
        }
      } catch(e){}
      if (typeof showToast === 'function') showToast('+12 XP · correct', 'success');
    }
    var pane = document.getElementById('evolveTabPractice');
    if (pane) renderPracticePane(pane);
  }

  function _nextQuiz() {
    try {
      // v34.81: mark the current pool item completed so nextQuiz advances
      var cur = (typeof QuizEngine !== 'undefined' && QuizEngine.nextQuiz) ? QuizEngine.nextQuiz() : null;
      if (cur && cur.id && QuizEngine.markCompleted) QuizEngine.markCompleted(cur.id);
      var idx = parseInt(localStorage.getItem('roweos_evolve_quiz_idx') || '0', 10);
      if (isNaN(idx)) idx = 0;
      localStorage.setItem('roweos_evolve_quiz_idx', String(idx + 1));
    } catch(e){}
    var pane = document.getElementById('evolveTabPractice');
    if (pane) renderPracticePane(pane);
  }

  // v34.81: Manual regenerate — clears the cached pool + completed history,
  // forces a fresh refill against the user's current goal/known-context.
  function _regenerateQuiz() {
    try { localStorage.removeItem('roweos_evolve_quiz_pool'); } catch(e){}
    try { localStorage.removeItem('roweos_evolve_quiz_completed'); } catch(e){}
    try { localStorage.removeItem('roweos_evolve_quiz_idx'); } catch(e){}
    if (typeof showToast === 'function') showToast('Regenerating quiz pool from your current goal...', 'info');
    var pane = document.getElementById('evolveTabPractice');
    if (typeof QuizEngine !== 'undefined' && QuizEngine.refillPool) {
      QuizEngine.refillPool().then(function(res) {
        if (pane) renderPracticePane(pane);
        if (res && !res.skipped && typeof showToast === 'function') {
          showToast('Generated ' + (res.added || 0) + ' fresh questions', 'success');
        } else if (res && res.skipped && typeof showToast === 'function') {
          showToast('Could not regenerate: ' + (res.reason || 'unknown'), 'warning');
        }
      });
    } else if (pane) {
      renderPracticePane(pane);
    }
  }

  // v33.12: Drill mode — reset the current quiz state so user can re-answer.
  // Tracks attempts in localStorage so we can later award persistence XP.
  function _retryQuiz() {
    try {
      var quiz = _getDemoQuiz();
      var attemptsKey = 'roweos_evolve_quiz_attempts_' + quiz.id;
      var attempts = parseInt(localStorage.getItem(attemptsKey) || '0', 10);
      if (isNaN(attempts)) attempts = 0;
      localStorage.setItem(attemptsKey, String(attempts + 1));
      _saveQuizState(quiz.id, { selected: null, revealed: false });
    } catch(e){}
    var pane = document.getElementById('evolveTabPractice');
    if (pane) renderPracticePane(pane);
  }

  function renderTranslatePane(host) {
    var profile = getProfile();
    host.innerHTML =
      '<div class="evolve-pane-inner evolve-translate-grid">' +
        '<div class="evolve-translate-pane">' +
          '<p class="today-section-tag">Pillar IV &middot; Translator</p>' +
          '<h3 class="brilliance-serif" style="font-weight:400;font-size:24px;margin-bottom:6px;">My <em style="color:#c9b57a;">context</em></h3>' +
          '<p class="evolve-translate-desc">Type a term you already know. Brilliance maps it to generic terminology + competitor equivalents using your Memory profile.</p>' +
          '<input id="evolveTranslateInput" class="evolve-translate-input" type="text" placeholder="A term you know..." onkeydown="if(event.key===\'Enter\')Evolve._runTranslate(this.value)" />' +
          '<div style="display:flex;gap:8px;margin-top:10px;">' +
            '<button class="evolve-quiz-btn primary" onclick="Evolve._runTranslate(document.getElementById(\'evolveTranslateInput\').value)">Translate &rarr;</button>' +
          '</div>' +
          '<div class="evolve-translate-known">' +
            '<p class="lab">Known context</p>' +
            (profile.knownContext && profile.knownContext.length
              ? profile.knownContext.map(function(c){ return '<p class="item">' + escapeHtml(c) + '</p>'; }).join('')
              : '<p class="item" style="color:' + _c('rgba(255,255,255,0.4)','rgba(0,0,0,0.5)') + ';">No context yet. Add via profile.</p>') +
          '</div>' +
        '</div>' +
        '<div class="evolve-translate-pane evolve-translate-output" id="evolveTranslateOutput">' +
          '<p class="today-section-tag" id="evolveTranslateModel">Streaming &middot; ready</p>' +
          '<h3 class="brilliance-serif" style="font-weight:400;font-size:24px;margin-bottom:6px;">What it <em style="color:#c9b57a;">means</em></h3>' +
          '<div id="evolveTranslateBody" class="evolve-translate-empty">Type a term on the left to see its generic terminology, mechanism, competitor equivalents, and exam mapping.</div>' +
        '</div>' +
      '</div>';
  }

  function _runTranslate(term) {
    term = (term || '').trim();
    if (!term) return;
    var bodyEl = document.getElementById('evolveTranslateBody');
    var modelEl = document.getElementById('evolveTranslateModel');
    if (!bodyEl) return;

    bodyEl.classList.remove('evolve-translate-empty');
    bodyEl.innerHTML = '<div class="evolve-translate-streaming">Translating &middot; <span class="evolve-translate-cursor"></span></div>';
    if (modelEl) modelEl.textContent = 'Streaming · Claude 4.7 Opus';

    var profile = getProfile();
    var sys = generateEvolveSystemPrompt(profile) + '\n\n' +
      'You are the Translator. The user provides a term they know. Output four sections:\n' +
      '1. Generic term: the universal/exam terminology for what they described.\n' +
      '2. Mechanism: concise explanation in 1-2 sentences.\n' +
      '3. Competitor equivalents: what other vendors/frameworks call the same thing.\n' +
      '4. Exam-mapped: when test questions ask about this concept, this is the answer.\n' +
      'Keep total response under 300 words. Use bolded headers for each section.';
    var msgs = [{ role: 'user', content: 'Translate: ' + term }];

    var anthropicKey = '', openaiKey = '';
    try { anthropicKey = localStorage.getItem('roweos_anthropic_api_key') || ''; } catch(e){}
    try { openaiKey = localStorage.getItem('roweos_openai_api_key') || ''; } catch(e){}

    var streamed = '';
    function onChunk(text) {
      streamed += text;
      bodyEl.innerHTML = '<div class="evolve-translate-result">' + escapeHtml(streamed).replace(/\n/g, '<br>') + '<span class="evolve-translate-cursor"></span></div>';
    }
    function onComplete() {
      bodyEl.innerHTML = '<div class="evolve-translate-result">' + escapeHtml(streamed).replace(/\n/g, '<br>') + '</div>' +
        '<button class="evolve-quiz-btn" style="margin-top:14px;" onclick="Evolve._saveTranslation(\'' + encodeURIComponent(term) + '\')">Save to Memory</button>';
      if (modelEl) modelEl.textContent = 'Complete · Claude 4.7 Opus';
    }
    function onError(err) {
      bodyEl.innerHTML = '<div class="evolve-translate-result" style="color:#ef5350;">' + escapeHtml((err && err.message) || 'Translation failed') + '</div>';
    }

    try {
      if (anthropicKey && typeof callAnthropicStreaming === 'function') {
        callAnthropicStreaming('claude-opus-4-7', anthropicKey, msgs, sys, onChunk, onComplete, onError);
      } else if (openaiKey && typeof callOpenAIStreaming === 'function') {
        if (modelEl) modelEl.textContent = 'Streaming · GPT-5';
        callOpenAIStreaming('gpt-5', openaiKey, msgs, sys, onChunk, onComplete, onError);
      } else {
        onError({ message: 'No API key configured. Add Anthropic or OpenAI key in Settings.' });
      }
    } catch(e) {
      onError(e);
    }
  }

  function _saveTranslation(termEnc) {
    try {
      var term = decodeURIComponent(termEnc);
      var profile = getProfile();
      var ctx = profile.knownContext || [];
      if (ctx.indexOf(term) === -1) {
        ctx.push(term);
        setProfile({ knownContext: ctx });
        if (typeof showToast === 'function') showToast('Saved "' + term + '" to known context', 'success');
      }
    } catch(e){}
  }

  function renderVerifyPane(host) {
    var savedInput = '';
    try { savedInput = localStorage.getItem('roweos_evolve_verify_input') || ''; } catch(e){}
    host.innerHTML =
      '<div class="evolve-pane-inner">' +
        '<p class="today-section-tag">Pillar V &middot; Deep Verification</p>' +
        '<h2 class="today-h">Peer-review your <em>understanding</em></h2>' +
        '<p style="font-size:13px;color:' + _c('rgba(255,255,255,0.55)','rgba(0,0,0,0.6)') + ';line-height:1.7;margin-bottom:24px;">Paste a textbook claim, hypothesis, or memory-conflict. Pass 1 fact-checks the claim; Pass 2 runs an adversarial skepticism pass on the result. You get a verdict, confidence score, and source citations.</p>' +
        '<label class="evolve-verify-label">Concept to verify</label>' +
        '<textarea id="evolveVerifyInput" class="evolve-verify-input" oninput="try{localStorage.setItem(\'roweos_evolve_verify_input\',this.value)}catch(e){}" placeholder="Paste a textbook claim, hypothesis, or memory-conflict here...">' + escapeHtml(savedInput) + '</textarea>' +
        '<button class="evolve-quiz-btn primary" id="evolveVerifyBtn" onclick="Evolve._runVerify()" style="margin-top:14px;">Run peer-review &rarr;</button>' +
        '<div id="evolveVerifyResult" style="margin-top:24px;"></div>' +
      '</div>';
  }

  function _runVerify() {
    var input = document.getElementById('evolveVerifyInput');
    var resultEl = document.getElementById('evolveVerifyResult');
    var btn = document.getElementById('evolveVerifyBtn');
    if (!input || !resultEl) return;
    var claim = (input.value || '').trim();
    if (!claim) {
      resultEl.innerHTML = '<div style="color:rgba(255,150,150,0.85);font-size:13px;">Paste a claim above to verify.</div>';
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Reviewing…'; }
    resultEl.innerHTML =
      '<div class="evolve-verify-streaming">' +
        '<div style="font-size:12px;color:' + _c('rgba(255,255,255,0.5)','rgba(0,0,0,0.5)') + ';margin-bottom:6px;">Pass 1 · fact-check</div>' +
        '<div style="opacity:0.6;">Running…<span class="evolve-translate-cursor"></span></div>' +
      '</div>';

    // v34.79: Two-pass live verifier (Anthropic claim-check → Google/OpenAI
    // adversarial skepticism → synthesis). Citations extracted from both passes.
    var profile = getProfile();

    function renderResult(result) {
      if (btn) { btn.disabled = false; btn.textContent = 'Run peer-review →'; }
      if (result.skipped) {
        resultEl.innerHTML = '<div style="color:rgba(255,150,150,0.85);font-size:13px;">' +
          escapeHtml(result.reason || 'Verifier unavailable') +
          (result.reason === 'pipeline error' ? ' — add an API key in Settings.' : '') + '</div>';
        return;
      }
      var verdict = result.verdict || 'insufficient';
      var badge = verdict === 'verified' ? '<span class="evolve-verify-badge verified">Verified</span>' :
                  verdict === 'corrected' ? '<span class="evolve-verify-badge corrected">Corrected</span>' :
                  '<span class="evolve-verify-badge insufficient">Insufficient evidence</span>';
      var citationHTML = '';
      if (result.citations && result.citations.length > 0) {
        citationHTML = '<div style="margin-top:14px;font-size:12px;color:' + _c('rgba(255,255,255,0.5)','rgba(0,0,0,0.55)') + ';">Sources:</div>' +
          '<ul style="margin:6px 0 0 0;padding-left:18px;font-size:12px;line-height:1.6;">' +
          result.citations.map(function(c) {
            if (c.url) return '<li><a href="' + escapeHtml(c.url) + '" target="_blank" rel="noopener" style="color:' + _c('#c9b57a','#7a6741') + ';">' + escapeHtml(c.source) + '</a></li>';
            return '<li>' + escapeHtml(c.source) + '</li>';
          }).join('') +
          '</ul>';
      }
      var modelHTML = '';
      if (result.models && result.models.length > 0) {
        modelHTML = '<div style="margin-top:10px;font-size:11px;color:' + _c('rgba(255,255,255,0.35)','rgba(0,0,0,0.35)') + ';">Models: ' +
          escapeHtml(result.models.filter(function(m){ return m && m !== 'none'; }).join(' + ')) +
          ' · confidence ' + (result.confidence || 'n/a') + '/5</div>';
      }
      resultEl.innerHTML = badge +
        '<div class="evolve-verify-output">' + escapeHtml(result.reasoning || '').replace(/\n/g, '<br>') + '</div>' +
        citationHTML + modelHTML +
        '<div style="display:flex;gap:8px;margin-top:14px;">' +
          '<button class="evolve-quiz-btn" onclick="Evolve._saveVerification()">Save reflection</button>' +
        '</div>';
      try {
        window._lastVerifyResult = {
          claim: claim,
          output: result.reasoning || '',
          verdict: verdict,
          citations: result.citations || [],
          confidence: result.confidence,
          at: Date.now()
        };
      } catch(e){}
    }

    if (typeof VerifierEngine !== 'undefined' && VerifierEngine.isEnabled()) {
      VerifierEngine.runPeerReview(claim, profile)
        .then(renderResult)
        .catch(function(err) { renderResult({ skipped: true, reason: 'pipeline error', error: err }); });
      return;
    }
    // Engine disabled — fall back to single-model legacy path
    var anthropicKey = '', openaiKey = '';
    try { anthropicKey = localStorage.getItem('roweos_anthropic_api_key') || ''; } catch(e){}
    try { openaiKey = localStorage.getItem('roweos_openai_api_key') || ''; } catch(e){}
    if (!anthropicKey && !openaiKey) {
      renderResult({ skipped: true, reason: 'No API key configured. Add Anthropic, OpenAI, or Google key in Settings.' });
      return;
    }
    var sys = generateEvolveSystemPrompt(profile) + '\n\nYou are the Deep Verification Studio. Output VERDICT, Reasoning, Confidence (1-5), Citations.';
    var msgs = [{ role: 'user', content: 'Claim: ' + claim }];
    var streamed = '';
    function onChunk(text) {
      streamed += text;
      resultEl.innerHTML = '<div class="evolve-verify-streaming">' + escapeHtml(streamed).replace(/\n/g, '<br>') + '<span class="evolve-translate-cursor"></span></div>';
    }
    function onComplete() {
      var verdict = /VERIFIED/i.test(streamed) ? 'verified' :
                    /CORRECTED/i.test(streamed) ? 'corrected' :
                    /INSUFFICIENT/i.test(streamed) ? 'insufficient' : 'insufficient';
      var citations = (typeof VerifierEngine !== 'undefined') ? VerifierEngine.extractCitations(streamed) : [];
      renderResult({ verdict: verdict, reasoning: streamed, citations: citations, confidence: 3, models: [anthropicKey ? 'claude' : 'gpt'] });
    }
    function onError(err) {
      renderResult({ skipped: true, reason: 'pipeline error', error: (err && err.message) || 'Verification failed' });
    }
    try {
      if (anthropicKey && typeof callAnthropicStreaming === 'function') {
        callAnthropicStreaming('claude-opus-4-7', anthropicKey, msgs, sys, onChunk, onComplete, onError);
      } else if (openaiKey && typeof callOpenAIStreaming === 'function') {
        callOpenAIStreaming('gpt-5', openaiKey, msgs, sys, onChunk, onComplete, onError);
      }
    } catch(e) { onError(e); }
  }

  function _saveVerification() {
    if (!window._lastVerifyResult) return;
    var v = window._lastVerifyResult;
    addReflection('Verifier (' + v.verdict + '): ' + v.claim + '\n\n' + v.output, []);
    if (typeof showToast === 'function') showToast('Verification saved as reflection', 'success');
  }

  function renderSkillsPane(host) {
    var profile = getProfile();
    var skills = listSkills();
    var reflections = listReflections();
    var sources = listSources();

    var defaultSkills = [
      { name: 'Quiz mastery',     pillar: 'Pillar III', xp: profile.currentXP || 0,           target: 1000 },
      { name: 'Daily rhythm',     pillar: 'Pillar II',  xp: (profile.dailyStreak || 0) * 10,  target: 365 },
      { name: 'Translator depth', pillar: 'Pillar IV',  xp: sources.length * 25,              target: 500 },
      { name: 'Verified concepts',pillar: 'Pillar V',   xp: reflections.length * 10,          target: 200 }
    ];
    // Merge user-defined skills on top of defaults.
    var renderList = defaultSkills.slice();
    for (var i = 0; i < skills.length; i++) {
      var sk = skills[i] && skills[i].data;
      if (sk && sk.name) renderList.push({ name: sk.name, pillar: sk.pillar || 'Custom', xp: sk.xp || 0, target: sk.target || 100 });
    }

    var skillHtml = renderList.map(function(s){ return renderSkillCard(s.name, s.pillar, s.xp, s.target); }).join('');

    // v33.15: Recent reflections + sources lists (last 5 each).
    function recentList(items, opts) {
      if (!items || items.length === 0) return '<div style="font-size:11px;color:' + _c('rgba(255,255,255,0.35)','rgba(0,0,0,0.45)') + ';font-style:italic;">None yet.</div>';
      var sorted = items.slice().sort(function(a, b){
        return (b._modifiedAt || (b.data && b.data.at) || 0) - (a._modifiedAt || (a.data && a.data.at) || 0);
      });
      var html = '';
      for (var i = 0; i < Math.min(5, sorted.length); i++) {
        var it = sorted[i];
        var label = opts.labelFor(it);
        if (label.length > 60) label = label.slice(0, 57) + '…';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid ' + _c('rgba(255,255,255,0.04)','rgba(0,0,0,0.06)') + ';font-size:12px;">' +
          '<span style="color:' + _c('rgba(255,255,255,0.7)','rgba(0,0,0,0.75)') + ';flex:1;">' + escapeHtml(label) + '</span>' +
          '<button onclick="Evolve._removeFromCollection(\'' + opts.coll + '\',\'' + it.id + '\')" style="background:transparent;border:none;color:rgba(255,150,150,0.6);font-size:11px;cursor:pointer;padding:2px 6px;">×</button>' +
        '</div>';
      }
      return html;
    }

    host.innerHTML =
      '<div class="evolve-pane-inner">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">' +
          '<p class="today-section-tag" style="margin-bottom:0;">Pillar VI &middot; Skills, Sources, Reflections</p>' +
          '<div style="display:flex;gap:6px;">' +
            '<button class="evolve-quiz-btn" onclick="Evolve._addSkillPrompt()" style="padding:6px 12px;font-size:10px;">+ Skill</button>' +
            '<button class="evolve-quiz-btn" onclick="Evolve.openImportDialog()" style="padding:6px 12px;font-size:10px;">Import</button>' +
            '<button class="evolve-quiz-btn" onclick="Evolve.downloadExport()" style="padding:6px 12px;font-size:10px;">Download backup</button>' +
          '</div>' +
        '</div>' +
        '<h2 class="today-h">Your skills <em>tree</em></h2>' +
        '<p style="font-size:13px;color:' + _c('rgba(255,255,255,0.55)','rgba(0,0,0,0.6)') + ';line-height:1.7;margin-bottom:24px;">Each completion contributes XP toward the parent skill. Reflections + sources persist via SyncV5 collections (per <code style="color:' + _c('#c9b57a','#7a6741') + ';">docs/brilliance/16-sync-v5.md</code>).</p>' +
        '<div class="evolve-skill-grid">' + skillHtml + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:24px;">' +
          '<div class="evolve-empty-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
              '<div class="evolve-empty-title" style="margin:0;">Reflections (' + reflections.length + ')</div>' +
              '<button class="evolve-quiz-btn" onclick="Evolve._addReflectionPrompt()" style="padding:5px 10px;font-size:10px;">+ New</button>' +
            '</div>' +
            recentList(reflections, { coll: 'reflections', labelFor: function(it){ return (it.data && it.data.text) || ''; } }) +
          '</div>' +
          '<div class="evolve-empty-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
              '<div class="evolve-empty-title" style="margin:0;">Sources (' + sources.length + ')</div>' +
              '<button class="evolve-quiz-btn" onclick="Evolve._addSourcePrompt()" style="padding:5px 10px;font-size:10px;">+ New</button>' +
            '</div>' +
            recentList(sources, { coll: 'sources', labelFor: function(it){ return (it.data && it.data.name) || ''; } }) +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function _removeFromCollection(collShortName, id) {
    if (!confirm('Remove this item?')) return;
    try {
      var coll = _getCollection(collShortName);
      if (coll && id) coll.delete(id);
    } catch(e){}
    var pane = document.getElementById('evolveTabSkills');
    if (pane) renderSkillsPane(pane);
    if (typeof showToast === 'function') showToast('Removed', 'info');
  }

  // v33.19: Export profile + collections as JSON for backup.
  function exportData() {
    var snap = {
      version: 'evolve-v1',
      exportedAt: new Date().toISOString(),
      profile: getProfile(),
      collections: {
        skills: listSkills({ includeDeleted: true }),
        sources: listSources({ includeDeleted: true }),
        reflections: listReflections({ includeDeleted: true }),
        sops: listSops({ includeDeleted: true })
      }
    };
    return snap;
  }

  function downloadExport() {
    try {
      var snap = exportData();
      var blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var ts = new Date().toISOString().replace(/[:.]/g, '-');
      var a = document.createElement('a');
      a.href = url;
      a.download = 'brilliance-evolve-' + ts + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 100);
      if (typeof showToast === 'function') showToast('Evolve data downloaded', 'success');
    } catch(e){
      if (typeof showToast === 'function') showToast('Export failed: ' + (e.message || e), 'error');
    }
  }

  // v33.20: Import Evolve data from a JSON file produced by exportData().
  // Validates structure; if existing data, asks for confirm before overwrite.
  function importData(snapshot, opts) {
    opts = opts || {};
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Invalid snapshot: not an object');
    }
    if (snapshot.version && snapshot.version !== 'evolve-v1') {
      throw new Error('Unsupported snapshot version: ' + snapshot.version);
    }
    // Profile.
    if (snapshot.profile && typeof snapshot.profile === 'object') {
      var existing = getProfile();
      if (!opts.merge && existing.targetGoal && !opts.confirmedReplace) {
        throw new Error('Existing profile present. Pass opts.confirmedReplace=true to overwrite, or opts.merge=true.');
      }
      var merged = opts.merge ? mergeProfile(existing, snapshot.profile) : snapshot.profile;
      setProfile(merged);
    }
    // Collections.
    var imported = { skills: 0, sources: 0, reflections: 0, sops: 0 };
    var colls = snapshot.collections || {};
    function importColl(short, items) {
      if (!Array.isArray(items)) return;
      var c = _getCollection(short);
      if (!c) return;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it || !it.id) continue;
        // Use the id from the snapshot to preserve cross-references.
        if (it._deletedAt && !opts.includeDeleted) continue;
        c.write(it.id, it.data || {});
        imported[short]++;
      }
    }
    importColl('skills', colls.skills);
    importColl('sources', colls.sources);
    importColl('reflections', colls.reflections);
    importColl('sops', colls.sops);
    return imported;
  }

  // UI helper: open a file picker, parse the JSON, run importData with merge mode.
  function openImportDialog() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = function(ev){
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(){
        try {
          var snap = JSON.parse(reader.result);
          var existing = getProfile();
          var hasExisting = !!existing.targetGoal;
          var merge = false;
          if (hasExisting) {
            var choice = confirm('Existing Evolve profile detected. Click OK to MERGE imported data into existing, Cancel to skip the import. (Use a fresh browser session if you want to fully replace.)');
            if (!choice) { if (typeof showToast === 'function') showToast('Import cancelled', 'info'); return; }
            merge = true;
          }
          var counts = importData(snap, { merge: merge });
          var total = counts.skills + counts.sources + counts.reflections + counts.sops;
          if (typeof showToast === 'function') showToast('Imported ' + total + ' items', 'success');
          var pane = document.getElementById('evolveTabSkills');
          if (pane) renderSkillsPane(pane);
        } catch(e){
          if (typeof showToast === 'function') showToast('Import failed: ' + (e.message || e), 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // v33.46: Inline editor modal helpers — replace prompt() calls with proper UI.
  function _openEditorModal(opts) {
    // opts: { title, fields: [{name, label, placeholder, type, value}], onSave: fn(values) }
    var existing = document.getElementById('evolveEditorOverlay');
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement('div');
    overlay.id = 'evolveEditorOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:99000;';
    overlay.onclick = function(ev){ if (ev.target === overlay) close(); };

    var modal = document.createElement('div');
    modal.style.cssText = 'max-width:520px;width:92%;max-height:88vh;overflow:auto;background:' + _c('#0f0f0f','#ffffff') + ';border:1px solid ' + _c('rgba(201,181,122,0.22)','rgba(168,140,86,0.35)') + ';border-radius:14px;padding:24px;color:' + _c('#f5ecd9','#1a1a1a') + ';font-family:inherit;';

    var fieldsHtml = (opts.fields || []).map(function(f){
      var inputEl;
      if (f.type === 'textarea') {
        inputEl = '<textarea id="ee_' + f.name + '" placeholder="' + escapeHtml(f.placeholder || '') + '" class="brilliance-serif" style="width:100%;min-height:120px;padding:12px 14px;background:' + _c('rgba(255,255,255,0.04)','rgba(0,0,0,0.04)') + ';border:1px solid ' + _c('rgba(255,255,255,0.1)','rgba(0,0,0,0.15)') + ';border-radius:8px;color:' + _c('#ece4d8','#1a1a1a') + ';font-size:14px;line-height:1.6;box-sizing:border-box;resize:vertical;">' + escapeHtml(f.value || '') + '</textarea>';
      } else {
        inputEl = '<input id="ee_' + f.name + '" type="' + (f.type || 'text') + '" placeholder="' + escapeHtml(f.placeholder || '') + '" value="' + escapeHtml(f.value || '') + '" style="width:100%;padding:12px 14px;background:' + _c('rgba(255,255,255,0.04)','rgba(0,0,0,0.04)') + ';border:1px solid ' + _c('rgba(255,255,255,0.1)','rgba(0,0,0,0.15)') + ';border-radius:8px;color:' + _c('#ece4d8','#1a1a1a') + ';font-size:14px;font-family:inherit;box-sizing:border-box;" />';
      }
      return '<div style="margin-bottom:14px;">' +
        '<label style="display:block;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:rgba(201,169,97,0.75);margin-bottom:6px;">' + escapeHtml(f.label) + '</label>' +
        inputEl +
      '</div>';
    }).join('');

    modal.innerHTML =
      '<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c9a961;font-weight:500;margin-bottom:6px;">Evolve</div>' +
      '<div class="brilliance-serif" style="font-size:22px;font-weight:500;letter-spacing:-0.01em;margin-bottom:18px;">' + escapeHtml(opts.title) + '</div>' +
      fieldsHtml +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">' +
        '<button id="evolveEditorCancelBtn" style="padding:9px 16px;background:transparent;border:1px solid ' + _c('rgba(255,255,255,0.18)','rgba(0,0,0,0.2)') + ';border-radius:8px;color:' + _c('rgba(255,255,255,0.6)','rgba(0,0,0,0.65)') + ';font-size:12px;cursor:pointer;">Cancel</button>' +
        '<button id="evolveEditorSaveBtn" style="padding:9px 18px;background:rgba(201,181,122,0.12);border:1px solid rgba(201,181,122,0.5);border-radius:8px;color:#f5e6c8;font-size:12px;font-weight:600;cursor:pointer;">Save</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    modal.querySelector('#evolveEditorCancelBtn').onclick = close;
    modal.querySelector('#evolveEditorSaveBtn').onclick = function(){
      var values = {};
      for (var i = 0; i < (opts.fields || []).length; i++) {
        var f = opts.fields[i];
        var el = document.getElementById('ee_' + f.name);
        values[f.name] = el ? el.value.trim() : '';
      }
      try {
        if (opts.onSave) opts.onSave(values);
        close();
      } catch(e) {
        if (typeof showToast === 'function') showToast((e && e.message) || 'Save failed', 'error');
      }
    };
    // Focus first input
    setTimeout(function(){
      var first = modal.querySelector('input,textarea');
      if (first) first.focus();
    }, 50);
  }

  function _addReflectionPrompt() {
    _openEditorModal({
      title: 'New reflection',
      fields: [
        { name: 'text', label: 'Reflection', type: 'textarea', placeholder: 'An aha moment, a connection between concepts, a "I finally get it"...' }
      ],
      onSave: function(values){
        if (!values.text) throw new Error('Reflection text required');
        addReflection(values.text, []);
        if (typeof showToast === 'function') showToast('Reflection saved', 'success');
        var pane = document.getElementById('evolveTabSkills');
        if (pane) renderSkillsPane(pane);
      }
    });
  }

  function _addSourcePrompt() {
    _openEditorModal({
      title: 'New source',
      fields: [
        { name: 'name', label: 'Source name', type: 'text', placeholder: 'e.g. 2026 HRS Consensus, Section 4.2.1' },
        { name: 'url',  label: 'URL (optional)', type: 'url', placeholder: 'https://...' }
      ],
      onSave: function(values){
        if (!values.name) throw new Error('Source name required');
        addSource({ name: values.name, url: values.url || '', addedAt: Date.now() });
        if (typeof showToast === 'function') showToast('Source saved', 'success');
        var pane = document.getElementById('evolveTabSkills');
        if (pane) renderSkillsPane(pane);
      }
    });
  }

  // v33.46: Add a custom skill to the user's tree.
  function _addSkillPrompt() {
    _openEditorModal({
      title: 'New skill',
      fields: [
        { name: 'name', label: 'Skill name', type: 'text', placeholder: 'e.g. EV-ICD programming' },
        { name: 'pillar', label: 'Pillar (optional)', type: 'text', placeholder: 'e.g. Pillar III · Practice' },
        { name: 'target', label: 'XP target', type: 'number', placeholder: '500', value: '500' }
      ],
      onSave: function(values){
        if (!values.name) throw new Error('Skill name required');
        var target = parseInt(values.target, 10);
        if (isNaN(target) || target < 1) target = 500;
        addSkill({ name: values.name, pillar: values.pillar || 'Custom', xp: 0, target: target });
        if (typeof showToast === 'function') showToast('Skill added', 'success');
        var pane = document.getElementById('evolveTabSkills');
        if (pane) renderSkillsPane(pane);
      }
    });
  }

  function renderSkillCard(name, pillar, xp, target) {
    var pct = Math.min(100, Math.round(xp / target * 100));
    return '<div class="evolve-skill-card">' +
      '<div class="evolve-skill-pillar">' + escapeHtml(pillar) + '</div>' +
      '<div class="evolve-skill-name">' + escapeHtml(name) + '</div>' +
      '<div class="evolve-skill-bar"><span style="width:' + pct + '%;"></span></div>' +
      '<div class="evolve-skill-meta">' + xp + ' / ' + target + ' XP &middot; ' + pct + '%</div>' +
    '</div>';
  }

  return {
    isEnabled: isEnabled,
    getProfile: getProfile,
    setProfile: setProfile,
    generateEvolveSystemPrompt: generateEvolveSystemPrompt,
    daysToDeadline: daysToDeadline,
    recalibrateMomentum: recalibrateMomentum,
    renderPulseDashboard: renderPulseDashboard,
    renderEvolveShell: renderEvolveShell,
    renderEvolveTabContent: renderEvolveTabContent,
    openProfileEditor: openEvolveProfileEditor,
    showEvolveView: showEvolveView,
    completeTask: completeTask,
    // Quiz internals exposed for inline handlers.
    _selectQuizOption: _selectQuizOption,
    _revealQuiz: _revealQuiz,
    _nextQuiz: _nextQuiz,
    _retryQuiz: _retryQuiz,
    _regenerateQuiz: _regenerateQuiz,
    // Translator internals exposed for inline handlers.
    _runTranslate: _runTranslate,
    _saveTranslation: _saveTranslation,
    // Skills/Sources/Reflections (Sprint F).
    listSkills: listSkills,
    listSources: listSources,
    listReflections: listReflections,
    listSops: listSops,
    addSkill: addSkill,
    addReflection: addReflection,
    addSource: addSource,
    addSop: addSop,
    _addReflectionPrompt: _addReflectionPrompt,
    _addSourcePrompt: _addSourcePrompt,
    _addSkillPrompt: _addSkillPrompt,
    _removeFromCollection: _removeFromCollection,
    exportData: exportData,
    downloadExport: downloadExport,
    importData: importData,
    openImportDialog: openImportDialog,
    // Verifier internals (Pillar V).
    _runVerify: _runVerify,
    _saveVerification: _saveVerification
  };
})();

window.Evolve = Evolve;

// v33.52: Wrapper for _pageLandingConfigs['evolve'].tabHandler. Lets enterPageSubSection
// (called from the Evolve landing page when user picks a feature card) actually switch
// to that tab. Without this wrapper, the click would show the evolve view but stay on
// whatever tab was last active.
window.showEvolveSection = function(tabId) {
  if (!tabId) return;
  if (window.Evolve && typeof window.Evolve.renderEvolveTabContent === 'function') {
    try { window.Evolve.renderEvolveTabContent(tabId); } catch(e){}
  }
};
