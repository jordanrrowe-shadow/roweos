# Fresh-Restore Boot Hang / 20GB Memory — Implementation Plan (v34.121)

**Goal:** Make RoweOS boot under a full cloud restore (no local cache) without ballooning to 20GB / wedging the main thread.

**Root cause (verified by 3 parallel analysis agents):** A fresh PWA re-add wiped local storage, forcing a full cloud restore. The dominant cost is the **Bloom thumbnail fetch storm** in `loadFromFirebaseV2` — on a fresh restore `localIds` is empty, so EVERY bloom item across EVERY scope fires a simultaneous `fetch()` of its Firebase Storage thumbnail (and it downloads hundreds but keeps only 15/scope, the cap being checked *inside* the async callback). This is the 4.73GB "Brilliance Networking" process and a major slice of the 20GB tab. Secondary: the studio gallery in-memory mirror is uncapped on restore (the write path caps at 20). The user's resident data is tiny (`agentCommands` 0.02MB, all tracked caches ~3MB earlier), so this is a TRANSIENT download/network problem, not resident base64. v34.120 is NOT implicated (confirmed; reverting would worsen churn).

**Approach:** Two surgical, zero/low-data-risk fixes. Do NOT resequence the 43-way Promise.all (high reindex risk) and do NOT strip agentCommands (tiny for this user, needs async lazy-load).

**Tech stack:** vanilla ES5 in `src/js/core/*`; build via `bash src/build.sh`; audit `scripts/pre-deploy-audit.sh`; deploy `./deploy.sh`.

---

## Fix 1 — Cap the studio gallery in-memory mirror on restore

**File:** `src/js/core/22-firebase-sync.js:10482`

The full set still goes to IDB (line 10490); only the `_studioGalleryMem` mirror is capped to the newest 20, matching `persistStudioGallery` (`18-social.js`) so restore is consistent with steady-state. Readers use the mirror. **Data risk: none.**

- [ ] Change `window._studioGalleryMem = merged;` to keep only the newest 20 for the mirror while passing the FULL `merged` to `idbPutIfChanged`.

## Fix 2 — Throttle + defer the Bloom thumbnail downloads (the storm)

**File:** `src/js/core/22-firebase-sync.js` — bloom restore block (~11755-11801) + a new top-level helper `_drainBloomThumbnailQueue`.

Replace the inline per-item `fetch()` launches with: (a) collect items to fetch, pre-capped per scope to `BLOOM_LIBRARY_MAX - existing` (stop downloading hundreds to keep 15); (b) drain the queue **deferred ~6s after boot** with **max 2 concurrent** fetches. Read-only thumbnail downloads, same storage writes under the same cap. **Data risk: none** — only changes *when/how fast* thumbnails load.

- [ ] Add top-level `var _bloomThumbActive = 0; function _drainBloomThumbnailQueue(queue){...}` (bounded concurrency = 2).
- [ ] Rewrite the bloom restore loop to collect a pre-capped `_bloomToFetch` queue and `setTimeout(drain, 6000)` instead of firing `fetch()` inline.

## Version + ship
- [ ] Bump v34.120 → v34.121 in all 8 locations + CLAUDE.md + CHANGELOG.
- [ ] `bash scripts/pre-deploy-audit.sh` (version consistency, build, 278 tests, ES5).
- [ ] Confirm new symbols present in built dist.
- [ ] `./deploy.sh`, then verify live serves v34.121.

## Runtime verification (after deploy + PWA update)
- The `[Storage]`/network storm subsides; the app boots past the restore screen.
- "Brilliance Networking" process no longer multi-GB at boot.
- Tab settles well under prior levels.
