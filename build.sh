#!/bin/bash
# RoweOS Build Script
# Step 1: Concatenate src/ into index.html
# Step 2: Optionally minify for production
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Handle --restore flag (for post-deploy un-minify)
if [ "$1" = "--restore" ]; then
    BACKUP_FILE="$PROJECT_DIR/RoweOS/dist/index.src.html"
    SRC_FILE="$PROJECT_DIR/RoweOS/dist/index.html"
    if [ -f "$BACKUP_FILE" ]; then
        mv "$BACKUP_FILE" "$SRC_FILE"
        echo "Restored source from backup"
    else
        echo "No backup found"
    fi
    exit 0
fi

# Step 1: Modular build
bash "$PROJECT_DIR/src/build.sh"

# Step 2: Minify (only if --minify flag passed)
if [ "$1" = "--minify" ]; then
    SRC_FILE="$PROJECT_DIR/RoweOS/dist/index.html"
    BACKUP_FILE="$PROJECT_DIR/RoweOS/dist/index.src.html"

    if ! npx html-minifier-terser --version > /dev/null 2>&1; then
        echo "Installing html-minifier-terser..."
        npm install -g html-minifier-terser
    fi

    cp "$SRC_FILE" "$BACKUP_FILE"

    # v30.4: Skip minification entirely — just copy the file as-is
    # CSS minifier breaks @keyframes animations (splash opacity stays 0)
    # JS compress breaks control flow (removes return statements)
    cp "$BACKUP_FILE" "$SRC_FILE"
    echo "Skipping minification (disabled in v30.4)"

    ORIG_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
    MIN_SIZE=$(wc -c < "$SRC_FILE" | tr -d ' ')
    SAVINGS=$(( (ORIG_SIZE - MIN_SIZE) * 100 / ORIG_SIZE ))
    echo "Minified: ${SAVINGS}% savings"
fi
