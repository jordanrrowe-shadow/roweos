# Social Hub Phase 2B-1: Engage Tab + Activity Repurpose

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Replace Scavenger tab with unified Engage tab (manual search + automated pipeline results + review queue). Repurpose Activity tab as general social activity log.

**Phase context:** This is the first sub-project of Phase 2B:
- **Phase 2B-1 (this spec):** Engage tab + Activity repurpose
- **Phase 2B-2:** Create tab (AI chat for crafting posts + social DMs)
- **Phase 2B-3:** Blog tab (website analyzer + rich text blog writer)

---

## Problem Statement

The Scavenger tab is a placeholder and the Activity tab only shows scavenger targets. Users need:
1. A way to manually search for posts to engage with (not just wait for the automated 5-min pipeline)
2. A unified view of both manual search results and automated pipeline results
3. A general activity log showing all social actions (posts published, replies sent, media generated)

---

## Design

### 1. Tab Structure Change

| Old Tab | New Tab | Change |
|---|---|---|
| Scavenger (placeholder) | **Engage** | New: manual search + scavenger results + review queue |
| Activity (scavenger targets only) | **Activity** | Repurposed: general social activity log |

Tab order: Engage, Publish, Create, Activity, Media, Blog, Analytics, Settings

Update the tab button HTML: rename "Scavenger" to "Engage", update `data-tab` and `onclick` from `'scavenger'` to `'engage'`. The current Scavenger tab has a placeholder panel `socialTabScavenger`. Rename it to `socialTabEngage` and replace its placeholder content with the Engage tab UI. The current Activity tab panel `socialTabActivity` contains the scavenger target feed -- this content moves into the Engage tab and the Activity panel gets repurposed for the activity log.

Default active tab stays as Activity (now the activity log).

The existing `showSocialTab()` render-on-switch calls need updating:
- `tab === 'engage'` calls `initEngageTab()`
- `tab === 'activity'` calls `initSocialActivityLog()` (replaces `initScavengerActivity()`)

---

### 2. Engage Tab

**Replaces:** Scavenger placeholder + Activity scavenger functionality

#### Layout

**Search section (top):**
- Search input: `<input placeholder="Search for posts about...">`
- Search button (SVG search icon)
- Below input: quick-filter keyword pills from active Scavenger configs. Each pill shows a config keyword -- clicking it fills the search input and triggers search. Read from `getScavengerConfigs()`.

**Filter bar (below search):**
- Filter buttons: All | Pending Review | Posted | Rejected | Failed | Auto-approved
- Same styling as current Activity filter bar (`.scavenger-filter-btn`)

**Results feed (main area):**
- Same card layout as current Activity tab (`renderScavengerCard()` function)
- Shows targets from both manual searches AND automated pipeline
- Sorted by `discoveredAt` descending
- Cards show: author handle + followers, content preview, direct link to original post, keywords matched (pills), confidence score (color-coded), draft text, status badge, reply link if posted
- Pending review cards show: Approve / Edit & Approve / Reject buttons
- Load more pagination (20 per page)
- Empty state: "Search for posts or wait for the automated pipeline to find targets."

#### Manual Search Flow

1. User types keywords in search bar, clicks Search
2. **Rate limiting:** Disable search button for 5 seconds after each search (X API allows 180 requests/15min for user tokens). Show toast if user tries to search too quickly.
3. Client-side JS calls X API v2 `GET /2/tweets/search/recent`:
   - URL: `https://api.x.com/2/tweets/search/recent?query={keywords}&max_results=10&tweet.fields=author_id,created_at,public_metrics&expansions=author_id&user.fields=public_metrics,username`
   - Auth: Bearer token from `getSocialToken('x')` (requires `tweet.read` scope in OAuth app)
   - Query construction: wrap multi-word phrases in quotes, join with OR
   - **Error handling:** If 403 Forbidden (scope issue), show "Your X connection needs to be re-authorized with search permissions." If offline or network error, show "Search failed -- check your connection."
4. For each result tweet:
   - Dedup: check if `postId` already exists in local state (skip if so)
   - Score client-side using the scoring function (see Section 4)
   - Write to Firestore `scavenger_targets/{targetId}` with status `scored` and `source: 'manual'`
   - The `source: 'manual'` field tells the automated pipeline to skip re-scoring these targets
5. Firestore real-time listener picks up new targets and renders them
6. If an active Scavenger config has `autoPostThreshold > 0` and score >= threshold:
   - Auto-draft: call AI via client-side API call using config's custom prompt + tone
   - Write draft to Firestore, set status to `drafted`
   - If score >= 95: auto-approve, post via `postToSocial()`
   - If score < 95: set to `pending_review`

#### Functions

**New functions:**
- `initEngageTab()` -- sets up Firestore listener on `scavenger_targets`, renders search bar + filters + feed
- `searchEngagePosts()` -- calls X API, scores results, writes to Firestore
- `renderEngageFeed()` -- renders the unified feed (reuses `renderScavengerCard()` from Phase 1)
- `filterEngageFeed(status)` -- filters by status (reuses `filterScavengerActivity()` logic)
- `renderEngageSearchBar()` -- renders search input + keyword pills

**Moved/reused from Phase 1 Activity tab:**
- `renderScavengerCard(target)` -- card rendering (no changes needed)
- `approveScavengerTarget(targetId)` -- approve action
- `editScavengerTarget(targetId)` -- edit & approve action
- `rejectScavengerTarget(targetId)` -- reject action
- `scavengerFormatFollowers(n)` -- follower count formatting
- `scavengerRelativeTime(timestamp)` -- relative time display

**Removed:**
- `initScavengerActivity()` -- replaced by `initEngageTab()`
- `renderScavengerActivity()` -- replaced by `renderEngageFeed()`
- `filterScavengerActivity()` -- replaced by `filterEngageFeed()`
- `loadMoreScavengerTargets()` -- replaced by `loadMoreEngageTargets()`

---

### 3. Activity Tab (Repurposed)

**New purpose:** General social activity log -- read-only timeline of all social actions.

#### Data Model

New Firestore subcollection: `roweos_users/{uid}/social_activity/{activityId}`

```
{
  type: string,        // 'post_published', 'scavenger_reply', 'scavenger_rejected',
                       // 'image_generated', 'video_generated',
                       // 'account_connected', 'account_disconnected', 'config_changed'
  platform: string,    // 'x', 'threads', 'instagram', 'tiktok' (if applicable)
  description: string, // Human-readable summary
  details: {           // Type-specific data
    content: string,   // Post content or prompt
    postUrl: string,   // Link to published post
    targetAuthor: string, // For scavenger replies
    model: string,     // For image/video generation
    configName: string // For config changes
  },
  timestamp: Timestamp,
  automatic: boolean   // true if done by automated pipeline, false if manual
}
```

#### Layout

- **Filter bar (top):** All | Posts | Scavenger | Media | Settings
- **Timeline list:** newest first, each entry shows:
  - Type icon (SVG): send icon for posts, reply icon for scavenger, image icon for media, gear icon for settings
  - Description text (e.g., "Posted to X: [content preview]")
  - Platform badge if applicable
  - "Auto" badge if `automatic: true`
  - Relative timestamp
  - Link to post/reply if available
- **Empty state:** "No social activity yet. Actions you take across Social Hub will appear here."
- **Pagination:** Load 30 at a time, "Load more" button
- **Filtering:** Client-side after Firestore fetch (load all entries up to page limit, filter in JS by type group). No server-side `in` queries needed.

#### Writing to Activity Log

Add `logSocialActivity(type, details)` utility function:

```javascript
function logSocialActivity(type, details) {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var platform = details.platform || '';
  delete details.platform; // avoid duplication in details object
  var entry = {
    type: type,
    platform: platform,
    description: details.description || '',
    details: details,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    automatic: details.automatic || false
  };
  firebase.firestore().collection('roweos_users/' + uid + '/social_activity').add(entry)
    .catch(function(e) { console.warn('[Social] Activity log error:', e); });
}
```

**Call sites** -- add `logSocialActivity()` calls to:
- `publishPostNow()` -- after successful post
- `approveScavengerTarget()` -- after posting reply
- `rejectScavengerTarget()` -- after rejecting
- `postMediaToPublish()` -- after posting from Media tab
- `connectSocialAccount()` / `disconnectSocialAccount()` -- on connect/disconnect
- `saveScavengerConfigEdit()` / `addScavengerConfig()` / `deleteScavengerConfig()` -- on config changes
- Automated pipeline posts (Cloud Functions side -- add to `stepPost()` in scavenger.js)

---

### 4. Client-Side Scoring

The scoring algorithm is based on the Cloud Function in `scavenger.js` Step 2 (SCORE) but uses tweet `created_at` (from X API) for age calculation instead of `discoveredAt` (which is when the pipeline found it). This gives more accurate engagement scores since tweet age matters more than discovery time. The client-side function also takes keywords as input (for manual search where there's no prior poll step).

```javascript
function scoreScavengerTarget(target, keywords) {
  // Relevance (50%): keyword match density
  var matchChars = 0;
  var contentLen = (target.content || '').length;
  var matched = [];
  var contentLower = (target.content || '').toLowerCase();
  for (var k = 0; k < keywords.length; k++) {
    if (contentLower.indexOf(keywords[k].toLowerCase()) >= 0) {
      matchChars += keywords[k].length;
      matched.push(keywords[k]);
    }
  }
  var relevance = matched.length > 0 ? Math.min(100, Math.round((matchChars / Math.max(contentLen, 1)) * 500)) : 20;
  relevance = Math.max(20, Math.min(100, relevance));

  // Authority (30%): follower tiers
  var followers = target.authorFollowers || 0;
  var authority;
  if (followers >= 50000) authority = 100;
  else if (followers >= 10000) authority = 80;
  else if (followers >= 2000) authority = 60;
  else if (followers >= 500) authority = 40;
  else authority = 20;

  // Engagement (20%): age penalty
  var ageHours = 0;
  if (target.createdAt) {
    ageHours = (Date.now() - new Date(target.createdAt).getTime()) / (60 * 60 * 1000);
  }
  var engagement = Math.max(20, Math.round(100 - (ageHours * 10)));

  var score = Math.round(relevance * 0.5 + authority * 0.3 + engagement * 0.2);
  return {
    score: score,
    scoreBreakdown: { relevance: relevance, authority: authority, engagement: engagement },
    keywordsMatched: matched
  };
}
```

---

## Files to Modify

| File | Change |
|---|---|
| `RoweOS/dist/index.html` | (1) Rename Scavenger tab to Engage, update panel ID. (2) Add Engage tab HTML with search bar, keyword pills, filter bar, results feed. (3) Add `initEngageTab()`, `searchEngagePosts()`, `renderEngageFeed()`, `scoreScavengerTarget()`, `logSocialActivity()` functions. (4) Repurpose Activity tab HTML for social activity log. (5) Add `initSocialActivityLog()`, `renderSocialActivityLog()` functions. (6) Add `logSocialActivity()` calls to existing post/approve/reject/connect flows. (7) Update `showSocialTab()` render-on-switch. (8) Remove old Scavenger placeholder HTML. |
| `/functions/lib/scavenger.js` | Add `logSocialActivity()` call in `stepPost()` for automated posts (writes to `social_activity` subcollection via Admin SDK) |

---

## Out of Scope

- Create tab (Phase 2B-2)
- Blog tab (Phase 2B-3)
- Analytics dashboard (Phase 2C)
- Changing the automated Cloud Functions pipeline logic
- Multi-platform search (X only for now -- Threads/Instagram don't have public search APIs)
