# Guided Tour & Tier System Overhaul

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the post-onboarding guided tour to match current sidebar labels, icons, and tier system; update Solo tier to include Identity, Studio, Analytics, Mail; hide locked features by default; fix the "Show locked features" toggle visual; fix sidebar zoom overflow.

**Architecture:** All changes are in source files under `src/`. The guided tour steps are in `24-lifeai-identity.js`. The tier/feature gating is in `22-firebase-sync.js`. The sidebar HTML is in `04-views-batch3.html`. CSS is in `01-base.css`. After all edits, run `bash src/build.sh` to regenerate `RoweOS/dist/index.html`.

**Tech Stack:** Vanilla ES5 JS, CSS, HTML (no frameworks). All edits must be ES5-only.

---

## Summary of Issues (from Jordan's screenshots)

1. Tour says "Focus" instead of "Pulse" (Focus is retired)
2. Tour says "Clients" instead of "People"
3. Tour shows database icon for Identity instead of diamond
4. Tour step for Bloom shows wrong icon (says "animation")
5. Tour step for Analytics highlights Inventory sidebar item
6. Tour step for Mail highlights Folio sidebar item
7. Tour popup text is grey/unreadable in light mode - needs white background + dark text
8. Tour doesn't adapt between Simple/Advanced/Customized sidebar modes
9. Tour has a `?` icon that looks broken
10. "Founder Feature" popup still says "Focus" instead of "Pulse"
11. "Maybe later" lets users access locked features (they should be fully blocked)
12. Locked features should be HIDDEN by default (toggle default = false)
13. "Show locked features" toggle doesn't visually toggle off
14. Solo tier should include: Identity, Studio, Analytics, Mail
15. Sidebar bottom overflows when zooming (v30.0 text area expands too far)

---

### Task 1: Update Tour Steps - Rename Focus to Pulse, Clients to People

**Files:**
- Modify: `src/js/core/24-lifeai-identity.js:2007-2049` (TOUR_STEPS + LIFE_TOUR_STEPS)

- [ ] **Step 1: Fix TOUR_STEPS (BrandAI tour)**

In `TOUR_STEPS` array (~line 2007):

1. **Remove the Focus step** (line 2010): Delete the entire `{ id: 'focus', type: 'deep-dive', target: 'signal', ... }` entry. Focus/Signal is retired - Pulse already exists as a separate step.

2. **Rename Clients to People** (line 2021): Change:
   - `id: 'clients'` to `id: 'people'`
   - `title: 'Clients'` to `title: 'People'`
   - `description: 'Client relationship management.'` to `description: 'Manage clients, team, and contacts.'`
   - Update features array:
     - `'Track client details and interactions'` to `'Track clients, team members, and contacts'`
     - `'Link conversations and documents to clients'` to `'Link conversations and documents to people'`
     - `'Export client data'` to `'Export contact data'`

3. **Fix Identity icon** (line 2017): Change `icon: 'database'` to `icon: 'diamond'`

4. **Fix History icon** (line 2018): Change `icon: 'database'` to `icon: 'clock'`

5. **Fix Inventory icon** (line 2022): Change `icon: 'database'` to `icon: 'package'`

6. **Fix Automations icon** (line 2014): Change `icon: 'calendar'` to `icon: 'zap'`

- [ ] **Step 2: Fix LIFE_TOUR_STEPS (LifeAI tour)**

In `LIFE_TOUR_STEPS` array (~line 2030):

1. **Remove the Focus step** (line 2033): Delete the entire `{ id: 'focus', ... }` entry

2. **Fix Identity icon** (line 2040): Change `icon: 'database'` to `icon: 'diamond'`

3. **Fix History icon** (line 2041): Change `icon: 'database'` to `icon: 'clock'`

4. **Fix Inventory icon** (line 2043): Change `icon: 'database'` to `icon: 'package'`

5. **Fix Automations icon** (line 2037): Change `icon: 'calendar'` to `icon: 'zap'`

- [ ] **Step 3: Verify step count**

After removing the Focus step from each array, update any hardcoded step counts. The step counter is auto-calculated from `activeSteps.length` (line 2159), so no hardcoded count to fix.

- [ ] **Step 4: Build and verify**

```bash
bash src/build.sh
```

Grep to confirm: `grep -n "Focus" RoweOS/dist/index.html | grep -i "tour\|TOUR_STEPS" | head -5` should return nothing.

---

### Task 2: Fix Tour Icon Rendering

**Files:**
- Modify: `src/js/core/24-lifeai-identity.js:2163` (renderTourStep icon call)

The `icon()` function at line 2163 renders tour step icons. Check that it supports `'diamond'`, `'clock'`, `'package'`, `'zap'` icon names. If not, the function needs those mappings added.

- [ ] **Step 1: Find the icon() function**

Search for `function icon(` in the codebase. It's likely in `08-foundation.js` or `20-ui-misc.js`. Verify it has entries for: `diamond`, `clock`, `package`, `zap`, `sparkles`, `chat`, `target`, `edit`, `calendar`, `library`, `mail`, `chart`, `share`, `settings`, `checkCircle`.

- [ ] **Step 2: Add missing icon mappings**

If `diamond` is not in the icon function, add it:
```javascript
if (name === 'diamond') return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="' + c + '" stroke-width="1.5"><path d="M12 2L2 12l10 10 10-10L12 2z"/></svg>';
```

Add any other missing icons needed by the tour steps.

- [ ] **Step 3: Build and test**

```bash
bash src/build.sh
```

---

### Task 3: Fix Tour Spotlight Targeting

**Files:**
- Modify: `src/js/core/24-lifeai-identity.js:2195-2234` (positionTourSpotlight)

The spotlight targets `.nav-item[data-view="X"]` but in grouped sidebar mode, nav items are `.nav-subitem[data-view="X"]` (subitems inside groups). The query selector misses them.

- [ ] **Step 1: Fix the nav item query selector**

In `positionTourSpotlight()` at line 2196, change:
```javascript
var navItem = document.querySelector('.nav-item[data-view="' + viewName + '"]');
```
To:
```javascript
// v30.1: Check both grouped (nav-subitem) and expanded (nav-item) sidebar modes
var navItem = document.querySelector('.nav-subitem[data-view="' + viewName + '"]') 
           || document.querySelector('.nav-item[data-view="' + viewName + '"]');
```

This ensures the spotlight finds the correct nav item regardless of sidebar mode (Simple/grouped uses `.nav-subitem`, Advanced/expanded uses `.nav-item`).

- [ ] **Step 2: Handle grouped parent expansion**

When spotlighting a grouped subitem, the parent group may be collapsed. Before `navItem.scrollIntoView()`, expand the parent:
```javascript
if (navItem && navItem.classList.contains('nav-subitem')) {
  var parentGroup = navItem.closest('.nav-item');
  if (parentGroup) {
    var subitems = parentGroup.querySelector('.nav-subitems');
    if (subitems) subitems.style.display = 'block';
  }
}
```

- [ ] **Step 3: Build and test**

```bash
bash src/build.sh
```

---

### Task 4: Fix Tour Card Readability (Light Mode)

**Files:**
- Modify: `src/css/core/01-base.css` (tour card styles)

The tour card uses `var(--bg-primary)` which is light in light mode, but the text uses `var(--text-secondary)` which is also light grey. The card text needs to be readable in both modes.

- [ ] **Step 1: Find tour card CSS**

Search for `.tour-card` styles in `01-base.css`. They're around line 43110+. Also search for `.tour-card-title`, `.tour-card-description`, `.tour-deep-dive-features`.

- [ ] **Step 2: Ensure card text contrast**

Add explicit text color overrides to the tour card:
```css
.tour-card {
  background: var(--bg-primary);
  color: var(--text-primary);
}
.tour-card-title {
  color: var(--text-primary) !important;
}
.tour-card-description {
  color: var(--text-primary) !important;
  opacity: 0.85;
}
.tour-deep-dive-features li {
  color: var(--text-primary) !important;
  opacity: 0.75;
}
.tour-card-footer {
  color: var(--text-secondary);
}
.tour-step-counter {
  color: var(--text-secondary);
}
```

- [ ] **Step 3: Build and test in both themes**

```bash
bash src/build.sh
```

---

### Task 5: Update Solo Tier Features

**Files:**
- Modify: `src/js/core/22-firebase-sync.js:3279-3313` (hasFeatureAccess / featureMinTier)

Jordan wants Solo tier to include: Identity, Studio, Analytics, Mail (currently Founder-only).

- [ ] **Step 1: Update featureMinTier map**

In `hasFeatureAccess()` at ~line 3289, change these entries from `'founder'` to `'solo'`:
```javascript
studio: 'solo',       // was 'founder'
identity: 'solo',     // was 'founder'
analytics: 'solo',    // was 'founder'
mail: 'solo',         // was 'founder'
```

Keep these as `'founder'`:
```javascript
sync: 'founder',
automations: 'founder',
automationsAgent: 'founder',
pipelines: 'founder',
social: 'founder',
focus: 'founder',    // Note: Focus is retired but keep the gate for backward compat
```

- [ ] **Step 2: Update the upgrade modal feature lists**

In `showUpgradeModal()` at ~line 3358, update the Founder card feature list to remove Studio, Analytics, Identity, Mail (now in Solo). Change:
```
'Studio, Automations, Mail, Social, Focus, Analytics, Identity, Cloud Sync'
```
To:
```
'Automations Agent, Pipelines, Social Publishing, Cloud Sync'
```

Update the Solo card description in the Settings Account section (~line 4483):
```
'Library, Memory, Pulse, Rhythm'
```
To:
```
'Library, Pulse, Rhythm, Studio, Identity, Analytics, Mail'
```

- [ ] **Step 3: Update VIEW_FEATURE_MAP**

At ~line 3341, the `VIEW_FEATURE_MAP` controls which views are gated. Since Studio, Identity (memory), Analytics (commerce), and Mail are now Solo-tier, they should be accessible to Solo users. The existing `hasFeatureAccess` check will handle this automatically since we changed featureMinTier. No MAP changes needed.

- [ ] **Step 4: Rename "Focus" to "Pulse" in upgrade modal text**

Search for `'Focus'` in the upgrade modal feature lists and change to `'Pulse'`. Also search for `focus` in the `featureMinTier` description strings.

- [ ] **Step 5: Build and test**

```bash
bash src/build.sh
```

---

### Task 6: Hide Locked Features by Default

**Files:**
- Modify: `src/js/core/22-firebase-sync.js:3424` (updateSidebarTierLocks)
- Modify: `src/js/core/22-firebase-sync.js:4503-4513` (Settings toggle UI)

- [ ] **Step 1: Change default to hidden**

In `updateSidebarTierLocks()` at ~line 3424, change:
```javascript
var showLocked = localStorage.getItem('roweos_show_locked_features') !== 'false'; // default true
```
To:
```javascript
// v30.1: Default to hidden — locked features only shown when user explicitly enables
var showLocked = localStorage.getItem('roweos_show_locked_features') === 'true'; // default false
```

- [ ] **Step 2: Fix toggle visual state**

The toggle checkbox `checked` attribute and the visual span positions are set from the `showLocked` variable. In the Settings Account section (~line 4503), the toggle HTML is built dynamically. Ensure the checkbox `checked` attribute matches and the slider position (`left: 2px` vs `left: 20px`) matches.

Find where the toggle HTML is built and ensure:
```javascript
var _showLocked = localStorage.getItem('roweos_show_locked_features') === 'true';
// checkbox: _showLocked ? 'checked' : ''
// slider dot left: _showLocked ? '20px' : '2px'
// background: _showLocked ? 'var(--brand-accent, #a89878)' : 'var(--bg-tertiary)'
```

- [ ] **Step 3: Build and test**

```bash
bash src/build.sh
```

---

### Task 7: Block Access on "Maybe Later"

**Files:**
- Modify: `src/js/core/22-firebase-sync.js:3347-3406` (showUpgradeModal)

Currently "Maybe later" just closes the modal. The view access is already blocked by `checkViewAccess()` returning `true`, which prevents `showView()` from proceeding. But the user reported they CAN access features after clicking "Maybe later" - this suggests `checkViewAccess()` isn't being called on all paths, or the view was already shown before the modal appeared.

- [ ] **Step 1: Investigate the bypass**

The issue is likely that `showView()` calls `checkViewAccess()` which shows the modal, but by that point the view has already been partially rendered (hidden class removed). Check `showView()` in `11-agents.js` to see if view switching happens BEFORE or AFTER the access check.

- [ ] **Step 2: Ensure view is NOT shown when blocked**

In `showView()`, the access check should happen BEFORE any DOM changes. Find where `checkViewAccess` is called and ensure the view's hidden class is NOT removed if access is denied. The pattern should be:
```javascript
// Check access FIRST
if (typeof checkViewAccess === 'function' && checkViewAccess(view)) {
  return; // Don't show view — modal was displayed
}
// Only THEN remove hidden class and show view
```

- [ ] **Step 3: Build and test**

```bash
bash src/build.sh
```

---

### Task 8: Fix Sidebar Zoom Overflow

**Files:**
- Modify: `src/css/core/01-base.css` (sidebar footer / v30.0 area)

The sidebar footer (where v30.0 text sits) expands too far when zooming in/out, pushing content below the viewport.

- [ ] **Step 1: Find sidebar footer CSS**

Search for `v30.0` or `sidebar-footer` in the CSS. The sidebar version display is likely at the bottom of the `.sidebar` element. Find the CSS that controls its height/positioning.

- [ ] **Step 2: Constrain the footer**

Ensure the sidebar has `overflow-y: auto` (or hidden) and the footer is pinned with a fixed height:
```css
.sidebar-footer {
  flex-shrink: 0;
  max-height: 48px;
  overflow: hidden;
}
```

Or if the issue is the sidebar itself overflowing, ensure:
```css
.sidebar {
  max-height: 100vh;
  max-height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
}
```

- [ ] **Step 3: Test with zoom 75%, 100%, 125%, 150%**

```bash
bash src/build.sh
```

---

### Task 9: Final Build, Verify, Deploy

**Files:**
- All modified files

- [ ] **Step 1: Syntax check all modified files**

```bash
for f in src/js/core/24-lifeai-identity.js src/js/core/22-firebase-sync.js src/js/core/11-agents.js; do node -c "$f" 2>&1 || echo "FAIL: $f"; done
```

- [ ] **Step 2: Build**

```bash
bash src/build.sh
```

- [ ] **Step 3: Verify key changes**

```bash
echo "Focus in tour:" && grep -c "'Focus'" RoweOS/dist/index.html
echo "Pulse in tour:" && grep -c "'Pulse'" RoweOS/dist/index.html
echo "People in tour:" && grep "'People'" RoweOS/dist/index.html | grep -c tour
echo "Solo features:" && grep "studio.*solo\|identity.*solo\|analytics.*solo\|mail.*solo" RoweOS/dist/index.html | head -3
echo "Default locked hidden:" && grep -c "show_locked_features.*=== .true." RoweOS/dist/index.html
```

- [ ] **Step 4: Deploy**

```bash
./deploy.sh
```
