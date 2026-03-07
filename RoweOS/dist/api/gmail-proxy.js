// v22.24: Gmail OAuth proxy — token exchange, refresh, send, inbox
// POST { action: 'exchange'|'refresh'|'send'|'inbox'|'message', ... }
// Keeps client_secret server-side. Stores refresh tokens in Firestore for cross-device access.

var crypto = require('crypto');

// --- Firebase auth helpers (same pattern as social-auth.js) ---
function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signJwt(header, payload, privateKeyPem) {
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

// Store Gmail tokens in Firestore for cross-device access
async function storeGmailTokens(uid, tokenData) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_PROJECT_ID) return;
  try {
    var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    var googleToken = await getGoogleAccessToken(sa);
    var projectId = process.env.FIREBASE_PROJECT_ID;
    var docPath = 'projects/' + projectId + '/databases/(default)/documents/users/' + uid + '/social_tokens/gmail_mail';
    var fields = {
      accessToken: { stringValue: tokenData.accessToken || '' },
      refreshToken: { stringValue: tokenData.refreshToken || '' },
      expiresAt: { integerValue: String(tokenData.expiresAt || 0) },
      email: { stringValue: tokenData.email || '' },
      updatedAt: { stringValue: new Date().toISOString() }
    };
    await fetch('https://firestore.googleapis.com/v1/' + docPath, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fields })
    });
    console.log('[gmail-proxy] Stored tokens in Firestore for uid:', uid);
  } catch(e) {
    console.error('[gmail-proxy] Firestore store error:', e.message);
  }
}

// Read Gmail tokens from Firestore (for refresh when localStorage unavailable)
async function readGmailTokens(uid) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_PROJECT_ID) return null;
  try {
    var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    var googleToken = await getGoogleAccessToken(sa);
    var projectId = process.env.FIREBASE_PROJECT_ID;
    var docPath = 'projects/' + projectId + '/databases/(default)/documents/users/' + uid + '/social_tokens/gmail_mail';
    var resp = await fetch('https://firestore.googleapis.com/v1/' + docPath, {
      headers: { 'Authorization': 'Bearer ' + googleToken }
    });
    if (!resp.ok) return null;
    var doc = await resp.json();
    if (!doc.fields) return null;
    return {
      accessToken: doc.fields.accessToken ? doc.fields.accessToken.stringValue : '',
      refreshToken: doc.fields.refreshToken ? doc.fields.refreshToken.stringValue : '',
      expiresAt: doc.fields.expiresAt ? parseInt(doc.fields.expiresAt.integerValue) : 0,
      email: doc.fields.email ? doc.fields.email.stringValue : ''
    };
  } catch(e) {
    return null;
  }
}

// Verify user exists in Firestore (auth check for non-admin)
async function verifyUser(uid) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_PROJECT_ID) return false;
  try {
    var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    var googleToken = await getGoogleAccessToken(sa);
    var url = 'https://firestore.googleapis.com/v1/projects/' + process.env.FIREBASE_PROJECT_ID + '/databases/(default)/documents/users/' + uid;
    var resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + googleToken } });
    return resp.ok;
  } catch(e) { return false; }
}

// Build RFC 2822 MIME message for Gmail API
function buildMimeMessage(to, from, subject, htmlBody, cc, bcc, replyTo) {
  var boundary = 'boundary_' + Date.now();
  var lines = [];
  lines.push('MIME-Version: 1.0');
  lines.push('From: ' + from);
  lines.push('To: ' + to);
  if (cc && cc.length) lines.push('Cc: ' + cc.join(', '));
  if (bcc && bcc.length) lines.push('Bcc: ' + bcc.join(', '));
  if (replyTo) lines.push('Reply-To: ' + replyTo);
  lines.push('Subject: =?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=');
  lines.push('Content-Type: multipart/alternative; boundary="' + boundary + '"');
  lines.push('');
  // Plain text fallback
  lines.push('--' + boundary);
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  var plainText = htmlBody.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  lines.push(Buffer.from(plainText).toString('base64'));
  lines.push('');
  // HTML part
  lines.push('--' + boundary);
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(Buffer.from(htmlBody).toString('base64'));
  lines.push('');
  lines.push('--' + boundary + '--');
  return lines.join('\r\n');
}

// Base64url encode for Gmail API
function base64urlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function handler(req, res) {
  // CORS
  var origin = (req.headers.origin || '').trim();
  var allowed = ['https://roweos.vercel.app', 'https://roweos.com', 'https://www.roweos.com'];
  if (allowed.indexOf(origin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var body = req.body || {};
    var action = (body.action || '').trim();
    var uid = (body.uid || '').trim();

    if (!uid) return res.status(403).json({ error: 'Authentication required (uid)' });

    // Verify user exists
    var ADMIN_UID = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';
    if (uid !== ADMIN_UID) {
      var userOk = await verifyUser(uid);
      if (!userOk) return res.status(403).json({ error: 'User not found' });
    }

    var clientId = (process.env.GMAIL_CLIENT_ID || '').trim();
    var clientSecret = (process.env.GMAIL_CLIENT_SECRET || '').trim();

    // ═══════════════════════════════════════════════════════════════
    // ACTION: exchange — OAuth code → tokens
    // ═══════════════════════════════════════════════════════════════
    if (action === 'exchange') {
      var code = (body.code || '').trim();
      var redirectUri = (body.redirectUri || '').trim();
      if (!code) return res.status(400).json({ error: 'Missing authorization code' });
      if (!clientId || !clientSecret) return res.status(500).json({ error: 'Gmail OAuth not configured (missing GMAIL_CLIENT_ID/SECRET)' });

      var tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code' +
          '&code=' + encodeURIComponent(code) +
          '&redirect_uri=' + encodeURIComponent(redirectUri) +
          '&client_id=' + encodeURIComponent(clientId) +
          '&client_secret=' + encodeURIComponent(clientSecret)
      });
      var tokenData = await tokenResp.json();

      if (tokenData.error) {
        console.error('[gmail-proxy] Token exchange error:', tokenData);
        return res.status(400).json({ error: 'Token exchange failed: ' + (tokenData.error_description || tokenData.error) });
      }

      // Get user's email via Gmail profile
      var email = '';
      try {
        var profileResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
        });
        var profileData = await profileResp.json();
        email = profileData.emailAddress || '';
      } catch(e) {
        console.error('[gmail-proxy] Profile fetch error:', e.message);
      }

      var expiresAt = Date.now() + ((tokenData.expires_in || 3600) * 1000);
      var result = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresAt: expiresAt,
        email: email
      };

      // Store in Firestore for cross-device
      await storeGmailTokens(uid, result);

      console.log('[gmail-proxy] Token exchange success for:', email, 'uid:', uid);
      return res.status(200).json(result);
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: refresh — Refresh expired access token
    // ═══════════════════════════════════════════════════════════════
    if (action === 'refresh') {
      var refreshToken = (body.refreshToken || '').trim();

      // If no refresh token provided, try Firestore
      if (!refreshToken) {
        var stored = await readGmailTokens(uid);
        if (stored && stored.refreshToken) {
          refreshToken = stored.refreshToken;
        }
      }

      if (!refreshToken) return res.status(400).json({ error: 'No refresh token available' });
      if (!clientId || !clientSecret) return res.status(500).json({ error: 'Gmail OAuth not configured' });

      var refreshResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token' +
          '&refresh_token=' + encodeURIComponent(refreshToken) +
          '&client_id=' + encodeURIComponent(clientId) +
          '&client_secret=' + encodeURIComponent(clientSecret)
      });
      var refreshData = await refreshResp.json();

      if (refreshData.error) {
        console.error('[gmail-proxy] Refresh error:', refreshData);
        return res.status(400).json({ error: 'Token refresh failed: ' + (refreshData.error_description || refreshData.error) });
      }

      var newExpiresAt = Date.now() + ((refreshData.expires_in || 3600) * 1000);
      var refreshResult = {
        accessToken: refreshData.access_token,
        refreshToken: refreshData.refresh_token || refreshToken, // Google may not return a new one
        expiresAt: newExpiresAt
      };

      // Update Firestore
      var storedData = await readGmailTokens(uid);
      await storeGmailTokens(uid, {
        accessToken: refreshResult.accessToken,
        refreshToken: refreshResult.refreshToken,
        expiresAt: newExpiresAt,
        email: storedData ? storedData.email : ''
      });

      console.log('[gmail-proxy] Token refreshed for uid:', uid);
      return res.status(200).json(refreshResult);
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: send — Send email via Gmail API
    // ═══════════════════════════════════════════════════════════════
    if (action === 'send') {
      var accessToken = (body.accessToken || '').trim();
      var to = (body.to || '').trim();
      var from = (body.from || '').trim();
      var subject = (body.subject || '').trim();
      var html = body.html || '';
      var cc = Array.isArray(body.cc) ? body.cc : [];
      var bcc = Array.isArray(body.bcc) ? body.bcc : [];
      var replyTo = (body.replyTo || '').trim();

      if (!accessToken) return res.status(400).json({ error: 'Missing access token' });
      if (!to) return res.status(400).json({ error: 'Missing recipient' });
      if (!subject) return res.status(400).json({ error: 'Missing subject' });

      var mimeMessage = buildMimeMessage(to, from, subject, html, cc, bcc, replyTo);
      var encodedMessage = base64urlEncode(mimeMessage);

      var sendResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodedMessage })
      });

      if (sendResp.ok) {
        var sendData = await sendResp.json();
        console.log('[gmail-proxy] Email sent via Gmail, messageId:', sendData.id, 'to:', to);
        return res.status(200).json({ success: true, messageId: sendData.id });
      } else {
        var errText = await sendResp.text();
        console.error('[gmail-proxy] Gmail send error:', sendResp.status, errText);
        // If 401, token expired
        if (sendResp.status === 401) {
          return res.status(401).json({ error: 'Token expired', needsRefresh: true });
        }
        return res.status(500).json({ error: 'Gmail send failed: ' + errText });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: inbox — Fetch inbox messages list
    // ═══════════════════════════════════════════════════════════════
    if (action === 'inbox') {
      var accessToken = (body.accessToken || '').trim();
      var maxResults = body.maxResults || 20;
      var pageToken = body.pageToken || '';

      if (!accessToken) return res.status(400).json({ error: 'Missing access token' });

      var url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=' + maxResults + '&labelIds=INBOX';
      if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);

      var listResp = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });

      if (!listResp.ok) {
        if (listResp.status === 401) return res.status(401).json({ error: 'Token expired', needsRefresh: true });
        return res.status(500).json({ error: 'Failed to fetch inbox' });
      }

      var listData = await listResp.json();
      var messages = listData.messages || [];
      var nextPageToken = listData.nextPageToken || '';

      // Fetch metadata for each message (batch - headers only)
      var detailed = [];
      for (var i = 0; i < messages.length; i++) {
        try {
          var msgResp = await fetch(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + messages[i].id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date',
            { headers: { 'Authorization': 'Bearer ' + accessToken } }
          );
          if (msgResp.ok) {
            var msgData = await msgResp.json();
            var headers = msgData.payload && msgData.payload.headers ? msgData.payload.headers : [];
            var fromH = '', subjectH = '', dateH = '';
            headers.forEach(function(h) {
              if (h.name === 'From') fromH = h.value;
              if (h.name === 'Subject') subjectH = h.value;
              if (h.name === 'Date') dateH = h.value;
            });
            detailed.push({
              id: msgData.id,
              threadId: msgData.threadId,
              snippet: msgData.snippet || '',
              from: fromH,
              subject: subjectH,
              date: dateH,
              internalDate: msgData.internalDate || '',
              labelIds: msgData.labelIds || [],
              isUnread: (msgData.labelIds || []).indexOf('UNREAD') !== -1
            });
          }
        } catch(e) { /* skip failed messages */ }
      }

      return res.status(200).json({ messages: detailed, nextPageToken: nextPageToken });
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: message — Fetch full message content
    // ═══════════════════════════════════════════════════════════════
    if (action === 'message') {
      var accessToken = (body.accessToken || '').trim();
      var messageId = (body.messageId || '').trim();

      if (!accessToken || !messageId) return res.status(400).json({ error: 'Missing access token or message ID' });

      var msgResp = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + messageId + '?format=full',
        { headers: { 'Authorization': 'Bearer ' + accessToken } }
      );

      if (!msgResp.ok) {
        if (msgResp.status === 401) return res.status(401).json({ error: 'Token expired', needsRefresh: true });
        return res.status(500).json({ error: 'Failed to fetch message' });
      }

      var msgData = await msgResp.json();
      var headers = msgData.payload && msgData.payload.headers ? msgData.payload.headers : [];
      var fromH = '', subjectH = '', dateH = '', toH = '';
      headers.forEach(function(h) {
        if (h.name === 'From') fromH = h.value;
        if (h.name === 'Subject') subjectH = h.value;
        if (h.name === 'Date') dateH = h.value;
        if (h.name === 'To') toH = h.value;
      });

      // Extract body — prefer HTML, fallback to plain
      var htmlBody = '';
      var textBody = '';
      function extractParts(payload) {
        if (payload.mimeType === 'text/html' && payload.body && payload.body.data) {
          htmlBody = Buffer.from(payload.body.data, 'base64url').toString('utf8');
        }
        if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
          textBody = Buffer.from(payload.body.data, 'base64url').toString('utf8');
        }
        if (payload.parts) {
          payload.parts.forEach(extractParts);
        }
      }
      if (msgData.payload) extractParts(msgData.payload);

      // Mark as read
      try {
        await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + messageId + '/modify', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
        });
      } catch(e) { /* non-critical */ }

      return res.status(200).json({
        id: msgData.id,
        threadId: msgData.threadId,
        from: fromH,
        to: toH,
        subject: subjectH,
        date: dateH,
        body: htmlBody || textBody,
        isHtml: !!htmlBody,
        snippet: msgData.snippet || '',
        labelIds: msgData.labelIds || []
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: outlook_exchange — Outlook OAuth code → tokens
    // ═══════════════════════════════════════════════════════════════
    if (action === 'outlook_exchange') {
      var code = (body.code || '').trim();
      var redirectUri = (body.redirectUri || '').trim();
      if (!code) return res.status(400).json({ error: 'Missing authorization code' });

      var outlookClientId = (process.env.OUTLOOK_CLIENT_ID || '41b2af7a-e6d9-45f3-a508-b59f055e7043').trim();
      var outlookClientSecret = (process.env.OUTLOOK_CLIENT_SECRET || '').trim();
      if (!outlookClientSecret) return res.status(500).json({ error: 'Outlook OAuth not configured (missing OUTLOOK_CLIENT_SECRET)' });

      var tokenResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code' +
          '&code=' + encodeURIComponent(code) +
          '&redirect_uri=' + encodeURIComponent(redirectUri) +
          '&client_id=' + encodeURIComponent(outlookClientId) +
          '&client_secret=' + encodeURIComponent(outlookClientSecret) +
          '&scope=' + encodeURIComponent('User.Read Mail.Read Mail.Send Mail.ReadWrite offline_access')
      });
      var tokenData = await tokenResp.json();

      if (tokenData.error) {
        console.error('[gmail-proxy] Outlook token exchange error:', tokenData);
        return res.status(400).json({ error: 'Token exchange failed: ' + (tokenData.error_description || tokenData.error) });
      }

      // Get user email via Microsoft Graph
      var email = '';
      try {
        var profileResp = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
        });
        var profileData = await profileResp.json();
        email = profileData.mail || profileData.userPrincipalName || '';
      } catch(e) {
        console.error('[gmail-proxy] Outlook profile fetch error:', e.message);
      }

      var expiresAt = Date.now() + ((tokenData.expires_in || 3600) * 1000);
      var result = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        expiresAt: expiresAt,
        email: email
      };

      console.log('[gmail-proxy] Outlook token exchange success for:', email, 'uid:', uid);
      return res.status(200).json(result);
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: outlook_refresh — Refresh Outlook access token
    // ═══════════════════════════════════════════════════════════════
    if (action === 'outlook_refresh') {
      var refreshToken = (body.refreshToken || '').trim();
      if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });

      var outlookClientId = (process.env.OUTLOOK_CLIENT_ID || '41b2af7a-e6d9-45f3-a508-b59f055e7043').trim();
      var outlookClientSecret = (process.env.OUTLOOK_CLIENT_SECRET || '').trim();
      if (!outlookClientSecret) return res.status(500).json({ error: 'Outlook OAuth not configured (missing OUTLOOK_CLIENT_SECRET)' });

      var tokenResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token' +
          '&refresh_token=' + encodeURIComponent(refreshToken) +
          '&client_id=' + encodeURIComponent(outlookClientId) +
          '&client_secret=' + encodeURIComponent(outlookClientSecret) +
          '&scope=' + encodeURIComponent('User.Read Mail.Read Mail.Send Mail.ReadWrite offline_access')
      });
      var tokenData = await tokenResp.json();

      if (tokenData.error) {
        console.error('[gmail-proxy] Outlook token refresh error:', tokenData);
        return res.status(400).json({ error: 'Token refresh failed: ' + (tokenData.error_description || tokenData.error) });
      }

      var expiresAt = Date.now() + ((tokenData.expires_in || 3600) * 1000);
      console.log('[gmail-proxy] Outlook token refresh success, uid:', uid);
      return res.status(200).json({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresAt: expiresAt
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: outlook_send — Send email via Microsoft Graph
    // ═══════════════════════════════════════════════════════════════
    if (action === 'outlook_send') {
      var accessToken = (body.accessToken || '').trim();
      if (!accessToken) return res.status(400).json({ error: 'Missing access token' });

      var toRecipients = (body.to || '').split(',').map(function(e) { return e.trim(); }).filter(Boolean);
      if (toRecipients.length === 0) return res.status(400).json({ error: 'Missing recipient' });

      var ccRecipients = (body.cc || []).filter(Boolean);
      var bccRecipients = (body.bcc || []).filter(Boolean);

      var message = {
        subject: body.subject || '(no subject)',
        body: {
          contentType: 'HTML',
          content: body.html || body.body || ''
        },
        toRecipients: toRecipients.map(function(e) { return { emailAddress: { address: e } }; })
      };
      if (ccRecipients.length > 0) {
        message.ccRecipients = ccRecipients.map(function(e) { return { emailAddress: { address: e } }; });
      }
      if (bccRecipients.length > 0) {
        message.bccRecipients = bccRecipients.map(function(e) { return { emailAddress: { address: e } }; });
      }

      var sendResp = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: message, saveToSentItems: true })
      });

      if (sendResp.status === 202 || sendResp.status === 200) {
        console.log('[gmail-proxy] Outlook send success to:', toRecipients.join(', '));
        return res.status(200).json({ success: true, messageId: 'outlook_' + Date.now() });
      }

      var errBody = '';
      try { errBody = await sendResp.text(); } catch(e) {}
      console.error('[gmail-proxy] Outlook send failed:', sendResp.status, errBody);
      return res.status(sendResp.status || 500).json({ error: 'Outlook send failed: ' + (errBody || sendResp.status) });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });

  } catch(error) {
    console.error('[gmail-proxy] Handler error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
