# Brilliance / RoweOS — Principal-Level Full-Project Audit

**Date:** 2026-07-07 · **Version audited:** v35.11 (live) · **Scope:** entire repo — src/ (166K lines JS + 51K CSS + 15K HTML), 27 Vercel serverless functions, Cloud Functions, Firestore rules, build/deploy tooling.
**Method:** 7 parallel deep-review agents (sync/data, serverless API, client API bridge, chat/studio/agents, automations/scheduler, commerce/admin/email, foundation/UI/social) + cross-cutting analysis. Every finding cites file:line and was reported at medium/high confidence only.

---

## 1. Executive Summary

**Overall health: C+.** The product is functionally rich and the engineering culture is real — a 278-test suite, a mandatory pre-deploy audit script, a disciplined tombstone/sync-v5 migration, and CLAUDE.md institutional memory that most teams never build. But the audit found a systemic server-side authentication gap (7+ endpoints trust a UID from the request body — anyone who knows a user's UID can read/send their Gmail, post as them, or push-notify them), several client-side XSS vectors reachable via AI output, and a cluster of sync-layer bugs including one critical one-liner (`roweos_last_sync` stored as a locale string) that silently disables a whole class of deletion enforcement. **Top 3 risks:** (1) unauthenticated/misauthenticated serverless endpoints exposing client Gmail, social accounts, and Stripe billing portals; (2) silent data-loss paths in sync (offline pulse goals dropped, `merge:false` ignored on replay, conversation resurrection); (3) duplicate side-effects — cross-tab double execution of automations and an unbounded Gmail 401 retry loop, both of which send real email/posts to real clients twice. **Top 3 opportunities:** (1) a shared `verifyIdToken` helper backported to all endpoints closes most of the security surface in one pattern; (2) five one-to-five-line sync fixes eliminate the worst data-integrity bugs; (3) the pre-deploy audit script is the perfect place to enforce the new invariants (escapeHtml on innerHTML, no uid-in-body auth) so regressions can't ship.

---

## 2. Repo Map

**Purpose:** "Brilliance — Intelligence OS." Private AI platform for brand + life management. 10 paying clients. Owner-operated (Jordan, The Rowe Collection LLC).

**Stack:** Zero-framework vanilla ES5 JS, concatenated by `src/build.sh` into a single ~231K-line `RoweOS/dist/index.html` (10 MB). Firebase Auth/Firestore/Cloud Functions backend; 27 Vercel serverless functions in `RoweOS/dist/api/`; Stripe billing; Resend email; user-owned AI provider keys (Anthropic/OpenAI/Google) stored client-side with direct browser→provider calls. Vitest suite (TypeScript) over service facades.

| Path | What it is |
|---|---|
| `src/js/core/` (53 files, 151K lines) | All app logic; numbered load order; god files: 22-firebase-sync (13.0K), 25-documents-lifeai (11.2K), 29-analytics-commerce (11.1K) |
| `src/js/late/00-api-bridge.js` (13.7K) | AI provider calls, streaming, mail/messaging |
| `src/css/`, `src/html/` | Concatenated styles + view markup |
| `RoweOS/dist/` | **Deploy root** (Vercel) — built index.html, api/, firestore.rules, vercel.json |
| `functions/` | Firebase Cloud Functions (runScheduledTasks 5-min cron, sync-v5 audit, tombstone GC) |
| `src/__tests__/critical/` | 21 test files, 3.2K lines — mostly sync-v5, stripe, engines |
| `scripts/pre-deploy-audit.sh` | Mandatory gate: version consistency, build, tests, ES5/pattern scans |

**Surprising:** `.git` is **20 GB** (1.42 GiB packed + bloat from committing the 10 MB built bundle + 58 MB RoweOS.zip every deploy — 2,007 commits). `package.json` version says 33.2.0 (stale vs v35.11). README badge says v22.7. `secrets/` holds a Firebase admin SDK key (correctly gitignored, never tracked — verified). Zero `integrity=` attributes on 15+ CDN script tags. `lint` script is a stub (`echo 'lint not yet wired'`).

---

## 3. Audit Report

Severity counts across all subsystems: **9 Critical · 24 High · 12 Medium · 3 Low** (deduplicated).

### 3.1 Security — the weakest dimension

**CRITICAL**
- **UID-in-body / no-auth pattern across 7+ serverless endpoints.** `gmail-proxy.js:40` verifies only that `roweos_users/{uid}` exists — any caller with a valid UID reads/sends the victim's Gmail. Same class: `resend-welcome.js:60` (admin claimed via hardcoded ADMIN_UID comparison, which is leaked in `newsletter.js:543`, `notify-signup.js:282`, `scheduler.js`), `push.js:15`, `social-post.js:10`, `social-auth.js:15` (stores OAuth tokens under any uid), `social-media.js:6` (unauthenticated Vercel Blob uploads on RoweOS's token), `create-portal-session.js:32` (any caller with a `cus_XXX` id can manage that customer's Stripe subscription). The correct pattern (Firebase ID token verification) already exists in `admin-delete-user.js` and `send-template-email.js` (v34.107) — it was never backported. *(fact)*
- **`api_key_pool` rules: `allow update: if request.auth != null`** (`firestore.rules:26`) — any signed-in user can reassign/corrupt pre-purchased paid API keys. *(fact)*
- **`access_keys`: `allow get: if true`** (`firestore.rules:5`) — unauthenticated read of customer email, tier, Stripe session/customer IDs by key string. `allow list: if request.auth != null` (line 7) lets any user enumerate the entire customer roster; same for `newsletter_subscribers` (line 60). *(fact)*
- **Unlimited free founder keys:** `newsletter.js:429` generates and emails a founder-tier access key to every unique email POSTed — no rate limit, CAPTCHA, or confirmation. Bypasses Stripe entirely. *(fact)*

**HIGH**
- **SSRF via email attachments:** `gmail-proxy.js:362` and `resend-welcome.js:181` call `fetch(att.url)` with zero validation (internal/metadata IPs reachable), while `fetch-site-meta.js` was properly hardened in v34.111 — the defense exists in-repo and wasn't reused. *(fact)*
- **XSS, four vectors, all reachable via AI output / prompt injection:** image alt text spliced back in *after* the escape pass (`20-ui-misc.js:5149`); Studio `renderTable` emits unescaped cells and the escaper exempts table tags (`13-studio.js:3640`); Library preview `contentEl.innerHTML = file.content` raw (`12-library.js:499`, plus unescaped `file.name` at :480); Bloom `marked.parse()` output straight into innerHTML with raw-content fallback in the catch (`16-bloom.js:1142, 1237`). *(fact)*
- `analytics.js:6` — wildcard CORS + caller-supplied projectId lets anyone query arbitrary Vercel projects with RoweOS's token. *(fact)*
- `email-response.js:50` — HMAC secret falls back to literal `'fallback-secret'`; forgeable survey responses if env vars unset. *(fact)*
- Social approval bypass `window._socialOutboxBypass` is a global cleared asynchronously (`18-social.js:1293`) — a concurrent scheduler `postToSocial()` in the same window can post without approval. *(fact)*

**MEDIUM:** access key + email logged plaintext to console (`22-firebase-sync.js:3469, 3625`); iCloud app-specific password still pulled from Firestore despite "device-local only" comment (`22-firebase-sync.js:11209`); `caldav-proxy`/`x-dm-proxy` usable as unauthenticated credential-testing proxies; Google API key in URL query params (Google's own constraint — mitigate later via proxy); no CDN `integrity` attributes.

### 3.2 Data integrity & sync

**CRITICAL**
- **`writeDB` stamps `roweos_last_sync` with `new Date().toLocaleString()`** (`09-state.js:65`). `mergeByTimestamp` (`10-sync.js:1359`) `parseInt`s it to `7`, which defeats the `isNaN` fallback and permanently bypasses the drop-stale-local-items branch — cloud deletions traveling through `mergeByTimestamp` are never enforced on any device that has run one `writeDB`. Every other callsite correctly writes `String(Date.now())`. One-line fix. *(fact)*

**HIGH**
- `flushPendingWrites` replays queued offline writes with hardcoded `{merge:true}`, ignoring `merge:false` (`09-state.js:449-453`) — offline todo deletions silently resurrect. *(fact)*
- Pulse goals snapshot drops local goals >10s old that aren't in cloud (`22-firebase-sync.js:3088-3096`) — permanent loss for offline-created goals. *(fact)*
- Automations snapshot rebuilds `roweos_scheduled_tasks` from **cloud-only** `cloudAutos` instead of the merged result (`22-firebase-sync.js:3048`) — locally-pending automations vanish from the scheduler. *(fact)*
- Conversations legacy history-blob merge has no tombstone filter (`22-firebase-sync.js:11565-11578`) — purged conversations resurrect from other devices. *(fact)*
- `var uid` re-declared mid-function in `loadFromFirebaseV2` (`22-firebase-sync.js:11265`) shadows the outer uid with a possibly-null value for the rest of the function. *(fact)*

**MEDIUM:** `deleteDBDoc` outer catch is empty (`09-state.js:271`) — silent tombstone/Firestore divergence.

### 3.3 Correctness — duplicate side-effects & state machines

**CRITICAL**
- **Cross-tab double execution of automations** (`30-automations-init.js:2850`): all running-guards are tab-local; two open tabs both read `lastRun=null` and both fire — duplicate posts/emails to real clients. *(fact)*
- **`runTaskNow` + scheduler loop have no re-entry guard** (`30-automations-init.js:4351, 2929`): `_schedulerRunningTaskIds` is set but never read at entry. *(fact)*
- **Unbounded recursive Gmail 401 retry** in `mailSendOutboxItem` (`00-api-bridge.js:1153`) — persistent bad token = infinite retry loop with duplicate-send risk. The CloudOutbox path already does it right (single `_retry` sentinel). *(fact)*

**HIGH**
- Client cloud-guard checks `lastExecutor === 'cloud'` but the Cloud Function writes `'cloud_running'` during execution (`30-automations-init.js:2854` vs `functions/lib/executor.js:77`) — co-execution window. *(fact)*
- `post` action `Promise.all().then()` has no `.catch()` (`30-automations-init.js:3385`) — a throw in the completion callback leaves the automation stuck "running". *(fact)*
- Cloud vs client first-run window mismatch for custom-frequency tasks (`functions/lib/scheduler.js:137` requires 0–30 min; client accepts any past time) — silently missed runs. *(fact)*
- Image-gen path in `runAgent` never resets `currentConversation` (`20-ui-misc.js:6572-6588`) — new image turns append to the previous session (the image-*edit* path at :6549 does reset; divergence). *(fact)*
- LifeAI/StandardAI missing-key error paths skip `classList.remove('sending')` / `setBlobState('idle')` (`20-ui-misc.js:7350, 7655`) — orb + button stuck forever; BrandAI path does it right. *(fact)*
- `_wsCallGPT` sends `web_search_preview` to `/v1/chat/completions` instead of `/v1/responses` (`00-api-bridge.js:11815`) — OpenAI web search silently broken and its 400 is misclassified as billing → wrong failover. *(fact)*
- **Broken paid feature:** `checkAndDeliverPurchasedApiKeys()` (`22-firebase-sync.js:9703`) queries `api_key_pool` which rules deny to non-admins — PERMISSION_DENIED swallowed by `.catch()`; "keys auto-activate on login" has never worked for customers. *(fact)*
- Stripe webhook pool assignment is read-then-write with no transaction (`stripe-webhook.js:509→519`) — two simultaneous purchases can be emailed the same key. *(fact)*
- Trial auto-revocation is client-side only; webhook handles only `checkout.session.completed`, no subscription lifecycle events. Changelog claims otherwise. *(fact)*

### 3.4 Performance & resource hygiene

- `writeLastRunById` → `saveScheduledTasks(allTasks)` → N Firestore writes per single lastRun update, called twice per run (`18-social.js:3030`, `30-automations-init.js:2372`) — 2N writes per execution. **High.** *(fact)*
- Zero `AbortController` in the 13.7K-line API bridge (grep-verified) — stalled provider streams hang forever, no cancel path. **High.** *(fact)*
- `_bloomPosts` unbounded on "Load More Seeds" (`16-bloom.js:1875`) — repeats the exact uncapped-gallery pattern behind the v34.121 OOM. **Medium.** *(fact)*
- `addAutoLabHistory` stores up to 200KB base64 per entry x 100 entries (`18-social.js:5307`) - 20MB theoretical vs ~5MB quota; code cap (50K) contradicts CLAUDE.md's documented 20K. **Medium.** *(fact)*
- Streaming readers never `releaseLock()` in a finally (`00-api-bridge.js:119, 181, 265`). **Medium.** *(fact)*
- `openModal()` stacks duplicate modal IDs, orphaning listeners and double-firing `onClose` (`08-foundation.js:1213`). **High** (correctness as much as perf). *(fact)*

### 3.5 Architecture & code quality

- *(judgment)* The concatenation build is a deliberate, working choice — not a finding. But the three god files (22-firebase-sync at 13K, 25-documents-lifeai and 29-analytics-commerce at 11K each) are past the point where the "duplicate function names silently overwrite" hazard CLAUDE.md warns about is a live risk on every edit.
- *(judgment)* The recurring failure shape across all seven reports is **dual-path divergence**: a fix lands on one of two parallel paths (v34.107 auth on 3 of 10 endpoints; SSRF hardening on 1 of 3 fetchers; retry guard on 1 of 2 Gmail paths; spinner cleanup on 1 of 3 provider branches; conversation reset on 1 of 2 image paths; tombstones on 1 of 2 conversation merge paths). CLAUDE.md documents the dual paths; nothing *enforces* them.
- `async/await` used throughout `src/js/late/` in violation of the stated ES5 rule (`00-api-bridge.js:91` et al.) — works, but means the audit script's ES5 scan can't be trusted for that tree. **Low.** *(fact)*
- Unguarded response parsing: `mailCallAI` Google path `parts[0].text` (`00-api-bridge.js:10206`), OpenAI path `.message.content` (:10194) — while the `_ws*` twins guard correctly. **Medium.** *(fact)*
- `_cachedUserTier` defaults to `'founder'` (`22-firebase-sync.js:3727`) — seconds-long paid-feature window for free users on every load. **Medium.** *(fact)*

### 3.6 Testing

*(judgment)* The 278-test suite is real but concentrated: sync-v5 facades, Stripe helpers, quiz/verifier engines. The riskiest code — `loadFromFirebaseV2` merges, scheduler due-time math, `formatMessageContent` escaping, serverless endpoint auth — has zero coverage. The ES5 bundle isn't imported by tests at all; only the TS `services/` facades are. Testing gap is the reason dual-path divergence keeps shipping.

### 3.7 Dependencies & DevEx

- CDN deps unpinned by hash (0 `integrity` attributes) — a CDN compromise is full XSS. **Medium.** *(fact)*
- Firebase SDK 10.13.2 (compat build), marked 9.1.6, chart.js 4.4.4 — serviceable, not urgent. *(fact)*
- `.git` at 20 GB from committing build artifacts + zip every deploy; clone/CI cost grows forever. **Medium.** *(fact)*
- No lint (stub script), no CI — the pre-deploy shell script is the only gate and runs locally. **Medium.** *(fact)*
- README (v22.7 badge, MIT badge vs private product) and `package.json` (33.2.0) contradict reality. **Low.** *(fact)*

### 3.8 Strengths (preserve these)

- **Pre-deploy audit ritual** (`scripts/pre-deploy-audit.sh`): version-consistency, build, tests, pattern scans, exit-1 gate. Rare discipline; the right chassis to bolt new invariants onto.
- **Stripe webhook crypto is textbook**: HMAC-SHA256, `timingSafeEqual`, raw-body, 5-min replay window.
- **Cloud Functions are cleanly secured** (scheduler-triggered, authenticated callables, no stray HTTP surface).
- **Sync v5 migration engineering**: envelopes, dual-write flags, daily drift audit Function, staged cutover — this is how you migrate a live sync layer.
- **Tombstone registry** (`22a-tombstones.js`) is the right abstraction; bugs found are paths that bypass it, not flaws in it.
- **Foundation storage layer**: JSON.parse consistently guarded, quota spill to IndexedDB, capped IDB memory cache (v34.118 lesson applied).
- **CLAUDE.md as institutional memory** — most findings were *predicted* by its gotchas; the codebase knows its own failure modes.

---

## 4. Improvement Strategy

**Theme 1 — One auth pattern, applied everywhere (closes ~40% of findings).**
Target: every serverless endpoint verifies a Firebase ID token via one shared helper; internal (cron/Function) callers use `CRON_SECRET`. Firestore rules lose all `if request.auth != null`-only grants on shared collections. Principle: *authentication is a property of the platform, not of individual endpoints.* Trade-off: stale open PWA sessions may fail one send until reload — acceptable vs. open Gmail access. Done signal: `grep -L verifyIdToken RoweOS/dist/api/*.js` returns only static/webhook endpoints; rules contain no bare `auth != null` write on shared collections.

**Theme 2 — Kill the silent data-loss one-liners (five fixes, one deploy).**
Target: `last_sync` numeric; `merge` option honored on replay; merged (not cloud-only) scheduler rebuild; tombstone filter on the history blob; wider offline grace + pending-writes check for pulse goals. Principle: *sync bugs are cheap to fix and catastrophic to keep.* Done signal: `runSyncV5Audit` stays at zero discrepancies for 14 days after the fixes; a regression test locks the `last_sync` format.

**Theme 3 — Idempotent side-effects.**
Target: cross-tab localStorage mutex + entry guard in `executeScheduledTask`; retry-depth on Gmail 401; `.catch()` on every side-effect chain; `cloud_running` recognized by the client guard. Principle: *anything that sends email or posts must be safe to call twice.* Done signal: double-tab manual test produces one send; grep shows no unguarded recursive retry.

**Theme 4 — Escape-by-default rendering.**
Target: the four XSS vectors fixed; a `sanitizeHtml()`/escape helper used at every innerHTML sink that carries AI/user content; pre-deploy audit gains a scan for `innerHTML` sinks fed by unescaped dynamic content. Principle: *AI output is untrusted input.* Done signal: audit script fails on new unescaped sinks.

**Theme 5 — Make the gate enforce the culture (deliberately last).**
Target: wire real lint, add the invariants above to pre-deploy-audit, start a slim CI (build + tests on push), stop committing the built bundle/zip (deploy from CI artifact) to halt .git growth. Trade-off: **not** proposing a bundler/framework migration, TypeScript rewrite, or splitting god files — wrong for a solo-maintained, working product; the concatenation build stays.

**Explicitly not fixing:** ES5→modern syntax migration (works fine); Google key-in-URL (provider constraint; revisit with a proxy later); heavy CDN deps; monolith architecture.

---

## 5. Task Plan

### Milestones

**M0 — Safety net (before the risky fixes):** T1 regression tests for `last_sync` format + merge-option replay; T2 smoke script asserting each API endpoint rejects unauthenticated calls (red first, green after M1).
**M1 — Critical security & correctness (this week):** T3–T10 below.
**M2 — High-leverage:** T11–T16.
**M3 — Quality/polish:** T17–T21.

### Task table

| # | Task | Files | Effort | Risk | Deps |
|---|---|---|---|---|---|
| T3 | Fix `roweos_last_sync` locale-string (one line) | 09-state.js:65 | S | Low | — |
| T4 | Honor `merge:false` in `flushPendingWrites` | 09-state.js:449 | S | Low | — |
| T5 | Sync-layer batch: merged scheduler rebuild, history-blob tombstones, pulse grace window, uid shadow, deleteDBDoc catch, iCloud pw pull | 22-firebase-sync.js | M | Med | T3 |
| T6 | Shared `verifyIdToken` helper + backport to 10 endpoints; client sends ID token; CRON_SECRET for internal calls | api/_auth-helper.js (new), 10 endpoints, api-bridge, 18-social, push callers | L | **High** (stale clients) | — |
| T7 | Firestore rules: lock api_key_pool update, access_keys get/list, newsletter_subscribers list | firestore.rules | S | Med (breaks broken-anyway key delivery; see T14) | — |
| T8 | Fix 4 XSS vectors (escape alt text, table cells, library preview, bloom markdown) | 20-ui-misc, 13-studio, 12-library, 16-bloom | M | Low | — |
| T9 | Idempotency: cross-tab mutex + entry guard + `.catch()` + `cloud_running` guard; Gmail 401 retry depth | 30-automations-init, 00-api-bridge | M | Med | — |
| T10 | SSRF guard on attachment fetches (reuse fetch-site-meta defense); remove `'fallback-secret'`; fix send-template-email CORS header | gmail-proxy, resend-welcome, email-response, send-template-email | S | Low | — |
| T11 | Rate-limit + confirm newsletter founder-key issuance | newsletter.js | M | Med | — |
| T12 | Chat state fixes: image-gen conversation reset, LifeAI/StandardAI spinner cleanup | 20-ui-misc.js | S | Low | — |
| T13 | `_wsCallGPT` endpoint fix + response-parse guards | 00-api-bridge.js | S | Low | — |
| T14 | Rebuild purchased-key delivery via `roweos_users/{uid}/pending_api_keys` written by webhook (transactional claim) | stripe-webhook.js, 22-firebase-sync.js | L | Med | T7 |
| T15 | Single-doc `lastRun` write (kill 2N write blast) | 18-social.js, 30-automations-init.js | S | Med | — |
| T16 | Stream timeouts (AbortController) + reader release in finally | 00-api-bridge.js | M | Med | — |
| T17 | Caps: `_bloomPosts` (80), autolab history (4K thumb / 20K text); `openModal` single-instance guard; social bypass token scoping | 16-bloom, 18-social, 08-foundation | M | Low | — |
| T18 | `_cachedUserTier` default `'free'` + eager fetch; mask key/PII console logs | 22-firebase-sync.js | S | Med | — |
| T19 | Stripe subscription lifecycle events → server-side trial revocation | stripe-webhook.js | M | Med | — |
| T20 | CDN `integrity` hashes; README/package.json version truth; wire lint; CI (build+test) | 01-cdn-and-boot.html, README, package.json, .github | M | Low | — |
| T21 | Stop committing dist bundle + zip; `git gc`/history strategy for the 20 GB .git | deploy.sh, .gitignore | M | **High** (workflow change — needs Jordan sign-off) | — |

### Quick wins (S effort, outsized impact)
T3 (one line, kills a critical), T4, T7, T10, T12, T13, T15, T18.

### Top-3 implementation sketches

**T6 — Endpoint auth backport.** Create `api/_auth-helper.js` exporting `verifyFirebaseToken(req)` (POST to `identitytoolkit accounts:lookup` with the service-account token, exactly as `admin-delete-user.js` v34.107 does; return `{uid, email}` or null) and `isInternalCall(req)` (`x-cron-secret === process.env.CRON_SECRET`). Each endpoint: derive uid from the verified token, delete every `body.uid`/`body.adminUid` read; admin = verified uid === ADMIN_UID. Client side: one `_authFetch(url, opts)` wrapper in the api bridge that attaches `Authorization: Bearer` from `firebase.auth().currentUser.getIdToken()`; swap all call sites. Gotchas: the Cloud Function scheduler calls `push.js` and the cloud-outbox flow server-to-server — those must send CRON_SECRET (update `functions/` env + redeploy Functions in the same window); stale PWA sessions lose sends until reload — ship client + server in one deploy and announce.

**T3+T5 — Sync batch.** `09-state.js:65` → `String(Date.now())`. In `22-firebase-sync.js`: swap `cloudAutos`→`_mergedAutos` at :3048; port the subcollection tombstone filter to the blob merge before :11580; widen pulse grace to 5 min **and** skip dropping any goal whose id is in `roweos_pending_writes`; rename inner `var uid`→`_socialUid` at :11265; fill the empty catch at 09-state.js:271 with the v34.107 warn pattern; delete the `icloudAppPassword` pull at :11209 (add a one-time FieldValue.delete migration). Gotcha: after the last_sync fix, previously-suppressed deletion enforcement turns ON — test multi-device before deploy; that's why T1's regression tests come first.

**T9 — Idempotency.** In `executeScheduledTask` entry: check+set `localStorage['roweos_task_lock_' + id]` = `Date.now()+300000` (skip if unexpired), and check `window._schedulerRunningTaskIds` before setting; clear both in every terminal path (add the missing `.catch()` at :3385 doing exactly what the `.then()` does for bookkeeping). Extend the guard at :2854 to `'cloud_running'` with the 15-min stale window. `mailSendOutboxItem(itemId, _retryCount)` — recurse only when `(_retryCount||0) < 1`. Gotcha: the localStorage lock must be cleared in the `.catch()` too or a crashed run blocks the task for 5 minutes (acceptable; it self-expires).

---

## 6. Open Questions (need Jordan)

1. **Stale-session tolerance for T6:** enforcing token auth breaks in-flight sends from stale open tabs until reload. OK to enforce immediately, or want a 7-day dual-accept window (log-only) first?
2. **Newsletter founder keys (T11):** is the friction-free founder signup an intentional growth funnel? If yes, rate-limit only; if no, add email confirmation before key delivery.
3. **Trial policy (T19):** memory says 14-day founder trial with auto-revocation "shipped" — it isn't server-enforced. Enforce now (some long-trial users would drop to free) or grandfather existing users?
4. **Git history (T21):** rewriting/pruning the 20 GB .git means a force-push and re-clone. Worth it now, or accept growth until a quieter moment?
5. **Imagen 4 retirement (2026-08-17):** remove the picker option in the next feature release? (~6 weeks out.)
6. **`analytics.js`:** is anything other than the Admin → Sites tab using it? If not, admin-token-gate it (T6 covers this).
