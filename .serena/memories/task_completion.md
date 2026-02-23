# Task Completion Checklist

## After Every Code Change
1. **Bump version** — Update v15.XX → v15.XX+1 in all 8 locations + CLAUDE.md
2. **Tag changes** — Add `// v15.XX: Description` comments to modified code
3. **No automated tests** — Verify manually or reason about correctness
4. **No linter** — Ensure ES5 compliance manually (no const/let/arrows/template literals)

## Deployment
Run: `./deploy.sh` from the project root. It handles git commit, push, ZIP rebuild, and Vercel deploy.

## Common Patterns to Verify
- If editing a function called from multiple paths, check ALL call sites (e.g. `runOp()` has onSuccess + onError)
- If adding a new view render function, ensure it's called on view open AND after data changes
- If touching localStorage keys, verify both reader and writer use the same key format
- If adding fields to a modal, ensure the save handler reads ALL fields back
