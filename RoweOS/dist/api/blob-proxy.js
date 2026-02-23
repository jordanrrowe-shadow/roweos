// v18.7: Proxy for private Vercel Blob images
// Threads/Instagram APIs require publicly accessible image URLs.
// This endpoint fetches private blobs using the auth token and serves them publicly.

export default async function handler(req, res) {
  var blobUrl = req.query.url || '';

  // Security: only allow Vercel Blob URLs for roweos-social images
  if (!blobUrl || blobUrl.indexOf('blob.vercel-storage.com') === -1 || blobUrl.indexOf('roweos-social-') === -1) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Cache for 24 hours — image is immutable once uploaded
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Fetch blob with auth token (required for private stores)
    var fetchResp = await fetch(blobUrl, {
      headers: {
        'authorization': 'Bearer ' + (process.env.BLOB_READ_WRITE_TOKEN || '')
      }
    });

    // Fallback: try without auth (public stores)
    if (!fetchResp.ok && (fetchResp.status === 401 || fetchResp.status === 403)) {
      fetchResp = await fetch(blobUrl);
    }

    if (!fetchResp.ok) {
      console.error('[Blob Proxy] Fetch failed:', fetchResp.status);
      return res.status(fetchResp.status).json({ error: 'Blob fetch failed: ' + fetchResp.status });
    }

    res.setHeader('Content-Type', fetchResp.headers.get('content-type') || 'image/png');

    var arrayBuffer = await fetchResp.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[Blob Proxy] Error:', err.message);
    return res.status(500).json({ error: 'Failed to read blob: ' + err.message });
  }
}
