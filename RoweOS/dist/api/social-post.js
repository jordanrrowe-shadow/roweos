// v17.0: Social Media Posting Proxy
// Vercel serverless function — posts content to X, Threads, Instagram APIs
// Handles platform-specific posting flows (X direct, Threads/Instagram two-step container)
// v18.5: Added imageBase64 → Vercel Blob upload for Threads/Instagram image posting
// v18.7: Switched from raw fetch to @vercel/blob SDK for reliable uploads

import { put } from '@vercel/blob';

// Upload base64 image to Vercel Blob and return public URL
// Returns { url } on success or { error } on failure
async function uploadImageToBlob(base64Data) {
  // @vercel/blob reads BLOB_READ_WRITE_TOKEN from env automatically
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { error: 'BLOB_READ_WRITE_TOKEN not configured in Vercel environment variables' };
  }

  // Strip data URI prefix if present
  var cleanBase64 = base64Data;
  var contentType = 'image/png';
  if (base64Data.indexOf('data:') === 0) {
    var commaIdx = base64Data.indexOf(',');
    if (commaIdx > -1) {
      var prefix = base64Data.substring(0, commaIdx);
      if (prefix.indexOf('image/jpeg') > -1 || prefix.indexOf('image/jpg') > -1) contentType = 'image/jpeg';
      else if (prefix.indexOf('image/webp') > -1) contentType = 'image/webp';
      else if (prefix.indexOf('image/gif') > -1) contentType = 'image/gif';
      cleanBase64 = base64Data.substring(commaIdx + 1);
    }
  }

  var buffer = Buffer.from(cleanBase64, 'base64');
  var ext = contentType === 'image/jpeg' ? '.jpg' : contentType === 'image/webp' ? '.webp' : contentType === 'image/gif' ? '.gif' : '.png';
  var filename = 'roweos-social-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8) + ext;

  console.log('[Social Post] Attempting blob upload:', filename, contentType, buffer.length, 'bytes');

  try {
    var blob = await put(filename, buffer, {
      access: 'public',
      contentType: contentType
    });
    if (blob.url) {
      console.log('[Social Post] Image uploaded to Vercel Blob:', blob.url);
      return { url: blob.url };
    }
    console.error('[Social Post] Blob upload returned no URL:', JSON.stringify(blob));
    return { error: 'Blob upload returned no URL' };
  } catch (err) {
    console.error('[Social Post] Blob upload error:', err.message, err.stack);
    return { error: 'Blob upload failed: ' + err.message };
  }
}

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
    var imageBase64 = body.imageBase64 || '';

    if (!platform || ['x', 'threads', 'instagram'].indexOf(platform) === -1) {
      return res.status(400).json({ error: 'Invalid platform. Must be x, threads, or instagram.' });
    }
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing accessToken' });
    }
    if (!content && mediaIds.length === 0 && !imageBase64) {
      return res.status(400).json({ error: 'Must provide content, mediaIds, or imageBase64' });
    }

    // v18.5: For Threads/Instagram, upload base64 image to Vercel Blob to get a public URL
    var uploadedImageUrl = null;
    if (imageBase64 && (platform === 'threads' || platform === 'instagram')) {
      var blobResult = await uploadImageToBlob(imageBase64);
      if (blobResult.error) {
        console.warn('[Social Post] Image upload failed for ' + platform + ':', blobResult.error);
        return res.status(400).json({ error: 'Image upload failed: ' + blobResult.error, detail: 'Image was provided but could not be uploaded to Vercel Blob storage' });
      }
      uploadedImageUrl = blobResult.url;
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

      // v18.5: Use uploaded image URL (from Blob) or existing mediaIds
      var tImageUrl = uploadedImageUrl || (mediaIds.length > 0 ? mediaIds[0] : null);
      if (tImageUrl) {
        tContainerBody = 'media_type=IMAGE' +
          '&image_url=' + encodeURIComponent(tImageUrl) +
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
        console.error('[Social Post] Threads container failed:', JSON.stringify(tContainerData), 'Status:', tContainerResp.status, 'Image URL:', tImageUrl ? tImageUrl.substring(0, 100) : 'none');
        // v18.6: More descriptive error for common Threads failures
        var tErrMsg = 'Threads container creation failed';
        if (tContainerData.error && tContainerData.error.message) {
          tErrMsg = 'Threads: ' + tContainerData.error.message;
        }
        return res.status(400).json({ error: tErrMsg, detail: tContainerData });
      }

      // v18.5: Wait for container to finish processing (especially for image uploads)
      if (tImageUrl) {
        var tReady = false;
        for (var tPoll = 0; tPoll < 15; tPoll++) {
          await new Promise(function(resolve) { setTimeout(resolve, 2000); });
          try {
            var tStatusResp = await fetch('https://graph.threads.net/v1.0/' + tContainerData.id + '?fields=status&access_token=' + encodeURIComponent(accessToken));
            var tStatusData = await tStatusResp.json();
            console.log('[Social Post] Threads container status poll ' + tPoll + ':', tStatusData.status);
            if (tStatusData.status === 'FINISHED') { tReady = true; break; }
            if (tStatusData.status === 'ERROR') {
              return res.status(400).json({ error: 'Threads media processing failed', detail: tStatusData });
            }
          } catch (pollErr) { console.warn('[Social Post] Threads poll error:', pollErr.message); }
        }
        if (!tReady) {
          return res.status(400).json({ error: 'Threads media processing timed out after 30s' });
        }
      } else {
        await new Promise(function(resolve) { setTimeout(resolve, 500); });
      }

      // Step 2: Publish the container via POST body
      var tPublishResp = await fetch('https://graph.threads.net/v1.0/' + userId + '/threads_publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'creation_id=' + tContainerData.id +
              '&access_token=' + encodeURIComponent(accessToken)
      });
      var tPublishData = await tPublishResp.json();

      if (!tPublishResp.ok || !tPublishData.id) {
        console.error('[Social Post] Threads publish failed:', JSON.stringify(tPublishData), 'Status:', tPublishResp.status);
        var tPubErrMsg = 'Threads publish failed';
        if (tPublishData.error && tPublishData.error.message) {
          tPubErrMsg = 'Threads publish: ' + tPublishData.error.message;
        }
        return res.status(400).json({ error: tPubErrMsg, detail: tPublishData });
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

      // v18.5: Use uploaded image URL (from Blob) or existing mediaIds
      var igImageUrl = uploadedImageUrl || (mediaIds.length > 0 ? mediaIds[0] : null);

      // Instagram requires an image URL — text-only posts not supported
      if (!igImageUrl) {
        return res.status(400).json({ error: 'Instagram requires an image to post. Add an image or configure BLOB_READ_WRITE_TOKEN in Vercel for image uploads.' });
      }

      // Step 1: Create media container
      var igContainerResp = await fetch('https://graph.instagram.com/v21.0/' + userId + '/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'image_url=' + encodeURIComponent(igImageUrl) +
              '&caption=' + encodeURIComponent(content) +
              '&access_token=' + encodeURIComponent(accessToken)
      });
      var igContainerData = await igContainerResp.json();

      if (!igContainerResp.ok || !igContainerData.id) {
        console.error('[Social Post] Instagram container failed:', igContainerData);
        return res.status(400).json({ error: 'Instagram container creation failed', detail: igContainerData });
      }

      // v18.5: Wait for Instagram container to finish processing
      var igReady = false;
      for (var igPoll = 0; igPoll < 15; igPoll++) {
        await new Promise(function(resolve) { setTimeout(resolve, 2000); });
        try {
          var igStatusResp = await fetch('https://graph.instagram.com/v21.0/' + igContainerData.id + '?fields=status_code&access_token=' + encodeURIComponent(accessToken));
          var igStatusData = await igStatusResp.json();
          console.log('[Social Post] Instagram container status poll ' + igPoll + ':', igStatusData.status_code);
          if (igStatusData.status_code === 'FINISHED') { igReady = true; break; }
          if (igStatusData.status_code === 'ERROR') {
            return res.status(400).json({ error: 'Instagram media processing failed', detail: igStatusData });
          }
        } catch (igPollErr) { console.warn('[Social Post] Instagram poll error:', igPollErr.message); }
      }
      if (!igReady) {
        return res.status(400).json({ error: 'Instagram media processing timed out after 30s' });
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
