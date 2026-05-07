// v34.111: Server endpoint for logging client-side Gmail/Outlook OAuth mail sends.
//
// Background. The admin Campaigns dashboard reads from Firestore `email_log`. When
// admin templates are sent through send-template-email.js, that endpoint logs.
// But normal user mail sent via Gmail/Outlook OAuth goes directly from the
// browser to api.googleapis.com / graph.microsoft.com — never touching our
// server. So those sends never showed up in Campaigns. This endpoint is the
// fix: client-side mail send paths POST to it after a successful provider call,
// and it writes a row to email_log via the shared _email-log-helper.
//
// Auth: requires a valid Firebase ID token in Authorization: Bearer <token>.
// Verifies via Identity Toolkit accounts:lookup with the service account so
// the endpoint can't be spammed from arbitrary origins.
//
// POST body: { template, userEmail, subject, sentAt?, status?, resendId?,
//              campaign?, error? }
// Returns: { ok: true } on success, { error: '...' } on failure.

var crypto = require('crypto');
var emailLog = require('./_email-log-helper');

var ALLOWED_ORIGINS = [
  'https://roweos.com',
  'https://www.roweos.com',
  'https://roweos.vercel.app'
];

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getIdtkAccessToken(serviceAccount) {
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  var headerB64 = base64url(JSON.stringify(header));
  var payloadB64 = base64url(JSON.stringify(payload));
  var unsigned = headerB64 + '.' + payloadB64;
  var sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  var signature = sign.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  var jwt = unsigned + '.' + signature;
  var resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });
  if (!resp.ok) throw new Error('Google token exchange failed: ' + resp.status);
  var data = await resp.json();
  return data.access_token;
}

async function verifyIdToken(idtkToken, idToken) {
  if (!idToken) return null;
  try {
    var resp = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + idtkToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: idToken })
    });
    if (!resp.ok) return null;
    var data = await resp.json();
    if (!data.users || !data.users[0] || !data.users[0].localId) return null;
    return data.users[0];
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  var origin = (req.headers.origin || '').trim();
  var allowedOrigin = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : 'https://roweos.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var authHeader = req.headers.authorization || req.headers.Authorization || '';
  var idToken = '';
  if (authHeader.indexOf('Bearer ') === 0) idToken = authHeader.substring(7).trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Missing Authorization header (Firebase ID token)' });
  }

  var serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) return res.status(500).json({ error: 'Server not configured' });
  var sa;
  try { sa = JSON.parse(serviceAccountRaw); } catch (e) { return res.status(500).json({ error: 'Server config error' }); }

  var idtkToken;
  try { idtkToken = await getIdtkAccessToken(sa); } catch (e) {
    return res.status(500).json({ error: 'Auth service unavailable' });
  }
  var verifiedUser = await verifyIdToken(idtkToken, idToken);
  if (!verifiedUser || !verifiedUser.localId) {
    return res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
  }

  var body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  var userEmail = String(body.userEmail || '').trim();
  var template = String(body.template || 'mail').trim();
  var subject = String(body.subject || '').trim();
  if (!userEmail) return res.status(400).json({ error: 'userEmail required' });

  // Cap field lengths so a malicious payload can't bloat email_log.
  if (userEmail.length > 320) userEmail = userEmail.substring(0, 320);
  if (template.length > 64) template = template.substring(0, 64);
  if (subject.length > 512) subject = subject.substring(0, 512);

  var ok = await emailLog.write({
    userId: verifiedUser.localId,
    userEmail: userEmail,
    template: template,
    subject: subject,
    sentAt: body.sentAt || new Date().toISOString(),
    status: body.status === 'failed' ? 'failed' : 'sent',
    resendId: body.resendId ? String(body.resendId).substring(0, 128) : '',
    campaign: body.campaign ? String(body.campaign).substring(0, 64) : '',
    error: body.error ? String(body.error).substring(0, 512) : '',
    sentBy: 'log-mail-sent'
  });

  return res.status(200).json({ ok: ok });
};
