# RoweOS UI Redesign: Navigation & Section Landing Pages

**Date:** 2026-03-23
**Scope:** Sidebar consolidation (20 items to 6 groups), section landing pages, pill navigation, mobile pill nav
**Approach:** Template-based -- build one landing page template and one pill nav component, apply to all sections
**Files affected:** `RoweOS/dist/index.html` (HTML, CSS, JS)

---

## Problem

The desktop UI has 20 sidebar items visible at once across 7 sections. New users feel overwhelmed. Complex sections like Automations (8 tabs) and Social Hub (8 tabs) drop users into a wall of tab bars without context about what each tab does.

## Design Philosophy

- Match the aesthetic of therowecollection.com/roweos: dark theme, gold accent (#a89878), Georgia serif for taglines, uppercase labels, bordered cards
- Progressive disclosure: groups on sidebar, landing pages explain features, pills for switching
- Simple by default, advanced available via settings toggle
- Consistent patterns everywhere -- same pill nav, same landing template, same breadcrumb

---

## 1. Sidebar Consolidation (Desktop)

### Default Mode: 6 Groups + BrandAI

The sidebar collapses from 20 individual items to 6 grouped entries. Each group has its own icon.

| Sidebar Item | Icon | Sub-features | Tagline |
|---|---|---|---|
| **BrandAI** | Chat bubble | Direct to chat (home) | -- |
| **Core** | Circle/compass | Focus, Pulse, Rhythm | "Your brand at a glance" |
| **Create** | Star/spark | Studio, Bloom, Social Hub, Automations | "Make things happen" |
| **Orchestration** | Envelope/grid | Library, Folio, Mail | "Content, correspondence, and collections" |
| **Intelligence** | Shield/brain | Identity, History, Guardrails | "Know your brand inside out" |
| **Governance** | Gear/settings | People, Analytics, Inventory, Sync, System, Admin (conditional) | "Configure, measure, and manage" |

- BrandAI goes directly to chat (no landing page). It is the home/default view.
- All other items show their section landing page when clicked.
- Notification Center stays as-is (separate item with bell icon, positioned below the 6 groups, separated by a divider).
- Admin is conditionally shown in Governance for admin users only (preserves existing `display:none` behavior).

### Migration Mapping (Current Location to New Group)

| Item | Current Section | New Group |
|---|---|---|
| BrandAI | (standalone) | BrandAI (home) |
| Focus | Core | Core |
| Pulse | Core | Core |
| Studio | Core | Create |
| Folio | Core | Orchestration |
| Rhythm | Orchestration | Core |
| Library | Orchestration | Orchestration |
| Automations | Orchestration | Create |
| Mail | Orchestration | Orchestration |
| Identity | Intelligence | Intelligence |
| History | Intelligence | Intelligence |
| Guardrails | Intelligence | Intelligence |
| People | Governance | Governance |
| Analytics | Governance | Governance |
| Inventory | Governance | Governance |
| Sync | Governance | Governance |
| System | Governance | Governance |
| Bloom | Premium | Create |
| Social Hub | Premium | Create |
| Admin | Premium (hidden) | Governance (hidden) |

### Expanded Mode: Collapsible Sub-Items

Toggled via Settings > Appearance > "Expanded sidebar navigation."

- Same 6 groups shown in sidebar
- Each group has a chevron that toggles open/closed
- When expanded, sub-items appear indented underneath the group
- Clicking a sub-item navigates directly to that sub-section (skips the landing page)
- Expanded/collapsed state per group persists in `localStorage` key `roweos_sidebar_expanded_{group}`
- Visual: sub-items use smaller font (12px vs 14px), left-indented 16px, dimmer color (#999 vs #ddd)

### Onboarding Integration

During onboarding, after brand setup, users choose:
- **Simple** (default): Grouped sidebar, landing pages
- **Advanced**: Expanded sidebar with all items visible

Stored in `localStorage['roweos_sidebar_mode']` as `'grouped'` or `'expanded'`. Changeable anytime in Settings > Appearance.

---

## 2. Section Landing Pages (Desktop Only)

### Layout: Split Panel

When a sidebar group is clicked, it shows a full-panel landing page:

**Left side (40% width):**
- Uppercase section label (10px, letter-spacing 3px, gold color)
- Serif tagline (26px, Georgia, cream color)
- 1-2 sentence description (13px, #777)
- Live stats bar (pulled from real data -- counts, percentages, next-run times)

**Right side (60% width):**
- Primary feature cards: bordered cards with icon (34x34 in #1a1815 rounded square), title (14px, white), description (11px, #777), optional badge count (gold pill)
- Cards respond to hover: border color transitions to gold, subtle background change
- Secondary features: compact pill row at the bottom for less-used sub-sections

**Styling (using CSS custom properties for light/dark mode compatibility):**
- Background: var(--bg-primary)
- Card borders: 1px solid var(--border-color), border-radius 10px
- Hover: border-color var(--accent), background var(--bg-secondary)
- Stats: numbers in 22px var(--accent), labels in 10px uppercase var(--text-tertiary)
- Dividers: 1px solid var(--border-color)
- Tagline font: Georgia, serif (hardcoded -- design choice, not theme-dependent)

### Default Active Pill Per Section

When navigating from a landing page card, that card's sub-section becomes the active pill. When navigating to a section without specifying a sub-section (e.g., expanded sidebar click on group name), the first primary pill is active by default:
- Core: Focus
- Create: Studio
- Orchestration: Library
- Intelligence: Identity
- Governance: People

### Grid Layout for Landing Page Cards

Right-side cards use `display: flex; flex-direction: column; gap: 8px;` (vertical stack, not grid). This avoids layout issues with varying item counts (3, 4, 5 items). Secondary features use a separate `display: flex; gap: 8px;` row of compact pills below the cards.

### Data for Each Section

**Core:**
- Stats: Focus items today, Pulse score, upcoming Rhythm events
- Cards: Focus (dashboard), Pulse (brand health), Rhythm (calendar)

**Create:**
- Stats: Active automations, total posts, connected platforms
- Cards: Studio (content generation), Social Hub (social management), Automations (workflows), Bloom (growth)

**Orchestration:**
- Stats: Library items, unread mail, Folio entries
- Cards: Library (content storage), Folio (portfolio), Mail (email)

**Intelligence:**
- Stats: Brand memory entries, conversation history count, active guardrails
- Cards: Identity (brand memory), History (conversation log), Guardrails (safety rules)

**Governance:**
- Stats: Contacts count, revenue metrics, inventory items
- Cards: People (contacts), Analytics (metrics), Inventory (assets), Sync (status), System (settings)

### Navigation Behavior

- Click a feature card: navigates to that sub-section view with breadcrumb + pill nav
- Breadcrumb shows: `Home > {Group} > {Sub-section}`
- Click group name in breadcrumb: returns to landing page
- Click "Home" in breadcrumb: returns to BrandAI

---

## 3. Pill Navigation (Replaces All Tab Bars)

### Design (Command Center Style)

Horizontal row of pills replaces every existing tab bar in the app. Applied universally.

**Active pill:**
- Background: #1a1815
- Border: 1px solid #a89878
- Text: 13px, #f0ebe4

**Inactive primary pill:**
- Background: transparent
- Border: 1px solid #2a2520
- Text: 13px, #999
- Hover: border-color #a89878, text #ddd

**Inactive secondary pill (less-used features):**
- Border: 1px solid #1a1815
- Text: 12px, #666
- Hover: border-color #a89878, text #999

**Layout:**
- `display: flex; gap: 6px; flex-wrap: wrap;` on desktop
- `overflow-x: auto; flex-wrap: nowrap;` on mobile (horizontal scroll)
- Bottom border: 1px solid #1a1815 as separator from content
- Margin: 16px 0 20px

### Sub-Section Header (Above Pills)

When inside a sub-section, show a compact header:
- Section title (20px, font-weight 500)
- Description (12px, #777)
- This replaces the current `panel-header` + `panel-description` pattern

### Sections That Get Pill Nav

Every view that currently uses a tab bar. Key ones:

| Section | Current Tabs | Pills (primary) | Pills (secondary) |
|---|---|---|---|
| Social Hub | Engage, Publish, Create, Activity, Media, Blog, Analytics, Settings | Engage, Publish, Create, Analytics | Blog, Activity, Media, Settings |
| Automations | Workflows, Agents, Scheduler, Image Lab, Video Lab, Usage | Workflows, Agents, Scheduler | Image Lab, Video Lab, Usage |
| Mail | Inbox, Outbox, Sent, Drafts, Compose, Settings | Inbox, Compose, Drafts | Sent, Outbox, Settings |
| System | (sub-pages via cards) | Keep current card-based navigation | -- |
| Studio | (operations/chat) | Dependent on Studio's internal structure | -- |

---

## 4. Mobile Strategy

### Floating Glass Nav: Unchanged

The existing floating liquid glass navigation menu stays exactly as it is. No changes to the mobile nav component.

### Tab Bars: Replace with Scrollable Pills

All mobile tab bars are replaced with horizontally scrollable pill navigation:
- Same pill styling as desktop
- `overflow-x: auto; -webkit-overflow-scrolling: touch;`
- `flex-wrap: nowrap;` (single scrollable row)
- Each pill has `white-space: nowrap; flex-shrink: 0;`

### No Landing Pages on Mobile

Tapping a nav item on mobile goes directly to the view (same as today). No split-panel landing page. The pill nav provides the sub-section switching that landing pages handle on desktop.

### Breadcrumb on Mobile

Show breadcrumb on mobile for context: `Create > Social Hub > Engage`. Tapping a breadcrumb segment navigates back. Compact font (11px).

---

## 5. Breadcrumb Component

**HTML:** `<div class="section-breadcrumb">` containing `<a>` and `<span>` elements separated by `>` characters.

**Placement:** First element inside each panel view, above the section header and pill nav.

**Desktop styling:** font-size 12px, color var(--text-tertiary), links in var(--accent) with hover underline, separator in var(--text-tertiary).

**Mobile styling:** font-size 11px, same colors. Truncates long paths with ellipsis on small screens.

**State management:** A global `_navBreadcrumb` array tracks the navigation path. `showSectionLanding(group)` sets it to `['Home', group]`. Entering a sub-section appends the sub-section name. `renderBreadcrumb()` builds the HTML from the array. Clicking a breadcrumb segment calls `navigateBreadcrumb(index)` which trims the array and navigates.

## 6. Accessibility

- Pill nav container: `role="tablist"`
- Each pill: `role="tab"`, `aria-selected="true"` for active, `tabindex="0"` for active and `-1` for inactive
- Arrow key navigation between pills (left/right)
- Sidebar groups in expanded mode: `aria-expanded="true/false"` on the group toggle
- Focus rings: `outline: 2px solid var(--accent); outline-offset: 2px;` on `:focus-visible`
- Landing page feature cards: `role="link"`, keyboard-accessible via Enter/Space

## 7. Implementation Notes

### CSS Component: `.pill-nav`

Create a reusable CSS class for pill navigation:
```css
.pill-nav { display: flex; gap: 6px; flex-wrap: wrap; margin: 16px 0 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); }
.pill-nav-item { padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-color); font-size: 13px; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.pill-nav-item.active { background: var(--bg-tertiary); border-color: var(--accent); color: var(--text-primary); }
.pill-nav-item.secondary { font-size: 12px; color: var(--text-tertiary); border-color: var(--bg-tertiary); }
@media (max-width: 768px) { .pill-nav { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; } .pill-nav-item { flex-shrink: 0; } }
```

### JS Component: `showSectionLanding(group)`

A function that renders the split-panel landing page for a group. Takes the group config (tagline, description, sub-features, stats function) and renders the HTML.

### JS Component: `renderPillNav(items, activeItem, onSelect)`

A function that renders the pill navigation bar. Replaces all existing `renderTabBar` / tab button HTML in every view.

### Migration: Existing Tab Bars

Each existing tab bar (Social Hub tabs, Automations tabs, Mail tabs, etc.) is replaced with a `renderPillNav()` call. The existing `showSocialTab()`, `showAutomationTab()`, etc. functions continue to work -- only the rendering changes from button-style tabs to pill-style.

### Sidebar HTML Change

Replace the existing 20-item sidebar HTML with the 6-group structure. Each group item has:
- `data-group` attribute with group name
- Click handler: `showSectionLanding(group)` (or direct navigate in expanded mode)
- Chevron icon for expanded mode toggle

---

## Files Modified

| File | Changes |
|------|---------|
| `RoweOS/dist/index.html` | Sidebar HTML restructure, landing page template + renderer, pill nav CSS + JS, replace all tab bars, breadcrumb updates, settings toggle |

## Execution Order

1. CSS: Add pill nav styles and landing page styles
2. JS: `renderPillNav()` component
3. JS: `showSectionLanding()` component with split-panel template
4. Sidebar HTML: Replace 20-item sidebar with 6-group structure
5. Sidebar JS: Expanded mode with collapsible sub-items
6. Migration: Replace each view's tab bar with pill nav (Social Hub, Automations, Mail, etc.)
7. Mobile: Add overflow-x scroll to pill nav on small screens
8. Settings: Add sidebar mode toggle
9. Onboarding: Add simple/advanced choice

## Out of Scope

- "Always Launch To" per-section shortcut (future feature)
- Changes to the mobile floating glass nav
- Redesigning individual view content (only navigation/chrome changes)
- New features or functionality -- purely navigation/UX restructuring
- URL hash routing / deep linking (current app uses showView() with no URL updates)
- Animations/transitions for landing page entry or pill switching (keep simple show/hide for now)
