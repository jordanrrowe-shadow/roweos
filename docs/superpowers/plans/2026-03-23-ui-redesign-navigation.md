# RoweOS UI Redesign: Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 20 sidebar items into 6 groups with split-panel landing pages and universal pill navigation to reduce UI overwhelm.

**Architecture:** Build reusable components (pill nav CSS, landing page renderer, breadcrumb manager), then restructure the sidebar HTML, then migrate each section's tab bars to pills. Each task produces a testable intermediate state -- old nav works until new nav replaces it.

**Tech Stack:** Vanilla JS (ES5), CSS custom properties, HTML -- all in `RoweOS/dist/index.html`

**Spec:** `docs/superpowers/specs/2026-03-23-ui-redesign-navigation-design.md`

**Critical rules (from CLAUDE.md):**
- ES5 only: no arrow functions, no let/const, no template literals
- No emojis: always inline SVG icons
- Tag changes with version: `// v26.0: Description`

---

### Task 1: Pill Nav CSS Component

**Files:**
- Modify: `RoweOS/dist/index.html` (CSS section, before line ~48023)

- [ ] **Step 1: Add pill nav CSS**

Before the closing `</style>` tag (~line 48023), add:

```css
/* v26.0: Universal Pill Navigation */
.pill-nav {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 16px 0 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}
.pill-nav-item {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  background: transparent;
  font-family: inherit;
}
.pill-nav-item:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}
.pill-nav-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.pill-nav-item.active {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  color: var(--text-primary);
}
.pill-nav-item.secondary {
  font-size: 12px;
  color: var(--text-tertiary);
  border-color: var(--bg-tertiary);
}
.pill-nav-item.secondary:hover {
  border-color: var(--accent);
  color: var(--text-secondary);
}
@media (max-width: 768px) {
  .pill-nav {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .pill-nav::-webkit-scrollbar { display: none; }
  .pill-nav-item { flex-shrink: 0; }
}
```

- [ ] **Step 2: Add landing page CSS**

```css
/* v26.0: Section Landing Pages */
.section-landing {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 36px;
  padding: 8px 0;
}
.section-landing-info {
  display: flex;
  flex-direction: column;
}
.section-landing-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: var(--accent);
  margin-bottom: 8px;
}
.section-landing-tagline {
  font-size: 26px;
  font-weight: 300;
  font-family: Georgia, serif;
  color: var(--text-primary);
  margin-bottom: 12px;
}
.section-landing-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 24px;
}
.section-landing-stats {
  display: flex;
  gap: 24px;
}
.section-landing-stat-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--accent);
}
.section-landing-stat-label {
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
}
.section-landing-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.section-landing-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
}
.section-landing-card:hover {
  border-color: var(--accent);
  background: var(--bg-secondary);
}
.section-landing-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.section-landing-card-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.section-landing-card-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}
.section-landing-card-desc {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.section-landing-card-badge {
  margin-left: auto;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
}
.section-landing-secondary {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.section-landing-secondary-pill {
  flex: 1;
  border: 1px solid var(--bg-tertiary);
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  transition: border-color 0.2s;
}
.section-landing-secondary-pill:hover {
  border-color: var(--accent);
}
@media (max-width: 768px) {
  .section-landing {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add pill nav and landing page CSS components"
```

---

### Task 2: Pill Nav JS Component

**Files:**
- Modify: `RoweOS/dist/index.html` (JS section)

- [ ] **Step 1: Add renderPillNav function**

In the JS section (after the view management functions, around line ~63800), add:

```javascript
// v26.0: Universal Pill Navigation renderer
// items: [{id, label, secondary}], activeId: string, onSelect: function(id)
function renderPillNav(containerId, items, activeId, onSelect) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var html = '<div class="pill-nav" role="tablist">';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var isActive = item.id === activeId;
    var cls = 'pill-nav-item' + (isActive ? ' active' : '') + (item.secondary ? ' secondary' : '');
    html += '<button class="' + cls + '" role="tab" aria-selected="' + isActive + '" tabindex="' + (isActive ? '0' : '-1') + '" data-pill-id="' + escapeHtml(item.id) + '" onclick="handlePillNavClick(this, \'' + escapeHtml(containerId) + '\')">' + escapeHtml(item.label) + '</button>';
  }
  html += '</div>';
  container.innerHTML = html;

  // Store callback
  if (!window._pillNavCallbacks) window._pillNavCallbacks = {};
  window._pillNavCallbacks[containerId] = onSelect;
}

function handlePillNavClick(btn, containerId) {
  var pillId = btn.getAttribute('data-pill-id');
  // Update active states
  var pills = btn.parentElement.querySelectorAll('.pill-nav-item');
  for (var i = 0; i < pills.length; i++) {
    pills[i].classList.remove('active');
    pills[i].setAttribute('aria-selected', 'false');
    pills[i].setAttribute('tabindex', '-1');
  }
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
  btn.setAttribute('tabindex', '0');

  // Call the registered callback
  if (window._pillNavCallbacks && window._pillNavCallbacks[containerId]) {
    window._pillNavCallbacks[containerId](pillId);
  }
}
```

- [ ] **Step 2: Add keyboard navigation for pills**

```javascript
// v26.0: Arrow key navigation for pill nav
document.addEventListener('keydown', function(e) {
  if (e.target && e.target.classList && e.target.classList.contains('pill-nav-item')) {
    var pills = e.target.parentElement.querySelectorAll('.pill-nav-item');
    var idx = -1;
    for (var i = 0; i < pills.length; i++) {
      if (pills[i] === e.target) { idx = i; break; }
    }
    if (e.key === 'ArrowRight' && idx < pills.length - 1) {
      e.preventDefault();
      pills[idx + 1].focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      pills[idx - 1].focus();
    }
  }
});
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add renderPillNav JS component with keyboard navigation"
```

---

### Task 3: Breadcrumb Navigation Manager

**Files:**
- Modify: `RoweOS/dist/index.html` (JS section)

- [ ] **Step 1: Verify breadcrumb CSS exists**

The codebase has `.breadcrumb` and `.breadcrumb-item` CSS at line ~10607. The landing page HTML uses `class="section-breadcrumb breadcrumb"` so it inherits these styles. Verify the existing CSS covers: `font-size: 12px`, separator `›`, accent color for active item. If not, add any missing styles.

- [ ] **Step 2: Add breadcrumb state and renderer**

```javascript
// v26.0: Breadcrumb navigation manager
var _navBreadcrumb = ['Home'];

function updateNavBreadcrumb(path) {
  _navBreadcrumb = path;
  renderNavBreadcrumb();
}

function renderNavBreadcrumb() {
  // Find all breadcrumb containers in visible views
  var containers = document.querySelectorAll('.section-breadcrumb');
  for (var i = 0; i < containers.length; i++) {
    var html = '';
    for (var j = 0; j < _navBreadcrumb.length; j++) {
      var isLast = j === _navBreadcrumb.length - 1;
      if (isLast) {
        html += '<span class="breadcrumb-item active">' + escapeHtml(_navBreadcrumb[j]) + '</span>';
      } else {
        html += '<span class="breadcrumb-item"><a href="#" onclick="navigateBreadcrumb(' + j + '); return false;">' + escapeHtml(_navBreadcrumb[j]) + '</a></span>';
      }
    }
    containers[i].innerHTML = html;
  }
}

function navigateBreadcrumb(index) {
  if (index === 0) {
    // Home -- go to BrandAI
    showView('agent');
    _navBreadcrumb = ['Home'];
  } else if (index === 1) {
    // Group level -- show landing page
    var group = _navBreadcrumb[1];
    showSectionLanding(group);
  }
  // Sub-section clicks are handled by the pill nav
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add breadcrumb navigation manager"
```

---

### Task 4: Section Landing Page Renderer

**Files:**
- Modify: `RoweOS/dist/index.html` (JS section + HTML for landing view container)

- [ ] **Step 1: Add landing page HTML container**

Find the panel views section. Add a new generic landing page view panel (after the existing views, before the modals):

```html
<!-- v26.0: Section Landing Page View -->
<div id="sectionLandingView" class="panel-view hidden">
  <div class="panel">
    <div class="section-breadcrumb breadcrumb"></div>
    <div id="sectionLandingContent"></div>
  </div>
</div>
```

- [ ] **Step 2: Add section configurations**

```javascript
// v26.0: Section group configurations for landing pages
var _sectionGroups = {
  'Core': {
    label: 'CORE',
    tagline: 'Your brand at a glance',
    description: 'Monitor brand health, track daily focus items, and manage your schedule.',
    features: [
      { id: 'signal', label: 'Focus', desc: 'Daily intelligence dashboard', icon: 'focus' },
      { id: 'pulse', label: 'Pulse', desc: 'Brand health metrics', icon: 'pulse' },
      { id: 'rhythm', label: 'Rhythm', desc: 'Calendar and event management', icon: 'rhythm' }
    ],
    secondary: []
  },
  'Create': {
    label: 'CREATE',
    tagline: 'Make things happen',
    description: 'Content generation, social media management, automation pipelines, and growth tools.',
    features: [
      { id: 'studio', label: 'Studio', desc: 'Generate content with specialized agents', icon: 'studio' },
      { id: 'social', label: 'Social Hub', desc: 'Monitor, engage, and publish across platforms', icon: 'social' },
      { id: 'automations', label: 'Automations', desc: 'Multi-step AI workflows and pipelines', icon: 'automations' },
      { id: 'bloom', label: 'Bloom', desc: 'Growth algorithm and audience building', icon: 'bloom' }
    ],
    secondary: []
  },
  'Orchestration': {
    label: 'ORCHESTRATION',
    tagline: 'Content, correspondence, and collections',
    description: 'Manage your content library, portfolio, and email across all connected accounts.',
    features: [
      { id: 'library', label: 'Library', desc: 'Content storage and organization', icon: 'library' },
      { id: 'folio', label: 'Folio', desc: 'Portfolio and brand showcase', icon: 'folio' },
      { id: 'mail', label: 'Mail', desc: 'Email across all connected accounts', icon: 'mail' }
    ],
    secondary: []
  },
  'Intelligence': {
    label: 'INTELLIGENCE',
    tagline: 'Know your brand inside out',
    description: 'Brand memory, conversation history, and safety guardrails.',
    features: [
      { id: 'memory', label: 'Identity', desc: 'Brand memory and profile settings', icon: 'identity' },
      { id: 'tuning', label: 'History', desc: 'Conversation log and AI tuning', icon: 'history' },
      { id: 'guardrails', label: 'Guardrails', desc: 'Brand safety and governance rules', icon: 'guardrails' }
    ],
    secondary: []
  },
  'Governance': {
    label: 'GOVERNANCE',
    tagline: 'Configure, measure, and manage',
    description: 'Contacts, analytics, inventory, sync status, and system settings.',
    features: [
      { id: 'clients', label: 'People', desc: 'Contacts and client management', icon: 'people' },
      { id: 'commerce', label: 'Analytics', desc: 'Business metrics and revenue', icon: 'analytics' },
      { id: 'inventory', label: 'Inventory', desc: 'Asset and product management', icon: 'inventory' },
      { id: 'sync', label: 'Sync', desc: 'Cross-device sync status', icon: 'sync' },
      { id: 'settings', label: 'System', desc: 'Configuration and preferences', icon: 'system' }
    ],
    secondary: [],
    // v26.0: Admin is conditional -- only shown for admin users
    conditional: [
      { id: 'admin', label: 'Admin', desc: 'Platform administration', icon: 'admin', condition: 'isAdmin' }
    ]
  }
};

// NOTE: In showSectionLanding(), check if conditional items should be shown
// (e.g., if user has admin role, append conditional items to features array)
```

Also in the `showSectionLanding` function, add after building the features cards:

```javascript
  // v26.0: Add conditional items (e.g., Admin for admin users)
  if (group.conditional) {
    for (var ci = 0; ci < group.conditional.length; ci++) {
      var cf = group.conditional[ci];
      // Check condition (agent must implement actual admin check)
      if (cf.condition === 'isAdmin' && document.querySelector('[data-view="admin"]') && document.querySelector('[data-view="admin"]').style.display !== 'none') {
        // Render card same as features
      }
    }
  }
```

NOTE: The `id` values must match the existing `data-view` attribute values used by `showView()`. The agent MUST verify each id against the actual sidebar HTML (e.g., Focus uses `signal`, Identity uses `memory`, Analytics uses `commerce`, People uses `clients`).

- [ ] **Step 3: Add showSectionLanding function**

```javascript
// v26.0: Render section landing page
function showSectionLanding(groupName) {
  var group = _sectionGroups[groupName];
  if (!group) { showView('agent'); return; }

  updateNavBreadcrumb(['Home', groupName]);

  var html = '<div class="section-landing">';

  // Left: Info
  html += '<div class="section-landing-info">';
  html += '<div class="section-landing-label">' + escapeHtml(group.label) + '</div>';
  html += '<div class="section-landing-tagline">' + escapeHtml(group.tagline) + '</div>';
  html += '<div class="section-landing-desc">' + escapeHtml(group.description) + '</div>';
  // Stats placeholder -- the agent should add real stats calls per section
  html += '<div class="section-landing-stats" id="sectionLandingStats"></div>';
  html += '</div>';

  // Right: Navigation cards
  html += '<div class="section-landing-nav">';
  for (var i = 0; i < group.features.length; i++) {
    var f = group.features[i];
    html += '<div class="section-landing-card" tabindex="0" role="link" onclick="navigateToSubSection(\'' + escapeHtml(groupName) + '\', \'' + escapeHtml(f.id) + '\')" onkeydown="if(event.key===\'Enter\')this.click()">';
    html += '<div class="section-landing-card-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + getSectionIcon(f.icon) + '</svg></div>';
    html += '<div><div class="section-landing-card-title">' + escapeHtml(f.label) + '</div>';
    html += '<div class="section-landing-card-desc">' + escapeHtml(f.desc) + '</div></div>';
    html += '</div>';
  }

  // Secondary pills
  if (group.secondary && group.secondary.length > 0) {
    html += '<div class="section-landing-secondary">';
    for (var j = 0; j < group.secondary.length; j++) {
      var s = group.secondary[j];
      html += '<div class="section-landing-secondary-pill" onclick="navigateToSubSection(\'' + escapeHtml(groupName) + '\', \'' + escapeHtml(s.id) + '\')">' + escapeHtml(s.label) + '</div>';
    }
    html += '</div>';
  }

  html += '</div></div>';

  document.getElementById('sectionLandingContent').innerHTML = html;

  // Show the landing view (hide all others)
  showView('sectionLanding');
}

function navigateToSubSection(groupName, viewId) {
  var group = _sectionGroups[groupName];
  if (!group) return;
  // Find the feature label for breadcrumb
  var featureLabel = viewId;
  for (var i = 0; i < group.features.length; i++) {
    if (group.features[i].id === viewId) { featureLabel = group.features[i].label; break; }
  }
  if (group.secondary) {
    for (var j = 0; j < group.secondary.length; j++) {
      if (group.secondary[j].id === viewId) { featureLabel = group.secondary[j].label; break; }
    }
  }
  updateNavBreadcrumb(['Home', groupName, featureLabel]);
  showView(viewId);
}
```

- [ ] **Step 4: Add getSectionIcon helper**

The agent should create a function that returns SVG path content for each icon name. Use existing SVG icons from the sidebar. Read the actual sidebar icon SVGs and map them:

```javascript
function getSectionIcon(iconName) {
  var icons = {
    focus: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    pulse: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    rhythm: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>',
    // ... agent must complete all icons by reading existing sidebar SVGs
  };
  return icons[iconName] || '<circle cx="12" cy="12" r="10"/>';
}
```

NOTE: The agent MUST read the actual sidebar icon SVGs from lines 48050-48280 and extract the path/shape content for each nav item.

- [ ] **Step 5: Update showView() to handle sectionLandingView**

CRITICAL: The `allViews` array in `showView()` (~line 63817) must include `'sectionLanding'`. Without this, calling `showView('sectionLanding')` will hide all views but never show the landing page.

Add `'sectionLanding'` to the `allViews` array.

Also update the sidebar active-state highlighting logic (~lines 63809-63814) to handle grouped mode. When a sub-section view is shown (e.g., `showView('signal')`), find which group contains it and highlight that group item:

```javascript
  // v26.0: Highlight parent group in grouped sidebar mode
  if (_sidebarMode === 'grouped') {
    var groupItems = document.querySelectorAll('.nav-item[data-group]');
    for (var gi = 0; gi < groupItems.length; gi++) {
      groupItems[gi].classList.remove('active');
      var subitems = groupItems[gi].querySelectorAll('.nav-subitem');
      for (var si = 0; si < subitems.length; si++) {
        if (subitems[si].getAttribute('data-view') === view) {
          groupItems[gi].classList.add('active');
          break;
        }
      }
    }
  }
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add section landing page renderer with group configs"
```

---

### Task 5: Restructure Sidebar HTML

**Files:**
- Modify: `RoweOS/dist/index.html:48050-48281` (sidebar nav HTML)

- [ ] **Step 1: Replace sidebar nav with grouped structure**

Replace the contents of `<nav class="sidebar-nav">` (lines 48050-48281) with the new 6-group structure. Each group item should:
- Use the same `nav-item` CSS class for consistent styling
- Have `data-group` attribute with group name
- Have `onclick="showSectionLanding('GroupName')"`
- Use the same icon SVG style as existing nav items

```html
<nav class="sidebar-nav" id="sidebarNav">
  <!-- BrandAI (home, direct) -->
  <div class="nav-section">
    <div class="nav-item active" data-view="agent" onclick="showView('agent')">
      <!-- existing BrandAI icon SVG -->
      <span class="nav-label">BrandAI</span>
    </div>
  </div>

  <!-- v26.0: Grouped navigation -->
  <div class="nav-section">
    <div class="nav-section-title">CORE</div>
    <div class="nav-item" data-group="Core" onclick="showSectionLanding('Core')">
      <!-- compass/circle icon -->
      <span class="nav-label">Core</span>
      <!-- v26.0: Expandable sub-items (hidden by default in grouped mode) -->
      <div class="nav-subitems" style="display:none;">
        <div class="nav-subitem" data-view="signal" onclick="event.stopPropagation(); navigateToSubSection('Core','signal')">Focus</div>
        <div class="nav-subitem" data-view="pulse" onclick="event.stopPropagation(); navigateToSubSection('Core','pulse')">Pulse</div>
        <div class="nav-subitem" data-view="rhythm" onclick="event.stopPropagation(); navigateToSubSection('Core','rhythm')">Rhythm</div>
      </div>
    </div>
  </div>

  <!-- Repeat for Create, Orchestration, Intelligence, Governance -->
  <!-- Agent must build all 5 groups following the same pattern -->
  <!-- Admin item goes under Governance with style="display:none;" preserved -->
</nav>
```

IMPORTANT: The agent MUST:
1. Read the existing sidebar HTML (lines 48050-48281) to get the exact SVG icons
2. Preserve the BrandAI item exactly as it is (first item, active by default)
3. Preserve the notification center section (below the groups, separated by divider)
4. Preserve the sidebar footer (version, search, API diamond)
5. Keep all existing `data-view` attributes on sub-items for expanded mode
6. Add `data-group` attributes on group items
7. Copy the notification center markup (lines ~48247-48249, the `nc-nav-item` bell icon) below the new grouped nav, separated by a divider -- DO NOT DELETE IT
8. Copy the sidebar footer (version, search, API diamond, lines ~48282-48305) after the notification center

- [ ] **Step 2: Add sidebar mode toggle JS**

```javascript
// v26.0: Sidebar expanded/grouped mode
var _sidebarMode = localStorage.getItem('roweos_sidebar_mode') || 'grouped';

function toggleSidebarSubitems(groupEl) {
  if (_sidebarMode !== 'expanded') return;
  var subitems = groupEl.querySelector('.nav-subitems');
  if (!subitems) return;
  var isOpen = subitems.style.display !== 'none';
  subitems.style.display = isOpen ? 'none' : 'block';
  var key = 'roweos_sidebar_expanded_' + groupEl.getAttribute('data-group');
  localStorage.setItem(key, isOpen ? 'false' : 'true');
}

function applySidebarMode() {
  var navItems = document.querySelectorAll('.nav-item[data-group]');
  for (var i = 0; i < navItems.length; i++) {
    var item = navItems[i];
    var group = item.getAttribute('data-group');
    var subitems = item.querySelector('.nav-subitems');
    if (!subitems) continue;

    if (_sidebarMode === 'expanded') {
      var isExpanded = localStorage.getItem('roweos_sidebar_expanded_' + group) === 'true';
      subitems.style.display = isExpanded ? 'block' : 'none';
      // In expanded mode, clicking group toggles sub-items instead of showing landing
      item.onclick = function() { toggleSidebarSubitems(this); };
    } else {
      subitems.style.display = 'none';
      // In grouped mode, clicking group shows landing page
      item.onclick = function() { showSectionLanding(this.getAttribute('data-group')); };
    }
  }
}
```

- [ ] **Step 3: Call applySidebarMode on init**

Find the app initialization section. Add `applySidebarMode();` after the sidebar is rendered.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: restructure sidebar to 6 groups with expandable sub-items"
```

---

### Task 6: Migrate Social Hub Tab Bar to Pill Nav

**Files:**
- Modify: `RoweOS/dist/index.html:57486-57495` (Social Hub tabs HTML)
- Modify: `RoweOS/dist/index.html:177132-177153` (showSocialTab function)

- [ ] **Step 1: Replace Social Hub tab bar HTML**

Replace the `social-hub-tabs` div (lines 57486-57495) with a pill nav container:

```html
<div id="socialHubPillNav"></div>
```

- [ ] **Step 2: Update Social Hub initialization to render pills**

Find where the Social Hub view initializes (in `showView` when social is selected, ~line 63895). Add pill rendering:

```javascript
// v26.0: Render pill nav for Social Hub
renderPillNav('socialHubPillNav', [
  { id: 'engage', label: 'Engage' },
  { id: 'publish', label: 'Publish' },
  { id: 'create', label: 'Create' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'blog', label: 'Blog', secondary: true },
  { id: 'activity', label: 'Activity', secondary: true },
  { id: 'media', label: 'Media', secondary: true },
  { id: 'settings', label: 'Settings', secondary: true }
], 'engage', function(tabId) { showSocialTab(tabId); });
```

- [ ] **Step 3: Update showSocialTab to work with pills**

The existing `showSocialTab()` function handles the panel switching logic. It currently also toggles `.active` on button elements. Update it to skip the button toggling (the pill nav handles its own active state):

Find lines 177133-177136 where it toggles button active classes. Wrap in a check:

```javascript
  // v26.0: Only toggle old-style buttons if they exist (pill nav handles its own state)
  var oldTabs = document.querySelectorAll('.social-hub-tab');
  if (oldTabs.length > 0) {
    // existing toggle logic
  }
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: migrate Social Hub tabs to pill navigation"
```

---

### Task 7: Migrate Mail Tab Bar to Pill Nav

**Files:**
- Modify: `RoweOS/dist/index.html` (Mail tabs HTML ~line 57965, Mail JS)

- [ ] **Step 1: Replace Mail tab bar with pill nav container**

Replace the `mailTabsContainer` div with:

```html
<div id="mailPillNav"></div>
```

- [ ] **Step 2: Add pill rendering to Mail initialization**

Find where Mail view initializes (in `showView` ~line 63873). Add:

```javascript
renderPillNav('mailPillNav', [
  { id: 'inbox', label: 'Inbox' },
  { id: 'compose', label: 'Compose' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'sent', label: 'Sent', secondary: true },
  { id: 'outbox', label: 'Outbox', secondary: true },
  { id: 'settings', label: 'Settings', secondary: true }
], 'inbox', function(tabId) { switchMailTab(tabId); });
```

NOTE: The agent must read the existing Mail tab switching function name and behavior. It may be `showMailTab()`, `switchMailTab()`, or inline onclick handlers. Adapt accordingly.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: migrate Mail tabs to pill navigation"
```

---

### Task 8: Migrate Automations Tab Bar to Pill Nav

**Files:**
- Modify: `RoweOS/dist/index.html` (Automations tabs ~line 55759, buildAutoLabTabs JS ~line 97546)

- [ ] **Step 1: Replace dynamic tab builder with pill nav**

Find `buildAutoLabTabs()` (~line 97546). This function dynamically builds tab buttons into `autoLabTabsContainer`. Either:
- Replace the function body to call `renderPillNav()` instead, OR
- Add a pill nav container in the HTML and render pills alongside

```javascript
// v26.0: Replace buildAutoLabTabs with pill nav
function buildAutoLabTabs() {
  renderPillNav('autoLabTabsContainer', [
    { id: 'workflows', label: 'Workflows' },
    { id: 'agents', label: 'Agents' },
    { id: 'scheduler', label: 'Scheduler' },
    { id: 'imageLab', label: 'Image Lab', secondary: true },
    { id: 'videoLab', label: 'Video Lab', secondary: true },
    { id: 'usage', label: 'Usage', secondary: true }
  ], 'workflows', function(tabId) { showAutoLabTab(tabId); });
}
```

NOTE: The agent must verify the actual tab IDs and the tab-switching function name by reading the existing `buildAutoLabTabs()` implementation.

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: migrate Automations tabs to pill navigation"
```

---

### Task 9: Migrate Remaining Views to Pill Nav

**Files:**
- Modify: `RoweOS/dist/index.html` (any remaining tab bars)

- [ ] **Step 1: Audit all remaining tab bars**

Search for all tab bar patterns in index.html:
```bash
grep -n 'class=".*tabs\|tab-bar\|tabsContainer' RoweOS/dist/index.html | head -30
```

For each found tab bar that hasn't been migrated, replace with `renderPillNav()`.

Views to check: Studio, System/Settings, Focus, Pulse, Folio, any others with tabs.

NOTE: System/Settings uses a folder-based navigation (not tabs). Leave it as-is -- it already has the card-based layout that matches the landing page concept.

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: migrate remaining tab bars to pill navigation"
```

---

### Task 10: Settings Toggle + Onboarding Choice

**Files:**
- Modify: `RoweOS/dist/index.html` (Settings Appearance section ~line 56074, Onboarding modal ~line 48496)

- [ ] **Step 1: Add sidebar mode toggle to Settings > Appearance**

After the Font Style toggle (~line 56107), add:

```html
<!-- v26.0: Sidebar Navigation Mode -->
<div class="settings-row">
  <div class="settings-row-label">Navigation Style</div>
  <div class="settings-row-control">
    <select id="sidebarModeSelect" onchange="setSidebarMode(this.value)">
      <option value="grouped">Grouped (Simple)</option>
      <option value="expanded">Expanded (Advanced)</option>
    </select>
  </div>
</div>
```

- [ ] **Step 2: Add setSidebarMode function**

```javascript
function setSidebarMode(mode) {
  _sidebarMode = mode;
  localStorage.setItem('roweos_sidebar_mode', mode);
  applySidebarMode();
}
```

- [ ] **Step 3: Initialize the select value on Settings render**

In the Settings init function, add:
```javascript
var modeSelect = document.getElementById('sidebarModeSelect');
if (modeSelect) modeSelect.value = _sidebarMode;
```

- [ ] **Step 4: Add onboarding choice (optional)**

In the onboarding modal, after the Brand/Life mode selection completes, add a navigation preference step. This is lower priority -- the Setting toggle is the primary mechanism.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add sidebar mode toggle in Settings, onboarding choice"
```

---

### Task 11: Version Bump + Deploy

- [ ] **Step 1: Update ROWEOS_VERSION**

Change `var ROWEOS_VERSION = 'v25.6';` to `var ROWEOS_VERSION = 'v26.0';`

- [ ] **Step 2: Verify no ES5 violations**

```bash
grep -n 'const \|let \|=>\|`' RoweOS/dist/index.html | tail -20
```

- [ ] **Step 3: Deploy**

```bash
cd /Volumes/roweOS && ./deploy.sh
```

- [ ] **Step 4: Commit version bump**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "chore: bump version to v26.0 -- navigation redesign"
```
