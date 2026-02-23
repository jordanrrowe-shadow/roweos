# Suggested Commands

## Deploy to Production
```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project" && ./deploy.sh
```
Handles: version sync to CLAUDE.md, git commit+push, ZIP rebuild, Vercel deploy.

## Manual Vercel Deploy (fallback)
```bash
cd RoweOS/dist && npx vercel --prod
```

## Build Minified Version
```bash
./build.sh
```

## Git
Standard git commands — repo is at project root.
```bash
git status
git log --oneline -10
git diff
```

## Grep/Search (Darwin)
```bash
# Search in main file
grep -n "functionName" RoweOS/dist/index.html

# Count braces (bracket balance check)
echo "{ count: $(grep -o '{' RoweOS/dist/index.html | wc -l | tr -d ' ')"
echo "} count: $(grep -o '}' RoweOS/dist/index.html | wc -l | tr -d ' ')"

# Find version strings
grep -n "v15\." RoweOS/dist/index.html | head -20
```

## No Testing Framework
All testing is manual — no automated tests exist.

## No Linting/Formatting
No linter or formatter configured. Code style is enforced by convention (see style_conventions.md).
