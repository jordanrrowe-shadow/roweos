// v20.14: Push Notification API — subscribe, unsubscribe, send
// Vercel serverless function — uses Node crypto (no npm deps)

var crypto = require('crypto');

// --- Web Push implementation (RFC 8291 / RFC 8188) ---

function base64urlEncode(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function createVapidJwt(audience, subject, vapidPublicKey, vapidPrivateKey, expiration) {
  var header = { typ: 'JWT', alg: 'ES256' };
  var payload = {
    aud: audience,
    exp: expiration || Math.floor(Date.now() / 1000) + 86400,
    sub: subject
  };
  var unsignedToken = base64urlEncode(JSON.stringify(header)) + '.' + base64urlEncode(JSON.stringify(payload));

  var privateKeyDer = base64urlDecode(vapidPrivateKey);
  var jwk = {
    kty: 'EC', crv: 'P-256',
    d: base64urlEncode(privateKeyDer),
    x: base64urlEncode(base64urlDecode(vapidPublicKey).slice(1, 33)),
    y: base64urlEncode(base64urlDecode(vapidPublicKey).slice(33, 65))
  };
  var keyObj = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  var sig = crypto.sign('SHA256', Buffer.from(unsignedToken), { key: keyObj, dsaEncoding: 'ieee-p1363' });
  return unsignedToken + '.' + base64urlEncode(sig);
}

function encryptPayload(payload, subscriptionKeys) {
  var clientPublicKey = base64urlDecode(subscriptionKeys.p256dh);
  var authSecret = base64urlDecode(subscriptionKeys.auth);
  var salt = crypto.randomBytes(16);

  var serverKeys = crypto.createECDH('prime256v1');
  serverKeys.generateKeys();
  var serverPublicKey = serverKeys.getPublicKey();
  var sharedSecret = serverKeys.computeSecret(clientPublicKey);

  // HKDF
  function hkdf(ikm, salt, info, length) {
    var prk = crypto.createHmac('sha256', salt).update(ikm).digest();
    var infoBuffer = Buffer.concat([info, Buffer.from([1])]);
    return crypto.createHmac('sha256', prk).update(infoBuffer).digest().slice(0, length);
  }

  // IKM
  var authInfo = Buffer.from('WebPush: info\0');
  var ikm_info = Buffer.concat([authInfo, clientPublicKey, serverPublicKey]);
  var ikm = hkdf(sharedSecret, authSecret, ikm_info, 32);

  // Content encryption key and nonce
  var contentEncryptionKeyInfo = Buffer.from('Content-Encoding: aes128gcm\0');
  var nonceInfo = Buffer.from('Content-Encoding: nonce\0');
  var cek = hkdf(ikm, salt, contentEncryptionKeyInfo, 16);
  var nonce = hkdf(ikm, salt, nonceInfo, 12);

  // Encrypt with AES-128-GCM
  var paddedPayload = Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])]);
  var cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  var encrypted = Buffer.concat([cipher.update(paddedPayload), cipher.final(), cipher.getAuthTag()]);

  // Build aes128gcm body: salt (16) + rs (4) + idlen (1) + keyid (65) + encrypted
  var rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  var idlen = Buffer.from([65]);
  return Buffer.concat([salt, rs, idlen, serverPublicKey, encrypted]);
}

async function sendWebPush(subscription, payload, vapidPublicKey, vapidPrivateKey, vapidSubject) {
  var endpoint = subscription.endpoint;
  var url = new URL(endpoint);
  var audience = url.origin;

  var jwt = createVapidJwt(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);
  var vapidKeyBase64 = vapidPublicKey;

  var body = encryptPayload(payload, subscription.keys);

  var resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': 'vapid t=' + jwt + ', k=' + vapidKeyBase64,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400'
    },
    body: body
  });

  if (!resp.ok) {
    var errText = await resp.text().catch(function() { return ''; });
    var err = new Error('Push send failed: ' + resp.status + ' ' + errText.substring(0, 200));
    err.statusCode = resp.status;
    throw err;
  }
  return true;
}

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
      console.log('[Push] Subscribe: keys present:', !!(subscription.keys && subscription.keys.p256dh && subscription.keys.auth));

      var subId = crypto.createHash('sha256').update(subscription.endpoint).digest('hex').substring(0, 20);
      var docPath = 'projects/' + projectId + '/databases/(default)/documents/users/' + uid + '/push_subscriptions/' + subId;
      var fields = firestoreDocToFields({
        endpoint: subscription.endpoint,
        keys: subscription.keys ? JSON.stringify(subscription.keys) : '{}',
        createdAt: new Date().toISOString(),
        enabled: true
      });

      console.log('[Push] Firestore PATCH to:', docPath);
      var patchResp = await fetch('https://firestore.googleapis.com/v1/' + docPath, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fields })
      });

      if (!patchResp.ok) {
        var patchErr = await patchResp.text().catch(function() { return ''; });
        console.error('[Push] Firestore PATCH failed:', patchResp.status, patchErr.substring(0, 500));
        return res.status(500).json({ error: 'Failed to store subscription: ' + patchResp.status, detail: patchErr.substring(0, 200) });
      }

      var patchResult = await patchResp.json().catch(function() { return {}; });
      console.log('[Push] Subscription stored OK for uid:', uid, 'subId:', subId, 'docName:', (patchResult.name || 'unknown'));
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

      // Read subscriptions
      var listUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId +
        '/databases/(default)/documents/users/' + uid + '/push_subscriptions';
      console.log('[Push] Listing subscriptions at:', listUrl);
      var listResp = await fetch(listUrl, { headers: { 'Authorization': 'Bearer ' + googleToken } });
      var listData = await listResp.json();
      var docs = listData.documents || [];
      console.log('[Push] Found', docs.length, 'subscription doc(s) for uid:', uid);

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
        if (!sub.endpoint || !sub.keys.p256dh || !sub.keys.auth) continue;

        try {
          await sendWebPush(sub, payload, vapidPublic, vapidPrivate, vapidSubject);
          sent++;
        } catch(err) {
          console.log('[Push] Send failed:', err.statusCode, err.message);
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
