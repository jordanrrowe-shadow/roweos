/**
 * RoweOS Cloud Functions — Social Poster
 * v19.5: Posts content to X, Threads, Instagram APIs
 * Ported from Vercel serverless function (RoweOS/dist/api/social-post.js)
 *
 * Key difference from Vercel version:
 * - No Vercel Blob for image uploads — uses Firebase Storage URLs instead
 * - Reads tokens from Firestore (via executor) instead of request body
 * - Direct HTTP calls, no CORS needed (server-to-server)
 */

var fetch = require('node-fetch');

/**
 * Post content to a social platform
 * @param {string} platform - 'x', 'threads', or 'instagram'
 * @param {string} accessToken - OAuth access token
 * @param {string} content - Post text content
 * @param {string} userId - Platform user/page ID (required for Threads/Instagram)
 * @param {string} imageUrl - Optional public image URL for media posts
 * @returns {Object} { success, postId, postUrl, platform, error }
 */
async function postToSocial(platform, accessToken, content, userId, imageUrl) {
  try {
    if (platform === 'x') {
      return await postToX(accessToken, content, imageUrl);
    } else if (platform === 'threads') {
      return await postToThreads(accessToken, content, userId, imageUrl);
    } else if (platform === 'instagram') {
      return await postToInstagram(accessToken, content, userId, imageUrl);
    } else {
      return { success: false, platform: platform, error: 'Unsupported platform: ' + platform };
    }
  } catch (err) {
    console.error('[SocialPoster] Error posting to ' + platform + ':', err.message);
    return { success: false, platform: platform, error: err.message };
  }
}

/**
 * Post to X/Twitter
 * Simple POST to tweets endpoint
 */
async function postToX(accessToken, content, imageUrl) {
  var payload = { text: content };
  // Note: X image posting requires media upload API (separate OAuth flow)
  // Cloud functions only support text posts to X for now

  var resp = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    timeout: 30000
  });
  var data = await resp.json();

  if (!resp.ok) {
    console.error('[SocialPoster] X post failed:', JSON.stringify(data));
    return { success: false, platform: 'x', error: 'X post failed (' + resp.status + ')', detail: data };
  }

  var tweetId = data.data && data.data.id;
  return {
    success: true,
    platform: 'x',
    postId: tweetId,
    postUrl: tweetId ? 'https://x.com/i/status/' + tweetId : null
  };
}

/**
 * Post to Threads (two-step: create container, then publish)
 * v18.1 pattern: POST body with Content-Type, not URL params
 */
async function postToThreads(accessToken, content, userId, imageUrl) {
  if (!userId) {
    return { success: false, platform: 'threads', error: 'Missing userId for Threads' };
  }

  // Step 1: Create media container
  var containerBody = 'media_type=TEXT&text=' + encodeURIComponent(content) +
    '&access_token=' + encodeURIComponent(accessToken);

  if (imageUrl) {
    containerBody = 'media_type=IMAGE' +
      '&image_url=' + encodeURIComponent(imageUrl) +
      '&text=' + encodeURIComponent(content) +
      '&access_token=' + encodeURIComponent(accessToken);
  }

  var containerResp = await fetch('https://graph.threads.net/v1.0/' + userId + '/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: containerBody,
    timeout: 30000
  });
  var containerData = await containerResp.json();

  if (!containerResp.ok || !containerData.id) {
    console.error('[SocialPoster] Threads container failed:', JSON.stringify(containerData));
    var errMsg = 'Threads container creation failed';
    if (containerData.error && containerData.error.message) {
      errMsg = 'Threads: ' + containerData.error.message;
    }
    return { success: false, platform: 'threads', error: errMsg };
  }

  // Poll for container ready (required for image uploads, short delay for text)
  if (imageUrl) {
    var ready = false;
    for (var poll = 0; poll < 15; poll++) {
      await sleep(2000);
      try {
        var statusResp = await fetch('https://graph.threads.net/v1.0/' + containerData.id +
          '?fields=status&access_token=' + encodeURIComponent(accessToken));
        var statusData = await statusResp.json();
        console.log('[SocialPoster] Threads poll ' + poll + ':', statusData.status);
        if (statusData.status === 'FINISHED') { ready = true; break; }
        if (statusData.status === 'ERROR') {
          return { success: false, platform: 'threads', error: 'Threads media processing failed' };
        }
      } catch (e) { console.warn('[SocialPoster] Threads poll error:', e.message); }
    }
    if (!ready) {
      return { success: false, platform: 'threads', error: 'Threads media processing timed out' };
    }
  } else {
    await sleep(500);
  }

  // Step 2: Publish
  var publishResp = await fetch('https://graph.threads.net/v1.0/' + userId + '/threads_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'creation_id=' + containerData.id +
      '&access_token=' + encodeURIComponent(accessToken),
    timeout: 30000
  });
  var publishData = await publishResp.json();

  if (!publishResp.ok || !publishData.id) {
    console.error('[SocialPoster] Threads publish failed:', JSON.stringify(publishData));
    var pubErr = 'Threads publish failed';
    if (publishData.error && publishData.error.message) {
      pubErr = 'Threads publish: ' + publishData.error.message;
    }
    return { success: false, platform: 'threads', error: pubErr };
  }

  return {
    success: true,
    platform: 'threads',
    postId: publishData.id,
    postUrl: 'https://www.threads.net/post/' + publishData.id
  };
}

/**
 * Post to Instagram (two-step: create container, then publish)
 * Requires an image URL — text-only not supported by Instagram API
 */
async function postToInstagram(accessToken, content, userId, imageUrl) {
  if (!userId) {
    return { success: false, platform: 'instagram', error: 'Missing userId for Instagram' };
  }
  if (!imageUrl) {
    return { success: false, platform: 'instagram', error: 'Instagram requires an image URL' };
  }

  // Step 1: Create media container
  var containerResp = await fetch('https://graph.instagram.com/v21.0/' + userId + '/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'image_url=' + encodeURIComponent(imageUrl) +
      '&caption=' + encodeURIComponent(content) +
      '&access_token=' + encodeURIComponent(accessToken),
    timeout: 30000
  });
  var containerData = await containerResp.json();

  if (!containerResp.ok || !containerData.id) {
    console.error('[SocialPoster] Instagram container failed:', JSON.stringify(containerData));
    return { success: false, platform: 'instagram', error: 'Instagram container creation failed' };
  }

  // Poll for container ready
  var ready = false;
  for (var poll = 0; poll < 15; poll++) {
    await sleep(2000);
    try {
      var statusResp = await fetch('https://graph.instagram.com/v21.0/' + containerData.id +
        '?fields=status_code&access_token=' + encodeURIComponent(accessToken));
      var statusData = await statusResp.json();
      console.log('[SocialPoster] Instagram poll ' + poll + ':', statusData.status_code);
      if (statusData.status_code === 'FINISHED') { ready = true; break; }
      if (statusData.status_code === 'ERROR') {
        return { success: false, platform: 'instagram', error: 'Instagram media processing failed' };
      }
    } catch (e) { console.warn('[SocialPoster] Instagram poll error:', e.message); }
  }
  if (!ready) {
    return { success: false, platform: 'instagram', error: 'Instagram media processing timed out' };
  }

  // Step 2: Publish
  var publishResp = await fetch('https://graph.instagram.com/v21.0/' + userId + '/media_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'creation_id=' + containerData.id +
      '&access_token=' + encodeURIComponent(accessToken),
    timeout: 30000
  });
  var publishData = await publishResp.json();

  if (!publishResp.ok || !publishData.id) {
    console.error('[SocialPoster] Instagram publish failed:', JSON.stringify(publishData));
    return { success: false, platform: 'instagram', error: 'Instagram publish failed' };
  }

  return {
    success: true,
    platform: 'instagram',
    postId: publishData.id,
    postUrl: 'https://www.instagram.com/p/' + publishData.id
  };
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

module.exports = { postToSocial: postToSocial };
