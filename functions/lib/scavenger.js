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
  var tag = '[Scavenger:' + uid.slice(0,6) + ':poll]';
  console.log(tag + ' Starting poll for config "' + config.configName + '", keywords: ' + (Array.isArray(config.keywords) ? config.keywords.join(', ') : config.keywords));
  var newTargets = 0;

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
      newTargets++;
      console.log('[Scavenger:Poll] New target:', authorHandle, '- matched:', matched.join(', '));
    }
  } catch (err) {
    console.error('[Scavenger:Poll] Error:', err.message);
  }
  console.log(tag + ' Poll complete — ' + newTargets + ' new targets created');
}

/**
 * Step 2: SCORE — Calculate confidence score for discovered targets
 * Composite: Relevance (50%) + Authority (30%) + Engagement (20%)
 */
async function stepScore(uid) {
  var tag = '[Scavenger:' + uid.slice(0,6) + ':score]';
  var targets = await helpers.getScavengerTargetsByStatus(uid, 'discovered');
  if (targets.length === 0) {
    console.log(tag + ' No discovered targets to score');
    return;
  }

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

  // Score distribution summary
  var scored = targets.map(function(t) { return t.score || 0; });
  var avgScore = scored.length > 0 ? Math.round(scored.reduce(function(a, b) { return a + b; }, 0) / scored.length) : 0;
  var highCount = scored.filter(function(s) { return s >= 80; }).length;
  var midCount = scored.filter(function(s) { return s >= 50 && s < 80; }).length;
  var lowCount = scored.filter(function(s) { return s < 50; }).length;
  console.log(tag + ' Score complete — ' + targets.length + ' scored, avg: ' + avgScore + ', high(80+): ' + highCount + ', mid(50-79): ' + midCount + ', low(<50): ' + lowCount);
}

/**
 * Step 3: DRAFT — Generate AI reply for scored targets above threshold
 */
async function stepDraft(uid, apiKeys, config) {
  var tag = '[Scavenger:' + uid.slice(0,6) + ':draft]';
  console.log(tag + ' Drafting — threshold: ' + (config.autoPostThreshold || 'none') + ', model: ' + (config.aiModel || 'default'));
  var targets = await helpers.getScavengerTargetsByStatus(uid, 'scored');
  if (targets.length === 0) {
    console.log(tag + ' No scored targets to draft');
    return;
  }

  // Filter to targets for this config
  var configTargets = targets.filter(function(t) { return t.configId === config.id; });
  console.log(tag + ' ' + configTargets.length + ' targets for config "' + config.configName + '"');

  var threshold = config.autoPostThreshold || 0;
  var draftedCount = 0;
  var rejectedCount = 0;

  for (var i = 0; i < configTargets.length; i++) {
    var target = configTargets[i];

    // Reject below threshold (0 = manual only, also reject)
    if (threshold === 0 || target.score < threshold) {
      console.log(tag + ' Rejecting @' + target.authorHandle + ' — score ' + target.score + ' below threshold ' + threshold);
      await helpers.updateScavengerTarget(uid, target._id, {
        status: 'rejected',
        decidedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      rejectedCount++;
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
        draftedCount++;
        console.log('[Scavenger:Draft] Drafted reply for @' + target.authorHandle);
      }
    } catch (err) {
      console.error('[Scavenger:Draft] Error drafting for target:', target._id, err.message);
    }
  }
  console.log(tag + ' Draft complete — drafted: ' + draftedCount + ', rejected: ' + rejectedCount);
}

/**
 * Step 4: DECIDE — Auto-approve (score >= 95) or queue for review
 */
async function stepDecide(uid) {
  var tag = '[Scavenger:' + uid.slice(0,6) + ':decide]';
  var targets = await helpers.getScavengerTargetsByStatus(uid, 'drafted');
  if (targets.length === 0) {
    console.log(tag + ' No drafted targets to decide');
    return;
  }

  var autoApprovedCount = 0;
  var pendingReviewCount = 0;

  for (var i = 0; i < targets.length; i++) {
    var target = targets[i];
    if (target.score >= 95) {
      await helpers.updateScavengerTarget(uid, target._id, {
        status: 'auto_approved',
        reviewedBy: 'auto',
        decidedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      autoApprovedCount++;
      console.log('[Scavenger:Decide] Auto-approved target for @' + target.authorHandle + ' (score: ' + target.score + ')');
    } else {
      await helpers.updateScavengerTarget(uid, target._id, {
        status: 'pending_review',
        decidedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      pendingReviewCount++;
      console.log('[Scavenger:Decide] Queued for review: @' + target.authorHandle + ' (score: ' + target.score + ')');
    }
  }
  console.log(tag + ' Decide complete — auto-approved: ' + autoApprovedCount + ', pending-review: ' + pendingReviewCount);
}

/**
 * Step 5: POST — Post auto-approved replies, respecting rate limits
 */
async function stepPost(uid, config) {
  var tag = '[Scavenger:' + uid.slice(0,6) + ':post]';
  var targets = await helpers.getScavengerTargetsByStatus(uid, 'auto_approved');
  if (targets.length === 0) {
    console.log(tag + ' No auto-approved targets to post');
    return;
  }

  // Filter to this config's targets
  var configTargets = targets.filter(function(t) { return t.configId === config.id; });
  if (configTargets.length === 0) {
    console.log(tag + ' No auto-approved targets for config "' + config.configName + '"');
    return;
  }

  // Rate limit check
  var maxPerHour = config.maxPerHour || 5;
  var maxPerDay = config.maxPerDay || 20;
  var oneHourAgo = Date.now() - (60 * 60 * 1000);
  var oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

  var postedLastHour = await helpers.countScavengerTargets(uid, config.id, 'posted', oneHourAgo);
  var postedLastDay = await helpers.countScavengerTargets(uid, config.id, 'posted', oneDayAgo);

  console.log(tag + ' Rate limits — hour: ' + postedLastHour + '/' + maxPerHour + ', day: ' + postedLastDay + '/' + maxPerDay);

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
    console.error(tag + ' NO X TOKEN — cannot post. User needs to reconnect X.');
    return;
  }
  if (xToken.expiresAt && xToken.expiresAt < Date.now()) {
    console.error(tag + ' X TOKEN EXPIRED at ' + new Date(xToken.expiresAt).toISOString());
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
        console.log(tag + ' POST SUCCESS — replied to @' + target.authorHandle + ' (score: ' + target.score + ') url: ' + (postResult.postUrl || 'n/a'));
        console.log('[Scavenger:Post] Posted reply to @' + target.authorHandle);
        // v25.4: Log to social_activity for Activity tab
        try {
          await helpers.getDb().collection('roweos_users/' + uid + '/social_activity').add({
            type: 'scavenger_reply',
            platform: 'x',
            description: 'Auto-replied to @' + target.authorHandle + ': ' + (target.draftText || '').substring(0, 80),
            details: {
              postUrl: postResult.postUrl || '',
              targetAuthor: target.authorHandle,
              content: (target.draftText || '').substring(0, 200)
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            automatic: true
          });
        } catch (logErr) {
          console.warn('[Scavenger:Post] Activity log error:', logErr.message);
        }
      } else {
        await helpers.updateScavengerTarget(uid, target._id, {
          error: postResult.error || 'Post failed',
          status: 'post_failed',
          postedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.error(tag + ' POST FAILED — @' + target.authorHandle + ' error: ' + (postResult.error || 'unknown'));
        console.error('[Scavenger:Post] Failed:', postResult.error);
      }
    } catch (err) {
      await helpers.updateScavengerTarget(uid, target._id, {
        error: err.message,
        status: 'post_failed',
        postedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.error(tag + ' POST EXCEPTION — @' + target.authorHandle + ': ' + err.message);
      console.error('[Scavenger:Post] Error posting reply:', err.message);
    }
  }
}

module.exports = {
  runScavengerPipeline: runScavengerPipeline
};
