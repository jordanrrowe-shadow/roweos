# Mobile UI Regression Fix — Design Spec

**Date:** 2026-04-17
**Version:** v29.0 regression fix
**File:** `src/css/core/01-base.css`

## Problem

Mobile UI broken after v29.0 (Scribe addition):
1. Black bar at bottom of screen on multiple views
2. Scribe view not using full width — offset from left, content narrowed
3. Content not filling full viewport height on Scribe

## Root Causes

### Cause 1: `#scribeView` missing from mobile panel-view selector

**Location:** `01-base.css` line ~37675-37680

The mobile `@media (max-width: 768px)` block has a selector list that applies `position: fixed; left: 0; right: 0; width: 100% !important` to all panel views. `#scribeView` was added in v29.0 but never added to this list. Without it, Scribe inherits the desktop rule `left: var(--sidebar-collapsed-width)` (64px), shifting the entire view right and preventing full-width display.

**Fix:** Add `#scribeView` to the selector list.

### Cause 2: Hardcoded 64px padding-bottom on containers

**Locations (4 rules):**
- `.main-wrapper` — `padding-bottom: calc(64px + var(--mobile-safe-bottom))`
- `.main-content` — `padding-bottom: calc(64px + var(--mobile-safe-bottom))`
- `.panel` — `padding-bottom: calc(64px + var(--mobile-safe-bottom))`
- `.panel:last-child` — `padding-bottom: calc(64px + var(--mobile-safe-bottom))`

These reserve 64px for the liquid-nav even when it's turned off. The result is a persistent black bar (actually `--bg-primary` #09090b) at the bottom of the screen.

**Fix:** Replace `calc(64px + var(--mobile-safe-bottom))` with `var(--mobile-safe-bottom)` in all four locations. The liquid-nav is `position: fixed; z-index: 1000` — it floats over content. Content scrolls underneath it naturally. No padding reservation needed. The safe-bottom variable handles the iPhone home indicator.

### Cause 3: `.scribe-layout` has no height on mobile

**Location:** `01-base.css` line ~47198 (mobile media query for Scribe)

Desktop sets `height: calc(100vh - 160px)`. Mobile override sets `min-height: auto` but no explicit height, so the layout collapses to content height.

**Fix:** Add `height: 100%` to `.scribe-layout` in the mobile media query so it fills its parent panel-view.

## Changes Summary

| # | Location | Current | New |
|---|----------|---------|-----|
| 1 | Mobile panel-view selector (~L37675) | Missing `#scribeView` | Add `#scribeView` |
| 2a | `.main-wrapper` padding-bottom (~L37658) | `calc(64px + var(--mobile-safe-bottom))` | `var(--mobile-safe-bottom)` |
| 2b | `.main-content` padding-bottom (~L37671) | `calc(64px + var(--mobile-safe-bottom))` | `var(--mobile-safe-bottom)` |
| 2c | `.panel` padding-bottom (~L37699) | `calc(64px + var(--mobile-safe-bottom))` | `var(--mobile-safe-bottom)` |
| 2d | `.panel:last-child` padding-bottom (~L37709) | `calc(64px + var(--mobile-safe-bottom))` | `var(--mobile-safe-bottom)` |
| 3 | `.scribe-layout` mobile (~L47198) | `min-height: auto` | `min-height: auto; height: 100%` |

## Also add `#scribeView` to light-mode mobile selector

**Location:** ~L36374. The light-mode background override list also needs `#scribeView`.

## Risk Assessment

- **Low risk:** Adding `#scribeView` to selector lists — purely additive
- **Medium risk:** Removing 64px padding — if any view's last content element sits behind the liquid-nav when it's on, users would need to scroll to see it. However, since Jordan keeps liquid-nav off and the nav floats with z-index 1000, this is acceptable. Content scrolls underneath.
- **Low risk:** Adding height to `.scribe-layout` mobile — only affects Scribe view

## Testing Checklist

- [ ] Chat view (agentView) — full width, no black bar, chat input at screen bottom
- [ ] Scribe view — full width, full height, no green margins
- [ ] Studio view — full width, no black bar (already works, verify no regression)
- [ ] Sidebar overlay — opens/closes properly, no width issues
- [ ] Pulse view — full width, no black bar
- [ ] With liquid-nav ON — nav floats correctly, content scrollable underneath
- [ ] With liquid-nav OFF — no black bar, content fills to screen bottom
- [ ] Light mode — all views have correct background
