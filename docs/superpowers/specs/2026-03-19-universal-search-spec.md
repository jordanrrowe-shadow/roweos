# O2: Universal Search - Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Author:** Claude + Jordan Rowe

---

## Problem Statement

RoweOS has a basic global search (Cmd+K) that only does substring matching across features and localStorage data. It cannot perform actions, understand natural language, or show rich results. Users need a macOS Spotlight-style search that uses AI to interpret queries, navigate anywhere, and execute actions directly.

## Architecture

**3-layer search engine** with **dual UI** (centered Spotlight + right side panel). AI-powered understanding is the primary layer, with navigation and actions as fallback layers. Both UIs share the same search engine. Results scoped by current brand or all brands/profiles.

**Tech Stack:** Vanilla ES5 JavaScript, existing AI chat API functions, single-file HTML app

**Critical Constraints:**
- ES5 only
- All edits in `RoweOS/dist/index.html`
- No emojis in UI -- SVG icons only
- No em-dashes in UI text

---

## Design

### Search Engine Core

**`executeSearch(query, mode, scope)`** -- central function returning structured results.

**Mode: AI (default)**
- Sends query to BrandAI/LifeAI with context about available data
- AI system prompt includes: "You are a search assistant for RoweOS. You have access to the user's brands, clients, mail, Pulse goals, automations, calendar, library, and chat history. Interpret the query and return structured results."
- AI response parsed into result cards (emails found, goals matched, etc.)
- Compact inline response for Spotlight, rich cards for side panel
- Falls back to Navigate mode if AI is unavailable or query is clearly navigational

**Mode: Navigate**
- Fuzzy matching (substring + word-boundary) across:
  - Features/views: BrandAI, Focus, Bloom, Pulse, Studio, Mail, Rhythm, Library, Automations, Identity, Clients, etc.
  - Brand names and properties
  - Client names and companies
  - Automation names
  - Library item titles
  - Conversation titles
  - Calendar event titles
  - Pulse goal names
- Results grouped by category with section headers
- Max 6 results per category, 20 total

**Mode: Actions**
- Pattern matching for direct commands:
  - `new email to {name}` -> open compose with recipient
  - `run {automation}` -> trigger automation
  - `add goal {text}` -> create Pulse goal
  - `open {feature}` -> navigate to feature
  - `new task {text}` -> add Focus task
  - `search mail {query}` -> search sent/outbox
- Each action shown as a card with the action it will perform

### Brand Scoping

- Toggle in results header: `[Current Brand: {name}]` / `[All Brands]`
- Affects AI context (which brand data is included) and Navigate filtering
- Default: current brand. Toggle persists per session via `_searchScope` variable.

### Spotlight UI (Cmd+K)

- Centered modal, 520px wide, dark background overlay
- Input: search icon + text field + ESC badge
- Mode indicator: AI / Navigate / Actions -- Tab key cycles
- Results: max 6 items, compact list format
- AI responses: inline text (truncated at ~200 chars) with "Open in panel" link
- Keyboard: arrow keys navigate, Enter executes, ESC closes
- Recent searches: shown when input is empty (stored in `roweos_recent_searches`, max 10)
- Click outside or ESC dismisses

### Side Panel UI (search bar / bell click)

- 320px right panel, slides in from right with CSS transition
- Two tabs: **Search** / **Notifications**
- Search tab:
  - Same input field + mode tabs (AI / Navigate / Actions)
  - Rich results area: full cards with progress bars, email previews, action buttons
  - AI responses rendered fully (no truncation)
  - Follow-up action links below results
- Notifications tab:
  - Sources: reminders, automation completions, sync events, mail arrivals
  - Stored in `roweos_notifications` (array, max 50, newest first)
  - Each: `{id, type, title, body, timestamp, read, actionUrl}`
  - Badge count on bell icon (unread count)
  - Mark read on click, "Mark all read" button
- Close button or ESC to dismiss
- Stays open while user works

### Top Bar Integration

Add to the existing top navigation bar (breadcrumb area):
- Search input field (right-aligned): clicking opens side panel
- Notification bell icon with unread badge: clicking opens side panel on Notifications tab
- Help `?` button (existing)

### Storage

| Key | Purpose |
|-----|---------|
| `roweos_recent_searches` | Array of last 10 queries |
| `roweos_notifications` | Array of notification objects (max 50) |
| `roweos_notifications_read` | Set of read notification IDs |

### Functions

| Function | Action |
|----------|--------|
| `initUniversalSearch()` | Sets up both UIs, keyboard handlers, top bar |
| `executeSearch(query, mode, scope)` | Core engine, returns results array |
| `searchWithAI(query, scope)` | Sends to AI, parses structured results |
| `searchNavigate(query, scope)` | Fuzzy match across all data |
| `searchActions(query)` | Pattern match commands |
| `openSpotlight()` | Shows centered modal (Cmd+K) |
| `closeSpotlight()` | Hides centered modal |
| `openSearchPanel(tab)` | Opens side panel (optional tab: "search" or "notifications") |
| `closeSearchPanel()` | Hides side panel |
| `renderSpotlightResults(results)` | Compact result list |
| `renderPanelResults(results)` | Rich result cards |
| `renderNotificationPanel()` | Notification list with badges |
| `addNotification(type, title, body, actionUrl)` | Adds to notification store |
| `markNotificationRead(id)` | Updates read state |
| Modify: `performGlobalSearch()` | Replace with `executeSearch()` |
| Modify: `openSearch()` / `closeSearch()` | Wire to `openSpotlight()` / `closeSpotlight()` |
