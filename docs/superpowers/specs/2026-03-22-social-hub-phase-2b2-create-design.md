# Social Hub Phase 2B-2: Create Tab (AI Chat + DMs)

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Build the Create tab with two sub-tabs: AI chat for crafting social posts (with quick actions and image generation) and a DMs inbox for X and Instagram direct messages.

---

## Design

### 1. Sub-tab Structure

Two sub-tabs within the Create tab:
- **Create** (default) -- AI chat for crafting posts with quick-action buttons
- **DMs** -- Direct messages inbox for X and Instagram

Sub-tab switcher uses pill/toggle buttons (same style as Media tab's Image/Video sub-tabs).

---

### 2. Create Sub-tab: AI Chat for Post Crafting

#### Layout

**Chat thread area (main):**
- Same visual style as BrandAI chat -- message bubbles, user on right, AI on left
- Streaming support for AI responses
- Generated images displayed inline
- Post-worthy AI responses get a "Send to Publish" button

**Quick-action buttons (above input bar):**
- "Generate Post" -- injects prompt: "Create a social media post about: [user's next message]"
- "Generate Image" -- injects prompt: "Generate an image for a social media post about: [user's next message]"
- "Suggest Hashtags" -- injects prompt: "Suggest relevant hashtags for: [user's next message]"
- "Rewrite for X/Threads/Instagram" -- platform-specific rewrites with character limits

**Input bar (bottom):**
- Text input + send button
- Same styling as BrandAI chat input

#### Behavior

- Uses the user's configured AI provider (reads from brand settings -- same routing as BrandAI)
- System prompt scoped to social context: brand voice from current brand's identity + social best practices + platform awareness (character limits, hashtag conventions, engagement tips)
- Chat history persisted in localStorage: `roweos_social_create_chat`
- "Send to Publish" button on AI responses: extracts the post text and any generated images, calls `showSocialPublisher(text)` which navigates to Publish tab with content pre-filled
- "Clear chat" button to reset conversation

#### Functions

- `initCreateChat()` -- load chat history, render thread, set up input handler
- `sendCreateMessage(text)` -- send user message, call AI API, stream response
- `renderCreateThread()` -- render chat messages
- `handleCreateQuickAction(action)` -- inject structured prompt for quick actions
- `sendCreateToPublish(messageIndex)` -- extract content from AI message, send to Publish tab
- `clearCreateChat()` -- clear history and thread

---

### 3. DMs Sub-tab: Direct Messages Inbox

#### Layout

**Platform filter (top):**
- X only for initial release (Instagram DM API requires Meta app review that's impractical for a private tool)

**Conversation list:**
- Each row: avatar placeholder, name/handle, last message preview (truncated), relative timestamp
- Click to open thread
- "Refresh" button to pull latest

**Open thread view:**
- Back button to return to list
- Messages displayed chronologically (incoming left, outgoing right)
- Reply input bar at bottom with send button

#### API Integration

**X DMs:**
- Read: `GET /2/dm_conversations` with `dm_conversations.fields=id` and `GET /2/dm_conversations/:id/dm_events`
- Send: `POST /2/dm_conversations/:id/messages` with `{ text: "..." }`
- Requires OAuth scopes: `dm.read`, `dm.write` (must be added to OAuth flow)
- X API Pro tier ($200/mo) required for DM access
- **CORS:** X API does not allow browser-origin requests. All DM API calls must go through a server-side proxy. Create `/api/x-dm-proxy.js` Vercel serverless function (same pattern as existing `/api/fetch-site-meta.js`) that forwards requests to the X API with the user's OAuth token.
- **Rate limits:** X DM endpoints are heavily rate-limited. Add retry with 1-second backoff on 429 responses. Show "Rate limited, try again shortly" toast.
- **Token expiry:** If X token returns 401, show "X connection expired. Please reconnect in Settings."

**Instagram DMs:** Deferred. Meta's app review process is impractical for a private tool. The DMs sub-tab is X-only for initial release.

#### Graceful Degradation

Both platforms restrict DM API access. The DMs sub-tab must handle unavailability gracefully:
- If X token lacks `dm.read` scope: show "X DMs require elevated API access. Upgrade your X developer account to Pro tier."
- If Instagram not connected or no messaging permission: show "Instagram DMs require a business account with messaging API approval."
- If no DMs available at all: show centered message with links to upgrade paths

#### Functions

- `initDMsTab()` -- check available platforms, load conversation list
- `loadDMConversations(platform)` -- fetch conversations from API
- `openDMThread(conversationId, platform)` -- load and display messages
- `sendDMReply(conversationId, platform, text)` -- send reply
- `renderDMList()` -- render conversation list
- `renderDMThread()` -- render open conversation

#### Data Storage

- DM conversations cached in localStorage: `roweos_social_dms_cache`
- Cache expires after 5 minutes (re-fetch on next open)
- No Firestore persistence for DMs (privacy -- messages stay client-side)

---

### 4. OAuth Scope Updates

The X OAuth flow needs additional scopes for DMs:
- Current scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
- Add: `dm.read`, `dm.write`
- Update `connectX()` in index.html to include DM scopes
- Users will need to re-authorize X connection to get DM access

---

## Files to Modify

| File | Change |
|---|---|
| `RoweOS/dist/index.html` | (1) Replace Create placeholder with sub-tab UI (Create chat + DMs). (2) Add AI chat functions (init, send, render, quick actions, send to publish). (3) Add DMs functions (init, load, open thread, send reply, render). (4) Update `showSocialTab()` to call `initCreateChat()` when `tab === 'create'`. (5) Add `dm.read`/`dm.write` to X OAuth scopes in `connectX()`. |
| `RoweOS/dist/api/x-dm-proxy.js` | **Create:** Server-side proxy for X DM API calls (avoids CORS). Same pattern as `/api/fetch-site-meta.js`. Accepts method, endpoint, token, body. Forwards to X API and returns response. |

---

## Out of Scope

- Blog tab (Phase 2B-3, separate spec)
- Analytics dashboard (Phase 2C)
- DMs for Threads or TikTok (no DM APIs available)
- Push notifications for new DMs
- Read receipts or typing indicators
