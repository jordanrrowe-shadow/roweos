# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## QUICK REFERENCE

```
Version:  v21.0
File:     RoweOS/dist/index.html (136789 lines)
Live:     roweos.vercel.app
```

### Session Startup
At the beginning of each session, run:
```bash
serena start-mcp-server --language-backend JetBrains
```

### Deploy to Production
```bash
./deploy.sh
```
Handles: version sync to CLAUDE.md, git commit+push, Vercel deploy. Manual fallback: `cd RoweOS/dist && npx vercel --prod` (needs `.vercel/project.json` or it prompts).

### Critical Rules
1. **Brand names:** Always `brands[idx].shortName || brands[idx].name`
2. **No emoji:** Always inline SVG icons
3. **ES5 only:** No arrow functions, let/const, template literals
4. **Bracket balance:** Pre-existing ~2-3 brace gap is normal (HTML/CSS/string contexts)
5. **Logo injection:** `document.createElement('img')` — never innerHTML for base64
6. **Init ordering:** `initBrandAccentColor()` / `initBrandLogo()` run before brand selector — re-call after restoration

### File Structure
```
index.html
|- Lines 1-15,000      CSS (themes, components, animations)
|- Lines 15,000-44,000 HTML (views, modals, overlays)
|- Lines 44,000-117512 JavaScript (state, API, logic)
```

---

## PROJECT CONTEXT

**RoweOS** — "Operating intelligence, built for brands."
Owner: Jordan - The Rowe Collection LLC - Austin, Texas

A private AI platform with two modes:
- **BrandAI Mode** — Business management with 4 agents (Strategy, Marketing, Operations, Documents)
- **LifeAI Mode** — Personal life management with coach archetypes

### Architecture
- Single-file HTML app — no build tools, no bundler, no framework
- Pure vanilla HTML/CSS/JS, CDN deps: Firebase SDK, Marked.js
- Direct browser API calls to Anthropic/OpenAI/Google (keys in localStorage)
- Optional Firebase sync — syncs all data; API keys sync to secure subcollection when Cloud Scheduler enabled

### Design Philosophy
- "Quiet competence" — professional elegance, Apple-like restraint
- Dark theme default, glass morphism: `backdrop-filter: blur(20px)`
- Gold accent #a89878 — per-brand customizable via `--brand-accent`

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

### JavaScript (ES5 Required)
```javascript
// CORRECT
var items = data.filter(function(d) { return d.active; });
function renderView() { /* ... */ }

// WRONG
const items = data.filter(d => d.active);
```

### Requirements
- Explicit `function` declarations (not `var fn = function`)
- Null/undefined safety before property access
- HTML escaping for user input in innerHTML
- Wrap localStorage reads and API calls in try/catch
- Tag changes with version: `// v15.17: Fix sync`

### CSS
- CSS custom properties (`var(--accent)`) for theme values
- Light mode: `html.light-mode`, modes: `html.brand-mode` / `html.life-mode`
- Mobile: `@media (max-width: 768px)`

### Brand Color System
- Default gold: `#a89878`, CSS vars: `--brand-accent`, `--brand-accent-rgb`, `--brand-accent-10` through `--brand-accent-70`
- `applyBrandAccentColor(color)` sets both `--brand-accent-*` AND `--accent-*`
- Per-brand: `brands[idx].brandColor` (dark) / `brands[idx].brandColorLight` (light)

### SVG Icons (Never Emoji)
- ViewBox: `0 0 24 24`, stroke-width: `1.5` or `2`
- Sizes: 14px small, 16px default, 20px large

---

## DEPLOYMENT

### ZIP Structure
```
RoweOS.zip -> RoweOS/dist/ (with .vercel/project.json, index.html, vercel.json, etc.)
```

### Version Updates
Two-part format (v15.6, not v15.6.0). Version appears in: `ROWEOS_VERSION` constant, launch screen, mobile header, settings, sidebar footer, console logs, comments. Not in `<title>`.

### Delivery Checklist
1. RoweOS.zip (RoweOS/dist/, not bare dist/)
2. Version updated everywhere
3. Brief changelog
4. Deploy command as copyable text

---

## APP STRUCTURE

### Views (data-view -> Panel ID)

| Nav Item | data-view | Panel ID |
|----------|-----------|----------|
| Chat | agent | agentView |
| Signal | signal | signalView |
| Pulse | pulse | pulseView |
| Studio | studio | studioView |
| Rhythm | rhythm | rhythmView |
| Library | library | libraryView |
| Memory | memory | memoryView |
| Identity | tuning | tuningView |
| Settings | settings | settingsView |
| Inventory | inventory | inventoryView |
| Clients | clients | clientsView |
| Analytics | commerce | commerceView |

Analytics was renamed from Commerce in v15.15; internal IDs still `commerce*`.

### BrandAI Agents: Strategy (#a78bfa), Marketing (#f472b6), Operations (#4ade80), Documents (#fbbf24)
### LifeAI Coaches: Life Coach, Wellness Coach, Tax Copilot, Personal AI, Standard AI
### Sidebar: Always Collapsed (64px) | Auto (64px/220px hover) | Always Pinned (220px)

---

## DATA REFERENCE

Detailed localStorage keys, function tables, Firebase sync architecture, brand selector sync, API key routing, and identity intelligence docs are in the **`data-reference.md`** memory file. Read it when working on those systems.

Key patterns to remember without looking up:
- `showView('agent')` to switch views
- `showToast(msg, type)` for notifications
- `escapeHtml(str)` for innerHTML sanitization
- `syncToFirebaseV2()` for full sync, `scheduleAutoSync()` for debounced auto-sync
- `getAccentFallback()` for accent color with fallback (replaces inline `getComputedStyle` calls)
- `AGENT_COLORS` global constant for agent color map (strategy, marketing, operations, documents, coach, etc.)
- `ROWEOS_DEBUG` — `console.log` gated by `localStorage.getItem('roweos_debug') === 'true'`
- `findOperationById(id)` — unified operation lookup across ops, generatedBrandOps, custom ops, lifeOps, generatedLifeOps
- Automations dual storage: `roweos_automations` (localStorage) AND `getScheduledTasks()`/`saveScheduledTasks()` — both must be updated on save
- `executeWorkflow(workflow)` — runs multi-step pipelines; `executeWorkflowStep()` handles: post, studio, image, library, notify
- `WORKFLOW_PRESETS` — predefined multi-step workflow templates; `resolveTemplateVars()` resolves `{{stepN_output}}` between steps

### Automation History (3 stores — all must be written on execution)
- `roweos_auto_lab_history` — Automations Lab timeline (20K char limit per entry)
- `roweos_task_history` — Used by Focus `viewCompletedAutomation()` and result modals
- `roweos_completed_automations` — Metadata only (no result text), used for completion badges
- `saveTaskResult()` writes to `roweos_task_history` — must be called from ALL execution paths (AI, post, image, pipeline)
- `addAutoLabHistory()` writes to `roweos_auto_lab_history` — called from all paths
- `addCompletedAutomation()` writes to `roweos_completed_automations` — called from all paths

### Social Connections (v18.0)
- Per-brand/per-life-profile: `getSocialKeyScope()` returns `_brand_N` or `_life_N`, appended to all social localStorage keys
- Key pattern: `roweos_social_{platform}_connected_brand_2`, `roweos_social_token_x_life_0`, etc.
- OAuth state encodes scope: `x_b2_abc123` (brand 2), `threads_l1_xyz` (life 1). v20.12: UID appended as `~u:firebaseUid` for Firestore token storage on mobile
- `social-callback.html` is a SEPARATE file that writes scoped keys independently — must be updated alongside `index.html` for any social key changes
- `roweos_social_pending_context` — stores scope before OAuth popup, read by callback
- Migration flag: `roweos_social_migration_v18` — one-time copy of global keys to `_brand_0`
- **Dual posting paths (v20.12)**: Client `postToSocial()` reads tokens via `getSocialToken()` (Firestore `social_tokens` → localStorage). Server `executeSocialPost()` in `scheduler.js` reads from `socialConnections` → Firestore `social_tokens` subcollection → legacy settings. When changing token storage format, update BOTH paths.
- `social-auth.js` writes tokens to Firestore `social_tokens` subcollection during exchange (v20.12) — enables mobile PWA access despite localStorage partitioning

### Enterprise / Access Key System
- `isAdmin()` — checks `firebaseUser.uid === ADMIN_UID`
- `getUserTier()` — cached (5min TTL), returns `'free'|'basic'|'founder'|'premium'` (v20.3: `'pro'`/`'enterprise'` still work as aliases)
- `hasFeatureAccess(feature)` — tier-based gate: sync/export (basic), brandConfig/automations/social/focus/analytics/identity (founder), whiteLabel/multiUser/privateOnboarding (premium)
- `generateAccessKey(tier, note)` / `revokeAccessKey(key)` — admin-only
- `validateAccessKey(key)` / `linkAccessKeyToUser(key)` / `checkUserAccessKey()` — user flow
- `claimBrandConfig(code)` — loads shared brand config from Firestore `brand_configs/{code}`. Replace if no existing brands, merge if existing
- `adminGenerateBrandConfig()` — admin-only, snapshots current brands/settings/memory/customOps to Firestore
- `openShareBrandModal()` / `generateShareBrandLink()` — any signed-in user can share current brand (v20.4). Snapshots single brand to `brand_configs/{code}`
- `adminLoadBrandConfigs()` — lists all shared configs with usage counts
- URL join: `?join=CODE` → stored in `roweos_pending_join` → claimed **synchronously before routing** in `showStartupScreen()` (v20.4 timing fix — no more setTimeout race with onboarding)
- Settings: "Join Brand Config" input calls `joinBrandConfigFromSettings()`. "Share This Brand" row (v20.4) calls `openShareBrandModal()`
- Identity header: "Share" button (v20.4) visible when `firebaseUser` exists, brand mode only
- Firestore collections: `access_keys`, `roweos_users`, `brand_configs`

---

## TROUBLESHOOTING

Pre-deployment validation, common errors, and known technical debt are in the **`troubleshooting.md`** memory file. Read it when debugging or before deployment.

---

## JORDAN'S PREFERENCES

- Direct and efficient — skip preamble, show work briefly
- Deploy command as copyable text, never as a file
- Always RoweOS.zip delivery with changelog
- Surgical edits over full rewrites
- No new dependencies without explanation
- Annoyances: emoji in app, Vercel setup prompts, full brand names, breaking existing features

---

## PLUGINS & WORKFLOW

Plugins activate automatically based on context:
- `/feature-dev` — non-trivial features, version updates
- `/commit`, `/commit-push-pr` — git workflow
- `/deploy`, `/logs` — Vercel (prefer `./deploy.sh` over `/deploy`)
- `/revise-claude-md` — end-of-session CLAUDE.md updates
- `/reflect` — end-of-session learning extraction
- `frontend-design` — auto-activates for UI work

Version update order: feature-dev -> frontend-design -> commit -> deploy -> revise-claude-md
