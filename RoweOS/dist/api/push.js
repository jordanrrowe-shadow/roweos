// v20.15: Push Notification API — subscribe, unsubscribe, send
// Uses web-push library for reliable VAPID JWT + payload encryption

var crypto = require('crypto');
var webpush = require('web-push');

// --- Firestore REST helpers ---

function base64url_jwt(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signJwt(header, payload, privateKeyPem) {
  var headerB64 = base64url_jwt(JSON.stringify(header));
  var payloadB64 = base64url_jwt(JSON.stringify(payload));
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

function firestoreDocToFields(obj) {
  var fields = {};
  for (var key in obj) {
    var val = obj[key];
    if (typeof val === 'string') fields[key] = { stringValue: val };
    else if (typeof val === 'number') fields[key] = { integerValue: String(val) };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    else if (typeof val === 'object' && val !== null) fields[key] = { stringValue: JSON.stringify(val) };
  }
  return fields;
}

export default async function handler(req, res) {
  // CORS
  var origin = req.headers.origin || '';
  var allowed = ['https://roweos.vercel.app', 'https://roweos.com', 'https://www.roweos.com'];
  res.setHeader('Access-Control-Allow-Origin', allowed.indexOf(origin) !== -1 ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var vapidPublic = process.env.VAPID_PUBLIC_KEY;
  var vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  var vapidSubject = process.env.VAPID_SUBJECT || 'mailto:jordan@therowecollection.com';

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Push notifications not configured (missing VAPID keys)' });
  }

  // Configure web-push with VAPID details
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    var action = body.action;
    var uid = body.uid;
    if (!uid) return res.status(400).json({ error: 'Missing uid' });

    var projectId = process.env.FIREBASE_PROJECT_ID;
    var saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!projectId || !saJson) {
      return res.status(500).json({ error: 'Firebase not configured' });
    }

    var sa = JSON.parse(saJson);
    var googleToken = await getGoogleAccessToken(sa);

    // --- Subscribe ---
    if (action === 'subscribe') {
      var subscription = body.subscription;
      if (!subscription || !subscription.endpoint) {
        console.log('[Push] Subscribe: missing subscription data');
        return res.status(400).json({ error: 'Missing subscription data' });
      }

      console.log('[Push] Subscribe: uid=' + uid + ' endpoint=' + (subscription.endpoint || '').substring(0, 60) + '...');

      var subId = crypto.createHash('sha256').update(subscription.endpoint).digest('hex').substring(0, 20);
      var docPath = 'projects/' + projectId + '/databases/(default)/documents/users/' + uid + '/push_subscriptions/' + subId;
      var fields = firestoreDocToFields({
        endpoint: subscription.endpoint,
        keys: subscription.keys ? JSON.stringify(subscription.keys) : '{}',
        createdAt: new Date().toISOString(),
        enabled: true
      });

      var patchResp = await fetch('https://firestore.googleapis.com/v1/' + docPath, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fields })
      });

      if (!patchResp.ok) {
        var patchErr = await patchResp.text().catch(function() { return ''; });
        console.error('[Push] Firestore PATCH failed:', patchResp.status, patchErr.substring(0, 500));
        return res.status(500).json({ error: 'Failed to store subscription: ' + patchResp.status });
      }

      console.log('[Push] Subscription stored for uid:', uid, 'subId:', subId);
      return res.status(200).json({ success: true, subscriptionId: subId });
    }

    // --- Unsubscribe ---
    if (action === 'unsubscribe') {
      var endpoint = body.endpoint;
      if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
      var subId = crypto.createHash('sha256').update(endpoint).digest('hex').substring(0, 20);
      var docPath = 'projects/' + projectId + '/databases/(default)/documents/users/' + uid + '/push_subscriptions/' + subId;
      await fetch('https://firestore.googleapis.com/v1/' + docPath, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + googleToken }
      });
      return res.status(200).json({ success: true });
    }

    // --- Send ---
    if (action === 'send' || action === 'test') {
      var title = action === 'test' ? 'RoweOS' : (body.title || 'RoweOS');
      var message = action === 'test' ? 'Push notifications are working' : (body.message || '');
      var payload = JSON.stringify({
        title: title,
        body: message,
        tag: body.tag || 'roweos-' + Date.now(),
        url: body.url || '/',
        type: body.type || (action === 'test' ? 'test' : 'general')
      });

      // Read subscriptions from Firestore
      var listUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId +
        '/databases/(default)/documents/users/' + uid + '/push_subscriptions';
      var listResp = await fetch(listUrl, { headers: { 'Authorization': 'Bearer ' + googleToken } });
      var listData = await listResp.json();
      var docs = listData.documents || [];
      console.log('[Push] Found', docs.length, 'subscription(s) for uid:', uid);

      var sent = 0;
      var failed = 0;
      var stale = [];

      for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        var f = doc.fields || {};
        if (f.enabled && f.enabled.booleanValue === false) continue;

        var sub = {
          endpoint: (f.endpoint && f.endpoint.stringValue) || '',
          keys: {}
        };
        try { sub.keys = JSON.parse((f.keys && f.keys.stringValue) || '{}'); } catch(e) {}
        if (!sub.endpoint || !sub.keys.p256dh || !sub.keys.auth) {
          console.log('[Push] Skipping doc with missing endpoint or keys');
          continue;
        }

        try {
          await webpush.sendNotification(sub, payload);
          sent++;
          console.log('[Push] Sent to:', sub.endpoint.substring(0, 50) + '...');
        } catch(err) {
          console.log('[Push] Send failed:', err.statusCode, err.body || err.message);
          if (err.statusCode === 404 || err.statusCode === 410) {
            stale.push(doc.name);
          }
          failed++;
        }
      }

      // Clean up stale subscriptions
      for (var j = 0; j < stale.length; j++) {
        try {
          await fetch('https://firestore.googleapis.com/v1/' + stale[j], {
            method: 'DELETE', headers: { 'Authorization': 'Bearer ' + googleToken }
          });
          console.log('[Push] Cleaned stale subscription');
        } catch(e) {}
      }

      return res.status(200).json({ success: true, sent: sent, failed: failed, cleaned: stale.length });
    }

    return res.status(400).json({ error: 'Invalid action. Use: subscribe, unsubscribe, send, test' });

  } catch(err) {
    console.error('[Push] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
