# v33.0 Cleanup Targets

**Status:** Plan, draft v0.1
**Source:** Code-audit agent report, 2026-04-27
**Scope:** ~6,100 lines of source removed, ~48 MB repo+image bloat reclaimed, 9 dead pages, 1 dead API endpoint, 25 shipped planning specs archived

---

## Categories

1. Focus/Signal residue (~6,000 lines)
2. Backup/reference files (~34 MB)
3. Confirmed dead functions (`autoTrimDataForSync`)
4. Documentation drift (25 shipped specs)
5. Unused images (~14 MB)
6. Orphaned HTML pages + matching API endpoints
7. Stale comments
8. Stale TODO entries in MEMORY.md

## Risk levels

- **safe-delete** — zero callers verified, no migration risk
- **deprecate-first** — has callers but they're for retired features OR has user-data implications
- **investigate-before-touching** — unclear without deeper analysis

---

## 1. Focus/Signal residue (highest impact)

Focus/Signal was retired in v28.8. `showView('signal')` redirects to Pulse (per CLAUDE.md), but the underlying view, CSS, JS, and references remain.

**Per the v33.0 master plan success criteria #4: "Focus/Signal has zero remaining code paths. `showView('signal')` redirect kept (one line) for back-compat URL bookmarks."** This phase delivers that.

### Files to delete or trim

| Path | Action | Lines | Risk |
|---|---|---|---|
| `src/html/life/05-focus.html` | Delete file | 787 | safe-delete |
| `src/js/core/15-focus.js` | Delete file | 4,903 | safe-delete |
| `src/css/core/01-base.css` `.focus-2-*` selectors (~519) | Strip selectors; preserve `#signalView` redirect line for back-compat URL bookmarks | ~hundreds | safe-delete |
| `src/html/core/03-views-batch2.html:74` (Focus launch tile) | Delete `<div class="launch-option" onclick="launchToView('signal')">` | ~10 | safe-delete |
| `src/html/core/03-views-batch2.html:276` (Focus mobile menu) | Delete button | ~10 | safe-delete |
| `src/js/core/27-launch-brandai.js:106` (`launchOptionFocusDesc`) | Delete | ~3 | safe-delete |
| `src/js/core/11-agents.js:1159` (`{ id: 'signal', label: 'Focus' }`) | Delete sidebar item | 1 | safe-delete |
| `src/js/core/11-agents.js:1312` (DEFAULT_CUSTOM_SIDEBAR includes `'signal'`) | Remove from default | 1 | deprecate-first (existing user prefs may have it) |
| `src/js/core/11-agents.js:1878,2651` (allViews includes `'signal'`) | Remove | 2 | safe-delete |
| `src/js/core/11-agents.js:2858+2861` | KEEP `if (view === 'signal') view = 'pulse';` (1 line for back-compat); DELETE the dead `if (view === 'signal') initFocus2()` branch after the redirect | ~10 | safe-delete dead branch |
| `src/js/core/11-agents.js:433,1975` (`signal: 'Focus'` label maps) | Delete | 2 | safe-delete |
| `src/js/core/14-calendar.js:3897` and `27-launch-brandai.js:55,2586,2683` (`showView('pulse'); // signal→pulse` redirects) | Audit each — some are intentional, some are residue | ~4 sites | investigate-before-touching |
| `src/js/core/19-journal.js:3095` (queries `#signalView .focus-card-collapsible`) | Delete | 1 | safe-delete |
| `src/js/core/21-sidebar.js:183,200` (comment-only residue) | Delete `// v28.8: removed #signalView` comments | 2 comments | safe-delete |
| `src/js/core/17-automations.js:4922` (`['signal','Focus']` label map) | Delete | 1 | safe-delete |
| `src/js/core/22a-tombstones.js:961-996` (`FOCUS_RETIRE_DATE`, `FOCUS_LEGACY_TITLES`, `_focusGoalPredicate`, `_focusTodoPredicate` — explicitly unused per agent) | Delete block | ~36 | safe-delete |
| `src/js/core/25-documents-lifeai.js:8935,10019` (`// Focus retired` comments) | Delete | 2 | safe-delete |

### Special handling: `.focus-card-collapsible` button class
The class is also used by **`html/life/17-journal.html:16`** (one survivor outside Focus). Either:
- (A) Migrate the journal button to a different class name and delete the entire `.focus-*` CSS family
- (B) Keep `.focus-card-collapsible` as a standalone class (rename optional) and delete only the rest

Recommend (A) — clean break, journal gets its own class name.

### Verification after Focus cleanup
```bash
grep -rn "focus-2\|signalView\|initFocus2\|launchOptionFocus\|focus-retired" \
  src/ RoweOS/dist/ \
  --include="*.html" --include="*.js" --include="*.css"
# Expected: 0 hits except the one preserved redirect line in 11-agents.js
```

## 2. Backup / reference / corrupted files

| Path | Action | Size | Risk |
|---|---|---|---|
| `RoweOS/dist/info.OLD.backup.html` | Delete | 2.4 MB | safe-delete |
| `RoweOS/dist/index.reference.html` | Delete (reference is ~50K+ lines stale; verify.sh always reports FAIL against it) | 8.8 MB | deprecate-first (decide on verify.sh first) |
| `src/verify.sh` | Delete OR rewrite to assert structural invariants instead of byte-diff | 25 lines | safe-delete (after deciding) |
| `/Users/jordanrowe/Developer/roweOS/zi1mJybO` | Delete (corrupted ZIP fragment from Mar 26) | 17.5 MB | safe-delete |
| `/Users/jordanrowe/Developer/roweOS/zia5oCJS` | Delete (corrupted ZIP fragment from Mar 26) | 5.8 MB | safe-delete |

**Total disk reclaimed:** ~34 MB.

## 3. Confirmed dead functions

| Symbol | File | Action | Notes |
|---|---|---|---|
| `autoTrimDataForSync()` | `src/js/core/22-firebase-sync.js:1396` | Delete (~100 lines) | Confirmed dead per `gotchas.md` (v22.32). Single definition, zero callers. Deliberately preserved as warning - no longer needed. |

## 4. Documentation drift — archive shipped specs

Move (not delete) to `docs/superpowers/specs/archive/` and `docs/superpowers/plans/archive/`:

### Specs (confirmed shipped)
- `2026-03-19-bloom-launch-popup-spec.md`
- `2026-03-19-calendar-overhaul-spec.md`
- `2026-03-19-reminders-overhaul-spec.md`
- `2026-03-19-universal-search-spec.md`
- `2026-03-19-v3.1-sync-fix-and-feedback-spec.md`
- `2026-03-22-social-hub-bugfix-batch-design.md`
- `2026-03-22-social-hub-phase-2a-design.md`, `2b-engage`, `2b2-create`, `2b3-blog`, `2c-analytics`
- `2026-03-23-focus-view-redesign-design.md` (Focus retired entirely now)
- `2026-03-23-ui-redesign-navigation-design.md` (Navigation v26.0)
- `2026-03-25-blake-symbiote-design.md`
- `2026-03-25-lifeai-sync-rebuild-design.md`
- `2026-03-26-advanced-web-search-design.md`
- `2026-03-27-brand-profile-save-fix-design.md`
- `2026-03-27-research-view-core-design.md` + `polish-design.md`
- `2026-03-27-v4-firebase-sync-overhaul-design.md`
- `2026-03-28-brand-sync-id-based-selection-design.md`
- `2026-03-30-modular-restructure-design.md`
- `2026-04-16-pulse-merge-scribe-studio-design.md`
- `2026-04-20-pulse-goals-per-doc-sync-design.md`
- `2026-04-23-admin-email-templates-design.md`
- `2026-04-27-tombstone-and-sync-overhaul-design.md`

### Specs to KEEP active (do NOT archive)
- `2026-04-16-phase1-ai-ops-platform-design.md` — Cloud Pub/Sub Scheduler, deferred
- `2026-04-27-brilliance-rebrand-launch-strategy.md` — current v33 work

### Specs requiring per-file verification before archiving
- `2026-03-22-scavenger-pipeline-and-automation-fix-design.md`
- `2026-03-23-automations-mail-bugfix-design.md`
- `2026-03-24-customization-mode-design.md`
- `2026-03-24-pill-unification-customization-design.md`
- `2026-03-25-lifeai-campaigns-design.md`
- `2026-03-26-v26.7-bugfixes-design.md`
- `2026-03-27-landing-page-early-access-design.md`
- `2026-04-16-google-for-startups-promo-design.md`
- `2026-04-17-mobile-ui-regression-fix-design.md`
- `2026-04-17-pulse-scribe-fixes-design.md`

### Plans (1:1 with specs above) — same archive treatment
Plus:
- `2026-03-17-write-through-sync-ui-fixes.md` (predates spec system)
- `2026-04-20-mega-session-master-plan.md` (meta-plan for shipped session)
- `2026-04-25-info-signup-and-gpt-5.5-upgrade.md` (live)
- `2026-04-27-v32.0-tombstone-overhaul-plan.md` (v32.0 shipped)

### Other docs

| Path | Action |
|---|---|
| `demo-scripts.md` | deprecate-first — old demo prompts, not referenced |
| `roweos-one-pager.html` | investigate-before-touching — only referenced in launch strategy spec |
| `ROWEOS_BRAND_GUIDE.md` (46 KB, Mar 22) | Supersede with new `docs/brilliance/` set; delete after v33.0 ships |

## 5. Unused images (~14 MB)

### Brilliance asset library (deprecate-first, not safe-delete)
The agent flagged 11 unused images in `RoweOS/dist/images/brilliance/`. **Most of these are intentional v33.0 asset variants** (transparent/black/white background combinations) that will be used in upcoming surfaces (welcome modal, email templates, OG cards, app icons). DO NOT DELETE without checking `docs/brilliance/` references first.

Currently used by `brilliance.html`:
- `monogram-circle.png`, `monogram.png`, `wordmark-os.png`

Currently planned for use (per docs):
- `monogram-circle-transparent.png` — for surfaces with custom backgrounds
- `monogram-circle-white.png` — for light-mode contexts
- `monogram-circle-black.png` — for app icon contexts
- `wordmark-os-transparent.png` — for hero overlays
- `wordmark-os-black.png` — for legal pages, footers
- `b-mark-transparent.png` — for inline brand mark
- `b-mark-black.png` — for inline brand mark on light bg
- `app-icon.png`, `app-icon-black.png` — PWA icons (post-overhaul)
- `brilli-firefly-reference.jpg` — design reference; KEEP

**Decision: keep all brilliance assets.** This is asset library, not orphaned files.

### Desktop images (~4.7 MB, safe-delete)
Verified zero references:
- `images/desktop/API_light.png` (710 KB)
- `images/desktop/guardrails_lifeAI.png` (1.2 MB)
- `images/desktop/lifeAI_survey.png` (866 KB)
- `images/desktop/lifeai-helix-light.png` (74 KB) — **deprecate-first**, helix is being subordinated per `01-brilli-entity.md` but may still be referenced in code paths until Brilli ships
- `images/desktop/load_brandAI.png` (360 KB)
- `images/desktop/load_lifeAI.png` (381 KB)
- `images/desktop/long_chat_lifeAI.png` (159 KB)
- `images/desktop/onbarding_light.png` (540 KB) — typo
- `images/desktop/system_light_brandAI.png` (524 KB)

### Mobile images (~50+ MB, safe-delete)
29 of 30 mobile screenshots in `RoweOS/dist/images/mobile/` are unused. Only `IMG_6165.PNG` is referenced (in `social.html:945`). 

**Decision: delete all 29 unused IMG_*.PNG files.** Move the one used image to a non-numerically-named path so future cleanup audits can find it more easily.

## 6. Orphaned HTML pages + matching API endpoints

| File | Linked from | Action | Risk |
|---|---|---|---|
| `social2.html` | (no inbound) | Older content gallery (Mar 25), superseded by social.html. Delete. | safe-delete |
| `social3.html` | (no inbound) | Google for Startups gallery (Apr 16), single-event content. Archive or delete. | safe-delete |
| `demos.html` | (no inbound) | "Feature Demos" page (Mar 22), orphaned. Delete + remove vercel route. | safe-delete |
| `executive-summary.html` | (no inbound) | Mar 22 deck. Superseded by portfolio.html. Delete. | safe-delete |
| `overview.html` | (no inbound) | Apr 23 update. Superseded by info.html. Delete. | safe-delete |
| `blake-studio.html` | (no inbound, internal) | noindex/nofollow. Delete. | deprecate-first |
| `export-blake-bg.html` | (no inbound) | noindex utility. Delete. | safe-delete |
| `login.html` | (no inbound) | Pre-Firebase legacy login. Auth happens in index.html now. Delete. | safe-delete |
| **`api/session.js`** | `login.html` only | Dead with login.html. Delete. | safe-delete |

After deletion, also update `RoweOS/dist/vercel.json` to remove the corresponding routes.

## 7. Stale comments

The `// v28.8: removed #signalView` comments in CSS (8 sites) and JS (~6 sites) reference things already removed. Delete the comments.

## 8. MEMORY.md TODO entries to update

Per agent audit, these "next session priorities" can be marked resolved:

| Item | Status |
|---|---|
| Fix `email_log` not recording sent emails | RESOLVED in v31.19 (verify in Firestore Console) |
| Fix `onboarding_responses` not showing | RESOLVED in v31.19 (`25-admin-emails.js:191` uses `db.collectionGroup('responses')`) |
| Fix server email templates (logo + styling) | RESOLVED in v31.19 (`emailWrap()` uses `<img src="https://roweos.com/logo.png">`) |
| Add Campaigns/Responses dashboard | PARTIAL (`25-admin-campaigns.js` exists, verify nav wiring) |
| Onboarding redesign | OPEN — keep |
| People/Clients data cleanup | OPEN — keep |
| Cloud Pub/Sub Scheduler | OPEN — deferred per master plan |

After cleanup, update MEMORY.md "Next Session Priorities" to reflect the resolved items.

Also update CLAUDE.md technical-debt #5 — `ROWEOS_VERSION` duplicate declaration is **stale**. Modular split has only ONE declaration in `src/js/core/09-state.js:5`. The `10-sync.js:2530` hit is a regex pattern, not a declaration. Remove from troubleshooting.md.

## 9. Build/deploy script simplification

`src/build.sh --minify` and `--restore` flags have been no-ops since v30.4 ("Skipping minification disabled in v30.4"). `deploy.sh` still calls them but they only `cp` the file. **Simplify `deploy.sh` by removing the minify steps entirely.** Saves no bytes but reduces confusion.

## Estimated impact

| Category | Lines/Files | Disk |
|---|---|---|
| Focus/Signal residue | ~6,000 lines + 519 CSS selectors across 11 files | n/a |
| Backup/reference files | 5 files | ~34 MB |
| `autoTrimDataForSync` + related | ~100 lines | n/a |
| Doc archive (planning files) | ~25 files moved | n/a |
| Unused desktop images | 9 files | ~4.7 MB |
| Unused mobile images | 29 files | ~50+ MB |
| Marketing surfaces (8 pages + 1 endpoint) | 9 files | ~400 KB |
| Stale comments | ~14 sites | trivial |

**Headline numbers:**
- ~6,100 lines of source code removed
- ~89 MB disk reclaimed in repo
- 38 image files removed
- 9 dead/orphaned HTML pages removed
- 1 dead API endpoint removed
- 25 shipped planning specs archived
- Build script simplified

## Phase B sequencing (per master plan)

1. **B1**: Focus/Signal cleanup (highest impact, isolated to retired feature) — 1 deploy
2. **B2**: Backup files + corrupted ZIP fragments + verify.sh decision — 1 deploy
3. **B3**: Documentation archive move (no code impact) — 1 commit, no deploy
4. **B4**: Unused images sweep (mobile + desktop) — 1 deploy
5. **B5**: Orphaned HTML + dead API endpoint + vercel.json route cleanup — 1 deploy
6. **B6**: `autoTrimDataForSync` deletion + comment cleanup + MEMORY.md updates — 1 commit

Six small commits, three to four deploys, one rollback target between each.

## Verification after Phase B

```bash
# Confirm no Focus/Signal residue
grep -rn "focus-2\|signalView\|initFocus2" src/ RoweOS/dist/ \
  --include="*.html" --include="*.js" --include="*.css" \
  | grep -v "// keep" | grep -v "view = 'pulse'"

# Confirm autoTrimDataForSync gone
grep -rn "autoTrimDataForSync" src/ RoweOS/dist/

# Confirm no orphan HTML pages remain in dist
ls RoweOS/dist/*.html | sort
# Expected: index, brilliance, info, portfolio, purchase, privacy, terms, newsletter, social, social-callback, blake (and any new ones added in v33.0)

# Confirm image sweep
find RoweOS/dist/images/mobile -name "IMG_*.PNG" | wc -l
# Expected: 1 (only IMG_6165.PNG remaining)
find RoweOS/dist/images/desktop -name "*.png" | wc -l
# Compare to before; should drop by 9
```

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Focus/Signal cleanup breaks Pulse merge functionality | Medium | Pulse merged in v28.8, fully self-contained. Verify by running through the Pulse view post-cleanup. |
| `lifeai-helix-light.png` deleted before Brilli replaces it | High | Phase B4 (image sweep) runs AFTER Phase C (Brilli production). Don't delete helix until Brilli is shipped. |
| Some `// signal→pulse` redirects ARE intentional and shouldn't be removed | Medium | Audit each of the 4 sites individually (`14-calendar.js:3897`, `27-launch-brandai.js:55,2586,2683`) before removing. |
| Login.html was the only auth path for some legacy users | Low | Verified: index.html handles all auth via Firebase. login.html is pre-Firebase residue. |
| ROWEOS_BRAND_GUIDE.md deletion loses brand decisions | Medium | Migrate any non-obvious decisions to `docs/brilliance/` set first. |
| `runOp()` deletion (one of the dual paths flagged) | High | DO NOT DELETE. Agent confirmed `runOp()` is reached via Studio Regenerate button. Keep. |

## Open questions for Jordan

1. **`verify.sh`**: keep (regenerate the reference) or delete? Recommend **delete** + later add a structural invariant check (e.g., "index.html must contain at least N `<script>` tags") if needed.
2. **`ROWEOS_BRAND_GUIDE.md`**: migrate decisions to `docs/brilliance/` before deletion, or just supersede?
3. **`demos.html`**: orphaned but pretty content. Salvage into a section of `/info` or delete?
4. **The 29 unused mobile screenshots**: any chance some are meant for upcoming features? Recommend bulk delete; re-shoot if needed.
