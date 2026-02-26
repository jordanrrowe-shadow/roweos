// v17.0: Social Media OAuth token exchange + refresh
// Vercel serverless function — handles Threads/Instagram token exchange (requires client_secret)
// and X/Twitter token refresh. Supports dual-mode: RoweOS keys (env vars) + user-provided keys.
// v20.12: Stores tokens in Firestore social_tokens subcollection for cross-device access (mobile PWA)

// --- Firestore REST helpers (same pattern as scheduler.js) ---

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signJwt(header, payload, privateKeyPem) {
  var crypto = require('crypto');
  var headerB64 = base64url(JSON.stringify(header));
  var payloadB64 = base64url(JSON.stringify(payload));
  var unsigned = headerB64 + '.' + payloadB64;
  var sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  var signature = sign.sign(privateKeyPem, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return unsigned + '.' + signature;
}

async function getGoogleAccessToken(serviceAccount) {
  var now = Math.floor(Date.now() / 1000);
  var jwt = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    { iss: serviceAccount.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    serviceAccount.private_key
  );
  var resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });
  var data = await resp.json();
  return data.access_token;
}

// v20.12: Store social token in Firestore for cross-device access
async function storeTokenInFirestore(uid, platform, scope, tokenData) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_PROJECT_ID) return;
  try {
    var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    var googleToken = await getGoogleAccessToken(sa);
    var projectId = process.env.FIREBASE_PROJECT_ID;
    var docPath = 'projects/' + projectId + '/databases/(default)/documents/roweos_users/' + uid + '/social_tokens/' + platform + scope;
    var fields = {
      accessToken: { stringValue: tokenData.accessToken || '' },
      refreshToken: { stringValue: tokenData.refreshToken || '' },
      expiresAt: { integerValue: String(tokenData.expiresAt || 0) },
      userId: { stringValue: String(tokenData.userId || '') },
      updatedAt: { stringValue: new Date().toISOString() }
    };
    await fetch('https://firestore.googleapis.com/v1/' + docPath, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fields })
    });
    console.log('[Social Auth] Token stored in Firestore for ' + platform + scope + ' (user: ' + uid + ')');
  } catch (e) {
    console.log('[Social Auth] Firestore store failed (non-fatal):', e.message);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // v19.0: GET handler — serve HTML page with auto-submitting form for OAuth URLs
  // iOS universal links intercept both 302 redirects AND JS window.location to registered domains
  // (threads.com, x.com, instagram.com). Form GET submissions bypass universal link interception.
  if (req.method === 'GET') {
    var authUrl = req.query && req.query.authUrl;
    if (authUrl && typeof authUrl === 'string') {
      // Whitelist allowed OAuth domains
      var allowed = ['https://threads.net/', 'https://www.threads.net/',
                     'https://www.threads.com/', 'https://threads.com/',
                     'https://api.instagram.com/', 'https://x.com/'];
      var isAllowed = allowed.some(function(prefix) { return authUrl.indexOf(prefix) === 0; });
      if (isAllowed) {
        // Parse URL into base + query params for form submission
        var urlObj = new URL(authUrl);
        var formAction = (urlObj.origin + urlObj.pathname).replace(/"/g, '&quot;');
        var hiddenInputs = '';
        urlObj.searchParams.forEach(function(value, key) {
          hiddenInputs += '<input type="hidden" name="' + key.replace(/"/g, '&quot;').replace(/</g, '&lt;') +
            '" value="' + value.replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">';
        });

        var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Redirecting...</title>' +
          '<style>*{margin:0;padding:0;box-sizing:border-box}' +
          'body{background:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,sans-serif;' +
          'display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}' +
          '.spinner{width:32px;height:32px;border:3px solid rgba(168,152,120,0.15);border-top-color:#a89878;' +
          'border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}' +
          '@keyframes spin{to{transform:rotate(360deg)}}</style></head><body>' +
          '<div><div class="spinner"></div><p style="font-size:14px;opacity:0.7">Redirecting to sign in...</p>' +
          '<noscript><p style="margin-top:16px;"><a href="' + authUrl.replace(/"/g, '&quot;') + '">Click here to continue</a></p></noscript></div>' +
          '<form id="f" method="GET" action="' + formAction + '" style="display:none">' + hiddenInputs + '</form>' +
          '<script>document.getElementById("f").submit();</script></body></html>';
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store');
        return res.status(200).send(html);
      }
    }
    return res.status(400).json({ error: 'Invalid or missing authUrl parameter' });
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

      var xRefResult = {
        accessToken: xRefreshData.access_token,
        refreshToken: xRefreshData.refresh_token || xRefreshToken,
        expiresIn: xRefreshData.expires_in,
        expiresAt: Date.now() + (xRefreshData.expires_in * 1000)
      };
      // v20.12: Update Firestore with refreshed token
      if (body.uid && body.scope) {
        await storeTokenInFirestore(body.uid, 'x', body.scope, xRefResult);
      }
      return res.status(200).json(xRefResult);
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

      var xResult = {
        accessToken: xExchData.access_token,
        refreshToken: xExchData.refresh_token,
        expiresIn: xExchData.expires_in,
        expiresAt: Date.now() + (xExchData.expires_in * 1000)
      };
      // v20.12: Store in Firestore for cross-device access (mobile PWA)
      if (body.uid && body.scope) {
        await storeTokenInFirestore(body.uid, 'x', body.scope, xResult);
      }
      return res.status(200).json(xResult);
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
        var tShortResult = {
          accessToken: tShortData.access_token,
          userId: tUserId,
          expiresIn: 3600,
          expiresAt: Date.now() + 3600000,
          longLived: false
        };
        if (body.uid && body.scope) {
          await storeTokenInFirestore(body.uid, 'threads', body.scope, tShortResult);
        }
        return res.status(200).json(tShortResult);
      }

      var tResult = {
        accessToken: tLongData.access_token,
        userId: tUserId,
        expiresIn: tLongData.expires_in || 5184000,
        expiresAt: Date.now() + ((tLongData.expires_in || 5184000) * 1000),
        longLived: true
      };
      // v20.12: Store in Firestore for cross-device access
      if (body.uid && body.scope) {
        await storeTokenInFirestore(body.uid, 'threads', body.scope, tResult);
      }
      return res.status(200).json(tResult);
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
        var igShortResult = {
          accessToken: igShortData.access_token,
          userId: igUserId,
          expiresIn: 3600,
          expiresAt: Date.now() + 3600000,
          longLived: false
        };
        if (body.uid && body.scope) {
          await storeTokenInFirestore(body.uid, 'instagram', body.scope, igShortResult);
        }
        return res.status(200).json(igShortResult);
      }

      var igResult = {
        accessToken: igLongData.access_token,
        userId: igUserId,
        expiresIn: igLongData.expires_in || 5184000,
        expiresAt: Date.now() + ((igLongData.expires_in || 5184000) * 1000),
        longLived: true
      };
      if (body.uid && body.scope) {
        await storeTokenInFirestore(body.uid, 'instagram', body.scope, igResult);
      }
      return res.status(200).json(igResult);
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
