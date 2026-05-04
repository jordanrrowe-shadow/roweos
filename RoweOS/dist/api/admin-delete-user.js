// v31.2: Admin "delete user everywhere" endpoint
// POST { email, uid?, callerUid }
// Verifies caller is admin, deletes Firebase Auth user (by email or uid),
// then sweeps every Firestore collection that references that user
// (by uid AND by email field). Mirrors scripts/delete-firebase-users.js +
// scripts/delete-firestore-by-email.js so admin UI stays in sync with CLI.

var crypto = require('crypto');

var ADMIN_UID = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';

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

async function getGoogleAccessToken(serviceAccount, scope) {
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var payload = {
    iss: serviceAccount.client_email,
    scope: scope,
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
  if (!resp.ok) throw new Error('Token exchange failed: ' + resp.status);
  var data = await resp.json();
  return data.access_token;
}

// --- Identity Toolkit (Auth admin) ---

// v34.107: Verify a Firebase ID token via Identity Toolkit and return the localId
// (the Firebase user's UID). Returns null on any failure - callers must check.
// We hit accounts:lookup with the service-account-issued Google access token PLUS
// the user's idToken in the body. The response contains a verified user record
// only if the idToken signature, issuer, audience, and expiration all check out.
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
    if (!data.users || !data.users[0]) return null;
    var user = data.users[0];
    // Sanity: localId must be present and the lookup must agree with the token.
    if (!user.localId) return null;
    return user;
  } catch (e) {
    console.error('[admin-delete-user] verifyIdToken error:', e && e.message);
    return null;
  }
}

async function lookupAuthUserByEmail(idtkToken, projectId, email) {
  var resp = await fetch('https://identitytoolkit.googleapis.com/v1/projects/' + projectId + '/accounts:lookup', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + idtkToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: [email] })
  });
  if (!resp.ok) return null;
  var data = await resp.json();
  return (data.users && data.users[0]) || null;
}

async function deleteAuthUser(idtkToken, projectId, uid) {
  var resp = await fetch('https://identitytoolkit.googleapis.com/v1/projects/' + projectId + '/accounts:delete', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + idtkToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: uid })
  });
  if (!resp.ok) {
    var t = await resp.text();
    throw new Error('Auth delete failed: ' + resp.status + ' ' + t);
  }
  return true;
}

// --- Firestore helpers ---

function firestoreBaseUrl(projectId) {
  return 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
}

async function firestoreDelete(projectId, fsToken, docPath) {
  var url = firestoreBaseUrl(projectId) + '/' + docPath;
  var resp = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + fsToken }
  });
  // 200 OK or 404 (already gone) both acceptable
  if (!resp.ok && resp.status !== 404) {
    var t = await resp.text();
    console.warn('[adminDeleteUser] Delete', docPath, 'failed:', resp.status, t);
    return false;
  }
  return true;
}

async function firestoreQueryByField(projectId, fsToken, collection, field, value) {
  var url = firestoreBaseUrl(projectId) + ':runQuery';
  var body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: 'EQUAL',
          value: { stringValue: value }
        }
      },
      limit: 100
    }
  };
  var resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + fsToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) return [];
  var data = await resp.json();
  if (!Array.isArray(data)) return [];
  var docs = [];
  data.forEach(function(row) {
    if (row.document && row.document.name) {
      // Strip the "projects/.../documents/" prefix to get the relative path
      var prefix = 'projects/' + projectId + '/databases/(default)/documents/';
      var path = row.document.name.indexOf(prefix) === 0
        ? row.document.name.substring(prefix.length)
        : row.document.name;
      docs.push(path);
    }
  });
  return docs;
}

// Recursively delete a document and all its subcollections.
// Firestore REST doesn't have a "recursive delete" - but for our schema we know
// the subcollections to look for under roweos_users (per write paths in the app).
var KNOWN_SUBCOLLECTIONS = ['brands', 'config', 'memory', 'cloud_outbox', 'goals', 'social_tokens', 'reminders'];

async function deleteUserDocAndSubcollections(projectId, fsToken, uid) {
  // Try known subcollections first
  for (var i = 0; i < KNOWN_SUBCOLLECTIONS.length; i++) {
    var sub = KNOWN_SUBCOLLECTIONS[i];
    try {
      var docs = await firestoreListCollection(projectId, fsToken, 'roweos_users/' + uid + '/' + sub);
      for (var j = 0; j < docs.length; j++) {
        await firestoreDelete(projectId, fsToken, docs[j]);
      }
    } catch (e) { /* skip */ }
  }
  // Then the parent doc
  await firestoreDelete(projectId, fsToken, 'roweos_users/' + uid);
}

async function firestoreListCollection(projectId, fsToken, collectionPath) {
  var url = firestoreBaseUrl(projectId) + '/' + collectionPath + '?pageSize=100';
  var resp = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + fsToken }
  });
  if (!resp.ok) return [];
  var data = await resp.json();
  if (!data.documents) return [];
  var prefix = 'projects/' + projectId + '/databases/(default)/documents/';
  return data.documents.map(function(doc) {
    return doc.name.indexOf(prefix) === 0 ? doc.name.substring(prefix.length) : doc.name;
  });
}

// --- Handler ---

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  var body = req.body || {};
  var email = (body.email || '').toLowerCase().trim();
  var uid = body.uid || '';

  // v34.107: Server-side admin verification via Firebase ID token. The previous
  // body.callerUid check was bypassable - anyone who learned ADMIN_UID could pass
  // the gate. Now we require Authorization: Bearer <idToken>, verify it via
  // Identity Toolkit, and only proceed if the verified UID matches ADMIN_UID.
  var authHeader = req.headers.authorization || req.headers.Authorization || '';
  var idToken = '';
  if (authHeader.indexOf('Bearer ') === 0) idToken = authHeader.substring(7).trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Missing Authorization header (Firebase ID token)' });
  }

  if (!email && !uid) {
    return res.status(400).json({ error: 'email or uid required' });
  }

  var projectId = process.env.FIREBASE_PROJECT_ID;
  var serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!projectId || !serviceAccountRaw) {
    return res.status(500).json({ error: 'Server not configured (missing FIREBASE_*)' });
  }

  try {
    var serviceAccount = JSON.parse(serviceAccountRaw);
    // Two scopes: Firestore + Identity Toolkit (Auth)
    var fsToken = await getGoogleAccessToken(serviceAccount, 'https://www.googleapis.com/auth/datastore');
    var idtkToken = await getGoogleAccessToken(serviceAccount, 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase');

    // v34.107: verify the ID token and confirm the caller is the admin BEFORE
    // any destructive operation. Failures here return 401/403 - never proceed.
    var verifiedUser = await verifyIdToken(idtkToken, idToken);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
    }
    if (verifiedUser.localId !== ADMIN_UID) {
      return res.status(403).json({ error: 'Admin only' });
    }

    var report = { authDeleted: false, firestoreDeleted: 0, errors: [] };

    // 1. Resolve the Auth user (by uid if given, else by email lookup)
    var resolvedUid = uid;
    if (!resolvedUid && email) {
      try {
        var authUser = await lookupAuthUserByEmail(idtkToken, projectId, email);
        if (authUser) resolvedUid = authUser.localId;
      } catch (e) { report.errors.push('auth lookup: ' + e.message); }
    }

    // 2. Delete Auth user
    if (resolvedUid) {
      try {
        await deleteAuthUser(idtkToken, projectId, resolvedUid);
        report.authDeleted = true;
      } catch (e) {
        // Non-fatal - keep going with Firestore cleanup
        report.errors.push('auth delete: ' + e.message);
      }
    }

    // 3. Delete roweos_users/{uid} doc + known subcollections
    if (resolvedUid) {
      try {
        await deleteUserDocAndSubcollections(projectId, fsToken, resolvedUid);
        report.firestoreDeleted++;
      } catch (e) { report.errors.push('roweos_users: ' + e.message); }
    }

    // 4. Sweep top-level collections that reference user by `email` field
    var COLLECTIONS = ['admin_notifications', 'signups', 'newsletter_subscribers', 'feedback', 'access_keys', 'email_log', 'info_leads'];
    if (email) {
      for (var i = 0; i < COLLECTIONS.length; i++) {
        try {
          var docs = await firestoreQueryByField(projectId, fsToken, COLLECTIONS[i], 'email', email);
          for (var j = 0; j < docs.length; j++) {
            await firestoreDelete(projectId, fsToken, docs[j]);
            report.firestoreDeleted++;
          }
        } catch (e) { report.errors.push(COLLECTIONS[i] + ': ' + e.message); }
      }
      // email_log uses userEmail, not email
      try {
        var logDocs = await firestoreQueryByField(projectId, fsToken, 'email_log', 'userEmail', email);
        for (var k = 0; k < logDocs.length; k++) {
          await firestoreDelete(projectId, fsToken, logDocs[k]);
          report.firestoreDeleted++;
        }
      } catch (e) { report.errors.push('email_log(userEmail): ' + e.message); }
      // Release any api_key_pool entries assigned to this email back to available
      try {
        var poolDocs = await firestoreQueryByField(projectId, fsToken, 'api_key_pool', 'assignedToEmail', email);
        for (var p = 0; p < poolDocs.length; p++) {
          // Mark available rather than delete the pool key itself
          var url = firestoreBaseUrl(projectId) + '/' + poolDocs[p] + '?updateMask.fieldPaths=status&updateMask.fieldPaths=assignedToEmail';
          await fetch(url, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + fsToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { status: { stringValue: 'available' }, assignedToEmail: { stringValue: '' } } })
          });
        }
      } catch (e) { report.errors.push('api_key_pool: ' + e.message); }
    }

    // 5. onboarding_responses subcollection cleanup
    if (resolvedUid) {
      try {
        var respDocs = await firestoreListCollection(projectId, fsToken, 'onboarding_responses/' + resolvedUid + '/responses');
        for (var r = 0; r < respDocs.length; r++) {
          await firestoreDelete(projectId, fsToken, respDocs[r]);
          report.firestoreDeleted++;
        }
        await firestoreDelete(projectId, fsToken, 'onboarding_responses/' + resolvedUid);
      } catch (e) { /* skip */ }
    }

    return res.status(200).json({ ok: true, email: email, uid: resolvedUid, report: report });
  } catch (err) {
    console.error('[admin-delete-user] FAILED:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
};
