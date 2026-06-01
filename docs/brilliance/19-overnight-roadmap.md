# Brilliance — Overnight Build Roadmap (post v33.68)

**Last update:** 2026-04-30 11:35
**Live:** v33.68 at roweos.com
**Tests:** 239/239 passing
**Snapshot of what shipped this session:** v33.50 → v33.68 (19 deploys)

---

## What's done (this session)

### Bug fixes (the costly ones)
- **v33.59** — `#evolveView` was missing from all 6 panel-position selector groups. Evolve was rendering as a 918px box on the right of an empty 1221px parent. Fixed by adding evolveView to every panel-position selector list.
- **v33.63 / v33.64 / v33.65** — Three orphaned globals (`todos`, `getTodosKey`, `initTodos`, `initDeletedBrands`, `scheduledPrompts`) and four unguarded init calls left over from the v28.8 Focus retirement. Each was throwing `ReferenceError` somewhere on every page load or scheduler tick. Rhythm calendar has been silently broken since v28.8 because of this.
- **v33.64** — `ical.js@2.1.0` ESM bundle was failing under classic-script load (`Unexpected token export`). Pinned to `ical.js@1.5.0` UMD.
- **v33.66** — Firestore `chat_migration` doc path had odd-segment count. Split into `_meta/chat_migration` (4 segments).

### Light-mode contrast (per user "deeper color + white-on-white")
- **v33.59** — first batch of light-mode color overrides for Evolve (goal, countdown, pill nav, context chip, today hero, empty state, translator pane, verify badges, quiz card)
- **v33.60** — bg-primary `#ffffff` → `#f5f3ee` (warm cream); bg-secondary, bg-hover, borders shifted proportionally; mobile body bg + `--mobile-bg` updated
- **v33.61** — extended Evolve light-mode coverage to skill cards, all 5 quiz option states, why-matrix, verify input/submit
- **v33.62** — concierge pill row light-mode (.val text + dismiss × were invisible)
- **v33.68** — Evolve Today/Practice/Verify/Skills inline-style colors picked at render time via `_c(dark,light)` helper. Hero card, daily task cards, profile editor modal, editor modal all now contrast-correct.

### Brand consistency (~50 user-visible RoweOS → Brilliance)
- v33.54–v33.58 across launch description, "Explore Brilliance", "Export Brilliance", "Brilliance Helper", calendar provider labels, model auto-routing, ~20 email subjects/bodies/CTAs, PDF cover/filename fallbacks, admin emails dashboard, Studio op descriptions

### New surfaces shipped
- **v33.50** — Evolve flat layout (Studio pattern, no nested dark shell)
- **v33.51** — Evolve mobile parity at 768px / 380px breakpoints
- **v33.52** — Evolve `?` help button + 6-step guided tour + `window.showEvolveSection` tabHandler wrapper
- **v33.53** — Evolve goal text + empty-state context chip both clickable to profile editor
- **v33.67** — **Focus Mode (Negative Space)** — Cmd+Shift+F universal toggle, strips ambient chrome, leaves active surface + Brilli + input. Esc exits. Pulsing gold dot in corner.

---

## What's next (in priority order)

### Tier 1 surface modifiers (the easiest wins)
1. ✅ **Concierge Desk pill row** — already shipped earlier
2. ✅ **Focus Mode** — shipped v33.67
3. **History → Time Ribbon** (next, est. 1–2 versions) — replace the current History list with a horizontal scrubbing timeline; markers per conversation moment; "Branch from here" creates a new chat session starting from that moment; "Summarize this period" when scrubbed range is long. Internal `data-view="tuning"` stays.

### Tier 2 surface rebuilds (visible UI changes, larger refactor)
4. **Studio → Split-Pane Workspace** — left pane (30–50% draggable) conversation, right pane live artifact streaming. Brilli at the divider showing where attention is. Provide "classic Studio" mode toggle in Settings for 90 days.
5. **Folio → Studio at Work** — left rail tools (80px), center easel (the artifact), right pane (320px) chat about this artifact. Existing pipeline logic stays; visualization changes. "Classic Folio" toggle for 90 days.
6. **Notebook (Scribe rebrand) → Letter Series** — cream-paper theme, gold drop caps, marginalia, max-width 720px center column. Existing Scribe data + flows preserved. (Note: data-view stays `scribe`.)

### Tier 3 (new surface, v34+)
7. **Thought Board** — new view (sidebar group: Core or Create). Two modes: Pinboard (free-form active manipulation) and Constellation (2D navigation of pinned items). Cards from Chat / Notebook / Studio can be pinned. AI-suggested links between cards via embedding clustering. Mobile single-column.

### Architecture (parallel track, low user-visible impact)
8. **Sprint 1 — services/sync hardening** — flip `// @ts-nocheck` to ts-check + JSDoc types in `22-firebase-sync.js`. Migrate read paths to `services/sync/index.ts`.
9. **Sprint C — Multi-model Quiz Engine** — Gemini Deep Research → GPT-5.5 Thinking → JSON pipeline. Hook is registered as `evolve_nightly_content` automation; needs the multi-model implementation.
10. **Sprint E — Verifier Engine** — Gemini + GPT-5.5 Pro cross-review with mandatory 3 citations.
11. **Sync v5 dual-write activation** for v4-shadowed collections (gate behind 14-day zero-discrepancy).
12. **CSS cleanup** — 78 KB of inert `.focus-2-*` selectors. Needs proper postcss tooling.

### Other open items from MEMORY.md "Next Session Priorities"
- Email log not recording sent emails (server-side debug)
- onboarding_responses subcollection vs collection-group query mismatch
- Server email templates (logo + styling) — partial
- Campaigns/Responses dashboard
- Onboarding redesign (remove access key from user-facing flow)
- People/Clients data cleanup (9 dashboard vs 0 pipeline)
- Cloud Pub/Sub Scheduler (spec at `docs/superpowers/specs/2026-04-16-phase1-ai-ops-platform-design.md`)

---

## How to triage between iterations

For overnight autonomous work, prefer in this order:
1. **Bugs that block production users** (calendar, sync errors, auth) — highest priority, ship immediately
2. **Visible polish requested by user** (light-mode contrast, brand consistency) — ship in batches
3. **Tier 1 surface modifiers** (Focus Mode, Time Ribbon) — contained scope, high visibility
4. **Tier 2 surface rebuilds** — multi-version effort, plan carefully
5. **Architecture** — risky overnight without supervision

Anything risky to data integrity (sync v5 activation, schema migrations, deletion paths) requires user review before shipping.

---

## Quick reference

- Start each version: bump 8 locations + CHANGELOG (CLAUDE.md "Version Updates" lists them)
- Build: `bash src/build.sh`
- Test: `npx vitest run` (must hit 239/239)
- Deploy: `./deploy.sh`
- Live verify: Playwright `https://roweos.com?cb=v33.X` to confirm no console errors
