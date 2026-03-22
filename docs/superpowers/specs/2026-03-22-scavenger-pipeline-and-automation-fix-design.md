# Scavenger Pipeline, Automation Executor Fix, and Activity UI

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Fix three linked issues -- Scavenger auto-commenting not posting, automation executor not resolving templates, and missing Activity UI for Scavenger targets

---

## Problem Statement

1. **Scavenger auto-commenting is configured and active but never posts.** The Scavenger pipeline has no Cloud Function to score, draft, or post replies. The `postToX()` function in `social-poster.js` lacks reply-to support. The Scavenger UI (Settings tab) exists in an unreleased build but the Scavenger code is not yet in the production `index.html`.

2. **Scheduled automations fire but produce broken output.** A "Weekly AI Job Application Package" email was sent with `{{current_date}}` unresolved in the subject and placeholder body text instead of AI-generated content. The automation executor runs AI generation for standard tasks but the email/pipeline path skips template resolution. The default timezone in `index.js` is `America/Chicago` but user expects `America/New_York`.

3. **No visibility into Scavenger activity.** There is no UI showing what posts were discovered, scored, drafted, or posted, and no direct links to original social media posts.

---

## Approach

Hybrid of "Fix in Place" and "Durable Pipeline":
- Fix the executor template resolution and timezone directly in existing code
- Add reply-to support to `social-poster.js`
- Build the new `scoreAndDraftScavenger` Cloud Function with discrete, retryable steps that write state to Firestore
- Add Scavenger config storage, Activity UI, and pipeline code to `index.html`

---

## Design

### 1. Reply-To Support in `social-poster.js`

**Current signature:** `postToX(accessToken, content, imageUrl)`
**Current payload:** `{ text: content }` -- text-only posts, no reply support

**Changes to `/functions/lib/social-poster.js`:**

Add `options` parameter to `postToSocial()` and `postToX()`:

```
postToSocial(platform, accessToken, content, userId, imageUrl, options)
  options.replyToPostId — if set, post as a reply

postToX(accessToken, content, imageUrl, options)
  payload: { text: content }
  if options.replyToPostId:
    payload.reply = { in_reply_to_tweet_id: options.replyToPostId }
```

X API v2 endpoint `POST /2/tweets` already supports the `reply` field. No new API access tier needed for replies -- the existing OAuth token just needs `tweet.write` scope (already required for posting).

**Backward compatible:** existing callers pass no `options`, behavior unchanged.

---

### 2. Scavenger Config Storage

The Settings UI (visible in the screenshot) saves Scavenger configs. These need a Firestore storage location since the feature must work across devices and be readable by Cloud Functions.

**Firestore path:** `roweos_users/{uid}/scavenger_configs/{configId}`

```
{
  configName: string,          // "RoweOS Commentor"
  keywords: string[],          // ["brand management AI", "AI brand tools", ...]
  tonePriority: string,        // "Thought Leader"
  customPrompt: string,        // system prompt for AI drafting
  pollingIntervalMin: number,  // 15
  maxPerHour: number,          // 5
  maxPerDay: number,           // 20
  autoPostThreshold: number,   // 0-100 (0 or blank = manual only)
  avoidAccounts: string[],     // ["@competitor1", "@spambot"]
  active: boolean,             // true
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**localStorage mirror:** `roweos_scavenger_configs` (JSON array, for offline/fast reads)

**Save flow in index.html:** Settings tab Save button writes to both localStorage and Firestore (same pattern as brand settings).

---

### 3. Scavenger Pipeline -- `scoreAndDraftScavenger` Cloud Function

**New file:** `/functions/lib/scavenger.js`

**Exports:**
- `runScavengerPipeline(uid, apiKeys, configs)` -- main entry, called from `index.js`
- Each step is a separate internal function for clarity and retry isolation

**Integration in `/functions/index.js`:**
Inside `runScheduledTasks`, after processing due automation tasks, add:
```
var scavengerConfigs = await getActiveScavengerConfigs(user.uid);
if (scavengerConfigs.length > 0) {
  await scavenger.runScavengerPipeline(user.uid, user.apiKeys, scavengerConfigs);
}
```

**Triggered by:** Cloud Scheduler via `runScheduledTasks` (every 5 min), or manual trigger from Scavenger UI via `runTaskNow`.

#### Step 1: POLL
- For each active config, search X API v2 `GET /2/tweets/search/recent` with the config's keywords as query
  - X API v2 Basic access ($100/mo) supports recent search (tweets from last 7 days)
  - Query construction: join keywords with OR, exclude own handle and avoided accounts
  - Request fields: `author_id,created_at,public_metrics` via `tweet.fields` parameter
  - Expand authors: `expansions=author_id&user.fields=public_metrics,username`
- For each matching post, check if `postId` already exists in `scavenger_targets` (dedup query)
- Write new targets to Firestore: `roweos_users/{uid}/scavenger_targets/{targetId}`
- Initial fields:
  - `postId`, `postUrl` (constructed: `https://x.com/{authorHandle}/status/{postId}`)
  - `platform: "x"`
  - `authorHandle`, `authorFollowers`, `content`
  - `configId`, `configName`, `keywordsMatched[]`
  - `status: "discovered"`, `discoveredAt: serverTimestamp`

#### Step 2: SCORE
- For each target with `status: "discovered"`, calculate confidence score (0-100)
- Composite score = weighted average:
  - **Relevance (50%):** keyword match density in post text. Exact phrase match = 100, partial = proportional.
  - **Authority (30%):** follower count mapped: <500 = 20, 500-2K = 40, 2K-10K = 60, 10K-50K = 80, 50K+ = 100
  - **Engagement (20%):** post age penalty (100 if <1h, -10 per hour, min 20) + like/retweet ratio bonus
- Update target: `{ score, scoreBreakdown: { relevance, authority, engagement }, status: "scored", scoredAt }`

#### Step 3: DRAFT
- For targets with `status: "scored"`:
  - If `score < config.autoPostThreshold` (or threshold is 0/blank): set `status: "rejected", decidedAt`
  - If `score >= config.autoPostThreshold`: call AI to draft reply
- AI call uses `apiCaller.makeApiCall()` with:
  - System prompt: config's `customPrompt` + tone instructions from `tonePriority`
  - User prompt: "Draft a reply to this post: [content] by @[handle]. Keywords: [matched]. Keep it under 280 chars."
  - Model: read from user's `apiKeys` (same routing as automation executor)
- Update target: `{ draftText, aiModel, status: "drafted", draftedAt }`

#### Step 4: DECIDE
- For targets with `status: "drafted"`:
  - If `score >= 95`: set `status: "auto_approved", reviewedBy: "auto", decidedAt`
  - If `score < 95`: set `status: "pending_review", decidedAt`

#### Step 5: POST
- For targets with `status: "auto_approved"`:
  - Check rate limits: count targets with `status: "posted"` in last hour/day for this config. Skip if at `maxPerHour` or `maxPerDay`.
  - Read social token from `social_tokens` subcollection (same pattern as `executeSocialPost` in scheduler.js)
  - Call `postToSocial("x", token, draftText, userId, null, { replyToPostId: postId })`
  - On success: `{ replyUrl, status: "posted", postedAt }`
  - On failure: `{ error, status: "post_failed", postedAt }`

**Retry behavior:** Each 5-min invocation picks up targets in incomplete states by querying for each status. Natural retry without extra infrastructure.

**Concurrency guard:** Before processing targets, set a Firestore lock doc (`scavenger_lock/{uid}`) with timestamp. If lock exists and is less than 5 min old, skip this run. Delete lock on completion. Prevents overlapping scheduler invocations from double-processing.

---

### 4. Automation Executor -- Template Resolution Fix

**Root cause:** The automation executor in `/functions/lib/executor.js` handles AI tasks (lines 92-157) by calling `promptBuilder.buildTaskPrompt()` then `apiCaller.makeApiCall()`. The task description is used as the AI prompt, but template variables like `{{current_date}}` in the task title/description are passed through literally -- the executor never resolves them before building the prompt or writing the result.

**Fix in `/functions/lib/executor.js`:**

Add a `resolveTemplateVars()` function (matching the existing client-side pattern at index.html line 100096):
```
function resolveTemplateVars(text, context) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{\{(\w+)\}\}/g, function(match, key) {
    return context[key] || match;
  });
}
```

Build a context object with current values:
```
var now = new Date();
var localNow = convertToTimezone(now, timezone);
var templateContext = {
  current_date: formatDate(localNow),      // "March 22, 2026"
  current_time: formatTime(localNow),      // "7:00 AM ET"
  day_of_week: getDayName(localNow),       // "Saturday"
  brand_name: task.brandName || '',
  user_name: settings.displayName || ''
};
```

Resolve BEFORE building the AI prompt:
```
task.title = resolveTemplateVars(task.title, templateContext);
task.description = resolveTemplateVars(task.description, templateContext);
```

This ensures the AI sees "Your Weekly AI Job Application Package - March 22, 2026" instead of `{{current_date}}`, and generates content accordingly.

**Fix timezone default in `/functions/index.js`:**
Change line 45 from `var timezone = settings.timezone || 'America/Chicago'` to use the user's configured timezone. The current default of `America/Chicago` (Central) is correct for Austin, TX. If no timezone is set in the user's profile, keep `America/Chicago` as the fallback. Confirm with Jordan if a different default is preferred.

---

### 5. Scavenger Activity UI

**Location:** Social Hub view in `index.html`. This is new code -- the Scavenger tabs (Scavenger, Publish, Chat, Activity, Settings) need to be added to the Social view.

**View ID:** `socialView` (new view, or added to existing social section)

**Activity tab -- Target Card Layout:**

Each Scavenger target renders as a card:

| Field | Source | Display |
|---|---|---|
| Original post | `postUrl` | Clickable link text showing "@handle: [truncated content]", opens in new tab |
| Author | `authorHandle` + `authorFollowers` | @handle with follower count (e.g., "@techfoundr (12.4K)") |
| Post content | `content` | Truncated preview, max 140 chars |
| Keywords matched | `keywordsMatched[]` | Pill/tag badges with brand accent color |
| Config | `configName` | Small label (e.g., "RoweOS Commentor") |
| Confidence score | `score` | Number, color-coded: green (95+), yellow (70-94), red (<70) |
| Your reply | `draftText` | The AI-drafted or posted reply text |
| Reply link | `replyUrl` | "View reply" link (only when status is "posted") |
| Status | `status` | Badge: discovered / scored / drafted / pending_review / posted / rejected / post_failed |
| Time | `discoveredAt`, `postedAt` | Relative time (e.g., "2h ago") |

**Actions on `pending_review` targets:**
- **Approve** -- calls `postToSocial()` client-side with the draft, updates Firestore status
- **Edit and Approve** -- inline textarea to edit draft text, then post
- **Reject** -- sets `status: "rejected"` in Firestore

**Filtering:**
- By status: all / pending review / posted / rejected / failed
- By config name
- By date range

**Data source:**
- Firestore real-time listener on `roweos_users/{uid}/scavenger_targets`
- Ordered by `discoveredAt` descending
- Paginated: load 20 at a time, "Load more" button

---

### 6. Data Model

#### New Collection: `roweos_users/{uid}/scavenger_targets/{targetId}`

```
{
  postId: string,               // platform-agnostic field name
  postUrl: string,              // direct link to original post
  platform: string,             // "x", "threads", etc.
  authorHandle: string,
  authorFollowers: number,
  content: string,              // original post text
  configId: string,             // which config found this
  configName: string,
  keywordsMatched: string[],
  score: number,                // 0-100 composite
  scoreBreakdown: {
    relevance: number,          // 0-100
    authority: number,          // 0-100
    engagement: number          // 0-100
  },
  draftText: string,            // AI-generated reply
  aiModel: string,              // which model drafted it
  replyUrl: string,             // link to posted reply
  status: string,               // see below
  error: string,                // if post_failed
  reviewedBy: string,           // "auto" or "manual"
  discoveredAt: Timestamp,
  scoredAt: Timestamp,
  draftedAt: Timestamp,
  decidedAt: Timestamp,
  postedAt: Timestamp
}
```

**Status values:** `discovered` | `scored` | `drafted` | `pending_review` | `auto_approved` | `posted` | `rejected` | `post_failed`

#### New Collection: `roweos_users/{uid}/scavenger_configs/{configId}`
(Defined in Section 2 above)

#### Firestore Security Rules
Cloud Functions use the Admin SDK, which bypasses security rules entirely. No security rule changes needed for the Cloud Functions pipeline.

Client-side rules in `RoweOS/dist/firestore.rules` need:
```
match /roweos_users/{uid}/scavenger_targets/{targetId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /roweos_users/{uid}/scavenger_configs/{configId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

---

## Files to Modify

| File | Change |
|---|---|
| `/functions/lib/social-poster.js` | Add `options` param with `replyToPostId` support to `postToX()` and `postToSocial()` |
| `/functions/lib/scavenger.js` | **New file:** step-based pipeline (poll, score, draft, decide, post) |
| `/functions/index.js` | Import scavenger module, call from `runScheduledTasks`, fix default timezone |
| `/functions/lib/executor.js` | Add `resolveTemplateVars()`, resolve task title/description before AI prompt |
| `RoweOS/dist/index.html` | Add Social Hub view with Scavenger tabs (Scavenger, Publish, Chat, Activity, Settings), config storage, Activity UI |
| `RoweOS/dist/firestore.rules` | Add read/write rules for `scavenger_targets` and `scavenger_configs` subcollections |

---

## Out of Scope

- Changing the Cloud Scheduler infrastructure (it works, just needs execution fixes)
- Migrating away from Cloud Functions
- Adding new social platforms beyond X (Threads/Instagram reply support can follow later)
- OAuth token refresh (existing token refresh patterns in social-auth.js apply)
- Scavenger for platforms other than X in this iteration
