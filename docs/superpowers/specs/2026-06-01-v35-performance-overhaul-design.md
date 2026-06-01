# v35.0 — Performance Overhaul + Opus 4.8 Migration

**Date:** 2026-06-01
**Owner:** Jordan
**Status:** Spec — implementation pending
**Predecessor commit:** `11a177c` (pre-v35.0 WIP checkpoint, source still on v34.121)

---

## Problem Statement

roweos.com is slow on three concrete axes:

1. **Notebook typing lag** — up to 5s between keystroke and visible output in the Notebook (internally: Scribe). Confirmed user complaint.
2. **Cold-load time + memory pressure** — fresh load is heavy, mobile gets laggy after a session. v34.121 fixed the worst case (Bloom thumbnail fetch storm) but the boot path is still a synchronous Promise.all of 45 Firestore reads, behind 11 serially-loaded CDN libraries, on top of an unminified 10.6 MB single-file SPA.
3. **Progressive lag during a session** — listeners and Object URLs leak; per-keystroke DOM walks; unbounded caches.

Plus a user-requested upgrade:

4. **Claude Opus 4.7 → 4.8** — Anthropic released `claude-opus-4-8` on 2026-05-28 (same price, 4x lower flaw-pass rate, better agentic coding). RoweOS still hardcodes `claude-opus-4-7` in ~25 places across `src/`.

This is shipped as **v35.0**, deliberately named as a major release to signal a step change in feel.

---

## Audit Findings (verified by four parallel Explore agents)

### A. Scribe / Notebook typing lag (`src/js/core/33-scribe.js`)

| File:line | Issue | Per-keystroke cost |
|-----------|-------|-------------------|
| 33-scribe.js:448-450 | Dual `keyup` + `change` event handlers fire twice per character | 2x everything below |
| 33-scribe.js:1584-1596 | `updateScribeWordCount()` calls `editor.getContent({format: 'text'})` (300ms debounce, still walks full DOM tree on long notes) | 50-200ms |
| 33-scribe.js:937-941 | `scheduleScribeAutoSave()` (1000ms debounce) — `editor.getContent()` again + Firestore write + synchronous sidebar list-item DOM mutation | 100ms + network |
| 33-scribe.js:975-977 | Sidebar list item updated synchronously inside save callback | 5-20ms |

Net: 5-7s observable input-to-feedback cycle when network is slow. The 5s number aligns with Firestore latency (2-3s) + 300ms word-count + dual-fire + DOM walk + sidebar mutation.

### B. Boot time (`src/js/core/22-firebase-sync.js`)

| File:line | Issue |
|-----------|-------|
| 01-cdn-and-boot.html | Chart.js, html2canvas, Three.js, jsPDF, PDF.js loaded **without** `async`/`defer` — parser blocks |
| 22-firebase-sync.js:10437-10489 | `Promise.all` of 45 Firestore reads at boot — no progress UI, blocks first meaningful paint |
| 22-firebase-sync.js:2330-2750 | 8 `onSnapshot` listeners attach immediately at boot |
| build.sh | **No minification** — `dist/index.html` ships unminified at 10.6 MB (2.2 MB gzipped). `esbuild` is in `package.json` but unused |
| src/css/core/01-base.css | 1.57 MB monolithic CSS, 101 `@keyframes` (~20 unused) |

### C. Memory leaks

| Rank | File:line | Leak |
|------|-----------|------|
| 1 | 33-scribe.js:1568-1573 | `initScribeResizeHandle()` adds 6 `mousemove`/`mouseup`/`touchmove`/`touchend` listeners on every Scribe view entry. Never removed. |
| 2 | 25-documents-lifeai.js:9181, 10037, 10040 | Goal modal `keydown` listeners re-added on every open, never removed |
| 3 | 20-ui-misc.js:9252, 9340, 9444 | `URL.createObjectURL()` calls in export flows missing matching `revokeObjectURL()` |
| 4 | 25-documents-lifeai.js:5814-5817 | Rhythm widget builder drag listeners re-added on every modal open |
| 5 | 22-firebase-sync.js:2334-2750 | Cross-device snapshot handler closure retains `deviceId` across logouts |

### D. Opus 4.7 references to migrate

~25 sites in `src/`:
- HTML option lists / dropdowns (Studio, Blake, views-batch2, views-batch3, brand/02-studio)
- JS model registries (11-agents, 13-studio, 17-automations, 21-sidebar, 24-lifeai-identity, 25-documents-lifeai, 27-launch-brandai, 29-analytics-commerce, 30-automations-init, 36-evolve, late/00-api-bridge)
- Test fixture (`src/__tests__/critical/agents-facade.test.ts`)
- Streaming call sites (`callAnthropicStreaming('claude-opus-4-7', ...)`)
- Pricing table (`29-analytics-commerce.js:506` — keep entry for historical billing, add 4-8 entry)
- Display name map (`27-launch-brandai.js:752`, `29-analytics-commerce.js:4839`, etc.)

`dist/index.html` does **not** need direct edits — it's regenerated from `src/` by `build.sh`.

---

## Approaches Considered

### Approach 1 — Surgical fixes only (recommended)

Land the highest-impact, lowest-risk fixes from each audit area, version-bump to v35.0, deploy. Defer deeper refactors (CSS split, virtualization, framework rewrite) to follow-up releases.

**Pros:** Ships fast, minimal regression surface. Hits the user's three complaints directly.
**Cons:** 1.57 MB CSS file remains; doesn't tackle the 10K+-line modules.

### Approach 2 — Surgical + minification pipeline

Approach 1 plus wiring `esbuild` into `build.sh` for full bundle minification.

**Pros:** Single largest perf win — 50-70% bundle reduction. esbuild is already a dev dep.
**Cons:** Risk surface: a minifier that misreads ES5 could break a live deploy. Mitigated by running tests + smoke test before deploy.

### Approach 3 — Full architectural overhaul

Approach 2 plus CSS split, list virtualization, lazy-load CDN libs, defer non-critical snapshot listeners.

**Pros:** Biggest gains.
**Cons:** Multi-week scope. Not "v35.0 today".

**Decision: Approach 2.** Surgical fixes ship the user-felt wins (typing lag, leaks, Opus 4.8) plus minification, which alone halves the bundle. Approach 3 items get a placeholder in CHANGELOG and a follow-up spec.

---

## v35.0 Scope (in priority order)

### P0 — Must land

1. **Opus 4.7 → 4.8 migration**
   - Replace `claude-opus-4-7` with `claude-opus-4-8` everywhere in `src/`
   - Update display names "Opus 4.7" → "Opus 4.8" in dropdowns and lists
   - Update the display-name map and pricing table (keep 4.7 entry for historical billing reads, add 4.8)
   - Update streaming call sites
   - Update test fixture
   - **Sources:** [Anthropic announcement](https://www.anthropic.com/news/claude-opus-4-8), [What's new in 4.8](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8)

2. **Scribe typing-lag fixes**
   - Drop dual `keyup`+`change` binding; keep `keyup` for typing, isolate `change` to a separate handler gated to non-typing events (paste, toolbar)
   - Move `updateScribeWordCount()` work into a `requestAnimationFrame` so it doesn't block the input
   - Cache `editor.getContent()` between word-count and autosave so we don't walk the editor DOM twice within 1s
   - Defer the sidebar list-item DOM mutation in autosave to `requestAnimationFrame`

3. **Scribe resize-handle listener leak**
   - Track each `addEventListener` with a paired removal function; remove existing listeners before re-binding in `initScribeResizeHandle()`

4. **Goal modal keydown listener leak**
   - Hoist to a named function reference per modal-instance; call `removeEventListener` on close

5. **Object URL leaks (3 sites)**
   - Add `URL.revokeObjectURL(a.href)` immediately after the synthetic `<a>` click in chat-export, section-export, exit-clip functions

### P1 — Should land (ship together with P0)

6. **Build minification via esbuild**
   - Extend `src/build.sh` to pipe the concatenated output through `esbuild --minify --target=es2015 --loader=html` (or split JS/CSS/HTML and minify each appropriately)
   - Add a `--no-minify` flag for local debugging
   - Keep an unminified copy at `RoweOS/dist/index.unminified.html` for incident debugging
   - Run the 278-test suite before accepting

7. **CDN script async/defer**
   - In `src/html/core/01-cdn-and-boot.html`, add `defer` to: Chart.js, html2canvas, Three.js, jsPDF
   - PDF.js: confirm whether any code expects synchronous availability before flipping (likely fine — PDF render is on-demand)

8. **Boot-time progress feedback**
   - Show a thin gold progress bar at the top while the Promise.all of 45 reads is in flight, and remove it on completion. Pure DOM, zero data dependency. Doesn't speed boot but kills the "is it hung?" feel during the 1-5s window.

### P2 — Deferred to follow-up release (documented in CHANGELOG as "next")

- Split 01-base.css (1.57 MB) into core + per-view stylesheets, lazy-load view CSS
- Prune unused @keyframes (~20)
- Consolidate ten redefinitions of `_isInputTarget`, `_close`, `escH`, `hexToRgb`
- Calendar / Clients / Automations list virtualization
- Defer non-critical `onSnapshot` listeners by 2s post-auth (pulse_goals, calendar)
- Cross-device snapshot handler closure cleanup

These deferrals are intentional and tracked.

---

## Data Flow Changes

None at the data layer. All P0/P1 changes are local to render/event/build pipelines. Sync v4 / v5 untouched. localStorage shape untouched. Firestore schema untouched. Brand portfolio unchanged.

---

## Error Handling

- **esbuild failure** during build halts deploy (build.sh already has `set -e`). The audit script verifies build succeeds.
- **Scribe rAF fallback** — if `requestAnimationFrame` is unavailable (impossible in real browsers but defensive), fall back to `setTimeout(fn, 0)`.
- **Opus 4.8 model unavailable to a user's API key** — Anthropic SDK returns a clear error; no client-side fallback added in v35.0. If reports come in, follow-up adds a graceful fallback to 4.7.

---

## Testing & Validation Plan

1. **Static** — `scripts/pre-deploy-audit.sh` passes (version consistency, build, test suite, ES5 / em-dash / stark-white checks)
2. **Test suite** — `npm test` (vitest) — 278 tests must pass
3. **Type check** — `npm run typecheck`
4. **Manual smoke (local serve)** — boot the bundle, type 30 chars in a Notebook quickly, watch DevTools Performance for input event timing < 50ms
5. **Manual smoke on roweos.com after deploy:**
   - Load homepage, time to interactive
   - Open Notebook, type a paragraph, no perceptible lag
   - Switch between Notebook and Pulse 10 times, check listener count in DevTools (heap snapshot — should not climb)
   - Trigger an export, confirm blob URL revoked (check `chrome://blob-internals/` not strictly required, but no warnings in console)
   - Open Studio dropdown, confirm "Opus 4.8" appears and is selectable
   - Run a small chat request through Opus 4.8, confirm response

---

## Version Bump (8 locations + CLAUDE.md + CHANGELOG)

Per CLAUDE.md ritual. Bump from `v34.121` → `v35.0`:

1. `src/js/core/09-state.js` — `ROWEOS_VERSION`
2. `src/html/core/04-views-batch3.html` — sidebar version span
3. `src/html/core/04-views-batch3.html` — onboarding "vXX" footer
4. `src/html/core/04-views-batch3.html` — onboarding version tag
5. `src/html/core/03-views-batch2.html` — launch screen
6. `src/html/core/03-views-batch2.html` — mobile version display
7. `src/html/shared/21-settings.html` — settings row
8. `CLAUDE.md` — "Version:" line
Plus add a `## v35.0` entry to the top of `CHANGELOG.md` and the new `Version: v35.0` line at the top of CLAUDE.md.

Never `replace_all` on the version string.

---

## Risk

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| esbuild mangles a string-literal-as-code pattern | low | Test suite + manual smoke; keep unminified copy for diff |
| Opus 4.8 not available on a user's API key | low | Anthropic auto-routes; if not, error message clear |
| Scribe rAF deferral changes save semantics | low | Save still triggered, just one frame later |
| Listener cleanup misses an edge case | low | Each fix preserves the original add; only ADDS removal |
| Pre-deploy audit script fails on new version string | none | Script already grep-matches `v\d+\.\d+` — v35.0 matches |

---

## Deploy Plan

```bash
cd ~/Developer/roweOS
bash scripts/pre-deploy-audit.sh    # must exit 0
bash src/build.sh                    # regenerates dist/index.html with minify
./deploy.sh                          # commits, pushes, vercel --prod
```

Verify live at https://roweos.com after deploy completes.

---

## Sources

- [Anthropic — Introducing Claude Opus 4.8](https://www.anthropic.com/news/claude-opus-4-8)
- [What's new in Claude Opus 4.8](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8)
- [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)

---

## Self-Review

- Placeholders: none
- Internal consistency: P0/P1 sections match priority order in implementation
- Scope: focused on the three user complaints + the requested model upgrade; refactors explicitly deferred
- Ambiguity: "rAF deferral" defined in concrete terms; minify scope (target=es2015) explicit

Spec ready.
