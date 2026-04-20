# Google for Startups Promo Content - Design Spec

**Date:** 2026-04-16
**Status:** Draft

---

## Overview

RoweOS has been accepted into the Google for Startups Cloud Program. This spec covers all promotional content across four surfaces: Content Studio templates (social carousel posts), the RoweOS app, The Rowe Collection website, and a new standalone promo page at `roweos.com/social3`.

**Messaging strategy:** Bold "Backed by Google" on social/promo content, official "Google for Startups" with program logo on website surfaces for credibility.

---

## Deliverable 1: Content Studio Templates (`social3.html`)

A new standalone page at `roweos.com/social3` that serves as BOTH a promo landing page AND a Content Studio for Google for Startups content. Built on the `social2.html` architecture (same template engine, sidebar, grid, preview, download system).

### Structure

**Same template engine as social2.html** - `cardWrap()`, `watermark()`, `goldText()`, `screenshotFrame()`, `logoMark()`, `featureIcon()`, `checkIcon()` helpers copied over. Same CARD_W/CARD_H (1080x1350).

**New helper: `googleLogo(width)`** - renders the Google for Startups logo PNG at specified width. The logo PNG will be copied to `/images/promo/google-for-startups.png`.

**New helper: `backedBadge(mode)`** - renders a small "Backed by Google" badge with Google colors on the G, reusable across templates.

### Categories

1. **`announcement`** - "Backed by Google" announcement carousel (6 slides)
2. **`features`** - Feature spotlight carousels with Google badge (4 sets x 3-4 slides each)
3. **`social-hooks`** - Single-slide bold statement posts
4. **`animated`** - Animated HTML pages for screen recording (separate section, not downloadable as PNG)

### Template Set: Announcement Carousel (6 slides, dark + light)

| Slide | Content |
|-------|---------|
| 1 | RoweOS logo + "Backed by Google" large text + Google for Startups logo below |
| 2 | "What is RoweOS?" - brief pitch + screenshot of the main dashboard |
| 3 | "AI agents that learn your brand" - screenshot of Chat/Studio with agent colors |
| 4 | "Automate everything" - screenshot of Automations Lab |
| 5 | Key stats/features list (5 brands, 6 AI agents, 20+ views, etc.) |
| 6 | CTA: "Join the Beta" + roweos.com + Google for Startups badge |

### Template Set: Feature Carousels (3-4 slides each, dark + light)

**Chat carousel:**
1. Phone mockup of chat interface + "Your AI, your voice"
2. Side-by-side: same question, two brands, different tone (like Sunny example)
3. CTA with Google badge

**Studio carousel:**
1. Screenshot of Studio operations grid + "One-click content"
2. Before/after: raw idea vs polished output
3. CTA with Google badge

**Focus carousel:**
1. Screenshot of Focus dashboard + "Your command center"
2. Feature bullets: calendar, tasks, streaks, automations overview
3. CTA with Google badge

**Automations carousel:**
1. Screenshot of Automations Lab + "Set it and forget it"
2. Pipeline builder screenshot + "Multi-step workflows"
3. CTA with Google badge

### Template Set: Social Hooks (single slides, dark + light)

Bold typography statements:
- "Backed by Google. Built for brands."
- "Your brand deserves its own AI."
- "We didn't raise funding. Google chose us."
- "Operating intelligence, backed by Google."
- "The AI platform Google believes in."

### Screenshot Assets

Using existing screenshots from `/images/desktop/`:
- `chat_brandAI.png` - Chat view
- `studi_brandAI.png` - Studio view
- `focus_brandAI.png` - Focus view
- `full_screen_brandAI.png` - Full screen view
- `analytics_brandAI.png` - Analytics
- `adaptive_brandAI.png` - Adaptive UI

### Google Logo Asset

Copy `/Users/jordanrowe/Downloads/Google_for_Startups_logo.svg.png` to `/Users/jordanrowe/Developer/roweOS/RoweOS/dist/images/promo/google-for-startups.png`.

---

## Deliverable 2: Animated HTML Pages (for screen recording)

Standalone HTML pages (not part of the template grid) accessible via a separate "Animations" tab or section in social3.html. Each is a full-viewport animated sequence designed to be screen-recorded.

### Animation 1: Launch Announcement (15-20 seconds)

Sequence:
1. Black screen, RoweOS logo fades in center (2s)
2. Logo scales down, "Backed by Google" types in below (2s)
3. Google for Startups logo fades in (1.5s)
4. Transition: slides left to reveal UI screenshots cycling through views (6s, 3 views)
5. Stats counter animation: "6 AI Agents" / "20+ Views" / "5 Brands" count up (3s)
6. Final frame: "RoweOS" + "roweos.com" + Google badge (2s)

CSS animations only (keyframes, transforms, opacity). No JS animation libraries.

### Animation 2: Feature Walkthrough (20-25 seconds)

Sequence:
1. "Meet your operating intelligence" types in (2s)
2. Chat screenshot slides in from right with caption (3s)
3. Transitions to Studio screenshot (3s)
4. Transitions to Focus screenshot (3s)
5. Transitions to Automations screenshot (3s)
6. All 4 shrink into a 2x2 grid (2s)
7. "Backed by Google for Startups" overlay (2s)
8. CTA: "roweos.com" (2s)

---

## Deliverable 3: The Rowe Collection Website Update

**File:** `/Users/jordanrowe/Developer/the-rowe-collection/src/app/roweos/page.tsx`

Add a "Google for Startups" badge/section to the RoweOS page. 

- Small badge near the hero or below the main headline: Google for Startups logo + "Google for Startups Cloud Program Member"
- Subtle, credible placement - not overpowering the existing design
- Uses the existing cream/gold/black design language
- Google for Startups logo image added to `/public/images/`

---

## Deliverable 4: RoweOS App Badge

**Files:** `src/html/shared/26-landing.html` (login/landing page)

Add a small "Backed by Google for Startups" badge on the login screen, below the main logo/tagline area. 

- Uses existing design tokens (gold accent, glass morphism)
- Small Google for Startups logo + text
- Non-intrusive, adds credibility during onboarding

---

## Deliverable 5: Vercel Route

**File:** `RoweOS/dist/vercel.json`

Add route: `{ "src": "/social3", "dest": "/social3.html" }`

---

## Design Language (consistent across all deliverables)

- **Fonts:** Cormorant Garamond (headlines), DM Sans (body) - matches RoweOS
- **Colors:** Dark (#0a0a0a bg, #ece4d8 text, gold accents #b2997b/#a89878). Light variant (#ffffff bg, #1a1a1a text, darker gold)
- **Google branding:** Use their logo as-is, don't recolor it. Google's multi-color only appears in their logo, never bleeds into RoweOS design
- **No emoji** - SVG icons only
- **No one-sided borders** - full borders or subtle background tints for highlighting
- **ES5 JavaScript** - no arrow functions, let/const, template literals (for social3.html)
- **Watermark:** "roweos.com" on all social templates

---

## File Inventory

| File | Action |
|------|--------|
| `RoweOS/dist/social3.html` | Create (new) |
| `RoweOS/dist/vercel.json` | Edit (add route) |
| `RoweOS/dist/images/promo/google-for-startups.png` | Create (copy from Downloads) |
| `the-rowe-collection/src/app/roweos/page.tsx` | Edit (add badge) |
| `the-rowe-collection/public/images/google-for-startups.png` | Create (copy) |
| `src/html/shared/26-landing.html` | Edit (add badge) |
| `src/build.sh` | No change needed (landing.html already included) |

---

## Out of Scope

- Video rendering (MP4 export) - user will screen-record the animated HTML pages
- Changes to the main RoweOS Content Studio (`social.html`) - social3 is standalone
- Any changes to RoweOS app functionality - visual badge only
