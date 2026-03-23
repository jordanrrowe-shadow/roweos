# Social Hub Bugfix Batch -- Design Spec

**Date:** 2026-03-22
**Scope:** 8 bugs + 3 smaller features (help, tour, feedback)
**Approach:** Surgical per-bug fixes, no refactoring, minimal blast radius
**Files affected:** `index.html`, `social-callback.html`, `functions/lib/scavenger.js`, `functions/index.js`

---

## Bug #1: Draft Reply CORS ("Load failed")

**Root cause:** `draftEngageReply()` (~line 175616) calls `https://api.anthropic.com/v1/messages` without the `'anthropic-dangerous-direct-browser-access': 'true'` header. The working `callAnthropicStudio()` (~line 79753) includes this header, which is why BrandAI chat works but Engage drafting fails.

**Fix:**
1. Add `'anthropic-dangerous-direct-browser-access': 'true'` to the Anthropic headers in `draftEngageReply()`
2. Update OpenAI endpoint from `/v1/chat/completions` to `/v1/responses` to match `callStudioAPI`. The `/v1/responses` format uses `{ model, input: [{ role, content }] }` instead of `{ model, messages }`, and the response text is at `response.output[0].content[0].text` (not `choices[0].message.content`)
3. Update OpenAI response parsing accordingly

**Validation:** Draft a reply using Anthropic model, confirm no CORS error. Repeat with OpenAI.

---

## Bug #2: Like Doesn't Show on X

**Root cause:** The like call uses `/2/users/me/likes` but X API v2 does not resolve `/me`. It requires the authenticated user's numeric ID. Additionally, the X OAuth callback in `social-callback.html` calls `/2/users/me` to get the username but does not store the numeric `id` field in the token data.

**Fix:**
1. In `social-callback.html`: after the `/2/users/me` call (~line 408), extract `user.data.id` and store it in the token data object alongside `accessToken`, `refreshToken`, etc. Write it to both localStorage and Firestore token storage
2. In `index.html`: read the X user ID from the stored token data (localStorage key `roweos_social_token_x` + scope, field `userId`)
3. Change the like endpoint from `/2/users/me/likes` to `/2/users/{userId}/likes`
4. The call goes through `x-dm-proxy.js` which already whitelists `/^\/2\/users/` and `/^\/2\/likes/`
5. For existing users who connected before this fix: add a fallback that calls `/2/users/me` via `x-dm-proxy` to fetch and cache the user ID on first like attempt

**Validation:** Re-connect X account, verify userId is stored. Like a post from Engage tab, verify it shows as liked on X.

---

## Bug #3: X Token Disconnected on Reload

**Root cause:** When the page reloads, the Settings tab renders social connection status before `initializeBrands()` completes, so `getSocialKeyScope()` returns incorrect scope (likely `_brand_0` when user was on a different brand, or scope is undefined).

**Fix:**
1. In the Settings social connection status rendering, re-check connection status after brand initialization completes
2. Add a call to refresh social connection indicators when the Settings tab is opened (not just on initial render)
3. Ensure `selectedBrand` (the global variable, not `selectedBrandIdx`) is set from localStorage before any `getSocialKeyScope()` call during page init

**Validation:** Connect X on Brand 1, reload page, navigate to Settings -- should show connected.

---

## Bug #4: Engage Starts Empty by Default

**Root cause:** `initEngageTab()` immediately attaches a Firestore listener that loads all previous targets. There is no way to start with a clean slate.

**Fix:**
1. Remove the automatic Firestore listener attachment from `initEngageTab()`
2. `engageState.targets` starts as `[]` and the feed renders empty with a placeholder message ("Search for posts or load your feed to get started")
3. Add a "Load Feed" button that attaches the Firestore listener and populates targets on demand
4. The search function continues to work as-is (it queries X API directly)
5. Remove `engageState.cleared` logic entirely -- no longer needed
6. Update `searchEngagePosts()`: after a search, if no Firestore listener exists, it should NOT auto-attach one. Search results display directly in the feed from the X API response. The Firestore listener is only attached via the "Load Feed" button.

**Validation:** Reload page, navigate to Engage -- feed is empty. Click "Load Feed" -- targets appear. Search works independently without attaching a listener.

---

## Bug #5: Publish Posts with Empty Content

**Root cause:** Two issues. First, `publishPostNow()` calls `postToSocial(platform, content, { image: _publishAttachedImage })` with 3 arguments, but `postToSocial(platform, opts)` only takes 2 -- the image object is silently dropped. `postToSocial` reads content from `window._socialPublisherContent` and image from `window._socialPublisherImage`, neither of which is set by `publishPostNow()`. Second, `publishPostNow()` has an early-return guard that rejects empty captions, preventing image-only posts.

**Fix:**
1. In `publishPostNow()`, set both `window._socialPublisherContent = caption.value.trim()` and `window._socialPublisherImage = _publishAttachedImage` before calling `postToSocial(platform, { silent: false })` (matching the working 2-arg pattern)
2. Update the early-return guard in `publishPostNow()` to allow posting when either content OR image is present (not require both)
3. In `postToSocial()`, allow posting when `window._socialPublisherImage` is present even if text content is empty
4. Clear both `window._socialPublisherContent` and `window._socialPublisherImage` after posting completes

**Validation:** Attach an image in Publish tab with no caption -- posts successfully. Add caption + image -- posts successfully. Text-only -- posts successfully.

---

## Bug #6: Scavenger Pipeline Diagnostics

**Root cause:** Unknown -- pipeline deploys but doesn't post. No diagnostic logging to determine where it stops.

**Fix:** Add structured diagnostic logging at every decision point in the Cloud Functions pipeline. All logs prefixed with `[Scavenger:{uid_short}]` using `console.log`/`console.warn`/`console.error` (matching existing codebase convention).

Logging points:
1. **`runScheduledTasks` entry:** Log user count, configs found per user
2. **Config validation:** `.warn()` if `cloudSchedulerEnabled` is falsy or missing, log `autoPostThreshold` value
3. **`stepPoll`:** Log keyword query, result count, new targets created
4. **`stepScore`:** Log targets scored, score distribution (min/max/avg)
5. **`stepDraft`:** Log targets eligible for drafting, AI model used, success/failure count
6. **`stepDecide`:** Log auto-approved count, pending-review count, threshold used
7. **`stepPost`:** Log targets ready to post, token present/expired status, rate limit check result (current counts vs limits), actual post attempts and results
8. **Token check in `stepPost`:** `.error()` if X token is missing or expired
9. **Rate limit skip:** `.warn()` with current counts and configured limits when posting is skipped

**Validation:** Deploy Cloud Functions, trigger manually or wait for schedule, check Firebase logs for clear diagnostic trail.

---

## Bug #7: Custom Keyword Category Groupings

### Data Model

Add `keywordGroups` to each Scavenger config document in Firestore (`roweos_users/{uid}/scavenger_configs/{configId}`):

```javascript
{
  // existing fields
  keywords: ['luxury', 'concierge', 'Austin', 'competitor1', 'competitor2'],
  // new field
  keywordGroups: [
    { name: 'Brand', keywords: ['luxury', 'concierge', 'Austin'] },
    { name: 'Competitors', keywords: ['competitor1', 'competitor2'] }
  ]
}
```

- Keywords not in any group remain ungrouped
- Groups are per-config, stored alongside existing config fields
- `keywordGroups` defaults to `[]` (all keywords ungrouped, backward compatible)
- **Cloud Functions note:** The Scavenger pipeline in Cloud Functions always uses ALL keywords from the config regardless of groups. Groups are a client-side UI filter only -- they affect what the user sees and searches for on the Engage tab, not what the automated pipeline polls for

### Engage Tab UI

1. Dropdown selector above keyword pills, default value "All Keywords"
2. Options populated from active config's `keywordGroups` array: "All Keywords" + each group name
3. Selecting a group filters the visible keyword pills to that group's keywords only
4. When user searches, only the selected group's keywords are used in the X API query
5. "All Keywords" uses every keyword (current behavior)

### Settings UI

1. In Scavenger config editor, below keywords input, add "Keyword Groups" section
2. "Add Group" button: creates a new group with empty name and no keywords
3. Each group row: text input for name + multi-select checkboxes of the config's keywords
4. "Remove Group" button per group
5. Groups saved to Firestore with the config on save

---

## Bug #8: Create Chat Uses Brand 0

**Root cause:** Needs investigation during implementation. The global variable is `selectedBrand` (not `selectedBrandIdx`). `_buildCreateSystemPrompt()` may read from `settings.activeBrandIndex` which could be stale or default to 0. The issue manifests as the Create tab AI referencing The Rowe Collection when a different brand is selected.

**Fix:**
1. Investigate `_buildCreateSystemPrompt()` and `_streamCreateResponse()` to find exactly where brand data is read
2. Ensure brand references use `brands[selectedBrand]` (the live global), not `brands[0]` or a stale localStorage value
3. Use `brands[selectedBrand].shortName || brands[selectedBrand].name` per CLAUDE.md convention
4. Check `draftEngageReply()` for the same issue -- if it reads brand data, ensure it uses `selectedBrand`
5. Verify the brand index is synced to `settings.activeBrandIndex` in localStorage when the user switches brands

**Validation:** Switch to Brand 2 (Retreats), open Create tab, send a message -- AI response should reference Rowe Retreats, not The Rowe Collection.

---

## Smaller Item: Help Icon

1. Add a `?` SVG icon button in the Social Hub header bar (right side, before any existing controls)
2. On click, open a modal/overlay with tab descriptions:
   - **Publish:** Post content to your connected social accounts
   - **Engage:** Find and reply to relevant posts in your niche
   - **Create:** AI-powered content drafting and DMs
   - **Blog:** Write and publish blog content with AI assistance
   - **Analytics:** Track post performance and audience insights
   - **Settings:** Connect social accounts and configure automation
3. Dismissible with X button
4. After first dismissal, set `localStorage['roweos_social_help_dismissed'] = 'true'`
5. Help icon always visible; modal just doesn't auto-show after dismissal
6. Include a "Replay Tour" link at the bottom of the help modal (clears `roweos_social_tour_complete` and triggers the tour)

---

## Smaller Item: Guided Tour

1. Triggers after first social account connection in Settings (check: `!localStorage['roweos_social_tour_complete']` AND at least one platform connected)
2. Step-by-step highlight tour with overlay + spotlight cutout on each tab:
   - Step 1: Settings tab -- "Connect your social accounts here"
   - Step 2: Publish tab -- "Post content to all your platforms at once"
   - Step 3: Engage tab -- "Find relevant posts and draft replies"
   - Step 4: Create tab -- "Use AI to craft content and manage DMs"
   - Step 5: Blog tab -- "Write blog posts with AI assistance"
   - Step 6: Analytics tab -- "Track your social performance"
3. Each step: overlay with semi-transparent backdrop, spotlight rectangle on tab, tooltip with description, "Next" / "Skip" buttons
4. On complete or skip: `localStorage['roweos_social_tour_complete'] = 'true'`
5. Implementation: simple JS overlay system (no library), absolutely positioned tooltip, `getBoundingClientRect()` for spotlight positioning

---

## Smaller Item: Feedback Button

1. Small speech-bubble SVG button in Social Hub header (next to help icon)
2. On click, open compact feedback form:
   - Sentiment: thumbs up / thumbs down toggle (SVG icons)
   - Textarea: "What's on your mind?" (4 rows)
   - Submit button
3. On submit, write to Firestore `roweos_feedback` collection:
   ```javascript
   {
     uid: currentUser.uid,
     section: 'social_hub',
     text: feedbackText,
     sentiment: 'positive' | 'negative',
     timestamp: firebase.firestore.FieldValue.serverTimestamp(),
     version: appVersion
   }
   ```
4. Show success toast ("Thanks for the feedback!")
5. Clear and close form after submit
6. Client-side rate limit: store last submission timestamp in localStorage, allow one submission per 60 seconds. Show "Please wait..." if cooldown active

---

## Files Modified

| File | Changes |
|------|---------|
| `RoweOS/dist/index.html` | Bugs #1-5, #7 (UI), #8, help icon, tour, feedback |
| `RoweOS/dist/social-callback.html` | Bug #2 (store X user ID in token data) |
| `functions/lib/scavenger.js` | Bug #6 (diagnostic logging) |
| `functions/index.js` | Bug #6 (entry-point logging) |

## Engage Tab Layout Order

The Engage tab header area (modified by Bugs #4 and #7) uses this layout:
```
[Keyword Group Dropdown] [Keyword Pills row] [Search input + button] [Load Feed button]
```
The group dropdown and keyword pills are on the same row if space allows, otherwise stacked.

## Out of Scope

- No new API proxy endpoints
- No refactoring of `callStudioAPI` vs `draftEngageReply` duplication
- No TikTok integration
- No Instagram DMs (pending Meta app review)
