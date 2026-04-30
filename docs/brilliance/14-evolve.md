# Evolve — Educational Intelligence Module

**Status:** Spec v0.2 (synthesizing the original v0.1 surface design with the concrete PDF blueprint dated 2026-04-29)
**Codename:** Evolve
**Tier:** v33.5 architectural foundation; full ship by v34
**Architecture:** Built fresh under `15-architecture-playbook.md`. First feature using `services/sync` v5 (`16-sync-v5.md`). Reference implementation for all future modules.
**Source of vision:** Combined from initial RoweOS spec + the IBHRE-CCDS edge-case PDF (the "stress-test template" — see §1.3)

---

## 1. Vision

### 1.1 What Evolve is

Evolve is the **Educational Intelligence Module** of Brilliance — a deeply integrated, multi-model engine that helps any user master anything: a beginner learning Python, a professional passing the Bar, an expert securing an elite medical board, a graphic designer learning React, a new hire onboarding into "Junior Account Manager at Stripe."

Standard learning platforms (Anki, Quizlet, Coursera, traditional LMS) are **static, punitive, and require heavy manual input**. They don't know who you are. They don't translate from what you already know. They punish you with red overdue alerts when you miss a day.

Evolve does the opposite. It uses RoweOS's existing infrastructure — **Memory, Smart Model Routing, Pulse, Rhythm, Deep Research, and Inline Visuals** — to create a completely autonomous, context-aware learning OS.

### 1.2 What Evolve is NOT

- Not a course catalog (we don't sell or host courses)
- Not a tutoring product (we don't pretend to be Khan Academy)
- Not a habit tracker (Pulse already does daily/weekly cadence)
- Not a Notion-knockoff database (it has structure, not freeform tables)
- Not a social learning network (no shared feeds, no comments, no public profiles)

Evolve is **personal and brand-private**. Your skills tree is yours. Your brand's SOPs are the brand's. Brilliance helps you build them.

### 1.3 The Stress-Test Template

To ensure Evolve scales beautifully for the generalized public, the architecture is stress-tested against a deliberately extreme edge case. If the architecture handles this, it handles everything below.

| Aspect | Profile |
|---|---|
| **Target Goal** | Pass IBHRE-CCDS Medical Board Exam, August 5, 2026 |
| **Memory Context** | Field Clinical Specialist, 2 years at Biotronik |
| **Cognitive Profile** | Severe ADHD. Static study plans cause task-paralysis. Requires high-dopamine gamification, micro-learning, "guilt-free" timeline |
| **Content Constraint** | Outdated test-prep books are useless. Must autonomously pull from live, peer-reviewed databases (2026 HRS/EHRA guidelines) and translate proprietary field knowledge to generalized exam terminology |

This profile is the proving ground. If Evolve can serve this user, it can serve a graphic designer learning React or a new Stripe hire on day-one onboarding.

---

## 2. The 6-Pillar Framework

The architecture has **one foundation + five pillars + one bonus capability.** Each pillar maps to a concrete component, a multi-model API route, and a placement inside the existing RoweOS surface system.

### Foundation — Memory as Learner Identity

Before any pillar runs, Evolve reads the user's RoweOS Memory profile:

```typescript
interface EvolveProfile {
  targetGoal: string;              // "Pass IBHRE-CCDS Aug 5, 2026"
  deadlineDate: string;            // ISO date
  knownContext: string[];          // ["Biotronik FCS", "2 YOE", "active in CRT-D"]
  cognitiveProfile: string;        // "severe ADHD, visual learner, requires micro-tasks"
  brandScope?: BrandId;            // optional brand context (for SOPs)
  currentXP: number;
  dailyStreak: number;
}
```

A backend utility `generateEvolveSystemPrompt(profile)` injects this into EVERY LLM call:

> *"User has severe ADHD. Use bolded keywords, short bullet points, zero fluff. Map all generic pacing concepts to Biotronik equivalents (CLS, DX Leads) FIRST. Prioritize current 2026 HRS guidelines."*

This is the **Translator** pattern. Foreign concepts are taught via the user's existing mental models. A graphic designer learning React gets coding syntax mapped to Adobe Illustrator concepts they already understand. A new Stripe hire gets API auth concepts mapped to whatever they already know about authentication.

The Translator is what makes Evolve fundamentally different from every other learning tool. Memory becomes pedagogy.

---

### Pillar 1 — Pulse Dashboard

**Surface:** Inside Pulse view (existing) + dedicated Evolve view "Today" tab
**Concept treatment:** Concierge Desk (per `12-surface-system.md`)

**What the user sees:**
- **Glowing countdown** to deadline ("98 days until IBHRE 2026")
- **Today's load: exactly 3 micro-tasks** (no walls of text)
- **Pomodoro 25/5 timer** anchored to the screen
- **XP tracker bar + dailyStreak counter** (gamification)
- **Brilli at the top in tutor mode** (head tilted forward, attentive)

**Component:** `EvolveDashboard.tsx` (per the PDF blueprint Prompt 1)

**Why it works:** Anti-overwhelm. The user opens RoweOS and sees three things to do today, with a timer that already knows how to start. No daunting course outline. No "you're behind." Just three micro-tasks, a countdown, and a button.

---

### Pillar 2 — Liquid Rhythm Planner (Anti-ADHD Engine)

**Surface:** Embedded inside Rhythm view + Evolve "Today" tab
**Concept treatment:** Continuous-by-default; no overdue states

**What the user sees:**
- A reverse-engineered curriculum from the deadline date back to today
- Tasks distributed across days
- **No red OVERDUE alerts ever** — missing a day does NOT cascade into shame
- A satisfying **"Recalibrate Momentum" button** that, when clicked, silently and mathematically redistributes missed topics across remaining days

**The algorithm:**
```typescript
function recalibrateMomentum(
  curriculum: CurriculumTopic[],
  deadline: Date,
  missed: CurriculumTopic[]
): CurriculumTopic[] {
  const daysRemaining = daysBetween(today(), deadline);
  const remainingTopics = curriculum.filter(t => !t.completedAt);
  const tasksPerDay = Math.ceil(remainingTopics.length / daysRemaining);
  return distributeEvenly(remainingTopics, daysRemaining, tasksPerDay);
}
```

**Component:** `LiquidRhythmPlanner.tsx` (per PDF Prompt 2)

**Why it works:** Traditional planners punish neurodivergent users via the cascade of red alerts that follow a missed day. Evolve refuses to participate in that pattern. Missing a day is met with a calm UI affordance that says, mathematically, *we're still on track — here's the new shape of the next 95 days*. ADHD users don't quit when the system stops shaming them.

**Cross-cutting:** Checking off a task triggers a `framer-motion` color bloom (dopamine hit) and dispatches `ADD_XP` to the Evolve state.

---

### Pillar 3 — Infinite Assessment Engine (The Quiz Pipeline)

**Surface:** Evolve "Practice" tab + can be invoked from any context
**Concept treatment:** Negative Space (one question at a time, no overwhelm)

**The pipeline:**

| Step | Model | Purpose |
|---|---|---|
| **Nightly research** | Gemini 3.1 Pro Deep Research | Scrape latest authoritative sources for tomorrow's topic (HRS guidelines, peer-reviewed studies, Stripe public docs, React docs, etc.) |
| **Question generation** | GPT-5.5 Thinking | Generate novel high-difficulty questions with Why/Why Not matrices in strict JSON |
| **Inline render** | Claude 4.7 Opus (when needed) | Render comparative visuals if the question references a concept |
| **Spatial fallback** | Veo 3.1 (when triggered) | Generate 10s educational video for spatial concepts the user repeatedly fails |

**Question schema:**
```typescript
interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  correctRationale: string;          // "Citing 2026 HRS EV-ICD Consensus..."
  distractorRationales: {            // The Why/Why Not matrix
    [key: 'A' | 'B' | 'C' | 'D']: string;
  };
  citations: Array<{
    title: string;
    url: string;
    publishedYear: number;
  }>;
  topic: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}
```

**The Why/Why Not Matrix** is the pedagogical move. When a user picks Option B (incorrect):
- Correct answer (A) immediately highlights green
- Accordion expands with: **citation** → **why A is correct** → **why B is physiologically incorrect** → **why C and D are incorrect**

This prevents *negative knowledge transfer* — the trap where wrong answers stay in memory because they were the last thing read.

**Component:** `InfiniteAssessmentEngine.tsx` + `QuizCard.tsx` (per PDF Prompt 3)

---

### Pillar 4 — Context Translator (Inline Visual Mini-App)

**Surface:** Evolve "Translate" tab + inline mini-app inside Chat
**Concept treatment:** Two-pane Living Document (per `12-surface-system.md`)

**What the user sees:**
- **Left pane:** "My Context" — user inputs a proprietary term they know (e.g., "Biotronik DX Lead")
- **Right pane:** Streaming inline visual table showing:
  1. The generic industry terminology
  2. The core physiologic mechanism
  3. Exact equivalents at top competitors (Medtronic, Abbott, Boston Scientific)

**Save to Memory:** A button persists the mapping permanently. Future quizzes use it. The Translator's memory grows.

**Generalized examples:**
- Designer types "Adobe Illustrator path" → sees React syntax for SVG elements + DOM mapping
- New hire types "Stripe Connect" → sees Plaid, Square, Adyen equivalents + the underlying payment-rails concept
- Solo founder types "my brand voice" → sees how it maps to known voice frameworks (Tone of Voice quadrants, etc.)

**Component:** `ContextTranslator.tsx` (per PDF Prompt 4)

**Why it works:** The most common reason adults don't learn is that new material lacks a hook to existing knowledge. The Translator forces every concept to land on something the user already understands.

---

### Pillar 5 — Deep Verification Studio (Peer-Review Mode)

**Surface:** Evolve "Verify" tab + button inside Notebook
**Concept treatment:** Negative Space then Brief (one question, one answer)

**The flow:**
1. User pastes a confusing concept, real-world scenario, or textbook claim into a minimalist text area
2. System routes to **Gemini Deep Research + GPT-5.5 Pro** (multi-model verification)
3. The system prompt is strict:
   > *"Act as a peer-review Board Examiner. Cross-reference the user's submitted text against published clinical data and major trials. Provide a definitive [VERIFIED] or [CORRECTED] badge. If flawed, explicitly correct the logic with citations. Format for an ADHD reader: short bullets, bold critical physiological keywords."*
4. Renders a clean citable brief with PubMed / authoritative source links

**Saves to Library** as a verified knowledge artifact the user can reference forever.

**Component:** `PeerReviewStudio.tsx` (per PDF Prompt 5)

**Why it works:** Users don't trust AI output for high-stakes decisions. Peer-Review converts AI output into citation-backed knowledge, removing the trust gap.

---

### Bonus — Visual Concept Generator (Veo 3.1)

**Surface:** Auto-triggered from Quiz Engine or manually invoked from Translate
**Trigger:** When the system detects the user has failed the same spatial concept (12-lead ECG vectors, LBBAP lead placement, 3D molecular geometry, hand position in piano fingering, etc.) **3+ times in a row**

**The action:** Evolve autonomously prompts Veo 3.1 to generate a 10-second educational video visualizing the concept. Saves to Library + links to the skill in the Skills tree.

**Generalized:**
- Failing chord inversion concepts in piano → 10-second video showing finger movement
- Failing CSS flexbox alignment → 10-second video showing the box-model dance
- Failing chemistry stereochemistry → 10-second video rotating the molecule

**Why it works:** Some concepts are spatial. No amount of words helps. Veo gives Evolve the eyes the user needs.

---

## 3. The Storage Layer (preserved from v0.1)

The 6 pillars above are the *experience layer*. Below them sits a typed data model that persists what's been learned, sourced, and reflected on. From the original v0.1:

### Skills (`services/evolve/skills`)
A skill is something the user is trying to be better at.
- Fields: `id, name, domain ('life' | {brand: BrandId}), level (1-5), goals, linkedSourceIds, linkedReflectionIds, linkedArtifactIds, repetition`
- Visual: rendered as the **Constellation map** (Spatial Constellation concept) when "Library" tab is open

### Sources (`services/evolve/sources`)
Books, articles, podcasts, courses, conversations.
- Fields: `id, title, type, linkedSkillIds, consumedOn, completionPct, aiSummary, keyTakeaways, retentionPrompts, userNotes`
- Visual: **Living Document feed** in the "Library" tab

### Reflections (`services/evolve/reflections`)
Journaled notes tied to a skill, written via Notebook integration.
- Fields: `id, linkedSkillId, body, insightQuality (1-3), aiNextStep`
- Visual: **Letter Series** in the "Library" tab (Notebook integration auto-saves reflections here)

### Brand SOPs (`services/evolve/sops`, brand-scoped)
Documented brand processes the team can train against.
- Fields: `id, name, owner, status, steps, exampleArtifactIds, agentPromptInjection, lastReviewedAt`
- Visual: **Pinboard** in the "SOPs" tab (brand mode only)
- Special integration: SOP can be applied to an agent's system prompt for consistent brand-voice work

### Repetition Queue (`services/evolve/repetition`)
Spaced repetition schedule for retention prompts derived from sources.
- Fields: `prompts[], nextDueAt, calmCadence (1/day default)`
- Visual: **Negative Space** prompt that surfaces in Pulse + Practice tab

---

## 4. Cross-Surface Integration (the connective tissue)

Evolve is well-designed if it integrates with everything else. Each integration:

| RoweOS Surface | What Evolve adds |
|---|---|
| **Memory (Identity)** | Skills feed back into Identity. The brand's "current skill focus" enters every brand prompt Brilliance composes. Life skills feed LifeAI's coaching context. |
| **Pulse** | Today's countdown card. Today's 3 micro-tasks. Today's due retention prompt. Skill streaks. |
| **Rhythm** | Liquid Rhythm Planner (deadline → daily load) lives here as well as in Evolve's Today tab. |
| **Notebook** | Reflections written in Notebook auto-link to the active skill. Notebook gets a "Tag as reflection" toggle. |
| **Library** | Sources can be added from Library items. Veo videos auto-save here. Verified briefs (Pillar 5) save here. |
| **History (Time Ribbon)** | Past reflections appear as gold markers. Skill level-ups appear as chapter markers. |
| **Brilli** | "Tutor pose" — head tilted forward, antennae attentive — when active in any Evolve surface. Triggers Pleased state on level-ups. |
| **Agents** | Brand SOPs can be applied to specific agent system prompts. Translator queries route through `services/agents`. |
| **Automations** | Nightly Deep Research pipeline runs as an automation. Question generation runs as an automation. |
| **Smart Routing** | Multi-model orchestration (Gemini for research, GPT for generation, Claude for visuals, Veo for spatial) — Evolve is the most demanding consumer of the routing layer. |
| **Welcome modal** | New users see "Evolve is the part of Brilliance that helps you master anything" as one of the first-class capabilities. |

**Architectural rule:** All cross-surface calls go through `services/evolve` public API. No surface imports Evolve internals. (Per architecture playbook §2.2.)

---

## 5. A Day in the Life of Evolve

A user opens RoweOS Tuesday morning. Their Memory profile says: Field Clinical Specialist at Biotronik, 2 YOE, severe ADHD, target IBHRE-CCDS Aug 5.

| Time | Surface | What happens |
|---|---|---|
| **08:14** | Launch | Brilli pulses. Boot completes. Pulse opens by default. |
| **08:14** | Pulse | Countdown: **"98 days until IBHRE 2026"**. Today's Evolve card shows **3 micro-tasks**. Brilli is in tutor pose. |
| **08:15** | Pulse → Evolve "Today" | User taps the Evolve card. Liquid Rhythm Planner shows today's load. Pomodoro 25/5 ready. |
| **08:16** | Evolve "Practice" | User clicks Start Session. **One** question appears — a complex EV-ICD sensing scenario, generated overnight via Gemini Deep Research → GPT-5.5 Thinking. |
| **08:17** | QuizCard | User picks Option B. UI flashes Option A in green. Accordion expands: *Guideline Citation: 2026 HRS EV-ICD Consensus. Why A is correct... Why your choice (B) is physiologically incorrect... Why C and D are incorrect...* |
| **08:19** | Evolve "Verify" | User confused by the rationale. Clicks "Deep Verify." Pastes the rationale. Gemini + GPT-5.5 Pro return: **VERIFIED** with 3 PubMed citations linked. Saves to Library. |
| **08:31** | Pomodoro break | 25 minutes elapsed. Brilli pulses Pleased. **+12 XP**. Streak: 9 days. Recalibrate button is hidden today (no missed days). |
| **Tomorrow 06:00** | Background | Nightly Deep Research pipeline runs. New questions ready by 7am. |
| **Three days later** | Evolve "Today" | User missed two days (sick). No red alerts. A small calm button: *"Recalibrate Momentum."* User clicks. The remaining 47 topics redistribute mathematically across the next 91 days. **3 micro-tasks** still load today. |
| **Week 6** | Quiz Engine detects user has failed 3 LBBAP-lead-placement questions in a row | Evolve autonomously triggers Veo 3.1. **A 10-second educational video** generates and saves to Library. The next time LBBAP comes up, the video plays automatically before the question. |

That's the experience. Quiet. Continuous. Confident. Anti-shame. Multi-model. Citation-backed.

---

## 6. Generalization (the same architecture, different domains)

The architecture is content-agnostic. Drop a different `EvolveProfile` and Memory context, and the same 6 pillars serve different users.

### A graphic designer learning React
- **EvolveProfile**: `targetGoal: "Build my first React app"`, `knownContext: ["10 years Adobe Illustrator", "no programming background"]`, `cognitiveProfile: "visual learner"`
- **Pillar 1 (Pulse)**: 3 micro-tasks/day. Countdown to "first deployed app."
- **Pillar 2 (Rhythm)**: 6-week curriculum reverse-engineered from a chosen target.
- **Pillar 3 (Quiz)**: Novel React questions generated nightly from MDN + React docs.
- **Pillar 4 (Translate)**: User types "SVG path" → gets React JSX equivalent + DOM mapping + comparison to Illustrator's path tool.
- **Pillar 5 (Verify)**: User pastes a confusing hooks concept → Peer-Review returns verified explanation with linked React docs.
- **Bonus (Veo)**: Failing flexbox layout? 10-second video of the box-model dance.

### A new "Junior Account Manager at Stripe" hire
- **EvolveProfile**: `targetGoal: "Be ready for Day 1 at Stripe"`, `knownContext: ["B2B SaaS sales 3 YOE"]`, `cognitiveProfile: "fast reader, prefers structured outlines"`
- **Pillar 1**: 30-day countdown to start date.
- **Pillar 2**: Daily load: read X article + answer Y question + watch Z 5-min video.
- **Pillar 3**: Quiz questions generated from Stripe public docs (api.stripe.com, stripe.com/docs, stripe blog).
- **Pillar 4**: Translator maps Stripe concepts (Connect, Treasury, Issuing) to known competitors (Plaid, Square, Adyen).
- **Pillar 5**: Verify any internal claim against Stripe's actual documentation.

### A founder learning fundraising
- **EvolveProfile**: `targetGoal: "Raise a $1M seed in 6 months"`, `knownContext: ["solo founder, 10 paying clients"]`, `cognitiveProfile: "founder, high-context"`
- The 6 pillars adapt to deck-building, narrative crafting, term-sheet literacy, investor-research drills.

The architecture doesn't change. Only Memory, deadline, and source corpus do.

---

## 7. Data Model (TypeScript, locked)

```typescript
// services/evolve/types.ts

export type SkillId = string;
export type SourceId = string;
export type ReflectionId = string;
export type SopId = string;

export type SkillDomain = 'life' | { brand: BrandId };
export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export interface EvolveProfile {
  id: string;
  targetGoal: string;
  deadlineDate: string;        // ISO
  knownContext: string[];
  cognitiveProfile: string;
  brandScope?: BrandId;
  currentXP: number;
  dailyStreak: number;
  startedAt: number;
}

export interface Skill {
  id: SkillId;
  name: string;
  domain: SkillDomain;
  level: SkillLevel;
  goals: string;
  linkedSourceIds: SourceId[];
  linkedReflectionIds: ReflectionId[];
  linkedArtifactIds: string[];
  repetition: { lastQuizzedAt?: number; nextDueAt?: number; streak: number };
  _modifiedAt: number;
  _createdAt: number;
}

export interface Source {
  id: SourceId;
  title: string;
  type: 'book' | 'article' | 'podcast' | 'course' | 'conversation' | 'video' | 'documentation';
  url?: string;
  linkedSkillIds: SkillId[];
  consumedOn?: number;
  completionPct: number;
  aiSummary?: string;
  keyTakeaways?: string[];
  retentionPrompts?: RetentionPrompt[];
  userNotes?: string;
  _modifiedAt: number;
  _createdAt: number;
}

export interface CurriculumTopic {
  id: string;
  title: string;
  scheduledDate: string;        // ISO date string
  estimatedMinutes: number;
  linkedSkillId: SkillId;
  completedAt?: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  correctRationale: string;
  distractorRationales: Record<'A' | 'B' | 'C' | 'D', string>;
  citations: Array<{ title: string; url: string; publishedYear: number }>;
  topic: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  generatedAt: number;
  generatedBy: 'gpt-5.5-thinking' | 'claude-4.7-opus' | string;
  sourceModel: string;          // which Deep Research source was used
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

export interface ContextTranslation {
  id: string;
  userTerm: string;
  genericTerm: string;
  mechanism: string;
  competitorMappings: Record<string, string>;
  savedToMemory: boolean;
  _createdAt: number;
}

export interface VerifiedBrief {
  id: string;
  submittedText: string;
  badge: 'VERIFIED' | 'CORRECTED';
  body: string;
  citations: Array<{ title: string; url: string }>;
  _createdAt: number;
}

export interface VeoConcept {
  id: string;
  conceptName: string;
  triggerReason: 'failed_3_times' | 'manual';
  videoUrl: string;
  durationSeconds: number;
  _createdAt: number;
}

export interface Sop {
  id: SopId;
  brandId: BrandId;
  name: string;
  owner: string;
  status: 'draft' | 'active' | 'deprecated';
  steps: Array<{ order: number; description: string; expectedOutput: string }>;
  exampleArtifactIds: string[];
  agentPromptInjection?: string;   // distilled SOP for agent system prompts
  lastReviewedAt: number;
  _modifiedAt: number;
  _createdAt: number;
}
```

All items use the `Synced<T>` envelope from sync v5 (id, _modifiedAt, _createdAt, _deletedAt?, _clientId, _schemaVersion).

---

## 8. Component Tree

```
src/services/evolve/
  index.ts                    # public API (CRUD + cross-surface helpers)
  types.ts                    # all interfaces above
  state.ts                    # Zustand store: EvolveProfile + currentXP + dailyStreak
  collections.ts              # Collection<T> instances for skills, sources, reflections, sops, etc.
  prompt-injector.ts          # generateEvolveSystemPrompt(profile)
  recalibrate.ts              # recalibrateMomentum() algorithm
  question-pipeline.ts        # nightly Gemini -> GPT-5.5 -> JSON
  translator.ts               # Claude 4.7 routing for context mapping
  verifier.ts                 # Gemini + GPT-5.5 verification flow
  veo-trigger.ts              # detect 3+ failures + Veo prompt
  __tests__/                  # all the tests

src/views/evolve/
  EvolveDashboard.tsx         # Pulse Dashboard (Pillar 1)
  LiquidRhythmPlanner.tsx     # Anti-ADHD planner (Pillar 2)
  InfiniteAssessmentEngine.tsx # Quiz pipeline (Pillar 3)
  QuizCard.tsx                # Why/Why Not Matrix UI
  ContextTranslator.tsx       # Two-pane mini-app (Pillar 4)
  PeerReviewStudio.tsx        # Verification (Pillar 5)
  EvolveSkillsConstellation.tsx # Library tab — skills map
  EvolveLibraryFeed.tsx       # Library tab — sources feed
  EvolveSopBoard.tsx          # SOPs tab — brand pinboard

src/api/evolve/
  generate-questions.ts       # nightly Cron: Deep Research → GPT-5.5 → questions
  translate.ts                # Claude 4.7 route
  verify.ts                   # peer-review route
  trigger-veo.ts              # Veo invocation
```

Every component file opens with a spec block per `15-architecture-playbook.md` §1.

---

## 9. Build Plan (sprint-by-sprint)

### Sprint A — Foundation + Pulse Dashboard (2 weeks)
- `services/evolve/state.ts` — Zustand store + `EvolveProfile` type
- `services/evolve/prompt-injector.ts` — `generateEvolveSystemPrompt(profile)`
- `EvolveDashboard.tsx` — countdown + Pomodoro + XP bar + tutor-pose Brilli
- Wire into Pulse view (Pulse gets a new "Today's Evolve load" card)
- Sidebar nav adds "Evolve" view
- Tests for prompt injection + state mutations

**Lands:** users see the Pulse Dashboard, can set a target goal, Evolve is visible.

### Sprint B — Liquid Rhythm Planner (2 weeks)
- `services/evolve/recalibrate.ts` — the `recalibrateMomentum()` algorithm
- `LiquidRhythmPlanner.tsx` — daily 3 micro-tasks UI + recalibrate button
- `framer-motion` micro-interactions on task completion
- Wire into Rhythm view + Evolve "Today" tab
- Tests for recalibration math (no missed-day cascade)

**Lands:** users get daily 3 micro-tasks, miss days without shame, recalibrate.

### Sprint C — Infinite Assessment Engine (3 weeks)
- `api/evolve/generate-questions.ts` — nightly cron: Gemini Deep Research → GPT-5.5 → JSON questions
- `services/evolve/question-pipeline.ts` — orchestration
- `InfiniteAssessmentEngine.tsx` — engine entry + Pomodoro
- `QuizCard.tsx` — single-question UI + Why/Why Not accordion
- Wire into Evolve "Practice" tab
- Tests: question generation pipeline, JSON schema enforcement, accordion UI

**Lands:** the heart of Evolve — quiz with Why/Why Not Matrix, citation-backed.

### Sprint D — Context Translator (1.5 weeks)
- `services/evolve/translator.ts` — Claude 4.7 Opus routing
- `ContextTranslator.tsx` — two-pane UI + streaming inline visual
- "Save to Memory" persists `ContextTranslation` items
- Wire into Evolve "Translate" tab + as inline mini-app inside Chat
- Tests: routing, streaming, memory persistence

### Sprint E — Deep Verification Studio (1.5 weeks)
- `services/evolve/verifier.ts` — Gemini Deep Research + GPT-5.5 Pro routing
- `PeerReviewStudio.tsx` — minimalist input + VERIFIED/CORRECTED brief
- "Save to Library" auto-saves `VerifiedBrief` items
- Wire into Evolve "Verify" tab + button inside Notebook
- Tests: verification flow, citation extraction, badge logic

### Sprint F — Skills/Sources/Reflections/SOPs Storage Layer (2 weeks)
- `services/evolve/collections.ts` — Collection<T> instances for the 4 stores
- `EvolveSkillsConstellation.tsx` — skills-map view (per `13-evolve-preview.html`)
- `EvolveLibraryFeed.tsx` — sources living-document
- Notebook integration: reflections auto-save and link to skills
- SOP board for brand mode
- Tests: CRUD, cross-link, sync v5 envelope

### Sprint G — Veo + Cross-surface polish (2 weeks)
- `services/evolve/veo-trigger.ts` — detect 3+ failures + invoke Veo 3.1
- `api/evolve/trigger-veo.ts` — server-side Veo call + storage
- History (Time Ribbon) integration: skill level-ups + reflections appear as markers
- Identity integration: skill focus per brand feeds into brand prompts
- Brilli "tutor pose" wiring
- Tests: trigger threshold, video persistence, cross-surface markers

**Total: ~14 weeks.** Ships across v33.5 (Sprints A, B) and v34 (Sprints C-G), per master roadmap.

---

## 10. Multi-model orchestration (the routing layer)

Evolve is the most demanding consumer of `services/agents`. Explicit model assignments:

| Job | Model | Why |
|---|---|---|
| Nightly content scrape (latest sources) | Gemini 3.1 Pro Deep Research | Best at live web research with citations |
| Question generation from research | GPT-5.5 Thinking | Best at structured JSON + complex reasoning under strict schemas |
| Inline visual + comparison matrix | Claude 4.7 Opus | Best at nuanced explanation + native Inline Visuals (Mini App rendering) |
| Peer-review verification | Gemini Deep Research + GPT-5.5 Pro | Two-model verification reduces hallucination risk |
| Spatial concept video | Veo 3.1 | Only model that generates short educational video |
| System prompt assembly | (no model — local) | `generateEvolveSystemPrompt()` runs client-side |

The routing logic lives in `services/agents` (extracted in v33.5 Sprint 2) — Evolve calls it via typed methods (`agents.askGemini(...)`, `agents.askGPT5(...)`, `agents.askClaude(...)`, `agents.requestVeo(...)`).

---

## 11. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Multi-model costs spiral | High | Per-user daily cap on Deep Research calls. Batch question generation overnight (1 batch = 30+ questions). Cache aggressively. |
| Veo generation latency (10s+ wait) | Medium | Trigger asynchronously; pre-generate next-most-likely-failure videos overnight. Surface "video ready" toast when complete. |
| Question quality drift | High | Daily eval cron compares generated questions to a hold-out gold-standard set. Alert on drop in quality. |
| Anti-ADHD claims overpromise | Medium | The recalibrate algorithm is a real feature, not therapy. Document it as a UX pattern, not a medical claim. |
| Schema migrations across model upgrades | Medium | Question/translation/brief schemas versioned per `sync-v5` migrations. Lazy migration on read. |
| User adds an inappropriate target goal | Low-medium | A simple safety filter on `targetGoal` field rejects illegal/unsafe content. |
| Deep Research cites a paywalled source | Medium | Always include a fallback open-source citation. UI labels paywalled vs open. |
| Translator outputs a wrong mapping | High | "Save to Memory" requires explicit user click. Bad mappings can be unsaved. Brilliance never auto-saves a mapping. |
| Veo video offensive or wrong | Medium | Server-side moderation pass before save to Library. Reject with retry on failure. |
| Cross-surface coupling breaks if Pulse layout changes | Medium | All Pulse integration goes through a typed `services/pulse.addCard()` API. Pulse owns its layout. |

---

## 12. Success criteria (when is Evolve "shipped")

| Criterion | Definition |
|---|---|
| Daily active engagement | 50%+ of paying users with an EvolveProfile complete at least one quiz daily |
| Recalibrate usage | <30% of EvolveProfile users hit "Recalibrate Momentum" — meaning the daily load is durable |
| Why/Why Not retention | Users who use Why/Why Not Matrix score 25%+ higher on follow-up retention prompts vs. correct-only feedback |
| Citation trust | Users click through to citations on 30%+ of correct answers (signal: trust in the system) |
| Translator save rate | 60%+ of Translator queries result in "Save to Memory" |
| Veo trigger correctness | 90%+ of Veo-triggered videos correctly visualize the failed concept (manual review on first 100) |
| Cross-surface lift | Users with Evolve active also see Pulse goal completion lift by 10%+ (signal: Evolve drives Pulse engagement) |
| Multi-model cost per user/month | <$3/user/month for typical use (1-2 sessions/day, ~30 questions, <5 verifications) |
| Performance | Pulse Dashboard renders in <500ms. Quiz card → next question transition <300ms. |
| Zero data loss | Sync v5 envelope ensures all skills/sources/reflections/SOPs/translations/briefs survive multi-device. |

---

## 13. The Framework — at a glance

```
                    EVOLVE
                       │
              ┌────────┴────────┐
              │   FOUNDATION    │
              │  Memory as ID   │  ← Reads RoweOS Memory profile
              │   + Translator  │  ← Maps known to unknown via system prompt injection
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
   │ Pillar 1│    │ Pillar 2│    │ Pillar 3│
   │  Pulse  │    │ Liquid  │    │ Quiz    │
   │Dashboard│    │ Rhythm  │    │Engine + │
   │         │    │ Planner │    │Why/WhyNot│
   └─────────┘    └─────────┘    └─────────┘
                                       │
                       ┌──────────────┴──────────────┐
                       │                             │
                  ┌────▼────┐                  ┌────▼────┐
                  │ Pillar 4│                  │ Pillar 5│
                  │ Context │                  │  Deep   │
                  │Translator│                 │ Verify  │
                  │         │                  │ Studio  │
                  └─────────┘                  └─────────┘
                       │                             │
                       └──────────────┬──────────────┘
                                      │
                              ┌───────▼───────┐
                              │   BONUS       │
                              │ Veo 3.1 video │
                              │ for spatial   │
                              │ concepts      │
                              └───────────────┘

                STORAGE LAYER (typed Collections):
        Skills · Sources · Reflections · SOPs · Translations · Briefs · Veos

              CROSS-SURFACE WIRING:
          Memory · Pulse · Rhythm · Notebook · Library
        History · Brilli · Agents · Automations · Smart Routing
```

---

## 14. Deferred (out of scope for v33.5/v34)

- Team learning (multi-user shared skills, group leaderboards) — v34+ requires multi-user foundation
- Public skill profiles — never (privacy first)
- Live human tutoring marketplace — never (not Brilliance's brand)
- Certification issuance — never (we don't grant credentials)
- Audio-only mode (driving-friendly) — v35+
- Spaced-repetition import from Anki/Quizlet — v35+, low priority
- Native mobile apps — v36+

---

## 15. The Edge-Case Test (always run this against any change)

Before any Evolve PR ships, ask:
1. Does it work for the IBHRE-CCDS Biotronik FCS user with severe ADHD? (the stress test)
2. Does it also work for the graphic designer learning React? (the everyday user)
3. Does it work without manual setup beyond `targetGoal + deadlineDate + cognitiveProfile`?
4. Does it respect calm cadence — no shame, no overdue, no "you're behind"?
5. Does it cite sources at every claim?

If any answer is no, the PR is not ready.

---

## 16. Final word

Evolve is the part of Brilliance that proves the platform's thesis. *Generic intelligence produces generic outcomes.* But Evolve takes Memory + Smart Routing + Pulse + Rhythm + Library and produces a learning system that knows you, paces with you, doesn't shame you, and cites its work.

It's the most ambitious feature in the v33.x cycle and the clearest demonstration of why "operating intelligence" is not a tagline — it's an architecture.

Ship it well, and Evolve becomes the reason a new customer chooses Brilliance over any AI tool that exists today. Not because the AI is smarter. Because the *system* is.
