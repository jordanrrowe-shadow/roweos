# Chat Interface Concepts

**Status:** Brainstorm doc, draft v0.1
**Sibling:** `01-brilli-entity.md`, `10-brilli-directions.md`
**Live gallery:** `/brilliance-mockups/10-chat-concepts.html` (CSS-only sketches, no canvas loops)

---

## Two layers of decision

The chat experience has two design layers, and they're often confused for one. Naming them clearly:

1. **The presence** — what represents the AI as a being. Brilli, the orb, the firefly, BLAKE classic, etc. This is small, persistent, expressive of state.
2. **The surface** — what represents the conversation as a structure. Bubbles, document, cards, canvas, etc. This is large, persistent, the actual work environment.

Today's RoweOS is "centered presence (BLAKE) + bubble surface." Most AI products are. v33.0 lets us reconsider both — independently.

---

## Part 1: Selectable presence (the runners-up + BLAKE)

### Plan
Settings > Preferences > "Brilliance presence" lets the user pick from 7 forms, all rendering the same Brilli state machine (idle/attending/thinking/delivering/pleased/asleep) with the same module shape. The silhouette is what changes.

| # | Form | Source |
|---|---|---|
| 1 | **Classic BLAKE** | Current visual (preserved as default for existing users) |
| 2 | **Celestial Orb** | Direction iv |
| 3 | **Firefly** (with editable wings) | Direction iii — the wing parameters become user-tunable: count (1 pair / 2 pairs), spread, vein density, flap rate baseline |
| 4 | **Light Signature** | Direction vii |
| 5 | **Aura / Field** | Direction x |
| 6 | **Minimal Ring** | Direction xi |
| 7 | **Energy Core** | Direction xii |

### Why letting users pick is the right call
- Brilliance's voice is "yours, completely." Letting the user decide what their AI looks like is on-brand.
- Different operators have different aesthetic preferences — a multi-brand founder may want refined Orb; a creative may want Firefly.
- Reduces the risk of any one direction being wrong for the whole audience.

### Why letting users pick is risky
- Brand recall fragments — every user sees a different Brilli on their screen.
- Marketing assets (`/brilliance`, OG cards, app icon) still need ONE chosen direction. The marketing Brilli is fixed; only the in-product Brilli is selectable.
- More forms = more code = more bugs.

### Recommendation
Yes to selectable, BUT:
- Marketing (`/brilliance`, OG, app icon, email templates) uses ONE form: the **Celestial Orb** (highest brand confidence, easiest to scale, most recognizable across surfaces).
- In-product, the user can choose any of the 7 (default = Classic BLAKE for existing users, default = Celestial Orb for new users).
- Setting saved to localStorage (`roweos_brilli_form`) and synced to Firestore (`profile/brilli_form`).
- A "tour" in Settings lets the user preview each form animated before committing.

### Wing-editor for Firefly (specific to that form)
A small Settings sub-panel exposes:
- **Wings**: 1 pair / 2 pairs / no wings (just particle trail)
- **Vein density**: slider 1-7 (default 5)
- **Flap rate**: slow / normal / fast / off
- **Trail particles**: minimal / standard / dense

These are sliders that mutate the canvas state at runtime. No re-render needed.

---

## Part 2: Chat surface concepts

Twelve concepts. Each is a different *answer to "what does a brand-and-life conversation actually look like."* Grouped by family.

### Family A — Conversation as Document

#### A1. Living Document (lab notebook)
The chat is a single, growing document. Your input becomes an italic sub-heading. Brilliance's response becomes prose underneath. Old Standard TT throughout. Pages turn as the conversation grows.

**Voice:** Refined, scholarly, sustained.
**Pros:** Reads like *thinking*, not chatting. Excellent for long-form work. Naturally archival.
**Cons:** Loses the immediacy of bubbles. Feels slower (which can be a feature).
**Brilli's role:** A small marginalia mark next to the active paragraph; pulses while AI writes.

#### A2. Letter Series (parchment correspondence)
Each exchange is a "letter." Cream-toned background, Old Standard TT body, gold initial caps on each response. Like reading a 19th-century correspondence between a thinker and their advisor.

**Voice:** Slow, intimate, formal-but-warm.
**Pros:** Maximum luxury. The wordmark and font shine.
**Cons:** Very slow. Wrong for quick-task workflows.
**Brilli's role:** A wax-seal animation that lights up when AI completes a letter.

#### A3. Magazine Column (typeset live)
The conversation is laid out in a multi-column magazine layout. AI responses flow as body text with pull quotes, sidebars, and illustrated callouts. As the conversation grows, the layout reflows like a publication being designed in real-time.

**Voice:** Editorial, considered, designed.
**Pros:** Highest visual sophistication. Differentiates Brilliance dramatically from every other AI product.
**Cons:** Hard to engineer well. Fights the "I just need an answer" use case.
**Brilli's role:** Brilli is the editor — appears in the gutter between columns, "approving" each block.

#### A4. Margin Notes / Talmudic
Your message sits in the center column. Brilliance's response wraps around it as marginalia. If multiple agents weigh in (Strategy + Marketing + Operations on the same question), each gets its own column — like Talmudic commentary.

**Voice:** Plural, deep, scholarly.
**Pros:** Visualizes the multi-agent architecture honestly. Operators see *which* agent contributed *what*.
**Cons:** Dense. Not for casual users.
**Brilli's role:** Brilli is the principal voice; the others are agents named.

### Family B — Conversation as Space

#### B1. Spatial Constellation (zoomable canvas)
Messages float in 2D space. Recent ones cluster near center; older ones drift outward. Topics naturally form constellations. You zoom in and out to navigate. Search = navigating the space.

**Voice:** Cosmic, exploratory, alive.
**Pros:** Most visually striking. Matches the "intelligence has shape" identity. Long conversations become beautiful artifacts.
**Cons:** Hard to scan linearly. Some users will hate it.
**Brilli's role:** Brilli moves between message clusters, drawing the user's attention to the active one.

#### B2. Branching Pinboard (cards on a wall)
Each message is a card you can pin, drag, branch from, fork. Conversation becomes a research pinboard. Branches connect with thin gold strings.

**Voice:** Investigative, exploratory, collaborative.
**Pros:** Makes branching conversations actually usable. Great for research / deep work.
**Cons:** Workflow-heavy; users have to organize.
**Brilli's role:** Brilli sits at the active card's edge, ready to expand it.

#### B3. Time Ribbon (horizontal scrubbing timeline)
The whole conversation is a horizontal ribbon. Each message is a chapter mark. You scrub to revisit any moment. The "now" is at the right edge. Editing past messages branches the timeline.

**Voice:** Cinematic, navigable, history-aware.
**Pros:** Conversations have a clear shape. Easy to revisit and branch from.
**Cons:** Unfamiliar metaphor. Steep first-time learning curve.
**Brilli's role:** Brilli walks the ribbon as you scrub.

### Family C — Conversation as Theater

#### C1. Concierge Desk (hotel front-desk metaphor)
You arrive. Brilliance "checks you in" with what's relevant today (Pulse summary, brand status, recent automations). You make a request; Brilliance handles it like a concierge — sometimes responding directly, sometimes "calling the right specialist" (revealing which agent took the work).

**Voice:** Service-oriented, refined, anticipatory.
**Pros:** Most on-brand for "luxury intelligence." Naturally weaves brand context into the conversation.
**Cons:** Heavy on initial-state design.
**Brilli's role:** Brilli IS the concierge presence. Always behind the desk. Bows when greeting.

#### C2. Studio at Work (artist's studio metaphor)
The chat lives inside a studio. Easel in center. Tools on the side (Studio operations, automations). Work-in-progress visible. Brilliance is the studio's spirit — Brilli the studio cat that watches from a beam.

**Voice:** Creative, peaceful, hands-on.
**Pros:** Makes the platform feel like a physical workspace. Excellent for creative operators.
**Cons:** May feel over-themed for analytical / business workflows.
**Brilli's role:** Ambient observer. Reacts to the work being done.

### Family D — Conversation as Workspace (utility-forward)

#### D1. Split-Pane Workspace
Left pane: chat. Right pane: live artifacts being created (Studio output streaming, generated images, edited documents). Drag the divider. Brilli sits in the divider gutter, indicating where attention is flowing.

**Voice:** Productive, professional, dual-purpose.
**Pros:** Most pragmatic. Solves the "chat + work output" problem cleanly.
**Cons:** Feels like an IDE more than a brand experience.
**Brilli's role:** Indicator only — small, persistent, in the gutter.

#### D2. Dashboard Chat (context-aware shell)
Chat is embedded in a dashboard. Live brand context cards visible: today's Pulse, current Bloom batch, Studio recent runs. Conversation IS the command — talking to Brilliance updates the cards in real-time.

**Voice:** Operational, integrated, leverage-forward.
**Pros:** Best for operators who want everything visible at once. Most utility per square inch.
**Cons:** Visually busy. Loses the "intimate conversation" tone.
**Brilli's role:** Lives in the dashboard frame, "binding" the cards together.

### Family E — Conversation as State (radical minimal)

#### E1. Negative Space (one line at a time)
Almost nothing on screen. A single message visible. Previous messages collapse to a tiny dot in the corner — tap to expand. Brilli is the only persistent visual element.

**Voice:** Focused, monastic, anti-noise.
**Pros:** Boldest. The most distinctive in the category. Forces presence.
**Cons:** Some users will find it too sparse to trust.
**Brilli's role:** Brilli is everything. The page is mostly Brilli, mostly empty.

---

## My top 3 to prototype

If you want the highest expected value from the smallest set:

### Pick 1: D2. Dashboard Chat (utility-forward)
The pragmatic choice. Likely the most-used. Visualizes Brilliance's "operating intelligence" framing literally — your brand and life are visible while you converse with the platform. Cards update live as the conversation progresses.

### Pick 2: A1. Living Document (luxury document)
The refined choice. The "premium thinker" experience. Old Standard TT shines. Slow, intentional, archival. Works hand-in-hand with the Brilliance voice.

### Pick 3: B1. Spatial Constellation (cosmic exploration)
The brand-defining choice. Most visually distinct. Long-term, the conversations become beautiful artifacts the user wants to revisit. High effort, but the highest ceiling.

If forced to ship just one: **D2 Dashboard Chat**. It earns its keep on Day 1.

If two: **D2 + A1**. Operators can choose pragmatic vs. refined per session.

If three: **D2 + A1 + B1**. The full menu — utility, refinement, exploration.

---

## Selectable surface? (parallel to selectable presence)

Just as the user picks Brilli's form, could the user pick the chat's surface? Theoretically yes. In practice:

- **More than 2 surfaces is too much variability.** Brand recall and support burden both increase.
- **Two surfaces max:** "Classic" (current bubbles) and "Brilliance" (whichever new direction is chosen).
- The chosen direction (D2, A1, or B1) becomes "Brilliance mode"; current bubbles stay as fallback.
- Setting saved to `roweos_chat_surface` (default: Brilliance for new users, Classic for existing).

Recommendation: **don't mention it on launch.** Just ship Brilliance mode as the new default. Existing users are migrated only when they opt in via Settings.

---

## What this is NOT

- Not a feature spec. None of these are designed in detail yet.
- Not a commitment. The current bubble surface ships in v33.0 if no decision is made.
- Not exhaustive. There are more directions (voice-first, AR, score, oracle deck, etc.) — see the brainstorm notes if interested.

---

## Open questions for Jordan

1. **Selectable Brilli (7 forms)**: yes, but ship in v33.x post-launch (not v33.0). Confirm.
2. **Selectable surface** (Classic vs Brilliance mode): also v33.x. Confirm.
3. **Top-3 surface picks** (D2 + A1 + B1) — agree, or replace one with a different family?
4. **Wing editor for Firefly** — ship as part of v33.0 Firefly, or defer to v33.x with the selectable-Brilli feature?
5. **Marketing Brilli** — single form (Celestial Orb recommended). Confirm or pick another for the marketing-only surface.
