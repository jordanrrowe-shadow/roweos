# Brilliance v33.0 — The Welcome Release

**Codename:** "Welcome to Brilliance"
**Status:** Draft v0.1, written 2026-04-27 overnight
**Previous shipped:** v32.1 (4 days of /brilliance landing iteration, /info pill, new logos, simplified manifesto edition)
**Target ship:** TBD — depends on Brilli animation production + cleanup pass length

---

## What v33.0 is

The release where the platform's user-facing identity becomes **Brilliance**. Every surface that a user reads or sees stops saying "RoweOS" and starts saying "Brilliance," with "by RoweOS" as the engine credit. Brilli, the firefly entity, becomes the platform's visible AI presence and replaces the helix and the chat blob as the central animated brand element. The current loose ends — retired features, broken email writers, ghost UI from Focus/Signal, drift between code paths — get cut, not patched.

This is not a feature release. It is a **brand & coherence release** — the moment the platform stops being "RoweOS, my private project" and becomes "Brilliance, the intelligence platform you bought into." Future feature work happens *on top of* the new identity, not alongside the old one.

## What v33.0 is NOT

- A backend rewrite. Sync, Firebase, Stripe, agents, all of it stay as-is.
- A localStorage migration. `roweos_*` keys stay. Renaming them would break every existing user's data.
- A code rename. `src/`, `RoweOS/dist/`, JS function names, CSS classes, `ROWEOS_VERSION` constant, repo name — all stay RoweOS internally.
- A pricing change. Stripe price IDs, plan structure, founding member status — stay. Display names update.
- An investor pitch. Investor framework drafted (07) but not pursued in v33.0.
- A new domain. roweos.com remains canonical. brillianceos.ai considered, not committed.

## Core decisions (locked)

1. **Option A confirmed** — Brilliance is the namesake, RoweOS is the engine credit. No other variants. Long-form is "Brilliance, Intelligence OS by RoweOS." Short-form is "Brilliance by RoweOS." In-product is just "Brilliance."

2. **Code-internal stays RoweOS** — only user-visible strings change. Decision rationale and surface inventory in `03-in-app-rename.md`.

3. **Brilli is the entity** — the platform's AI given visual form. Firefly aesthetic per the reference image. Brilli replaces the chat-view blob landing and lives wherever the AI is "present." Helix stays as a LifeAI ambient element but is subordinate to Brilli. Full spec in `01-brilli-entity.md`.

4. **First-launch announcement** — every existing user gets a one-time "Welcome to Brilliance" modal on next open after v33.0. Not a feature tour. A name-and-vision moment with one CTA: *Continue*. Spec in `02-welcome-experience.md`.

5. **Cleanup is non-negotiable** — v33.0 ships *with* deletions, not around them. The retired Focus/Signal residue, dead automation paths, info.OLD.backup.html, and the email-system bugs on the priority list (`memory/project_email_system_bugs.md`) get addressed or removed. Catalogue in `04-cleanup-targets.md`.

6. **Old Standard TT + DM Sans** — typography unified across `/brilliance`, `/info`, in-app where serif appears. Matches `therowecollection.com`. No more font drift.

## The five vectors of the overhaul

### Vector 1 — Brand identity
Logos, lockups, color, type. Already 80% complete on the `/brilliance` landing. v33.0 carries it inside the product:
- Launch screen swaps to circular monogram + "Brilliance"
- Sidebar footer reads "Brilliance · by RoweOS"
- App icon swaps to the new black-bg `B` mark
- All `<title>` tags read "Brilliance" (not "RoweOS")
- PWA manifest `name` becomes "Brilliance"
- Email templates (transactional + marketing) wear the new wordmark

### Vector 2 — Brilli the entity
Brilli is not a chatbot, not a mascot, not a sticker. Brilli is the AI given form — the firefly you see when the platform is thinking, idling, present, or reaching out. Brilli's purpose is to make the platform feel **inhabited by intelligence** instead of being a UI you operate.

Brilli appears in five contexts (full inventory in `01-brilli-entity.md`):
1. **Launch screen** — large drift, ambient
2. **Chat landing** — replaces the centered blob, idles in a "listening" pose
3. **Thinking indicator** — wing flap accelerates while AI streams
4. **Help / nudges** — small Brilli appears next to ambient suggestions in Pulse
5. **Empty states** — Library, Bloom, Studio empty states get a small Brilli "showing the way"

### Vector 3 — Visual system
- **Typography**: Old Standard TT for headlines, DM Sans for body. Already in `/brilliance`. Extend to the in-product splash screen and Settings > About.
- **Color**: Gold gradient `--gold-1` through `--gold-5` is the cross-surface accent. Per-brand accent colors (`--brand-accent`) stay; gold is the *Brilliance* layer, not the brand layer.
- **Motion**: A defined motion system. Brilli idles slow, thinks fast, transitions soft. Documented in `05-brilli-animation.md`.

### Vector 4 — Surface rebrand
The full string-by-string rename pass. Driven by agent A's surface inventory (incorporated into `03-in-app-rename.md`). Phased so we ship a coherent rebrand, not a half-renamed UI.

### Vector 5 — Cleanup
Everything that's broken, unused, or living past its retirement gets cut. Driven by agent B's audit (incorporated into `04-cleanup-targets.md`). The principle: *if v33.0 is the welcome moment, the house must be clean for guests.*

## Phases of v33.0

### Phase A — Foundation (week 1)
- Asset library finalized in `RoweOS/dist/images/brilliance/`
- Brilli SVG sketched + animation tech chosen (`05-brilli-animation.md`)
- Surface inventory frozen
- Cleanup target list approved

### Phase B — Cleanup pass (week 2)
- Delete retired Focus/Signal residue (CSS, HTML, JS, automation refs)
- Delete `info.OLD.backup.html` and any `*.backup.*` files
- Resolve or remove the 5 email-system bugs from `project_email_system_bugs.md` (some get fixed, some get deleted endpoints)
- Collapse dual execution paths where one side is dead code (per CLAUDE.md "Dual execution paths" list — verify each pair, kill what's unused)
- Archive shipped planning docs in `docs/superpowers/specs/` (move to `docs/superpowers/specs/archive/`)
- Remove unreferenced images from `dist/images/`

### Phase C — Brilli production (week 2-3)
- Build the Brilli SVG with the chosen animation tech
- Wire into chat landing (replaces blob)
- Wire into launch screen
- Wire into thinking indicator
- Helix subordinated (LifeAI ambient only, not the hero)
- Performance audit on iOS Safari

### Phase D — Surface rebrand (week 3-4)
- Sweep `src/html/` for user-facing "RoweOS" strings, replace per `03-in-app-rename.md`
- Update `<title>` tags, OG meta, PWA manifest
- Email templates (server + client) updated with new wordmark
- Stripe display names updated in dashboard (price IDs untouched)
- Sidebar footer, settings, About all read "Brilliance"
- App icon swap (verify no white border on macOS dock — flatten alpha per CLAUDE.md PWA icon rule)

### Phase E — Welcome experience (week 4)
- "Welcome to Brilliance" modal built, gated behind one-time flag
- Trigger on first launch after v33.0 deploy
- Copy + visual per `02-welcome-experience.md`
- Single CTA: "Continue"

### Phase F — Site overhaul (week 4)
- `/info` overhaul per `06-info-overhaul.md`
- `/info` pill removed (since /info itself is now Brilliance-coherent)
- `/portfolio`, `/social`, `/purchase` get the same typography + lockup treatment
- One-pager regenerated with Brilliance branding

### Phase G — Launch (week 5)
- Version bump to v33.0 in all 8 locations + CLAUDE.md
- CHANGELOG entry written
- Deploy
- Welcome modal lights up for existing users
- Soft announcement: in-app banner only for first 48 hours
- Public announcement: 1 week later (per launch strategy doc)

## Success criteria

1. Every `<title>`, every email subject, every modal text, every sidebar label reads "Brilliance" (or "Brilliance by RoweOS"). Zero user-visible "RoweOS" mentions outside the explicit engine credit.
2. Brilli renders smoothly on iOS Safari at 60fps in idle, drops to 30fps acceptable during heavy AI streaming.
3. The 5 email-system bugs from `project_email_system_bugs.md` are either fixed or the endpoint they live in is deleted.
4. Focus/Signal has zero remaining code paths. `showView('signal')` redirect kept (one line) for back-compat URL bookmarks.
5. Welcome modal shows once per user, never again. No regression in startup flow.
6. Existing users open the app, see Brilli, see "Welcome to Brilliance," click Continue, and find every feature exactly where it was. No data loss, no settings reset, no broken automations.

## Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Brilli animation tanks iOS performance | High | Performance budget defined upfront in `05-brilli-animation.md`. Kill switch via `prefers-reduced-motion` and a Settings toggle. Fallback to static SVG. |
| Welcome modal blocks users from getting into the app on first launch | Medium | Single dismissible CTA, no required interaction. ESC also dismisses. Fail-safe: if modal fails to render, log and skip. |
| String rename misses a user-facing "RoweOS" | Low | Agent A's inventory + post-rename grep verification + manual launch screen / settings / email walkthrough. |
| Cleanup deletes something live | Medium | Risk levels in `04-cleanup-targets.md` (safe-delete / deprecate-first / investigate). Deprecate-first items get a deprecation comment + 1 release of dormancy before deletion. |
| App icon change triggers PWA reinstall on user devices | Medium | Document in welcome modal copy: "If the icon looks wrong on your home screen, delete and re-add the PWA." Per existing CLAUDE.md PWA caching note. |
| Stripe display name change confuses existing customers | Low | Display name only, not product name. Existing receipts unchanged. New receipts read "Brilliance." |
| 10 real clients lose trust if anything regresses | High | Pre-deploy: full smoke test on all major paths. Post-deploy: monitor first-day error logs aggressively. |

## Out of scope (deferred to v33.x or v34)

- **Brilli's voice & personality** — Brilli speaks as the platform, eventually. v33.0 ships Brilli as visual presence only, not as a conversational layer. The conversational layer comes in a follow-up.
- **brillianceos.ai domain** — reserve, but don't switch. SEO equity on roweos.com matters.
- **In-product feature redesign** — Studio, Pulse, Library all stay structurally identical. Brilli decoration only.
- **New onboarding flow** — current onboarding stays. Welcome modal is a one-time supplement, not a replacement.
- **Investor pitch deck** — framework in `07-investor-framework.md`, not produced.
- **Mobile native apps** — PWA stays. Native is a v34+ conversation.
- **Brand color customization** — current per-brand accent system stays. No "Brilliance Light" theme yet.

## Sequencing rationale

Why phase B (cleanup) before phase D (rebrand)?
Renaming dead code is wasted effort. Cleanup first means the rebrand sweep moves over a smaller surface area, with fewer false hits.

Why phase C (Brilli) before phase E (welcome)?
Welcome modal needs Brilli to be production-ready. Brilli is the moment the modal sells.

Why phase F (site) after phase E (welcome)?
External traffic to /info should arrive at a coherent Brilliance world. If welcome modal is live but /info still looks like old RoweOS, the announcement moment is undercut.

## Documents in this set

| # | File | Purpose |
|---|---|---|
| 00 | `00-v33-master-plan.md` | This file. Vision and phasing. |
| 01 | `01-brilli-entity.md` | Brilli design spec — visual, behavior, voice |
| 02 | `02-welcome-experience.md` | First-launch announcement modal |
| 03 | `03-in-app-rename.md` | Surface inventory + rename order |
| 04 | `04-cleanup-targets.md` | Deletion + deprecation list |
| 05 | `05-brilli-animation.md` | Animation tech choice + integration |
| 06 | `06-info-overhaul.md` | /info page strategy |
| 07 | `07-investor-framework.md` | Deferred investor framing skeleton |
| 08 | `08-mockups-index.md` | Live HTML mockups guide |
| 09 | `09-wakeup-summary.md` | What was done overnight, what's next |

## Final word

v33.0 is the moment the platform stops being a clever side project and becomes a **brand**. Brilliance has a face (Brilli), a voice (the writing across the surfaces), a posture (sovereign, identity-first, refined), and a name on the door. The user opens the app and sees an entity that knows them, looks the part, and behaves like it deserves their attention.

The cleanup is the discipline that earns the rebrand. The rebrand is the proof that the discipline mattered.
