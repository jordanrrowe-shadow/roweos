# /info Overhaul Plan

**Status:** Plan, draft v0.1
**Current state:** `RoweOS/dist/info.html`, ~1796 lines, has a "Now Brilliance · meet the rebrand" pill linking to /brilliance (added v32.1)
**Target:** /info becomes the primary feature site for Brilliance (deeper, more product-focused than /brilliance), /brilliance stays as the brand statement page

---

## The two-page strategy

After v33.0:

| Page | Role | Audience | Length |
|---|---|---|---|
| `/brilliance` | Brand statement. Manifesto. Identity. | First-time visitors, press, partners | Short, atmospheric, ~7 sections |
| `/info` | Feature deep-dive. Capability tour. Sales material. | Considering visitors, potential customers, existing users learning more | Long, dense, ~12 sections |
| `/portfolio` | Executive summary, capabilities matrix, partner-facing | Investors, partners, enterprise prospects | Long, formal |
| `/purchase` | Pricing + checkout | Buyers | Single page |

`/brilliance` is the door. `/info` is the rooms inside. `/portfolio` is the architectural blueprint. `/purchase` is the front desk.

## What /info needs

### Currently good
- The "Backed by Google" section is solid (v31.1)
- The Helix and Blob promo screenshots are real product evidence
- The pricing tier comparison (BrandAI vs LifeAI vs both) reads clearly
- The platform feature carousel works (desktop + mobile tabs)

### Currently broken or stale
- "RoweOS" all over the body copy (~30 occurrences) - rename per `03-in-app-rename.md` Phase D8
- References to "Beta" and "Free Month" (per memory `MEMORY.md` line 49) - should be "14-day free trial" or rename to "Founder access"
- The hero is a giant base64-inlined image - bloated and hard to update
- The "Now Brilliance" pill is a transitional element - remove at Phase 2 of launch when /info itself is fully Brilliance-coherent
- Typography drift - currently Cormorant Garamond, should be Old Standard TT to match `/brilliance` and therowecollection.com

### Currently missing
- A "Meet Brilli" moment - /info should reference Brilli the entity (since Brilli is the platform's face)
- A clearer section about the Intelligence OS positioning (vs "AI assistant" or "agent platform")
- Cross-mode intelligence story (Brand AI knows about LifeAI tax, etc.) — currently buried
- Voice/tone consistency with /brilliance — /info reads more like marketing copy, /brilliance reads like a manifesto

## The overhaul plan

### Option 1: Surgical update (recommended for v33.0)
Keep info.html as the file. Do the rename pass, swap fonts to Old Standard TT, add a "Meet Brilli" section, refresh hero image to use the new wordmark. Remove the "Now Brilliance" pill since /info is now coherent.

**Effort:** ~4 hours
**Risk:** Low (additive changes)
**Result:** /info reads as Brilliance's deep-dive page. Familiar structure for existing visitors.

### Option 2: Full rebuild matching /brilliance design language
Rewrite info.html from scratch using the .b-* namespace and design tokens from /brilliance. Same Old Standard TT + DM Sans + gold gradient + chapter labels. Becomes a longer-form sibling to /brilliance.

**Effort:** ~12 hours
**Risk:** Medium (could lose sections we need)
**Result:** /info and /brilliance share visual identity completely. But /info loses some of its current features (tier comparison cards, screenshot carousel) that have utility.

### Option 3: Migrate to a Next.js subroute (long-term)
Move /info into a Next.js project (parallel to therowecollection.com), gain componentization, integrate analytics. Probably out of scope for v33.0.

**Effort:** ~30+ hours
**Risk:** High (introduces a new tech stack, separate deploy)
**Result:** Modernized infrastructure. Slower to iterate marketing copy without engineering time.

**Recommend Option 1 for v33.0.** Move to Option 2 in v33.x if Option 1 reveals visible drift between /info and /brilliance that hurts coherence.

## Section-by-section update plan (Option 1)

### Section 1 — Hero
- Replace base64 inline hero image with `<img src="/images/brilliance/wordmark-os.png">` (or transparent variant)
- Update headline copy: "Brilliance" instead of "RoweOS" in hero h1
- Subhead: "The intelligence platform for brands and life. By RoweOS."
- Eyebrow remains "The Rowe Collection, LLC"
- Remove "Now Brilliance · meet the rebrand" pill (no longer needed; /info IS Brilliance)
- CTAs: "Begin" (primary) + "Read the Story" (links to /brilliance)

### Section 2 — Backed by Google (existing, keep)
- Update body copy to say "Brilliance" instead of "RoweOS"
- Keep the pill + Google for Startups badge
- Keep the "Backed by serious cloud" line

### Section 3 — What is Brilliance? (currently "What is RoweOS?")
- Rename heading
- Update body copy
- Two-column BrandAI / LifeAI feature explainers (already exist, just rename)
- Tags inside columns ("Identity", "Studio", etc.) stay - they're feature names

### Section 4 — Meet Brilli (NEW)
- Insert between "What is Brilliance" and "Platform preview"
- Brilli at hero scale (canvas Brilli per `05-brilli-animation.md`, with static SVG fallback)
- Headline: "Meet Brilli."
- Body: "The intelligence behind the platform. Brilli is what you see when Brilliance is thinking, present, ready."
- One image of Brilli (the firefly reference image, or a refined version)

### Section 5 — Platform preview (existing carousel, keep)
- Refresh screenshots to current product UI
- Update captions to mention Brilliance
- Remove or refresh any screenshots that show "RoweOS" in the chrome (the rebrand pass will fix this automatically once Phase D1-D5 ships)

### Section 6 — How it works (existing, refine)
- Three-step explainer (Connect AI → Configure brand → Begin)
- Update copy to reference Brilli ("Brilli learns your brand, your voice, your rhythm")

### Section 7 — Pricing (existing, keep)
- Update tier names to use "Brilliance" prefix where appropriate (e.g., "Brilliance Founder" instead of "Founder")
- Or keep tier names tier-only ("Founder", "Basic", "Premium") since they sit under the Brilliance brand
- Update "$5 RoweOS-supplied pack" → "$5 Brilliance-supplied pack"

### Section 8 — RoweOS AI / Smart Routing (existing)
- Rename to "Brilliance AI / Smart Routing"
- Update body
- Keep the architecture diagram

### Section 9 — Founder testimonials (existing)
- Update testimonials that name "RoweOS" → "Brilliance"
- (Note: these are placeholder testimonials per current state. Replace with real quotes when available.)

### Section 10 — Cross-mode intelligence (NEW or REFINED)
- New section emphasizing "your Tax Copilot sees brand revenue" / "your Life Coach knows your ventures"
- This is the most under-told story currently
- Visual: a simple line connecting BrandAI to LifeAI through a "shared memory" core

### Section 11 — Closing CTA
- "Begin" + "View Pricing"
- New footer reads "Brilliance · by RoweOS · The Rowe Collection · Austin, Texas"

## Removal during overhaul

- Remove the "Now Brilliance · meet the rebrand" pill (Phase 2 launch task)
- Remove any references to "Beta" — replaced with "Founder access" or "early access"
- Remove "Free Month" — replaced with "14-day free trial" (or whatever the current actual trial period is)
- Remove the `info.OLD.backup.html` file from `RoweOS/dist/` (covered in `04-cleanup-targets.md`)

## Typography unification

Current `/info`:
- Serif: Cormorant Garamond
- Sans: DM Sans

Target `/info`:
- Serif: Old Standard TT (matches `/brilliance` and therowecollection.com)
- Sans: DM Sans (no change)

CSS update:
```css
/* Replace */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:...');
/* With */
@import url('https://fonts.googleapis.com/css2?family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');

/* Replace */
:root { --serif: 'Cormorant Garamond', serif; }
/* With */
:root { --serif: 'Old Standard TT', Georgia, serif; }
```

Find any `font-weight: 300` on serif elements and change to 400 (Old Standard TT only ships 400/700, same as `/brilliance`).

## Color tokens unification

Currently `/info` uses its own gold palette. Migrate to share the same `--gold-1` through `--gold-5` tokens used in `/brilliance`. This way a future design tweak to gold propagates to both pages.

Approach: extract gold tokens to a tiny shared CSS file `RoweOS/dist/styles/brilliance-tokens.css` and `<link>` it from both `/brilliance` and `/info`. Or just keep them inline-duplicated for now; v33.0 isn't the right moment to introduce new build steps.

## Routing changes

Currently in `RoweOS/dist/vercel.json`:
- `/info` → `/info.html`
- `/brilliance` → `/brilliance.html`

After v33.0 launch (Phase 2):
- Keep both routes as-is initially
- Update OG previews on /info to use Brilliance branding
- Eventually (Phase 3, post-launch): consider redirecting `/info` → `/brilliance/platform` or similar to consolidate, but only if /brilliance grows a "platform deep-dive" subsection

## Cross-page linking

After overhaul:
- `/brilliance` (manifesto) → "See the full platform" link → `/info`
- `/info` (deep-dive) → "Read the brand story" link → `/brilliance`
- Both → "View Pricing" → `/purchase`
- Both → "Begin" → `/` (login / app)
- Both → footer → `/portfolio` (for capabilities matrix)

Make the cross-links consistent in label and placement.

## Verification checklist

- [ ] Every visible "RoweOS" string in info.html replaced
- [ ] "Now Brilliance" pill removed
- [ ] Old Standard TT loaded and applied to all serif headlines
- [ ] Hero uses new wordmark image (not base64 inline)
- [ ] Meet Brilli section added with image + copy
- [ ] Cross-mode intelligence section added or refined
- [ ] Tier names updated to use "Brilliance" prefix consistently
- [ ] Stripe pricing IDs / checkout URLs unchanged (text only)
- [ ] All screenshots refreshed to v33.0 product (or at least current UI)
- [ ] Footer reads "Brilliance · by RoweOS"
- [ ] OG meta updated for Brilliance branding
- [ ] PWA / mobile rendering tested
- [ ] Backed by Google section preserved and updated
- [ ] All CTAs link correctly (Begin, Pricing, Read the Story)
- [ ] No em-dashes in body copy (Jordan's preference)
- [ ] No one-sided borders for accents (Jordan's preference)

## Sequence vs other v33.0 phases

Per `00-v33-master-plan.md`, /info overhaul lives in Phase F (week 4), after the in-app rename (Phase D), Brilli production (Phase C), welcome modal (Phase E). Reasoning: external visitors should land on a coherent Brilliance world only after the in-product experience is also coherent.

## Open questions for Jordan

1. **Does the existing screenshot carousel need re-shoots?** Current images show "RoweOS" in the UI chrome. They'll be visually outdated the moment Phase D1 ships (in-app rename). Plan: re-shoot during Phase F, after Phase D is complete.
2. **Tier names**: keep "Founder / Basic / Premium" or rename to "Brilliance Founder / Brilliance Basic / Brilliance Premium"? Recommend keeping tier names short.
3. **The base64 hero image** is enormous (~150KB). Worth replacing even if v33.0 doesn't redesign /info? Recommend yes - swap for a `<img>` reference to `/images/brilliance/wordmark-os.png` during Phase F.
4. **Do we want analytics** on /info to measure rebrand impact? If so, instrument before launch (Vercel Analytics is free, one-line add).
