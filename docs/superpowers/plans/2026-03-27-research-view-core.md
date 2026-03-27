# Research View Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Research view that lets users run the advanced web search pipeline on any URL, see visual results, and take action on them (save to identity, chat, library, folio, or copy).

**Architecture:** Add a new `researchView` to the single-page app. Reuse the existing 5-stage web search pipeline and WebSearchVisualizer. Add research history with localStorage + Firebase sync. Wire entry points from Identity view and Studio. Bump version to v27.0.

**Tech Stack:** Vanilla JS (ES5), HTML, CSS, Firebase Firestore, localStorage

**File:** All changes in `/Volumes/roweOS/RoweOS/dist/index.html`

**Spec:** `docs/superpowers/specs/2026-03-27-research-view-core-design.md`

---

### Task 1: Version bump to v27.0

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Update display version strings**

Find line ~47399:
```html
<div class="mobile-version" id="mobileVersionDisplay">RoweOS v24.26</div>
```
Replace `v24.26` with `v27.0`.

Find line ~49855:
```html
<p>RoweOS v24.26 -- Built for the future</p>
```
Replace `v24.26` with `v27.0`.

- [ ] **Step 2: Update ROWEOS_VERSION constant**

Find line ~62926:
```js
var ROWEOS_VERSION = '12.0.4';
```
Replace with:
```js
var ROWEOS_VERSION = '27.0';
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "chore: bump version to v27.0"
```

---

### Task 2: Add Research view HTML structure

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add the researchView div**

Find the `folioView` div (search for `id="folioView"`). After the **closing** `</div>` of folioView, insert the Research view HTML:

```html
<!-- v27.0: Research View -->
<div id="researchView" class="view hidden">
  <div class="panel">
    <div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:10px;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <h2 style="margin:0;font-size:var(--text-xl);font-weight:600;">Research</h2>
      </div>
      <button class="section-help-btn" onclick="showSectionHelp('research')" title="Help">?</button>
    </div>

    <!-- URL Input Bar -->
    <div id="researchUrlBar" style="display:flex;gap:8px;align-items:center;margin:var(--space-4) 0;">
      <span style="color:var(--text-muted);flex-shrink:0;font-size:var(--text-sm);">https://</span>
      <input type="text" id="researchUrlInput" class="onboarding-input" placeholder="Enter a URL to research..." style="flex:1;padding:12px;font-size:var(--text-base);" onkeydown="if(event.key==='Enter')startResearchFromView()" />
      <button id="researchGoBtn" class="btn btn-primary" onclick="startResearchFromView()" style="padding:10px 20px;font-weight:600;white-space:nowrap;">Research</button>
      <button id="researchCancelBtn" class="btn btn-secondary" onclick="cancelResearch()" style="display:none;padding:10px 16px;">Cancel</button>
    </div>

    <!-- Graph + Cards (hidden until search starts) -->
    <div id="researchVisualContainer" style="display:none;">
      <div id="researchSummaryBar" style="display:none;padding:12px 16px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:var(--space-4);font-size:var(--text-sm);color:var(--text-secondary);"></div>
      <canvas id="researchGraphCanvas" style="width:100%;height:350px;margin-bottom:var(--space-4);"></canvas>
      <div id="researchCardsContainer" class="ws-cards-panel"></div>
    </div>

    <!-- Action Buttons (hidden until results) -->
    <div id="researchActionsBar" style="display:none;margin-top:var(--space-4);display:flex;flex-wrap:wrap;gap:8px;">
      <button class="btn btn-primary" onclick="saveResearchToIdentity()">Save to Identity</button>
      <button class="btn btn-secondary" onclick="sendResearchToChat()">Send to Chat</button>
      <button class="btn btn-secondary" onclick="saveResearchToLibrary()">Save to Library</button>
      <button class="btn btn-secondary" onclick="saveResearchToFolio()">Add to Folio</button>
      <button class="btn btn-secondary" onclick="copyResearchResults()">Copy</button>
    </div>

    <!-- Sources List (hidden until results) -->
    <div id="researchSourcesList" style="display:none;margin-top:var(--space-5);"></div>

    <!-- History Grid (shown on empty state) -->
    <div id="researchHistorySection">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:var(--space-5);">
        <h3 style="margin:0;font-size:var(--text-base);font-weight:600;color:var(--text-secondary);">Recent Researches</h3>
        <button onclick="clearResearchHistory()" style="background:none;border:none;color:var(--text-muted);font-size:var(--text-xs);cursor:pointer;">Clear All</button>
      </div>
      <div id="researchHistoryGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:var(--space-3);"></div>
      <div id="researchHistoryEmpty" style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:var(--text-sm);">No research history yet. Enter a URL above to get started.</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): add Research view HTML structure"
```

---

### Task 3: Add Research view CSS

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add researchView to existing CSS selectors**

Find the CSS selector at line ~3998 that starts with `#memoryView, #tuningView, #settingsView, ...`. Add `#researchView` to the comma-separated list.

Find the panel CSS at line ~4013 that includes `#folioView > .panel`. Add `#researchView > .panel` to that list.

Find the sidebar pinned states at lines ~4060, ~4090, ~4120 that include `#folioView`. Add `#researchView` to each.

- [ ] **Step 2: Add Research-specific CSS**

Find the Folio CSS block near line ~43554 (`#folioView { padding: 0 !important; }`). After it, add:

```css
/* v27.0: Research View */
#researchView > .panel { padding: 24px 32px !important; margin: 0 !important; max-width: 100%; box-sizing: border-box; }
#researchHistoryGrid .research-history-card { background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; cursor: pointer; transition: border-color 0.2s; }
#researchHistoryGrid .research-history-card:hover { border-color: var(--accent); }
#researchHistoryGrid .research-history-card .research-card-domain { font-weight: 600; font-size: var(--text-sm); color: var(--text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#researchHistoryGrid .research-history-card .research-card-meta { font-size: var(--text-xs); color: var(--text-muted); }
#researchHistoryGrid .research-history-card .research-card-brand { font-size: var(--text-xs); color: var(--accent); margin-top: 6px; }
@media (max-width: 768px) {
  #researchView > .panel { padding: 16px !important; }
  #researchGraphCanvas { height: 250px !important; }
  #researchHistoryGrid { grid-template-columns: 1fr !important; }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): add Research view CSS"
```

---

### Task 4: Register Research in view router and sidebar

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add 'research' to the allViews array in showView()**

Find line ~67277 (the `var allViews = [...]` array). Add `'research'` to the array (after `'folio'`).

- [ ] **Step 2: Add Research view rendering case in showView()**

Find where `showView()` handles the 'folio' case. It will be a block like:
```js
if (view === 'folio') {
```
After the folio block, add:

```js
  // v27.0: Research view
  if (view === 'research') {
    renderResearchView();
  }
```

- [ ] **Step 3: Add sidebar nav item (desktop)**

Find the folio nav-item at line ~49567 (`data-view="folio"`). After the closing `</div>` of the folio nav-item block, add:

```html
<div class="nav-item" onclick="showPageLanding('research')" data-view="research">
  <span class="nav-item-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="4" stroke-dasharray="2 2"/></svg></span>
  <span class="nav-item-label">Research</span>
  <span class="sidebar-tooltip">Research</span>
</div>
```

- [ ] **Step 4: Add sidebar nav-subitem for grouped mode**

Find the folio nav-subitem (search for `navigateToSubSection('Orchestration','folio')`). After it, add:

```html
<div class="nav-subitem" data-view="research" onclick="event.stopPropagation(); navigateToSubSection('Orchestration','research')">Research</div>
```

- [ ] **Step 5: Add mobile menu item**

Find the mobile menu folio button at line ~47239 (`data-menu-view="folio"`). After its closing `</button>`, add a Research button following the same pattern:

```html
<button class="mobile-menu-item" onclick="mobileMenuNavTo('research')" data-menu-view="research">
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="4" stroke-dasharray="2 2"/></svg>
  <span>Research</span>
</button>
```

- [ ] **Step 6: Add landing page config**

Find `_pageLandingConfigs` object. After the folio entry (line ~66955), add:

```js
'research': {
  label: 'RESEARCH',
  tagline: 'Web intelligence on demand',
  description: 'Analyze any website to extract structured intelligence. Crawl pages, search the web, and synthesize complete profiles.',
  features: [
    { id: 'search', label: 'New Search', desc: 'Enter a URL and run the full analysis pipeline' },
    { id: 'history', label: 'History', desc: 'View and revisit past research results' }
  ],
  secondary: [],
  tabHandler: 'switchResearchTab'
},
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): register Research in view router, sidebar, mobile menu, landing config"
```

---

### Task 5: Research view core JS -- rendering, pipeline integration, tab switching

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add Research view JS functions**

Find the `saveWebSearchResults()` function (line ~159356). Before it, insert all the Research view JS:

```js
// ============================================================
// v27.0: Research View
// ============================================================

var _researchHistory = [];
var _researchCurrentResult = null;

function renderResearchView() {
  loadResearchHistory();
  renderResearchHistory();
  // Check if we have a prefill URL from Identity/Studio entry point
  if (window._researchPrefill) {
    var urlInput = document.getElementById('researchUrlInput');
    if (urlInput && window._researchPrefill.url) {
      urlInput.value = window._researchPrefill.url.replace(/^https?:\/\//, '');
    }
    window._researchPrefill = null;
  }
  // Reset visual state
  var vis = document.getElementById('researchVisualContainer');
  var actions = document.getElementById('researchActionsBar');
  var sources = document.getElementById('researchSourcesList');
  var summary = document.getElementById('researchSummaryBar');
  if (vis) vis.style.display = 'none';
  if (actions) actions.style.display = 'none';
  if (sources) sources.style.display = 'none';
  if (summary) summary.style.display = 'none';
  // Show history section
  var histSection = document.getElementById('researchHistorySection');
  if (histSection) histSection.style.display = '';
}

function switchResearchTab(tabId) {
  if (tabId === 'search') {
    var urlInput = document.getElementById('researchUrlInput');
    if (urlInput) urlInput.focus();
  } else if (tabId === 'history') {
    renderResearchHistory();
  }
}

function startResearchFromView() {
  var urlInput = document.getElementById('researchUrlInput');
  if (!urlInput) return;
  var url = urlInput.value.trim();
  if (!url) { showToast('Please enter a URL', 'warning'); return; }
  if (url.indexOf('.') === -1) { showToast('Please enter a valid domain', 'warning'); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  // Resolve provider + model + API key from current brand/life settings
  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var provider = 'anthropic';
  var model = 'claude-sonnet-4-6-20250514';
  if (currentMode === 'brand' && typeof brandSettings !== 'undefined' && typeof selectedBrand !== 'undefined') {
    var bs = brandSettings[selectedBrand];
    if (bs && bs.provider) provider = bs.provider;
    if (bs && bs.model) model = bs.model;
  }
  if (provider === 'openai' && (!model || model.indexOf('gpt') === -1)) model = 'gpt-5.4';
  if (provider === 'google' && (!model || model.indexOf('gemini') === -1)) model = 'gemini-2.5-flash';

  // Get API key
  (async function() {
    var apiKey = '';
    try { apiKey = await getApiKey(provider); } catch(e) {}
    if (!apiKey) {
      showToast('No API key found for ' + provider + '. Add one in Settings.', 'error');
      return;
    }

    // Show visual container, hide history
    var vis = document.getElementById('researchVisualContainer');
    var histSection = document.getElementById('researchHistorySection');
    var cancelBtn = document.getElementById('researchCancelBtn');
    var goBtn = document.getElementById('researchGoBtn');
    if (vis) vis.style.display = '';
    if (histSection) histSection.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = '';
    if (goBtn) goBtn.style.display = 'none';

    // Reset summary + actions
    var summary = document.getElementById('researchSummaryBar');
    var actions = document.getElementById('researchActionsBar');
    var sources = document.getElementById('researchSourcesList');
    if (summary) summary.style.display = 'none';
    if (actions) actions.style.display = 'none';
    if (sources) sources.style.display = 'none';

    var brandName = '';
    if (currentMode === 'brand' && typeof brands !== 'undefined' && brands[selectedBrand]) {
      brandName = brands[selectedBrand].name || '';
    }

    var startTime = Date.now();

    startWebSearch(url, provider, apiKey, model, brandName, currentMode, {
      onProgress: function(state, msg) {
        renderFloatingIndicator(state);
        // Render graph + cards in the Research view
        var canvas = document.getElementById('researchGraphCanvas');
        var cardsEl = document.getElementById('researchCardsContainer');
        if (canvas && typeof renderNetworkGraph === 'function') renderNetworkGraph(canvas, state);
        if (cardsEl && typeof renderIdentityCards === 'function') renderIdentityCards(cardsEl, state);
      },
      onComplete: function(results) {
        renderFloatingIndicator(_webSearchState);
        _researchCurrentResult = {
          url: url,
          state: JSON.parse(JSON.stringify(_webSearchState)),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime
        };
        showResearchResults(_researchCurrentResult);
        saveResearchToHistory(_researchCurrentResult);
        // Restore buttons
        var cancelBtn2 = document.getElementById('researchCancelBtn');
        var goBtn2 = document.getElementById('researchGoBtn');
        if (cancelBtn2) cancelBtn2.style.display = 'none';
        if (goBtn2) { goBtn2.style.display = ''; goBtn2.textContent = 'New Search'; }
      },
      onError: function(err) {
        renderFloatingIndicator(_webSearchState);
        showToast('Research encountered an issue: ' + (err.message || err), 'error');
        var cancelBtn3 = document.getElementById('researchCancelBtn');
        var goBtn3 = document.getElementById('researchGoBtn');
        if (cancelBtn3) cancelBtn3.style.display = 'none';
        if (goBtn3) { goBtn3.style.display = ''; goBtn3.textContent = 'Retry'; }
      }
    });
  })();
}

function cancelResearch() {
  if (typeof _webSearchState !== 'undefined') _webSearchState._aborted = true;
  var cancelBtn = document.getElementById('researchCancelBtn');
  var goBtn = document.getElementById('researchGoBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (goBtn) { goBtn.style.display = ''; goBtn.textContent = 'Research'; }
  showToast('Research cancelled', 'info');
}

function showResearchResults(result) {
  var state = result.state;
  var pages = state.pages || [];
  var donePages = pages.filter(function(p) { return p.status === 'done'; });
  var externalPages = pages.filter(function(p) { return p.isExternal; });
  var durationSec = Math.round((result.durationMs || 0) / 1000);

  // Summary bar
  var summary = document.getElementById('researchSummaryBar');
  if (summary) {
    summary.style.display = '';
    summary.innerHTML = '<span style="font-weight:600;color:var(--text-primary);">Complete</span> &nbsp; ' +
      donePages.length + ' pages scanned &bull; ' +
      externalPages.length + ' web sources &bull; ' +
      durationSec + 's';
  }

  // Final render of graph + cards
  var canvas = document.getElementById('researchGraphCanvas');
  var cardsEl = document.getElementById('researchCardsContainer');
  if (canvas && typeof renderNetworkGraph === 'function') renderNetworkGraph(canvas, state);
  if (cardsEl && typeof renderIdentityCards === 'function') renderIdentityCards(cardsEl, state);

  // Show action buttons
  var actions = document.getElementById('researchActionsBar');
  if (actions) actions.style.display = 'flex';

  // Render sources list
  var sourcesList = document.getElementById('researchSourcesList');
  if (sourcesList) {
    sourcesList.style.display = '';
    var html = '<h4 style="font-size:var(--text-sm);font-weight:600;color:var(--text-secondary);margin:0 0 8px;">Sources Used</h4>';
    html += '<div style="display:flex;flex-direction:column;gap:4px;">';
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].status !== 'done' && !pages[i].isExternal) continue;
      var depthLabel = pages[i].depth === 0 ? 'main' : pages[i].isExternal ? 'web' : 'depth ' + pages[i].depth;
      html += '<div style="font-size:var(--text-xs);color:var(--text-muted);display:flex;gap:8px;align-items:baseline;">';
      html += '<span style="color:var(--accent);min-width:36px;">' + depthLabel + '</span>';
      html += '<a href="' + escapeHtml(pages[i].url) + '" target="_blank" rel="noopener" style="color:var(--text-secondary);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(pages[i].url) + '</a>';
      html += '</div>';
    }
    html += '</div>';
    sourcesList.innerHTML = html;
  }
}

// ---- Research History ----

function loadResearchHistory() {
  try {
    _researchHistory = JSON.parse(localStorage.getItem('roweos_research_history') || '[]');
  } catch(e) { _researchHistory = []; }
}

function saveResearchHistoryToStorage() {
  localStorage.setItem('roweos_research_history', JSON.stringify(_researchHistory));
  // Firebase sync
  if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    writeDB('profile/researchHistory', { items: _researchHistory });
  }
}

function saveResearchToHistory(result) {
  var state = result.state;
  var domain = '';
  try { domain = new URL(result.url).hostname; } catch(e) { domain = result.url; }
  var pages = state.pages || [];
  var sections = {};
  if (state.finalResults) {
    Object.keys(state.finalResults).forEach(function(k) {
      sections[k] = (state.finalResults[k] || '').substring(0, 100);
    });
  }

  var entry = {
    id: 'research_' + Date.now(),
    url: result.url,
    domain: domain,
    mode: state.mode || (localStorage.getItem('roweos_app_mode') || 'brand'),
    brandName: state.brandName || null,
    profileName: (state.mode === 'life' && typeof getCurrentLifeProfile === 'function') ? (getCurrentLifeProfile() || {}).name || null : null,
    status: state.status === 'complete' ? 'complete' : 'error',
    completedAt: result.completedAt,
    pageCount: pages.filter(function(p) { return p.status === 'done'; }).length,
    sourceCount: pages.filter(function(p) { return p.isExternal; }).length,
    durationMs: result.durationMs,
    sections: sections,
    fullResults: state.finalResults || {},
    pages: pages.map(function(p) { return { url: p.url, title: p.title || '', depth: p.depth, isExternal: !!p.isExternal }; })
  };

  _researchHistory.unshift(entry);
  if (_researchHistory.length > 20) _researchHistory = _researchHistory.slice(0, 20);
  saveResearchHistoryToStorage();
  renderResearchHistory();
}

function renderResearchHistory() {
  var grid = document.getElementById('researchHistoryGrid');
  var empty = document.getElementById('researchHistoryEmpty');
  if (!grid) return;

  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var filtered = _researchHistory.filter(function(h) { return h.mode === currentMode; });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var h = filtered[i];
    var dateStr = '';
    try { dateStr = new Date(h.completedAt).toLocaleDateString(); } catch(e) {}
    html += '<div class="research-history-card" onclick="loadResearchFromHistory(\'' + escapeHtml(h.id) + '\')">';
    html += '<div class="research-card-domain">' + escapeHtml(h.domain) + '</div>';
    html += '<div class="research-card-meta">' + (h.pageCount || 0) + ' pages &bull; ' + dateStr + '</div>';
    if (h.brandName) html += '<div class="research-card-brand">' + escapeHtml(h.brandName) + '</div>';
    if (h.profileName) html += '<div class="research-card-brand">' + escapeHtml(h.profileName) + '</div>';
    html += '</div>';
  }
  grid.innerHTML = html;
}

function loadResearchFromHistory(id) {
  var entry = _researchHistory.find(function(h) { return h.id === id; });
  if (!entry) { showToast('Research not found', 'error'); return; }

  // Show visual container, hide history
  var vis = document.getElementById('researchVisualContainer');
  var histSection = document.getElementById('researchHistorySection');
  if (vis) vis.style.display = '';
  if (histSection) histSection.style.display = 'none';

  // Set URL input
  var urlInput = document.getElementById('researchUrlInput');
  if (urlInput) urlInput.value = entry.url.replace(/^https?:\/\//, '');

  // Build a minimal state for rendering
  var fakeState = {
    status: 'complete',
    url: entry.url,
    mode: entry.mode,
    brandName: entry.brandName || '',
    pages: entry.pages || [],
    finalResults: entry.fullResults || {},
    gapAnalysis: {},
    externalResults: ''
  };

  _researchCurrentResult = {
    url: entry.url,
    state: fakeState,
    completedAt: entry.completedAt,
    durationMs: entry.durationMs
  };

  showResearchResults(_researchCurrentResult);
}

function clearResearchHistory() {
  if (!confirm('Clear all research history?')) return;
  _researchHistory = [];
  saveResearchHistoryToStorage();
  renderResearchHistory();
  showToast('Research history cleared', 'success');
}

function deleteResearchHistoryItem(id) {
  _researchHistory = _researchHistory.filter(function(h) { return h.id !== id; });
  saveResearchHistoryToStorage();
  renderResearchHistory();
}

// ---- Research Actions ----

function saveResearchToIdentity() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to save', 'warning');
    return;
  }
  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var results = _researchCurrentResult.state.finalResults;

  if (currentMode === 'brand') {
    var brandIdx = (typeof selectedBrand !== 'undefined') ? selectedBrand : 0;
    if (!brands || !brands[brandIdx]) { showToast('No brand selected', 'error'); return; }
    var brand = brands[brandIdx];
    if (!brand.identityData) brand.identityData = {};
    var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
    for (var i = 0; i < sections.length; i++) {
      if (results[sections[i]]) {
        if (!brand.identityData[sections[i]]) brand.identityData[sections[i]] = {};
        brand.identityData[sections[i]].ai = results[sections[i]];
      }
    }
    if (results.essence && !brand.positioning) brand.positioning = results.essence.substring(0, 300);
    if (results.voice && !brand.voice) brand.voice = results.voice.substring(0, 200);
    if (results.audience && !brand.audience) brand.audience = results.audience.substring(0, 300);
    if (results.products && !brand.products) brand.products = results.products.substring(0, 300);
    brand.website = brand.website || _researchCurrentResult.url;
    saveBrands();
    showToast('Research saved to ' + (brand.shortName || brand.name) + "'s identity", 'success');
  } else {
    var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    var profileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
    var profile = profiles[profileIdx];
    if (!profile) { showToast('No life profile found', 'error'); return; }
    if (!profile.identityData) profile.identityData = {};
    if (results.role) {
      if (!profile.identityData.work) profile.identityData.work = [];
      profile.identityData.work.push({ type: 'role', value: results.role, source: 'research', addedAt: new Date().toISOString() });
    }
    if (results.skills) {
      if (!profile.identityData.work) profile.identityData.work = [];
      profile.identityData.work.push({ type: 'skills', value: results.skills, source: 'research', addedAt: new Date().toISOString() });
    }
    if (results.interests) {
      if (!profile.identityData.personal) profile.identityData.personal = [];
      profile.identityData.personal.push({ type: 'interests', value: results.interests, source: 'research', addedAt: new Date().toISOString() });
    }
    if (results.personality) {
      if (!profile.identityData.personal) profile.identityData.personal = [];
      profile.identityData.personal.push({ type: 'trait', value: results.personality, source: 'research', addedAt: new Date().toISOString() });
    }
    if (results.communication) {
      if (!profile.preferences) profile.preferences = {};
      profile.preferences.communicationStyle = results.communication;
    }
    if (typeof saveLifeProfiles === 'function') saveLifeProfiles(profiles);
    showToast('Research saved to ' + (profile.name || 'life profile'), 'success');
  }
}

function sendResearchToChat() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to send', 'warning');
    return;
  }
  var results = _researchCurrentResult.state.finalResults;
  var pages = _researchCurrentResult.state.pages || [];
  var text = 'Here is research from ' + _researchCurrentResult.url + ':\n\n';
  Object.keys(results).forEach(function(key) {
    if (results[key]) {
      text += '## ' + key.charAt(0).toUpperCase() + key.slice(1) + '\n' + results[key] + '\n\n';
    }
  });
  text += '## Sources\n';
  pages.forEach(function(p) {
    if (p.status === 'done' || p.isExternal) text += '- ' + p.url + '\n';
  });

  // Inject into agent chat as a context message
  if (typeof currentConversation !== 'undefined') {
    currentConversation.push({ role: 'user', content: text });
  }
  showView('agent');
  showToast('Research sent to chat', 'success');
}

function saveResearchToLibrary() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to save', 'warning');
    return;
  }
  var results = _researchCurrentResult.state.finalResults;
  var pages = _researchCurrentResult.state.pages || [];
  var domain = '';
  try { domain = new URL(_researchCurrentResult.url).hostname; } catch(e) { domain = _researchCurrentResult.url; }
  var dateStr = new Date().toLocaleDateString();

  var md = '# Research: ' + domain + '\nDate: ' + dateStr + '\nURL: ' + _researchCurrentResult.url + '\n\n';
  Object.keys(results).forEach(function(key) {
    if (results[key]) {
      md += '## ' + key.charAt(0).toUpperCase() + key.slice(1) + '\n' + results[key] + '\n\n';
    }
  });
  md += '## Sources\n';
  pages.forEach(function(p) {
    if (p.status === 'done' || p.isExternal) md += '- ' + p.url + '\n';
  });

  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var key = currentMode === 'life' ? '_life' : (brands && brands[selectedBrand] ? (brands[selectedBrand].shortName || brands[selectedBrand].name) : 'default');
  if (!fileLibrary[key]) fileLibrary[key] = { folders: [{ id: 'root', name: 'Root', parentId: null }], files: [] };
  fileLibrary[key].files.push({
    id: 'file_' + Date.now(),
    name: 'Research - ' + domain + ' - ' + dateStr,
    type: 'text/markdown',
    content: md,
    folderId: 'root',
    createdAt: new Date().toISOString(),
    metadata: { source: 'research', url: _researchCurrentResult.url, pageCount: (pages.filter(function(p) { return p.status === 'done'; })).length }
  });
  localStorage.setItem('roweos_file_library', JSON.stringify(fileLibrary));
  if (typeof writeDB === 'function') writeDB('library/brand', { data: JSON.stringify(fileLibrary) });
  showToast('Research saved to Library', 'success');
}

function saveResearchToFolio() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to save', 'warning');
    return;
  }
  var results = _researchCurrentResult.state.finalResults;
  var domain = '';
  try { domain = new URL(_researchCurrentResult.url).hostname; } catch(e) { domain = _researchCurrentResult.url; }

  // Build HTML content for Folio
  var html = '<!DOCTYPE html><html><head><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#e0d6c8;background:#1a1a1a;}h1{color:#a89878;}h2{color:#c4b69c;border-bottom:1px solid #333;padding-bottom:8px;}a{color:#a89878;}</style></head><body>';
  html += '<h1>Research: ' + escapeHtml(domain) + '</h1>';
  html += '<p style="color:#888;">URL: <a href="' + escapeHtml(_researchCurrentResult.url) + '">' + escapeHtml(_researchCurrentResult.url) + '</a></p>';
  Object.keys(results).forEach(function(key) {
    if (results[key]) {
      html += '<h2>' + escapeHtml(key.charAt(0).toUpperCase() + key.slice(1)) + '</h2>';
      html += '<p>' + escapeHtml(results[key]).replace(/\n/g, '<br>') + '</p>';
    }
  });
  html += '</body></html>';

  var now = new Date().toISOString();
  var brandName = '';
  var brandIdx = 0;
  if (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand]) {
    brandName = brands[selectedBrand].shortName || brands[selectedBrand].name;
    brandIdx = selectedBrand;
  }

  var item = {
    id: 'folio_' + Date.now(),
    title: 'Research: ' + domain,
    html: html,
    thumbnail: null,
    versions: [{ id: 'v_' + Date.now(), html: html, description: 'Web research', timestamp: now, source: 'research' }],
    comments: [],
    conversation: [],
    branchedFrom: null,
    brand: brandName,
    brandIdx: brandIdx,
    createdAt: now,
    updatedAt: now,
    pinned: false
  };

  if (typeof saveFolioItem === 'function' && saveFolioItem(item) !== false) {
    showToast('Research added to Folio', 'success');
  } else {
    showToast('Could not save to Folio', 'error');
  }
}

function copyResearchResults() {
  if (!_researchCurrentResult || !_researchCurrentResult.state.finalResults) {
    showToast('No research results to copy', 'warning');
    return;
  }
  var results = _researchCurrentResult.state.finalResults;
  var pages = _researchCurrentResult.state.pages || [];
  var domain = '';
  try { domain = new URL(_researchCurrentResult.url).hostname; } catch(e) { domain = _researchCurrentResult.url; }

  var md = '# Research: ' + domain + '\nDate: ' + new Date().toLocaleDateString() + '\n\n';
  Object.keys(results).forEach(function(key) {
    if (results[key]) {
      md += '## ' + key.charAt(0).toUpperCase() + key.slice(1) + '\n' + results[key] + '\n\n';
    }
  });
  md += '## Sources\n';
  pages.forEach(function(p) {
    if (p.status === 'done' || p.isExternal) md += '- ' + p.url + '\n';
  });

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(md).then(function() {
      showToast('Research copied to clipboard', 'success');
    });
  } else {
    showToast('Copy not supported in this browser', 'warning');
  }
}

// ---- Entry Point from Identity / Studio ----

function launchResearch(url, brandIdx) {
  window._researchPrefill = { url: url || '', brandIdx: brandIdx };
  window._skipPageLanding = true;
  showView('research');
  if (url) {
    var urlInput = document.getElementById('researchUrlInput');
    if (urlInput) urlInput.value = url.replace(/^https?:\/\//, '');
  }
}

// Expose to window
window.startResearchFromView = startResearchFromView;
window.cancelResearch = cancelResearch;
window.loadResearchFromHistory = loadResearchFromHistory;
window.clearResearchHistory = clearResearchHistory;
window.saveResearchToIdentity = saveResearchToIdentity;
window.sendResearchToChat = sendResearchToChat;
window.saveResearchToLibrary = saveResearchToLibrary;
window.saveResearchToFolio = saveResearchToFolio;
window.copyResearchResults = copyResearchResults;
window.launchResearch = launchResearch;
window.switchResearchTab = switchResearchTab;
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): Research view core JS -- pipeline, history, actions, entry points"
```

---

### Task 6: Add Research entry point in Identity view

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Find brand card header in Identity view and add Research button**

Search for the identity card that shows brand website or the brand name header in the memory/identity view. Find where brand cards are rendered dynamically (search for `brand.website` or `identity-card-header` near the identity rendering code).

Add a "Research" button to each brand card that has a website. The button calls `launchResearch(brand.website, brandIdx)`:

```html
<button onclick="launchResearch('WEBSITE_URL', BRAND_IDX)" title="Research this brand's website" style="background:none;border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:4px 10px;color:var(--accent);font-size:var(--text-xs);cursor:pointer;display:flex;align-items:center;gap:4px;">
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
  Research
</button>
```

This will need to be added in the dynamic HTML rendering function for identity cards/brand headers. The exact insertion point depends on where brand cards are rendered. Find the function that renders brand info in the identity view and add the button near the brand name/website display.

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): add Research button to Identity view brand cards"
```

---

### Task 7: Add Research history to Firebase sync

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add research history fetch to loadFromFirebaseV2**

Find the `Promise.all()` array in `loadFromFirebaseV2` (line ~135866). Find the line:
```js
db.doc(basePath + '/folio/main').get(),
```
After it, add:
```js
db.doc(basePath + '/profile/researchHistory').get(),
```

- [ ] **Step 2: Add research history variable assignment**

In the results handler after `var folioDoc = results[33];` (or wherever the folio result is assigned), add:
```js
var researchHistDoc = results[NEXT_INDEX]; // Use the correct index
```

- [ ] **Step 3: Add research history restore logic**

After the folio restore block, add:
```js
    // v27.0: Research history
    if (researchHistDoc && researchHistDoc.exists) {
      var rhData = researchHistDoc.data();
      if (rhData && rhData.items) {
        safeSyncWrite('roweos_research_history', rhData.items);
      }
    }
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): sync research history to/from Firebase"
```

---

### Task 8: Deploy and verify

- [ ] **Step 1: Test empty state**

Open Research from sidebar. Should see URL input + "No research history yet" message.

- [ ] **Step 2: Test search pipeline**

Enter a URL, click Research. Should see network graph animating, identity cards filling in, floating indicator. After completion: summary bar, action buttons, sources list.

- [ ] **Step 3: Test all 5 actions**

- Save to Identity: verify brand/life identityData updated
- Send to Chat: verify agent view opens with research context
- Save to Library: verify file appears in Library
- Add to Folio: verify item appears in Folio gallery
- Copy: verify clipboard has markdown

- [ ] **Step 4: Test history**

Verify completed research appears in history grid. Click a history card to re-view results.

- [ ] **Step 5: Test entry point from Identity**

Go to Identity view, find a brand with a website, click Research button. Should navigate to Research view with URL pre-filled.

- [ ] **Step 6: Deploy**

```bash
cd /Volumes/roweOS/RoweOS/dist && vercel --prod
```
