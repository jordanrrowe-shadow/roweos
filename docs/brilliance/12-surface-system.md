# Brilliance Surface System

**Status:** Architecture, draft v0.1
**Source:** Conversation 2026-04-28 — concepts mapped to surfaces
**Sibling:** `11-chat-interface-concepts.md` (concept catalog), `01-brilli-entity.md` (the presence)

---

## The insight

Most platforms have one chat surface. Brilliance is not most platforms. Each *mode of thinking* deserves its own surface, and the chat-concept catalog already gives us the answers — we just have to assign each concept to the surface where its strength fits.

The result is a system: **one platform, multiple surfaces, each tuned to a specific intellectual posture.** A user opens a Notebook and feels different than they do at the Concierge Desk than they do on the Thought Board. That's the point. The surface tells you what kind of thinking the platform is ready for.

This is the Brilliance answer to "AI everywhere." Not one chatbot bolted into every view — distinct surfaces, each with its own grammar.

## The mapping

| Concept (catalog #) | Becomes (surface) | Role | Status |
|---|---|---|---|
| **Concierge Desk** (C1) | **Chat** (the home) | The platform greets you, summarizes status, takes the request | Replaces current chat landing |
| **Letter Series** (A2) | **Notebook** (Scribe rebranded) | Long-form writing, journaling, drafted correspondence | Repositions Scribe as Notebook |
| **Branching Pinboard** (B2) | **Thought Board** (NEW view) | Free-form research, multi-thread exploration, idea pinning | New surface, sits between Chat and Library |
| **Spatial Constellation** (B1) | **Thought Board** alternate view | Same data as Pinboard, viewed as 2D constellation | Toggle inside Thought Board |
| **Time Ribbon** (B3) | **History** (Memory view rebranded) | Scrubbing timeline of past questions and conversations | Replaces current History list |
| **Split-Pane Workspace** (D1) | **Studio** | Conversation + live artifact streaming side by side | Studio's new chrome |
| **Studio at Work** (C2) | **Folio** | Artifact in center, tools on the side, chat in the gutter | Folio's new chrome |
| **Negative Space** (E1) | **Focus Mode** (system-wide toggle) | Strip any active surface to just the active message + Brilli + input | Universal modifier, not a view |
| Living Document (A1) | (unassigned) | Could become an alternate **Notebook** mode for non-correspondence drafts | Optional |
| Magazine Column (A3) | (unassigned) | Could become an export/share format ("Publish this conversation as a magazine spread") | Optional |
| Margin Notes (A4) | (unassigned) | Could become how **multi-agent answers** display in any surface | Optional |
| Dashboard Chat (D2) | (already covered by Concierge + Pulse) | Cards live on Pulse; Concierge Desk in chat sees them | Don't double-implement |

## What each surface answers

| Surface | Question the user is asking |
|---|---|
| **Chat** (Concierge Desk) | "Help me with what's relevant today." |
| **Notebook** (Letter Series) | "I want to write something carefully." |
| **Thought Board** (Pinboard / Constellation) | "I want to explore an idea from many angles." |
| **History** (Time Ribbon) | "What did I ask, and when?" |
| **Studio** (Split-Pane) | "Make this thing while I watch." |
| **Folio** (Studio at Work) | "Help me create the artifact itself." |
| **Focus Mode** (Negative Space) | "Quiet everything else." |
| **Pulse** (current) | "What does my day / week / portfolio look like?" |
| **Identity** (current) | "Configure who I am to the platform." |
| **Library** (current) | "Where is my work archived?" |
| **Bloom** (current) | "Generate brand content at scale." |
| **Automations** (current) | "Schedule and orchestrate work." |
| **Mail** (current) | "Compose and send." |
| **Settings** (current) | "Configure the platform." |

Eight concept-driven surfaces, six classic surfaces. Each surface still uses Brilli (the chosen presence form) for AI state — just embedded differently.

## Surface-by-surface implementation notes

### Chat — Concierge Desk
The new chat landing.

**Layout:**
- Top: greeting line ("Welcome back. November is in motion.")
- Status grid (4 cards): Pulse / Active brand / Today / Standing
- Bottom: input pill, Brilli at left edge of pill

**Behavior:**
- On open, fetches Pulse summary, Bloom queue, Studio recent, today's calendar — populates status grid in <800ms
- Greeting line is generated each session by Brilliance based on what's active
- Status cards are tappable — tap "Pulse" jumps to Pulse view
- Conversation appears below the status grid as the user types; status grid collapses to a slim bar after first message
- Multi-agent responses use Margin Notes (A4) treatment if more than one agent contributed

**Replaces:** Current chat landing (centered blob/Brilli) for users who opt in.

**Risk:** Status grid query at startup adds latency. Mitigate by parallel queries + skeleton states.

### Notebook — Letter Series
Repurpose the existing Scribe view (post v29.3 overhaul) as Notebook. The metaphor: a long-form writing surface, where each AI exchange becomes a numbered letter or a marginalia annotation.

**Layout:**
- Center column (max-width 720px): the document being written
- Old Standard TT body, paper-cream background option (toggle), gold initial caps
- Right gutter: marginalia from Brilliance (suggestions, citations, agent notes)
- Bottom: input field for "ask Brilliance"

**Behavior:**
- Default appearance: dark theme. Toggle to "parchment" theme for the parchment-letter aesthetic
- AI suggestions appear in the right gutter; click to insert into the document
- Drafts saved per Notebook entry; History view tracks notebook revisions
- Wax-seal animation when AI completes a section

**Replaces:** Current Scribe chrome. Logic stays.

**Naming consideration:** Rebrand the view label from "Scribe" → "Notebook" in v33.0 surface rebrand pass (Phase D).

### Thought Board — Pinboard / Constellation
A new view. The corkboard for research and idea development.

**Two view modes** (toggle in top-right):
- **Pinboard** (B2): cards on a corkboard with thread connections, drag/pin/branch
- **Constellation** (B1): 2D zoomable canvas, messages as nodes, clusters by topic

**Why both?** They're the same data, different lenses. Pinboard is for active manipulation (drag cards, create branches). Constellation is for navigation (zoom out, see the whole conversation as a shape).

**Layout:**
- Full-bleed canvas
- Floating toolbar top-right: zoom controls, view mode toggle, "Add card" button
- Cards = saved snippets, AI responses, pinned messages from any other surface
- Bottom: input pill ("Ask Brilliance" or "+ Add card")

**Behavior:**
- Each card has metadata: source surface, timestamp, brand context
- Cards can be linked manually (drag a thread from one to another) or by Brilliance (Brilliance suggests links)
- Brilliance can be asked to "summarize this constellation" or "branch from this card"
- Constellation auto-clusters by topic (k-means on embeddings) every 5 messages

**Replaces:** Nothing. New view. Sidebar nav adds "Board" between Chat and Studio.

**Risk:** Adds a NEW view to the sidebar (memory says new view = 6 touch points per CLAUDE.md). Scope carefully.

### History — Time Ribbon
Replaces the current History/Memory view (data-view="tuning").

**Layout:**
- Top half: large rendering of the "current moment" (most recent conversation snippet, in serif italic)
- Bottom half: horizontal scrubbing ribbon with chapter markers
- Left/right of ribbon: time period labels (today, yesterday, last week, etc.)

**Behavior:**
- Drag the ribbon left/right to scrub through time
- Each marker is a conversation moment; tap to expand
- Search field above the ribbon filters markers by topic
- "Branch from here" button on any expanded marker creates a new Chat session starting from that moment
- Brilliance offers to "summarize this period" if you scrub to a long range

**Replaces:** Current History list view. Internal id (`data-view="tuning"`) stays.

**Risk:** Scrubbing UX is unfamiliar. First-time tooltip required.

### Studio — Split-Pane Workspace
Replaces the current Studio chrome.

**Layout:**
- Left pane (30-50% width, draggable divider): conversation
- Right pane: live artifact being created (Studio operation output, image generation, document edit)
- Divider: 22px gold orb (Brilli) showing where attention flows; also handles drag

**Behavior:**
- Each Studio operation (run, regenerate, pipe) shows live in right pane
- Conversation in left pane references the artifact ("Tighten the second line — too long")
- Drag divider to focus on chat or output
- Output pane has its own scroll; chat pane has its own scroll
- Brilli's gutter position shows which pane is "active" by leaning slightly toward it

**Replaces:** Current Studio panel layout. Operations themselves unchanged.

**Risk:** Existing Studio users have muscle memory for current panel. Provide a "classic mode" toggle in Settings > Preferences for first 90 days.

### Folio — Studio at Work
Replaces the current Folio chrome (which is currently the Folio Pipelines view).

**Layout:**
- Left rail (80px): tools (Studio operations, automation steps, library items)
- Center: easel — the artifact being created, displayed prominently
- Right pane (320px): conversation with Brilliance about this artifact

**Behavior:**
- The artifact in the center is THE thing — primary attention
- Tools on the left are dragged into the artifact (drag a Studio operation onto the easel to apply it)
- Chat on the right is contextualized to this artifact only ("How do I tighten this?")
- Folio's existing pipeline logic stays — visualization changes

**Replaces:** Current Folio chrome.

**Risk:** Existing Folio users have invested in the current pipeline visualization. Keep "classic Folio" mode toggle.

### Focus Mode — Negative Space (universal toggle)
Not a surface. A modifier.

**Trigger:**
- Keyboard: `Cmd+Shift+F` (or `Ctrl+Shift+F`)
- UI: a small "focus" icon in the top-right of any surface
- Settings: "Auto-focus on idle" — after 30s of no input, surface dims to focus mode

**Behavior:**
- Strips the active surface to: one message + Brilli + input
- Past messages collapse to a tiny gold dot in the corner; tap to expand
- Sidebar collapses to 0 width
- All ambient elements (status, secondary cards, output streams) hide
- Cmd+Shift+F again exits

**Replaces:** Nothing. Adds a universal modifier.

**Risk:** Users may trigger by accident. Tooltip on first use; preference to disable.

## Coherence rules (the system)

1. **Brilli is the same in every surface.** One presence, many surfaces. Whether you're on the Concierge Desk or the Thought Board, Brilli looks the same and behaves the same.
2. **Every surface respects the lockup.** "Brilliance · by RoweOS" stays in the topbar/footer/Settings.
3. **Old Standard TT for headlines, DM Sans for body** in every surface. No font drift.
4. **Gold palette is universal.** Per-brand accent colors override gold ONLY in brand-mode surfaces (Studio, Folio, Bloom, Pulse). Gold is the platform color.
5. **Each surface answers ONE question.** If you find yourself asking two questions on one surface, you're in the wrong surface — Brilliance should suggest moving you.
6. **Cross-surface deep links.** Pinning a message on the Thought Board from Chat keeps the link live. History scrubbing can jump to any past surface. The platform is unified by the *content*, not by a single chat surface.
7. **Brilliance always knows where you are.** The system prompt for Brilli always includes the current surface — so suggestions are surface-appropriate.

## Phased rollout

**Tier 1 — Ship in v33.0** (highest impact, lowest risk):
- Chat → Concierge Desk (replaces current landing)
- Focus Mode (universal toggle)
- History → Time Ribbon

**Tier 2 — Ship in v33.x post-launch** (moderate refactor):
- Studio → Split-Pane
- Folio → Studio at Work
- Notebook (Scribe rebranded) → Letter Series visual

**Tier 3 — v34** (new view, larger investment):
- Thought Board (NEW) with Pinboard / Constellation toggle

**Tier 4 — Polish** (optional, no commitment):
- Living Document (alternate Notebook mode)
- Magazine Column (export format)
- Margin Notes (multi-agent rendering)

## Migration strategy for existing users

Existing users wake up to a familiar app where:
- Chat looks slightly different (Concierge Desk replaces blob landing) but works the same
- History looks new (Time Ribbon) — show a "what changed" toast on first visit
- Studio and Folio retain "classic mode" toggles for 90 days
- Focus Mode is a new feature, not a change — surfaced in Settings, not forced

No data migrates. No localStorage keys change. No saved conversations are touched. The chrome changes; the substance stays.

## Naming considerations

| Internal name | User-facing name |
|---|---|
| `tuningView` (data-view="tuning") | History |
| Scribe | **Notebook** |
| (NEW data-view="board") | **Thought Board** |
| Folio | Folio (or rename to "Workshop" — TBD) |
| Studio | Studio |

Recommend renaming Scribe → Notebook in the surface rebrand. "Notebook" is clearer to new users; "Scribe" was an internal codename.

## What this is NOT

- Not a feature add. Each new surface uses existing data and operations. No new ML models, no new automations.
- Not a forced migration. Classic modes available for power users.
- Not v33.0 in full. Tiers 2-4 ship post-launch.
- Not exhaustive. Mail, Pulse, Identity, Bloom, Automations, Library, Settings keep their current chrome.

## Open questions for Jordan

1. **Tier 1 confirmed?** Chat → Concierge, Focus Mode, History → Time Ribbon for v33.0. Confirm.
2. **Thought Board** — new view in v34, OR build into Library as a "Board" tab in v33.x? Recommend new view in v34.
3. **Notebook rename** — Scribe → Notebook in v33.0 surface rebrand pass (cheap text change). Confirm.
4. **Folio rename** — keep "Folio" or rename to "Workshop"? Recommend keep Folio.
5. **Negative Space as Focus Mode** — keyboard trigger `Cmd+Shift+F` or different shortcut? Confirm.
6. **Multi-agent rendering** (Margin Notes treatment) — apply universally to any surface where multiple agents respond, or limit to Concierge Desk for v33.0? Recommend universal but small.
7. **Living Document and Magazine Column** — defer entirely, or are they hooks worth keeping in mind? Recommend defer with a note in this doc for v34+.
