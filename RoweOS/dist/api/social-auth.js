// v17.0: Social Media OAuth token exchange + refresh
// Vercel serverless function — handles Threads/Instagram token exchange (requires client_secret)
// and X/Twitter token refresh. Supports dual-mode: RoweOS keys (env vars) + user-provided keys.

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
    var action = body.action || 'exchange'; // 'exchange' or 'refresh'

    if (!platform || ['x', 'threads', 'instagram'].indexOf(platform) === -1) {
      return res.status(400).json({ error: 'Invalid platform. Must be x, threads, or instagram.' });
    }

    // --- X/Twitter Token Refresh ---
    if (platform === 'x' && action === 'refresh') {
      var xRefreshToken = body.refreshToken;
      var xClientId = (body.clientId || process.env.ROWEOS_X_CLIENT_ID || '').trim();
      if (!xRefreshToken) {
        return res.status(400).json({ error: 'Missing refreshToken for X refresh' });
      }
      if (!xClientId) {
        return res.status(400).json({ error: 'Missing X client ID' });
      }

      var xRefreshResp = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(xRefreshToken) +
              '&client_id=' + encodeURIComponent(xClientId)
      });
      var xRefreshData = await xRefreshResp.json();

      if (!xRefreshResp.ok) {
        console.error('[Social Auth] X refresh failed:', xRefreshData);
        return res.status(xRefreshResp.status).json({ error: 'X token refresh failed', detail: xRefreshData });
      }

      return res.status(200).json({
        accessToken: xRefreshData.access_token,
        refreshToken: xRefreshData.refresh_token || xRefreshToken,
        expiresIn: xRefreshData.expires_in,
        expiresAt: Date.now() + (xRefreshData.expires_in * 1000)
      });
    }

    // --- X/Twitter Code Exchange (PKCE) ---
    if (platform === 'x' && action === 'exchange') {
      var xCode = body.code;
      var xRedirectUri = body.redirectUri;
      var xCodeVerifier = body.codeVerifier;
      var xClientIdExch = (body.clientId || process.env.ROWEOS_X_CLIENT_ID || '').trim();

      if (!xCode || !xRedirectUri || !xCodeVerifier) {
        return res.status(400).json({ error: 'Missing code, redirectUri, or codeVerifier for X exchange' });
      }

      var xExchResp = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code&code=' + encodeURIComponent(xCode) +
              '&redirect_uri=' + encodeURIComponent(xRedirectUri) +
              '&code_verifier=' + encodeURIComponent(xCodeVerifier) +
              '&client_id=' + encodeURIComponent(xClientIdExch)
      });
      var xExchData = await xExchResp.json();

      if (!xExchResp.ok) {
        console.error('[Social Auth] X exchange failed:', xExchData);
        return res.status(xExchResp.status).json({ error: 'X token exchange failed', detail: xExchData });
      }

      return res.status(200).json({
        accessToken: xExchData.access_token,
        refreshToken: xExchData.refresh_token,
        expiresIn: xExchData.expires_in,
        expiresAt: Date.now() + (xExchData.expires_in * 1000)
      });
    }

    // --- Threads Token Exchange ---
    if (platform === 'threads') {
      var tCode = body.code;
      var tRedirectUri = body.redirectUri;
      var tAppId = (body.appId || process.env.ROWEOS_THREADS_APP_ID || '').trim();
      var tAppSecret = (body.appSecret || process.env.ROWEOS_THREADS_APP_SECRET || '').trim();

      if (!tCode || !tRedirectUri) {
        return res.status(400).json({ error: 'Missing code or redirectUri for Threads exchange' });
      }
      if (!tAppId || !tAppSecret) {
        return res.status(400).json({ error: 'Missing Threads app credentials' });
      }

      // Step 1: Short-lived token
      var tShortResp = await fetch('https://graph.threads.net/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'client_id=' + encodeURIComponent(tAppId) +
              '&client_secret=' + encodeURIComponent(tAppSecret) +
              '&grant_type=authorization_code' +
              '&redirect_uri=' + encodeURIComponent(tRedirectUri) +
              '&code=' + encodeURIComponent(tCode)
      });
      // v17.2: Parse as text first to preserve user_id precision (exceeds Number.MAX_SAFE_INTEGER)
      var tShortText = await tShortResp.text();
      var tShortUserId = '';
      var userIdMatch = tShortText.match(/"user_id"\s*:\s*(\d+)/);
      if (userIdMatch) tShortUserId = userIdMatch[1];
      var tShortData;
      try { tShortData = JSON.parse(tShortText); } catch(e) {
        return res.status(400).json({ error: 'Threads token parse failed', detail: tShortText.substring(0, 200) });
      }
      // Use string-extracted userId, not the JSON-parsed (lossy) number
      var tUserId = tShortUserId || String(tShortData.user_id || '');

      if (!tShortResp.ok || !tShortData.access_token) {
        console.error('[Social Auth] Threads short token failed:', tShortData);
        return res.status(400).json({ error: 'Threads token exchange failed', detail: tShortData });
      }

      // Step 2: Exchange for long-lived token (60 days)
      var tLongResp = await fetch('https://graph.threads.net/access_token?' +
        'grant_type=th_exchange_token' +
        '&client_secret=' + encodeURIComponent(tAppSecret) +
        '&access_token=' + encodeURIComponent(tShortData.access_token));
      var tLongData = await tLongResp.json();

      if (!tLongResp.ok || !tLongData.access_token) {
        console.error('[Social Auth] Threads long token failed:', tLongData);
        // Fall back to short-lived token
        return res.status(200).json({
          accessToken: tShortData.access_token,
          userId: tUserId,
          expiresIn: 3600,
          expiresAt: Date.now() + 3600000,
          longLived: false
        });
      }

      return res.status(200).json({
        accessToken: tLongData.access_token,
        userId: tUserId,
        expiresIn: tLongData.expires_in || 5184000,
        expiresAt: Date.now() + ((tLongData.expires_in || 5184000) * 1000),
        longLived: true
      });
    }

    // --- Threads Token Refresh ---
    if (platform === 'threads' && action === 'refresh') {
      var tRefreshToken = body.accessToken;
      if (!tRefreshToken) {
        return res.status(400).json({ error: 'Missing accessToken for Threads refresh' });
      }

      var tRefreshResp = await fetch('https://graph.threads.net/refresh_access_token?' +
        'grant_type=th_refresh_token' +
        '&access_token=' + encodeURIComponent(tRefreshToken));
      var tRefreshData = await tRefreshResp.json();

      if (!tRefreshResp.ok) {
        return res.status(400).json({ error: 'Threads token refresh failed', detail: tRefreshData });
      }

      return res.status(200).json({
        accessToken: tRefreshData.access_token,
        expiresIn: tRefreshData.expires_in,
        expiresAt: Date.now() + (tRefreshData.expires_in * 1000)
      });
    }

    // --- Instagram Token Exchange ---
    if (platform === 'instagram') {
      var igCode = body.code;
      var igRedirectUri = body.redirectUri;
      var igAppId = (body.appId || process.env.ROWEOS_IG_APP_ID || '').trim();
      var igAppSecret = (body.appSecret || process.env.ROWEOS_IG_APP_SECRET || '').trim();

      if (!igCode || !igRedirectUri) {
        return res.status(400).json({ error: 'Missing code or redirectUri for Instagram exchange' });
      }
      if (!igAppId || !igAppSecret) {
        return res.status(400).json({ error: 'Missing Instagram app credentials' });
      }

      // Step 1: Short-lived token
      var igShortResp = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'client_id=' + encodeURIComponent(igAppId) +
              '&client_secret=' + encodeURIComponent(igAppSecret) +
              '&grant_type=authorization_code' +
              '&redirect_uri=' + encodeURIComponent(igRedirectUri) +
              '&code=' + encodeURIComponent(igCode)
      });
      // v17.2: Parse as text first to preserve user_id precision
      var igShortText = await igShortResp.text();
      var igUserIdMatch = igShortText.match(/"user_id"\s*:\s*(\d+)/);
      var igUserId = igUserIdMatch ? igUserIdMatch[1] : '';
      var igShortData;
      try { igShortData = JSON.parse(igShortText); } catch(e) {
        return res.status(400).json({ error: 'Instagram token parse failed', detail: igShortText.substring(0, 200) });
      }
      if (!igUserId) igUserId = String(igShortData.user_id || '');

      if (!igShortResp.ok || !igShortData.access_token) {
        console.error('[Social Auth] Instagram short token failed:', igShortData);
        return res.status(400).json({ error: 'Instagram token exchange failed', detail: igShortData });
      }

      // Step 2: Exchange for long-lived token (60 days)
      var igLongResp = await fetch('https://graph.instagram.com/access_token?' +
        'grant_type=ig_exchange_token' +
        '&client_secret=' + encodeURIComponent(igAppSecret) +
        '&access_token=' + encodeURIComponent(igShortData.access_token));
      var igLongData = await igLongResp.json();

      if (!igLongResp.ok || !igLongData.access_token) {
        return res.status(200).json({
          accessToken: igShortData.access_token,
          userId: igUserId,
          expiresIn: 3600,
          expiresAt: Date.now() + 3600000,
          longLived: false
        });
      }

      return res.status(200).json({
        accessToken: igLongData.access_token,
        userId: igUserId,
        expiresIn: igLongData.expires_in || 5184000,
        expiresAt: Date.now() + ((igLongData.expires_in || 5184000) * 1000),
        longLived: true
      });
    }

    // --- Instagram Token Refresh ---
    if (platform === 'instagram' && action === 'refresh') {
      var igRefreshToken = body.accessToken;
      if (!igRefreshToken) {
        return res.status(400).json({ error: 'Missing accessToken for Instagram refresh' });
      }

      var igRefreshResp = await fetch('https://graph.instagram.com/refresh_access_token?' +
        'grant_type=ig_refresh_token' +
        '&access_token=' + encodeURIComponent(igRefreshToken));
      var igRefreshData = await igRefreshResp.json();

      if (!igRefreshResp.ok) {
        return res.status(400).json({ error: 'Instagram token refresh failed', detail: igRefreshData });
      }

      return res.status(200).json({
        accessToken: igRefreshData.access_token,
        expiresIn: igRefreshData.expires_in,
        expiresAt: Date.now() + (igRefreshData.expires_in * 1000)
      });
    }

    return res.status(400).json({ error: 'Unhandled platform/action combination' });

  } catch (err) {
    console.error('[Social Auth] Error:', err.message, err.stack);
    return res.status(500).json({ error: 'Auth request failed: ' + err.message });
  }
}
