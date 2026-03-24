# Full Customization Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Customized workspace mode with sidebar reordering, group renaming, pill reordering, premium visibility toggle, and onboarding workspace style selection.

**Architecture:** Third sidebar nav element (`#sidebarNavCustom`) rendered dynamically from JSON data model. Inline drag-and-drop for sidebar customization + settings panel for deeper edits. Pill reorder via ? dropdown with saved order in section prefs. Onboarding extended with workspace style step.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5 only), single-file app at `/Volumes/roweOS/RoweOS/dist/index.html`

**Spec:** `docs/superpowers/specs/2026-03-24-customization-mode-design.md`

---

### Task 1: CSS -- Sidebar customize mode, pill reorder, settings layout

**Files:**
- Modify: `RoweOS/dist/index.html` -- insert after v26.2 CSS additions

- [ ] **Step 1: Add sidebar customize mode CSS**

```css
/* v26.3: Sidebar customize mode */
.sidebar-customize-btn {
  display: none;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  text-align: center;
  border-top: 1px solid rgba(255,255,255,0.06);
  margin-top: 8px;
}
html[data-sidebar-mode="customized"] .sidebar-customize-btn {
  display: block;
}
.sidebar-customize-btn:hover {
  color: var(--brand-accent, #a89878);
}
html.light-mode .sidebar-customize-btn {
  border-color: rgba(0,0,0,0.06);
}
@media (max-width: 768px) {
  .sidebar-customize-btn { display: none !important; }
}

/* Drag handles and remove buttons -- hidden until customize mode */
.sidebar-drag-handle,
.sidebar-item-remove {
  display: none;
}
body.sidebar-customize-mode .sidebar-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  color: var(--text-muted);
  opacity: 0.5;
  flex-shrink: 0;
  width: 16px;
}
body.sidebar-customize-mode .sidebar-drag-handle:active {
  cursor: grabbing;
}
body.sidebar-customize-mode .sidebar-item-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s;
  width: 16px;
  flex-shrink: 0;
}
body.sidebar-customize-mode .nav-item:hover .sidebar-item-remove {
  opacity: 0.6;
}
body.sidebar-customize-mode .sidebar-item-remove:hover {
  opacity: 1;
  color: #ef4444;
}

/* Editable group headers */
body.sidebar-customize-mode .nav-section-title {
  cursor: text;
  border-bottom: 1px dashed rgba(168,152,120,0.3);
  padding-bottom: 2px;
}
body.sidebar-customize-mode .nav-section-title:focus {
  outline: none;
  border-color: var(--brand-accent, #a89878);
}

/* Drop indicator */
.sidebar-drop-indicator {
  height: 2px;
  background: var(--brand-accent, #a89878);
  border-radius: 1px;
  margin: 2px 8px;
  display: none;
}
.sidebar-drop-indicator.visible {
  display: block;
}

/* Available items pool */
.sidebar-available-pool {
  border-top: 1px solid rgba(255,255,255,0.06);
  margin-top: 8px;
  padding-top: 8px;
}
html.light-mode .sidebar-available-pool {
  border-color: rgba(0,0,0,0.06);
}
.sidebar-pool-header {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.sidebar-pool-item {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sidebar-pool-item:hover {
  color: var(--text-secondary);
  background: rgba(255,255,255,0.04);
}

/* Add group button */
.sidebar-add-group-btn {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--brand-accent, #a89878);
  cursor: pointer;
  display: none;
  text-align: center;
}
body.sidebar-customize-mode .sidebar-add-group-btn {
  display: block;
}
```

- [ ] **Step 2: Add pill reorder mode CSS**

```css
/* v26.3: Pill reorder mode */
.pill-nav.pill-reorder-mode {
  border: 2px dashed rgba(168,152,120,0.3);
  border-radius: 12px;
  padding: 12px;
}
.pill-nav.pill-reorder-mode .pill-nav-item {
  cursor: grab;
}
.pill-nav.pill-reorder-mode .pill-nav-item:active {
  cursor: grabbing;
  opacity: 0.7;
}
.pill-nav.pill-reorder-mode .pill-nav-item.dragging {
  opacity: 0.4;
}
.pill-reorder-done-btn {
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--brand-accent, #a89878);
  background: rgba(168,152,120,0.15);
  color: var(--brand-accent, #a89878);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Add settings sidebar layout CSS**

```css
/* v26.3: Settings sidebar layout editor */
.settings-sidebar-layout {
  margin-top: var(--space-4);
}
.settings-sidebar-group {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-bottom: 10px;
}
html.light-mode .settings-sidebar-group {
  background: rgba(0,0,0,0.02);
  border-color: rgba(0,0,0,0.08);
}
.settings-sidebar-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.settings-sidebar-group-header input {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.15);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  padding: 2px 4px;
  outline: none;
  width: 120px;
}
.settings-sidebar-group-header input:focus {
  border-color: var(--brand-accent, #a89878);
}
html.light-mode .settings-sidebar-group-header input {
  border-color: rgba(0,0,0,0.15);
}
.settings-sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: grab;
}
.settings-sidebar-item:hover {
  background: rgba(255,255,255,0.04);
}
html.light-mode .settings-sidebar-item:hover {
  background: rgba(0,0,0,0.02);
}
.settings-sidebar-item .item-drag-handle {
  color: var(--text-muted);
  opacity: 0.4;
  cursor: grab;
}
.settings-sidebar-item .item-remove-btn {
  margin-left: auto;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.settings-sidebar-item:hover .item-remove-btn {
  opacity: 0.5;
}
.settings-sidebar-item .item-remove-btn:hover {
  opacity: 1;
  color: #ef4444;
}

/* Mobile move buttons (instead of drag) */
@media (max-width: 768px) {
  .settings-sidebar-item .item-drag-handle { display: none; }
  .settings-sidebar-item .item-move-btns { display: flex; gap: 4px; }
}
@media (min-width: 769px) {
  .settings-sidebar-item .item-move-btns { display: none; }
}

/* Onboarding workspace style cards */
.workspace-style-cards {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin: 24px 0;
}
.workspace-style-card {
  flex: 1;
  max-width: 200px;
  padding: 20px 16px;
  border-radius: 12px;
  border: 2px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.workspace-style-card:hover {
  border-color: rgba(168,152,120,0.3);
}
.workspace-style-card.selected {
  border-color: var(--brand-accent, #a89878);
  background: rgba(168,152,120,0.08);
}
.workspace-style-card svg {
  margin-bottom: 12px;
  color: var(--text-muted);
}
.workspace-style-card.selected svg {
  color: var(--brand-accent, #a89878);
}
.workspace-style-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.workspace-style-card-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}
html.light-mode .workspace-style-card {
  border-color: rgba(0,0,0,0.08);
  background: rgba(0,0,0,0.02);
}
html.light-mode .workspace-style-card.selected {
  background: rgba(168,152,120,0.06);
}
```

- [ ] **Step 4: Add #sidebarNavCustom to sidebar state CSS selectors**

Search for `html.sidebar-pinned`, `html.sidebar-pinned-collapsed`, and `html.sidebar-hover-expanded` CSS rules. Each has a list of view selectors with `margin-left` or `left` values. Add `#sidebarNavCustom` to each rule set.

Specifically, find each rule that targets `#sidebarNavExpanded` and duplicate it for `#sidebarNavCustom`. For example:

```css
/* Add alongside existing #sidebarNavExpanded rules in each state: */
html.sidebar-pinned #sidebarNavCustom { /* same styles as #sidebarNavExpanded */ }
html.sidebar-pinned-collapsed #sidebarNavCustom { /* same styles */ }
html.sidebar-hover-expanded #sidebarNavCustom { /* same styles */ }
```

Also add `#sidebarNavCustom` to any view panel `margin-left`/`left` selectors -- these have long lists of view IDs. Search for `#signalView` in these rules to find the exact pattern, and add `#sidebarNavCustom` to the selector list where `#sidebarNavExpanded` appears. This is CRITICAL -- missing it causes content to bleed behind the sidebar.

- [ ] **Step 5: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.3: add CSS for sidebar customize, pill reorder, settings layout, onboarding style cards"
```

---

### Task 2: JS -- SIDEBAR_ICONS constant + data model + rendering

**Files:**
- Modify: `RoweOS/dist/index.html` -- add near sidebar functions

- [ ] **Step 1: Add SIDEBAR_ICONS constant**

Add near `AGENT_COLORS` (search for `var AGENT_COLORS`). Define icon markup for each viewId, extracted from the existing `#sidebarNavExpanded` HTML:

```javascript
// v26.3: Sidebar icon lookup (viewId -> icon markup)
var SIDEBAR_ICONS = {
  agent: '<span class="nav-item-icon">\u2726</span>',
  signal: '<span class="nav-item-icon">\u25C9</span>',
  pulse: '<span class="nav-item-icon">\u2756</span>',
  studio: '<span class="nav-item-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>',
  folio: '<span class="nav-item-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg></span>',
  rhythm: '<span class="nav-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>',
  library: '<span class="nav-item-icon">\u2261</span>',
  automations: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/><path d="M13 8l3-5M11 16l-3 5"/></svg></span>',
  mail: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg></span>',
  memory: '<span class="nav-item-icon">\u25C8</span>',
  tuning: '<span class="nav-item-icon">\u21BA</span>',
  guardrails: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>',
  clients: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>',
  commerce: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>',
  inventory: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>',
  sync: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9"/></svg></span>',
  settings: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>',
  bloom: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="svg-icon" style="width:16px;height:16px;"><ellipse cx="12" cy="6.5" rx="2.8" ry="4.5"/><ellipse cx="17" cy="10" rx="2.8" ry="4.5" transform="rotate(72 17 10)"/><ellipse cx="15.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(144 15.5 15.5)"/><ellipse cx="8.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(-144 8.5 15.5)"/><ellipse cx="7" cy="10" rx="2.8" ry="4.5" transform="rotate(-72 7 10)"/><circle cx="12" cy="11" r="2.2"/><path d="M12 14v8"/><path d="M10 18c-1.5-.5-2.5-1-3-2"/><path d="M14 18c1.5-.5 2.5-1 3-2"/></svg></span>',
  social: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="svg-icon" style="width:16px;height:16px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>',
  admin: '<span class="nav-item-icon svg-icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svg-icon" style="width:16px;height:16px;"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg></span>'
};

// v26.3: Sidebar label lookup (viewId -> display name)
var SIDEBAR_LABELS = {
  agent: 'BrandAI', signal: 'Focus', pulse: 'Pulse', studio: 'Studio',
  folio: 'Folio', rhythm: 'Rhythm', library: 'Library', automations: 'Automations',
  mail: 'Mail', memory: 'Identity', tuning: 'History', guardrails: 'Guardrails',
  clients: 'People', commerce: 'Analytics', inventory: 'Inventory', sync: 'Sync',
  settings: 'System', bloom: 'Bloom', social: 'Social Hub', admin: 'Admin'
};
```

- [ ] **Step 2: Add initCustomSidebar and default layout**

```javascript
// v26.3: Default custom sidebar layout (matches Expanded sidebar)
var DEFAULT_CUSTOM_SIDEBAR = {
  standalone: ['agent'],
  groups: [
    { id: 'core', label: 'Core', items: ['signal', 'pulse', 'studio', 'folio'] },
    { id: 'orchestration', label: 'Orchestration', items: ['rhythm', 'library', 'automations', 'mail'] },
    { id: 'intelligence', label: 'Intelligence', items: ['memory', 'tuning', 'guardrails'] },
    { id: 'governance', label: 'Governance', items: ['clients', 'commerce', 'inventory', 'sync', 'settings'] },
    { id: 'premium', label: 'Premium', items: ['bloom', 'social'] }
  ]
};

function initCustomSidebar() {
  var existing = null;
  try { existing = JSON.parse(localStorage.getItem('roweos_custom_sidebar')); } catch(e) {}
  if (!existing || !existing.groups) {
    existing = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_SIDEBAR)); // deep copy
    saveCustomSidebar(existing);
  }
  return existing;
}

function getCustomSidebar() {
  try {
    var data = JSON.parse(localStorage.getItem('roweos_custom_sidebar'));
    if (data && data.groups) return data;
  } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_CUSTOM_SIDEBAR));
}

function saveCustomSidebar(data) {
  try {
    localStorage.setItem('roweos_custom_sidebar', JSON.stringify(data));
    writeDB('profile/main', { customSidebar: data });
  } catch(e) {}
}

function resetSidebarToDefault() {
  var data = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_SIDEBAR));
  saveCustomSidebar(data);
  renderCustomSidebar();
}
```

- [ ] **Step 3: Add renderCustomSidebar**

```javascript
var _lastCustomSidebarHash = '';

function renderCustomSidebar() {
  var container = document.getElementById('sidebarNavCustom');
  if (!container) return;

  var data = getCustomSidebar();
  var hash = JSON.stringify(data);
  if (hash === _lastCustomSidebarHash) return; // no changes
  _lastCustomSidebarHash = hash;

  var showPremium = true;
  try { showPremium = localStorage.getItem('roweos_show_premium') !== 'false'; } catch(e) {}

  var html = '';

  // Standalone items (agent at top)
  if (data.standalone) {
    html += '<div class="nav-section">';
    for (var s = 0; s < data.standalone.length; s++) {
      var sid = data.standalone[s];
      if (!showPremium && !hasFeatureAccessForView(sid)) continue;
      html += renderCustomSidebarItem(sid, true);
    }
    html += '</div>';
  }

  // Favorites section (rendered separately by existing renderFavorites)
  html += '<div id="sidebarFavoritesCustom" style="display:none;"><div class="nav-section-title">Favorites</div><div id="favoritesNavListCustom"></div></div>';

  // Groups
  for (var g = 0; g < data.groups.length; g++) {
    var group = data.groups[g];
    var visibleItems = group.items.filter(function(viewId) {
      if (!showPremium && !hasFeatureAccessForView(viewId)) return false;
      return true;
    });
    if (visibleItems.length === 0) continue;

    html += '<div class="nav-section" data-group-id="' + escapeHtml(group.id) + '">';
    html += '<div class="nav-section-title" data-group-id="' + escapeHtml(group.id) + '">' + escapeHtml(group.label) + '</div>';
    for (var i = 0; i < visibleItems.length; i++) {
      html += renderCustomSidebarItem(visibleItems[i], false);
    }
    html += '</div>';
  }

  // Admin (conditional)
  if (typeof isAdmin === 'function' && isAdmin()) {
    html += renderCustomSidebarItem('admin', false);
  }

  // Customize button + available pool (for customize mode)
  html += '<div class="sidebar-customize-btn" onclick="toggleSidebarCustomize()">Customize</div>';
  html += '<div class="sidebar-available-pool" id="sidebarAvailablePool" style="display:none;"></div>';
  html += '<div class="sidebar-add-group-btn" onclick="addSidebarGroup()">+ Add Group</div>';

  container.innerHTML = html;

  // Set data attribute on html for CSS targeting
  document.documentElement.setAttribute('data-sidebar-mode', _sidebarMode);
}

// v26.3: Update active nav item in custom sidebar (called from showView's nav update logic)
// The existing showView code at line ~65362 does: document.querySelectorAll('.nav-item').forEach(...)
// This already covers #sidebarNavCustom since it queries ALL .nav-item elements globally.
// No additional code needed -- the custom sidebar items use the same .nav-item class with data-view attributes.

function renderCustomSidebarItem(viewId, isStandalone) {
  var icon = SIDEBAR_ICONS[viewId] || '';
  var label = SIDEBAR_LABELS[viewId] || viewId;
  var hasLanding = _pageLandingConfigs && _pageLandingConfigs[viewId];
  var onclick = hasLanding ? 'showPageLanding(\'' + escapeHtml(viewId) + '\')' : 'showView(\'' + escapeHtml(viewId) + '\')';

  var html = '<div class="nav-item" data-view="' + escapeHtml(viewId) + '" onclick="' + onclick + '" draggable="false">';
  html += '<span class="sidebar-drag-handle"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" opacity="0.5"><circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/></svg></span>';
  html += icon;
  html += '<span class="nav-item-label">' + escapeHtml(label) + '</span>';
  html += '<span class="sidebar-tooltip">' + escapeHtml(label) + '</span>';
  html += '<span class="sidebar-item-remove" onclick="event.stopPropagation(); removeSidebarItem(\'' + escapeHtml(viewId) + '\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>';
  html += '</div>';
  return html;
}

// v26.3: Check if a view requires premium access
function hasFeatureAccessForView(viewId) {
  var featureMap = {
    automations: 'automations', social: 'social', signal: 'focus',
    commerce: 'analytics', memory: 'identity', sync: 'sync'
  };
  var feature = featureMap[viewId];
  if (!feature) return true; // not gated
  if (typeof hasFeatureAccess === 'function') return hasFeatureAccess(feature);
  return true;
}
```

- [ ] **Step 4: Update applySidebarMode for 'customized'**

Find `function applySidebarMode()`. Add the third branch:

```javascript
function applySidebarMode() {
  var groupedNav = document.getElementById('sidebarNav');
  var expandedNav = document.getElementById('sidebarNavExpanded');
  var customNav = document.getElementById('sidebarNavCustom');

  if (_sidebarMode === 'expanded') {
    if (groupedNav) groupedNav.style.display = 'none';
    if (expandedNav) expandedNav.style.display = '';
    if (customNav) customNav.style.display = 'none';
  } else if (_sidebarMode === 'customized') {
    if (groupedNav) groupedNav.style.display = 'none';
    if (expandedNav) expandedNav.style.display = 'none';
    if (customNav) customNav.style.display = '';
    renderCustomSidebar();
  } else {
    if (groupedNav) groupedNav.style.display = '';
    if (expandedNav) expandedNav.style.display = 'none';
    if (customNav) customNav.style.display = 'none';
  }

  document.documentElement.setAttribute('data-sidebar-mode', _sidebarMode);
}
```

- [ ] **Step 5: Add #sidebarNavCustom HTML**

In the sidebar HTML, after `#sidebarNavExpanded` closing tag, add:

```html
<nav class="sidebar-nav" id="sidebarNavCustom" style="display:none;">
  <!-- Populated dynamically by renderCustomSidebar() -->
</nav>
```

- [ ] **Step 6: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.3: add sidebar icon map, data model, renderCustomSidebar, applySidebarMode update"
```

---

### Task 3: JS -- Inline sidebar customization (drag-and-drop)

**Files:**
- Modify: `RoweOS/dist/index.html` -- add near sidebar functions

- [ ] **Step 1: Add toggleSidebarCustomize**

```javascript
// v26.3: Inline sidebar customization
function toggleSidebarCustomize() {
  var isActive = document.body.classList.contains('sidebar-customize-mode');
  if (isActive) {
    exitSidebarCustomize();
  } else {
    enterSidebarCustomize();
  }
}

function enterSidebarCustomize() {
  document.body.classList.add('sidebar-customize-mode');

  // Make items draggable
  var container = document.getElementById('sidebarNavCustom');
  if (!container) return;
  var items = container.querySelectorAll('.nav-item[data-view]');
  for (var i = 0; i < items.length; i++) {
    items[i].setAttribute('draggable', 'true');
    items[i].addEventListener('dragstart', handleSidebarDragStart);
    items[i].addEventListener('dragend', handleSidebarDragEnd);
  }

  // Make sections drop targets
  var sections = container.querySelectorAll('.nav-section[data-group-id]');
  for (var j = 0; j < sections.length; j++) {
    sections[j].addEventListener('dragover', handleSidebarDragOver);
    sections[j].addEventListener('drop', handleSidebarDrop);
    sections[j].addEventListener('dragleave', handleSidebarDragLeave);
  }

  // Make group headers editable
  var headers = container.querySelectorAll('.nav-section-title[data-group-id]');
  for (var k = 0; k < headers.length; k++) {
    headers[k].setAttribute('contenteditable', 'true');
    headers[k].addEventListener('blur', handleGroupHeaderBlur);
    headers[k].addEventListener('keydown', handleGroupHeaderKeydown);
  }

  // Show available pool
  renderAvailablePool();

  // Change customize button to Done
  var btn = container.querySelector('.sidebar-customize-btn');
  if (btn) { btn.textContent = 'Done'; btn.style.color = 'var(--brand-accent, #a89878)'; }
}

function exitSidebarCustomize() {
  document.body.classList.remove('sidebar-customize-mode');

  var container = document.getElementById('sidebarNavCustom');
  if (!container) return;

  // Remove draggable
  var items = container.querySelectorAll('.nav-item[data-view]');
  for (var i = 0; i < items.length; i++) {
    items[i].setAttribute('draggable', 'false');
  }

  // Remove contenteditable
  var headers = container.querySelectorAll('.nav-section-title[data-group-id]');
  for (var k = 0; k < headers.length; k++) {
    headers[k].removeAttribute('contenteditable');
  }

  // Hide available pool
  var pool = document.getElementById('sidebarAvailablePool');
  if (pool) pool.style.display = 'none';

  // Restore button text
  var btn = container.querySelector('.sidebar-customize-btn');
  if (btn) { btn.textContent = 'Customize'; btn.style.color = ''; }
}
```

- [ ] **Step 2: Add drag-and-drop handlers**

```javascript
var _sidebarDragItem = null;

function handleSidebarDragStart(e) {
  _sidebarDragItem = e.target.getAttribute('data-view');
  e.target.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _sidebarDragItem);
}

function handleSidebarDragEnd(e) {
  e.target.style.opacity = '';
  _sidebarDragItem = null;
  // Remove all drop indicators
  var indicators = document.querySelectorAll('.sidebar-drop-indicator');
  for (var i = 0; i < indicators.length; i++) {
    indicators[i].classList.remove('visible');
  }
}

function handleSidebarDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleSidebarDragLeave(e) {
  // no-op for now
}

function handleSidebarDrop(e) {
  e.preventDefault();
  if (!_sidebarDragItem) return;

  var targetSection = e.target.closest('.nav-section[data-group-id]');
  if (!targetSection) return;
  var targetGroupId = targetSection.getAttribute('data-group-id');

  // Find which item we're dropping near
  var targetItem = e.target.closest('.nav-item[data-view]');
  var targetViewId = targetItem ? targetItem.getAttribute('data-view') : null;

  // Update data model
  var data = getCustomSidebar();
  var dragViewId = _sidebarDragItem;

  // Remove from current location
  for (var g = 0; g < data.groups.length; g++) {
    var idx = data.groups[g].items.indexOf(dragViewId);
    if (idx !== -1) {
      data.groups[g].items.splice(idx, 1);
      break;
    }
  }
  // Also check standalone
  if (data.standalone) {
    var sIdx = data.standalone.indexOf(dragViewId);
    if (sIdx !== -1) data.standalone.splice(sIdx, 1);
  }

  // Add to target group
  for (var h = 0; h < data.groups.length; h++) {
    if (data.groups[h].id === targetGroupId) {
      if (targetViewId) {
        var tIdx = data.groups[h].items.indexOf(targetViewId);
        if (tIdx !== -1) {
          data.groups[h].items.splice(tIdx, 0, dragViewId);
        } else {
          data.groups[h].items.push(dragViewId);
        }
      } else {
        data.groups[h].items.push(dragViewId);
      }
      break;
    }
  }

  saveCustomSidebar(data);
  _lastCustomSidebarHash = ''; // force re-render
  renderCustomSidebar();
  enterSidebarCustomize(); // re-enter customize mode on re-rendered items
}
```

- [ ] **Step 3: Add group editing handlers**

```javascript
function handleGroupHeaderBlur(e) {
  var groupId = e.target.getAttribute('data-group-id');
  var newLabel = e.target.textContent.trim();
  if (!newLabel) {
    // Empty name -- restore original
    var data = getCustomSidebar();
    for (var i = 0; i < data.groups.length; i++) {
      if (data.groups[i].id === groupId) {
        e.target.textContent = data.groups[i].label;
        break;
      }
    }
    return;
  }
  renameSidebarGroup(groupId, newLabel);
}

function handleGroupHeaderKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
}

function renameSidebarGroup(groupId, newLabel) {
  var data = getCustomSidebar();
  for (var i = 0; i < data.groups.length; i++) {
    if (data.groups[i].id === groupId) {
      data.groups[i].label = newLabel;
      break;
    }
  }
  saveCustomSidebar(data);
}

function addSidebarGroup() {
  var name = prompt('Group name:');
  if (!name || !name.trim()) return;
  var data = getCustomSidebar();
  var id = 'custom_' + Date.now();
  data.groups.push({ id: id, label: name.trim(), items: [] });
  saveCustomSidebar(data);
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
  if (document.body.classList.contains('sidebar-customize-mode')) {
    enterSidebarCustomize();
  }
}

function removeSidebarItem(viewId) {
  var data = getCustomSidebar();
  for (var g = 0; g < data.groups.length; g++) {
    var idx = data.groups[g].items.indexOf(viewId);
    if (idx !== -1) {
      data.groups[g].items.splice(idx, 1);
      break;
    }
  }
  saveCustomSidebar(data);
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
  if (document.body.classList.contains('sidebar-customize-mode')) {
    enterSidebarCustomize();
    renderAvailablePool();
  }
}

function renderAvailablePool() {
  var pool = document.getElementById('sidebarAvailablePool');
  if (!pool) return;

  var data = getCustomSidebar();
  // All possible viewIds
  var allViews = ['agent','signal','pulse','studio','folio','rhythm','library','automations','mail','memory','tuning','guardrails','clients','commerce','inventory','sync','settings','bloom','social'];
  // Find which are in use
  var usedViews = (data.standalone || []).slice();
  for (var g = 0; g < data.groups.length; g++) {
    usedViews = usedViews.concat(data.groups[g].items);
  }
  // Available = all - used
  var available = allViews.filter(function(v) { return usedViews.indexOf(v) === -1; });

  if (available.length === 0) {
    pool.style.display = 'none';
    return;
  }

  pool.style.display = '';
  var html = '<div class="sidebar-pool-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'\':\'none\'">Available Items <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>';
  html += '<div>';
  for (var i = 0; i < available.length; i++) {
    var v = available[i];
    html += '<div class="sidebar-pool-item" onclick="restoreSidebarItem(\'' + escapeHtml(v) + '\')">';
    html += (SIDEBAR_ICONS[v] || '') + ' <span>' + escapeHtml(SIDEBAR_LABELS[v] || v) + '</span>';
    html += '</div>';
  }
  html += '</div>';
  pool.innerHTML = html;
}

function restoreSidebarItem(viewId) {
  var data = getCustomSidebar();
  // Add to the last group
  if (data.groups.length > 0) {
    data.groups[data.groups.length - 1].items.push(viewId);
  }
  saveCustomSidebar(data);
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
  if (document.body.classList.contains('sidebar-customize-mode')) {
    enterSidebarCustomize();
    renderAvailablePool();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.3: inline sidebar customization with drag-and-drop"
```

---

### Task 4: JS -- Pill reordering

**Files:**
- Modify: `RoweOS/dist/index.html` -- extend renderPillNav + add reorder functions

- [ ] **Step 1: Add reorderPillItems and viewId mapping to renderPillNav**

In `renderPillNav`, after `var opts = options || {};`, add:

```javascript
  // v26.3: Store viewId mapping for pill reorder
  if (!window._pillNavViewMap) window._pillNavViewMap = {};
  if (opts.viewId) window._pillNavViewMap[containerId] = opts.viewId;

  // v26.3: Apply saved pill order
  var viewId = window._pillNavViewMap[containerId] || containerId;
  var sectionPrefs = getSectionPrefs(viewId);
  if (sectionPrefs && sectionPrefs.pillOrder) {
    items = reorderPillItems(items, sectionPrefs.pillOrder);
  }
```

Add the `reorderPillItems` function:

```javascript
function reorderPillItems(items, pillOrder) {
  var ordered = [];
  for (var i = 0; i < pillOrder.length; i++) {
    for (var j = 0; j < items.length; j++) {
      if (items[j].id === pillOrder[i]) {
        ordered.push(items[j]);
        break;
      }
    }
  }
  // Append any items not in pillOrder (new pills added in future versions)
  for (var k = 0; k < items.length; k++) {
    var found = false;
    for (var l = 0; l < ordered.length; l++) {
      if (ordered[l].id === items[k].id) { found = true; break; }
    }
    if (!found) ordered.push(items[k]);
  }
  return ordered;
}
```

- [ ] **Step 2: Add viewId to all existing renderPillNav callers**

Search for all `renderPillNav(` calls and add `viewId` to their options. For calls that don't have options yet, add `{ viewId: 'viewId' }` as the 5th arg. For calls that already have options (like Studio), add `viewId` to the existing options object.

Key mappings:
- `socialHubPillNav` -> `{ viewId: 'social' }`
- `autoLabPillNav` -> `{ viewId: 'automations' }`
- `mailPillNav` -> `{ viewId: 'mail' }`
- `guardrailsPillNav` -> `{ viewId: 'guardrails' }`
- `systemPillNav` -> `{ viewId: 'settings' }`
- `focusPillNavContainer` -> `{ viewId: 'signal' }`
- `peoplePillNav` -> `{ viewId: 'clients' }`
- `analyticsPillNav` -> `{ viewId: 'commerce' }`
- `identityPillNav` -> `{ viewId: 'memory' }`
- `studioPillNav` -> already has options, add `viewId: 'studio'`

- [ ] **Step 3: Add "Reorder tabs" to ? dropdown**

In `showSectionHelpDropdown`, after the "Open to" sub-list section, add:

```javascript
  // Reorder tabs (expanded and customized modes only)
  if (showPrefs) {
    html += '<div class="section-help-dropdown-item" onclick="closeSectionHelpDropdown(); enablePillReorder(\'' + escapeHtml(sectionId) + '\')">';
    html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><polyline points="8 5 4 9 8 13"/><polyline points="16 11 20 15 16 19"/></svg>';
    html += 'Reorder tabs</div>';
  }
```

- [ ] **Step 4: Add enablePillReorder and handlePillDrop**

```javascript
// v26.3: Pill reorder mode
function enablePillReorder(viewId) {
  // Find the pill nav container for this view
  var containerId = null;
  if (window._pillNavViewMap) {
    for (var key in window._pillNavViewMap) {
      if (window._pillNavViewMap[key] === viewId) { containerId = key; break; }
    }
  }
  if (!containerId) return;

  var container = document.getElementById(containerId);
  if (!container) return;
  var pillNav = container.querySelector('.pill-nav');
  if (!pillNav) return;

  pillNav.classList.add('pill-reorder-mode');

  // Make pills draggable
  var pills = pillNav.querySelectorAll('.pill-nav-item');
  for (var i = 0; i < pills.length; i++) {
    pills[i].setAttribute('draggable', 'true');
    pills[i].addEventListener('dragstart', handlePillDragStart);
    pills[i].addEventListener('dragend', handlePillDragEnd);
    pills[i].addEventListener('dragover', handlePillDragOver);
    pills[i].addEventListener('drop', function(e) { handlePillDrop(e, viewId); });
  }

  // Add Done button
  var doneBtn = document.createElement('button');
  doneBtn.className = 'pill-reorder-done-btn';
  doneBtn.textContent = 'Done';
  doneBtn.onclick = function() {
    pillNav.classList.remove('pill-reorder-mode');
    for (var j = 0; j < pills.length; j++) {
      pills[j].setAttribute('draggable', 'false');
    }
    doneBtn.parentNode.removeChild(doneBtn);
  };
  pillNav.appendChild(doneBtn);
}

var _pillDragId = null;

function handlePillDragStart(e) {
  _pillDragId = e.target.getAttribute('data-pill-id');
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _pillDragId);
}

function handlePillDragEnd(e) {
  e.target.classList.remove('dragging');
  _pillDragId = null;
}

function handlePillDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handlePillDrop(e, viewId) {
  e.preventDefault();
  if (!_pillDragId) return;

  var targetId = e.target.getAttribute('data-pill-id');
  if (!targetId || targetId === _pillDragId) return;

  // Get current pill order from the DOM
  var pillNav = e.target.closest('.pill-nav');
  if (!pillNav) return;
  var pills = pillNav.querySelectorAll('.pill-nav-item');
  var order = [];
  for (var i = 0; i < pills.length; i++) {
    var pid = pills[i].getAttribute('data-pill-id');
    if (pid) order.push(pid);
  }

  // Move dragged item to target position
  var fromIdx = order.indexOf(_pillDragId);
  var toIdx = order.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  order.splice(fromIdx, 1);
  order.splice(toIdx, 0, _pillDragId);

  // Save
  setSectionPref(viewId, 'pillOrder', order);

  // Re-render the pill nav to reflect new order
  // The pill nav will re-render with the saved order on next showView
  // For immediate feedback, reorder DOM elements
  var fragment = document.createDocumentFragment();
  for (var j = 0; j < order.length; j++) {
    for (var k = 0; k < pills.length; k++) {
      if (pills[k].getAttribute('data-pill-id') === order[j]) {
        fragment.appendChild(pills[k]);
        break;
      }
    }
  }
  // Re-append Done button
  var doneBtn = pillNav.querySelector('.pill-reorder-done-btn');
  pillNav.innerHTML = '';
  pillNav.appendChild(fragment);
  if (doneBtn) pillNav.appendChild(doneBtn);
}
```

- [ ] **Step 5: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.3: pill reorder via ? dropdown with drag-and-drop"
```

---

### Task 5: HTML + JS -- Onboarding workspace style step

**Files:**
- Modify: `RoweOS/dist/index.html` -- onboarding flow HTML and JS

- [ ] **Step 1: Add workspace style step HTML to onboarding**

Find the onboarding flow HTML (search for the brand name step, around line 49260+). After the brand/profile name step, add a new step:

```html
<!-- v26.3: Workspace Style Step -->
<div class="onboarding-step" id="onboardingStyleStep" style="display:none;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:20px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Choose your workspace style</div>
    <div style="font-size:13px;color:var(--text-muted);">You can change this anytime in Settings > Preferences</div>
  </div>
  <div class="workspace-style-cards" id="workspaceStyleCards">
    <div class="workspace-style-card selected" data-style="grouped" onclick="selectWorkspaceStyle(this, 'grouped')">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
      <div class="workspace-style-card-title">Simplified</div>
      <div class="workspace-style-card-desc">Clean, grouped navigation. Best for a focused experience.</div>
    </div>
    <div class="workspace-style-card" data-style="expanded" onclick="selectWorkspaceStyle(this, 'expanded')">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="21" y2="20"/></svg>
      <div class="workspace-style-card-title">Advanced</div>
      <div class="workspace-style-card-desc">All features visible. Best for power users.</div>
    </div>
    <div class="workspace-style-card" data-style="customized" onclick="selectWorkspaceStyle(this, 'customized')">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
      <div class="workspace-style-card-title">Customized</div>
      <div class="workspace-style-card-desc">Full control. Rename, reorder, and organize everything your way.</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add selectWorkspaceStyle function and wire into onboarding flow**

```javascript
// v26.3: Workspace style selection (onboarding + settings)
var _selectedWorkspaceStyle = 'grouped';

function selectWorkspaceStyle(el, style) {
  _selectedWorkspaceStyle = style;
  var cards = document.querySelectorAll('.workspace-style-card');
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.remove('selected');
  }
  el.classList.add('selected');
}

function applyWorkspaceStyle() {
  setSidebarMode(_selectedWorkspaceStyle);
  if (_selectedWorkspaceStyle === 'customized') {
    initCustomSidebar();
  }
}
```

Wire `applyWorkspaceStyle()` into the onboarding "Next" button handler for the style step. The onboarding uses a step progression system -- search for the function that advances steps (look for `onboardingStep` or `nextOnboardingStep` or the "Next" button's onclick). Insert the workspace style step as a new numbered step after the brand name step. When the user clicks Next on the style step, call `applyWorkspaceStyle()` then advance to the next step (model selection).

**Note:** `setSectionPref(viewId, key, value)` already exists from v26.2 -- it was added in the section help dropdown task. Verify it's present by searching for `function setSectionPref`.

**Note on premium visibility:** The `roweos_show_premium` toggle only filters items in Customized mode (via `renderCustomSidebar`). Grouped and Expanded sidebars use hardcoded HTML that cannot be dynamically filtered without significant refactoring. This is acceptable for v26.3 -- premium filtering in non-custom modes is a future enhancement.

- [ ] **Step 3: Add workspace style picker to Settings > Preferences**

Find the "Navigation Style" section in Preferences (where Grouped/Expanded toggle exists). Replace or extend it with the three-card picker:

Add a `renderWorkspaceStylePicker()` function that creates the same 3-card UI but reads from `_sidebarMode` and calls `setSidebarMode()` + `initCustomSidebar()` directly.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.3: onboarding workspace style step + settings workspace picker"
```

---

### Task 6: JS + HTML -- Settings sidebar layout panel + premium toggle

**Files:**
- Modify: `RoweOS/dist/index.html` -- Settings > Preferences

- [ ] **Step 1: Add "Sidebar Layout" section to Settings > Preferences**

After the workspace style picker, add (only visible in customized mode):

```html
<!-- v26.3: Sidebar Layout Editor (customized mode only) -->
<div id="settingsSidebarLayout" style="display:none;">
  <div class="settings-row-label">Sidebar Layout</div>
  <div class="settings-row-desc">Drag items to reorder. Click group names to rename.</div>
  <div id="settingsSidebarLayoutContent" class="settings-sidebar-layout"></div>
  <div style="display:flex;gap:8px;margin-top:var(--space-3);">
    <button class="focus-add-task-btn" onclick="addSidebarGroup()">+ Add Group</button>
    <button class="focus-add-task-btn" onclick="resetSidebarToDefault()">Reset to Default</button>
  </div>
  <!-- Premium visibility toggle -->
  <div style="margin-top:var(--space-4);display:flex;justify-content:space-between;align-items:center;" id="premiumToggleRow">
    <div>
      <div style="font-size:12px;color:var(--text-secondary);">Show premium features</div>
      <div style="font-size:10px;color:var(--text-muted);">Hide features you cannot access yet</div>
    </div>
    <div class="section-help-toggle" id="premiumVisToggle" onclick="togglePremiumVisibility(this)">
      <div class="section-help-toggle-knob"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add renderSettingsSidebarLayout function**

```javascript
function renderSettingsSidebarLayout() {
  var section = document.getElementById('settingsSidebarLayout');
  var content = document.getElementById('settingsSidebarLayoutContent');
  if (!section || !content) return;

  // Only show in customized mode
  if (_sidebarMode !== 'customized') {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  var data = getCustomSidebar();
  var html = '';

  for (var g = 0; g < data.groups.length; g++) {
    var group = data.groups[g];
    html += '<div class="settings-sidebar-group" data-group-id="' + escapeHtml(group.id) + '">';
    html += '<div class="settings-sidebar-group-header">';
    html += '<input type="text" value="' + escapeHtml(group.label) + '" onchange="renameSidebarGroup(\'' + escapeHtml(group.id) + '\', this.value); renderCustomSidebar();">';
    if (group.items.length === 0) {
      html += '<button style="margin-left:auto;background:none;border:none;color:#ef4444;cursor:pointer;font-size:11px;" onclick="deleteEmptySidebarGroup(\'' + escapeHtml(group.id) + '\')">Delete</button>';
    }
    html += '</div>';

    for (var i = 0; i < group.items.length; i++) {
      var viewId = group.items[i];
      html += '<div class="settings-sidebar-item" data-view="' + escapeHtml(viewId) + '">';
      html += '<span class="item-drag-handle"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/></svg></span>';
      html += '<span>' + escapeHtml(SIDEBAR_LABELS[viewId] || viewId) + '</span>';
      html += '<span class="item-move-btns">';
      html += '<button onclick="moveSidebarItemUp(\'' + escapeHtml(group.id) + '\', \'' + escapeHtml(viewId) + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;">\u25B2</button>';
      html += '<button onclick="moveSidebarItemDown(\'' + escapeHtml(group.id) + '\', \'' + escapeHtml(viewId) + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;">\u25BC</button>';
      html += '</span>';
      html += '<span class="item-remove-btn" onclick="removeSidebarItem(\'' + escapeHtml(viewId) + '\'); renderSettingsSidebarLayout();"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>';
      html += '</div>';
    }
    html += '</div>';
  }

  content.innerHTML = html;

  // Update premium toggle state
  var toggle = document.getElementById('premiumVisToggle');
  var showPremium = true;
  try { showPremium = localStorage.getItem('roweos_show_premium') !== 'false'; } catch(e) {}
  if (toggle) {
    if (showPremium) { toggle.classList.add('on'); } else { toggle.classList.remove('on'); }
  }

  // Hide premium toggle for premium users
  var premiumRow = document.getElementById('premiumToggleRow');
  if (premiumRow) {
    var tier = typeof getUserTier === 'function' ? getUserTier() : 'free';
    premiumRow.style.display = (tier === 'premium' || tier === 'founder') ? 'none' : '';
  }
}

function deleteEmptySidebarGroup(groupId) {
  var data = getCustomSidebar();
  data.groups = data.groups.filter(function(g) { return g.id !== groupId; });
  saveCustomSidebar(data);
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
  renderSettingsSidebarLayout();
}

function togglePremiumVisibility(el) {
  var isOn = el.classList.contains('on');
  if (isOn) {
    el.classList.remove('on');
    try { localStorage.setItem('roweos_show_premium', 'false'); } catch(e) {}
  } else {
    el.classList.add('on');
    try { localStorage.setItem('roweos_show_premium', 'true'); } catch(e) {}
  }
  _lastCustomSidebarHash = '';
  renderCustomSidebar();
}

function moveSidebarItemUp(groupId, viewId) {
  var data = getCustomSidebar();
  for (var g = 0; g < data.groups.length; g++) {
    if (data.groups[g].id === groupId) {
      var idx = data.groups[g].items.indexOf(viewId);
      if (idx > 0) {
        var temp = data.groups[g].items[idx - 1];
        data.groups[g].items[idx - 1] = viewId;
        data.groups[g].items[idx] = temp;
        saveCustomSidebar(data);
        _lastCustomSidebarHash = '';
        renderCustomSidebar();
        renderSettingsSidebarLayout();
      }
      break;
    }
  }
}

function moveSidebarItemDown(groupId, viewId) {
  var data = getCustomSidebar();
  for (var g = 0; g < data.groups.length; g++) {
    if (data.groups[g].id === groupId) {
      var idx = data.groups[g].items.indexOf(viewId);
      if (idx < data.groups[g].items.length - 1) {
        var temp = data.groups[g].items[idx + 1];
        data.groups[g].items[idx + 1] = viewId;
        data.groups[g].items[idx] = temp;
        saveCustomSidebar(data);
        _lastCustomSidebarHash = '';
        renderCustomSidebar();
        renderSettingsSidebarLayout();
      }
      break;
    }
  }
}
```

- [ ] **Step 3: Wire renderSettingsSidebarLayout into Settings view init**

In `showView`'s `if (view === 'settings')` block, add `renderSettingsSidebarLayout()` call.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.3: settings sidebar layout panel with premium toggle and mobile move buttons"
```

---

### Task 7: Sync + integration + version bump

**Files:**
- Modify: `RoweOS/dist/index.html`

- [ ] **Step 1: Add customSidebar to Firestore sync read path**

Search for `loadFromFirebaseV2` or `reconcileOnStartup`. Find where `profile/main` data is read from Firestore. Add handling for `customSidebar`:

```javascript
// Inside the profile data read handler:
if (data.customSidebar) {
  try { localStorage.setItem('roweos_custom_sidebar', JSON.stringify(data.customSidebar)); } catch(e) {}
}
```

- [ ] **Step 2: Verify all existing renderPillNav callers have viewId**

Grep for `renderPillNav(` and verify each has `viewId` in options (added in Task 4 Step 2).

- [ ] **Step 3: Test all features**

- Toggle workspace style in Settings > Preferences (all 3 modes)
- In Customized mode: drag sidebar items, rename groups, remove/restore items
- Settings > Preferences > Sidebar Layout: move items, rename groups, reset to default
- Premium toggle: hide/show premium items for non-premium users
- Pill reorder: ? dropdown > Reorder tabs, drag pills, verify order persists
- Onboarding: verify new workspace style step appears in correct position

- [ ] **Step 4: Version bump to v26.3**

Update `ROWEOS_VERSION` from `v26.2` to `v26.3`.

- [ ] **Step 5: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.3: full customization mode -- sidebar reorder, pill reorder, onboarding, premium toggle"
```
