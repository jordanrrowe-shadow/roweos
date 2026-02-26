// v20.13: Push Notification API — subscribe, unsubscribe, send
// Vercel serverless function
import webpush from 'web-push';

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

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    var action = body.action; // 'subscribe', 'unsubscribe', 'send', 'test'
    var uid = body.uid;

    if (!uid) return res.status(400).json({ error: 'Missing uid' });

    var projectId = process.env.FIREBASE_PROJECT_ID;
    var saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!projectId || !saJson) {
      return res.status(500).json({ error: 'Firebase not configured' });
    }

    var sa = JSON.parse(saJson);
    var googleToken = await getGoogleAccessToken(sa);

    // --- Subscribe: Store push subscription in Firestore ---
    if (action === 'subscribe') {
      var subscription = body.subscription;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Missing subscription data' });
      }

      // Use endpoint hash as doc ID (stable across re-subscribes)
      var crypto = require('crypto');
      var subId = crypto.createHash('sha256').update(subscription.endpoint).digest('hex').substring(0, 20);
      var docPath = 'projects/' + projectId + '/databases/(default)/documents/users/' + uid + '/push_subscriptions/' + subId;

      var fields = firestoreDocToFields({
        endpoint: subscription.endpoint,
        keys: JSON.stringify(subscription.keys || {}),
        createdAt: new Date().toISOString(),
        enabled: true
      });

      await fetch('https://firestore.googleapis.com/v1/' + docPath, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fields })
      });

      console.log('[Push] Subscription stored for user ' + uid);
      return res.status(200).json({ success: true, subscriptionId: subId });
    }

    // --- Unsubscribe: Remove subscription from Firestore ---
    if (action === 'unsubscribe') {
      var endpoint = body.endpoint;
      if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

      var crypto = require('crypto');
      var subId = crypto.createHash('sha256').update(endpoint).digest('hex').substring(0, 20);
      var docPath = 'projects/' + projectId + '/databases/(default)/documents/users/' + uid + '/push_subscriptions/' + subId;

      await fetch('https://firestore.googleapis.com/v1/' + docPath, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + googleToken }
      });

      console.log('[Push] Subscription removed for user ' + uid);
      return res.status(200).json({ success: true });
    }

    // --- Send: Push notification to all user's subscriptions ---
    if (action === 'send') {
      var title = body.title || 'RoweOS';
      var message = body.message || '';
      var tag = body.tag || '';
      var url = body.url || '/';

      // Read all subscriptions for user
      var listUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId +
        '/databases/(default)/documents/users/' + uid + '/push_subscriptions';
      var listResp = await fetch(listUrl, {
        headers: { 'Authorization': 'Bearer ' + googleToken }
      });
      var listData = await listResp.json();
      var docs = listData.documents || [];

      var payload = JSON.stringify({ title: title, body: message, tag: tag, url: url, type: body.type || 'general' });
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

        if (!sub.endpoint) continue;

        try {
          await webpush.sendNotification(sub, payload);
          sent++;
        } catch(err) {
          console.log('[Push] Send failed:', err.statusCode, err.body);
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Subscription expired — mark for cleanup
            stale.push(doc.name);
          }
          failed++;
        }
      }

      // Clean up stale subscriptions
      for (var j = 0; j < stale.length; j++) {
        try {
          await fetch('https://firestore.googleapis.com/v1/' + stale[j], {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + googleToken }
          });
        } catch(e) {}
      }

      console.log('[Push] Sent ' + sent + ' notifications, ' + failed + ' failed, ' + stale.length + ' cleaned up');
      return res.status(200).json({ success: true, sent: sent, failed: failed, cleaned: stale.length });
    }

    // --- Test: Send test notification ---
    if (action === 'test') {
      // Reuse send logic with test payload
      body.action = 'send';
      body.title = 'RoweOS';
      body.message = 'Push notifications are working';
      body.tag = 'roweos-test';
      body.type = 'test';
      return handler(req, res);
    }

    return res.status(400).json({ error: 'Invalid action. Use: subscribe, unsubscribe, send, test' });

  } catch(err) {
    console.error('[Push] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
