# Pill Unification + Per-Section Preferences + Logos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all section navigation into one pill/squircle system with global style preference, per-section defaults via ? dropdown, and dark/light logo upload.

**Architecture:** Extend existing `renderPillNav` with per-item color support. Add CSS class `html.selector-squircles` for style switching. Replace `showSectionHelp` modal with dropdown. Add logo upload to Settings > Appearance. Migrate Studio tabs to unified system.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5 only), single-file app at `/Volumes/roweOS/RoweOS/dist/index.html`

**Spec:** `docs/superpowers/specs/2026-03-24-pill-unification-customization-design.md`

---

### Task 1: CSS -- Squircle mode styles

**Files:**
- Modify: `RoweOS/dist/index.html` -- insert after pill-nav CSS block (~line 48473)

- [ ] **Step 1: Add squircle mode CSS overrides**

Insert after the existing `.pill-nav` mobile media query block:

```css
/* v26.2: Squircle selector mode */
html.selector-squircles .pill-nav {
  border-bottom: none;
  gap: 4px;
}
html.selector-squircles .pill-nav-item {
  border-radius: var(--radius-md, 8px);
  border: 1px solid transparent;
  background: transparent;
  padding: 10px 16px;
  font-weight: 500;
}
html.selector-squircles .pill-nav-item:hover {
  background: var(--bg-secondary);
  border-color: transparent;
}
html.selector-squircles .pill-nav-item.active {
  background: var(--brand-accent, #a89878);
  border-color: transparent;
  color: #ffffff;
  font-weight: 600;
}
html.selector-squircles .pill-nav-item.secondary {
  border-color: transparent;
}
/* Life mode squircle overrides */
html.life-mode.selector-squircles .pill-nav-item.active {
  background: var(--life-accent, #4ade80);
}
/* Light mode squircle overrides */
html.light-mode.selector-squircles .pill-nav-item:hover {
  background: rgba(0,0,0,0.06);
}
```

- [ ] **Step 2: Add section help dropdown CSS**

```css
/* v26.2: Section help dropdown */
.section-help-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: rgba(30,30,30,0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 4px;
  min-width: 200px;
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
html.light-mode .section-help-dropdown {
  background: rgba(255,255,255,0.95);
  border-color: rgba(0,0,0,0.1);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
.section-help-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s;
}
.section-help-dropdown-item:hover {
  background: rgba(255,255,255,0.06);
}
html.light-mode .section-help-dropdown-item:hover {
  background: rgba(0,0,0,0.04);
}
.section-help-dropdown-item svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.section-help-dropdown-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}
.section-help-dropdown-divider {
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 4px 0;
}
html.light-mode .section-help-dropdown-divider {
  background: rgba(0,0,0,0.08);
}
.section-help-dropdown-sublist {
  padding: 2px 0 2px 12px;
}
.section-help-dropdown-sublist-item {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
}
.section-help-dropdown-sublist-item:hover,
.section-help-dropdown-sublist-item.active {
  color: var(--brand-accent, #a89878);
  background: rgba(168,152,120,0.1);
}
/* Toggle switch in dropdown */
.section-help-toggle {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: rgba(255,255,255,0.15);
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}
.section-help-toggle.on {
  background: rgba(168,152,120,0.4);
}
.section-help-toggle-knob {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #888;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: all 0.2s;
}
.section-help-toggle.on .section-help-toggle-knob {
  background: var(--brand-accent, #a89878);
  left: 16px;
}
@media (max-width: 768px) {
  .section-help-dropdown {
    max-width: calc(100vw - 32px);
  }
}
```

- [ ] **Step 3: Add logo upload section CSS**

```css
/* v26.2: Logo upload in Settings > Appearance */
.logo-upload-section {
  margin-top: var(--space-4);
}
.logo-upload-slots {
  display: flex;
  gap: 16px;
  margin-top: var(--space-3);
}
.logo-upload-slot {
  flex: 1;
  text-align: center;
}
.logo-upload-slot-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.logo-upload-preview {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  border: 1px dashed rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
  overflow: hidden;
  background: rgba(255,255,255,0.04);
}
html.light-mode .logo-upload-preview {
  border-color: rgba(0,0,0,0.15);
  background: rgba(0,0,0,0.02);
}
.logo-upload-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.logo-upload-btn {
  font-size: 11px;
  color: var(--brand-accent, #a89878);
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px 8px;
}
/* v26.2: Selector style picker in Settings > Preferences */
.selector-style-options {
  display: flex;
  gap: 8px;
  margin-top: var(--space-2);
}
.selector-style-option {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  text-align: center;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-muted);
  transition: all 0.2s;
}
.selector-style-option.active {
  border-color: var(--brand-accent, #a89878);
  color: var(--brand-accent, #a89878);
  background: rgba(168,152,120,0.1);
}
html.light-mode .selector-style-option {
  background: rgba(0,0,0,0.02);
  border-color: rgba(0,0,0,0.08);
}
html.light-mode .selector-style-option.active {
  background: rgba(168,152,120,0.08);
}
```

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.2: add CSS for squircle mode, help dropdown, logo upload, style picker"
```

---

### Task 2: JS -- Contrast text helper + selector style preference

**Files:**
- Modify: `RoweOS/dist/index.html` -- add near pill nav functions (~line 64495)

- [ ] **Step 1: Add getContrastTextColor helper**

Add before `renderPillNav`:

```javascript
// v26.2: Get contrast text color (white or dark) based on hex background luminance
function getContrastTextColor(hex) {
  hex = hex.replace('#', '');
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  // Relative luminance formula
  var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}
```

- [ ] **Step 2: Add selector style functions**

```javascript
// v26.2: Selector style preference (pills or squircles)
function getSelectorStyle() {
  try { return localStorage.getItem('roweos_selector_style') || 'pills'; } catch(e) { return 'pills'; }
}

function setSelectorStyle(style) {
  try { localStorage.setItem('roweos_selector_style', style); } catch(e) {}
  applySelectorStyle();
}

function applySelectorStyle() {
  var style = getSelectorStyle();
  if (style === 'squircles') {
    document.documentElement.classList.add('selector-squircles');
  } else {
    document.documentElement.classList.remove('selector-squircles');
  }
}
```

- [ ] **Step 3: Call applySelectorStyle on app init**

Find the DOMContentLoaded or init sequence and add `applySelectorStyle()` call. Search for where `applySidebarMode()` is called on init and add `applySelectorStyle()` nearby.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.2: add contrast text helper and selector style preference"
```

---

### Task 3: JS -- Extend renderPillNav and updatePillNavActive for per-item colors

**Files:**
- Modify: `RoweOS/dist/index.html:64495-64540` (renderPillNav and updatePillNavActive)

- [ ] **Step 1: Extend renderPillNav with options parameter**

Replace the existing `renderPillNav` function (line 64495) with:

```javascript
// v26.2: Universal Pill Navigation renderer (extended with per-item colors)
// items: [{id, label, secondary}], activeId: string, onSelect: function(id)
// options: { itemColors: { id: '#hexcolor', ... }, noBorder: false }
function renderPillNav(containerId, items, activeId, onSelect, options) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var opts = options || {};
  var isSquircle = getSelectorStyle() === 'squircles';
  var colors = opts.itemColors || {};

  // Store colors for updatePillNavActive
  if (!window._pillNavColors) window._pillNavColors = {};
  if (opts.itemColors) window._pillNavColors[containerId] = colors;

  var html = '<div class="pill-nav" role="tablist"' + (opts.noBorder ? ' style="border-bottom:none;"' : '') + '>';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var isActive = item.id === activeId;
    var cls = 'pill-nav-item' + (isActive ? ' active' : '') + (item.secondary ? ' secondary' : '');
    var inlineStyle = '';

    // Per-item color in squircle mode
    if (isSquircle && isActive && colors[item.id]) {
      var bgColor = colors[item.id];
      var textColor = getContrastTextColor(bgColor);
      inlineStyle = ' style="background:' + bgColor + ';color:' + textColor + ';"';
    }

    html += '<button class="' + cls + '" role="tab" aria-selected="' + isActive + '" tabindex="' + (isActive ? '0' : '-1') + '" data-pill-id="' + escapeHtml(item.id) + '" onclick="handlePillNavClick(this, \'' + escapeHtml(containerId) + '\')"' + inlineStyle + '>' + escapeHtml(item.label) + '</button>';
  }
  html += '</div>';
  container.innerHTML = html;

  if (!window._pillNavCallbacks) window._pillNavCallbacks = {};
  window._pillNavCallbacks[containerId] = onSelect;
}
```

- [ ] **Step 2: Extend updatePillNavActive for per-item colors**

Replace the existing `updatePillNavActive` function (line 64530) with:

```javascript
// v26.2: Programmatically update pill nav active state (with per-item color support)
function updatePillNavActive(containerId, activeId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var isSquircle = getSelectorStyle() === 'squircles';
  var colors = (window._pillNavColors && window._pillNavColors[containerId]) || {};

  var pills = container.querySelectorAll('.pill-nav-item');
  for (var i = 0; i < pills.length; i++) {
    var pillId = pills[i].getAttribute('data-pill-id');
    var isActive = pillId === activeId;
    pills[i].classList.toggle('active', isActive);
    pills[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
    pills[i].setAttribute('tabindex', isActive ? '0' : '-1');

    // Apply/clear per-item color
    if (isSquircle && colors[pillId]) {
      if (isActive) {
        pills[i].style.background = colors[pillId];
        pills[i].style.color = getContrastTextColor(colors[pillId]);
      } else {
        pills[i].style.background = '';
        pills[i].style.color = '';
      }
    } else {
      pills[i].style.background = '';
      pills[i].style.color = '';
    }
  }
}
```

- [ ] **Step 3: Verify all existing renderPillNav callers still work**

Grep for `renderPillNav(` and verify the 5th argument (options) is optional and existing calls without it still work. All existing calls pass 4 args -- the new 5th arg defaults to `{}`.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.2: extend renderPillNav with per-item colors for squircle mode"
```

---

### Task 4: JS + HTML -- Migrate Studio tabs to renderPillNav

**Files:**
- Modify: `RoweOS/dist/index.html:52119-52161` (Studio tab HTML)
- Modify: `RoweOS/dist/index.html:78408-78449` (selectAgent function)
- Modify: `RoweOS/dist/index.html:65499-65510` (showView Studio section)

- [ ] **Step 1: Replace hardcoded Studio tab HTML with pill nav container**

Find the Studio tab bar area (lines 52119-52161, the `<button class="studio-v2-tab"...>` elements). Replace the entire block of tab buttons (both BrandAI and LifeAI sections) with a single container:

```html
<div id="studioPillNav"></div>
```

Keep any surrounding wrapper divs that control the tab bar layout.

- [ ] **Step 2: Add Studio pill nav initialization in showView**

In the `showView` function's `if (view === 'studio')` block (~line 65499), add Studio pill nav rendering before `renderOperations()`:

```javascript
  if (view === 'studio') {
    // v26.2: Render Studio pill nav (unified system)
    var studioAgents = isLifeMode() ? [
      { id: 'all', label: 'All' },
      { id: 'planning', label: 'Planning' },
      { id: 'development', label: 'Development' },
      { id: 'wellness', label: 'Wellness' },
      { id: 'relationships', label: 'Relationships' },
      { id: 'finances', label: 'Finances' },
      { id: 'taxes', label: 'Taxes' },
      { id: 'home', label: 'Home' },
      { id: 'creativity', label: 'Creativity' },
      { id: 'reflection', label: 'Reflection' },
      { id: 'image', label: 'Image', secondary: true }
    ] : [
      { id: 'all', label: 'All Agents' },
      { id: 'strategy', label: 'Strategy' },
      { id: 'marketing', label: 'Marketing' },
      { id: 'operations', label: 'Operations' },
      { id: 'documents', label: 'Documents' },
      { id: 'intelligence', label: 'Intel', secondary: true },
      { id: 'research', label: 'Research', secondary: true },
      { id: 'social', label: 'Social', secondary: true },
      { id: 'image', label: 'Image', secondary: true },
      { id: 'infographic', label: 'Infographic', secondary: true },
      { id: 'video', label: 'Video', secondary: true },
      { id: 'guided', label: 'Guided', secondary: true }
    ];
    renderPillNav('studioPillNav', studioAgents, currentAgent || 'all', function(id) {
      selectAgent(id);
    }, { itemColors: AGENT_COLORS, noBorder: true });

    // v10.5.25: Mode-aware Studio
    updateStudioForMode();
    // ... rest of existing Studio init
```

- [ ] **Step 3: Simplify selectAgent to use updatePillNavActive**

Replace lines 78408-78449:

```javascript
function selectAgent(agentId) {
  currentAgent = agentId;

  // v26.2: Update unified pill nav
  updatePillNavActive('studioPillNav', agentId);

  // If an agent is selected (not 'all'), auto-filter to that category
  if (agentId !== 'all') {
    var agent = null;
    for (var ai = 0; ai < agents.length; ai++) {
      if (agents[ai].id === agentId) { agent = agents[ai]; break; }
    }
    if (agent) {
      selectedCategory = agent.category;
    } else {
      // v22.0: Tab is a category directly (image, video, social, research)
      selectedCategory = agentId;
    }
  } else {
    selectedCategory = 'all';
  }

  // Update agent info card if present
  updateAgentInfoCard();

  // v13.1: Update live system prompt preview
  updateStudioPromptPreview();

  // Re-render operations
  renderOperations();

  // v10.5.25: Scroll to top of content area
  var contentArea = document.getElementById('studioV2Content');
  if (contentArea) {
    contentArea.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.2: migrate Studio tabs to unified renderPillNav system"
```

---

### Task 5: JS -- Section help dropdown (replace modal)

**Files:**
- Modify: `RoweOS/dist/index.html:173104` (showSectionHelp function)
- Modify: 17 onclick references across HTML

- [ ] **Step 1: Add section prefs helpers**

Add near the help system functions (~line 173104):

```javascript
// v26.2: Per-section preferences
function getSectionPrefs(viewId) {
  try {
    var all = JSON.parse(localStorage.getItem('roweos_section_prefs') || '{}');
    return all[viewId] || {};
  } catch(e) { return {}; }
}

function setSectionPref(viewId, key, value) {
  try {
    var all = JSON.parse(localStorage.getItem('roweos_section_prefs') || '{}');
    if (!all[viewId]) all[viewId] = {};
    all[viewId][key] = value;
    localStorage.setItem('roweos_section_prefs', JSON.stringify(all));
  } catch(e) {}
}
```

- [ ] **Step 2: Replace showSectionHelp with showSectionHelpDropdown**

Replace the `showSectionHelp` function (line 173104) with:

```javascript
// v26.2: Section help dropdown (replaces modal)
function showSectionHelp(sectionId) {
  // Find the ? button that was clicked
  var btn = event ? event.currentTarget || event.target : null;
  if (!btn) return;
  showSectionHelpDropdown(btn, sectionId);
}

function showSectionHelpDropdown(btn, sectionId) {
  // Close any existing dropdown
  closeSectionHelpDropdown();

  var sectionToArea = {
    'signal': 'focus', 'memory': 'identity',
    'tuning': 'memory', 'commerce': 'analytics'
  };
  var feedbackArea = sectionToArea[sectionId] || sectionId;
  var hasTour = GUIDED_TOURS && GUIDED_TOURS[sectionId] && GUIDED_TOURS[sectionId].length > 0;
  var config = _pageLandingConfigs[sectionId];
  var sidebarMode = localStorage.getItem('roweos_sidebar_mode') || 'grouped';
  var showPrefs = (sidebarMode === 'expanded') && config;
  var prefs = getSectionPrefs(sectionId);

  // Position dropdown relative to button
  var wrapper = btn.parentElement;
  if (wrapper) wrapper.style.position = 'relative';

  var dd = document.createElement('div');
  dd.className = 'section-help-dropdown';
  dd.id = 'sectionHelpDropdown';

  var html = '';

  // Tour
  if (hasTour) {
    html += '<div class="section-help-dropdown-item" onclick="closeSectionHelpDropdown(); if(typeof startGuidedTour===\'function\') startGuidedTour(\'' + escapeHtml(sectionId) + '\')">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    html += 'Take a Tour</div>';
  }

  // Feedback
  html += '<div class="section-help-dropdown-item" onclick="closeSectionHelpDropdown(); if(typeof showFeedbackModal===\'function\') showFeedbackModal(\'' + escapeHtml(feedbackArea) + '\')">';
  html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  html += 'Send Feedback</div>';

  // Section preferences (only in expanded mode with landing config)
  if (showPrefs) {
    html += '<div class="section-help-dropdown-divider"></div>';

    // Skip Landing toggle
    var isSkip = prefs.skipLanding ? true : false;
    html += '<div class="section-help-dropdown-toggle" onclick="toggleSectionSkipLanding(\'' + escapeHtml(sectionId) + '\', this)">';
    html += '<span>Skip landing</span>';
    html += '<div class="section-help-toggle' + (isSkip ? ' on' : '') + '"><div class="section-help-toggle-knob"></div></div>';
    html += '</div>';

    // Open to picker
    var defaultPill = prefs.defaultPill || config.features[0].id;
    var defaultLabel = defaultPill;
    for (var i = 0; i < config.features.length; i++) {
      if (config.features[i].id === defaultPill) { defaultLabel = config.features[i].label; break; }
    }
    html += '<div class="section-help-dropdown-toggle" onclick="toggleSectionOpenTo(this, \'' + escapeHtml(sectionId) + '\')">';
    html += '<span>Open to</span>';
    html += '<span style="color:var(--brand-accent, #a89878);font-size:11px;" id="sectionOpenToLabel">' + escapeHtml(defaultLabel) + ' &#9662;</span>';
    html += '</div>';

    // Sub-list (hidden initially)
    html += '<div class="section-help-dropdown-sublist" id="sectionOpenToList" style="display:none;">';
    for (var j = 0; j < config.features.length; j++) {
      var f = config.features[j];
      var isDefault = f.id === defaultPill;
      html += '<div class="section-help-dropdown-sublist-item' + (isDefault ? ' active' : '') + '" onclick="selectSectionDefaultPill(\'' + escapeHtml(sectionId) + '\', \'' + escapeHtml(f.id) + '\', \'' + escapeHtml(f.label) + '\')">' + escapeHtml(f.label) + '</div>';
    }
    html += '</div>';
  }

  dd.innerHTML = html;
  wrapper.appendChild(dd);

  // Close on click outside
  setTimeout(function() {
    document.addEventListener('click', _closeSectionHelpOnOutsideClick);
  }, 10);

  // Close on Escape
  document.addEventListener('keydown', _closeSectionHelpOnEscape);
}

function _closeSectionHelpOnOutsideClick(e) {
  var dd = document.getElementById('sectionHelpDropdown');
  if (dd && !dd.contains(e.target) && !e.target.classList.contains('section-help-btn')) {
    closeSectionHelpDropdown();
  }
}

function _closeSectionHelpOnEscape(e) {
  if (e.key === 'Escape') { closeSectionHelpDropdown(); return; }
  // v26.2: Arrow key navigation for dropdown
  var dd = document.getElementById('sectionHelpDropdown');
  if (!dd) return;
  var items = dd.querySelectorAll('.section-help-dropdown-item, .section-help-dropdown-toggle');
  if (items.length === 0) return;
  var focused = -1;
  for (var i = 0; i < items.length; i++) {
    if (items[i] === document.activeElement || items[i].classList.contains('focused')) { focused = i; break; }
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    var next = focused < items.length - 1 ? focused + 1 : 0;
    items[next].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    var prev = focused > 0 ? focused - 1 : items.length - 1;
    items[prev].focus();
  } else if (e.key === 'Enter' && focused >= 0) {
    e.preventDefault();
    items[focused].click();
  }
}

function closeSectionHelpDropdown() {
  var dd = document.getElementById('sectionHelpDropdown');
  if (dd && dd.parentNode) dd.parentNode.removeChild(dd);
  document.removeEventListener('click', _closeSectionHelpOnOutsideClick);
  document.removeEventListener('keydown', _closeSectionHelpOnEscape);
}

function toggleSectionSkipLanding(sectionId, el) {
  var toggle = el.querySelector('.section-help-toggle');
  if (!toggle) return;
  var isOn = toggle.classList.contains('on');
  toggle.classList.toggle('on', !isOn);
  setSectionPref(sectionId, 'skipLanding', !isOn);
}

function toggleSectionOpenTo(el, sectionId) {
  var list = document.getElementById('sectionOpenToList');
  if (list) list.style.display = list.style.display === 'none' ? '' : 'none';
}

function selectSectionDefaultPill(sectionId, pillId, label) {
  setSectionPref(sectionId, 'defaultPill', pillId);
  var labelEl = document.getElementById('sectionOpenToLabel');
  if (labelEl) labelEl.innerHTML = escapeHtml(label) + ' &#9662;';
  // Update active state in sub-list
  var items = document.querySelectorAll('.section-help-dropdown-sublist-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('active');
  }
  if (event && event.target) event.target.classList.add('active');
  // Collapse sub-list
  var list = document.getElementById('sectionOpenToList');
  if (list) list.style.display = 'none';
}
```

- [ ] **Step 3: Integrate skipLanding into showView**

In the `showView` function, find the landing page interception block (~line 65347-65357):

```javascript
  if (sidebarMode === 'expanded' && _pageLandingConfigs[view]) {
    if (!window._skipPageLanding) {
```

Add the section prefs check right after the `if (!window._skipPageLanding)` line:

```javascript
      // v26.2: Check section prefs for skip landing
      var _sectionPrefs = getSectionPrefs(view);
      if (_sectionPrefs && _sectionPrefs.skipLanding) {
        window._skipPageLanding = true;
        showView(view);
        if (_sectionPrefs.defaultPill && _pageLandingConfigs[view].tabHandler) {
          var handler = _pageLandingConfigs[view].tabHandler;
          if (typeof window[handler] === 'function') {
            window[handler](_sectionPrefs.defaultPill);
          }
        }
        return;
      }
```

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.2: replace section help modal with dropdown, add skip landing + default pill"
```

---

### Task 6: HTML + JS -- Settings UI (selector style picker + logo upload)

**Files:**
- Modify: `RoweOS/dist/index.html:57592-57717` (Settings > Preferences HTML)
- Modify: `RoweOS/dist/index.html:56655-57572` (Settings > Appearance HTML)

- [ ] **Step 1: Add selector style picker to Settings > Preferences**

Find the Preferences folder HTML (line ~57717, before the closing `</div><!-- /preferences folder -->`). Add before it:

```html
            <!-- v26.2: Navigation Selector Style -->
            <div class="settings-row" style="margin-top:var(--space-4);">
              <div class="settings-row-label">Navigation style</div>
              <div class="settings-row-desc">Choose between pill capsules or squircle buttons for section tabs</div>
              <div class="selector-style-options" id="selectorStyleOptions">
                <div class="selector-style-option" data-style="pills" onclick="setSelectorStyle('pills'); renderSelectorStylePicker();">
                  <div style="margin-bottom:6px;display:flex;gap:4px;justify-content:center;">
                    <span style="padding:3px 8px;border-radius:12px;border:1px solid var(--border-color);font-size:10px;">Tab A</span>
                    <span style="padding:3px 8px;border-radius:12px;border:1px solid var(--brand-accent);font-size:10px;color:var(--brand-accent);">Tab B</span>
                  </div>
                  Pills
                </div>
                <div class="selector-style-option" data-style="squircles" onclick="setSelectorStyle('squircles'); renderSelectorStylePicker();">
                  <div style="margin-bottom:6px;display:flex;gap:4px;justify-content:center;">
                    <span style="padding:3px 8px;border-radius:6px;font-size:10px;color:var(--text-muted);">Tab A</span>
                    <span style="padding:3px 8px;border-radius:6px;font-size:10px;background:var(--brand-accent);color:#fff;">Tab B</span>
                  </div>
                  Squircles
                </div>
              </div>
            </div>
```

- [ ] **Step 2: Add renderSelectorStylePicker function**

```javascript
// v26.2: Render selector style picker active state
function renderSelectorStylePicker() {
  var current = getSelectorStyle();
  var options = document.querySelectorAll('.selector-style-option');
  for (var i = 0; i < options.length; i++) {
    options[i].classList.toggle('active', options[i].getAttribute('data-style') === current);
  }
}
```

Call `renderSelectorStylePicker()` and `renderLogoUploadPreviews()` when Settings view opens (in the `if (view === 'settings')` block in showView). Note: `logoLight` is stored as a property on the brand object. Since `saveBrands()` serializes the entire brands array to localStorage and Firestore, `logoLight` is automatically included in sync -- no sync path changes needed.

- [ ] **Step 3: Add logo upload HTML to Settings > Appearance**

Find the Personalization section in Appearance (~line 56659). Add after the existing logo/accent color area:

```html
            <!-- v26.2: Dark/Light Mode Logos -->
            <div class="logo-upload-section">
              <div class="settings-row-label">Brand Logo</div>
              <div class="settings-row-desc" style="margin-bottom:var(--space-2);">Upload logos for dark and light mode themes</div>
              <label style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-3);cursor:pointer;">
                <input type="checkbox" id="logoSameForBoth" onchange="toggleLogoSameMode()" checked>
                <span style="font-size:12px;color:var(--text-secondary);">Use same logo for both modes</span>
              </label>
              <div class="logo-upload-slots" id="logoUploadSlots">
                <div class="logo-upload-slot">
                  <div class="logo-upload-slot-label">Dark Mode</div>
                  <div class="logo-upload-preview" id="logoDarkPreview">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </div>
                  <button class="logo-upload-btn" onclick="uploadBrandLogo('dark')">Upload</button>
                  <button class="logo-upload-btn" onclick="removeBrandLogo('dark')" style="color:var(--text-muted);">Remove</button>
                </div>
                <div class="logo-upload-slot" id="logoLightSlot" style="display:none;">
                  <div class="logo-upload-slot-label">Light Mode</div>
                  <div class="logo-upload-preview" id="logoLightPreview">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </div>
                  <button class="logo-upload-btn" onclick="uploadBrandLogo('light')">Upload</button>
                  <button class="logo-upload-btn" onclick="removeBrandLogo('light')" style="color:var(--text-muted);">Remove</button>
                </div>
              </div>
              <input type="file" id="logoFileInput" accept="image/png,image/jpeg,image/svg+xml" style="display:none;" onchange="handleLogoFileSelect(event)">
            </div>
```

- [ ] **Step 4: Add logo upload JS functions**

```javascript
// v26.2: Logo upload for dark/light modes
var _logoUploadMode = 'dark'; // which slot is being uploaded to

function toggleLogoSameMode() {
  var same = document.getElementById('logoSameForBoth');
  var lightSlot = document.getElementById('logoLightSlot');
  if (same && lightSlot) {
    lightSlot.style.display = same.checked ? 'none' : '';
  }
}

function uploadBrandLogo(mode) {
  _logoUploadMode = mode;
  var input = document.getElementById('logoFileInput');
  if (input) input.click();
}

function handleLogoFileSelect(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > 200 * 1024) {
    showToast('Logo must be under 200KB', 'error');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      // Resize to max 256x256
      var canvas = document.createElement('canvas');
      var maxSize = 256;
      var w = img.width;
      var h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/png');

      // Save to brand
      var brandIdx = parseInt(document.getElementById('brand').value);
      if (_logoUploadMode === 'light') {
        brands[brandIdx].logoLight = dataUrl;
      } else {
        brands[brandIdx].logo = dataUrl;
        // If "same for both" is checked, also clear light logo
        var same = document.getElementById('logoSameForBoth');
        if (same && same.checked) {
          delete brands[brandIdx].logoLight;
        }
      }
      saveBrands();
      swapLogoForTheme();
      renderLogoUploadPreviews();
      showToast('Logo updated', 'success');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  // Reset input so same file can be re-selected
  e.target.value = '';
}

function removeBrandLogo(mode) {
  var brandIdx = parseInt(document.getElementById('brand').value);
  if (mode === 'light') {
    delete brands[brandIdx].logoLight;
  } else {
    delete brands[brandIdx].logo;
  }
  saveBrands();
  swapLogoForTheme();
  renderLogoUploadPreviews();
  showToast('Logo removed', 'success');
}

function renderLogoUploadPreviews() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var darkPreview = document.getElementById('logoDarkPreview');
  var lightPreview = document.getElementById('logoLightPreview');
  var placeholder = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

  if (darkPreview) {
    darkPreview.innerHTML = '';
    if (brand.logo) {
      var dImg = document.createElement('img');
      dImg.src = brand.logo;
      dImg.alt = 'Dark logo';
      dImg.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      darkPreview.appendChild(dImg);
    } else {
      darkPreview.innerHTML = placeholder;
    }
  }
  if (lightPreview) {
    lightPreview.innerHTML = '';
    if (brand.logoLight) {
      var lImg = document.createElement('img');
      lImg.src = brand.logoLight;
      lImg.alt = 'Light logo';
      lImg.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      lightPreview.appendChild(lImg);
    } else {
      lightPreview.innerHTML = placeholder;
    }
  }

  // Update checkbox state
  var same = document.getElementById('logoSameForBoth');
  if (same) {
    same.checked = !brand.logoLight;
    toggleLogoSameMode();
  }
}

// v26.2: Swap logo based on current theme
function swapLogoForTheme() {
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  try { var brandEl = document.getElementById('brand'); if (brandEl) brandIdx = parseInt(brandEl.value); } catch(e) {}
  var brand = brands[brandIdx];
  var isLight = document.documentElement.classList.contains('light-mode');
  var logoToUse = (isLight && brand.logoLight) ? brand.logoLight : (brand.logo || '');

  // Update all logo display elements
  var logoEls = document.querySelectorAll('.sidebar-logo-img, #headerLogo, .brand-logo-display');
  for (var i = 0; i < logoEls.length; i++) {
    if (logoToUse) {
      logoEls[i].src = logoToUse;
    }
  }
}
```

- [ ] **Step 5: Hook swapLogoForTheme into theme toggle**

Find the theme toggle function (search for `toggleDarkMode` or `setTheme` or where `light-mode` class is toggled). Add `swapLogoForTheme()` call after the theme class is applied.

- [ ] **Step 6: Add Identity view link to Settings > Appearance**

In the Identity/Memory view HTML, find the brand profile section. Add:

```html
<div style="margin-top:var(--space-3);font-size:12px;">
  <a href="#" onclick="showView('settings'); setTimeout(function(){ openSettingsFolder('appearance'); }, 100); return false;" style="color:var(--brand-accent, #a89878);text-decoration:none;">
    Change logo in Settings > Appearance
  </a>
</div>
```

- [ ] **Step 7: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.2: add selector style picker and dark/light logo upload"
```

---

### Task 7: Fix Social Hub ? button alignment + audit all ? buttons

**Files:**
- Modify: `RoweOS/dist/index.html` -- Social Hub panel-header and others as needed

- [ ] **Step 1: Find and fix Social Hub ? button**

Search for the Social Hub view header (around where `showSectionHelp('social')` is called -- the ? button's onclick). Ensure the ? button follows the standard pattern: last item in `.panel-header`, using `class="section-help-btn"`.

- [ ] **Step 2: Audit all 17 ? button instances**

Check all 17 `showSectionHelp` onclick instances (lines: 52111, 52743, 53224, 53404, 54170, 54524, 55363, 55436, 55571, 55813, 55953, 56116, 56383, 56463, 56556, 56638, 58637). Verify each:
- Uses `class="section-help-btn"`
- Is inside a `.panel-header` with `display:flex;align-items:center`
- Is the last element in the header

Fix any that don't match the pattern.

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.2: fix Social Hub ? button alignment, audit all help buttons"
```

---

### Task 8: Integration testing + version bump

**Files:**
- Modify: `RoweOS/dist/index.html` (version constant)

- [ ] **Step 1: Verify pill/squircle toggle**

- Go to Settings > Preferences
- Toggle between Pills and Squircles
- Verify all pill navs across views change style immediately
- Verify squircle mode: no borders on inactive, solid fill on active, correct text contrast
- Verify pill mode: borders on all, subtle background on active (existing behavior)

- [ ] **Step 2: Verify Studio migration**

- Open Studio
- Verify agent tabs render correctly (All Agents, Strategy, Marketing, etc.)
- Verify clicking an agent tab selects it and filters operations
- In squircle mode: verify each agent fills with its own color (strategy = purple, marketing = pink, etc.)
- Verify LifeAI tabs also render and work

- [ ] **Step 3: Verify ? dropdown**

- Click ? on any view
- Verify dropdown appears with Tour and Feedback
- In expanded sidebar mode: verify Skip Landing toggle and Open To picker appear
- Toggle Skip Landing on, then navigate away and back -- verify landing page is skipped
- Set a default pill, navigate away and back -- verify correct pill activates

- [ ] **Step 4: Verify logo upload**

- Go to Settings > Appearance
- Upload a dark mode logo
- Verify it appears in sidebar/header
- Uncheck "Use same logo for both"
- Upload a light mode logo
- Toggle to light mode -- verify light logo shows
- Toggle back to dark mode -- verify dark logo shows

- [ ] **Step 5: Verify ? button consistency**

- Check Social Hub ? button is properly aligned
- Spot-check 5+ other views to confirm consistency

- [ ] **Step 6: Version bump to v26.2**

Update `ROWEOS_VERSION` from `v26.1` to `v26.2`.

- [ ] **Step 7: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.2: pill unification, section prefs, logo upload, help dropdown"
```
