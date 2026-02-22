// v17.0: Social Media Posting Proxy
// Vercel serverless function — posts content to X, Threads, Instagram APIs
// Handles platform-specific posting flows (X direct, Threads/Instagram two-step container)

export default async function handler(req, res) {
  // CORS headers
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Missing request body' });
    }

    var platform = body.platform;
    var accessToken = body.accessToken;
    var content = body.content || '';
    var mediaIds = body.mediaIds || [];
    var userId = body.userId || '';

    if (!platform || ['x', 'threads', 'instagram'].indexOf(platform) === -1) {
      return res.status(400).json({ error: 'Invalid platform. Must be x, threads, or instagram.' });
    }
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing accessToken' });
    }
    if (!content && mediaIds.length === 0) {
      return res.status(400).json({ error: 'Must provide content or mediaIds' });
    }

    // --- X/Twitter Post ---
    if (platform === 'x') {
      var xPayload = { text: content };
      if (mediaIds.length > 0) {
        xPayload.media = { media_ids: mediaIds };
      }

      var xResp = await fetch('https://api.x.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(xPayload)
      });
      var xData = await xResp.json();

      if (!xResp.ok) {
        console.error('[Social Post] X post failed:', xData);
        return res.status(xResp.status).json({ error: 'X post failed', detail: xData });
      }

      var xTweetId = xData.data && xData.data.id;
      return res.status(200).json({
        success: true,
        postId: xTweetId,
        postUrl: xTweetId ? 'https://x.com/i/status/' + xTweetId : null,
        platform: 'x'
      });
    }

    // --- Threads Post (two-step: create container, then publish) ---
    // v18.1: BUG 5 — Switch to POST body with Content-Type (matches Instagram pattern), add 200ms delay
    if (platform === 'threads') {
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId for Threads post' });
      }

      // Step 1: Create media container via POST body (not URL params)
      var tContainerBody = 'media_type=TEXT&text=' + encodeURIComponent(content) +
        '&access_token=' + encodeURIComponent(accessToken);

      // If image is attached, switch to IMAGE type
      if (mediaIds.length > 0 && mediaIds[0]) {
        tContainerBody = 'media_type=IMAGE' +
          '&image_url=' + encodeURIComponent(mediaIds[0]) +
          '&text=' + encodeURIComponent(content) +
          '&access_token=' + encodeURIComponent(accessToken);
      }

      var tContainerResp = await fetch('https://graph.threads.net/v1.0/' + userId + '/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tContainerBody
      });
      var tContainerData = await tContainerResp.json();

      if (!tContainerResp.ok || !tContainerData.id) {
        console.error('[Social Post] Threads container failed:', tContainerData);
        return res.status(400).json({ error: 'Threads container creation failed', detail: tContainerData });
      }

      // v18.1: Brief delay between container creation and publish
      await new Promise(function(resolve) { setTimeout(resolve, 200); });

      // Step 2: Publish the container via POST body
      var tPublishResp = await fetch('https://graph.threads.net/v1.0/' + userId + '/threads_publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'creation_id=' + tContainerData.id +
              '&access_token=' + encodeURIComponent(accessToken)
      });
      var tPublishData = await tPublishResp.json();

      if (!tPublishResp.ok || !tPublishData.id) {
        console.error('[Social Post] Threads publish failed:', tPublishData);
        return res.status(400).json({ error: 'Threads publish failed', detail: tPublishData });
      }

      return res.status(200).json({
        success: true,
        postId: tPublishData.id,
        postUrl: 'https://www.threads.net/post/' + tPublishData.id,
        platform: 'threads'
      });
    }

    // --- Instagram Post (two-step: create container, then publish) ---
    if (platform === 'instagram') {
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId for Instagram post' });
      }

      // Instagram requires an image URL — text-only posts not supported
      if (mediaIds.length === 0 || !mediaIds[0]) {
        return res.status(400).json({ error: 'Instagram requires an image URL to post' });
      }

      // Step 1: Create media container
      var igContainerResp = await fetch('https://graph.instagram.com/v21.0/' + userId + '/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'image_url=' + encodeURIComponent(mediaIds[0]) +
              '&caption=' + encodeURIComponent(content) +
              '&access_token=' + encodeURIComponent(accessToken)
      });
      var igContainerData = await igContainerResp.json();

      if (!igContainerResp.ok || !igContainerData.id) {
        console.error('[Social Post] Instagram container failed:', igContainerData);
        return res.status(400).json({ error: 'Instagram container creation failed', detail: igContainerData });
      }

      // Step 2: Publish
      var igPublishResp = await fetch('https://graph.instagram.com/v21.0/' + userId + '/media_publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'creation_id=' + igContainerData.id +
              '&access_token=' + encodeURIComponent(accessToken)
      });
      var igPublishData = await igPublishResp.json();

      if (!igPublishResp.ok || !igPublishData.id) {
        console.error('[Social Post] Instagram publish failed:', igPublishData);
        return res.status(400).json({ error: 'Instagram publish failed', detail: igPublishData });
      }

      return res.status(200).json({
        success: true,
        postId: igPublishData.id,
        postUrl: 'https://www.instagram.com/p/' + igPublishData.id,
        platform: 'instagram'
      });
    }

    return res.status(400).json({ error: 'Unhandled platform' });

  } catch (err) {
    console.error('[Social Post] Error:', err.message, err.stack);
    return res.status(500).json({ error: 'Post request failed: ' + err.message });
  }
}
