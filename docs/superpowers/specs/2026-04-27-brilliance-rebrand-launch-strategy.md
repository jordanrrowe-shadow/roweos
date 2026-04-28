# Brilliance Rebrand Launch Strategy

**Status:** Draft v0.1
**Owner:** Jordan
**Date:** 2026-04-27

## The Move

RoweOS becomes **Brilliance**, a product layer inside The Rowe Collection.
Two reads of the new lockup, both valid, used in different contexts:

- **Brilliance by RoweOS** — short, conversational, social, hero copy
- **Brilliance, Intelligence OS by RoweOS** — long, formal, footers, legal, press (matches the new wordmark)

Parent stack remains:

> The Rowe Collection (LLC) -> RoweOS (engine, platform org) -> Brilliance (the product the world sees)

This mirrors how Apple uses "iPhone" without dropping "Apple", or how Adobe uses "Photoshop" without dropping "Adobe Creative Cloud". RoweOS does not disappear. It becomes the engine credit.

## Decision (confirmed 2026-04-27)

**Option A — Brilliance is the namesake, RoweOS is the engine credit.** Brilliance appears prominently everywhere a user looks. "by RoweOS" appears as the credit lockup wherever appropriate. RoweOS persists in legal, footer, About, repo, code.

**Code/internal stays RoweOS.** The brand swap is at the presentation layer only:
- User-facing copy, document titles, email templates, in-app text -> Brilliance
- File names, JS variables, localStorage keys (`roweos_*`), CSS classes, function names, repo, build paths -> RoweOS, untouched

See `~/.claude/projects/.../memory/project_brilliance_app_rename.md` for the full surface inventory.

**Domain:** roweos.com stays for SEO continuity. `brillianceos.ai` is under consideration as a future canonical domain. Not committed.

## Naming Discipline

| Surface | Use |
|---|---|
| roweos.com/brilliance landing | "Brilliance, Intelligence Platform by RoweOS" (full lockup hero) |
| Marketing, press, partnerships | "Brilliance by RoweOS" |
| Inside the product (sidebar, footer) | "Brilliance" (the world the user is in) with a small "by RoweOS" lockup |
| Legal, billing, Stripe receipts | "RoweOS / The Rowe Collection, LLC" (do not change yet) |
| Domain | roweos.com stays (for SEO continuity); brilliance.app aspirational, not required for v1 |

Avoid: "Brilliance OS", "BrillianceAI", any combo that reads like a Pokemon. Brilliance is a noun. Let it stand.

## Phased Rollout

### Phase 0 — Foundation (now, ahead of launch)
- [x] /brilliance landing page live (this session)
- [ ] Add quiet "Brilliance by RoweOS" lockup to /info hero with a link to /brilliance
- [ ] Reserve brilliance.com (whois first, then assess), brilliance.app, @brilliance handles
- [ ] Lock the wordmark, monogram, app icon in /images/brilliance/ (already in place; redo at launch with new shoot)
- [ ] Update product sidebar footer to read "Brilliance · by RoweOS" alongside version

### Phase 1 — Soft launch (4-6 weeks before public)
- [ ] Founder beta cohort sees the rebrand inside the product (in-app banner: "Welcome to Brilliance")
- [ ] /brilliance becomes the primary external link instead of /info
- [ ] /info gets a "now Brilliance" lockup but stays live for SEO
- [ ] Stripe products renamed in the dashboard (display name only — keep IDs intact)
- [ ] Email templates updated: subject lines lead with "Brilliance" or "Brilliance by RoweOS"
- [ ] Onboarding flow updated to introduce Brilliance, with one slide on "the platform is RoweOS, the product is Brilliance"

### Phase 2 — Public launch (the moment)
- [ ] Press / Substack / X thread sequence (see below)
- [ ] /brilliance is the canonical URL; /info redirects to /brilliance/intro
- [ ] App icon + PWA manifest swapped to Brilliance branding
- [ ] LinkedIn company page header swap
- [ ] Google for Startups co-announcement (request joint copy from program)
- [ ] Founding Member tier marketing push (rename Founder -> Founding Member to match Brilliance voice)

### Phase 3 — Sustain (post-launch, ongoing)
- [ ] Brilliance becomes the only consumer-facing brand
- [ ] RoweOS persists as the engine credit, mentioned in About / Press / footer
- [ ] /info domain retired after 90 days of stable /brilliance traffic

## Launch Day Asset Checklist

Visual:
- [ ] Hero shoot: physical wordmark on darkroom background, used as wallpaper-quality marketing asset
- [ ] Product screenshot suite redone with Brilliance brand color (gold) and current UI state. Replace /images/desktop/*_brandAI.png with /images/brilliance/screens/*.png
- [ ] Intro motion piece (15s loop): wordmark fade + chapter labels animating in (echoes the landing page)
- [ ] App icon refreshed (current monogram is good; verify on macOS dock with no white border per CLAUDE.md PWA icon rule)

Copy:
- [ ] One-pager PDF (replace existing roweos-one-pager.html with Brilliance-branded version)
- [ ] Press kit (1 page elevator, 3 paragraph deep, 5 quotes, 3 logos, 5 screenshots)
- [ ] FAQ: "What happened to RoweOS?" answer ready (RoweOS is the engine; Brilliance is what you use)

Distribution:
- [ ] Substack drop ("Why I built Brilliance")
- [ ] X thread (the rebrand story, not a feature dump)
- [ ] LinkedIn long-form (operator angle — built for portfolio operators, not enterprise)
- [ ] DM list of 25 hand-picked operators who get personal launch notes
- [ ] No Product Hunt unless we have founding members ready to vote within the first hour

## Site Architecture After Launch

```
roweos.com/             -> the actual app (login)
roweos.com/brilliance   -> the product story (this page)
roweos.com/info         -> redirects to /brilliance after Phase 2
roweos.com/portfolio    -> capabilities matrix
roweos.com/purchase     -> pricing
roweos.com/social       -> content studio teaser
therowecollection.com   -> parent company, links to /brilliance under "Flagship Product"
```

## Open Questions

- **Tagline lockup**: "Operating intelligence, built for brands." (current) vs "The intelligence behind ambitious brands." (Brilliance hero). Pick one and use everywhere.
- **Brilli the assistant**: in-app voice for Brilliance. Currently teased on /brilliance. Decision: ship Brilli as the only consumer-facing AI persona at Phase 2, or keep BrandAI / LifeAI naming inside the product and use Brilli only as the marketing voice.
- **Domain**: do we want brilliance.com or is roweos.com/brilliance fine forever. Operating cost vs SEO cost.
- **Renaming Founder tier**: "Founding Member" reads warmer in the Brilliance voice. Need to verify Stripe product display names can change without breaking existing subs.

## Image Refresh List (per user note)

Replace at launch, not before:
- `/images/desktop/*_brandAI.png` and `/images/desktop/*_lifeAI.png` -> `/images/brilliance/screens/{studio,chat,pulse,identity,library,bloom,automations,rhythm}.png`
- `/images/brilliance/wordmark.png` -> verify retina; current is fine for landing
- Add `/images/brilliance/og-card.png` (1200x630) for OpenGraph
- Add `/images/brilliance/app-store-mock.png` for marketing
