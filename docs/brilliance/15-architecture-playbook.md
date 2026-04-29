# Architecture Playbook

**Status:** Standards doc, draft v0.1
**Audience:** Anyone (Claude, Jordan, future contractor) writing or refactoring Brilliance code
**Companion:** `13-integration-strategy.md` (the why), `12-surface-system.md` (the what)

---

## Purpose

You said "VERY intentional on how we write it." This is that intention, captured. Every refactor and every new feature follows this playbook. No improvisation, no ambiguity, no "I'll figure it out as I go."

The playbook has three layers:
1. **Per-feature template** — what to write before any code is touched
2. **Module standards** — file structure, public/private API, types, tests
3. **Build + tooling** — esbuild, TypeScript adoption, test runner, CI

---

## 1. Per-feature template (use this BEFORE code)

For every feature being added or refactored, fill out this block first. Lives at the top of the feature's primary file as a JSDoc comment OR in the feature's own short markdown spec.

```
/**
 * @feature <name>
 * @surface <which surface(s) it lives in>
 * @owner <Jordan or contractor name>
 * @status <draft | in-progress | shipped | deprecated>
 *
 * WHAT IT IS
 * One paragraph. The smallest description that lets a future reader recognize this feature.
 *
 * WHO IT IS FOR
 * Users by posture (solo operator, multi-brand founder, boutique studio).
 * Mode by surface (BrandAI / LifeAI).
 *
 * WHAT IT REPLACES OR ADDS
 * If refactor: which existing module(s) it transforms.
 * If new: where it slots into the surface system (12-surface-system.md).
 *
 * DATA MODEL
 * Shape of the data. Local (localStorage key + schema) and Cloud (Firestore path + schema).
 * Sync rules: write-through (default), pull-authoritative (default), tombstone (if delete tracking).
 *
 * PUBLIC API
 * Functions exported from this module. Each with signature + one-line description.
 * Functions consumed from other modules. Each with the module name.
 *
 * STATE MACHINE
 * If the feature has states (idle/loading/active/error), enumerate. Show transitions.
 *
 * UI SURFACES
 * Where this feature renders. View IDs (data-view), components, partials.
 * Mobile considerations.
 *
 * RISK
 * Migration risk (data loss, regressions). Performance risk (memory, RAF loops, network).
 * UX risk (confusion, learning curve).
 *
 * MITIGATIONS
 * For each risk: the specific guardrail.
 *
 * TESTS
 * Unit tests required. Integration tests required. E2E tests required.
 *
 * NON-GOALS
 * Things we deliberately do NOT do in this feature. Important.
 */
```

This is roughly 50-100 lines. Writing it forces the design decisions before any code. After it's written, the code is largely transcription.

**Rule:** No PR is reviewable without this header. If you're tempted to skip it, you're about to make a mess.

---

## 2. Module standards

Every feature is a module. Every module follows the same shape.

### 2.1 File layout

```
src/services/<feature>/
  index.ts                  # Public API barrel - what other modules import
  types.ts                  # Shared types/interfaces for this feature
  state.ts                  # In-memory state + state machine if any
  sync.ts                   # Cloud + local persistence (uses services/sync)
  ui.ts                     # DOM rendering + event handlers (or .tsx if we add JSX later)
  __tests__/
    <feature>.test.ts       # Unit tests
    <feature>.integration.test.ts  # Integration tests (Firebase emulator)
```

For features that don't need the full split (e.g. a simple modal), just `index.ts` + `__tests__/`.

### 2.2 Public API discipline

`index.ts` is the ONLY thing other modules import from. Everything inside the feature folder is private. No reaching across.

```typescript
// src/services/evolve/index.ts
export { initEvolve } from './state';
export { renderEvolveView } from './ui';
export type { Skill, Course, Reflection } from './types';
// nothing else exported
```

Other modules:
```typescript
import { initEvolve, renderEvolveView, type Skill } from '@/services/evolve';
// NEVER: import { somethingPrivate } from '@/services/evolve/state';
```

This rule is enforced by linting (eslint-plugin-import) once we add it.

### 2.3 Types are required for new code

New `.ts` files: every exported function has typed parameters and return type. Internal helpers: encouraged. `any` is forbidden except at network/library boundaries with a `// FIXME: type narrow` comment.

For existing `.js` files getting `// @ts-check`: JSDoc `@param`/`@returns` on the exported functions. Internal types optional but encouraged.

### 2.4 No global mutation across module boundaries

Existing RoweOS code uses globals (`window.selectedBrandIdx`, `window.brands`, etc.). This is the **single biggest source of bugs** and the thing the refactor most needs to fix.

**Rule for new modules:** No `window.*` reads or writes. State is owned by the module that defines it. Cross-module state goes through `services/state` (a typed event bus + store).

**Rule for refactors:** When a legacy module is touched, its globals get extracted into typed exports. Example:
```typescript
// services/brand/state.ts
export function getActiveBrand(): Brand { ... }
export function setActiveBrand(brand: Brand): void { ... }
export function onBrandChange(cb: (brand: Brand) => void): () => void { ... }
// callers import these instead of reading window.selectedBrandIdx
```

This is the single most important refactor pattern. Globals out, services in.

### 2.5 Sync layer contract

`services/sync` is the typed interface to Firebase. ALL Firebase reads/writes go through it. No module imports the Firebase SDK directly.

```typescript
// services/sync/index.ts
export function writeDB(path: string, data: unknown): Promise<void>;
export function readDB<T>(path: string): Promise<T | null>;
export function watchDB<T>(path: string, cb: (data: T) => void): () => void;
export function deleteDBDoc(path: string): Promise<void>;
// plus the merge utilities, tombstone helpers, etc.
```

Implementation underneath stays the current V3.1/V4 sync code — but wrapped in a typed contract. Surfaces don't know whether sync is V3.1 or V4 or eventually V5.

This unlocks the eventual sync rewrite without touching surfaces.

### 2.6 No `any` at the agent boundary

Agent system prompts, model responses, tool calls — all currently flow as raw strings or untyped objects. Type these strictly:

```typescript
type AgentId = 'strategy' | 'marketing' | 'operations' | 'documents' | 'research' | 'intelligence' | 'image' | 'helper'
            | 'lifecoach' | 'wellness' | 'tax' | 'pa' | 'standard';

type AgentResponse = {
  agentId: AgentId;
  content: string | ContentBlock[];
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error';
};
```

This is the place bugs hide most. Types pay for themselves immediately here.

---

## 3. Build + tooling

### 3.1 Build pipeline (esbuild)

Add `esbuild` to devDeps. Replace `src/build.sh` concatenation with:

```javascript
// build.config.js (or build.ts)
import esbuild from 'esbuild';

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',                    // single-file output, IIFE-wrapped
  target: 'es2020',                  // modern browsers; legacy ES5 not needed for Brilliance era
  outfile: 'RoweOS/dist/index.html.bundle.js',
  loader: { '.html': 'text', '.css': 'text' },
  minify: process.env.NODE_ENV === 'production',
  sourcemap: true,
  define: {
    'process.env.BRILLIANCE_VERSION': JSON.stringify(pkg.version),
  },
});
await ctx.watch();
```

The HTML shell stays the current `RoweOS/dist/index.html` template. The bundled JS gets injected into the shell at build time. CSS continues from `src/css/`.

**ES5 constraint:** lifted for new code. Old code still ES5 until refactored. esbuild handles both.

### 3.2 TypeScript adoption

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "checkJs": true,
    "allowJs": true,
    "jsx": "preserve",
    "lib": ["DOM", "ES2020"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*", "services/**/*", "api/**/*"]
}
```

`checkJs: true` + `allowJs: true` means existing `.js` files get type-checked too — once they have `// @ts-check` at the top.

**Adoption order:**
1. Add tsconfig + esbuild + vitest devDeps
2. Add `// @ts-check` to the 3 highest-risk files: `22-firebase-sync.js`, `11-agents.js`, `api/stripe-webhook.js`
3. Add JSDoc types to those 3 files' public APIs
4. Build Evolve as `.ts` from scratch
5. Extract `services/sync`, `services/agents`, `services/stripe` as `.ts` modules wrapping the existing `.js` implementations
6. Surfaces start importing from `services/*` instead of from the `.js` modules directly
7. Eventually replace the `.js` implementations with `.ts` reimplementations behind the same `services/*` interfaces

### 3.3 Tests (Vitest)

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',           // for DOM-touching modules
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: { provider: 'v8' },
  },
  resolve: {
    alias: { '@': '/src' },
  },
});
```

Test naming: `*.test.ts` for unit, `*.integration.test.ts` for Firebase-emulator integration, `*.spec.ts` for Playwright E2E (in a separate folder, separate config).

**Required tests for Phase 1:**
- `services/sync` — every public function, plus the painful past bugs as regression tests:
  - `_normalizeTs` ISO string vs ms numeric
  - `mergeByTimestamp` with empty cloud array (deletion)
  - `safeSyncWrite` overwriting reader's expected fields
  - `_all` doc subset preventing data loss
  - tombstone scrub on startup
- `services/agents` — model routing, system prompt assembly, multi-agent dispatch
- `services/stripe` (or `api/stripe-webhook` directly) — signature verification, api_key_purchase delivery, subscription creation

Each past production incident gets a test. CLAUDE.md "Common Bug Patterns" section becomes a test plan.

### 3.4 Linting

Add ESLint with these rules locked:
- `@typescript-eslint/no-explicit-any` (error, with allowed-list for boundary cases)
- `no-restricted-globals` (warn on `window.*` reads in services/)
- `import/no-internal-modules` (error - enforces 2.2 public API discipline)
- `no-console` (warn except `console.error` and `console.warn`)

### 3.5 CI (GitHub Actions, eventually)

When ready (probably v34):
```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

Until then, run locally before deploys. `./deploy.sh` should call `npm run typecheck && npm run test:critical` before pushing.

---

## 4. Per-feature playbook (the workflow)

When refactoring an existing feature OR adding a new feature, the workflow is:

### Step 1 — Write the spec block (Section 1 template)
Lives at the top of the feature's `index.ts` or in `docs/brilliance/<feature>.md`.

### Step 2 — Define the data model
Types in `services/<feature>/types.ts`. Local schema, cloud schema, sync rules.

### Step 3 — Define the public API
Function signatures in `services/<feature>/index.ts`. Implementations stubbed.

### Step 4 — Write the tests (TDD-lite)
Tests reference the public API. They fail because the stubs throw "not implemented." This locks the API.

### Step 5 — Implement
Fill in the stubs until tests pass. Internal helpers in private files.

### Step 6 — Wire to surfaces
Surfaces import from `services/<feature>` and render. Replace the legacy module's import sites one at a time.

### Step 7 — Decommission the legacy module
Once all surfaces are migrated, delete the legacy `.js` file (or move to `legacy/` for a release of dormancy).

### Step 8 — Document the migration
Update CLAUDE.md and the relevant memory files. The lessons learned from this refactor become the next refactor's guidance.

---

## 5. Coding conventions

### Naming
- Files: kebab-case (`brand-state.ts`, `agent-routing.ts`)
- Types: PascalCase (`BrandConfig`, `AgentResponse`)
- Functions: camelCase (`getActiveBrand`, `dispatchAgent`)
- Constants: UPPER_SNAKE_CASE (`AGENT_COLORS`, `MAX_RETRIES`)
- Private internals: prefixed `_` (`_normalizeTs`)

### Comments — the same rules as CLAUDE.md
- Default: write no comments. Names should explain what.
- Comment WHY when non-obvious: hidden constraint, subtle invariant, workaround for a specific bug.
- Never: WHAT comments, "added for X flow" comments, version-tag comments inside functions.

### Error handling
- Throw at programmer-error boundaries (invalid args, impossible state)
- Result types at network/sync boundaries: `Result<T, E>` from `services/result`
- Never silently swallow except in animation loops where one frame failure is acceptable

### Performance discipline
- No per-frame allocations in hot paths (cache gradients, particles, etc.)
- IntersectionObserver to pause off-screen animation
- `document.visibilitychange` to pause backgrounded tabs
- DPR cap at 1.5
- No `feGaussianBlur` in animated SVG
- See `05-brilli-animation.md` for the canvas patterns

---

## 6. The refactor backlog (ordered)

In execution order. Each is a 1-2 week item.

### Sprint 0 — Tooling (1-2 weeks)
- Add esbuild + vitest + tsconfig + eslint
- Migrate `src/build.sh` to `build.config.ts`
- Add `npm run dev`, `npm run build`, `npm run test`, `npm run typecheck`
- Verify deploy still works (deploy.sh calls the new build script)
- Set up Firebase emulator config for integration tests
- Document setup in CLAUDE.md

### Sprint 1 — Sync service extraction (2 weeks)
- Add `// @ts-check` + JSDoc to `22-firebase-sync.js`
- Create `services/sync/index.ts` wrapping the existing implementation
- Write tests covering past bugs (`_normalizeTs`, `mergeByTimestamp` empty array, `_all` doc subset, etc.)
- Migrate the 3-5 most-used callers to import from `services/sync`
- Document the sync architecture publicly in `docs/architecture/sync.md`

### Sprint 2 — Agents service extraction (2 weeks)
- Same pattern for `11-agents.js`
- Type the AgentId, ContentBlock, ToolCall, AgentResponse types
- Tests for model routing and multi-agent dispatch

### Sprint 3 — Stripe webhook hardening (1 week)
- Type the webhook endpoint
- Test signature verification + both purchase types
- Smoke test against Stripe's webhook tester

### Sprint 4 — Build Evolve (3 weeks)
- First feature built entirely under the new architecture
- Reference implementation
- See `14-evolve.md`

### Sprint 5 — Brand state extraction (2 weeks)
- Pull `window.brands`, `window.selectedBrandIdx`, etc. into `services/brand`
- This is the gateway to all other refactors because brand state is everywhere

### Sprint 6+ — Surface refactors per Tier 2 of the surface system
- Studio → Split-Pane (with `services/studio` extraction along the way)
- Folio → Studio at Work
- Notebook (Scribe rebrand) → Letter Series

### Sprint N (later) — Service replacements
- Once all surfaces import from `services/*`, the implementations underneath can be replaced with cleaner reimplementations behind the same interface
- Sync V5, agent system v2, etc.

---

## 7. What this playbook is NOT

- Not a feature spec. Each feature has its own doc.
- Not exhaustive. Edge cases get added as they're discovered.
- Not absolute. If a rule conflicts with shipping, ship — but document the deviation.
- Not a substitute for code review. Two pairs of eyes still catch what one misses.

---

## 8. The cultural rule

**No new code without a spec block. No refactor without tests. No "I'll figure it out as I go."**

The whole point of this playbook is to spend 30 minutes writing the spec block so we don't spend 30 hours debugging the implementation. The current RoweOS got fast iteration by skipping this step. That worked when the codebase was small. It does not work at the size we're at now.

If you (Jordan, Claude, or future contractor) catch yourself opening a code editor without a spec block written, **stop, write the spec block, then code.** Every time.

That single habit change is what "very intentional" means in practice.
