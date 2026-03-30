#!/bin/bash
# RoweOS Modular Build - Concatenation Script
# Assembles src/ files into RoweOS/dist/index.html
# preserving the exact interleaving pattern of the monolith
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$PROJECT_DIR/src"
OUT="$PROJECT_DIR/RoweOS/dist/index.html"

echo "=== RoweOS Modular Build ==="

# Helper: concat all files in a dir matching extension, sorted by name
# Usage: concat_sorted <dir> <ext> [exclude_pattern]
# - Only searches one level deep (no subdirectory recursion)
# - Optional third arg is a grep pattern to exclude matching filenames
concat_sorted() {
  local dir="$1"
  local ext="$2"
  local exclude="$3"
  if [ -d "$dir" ]; then
    local files
    files=$(find "$dir" -maxdepth 1 -name "*.$ext" 2>/dev/null | sort)
    for f in $files; do
      if [ -n "$exclude" ] && echo "$f" | grep -q "$exclude"; then
        continue
      fi
      cat "$f"
      echo ""
    done
  fi
}

{
  # SECTION 1: Head (DOCTYPE, meta, fonts, opening <style> tag)
  cat "$SRC/html/core/00-head.html"

  # SECTION 2: Main CSS (all css files concatenated)
  # Note: 04-late-styles.css is excluded here -- it goes in SECTION 7
  concat_sorted "$SRC/css/core" "css" "04-late-styles"
  concat_sorted "$SRC/css/brand" "css"
  concat_sorted "$SRC/css/life" "css"
  concat_sorted "$SRC/css/shared" "css"

  # Close main style block
  echo ""
  echo "  </style>"
  echo ""

  # SECTION 3: CDN scripts + boot sequence
  cat "$SRC/html/core/01-cdn-and-boot.html"

  # SECTION 4: Shell/HTML batch 1 (sidebar, nav, etc.)
  cat "$SRC/html/core/02-shell-batch1.html"

  # SECTION 5: Early inline script
  echo "  <script>"
  cat "$SRC/js/core/07-early-inline.js"
  echo "  </script>"

  # SECTION 6: HTML views batch 2
  cat "$SRC/html/core/03-views-batch2.html"

  # SECTION 7: Late CSS (second style block)
  echo "  <style>"
  cat "$SRC/css/core/04-late-styles.css"
  echo "  </style>"
  echo ""

  # SECTION 8: HTML views batch 3
  cat "$SRC/html/core/04-views-batch3.html"

  # SECTION 9: WebGL shaders (type="x-shader", not executable JS)
  cat "$SRC/html/shared/webgl-shaders.html"

  # SECTION 10: Remaining HTML views (agent, studio, social, etc.)
  # Views are split across brand/life/shared dirs but interleaved in the DOM.
  # Numeric prefixes (01-, 02-, ...) control global concat order across all dirs.
  # Collect all .html files from all three dirs, sort by basename, then concat.
  {
    find "$SRC/html/brand" -maxdepth 1 -name "*.html" 2>/dev/null
    find "$SRC/html/life" -maxdepth 1 -name "*.html" 2>/dev/null
    find "$SRC/html/shared" -maxdepth 1 -name "*.html" 2>/dev/null
  } | grep -v "webgl-shaders" | while IFS= read -r f; do echo "$(basename "$f") $f"; done | sort | while IFS= read -r entry; do
    f="${entry#* }"
    cat "$f"
    echo ""
  done

  # SECTION 11: Main JavaScript
  echo "  <script>"

  # Core JS (numbered order, excluding 07-early-inline which was in SECTION 5)
  concat_sorted "$SRC/js/core" "js" "07-early-inline"
  # Shared JS (excluding mail.js which goes in SECTION 13)
  concat_sorted "$SRC/js/shared" "js" "mail"
  # Brand JS
  concat_sorted "$SRC/js/brand" "js"
  # Life JS
  concat_sorted "$SRC/js/life" "js"
  # Top-level init
  if [ -f "$SRC/js/99-init.js" ]; then
    cat "$SRC/js/99-init.js"
    echo ""
  fi

  echo "  </script>"
  echo ""

  # SECTION 12: Late modals (HTML between the two script blocks)
  cat "$SRC/html/shared/modals/late-modals.html"

  # SECTION 13: Second JavaScript block (API bridge, mail, messaging)
  # Note: no indentation on <script> tags -- matches original monolith
  echo "<script>"
  # Include all late JS files -- currently mail.js, future: api-bridge.js etc.
  concat_sorted "$SRC/js/late" "js"
  # Fallback: if js/late/ doesn't exist yet, use mail.js directly
  if [ ! -d "$SRC/js/late" ] && [ -f "$SRC/js/shared/mail.js" ]; then
    cat "$SRC/js/shared/mail.js"
    echo ""
  fi
  echo "</script>"
  echo ""

  # SECTION 14: Footer (reminder popup, web search indicator, closing tags)
  cat "$SRC/html/core/99-footer.html"

} > "$OUT"

LINE_COUNT=$(wc -l < "$OUT" | tr -d ' ')
SIZE_KB=$(( $(wc -c < "$OUT" | tr -d ' ') / 1024 ))
echo "Built: $OUT"
echo "Lines: $LINE_COUNT | Size: ${SIZE_KB}KB"
echo "=== Build Complete ==="
