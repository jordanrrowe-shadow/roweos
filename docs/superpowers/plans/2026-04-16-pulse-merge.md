# Pulse Merge (Focus + Pulse → Unified Pulse) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Focus into Pulse so that Pulse Goals become the universal task system for all of RoweOS. Retire the Focus (Signal) view entirely.

**Architecture:** Pulse Goal items gain `date`, `assignedTo`, `notes`, and `priority` fields from Focus todos. An "Unassigned" default goal catches orphan tasks. Focus's calendar, today view, stats, notes, and streaks become tabs within Pulse. All 7+ task creation call sites across the app are rewritten to use `addItemToPulseGoal()`. A one-time migration converts existing Focus todos into Pulse Goal items grouped by category.

**Tech Stack:** Vanilla JS (ES5), localStorage + Firestore write-through sync, existing Pulse Goal data model extended.

---

### Task 1: Extend Pulse Goal Data Model

**Files:**
- Modify: `src/js/core/25-documents-lifeai.js` (around line 7385-7420)

- [ ] **Step 1: Add new fields to `savePulseGoals()` backfill logic**

In `savePulseGoals()` (~line 7397), the function already backfills `id` and `_modifiedAt`. Add backfill for new goal-level fields and item-level fields:

```javascript
// v28.8: Extended Pulse Goal model — universal task system
function savePulseGoals() {
  if (!Array.isArray(pulseGoals)) pulseGoals = [];
  for (var gi = 0; gi < pulseGoals.length; gi++) {
    var g = pulseGoals[gi];
    if (!g.id) g.id = 'goal_' + Date.now() + '_' + gi;
    if (!g._modifiedAt) g._modifiedAt = Date.now();
    // v28.8: New fields
    if (typeof g.isDefault === 'undefined') g.isDefault = false;
    if (typeof g.color === 'undefined') g.color = null;
    if (typeof g.icon === 'undefined') g.icon = null;
    if (typeof g.brandIdx === 'undefined') g.brandIdx = null;
    // Backfill items
    var allItems = (g.items || []);
    if (g.sections) {
      for (var si = 0; si < g.sections.length; si++) {
        allItems = allItems.concat(g.sections[si].items || []);
      }
    }
    for (var ii = 0; ii < allItems.length; ii++) {
      var item = allItems[ii];
      if (!item.id) item.id = 'item_' + Date.now() + '_' + ii;
      if (typeof item.date === 'undefined') item.date = null;
      if (typeof item.assignedTo === 'undefined') item.assignedTo = null;
      if (typeof item.notes === 'undefined') item.notes = null;
      if (typeof item.priority === 'undefined') item.priority = null;
      if (typeof item.createdAt === 'undefined') item.createdAt = new Date().toISOString();
      if (typeof item._modifiedAt === 'undefined') item._modifiedAt = Date.now();
    }
  }
  localStorage.setItem('roweos_pulse_goals', JSON.stringify(pulseGoals));
  try { writeDB('pulse/main', { goals: pulseGoals }, { category: 'goals' }); } catch(e) {}
}
```

- [ ] **Step 2: Add `getUnassignedGoal()` function**

Add after `savePulseGoals()`:

```javascript
// v28.8: Get or create the default "Unassigned" goal for current mode
function getUnassignedGoal() {
  var mode = isLifeMode() ? 'lifeai' : 'brandai';
  var existing = pulseGoals.filter(function(g) { return g.isDefault && g.source === mode; });
  if (existing.length > 0) return existing[0];
  var newGoal = {
    id: 'goal_unassigned_' + mode + '_' + Date.now(),
    name: 'Unassigned',
    description: 'Tasks without a specific goal',
    completed: false,
    archived: false,
    isDefault: true,
    color: null,
    icon: null,
    source: mode,
    brandIdx: typeof selectedBrand !== 'undefined' ? selectedBrand : null,
    _modifiedAt: Date.now(),
    items: [],
    sections: []
  };
  pulseGoals.push(newGoal);
  savePulseGoals();
  return newGoal;
}
```

- [ ] **Step 3: Add universal task CRUD functions**

Add after `getUnassignedGoal()`:

```javascript
// v28.8: Universal task creation — ALL task creation in RoweOS goes through this
function addItemToPulseGoal(goalId, itemData) {
  var goal = null;
  if (!goalId) {
    goal = getUnassignedGoal();
  } else {
    for (var i = 0; i < pulseGoals.length; i++) {
      if (pulseGoals[i].id === goalId) { goal = pulseGoals[i]; break; }
    }
  }
  if (!goal) goal = getUnassignedGoal();
  if (!goal.items) goal.items = [];
  var item = {
    id: itemData.id || ('item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
    text: itemData.text || '',
    completed: itemData.completed || false,
    completedAt: itemData.completedAt || null,
    date: itemData.date || null,
    assignedTo: itemData.assignedTo || null,
    notes: itemData.notes || null,
    priority: itemData.priority || null,
    createdAt: itemData.createdAt || new Date().toISOString(),
    _modifiedAt: Date.now()
  };
  goal.items.push(item);
  goal._modifiedAt = Date.now();
  savePulseGoals();
  return item;
}

function removeItemFromPulseGoal(goalId, itemId) {
  for (var i = 0; i < pulseGoals.length; i++) {
    if (pulseGoals[i].id !== goalId) continue;
    var g = pulseGoals[i];
    g.items = (g.items || []).filter(function(it) { return it.id !== itemId; });
    if (g.sections) {
      for (var s = 0; s < g.sections.length; s++) {
        g.sections[s].items = (g.sections[s].items || []).filter(function(it) { return it.id !== itemId; });
      }
    }
    g._modifiedAt = Date.now();
    break;
  }
  savePulseGoals();
}

function moveItemBetweenGoals(fromGoalId, toGoalId, itemId) {
  var item = null;
  // Find and remove from source
  for (var i = 0; i < pulseGoals.length; i++) {
    if (pulseGoals[i].id !== fromGoalId) continue;
    var g = pulseGoals[i];
    var items = g.items || [];
    for (var j = 0; j < items.length; j++) {
      if (items[j].id === itemId) { item = items.splice(j, 1)[0]; break; }
    }
    if (!item && g.sections) {
      for (var s = 0; s < g.sections.length; s++) {
        var sItems = g.sections[s].items || [];
        for (var k = 0; k < sItems.length; k++) {
          if (sItems[k].id === itemId) { item = sItems.splice(k, 1)[0]; break; }
        }
        if (item) break;
      }
    }
    g._modifiedAt = Date.now();
    break;
  }
  if (!item) return;
  // Add to target
  addItemToPulseGoal(toGoalId, item);
}

// v28.8: Cross-goal queries for Today/Calendar views
function getAllTasksForDate(dateStr) {
  var results = [];
  for (var i = 0; i < pulseGoals.length; i++) {
    var g = pulseGoals[i];
    if (g.archived || g.completed) continue;
    var allItems = (g.items || []).slice();
    if (g.sections) {
      for (var s = 0; s < g.sections.length; s++) {
        allItems = allItems.concat(g.sections[s].items || []);
      }
    }
    for (var j = 0; j < allItems.length; j++) {
      if (allItems[j].date === dateStr) {
        results.push({ goal: g, item: allItems[j] });
      }
    }
  }
  return results;
}

function getAllTasksForPerson(personId) {
  var results = [];
  for (var i = 0; i < pulseGoals.length; i++) {
    var g = pulseGoals[i];
    var allItems = (g.items || []).slice();
    if (g.sections) {
      for (var s = 0; s < g.sections.length; s++) {
        allItems = allItems.concat(g.sections[s].items || []);
      }
    }
    for (var j = 0; j < allItems.length; j++) {
      if (allItems[j].assignedTo === personId) {
        results.push({ goal: g, item: allItems[j] });
      }
    }
  }
  return results;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/js/core/25-documents-lifeai.js
git commit -m "v28.8: Extend Pulse Goal model with universal task CRUD functions"
```

---

### Task 2: Focus Todo → Pulse Goal Migration

**Files:**
- Modify: `src/js/core/25-documents-lifeai.js` (after the CRUD functions from Task 1)
- Modify: `src/js/core/09-state.js` (migration flag check)

- [ ] **Step 1: Add migration function**

Add to `25-documents-lifeai.js` after the CRUD functions:

```javascript
// v28.8: One-time migration — Focus todos → Pulse Goal items
function migrateFocusTodosToPulseGoals() {
  if (localStorage.getItem('roweos_focus_pulse_migrated') === 'true') return;

  var brandTodos = [];
  var lifeTodos = [];
  try { brandTodos = JSON.parse(localStorage.getItem('roweosTodos') || '[]'); } catch(e) {}
  try { lifeTodos = JSON.parse(localStorage.getItem('roweos_life_todos') || '[]'); } catch(e) {}
  if (!Array.isArray(brandTodos)) brandTodos = [];
  if (!Array.isArray(lifeTodos)) lifeTodos = [];

  var allTodos = brandTodos.concat(lifeTodos);
  if (allTodos.length === 0) {
    localStorage.setItem('roweos_focus_pulse_migrated', 'true');
    return;
  }

  // Load categories for color/icon
  var brandCats = [];
  var lifeCats = [];
  try { brandCats = JSON.parse(localStorage.getItem('roweos_todo_categories') || '[]'); } catch(e) {}
  try { lifeCats = JSON.parse(localStorage.getItem('roweos_life_todo_categories') || '[]'); } catch(e) {}
  if (!Array.isArray(brandCats)) brandCats = [];
  if (!Array.isArray(lifeCats)) lifeCats = [];
  var catMap = {};
  brandCats.concat(lifeCats).forEach(function(c) { if (c && c.name) catMap[c.name] = c; });

  // Group todos by category
  var groups = {};
  for (var i = 0; i < allTodos.length; i++) {
    var t = allTodos[i];
    var cat = t.category || '_unassigned';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  }

  // Create a Pulse Goal per category
  var keys = Object.keys(groups);
  for (var k = 0; k < keys.length; k++) {
    var catName = keys[k];
    var todos = groups[catName];
    var catInfo = catMap[catName] || {};
    var isUnassigned = catName === '_unassigned';
    var mode = todos[0] && todos[0].isLife ? 'lifeai' : 'brandai';

    // Check if unassigned goal already exists for this mode
    if (isUnassigned) {
      var existing = getUnassignedGoal();
      for (var j = 0; j < todos.length; j++) {
        addItemToPulseGoal(existing.id, {
          text: todos[j].text,
          completed: todos[j].completed || false,
          completedAt: todos[j].completedAt || null,
          date: todos[j].date || null,
          assignedTo: todos[j].assignedTo || null,
          notes: todos[j].notes || null,
          createdAt: todos[j].createdAt || new Date().toISOString()
        });
      }
      continue;
    }

    var goal = {
      id: 'goal_migrated_' + Date.now() + '_' + k,
      name: catName,
      description: 'Migrated from Focus',
      completed: false,
      archived: false,
      isDefault: false,
      color: catInfo.color || null,
      icon: catInfo.icon || null,
      source: mode,
      brandIdx: null,
      _modifiedAt: Date.now(),
      items: [],
      sections: []
    };

    for (var j = 0; j < todos.length; j++) {
      goal.items.push({
        id: 'item_migrated_' + Date.now() + '_' + j,
        text: todos[j].text,
        completed: todos[j].completed || false,
        completedAt: todos[j].completedAt || null,
        date: todos[j].date || null,
        assignedTo: todos[j].assignedTo || null,
        notes: todos[j].notes || null,
        priority: null,
        createdAt: todos[j].createdAt || new Date().toISOString(),
        _modifiedAt: Date.now()
      });
    }

    pulseGoals.push(goal);
  }

  savePulseGoals();
  localStorage.setItem('roweos_focus_pulse_migrated', 'true');
  console.log('[Migration] Migrated ' + allTodos.length + ' Focus todos into Pulse Goals');
}
```

- [ ] **Step 2: Call migration at app init**

In `src/js/core/09-state.js`, find the data initialization section (after `pulseGoals` is loaded from localStorage). Add:

```javascript
// v28.8: Migrate Focus todos to Pulse Goals (one-time)
if (typeof migrateFocusTodosToPulseGoals === 'function') {
  try { migrateFocusTodosToPulseGoals(); } catch(e) { console.error('[Migration] Focus→Pulse failed:', e); }
}
```

Note: Since `25-documents-lifeai.js` loads after `09-state.js` in the build order, the migration call should be placed in a `DOMContentLoaded` handler or called from `initPulse2()` instead. Check build order — if `09-state.js` runs before `25-documents-lifeai.js`, add the migration call at the top of `initPulse2()` in `25-documents-lifeai.js` instead.

- [ ] **Step 3: Commit**

```bash
git add src/js/core/25-documents-lifeai.js src/js/core/09-state.js
git commit -m "v28.8: Add Focus todo → Pulse Goal migration"
```

---

### Task 3: Add Tabs to Pulse View HTML

**Files:**
- Modify: `src/html/brand/06-pulse.html`

- [ ] **Step 1: Add pill nav tabs to Pulse view**

Replace the top of the Pulse view HTML (the overview/checklists containers) with a tabbed layout. Keep all existing container IDs so current render functions still work:

```html
<!-- v28.8: Unified Pulse — tabbed layout -->
<div class="pulse-tab-bar" id="pulseTabBar">
  <button class="pulse-tab active" data-tab="overview" onclick="switchPulseTab('overview')">Overview</button>
  <button class="pulse-tab" data-tab="today" onclick="switchPulseTab('today')">Today</button>
  <button class="pulse-tab" data-tab="calendar" onclick="switchPulseTab('calendar')">Calendar</button>
  <button class="pulse-tab" data-tab="goals" onclick="switchPulseTab('goals')">Goals</button>
  <button class="pulse-tab" data-tab="notes" onclick="switchPulseTab('notes')">Notes</button>
  <button class="pulse-tab" data-tab="streaks" onclick="switchPulseTab('streaks')">Streaks</button>
</div>

<!-- Overview tab (existing Pulse 3.0 content) -->
<div class="pulse-tab-content active" id="pulseTabOverview" data-pulse-tab="overview">
  <div id="pulse3Overview"></div>
  <div id="pulse3Checklists"></div>
  <div id="pulse3Suggestions"></div>
</div>

<!-- Today tab (from Focus day detail) -->
<div class="pulse-tab-content" id="pulseTabToday" data-pulse-tab="today">
  <div id="pulseTodayContent"></div>
</div>

<!-- Calendar tab (from Focus mini-calendar) -->
<div class="pulse-tab-content" id="pulseTabCalendar" data-pulse-tab="calendar">
  <div id="pulseCalendarWidget"></div>
  <div id="pulseCalendarDayDetail"></div>
</div>

<!-- Goals tab (detailed goal management) -->
<div class="pulse-tab-content" id="pulseTabGoals" data-pulse-tab="goals">
  <div id="pulseGoalsList"></div>
</div>

<!-- Notes tab (from Focus daily notes) -->
<div class="pulse-tab-content" id="pulseTabNotes" data-pulse-tab="notes">
  <div id="pulseNotesContent"></div>
</div>

<!-- Streaks tab -->
<div class="pulse-tab-content" id="pulseTabStreaks" data-pulse-tab="streaks">
  <div id="pulseStreaksContent"></div>
</div>
```

Keep the existing Pulse 2.0 journal section below the tabs (it stays unchanged).

- [ ] **Step 2: Commit**

```bash
git add src/html/brand/06-pulse.html
git commit -m "v28.8: Add tabbed layout to Pulse view HTML"
```

---

### Task 4: Implement Pulse Tab Switching + Today/Calendar/Notes/Streaks Renders

**Files:**
- Modify: `src/js/core/25-documents-lifeai.js`

- [ ] **Step 1: Add tab switching function**

```javascript
// v28.8: Pulse tab switching
var _activePulseTab = 'overview';

function switchPulseTab(tabId) {
  _activePulseTab = tabId;
  var tabs = document.querySelectorAll('.pulse-tab');
  var contents = document.querySelectorAll('.pulse-tab-content');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabId);
  }
  for (var j = 0; j < contents.length; j++) {
    contents[j].classList.toggle('active', contents[j].getAttribute('data-pulse-tab') === tabId);
  }
  // Render tab content on switch
  if (tabId === 'today') renderPulseTodayTab();
  if (tabId === 'calendar') renderPulseCalendarTab();
  if (tabId === 'goals') renderPulseGoalsTab();
  if (tabId === 'notes') renderPulseNotesTab();
  if (tabId === 'streaks') renderPulseStreaksTab();
}
```

- [ ] **Step 2: Add Today tab render**

Port the core logic from `renderFocus2DayDetailContent()` in `15-focus.js`, but query Pulse Goals instead of Focus todos:

```javascript
// v28.8: Today tab — aggregates all tasks due today across all goals
function renderPulseTodayTab() {
  var container = document.getElementById('pulseTodayContent');
  if (!container) return;
  var today = new Date();
  var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

  // Get all tasks for today from Pulse Goals
  var todayTasks = getAllTasksForDate(todayStr);

  // Get calendar events for today (reuse existing calendar data)
  var calEvents = [];
  if (typeof getCalendarItems === 'function') {
    try { calEvents = getCalendarItems().filter(function(e) { return e.date === todayStr; }); } catch(e) {}
  }

  // Get due automations
  var dueAutos = [];
  if (typeof getScheduledTasks === 'function') {
    try {
      var allTasks = getScheduledTasks();
      dueAutos = allTasks.filter(function(t) { return t.enabled && t.time; });
    } catch(e) {}
  }

  // Get due reminders
  var dueReminders = [];
  if (typeof window.reminders !== 'undefined' && Array.isArray(window.reminders)) {
    dueReminders = window.reminders.filter(function(r) {
      return r.status === 'pending' && r.scheduledAt && r.scheduledAt.indexOf(todayStr) === 0;
    });
  }

  var html = '<div class="pulse-today-header">';
  html += '<h3 style="margin:0;font-size:16px;font-weight:600;">Today</h3>';
  html += '<span style="font-size:13px;opacity:0.6;">' + today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</span>';
  html += '</div>';

  // Stats row
  var pendingCount = todayTasks.filter(function(t) { return !t.item.completed; }).length;
  var doneCount = todayTasks.filter(function(t) { return t.item.completed; }).length;
  html += '<div class="pulse-today-stats">';
  html += '<div class="pulse-today-stat"><span class="pulse-today-stat-num">' + pendingCount + '</span><span class="pulse-today-stat-label">To Do</span></div>';
  html += '<div class="pulse-today-stat"><span class="pulse-today-stat-num">' + doneCount + '</span><span class="pulse-today-stat-label">Done</span></div>';
  html += '<div class="pulse-today-stat"><span class="pulse-today-stat-num">' + calEvents.length + '</span><span class="pulse-today-stat-label">Events</span></div>';
  html += '</div>';

  // Calendar events
  if (calEvents.length > 0) {
    html += '<div class="pulse-today-section"><h4>Events</h4>';
    for (var e = 0; e < calEvents.length; e++) {
      var ev = calEvents[e];
      html += '<div class="pulse-today-event">';
      html += '<span class="pulse-today-event-time">' + escapeHtml(ev.time || '') + '</span>';
      html += '<span class="pulse-today-event-title">' + escapeHtml(ev.title || ev.name || '') + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Tasks grouped by goal
  if (todayTasks.length > 0) {
    html += '<div class="pulse-today-section"><h4>Tasks</h4>';
    // Group by goal
    var goalGroups = {};
    for (var t = 0; t < todayTasks.length; t++) {
      var gId = todayTasks[t].goal.id;
      if (!goalGroups[gId]) goalGroups[gId] = { goal: todayTasks[t].goal, items: [] };
      goalGroups[gId].items.push(todayTasks[t].item);
    }
    var gKeys = Object.keys(goalGroups);
    for (var gk = 0; gk < gKeys.length; gk++) {
      var grp = goalGroups[gKeys[gk]];
      html += '<div class="pulse-today-goal-group">';
      html += '<div class="pulse-today-goal-label">' + escapeHtml(grp.goal.name) + '</div>';
      for (var ti = 0; ti < grp.items.length; ti++) {
        var task = grp.items[ti];
        html += '<div class="pulse-today-task ' + (task.completed ? 'completed' : '') + '">';
        html += '<input type="checkbox" ' + (task.completed ? 'checked' : '') + ' onchange="togglePulseChecklistItem(\'' + grp.goal.id + '\', \'' + task.id + '\')">';
        html += '<span>' + escapeHtml(task.text) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  // Reminders
  if (dueReminders.length > 0) {
    html += '<div class="pulse-today-section"><h4>Reminders</h4>';
    for (var r = 0; r < dueReminders.length; r++) {
      html += '<div class="pulse-today-reminder">' + escapeHtml(dueReminders[r].title) + '</div>';
    }
    html += '</div>';
  }

  if (todayTasks.length === 0 && calEvents.length === 0 && dueReminders.length === 0) {
    html += '<div class="pulse-today-empty">No tasks, events, or reminders for today.</div>';
  }

  container.innerHTML = html;
}
```

- [ ] **Step 3: Add Calendar tab render**

Port the mini-calendar from `renderFocus2MiniCalendar()`:

```javascript
// v28.8: Calendar tab — mini calendar + day detail
var _pulseCalendarDate = new Date();
var _pulseSelectedDate = null;

function renderPulseCalendarTab() {
  var container = document.getElementById('pulseCalendarWidget');
  if (!container) return;

  var year = _pulseCalendarDate.getFullYear();
  var month = _pulseCalendarDate.getMonth();
  var today = new Date();
  var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var startOffset = (firstDay === 0) ? 6 : firstDay - 1; // Monday start

  var monthName = _pulseCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  var html = '<div class="pulse-cal-header">';
  html += '<button class="pulse-cal-nav" onclick="_pulseCalendarDate.setMonth(_pulseCalendarDate.getMonth()-1);renderPulseCalendarTab();">&lt;</button>';
  html += '<span class="pulse-cal-month">' + monthName + '</span>';
  html += '<button class="pulse-cal-nav" onclick="_pulseCalendarDate.setMonth(_pulseCalendarDate.getMonth()+1);renderPulseCalendarTab();">&gt;</button>';
  html += '</div>';

  html += '<div class="pulse-cal-grid">';
  var dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  for (var d = 0; d < 7; d++) {
    html += '<div class="pulse-cal-day-label">' + dayLabels[d] + '</div>';
  }

  for (var e = 0; e < startOffset; e++) {
    html += '<div class="pulse-cal-day empty"></div>';
  }

  for (var day = 1; day <= daysInMonth; day++) {
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var isToday = dateStr === todayStr;
    var isSelected = _pulseSelectedDate === dateStr;
    var hasTasks = getAllTasksForDate(dateStr).length > 0;
    var cls = 'pulse-cal-day';
    if (isToday) cls += ' is-today';
    if (isSelected) cls += ' is-selected';
    if (hasTasks) cls += ' has-tasks';
    html += '<div class="' + cls + '" onclick="selectPulseCalendarDay(\'' + dateStr + '\')">' + day + '</div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Show day detail if a date is selected
  if (_pulseSelectedDate) {
    renderPulseCalendarDayDetail(_pulseSelectedDate);
  }
}

function selectPulseCalendarDay(dateStr) {
  _pulseSelectedDate = dateStr;
  renderPulseCalendarTab();
}

function renderPulseCalendarDayDetail(dateStr) {
  var container = document.getElementById('pulseCalendarDayDetail');
  if (!container) return;
  var tasks = getAllTasksForDate(dateStr);
  var date = new Date(dateStr + 'T12:00:00');
  var label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  var html = '<div class="pulse-cal-detail-header">' + label + '</div>';
  if (tasks.length === 0) {
    html += '<div class="pulse-cal-detail-empty">No tasks scheduled</div>';
  } else {
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      html += '<div class="pulse-today-task ' + (t.item.completed ? 'completed' : '') + '">';
      html += '<input type="checkbox" ' + (t.item.completed ? 'checked' : '') + ' onchange="togglePulseChecklistItem(\'' + t.goal.id + '\', \'' + t.item.id + '\')">';
      html += '<span>' + escapeHtml(t.item.text) + '</span>';
      html += '<span class="pulse-cal-detail-goal">' + escapeHtml(t.goal.name) + '</span>';
      html += '</div>';
    }
  }
  container.innerHTML = html;
}
```

- [ ] **Step 4: Add Goals tab render (detailed goal management)**

```javascript
// v28.8: Goals tab — full goal list with filter
function renderPulseGoalsTab() {
  var container = document.getElementById('pulseGoalsList');
  if (!container) return;
  // Reuse existing renderPulse3Checklists but render into goals tab container
  var originalContainer = document.getElementById('pulse3Checklists');
  if (originalContainer && typeof renderPulse3Checklists === 'function') {
    renderPulse3Checklists();
    // Clone content to goals tab
    container.innerHTML = originalContainer.innerHTML;
  }
}
```

- [ ] **Step 5: Add Notes tab render**

Port from Focus daily notes (`loadFocus2Notes()` in `15-focus.js`):

```javascript
// v28.8: Notes tab — daily notes (ported from Focus)
function renderPulseNotesTab() {
  var container = document.getElementById('pulseNotesContent');
  if (!container) return;
  var today = new Date();
  var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  var noteKey = 'roweos_focus2_notes_' + todayStr;
  var note = localStorage.getItem(noteKey) || '';

  var html = '<div class="pulse-notes-header">';
  html += '<h3 style="margin:0;font-size:16px;font-weight:600;">Daily Notes</h3>';
  html += '<span style="font-size:13px;opacity:0.6;">' + today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</span>';
  html += '</div>';
  html += '<textarea class="pulse-notes-textarea" id="pulseNotesTextarea" placeholder="Write your notes for today..." oninput="savePulseNote()">' + escapeHtml(note) + '</textarea>';
  html += '<div style="text-align:right;margin-top:8px;">';
  html += '<button class="btn-secondary" onclick="savePulseNoteToJournal()" style="font-size:12px;">Save to Journal</button>';
  html += '</div>';

  container.innerHTML = html;
}

function savePulseNote() {
  var textarea = document.getElementById('pulseNotesTextarea');
  if (!textarea) return;
  var today = new Date();
  var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  localStorage.setItem('roweos_focus2_notes_' + todayStr, textarea.value);
}

function savePulseNoteToJournal() {
  var textarea = document.getElementById('pulseNotesTextarea');
  if (!textarea || !textarea.value.trim()) { showToast('No notes to save', 'warning'); return; }
  if (typeof addJournalEntry === 'function') {
    addJournalEntry(textarea.value.trim());
    showToast('Note saved to Journal', 'success');
  }
}
```

- [ ] **Step 6: Add Streaks tab render**

Port streak calculation from `updateFocus2Stats()` in `15-focus.js`:

```javascript
// v28.8: Streaks tab — completion streak tracking
function renderPulseStreaksTab() {
  var container = document.getElementById('pulseStreaksContent');
  if (!container) return;

  // Calculate streak from Pulse Goal completions
  var completedDates = {};
  for (var i = 0; i < pulseGoals.length; i++) {
    var g = pulseGoals[i];
    var allItems = (g.items || []).slice();
    if (g.sections) {
      for (var s = 0; s < g.sections.length; s++) {
        allItems = allItems.concat(g.sections[s].items || []);
      }
    }
    for (var j = 0; j < allItems.length; j++) {
      if (allItems[j].completedAt) {
        var dateKey = allItems[j].completedAt.split('T')[0];
        completedDates[dateKey] = (completedDates[dateKey] || 0) + 1;
      }
    }
  }

  // Calculate consecutive streak from today backward
  var streak = 0;
  var checkDate = new Date();
  for (var d = 0; d < 365; d++) {
    var dateStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');
    if (completedDates[dateStr]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (d === 0) {
      // Today doesn't have completions yet — that's ok, check yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Store streak
  localStorage.setItem('roweosStreak', String(streak));

  var html = '<div class="pulse-streaks-hero">';
  html += '<div class="pulse-streak-number">' + streak + '</div>';
  html += '<div class="pulse-streak-label">Day Streak</div>';
  html += '</div>';

  // Last 30 days heatmap
  html += '<div class="pulse-streak-heatmap"><h4>Last 30 Days</h4><div class="pulse-streak-grid">';
  for (var h = 29; h >= 0; h--) {
    var hDate = new Date();
    hDate.setDate(hDate.getDate() - h);
    var hStr = hDate.getFullYear() + '-' + String(hDate.getMonth() + 1).padStart(2, '0') + '-' + String(hDate.getDate()).padStart(2, '0');
    var count = completedDates[hStr] || 0;
    var intensity = count === 0 ? 'none' : count <= 2 ? 'low' : count <= 5 ? 'med' : 'high';
    html += '<div class="pulse-streak-cell ' + intensity + '" title="' + hStr + ': ' + count + ' completed"></div>';
  }
  html += '</div></div>';

  // Stats
  var totalCompleted = 0;
  var dateKeys = Object.keys(completedDates);
  for (var dk = 0; dk < dateKeys.length; dk++) { totalCompleted += completedDates[dateKeys[dk]]; }

  html += '<div class="pulse-streaks-stats">';
  html += '<div class="pulse-today-stat"><span class="pulse-today-stat-num">' + totalCompleted + '</span><span class="pulse-today-stat-label">All Time</span></div>';
  html += '<div class="pulse-today-stat"><span class="pulse-today-stat-num">' + (completedDates[new Date().toISOString().split('T')[0]] || 0) + '</span><span class="pulse-today-stat-label">Today</span></div>';
  html += '<div class="pulse-today-stat"><span class="pulse-today-stat-num">' + dateKeys.length + '</span><span class="pulse-today-stat-label">Active Days</span></div>';
  html += '</div>';

  container.innerHTML = html;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/js/core/25-documents-lifeai.js
git commit -m "v28.8: Add Pulse tab switching, Today, Calendar, Notes, Streaks renders"
```

---

### Task 5: Add Pulse Tab CSS

**Files:**
- Modify: `src/css/core/01-base.css`

- [ ] **Step 1: Add all Pulse tab styles**

Add to end of file (or near existing Pulse styles):

```css
/* v28.8: Unified Pulse Tabs */
.pulse-tab-bar { display:flex; gap:4px; padding:12px 16px 0; border-bottom:1px solid rgba(255,255,255,0.08); overflow-x:auto; -webkit-overflow-scrolling:touch; }
.pulse-tab { padding:8px 16px; font-size:13px; font-weight:500; background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer; border-bottom:2px solid transparent; transition:all 0.2s; white-space:nowrap; }
.pulse-tab.active { color:var(--brand-accent, #a89878); border-bottom-color:var(--brand-accent, #a89878); }
.pulse-tab:hover { color:rgba(255,255,255,0.8); }
.pulse-tab-content { display:none; padding:16px; }
.pulse-tab-content.active { display:block; }
html.light-mode .pulse-tab { color:rgba(0,0,0,0.4); }
html.light-mode .pulse-tab.active { color:var(--brand-accent, #a89878); }
html.light-mode .pulse-tab-bar { border-bottom-color:rgba(0,0,0,0.08); }

/* Today tab */
.pulse-today-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:16px; }
.pulse-today-stats { display:flex; gap:16px; margin-bottom:20px; }
.pulse-today-stat { text-align:center; flex:1; padding:12px; background:rgba(255,255,255,0.04); border-radius:10px; }
.pulse-today-stat-num { display:block; font-size:24px; font-weight:600; color:var(--brand-accent, #a89878); }
.pulse-today-stat-label { font-size:11px; opacity:0.5; text-transform:uppercase; letter-spacing:0.5px; }
.pulse-today-section { margin-bottom:20px; }
.pulse-today-section h4 { font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; opacity:0.5; margin:0 0 8px; }
.pulse-today-task { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; margin-bottom:4px; background:rgba(255,255,255,0.03); }
.pulse-today-task.completed { opacity:0.5; }
.pulse-today-task.completed span { text-decoration:line-through; }
.pulse-today-event { display:flex; gap:12px; padding:8px 12px; border-radius:8px; margin-bottom:4px; background:rgba(255,255,255,0.03); }
.pulse-today-event-time { font-size:12px; font-weight:600; min-width:60px; color:var(--brand-accent, #a89878); }
.pulse-today-goal-group { margin-bottom:12px; }
.pulse-today-goal-label { font-size:11px; font-weight:600; opacity:0.4; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; padding-left:4px; }
.pulse-today-empty { text-align:center; padding:40px 20px; opacity:0.4; font-size:14px; }
.pulse-today-reminder { padding:8px 12px; border-radius:8px; margin-bottom:4px; background:rgba(255,255,255,0.03); }

/* Calendar tab */
.pulse-cal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.pulse-cal-month { font-size:15px; font-weight:600; }
.pulse-cal-nav { background:none; border:none; color:inherit; cursor:pointer; padding:8px 12px; border-radius:6px; font-size:16px; opacity:0.6; }
.pulse-cal-nav:hover { opacity:1; background:rgba(255,255,255,0.06); }
.pulse-cal-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:2px; }
.pulse-cal-day-label { text-align:center; font-size:11px; font-weight:600; opacity:0.4; padding:4px; }
.pulse-cal-day { text-align:center; padding:8px 4px; border-radius:6px; cursor:pointer; font-size:13px; transition:background 0.15s; }
.pulse-cal-day:hover { background:rgba(255,255,255,0.06); }
.pulse-cal-day.empty { cursor:default; }
.pulse-cal-day.is-today { font-weight:700; color:var(--brand-accent, #a89878); }
.pulse-cal-day.is-selected { background:var(--brand-accent, #a89878); color:#fff; }
.pulse-cal-day.has-tasks::after { content:''; display:block; width:4px; height:4px; border-radius:50%; background:var(--brand-accent, #a89878); margin:2px auto 0; }
.pulse-cal-day.is-selected.has-tasks::after { background:#fff; }
.pulse-cal-detail-header { font-size:14px; font-weight:600; margin:16px 0 8px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); }
.pulse-cal-detail-empty { opacity:0.4; font-size:13px; padding:12px 0; }
.pulse-cal-detail-goal { font-size:11px; opacity:0.4; margin-left:auto; }

/* Notes tab */
.pulse-notes-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px; }
.pulse-notes-textarea { width:100%; min-height:300px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px; color:inherit; font-family:inherit; font-size:14px; line-height:1.6; resize:vertical; }
.pulse-notes-textarea:focus { outline:none; border-color:var(--brand-accent, #a89878); }
html.light-mode .pulse-notes-textarea { background:rgba(0,0,0,0.02); border-color:rgba(0,0,0,0.1); }

/* Streaks tab */
.pulse-streaks-hero { text-align:center; padding:30px 0; }
.pulse-streak-number { font-size:64px; font-weight:700; color:var(--brand-accent, #a89878); line-height:1; }
.pulse-streak-label { font-size:14px; opacity:0.5; margin-top:4px; text-transform:uppercase; letter-spacing:1px; }
.pulse-streak-heatmap { margin:20px 0; }
.pulse-streak-heatmap h4 { font-size:13px; font-weight:600; opacity:0.5; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 8px; }
.pulse-streak-grid { display:flex; gap:3px; flex-wrap:wrap; }
.pulse-streak-cell { width:20px; height:20px; border-radius:3px; background:rgba(255,255,255,0.06); }
.pulse-streak-cell.low { background:rgba(168,152,120,0.3); }
.pulse-streak-cell.med { background:rgba(168,152,120,0.6); }
.pulse-streak-cell.high { background:rgba(168,152,120,1); }
.pulse-streaks-stats { display:flex; gap:16px; margin-top:20px; }
html.light-mode .pulse-streak-cell { background:rgba(0,0,0,0.06); }
html.light-mode .pulse-streak-cell.low { background:rgba(168,152,120,0.2); }
html.light-mode .pulse-streak-cell.med { background:rgba(168,152,120,0.4); }
html.light-mode .pulse-streak-cell.high { background:rgba(168,152,120,0.8); }

/* Mobile */
@media (max-width: 768px) {
  .pulse-tab-bar { padding:8px 12px 0; }
  .pulse-tab { padding:6px 12px; font-size:12px; }
  .pulse-tab-content { padding:12px; }
  .pulse-today-stats { flex-wrap:wrap; }
  .pulse-today-stat { min-width:calc(50% - 8px); }
  .pulse-cal-grid { gap:1px; }
  .pulse-cal-day { padding:6px 2px; font-size:12px; }
  .pulse-streak-cell { width:16px; height:16px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/css/core/01-base.css
git commit -m "v28.8: Add Pulse tab and component styles"
```

---

### Task 6: Rewrite Task Creation Call Sites

**Files:**
- Modify: `src/js/core/15-focus.js` — `addTaskToCategory()`
- Modify: `src/js/core/29-analytics-commerce.js` — `addTaskForPerson()`
- Modify: `src/js/core/19-journal.js` — journal inline task creation
- Modify: `src/js/core/28-reminders-notifications.js` — reminder "Add to Focus" action

- [ ] **Step 1: Redirect `addTaskToCategory()` in `15-focus.js`**

Find `addTaskToCategory` (~line 3311). Replace the body to create a Pulse Goal item instead of a Focus todo:

```javascript
// v28.8: Redirected to Pulse Goal system
function addTaskToCategory(categoryName, inputIdx) {
  var input = document.querySelector('.focus-cat-task-input[data-idx="' + inputIdx + '"]');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;

  // Find or create a goal matching this category name
  var goalId = null;
  for (var i = 0; i < pulseGoals.length; i++) {
    if (pulseGoals[i].name === categoryName && !pulseGoals[i].archived) {
      goalId = pulseGoals[i].id;
      break;
    }
  }

  var today = new Date();
  var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

  addItemToPulseGoal(goalId, {
    text: text,
    date: todayStr
  });

  input.value = '';
  showToast('Task added', 'success');
  if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
  if (_activePulseTab === 'today') renderPulseTodayTab();
}
```

- [ ] **Step 2: Redirect `addTaskForPerson()` in `29-analytics-commerce.js`**

Find `addTaskForPerson` (~line 7508). Replace:

```javascript
// v28.8: Create task in Pulse Goal with person assignment
function addTaskForPerson(personId, personName) {
  var text = prompt('New task for ' + (personName || 'person') + ':');
  if (!text || !text.trim()) return;

  addItemToPulseGoal(null, {
    text: text.trim(),
    assignedTo: personId
  });

  showToast('Task added for ' + (personName || 'person'), 'success');
}
```

- [ ] **Step 3: Redirect reminder "Add to Focus" action in `28-reminders-notifications.js`**

Find the `action === 'focus'` handler (~line 408). Change `showView('signal')` to `showView('pulse')`:

```javascript
} else if (action === 'focus') {
  showView('pulse');
  showToast('Reminder added to Pulse', 'info');
}
```

Also find the `action === 'pulse'` handler (~line 396) — this already creates Pulse goals, so it stays as-is.

- [ ] **Step 4: Commit**

```bash
git add src/js/core/15-focus.js src/js/core/29-analytics-commerce.js src/js/core/28-reminders-notifications.js
git commit -m "v28.8: Redirect all task creation to Pulse Goal system"
```

---

### Task 7: Retire Focus (Signal) View

**Files:**
- Modify: `src/js/core/11-agents.js` — remove signal landing config, redirect showView
- Modify: `src/html/core/04-views-batch3.html` — remove Focus sidebar nav items
- Modify: `src/js/core/21-sidebar.js` — remove signalView from panel selectors
- Modify: `src/js/core/27-launch-brandai.js` — redirect showView('signal') calls
- Modify: `src/js/core/14-calendar.js` — redirect showView('signal') call
- Modify: `src/css/core/01-base.css` — update CSS selectors (replace #signalView with #pulseView where needed)

- [ ] **Step 1: Add redirect in `showView()` handler in `11-agents.js`**

Find `if (view === 'signal')` at line 2846. Replace with a redirect:

```javascript
// v28.8: Signal/Focus retired — redirect to Pulse
if (view === 'signal') {
  view = 'pulse';
}
```

This goes BEFORE the existing `if (view === 'pulse')` block so the redirect works transparently.

- [ ] **Step 2: Remove Focus from `_pageLandingConfigs` in `11-agents.js`**

Find the `signal` entry in `_pageLandingConfigs` (~line 2274-2285). Delete the entire `signal: { ... }` object from the config.

- [ ] **Step 3: Remove Focus from sidebar nav in `04-views-batch3.html`**

Find the two Focus nav items:
- Line 53: `navigateToSubSection('Core','signal')` subitem — delete this `<div>` or `<li>`
- Line 141: `showPageLanding('signal')` nav item — delete this element

- [ ] **Step 4: Redirect `showView('signal')` calls in other files**

In `27-launch-brandai.js` (lines 55, 2583, 2680): replace `showView('signal')` with `showView('pulse')`.

In `28-reminders-notifications.js` (lines 391, 409, 1544): replace `showView('signal')` with `showView('pulse')`.

In `14-calendar.js` (line 3660): replace `showView('signal')` with `showView('pulse')`.

- [ ] **Step 5: Update sidebar panel selectors in `21-sidebar.js`**

At lines 181 and 198, `signalView` appears in panel visibility queries. Remove `#signalView` from these selector lists.

- [ ] **Step 6: Update CSS selectors in `01-base.css`**

For all CSS rules targeting `#signalView` (lines 3341, 3353, 3805, 3836, 3867, 35965, 37258, 37794-37851, 40605, 42367):
- Rules that are part of comma-separated selectors (e.g., `#pulseView, #signalView, ...`): remove `#signalView` from the list
- Rules that target only `#signalView`: delete the entire rule
- Rules that need to apply to Pulse now (like sidebar offset rules): already covered by `#pulseView`

- [ ] **Step 7: Commit**

```bash
git add src/js/core/11-agents.js src/html/core/04-views-batch3.html src/js/core/21-sidebar.js src/js/core/27-launch-brandai.js src/js/core/28-reminders-notifications.js src/js/core/14-calendar.js src/css/core/01-base.css
git commit -m "v28.8: Retire Focus (Signal) view — all routes redirect to Pulse"
```

---

### Task 8: Update Pulse Init + Overview to Include Focus Stats

**Files:**
- Modify: `src/js/core/25-documents-lifeai.js`

- [ ] **Step 1: Enhance `renderPulse3Overview()` to include Focus stats**

Find `renderPulse3Overview()` (~line 7431). Add stats for pending tasks, done tasks, streak, and automations count to the existing overview cards:

After the existing `Active Goals` and `Done Today` cards, add:

```javascript
// v28.8: Merged Focus stats
var _pAllItems = [];
for (var _psi = 0; _psi < pulseGoals.length; _psi++) {
  if (pulseGoals[_psi].archived || pulseGoals[_psi].completed) continue;
  _pAllItems = _pAllItems.concat(pulseGoals[_psi].items || []);
  if (pulseGoals[_psi].sections) {
    for (var _pssi = 0; _pssi < pulseGoals[_psi].sections.length; _pssi++) {
      _pAllItems = _pAllItems.concat(pulseGoals[_psi].sections[_pssi].items || []);
    }
  }
}
var _pPending = _pAllItems.filter(function(it) { return !it.completed; }).length;
var _pDone = _pAllItems.filter(function(it) { return it.completed; }).length;
var _pStreak = parseInt(localStorage.getItem('roweosStreak') || '0', 10);
```

Add these values to the stat cards HTML output in the overview section.

- [ ] **Step 2: Update `initPulse2()` to call migration + ensure Unassigned goal exists**

Find `initPulse2()`. Add at the top:

```javascript
// v28.8: Ensure migration ran and Unassigned goal exists
if (typeof migrateFocusTodosToPulseGoals === 'function') {
  try { migrateFocusTodosToPulseGoals(); } catch(e) {}
}
getUnassignedGoal();
```

- [ ] **Step 3: Commit**

```bash
git add src/js/core/25-documents-lifeai.js
git commit -m "v28.8: Enhance Pulse overview with merged Focus stats"
```

---

### Task 9: Version Bump, Build, and Deploy

**Files:**
- Modify: All 8 version locations (JS constant + 7 HTML)

- [ ] **Step 1: Bump version from v28.7 to v28.8 in all 8 locations**

Follow the standard version bump process — update `ROWEOS_VERSION` in `src/js/core/09-state.js` and all HTML display locations.

- [ ] **Step 2: Build**

```bash
bash src/build.sh
```

- [ ] **Step 3: Verify build**

Check that the build succeeds and the line count delta is reasonable (should increase by ~400-600 lines for new tab code + CSS).

- [ ] **Step 4: Test locally**

Open `RoweOS/dist/index.html` in browser. Verify:
- Pulse view shows tabs (Overview, Today, Calendar, Goals, Notes, Streaks)
- Overview tab shows existing Pulse content + new stats
- Today tab shows tasks/events for today
- Calendar tab shows mini calendar with task dots
- Goals tab shows checklist cards
- Notes tab shows textarea
- Streaks tab shows streak count + heatmap
- Focus/Signal is gone from sidebar
- Clicking any old "Focus" links redirects to Pulse
- Existing Pulse goals still render correctly
- Migration ran (check console for migration log)

- [ ] **Step 5: Deploy**

```bash
./deploy.sh
```

- [ ] **Step 6: Commit version bump**

```bash
git add -A
git commit -m "v28.8: Pulse Merge — Focus absorbed, universal task system"
```

---

## Post-Merge Cleanup (Future Session)

These items can wait for a follow-up session:
- Remove `src/html/life/05-focus.html` content (empty the file or delete it)
- Remove unused Focus functions from `15-focus.js` (keep file for calendar utils that other views may use)
- Remove `roweosTodos` / `roweos_life_todos` from Firebase sync (after confirming migration is stable for all 10 users)
- Update `CLAUDE.md` view mapping table
- Update memory files with new architecture
