# v33.x Architecture Overview

**Status:** Reference doc, written 2026-04-30 after the v33.0 → v33.25 night session.
**Audience:** Future Claude / Jordan / contractor picking up where this session ends.
**Companion:** `17-master-roadmap.md` (the plan), `15-architecture-playbook.md` (how we write code).

This doc ties together the components shipped in v33.x so the next session can navigate without re-reading 25 changelog entries.

---

## What v33.x is

The brand-and-foundation release. Three pillars shipped tonight, all behind feature flags where appropriate, all reversible:

1. **Brilli — the Brilliance entity.** Canvas 2D module replacing the legacy WebGL blob.
2. **Evolve — Educational Intelligence Module.** Five-tab UI with real LLM integration.
3. **Sync v5 — continuous timestamp-based sync.** Read-shadow active for 8 collections, gated cloud writes for v5-native collections.

Plus a complete UI overhaul against the brilliance-mockups, Sprint 0 tooling (vitest), and 152 critical-path tests.

---

## Files added in v33.x

```
src/js/core/
  34-brilli.js              # Canvas 2D Brilli (5 forms, state machine, intensity, themes)
  35-sync-v5.js             # Continuous sync (read-shadow + gated writes)
  36-evolve.js              # Educational Intelligence (5 tabs + collections)
  37-services-bridge.js     # Plain-JS mirror of services/* TS facades

src/html/shared/
  31-evolve.html            # Evolve view shell (5-tab layout)

services/
  sync/index.ts             # Typed facade over v4 globals
  agents/index.ts            # Typed facade over agent streaming + system prompts
  stripe/index.ts            # Typed facade over Stripe checkout/webhook helpers

src/__tests__/
  setup.ts                   # localStorage polyfill (Vitest 4.x jsdom)
  sample.test.ts             # Smoke
  critical/
    sync-v5.test.ts            # Envelope, conflict, CRUD, tombstones
    sync-v5-edge.test.ts       # Multi-coll isolation, persistence, subscriber errors
    sync-v5-cloud-write.test.ts # Cloud-write gate (allowlist + dual flags)
    sync-v5-cache.test.ts       # clearLocalCache + flag preservation
    sync-v5-stats.test.ts       # subscribeStats + getStats shape + resetStats
    sync-v5-retry.test.ts       # onSnapshot error retry (30s × 3 cap)
    sync-facade.test.ts         # services/sync defensive + delegation
    services-bridge.test.ts     # BrillianceServices.{sync,agents} runtime mirror
    agents-facade.test.ts       # services/agents
    stripe.test.ts              # classifyCompletedCheckout + apiKeyProviderFromEvent
    brilli-intensity.test.ts    # getIntensity/setIntensity + form persistence
    brilli-state.test.ts        # mount/unmount/setMode + form change events
    evolve-profile.test.ts      # profile, daysToDeadline, recalibrateMomentum, prompt
    evolve-import.test.ts       # exportData + importData + round-trip

package.json, tsconfig.json, vitest.config.ts, build.config.ts, .gitignore
```

## Files modified in v33.x

```
src/js/core/
  09-state.js                  # ROWEOS_VERSION (bumped 25 times tonight)
  07-early-inline.js           # Sets data-brilli-form + data-evolve pre-paint
  11-agents.js                 # allViews + Evolve dispatch + page landing config
  13-studio.js                 # Translator pattern injection into system prompts
  17-automations.js            # markAutomationDone fires Brilli pleased flash
  21-sidebar.js                # Notebook (Scribe) display label
  22-firebase-sync.js          # @ts-nocheck + Welcome→Brilliance email rename + Welcome v2 modal
  24-lifeai-identity.js        # Tour Step 1 "Welcome to Brilliance" + Brilli (not BLAKE)

src/js/late/
  00-api-bridge.js             # setBlobState→Brilli mapping + Concierge row + sync state visualization

src/html/
  core/02-shell-batch1.html    # Splash Brilliance lockup (Celestial Orb + wordmark)
  core/03-views-batch2.html    # Launch screen Brilliance lockup + liquid-nav Brilli dot
  core/04-views-batch3.html    # Sidebar lockup + Evolve nav + Brilli sidebar dot + version bumps
  shared/01-blake.html         # Concierge row + #brilliHero clickable hero
  shared/21-settings.html      # Brilli Form picker + Intensity slider + Concierge toggle + Evolve toggle + Sync v5 panel
  shared/27-modals.html        # Welcome-to-Brilliance modal (#brillianceWelcomeModal)

src/css/core/
  01-base.css                  # Brilliance lockup, Evolve shell, concierge row, Brilli orb clip-path, mobile breakpoints
```

---

## Brilli (`34-brilli.js`)

Canvas 2D module, ES5 IIFE. Public API:

```js
Brilli.mount(host, { size: 'hero'|'inline'|'pin', mode: 'idle', form: 'celestial' }) → instance
Brilli.unmount(instance)
Brilli.setMode(instance, 'idle'|'attending'|'thinking'|'delivering'|'pleased'|'asleep')
Brilli.refresh(instance)                 // re-read CSS gold vars (theme toggle)
Brilli.getActiveForm() / setActiveForm(form)
Brilli.getIntensity() / setIntensity(0-100)
```

**Forms (locked):** `celestial` (default), `aura`, `firefly`, `signature`, `classic`. Stored in `localStorage.roweos_brilli_form`. Class on `<html>` is `data-brilli-form="..."` set pre-paint by 07-early-inline.

**Mount points:** `#brilliHero` (chat hero, hero size, clickable to open form picker), `#sidebarBrilliDot` (sidebar status dot, pin size), `#liquidBrilliDot` (mobile liquid-nav, CSS-only pulsing dot).

**State machine drivers:**
- `setBlobState('idle'|'thinking'|'responding'|'streaming'|'complete'|'pleased'|'attending')` → mapped to Brilli mode (in `00-api-bridge.js`).
- Chat input focus/blur → `attending`/`idle` on hero only when not in stronger state.
- `markAutomationDone` → `pleased` flash on sidebar dot.
- Evolve view active → `attending` mode on sidebar dot.
- `document.visibilitychange` → `asleep` mode parking, restored on visible.
- `MutationObserver` on `<html>.className` → all instances refresh CSS vars on theme toggle.

**Defensive:** mount + setMode + refresh check `b.ctx` is non-null before drawing (handles jsdom + canvas-init failures).

---

## Evolve (`36-evolve.js`)

Five-tab Educational Intelligence module. Gate: `localStorage.roweos_evolve_enabled === 'true'`. Settings → Evolve toggle controls this without console.

**Tabs:**
- **Today** — Pulse Dashboard (countdown, XP/streak hero) + Liquid Rhythm Planner (recalibrateMomentum) + clickable daily-load cards (XP gain on completion).
- **Practice** — Demo quiz card with Why/Why-Not Matrix on reveal, drill mode (retry on incorrect with attempt counter). Hot-keys 1-4/A-D/Enter/N/R when active.
- **Translator** — Real LLM call (Claude Opus first, OpenAI fallback) producing 4-section response (Generic / Mechanism / Competitor equivalents / Exam-mapped). Save term → `profile.knownContext`.
- **Verify** — Real LLM peer-review producing VERIFIED / CORRECTED / INSUFFICIENT badge + structured analysis. Save as reflection.
- **Skills** — Skill tree with default pillar-derived skills + user-defined skills via SyncV5 collections. Lists last 5 reflections + sources with delete buttons. Import/Download backup buttons.

**Profile shape:**
```ts
{
  targetGoal, deadlineDate, knownContext: string[], cognitiveProfile,
  currentXP, dailyStreak, lastSessionAt, lastSessionDay,
  completedToday: { 'YYYY-MM-DD': { idx: { at, minutes } } }
}
```

**System prompt injection:** `Evolve.generateEvolveSystemPrompt(profile)` is appended to chat agent system prompts in `getAgentSystemPrompt` (chat) and `buildBrandSystemPrompt` (Studio) when Evolve is enabled and a target goal is set. Translator pattern: every concept gets translated through known mental models.

**Cross-mode:** completing an Evolve task logs to `roweos_pulse_insights` so Pulse + Concierge surface Evolve activity.

**Storage:** Skills/Sources/Reflections/SOPs persist via `SyncV5.collection('evolve_*')`. Cloud writes activate when `SyncV5.writesEnabled()` is true. v4-shadowed collections never write through v5.

**Nightly hook:** `_ensureNightlyAutomation()` registers `evolve_nightly_content` automation (disabled, scaffold for v34 Sprint C multi-model quiz pipeline).

---

## Sync v5 (`35-sync-v5.js`)

Continuous, timestamp-based, type-safe sync. Gated by two feature flags:
- `localStorage.roweos_sync_v5_enabled = 'true'` → starts read-shadow listeners
- `localStorage.roweos_sync_v5_writes = 'true'` → enables cloud writes (only for v5-native collections)

**Collections under read-shadow (8):**
1. `automations` (vs `roweos_automations`)
2. `brands` (vs `roweos_user_brands`, skips `_all` doc)
3. `conversations` (vs `roweos_agentCommands` + `roweos_deleted_chat_ids` tombstones)
4. `scribe` (vs `roweos_scribe_notebooks`)
5. `reminders` (vs `roweos_reminders`, status drift)
6. `pulse_goals` (vs `roweos_pulse_goals`, completion drift)
7. `library` (vs `roweos_auto_lab_images`)
8. `mail` (vs `roweos_mail_sent` + `roweos_mail_outbox`)

**V5-native collections (cloud writes when enabled):**
- `evolve_skills`, `evolve_sources`, `evolve_reflections`, `evolve_sops`

**Conflict resolution:** last-write-wins by `_modifiedAt`, ties broken by lexicographically higher `_clientId`. CRDT pattern.

**Listener retry:** onSnapshot error → retry 30s later, up to 3 attempts. Successful snapshot resets counter.

**Stats:** events seen, discrepancies, perCollection (events + discrepancies + lastSummary), recentEvents (last 5), lastError, activeCollections.

**Settings panel** (Settings → Sync → Sync v5 (Preview) or Cmd/Ctrl+Shift+S):
- Read-shadow toggle
- Cloud writes toggle (preview, disabled until read-shadow on)
- Live stats with subscribeStats
- Per-collection breakdown
- Recent events log
- Reset stats / Export stats / Clear local cache buttons

---

## Service facades (`services/`)

TypeScript canonical, with a JS runtime bridge in `37-services-bridge.js` that mirrors the contract for callers that aren't going through esbuild yet.

- `services/sync/index.ts` — `writeDB`, `readDB`, `writeDBDoc`, `deleteDBDoc`, `loadFromFirebase`, `manualSyncNow`, `mergeByTimestamp`, `currentUser`. Wraps the v4 globals.
- `services/agents/index.ts` — `callAnthropic`, `callOpenAI`, `getAgentSystemPrompt`, `buildBrandSystemPrompt`. Strict types for `ChatMessage`, `ContentBlock`, `StreamCallbacks`.
- `services/stripe/index.ts` — `createCheckout`, `createPortalSession`, `classifyCompletedCheckout`, `apiKeyProviderFromEvent`. Pure helpers shared between webhook handler + tests.

**Bridge:** `window.BrillianceServices.sync.*` and `.agents.*` available at runtime. JS callers can use them today.

**Migration order (v33.5+):** flip `// @ts-nocheck` to `// @ts-check` on `22-firebase-sync.js`, add JSDoc types, migrate first 3-5 callers from `window.writeDB` to `BrillianceServices.sync.writeDB`. Per playbook §3.2.

---

## UI overhaul

Driven by `RoweOS/dist/brilliance-mockups/`:
- **04-sidebar-rebrand** → footer Brilliance lockup (`.brilliance-lockup` with pulsing dot + "Brilliance · by RoweOS")
- **03-launch-screen** → post-auth launch screen lockup (Celestial Orb + Cormorant Garamond gold-gradient "Brilliance" + Intelligence OS + by RoweOS)
- **08-mobile-liquid-nav** → Brilli status dot at left edge of bottom liquid-nav pill
- **13-evolve-preview** → full multi-tab Evolve view layout (side rail collapses to top strip on mobile)
- **12-surface-map (Concierge Desk)** → pill row above chat hero (Pulse / Automations / Bloom / Calendar / Evolve / Reminders / Resume / empty-state Begin)

Mobile parity baked in: every new component has @media (max-width: 768px) and 380px breakpoints.

---

## Test surface (152 tests in <1.1s)

| File | Count | What it locks |
|---|---|---|
| sample.test.ts | 2 | Vitest works |
| sync-v5.test.ts | 12 | Envelope, conflict, Collection CRUD, tombstones, flag |
| sync-v5-edge.test.ts | 8 | Multi-coll isolation, rehydration, subscriber errors |
| sync-v5-cloud-write.test.ts | 9 | Cloud-write allowlist + dual-flag gate |
| sync-v5-cache.test.ts | 5 | clearLocalCache + flag preservation |
| sync-v5-stats.test.ts | 9 | subscribeStats lifecycle + getStats shape + resetStats |
| sync-v5-retry.test.ts | 5 | onSnapshot retry behavior |
| sync-facade.test.ts | 14 | services/sync defensive + delegation |
| services-bridge.test.ts | 16 | BrillianceServices runtime |
| agents-facade.test.ts | 11 | services/agents |
| stripe.test.ts | 8 | classifyCompletedCheckout + apiKeyProviderFromEvent |
| brilli-intensity.test.ts | 11 | Intensity 0-100, persistence, events, form select |
| brilli-state.test.ts | 14 | mount/unmount/setMode + setActiveForm event |
| evolve-profile.test.ts | 16 | Profile, daysToDeadline, recalibrateMomentum, prompt |
| evolve-import.test.ts | 12 | exportData + importData + round-trip |

---

## Deploy log (v33.0 → v33.25)

| Version | What |
|---|---|
| v33.0 | Welcome to Brilliance brand swap + welcome modal |
| v33.1 | Phase C-full Brilli Canvas (3 forms) + Sync v5 + Evolve scaffolds |
| v33.2 | Evolve Sprint A + Sync v5 read-shadow + Sprint 0 tooling |
| v33.3 | Notebook rename + Sprint B Liquid Rhythm + XP + Brilli attending + services/sync facade + 14 tests |
| v33.4 | Mockup-driven UI overhaul (sidebar / launch / Evolve full UI / liquid-nav / Concierge) |
| v33.5 | Quiz card + Translator real LLM + 5 service tests + Evolve Skills storage |
| v33.6 | Verifier + conversations shadow + What's New modal + tutor pose |
| v33.7 | Sync v5 expansion (5 collections) + cross-mode + 14 sync-facade tests |
| v33.8 | Sync v5 write activation gate + agents tests (11) |
| v33.9 | Firefly + Light Signature forms + concierge enhancements + writes UI |
| v33.10 | Cloud-write tests + Brilli sleep + nightly hook + per-collection stats |
| v33.11 | Sync state pulse + 375px audit + roadmap sync |
| v33.12 | More v5 collections (pulse + library) + drill mode + services bridge |
| v33.13 | Brilli intensity slider + quiz hot-keys + sync reset |
| v33.14 | 100 tests milestone (Brilli + Evolve + sync stats) |
| v33.15 | Polish: presets + events log + reflections list |
| v33.16 | Hero clickable + cache clear + Evolve landing config |
| v33.17 | Concierge empty + sync hotkey + picker keyboard |
| v33.18 | Cache clear tests + drill counter |
| v33.19 | Brilli state tests + JSON exports |
| v33.20 | Evolve import + Brilli theme refresh + 8th sync collection |
| v33.21 | Import tests + concierge dismiss + welcome-email rebrand audit |
| v33.22 | Reminders pill + sync retry + bridge tests (16) |
| v33.23 | Settings affordances + memory sync |
| v33.24 | Master roadmap final sync |
| v33.25 | Listener retry tests + audit pass |

25 production deploys. 152 tests. All non-destructive. No data integrity incidents.

---

## What v33.5+ picks up

Per the master roadmap §"Still ahead":
1. **Sprint 1 — services/sync hardening** — flip `@ts-nocheck` → `@ts-check` on 22-firebase-sync.js + JSDoc types. Migrate 3-5 callers from globals to `services/sync` + `services/agents`.
2. **Sprint C full quiz pipeline** — Gemini Deep Research → GPT-5.5 Thinking → JSON quiz cron job. Hook is registered as `evolve_nightly_content` automation; needs the multi-model implementation.
3. **Sprint E full verifier** — Gemini + GPT-5.5 Pro cross-review with mandatory 3 citations.
4. **Sync v5 dual-write activation for v4-shadowed collections** — gate behind 14-day zero-discrepancy. Per-collection `_dualWrite()` method.
5. **Sprint G Veo 3.1 video** — spatial-concept failure detection.
6. **Tier 2 surface rebuilds** — Studio split-pane / Folio at-work / Notebook letter series.
7. **Tier 3 Thought Board + surface independence** — lazy-load each surface, drop bundle to <2MB.
8. **CSS cleanup retry** — 78KB inert .focus-2-* selectors. Postcss tooling needed.
