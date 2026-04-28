# In-App Rename — Execution Plan

**Status:** Plan, draft v0.1
**Source:** Surface inventory by code-explorer agent, 2026-04-27
**Scope:** ~600-650 user-facing string occurrences across ~30 files

---

## Principle

**Code internal stays RoweOS. User-facing strings become Brilliance.** The decision rationale is in `00-v33-master-plan.md` and `~/.claude/projects/-Users-jordanrowe/memory/project_brilliance_app_rename.md`. This document is the *how* — the file-by-file map and the order of operations.

## Lockup discipline (the four flavors)

| Context | Lockup form |
|---|---|
| In-product UI labels (sidebar, settings, modals, toasts) | **Brilliance** |
| AI feature labels ("RoweOS AI" formerly) | **Brilliance AI** |
| Marketing surfaces (hero, headers) | **Brilliance by RoweOS** |
| Long-form (legal, footers, press) | **Brilliance, Intelligence OS by RoweOS** |
| Email from-name display | **Brilliance** (address `roweos@therowecollection.com` unchanged) |
| Push notification title | **Brilliance** (or **Brilliance Reminder** for reminders) |
| Generated downloads/PDFs/exports | **Brilliance** prefix; format `Brilliance-Export-YYYYMMDD.pdf` etc. |
| Window `<title>` tag | **Brilliance** alone, OR `Brilliance - <subpage>` (e.g., `Brilliance - Sign In`) |
| OG / Twitter card metadata | **Brilliance, Intelligence OS by RoweOS** for og:title; tagline for description |

## Counts by category

| Category | Files | Strings |
|---|---|---|
| HTML title / meta / og tags | 12 | ~35 |
| manifest.json | 1 | 3 |
| Marketing pages (info, overview, demos) | 3 | ~65 |
| Legal pages (terms, privacy) | 2 | ~75 |
| Onboarding flow | 2 src files | ~35 |
| Settings page | 1 | 6 |
| Modal/dialog/spotlight | 3 | ~12 |
| AI model labels ("RoweOS AI") | 5 | ~20 |
| RoweOS Helper agent | 1 | ~10 |
| Toast notifications | 3 | 4 |
| Push notifications | 3 | 6 |
| Install/PWA prompts | 1 | 8 |
| Document title (runtime JS) | 1 | 1 |
| Feature tour tooltips | 2 | 4 |
| Export filenames / PDF footers | 3 | ~20 |
| Email templates (server) | 3 api files | ~60 |
| Email templates (client) | 2 | ~45 |
| Content Studio (social.html) | 1 | ~60 |
| Executive summary (portfolio.html) | 1 | ~100 |
| Other (login mailto, social-callback) | 2 | 7 |
| **Total** | **~30 files** | **~600-650** |

## What stays untouched (DO NOT rename, repeat: do not rename)

- `roweos_*` and `roweos-*` localStorage keys (renaming = data loss for every existing user)
- Firebase project ID `roweos`, collection paths (`roweos_users/`, `roweos_v4/`, etc.)
- Domains: `roweos.com`, `roweos.vercel.app`, `roweos.firebaseapp.com`
- Email address `roweos@therowecollection.com` (display name changes, address stays)
- CSS class names containing `roweos-` (selector binding ripple)
- JS function names (`resolveRoweOSAI`, `openRoweOSLibraryPicker`, etc.)
- `window.roweosAPI` global
- HTML id attributes
- `ROWEOS_VERSION` constant *name* (the value string IS user-facing, but the variable is internal)
- `ROWEOS_DEBUG` flag
- `<option value="roweos">...` value attributes (only display text changes)
- HTTP user-agent strings (`User-Agent: 'RoweOS-MetaFetcher/1.0'`)
- Vercel Blob URL prefixes (`'roweos-social-'`)
- Repo name (`roweOS`)
- Build output path (`RoweOS/dist/`)
- Settings folder path used by GDrive sync (rename considered separately — see "Storage paths" below)

## Phased execution order

### Phase D1 — Core titles + manifest + identity strings (~50 strings, 4 files, lowest risk, highest visibility)
- `RoweOS/dist/manifest.json` — name, short_name, description
- `src/html/core/00-head.html` — title, meta, og, twitter, apple-mobile-web-app-title
- `src/html/core/02-shell-batch1.html` — splash/boot screen "Welcome to RoweOS." × 2 + access key text + migration toast
- `src/js/core/24-lifeai-identity.js` line 3686 — runtime `document.title` setter

**Verification after D1:**
- Browser tab title reads "Brilliance"
- PWA reinstall shows "Brilliance" name
- iOS home screen icon name "Brilliance"
- Splash screen reads "Welcome to Brilliance"

### Phase D2 — Onboarding + settings (~45 strings, 2 files)
- `src/html/core/04-views-batch3.html` — full onboarding flow (~30 strings: install prompts, "How will you use Brilliance?", "What Brilliance Can Do", "Start Using Brilliance", etc.)
- `src/html/shared/21-settings.html` — section labels, descriptions, "Delete Brilliance Account"

**Verification after D2:**
- Run through onboarding as a new user — every screen says Brilliance
- Settings > AI section reads "Brilliance AI"
- Settings > Danger Zone reads "Delete Brilliance Account"

### Phase D3 — Modals + AI feature labels (~35 strings, 7 files)
- `src/html/shared/27-modals.html` — Spotlight prompt + keyboard shortcuts header
- `src/html/shared/01-blake.html` — model dropdown "Brilliance AI" optgroup
- `src/html/brand/02-studio.html` — model dropdown "Brilliance AI"
- `src/html/brand/09-export.html` — "Brilliance (Local)" option text
- `src/html/life/03-rhythm.html` — "Brilliance (local)" option text
- `src/js/core/13-studio.js` — model display map `'auto': 'Brilliance AI'`
- `src/js/core/24-lifeai-identity.js` — AI routing splash all "Brilliance AI" references

### Phase D4 — Toasts + push notifications + tour (~25 strings, 6 files)
- `src/js/core/12-library.js` — welcome toast
- `src/js/core/20-ui-misc.js` — export toast + AI routing UI text
- `src/js/core/27-launch-brandai.js` — landing descriptions + welcome toast + spotlight empty
- `src/js/core/23-offline.js` — install prompts (Add Brilliance to your X)
- `src/js/core/28-reminders-notifications.js` — Notification API title strings
- `src/js/core/30-automations-init.js` — feature tour tooltips
- `RoweOS/dist/sw.js` + `RoweOS/dist/api/push.js` — push notification default titles

### Phase D5 — Brilliance Helper agent + export branding (~30 strings, 3 files)
- `src/js/core/11-agents.js` — agent descriptor name/shortName/description/personality + system prompt + PDF export title/footer + ~20 export filenames `Brilliance-Export-...`
- `src/js/core/22-firebase-sync.js` — feedback export title `Brilliance Feedback`
- `src/js/core/12-library.js` — default export filename
- `src/js/core/27-launch-brandai.js` — JSON export filename

**Watch out:** The "RoweOS Helper" agent's system prompt is read by the LLM and shapes how it talks about itself. Updating both the display label AND the system prompt is required so the AI says "I'm Brilliance Helper" not "I'm RoweOS Helper" when asked.

### Phase D6 — Email templates (server-side, ~60 strings, 4 files)
- `RoweOS/dist/api/newsletter.js` — Welcome email + Founder onboarding email + subject lines + from-display
- `RoweOS/dist/api/send-template-email.js` — All admin-triggered template subjects + bodies + emailWrap header
- `RoweOS/dist/api/feedback.js` — Feedback email subject + from-display
- `RoweOS/dist/api/email-response.js` — Survey response confirmation page

**Coordination:**
- Update `_emailPreviewWrap()` in `src/js/late/00-api-bridge.js` AND server `emailWrap()` in `send-template-email.js` together — they must produce visually identical templates
- Test by sending a welcome email to a test address; verify subject + body + from-name all read "Brilliance"
- This phase resolves `project_email_system_bugs.md` item #3 (server templates missing logo + Brilliance branding) by happy coincidence — bake the logo update into the same pass

### Phase D7 — Client email templates + admin panel email composer (~45 strings, 2 files)
- `src/js/core/12-library.js` — inline HTML email body templates (lines 4755-7471)
- `src/js/late/00-api-bridge.js` — admin panel subject presets, from-display options, PDF export branding

**Watch out:** Subject line presets are visible in admin; the Welcome / Check-in / Feedback subject options should all read Brilliance.

### Phase D8 — Marketing & static pages (~225 strings, 9 files)
Parallel-safe — these are independent files.
- `RoweOS/dist/info.html` (~30 strings)
- `RoweOS/dist/overview.html` (~30 strings)
- `RoweOS/dist/demos.html` (~30 strings, including ~25 social caption template strings)
- `RoweOS/dist/purchase.html` (~10 strings)
- `RoweOS/dist/newsletter.html` (~5 strings)
- `RoweOS/dist/login.html` (~2 strings — mailto subject/body)
- `RoweOS/dist/social-callback.html` (~2 strings)
- `RoweOS/dist/social.html` (~60 strings — content studio templates)
- `RoweOS/dist/portfolio.html` (~100 strings — executive summary, very dense)

**Build order suggestion within D8:**
1. info.html (most-traffic page)
2. purchase.html (revenue path)
3. login.html (auth path)
4. portfolio.html (investor path)
5. overview, demos, newsletter, social.html, social-callback (everything else)

### Phase D9 — Legal pages (~75 strings, 2 files)
- `RoweOS/dist/terms.html`
- `RoweOS/dist/privacy.html`

**Convention for legal:** First mention of "Brilliance" gets a parenthetical "(formerly RoweOS)" so users searching with the old name still find their footing. After first mention, just "Brilliance."

Add a new sentence in the preamble of both: *"Brilliance is a product of RoweOS, a brand of The Rowe Collection, LLC."* Keeps the legal entity chain clean.

### Phase D10 — Stripe display names (no code change, dashboard only)
- Open Stripe Dashboard → Products
- Each product's display name updated to "Brilliance Founder" / "Brilliance Basic" / etc.
- API IDs / price IDs unchanged
- Receipt template tested: send a $0 test charge, verify receipt shows "Brilliance"

### Phase D11 — Storage path rename (judgment call, optional)
The settings page currently says "Mirrors Library saves to roweOS/ folder" (GDrive). Two options:
- **(A) Keep the folder name `roweOS/`** — existing users' files stay where they are. Update only the description text.
- **(B) Rename to `Brilliance/`** — clean break, but every existing user has to either move their files or accept new files going to a new folder.

Recommend **(A)** for minimal user disruption. Description text becomes "Mirrors Library saves to your roweOS/ folder (legacy folder name)." Future v34+ can migrate.

## Build/verify loop per phase

```bash
# After each phase:
cd ~/Developer/roweOS
bash src/build.sh                    # rebuild index.html
grep -c "RoweOS" RoweOS/dist/index.html  # decreasing count = progress
```

```bash
# Final verification before launch (after D1-D9):
cd ~/Developer/roweOS
grep -rn "RoweOS\|roweOS" RoweOS/dist/ \
  --include="*.html" --include="*.js" --include="*.json" \
  | grep -v "// keep" \
  | grep -v "/* keep" \
  | grep -v "roweos_" \
  | grep -v "roweOS/" \
  | grep -v "ROWEOS_VERSION" \
  | grep -v "ROWEOS_DEBUG" \
  | grep -v "roweos.com" \
  | grep -v "roweos.vercel.app" \
  | grep -v "roweos.firebaseapp.com" \
  | grep -v "roweos@therowecollection.com" \
  | grep -v "roweos-social-" \
  | grep -v "RoweOS-MetaFetcher"
```
Anything that survives this filter is a missed user-facing rename. Should reduce to zero by end of Phase D9.

## What "Brilliance AI" replaces

The "RoweOS AI" feature label appears in many places as a model-routing label. Rename map:

| Current | Replacement |
|---|---|
| `RoweOS AI` (display only) | `Brilliance AI` |
| `RoweOS AI - Smart Routing` | `Brilliance AI - Smart Routing` |
| `RoweOS AI - Unlock Smart Routing` (email subject) | `Brilliance AI - Unlock Smart Routing` |
| `'auto': 'RoweOS AI'` (model display map in 13-studio.js) | `'auto': 'Brilliance AI'` |
| `'ROWEOS AI'` (uppercase status badge) | `'BRILLIANCE AI'` |
| `<optgroup label="RoweOS AI">` | `<optgroup label="Brilliance AI">` |
| `<option value="roweos|auto|RoweOS AI">` | display label only: `Brilliance AI`; value `roweos` stays |

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Miss a user-facing string | High | Low (cosmetic) | Final grep verification after Phase D9 |
| Break a function name accidentally during rename | Low | High (broken feature) | Use `grep -n` not `replace_all`; manual review every diff before commit |
| Stripe display-name mismatch with previous receipts | Low | Low | Display name only, IDs unchanged |
| RoweOS Helper agent identity confusion (system prompt mismatched with display name) | Medium | Medium | Update display + system prompt in same diff |
| Email subject lines get filtered as different campaign by some inboxes | Low | Low | Worth knowing; first batch of post-rename emails may have lower open rate |
| Onboarding flow wording lands on a "RoweOS" before the user is welcomed to "Brilliance" | Medium | Medium | Phase D2 handles onboarding; verify by running through onboarding end-to-end as a new test user |
| Social.html caption templates have references in the live published posts on socials | High | Medium | Old social posts stay as historical artifacts; only the Studio templates are renamed for future posts |

## Rollback strategy

Per CLAUDE.md the deploy is via `./deploy.sh` which pushes to Vercel. Rollback:

```bash
# Most recent deploy is the safest rollback target.
cd ~/Developer/roweOS
git log --oneline -10                   # find last good commit
git revert <bad-commit-sha>             # revert as a new commit
./deploy.sh                             # deploy the revert
```

Or via Vercel dashboard → Deployments → previous deployment → Promote to Production.

The rename is text-only and additive (no schema changes), so rollback is fully safe — no data migration concerns.

## Estimated session count

This is realistically 4-6 working sessions:
- Session 1: Phases D1-D3 (titles, onboarding, modals, AI labels) — most visible, lowest line count
- Session 2: Phases D4-D5 (toasts, push, helper agent, exports)
- Session 3: Phases D6-D7 (email templates, both server + client)
- Session 4: Phase D8 (marketing pages — info, purchase, login, portfolio, overview, demos, social)
- Session 5: Phase D9 (legal pages)
- Session 6: D10 (Stripe), D11 (storage decision), final grep + manual smoke test

Each session ends with a deploy + verification. Six small deploys is much safer than one giant rebrand deploy.
