# Focus View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Focus into 3 pill sections (Dashboard, Today & Upcoming, Tasks) with AI briefing and categorized task management.

**Architecture:** Persistent header (greeting + stats + pill nav) stays fixed; content swaps below. Dashboard wraps existing widget grid. Today & Upcoming is a new source-grouped view with AI briefing card + inline chat. Tasks is a new category-grouped view building on existing `todoCategories` system.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5 only), single-file app at `/Volumes/roweOS/RoweOS/dist/index.html`

**Spec:** `docs/superpowers/specs/2026-03-23-focus-view-redesign-design.md`

---

### Task 1: CSS -- Add new Focus pill view styles

**Files:**
- Modify: `RoweOS/dist/index.html:3425-3449` (signalView CSS area) and nearby Focus CSS

- [ ] **Step 1: Add CSS for persistent header, pill content containers, and Today & Upcoming view**

Insert after the existing Focus CSS block (around line 3449). Add these styles:

```css
/* v26.1: Focus Pill Layout */
#focusPersistentHeader {
  margin-bottom: var(--space-4);
}
#focusPersistentHeader .focus-greeting-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-3);
}
#focusPersistentHeader .focus-greeting-text {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}
#focusPersistentHeader .focus-greeting-date {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 2px;
}
#focusPersistentHeader .focus-stat-badges {
  display: flex;
  gap: 8px;
}
#focusPersistentHeader .focus-stat-badge {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 5px 10px;
  text-align: center;
}
#focusPersistentHeader .focus-stat-badge .stat-num {
  font-size: 16px;
  font-weight: 600;
  color: var(--brand-accent, #a89878);
}
#focusPersistentHeader .focus-stat-badge .stat-label {
  font-size: 10px;
  color: var(--text-muted);
}
#focusPersistentHeader .focus-pill-nav-container {
  margin-top: var(--space-3);
}
html.light-mode #focusPersistentHeader .focus-stat-badge {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.08);
}

/* Focus content containers */
#focusTodayContent,
#focusTasksContent {
  display: none;
}
#focusTodayContent.active,
#focusTasksContent.active {
  display: block;
}
#focusDashboardContent {
  display: none;
}
#focusDashboardContent.active {
  display: block;
}

/* AI Briefing Card */
.focus-briefing-card {
  background: linear-gradient(135deg, rgba(168,152,120,0.12), rgba(168,152,120,0.04));
  border: 1px solid rgba(168,152,120,0.2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: var(--space-4);
}
html.light-mode .focus-briefing-card {
  background: linear-gradient(135deg, rgba(168,152,120,0.08), rgba(168,152,120,0.02));
  border-color: rgba(168,152,120,0.15);
}
.focus-briefing-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.focus-briefing-header svg {
  color: var(--brand-accent, #a89878);
}
.focus-briefing-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-accent, #a89878);
}
.focus-briefing-time {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}
.focus-briefing-summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 12px;
}
.focus-briefing-insights {
  border-top: 1px solid rgba(168,152,120,0.15);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.focus-insight-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.focus-insight-icon {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}
.focus-insight-icon.trend { background: rgba(74,222,128,0.15); }
.focus-insight-icon.alert { background: rgba(251,191,36,0.15); }
.focus-insight-icon.done { background: rgba(34,211,238,0.15); }
.focus-insight-title {
  font-size: 12px;
  color: var(--text-secondary);
}
.focus-insight-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}

/* Inline chat */
.focus-inline-chat {
  border-top: 1px solid rgba(168,152,120,0.15);
  padding-top: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.focus-inline-chat input {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
}
html.light-mode .focus-inline-chat input {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.1);
}
.focus-inline-chat input::placeholder {
  color: var(--text-muted);
}
.focus-chat-send-btn {
  width: 30px;
  height: 30px;
  background: rgba(168,152,120,0.25);
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--brand-accent, #a89878);
}
.focus-chat-messages {
  border-top: 1px solid rgba(168,152,120,0.15);
  padding-top: 10px;
  margin-bottom: 10px;
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.focus-chat-msg-user {
  align-self: flex-end;
  background: rgba(168,152,120,0.2);
  border-radius: 10px 10px 2px 10px;
  padding: 8px 12px;
  max-width: 75%;
  font-size: 12px;
  color: var(--text-secondary);
}
.focus-chat-msg-ai {
  align-self: flex-start;
  background: rgba(255,255,255,0.06);
  border-radius: 10px 10px 10px 2px;
  padding: 8px 12px;
  max-width: 85%;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}
html.light-mode .focus-chat-msg-ai {
  background: rgba(0,0,0,0.04);
}

/* Source-grouped cards */
.focus-source-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}
.focus-source-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 14px;
}
html.light-mode .focus-source-card {
  background: rgba(0,0,0,0.02);
  border-color: rgba(0,0,0,0.06);
}
.focus-source-card-title {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}
.focus-source-divider {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 8px;
  margin-top: 8px;
}
html.light-mode .focus-source-divider {
  border-color: rgba(0,0,0,0.06);
}

/* Task category pills */
.focus-category-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}
.focus-category-pill {
  padding: 3px 10px;
  border-radius: 14px;
  font-size: 11px;
  border: 1px solid;
  cursor: pointer;
  user-select: none;
}
.focus-category-pill.active {
  font-weight: 600;
}
.focus-tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}
.focus-tasks-actions {
  display: flex;
  gap: 6px;
}
.focus-ai-categories-btn {
  background: rgba(168,152,120,0.12);
  border: 1px solid rgba(168,152,120,0.25);
  color: var(--brand-accent, #a89878);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.focus-add-task-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  color: var(--text-muted);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
}
html.light-mode .focus-add-task-btn {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.08);
}

/* Category groups */
.focus-category-group {
  margin-bottom: var(--space-4);
}
.focus-category-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.focus-category-color {
  width: 7px;
  height: 7px;
  border-radius: 2px;
}
.focus-category-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.focus-category-count {
  font-size: 11px;
  color: var(--text-muted);
}
.focus-category-line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.06);
}
html.light-mode .focus-category-line {
  background: rgba(0,0,0,0.06);
}
.focus-task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 4px 16px;
}
.focus-task-checkbox {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--text-muted);
  border-radius: 3px;
  flex-shrink: 0;
  cursor: pointer;
}
.focus-task-text {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
}
.focus-task-brand-tag {
  font-size: 9px;
  color: var(--text-muted);
  background: rgba(255,255,255,0.06);
  padding: 1px 5px;
  border-radius: 3px;
}
html.light-mode .focus-task-brand-tag {
  background: rgba(0,0,0,0.04);
}
.focus-task-due {
  font-size: 10px;
  color: var(--text-muted);
}
.focus-task-due.today {
  color: var(--brand-accent, #a89878);
}

/* Briefing error state */
.focus-briefing-error {
  text-align: center;
  padding: 16px;
  color: var(--text-muted);
  font-size: 13px;
}
.focus-briefing-retry-btn {
  background: rgba(168,152,120,0.2);
  border: 1px solid rgba(168,152,120,0.3);
  color: var(--brand-accent, #a89878);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  margin-top: 8px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .focus-source-grid {
    grid-template-columns: 1fr;
  }
  #focusPersistentHeader .focus-greeting-row {
    flex-direction: column;
    gap: 8px;
  }
  #focusPersistentHeader .focus-stat-badges {
    align-self: flex-start;
  }
}
```

- [ ] **Step 2: Verify no CSS class conflicts**

Search the file for any existing classes starting with `focus-briefing`, `focus-source`, `focus-category-pill`, `focus-task-row` to ensure no conflicts.

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.1: add CSS for Focus pill layout, AI briefing, source cards, and category tasks"
```

---

### Task 2: HTML -- Add persistent header and content containers

**Files:**
- Modify: `RoweOS/dist/index.html:52986-52998` (signalView HTML, before widget grid)

- [ ] **Step 1: Add persistent header HTML above the widget grid**

Replace the current panel header at lines 52989-52995 and wrap the existing grid. Insert a persistent header with greeting, stats, pill nav, and new content containers. The existing `focus2Container` grid gets wrapped in `#focusDashboardContent`.

After the `<div class="panel">` (line 52987), replace up through the description paragraph (line 52995) with:

```html
          <!-- Breadcrumb Trail -->
          <div class="breadcrumb">
              <span class="breadcrumb-item"><a href="#" onclick="showView('agent'); return false;">Home</a></span>
              <span class="breadcrumb-item active" id="focusBreadcrumbLabel">Focus</span>
          </div>

          <!-- v26.1: Persistent Header -->
          <div id="focusPersistentHeader">
            <div class="focus-greeting-row">
              <div>
                <div class="focus-greeting-text" id="focusGreeting">Good morning</div>
                <div class="focus-greeting-date"><span id="focusDate">Sunday, March 23</span> &middot; <span id="focusBrandBadge">TRC</span></div>
              </div>
              <div class="focus-stat-badges">
                <div class="focus-stat-badge"><div class="stat-num" id="focusStatTasks">0</div><div class="stat-label">Tasks</div></div>
                <div class="focus-stat-badge"><div class="stat-num" id="focusStatEvents">0</div><div class="stat-label">Events</div></div>
                <div class="focus-stat-badge"><div class="stat-num" id="focusStatReminders">0</div><div class="stat-label">Reminders</div></div>
              </div>
            </div>
            <div class="focus-pill-nav-container" id="focusPillNavContainer"></div>
          </div>

          <!-- Dashboard Content (existing widget grid) -->
          <div id="focusDashboardContent" class="active">
            <div class="panel-header" style="margin-bottom: var(--space-2);display:flex;align-items:center;"><span>Focus</span><span id="focus2CustomizeBtn" onclick="toggleFocus2Customize()" style="font-size: var(--text-sm); color: var(--text-muted); cursor: pointer; user-select: none; margin-left: auto; margin-right: 8px;">Customize</span><button class="section-help-btn" onclick="showSectionHelp('signal')" title="How to use Focus">?</button></div>
```

Note: The existing `focus2Container` grid and all widgets remain unchanged inside `#focusDashboardContent`. The closing `</div>` for `focusDashboardContent` must be added after the existing `<!-- Close focusClassicContainer -->` div (around line 53720).

- [ ] **Step 2: Add closing tag for focusDashboardContent and new content containers**

After line 53720 (`</div><!-- Close focusClassicContainer -->`), add:

```html
          </div><!-- Close focusDashboardContent -->

          <!-- Today & Upcoming Content -->
          <div id="focusTodayContent">
            <div id="focusBriefingCard"><!-- AI briefing + chat messages rendered here by JS --></div>
            <div class="focus-source-grid">
              <div class="focus-source-card" id="focusSourceCalendar"></div>
              <div class="focus-source-card" id="focusSourceTasks"></div>
              <div class="focus-source-card" id="focusSourceAutomations"></div>
              <div class="focus-source-card" id="focusSourceReminders"></div>
            </div>
          </div>

          <!-- Tasks Content -->
          <div id="focusTasksContent">
            <div class="focus-tasks-header">
              <div class="focus-category-pills" id="focusCategoryPills"></div>
              <div class="focus-tasks-actions">
                <button class="focus-ai-categories-btn" id="focusAICategoriesBtn" onclick="generateAICategories()" style="display:none;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                  AI Categories
                </button>
                <button class="focus-add-task-btn" onclick="addTodoFromFocusTasks()">+ Add Task</button>
              </div>
            </div>
            <div id="focusCategoryList"></div>
          </div>
```

- [ ] **Step 3: Remove the old description paragraph**

The old `<p>Your daily command center...</p>` (line 52995) should be removed since the persistent header replaces it.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.1: add Focus persistent header, pill containers, Today & Tasks HTML"
```

---

### Task 3: JS -- Pill navigation and content swap logic

**Files:**
- Modify: `RoweOS/dist/index.html:64617-64628` (landing page config)
- Modify: `RoweOS/dist/index.html:64713-64721` (showFocusSection)
- Modify: `RoweOS/dist/index.html:90475-90488` (renderFocusView)

- [ ] **Step 1: Update landing page config**

Replace lines 64617-64628:

```javascript
  'signal': {
    label: 'FOCUS',
    tagline: 'Your day at a glance',
    description: 'Daily intelligence dashboard with calendar, automations, reminders, and AI-powered insights.',
    features: [
      { id: 'dashboard', label: 'Dashboard', desc: 'Customizable widget grid with calendar, events, and automations' },
      { id: 'today', label: 'Today & Upcoming', desc: 'AI briefing, calendar events, tasks, automations, and reminders' },
      { id: 'tasks', label: 'Tasks', desc: 'Categorized task management across all brands' }
    ],
    secondary: [],
    tabHandler: 'showFocusSection'
  },
```

- [ ] **Step 2: Add showFocusPill function and update showFocusSection**

Replace lines 64713-64721 with:

```javascript
function showFocusSection(sectionId) {
  // enterPageSubSection already calls showView -- just handle pill switching
  showFocusPill(sectionId);
}

// v26.1: Focus pill navigation
function showFocusPill(pillId) {
  // Normalize legacy saved values
  if (pillId === 'upcoming') pillId = 'today';
  if (!pillId) pillId = 'dashboard';

  var dashboard = document.getElementById('focusDashboardContent');
  var today = document.getElementById('focusTodayContent');
  var tasks = document.getElementById('focusTasksContent');

  if (dashboard) dashboard.classList.remove('active');
  if (today) today.classList.remove('active');
  if (tasks) tasks.classList.remove('active');

  if (pillId === 'today' && today) {
    today.classList.add('active');
    renderFocusTodayView();
  } else if (pillId === 'tasks' && tasks) {
    tasks.classList.add('active');
    renderFocusTasksView();
  } else {
    if (dashboard) dashboard.classList.add('active');
    pillId = 'dashboard';
  }

  // Update pill nav active state
  updatePillNavActive('focusPillNavContainer', pillId);

  // Save state
  try { localStorage.setItem('roweos_focus_active_pill', pillId); } catch(e) {}
}
```

- [ ] **Step 3: Update renderFocusView to init pill nav**

Replace lines 90475-90488 with:

```javascript
function renderFocusView() {
  // v26.1: Render persistent header + existing stats
  updateFocusHeader();
  updateFocusStats();
  updateFocusPersistentStats();

  // Render pill nav
  var pillItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'today', label: 'Today & Upcoming' },
    { id: 'tasks', label: 'Tasks' }
  ];
  var savedPill = 'dashboard';
  try { savedPill = localStorage.getItem('roweos_focus_active_pill') || 'dashboard'; } catch(e) {}

  renderPillNav('focusPillNavContainer', pillItems, savedPill, function(id) {
    showFocusPill(id);
  });

  // Render the active pill's content
  showFocusPill(savedPill);

  // Always render dashboard widgets (they need data populated)
  renderFocusTodoList();
  renderFocusUpNext();
  renderFocusAIRecommendations();
  renderFocusTodayRhythm();
  renderFocusScheduledPrompts();
  renderFocusReminders();
  renderSuggestedRecurring();
  renderFocusRecentActivity();
  populateFocusNativeSelects();
  populateTodoFilterSelects();
}
```

- [ ] **Step 4: Add updateFocusPersistentStats function**

Add near `updateFocusStats()` (around line 111866):

```javascript
// v26.1: Update persistent header stat badges
function updateFocusPersistentStats() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];

  var activeTodos = todos.filter(function(t) {
    return !t.completed && (todoFilterMode === 'brand' ? t.brand === brand.name : true);
  }).length;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var todayEvents = calendar.filter(function(item) {
    var d = new Date(item.date);
    return d >= today && d < tomorrow;
  }).length;

  var reminders = [];
  try { reminders = JSON.parse(localStorage.getItem('roweos_reminders') || '[]'); } catch(e) {}
  var activeReminders = reminders.filter(function(r) { return r.status === 'pending' || r.status === 'snoozed'; }).length;

  var el;
  el = document.getElementById('focusStatTasks');
  if (el) el.textContent = activeTodos;
  el = document.getElementById('focusStatEvents');
  if (el) el.textContent = todayEvents;
  el = document.getElementById('focusStatReminders');
  if (el) el.textContent = activeReminders;
}
```

- [ ] **Step 5: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.1: wire up Focus pill nav, content swap, and persistent stats"
```

---

### Task 4: JS -- Today & Upcoming view (source-grouped cards)

**Files:**
- Modify: `RoweOS/dist/index.html` (add new functions near Focus section, ~line 90488+)

- [ ] **Step 1: Add renderFocusTodayView function**

Add after the pill nav functions:

```javascript
// v26.1: Render Today & Upcoming pill
function renderFocusTodayView() {
  renderFocusAIBriefing();
  renderFocusSourceCards();
}

// v26.1: Render the 4 source-grouped cards
function renderFocusSourceCards() {
  renderFocusSourceCalendar();
  renderFocusSourceTasks();
  renderFocusSourceAutomations();
  renderFocusSourceReminders();
}
```

- [ ] **Step 2: Add renderFocusSourceCalendar**

```javascript
function renderFocusSourceCalendar() {
  var container = document.getElementById('focusSourceCalendar');
  if (!container) return;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  var calColors = {};
  try { calColors = JSON.parse(localStorage.getItem('roweos_calendar_colors') || '{}'); } catch(e) {}

  var todayEvents = calendar.filter(function(item) {
    var d = new Date(item.date);
    return d >= today && d < tomorrow;
  }).sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

  var upcomingEvents = calendar.filter(function(item) {
    var d = new Date(item.date);
    return d >= tomorrow && d < nextWeek;
  }).sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

  var html = '<div class="focus-source-card-title">Calendar Events</div>';

  if (todayEvents.length === 0 && upcomingEvents.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No events scheduled</div>';
  }

  for (var i = 0; i < todayEvents.length; i++) {
    var ev = todayEvents[i];
    var color = calColors[ev.calendarName || ev.source || 'default'] || '#a89878';
    var time = new Date(ev.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    html += '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">';
    html += '<div style="width:3px;height:28px;background:' + escapeHtml(color) + ';border-radius:2px;flex-shrink:0;margin-top:1px;"></div>';
    html += '<div><div style="font-size:12px;color:var(--text-secondary);">' + escapeHtml(ev.title || ev.name || 'Event') + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(time) + '</div></div></div>';
  }

  if (upcomingEvents.length > 0) {
    html += '<div class="focus-source-divider">';
    var upcomingText = upcomingEvents.slice(0, 3).map(function(ev) {
      var day = new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short' });
      return day + ': ' + (ev.title || ev.name || 'Event');
    }).join(' / ');
    html += '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(upcomingText) + '</div></div>';
  }

  container.innerHTML = html;
}
```

- [ ] **Step 3: Add renderFocusSourceTasks**

```javascript
function renderFocusSourceTasks() {
  var container = document.getElementById('focusSourceTasks');
  if (!container) return;

  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  var activeTodos = todos.filter(function(t) {
    return !t.completed && (todoFilterMode === 'brand' ? t.brand === brand.name : true);
  });

  var todayTodos = activeTodos.filter(function(t) {
    if (!t.dueDate) return false;
    var d = new Date(t.dueDate);
    d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  });

  var upcomingTodos = activeTodos.filter(function(t) {
    if (!t.dueDate) return false;
    var d = new Date(t.dueDate);
    d.setHours(0,0,0,0);
    return d > today && d < nextWeek;
  }).sort(function(a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });

  var noDueTodos = activeTodos.filter(function(t) { return !t.dueDate; });

  var html = '<div class="focus-source-card-title">Tasks Due</div>';

  var allItems = todayTodos.concat(upcomingTodos);
  if (allItems.length === 0 && noDueTodos.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No tasks due</div>';
  }

  for (var i = 0; i < todayTodos.length; i++) {
    var t = todayTodos[i];
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
    html += '<div style="width:11px;height:11px;border:1.5px solid var(--brand-accent, #a89878);border-radius:3px;flex-shrink:0;cursor:pointer;" onclick="toggleFocusSourceTask(\'' + escapeHtml(t.id) + '\')"></div>';
    html += '<div style="font-size:12px;color:var(--text-secondary);flex:1;">' + escapeHtml(t.text) + '</div>';
    html += '<div style="font-size:10px;color:var(--brand-accent, #a89878);">Today</div></div>';
  }

  for (var j = 0; j < Math.min(upcomingTodos.length, 4); j++) {
    var u = upcomingTodos[j];
    var day = new Date(u.dueDate).toLocaleDateString('en-US', { weekday: 'short' });
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
    html += '<div style="width:11px;height:11px;border:1.5px solid var(--text-muted);border-radius:3px;flex-shrink:0;cursor:pointer;opacity:0.5;" onclick="toggleFocusSourceTask(\'' + escapeHtml(u.id) + '\')"></div>';
    html += '<div style="font-size:12px;color:var(--text-muted);flex:1;">' + escapeHtml(u.text) + '</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(day) + '</div></div>';
  }

  container.innerHTML = html;
}

function toggleFocusSourceTask(taskId) {
  for (var i = 0; i < todos.length; i++) {
    if (todos[i].id === taskId) {
      todos[i].completed = true;
      todos[i].completedAt = new Date().toISOString();
      todos[i]._modifiedAt = Date.now();
      break;
    }
  }
  saveTodos();
  renderFocusSourceTasks();
  updateFocusPersistentStats();
}
```

- [ ] **Step 4: Add renderFocusSourceAutomations**

```javascript
function renderFocusSourceAutomations() {
  var container = document.getElementById('focusSourceAutomations');
  if (!container) return;

  var completed = [];
  try { completed = JSON.parse(localStorage.getItem('roweos_completed_automations') || '[]'); } catch(e) {}
  var scheduled = [];
  try { scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : []; } catch(e) {}

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  var todayCompleted = completed.filter(function(a) {
    if (!a.completedAt) return false;
    var d = new Date(a.completedAt);
    return d >= today && d < tomorrow;
  });

  var html = '<div class="focus-source-card-title">Automations</div>';

  if (todayCompleted.length === 0 && scheduled.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No automations today</div>';
  }

  for (var i = 0; i < todayCompleted.length; i++) {
    var c = todayCompleted[i];
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer;" onclick="viewCompletedAutomation(\'' + escapeHtml(c.id || '') + '\')">';
    html += '<div style="width:6px;height:6px;background:#4ade80;border-radius:50%;flex-shrink:0;"></div>';
    html += '<div style="font-size:12px;color:var(--text-secondary);flex:1;">' + escapeHtml(c.name || c.title || 'Automation') + '</div>';
    html += '<div style="font-size:10px;color:#4ade80;">Done</div></div>';
  }

  for (var j = 0; j < Math.min(scheduled.length, 3); j++) {
    var s = scheduled[j];
    var time = s.time || '';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
    html += '<div style="width:6px;height:6px;background:rgba(255,255,255,0.2);border-radius:50%;flex-shrink:0;"></div>';
    html += '<div style="font-size:12px;color:var(--text-muted);flex:1;">' + escapeHtml(s.name || s.title || 'Automation') + '</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(time) + '</div></div>';
  }

  container.innerHTML = html;
}
```

- [ ] **Step 5: Add renderFocusSourceReminders**

```javascript
function renderFocusSourceReminders() {
  var container = document.getElementById('focusSourceReminders');
  if (!container) return;

  var reminders = [];
  try { reminders = JSON.parse(localStorage.getItem('roweos_reminders') || '[]'); } catch(e) {}

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  var active = reminders.filter(function(r) {
    return r.status === 'pending' || r.status === 'snoozed';
  }).sort(function(a, b) { return new Date(a.scheduledAt) - new Date(b.scheduledAt); });

  var html = '<div class="focus-source-card-title">Reminders</div>';

  if (active.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No active reminders</div>';
  }

  for (var i = 0; i < Math.min(active.length, 5); i++) {
    var r = active[i];
    var rDate = new Date(r.scheduledAt);
    var isToday = rDate >= today && rDate < new Date(today.getTime() + 86400000);
    var timeStr = isToday
      ? rDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : rDate.toLocaleDateString('en-US', { weekday: 'short' });
    var dotColor = isToday ? '#fbbf24' : 'rgba(255,255,255,0.2)';
    var textColor = isToday ? 'var(--text-secondary)' : 'var(--text-muted)';
    var timeColor = isToday ? '#fbbf24' : 'var(--text-muted)';

    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
    html += '<div style="width:6px;height:6px;background:' + dotColor + ';border-radius:50%;flex-shrink:0;"></div>';
    html += '<div style="font-size:12px;color:' + textColor + ';flex:1;">' + escapeHtml(r.title) + '</div>';
    html += '<div style="font-size:10px;color:' + timeColor + ';">' + escapeHtml(timeStr) + '</div></div>';
  }

  container.innerHTML = html;
}
```

- [ ] **Step 6: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.1: implement Today & Upcoming source-grouped cards"
```

---

### Task 5: JS -- AI Briefing card with inline chat

**Files:**
- Modify: `RoweOS/dist/index.html` (add near Focus functions)

- [ ] **Step 1: Add renderFocusAIBriefing function**

```javascript
// v26.1: AI Briefing Card
function renderFocusAIBriefing() {
  var container = document.getElementById('focusBriefingCard');
  if (!container) return;

  // Check cache -- generate once per day
  var cached = null;
  try {
    var raw = localStorage.getItem('roweos_focus_briefing');
    if (raw) {
      cached = JSON.parse(raw);
      var today = new Date().toDateString();
      if (cached.date !== today) cached = null;
    }
  } catch(e) { cached = null; }

  if (cached && cached.html) {
    container.innerHTML = cached.html;
    return;
  }

  // Show loading state
  container.innerHTML = '<div class="focus-briefing-card">' +
    '<div class="focus-briefing-header">' +
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>' +
    '<span class="focus-briefing-title">Daily Briefing</span>' +
    '<span class="focus-briefing-time">Generating...</span></div>' +
    '<div class="focus-briefing-summary" style="color:var(--text-muted);">Analyzing your day...</div></div>';

  generateFocusBriefing();
}

function generateFocusBriefing() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];

  var mode = localStorage.getItem('roweos_app_mode') || 'brand';
  // Collect context -- in life mode, don't filter by brand
  var activeTodos = todos.filter(function(t) {
    if (t.completed) return false;
    return mode === 'brand' ? t.brand === brand.name : true;
  });
  var today = new Date();
  today.setHours(0,0,0,0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var todayEvents = calendar.filter(function(item) {
    var d = new Date(item.date);
    return d >= today && d < tomorrow;
  });

  var reminders = [];
  try { reminders = JSON.parse(localStorage.getItem('roweos_reminders') || '[]'); } catch(e) {}
  var activeReminders = reminders.filter(function(r) { return r.status === 'pending' || r.status === 'snoozed'; });

  var completed = [];
  try { completed = JSON.parse(localStorage.getItem('roweos_completed_automations') || '[]'); } catch(e) {}
  var todayCompleted = completed.filter(function(a) {
    if (!a.completedAt) return false;
    var d = new Date(a.completedAt);
    return d >= today && d < tomorrow;
  });

  var hour = new Date().getHours();
  var timeContext = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  var systemPrompt = 'You are a daily briefing assistant for ' + (mode === 'brand' ? brand.name : 'personal life management') + '.';
  var userPrompt = 'Time of day: ' + timeContext + '. ' +
    'Today: ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '. ' +
    'Active tasks (' + activeTodos.length + '): ' + activeTodos.slice(0, 8).map(function(t) { return t.text + (t.dueDate ? ' (due ' + t.dueDate + ')' : ''); }).join(', ') + '. ' +
    'Calendar events (' + todayEvents.length + '): ' + todayEvents.map(function(e) { return (e.title || e.name) + ' at ' + new Date(e.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }).join(', ') + '. ' +
    'Reminders (' + activeReminders.length + '): ' + activeReminders.slice(0, 3).map(function(r) { return r.title; }).join(', ') + '. ' +
    'Completed automations today: ' + todayCompleted.map(function(a) { return a.name || a.title; }).join(', ') + '. ' +
    'Give a brief daily briefing (2-3 sentences), then 2-3 actionable insights. ' +
    'Format as JSON: {"summary":"...","insights":[{"type":"trend|alert|done","title":"...","desc":"..."}]}';

  try {
    if (mode === 'life' && typeof callLifeAIForGoal === 'function') {
      // Life mode: callLifeAIForGoal(systemPrompt, userPrompt, onSuccess, onError)
      callLifeAIForGoal(systemPrompt, userPrompt,
        function(response) { processBriefingResponse(response); },
        function(err) { renderBriefingFallback(); }
      );
    } else {
      // Brand mode: get provider/model/apiKey, then call API
      var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
      var provider = settings.provider || brand.provider || 'anthropic';
      var aiModel = settings.model || brand.model || 'claude-sonnet-4-6';
      getApiKey(provider).then(function(apiKey) {
        if (!apiKey) { renderBriefingFallback(); return; }
        callBrandAIGeneratorAPI(provider, aiModel, apiKey, systemPrompt + '\n\n' + userPrompt).then(function(response) {
          processBriefingResponse(response);
        }).catch(function() { renderBriefingFallback(); });
      }).catch(function() { renderBriefingFallback(); });
    }
  } catch(e) {
    renderBriefingFallback();
  }
}

function processBriefingResponse(response) {
  var container = document.getElementById('focusBriefingCard');
  if (!container) return;

  var data = null;
  try {
    // Try to extract JSON from response
    var jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) data = JSON.parse(jsonMatch[0]);
  } catch(e) {}

  if (!data || !data.summary) {
    // Use raw text as summary if JSON parsing fails
    data = { summary: response, insights: [] };
  }

  var html = buildBriefingHTML(data);

  // Cache
  try {
    localStorage.setItem('roweos_focus_briefing', JSON.stringify({
      date: new Date().toDateString(),
      html: html
    }));
  } catch(e) {}

  container.innerHTML = html;
}

function buildBriefingHTML(data) {
  var now = new Date();
  var timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  var html = '<div class="focus-briefing-card">';
  html += '<div class="focus-briefing-header">';
  html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>';
  html += '<span class="focus-briefing-title">Daily Briefing</span>';
  html += '<span class="focus-briefing-time">' + escapeHtml(timeStr) + '</span></div>';
  html += '<div class="focus-briefing-summary">' + escapeHtml(data.summary) + '</div>';

  if (data.insights && data.insights.length > 0) {
    html += '<div class="focus-briefing-insights">';
    var iconMap = {
      trend: { bg: 'rgba(74,222,128,0.15)', svg: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' },
      alert: { bg: 'rgba(251,191,36,0.15)', svg: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' },
      done: { bg: 'rgba(34,211,238,0.15)', svg: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' }
    };

    for (var i = 0; i < data.insights.length; i++) {
      var insight = data.insights[i];
      var icon = iconMap[insight.type] || iconMap.alert;
      html += '<div class="focus-insight-item">';
      html += '<div class="focus-insight-icon" style="background:' + icon.bg + ';">' + icon.svg + '</div>';
      html += '<div><div class="focus-insight-title">' + escapeHtml(insight.title) + '</div>';
      html += '<div class="focus-insight-desc">' + escapeHtml(insight.desc) + '</div></div></div>';
    }
    html += '</div>';
  }

  // Inline chat
  html += '<div class="focus-inline-chat">';
  html += '<input type="text" id="focusChatInput" placeholder="Ask about your day..." onkeydown="if(event.key===\'Enter\')sendFocusAIChat()">';
  html += '<button class="focus-chat-send-btn" onclick="sendFocusAIChat()">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
  html += '</button></div>';

  html += '</div>';
  return html;
}

function renderBriefingFallback() {
  var container = document.getElementById('focusBriefingCard');
  if (!container) return;

  container.innerHTML = '<div class="focus-briefing-card"><div class="focus-briefing-error">' +
    'Could not generate briefing' +
    '<br><button class="focus-briefing-retry-btn" onclick="renderFocusAIBriefing()">Retry</button>' +
    '</div></div>';
}
```

- [ ] **Step 2: Add sendFocusAIChat function**

```javascript
// v26.1: Focus inline chat
var _focusChatHistory = [];

function sendFocusAIChat() {
  var input = document.getElementById('focusChatInput');
  if (!input || !input.value.trim()) return;

  var message = input.value.trim();
  input.value = '';

  // Show chat messages area (inside briefing card)
  var chatArea = document.getElementById('focusChatMessages');
  if (!chatArea) {
    // Create chat messages container inside briefing card if not yet present
    var briefingCard = document.querySelector('.focus-briefing-card');
    if (briefingCard) {
      var chatDiv = document.createElement('div');
      chatDiv.id = 'focusChatMessages';
      chatDiv.className = 'focus-chat-messages';
      var chatInput = briefingCard.querySelector('.focus-inline-chat');
      if (chatInput) briefingCard.insertBefore(chatDiv, chatInput);
      chatArea = chatDiv;
    }
  }
  if (chatArea) chatArea.style.display = 'flex';

  // Add user message
  _focusChatHistory.push({ role: 'user', text: message });
  renderFocusChatMessages();

  // Build context
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var activeTodos = todos.filter(function(t) { return !t.completed && t.brand === brand.name; });

  var sysPrompt = 'You are a Focus assistant for ' + brand.name + '. ' +
    'Active tasks: ' + activeTodos.slice(0, 5).map(function(t) { return t.text; }).join(', ') + '. ' +
    'Answer briefly and actionably.';

  try {
    var mode = localStorage.getItem('roweos_app_mode') || 'brand';
    var onSuccess = function(response) {
      _focusChatHistory.push({ role: 'ai', text: response });
      renderFocusChatMessages();
    };

    if (mode === 'life' && typeof callLifeAIForGoal === 'function') {
      callLifeAIForGoal(sysPrompt, message, onSuccess, function(err) {
        _focusChatHistory.push({ role: 'ai', text: 'Error: ' + (err || 'AI not available') });
        renderFocusChatMessages();
      });
    } else {
      var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
      var provider = settings.provider || brand.provider || 'anthropic';
      var aiModel = settings.model || brand.model || 'claude-sonnet-4-6';
      getApiKey(provider).then(function(apiKey) {
        if (!apiKey) {
          _focusChatHistory.push({ role: 'ai', text: 'No API key configured. Check Settings.' });
          renderFocusChatMessages();
          return;
        }
        callBrandAIGeneratorAPI(provider, aiModel, apiKey, sysPrompt + '\n\nUser: ' + message).then(onSuccess).catch(function(err) {
          _focusChatHistory.push({ role: 'ai', text: 'Error: ' + (err.message || 'Request failed') });
          renderFocusChatMessages();
        });
      }).catch(function() {
        _focusChatHistory.push({ role: 'ai', text: 'Could not load API key.' });
        renderFocusChatMessages();
      });
    }
  } catch(e) {
    showToast('Chat error: ' + e.message, 'error');
  }
}

function renderFocusChatMessages() {
  var chatArea = document.getElementById('focusChatMessages');
  if (!chatArea) return;

  var html = '';
  for (var i = 0; i < _focusChatHistory.length; i++) {
    var msg = _focusChatHistory[i];
    var cls = msg.role === 'user' ? 'focus-chat-msg-user' : 'focus-chat-msg-ai';
    html += '<div class="' + cls + '">' + escapeHtml(msg.text) + '</div>';
  }
  chatArea.innerHTML = html;
  chatArea.scrollTop = chatArea.scrollHeight;
}
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.1: implement AI briefing card with inline chat"
```

---

### Task 6: JS -- Tasks pill (category view + AI categories)

**Files:**
- Modify: `RoweOS/dist/index.html` (add near Focus functions)

- [ ] **Step 1: Add renderFocusTasksView and category rendering**

```javascript
// v26.1: Focus Tasks pill
function renderFocusTasksView() {
  renderFocusCategoryPills();
  renderFocusCategoryList();
}

function renderFocusCategoryPills() {
  var container = document.getElementById('focusCategoryPills');
  if (!container) return;

  // Show/hide AI Categories button based on whether categories exist
  var aiBtn = document.getElementById('focusAICategoriesBtn');
  if (aiBtn) aiBtn.style.display = window.todoCategories.length === 0 ? '' : 'none';

  var activeFilter = window._focusCategoryFilter || 'all';
  var html = '';

  // "All" pill
  var allCls = activeFilter === 'all' ? ' active' : '';
  html += '<div class="focus-category-pill' + allCls + '" style="background:rgba(168,152,120,' + (activeFilter === 'all' ? '0.2' : '0.08') + ');border-color:rgba(168,152,120,' + (activeFilter === 'all' ? '0.3' : '0.15') + ');color:#a89878;" onclick="filterFocusCategory(\'all\')">' +
    'All</div>';

  // Category pills
  for (var i = 0; i < window.todoCategories.length; i++) {
    var cat = window.todoCategories[i];
    var isActive = activeFilter === cat.name;
    var opacity = isActive ? '0.2' : '0.1';
    var borderOpacity = isActive ? '0.35' : '0.2';
    html += '<div class="focus-category-pill' + (isActive ? ' active' : '') + '" style="background:rgba(' + hexToRgbStr(cat.color) + ',' + opacity + ');border-color:rgba(' + hexToRgbStr(cat.color) + ',' + borderOpacity + ');color:' + escapeHtml(cat.color) + ';" onclick="filterFocusCategory(\'' + escapeHtml(cat.name) + '\')">' +
      escapeHtml(cat.name) + '</div>';
  }

  // "+ New" pill
  html += '<div class="focus-category-pill" style="background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08);color:var(--text-muted);" onclick="promptNewFocusCategory()">+ New</div>';

  container.innerHTML = html;
}

// Helper: hex color to "r,g,b" string (uses existing hexToRgb which returns {r,g,b} object)
function hexToRgbStr(hex) {
  var rgb = hexToRgb(hex);
  return rgb ? (rgb.r + ',' + rgb.g + ',' + rgb.b) : '255,255,255';
}

function filterFocusCategory(name) {
  window._focusCategoryFilter = name;
  renderFocusCategoryPills();
  renderFocusCategoryList();
}

function renderFocusCategoryList() {
  var container = document.getElementById('focusCategoryList');
  if (!container) return;

  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var filter = window._focusCategoryFilter || 'all';

  var activeTodos = todos.filter(function(t) {
    return !t.completed && (todoFilterMode === 'brand' ? t.brand === brand.name : true);
  });

  var html = '';

  // Build category groups
  var categories = window.todoCategories.slice();
  if (filter !== 'all') {
    categories = categories.filter(function(c) { return c.name === filter; });
  }

  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var catTodos = activeTodos.filter(function(t) { return t.category === cat.name; });
    if (catTodos.length === 0 && filter === 'all') continue;

    // Sort by due date
    catTodos.sort(function(a, b) {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    html += '<div class="focus-category-group">';
    html += '<div class="focus-category-group-header">';
    html += '<div class="focus-category-color" style="background:' + escapeHtml(cat.color) + ';"></div>';
    html += '<div class="focus-category-name">' + escapeHtml(cat.name) + '</div>';
    html += '<div class="focus-category-count">' + catTodos.length + '</div>';
    html += '<div class="focus-category-line"></div></div>';

    for (var j = 0; j < catTodos.length; j++) {
      var t = catTodos[j];
      var dueStr = '';
      var dueClass = '';
      if (t.dueDate) {
        var d = new Date(t.dueDate);
        var today = new Date();
        today.setHours(0,0,0,0);
        d.setHours(0,0,0,0);
        if (d.getTime() === today.getTime()) {
          dueStr = 'Today';
          dueClass = ' today';
        } else {
          dueStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        }
      }

      html += '<div class="focus-task-row">';
      html += '<div class="focus-task-checkbox" style="border-color:' + escapeHtml(cat.color) + ';" onclick="toggleFocusSourceTask(\'' + escapeHtml(t.id) + '\')"></div>';
      html += '<div class="focus-task-text">' + escapeHtml(t.text) + '</div>';
      if (t.brand) html += '<div class="focus-task-brand-tag">' + escapeHtml(t.brand) + '</div>';
      if (dueStr) html += '<div class="focus-task-due' + dueClass + '">' + escapeHtml(dueStr) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Uncategorized ("Other")
  if (filter === 'all') {
    var uncategorized = activeTodos.filter(function(t) {
      return !t.category || !window.todoCategories.some(function(c) { return c.name === t.category; });
    });
    if (uncategorized.length > 0) {
      html += '<div class="focus-category-group">';
      html += '<div class="focus-category-group-header">';
      html += '<div class="focus-category-color" style="background:rgba(255,255,255,0.2);"></div>';
      html += '<div class="focus-category-name">Other</div>';
      html += '<div class="focus-category-count">' + uncategorized.length + '</div>';
      html += '<div class="focus-category-line"></div></div>';
      for (var k = 0; k < uncategorized.length; k++) {
        var ut = uncategorized[k];
        var utDue = '';
        var utClass = '';
        if (ut.dueDate) {
          var ud = new Date(ut.dueDate);
          var utToday = new Date();
          utToday.setHours(0,0,0,0);
          ud.setHours(0,0,0,0);
          utDue = ud.getTime() === utToday.getTime() ? 'Today' : ud.toLocaleDateString('en-US', { weekday: 'short' });
          utClass = ud.getTime() === utToday.getTime() ? ' today' : '';
        }
        html += '<div class="focus-task-row">';
        html += '<div class="focus-task-checkbox" onclick="toggleFocusSourceTask(\'' + escapeHtml(ut.id) + '\')"></div>';
        html += '<div class="focus-task-text">' + escapeHtml(ut.text) + '</div>';
        if (ut.brand) html += '<div class="focus-task-brand-tag">' + escapeHtml(ut.brand) + '</div>';
        if (utDue) html += '<div class="focus-task-due' + utClass + '">' + escapeHtml(utDue) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }
  }

  if (!html) {
    html = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">No tasks yet. Add a task or use AI Categories to get started.</div>';
  }

  container.innerHTML = html;
}

function promptNewFocusCategory() {
  var name = prompt('Category name:');
  if (!name || !name.trim()) return;
  // Pick a color from a preset rotation
  var colors = ['#a78bfa', '#4ade80', '#fbbf24', '#f472b6', '#22d3ee', '#fb923c', '#a3e635'];
  var color = colors[window.todoCategories.length % colors.length];
  window.todoCategories.push({ name: name.trim(), color: color });
  saveTodoCategories();
  renderFocusTasksView();
}

function addTodoFromFocusTasks() {
  var text = prompt('Task:');
  if (!text || !text.trim()) return;
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var newTodo = {
    id: 'todo_' + Date.now(),
    text: text.trim(),
    brand: brand.name,
    category: '',
    completed: false,
    createdAt: Date.now(),
    notes: '',
    dueDate: '',
    assignedTo: '',
    _modifiedAt: Date.now()
  };
  todos.push(newTodo);
  saveTodos();
  renderFocusTasksView();
  updateFocusPersistentStats();
}
```

- [ ] **Step 2: Add generateAICategories function**

```javascript
// v26.1: AI-powered category suggestions
function generateAICategories() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var activeTodos = todos.filter(function(t) { return !t.completed; });

  if (activeTodos.length === 0) {
    showToast('No tasks to categorize', 'info');
    return;
  }

  var taskList = activeTodos.map(function(t) {
    return t.text + (t.brand ? ' (' + t.brand + ')' : '');
  }).join(', ');

  var prompt = 'Given these tasks across brands: ' + taskList + '. ' +
    'Suggest 3-5 functional categories that group them (e.g., Marketing, Operations, Finance, Content, Strategy). ' +
    'Also assign each task to a category. ' +
    'Format as JSON: {"categories":["name1","name2"],"assignments":{"task text":"category name"}}';

  showToast('Generating categories...', 'info');

  try {
    var callback = function(response) {
      try {
        var jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON');
        var data = JSON.parse(jsonMatch[0]);

        if (!data.categories || !Array.isArray(data.categories)) throw new Error('Invalid format');

        // Show confirmation
        var msg = 'AI suggests these categories:\n\n' + data.categories.join(', ') + '\n\nApply these categories?';
        if (!confirm(msg)) return;

        // Create categories
        var colors = ['#a78bfa', '#4ade80', '#fbbf24', '#f472b6', '#22d3ee', '#fb923c', '#a3e635'];
        for (var i = 0; i < data.categories.length; i++) {
          var exists = window.todoCategories.some(function(c) { return c.name === data.categories[i]; });
          if (!exists) {
            window.todoCategories.push({
              name: data.categories[i],
              color: colors[window.todoCategories.length % colors.length]
            });
          }
        }
        saveTodoCategories();

        // Assign tasks
        if (data.assignments) {
          for (var j = 0; j < todos.length; j++) {
            var assigned = data.assignments[todos[j].text];
            if (assigned && data.categories.indexOf(assigned) !== -1) {
              todos[j].category = assigned;
            }
          }
          saveTodos();
        }

        renderFocusTasksView();
        showToast('Categories created and tasks assigned', 'success');
      } catch(e) {
        showToast('Could not generate categories', 'error');
      }
    };

    var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
    var provider = settings.provider || brand.provider || 'anthropic';
    var aiModel = settings.model || brand.model || 'claude-sonnet-4-6';
    getApiKey(provider).then(function(apiKey) {
      if (!apiKey) { showToast('No API key configured', 'error'); return; }
      callBrandAIGeneratorAPI(provider, aiModel, apiKey, prompt).then(callback).catch(function() {
        showToast('Could not generate categories', 'error');
      });
    }).catch(function() { showToast('Could not load API key', 'error'); });
  } catch(e) {
    showToast('Could not generate categories', 'error');
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.1: implement Tasks pill with category groups and AI categories"
```

---

### Task 7: Integration testing and version bump

**Files:**
- Modify: `RoweOS/dist/index.html` (version constant + CLAUDE.md)

- [ ] **Step 1: Verify pill navigation works**

Open the app, navigate to Focus. Verify:
- Persistent header shows greeting, date, stat badges
- 3 pills render: Dashboard, Today & Upcoming, Tasks
- Clicking each pill swaps content
- Dashboard shows existing widget grid with Customize button
- Pill state persists across page refreshes

- [ ] **Step 2: Verify Today & Upcoming**

- AI briefing card generates (or shows fallback on error)
- 4 source cards render with real data
- Calendar events show with color borders
- Tasks show with checkboxes (clicking completes)
- Automations show with status dots
- Reminders show with due times
- Inline chat input accepts messages

- [ ] **Step 3: Verify Tasks pill**

- Category pills render from existing `todoCategories`
- "+ New" creates a new category
- "AI Categories" button generates suggestions (with confirmation modal)
- Tasks grouped by category with brand tags and due dates
- Uncategorized tasks appear in "Other" section
- Checking off a task updates stats

- [ ] **Step 4: Verify mobile layout**

- Source grid stacks to single column below 768px
- Persistent header stacks greeting above stats
- Pill nav scrolls horizontally if needed

- [ ] **Step 5: Update version to v26.1**

Search for `ROWEOS_VERSION` and update from v26.0 to v26.1. Update launch screen, mobile header, settings, sidebar footer.

- [ ] **Step 6: Final commit**

```bash
git add RoweOS/dist/index.html
git commit -m "v26.1: Focus view redesign complete -- 3 pills, AI briefing, category tasks"
```
