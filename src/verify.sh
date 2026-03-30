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
