# Welcome to Brilliance — First-Launch Experience

**Status:** Spec, draft v0.1
**Triggers:** First launch after v33.0 deploy, per user, once only
**Mockup:** `RoweOS/dist/brilliance-mockups/02-welcome-modal.html`

---

## The moment

A user who has been on RoweOS for a year opens the app the morning v33.0 ships. The app loads, the launch screen shows the new Brilliance monogram, and then before the dashboard renders, a single full-screen modal fades in.

The modal is not a feature tour. It is not a "what's new" changelog. It is one moment of brand transition — *the platform you knew is now Brilliance, and Brilli is here*. After 12-18 seconds of reading, the user clicks **Continue** and lands in the same dashboard they always use, with all their brands, automations, conversations, and data exactly where they left them.

That is the entire experience. It is intentionally small.

## Goals

1. **Acknowledge the rename** — make it clear, calm, not a gimmick. The user should not be surprised in 3 days when they notice "RoweOS" missing from the sidebar.
2. **Introduce Brilli** — Brilli's first appearance for existing users. Brilli should feel like *meeting* the platform, not seeing a marketing animation.
3. **Reassure continuity** — every feature, every automation, every brand, every saved conversation is still there. Nothing is lost.
4. **One CTA only** — Continue. No upsell, no settings, no link out, no signup, no email collection.
5. **Never appear again** — once dismissed, the modal is over. There's no re-entry from a menu.

## The structure

### Section 1 — Brilli arrives (visual only, ~2.5s)
- Full-screen black background
- Brilli at hero scale fades in from below, settles centered upper-third of viewport
- Brilli plays the intro animation: body lights up first, eyes open, antennae rise, wings unfurl, particles begin trailing
- Subtle ambient glow pulse from Brilli's body (gold)

### Section 2 — The wordmark resolves (~1.5s)
- Below Brilli, the Brilliance wordmark fades in: "Brilliance / INTELLIGENCE OS"
- Below the wordmark, in DM Sans tracked-out small caps: "by RoweOS"
- A 1px gold rule animates from 0 width to ~120px below the lockup

### Section 3 — The welcome message (~staying as long as the user reads it)
- Body copy in Old Standard TT, ~24px serif, italic accents on key words
- Three short paragraphs maximum
- Left-aligned, max-width 540px, centered horizontally

**Copy v1 (draft for review):**

> Welcome to *Brilliance*.
>
> The platform you have been using is the same platform. Same brands, same automations, same memory, same work. We have given it a name that fits.
>
> Brilli is the *intelligence* you will see throughout. The platform thinks, you decide. Everything you have built is exactly where you left it.

### Section 4 — The CTA (~at the bottom of the visual stack)
- One primary button: **Continue**
- Below the button, a single quiet line: "Brilliance, by RoweOS - The Rowe Collection"
- Optional escape: ESC key dismisses
- Click-outside dismisses

## Visual treatment

- Full-screen modal, `position: fixed; inset: 0`
- Background: `#0a0a0a` with a very subtle radial gold glow (`var(--gold-glow)` at 6% from center-top)
- Brilli centered upper-third
- Wordmark + body copy stacked below, all centered horizontally
- Generous whitespace — this is a brand moment, not an information page
- Continue button: `var(--b-cta-primary)` style (gold gradient, dark text), 16px 38px padding, ~48px from the bottom
- Footer attribution micro-copy in `var(--b-text-dim)`

## Motion

- Modal fade-in: 600ms ease-out
- Brilli intro: per `01-brilli-entity.md` (1.4s sequence)
- Wordmark / rule / copy: staggered fade-up (each 600ms, delay 200ms apart)
- Continue button: subtle pulse glow loop (2s cycle) starting 4s after modal opens, to draw the eye after the user has had time to read
- Dismiss animation: 400ms fade-out + 8px translateY down

## Behavior

### Trigger logic
```javascript
// pseudocode - implementation in src/js/core/22-firebase-sync.js or similar
function shouldShowWelcomeModal() {
  if (localStorage.getItem('roweos_brilliance_welcomed_v33') === 'true') return false;
  if (!firebaseUser) return false; // logged-in users only
  if (isAdmin()) return true; // always show for admin in dev to verify
  return true;
}

function markWelcomed() {
  localStorage.setItem('roweos_brilliance_welcomed_v33', 'true');
  // sync to Firestore so it persists across devices
  writeDB('profile/welcomed_v33', { value: true, _modifiedAt: Date.now() });
}
```

### Storage key
- localStorage: `roweos_brilliance_welcomed_v33` (note the version suffix — future welcome modals get their own key)
- Firestore: `users/{uid}/profile/welcomed_v33` document
- Sync: write-through pattern per existing sync architecture

### Edge cases
- **User on multiple devices**: welcome shows once per user (Firestore-backed flag), not once per device
- **User clears localStorage**: cloud flag prevents re-show on next sync
- **User never had RoweOS account before**: new signups skip welcome (their first experience IS Brilliance, no transition needed). Gate: only show welcome if `firebaseUser.metadata.creationTime` is before the v33.0 deploy timestamp
- **PWA cold start**: welcome shows after auth resolves AND after sync pulls cloud data. Not before (we'd risk showing welcome to a user who is being denied access).
- **Network failure during cloud flag write**: fall back to localStorage only; cloud sync retries on next online state
- **User dismisses then reopens app same session**: modal does NOT reappear (flag is set on dismiss, not on close-without-action)

### Failure modes
- If modal JS errors, the modal must fail-safe: hide itself, log the error, set the welcomed flag anyway. Better to skip the moment than block the user from the app.
- If Brilli's render fails, fall back to a static SVG of Brilli (the SVG fallback per `05-brilli-animation.md`)
- If wordmark image fails to load, fall back to text-only "Brilliance" in Old Standard TT

## Accessibility

- `role="dialog" aria-modal="true" aria-labelledby="welcome-heading"`
- The serif welcome copy is wrapped in an `<h1 id="welcome-heading">` for screen readers (visually it reads as a paragraph; semantically it's the modal's heading)
- Focus traps inside the modal until dismissed
- `prefers-reduced-motion`: skip Brilli intro animation, skip the staggered fade-up, just snap-show all content. The modal still appears.
- Continue button is keyboard-focusable on open (auto-focused after 1s so it doesn't fight the brand moment)
- Brilli has `role="img"` and `aria-label="Brilli, the Brilliance AI"`

## Mobile considerations

- Full-screen on mobile (no margins)
- Brilli at ~200px (smaller than desktop hero scale)
- Wordmark scales down to ~280px max
- Body copy scales to 18px
- Continue button widens to ~80% viewport width, max 320px
- Safe-area insets respected (button doesn't sit on the home indicator)

## Copy variants for A/B testing (if Jordan wants)

### Variant A (current draft, declarative-warm)
> Welcome to *Brilliance*.
>
> The platform you have been using is the same platform. Same brands, same automations, same memory, same work. We have given it a name that fits.
>
> Brilli is the *intelligence* you will see throughout. The platform thinks, you decide. Everything you have built is exactly where you left it.

### Variant B (more confident, less reassurance)
> Welcome to *Brilliance*.
>
> Same platform. Same memory. Same work. New name.
>
> Meet Brilli, the intelligence behind the platform. Everything is where you left it.

### Variant C (more poetic)
> Welcome to *Brilliance*.
>
> What you built has a name now. What you built has a *face* now. Brilli is the platform you have been talking to all along.
>
> Nothing has moved. Everything has settled.

**Recommendation: ship Variant A.** It does the most reassurance work for the existing 10 paying clients. Variant B is too terse for a brand-transition moment. Variant C is beautiful but slightly mystifying for users who just want to get into their work.

---

## DECISION LOCKED 2026-04-29: Variant B (confident-terse)

Jordan picked Variant B. Reasoning: Brilliance's voice is sovereign and intentional, not reassuring. The user does not need to be coddled through the rebrand; the brand should land with confidence. Variant B reads like a product that knows what it is.

Final copy locked:

> Welcome to *Brilliance*.
>
> Same platform. Same memory. Same work. New name.
>
> Meet Brilli, the intelligence behind the platform. Everything is where you left it.

The welcome modal mockup at `/brilliance-mockups/02-welcome-modal.html` defaults to Variant B. Variant A and C remain as toggleable options in the mockup for reference.

## Post-launch behavior (after Continue)

- Modal dismissal animates out
- User lands on whatever view they were last on (no forced redirect)
- The sidebar footer now reads "Brilliance · by RoweOS"
- The `<title>` tag reads "Brilliance"
- All other rebrand changes are in effect
- An optional one-time toast can fire 30s later: "Brilli is here. Look for the firefly." with a dismiss × — but this is optional polish for v33.x, not v33.0

## What this is NOT

- Not a tour
- Not a feature reveal
- Not a settings prompt
- Not a payment prompt
- Not an email capture
- Not a feedback request
- Not animated for animation's sake
- Not a marketing splash

## Production checklist

- [ ] Brilli SVG + Canvas renderer ready (depends on `05-brilli-animation.md`)
- [ ] Wordmark asset finalized (`/images/brilliance/wordmark-os.png` or transparent variant)
- [ ] Modal HTML/CSS built (target: standalone partial in `src/html/shared/`)
- [ ] JS trigger logic wired into auth-state-resolved callback
- [ ] localStorage + Firestore flag write-through verified
- [ ] Reduced-motion variant tested
- [ ] Mobile sizes tested on real iPhone
- [ ] ESC + click-outside dismiss tested
- [ ] Auto-focus timing verified (4s glow pulse on button, 1s focus)
- [ ] Cloud flag persistence tested across devices (sign in on second device after dismissing on first → no welcome)
- [ ] Welcome flag respected on PWA cold start
- [ ] Failure paths tested (offline, JS error, image fail)
- [ ] Copy approved (Variant A unless Jordan picks otherwise)

## Open questions for Jordan

1. **Copy variant**: A, B, or C? My pick: A.
2. **Show welcome to users who signed up *during* v33.0 launch week?** They never knew RoweOS-the-name. Recommend skipping for them — their first experience IS Brilliance.
3. **Welcome on mobile PWA install?** Same flag, same logic — modal shows on first launch after install. Yes/no?
4. **Optional: include a tiny "What changed" link inside the modal?** Recommend NO. The welcome should not become a tour.
5. **Optional: collect one-question feedback inside the modal?** Recommend NO. Welcome is not the moment to ask anything.
