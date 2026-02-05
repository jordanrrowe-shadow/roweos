# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## QUICK REFERENCE

```
Version:  v12.1.1
File:     ~/Downloads/RoweOS/dist/index.html (100842 lines)
Live:     roweos.vercel.app
```

### Deploy to Production
```bash
./deploy.sh
```
This script automatically:
1. Extracts version from index.html
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
4. **Bracket balance:** One missing bracket breaks the entire 96K-line file

### File Structure
```
index.html
├── Lines 1–15,000      CSS (themes, components, animations)
├── Lines 15,000–44,000 HTML (views, modals, overlays)
└── Lines 44,000–100842 JavaScript (state, API, logic)
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
- Optional Firebase sync (user-configured)

### Design Philosophy
- "Quiet competence" — professional elegance, no hype
- Apple-like restraint — minimalist, dark theme default
- Glass morphism: `backdrop-filter: blur(20px)`
- Gold accents (#d4af37)

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
- Tag changes with version: `// v12.1.1: Fix brand name`

### CSS
- Use CSS custom properties (`var(--accent)`) for theme values
- Light mode via `html.light-mode` selector
- Mobile breakpoint: `@media (max-width: 768px)`
- Avoid `!important` except to override JS inline styles

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
# Update version everywhere (macOS)
sed -i '' 's/v12.0.8/v12.0.9/g' index.html

# Verify update
grep -c 'v12.0.8' index.html  # Should be 0
grep -c 'v12\.0\.8' index.html  # Should be 10+
```

Version appears in: `<title>`, launch screen, mobile header, settings, sidebar footer, console logs, comments.

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
| Commerce | commerce | commerceView | Metrics |

```javascript
showView('agent');  // Switch view, update sidebar, breadcrumbs, title
```

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
| `brand_0` through `brand_4` | Per-brand knowledge |
| `brandMemory` | Uploaded knowledge |

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
2. **Logo internal whitespace** — JPEG has padding; compensated with CSS overrides
3. **5+ brand name update points** — All must use `shortName || name` pattern
4. **No automated tests** — All testing is manual

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
