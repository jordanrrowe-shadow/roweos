# Pulse Merge + Scribe + Studio Consolidation - Design Spec

> **Three changes in one spec:** These are architecturally intertwined (nav restructure, task system rewrite, new view).

**Goal:** Restructure RoweOS's core views - merge Focus into Pulse as the universal task/goal system, add Scribe as a new notebook/knowledge workspace, and absorb Media Lab into Studio.

---

## Updated Sidebar Navigation

```
CORE
  Pulse          (merged Focus+Pulse — data-view="pulse")
  Rhythm

CREATE
  Studio         (absorbs Media Lab — data-view="studio")
  Scribe         (NEW — data-view="scribe")
  Automations
  Bloom

ORCHESTRATION
  Folio
  Research
  Library
  Mail

INTELLIGENCE
  Identity
  History
  Guardrails

GOVERNANCE
  People
  Analytics
  Inventory
  Sync
  System
  Admin
```

**Removed from nav:** Focus (absorbed into Pulse), Media Lab (absorbed into Studio)
**Added to nav:** Scribe (new view in CREATE)

---

## Change 1: Pulse Merge (Focus + Pulse → Unified Pulse)

### Vision
Pulse becomes the single source of truth for ALL tasks in RoweOS. Every task lives inside a Pulse Goal. The Focus calendar, today view, and daily aggregation become tabs/widgets within Pulse. Focus as a separate view is retired.

### Pulse Goal as Universal Task Container

**Data Model (extended from current Pulse Goal):**
```
{
  id: 'goal_' + timestamp + '_' + random,
  name: string,                              // Goal title
  description: string,
  completed: boolean,
  archived: boolean,
  color: string,                             // Category color (from Focus categories)
  icon: string,                              // Category icon (from Focus categories)
  source: 'lifeai' | 'brandai',
  brandIdx: number,                          // Which brand this goal belongs to
  _modifiedAt: timestamp,
  isDefault: boolean,                        // true for the "Unassigned" goal (one per mode)
  items: [
    {
      id: 'item_' + timestamp,
      text: string,
      completed: boolean,
      completedAt: ISO string | null,
      date: 'YYYY-MM-DD' | null,            // NEW: scheduled date (from Focus todos)
      assignedTo: string | null,             // Person ID (from Focus todos)
      notes: string | null,                  // Task notes
      priority: 'low' | 'medium' | 'high' | null,  // NEW
      createdAt: ISO string,
      _modifiedAt: timestamp
    }
  ],
  sections: [
    {
      id: string,
      name: string,
      collapsed: boolean,
      items: [ /* same as above */ ]
    }
  ]
}
```

**Key additions over current Pulse Goal model:**
- `date` on items (from Focus todos — enables calendar/today filtering)
- `assignedTo` on items (from Focus todos — People integration)
- `notes` on items (from Focus todos)
- `priority` on items (new)
- `color` and `icon` on goals (from Focus categories — visual identity)
- `isDefault` flag for the Unassigned goal
- `brandIdx` for brand scoping

### The "Unassigned" Default Goal
- Auto-created per mode (brand/life) if it doesn't exist
- `isDefault: true` — cannot be deleted or archived
- Name: "Unassigned" (user can rename)
- All tasks without a specified goal land here
- Appears last in the goal list (or first, depending on preference)

### Unified Pulse View Tabs

```
[Overview]  [Today]  [Calendar]  [Goals]  [Notes]  [Streaks]
```

**Overview tab** (existing Pulse overview, enhanced):
- Overall progress % ring (existing)
- Active goals count, today's completions (existing)
- Quick stats: To-Do count, Done count, Streak (from Focus stats)
- Upcoming automations preview (from Focus automations widget)
- Recent reminders (from Focus reminders widget)

**Today tab** (from Focus "Day Detail"):
- Aggregates ALL tasks with `date === today` across ALL goals
- Calendar events for today (from Rhythm/calendar)
- Due automations for today
- Due reminders for today
- Grouped by goal, or flat list with goal badge
- Sort: Date, Title, Brand, Goal

**Calendar tab** (from Focus mini-calendar):
- Mini calendar with task dots per day
- Click day → shows day detail (same as Today but for that date)
- Horizontal event cards with color-coded borders (from Focus)

**Goals tab** (existing Pulse checklists, enhanced):
- Expandable goal cards with progress bars and %
- Sections within goals
- Drag-and-drop task reordering
- Category color/icon on goal cards
- Filter: Active, Completed, Archived, All

**Notes tab** (from Focus daily notes):
- Daily notes saved per date
- Save to Journal integration (existing)
- Date picker to browse past notes

**Streaks tab** (from Focus stats):
- Current streak display
- Streak history/calendar heatmap
- Completion trends

### Migration: Focus Todos → Pulse Goal Items

On first load after upgrade:
1. Read `roweosTodos` and `roweos_life_todos`
2. Group by `category` field
3. For each category: create a Pulse Goal with `name = category.name`, `color = category.color`, `icon = category.icon`
4. Move all tasks in that category to the new goal's `items[]`, preserving `date`, `completedAt`, `assignedTo`, `notes`
5. Tasks with no category → "Unassigned" goal
6. Set migration flag `roweos_focus_pulse_migrated = true`
7. Keep old localStorage keys for 30 days as backup, then clean up

### All Task Creation Points (must be rewritten)

Every place that currently creates a Focus todo must instead create a Pulse Goal item:

| Current Function | File | New Behavior |
|---|---|---|
| `addTaskToCategory(cat, idx)` | 15-focus.js:3311 | → `addItemToPulseGoal(goalId, itemData)` |
| `addTaskForPerson(personId)` | 29-analytics-commerce.js:7508 | → `addItemToPulseGoal(goalId, {assignedTo: personId})` |
| Automation "create task" | 30-automations-init.js:3521 | → Already uses `createPulseGoalFromAutomation()` (keep) |
| Reminder "Add to Pulse" | 28-reminders-notifications.js:397 | → Already creates Pulse goal (keep) |
| Calendar → Goal | 14-calendar.js:3889 | → Already creates Pulse goal items (keep) |
| Library Note → Goal | 12-library.js:3227 | → Already creates Pulse goal (keep) |
| Journal inline task | 19-journal.js | → `addItemToPulseGoal(goalId, itemData)` |

### New Core Functions

```
addItemToPulseGoal(goalId, itemData)     // Add task to specific goal
removeItemFromPulseGoal(goalId, itemId)  // Remove task
moveItemBetweenGoals(fromGoalId, toGoalId, itemId)  // Move task
getUnassignedGoal()                      // Get or create the default "Unassigned" goal
getAllTasksForDate(dateStr)              // Cross-goal query for Today/Calendar
getAllTasksForPerson(personId)           // Cross-goal query for People view
getTaskCountByGoal()                    // Stats aggregation
```

### View Retirement: Focus (Signal)

- Remove `data-view="signal"` from `allViews` array
- Remove Focus from sidebar nav HTML (both grouped and expanded)
- Remove Focus landing page config from `_pageLandingConfigs`
- Keep `15-focus.js` temporarily but deprecate all render functions
- Redirect any `showView('signal')` calls to `showView('pulse')`
- Remove `src/html/life/05-focus.html` (or empty it)

### Firebase Sync Changes

- `roweos_pulse_goals` remains the canonical localStorage key
- Stop syncing `roweosTodos` / `roweos_life_todos` (deprecated after migration)
- Pulse goals sync to `pulse/main` in Firestore (existing path)
- `loadFromFirebaseV2` and `syncToFirebaseV2` updated to skip Focus todo keys

---

## Change 2: Scribe (New Notebook + NotebookLM Feature)

### Vision
Scribe is a new top-level view that combines two modes:
1. **Notebook mode** — Free-form writing workspace (create blank notebooks, write notes, organize thoughts)
2. **Knowledge mode** — NotebookLM-style AI synthesis (upload/link sources, ask questions grounded in those sources, generate summaries)

Both modes live in the same view. A notebook can start blank and evolve into a knowledge base by adding sources.

### Data Model

**Notebook:**
```
{
  id: 'nb_' + timestamp + '_' + random,
  title: string,
  content: string,                           // Markdown/rich text content
  sources: [                                 // Linked knowledge sources
    {
      id: 'src_' + timestamp,
      type: 'file' | 'url' | 'person' | 'conversation' | 'library' | 'text',
      name: string,                          // Display name
      ref: string,                           // Reference ID (libraryId, personId, URL, etc.)
      content: string | null,                // Cached/extracted text content for AI grounding
      addedAt: ISO string
    }
  ],
  linkedPeople: [                            // @-mentioned or panel-linked people
    {
      id: string,                            // Person ID from People view
      name: string,
      role: string | null,                   // client, team member, direct report
      linkedAt: ISO string
    }
  ],
  linkedLibraryItems: [                      // Panel-linked Library files
    {
      id: string,                            // Library item ID
      name: string,
      linkedAt: ISO string
    }
  ],
  tags: [string],                            // User tags
  brandIdx: number | null,                   // Brand scope (null = cross-brand)
  source: 'brandai' | 'lifeai',
  createdAt: ISO string,
  updatedAt: ISO string,
  _modifiedAt: timestamp,
  archived: boolean
}
```

**localStorage key:** `roweos_scribe_notebooks`
**Firestore path:** `scribe/notebooks`

### View Layout

```
+------------------+-------------------------------------------+------------------+
|  Notebook List   |            Editor / Content               |  Metadata Panel  |
|  (left sidebar)  |                                           |  (right sidebar) |
|                  |  [Notebook mode]                          |                  |
|  + New Notebook  |  Rich text editor with @-mention support  |  Sources         |
|  Search...       |  Markdown rendering                       |  People          |
|  ─────────────── |                                           |  Library Links   |
|  My Notebooks    |  [Knowledge mode]                         |  Tags            |
|  > Project Alpha |  Chat with sources (grounded Q&A)         |  Created/Updated |
|  > Meeting Notes |  AI summary panel                         |                  |
|  > Research Q4   |  Source excerpts                           |                  |
|                  |                                           |                  |
+------------------+-------------------------------------------+------------------+
```

**Three-column layout:**
- **Left:** Notebook list with search, filter, new button
- **Center:** Active notebook content (editor or knowledge chat)
- **Right:** Metadata panel (sources, linked people, linked library items, tags)

### Features

**Notebook Mode (Writing):**
- Create blank notebook with title
- Rich text editing (Markdown with live preview, similar to Journal)
- @-mention inline linking: type `@` to search People, Library items, other notebooks
- @-mentions render as clickable chips that navigate to the referenced entity
- Auto-save on edit (debounced 1s)
- Export to PDF, DOCX (reuse existing Document export from Studio)

**Knowledge Mode (AI Synthesis):**
- Toggle "Knowledge" mode on any notebook (button in toolbar)
- Add sources via metadata panel: upload files, paste URLs, link Library items, link conversations from History, paste text
- Source content is extracted/cached in the `sources[].content` field
- Chat interface at bottom of editor: ask questions grounded in notebook content + sources
- AI uses notebook content + all source content as context (system prompt injection)
- "Synthesize" button: AI generates a structured summary of all sources
- "Key Insights" button: AI extracts key points, contradictions, and themes
- Source attribution: AI responses cite which source each claim comes from

**People Integration:**
- @-mention `@Jordan` in notebook text → creates inline link + adds to `linkedPeople[]`
- Metadata panel shows all linked people with role badges (client, team, etc.)
- Click person in panel → navigates to People view for that person
- People view shows "Notebooks" section listing all notebooks that reference this person

**Library Integration:**
- @-mention `@filename` or drag-and-drop from Library
- Metadata panel shows linked Library items
- Can import Library file content as a source for Knowledge mode
- Notebook can be saved TO Library as a document

### Key Functions

```
// Notebook CRUD
createNotebook(title)
saveNotebook(notebook)
deleteNotebook(notebookId)
archiveNotebook(notebookId)
loadNotebooks()

// Editor
renderScribeEditor(notebook)
handleScribeInput(e)                    // Auto-save with debounce
insertAtMention(type, ref)              // Insert @-mention at cursor

// @-mention system
showAtMentionDropdown(query)            // Search People + Library + Notebooks
selectAtMention(item)                   // Insert selected mention
parseAtMentions(text)                   // Extract all @-mentions from content

// Knowledge mode
toggleKnowledgeMode(notebookId)
addSource(notebookId, sourceData)
removeSource(notebookId, sourceId)
extractSourceContent(source)            // URL fetch, file parse, etc.
askKnowledgeQuestion(notebookId, question)  // Grounded Q&A
synthesizeNotebook(notebookId)          // AI summary generation
getSourceContext(notebook)              // Build system prompt from all sources

// Metadata panel
renderMetadataPanel(notebook)
linkPerson(notebookId, personId)
unlinkPerson(notebookId, personId)
linkLibraryItem(notebookId, itemId)
unlinkLibraryItem(notebookId, itemId)

// Cross-view queries
getNotebooksForPerson(personId)         // Used by People view
getNotebooksForLibraryItem(itemId)      // Used by Library view
```

### Files

- **Create:** `src/js/core/33-scribe.js` — All Scribe logic (~800-1200 lines)
- **Create:** `src/html/shared/30-scribe.html` — Scribe view HTML
- **Modify:** `src/css/core/01-base.css` — Scribe styles (three-column layout, editor, @-mentions)
- **Modify:** `src/js/core/21-sidebar.js` — Add Scribe to nav, landing page config
- **Modify:** `src/js/core/08-foundation.js` — Add `scribeView` to `allViews`
- **Modify:** `src/js/core/29-analytics-commerce.js` — Add Scribe to People view "Notebooks" section
- **Modify:** `src/js/core/12-library.js` — Add "Link to Scribe" option

### View Registration (4 touch points per CLAUDE.md)

1. `allViews` array — add `'scribeView'`
2. CSS groups — add `#scribeView` to all 8 CSS sidebar selectors
3. Sidebar nav HTML — add Scribe item in CREATE section
4. `showView()` handler — add `'scribe'` case
5. `_pageLandingConfigs` — add Scribe landing page config

---

## Change 3: Studio Absorbs Media Lab

### Current State
- **Studio** (`data-view="studio"`) — Content generation with streaming, 50+ operations, agent panels
- **Media Lab** (`data-view="social"`) — Social media command center with Engage, Post, Analytics, Blog, Image/Video Lab tabs

### Merge Strategy

Studio gains new tabs for Media Lab's capabilities:

```
Studio Tabs (post-merge):
[Generate]  [Publish]  [Engage]  [Media]  [Analytics]  [Blog]
```

| New Tab | From | What It Does |
|---|---|---|
| Generate | Studio (existing) | AI content generation, operations, streaming editor |
| Publish | Media Lab "Post" | Compose → review → multi-platform publish, outbox, drafts |
| Engage | Media Lab "Engage" | Keyword search, feed monitoring, reply management |
| Media | Media Lab "Media" | Image Lab (DALL-E) + Video Lab (Veo) |
| Analytics | Media Lab "Analytics" | Post performance, audience insights |
| Blog | Media Lab "Blog" | Blog writing, SEO, website analyzer |

### What Gets Retired
- `data-view="social"` / `socialView` — removed from `allViews`
- Media Lab removed from sidebar nav
- `src/html/brand/23-social-hub.html` — content moved into Studio HTML or kept as include
- Social settings remain accessible within Studio's Publish tab

### What Stays the Same
- ALL social JS logic in `18-social.js` stays — just called from Studio context instead of Media Lab
- OAuth flows, platform connectors, token management — unchanged
- `getSocialKeyScope()`, `postToSocial()`, etc. — unchanged
- Activity log becomes a Studio sub-panel

### Files
- **Modify:** `src/html/brand/02-studio.html` — Add tab bar, include Media Lab panel HTML
- **Modify:** `src/js/core/13-studio.js` — Add tab switching logic, integrate social renders
- **Modify:** `src/js/core/18-social.js` — Update view references from `socialView` to `studioView`
- **Modify:** `src/js/core/21-sidebar.js` — Remove Media Lab nav item
- **Modify:** `src/js/core/08-foundation.js` — Remove `socialView` from `allViews`
- **Modify:** Multiple files — Redirect `showView('social')` calls to `showView('studio')`

---

## Implementation Order

1. **Pulse Merge** (highest risk, most architectural) — 2-3 sessions
   - Data migration (Focus todos → Pulse goals)
   - Unified Pulse view with all tabs
   - Rewrite all task creation call sites
   - Retire Focus view
   
2. **Studio absorbs Media Lab** (medium risk, mostly UI reorganization) — 1-2 sessions
   - Add tab bar to Studio
   - Move Media Lab panel HTML
   - Update JS view references
   - Retire Media Lab nav item

3. **Scribe** (greenfield, no existing code to break) — 2-3 sessions
   - New view registration
   - Notebook CRUD + editor
   - @-mention system
   - Knowledge mode + AI synthesis
   - People/Library integration

---

## Open Questions for Implementation

1. **Scribe editor:** Use existing Markdown rendering (Marked.js already loaded) or add a richer editor? Recommendation: Start with Markdown textarea + live preview (same pattern as Journal), evolve later.

2. **Knowledge mode AI provider:** Use the user's selected brand AI model, or always use a specific model (e.g., Opus for synthesis quality)? Recommendation: Use brand's configured model with a "Use Opus for best results" suggestion.

3. **Notebook size limits:** Large notebooks with many sources could hit context window limits. Recommendation: Truncate source content to 4K chars each, prioritize most recent sources. Show warning when approaching limits.

4. **People view backlinks:** Should the People view show a "Referenced in Notebooks" section immediately, or defer? Recommendation: Include in initial build — it's a simple cross-query.
