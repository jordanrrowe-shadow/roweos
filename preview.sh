#!/bin/bash
# RoweOS Preview Deploy
# Builds + deploys to a Vercel PREVIEW URL (not production).
# No git push, no production promotion. Use this to test before ./deploy.sh.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=== RoweOS Preview Deploy ==="

# 1. Build from modular source
echo "Building from source..."
bash "$PROJECT_DIR/src/build.sh"

# 2. Extract version for display
CURRENT_VERSION=$(grep -o "var ROWEOS_VERSION = 'v[^']*'" RoweOS/dist/index.html | tail -1 | sed "s/var ROWEOS_VERSION = '//" | sed "s/'//")
echo "Version: $CURRENT_VERSION (preview)"

# 3. Minify for accurate prod-like preview
echo "Building minified version..."
"$PROJECT_DIR/build.sh" --minify

# 4. Deploy to Vercel preview (no --prod flag = preview URL)
echo "Deploying to Vercel preview..."
cd "$PROJECT_DIR/RoweOS/dist"
PREVIEW_URL=$(npx vercel --yes 2>&1 | tee /dev/tty | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)

# 5. Restore source (un-minify)
echo "Restoring source..."
"$PROJECT_DIR/build.sh" --restore

echo ""
echo "=== Preview Ready ==="
echo "Version: $CURRENT_VERSION"
if [ -n "$PREVIEW_URL" ]; then
    echo "Preview: $PREVIEW_URL"
    echo ""
    echo "Open on phone: $PREVIEW_URL"
    echo ""
    echo "When validated, promote to prod with:"
    echo "  npx vercel promote $PREVIEW_URL --yes"
    echo "Or run full prod pipeline (build + git push + prod deploy):"
    echo "  ./deploy.sh"
else
    echo "(Could not parse preview URL — check Vercel CLI output above.)"
fi
