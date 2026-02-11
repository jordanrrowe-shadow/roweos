# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## QUICK REFERENCE

```
Version:  v15.9
File:     ~/Downloads/RoweOS/dist/index.html (115456 lines)
Live:     roweos.vercel.app
```

### Deploy to Production
```bash
./deploy.sh
```
This script automatically:
1. Extracts version from `ROWEOS_VERSION` JS constant in index.html
2. Updates CLAUDE.md with current version/line count
3. Commits changes to git
4. Pushes to origin/main
5. Deploys to Vercel production

**Manual deploy** (if needed):
```bash
cd RoweOS/dist && npx vercel --prod
```
Must execute with ZERO prompts. If Vercel asks "Set up and deploy?" the ZIP is missing `.vercel/` folder.

### Critical Rules
1. **Brand names:** Always use `brands[idx].shortName || brands[idx].name` — never `.name` alone
2. **No emoji:** Always use inline SVG icons
3. **ES5 only:** No arrow functions, no let/const, no template literals
4. **Bracket balance:** One missing bracket breaks the entire 115K-line file (pre-existing 3-brace gap is normal — `{` count is ~3 less than `}` count due to HTML/CSS contexts)
5. **Logo injection:** Use `document.createElement('img')` — never innerHTML for user-provided base64 logos
6. **Init ordering:** `initBrandAccentColor()` and `initBrandLogo()` run before brand selector is set — must re-call after brand restoration

### File Structure
```
index.html
├── Lines 1–15,000      CSS (themes, components, animations)
├── Lines 15,000–44,000 HTML (views, modals, overlays)
└── Lines 44,000–115456 JavaScript (state, API, logic)
```

---

## PROJECT CONTEXT

**RoweOS** — "Operating intelligence, built for brands."
Owner: Jordan · The Rowe Collection LLC · Austin, Texas

A private AI platform with two modes:
- **BrandAI Mode** — Business management with 4 specialized agents (Strategy, Marketing, Operations, Documents)
- **LifeAI Mode** — Personal life management with coach archetypes (Life Coach, Wellness Coach, Tax Copilot, etc.)

### Architecture
- Single-file HTML application — no build tools, no bundler, no framework
- Pure vanilla HTML/CSS/JS
- CDN dependencies: Firebase SDK, Marked.js
- Direct browser API calls to Anthropic/OpenAI/Google (keys in localStorage)
- Optional Firebase sync (user-configured) — syncs brands, conversations, settings, inventory, calendar, automations, library, pulse, todos. **API keys are NOT synced** (security). Settings toggles (cache, web search, auto-pilot) ARE synced in `profile.settings`.

### Design Philosophy
- "Quiet competence" — professional elegance, no hype
- Apple-like restraint — minimalist, dark theme default
- Glass morphism: `backdrop-filter: blur(20px)`
- Gold accents (#a89878) — per-brand customizable via `--brand-accent` CSS variable

---

## BRAND PORTFOLIO

| Index | Brand | Short Name | Description |
|-------|-------|------------|-------------|
| 0 | The Rowe Collection | TRC | Parent luxury brand portfolio |
| 1 | Rowe Solo Training | Solo | Service dog certification |
| 2 | Rowe Retreats | Retreats | Luxury Airbnb in The Domain, Austin |
| 3 | Rowe Reserve | Reserve | Private concierge services |
| 4 | Rowe & Co. | R&Co | Custom goods and craftsmanship |

Brand knowledge stored in `defaultBrandKnowledge` (name, tagline, essence, voice, audience, messaging, visual identity, positioning).

---

## CODING STANDARDS

### JavaScript (ES5 Required)
```javascript
// ✅ CORRECT
var items = data.filter(function(d) { return d.active; });
function renderView() { /* ... */ }
if (element && element.style) { element.style.display = 'none'; }

// ❌ WRONG
const items = data.filter(d => d.active);
let count = items.length;
```

### Requirements
- Explicit `function` declarations (not `var fn = function`)
- Full null/undefined safety before property access
- HTML escaping for all user input in innerHTML
- Wrap localStorage reads and API calls in try/catch
- Tag changes with version: `// v12.2: Fix brand name`

### CSS
- Use CSS custom properties (`var(--accent)`) for theme values
- Light mode via `html.light-mode` selector
- Mode targeting via `html.brand-mode` / `html.life-mode` (set early in init)
- Mobile breakpoint: `@media (max-width: 768px)`
- Avoid `!important` except to override JS inline styles

### Brand Color System
- Default gold: `#a89878` (RGB 168, 152, 120)
- CSS variables: `--brand-accent`, `--brand-accent-dark`, `--brand-accent-light`, `--brand-accent-rgb`, `--brand-accent-10` through `--brand-accent-70`
- `applyBrandAccentColor(color)` sets both `--brand-accent-*` AND `--accent-*` variables
- `applyCurrentBrandAccent()` reads current brand's color and applies it
- Per-brand colors stored in `brands[idx].brandColor` (dark) / `brands[idx].brandColorLight` (light)
- Logo container: `.sidebar-collapsed-logo` is active display; `#mainLogo` is kept hidden

### SVG Icons (Never Emoji)
```html
<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
  <path d="..."/>
</svg>
```
- ViewBox: `0 0 24 24`
- Stroke width: `1.5` or `2`
- Sizes: 14px (small), 16px (default), 20px (large)

---

## DEPLOYMENT

### ZIP Structure (Must Be Exact)
```
RoweOS.zip
└── RoweOS/
    └── dist/
        ├── .vercel/project.json    ← Required for zero-prompt deploy
        ├── icons/
        ├── index.html
        ├── manifest.json
        ├── vercel.json
        ├── favicon.ico
        └── apple-touch-icon.png
```

### Version Updates
```bash
# Update version everywhere (macOS) — use two-part format (v15.6, not v15.6.0)
sed -i '' 's/v15.5/v15.6/g' index.html

# Verify update
grep -c 'v15\.5' index.html  # Should be 0
grep -c 'v15\.6' index.html  # Should be 30+
```

Version appears in: `ROWEOS_VERSION` constant, launch screen, mobile header, settings, sidebar footer, console logs, comments. (Not in `<title>` — title is just "RoweOS - Intelligence Platform".)

### Delivery Checklist
1. RoweOS.zip with correct structure (RoweOS/dist/, not bare dist/)
2. Version updated in ALL locations
3. Brief changelog
4. Deploy command as copyable text

---

## APP STRUCTURE

### Views (data-view → Panel ID)

| Nav Item | data-view | Panel ID | Purpose |
|----------|-----------|----------|---------|
| Chat | agent | agentView | Main AI interface |
| Signal | signal | signalView | Dashboard/analytics |
| Pulse | pulse | pulseView | Goals tracking |
| Studio | studio | studioView | Operations/tools |
| Rhythm | rhythm | rhythmView | Calendar |
| Library | library | libraryView | Documents |
| Memory | memory | memoryView | Knowledge base |
| Identity | tuning | tuningView | Brand config |
| Settings | settings | settingsView | App config |
| Inventory | inventory | inventoryView | Products |
| Commerce | commerce | commerceView | Analytics & business |

```javascript
showView('agent');  // Switch view, update sidebar, breadcrumbs, title
```

### Commerce Tabs (showCommerceTab)

| Tab | ID | Content |
|-----|----|---------|
| Overview | overview | Summary cards, model comparison chart, model breakdown table |
| API Costs | api | Provider status cards, settings toggles, cost dashboard |
| Invoices | invoices | Invoice list, builder with product picker, preview/print |
| Clients | clients | Client cards with logos, add modal with logo upload |
| Budget | budget | Monthly budget tracking (LifeAI) |

### BrandAI Agents

| Agent | ID | Color | Role |
|-------|-----|-------|------|
| Strategy | strategy | #a78bfa | Positioning, competitive intel |
| Marketing | marketing | #f472b6 | Content, campaigns |
| Operations | operations | #4ade80 | Workflows, efficiency |
| Documents | documents | #fbbf24 | Business writing |

### LifeAI Coaches
- Life Coach (`coach`) — Personal development
- Wellness Coach (`wellness`) — Health, fitness
- Tax Copilot (`taxcopilot`) — Financial planning
- Personal AI (`personal`) — General assistant
- Standard AI (`standard`) — Unfiltered

### Sidebar States
1. **Always Collapsed** — 64px, icons only
2. **Auto** — 64px collapsed, 220px on hover
3. **Always Pinned** — 220px permanent

Classes: `.sidebar`, `.sidebar.expanded`, `.sidebar.pinned`

---

## DATA REFERENCE

### Key localStorage Items

| Key | Description |
|-----|-------------|
| `roweos_brands` | Brands array |
| `roweos_api_keys` | API keys object |
| `roweos_mode` | 'brand' or 'life' |
| `roweos_conversations` | Chat history |
| `roweos_theme` | 'dark' or 'light' |
| `roweos_sidebar_behavior` | 'always-collapsed', 'auto', 'always-pinned' |
| `roweos_selected_brand` | Last selected brand index (persists across reload) |
| `roweos_app_mode` | Primary mode key: 'brand' or 'life' |
| `brand_0` through `brand_4` | Per-brand knowledge |
| `brandMemory` | Uploaded knowledge |
| `roweos_analytics` | API usage entries (provider, model, tokens, cost, cached) |
| `roweos_invoices` | Invoice array (number, client, lineItems, total, status) |
| `roweos_clients` | Client array (name, email, company, phone, logo) |
| `roweos_inventory` | Products/services `{items: [], categories: []}` |
| `roweos_response_cache` | Cached API responses (1hr TTL, max 100) |
| `roweos_feature_responseCache` | Cache toggle ('true'/'false') |
| `roweos_feature_autoPilot` | Auto-pilot toggle ('true'/'false') |
| `roweos_claude_web_search` | Claude web search toggle |
| `roweos_gemini_web_search` | Gemini web search toggle |

### Key Functions

| Function | Purpose |
|----------|---------|
| `showView(name)` | Switch views |
| `sendAgentMessage()` | Send chat message |
| `buildSystemPromptForBrand()` | Construct BrandAI prompt |
| `buildLifeAISystemPrompt()` | Construct LifeAI prompt |
| `onBrandChange()` | Handle brand switch |
| `updateBrandName()` | Update sidebar (uses shortName) |
| `toggleMode()` | Switch BrandAI/LifeAI |
| `showToast(msg, type)` | Notifications |
| `escapeHtml(str)` | Sanitize for innerHTML |
| `applyBrandAccentColor(color)` | Set brand color CSS variables |
| `applyCurrentBrandAccent()` | Apply current brand's accent color |
| `loadCurrentLogo()` | Load brand/life logo from storage |
| `initBrandAccentColor()` | Init brand color on page load |
| `switchToBrandMode()` | Switch from LifeAI to BrandAI |
| `switchToLifeMode()` | Switch from BrandAI to LifeAI |
| `showCommerceTab(tab)` | Switch Commerce sub-tabs |
| `renderCommerceOverview()` | Analytics overview dashboard |
| `renderApiProviderStatus()` | Live API key status cards |
| `renderApiCostsDashboard(period)` | API cost charts/tables |
| `viewInvoice(id)` | Invoice preview with logos |
| `printInvoice(id)` | Print invoice in new window |
| `openInvoiceProductPicker()` | Browse inventory for invoice items |
| `calculatePeriodStats()` | Aggregate analytics by time period |
| `trackAPIUsage(params)` | Log API call to analytics |
| `syncToFirebaseV2()` | Full Firebase sync (all categories) |

---

## TROUBLESHOOTING

### Pre-Deployment Validation
```bash
# 1. Bracket balance (must match)
echo "{ count: $(grep -o '{' index.html | wc -l | tr -d ' ')"
echo "} count: $(grep -o '}' index.html | wc -l | tr -d ' ')"

# 2. Version consistency
grep -o 'v[0-9]*\.[0-9]*\.[0-9]*' index.html | sort | uniq -c

# 3. ZIP structure check
unzip -l RoweOS.zip | head -10
# First entry must be "RoweOS/" not "dist/"
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Vercel prompts for setup | Missing .vercel/ folder | Ensure .vercel/project.json is in ZIP |
| Blank page | JS syntax error | Check console, verify bracket balance |
| Brand shows full name | Using `.name` alone | Use `shortName \|\| name` |
| Theme not applying | Key mismatch | Check `roweos_theme` in localStorage |
| Sidebar logo too small | Missing CSS override | Add `!important` to logo sizing |

### Known Technical Debt
1. **Category card reorder not persisting** — `saveFocus2WidgetOrder()` saves widgets but not category cards
2. **Init ordering fragility** — `initBrandAccentColor()` and `initBrandLogo()` run before brand dropdown is populated; mitigated by re-calling after brand restoration, but ideally init order should be refactored
3. **5+ brand name update points** — All must use `shortName || name` pattern
4. **No automated tests** — All testing is manual
5. **Duplicate ROWEOS_VERSION** — Two declarations exist (line ~49443 for data migration, line ~50796 for current); keep both in sync

---

## JORDAN'S PREFERENCES

### Communication
- Direct and efficient — skip preamble
- Show work, explain reasoning briefly
- Don't ask permission on obvious fixes
- Deploy command as copyable text, never as a file

### Delivery
- Always RoweOS.zip (never loose files)
- Changelog with every delivery
- Version updated everywhere
- Deploy command at the bottom

### Code
- Surgical edits over full rewrites
- Comprehensive null checks
- Version comments on changes
- No new dependencies without explanation

### Annoyances
- Emoji in the app
- Vercel prompting for setup
- Brand name showing full name
- Suggesting `--yes` flag instead of fixing root cause
- Breaking existing features
- Missing version references

---

## PLUGINS & WORKFLOW AUTOMATION

Claude Code plugins are installed and should be used automatically based on context. Match user intent to the right plugin — don't wait to be asked by name.

### When to Use Each Plugin

| Plugin | Trigger Context | Command/Skill |
|--------|----------------|---------------|
| **feature-dev** | "add [feature]", "build [feature]", new functionality requests, version updates with multiple features | `/feature-dev` |
| **commit-commands** | "commit", "push", "create PR", "ship it", done with changes | `/commit`, `/commit-push-pr` |
| **vercel** | "deploy", "check logs", "setup vercel", post-version deployment | `/deploy`, `/logs`, `/setup` |
| **claude-md-management** | "update claude.md", end of version update sessions, after significant discoveries | `/revise-claude-md` |
| **frontend-design** | "redesign", "improve UI", "make it look better", visual/layout changes | Activates automatically for UI work |
| **greptile** | PR review, code review requests | MCP tools (requires GREPTILE_API_KEY) |
| **serena** | "analyze code", semantic navigation, refactoring analysis | MCP tools (requires uvx/Python) |

### Version Update Workflow

For version updates (e.g., "let's do v15.3"), use plugins in this order:

1. **feature-dev** `/feature-dev` — Plan and architect the changes (discovery, exploration, design phases)
2. **frontend-design** — Activate for any UI/visual changes during implementation
3. **commit-commands** `/commit` — Commit completed changes
4. **vercel** `/deploy` — Deploy to production (or use `./deploy.sh` which also handles git)
5. **claude-md-management** `/revise-claude-md` — Capture learnings and update CLAUDE.md

### Guidelines
- Use `/feature-dev` for any non-trivial feature work — it enforces structured thinking
- Use `/commit` instead of manual git commands for cleaner workflow
- Run `/revise-claude-md` at the end of major sessions to keep project memory current
- frontend-design skill should inform all UI changes to avoid generic patterns
- Always prefer `./deploy.sh` over `/deploy` unless deploy.sh is broken — it handles version sync + git + Vercel in one step
