#!/usr/bin/env bash
#
# pre-deploy-audit.sh
#
# Pre-deployment audit ritual. Catches the kinds of regressions that make it
# embarrassing to ship — stark white slabs in light mode, em-dashes in
# user-facing copy, version-string drift, untested code paths, broken builds.
#
# This script does NOT spawn AI agents directly (those run inside Claude Code
# sessions). It runs the cheap static checks that should never fail. If any
# of them flag, fix before deploying. The session that calls deploy.sh should
# also have spawned the visual-regression / em-dash audit agents BEFORE
# starting this script and acted on their reports.
#
# Usage: bash scripts/pre-deploy-audit.sh
# Exits 0 if clean, 1 if any check failed.

set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
FAIL=0
SECTION_PASS=0
SECTION_FAIL=0

color_red()    { printf "\033[31m%s\033[0m" "$1"; }
color_green()  { printf "\033[32m%s\033[0m" "$1"; }
color_yellow() { printf "\033[33m%s\033[0m" "$1"; }
color_dim()    { printf "\033[2m%s\033[0m"  "$1"; }

section() {
  echo
  echo "═══ $1 ═══"
}

ok() {
  echo "  $(color_green "✓") $1"
  SECTION_PASS=$((SECTION_PASS+1))
}

bad() {
  echo "  $(color_red "✗") $1"
  SECTION_FAIL=$((SECTION_FAIL+1))
  FAIL=1
}

warn() {
  echo "  $(color_yellow "!") $1"
}

# ── 1. Version string consistency ─────────────────────────────────────────────
section "Version string consistency"

VERSION=$(grep -E "^var ROWEOS_VERSION = '" src/js/core/09-state.js 2>/dev/null \
  | head -1 \
  | sed -E "s/.*'(v[0-9]+\.[0-9]+)'.*/\1/")

if [ -z "$VERSION" ]; then
  bad "Could not read ROWEOS_VERSION from src/js/core/09-state.js"
else
  ok "Source version: $VERSION"

  # Find every occurrence of v\d+\.\d+ across the 8 expected locations
  # and report mismatches.
  EXPECTED_FILES=(
    "src/js/core/09-state.js"
    "src/html/core/03-views-batch2.html"
    "src/html/core/04-views-batch3.html"
    "src/html/shared/21-settings.html"
    "CLAUDE.md"
  )

  for f in "${EXPECTED_FILES[@]}"; do
    if [ ! -f "$f" ]; then
      bad "Missing expected file: $f"
      continue
    fi
    # Skip files that don't reference any RoweOS version at all
    if ! grep -qE "v[0-9]+\.[0-9]+" "$f"; then
      continue
    fi
    if ! grep -qF "$VERSION" "$f"; then
      MISMATCHES=$(grep -oE "v[0-9]+\.[0-9]+" "$f" | sort -u | grep -v "^$VERSION$" | head -3 | tr '\n' ' ')
      bad "$f does not contain $VERSION (found: $MISMATCHES)"
    fi
  done

  if [ "$SECTION_FAIL" -eq 0 ]; then
    ok "All version-bearing files contain $VERSION"
  fi
fi

# ── 2. Em-dash sweep in user-facing copy ──────────────────────────────────────
section "Em-dash sweep (user-facing copy)"

# We allow em-dashes in: comments, CHANGELOG, docs/, memory/, *.md.
# We flag them in: src/html/*, src/js/*.js (string literals only — heuristic),
# RoweOS/dist/info.html, RoweOS/dist/portfolio.html, RoweOS/dist/social.html.

EMDASH_HITS=0
EMDASH_FILES=()

scan_emdash() {
  local file=$1
  # Skip lines that are clearly comments
  local hits
  hits=$(grep -nE "—" "$file" 2>/dev/null \
    | grep -v "^[[:space:]]*\*" \
    | grep -v "^[[:space:]]*\/\/" \
    | grep -v "^[[:space:]]*\/\*" \
    | grep -v "^[[:space:]]*#" \
    | wc -l | tr -d ' ')
  if [ "$hits" -gt 0 ]; then
    EMDASH_HITS=$((EMDASH_HITS + hits))
    EMDASH_FILES+=("$file ($hits)")
  fi
}

while IFS= read -r f; do scan_emdash "$f"; done < <(find src/html -name "*.html" 2>/dev/null)
[ -f "RoweOS/dist/info.html" ] && scan_emdash "RoweOS/dist/info.html"
[ -f "RoweOS/dist/portfolio.html" ] && scan_emdash "RoweOS/dist/portfolio.html"
[ -f "RoweOS/dist/social.html" ] && scan_emdash "RoweOS/dist/social.html"

if [ "$EMDASH_HITS" -eq 0 ]; then
  ok "No em-dashes in user-facing HTML"
else
  warn "Found $EMDASH_HITS em-dashes in HTML — review:"
  for entry in "${EMDASH_FILES[@]:0:8}"; do
    echo "    $(color_dim "·") $entry"
  done
fi

# ── 3. Stark-white-in-light-mode pattern ─────────────────────────────────────
section "Stark-white slab pattern (light-mode regression risk)"

# Look for `html.light-mode <selector that wraps a flex row of buttons or list>`
# with a hard background. The Library bug was `html.light-mode .library-header
# { background: var(--bg-elevated) }` which painted the whole row white.
SUSPECT=$(grep -nE "html\.light-mode\s+\.[a-zA-Z][a-zA-Z0-9_-]*-(header|actions|toolbar|bar|row|nav|tabs?)\s*\{" src/css/core/01-base.css 2>/dev/null || true)

if [ -z "$SUSPECT" ]; then
  ok "No header/actions/toolbar/row containers with hardcoded light-mode bg"
else
  COUNT=$(echo "$SUSPECT" | wc -l | tr -d ' ')
  warn "Found $COUNT light-mode wrapper-container rules — review for stark-white slabs:"
  echo "$SUSPECT" | head -10 | while read -r line; do
    echo "    $(color_dim "·") $line"
  done
fi

# ── 4. Build verifies ─────────────────────────────────────────────────────────
section "Build verify"

if bash src/build.sh > /tmp/roweos-build.log 2>&1; then
  LINES=$(grep "^Lines:" /tmp/roweos-build.log | sed -E 's/.*Lines: ([0-9]+).*/\1/')
  ok "Build succeeded ($LINES lines)"
  if [ -n "$LINES" ] && [ "$LINES" -lt 200000 ]; then
    bad "Built file is only $LINES lines — expected ~220k+. Likely truncated."
  fi
else
  bad "Build failed:"
  tail -20 /tmp/roweos-build.log
fi

# ── 5. Test suite ────────────────────────────────────────────────────────────
section "Test suite"

if command -v npm >/dev/null 2>&1; then
  if npm test --silent > /tmp/roweos-test.log 2>&1; then
    PASSED=$(grep -E "Tests\s+[0-9]+ passed" /tmp/roweos-test.log | sed -E 's/.*Tests[[:space:]]+([0-9]+) passed.*/\1/' | head -1)
    ok "Tests pass${PASSED:+ ($PASSED)}"
  else
    bad "Test suite failed:"
    tail -30 /tmp/roweos-test.log
  fi
else
  warn "npm not found — skipping test suite"
fi

# ── 6. Forbidden patterns ────────────────────────────────────────────────────
section "Forbidden patterns (ES5 / SVG / no emoji)"

# Arrow functions in src/js/core (we ship ES5)
ARROWS=$(grep -rnE "=>\s*\{|=>\s+[^{=]" src/js/core --include="*.js" 2>/dev/null | grep -v "^[[:space:]]*\*" | grep -v "^[[:space:]]*\/\/" | wc -l | tr -d ' ')
if [ "$ARROWS" -gt 0 ]; then
  warn "Found $ARROWS possible arrow functions in src/js/core (ES5 required)"
fi

# innerHTML with base64 logos (always use createElement for img.src)
B64_INJECT=$(grep -rnE "innerHTML.*data:image/" src/js 2>/dev/null | wc -l | tr -d ' ')
if [ "$B64_INJECT" -gt 0 ]; then
  warn "Found $B64_INJECT cases of innerHTML with base64 — use createElement('img').src instead"
fi

ok "Pattern scan complete"

# ── Summary ──────────────────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "$(color_green "✓ Pre-deploy audit passed.")"
  echo
  echo "Reminder: this script catches mechanical regressions. For visual"
  echo "regressions (stark whites, broken light mode, layout breaks), the"
  echo "session calling deploy.sh should ALSO have run agent-driven audits"
  echo "and acted on their reports before invoking this script."
  exit 0
else
  echo "$(color_red "✗ Pre-deploy audit failed.") Fix issues above before deploying."
  exit 1
fi
