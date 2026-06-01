
// ═══════════════════════════════════════════════════════════════
// BRILLIANCE KNOWLEDGE ENGINE - v34.78
// ═══════════════════════════════════════════════════════════════
// Single source of truth for "what does Brilliance know about the user
// and their data right now". Any AI surface that asks the user a
// question should have access to 100% of system state through this
// module. Reads exclusively from localStorage + in-memory globals
// (no Firestore fetches in the hot path) so it's synchronous and
// sub-millisecond. Honors mode (brand vs life) and the active brand.
//
// Public API:
//   buildBrillianceKnowledgeContext(opts)
//     opts: {
//       includeContent: bool   // include long-form text (notebook bodies, conv history). Default false.
//       maxBytes: number       // soft budget. Default 60000 (~15k tokens).
//       focus: 'all' | 'pulse' | 'mail' | 'people' | 'automations' | ...
//     }
//   describeBrillianceCapabilities()
//     -> capability manifest string. Tells the AI everything Brilliance can do.
//   answerKnowsEverything(query)
//     -> boolean: does this query require full knowledge context?
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  function _ls(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      if (v == null) return fallback;
      return v;
    } catch (e) { return fallback; }
  }

  function _lsJSON(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      if (!v) return fallback;
      var parsed = JSON.parse(v);
      return parsed == null ? fallback : parsed;
    } catch (e) { return fallback; }
  }

  function _isLifeMode() {
    return _ls('roweos_app_mode') === 'life';
  }

  function _activeBrandIdx() {
    try {
      if (typeof selectedBrand !== 'undefined' && selectedBrand != null) return selectedBrand;
    } catch (e) {}
    var raw = _ls('roweos_selected_brand');
    var n = raw != null ? parseInt(raw, 10) : 0;
    return isNaN(n) ? 0 : n;
  }

  function _activeLifeIdx() {
    var raw = _ls('roweos_selected_life');
    var n = raw != null ? parseInt(raw, 10) : 0;
    return isNaN(n) ? 0 : n;
  }

  function _truncate(str, n) {
    if (!str) return '';
    str = String(str);
    if (str.length <= n) return str;
    return str.slice(0, n - 1) + '…';
  }

  function _safeArr(v) { return Array.isArray(v) ? v : []; }

  function _firstN(arr, n) { return _safeArr(arr).slice(0, n); }

  // ─── Mode + identity ─────────────────────────────────────────
  function _gatherIdentity(life) {
    var out = {};
    if (life) {
      var lifeIdx = _activeLifeIdx();
      var lives = _lsJSON('roweos_life_profiles', []);
      var prof = lives[lifeIdx] || lives[0] || {};
      out.mode = 'life';
      out.profile_index = lifeIdx;
      out.name = prof.name || 'Life ' + lifeIdx;
      out.context = _truncate(prof.context || prof.bio || '', 600);
      out.values = prof.values || [];
      out.goals = prof.goals || [];
    } else {
      var bIdx = _activeBrandIdx();
      var brands = [];
      try { brands = (typeof window !== 'undefined' && window.brands) || _lsJSON('roweos_brands', []); } catch (e) {}
      var b = brands[bIdx] || {};
      out.mode = 'brand';
      out.brand_index = bIdx;
      out.brand_id = b.id || null;
      out.name = b.shortName || b.name || ('Brand ' + bIdx);
      out.full_name = b.name || '';
      out.description = _truncate(b.description || '', 600);
      out.mission = _truncate(b.mission || '', 600);
      out.tone = b.tone || '';
      out.voice = _truncate(b.voice || '', 400);
      out.customers = _truncate(b.customers || '', 400);
      out.industry = b.industry || '';
      out.brand_count = brands.length;
      out.all_brand_names = brands.map(function(x) { return x && (x.shortName || x.name); }).filter(Boolean);
    }
    out.app_mode = life ? 'life' : 'brand';
    out.theme = _ls('roweos_theme') || 'dark';
    out.tier = _ls('roweos_user_tier') || 'unknown';
    return out;
  }

  // ─── Pulse (goals + items) ───────────────────────────────────
  function _gatherPulse() {
    // v34.107: per CLAUDE.md - "Every JSON.parse expecting an array MUST guard with
    // Array.isArray(). Non-array returns crash .filter()/.map() and silently break
    // entire call chains." A non-array value (corrupted localStorage, sync collision)
    // would crash _gatherPulse, propagate up through BrillianceKnowledge.build(), and
    // silently break every AI call that uses the preamble.
    var rawGoals = _lsJSON('roweos_pulse_goals', []);
    var goals = Array.isArray(rawGoals) ? rawGoals : [];
    var open = goals.filter(function(g) { return !g.archived && !g.completed; });
    var todayStr = new Date().toISOString().slice(0, 10);
    var due = 0, overdue = 0, completedToday = 0, totalItems = 0;
    var rows = [];
    open.forEach(function(g) {
      var items = _safeArr(g.items);
      totalItems += items.length;
      items.forEach(function(it) {
        if (it.completed && it.completedAt && String(it.completedAt).slice(0, 10) === todayStr) completedToday++;
        var d = it.date || it.dueDate;
        if (d && !it.completed) {
          var ds = String(d).slice(0, 10);
          if (ds < todayStr) overdue++;
          else if (ds === todayStr) due++;
        }
      });
      rows.push({
        name: g.name,
        items: items.length,
        open: items.filter(function(x) { return !x.completed; }).length,
        next_item: (items.find(function(x) { return !x.completed; }) || {}).text || null
      });
    });
    return {
      goal_count: open.length,
      total_items: totalItems,
      due_today: due,
      overdue: overdue,
      completed_today: completedToday,
      goals: rows.slice(0, 25)
    };
  }

  // ─── Reminders ───────────────────────────────────────────────
  function _gatherReminders() {
    var rems = _lsJSON('roweos_reminders', []);
    var now = Date.now();
    var pending = rems.filter(function(r) { return r.status !== 'completed' && r.status !== 'dismissed'; });
    var due = pending.filter(function(r) {
      var t = r.scheduledAt ? new Date(r.scheduledAt).getTime() : 0;
      return t && t <= now;
    });
    return {
      total: rems.length,
      pending: pending.length,
      due_now: due.length,
      next: pending.slice(0, 8).map(function(r) {
        return {
          title: r.title || r.text || '',
          when: r.scheduledAt || null,
          status: r.status || 'pending'
        };
      })
    };
  }

  // ─── Automations ─────────────────────────────────────────────
  function _gatherAutomations() {
    var sched = _lsJSON('roweos_automations', []);
    var hist = _lsJSON('roweos_completed_automations', []);
    var lab = _lsJSON('roweos_auto_lab_history', []);
    return {
      scheduled_count: sched.length,
      completed_count: hist.length,
      recent_history_count: lab.length,
      scheduled: sched.slice(0, 20).map(function(a) {
        return {
          id: a.id,
          name: a.name || a.title || '',
          schedule: a.schedule || a.cron || a.frequency || null,
          type: a.type || 'standard',
          last_run: a.lastRun || null,
          enabled: a.enabled !== false
        };
      }),
      recent_completions: hist.slice(0, 5).map(function(c) {
        return { name: c.name, completedAt: c.completedAt };
      })
    };
  }

  // ─── Mail ────────────────────────────────────────────────────
  function _gatherMail() {
    var outbox = _lsJSON('roweos_mail_outbox', []);
    var sent = _lsJSON('roweos_mail_sent', []);
    var cfg = _lsJSON('roweos_mail_config', {}) || {};
    var connected = [];
    if (cfg.gmailConnected) connected.push('gmail');
    if (cfg.outlookConnected) connected.push('outlook');
    if (cfg.icloudConnected) connected.push('icloud');
    return {
      outbox_pending: outbox.filter(function(m) {
        return m.status !== 'sent' && m.status !== 'failed' && m.status !== 'cancelled';
      }).length,
      sent_count: sent.length,
      providers_connected: connected,
      outbox_preview: outbox.slice(0, 5).map(function(m) {
        return { to: m.to, subject: m.subject, status: m.status, scheduled: m.scheduledAt };
      }),
      recent_sent: sent.slice(0, 5).map(function(m) {
        return { to: m.to, subject: m.subject, sentAt: m.sentAt };
      })
    };
  }

  // ─── People (brand-scoped clients OR life people) ────────────
  function _gatherPeople(life) {
    if (life) {
      var lp = _lsJSON('roweos_life_people', []);
      return {
        total: lp.length,
        sample: lp.slice(0, 15).map(function(p) {
          return { name: p.name, relation: p.relation || p.tier, last_contact: p.lastContact || null };
        })
      };
    }
    var people = _lsJSON('roweos_people', []);
    var clients = people.filter(function(p) { return p.personType === 'client'; });
    var bIdx = _activeBrandIdx();
    var current = clients.filter(function(c) {
      if (c.scope === 'universal') return true;
      if (c.brandIndex == null) return true;
      return String(c.brandIndex) === String(bIdx);
    });
    return {
      total_across_brands: clients.length,
      total_current_brand: current.length,
      by_stage: (function() {
        var m = {};
        current.forEach(function(c) {
          var s = c.stage || 'lead';
          m[s] = (m[s] || 0) + 1;
        });
        return m;
      })(),
      sample: current.slice(0, 15).map(function(c) {
        return {
          name: c.name,
          company: c.company || null,
          stage: c.stage || 'lead',
          email: c.email || null,
          deal_value: c.dealValue || null
        };
      })
    };
  }

  // ─── Notebooks (Scribe) ──────────────────────────────────────
  function _gatherNotebooks(includeContent) {
    var nb = _lsJSON('roweos_scribe_notebooks', []);
    var mode = _isLifeMode() ? 'lifeai' : 'brandai';
    var scoped = nb.filter(function(x) {
      if (!x.source) return true;
      return x.source === mode;
    });
    return {
      total: scoped.length,
      titles: scoped.slice(0, 25).map(function(n) {
        var out = { title: n.title || 'Untitled', modified: n._modifiedAt || n.updatedAt || null };
        if (includeContent && n.content) out.preview = _truncate(n.content, 800);
        return out;
      })
    };
  }

  // ─── Calendar ────────────────────────────────────────────────
  function _gatherCalendar() {
    var events = _lsJSON('roweos_calendar_events', []);
    var todayStr = new Date().toISOString().slice(0, 10);
    var today = events.filter(function(e) {
      var d = e.start || e.date;
      return d && String(d).slice(0, 10) === todayStr;
    });
    return {
      total: events.length,
      today_count: today.length,
      today: today.slice(0, 10).map(function(e) {
        return { title: e.title, start: e.start, end: e.end || null, location: e.location || null };
      })
    };
  }

  // ─── Bloom ───────────────────────────────────────────────────
  function _gatherBloom() {
    var lib = _lsJSON('roweos_bloom_library', {});
    var bIdx = _activeBrandIdx();
    var scope = _isLifeMode() ? ('life_' + _activeLifeIdx()) : ('brand_' + bIdx);
    var items = _safeArr(lib[scope]);
    return {
      saved_in_scope: items.length,
      total_scopes: Object.keys(lib).length,
      sample_titles: items.slice(0, 10).map(function(x) { return x.title || x.summary || ''; })
    };
  }

  // ─── Folio (visual artifacts) ────────────────────────────────
  function _gatherFolio() {
    var bIdx = _activeBrandIdx();
    var key = _isLifeMode() ? ('roweos_folio_items_life_' + _activeLifeIdx()) : ('roweos_folio_items_' + bIdx);
    var items = _lsJSON(key, []);
    return {
      total: items.length,
      sample: items.slice(0, 8).map(function(it) {
        return { title: it.title || it.prompt || '', type: it.type || 'image' };
      })
    };
  }

  // ─── Library / files ─────────────────────────────────────────
  function _gatherLibrary() {
    var bIdx = _activeBrandIdx();
    var key = _isLifeMode() ? 'roweos_life_library' : ('roweos_brand_library_' + bIdx);
    var lib = _lsJSON(key, []);
    return {
      file_count: _safeArr(lib).length,
      sample_names: _safeArr(lib).slice(0, 10).map(function(x) { return x.name || x.title || ''; })
    };
  }

  // ─── Studio (generated images + custom ops) ──────────────────
  function _gatherStudio() {
    var gallery = _lsJSON('roweos_auto_lab_images', []);
    var customOps = _lsJSON('roweos_custom_ops', []);
    var generated = _isLifeMode()
      ? _lsJSON('roweos_generated_life_ops', [])
      : _lsJSON('roweos_generated_brand_ops_' + _activeBrandIdx(), []);
    return {
      generated_image_count: _safeArr(gallery).length,
      custom_op_count: _safeArr(customOps).length,
      ai_generated_op_count: _safeArr(generated).length
    };
  }

  // ─── Conversations / chat history ────────────────────────────
  function _gatherConversations(includeContent) {
    var convs = _lsJSON('roweos_conversations', []);
    return {
      total: _safeArr(convs).length,
      recent: _safeArr(convs).slice(-10).reverse().map(function(c) {
        var out = { title: c.title || 'Conversation', when: c.lastUpdated || c._modifiedAt };
        if (includeContent && c.messages) {
          var lastMsg = c.messages[c.messages.length - 1];
          if (lastMsg) out.last_message = _truncate(typeof lastMsg.content === 'string' ? lastMsg.content : '', 200);
        }
        return out;
      })
    };
  }

  // ─── Inventory + commerce ────────────────────────────────────
  function _gatherCommerce() {
    var commerce = _lsJSON('roweos_commerce', { invoices: [], settings: {} }) || {};
    var inv = _lsJSON('roweos_inventory', { items: [] }) || {};
    var invoices = _lsJSON('roweos_invoices', []);
    var pending = _safeArr(invoices).filter(function(i) { return i.status === 'pending' || i.status === 'overdue'; });
    return {
      product_count: _safeArr(inv.items).length,
      invoice_count: _safeArr(invoices).length,
      outstanding_invoices: pending.length,
      outstanding_total: pending.reduce(function(s, i) { return s + (i.total || 0); }, 0),
      currency: (commerce.settings && commerce.settings.currency) || 'USD'
    };
  }

  // ─── Social ──────────────────────────────────────────────────
  function _gatherSocial() {
    var bIdx = _activeBrandIdx();
    var scopeSuffix = _isLifeMode() ? ('_life_' + _activeLifeIdx()) : ('_brand_' + bIdx);
    var platforms = ['x', 'instagram', 'threads', 'linkedin', 'facebook', 'tiktok'];
    var connected = platforms.filter(function(p) {
      return _ls('roweos_social_' + p + '_connected' + scopeSuffix) === 'true';
    });
    var sched = _lsJSON('roweos_social_scheduled' + scopeSuffix, []);
    return {
      connected_platforms: connected,
      scheduled_post_count: _safeArr(sched).length
    };
  }

  // ─── Evolve ──────────────────────────────────────────────────
  function _gatherEvolve() {
    var profile = _lsJSON('roweos_evolve_profile', {}) || {};
    var skills = _lsJSON('roweos_evolve_skills', []);
    return {
      xp: profile.xp || 0,
      streak: profile.streak || 0,
      level: profile.level || 1,
      tracked_skills: _safeArr(skills).length,
      goal: profile.goal || null
    };
  }

  // ─── Thought Board ───────────────────────────────────────────
  function _gatherThoughtBoard() {
    // v34.105: 43-thought-board.js writes to 'roweos_thought_board' (no _pins
    // suffix). The previous read of 'roweos_thought_board_pins' always
    // returned an empty array, so the AI never saw any pinned thoughts.
    var pins = _lsJSON('roweos_thought_board', []);
    return { pin_count: _safeArr(pins).length };
  }

  // ─── Sync / freshness / subscription ─────────────────────────
  function _gatherSystemState() {
    var lastSync = _ls('roweos_last_sync');
    return {
      last_sync_at: lastSync || null,
      sync_v5_reads: _ls('roweos_sync_v5_reads') === 'true',
      sync_v5_dual_write: _ls('roweos_sync_v5_dual_write') === 'true',
      sidebar_mode: _ls('roweos_sidebar_mode') || 'grouped',
      brilli_form: _ls('roweos_brilli_form') || 'celestial',
      access_key: _ls('roweos_access_key') ? 'present' : 'absent'
    };
  }

  // ─── PUBLIC: full snapshot ───────────────────────────────────
  function buildBrillianceKnowledgeContext(opts) {
    opts = opts || {};
    var includeContent = !!opts.includeContent;
    var maxBytes = opts.maxBytes || 60000;
    var life = _isLifeMode();

    var snapshot = {
      generated_at: new Date().toISOString(),
      identity: _gatherIdentity(life),
      pulse: _gatherPulse(),
      reminders: _gatherReminders(),
      automations: _gatherAutomations(),
      mail: _gatherMail(),
      people: _gatherPeople(life),
      notebooks: _gatherNotebooks(includeContent),
      calendar: _gatherCalendar(),
      bloom: _gatherBloom(),
      folio: _gatherFolio(),
      library: _gatherLibrary(),
      studio: _gatherStudio(),
      conversations: _gatherConversations(includeContent),
      commerce: life ? null : _gatherCommerce(),
      social: _gatherSocial(),
      evolve: _gatherEvolve(),
      thought_board: _gatherThoughtBoard(),
      system: _gatherSystemState()
    };

    var json;
    try { json = JSON.stringify(snapshot, null, 2); } catch (e) { json = '{}'; }

    // Soft budget — drop heaviest sections if over
    if (json.length > maxBytes) {
      delete snapshot.conversations;
      delete snapshot.notebooks;
      try { json = JSON.stringify(snapshot, null, 2); } catch (e) {}
    }
    if (json.length > maxBytes) {
      delete snapshot.studio;
      delete snapshot.folio;
      try { json = JSON.stringify(snapshot, null, 2); } catch (e) {}
    }

    return {
      snapshot: snapshot,
      json: json,
      approx_tokens: Math.ceil(json.length / 4),
      mode: life ? 'life' : 'brand'
    };
  }

  // ─── PUBLIC: capability manifest ─────────────────────────────
  function describeBrillianceCapabilities() {
    return [
      'You are Brilliance, a private intelligence operating system. You have full access to the user\'s brand and life data through the knowledge context block. Treat that data as authoritative current state.',
      '',
      'Surfaces you can reason about and reference by name:',
      '- Pulse (goals + items + reminders, the user\'s daily anchor)',
      '- Chat (BrandAI agents: Strategy, Marketing, Operations, Documents, Intelligence; LifeAI coaches: Life, Wellness, Tax, Personal)',
      '- Studio (image / video generation, deep research, split-pane workspace)',
      '- Folio (visual artifact lab)',
      '- Bloom (AI brand feed, saved seeds)',
      '- Library (files, knowledge base)',
      '- Notebooks / Scribe (long-form writing, knowledge capture)',
      '- Mail (Gmail / Outlook / iCloud, outbox, sent, scheduled)',
      '- Calendar (Google / Outlook / iCloud write-back)',
      '- Social (X, Instagram, Threads, LinkedIn, Facebook, TikTok scheduling)',
      '- Automations (scheduled tasks, multi-step pipelines, workflow presets)',
      '- People / Clients (pipeline stages, CRM)',
      '- Analytics (API spend, invoice tracking, commerce)',
      '- Identity (brand mission, voice, customers / life context, values)',
      '- History (full timeline of every conversation and Studio output)',
      '- Evolve (XP, streak, skill tracking, quiz / verifier engines)',
      '- Thought Board (pinboard for cross-surface ideation)',
      '- Settings (theme, Brilli form, sidebar mode, sync v5 flags, tier)',
      '',
      'Things you can DO when asked:',
      '- Capture goals / reminders / notes (single-line capture)',
      '- Compose / schedule emails (Outbox)',
      '- Generate images / videos (Studio, Folio)',
      '- Run automations and pipelines',
      '- Schedule social posts',
      '- Open any view (use slash commands or mention the view name)',
      '- Search / recall any past conversation, file, or artifact',
      '- Cycle Brilli form, switch theme, toggle Focus Mode',
      '',
      'Boundaries:',
      '- Never expose API keys, tokens, or access keys in responses.',
      '- Default to the active brand / life profile unless the user asks across all.',
      '- Never use em-dashes; use commas, periods, or rewrite.',
      '- If you don\'t see data in the snapshot, say so honestly. Don\'t hallucinate counts.',
      ''
    ].join('\n');
  }

  // ─── PUBLIC: heuristic for "needs full knowledge" ────────────
  function answerKnowsEverything(query) {
    if (!query) return false;
    var q = String(query).toLowerCase();
    var triggers = [
      'how many', 'how much', 'what do i have', 'what\'s on', 'whats on',
      'do i have', 'is there', 'are there', 'list all', 'show me all',
      'overdue', 'pending', 'scheduled', 'connected', 'today',
      'this week', 'this month', 'last', 'recent',
      'goals', 'reminders', 'automations', 'clients', 'people',
      'emails', 'mail', 'calendar', 'events', 'invoices', 'outstanding',
      'notebooks', 'notes', 'library', 'files', 'bloom', 'folio',
      'social', 'posts', 'studio', 'images', 'history',
      'know', 'data', 'status', 'summary', 'overview', 'state'
    ];
    for (var i = 0; i < triggers.length; i++) {
      if (q.indexOf(triggers[i]) !== -1) return true;
    }
    return false;
  }

  // ─── PUBLIC: build a system-prompt-ready preamble ────────────
  // Wraps the JSON snapshot + capability manifest into a single string
  // ready to prepend to ANY model call.
  function buildBrillianceSystemPreamble(opts) {
    var ctx = buildBrillianceKnowledgeContext(opts);
    return [
      describeBrillianceCapabilities(),
      '',
      '── KNOWLEDGE SNAPSHOT (current localStorage state, generated ' + ctx.snapshot.generated_at + ') ──',
      ctx.json,
      '── END SNAPSHOT ──',
      ''
    ].join('\n');
  }

  // Export to window
  if (typeof window !== 'undefined') {
    window.BrillianceKnowledge = {
      build: buildBrillianceKnowledgeContext,
      capabilities: describeBrillianceCapabilities,
      shouldAttach: answerKnowsEverything,
      preamble: buildBrillianceSystemPreamble
    };
    // Compatibility aliases for direct call sites
    window.buildBrillianceKnowledgeContext = buildBrillianceKnowledgeContext;
    window.buildBrillianceSystemPreamble = buildBrillianceSystemPreamble;
  }
})();
