# Mobile UI Regression Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mobile UI regression — eliminate black bar at bottom, restore full-width display on all views (especially Scribe), and ensure content fills the entire viewport.

**Architecture:** Pure CSS fixes in `src/css/core/01-base.css`. Remove hardcoded 64px nav padding from 4 mobile rules, add `#scribeView` to mobile panel-view selector, and fix Scribe layout height on mobile.

**Tech Stack:** CSS only. Build via `bash src/build.sh`.

**Spec:** `docs/superpowers/specs/2026-04-17-mobile-ui-regression-fix-design.md`

---

### Task 1: Add `#scribeView` to mobile panel-view selector

**Files:**
- Modify: `src/css/core/01-base.css:37676`

This is the root cause of Scribe not being full-width on mobile. The selector list applies `position: fixed; left: 0; right: 0; width: 100% !important` to all panel views, but `#scribeView` was never added when Scribe shipped in v29.0.

- [ ] **Step 1: Add `#scribeView` to the mobile panel-view selector**

In `src/css/core/01-base.css`, find line 37676:

```css
      #agentView, #studioView, #identityView, /* v28.8: removed #signalView */
```

Change to:

```css
      #agentView, #studioView, #scribeView, #identityView, /* v29.1: added #scribeView */
```

- [ ] **Step 2: Add `#scribeView` to light-mode mobile background selector**

In `src/css/core/01-base.css`, find line 36383:

```css
      html.light-mode #mailView {
```

Change to:

```css
      html.light-mode #mailView,
      html.light-mode #scribeView {
```

- [ ] **Step 3: Build and verify**

Run: `bash src/build.sh`

Verify in built `RoweOS/dist/index.html` that `#scribeView` appears in both selector lists by searching for `#scribeView` near the mobile panel-view block.

- [ ] **Step 4: Commit**

```bash
cd ~/Developer/roweOS
git add src/css/core/01-base.css
git commit -m "v29.1: Add #scribeView to mobile panel-view selectors

Scribe was missing from the mobile CSS selector list, causing it to
inherit desktop positioning (left: 64px) instead of full-width mobile
layout."
```

---

### Task 2: Remove hardcoded 64px padding-bottom from mobile containers

**Files:**
- Modify: `src/css/core/01-base.css:37659,37671,37700,37710`

Four rules add `padding-bottom: calc(64px + var(--mobile-safe-bottom))` to reserve space for the liquid-nav. This creates a black bar at the bottom even when liquid-nav is off. The liquid-nav is `position: fixed; z-index: 1000` and floats over content — no padding reservation is needed.

- [ ] **Step 1: Fix `.main-wrapper` padding-bottom**

In `src/css/core/01-base.css`, find line 37659:

```css
        padding-bottom: calc(64px + var(--mobile-safe-bottom)); /* v15.43: Smaller nav */
```

Change to:

```css
        padding-bottom: var(--mobile-safe-bottom); /* v29.1: No 64px hack — liquid-nav floats with z-index */
```

- [ ] **Step 2: Fix `.main-content` padding-bottom**

In `src/css/core/01-base.css`, find line 37671:

```css
        padding-bottom: calc(64px + var(--mobile-safe-bottom)); /* v15.43: Smaller nav */
```

Change to:

```css
        padding-bottom: var(--mobile-safe-bottom); /* v29.1: No 64px hack — liquid-nav floats with z-index */
```

- [ ] **Step 3: Fix `.panel` padding-bottom**

In `src/css/core/01-base.css`, find line 37700:

```css
        padding-bottom: calc(64px + var(--mobile-safe-bottom)); /* v15.43: Smaller nav */
```

Change to:

```css
        padding-bottom: var(--mobile-safe-bottom); /* v29.1: No 64px hack — liquid-nav floats with z-index */
```

- [ ] **Step 4: Fix `.panel:last-child` padding-bottom**

In `src/css/core/01-base.css`, find line 37710:

```css
        padding-bottom: calc(64px + var(--mobile-safe-bottom));
```

Change to:

```css
        padding-bottom: var(--mobile-safe-bottom); /* v29.1: No 64px hack — liquid-nav floats with z-index */
```

- [ ] **Step 5: Build and verify**

Run: `bash src/build.sh`

Search built file for any remaining `calc(64px` in the mobile media query to confirm none were missed.

- [ ] **Step 6: Commit**

```bash
cd ~/Developer/roweOS
git add src/css/core/01-base.css
git commit -m "v29.1: Remove hardcoded 64px bottom padding from mobile containers

The 64px padding reserved space for liquid-nav but created a black bar
at the bottom of the screen, especially when liquid-nav is turned off.
The nav is position:fixed with z-index:1000 and floats over content —
no padding hack needed. Only safe-area-inset-bottom remains for the
iPhone home indicator."
```

---

### Task 3: Fix Scribe layout height on mobile

**Files:**
- Modify: `src/css/core/01-base.css:47199-47201`

The Scribe grid layout has no height set on mobile, so it collapses to content height instead of filling the panel-view viewport.

- [ ] **Step 1: Add height to `.scribe-layout` on mobile**

In `src/css/core/01-base.css`, find lines 47199-47201:

```css
  .scribe-layout {
    grid-template-columns: 1fr;
    min-height: auto;
  }
```

Change to:

```css
  .scribe-layout {
    grid-template-columns: 1fr;
    min-height: auto;
    height: 100%; /* v29.1: Fill parent panel-view on mobile */
  }
```

- [ ] **Step 2: Build and verify**

Run: `bash src/build.sh`

Verify the built file has `height: 100%` in the Scribe mobile media query.

- [ ] **Step 3: Commit**

```bash
cd ~/Developer/roweOS
git add src/css/core/01-base.css
git commit -m "v29.1: Fix Scribe layout height on mobile

Desktop sets explicit height via calc(100vh - 160px) but mobile had
no height rule, causing the grid to collapse. Now fills parent
panel-view with height: 100%."
```

---

### Task 4: Final build and deploy verification

- [ ] **Step 1: Full build**

Run: `bash src/build.sh`

- [ ] **Step 2: Visual verification checklist**

Deploy to preview and test on mobile (or Safari responsive mode):

- Chat view (agentView) — full width, no black bar, chat input at screen bottom
- Scribe view — full width, full height, no green/olive margins
- Studio view — full width, no black bar (was already working, verify no regression)
- Pulse view — full width, no black bar
- Sidebar overlay — opens/closes properly, no width issues
- With liquid-nav ON — nav floats correctly, content scrollable underneath
- With liquid-nav OFF — no black bar, content fills to screen bottom
- Light mode — Scribe has correct background

- [ ] **Step 3: Deploy**

```bash
cd ~/Developer/roweOS && bash src/build.sh && ./deploy.sh
```
