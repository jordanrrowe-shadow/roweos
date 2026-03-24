# Focus View Redesign - Design Spec

**Date:** 2026-03-23
**Version target:** v26.1
**Scope:** Redesign Focus (Signal) view with 3 pill sections, AI enhancements, and categorized tasks

---

## Overview

Restructure the Focus view from a single widget-grid dashboard into a 3-pill navigation layout: Dashboard, Today & Upcoming, and Tasks. Add context-aware AI briefing with inline chat, and a custom-category task management system.

The existing widget grid and customize system are preserved under the Dashboard pill. The two new pills (Today & Upcoming, Tasks) are additive -- no existing functionality is removed.

---

## Architecture

### Persistent Header

A fixed header above all pill content, visible regardless of which pill is active:

- **Greeting row:** Time-of-day greeting ("Good morning/afternoon/evening, Jordan"), current date, active brand badge
- **Stats row:** Compact stat badges showing today's counts -- Tasks, Events, Reminders (pulled from existing data sources)
- **Pill nav:** 3 pills rendered via `renderPillNav()` -- Dashboard (default), Today & Upcoming, Tasks

The header reuses `updateFocusHeader()` and `updateFocusStats()` with layout adjustments: greeting moves above stats (currently side-by-side), stats become compact horizontal badges instead of the current vertical layout, and brand badge is added to the greeting subtitle. Pill nav uses the existing `renderPillNav(containerId, items, activeId, onSelect)` component.

### Content Swap

Each pill renders into a shared content container below the header. Switching pills hides/shows the relevant content div:

- `#focusDashboardContent` -- existing widget grid (`focus-2-unified-grid`)
- `#focusTodayContent` -- new Today & Upcoming view
- `#focusTasksContent` -- new Tasks view

Only one content div is visible at a time. State stored in `localStorage['roweos_focus_active_pill']`.

---

## Pill 1: Dashboard

**No structural changes.** The existing widget grid becomes the Dashboard pill content:

- `focus-2-unified-grid` (2-column responsive grid)
- All current widgets: today-calendar, day-detail, automations, reminders, notes
- Customize mode (drag/drop, resize) unchanged
- Widget order persisted in localStorage as before

The only change is wrapping the grid in `#focusDashboardContent` and toggling visibility.

---

## Pill 2: Today & Upcoming

### AI Briefing Card

Full-width card at top with gradient background (`rgba(168,152,120,0.12)` to `rgba(168,152,120,0.04)`), gold border.

**Components:**

1. **Header:** SVG star icon + "Daily Briefing" label + generation timestamp
2. **Summary paragraph:** Task/event/reminder counts + one actionable highlight (e.g., "Strategy review at 2 PM needs prep")
3. **Insight items:** 2-4 contextual insights, each with:
   - Icon badge (16x16 rounded square with colored SVG icon):
     - Trend up (green `#4ade80`) -- positive metrics
     - Alert circle (yellow `#fbbf24`) -- staleness warnings, attention needed
     - Checkmark (cyan `#22d3ee`) -- completed automations with "view result" link
   - Title line + description line
4. **Inline chat:** Text input ("Ask about your day...") + send button. Opens mini-chat within the card for follow-up questions about priorities, automation results, etc.

**AI Generation:**

- Briefing generated once per day (or on manual refresh)
- Uses existing `getBrandSpecificRecommendations()` pattern but enhanced:
  - Pulls from: tasks (due dates, completion rates), calendar events, automation results (`roweos_task_history`), brand metrics where available
  - Time-aware: morning = planning suggestions, afternoon = progress check, evening = wrap-up
- Cached in `localStorage['roweos_focus_briefing']` with date key
- Inline chat sends context (today's tasks, events, briefing) to the active agent via `callBrandAI()` (brand mode) or `callLifeAI()` (life mode) with a briefing-specific system prompt. Chat history is ephemeral (per session, not persisted). Max context: today's tasks + events + briefing text (no full history dump).
- **Error handling:** If AI briefing generation fails (API key missing, rate limit, network error), show a "Could not generate briefing" card with a retry button. The source-grouped cards below still render normally from local data. For inline chat errors, show toast via `showToast(msg, 'error')`.

**All icons are inline SVGs** (viewBox 0 0 24 24, stroke-width 2, matching existing icon conventions). No emoji.

### Source-Grouped Cards

2-column responsive grid below the AI card. 4 cards:

1. **Calendar Events**
   - Today's events with color-coded left border (per calendar source, using existing `roweos_calendar_colors`)
   - Event name, time, duration
   - Divider line, then upcoming events (next 7 days) in muted style
   - Data source: existing calendar integration

2. **Tasks Due**
   - Today's tasks with checkbox + name + "Today" badge
   - Upcoming tasks in muted style with day label
   - Checkbox toggles completion (writes through existing task save flow)
   - Data source: `roweosTodos` (brand mode) / `roweos_life_todos` (life mode), filtered by `dueDate`

3. **Automations**
   - Status dots: green (completed), yellow (running), gray (scheduled)
   - Name + status/time
   - Completed items clickable -> `viewCompletedAutomation(taskId)`
   - Data source: `roweos_completed_automations`, `getScheduledTasks()`

4. **Reminders**
   - Active reminders with due time
   - Upcoming reminders in muted style
   - Data source: `roweos_reminders`

**Mobile:** Cards stack to single column below 768px.

---

## Pill 3: Tasks

### Category System (Existing)

The category system already exists in RoweOS. Tasks already have a `category` field, and categories are stored mode-aware:

**Existing task structure (no changes needed):**

```javascript
{
  id: 'task_abc123',
  text: 'Update Solo training docs',
  brand: 1,           // brand index
  category: 'Operations',  // already exists on tasks
  dueDate: '2026-03-23',
  completed: false,
  createdAt: 1774309228,
  notes: '',
  assignedTo: ''
}
```

**Existing category storage:**
- Brand mode: `roweos_todo_categories` (localStorage) / `window.todoCategories` (runtime)
- Life mode: `roweos_life_todo_categories`
- Structure: `[{ name: 'Marketing', color: '#a78bfa' }, ...]`
- Already synced to Firebase (existing sync paths)
- Saved via `saveTodoCategories()`, loaded on init

The Tasks pill builds on top of this existing system -- no new data model or storage keys needed for categories. The existing `taskViewMode` toggle (brand/category/both) is replaced by the dedicated Tasks pill UI.

### Layout

1. **Category filter pills:** Horizontal scrollable row of colored pills. "All" (default, gold), then one pill per category. Each pill filters the task list below. Last pill: "+ New" to create a category.

2. **Action buttons (right-aligned):**
   - "AI Categories" button with SVG sparkle icon -- scans existing tasks and suggests category groupings. User reviews/approves in a modal before applying.
   - "+ Add Task" button

3. **Category groups:** Each category renders as a collapsible section:
   - Color indicator (7px square) + category name + task count + horizontal rule
   - Tasks indented below with: checkbox, task text, brand tag (small pill), due date
   - Tasks sorted by due date within each category
   - Uncategorized tasks appear in an "Other" section at bottom

### AI Categories Feature

"AI Categories" button triggers:

1. Collects all tasks from `roweosTodos` (or `roweos_life_todos` in life mode)
2. Sends to AI with prompt: "Given these tasks across brands [list], suggest 3-5 categories that group them by function (e.g., Marketing, Operations, Finance). Return category names only."
3. Shows suggestions in a confirmation modal -- user can rename, remove, or add categories before confirming
4. On confirm: creates categories in storage, auto-assigns tasks to categories based on AI mapping
5. Button only appears when no categories exist or user manually triggers via a menu option
6. **Error handling:** If AI call fails, show `showToast('Could not generate categories', 'error')` and leave existing categories unchanged

---

## Landing Page Config Update

Update `_pageLandingConfigs.signal`:

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
}
```

### Tab Handler Update

`showFocusSection` needs to handle the new pill IDs:

- `'dashboard'` -- show `#focusDashboardContent`, activate Dashboard pill
- `'today'` -- show `#focusTodayContent`, activate Today & Upcoming pill, trigger briefing generation if stale
- `'tasks'` -- show `#focusTasksContent`, activate Tasks pill, render category view

---

## Key Functions (New)

| Function | Purpose |
|----------|---------|
| `renderFocusTodayView()` | Renders the full Today & Upcoming pill content |
| `renderFocusAIBriefing()` | Generates and renders the AI briefing card |
| `renderFocusSourceCards()` | Renders the 4 source-grouped cards |
| `sendFocusAIChat(message)` | Handles inline chat within the briefing card |
| `renderFocusTasksView()` | Renders the full Tasks pill content |
| `renderFocusCategoryList()` | Renders category groups with tasks |
| -- | -- |
| *Existing (reused):* | |
| `saveTodoCategories()` | Persists categories (existing) |
| `window.todoCategories` | Runtime category array (existing) |
| `generateAICategories()` | AI-powered category suggestion flow |
| `showFocusPill(pillId)` | Switches between pills, saves state |

---

## CSS Additions

- `#focusTodayContent`, `#focusTasksContent` -- new content containers (hidden by default)
- `.focus-briefing-card` -- gradient background AI card
- `.focus-insight-item` -- insight row with icon badge
- `.focus-inline-chat` -- chat input within briefing card
- `.focus-source-grid` -- 2-column grid for source cards
- `.focus-source-card` -- individual source card
- `.focus-category-pills` -- horizontal scrollable category filter row
- `.focus-category-group` -- collapsible category section
- `.focus-task-row` -- task item with checkbox, brand tag, date
- `.focus-ai-categories-btn` -- sparkle button style

All follow existing design system: dark theme, glass morphism, `--brand-accent` colors, 10px border-radius on cards.

---

## Data Flow

```
User opens Focus
  -> showView('signal')
  -> renderPillNav() with 3 pills
  -> showFocusPill(savedPill || 'dashboard')
    -> Dashboard: existing renderFocusView() (widget grid)
    -> Today: renderFocusTodayView()
      -> renderFocusAIBriefing() [cached, 1x/day]
      -> renderFocusSourceCards() [live data]
    -> Tasks: renderFocusTasksView()
      -> renderFocusCategoryList() [from localStorage + sync]
```

---

## Brand Scoping

Today & Upcoming shows data for the **currently selected brand** (consistent with existing Focus behavior). Tasks pill also shows current-brand tasks by default, matching existing `roweosTodos` brand-scoped behavior. In life mode, uses `roweos_life_todos` and `roweos_life_todo_categories`.

---

## Migration Notes

- No breaking changes to existing Focus data
- Categories already exist -- no new category storage needed
- New localStorage keys: `roweos_focus_active_pill`, `roweos_focus_briefing` (only 2 new keys)
- `roweos_focus_briefing` stores cached daily briefing, does NOT need Firebase sync (ephemeral cache)
- If saved `roweos_focus_active_pill` value is `'upcoming'` (legacy), fall back to `'today'`
- Existing `showFocusSection` handler must be updated (not replaced) to handle new pill IDs
- The existing `setFocus2DayFilter()` integration for today/upcoming toggles is replaced by the new Today & Upcoming pill -- those filter buttons in the day-detail widget remain for Dashboard pill only
- `renderFocusView()` continues to work as-is for Dashboard pill content
- Tasks pill replaces the existing `taskViewMode` toggle (brand/category/both) with a dedicated category-grouped UI, but uses the same underlying data and `saveTodoCategories()` flow
