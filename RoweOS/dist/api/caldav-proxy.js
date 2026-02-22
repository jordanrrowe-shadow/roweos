// v16.12: CalDAV proxy for iCloud Calendar integration
// Vercel serverless function — stateless pass-through to caldav.icloud.com
// Browser cannot call CalDAV directly due to CORS restrictions

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://roweos.vercel.app');
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
    var url = body.url;
    var auth = body.auth; // { username, password }
    var method = body.method || 'PROPFIND';
    var depth = body.depth != null ? String(body.depth) : '1';
    var xmlBody = body.xmlBody || '';
    var contentType = body.contentType || 'application/xml; charset=utf-8';

    // Validate URL — only allow caldav.icloud.com (incl. partition redirects pXX-)
    if (!url || !/^https:\/\/(p\d+-)?caldav\.icloud\.com\//.test(url)) {
      return res.status(400).json({ error: 'Invalid CalDAV URL. Only caldav.icloud.com is allowed.' });
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
      headers: headers,
    };

    // Only add body for methods that use it
    if (method !== 'GET' && method !== 'DELETE' && xmlBody) {
      fetchOpts.body = xmlBody;
    }

    var response = await fetch(url, fetchOpts);
    var responseBody = await response.text();

    return res.status(200).json({
      status: response.status,
      body: responseBody,
      contentType: response.headers.get('content-type') || '',
    });
  } catch (err) {
    console.error('[CalDAV Proxy] Error:', err.message);
    return res.status(500).json({ error: 'Proxy request failed: ' + err.message });
  }
}
