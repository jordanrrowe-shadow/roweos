# Full Customization Mode - Design Spec

**Date:** 2026-03-24
**Version target:** v26.3
**Scope:** Onboarding workspace style choice, sidebar customization (reorder, rename groups), pill reordering, premium visibility toggle
**Depends on:** v26.2 (unified pill nav, ? dropdown, selector style)

---

## Overview

Add a "Customized" workspace mode to RoweOS alongside Simplified (grouped) and Advanced (expanded). Customized mode lets users reorder sidebar items, rename sidebar groups, and reorder pills within each section. Non-premium users can toggle visibility of premium features in their sidebar. The workspace style choice is added to onboarding after brand/profile setup.

---

## 1. Onboarding: Workspace Style Step

### Placement

After the brand/profile name step (step 2 in current flow), before model selection. New step: "Choose your workspace style."

### Three Options

**Simplified** -- The grouped sidebar with 6 collapsible groups. Best for focused users who want a clean interface. Sets `roweos_sidebar_mode = 'grouped'`.

**Advanced** -- The expanded sidebar with all 20 items and original section headers. Best for power users who want everything visible. Sets `roweos_sidebar_mode = 'expanded'`.

**Customized** -- Starts as a copy of the Advanced sidebar but fully editable. Rename groups, reorder items, hide what you don't need. Sets `roweos_sidebar_mode = 'customized'`.

### UI

Three cards in a horizontal row (like the existing Business/Personal mode selection). Each card has:
- An icon (simplified = stack/grid, advanced = list, customized = sliders/edit)
- Title
- 1-line description
- Click to select, gold border on selected

### Data

- `localStorage['roweos_sidebar_mode']`: Now accepts 3 values: `'grouped'`, `'expanded'`, `'customized'`
- `localStorage['roweos_custom_sidebar']`: JSON object storing the custom layout (only created when 'customized' is selected)

---

## 2. Customized Sidebar

### Data Model

When a user first enters Customized mode, copy the Expanded sidebar structure into a JSON object:

```javascript
// localStorage['roweos_custom_sidebar']
// Matches the actual #sidebarNavExpanded HTML structure exactly
{
  "standalone": ["agent"],  // Top-level items with no group header
  "groups": [
    {
      "id": "core",
      "label": "Core",
      "items": ["signal", "pulse", "studio", "folio"]
    },
    {
      "id": "orchestration",
      "label": "Orchestration",
      "items": ["rhythm", "library", "automations", "mail"]
    },
    {
      "id": "intelligence",
      "label": "Intelligence",
      "items": ["memory", "tuning", "guardrails"]
    },
    {
      "id": "governance",
      "label": "Governance",
      "items": ["clients", "commerce", "inventory", "sync", "settings"]
    },
    {
      "id": "premium",
      "label": "Premium",
      "items": ["bloom", "social"]
    }
  ]
}
```

Note: `agent` (Chat) sits standalone at the top with no group header. The `guardrails` viewId maps to the Guardrails view (redirected from `brandIntel` internally). Total: 19 visible items across 5 groups + 1 standalone. Admin (`admin`) is a hidden item in Governance, conditionally shown for admin users via `isAdmin()` -- not included in the default custom layout but added dynamically if the user is an admin.

This is the default starting layout (matching Expanded sidebar). Users modify this structure through the two customization interfaces.

### Rendering

When `roweos_sidebar_mode === 'customized'`:
- Read `roweos_custom_sidebar` from localStorage
- Generate sidebar HTML dynamically from the JSON (instead of using the hardcoded `#sidebarNav` or `#sidebarNavExpanded`)
- Render into a third nav element: `#sidebarNavCustom`
- Each group renders as a section with the custom label and the items in the specified order
- Items use the same SVG icons as the Expanded sidebar (lookup by viewId)

### applySidebarMode Update

Extend `applySidebarMode()` to handle the third mode:
- `'grouped'`: Show `#sidebarNav`, hide others
- `'expanded'`: Show `#sidebarNavExpanded`, hide others
- `'customized'`: Show `#sidebarNavCustom`, hide others. Call `renderCustomSidebar()` to populate from JSON.

---

## 3. Inline Sidebar Customization

### Entry Point

A "Customize" button in the sidebar footer (only visible in Customized mode). Clicking it toggles customize mode.

### Customize Mode Behavior

When active:
- `body.sidebar-customize-mode` class added
- Drag handles appear on each sidebar item (6-dot grip icon, same as Focus widget handles)
- Group headers become editable (click to type a new name)
- A "+" button appears at the bottom to add a new group
- A small "x" appears on each item (remove from sidebar -- item goes to an "Available Items" pool at the bottom)
- A "Done" button replaces the "Customize" button

### Drag and Drop

- HTML5 native drag-and-drop (same pattern as Focus widget grid)
- Items can be dragged within a group (reorder) or between groups (move)
- Drop zones highlighted with a subtle gold line indicator
- On drop: update `roweos_custom_sidebar` JSON and re-render

### Group Editing

- Click group header text to make it editable (contentEditable or replace with input)
- Press Enter or blur to save
- Empty groups can be deleted (items go to "Available Items" pool)

### Available Items Pool

When an item is removed, it appears in an "Available Items" section at the bottom of the sidebar (collapsed by default, expandable). Items here can be dragged back into any group.

### Saving

Every change immediately writes to `localStorage['roweos_custom_sidebar']` and triggers `writeDB('profile/main', { customSidebar: data })` for sync.

The read side: `loadFromFirebaseV2()` / `reconcileOnStartup()` must also pull `customSidebar` from Firestore back into `localStorage['roweos_custom_sidebar']`. Add to the existing profile pull path alongside other profile data.

`renderCustomSidebar()` caches the last-rendered JSON hash to avoid expensive re-renders when `applySidebarMode()` is called repeatedly. Only re-renders if the data has changed.

---

## 4. Settings Panel: Sidebar Layout

### Location

Settings > Preferences, new section: "Sidebar Layout" (only visible when `roweos_sidebar_mode === 'customized'`).

### Content

- Visual representation of current sidebar layout (groups with items listed)
- Drag-and-drop reordering (same as inline mode but in a wider settings view)
- Click group names to rename
- "Add Group" button
- "Reset to Default" button -- resets `roweos_custom_sidebar` to the default Expanded structure
- "Show Premium Features" toggle (see Section 6)

### Real-time Preview

Changes in the settings panel immediately update the actual sidebar (live preview).

---

## 5. Pill Reordering

### Entry Point

The ? dropdown for each section (built in v26.2) gets a new item: "Reorder tabs" -- appears after "Open to". Visible in both Expanded and Customized sidebar modes (any user who sees landing pages can reorder pills).

### Behavior

Clicking "Reorder tabs":
1. Closes the dropdown
2. Adds `pill-reorder-mode` class to the pill nav container
3. Pill items become draggable (drag handles appear, or items themselves become draggable)
4. Subtle reorder indicator (gold dashed border around the pill nav area)
5. A small "Done" button appears at the end of the pill row

### Drag and Drop

- HTML5 native drag on `.pill-nav-item` elements
- Drag to reorder within the row
- On drop: save the new order

### Storage

Per-section pill order stored in `roweos_section_prefs`:

```javascript
// Extends the existing per-section prefs
{
  "studio": { "skipLanding": true, "defaultPill": "marketing", "pillOrder": ["all", "marketing", "strategy", "operations", "documents"] },
  "signal": { "skipLanding": false, "defaultPill": "today", "pillOrder": ["today", "dashboard", "tasks"] }
}
```

When `pillOrder` is set, `renderPillNav` reads it and reorders the items array before rendering. If a pill exists in the items array but not in `pillOrder`, it's appended at the end (handles new pills added in future versions).

### renderPillNav Integration

Before rendering, if `getSectionPrefs(containerId)` returns a `pillOrder`, sort the items array to match:

```javascript
// In renderPillNav, after var opts = options || {};
var sectionPrefs = getSectionPrefs(containerId);
if (sectionPrefs && sectionPrefs.pillOrder) {
  items = reorderPillItems(items, sectionPrefs.pillOrder);
}
```

To map containerId to viewId, maintain a lookup: `window._pillNavViewMap`. When `renderPillNav` is called, if `options.viewId` is provided, store it: `window._pillNavViewMap[containerId] = options.viewId`. All existing `renderPillNav` callers should add `viewId` to their options. The mapping:

| containerId | viewId |
|---|---|
| studioPillNav | studio |
| socialHubPillNav | social |
| autoLabPillNav | automations |
| mailPillNav | mail |
| guardrailsPillNav | guardrails |
| systemPillNav | settings |
| focusPillNavContainer | signal |
| peoplePillNav | clients |
| analyticsPillNav | commerce |
| identityPillNav | memory |

---

## 6. Premium Feature Visibility Toggle

### Behavior

Non-premium users (`getUserTier()` returns `'free'` or `'basic'`) see a toggle in the sidebar settings:

**"Show premium features"** -- default: ON

When OFF: sidebar items that require premium access (`hasFeatureAccess()` returns false) are hidden from the sidebar entirely. The items are not removed from the data model -- just not rendered.

When ON: all items visible, but accessing gated views still shows the upgrade prompt (existing behavior via `checkViewAccess()`).

### Storage

`localStorage['roweos_show_premium']`: `'true'` (default) or `'false'`

### Premium-Gated Views

The existing `hasFeatureAccess(feature)` already defines which features are tier-gated:
- `sync`, `export` -- basic+
- `brandConfig`, `automations`, `social`, `focus`, `analytics`, `identity` -- founder+
- `whiteLabel`, `multiUser`, `privateOnboarding` -- premium

The sidebar rendering (for all 3 modes) checks: if `roweos_show_premium === 'false'` AND `hasFeatureAccess(viewFeature) === false`, skip rendering that item.

---

## 7. CSS Additions

```css
/* Sidebar customize mode */
body.sidebar-customize-mode .sidebar-drag-handle { ... }
body.sidebar-customize-mode .sidebar-item-remove { ... }
body.sidebar-customize-mode .sidebar-group-header { cursor: text; }
.sidebar-drop-indicator { ... }
.sidebar-available-pool { ... }

/* Pill reorder mode */
.pill-nav.pill-reorder-mode { ... }
.pill-nav.pill-reorder-mode .pill-nav-item { cursor: grab; }
.pill-reorder-done-btn { ... }

/* Settings sidebar layout panel */
.settings-sidebar-layout { ... }
.settings-sidebar-group { ... }
.settings-sidebar-item { ... }
```

---

## Key Functions (New)

| Function | Purpose |
|----------|---------|
| `initCustomSidebar()` | Creates default custom sidebar JSON from Expanded layout |
| `renderCustomSidebar()` | Renders sidebar from JSON data |
| `saveCustomSidebar()` | Persists to localStorage + Firestore |
| `toggleSidebarCustomize()` | Enters/exits inline customize mode |
| `handleSidebarDrop(e)` | Drag-and-drop handler for sidebar items |
| `renameSidebarGroup(groupId, newLabel)` | Renames a group |
| `addSidebarGroup()` | Creates new empty group |
| `removeSidebarItem(viewId)` | Moves item to available pool |
| `restoreSidebarItem(viewId, groupId)` | Moves item from pool to group |
| `resetSidebarToDefault()` | Resets custom layout to Expanded default |
| `enablePillReorder(containerId)` | Enters pill reorder mode |
| `handlePillDrop(e, containerId)` | Saves new pill order |
| `reorderPillItems(items, pillOrder)` | Sorts items array by saved order |
| `renderSettingsSidebarLayout()` | Renders layout editor in Settings |
| `renderOnboardingStyleStep()` | Renders the workspace style selection |

---

## Data Flow

```
Onboarding: User selects "Customized"
  -> roweos_sidebar_mode = 'customized'
  -> initCustomSidebar() creates default JSON from Expanded layout
  -> applySidebarMode() renders custom sidebar

User clicks "Customize" in sidebar footer
  -> toggleSidebarCustomize() adds body class
  -> Drag handles + rename + remove UI appears
  -> User drags items, renames groups
  -> Each change -> saveCustomSidebar() -> re-render

User clicks "Reorder tabs" in ? dropdown
  -> enablePillReorder(containerId) adds reorder class
  -> Pills become draggable
  -> User reorders -> handlePillDrop saves to roweos_section_prefs
  -> renderPillNav reads pillOrder on next render

Settings > Preferences > Sidebar Layout
  -> renderSettingsSidebarLayout() shows layout editor
  -> Changes preview live in actual sidebar
  -> "Show Premium Features" toggle -> roweos_show_premium
```

---

## Migration Notes

- `roweos_sidebar_mode` now accepts 3 values: `'grouped'`, `'expanded'`, `'customized'`. Existing users with `'grouped'` or `'expanded'` are unaffected.
- `roweos_custom_sidebar` is a new localStorage key. Created on first entry to Customized mode.
- `roweos_custom_sidebar` must be synced to Firestore (add to profile sync paths)
- `roweos_show_premium` is a new localStorage key. Default `'true'`. Does NOT need Firestore sync (local UI preference).
- `roweos_section_prefs` extended with `pillOrder` array -- backward compatible (existing prefs without `pillOrder` work as before).
- Third sidebar nav element `#sidebarNavCustom` added to HTML. Must be included in all sidebar state CSS selectors (`html.sidebar-pinned`, `html.sidebar-hover-expanded`, `html.sidebar-pinned-collapsed`).
- `renderPillNav` extended to check for `pillOrder` in section prefs -- backward compatible.
- All new code must be ES5, tagged with `// v26.3:` comments.
- Onboarding step must work for BOTH new users and existing users who open Settings > Preferences and switch to Customized mode.
- **Mobile**: Sidebar drag-and-drop and pill reorder are desktop-only features. HTML5 drag-and-drop does not work on iOS Safari without polyfills. On mobile, the Settings > Preferences panel is the primary way to customize (with move-up/move-down buttons instead of drag). The inline sidebar customize button is hidden on mobile (`@media (max-width: 768px) { .sidebar-customize-btn { display: none; } }`).
- **Sidebar icon map**: `renderCustomSidebar()` needs a lookup map from viewId to icon (SVG or unicode character). The expanded sidebar uses a mix of unicode characters and inline SVGs. Define a `SIDEBAR_ICONS` constant keyed by viewId that returns the appropriate icon markup for each view.
- `roweos_section_prefs` is a local-only preference (not synced to Firestore). Adding `pillOrder` to it has no sync implications.
