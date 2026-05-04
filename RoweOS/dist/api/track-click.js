// v31.2: Campaign click-through tracker
// GET /api/track-click?c=founder_offer&to=/
// Increments Firestore campaign_clicks/{c} counter then 302-redirects to ?to= with the original campaign source param.

var crypto = require('crypto');

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
  if (!resp.ok) throw new Error('Google token exchange failed: ' + resp.status);
  var data = await resp.json();
  return data.access_token;
}

function firestoreBaseUrl(projectId) {
  return 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
}

// Atomic counter increment via Firestore commit transform
async function incrementCounter(projectId, accessToken, campaign) {
  var docPath = 'projects/' + projectId + '/databases/(default)/documents/campaign_clicks/' + campaign;
  var body = {
    writes: [
      {
        transform: {
          document: docPath,
          fieldTransforms: [
            { fieldPath: 'totalClicks', increment: { integerValue: '1' } },
            { fieldPath: 'lastClickAt', setToServerValue: 'REQUEST_TIME' }
          ]
        }
      },
      {
        update: {
          name: docPath,
          fields: {
            campaign: { stringValue: campaign }
          }
        },
        updateMask: { fieldPaths: ['campaign'] },
        currentDocument: { exists: false }
      }
    ]
  };
  // Try the combined write first; if doc exists, fall back to transform-only.
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents:commit';
  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (resp.ok) return true;
  // Fallback: doc already exists, just run the transform
  var fallbackBody = {
    writes: [{
      transform: {
        document: docPath,
        fieldTransforms: [
          { fieldPath: 'totalClicks', increment: { integerValue: '1' } },
          { fieldPath: 'lastClickAt', setToServerValue: 'REQUEST_TIME' }
        ]
      }
    }]
  };
  var resp2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fallbackBody)
  });
  if (!resp2.ok) {
    var err = await resp2.text();
    throw new Error('Counter increment failed: ' + resp2.status + ' ' + err);
  }
  return true;
}

// v31.3: Per-user click attribution. Writes campaign_clicks/{c}/clicks/{safeKey}
// with clickCount + lastClickAt + recipient identifier so admins see WHO clicked.
function _safeDocId(s) {
  // Firestore doc IDs disallow '/'. Replace problematic chars while staying readable.
  return String(s).replace(/[\/#?\.\[\]]/g, '_').slice(0, 200);
}
async function incrementUserClick(projectId, accessToken, campaign, recipient) {
  if (!recipient) return false;
  var safeKey = _safeDocId(recipient);
  var docPath = 'projects/' + projectId + '/databases/(default)/documents/campaign_clicks/' + campaign + '/clicks/' + safeKey;
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents:commit';
  var body = {
    writes: [
      {
        transform: {
          document: docPath,
          fieldTransforms: [
            { fieldPath: 'clickCount', increment: { integerValue: '1' } },
            { fieldPath: 'lastClickAt', setToServerValue: 'REQUEST_TIME' }
          ]
        }
      },
      {
        update: {
          name: docPath,
          fields: {
            recipient: { stringValue: recipient },
            campaign: { stringValue: campaign }
          }
        },
        updateMask: { fieldPaths: ['recipient', 'campaign'] },
        currentDocument: { exists: false }
      }
    ]
  };
  var resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (resp.ok) return true;
  // Doc exists: run transform alone
  var resp2 = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [{ transform: { document: docPath, fieldTransforms: [
      { fieldPath: 'clickCount', increment: { integerValue: '1' } },
      { fieldPath: 'lastClickAt', setToServerValue: 'REQUEST_TIME' }
    ]}}]})
  });
  if (!resp2.ok) {
    var err = await resp2.text();
    console.error('[TrackClick] Per-user increment failed:', resp2.status, err);
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  var campaign = (req.query.c || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
  var to = req.query.to || '/';
  var u = (req.query.u || '').slice(0, 256); // recipient identifier (email or uid)
  // v34.107: harden open-redirect guard. Previous check only blocked absolute
  // URLs starting with 'http' or '//'; a relative path like '/admin' or one with
  // '..' segments still went through. Now require the path to start with '/' and
  // contain no scheme markers, no protocol-relative slashes, and no '..' traversal.
  if (typeof to !== 'string' || to.indexOf('http') === 0 || to.indexOf('//') === 0
      || to.indexOf('..') !== -1 || to.charAt(0) !== '/') {
    to = '/';
  }
  if (!campaign) {
    return res.status(400).json({ error: 'Missing campaign id (c=)' });
  }
  // Best-effort tracking: log failures but always redirect so the user isn't stuck.
  try {
    var projectId = process.env.FIREBASE_PROJECT_ID;
    var serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (projectId && serviceAccountRaw) {
      var serviceAccount = JSON.parse(serviceAccountRaw);
      var accessToken = await getGoogleAccessToken(serviceAccount);
      await incrementCounter(projectId, accessToken, campaign);
      if (u) {
        await incrementUserClick(projectId, accessToken, campaign, u);
        console.log('[TrackClick] Counted', campaign, 'for', u);
      } else {
        console.log('[TrackClick] Counted', campaign, '(anonymous)');
      }
    } else {
      console.warn('[TrackClick] Missing env vars - skipping count');
    }
  } catch (err) {
    console.error('[TrackClick] Tracking failed:', err.message);
  }
  // Always redirect (with source param so client UX still recognizes the campaign)
  var sep = to.indexOf('?') === -1 ? '?' : '&';
  var redirectUrl = to + sep + 'source=' + encodeURIComponent(campaign);
  res.writeHead(302, { Location: redirectUrl });
  res.end();
};
