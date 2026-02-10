#!/bin/bash
# RoweOS Build Script
# Minifies index.html for production deployment
# Usage: ./build.sh [--restore]

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_FILE="$PROJECT_DIR/RoweOS/dist/index.html"
BACKUP_FILE="$PROJECT_DIR/RoweOS/dist/index.src.html"

if [ "$1" = "--restore" ]; then
    if [ -f "$BACKUP_FILE" ]; then
        mv "$BACKUP_FILE" "$SRC_FILE"
        echo "Restored source from backup"
    else
        echo "No backup found"
    fi
    exit 0
fi

echo "=== RoweOS Build ==="

# Check if html-minifier-terser is available
if ! npx html-minifier-terser --version > /dev/null 2>&1; then
    echo "Installing html-minifier-terser..."
    npm install -g html-minifier-terser
fi

# Backup source
cp "$SRC_FILE" "$BACKUP_FILE"
echo "Backed up source to index.src.html"

# Minify
echo "Minifying..."
npx html-minifier-terser \
    --collapse-whitespace \
    --remove-comments \
    --minify-css true \
    --minify-js "{\"mangle\":false,\"compress\":{\"drop_console\":false}}" \
    < "$BACKUP_FILE" > "$SRC_FILE"

ORIG_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
MIN_SIZE=$(wc -c < "$SRC_FILE" | tr -d ' ')
SAVINGS=$(( (ORIG_SIZE - MIN_SIZE) * 100 / ORIG_SIZE ))

echo "Original: ${ORIG_SIZE} bytes"
echo "Minified: ${MIN_SIZE} bytes"
echo "Savings:  ${SAVINGS}%"
echo "=== Build Complete ==="
