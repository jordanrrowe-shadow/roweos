# RoweOS Modular Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 196k-line monolithic `index.html` into ~50 organized source files with a bash concatenation build, preserving byte-identical runtime behavior.

**Architecture:** Source files in `src/` organized by mode (BrandAI/LifeAI) and concern (CSS/HTML/JS). A bash build script concatenates them back into `RoweOS/dist/index.html`. The deployed artifact is identical to today -- users see zero change.

**Tech Stack:** Bash (build script), existing vanilla ES5/CSS/HTML, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-30-modular-restructure-design.md`

---

## Critical Context

The current `index.html` structure is NOT a clean CSS/HTML/JS split. The actual layout is:

```
Lines 1-53         <head> meta, links, fonts
Lines 54-46770     <style> block (ALL CSS in one block)
Lines 46771-46798  CDN <script> tags (Firebase, PDF.js, Chart.js, Three.js, etc.)
Lines 46799-46804  Inline <script> for PDF.js worker config
Lines 46805        </head>
Lines 46806-46812  <body>, boot screen
Lines 46813        Inline <script> for theme boot
Lines 46814-48573  HTML views, modals, overlays (batch 1)
Lines 48574-49520  Second <style> block (additional CSS)
Lines 49521-52537  HTML views, modals (batch 2)
Lines 52538-52680  Inline <script> blocks (WebGL shaders)
Lines 52681-61451  HTML views, modals (batch 3)
Lines 61452-183430 Main <script> block (ALL application JS)
Lines 183431-196255 Second major <script> block (email/messaging JS)
Lines 196256-196267 Trailing HTML (reminder popup, search indicator), </body></html>
```

**This means the build script cannot simply do "all CSS, then all HTML, then all JS" -- it must preserve the exact interleaving of style/script/html blocks.**

---

## File Map

### New files to create:

```
src/
  css/
    core/00-variables.css
    core/01-base.css
    core/02-components.css
    core/03-animations.css
    core/04-late-styles.css        (second <style> block, lines 48574-49520)
    brand/social-hub.css
    brand/studio.css
    brand/pulse.css
    brand/folio.css
    life/focus.css
    life/rhythm.css
    life/library.css
    life/history.css
    shared/blake.css
    shared/landing.css
    shared/modals.css
  html/
    core/00-head.html              (lines 1-53 + CDN scripts + </head><body> boot)
    core/01-shell.html             (sidebar, nav, toolbar)
    core/99-footer.html            (trailing HTML + </body></html>)
    brand/social-hub.html
    brand/studio.html
    brand/pulse.html
    brand/folio.html
    life/focus.html
    life/rhythm.html
    life/library.html
    life/history.html
    shared/blake.html
    shared/modals/settings.html
    shared/modals/onboarding.html
    shared/modals/brand-selector.html
    shared/modals/ai-config.html
    shared/webgl-shaders.html      (shader script blocks, lines 52538-52680)
  js/
    core/00-constants.js
    core/01-store.js               (storage API)
    core/02-state.js
    core/03-auth.js
    core/04-sync.js
    core/05-router.js
    core/06-theme.js
    core/07-boot-scripts.js        (PDF.js config + theme boot)
    brand/blake.js
    brand/agents.js
    brand/social-hub.js
    brand/studio.js
    brand/pulse.js
    brand/folio.js
    brand/scavenger.js
    brand/clients.js
    brand/commerce.js
    life/blake-life.js
    life/coaches.js
    life/focus.js
    life/rhythm.js
    life/library.js
    life/history.js
    life/journal.js
    shared/blake-core.js
    shared/sidebar.js
    shared/landing-pages.js
    shared/modals.js
    shared/notifications.js
    shared/onboarding.js
    shared/calendar.js
    shared/mail.js
    shared/widgets.js
    shared/admin.js
    99-init.js
  build.sh                         (new concatenation build)
  verify.sh                        (diff checker)
```

### Files to modify:
- `build.sh` -- complete rewrite (concatenation build)
- `deploy.sh` -- update to call new build
- `CLAUDE.md` -- update file structure, editing rules

### Files to preserve unchanged:
- `RoweOS/dist/index.html` -- becomes generated output
- `RoweOS/dist/api/*` -- untouched
- `functions/*` -- untouched
- `firebase.json`, `firestore.*` -- untouched

---

## Task 0: Create Safety Net

**Files:**
- Create: `RoweOS/dist/index.reference.html`
- Create: `src/verify.sh`

- [ ] **Step 1: Create restructure branch**

```bash
cd /Volumes/roweOS && git checkout -b restructure/modular-split
```

- [ ] **Step 2: Save golden reference copy**

```bash
cp /Volumes/roweOS/RoweOS/dist/index.html /Volumes/roweOS/RoweOS/dist/index.reference.html
```

- [ ] **Step 3: Create verification script**

Create `src/verify.sh`:
```bash
#!/bin/bash
# Verify build output matches reference
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REF="$PROJECT_DIR/RoweOS/dist/index.reference.html"
OUT="$PROJECT_DIR/RoweOS/dist/index.html"

if [ ! -f "$REF" ]; then
  echo "ERROR: No reference file at $REF"
  exit 1
fi

# Compare ignoring blank lines
DIFF=$(diff <(grep -v '^\s*$' "$REF") <(grep -v '^\s*$' "$OUT") | head -20)

if [ -z "$DIFF" ]; then
  echo "PASS: Build output matches reference"
  exit 0
else
  echo "FAIL: Build output differs from reference"
  echo "$DIFF"
  echo "..."
  echo "Run 'diff index.reference.html index.html' for full diff"
  exit 1
fi
```

- [ ] **Step 4: Make verify.sh executable**

```bash
chmod +x /Volumes/roweOS/src/verify.sh
```

- [ ] **Step 5: Create the src/ directory tree**

```bash
cd /Volumes/roweOS
mkdir -p src/css/{core,brand,life,shared}
mkdir -p src/html/{core,brand,life,shared/modals}
mkdir -p src/js/{core,brand,life,shared}
mkdir -p config/{agents,brands}
```

- [ ] **Step 6: Commit safety net**

```bash
cd /Volumes/roweOS
git add RoweOS/dist/index.reference.html src/verify.sh
git commit -m "chore: add golden reference and verify script for modular restructure"
```

---

## Task 1: Write the Build Script

**Files:**
- Create: `src/build.sh`

The build script must reproduce the exact interleaving pattern of the current `index.html`. This is the most critical piece -- get this wrong and everything breaks.

- [ ] **Step 1: Create the build script**

Create `src/build.sh`:
```bash
#!/bin/bash
# RoweOS Build Script v2 - Concatenation Build
# Assembles src/ files into RoweOS/dist/index.html
# preserving the exact interleaving pattern of the monolith
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$PROJECT_DIR/src"
OUT="$PROJECT_DIR/RoweOS/dist/index.html"
BACKUP="$PROJECT_DIR/RoweOS/dist/index.backup.html"

echo "=== RoweOS Modular Build ==="

# Backup current
if [ -f "$OUT" ]; then
  cp "$OUT" "$BACKUP"
fi

# Helper: concatenate all files in a directory, sorted by name
concat_dir() {
  local dir="$1"
  if [ -d "$dir" ]; then
    for f in $(find "$dir" -maxdepth 1 -name "*.css" -o -name "*.html" -o -name "*.js" 2>/dev/null | sort); do
      cat "$f"
      echo ""
    done
  fi
}

# Helper: concatenate files recursively in a directory, sorted
concat_dir_recursive() {
  local dir="$1"
  local ext="$2"
  if [ -d "$dir" ]; then
    for f in $(find "$dir" -name "*.$ext" 2>/dev/null | sort); do
      cat "$f"
      echo ""
    done
  fi
}

{
  # === SECTION 1: Head + Main CSS ===
  # 00-head.html contains everything up to and including <style>
  cat "$SRC/html/core/00-head.html"

  # Main CSS block (core, then brand, life, shared)
  concat_dir "$SRC/css/core"
  concat_dir "$SRC/css/brand"
  concat_dir "$SRC/css/life"
  concat_dir "$SRC/css/shared"

  echo "</style>"
  echo ""

  # === SECTION 2: CDN scripts + boot scripts ===
  # 07-boot-scripts.js contains CDN script tags + inline boot scripts + </head><body> + boot screen
  cat "$SRC/js/core/07-boot-scripts.js"

  # === SECTION 3: HTML views batch 1 ===
  cat "$SRC/html/core/01-shell.html"

  # === SECTION 4: Late CSS (second style block) ===
  echo "<style>"
  cat "$SRC/css/core/04-late-styles.css"
  echo "</style>"
  echo ""

  # === SECTION 5: HTML views batch 2 (modals, views) ===
  concat_dir_recursive "$SRC/html/shared/modals" "html"
  concat_dir "$SRC/html/brand"
  concat_dir "$SRC/html/life"
  concat_dir "$SRC/html/shared"

  # === SECTION 6: WebGL shaders ===
  cat "$SRC/html/shared/webgl-shaders.html"

  # === SECTION 7: Remaining HTML views ===
  # (views that come after shaders - these get extracted as part of the brand/life/shared dirs)

  # === SECTION 8: Main JavaScript ===
  echo "<script>"

  # Core JS (sorted by number prefix)
  concat_dir "$SRC/js/core"

  # Shared JS
  concat_dir "$SRC/js/shared"

  # Brand JS
  concat_dir "$SRC/js/brand"

  # Life JS
  concat_dir "$SRC/js/life"

  # Init
  cat "$SRC/js/99-init.js"

  echo "</script>"
  echo ""

  # === SECTION 9: Footer ===
  cat "$SRC/html/core/99-footer.html"

} > "$OUT"

LINE_COUNT=$(wc -l < "$OUT" | tr -d ' ')
echo "Built: $LINE_COUNT lines"
echo "=== Build Complete ==="
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x /Volumes/roweOS/src/build.sh
```

- [ ] **Step 3: Commit build script**

```bash
cd /Volumes/roweOS
git add src/build.sh
git commit -m "chore: add modular concatenation build script"
```

**Note:** This build script is a starting template. The exact section boundaries will be refined in Task 2 when we extract the CSS and discover the precise interleaving pattern. The script will be updated at each phase to match reality.

---

## Task 2: Extract CSS (Phase 1)

**Files:**
- Create: `src/css/core/00-variables.css`
- Create: `src/css/core/01-base.css`
- Create: `src/css/core/02-components.css`
- Create: `src/css/core/03-animations.css`
- Create: `src/css/core/04-late-styles.css`
- Create: remaining `src/css/brand/*.css`, `src/css/life/*.css`, `src/css/shared/*.css`

This is the safest extraction -- CSS has no execution order dependencies.

- [ ] **Step 1: Extract the main CSS block (lines 54-46770)**

Read lines 54-46770 of `index.html`. This is the entire `<style>` block. Split it by scanning for section comments (look for `/* === `, `/* --- `, or commented section headers).

Strategy:
1. Lines 54-~500: CSS custom properties (`:root` block) → `src/css/core/00-variables.css`
2. Scan for view-specific CSS (selectors referencing `#socialView`, `#focusView`, etc.) → route to appropriate `brand/` or `life/` file
3. Component CSS (`.modal-`, `.btn-`, `.card-`, `.sidebar-`) → `src/css/core/02-components.css`
4. Animation keyframes (`@keyframes`) → `src/css/core/03-animations.css`
5. Everything else → `src/css/core/01-base.css`

Extract each section into its file. The extraction must be exact -- every character of CSS preserved, just moved to a different file.

- [ ] **Step 2: Extract the second CSS block (lines 48574-49520)**

Read lines 48574-49520. This is the second `<style>` block. Extract to `src/css/core/04-late-styles.css`.

- [ ] **Step 3: Update build.sh to handle exact CSS placement**

Adjust the build script sections to match the actual interleaving discovered during extraction. The main CSS goes after `<style>` in the head, the late CSS goes between HTML batches 1 and 2.

- [ ] **Step 4: Build and verify**

```bash
cd /Volumes/roweOS && bash src/build.sh && bash src/verify.sh
```

Expected: `PASS: Build output matches reference`

If FAIL: diff the files, find the discrepancy, fix the build script or extraction.

- [ ] **Step 5: Commit CSS extraction**

```bash
cd /Volumes/roweOS
git add src/css/
git commit -m "refactor: extract CSS into modular source files (Phase 1)"
```

---

## Task 3: Extract HTML (Phase 2)

**Files:**
- Create: `src/html/core/00-head.html`
- Create: `src/html/core/01-shell.html`
- Create: `src/html/core/99-footer.html`
- Create: all `src/html/brand/*.html`, `src/html/life/*.html`, `src/html/shared/*.html`

HTML extraction is more complex because views are interspersed with inline scripts and the second CSS block.

- [ ] **Step 1: Extract head section**

Lines 1-53 (everything before the `<style>` tag) → `src/html/core/00-head.html`

This file should end with `<style>` (the opening tag) -- the build script inserts CSS after it.

- [ ] **Step 2: Extract CDN scripts and boot sequence**

Lines 46771-46813 (CDN script tags, PDF.js config, `</head>`, `<body>`, boot screen, theme boot script) → `src/js/core/07-boot-scripts.js`

Despite being "JS", this file contains raw HTML (`<script src="...">` tags and inline scripts). It's placed in `js/core/` because it's executable content, but it outputs as-is (not wrapped in `<script>` tags by the build).

- [ ] **Step 3: Extract shell/sidebar HTML**

Lines 46814-48573 (first batch of HTML after body open). Identify the sidebar, nav, toolbar markup → `src/html/core/01-shell.html`

- [ ] **Step 4: Extract view-specific HTML**

Using the view boundary map from exploration:
- `agentView` (line 52480) → `src/html/shared/blake.html`
- `studioView` (line 52988) → `src/html/brand/studio.html`
- `rhythmView` (line 53578) → `src/html/life/rhythm.html`
- `libraryView` (line 54060) → `src/html/life/library.html`
- `signalView` (line 54223) → `src/html/life/focus.html`
- `pulseView` (line 55005) → `src/html/brand/pulse.html`
- `folioView` (line 57404) → `src/html/brand/folio.html`
- `socialView` (line 59160) → `src/html/brand/social-hub.html`
- `researchView` (line 59108) → `src/html/brand/research.html`
- `mailView` (line 59627) → `src/html/shared/mail.html`
- `settingsView` (line 57486) → `src/html/shared/modals/settings.html`
- `onboardingModal` (line 50035) → `src/html/shared/modals/onboarding.html`

Each extraction: identify the opening `<div id="viewName"` and its matching closing `</div>`, extract the entire block.

- [ ] **Step 5: Extract WebGL shaders**

Lines 52538-52680 (vertex/fragment shader script blocks) → `src/html/shared/webgl-shaders.html`

- [ ] **Step 6: Extract footer**

Lines 196256-196267 (reminder popup, search indicator, `</body></html>`) → `src/html/core/99-footer.html`

- [ ] **Step 7: Update build.sh assembly order**

By this point the exact interleaving is known. Update build.sh to concatenate files in the precise order that reproduces the original. This may require numbered prefixes on HTML files or an explicit file list in the build script.

- [ ] **Step 8: Build and verify**

```bash
cd /Volumes/roweOS && bash src/build.sh && bash src/verify.sh
```

Expected: `PASS: Build output matches reference`

- [ ] **Step 9: Commit HTML extraction**

```bash
cd /Volumes/roweOS
git add src/html/ src/js/core/07-boot-scripts.js
git commit -m "refactor: extract HTML views into modular source files (Phase 2)"
```

---

## Task 4: Extract Core JS (Phase 3a)

**Files:**
- Create: `src/js/core/00-constants.js`
- Create: `src/js/core/01-store.js`
- Create: `src/js/core/02-state.js`
- Create: `src/js/core/03-auth.js`
- Create: `src/js/core/04-sync.js`
- Create: `src/js/core/05-router.js`
- Create: `src/js/core/06-theme.js`

The main JS block starts at line 61452. Core systems are at the top.

- [ ] **Step 1: Extract constants and version**

Find `var ROWEOS_VERSION` (line 63060) and surrounding constants, config objects, feature flags. Extract to `src/js/core/00-constants.js`.

- [ ] **Step 2: Extract store API**

Find `var store = (function()` (line 61464). Extract the entire IIFE through its closing `})();` → `src/js/core/01-store.js`.

- [ ] **Step 3: Extract state management**

Find global state variables, brand system (`var brands = `, `var selectedBrand`, mode switching). Extract → `src/js/core/02-state.js`.

- [ ] **Step 4: Extract auth system**

Find login, session management, subscription check functions. Extract → `src/js/core/03-auth.js`.

- [ ] **Step 5: Extract sync system**

Find `mergeByTimestamp` (line 64766), `safeSyncWrite` (line 138294), `initSyncHub` (line 170622), `initSyncIndexedDB` (line 130047). Extract all sync-related functions → `src/js/core/04-sync.js`.

**Warning:** Sync functions are scattered across the file (lines 64k, 130k, 138k, 170k). All must be found and extracted into one file. The build concatenation order must place this file before any code that calls sync functions.

- [ ] **Step 6: Extract router**

Find view switching functions, navigation handlers. Extract → `src/js/core/05-router.js`.

- [ ] **Step 7: Extract theme system**

Find `initBrandAccentColor` (line 166420), dark/light mode toggle, brand accent logic. Extract → `src/js/core/06-theme.js`.

- [ ] **Step 8: Build and verify**

```bash
cd /Volumes/roweOS && bash src/build.sh && bash src/verify.sh
```

- [ ] **Step 9: Commit core JS extraction**

```bash
cd /Volumes/roweOS
git add src/js/core/
git commit -m "refactor: extract core JS (store, state, auth, sync, router, theme) - Phase 3a"
```

---

## Task 5: Extract Shared JS (Phase 3b)

**Files:**
- Create: `src/js/shared/blake-core.js`
- Create: `src/js/shared/sidebar.js`
- Create: `src/js/shared/modals.js`
- Create: `src/js/shared/notifications.js`
- Create: `src/js/shared/onboarding.js`
- Create: `src/js/shared/calendar.js`
- Create: `src/js/shared/mail.js`
- Create: `src/js/shared/widgets.js`
- Create: `src/js/shared/admin.js`

- [ ] **Step 1: Extract B.L.A.K.E. core chat engine**

Find the shared AI chat functions: model switching, streaming response handling, message rendering, conversation management. These are the functions used by both BrandAI and LifeAI modes. Extract → `src/js/shared/blake-core.js`.

- [ ] **Step 2: Extract sidebar navigation**

Find sidebar rendering, grouped/expanded/customized nav variants (around line 80867 DOMContentLoaded). Extract → `src/js/shared/sidebar.js`.

- [ ] **Step 3: Extract modal system**

Find `openModal`, `closeModal`, generic modal infrastructure. Extract → `src/js/shared/modals.js`.

- [ ] **Step 4: Extract notification/toast system**

Find toast/alert rendering functions. Extract → `src/js/shared/notifications.js`.

- [ ] **Step 5: Extract onboarding flows**

Find onboarding wizard logic. Extract → `src/js/shared/onboarding.js`.

- [ ] **Step 6: Extract calendar system**

Lines 87153-93958 contain calendar management. Extract → `src/js/shared/calendar.js`.

- [ ] **Step 7: Extract mail/messaging system**

Lines 183431-196255 contain the email/messaging layer. Extract → `src/js/shared/mail.js`.

- [ ] **Step 8: Extract widgets**

Lines 165883-170404 contain widget sub-sections (sync widget, AI activity, automations, scheduler clock). Extract → `src/js/shared/widgets.js`.

- [ ] **Step 9: Extract admin system**

Lines 129074-137395 contain settings/admin, API key pool, Stripe checkout, marketplace. Extract → `src/js/shared/admin.js`.

- [ ] **Step 10: Build and verify**

```bash
cd /Volumes/roweOS && bash src/build.sh && bash src/verify.sh
```

- [ ] **Step 11: Commit shared JS extraction**

```bash
cd /Volumes/roweOS
git add src/js/shared/
git commit -m "refactor: extract shared JS (blake-core, sidebar, calendar, mail, widgets) - Phase 3b"
```

---

## Task 6: Extract BrandAI JS (Phase 3c)

**Files:**
- Create: `src/js/brand/blake.js`
- Create: `src/js/brand/agents.js`
- Create: `src/js/brand/social-hub.js`
- Create: `src/js/brand/studio.js`
- Create: `src/js/brand/pulse.js`
- Create: `src/js/brand/folio.js`
- Create: `src/js/brand/scavenger.js`
- Create: `src/js/brand/clients.js`
- Create: `src/js/brand/commerce.js`

- [ ] **Step 1: Extract B.L.A.K.E. brand-specific agent logic**

Find brand-mode conversation handling, agent persona selection (Strategy, Marketing, etc.). Extract → `src/js/brand/blake.js`.

- [ ] **Step 2: Extract agent system**

Find Strategy, Marketing, Operations, Documents, Intelligence, Research agent definitions and routing. Extract → `src/js/brand/agents.js`.

- [ ] **Step 3: Extract Social Hub**

Lines 109022-111154 contain social section. Extract → `src/js/brand/social-hub.js`.

- [ ] **Step 4: Extract Studio**

Find content studio functions. Extract → `src/js/brand/studio.js`.

- [ ] **Step 5: Extract Pulse analytics**

Find brand analytics/pulse functions. Extract → `src/js/brand/pulse.js`.

- [ ] **Step 6: Extract Folio**

Lines 105097-106349 contain folio section. Extract → `src/js/brand/folio.js`.

- [ ] **Step 7: Extract Scavenger**

Find web search agent functions. Extract → `src/js/brand/scavenger.js`.

- [ ] **Step 8: Extract Clients**

Lines 177554-178082 contain Sprint 4 client management. Extract → `src/js/brand/clients.js`.

- [ ] **Step 9: Extract Commerce**

Find commerce/inventory functions (`commerceView`, `inventoryView`). Extract → `src/js/brand/commerce.js`.

- [ ] **Step 10: Build and verify**

```bash
cd /Volumes/roweOS && bash src/build.sh && bash src/verify.sh
```

- [ ] **Step 11: Commit BrandAI JS extraction**

```bash
cd /Volumes/roweOS
git add src/js/brand/
git commit -m "refactor: extract BrandAI JS (social-hub, folio, studio, agents, clients) - Phase 3c"
```

---

## Task 7: Extract LifeAI JS (Phase 3d)

**Files:**
- Create: `src/js/life/blake-life.js`
- Create: `src/js/life/coaches.js`
- Create: `src/js/life/focus.js`
- Create: `src/js/life/rhythm.js`
- Create: `src/js/life/library.js`
- Create: `src/js/life/history.js`
- Create: `src/js/life/journal.js`

- [ ] **Step 1: Extract B.L.A.K.E. life coach logic**

Find life-mode conversation handling, coach archetypes. Extract → `src/js/life/blake-life.js`.

- [ ] **Step 2: Extract coach system**

Find life coach archetype definitions. Extract → `src/js/life/coaches.js`.

- [ ] **Step 3: Extract Focus**

Find `renderFocus*` functions (lines 94758-119085 contain multiple focus variants). Extract → `src/js/life/focus.js`.

- [ ] **Step 4: Extract Rhythm**

Find rhythm/music player functions. Extract → `src/js/life/rhythm.js`.

- [ ] **Step 5: Extract Library**

Find library/document management functions. Extract → `src/js/life/library.js`.

- [ ] **Step 6: Extract History**

Find history view functions. Extract → `src/js/life/history.js`.

- [ ] **Step 7: Extract Journal**

Find journal/bloom functions (`journalView`, `bloomView`). Extract → `src/js/life/journal.js`.

- [ ] **Step 8: Create 99-init.js**

Find the final `DOMContentLoaded` listener (line 196187) and any remaining initialization code. Extract → `src/js/99-init.js`.

- [ ] **Step 9: Build and verify**

```bash
cd /Volumes/roweOS && bash src/build.sh && bash src/verify.sh
```

- [ ] **Step 10: Commit LifeAI JS extraction**

```bash
cd /Volumes/roweOS
git add src/js/life/ src/js/99-init.js
git commit -m "refactor: extract LifeAI JS (focus, rhythm, library, journal) - Phase 3d"
```

---

## Task 8: Update CLAUDE.md and Deploy Scripts

**Files:**
- Modify: `CLAUDE.md`
- Modify: `deploy.sh`
- Modify: `build.sh` (root level -- update to call src/build.sh)

- [ ] **Step 1: Update CLAUDE.md file structure section**

Replace the current line-range file structure with the new `src/` layout. Add editing rules: "Edit src/ files only, never edit index.html directly." Add feature location guide mapping each feature to its source file.

- [ ] **Step 2: Update root build.sh**

Update the root `build.sh` to call `src/build.sh` first (concatenation), then optionally minify:

```bash
#!/bin/bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Step 1: Concatenate source files
bash "$PROJECT_DIR/src/build.sh"

# Step 2: Minify (optional, same as before)
if [ "$1" = "--minify" ]; then
  SRC_FILE="$PROJECT_DIR/RoweOS/dist/index.html"
  BACKUP_FILE="$PROJECT_DIR/RoweOS/dist/index.src.html"
  cp "$SRC_FILE" "$BACKUP_FILE"
  npx html-minifier-terser \
    --collapse-whitespace \
    --remove-comments \
    --minify-css true \
    --minify-js "{\"mangle\":false,\"compress\":{\"drop_console\":false}}" \
    < "$BACKUP_FILE" > "$SRC_FILE"
  echo "Minified"
fi
```

- [ ] **Step 3: Update deploy.sh**

Add `bash src/build.sh` call before the version extraction step, so deploy always builds from source first.

- [ ] **Step 4: Final full build and verify**

```bash
cd /Volumes/roweOS && bash build.sh && bash src/verify.sh
```

- [ ] **Step 5: Deploy to preview and test**

```bash
cd /Volumes/roweOS/RoweOS/dist && npx vercel
```

Open the preview URL, test: login, brand switch, AI chat, sync, social hub, focus timer.

- [ ] **Step 6: Commit everything**

```bash
cd /Volumes/roweOS
git add CLAUDE.md build.sh deploy.sh
git commit -m "docs: update CLAUDE.md and deploy scripts for modular source structure"
```

---

## Task 9: Remove Reference File and Merge

- [ ] **Step 1: Remove golden reference (no longer needed)**

```bash
rm /Volumes/roweOS/RoweOS/dist/index.reference.html
```

- [ ] **Step 2: Add index.html to .gitignore**

Since `index.html` is now generated, consider whether to track it in git. Recommendation: **keep tracking it** so deploys work from git, but add a comment noting it's generated.

- [ ] **Step 3: Final commit on restructure branch**

```bash
cd /Volumes/roweOS
git add -A
git commit -m "refactor: complete modular restructure - source split into ~50 files"
```

- [ ] **Step 4: Merge to main**

```bash
cd /Volumes/roweOS
git checkout main
git merge restructure/modular-split
```

- [ ] **Step 5: Deploy to production**

```bash
cd /Volumes/roweOS && bash deploy.sh
```

---

## Execution Notes

- **Each task is independent within a phase** but phases must be sequential (CSS before HTML before JS)
- **The verify step is non-negotiable** -- never commit without a passing verify
- **If verify fails:** diff the files, find the exact discrepancy, fix it before proceeding
- **The build script will need refinement** as each phase reveals the true interleaving pattern -- this is expected
- **Multiple DOMContentLoaded listeners** (at least 11) are scattered throughout the JS -- these must all end up in the correct files to maintain execution order
- **Global scope dependencies** mean JS file order matters -- core must come before shared, shared before brand/life
