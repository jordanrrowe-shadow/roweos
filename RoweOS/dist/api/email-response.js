// v30.0: Email Response Capture Endpoint
// Captures user responses from clickable email links (onboarding surveys, check-ins)
// GET only - email links cannot POST
// Validates HMAC token, writes response to Firestore, returns styled thank-you page

var crypto = require('crypto');

// --- JWT / Google Auth helpers (same pattern as scheduler.js) ---

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
  var header = { alg: 'RS256', typ: 'JWT' };
  var payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  var jwt = await signJwt(header, payload, serviceAccount.private_key);

  var resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Google token exchange failed: ' + resp.status + ' ' + errText);
  }

  var data = await resp.json();
  return data.access_token;
}

// --- Firestore helpers ---

function firestoreBaseUrl(projectId) {
  return 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  return { stringValue: String(val) };
}

// Create a document with auto-generated ID (POST to collection)
async function firestoreCreate(projectId, accessToken, collectionPath, fields) {
  var url = firestoreBaseUrl(projectId) + '/' + collectionPath;
  var firestoreFields = {};
  var keys = Object.keys(fields);
  for (var i = 0; i < keys.length; i++) {
    firestoreFields[keys[i]] = toFirestoreValue(fields[keys[i]]);
  }

  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: firestoreFields })
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Firestore create failed (' + collectionPath + '): ' + resp.status + ' ' + errText);
  }

  return await resp.json();
}

// --- HMAC validation ---

function validateToken(uid, question, answer, token) {
  var secret = process.env.EMAIL_RESPONSE_SECRET;
  if (!secret || !token) return false;

  var message = uid + ':' + question + ':' + answer;
  var expected = crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex')
    .substring(0, 16);

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(token, 'utf8')
    );
  } catch (e) {
    // Length mismatch means invalid
    return false;
  }
}

// --- Thank-you page HTML ---

function renderThankYouPage(answer) {
  var safeAnswer = String(answer || 'your response')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>RoweOS - Response Received</title>' +
    '<style>' +
    '* { margin: 0; padding: 0; box-sizing: border-box; }' +
    'body {' +
    '  background: #0a0a0a;' +
    '  color: #e0e0e0;' +
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
    '  display: flex;' +
    '  align-items: center;' +
    '  justify-content: center;' +
    '  min-height: 100vh;' +
    '  padding: 20px;' +
    '}' +
    '.card {' +
    '  background: #1a1a1a;' +
    '  border-radius: 16px;' +
    '  padding: 48px 40px;' +
    '  max-width: 480px;' +
    '  width: 100%;' +
    '  text-align: center;' +
    '  border: 1px solid rgba(168, 152, 120, 0.15);' +
    '}' +
    '.icon {' +
    '  width: 56px;' +
    '  height: 56px;' +
    '  margin: 0 auto 24px;' +
    '  border-radius: 50%;' +
    '  background: rgba(168, 152, 120, 0.12);' +
    '  display: flex;' +
    '  align-items: center;' +
    '  justify-content: center;' +
    '}' +
    '.icon svg {' +
    '  width: 28px;' +
    '  height: 28px;' +
    '  stroke: #a89878;' +
    '  fill: none;' +
    '  stroke-width: 2;' +
    '  stroke-linecap: round;' +
    '  stroke-linejoin: round;' +
    '}' +
    'h1 {' +
    '  font-size: 22px;' +
    '  font-weight: 600;' +
    '  color: #ffffff;' +
    '  margin-bottom: 12px;' +
    '}' +
    '.answer-label {' +
    '  display: inline-block;' +
    '  background: rgba(168, 152, 120, 0.12);' +
    '  color: #a89878;' +
    '  padding: 6px 16px;' +
    '  border-radius: 20px;' +
    '  font-size: 14px;' +
    '  font-weight: 500;' +
    '  margin-bottom: 20px;' +
    '}' +
    'p {' +
    '  font-size: 15px;' +
    '  color: #888;' +
    '  line-height: 1.6;' +
    '}' +
    '.brand {' +
    '  margin-top: 32px;' +
    '  font-size: 12px;' +
    '  color: #555;' +
    '  letter-spacing: 0.5px;' +
    '}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="card">' +
    '<div class="icon">' +
    '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
    '</div>' +
    '<h1>Thank you</h1>' +
    '<div class="answer-label">' + safeAnswer + '</div>' +
    '<p>Your response has been recorded. We appreciate your feedback and will use it to improve your experience.</p>' +
    '<div class="brand">RoweOS</div>' +
    '</div>' +
    '</body>' +
    '</html>';
}

// --- Main handler ---

module.exports = async function handler(req, res) {
  // GET only
  if (req.method !== 'GET') {
    res.status(405).setHeader('Allow', 'GET').send('Method Not Allowed');
    return;
  }

  var uid = req.query.user || '';
  var question = req.query.q || '';
  var answer = req.query.a || '';
  var token = req.query.token || '';
  var template = req.query.tpl || '';

  // Always show the thank-you page regardless of validation outcome
  var html = renderThankYouPage(answer);

  // Validate required params
  if (!uid || !question || !answer) {
    console.log('[EmailResponse] Missing required params: user=' + uid + ', q=' + question + ', a=' + answer);
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    return;
  }

  // Validate HMAC token
  var isValid = validateToken(uid, question, answer, token);

  if (!isValid) {
    console.log('[EmailResponse] Invalid token for user=' + uid + ', q=' + question);
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    return;
  }

  // Token is valid - write to Firestore
  try {
    var projectId = process.env.FIREBASE_PROJECT_ID;
    var serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!projectId || !serviceAccountRaw) {
      console.error('[EmailResponse] Missing FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT env vars');
      res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
      return;
    }

    var serviceAccount = JSON.parse(serviceAccountRaw);
    var accessToken = await getGoogleAccessToken(serviceAccount);

    var collectionPath = 'onboarding_responses/' + uid + '/responses';
    var responseData = {
      question: question,
      answer: answer,
      timestamp: new Date().toISOString(),
      email_template: template,
      source: 'email_link'
    };

    await firestoreCreate(projectId, accessToken, collectionPath, responseData);
    console.log('[EmailResponse] Saved response for user=' + uid + ', q=' + question + ', a=' + answer);
  } catch (err) {
    // Log the error but still show the thank-you page (graceful degradation)
    console.error('[EmailResponse] Firestore write failed:', err.message);
  }

  res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
};
