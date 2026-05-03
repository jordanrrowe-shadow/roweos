# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## QUICK REFERENCE

```
Version:  v34.102
File:     src/ (modular source) → builds to RoweOS/dist/index.html
Live:     roweos.com
```

### Deploy to Production
```bash
bash src/build.sh && ./deploy.sh
```
Handles: version sync, git commit+push, Vercel deploy. Manual fallback:
`cd RoweOS/dist && npx vercel --prod` (needs `.vercel/project.json` or it prompts).

### Pre-deploy audit (MANDATORY before every production deploy)
Visual regressions and mechanical drift must be caught BEFORE shipping.
The ritual:

1. **Run mechanical checks**: `bash scripts/pre-deploy-audit.sh`
   Verifies version consistency across the 8 bump locations, build succeeds,
   the 278-test suite passes, no ES5 violations / forbidden patterns.
   Exits 1 on failure.
2. **Spot-check the audit warnings** (em-dashes in user-facing copy,
   stark `#fff` / `var(--bg-elevated)` slabs in light-mode wrappers).
   Comments don't count for em-dashes. Subtle rgba tints don't count
   for stark white.
3. Only after the script passes should `./deploy.sh` run.
4. After every UI change, sanity-check the surface in the browser
   before reporting the task done.

### Critical Rules
1. **Brand names:** Always `brands[idx].shortName || brands[idx].name`
2. **No emoji in app:** Always inline SVG icons
3. **ES5 only in `src/js/core/*` and `src/js/late/*`:** No arrow functions,
   `let`/`const`, template literals. TS allowed only in `services/*` + tests.
4. **No em-dashes in user-facing copy:** Use ` - ` or rewrite. Comments
   are exempt.
5. **Logo injection:** `document.createElement('img')` — never innerHTML
   for base64.
6. **Init ordering:** `initBrandAccentColor()` / `initBrandLogo()` run
   before brand selector — re-call after restoration.
7. **Bracket balance:** Pre-existing ~2-3 brace gap is normal (HTML/CSS/string
   contexts). Don't chase it.

### Version bump (8 locations + CLAUDE.md + CHANGELOG)
On every change, update the version string in:
1. `src/js/core/09-state.js` — `ROWEOS_VERSION` constant
2. `src/html/core/04-views-batch3.html` — sidebar version span
3. `src/html/core/04-views-batch3.html` — onboarding "v34.X" footer
4. `src/html/core/04-views-batch3.html` — onboarding version tag
5. `src/html/core/03-views-batch2.html` — launch screen
6. `src/html/core/03-views-batch2.html` — mobile version display
7. `src/html/shared/21-settings.html` — settings row
8. `CLAUDE.md` — this file's "Version:" line
Plus add a `## v34.X` entry to the top of `CHANGELOG.md`.
Never use `replace_all` on the version string. Audit verifies all 8.

### File Structure (Modular Source)
Source code lives in src/, built into RoweOS/dist/index.html by src/build.sh

```
src/css/           CSS (core themes, components, view-specific styles)
src/html/          HTML (head, shell, views organized by brand/life/shared)
src/js/core/       Core JS (foundation, state, sync, agents, features)
src/js/late/       Late JS (API bridge, mail/messaging)
src/build.sh       Concatenation build script
src/verify.sh      Diff verifier against reference

Key JS files:
  08-foundation.js          Store API, utils, constants, modal system
  09-state.js               Brand state, data initialization, ROWEOS_VERSION
  10-sync.js                Sync engine v4
  11-agents.js              BrandAI agent system, model switching, onBrandChange
  12-library.js             File library, Studio config panel
  13-studio.js              Studio panels, streaming, deep research
  14-calendar.js            Calendar view, external integrations, write-back
  16-bloom.js               Bloom AI brand feed
  17-automations.js         Automations lab, folio
  18-social.js              Social media integration
  19-journal.js             Journal, inline automations
  20-ui-misc.js             Chat dispatch, dropdowns, misc UI
  21-sidebar.js             Liquid glass navigation
  22-firebase-sync.js       Firebase v4 sync engine, IndexedDB, admin
  23-offline.js             Offline support
  25-documents-lifeai.js    LifeAI documents
  29-analytics-commerce.js  Analytics dashboard, clients pipeline
  30-automations-init.js    Scheduler dispatch, evolve nightly hook
  33-scribe.js              Notebook editor, TinyMCE init
  34-brilli.js              Brilli orb forms + state machine
  35-sync-v5.js             Sync v5 facade + dual-write hooks
  36-evolve.js              Evolve view (Today / Practice / Translate / Verify / Skills)
  38-quiz-engine.js         Multi-model adaptive quiz pipeline
  39-verifier-engine.js     Two-pass deep verification
  43-thought-board.js       Cross-surface pin board
  49-timeline-tree.js       Brilliance branching history timeline
  50-lifeai-features.js     LifeAI parity (people, custom ops, analytics)
  52-knowledge-engine.js    BrillianceKnowledge — full-system context for AI
```

### Editing Rules
- Edit `src/` files only — NEVER edit `RoweOS/dist/index.html` directly
  (it's generated).
- After any edit: run `bash src/build.sh` to regenerate index.html.
- New features: create new file in `src/js/core/` with appropriate numeric
  prefix.
- CSS changes: edit `src/css/core/01-base.css`.
- HTML view changes: find the view in `src/html/brand/`, `life/`, or `shared/`.

---

## PROJECT CONTEXT

**RoweOS** — branded as **Brilliance** in user-facing surfaces.
"Operating intelligence, built for brands."
Owner: Jordan — The Rowe Collection LLC — Austin, Texas.
10 paying clients in production. Data integrity is non-negotiable.

A private AI platform with two modes:
- **Brand Intelligence (BrandAI)** — Business management with specialized
  agents (Strategy, Marketing, Operations, Documents, Intelligence, Research).
- **Life Intelligence (LifeAI)** — Personal life management with coach
  archetypes (Life, Wellness, Tax, Personal, Standard).

### Architecture
- Modular source (src/) concatenated into a single HTML file. No bundler,
  no framework. Build step is plain `cat`.
- Pure vanilla HTML/CSS/JS, CDN deps: Firebase SDK, Marked.js, TinyMCE.
- Direct browser API calls to Anthropic / OpenAI / Google (keys in
  localStorage).
- Firebase write-through: every save hits localStorage AND Firestore
  immediately. Cloud-authoritative on pull.

### Design Philosophy
- "Quiet competence" — professional elegance, Apple-like restraint.
- Dark theme default; warm cream `#f5f3ee` light mode.
- Gold accent `#a89878` — per-brand customizable via `--brand-accent`.

---

## BRAND PORTFOLIO

| Index | Brand | Short Name | Description |
|-------|-------|------------|-------------|
| 0 | The Rowe Collection | TRC | Parent luxury brand portfolio |
| 1 | Rowe Solo Training | Solo | Service dog certification |
| 2 | Rowe Retreats | Retreats | Luxury Airbnb in The Domain, Austin |
| 3 | Rowe Reserve | Reserve | Private concierge services |
| 4 | Rowe & Co. | R&Co | Custom goods and craftsmanship |

---

## CODING STANDARDS

### JavaScript (ES5 in core/late, TS in services/tests)
```javascript
// CORRECT — ES5
var items = data.filter(function(d) { return d.active; });
function renderView() { /* ... */ }

// WRONG
const items = data.filter(d => d.active);
```

Requirements:
- Explicit `function` declarations (not `var fn = function`).
- Null/undefined safety before property access.
- HTML escaping (`escapeHtml`) for user input in innerHTML.
- Wrap localStorage reads + API calls in try/catch.
- Tag changes with version in a comment: `// v34.X: <reason>`.

### CSS
- CSS custom properties (`var(--accent)`) for theme values.
- Light mode: `html.light-mode`. Mode classes: `html.brand-mode` /
  `html.life-mode`.
- Mobile breakpoint: `@media (max-width: 768px)`.
- Light-mode `--bg-elevated` and `--bg-tertiary` are cream-tinted
  (`#faf7f0`, `#fbf9f3`) — NOT `#fff`. Don't reintroduce stark white.

### Brand Color System
- Default gold: `#a89878`.
- CSS vars: `--brand-accent`, `--brand-accent-rgb`, `--brand-accent-10`
  through `--brand-accent-70`.
- `applyBrandAccentColor(color)` sets both `--brand-accent-*` AND
  `--accent-*`.
- Per-brand: `brands[idx].brandColor` (dark) / `brands[idx].brandColorLight`
  (light).

### SVG Icons (Never Emoji)
- ViewBox: `0 0 24 24`, stroke-width: `1.5` or `2`.
- Sizes: 14px small, 16px default, 20px large.

---

## KEY SUBSYSTEMS

### Sync Architecture (v34.x — v4 source-of-truth, v5 staged)

**Two layers in parallel.** Spec: `docs/brilliance/16-sync-v5.md`. Active
migration plan: `memory/project_sync_v5_migration.md`.

**v4 (source-of-truth):**
- Write-through: every save hits localStorage + Firestore simultaneously.
- Cloud always wins on pull. `mergeByTimestamp()` resolves per-item
  conflicts using `_modifiedAt`.
- `safeSyncWrite()` applies cloud data unconditionally (empty = deleted).
- `manualSyncNow()` pushes brands first (3s wait), then pulls.
- Brands use stable ID doc paths. `saveBrands()` fetches existing docs
  FIRST, then batch writes + deletes ghosts atomically.
- `_all` doc saves ALL brand fields, never a subset. Individual docs
  preferred over `_all` on pull.
- Theme is device-local; cloud only seeds on first load.

**v5 (scaffolded + dual-write hooks behind 4 flags):**
- Universal envelope:
  `{ id, data, _modifiedAt, _createdAt, _deletedAt, _clientId, _schemaVersion }`.
- Per-collection `Collection<T>` instances in `35-sync-v5.js` `V5_REGISTRY`
  (26 collections).
- Last-write-wins by `_modifiedAt`, ties broken by `_clientId`
  lexicographic.
- Continuous `onSnapshot` per collection. Tombstones via `_deletedAt`.
  `runTombstoneGC` Cloud Function GCs envelopes older than 30d.
- `mirrorV4Write(collection, id, data)` is called from every v4 write
  path. No-op when `roweos_sync_v5_dual_write` is OFF.
- `runSyncV5Audit` Cloud Function compares v4 vs v5 daily and writes
  drift to `sync_v5_audit/{uid}/discrepancies`. Admin dashboard at
  Settings → Sync v5 → "View audit".

**Four flags:**
1. `roweos_sync_v5` — read-shadow on. Default OFF.
2. `roweos_sync_v5_writes` — v5-native cloud writes. Default OFF.
3. `roweos_sync_v5_dual_write` — v4 writes mirror to v5. Default OFF.
4. `roweos_sync_v5_reads` — reads come from v5. Default OFF.

**When changing sync code:**
- Touch v4 paths normally — they remain source-of-truth.
- ALSO ensure v5 mirror happens. `writeDB` and `writeDBDoc` already
  do this; direct `db.batch()` calls (like `saveBrands`) need an
  inline `SyncV5.mirrorV4Write(coll, id, data)` after the `batch.set`.
- New collections need a row in `V5_REGISTRY` and matching entry in
  `_v5Map` / `_subMap` in `09-state.js`.
- Read sites: prefer `SyncV5.readArray('X_v5', () => v4Read())` over
  direct localStorage reads — gives a binary cutover gate.
- **CRITICAL:** `_all` doc must NEVER save a subset of fields. Caused
  silent data loss historically.

### Brilliance Knowledge Engine (v34.78)

`window.BrillianceKnowledge` in `52-knowledge-engine.js`. Single source
of truth for "what does the system know about the user right now".

- `BrillianceKnowledge.build({ includeContent, maxBytes })` — JSON
  snapshot across 18 surfaces (identity, pulse, reminders, automations,
  mail, people, notebooks, calendar, bloom, folio, library, studio,
  conversations, commerce, social, evolve, thought board, system).
  Soft-budgeted (~15k tokens), drops heaviest sections when over.
- `BrillianceKnowledge.capabilities()` — capability manifest string.
  Prepended on every chat call so the AI knows what surfaces and
  actions exist.
- `BrillianceKnowledge.shouldAttach(query)` — heuristic for knowledge
  questions. When true, the full snapshot is attached.
- `BrillianceKnowledge.preamble({ ... })` — convenience wrapper:
  capabilities + snapshot as a single ready-to-prepend string.

Wired into Universal Search (`searchWithAI` in `27-launch-brandai.js`)
and the three chat dispatch paths in `20-ui-misc.js`. Mode-aware
(brand vs life), brand-index aware, life-profile-index aware. Never
exposes API keys / tokens / access keys.

### Evolve — Quiz + Verifier Engines (v34.79)

Both engines auto-activate when Evolve is on AND a target goal is set
AND an API key exists. Off-switches: `roweos_evolve_quiz_engine_off`
and `roweos_evolve_verifier_engine_off`.

**QuizEngine (`38-quiz-engine.js`)** — three live stages:
1. Gemini outline from `targetGoal` + `knownContext`.
2. Claude (or GPT-5.5) JSON quiz generation against the outline.
3. Schema validator gates the pool.

7-day pool TTL. `Evolve.setProfile()` wipes the pool whenever
`targetGoal` or `knownContext` changes. Practice tab also has a
"Regenerate" button + a render-time stale-content check (if cached
quiz has no goal-related word in topic/citation/question, wipe and
refill). Nightly automation `evolve_nightly_content` (3am cron)
dispatches `QuizEngine.refillPool()`.

**VerifierEngine (`39-verifier-engine.js`)** — two live passes:
1. Anthropic claim-check with verdict + citations.
2. A *different* provider (Google or OpenAI) runs adversarial
   skepticism on Pass 1.
3. Synthesis combines verdicts (`verified` / `corrected` /
   `insufficient`) and stitches both citation sets.

Verify tab UI shows verdict badge, combined reasoning, source
citations with clickable URLs, model lineup, confidence score.

### Universal Search (Hybrid)
- **⌘K** opens centered Spotlight modal (fast nav + actions + inline AI).
- **Magnifying glass icon** opens right side panel (rich AI results +
  notifications tab).
- 3 modes: AI (default), Navigate (fuzzy match), Actions (command
  patterns).
- Tab cycles modes, arrows navigate, Enter executes.
- Brand scoping: current brand or all brands toggle.
- Key functions: `executeSearch()`, `searchWithAI()`, `searchNavigate()`,
  `searchActions()`. `searchWithAI` now prepends the full Brilliance
  Knowledge preamble.

### Reminders + Push Notifications
- Data model: `{id, title, scheduledAt, status, snoozedUntil, actions, _modifiedAt}`.
- In-app checker every 30s (`checkDueReminders()`).
- Bottom-right popup stack (max 3 visible, rest queued).
- Action buttons: Talk to AI, Add to Pulse, Add to Focus, Snooze
  (15m / 30m / 1h / 3h / tomorrow), Complete.
- Can't dismiss until action taken.
- Web Push: VAPID key, service worker (sw.js), Firestore subscriptions.

### Calendar (Multi-Platform Write-Back)
- Horizontal event cards with color-coded left borders per source.
- "Calendars" panel: toggle visibility, custom color picker per
  calendar. As of v34.81 this panel and the System → Connections
  "My Calendars" list both render as a responsive grid of compact
  tiles instead of a vertical row list.
- Available in BOTH brand mode AND life mode (life parity added
  v34.81).
- +N overflow badge on days with >3 events.
- "Push to" calendar picker on event creation.
- Write-back: Google (existing), Outlook (MS Graph), iCloud (CalDAV
  via `/api/caldav-proxy`).
- Colors stored in `roweos_calendar_colors`, synced to Firestore.

### Bloom Launch Popup
- "What would you like to explore?" modal on Bloom launch.
- Content types: Text, Info Graphics, Videos.
- Optional topic input with suggested topics from brand/goals.
- Generates custom 20-post batch via
  `bloomGenerateWithDirective(type, topic)`.

---

## DEPLOYMENT

### Version format
Two-part: `v34.84`, not `v34.84.0`. Appears in the 8 bump locations
above plus comments. NOT in `<title>`.

### Delivery checklist
1. RoweOS.zip (RoweOS/dist/, not bare dist/) — only when shipping
   outside the live deploy.
2. Version updated in all 8 locations + CLAUDE.md + CHANGELOG.
3. Brief changelog entry.
4. Deploy command as copyable text (never as a file).

---

## APP STRUCTURE

### Views (data-view → Panel ID)

| Nav Item | data-view | Panel ID |
|----------|-----------|----------|
| Chat | agent | agentView |
| Pulse | pulse | pulseView |
| Studio | studio | studioView |
| Rhythm | rhythm | rhythmView |
| Library | library | libraryView |
| Memory (History) | tuning | tuningView |
| Identity | memory | memoryView |
| Settings | settings | settingsView |
| Inventory | inventory | inventoryView |
| Clients (People) | clients | clientsView |
| Analytics | commerce | commerceView |
| Admin | admin | adminView |
| Mail | mail | mailView |
| Folio | folio | folioView |
| Social Hub | social | socialView |
| Bloom | bloom | bloomView |
| Automations | automations | automationsView |
| Notebooks (Scribe) | scribe | scribeView |
| Evolve | evolve | evolveView |
| Thought Board | board | boardView |
| Section Landing | sectionLanding | sectionLandingView |

Notes:
- Analytics was renamed from Commerce in v15.15; internal IDs stay `commerce*`.
- Identity uses internal `memory` data-view; History uses internal `tuning`.
- Admin view is admin-only — hidden nav item, `showView('admin')`
  redirects non-admins to Settings.
- Focus/Signal RETIRED (v28.8). `showView('signal')` redirects to Pulse.
  Liquid nav uses `scribe` instead of `signal`.
- Mail view tabs: Outbox, Sent, Compose, Inbox (Gmail/Outlook), Settings.
  localStorage: `roweos_mail_outbox`, `roweos_mail_sent`, `roweos_mail_config`.
  Firebase: `profile/mail`.

### BrandAI Agents
Strategy `#a78bfa` · Marketing `#f472b6` · Operations `#4ade80` ·
Documents `#fbbf24` · Intelligence `#22d3ee`

### LifeAI Coaches
Life Coach · Wellness Coach · Tax Copilot · Personal AI · Standard AI

### Sidebar States
Always Collapsed (64px) | Auto (64px / 220px hover) | Always Pinned (220px)

### Navigation System (v26.0)
- **Sidebar modes:** Grouped (6 groups, default) and Expanded (original
  20 items). Toggle in Settings → Preferences. Stored in
  `localStorage['roweos_sidebar_mode']`.
- **Two sidebar navs:** `#sidebarNav` (grouped) and `#sidebarNavExpanded`.
  `applySidebarMode()` toggles visibility.
- **Landing pages:** `_pageLandingConfigs` defines per-view landing pages.
  `showPageLanding(viewId)` renders. `enterPageSubSection(viewId, tabId)`
  navigates from landing.
- **Pill nav:** `renderPillNav(containerId, items, activeId, onSelect)`.
- **Tab handler wrappers must NOT call `showView()`** —
  `enterPageSubSection()` already does. Double-call resets the view.
- **`sectionLandingView` must be in the `allViews` array** in `showView()`.
- **Sidebar CSS selectors:** When adding a new fixed-position view, add
  it to ALL THREE: `html.sidebar-pinned`, `html.sidebar-hover-expanded`,
  `html.sidebar-pinned-collapsed`. Missing any = content bleeds behind
  sidebar.

---

## DATA REFERENCE

Detailed localStorage keys, Firebase sync details, brand selector sync,
API key routing, and identity intelligence docs are in the
**`data-reference.md`** memory file.

Key patterns to remember without looking up:
- `showView('agent')` to switch views.
- `showToast(msg, type)` for notifications.
- `escapeHtml(str)` for innerHTML sanitization.
- `loadFromFirebaseV2()` for cloud pull (cloud-authoritative).
  `writeDB()` / `writeDBDoc()` / `deleteDBDoc()` for write-through.
  `manualSyncNow()` pushes brands first, then pulls.
- **JSON.parse safety:** Every `JSON.parse` expecting an array MUST
  guard with `Array.isArray()`. Non-array returns crash `.filter()/.map()`
  and silently break entire call chains.
- **Push/pull path matching:** When adding sync for a category, verify
  the push write path matches the cloud count read path. Mismatches
  cause "Push needed" that never resolves.
- **Writer/reader schema match:** When emptying a Firestore doc, the
  WRITE schema MUST match every reader's expected fields. Empty-array
  writes targeting the wrong field are silent no-ops that resurrect
  data on next pull.
- **Tombstones need ALL readers patched:** Adding a deletion tombstone
  requires filters in cloud merge, view render, sync inventory counts
  AND extractors, AND a startup scrub.
- **Storage shim async race:** `localStorage.getItem` on
  `roweos_auto_lab_images`, `roweos_conversations`, `roweos_library`
  returns `null` synchronously when offloaded to IndexedDB. UI
  rendering large data MUST use an in-memory cache backed by direct
  `_idbPut`/`_idbGet`.
- **Chat assistant turns with images:** Set `msg.imageUrl = dataUrl`,
  put plain text in `content`. `renderConversation` auto-injects
  the `<img>`. NEVER embed raw `<img>` HTML in `content` —
  `formatMessageContent` will escape it.
- **Email log endpoints need a writer:** Any new server endpoint
  sending mail MUST include a `writeEmailLog` call. Without it, sends
  never appear in the Campaigns dashboard.
- `getAccentFallback()` for accent color with fallback (replaces
  inline `getComputedStyle` calls).
- `AGENT_COLORS` global constant for agent color map.
- `ROWEOS_DEBUG` — `console.log` gated by
  `localStorage.getItem('roweos_debug') === 'true'`.
- `findOperationById(id)` — unified operation lookup across ops,
  generatedBrandOps, custom ops, lifeOps, generatedLifeOps.
- Automations dual storage: `roweos_automations` (localStorage) AND
  `getScheduledTasks()`/`saveScheduledTasks()` — both must be updated
  on save.
- `executeWorkflow(workflow)` — runs multi-step pipelines.
- `WORKFLOW_PRESETS` — predefined workflow templates.

### Automation History (3 stores — all must be written on execution)
- `roweos_auto_lab_history` — Automations Lab timeline (20K char limit per entry).
- `roweos_task_history` — used by Focus `viewCompletedAutomation()`.
- `roweos_completed_automations` — metadata only, used for completion badges.
- `saveTaskResult()`, `addAutoLabHistory()`, `addCompletedAutomation()`
  must be called from ALL execution paths.

### Social Connections (v18.0)
- Per-brand/per-life-profile: `getSocialKeyScope()` returns `_brand_N`
  or `_life_N`, appended to all social localStorage keys.
- Key pattern: `roweos_social_{platform}_connected_brand_2`.
- OAuth state encodes scope: `x_b2_abc123` (brand 2). UID appended as
  `~u:firebaseUid` for Firestore token storage on mobile.
- `social-callback.html` is a SEPARATE file — must be updated alongside
  `index.html` for any social key changes.
- **Dual posting paths:** Client `postToSocial()` reads tokens via
  `getSocialToken()` (Firestore `social_tokens` → localStorage). Server
  `executeSocialPost()` in `scheduler.js` reads from
  `socialConnections` → Firestore subcollection → legacy settings.
  When changing token storage, update BOTH paths.

### Tier / Access Key System
- `isAdmin()` — checks `firebaseUser.uid === ADMIN_UID`.
- `getUserTier()` — cached (5min TTL), returns
  `'free' | 'basic' | 'founder' | 'premium'`.
- `hasFeatureAccess(feature)` — tier-based gate.
- Trial flow: new users auto-assigned `founder` with 14-day expiry via
  `autoGenerateAccessKey()`. The user-facing access key gate has been
  hidden since v30.2; keys are emailed for safekeeping only.
- Firestore collections: `access_keys`, `roweos_users`, `brand_configs`.

---

## TROUBLESHOOTING

Detailed validation, known errors, and tech debt are in
**`troubleshooting.md`**.

### Cloud Functions Scheduler
- `getUserAutomations()` MUST include `doc.id` — executor needs `task.id`
  for locking and lastRun.
- `isTaskDue()` uses 30-minute window — tasks execute within 0-30min of
  scheduled time.
- `lastRun` written at START with `lastExecutor: 'cloud_running'` to
  prevent duplicates.
- Deploy: `FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions`.
- Logs: `firebase functions:log --only runScheduledTasks`.
- Pipeline email steps use cloud outbox: Functions write to
  `cloud_outbox`, client picks up and sends via OAuth.

### Social Hub
- All external API calls MUST go through proxies (CORS).
- Anthropic API from browser needs
  `anthropic-dangerous-direct-browser-access: true` header.
- `getSocialKeyScope()` reads from `localStorage`, not `selectedBrand`
  global (may be uninitialized).
- `postToSocial(platform, opts)` — set `window._socialPublisherContent`
  and `window._socialPublisherImage` globals before calling.

### Deploy fallback (when deploy.sh git push fails)
`export PATH="$HOME/.local/share/fnm:$PATH" && eval "$(fnm env)" && vercel --prod --yes`

### Common Bug Patterns
- **Sync data resurrection:** If deleted items reappear across devices:
  (1) `deleteBrand()` fires direct `.delete()` BEFORE `saveBrands()`,
  (2) `manualSyncNow()` pushes brands first (3s wait), then pulls,
  (3) `onSnapshot` listener has grace period check, (4) `_all` doc is
  updated immediately on delete. The `onSnapshot` listener is the #1
  source of resurrection.
- **`_all` doc data loss:** NEVER write a subset of brand fields to
  `_all`. `loadFromFirebaseV2` and `onSnapshot` prefer individual docs
  over `_all`. `_all` is fallback only.
- **Crashes breaking call chains:** View renders called from
  `onBrandChange()` must be wrapped in try/catch. A crash prevents all
  subsequent brand-change logic.
- **Mail outbox stale on other devices:** Outbox merge in
  `loadFromFirebaseV2` must be cloud-authoritative. Cloud `[]` means
  all items were sent.
- **Duplicate function names:** Single-file means later definitions
  silently overwrite earlier ones. Grep before adding.
- **NEVER touch `* { }` margin:** The global reset is
  `* { padding: 0; box-sizing: border-box; }` — do NOT add `margin: 0`
  to it. NEVER re-add `min-height: 100vh` or
  `padding-bottom: env(safe-area-inset-bottom)` to body.
- **iOS box-sizing reflow hacks (TWO locations):** (1) `DOMContentLoaded`
  toggles `box-sizing` off/on. (2) `visualViewport.resize` keyboard-close
  branch does the same after dismiss. BOTH required. NEVER remove either.
  Also NEVER remove `interactive-widget=resizes-content` from the
  viewport meta tag.
- **Mobile CSS debugging:** Connect Safari Web Inspector to the phone
  before guessing. Make ONE change per deploy to isolate fixes.
  Chromium / Playwright CANNOT reproduce iOS Safari layout bugs.
- **Stale nav heights:** Use
  `calc(70px + var(--mobile-safe-bottom))` for scroll padding on
  views/panels, `calc(50px + env(safe-area-inset-bottom, 0px))` for
  fixed inputs above nav.
- **NEVER use `height: -webkit-fill-available` on `html`:** Use
  `min-height: -webkit-fill-available; min-height: 100dvh` instead.
- **Adding a new view (6 touch points):** `allViews` array, 8 CSS groups,
  sidebar nav HTML, `showView()` handler, mobile panel-view CSS selector,
  light-mode mobile CSS selector. Use `class="panel-view hidden"` (NOT
  `class="view hidden"` or `style="display:none"`).
- **Interface Zoom (75-150%):** Uses `appContainer.style.zoom` on BOTH
  desktop and mobile. NEVER replace with CSS variable scaling or
  transform. NEVER add `calc(Npx * var(--zoom-scale))` patterns —
  they double-scale when CSS zoom is active.
- **PWA caching:** When mobile changes aren't showing after deploy, the
  user may need to delete and re-add the PWA. Installed web app caches
  aggressively.
- **PWA icons:** Must be RGB (no alpha) or macOS dock adds white border.
  Use sharp to flatten:
  `.flatten({ background: { r: 10, g: 10, b: 10 } }).removeAlpha()`.
- **Mobile panel edge-to-edge:** `.panel-view > .panel` has
  `padding-left/right: 0` on mobile. Direct children get padding via
  `.panel-view > .panel > * { padding-left/right: var(--space-4) }`.
- **Light-mode stark-white slabs (v34.76 / v34.77 lesson):**
  `--bg-elevated` and `--bg-tertiary` are cream-tinted, not pure white.
  Don't add `background: #fff` to wrapper containers in light-mode rules.
  Use `var(--bg-elevated)` or a subtle rgba.
- **Studio config panel layout (v34.80 lesson):** Don't insert
  `flex-basis: 100%` children into the no-wrap `.studio-v2-config-header`
  flex row — they squash siblings to character width. Mount cross-row
  content AFTER the header, not inside it.

---

## JORDAN'S PREFERENCES

- **Direct and efficient** — skip preamble, show work briefly.
- **Deploy command as copyable text**, never as a file.
- **Surgical edits over full rewrites.**
- **Always bump version** on every change — all 8 locations + CLAUDE.md
  + CHANGELOG before deploying.
- **No em-dashes** in user-facing text content. Use ` -` or rewrite.
- **NEVER use one-sided borders** for accents/highlights. Either
  highlight the entire card uniformly (full border, subtle background
  tint) or don't highlight at all.
- **10 real clients in production** — data integrity is critical.
  Never suggest console workarounds for bugs that affect all users.
- **Don't iterate deploys for the same bug** — investigate thoroughly
  (trace full async chain, check browser console) BEFORE applying
  fixes. Multiple failed patches erode trust.
- **Live URL is roweos.com** (not roweos.vercel.app).
- **Annoyances:** emoji in app, Vercel setup prompts, full brand names,
  breaking existing features.

---

## PLUGINS & WORKFLOW

Plugins activate based on context:
- `/feature-dev` — non-trivial features, version updates.
- `/commit`, `/commit-push-pr` — git workflow.
- `/deploy`, `/logs` — Vercel (prefer `./deploy.sh` over `/deploy`).
- `/revise-claude-md` — end-of-session CLAUDE.md updates.
- `/reflect` — end-of-session learning extraction.
- `frontend-design` — auto-activates for UI work.

Version update order: feature-dev → frontend-design → commit → deploy
→ revise-claude-md.
