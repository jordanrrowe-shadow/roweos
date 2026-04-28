# Brilli Directions — Decision Doc

**Status:** Decision support, draft v0.1
**Live gallery:** `/brilliance-mockups/09-brilli-directions.html`
**Sibling docs:** `01-brilli-entity.md` (locks the chosen direction's behavior), `05-brilli-animation.md` (the tech)

---

## How to use this doc

Open the gallery first. Click each tile. Read the modal's voice/complexity/risk notes. Come back here for the synthesis.

Brilli's form is **implementation-flexible** in v33.0. The Canvas 2D module shape, state machine (idle/attending/thinking/delivering/pleased/asleep), size variants (hero/inline/pin), and surface mounts (chat landing, launch screen, welcome modal, empty states, sidebar status, thinking indicator) ALL stay the same regardless of which silhouette is chosen. The choice below is purely about **what Brilli looks like**.

## The 13 directions

Grouped by family.

### Family 1: Cute (3)
- **i. Star Brilli** — smiley five-point star
- **ii. Hybrid Brilli** — star with wings + trail
- **iii. Firefly Brilli** — current direction, refined insect with eyes

### Family 2: Refined (5)
- **iv. Celestial Orb** — contained sphere with internal sparks
- **v. Monogram as Entity** — animated B letter
- **xi. Minimal Ring** — rotating jewelry-like ring
- **xii. Energy Core** — core with orbital rings

### Family 3: Geometric (1)
- **vi. Geometric Forms** — rotating wireframe polyhedron

### Family 4: Abstract (4)
- **vii. Light Signature** — pure flowing trails
- **viii. Constellation** — connected dot network
- **ix. Prism Refraction** — pyramid + spectrum
- **x. Aura / Field** — bright ring with shimmer field
- **xiii. Abstract Companion** — faceless figure of light

## Decision criteria (in order of weight)

### 1. Voice fit (most important)
Brilliance's positioning: **"Operating intelligence for ambitious brands and the people who build them."** The voice is sovereign, refined, intentional. It is not playful. It is not childish. It is not new-age.

| Direction | Voice fit | Notes |
|---|---|---|
| i. Star | ⚠️ Low | Risks reading childish for "Intelligence OS." |
| ii. Hybrid | ⚠️ Medium-low | Bridge but still cute. |
| iii. Firefly | ✓ High | Mystical without being a mascot. Personality without childish. |
| iv. Orb | ✓ High | Quiet, premium, anticipatory. Easiest to take seriously. |
| v. Monogram | ✓ High | Brand-forward. The platform IS the wordmark. |
| vi. Geometric | ⚠️ Medium | Cold for chat hero. Better for /portfolio. |
| vii. Trail | ✓ High | Cinematic. Elusive. |
| viii. Constellation | ✓ High | Pluralistic. Matches multi-model story. |
| ix. Prism | ✓ Medium-high | Conceptual. Limited. |
| x. Aura | ✓ Medium | Atmospheric. Maybe too quiet. |
| xi. Ring | ✓ Medium | Risks reading as loading spinner. |
| xii. Energy Core | ✓ High | Powerful. "There is a system here." |
| xiii. Companion | ✓ High | Intimate, dignified. |

### 2. Expressive range (state machine support)
Brilli has 6 states (idle, attending, thinking, delivering, pleased, asleep). Some directions can show all 6. Others are limited.

| Direction | Idle | Attending | Thinking | Delivering | Pleased | Asleep |
|---|---|---|---|---|---|---|
| i. Star | ✓ | ✓ (eyes track) | ✓ (faster bob) | ✓ (eyes blink) | ✓ (smile bigger) | ✓ (eyes close) |
| ii. Hybrid | ✓ | ✓ | ✓ (wings fast) | ✓ | ✓ | ✓ |
| iii. Firefly | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| iv. Orb | ✓ | ⚠️ (subtle) | ✓ (sparks faster) | ✓ (pulse) | ✓ (flash) | ✓ (dim) |
| v. Monogram | ✓ (shimmer) | ⚠️ (limited) | ⚠️ (faster shimmer) | ⚠️ | ⚠️ (flash) | ✓ (still) |
| vi. Geometric | ✓ | ⚠️ | ✓ (rotation faster) | ⚠️ | ⚠️ | ✓ |
| vii. Trail | ✓ | ⚠️ (curve shifts) | ✓ (tighter curves) | ⚠️ | ⚠️ | ✓ (linear) |
| viii. Constellation | ✓ | ⚠️ | ✓ (more travel pulses) | ⚠️ | ✓ (full network flash) | ✓ |
| ix. Prism | ⚠️ (mostly static) | ⚠️ | ⚠️ (spectrum shifts) | ⚠️ | ⚠️ | ⚠️ |
| x. Aura | ✓ | ⚠️ | ✓ (faster shimmer) | ⚠️ | ⚠️ (flash) | ✓ (dim) |
| xi. Ring | ⚠️ (rotation could read as loading) | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✓ |
| xii. Energy Core | ✓ | ✓ | ✓ (orbits accelerate) | ✓ | ✓ (burst) | ✓ |
| xiii. Companion | ✓ | ⚠️ (head tilt only) | ⚠️ (subtle) | ⚠️ | ⚠️ (pulse) | ✓ (sit lower) |

**Top expressive range:** Star, Hybrid, Firefly, Energy Core. These can do all 6 states clearly.

### 3. Scale-down resilience (does it work at pin scale?)

Pin scale = 24px next to streaming text. The silhouette must remain identifiable at that size or the user can't tell the AI is thinking.

| Direction | At 24px |
|---|---|
| i. Star | ✓ Star shape recognizable |
| ii. Hybrid | ⚠️ Wings disappear, becomes star |
| iii. Firefly | ⚠️ Wings + body conflate, becomes blob |
| iv. Orb | ✓ Glowing dot, perfectly fine |
| v. Monogram | ✓ Tiny B, brand-tied |
| vi. Geometric | ✗ Wireframe becomes incomprehensible |
| vii. Trail | ⚠️ Becomes streak |
| viii. Constellation | ✗ Network disappears |
| ix. Prism | ✗ Triangle becomes confusing |
| x. Aura | ✓ Small ring, works |
| xi. Ring | ✓ Small ring, works |
| xii. Energy Core | ⚠️ Orbits disappear, core remains |
| xiii. Companion | ⚠️ Figure becomes blob |

**Best scale-down:** Star, Orb, Monogram, Aura, Ring.

### 4. Differentiation in the AI brand landscape

| Competitor | Brilli direction it MOST resembles | Risk |
|---|---|---|
| Apple Siri Glow (iOS 18+) | Aura, Orb | Iconic; we'd be derivative |
| Google Gemini sparkle | (none direct) | safe |
| ChatGPT pulsing dot | Aura | low - dot is too generic |
| Anthropic Claude asterisk | (none direct) | safe |
| Notion AI sparkle | Star (loosely) | medium |
| Cluely / Linear | (no animated mark) | n/a |

**Most differentiated:** Firefly, Hybrid, Constellation, Companion, Geometric. These don't share territory with major AI brand marks.

### 5. Implementation effort

| Direction | Build time | Risk |
|---|---|---|
| i. Star | 1 day | Static SVG works; canvas optional |
| ii. Hybrid | 2 days | Wings + star + trail |
| iii. Firefly | already prototyped | Tuning only |
| iv. Orb | 1 day | Internal particles + clip |
| v. Monogram | 0.5 days | Mostly typography + shimmer |
| vi. Geometric | 2 days | 3D math + rotation |
| vii. Trail | 1 day | Procedural curves |
| viii. Constellation | 2 days | Graph layout + edge travel |
| ix. Prism | 0.5 days | Static + few lines |
| x. Aura | 1 day | Ring + shimmer |
| xi. Ring | 0.5 days | Simple ellipse |
| xii. Energy Core | 1.5 days | Orbital math + particles |
| xiii. Companion | 1 day | Bezier silhouette |

## Recommendation matrix

If you want **maximum brand confidence and minimum risk**:
- **iv. Celestial Orb** OR **v. Monogram as Entity**
- Both are recognizable, refined, easy to scale, easy to take seriously
- Trade-off: less personality. Brilli becomes a presence, not a being.

If you want **personality + uniqueness + magic**:
- **iii. Firefly Brilli** (current direction)
- Already prototyped. Highest expressive range. Most differentiated from Siri/Gemini.
- Trade-off: insect motif divides taste. Some find it magical, some find it strange.

If you want **the most distinctive in the AI category**:
- **viii. Constellation System**
- No major competitor uses this. Matches the "multi-model routing" pillar visually.
- Trade-off: doesn't scale to pin size. Heavier compute.

If you want **the most refined and "intelligent feeling"**:
- **xii. Energy Core** OR **xiii. Abstract Companion**
- Both communicate "there is something here, paying attention"
- Trade-off: more abstract; harder to convey emotion in 6-state machine

If you want **brand-forward and content-supreme**:
- **v. Monogram as Entity**
- The B IS Brilli. Maximum brand recall. Cleanest fit with the wordmark.
- Trade-off: limited expressive range. Thinking and idle look similar.

## My pick if forced to choose one

**Hybrid recommendation: ship with iv. Celestial Orb as the primary form, with iii. Firefly as the "personality variant" that appears in chat landing only.**

- Orb at launch screen, welcome modal, empty states, sidebar status, thinking indicator → confident, refined, takes the platform seriously
- Firefly at chat hero only → adds magic to the conversational moment without diluting the platform's authority elsewhere

This is unconventional. Most brands ship one entity. But Brilliance is unusual: it's a platform AND a presence. The Orb represents the platform; the Firefly represents the conversational presence. They are both Brilli. Same gold palette. Same particle trail vocabulary. Same wing-flap analog (the orb has internal sparks accelerating; the firefly has wings).

If unwilling to ship two: **default to iv. Celestial Orb.** It is the lowest-risk, highest-fit, easiest-to-execute direction.

If unwilling to take that recommendation: **stay with iii. Firefly.** It's already prototyped, has the highest expressive range, and is the most differentiated.

## What you should NOT pick

- **i. Star** — too cute. Risks the brand.
- **ix. Prism** — too static. One visual idea repeated.
- **xi. Ring** — risks reading as loading spinner. Confusion is bad.
- **vi. Geometric** — too cold for the conversational surfaces. Could live in /portfolio diagrams instead.

## Decision deadline

Before Phase C of v33.0 begins (Brilli production). Until that decision, the Canvas module is implementation-flexible — but every day of indecision delays Phase C.

If no decision in 7 days, default to current direction (iii. Firefly).

## Open questions for Jordan

1. **Cute family viable at all?** If Star/Hybrid resonate, the brand voice may need to soften slightly. v33.0 is a big enough rebrand to absorb a softer voice.
2. **Multi-form approach (Orb + Firefly)** — would you ship two Brilli forms or pick one?
3. **Brilli on the marketing site (`/brilliance`)** — if pick is different from in-product, we need to also update /brilliance. Recommend keeping in-product and marketing identical.
4. **Static-mark version** — for favicon, OG image, email templates, app icon. Whichever direction you pick needs a static SVG export. Some directions (Trail, Aura, Constellation) are inherently animated; their static version needs careful design.
5. **Naming**: stays "Brilli" regardless of form? Recommend yes.
