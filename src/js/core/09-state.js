
// DATA INITIALIZATION & MIGRATION - v4.8.0
// ═══════════════════════════════════════════════════════════════

var ROWEOS_VERSION = 'v35.0'; // v35.0: Performance overhaul + Opus 4.8. Bundle minification via esbuild (32% size reduction, 10.4MB->6.9MB), Scribe (Notebook) typing-lag fixes (resize-handle listener leak, autosave + word-count deferred to rAF), Object URL revocation in 3 chat-export paths, goal-modal keydown listener leak fix, on-demand CDN libs (jsPDF/xlsx/ical/Chart.js/html2canvas/docx/pptxgenjs/Three.js/TinyMCE) deferred to unblock HTML parse, Anthropic Opus 4.7 -> 4.8 migration (model ID claude-opus-4-8 in all dropdowns/registries, historical 4.7 entries preserved in pricing + display maps). See docs/superpowers/specs/2026-06-01-v35-performance-overhaul-design.md. // v34.121: Fresh-restore boot hang fix. A full cloud restore (after a PWA re-add wiped local cache) fired an UNBOUNDED simultaneous fetch() storm of every Bloom thumbnail across every scope (the multi-GB "Brilliance Networking" process) and held the entire historical studio gallery uncapped in the heap, wedging the main thread at boot (20GB + 15GB swap, stuck at the restore screen). Fix: throttle Bloom thumbnail downloads to 2 concurrent, deferred 6s past boot, pre-capped per scope to BLOOM_LIBRARY_MAX (was downloading hundreds to keep 15); cap the in-memory studio gallery mirror to 20 on restore (full set still written to IDB). v34.120 was NOT the cause (confirmed by 3 analysis agents; its helpers reduce churn). // v34.120: Root-cause fix for the 13-20GB tab memory + Notebooks typing lag. loadFromFirebaseV2 re-wrote large base64 values (studio gallery, brand/life logos, library, conversations, bloom) to localStorage on EVERY cloud pull; each blew the ~5MB quota and re-offloaded to IndexedDB, churning gigabytes of transient base64 strings + in-flight IDB transaction payloads per snapshot burst (invisible to brillianceMemoryReport, which showed only ~3MB in tracked caches). Fix: setLargeItemIfChanged()/idbPutIfChanged()/localStorageHas() in 08-foundation.js write/offload ONLY when a value changed (tiny persistent __sig comparison, never re-reads the giant value); removed the redundant auto_lab_images localStorage double-write; fixed the broken !localStorage.getItem() existence check that re-wrote offloaded >1MB logos every pull; debounced snapshot-triggered pulls (scheduleCloudPull, 1.2s) so multi-device/tab bursts coalesce into one pull. Notebooks typing lag was downstream of system swap thrashing under the memory pressure. // v34.119: More memory leak fixes + diagnostics. Found additional in-memory caches holding heavy data: (1) _mailOutboxCache / _mailSentCache - kept entire mail items including html (with embedded base64 images), canvasHtml, and attachments[] in JS heap permanently. With 100 sent emails containing inline images, easily 500MB-2GB. Fixed: localStorage stays authoritative, in-memory cache holds a thinned copy with data:image URIs replaced by [image-stripped-from-cache] and attachment data payloads stripped. getMailOutbox/getMailSent read from localStorage first (full fidelity), only fall back to thinned cache. (2) _studioGalleryMem capped reduced 50→20 entries. Each entry is a 5-20MB base64 dataUrl; at 50 the cache could hold ~1GB. localStorage + IDB still keep the full set; older entries beyond 20 stay on disk. (3) New diagnostics: brillianceMemoryReport() shows size of every known in-memory cache so you can pinpoint what's actually using the heap. brillianceFlushCaches() drops every in-memory cache (data on disk untouched, caches lazy-refill). Both runnable from DevTools console. // v34.118: 18.51 GB Safari tab memory leak fixed. Root cause: v34.111's _idbMemoryCache eagerly hydrated EVERY IDB-offloaded key into JS memory at boot AND held them indefinitely with no eviction. With multimodal conversations (base64 images), library files, and auto_lab_images each commonly being 10-100MB, the cache could trivially exceed 10GB. Rewrote: NO eager hydration, lazy fill on first sync read only, hard 8MB total cap with LRU eviction, 1MB per-value cap (huge values aren't cached at all - they live in IDB only and the next render's second read after the async fetch will see them). The original sync-null-on-first-read problem is still addressed: any caller that hits a cache miss fires the async fetch, and the second read inevitably issued by the next render/poll gets the cached value. Added window._idbCacheStats() console diagnostic to inspect cache size at runtime. // v34.117: STOP THE BLEEDING. Notebook deletions kept happening despite v34.115 + v34.116 fixes. Reduced surface area drastically: (1) saveScribeNotebooks now SKIPS the cloud writeDB call entirely when scribeNotebooks is empty. localStorage still gets the empty write (so a real "delete the last notebook" works locally), but cloud never receives an empty array - so a transient empty in-memory state can no longer overwrite a populated cloud doc. (2) recoverNotebooks made strictly ADDITIVE - it never replaces the array, only unions in missing ids. Routes through saveScribeNotebooks (which has its own empty-skip guard) instead of direct writeDB. The previous behavior of replacing scribeNotebooks + pushing the replacement to cloud could overwrite cloud with whatever was in stale Firestore cache. (3) initScribe no longer auto-invokes recoverNotebooks. Recovery is manual only via console (window.recoverNotebooks()). (4) The backup-restore-on-init path no longer calls saveScribeNotebooks (which would push to cloud) - it just writes the backup back to localStorage, leaving cloud untouched. The next legitimate save will sync via writeDB normally. (5) initScribe takes an INITIAL backup snapshot the first time the user opens Notebooks if no backup exists yet, so users who never went through a save in v34.115+ get a backup at view-enter time. // v34.116: Full notebook recovery utility. v34.115's backup-restore couldn't help because the rolling backup didn't exist when the wipe happened. This release adds window.recoverNotebooks() which scans every possible source: in-memory list, localStorage primary key, localStorage rolling backup, pending-create breadcrumb (v34.110), any other localStorage key matching the scribe pattern, Firestore cache (Firebase's IndexedDB persistence still holds the previous server snapshot from BEFORE the cloud was overwritten), and Firestore server. Each source's notebooks are merged by id with conflict resolution by _modifiedAt. If the recovered set is larger than the current in-memory list, scribeNotebooks is replaced, localStorage updated, backup saved, and the result pushed to cloud via writeDB so other devices see the recovery. initScribe auto-invokes recoverNotebooks() on first init when both the primary list AND backup are empty - catches users whose wipe predated v34.115. // v34.115: EMERGENCY - notebook data-loss fix. User reported "all of my notebooks were removed" after v34.114. Three problems compounded: (1) v34.114 added editor.on('SetContent ExecCommand', scheduleScribeAutoSave). SetContent fires whenever editor.setContent() is called - including during selectScribeNotebook's content load. The 1s autosave then ran during the TinyMCE init/select timing window and could write partial state. REVERTED: only keyup+change now schedule autosave, no SetContent listener. (2) mergeByTimestamp with firstSyncCompleted=true silently DROPS local items that aren't in cloud + are older than lastSync - meaning a partial cloud doc (from a prior SDK assertion mid-write) plus older local notebooks would result in cloud's reduced set replacing local. Replaced with a HARD union-merge for notebooks specifically: keeps every local id PLUS every cloud id, conflict resolution by _modifiedAt. Real deletes still work via deleteScribeNotebook + the tombstone path; this passive sync path is now strictly additive. (3) Added saveScribeNotebooks safety guard: refuses to save an empty list when a non-empty rolling backup exists in roweos_scribe_notebooks_backup. The backup is written every successful save with >=1 notebook, so an intentional "delete the last notebook" still produces the correct empty state. initScribe also reads from the backup on startup if the primary list is empty, and toasts "Restored N notebooks from backup" when recovery fires. // v34.114: Notebook typing lag actually fixed (v34.113's debounce wasn't the cause). Three real culprits identified: (1) TinyMCE wordcount plugin loaded alongside our custom updateScribeWordCount - the plugin walks the entire document on every keystroke for its own counter. Removed wordcount from plugins list and toolbar. (2) editor.on('change keyup', ...) registered a handler that fires for BOTH events per keystroke, doubling the autosave-schedule + word-count work. Consolidated to a single keyup listener; non-keystroke changes (toolbar formatting, paste) handled via batched SetContent/ExecCommand event which does not fire per character. (3) initScribeMentions ran checkForMentionTrigger on every keyup unconditionally - editor.selection.getRng() + textContent read + substring + lastIndexOf per keystroke. Now only fires when `@` or Backspace is pressed (or while the mention dropdown is already open and filtering). // v34.113: Notebooks UX fixes. (1) Notebooks now show up automatically when entering the view, no more "click New Notebook to make existing notebooks appear" workaround. Root cause: initScribe ran synchronously and read localStorage before the cloud pull completed (esp. on first device login or fast tab-switch); the empty list rendered. Once the user clicked New Notebook, the resulting writeDB triggered a snapshot listener which called loadFromFirebaseV2's notebook-merge block, which silently updated scribeNotebooks but never re-rendered. Now: that merge block, after assigning scribeNotebooks = _mergedNbs, checks if scribeView is visible and calls renderScribeNotebookList() if so. (2) Typing lag in TinyMCE editor (~1s visual) eliminated. updateScribeWordCount was running on every keyup, calling editor.getContent({ format: 'text' }) which walks the full TinyMCE content tree plus a split+filter on the result - 50-200ms per keystroke on a long notebook. Now debounced 300ms; word count is informational, not realtime-critical. // v34.112: "Synced from iOS" toast spam fix. Two bugs were stacking: (1) loadFromFirebaseV2 fires on every onSnapshot tick + every _v321ResolveDrift call + every manual sync, and the cross-device toast had no dedupe. (2) The detection looked at brand doc _deviceId field which is a STORED attribute - if iOS had ever touched a brand, every web pull thereafter saw "ios_xxxxx" baked into the doc and toasted "Synced from iOS" even when iOS hadn't run for hours. Fix: require profile.meta.lastSyncAt within the last 60s before toasting (so a stale _deviceId from a prior session can't trigger), AND track shown labels in window._lastSyncToast.byDevice with a 5-minute per-device cooldown so even a real burst of cross-device pushes only toasts once. cloudLastSync variable now captured alongside cloudLastDevice from profile.meta. // v34.111: Deferred audit cleanup batch. (1) Firebase JS SDK upgraded 10.7.1 → 10.13.2 - latest 10.x with the INTERNAL ASSERTION FAILED bug fixes from the v34.110 dissection. CDN URLs in 01-cdn-and-boot.html. (2) fetch-site-meta.js SSRF defenses replaced. Added isPublicHostname() that rejects IPv6 loopback (::1, ::), link-local fe80::/10, unique-local fc00::/7, IPv4-mapped IPv6, plus full IPv4 reserved + private ranges (RFC 1918 done correctly: 172.16-31, not bare 172.), 169.254.x.x cloud metadata range, 0.0.0.0, multicast 224-239, broadcast 255+, and named hosts (localhost, metadata.google.internal). New fetchWithSafeRedirects manually walks redirects up to 5 hops re-validating hostname + protocol + port on every hop, replacing redirect: 'follow'. Custom ports rejected; only http/https schemes allowed. (3) New /api/log-mail-sent endpoint that the client posts to after successful Gmail/Outlook OAuth sends. Verifies Authorization: Bearer <Firebase ID token> via Identity Toolkit then writes to email_log via _email-log-helper - so the admin Campaigns dashboard finally shows OAuth-routed sends, not just send-template-email.js sends. handleSendSuccess in 00-api-bridge.js now calls it after addToMailSent. (4) Sync v5 Firestore paths corrected: mirrorV4Write auto-registration plus 9 read-shadow firestorePath functions all changed from 'users/{uid}/...' (wrong namespace) to 'roweos_users/{uid}/...' (matches v5 registry + every other reader/writer). Previously dual-write data could land in a parallel Firestore tree no reader queries. (5) IDB shim sync-null race fixed via in-memory cache. _idbMemoryCache now hydrates immediately on _idbReady (not after the prior 1s setTimeout) and is consulted synchronously by Storage.prototype.getItem when the key is offloaded. UI no longer sees empty conversation lists / library / agent_commands / auto_lab_images for the first second of every page load. // v34.110: Sync error + notebook self-deletion dissection. (1) manualSyncNow's catch block now auto-recovers from Firestore SDK INTERNAL ASSERTION FAILED / Unexpected state errors (known Firebase v10 SDK bug), not just the prior 'terminated' branch. Calls clearPersistence() + retries once with a friendlier "Sync hit a transient SDK issue, auto-recovering" toast instead of the alarming raw error. After retry exhaustion the toast still mentions data is safe locally. (2) _v321ResolveDrift and forceAlignFromCloud_v321 are now actually defined - they were referenced via typeof checks but never implemented anywhere, so the "Aligning..." status in Settings → Sync never resolved. _v321ResolveDrift now debounces 600ms then calls loadFromFirebaseV2 + re-renders inventory; forceAlignFromCloud_v321 returns Promise.resolve() (redundant with manualSyncNow's own pull). (3) createScribeNotebook writes a recovery breadcrumb to roweos_scribe_pending_create with a full backup of the just-created notebook object. saveScribeNotebooks clears it once a save confirms the notebook is still in the array. initScribe checks on load - if the breadcrumb id is NOT in the loaded notebook list, the notebook is restored from the breadcrumb backup and a toast confirms recovery. Catches the "made a notebook, closed out, it vanished" pattern where a Firestore SDK assertion mid-write left the in-memory array empty before the next save persisted it. (4) beforeunload listener flushes scribeNotebooks to localStorage as a synchronous belt-and-suspenders save, catching debounced TinyMCE autosaves that hadn't fired yet when the tab closed. // v34.109: Reload always lands on the "Be Brilliant" splash for everyone, not directly on the sign-in form. Reverts the v20.1 + v34.99 returning-user shortcut in both 07-early-inline.js (the inline IIFE that ran before showAuthGate could) and 22-firebase-sync.js's showAuthGate. The Begin button still calls triggerGoldTransition() which fades the splash and reveals authLogin in one tap, so returning users still reach sign-in quickly while seeing the branded landing on every reload. // v34.108: Three usability fixes from the screenshot batch. (1) Native Workspace cross-device toast spam removed. The "Native Workspace is on for X on another device" toast was firing N times because the prompted-flag was set inside a 4s setTimeout, so multiple sync pulls in quick succession all queued toasts before any of them set the flag. Per user direction: removed the toast entirely, stash the other-device folder name in roweos_native_fs_xdevice_name, and surface it inline in Settings → Native Workspace's description so users see "Connected on another device as 'X'. Pick a folder here..." only when they visit Settings. (2) Image-gen misroute on PDF upload fixed. classifyInteraction (11-agents.js) used bare msg.indexOf for action+noun matching anywhere in the prompt. When users attached PDFs (resume + job description), file content concatenated into the prompt almost always contained "design"/"create"/"icon"/"graphic", so a "please write an email" request routed to image generation. Now uses the stricter IMAGE_INTENT_RE regex (verb+noun within 40 chars) and bails out entirely when the prompt asks for a written deliverable (write, draft, email, paragraph, summary, etc.). _detectImageGenIntent (20-ui-misc.js) gets the same written-intent bailout. (3) Mobile Quick Capture FAB UX fixes. (a) Drops ⌘ keyboard-shortcut symbols on mobile rows since touch users have no keyboard. (b) Adds a "New Chat" row at the top of the sheet. (c) Dynamically lifts above the chat composer using getBoundingClientRect on the active textarea container plus an input/focus/blur listener pair, so typing a long message no longer pushes the textarea up over the FAB's send button. // v34.107: Audit Cycle 3 - admin auth refactor + sync hardening + server hardening. (1) Admin endpoints (admin-delete-user, send-template-email) now require Authorization: Bearer <Firebase ID token>; the body.callerUid bypass is gone. Identity Toolkit accounts:lookup verifies the token server-side using the existing service account; only the verified UID is checked against ADMIN_UID. Three client callers updated: deleteUserEverywhere (25-admin-emails:1212), adminSendTemplateToUser (25-admin-emails:1539), composerSend interactive-templates path (22-firebase-sync:8090). (2) V1 applyCloudData now applies tombstone filter to roweos_pulse_goals before write so deleted goals don't resurrect on silent-restore pulls. (3) writeDBDoc empty catches now log to console.warn so Firestore write throws + v4 mirror failures surface for debugging instead of silent loss. (4) setApiKey JSON.parse wrapped in try/catch with shape guard so a corrupted roweos_api_keys value doesn't permanently block API key updates. (5) Knowledge engine _gatherPulse adds Array.isArray guard before goals.filter() per CLAUDE.md rule. (6) feedback.js CORS tightened to roweos.com/www/vercel allowlist (was echoing arbitrary origin -> drive-by spam vector). (7) blob-proxy.js now parses URL with new URL() and validates hostname + pathname.startsWith separately; previous substring-match was bypassable. (8) track-click.js redirect guard hardened: requires path to start with '/' and reject '..' traversal. (9) newsletter.js generateAccessKeyString switched from Math.random() to crypto.randomInt() for CSPRNG-quality keys (matches stripe-webhook). (10) gmail-proxy.js outlook_exchange now persists tokens to Firestore via new storeOutlookTokens helper - mirrors Gmail path so Outlook connections survive device switches. // v34.106: Audit Cycle 2 follow-on (XSS sweep + savePipeline class + Outlook calendar 401 retry + standalone email logo). (1) escapeHtml applied to studio history (showHistory), print window (printOutput document.write), HTML export (exportAs), day-view AI chat (renderAIChatSection msg.content), concierge row pill labels/values - 5 confirmed XSS vectors closed. Run.deliv split crash also guarded. (2) savePipeline now persists outboxFolder for outbox steps and contextRef (Research Instructions textarea) for research steps - same v34.103 logoAlignment-class bug, two more fields silently zeroed on save. (3) Standalone email automation executor (30-automations-init.js) now honors task.config.includeLogo + task.config.logoAlignment - pipeline path was fixed v34.103 but the standalone email scheduler always rendered a logo regardless of toggle and always centered. (4) Outlook calendar push/update/delete write-back now refresh-and-retries on 401 matching the syncOutlookCalendarEvents pattern. Update path also now checks r.ok BEFORE parsing JSON so a 4xx no longer silently toasts success. // v34.105: Audit-driven Cycle 1 fixes (10 surgical, 264-finding overnight audit). (1) bloomSaveSignals now mirrors bloomGetSignals life-mode key derivation - life-mode likes/saves/filters previously written to brand key, lost on next read. (2) Knowledge engine reads thought board from 'roweos_thought_board' (write key) instead of nonexistent 'roweos_thought_board_pins' - AI now sees pinned thoughts. (3) v5 BOOTSTRAP_MAP brands lsKey changed from 'roweos_brands' to 'roweos_user_brands' so the brand v5 cache actually bootstraps. (4) Scheduler social token Firestore path 'users/{uid}/social_tokens/' fixed to 'roweos_users/{uid}/social_tokens/' - aligns with rest of codebase, scheduled social posts can find tokens. (5) confirmDeleteBrand now calls saveBrands() + deleteDBDoc instead of raw localStorage write - fixes brand resurrection after delete. (6) importBrandData calls saveBrands() + initBrandLogo + initBrandAccentColor so imported brands reach Firestore + sidebar updates. (7) Pipeline 'post' action honors socialPostRequiresApproval/_forceApprovalQueue/_socialOutboxBypass - scheduled posts no longer bypass approval guardrails. (8) postMessage handler validates event.origin against allowlist - prevents arbitrary opener/iframe from injecting OAuth tokens. (9) Solo tier copy 7-day → 14-day to match Founder/Premium. (10) Boot screen light-mode background #ffffff → #f5f3ee (cream) - removes visible white flash. // v34.104: X "Something went wrong" + pipeline email mode-aware From + logo center fix + iCloud signature FAQ. (1) X OAuth scope reduced - dm.read/dm.write needed elevated X API access (Pro tier $200/mo); requesting them on the standard tier caused X's authorize page to show "Something went wrong" before the consent screen. Now defaults to tweet.write/read + users.read + offline.access only; DM scopes are opt-in via localStorage flag roweos_x_request_dm_scopes for users with elevated access. (2) Pipeline email From dropdown now mode-aware: getDefaultFromAddressForMode(mode) returns the user's first connected Gmail/Outlook for life pipelines, the configured default for brand pipelines. Both email + outbox step UIs label the dropdown with the active mode default. (3) Header logo center alignment - savePipeline() was dropping includeLogo + logoAlignment for the email step (only collectPipelineStepData captured them on UI re-render, never on Save), so user picks "Center" / unchecks logo → click Save → field never persisted. Both fields now saved. Outbox + batch_email step contexts now also propagate logoAlignment + honor includeLogo === false. (4) iCloud signature FAQ added to Mail Settings - documents that the bottom-of-email logo some recipients see is iCloud Mail auto-appending its own signature, not our template. // v34.103: Onboarding success states - Calendar (Google/iCloud/Outlook) and Mail (Gmail/Outlook) connect cards now flip to green border + show "Connected as user@email" once OAuth completes. Outlook calendar onboarding handler was using blue border (#0078d4); now matches Google/iCloud green. Gmail/Outlook mail postMessage handlers in 00-api-bridge.js now also update onboardingEmailGmailCard / onboardingEmailOutlookCard with green border + email label, and prefill the Default From input. Google "unverified app" helper paragraphs added under both Google Calendar and Gmail connect surfaces explaining the Advanced → Continue path and the 4-6 week verification timeline (TRC LLC). // v34.92: Native Workspace - File System Access bridge (53-native-fs.js). User connects a folder via showDirectoryPicker; FileSystemDirectoryHandle persists across reloads in IndexedDB. Five tools exposed to LLMs: workspace_list_directory, workspace_read_file, workspace_search_files, workspace_write_file, workspace_delete_file. Anthropic streaming patched with a tool_use → tool_result loop (max 6 iterations) so Claude can chain reads / searches / edits in a single turn. Writes + deletes always confirm via inline modal unless user grants session-trust. Settings → Connections gains Workspace Folder + Permission (read | read+write) + Trust toggles. Capability addendum injected into system prompt only when workspace is connected, so chat doesn't pay token cost when feature isn't being used. // v34.88: /social3 lockup tightened - B circle and Brilliance wordmark now overlap (negative bottom margin -24 to -32px) so the two PNGs read as one stacked mark instead of separate elements. Wordmark sized down ~18% across all formats. v34.87: /social3 swaps the rendered "Brilliance / INTELLIGENCE OS" text and old monogram for two new dedicated PNG assets - b-logo-gold.png (cursive gold B inside a haloed circle) and wordmark-intelligence-os.png (full Brilliance + INTELLIGENCE OS lockup). All four card layouts (portrait, square, story, X/Twitter) now show both images stacked instead of building the lockup from typography. v34.86: Feedback modal area cards refreshed for the v34.x Brilliance surface map (Notebooks, Evolve, Thought Board, Folio, Social, Brilli, Knowledge, History added; Focus retired). JS allowlist `areas[]` re-ordered in lock-step. Privacy + Terms updated to cover Notebooks, Evolve, Verifier Engine, Brilliance Knowledge Engine, Thought Board, iCloud Calendar (CalDAV), Outlook Calendar (MS Graph), Mail integrations (Gmail / Outlook / iCloud), Stripe + Resend + Push Notifications. Founder pricing reframed as 14-day trial; "Free Beta" copy retired. // v34.84: /social3 polish - dark-mode CSS filter (invert + 180deg hue-rotate) so the GFS "for Startups" wordmark is legible on black while preserving the colorful Google logo. Multi-sentence taglines auto-split with line breaks ("One platform. / Total brilliance."). Per-card subtitle unified to "Intelligence OS" instead of category labels. Brilliance monogram bumped further (200px portrait, 160px square, 240px story). v34.83: /social3 visual fixes - Brilliance monogram bumped, Google badge size adjusted. v34.82: Launch /social3 Brilliance social campaign builder. // v34.62: Daily Brief empty state is now time-aware and actionable. The old version was a single static line. New version branches by hour: morning (<11) "A clear morning. What\'s the one thing today?" with a "Capture a goal" gold CTA; midday (<17) "Quiet so far. Anything you want to land before dinner?" with "Drop a quick goal"; evening (<21) "Quiet evening. A note for tomorrow?" with "Capture a note"; late "Late and clear. Sleep on it, or capture something for tomorrow." Italic Georgia headline, soft sub copy, gold-gradient pill button. Goal CTA fires before 5pm, Note CTA fires after — the choice tracks how people actually use those surfaces (capture-mode in the morning, reflection-mode at night). Closes the Brief and opens the appropriate quick-add modal in one click. Clear-draft escape hatch. for the v34.51 chat input draft auto-save. New `window.clearChatDraft()` removes `roweos_chat_draft`, blanks both chat textareas (agentCommand + followupCommand), and runs `autoResizeTextarea`. Triggered by ⌘ ⇧ X (mnemonic: X for "ditch") OR ⌘K alias `clear draft` / `wipe draft` / `reset draft`. Listed in the Focus / Universal section of the shortcuts overlay alongside ⌘⇧G / ⌘⇧R / ⌘⇧N / ⌘⇧T. Special-cased: the keystroke fires even when focus is in the chat input (normally we skip input targets), since this is its dedicated keystroke. v34.60 (milestone) — Yesterday\'s Recap footer now mirrors the v34.59 Daily Brief footer with a "Today\'s Brief →" outline button on the left, paired with the gold-gradient Close on the right. Click closes the Recap and opens the Brief after a 300ms transition. Forward + backward day-anchor surfaces are now bidirectionally linked: from the Brief you can step back to yesterday, from the Recap you can jump forward to today, both inside the same modal flow. Sixty-version mark in the v34.x series. Daily Brief footer now has a "← Yesterday\'s Recap" cross-link button. Footer goes from a single right-aligned Close button to a flex-justify-between layout: outline-style link on the left, gold-gradient Close on the right. Click closes the Brief and opens the Recap after a 300ms transition. Forward-looking and backward-looking surfaces are now one click apart inside the day-anchor flow. Yesterday\'s Recap modal. — backwards-looking counterpart to the Daily Brief. Walks Pulse goal items (`completedAt` matching yesterday\'s date), reminders (status completed/dismissed with timestamp matching yesterday), mail sent (`roweos_mail_sent` `sentAt` matching), and notebook entries (`_modifiedAt` matching). Renders four green-tinted accomplishment rows + an empty state pointing to ⌘ ⇧ G. Time-aware label uses yesterday\'s actual weekday name (e.g. "Friday, April 29" on a Saturday) so weekend-recovery works. Same modal aesthetic as the Daily Brief (gold monogram + bloom halo header). New `/yesterday` and `/recap` slash commands, ⌘K aliases `yesterday` / `yesterday\'s recap` / `recap`. Useful for Monday-morning catch-up and post-trip context recovery. View-jump + random slash commands. (1) `/random` picks a random Brilli form excluding the current one (so it actually changes). Light delight command. (2) Eight new view-jump slash commands: `/pulse`, `/notebooks` (alias for `/scribe`), `/library`, `/automations`, `/mail`, `/bloom`, `/studio`. Each calls `showView(viewId)`. Saves the user from typing `open pulse` in ⌘K — slash is faster from the chat input. Slash autocomplete chip strip gained matching chips so all sixteen slash commands are now discoverable. Brilli enters true `asleep` mode. after 5 minutes of user idle. Any mouse / keyboard / pointer / touch / wheel / scroll activity wakes him back up. v33.10 already had `asleep` mode keyed off `document.hidden` (tab switch / minimize) — this layers a user-idle detection on top so Brilli also rests visually when you step away from the computer without changing tabs. Each instance saves its prior mode in `_userIdleSavedMode` and restores on wake. Listeners are `passive: true, capture: true` so they never block scroll. Streak row in the Daily Brief. Computes the active streak — consecutive days (ending today, or yesterday if today has no wins yet so the streak doesn\'t collapse before bedtime) with at least one completed Pulse item. Walks every goal\'s items once, builds a date-keyed `doneDayMap`, then counts back day-by-day until a gap. Hard-capped at 365 days to avoid pathological loops. Renders only when streak >= 2 (a single day reads better as just "Today\'s Wins"). Milestone copy: 7-day streak says "one week", 30+ says "one full month", 100+ says "keep going". Same gold-tinted styling as the v34.27 urgency rows but separate semantically — sits between the pressure rows and Today\'s Wins. Slash command vocabulary expanded. Four new chat slash commands match the existing ⌘K aliases: `/sync` (manual cloud sync inline with toast), `/theme` (toggle light/dark), `/focus` (toggle Focus Mode), `/brilli {form}` (set Brilli form by keyword — celestial/aura/firefly/signature/classic, plus `field` → aura, `light` → signature, `blake` → classic — or open the picker if no arg). Slash autocomplete chip strip in the chat input also gained four new chips (`/brilli`, `/theme`, `/focus`, `/sync`) so they\'re discoverable. Shortcuts overlay slash-commands section updated with the new entries. Brand cycle pulse-flash. on every Brilli instance, so the brand switch feels tactile and visible alongside the toast popup. Walks `Brilli._debugInstances()` and bumps each instance\'s `ambientBurst = 1` + `pulseFlash = 0.85` so the chat-hero orb plus any sidebar dots flash gold momentarily. The toast still confirms the new brand short-name; this just adds the visual companion. Slash autocomplete keyboard handling. (1) Tab key completes the first matching slash command (familiar terminal-style autocomplete) — when the chip strip is visible, pressing Tab inserts the top-ranked command + space, hides the strip, and lets the user start typing the argument immediately. (2) Esc hides the chip strip without clearing input, so users who pressed `/` by mistake can keep typing free-form text without deleting it character by character. Both keys fire only when the chip strip is visible so they don\'t hijack normal input behavior. Auto-save chat input drafts. If you type a message but refresh, switch tabs, or close the PWA before sending, the draft restores on next load. Persisted in `roweos_chat_draft` (single localStorage key) with a 400ms debounce so it doesn\'t hammer storage on every keystroke. Only writes drafts > 8 chars (so half-typed slash commands like `/g` don\'t persist), and clears the key when the input goes empty. Wired to both the landing input (agentCommand) and the followup input (followupCommand). Re-wires every 1.5s so dynamically-mounted inputs pick it up. Triggers `autoResizeTextarea` after restore so the textarea heights right. Auto-open Daily Brief. on first sign-in each day. Opt-in toggle in Settings → Appearance ("Auto-open Daily Brief"), persisted in `roweos_daily_brief_auto`. When enabled, the Brief opens ~2.5s after page load (giving welcome / restore / auth gate / What\'s New time to settle), and only once per day per device — tracked via `roweos_daily_brief_last_shown` (YYYY-MM-DD). Skips when ANY of those competing surfaces are still up. ⌘ ⇧ T still works whenever you want to open it manually. Toggle is initialized by the existing v33.99 settings-row label sync. Together with the v34.35 Brief, v34.36 ⌘⇧T shortcut, v34.49 Today\'s Wins row, and the 7-tip empty-state, the Brief is now Brilliance\'s daily anchor surface for users who want one. "Today\'s Wins" row in the Daily Brief. — a positive counterweight to the overdue / due / pending pressure rows above. Walks every Pulse goal\'s items and counts those with `completed: true` and `completedAt` falling on today (string-prefix match on `YYYY-MM-DD`). Renders at the bottom of the Brief in muted-green styling (separate from the gold/cream urgency rows) so it reads clearly as celebration rather than another to-do. Empty-state copy still fires only when there are zero pressure signals AND zero wins, so the Brief never feels bare. Click routes to Pulse like the other rows. The numeric format (24px Georgia, gold-greenish numeral) matches the urgency-row aesthetic. Two new ⌘K commands. (1) "complete reminders" / "finish reminders" / "clear reminders" / "mark all reminders" / "reminders done" — closes every reminder whose scheduled time has passed. Walks `roweos_reminders`, sets `status: completed` + `completedAt` + bumps `_modifiedAt` on each due item, persists via writeDB so the cloud sync stamps too. Toast confirms count ("Closed 3 reminders"). Sidebar badge + concierge row + focus reminders all refresh. Useful end-of-day cleanup for the "due now" pile that the v34.27 urgency sort puts at the top of the row. (2) "daily" added as a new alias for the v34.35 Daily Brief alongside `brief` / `today` / `what\'s next`. Brand cycle keyboard shortcuts — ⌘ ⇧ [ goes to previous brand, ⌘ ⇧ ] to next, mirroring browser tab navigation. Multi-brand operators were doing four clicks (sidebar → dropdown → brand → close) every time they switched contexts; one keystroke now. Skips when typing or in Life mode (brand cycling is a brand-mode concept). Uses the existing `selectBrandFromDropdown(idx)` so all the established brand-change side effects (sidebar name update, accent color, view rerenders, lifeai/brandai mode propagation) fire normally. Toast confirms the new brand by short name. Listed in a new "Brand switcher" section of the v34.17 shortcuts overlay between Studio and Focus / Universal. Inline slash-command autocomplete. When the chat input starts with just `/` or `/<partial>` and contains no space, a small chip strip appears just above the input listing the matching slash commands (`/goal · Save to Pulse`, `/note · Quick note`, `/remind · Quick reminder`, `/brief · Daily Brief`, `/help · Shortcuts`). Click a chip to insert the full command + a space. Same Slack/Linear pattern. Wired to both the landing input (`agentCommand`) and the followup input (`followupCommand`); `mousedown` is prevented on chips so click doesn't blur the textarea. Hides on space, blur, or empty input. Re-wires every 1.5s so dynamically-mounted inputs pick it up too. Spotlight Try suggestions also gained `/goal` / `/note` / `/remind` hints in their desc copy + a new `sync` example so users discover the v34.45 slash commands and v34.29 sync alias from the search bar. Chat slash commands. Type a slash-prefixed command in the chat input and it routes to the matching capture surface instead of sending to AI. Recognized: `/goal X` and `/task X` (saves to Pulse Unassigned via addItemToPulseGoal, with toast + sidebar/concierge refresh — no modal needed for the inline case), `/note X` (opens Quick Note modal pre-filled), `/remind X` and `/reminder X` (opens Quick Reminder modal pre-filled), `/brief` and `/today` (opens Daily Brief), `/help` and `/shortcuts` (opens Shortcuts overlay). Wired in `runAgent()` (20-ui-misc.js) before any AI / image-gen logic so slash commands always intercept. Documented in a new "Chat slash commands" section in the v34.17 shortcuts overlay alongside the keyboard shortcuts and ⌘K examples. Hash-based deep links. into the v34.x quick-action surfaces. Users can now bookmark, share, or automation-link to any of: `#brief` / `#today` (Daily Brief), `#help` / `#shortcuts` / `#?` (Shortcuts overlay), `#goal` / `#reminder` / `#note` (capture modals), `#search` / `#k` (Spotlight). Wired in 34-brilli.js with a `load`-then-600ms-timeout so target functions are defined when fired, plus a `hashchange` listener for in-session navigation. After firing, the hash is cleared via `history.replaceState` so a refresh doesn't re-trigger the action. URLs like `roweos.com/#brief` or `roweos.com/?ref=email#goal` now open the right surface for free. Mobile Quick Capture FAB. Mobile users couldn't easily reach the v34.19 / v34.20 / v34.25 / v34.36 keyboard quick-actions, so the platform's most useful capture surfaces were locked behind a keyboard nobody on touch has. New floating "+" button bottom-right (above the liquid nav, respects safe-area-inset-bottom) that expands into a 4-action sheet: Daily Brief / Quick Goal / Reminder / Note. Each row shows the matching desktop shortcut so users learn the keystrokes for when they switch to a real keyboard. Routes through the existing `window.openDailyBrief / openQuickAddGoal / openQuickAddReminder / openQuickAddNote` so the modals are identical to the desktop flow, no separate code path. FAB is hidden on desktop (>= 769px), inside Focus Mode, and when ANY of the quick-action overlays / Daily Brief / shortcuts overlay / data restore prompt are open. Outside-tap closes the sheet. Auto-refreshes visibility on resize and via a 500ms poll so it never persists over a freshly-opened modal. Sidebar version label tooltip is now dynamic. — hovering it shows version + last cloud sync time (relative: "a moment ago" / "12 min ago" / "3 hr ago" / "2 days ago") + "Click for changelog" hint, instead of the static "What's new in this version". Builds the tooltip on `mouseenter` from the saved `roweos_last_sync` timestamp via a new `window.updateSidebarVersionTooltip()` helper. Falls back to "Not yet synced" if no timestamp exists. Cheap to compute, no rerender, just an `el.title` update. New Library concierge pill — counts files added since last viewed across every brand and life library. Walks `roweos_brand_library_*` and `roweos_life_library` storage keys (multi-brand structure), checks `_modifiedAt` / `uploadedAt` / `createdAt` against `roweos_library_last_seen`. Urgency 12 (between Bloom 15 and Resume 10 in the v34.27 sort). Listed in the v34.5 customizer modal so users can toggle it. New `markLibraryViewed()` in 28-reminders-notifications.js stamps the timestamp when user opens Library, wired in `showView(\'library\')` in 11-agents.js. Three new ⌘K command aliases that fill workflow gaps. (1) "snooze concierge" / "hide concierge for an hour" / "quiet concierge" → temporarily hides the concierge row for 60 minutes via a new `roweos_concierge_snooze_until` timestamp localStorage key. `_renderConciergeRow()` now honors the snooze: if `Date.now() < snoozeUntil` it returns early and hides the row; if expired, it cleans up the key and renders normally. Useful for heads-down sessions where the concierge feels like noise. (2) "lock" / "lock screen" / "lock app" → calls `signOut()` (or `firebase.auth().signOut()` fallback) — same as the v34.29 "sign out" alias but with a more familiar mental model on shared computers. Data stays in cloud, only the local session ends. (3) "brilli form" / "change brilli" / "pick brilli" / "choose brilli" / "brilli forms" → opens `openBrilliFormPicker()` directly. Was previously only reachable via Settings → Appearance, ⌘ ⌥ B (which cycles, not picks), or the chip strip. BUGFIX — PWA hard reload sometimes flipped to the "Welcome back, Jordan, restore?" prompt even for returning users (with the What's New modal visible behind it as bonus). Two issues stacked. (1) The v34.4 silent-restore check was too narrow — it only consulted `roweos_initialized=true` and `roweos_last_uid`, both of which can briefly return `null` on PWA hard reload before the storage shim has hydrated, and Safari can occasionally lose individual localStorage keys between sessions. Broadened the "this device has used Brilliance before" check to ALSO accept any of: `brilliance_whatsnew_seen` (set after first welcome), `roweos_app_mode`, `roweos_theme`, `roweos_onboarding_complete`. Any one of those means silent-restore is safe. (2) Also stamp `roweos_last_uid` IMMEDIATELY at the top of `handleAuthState()` (not just on accept-restore), so future loads always have a fresh anchor regardless of how the previous session ended. (3) `maybeShowWhatsNew()` now skips if the data restore prompt OR auth gate is up, so the two never stack visually like in the screenshot. Four targeted fixes from Jordan's screenshot batch (Images #59-63). (1) Concierge row was hugging the "BRAND INTELLIGENCE PLATFORM" title — bumped to a static `margin: 32px 0 24px` (mobile: `24px 0 18px`) so the title and pills feel like separate beats. Static px so it never tightens up under font scaling. (2) FIREFLY redesign per Jordan's reference image — the form now has a visible round head with two glowing-white eyes (no pupils, gold rims), two curved antennas with glowing tips that sway, two SEPARATED wings that fan out fully on the X axis (not just vertical pulses) with a hinge-and-rotate transform plus subtle outline so each wing reads as distinct, and a teardrop abdomen behind the head. CLICKING the firefly is now a special easter egg: `b.flyOffset` decays over ~1.6s and the firefly traces a figure-eight loop around the host with subtle wing tilt before settling — wired into the existing click-burst handler. (3) RESUME concierge pill was a no-op — `view: \'agent\'` just dropped users on the landing without loading the conversation. Added `_action: \'resume-latest\'` with the original conversation index in `_resumeIdx`; the click handler now calls `chatWithHistoryItem(idx)` which handles brand-mode / life-mode switching + actually opens the conversation. (4) Helix-dim toggle (the half-circle "reduce background" button) was only on the post-send followup input. Added a matching `#helixDimBtnLanding` to the LANDING chat input toolbar so users can adjust ambient before their first message, not just after. Two small additions to the v34.35 / v34.36 work. (1) Daily Brief modal header now shows today's full date in italic Georgia (e.g. "Thursday, April 30") below the greeting, so the panel anchors in time and you don't have to glance at the OS clock. Uses `toLocaleDateString` with `{ weekday: 'long', month: 'long', day: 'numeric' }` so it localizes naturally. (2) Spotlight ⌘K "Try" suggestions list now leads with `brief` at the top of the seven examples, surfacing the Brief alongside `help`, `add goal`, `remind me`, `note`, `brilli firefly`, `split-pane`, and `theme`. ⌘ ⇧ T / Ctrl + Shift + T opens the v34.35 Daily Brief from anywhere. Mnemonic: T for Today. Same skip-when-typing guard as the rest of the quick-action family. Listed in the Focus / Universal section of the shortcuts overlay alongside ⌘⇧G / ⌘⇧R / ⌘⇧N. Concierge empty-state rotation expanded from six tips to seven, adding "Try · ⌘ ⇧ T for today\'s Daily Brief" so users discover the new shortcut + view organically. The empty-state tip click handler dispatcher in 00-api-bridge.js gained a new `daily-brief` action that calls `window.openDailyBrief()` directly. Daily Brief — a focused at-a-glance summary modal that pulls today's signals into one calm panel. Opens via ⌘K "brief" / "daily brief" / "today" / "what's next" / "todays brief", or `window.openDailyBrief()`. Surfaces six categories with smart row labeling: Pulse Overdue (items past their date), Pulse Due Today (items dated for today), Pulse open goals (fallback when nothing dated), Reminders Due Now (triggered, awaiting action), Reminders Upcoming Today (will fire later today), Outbox Pending (mail queued not yet sent), Calendar Today (events on the calendar), Bloom New (saved seeds since last viewed). Each row tap-targets the relevant view (Outbox row uses the v34.31 mail-outbox action that lands on the Outbox tab specifically). Empty state copy points users to ⌘ ⇧ G. Time-aware greeting (Late night / Good morning / Good afternoon / Good evening / Late evening). Same gold monogram disc + bloom halo header pattern as the welcome modal + transition email + What's New for visual continuity. Listed in the shortcuts overlay's ⌘K command examples as `"brief"` so users discover it. Native PWA install prompt. Listens for `beforeinstallprompt`, defers the browser default, and surfaces a small gold-accented banner in the bottom-right corner ~1.2s after the event fires (giving the welcome modal / auth gate time to settle). Banner shows the gold monogram disc + bloom halo (matching the splash + welcome aesthetic), an INSTALL BRILLIANCE eyebrow, "Run as an app, faster open, native notifications." copy, and two CTAs: filled gold "Install" runs the deferred prompt, ghost "Not now" persists `roweos_pwa_install_dismissed=true` so we never nag again. Hidden when already installed (`display-mode: standalone` or iOS `navigator.standalone`), when user previously dismissed, when the auth gate or welcome overlay is up. `appinstalled` event also stamps the dismissed key. Slide-in keyframe injected once. Per Jordan, rewrote the Brilliance Transition email opening to lead with what the platform DOES, not just what it was renamed to. New section opens with "RoweOS is now Brilliance" (italic gold accent on the name to match the splash + welcome surfaces) then immediately leans into the value proposition in three concrete paragraphs: (1) "built to run the brands you operate, the life you\'re actually living, and the small thousand decisions in between" — frames Brilliance as the operating layer for both business and personal. (2) Three concrete day-to-day examples — goal threading from morning into calendar/automations/writing/inbox, client-context recall pulling from every prior conversation, three-second idea capture that the system finds again. (3) The original reassurance ("same platform, same memory, same work, only the name and the orb and the surfaces have changed") consolidated into one closing paragraph. Updated in both the client preview path AND the server pipeline so admin sends and admin previews both get the new copy. No em-dashes; ASCII hyphens / commas only. Em-dash sweep across v34.x user-facing copy. Project memory says "no em-dashes in generated text content" but I'd been sneaking them into the v34.10 What's New modal items, the v34.17 shortcuts overlay items, the v34.30 ⌘K Focus alias desc, the v34.4 Brilli Classic BLAKE description, the v34.6 admin error toasts, the v34.8 "Send Test to Me" toast, and the v34.6 admin Add Person permission-denied error. Replaced every one with a comma, period, or rewritten phrase. ASCII hyphens and `· ` separators kept intact (they're not em-dashes). Console.warn / debug strings left alone — the rule is for user-visible copy. Per Jordan, retitled the Brilliance Transition email subject. Was: "RoweOS is now Brilliance — what changed (and how to keep building)" with an em-dash. Now: "Welcome to Brilliance. What changed, and how we keep building." Updated in both the client preview path (`generateBrillianceTransitionEmail()` in 22-firebase-sync.js) AND the server pipeline (`buildBrillianceTransition()` in api/send-template-email.js) so the subject reads consistently regardless of which path triggers the send. Em-dash removed in line with the project-wide no-em-dashes rule. Also: Outbox concierge pill now lands on the Mail Outbox tab specifically (via a new `mail-outbox` value in the v34.24 `_action` dispatcher), instead of dumping users on the Mail landing/inbox. `showView('mail')` then `setTimeout(switchMailTab('outbox'), 80)` so the tab swap fires after the view's initial render. Two more ⌘K aliases that fill gaps in the command palette. (1) `focus` / `toggle focus` / `focus mode` → calls `toggleFocusMode()` (or falls back to toggling the `focus-mode` body class) — desc surfaces the `⌘ ⇧ F` keystroke. (2) `settings` / `open settings` / `go to settings` → calls `showView('settings')`. The app's surface is wide enough now that getting to Settings via the sidebar isn't always the fastest route, especially on mobile where the sidebar is collapsed. BUGFIX — Brilliance Transition email send was failing with 400 "Invalid template". v34.8 added the `case 'brilliance_transition'` to the server template router AND a `buildBrillianceTransition()` builder, but missed updating the validation whitelist on line 771 of `api/send-template-email.js`. So when admin clicked "Send Test to Me" / "Send to Selected" with the Brilliance Transition template selected, the server rejected with 400 BEFORE the builder ever ran. Added `brilliance_transition` to the `validTemplates` array. PLUS three new ⌘K command aliases that surface previously-buried platform actions. (1) "sync" / "sync now" / "force sync" / "cloud sync" / "push" / "pull" → calls `manualSyncNow()` with a "Syncing…" toast — was only reachable via Settings → Cloud Sync. (2) "sign out" / "log out" / "signout" / "logout" → calls `signOut()` (or falls back to `firebase.auth().signOut()`) so users can end a session without digging through Settings → Account. (3) "concierge" / "toggle concierge" / "hide concierge" / "show concierge" (but not the `customize concierge` alias which still opens the customizer) → flips `roweos_concierge_off` and re-renders / hides the row inline, with toast confirmation. Each adds an `action: fn` to the existing `searchActions()` results pipeline. Pulse concierge pill now surfaces due-date pressure. The pill used to show only "X goals" — useful but not actionable. New logic walks every open goal's `items` array and counts items whose `date` / `dueDate` is today or earlier. If any items are overdue, the pill reads "X overdue" with urgency 95 (sits between Reminders-due 100 and Outbox 90 in the v34.27 sort). If today only, "X due today" with urgency 75 (above Today calendar 70). Falls back to the legacy "X goals" framing with urgency 40 when nothing is dated. Same view target (Pulse), same gold star icon — only the urgency framing changes. Concierge pills now sort by urgency. Each push site adds an `_urgency` value (Reminders 100, Outbox 90, Today calendar 70, Today/Evolve done 65, Pulse goals 40, Automations 30, Evolve days 25, Evolve streak 20, Notebooks 18, Bloom 15, Resume 10) and `_renderConciergeRow()` runs a stable descending sort right before render. Time-sensitive surfaces (overdue reminders, pending Mail outbox, today's calendar) always lead the row, with reference / catalog surfaces (Notebooks new, Bloom new, Resume) trailing. Behavior is invisible until two-or-more pills are active; with one pill it changes nothing. Two discoverability follow-ups for the v34.x command palette + Studio split-pane. (1) Universal Search empty state — when the spotlight first opens with no query (and even when there are recent searches), the panel now shows a "Try" group with seven suggested commands: `help`, `add goal …`, `remind me to …`, `note …`, `brilli firefly`, `split-pane`, `theme`. Clicking a row pre-fills the input and runs the search so users can take a single tap to learn the new alias. Slots in below the existing "Recent" group when applicable. (2) Studio Split-Pane action-bar button title now ends with "(⌘ ⌥ P)" so the v34.11 keyboard shortcut surfaces on hover for any user who pauses on the toggle without knowing the keystroke. ⌘ ⇧ N / Ctrl + Shift + N drops a quick note straight into a Notebooks "Quick Capture" notebook. Third member of the v34.x quick-add family alongside ⌘⇧G (Pulse) and ⌘⇧R (reminders). Modal centered near the top of the viewport, captures multiline text via `<textarea>` (Enter inserts a newline; ⌘/Ctrl + Enter saves so notes can include real paragraph breaks). On submit, finds or creates a "Quick Capture" notebook in `roweos_scribe_notebooks`, prepends a timestamped block to the top of `notebook.content` (so newest entries always appear first), updates `_modifiedAt` so the v34.16 sidebar Notebooks pill picks it up, and pushes through `writeDB('scribe/main', { notebooks })` so the cloud sync stays current. Same skip-when-typing guard, Esc cancels, click-outside cancels. Listed in the Focus / Universal section of the shortcuts overlay alongside ⌘⇧G / ⌘⇧R, and a matching ⌘K alias picks up `note X` / `new note X` / `quick note X` queries. Concierge empty-state tip rotation — when there are no live signals (no open goals, no automations, no due reminders, etc.), the row used to show only "Begin · Set a goal in Pulse". Now rotates through a six-tip rotation that surfaces the v34.x power-user shortcuts even when there's no data: "Set a goal in Pulse", "⌘ ⇧ G to capture a goal", "⌘ ⇧ R for a quick reminder", "? for the shortcuts panel" (opens the v34.17 overlay directly), "⌘ ⌥ B to cycle Brilli", "Customize · Pick which pills appear" (opens the v34.5 concierge customizer). Picks deterministically by day-of-year so the tip is consistent within a day but changes daily — no flicker, no per-load randomness, but new context tomorrow. Click handler in 00-api-bridge.js extended with an `_action` override so the shortcut/customizer tips trigger their respective overlays instead of navigating somewhere. Discoverability — Keyboard Shortcuts row in Settings → Appearance, immediately below "Reset Brilliance Preferences". Opens the v34.17 shortcuts overlay (the same one ? key + ⌘K "help" / "shortcuts" / "?" open). Title "Keyboard Shortcuts", desc copy "Every Brilliance keystroke + ⌘K command in one panel. Also opens with `?`." so users learn the keyboard alternative on the way to using the overlay. Custom keyboard SVG icon to match the row's intent. Mobile concierge row — horizontal scroll instead of multi-row wrap. After v34.16 (Outbox + Notebooks pills) and v34.20 (Reminders), the concierge could surface up to nine pills (Pulse, Automations, Bloom, Today, Evolve, Reminders, Outbox, Notebooks, Resume). On mobile (max-width 768px) the existing `flex-wrap: wrap` was pushing the chat input way down whenever a few of those lit up. Switched the mobile breakpoint to `flex-wrap: nowrap` + `overflow-x: auto` with `-webkit-overflow-scrolling: touch`, hidden WebKit scrollbar, scroll-snap-x at the start so the most-relevant pill is always visible first, and `flex-shrink: 0` on each pill so they don't squish. Desktop layout (which already had the 720px max-width container + center alignment) is unchanged. ⌘ ⇧ L / Ctrl + Shift + L toggles light / dark mode anywhere in the app. Familiar keystroke from Linear, Cron, Raycast — quicker than digging into Settings → Appearance to flip the theme. Wired in 34-brilli.js with the same skip-when-typing guard as ⌘⇧G / ⌘⇧R / ⌘⌥B / ⌘⌥P / `?`. Reads the `light-mode` html class after toggle and surfaces a toast confirmation ("Light mode" / "Dark mode"). Listed in the Focus / Universal section of the shortcuts overlay alongside the other ⌘⇧* keys, and a matching ⌘K alias picks up `theme` / `toggle theme` / `dark` / `light` / `dark mode` / `light mode` queries. Quick-add reminder, symmetric to the v34.19 Pulse quick-add. (1) ⌘ ⇧ R / Ctrl + Shift + R anywhere opens an inline modal that captures a title + a datetime, then writes a `roweos_reminders` entry via the existing `saveReminderToHistory()` flow. Default time is "+1 hour" so single-line capture still produces a usable reminder. Toast confirms with a relative-time hint ("in 23 min" / "in 4 hr"). Same skip-when-typing guard, Esc cancels, Enter submits, click-outside cancels — same patterns as ⌘⇧G. Sidebar Pulse dot + concierge Reminders pill refresh immediately. (2) ⌘K command alias: `remind me to X` / `reminder X` / `remind X` opens the quick-reminder modal pre-filled with `X`. (3) Shortcuts overlay (Focus / Universal section) lists ⌘⇧R alongside ⌘⇧G so users see the symmetry. Pulse quick-add — capture a goal or task without leaving the surface you're on. (1) `⌘ ⇧ G` (Mac) / `Ctrl + Shift + G` (Windows / Linux) anywhere in the app opens an inline modal centered near the top of the viewport. Captures one line and writes it as an item on the Unassigned Pulse goal via the existing `addItemToPulseGoal(null, {text})` flow, then refreshes the sidebar dot + concierge row so the new item shows immediately. Same skip-when-typing guard as the v34.9 / v34.18 shortcuts. Esc cancels, Enter submits, click-outside cancels. (2) The existing `⌘K` "add goal {text}" / "add task {text}" / "new goal {text}" patterns no longer just navigate to Pulse — they now actually CREATE the item via the same `addItemToPulseGoal()` path, with toast confirmation and the same sidebar / concierge refresh. The shortcuts overlay lists `⌘ ⇧ G` in the Focus / Universal section, and the search desc copy includes the keyboard shortcut hint so users learn the keystroke version while they discover the command. No data-model changes — items go straight onto whichever Unassigned goal matches the current mode (brand vs life). (1) Plain `?` key opens the Keyboard Shortcuts overlay when focus is not in an input/textarea/contentEditable — familiar convention from GitHub, Linear, Notion. Skips when modifiers are held (so ⌘? / ⌃? combos still belong to the OS) and skips when the shortcuts overlay is already open or the search modal is up so we never stack overlays. (2) The ⌘K Universal Search input now has a richer placeholder — "Search, ask, or try `help`, `brilli firefly`, `split-pane`, `add goal …`" — that broadcasts the new command aliases on first encounter so users learn them while they search. The `?` shortcut is also listed in the Focus / Universal section of the overlay itself. (1) New `window.showShortcutsOverlay()` opens a single-panel modal listing every Brilliance shortcut + power-user command — Brilli (⌘⌥B + Settings → Appearance), Studio (⌘⌥P), Focus / Universal (⌘⇧F, ⌘K, Esc), and ten ⌘K command examples (`brilli firefly`, `cycle brilli`, `split-pane`, `customize concierge`, `reset prefs`, `what's new`, `new email to {name}`, `run {automation}`, `open {view}`, `add goal {text}`). Same Georgia serif eyebrow + monogram disc header pattern as the What's New modal so the two feel like a pair, with light-mode and dark-mode treatments. (2) Four new ⌘K command aliases in `searchActions()`: `help` / `shortcuts` / `?` opens the new shortcuts overlay; `what's new` / `changelog` / `release notes` / `news` opens the existing What's New modal directly; `reset prefs` / `reset preferences` calls `resetBrilliancePrefs()` directly; `concierge` / `customize concierge` opens the customizer. Each alias is a discoverability shortcut for functions that already exist but were buried in Settings. (1) Outbox pill — counts pending Mail outbox items in `roweos_mail_outbox` (anything not `sent` / `failed` / `cancelled`). High-signal: reminds you when sends are queued but haven't fired. Tap routes to Mail. (2) Notebooks pill — counts entries in `roweos_scribe_notebooks` whose `_modifiedAt` / `updatedAt` / `createdAt` is newer than `roweos_scribe_last_seen`, mirroring the v34.15 Bloom pattern. New `markScribeViewed()` in 28-reminders-notifications.js + a hook in `showView('scribe')` clears the badge when the user opens Notebooks. Both pill types are listed in the Customize Concierge modal so users can toggle them like the original seven, and both honor the existing `_conciergePillEnabled(key)` gate. The v34.5 customizer modal automatically picks them up — no separate UI work. The v34.13 wiring assumed `roweos_bloom_library` was a flat array of items with a `.read` flag — actually it's `{scope: [items]}` (e.g. `{ "brand_0": [...], "life_0": [...] }`) and items don't track read state at all, so the `Array.isArray(bl) && bl.some(...)` check always fell through to false and the dot never lit up. Replaced with an Automations-pattern "new since last viewed" check using a new `roweos_bloom_last_seen` localStorage key. The badge logic now walks every scope's items and flags hasUnread if any item's `_modifiedAt` / `savedAt` / `createdAt` is newer than the saved timestamp. Added `markBloomViewed()` (mirror of `markAutomationsViewed`) that stamps the key and clears the badge, and wired it to `showView('bloom')` in 11-agents.js so opening Bloom dismisses the dot. Concierge "Bloom" pill in 00-api-bridge.js will get a parallel fix in a follow-up — for now the sidebar badge has correct semantics. The `resetBrilliancePrefs()` power-user reset has existed since v33.49 but was console-only — anyone who wanted to undo every Brilliance flag (Brilli form + intensity, Evolve / Quiz / Verifier engine flags, Concierge dismiss state, Sync v5 flags, Focus Mode disabled, Letter Series, Tier 2 surface toggles, What's New silenced, etc.) had to know the global. New Settings row immediately below "Customize Concierge" calls it directly. Same `confirm()` flow + same explicit "Your data is unaffected" copy in the modal so users feel safe; row description mirrors that promise. Reuses the existing chevron / row-icon styling pattern with a counter-clockwise refresh arrow icon to match the "reset" verb. The existing `updateSidebarBadges()` (in 28-reminders-notifications.js) only managed Automations and Mail — Pulse and Bloom had no live indicator that anything new was waiting. Added two `<span class="nc-badge">` markers (#ncBadgePulse, #ncBadgeBloom) to the corresponding nav items in 04-views-batch3.html (alongside the existing Thought Board pin-count + Automations completion-dot pattern) and extended `updateSidebarBadges()` with two new branches: Pulse turns on when there are ANY open (non-completed, non-archived) `roweos_pulse_goals` OR any due `roweos_reminders` (matches the concierge row's "Pulse" pill logic so they feel coherent); Bloom turns on when any item in `roweos_bloom_library` has `read !== true`. Counts already refresh on auth, on Automations init, and on the existing 60s interval, so the new badges piggyback on that lifecycle without new timers. No CSS work — reuses the established `.nc-badge.has-unread` styling. Three new patterns in `searchActions()` (27-launch-brandai.js): (1) "brilli celestial" / "set brilli to firefly" / "switch form to aura" / "use classic blake" / "change brilli to signature" — each maps to an `action` that calls `Brilli.setActiveForm(target)`. The keyword map covers every form's primary name plus shortcuts (field → aura, light → signature, blake → classic) so users can find them by partial recall. (2) "cycle brilli" / "cycle brilli form" / "cycle form" — runs the same celestial → aura → firefly → signature → classic → celestial loop the v34.9 ⌘⌥B shortcut does, but discoverable via search. (3) "split-pane" / "toggle split-pane" / "studio split-pane" — switches to Studio if not already there, then toggles the v34.11 split-pane workspace. Result desc copy includes the keyboard shortcut hint so users learn the keystroke version while they discover the command. Same `searchActions` results format as the existing email/automation/goal patterns. (1) ⌘ ⌥ P / Ctrl + Alt + P toggles the Studio Split-Pane workspace, but ONLY when the Studio view is the visible panel — keeps the keystroke from interfering with other surfaces. Wired in 44-split-pane.js with the same input/textarea/contentEditable focus-skip guard as the Brilli shortcut. Reuses the existing `toggle()` so the toast confirmation and persistence (`roweos_studio_split_pane`) stay consistent. (2) The sidebar version label (`#sidebarVersionDisplay`) is now a button — clicking it opens the What's New modal directly with the current `ROWEOS_VERSION`, no more hunting through Settings → System. Tooltip "What's new in this version" surfaces the gesture, keyboard accessible via Enter / Space. The hardcoded item list in `showWhatsNewModal()` was still telling the v33.50→v33.80 story (Focus Mode, Time Ribbon, Letter Series, Folio, Thought Board, Calendar restoration, light-mode deepening) — none of that is news to anyone on v34. Replaced with eight v34.x highlights: the RoweOS → Brilliance rebrand, Brilli as a face for the AI, the new ⌘⌥B form-cycle shortcut + chip strip, the Concierge customizer, the redesigned welcome screens, Studio Split-Pane, and the Email Admin "+ Add Person" / Brilliance Transition flow. The header circle is now the gold monogram disc with bloom halo (graceful fallback to the old radial gradient if the image can't load) so the modal opens with the same visual signature as the splash + welcome modal + restore prompt. Mobile polish: the v34.9 chip strip in Settings now flex-wraps to horizontal-scroll on narrow viewports (instead of awkwardly bumping into a second row), with the WebKit scrollbar hidden, a subtle hover lift, and light-mode contrast overrides matching the rest of v34.x. Two new affordances on top of the v34.6 preview-dot work. (1) Keyboard shortcut — `⌘ ⌥ B` on Mac or `Ctrl+Alt+B` elsewhere — cycles the Brilli form (celestial → aura → firefly → signature → classic → celestial). Wired in 34-brilli.js with an early-return for input/textarea/contentEditable focus so it never hijacks typing. Toast confirms the new form (already part of the existing `setActiveForm` flow). (2) Inline form chip strip in Settings → Appearance, immediately below the Brilli Form row. Five mini-orb chips (each painted with the same gradient/glow as their full form) act as one-tap shortcuts so users don't have to open the picker modal. The active chip gets a gold-tinted background + accent border that updates on every form change via the same `brilli:form-changed` listener that paints the preview dot. The Brilli Form row label now also includes a quiet "⌘ ⌥ B to cycle" keyboard hint to surface the new shortcut. Two missing pieces: the bulk-send dropdown in `src/html/brand/25-admin.html` had no `brilliance_transition` option (only Quick Actions buttons did), AND the server template router in `api/send-template-email.js` had no case for it (returned `null`, the request would 200 but never deliver). Added the option to BOTH the admin dropdown and the composer modal dropdown in `27-modals.html`, and added a server `buildBrillianceTransition()` builder that mirrors the client `generateBrillianceTransitionEmail()` — same body structure, same inline SVG provider cards (Anthropic / Gemini / OpenAI marks copied verbatim), same gold gradient "Get API Keys" CTA, same trackedUrl tracking. New "Send Test to Me" button next to "Send to Selected" in the admin email management bar so admins can preview a real send (resend pipeline, monogram image fetch, dark-mode rendering) before launching the bulk send. Onboarding "Welcome to the Brilliance Beta" step retitled to "Welcome to Brilliance." with italic gold accent and a bloom-haloed monogram disc replacing the abstract triangle stack — matches the launch / restore prompt aesthetic. Two remaining "Beta key access" lines in the sidebar onboarding API-key panel rewritten to "if you'd rather we provision a key for you" since the public beta is over. The client-preview emails (`_emailPreviewWrap()`) and the Brilliance Transition email already used the new gold monogram + italic accents from v33.98 / v34.2 / v34.3, but the server-side path (`api/send-template-email.js` `wrapEmail()` and `api/notify-signup.js` welcome + admin-notification + `api/stripe-webhook.js` access-key + API-key delivery emails) still rendered "RoweOS" text in the header with the old `https://roweos.com/logo.png` logo file. Updated all of them: monogram-circle.png with bloom halo as the header (same image and aesthetic as the launch splash + transition email), removed the duplicate `<h1>Brilliance</h1>` wordmark (the monogram already contains it), added the BRILLIANCE eyebrow + italic Georgia tagline pattern, switched body bg from `#1a1a1a` flat to the warm `#14110d` deep with rgba gold borders, primary CTAs use the gold gradient (`#d4b87f → #b8975f` on `#1a1610` text), secondary CTAs use the gold-outline pattern. Send aliases switched from `RoweOS <roweos@therowecollection.com>` to `Brilliance <roweos@therowecollection.com>` and subject lines flipped from "Welcome to RoweOS" / "New RoweOS Signup" to the Brilliance equivalents (server logs `email_log` template subject too). Also updated the inline admin-notification email header text from `RoweOS` to `Brilliance` and the footer attribution line. No client-side code changes; this is purely a server-output refresh so all transactional + lifecycle emails finally read consistent with the rest of v34.x.
var ROWEOS_DATA_VERSION_KEY = 'roweos_data_version';
var ROWEOS_UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/YOUR-REPO/roweos-updates/main/latest-version.json';
var ROWEOS_LAST_UPDATE_CHECK = 'roweos_last_update_check';

// User data keys (v4.8.0 standardized)
var USER_DATA_KEYS = {
  brands: 'roweos_user_brands',
  brandSettings: 'roweos_user_brand_settings',
  apiKeys: 'roweos_api_keys',
  onboardingCompleted: 'roweos_onboarding_completed',
  dataVersion: 'roweos_data_version',
  welcomed: 'roweos_welcomed',
  fileLibrary: 'roweos_user_library',
  promptLibrary: 'roweos_prompt_library',
  brandMemory: 'roweos_brand_memory',
  tourCompleted: 'roweos_tour_completed'
};

// v25.1: Write-through sync primitives
// Global Firestore reference (lazy-init)
var _dbRef = null;
function getDB() {
  if (!_dbRef && typeof firebase !== 'undefined' && firebase.firestore) {
    _dbRef = firebase.firestore();
  }
  return _dbRef;
}

// Sync mode check - shared by all write functions
function isLocalOnlyMode() {
  var mode = 'hybrid';
  try { mode = (JSON.parse(localStorage.getItem('roweos_sync_settings') || '{}')).syncMode || 'hybrid'; } catch(e) {}
  return (mode === 'perfect_local' || mode === 'local');
}

// Core write-through primitive: writes to Firestore immediately (non-blocking)
// Falls back to pending-writes queue if not signed in
// category (optional via options.category): shouldSyncCategory key (e.g. 'goals', 'automations')
function writeDB(docPath, data, options) {
  var db = getDB();
  if (!db) return;
  if (isLocalOnlyMode()) return;
  var writeOpts = options || {};
  if (writeOpts.category && typeof shouldSyncCategory === 'function' && !shouldSyncCategory(writeOpts.category)) return;

  if (!firebaseUser) {
    _queuePendingWrite(docPath, data, writeOpts);
    return;
  }

  var basePath = 'roweos_users/' + firebaseUser.uid;
  var fullPath = basePath + '/' + docPath;
  stampLocalSave();

  try {
    if (writeOpts.merge !== false) {
      db.doc(fullPath).set(data, { merge: true }).then(function() {
        if (ROWEOS_DEBUG) console.log('[WriteDB] ' + docPath + ' synced');
        // v28.4: Stamp last sync time on successful write-through
        var _now = new Date().toLocaleString();
        localStorage.setItem('roweos_last_sync', _now);
        localStorage.setItem('roweos_last_sync_device', typeof getDeviceType === 'function' ? getDeviceType() : 'unknown');
        updateSyncIndicator('connected');
        if (writeOpts.onSuccess) writeOpts.onSuccess();
      }).catch(function(err) {
        console.warn('[WriteDB] ' + docPath + ' failed:', err.message);
        updateSyncIndicator('error');
        if (writeOpts.onError) writeOpts.onError(err);
      });
    } else {
      db.doc(fullPath).set(data).then(function() {
        if (ROWEOS_DEBUG) console.log('[WriteDB] ' + docPath + ' synced');
        updateSyncIndicator('connected');
        if (writeOpts.onSuccess) writeOpts.onSuccess();
      }).catch(function(err) {
        console.warn('[WriteDB] ' + docPath + ' failed:', err.message);
        updateSyncIndicator('error');
        if (writeOpts.onError) writeOpts.onError(err);
      });
    }
  } catch(e) {
    console.warn('[WriteDB] Error writing ' + docPath + ':', e.message);
    if (writeOpts.onError) writeOpts.onError(e);
  }

  // v28.0: Dual-write to v4 namespace.
  // v34.68: Phase D retirement gate. Once admin flips v4Retired=true after the
  // 30-day Phase D observation window, this block is skipped — v5 alone runs.
  var _v4IsRetired = (typeof window !== 'undefined' && window.SyncV5 && typeof window.SyncV5.v4Retired === 'function' && window.SyncV5.v4Retired());
  if (!_v4IsRetired && typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try {
      var _v4Map = {
        'profile/main': 'settings/main',
        'profile/userContact': 'settings/main',
        'profile/customAgents': 'settings/main',
        'profile/customOps': 'settings/main',
        'profile/clients': 'clients/main',
        'profile/socialPosts': 'social_posts/main',
        'profile/socialWorkflows': 'social_workflows/main',
        'profile/notifications': 'settings/notifications',
        'profile/researchHistory': 'settings/main',
        'profile/mail': 'settings/mail',
        'profile/people': 'settings/people',
        'profile/reminders': 'settings/main',
        'profile/inventory': 'settings/main',
        'profile/generatedBrandOps': 'settings/main',
        'conversations/current': 'conversations/current',
        'conversations/history': 'conversations/history',
        'conversations/agentHistory': 'agent_history/main',
        'pulse/main': 'pulse/main', // v29.3: pulse/main no longer carries goals
        'library/brand': 'library/brand',
        'library/life': 'library/life',
        'folio/main': 'folio/main',
        'lifeAI/main': 'life_settings/main'
      };
      var _v4Target = _v4Map[docPath];
      if (_v4Target) {
        var _v4Parts = _v4Target.split('/');
        var _v4Collection = _v4Parts[0];
        var _v4DocId = _v4Parts[1];
        syncEngine.write(_v4Collection, _v4DocId, data);
      }
    } catch (_v4e) {
      console.warn('[WriteDB] v4 dual-write failed for', docPath, ':', _v4e.message);
    }
  }

  // v34.66: Sync v5 mirror. No-op when the roweos_sync_v5_dual_write flag is off
  // (it is OFF by default; admin opt-in via Settings → Sync v5 Preview). When ON,
  // every writeDB call also lands in a v5 envelope-shaped cache + cloud, so the
  // 14-day zero-discrepancy clock from docs/brilliance/16-sync-v5.md can begin.
  // v34.67: target collection names now match V5_REGISTRY in 35-sync-v5.js so
  // every writeDB call lands in a registered Collection (with explicit firestorePath
  // and localStorageKey), not an auto-created passive one. Single source of truth.
  if (typeof window !== 'undefined' && typeof window.SyncV5 !== 'undefined' && typeof window.SyncV5.mirrorV4Write === 'function') {
    try {
      var _v5Map = {
        'profile/main':              { collection: 'profile_main',              id: 'main' },
        'profile/userContact':       { collection: 'profile_userContact',       id: 'main' },
        'profile/customAgents':      { collection: 'profile_customAgents',      id: 'main' },
        'profile/customOps':         { collection: 'profile_customOps',         id: 'main' },
        'profile/clients':           { collection: 'profile_clients',           id: 'main' },
        'profile/socialPosts':       { collection: 'profile_socialPosts',       id: 'main' },
        'profile/socialWorkflows':   { collection: 'profile_socialWorkflows',   id: 'main' },
        'profile/notifications':     { collection: 'profile_notifications',     id: 'main' },
        'profile/researchHistory':   { collection: 'profile_researchHistory',   id: 'main' },
        'profile/mail':              { collection: 'profile_mail',              id: 'main' },
        'profile/people':            { collection: 'profile_people',            id: 'main' },
        'profile/reminders':         { collection: 'profile_reminders',         id: 'main' },
        'profile/inventory':         { collection: 'profile_inventory',         id: 'main' },
        'profile/generatedBrandOps': { collection: 'profile_generatedBrandOps', id: 'main' },
        'conversations/current':     { collection: 'conversations_v5',          id: 'current' },
        'conversations/history':     { collection: 'conversations_v5',          id: 'history' },
        'conversations/agentHistory':{ collection: 'conversations_v5',          id: 'agentHistory' },
        'pulse/main':                { collection: 'pulse_v5',                  id: 'main' },
        'library/brand':             { collection: 'library_brand_v5',          id: 'main' },
        'library/life':              { collection: 'library_life_v5',           id: 'main' },
        'folio/main':                { collection: 'folio_v5',                  id: 'main' },
        'lifeAI/main':               { collection: 'lifeAI',                    id: 'main' },
        'scribe/main':               { collection: 'scribe_v5',                 id: 'main' }
      };
      var _v5Target = _v5Map[docPath];
      if (_v5Target) {
        window.SyncV5.mirrorV4Write(_v5Target.collection, _v5Target.id, data);
      }
    } catch (_v5e) {
      // Mirror is best-effort; it must never break a v4 write.
      if (typeof ROWEOS_DEBUG !== 'undefined' && ROWEOS_DEBUG) {
        console.warn('[WriteDB] v5 mirror failed for', docPath, ':', _v5e.message);
      }
    }
  }
}

// Write to a subcollection document (e.g., /automations/{id})
function writeDBDoc(collectionPath, docId, data, category) {
  var db = getDB();
  if (!db) return;
  if (isLocalOnlyMode()) return;
  if (category && typeof shouldSyncCategory === 'function' && !shouldSyncCategory(category)) return;

  if (!firebaseUser) {
    _queuePendingWrite(collectionPath + '/' + docId, data, { category: category });
    return;
  }

  var basePath = 'roweos_users/' + firebaseUser.uid;
  stampLocalSave();
  try {
    db.doc(basePath + '/' + collectionPath + '/' + docId).set(data, { merge: true }).then(function() {
      if (ROWEOS_DEBUG) console.log('[WriteDB] ' + collectionPath + '/' + docId + ' synced');
    }).catch(function(err) {
      console.warn('[WriteDB] ' + collectionPath + '/' + docId + ' failed:', err.message);
    });
  } catch(e) {
    // v34.107: was empty catch - silent failure on synchronous Firestore set throws
    // (very rare but possible during init or after auth state change)
    console.warn('[WriteDB] sync set threw for ' + collectionPath + '/' + docId + ':', e && e.message);
  }
  // v28.0: Dual-write to v4
  // v34.68: Phase D retirement gate.
  var _v4Ret = (typeof window !== 'undefined' && window.SyncV5 && typeof window.SyncV5.v4Retired === 'function' && window.SyncV5.v4Retired());
  if (!_v4Ret && typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try { syncEngine.write(collectionPath, docId, data); } catch(_v4e) {
      // v34.107: was empty catch - log so v4 mirror failures surface for debugging
      console.warn('[WriteDB] v4 mirror failed for ' + collectionPath + '/' + docId + ':', _v4e && _v4e.message);
    }
  }
  // v34.66: Sync v5 mirror for subcollection writes. Same gate (no-op when
  // dual-write flag is off). v34.67: subcollection name → registered v5 name.
  if (typeof window !== 'undefined' && typeof window.SyncV5 !== 'undefined' && typeof window.SyncV5.mirrorV4Write === 'function') {
    try {
      var _subMap = {
        'brands':        'brands_v5',
        'conversations': 'conversations_v5',
        'chats':         'conversations_v5',  // v30.3 single-chat docs
        'automations':   'automations_v5',
        'reminders':     'reminders_v5',
        'pulse':         'pulse_v5',
        'pulse_goals':   'pulse_v5',          // v29.3 per-goal docs
        'scribe':        'scribe_v5',
        'mail':          'mail_v5',
        'journal':       'journal_v5',
        'folio':         'folio_v5',
        'library':       'library_brand_v5',  // brand-side library default; life-side calls writeDBDoc('library_life',...)
        'library_life':  'library_life_v5',
        'agent_history': 'conversations_v5'   // v22.x agent history rolls into conversations_v5
      };
      var _v5Coll = _subMap[collectionPath] || collectionPath;
      window.SyncV5.mirrorV4Write(_v5Coll, docId, data);
    } catch(_v5e) {}
  }
}

// v30.3: Write a single chat entry as its own Firestore doc
function writeDBChat(cmd) {
  if (!cmd || !cmd.id || cmd.preliminary) return;
  try {
    var cleanDoc = typeof sanitizeChatEntry === 'function' ? sanitizeChatEntry(cmd) : cmd;
    writeDBDoc('chats', String(cmd.id), cleanDoc, 'brandai_chats');
  } catch(e) {
    console.warn('[writeDBChat] Error:', e);
  }
}

// Delete a subcollection document
function deleteDBDoc(collectionPath, docId, category) {
  var db = getDB();
  if (!db) return;
  if (isLocalOnlyMode()) return;
  if (category && typeof shouldSyncCategory === 'function' && !shouldSyncCategory(category)) return;

  if (!firebaseUser) {
    _queuePendingWrite(collectionPath + '/' + docId, null, { action: 'delete', category: category });
    return;
  }

  var basePath = 'roweos_users/' + firebaseUser.uid;
  stampLocalSave();
  try {
    db.doc(basePath + '/' + collectionPath + '/' + docId).delete().then(function() {
      if (ROWEOS_DEBUG) console.log('[WriteDB] Deleted ' + collectionPath + '/' + docId);
    }).catch(function(err) {
      console.warn('[WriteDB] Delete ' + collectionPath + '/' + docId + ' failed:', err.message);
    });
  } catch(e) {}
  // v28.0: Dual-write delete to v4
  // v34.68: Phase D retirement gate.
  var _v4DelRet = (typeof window !== 'undefined' && window.SyncV5 && typeof window.SyncV5.v4Retired === 'function' && window.SyncV5.v4Retired());
  if (!_v4DelRet && typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try { syncEngine.delete(collectionPath, docId); } catch(_e) {}
  }
  // v34.66: Sync v5 tombstone mirror. Sets _deletedAt envelope on the v5 cache so
  // a future v5 cutover sees the deletion as authoritative (per spec §6 tombstones).
  // v34.67: subcollection name → registered v5 name.
  if (typeof window !== 'undefined' && typeof window.SyncV5 !== 'undefined' && typeof window.SyncV5.mirrorV4Write === 'function') {
    try {
      var _delSubMap = {
        'brands':        'brands_v5',
        'conversations': 'conversations_v5',
        'chats':         'conversations_v5',
        'automations':   'automations_v5',
        'reminders':     'reminders_v5',
        'pulse':         'pulse_v5',
        'pulse_goals':   'pulse_v5',
        'scribe':        'scribe_v5',
        'mail':          'mail_v5',
        'journal':       'journal_v5',
        'folio':         'folio_v5',
        'library':       'library_brand_v5',
        'library_life':  'library_life_v5',
        'agent_history': 'conversations_v5'
      };
      var _v5DelColl = _delSubMap[collectionPath] || collectionPath;
      window.SyncV5.mirrorV4Write(_v5DelColl, docId, { __v5_tombstone: true, _deletedAt: Date.now() });
    } catch(_v5e) {}
  }
}

// v25.1: Write single automation to Firestore
function writeDBAutomation(auto) {
  if (!auto || !auto.id) return;
  if (!shouldSyncCategory('automations')) return;
  // v25.2: Stamp _modifiedAt for merge support
  // v28.4: Always update _modifiedAt so lastRun changes win in mergeByTimestamp across devices
  auto._modifiedAt = Date.now();
  // Deep-strip base64 data URLs (matches syncToFirebaseV2 regex approach for nested content)
  var dataStr = JSON.stringify(auto);
  dataStr = dataStr.replace(/"data:[^"]{50000,}"/g, '""');
  var data = JSON.parse(dataStr);
  data.updatedAt = new Date().toISOString();
  writeDBDoc('automations', String(auto.id), data);
}

// v25.1: Write-through helpers for todos and calendar
// Uses single-document pattern to avoid orphan docs on deletion
// v29.1: Uses merge:false so cloud array is fully replaced (prevents zombie resurrection)
function writeDBTodos() {
  var todosData = [];
  // v33.63: getTodosKey was removed in v28.8 Focus retirement; defensive fallback.
  var _todosKey = (typeof getTodosKey === 'function') ? getTodosKey() : 'roweosTodos';
  try { todosData = JSON.parse(localStorage.getItem(_todosKey) || '[]'); } catch(e) {}
  writeDB('todos/main', { data: todosData }, { category: 'brand_todos', merge: false });
  // v29.1: Clean up orphaned V4 individual docs that no longer exist locally
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try {
      // Build set of current todo IDs
      var _currentIds = {};
      for (var _ti = 0; _ti < todosData.length; _ti++) {
        var _todo = todosData[_ti];
        var _tid = String(_todo.id || ('todo_' + Date.now() + '_' + _ti));
        _todo.id = _tid;
        _currentIds[_tid] = true;
        syncEngine.write('todos', _tid, _todo);
      }
      // Delete V4 docs for todos that were removed locally
      var db = getDB();
      if (db && firebaseUser) {
        var _todosPath = 'roweos_users/' + firebaseUser.uid + '/todos';
        db.collection(_todosPath).get().then(function(snap) {
          snap.forEach(function(doc) {
            if (doc.id !== 'main' && !_currentIds[doc.id]) {
              doc.ref.delete().then(function() {
                if (typeof ROWEOS_DEBUG !== 'undefined' && ROWEOS_DEBUG) console.log('[WriteDB] Cleaned orphan todo doc:', doc.id);
              }).catch(function() {});
            }
          });
        }).catch(function() {});
      }
    } catch(_v4e) {}
  }
}

function writeDBCalendar() {
  var calData = [];
  try { calData = JSON.parse(localStorage.getItem(getCalendarKey()) || '[]'); } catch(e) {}
  writeDB('calendar/main', { data: calData }, { category: 'calendar' });
  // v28.0: Write individual calendar docs to v4
  if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
    try {
      for (var _ci = 0; _ci < calData.length; _ci++) {
        var _evt = calData[_ci];
        var _eid = String(_evt.id || ('cal_' + Date.now() + '_' + _ci));
        _evt.id = _eid;
        syncEngine.write('calendar', _eid, _evt);
      }
    } catch(_v4e) {}
  }
}

// v25.0: Write-through for conversations (deferred 5s after last message to avoid spam during active chat)
var _convSyncTimer = null;
function writeDBConversations() {
  if (_convSyncTimer) clearTimeout(_convSyncTimer);
  _convSyncTimer = setTimeout(function() {
    _convSyncTimer = null;
    if (!shouldSyncCategory('conversations')) return;
    if (typeof collectConversationsWithLimit !== 'function') return;
    var convData = collectConversationsWithLimit();
    if (convData.current && convData.current.messages && convData.current.messages.length > 0) {
      writeDB('conversations/current', convData.current);
    }
    if (convData.historyJson) {
      try {
        var histCheck = JSON.parse(convData.historyJson);
        if (Array.isArray(histCheck) && histCheck.length > 0) {
          writeDB('conversations/history', { json: convData.historyJson });
        }
      } catch(e) {
        writeDB('conversations/history', { json: convData.historyJson });
      }
    }
    if (convData.agentHistoryJson) {
      writeDB('conversations/agentHistory', { json: convData.agentHistoryJson });
    }
    // v30.3: Write last non-preliminary chat as individual doc
    if (typeof writeDBChat === 'function' && agentCommands && agentCommands.length > 0) {
      var _lastCmd = agentCommands[agentCommands.length - 1];
      if (_lastCmd && !_lastCmd.preliminary) {
        writeDBChat(_lastCmd);
      }
    }
  }, 5000);
}

// v25.0: Pending writes queue -- stores writes when user is not signed in
function _queuePendingWrite(docPath, data, options) {
  try {
    var queue = JSON.parse(localStorage.getItem('roweos_pending_writes') || '[]');
    queue.push({
      path: docPath,
      data: data,
      options: options || {},
      timestamp: Date.now()
    });
    if (queue.length > 500) queue = queue.slice(-500);
    localStorage.setItem('roweos_pending_writes', JSON.stringify(queue));
  } catch(e) { console.warn('[WriteDB] Queue write failed:', e.message); }
}

// Flush pending writes on sign-in
function flushPendingWrites() {
  if (!firebaseUser) return;
  var queue = [];
  try { queue = JSON.parse(localStorage.getItem('roweos_pending_writes') || '[]'); } catch(e) {}
  if (queue.length === 0) return;

  console.log('[Sync V3] Flushing ' + queue.length + ' pending writes');
  var db = getDB();
  if (!db) return;
  var basePath = 'roweos_users/' + firebaseUser.uid;

  // v30.1: Collect batch commit promises so we only clear pending writes after all resolve
  var commitPromises = [];
  var batch = db.batch();
  var batchCount = 0;
  queue.forEach(function(entry) {
    if (entry.options && entry.options.category && typeof shouldSyncCategory === 'function') {
      if (!shouldSyncCategory(entry.options.category)) return;
    }
    var fullPath = basePath + '/' + entry.path;
    try {
      var ref = db.doc(fullPath);
      if (entry.options && entry.options.action === 'delete') {
        batch.delete(ref);
      } else if (entry.data) {
        batch.set(ref, entry.data, { merge: true });
      }
      batchCount++;
      if (batchCount >= 499) {
        commitPromises.push(batch.commit());
        batch = db.batch();
        batchCount = 0;
      }
    } catch(e) {}
  });
  if (batchCount > 0) {
    commitPromises.push(batch.commit());
  }

  // v30.1: Only clear pending writes after all batch commits resolve
  Promise.all(commitPromises).then(function() {
    localStorage.removeItem('roweos_pending_writes');
  }).catch(function(e) {
    console.warn('[Sync V3] Some batch flushes failed, retaining pending writes:', e.message);
  });
}

// v25.0: One-time migration from V2 push/pull to V3 write-through
// CRITICAL: This must preserve all existing user data -- zero data loss
// v25.0: One-time migration from V2 push/pull to V3 write-through
// v25.2: DISABLED -- migration push was a resurrection vector.
// Each device independently re-uploaded stale local data, resurrecting items
// deleted on other devices. Cloud-authoritative model means cloud has truth;
// no local-to-cloud push is needed on migration.
function migrateToSyncV3() {
  if (!localStorage.getItem('roweos_sync_v3_migrated')) {
    localStorage.setItem('roweos_sync_v3_migrated', 'true');
    console.log('[Sync V3.1] Migration flag set (cloud-authoritative, no push needed)');
  }
}

// v25.0: Startup reconciliation -- compare local timestamps with Firestore
// v25.2: Startup reconciliation -- always pull from cloud (cloud-authoritative)
function reconcileOnStartup() {
  if (!firebaseUser) return;
  // v27.1: Skip cloud pull while onboarding is in progress -- freshly created
  // profiles haven't reached Firestore yet, so cloud-authoritative merge would
  // discard them. reconcileOnStartup will run naturally on next app load.
  if (window._onboardingInProgress || localStorage.getItem(USER_DATA_KEYS.onboardingCompleted) !== 'true') {
    console.log('[Sync V3.1] Startup -- SKIPPED (onboarding in progress)');
    return;
  }
  // v25.2: Always pull from cloud on startup. Cloud is the single source of truth.
  // The V2-era timestamp comparison was unreliable and the "local cache is current"
  // early exit prevented pulling authoritative cloud data after cross-device deletions.
  console.log('[Sync V3.1] Startup -- pulling from cloud (cloud-authoritative)');
  if (typeof loadFromFirebaseV2 === 'function') {
    loadFromFirebaseV2().then(function() {
      localStorage.setItem('roweos_first_sync_completed', 'true');
      localStorage.setItem('roweos_last_sync', String(Date.now()));
      // v28.2: Re-check API keys after cloud pull - keys may have been synced from Firestore
      if (typeof checkApiConnection === 'function') checkApiConnection(true);
      if (typeof updateProviderStatuses === 'function') updateProviderStatuses();
      // v32.1: auto-purge removed (had false-positive bug). Self-heal stale
      // tombstones + start convergence loop instead.
      // v32.1.1: force-align from cloud first (cloud-newer overrides stale local).
      if (typeof forceAlignFromCloud_v321 === 'function') {
        try { forceAlignFromCloud_v321().catch(function(){}); } catch(e){}
      }
      if (typeof selfHealStaleTombstones_v321 === 'function') {
        try { selfHealStaleTombstones_v321().catch(function(){}); } catch(e){}
      }
      if (typeof startConvergenceLoop_v321 === 'function') {
        try { startConvergenceLoop_v321(); } catch(e){}
      }
    });
  }
}

// v25.2: Timestamp-aware merge for array-based data
// Cloud is authoritative baseline. Local items only win if _modifiedAt is newer.
// Items that exist locally but NOT in cloud are treated as DELETED (not resurrected),
// UNLESS created after last successful sync (genuinely new offline items).
// REQUIRES: all items must have a stable id field.
// v27.3: Normalize _modifiedAt to numeric ms (handles ISO strings from Firestore and numeric from localStorage)
function _normalizeTs(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    var parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

