# Scavenger Pipeline, Automation Fix, and Activity UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three linked issues — Scavenger auto-commenting pipeline (missing Cloud Function), automation executor template resolution (broken emails), and Scavenger Activity UI (visibility into targets with direct links).

**Architecture:** Cloud Functions (ES5, Node.js) for server-side pipeline. Single-file HTML app (`index.html`) for UI. Firestore for state. Step-based pipeline with Firestore state at each step for retry and visibility.

**Tech Stack:** Firebase Cloud Functions v2, Firestore Admin SDK, X API v2, node-fetch, vanilla HTML/CSS/JS (ES5)

**Spec:** `docs/superpowers/specs/2026-03-22-scavenger-pipeline-and-automation-fix-design.md`

**Codebase conventions:**
- ES5 only (no arrow functions, no let/const, no template literals)
- `var` for all declarations, explicit `function` declarations
- Wrap API calls in try/catch
- Tag changes with version comments: `// v26.3: description`
- No emoji — use SVG icons
- Single-file app: `RoweOS/dist/index.html` (~167K lines)
- Cloud Functions: `/functions/lib/*.js`
- Deploy: `./deploy.sh` for app, `firebase deploy --only functions` for Cloud Functions

**Base path:** `/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `/functions/lib/social-poster.js` | Social media posting (X, Threads, Instagram) | Modify — add reply-to support |
| `/functions/lib/scavenger.js` | Scavenger pipeline (poll, score, draft, decide, post) | **Create** |
| `/functions/lib/firestore-helpers.js` | Firestore read/write utilities | Modify — add scavenger helpers |
| `/functions/index.js` | Cloud Functions entry point | Modify — integrate scavenger pipeline |
| `/functions/lib/executor.js` | Task executor | Modify — add template resolution |
| `RoweOS/dist/index.html` | Main app (CSS, HTML, JS) | Modify — add Scavenger Activity UI + config storage |

**Note:** `RoweOS/dist/firestore.rules` already has a wildcard subcollection match at lines 34-36 (`roweos_users/{userId}/{subcollection}/{docId}`) that covers `scavenger_targets` and `scavenger_configs`. No rules changes needed.

---

## Task 1: Add Reply-To Support to social-poster.js

**Files:**
- Modify: `/functions/lib/social-poster.js`

This is a prerequisite for the Scavenger pipeline — without reply-to, the pipeline can't post replies.

- [ ] **Step 1: Add `options` parameter to `postToX()`**

In `/functions/lib/social-poster.js`, modify the `postToX` function (line 44) to accept an `options` parameter and add reply support:

```javascript
// v26.3: Added options param for reply-to support
async function postToX(accessToken, content, imageUrl, options) {
  var payload = { text: content };
  // v26.3: Reply-to support for Scavenger
  if (options && options.replyToPostId) {
    payload.reply = { in_reply_to_tweet_id: options.replyToPostId };
  }
  // Note: X image posting requires media upload API (separate OAuth flow)
  // Cloud functions only support text posts to X for now
```

The rest of the function stays the same.

- [ ] **Step 2: Add `options` parameter to `postToSocial()`**

Modify the `postToSocial` function signature (line 23) to pass `options` through:

```javascript
// v26.3: Added options param (replyToPostId for replies)
async function postToSocial(platform, accessToken, content, userId, imageUrl, options) {
  try {
    if (platform === 'x') {
      return await postToX(accessToken, content, imageUrl, options);
    } else if (platform === 'threads') {
```

Only the X branch passes `options` — Threads/Instagram reply support is out of scope for this iteration.

- [ ] **Step 3: Verify no existing callers break**

Existing callers in `executor.js` line 204 call `postToSocial(platform, token, content, userId, null)` — the new `options` param is optional and defaults to undefined, so all existing calls continue to work.

- [ ] **Step 4: Commit**

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project"
git add functions/lib/social-poster.js
git commit -m "feat: add reply-to support to postToX() for Scavenger pipeline"
```

---

## Task 2: Add Scavenger Firestore Helpers

**Files:**
- Modify: `/functions/lib/firestore-helpers.js`

Add helper functions the scavenger pipeline needs to read configs, write targets, manage locks, and check rate limits.

- [ ] **Step 1: Add `getActiveScavengerConfigs()` function**

Add before the `module.exports` block (before line 269):

```javascript
// v26.3: Scavenger config helpers

/**
 * Read active scavenger configs for a user
 * @param {string} uid - Firebase user ID
 * @returns {Array} Active scavenger config objects
 */
async function getActiveScavengerConfigs(uid) {
  var db = getDb();
  var snap = await db.collection('roweos_users/' + uid + '/scavenger_configs')
    .where('active', '==', true)
    .get();
  if (snap.empty) return [];
  var configs = [];
  snap.forEach(function(doc) {
    var data = doc.data();
    data.id = doc.id;
    configs.push(data);
  });
  return configs;
}
```

- [ ] **Step 2: Add `writeScavengerTarget()` function**

```javascript
/**
 * Write a scavenger target to Firestore
 * @param {string} uid - Firebase user ID
 * @param {Object} target - Target data
 * @returns {string} Document ID
 */
async function writeScavengerTarget(uid, target) {
  var db = getDb();
  var docRef = await db.collection('roweos_users/' + uid + '/scavenger_targets').add(target);
  return docRef.id;
}

/**
 * Update a scavenger target's fields
 * @param {string} uid - Firebase user ID
 * @param {string} targetId - Target document ID
 * @param {Object} updates - Fields to update
 */
async function updateScavengerTarget(uid, targetId, updates) {
  var db = getDb();
  await db.doc('roweos_users/' + uid + '/scavenger_targets/' + targetId).set(updates, { merge: true });
}

/**
 * Query scavenger targets by status
 * @param {string} uid - Firebase user ID
 * @param {string} status - Status to query for
 * @returns {Array} Array of { id, ...data } objects
 */
async function getScavengerTargetsByStatus(uid, status) {
  var db = getDb();
  var snap = await db.collection('roweos_users/' + uid + '/scavenger_targets')
    .where('status', '==', status)
    .get();
  var targets = [];
  snap.forEach(function(doc) {
    var data = doc.data();
    data._id = doc.id;
    targets.push(data);
  });
  return targets;
}

/**
 * Check if a post already exists as a scavenger target (dedup)
 * @param {string} uid - Firebase user ID
 * @param {string} postId - Platform post ID
 * @returns {boolean} true if already exists
 */
async function scavengerTargetExists(uid, postId) {
  var db = getDb();
  var snap = await db.collection('roweos_users/' + uid + '/scavenger_targets')
    .where('postId', '==', postId)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Count scavenger targets with a status in a time window
 * Used for rate limiting (maxPerHour, maxPerDay)
 * @param {string} uid - Firebase user ID
 * @param {string} configId - Config ID to filter by
 * @param {string} status - Status to count
 * @param {number} sinceMs - Timestamp in milliseconds
 * @returns {number} Count
 */
async function countScavengerTargets(uid, configId, status, sinceMs) {
  var db = getDb();
  var sinceDate = new Date(sinceMs);
  var snap = await db.collection('roweos_users/' + uid + '/scavenger_targets')
    .where('configId', '==', configId)
    .where('status', '==', status)
    .where('postedAt', '>=', sinceDate)
    .get();
  return snap.size;
}

/**
 * Scavenger pipeline lock — prevents concurrent runs
 * @param {string} uid - Firebase user ID
 * @param {boolean} lock - true to acquire, false to release
 * @returns {boolean} true if lock acquired/released
 */
async function setScavengerLock(uid, lock) {
  var db = getDb();
  var lockRef = db.doc('roweos_users/' + uid + '/scavenger_lock/pipeline');
  if (lock) {
    try {
      var result = await db.runTransaction(async function(transaction) {
        var lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists) {
          var lockData = lockDoc.data();
          var lockTime = lockData.lockedAt ? lockData.lockedAt.toDate().getTime() : 0;
          if (Date.now() - lockTime < 5 * 60 * 1000) {
            return false;
          }
        }
        transaction.set(lockRef, {
          locked: true,
          lockedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
      });
      return result;
    } catch (e) {
      console.error('[ScavengerLock] Transaction failed:', e);
      return false;
    }
  } else {
    await lockRef.delete();
    return true;
  }
}
```

- [ ] **Step 3: Export the new functions**

Update the `module.exports` block (line 269) to include all new functions:

```javascript
module.exports = {
  getDb: getDb,
  getUserApiKeys: getUserApiKeys,
  getUserBrands: getUserBrands,
  getUserBrandSettings: getUserBrandSettings,
  getUserSettings: getUserSettings,
  getUserAutomations: getUserAutomations,
  getUserCustomOps: getUserCustomOps,
  getUserGeneratedBrandOps: getUserGeneratedBrandOps,
  writeCloudResult: writeCloudResult,
  updateAutomationLastRun: updateAutomationLastRun,
  setCloudLock: setCloudLock,
  getUserSocialToken: getUserSocialToken,
  getUserSocialConnections: getUserSocialConnections,
  // v26.3: Scavenger helpers
  getActiveScavengerConfigs: getActiveScavengerConfigs,
  writeScavengerTarget: writeScavengerTarget,
  updateScavengerTarget: updateScavengerTarget,
  getScavengerTargetsByStatus: getScavengerTargetsByStatus,
  scavengerTargetExists: scavengerTargetExists,
  countScavengerTargets: countScavengerTargets,
  setScavengerLock: setScavengerLock
};
```

- [ ] **Step 4: Commit**

```bash
git add functions/lib/firestore-helpers.js
git commit -m "feat: add Firestore helpers for scavenger pipeline"
```

---

## Task 3: Create Scavenger Pipeline (`scavenger.js`)

**Files:**
- Create: `/functions/lib/scavenger.js`

This is the core pipeline — 5 steps (poll, score, draft, decide, post) with Firestore state at each step.

- [ ] **Step 1: Create the scavenger module with poll step**

Create `/functions/lib/scavenger.js`:

```javascript
/**
 * RoweOS Cloud Functions — Scavenger Pipeline
 * v26.3: Step-based social engagement pipeline
 *
 * Steps: POLL → SCORE → DRAFT → DECIDE → POST
 * Each step writes state to Firestore for retry and visibility.
 *
 * Entry: runScavengerPipeline(uid, apiKeys, configs)
 * Called from: index.js runScheduledTasks + runTaskNow
 */

var fetch = require('node-fetch');
var admin = require('firebase-admin');
var helpers = require('./firestore-helpers');
var apiCaller = require('./api-caller');
var socialPoster = require('./social-poster');

/**
 * Main pipeline entry point
 * @param {string} uid - Firebase user ID
 * @param {Object} apiKeys - User's API keys (includes X bearer token via social_tokens)
 * @param {Array} configs - Active scavenger configs
 */
async function runScavengerPipeline(uid, apiKeys, configs) {
  console.log('[Scavenger] Starting pipeline for user:', uid, 'configs:', configs.length);

  // Acquire pipeline lock
  var locked = await helpers.setScavengerLock(uid, true);
  if (!locked) {
    console.log('[Scavenger] Pipeline locked, skipping this run');
    return { success: false, reason: 'locked' };
  }

  try {
    // Step 1: Poll for new targets
    for (var i = 0; i < configs.length; i++) {
      await stepPoll(uid, apiKeys, configs[i]);
    }

    // Step 2: Score discovered targets
    await stepScore(uid);

    // Step 3: Draft replies for scored targets
    for (var j = 0; j < configs.length; j++) {
      await stepDraft(uid, apiKeys, configs[j]);
    }

    // Step 4: Decide (auto-approve or queue for review)
    await stepDecide(uid);

    // Step 5: Post auto-approved targets
    for (var k = 0; k < configs.length; k++) {
      await stepPost(uid, configs[k]);
    }

    console.log('[Scavenger] Pipeline completed for user:', uid);
    return { success: true };
  } catch (err) {
    console.error('[Scavenger] Pipeline error:', err.message);
    return { success: false, error: err.message };
  } finally {
    await helpers.setScavengerLock(uid, false);
  }
}

/**
 * Step 1: POLL — Search X API for posts matching config keywords
 */
async function stepPoll(uid, apiKeys, config) {
  // Need X API bearer token — read from social tokens
  var xToken = await helpers.getUserSocialToken(uid, 'x', '_brand_0');
  if (!xToken || !xToken.accessToken) {
    console.warn('[Scavenger:Poll] No X token found for user:', uid);
    return;
  }

  // Build search query: keywords OR'd, exclude avoided accounts
  var keywords = config.keywords || [];
  if (keywords.length === 0) return;

  var queryParts = keywords.map(function(kw) {
    // Wrap multi-word keywords in quotes
    return kw.indexOf(' ') >= 0 ? '"' + kw + '"' : kw;
  });
  var query = '(' + queryParts.join(' OR ') + ')';

  // Exclude avoided accounts
  var avoid = config.avoidAccounts || [];
  for (var a = 0; a < avoid.length; a++) {
    var handle = avoid[a].replace('@', '');
    query += ' -from:' + handle;
  }

  // Exclude replies and retweets for cleaner results
  query += ' -is:retweet -is:reply';

  console.log('[Scavenger:Poll] Searching X for config:', config.configName, 'query:', query);

  try {
    var url = 'https://api.x.com/2/tweets/search/recent' +
      '?query=' + encodeURIComponent(query) +
      '&max_results=10' +
      '&tweet.fields=author_id,created_at,public_metrics' +
      '&expansions=author_id' +
      '&user.fields=public_metrics,username';

    var resp = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + xToken.accessToken },
      timeout: 30000
    });
    var data = await resp.json();

    if (!resp.ok) {
      console.error('[Scavenger:Poll] X API error:', JSON.stringify(data));
      return;
    }

    var tweets = (data.data || []);
    var users = {};
    // Build user lookup from includes
    if (data.includes && data.includes.users) {
      for (var u = 0; u < data.includes.users.length; u++) {
        var user = data.includes.users[u];
        users[user.id] = user;
      }
    }

    console.log('[Scavenger:Poll] Found', tweets.length, 'tweets for config:', config.configName);

    for (var t = 0; t < tweets.length; t++) {
      var tweet = tweets[t];

      // Dedup — skip if already tracked
      var exists = await helpers.scavengerTargetExists(uid, tweet.id);
      if (exists) continue;

      var author = users[tweet.author_id] || {};
      var authorHandle = author.username || '';
      var authorFollowers = (author.public_metrics && author.public_metrics.followers_count) || 0;

      // Determine which keywords matched
      var matched = [];
      var tweetLower = (tweet.text || '').toLowerCase();
      for (var kIdx = 0; kIdx < keywords.length; kIdx++) {
        if (tweetLower.indexOf(keywords[kIdx].toLowerCase()) >= 0) {
          matched.push(keywords[kIdx]);
        }
      }

      var target = {
        postId: tweet.id,
        postUrl: 'https://x.com/' + authorHandle + '/status/' + tweet.id,
        platform: 'x',
        authorHandle: authorHandle,
        authorFollowers: authorFollowers,
        content: tweet.text || '',
        configId: config.id,
        configName: config.configName || '',
        keywordsMatched: matched,
        status: 'discovered',
        discoveredAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await helpers.writeScavengerTarget(uid, target);
      console.log('[Scavenger:Poll] New target:', authorHandle, '- matched:', matched.join(', '));
    }
  } catch (err) {
    console.error('[Scavenger:Poll] Error:', err.message);
  }
}

/**
 * Step 2: SCORE — Calculate confidence score for discovered targets
 * Composite: Relevance (50%) + Authority (30%) + Engagement (20%)
 */
async function stepScore(uid) {
  var targets = await helpers.getScavengerTargetsByStatus(uid, 'discovered');
  if (targets.length === 0) return;

  console.log('[Scavenger:Score] Scoring', targets.length, 'targets');

  for (var i = 0; i < targets.length; i++) {
    var target = targets[i];

    // Relevance (50%): keyword match density
    var keywords = target.keywordsMatched || [];
    var contentLen = (target.content || '').length;
    var matchChars = 0;
    for (var k = 0; k < keywords.length; k++) {
      matchChars += keywords[k].length;
    }
    // Exact phrase match = 100, scale by match coverage
    var relevance = keywords.length > 0 ? Math.min(100, Math.round((matchChars / Math.max(contentLen, 1)) * 500)) : 20;
    relevance = Math.max(20, Math.min(100, relevance));

    // Authority (30%): follower count tiers
    var followers = target.authorFollowers || 0;
    var authority;
    if (followers >= 50000) authority = 100;
    else if (followers >= 10000) authority = 80;
    else if (followers >= 2000) authority = 60;
    else if (followers >= 500) authority = 40;
    else authority = 20;

    // Engagement (20%): post age penalty
    var ageHours = 0;
    if (target.discoveredAt && target.discoveredAt.toDate) {
      ageHours = (Date.now() - target.discoveredAt.toDate().getTime()) / (60 * 60 * 1000);
    }
    var engagement = Math.max(20, Math.round(100 - (ageHours * 10)));

    var score = Math.round(relevance * 0.5 + authority * 0.3 + engagement * 0.2);

    await helpers.updateScavengerTarget(uid, target._id, {
      score: score,
      scoreBreakdown: {
        relevance: relevance,
        authority: authority,
        engagement: engagement
      },
      status: 'scored',
      scoredAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

/**
 * Step 3: DRAFT — Generate AI reply for scored targets above threshold
 */
async function stepDraft(uid, apiKeys, config) {
  var targets = await helpers.getScavengerTargetsByStatus(uid, 'scored');
  if (targets.length === 0) return;

  // Filter to targets for this config
  var configTargets = targets.filter(function(t) { return t.configId === config.id; });

  var threshold = config.autoPostThreshold || 0;

  for (var i = 0; i < configTargets.length; i++) {
    var target = configTargets[i];

    // Reject below threshold (0 = manual only, also reject)
    if (threshold === 0 || target.score < threshold) {
      await helpers.updateScavengerTarget(uid, target._id, {
        status: 'rejected',
        decidedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      continue;
    }

    // Draft AI reply
    try {
      // Determine provider/model from user's API keys
      var provider = 'anthropic';
      var model = 'claude-sonnet-4-6';
      var apiKey = apiKeys.anthropic;
      if (!apiKey && apiKeys.openai) {
        provider = 'openai';
        model = 'gpt-4o';
        apiKey = apiKeys.openai;
      }
      if (!apiKey && apiKeys.google) {
        provider = 'google';
        model = 'gemini-2.0-flash';
        apiKey = apiKeys.google;
      }
      if (!apiKey) {
        console.warn('[Scavenger:Draft] No API key available for AI drafting');
        continue;
      }

      var toneInstructions = '';
      if (config.tonePriority === 'Thought Leader') {
        toneInstructions = 'Respond as a thought leader — insightful, authoritative, adding genuine value.';
      } else if (config.tonePriority === 'Conversational') {
        toneInstructions = 'Respond conversationally — friendly, approachable, natural tone.';
      } else if (config.tonePriority === 'Professional') {
        toneInstructions = 'Respond professionally — polished, credible, business-appropriate.';
      } else {
        toneInstructions = 'Respond naturally and helpfully.';
      }

      var systemPrompt = (config.customPrompt || 'You are a helpful brand voice.') +
        '\n\n' + toneInstructions +
        '\n\nRules:\n- Keep reply under 280 characters\n- Be genuine and add value to the conversation\n- Never be salesy or self-promotional\n- Match the energy of the original post';

      var userPrompt = 'Draft a reply to this X post by @' + target.authorHandle + ':\n\n"' +
        target.content + '"\n\nKeywords that matched: ' + (target.keywordsMatched || []).join(', ');

      var response = await apiCaller.makeApiCall(provider, model, apiKey, systemPrompt, userPrompt);

      if (response) {
        // Clean up — remove surrounding quotes if AI added them
        var draft = response.replace(/^["']|["']$/g, '').trim();
        if (draft.length > 280) {
          draft = draft.substring(0, 277) + '...';
        }

        await helpers.updateScavengerTarget(uid, target._id, {
          draftText: draft,
          aiModel: provider + '/' + model,
          status: 'drafted',
          draftedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('[Scavenger:Draft] Drafted reply for @' + target.authorHandle);
      }
    } catch (err) {
      console.error('[Scavenger:Draft] Error drafting for target:', target._id, err.message);
    }
  }
}

/**
 * Step 4: DECIDE — Auto-approve (score >= 95) or queue for review
 */
async function stepDecide(uid) {
  var targets = await helpers.getScavengerTargetsByStatus(uid, 'drafted');
  if (targets.length === 0) return;

  for (var i = 0; i < targets.length; i++) {
    var target = targets[i];
    if (target.score >= 95) {
      await helpers.updateScavengerTarget(uid, target._id, {
        status: 'auto_approved',
        reviewedBy: 'auto',
        decidedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('[Scavenger:Decide] Auto-approved target for @' + target.authorHandle + ' (score: ' + target.score + ')');
    } else {
      await helpers.updateScavengerTarget(uid, target._id, {
        status: 'pending_review',
        decidedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('[Scavenger:Decide] Queued for review: @' + target.authorHandle + ' (score: ' + target.score + ')');
    }
  }
}

/**
 * Step 5: POST — Post auto-approved replies, respecting rate limits
 */
async function stepPost(uid, config) {
  var targets = await helpers.getScavengerTargetsByStatus(uid, 'auto_approved');
  if (targets.length === 0) return;

  // Filter to this config's targets
  var configTargets = targets.filter(function(t) { return t.configId === config.id; });
  if (configTargets.length === 0) return;

  // Rate limit check
  var maxPerHour = config.maxPerHour || 5;
  var maxPerDay = config.maxPerDay || 20;
  var oneHourAgo = Date.now() - (60 * 60 * 1000);
  var oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

  var postedLastHour = await helpers.countScavengerTargets(uid, config.id, 'posted', oneHourAgo);
  var postedLastDay = await helpers.countScavengerTargets(uid, config.id, 'posted', oneDayAgo);

  if (postedLastHour >= maxPerHour) {
    console.log('[Scavenger:Post] Hourly rate limit reached for config:', config.configName);
    return;
  }
  if (postedLastDay >= maxPerDay) {
    console.log('[Scavenger:Post] Daily rate limit reached for config:', config.configName);
    return;
  }

  // Get X token
  var xToken = await helpers.getUserSocialToken(uid, 'x', '_brand_0');
  if (!xToken || !xToken.accessToken) {
    console.warn('[Scavenger:Post] No X token for posting');
    return;
  }

  var remaining = Math.min(maxPerHour - postedLastHour, maxPerDay - postedLastDay);

  for (var i = 0; i < Math.min(configTargets.length, remaining); i++) {
    var target = configTargets[i];

    try {
      var postResult = await socialPoster.postToSocial(
        'x', xToken.accessToken, target.draftText, null, null,
        { replyToPostId: target.postId }
      );

      if (postResult.success) {
        await helpers.updateScavengerTarget(uid, target._id, {
          replyUrl: postResult.postUrl,
          status: 'posted',
          postedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('[Scavenger:Post] Posted reply to @' + target.authorHandle);
      } else {
        await helpers.updateScavengerTarget(uid, target._id, {
          error: postResult.error || 'Post failed',
          status: 'post_failed',
          postedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.error('[Scavenger:Post] Failed:', postResult.error);
      }
    } catch (err) {
      await helpers.updateScavengerTarget(uid, target._id, {
        error: err.message,
        status: 'post_failed',
        postedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.error('[Scavenger:Post] Error posting reply:', err.message);
    }
  }
}

module.exports = {
  runScavengerPipeline: runScavengerPipeline
};
```

- [ ] **Step 2: Verify the module loads without errors**

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project/functions"
node -e "var s = require('./lib/scavenger'); console.log('Loaded:', Object.keys(s));"
```

Expected: `Loaded: [ 'runScavengerPipeline' ]`

- [ ] **Step 3: Commit**

```bash
git add functions/lib/scavenger.js
git commit -m "feat: create scavenger pipeline with 5-step flow (poll/score/draft/decide/post)"
```

---

## Task 4: Integrate Scavenger into Cloud Functions Entry Point

**Files:**
- Modify: `/functions/index.js`

- [ ] **Step 1: Import scavenger and helpers modules**

Add after the existing imports (line 14):

```javascript
var scavenger = require('./lib/scavenger');
var helpers = require('./lib/firestore-helpers');
```

Also update line 44 to use the top-level `helpers` variable instead of the inline require:

Change: `var settings = await require('./lib/firestore-helpers').getUserSettings(user.uid);`
To: `var settings = await helpers.getUserSettings(user.uid);`

- [ ] **Step 2: Add scavenger pipeline call in `runScheduledTasks`**

After the existing task execution loop (after line 63, before the closing `} catch` on line 64), add:

```javascript
          // v26.3: Run scavenger pipeline for this user
          try {
            var scavengerConfigs = await helpers.getActiveScavengerConfigs(user.uid);
            if (scavengerConfigs.length > 0) {
              console.log('[Cloud Scheduler] Running scavenger for user', user.uid, '(' + scavengerConfigs.length + ' configs)');
              await scavenger.runScavengerPipeline(user.uid, user.apiKeys, scavengerConfigs);
            }
          } catch (scavErr) {
            console.error('[Cloud Scheduler] Scavenger error for user', user.uid, ':', scavErr.message);
          }
```

This goes inside the per-user loop, after the `for (var j = 0; j < dueTasks.length; j++)` block completes.

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: integrate scavenger pipeline into Cloud Scheduler"
```

---

## Task 5: Fix Automation Executor Template Resolution

**Files:**
- Modify: `/functions/lib/executor.js`

- [ ] **Step 1: Add `resolveTemplateVars()` function**

Add after the imports (after line 13):

```javascript
// v26.3: Template variable resolution for automation tasks
var schedulerLib = require('./scheduler');

/**
 * Resolve {{variable}} patterns in text
 * Matches client-side resolveTemplateVars() at index.html:100096
 */
function resolveTemplateVars(text, context) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{\{(\w+)\}\}/g, function(match, key) {
    return context[key] !== undefined ? context[key] : match;
  });
}

/**
 * Build template context with current date/time values
 * @param {string} timezone - User's IANA timezone
 * @param {Object} brand - Brand object
 * @param {Object} settings - User settings
 * @returns {Object} Template context
 */
function buildTemplateContext(timezone, brand, settings) {
  var now = schedulerLib.getUserLocalTime(timezone || 'America/Chicago');
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var hours = now.getHours();
  var ampm = hours >= 12 ? 'PM' : 'AM';
  var h12 = hours % 12 || 12;
  var mins = now.getMinutes();
  mins = mins < 10 ? '0' + mins : String(mins);

  return {
    current_date: months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear(),
    current_time: h12 + ':' + mins + ' ' + ampm,
    day_of_week: days[now.getDay()],
    brand_name: (brand && (brand.shortName || brand.name)) || '',
    user_name: (settings && settings.displayName) || ''
  };
}
```

- [ ] **Step 2: Apply template resolution before AI prompt building**

In the `executeTask` function, add template resolution before the AI path. Insert after line 39 (`task.brand = brand ? ...`):

```javascript
    // v26.3: Resolve template variables in task name/description
    var userSettings = await helpers.getUserSettings(uid);
    var timezone = userSettings.timezone || 'America/Chicago';
    var templateCtx = buildTemplateContext(timezone, brand, userSettings);
    if (task.name) task.name = resolveTemplateVars(task.name, templateCtx);
    if (task.description) task.description = resolveTemplateVars(task.description, templateCtx);
    if (task.target && task.target.text) task.target.text = resolveTemplateVars(task.target.text, templateCtx);
```

This resolves variables BEFORE any action handler runs, so it applies to AI tasks, post tasks, pipeline tasks, etc.

- [ ] **Step 3: Commit**

```bash
git add functions/lib/executor.js
git commit -m "fix: resolve template variables ({{current_date}} etc.) before task execution"
```

---

## Task 6: Add Scavenger Config Storage to index.html

**Files:**
- Modify: `RoweOS/dist/index.html`

This task adds the Firestore save/load for scavenger configs so the Settings UI (which exists in an unreleased build) persists to Firestore where Cloud Functions can read them.

- [ ] **Step 1: Find the Social Hub view section in index.html**

Search for the Social Hub / social view code. It may be referenced as `socialView`, `socialHub`, or within the social-related UI section. If it doesn't exist yet, it needs to be added alongside the nav entry.

The existing nav items are listed in the CLAUDE.md. Social is under PREMIUM in the sidebar. Search for `data-view="social"` or the `Social` nav item to find the insertion point.

- [ ] **Step 2: Add scavenger config save/load functions**

Add these JavaScript functions to handle saving scavenger configs to Firestore (following the existing `saveBrands()` pattern). Insert in the JavaScript section near other social/settings functions:

```javascript
// v26.3: Scavenger config persistence
function getScavengerConfigs() {
  try {
    var raw = localStorage.getItem('roweos_scavenger_configs');
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveScavengerConfigs(configs) {
  try {
    localStorage.setItem('roweos_scavenger_configs', JSON.stringify(configs));
  } catch (e) { console.warn('[Scavenger] localStorage save failed:', e); }

  // Sync to Firestore for Cloud Functions access
  if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
    var uid = firebase.auth().currentUser.uid;
    var db = firebase.firestore();
    for (var i = 0; i < configs.length; i++) {
      var config = configs[i];
      var docId = config.id || String(Date.now()) + '_' + i;
      config.id = docId;
      config.updatedAt = new Date().toISOString();
      if (!config.createdAt) config.createdAt = config.updatedAt;
      db.doc('roweos_users/' + uid + '/scavenger_configs/' + docId)
        .set(config, { merge: true })
        .catch(function(e) { console.warn('[Scavenger] Firestore save error:', e); });
    }
  }
}

function loadScavengerConfigsFromFirestore() {
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  firebase.firestore().collection('roweos_users/' + uid + '/scavenger_configs')
    .get()
    .then(function(snap) {
      if (snap.empty) return;
      var configs = [];
      snap.forEach(function(doc) {
        var data = doc.data();
        data.id = doc.id;
        configs.push(data);
      });
      localStorage.setItem('roweos_scavenger_configs', JSON.stringify(configs));
      console.log('[Scavenger] Loaded', configs.length, 'configs from Firestore');
    })
    .catch(function(e) { console.warn('[Scavenger] Firestore load error:', e); });
}
```

- [ ] **Step 3: Wire save button**

Find the existing Scavenger Settings Save button handler (if it exists in the unreleased UI) or add one. It should call `saveScavengerConfigs()` with the form data.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat: add scavenger config persistence (localStorage + Firestore)"
```

---

## Task 7: Add Scavenger Activity UI to index.html

**Files:**
- Modify: `RoweOS/dist/index.html`

This task adds the Activity tab showing scavenger targets with direct links, scores, and review actions.

- [ ] **Step 1: Add Activity tab CSS**

Add CSS in the styles section (within the first ~15,000 lines) for the scavenger activity cards:

```css
/* v26.3: Scavenger Activity */
.scavenger-activity-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}
.scavenger-activity-card:hover {
  border-color: rgba(255,255,255,0.15);
}
.scavenger-target-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.scavenger-target-author {
  font-weight: 600;
  color: var(--accent, #a89878);
}
.scavenger-target-author a {
  color: var(--accent, #a89878);
  text-decoration: none;
}
.scavenger-target-author a:hover {
  text-decoration: underline;
}
.scavenger-target-followers {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  margin-left: 6px;
}
.scavenger-target-content {
  font-size: 14px;
  color: rgba(255,255,255,0.7);
  margin-bottom: 8px;
  line-height: 1.5;
}
.scavenger-target-content a {
  color: var(--accent, #a89878);
  text-decoration: none;
  font-size: 12px;
  margin-left: 8px;
}
.scavenger-target-content a:hover {
  text-decoration: underline;
}
.scavenger-keyword-pill {
  display: inline-block;
  background: var(--brand-accent-10, rgba(168,152,120,0.1));
  color: var(--accent, #a89878);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-right: 4px;
  margin-bottom: 4px;
}
.scavenger-score {
  font-size: 20px;
  font-weight: 700;
}
.scavenger-score.high { color: #4ade80; }
.scavenger-score.medium { color: #fbbf24; }
.scavenger-score.low { color: #ef4444; }
.scavenger-draft-text {
  background: rgba(255,255,255,0.03);
  border-left: 2px solid var(--accent, #a89878);
  padding: 8px 12px;
  margin: 8px 0;
  font-size: 13px;
  color: rgba(255,255,255,0.8);
  border-radius: 0 8px 8px 0;
}
.scavenger-status-badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.scavenger-status-badge.posted { background: rgba(74,222,128,0.15); color: #4ade80; }
.scavenger-status-badge.pending_review { background: rgba(251,191,36,0.15); color: #fbbf24; }
.scavenger-status-badge.rejected { background: rgba(239,68,68,0.15); color: #ef4444; }
.scavenger-status-badge.post_failed { background: rgba(239,68,68,0.15); color: #ef4444; }
.scavenger-status-badge.discovered,
.scavenger-status-badge.scored,
.scavenger-status-badge.drafted,
.scavenger-status-badge.auto_approved { background: rgba(96,165,250,0.15); color: #60a5fa; }
.scavenger-target-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}
.scavenger-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.scavenger-actions button {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  font-size: 13px;
}
.scavenger-actions button:hover {
  background: rgba(255,255,255,0.1);
}
.scavenger-actions button.approve {
  background: rgba(74,222,128,0.15);
  color: #4ade80;
  border-color: rgba(74,222,128,0.3);
}
.scavenger-actions button.reject {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
  border-color: rgba(239,68,68,0.2);
}
.scavenger-filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.scavenger-filter-btn {
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  font-size: 12px;
}
.scavenger-filter-btn.active {
  background: var(--brand-accent-10, rgba(168,152,120,0.15));
  color: var(--accent, #a89878);
  border-color: var(--accent, #a89878);
}
```

- [ ] **Step 2: Add Activity tab HTML**

In the Social Hub view HTML section, add the Activity tab content panel:

```html
<!-- v26.3: Scavenger Activity Tab -->
<div id="scavengerActivityPanel" style="display:none;">
  <div class="scavenger-filter-bar" id="scavengerFilterBar">
    <button class="scavenger-filter-btn active" onclick="filterScavengerActivity('all')">All</button>
    <button class="scavenger-filter-btn" onclick="filterScavengerActivity('pending_review')">Pending Review</button>
    <button class="scavenger-filter-btn" onclick="filterScavengerActivity('posted')">Posted</button>
    <button class="scavenger-filter-btn" onclick="filterScavengerActivity('rejected')">Rejected</button>
    <button class="scavenger-filter-btn" onclick="filterScavengerActivity('post_failed')">Failed</button>
  </div>
  <div id="scavengerActivityList"></div>
  <div id="scavengerLoadMore" style="text-align:center;padding:16px;display:none;">
    <button onclick="loadMoreScavengerTargets()" style="padding:8px 20px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.6);cursor:pointer;">Load more</button>
  </div>
  <div id="scavengerEmptyState" style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);display:none;">
    No scavenger activity yet. Targets will appear here once the pipeline finds matching posts.
  </div>
</div>
```

- [ ] **Step 3: Add Activity tab JavaScript**

Add the rendering and interaction logic:

```javascript
// v26.3: Scavenger Activity UI

var scavengerActivityState = {
  targets: [],
  filter: 'all',
  lastDoc: null,
  pageSize: 20,
  listener: null
};

function initScavengerActivity() {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();

  // Real-time listener
  if (scavengerActivityState.listener) scavengerActivityState.listener();
  scavengerActivityState.listener = db.collection('roweos_users/' + uid + '/scavenger_targets')
    .orderBy('discoveredAt', 'desc')
    .limit(scavengerActivityState.pageSize)
    .onSnapshot(function(snap) {
      scavengerActivityState.targets = [];
      scavengerActivityState.lastDoc = null;
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        scavengerActivityState.targets.push(data);
        scavengerActivityState.lastDoc = doc;
      });
      renderScavengerActivity();
    }, function(err) {
      console.warn('[Scavenger:Activity] Listener error:', err);
    });
}

function loadMoreScavengerTargets() {
  if (!scavengerActivityState.lastDoc || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();

  db.collection('roweos_users/' + uid + '/scavenger_targets')
    .orderBy('discoveredAt', 'desc')
    .startAfter(scavengerActivityState.lastDoc)
    .limit(scavengerActivityState.pageSize)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        document.getElementById('scavengerLoadMore').style.display = 'none';
        return;
      }
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        scavengerActivityState.targets.push(data);
        scavengerActivityState.lastDoc = doc;
      });
      renderScavengerActivity();
    });
}

function filterScavengerActivity(filter) {
  scavengerActivityState.filter = filter;
  var btns = document.querySelectorAll('.scavenger-filter-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].textContent.toLowerCase().replace(' ', '_') === filter || (filter === 'all' && btns[i].textContent === 'All'));
  }
  renderScavengerActivity();
}

function renderScavengerActivity() {
  var container = document.getElementById('scavengerActivityList');
  var emptyState = document.getElementById('scavengerEmptyState');
  var loadMore = document.getElementById('scavengerLoadMore');
  if (!container) return;

  var filtered = scavengerActivityState.targets;
  if (scavengerActivityState.filter !== 'all') {
    filtered = filtered.filter(function(t) { return t.status === scavengerActivityState.filter; });
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (loadMore) loadMore.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (loadMore) loadMore.style.display = scavengerActivityState.targets.length >= scavengerActivityState.pageSize ? 'block' : 'none';

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    html += renderScavengerCard(filtered[i]);
  }
  container.innerHTML = html;
}

function renderScavengerCard(target) {
  var scoreClass = target.score >= 95 ? 'high' : (target.score >= 70 ? 'medium' : 'low');
  var timeAgo = getRelativeTime(target.discoveredAt);
  var authorDisplay = '@' + escapeHtml(target.authorHandle || 'unknown');
  var followersDisplay = formatFollowerCount(target.authorFollowers || 0);
  var contentPreview = escapeHtml((target.content || '').substring(0, 140));
  if ((target.content || '').length > 140) contentPreview += '...';

  var keywordPills = '';
  var kw = target.keywordsMatched || [];
  for (var k = 0; k < kw.length; k++) {
    keywordPills += '<span class="scavenger-keyword-pill">' + escapeHtml(kw[k]) + '</span>';
  }

  var draftSection = '';
  if (target.draftText) {
    draftSection = '<div class="scavenger-draft-text">' + escapeHtml(target.draftText) + '</div>';
  }

  var replyLink = '';
  if (target.status === 'posted' && target.replyUrl) {
    replyLink = '<a href="' + escapeHtml(target.replyUrl) + '" target="_blank" rel="noopener">View reply</a>';
  }

  var actions = '';
  if (target.status === 'pending_review') {
    actions = '<div class="scavenger-actions">' +
      '<button class="approve" onclick="approveScavengerTarget(\'' + target._id + '\')">Approve</button>' +
      '<button onclick="editScavengerTarget(\'' + target._id + '\')">Edit & Approve</button>' +
      '<button class="reject" onclick="rejectScavengerTarget(\'' + target._id + '\')">Reject</button>' +
      '</div>';
  }

  var errorInfo = '';
  if (target.status === 'post_failed' && target.error) {
    errorInfo = '<div style="color:#ef4444;font-size:12px;margin-top:4px;">Error: ' + escapeHtml(target.error) + '</div>';
  }

  return '<div class="scavenger-activity-card">' +
    '<div class="scavenger-target-header">' +
      '<div>' +
        '<span class="scavenger-target-author"><a href="https://x.com/' + escapeHtml(target.authorHandle || '') + '" target="_blank" rel="noopener">' + authorDisplay + '</a></span>' +
        '<span class="scavenger-target-followers">(' + followersDisplay + ')</span>' +
      '</div>' +
      '<div class="scavenger-score ' + scoreClass + '">' + (target.score || 0) + '</div>' +
    '</div>' +
    '<div class="scavenger-target-content">' + contentPreview +
      ' <a href="' + escapeHtml(target.postUrl || '#') + '" target="_blank" rel="noopener">View post</a>' +
    '</div>' +
    '<div>' + keywordPills + '</div>' +
    draftSection +
    '<div class="scavenger-target-meta">' +
      '<span class="scavenger-status-badge ' + (target.status || '') + '">' + escapeHtml(target.status || '').replace(/_/g, ' ') + '</span>' +
      '<span>' + escapeHtml(target.configName || '') + '</span>' +
      '<span>' + timeAgo + '</span>' +
      replyLink +
    '</div>' +
    errorInfo +
    actions +
    '</div>';
}

function formatFollowerCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function getRelativeTime(timestamp) {
  if (!timestamp) return '';
  var date;
  if (timestamp.toDate) date = timestamp.toDate();
  else if (typeof timestamp === 'string') date = new Date(timestamp);
  else return '';

  var diff = Date.now() - date.getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  var days = Math.floor(hours / 24);
  return days + 'd ago';
}

function approveScavengerTarget(targetId) {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var target = null;
  for (var i = 0; i < scavengerActivityState.targets.length; i++) {
    if (scavengerActivityState.targets[i]._id === targetId) {
      target = scavengerActivityState.targets[i];
      break;
    }
  }
  if (!target || !target.draftText) return;

  showToast('Posting reply...', 'info');

  // Post via direct X API call (bypasses client-side postToSocial which has different signature)
  var scope = getSocialKeyScope();
  var token = getSocialToken('x');
  if (!token) {
    showToast('X not connected. Connect in Social settings.', 'error');
    return;
  }

  var payload = { text: target.draftText, reply: { in_reply_to_tweet_id: target.postId } };

  fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(function(resp) { return resp.json().then(function(data) { return { ok: resp.ok, data: data }; }); })
  .then(function(result) {
    if (result.ok && result.data.data && result.data.data.id) {
      var replyId = result.data.data.id;
      var replyUrl = 'https://x.com/i/status/' + replyId;
      firebase.firestore().doc('roweos_users/' + uid + '/scavenger_targets/' + targetId)
        .update({
          status: 'posted',
          replyUrl: replyUrl,
          reviewedBy: 'manual',
          postedAt: new Date().toISOString()
        });
      showToast('Reply posted!', 'success');
    } else {
      showToast('Post failed: ' + JSON.stringify(result.data), 'error');
    }
  })
  .catch(function(err) {
    showToast('Post error: ' + err.message, 'error');
  });
}

function editScavengerTarget(targetId) {
  var target = null;
  for (var i = 0; i < scavengerActivityState.targets.length; i++) {
    if (scavengerActivityState.targets[i]._id === targetId) {
      target = scavengerActivityState.targets[i];
      break;
    }
  }
  if (!target) return;

  var newDraft = prompt('Edit reply:', target.draftText || '');
  if (newDraft === null) return; // cancelled
  if (newDraft.length > 280) {
    showToast('Reply must be under 280 characters', 'error');
    return;
  }

  // Update draft then approve
  var uid = firebase.auth().currentUser.uid;
  firebase.firestore().doc('roweos_users/' + uid + '/scavenger_targets/' + targetId)
    .update({ draftText: newDraft })
    .then(function() {
      target.draftText = newDraft;
      approveScavengerTarget(targetId);
    });
}

function rejectScavengerTarget(targetId) {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  firebase.firestore().doc('roweos_users/' + uid + '/scavenger_targets/' + targetId)
    .update({
      status: 'rejected',
      reviewedBy: 'manual',
      decidedAt: new Date().toISOString()
    });
  showToast('Target rejected', 'info');
}
```

- [ ] **Step 4: Initialize activity listener when Social Hub loads**

Add a call to `initScavengerActivity()` in the Social Hub tab switching logic, when the Activity tab is selected.

- [ ] **Step 5: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat: add Scavenger Activity UI with target cards, filters, and review actions"
```

---

## Task 8: Deploy and Verify

**Files:** None (deployment only)

- [ ] **Step 1: Deploy Cloud Functions**

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project"
firebase deploy --only functions
```

Watch for deployment errors. If any `require()` fails, check the module paths.

- [ ] **Step 2: Deploy app**

```bash
./deploy.sh
```

- [ ] **Step 3: Verify in Firebase Console**

Check Cloud Functions logs for:
- `[Cloud Scheduler] Tick at` — confirms scheduler is running
- `[Scavenger] Starting pipeline` — confirms scavenger is integrated
- No `require` or import errors

- [ ] **Step 4: Verify template resolution**

Create a test automation with `{{current_date}}` in the name. Trigger it manually via the app or wait for the scheduler. Check that the result has the resolved date, not the literal template variable.

- [ ] **Step 5: Verify Scavenger Activity UI**

Navigate to Social Hub > Activity tab. Should show empty state initially. Once the pipeline runs and finds targets, cards should appear with direct links.
