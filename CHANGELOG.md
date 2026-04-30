# Brilliance / RoweOS Changelog

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
