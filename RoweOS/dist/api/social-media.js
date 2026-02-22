// v17.0: Social Media Upload Proxy
// Vercel serverless function — handles image uploads to X (chunked), Threads/Instagram (URL-based)
// X uses chunked media upload (INIT -> APPEND -> FINALIZE)
// Threads/Instagram need a publicly accessible URL — we use X's media upload or return base64 data URL

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
    var imageBase64 = body.imageBase64 || '';
    var mimeType = body.mimeType || 'image/jpeg';
    var imageUrl = body.imageUrl || '';

    if (!platform || ['x', 'threads', 'instagram'].indexOf(platform) === -1) {
      return res.status(400).json({ error: 'Invalid platform. Must be x, threads, or instagram.' });
    }
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing accessToken' });
    }
    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'Must provide imageBase64 or imageUrl' });
    }

    // --- X/Twitter Chunked Media Upload ---
    if (platform === 'x') {
      // Strip data URL prefix if present
      var cleanBase64 = imageBase64;
      if (cleanBase64.indexOf('data:') === 0) {
        var commaIdx = cleanBase64.indexOf(',');
        if (commaIdx > -1) {
          var prefix = cleanBase64.substring(0, commaIdx);
          if (prefix.indexOf('image/png') > -1) mimeType = 'image/png';
          else if (prefix.indexOf('image/gif') > -1) mimeType = 'image/gif';
          else if (prefix.indexOf('image/webp') > -1) mimeType = 'image/webp';
          cleanBase64 = cleanBase64.substring(commaIdx + 1);
        }
      }

      var imageBuffer = Buffer.from(cleanBase64, 'base64');
      var totalBytes = imageBuffer.length;

      // Step 1: INIT
      var initResp = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'command=INIT&total_bytes=' + totalBytes + '&media_type=' + encodeURIComponent(mimeType)
      });
      var initData = await initResp.json();

      if (!initResp.ok || !initData.media_id_string) {
        console.error('[Social Media] X INIT failed:', initData);
        return res.status(400).json({ error: 'X media INIT failed', detail: initData });
      }

      var mediaId = initData.media_id_string;

      // Step 2: APPEND (single chunk for images under 5MB)
      var formBoundary = '----RoweOSBoundary' + Date.now();
      var appendBody = '--' + formBoundary + '\r\n' +
        'Content-Disposition: form-data; name="command"\r\n\r\nAPPEND\r\n' +
        '--' + formBoundary + '\r\n' +
        'Content-Disposition: form-data; name="media_id"\r\n\r\n' + mediaId + '\r\n' +
        '--' + formBoundary + '\r\n' +
        'Content-Disposition: form-data; name="segment_index"\r\n\r\n0\r\n' +
        '--' + formBoundary + '\r\n' +
        'Content-Disposition: form-data; name="media_data"\r\n\r\n' + cleanBase64 + '\r\n' +
        '--' + formBoundary + '--';

      var appendResp = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'multipart/form-data; boundary=' + formBoundary
        },
        body: appendBody
      });

      if (!appendResp.ok) {
        var appendErr = await appendResp.text();
        console.error('[Social Media] X APPEND failed:', appendErr);
        return res.status(400).json({ error: 'X media APPEND failed', detail: appendErr });
      }

      // Step 3: FINALIZE
      var finalResp = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'command=FINALIZE&media_id=' + mediaId
      });
      var finalData = await finalResp.json();

      if (!finalResp.ok) {
        console.error('[Social Media] X FINALIZE failed:', finalData);
        return res.status(400).json({ error: 'X media FINALIZE failed', detail: finalData });
      }

      return res.status(200).json({
        success: true,
        mediaId: mediaId,
        platform: 'x'
      });
    }

    // --- Threads / Instagram ---
    // These platforms require a publicly accessible image URL.
    // If imageUrl is provided, return it directly for use in the post container.
    // If only base64 is provided, the client should use an image hosting service
    // or pass a previously generated image URL.
    if (platform === 'threads' || platform === 'instagram') {
      if (imageUrl) {
        return res.status(200).json({
          success: true,
          mediaUrl: imageUrl,
          platform: platform
        });
      }

      // Base64 only — Threads/Instagram cannot accept base64 directly.
      // Return an error with guidance.
      return res.status(400).json({
        error: platform + ' requires a publicly accessible image URL. ' +
               'Upload the image to a hosting service first, or use an image URL from a previous generation.',
        platform: platform
      });
    }

    return res.status(400).json({ error: 'Unhandled platform' });

  } catch (err) {
    console.error('[Social Media] Error:', err.message, err.stack);
    return res.status(500).json({ error: 'Media upload failed: ' + err.message });
  }
}
