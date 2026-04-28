# Mobile Design Spec — v33.0 Surfaces

**Status:** Spec, draft v0.1
**Sibling docs:** `01-brilli-entity.md`, `02-welcome-experience.md`, `05-brilli-animation.md`
**Mockups:** `06-mobile-preview.html` (hub), `07-mobile-launch.html`, `08-mobile-liquid-nav.html`

---

## Brainstorm summary (the thinking before the spec)

Mobile is where v33.0 most easily breaks. RoweOS already documents specific mobile gotchas in `CLAUDE.md` and memory:

- iOS Safari is the primary mobile target (PWA + browser). Chromium/Playwright cannot reproduce its layout bugs.
- `interactive-widget=resizes-content` viewport meta + box-sizing reflow hacks are required for the keyboard-close path.
- `min-height: -webkit-fill-available` on `<html>` is required (NOT `height` — height + overflow:hidden clips at safe-area).
- Liquid-nav (50px pill at bottom) replaces the sidebar on mobile.
- CSS `zoom` (Interface Zoom 75-150%) requires JS-managed pixel widths on fixed elements; vw/vh double-compensate.
- Safe-area-inset is non-trivial: bottom for liquid-nav clearance, top for status bar.
- Reduced-motion is more common on mobile (low-power mode).

The mobile experience must:
1. **Feel intentional, not shrunk** — every desktop surface needs a mobile reading, not just media queries
2. **Be cheap on battery** — Brilli animations cap to 30Hz on mobile, particles cap to 12, no `feGaussianBlur`
3. **Respect iOS quirks** — safe-area, viewport, zoom, keyboard, PWA install prompts
4. **Honor the existing nav** — sidebar doesn't exist on mobile; liquid-nav is the surface
5. **Welcome users on first launch correctly** — modal must work both web and PWA, must not block load

The risk vectors:
- Welcome modal blocks app entry on first PWA launch (pre-auth race condition)
- Brilli canvas drops frames or eats battery on iPhone 12-class devices
- New launch screen breaks the existing splash hand-off to auth state
- Liquid-nav rebrand collides with existing scroll-padding rules
- /info redesign feels foreign next to /brilliance because of typography drift

## The decisions (locked)

### Mobile-specific design tokens
Reuse the desktop tokens from `/brilliance` and `/info`. No mobile-only colors, fonts, or gradients. The brand stays unified.

| Token | Value | Mobile usage |
|---|---|---|
| `--gold-1` through `--gold-5` | unchanged | Same |
| `--b-serif` (Old Standard TT) | unchanged | h1-h4 only — no body text in serif on mobile (legibility) |
| `--b-sans` (DM Sans) | unchanged | Default everywhere |
| `--b-track-luxury` (0.25em) | unchanged | Eyebrows, chapter labels |

### Mobile-specific spacing
- Section padding: `clamp(56px, 12vw, 96px)` (vs desktop `clamp(80px, 12vw, 160px)`)
- Container max-width: 100% (vs desktop 1200px) with `padding: 0 22px`
- Card padding: 24px (vs desktop 40-48px)
- Hero font: floor 28px (vs desktop floor 36px)
- Manifesto font: floor 28px (vs desktop floor 32px)

### Brilli mobile rules
- Hero scale: 220px max (vs desktop 280-560px)
- Inline scale: 56px (vs desktop 64px)
- Pin scale: 22px (vs desktop 24px)
- Particle cap: 12 idle / 18 thinking (vs desktop 12/30)
- Wing flap rate: same Hz, but rendered at lower DPR (max 2)
- Pause RAF on `document.hidden` (no animation while backgrounded)
- Drop to static SVG fallback if frame budget exceeds 35ms for 5 consecutive frames

### Welcome modal mobile rules
- Full-bleed (no margins, no rounded corners)
- Brilli at 180px
- Wordmark at 38px
- Body copy at 17px (Old Standard TT, max-width 88vw)
- CTA expands to full width (max 320px), centered, with safe-area-inset-bottom padding
- Auto-dismiss on swipe-down gesture (optional, polish for v33.x)
- ESC dismiss works on iPad with keyboard
- Focus trap respects software keyboard

### Liquid-nav mobile rules (sidebar surrogate)
- The 50px liquid-nav pill at the bottom IS the mobile equivalent of the sidebar
- Brand identity ("Brilliance · by RoweOS") does NOT appear on liquid-nav (no room)
- Brilli status dot lives at the LEFT edge of liquid-nav (8px from edge, 6px diameter)
- Status dot pulses on automation completion (matching desktop sidebar)
- Settings > About is the canonical place for full lockup on mobile
- Liquid-nav background: rgba(8,8,8,0.92) backdrop-blur(28px), unchanged from current
- Active tab: gold underline (1px, var(--gold-3)), unchanged

### /info overhaul mobile rules
- Hero: stack vertically, wordmark image scales to 78vw max
- "What is Brilliance" two-column → single column at <760px (already done)
- "Cross-mode" pair: stack with arrow rotated 90deg
- Nav: collapse to hamburger (NEW for /info — currently links hide on mobile)
- Pricing tiers: horizontal scroll OR stack vertically with "compare" toggle
- Backed by Google card: padding reduces to 28px

### Mobile-specific surfaces NOT covered in desktop mockups
- **PWA install prompt** — current onboarding has install screens (`src/html/core/04-views-batch3.html` lines 589-663). These need rename pass per `03-in-app-rename.md` Phase D2 but no visual redesign.
- **Mobile keyboard with chat** — when keyboard opens, Brilli at chat hero shrinks to inline scale to make room for the input. Smooth transition.
- **Mobile pull-to-refresh** — disable on launch screen and welcome modal (`overscroll-behavior: contain`).

## Per-surface implementation notes

### 01 — Welcome modal (mobile)
- Trigger: same as desktop (first launch after v33.0, per-user, once)
- Implementation: full-screen modal with `inset: 0`, no border-radius, no drop-shadow on mobile
- Brilli intro animation: skip on iPhone 12 and below (perf), play on 13+
- Continue button: `width: min(80vw, 320px)`, sits 32px above safe-area-inset-bottom
- ESC dismiss: works (iPad keyboard, hardware keyboard)
- Tap-outside-to-dismiss: tap on backdrop (`.welcome-overlay` outside `.welcome-modal`) dismisses
- Swipe-down-to-dismiss: deferred to v33.x

### 02 — Launch screen (mobile)
- Brilli at 200px (hero scale, mobile-tuned)
- Wordmark at 56px (clamp from 36-72px)
- "Intelligence OS" subhead at 11px
- "by RoweOS" footer at 10px
- Loader pulse at bottom 32px above safe-area-inset-bottom
- Background drift animation runs at half speed on mobile (battery)
- Hand-off to auth state: launch screen fades in 600ms before user sees Brilli; persists until Firebase auth resolves; then fades out 400ms while welcome modal (if applicable) fades in

### 03 — Sidebar (mobile = liquid-nav)
There is no mobile sidebar. The liquid-nav pill is the mobile equivalent. Mobile mockup demonstrates:
- Liquid-nav with current 6 tabs (Chat, Pulse, Studio, Identity, Settings, More)
- Brilli status dot at the left, pulsing softly during idle
- "More" tab opens a sheet that includes Settings > About → "Brilliance · by RoweOS" lockup
- Top of screen: optional title bar reading "Brilliance" in serif (currently does not exist; consider for v33.x — not v33.0)

### 04 — /info (mobile)
- Hero centered, wordmark scales to 78vw max
- Two-col grids → single col
- Cross-mode pair: stack with arrow rotated 90deg, smaller card padding
- Nav: hamburger menu icon at right; tap opens fullscreen sheet with vertical link list
- Backed by Google card: padding 28px, pill smaller
- Footer: stack lockup vertically

### 05 — Brilli prototype (mobile)
- Stage and aside stack vertically (already responsive)
- Canvas scales to 320px max on mobile
- Mode buttons grid: 2 columns
- Size buttons grid: 1 column with full-width buttons
- Performance metrics: collapse "wing phase" / "DPR" to one line

## Verification checklist (mobile)

Pre-deploy testing on real devices:

| Test | iPhone 12 | iPhone 15 Pro | iPad | Android Chrome |
|---|---|---|---|---|
| Welcome modal on first launch | Pass | Pass | Pass | Pass |
| Welcome modal Continue dismisses cleanly | Pass | Pass | Pass | Pass |
| Welcome modal does not re-show after dismiss | Pass | Pass | Pass | Pass |
| Brilli renders at 60fps idle | Pass (target) | Pass (target) | Pass | Pass |
| Brilli renders at 30fps thinking | Pass (target) | Pass (60fps) | Pass | Pass |
| Brilli pauses on tab switch | Pass | Pass | Pass | Pass |
| Brilli respects prefers-reduced-motion | Pass | Pass | Pass | Pass |
| Launch screen fades to app cleanly | Pass | Pass | Pass | Pass |
| Launch screen does not bleed past safe-area | Pass | Pass | Pass | Pass |
| Liquid-nav status dot pulses on automation | Pass | Pass | Pass | Pass |
| /info hero scales correctly | Pass | Pass | Pass | Pass |
| /info hamburger menu works | Pass | Pass | Pass | Pass |
| /info Backed by Google pill renders | Pass | Pass | Pass | Pass |
| Old Standard TT loads on iOS Safari | Pass | Pass | Pass | Pass |
| No keyboard-close layout glitch (per CLAUDE.md hack) | Pass | Pass | n/a | Pass |
| Safe-area-inset respected (no content under home indicator) | Pass | Pass | Pass | n/a |

## Performance budget (mobile)

| Surface | Cold load TTFB | First paint | Brilli first frame | Idle CPU | Battery (idle 1hr) |
|---|---|---|---|---|---|
| Welcome modal | ≤ 800ms | ≤ 1200ms | ≤ 1500ms | < 5% | ≤ 0.5% |
| Launch screen | ≤ 600ms | ≤ 800ms | ≤ 1100ms | < 5% | ≤ 0.5% |
| Chat with Brilli | n/a | n/a | ≤ 200ms after view enter | < 8% | ≤ 1% |
| Sidebar pin Brilli | n/a | n/a | static SVG (no animation) | 0% | 0% |
| /info | ≤ 1200ms | ≤ 1800ms | n/a (no Brilli) | < 3% | ≤ 0.3% |

Targets are pessimistic. Failure to hit a target → Brilli falls back to static SVG mode for that surface.

## Implementation plan (mobile-specific work, on top of v33.0 master plan)

### Phase Cm — Brilli mobile tuning (post Phase C)
Sits inside Phase C of the master plan. After Brilli works on desktop:
1. Test on iPhone 12 and 15 Pro
2. Tune particle cap, wing rate, DPR cap based on real frame timings
3. Verify pause/resume on tab switch
4. Verify reduced-motion fallback path
5. Verify static SVG path renders correctly at all 3 sizes

### Phase Em — Welcome modal mobile (post Phase E)
Sits inside Phase E of the master plan. After welcome modal works on desktop:
1. Test full-bleed layout on iPhone 12 (smallest target)
2. Test safe-area-inset-bottom on iPhone 14+ (large bottom inset)
3. Verify ESC dismiss on iPad with keyboard
4. Verify tap-outside dismiss on touch
5. Verify modal does not block PWA install prompt

### Phase Fm — Mobile site overhaul
Sits inside Phase F of the master plan. After /info Option 1 ships on desktop:
1. Hamburger menu component for /info nav
2. Mobile-specific hero scaling
3. Cross-mode pair vertical stack
4. Pricing tier mobile rendering decision
5. Footer lockup mobile stack

### Phase Gm — Mobile launch verification
Sits in Phase G (launch). Pre-flight on real devices:
1. Full smoke test on iPhone 12, 15 Pro, iPad Pro
2. PWA install + first launch + welcome modal happy path
3. Add to Home Screen + reopen + welcome modal does NOT re-show
4. Tab switch / Brilli pause + resume
5. Low-power mode verification (Brilli falls back gracefully)

## Mobile-specific risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Welcome modal blocks PWA install prompt | High | Welcome modal trigger gated on `firebaseUser` resolved AND PWA install dismiss/accept event fired |
| Brilli canvas crashes Safari on low-power mode | High | `prefers-reduced-motion: reduce` triggers static SVG fallback; user can also toggle "Animate Brilli" off in Settings |
| Old Standard TT FOUT (flash of unstyled text) on slow connections | Medium | `<link rel="preload">` for the woff2; `font-display: swap` |
| Hamburger menu collides with existing /info top-of-page elements | Low | New element, scoped class names |
| Liquid-nav status dot crowds existing tabs | Medium | 8px from edge, only visible at >=375px viewport widths; smaller on iPhone SE-class devices |
| Safe-area-inset rules diverge between iOS 16 and 17+ | Low | Use both `env(safe-area-inset-bottom, 0px)` and `constant(safe-area-inset-bottom, 0px)` for fallback |
| Mobile keyboard breaks chat layout when Brilli is at hero scale | Medium | Brilli transitions to inline scale on input focus; preserves input-above-keyboard space |
| Pull-to-refresh on launch screen reloads the auth state mid-load | Medium | `overscroll-behavior: contain` on `<html>` for the duration of the launch screen |
| iOS box-sizing reflow hack regression | High | DO NOT remove the existing reflow hacks per CLAUDE.md. Welcome modal, Brilli mount, and /info changes must all preserve them. |

## What this spec does NOT cover

- Native iOS/Android apps (deferred to v34+)
- Apple Watch / wearable surfaces (no plans)
- Offline-first behavior (already covered in `src/js/core/23-offline.js`)
- Push notification UI (already covered in `28-reminders-notifications.js`, only string rename per Phase D4)

## Open questions for Jordan

1. **Brilli replacement direction**: if firefly direction changes, the canvas module's *silhouette* changes but the state machine + mounting + size variants stay. Worth knowing the new direction before Phase C kicks off.
2. **Hamburger menu scope**: does it ship for /info only, or does the /portfolio nav also get one? Recommend /info only for v33.0.
3. **Top-of-mobile title bar reading "Brilliance"**: yes/no? Currently doesn't exist. Recommend NO for v33.0; consider for v33.x.
4. **Mobile chat input layout when Brilli is hero**: shrink Brilli to inline on focus, OR push Brilli above the fold and keep input fixed at bottom. Recommend shrink-on-focus.
5. **PWA splash image**: currently uses launch screen. After v33.0, swap to new launch screen with Brilliance branding. Verify with Apple's "Generate from PWA" tool.
