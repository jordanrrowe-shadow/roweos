# Brilliance / RoweOS Changelog

## v35.13 - Horizon personal finance planner integrated

Horizon (previously a standalone deployment at horizon-gamma-gules.vercel.app)
is now built into Brilliance as an admin-only view. The React SPA is vendored
at /horizon/ and embedded same-origin in a new Horizon panel, so its data
(localStorage key horizon_v1) lives under roweos.com.

- New sidebar item "Horizon" (grouped + expanded modes), visible to admin only;
  showView('horizon') redirects non-admins to Settings, mirroring the Admin
  panel gate.
- New HorizonBridge module (54-horizon.js): lazy iframe load (the React bundle
  does not load at app boot), cloud backup of horizon_v1 to
  roweos_users/{uid}/horizon/main on change (10s change-detection poll), and
  restore-from-cloud ONLY when local data is empty - cloud never overwrites
  non-empty local finance data.
- Import / Export / Full-screen toolbar: Import accepts the horizon_v1 JSON
  copied from the old standalone site's DevTools (different origin, so data
  does not carry over automatically); Export copies the blob to clipboard.
- Privacy gate: the Horizon bundle ships personal seed data, so
  /horizon/index.html now refuses to boot (redirects to /) unless opened
  through the admin-gated view or in a browser that already has horizon_v1.
  Also tagged noindex/nofollow.
- Routes /horizon, /horizon/, /horizon/* added to vercel.json ahead of the
  SPA catch-all.

## v35.12 - Security + data-integrity hardening (audit pass)

Full principal-level audit at docs/audits/2026-07-07-principal-audit.md. This
release ships the low-risk Critical/High fixes from that audit. Higher-risk
items (serverless auth backport, key-delivery rework, trial revocation, git
history) are flagged in the audit's Open Questions and deferred pending
decisions.

Data integrity (sync):
- roweos_last_sync was stamped as a locale string ("7/7/2026, 3:45 PM"), which
  mergeByTimestamp parsed as the integer 7 - permanently disabling the
  drop-stale-local-items branch and thus cloud-deletion enforcement on that
  path. Now stamped as a millisecond epoch. This was the single highest-impact
  one-liner in the audit.
- Offline write replay (flushPendingWrites) honored a hardcoded merge:true,
  ignoring merge:false - so todo deletions made while signed out silently
  resurrected. Now honors the original write's merge option.
- Pulse goals snapshot dropped locally-created goals older than 10s that weren't
  yet in Firestore (permanent loss for offline-created goals). Grace widened to
  5 min and goals still queued in roweos_pending_writes are never dropped.
- Automations snapshot rebuilt the scheduler task list from cloud-only data,
  dropping locally-pending automations. Now rebuilds from the merged set (both
  the onSnapshot and full-pull paths).
- Legacy conversation history-blob merge had no tombstone filter, so purged
  conversations resurrected from other devices. Now applies the same chat
  tombstone filter the subcollection path uses.
- Fixed a function-scoped var uid re-declaration in loadFromFirebaseV2 that
  could null the outer uid during a token refresh.
- deleteDBDoc's empty outer catch now logs synchronous throws (was silent).

Correctness / duplicate side-effects:
- Automations could double-execute: executeScheduledTask set its running flag
  but never checked it at entry, and there was no cross-tab guard - so Run Now +
  the scheduler, or two open tabs, could each fire the same task and send
  duplicate emails/posts. Added an entry guard plus a self-expiring (5-min)
  localStorage cross-tab lock.
- The client cloud-execution guard only recognized lastExecutor 'cloud'; the
  Cloud Function writes 'cloud_running' during a run. Now honors both with a
  15-min window, closing the co-execution gap.
- The social post action's Promise.all().then() had no .catch(), so a throw in
  the completion callback left the automation stuck "running". Added recovery.
- Gmail send retried itself recursively with no depth cap on every 401 - an
  unbounded loop with duplicate-send risk. Capped at a single retry.
- OpenAI web search in the research pipeline was silently broken: the
  web_search_preview tool was POSTed to /v1/chat/completions (should be
  /v1/responses), and the resulting 400 was misclassified as a billing error,
  triggering spurious provider failover. Fixed the endpoint and response parse.
- Chat: image-generation on a fresh chat appended onto the previous session's
  conversation (missing reset the image-edit path already had). LifeAI and
  StandardAI missing-key errors left the orb and send button stuck (missing the
  cleanup the BrandAI path does). Both fixed.
- Guarded unchecked response shapes in mailCallAI (OpenAI .message, Gemini
  empty parts[]) that threw and looked like missing-key failures.

Security:
- XSS: escaped four sinks that render AI/user content - chat image alt text
  (bypassed the escape pass), Studio table cells (the escaper exempted table
  tags), Library file-name attribute, and Library document preview + Bloom
  markdown (new sanitizeAiHtml() strips script/style/iframe/event-handler
  vectors for the render-HTML cases).
- Firestore: api_key_pool update was allowed for ANY authenticated user (could
  reassign/corrupt pre-purchased paid keys); locked to admin (the only
  legitimate client updater is the isAdmin-gated release function; the webhook
  uses the service account).
- SSRF: email attachment downloads (gmail-proxy, resend-welcome) fetched
  arbitrary att.url with no validation (cloud-metadata reachable). Routed
  through a shared _ssrf-guard that blocks private/reserved ranges and
  re-validates every redirect hop (reuses the fetch-site-meta v34.111 defense).
- Removed the hardcoded 'fallback-secret' HMAC fallback in the email survey
  endpoints (forgeable responses if env vars were unset); now fails closed.
- send-template-email preflight now allows the Authorization header it requires.
- Stopped logging access keys and full emails to the browser console.

Performance:
- writeLastRunById called saveScheduledTasks, doing one Firestore write per
  automation - 2N writes per single run. Now writes only the one changed doc.
- Capped Bloom "Load More Seeds" at 80 posts (was unbounded - the v34.121 OOM
  pattern) and the autolab-history preview imageUrl at 8KB (was 200KB/entry,
  ~20MB at the 100-entry cap, causing a quota trim-and-retry loop).
- Modal system: openModal now closes any existing instance first (duplicate IDs
  orphaned listeners and double-fired onClose).

## v35.11 - Image generation restored + smart provider routing

Natural-language image generation broke on both mobile and desktop in
late June. Three separate causes, all fixed:

1. **Google retired `gemini-3-pro-image-preview` on 2026-06-25.** The
   ID was hardcoded in every Nano Banana path (chat SmartAI handler,
   Studio, Image Lab, Bloom, image scheduler, Social Hub), so every
   Google image call returned 404. All references moved to the stable
   IDs: `gemini-3-pro-image` (Nano Banana Pro) and
   `gemini-3.1-flash-image` (Nano Banana 2, replacing the long-dead
   2.0 experimental "Flash Image (Legacy)" options). A new
   `normalizeImageModel()` shim runs at every generator's API-call
   boundary so stale IDs still stored in automation configs, pipeline
   steps, chat model selections, and Image Lab prefs keep working
   without a data migration.

2. **The v34.108 written-deliverable bail-out was over-broad.** It
   rejected image intent for any prompt containing "post", "caption",
   "note", or "message" - so "generate an image for my Instagram post"
   silently fell through to the text LLM. `_detectImageGenIntent` now
   only bails when the prompt has NO unambiguous image noun (image,
   picture, photo, logo, poster, etc.).

3. **Provider routing ignored key availability.** Image requests now
   auto-route to whichever image API actually has a key, no matter
   which chat AI is selected: `_resolveImageProvider` skips a stored
   preference whose key is missing, the one-time provider picker is
   bypassed when only one image API is configured, and
   `_runChatImageGen` falls back across Nano Banana Pro -> Imagen 4 ->
   GPT Image 2 until one succeeds. The chat turn is labeled with the
   provider that actually generated the image.

Also in this release:

- `generateImageWithGptImage` upgraded from `gpt-image-1` to
  `gpt-image-2` (generation + edits endpoints).
- Imagen's `{ success: false }` error returns are surfaced instead of
  being swallowed into a generic "No image data".
- Pipeline image-step dropdowns replaced dead models
  (`gemini-2.0-flash-preview-image-generation`,
  `imagen-3.0-generate-002`, DALL-E 2/3) with Nano Banana Pro,
  Nano Banana 2, Imagen 4, and GPT Image 2.
- Model labels standardized to "Nano Banana Pro" / "Nano Banana 2".
- Heads-up: Google has deprecated the Imagen API (shutdown
  2026-08-17). The fallback chain already prefers Nano Banana, but the
  Imagen picker option should be removed before that date.

## v35.10 - Auto-recovery + auto-diagnostic (no console typing required)

v35.9 partially worked — the user's console showed
`[Storage] IDB reopened after connection-closing error; draining N
queued ops.` proving the `_idb*` shim recovery was firing. But:

1. **Firestore SDK UnknownErrors kept firing**, and the auto-disable
   threshold of 4-in-30s never tripped (likely because errors were
   spaced just outside the window).
2. **The user kept typing recovery commands without parentheses** —
   `purgeLocalCache` instead of `purgeLocalCache()` — so Safari
   returned the function source instead of running it. v35.9's
   recovery never actually executed.

**Fixes — both issues auto-resolve without console typing:**

1. **Lowered Firestore IDB UnknownError threshold from 4 to 2** and
   broadened detection: `name === 'UnknownError'` OR message contains
   `'Indexed Database server'` OR stack references `indexed_db` /
   `persistence`. Any one triggers the counter. After 2 fires the
   detector auto-runs `purgeLocalCache()` after a 5-second console
   countdown the user can cancel with `window._cancelAutoPurge = true`.
   Default is **RUN**. Persists `roweos_idb_persistence_broken=1` so
   future boots also start in safe mode.

2. **Auto scroll-diagnostic on every chat send.** v35.9's
   `showConversationView()` ran the nuclear inline-style enforcer but
   we had no evidence whether scroll worked because the user kept
   typing `brillianceScrollReport` without parens. Now
   `showConversationView()` schedules a 1.5s-delayed scroll check
   (after streaming starts) that logs ONE clear line:
   - `[ScrollAutoDiag] ... NOTHING TO SCROLL ...` → height/flex bug
   - `[ScrollAutoDiag] overflowY=... — scroll DISABLED by CSS.` → CSS bug
   - `[ScrollAutoDiag] thread CAN scroll. ...` → JS handler / gesture issue

No more reliance on the user remembering parens. v35.10 is the IDB
recovery actually doing what v35.9 wanted to do.

## v35.9 - IDB crash recovery + nuclear scroll enforcer

User's console finally surfaced the real memory cause:

```
Unhandled Promise Rejection: UnknownError: An internal error was
  encountered in the Indexed Database server
  at _poll (indexed_db.ts:356)
[SyncDB] Put exception: InvalidStateError: Failed to execute
  'transaction' on 'IDBDatabase': The database connection is closing.
[SyncDB] Put exception: InvalidStateError: ...        (× many)
[SyncDB] Put exception: InvalidStateError: ...
```

Both IndexedDBs were in failure loops:
- **Our shim's `RoweOS_Overflow` DB** — `_idbPut`/`_idbGet`/`_idbDelete`
  in `08-foundation.js:462` cached the DB handle in a module var. When
  Safari closed the connection (which it does under quota pressure or
  cross-tab eviction), every subsequent `_idb.transaction()` threw
  `InvalidStateError`. The catch swallowed it silently. Writes never
  persisted, sigs got out of sync, callers thought the write
  succeeded, and downstream code re-tried.
- **Firestore's own persistence DB** — `indexed_db.ts:356` (the SDK's
  internal poll loop) was raising `UnknownError` from the IDB layer
  on every iteration. Each iteration allocated a fresh retry buffer.
  This was the dominant 20-GB contributor, not the JS-heap fixes
  v35.5 attacked.

**Fixes:**

1. **IDB resilience in both shims.** `_idbPut`, `_idbGet`, `_idbDelete`
   and `_syncIdbPut` now detect `InvalidStateError`, drop the cached
   handle, reopen the DB via `indexedDB.open()` again, and replay
   queued operations from the in-memory queue. The kv shim already
   had `_idbQueue` for pre-ready writes; the new path reuses it for
   post-failure replay.

2. **Window `unhandledrejection` listener for Firestore's UnknownError.**
   These don't surface to snapshot listeners' `onError` callbacks —
   they bubble as unhandled promise rejections from the SDK's poll
   loop. Detected by `error.name === 'UnknownError'` plus a stack
   reference to `indexed_db` / `persistence` / `firestore`. Counter
   in a 30-second window; threshold 4 triggers auto-`disableLiveSync()`
   and a toast directing the user to `purgeLocalCache()`. Breaks the
   retry storm permanently.

3. **Inline-style scroll enforcer in `showConversationView()`.**
   After three CSS cascade fixes (v35.2, v35.3, v35.8) the user
   reports scroll STILL doesn't work. Bypassing the cascade entirely:
   ```js
   _thread.style.setProperty('flex', '1 1 0%', 'important');
   _thread.style.setProperty('min-height', '0', 'important');
   _thread.style.setProperty('overflow-y', 'auto', 'important');
   ```
   `setProperty(name, value, 'important')` writes inline `!important`,
   which beats any CSS rule regardless of source order or specificity.
   If a downstream JS handler is mutating the style, this re-enforces
   on every chat send. The same is applied to `#agentView` and
   `#agentConversation` so the flex chain can't be broken from above.

**User actions:**

If after a hard reload the tab is still heavy, run in console:
```js
purgeLocalCache()     // resets Firestore + shim IDBs, reloads
```
or
```js
disableLiveSync()     // stops cloud traffic without nuking caches
```

## v35.8 - Scroll cascade #3 + scroll runtime diagnostic

User reports scrolling STILL doesn't work in BrandAI/LifeAI chat after
v35.2 + v35.3. Per the systematic-debugging skill Phase 4.5 (3+ fixes
failed = question the architecture, stop adding more fixes), an Explore
agent dug specifically for runtime causes (JS handlers, dynamic style
mutation, wheel preventDefault) and CSS rules outside what I'd already
patched.

**Found:** a third overriding rule at `01-base.css:49049` inside
`@media (min-width: 769px)`:

```css
#conversationThread {
  overflow-y: auto !important;
  ...
  flex: 1 1 auto !important;   /* ← BREAKS scroll */
  min-height: 0 !important;
  padding-bottom: 16px !important;
}
```

`flex-basis: auto` sizes the flex item to its **content**, so on a long
conversation the thread expands to fit every message, the parent has
nothing to clip, and `overflow: auto` has no overflow to scroll. The
correct value is `flex: 1 1 0%` — what my v35.2/v35.3 rules already use
at higher specificity, but this oldest scroll-fix rule was stamping
`auto` back. Changed to `flex: 1 1 0%`.

**Also shipped: `brillianceScrollReport()` global.** I've shipped three
scroll fixes that didn't work because I was reasoning from source about
cascade winners. Stop guessing — read **computed** styles + offset/scroll
heights at runtime:

```js
brillianceScrollReport()
```

Prints `flex`, `flex-basis`, `min-height`, `overflow-y`, `position`,
`pointer-events`, plus `offsetHeight`/`scrollHeight`/`clientHeight` for
`#agentView`, `#agentConversation`, `#conversationThread`, then a
verdict: nothing to scroll (height issue) / overflow disabled / OK (look
elsewhere). If v35.8 still doesn't work, run this and the output tells
us where to look — no more guesses.

## v35.7 - Boot-time 20GB allocation + storage diagnostics

User reported "hit over 20 GB right off the bat" on a fresh load. That's
boot allocation, not gradual growth — distinct from what v35.5 fixed.

`loadFromFirebaseV2()` runs `Promise.all` of 45 Firestore reads at
boot, including `db.collection('chats').get()` which returns every
per-doc chat (multimodal base64 in each, no `.limit()`). On a long-
running account the chats subcollection can be GB-scale. The
Firestore SDK's offline cache hydration on top of that compounds the
allocation.

**Three fixes:**

1. **`loadFromFirebaseV2()` now honors `roweos_live_sync_disabled`.**
   v35.6 added the flag check to `setupRealtimeSync()` but left the
   boot pull unguarded — so `disableLiveSync()` plus a hard reload
   *still* hit the giant Promise.all. With the flag set, boot reads
   strictly from local cache and the tab opens with zero cloud
   traffic. Users with massive cloud history can now reach the app
   while we figure out the right paging strategy.

2. **`window.brillianceStorageReport()`** — async diagnostic. Iterates
   `localStorage` + the IDB-offloaded keys (tracked via `_idbKeys`),
   sums sizes, prints sorted descending. Tells us in seconds whether
   conversations / chats / library / inventory / gallery is the
   GB-scale offender instead of guessing. Run in Safari console:
   ```js
   await brillianceStorageReport()
   ```

3. **`window.purgeLocalCache()`** — nuclear reset. Clears all
   IDB-offloaded keys via `_idbDelete`, terminates Firestore and
   wipes its own persistence layer via `clearPersistence()`, reloads.
   Small localStorage keys (brands, settings) are preserved. Next
   boot does a clean cloud pull. Run in Safari console:
   ```js
   purgeLocalCache()
   ```

**Recommended sequence for the user with a bloated tab:**
1. `disableLiveSync()` — stops the network process growth
2. Hard reload — boot is now offline-only and fast
3. `await brillianceStorageReport()` — see what's actually huge
4. Decide whether to `purgeLocalCache()` (nuclear) or wait for v35.8
   (targeted query limits on `chats.get()` and similar)

## v35.6 - Brilliance Networking process growth (the OTHER memory bucket)

User reported the JS-heap fixes helped ("definitely better … much more
efficient") but the Safari **"Brilliance Networking" process** still
climbed to 3-5 GB on its own — *even idle*. That's WebKit's networking
process, distinct from the JS heap. v35.5's sig-skip cut JS heap
allocations but couldn't touch the SDK-internal CORS-failing
WebChannel sessions, which retain XHR request/response buffers in the
network process for the duration of every retry attempt.

The Firestore SDK retries failed long-polling sessions indefinitely.
Each retry has a fresh `gsessionid`, each fresh session has its own
buffers, each buffer sits in the network process until the session
either resolves or the SDK gives up (it doesn't, on CORS).

**Fixes:**

1. **Explicit user escape valves.** Two new globals:
   - `window.disableLiveSync()` — detaches all 8 snapshot listeners
     AND calls `firebase.firestore().disableNetwork()`, which is the
     SDK-level kill switch. Persists `roweos_live_sync_disabled=true`
     so the next page load doesn't re-attach.
   - `window.enableLiveSync()` — reverses both.

   Document banner during emergencies: type `disableLiveSync()` in
   the Safari console to drop the network process load immediately.

2. **Boot honors the toggle.** `setupRealtimeSync()` now returns
   early when the flag is set and tells the SDK to disable network
   before any session is established, so the user can return to a
   bloated tab, set the flag, hard-reload, and the network process
   never inflates again until they manually re-enable.

3. **Auto-detect.** New `recordFirestoreSnapshotError(label, error)`
   routes errors from the existing onError callbacks through a
   shared counter. After 6 errors in a 60-second window, auto-fires
   `disableLiveSync()` and shows a toast directing the user to
   `enableLiveSync()` when ready. Hooked into the root-doc listener
   for now; extending to the other 7 listeners is straightforward
   when we want broader coverage.

4. **`mobileBrand` removed from the brand-selector core list.**
   `coreSelectors[]` in `26-smart-suggestions-onboarding.js:4918`
   referenced `'mobileBrand'`, but `grep -rn 'id="mobileBrand"' src/`
   finds zero hits. Every `updateBrandSelectors()` call was logging
   `✗ Core selector not found: 'mobileBrand'` — 23 times per session
   in the user's screenshot. The id-without-element was pure noise.

## v35.5 - v35.4 regression + the actual dominant memory source

User reported the tab still at 20.48 GB after v35.4, with the console
showing `[StudioGallery] Cloud pull failed: TypeError: null is not an
object (evaluating 'cloudGallery.length')` repeating ~10x per minute.

**v35.4 regression.**
v35.4's pre-cap fix nulled `cloudGallery` for early GC immediately
after assignment to `_studioGalleryMem`. Four lines further down the
function still read `console.log('[StudioGallery] Pulled',
cloudGallery.length, ...)`. Every pull threw `TypeError: null is
not an object`, the surrounding try/catch swallowed it as "Cloud pull
failed", and the v35.4 pre-cap never took effect — meanwhile the
snapshot listener pull loop kept retrying. Captured `cloudGallery.length`
into `_cloudPulledCount` before the GC-aid nulling.

**The actual dominant 20-GB source.**
v35.4 attacked the gallery merge — the right pattern, but the wrong
collection. Conversations carry multimodal base64 (chat images live
here) and the cloud pull path at `22-firebase-sync.js:11122`+ runs:
```js
var cloudHist = JSON.parse(cloudHistJson);   // ← multi-GB
var localHist = JSON.parse(localStorage.getItem('roweos_conversations') || '[]');
var cloudById = {};                          // ← full set retained
cloudHist.forEach(...);                      // ← build merged
var merged = [];
cloudHist.forEach(...merged.push(conv)...);  // ← yet another copy
localHist.forEach(...);
setLargeItemIfChanged('roweos_conversations', JSON.stringify(merged));
```

For a user with hundreds of MB of conversations in cloud, that's
~1-2 GB of transient heap per pull. Multiplied by snapshot listeners
firing repeatedly under CORS retry pressure, and GC unable to keep
up, the heap climbed past 20 GB.

**Fix — signature-skip.**
Cheap signature compare on the cloud JSON string before any parse.
If the cloud doc bytes haven't changed since the last pull (the
common case in steady state), bail before any allocation. Stored on
`window._lastConvCloudSig` / `window._lastGalleryCloudSig`, cleared
naturally on full page reload.

Applied to both:
- Conversations (line 11128) — the dominant 20 GB cause
- Studio gallery (line 10546) — even with the v35.4/v35.5 pre-cap to
  50 entries, no point parsing them if cloud hasn't changed

When cloud HAS changed (only after the user saves a new image or
sends a new conversation), the parse runs once, pre-cap to 50 still
applies for gallery, and the merge proceeds normally.

**v35.4 fixes preserved (still in effect):**
- In-progress guard on `loadFromFirebaseV2` (prevents stacked pulls)
- 30s safety ceiling on the guard (no permanent wedge)
- Studio gallery pre-cap at 50 (bounds the post-parse merge)

## v35.4 - 25GB tab memory growth fix

User reported the roweos.com Safari tab at **25.33 GB** in Activity
Monitor with heavy memory pressure (20.89 GB used of 24 GB physical,
14.49 GB swap). Hard reload took minutes. Console showed repeated
Firestore long-polling CORS errors. This is the same memory-growth
class that v34.120 and v34.121 attacked; this release closes two
additional paths.

**Investigation followed the systematic-debugging skill** —
two parallel Explore audits and direct reads of the suspect files
before proposing fixes. Sync v5 (`35-sync-v5.js`) was investigated as a
possible culprit but is OFF by default and not contributing.

**Root cause #1 — Studio gallery cloud-pull merge runs uncapped.**

`loadFromFirebaseV2` reads the studio gallery doc from Firestore at
`/Users/jordanrowe/Developer/roweOS/src/js/core/22-firebase-sync.js:10502-10543`:
```js
var cloudGallery = JSON.parse(sgData.data);     // ← full historical
var localGallery = readStudioGallery();
var byId = {};                                  // ← full set retained
// ... merge ...
window._studioGalleryMem = merged.slice(-20);   // ← cap applied HERE
```

The v34.121 cap to 20 was applied **after** the merge. If the cloud
doc still contained historical gallery entries pre-cap (each can be
5-10 MB of base64), the merge temporarily allocated `cloudGallery
+ byId + merged + JSON.stringify(merged)` at full size — a few GB
of transient heap per pull. Under Firestore CORS retry pressure
those pulls fired back-to-back faster than GC could free them. Over
hours the heap climbed to 25 GB.

**Fix:** pre-cap `cloudGallery` to the newest 50 entries immediately
after `JSON.parse`, before any merge work. The persist-side cap is
20, so 50 gives plenty of margin for the merge while keeping
worst-case temp memory under 500 MB. Also explicitly nulls
intermediate references after the cap so they're eligible for GC
without waiting for function exit.

**Root cause #2 — `loadFromFirebaseV2` had no in-progress guard.**

Snapshot listeners and direct callers could re-enter
`loadFromFirebaseV2` while the previous Promise.all of 45 Firestore
reads was still pending. Each pending getter holds SDK request state
in memory until its CORS session resolves. Stacked pulls doubled this
state without freeing the previous.

**Fix:** `window._loadFromFirebaseV2InProgress` guard at the top
returns early on re-entry; cleared in both success and error paths
plus a 30-second safety ceiling so a hung pull can never permanently
wedge the next one.

**What v34.120 / v34.121 already shipped (still good):**
- `setLargeItemIfChanged()` / `idbPutIfChanged()` — write-if-changed
- Bloom thumbnail pre-cap + 6s defer + max-2-concurrent throttle
- Studio gallery `_studioGalleryMem` cap on the read-back side
- `scheduleCloudPull()` 1.2s debounce

The v35.4 fixes close the remaining historical-data hot path and the
stacked-pull amplification. After deploy the tab should stay in the
hundreds-of-MB range across long sessions instead of climbing into
GBs.

## v35.3 - Cascade bug, boot safety net, CDN 404s

User reported three issues from a Safari Web Inspector screenshot:
- 60+ second load time + memory pressure
- Still can't scroll the BrandAI chat after sending a message
- Console errors: Firestore CORS rejects on long-polling, plus 404s
  for docx and pptxgenjs CDN scripts

**Scroll — cascade conflict.**
The v35.2 mobile fix at `01-base.css` line ~41511 had `min-height: 0`
correctly, but a LATER mobile rule for the same selector
(`#agentView.conversation-active #conversationThread`, line ~43199)
came after it in source order with `flex: 1 !important` and NO
`min-height: 0`. Same specificity, later source wins — so my v35.2
fix was getting clobbered on every render. The flex item defaults to
`min-height: auto`, expands past its allocation, and the
`overflow: auto` scroll never engages. Added `min-height: 0 !important`
+ `flex: 1 1 0% !important` to the late rule + the matching late
`#agentConversation` rule so the fix actually wins the cascade.

**Boot — 10s safety timer.**
`loadFromFirebaseV2()` runs a `Promise.all([45 Firestore reads])` with
no timeout. When the long-polling channel rejects mid-stream (Safari
console: "Fetch API cannot load .../Firestore/Listen/channel due to
access control checks"), the Promise.all hangs indefinitely and the
boot screen (z-index: 99999 black overlay) is never removed. Added a
10-second `setTimeout` in `01-cdn-and-boot.html` that force-removes
the boot screen so the user reaches the app even when cloud sync
hangs. Background sync continues; merging happens whenever it lands.

**CDN 404s.**
- `docx@9.1.1/build/index.umd.min.js` returns 404. Actual published
  browser-friendly build is at `dist/index.iife.js`.
- `pptxgenjs@3.12.0/dist/pptxgenjs.bundle.js` returns 404. Actual file
  is `dist/pptxgen.bundle.js` (no `js` in the basename).
- Each 404 also tripped "Refused to execute" because jsDelivr returns
  `Content-Type: text/plain` for missing paths, which the `nosniff`
  header rejects. Corrected URLs eliminate both errors and let the
  Word / PowerPoint export paths use the proper docx library again
  (HTML-based `.doc` fallback in 11-agents.js stays as a backstop).

## v35.2 - BrandAI chat scroll + lag fixes

The main agent view (BrandAI chat) wouldn't scroll after sending a
message and was the laggiest surface in the app. Two root causes:

**Scroll**.
The chat is a flex chain: `#agentView > #agentConversation >
#conversationThread`. The desktop rule (`@media (min-width: 769px)`)
bounds `#agentView.conversation-active` to `height: calc(100vh - 60px)`,
which gives the flex chain a defined upper bound and lets
`#conversationThread` (`overflow-y:auto`) scroll. On mobile the
conversation-active rule was missing entirely — agentView had no height
constraint, the flex children grew to fit content, and scroll never
engaged.

A flex item with overflow:auto also needs `min-height: 0` to respect
its flex allocation when content overflows (the default `min-height:
auto` lets it expand past the allocation, eating the scroll). That
constraint was missing in the chain.

Fix: mobile rule for `#agentView.conversation-active` with `height:
100dvh; overflow: hidden`, plus `min-height: 0` and `flex: 1 1 0%`
across the flex chain (mobile + desktop), plus
`-webkit-overflow-scrolling: touch` and `overscroll-behavior: contain`
on the messages container, plus `padding-bottom: calc(140px +
var(--mobile-nav-height) + var(--mobile-safe-bottom))` on mobile so
bottom messages clear the fixed input bar.

Also: `renderConversation()` was unconditionally snapping the user to
the bottom after every full re-render. If the user had scrolled up to
read prior turns, every new chunk or new message yanked them back to
the bottom. Now captures `wasAtBottom` before the innerHTML wipe and
restores scrollTop only when they were already near the bottom
(matches the streaming smart-scroll guard, 150px threshold).

**Lag**.
`renderConversation()` rebuilds the entire history DOM on every call
and runs `formatMessageContent()` (which calls `marked.parse()`) over
every assistant message every time. On a 30-message history that's 30
markdown parses per call, and it's called 2-3 times per send.

Fix: cache the formatted HTML per-message on `msg._formattedHtml`,
keyed by `content.length:hasImageUrl`. Cache invalidates automatically
as streaming mutates content. Steady-state renders are now O(1) DOM
allocations vs O(N) markdown parses.

User messages and the streaming-message div remain re-parsed each call
(they're short and rare). Format result lives on the in-memory message
object, so it doesn't bloat localStorage / Firestore.

## v35.1 - Hotfix: disable esbuild minification

The v35.0 deploy minified the bundle via esbuild and broke sign-in:
clicking "Sign in with Google" raised `ReferenceError: Can't find variable:
handleGoogleSignIn`. The function declaration was preserved in the
minified output (verified by grep), so the actual failure was elsewhere
in the minified script block - esbuild's emitted pattern for some prior
construct prevented the block from parsing cleanly in WebKit at runtime,
which in turn left the rest of that block's top-level declarations
undefined.

The minifier is gated behind `MINIFY=1 bash src/build.sh` while the
offending pattern is being identified. All other v35.0 wins stay
shipped: Opus 4.8 swap, Scribe (Notebook) rAF deferrals + resize-handle
listener leak fix, Object URL revocation in 3 chat-export paths,
goal-modal keydown listener cleanup, and `defer` on 9 on-demand CDN
libraries. Wire size returns to pre-v35.0 (~2.4 MB gzipped) for now.

`scripts/minify-bundle.mjs` is unchanged - re-enable for local
experiments. Build.sh's behavior is now: minify only when `MINIFY=1`,
otherwise emit the unminified bundle and exit.

## v35.0 - Performance overhaul + Opus 4.8

The first major-version bump in the v34.x line. A perf-focused release
addressing three concrete user-felt problems plus the Anthropic Opus 4.7 -> 4.8
migration. Driven by four parallel Explore agents that audited the codebase
along distinct axes (notebook latency, boot/memory, listener/blob leaks,
build bloat). Spec at `docs/superpowers/specs/2026-06-01-v35-performance-overhaul-design.md`.

**Bundle minification (the single largest win).**
`scripts/minify-bundle.mjs` pipes the post-concat bundle through esbuild,
minifying each inline `<script>` block (JS, target=es2015, no identifier
mangling for globals) and each inline `<style>` block (CSS) independently.
Wire-size dropped from 10.4 MB to 6.9 MB (-32.8%). The unminified copy is
preserved at `RoweOS/dist/index.unminified.html` for incident debugging.
Skip with `NO_MINIFY=1 bash src/build.sh`. The minifier is run from `build.sh`
after concat; a failed minify reverts to the unminified source rather than
breaking the deploy.

**On-demand CDN libs deferred.**
`src/html/core/01-cdn-and-boot.html`: added `defer` to jsPDF, xlsx (SheetJS),
ical.js, Chart.js, html2canvas, docx, pptxgenjs, Three.js, and TinyMCE -
9 libs that are only invoked by user actions (export, chart render, Scribe
editor, etc.). HTML parser no longer blocks on these network downloads
during boot. Firebase, PDF.js, and marked.js stay synchronous because their
globals are accessed during inline script execution.

**Scribe (Notebook) typing-lag fixes.**
- `initScribeResizeHandle()` was stacking 6 listeners
  (mousedown/mousemove/mouseup/touchstart/touchmove/touchend) on every Scribe
  view entry, never removing them. Now caches handler refs and detaches the
  previous set before binding a fresh one.
- `scheduleScribeAutoSave()` now wraps the `saveActiveScribeNotebook()` call in
  `requestAnimationFrame` so the editor.getContent() walk + Firestore write
  never lands on the same frame as a keystroke.
- `saveActiveScribeNotebook()` sidebar list-item DOM mutation deferred to
  `requestAnimationFrame`.
- `updateScribeWordCount()` defers the editor.getContent({format:'text'}) DOM
  walk to `requestAnimationFrame` inside the existing 300ms debounce window.

**Memory leak fixes.**
- Object URLs from 3 chat-export paths (chat-selection, chat-sections,
  chat-clip in `20-ui-misc.js`) now call `URL.revokeObjectURL()` immediately
  after the synthetic `<a>.click()` resolves.
- `openGoalChatModal` keydown listener on the persistent `goalChatInput` is
  now cached on `window._goalChatKeydownHandler` and removed before each
  re-bind, so repeated modal opens don't stack handlers.

**Anthropic Opus 4.7 -> 4.8 migration.**
- New model ID `claude-opus-4-8` (announced 2026-05-28; same pricing as 4.7;
  4x lower flaw-pass rate; better agentic coding).
- Replaced `claude-opus-4-7` -> `claude-opus-4-8` across all dropdowns,
  registries, default-model selectors, streaming call sites, and the
  `agents-facade.test.ts` fixture. Touches 12 source files.
- Historical pricing + display name entries for `claude-opus-4-7` were
  preserved in `29-analytics-commerce.js` (both pricing and getModelDisplayName
  maps), `27-launch-brandai.js`, the `25-documents-lifeai.js` validModels
  whitelist, and the `00-api-bridge.js` model list - so old conversations and
  cost reports referencing 4.7 still render correctly.
- User-facing copy updated (analytics dashboard provider tile, About modal
  "Latest" caption, system About blurb).

**Deferred to follow-up:** CSS split (`01-base.css` is 1.57 MB), unused
@keyframes prune (~20 candidates), utility-function consolidation, list
virtualization for calendar/clients/automations, lazy `onSnapshot` listener
attach. These are tracked in the v35.0 spec.

## v34.121 - Fresh-restore boot hang (Bloom thumbnail fetch storm)

After v34.120, a user re-added the PWA (which wipes local storage/IndexedDB).
On relaunch the app does a FULL cloud restore with no local cache, ballooned
to 20.42 GB tab + a 4.73 GB "Brilliance Networking" process + 15 GB swap, and
hung at the launch/data-restore screen.

Three parallel analysis agents converged: **v34.120 was NOT the cause** (its
write-if-changed helpers are bounded, can't throw to callers, and the 1.2s
debounce only affects post-boot cross-device snapshots - boot uses a direct
loadFromFirebaseV2 call). The real culprit is a pre-existing **unbounded Bloom
thumbnail fetch storm** in the restore path:

```
// loadFromFirebaseV2, bloom_library restore - OLD
for (each cloud bloom item, every scope) {
  if (!localIds[ci.id] && ci.thumbnailUrl) {
    fetch(item.thumbnailUrl)...  // fired for EVERY item, simultaneously
  }
}
```

On a fresh restore `localIds` is empty, so EVERY bloom item across EVERY scope
fired a `fetch()` of its Firebase Storage thumbnail at once - and it downloaded
hundreds but kept only BLOOM_LIBRARY_MAX (15) per scope, because the cap was
checked *inside* the async callback after every fetch had already fired. That
is the multi-GB networking process and a main-thread livelock at boot.

Secondary: the studio gallery's in-memory mirror (`_studioGalleryMem`) was
uncapped on restore (the write path caps at 20), so a fresh restore held the
entire historical gallery in the heap.

**Fix.**
- Bloom thumbnails: collect a queue **pre-capped per scope** to the remaining
  slots (stop downloading hundreds to keep 15), then drain it **deferred ~6s
  past boot at max 2 concurrent** (`_drainBloomThumbnailQueue`). Read-only
  downloads, same storage writes under the same cap - only *when/how fast*
  changes.
- Studio gallery: cap the in-memory mirror to the newest 20 on restore,
  matching `persistStudioGallery`. The full set still goes to IDB; readers use
  the mirror.

The user's resident data is tiny (`agentCommands` 0.02 MB; all tracked caches
~3 MB), confirming the 20 GB was transient network/parse churn, not resident
base64 - so agentCommands stripping and Promise.all resequencing were
deliberately NOT done (unnecessary for this profile, higher risk).

## v34.120 - The real memory leak: per-pull base64 re-write storm

v34.118/119 capped the in-memory caches, but a user still reported the
tab at ~20GB (Activity Monitor showed the roweos.com tab at 13.82GB).
`brillianceMemoryReport()` told the real story: every tracked in-memory
cache totalled only ~3MB. agentCommands 0.02MB, _studioGalleryMem
1.18MB, scribeNotebooks 1.2KB. The GPU helper process was tiny, so it
was not WebGL. The console was the tell - it spammed, repeatedly, for
the same keys:

```
[Storage] Quota exceeded on key: "roweos_auto_lab_images" - offloading to IndexedDB
[Storage] Quota exceeded on key: "roweos_brand_1_logo" - offloading to IndexedDB
...
```

**Root cause.** `loadFromFirebaseV2` (the cloud pull) re-wrote large
base64 values to localStorage on EVERY pull, unconditionally:

- `roweos_auto_lab_images` was `_idbPut` to IndexedDB AND marked
  IDB-resident, then immediately written to localStorage with the SAME
  multi-MB JSON - a guaranteed quota-exceeded + re-offload, every pull.
- Every brand/life logo from the `brand_logos` subcollection was
  re-written to localStorage every pull.
- The per-profile logo "guard" `if (!localStorage.getItem(perProfileKey))`
  was broken: `getItem` returns null synchronously for >1MB IDB-offloaded
  values, so it re-wrote them every pull.
- `roweosLibrary`, `roweos_life_library*`, `roweos_conversations`,
  `roweos_bloom_library` had the same re-write-every-pull pattern.

localStorage sits permanently over its ~5MB quota, so each of those
writes threw `QuotaExceededError`, ran `_offloadLargestKeys` (re-reading
every eligible key), and re-offloaded to IndexedDB. The pull fires on
every root-doc `onSnapshot` (multi-device / multi-tab bursts), so the
app churned gigabytes of transient base64 strings plus in-flight IDB
transaction payloads - all invisible to `brillianceMemoryReport` because
nothing was retained in a tracked array. The Notebooks typing lag was
downstream: at 21.45GB used / 24GB physical with 10GB swap, the machine
thrashed and everything (TinyMCE included) lagged.

**Fix.** New write-if-changed helpers in `08-foundation.js`:

- `setLargeItemIfChanged(key, value)` / `idbPutIfChanged(key, value)` -
  write/offload only when the value actually changed, comparing a tiny
  persistent `<key>__sig` signature (length + sampled-char hash) instead
  of re-reading the giant value.
- `localStorageHas(key)` - true existence check that accounts for
  IDB-offloaded keys (fixes the broken `!getItem` guard).

`loadFromFirebaseV2` now routes the gallery, logos, library,
conversations and bloom writes through these guards, removes the
redundant `auto_lab_images` localStorage double-write, and snapshot-
triggered pulls are debounced (`scheduleCloudPull`, 1.2s) so a burst
coalesces into one pull. After the first post-deploy pull seeds the
signatures, subsequent identical pulls are no-ops - the
`[Storage] Quota exceeded` spam stops and the tab footprint stays low.

No behavior change for readers: the data still lives in IDB/localStorage
exactly as before; only the redundant re-writes are eliminated.

## v34.119 - More memory leaks + diagnostics

v34.118 capped the IDB shim memory cache, but the user reported tab
still around 20GB after that ship. Investigated other in-memory
caches.

**Mail outbox/sent caches.**

`_mailOutboxCache` / `_mailSentCache` held the full mail item
arrays inline including `html` (with embedded base64 images),
`canvasHtml` (rendered preview HTML), and `attachments[]` (with
data URI payloads). With 100 sent emails containing inline images,
this could easily reach 500MB-2GB just for these two caches.

Fix: localStorage stays the authoritative source of truth.
`getMailOutbox` / `getMailSent` now read from localStorage first
(full fidelity for renders), only fall back to the in-memory cache
if localStorage is briefly unavailable. The in-memory cache holds
a *thinned* copy: `data:image/*` URIs in `html` / `canvasHtml` /
`body` are replaced with `[image-stripped-from-cache]`,
attachment `data` / `dataUrl` / `base64` fields are dropped and
replaced with a `_strippedFromCache: true` marker. The thinned
cache is purely a safety fallback and never exposed to the UI as
the primary data source.

**Studio gallery cache cap.**

`_studioGalleryMem` was capped at 50 entries; each entry is a full
base64 dataUrl (typically 5-20MB). At full cap that's ~1GB in JS
heap. Reduced to 20. localStorage + IDB still hold the full
historical set so older entries persist; only the in-memory mirror
is bounded.

**New diagnostics.**

- `brillianceMemoryReport()` - prints a console.table of every
  known in-memory cache plus its size in MB. Shows which cache is
  actually holding the heap so future memory issues can be pinned
  down precisely.
- `brillianceFlushCaches()` - drops every in-memory cache. Data
  on disk is untouched; caches lazy-refill on next access. If
  memory drops dramatically after running this, the leak was in
  one of the flushed caches; if memory stays high, the leak is
  elsewhere (likely Three.js textures, DOM nodes, or
  Firebase persistence cache).

Run both from DevTools console.

## v34.118 - 18.51 GB Safari tab memory leak fixed

User reported the Brilliance tab using 18.51 GB of memory in
macOS Activity Monitor. Root cause: v34.111's `_idbMemoryCache`
eagerly hydrated **every** IDB-offloaded key into JS memory at boot
and held them indefinitely with no eviction.

With multimodal conversations (base64 image data URIs),
`roweos_library` files, and `roweos_auto_lab_images` commonly each
being 10-100MB, the cache could trivially exceed 10GB.

**Rewrite:**

- **No eager hydration.** The boot-time `_hydrateIdbMemoryCache` is
  gone. Cache is lazy-fill on first synchronous read miss only.
- **Hard 8MB total cap.** Once total cached bytes exceed the cap,
  LRU eviction kicks in.
- **1MB per-value cap.** Huge values are not cached at all - they
  live in IDB only. First sync read still returns null (the async
  fetch is fired); the second read after the next render/poll gets
  the localStorage-restored value.
- **Tracking arrays.** `_idbCacheLru` (touch-on-access ordering),
  `_idbCacheBytes` (running byte total). All updates funnel through
  `_idbCachePut` / `_idbCacheDelete` so accounting can't drift.

The original sync-null-on-first-read problem (the reason
`_idbMemoryCache` exists) is still addressed because most callers
of large keys are render loops or polling helpers that fire again
shortly after - and the lazy-fill or localStorage-restore path
serves those subsequent reads.

**Diagnostic:** `window._idbCacheStats()` returns
`{ keys, bytes, mb, capMb, perValueMb }` for inspection.

## v34.117 - Stop the bleeding: notebooks strictly preserved

Despite v34.115's safety guard and v34.116's recovery utility, user
reported notebooks kept disappearing - even ones created in v34.115
were gone after v34.116. Reduced the surface area drastically; every
write path that could mutate notebooks is now either strictly
additive or skips the cloud entirely when empty.

**1. `saveScribeNotebooks` skips cloud writes when empty.**

The localStorage write happens (a legitimate delete-last-notebook
still works locally), but the `writeDB('scribe/notebooks', ...)` call
is skipped if `scribeNotebooks.length === 0`. So a transient empty
in-memory state - whatever the cause - can no longer overwrite a
populated cloud doc. Cloud only receives writes that contain at
least one notebook.

**2. `recoverNotebooks` made strictly additive.**

The previous version replaced `scribeNotebooks` if recovered >
current, then pushed via direct `writeDB`. The new version unions
recovered ids INTO the current array, only adding missing ones,
never replacing or removing. The push to cloud goes through
`saveScribeNotebooks` (so the empty-skip guard above also applies).

**3. Auto-invoke removed.**

`initScribe` no longer auto-runs `recoverNotebooks` when the list
is empty. Recovery is manual only - run `recoverNotebooks()` in
the console. The auto-invocation combined with cloud-cache reads
created an edge case where stale Firestore cache state could be
pushed back to cloud, potentially overwriting newer real data.

**4. Backup-restore on init is purely local.**

The init-time backup-restore path no longer calls
`saveScribeNotebooks` (which would push to cloud). It just writes
the backup back to localStorage, leaves cloud alone. The next
legitimate save (any user action that mutates the list) will sync
via `writeDB` normally.

**5. Initial backup snapshot at view-enter.**

`initScribe` now writes a backup snapshot the first time the user
opens Notebooks if no backup exists yet. Users who never went
through a save in v34.115+ get a backup at view-enter time, so
future wipes have somewhere to restore from.

**Net effect**: there is no path in `33-scribe.js` that can push
an empty notebooks array to cloud. The only way notebooks can
disappear from cloud now is the user explicitly deleting every
last one through the UI - and even then, the cloud doc retains
its contents (the empty-skip means the next save goes nowhere).

## v34.116 - Multi-source notebook recovery

User reported the v34.115 backup-restore didn't bring their notebooks
back. Reason: the rolling backup snapshot was added IN v34.115, so it
didn't exist at the time of the original wipe. This release adds a
real recovery utility that scans every possible place a previous
notebook list might still live.

**`window.recoverNotebooks()`** - new function that scans:

1. **In-memory** `scribeNotebooks` (current state)
2. **localStorage primary** `roweos_scribe_notebooks`
3. **localStorage rolling backup** `roweos_scribe_notebooks_backup`
   (v34.115+)
4. **Pending-create breadcrumb** `roweos_scribe_pending_create`
   (v34.110+, single notebook)
5. **Other localStorage keys** matching `/scribe|notebook/i` whose
   parsed contents look like a notebook array
6. **Firestore cache** - reads with `{ source: 'cache' }`. Firebase's
   IndexedDB persistence retains the most recent server snapshot it
   has seen, so even if cloud was overwritten with an empty array,
   the cache may still hold the previous server snapshot from BEFORE
   the wipe propagated. **This is the most likely successful source
   for the user's wiped notebooks.**
7. **Firestore server** - direct cloud read for completeness

All sources are merged by id with conflict resolution by
`_modifiedAt`. If the recovered set is larger than the current
in-memory list, `scribeNotebooks` is replaced, localStorage is
updated, the backup is saved, and the result is pushed to cloud
via `writeDB` so other devices see the recovery propagate.

Per-notebook source map is logged to console so you can see exactly
which sources contributed which notebooks.

**Auto-invocation on init.** `initScribe` now runs
`recoverNotebooks()` automatically when both the primary list AND
backup are empty (with a `_scribeRecoveryAttempted` guard to prevent
loops). Catches users whose wipe predated v34.115's backup
mechanism.

**Manual invocation.** Type `recoverNotebooks()` in the browser
console at any time. Returns a Promise resolving to a report object
with `sources` (count), `sourceNames`, `recovered` (count),
`notebooks`, and `details` (per-id source attribution).

## v34.115 - EMERGENCY: notebook data-loss fix

User reported "all of my notebooks were removed" right after v34.114
shipped. Three problems compounded into total wipe:

**1. v34.114's `SetContent ExecCommand` listener.**

That listener registered `scheduleScribeAutoSave` on TinyMCE's
`SetContent` event. `SetContent` fires whenever
`editor.setContent()` is called - including inside
`selectScribeNotebook` when a notebook's saved content is loaded
into the editor. The autosave then ran ~1s later during the
TinyMCE init/notebook-select timing window and could write partial
or empty state. REVERTED: only `keyup change` schedule autosave,
no SetContent listener. Toolbar formatting and paste are still
covered because TinyMCE 7's `change` event fires for those.

**2. `mergeByTimestamp` silently dropping local items.**

`10-sync.js:1392` - when `firstSyncCompleted=true` AND a local
item exists that isn't in cloud AND its `_modifiedAt < lastSync`,
the merge silently DROPS the item, treating it as cloud-deleted.
This is fine for transient state, but for user-created content
like notebooks, it means a partial cloud doc (e.g. from an SDK
assertion mid-write that lost some entries) PLUS older local
notebooks results in cloud's reduced set replacing local on the
next merge.

Replaced the notebook merge specifically with a HARD union by id:
every local id PLUS every cloud id is preserved, conflict
resolution by `_modifiedAt`. Real deletes still work via
`deleteScribeNotebook` + the tombstone path; this passive sync
merge is now strictly additive. The general `mergeByTimestamp` is
unchanged for other categories where the silent-drop semantics may
still be appropriate.

**3. New rolling backup + restore.**

- `saveScribeNotebooks` writes a snapshot to
  `roweos_scribe_notebooks_backup` on every successful save with
  at least one notebook.
- A safety guard at the top of `saveScribeNotebooks` refuses to
  write an empty list when the backup has notebooks, restoring
  the in-memory `scribeNotebooks` from backup before continuing
  the save. So a runaway `[]` save can't propagate.
- `initScribe` reads the backup on startup if the primary list
  came up empty, and toasts "Restored N notebooks from backup"
  when recovery fires.

The backup approach respects intent: a real "delete the last
notebook" still produces the correct empty state because the
backup is only updated when the saved array has >=1 entry. After
a real final delete, the backup retains the last-known-good
state, but the next save with `length === 0` won't trigger
restore because the safety guard only fires when
`scribeNotebooks.length === 0` AND the backup is non-empty AND
the user didn't go through `deleteScribeNotebook` (which
doesn't go through this safety check by design).

**For users with already-lost data**: when they next open
Notebooks, the restore-on-init path will replay the backup if it
exists. If the backup was also wiped (worst case), they'll need
to look at their cloud Firestore directly via the admin console
or a previous device's local snapshot.

## v34.114 - Notebook typing lag actually fixed

v34.113's debounce on `updateScribeWordCount` wasn't the bottleneck;
the lag got worse, which means the real culprits were elsewhere.
Investigated systematically and found three:

**1. TinyMCE `wordcount` plugin running alongside our custom counter.**

`33-scribe.js:177` loaded the `wordcount` plugin into the TinyMCE
init. That plugin walks the entire document on every keystroke for
its own statusbar count - on top of our (now debounced)
`updateScribeWordCount`. Plugin removed from the list and toolbar.
We have our own counter; the plugin was pure overhead.

**2. `editor.on('change keyup', ...)` ran the handler twice per keystroke.**

Both `change` and `keyup` fire per character in TinyMCE 7, so the
single registration with two events meant the body ran twice -
double `scheduleScribeAutoSave` + double `updateScribeWordCount`.
Consolidated to a single `keyup` listener for the typing path; a
separate `SetContent ExecCommand` listener catches non-keystroke
changes (toolbar formatting, paste, drag-drop). That second event
batches in TinyMCE 7 and does NOT fire per char.

**3. `checkForMentionTrigger` ran unconditionally on every keyup.**

`initScribeMentions` had `editor.on('keyup', function() { ...
checkForMentionTrigger(editor); })`. The trigger check did
`editor.selection.getRng()` + read `container.textContent` +
`substring(0, cursorPos)` + `lastIndexOf('@')` on every single
keystroke. The `@` lookup costs scale with the size of the current
text node. Now gated: only invoked when `@` or `Backspace` was
pressed, or while the mention dropdown is already open and
filtering. Pure alphanumeric typing skips the work entirely.

## v34.113 - Notebooks auto-show on entry + typing lag eliminated

**Notebooks appear without clicking "New Notebook" first.**

`initScribe` reads localStorage synchronously, but on first device
login or fast tab-switch the cloud pull is still in flight - so
localStorage hasn't been populated and the empty list renders. Once
the user clicked "New Notebook", the resulting `writeDB` triggered
an `onSnapshot` listener → `loadFromFirebaseV2` → the notebook-merge
block, which silently updated `scribeNotebooks = _mergedNbs` but
never called `renderScribeNotebookList`. So the notebooks were
*there* in memory after the New Notebook click; the create path
just happened to be the only thing that re-rendered.

Fix: the merge block now calls `renderScribeNotebookList()` if the
`scribeView` is visible, so cloud-arriving notebooks paint as soon
as they land.

**Typing lag in TinyMCE editor.**

Visible ~1s lag per character on long notebooks. `updateScribeWordCount`
ran on every `keyup`, calling `editor.getContent({ format: 'text' })`
(a full DOM walk through TinyMCE's content tree) plus `split` +
`filter`. 50-200ms of work per keystroke. Word count is
informational, not realtime-critical - now debounced 300ms.

## v34.112 - "Synced from iOS" toast spam fix

Repeating "Synced from iOS" toast firing every second even when iOS
wasn't active. Two bugs stacked:

1. `loadFromFirebaseV2` runs on every `onSnapshot` tick + every
   `_v321ResolveDrift` call (added in v34.110 to actually resolve
   "Aligning…" rows) + every manual sync. The cross-device toast
   had no dedupe, so every pull re-toasted.
2. The cross-device detection looked at the brand doc's stored
   `_deviceId` field. If iOS had *ever* touched a brand, the doc
   permanently carries `ios_xxxxx` - so every subsequent pull on
   web saw "iOS as the last writer" even when iOS hadn't run for
   hours.

Fixes:
- Require `profile.meta.lastSyncAt` to be within the last 60
  seconds before toasting, so a stale `_deviceId` baked into a
  brand doc can't trigger.
- Per-device 5-minute cooldown via `window._lastSyncToast.byDevice`
  so a genuine burst of cross-device pushes only toasts once per
  device per cool-down window.
- `cloudLastSync` variable now captured alongside `cloudLastDevice`
  from `profile.meta`.

## v34.111 - Deferred audit cleanup: Firebase SDK upgrade, SSRF, email log, v5 paths, IDB shim

The set of items that had been deferred from cycles 1-3 of the
overnight audit, all in one batch.

**1. Firebase JS SDK upgraded 10.7.1 → 10.13.2.**

10.13.2 is the latest 10.x stable. Includes the fixes for several
"INTERNAL ASSERTION FAILED: Unexpected state" cases that were
landing in v10.7.1, plus newer transaction-queue robustness. Compat
mode is fully API-compatible across the 10.x line, so no API
changes were required - just the CDN URLs in
`01-cdn-and-boot.html`. The IndexedDB cache schema may migrate once
on first load (acceptable - cloud is authoritative).

**2. fetch-site-meta SSRF defenses rebuilt.**

The previous blocklist was incomplete and incorrect:
- Bare `172.` prefix matched 172.0-15 and 172.32-255 (NOT private)
  while missing the actual private range 172.16-31
- IPv6 loopback `::1`, link-local `fe80::/10`, unique-local
  `fc00::/7`, and IPv4-mapped IPv6 all bypassed the check
- Cloud metadata at `169.254.169.254` (returns IAM creds on
  AWS/GCP/Azure) was reachable
- `redirect: 'follow'` allowed an allowed public host to 302 you
  into any internal target

New defense: `isPublicHostname()` plus `fetchWithSafeRedirects()`.
- Rejects IPv6 loopback, link-local, unique-local, IPv4-mapped IPv6
- Full IPv4 reserved + private ranges done correctly: RFC 1918
  (10/8, 172.16/12, 192.168/16), loopback (127/8), link-local
  (169.254/16 incl. cloud metadata), broadcast (255), multicast
  (224-239), reserved (240+), 0.0.0.0/8, IETF reserved blocks,
  TEST-NET ranges
- Named-host blocks: `localhost`, `metadata`,
  `metadata.google.internal`, anything ending `.localhost`
- Manual redirect walker re-validates protocol + port + hostname
  on every hop (max 5 hops)
- Only http/https allowed; only ports 80/443 (or default)
- `Vary: Origin` already in place

**3. New /api/log-mail-sent endpoint for OAuth mail sends.**

Background: client-side Gmail/Outlook OAuth sends post directly to
`api.googleapis.com` / `graph.microsoft.com` - never our server -
so they never reached `email_log`. Admin Campaigns dashboard saw
zero of the user-routed sends.

Now: `handleSendSuccess` in `00-api-bridge.js` (the success
callback for outbox sends through Gmail/Outlook proxy) calls
`/api/log-mail-sent` with the recipient, subject, pipeline name,
and Resend ID (if any). Best-effort - swallows errors since the
mail itself already succeeded. The endpoint requires
`Authorization: Bearer <Firebase ID token>` (verified via Identity
Toolkit using the existing service account), then delegates to
`_email-log-helper.write()`. Field lengths capped to defend against
a hostile payload bloating email_log.

**4. Sync v5 Firestore paths corrected.**

Both audit findings about `users/{uid}/...` vs
`roweos_users/{uid}/...` namespaces. Fixed in 10 places:
- `mirrorV4Write` auto-registration fallback
  (`35-sync-v5.js:482`)
- 9 read-shadow `firestorePath` functions (automations, journal,
  folio, mail, pulse_goals, library, scribe, reminders, chats)

Previously, dual-write data and read-shadow comparisons hit a
parallel Firestore tree at `users/...` that nothing else
references. The 14-day zero-discrepancy clock the v5 audit
infrastructure tracks was always seeing 100% drift because it was
comparing the wrong path.

**5. IDB shim sync-null race fixed.**

`Storage.prototype.getItem` returned `null` synchronously for
keys offloaded to IndexedDB during a previous storage-quota
overflow. The async fetch only completed seconds later, but the
caller had already proceeded with `null`. Empty conversation
lists, library, agent_commands, and auto_lab_images on the first
second of every page load.

New `_idbMemoryCache` is hydrated as soon as `_idbReady` resolves
(replacing the prior 1s setTimeout), and `getItem` consults it
synchronously when localStorage is empty + the key is offloaded.
Cache eviction happens when the value is fully restored to
localStorage proper. Documented in `08-foundation.js` so the next
person to touch the storage shim doesn't undo it.

## v34.110 - Sync SDK assertion auto-recovery + lost-notebook recovery

Two related issues from a single screenshot session: (a) hitting Sync
showed "Sync failed: FIRESTORE (10.7.1) INTERNAL ASSERTION FAILED:
Unexpected state" then the inventory hung in "Aligning…" forever, and
(b) a notebook created in that session vanished after closing out.

**Sync error auto-recovery.**

`INTERNAL ASSERTION FAILED` is a known Firebase v10 SDK bug where the
IndexedDB transaction queue gets into an inconsistent state. The
existing retry path in `manualSyncNow` only caught `'terminated'`
errors. Now it also catches `'INTERNAL ASSERTION'` /
`'Unexpected state'` and runs the same recipe (call `clearPersistence`,
retry once after 2s). Toast text changed from the raw alarming
`Sync failed: FIRESTORE (10.7.1) INTERNAL ASSERTION FAILED…` to
`Sync hit a transient SDK issue, auto-recovering. Your data is safe.`
After retry exhaustion the post-retry message still tells the user
local data is safe.

**"Aligning…" actually resolves now.**

The Sync inventory was sitting in `Aligning…` permanently because
`window._v321ResolveDrift` and `window.forceAlignFromCloud_v321`
were referenced via `typeof === 'function'` checks but never defined
anywhere in the codebase. Both are now real:
- `_v321ResolveDrift` debounces 600ms then calls `loadFromFirebaseV2`
  and re-renders inventory. Single shared debounce so 20 drift cells
  on the same render don't fire 20 separate pulls.
- `forceAlignFromCloud_v321` returns `Promise.resolve()` (redundant
  with `manualSyncNow`'s own pull but kept so the chain doesn't break).

**Lost-notebook recovery breadcrumb.**

`createScribeNotebook` (`33-scribe.js:203`) now stamps
`roweos_scribe_pending_create` in localStorage with a full backup of
the just-created notebook. `saveScribeNotebooks` clears that
breadcrumb the moment a subsequent save confirms the notebook is
still in the array. `initScribe` checks the breadcrumb on load - if
the id is in the breadcrumb but missing from the loaded notebook
list, the notebook is restored from the backup and a toast confirms
"Recovered notebook from previous session".

This catches the rare "I made a notebook, closed out, it vanished"
path. Most likely root cause: the Firestore SDK assertion mid-write
leaves the in-memory `scribeNotebooks` empty before the next save
persists, then the empty array is what gets written on close.

**`beforeunload` flush.**

Belt-and-suspenders. `initScribe` now wires (once) a `beforeunload`
listener that flushes `scribeNotebooks` synchronously to
localStorage. Catches the case where TinyMCE's debounced autosave
hadn't fired yet when the tab closed.

**Note on what's NOT in this release.**

Two larger items that came up in the dissection are deferred,
both because they need careful testing across all 10 production
clients:
- Multi-tab Firestore contention is the most likely root cause of
  the SDK assertion. Adding `enablePersistence({ synchronizeTabs:
  true })` would fix it but is a coordinated rollout.
- Firebase SDK upgrade (10.7.1 → 10.13+) fixes several known
  assertion bugs but is a multi-day effort with regression testing.

## v34.109 - Reload lands on "Be Brilliant" splash for everyone

Reload always shows the branded splash now, not the sign-in form
directly. Reverts the v20.1 returning-user shortcut in
`07-early-inline.js` (the inline IIFE that ran before `showAuthGate`
could) and the matching v34.99 path in `22-firebase-sync.js`'s
`showAuthGate`. The Begin button still calls
`triggerGoldTransition()` which fades the splash and reveals
`authLogin` in one tap, so returning users still reach sign-in
quickly while seeing the welcome screen on every reload.

## v34.108 - Three usability fixes from the screenshot batch

**1. Native Workspace cross-device toast spam removed.**

The "Native Workspace is on for X on another device. Connect a folder
here in Settings → Native Workspace." toast was firing repeatedly
(7+ times in screenshots). Root cause: the `localPrompted` guard was
set inside a 4-second `setTimeout` callback in
`loadFromFirebaseV2`, but multiple Firestore pulls fire in quick
succession (page load + auth init + cross-device snapshot updates),
so each pull queued another deferred toast before any of them set
the flag.

Fix per user direction: removed the auto-toast entirely. The cloud's
last-folder-name is stashed in `roweos_native_fs_xdevice_name` on
each pull, and `refreshNativeWorkspaceUI` (Settings → Native
Workspace) now reads it inline. When the user opens that surface,
the description reads "Connected on another device as 'X'. Pick a
folder here to connect this device too, or change which folder."
No background notification; informed only on visit.

**2. Image-gen misroute on PDF upload fixed.**

Reproduction: user attaches a resume PDF + job description PDF, then
asks "please write a short paragraph as to why she's a good fit" -
chat shows "Generating image..." instead of producing the email.

Root cause: `classifyInteraction` (`11-agents.js`) used bare
`msg.indexOf(verb) !== -1 && msg.indexOf(noun) !== -1` for image-gen
detection. When PDFs are attached, the extracted file content is
concatenated into the user message. A resume + job description
almost always contains words like "design", "create", "icon",
"graphic" - so any prompt got flagged as image_generation.

Fix: aligned `classifyInteraction` with the stricter
`IMAGE_INTENT_RE` regex used by `_detectImageGenIntent`
(`20-ui-misc.js`) - requires verb and noun within 40 characters of
each other, not anywhere in the message. Also added an upfront
written-deliverable check: if the prompt mentions write / draft /
compose / email / paragraph / summary / outline / note / memo /
letter / message / caption / copy / article / post / tweet, image
classification is skipped entirely. Both detection sites
(`classifyInteraction` and `_detectImageGenIntent`) get the same
written-intent bailout so the chat-side intercept and the
provider-routing classifier agree.

The original phrase "create an image of X" still routes to image
gen as before.

**3. Mobile Quick Capture FAB UX.**

Three issues from the same screenshot:

a) **Drops ⌘ shortcut symbols on mobile rows.** Touch users have
no keyboard, so showing `⌘⇧T` / `⌘⇧G` / `⌘⇧R` / `⌘⇧N` next to each
row was decorative noise. Removed.

b) **Adds "New Chat" row at the top of the sheet.** Routes through
`startNewConversation` / `newConversation` / `clearChatDraft`
(whichever the build exposes) and falls back to `showView('agent')`.

c) **Lifts above the chat composer as the textarea grows.** The FAB
was anchored at `bottom: calc(70px + safe-area-inset-bottom)` -
fine when the input is one line, but a multi-line message bumped
the chat textarea up over the send button. New `_refreshFabBottom`
helper measures the active composer's `getBoundingClientRect` and
sets the FAB's bottom to clear it (capped so the FAB never floats
off-screen on tiny viewports). Listeners on `input`, `focus`, and
`blur` for both `agentCommand` and `followupCommand` keep it in
sync as the user types. A `transition: bottom 0.18s ease` on the
FAB itself smooths the lift visually.

## v34.107 - Audit Cycle 3: admin auth via Firebase ID token + sync hardening + server hardening

Methodical follow-on to v34.105 / v34.106. The biggest item here is the
admin auth refactor that closes the most severe finding from the
overnight audit; alongside it, six smaller server hardening items and
three sync-layer fixes.

**1. Admin endpoints now verify a Firebase ID token (Critical fix).**

Before: both `admin-delete-user.js` and `send-template-email.js`
accepted `callerUid` from the request body and compared it to the
hardcoded `ADMIN_UID` constant. Anyone who learned the UID (it's
referenced in 6 server files) could mass-delete any user's data,
revoke pool keys, or send arbitrary emails from `jordan@therowecollection.com`.

After: both endpoints require `Authorization: Bearer <id token>`.
The token is verified server-side via Identity Toolkit
`accounts:lookup` using the existing service account credentials
(no new dependency). Only the *verified* `localId` is checked
against `ADMIN_UID` - the body field is no longer trusted.

Three client call sites updated to fetch and attach the token:
- `25-admin-emails.js:1212` (`deleteUserEverywhere`)
- `25-admin-emails.js:1539` (`adminSendTemplateToUser`)
- `22-firebase-sync.js:8090` (composer interactive-templates send)

Token is short-lived and refreshed automatically by the Firebase
SDK; the `getIdToken()` call resolves quickly from the in-memory
cache when the previous one is still valid.

**2. V1 applyCloudData applies pulse goals tombstone filter** (`22-firebase-sync.js:2151`).

The V2 pull path (`loadFromFirebaseV2`) has always applied
`applyTombstoneFilter('pulseGoals', ...)` before writing
`roweos_pulse_goals`. The legacy V1 path (used by silent-restore
and some manual sync flows) was missing that filter, so any goal
the user deleted that still existed in the V1 root doc resurrected
on every V1 pull. Now wraps the data in the same filter.

**3. writeDBDoc empty catches now log to console.warn** (`09-state.js:200, 205`).

Two `} catch(e) {}` blocks silently swallowed Firestore write
exceptions and v4 mirror failures. With 10 paying production
clients and data integrity as the top priority, every silent
swallow is a debugging blind spot. Both now log a `console.warn`
with the path + error message.

**4. setApiKey JSON.parse safety** (`00-api-bridge.js:67-79`).

If `roweos_api_keys` was ever stored as a corrupted/non-object
value (sync collision, partial write, foreign code), the parse
threw and prevented every subsequent API key update for the
session. Now wrapped in try/catch with a shape guard so the next
set call writes a clean object.

**5. Knowledge engine Array.isArray guard** (`52-knowledge-engine.js:115`).

`_gatherPulse` called `goals.filter()` immediately on the parsed
storage value. A non-array value (corrupted localStorage, sync
collision) crashed the entire `BrillianceKnowledge.build()`
snapshot, which silently broke every AI call that uses the
preamble. Now coerces to `[]` if not array.

**6. feedback.js CORS allowlist** (`api/feedback.js:124-138`).

The previous comment said "feedback endpoint has no security
concern" and echoed `req.headers.origin || '*'`. But this endpoint
triggers admin email + push notifications on every call - any
third-party site could cross-origin POST it and spam admin
notifications with arbitrary content. Now allowlists
`roweos.com` / `www.roweos.com` / `roweos.vercel.app`; everything
else gets `roweos.com` as the allowed origin so legitimate app
traffic still works while drive-by spam is blocked. Added `Vary:
Origin` so any CDN cache stays correct.

**7. blob-proxy URL parsing hardening** (`api/blob-proxy.js:8`).

The previous check (`indexOf('blob.vercel-storage.com')` AND
`indexOf('roweos-social-')`) was bypassable - both substrings can
appear in a non-allowlisted URL (e.g. as query params). Now uses
`new URL()` and validates protocol === 'https:', hostname ===
'blob.vercel-storage.com', AND `pathname.startsWith('/roweos-social-')`
separately.

**8. track-click open-redirect guard** (`api/track-click.js:175`).

Previous guard only blocked absolute (http) and protocol-relative
('//') URLs. A relative path like `/admin` or `/../sensitive` was
let through. Now also requires the path to start with `/` and
rejects any value containing `..`.

**9. newsletter access keys via CSPRNG** (`api/newsletter.js:39-50`).

`generateAccessKeyString()` used `Math.random()` which is
predictable after observing a few outputs. The function generates
8-character access keys that grant Brilliance access. Now uses
`crypto.randomInt()` for cryptographically random selection,
matching `stripe-webhook.js` behavior.

**10. gmail-proxy outlook_exchange persists tokens** (`api/gmail-proxy.js:520-590`).

The Gmail OAuth `exchange` action calls `storeGmailTokens(uid, ...)`
to write to Firestore. The Outlook `outlook_exchange` action
returned tokens to the client without persisting, so users lost
their Outlook connection when switching devices or clearing
localStorage. Added `storeOutlookTokens` helper (mirrors the Gmail
path with `outlook_mail` doc key) and call it after the exchange.

**Notes on what's still open:**

- IDB shim async-returns-null for offloaded keys (foundation Critical)
  - structural fix; needs migration to `_idbGet` at every read site
- Sync v5 V4_PATH_RESOLVERS empty - causes auto-registration to wrong
  Firestore path; needs the resolver map populated
- mail email_log writer - Gmail/Outlook OAuth sends never log to
  email_log; needs new server endpoint
- fetch-site-meta SSRF allowlist - needs domain allowlist input
- Outlook calendar credentials still local-only via app-specific
  password in body; consider Firestore-encrypted storage

## v34.106 - Audit Cycle 2: XSS sweep + savePipeline class + Outlook 401 retry + standalone email logo

Continuation of the overnight audit. v34.105 shipped the 10 safest
surgical fixes; this release tackles the next four-item batch that
also has no breaking-change risk. The bigger items (admin auth
refactor, mail email_log writer, fetch-site-meta SSRF allowlist) are
still deferred pending design input.

**1. XSS sweep - 5 confirmed unescaped innerHTML sites closed.**

- `13-studio.js:3497` - `showHistory()` rendered `run.op + run.brand +
  run.time` straight into innerHTML. `run.op` can be a custom op name
  (user input), and AI-generated op names are also possible. Now
  passes all three through `escapeHtml`.
- `13-studio.js:4515-4532` - `printOutput()` writes `run.op` and
  `run.brand` into `document.write` for a print window. An op named
  `</title><script>alert(1)</script><title>` would have escaped the
  title and executed in the print window context. Both fields now
  escaped before the `document.write` calls.
- `13-studio.js:4237-4243` - `exportAs()` HTML export embedded the
  same fields raw. Recipient opens the file → script executes. Both
  escaped + a defensive `marked.parse(run.deliv || '')` so undefined
  deliv doesn't throw.
- `13-studio.js:3666` - `wordCount = run.deliv.split(...)` crashed
  on undefined deliv (video runs, pre-deliv legacy entries). Guarded
  with `(run.deliv || '').split(...)`.
- `20-ui-misc.js:2186` - day-view AI chat `renderAIChatSection()`
  rendered `msg.content` directly. `msg.content` is persisted in
  localStorage and replayed on every render, so an adversarial AI
  response containing `<script>` would re-execute every load.
  Stored XSS. Now extracts a string from `msg.content` (or
  `msg.displayContent`) and escapes both content + role.
- `00-api-bridge.js:11257-11261` - concierge row pill labels and
  values came from user-controlled localStorage data (goal titles,
  notebook names, resume conversation titles) and were rendered
  unescaped. Both fields now escaped; `p.icon` is module-controlled
  SVG and stays as-is.

**2. savePipeline now persists outboxFolder + research contextRef** (`17-automations.js:5762, 5786`).

Same class as the v34.103 logoAlignment bug: `collectPipelineStepData`
(called on every UI re-render) captured these fields, but
`savePipeline` (called when the user actually clicks Save Pipeline)
dropped them. Result: user picked an outbox folder or filled the
Research Instructions textarea, clicked Save, blank on next reload.
Outbox queued to root, research ran without the additional context.
Both saves added to the `action === 'outbox'` and `action ===
'research'` branches.

**3. Standalone email automation honors logo config** (`30-automations-init.js:3441-3471`).

When v34.103 fixed `includeLogo` and `logoAlignment` for the pipeline
email step, the *standalone* email automation executor was missed.
That executor (one of three email send paths in the scheduler)
always rendered the brand logo regardless of the user's toggle and
always used `'center'` alignment regardless of choice. Now reads
`task.config.includeLogo` (skipping the logo lookup entirely when
false) and `task.config.logoAlignment` and propagates both into
`window._studioEmailContext` before calling `generateBrandedEmail`.

**4. Outlook calendar write-back has 401 refresh-and-retry** (`14-calendar.js:5083-5170`).

Push, update, and delete to the Microsoft Graph API previously bailed
on token expiry. Push at least showed a toast; update silently parsed
the 401 JSON body as success and toasted "Outlook event updated";
delete bailed silently. Now all three call shared inner helpers
(`_doPushOutlook`, `_doUpdateOutlook`, `_doDeleteOutlook`) that on
401 refresh the token via the existing `refreshOutlookCalToken`
helper and retry exactly once. Update path also now checks `r.ok`
*before* parsing JSON so a 4xx no longer flows into the success
branch.

**Audit followups still deferred to v34.107+ (need design input):**

- Admin endpoints (admin-delete-user, send-template-email) accept
  `callerUid` from request body. Need Firebase ID token verification
  via Admin SDK or Identity Toolkit `accounts:lookup` REST. Asking
  for input on which approach to take given existing project deps.
- mail email_log writer: needs a new server endpoint that the client
  posts to after every successful Gmail/Outlook OAuth send.
- fetch-site-meta SSRF: needs allowlist of domains the AI is allowed
  to fetch metadata from + redirect re-validation.
- Sync layer: V1 applyCloudData missing tombstone filter, dual auth
  handlers, IDB shim sync read returning null - all 7 Critical
  findings from the foundation/sync subsystem still open.

## v34.105 - Audit Cycle 1: 10 surgical fixes from overnight 264-finding audit

Overnight full-codebase audit ran 12 parallel agents across ~229K LOC
(51 core JS + late JS + 25 server endpoints + HTML views). 264 raw
findings, deduplicated and validated to 86 actionable issues
(18 Critical / 38 High / 30 Medium). This release ships the 10 highest-
confidence surgical fixes that have no breaking-change risk. Larger
items (admin Firebase ID token verification, mail email_log writer
needing new endpoint, XSS sweep across studio/mail/scribe rendering,
savePipeline field-schema rewrite) are deferred to v34.106+.

**1. bloomSaveSignals respects life mode** (`16-bloom.js:166`).

The read path (`bloomGetSignals`) checked `roweos_app_mode === 'life'`
and used `roweos_bloom_signals_life_N`. The write path always used the
brand-derived key. Every like / save / filter applied in life mode was
silently lost on the next read because reads pulled from the life key
that had never been written to. Fix mirrors the exact branch from
`bloomGetSignals` so both paths agree on the storage key.

**2. Knowledge engine sees pinned thoughts** (`52-knowledge-engine.js:410`).

`43-thought-board.js` writes pin data to `roweos_thought_board`. The
knowledge engine was reading from `roweos_thought_board_pins` (no
match in localStorage anywhere). The AI's full-system knowledge
snapshot reported zero pins for every user regardless of how many
they had pinned. Read key changed to match the actual storage key.

**3. v5 brand bootstrap actually runs** (`35-sync-v5.js:945`).

`BOOTSTRAP_MAP` listed `lsKey: 'roweos_brands'` for the brands_v5
collection, but the canonical brand storage key everywhere else in
the codebase is `roweos_user_brands`. The brand bootstrap into v5
cache always read null. The 14-day audit baseline saw full
discrepancy. Changed to `roweos_user_brands`.

**4. Scheduler finds social tokens** (`api/scheduler.js:722-727`).

Try-2 fallback Firestore path was `users/{uid}/social_tokens/`. The
write path (`gmail-proxy.js:47`, `social-auth.js:48`) and every
client-side read use `roweos_users/{uid}/social_tokens/`. Try-2 was
always a 404, so when the in-profile token was missing, scheduled
social-post automations silently failed instead of recovering from
the per-user subcollection. Path corrected.

**5. confirmDeleteBrand uses saveBrands + deleteDBDoc** (`27-launch-brandai.js:2029`).

Direct `localStorage.setItem(USER_DATA_KEYS.brands, ...)` bypassed
the Firestore write-through, left the brand's individual Firestore
doc in place, and didn't update the `_all` doc. The onSnapshot
listener resurrected the brand on next sync. Now uses `saveBrands()`
plus an explicit `deleteDBDoc('brands', brand.id)` to guarantee the
cloud doc is gone before the next listener fires - per CLAUDE.md
sync rule "Brand deletion must delete Firestore doc IMMEDIATELY".

**6. importBrandData reaches Firestore** (`27-launch-brandai.js:2300`).

`saveToLocalStorage('brands', brands)` only hit localStorage, so
imported brands were silently overwritten on the next cloud pull
(cloud-authoritative). Now uses `saveBrands()` and also calls
`initBrandLogo()` + `initBrandAccentColor()` so the sidebar
visually catches up to the new brand without requiring a reload.

**7. Pipeline 'post' action honors approval guardrails** (`18-social.js:3657`).

`executeWorkflowStep` action `'post'` was calling `getSocialToken` +
`fetch('/api/social-post')` directly, never checking
`socialPostRequiresApproval()`, `_forceApprovalQueue`, or
`_socialOutboxBypass`. Pipeline-triggered posts published live
regardless of the user's "Require approval" toggle. Now mirrors the
exact pattern from `postToSocial()` and queues to the social outbox
when approval is required.

**8. postMessage origin allowlist** (`00-api-bridge.js:7699`).

The OAuth callback handler that writes Gmail/Outlook tokens into
`roweos_mail_config` never checked `event.origin`. Any page that
opened this app in a popup or iframe could inject arbitrary access
tokens, replacing the user's connected mail account. Now validates
against `[window.location.origin, 'https://roweos.com',
'https://www.roweos.com', 'https://roweos.vercel.app']`.

**9. Solo tier copy aligned to 14-day trial** (`02-shell-batch1.html:306, 317`).

Solo tier card and CTA button said "7 day free trial" while Founder
and Premium said "14 day". Project memory and CLAUDE.md both
specify the 14-day trial. Solo updated to match.

**10. Boot screen light-mode background** (`01-cdn-and-boot.html:45`).

The first paint script set `bootScreen.style.background = '#ffffff'`
when light mode is stored. The actual light-mode background is
cream `#f5f3ee`. Visible white-flash → cream transition on every
light-mode load. Switched the inline script to use `#f5f3ee`.

**Audit followups deferred to v34.106+** (high-impact, deeper changes):

- Admin endpoints (admin-delete-user, send-template-email) accept
  `callerUid` from request body with no Firebase ID token
  verification. Anyone who learns the hardcoded ADMIN_UID can mass-
  delete users or send arbitrary email from `jordan@therowecollection.com`.
  Needs `Authorization: Bearer <id_token>` flow + Firebase Admin SDK
  or Identity Toolkit verifyIdToken endpoint.
- XSS sweep: ~12 unescaped `innerHTML` sites across studio history /
  print / export, mail compose canvas, scribe knowledge thread,
  day-view AI chat, concierge row, sent detail. AI-generated content
  is the primary attack surface (prompt-injection → script execution).
- savePipeline field-schema rewrite: same class as v34.103
  logoAlignment fix, but extends to outboxFolder + research contextRef
  + standalone email automation executor honoring the same fields.
- mail email_log writer: needs a new server endpoint that the client
  calls on every successful Gmail/Outlook OAuth send so the Campaigns
  dashboard reflects sent count.
- fetch-site-meta SSRF: blocklist misses IPv6 loopback, 169.254.x.x
  cloud metadata range, redirect re-validation. Needs allowlist
  approach + `redirect: 'manual'`.
- Outlook calendar write-back missing 401 refresh-retry parity with
  Google.

## v34.104 - X scope fix + pipeline email mode-aware From + logo center save + iCloud signature FAQ

Four fixes from the v34.103 backlog continuation.

**1. X "Something went wrong" - DM scopes now opt-in.**

X OAuth was requesting `dm.read dm.write` alongside the standard
tweet/users scopes. Those DM scopes require X's elevated developer
access (Pro tier, $200/mo). Standard-tier developers have an X app
that doesn't include DM permissions, so the consent screen short-
circuited to "Something went wrong" before the user even saw the
permissions list.

`connectX()` now defaults to the universally-available scopes only:
`tweet.write tweet.read users.read offline.access`. Users with
elevated X access can opt-in to DM scopes via the localStorage flag
`roweos_x_request_dm_scopes=true`. The X DM features in the app
already had a "DMs require elevated API access" message at line 3780,
so the gating story is consistent.

**2. Pipeline email From dropdown is mode-aware.**

LifeAI pipelines were defaulting the From address to whatever brand
mail was set as the user's mail config default. So a life pipeline
that sent client emails read as "from Solo / Retreats / R&Co" instead
of "from your personal address."

New `getDefaultFromAddressForMode(mode)` in `00-api-bridge.js`:
- `mode === 'life'` → first connected Gmail or Outlook account
  (the user's personal mail). Returns with `gmail:` / `outlook:`
  prefix so the pipeline executor routes through the right OAuth.
- `mode === 'brand'` (or undefined) → falls back to the existing
  `getDefaultFromAddress()` (mail config's `defaultFromAddress`,
  then first Gmail, then first Outlook).

Both the email step and the outbox step in the pipeline builder UI
(`17-automations.js`) now call this with the current mode and label
the From dropdown with the active mode's default ("Life mode default:
your personal mail" / "Brand mode default: brand mail").

**3. Header logo "Center" alignment - now actually saves.**

`savePipeline()`'s `action === 'email'` branch was saving every
configured field for the email step EXCEPT `includeLogo` and
`logoAlignment`. Those were only collected by `collectPipelineStepData`
on every UI re-render, never on Save. So a user who picked "Center"
or unchecked the logo, then clicked Save Pipeline, would see the
choice disappear.

Both fields now saved in the Save path. Also, the outbox and
batch_email step executors in `18-social.js` now write
`logoAlignment` into `_studioEmailContext` (the email step already
did) AND honor `includeLogo === false` (only the email step did
this; outbox/batch_email always included the logo regardless of the
toggle).

**4. iCloud signature FAQ in Mail Settings.**

Auditing every branded template (`generateBrandedProfessional`,
`generateBrandedMinimal`, `generateBrandedBold`,
`generateBrandedNewsletter` in `22-firebase-sync.js`) confirmed: only
ONE logo render, in the header. The footer is text only ("Designed
& Sent from Brilliance" on Newsletter, blank on the other three).

So when a recipient sees a SECOND logo at the bottom of the email -
typically appearing in iCloud Mail recipients - that logo is
appended by iCloud Mail itself, not by our template. iCloud auto-
attaches a signature image when an account opens HTML mail.

New "Why does my email have an extra logo at the bottom?" section
added to Mail → Connections settings explaining this behavior with
the verification trick (send the same pipeline to a Gmail web inbox
and an iCloud Mail account; the iCloud copy will show the bottom
logo, the Gmail copy will not).

**Files touched.**

- `src/js/core/18-social.js` - `connectX()` scope reduction;
  outbox + batch_email contexts now include `logoAlignment`; outbox
  honors `includeLogo === false`.
- `src/js/late/00-api-bridge.js` - new
  `getDefaultFromAddressForMode(mode)` helper.
- `src/js/core/17-automations.js` - email + outbox step UIs use
  mode-aware default + show mode label in From dropdown;
  `savePipeline` now persists `includeLogo` + `logoAlignment` for
  email step.
- `src/html/shared/24-mail.html` - Mail → Connections gains the
  "extra logo at the bottom" FAQ section.

v34.103 backlog complete: all six items shipped.

## v34.103 - Onboarding success states + Google unverified-app helper

Two of six items from the v34.103 backlog. Calendar and Mail steps in
the onboarding flow now actually confirm a successful connection, and
the Google "unverified app" warning is explained inline so first-time
users don't bail at the consent screen.

**1. Calendar + Mail success state in onboarding.**

Before: connecting a Google / iCloud / Outlook calendar or a Gmail /
Outlook account during onboarding produced no visual confirmation. The
card stayed in its default state, the user couldn't tell if the OAuth
popup had actually wired anything up. Same problem on the Mail step.

Now: every connect card flips to a green border (`#22c55e`) once the
provider returns success, and the status row inside the card reads
`✓ Connected as user@email`. Sources:
- Google Calendar — pulls the connected email from the primary
  calendar in `_gcalCalendars` (calendarList API returns user email
  as primary id) once `fetchGoogleCalendarList` completes.
- iCloud Calendar — uses the Apple ID the user just typed in.
- Outlook Calendar — uses the email passed via the
  `outlook_calendar_connected` postMessage from `social-callback.html`
  (was already sent, just not wired into the onboarding card). Border
  was previously blue (`#0078d4`); now matches the rest at green.
- Gmail / Outlook Mail — postMessage handlers in `00-api-bridge.js`
  now also update `onboardingEmailGmailCard` /
  `onboardingEmailOutlookCard` and the `onboardingEmailGmailStatus` /
  `onboardingEmailOutlookStatus` spans (they used to just say
  "Connect" and never update). Connected email also pre-fills the
  Default From address input below if it's empty.

**2. Google "unverified app" helper text.**

Two new helper paragraphs (subtle gold-tinted info card pattern)
inserted under the Google Calendar connect button and the Gmail
connect card on the onboarding Email step:

> If Google shows an "unverified app" warning: click Advanced, then
> Continue. Brilliance is built by The Rowe Collection LLC and only
> requests the calendar / mail scopes shown on the consent screen.
> We are in active OAuth verification with Google (typically 4-6 weeks).

Frames the warning as expected, gives users the exact path past it,
and names the LLC so it doesn't look like a phishing app.

**Files touched.**

- `src/js/core/23-offline.js` — `connectOnboardingGoogleCalendar`,
  `connectOnboardingICloudCalendar` poll loops now write the connected
  email into the status div as bold text alongside the green check.
- `src/js/late/00-api-bridge.js` — postMessage handlers for
  `gmail_mail_connected`, `outlook_mail_connected`, and
  `outlook_calendar_connected` now reflect into the onboarding cards
  with green border + email label.
- `src/html/core/04-views-batch3.html` — added the two unverified-app
  helper paragraphs (Calendar step Google card + Email step Gmail
  card).

Backlog remaining for v34.x: X OAuth callback fix, pipeline email From
picker mode-awareness, header logo center alignment verification, and
the iCloud-signature FAQ note.

## v34.102 - Onboarding feature map, tier refresh, popup readability, admin From

Five fixes from the screenshot batch.

**1. Onboarding "What Brilliance Can Do" rebuilt for v34.x.**

Was anchored at the v25-era feature set (BrandAI / Pulse / Rhythm /
Library in Solo, Studio + Media Lab + Focus + Folio in Founder, Bloom
+ Brand Sharing in Premium). Showed Focus (RETIRED), missed Notebooks,
Evolve, Thought Board, Native Workspace, Universal Search, History
Timeline, Cloud Sync, People CRM, Bloom (now Founder, not Premium).

New layout:
- Solo: Chat, Pulse, Rhythm, Notebooks, Library, Universal Search,
  Identity, Analytics
- Founder: Studio, Automations, Mail, Social Hub, Evolve, Thought
  Board, Folio, Native Workspace, Bloom, Cloud Sync, History Timeline,
  People / CRM
- Premium: Brand Sharing, Private Onboarding, 15 Brands · 15 Lives

**2. Tour now force-refreshes tier before starting.**

User who just purchased Founder via Stripe was seeing tour gate as
"Basic" because `_cachedUserTier` had the pre-purchase value (5min
TTL). `startGuidedTour()` now calls `getUserTier(true)` synchronously,
then `updateSidebarTierLocks()`, before showing step 0.

**3. Founder Feature popup readability.**

When the upgrade modal fired from inside a guided tour, the tour's
backdrop AND the modal's own `rgba(0,0,0,0.6)` darken stacked to
~0.84 alpha — popup almost unreadable. Detect tour state via
`.tour-overlay, .tour-spotlight` query and use 0.18 alpha + 0px blur
when active, full 0.6 + 4px blur otherwise.

**4. Admin platform emails now send from `jordan@therowecollection.com`.**

User request. Updated From in: `send-template-email.js`,
`feedback.js`, `notify-signup.js`, `stripe-webhook.js`,
`info-signup.js`, `newsletter.js`, plus the scheduler pipeline
default. BCC moved to roweos@ for archival. Sidebar mailto links
also updated.

**5. Server scheduler email default flipped.**

`scheduler.js` had hardcoded `roweos@therowecollection.com` as the
fallback when a pipeline step didn't specify `emailFrom`. Now
`jordan@therowecollection.com` per the same admin email change.

**Still on v34.103 list:**

- Calendar/Mail success state in onboarding (green check after connect).
- Google "unverified app" warning helper text in onboarding (Google
  Cloud Console verification status; can document workaround).
- X "Something went wrong" OAuth callback investigation.
- Email step explicit "From" picker that respects pipeline mode.
- Header logo alignment "Center" rendering verification in actual
  emails sent.
- Bottom-of-email logo audit (likely iCloud Mail signature, want to
  confirm).

## v34.101 - What's New refresh + 4 new pipeline step types

**1. What's New modal refreshed.** Was anchored at v34.10 rebrand
items. Now lists the actual v34.78–v34.100 work users would care
about: Native Workspace, Brilliance Knowledge Engine, Evolve quiz +
verifier, Notebooks, Thought Board, History timeline, Pulse + Daily
Brief, 14-day Founder trial, Sync v5, Stripe checkout, Mail/Calendar
integrations, Universal Search, Keyboard Shortcuts, Slash commands,
Mobile Quick Capture FAB, PWA install prompt, Email observability,
light-mode polish.

**2. Four new pipeline step types** — extends `PIPELINE_STEP_TYPES`
+ `executeWorkflowStep`:

- **Notebook** (`action: 'notebook'`) — appends previous step's text
  output to a notebook in `roweos_scribe_notebooks`. Honors pipeline
  mode (creates with `source: 'lifeai'` for life-mode pipelines,
  `'brandai'` for brand). Finds-or-creates by title.
- **Bloom Save** (`action: 'bloom_save'`) — persists output as a
  Bloom seed in the brand-or-life scope of the pipeline.
- **Thought Pin** (`action: 'thoughtboard'`) — pins output as a card
  on Thought Board with random position. Source-tagged
  `view: 'pipeline'`.
- **Evolve Refresh** (`action: 'evolve_quiz'`) — clears the cached
  quiz pool and forces `QuizEngine.refillPool()`. Useful as a
  nightly cron alongside other prep.

All four write to localStorage AND `writeDB('profile/main', ...)` so
they sync across devices like every other surface.

## v34.100 - Automations audit pass 1: pipeline mode + history + success rate

User reported a LifeAI pipeline rendered "AppleCare" branding in the
output email, deep research failed silently with no history entry,
and the success rate showed 100% despite known failures. Audit
turned up four real bugs.

**1. Pipelines now honor their saved `mode` at execution time.**

`executeWorkflow()` was reading `workflow.brandIdx` and falling back
to the active `selectedBrand` (= AppleCare for Jordan), regardless
of whether the pipeline was created in life mode. So life-mode
pipelines were rendering with whichever brand happened to be active
in the sidebar.

Fix: `context._mode` is now derived from `workflow.mode`. Life
pipelines look up the life profile name from
`roweos_life_profiles[workflow.lifeIdx]` and skip the brand-DOM
logo grab entirely. Brand pipelines unchanged.

Also: `savePipeline()` now captures `lifeIdx` alongside `brandIdx`,
so the executor knows which life profile owns the pipeline (was
defaulting to 0).

Touched all three email-emitting branches: `action === 'email'`,
`action === 'outbox'`, `action === 'batch_email'`.

**2. Pre-flight failures now record an execution history entry.**

When `executeWorkflow` hit a missing-API-key preflight error
(common for Deep Research without a Google key), it would
`return Promise.resolve(...)` with no history call. So the user
saw a toast and then nothing — execution history kept showing
only old March entries because new failed runs never wrote.

Fix: preflight errors now write `addAutoLabHistory` AND
`addCompletedAutomation` with `success: false` and a clear
"Pre-flight failed: ..." summary. New runs visible immediately.

**3. Honest success rate.**

`successRate = (successCount / history.length) * 100` was treating
any entry without `success: false` as success — including ones
with `failedSteps`, error messages, or partial completions. Was
also defaulting empty history to "100%".

Fix: stricter `_isHistorySuccess()` check — entry counts as
successful only if `success === true` AND no `failedSteps` AND no
`error|errorMessage` AND summary doesn't contain /failed|error/i.
Empty history now displays "—" instead of lying with "100%".

**4. History entries tagged with `mode` and `taskId`.**

`addAutoLabHistory` now stores the originating mode (brand/life)
and the source task id. Used as a foundation for upcoming
mode-filter dropdown in v34.101 so users can scope history view to
brand-only or life-only when desired. Default view shows BOTH.

**Deferred to v34.101:**

- Step-type buttons need new entries: Notebooks, Bloom save,
  Thought Board pin, Evolve quiz refresh.
- Email step needs an explicit "From" picker that respects pipeline
  mode (right now defaults to active brand's address).
- Cloud scheduler needs verification that life-mode pipelines fire
  on schedule (server-side `runScheduledTasks` may inherit the
  same brand-fallback bug).

## v34.99 - Revert Safari redirect overreach + sign-out routing fix

Two emergency fixes after v34.97 / v34.98 caused new regressions on
regular (non-private) Safari Google sign-in.

**1. Reverted desktop-Safari-forced-redirect (v34.97).**

The "force redirect when Safari" branch was breaking sign-in for
everyone on regular Safari, putting them in a sign-in loop. Restored
the popup-everywhere flow that worked for months. Removed
`_isSafariDesktop`, `_maybeWarnIfPrivateBrowsing`, the watchdog,
the manual `handleGoogleSignInRedirect` link, the persistence
downgrade, and the auth-gate Private Browsing banner — all overreach.

iOS Safari still tries popup first and falls back to redirect on
storage error (v16.10 behavior, untouched). Mobile Android still
uses redirect (untouched).

The proper fix for Safari Private specifically — proxy
`/__/auth/*` through `roweos.com` so cookies are first-party — is
deferred. It requires a one-time addition of
`https://roweos.com/__/auth/handler` to the Google OAuth Console
redirect URIs before we can flip `authDomain` from
`roweos.firebaseapp.com` to `roweos.com`. Documented in
TODO comment at `21-sidebar.js:handleGoogleSignIn`.

**2. Sign-out routing bug.**

After sign-out, the auth gate showed up but appeared as a black
screen. Cause: `showAuthGate()` set `splash.style.display = 'flex'`
but didn't reset the `opacity: 0` and `transition: opacity 0.4s`
that were left behind by the original gold transition during sign-in.
Splash was technically present, just invisible.

Fix: `showAuthGate()` now explicitly resets splash opacity + clears
the gold-overlay transform state. Also: returning users (those with
local data — `roweos_brands`, `roweos_welcomed`, or `roweos_last_uid`)
now skip the splash entirely and go straight to the email/Google
login form. Matches the returning-user behavior in
`07-early-inline.js`.

## v34.98 - Safari Private: redirect succeeds but session lost on return

User reported v34.97's redirect flow now successfully redirects to
Google, but after Google sends them back to Brilliance, they land on
the Begin screen — not signed in. Loops forever.

Root cause is deeper than the popup-vs-redirect choice. Safari Private
Browsing does TWO things that break Firebase Auth:

1. **Partitions IndexedDB per-session.** Firebase stores its auth
   state in `firebaseLocalStorageDb`. When Google redirects back to
   roweos.com, the IndexedDB partition is treated differently and
   Firebase can't restore the session.
2. **Blocks third-party cookies on `firebaseapp.com`.** Firebase's
   redirect handoff sets a cookie on its auth domain
   (`PROJECT.firebaseapp.com`) — counted as third-party from
   roweos.com's perspective and silently dropped.

Result: Google authenticates the user, the redirect returns, but
Firebase has nothing to consume so `getRedirectResult()` resolves
with null and `onAuthStateChanged` fires with `user = null`. App
correctly routes them back to the auth gate.

**Three fixes:**

1. **Auth persistence downgrades to SESSION when Safari Private
   detected.** Probe `navigator.storage.estimate()` on Firebase init
   — Safari Private gives <200MB quota. When matched, switch from
   `Auth.Persistence.LOCAL` (IndexedDB) to `Auth.Persistence.SESSION`
   (sessionStorage). Less durable across sessions but actually works
   inside the session.
2. **Pending-auth flag now writes to BOTH sessionStorage AND
   localStorage**, with a reader that checks both. Some Safari
   versions clear sessionStorage between same-origin navigations
   in private mode; localStorage survives.
3. **Auth gate banner.** When Safari Private is detected on
   page load, an amber notice appears above the Continue with Google
   button: *"Private Browsing detected. Google sign-in often fails
   in Safari Private because the browser blocks the cookies Firebase
   needs. Use the 'Sign in with Email' option below, or open
   Brilliance in a regular Safari window / Chrome / Edge."*

The email + password sign-in path uses Firebase's email auth which
DOESN'T require third-party cookies — works fine in Private. The
banner steers users there directly instead of letting them loop on
Google.

## v34.97 - Google sign-in stuck loop on Safari (Private Browsing)

User reported: in Safari Private Browsing, "Connecting to Google..."
spinner stuck forever. Popup opens, user signs in, but the parent
window never receives the result and the gate stays at "Connecting…".

Root cause: desktop Safari has Intelligent Tracking Prevention (ITP)
isolating third-party storage on `accounts.google.com`. The popup
completes Google's side but the cross-origin postMessage handoff to
the opener window gets dropped, so `signInWithPopup`'s Promise never
resolves OR rejects. Worse in Private Browsing because storage
quotas are tiny and cookies are session-scoped.

Three fixes in `handleGoogleSignIn`:

1. **Desktop Safari now uses redirect flow.** New `_isSafariDesktop()`
   detects real Safari (has `Safari/`, lacks any Chromium marker, not
   mobile UA). When matched, we set the auth-pending flag and call
   `signInWithRedirect()` immediately — same flow we already use for
   iOS Safari. Redirect avoids the popup-postMessage problem entirely.

2. **Stuck-popup watchdog** for the remaining (Chromium desktop)
   popup branch. After 25s of "Connecting...", the auth-gate status
   morphs to amber: *"Connecting… looks stuck. Try the redirect
   flow."* with a clickable link. Calls a new
   `handleGoogleSignInRedirect()` that pivots to `signInWithRedirect`
   without losing the user's session.

3. **Private Browsing detection.** `_maybeWarnIfPrivateBrowsing()`
   reads `navigator.storage.estimate()` — Safari Private gives a
   <200MB quota. When detected, surfaces a warning toast on sign-in:
   *"Private Browsing detected. Sign-in may not persist between
   sessions."*

Also: handle `auth/web-storage-unsupported` and
`auth/cancelled-popup-request` error codes by auto-falling-back to
redirect, instead of just toasting an error.

## v34.96 - Safari fallback: gesture token + iOS detection fix

The v34.95 fallback didn't actually open a picker on Safari because of
two real bugs:

1. **Lost user-gesture token.** `toggleNativeWorkspace()` was awaiting
   `getRootName()` (an IDB read) BEFORE calling `connect()`. The
   `.then(() => connect())` runs in a microtask, after which Safari's
   gesture validator considers the click "stale" and silently no-ops
   the file picker. Fixed by hydrating an `_isConnectedSync` flag from
   IDB on module load and branching synchronously in the click handler.
   `connect()` (and its inner `input.click()`) now fires on the same
   JS task as the user gesture.

2. **iOS Safari claims `webkitdirectory` but ignores it.** The feature
   detection (`'webkitdirectory' in input`) returned true on iOS, so
   the code tried to open a folder picker that iOS WebKit doesn't
   actually implement. Added `_isIOS()` detection (UA + maxTouchPoints
   for iPad-as-Mac) and a separate `ios-files` variant that uses a
   plain multi-file picker (`<input type=file multiple>`). iOS users
   can now grab files from the native Files app / iCloud Drive
   instead of staring at nothing.

3. **Off-screen input rejection.** Some Safari builds reject file
   pickers on inputs positioned at `left: -9999px`. Moved to a
   visible-but-1px-opacity-0.01 footprint inside the viewport. Added
   `input.focus()` before `input.click()` for the same reason.

UX additions: `"Opening folder picker..."` toast fires immediately on
click so users know something happened, plus a clear error toast if
the picker fails to surface (was failing silently before).

Exports `NativeFS.isConnectedSync()` for callers that need a
synchronous answer (Settings + onboarding click handlers).

## v34.95 - Native Workspace Safari fallback (read-only)

Native Workspace now works in Safari, Safari PWA, iOS, and Firefox via
a `<input webkitdirectory>` fallback path. Read access works the same
as in Chromium; writes degrade gracefully to browser downloads.

**Two backends, auto-selected:**

- **`native`** (Chromium: Chrome / Edge / Brave / Arc / desktop PWA) —
  `showDirectoryPicker` + persistent `FileSystemDirectoryHandle` in
  IndexedDB. Full read + write + delete + permission grants survive
  reload.
- **`fallback`** (Safari macOS / iOS PWA / Firefox) —
  `<input type=file webkitdirectory>` opens the folder picker; the
  resulting `FileList` is cached in memory for the session. The cached
  Map of `path → File` powers `listDirectory`, `readFile`,
  `searchFiles`. Reset on tab close.

**Fallback behavior:**

- `workspace_list_directory` / `workspace_read_file` / `workspace_search_files`
  all work identically to native. The model can't tell the difference.
- `workspace_write_file` triggers a browser download with the suggested
  filename. The tool result includes a `note` field explaining the
  fallback so Claude tells the user to drop the downloaded file back
  into their workspace folder, replacing the original.
- `workspace_delete_file` returns an error explaining Safari can't
  delete from the page; user is asked to delete in Finder or switch
  to Chrome.
- The system prompt addendum surfaces all of this so Claude doesn't
  hallucinate write capability it doesn't have.

**UI updates:**

- Settings → Connections → Native Workspace shows "Connected
  (read-only): X · Y files cached this session" when in fallback mode,
  with the Permission and Trust rows hidden (not applicable).
- Onboarding step now shows an amber notice when on Safari explaining
  the read-only constraint and recommending Chrome / Edge / desktop
  app for full read+write.
- The `getBackend()` API exported on `window.NativeFS` lets callers
  inspect which path is active.

## v34.94 - Native Workspace: better not-connected guidance + path translation

When the user asked Claude to "pull files from /Users/.../Brilliance_Social_Campaign"
and the workspace wasn't connected (Safari / iOS PWA, or just hadn't been set up yet),
Claude said "I don't have filesystem access" and stopped. Two fixes:

1. **System prompt always includes Native Workspace status.** Even when
   the user has NOT connected a folder, the addendum now explains
   the feature exists and tells the model to direct the user to
   Settings → Connections → Native Workspace (or to use Chrome / Edge
   if their browser doesn't support it). When they HAVE connected,
   the addendum names the root folder explicitly.

2. **Absolute path normalizer.** `_normalizePath()` strips the host
   prefix when an absolute path contains the workspace root name.
   E.g. `/Users/jordanrowe/Downloads/Brilliance_Social_Campaign/foo.txt`
   → `foo.txt` when the workspace is the `Brilliance_Social_Campaign`
   folder. Saves the model a step and tolerates user copy-paste of
   Finder paths.

The addendum is now async (reads the IndexedDB handle to get the
root name) — call site in `callAnthropicStreaming` updated to await it.

## v34.93 - Native Workspace onboarding + cross-device sync

Made the v34.92 Native Workspace feature discoverable and persistent.

**New onboarding step.** Inserted between "Make it yours" and "Beta
Welcome". Explains what the feature does (search across files, read
files into chat, edit + save back), how it works (one folder, browser
sandbox, per-device handle, write confirmations), and lets the user
connect a folder inline with one click. Skip button always available;
copy reminds the user the feature can be turned on later from
Settings → Connections → Native Workspace.

**Cross-device sync.** The `FileSystemDirectoryHandle` itself is
per-device by browser security design — handles can't be transmitted
to the cloud. What v34.93 syncs to `profile/main.native_workspace`:

- `onboarded` (bool) — has the user seen the onboarding step?
- `onboardedAt` (ms) — when
- `lastFolderName` (string) — display name of the last folder they
  connected on any device, used in the cross-device prompt
- `mode` ('read' | 'readwrite') — their permission preference
- `lastConnectedAt` (ms) — when they last connected somewhere

On a second device, when `loadFromFirebaseV2()` pulls and sees
`native_workspace.onboarded === true` with a `lastFolderName`,
Brilliance shows a one-time toast prompting the user to connect a
local folder ("Native Workspace is on for 'X' on another device.
Connect a folder here in Settings → Native Workspace."). The prompt
is gated by `roweos_native_fs_xdevice_prompted` so it only fires
once per device.

Connecting, disconnecting, or changing the permission mode anywhere
pushes a fresh `native_workspace` record to Firestore so the picture
stays current across the user's devices.

## v34.92 - Native Workspace (file system tool calling)

Brilliance can now read, search, and (with confirmation) edit files
on the user's actual computer. Same family as Perplexity Comet's
"Connect to Computer" or Claude Cowork — but without leaving the
browser. Built on the File System Access API.

**New module: `52-native-fs.js`** (`window.NativeFS`)

- `connect()` — opens `showDirectoryPicker`, persists the
  `FileSystemDirectoryHandle` in IndexedDB so the grant survives
  reloads. Permission is re-requested via `requestPermission()` if
  the browser dropped it.
- `listDirectory(path)`, `readFile(path)`, `readImage(path)`,
  `writeFile(path, content)`, `deleteFile(path)`,
  `searchFiles({ query, includeContent })` — all paths are RELATIVE
  to the workspace root (the browser sandboxes everything else).
- Text reads cap at 512KB; binary reads cap at 256KB; both flag
  `truncated: true`. Images return data URLs.
- Searches skip dotfiles, `node_modules`, `.git`, `dist`, `build`.

**Tool calling**

Five tools exposed to the LLM with full JSON-schema specs:
`workspace_list_directory`, `workspace_read_file`,
`workspace_search_files`, `workspace_write_file`,
`workspace_delete_file`. Helpers `getAnthropicTools()`,
`getOpenAITools()`, `getGoogleTools()` return provider-shaped
definitions.

**Anthropic loop**

`callAnthropicStreaming` (in `13-studio.js`) extended to handle
the full `tool_use` → `tool_result` cycle. When the workspace is
connected, the request includes the tools array; when Claude emits
a `tool_use` content block, we parse the partial JSON, execute via
`NativeFS.executeTool()`, append a `tool_result` user message, and
continue the loop. Capped at 6 iterations to prevent runaway.
Each tool call is echoed inline in the chat as
`→ workspace_read_file({...}) ✓ done` so the user can see what's
happening.

**Safety**

- Writes and deletes always show a confirmation modal with the
  resolved path + content preview, unless the user grants
  session-trust ("Trust writes for this session" toggle).
- Permission mode is selectable (Read only | Read + Write).
- The capability addendum is only injected into the system prompt
  when a workspace is actually connected, so chat doesn't pay the
  token cost otherwise.

**Settings UI**

New "Native Workspace" section in Settings → Connections (above
Calendar Integrations) with three rows: Workspace Folder
(connect / disconnect), Permission (read | read+write), Trust
writes for this session.

**Browser support**

Chromium (Chrome, Edge, Brave, Arc, Opera, Brilliance desktop PWA).
Safari and Firefox don't expose the File System Access API yet —
the Settings row reads "Unsupported" and the tools aren't injected.

## v34.86 - Feedback modal + Privacy + Terms refresh

The Send Feedback popup was still anchored to the v20.x surface map
(Focus, no Notebooks / Evolve / Thought Board / Folio / Social /
Brilli / Knowledge / History) and the JS allowlist was even missing
Folio entirely — selection state was indexing the wrong card.

Refreshed both:

1. **Feedback modal** — area-card grid rewritten to match the v34.x
   Brilliance surface map. 26 surfaces total: Chat, Pulse, Rhythm,
   Studio, Notebooks, Evolve, Thought Board, Folio, Library, Bloom,
   Mail, Social, Automations, People / Clients, Analytics, Inventory,
   Identity, History, Brilli, Knowledge / Search, Notifications, Sync,
   Settings, Onboarding, Admin, Other. Focus retired (subsumed by
   Pulse). Header retitled "Send Brilliance Feedback". Description
   placeholder updated to a Brilliance-flavored prompt.

2. **JS allowlist sync** — `areas[]` in `22-firebase-sync.js`
   re-ordered in lock-step with the HTML cards. Documented the
   dependency so future edits don't drift the selection state.

3. **Privacy Policy (`/privacy`)** — last-updated bumped to
   2026-05-02. Added cards for Calendar / Mail Integrations
   (Google / Outlook / iCloud), Evolve (Quiz Engine + Verifier
   Engine), Brilliance Knowledge Engine, Push Notifications,
   Payments / Stripe, Transactional Email / Resend, Feedback
   submissions. Third-Party Services table expanded to include
   Microsoft Graph, iCloud CalDAV, Gmail API, Stripe, Resend, plus
   LinkedIn / TikTok and Facebook on the social side. Application
   Data card now lists every v34.x surface explicitly.

4. **Terms of Service (`/terms`)** — last-updated bumped to
   2026-05-02. Description of Service rewritten as a bulleted list
   covering all 13 surface families. "Free Beta Period" card retired
   and replaced with "Free Trial" (14-day Founder tier, no payment
   info required to start, auto-downgrade on expiration). Founder
   pricing card reframed as a pricing-lock for early-access
   subscribers (no longer "currently free"). New "Pre-Loaded API
   Keys" card explaining the one-time key purchases.

## v34.81 - Notebook layout, Practice refresh, sync gaps, Resume gate, calendar UI

Seven fixes in one ship:

1. **Notebook editor centering** — Letter Series mode was applying
   `max-width: 760px; margin: 0 auto` to the title input, tinymce
   wrap, knowledge panel, and tags row. On wide screens this looked
   right-shifted because the editor area is offset from the workspace
   center by the sidebar + notebook list. Removed the width clamp; the
   cream paper + serif content_style still gives Letter Series its
   feel without squeezing the column.

2. **Practice quiz refreshes against the active goal** — when the
   user's `targetGoal` or `knownContext` changes, `setProfile` now
   wipes the cached quiz pool + completed list and kicks a fresh
   `QuizEngine.refillPool()` against the new goal. Also added a
   "Regenerate" button to the Practice card and a stale-quiz check on
   render (if the cached quiz topic / citation / question doesn't
   reference any goal-related word, the pool is wiped before render).
   Fixes the "Learn Python" goal still seeing v5-sync questions.

3. **Resume pill gated by actual content** — was reading from
   `roweos_agentCommands` localStorage even when the in-memory
   `agentCommands` global hadn't loaded that index yet, producing
   "Could not find history item" toast on click. Now sources from
   `window.agentCommands` (same source `chatWithHistoryItem` reads
   from) AND filters out entries that don't have any conversation /
   response content to actually resume into.

4. **Thought Board + Evolve cross-device sync** — pin saves now
   write through to `profile/main.thought_board_pins`; pin pulls
   merge cloud + local by `_modifiedAt`. Evolve profile (goal,
   deadline, known context, XP, streak) writes through to
   `profile/main.evolve.profile`; pulls prefer cloud when
   missing locally or when cloud has higher XP/streak.

5. **Rhythm Life mode calendar parity** — Calendars panel toggle
   + Sync button added to Life Rhythm header (was brand-mode only).
   The shared `#calendarsPanel` div lives outside the mode gate so
   it now shows for both modes.

6. **Calendars list redesign** — both the Settings → Connections
   "My Calendars" list and the Rhythm Calendars panel reflowed to
   responsive grids of compact tiles (`auto-fill, minmax(180px, 1fr)`)
   instead of a single-column row list. Each tile is a card with
   color swatch + check + name + default-star, hover-bordered with
   accent. Mobile collapses to two columns.

7. **Evolve nightly automation dispatches the live pipeline** — the
   `_nextQuiz()` flow now marks the current quiz completed before
   advancing, so the pool actually rotates through new content.

## v34.80 - Studio config panel layout fix

The Studio task config panel was rendering the task title vertically
("Email Nurture Sequence" → 23 lines, one letter each) when an
operation was selected. Root cause: `showConfigPanel` (12-library.js)
was injecting a `#configAgentInfo` div with `flex-basis:100%; width:100%`
INSIDE the `.studio-v2-config-header` flex row. The no-wrap header
treated it as a 100%-wide flex sibling next to the title, which
squashed the title to character width.

Fix: insert `#configAgentInfo` AFTER the entire header (before the
config body) so it lives on its own row with its own padding +
border. The title gets its full `flex: 1` width back and renders
normally. As a side effect, the panel is no longer absurdly tall,
so the parent `.studio-v2-content` scroll works again.

## v34.79 - Evolve engines fully activated (Quiz + Verifier)

The Practice tab was still showing demo-card copy ("Multi-model
generation lands in v34 Sprint C") and the Verify tab said "v34
Sprint E adds the Gemini + GPT-5.5 Pro cross-review". Both were
shipped as scaffolds in v33.40 / v33.42 and never wired to real
LLM calls. v34.79 closes the loop:

**QuizEngine (38-quiz-engine.js)** — three live stages:
1. Stage 1 (Gemini): drafts a topic outline from the user's
   targetGoal + knownContext.
2. Stage 2 (Claude or GPT-5.5): turns the outline into a JSON
   quiz array (4 options, one correct, Why/Why-Not matrix,
   citation).
3. Stage 3 (validator): rejects malformed quizzes; valid items
   hit the 7-day pool.
Auto-activates with Evolve + a target goal. No flag opt-in.
Practice tab now pulls from the pool; falls back to the demo
bank only if the engine is disabled or unkeyed. Background
refill kicks in when the pool runs dry.

**VerifierEngine (39-verifier-engine.js)** — two live passes:
1. Pass 1 (Anthropic primary): claim-check with verdict + citations.
2. Pass 2 (Google or OpenAI, different provider): adversarial
   skepticism on Pass 1's output.
3. Synthesis: combines verdicts (verified / corrected /
   insufficient) and stitches citations from both passes.
Verify tab UI now shows the verdict badge, combined reasoning,
sources list with clickable URLs, and the model lineup +
confidence score.

**Nightly automation** — the `evolve_nightly_content` task
(scaffolded in v33.10 as disabled) is now enabled by default
once the user has a goal, fires at 03:00, and dispatches
`QuizEngine.refillPool()`. Migrates legacy disabled scaffold
entries on next load.

**Settings UI** — the two engine toggles flipped from opt-in
("Off by default") to opt-OUT switches with descriptive copy
of what each engine actually does. No more "Scaffold; activates
in v34" leak. Old `roweos_evolve_quiz_engine` /
`roweos_evolve_verifier_engine` enable flags retired in favor of
`*_off` disable flags so power users can still turn them off.

**Copy cleanup** — removed every "Sprint C", "Sprint E",
"v34 Sprint", "scaffold", and "Activates in" reference from
user-facing surfaces.

## v34.78 - Brilliance Knowledge Engine (full system awareness)

New module `src/js/core/52-knowledge-engine.js` exposing
`window.BrillianceKnowledge` with four entry points:

- `BrillianceKnowledge.build({ includeContent, maxBytes })` —
  returns a JSON snapshot of the user's current localStorage state
  across 18 surfaces (identity, pulse, reminders, automations, mail,
  people, notebooks, calendar, bloom, folio, library, studio,
  conversations, commerce, social, evolve, thought board, system).
  Soft-budgeted (default ~60KB / ~15k tokens), drops heaviest
  sections first when over budget.
- `BrillianceKnowledge.capabilities()` — capability manifest string
  describing every surface Brilliance can reason about and every
  action it can take. ~600 bytes, prepended on every model call.
- `BrillianceKnowledge.shouldAttach(query)` — heuristic: does this
  query look like a knowledge question (counts, status, lists,
  recent activity, "do I have", etc.)? If yes, attach the full
  snapshot.
- `BrillianceKnowledge.preamble({ ... })` — convenience wrapper that
  returns capabilities + snapshot as a single ready-to-prepend
  string.

Wired into:
- Universal Search `searchWithAI()` (27-launch-brandai.js) — replaces
  the old 4-source context with the full preamble. Single ⌘K query
  now reaches every surface.
- Chat dispatch — three paths in 20-ui-misc.js (LifeAI, standard
  brand provider, BrillianceServices.dispatch path). Capability
  manifest goes on every call, full snapshot only when the user's
  message looks like a knowledge query (so casual chat doesn't pay
  the token tax).

Honors mode (brand vs life), active brand index, life profile
index. Never exposes API keys, tokens, or access keys. ES5
throughout. No external dependencies.

## v34.77 - Light-mode --bg-elevated / --bg-tertiary cream-tint

Architectural follow-up to v34.76. Both `--bg-elevated` and
`--bg-tertiary` were `#ffffff` even after the v33.60 deepening pass,
so every elevated surface (cards, modals, popovers, panels — 16+
usage sites) painted as a stark-white slab on top of the cream
`--bg-primary`. Tinted both vars to `#faf7f0` / `#fbf9f3` so the
whole elevated stack inherits the workspace warmth automatically,
instead of patching individual rules forever.

## v34.76 - Light-mode stark-white slab cleanup

Five light-mode CSS rules that hardcoded `#fff` on wrapper containers,
painting hard white slabs over the cream workspace (the v33.60 deepened
palette assumed everything routed through `--bg-primary` etc.):

- `.evolve-translate-pane` — translate feature in Evolve
- `.evolve-translate-output` — translate output column
- `.auto-agent-preview` — automation builder preview card
- `.folio-card` + `.folio-card-preview` + `.folio-side-panel` — Folio surfaces
- `.scribe-voice-popover` — Scribe voice command popover
- `.folio-fullscreen-overlay` — full-screen artifact overlay tint

All swapped to cream tints (`#faf7f0`, `#f0ece2`) so they integrate
with the workspace instead of slabbing on top.

## v34.75 - Dashboard / Pipeline client-count alignment

The "Dashboard shows 9 clients but People Pipeline shows 0" mismatch
that's been on the backlog since the v31.19 hint banner shipped. Two
fixes:

1. `updateCommerceStats()` now reads `getClientsForBrand()` instead of
   `getClients()` so the Dashboard total matches the Pipeline view.
   Honors the existing "Show all brands" toggle.
2. The hint banner's inline "Show all brands" button was writing to
   `roweos_clients_show_all_brands` while the var initializer reads
   from `roweos_clients_brand_filter`. Two different keys meant the
   toggle didn't survive a page reload. Banner now writes to the
   correct key.
3. Brand-switch handler refreshes `updateCommerceStats()` when the
   Analytics view is active, so the count flips with the brand
   instead of staying stale until the user navigates away and back.

## v34.74 - Em-dash sweep follow-up

Pre-deploy audit was flagging 30 em-dashes in HTML; 27 were dev comments
(harmless), but three real user-facing sites had them: the Sync Hub
"Local Last Updated" placeholder (`shared/16-sync.html`), the Evolve
countdown placeholder (`shared/31-evolve.html`), and the admin email
signup-source label fallback (`25-admin-emails.js`). All three replaced
with ASCII hyphen so the rule "no em-dashes in user-facing copy" is
clean across the surface.

## v34.73 - Evolve + Thought Board font cleanup (round 2)

The v34.69 font fix only swept the selectors I'd grepped at the time. ~15 deeper rules slipped through (evolve-stats-value .num, evolve-stats-goal, evolve-empty-*, evolve-translate-*, evolve-quiz-*, evolve-context-*, evolve-skill-*, board-empty-*, board-card-*) all hardcoding `Georgia, serif` + italic, leaving Evolve and Thought Board feeling foreign next to Pulse / Studio / Library.

Rather than chase every selector, applied a single high-specificity override:

```css
#evolveView, #evolveView *,
#boardView,  #boardView * {
  font-family: inherit;
  font-style: normal;
}
```

The view-id specificity beats every per-class `Georgia, serif` declaration upstream, so every text element inside Evolve or Thought Board now uses the system default font like the rest of the OS.

The `promo-fonts` opt-in mode still flips headings (`h1/h2/h3`, `.panel-header`, `.evolve-stats-value .num`, `.board-card-title`, `.board-empty-title`) to Cormorant Garamond for users who explicitly turn that on in Settings → Appearance.

---

## v34.72 - LifeAI parity completion + gold tokens + a11y sweep

Closes the remaining 3 LifeAI parity gaps deferred from v34.71, lays the gold-token foundation, and ships a runtime accessibility sweep.

**Gap #6 — Life People Pipeline** *(`50-lifeai-features.js`)*
`renderClientsView()` now branches on `app_mode`. In life mode it calls `renderLifePeopleView()` which renders a 5-stage People-in-My-Life grid: Family / Close / Friends / Acquaintance / Mentors. Each card is clickable → opens a per-person modal with name, circle, role / relationship, notes. Backed by `roweos_life_people`; cloud sync via `writeDB('lifeAI/people')`. New `+ Add person` gold pill in the header. Brand-only chrome (Show all brands, category filter) is hidden when in life mode.

**Gap #9 — Custom Life Op generation** *(`50-lifeai-features.js`)*
New `window.openCreateLifeOpModal()` opens an inline composer with title + brief + category pull-down (Reflection / Planning / Health & Wellness / Finance / Learning / Relationships / Custom). On save, writes to `roweos_generated_life_ops` with `source: 'lifeai'`, `custom: true`, timestamps. Cloud sync via `writeDB('lifeAI/generatedOps')`. Surfaced from the Wellness dashboard's `+ Custom life op` button. Life users can now grow their op library the way brand users have always been able to.

**Gap #10 — Life Analytics dashboard (Wellness aggregate)** *(`50-lifeai-features.js`)*
New `renderLifeAnalyticsDashboard()` wraps the brand `renderCommerceView` — when `app_mode === 'life'`, the Analytics view auto-routes to wellness instead of commerce. Eight stat tiles aggregated from existing life data:
- **Streak** (consecutive days with at least one item completed, walking back from today)
- **Today** (items finished today)
- **Open goals** (active in life-mode Pulse)
- **Completed** (lifetime goals you've finished)
- **People** (`roweos_life_people` count)
- **Custom ops** (`roweos_generated_life_ops` count)
- **Library** (life library file count across all brand scopes)
- **Journal** (`roweos_journal` entries)

Plus an "Coming up" preview of the next 24h of due reminders. Header has the `+ Custom life op` shortcut. Dashboard is fully read-only against existing life data — no new storage required.

**Gap #348 — Brilliance gold tokens** *(`01-base.css`)*
Eight new canonical CSS variables in `:root` end the 405-occurrence hand-rolled hex sprawl:
- `--brilliance-gold-1` through `--brilliance-gold-6` (lightest gradient start to deep light-mode text)
- `--brilliance-gold-gradient` (the canonical CTA gold gradient `#e2c79b → #c9a961 → #a88a4a`)
- `--brilliance-gold-gradient-soft` (20%-alpha companion for hover / tint surfaces)

Future code should reference these tokens instead of inline hex. The mechanical sweep of existing usages can run any time without behavior change.

**Gap #349 — Runtime a11y sweep** *(`51-a11y-pass.js`)*
New module finds icon-only buttons (no visible text content, has `<svg>` or `<img>` child) that are missing `aria-label`, then synthesizes one from `title` → `data-action` → `id` → "Button" fallback. Runs on `DOMContentLoaded` and on a 2-second interval to catch dynamically-mounted UI (modals, lists, overlays). Plus explicit `aria-label` on the two highest-traffic standalone theme toggles. The existing v34.63 `role="dialog"` + `aria-modal="true"` + `aria-label` scaffolding on every v34.x modal remains the canonical pattern for new dialogs. Screen readers now announce every icon button correctly.

**Cumulative LifeAI parity status**
All 10 audit gaps shipped (#1-10) plus the one-sided border violation. LifeAI now has feature parity with BrandAI on every surface that matters: Folio, Scribe, Bloom, Automations, Identity, Mail, Pulse, Studio (custom ops), Clients (People Pipeline), Analytics (Wellness dashboard).

---

## v34.71 - LifeAI parity sweep (7 of 10 audit gaps shipped)

A background audit agent compared every BrandAI surface against LifeAI for parity gaps. 7 of the 10 HIGH-severity findings ship now; the remaining 3 (People Pipeline, Analytics dashboard, Custom Life Op generation) are feature builds deferred to v34.72.

**Gap #1 — Folio is no longer 100% brand-only** *(`17-automations.js`)*
`buildFolioChatSystemPrompt()` now branches on `app_mode`. In life mode it injects `buildLifeAISystemPrompt()` (life profile + focus areas + goals) instead of brand context. Folio item storage scoped: brand mode keeps `roweos_folio_items`, life mode uses `roweos_folio_items_life_<idx>`. Cloud doc path mirrors (`folio/main` vs `folio/life`) so brand and life folio outputs don't merge.

**Gap #2 — Scribe notebooks now tag mode correctly** *(`33-scribe.js`)*
Was: `source: (typeof currentMode !== 'undefined' && currentMode === 'lifeai') ? 'lifeai' : 'brandai'`. `currentMode` was undefined in this file AND the actual mode value is `'life'` (not `'lifeai'`), so every notebook was saved as `brandai`. Now reads `localStorage.getItem('roweos_app_mode')`. Plus `renderScribeNotebookList` adds a mode-source filter — life mode hides explicit `brandai` notebooks, brand mode hides `lifeai`. Untagged legacy notebooks survive in either mode.

**Gap #3 — Bloom storage no longer collides with brand 0** *(`16-bloom.js`)*
`bloomGetSaveKey()` and `bloomGetSignals()` previously routed every save through `brands[brandIdx]`, which fell back to brand 0 for life-mode entries. Life saves silently corrupted the first BrandAI brand's storage. Both functions now check `app_mode` first and emit a life-namespaced key (`roweos_bloom_saved_life_<lifeIdx>`, `roweos_bloom_signals_life_<lifeIdx>`) when in life mode.

**Gap #4 — Automations Lab filters by mode + auto-stamps mode at save** *(`30-automations-init.js`)*
`renderScheduledTasksList()` filters by `app_mode` so life users see only `_life`/`mode='life'` tasks (and brand mode hides them). `saveScheduledTasks()` stamps `mode` + `brand='_life'` on any task missing them at save time — covers every creation site without touching each `push()` call.

**Gap #5 — Life Identity 8 → 12 cards** *(`23-offline.js`)*
Four new cards added before the existing life-intelligence card: Digital Presence (social handles, sites), Bloom Preferences (personal feed cultivation), Automation Memory (recurring patterns LifeAI should learn), Photos & Visuals (Studio image-gen reference). Each is contenteditable + saves through the existing `saveLifeAIInsightField()` flow. Brand has 14 cards but several (products, competitive) don't apply to personal life — 12 is intentional life depth, not a bug.

**Gap #7 — Personal mail no longer carries a brand logo** *(`00-api-bridge.js`)*
Four brand-logo lookup sites in the mail pipeline (1685+, 5586+, 5693+, 7088+) now early-skip the `brands[]` fallback chain when `roweos_app_mode === 'life'`. User-uploaded `_mailTempLogo` is still honored. Personal life-mode emails go out clean — no brand 0 logo, no brand signature.

**Gap #8 — Pulse goals with undefined source no longer disappear from life view** *(`25-documents-lifeai.js`)*
The mode filter at `renderPulseV3` excluded any goal with `g.source !== 'lifeai'`, which is true for `undefined` — meaning legacy goals created before strict tagging silently disappeared from life view. Now treats undefined as belonging to current mode (life rejects only explicit `brandai`, brand rejects only explicit `lifeai`).

**Plus: one-sided border violation eliminated** *(`30-automations-init.js`)*
`border-left: 3px solid taskColor` on automation list rows violated the CLAUDE.md no-one-sided-borders rule. Replaced with a uniform `border: 1px solid var(--border-color)` plus a symmetric inset box-shadow (`inset 4px 0 0 + inset -4px 0 0`) using the task-color tint at 7% alpha. Color reads, card is symmetric.

**Deferred to v34.72 (feature builds)**
- **#6 Life People Pipeline** — Brand has clients pipeline; life mode has nothing. Will branch `renderClientsView` in life mode to render "People in My Life" with stages acquaintance/friend/close/family. ~3-4 hours.
- **#9 Life Custom Op generation** — Life ops are 47 hardcoded entries; no flow to write to `roweos_generated_life_ops`. Will add Studio Create Custom Life Op flow reusing the brand `aiGeneratedOps` pattern. ~2 hours.
- **#10 Life Analytics dashboard** — Brand has commerce dashboard; life has nothing. Will add `renderLifeWellnessDashboard()` aggregating pulse streaks + journal sentiment + life library counts + habit completions. ~4-5 hours.

---

## v34.70 - Life Identity layout fix + branching timeline for History

**Life Identity layout matches Brand**

`renderLifeIdentityView()` was setting `lifeContainer.style.display = 'block'`, which clobbered the `.identity-cards { display: flex; flex-direction: column }` rule. In some layout states this collapsed the children into a horizontal scroll lane (cards squished side-by-side, "About Me" floating on top). Fixed two ways for belt-and-suspenders:
- JS now sets `display: flex` + `flex-direction: column` + `gap: var(--space-3)` explicitly when rendering the life container.
- CSS adds a hard `#lifeIdentityCardsContainer { display:flex !important; flex-direction:column !important; }` guard plus `> .identity-card { width: 100%; flex: 0 0 auto; }` so any future bug that flips the parent to row gets neutralized at the child level.

**History → vertical branching timeline (`BrillianceTimeline`)**

Per Jordan's `timeline.avif` reference: history reads better as time flowing top-to-bottom with explicit Brand / Life branching, not a horizontal scrubbing ribbon.

New `src/js/core/49-timeline-tree.js`. Renders a vertical SVG timeline inside the existing `#timeRibbon` container:
- Central spine (vertical `<line>`) flanked by two lanes — Brand on the left at `x = spineX - 140`, Life on the right at `x = spineX + 140`.
- Each conversation is a `<circle>` node on its lane, connected to the spine by a quadratic-bezier branch (`Q` path). Brand nodes are gold (`#c9a961` dark / `#7a6741` light); Life nodes are blue-gold (`#7aa3c9` / `#5a7a9a`).
- Each node has a `<text>` label (first user message, capped at 90 chars) + a relative date below ("Today · 2:14 PM" / "Yesterday" / "3 days ago" / "Apr 15").
- Click a node → expands an inline panel underneath the SVG with the eyebrow (`BRAND · 3 DAYS AGO`), italic Georgia title, multi-line first-message preview (capped at 240 chars), and a gold-pill **Resume** button that calls `chatWithHistoryItem()` exactly like the old ribbon.
- Header strip: `TIMELINE` eyebrow + count summary ("12 conversations on the brand branch") + Brand / Life / All filter pills that reduce visible nodes and re-render in place.
- Tombstone-aware (reads `roweos_deleted_chat_ids` + `roweos_deleted_life_chat_ids`) so deleted conversations don't appear, matching the conversation list section below.

`window.BrillianceTimeline` exposes `render()` and `setFilter()`. The module also overrides `window.TimeRibbon.render` so every existing caller (showView('tuning'), filterHistoryByMode, etc.) draws the new tree without any other changes.

Markup in `src/html/brand/10-tuning.html` simplified to a single `<div id="timeRibbon">` — the legacy ribbon track / axis / markers / cursor / detail elements are gone.

**Life feature parity audit kicked off**

Background audit agent dispatched to compare every BrandAI surface against LifeAI for parity gaps. Top-10 punch list lands as `v34.71` after review.

---

## v34.69 - UI feedback batch: inline pin, Evolve fonts, expand-in-place, notebook center, folio fill, email logo, history-as-timeline

A surgical pass over seven specific user-flagged UI issues.

**1. Thought Board — inline pin composer**
The previous `prompt('Pin title:')` chain (browser-native dialog box, breaks the flow, looks foreign) is replaced with an inline composer panel that mounts above the pinboard / constellation pane. Title input, multi-line body, gold pill "Save pin" + outline "Cancel". Enter saves, Cmd+Enter saves from the body, Esc cancels. No popup. Uses the workspace surface it's already in.

**2. Evolve + Thought Board — system font**
Both surfaces had hard-coded `Georgia, serif` and italic styling on titles, stat values, quiz questions, board card titles, board empty state, board star labels, evolve translate inputs, evolve context rows, the today header. All flipped to `font-family: inherit; font-style: normal;` so they pick up the system default like every other view in the app. The `promo-fonts` opt-in mode (Settings → Appearance) still flips headings to Cormorant Garamond for users who want the editorial treatment.

**3. Evolve cards — copy fix + click-to-expand-in-place**
- Removed every "Sprint A + B / Sprint C / docs/brilliance/14-evolve.md" footer reference. Internal sprint nomenclature is not user-facing.
- "Multi-model questions tuned to your weak areas. (Sprint C)" now reads "Multi-model questions tuned to your weak areas." — period.
- Click on a Warm-up review / Adaptive quiz / Apply / Synthesis / Edge-case stretch card no longer marks it complete. It expands an inline panel underneath the card with the task hint and two buttons:
  - Gold pill "Start quiz" / "Open Translator" / "Begin review" — routes through `Evolve.renderEvolveTabContent()` to the right tab (`practice` for quiz + review, `translate` for apply).
  - Outline green "Mark complete" — only path that actually completes the task. Intentional, not accidental.
- Click again on the same card collapses; clicking another card auto-collapses the previous expansion.

**4. Notebook — centered title + wider editor**
`.scribe-title-input` now centered (`text-align: center`), padding bumped to `12px 16px 6px`, font `20px / -0.01em / weight 700`. The TinyMCE editor surface remains full-width. Notebook header reads as a deliberate centerpiece instead of being left-aligned and offset.

**5. Folio — artifact fills the easel column**
`.folio-active-artifact` / `#folioEaselStage` previously rendered as a centered ~720px-wide island with empty workspace beside it. Now stretches to `width: 100%` of the grid column with `min-height: calc(100vh - 240px)` and inner children forced to `width: 100% !important; flex: 1`. The Q2 Results card (and any artifact) fills the entire easel space.

**6. Email templates — Brilliance monogram, drop the "R" logo**
Three remaining `<img src="https://roweos.com/logo.png">` references in `22-firebase-sync.js` (`generateBrandWelcomeEmail`, `generateBetaWelcomeEmail`, the legacy welcome path) all switched to `https://roweos.com/images/brilliance/monogram-circle.png` at `96px × 96px / border-radius: 50%`. Compose modal preview iframe got `max-width: 640px; margin: 0 auto;` so the admin compose UI no longer shows a stark white margin beside the email body.

**7. History view — timeline-first, brand/life pills filter detail panels**
`tuningView` restructured. Page header reads "History" (was "Conversation History"). Subtitle is "Scrub the timeline. Filter by brand or life. Pick any conversation or studio output to resume." Time Ribbon promoted to primary surface with eyebrow "TIMELINE" (was "Time Ribbon" tucked between sections). Brand / Life / All pill row sits directly underneath. New "CONVERSATIONS & OUTPUTS" eyebrow above the four detail sections (BrandAI conversations, LifeAI conversations, BrandAI Studio outputs, Life Studio outputs) so users understand the pills filter both ribbon scope AND which panels show below.

---

## v34.68 - Sync v5 admin auto-activation + Phase D retirement gate

Two operational additions land together so the v5 migration actually starts producing data instead of waiting on manual flag flips.

**Admin auto-activation (Phase B clock + Phase C cohort-of-one starts NOW)**

`35-sync-v5.js` polls for `firebaseUser.uid` after auth resolves. When the admin UID lands, it flips all four flags ON in one shot: `roweos_sync_v5`, `roweos_sync_v5_writes`, `roweos_sync_v5_dual_write`, `roweos_sync_v5_reads`. Stamps `roweos_sync_v5_phase_b_clock_started` with the activation timestamp. Marker `roweos_sync_v5_admin_auto_activated='true'` ensures it only fires once per device.

What this means in practice:
- Phase B: the 14-day zero-discrepancy clock starts the next time Jordan loads any device. `runSyncV5Audit` will compare v4 vs v5 every 24 hours from that moment.
- Phase C: Jordan IS the cohort-of-one rollout. Reads come from v5 collections through `SyncV5.readArray()`/`readDoc()`. If anything breaks, the v4 fallback in the facade catches it.

For non-admin users (the 10 paying clients), nothing changes — they remain on v4 reads + v4 writes only. The 10% UID-hash rollout and the 100% rollout are separate explicit deploys; this just lights up the admin cohort that the spec calls out by name.

**Phase D retirement flag (`roweos_sync_v4_retired`)**

New 5th flag. When ON, the v3→v4 dual-write blocks in `writeDB`/`writeDBDoc`/`deleteDBDoc` short-circuit and v5 alone runs. Default OFF — admin must explicitly flip it after the 30-day Phase D observation window completes per spec.

`SyncV5.v4Retired()` and `SyncV5.setV4Retired(on)` exposed; included in `getStats()`. The flag is the gate that lets us "delete v4 paths" without actually deleting code today — a cleaner pattern than ripping out ~3000 lines speculatively. When the 30d window closes clean, the v35.x deploy can either (a) flip the flag and leave the dead branches as cheap insurance, or (b) actually delete the code.

**Migration plan memory updated**

`memory/project_sync_v5_migration.md` Status line now reflects: Phase A+B+C+D code-side complete; admin auto-activation live; production observation windows running. Next session resumes from "watch sync_v5_audit and fix discrepancies as they appear."

---

## v34.67 - Sync v5 Phases A-C complete + audit/GC Cloud Functions

Authorized end-to-end execution of the v5 migration plan. v34.66 wired the dual-write hook; v34.67 finishes Phase A, Phase B server-side, Phase C facade, and stages every Phase D deletion behind the spec's mandatory observation windows.

Active migration plan: `memory/project_sync_v5_migration.md` (read first when resuming).

**Phase A — Per-collection mirroring (DONE)**
- `V5_REGISTRY` array in `35-sync-v5.js` registers 26 explicit Collection specs at module init: `brands_v5`, `conversations_v5`, `automations_v5`, `scribe_v5`, `reminders_v5`, `pulse_v5`, `library_brand_v5`, `library_life_v5`, `mail_v5`, `journal_v5`, `folio_v5`, plus 14 profile sub-doc collections and `lifeAI`. Each entry has `firestorePath`, `localStorageKey`, `schemaVersion`. Single source of truth.
- `V5_NATIVE_COLLECTIONS` allowlist extended from 4 (evolve_*) to 30 (every shadowed collection plus profile sub-docs). `_maybeCloudWrite()` now actually fires Firestore writes for shadowed collections when dual-write is ON.
- `_v5Map` and `_subMap` in 09-state.js (writeDB, writeDBDoc, deleteDBDoc) target the registered names so every v4 write lands in a known v5 collection.
- `saveBrands()` (10-sync.js) bypasses writeDB by using `db.batch()` directly. Added inline `mirrorV4Write('brands_v5', docId, data)` per brand inside the batch loop.
- New `bootstrapFromV4()` runs once per device (gated by `roweos_sync_v5_bootstrap_done`). 16-entry BOOTSTRAP_MAP covers brands/conversations/automations/scribe/reminders/pulse/journal/mail/folio + profile collections. Special-case `_bootstrapLibraries()` handles `roweos_brand_library_<idx>` and `roweos_life_library`. Auto-fires 1.5s after init when read-shadow is enabled.

**Phase B — Reconciliation (DONE server-side; 14d clock starts in production)**
- `runSyncV5Audit` Cloud Function in `functions/index.js`. Daily cron, walks 6 v4-shadowed collection pairs per user, writes drift rows to `sync_v5_audit/{uid}/discrepancies/{auto-id}` with `kind: 'missing_in_v5' | 'missing_in_v4'`. Summary row at `sync_v5_audit/_meta/runs/{auto-id}` (last run + total users + total discrepancies).
- New `window.openSyncV5AuditPanel()` admin dashboard. Reads `collectionGroup('discrepancies')` for admins, or `sync_v5_audit/{uid}/discrepancies` for regular users. Renders meta strip, by-collection rollup tiles, recent discrepancies list. Wired via "View audit" button in the existing Sync v5 panel.

**Phase C — Read switch (facade DONE; rollout pending)**
- New `roweos_sync_v5_reads` flag (4th gate). `readsEnabled()` requires all four: enabled + writes + dual-write + reads. `setReadsEnabled()` exposed via SyncV5 facade.
- `SyncV5.readArray(name, v4Reader)` and `SyncV5.readDoc(name, id, v4Reader)` shipped. When reads flag OFF, the v4Reader fires (zero behavior change). When ON, the v5 cache is consulted and envelopes are unwrapped to plain v4 shape so callers don't need to know.
- 5 highest-traffic centralized loaders routed through the facade: `getReminders` (28-reminders-notifications), `loadScribeNotebooks` (33-scribe), `loadBrands` (10-sync), `getMergedAutomations` (17-automations), `pulseGoals` IIFE (25-documents-lifeai). Downstream consumers read from the in-memory arrays these loaders populate, so the rest of the 75-115 sites get v5 reads transitively.
- Rollout sequence per spec: Jordan first, then 10% (UID hash), then 100%. Operational; flag flips in admin Settings.

**Phase D — Retire v4 (STAGED — pending 30d production observation)**
- Items #11-#20 (delete v4 dual-write blocks, delete loadFromFirebaseV2, delete safeSyncWrite/mergeByTimestamp, replace manualSyncNow body, delete _all doc convention, delete tombstone tracking + reconcile UI, promote v5 panel from "Preview", Settings UI cleanup, ~3000-line code sweep) are NOT executed today. Per spec migration phase D, these run only after Phase C has held at 100% v5 reads for 30 consecutive days with zero discrepancies. Deleting v4 paths today would orphan any user device that hasn't yet bootstrapped to v5.
- Tracked in `memory/project_sync_v5_migration.md` for v35.x.

**Phase D #17 — Tombstone GC (DONE; sibling Function shipped together)**
- `runTombstoneGC` Cloud Function in `functions/index.js`. Daily cron, deletes envelopes with `_deletedAt < (now - 30d)` across 15 v5 collections per user. Capped at 200 per collection per user per run.

**Tests + observability**
- 21 new tests in `src/__tests__/critical/sync-v5-v34-67.test.ts`: readsEnabled flag gating (6), readArray facade including envelope unwrap and tombstone filter (5), readDoc facade (3), V5_REGISTRY pre-registration of all 11 v4-shadowed app collections (3), V5_NATIVE_COLLECTIONS allowlist (4). Combined with the existing 9 v5 test files (cache, cloud-write, dual-write, edge, flags, retry, shadows, stats), the v5 layer has comprehensive unit coverage. Total suite: 278/278 passing.

**Documentation**
- `CLAUDE.md` Sync Architecture section rewritten to document the dual-layer reality: v4 still source-of-truth, v5 scaffolded behind 4 flags. Future contributors get explicit "when changing sync code today" guidance and the flag table.
- `memory/project_sync_v5_migration.md` is the active end-to-end plan. Status line updates after every meaningful chunk so context compaction lands on a fresh anchor.

**What's left to retire v4 (and approximate ETA):**
- Phase B observation: 14 consecutive zero-discrepancy days from `runSyncV5Audit`. Starts when an admin flips dual-write ON in production.
- Phase C rollout: enable `roweos_sync_v5_reads` for Jordan (7d), then 10% UID-hash (7d), then 100%.
- Phase D observation: 30 consecutive days at 100% v5 reads with zero discrepancies.
- Phase D execution: one cohesive v35.x deploy that deletes the ~3000 lines of v3/v4 code.

Total: ~6-8 weeks calendar time, mostly mandatory observation windows. Code is now 100% ready for that schedule.

---

## v34.66 - Email observability + Sync v5 dual-write wiring

Two parallel tracks shipped together: every email send is now visible in the admin Campaigns dashboard, and the Sync v5 dual-write phase (the gate to v4 retirement) is now wired to the v4 write paths.

**Track A — Email observability**

Pre-v34.66, only `send-template-email.js`, `notify-signup.js`, and `resend-welcome.js` wrote to the Firestore `email_log` collection. Five other endpoints — `feedback.js`, `info-signup.js`, `newsletter.js`, `scheduler.js`, `stripe-webhook.js` — sent mail invisibly. Fixed:

- New shared `RoweOS/dist/api/_email-log-helper.js` with one `write(logData)` function. Self-contained: signs its own JWT against `FIREBASE_SERVICE_ACCOUNT`, posts to the Firestore REST endpoint, never throws (silent failure preferable to losing the actual mail send).
- All five endpoints now call `emailLog.write({ userEmail, template, subject, status, resendId, sentBy })` after their Resend call. `sentBy` distinguishes which endpoint did the send so the admin dashboard can audit per-source.
- New **Campaigns dashboard** in admin Email Management: button next to the Refresh control toggles to `adminLoadCampaignsView()`. Renders four stat tiles (total sends / failed / clicks / responses) plus three rollup tables: per-template send count with sender breakdown and recent recipients; per-campaign click totals; per-question survey response distribution with horizontal % bars. Same Firestore queries as the per-user list, just aggregated.

The end state: every send across every endpoint shows up in one panel, and you can see at a glance whether a campaign is performing.

**Track B — Sync v5 dual-write wiring**

Per the v33 master plan and `docs/brilliance/16-sync-v5.md`, Sync v5 needs to mirror every v4 write into a parallel v5 envelope-shaped cache so we can run a 14-day zero-discrepancy clock before retiring v4. The infrastructure existed (`mirrorV4Write()` in `35-sync-v5.js`) but was never called by v4 paths — it was scaffolded.

Wired now:

- `writeDB(docPath, data)` (09-state.js) — at the bottom, after the v3 + v4 dual-writes, a v5 mirror call. New `_v5Map` translates v4 docPaths to v5 collection-and-id pairs (e.g. `profile/main` → `{ collection: 'profile_main', id: 'main' }`). 24 docPaths covered.
- `writeDBDoc(collectionPath, docId, data)` — subcollection writes now mirror via `SyncV5.mirrorV4Write(collectionPath, docId, data)` (collection name and ID pass through directly, no map needed).
- `deleteDBDoc(collectionPath, docId)` — writes a tombstone envelope (`{ __v5_tombstone: true, _deletedAt: Date.now() }`) per spec §6 so future v5 cutover sees the deletion as authoritative.

The mirror is **gated** by the `roweos_sync_v5_dual_write` flag. With the flag OFF (default), `mirrorV4Write()` returns null immediately. With the flag ON, every v4 write also lands in the v5 cache.

The existing Settings → Sync v5 (Preview) panel already has the dual-write toggle button (with the spec's required confirm dialog: "you should only flip this on after read-shadow has run zero-discrepancy for 14 days, currently N discrepancies seen"), so admin enable is already a one-click affair.

Net effect: the 14-day zero-discrepancy bar can now actually be measured. Once the read-shadow has run clean for 14 days, an admin flips dual-write ON, and the full v5 stats payload (`dualWrites`, `dualWriteErrors`, `lastDualWriteAt`) starts ticking. When dual-write hits 30 days zero-discrepancy, v4 retires per the spec.

---

## v34.65 - PWA icon (black tile) + drop "beta" framing

**PWA icon restored to the black-tile version**

`scripts/regen-icons.mjs` was sourcing from `b-mark-transparent.png`. That meant Safari's "Add to Dock" preview rendered the gold B on a checkerboard (Safari's transparency indicator), and macOS dock instances looked airy / ungrounded next to peer apps with solid tiles. Switched the source to `app-icon-black.png` (the dark dock-tile version Jordan ships in his actual dock), regenerated every favicon / apple-touch-icon / icon-192 / icon-512 / icon-1024 from it. PWA installs from this point forward show the solid-black tile with the gold B + sparkle ring centered. Existing PWA installs may need to delete and re-add the app to pick up the new icon (per the CLAUDE.md PWA caching note).

**Drop "beta" framing**

Brilliance is post-beta. The lone user-visible "Do you need a beta API key?" prompt in the feedback survey email (`generateFeedbackQuickReplyEmail()` in 22-firebase-sync.js L7535) now reads "Would you like us to provision a key for you?" with answer buttons rephrased to match. The feedback feature itself stays exactly as-is — survey emails still go out, feedback button in System nav stays. Internal IDs (`onboardingStepBetaWelcome`, `betaEmailPreviewModal`, `proceedFromBetaWelcome()`, `generateBetaWelcomeEmail()`) intentionally not renamed because they're not user-visible and renaming would touch many call sites for zero aesthetic gain.

---

## v34.64 - Onboarding overhaul: Brilliance voice + new "Make it yours" step

A complete pass over the onboarding flow to bring it inside the v34.x design language and surface the new feature customizations users would otherwise discover ad-hoc.

**Pass 1 - Brilliance voice across every step**
- Welcome step (`onboardingStep0`): replaced the legacy diamond logo + `#b2997b/#8b7b67` muted gradient CTA with the gold-bloom monogram header (matches splash, transition email, Daily Brief), BRILLIANCE eyebrow uppercase 0.22em, italic Georgia subtitle, and gold gradient pill CTA (`#e2c79b → #c9a961 → #a88a4a`, 99px radius, 11px UPPERCASE 0.18em letter-spacing). Feature pills now use gold-tinted borders and tighter copy ("One workspace, every model" / "Brand and life, side by side" / "Studio, Automations, Pulse, Bloom").
- PWA install step (`onboardingStepPWA`): same monogram + eyebrow + italic-title pattern, gold pill primary, gold-outline "Skip for now" secondary.
- Mode-selection step (`onboardingStepMode`): eyebrow + italic title + cream cards with gold-on-active state. Subtitles surface mode-specific feature names.
- `.onboarding-btn-primary` and `.onboarding-btn-secondary` redefined globally to the v34.x pill voice so every other step (Name, Provider, LifeAI 1-5, sync, calendar, social, email, automations, etc.) inherits the new look without per-step rewrites. Light-mode override aligned to the same gold gradient.

**Pass 2 - New "Make it yours" step**
- Inserted between Cross-Device and Beta Welcome. Single consolidated customization card with four sections, all reversible from Settings:
  - **Choose your Brilli** - five-card form picker (Celestial / Aura / Firefly / Signature / Classic). On commit, calls `Brilli.setActiveForm()` with the choice.
  - **Theme** - dark / light pill toggle. Surfaces the `⌘ ⇧ L` keystroke. On commit, calls `toggleTheme()` if the user picked the opposite of current.
  - **Auto-open Daily Brief** - toggle slider with cream-warm rail. Persists `roweos_daily_brief_auto`. Surfaces the `⌘ ⇧ T` keystroke.
  - **Capture, anywhere** - cheat-sheet listing every v34.x quick-capture keystroke (⌘⇧G / ⌘⇧R / ⌘⇧N / ⌘⇧T / ⌘K / ⌘⇧L) with `/help` and `?` discoverability hints.
- Wired through `goToOnboardingStep('makeYours')`, `proceedFromMakeYours()`, `selectOnboardingBrilliForm()`, `selectOnboardingTheme()`. Cross-Device and Dock steps now route → MakeYours → BetaWelcome instead of skipping straight to BetaWelcome.

**Pass 3 - Final BetaWelcome refresh**
- Lead with the gold-bloom monogram instead of tucking it below the title.
- "YOU'RE IN" eyebrow + italic Georgia "Welcome to Brilliance." + italic Georgia subtitle ("Operating intelligence, made for the brand you run and the life you live.") match every other v34.x modal voice.
- Primary CTA renamed "Let's Go" → "Begin" to align with the v34.63 Welcome step CTA. Back button now points at the Make-it-yours step ("← Tune preferences") so users can revisit those choices before committing.

---

## v34.63 - Visual + copy audit pass: stark-white slabs, TinyMCE popovers, em-dash sweep

A consolidation deploy from a long autonomous audit session. Two visible bugs the user flagged in the previous session (Image #65 Notebooks white-box, Image #66 Library action bar slab) are fixed at the source, plus the broader patterns that produced them.

**Bug fixes**

- **Library action bar (Image #66)**: `html.light-mode .library-header { background: var(--bg-elevated) }` was painting the entire flex row of action buttons stark white over the cream workspace. Changed to `transparent` so the buttons sit individually on the workspace, the way the v34.x design intends.
- **Notebooks editor (Image #65)**: TinyMCE wrapper had no theme-aware backgrounds and no menu / popover overrides. Added `var(--bg-primary)` to `.tox-tinymce`, `.tox-edit-area`, `.tox-edit-area__iframe`, plus dark and light overrides for every floating chrome surface (`.tox-menu`, `.tox-collection`, `.tox-pop`, `.tox-dialog`, `.tox-toolbar__overflow`, `.tox-swatches`). The white box that was bleeding through when users opened a Block / Font / Color dropdown in dark mode is gone.
- **TinyMCE theme stickiness**: `_isLightMode` was captured once at init time, so toggling theme after opening Notebooks left the iframe content_style locked. New `reinitScribeTinymceForTheme()` re-runs `tinymce.init()` on theme change, hooked into `toggleTheme()`. Iframe palette now follows the user's theme.
- **Tool dropdown hover** (light mode): hover background was `#121212` (near-black), copy-pasted from the dark-mode rule. Fixed to a light hover tone.
- **Library tab bar**: `.library-tab-bar` was `var(--bg-tertiary)` (white in light) on the cream workspace. Cream-warm now via `var(--bg-secondary)` plus an explicit light-mode override.
- **Studio action bar buttons**: `.studio-action-btn` had no desktop styles, so they fell through to the global `button { background: #ffffff }` rule and rendered as stark white pills in light mode. Added a desktop base + light-mode override matching the `.library-header-btn` pattern.
- **`.panel` slab**: Every `.panel` element (Identity, Settings, Studio, etc.) was pure `#ffffff` on the cream workspace. Softened to `#fbfaf5` (warm white) so panels sit on the workspace, not on top of it. `.modal` and `.card` stay crisp white because popovers feel intentional that way.
- **Scribe archive buttons** + the legacy `.library-panel .library-header` rule both got proper light-mode treatments. The legacy `.library-header` rule was bleeding padding / border / background into the new `#libraryView` flex row through an unscoped class collision, now scoped to the slide-out panel only.

**Em-dash sweep round 2**

User-facing copy across the codebase now uses ASCII hyphens, periods, or rewrites instead of em-dashes (consistent with project memory's "no em-dashes" rule). Touched: Settings descriptions (Educational Intelligence, Quiz Engine, Folio Studio at Work, Letter Series, Sync v5), Onboarding Welcome step body, Thought Board landing copy, Evolve landing copy, Sync Hub Reconcile / Purge confirm + report copy, the v33.x ship list inside the What's New modal, time-ribbon / letter-series / thought-board / split-pane / folio-easel mode-toggle toasts, image picker labels in 20-ui-misc.js, Studio image-edit refusal toast + LLM system prompts, the SEO `<meta name="description">` tag, the `RoweOS/dist/portfolio.html` master message, the `notify-signup.js` welcome subject, the `feedback.js` admin email subject, plus title attributes on Studio Split Pane, Folio Studio at Work, and Scribe Letter Series toggles.

**Pre-deploy audit ritual (institutionalized)**

Per the user's directive that bugs like Image #65 / #66 "should have been caught 100% of the time," every deploy now requires:

1. Spawn parallel audit agents (visual-regression sweep, em-dash sweep, modal consistency sweep).
2. Run `bash scripts/pre-deploy-audit.sh` - mechanically verifies version-string consistency across 8 locations, build success, 257-test suite passes, no ES5 violations, no base64-via-innerHTML, no stark-white wrapper-container patterns. Now invoked by `deploy.sh` itself before any deploy step (skip with `SKIP_AUDIT=1` for emergencies).
3. Act on every HIGH-severity agent finding before invoking `deploy.sh`.

Documented in `CLAUDE.md` so future sessions inherit the ritual.

**Modal consistency pass (v34.x family)**

A third audit agent compared every overlay modal in the v34.19-v34.63 family (Quick-Add Goal/Reminder/Note, Daily Brief, Yesterday's Recap, Shortcuts, Form Picker, Mobile FAB Sheet, PWA Install Banner). Two outliers were aligning poorly with the established voice:

- **Brilli Form Picker (v33.99)**: predated the v34 luxury polish and was missing every shared treatment. Now has a proper light-mode branch (was hardcoded dark and stark against cream UIs), the standard `APPEARANCE` eyebrow before the title, the gold gradient pill Close button (was a transparent outlined box), the standard `rgba(0,0,0,0.7)` + `blur(10px)` backdrop (was the dimmer 0.6/8px), `rgba(201,181,122,0.22)` border (was 0.18 — washed out), the `0 24px 80px` shadow shared by every other modal in the family, and z-index 99100 (was 99000, would render below other quick-action overlays).
- **Mobile FAB Sheet (v34.43)**: was hardcoded dark `rgba(15,15,15,0.96)` with `#f5ecd9` text — looked like a black tile floating against the cream UI in light mode. Now flips bg / border / shadow / row text / kbd-hint colors based on theme. New `window._rebuildMobileFab()` is called from `toggleTheme()` so the sheet rebuilds with the new tokens when the user toggles theme on a mobile device.

Minor consistency drifts also corrected: PWA Install Banner letter-spacing (eyebrow `0.18em` → `0.22em`, button `0.14em` → `0.18em`) and the half-px `10.5px` "Not now" button rounded to `11px`. Yesterday's Recap modal `max-width` aligned from `540px` to `560px` so the back-and-forth pair with Daily Brief reads as the same surface. Shortcuts modal monogram gained the `onerror="this.style.display='none'"` fallback every other monogram in the codebase already had. All overlay fade-in transitions standardized to `0.3s` (was a mix of `0.25s` / `0.3s` / `0.4s`) and every backdrop got the `-webkit-backdrop-filter` Safari prefix it was missing.

**Minimal accessibility pass on v34.x modals**

Every v34.x overlay modal (Quick Add Goal, Quick Add Reminder, Quick Add Note, Daily Brief, Yesterday's Recap, Shortcuts, Brilli Form Picker) now sets `role="dialog"`, `aria-modal="true"`, and a meaningful `aria-label` so screen readers announce them correctly. Esc-to-close and click-outside-to-close patterns were already in place. Full a11y pass (focus traps, keyboard tab management, color-contrast WCAG AA) is tracked for v35.

---

## v34.62 — Daily Brief empty state is time-aware and actionable

The old empty state was a single static line. Now branches by hour:

| Hour | Headline | CTA |
|---|---|---|
| Before 11 | "A clear morning. What's the one thing today?" | Capture a goal |
| 11 → 17 | "Quiet so far. Anything you want to land before dinner?" | Drop a quick goal |
| 17 → 21 | "Quiet evening. A note for tomorrow?" | Capture a note |
| 21+ | "Late and clear. Sleep on it, or capture something for tomorrow." | Capture a note |

Italic Georgia headline, soft sub copy, gold-gradient pill button. Goal CTA fires before 5pm, Note CTA fires after — the choice tracks how people actually use those surfaces (capture-mode in the morning, reflection-mode at night). One click closes the Brief and opens the appropriate quick-add modal.

---

## v34.61 — Clear chat draft (⌘ ⇧ X)

Escape hatch for the v34.51 chat input draft auto-save. New `window.clearChatDraft()` removes `roweos_chat_draft`, blanks both chat textareas (agentCommand + followupCommand), and runs `autoResizeTextarea`.

Triggered by **⌘ ⇧ X** (mnemonic: X for "ditch") OR ⌘K alias `clear draft` / `wipe draft` / `reset draft`. Listed in the Focus / Universal section of the shortcuts overlay.

Special-cased: the keystroke fires even when focus is in the chat input (normally we skip input targets), since this is its dedicated keystroke.

---

## v34.60 (milestone) — Bidirectional day-anchor flow

Yesterday's Recap footer now mirrors the v34.59 Daily Brief footer with a "Today's Brief →" outline button on the left, paired with the gold-gradient Close on the right. Click closes the Recap and opens the Brief after a 300ms transition.

Forward + backward day-anchor surfaces are now bidirectionally linked: from the Brief you can step back to yesterday, from the Recap you can jump forward to today, both inside the same modal flow.

Sixty-version mark in the v34.x series.

---

## v34.59 — Daily Brief footer cross-link to Yesterday's Recap

Daily Brief footer now has a "← Yesterday's Recap" outline button on the left, paired with the gold-gradient Close on the right. Clicking the link closes the Brief and opens the Recap after a 300ms transition. Forward-looking and backward-looking surfaces are now one click apart inside the day-anchor flow.

---

## v34.58 — Yesterday's Recap modal

Backwards-looking counterpart to the Daily Brief. Walks:

- **Pulse goal items** — `completedAt` matching yesterday's date → "Pulse · Completed"
- **Reminders** — status `completed`/`dismissed` with timestamp matching yesterday → "Reminders · Cleared"
- **Mail** — `roweos_mail_sent` `sentAt` matching yesterday → "Mail · Sent"
- **Notebooks** — `_modifiedAt` matching yesterday → "Notebooks · Touched"

Renders four green-tinted accomplishment rows + an empty state pointing to ⌘ ⇧ G. Time-aware label uses yesterday's actual weekday name (e.g. "Friday, April 29" on a Saturday) so weekend-recovery works. Same gold-monogram header as the Daily Brief.

Reachable via:
- ⌘K: `yesterday` / `yesterday's recap` / `recap`
- Slash: `/yesterday` or `/recap`

Useful for Monday-morning catch-up and post-trip context recovery.

---

## v34.57 — `/random` Brilli + view-jump slash commands

- **`/random`** picks a random Brilli form (excludes the current one so it actually changes). Light delight command.
- **`/pulse`, `/notebooks` (alias `/scribe`), `/library`, `/automations`, `/mail`, `/bloom`, `/studio`** — view-jump slash commands. Faster than `open pulse` in ⌘K when you're already in the chat input.

Slash autocomplete chip strip gained matching chips. Sixteen slash commands total now: capture (`/goal /note /remind`), system (`/brief /help /sync /theme /focus`), Brilli (`/brilli /random`), navigation (`/pulse /notebooks /library /automations /mail /bloom /studio`).

---

## v34.56 — Brilli rests when you do (5-min user-idle sleep)

After 5 minutes with no mouse / keyboard / pointer / touch / wheel / scroll activity, every Brilli instance enters `asleep` mode (slower, dimmer breathing). Any interaction wakes him back up.

v33.10 already had `asleep` mode keyed off `document.hidden` (tab switch / minimize). This layers a true user-idle detection on top so Brilli also rests visually when you step away from the computer without changing tabs. Each instance saves its prior mode in `_userIdleSavedMode` and restores on wake. Listeners are `passive: true, capture: true` so they never block scroll.

---

## v34.55 — Streak row in the Daily Brief

Computes the active streak — consecutive days (ending today, or yesterday if today has no wins yet so the streak doesn't collapse before bedtime) with at least one completed Pulse item. Walks every goal's items once, builds a date-keyed map, then counts back day-by-day until a gap. Hard-capped at 365 days.

Renders only when streak >= 2 (a single day reads better as just "Today's Wins"). Milestone copy:
- 7 days → "one week"
- 30+ → "one full month"
- 100+ → "keep going"

Sits between the pressure rows and Today's Wins. Same gold-tinted styling as the urgency rows but separate semantically.

---

## v34.54 — Slash command vocabulary expanded

Four new chat slash commands match the existing ⌘K aliases:

- `/sync` — manual cloud sync inline with toast
- `/theme` — toggle light / dark
- `/focus` — toggle Focus Mode
- `/brilli {form}` — set Brilli form by keyword (`celestial`, `aura`, `firefly`, `signature`, `classic`, plus `field` → aura, `light` → signature, `blake` → classic). No arg → opens the picker.

Slash autocomplete chip strip in the chat input gained matching chips so they're discoverable. Shortcuts overlay slash-commands section updated.

---

## v34.53 — Brand cycle pulse-flash

`⌘ ⇧ [` / `⌘ ⇧ ]` brand cycle now triggers a pulse-flash on every Brilli instance, so the brand switch feels tactile and visible alongside the toast popup. Walks `Brilli._debugInstances()` and bumps each instance's `ambientBurst = 1` + `pulseFlash = 0.85` so the chat-hero orb plus any sidebar dots flash gold momentarily. Toast still confirms the new brand short-name; this just adds the visual companion.

---

## v34.52 — Tab to autocomplete slash commands, Esc to dismiss

When the slash chip strip is visible:
- **Tab** completes the first matching command (terminal-style autocomplete) — inserts the top-ranked command + space, hides the strip, lets you start typing the argument immediately
- **Esc** hides the chip strip without clearing input — for users who pressed `/` by mistake and want to keep typing free-form text

Both fire only when the strip is visible so they don't hijack normal input behavior.

---

## v34.51 — Auto-save chat input drafts

If you type a message but refresh, switch tabs, or close the PWA before sending, the draft restores on next load. Persisted in `roweos_chat_draft` (single localStorage key) with a 400ms debounce so it doesn't hammer storage on every keystroke.

- Only writes drafts > 8 chars (so half-typed slash commands like `/g` don't persist)
- Clears the key when the input goes empty (after send or manual delete)
- Wired to both the landing input (`agentCommand`) and the followup input (`followupCommand`)
- Triggers `autoResizeTextarea` after restore so the textarea heights right
- Re-wires every 1.5s so dynamically-mounted inputs pick it up

---

## v34.50 (milestone) — Auto-open Daily Brief on first sign-in each day

Opt-in toggle in Settings → Appearance ("Auto-open Daily Brief"), persisted in `roweos_daily_brief_auto`. When enabled:

- Brief opens ~2.5s after page load (giving welcome / restore / auth gate / What's New time to settle)
- **Once per day per device** — tracked via `roweos_daily_brief_last_shown` (YYYY-MM-DD)
- Skips when ANY of the competing surfaces are still up (data restore, auth gate, post-login welcome, Brilliance welcome modal, What's New)
- ⌘ ⇧ T still works whenever you want to open it manually

Together with the v34.35 Brief, v34.36 ⌘⇧T shortcut, v34.49 Today's Wins row, and the 7-tip empty-state, the Daily Brief is now Brilliance's daily anchor surface for users who want one.

---

## v34.49 — Today's Wins row in the Daily Brief

A positive counterweight to the overdue / due / pending pressure rows above. Walks every Pulse goal's items and counts those with `completed: true` and `completedAt` falling on today (string-prefix match on `YYYY-MM-DD`).

Renders at the bottom of the Brief in muted-green styling (separate from the gold/cream urgency rows) so it reads clearly as celebration rather than another to-do. Empty-state copy still fires only when there are zero pressure signals AND zero wins, so the Brief never feels bare. Click routes to Pulse like the other rows.

---

## v34.48 — Bulk reminder cleanup + `daily` Brief alias

### Bulk reminder cleanup
New ⌘K command: `complete reminders` / `finish reminders` / `clear reminders` / `mark all reminders` / `reminders done` closes every reminder whose scheduled time has passed.

- Walks `roweos_reminders`, sets `status: completed` + `completedAt` + bumps `_modifiedAt` on each due item
- Persists via `writeDB('pulse/main', ...)` so the cloud sync stamps too
- Toast confirms count ("Closed 3 reminders" / "No due reminders to close")
- Sidebar badge + concierge row + focus reminders all refresh

Useful end-of-day cleanup for the "due now" pile that the v34.27 urgency sort puts at the top of the row.

### `daily` Brief alias
Added `daily` as a new alias for the v34.35 Daily Brief alongside `brief` / `today` / `what's next`.

---

## v34.47 — Brand cycle keyboard shortcuts (⌘ ⇧ [ / ⌘ ⇧ ])

`⌘ ⇧ [` previous brand · `⌘ ⇧ ]` next brand. Mirrors browser tab navigation. Multi-brand operators were doing four clicks (sidebar → dropdown → brand → close) every time they switched contexts; one keystroke now.

- Skips when typing or in Life mode (brand cycling is a brand-mode concept)
- Routes through existing `selectBrandFromDropdown(idx)` so all the established side effects (sidebar name update, accent color, view rerenders, lifeai/brandai mode propagation) fire normally
- Toast confirms the new brand by short name
- Listed in a new "Brand switcher" section of the shortcuts overlay

---

## v34.46 — Inline slash-command autocomplete

When the chat input starts with just `/` or `/<partial>` and contains no space, a small chip strip appears just above the input listing the matching slash commands:

- `/goal · Save to Pulse`
- `/note · Quick note`
- `/remind · Quick reminder`
- `/brief · Daily Brief`
- `/help · Shortcuts`

Click a chip to insert the full command + a space. Same Slack/Linear pattern. Wired to both the landing input and the followup input. `mousedown` is prevented on chips so click doesn't blur the textarea. Hides on space, blur, or empty input. Re-wires every 1.5s so dynamically-mounted inputs pick it up too.

Spotlight Try suggestions also gained `/goal`, `/note`, `/remind` hints in their desc copy + a new `sync` example.

---

## v34.45 — Chat slash commands

Type a slash-prefixed command in the chat input and it routes to the matching capture surface instead of sending to AI:

| Command | Action |
|---|---|
| `/goal X` or `/task X` | Save text to Pulse Unassigned (no modal — direct save with toast) |
| `/note X` | Open Quick Note modal pre-filled |
| `/remind X` or `/reminder X` | Open Quick Reminder modal pre-filled |
| `/brief` or `/today` | Open Daily Brief |
| `/help` or `/shortcuts` | Open Shortcuts overlay |

Wired in `runAgent()` before any AI / image-gen logic so slash commands always intercept. Documented in a new "Chat slash commands" section in the shortcuts overlay.

---

## v34.44 — Hash-based deep links

Bookmark, share, or automation-link to any of the v34.x quick-action surfaces:

| Hash | Action |
|---|---|
| `#brief` / `#today` | Daily Brief |
| `#help` / `#shortcuts` / `#?` | Shortcuts overlay |
| `#goal` | Quick-add Pulse goal |
| `#reminder` | Quick-add reminder |
| `#note` | Quick-add note |
| `#search` / `#k` | Spotlight |

Wired with a `load`-then-600ms-timeout so target functions are defined when fired, plus a `hashchange` listener for in-session navigation. After firing, the hash is cleared via `history.replaceState` so a refresh doesn't re-trigger.

URLs like `roweos.com/#brief` or `roweos.com/?ref=email#goal` now open the right surface.

---

## v34.43 — Mobile Quick Capture FAB

Mobile users couldn't easily reach the v34.x keyboard quick-actions, so the platform's most useful capture surfaces were locked behind a keyboard nobody on touch has. New floating "+" button in the bottom-right (above the liquid nav, respects `safe-area-inset-bottom`) expands into a 4-action sheet:

- **Daily Brief** (⌘⇧T)
- **Quick Goal** (⌘⇧G)
- **Reminder** (⌘⇧R)
- **Note** (⌘⇧N)

Each row shows the matching desktop shortcut so users learn the keystrokes for when they switch to a real keyboard. Routes through the existing `window.openDailyBrief / openQuickAddGoal / openQuickAddReminder / openQuickAddNote` so the modals are identical to the desktop flow.

**Hidden when:**
- On desktop (≥769px)
- Inside Focus Mode
- Any quick-action overlay / Daily Brief / shortcuts overlay / data restore prompt is open

Outside-tap closes the sheet. Auto-refreshes visibility on resize and via a 500ms poll so it never persists over a freshly-opened modal.

---

## v34.42 — Sidebar version label tooltip is dynamic

Hovering the sidebar version label now shows a 3-line tooltip:
- `Brilliance v34.42`
- `Last sync: 12 min ago` (or `a moment ago` / `3 hr ago` / `2 days ago`, falls back to `Not yet synced`)
- `Click for changelog`

Built on `mouseenter` from `roweos_last_sync` via a new `window.updateSidebarVersionTooltip()` helper. Cheap to compute, no rerender.

---

## v34.41 — Library concierge pill

New "Library" pill counts files added since you last opened Library across every brand and life library. Walks `roweos_brand_library_*` and `roweos_life_library` storage keys (multi-brand structure), checks `_modifiedAt` / `uploadedAt` / `createdAt` against `roweos_library_last_seen`. Urgency 12 (between Bloom 15 and Resume 10).

Listed in the Customize Concierge modal so users can toggle it like the others. New `markLibraryViewed()` clears the badge when user opens Library, wired in `showView('library')`.

---

## v34.40 — Three new ⌘K aliases (snooze concierge, lock, choose Brilli)

- `snooze concierge` / `hide concierge for an hour` / `quiet concierge` → temporarily hides the row for 60 minutes via `roweos_concierge_snooze_until` timestamp. `_renderConciergeRow()` honors it; auto-cleans expired snoozes on the next render.
- `lock` / `lock screen` / `lock app` → calls `signOut()`. Same as `sign out` but with a more familiar mental model on shared computers. Data stays in cloud, only the local session ends.
- `brilli form` / `change brilli` / `pick brilli` / `choose brilli` / `brilli forms` → opens `openBrilliFormPicker()` directly. Was previously only reachable via Settings, ⌘ ⌥ B (which cycles, not picks), or the chip strip.

---

## v34.39 — PWA hard reload no longer flips to "Welcome back, restore?" (Image #64)

The v34.4 silent-restore check was too narrow. It only consulted `roweos_initialized=true` and `roweos_last_uid`, both of which can briefly return `null` on PWA hard reload before the storage shim has hydrated. Safari can also occasionally lose individual localStorage keys between sessions. Result: returning users sometimes saw the "Welcome back, Jordan, restore?" prompt with the What's New modal stacked behind it.

**Three fixes:**

1. **Broader returning-user check.** Any of these means "this device has used Brilliance before" and silent-restore is safe:
   - `roweos_initialized=true` (legacy)
   - `roweos_last_uid` matches current user (v34.4)
   - **`brilliance_whatsnew_seen` has any version** (set after first welcome)
   - **`roweos_app_mode` exists** (brand vs life pick)
   - **`roweos_theme` exists** (light/dark pref)
   - **`roweos_onboarding_complete=true`**

2. **Always stamp `roweos_last_uid` at top of `handleAuthState()`.** Was only set on accept-restore + silent-restore paths. Now stamped on every successful auth so future loads always have a fresh anchor regardless of how the previous session ended.

3. **`maybeShowWhatsNew()` skips when restore prompt or auth gate are up.** The two no longer stack visually like in the screenshot.

---

## v34.38 — Concierge spacing, firefly redesign, Resume pill works, helix dim on landing, transition email tracking

### 1. Concierge spacing
Concierge row was hugging the "BRAND INTELLIGENCE PLATFORM" title (Image #59). Bumped to a static `margin: 32px 0 24px` (mobile: `24px 0 18px`) so the title and pills feel like separate beats. Static px so it never tightens up under font scaling.

### 2. Firefly redesign (Image #61)
The form now matches Jordan's reference image. Visible round head with two glowing-white eyes (no pupils, gold rims), two curved antennas with glowing tips that sway, two **separated** wings that fan out fully on the X axis (not just vertical pulses) with a hinge-and-rotate transform plus subtle outline so each wing reads as distinct, and a teardrop abdomen behind the head.

**Click easter egg**: clicking the firefly is now a special movement. `b.flyOffset` decays over ~1.6s and the firefly traces a figure-eight loop around the host with subtle wing tilt before settling. Wired into the existing click-burst handler.

### 3. Resume pill loads the conversation (Image #62)
Was a no-op. `view: 'agent'` just dropped users on the landing without loading the conversation. Added `_action: 'resume-latest'` with the original conversation index in `_resumeIdx`; the click handler now calls `chatWithHistoryItem(idx)` which handles brand-mode / life-mode switching and actually opens the conversation.

### 4. Helix dim toggle on landing (Image #63)
The half-circle "reduce background" button was only on the post-send followup input. Added matching `#helixDimBtnLanding` to the LANDING chat input toolbar so users can adjust ambient before their first message, not just after.

### 5. Brilliance Transition email tracking — counter names corrected
The admin response breakdown was showing zeros for the Brilliance Transition email even after sends went out, because templateMeta used `transition_open` / `transition_keys` but the actual `trackedUrl()` calls in the email use `brilliance_transition_cta`, `brilliance_transition_open`, `brilliance_transition_plans`, `brilliance_transition_apikeys`. Updated the meta to match real counter names and added all four to `extraCounters` so engagement on every CTA registers — body Get API Keys, inline Open Brilliance, footer Plans, footer API Keys. Past sends will now show their click data the next time the dashboard refreshes (clicks were captured by `/api/track-click` all along; only the breakdown's filter labels were wrong).

Also added `brilliance_transition` to the campaigns sort `knownOrder` so it pins to the top of the breakdown.

---

## v34.37 — Daily Brief polish + Brief at the top of Spotlight Try

- Daily Brief modal header now shows today's full date in italic Georgia (e.g. *Thursday, April 30*) below the greeting. Anchors the panel in time without making you glance at the OS clock. `toLocaleDateString` with `{ weekday: 'long', month: 'long', day: 'numeric' }` so it localizes naturally.
- Spotlight ⌘K "Try" suggestions list now leads with `brief` at the top of the seven examples. New users see the Brief on first open of the search bar.

---

## v34.36 — ⌘ ⇧ T opens the Daily Brief

Discoverability follow-ups for v34.35:
- New `⌘ ⇧ T` / `Ctrl + Shift + T` shortcut opens the Daily Brief from anywhere. Mnemonic: T for Today. Same skip-when-typing guard as the rest of the quick-action family.
- Listed in the Focus / Universal section of the shortcuts overlay alongside ⌘⇧G / ⌘⇧R / ⌘⇧N.
- Concierge empty-state rotation expanded from six tips to seven, adding "Try · ⌘ ⇧ T for today's Daily Brief". The tip's click target opens the Brief directly via the new `daily-brief` action in the empty-state dispatcher.

---

## v34.35 — Daily Brief

A focused at-a-glance summary modal that pulls today's signals into one calm panel. Open via:
- ⌘K → `brief` / `daily brief` / `today` / `what's next`
- `window.openDailyBrief()` directly

**Surfaces (smart row labels):**
- **Pulse Overdue** — items past their date
- **Pulse Due Today** — items dated for today
- **Pulse · open goals** (fallback when nothing dated)
- **Reminders Due Now** — triggered, awaiting action
- **Reminders Upcoming Today** — will fire later today
- **Outbox Pending** — mail queued, not yet sent (lands on the Outbox tab via the v34.31 mail-outbox action)
- **Calendar Today** — events on the calendar
- **Bloom New** — saved seeds since last viewed

Each row is a tap target into the relevant view. Empty state copy points users to ⌘ ⇧ G. Time-aware greeting (Late night / Good morning / Good afternoon / Good evening / Late evening). Same gold monogram disc + bloom halo header pattern as the welcome modal + transition email + What's New, for visual continuity.

Listed in the shortcuts overlay's ⌘K command examples as `"brief"` so users discover it.

---

## v34.34 — Native PWA install prompt

Listens for the browser's `beforeinstallprompt` event, defers the default UI, and surfaces a small gold-accented banner in the bottom-right corner ~1.2s after the event fires (giving the welcome modal / auth gate time to settle).

- Banner uses the gold monogram disc + bloom halo to match the splash, welcome modal, and email aesthetics
- "INSTALL BRILLIANCE" eyebrow + "Run as an app, faster open, native notifications." copy
- Filled gold "Install" CTA runs the deferred prompt; ghost "Not now" persists `roweos_pwa_install_dismissed=true`

**Hidden when:**
- Already installed (`display-mode: standalone` or iOS `navigator.standalone`)
- User previously dismissed
- Auth gate or welcome overlay is up
- `appinstalled` event fires (also stamps the dismissed key)

Slide-in keyframe injected once. iOS Safari doesn't fire `beforeinstallprompt` so those users keep using Add to Home Screen — no banner there.

---

## v34.33 — Brilliance Transition email opening rewritten (per Jordan)

Per Jordan: the original opening only said the platform was renamed, not what it actually does. New copy leans hard into the value proposition and concrete day-to-day enablement.

**New opening structure** (replaces three short paragraphs):

1. **"RoweOS is now *Brilliance*"** with italic gold accent on the name to match the splash + welcome surfaces.
2. **The big claim**: "Brilliance is built to run the brands you operate, the life you're actually living, and the small thousand decisions in between. One workspace where your business intelligence and your personal world sit beside each other and inform each other."
3. **Three concrete day-to-day examples**:
   - Goal threading from morning into calendar / automations / writing / inbox
   - Client-context recall pulling from every prior conversation with that client
   - Three-second idea capture that the system finds again when it matters
4. **Reassurance**: same platform, same memory, same work, only the name and the orb and the surfaces have changed.

Updated in both the client preview path (`generateBrillianceTransitionEmail()`) and the server pipeline (`buildBrillianceTransition()`) so admin sends and admin previews both get the new copy. No em-dashes; commas / ASCII hyphens only.

---

## v34.32 — Em-dash sweep across v34.x copy

Project memory says **no em-dashes in generated text content** but I'd been sneaking them into v34.x user-visible copy. Audited and replaced every em-dash in user-facing strings across the surfaces I touched this series:

- v34.10 What's New modal items (Brilli intro, ⌘⌥B intro, concierge intro)
- v34.17 shortcuts overlay items (⌘⇧F, ⌘K, ⌘⇧G, ⌘⇧N)
- v34.30 ⌘K Focus alias desc
- v34.4 Brilli Classic BLAKE description
- v34.6 admin error toasts (Add Person permission denied, test send)
- v34.8 "Test sent to X" toast
- launch screen tagline ("v34.32, same platform · new surfaces")

Replaced with comma, period, or rewritten phrase. ASCII hyphens and `· ` separators kept intact (they're not em-dashes). Console.warn / debug strings left alone since the rule is for user-visible copy.

---

## v34.31 — Brilliance Transition email subject (per Jordan), Outbox pill lands on Outbox

### Brilliance Transition email subject
Per Jordan's request, retitled and dropped the em-dash:
- **Was:** "RoweOS is now Brilliance — what changed (and how to keep building)"
- **Now:** "Welcome to Brilliance. What changed, and how we keep building."

Updated in both the client preview (`generateBrillianceTransitionEmail()` in `22-firebase-sync.js`) and the server pipeline (`buildBrillianceTransition()` in `api/send-template-email.js`) so the subject reads consistently regardless of which path triggers the send.

### Outbox concierge pill lands on the Outbox tab
Was navigating to Mail's landing/inbox; users had to click again to reach the pending list. Added a `mail-outbox` value to the v34.24 `_action` dispatcher: `showView('mail')` then `setTimeout(switchMailTab('outbox'), 80)` so the tab swap fires after the view's initial render.

---

## v34.30 — Two more ⌘K aliases (focus, settings)

- `focus` / `toggle focus` / `focus mode` → calls `toggleFocusMode()` (or falls back to toggling the `focus-mode` body class). Desc surfaces `⌘ ⇧ F`.
- `settings` / `open settings` / `go to settings` → calls `showView('settings')`. Faster than navigating the sidebar, especially on mobile.

---

## v34.29 — Brilliance Transition email actually sends (bugfix), plus three ⌘K aliases

### BUGFIX — `brilliance_transition` was rejected by the validation whitelist
The Brilliance Transition email send was failing with **400 "Invalid template. Must be one of: …"** every time. v34.8 added the `case 'brilliance_transition'` branch to the server template router AND the `buildBrillianceTransition()` builder, but missed updating the `validTemplates` array on line 771 of `api/send-template-email.js`. So when admin clicked "Send Test to Me" or "Send to Selected" with that template chosen, the server rejected the request with 400 *before* the builder ever ran.

Added `brilliance_transition` to the whitelist. Send works end-to-end now.

### Three new ⌘K command aliases
- `sync` / `sync now` / `force sync` / `cloud sync` / `push` / `pull` → `manualSyncNow()` with a "Syncing…" toast (was only reachable via Settings → Cloud Sync)
- `sign out` / `log out` / `signout` / `logout` → `signOut()` (or `firebase.auth().signOut()` fallback)
- `concierge` / `toggle concierge` / `hide concierge` / `show concierge` (but not `customize concierge`, which keeps opening the customizer) → flips `roweos_concierge_off` and re-renders / hides the row inline, with toast confirmation

---

## v34.28 — Pulse pill surfaces overdue + due-today

The Pulse concierge pill used to read only "X goals" — accurate but not actionable. Now walks every open goal's `items` array and counts items whose `date` / `dueDate` is today or earlier:

- **Any overdue items** → "X overdue" (urgency 95, sits between Reminders-due and Outbox)
- **Today only** → "X due today" (urgency 75, above Today calendar 70)
- **Nothing dated** → "X goals" (urgency 40, original behavior)

Same view target (Pulse), same gold star icon — only the urgency framing changes. With the v34.27 concierge sort, the leftmost pill is now the most pressing thing on your plate even when it lives in Pulse.

---

## v34.27 — Concierge pills sort by urgency

Each push site in `_renderConciergeRow()` now tags its pill with an `_urgency` value, and a stable descending sort runs right before render. Time-sensitive surfaces always lead the row:

| Pill | Urgency |
|---|---|
| Reminders due | 100 |
| Outbox pending | 90 |
| Today's calendar | 70 |
| Today / Evolve done | 65 |
| Pulse goals | 40 |
| Automations | 30 |
| Evolve days | 25 |
| Evolve streak | 20 |
| Notebooks new | 18 |
| Bloom new | 15 |
| Resume | 10 |

Behavior is invisible when ≤1 pill is active. With multiple pills, the leftmost pill is now always the most time-sensitive thing on your plate.

---

## v34.26 — Spotlight "Try" suggestions, Studio button surfaces shortcut

### Universal Search empty state — "Try" group
When the spotlight first opens (no query), the panel now shows a "Try" group with seven suggested commands so users learn the v34.x command palette aliases on first encounter:

- `help` — open the keyboard shortcuts panel
- `add goal …` — quick-add to Pulse Unassigned
- `remind me to …` — quick-reminder modal
- `note …` — quick note → Notebooks · Quick Capture
- `brilli firefly` — set Brilli to Firefly form
- `split-pane` — toggle Studio Split-Pane
- `theme` — toggle light / dark mode

Clicking a row pre-fills the input and runs the search. Slots in below "Recent" when there are recent searches.

### Studio Split-Pane button shows the keyboard shortcut on hover
The action-bar toggle's `title` attribute now ends with "(⌘ ⌥ P)" so the v34.11 keystroke surfaces for any user who pauses on the button without knowing the shortcut.

---

## v34.25 — ⌘ ⇧ N quick note (third member of the quick-add family)

Third quick-add shortcut after v34.19's ⌘⇧G (Pulse) and v34.20's ⌘⇧R (reminders). Drops a multiline note straight into a Notebooks "Quick Capture" notebook so users can capture a thought without changing context.

- Modal centered near the top of the viewport, multiline `<textarea>` (Enter inserts a newline; ⌘/Ctrl + Enter saves so notes can include real paragraph breaks)
- Finds or creates a "Quick Capture" notebook in `roweos_scribe_notebooks`
- Prepends a timestamped block to the top of `notebook.content` (newest entries first)
- Updates `_modifiedAt` so the v34.16 sidebar Notebooks pill picks it up
- Pushes through `writeDB('scribe/main', { notebooks })` so cloud sync stays current
- Same skip-when-typing guard, Esc cancels, click-outside cancels

Listed in the Focus / Universal section of the shortcuts overlay alongside ⌘⇧G / ⌘⇧R, and a matching ⌘K alias picks up `note X` / `new note X` / `quick note X` queries.

---

## v34.24 — Concierge empty-state cycles through power-user tips

When there are no live signals (no open goals, no automations, no due reminders, etc.) the concierge row used to show only "Begin · Set a goal in Pulse". Now rotates through six tips that surface the v34.x power-user shortcuts:

- "Begin · Set a goal in Pulse"
- "Try · ⌘ ⇧ G to capture a goal"
- "Try · ⌘ ⇧ R for a quick reminder"
- "Try · ? for the shortcuts panel" *(opens the v34.17 overlay directly)*
- "Try · ⌘ ⌥ B to cycle Brilli"
- "Customize · Pick which pills appear" *(opens the v34.5 customizer)*

Picks deterministically by day-of-year so the tip stays consistent within a day but changes daily — no flicker, no per-load randomness, but new context tomorrow. Click handler in `00-api-bridge.js` extended with an `_action` override so shortcut/customizer tips trigger their respective overlays instead of navigating somewhere.

---

## v34.23 — "Keyboard Shortcuts" Settings row

Discoverability follow-up for the v34.17 shortcuts overlay — until now, the only ways in were the `?` key and ⌘K aliases, which themselves require knowing the shortcut. New "Keyboard Shortcuts" row in Settings → Appearance, immediately below "Reset Brilliance Preferences", opens the same overlay. Custom keyboard SVG icon. Desc copy "Every Brilliance keystroke + ⌘K command in one panel. Also opens with `?`." so users learn the keystroke alternative on the way to using the overlay.

---

## v34.22 — Mobile concierge horizontal-scrolls instead of multi-row wrapping

After v34.16 (Outbox + Notebooks pills) and v34.20 (Reminders), the concierge could surface up to nine pills (Pulse, Automations, Bloom, Today, Evolve, Reminders, Outbox, Notebooks, Resume). On mobile (max-width 768px) the existing `flex-wrap: wrap` was pushing the chat input way down whenever a few of those lit up.

Mobile concierge now:
- `flex-wrap: nowrap` + `overflow-x: auto` with `-webkit-overflow-scrolling: touch`
- WebKit scrollbar hidden (already invisible on Safari, hidden on Chrome iOS too)
- `scroll-snap-type: x proximity` so swipe gestures land cleanly
- `flex-shrink: 0` on each pill so they don't squish
- `justify-content: flex-start` so the most-relevant pill is always visible first

Desktop layout (720px max-width container, center alignment, multi-row wrap) is unchanged.

---

## v34.21 — ⌘ ⇧ L toggles light / dark mode

Familiar keystroke from Linear, Cron, Raycast — quicker than digging into Settings → Appearance to flip the theme. Wired in `34-brilli.js` with the same skip-when-typing guard as the other ⌘⇧* / ⌘⌥* shortcuts. Reads the resulting `light-mode` html class and surfaces a toast confirmation ("Light mode" / "Dark mode").

Listed in the Focus / Universal section of the shortcuts overlay alongside the other ⌘⇧* keys, and a matching ⌘K alias picks up `theme` / `toggle theme` / `dark` / `light` / `dark mode` / `light mode` queries.

---

## v34.20 — Quick-add reminder (⌘ ⇧ R), symmetric to ⌘ ⇧ G

### `⌘ ⇧ R` — set a reminder without leaving context
Symmetric to v34.19's Pulse quick-add. Anywhere in the app, opens an inline modal that captures a title + a datetime, then writes a `roweos_reminders` entry via the existing `saveReminderToHistory()`.

- Default time = **+1 hour** so single-line capture still produces a usable reminder
- Toast confirms with a relative-time hint ("in 23 min" / "in 4 hr")
- Same skip-when-typing guard, Esc cancels, Enter submits, click-outside cancels
- Sidebar Pulse dot + Concierge Reminders pill refresh immediately

### ⌘K alias: `remind me to X` / `reminder X` / `remind X`
Pre-fills the quick-reminder modal with the captured text.

### Shortcuts overlay updated
Focus / Universal section lists ⌘ ⇧ R alongside ⌘ ⇧ G so users see the symmetry.

---

## v34.19 — Pulse quick-add (⌘ ⇧ G + ⌘K writes goals for real)

### `⌘ ⇧ G` — capture without leaving context
New keyboard shortcut anywhere in the app opens an inline modal centered near the top of the viewport. Captures one line and writes it as an item on the **Unassigned** Pulse goal via the existing `addItemToPulseGoal(null, {text})` flow. Sidebar dot + concierge row refresh immediately so the new item shows.

- Same skip-when-typing guard as the v34.9 / v34.18 shortcuts
- Esc cancels, Enter submits, click-outside cancels
- Listed in the Focus / Universal section of the shortcuts overlay

### ⌘K "add goal/task" actually creates them now
The existing `add goal {text}` / `add task {text}` / `new goal {text}` patterns no longer just navigate to Pulse — they now CREATE the item via the same `addItemToPulseGoal()` path with toast confirmation and sidebar / concierge refresh. Search desc copy includes the keyboard shortcut hint so users learn the keystroke version while they discover the command.

---

## v34.18 — `?` key opens shortcuts overlay, ⌘K placeholder hints

### `?` opens the Keyboard Shortcuts overlay
Familiar convention from GitHub, Linear, Notion. Plain `?` (no modifiers) when focus is not in an input/textarea/contentEditable opens the v34.17 shortcuts modal. Skips when modifiers are held (so ⌘? / ⌃? combos still belong to the OS) and skips when the overlay is already open or the search modal is up so we never stack overlays.

### ⌘K placeholder hints the new commands
The Universal Search input placeholder is now richer: "Search, ask, or try `help`, `brilli firefly`, `split-pane`, `add goal …`". Broadcasts the v34.12 / v34.17 command aliases on first encounter so users learn them while they search. The `?` shortcut is also listed in the Focus / Universal section of the overlay itself.

---

## v34.17 — Keyboard Shortcuts overlay + ⌘K command aliases

### `window.showShortcutsOverlay()` — single-panel reference
A new modal that lists every Brilliance shortcut + power-user command in one place. Same Georgia-eyebrow + monogram-disc header pattern as the What's New modal so the two feel like a pair.

Sections:
- **Brilli** — ⌘ ⌥ B (cycle), Settings → Appearance (specific picks)
- **Studio** — ⌘ ⌥ P (toggle Split-Pane)
- **Focus / Universal** — ⌘ ⇧ F (Focus Mode), ⌘ K (search), Esc (close anything)
- **⌘K command examples** — `brilli firefly`, `cycle brilli`, `split-pane`, `customize concierge`, `reset prefs`, `what's new`, `new email to {name}`, `run {automation}`, `open {view}`, `add goal {text}`

### Four new ⌘K command aliases
- `help` / `shortcuts` / `?` — opens the shortcuts overlay
- `what's new` / `changelog` / `release notes` / `news` — opens What's New modal directly
- `reset prefs` / `reset preferences` — calls `resetBrilliancePrefs()`
- `concierge` / `customize concierge` — opens the customizer modal

Each is a discoverability shortcut for functions that already exist but were buried in Settings menus.

---

## v34.16 — Two new concierge pill types: Outbox, Notebooks

Answers Jordan's earlier "anything else they can do?" feedback (Image #51) for the concierge row.

- **Outbox** — counts pending Mail outbox items in `roweos_mail_outbox` (anything not `sent` / `failed` / `cancelled`). High-signal: reminds you when sends are queued but haven't fired. Tap routes to Mail.
- **Notebooks** — counts entries in `roweos_scribe_notebooks` whose `_modifiedAt` / `updatedAt` / `createdAt` is newer than `roweos_scribe_last_seen`, mirroring the v34.15 Bloom pattern. New `markScribeViewed()` clears the badge when the user opens Notebooks.

Both pills are listed in the Customize Concierge modal so users can toggle them like the original seven, and both honor the existing `_conciergePillEnabled(key)` gate.

---

## v34.15 — Bloom badge logic — actually correct now

The v34.13 Bloom badge wiring assumed `roweos_bloom_library` was a flat array of items with a `.read` flag. Actually it's `{scope: [items]}` (e.g. `{ "brand_0": [...], "life_0": [...] }`), and items don't track read state at all — so the v34.13 `Array.isArray(bl) && bl.some(...)` check always fell through to false and the dot never lit up. The concierge "Bloom" pill in `00-api-bridge.js` had the same flaw inherited from earlier code.

Replaced with an Automations-pattern "new since last viewed" check in both places using a new `roweos_bloom_last_seen` localStorage key:
- Walks every scope's items and compares `_modifiedAt` / `savedAt` / `createdAt` against the saved timestamp.
- Sidebar badge in `28-reminders-notifications.js` updates on the existing 60s interval.
- Concierge pill in `00-api-bridge.js` shows actual count of new items.
- New `markBloomViewed()` in `28-reminders-notifications.js` (mirror of `markAutomationsViewed`) stamps the key and clears the badge; wired to `showView('bloom')` in `11-agents.js` so opening the view dismisses the dot.

Legacy flat-array fallback retained on the concierge side for any old data still floating around.

---

## v34.14 — "Reset Brilliance Preferences" surfaced in Settings

`resetBrilliancePrefs()` has existed since v33.49 but was console-only — anyone who wanted to undo every Brilliance flag (Brilli form + intensity, Evolve / Quiz / Verifier engine flags, Concierge dismiss state, Sync v5 flags, Focus Mode disabled, Letter Series, Tier 2 surface toggles, What's New silenced, etc.) had to know the global. New Settings row immediately below "Customize Concierge" calls it directly. Same `confirm()` flow + same explicit "Your data is unaffected" copy in the modal so users feel safe; row description mirrors that promise.

---

## v34.13 — Live status dots on Pulse + Bloom in the sidebar

The existing `updateSidebarBadges()` only managed Automations (completed since last seen) and Mail (unread inbox). Pulse and Bloom had no live indicator that anything new was waiting, so users had to navigate in to check.

- **Pulse** turns on when there are any open (non-completed, non-archived) goals in `roweos_pulse_goals`, OR any due reminders in `roweos_reminders`. Matches the Concierge row's "Pulse" pill logic so they feel coherent.
- **Bloom** turns on when any item in `roweos_bloom_library` has `read !== true`.

No CSS work — reuses the established `.nc-badge.has-unread` styling from Automations and Thought Board pin counts. Counts already refresh on auth, on Automations init, and on the existing 60s interval, so the new badges piggyback on that lifecycle without new timers.

---

## v34.12 — Universal Search command coverage for Brilli + Studio

The v34.9 and v34.11 keyboard shortcuts (⌘⌥B for Brilli cycle, ⌘⌥P for Studio Split-Pane) are great if you remember them — but power users live in ⌘K. Three new patterns in `searchActions()`:

- **"brilli {form}" / "set brilli to {form}" / "switch form to {form}" / "use {form}" / "change brilli to {form}"** — recognizes `celestial`, `aura` (or `field`), `firefly`, `signature` (or `light`), and `classic` (or `blake`). Calls `Brilli.setActiveForm(target)` directly.
- **"cycle brilli" / "cycle form"** — same celestial → aura → firefly → signature → classic loop the keystroke does, but discoverable via search.
- **"split-pane" / "toggle split-pane" / "studio split-pane"** — switches to Studio (if not already there) and toggles the split-pane workspace.

Result desc copy includes the keyboard shortcut hint (`⌘ ⌥ B cycles…`, `⌘ ⌥ P`) so users learn the keystroke version while they discover the command.

---

## v34.11 — Two more power-user shortcuts

### ⌘ ⌥ P toggles Studio Split-Pane (Studio only)
Mirrors the v34.9 ⌘ ⌥ B Brilli-cycle pattern. Wired in `44-split-pane.js` with the same input/textarea/contentEditable focus-skip guard, and *only* fires when the Studio view is the visible panel — keeps the keystroke from interfering with other surfaces. Reuses the existing `toggle()` so the toast confirmation and persistence (`roweos_studio_split_pane`) stay consistent.

### Sidebar version label opens What's New
The version label in the bottom-left corner of the sidebar (`#sidebarVersionDisplay`) is now a clickable button. One click opens the What's New modal with the current version's changelog — no more hunting through Settings → System for it. Tooltip "What's new in this version" surfaces the gesture; Enter / Space work for keyboard accessibility.

---

## v34.10 — What's New refreshed for v34.x, chip strip mobile-safe

### What's New modal — actually about v34
The hardcoded item list in `showWhatsNewModal()` was still telling the v33.50 → v33.80 story (Focus Mode, Time Ribbon, Letter Series, Folio, Thought Board, Calendar restoration, light-mode deepening) — none of that is news to anyone on v34. Replaced with eight v34.x highlights:
- RoweOS → Brilliance rebrand
- Brilli as the face of the AI (5 forms, gold orb)
- ⌘⌥B form-cycle shortcut + chip strip
- Concierge customizer
- Redesigned welcome / restore / onboarding screens
- Studio Split-Pane workspace
- Email Admin "+ Add Person" + Brilliance Transition flow
- Focus Mode (returning highlight)

The header dot is now the gold monogram disc with bloom halo (graceful fallback to the old radial gradient if the image can't load), so the modal opens with the same visual signature as the splash, the post-login welcome, the data-restore prompt, and the transactional emails.

### Chip strip, mobile-safe
The v34.9 inline Brilli form chip strip in Settings now flex-wraps to **horizontal-scroll on narrow viewports** instead of awkwardly bumping into a second row. WebKit scrollbar hidden, subtle hover lift on each chip, light-mode contrast overrides matching the rest of v34.x.

---

## v34.9 — Brilli power-user surface

### ⌘ ⌥ B / Ctrl+Alt+B cycles Brilli forms
New keyboard shortcut wired in `34-brilli.js`. Cycles celestial → aura → firefly → signature → classic → celestial. Early-returns if focus is in an input/textarea/contentEditable element so it never hijacks typing. Toast confirms the new form (existing `setActiveForm` flow).

### Inline form chip strip in Settings → Appearance
Five mini-orb chips immediately below the Brilli Form row. Each chip is painted with the same gradient/glow as its full form (matching the v34.6 preview-dot system), so users can see-and-pick in one glance without opening the picker modal. The active chip gets a gold-tinted background and accent border that updates on every form change via the existing `brilli:form-changed` event.

The Brilli Form row label now also includes a quiet "⌘ ⌥ B to cycle" hint to surface the new shortcut.

---

## v34.8 — Brilliance Transition email actually sendable, "Send Test to Me", post-beta copy

### Brilliance Transition email — admin can finally send it
Two missing pieces meant the rebrand-announcement email Jordan flagged in Image #56 couldn't actually go out from the admin:
- The bulk-send `<select id="adminEmailTemplate">` in `src/html/brand/25-admin.html` was missing the `brilliance_transition` option (only the per-user Quick Actions row had it).
- The server template router in `api/send-template-email.js` had no `case 'brilliance_transition'`. Even if the dropdown sent it, the server would return `null`, the request would 200, and nothing would deliver.

Fixed both: added "Brilliance Transition (Rebrand)" as the top option in the admin dropdown and the composer modal dropdown (`27-modals.html`), and added `buildBrillianceTransition()` server-side that mirrors the client `generateBrillianceTransitionEmail()` — same body sections, same inline SVG provider cards (Anthropic A-monogram, Gemini sparkle, OpenAI knot copied verbatim from `dist/info.html`), same gold gradient "Get API Keys" CTA, same `trackedUrl` attribution.

### "Send Test to Me" admin button
New button next to "Send to Selected" in the Email Management bar. Sends the currently-selected template to the signed-in admin's own email so you can verify how Resend renders the monogram + gold gradients + dark-mode treatment before launching a bulk send.

### Onboarding "Welcome" step — post-beta polish
"Welcome to the Brilliance Beta" → **"Welcome to *Brilliance*."** with italic gold accent on the wordmark. Replaced the abstract triangle stack with the same gold-bloom monogram disc used on the launch / restore prompt / transition email, so every "first impression" surface is visually consistent. Subtitle is now "Operating intelligence, accessible." Body copy reframes Brilliance as a positioned product rather than a beta.

Two leftover "Beta key access" lines in the sidebar onboarding API-key panel (`21-sidebar.js`) rewritten to "if you'd rather we provision a key for you" — consistent with the post-beta posture in 02-shell-batch1.html and the splash redesign.

---

## v34.7 — Server emails fully rebranded to Brilliance

The client-preview emails (`_emailPreviewWrap()`) and the Brilliance Transition email already used the new gold monogram + italic accents from v33.98 / v34.2 / v34.3, but the server-side path still rendered "RoweOS" text in the header with the old `https://roweos.com/logo.png` file. Every transactional / lifecycle email now matches the rest of v34.x.

**Updated server templates** (all in `RoweOS/dist/api/`):
- `send-template-email.js` `wrapEmail()` — replaces the entire header chrome with the gold monogram + bloom halo + BRILLIANCE eyebrow + italic Georgia tagline; body bg from flat `#1a1a1a` to warm `#14110d` with rgba gold borders; primary CTA (View Plans) uses the gold gradient `#d4b87f → #b8975f` on `#1a1610` text; secondary CTA (Get API Keys) uses the gold-outline pattern; refined footer rule.
- `notify-signup.js` welcome email — same monogram header, italic gold provider names in the bullet list, gold-gradient primary CTA, refined cream-on-deep-bg copy. Signup notification email's inline header text changed from "RoweOS" to "Brilliance".
- `stripe-webhook.js` access-key, API-key delivery, and Welcome-to-Brilliance emails — all `<h1>RoweOS</h1>` headers flipped to `<h1>Brilliance</h1>`, all "Welcome to RoweOS X" → "Welcome to Brilliance X", subjects updated, "RoweOS Admin" copy fixed.

**Send-from aliases** changed from `RoweOS <roweos@therowecollection.com>` to `Brilliance <roweos@therowecollection.com>` everywhere; subject lines flipped (e.g. "New RoweOS Signup" → "New Brilliance Signup", "Welcome to RoweOS - Get Your Access Key" → "Welcome to Brilliance — Get Your Access Key"). The `email_log` template subject is logged with the new copy too.

No client-side code changes; this is purely a server-output refresh so all transactional + lifecycle emails finally read consistent with the rest of v34.x.

---

## v34.6 — Bugfixes (Add Person, stray circle), welcome polish, customizer reset

### BUGFIX — "+ Add Person" was failing silently
Firestore rules for `newsletter_subscribers` granted only `read/delete/list/update` to the admin UID. There was no `create` rule, so `db.collection('newsletter_subscribers').doc(email).set(...)` got rejected with `permission-denied` and the rejection wasn't surfaced beyond a toast that's easy to miss.

- Added `allow create` in `RoweOS/dist/firestore.rules` for the admin UID
- Deployed the updated rules to Firestore
- The Add Person modal now has a persistent inline status row that prints the actual error (including the "Permission denied — run firebase deploy --only firestore:rules" hint) so future rule mismatches are obvious instead of silent
- Modal also bails early with a clear message if `firebaseUser` is missing

### BUGFIX — stray half-circle on the welcome screen (Image #55)
"I don't know what that circle up there is but it's not necessary." It was the legacy `welcome-theme-toggle` button — a duplicate theme switcher that rendered the U+25D0 LEFT HALF BLACK CIRCLE glyph above the brand cards. Removed entirely; theme is still toggleable from Settings → Appearance and the launch screen icon.

### Welcome-back data restore prompt (Brilliance aesthetic)
Was: plain cloud SVG, "Welcome back!", "Restore Data" / "Start Fresh" buttons. Now:
- Gold monogram disc with bloom halo (falls back to cloud SVG if image fails)
- BRILLIANCE eyebrow in tracked uppercase
- "Welcome back, [italic gold *name*]." — first name in italic gold accent
- Refined cream-on-deep-bg outline button + gold-gradient primary CTA, matching the rest of v34.x

### Concierge customizer: Reset to Defaults
New "Reset to Defaults" link in the customizer modal. Clears `roweos_concierge_pills` and re-checks every box, then re-renders the row.

### Settings → Appearance Brilli row: live preview dot
The static circle icon next to "Brilli Form" now repaints itself to hint at the active form's character: celestial radial glow, aura layered halo, firefly off-center bright dot, signature conic ribbon, classic gold orb. Updates automatically on form change via the existing `brilli:form-changed` flow plus a new `updateBrilliSettingsPreview()` helper.

---

## v34.5 — Classic BLAKE switches instantly, customizable concierge

### Classic BLAKE — immediate switch
Selecting Classic BLAKE now wakes the WebGL blob the moment the picker closes, matching the snappiness of the canvas forms. Image #47: "they all switch over immediately except blob."

`Brilli.setActiveForm()` now post-processes per-form:
- `classic` → `initBlob()` (no-op if already initialized) + `startBlobAnimation()` + `resizeBlob()` after a 50ms tick. The blob's RAF loop and WebGL context come back to life right away instead of staying frozen.
- non-classic → `stopBlobAnimation()` so the WebGL RAF doesn't keep ticking off-screen behind the canvas form.

### Customizable concierge row
New **Customize Concierge** row in Settings → Preferences (just under the existing Concierge On/Off toggle). Opens a modal with seven checkboxes — Pulse, Automations, Bloom, Today, Evolve, Reminders, Resume — each backed by `roweos_concierge_pills` localStorage map (object of bool, omitted = enabled by default).

Implementation: `_renderConciergeRow()` wraps each pill candidate in a `_conciergePillEnabled(key)` check before pushing to the pills array. Toggling a checkbox writes the map and re-renders the row inline. Empty-state Begin pill still surfaces if every check disables a pill *or* nothing has data yet.

---

## v34.4 — Brilli + concierge polish, PWA cycling fix, email "Add Person"

### Form picker
- Selecting a form now **closes** the picker (was re-rendering itself, which felt stuck — Image #49). Toast confirms the choice.
- **Picker entry removed from the main chat hero** (Image #53) — `brilliHero` no longer has an onclick or keyboard handler, the hovering switch button on `blobContainer` is gone. Settings → Appearance is the only entry point.
- Classic BLAKE description: "WebGL" → "Brand & Life AI Knowledge Engine" (Image #46–47).

### Light mode picker visibility
Light-mode overrides for `#brilliFormPickerOverlay` so the modal panel, card borders, label/desc text, and Done button are legible against the cream background — previously the white-on-cream rgba inline styles collapsed (Image #49).

### Firefly form, restored to spec
The original spec called for a luminous wings + body + trail. Previous values rendered too faint compared to the other forms (Image #48):
- Body radius 0.10 → 0.14, slightly larger ellipse
- Halo 0.50 → 0.55 with brighter alpha
- Wings: bigger ellipses, doubled alpha (0.30 → 0.50), shifted further off body
- Ambient trail: 6 dots → 10 dots, switched to `c.light` for visibility, larger radius and higher alpha

### Concierge row
- **Removed the X dismiss button** (Image #51). The toggle still exists in Settings → Concierge — closing per-pill was redundant.
- Pulse + Automations icons rebuilt to **match the sidebar SVGs** (4-point compass for Pulse, sun-burst gear for Automations) so the concierge row feels native to the rest of the surface.

### Email Admin: "+ Add Person"
New **+ Add Person** button in the action bar of the Email tab. Modal collects email + optional name + optional access key + source tag, writes a `newsletter_subscribers` doc and (if a key is provided) updates the `access_keys` doc with `assignedEmail`. The added person shows up in the user list immediately. (Image #51 — "in Email i want the ability add somebody to the email list like a person and link them if need be to their access key".)

### PWA refresh cycling
PWA was cycling between the "Welcome back, Jordan!" restore prompt and the actual content on every refresh (Image #54). Root cause: `roweos_initialized` is the only marker `_handlePostKeyCloudCheck` consults to decide silent-restore vs. prompt, and that flag can be missing on PWA cold boot before the storage shim hydrates from IndexedDB.

Fix: also key off **`roweos_last_uid`** — write it on every successful restore (silent + accept), and silent-restore whenever the saved UID matches the currently-authenticated user. Previously initialized devices stop seeing the prompt on refresh.

---

## v34.3 — Email provider cards match roweos.com/info exactly
v33.98 and v34.2 attempted to use external Wikipedia SVG URLs for the Anthropic / Gemini / OpenAI marks in the Brilliance Transition email. Most email clients block or fail to render external SVGs from third-party origins, so the cards rendered as chunky outline boxes with broken images (Image #43).

Replaced with **inline SVG paths copied verbatim from `dist/info.html`**:
- **Anthropic** — the actual A-monogram glyph
- **Gemini** — the four-point sparkle  
- **ChatGPT** — the OpenAI knot/rosette

Each card now uses the same design language as the live /info "Three engines. One platform." section:
- Gold-tinted square icon tile (44px, 10px radius, dark inner with gold border)
- The brand SVG inside, filled `#c9a961` (the same gold-3 token /info uses)
- Italic Georgia serif name below (Claude / Gemini / ChatGPT) at 18px
- Tracked uppercase sublabel (Anthropic / Google / OpenAI) at 10px

Email-safe (no external image fetches, no CSP issues, no blocked third-party origins), brand-accurate, and the cards now read identically to the live page.

## v34.2 — Welcome splash + email use the cursive Brilliance monogram

### Wrong screen fix
v34.1 edited the post-login `launchScreen` (the legacy "BrandAI launch dashboard"). The screen Jordan was actually seeing — and asked to redesign — was the pre-login `authSplash` in `src/html/core/02-shell-batch1.html`. v34.2 corrects that.

### What the splash looks like now
- "Welcome, to" eyebrow (kept).
- **Cursive gold "Brilliance by RoweOS" monogram** at 220px, replacing the celestial orb. The image already contains the wordmark + "by RoweOS" subscript, so the redundant `<h1>Brilliance</h1>` and `by RoweOS` lines below it are retired. Soft bloom halo behind it (radial gradient, 6s breathe) so it doesn't read flat against the dark background. The monogram itself does a subtle 1.5% scale breath every 6s.
- Thin gold rule + "Intelligence OS" line for a moment of breathing room.
- **"Be Brilliant."** hero tagline. "Be" stays roman in cream `#f5ecd9`; "Brilliant." is italic in deep gold `#e2c79b`. clamp(34px, 5.5vw, 58px).
- **Begin** (filled gold gradient → triggers existing `triggerGoldTransition()` flow) + **See the Platform** (outline → `/info`).
- **Backed by · Google for Startups** footer.

### What was retired
- "Early Access" pill (Brilliance is no longer in beta).
- Standalone "Learn More" link (See the Platform absorbs the role).

### Email parity
The Brilliance Transition email header now uses the same `/images/brilliance/monogram-circle.png` (140px, circular) instead of the v33.98 stack of square app-icon + wordmark. One unified brand mark across the splash and the email — the monogram handles both jobs since it already contains the wordmark.

## v34.1 — Landing redesign ("Be Brilliant." combo)
Jordan sent two reference shots and asked for "some combo form" — Image #38 was the rich gold "Be Brilliant." finance-page hero with cursive B monogram + dual CTA + Backed by Google for Startups footer; Image #39 was the current minimal Brilli orb landing. The new launch screen merges them.

### What stays
- Live Brilli orb at the top (Bloom + Shell + Core + 6 sparks) — keeps the active form/identity system visible. Honors the user's chosen Brilli form (Celestial, Aura, Firefly, Light Signature, Classic) since it's the same engine that runs in the chat hero.
- "Brilliance" wordmark + thin gold rule + "Intelligence OS" + "by RoweOS" lockup.

### What's new
- **"Be Brilliant."** hero tagline. Gold serif (Playfair Display falling back to Cormorant Garamond / Georgia). "Be" stays roman in cream `#f5ecd9`; "Brilliant." is italic in deep gold `#e2c79b`. clamp(38px, 6.5vw, 72px) so it scales from desktop to mobile without breaking.
- **Subscript meta line:** `Brilliance · Intelligence OS · by RoweOS` in 10px tracked DM Sans uppercase.
- **CTA pair:** **Begin** (primary, filled with the same gold gradient as the v33.84 Get API Keys button) + **See the Platform** (outline, links to `/info`). On <540px the pair stacks full-width.
- **Footer:** `Backed by · [Google for Startups logo] · Google for Startups` in the same DM Sans tracked uppercase. Replaces the v28.9 boxed "Cloud Program" badge.

### What's retired
- The mode toggle (BrandAI / LifeAI buttons) on the launch screen.
- The two option cards (BrandAI Chat, Studio).
- The 3-button action row (Explore + Add + Theme).
- The "Early Access" pill (now lives in the See the Platform path on /info).

Mode is now chosen on the first agent open instead of upfront on the landing — fewer decisions before the user sees Brilliance.

## v34.0 — Brilli form picker visibility fix
**Root cause of "stuck on Celestial":** The picker overlay creates with `className = 'modal-overlay'`, but the global `.modal-overlay` CSS rule (01-base.css:29507) sets `visibility: hidden; opacity: 0` by default and waits for a `.show` or `.open` class to flip it. The picker never added that class. Inline `cssText` set display/position/inset/background/backdrop-filter/z-index but NOT visibility or opacity, so the overlay (and everything inside it including the form cards) inherited `visibility: hidden`.

The cards were technically clickable — `pointer-events: auto`, `onclick` wired up correctly. Programmatic Playwright tests passed because they targeted elements directly without relying on visual inspection. But to a real user, the picker appeared to do nothing: row click triggers picker → picker overlay renders invisible → user stares at unchanged Settings → "stuck on Celestial."

**Fix:**
- `overlay.className = 'modal-overlay show'` — gets the global `.show` rules
- Inline cssText now explicitly includes `visibility:visible;opacity:1` — belt and suspenders against the global default

**v34.0 milestone:** Per Jordan's cadence directive (0.1 increments toward v34.0/v35.0), this picker fix was the last v33.x UX blocker before the v34 architecture sprint kicks off (services/sync hardening with `// @ts-check`, multi-model quiz pipeline, Verifier Engine). The round number is earned.

## v33.99 — Brilli form picker hardening + roweos.com/info logo swap

### Brilli form picker — couldn't switch away from Celestial
Jordan reported that clicking different forms in the picker left the form stuck on Celestial. Programmatic Playwright tests showed `setActiveForm` and the card click both worked, so the bug had to be in the visible feedback path. Hardened in three ways:

1. **`setActiveForm` no longer mutates while iterating.** Previously the function looped `for (i = instances.length - 1; i >= 0; i--)` and called `unmount(b)` (which splices the array) and `mount()` (which pushes back) inside the loop. Now we snapshot host/size/mode for every instance first, unmount all in reverse, then re-mount each from the snapshot. Hosts that were detached from the DOM (e.g., picker preview cards being removed) are skipped via `document.body.contains(host)` check.

2. **`setActiveForm` now sets `data-brilli-form` itself.** Previously only the picker's `card.onclick` set this attribute, so callers like keyboard arrow nav left the attribute stale. Now every form change sets it.

3. **Settings row labels update inline + toast confirmation.** `setActiveForm` now writes to `#brilliFormToggleText` and `#brilliFormDesc` directly so the user sees the change even if the picker was opened from a non-settings entry point. Plus a toast "Brilli form: <Name>" gives unambiguous feedback that the change took effect.

### v33.97 click-burst listener leak
Each `setActiveForm` call mounted a fresh instance, and each mount added a new click listener to the host. Listeners stacked across remounts — after 5 form switches, the host had 5 click handlers all writing to `b.ambientBurst` from different (now stale) closures. Fixed by tracking `el.__brilliClickBurst` and calling `removeEventListener` before adding the new one.

### roweos.com/info — Brilliance wordmark swap
Three places in `dist/info.html` (top-bar nav, hero, footer) embedded the legacy R-wordmark as a 5MB+ inline `data:image/png;base64,…` blob. Replaced all three with `<img src="/images/brilliance/wordmark.png">`, the file already shipped via the v33.86 swap. File size dropped from 5.5MB to 4.9MB. Other 29 inline screenshots preserved. CSS/HTML comments referencing "ROWEOS" updated to "BRILLIANCE".

## v33.98 — Brilliance Transition email redesign
Reworked from Jordan's screenshot feedback: the old R-glyph logo was still in the header, the body read like a release note, and the "Bring your own AI" section glossed over what's actually in the Brilliance stack.

### Header
- Swapped the legacy `https://roweos.com/logo.png` (old R-icon) for `https://roweos.com/images/brilliance/app-icon.png` (new gradient app mark, 72px, 16px radius).
- Added the Brilliance wordmark image (`wordmark-os-transparent.png`) below the icon, replacing the inline `<h1>` text. Title now reads as actual brand asset.
- Subtitle deepened to `#9a9a9a` for better contrast on the dark hero.

### Body — warmer, no em-dashes, no Sync Reconcile
- Em-dashes removed throughout. Replaced with periods or commas where intent allows.
- Opening reframed: "Same platform you've been using. Same memory of every brand and every life you've built inside it. Same work waiting where you left it."
- Section header changed from "What's new in this release" to "When you open Brilliance" — describes what the user *feels* rather than what shipped.
- Each surface card rewritten in plain language: "A gold orb on the chat hero" / "A quieter way to focus" / "A Concierge above the chat" / etc. Brilli's forms listed conversationally instead of comma-separated.
- Sync Reconcile section dropped — admin-tier detail with no end-user value.
- Evolve preview consolidated into the body without "v34 pipeline" mechanism mention.

### "Be brilliant with any model" — the three engines
New section at the bottom mirroring roweos.com/info "Three engines. One platform.":
- Three centered provider cards: Claude (Anthropic), Gemini (Google), ChatGPT (OpenAI). Each card shows the provider's actual SVG logo (Anthropic, Gemini, ChatGPT) with name + provider sub-label.
- Tagline: "Brilliance connects to the world's leading AI providers. Choose your model, switch anytime."
- Followed by: "Bring your own keys and pay only for what you use, or pick up a ready to go API key pack from us so you can start the moment your trial activates."
- Single primary CTA: **Get API Keys** → /purchase. Secondary subtle link: "Or open Brilliance" → /.
- Footer line: "Part of the Google for Startups Cloud Program. Built by The Rowe Collection in Austin, TX."

## v33.97 — Per-form Ambient defaults + click-burst
Jordan asked: should the Ambient Shape (currently bound to Classic BLAKE) also show up for Celestial / Aura / Firefly / Signature? And could clicking Brilli "spin the circles" without changing form? Answer: each form now gets its own passive ambient layer + a click-burst that briefly accelerates it.

### What each form looks like now (default ON)
- **Celestial** → two counter-rotating gold orbit arcs (1.55× and 1.95× the orb radius), one inner darker, one outer lighter. The thread reads as a slow gravitational orbit.
- **Aura** → eight field particles drifting along a 0.34 px radius, slow procession at 0.32 rad/s with breath-modulated radius. The pulse-ring engine already there is unchanged; this adds a particle layer.
- **Firefly** → six fading trail dots tracing a slow lemniscate behind the firefly's path. Each subsequent dot has 1/n alpha falloff.
- **Signature** → two offset ribbon arcs at 1.25× and 1.47× the orb radius, sweeping at slightly different speeds, painted behind the leading trail. The main trail remains the bright leading head.
- **Classic** → unchanged. BLAKE/Helix continues to be the canonical ambient.

### Click-to-burst
Click on any non-pin Brilli host fires `ambientBurst = 1` which decays over ~800ms. While burst > 0, ambient rotation/drift speeds up by `1 + 3·burst` and alpha amplifies by `1 + 1.6·burst`. The orb itself also picks up `pulseFlash = 0.85` so the core flashes briefly. No form change, no setting change — purely tactile.

### Settings
New row "Per-form Ambient" in Settings → Appearance, sitting between Brilli Intensity and Ambient Shape. Default ON. Persisted at `roweos_brilli_form_ambient`. The toggle dispatches a `brilli:form-ambient-changed` CustomEvent for any future listener.

### New public API
- `Brilli.isFormAmbientOn()` — read the toggle
- `Brilli.setFormAmbient(on)` — write the toggle
- `Brilli.burst(b)` — fire a burst on a specific instance from outside (e.g., when an outer wrapper captures the click first)

### Why
Closes the asymmetry where Classic BLAKE got an entire customization panel (B.L.A.K.E. / Helix / Both / colors / organism) while the four canvas forms had no ambient at all. Each form now feels like a finished, opinionated visual without forcing the user to fall back to Classic for "richness."

## v33.96 — Split-Pane row alignment + Brilli Intensity legibility
Two visible fixes from Jordan's screenshots.

### Studio Split-Pane row alignment
v33.94 anchored `#studioResultsPanel` with `grid-row: 7 / span 99` to land it on the same row as the cards. But auto-placement of the header chrome only consumed 5 rows (since `studioBrand` and `studioExpanderPanel` were `display: none` and skipped), so `studio-v2-content` ended up at row 6 col 1 while Output was forced to row 7 col 2 — Output rendered below the cards instead of beside them.

Fix: switched `.studio-v2` to `grid-auto-flow: dense` and removed the explicit `grid-row` from `#studioResultsPanel`. Auto-placement with dense packing now lands Output at row 6 col 2 (same row as cards) regardless of how many header rows are present. Empty Output placeholder picks up a dashed border for visual presence. Removed the gold-thread divider (was anchored to the explicit grid-row; the column gap reads cleanly without it).

### Brilli Intensity preset buttons — light-mode legibility
The Subtle / Calm / Default preset buttons in Settings → Appearance → Brilli Intensity used inline `background: rgba(255,255,255,0.04); border: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7)`. Against the dark theme that's fine, but on the cream light-mode bg it collapsed to white-on-near-white — Subtle and Calm appeared blank.

Fix: new `html.light-mode .brilli-intensity-preset` overrides apply dark text (`#5a4d2e`) + visible border (`rgba(60, 50, 30, 0.22)`). The [data-intensity="100"] "Default" pill keeps a richer gold tone (`#6b5520` text, `rgba(168, 140, 86, 0.55)` border) so it still reads as the active preset. Hover states deepen the contrast.

## v33.95 — Studio Split-Pane row alignment fix
v33.94 placed `#studioResultsPanel` via explicit `grid-row: 7 / span 99` to put it on the same row as the cards. But auto-placement of the header chrome (breadcrumb, panel-header, description, pillNav, actionBar — all `grid-column: 1 / -1`) only consumed 5 rows since `studioBrand` and `studioExpanderPanel` were `display: none` and skipped. So `studio-v2-content` landed at row 6 col 1 while Output was forced to row 7 col 2 — Output rendered below the cards instead of beside them.

Fix: switched `.studio-v2` to `grid-auto-flow: dense` and removed the explicit `grid-row` on Output. Auto-placement with dense packing now lands `#studioResultsPanel` at row 6 col 2 (same row as the cards) regardless of how many header rows are present. The empty Output placeholder picks up a dashed border so the right column has visual presence even when no agent has run yet. Gold-thread divider removed (was tied to the explicit grid-row anchor; the column gap reads cleanly without it).

## v33.94 — Parity round 2 + Studio Split-Pane layout fix
Two unrelated tracks landed in the same deploy.

### Studio Split-Pane Workspace — layout overhaul
Jordan flagged that the right column was eating Run History and squeezing the config-panel title to render one letter per line. Fixed both at once.

- Parent grid moved from `.studio-v2-content` to `.studio-v2`. Header chrome (breadcrumb, panel-header, description, pill nav, action bar, expander panel) now spans the full width on its own rows.
- Left column = `.studio-v2-content` restored to single-column block flow. Cards row on top, then `#studioConfigPanel` when an op is selected, then `#studioRunHistorySection`, then `#socialPostHistorySection`.
- Right column = `#studioResultsPanel` (Output) pinned sticky at top: 18px so it stays visible while the left column scrolls.
- Empty Output panel shows a "Select a task above and run an agent to generate content." placeholder so the right column never appears blank.
- Defensive `overflow-wrap: anywhere; word-break: normal; min-width: 0` on `#configTaskName` and `.studio-v2-config-title` — kills the per-character vertical-text bug that was triggered when the old grid squeezed the right column below the breakpoint.
- Below 1100px the layout collapses back to a single column (Output joins the bottom of the flow).

### Mail compose
- The "Brand Voice" tool button inside the writing-tools popover now reads **Personal Voice** in Life mode. Wrapped its label in `<span id="mailVoiceBrandLabel">` and extended `mailUpdateWritingToolsLabels()` (which already handles the popover header + tools-button label) to swap it. The action handler `mailVoiceAction('brand_voice')` remains the same — only the label is mode-aware, since the underlying voice merge already pulls from the right identity (brand voice for Brand mode, life voice for Life mode).

### Library / Studio op snippets
- `getOperationPreviewSnippet(op)` in `12-library.js` previously returned brand-flavored copy in every mode ("Ready to amplify your brand voice...", "tailored to your brand", etc). Added a parallel `lifeSnippets` table for Life mode:
  - marketing → "Personal storytelling that sounds genuinely like you..."
  - strategic → "Clarity on what matters most to you right now..."
  - operations → "Routines and rhythms tuned to your life..."
  - documents → "Personal letters, journals, and notes — in your voice..."
  - research → "Insights pulled from your goals and preferences..."
  - life-specific → "Custom guidance built for your unique life..."
- Default fallback snippet also mode-aware ("personalized to you" vs "customized for your brand").

## v33.93 — BrandAI ↔ LifeAI parity pass
First sweep of the deferred deeper-parity audit. Studio and Automations are now mode-aware where they previously favored Brand mode silently.

### Studio
- The top action bar's **AI Generate** button now dispatches on `currentMode`. Brand mode → `generateBrandAIRecommendations()`; Life mode → `generateLifeAIRecommendations()`. Previously it called the brand path unconditionally, so the button did nothing useful in Life mode (the workaround was a redundant inline AI Generate inside `#lifeCreatorSection`).
- New helper `updateStudioActionBarLabels()` rewrites the `title` attribute on mode switch — "AI-generate brand-specific operations" vs "AI-generate life-specific operations from your profile".
- Removed the duplicate `LifeAI Creator` section header + its standalone AI Generate button from `src/html/brand/02-studio.html`. The top action bar now serves both modes, matching how `#brandCreatorSection` already worked. The inline custom-creator input + `lifeOps` cards remain.

### Automations Agent
- Quick-prompt suggestions in `#autoLabAutoAgent` are now JS-rendered via `renderAutoAgentSuggestions()` and swap with mode. Brand mode keeps the existing six (Post to X tonight, Competitor research + email, Prospect outreach, Weekly newsletter, Cross-platform campaign, Client pitch packet). Life mode now sees: Daily journal prompt, Weekly habit review, Goal check-in, Wellness reminder pulse, Evening wind-down, Personal weekly digest.
- The static HTML in `src/html/shared/19-automations.html` now hosts an empty `#autoAgentSuggestions` container — the renderer fills it on view init and on every mode switch.
- `newAutoAgentChat()` (the "New chat" button) now also calls `renderAutoAgentSuggestions()` so the suggestions match the active mode after a chat reset.

### Wiring
Both helpers fire from `switchToBrandMode` and `switchToLifeMode` in `11-agents.js`, and from `initAutomationsLab` for first paint. No new state, no migration. Pure UI parity.

## v33.92 — Sync Hub freshness clock
New "Local Last Updated" stat in the connection-status grid of the Synchronization Hub. Ticks every 5 seconds showing relative time since the most recent local save (`roweos_last_local_save`). Format: "just now" / "12s ago" / "3 min ago" / "4h ago" / full date for older.

New module `src/js/core/48-sync-freshness.js` with a MutationObserver on `#syncView` so the timer auto-starts when the view becomes visible and stops when hidden — no wasted intervals.

Closes Jordan's "make sure timestamps update" feedback by giving him a visible clock that proves every save bumps the timestamp.

## v33.91 — Time Ribbon tombstone parity + Evolve/ThoughtBoard font respect Settings
### Time Ribbon ↔ History list parity
The user's iOS PWA showed Time Ribbon with 5 conversation markers while the BrandAI Conversations list section underneath read 0. Root cause: `renderTuningConversations` filters against `roweos_deleted_chat_ids` (and life equivalent), but `41-time-ribbon.js` did not. Now both readers apply the same tombstone filter:
- `_readTombstoneSet(key)` helper in `41-time-ribbon.js` parses the deleted-id arrays from localStorage
- `_isTombstoned(c, brandSet, lifeSet)` checks the right set based on `c.mode === 'life'`
- Render filter extended: `!c.preliminary && _ts(c) > 0 && !_isTombstoned(...)`
- Two new tests in `surface-modes.test.ts` lock in BrandAI + LifeAI tombstone filtering

### Evolve + Thought Board font respects Settings → Font Style
User flagged: Evolve + Thought Board text didn't follow the Settings → Font Style toggle (Default vs Promo). Root cause: hard-coded `font-family:Georgia,serif` in inline styles overrode CSS rules; modal backdrops locked to `-apple-system,BlinkMacSystemFont` which ignored both default body font AND promo-fonts override. Fix:
- New `.brilliance-serif` utility class — Georgia by default, Cormorant Garamond when `html.promo-fonts` is active
- Replaced hardcoded inline `font-family:Georgia,serif` declarations in 36-evolve.js with the utility class (countdown, profile editor h3 headers, editor textarea, modal title)
- Modal backdrops now use `font-family: inherit` instead of locking the Apple system font stack
- New CSS rules at `.evolve-v2` / `.board-v2` set `font-family: inherit` so both surfaces follow the body font, with leaf elements (titles, goal text, quiz question, board card title) using `.brilliance-serif`-equivalent rules
- Eyebrows / labels / pills inherit body sans (system default OR DM Sans under promo-fonts)

## v33.9 — First 0.1-increment batch (parity + iOS PWA cache invalidation)
**Cadence shift:** From v33.86 onward, ships consolidate into 0.1 increments — fewer deploys, more substantive each. v33.9 is the first such batch.

### LifeAI ↔ BrandAI Studio parity
The LifeAI Studio Creator section had a "Generate Personalized Tasks" button while BrandAI Studio's equivalent says "AI Generate." Renamed:
- Button label in `src/html/brand/02-studio.html` (LifeAI Creator section): `Generate Personalized Tasks` → `AI Generate`
- Button tooltip: `Generate personalized tasks based on your goals` → `AI-generate life-specific operations based on your profile`
- Empty-state copy in `src/js/core/25-documents-lifeai.js` (two callsites): `click "Generate Personalized Tasks"` → `click "AI Generate"` and `for AI suggestions based on your profile` → `for life-specific operations based on your profile`
- Re-render of the button after generation completes (5541): same rename
- CSS comment annotation updated in 01-base.css

### Brand reorder verified id-stable
Re-audited the splice path in `reorderBrand()` (11-agents.js:5277). It pairs cleanly with v33.83's id-stable `getCurrentLogoKey` (always uses `brand.id`, never array index), and `onBrandChange()` runs after reorder which refreshes the active logo. The earlier "logos change on reorder" complaint is resolved by v33.83. No code change needed in this batch — documented for reference.

### Hard refresh button (iOS PWA cache fix)
The user's iOS Safari PWA showed 8 stale Studio Outputs while Chrome desktop showed 3 (and Time Ribbon showed both consistent), because PWAs cache aggressively. New Hard Refresh button in the Sync Hub Reconcile + Purge panel:
- Confirms with the user before running.
- Clears all `caches.keys()` via Cache Storage API.
- Unregisters all Service Workers via `navigator.serviceWorker.getRegistrations()`.
- Triggers a fresh `loadFromFirebaseV2()` cloud pull.
- Hard reloads the page.
- Local data is NOT deleted — only cached HTML/JS assets and the SW registration are cleared.

`window.SyncReconcileUI` now exposes `hardRefresh` alongside `preview / runReconcile / runPurge`.

## v33.86 — Portfolio cover logo replaced with Brilliance wordmark
- The /portfolio cover image was still rendering the cursive "RoweOS" wordmark (legacy `/images/logo-full.png`) — visible in the user's iOS PWA screenshot at v33.85.
- Replaced `/images/logo-full.png` (the asset, not just references) with `images/brilliance/wordmark-os-transparent.png` (1536×1024 RGBA, transparent bg). All three references in `dist/portfolio.html` self-heal: line 607 cover, line 2019 closing page, line 2054 PDF export embedding.
- Legacy file preserved as `/images/logo-full.roweos-legacy.png` for archive/rollback.

## v33.85 — Portfolio page transition refresh + /finance spec for the dual session
### Portfolio refresh (`dist/portfolio.html`)
- Cover tagline updated from `"Operating intelligence, built for brand and life."` → `Brilliance · Brand & Life Intelligence Platform · by RoweOS.`
- Closing quote refreshed to `"Brilliance — the operating intelligence for brand & life."`
- PDF-export tagline mirror updated (the html2pdf integration captures its own copy)
- New page inserted between Core Views and Knowledge & Context: **"New Surfaces — v33 Welcome Release"** with 10 feature cards covering Brilli, Concierge Desk, Focus Mode, Time Ribbon, Studio Split-Pane, Folio Studio at Work, Notebook Letter Series, Thought Board, Evolve, and Sync Reconcile + UUID Purge.

### /finance page spec (`docs/brilliance/20-finance-page-spec.md`)
A complete spec document for the dual session to build a VC-grade investor page combining /portfolio's narrative with hard financials. Covers:
- Five-section layout (Hero → Traction proof → Financial baseline → Use of funds → Why now)
- Four-scenario ARR projection table (Floor / Realistic / Target / Stretch) with industry-standard 3x→2.5x Y/Y multiples
- $500K SAFE @ $5M post-money cap with itemized 18-month use-of-funds (60% on growth marketer + engineer hires, 12% Google for Startups extended credits, 10% legal/corp setup, 8% founder salary at $40K)
- Source-data table (Firestore + Stripe queries needed for live numbers)
- Honest risks + open questions section so the page doesn't read as pure pitch
- Build sequence + Vercel rewrite instructions
- Memory hook to read `feedback_v33_overnight_session.md` first when the dual session opens

## v33.84 — BLAKE flip-back + Brilliance Transition email + purchase page refresh
### BLAKE / Brilli flip-back affordance
The Brilli form picker has always exposed Classic BLAKE; selecting it swaps `data-brilli-form="classic"` and the existing `#blobContainer` WebGL blob takes over (`#brilliHero` hides). The flip works in both directions, but from the BLAKE side the only way to return to a Brilli form was Settings → Appearance → Brilli Form. Added a discoverable circular Brilli-switch button at the bottom-right of the BLAKE blob, visible only when classic is active (CSS gate `html[data-brilli-form="classic"] #blobBrilliSwitchBtn`).

### Brilliance Transition email template
New admin email template `brilliance_transition` (and matching `templateMap` entry + `clickCounter` block in `25-admin-emails.js`). Renders via `generateBrillianceTransitionEmail()` in `22-firebase-sync.js`. Subject line: "RoweOS is now Brilliance — what changed (and how to keep building)". Body covers all 10 new surfaces shipped this release with Get API Keys CTA pointing at roweos.com/purchase.

### Purchase page refresh (`dist/purchase.html`)
- Hero subline + note refreshed for the transition: "Same platform. Same memory. Same work. New name and new surfaces."
- Tier feature lists updated — removed "Focus, Analytics and Identity" (Focus retired in v28.8), added Studio · Split-Pane Workspace, Folio · Studio at Work, Pulse · Time Ribbon · Identity, Thought Board (Pinboard + Constellation), Notebook · Letter Series mode, Evolve preview.
- New "Now in Brilliance" section above the API Keys block, listing all nine new surfaces with brief descriptions.
- Footer tagline updated from "Operating intelligence, built for brands and life." to "Brilliance · Brand & Life Intelligence Platform · by RoweOS."

## v33.83 — Brilli intensity perceivable + brand-logo stays with id on reorder
### Brilli intensity slider
The slider was wired correctly through `getIntensity / setIntensity / modeIntensity`, but the multiplier ranges were so narrow that 0 vs 100 looked the same:
  - Glow ramped 0.3 → 1.0 (only 70% delta)
  - pulseHz ramped 0.5 → 1.0
  - scaleAmp + sparkRate were already tiny (e.g. 0.020 idle scale × 1.0 = 2% scale change)

Widened to:
  - Glow `0.05 + 1.55*k` → 0 looks dim/static, 100 has 1.6× the prior glow
  - pulseHz `0.15 + 1.85*k`
  - sparkRate `2*k*base` and scaleAmp `2*k*base` so motion is visibly amplified at high intensity

### Brand-switcher logo stability
User reported brand logos changing when reordering brands — long-standing bug in `getCurrentLogoKey`. The path tried `localStorage.getItem(idKey)` and if that returned null (typical for v32.0-C IDB-stored logos), it fell back to `roweos_brand_{origIdx}_logo`. After reorder, the new index pointed at the previous occupant's stored value.

New rule: when `brand.id` exists, return the id-stable key unconditionally (`roweos_brandlogo_<id>`). The async logo readers (`readBrandLogoSync`) already handle "not in localStorage, check IDB cache" correctly. Legacy index fallback only fires for pre-v27.3 brands without an id field.

## v33.82 — Light-mode polish + Update screen refresh + landing default OFF + retire RoweOS welcome
Multi-fix bundle from the user's punch list against the cream-on-cream Settings + stale Update + old "Welcome to RoweOS" screen.

### What changed
- **Light-mode Settings rows** — `.settings-row` in light mode now uses `rgba(0,0,0,0.04)` bg + `rgba(122,103,65,0.22)` border + `#7a6741` icon color. Hover deepens the border. The cream-on-cream invisibility is gone.
- **Title-bar match** — the `theme-color` meta tag now resolves to `#f5f3ee` in light mode (was `#ffffff`) so the macOS title bar / mobile browser chrome matches the page cream rather than showing a stark white margin above it. Fix applied in BOTH `applyTheme` and the boot-time light-restore path.
- **Settings → Update screen** rebuilt: hard-coded v25.5 / v25.6 / v26.0 entries replaced by `47-changelog-render.js` which renders from a baked-in `BRILLIANCE_CHANGELOG` array (currently the most recent 12 v33.x ships). Current Version line auto-pulls from `ROWEOS_VERSION`. Renderer fires on DOMContentLoaded.
- **Landing pages default OFF** — `getSectionPrefs` now defaults `skipLanding: true` when no preference is stored, so users never hit a landing page on a fresh load. They can re-enable per section in the section help "?" dropdown.
- **Legacy welcome retired** — `showWelcomeScreen` now hides the old `welcomeScreen` div and forwards to `showOnboarding()` (the v33.0 onboarding modal). Old cached iOS PWAs that triggered the legacy screen will land on the new modal instead of the stale RoweOS-branded view.
- **Footer wording** updated from "Built for the future" to "same platform · new surfaces" reflecting the new surface system.

### Backlog added (next version cycle)
- Brilli intensity slider currently no-op — wire to actual canvas RAF rate and intensity-modulated alpha
- BLAKE / Brilli switch UX — confirm BLAKE is still selectable in Ambient Shape; if not, either remove or restore as a Brilli form alternate
- LifeAI Studio "Generate Personalized Tasks" button parity with the BrandAI "AI Generate" rename
- Brand-switcher: persist re-sorted brand order; brand logos must NOT shift when re-ordering (load by id, not by index)
- Cloud Pub/Sub Scheduler audit during the v34 automations rewrite

## v33.81 — Sync reconcile + UUID purge (CRITICAL — addresses "Aligning…" forever)
### The bug the user reported
Sync Hub showed `Aligning… (-5)` for BrandAI Chats, `(-1)` for LifeAI Chats, `(+5)` for Studio Runs, `(-2)` for Brand Logos, `(-3)` for Folio Items — for hours. iOS PWA showed 0 BrandAI conversations while the cloud had 5 (and Chrome desktop showed 6). The root cause: items the user previously deleted on one device were tombstoned LOCALLY there, but the cloud copy was never deleted on the other device because the sync engine treated the local-empty / cloud-present diff as "Aligning…" rather than "respect the tombstone and delete from cloud."

### What's new
Three new registry-level APIs in `src/js/core/22a-tombstones.js`:
- `reconcileCategoryWithTombstones(categoryIdOrLabel)` — lists cloud subcollection ids for a category, intersects with the local tombstone set, deletes cloud docs that match. Skips blob/inline shapes (already 1:1).
- `reconcileAllWithTombstones()` — walks every entry in the SYNC_CATEGORIES registry.
- `buildSyncReconciliationReport()` — non-destructive snapshot returning `{ localCount, cloudCount, tombstoneCount, cloudStaleCount, cloudOrphanCount, cloudOrphanIds }` per category.
- `purgeUUIDStale({ confirmed })` — nuclear option: tombstones AND deletes every cloud item missing from local AND not yet tombstoned. Requires explicit `{ confirmed: true }` else returns dry-run plan.

### Sync Hub UI
New "Reconcile + Purge" panel in `Synchronization Hub` (right above the Sync Mode block) with three buttons:
1. **Preview drift** — shows the per-category diff in a monospace report area. Non-destructive.
2. **Reconcile tombstones** — confirm dialog, then deletes every cloud item already tombstoned on this device. Safe (only removes things the user previously deleted).
3. **Purge stale UUID data…** — dual confirm: first an OK/Cancel modal listing per-category orphan counts, then a `prompt()` requiring the literal phrase `PURGE` typed verbatim. Then runs `purgeUUIDStale({ confirmed: true })`. Irreversible — for cleaning up stale UUID data left over from old versions.

### Implementation
- `src/js/core/22a-tombstones.js` — added the four registry-level APIs
- `src/js/core/46-sync-reconcile-ui.js` — new module exposing `window.SyncReconcileUI = { preview, runReconcile, runPurge }`
- `src/html/shared/16-sync.html` — added the panel above the Data Inventory section

### Why this matters for v5 transition
The v34 sync v5 dual-write spec carries the existing tombstone set forward. By giving the user a way to reconcile + purge BEFORE v5 read-shadow promotes, we ensure no stale items from old cloud paths ride along into the new sync schema. Run Preview → Reconcile → (optional) Purge before flipping the dual-write toggle.

## v33.80 — Thought Board guided tour
- New 5-step `GUIDED_TOURS['board']` walk-through:
  1. **Two views** (.board-mode-nav) — explains Pinboard vs Constellation
  2. **Pinboard** — grid of cards, each a pinned thought
  3. **Constellation** — 2D map, hover/click a star
  4. **Manual pin** — `+ Pin` button, plus mention of cross-surface Pin buttons in Chat / Notebook / Studio
  5. **Live count** — the gold pill in the sidebar shows pin total
- Plugged into the existing dispatcher in `30-automations-init.js`. The "?" button on the Thought Board panel-header now shows Take a Tour alongside Send Feedback, matching Studio / Evolve / Pulse.

## v33.79 — Thought Board pin-count badge in sidebar
- Small gold pill next to the Thought Board sidebar entry (both grouped subitem and expanded item) showing live pin count.
- Hidden when 0; gold pill (dark) / cream pill (light) when ≥ 1.
- Updates on every `ThoughtBoard.addPin` / `removePin` via the new `refreshBadge` API; also fires on boot so the count is fresh before the view opens.
- Two slots wired: `#boardPinCount` (expanded sidebar) + `#boardPinCountSubitem` (grouped sidebar).

## v33.78 — Critical-path tests for the 6 new surface modules
- New test file `src/__tests__/critical/surface-modes.test.ts` with 16 tests covering the v33.67–v33.76 surface-modifier ships:
  - **FocusMode** (4 tests) — toggle, disabled-flag respect, exit, isOn
  - **LetterSeries** (2 tests) — toggle persistence, apply idempotency
  - **SplitPane** (1 test) — toggle persists + flips body class
  - **FolioEasel** (1 test) — toggle persists + flips body class
  - **ThoughtBoard** (5 tests) — addPin, removePin, setMode pinboard/constellation, rejects garbage, persists to localStorage
  - **TimeRibbon** (3 tests) — empty-state, ready-state with markers, preliminary filtering
- All tests are pure behavioral (no canvas, no DOM rendering, no remote IO) so they run in <50ms.
- Total suite: 255 tests passing (was 239 — +16 new).

## v33.77 — Settings discoverability for new Tier 2 surfaces
- Two new Settings → Appearance rows so users find the new modes without already knowing the toolbar buttons:
  - **Studio · Split-Pane Workspace** — toggles `body.studio-split-pane`.
  - **Folio · Studio at Work** — toggles `body.folio-easel`.
- Initial-label sync wired into the existing `apply()` function in `34-brilli.js`.
- `resetBrilliancePrefs()` now also clears `roweos_studio_split_pane` + `roweos_folio_easel`.

## v33.76 — Folio → Studio at Work mode (final Tier 2 surface)
The third and final Tier 2 surface from `docs/brilliance/12-surface-system.md`. With this ship, all three Tier 2 toggles are live (Studio Split-Pane, Notebook Letter Series, Folio Studio-at-Work).

### What it does
- New "Studio at Work" toggle in the Folio tab bar (right-aligned).
- When ON, `body.folio-easel` reflows `.folio-chat` into a 2-column grid:
  - Left column (1fr): artifact / easel — the centerpiece. If no artifact is active, an empty-state placeholder reads "Easel — pick an artifact from Gallery, or generate a new one in Chat. The output streams into this column."
  - Right column (280–360px): conversation messages, scrollable, with a left gold border thread.
- Auto-suppresses the placeholder when an artifact is active (via `:has(.folio-active-artifact)` / `:has(#folioEaselStage)`).
- Collapses to single column under 1100px.
- Persisted at `localStorage('roweos_folio_easel')`; restored on boot.

### Implementation
- New module `src/js/core/45-folio-easel.js` exposes `window.FolioEasel = { isOn, toggle, apply }`.
- HTML toggle button added in `src/html/brand/20-folio.html` tab bar.
- CSS scoped to `body.folio-easel #folioView`.

## v33.75 — Studio → Split-Pane Workspace toggle (Tier 2 surface)
Tier 2 surface from `docs/brilliance/12-surface-system.md` "Studio — Split-Pane Workspace" section. Toggleable mode so existing Studio users keep their current single-column flow.

### What it does
- New "Split Pane" button in the Studio action bar (between Create Custom and the existing controls).
- When ON, `body.studio-split-pane` re-flows `.studio-v2-content` into a 2-column grid:
  - Left column (`minmax(320px, 0.45fr)`): operations + input area
  - Right column (`minmax(420px, 0.55fr)`): Output section, sticky to the top with `max-height: calc(100vh - 120px)` so it stays visible while scrolling the input pane
  - Gold-gradient divider thread between panes (light-mode aware)
- On viewports under 1100px, collapses back to single column with the divider hidden.
- Persisted at `localStorage('roweos_studio_split_pane')`; restored on boot.

### Implementation
- New module `src/js/core/44-split-pane.js` exposes `window.SplitPane = { isOn, toggle, apply }`.
- HTML toggle button added in `src/html/brand/02-studio.html` action bar.
- CSS scoped to `body.studio-split-pane #studioView`.

## v33.74 — Pin-to-Thought-Board hooks (Chat / Notebook / Studio)
Cross-surface deep links from the v33.73 Thought Board scaffold — pins now arrive from the three primary content surfaces.

### What's new
- **Chat** — every assistant message in `renderConversation` now includes a Pin button in `.chat-msg-actions` that calls `pinChatMsgToThoughtBoard(btn)` with `kind: chat`, `source.label: "Chat · Brilliance"` (or "Chat · you" for user role).
- **Notebook (Scribe)** — title actions row gets a Pin button next to Letter Series toggle. Calls `pinScribeToThoughtBoard()` with `kind: notebook`, `source.refId: notebook.id`, `source.label: "Notebook · {title}"`. Strips HTML tags before storing the body preview.
- **Studio** — output actions bar gets a "Pin to Board" button between "Add to Rhythm" and "Share". Calls `pinStudioOutputToThoughtBoard()` with `kind: studio`, `source.label: "Studio · {operation name}"`.

Each handler caps body at 600 chars, takes title from the first line (80-char cap), surfaces a toast on success, and silently no-ops with a friendly toast if Thought Board hasn't loaded yet.

## v33.73 — Thought Board scaffold (Tier 3 surface)
First Tier 3 surface from `docs/brilliance/12-surface-system.md`. Additive new view — zero risk to existing flows.

### What it is
- New sidebar entry "Thought Board" under Core (grouped + expanded sidebars).
- New view at `data-view="board"` / `#boardView`, registered in `allViews` (both lists in `11-agents.js`).
- Full panel-position selector treatment (initial position-fixed, 3 sidebar push lists, mobile, light-mode mobile).

### Two modes
- **Pinboard** — grid of cards. Each card has icon (chat/notebook/studio/note), source label, title, body, and an × to remove.
- **Constellation** — 2D star-field. Pins positioned by their stored x/y (0–1 normalized). Hover reveals title; click is a no-op for now.

### API
`window.ThoughtBoard = { render, setMode, addPin, addPinPrompt, removePin, getMode, getPins }`. Manual `+ Pin` button uses `prompt()` for now; cross-surface deep links (pin from Chat / Notebook / Studio) land in v34.

### Storage
- localStorage key `roweos_thought_board`, array of `{ id, kind, title, body, source, x, y, _modifiedAt }`. Future: SyncV5 collection.

### Implementation
- New view html: `src/html/shared/32-thought-board.html`
- New module: `src/js/core/43-thought-board.js`
- Sidebar entries: `src/html/core/04-views-batch3.html` (Core grouped + expanded)
- Position-fixed CSS rules: `src/css/core/01-base.css` — added `#boardView` to all 6 selector groups (per the v33.59 lesson)
- Full `.board-*` CSS block with both dark and light-mode tones, mobile rules at 768px.

## v33.72 — Settings discoverability for Focus Mode + Letter Series
- New Settings → Appearance rows so users can find these surface modifiers without already knowing the shortcut / Scribe button:
  - **Focus Mode shortcut** (default On). Disabling silences ⌘⇧F entirely.
  - **Notebook · Letter Series** (default Off). Toggling here is equivalent to clicking the toolbar button in Scribe.
- Both toggles are wired with initial-label sync in the existing brilli-form-label `apply()` function so they display the right value on settings open.
- `resetBrilliancePrefs()` now also clears `roweos_focus_mode_disabled` and `roweos_letter_series`.

## v33.71 — Notebook → Letter Series toggle (Tier 2)
First Tier 2 surface from the roadmap (`docs/brilliance/12-surface-system.md` "Notebook — Letter Series" section).

### What it does
- New toggle button in the Scribe editor title actions (📄 icon). Tooltip: "Letter Series — cream paper · gold drop caps · narrow column."
- When ON, applies `body.letter-series` class — Scribe view gets:
  - Cream paper background `#f4ecd8` for the panel; `#faf2dc` for the editor surface
  - Narrow 720–760px center column for title, editor, knowledge panel
  - Cormorant Garamond serif heading (`-0.01em` tracking, 36px)
  - Soft warm-gold border + drop shadow on the editor wrap
  - Gold drop cap on first paragraph of any element with `.letter-drop`, plus the first AI assistant turn in the knowledge thread
  - Marginalia float: any element with `.letter-margin` floats to the outer column with a left/top divider on small screens
- Toggle state persists via `localStorage('roweos_letter_series')` and restores on page boot.
- Scribe data + flows are untouched — pure visual treatment via the body-class gate.

### Implementation
- New module `src/js/core/42-letter-series.js` exposes `window.LetterSeries = { isOn, toggle, apply }`.
- Toggle button added to `src/html/shared/30-scribe.html` title actions row.
- CSS block in `01-base.css` scoped to `body.letter-series #scribeView`.

## v33.70 — History → Time Ribbon
First pass at the Tier 1 surface modifier from `docs/brilliance/12-surface-system.md` "History → Time Ribbon" section. Renders at the top of the History view (`data-view="tuning"` unchanged) — the existing list view is preserved below it for back-compat.

### What it does
- Header: "Time Ribbon" eyebrow, summary line ("17 conversations · Mar 12 → Apr 30"), Summarize range button (placeholder for v34 Sprint 4).
- Track: horizontal axis from earliest to latest conversation. Each conversation is a colored marker dot — gold for BrandAI, blue for LifeAI. Position is proportional to timestamp.
- Hover: marker scales up + glows + shows tooltip with first-user-text + relative time.
- Click: shows a detail block below with the conversation title, mode + agent + message count, two action buttons:
  - **Resume** — calls window.resumeConversation / openConversation / showView('agent') as available.
  - **Branch from here** — placeholder for v34.
- 4 axis labels evenly spaced across the track for time orientation.
- Mobile rules at 768px tighten padding + label font.

### Implementation
- New module `src/js/core/41-time-ribbon.js` exposes `window.TimeRibbon = { render, summarizeRange, _selectMarker, _resumeMarker, _branchMarker }`.
- Reads `window.agentCommands` (already populated by the existing tuning load path), filters preliminary entries, sorts by `_modifiedAt || timestamp || id`.
- HTML scaffold added to `src/html/brand/10-tuning.html` above the existing mode tabs.
- CSS block in `01-base.css` with full light-mode-aware tones.
- `showView('tuning')` in `11-agents.js` now calls `TimeRibbon.render()` after the existing data load.

## v33.69 — App icon fills the frame
- Per "increase the size of the app icon to fill in that white space around the border so it fills it 100%". The Brilliance source PNG (`images/brilliance/app-icon.png`) is 1254×1254 but the actual `B`-with-sparkles art only occupies an 808×832 region — ~200px of solid-bg padding on top, ~223px on the left. Every generated icon looked ~35% too small inside its rounded frame, leaving the user-visible "white space around the border".
- Updated `scripts/regen-icons.mjs` to:
  1. `trim({ threshold: 25 })` to detect the actual content bounds.
  2. Extend the trimmed buffer to a perfect square (832×832) with the dock bg color.
  3. Resize each target (favicon-16/32/48, favicon, apple-touch-icon, apple-touch-icon-512/1024, icon-192/512/1024, root apple-touch-icon) with `fit: 'cover'`.
- Re-ran the script — 11 PNGs overwritten in `RoweOS/dist/icons/` and root.
- The B logo now fills the icon edge-to-edge in the macOS Add to Dock dialog, the favicon tab, and any PWA install icon.

## v33.68 — Evolve Today pane light-mode contrast + roadmap doc
### Light-mode fixes
User screenshot showed cream-on-cream Today pane: "EVOLVE - TODAY" eyebrow, "Set a target goal to begin!", "REVIEW - 25 MIN" / "QUIZ - 25 MIN" / "APPLY - 25 MIN" / "REVIEW - 25 MIN" cards, footer link to docs all using inline styles like `color:#f5e6c8` and `rgba(255,255,255,0.55)` which CSS overrides cannot reach. Added a `_c(dark, light)` helper inside the Evolve module that returns the contrast-correct color at render time based on `html.light-mode`. Refactored:
- Hero card border/bg/eyebrow/goal text/countdown/stats
- Empty-state title + description
- Edit-profile button
- Recalibration banner
- Daily task cards (Review / Quiz / Apply) — border, bg, kind label, title, hint colors all switch
- Footer note + doc link
- Practice / Verify / Skills paragraph descriptions
- Profile editor modal (bg, border, text, inputs, Save + Cancel buttons)
- Editor modal (bg, border, inputs, Cancel button)
- "No context yet" empty state in Translator
- Source/reflection item rows in Skills

### New roadmap doc
`docs/brilliance/19-overnight-roadmap.md` — outlines what shipped this session (v33.50 → v33.68), what's next in priority order (Tier 1 surface modifiers, Tier 2 rebuilds, Tier 3 Thought Board, architecture work), and the triage rule for autonomous overnight iterations.

## v33.67 — Focus Mode (Negative Space) — first Tier 1 surface ship
First implementation from the surface-system roadmap (`docs/brilliance/12-surface-system.md` "Focus Mode" section).

### What it does
Cmd+Shift+F (or Ctrl+Shift+F) toggles Focus Mode on any view:
- Sidebar fades to 0
- Breadcrumb, concierge row, panel-header chrome, section help button — all fade out
- Evolve stats strip, pill nav, context row — all fade out
- The active surface content stays, Brilli + input still visible
- A subtle pulsing gold dot in the top-right corner shows the mode is active
- Esc exits focus mode
- Disabled by `localStorage('roweos_focus_mode_disabled') === 'true'`

### Implementation
- New module `src/js/core/40-focus-mode.js` exposes `window.FocusMode = { toggle, exit, isAllowed, isOn }`
- Document-level keydown handler for the shortcut + Esc-to-exit
- CSS rules under `body.focus-mode .…` use 0.35s opacity transitions
- `prefers-reduced-motion` disables the corner-dot animation

### Surface roadmap progress
Concierge Desk (Tier 1) was already shipped. Focus Mode is the second Tier 1 surface modifier. Remaining Tier 1: History → Time Ribbon. Then Tier 2 begins (Studio split-pane, Folio at work, Notebook letter series).

## v33.66 — Firebase chat_migration path fix
- Last remaining console error after v33.63→65: `FirebaseError: Invalid document reference. Document references must have an even number of segments, but roweos_users/{uid}/chat_migration has 3 segments`.
- `db.doc('roweos_users/{uid}/chat_migration')` is 3 path segments (collection/doc/collection) which Firestore rejects for `.doc()` — needs even count.
- Split path into `roweos_users/{uid}/_meta/chat_migration` (collection `_meta`, doc `chat_migration`). Migration code in `migrateChatBlobToSubcollection` was effectively broken since v30.3 because `.doc().get()` threw before any logic could run. Existing users have already been auto-flagging migrated via the empty-chats early-return path.

## v33.65 — scheduledPrompts orphan fix
- After v33.64 cleared the calendar errors, live console still threw `ReferenceError: scheduledPrompts is not defined` from `checkAndRunDueScheduledPrompts` (the per-minute scheduler tick).
- Same pattern as v33.63/64. Function now reads `roweosScheduledPrompts` from localStorage with `Array.isArray` guard.
- Live Playwright verification: Rhythm calendar renders 29KB of HTML (April 2026 month grid); Evolve view at 1573px wide with `position: fixed` and proper padding.

## v33.64 — Calendar fix follow-up (more orphaned init refs + ical.js v1)
After deploying v33.63, live Playwright check of `roweos.com` revealed two more errors:
1. `ReferenceError: initDeletedBrands is not defined` in `12-library.js` init path. Five more unguarded init calls in the same block — `initCalendar`, `initJournal`, `initScheduledPrompts`, `initScheduledTasksEngine`, `updateAPIsStatus`. All wrapped in `typeof === 'function'`.
2. `ical.js@2.1.0/dist/ical.min.js` is an ES module shipping `export` syntax — `Unexpected token 'export'` thrown in browsers loading it as a classic script. The v33.63 swap from `.cjs` to `.min.js` fixed the MIME error but introduced this. Pinned to `ical.js@1.5.0/build/ical.min.js` which is the legacy UMD/global bundle.

## v33.63 — CRITICAL: Rhythm calendar wasn't rendering (post-v28.8 residue)
### Root cause
Three orphaned references from the v28.8 Focus/Signal retirement that the cleanup pass missed:
1. `renderCalendar` (month view) referenced a global `todos` array that was deleted with the focus module — `ReferenceError: todos is not defined` thrown on every Rhythm render. (Live console confirmed via Playwright.)
2. `initTodos()` and `initTodoCategories()` were called unguarded in `11-agents.js` (the BrandAI ↔ LifeAI mode switch) and `12-library.js` init paths. Each switch threw `ReferenceError: initTodos is not defined`.
3. `getTodosKey()` was called unguarded in `09-state.js` `writeDBTodos` and in `22-firebase-sync.js` `purgeCloudTodos`. Same ReferenceError.

### Bonus: ical.js CDN MIME error
The script tag pointed at `ical.es5.min.cjs` which the CDN serves as `application/node` MIME. Modern Chromium / Safari refused to execute it under strict MIME checking, so iCloud CalDAV parsing was silently disabled. Switched to `ical.min.js` (UMD bundle).

### Fixes
- `renderCalendar`: reads todos from localStorage (using `getTodosKey()` with fallback to `'roweosTodos'`), guards `Array.isArray`, defaults to `[]` on parse failure.
- All three unguarded `initTodos` callers wrapped in `typeof === 'function'`.
- Both unguarded `getTodosKey()` callers wrapped with `typeof === 'function'` fallback to `'roweosTodos'`.
- ical.js script src updated to `.min.js`.

### Why this matters
The Rhythm calendar has been broken since v28.8 (months ago). Users would have seen an empty `#calendar` div with no events, no dates, no grid. Validated via Playwright pulling https://roweos.com — confirmed `todos is not defined` and `initTodos is not defined` in the live console.

## v33.62 — Concierge pills light-mode visibility
- Concierge pill row on the chat landing was using `#f5e6c8` (light cream) for the value text and `rgba(255,255,255,…)` for the dismiss `×` — both invisible on the light cream bg.
- Added `html.light-mode` overrides for `.concierge-pill`, `.concierge-pill .lab`, `.concierge-pill .val`, `.concierge-pill:hover`, `.concierge-dismiss` + `:hover`. Cream-gold accent identity preserved with `#5a4d2e` / `#7a6741` / `#1a1a1a` tones.

## v33.61 — Extended Evolve light-mode coverage
- Added light-mode overrides for Evolve elements not covered in v33.59:
  - Skill cards (pillar label / name / XP progress bar / meta)
  - Quiz options in all 4 states (default / hover / selected / right / wrong) including the letter chip + body text
  - Why/Why-Not matrix rows, lett (letter), body + strong text, with correct/wrong color shifts (`#15803d` / `#b91c1c` instead of `#4ade80` / `#ef5350` for proper contrast on light bg)
  - Verify input field + Verify submit button
  - Quiz button (start/retry) tinted gold

## v33.60 — Light-mode deepened cream tone
- Per user "deeper color in light mode" request:
  - `--bg-primary`: pure white `#ffffff` → warm cream `#f5f3ee`
  - `--bg-secondary`: `#f8f9fa` → `#ebe9e2`
  - `--bg-hover`: `#f1f3f4` → `#e3e0d6`
  - `--border-color`: `#e0e0e0` → `#d6d2c8` (warmer, more visible)
  - `--border-light`: `#ebebeb` → `#ddd9cf`
  - `--border-subtle`: `#f0f0f0` → `#e8e4d8`
- Mobile body bg + `--mobile-bg` variable updated to `#f5f3ee` to match desktop. The mobile panel-view list (light-mode) also picks up the new tone.
- The gold accent now reads as part of a coherent cream/gold palette rather than floating on stark white. Cards have more visual separation against the bg.

## v33.59 — CRITICAL Evolve layout fix + light-mode contrast
### Why the layout was still broken (root cause)
`#evolveView` was missing from **all four** panel-position selector groups in `01-base.css`:
1. Initial `position: fixed` declaration alongside `#rhythmView, #pulseView, …` (line ~4490)
2. `html.sidebar-pinned-collapsed` left-push list (line ~4504)
3. `html.sidebar-pinned` left-push list (line ~4535)
4. `html.sidebar-hover-expanded` left-push list (line ~4566)
5. Mobile `position: fixed !important` list (line ~38417)
6. Light-mode mobile background list (line ~37106)

Without those rules, `#evolveView` rendered with the base `.panel-view` styling only. Inside the parent flex column, `.evolve-v2` got pushed into a 918px box on the right of the 1221px main-content, leaving an empty light-blue area on the left half of the page (visible in the user's screenshot). Added `#evolveView` to all six selector groups.

### Why content was edge-flush
`.evolve-v2` had no padding. Added `padding: 24px 32px 0; display: flex; flex-direction: column; min-height: 100%;` to mirror Studio's pattern (`.studio-v2`).

### Why light mode had white-on-white
Every Evolve text/bg color was a dark-theme value (`#f5e6c8`, `#e2c79b`, `rgba(255,255,255,0.65)`, `#ece4d8`) that disappears on `#f8f8f8`. Added a full block of `html.light-mode .evolve-…` overrides that keep the gold-accent identity but use darker tones (`#5a4d2e`, `#7a6741`, `rgba(0,0,0,0.6)`) for the goal, countdown, pill nav, context chip, today hero, empty state, translator pane, verifier output, quiz card, etc.

## v33.58 — Brand cleanup pass 4 (Studio op descriptions + admin)
- Studio operation descriptions: "Feature Explanation" desc → "Learn how to use specific Brilliance features"; "Client Pitch Packet" desc → "Research a potential client and generate a branded Brilliance pitch document…"
- Email Campaign Sender Name placeholder ("e.g. The Brilliance Team")
- Admin Emails dashboard stat card label "New Brilliance Users"
- Welcome + Re-engagement email click counter labels both → "Open Brilliance"

## v33.57 — Email body brand sweep
- ~15 more user-visible "RoweOS" → "Brilliance" inside email-template HTML body text and CTAs:
  - Founder access grant: "You've been granted Founder access to Brilliance for [Brand]…"
  - Share-brand explainer: "Team members will need their own Brilliance accounts…"
  - 3 subject-line defaults at the dispatcher: check-in, onboarding survey, feature announcement
  - Onboarding survey: "experience with Brilliance", "How did you hear about Brilliance?"
  - Check-in rating: "How's everything going with Brilliance?", "What would make Brilliance better?"
  - Subscription info plan summary, "Brilliance works with your own API keys", "Brilliance AI - Unlock Smart Routing" section, smart-routing description
  - Founder lifetime offer: "Founder access to Brilliance" + "What you can build with Brilliance" vision section
  - AI provider description: "Brilliance routes to OpenAI, Anthropic, and Google"
  - Google for Startups credibility line: "Brilliance is part of the Google for Startups Cloud Program"
  - "Open Brilliance" CTAs (3 instances)
  - Tier free message: "Sign up for a plan to unlock Brilliance"
  - "Use the Feedback button inside Brilliance"
  - "Designed & Sent from Brilliance" footer
  - "Sent via Brilliance" footer
  - "Creator, Brilliance" signature byline

## v33.56 — Brand cleanup pass 3 (PDFs / fallbacks / more emails)
- Final user-visible "RoweOS" sweep across JS:
  - PDF cover-header fallback ("Brilliance" when no brand)
  - PDF download filename fallback ("Brilliance-Export.pdf", "Brilliance-Pitch.pdf")
  - Pipeline PDF default title ("Brilliance Export") + subtitle ("Generated by Brilliance Pipeline")
  - Pipeline email subject fallbacks (2 places) — "Brilliance - Pipeline Output"
  - Studio system prompt brandName fallback
  - Folio chat system prompt brandName fallback
  - Image-download filename brandName fallback (2 places in calendar.js)
  - Cloud automation email subject default ("Brilliance Email")
  - Brand-config invite-name fallback (showToast welcome)
  - Pipeline PDF title input placeholder ("Brilliance Pitch")
  - Admin Sites display-name input placeholder ("Brilliance")
  - 2 more email-template headers in `22-firebase-sync.js` (welcome / check-in) with logo alt + `<h1>` + tagline + "Hope you've been enjoying" lead all rebranded
- Code-internal "RoweOS" identifiers preserved: IndexedDB DB name (`RoweOS_Overflow`), agent ID `'RoweOS'` in `_agentIds`, ROWEOS_VERSION constant, all `roweos_*` localStorage keys.

## v33.55 — Brand cleanup pass 2 (calendar / model / emails)
- 10 more user-visible "RoweOS" strings → "Brilliance":
  - Calendar provider label, native group card, and "RoweOS (local)" row → all "Brilliance"
  - Model auto-routing dropdown label "RoweOS AI" → "Brilliance AI"
  - Studio attach-from-library button reset text "Add from RoweOS Library" → "Add from Library"
  - Life-Intel empty state "Keep using RoweOS!" → "Keep using Brilliance!"
  - Email subject lines: feedback ("How's Brilliance working for you?"), subscription ("Brilliance Plans, API Keys, and AI Routing"), founder lifetime offer ("Your Founder Lifetime Discount - Brilliance is ready")
  - Email template HTML headers (logo alt, `<h1>`, tagline) for both branded email shells in `22-firebase-sync.js`. Tagline shifted to "Brand & Life Intelligence Platform" matching onboarding.
- Code-internal "RoweOS" identifiers (LocalStorage keys, IndexedDB DB name, agent IDs, function names) intentionally untouched.

## v33.54 — Brand consistency cleanup
- 6 user-visible "RoweOS" strings replaced with "Brilliance":
  - Launch screen description ("RoweOS connects your brands…" → "Brilliance connects your brands…")
  - "Explore RoweOS" CTA → "Explore Brilliance"
  - "Export RoweOS" modal title → "Export Brilliance"
  - "Add from RoweOS Library" picker title → "Add from Library"
  - BrandIntel agent toggle "RoweOS Helper" → "Brilliance Helper"
  - Mobile sidebar version display: hardcoded "RoweOS v31.1" → "Brilliance v33.54". This had been stale for 22 versions because the bump procedure missed it.
- "by RoweOS" engine credits preserved everywhere (launch screen, modals, og:meta).

## v33.53 — Evolve stats-strip + context-row profile-editor entry points
- The goal text in the Evolve stats strip is now always a link to the profile editor (not just the empty state). Hovering shows the same dotted underline + brighter color as the empty state.
- The Translator-context chip's empty state ("No known context yet — add some in your profile") is now clickable and routes to the profile editor.
- Added `.evolve-context-row a` + `:hover` rules so the inline link matches the rest of the strip's styling.

## v33.52 — Evolve help button + tour + tabHandler wrapper
- Evolve panel-header now has a `?` help button that opens the same dropdown Studio uses (Take a Tour, Send Feedback, Skip landing toggle, Open to picker, Reorder tabs).
- New `GUIDED_TOURS['evolve']` — six-step tour: stats strip overview, then one pop-up per tab (Today / Practice / Translator / Verify / Skills) explaining what it does.
- New `window.showEvolveSection(tabId)` — wrapper that calls `Evolve.renderEvolveTabContent(tabId)`. Lets the page-landing `_pageLandingConfigs['evolve'].tabHandler` actually switch tabs when a user clicks a feature card on the Evolve landing page (was a silent no-op before).

## v33.51 — Evolve mobile parity for flat layout
- Mobile @media rules for the v33.50 flat layout (stats-strip, pill-nav, context-row, pane-inner) at `max-width: 768px` and `max-width: 380px` breakpoints. Stats strip stacks vertically; pill nav becomes horizontally scrollable (no scrollbar); typography scales down.
- Removed dead CSS rules referencing the retired `.evolve-shell` / `.evolve-side` / `.evolve-side-head` / `.evolve-tabs` / `.evolve-tab` / `.evolve-context` selectors. They no longer existed in the v33.50 markup, so the rules were inert noise.
- Mobile parity rule from roadmap (`17-master-roadmap.md`) honored: every new surface ships with @media rules.

## v33.50 — Brilliance app icon + Evolve flat layout
- **App icon:** Regenerated all favicon / apple-touch-icon / PWA icon sizes from `images/brilliance/app-icon.png` via `scripts/regen-icons.mjs` (uses `sharp` with `.flatten({ r: 10, g: 10, b: 10 }).removeAlpha()` to satisfy macOS dock RGB-no-alpha rule). Replaces the rainbow/cursive favicon shown in the Add to Dock dialog. 11 files overwritten: `icons/favicon-{16,32,48}.png`, `favicon.png`, `icons/apple-touch-icon{,-512,-1024}.png`, `icons/icon-{192,512,1024}.png`, root `apple-touch-icon.png`.
- **Evolve flat layout:** Restructured to match Studio's flat pattern. Removed the dark `.evolve-shell` grid container that constrained content to the right side of the page. New structure: `.evolve-v2 > {breadcrumb, panel-header, description, .evolve-stats-strip, .evolve-pill-nav, .evolve-context-row, .evolve-content-area}`. Five horizontal pill tabs (Today / Practice / Translator / Verify / Skills) replace the vertical side-rail tab list. Stats strip (countdown + goal + XP/streak with progress bar) flows inline above the pills. Content area is full-width with no surrounding box. Legacy DOM IDs preserved so `36-evolve.js` continues to populate the same elements.
- `renderEvolveSideRail()` updated to populate the new flat stats strip.
- 239/239 critical-path tests still passing.

## v33.49 — Reset Brilliance preferences action
- Settings → Appearance → "Reset Brilliance preferences" — wipes all 10 v33.x feature flags back to defaults with a clear confirm dialog. Data (brands, conversations, automations, evolve profile) is untouched.
- Cleared keys: `roweos_brilli_form`, `roweos_brilli_intensity`, `roweos_evolve_enabled`, `roweos_evolve_quiz_engine`, `roweos_evolve_verifier_engine`, `roweos_sync_v5_enabled`, `roweos_sync_v5_writes`, `roweos_sync_v5_dual_write`, `roweos_concierge_off`, `brilliance_whatsnew_off`.
- Implemented as `window.resetBrilliancePrefs()` in `34-brilli.js`. Toast confirms; reload required.

## v33.48 — Settings toggles for Quiz Engine + Verifier Engine
- Settings → Appearance now has two new toggle rows next to the Evolve toggle:
  - **Quiz Engine [v34]** — flips `roweos_evolve_quiz_engine`. Visible scaffold for Sprint C; pipeline activates when v34 wires the multi-model orchestrator.
  - **Verifier Engine [v34]** — flips `roweos_evolve_verifier_engine`. Visible scaffold for Sprint E.
- Live label sync (On / Off) on init and on click. Toast confirms each flip.
- Pattern matches existing Evolve + Concierge toggle UX.

## v33.47 — Evolve render path bugfix
- `showView('evolve')` dispatcher now calls `Evolve.renderEvolveShell()` (full UI: side rail with countdown + tabs nav + context, plus the active tab content) instead of just `Evolve.renderPulseDashboard()` (Today pane only).
- Navigations via bookmark URL or showPageLanding redirect now show the complete view; previously the side rail stayed empty.
- `renderEvolveShell` and `renderEvolveTabContent` exposed on the `Evolve` public API for external callers.

## v33.46 — Evolve Skills tab editor modals
- Replaced `prompt()` calls in `Evolve._addReflectionPrompt` and `Evolve._addSourcePrompt` with a proper inline editor modal — bigger textarea for reflections, structured fields for sources (name + URL), keyboard-focused first input, save validation.
- New `Evolve._addSkillPrompt()` — opens the same editor modal with name + pillar + XP target fields. Skills tab gets a "+ Skill" button alongside Import + Download backup.
- All three call paths share `_openEditorModal({ title, fields, onSave })` — single source of truth for the modal pattern.

## v33.45 — Sync v5 panel: dual-write toggle UI
- Settings → Sync → Sync v5 (Preview) now has a third toggle row: **Dual-write [v34]** (red-tinted to flag the risk).
- Toggle is disabled (40% opacity, not-allowed cursor) until both Read-shadow + Cloud writes are already on. Three-flag invariant from v33.43 is enforced visually.
- First-time enable surfaces a `confirm()` dialog citing the 14-day zero-discrepancy spec rule, plus the live discrepancy count from `getStats()`.
- Stats block now includes a "Dual-writes / Last dual-write" sub-section that appears when dual-write is enabled OR when any dual-writes have occurred. Errors render in red.
- 239 critical-path tests still passing.

## v33.44 — Mobile centering fix + Evolve always opens + Pulse-style chrome
### Mobile orb true viewport centering
- v33.42 used flex `min-height: calc(100dvh - 200px)` which didn't reliably take effect because the parent `.panel-view` doesn't always span full viewport height on mobile (tab bars, keyboard, status bar dynamics).
- v33.44 switches `#blobTitleGroup` (orb + "BRAND INTELLIGENCE PLATFORM" + concierge pills) to `position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%)` on mobile only. The chat input is also fixed at bottom; the two don't conflict.
- When the conversation opens, `#agentLandingContent` becomes `display: none` and the fixed group disappears with it. Desktop layout is unchanged.

### Evolve always opens
- `Evolve.showEvolveView()` no longer toasts "Evolve is in scaffold. Enable with localStorage..." when clicked. The view always renders.
- `localStorage.roweos_evolve_enabled` now ONLY gates Translator-pattern injection into chat agent system prompts. The visual experience is open to everyone — Settings → Evolve toggle becomes meaningful (you see it, then decide whether to opt the chat into Translator mode).

### Pulse-style chrome on Evolve
- `src/html/shared/31-evolve.html` restructured: `<div class="panel-view">→<div class="panel">` now wraps the multi-tab shell, with breadcrumb (`Home › Evolve`) + uniform gold `panel-header` + muted-text description. Margins / padding match Pulse exactly.
- `.evolve-shell` CSS dropped the `min-height: calc(100vh-80px)` viewport pin in favor of intrinsic height with rounded border and `margin-top: var(--space-4)`. Page now scrolls naturally with the standard panel chrome on top.

## v33.43 — Sync v5 dual-write scaffold (gated, INACTIVE)
- Third feature flag: `localStorage.roweos_sync_v5_dual_write` — required ON TOP OF the existing read-shadow + writes flags. All three must be true for `dualWriteEnabled()` to return true. Fail-safe: turning off any one of the three disables dual-write.
- New `Collection._prepareDualWrite(id, v4Data)` — wraps v4 data in a v5 envelope, persists locally, optionally cloud-writes (gated to v5-native via existing `_maybeCloudWrite` allowlist), bumps stats, fires `dual-write` notify.
- New `SyncV5.mirrorV4Write(collection, id, v4Data)` — entry point v4 callers will use after v34 zero-discrepancy bar is met. Auto-registers passive collection if not already present.
- Stats track `dualWrites`, `dualWriteErrors`, `lastDualWriteAt` separately from discrepancies.
- 18 new tests in `sync-v5-dual-write.test.ts` covering all three gate combinations, persistence, _createdAt preservation across edits, stats counters. **239 critical-path tests passing.**
- **NOT activated**: v4 write paths do NOT call `mirrorV4Write` yet. Per spec (`docs/brilliance/16-sync-v5.md`), wiring happens after read-shadow is clean for 14 consecutive days.

## v33.42 — Sprint E VerifierEngine + UI bug fixes
### Sprint E scaffold
- New `src/js/core/39-verifier-engine.js` — multi-model verification architecture per Pillar V.
- Public API: `isEnabled()`, `validateResult(r)`, `extractCitations(text)`, `runPeerReview(claim, profile)`.
- Two-pass orchestrator: Gemini Deep Research fact-check → GPT-5.5 Pro adversarial skepticism → synthesize verdict.
- VerificationResult schema with hard rules: VERIFIED requires >= 3 citations, CORRECTED requires >= 1, INSUFFICIENT_EVIDENCE for nothing.
- Markdown citation extractor: `[Title](https://url)` → `{ source, url }`.
- Gated by `localStorage.roweos_evolve_verifier_engine === 'true'` AND Evolve enabled. Without flag, the single-model verifier in `Evolve._runVerify` (v33.6) still runs.
- 18 new tests in `verifier-engine.test.ts` covering schema rules, citation extraction, isEnabled gate, runPeerReview pipeline. **221 critical-path tests passing.**

### UI bug fixes (from screenshot feedback)
- **Concierge pills no longer overlap "BRAND INTELLIGENCE PLATFORM" title.** Moved `#conciergeRow` from above `#blobTitleGroup` (which has `margin-top: -350px`) to inside it, after the title. Pills now render naturally below the title.
- **Dismiss × is a perfect circle.** Added `aspect-ratio: 1/1`, `flex: 0 0 22px`, min/max width+height locks, and `align-self: center` so flex parent can't stretch it into an oval.
- **Mobile vertical centering.** `#agentLandingContent` on mobile is now `display: flex; justify-content: center; min-height: calc(100dvh - 200px)`. Orb + title + concierge sit centered together; `#blobTitleGroup` mobile margin reset to `0` (no more being pulled too high). Desktop layout unchanged.
- **Evolve in Core sidebar by default.** Moved Evolve nav item from the gated Intelligence group to Core (alongside Pulse + Rhythm). Visible without setting any flag. Click still routes through `Evolve.showEvolveView()` which respects the runtime flag (toast prompt if Evolve not enabled). Grouped sidebar mode also gets Evolve as a Core sub-item.

## v33.41 — Sprint C tests + 200-test milestone
- 23 new tests in `src/__tests__/critical/quiz-engine.test.ts` covering schema validator (every required field), pool persistence, gc expiry, isEnabled gate (flag + Evolve + targetGoal), generateNightlyQuiz skip paths and stub pipeline.
- **202 critical-path tests passing** in <1.3s. Past the 200 milestone.

## v33.40 — Sprint C scaffold: QuizEngine
- New `src/js/core/38-quiz-engine.js` — multi-model quiz pipeline architecture per docs/brilliance/14-evolve.md Pillar III.
- Public API: `isEnabled()`, `validateQuiz(q)`, `getPool()`, `addQuiz(q)`, `nextQuiz()`, `generateNightlyQuiz(profile)`, `gc()`.
- Schema validator rejects malformed multi-model output (id / topic / difficulty / question / 4 options with exactly one correct / whyMatrix / citation).
- 3-stage pipeline orchestrator stub: Gemini Deep Research outline → GPT-5.5 Thinking questions → Sprint E verifier cross-check.
- Pool stored in `localStorage.roweos_evolve_quiz_pool`; quizzes expire after 7 days; `gc()` prunes.
- Gated by `localStorage.roweos_evolve_quiz_engine === 'true'` AND Evolve enabled AND target goal set. Without flag, demo quiz on Practice tab still runs.
- Hook ready for v34: `evolve_nightly_content` automation calls `QuizEngine.generateNightlyQuiz(profile)`.

## v33.39 — Sprint 3: Stripe webhook helper consolidation
- Audit found `services/stripe/index.ts` was checking `metadata.kind` while the production webhook (`RoweOS/dist/api/stripe-webhook.js`) sets `metadata.type`. Fixed: `classifyCompletedCheckout` now accepts either field.
- `apiKeyProviderFromEvent` extended to fall back to `metadata.api_provider` and top-level `session.api_provider` so legacy create-api-key-checkout payloads classify correctly.
- 4 new tests covering both metadata field names + the api_provider fallbacks. **179 critical-path tests passing.**

## v33.38 — Sprint 2: brand-mode chat dispatcher migration
- `src/js/core/20-ui-misc.js` `_proceedStream` (brand-mode chat) now routes through `BrillianceServices.agents.dispatch(provider, ...)` when available, falls back to direct streaming globals.
- LifeAI + standard chat dispatchers retain direct calls because of nanobanana-image-detection branching that requires special routing — those callers move to a unified router in v33.39+.
- 175 tests still passing.

## v33.37 — Sprint 2 begins: services/agents complete dispatcher
- `services/agents/index.ts` — added `Provider` type + `callGoogle` + `callNanobanana` + `dispatch(provider, opts)` (provider-routed dispatcher with anthropic fallback for unknown providers).
- `src/js/core/37-services-bridge.js` — `BrillianceServices.agents` now exposes the same surface (callGoogle, callNanobanana, dispatch).
- `src/js/core/20-ui-misc.js` videolab streaming dispatch migrated to use `BrillianceServices.agents.dispatch(_vProvider, ...)` with full fallback chain to direct global calls.
- 4 new bridge tests covering dispatch routing + Google/Nanobanana defensives. **175 critical-path tests passing.**

## v33.36 — Sprint 1 finish: JSDoc public API head block
- `src/js/core/22-firebase-sync.js` head now carries a JSDoc-style block documenting the v4 sync public API: writeDB, readDB, writeDBDoc, deleteDBDoc, loadFromFirebaseV2, manualSyncNow, mergeByTimestamp, scheduleAutoSync. Each entry has signature + parameters + brief contract.
- `@ts-nocheck` preserved — flipping to `@ts-check` against a 9000+ line file would surface hundreds of implicit-any errors. Full ts-check is v34+ work per playbook.
- Tool-tip parity for migration callers: when a Sprint 1+ caller hovers BrillianceServices.sync.writeDB in their editor, the contract is now visible from both sides (TS facade + JSDoc head).

## v33.35 — Sprint 1: documents-lifeai + reminders + folio→library
- `src/js/core/25-documents-lifeai.js` brandMemory write migrated.
- `src/js/core/29-analytics-commerce.js` reminders save (line 5411) migrated.
- `src/js/core/17-automations.js` folio-visual save-to-library (line 3959) migrated.
- ~12 of ~25 Sprint 1 caller sites done. Remaining (analytics-commerce x9, offline x6, automations x1) get rolled out in v33.36+. 171 tests still green.

## v33.34 — Sprint 1: calendar + social caller migrations
- `src/js/core/14-calendar.js` create-pulse-goal-from-chat write migrated.
- `src/js/core/18-social.js` studio gallery persist (line 80) and folio image-save (line 5793) migrated.
- 9 of ~10 Sprint 1 caller sites done. 171 tests still green.

## v33.33 — Sprint 1: studio + ui-misc caller migrations
- `src/js/core/13-studio.js` video-delete writes go through facade.
- `src/js/core/20-ui-misc.js` web-search prefs + generic feature toggles migrated (2 sites).
- 6 of ~10 Sprint 1 caller sites done. 171 tests still green.

## v33.32 — Sprint 1: journal + sidebar caller migrations
- `src/js/core/19-journal.js:saveJournal` now writes through `BrillianceServices.sync.writeDB('profile/main', { journal })` with safe fallback.
- `src/js/core/21-sidebar.js` brand model config save migrated.
- 3 of ~10 Sprint 1 caller sites done. Test count unchanged (171); the migration is behaviorally identical when the bridge is available.

## v33.31 — Sprint 1 begins: first services/sync caller migration

The v33.5-milestone push starts. Per `docs/brilliance/15-architecture-playbook.md` Sprint 1, callers should migrate from `window.writeDB` etc. to `services/sync` so future swaps don't require touching every site.

### First migrated caller: saveScribeNotebooks
- `src/js/core/33-scribe.js` — the write-through call now uses `window.BrillianceServices.sync.writeDB('scribe/notebooks', { notebooks }, { category: 'scribe' })` with a graceful fallback to the legacy `writeDB` global if the bridge isn't loaded.
- Pilot for the migration pattern; subsequent callers (calendar, journal, social, sidebar, ui-misc, documents-lifeai) follow this template in v33.32+.

### Bridge args pass-through
- `src/js/core/37-services-bridge.js` — `ensure()` now uses `fn.apply(null, arguments)` and wraps the return in `Promise.resolve()`. Any positional args (e.g. `options.category`) reach the v4 global intact. Sync callers no longer lose category gating when migrating.
- 171 critical-path tests still passing.

## v33.30 — Flag persistence tests (final deploy of 2026-04-29 night session)

- `src/__tests__/critical/sync-v5-flags.test.ts` — 10 tests covering setEnabled/setWritesEnabled localStorage persistence, module-reload survival, the dual-flag requirement of `writesEnabled()` (both flags must be on), and the disabling-read-shadow-effectively-disables-writes invariant.
- 171 total tests passing.

### Final session totals (v33.0 → v33.30)
- 30 production deploys
- 171 critical-path tests passing in <1.2s
- 10 SyncV5 read-shadow collections (automations, brands, conversations, scribe, reminders, pulse_goals, library, mail, journal, folio) + gated cloud writes for evolve_* native collections
- 5 Brilli forms (Celestial / Aura / Firefly / Light Signature / Classic) with full state machine, intensity slider + presets, theme refresh, sleep mode, keyboard accessibility
- Full Evolve module: 5 tabs with real LLM Translator + Verifier, drill mode, XP + streak, export/import, Translator-pattern injection into chat agents
- 3 TypeScript service facades (sync, agents, stripe) + JS runtime bridge
- Complete UI overhaul against `RoweOS/dist/brilliance-mockups/`: sidebar Brilliance lockup, launch screen Brilliance lockup, mobile liquid-nav Brilli dot, Concierge Desk pill row above chat hero, full Evolve view per mockup 13
- Settings affordances for every feature flag
- Comprehensive `docs/brilliance/18-v33-architecture.md` for the next session

## v33.29 — Journal + folio shadow tests (night session)

- `src/__tests__/critical/sync-v5-shadows.test.ts` — 9 tests covering the v33.27 journal + folio compare callbacks. Locks: cloud-only id triggers discrepancy; matching local id passes; legacy `roweos_pulse_journal` key handled; malformed JSON degrades; missing cloud doc id is matches:true; non-array local data handled; all 10 read-shadow starters exposed.
- 161 tests total now passing.

## v33.28 — Hero a11y + memory final (night session)

### Brilli hero — keyboard accessible
- `#brilliHero` now has `role="button"`, `tabindex="0"`, and an `onkeydown` handler that opens the form picker on Enter or Space.
- `:focus-visible` shows a 3px gold ring at 50% radius — keyboard users see exactly where focus lands.

### Memory file finalized
- `feedback_night_session_2026_04_29.md` updated with the full through-line: 28 deploys, 152 tests, 10 SyncV5 collections, all polish items + the v33.5+ pickup list.
- Future sessions: read `docs/brilliance/18-v33-architecture.md` first.

## v33.27 — Two more sync collections + localStorage audit (night session)

### SyncV5 — 10 collections under read-shadow
- Added `journal` (compares against `roweos_journal` / `roweos_pulse_journal`).
- Added `folio` (compares against `roweos_folio_artifacts`).
- Total now 10: automations, brands, conversations, scribe, reminders, pulse_goals, library, mail, journal, folio.

### localStorage hardening audit (clean)
- Verified every localStorage read/write in v33.x modules (34-brilli.js, 35-sync-v5.js, 36-evolve.js, 37-services-bridge.js, 07-early-inline.js, late/00-api-bridge.js concierge) is wrapped in try/catch.
- Safari private mode + sandboxed iframes throw SecurityError on setItem; we degrade gracefully.

## v33.26 — Architecture overview doc (night session)

- New `docs/brilliance/18-v33-architecture.md` — comprehensive map of everything shipped this session: Brilli (5 forms, state machine, intensity, theme refresh), Evolve (5 tabs with real LLM Translator + Verifier), Sync v5 (8 collections + gated cloud writes), services facades, UI overhaul against mockups, full test surface, deploy log v33.0 → v33.25, and what v33.5+ picks up.
- Designed as the single read for any future Claude/contractor session that needs to navigate the v33.x foundation without re-reading 26 changelog entries.

## v33.25 — Listener retry tests + audit pass (night session)

### SyncV5 listener retry tests (5 added → 152 total)
- `src/__tests__/critical/sync-v5-retry.test.ts` — uses `vi.useFakeTimers()` + a mock Firestore that captures success/error callbacks per subscription. Verifies the v33.22 retry path:
  - Error fires → `_retryCount` increments
  - 30s timer fires → fresh subscription created
  - Cap at 3 retries (4th error is silently ignored)
  - Successful snapshot resets `_retryCount` to 0
  - Old listener is unsubscribed before retry attempt

### Audit pass — clean
- Re-read v33.20-v33.24 changes. Retry path correctly tears down old listener via `_unsubscribeFirestore = null` before re-entering `_startReadShadow`.
- Import path correctly preserves IDs + data shape; timestamps are fresh by design (treats imports as fresh writes).

## v33.24 — Master roadmap final sync (night session)

- `docs/brilliance/17-master-roadmap.md` Active version now reads `v33.23` (the night-session through-line). The roadmap status block already reflects the shipped milestones; this aligns the version pointer.

## v33.23 — Settings affordances + memory sync (night session)

### Settings — Concierge Row toggle
- Settings → Appearance → "Concierge Row" row toggles `localStorage.roweos_concierge_off`. Live-updates the row visibility (renders or hides). Label "On"/"Off" reflects state.
- Closes the discoverability gap from v33.21 (× dismissal had no re-enable path).

### Settings — Evolve toggle
- Settings → Appearance → "Evolve · Preview" row toggles `localStorage.roweos_evolve_enabled` and updates the `data-evolve` attribute on `<html>` (which gates the sidebar nav item).
- Toast prompts user to reload after enabling for full effect (chat agents pick up Translator prompt at next page load).
- No more "set localStorage in console" instruction.

### Memory + master roadmap synced
- `feedback_night_session_2026_04_29.md` records the actual through-line: 23 deploys, 147 tests, Sprint A/B/C-light/D/E-light/F shipped, 8 SyncV5 collections + gated cloud writes for evolve_*.

## v33.22 — Reminders pill + sync retry + bridge tests (night session)

### Concierge "Reminders due" pill
- Counts non-completed/dismissed/archived reminders whose `scheduledAt` is in the past. Click opens Pulse view.
- Uses parsed ISO date for `scheduledAt`; sorts ahead of Resume.

### SyncV5 listener auto-retry
- onSnapshot error handler now schedules a retry via `_startReadShadow(uid, opts)` after 30s, up to 3 attempts.
- Successful snapshot resets the retry counter.
- Surfaces `lastError` in stats but keeps trying — transient Firestore blips no longer require a page reload.

### services/sync + services/agents bridge tests (16 added → 147 total)
- `src/__tests__/critical/services-bridge.test.ts` — defensive throws when globals missing, delegation forwards args correctly, mergeByTimestamp fallback path, currentUser handling, agents callAnthropic forwards model/key/messages/system/callbacks tuple, getAgentSystemPrompt delegation.

## v33.21 — Import tests + concierge dismiss + welcome-email rebrand audit (night session)

### Evolve import tests (12 added → 131 total)
- `src/__tests__/critical/evolve-import.test.ts` — exportData shape, importData validation (rejects non-object, rejects unknown version, accepts legacy no-version), overwrite protection (refuses without confirm/merge, confirmedReplace overwrites, merge patches), collection import (preserves IDs, skips tombstones by default, includeDeleted=true imports them), full export → import round-trip preserves profile + collections.

### Concierge dismissal preference
- × button at the right edge of the concierge row. One click hides the row + sets `localStorage.roweos_concierge_off = 'true'`.
- Render path checks the flag first; respects across reloads.
- Keeps the row out of the way for power users who don't need the surface.

### Welcome-email rebrand audit (final pass)
- Every "Welcome to RoweOS" string in user-facing email subjects + bodies + onboarding tour flipped to "Welcome to Brilliance" — including:
  - Founder welcome email h1
  - Tier-specific access-key email subjects (Solo / Founder / Generic)
  - Welcome HTML body fallback
  - Tour Step 1 ("Welcome to Brilliance") with Brilli (no longer "B.L.A.K.E.") in copy
- Code-internal stays RoweOS per Option A; only user-visible strings change.

## v33.20 — Evolve import + Brilli theme refresh + 8th sync collection (night session)

### Evolve import
- `Evolve.openImportDialog()` opens a file picker, parses JSON, validates structure (`version: 'evolve-v1'`), then either merges with existing data (default when profile present) or applies fresh.
- `Evolve.importData(snapshot, opts)` is the pure API — restores profile + skills/sources/reflections/sops collections.
- "Import" button alongside "Download backup" in Skills tab header.
- Symmetric with v33.19's exportData.

### Brilli refresh on theme toggle
- MutationObserver on `<html>.className` (where `light-mode`, `brand-mode`, `life-mode` classes live) triggers `Brilli.refresh()` on every active instance, re-reading CSS gold variables.
- No leak: single observer for the lifetime of the page.

### SyncV5 — 8 collections under read-shadow
- Added `mail` (outbox + sent merged for compare). Cloud path `users/{uid}/mail`.
- Total: automations, brands, conversations, scribe, reminders, pulse_goals, library, mail.

## v33.19 — Brilli state tests + JSON exports (night session)

### Brilli state machine tests (14 added → 119 total)
- `src/__tests__/critical/brilli-state.test.ts` — `mount` returns null for null host, classic form goes staticOnly, pin size goes staticOnly, opts.form falls back to active form. `setMode` updates mode + modeChangedAt + pulseFlash on pleased; no-op when unchanged; safe with null instance. `unmount` removes children; safe with null. `setActiveForm` re-mounts existing instances + fires `brilli:form-changed` CustomEvent.
- Added `afterEach` cleanup that unmounts all instances so RAF doesn't fire on dead canvases between tests.

### Defensive null-canvas guards in 34-brilli.js
- `mount` now sets `staticOnly = true` BEFORE attempting an initial `drawFrame`, and skips the draw if `b.ctx` is null. Handles jsdom + canvas-init-failure cases on real browsers cleanly.
- `setMode` and `refresh` only call `drawFrame` when `staticOnly && b.ctx`. No more null-ctx crashes.

### Sync v5 panel — Export stats button
- Downloads a timestamped JSON snapshot of `getStats()` (enabled/writes/eventsSeen/discrepancies/perCollection/recentEvents/etc.).
- Filename: `brilliance-syncv5-stats-<ISO>.json`.
- Useful for support tickets + correlating user reports with telemetry.

### Evolve — Download backup
- Skills tab header gains a "Download backup" button.
- `Evolve.downloadExport()` exports `{ version, exportedAt, profile, collections: { skills, sources, reflections, sops } }` as JSON.
- Includes deleted (tombstoned) items so users can restore from backup if needed.

## v33.18 — Cache clear tests + quiz drill counter (night session)

### SyncV5.clearLocalCache tests (5 added → 105 total)
- `src/__tests__/critical/sync-v5-cache.test.ts` — removes only `brilliance_v5_*` keys; preserves other localStorage; returns count of cleared entries; resets in-memory Collection state; zeros stats; preserves enabled/writesEnabled flags.

### Quiz attempt counter on card
- When user has retried at least once via Drill mode (`Evolve._retryQuiz`), the quiz card meta now shows "topic · attempt N" so users see the drill state.
- Counter is per-quiz-id and persists in localStorage.

## v33.17 — Concierge empty + sync hotkey + picker keyboard (night session)

### Concierge — empty-state pill
- When zero data pills would render, a single "Begin · Set a goal in Pulse" pill appears with an arrow icon. Surface is never bare.

### Sync v5 keyboard shortcut
- ⇧⌘S (or Shift+Ctrl+S) opens the Sync v5 panel from anywhere. Honored when not in input/textarea.
- Hint visible in Settings → Sync row label.

### Brilli picker keyboard nav
- ← / → cycles through forms (Brilli updates live as you cycle).
- Enter or Esc closes the picker.
- Mouse path unchanged.

## v33.16 — Hero clickable + cache clear + Evolve landing (night session)

### Hero Brilli is clickable
- `#brilliHero` on chat landing has `cursor: pointer` and an `onclick` that opens the Brilli Form picker.
- Discoverability: users can swap forms without diving into Settings.
- `aria-label="Change Brilli form"` for accessibility.

### SyncV5 — Clear v5 local cache
- Red button in Sync v5 panel removes all `brilliance_v5_*` localStorage keys + resets in-memory Collection caches + zeros stats.
- Confirm dialog warns that cloud data is unaffected; the read-shadow will repopulate on next event.
- Toast confirms how many cache entries were cleared.

### Evolve in `_pageLandingConfigs`
- Evolve now has a proper landing page (label EVOLVE, tagline "Educational Intelligence", description) before users hit the multi-tab UI.
- Features list includes all 5 tabs: Today / Practice / Translator / Verify / Skills.

## v33.15 — Polish: presets + events log + reflections list (night session)

### Brilli intensity preset chips
- Below the slider in Settings: Subtle (30) / Calm (60) / Default (100). One-click intensity. Updates the slider value and label live.

### SyncV5 panel — Recent events log
- New "Recent events" block below per-collection stats. Shows last 5 onSnapshot events with collection name, action (added/modified/removed), and timestamp.
- `stats.recentEvents` array maintained (cap 5) and exposed via `getStats().recentEvents`.

### Evolve Skills tab — reflections + sources lists
- Replaced the stub copy with real lists pulled from SyncV5 collections.
- Last 5 reflections (sorted by `_modifiedAt`) + last 5 sources. Each row has a delete button (×).
- "+ New" button moves into the card header for tighter layout.
- `Evolve._removeFromCollection(coll, id)` deletes via SyncV5 (which writes a tombstone + cloud-writes if v5 writes enabled).

## v33.14 — 100 critical tests milestone (night session)

### Test coverage milestone
- **100 critical-path tests passing** in <900ms total. 36 tests added on top of v33.13's 64.

### Brilli intensity tests (11 added)
- `src/__tests__/critical/brilli-intensity.test.ts` — default 100, persists, clamps 0-100, fires CustomEvent, survives module reload.
- Plus active-form tests: default celestial, valid forms accepted, invalid ignored, persists.

### Evolve profile tests (16 added)
- `src/__tests__/critical/evolve-profile.test.ts` — getProfile/setProfile patches without losing fields, persists, daysToDeadline arithmetic (positive future / negative past / null on missing/invalid), generateEvolveSystemPrompt mentions goal+context+cognitive, recalibrateMomentum: ADHD micro-tasks vs default Pomodoro, no recalibration on fresh session, recalibrates after 2+ missed days, no recalibration without deadline.

### SyncV5 stats tests (9 added)
- `src/__tests__/critical/sync-v5-stats.test.ts` — subscribeStats lifecycle (multiple subscribers, throw tolerance, unsubscribe), getStats shape (initial zeroed, v5NativeCollections allowlist), resetStats (clears counters but preserves flags, fires listeners).

## v33.13 — Brilli intensity + quiz hotkeys + sync reset (2026-04-29 night session)

### Brilli Intensity slider in Settings
- Slider 0-100, persists to `localStorage.roweos_brilli_intensity`. Multiplies all `modeIntensity()` outputs (glow, pulseHz, sparkRate, scaleAmp).
- Below the Brilli Form picker. Live updates as you drag.
- Lets users dial Brilli down to a slow steady glow if the default feels too active.

### Evolve quiz hot-keys
- Practice tab now wires keyboard handlers when active (and unwires when leaving).
- Keys: 1-4 or A-D selects an option; Enter reveals (then Enter again advances); N for next; R for retry.
- Inputs/textareas honored — keys never steal from typing.

### Sync v5 panel — Reset stats
- New "Reset stats" button (red-tinted) at the panel footer. Clears all counters (events, discrepancies, perCollection, lastError) without stopping the listener.
- Useful for establishing a clean baseline measurement after a known cloud event.

## v33.12 — More v5 collections + drill mode + services bridge (2026-04-29 night session)

### SyncV5 — 7 collections under observation
- Added `pulse_goals` (completion drift check) and `library` (cloud-only id check via studio_gallery).
- Total v5-shadowed: automations, brands, conversations, scribe, reminders, pulse_goals, library.

### Evolve drill mode
- Incorrect quiz answer reveals a "Retry (Drill)" button alongside "Next question". Resets selection state for that quiz id.
- Attempts tracked in `localStorage.roweos_evolve_quiz_attempts_<id>` for future persistence-XP awarding.

### Brilli orphan pruning
- Closing the Brilli Form picker walks `Brilli._debugInstances()` and unmounts any instance whose host is detached from DOM. Prevents RAF leak from preview canvases.

### BrillianceServices runtime bridge
- `src/js/core/37-services-bridge.js` — plain-JS mirror of `services/sync/index.ts` and `services/agents/index.ts`. Exposed as `window.BrillianceServices.{sync,agents}`. Lets JS callers use the canonical API today, before esbuild ships in v33.5+.
- TS facades remain canonical for types and future-tooling-driven migration.

## v33.11 — Sync state visualization + 375px audit + roadmap sync (2026-04-29 night session)

### Sidebar Brilli pulses on sync events
- `SyncV5.subscribeStats(handler)` listener flashes the sidebar Brilli to `thinking` mode for 600ms when a discrepancy is detected within the last 1.5s. Throttled max 1/sec to never feel noisy.
- Visual cue without copy: users notice something happened in the background, can open Settings → Sync v5 panel to see what.

### 375px Evolve audit
- Quiz card padding reduced (14px), font sizes drop (q: 15px, body: 12px), letter circle 22px.
- Pane padding 14px 12px on narrow.
- Side rail head 12px padding. Tab strip 6px 8px padding, tab fonts 11px.
- Skill cards 12px padding, today header 20px.

### Master roadmap + memory sync
- `docs/brilliance/17-master-roadmap.md` reflects v33.0 → v33.10 progress (way ahead of the original 5-week v33.0 schedule). Sprint A/B/D/E/F shipped tonight.
- Memory file `feedback_night_session_2026_04_29.md` updated with full snapshot for next session resume.

## v33.10 — Cloud-write tests + Brilli sleep + nightly hook + per-collection stats (2026-04-29 night session)

### SyncV5 cloud-write integration tests (9 added → 64 total)
- `src/__tests__/critical/sync-v5-cloud-write.test.ts` mocks `firebase.firestore()` to capture every `.doc(id).set(envelope, {merge:true})` call.
- Locks invariants: writes ONLY when (isEnabled && writesEnabled && isV5NativeCollection && firebase + uid available). V4-shadowed collections never trigger writes. Tombstones flow on delete. Doesn't throw when firebase or firebaseUser missing.

### Brilli sleep mode polish
- On `visibilitychange` → hidden, instances flip to `asleep` mode for the parked frame so the wake-up animation has the right starting state.
- On visible again, restores the prior mode and resumes the RAF loop.

### Evolve nightly automation hook (v34 placeholder)
- When user opens Evolve view AND has a target goal, an entry is registered in `roweos_automations` with id `evolve_nightly_content`, name "Evolve · Nightly content gen", `enabled: false`, `_v33scaffold: true`. Cron `0 3 * * *`.
- v34 Sprint C activates this entry (sets enabled: true and points to the multi-model pipeline). For now it just shows up in Automations Lab so users see what's coming.

### Per-collection stats breakdown
- `SyncV5.getStats().perCollection` returns `{ name: { events, discrepancies, lastDiscrepancyAt, lastSummary } }`.
- Settings → Sync → Sync v5 panel renders a "Per-collection" block with each collection's events + diff count. Diff count colored red when > 0.

## v33.9 — Two more Brilli forms + concierge + sync writes UI (2026-04-29 night session)

### Brilli forms — Firefly + Light Signature
- `firefly`: glowing body with wings flapping (additive composite low-alpha ellipses), particle trail. State machine reactive.
- `signature`: 24-dot trailing arc tracing a circle. Pure motion, minimal silhouette. Bright leading head.
- Settings → Brilli Form picker now shows 5 options (Celestial / Aura / Firefly / Signature / Classic) in an auto-fit grid.
- CSS `data-brilli-form` selector extended; early-inline gate handles all 5 valid forms.

### Concierge Desk — richer pills
- "Today" pill: live `done/total` Evolve task progress (when Evolve enabled and target goal set).
- "Streak" pill: 2+ day streak indicator.
- "Resume" pill: most-recent conversation title (truncated at 22 chars). Click to open chat.
- All gated by source data — empty states stay empty.

### Sync v5 panel — Writes toggle
- Second toggle below Read-shadow: "Cloud writes (Preview)" with red preview chip.
- Disabled when Read-shadow is off (no writes without listening).
- When on, evolve_skills / evolve_sources / evolve_reflections / evolve_sops cloud-write to Firestore on every `addSkill`/`addReflection`/etc.
- Clear copy: "v5-native only. V4-shadowed collections stay v4-authoritative."

## v33.8 — Sync v5 write activation gate + agents tests (2026-04-29 night session)

### SyncV5 write activation gate
- Second feature flag: `localStorage.roweos_sync_v5_writes`. Combined with the existing read-shadow flag, allows v5-native collections to PUSH to Firestore.
- Allowlist: `evolve_skills`, `evolve_sources`, `evolve_reflections`, `evolve_sops` only. V4-shadowed collections (`automations`, `brands`, `conversations`, `scribe`, `reminders`) STILL never write through v5 — they remain v4-authoritative until v34 dual-write phase.
- `Collection._maybeCloudWrite(id, envelope)` runs `firestore.collection(path).doc(id).set(envelope, { merge: true })` on every `write/delete`. Errors surface as `stats.lastError` and notify subscribers.
- `SyncV5.writesEnabled()` / `setWritesEnabled(on)` / `getStats().writesEnabled` for inspection.

### Evolve cloud writes (gated)
- When both `roweos_sync_v5_enabled` and `roweos_sync_v5_writes` are `'true'`, `Evolve.addSkill/addReflection/addSource/addSop` automatically push to Firestore. New data type, no v4 conflict.

### services/agents tests (11 added → 55 total passing)
- `src/__tests__/critical/agents-facade.test.ts` — defensive throws when global call functions missing, delegation forwards model/messages/system/key/callbacks/AbortSignal correctly to `callAnthropicStreaming` and `callOpenAIStreaming`, `getAgentSystemPrompt` and `buildBrandSystemPrompt` round-trip with the right args, type compatibility for `ChatMessage` with both string + ContentBlock-array content shapes.

## v33.7 — Sync v5 expansion + cross-mode + tests (2026-04-29 night session)

### SyncV5 read-shadow expanded — 5 collections under observation
- `automations`, `brands`, `conversations` (existing) + `scribe` (notebooks) + `reminders` (status drift detection).
- Reminder shadow flags status drift specifically (open vs done vs snoozed).
- Notebook shadow flags >5s timestamp drift.
- All five auto-start when SyncV5 is enabled and `firebaseUser.uid` resolves.

### services/sync facade tests (14 added)
- `src/__tests__/critical/sync-facade.test.ts` — defensive throws when v4 globals missing, delegation when present, mergeByTimestamp fallback (cloud preferred when global missing, local preserved when cloud is empty), envelope type checks.
- 44 critical-path tests now passing in <600ms.

### Evolve → Pulse cross-mode insights
- Completing an Evolve task now logs an entry to `roweos_pulse_insights` (kind: `evolve_completion`) so the Concierge Desk row and Pulse view both surface Evolve activity.
- Last 50 entries kept; `scheduleAutoSync()` triggered to push to cloud immediately.

### Quiz card mobile tightening
- Tighter padding, smaller fonts, single-column skill grid below 768px.
- Side-rail countdown number drops from 32px → 26px on mobile so it doesn't dominate.

## v33.6 — Verifier + conversations shadow + What's New modal (2026-04-29 night session)

### Verifier pane — real LLM peer-review
- Paste a claim, click "Run peer-review →", get a single-model verification with VERIFIED / CORRECTED / INSUFFICIENT_EVIDENCE badge.
- Output structure: VERDICT, Reasoning, Updated sequence, Confidence (1-5), Caveat. Streamed token-by-token.
- "Save reflection" stores the result as a SyncV5 reflection (Pillar VI link).
- Routes to Anthropic Opus first, OpenAI GPT-5 fallback. Persists draft text to localStorage so users don't lose long claims to a refresh.
- v34 Sprint E adds Gemini Deep Research + GPT-5.5 Pro cross-review; this is the single-model bridge.

### SyncV5 read-shadow for conversations
- Third collection under v5 observation. Compares cloud `users/{uid}/chats/*` against `roweos_agentCommands` + `roweos_deleted_chat_ids` tombstones. Bumps discrepancy when a tombstoned chat appears in cloud (resurrection canary) or when message counts drift > 1.
- Auto-starts when SyncV5 is enabled.

### What's New modal (v33.6+)
- Fires once per minor version for users who already saw the v33.0 welcome. Shows top 5 changes. ESC + click-outside dismiss.
- "Don't show again" checkbox sets `localStorage.brilliance_whatsnew_off = 'true'` permanently.
- Last-seen version persists per-user (`brilliance_whatsnew_seen` synced to `profile/whatsnew_seen`).

### Brilli tutor pose on Evolve
- Sidebar Brilli flips to `attending` mode whenever the Evolve view is active. Reverts to `idle` on view change. Subtle context cue.

### Sync v5 edge-case tests (8 added — 30 total passing)
- Multi-collection isolation
- Tombstone rehydration across reload
- Subscriber error tolerance (one throw doesn't stop the chain)
- ResolveConflict determinism with identical timestamps + clientIds
- Future-dated cloud timestamp handling
- SchemaVersion preservation
- Auto clientId reuse

## v33.5 — Evolve depth + service facades + Stripe tests (2026-04-29 night session)

### Evolve Practice tab — interactive quiz card
- Hardcoded demo quiz with 4 options + Why/Why-Not Matrix on reveal + citation row.
- Click an option → enable Reveal → reveal flips state and renders the matrix; correct answer banks +12 XP and triggers Brilli pleased flash.
- "Next question" cycles through demo set (currently 2 quizzes — Reading + Architecture).
- Quiz state persists per-id in localStorage. v34 Sprint C swaps demo source for the multi-model pipeline (Gemini Deep Research → GPT-5.5 Thinking → JSON questions).

### Evolve Translator pane — real LLM calls
- Type a term, press Enter or "Translate →", and the right pane streams a 4-section response (Generic term / Mechanism / Competitor equivalents / Exam-mapped) using `Evolve.generateEvolveSystemPrompt(profile)` + a translator-specific instruction.
- Routes to Anthropic Claude 4.7 Opus first (preferred), falls back to OpenAI GPT-5 if no Anthropic key. No-key path shows a friendly error.
- "Save to Memory" appends the term to `profile.knownContext` so the Translator never asks again. Reflects in side rail context.

### SyncV5 read-shadow extended to brands
- `startReadShadowForBrands(uid)` runs alongside `startReadShadowForAutomations`. Compares cloud brand docs (stable id paths per v27.3) against `roweos_user_brands` localStorage. Bumps discrepancy counter on >10s timestamp drift. Skips `_all` doc.
- Both shadows auto-start when `localStorage.roweos_sync_v5_enabled === 'true'` and `firebaseUser.uid` resolves.
- Settings → Sync → Sync v5 panel now lists both `automations` and `brands` in active collections.

### services/agents typed facade
- `services/agents/index.ts` wraps `callAnthropicStreaming`, `callOpenAIStreaming`, `getAgentSystemPrompt`, `buildBrandSystemPrompt`. Strict types for `ChatMessage`, `ContentBlock`, `StreamCallbacks`. v33.5+ TS callers can import from here instead of touching globals.

### services/stripe typed facade + tests (8 passing)
- `services/stripe/index.ts`: typed `createCheckout`, `createPortalSession`, `classifyCompletedCheckout`, `apiKeyProviderFromEvent`. Pure helpers shared between webhook handler + tests.
- `src/__tests__/critical/stripe.test.ts`: 8 tests covering classification of completed checkout sessions (subscription via metadata.kind / mode fallback, api_key_purchase, null cases) and api-key provider extraction. Total suite now 22 passing.

### Evolve Skills/Sources/Reflections via SyncV5 collections
- `Evolve.listSkills()`, `listSources()`, `listReflections()`, `listSops()` — typed lists from `evolve_skills`, `evolve_sources`, `evolve_reflections`, `evolve_sops` SyncV5 collections.
- `addSkill/addSource/addReflection/addSop` — write to the same collections; client-side UUIDs.
- Skills tab now shows real skill counts pulled from these collections + 4 default pillar-based skills derived from XP/streak/sources/reflections counts.
- Add Reflection / Add Source buttons via `prompt()` for now (full editor in Sprint F).

## v33.4 — Mockup-driven UI overhaul (2026-04-29 night session)

Following the master roadmap and the brilliance-mockups library, every visible surface gets the v33 treatment. Mobile parity is a hard requirement on every change in this batch.

### Sidebar Brilliance lockup (mockup 04)
- New footer lockup: pulsing Brilli dot + "Brilliance · by RoweOS" beneath the brand mark.
- Lockup adapts to collapsed/expanded sidebar states. Hidden text when sidebar is collapsed; dot stays visible.
- Mobile: compact lockup with smaller font sizes.
- The brand-logo header (user's brand 0 logo) is preserved per Option A.

### Launch screen rebrand (mockup 03)
- Replaces the base64 RoweOS PNG logo with a CSS-only Brilliance lockup: Celestial Orb (200px, full breathe/bloom/twinkle animations) + "Brilliance" wordmark (Cormorant Garamond gold gradient) + "Intelligence OS" eyebrow + "by RoweOS" credit.
- Reduced-motion fallback honored.
- The post-launch quick links (BrandAI / Studio / Explore / Add brand) are preserved.

### Evolve view — full multi-tab UI (mockup 13)
- Side rail (240px desktop / collapses to top strip on mobile) with:
  - Goal + countdown ("X days remaining")
  - Progress fill bar (XP-derived)
  - XP + streak stats
  - Tab nav: Today / Practice / Translator / Verify / Skills
  - Translator context preview (known context strings)
- **Today tab**: existing Sprint A+B Pulse Dashboard (countdown + Liquid Rhythm cards + completion checkboxes).
- **Practice tab**: Pillar III scaffold — Multi-model Quiz Engine queued for v34 Sprint C.
- **Translator tab**: two-pane layout (My Context input + What It Means stream) with known-context list.
- **Verify tab**: Pillar V scaffold — Deep Verification Studio queued for v34 Sprint E. Local textarea for capturing concepts.
- **Skills tab**: skill-tree grid with XP progress per pillar. Sync v5 Collection-backed in v34 Sprint F.
- Mobile: tabs become a horizontal scroll strip; translator collapses to single column.

### Mobile liquid-nav Brilli dot (mockup 08)
- Tiny pulsing Brilli dot at the left edge of the bottom liquid-nav pill on mobile. Mirrors the desktop sidebar status dot — softly pulsing, brighter on automation completion.
- Existing tabs / blur / glass preserved entirely.

### Concierge Desk pill row above chat hero (mockup 12 surface map)
- New pill row above the chat input on the landing surface. Surfaces what's active across:
  - Pulse open goals
  - Active automations
  - Bloom unread
  - Today's calendar events
  - Evolve days-remaining (when enabled)
- Click any pill to jump to that view. Empty when nothing is active (no clutter).
- Mobile: tighter spacing, smaller font.

### Vitest tooling
- `src/__tests__/setup.ts` polyfills `localStorage` for Vitest 4.x jsdom (which ships a frozen `{}`). 14 critical-path SyncV5 tests pass in <500ms.

## v33.3 — Orb circle fix + Evolve Sprint B + services/sync facade (2026-04-29)

Continued night session. Fixes the visible square frame around the chat hero orb that the helix backdrop was making obvious, plus a chunk of v33.5 work pulled forward.

### Brilli orb fix
- `#brilliHero` now has `clip-path: circle(50%)`, explicit transparent background, and `contain: paint`. The bloom halo can no longer appear bounded by the canvas's rectangular bounding box — the helix backdrop showing through the bloom edge made the canvas look like a square frame, even though no rectangle was being drawn.
- Brilli `attending` mode wires to chat input focus/blur. Idle → attending on focus, back to idle on blur. Skipped if a stronger state (thinking, delivering) is active.

### Notebook rename (Scribe → Notebook, user-facing)
- Sidebar nav label: "Scribe" → "Notebook" (data-view stays `scribe`, function names stay `initScribe`, etc., per Option A).
- Page-landing title flipped from "SCRIBE" → "NOTEBOOK".
- Internal CSS classes (`scribe-nb-item`, `scribe-pg-item`) preserved.

### Evolve Sprint B — Liquid Rhythm Planner (Pillar II)
- `Evolve.recalibrateMomentum(profile)` algorithm. Anti-ADHD: when missed days accumulate, target re-flows across remaining days (capped 1.6x), no overdue alerts.
- ADHD profile triggers 10-min micro-tasks; default profile uses 25-min Pomodoro units. 2-5 task cap based on recalibrated daily total.
- Recalibration banner appears in dashboard when re-flow is active (gold full-border, never one-sided per Jordan preference).

### Evolve XP + streak tracking
- Click a daily-load card → marks complete + XP equal to task minutes + streak tick.
- Daily streak: increments when previous session was yesterday, resets when gap >= 2 days.
- Persists to `localStorage.roweos_evolve_profile.completedToday[YYYY-MM-DD]`.
- Brilli hero AND sidebar dot flash `pleased` on completion (1.2s pulse) — the dopamine hit from spec.
- Toast "+N XP · M-day streak" on every completion.

### services/sync facade (Sprint 1 prep)
- `services/sync/index.ts` typed wrapper over the existing v4 sync globals (`writeDB`, `readDB`, `writeDBDoc`, `deleteDBDoc`, `loadFromFirebaseV2`, `manualSyncNow`, `mergeByTimestamp`).
- Strict TypeScript types for `SyncedItem<T>` envelope. v34 dual-write swaps the implementation behind this same API.
- `// @ts-nocheck` added to `22-firebase-sync.js` head (full JSDoc types come in v33.5 Sprint 1).

### Vitest critical-path tests (14 passing)
- `src/__tests__/critical/sync-v5.test.ts` — envelope shape, conflict resolution, Collection CRUD (write/read/list/delete/subscribe), tombstone semantics, feature flag gating.
- `src/__tests__/setup.ts` — Map-backed localStorage polyfill (Vitest 4.x jsdom ships a frozen empty object).
- `npm test` runs all in <500ms.

### Translator pattern wiring
- `getAgentSystemPrompt` (BrandAI agents) and `buildBrandSystemPrompt` (Studio operations) now append `Evolve.generateEvolveSystemPrompt(profile)` when Evolve is enabled and a target goal is set.
- Every chat / Studio call automatically translates new concepts via the user's existing mental models. Real Sprint D Translator pipeline (Claude 4.7 Opus two-pane mini-app) lands in v34.

## v33.2 — Evolve Sprint A + Sync v5 read-shadow + Sprint 0 tooling (2026-04-29)

A second push the same day v33.0/v33.1 shipped. The v34 scaffolds become observable.

### Evolve Sprint A — Pulse Dashboard live (flag-gated)
- Sidebar nav entry "Evolve" appears when `localStorage.roweos_evolve_enabled === 'true'`. Hidden otherwise. Pre-paint flag set in `07-early-inline.js` so there is no flash.
- Pulse Dashboard renders countdown + goal hero + XP/streak + cognitive-profile slot + 3 daily-load cards (Review / Quiz / Apply). ADHD profile triggers 10-min micro-tasks vs 25-min default.
- Profile editor modal: target goal, deadline date, known context (one-per-line), cognitive profile. Saved to `localStorage.roweos_evolve_profile`. Reset button clears.
- `Evolve.generateEvolveSystemPrompt(profile)` available on global. Translator pattern stub returning a usable prompt that the chat agents can pick up in v33.5 Sprint 4.
- Liquid Rhythm Planner (Sprint B) and Multi-model Quiz Engine (Sprint C) replace daily-load placeholders in v34 per `docs/brilliance/14-evolve.md`.

### Sync v5 — read-shadow active
- `35-sync-v5.js` now starts a `onSnapshot` listener for `users/{uid}/automations` when feature flag enabled (`localStorage.roweos_sync_v5_enabled === 'true'`). Listens, compares against v4 `roweos_automations`, counts discrepancies — does NOT write to Firestore.
- Compare callback flags: cloud-only ids, missing locally, timestamp drift > 5s.
- Settings → Sync → "Sync v5 (Preview)" panel: Enable/Disable toggle, live stats (events seen, discrepancies, last event, last error), active collections list. Updates in real-time via `SyncV5.subscribeStats(handler)`.
- Auto-start: when flag is on, polls for `firebaseUser.uid` for up to 60s after page load and starts the shadow as soon as auth resolves.

### Sprint 0 tooling scaffold (per architecture playbook §3)
- `package.json` with `vitest`, `typescript`, `esbuild`, `tsx`, `jsdom`, `@types/node` devDeps. Scripts: `build`, `test`, `test:watch`, `test:critical`, `typecheck`.
- `tsconfig.json` (ES2020, strict, allowJs, paths `@/*`).
- `vitest.config.ts` (jsdom env, coverage v8).
- `build.config.ts` esbuild scaffold — placeholder entry point; v33.5 Sprint 0 swaps in `services/main.ts`.
- `src/__tests__/setup.ts` + `src/__tests__/sample.test.ts` proves runner end-to-end.
- `.gitignore` updated for `node_modules/`, `coverage/`, scaffold bundle artifacts.
- **Not activated.** `bash src/build.sh` is still the production build path. Run `npm install && npm test` once you are ready to wire CI.

## v33.1 — Phase C-full + v34 scaffolds (2026-04-29)

The "Brilli is alive" follow-up to v33.0. Three things land:

### Phase C-full — Brilli Canvas module
- `src/js/core/34-brilli.js`: ES5 Canvas 2D module (~12KB) with state machine (`idle | attending | thinking | delivering | pleased | asleep`), three sizes (`hero | inline | pin`), reduced-motion fallback, `document.visibilitychange` pause, multi-instance safe.
- Three selectable forms: **Celestial Orb** (default, gold sphere with bloom + inner sparks), **Aura/Field** (pulsing concentric rings), **Classic BLAKE** (delegates to legacy WebGL blob).
- Mounted on chat hero (`#brilliHero`) alongside the existing blob; CSS `html[data-brilli-form]` swaps which one renders.
- Sidebar status dot (`#sidebarBrilliDot`) — pin-size Brilli, flashes `pleased` on automation completion (wired in `markAutomationDone`).
- `setBlobState` now drives both the legacy blob AND Brilli; existing call sites get Brilli reactivity for free.
- `localStorage.roweos_brilli_form` persists choice; early-inline script applies `data-brilli-form` attribute pre-paint to avoid blob/orb flash.

### Selectable forms in Settings
- Settings → Appearance → "Brilli Form" row opens an inline picker with live mini-Brilli previews per form.
- `Brilli.setActiveForm(form)` re-mounts every active instance and dispatches `brilli:form-changed` so other surfaces (Settings labels, Brilli previews, future portfolio embeds) can react.

### v34 scaffolds (feature-flagged, inactive)
- `src/js/core/35-sync-v5.js`: continuous timestamp-based sync skeleton per `docs/brilliance/16-sync-v5.md`. Universal `Synced<T>` envelope, `Collection.read/list/write/delete/subscribe`, last-write-wins by `_modifiedAt` (ties → `_clientId`), client-side UUID, read-shadow `onSnapshot` listener. Gated by `localStorage.roweos_sync_v5_enabled === 'true'`. **Does not write to Firestore yet.** v34 dual-write phase activates writes after read-shadow zero-discrepancy period.
- `src/js/core/36-evolve.js` + `src/html/shared/31-evolve.html`: Evolve scaffold per `docs/brilliance/14-evolve.md`. `EvolveProfile` state, `generateEvolveSystemPrompt(profile)` (Translator pattern), `renderPulseDashboard(host)` placeholder. Gated by `localStorage.roweos_evolve_enabled === 'true'`. Hidden from sidebar nav until v33.5 Sprint 4.

### Notes
- CSS cleanup retry (78 KB of `.focus-2-*` selectors) deferred to v34 with proper postcss tooling — the regex-based sweep in v33.0 ate critical rules.

## v33.0 — Welcome to Brilliance (2026-04-29)

The "Welcome to Brilliance" Release. RoweOS becomes Brilliance at every user-facing surface; the engine is unchanged. Three pillars:

### Brand swap (Phase D, complete)
- Browser tab `<title>`: Brilliance — Intelligence OS
- PWA install name: Brilliance
- Splash screen: "Welcome to Brilliance" with the new Celestial Orb (Brilli, primary direction)
- Onboarding flow: every screen reads Brilliance ("Install Brilliance as an App", "How will you use Brilliance?", "Start Using Brilliance")
- Settings: "Brilliance AI" smart routing section, "Delete Brilliance Account"
- Helper agent renamed: "Brilliance Helper" with updated system prompt
- Email templates (server + client): Welcome, Founder, Plans, Feedback all Brilliance-branded
- PDF/DOC/XLSX/PPT/HTML exports: filename + watermark "Brilliance"
- Push notifications: "Brilliance Reminder" / "Brilliance" titles
- Marketing pages (info, purchase, newsletter, social, portfolio, terms, privacy): Brilliance throughout
- Legal preamble: "Brilliance (formerly RoweOS), a product of The Rowe Collection, LLC"

### Welcome experience (Phase E)
- One-time welcome modal fires on first launch after v33.0 deploy
- Variant B copy (confident-terse): "Same platform. Same memory. Same work. New name."
- Celestial Orb at hero scale, gold gradient wordmark, single Continue CTA
- Persists flag to localStorage `brilliance_welcomed_v33` AND Firestore `profile/welcomed_v33`
- ESC + click-outside dismiss
- Existing users only — new users (account created after v33.0) skip welcome

### Cleanup (Phase B)
- Focus/Signal feature retirement: `~5,800 lines` of dead code removed (HTML view, JS module, label maps, sidebar refs, dead branches). `showView('signal') → pulse` redirect preserved for back-compat URL bookmarks.
- `autoTrimDataForSync()` deleted (-121 lines, dead since v22.32)
- 9 orphaned HTML pages removed (login.html, social2/3, executive-summary, overview, demos, blake-studio, export-blake-bg) + dead `api/session.js`
- 38 unused images deleted (~14 MB; 9 desktop, 29 mobile)
- 53 shipped specs+plans archived to `docs/superpowers/{specs,plans}/archive/`
- Backup files + corrupted ZIP fragments + obsolete verify.sh removed (~34 MB)

### Internal preserved
Code-internal stays RoweOS by design (per Option A confirmed 2026-04-29): all `roweos_*` localStorage keys, Firebase project paths, JS function names (resolveRoweOSAI, openRoweOSLibraryPicker, toggleRoweOSMode, etc.), CSS class names, repo name, build paths. Engine is RoweOS; product is Brilliance. By RoweOS.

### Known follow-ups (v33.x / v34)
- Phase C-full: Canvas 2D Brilli module replacing chat blob landing + thinking indicator + sidebar status dot (per `docs/brilliance/05-brilli-animation.md`)
- Phase B CSS sweep: 78KB of `.focus-2-*` selectors targeting removed DOM elements (inert, deferred to v34 with proper postcss tooling — initial regex sweep ate critical .hidden rules and was rolled back)
- Selectable Brilli forms in Settings (Aura/Field as v33.x option)
- Sync v5 migration (per `docs/brilliance/16-sync-v5.md`)
- Evolve feature ship (per `docs/brilliance/14-evolve.md`)

## v31.20 (2026-04-26)
- **Root-cause fix for the 2/9 chat resurrection bug.** Admin Purge wrote `{ data: '[]' }` to `conversations/current` but the pull reads `convCurrent.messages`, not `convCurrent.data`. The old `messages` array was never overwritten, so the next cloud pull resurrected the old chats. Now writes `{ messages: [] }` and clears in-memory `currentConversation` immediately. Pull also honors empty cloud arrays.
- Image gen in chat: shows friendly model names ("Imagen 4" not "imagen3", "GPT Image 2", "Nano Banana 3.0 Pro").
- Image renders inline via `msg.imageUrl` (no more raw `<img src="data:..."` text in chat). renderConversation auto-injects the actual `<img>` tag.
- Send button + blob state always reset on chat-image-gen completion (no more frozen "sending" state).
- Image-gen path doesn't double-push the user message when called from `sendFollowup`.

## v31.19 (2026-04-26)
- People Pipeline now shows a brand-mismatch hint when current brand has 0 clients but other brands do (Dashboard counts are global, Pipeline is brand-scoped — explains the "9 clients vs 0 in pipeline" mystery).
- `/api/resend-welcome` now writes to Firestore `email_log` after a successful Resend send. Previously only `/api/send-template-email` logged sends, so welcome emails never showed up in the Campaigns dashboard.
- Admin composer warns when server's `data.logged === false` (env vars missing) and falls back to client-side email_log write so the dashboard stays accurate.

## v31.18 (2026-04-26)
- Per-conversation Delete button in History (Identity → History view). Writes tombstone, removes from local arrays, deletes from Firestore subcollection.
- Sync inventory and History both filter by tombstones. Old chats no longer ghost the UI after a purge.
- One-shot scrub on startup prunes tombstoned chats from `roweos_agentCommands` and `roweos_life_agentCommands` automatically.

## v31.17 (2026-04-26)
- Smart cross-provider image routing in BrandAI/LifeAI chat. Detects "create/generate/draw an image of X" prompts via regex (`IMAGE_INTENT_RE`) and routes to the user's preferred image provider — Nano Banana 3.0 Pro, Imagen 4, or GPT Image 2. First time triggered, shows a one-tap picker; preference stored in `roweos_image_provider_pref`. Generated image inserted as inline assistant turn (NO Studio redirect) and pushed into Studio Gallery.
- Admin → Configs UI toggle for AI awareness (no console required).
- Admin → Configs dropdown for image generator preference.

## v31.16 (2026-04-26)
- Image Chat per-message actions: Save to Library, Save to Folio, Use as Reference, Download, Delete on every assistant image bubble.
- Admin → Configs → "Conversation History Purge" panel with Preview Counts + Purge All Conversations buttons. Tombstones every chat ID, deletes from Firestore subcollection, clears local state — admin-only.
- Admin AI awareness: when admin sets `localStorage.roweos_admin_ai_awareness = 'true'`, BrandAI/LifeAI chat injects a snapshot of admin Firestore (users, signups, emails, clicks, access keys, API key pool) into the system prompt. Cached 60s. Answers like "How many signups this week?" now use real numbers.

## v31.15 (2026-04-26)
- Brand reorder now refreshes the sidebar logo (initBrandLogo runs on every onBrandChange).
- Curated CHANGELOG.md.

## v31.13 (2026-04-26)
- Chat resurrection bug fixed. Cleared BrandAI/LifeAI conversations now write deletion tombstones to `roweos_deleted_chat_ids` and delete from the Firestore `/chats` subcollection. Cloud pull filters tombstoned ids out of both subcollection and blob fallback paths. Tombstones sync via `profile/deletedChatIds`.

## v31.12 (2026-04-26)
- Studio Gallery aggregates videos alongside images. Filter pills (All / Images / Videos) with per-type counts. Video tiles show preview frame + play overlay; click to play in fullscreen modal.

## v31.11 (2026-04-26)
- CRITICAL fix: image generation now actually shows images.
  - In-memory cache (`window._studioGalleryMem`) is the source of truth for `roweos_auto_lab_images`. Survives the localStorage→IndexedDB offload that previously made `localStorage.getItem` return null synchronously.
  - All readers (Studio Gallery, Image Chat thread rehydration, Image Lab gallery strip, Quick Generate gallery, automation pipeline) now use `readStudioGallery()`.
  - All writers (Quick Generate, Image Chat, Pipeline image step, Visual Assets delete, scheduled image automation, gallery delete) now use `persistStudioGallery()` which writes to memory + IDB-direct + localStorage + Firebase atomically.
- GPT Image 2 routed to OpenAI's `/v1/images/generations` (or `/v1/images/edits` with reference images via multipart). Both Quick Generate and Image Chat call paths supported. Previously the dropdown selection silently fell through to Nano Banana under the wrong model id.
- Inline "Just Generated" preview card directly below the Quick Generate input.
- Cross-device sync: `library/studio_gallery` is now pulled in `loadFromFirebaseV2`, merged by id with the local cache, and visible gallery surfaces re-render after pull.

## v31.10 (2026-04-26)
- Studio Gallery sub-tab.
- Sidebar overlap fix on lightbox.
- Library folder render fix.
- iPad layout cleanup.

## v31.9 (2026-04-25)
- Image generation dataUrl validation; Visual Assets lightbox portaling.

## v31.8 (2026-04-25)
- One-time migration: legacy `roweos_brand_library_<idx>` keys promoted to canonical `fileLibrary` + Firebase.

## v31.7 (2026-04-25)
- CRITICAL: brand library now writes through to Firebase (was localStorage-only). Fixed iPad data loss.

## v31.6 (2026-04-25)
- API key aliasing: nanobanana / imagen / gemini fall back to the Google key.

## v31.5 (2026-04-25)
- Nano Banana 3.0 Pro and GPT Image 2 added to image dropdowns.
- Video Lab reference uploads (Library + Inventory).
