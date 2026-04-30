# Brilliance — Master Integration Roadmap

**Status:** Master plan, draft v0.1, sequencing all v33.0 → v35+ work
**Owner:** Jordan
**Active version:** v32.1 (current production)
**Date written:** 2026-04-29
**This is the single source of truth.** All other docs in `docs/brilliance/` are referenced from here.

---

## Where we are today (snapshot)

### Production state
- **v32.1 live** at roweos.com
- 10 paying clients, ~$500/month MRR
- Google for Startups Cloud Program member
- `/brilliance` landing page deployed (manifesto edition with Brilliance + RoweOS lockup)
- `/info` has the "Now Brilliance" pill linking to `/brilliance`
- Sync v4 healthy, no resurrection bugs in months
- Memory engine + 16 strategy docs in `docs/brilliance/`

### What's locked (decisions made)
1. **Option A**: Brilliance is the namesake, RoweOS is the engine credit. Code-internal stays RoweOS.
2. **No rewrite from scratch.** Hybrid path: brand layer now, modular refactor over 12 months.
3. **Build pipeline starts now** (esbuild). TypeScript adoption is hybrid: `.ts` for new modules, `// @ts-check` + JSDoc on existing high-risk files.
4. **Test stack**: Vitest + Playwright + Firebase emulator. Three critical-path test files first (sync, agents, Stripe).
5. **Marketing language**: "Brilliance has always been inside of RoweOS" or "Brilliance is the platform you've built into."
6. **Surface system**: each chat-concept becomes a different surface. Confirmed.
7. **Brilli direction**: pending — runners-up are Celestial Orb, Firefly (with editable wings), Light Signature, Aura/Field, Minimal Ring, Energy Core, plus Classic BLAKE preserved. **Selectable in Settings**, with one form chosen as the marketing-default.
8. **Sync v5**: continuous, timestamp-based, dual-write migration. Cross-collection cascade lives in services layer.
9. **New feature**: Evolve (skill-building + brand SOPs). Built fresh under the architecture playbook as the reference implementation.

### What's still open (will resolve as we go)
- Final Brilli direction pick (decision deadline before Phase C of v33.0)
- Domain decision (brillianceos.ai - reserve, switch, or skip)
- Welcome modal copy variant (A/B/C)
- A few sync v5 defaults (banner thresholds, GC mode)
- /info overhaul Option 1 (surgical) vs Option 2 (full rebuild)

---

## The four-release arc

| Release | Theme | Length | Lands |
|---|---|---|---|
| **v33.0** | "Welcome to Brilliance" — brand layer | ~5 weeks | Brand swap visible to users |
| **v33.5** | Foundation — tooling + Evolve start | ~6 weeks | Build pipeline, tests, Evolve Phase 1 |
| **v34** | Sync v5 dual-write + Evolve full + Tier 2 surfaces | ~17 weeks | Sync rewrite invisible to users; Evolve full; new chrome on Studio/Folio/Notebook |
| **v35** | Surface independence + Tier 3 (Thought Board) | ~12 weeks | Lazy-load surfaces, Thought Board ships |

**Total: ~10 months from today to v35.** Each release ships independently. No "switching day" anywhere.

---

## v33.0 — The Welcome Release (5 weeks)

**Goal:** every user-facing surface says Brilliance. Brilli has a face. Welcome modal greets existing users on first launch. Three new surfaces ship (Concierge Desk, Time Ribbon, Focus Mode). The cleanup pass removes ~6,100 lines of dead code.

### Phase A — Foundation prep (week 1)
Already largely complete:
- Asset library finalized in `dist/images/brilliance/`
- 16 strategy docs in `docs/brilliance/`
- 14 mockup pages live at `/brilliance-mockups/`
- Memory updated with locked decisions

Still to do:
- Pick final Brilli direction (1 day, Jordan)
- Approve welcome modal copy variant (1 day, Jordan)
- Lock the surface inventory rename map (already drafted in `03-in-app-rename.md`)

### Phase B — Cleanup (week 2)
Per `04-cleanup-targets.md`. Six small commits, one or two deploys.

- B1: Delete Focus/Signal residue (~6,000 lines, 11 files)
- B2: Delete `info.OLD.backup.html`, `index.reference.html`, two corrupted ZIP fragments
- B3: Move 25 shipped planning specs to `docs/superpowers/specs/archive/`
- B4: Delete 38 unused images (29 mobile screenshots, 9 desktop)
- B5: Delete orphaned HTML pages (`social2.html`, `social3.html`, `executive-summary.html`, `overview.html`, `demos.html`, `blake-studio.html`, `export-blake-bg.html`, `login.html`) + `api/session.js` + their vercel routes
- B6: Delete `autoTrimDataForSync()` + stale comments. Update MEMORY.md "Next Session Priorities."

**Deliverable:** ~89 MB disk reclaimed, 9 dead pages removed, 1 dead API endpoint removed. Codebase smaller and cleaner before the rebrand work begins.

### Phase C — Brilli production (week 2-3 in parallel with B)
Per `05-brilli-animation.md`.

- Build `src/js/core/29-brilli.js` Canvas 2D module (~10KB ES5)
- Six-state state machine (idle, attending, thinking, delivering, pleased, asleep)
- Three sizes (hero, inline, pin)
- Reduced-motion fallback (static SVG)
- Wire into chat landing (replaces blob)
- Wire into launch screen
- Wire into thinking indicator (replaces dot loaders)
- Sidebar status dot
- Performance audit on iPhone 12 + 15 Pro

**Deliverable:** Brilli renders smoothly at 60fps idle, 30fps thinking on mobile. Static fallback for reduced motion.

### Phase D — Surface rebrand (week 3-4)
Per `03-in-app-rename.md`. Six sub-phases:

- D1: Core titles + manifest + identity strings (~50 strings, 4 files)
- D2: Onboarding + settings (~45 strings, 2 files)
- D3: Modals + AI feature labels ("RoweOS AI" → "Brilliance AI")
- D4: Toasts + push notifications + tour
- D5: Brilliance Helper agent + export branding (PDFs, JSON exports)
- D6-D7: Email templates (server-side + client-side)

After D6, send a real welcome email to test address — verify "Brilliance" header, body, from-name.

**Deliverable:** Final grep for user-facing "RoweOS" returns ~zero results outside the explicit "by RoweOS" engine credit.

### Phase E — Welcome experience (week 4)
Per `02-welcome-experience.md`.

- Build modal with Brilli intro animation, wordmark, copy, Continue CTA
- Wire trigger logic: `firebaseUser.metadata.creationTime < v33.0_deploy_timestamp` AND `localStorage.brilliance_welcomed_v33` not set
- Sync flag to Firestore `users/{uid}/profile/welcomed_v33`
- ESC + click-outside dismiss
- Mobile full-bleed variant
- Failure-safe (if modal errors, set flag and skip)

**Deliverable:** Welcome modal shows once per existing user on first launch after v33.0 deploy. Never again.

### Phase F — Site overhaul (week 4-5)
Per `06-info-overhaul.md`. Option 1 (surgical update) for v33.0:

- `/info`: rename "RoweOS" → "Brilliance", swap fonts to Old Standard TT, add Meet Brilli section, refresh hero with new wordmark, remove "Now Brilliance" pill, refresh Cross-mode intelligence section
- `/portfolio`: rename pass + Old Standard TT typography
- `/purchase`: rename pass + tier name updates
- `/social`, `/social-callback`: rename pass
- One-pager regenerated

**Deliverable:** External traffic lands on a coherent Brilliance world.

### Phase G — Launch (week 5)
- Version bump to v33.0 in all 8 locations + CLAUDE.md
- CHANGELOG entry written
- Deploy via `./deploy.sh`
- Monitor first-day error logs aggressively
- In-app banner for 48 hours: "Welcome to Brilliance. Same platform. New name."
- Public announcement: 1 week later (per launch strategy doc)

**Deliverable:** v33.0 live. Existing users opening the app see Brilliance. Welcome modal greets them. Everything they built is exactly where they left it.

### v33.0 success criteria
1. Zero user-visible "RoweOS" mentions outside the explicit engine credit
2. Brilli renders at 60fps idle on iPhone 12-class devices
3. Email-system bugs from `project_email_system_bugs.md` either fixed or endpoints deleted
4. Focus/Signal has zero remaining code paths (one redirect line preserved)
5. Welcome modal shows once per user, never again
6. No data loss; all 10 paying clients can find their work exactly where they left it
7. CHANGELOG and CLAUDE.md updated; memory file `project_brilliance_v33.md` marks status: shipped

---

## v33.5 — Foundation (6 weeks, after v33.0 lands)

**Goal:** the architecture foundation that all future work stands on. Build pipeline + tests + first typed services + Evolve Phase 1.

### Sprint 0 — Tooling (1-2 weeks)
Per `15-architecture-playbook.md` Sprint 0.

- Add devDeps: `esbuild`, `vitest`, `typescript`, `@types/node`, `eslint`, `@typescript-eslint/parser`, etc.
- Create `tsconfig.json` with `checkJs: true`, `allowJs: true`, strict
- Create `build.config.ts` replacing `src/build.sh` concatenation
- Create `vitest.config.ts`
- Set up Firebase emulator (`firebase.json` + `firestore.rules.test`)
- Add npm scripts: `dev`, `build`, `test`, `test:critical`, `typecheck`, `lint`
- Wire `deploy.sh` to call `npm run typecheck && npm run test:critical && npm run build` before pushing
- Document setup in CLAUDE.md "Development Workflow" section

**Deliverable:** Single command (`npm run dev`) builds + watches. Single command (`npm test`) runs all tests. Deploys are gated on tests passing.

### Sprint 1 — services/sync extraction (2 weeks)
Per `15-architecture-playbook.md` Sprint 1.

- Add `// @ts-check` + JSDoc to `src/js/core/22-firebase-sync.js`
- Create `src/services/sync/index.ts` wrapping the existing implementation
- Type the public API: `writeDB`, `readDB`, `watchDB`, `deleteDBDoc`, `mergeByTimestamp`, etc.
- Write tests covering past production bugs:
  - `_normalizeTs` ISO string vs ms numeric
  - `mergeByTimestamp` empty cloud array as deletion
  - `safeSyncWrite` overwriting expected fields
  - `_all` doc subset preventing data loss
  - Tombstone scrub on startup
- Migrate the 3-5 most-used callers to import from `services/sync`

**Deliverable:** Existing sync still works (untouched implementation). New typed interface for future code. ~15 regression tests in place.

### Sprint 2 — services/agents extraction (2 weeks)
- Same pattern for `src/js/core/11-agents.js`
- Type `AgentId`, `ContentBlock`, `ToolCall`, `AgentResponse`
- Test model routing, system prompt assembly, multi-agent dispatch
- Type the Brilliance Helper agent specifically (its system prompt is the most tweaked thing in the codebase)

### Sprint 3 — Stripe webhook hardening (1 week)
- Type `api/stripe-webhook.js`
- Test signature verification + both purchase types (api_key_purchase, subscription)
- Run against Stripe's webhook tester in CI

### Sprint 4 — Evolve Foundation + Sprint A (Pulse Dashboard, 2 weeks)
Per `14-evolve.md` v0.2 Sprint A.

- `services/evolve/state.ts` — Zustand store + `EvolveProfile` type
- `services/evolve/prompt-injector.ts` — `generateEvolveSystemPrompt(profile)` (the Translator pattern)
- `EvolveDashboard.tsx` — countdown + Pomodoro 25/5 + XP bar + tutor-pose Brilli
- Wire into Pulse view (new "Today's Evolve load" card)
- Sidebar nav adds "Evolve" view
- Tests for prompt injection + state mutations

**Deliverable:** Pulse Dashboard (Pillar I) live; user can set targetGoal + cognitiveProfile; daily countdown visible.

### v33.5 success criteria
1. `npm run build` produces a deployable bundle from a clean checkout in <30s
2. `npm test` runs 50+ tests in <10s, all passing
3. Build pipeline used by `deploy.sh`
4. `services/sync`, `services/agents`, `services/stripe` all typed and tested
5. Evolve Sprints A + B deployed (Pulse Dashboard + Liquid Rhythm Planner); existing users see new "Evolve" tab with countdown + 3 daily micro-tasks + Recalibrate button
6. CLAUDE.md updated with development workflow + module organization
7. Memory updated; `project_brilliance_v33.md` extended with v33.5 status

### Why two Evolve sprints land in v33.5 (not all in v34)
Sprints A + B (Pulse Dashboard + Liquid Rhythm) ship in v33.5 because they prove the architecture playbook works. The user has a working Evolve experience earlier — a target goal, a daily load, a recalibrate button — even before the Quiz Engine + Translator + Verifier ship in v34. This phased approach lets users start using Evolve as a study planner immediately, then upgrade to the full multi-model pipeline as v34 unfolds.

---

## v34 — Sync v5 + Evolve Full + Tier 2 Surfaces (17 weeks)

**Goal:** the structural rewrite. Sync v5 dual-writes for 4 weeks, reconciles for 2 weeks, switches reads, retires v4 over 30 days. Evolve completes. Tier 2 surfaces (Studio split-pane, Folio at-work, Notebook Letter Series) ship.

### Track 1 — Sync v5 (parallel to other tracks, 17 weeks total)
Per `16-sync-v5.md`.

- Weeks 1-4: build v5 implementation (Collection<T>, SyncEngine, conflict resolution, offline queue, schema migrations)
- Weeks 5-6: wire dual-write for first 3 collections (brands, conversations, automations); deploy
- Weeks 7-8: wire dual-write for remaining collections; reconciliation cron deployed
- Weeks 9-10: zero-discrepancy bar (must hit 14 consecutive days)
- Week 11: read switch for Jordan only; monitor 7 days
- Weeks 12-13: read switch for 10% → 100% of users
- Weeks 14-17: 30-day stability period; v4 retirement
- Week 17: decommission v4 implementation files

### Track 2 — Evolve Sprints B-G (12 weeks)
Per `14-evolve.md` v0.2 build plan.

- **Sprint B** (2 wks): Liquid Rhythm Planner — `recalibrateMomentum()` algorithm + UI + framer-motion micro-interactions. Anti-ADHD discipline. (Pillar II)
- **Sprint C** (3 wks): Infinite Assessment Engine — nightly Gemini Deep Research → GPT-5.5 Thinking → JSON questions → QuizCard with Why/Why Not Matrix. (Pillar III, the heart of Evolve)
- **Sprint D** (1.5 wks): Context Translator — Claude 4.7 Opus two-pane mini-app. (Pillar IV)
- **Sprint E** (1.5 wks): Deep Verification Studio — Gemini + GPT-5.5 Pro peer-review with VERIFIED/CORRECTED badge + citations. (Pillar V)
- **Sprint F** (2 wks): Storage Layer — Skills/Sources/Reflections/SOPs Collections via sync v5; Constellation + Library + Notebook integration.
- **Sprint G** (2 wks): Veo 3.1 Bonus — auto-detect 3+ failures on spatial concepts → trigger Veo → save video to Library. Cross-surface polish (History markers, Identity feed).

**Total Evolve scope: ~14 weeks across v33.5 + v34** (was ~8 weeks in v0.1; the PDF added Liquid Rhythm, Multi-model Quiz Engine, Translator, Verifier, Veo as first-class capabilities).

### Track 3 — Tier 2 surfaces (8 weeks)
Per `12-surface-system.md` Tier 2.

- Studio → Split-Pane Workspace (3 weeks): pull current Studio chrome out, build new layout, classic-mode toggle for 90 days
- Folio → Studio at Work (2 weeks): easel layout, tools rail, contextualized chat
- Notebook (Scribe rebrand) → Letter Series (2 weeks): cream-paper theme, gold initial caps, marginalia
- /info overhaul Option 2 if Option 1 fell short (1 week)

### v34 success criteria
1. Sync v5 is canonical; v4 files removed
2. Zero data-related support tickets in the v5 stability period
3. Evolve fully shipped: Skills + Sources + Reflections + Repetition + Brand SOPs
4. Studio + Folio + Notebook on new chrome with classic-mode toggles
5. Brilli pulse drives the Sync UI as designed
6. Bundle size has not regressed (build pipeline catches this)

---

## v35 — Tier 3 + Surface Independence (12 weeks)

**Goal:** Thought Board ships as a new view. Surfaces become independently lazy-loaded modules. The 9.7MB index.html problem is solved. New features drop in without touching the bundle.

### Track 1 — Thought Board (6 weeks)
Per `12-surface-system.md` Tier 3.

- New `data-view="board"` view added to sidebar
- Two view modes: Pinboard (active manipulation) and Constellation (navigation)
- Cards from Chat, Notebook, Studio can be pinned to Thought Board
- Cross-surface deep links (pin from Chat keeps the link live)
- AI-suggested links between cards via embedding clustering
- Mobile single-column adaptation

### Track 2 — Surface independence (6 weeks)
Per `15-architecture-playbook.md` Sprint 5+.

- `services/brand` extraction (the gateway: `window.brands` + `window.selectedBrandIdx` + every brand-state caller migrated)
- Each surface (Chat, Studio, Folio, Pulse, Library, Bloom, Automations, Mail, Settings, Identity, History, Notebook, Evolve, Thought Board) becomes a lazy-loaded module
- Build output is now ~15 chunks instead of one 9.7MB file
- Active surface loads on demand; cold surfaces stay on disk
- Service Worker pre-caches likely-next surfaces

### Track 3 — Marketing site evolution
- /portfolio fully refreshed for the v35 era (per investor framework if pursuing)
- Demo videos / case studies added
- One-pager updated

### v35 success criteria
1. Thought Board live; users can pin/branch/explore
2. Initial bundle size drops from 9.7MB to <2MB
3. Page load time on slow 4G drops by 60%+
4. New surfaces can be added in <1 week without touching unrelated code
5. Architecture is "done" — future work is feature work, not infrastructure

---

## v36+ speculation (not committed)

- Native iOS/Android apps (services layer is platform-agnostic by then; React Native shell with shared services)
- Multi-user / team mode (operational transform layer for collaborative editing)
- E2EE conversation (Signal Protocol or similar; would be v6 sync)
- Investor pitch (when traction supports it; framework already in `07-investor-framework.md`)

These belong on the horizon, not in any sprint.

---

## Critical path (what blocks what)

```
v33.0 cleanup (B) ─────┐
                       ├─→ v33.0 surface rebrand (D) ─→ v33.0 launch (G)
v33.0 Brilli (C) ──────┤
                       └─→ v33.0 welcome modal (E) ────────┘
                                                            ↓
                                          v33.5 tooling (Sprint 0)
                                                            ↓
                                  v33.5 service extractions (Sprints 1-3)
                                                            ↓
                              ┌─→ Evolve Phase 1 (Sprint 4) ──→ Evolve Phases 2-4 (v34)
                              └─→ Sync v5 build (v34 weeks 1-4) ──→ dual-write (5-6) ──→ reconcile (7-8) ──→ zero-disc (9-10) ──→ canary (11) ──→ rollout (12-13) ──→ retire v4 (14-17)
                                                                                                                                                            ↓
                                                                                                                                            v35 Thought Board + surface independence
```

**The single biggest dependency:** v33.0 must ship cleanly before v33.5 tooling work begins. Don't try to refactor and rebrand simultaneously — the surface rebrand is delicate enough on its own.

**The single biggest risk:** Sync v5 dual-write doubles Firestore costs for 6 weeks. At current 10 clients, negligible. Past 50 clients, monitor.

---

## Cross-cutting threads (every release applies these)

### 1. Brand consistency review
Every PR touching user-visible strings runs a grep for "RoweOS" and "roweOS" outside the engine-credit pattern. Block on any new occurrences.

### 2. Mobile parity verification
Every new or refactored surface ships with a mobile test on iPhone 12 + 15 Pro. No surface ships desktop-only.

### 3. Test coverage
Every refactor lifts tests with it. Coverage on `services/*` is the bar; coverage on legacy `src/js/core/*` is opportunistic.

### 4. Memory updates
Every session touching new architectural ground updates `project_brilliance_v33.md` (or v34 etc.) with status. CLAUDE.md updated when development workflow changes.

### 5. Performance budget
Bundle size, FPS budgets, frame-time budgets per surface. Fail tests if regressions exceed thresholds.

### 6. The cultural rule from `15-architecture-playbook.md`
**No new code without a spec block. No refactor without tests. No "I'll figure it out as I go."**

---

## Decisions still open (and when they need to resolve)

| Decision | Resolves by | Doc | Status |
|---|---|---|---|
| ~~Final Brilli direction~~ | ~~v33.0 Phase C start~~ | `10-brilli-directions.md` | **LOCKED 2026-04-29: Celestial Orb primary; Aura/Field as secondary user-selectable option later. Other forms deferred.** |
| ~~Welcome modal copy variant~~ | ~~v33.0 Phase E start~~ | `02-welcome-experience.md` | **LOCKED 2026-04-29: Variant B (confident-terse).** |
| brillianceos.ai domain | Anytime, low urgency | `00-master-plan.md` | Reserve, don't switch |
| /info overhaul Option 1 vs 2 | v33.0 Phase F start | `06-info-overhaul.md` | Option 1 for v33.0; Option 2 in v34 if drift visible |
| Hamburger menu scope | v33.0 Phase F start | `08-mobile-design-spec.md` | /info only for v33.0 |
| Tier names ("Founder" vs "Brilliance Founder") | v33.0 Phase F start | `06-info-overhaul.md` | Keep tier names short |
| Selectable Brilli + Classic BLAKE | v33.x post-launch | `11-chat-interface-concepts.md` | Yes, in v33.x Settings |
| Wing editor for Firefly | v33.x | `11-chat-interface-concepts.md` | Defer to v33.x with selectable feature |
| Welcome modal on PWA install | v33.0 Phase E | `02-welcome-experience.md` | Yes, same flag, same logic |
| Brilli on login screen | v33.0 | `01-brilli-entity.md` | No, post-auth only |
| Negative Space Focus Mode shortcut | v33.0 | `12-surface-system.md` | Cmd+Shift+F |
| Multi-agent rendering treatment scope | v33.0 | `12-surface-system.md` | Concierge Desk only; expand v33.x |
| Notebook rename (Scribe → Notebook) | v33.0 Phase D | `12-surface-system.md` | Yes, in surface rebrand pass |
| Folio rename | v33.0 | `12-surface-system.md` | Keep as Folio |
| Spaced repetition default cadence | v34 | `14-evolve.md` | 1/day default |
| Brand SOPs visible to team | v34 | `14-evolve.md` | Personal for v33.5; team in v34+ multi-user |
| Sync v5 banner thresholds | v34 | `16-sync-v5.md` | 5 min offline / 1 min error defaults |
| Tombstone GC server-side | v34 | `16-sync-v5.md` | Yes, server-side Firebase Function |
| Marketing claim about how built | Press cycle | `13-integration-strategy.md` | "Brilliance has always been inside of RoweOS" |

---

## How to start tomorrow morning (the literal first 5 things)

1. **Read `09-wakeup-summary.md`** for the latest snapshot of where things stand
2. **Pick the final Brilli direction** by clicking through `/brilliance-mockups/09-brilli-directions.html` and writing the choice into `project_brilliance_v33.md`
3. **Approve welcome modal copy variant** by opening `/brilliance-mockups/02-welcome-modal.html` and toggling between A/B/C
4. **Run `bash src/build.sh && ./deploy.sh`** to confirm current build still works (sanity check before any refactor begins)
5. **Begin Phase B (cleanup)** with the Focus/Signal residue deletion — biggest impact, lowest risk, isolated to retired feature

After those five, every subsequent session has a clear next-action queue from this roadmap.

---

## How to know if a session is on track

A session is on track if, at the end:
- Code is committed and pushed
- `npm test` passes (once we're past Sprint 0 of v33.5)
- `deploy.sh` succeeded
- A memory file is updated with status (`project_brilliance_v33.md` or successor)
- The next session knows what to pick up via this roadmap

A session is OFF track if any of the following are true:
- "I'll commit at the end" (commit incrementally, every meaningful step)
- "Tests are slow, skipping" (tests are the seatbelt; fix the test, don't skip it)
- "I'll fix the type error later" (later means never; fix now)
- "Let me just rewrite this part" (refer to `13-integration-strategy.md` — no rewriting outside the playbook)
- "I'll write the spec block after the code" (spec block before code, every time)

If you (Claude or future contractor) catch yourself doing any of these, stop, reset, and follow the playbook.

---

## All docs in `docs/brilliance/` — what each is for

| # | File | When to read |
|---|---|---|
| 00 | `00-v33-master-plan.md` | Vision and phasing for v33.0 |
| 01 | `01-brilli-entity.md` | Building or animating Brilli |
| 02 | `02-welcome-experience.md` | Welcome modal implementation |
| 03 | `03-in-app-rename.md` | The 600-string surface rename |
| 04 | `04-cleanup-targets.md` | Phase B cleanup execution |
| 05 | `05-brilli-animation.md` | Canvas 2D Brilli technical spec |
| 06 | `06-info-overhaul.md` | /info refresh |
| 07 | `07-investor-framework.md` | When fundraising eventually comes up |
| 08 | `08-mobile-design-spec.md` | Any mobile-related work |
| 09 | `09-wakeup-summary.md` | Returning to the project after a gap |
| 10 | `10-brilli-directions.md` | Choosing among 13 Brilli forms |
| 11 | `11-chat-interface-concepts.md` | Chat surface options |
| 12 | `12-surface-system.md` | OS surface architecture (each concept → surface) |
| 13 | `13-integration-strategy.md` | Why we don't rewrite from scratch |
| 14 | `14-evolve.md` | Evolve feature spec |
| 15 | `15-architecture-playbook.md` | How we write code (the cultural rule) |
| 16 | `16-sync-v5.md` | Continuous sync rewrite |
| **17** | **`17-master-roadmap.md`** | **THIS FILE — the orchestration of all the above** |

---

## All mockups at `/brilliance-mockups/`

| File | Purpose |
|---|---|
| `00-index.html` | Master index, links to everything |
| `01-brilli-canvas-prototype.html` | Brilli interactive prototype (firefly, all states) |
| `02-welcome-modal.html` | Welcome to Brilliance modal with copy variant switcher |
| `03-launch-screen.html` | New boot screen |
| `04-sidebar-rebrand.html` | In-app sidebar before/after |
| `05-info-overhaul-preview.html` | /info overhaul preview |
| `06-mobile-preview.html` | Mobile previews of all surfaces (lazy-loaded iframes) |
| `07-mobile-launch.html` | Mobile launch screen |
| `08-mobile-liquid-nav.html` | Mobile nav rebrand |
| `09-brilli-directions.html` | 13 Brilli directions, animated comparison |
| `10-chat-concepts.html` | 12 chat surface concepts gallery |
| `11-concept-demo.html` | Per-concept fullscreen viewer with Desktop/Mobile tabs |
| `12-surface-map.html` | OS surface system architecture map |
| `13-evolve-preview.html` | Evolve view preview (5 tabs) |
| `14-sync-state-preview.html` | Sync v5 state visualization with scenarios |

---

## The big picture in one paragraph

Brilliance is the platform Brilliance has always been. v33.0 makes it visible. v33.5 makes the architecture sustainable. v34 makes the sync layer correct and ships Evolve as proof of the new way. v35 unbottles the bundle and adds Thought Board. The product compounds across these releases without ever stopping shipping, because every change is additive, observable, and reversible. The mess is metabolized; the intelligence is preserved; the brand is now whole. Ten paying clients become a hundred. Then a thousand.

That's the bet. That's the plan.
