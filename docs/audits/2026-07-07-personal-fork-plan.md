# RoweOS Base Verification + Personal-Fork Strip-Down Plan

**Date:** 2026-07-07 · **Base audited:** v35.12 (live) · Companion to `2026-07-07-principal-audit.md` (the security/data audit). This document answers two different questions: (1) does the base actually *work*, instance by instance, and (2) what can be stripped to make a single-user personal app that never has to service other people.

---

## Part 1 — Does it all work?

### What was verified

| Check | Result |
|---|---|
| Build from source (231,551 lines) | Clean |
| Test suite | 278/278 pass |
| Pre-deploy audit (version sync, ES5 scan, patterns) | Pass |
| Cold boot in a real browser (Playwright, served dist) | **0 console errors**; launch screen, sidebar nav (all 5 groups), notifications panel, universal search all render. 5 warnings, all benign (three.js deprecation notice, Firebase persistence API notice, incognito storage denial, sandbox iframe notices) |
| Global function-name collisions (the concatenated-file hazard CLAUDE.md warns about) | **14 collisions found; at least 3 produce live bugs** — detail below |

### The name-collision findings (facts, verified against callers)

In a concatenated bundle, when two files define the same global function, the later file silently wins. 14 names collide; most losers are dead weight, but these have callers using the *losing* signature — i.e., real broken behavior in the running app:

1. **`getModelDisplayName`** — `29-analytics-commerce.js:4840` `(modelId)` shadows `23-offline.js:972` `(provider, modelId)`. **3 call sites** still pass `(provider, model)` — those spots display the provider string as the model name.
2. **`deleteICloudCalendarEvent`** — `14-calendar.js:6369` `(event)` shadows `14-calendar.js:5270` `(eventUid)`. One caller passes a bare `eventUid` string to the winner that expects an event object → that iCloud delete path is broken.
3. **`updateOutlookCalendarEvent`** — `14-calendar.js:6264` `(event, updates)` shadows `:5165` `(event)`. A single-arg caller hits the winner with `updates === undefined`.
4. **`openModal`/`closeModal`** — `27-launch-brandai.js` (static-DOM toggler) shadows the entire `08-foundation.js` modal *registry* system. Verified: the registry has **zero** external `registerModal` calls and zero two-arg `openModal` callers — the 08 system is ~150 lines of dead code. **Correction to the v35.12 release:** the "openModal single-instance guard" shipped in v35.12 landed on this dead version; it is a harmless no-op, and the underlying audit finding was a false positive (the live 27 version toggles existing DOM nodes and cannot stack duplicates).
5. **Suspect, unverified callers:** `reminderAction` (two signatures inside `28-reminders-notifications.js` — `(id, viewName)` at :63 vs `(remId, action)` at :387), `toggleCalendarVisibility` (`(calId, visible)` vs `(calKey)`), `confirmDeleteBrand` (`(brandIdx)` in 13-studio vs `()` in 27-launch), `getProviderForModel`, `deleteLifeGoal` (`(goalIdx)` vs `(id)` — index-vs-id argument confusion is a classic data-loss shape), `deleteLibraryFolder`, `toggleVoiceAttribute`. Each needs a 5-minute caller check; signatures differing is a bad sign.

**Bottom line:** the base is healthy at boot and in tests, but the collision class is exactly the kind of breakage no test covers (the tests exercise TS facades, not the ES5 bundle). Fixing the ~7 diverged collisions by renaming is a half-day, low-risk task and should happen *before* any fork, so the fork starts clean.

### Recommended immediate fix list (pre-fork, ship as v35.13)
- Rename the losing/winning pairs so both behaviors are reachable: `getModelDisplayName` → keep 23-offline's as `getModelDisplayNameFor(provider, modelId)`; fix the 3 call sites.
- Merge the two calendar dupes (keep the newer object-based versions, adapt the odd callers).
- Delete the dead 08-foundation modal registry (~150 lines) including the v35.12 no-op guard, or rename it `openRegisteredModal` if you ever want it.
- Add a **collision check to `scripts/pre-deploy-audit.sh`**: `cat src/js/core/*.js src/js/late/*.js | grep -oE '^function [A-Za-z0-9_]+' | sort | uniq -d` must be empty. This permanently kills the bug class.

---

## Part 2 — Strip-down plan: a personal, single-user Brilliance

### What "servicing others" actually costs in this codebase

**Serverless (verified line counts):** 15 of 27 endpoints exist only to service other people — Stripe checkout/webhook/portal (1,452), newsletter + signup + welcome + template emails + survey responses (2,836), feedback, click tracking, admin analytics, admin-delete-user, email-log helper (1,093). **Total: ~5,400 lines deleted, and the function count drops 27 → 12 — which fits the Vercel Hobby plan's 12-function limit.** A personal app would not have needed the Pro upgrade.

**Client source (verified):**
| Strip | Lines | Why it exists |
|---|---|---|
| `25-admin-emails.js`, `25-admin-campaigns.js`, `25-admin-sites.js` | 3,074 | Admin email/campaign dashboards for managing users |
| `26-smart-suggestions-onboarding.js` | 4,995 | New-user onboarding flow, trial setup |
| Commerce/tier half of `29-analytics-commerce.js` | ~5,000 of 11,066 | Checkout, tiers, subscription UI, clients pipeline (keep the personal analytics half if you use it) |
| Tier/access-key/admin gating woven through everything | 152 call sites (61 in `22-firebase-sync.js`) | `getUserTier`, `hasFeatureAccess`, `isAdmin`, access-key generation/validation/delivery, trial expiry |
| Admin view + nav + Firestore rules for shared collections | — | `access_keys`, `api_key_pool`, `newsletter_subscribers`, `email_log`, `campaign_clicks`, `signups`, `sync_v5_audit` collections all disappear |

**The sleeper: the sync stack.** ~25K lines (`22-firebase-sync` 13.0K + `23-offline` 5.2K + `10-sync` 3.1K + `22a-tombstones` 1.9K + `35-sync-v5` 1.6K + reconcile/freshness UI) exists to make multi-user cloud-authoritative sync safe. The data layer is really localStorage/IndexedDB (2,877 call sites) with Firestore as a 317-site overlay. For one user: keep Sync v5 only (it's the clean envelope design, already code-complete), delete v4 + tombstone registry + reconcile UI + offline queue duplication — roughly **10–12K more lines gone**, and it eliminates the entire class of resurrection/merge bugs that dominated the security audit's data-integrity findings.

**What you keep (the actual product, all personal-useful):** chat/agents (11-agents, 20-ui-misc dispatch), Studio, Library, Calendar, Mail, Social Hub, Automations + scheduler, Scribe, Journal, Pulse, Bloom, Evolve + quiz/verifier engines, Brilli, Knowledge Engine, Thought Board, foundation/state. Plus the 12 personal-core endpoints (gmail/caldav/x-dm proxies, social auth/post/media, blob-proxy, fetch-site-meta, scheduler, push, ig-redirect, log-mail-sent).

**Net:** ~25–30K of 166K JS lines (15–18%) plus 5.4K server lines removed, and — more valuable than the line count — the deletion closes most of the open Critical security findings *by removing the attack surface entirely*: the newsletter free-key mint, the Stripe webhook race, api_key_pool, trial revocation, admin endpoints, and the customer-PII Firestore rules all cease to exist. The remaining endpoint-auth backport shrinks from 10 endpoints to ~6, and "breaking stale client sessions" stops being a concern because the only client is you.

### Recommended approach: fork-and-strip, not rebuild

A rebuild throws away the part that works (the 130K lines of features you use daily, all just verified to boot clean). Strip in phases, each independently shippable:

- **Phase 0 (do first, in the main repo):** fix the 7 diverged name collisions + add the collision gate to pre-deploy-audit. Half a day.
- **Phase 1 — fork:** new repo `brilliance-personal` (same structure, same build.sh), new Firebase project (fresh Firestore, single user), new Vercel project on **Hobby**. Delete the 15 SaaS endpoints + `vercel.json` entries. Delete `firestore.rules` shared-collection blocks; rules become ~15 lines (`request.auth.uid == YOUR_UID` on everything).
- **Phase 2 — de-gate:** delete 25-admin-*, 26-onboarding, commerce half of 29; replace `getUserTier()`→`'founder'`, `hasFeatureAccess()`→`true`, `isAdmin()`→`true` as one-line stubs first (zero-risk), then remove call sites opportunistically. Access-key system deleted; app boots straight to Firebase email/password login for you.
- **Phase 3 — sync consolidation:** flip Sync v5 to sole engine (the migration plan's Phase D, which is already code-complete and gated behind `roweos_sync_v4_retired`), then delete v4/tombstones/reconcile (~10K lines). This is the phase with real data-migration care; do it after living on the fork for a couple of weeks.
- **Ongoing:** the 10-client RoweOS repo stays untouched and deployable throughout.

### Open questions (need Jordan)
1. **Is this a second app alongside the client business, or a step toward sunsetting it?** Fork-alongside (recommended above) vs migrate-in-place are different plans. If the 10 clients are staying, the main repo still needs the deferred audit fixes (endpoint auth, key delivery) regardless of the fork.
2. **Clients pipeline / analytics in 29:** do you use these personally (your own brands' revenue tracking) or only to service others? Determines whether ~5K lines is kept or cut.
3. **Same data or fresh start?** Fork can seed from a one-time export of your current Firestore user doc, or start empty.
4. **Social/Push/OAuth apps:** the fork needs its own OAuth app registrations (X, Threads, IG, TikTok, Gmail, Outlook) or shared use of the existing ones — shared is less setup, separate is cleaner.
