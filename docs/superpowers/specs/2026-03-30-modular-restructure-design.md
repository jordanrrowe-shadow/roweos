# RoweOS Modular Restructure Design

**Date:** 2026-03-30
**Status:** Approved
**Goal:** Split the 196k-line monolithic `index.html` into ~50 source files with a concatenation build, preserving identical runtime behavior. Foundation for eventual V2 architecture.

---

## Problem

RoweOS is a single 196,240-line `index.html` containing all CSS, HTML, and JavaScript inline. At this scale:

- **AI tooling (A):** Context windows struggle with the full file; edits are slow and error-prone
- **Navigation (B):** Finding feature code requires scrolling through 196k lines
- **Deployment risk (C):** One bad edit anywhere can break the entire app
- **Parallel work (D):** Multiple agents/people cannot work on different features simultaneously without merge conflicts

## Approach

**Approach 1: Simple Split with concatenation build.** Split source into ~50 files organized by mode (BrandAI/LifeAI) and concern (CSS/HTML/JS). A bash build script concatenates them back into `index.html`. The deployed artifact is identical to today.

This is deliberately conservative -- no framework migration, no TypeScript, no module system. Still ES5, still vanilla, still global scope. The structure creates the foundation for the V2 modular architecture (TypeScript, React, config-driven agents) without requiring it yet.

## Source Directory Structure

```
/Volumes/roweOS/
  src/
    css/
      core/
        00-variables.css         :root tokens, theme vars (~500 lines)
        01-base.css              resets, typography, global styles
        02-components.css        buttons, cards, modals, drawers
        03-animations.css        keyframes, transitions
      brand/
        social-hub.css           Social media hub styles
        studio.css               Content studio styles
        pulse.css                Brand analytics styles
        folio.css                Portfolio styles
      life/
        focus.css                Focus timer styles
        rhythm.css               Music/rhythm styles
        library.css              Library/documents styles
        history.css              History/journal styles
      shared/
        blake.css                AI chat styles (both modes)
        landing.css              Landing pages, pills
        modals.css               Modal/overlay styles

    html/
      core/
        00-head.html             <!DOCTYPE> through opening <body>
        01-shell.html            sidebar, nav, toolbar, top bar
        99-footer.html           closing tags, service worker registration
      brand/
        social-hub.html
        studio.html
        pulse.html
        folio.html
      life/
        focus.html
        rhythm.html
        library.html
        history.html
      shared/
        blake.html               AI chat markup
        modals/
          settings.html
          onboarding.html
          brand-selector.html
          ai-config.html

    js/
      core/
        00-constants.js          ROWEOS_VERSION, config, feature flags
        01-state.js              global state, brand system, selectedBrand, mode switching
        02-auth.js               login, session, subscription check
        03-sync.js               Firebase sync v3.1, mergeByTimestamp, safeSyncWrite
        04-router.js             view switching, navigation, URL handling
        05-theme.js              dark/light mode, brand accent colors, mode themes
      brand/
        blake.js                 B.L.A.K.E. brand agent conversations
        agents.js                Strategy, Marketing, Ops, Docs, Intel, Research agents
        social-hub.js            Social media management
        studio.js                Content studio
        pulse.js                 Brand analytics
        folio.js                 Brand portfolio
        scavenger.js             Web search/research agent
      life/
        blake-life.js            B.L.A.K.E. life coach conversations
        coaches.js               Life coach archetypes
        focus.js                 Focus timer, deep work sessions
        rhythm.js                Music/rhythm player
        library.js               Personal documents/library
        history.js               Life history/journal
      shared/
        blake-core.js            Shared AI chat engine, model switching, streaming
        sidebar.js               Navigation (grouped, expanded, customized)
        landing-pages.js         Per-view landing pages, pills
        modals.js                Modal open/close system
        notifications.js         Toasts, alerts
        onboarding.js            Onboarding flows
      99-init.js                 DOMContentLoaded, startup sequence

  config/
    agents/
      strategy.json              system prompt, operations, model prefs
      marketing.json
      operations.json
      documents.json
      intelligence.json
      research.json
    brands/
      trc.json                   voice, audience, messaging, visual identity
      solo.json
      retreats.json
      reserve.json
      rowe-and-co.json
```

### Key Decisions

- **Numbered prefixes** (00-, 01-) control concatenation order without needing a config file
- **Mode separation:** `brand/`, `life/`, `shared/` at every level (CSS, HTML, JS)
- **Shared AI core:** `blake-core.js` contains the chat engine used by both modes; `blake.js` and `blake-life.js` contain mode-specific conversation logic
- **Config directory** is the V2 foundation -- agent configs as data, not hardcoded strings
- **All constraints preserved:** ES5 only, vanilla JS, global scope, no build dependencies beyond bash

## Build Script

The build script concatenates source files in deterministic order:

**Concatenation order:**
1. CSS: `core/ → brand/ → life/ → shared/` (within each: sorted by filename)
2. HTML: `core/00-head.html`, `core/01-shell.html`, `brand/*`, `life/*`, `shared/*`, `core/99-footer.html`
3. JS: `core/ → shared/ → brand/ → life/ → 99-init.js` (within each: sorted by filename)

**Assembly:**
```
[00-head.html]
<style>[all CSS concatenated]</style>
[01-shell.html]
[all view/modal HTML concatenated]
<script>[all JS concatenated]</script>
[99-footer.html]
```

**Output:** `RoweOS/dist/index.html` -- the same file that exists today, deployed to Vercel.

## CLAUDE.md Updates

After migration, CLAUDE.md gets these changes:

1. **File structure section** updated to describe `src/` layout instead of line-range references
2. **New editing rules:** "Edit src/ files only, never edit index.html directly, run build.sh after changes"
3. **Build & deploy flow:** "build.sh concatenates src/ into index.html, deploy.sh calls build.sh then deploys"
4. **Feature location guide:** Which directory to look in for each feature

## Migration Strategy

### Phase 0: Safety Net
- Create branch `restructure/phase-0`
- Save current `index.html` as `index.reference.html` (golden copy for diffing)
- Create the `src/` directory structure (empty files)
- Write the new `build.sh`
- Verify: empty build produces valid HTML skeleton

### Phase 1: Extract CSS (~15,000 lines)
- Extract each `<style>` block from index.html into appropriate `src/css/` files
- Classify each block into core/, brand/, life/, or shared/
- Build, diff output against reference (should be functionally identical)
- Deploy to preview, verify roweos.com behavior

### Phase 2: Extract HTML (~29,000 lines)
- Extract view markup into `src/html/` files
- Identify view boundaries by comment markers and div IDs
- Build, diff, deploy, verify

### Phase 3: Extract JS (~152,000 lines)
Done incrementally to manage risk:

- **3a: Core** -- state, auth, sync, router, theme (~10-15k lines)
- **3b: Shared** -- blake-core, sidebar, modals, notifications (~15-20k lines)
- **3c: BrandAI features** -- one feature per sub-step (~50-60k lines total)
- **3d: LifeAI features** -- one feature per sub-step (~40-50k lines total)

After each sub-phase: build, diff, deploy, verify.

### Phase 4: Config Extraction (V2 Foundation)
- Extract hardcoded agent prompts/configs into `config/agents/*.json`
- Extract brand identity data into `config/brands/*.json`
- Update JS to read from JSON files at runtime
- This is the bridge to the V2 vision

### Verification Protocol

After every build during migration:
```bash
diff <(grep -v '^\s*$' index.reference.html) <(grep -v '^\s*$' RoweOS/dist/index.html)
```
- Empty diff = safe to deploy
- Non-empty diff = investigate before proceeding
- Playwright browser tests verify core flows (login, brand switch, AI chat, sync)

## What Does NOT Change

- **Users:** roweos.com works identically, no visible difference
- **Deployment:** Still Vercel, still `deploy.sh`, still deploys from `RoweOS/dist/`
- **Backend:** API routes and Cloud Functions are untouched
- **Firebase:** Sync, auth, Firestore rules -- all unchanged
- **localStorage:** Same keys, same structure
- **PWA:** Service worker, manifest -- unchanged
- **ES5 constraint:** All JavaScript remains ES5

## What Changes

- **Source of truth** moves from `RoweOS/dist/index.html` to `src/`
- **Editing workflow** becomes: edit src/ file, run build.sh, test, deploy
- **AI tooling** reads focused 1-5k line files instead of scanning 196k lines
- **Parallel work** is possible -- different agents/people edit different files
- **Risk isolation** -- a bug in social-hub.js doesn't require searching all 196k lines

## V2 Bridge

This restructure creates the foundation for the V2 modular architecture from the RoweOS self-analysis:

| V2 Concept | Approach 1 Foundation |
|------------|----------------------|
| `IDENTITY/` per-brand folders | `config/brands/*.json` |
| `AGENTS/` per-agent folders | `config/agents/*.json` |
| `RUNTIME/` executable code | `src/js/` split by feature |
| Modular pipeline (Route > Config > Prompt > Execute > Store) | Backend refactor (Phase 4+, future work) |
| TypeScript/React migration | Not yet -- but files are small enough to migrate individually |

The key insight: once code is in small, focused files, migrating individual files to TypeScript/React becomes tractable. You can migrate `social-hub.js` to `social-hub.tsx` without touching anything else.
