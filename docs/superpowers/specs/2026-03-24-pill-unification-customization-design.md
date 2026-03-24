# Pill Style Unification + Per-Section Preferences + Logos - Design Spec

**Date:** 2026-03-24
**Version target:** v26.2
**Scope:** Unify pill/squircle nav styling, add per-section preferences via ? dropdown, dark/light logo upload, fix ? button consistency

---

## Overview

Unify all section navigation into a single `renderPillNav` system with two visual styles (pills or squircles) as a global user preference. Replace Studio's separate `.studio-v2-tab` system. Add per-section preferences (skip landing page, default pill) via a dropdown menu on the ? button. Add dark/light mode logo upload to Settings > Appearance.

---

## 1. Pill/Squircle Global Preference

### Two Visual Styles

**Pills (current default):**
- Rounded capsule shape (`border-radius: 20px`)
- 1px border on all items (`border: 1px solid var(--border-color)`)
- Active: subtle background (`var(--bg-tertiary)`) + accent border
- Inactive: transparent background, visible border, muted text

**Squircles (Studio style):**
- Rounded rectangle shape (`border-radius: var(--radius-md)`, ~8px)
- No border on inactive items (fully transparent, text only)
- Active: solid fill with the view's accent color, contrast-adjusted text (white on dark colors, black/dark on light colors)
- Inactive: no background, no border, `var(--text-muted)` text color
- On hover (inactive): subtle `var(--bg-secondary)` background

### Accent Color for Active Fill

The active squircle fills with the contextual accent color:
- **Studio agents**: Each agent has its own color from `AGENT_COLORS` (strategy = `#a78bfa`, marketing = `#f472b6`, etc.). The active tab fills with that agent's color.
- **All other views**: Uses `var(--brand-accent)` (the user's selected brand color, default `#a89878` gold).
- **Life mode**: Uses `var(--life-accent)`.

### Text Contrast

When squircle is active and filled with color, text color is determined by luminance:
- Calculate relative luminance of the fill color
- If luminance > 0.5: use dark text (`#1a1a1a`)
- If luminance <= 0.5: use white text (`#ffffff`)

Add a helper function `getContrastTextColor(hexColor)` that returns the appropriate text color.

### Light Mode Behavior

In light mode (`html.light-mode.selector-squircles`), squircle active fills use the same accent colors. Most brand/agent colors are dark enough to show white text on light backgrounds. No color adjustment needed -- the contrast text logic handles both modes.

### Transition

When toggling between pills and squircles, the change is instant (no animation). CSS transition on `border-radius` and `background` is acceptable but not required.

### Storage

- Key: `localStorage['roweos_selector_style']`
- Values: `'pills'` (default) or `'squircles'`
- Applied via a CSS class on `<html>`: `html.selector-squircles`
- Shape/border changes are CSS-only. Per-item color fills require JS in `renderPillNav` and `updatePillNavActive` (see Section 2).

### Settings UI

In Settings > Preferences, add a "Selector Style" row:
- Label: "Navigation style"
- Two visual buttons: "Pills" and "Squircles" (show a mini preview of each style)
- Changing the preference applies immediately (no page reload)

---

## 2. Unified renderPillNav

### Extend renderPillNav to Support Per-Item Colors

Current signature: `renderPillNav(containerId, items, activeId, onSelect)`

New signature: `renderPillNav(containerId, items, activeId, onSelect, options)`

Where `options` is an optional object:
```javascript
{
  itemColors: { 'marketing': '#f472b6', 'strategy': '#a78bfa', ... },  // per-item accent colors (squircle mode)
  noBorder: false  // if true, removes bottom border from pill-nav container
}
```

When `itemColors` is provided and the user is in squircle mode, the active item fills with its specific color from the map. If no color is mapped for an item, falls back to `var(--brand-accent)`.

### CSS Implementation

```css
/* Base pill-nav (pills mode -- default, unchanged) */
.pill-nav-item { /* existing styles stay */ }

/* Squircle mode overrides */
html.selector-squircles .pill-nav-item {
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
}
html.selector-squircles .pill-nav-item:hover {
  background: var(--bg-secondary);
  border-color: transparent;
}
html.selector-squircles .pill-nav-item.active {
  background: var(--brand-accent, #a89878);
  border-color: transparent;
  color: #ffffff;  /* default, overridden by JS if needed for contrast */
}
```

For per-item colors in squircle mode, the active item gets an inline `style` attribute with the specific color and contrast text color. Both `renderPillNav` (initial render) and `updatePillNavActive` (subsequent updates) must apply these inline styles when `itemColors` is provided and selector style is squircles.

`updatePillNavActive` extension: when the active pill changes, if squircle mode is on and the container has `itemColors` stored (via `window._pillNavColors[containerId]`), apply inline `background` and `color` styles to the new active item, and clear them from the previously active item.

### Studio Migration

Replace all `selectAgent()` tab rendering logic that uses `.studio-v2-tab` with the unified `renderPillNav` call. Studio's agent pill container becomes a standard pill nav instance with `itemColors` mapping agent IDs to their colors from `AGENT_COLORS`.

The Studio tab bar HTML (currently hardcoded `<button class="studio-v2-tab">` elements) gets replaced with a `<div id="studioPillNav"></div>` container rendered by `renderPillNav`.

`selectAgent()` changes:
- Remove manual DOM manipulation of `.studio-v2-tab` active states
- Instead call `updatePillNavActive('studioPillNav', agentId)` + apply color styling
- Keep the rest of `selectAgent()` logic (filtering operations, updating UI)

---

## 3. Per-Section ? Dropdown Menu

### Replace Help Modal with Dropdown

The ? button (`showSectionHelp(sectionId)`) currently opens a full modal. Replace with a compact dropdown positioned below/beside the ? button.

**Dropdown items:**

1. **Take a Tour** (if guided tour exists for the section) -- icon: question circle SVG
2. **Send Feedback** -- icon: chat bubble SVG
3. **Divider line**
4. **Skip Landing** -- toggle switch (on/off). When on, clicking this view in the sidebar skips the landing page and goes directly to the default section.
5. **Open to** -- shows current default section label. Clicking opens a sub-list of available pills for that view (from `_pageLandingConfigs[viewId].features`). Selecting one sets it as the default.

### Availability

- Skip Landing + Open To rows **only appear** in expanded and customized sidebar modes (not grouped/simple, since grouped doesn't show landing pages).
- Tour and Feedback always appear.
- If the view has no landing page config (`_pageLandingConfigs[viewId]` is undefined), only Tour and Feedback are shown.

### Storage

Per-section preferences stored in a single localStorage key:

- Key: `localStorage['roweos_section_prefs']`
- Value: JSON object keyed by viewId:
```javascript
{
  "studio": { "skipLanding": true, "defaultPill": "marketing" },
  "signal": { "skipLanding": false, "defaultPill": "today" },
  "automations": { "skipLanding": true, "defaultPill": "browse" }
}
```

### Integration with showView

In `showView()`, where the landing page interception currently happens:
```javascript
if (sidebarMode === 'expanded' && _pageLandingConfigs[view]) {
  if (!window._skipPageLanding) {
    // NEW: Check section prefs
    var prefs = getSectionPrefs(view);
    if (prefs && prefs.skipLanding) {
      // Skip landing, go to default pill
      window._skipPageLanding = true;
      showView(view);  // re-enter with skip flag
      // Then activate default pill
      if (prefs.defaultPill && config.tabHandler) {
        window[config.tabHandler](prefs.defaultPill);
      }
      return;
    }
    showPageLanding(view);
    return;
  }
}
```

### Dropdown Behavior

- Dropdown appears on click of ? button (not hover)
- Positioned anchored to the ? button (below-right, `position: absolute`)
- On mobile (<=768px): same positioning but clamped to viewport edges with `max-width: calc(100vw - 32px)`
- Click outside or press Escape dismisses it
- Arrow keys navigate items, Enter activates (consistent with universal search keyboard patterns)
- Toggle changes apply immediately (no save button)
- Dropdown uses same glass-morphism dark panel style as other dropdowns in the app

### "Open to" Interaction

Clicking "Open to" expands an inline sub-list within the dropdown (below the "Open to" row). Shows all pills from `_pageLandingConfigs[viewId].features` as selectable rows. Selecting one collapses the sub-list and updates the label. Not a nested flyout -- stays within the same dropdown.

### "Send Feedback" Action

"Send Feedback" opens the existing feedback modal (`showFeedbackModal(sectionId)` or the current feedback mechanism). Same behavior as the current modal's "Send Feedback" button -- just moved into the dropdown.

### "Take a Tour" Action

"Take a Tour" triggers the existing guided tour (`startGuidedTour(sectionId)`). Dismisses the dropdown first.

---

## 4. ? Button Consistency

### Current Issue

Social Hub's ? button is not aligned like other views. All views should have the ? button in the same position within their panel-header.

### Standard Pattern

Every view's `panel-header` should follow:
```html
<div class="panel-header">
  <span>[View Name]</span>
  <!-- other header items (customize btn, etc.) go here with margin-left: auto -->
  <button class="section-help-btn" onclick="showSectionHelp('viewId')" title="How to use [View Name]">?</button>
</div>
```

The `.section-help-btn` is always the last item in the panel-header, using the existing CSS (circular, 24x24, border, right-aligned via flex).

### Views to Fix

Audit all views and ensure the ? button follows this pattern. Social Hub is the known issue but verify all 16+ views.

---

## 5. Dark/Light Mode Logos

### Upload UI in Settings > Appearance

Add a "Brand Logo" section in Settings > Appearance (below the theme toggle area):

**Layout:**
- Section header: "Brand Logo"
- Two logo slots side by side:
  - "Dark Mode" slot (shown on dark background preview)
  - "Light Mode" slot (shown on light background preview)
- Each slot shows: current logo preview (or placeholder icon), "Upload" button, "Remove" button
- Below the slots: a checkbox "Use same logo for both modes" (default: checked). When checked, only one upload slot is shown and the logo is used for both modes.
- Supported formats: PNG, SVG, JPEG. Max 200KB per logo file.
- On upload, images are resized to max 256x256px (using canvas resize) before converting to base64. This keeps base64 size under ~100KB per logo.
- Logos are stored as base64 data URLs in brand data (same pattern as existing logo storage).
- With 2 logos per brand x 5 brands x ~100KB = ~1MB total, well within Firestore document limits.

### Storage

Extend the brand object (per-brand, since each brand has its own logo):
```javascript
brands[idx].logo       // existing -- used as dark mode logo (or both if no light logo)
brands[idx].logoLight  // NEW -- light mode logo (optional)
```

If `logoLight` is not set, `logo` is used for both modes.

### Auto-Swap Logic

In the existing logo rendering functions (`initBrandLogo`, or wherever the sidebar/header logo is injected):
- Check current theme: `document.documentElement.classList.contains('light-mode')`
- If light mode AND `brand.logoLight` exists: use `brand.logoLight`
- Otherwise: use `brand.logo`

When the user toggles light/dark mode, re-run the logo swap.

### Identity View Link

In the Identity view's brand profile section, add a row:
```
Brand Logo  [current logo preview]  Change in Settings > Appearance →
```
Clicking navigates to Settings > Appearance (calls `showView('settings')` then `openSettingsFolder('appearance')`).

---

## 6. CSS Additions

```css
/* Squircle mode */
html.selector-squircles .pill-nav-item { ... }
html.selector-squircles .pill-nav-item.active { ... }
html.selector-squircles .pill-nav-item:hover { ... }

/* Section help dropdown */
.section-help-dropdown { ... }
.section-help-dropdown-item { ... }
.section-help-dropdown-toggle { ... }
.section-help-dropdown-divider { ... }

/* Logo upload slots */
.logo-upload-section { ... }
.logo-upload-slot { ... }
.logo-upload-preview { ... }

/* Selector style preview buttons in preferences */
.selector-style-option { ... }
.selector-style-option.active { ... }
```

All follow existing design system: dark theme, glass morphism, `--brand-accent` colors, light mode overrides.

---

## Key Functions (New/Modified)

| Function | Purpose |
|----------|---------|
| `getContrastTextColor(hexColor)` | Returns white or dark text based on luminance |
| `applySelectorStyle()` | Applies `selector-squircles` class to html element |
| `setSelectorStyle(style)` | Saves preference + applies |
| `renderPillNav(id, items, active, onSelect, options)` | Extended with `options.itemColors` |
| `showSectionHelpDropdown(btn, sectionId)` | Replaces `showSectionHelp()` modal with dropdown |
| `getSectionPrefs(viewId)` | Reads per-section prefs from localStorage |
| `setSectionPref(viewId, key, value)` | Writes per-section pref |
| `renderLogoUploadSection()` | Renders logo upload UI in Settings > Appearance |
| `uploadBrandLogo(mode)` | Handles file upload for dark/light logo |
| `swapLogoForTheme()` | Swaps logo based on current light/dark mode |
| `renderSelectorStylePicker()` | Renders pill/squircle choice in Settings > Preferences |

---

## Data Flow

```
User changes selector style in Settings > Preferences
  -> setSelectorStyle('squircles')
  -> localStorage['roweos_selector_style'] = 'squircles'
  -> html.classList.add('selector-squircles')
  -> All pill navs instantly switch appearance (CSS-only)
  -> Studio tabs also switch (same renderPillNav component)

User clicks ? button on any view
  -> showSectionHelpDropdown(btn, sectionId)
  -> Dropdown appears anchored to button
  -> Skip Landing toggle -> setSectionPref(viewId, 'skipLanding', true/false)
  -> Open To -> shows pill list -> setSectionPref(viewId, 'defaultPill', pillId)

User opens a view with skipLanding=true
  -> showView() checks getSectionPrefs(view)
  -> Skips landing page, shows view directly
  -> Activates defaultPill via tabHandler

User uploads light mode logo in Settings > Appearance
  -> uploadBrandLogo('light')
  -> brands[idx].logoLight = base64DataUrl
  -> saveBrands()
  -> swapLogoForTheme() updates sidebar/header

User toggles light/dark mode
  -> swapLogoForTheme() checks theme
  -> Uses logoLight if available and in light mode
  -> Falls back to logo (dark mode / universal)
```

---

## Migration Notes

- New localStorage keys: `roweos_selector_style`, `roweos_section_prefs`
- `roweos_section_prefs` does NOT need Firebase sync (local UI preference only)
- `roweos_selector_style` does NOT need Firebase sync (local UI preference only)
- `brands[idx].logoLight` is a new optional field -- existing brands without it continue working (logo used for both modes)
- `logoLight` must be included in brand sync paths (it's brand data, synced to Firestore)
- Studio's `.studio-v2-tab` CSS can be removed after migration (or kept as dead code initially)
- `showSectionHelp()` function is replaced by `showSectionHelpDropdown()` -- update all `onclick="showSectionHelp(..."` references (grep for exact count during planning; expect 16+ instances across view headers)
- `selectAgent()` must be refactored to use `updatePillNavActive` instead of manual `.studio-v2-tab` DOM manipulation
- `window._skipPageLanding` is already cleared in `showView()` after use (`window._skipPageLanding = false` at line 65313). The new skipLanding logic must set it before the recursive `showView()` call and it will be cleared on re-entry. No additional clearing needed.
- All new/modified functions must be tagged with version comment: `// v26.2: [description]`
- All code must be ES5: `var`, `function(){}`, string concat with `+`. No arrow functions, let/const, template literals.
- `openSettingsFolder(folderId)` already exists in the codebase -- used for navigating between Settings sub-sections.
- `AGENT_COLORS` global constant already maps all agent IDs to colors (strategy, marketing, operations, documents, intelligence, research, social, image, guided). Reference this existing constant for `itemColors`.
