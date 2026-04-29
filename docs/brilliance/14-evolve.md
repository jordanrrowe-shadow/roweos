# Evolve — Skill Building & Educational Repository

**Status:** Feature spec, draft v0.1
**Codename:** Evolve
**Tier:** v33.5 (post v33.0 brand launch, before v34 architecture work)
**Architecture:** Built fresh under `15-architecture-playbook.md` standards. Reference implementation for all future modules.

---

## What it is

Evolve is the surface where the user **gets better over time** — at brand operations, at life management, at their own craft. It's a structured place for learning, retention, and skill development that's deeply integrated with the rest of Brilliance.

For the **operator's life**: a personal development OS. Skills you're building (writing, fitness, finance literacy, instrument practice, parenting, leadership). Books and articles you've read with AI-summarized retention. Habit tracking tied to identifiable competencies. Reflections journaled per skill.

For the **operator's brands**: a knowledge repository the team can train against. Brand SOPs ("how Rowe Reserve writes its concierge emails"). Process documentation. Onboarding content for contractors. Voice + standards for new hires. Spaced-repetition reinforcement for brand operators.

It's the answer to two questions Brilliance currently doesn't answer well:
- "What am I trying to be better at, and how is it going?"
- "How does someone new (myself in six months, a new contractor, a future team member) learn how this brand operates?"

---

## Why it belongs in Brilliance

Brilliance has Identity (who you are), Pulse (what's happening today), History (what you asked), and Library (what you've made). What's missing: **the dimension of growth**. The platform knows your standards, but it doesn't actively help you raise them.

Evolve fills that. It's the surface that turns Brilliance from a productivity platform into a **growth platform**.

It also has a real moat. Most AI products are tools you use today. Evolve is a system that compounds over months. The longer you use it, the more valuable it gets — your skills tree fills out, your retention deepens, your brand SOPs accumulate. A user who has used Evolve for a year cannot easily switch.

---

## What it is NOT

- Not a course platform (we don't sell or host courses)
- Not a tutoring product (we don't pretend to be Khan Academy)
- Not a habit tracker (Pulse already does daily/weekly cadence)
- Not a Notion-knockoff database (it has structure, not freeform tables)
- Not a social learning network (no shared feeds, no comments, no public profiles)

Evolve is **personal and brand-private**. Your skills tree is yours. Your brand's SOPs are the brand's. Brilliance helps you build them.

---

## Mental model

Three primary objects:

### 1. Skills
A skill is something you're trying to be better at. Examples: "Concise email writing," "Tax-aware financial decisions," "November booking-window cadence for Reserve."

A skill has:
- name, domain (life or brand-name), level (1-5), goals (what does mastery look like)
- linked sources (books, articles, lessons - where you're learning it from)
- linked reflections (journaled notes from your practice)
- linked artifacts (real outputs that demonstrate progress - drafts, recordings, decisions)
- spaced-repetition state (when did Brilliance last quiz you on this)

### 2. Sources
A source is a piece of input. Books, articles, podcasts, courses, conversations.

A source has:
- title, type (book / article / podcast / course / conversation / video)
- linked skill(s) — what this source contributes to
- consumed-on date, completion %
- AI-generated summary, key takeaways, retention prompts
- raw notes (your own quotes / highlights)

### 3. Reflections
A reflection is a journaled note tied to a skill. Written in Notebook, surfaced in Evolve.

A reflection has:
- linked skill, date, body (Old Standard TT prose)
- self-assessed insight quality (1-3 stars - was this a real insight or just journaling)
- AI-suggested next-step ("based on this reflection, you might explore...")

### 4. Brand SOPs (brand mode only)
A brand SOP is a process documented for delegation. "How Rowe Reserve handles a new booking inquiry."

A brand SOP has:
- name, owner, status (draft / active / deprecated)
- ordered steps, with expected outputs at each step
- example artifacts that demonstrate "good"
- pointer to the relevant agent system prompts (so the AI follows the SOP too)
- last-reviewed date, version history

---

## Surface concept fit

Evolve is a NEW view. It uses multiple chat-concept treatments because it has multiple modes:

| Mode | Concept (from `11-chat-interface-concepts.md`) | Why |
|---|---|---|
| Skills overview | **Spatial Constellation** (B1) | A 2D map of skills clustered by domain. Visual progress over time. |
| Skill deep-dive | **Letter Series** (A2) on cream paper | Reflections read like a journal of becoming. Retention. |
| Source consumption | **Living Document** (A1) | A book/article digest reads as a structured document with AI marginalia. |
| Brand SOPs | **Pinboard** (B2) | Steps + artifacts + branches. Like a research board, but for "how we do this." |
| Spaced-repetition prompt | **Negative Space** (E1) | One question at a time. Quiet. Single-task. |
| Brilliance teaching | **Concierge Desk** (C1) | Brilliance suggests today's micro-lesson based on your skills + recent reflections. |

Evolve is therefore a **multi-modal surface**. The view has tabs for each mode. The tab determines the visual treatment. This is unique within Brilliance and earns Evolve its own identity.

---

## Data model

### Local (localStorage)
```
brilliance_evolve_skills:    Skill[]      # all skills, life + brand
brilliance_evolve_sources:   Source[]     # all sources
brilliance_evolve_reflections: Reflection[]  # all reflections
brilliance_evolve_sops:      Record<BrandId, SOP[]>  # SOPs scoped per brand
brilliance_evolve_repetition: RepetitionQueue  # spaced repetition state
brilliance_evolve_settings:  EvolveSettings
```

NOTE: localStorage prefix is `brilliance_evolve_*` for NEW Evolve data. (Existing roweos_* keys are unchanged. Evolve is a new feature, gets the new prefix from day 1 since there's no migration risk.)

### Cloud (Firestore)
```
users/{uid}/evolve/skills/{skillId}        # individual skill docs
users/{uid}/evolve/sources/{sourceId}
users/{uid}/evolve/reflections/{reflId}
users/{uid}/evolve/sops/{brandId}/{sopId}
users/{uid}/evolve/repetition_queue        # single doc
users/{uid}/evolve/_all                    # rollup, fallback only (per existing sync convention)
```

Sync rules: write-through (every save → local AND cloud), cloud-authoritative on pull, `_all` doc as fallback only (per `services/sync` contract).

### TypeScript types

```typescript
// services/evolve/types.ts
export type SkillId = string;
export type SourceId = string;
export type ReflectionId = string;
export type SopId = string;

export type SkillDomain = 'life' | { brand: BrandId };
export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export interface Skill {
  id: SkillId;
  name: string;
  domain: SkillDomain;
  level: SkillLevel;
  goals: string;
  linkedSourceIds: SourceId[];
  linkedReflectionIds: ReflectionId[];
  linkedArtifactIds: string[];     // pointers to Library items
  repetition: {
    lastQuizzedAt?: number;
    nextDueAt?: number;
    streak: number;
  };
  _modifiedAt: number;
  _createdAt: number;
}

export interface Source {
  id: SourceId;
  title: string;
  type: 'book' | 'article' | 'podcast' | 'course' | 'conversation' | 'video';
  linkedSkillIds: SkillId[];
  consumedOn?: number;
  completionPct: number;
  aiSummary?: string;
  keyTakeaways?: string[];
  retentionPrompts?: RetentionPrompt[];
  userNotes?: string;
  url?: string;
  _modifiedAt: number;
  _createdAt: number;
}

export interface Reflection {
  id: ReflectionId;
  linkedSkillId: SkillId;
  body: string;
  insightQuality: 1 | 2 | 3;
  aiNextStep?: string;
  _modifiedAt: number;
  _createdAt: number;
}

export interface RetentionPrompt {
  id: string;
  question: string;
  answer: string;
  lastShownAt?: number;
  nextDueAt?: number;
}
```

---

## Public API (services/evolve/index.ts)

```typescript
// Skills
export function listSkills(domain?: SkillDomain): Promise<Skill[]>;
export function getSkill(id: SkillId): Promise<Skill | null>;
export function createSkill(input: Omit<Skill, 'id' | '_createdAt' | '_modifiedAt' | 'repetition'>): Promise<Skill>;
export function updateSkill(id: SkillId, patch: Partial<Skill>): Promise<Skill>;
export function deleteSkill(id: SkillId): Promise<void>;
export function levelUp(id: SkillId): Promise<Skill>;
export function linkSkillToSource(skillId: SkillId, sourceId: SourceId): Promise<void>;

// Sources
export function listSources(): Promise<Source[]>;
export function addSource(input: Omit<Source, 'id' | '_createdAt' | '_modifiedAt'>): Promise<Source>;
export function summarizeSource(id: SourceId): Promise<Source>;  // calls AI to fill aiSummary etc.
export function generateRetentionPrompts(id: SourceId): Promise<RetentionPrompt[]>;

// Reflections
export function listReflections(skillId?: SkillId): Promise<Reflection[]>;
export function addReflection(input: Omit<Reflection, 'id' | '_createdAt' | '_modifiedAt' | 'aiNextStep'>): Promise<Reflection>;
export function suggestNextStep(reflectionId: ReflectionId): Promise<string>;

// Spaced repetition
export function dueRepetitionPrompts(): Promise<RetentionPrompt[]>;
export function recordRepetitionResult(promptId: string, result: 'correct' | 'partial' | 'incorrect'): Promise<void>;

// Brand SOPs
export function listSops(brandId: BrandId): Promise<Sop[]>;
export function createSop(brandId: BrandId, input: Omit<Sop, 'id' | '_createdAt' | '_modifiedAt'>): Promise<Sop>;
export function applySopToAgent(brandId: BrandId, sopId: SopId, agentId: AgentId): Promise<void>;

// UI integration
export function renderEvolveView(rootEl: HTMLElement, opts?: { tab?: EvolveTab }): void;

// Cross-surface integration
export function getSkillsForBrand(brandId: BrandId): Promise<Skill[]>;
export function getRepetitionPromptForToday(): Promise<RetentionPrompt | null>;  // called by Pulse
```

---

## Cross-surface integrations

Evolve is well-designed if it integrates with everything else. Each integration:

### With Identity
- Skills feed into Identity: a brand's "current skill focus" is part of the brand identity Brilliance sees in every prompt
- Life skills feed into LifeAI's coaching context

### With Pulse
- Today's "due retention prompt" appears as a Pulse card
- Today's "skill in focus" surfaces in Pulse
- Reflection completion feeds Pulse rhythm streaks

### With Notebook
- Reflections are written in Notebook (Letter Series treatment)
- Notebook can attach a reflection to a skill on save

### With Library
- Sources can be added from Library items (a saved book, podcast, etc.)
- Artifacts that demonstrate skill progress are linked from Library

### With History
- Past reflections appear on the Time Ribbon as gold markers
- Skill level-ups appear as chapter markers

### With Brilli
- Brilli appears at the top of Evolve in "tutor" mode (a Brilli pose for teaching: head tilted slightly, antennae forward, attentive)
- Brilli triggers retention prompts on a calm cadence

### With agents
- Brand SOPs can be applied to an agent's system prompt: "When operating as Strategy for Rowe Reserve, follow SOP #4 (booking inquiry response)"

---

## State machine

```
EvolveTab: 'skills' | 'sources' | 'reflections' | 'sops' | 'repetition'
SkillDetailMode: 'overview' | 'practice' | 'history'
SourceDetailMode: 'reading' | 'summary' | 'retention'
RepetitionFlow: 'idle' | 'prompt' | 'reveal' | 'recording' | 'complete'
```

Each tab is independent. Switching tabs preserves per-tab state.

---

## UI surfaces

### Desktop layout
```
+---------------------------------------------------+
| Top bar: Evolve / [tabs] / settings               |
+---------+-----------------------------------------+
| Sidebar | Active tab content                      |
|  (list  |  - Skills tab: Constellation map        |
|   of    |  - Sources tab: Living Document feed   |
|   items)|  - Reflections tab: Letter Series       |
|         |  - SOPs tab: Pinboard (per brand)       |
|         |  - Repetition tab: Negative Space      |
+---------+-----------------------------------------+
```

### Mobile layout
- Tabs become a bottom tab bar within Evolve (sub-nav)
- Sidebar collapses to a slide-out
- Constellation becomes a vertical scroll list
- Letter Series / Living Document already responsive
- Pinboard becomes a vertical card stack on mobile

---

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Feature creep into "course platform" | High | Spec NON-GOALS section. Evolve summarizes and reinforces; it doesn't author courses. |
| Spaced repetition becomes annoying | High | Calm cadence default (1/day max). User can disable entirely in Settings. Brilli pulse to indicate "ready when you are," not a notification. |
| Data model evolves and breaks existing data | Medium | Versioned schemas in `types.ts`. Migration helpers in `services/evolve/migrations.ts`. |
| Cross-surface integrations create coupling nightmares | High | All cross-surface calls go through `services/evolve` public API. No surface imports Evolve internals. |
| Performance: thousands of sources/reflections | Medium | List virtualization (only render visible). Lazy load AI summaries. Index by skillId for fast lookup. |
| Brand SOP applied to agent prompt makes prompt huge | High | SOPs are summarized into <=150 tokens before injection. Full SOP available on demand. |
| Privacy / leakage between brand SOPs | High | SOPs scoped strictly to `users/{uid}/evolve/sops/{brandId}/`. Never injected cross-brand. |

---

## Tests required

```
src/__tests__/evolve/skills.test.ts
  - createSkill validates required fields
  - levelUp increments level and resets repetition.streak
  - linkSkillToSource updates both skill and source
  - deleteSkill cascades unlinking from sources/reflections

src/__tests__/evolve/sources.test.ts
  - addSource validates type
  - summarizeSource calls agent service and persists result
  - generateRetentionPrompts produces queue items

src/__tests__/evolve/reflections.test.ts
  - addReflection links to skill
  - suggestNextStep produces non-empty result
  - reflections sort by date

src/__tests__/evolve/repetition.test.ts
  - dueRepetitionPrompts returns prompts past nextDueAt
  - recordRepetitionResult updates streak per result type
  - calm-cadence respected: never returns more than 5 prompts in a 24h window

src/__tests__/evolve/sops.test.ts
  - createSop scoped to brand
  - applySopToAgent injects into prompt assembly
  - SOPs from brand A never inject into brand B's agents

src/__tests__/evolve/integration.test.ts
  - Pulse today-card includes due repetition prompt
  - Notebook reflection save creates Reflection in Evolve
  - Library item linked as Source updates both surfaces
```

Total: ~40 tests covering Evolve's public API and cross-surface integrations.

---

## Phased rollout

### Phase 1 — Skills + Sources (3 weeks)
- Skills CRUD, Constellation map view
- Sources CRUD, Living Document view
- Cross-link Skills ↔ Sources
- AI summarize source
- Tests

### Phase 2 — Reflections + Repetition (2 weeks)
- Reflections CRUD via Notebook integration
- Spaced repetition queue + Negative Space prompts
- Pulse integration (today's due prompt)
- Tests

### Phase 3 — Brand SOPs (2 weeks)
- SOP CRUD scoped per brand
- Pinboard view for SOPs
- Agent prompt injection
- Tests

### Phase 4 — Cross-surface polish (1 week)
- History timeline shows reflection markers and skill level-ups
- Identity integration (skill focus per brand)
- Brilli "tutor" pose

Total: ~8 weeks. Lands in v33.5 after v33.0 ships.

---

## Naming considerations

- View label: **Evolve**
- Internal `data-view`: `"evolve"` (new)
- Sidebar position: between Library and Pulse (where current users look for "growth-adjacent" surfaces)
- Icon: a small upward-spiraling glyph (per brand graphics; placeholder uses an SVG arrow-loop)

---

## Open questions for Jordan

1. **Phase 1 priority confirmed?** Skills + Sources first, before Reflections and SOPs. My pick: yes.
2. **Brand SOPs in scope for Evolve, or a separate v34 feature?** Recommendation: include in Evolve, because the agent-prompt-injection integration is the moat. But Phase 3 means it's not on day 1.
3. **Spaced repetition default cadence:** 1/day, 1/week, or off-by-default? Recommend 1/day with quiet design (no badge spam).
4. **Brand SOPs visible to other team members on the same brand config?** Or strictly personal? Recommend personal for v33.5; team-shareable in a v34 multi-user feature.
5. **AI source summaries — which model?** Recommend Claude (highest summarization quality). Cost note: each new source = one AI call.
6. **Notebook integration** — when you write a reflection in Notebook, does Notebook know it's a "reflection" or is it just a regular note? Recommend a "tag this entry as a reflection on [skill]" toggle in Notebook's metadata panel.
