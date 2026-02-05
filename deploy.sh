#!/bin/bash
# RoweOS Deploy Script
# Syncs version to CLAUDE.md, commits, pushes to git, and deploys to Vercel

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=== RoweOS Deploy ==="

# 1. Extract current version from index.html (in extracted folder or zip)
if [ -f "RoweOS/dist/index.html" ]; then
    CURRENT_VERSION=$(grep -o "v[0-9]*\.[0-9]*\.[0-9]*" RoweOS/dist/index.html | head -1)
else
    CURRENT_VERSION=$(unzip -p RoweOS.zip "RoweOS/dist/index.html" | grep -o "v[0-9]*\.[0-9]*\.[0-9]*" | head -1)
fi

if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Could not extract version from index.html"
    exit 1
fi

echo "Current version: $CURRENT_VERSION"

# 2. Extract line count from index.html
if [ -f "RoweOS/dist/index.html" ]; then
    LINE_COUNT=$(wc -l < RoweOS/dist/index.html | tr -d ' ')
else
    LINE_COUNT=$(unzip -p RoweOS.zip "RoweOS/dist/index.html" | wc -l | tr -d ' ')
fi

echo "Line count: $LINE_COUNT"

# 3. Update CLAUDE.md with current version and line count
if [ -f "CLAUDE.md" ]; then
    # Update version in quick reference
    sed -i '' "s/Version:  v[0-9]*\.[0-9]*\.[0-9]*/Version:  $CURRENT_VERSION/" CLAUDE.md

    # Update line count in quick reference
    sed -i '' "s/index.html ([0-9,]* lines)/index.html ($LINE_COUNT lines)/" CLAUDE.md

    # Update line count in file structure
    sed -i '' "s/Lines 44,000–[0-9,]*/Lines 44,000–$LINE_COUNT/" CLAUDE.md

    # Update version comment example
    sed -i '' "s|// v[0-9]*\.[0-9]*\.[0-9]*: Fix brand name|// $CURRENT_VERSION: Fix brand name|" CLAUDE.md

    # Calculate next version for sed example (increment patch)
    MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1 | tr -d 'v')
    MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
    PATCH=$(echo $CURRENT_VERSION | cut -d. -f3)
    NEXT_PATCH=$((PATCH + 1))
    NEXT_VERSION="v$MAJOR.$MINOR.$NEXT_PATCH"

    # Update sed command examples
    ESCAPED_CURRENT=$(echo $CURRENT_VERSION | sed 's/\./\\./g')
    sed -i '' "s|sed -i '' 's/v[0-9]*\\\.[0-9]*\\\.[0-9]*/v[0-9]*.[0-9]*.[0-9]*/g' index.html|sed -i '' 's/$ESCAPED_CURRENT/$NEXT_VERSION/g' index.html|" CLAUDE.md
    sed -i '' "s|grep -c 'v[0-9]*\\\.[0-9]*\\\.[0-9]*' index.html  # Should be 0|grep -c '$ESCAPED_CURRENT' index.html  # Should be 0|" CLAUDE.md
    sed -i '' "s|grep -c 'v[0-9]*\.[0-9]*\.[0-9]*' index.html  # Should be 10+|grep -c '$NEXT_VERSION' index.html  # Should be 10+|" CLAUDE.md

    echo "Updated CLAUDE.md"
fi

# 4. Ensure RoweOS/dist exists (extract from zip if needed)
if [ ! -f "RoweOS/dist/index.html" ]; then
    echo "Extracting RoweOS.zip..."
    unzip -o RoweOS.zip
fi

# 5. Check for changes and commit
if ! git diff --quiet CLAUDE.md 2>/dev/null || ! git diff --quiet RoweOS/dist/ 2>/dev/null; then
    echo "Staging changes..."
    git add CLAUDE.md RoweOS/dist/ .gitignore 2>/dev/null || true

    if ! git diff --cached --quiet; then
        echo "Committing..."
        git commit -m "$CURRENT_VERSION: Sync and deploy

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
        echo "Committed changes"
    fi
fi

# 6. Push to git
echo "Pushing to git..."
git push origin main

# 7. Deploy to Vercel
echo "Deploying to Vercel..."
cd RoweOS/dist
npx vercel --prod

echo ""
echo "=== Deploy Complete ==="
echo "Version: $CURRENT_VERSION"
echo "Git: pushed to origin/main"
echo "Live: https://roweos.vercel.app"
