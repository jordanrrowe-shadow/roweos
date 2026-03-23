// v25.4: X DM API proxy — avoids CORS restrictions on X API
// Accepts: { method, endpoint, token, body? }
// Forwards to X API v2 and returns response

export default async function handler(req, res) {
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    var method = (body && body.method) ? body.method.toUpperCase() : 'GET';
    var endpoint = body && body.endpoint;
    var token = body && body.token;
    var reqBody = body && body.body;

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Missing endpoint' });
    }
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Missing token' });
    }

    // v25.4: Whitelist allowed X API endpoints (DMs, search, tweets, users)
    var allowedPatterns = [
      /^\/2\/dm_conversations/,
      /^\/2\/tweets\/search\/recent/,
      /^\/2\/tweets\?/,
      /^\/2\/tweets$/,
      /^\/2\/users/,
      /^\/2\/likes/
    ];
    var isAllowed = false;
    for (var pi = 0; pi < allowedPatterns.length; pi++) {
      if (allowedPatterns[pi].test(endpoint)) { isAllowed = true; break; }
    }
    if (!isAllowed) {
      return res.status(400).json({ error: 'Endpoint not allowed' });
    }

    var url = 'https://api.x.com' + endpoint;

    var fetchOptions = {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    if (method !== 'GET' && reqBody) {
      fetchOptions.body = JSON.stringify(reqBody);
    }

    var xResponse = await fetch(url, fetchOptions);

    // Handle token expiry
    if (xResponse.status === 401) {
      return res.status(200).json({ error: 'token_expired' });
    }

    // Handle rate limiting with retry once
    if (xResponse.status === 429) {
      // Wait 1s and retry once
      await new Promise(function(resolve) { setTimeout(resolve, 1000); });
      var retry = await fetch(url, fetchOptions);
      if (retry.status === 429) {
        return res.status(200).json({ error: 'rate_limited' });
      }
      xResponse = retry;
    }

    var xData = await xResponse.json();

    // Normalise X API errors
    if (xData.errors && xData.errors.length) {
      var firstErr = xData.errors[0];
      // DM scope error: code 220 or 403 with specific message
      if (firstErr.code === 220 || (xResponse.status === 403 && firstErr.message && firstErr.message.indexOf('dm') !== -1)) {
        return res.status(200).json({ error: 'scope_missing', xError: firstErr.message });
      }
      return res.status(200).json({ xError: firstErr.message || 'X API error', raw: xData });
    }

    return res.status(200).json(xData);

  } catch (err) {
    return res.status(500).json({ error: 'Proxy error: ' + (err.message || 'Unknown') });
  }
}
