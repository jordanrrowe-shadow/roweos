# Social Hub Phase 2A: Publish, Media, Settings

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Consolidate existing social features into Social Hub tabs -- move Social Publisher (Publish), Image/Video Lab (Media), and Social Connectors (Settings) into the Social Hub view. Add Imagen 3 and TikTok API integration.

**Phase context:** This is Phase 2A of a 3-phase Social Hub buildout:
- **Phase 2A (this spec):** Publish, Media, Settings -- move existing code
- **Phase 2B:** Scavenger UI, Create (AI chat + DMs), Blog (rich text writer + website analyzer)
- **Phase 2C:** Analytics dashboard (API metrics + AI insights)

---

## Problem Statement

Social features are scattered across the app -- the Social Publisher is a floating modal triggered from Studio/Chat, Image Lab and Video Lab live in Automations, Social Connectors are buried in System Settings. The new Social Hub view has placeholder tabs. Users need a single, consolidated home for all social and content creation features.

---

## Design

### 1. Tab Structure

After Phase 2A, the Social Hub tabs:

| Tab | Status | Content |
|---|---|---|
| Scavenger | Placeholder | "Coming in Phase 2B" with brief description |
| Publish | **New (moved)** | Social Publisher + Outbox |
| Create | Placeholder | "Coming in Phase 2B" with brief description |
| Activity | Done | Scavenger targets with direct links |
| Media | **New (moved)** | Image Lab + Video Lab as sub-tabs |
| Blog | Placeholder | "Coming in Phase 2B" with brief description |
| Analytics | Placeholder | "Coming in Phase 2C" with brief description |
| Settings | **New (moved)** | Social Connectors + Scavenger Configs |

Tab bar is horizontally scrollable on mobile (already has `overflow-x: auto` behavior from the `.social-hub-tabs` CSS).

**Tab changes from current code:**
- Rename existing "Chat" tab to "Create" (update panel ID from `socialTabChat` to `socialTabCreate`, update `showSocialTab('chat')` to `showSocialTab('create')`)
- Add new tabs: Media, Blog, Analytics
- Existing tabs kept: Scavenger, Publish, Activity, Settings

---

### 2. Publish Tab

**Source code:** Social Publisher panel (`showSocialPublisher()`, lines ~103670-104603) and Outbox system (`getSocialOutbox()`, lines ~103907-104017).

#### Layout

**Compose section (top half):**
- Caption textarea with live character counter
- Per-platform character limits: X (280), Threads (500), Instagram (2200), TikTok (2200)
- Platform selector cards in a grid, showing:
  - Platform icon (SVG, not emoji)
  - Connection status (green dot = connected, grey = not connected)
  - @handle if connected
  - Clickable to toggle platform on/off for this post
- Image/video attachment area with drag-drop or file picker
  - Preview thumbnail with remove button
  - Supports base64 from Studio and file uploads
- Per-platform text edit toggle (expand to customize text per platform)
- Action buttons:
  - "Post Now" -- posts to all selected platforms
  - "Schedule" -- opens scheduling UI (date/time picker, creates automation)
  - "Add to Outbox" -- queues for manual approval later

**Outbox section (below compose, collapsible):**
- Header: "Outbox (N pending)" with expand/collapse toggle
- List of queued posts, each showing:
  - Platform badges
  - Content preview (truncated)
  - Image thumbnail if attached
  - Timestamp (when queued)
  - Actions: "Post Now" / "Edit" / "Delete"
- Empty state: "No posts in outbox"

#### Behavior Changes

- `showSocialPublisher(content, platforms)` -- when called from Chat or Studio, navigates to `showView('social')`, switches to Publish tab, pre-fills the compose area with the provided content/platforms. The publisher is currently a panel embedded inside Studio (`#socialPublisherPanel` at line ~51862 inside `studioView`), not a standalone modal.
- Remove the `#socialPublisherPanel` div from Studio HTML (line ~51862-51873)
- Remove `closeSocialPublisher()` (line ~103842) since the panel is no longer closeable -- it's a permanent tab
- Update all call sites that invoke `showSocialPublisher()` (approximately 6 references at lines ~84587, ~96780, ~103670, ~104571, ~104776, and HTML at ~51871) to redirect to `showView('social')` + `showSocialTab('publish')`
- Global state variables `_socialPublisherImage` and `_socialPublisherContent` remain as window-level globals to bridge content from Chat/Studio to the Publish tab
- `formatForPlatform(content, platform)` stays as a global utility (used by Chat social cards too)
- `saveSocialPost()` stays as a global function (called from publisher flow, needs to work regardless of view context)
- Post history renders below the outbox as a recent posts log

#### TikTok Direct Posting

Add TikTok as a fourth posting platform alongside X, Threads, Instagram:

**OAuth flow:**
- TikTok Login Kit (OAuth 2.0) via `https://www.tiktok.com/v2/auth/authorize/`
- Scopes: `user.info.basic`, `video.publish`, `video.upload`
- Token exchange via `/api/social-auth.js` (same pattern as X/Threads/Instagram)
- Tokens stored in `social_tokens` subcollection with key `tiktok{scope}`

**Content Posting API:**
- Endpoint: `POST https://open.tiktokapis.com/v2/post/publish/video/init/`
- Supports: video uploads (required -- TikTok is video-first)
- For image posts: TikTok Photo Mode (carousel) via `POST /v2/post/publish/content/init/` with `photo_images`
- Caption max: 2200 chars
- **Note:** Requires TikTok developer app approval. Show a setup guide in Settings if not yet approved.

**Migration from current "copy + link only" state:**
TikTok already exists in the codebase but is explicitly disabled:
- Line ~56759: shows "Copy + Link only" status
- Line ~56762: `<button disabled>No API Available</button>`
- Line ~103688: `var isApiPlatform = p !== 'tiktok'` -- hardcoded as non-API
- `SOCIAL_PLATFORM_LIMITS` already includes `tiktok: 2200`

Changes needed:
- Remove the `isApiPlatform = p !== 'tiktok'` guard so TikTok is treated as a direct-post platform
- Update the disabled button in Settings HTML to a working Connect/Disconnect button
- Add `'tiktok'` to the platform whitelist in `social-auth.js` (line ~140, currently only accepts `x`, `threads`, `instagram`)
- Add TikTok state detection in `social-callback.html` (lines ~128-142, currently only checks `x`, `threads`, `instagram`)
- Create `connectTikTok()` function (does not exist yet -- follows same pattern as `connectX()`)
- Handle `social_callback=tiktok` query param in the callback flow (line ~72432)

**Platform card in Publish:**
- Same pattern as X/Threads/Instagram cards
- If video attached: direct upload via Content Posting API
- If image only: use Photo Mode API
- If text only: show warning "TikTok requires media (image or video)"

**Social connector in Settings:**
- TikTok card with Connect/Disconnect button
- OAuth flow via `connectTikTok()` function
- Shows @handle when connected
- If developer app not yet approved: show setup guide link

---

### 3. Media Tab

**Source code:** Image Lab (lines ~108073-108253, state at ~81281-81361) and Video Lab (lines ~109070-109167).

#### Layout

Two sub-tabs within the Media tab:
- **Image** (default) -- the existing Image Lab chat interface
- **Video** -- the existing Video Lab chat interface

Sub-tab switcher uses a simple pill/toggle at the top of the panel, styled like the Scavenger filter buttons.

#### Image Sub-Tab (moved from Automations)

All existing functionality preserved:
- Model selector: Nano Banana 3.0, Nano Banana 3.0 Pro, **Imagen 3 (new)**
- Aspect ratio selector: 1:1, 16:9, 9:16, 4:3
- Multi-reference image upload for image-to-image editing
- Multi-turn chat thread with generated images inline
- Clear chat button
- Chat history persistence (localStorage: `roweos_imagelab_chat`)

**Imagen 3 Integration (new model):**
- Google Imagen 3 API via Generative Language API (same API key as Nano Banana/Gemini)
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key={API_KEY}`
- Request format:
  ```
  {
    "prompt": { "text": "..." },
    "config": {
      "numberOfImages": 1,
      "aspectRatio": "1:1",
      "personGeneration": "ALLOW_ADULT"
    }
  }
  ```
- Response: base64 image in `generatedImages[0].image.imageBytes`
- Add to model selector dropdown as "Google Imagen 3"
- Imagen 3 does NOT support image-to-image editing (input images) -- hide the reference image upload when Imagen 3 is selected
- Cost tracking: add `imagen3` to the existing usage tracking system alongside `nanobanana`

**"Post this" action on generated images/videos:**
- Each generated image/video in the chat thread gets a "Post" button
- Clicking it navigates to Social Hub > Publish tab with the media pre-attached in the compose area
- For images: converts to base64 and sets as the publisher image
- For videos: attaches the video URL/blob

#### Video Sub-Tab (moved from Automations)

All existing functionality preserved:
- Model selector: Veo 3.1
- Duration selector: 4-8 seconds
- Aspect ratio selector: 16:9, 9:16, 1:1, 4:3
- Single reference image upload
- Chat thread with generated videos inline
- Progress indicator during generation
- Chat history persistence (localStorage: `roweos_videolab_chat`)

#### Functions That Must Move/Update

The following functions currently render into Automations containers and need to target Social Hub containers instead:

- `renderAutoLabImageLab()` (line ~107962) -- renders Image Lab UI into `#autoLabImageLab`. Clone/update as `renderMediaImageTab()` targeting `#socialTabMedia` Image sub-panel.
- `renderAutoLabVideoLab()` (line ~108719) -- renders Video Lab UI into `#autoLabVideoLab`. Clone/update as `renderMediaVideoTab()` targeting `#socialTabMedia` Video sub-panel.
- Image Lab paste listener (line ~107982) -- binds to DOM after render. Must re-attach when Media tab renders.
- Automations tab switching (line ~96886) -- references `imagelab` and `videolab` tab names. Update to show redirect cards instead.

**CSS note:** Image Lab CSS (lines ~44575-44950) and Video Lab CSS (lines ~44956-45030) use global class names (`.imagelab-chat-container`, `.videolab-chat-container`) that work regardless of parent container. No CSS changes needed.

#### What Happens in Automations

The Image Lab and Video Lab sections in Automations get replaced with a redirect card:

```
[Image/Video icon]
Image & Video Lab has moved to Social Hub > Media
[Go to Media →]
```

The "Go to Media" button calls `showView('social')` and switches to the Media tab.

---

### 4. Settings Tab

**Source code:** Social Account Connectors (lines ~102760-103315, HTML at ~56706-56748).

#### Layout

**Connected Accounts section (top):**
- Grid of platform cards (same layout as current `#socialAccountsGrid`):
  - **X** -- OAuth PKCE, shows @handle
  - **Threads** -- Meta OAuth, shows @handle
  - **Instagram** -- Meta OAuth, shows @handle
  - **TikTok** -- TikTok OAuth (new), shows @handle
- Each card shows:
  - Platform icon (SVG)
  - Connection status badge (green "Connected" / grey "Not Connected")
  - @handle text
  - Connect / Disconnect button
- Scope indicator: "Connections for: [brand name]" showing which brand's tokens are displayed
- "Use own API keys" toggle for advanced users

**Scavenger Configs section (below):**
- List of saved Scavenger configs (from Firestore `scavenger_configs`)
- Each config shows: name, keywords, tone, active/inactive badge
- "Edit" expands inline editor (same fields as the Settings screenshot from earlier):
  - Config Name
  - Keywords (comma-separated)
  - Tone Priority (dropdown: Thought Leader, Conversational, Professional)
  - Custom Prompt (textarea)
  - Polling Interval (minutes)
  - Max / hour, Max / day
  - Auto-post threshold (0-100, blank = manual only)
  - Avoid accounts (comma-separated)
  - Active toggle
- "Add Config" button to create new configs
- "Delete" button with confirmation
- Save writes to both localStorage and Firestore via `saveScavengerConfigs()`

#### What Happens in System Settings

The social connections section in System Settings gets replaced with:

```
Social Connections
Manage your social media connections in Social Hub > Settings
[Go to Social Settings →]
```

The button calls `showView('social')` and switches to the Settings tab.

---

### 5. Placeholder Tabs

Tabs not implemented in Phase 2A show a clean placeholder:

**Scavenger tab:**
```
[Search icon]
Scavenger
Auto-discover and engage with relevant social posts. Search for keywords, score targets, and draft AI-powered replies.
Coming in Phase 2B
```

**Create tab:**
```
[Sparkle icon]
Create
AI-powered post crafting with image generation. Plus read and reply to social DMs.
Coming in Phase 2B
```

**Blog tab:**
```
[Document icon]
Blog
Analyze websites, generate rich-text blog posts, and publish or email them.
Coming in Phase 2B
```

**Analytics tab:**
```
[Chart icon]
Analytics
Full social performance dashboard with follower trends, engagement metrics, and AI-powered insights.
Coming in Phase 2C
```

Each placeholder uses the brand accent color for the icon and a subdued secondary text color for the description.

---

### 6. Redirect Strategy

When features are moved, their old locations get redirect cards (not removed entirely) to avoid confusion:

| Old Location | Redirect To |
|---|---|
| Automations > Image Lab tab | Social Hub > Media > Image |
| Automations > Video Lab tab | Social Hub > Media > Video |
| System Settings > Social Connections | Social Hub > Settings |
| `showSocialPublisher()` (from Chat/Studio) | Social Hub > Publish (with content pre-filled) |

The redirect cards follow the existing UI patterns -- same card styling, muted colors, with a clear "Go to [destination]" button.

---

## Files to Modify

| File | Change |
|---|---|
| `RoweOS/dist/index.html` | (1) Rename Chat tab to Create, add Media/Blog/Analytics tabs to Social Hub HTML. (2) Move `#socialPublisherPanel` from Studio into Publish tab, remove `closeSocialPublisher()`, redirect all `showSocialPublisher()` call sites. (3) Clone `renderAutoLabImageLab()`/`renderAutoLabVideoLab()` as Media tab renderers, add Imagen 3 model option to Image Lab. (4) Move `#socialAccountsGrid` from System Settings into Settings tab, add TikTok card. (5) Add `connectTikTok()` OAuth function, remove `isApiPlatform = p !== 'tiktok'` guard. (6) Add redirect cards in Automations (Image/Video Lab) and System Settings (Social Connections). (7) Update Automations tab switching to show redirects for imagelab/videolab. |
| `RoweOS/dist/api/social-auth.js` | Add `'tiktok'` to platform whitelist, add TikTok OAuth token exchange endpoint |
| `RoweOS/dist/social-callback.html` | Add TikTok state detection and token storage in OAuth callback flow |

---

## Out of Scope (Phase 2A)

- Scavenger search/discovery UI (Phase 2B)
- AI chat for post crafting (Phase 2B)
- Social DMs (Phase 2B)
- Blog writer (Phase 2B)
- Analytics dashboard (Phase 2C)
- New social platforms beyond X, Threads, Instagram, TikTok
- Changing the underlying posting infrastructure (`postToSocial()`, token storage)
