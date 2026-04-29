# Integration Strategy — RoweOS into Brilliance

**Status:** Strategy decision, draft v0.1
**Question being answered:** "Should we map out the entire architecture and start fresh, or transform RoweOS into Brilliance in place?"
**TL;DR:** Don't rewrite. The mess is the moat. Hybrid path: brand layer now, modular refactor over a year.

---

## The seductive idea (and why it's the wrong move)

The intuition: **"Take the intelligence, leave the bugs. Fresh OS, zero legacy, all the smarts."**

This is the most-told and least-shipped story in software. Joel Spolsky wrote about it in 2000 ("Things You Should Never Do, Part I") after watching Netscape rewrite Navigator and lose to IE. It's been re-learned every five years since.

The problem with "leave the bugs, keep the intelligence":

- **The intelligence IS the bug-fixed implementation.** You cannot separate them. Every "ugly" guard, every weird try/catch, every special case is a real production bug that you discovered and fixed. Throwing the code out throws those discoveries out.

- **Code looks worse to a writer than to a reader.** When you scan src/js/core/22-firebase-sync.js, your brain remembers every painful session that produced it - so it FEELS messy. But to a fresh engineer reading it cold, it would look like a competent, hardened sync layer.

- **Rewrites take 3-5x longer than estimated.** Always. The current RoweOS is the result of ~6 months of iteration. Rewriting "cleanly" = 12-18 months minimum. During which: zero new features, zero bug fixes, zero customer-facing progress.

- **The 10 paying clients lose trust.** Migration risk is real - Firestore data shapes, automation pipelines, brand configs, push notification subscriptions. Any data loss = broken trust = churn.

- **You have to re-discover every gotcha.** The iOS box-sizing reflow hack, the keyboard-close height capture, the PWA cache-busting playbook, the social token dual-storage path, the email log writer pattern - all of it is encoded in the current code AND in the memory files. A clean rewrite means re-finding all of it under deadline pressure.

- **The "fresh" version will accumulate its own mess in 6 months.** Not because you'll be careless - because every product accumulates mess as it learns its requirements. Mess is metabolized knowledge.

## What actually changes when you "rebuild from scratch"

Mostly: **the chrome.** The visible structure of surfaces, the visual language, the routing, the menu organization. These can absolutely be reset cleanly.

What does NOT change cleanly:
- The agent system (BrandAI / LifeAI specialists, system prompts, model routing)
- Sync architecture (V3.1/V4 - mature, tested, multi-device-correct)
- Firebase collections (live data, indexed)
- Stripe products + price IDs (live billing)
- localStorage keys (every existing user's data lives at `roweos_*`)
- Auth flow (Firebase, OAuth callbacks for social)
- Email/transactional infrastructure (templates, deliverability, log writers)
- Service Worker (PWA cache strategy, push notifications)
- The 100+ Studio operations (handcrafted, tuned)
- The pipeline orchestration (5 sync points, multi-step approvals)

**That's not "the bugs."** That's the platform.

## The honest verdict

| Approach | Time to "Brilliance complete" | Risk to 10 paying clients | Months without shipping | Verdict |
|---|---|---|---|---|
| **Full rewrite, fresh repo** | 12-18 months | High (data migration, regressions) | 6-12 | NO |
| **Keep everything as-is forever** | 0 months (we're done) | None | 0 | NO (architecture stagnates) |
| **Brand layer now, modular refactor over time** | 0 months for brand, 6-12 months for cleaner architecture | Low (gradual, additive) | 0 (continuous shipping) | **YES** |

We're already on the third path. v33.0 IS the brand layer. The intelligence is already Brilliance the moment v33.0 deploys, because v33.0 = RoweOS engine + Brilliance brand chrome. There's no "switching day" needed because there's nothing to switch.

## What v33.0 already accomplishes (the brand integration)

The user-facing experience becomes Brilliance:
- Every visible string says "Brilliance"
- The launch screen shows Brilliance
- Email templates wear Brilliance
- The wordmark and Brilli are everywhere
- The new chat surface concepts replace blob landings

The engine stays RoweOS-named internally. **That's a feature.** It means:
- Zero data migration risk
- Zero localStorage key changes
- Zero Firebase schema changes
- Zero Stripe restructuring
- 10 paying clients see a brand evolution, not a system swap

## What gets reset cleanly (yes, do these)

These genuinely benefit from a fresh design — and they don't carry production data:

1. **Marketing surfaces.** Already done. `/brilliance` is fresh.
2. **Visual identity.** Already done. New logos, fonts, colors.
3. **Chat surface chrome.** v33.0 does this — Concierge Desk replaces blob landing.
4. **Welcome experience.** New, doesn't replace anything.
5. **Brilli the entity.** New visual.
6. **History view chrome.** v33.0 — Time Ribbon replaces list.
7. **Studio + Folio chrome.** v33.x — Split-Pane and Studio-at-Work.
8. **Notebook (rebrand of Scribe).** v33.x — Letter Series treatment.
9. **Thought Board.** v34 — entirely new, no migration.
10. **PWA manifest, app icon, OG images.** Surface-only.

Notice: **all the "fresh" things are surfaces and chrome.** None require touching the engine.

## What absolutely does not get reset (don't touch these)

The hardened core. Each item below took multiple production iterations to reach its current state:

| Subsystem | Why don't touch | Notes |
|---|---|---|
| Sync architecture (V3.1/V4) | 4 rewrites already. Mature. Edge cases known and handled. | See `08-foundation.js`, `10-sync.js`, `22-firebase-sync.js` |
| `mergeByTimestamp` and `safeSyncWrite` | Subtle. Encodes 6 months of conflict-resolution lessons. | One small change broke the Feb 9 chat resurrection bug |
| `loadFromFirebaseV2` | Cloud-authoritative pull. Handles `_all` doc subtle data loss case. | v28.3 fix, do not regress |
| Tombstone tracking | v32.0 overhaul. Scrub-on-startup discipline. | `roweos_deleted_*` keys |
| localStorage key naming (`roweos_*`) | Every existing user's data lives here. | Renaming = data wipe |
| Firebase collection naming | Indexes, rules, security all tied to current paths. | Renaming = re-deploy rules + indexes + reindex |
| Auth flow | initApp -> Firebase -> handleAuthState ordering. URL param handling. | v30.5 took 3 deploys to get right |
| iOS box-sizing reflow hack | Fixes the keyboard-close layout glitch. Two locations. | DO NOT REMOVE per CLAUDE.md |
| Service Worker push handling | VAPID keys, mobile partitioning, dual storage in social_tokens | Tested across browsers + iOS PWA |
| Stripe webhook | Two purchase types (api_key_purchase vs subscription). API key pool delivery. | Tested with real money |
| Email log writers | Server (`api/send-template-email.js`) and client (`_logSentEmail`) parity | v31.19 fix |
| `_emailPreviewWrap` ↔ server `emailWrap` parity | Visual consistency between preview and send | Two-write pattern |
| The 100+ Studio operations | Each is a handcrafted prompt + post-processor + UI hook | Encyclopedia of effort |

If a fresh-start advocate said "we'll just rebuild that in 2 weeks" - they have not actually built it. Don't believe them.

## The hybrid path: continuous shipping with architectural maturation

### Phase A — v33.0 (now): Brand layer
- User sees Brilliance everywhere
- Engine unchanged
- **Done in weeks.**

### Phase B — v33.x (post-launch, ~Q3 2026): Surface refactor
- Concierge Desk, Time Ribbon, Focus Mode (Tier 1)
- Split-Pane Studio, Studio-at-Work Folio, Notebook (Tier 2)
- These are CHROME refactors of existing data + operations
- Engine still unchanged
- **3-4 months.**

### Phase C — v34 (~Q4 2026 - Q1 2027): Service extraction
- Add a build pipeline (esbuild) that compiles `src/` → `dist`
- Module boundaries become explicit (TypeScript optional, // @ts-check fine)
- Pull sync, Firebase, Stripe, auth into `services/` layer with documented interfaces
- Each service unit-testable in isolation
- Surfaces talk through services, not directly to Firebase/Stripe SDKs
- localStorage keys still `roweos_*` - no migration
- Firebase collections still current names - no migration
- **3-4 months. Background work parallel to feature shipping.**

### Phase D — v35+ (~2027): Surface independence
- Each surface (Chat, Studio, Folio, Pulse, etc.) becomes a lazy-loaded module
- Solves the 9.7MB index.html problem cleanly
- Brilli is a shared service module
- Sync, Firebase, Stripe, auth are shared service modules
- Each surface is independent, swappable, testable
- New surfaces (Thought Board) drop in as modules
- **6 months. Big architectural payoff.**

### Phase E — v36+ (optional, far future): Multi-platform
- Once surfaces are independent modules, native iOS/Android apps become possible
- The service layer is platform-agnostic by then
- This is the v36+ conversation, not v33

## Sync architecture specifically

The user asked: "maybe we re-do the syncing structure too."

**Recommendation: don't.** Reasons:

1. **It's been rewritten 4 times already.** V1 → V2 → V3.1 → V4. Each rewrite took ~2 weeks and produced subtle regressions that took longer to find than the rewrite saved.

2. **It works.** Multi-device sync, conflict resolution, offline-first, write-through, cloud-authoritative pulls — all working. 10 clients haven't reported sync bugs in months.

3. **The complexity is essential, not accidental.** Every feature in the sync code (mergeByTimestamp, _normalizeTs, safeSyncWrite, _all doc fallback, tombstone scrub, brand stable IDs, race-condition guards) maps to a real production incident. Removing any of them = re-creating the incident.

4. **What CAN improve without rewriting:**
   - Add types/JSDoc to the public functions (1-2 days)
   - Document the sync flow in a single architecture diagram (already mostly in CLAUDE.md, expand to a dedicated doc)
   - Add 5-10 integration tests for the most painful past bugs (regression prevention)
   - Extract the `services/sync.ts` interface in Phase C without changing the implementation under it
   - Eventually replace the implementation behind the interface in Phase D, with a feature flag for canary rollout

That last bullet is the key. **You can replace the sync implementation eventually, but only AFTER it's behind a typed interface that surfaces depend on.** Trying to swap implementation while surfaces talk to it directly = guaranteed regression.

## What "starting fresh" feels like vs what it actually is

When the user thinks "fresh start," they imagine:
- Clean module boundaries
- TypeScript everywhere
- Tests
- Modern tooling
- Faster builds
- Easier to reason about

What "fresh start" actually IS in practice:
- Re-implementing the same logic minus the bug fixes
- Migration scripts you have to write twice (once to migrate, once to fix the migration)
- Months of "feature parity" work where users see no progress
- Lost institutional memory (the gotchas in `~/.claude/projects/.../memory/` are tied to current code paths)
- A second product to maintain during the migration period
- Contractor opportunity cost (every hour rewriting is an hour not shipping)

You can get all the imagined benefits **inside the existing repo**, gradually, while continuing to ship.

## The mental model

Treat v33.0 as the **wedding** between RoweOS and Brilliance. Same person, new name, same memories, new clothes, public ceremony.

Treat v33.x-v35 as the **transformation** that follows. Same person, new habits, new disciplines, gradually changed posture. Not a different person.

Treat v36+ as the **mature self.** New surface contracts, native apps, a service layer the platform can stand on. Still the same intelligence — just expressed more cleanly.

If you instead "rebuild from scratch," you're not creating a new self. You're trying to forget the past while pretending you remember everything important. It doesn't work. You forget the wrong things.

## The actual recommendation

1. **Ship v33.0 as planned.** Brand layer over the existing engine. No rewrite.
2. **Ship v33.x surface refactors** (Concierge Desk → Studio → Folio → Notebook). Chrome only.
3. **Ship v34 service extraction.** Add build pipeline, pull services into a typed layer, no engine rewrite.
4. **Ship v35 surface independence.** Lazy-load surfaces, big architectural payoff. New features ship faster.
5. **Defer the dream of "perfectly clean" indefinitely.** Perfect is the enemy of shipping. Continuously cleaner > eventually clean.

This path keeps you shipping every week. The ten paying clients see weekly improvement. New customers arrive at Brilliance, not RoweOS. Your maintenance burden goes DOWN over time, not up. And in 12 months you have a cleaner codebase than a rewrite would have produced — without ever having a "switching day."

## What this strategy does NOT preclude

- A clean **internal documentation** rewrite. CLAUDE.md, the docs/ folder, the architecture diagrams - those CAN be reset and improved freely. They're descriptions, not running code.
- A clean **test suite** addition. There are currently no tests. Adding them is pure value, no migration risk.
- A clean **module organization**. Renaming files, restructuring folders, moving code into clearer modules - all safe inside the same repo.
- A clean **TypeScript adoption**. Per-file. Gradual. No flag day.
- A clean **build pipeline addition** (esbuild/vite for compilation). Replaces `src/build.sh` concatenation with proper bundling.

All of those happen inside the existing repo. They DON'T require throwing the existing code away.

## Locked decisions (2026-04-29)

These were the open questions. Jordan's answers locked them in.

### 1. No rewrite from scratch — CONFIRMED
We do not start fresh. We transform in place. But the work is intentional: every feature's current code is mapped, the planned architectural treatment is documented, and the refactor follows a per-feature playbook (see `15-architecture-playbook.md`).

### 2. Build pipeline timing — START NOW
Esbuild added immediately, parallel to v33.0 brand work. Replaces `src/build.sh` concatenation with proper bundling. New code (Evolve, services) ships through esbuild from day 1. Existing modules continue to be concatenated until their refactor turn.

This also unblocks **Evolve** — a new feature being added: skill-building and educational repository for life and brand. See `14-evolve.md`. Built fresh as TypeScript modules under the new pipeline.

### 3. TypeScript strategy — HYBRID, the right way
- **NEW modules** (Evolve, services as they extract) → `.ts` files from day 1
- **EXISTING high-risk modules** (sync, agents, Stripe webhook) → add `// @ts-check` + JSDoc types now, convert to `.ts` when refactored
- **EXISTING low-risk modules** (UI panels, view chrome) → leave as plain `.js`, convert opportunistically

No flag day. Gradual but disciplined. The build pipeline (esbuild) handles both `.js` and `.ts` natively.

### 4. Test suite priority — START NOW for high-risk modules
Three critical-path test files added in the first refactor sprint:
- `src/__tests__/sync.test.ts` - covers `mergeByTimestamp`, `safeSyncWrite`, `_normalizeTs`, conflict resolution edge cases
- `src/__tests__/agents.test.ts` - model routing, system prompt assembly, multi-agent orchestration
- `src/__tests__/stripe-webhook.test.ts` - signature verification, both purchase types (api_key_purchase vs subscription)

Stack: **Vitest** (fastest, works with esbuild seamlessly). For E2E: **Playwright** for the welcome modal, chat send, and automation execution flows. Firebase emulator for sync integration tests.

Target: 30-50 tests covering the past 6 months of production bugs. Each fixed bug gets a regression test added.

### 5. Marketing language — flexible, lean on continuity
Direction: **"Brilliance has always been inside of RoweOS."** Or **"Brilliance is the platform you've built into."** Both are true and stronger than any "ground-up rewrite" claim. We do not need to signify how the platform was built; we need to signify what it is now.

## What this means in practice

- `src/build.sh` gets a proper esbuild step in v33.0 prep work
- `package.json` adds: vitest, esbuild, @types/node, typescript (devDeps only)
- `tsconfig.json` configured for strict TypeScript on new files, lenient on JSDoc'd legacy
- A `services/` folder begins to exist alongside `src/js/core/` for the extracted typed services
- **Evolve** is the first feature built entirely under the new architecture (and serves as the reference for how everything else gets refactored)
- Each feature getting refactored follows `15-architecture-playbook.md` with a per-feature design block before code is written

## The bottom line

You are NOT trapped in RoweOS. You are NOT held back by the existing code. You ARE in a position where every week you ship more Brilliance to existing users while gradually replacing the engine underneath. That's the rare both-and that startups dream of and almost never achieve.

Don't trade it for the dream of a fresh repo.
