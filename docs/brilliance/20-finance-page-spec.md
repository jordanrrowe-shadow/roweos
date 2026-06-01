# roweos.com/finance — Spec for VC-grade financial projections page

**Status:** Spec draft, ready for dual-session build
**Author:** Jordan + AI co-build session
**Date written:** 2026-04-30 (v33.85 transition session)
**Sibling:** roweos.com/portfolio (the executive summary site)
**Goal:** A standalone investor-facing page combining a portfolio-style narrative with a defensible financial baseline, projection model, and asks-of-investor block. Built so any VC who lands on the URL can read it cold and decide whether to take a meeting.

---

## Why this page exists

Brilliance has 120+ signups, 10 paying clients, ~$500/mo MRR, Google for Startups Cloud Program membership, and a working multi-surface platform shipped end-to-end by a single founder. Investors who hit roweos.com today see /portfolio (a feature inventory) but no financial story. /finance closes that gap.

The page must answer, in order:
1. What does the business actually do, in one sentence?
2. What's the traction today, with proof?
3. What's the path from today's MRR to a defensible Series-A revenue line?
4. What's the asks (round size, use of funds, runway), and what does the investor get?
5. Why this team, why now?

---

## The five sections

### Section 1 — Hero
- Headline: "Brilliance · operating intelligence for brand & life."
- Sub-headline: "A multi-surface AI platform. 120+ signups. 10 paying clients. Built solo. Profitable margins on every paid seat."
- Stat strip (4 numbers, big):
  - **120+** total signups
  - **10** paying clients (Founder tier)
  - **$500/mo** current MRR
  - **9** new product surfaces shipped in the last 60 days
- CTA: "View the deck (PDF)" + "Book a meeting" (Calendly or similar)

### Section 2 — Traction proof
A grid showing real, not projected, signal:
- **Signup curve** — month-over-month chart of the 120+ signups (from Firestore `roweos_users` count by month)
- **Conversion** — paying clients ÷ signups; today: 10/120 = 8.3% (industry benchmark for prosumer SaaS: 2–5%)
- **Retention** — what % of paying clients have been on for 3+ months. Pull from Stripe `subscription.start_date`.
- **Engagement** — median sessions per paying client per week. Pull from `roweos_session_log` if it exists; otherwise commit to instrumenting before this page goes live.
- **Logo wall** — 6–10 client/brand names (anonymize if NDA, but show count + industry diversity). Examples: "5 service brands · 3 retreat & hospitality · 2 personal-brand consultants."
- **Google for Startups Cloud Program** — official badge + paragraph on what that means (vetted, $200K credits, technical advisors).

### Section 3 — Financial baseline (the model VCs actually want)
A spreadsheet-style block, ideally a live calculator the investor can adjust. Two starting assumptions:
1. **Today's blended ARPU** (average revenue per paying user) — pull from Stripe: total monthly recurring ÷ paying users. Today: $500 / 10 = $50/mo blended (mix of $9 Solo, $29.50 Founder, etc.)
2. **Conversion of free → paid** — today's 8.3% holds steady or improves with the v33 surface system + Brilliance brand awareness.

Then project forward four scenarios:

| Scenario | Signups end of yr 1 | Conversion rate | ARPU | Yr-1 ARR | Yr-2 ARR (3x) | Yr-3 ARR (2.5x) |
|---|---|---|---|---|---|---|
| **Floor (status quo)** | 500 | 8% | $50 | $24K | $72K | $180K |
| **Realistic (+modest marketing)** | 2,000 | 10% | $60 | $144K | $432K | $1.08M |
| **Target (Brilliance launch traction)** | 5,000 | 12% | $70 | $504K | $1.5M | $3.78M |
| **Stretch (viral product-led)** | 15,000 | 15% | $80 | $1.92M | $5.76M | $14.4M |

Notes on the model:
- **3x then 2.5x** Y/Y is the standard early-stage SaaS multiple. Conservative vs. true PLG which can do 5–7x.
- **ARPU lift** comes from upgrades to Premium ($79/mo) and managed-API-key packs (one-time $X).
- **No team costs** in this model. Solo-founder cost stack: ~$6K/yr Vercel + Firebase + AI providers (Brilliance routes to user-supplied keys mostly, so AI cost is near-zero on the platform side). True margin per paying seat: 92%+.

### Section 4 — Use of funds (the asks)
**Round size:** $500K SAFE @ $5M post-money cap (or whatever Jordan's actual ask is — placeholder).

**18-month runway plan, allocated:**
- $180K (36%) — first hire: a brand-side growth marketer + content lead. Goal: take 120 signups → 5,000 in 18 months via content + community.
- $90K (18%) — second hire (M+9): one full-time engineer on Sync v5, mobile native, multi-user.
- $80K (16%) — paid acquisition + content production budget (founder will not do paid until there's a hire to run it).
- $60K (12%) — Google for Startups extended credits + infra scaling (Firestore, Vercel functions, Veo 3.1 video gen).
- $50K (10%) — legal + accounting + corporate setup (Delaware C-corp conversion if not already done).
- $40K (8%) — Jordan's salary @ $40K/yr (deliberately lean; majority of value remains in equity).

### Section 5 — Why this team, why now
- **Founder bio** — Jordan Rowe, builder of Brilliance solo over 18 months, ex-[experience], based in Austin TX.
- **Why now** — three forces: (1) consumer AI hit utility threshold in 2025, (2) most "AI workspaces" target enterprise; the prosumer + small-brand segment is wide open, (3) bring-your-own-key economics let Brilliance run profitably from day one — no VC needed to subsidize unit margins.
- **Why this build** — the multi-surface system (Tier 1/2/3) is the differentiator. Most AI products are one chat. Brilliance is nine surfaces (Chat, Studio, Folio, Pulse, Rhythm, Library, Bloom, Notebook, Thought Board) each tuned to a specific intellectual posture. That's an unusually high-effort, high-defensibility moat for a solo founder.

---

## Page architecture (technical)

- **File:** `RoweOS/dist/finance.html` — standalone, no build step, deploys with the rest of the dist.
- **Route:** add to `RoweOS/dist/vercel.json` rewrites: `{ "src": "/finance", "dest": "/finance.html" }`
- **Style:** match `/portfolio` and `/purchase` chrome. Cormorant Garamond serif headings, DM Sans body, gold accent #a89878, dark default with `?light` query param for light mode.
- **Charts:** Chart.js (already in CDN bundle) for the signup curve + projection bars. Or hand-roll SVG for full control.
- **Live numbers:** as much as possible should be auto-pulled. Two options:
  1. Hard-code at build time via a small Node script that reads from Firestore + Stripe and emits the page.
  2. Live-fetch on page load via a Vercel function that calls Firestore + Stripe and returns redacted aggregates. Auth: rate-limit + only return aggregate counts, no PII.
- **PDF export:** mirror /portfolio's `html2pdf.js` integration so investors can save the deck.

## Source data needed

To make Section 2 + Section 3 real (not placeholder), pull:

| Number | Source | Query |
|---|---|---|
| Total signups (lifetime) | Firestore | `count(roweos_users)` |
| Signups by month | Firestore | group by `createdAt` truncated to month |
| Paying clients | Stripe | active subscriptions, status='active' or 'trialing' |
| MRR | Stripe | `sum(subscription.items[0].price.unit_amount)` for active subs ÷ 100 |
| Churn rate (lifetime) | Stripe | canceled subscriptions ÷ ever-paid total |
| Median session length / engagement | Firestore | needs `roweos_session_log` writer (instrument before this page lands) |
| Google for Startups status + credits | Manual / GCP console | screenshot the badge |

## What to ask the investor

After they read /finance, the CTA is: "Book a 30-min meeting" → Calendly. The meeting is short on purpose. Show:
- Live demo of the platform (5 min — Brilli, Concierge, Time Ribbon, Studio split-pane, Thought Board)
- Live signup count + MRR (4 min — one tab open to Firestore + Stripe dashboards)
- The model (3 min — walk the four-scenario table)
- Q&A (15 min)

## Risks / honest negatives (for credibility)

A page with only good news reads like a pitch. Include a small "Risks & open questions" block:
- **Solo founder concentration risk** — primary mitigation is the marketing+engineering hire plan
- **AI provider lock-in** — partially mitigated by routing to three providers (Anthropic, OpenAI, Google) at the user's discretion; users own their keys
- **Apple/Google distribution** — Brilliance is a PWA today, not a native iOS/macOS app. v36 plan is React Native shell, but distribution is not a 2026 problem
- **Pricing power** — at $9–$79/mo the platform is positioned as prosumer; an enterprise tier ($500+/mo, multi-user) is on the roadmap but not built

## Build sequence (for the dual session)

1. Drop `RoweOS/dist/finance.html` skeleton — header, sections 1–5, footer
2. Wire the static numbers in Section 1 stat strip (manual entry; instrument the live-fetch later)
3. Build the four-scenario projection table as a live calculator (HTML + tiny vanilla-JS update on input change)
4. Add the signup-curve placeholder Chart.js with last-12-months mock data; replace with real once instrumentation lands
5. Add Section 4 use-of-funds horizontal bar (gold filled bars matching portfolio aesthetic)
6. Risks + ask block
7. PDF export button (clone from portfolio.html)
8. Vercel rewrite + smoke-test the URL
9. (Optional second pass) build the live-fetch Vercel function for aggregate counts

## How this connects to the rest of Brilliance

- **Don't touch the marketing copy that already says Brilliance.** The transition is done; this page joins as another surface in the family.
- **Lockup discipline** — every page footer ends with "Brilliance · Brand & Life Intelligence Platform · by RoweOS." (consistent with /purchase + /portfolio v33.84).
- **No sync code** — this page is purely public-facing static + read-only aggregates. It does not import the main app's state.
- **Memory hook** — when the dual session opens, that session reads `feedback_v33_overnight_session.md` AND this file (`docs/brilliance/20-finance-page-spec.md`) AND the recent traction numbers. The session writer should pull live numbers BEFORE drafting the page so the projections are anchored in reality.

## After /finance ships

1. Update `MEMORY.md` with the live MRR, signup, and conversion numbers as the page goes live
2. Add a /finance entry to the main app's Settings → About link so logged-in users see the investor narrative if they want to
3. Email the Brilliance Transition (v33.84 admin template) recipients with a "If you're an angel investor, here's our /finance page" closing line
4. Schedule a v34 spec doc at `docs/brilliance/21-finance-page-build-log.md` documenting what shipped vs. what got deferred to a follow-up
