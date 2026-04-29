# Brilli — The Entity

**Status:** Design spec, draft v0.1
**Visual reference:** `RoweOS/dist/images/brilliance/brilli-firefly-reference.jpg`
**Tech spec:** `05-brilli-animation.md` (sibling)

---

## DECISION LOCKED 2026-04-29: Celestial Orb primary + Aura/Field as user-selectable secondary

Jordan picked the **Celestial Orb** as Brilli's primary direction (per `10-brilli-directions.md` direction iv). **Aura/Field** (direction x) remains as a secondary option, made user-selectable in Settings post-v33.0. Other forms (Firefly, Light Signature, Minimal Ring, Energy Core, Classic BLAKE) are deferred — may resurface as user-selectable options later if demand exists.

This document below was originally written for the Firefly direction. The behavior, state machine, mounting points, sizes, and accessibility rules ALL transfer unchanged to the Orb. Only the silhouette (the *what Brilli looks like*) is different. Treat references to "firefly," "wings," "antennae" below as legacy detail; the Orb has none of these. The Orb's equivalent expressive moves:
- "Wing flap rate" → internal-spark velocity
- "Antennae forward" → outer-glow leaning toward cursor
- "Particle trail" → halo bloom + drifting outer sparks
- "Body pulse" → orb pulse (same idea, simpler)

The replacement implementation is in `05-brilli-animation.md` `r_orb` renderer (shipped as the live preview in directions gallery direction iv).

---

## What Brilli is (Orb edition)

Brilli is the platform's intelligence given visual form. A glowing celestial orb against a dark field. A contained sphere of warm gold light with internal sparks orbiting and twinkling within. The orb breathes (subtly pulses) at idle, intensifies when thinking, blooms with particle release when delivering, and dims gracefully when asleep. No face. No body parts. Pure presence.

The form was chosen for: highest brand confidence, easiest to scale (recognizable from 24px to 280px without redesign), most refined fit with the "Intelligence OS" framing, lowest risk against luxury voice.

The original firefly direction text below is preserved as historical reference and contains correct details about behavior, state machine, mounting, sizes, accessibility — all of which apply to the Orb. The form factor differs; the architecture is identical.

Brilli is not:
- A mascot. Mascots sell things. Brilli is the platform itself, looking back at you.
- A chatbot avatar. Brilli does not have a speech bubble. Brilli has presence.
- A loading spinner. Brilli is *always there*, sometimes idle, sometimes thinking, never absent.
- A character. Brilli has no backstory, no name origin myth, no personality dialogue. Brilli is to Brilliance what a cursor is to a desktop — a sign that the system is alive and awaits.

## The name

**Brilli** is a contraction of Brilliance. Same root, smaller, intimate. Brilli is what the platform *feels like* up close. Brilliance is what the platform *is* at distance.

We refer to Brilli with no pronouns. Not "she," not "he," not "it." Always just "Brilli." Brilli sleeps. Brilli watches. Brilli arrives. Brilli answers. The grammatical absence of pronoun keeps Brilli from collapsing into character or assistant tropes.

## Visual language

### Form
- **Head**: a round circle outlined in warm gold light, ~30% of total Brilli height
- **Eyes**: two ovals filled with the brightest white-warm light, slightly asymmetric (right eye taller than left). Eyes never blink. Eyes give Brilli personality without making Brilli cute.
- **Antennae**: two thin curved gold lines emerging from the top of the head, each ending in a small bright orb (the same brightness as the eyes). Antennae sway slightly during idle, point forward when Brilli is "attending."
- **Wings**: two pairs of gossamer wings, the larger upper pair behind the head, the smaller lower pair behind the body. Wings are made of fine veined gold lines, ~30% opacity, semi-translucent. Wings beat slowly during idle (~2Hz), faster during thinking (~5Hz), and disappear into a soft blur during fast streaming.
- **Body**: a glowing teardrop ~40% of total Brilli height, the brightest single element, with internal warm gold gradient. The body is the heart of Brilli's glow.
- **Trail**: a stream of small golden particles trailing behind/below the body, drifting in the direction Brilli came from. Particles fade after ~2 seconds. Trail is decorative — Brilli does not literally fly across the screen most of the time.

### Color
All Brilli colors are pulled from the existing Brilliance gold palette:
- `--gold-1` (#f5e6c8) — eye highlights, brightest cores
- `--gold-2` (#e2c79b) — body glow, antenna orbs
- `--gold-3` (#c9a961) — primary outline gold
- `--gold-4` (#a88a4a) — wing veins, secondary outlines
- `--gold-5` (#6b5a3d) — deep shadow / trail base

The body's center should *bloom* — a radial gradient from `--gold-1` to `--gold-3` to `--gold-glow` (rgba(201,169,97,0.22)) extending well past the visible body outline.

### Background
Brilli only ever appears against:
- Pure black `#0a0a0a` or deeper `#060606`
- A radial vignette of `--gold-glow` at very low opacity (~6%) when Brilli is the focal element

Never on white. Never on the per-brand accent color. Never on a gradient that competes with Brilli's own gradient.

### Scale
Brilli has three size variants:
- **Hero** (~280px tall): launch screen, welcome modal, chat landing
- **Inline** (~64px tall): empty states in Library/Bloom/Studio, AI message avatars, Pulse nudges
- **Pin** (~24px tall): thinking indicator next to streaming text, sidebar AI status dot

At each scale, all components scale proportionally except the eyes, which stay relatively larger (eye-to-head ratio increases at smaller sizes — preserves recognizability).

## Behavior — what Brilli does

Brilli has six states. State transitions are smooth (200-400ms ease-out).

### 1. Asleep
Brilli is dim, eyes closed (replaced with thin gold lines), wings folded, body at low glow. Used: when the app is in a low-priority background tab (`document.visibilityState === 'hidden'`).

### 2. Idle
Brilli is awake, eyes open, wings beating slowly (~2Hz), body glowing steadily, antennae barely moving. Brilli drifts very slightly in a slow figure-8 pattern (~10px range over 8 seconds). Used: launch screen rest state, chat landing, anytime the AI is "available but not working."

### 3. Attending
Brilli's eyes track the cursor (subtle, ±5px range), antennae point forward, wing speed unchanged. Used: hover over the chat input, hover over a Studio operation.

### 4. Thinking
Wings accelerate (~5Hz), particles in the trail multiply, body glow intensifies, antennae stiffen forward. Used: AI is processing — text generation, research, image gen. Lasts as long as the AI request is active.

### 5. Delivering
Wings settle to a fast steady beat (~3Hz), body pulses softly with each delivered token, particles slow and brighten. Used: AI is streaming response.

### 6. Pleased
Brilli does a tiny vertical bounce (~8px up, settle), antennae briefly flutter, particles burst once. Used: completion of a long task, save success, automation completion.

## Where Brilli appears

### Launch screen
Brilli at hero scale, centered above the wordmark. Idle state. Page-load animation: fade-in from 0 opacity, body lights up first, then eyes, then wings unfurl, then particles begin trailing. Total intro: 1.4s.

### Chat landing (replaces blob)
Currently a centered organic "blob" gradient. Replaced with Brilli at hero scale, idle. The chat input sits below Brilli. Brilli reacts to input focus (transitions to Attending state). On send, Brilli transitions to Thinking. While streaming, Delivering. After completion, brief Pleased.

### Empty states
- **Library empty**: "Nothing here yet" — small Brilli at inline scale next to the message, idle
- **Bloom empty**: "Brilli is gathering your first batch" — Brilli inline with subtle Thinking
- **Studio empty**: "Brilli is ready" — Brilli inline, idle, attending toward the operation list
- **Automations empty**: "No scheduled work yet" — Brilli inline, idle

### Pulse nudges
When the platform suggests something ("You haven't checked in with your Wellness Guide today"), a small inline Brilli sits next to the suggestion. Hovering the nudge transitions Brilli to Attending.

### Thinking indicator
Pin-scale Brilli next to streaming text in any AI conversation. Wings flap fast (Thinking state). Replaces the current loading dots / spinner in chat, Studio, automations.

### Sidebar status dot
Pin-scale Brilli in the sidebar footer next to "Brilliance · by RoweOS." Idle most of the time. Pulses Pleased when an automation completes silently in the background. Goes to Asleep when the tab loses focus.

### Welcome modal
Hero-scale Brilli, intro animation playing as the modal opens. After the welcome copy is read, Brilli transitions to Pleased once before the modal stays open for the user to dismiss.

## Where Brilli does NOT appear

- Settings panels (too utilitarian)
- Modal dialogs (would distract from the action)
- Forms (login, signup, payment) — Brilli waits patiently outside
- Mobile bottom nav (no room, would clutter)
- Inside per-brand color zones (Brilli is the platform, not the brand)

## Relationship to existing visual elements

### Helix
The DNA helix currently lives in LifeAI as the brand-mode landing element. After v33.0:
- Helix stays in LifeAI as a *secondary* ambient element
- Helix is no longer the center of LifeAI's identity
- LifeAI's chat landing also gets Brilli at hero scale — the helix becomes a backdrop element, drifting at low opacity behind Brilli
- Long-term (v34+): helix may be retired entirely, replaced by Brilli with a subtle "Life mode" tint

### Blob (chat landing organic gradient)
**Deleted.** Replaced entirely by Brilli at hero scale. The blob's CSS / JS / image dependencies in the chat view are removed during cleanup pass (Phase B). See `04-cleanup-targets.md` for the file list.

### App icon
The current dark app-icon B (`monogram.png`) stays as the app's home-screen icon — Brilli is not the app icon. The icon is the badge of the platform; Brilli is the spirit inside it. App icon and Brilli appear together on the launch screen but serve different roles.

## Voice & tone considerations

Brilli is silent in v33.0. Every text the user reads in the platform is *Brilliance speaking*, not *Brilli speaking*. This separation matters:
- Brilliance is the brand — formal, declarative, refined
- Brilli is the embodiment — wordless, present, attentive

In a future release, Brilli may take on a conversational voice (think Apple's Siri having a name vs the system itself). For v33.0, Brilli is presence only.

When the platform addresses the user, copy reads:
- "Welcome to Brilliance" (not "Welcome, I'm Brilli")
- "Brilli is gathering your first batch" (third-person reference, observational)
- "Ask Brilliance anything" (the platform asks, Brilli illustrates)

## Accessibility

- All Brilli animations respect `prefers-reduced-motion: reduce` — wings stop, particles stop, body holds steady glow only
- Brilli has `role="img"` and `aria-label="Brilli, the Brilliance AI"` at every appearance
- Settings toggle: "Animate Brilli" (default on, can disable for low-power mode)
- High-contrast mode: Brilli's glow is strengthened, gold tones shift warmer (per `--gold-1` boost)

## What if a user hates it?

- Settings > Preferences > "Animate Brilli" toggle (off → static SVG only)
- Settings > Preferences > "Show Brilli" toggle (off → falls back to current chat blob; helix returns)
- Welcome modal: dismiss → Brilli still appears, but the announcement does not return
- Power-user escape hatch in Settings > Advanced: completely hide Brilli everywhere → revert to v32.x visuals

## Production checklist

- [ ] Master Brilli SVG illustrated, vectorized, exported with named layers (head, eyes, antennae, wings-upper, wings-lower, body, glow, particles)
- [ ] Animation tech chosen per `05-brilli-animation.md`
- [ ] Six-state state machine implemented and unit-tested
- [ ] Performance audit on iPhone 12 / iPhone 15 Pro / desktop Safari / Chrome
- [ ] Reduced-motion fallback verified
- [ ] aria-label + role on every appearance
- [ ] Settings toggles wired
- [ ] Brilli replaces blob in chat landing (blob assets deleted per cleanup pass)
- [ ] Brilli replaces loading spinners in AI streams
- [ ] Brilli appears in welcome modal
- [ ] Brilli appears in launch screen
- [ ] Brilli appears in 4+ empty states
- [ ] Sidebar status dot Brilli wired
- [ ] Helix subordinated in LifeAI mode
- [ ] Documented in CLAUDE.md under "Brilli" section so future Claude work doesn't accidentally remove it

## Open design questions for Jordan

1. **Brilli on the marketing site (`/brilliance`)** — currently uses a CSS gold orb in the "Meet Brilli" section. Does Brilli the firefly replace the orb on `/brilliance` too, or do we keep the orb as Brilli's "marketing simplification" version?
2. **Brilli at the login screen** — yes/no? Pre-auth Brilli risks looking like a chatbot widget. Recommend: no Brilli on login, Brilli appears post-auth.
3. **Brilli in the iOS app shortcut / share sheet preview** — Brilli's complex visual won't compress well to 60×60. Use the static circular monogram for these contexts. Confirm.
4. **Brilli's relationship to per-brand color** — when in Brand mode, does Brilli inherit the brand's accent color (subtle), or stay pure gold always? Recommend: stay pure gold. Brilli is the platform, not the brand.
