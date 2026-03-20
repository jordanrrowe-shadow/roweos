# Universal Search Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic global search with a hybrid AI-powered Universal Search featuring a centered Spotlight modal (Cmd+K) and a right side panel (search bar + notifications), with 3 search layers: AI-powered, Navigation, and Actions.

**Architecture:** Build a core search engine (`executeSearch`) with three modes (AI, Navigate, Actions) that returns structured results. Wire it into two UIs: the existing Spotlight overlay (upgraded) and a new right side panel with Search/Notifications tabs. The side panel integrates with the existing notification system. Brand scoping filters results by current brand or all brands.

**Tech Stack:** Vanilla ES5 JavaScript, existing AI chat API functions, existing notification panel, single-file HTML app

**Spec:** `/Volumes/roweOS/docs/superpowers/specs/2026-03-19-universal-search-spec.md`

**Critical Constraints:**
- ES5 only (no arrow functions, let/const, template literals)
- All edits in `/Volumes/roweOS/RoweOS/dist/index.html`
- No emojis in UI -- SVG icons only
- No em-dashes in UI text

---

## File Structure

All changes in one file:
- **Modify:** `/Volumes/roweOS/RoweOS/dist/index.html`

Key existing locations:
| Function/Area | Line | Purpose |
|---------------|------|---------|
| Search overlay HTML | 58607-58630 | Upgrade to Spotlight UI |
| Notification panel HTML | 58632-58659 | Integrate with side panel |
| `openSearch()` / `closeSearch()` | 156775-156799 | Upgrade to Spotlight functions |
| `performGlobalSearch()` | 156801 | Replace with `executeSearch()` |
| Keyboard handler (Cmd+K) | 158270 | Keep, already wired |
| `callAnthropicChat()` | 79335 | Use for AI search |
| Notification functions | 158092-158116 | Wire into side panel |
| Mobile header (bell) | 46307 | Already exists |
| Desktop sidebar search btn | 47897 | Keep, wire to Spotlight |

---

## Chunk 1: Search Engine Core

### Task 1: Build `executeSearch()` Core Engine

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- near existing `performGlobalSearch()` (~line 156801)

- [ ] **Step 1: Add search state variables and the core function**

Insert BEFORE the existing `performGlobalSearch` function:

```javascript
// v25.2: Universal Search Engine
var _searchMode = 'ai'; // 'ai', 'navigate', 'actions'
var _searchScope = 'current'; // 'current' or 'all'
var _searchRecentKey = 'roweos_recent_searches';

function getSearchScope() {
  if (_searchScope === 'all') return { brands: brands, label: 'All Brands' };
  var idx = selectedBrand || 0;
  return { brands: brands[idx] ? [brands[idx]] : brands, brandIdx: idx, label: (brands[idx] || {}).shortName || (brands[idx] || {}).name || 'Current Brand' };
}

function addRecentSearch(query) {
  if (!query || query.trim().length < 2) return;
  var recent = [];
  try { recent = JSON.parse(localStorage.getItem(_searchRecentKey) || '[]'); } catch(e) {}
  recent = recent.filter(function(r) { return r !== query; });
  recent.unshift(query);
  if (recent.length > 10) recent = recent.slice(0, 10);
  localStorage.setItem(_searchRecentKey, JSON.stringify(recent));
}

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(_searchRecentKey) || '[]'); } catch(e) { return []; }
}

function executeSearch(query, mode, callback) {
  if (!query || query.trim().length === 0) { callback([]); return; }
  query = query.trim();
  addRecentSearch(query);
  mode = mode || _searchMode;

  if (mode === 'ai') {
    searchWithAI(query, function(aiResults) {
      // Also include navigation results as fallback
      var navResults = searchNavigate(query);
      callback({ ai: aiResults, nav: navResults.slice(0, 4) });
    });
  } else if (mode === 'actions') {
    var actionResults = searchActions(query);
    var navResults = searchNavigate(query);
    callback({ actions: actionResults, nav: navResults.slice(0, 4) });
  } else {
    var navResults = searchNavigate(query);
    callback({ nav: navResults });
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(search): add executeSearch core engine with mode/scope support v25.2"
```

---

### Task 2: Build `searchNavigate()` -- Fuzzy Navigation Search

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- after `executeSearch()`

- [ ] **Step 1: Add fuzzy matching and navigation search**

```javascript
function fuzzyMatch(text, query) {
  if (!text || !query) return false;
  text = text.toLowerCase();
  query = query.toLowerCase();
  // Substring match
  if (text.indexOf(query) !== -1) return true;
  // Word-boundary match (each query word appears somewhere)
  var words = query.split(/\s+/);
  var allFound = true;
  for (var w = 0; w < words.length; w++) {
    if (text.indexOf(words[w]) === -1) { allFound = false; break; }
  }
  return allFound;
}

function searchNavigate(query) {
  var results = [];
  var q = query.toLowerCase().trim();
  var scope = getSearchScope();

  // 1. Features/Views
  var views = [
    { name: 'BrandAI', view: 'signal', icon: 'chat', desc: 'AI-powered brand assistant' },
    { name: 'Focus', view: 'signal', section: 'focus', icon: 'focus', desc: 'Tasks, calendar, and daily planning' },
    { name: 'Bloom', view: 'bloom', icon: 'bloom', desc: 'AI content feed' },
    { name: 'Pulse', view: 'pulse', icon: 'pulse', desc: 'Goals and progress tracking' },
    { name: 'Studio', view: 'studio', icon: 'studio', desc: 'Content creation workspace' },
    { name: 'Mail', view: 'mail', icon: 'mail', desc: 'Email composition and management' },
    { name: 'Rhythm', view: 'rhythm', icon: 'rhythm', desc: 'Calendar and scheduling' },
    { name: 'Library', view: 'library', icon: 'library', desc: 'Files and documents' },
    { name: 'Automations', view: 'automations', icon: 'automations', desc: 'Workflows and pipelines' },
    { name: 'Identity', view: 'identity', icon: 'identity', desc: 'Brand voice and identity' },
    { name: 'Clients', view: 'clients', icon: 'clients', desc: 'Contacts and CRM' },
    { name: 'Settings', view: 'settings', icon: 'settings', desc: 'App configuration' },
    { name: 'Sync', view: 'sync', icon: 'sync', desc: 'Cloud sync and backup' },
    { name: 'Analytics', view: 'analytics', icon: 'analytics', desc: 'Usage and performance' }
  ];
  for (var vi = 0; vi < views.length; vi++) {
    if (fuzzyMatch(views[vi].name + ' ' + views[vi].desc, q)) {
      results.push({ type: 'feature', title: views[vi].name, desc: views[vi].desc, action: function(v) { return function() { showView(v.view); if (v.section) showScreen(v.section); }; }(views[vi]) });
    }
  }

  // 2. Brands
  for (var bi = 0; bi < brands.length; bi++) {
    var b = brands[bi];
    var bText = (b.name || '') + ' ' + (b.shortName || '') + ' ' + (b.tagline || '') + ' ' + (b.industry || '');
    if (fuzzyMatch(bText, q)) {
      results.push({ type: 'brand', title: b.shortName || b.name, desc: b.tagline || b.industry || 'Brand', action: function(idx) { return function() { selectedBrand = idx; localStorage.setItem('roweos_selected_brand', String(idx)); if (typeof applyCurrentBrandAccent === 'function') applyCurrentBrandAccent(); showView('signal'); }; }(bi) });
    }
  }

  // 3. Clients
  try {
    var clients = JSON.parse(localStorage.getItem('roweos_clients') || '[]');
    for (var ci = 0; ci < clients.length; ci++) {
      var c = clients[ci];
      if (fuzzyMatch((c.name || '') + ' ' + (c.company || '') + ' ' + (c.email || ''), q)) {
        results.push({ type: 'client', title: c.name || 'Client', desc: c.company || c.email || '', action: function() { showView('clients'); } });
      }
    }
  } catch(e) {}

  // 4. Automations
  try {
    var autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    for (var ai2 = 0; ai2 < autos.length; ai2++) {
      var a = autos[ai2];
      if (fuzzyMatch(a.name || '', q)) {
        results.push({ type: 'automation', title: a.name, desc: 'Automation', action: function() { showView('automations'); } });
      }
    }
  } catch(e) {}

  // 5. Pulse goals
  try {
    var goals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    for (var gi = 0; gi < goals.length; gi++) {
      var g = goals[gi];
      if (fuzzyMatch(g.name || '', q)) {
        results.push({ type: 'goal', title: g.name, desc: 'Pulse Goal', action: function() { showView('pulse'); } });
      }
    }
  } catch(e) {}

  // 6. Calendar events
  try {
    var cal = JSON.parse(localStorage.getItem('roweos_calendar') || '[]');
    for (var ei = 0; ei < Math.min(cal.length, 50); ei++) {
      if (fuzzyMatch(cal[ei].title || '', q)) {
        results.push({ type: 'event', title: cal[ei].title, desc: (cal[ei].date || '') + ' ' + (cal[ei].time || ''), action: function() { showView('rhythm'); } });
      }
    }
  } catch(e) {}

  // 7. Library items
  try {
    var lib = JSON.parse(localStorage.getItem('roweosLibrary') || '{}');
    if (lib.files) {
      for (var fi = 0; fi < lib.files.length; fi++) {
        if (fuzzyMatch(lib.files[fi].name || '', q)) {
          results.push({ type: 'file', title: lib.files[fi].name, desc: 'Library', action: function() { showView('library'); } });
        }
      }
    }
  } catch(e) {}

  return results.slice(0, 20);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(search): add searchNavigate with fuzzy matching across all data v25.2"
```

---

### Task 3: Build `searchActions()` -- Command Pattern Matching

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- after `searchNavigate()`

- [ ] **Step 1: Add action pattern matching**

```javascript
function searchActions(query) {
  var results = [];
  var q = query.toLowerCase().trim();

  // Pattern: "new email to {name}" or "email {name}"
  var emailMatch = q.match(/^(?:new )?(?:email|mail|compose|write)(?: to)? (.+)/i);
  if (emailMatch) {
    var recipient = emailMatch[1].trim();
    results.push({ type: 'action', title: 'Compose email to ' + recipient, desc: 'Opens Mail composer', action: function() { showView('mail'); if (typeof showMailTab === 'function') showMailTab('compose'); } });
  }

  // Pattern: "run {automation}" or "execute {automation}"
  var runMatch = q.match(/^(?:run|execute|start|trigger) (.+)/i);
  if (runMatch) {
    var autoName = runMatch[1].trim();
    try {
      var autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
      for (var i = 0; i < autos.length; i++) {
        if (fuzzyMatch(autos[i].name || '', autoName)) {
          results.push({ type: 'action', title: 'Run "' + autos[i].name + '"', desc: 'Execute automation', action: function(auto) { return function() { if (typeof runAutomationNow === 'function') runAutomationNow(auto); }; }(autos[i]) });
        }
      }
    } catch(e) {}
  }

  // Pattern: "add goal {text}" or "new goal {text}"
  var goalMatch = q.match(/^(?:add|new|create) (?:goal|pulse goal) (.+)/i);
  if (goalMatch) {
    var goalText = goalMatch[1].trim();
    results.push({ type: 'action', title: 'Add Pulse goal: "' + goalText + '"', desc: 'Creates a new goal', action: function() { showView('pulse'); } });
  }

  // Pattern: "new task {text}" or "add task {text}"
  var taskMatch = q.match(/^(?:add|new|create) (?:task|todo|focus) (.+)/i);
  if (taskMatch) {
    results.push({ type: 'action', title: 'Add Focus task: "' + taskMatch[1].trim() + '"', desc: 'Creates a new task', action: function() { showView('signal'); if (typeof showScreen === 'function') showScreen('focus'); } });
  }

  // Pattern: "open {feature}"
  var openMatch = q.match(/^(?:open|go to|show|switch to) (.+)/i);
  if (openMatch) {
    var navResults = searchNavigate(openMatch[1]);
    for (var ni = 0; ni < Math.min(navResults.length, 3); ni++) {
      navResults[ni].type = 'action';
      navResults[ni].title = 'Open ' + navResults[ni].title;
      results.push(navResults[ni]);
    }
  }

  // Pattern: "new automation" or "create automation"
  if (/^(?:new|create|add) automation/i.test(q)) {
    results.push({ type: 'action', title: 'Create new automation', desc: 'Opens automation builder', action: function() { showView('automations'); } });
  }

  return results;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(search): add searchActions with command pattern matching v25.2"
```

---

### Task 4: Build `searchWithAI()` -- AI-Powered Search

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- after `searchActions()`

- [ ] **Step 1: Add AI search function**

```javascript
function searchWithAI(query, callback) {
  var scope = getSearchScope();
  var brandName = scope.brands[0] ? (scope.brands[0].shortName || scope.brands[0].name) : 'RoweOS';

  // Build context summary for AI
  var context = 'You are a search assistant for RoweOS, a brand intelligence platform. ';
  context += 'Current brand: ' + brandName + '. ';

  // Add data summaries
  try {
    var goals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    if (goals.length > 0) context += 'Pulse goals: ' + goals.map(function(g) { return g.name; }).join(', ') + '. ';
  } catch(e) {}
  try {
    var autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    if (autos.length > 0) context += 'Automations: ' + autos.map(function(a) { return a.name; }).join(', ') + '. ';
  } catch(e) {}
  try {
    var clients = JSON.parse(localStorage.getItem('roweos_clients') || '[]');
    if (clients.length > 0) context += 'Clients: ' + clients.slice(0, 10).map(function(c) { return c.name + (c.company ? ' (' + c.company + ')' : ''); }).join(', ') + '. ';
  } catch(e) {}
  try {
    var sent = JSON.parse(localStorage.getItem('roweos_mail_sent') || '[]');
    if (sent.length > 0) context += 'Recent sent emails: ' + sent.slice(0, 5).map(function(m) { return '"' + (m.subject || 'No subject') + '" to ' + (m.to || 'unknown'); }).join(', ') + '. ';
  } catch(e) {}

  var systemPrompt = context + 'Answer the user\'s search query concisely. If they ask about their data (goals, emails, clients, automations), reference the specific items. Keep responses under 150 words. Never use em-dashes. Use plain language.';

  // Get API settings
  var brandIdx = selectedBrand || 0;
  var provider = 'anthropic';
  var model = 'claude-sonnet-4-6';
  var apiKey = '';
  try {
    var bSettings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
    provider = bSettings.provider || 'anthropic';
    model = bSettings.model || 'claude-sonnet-4-6';
    apiKey = getApiKey(provider);
    if (provider === 'roweos' && typeof resolveRoweOSAI === 'function') {
      var resolved = resolveRoweOSAI({ userMessage: query, systemPrompt: systemPrompt });
      provider = resolved.provider;
      model = resolved.model;
      apiKey = resolved.apiKey || getApiKey(resolved.provider);
    }
  } catch(e) {}

  if (!apiKey) {
    callback({ text: 'No API key configured. Switch to Navigate mode for local search.', results: [] });
    return;
  }

  var messages = [{ role: 'user', content: query }];

  if (typeof callAnthropicChat === 'function' && provider === 'anthropic') {
    callAnthropicChat(model, apiKey, messages, systemPrompt, function(response) {
      callback({ text: response, results: [] });
    }, function(err) {
      callback({ text: 'Search failed. Try Navigate mode.', results: [] });
    });
  } else if (typeof callOpenAIChat === 'function' && provider === 'openai') {
    callOpenAIChat(model, apiKey, messages, systemPrompt, function(response) {
      callback({ text: response, results: [] });
    }, function(err) {
      callback({ text: 'Search failed. Try Navigate mode.', results: [] });
    });
  } else {
    // Fallback to navigate
    callback({ text: null, results: searchNavigate(query) });
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(search): add searchWithAI for AI-powered search queries v25.2"
```

---

## Chunk 2: Spotlight UI (Upgrade Existing Overlay)

### Task 5: Upgrade Spotlight Overlay HTML + CSS

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- search overlay (~line 58607) and CSS

- [ ] **Step 1: Add new Spotlight CSS**

Find the existing `.search-overlay` CSS. Add/replace with upgraded styles:

```css
/* v25.2: Universal Search Spotlight */
.search-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.65);display:none;align-items:flex-start;justify-content:center;padding-top:15vh;z-index:9998; }
.search-overlay.active { display:flex; }
.search-container { width:90%;max-width:540px;background:var(--bg-primary,#141414);border:1px solid var(--border-color,#2a2a2a);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.8);overflow:hidden; }
.search-input-wrapper { display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border-color,#222); }
.search-icon { width:18px;height:18px;color:var(--accent,#a89878);flex-shrink:0; }
.search-input { flex:1;background:none;border:none;color:var(--text-primary,#f4f4f5);font-size:15px;outline:none; }
.search-input::placeholder { color:var(--text-tertiary,#555); }
.search-kbd { color:var(--text-tertiary,#555);font-size:10px;border:1px solid var(--border-color,#333);padding:2px 6px;border-radius:4px;flex-shrink:0; }
.search-mode-bar { display:flex;gap:6px;padding:8px 18px;border-bottom:1px solid var(--border-color,#1a1a1a); }
.search-mode-btn { font-size:10px;padding:3px 10px;border-radius:10px;border:1px solid var(--border-color,#333);background:none;color:var(--text-tertiary,#666);cursor:pointer;transition:all 0.15s; }
.search-mode-btn.active { background:var(--accent,#a89878);color:#000;border-color:var(--accent,#a89878);font-weight:600; }
.search-scope-bar { display:flex;align-items:center;gap:8px;padding:6px 18px;border-bottom:1px solid var(--border-color,#1a1a1a);font-size:11px; }
.search-scope-toggle { background:none;border:1px solid var(--border-color,#333);border-radius:6px;padding:2px 8px;color:var(--text-secondary,#888);cursor:pointer;font-size:10px; }
.search-scope-toggle:hover { border-color:var(--accent,#a89878); }
.search-results { max-height:360px;overflow-y:auto;padding:6px 0; }
.search-result-group { padding:4px 18px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-tertiary,#555); }
.search-result-item { padding:10px 18px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.1s; }
.search-result-item:hover, .search-result-item.highlighted { background:var(--bg-secondary,#1a1a1a); }
.search-result-icon { width:16px;height:16px;color:var(--text-tertiary,#555);flex-shrink:0; }
.search-result-title { font-size:13px;color:var(--text-primary,#e4e4e5); }
.search-result-desc { font-size:11px;color:var(--text-tertiary,#555);margin-left:auto;flex-shrink:0; }
.search-result-type { font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-tertiary,#444);background:var(--bg-tertiary,#222);padding:1px 6px;border-radius:4px;flex-shrink:0; }
.search-ai-response { padding:14px 18px;border-bottom:1px solid var(--border-color,#1a1a1a); }
.search-ai-header { display:flex;align-items:center;gap:6px;margin-bottom:8px; }
.search-ai-avatar { width:18px;height:18px;background:var(--accent,#a89878);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#000;font-weight:700; }
.search-ai-label { font-size:11px;color:var(--accent,#a89878);font-weight:600; }
.search-ai-text { font-size:13px;color:var(--text-secondary,#999);line-height:1.6; }
.search-ai-panel-link { font-size:11px;color:var(--accent,#a89878);cursor:pointer;margin-top:8px;display:inline-block; }
.search-footer { padding:8px 18px;border-top:1px solid var(--border-color,#1a1a1a);display:flex;gap:16px; }
.search-footer-hint { font-size:10px;color:var(--text-tertiary,#444); }
.search-recent-item { padding:8px 18px;cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--text-tertiary,#666);font-size:13px; }
.search-recent-item:hover { background:var(--bg-secondary,#1a1a1a);color:var(--text-secondary,#999); }
.search-empty { padding:24px;text-align:center;color:var(--text-tertiary,#555);font-size:13px; }
```

- [ ] **Step 2: Replace the search overlay HTML**

Find the existing search overlay HTML at line ~58607. Replace the entire `<div id="searchOverlay"...>...</div>` with:

```html
<div id="searchOverlay" class="search-overlay" onclick="if(event.target===this)closeSpotlight()">
  <div class="search-container">
    <div class="search-input-wrapper">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="text" class="search-input" id="spotlightInput" placeholder="Search or ask anything..." oninput="onSpotlightInput(this.value)" onkeydown="onSpotlightKeydown(event)" autofocus>
      <span class="search-kbd">ESC</span>
    </div>
    <div class="search-mode-bar">
      <button class="search-mode-btn active" data-mode="ai" onclick="setSearchMode('ai',this)">AI</button>
      <button class="search-mode-btn" data-mode="navigate" onclick="setSearchMode('navigate',this)">Navigate</button>
      <button class="search-mode-btn" data-mode="actions" onclick="setSearchMode('actions',this)">Actions</button>
    </div>
    <div class="search-scope-bar">
      <span style="color:var(--text-tertiary)">Scope:</span>
      <button class="search-scope-toggle" id="spotlightScopeBtn" onclick="toggleSearchScope()"></button>
    </div>
    <div class="search-results" id="spotlightResults">
      <div class="search-empty" id="spotlightEmpty">Type to search across all of RoweOS</div>
    </div>
    <div class="search-footer">
      <span class="search-footer-hint">Up/Down Navigate</span>
      <span class="search-footer-hint">Enter Open</span>
      <span class="search-footer-hint">Tab Switch mode</span>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(search): upgrade Spotlight overlay HTML + CSS v25.2"
```

---

### Task 6: Build Spotlight UI Functions

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- replace `openSearch()`/`closeSearch()`/`performGlobalSearch()`

- [ ] **Step 1: Replace the existing search functions**

Find `function openSearch()` (~line 156775). Replace `openSearch`, `closeSearch`, and `performGlobalSearch` with:

```javascript
// v25.2: Spotlight functions (replace old openSearch/closeSearch/performGlobalSearch)
var _spotlightHighlight = -1;
var _spotlightResults = [];
var _spotlightDebounce = null;

function openSpotlight() {
  var overlay = document.getElementById('searchOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(function() {
    var input = document.getElementById('spotlightInput');
    if (input) { input.focus(); input.value = ''; }
    // Show recent searches
    showRecentSearches();
    updateScopeButton();
  }, 50);
  _spotlightHighlight = -1;
  _spotlightResults = [];
}
// Keep backward compat
var openSearch = openSpotlight;

function closeSpotlight() {
  var overlay = document.getElementById('searchOverlay');
  if (overlay) { overlay.style.display = 'none'; document.body.style.overflow = ''; }
}
var closeSearch = closeSpotlight;

function showRecentSearches() {
  var container = document.getElementById('spotlightResults');
  if (!container) return;
  var recent = getRecentSearches();
  if (recent.length === 0) {
    container.innerHTML = '<div class="search-empty">Type to search across all of RoweOS</div>';
    return;
  }
  var html = '<div class="search-result-group">Recent</div>';
  for (var i = 0; i < recent.length; i++) {
    html += '<div class="search-recent-item" onclick="document.getElementById(\'spotlightInput\').value=this.textContent.trim();onSpotlightInput(this.textContent.trim())">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
      + escapeHtml(recent[i]) + '</div>';
  }
  container.innerHTML = html;
}

function updateScopeButton() {
  var btn = document.getElementById('spotlightScopeBtn');
  if (!btn) return;
  var scope = getSearchScope();
  btn.textContent = scope.label;
}

function toggleSearchScope() {
  _searchScope = _searchScope === 'current' ? 'all' : 'current';
  updateScopeButton();
  var input = document.getElementById('spotlightInput');
  if (input && input.value.trim()) onSpotlightInput(input.value);
}

function setSearchMode(mode, btn) {
  _searchMode = mode;
  var btns = document.querySelectorAll('.search-mode-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  if (btn) btn.classList.add('active');
  var input = document.getElementById('spotlightInput');
  if (input && input.value.trim()) onSpotlightInput(input.value);
}

function onSpotlightInput(value) {
  if (_spotlightDebounce) clearTimeout(_spotlightDebounce);
  _spotlightDebounce = setTimeout(function() {
    if (!value || value.trim().length === 0) { showRecentSearches(); return; }
    executeSearch(value, _searchMode, function(results) {
      renderSpotlightResults(results);
    });
  }, 200);
}

function onSpotlightKeydown(e) {
  if (e.key === 'Escape') { closeSpotlight(); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    var modes = ['ai', 'navigate', 'actions'];
    var idx = modes.indexOf(_searchMode);
    var next = modes[(idx + 1) % modes.length];
    var btn = document.querySelector('.search-mode-btn[data-mode="' + next + '"]');
    setSearchMode(next, btn);
    return;
  }
  var items = document.querySelectorAll('#spotlightResults .search-result-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _spotlightHighlight = Math.min(_spotlightHighlight + 1, items.length - 1);
    highlightSpotlightItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _spotlightHighlight = Math.max(_spotlightHighlight - 1, -1);
    highlightSpotlightItem(items);
  } else if (e.key === 'Enter') {
    if (_spotlightHighlight >= 0 && _spotlightHighlight < _spotlightResults.length) {
      var result = _spotlightResults[_spotlightHighlight];
      if (result && typeof result.action === 'function') { result.action(); closeSpotlight(); }
    }
  }
}

function highlightSpotlightItem(items) {
  for (var i = 0; i < items.length; i++) {
    items[i].classList.toggle('highlighted', i === _spotlightHighlight);
  }
}

function renderSpotlightResults(data) {
  var container = document.getElementById('spotlightResults');
  if (!container) return;
  _spotlightResults = [];
  _spotlightHighlight = -1;
  var html = '';

  // AI response
  if (data.ai && data.ai.text) {
    var mode = _bloomSource && _bloomSource.indexOf('life_') === 0 ? 'LifeAI' : 'BrandAI';
    html += '<div class="search-ai-response">'
      + '<div class="search-ai-header">'
      + '<div class="search-ai-avatar">' + mode.charAt(0) + '</div>'
      + '<span class="search-ai-label">' + mode + '</span>'
      + '</div>'
      + '<div class="search-ai-text">' + escapeHtml(data.ai.text).substring(0, 300) + '</div>'
      + '</div>';
  }

  // Navigation results
  var navItems = data.nav || [];
  var actionItems = data.actions || [];
  var allItems = actionItems.concat(navItems);

  if (allItems.length > 0) {
    var groupLabel = actionItems.length > 0 ? 'Actions' : 'Results';
    html += '<div class="search-result-group">' + groupLabel + '</div>';
    for (var i = 0; i < Math.min(allItems.length, 6); i++) {
      var item = allItems[i];
      _spotlightResults.push(item);
      var typeLabel = item.type || 'result';
      html += '<div class="search-result-item" onclick="_spotlightResults[' + (_spotlightResults.length - 1) + '].action();closeSpotlight()">'
        + '<span class="search-result-type">' + typeLabel + '</span>'
        + '<span class="search-result-title">' + escapeHtml(item.title) + '</span>'
        + '<span class="search-result-desc">' + escapeHtml(item.desc || '') + '</span>'
        + '</div>';
    }
  }

  if (!html) html = '<div class="search-empty">No results found</div>';
  container.innerHTML = html;
}

// Keep backward compat
function performGlobalSearch(q) { onSpotlightInput(q); }
```

- [ ] **Step 2: Update the Cmd+K handler**

Find the keyboard handler at ~line 158270. It already calls `openSearch()` which is now aliased to `openSpotlight()`. No changes needed.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(search): Spotlight UI functions with keyboard nav, modes, scope toggle v25.2"
```

---

## Chunk 3: Side Panel

### Task 7: Build Search Side Panel

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- near notification panel HTML + CSS

- [ ] **Step 1: Add side panel CSS**

Find existing `.nc-panel` CSS (notification center). Add nearby:

```css
/* v25.2: Search Side Panel */
.search-side-panel { position:fixed;top:0;right:-380px;bottom:0;width:360px;background:var(--bg-primary,#111);border-left:1px solid var(--border-color,#2a2a2a);z-index:9997;display:flex;flex-direction:column;transition:right 0.25s ease;box-shadow:-4px 0 20px rgba(0,0,0,0.4); }
.search-side-panel.open { right:0; }
.search-side-tabs { display:flex;border-bottom:1px solid var(--border-color,#222); }
.search-side-tab { flex:1;padding:12px;text-align:center;font-size:12px;color:var(--text-tertiary,#555);cursor:pointer;border-bottom:2px solid transparent;transition:all 0.15s; }
.search-side-tab.active { color:var(--accent,#a89878);border-bottom-color:var(--accent,#a89878);font-weight:600; }
.search-side-tab .tab-badge { background:var(--accent,#a89878);color:#000;font-size:8px;padding:1px 5px;border-radius:8px;font-weight:700;margin-left:4px;vertical-align:1px; }
.search-side-input { padding:12px;border-bottom:1px solid var(--border-color,#1a1a1a); }
.search-side-input input { width:100%;padding:9px 12px;background:var(--bg-secondary,#0d0d0d);border:1px solid var(--border-color,#333);border-radius:8px;color:var(--text-primary,#f4f4f5);font-size:13px;box-sizing:border-box; }
.search-side-input input:focus { border-color:var(--accent,#a89878);outline:none; }
.search-side-content { flex:1;overflow-y:auto;padding:12px; }
.search-side-close { position:absolute;top:12px;right:12px;background:none;border:none;color:var(--text-tertiary,#555);cursor:pointer;padding:4px; }
.search-side-scrim { position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:9996;display:none; }
.search-side-scrim.open { display:block; }
@media (max-width:768px) { .search-side-panel { width:100%;right:-100%; } }
```

- [ ] **Step 2: Add side panel HTML**

Find a suitable place after the search overlay HTML (~line 58630). Add:

```html
<!-- v25.2: Search Side Panel -->
<div class="search-side-scrim" id="searchSideScrim" onclick="closeSearchPanel()"></div>
<div class="search-side-panel" id="searchSidePanel">
  <button class="search-side-close" onclick="closeSearchPanel()">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
  </button>
  <div class="search-side-tabs">
    <div class="search-side-tab active" data-tab="search" onclick="switchSidePanelTab('search',this)">Search</div>
    <div class="search-side-tab" data-tab="notifications" onclick="switchSidePanelTab('notifications',this)">Notifications <span class="tab-badge" id="sidePanelBadge" style="display:none">0</span></div>
  </div>
  <div id="sidePanelSearchView">
    <div class="search-side-input">
      <input type="text" id="sidePanelSearchInput" placeholder="Search or ask anything..." oninput="onSidePanelSearch(this.value)">
    </div>
    <div class="search-side-content" id="sidePanelResults"></div>
  </div>
  <div id="sidePanelNotificationsView" style="display:none;flex:1;overflow-y:auto;">
  </div>
</div>
```

- [ ] **Step 3: Add side panel JS functions**

```javascript
// v25.2: Search Side Panel
function openSearchPanel(tab) {
  var panel = document.getElementById('searchSidePanel');
  var scrim = document.getElementById('searchSideScrim');
  if (panel) panel.classList.add('open');
  if (scrim) scrim.classList.add('open');
  if (tab === 'notifications') {
    switchSidePanelTab('notifications', document.querySelector('.search-side-tab[data-tab="notifications"]'));
  } else {
    switchSidePanelTab('search', document.querySelector('.search-side-tab[data-tab="search"]'));
    setTimeout(function() {
      var input = document.getElementById('sidePanelSearchInput');
      if (input) input.focus();
    }, 100);
  }
}

function closeSearchPanel() {
  var panel = document.getElementById('searchSidePanel');
  var scrim = document.getElementById('searchSideScrim');
  if (panel) panel.classList.remove('open');
  if (scrim) scrim.classList.remove('open');
}

function switchSidePanelTab(tab, btn) {
  var tabs = document.querySelectorAll('.search-side-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  if (btn) btn.classList.add('active');
  var searchView = document.getElementById('sidePanelSearchView');
  var notiView = document.getElementById('sidePanelNotificationsView');
  if (tab === 'search') {
    if (searchView) searchView.style.display = '';
    if (notiView) notiView.style.display = 'none';
  } else {
    if (searchView) searchView.style.display = 'none';
    if (notiView) { notiView.style.display = ''; notiView.style.flex = '1'; }
    renderSidePanelNotifications();
  }
}

var _sidePanelDebounce = null;
function onSidePanelSearch(value) {
  if (_sidePanelDebounce) clearTimeout(_sidePanelDebounce);
  _sidePanelDebounce = setTimeout(function() {
    if (!value || value.trim().length === 0) {
      var container = document.getElementById('sidePanelResults');
      if (container) container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;">Search across all of RoweOS</div>';
      return;
    }
    executeSearch(value, 'ai', function(results) {
      renderSidePanelResults(results);
    });
  }, 300);
}

function renderSidePanelResults(data) {
  var container = document.getElementById('sidePanelResults');
  if (!container) return;
  var html = '';

  if (data.ai && data.ai.text) {
    var mode = _bloomSource && _bloomSource.indexOf('life_') === 0 ? 'LifeAI' : 'BrandAI';
    html += '<div style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">'
      + '<div style="width:20px;height:20px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#000;font-weight:700;">' + mode.charAt(0) + '</div>'
      + '<span style="font-size:11px;color:var(--accent);font-weight:600;">' + mode + '</span></div>'
      + '<div style="font-size:13px;color:var(--text-secondary);line-height:1.7;">' + escapeHtml(data.ai.text) + '</div>'
      + '</div>';
  }

  var navItems = data.nav || [];
  var actionItems = data.actions || [];
  var allItems = actionItems.concat(navItems);
  if (allItems.length > 0) {
    for (var i = 0; i < allItems.length; i++) {
      var item = allItems[i];
      html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:10px 12px;margin-bottom:6px;cursor:pointer;" onclick="closeSearchPanel();'
        + (item.action ? '_sidePanelActions[' + i + ']()' : '') + '">'
        + '<div style="font-size:12px;color:var(--text-primary);">' + escapeHtml(item.title) + '</div>'
        + '<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;">' + escapeHtml(item.desc || '') + '</div>'
        + '</div>';
    }
    window._sidePanelActions = allItems.map(function(item) { return item.action; });
  }

  if (!html) html = '<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;">No results found</div>';
  container.innerHTML = html;
}

function renderSidePanelNotifications() {
  var container = document.getElementById('sidePanelNotificationsView');
  if (!container) return;
  // Reuse existing notification panel content
  var ncPanel = document.getElementById('notificationCenterPanel');
  if (ncPanel) {
    container.innerHTML = ncPanel.innerHTML;
  } else {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:13px;">No notifications</div>';
  }
}
```

- [ ] **Step 4: Wire the notification bell to open the side panel**

Find `toggleNotificationPanel` (~line 158097). Add a check: if on desktop, open search side panel to notifications tab instead:

Search for `function toggleNotificationPanel` and add at the top:

```javascript
  // v25.2: On desktop, use search side panel instead
  if (window.innerWidth > 768) {
    var panel = document.getElementById('searchSidePanel');
    if (panel && panel.classList.contains('open')) { closeSearchPanel(); return; }
    openSearchPanel('notifications');
    return;
  }
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(search): add Search Side Panel with notifications tab v25.2"
```

---

### Task 8: Add Top Bar Search Input + Deploy

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- top nav area

- [ ] **Step 1: Find the desktop top bar / breadcrumb area**

Search for the breadcrumb navigation area. Look for `Home >` or the navigation path. There may already be a top header bar. If not, we'll add a search trigger near the sidebar search button.

Find the sidebar search button at ~line 47897. After it, or in a prominent top-bar location, add a compact search input trigger that opens the side panel:

This is highly dependent on the existing layout. Search for a suitable location and add:

```html
<div style="display:flex;align-items:center;gap:6px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:5px 12px;cursor:pointer;min-width:160px;" onclick="openSearchPanel('search')">
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
  <span style="font-size:11px;color:var(--text-tertiary);">Search...</span>
  <span style="margin-left:auto;font-size:9px;color:var(--text-tertiary);border:1px solid var(--border-color);padding:1px 4px;border-radius:3px;">&#8984;K</span>
</div>
```

- [ ] **Step 2: Deploy**

```bash
cd /Volumes/roweOS && bash deploy.sh
```

- [ ] **Step 3: Final commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(search): Universal Search complete -- Spotlight + Side Panel + AI/Navigate/Actions v25.2

Hybrid search with Cmd+K Spotlight modal and right side panel.
3 search modes: AI-powered (BrandAI/LifeAI), Navigation (fuzzy),
Actions (command patterns). Brand scoping. Recent searches.
Keyboard navigation. Notification tab in side panel.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
