// v18.7: Proxy endpoint for private Vercel Blob images
// Threads/Instagram APIs require publicly accessible image URLs.
// When Blob store is private, this endpoint serves as a public proxy.

import { get } from '@vercel/blob';

export default async function handler(req, res) {
  var p = req.query.p || '';

  // Only allow our social images
  if (!p || p.indexOf('roweos-social-') !== 0) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Cache for 24 hours — image is immutable once uploaded
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    var blob = await get(p, { access: 'private' });
    if (!blob || !blob.body) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.setHeader('Content-Type', blob.contentType || 'image/png');

    // Read the stream into a buffer and send
    var chunks = [];
    var reader = blob.body.getReader();
    var done = false;
    while (!done) {
      var result = await reader.read();
      if (result.done) {
        done = true;
      } else {
        chunks.push(Buffer.from(result.value));
      }
    }
    var buffer = Buffer.concat(chunks);
    res.send(buffer);
  } catch (err) {
    console.error('[Blob Proxy] Error:', err.message);
    return res.status(500).json({ error: 'Failed to read blob: ' + err.message });
  }
}
