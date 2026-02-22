// v16.14: CalDAV proxy for iCloud Calendar integration
// Vercel serverless function — stateless pass-through to caldav.icloud.com
// Browser cannot call CalDAV directly due to CORS restrictions

export default async function handler(req, res) {
  // CORS headers — allow both roweos.vercel.app and roweos.com
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
    // v16.14: Handle both parsed and raw body
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Missing request body' });
    }

    var url = body.url || '';
    var auth = body.auth; // { username, password }
    var method = body.method || 'PROPFIND';
    var depth = body.depth != null ? String(body.depth) : '1';
    var xmlBody = body.xmlBody || '';
    var contentType = body.contentType || 'application/xml; charset=utf-8';

    // v16.14: Validate URL — allow caldav.icloud.com and partition servers (pXX-caldav)
    var icloudPattern = /^https:\/\/([a-z0-9-]+\.)?caldav\.icloud\.com(\/|$)/;
    if (!url || !icloudPattern.test(url)) {
      console.error('[CalDAV Proxy] URL rejected:', url);
      return res.status(400).json({ error: 'Invalid CalDAV URL: ' + (url || '(empty)') + '. Only caldav.icloud.com is allowed.' });
    }

    if (!auth || !auth.username || !auth.password) {
      return res.status(400).json({ error: 'Missing auth credentials' });
    }

    // Build Basic Auth header
    var authStr = Buffer.from(auth.username + ':' + auth.password).toString('base64');

    var headers = {
      'Authorization': 'Basic ' + authStr,
      'Content-Type': contentType,
      'Depth': depth,
    };

    var fetchOpts = {
      method: method,
      headers: Object.assign({}, headers),
      redirect: 'manual', // v16.13: Handle redirects manually to preserve CalDAV methods
    };

    // Only add body for methods that use it
    if (method !== 'GET' && method !== 'DELETE' && xmlBody) {
      fetchOpts.body = xmlBody;
    }

    // v16.13: Follow redirects manually (up to 5 hops) — preserves PROPFIND/REPORT method
    var response = await fetch(url, fetchOpts);
    var redirectCount = 0;
    while (response.status >= 300 && response.status < 400 && redirectCount < 5) {
      var location = response.headers.get('location');
      if (!location) break;
      // Make absolute if relative
      if (location.indexOf('http') !== 0) {
        var urlObj = new URL(url);
        location = urlObj.origin + location;
      }
      // Validate redirect target is still iCloud
      if (!icloudPattern.test(location)) {
        console.error('[CalDAV Proxy] Redirect to disallowed host:', location);
        return res.status(400).json({ error: 'Redirect to disallowed host: ' + location });
      }
      url = location;
      fetchOpts.headers = Object.assign({}, headers);
      fetchOpts.method = method; // preserve original method
      response = await fetch(url, fetchOpts);
      redirectCount++;
    }

    var responseBody = await response.text();

    return res.status(200).json({
      status: response.status,
      body: responseBody,
      contentType: response.headers.get('content-type') || '',
      finalUrl: url,
    });
  } catch (err) {
    console.error('[CalDAV Proxy] Error:', err.message, err.stack);
    return res.status(500).json({ error: 'Proxy request failed: ' + err.message });
  }
}
