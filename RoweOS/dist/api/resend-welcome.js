// v22.7: Email composer — sends HTML email via Resend
// POST { email, subject, from, html, uid, adminUid }
// Admin: unrestricted. Non-admin: verified via Firestore, rate-limited 10/hr.

var crypto = require('crypto');

// --- Firebase auth helpers (copied from push.js) ---
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

// --- Rate limiting (in-memory, per-serverless instance) ---
var rateLimitMap = {};
var RATE_LIMIT_MAX = 10;
var RATE_LIMIT_WINDOW = 3600000; // 1 hour

function checkRateLimit(uid) {
  var now = Date.now();
  if (!rateLimitMap[uid]) rateLimitMap[uid] = [];
  // Purge old entries
  rateLimitMap[uid] = rateLimitMap[uid].filter(function(t) { return now - t < RATE_LIMIT_WINDOW; });
  if (rateLimitMap[uid].length >= RATE_LIMIT_MAX) return false;
  rateLimitMap[uid].push(now);
  return true;
}

// --- Verify user exists in Firestore ---
async function verifyFirebaseUser(uid, projectId, accessToken) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/users/' + uid;
  var resp = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  return resp.ok;
}

// v22.36: Allow up to 60s for large attachment downloads
export var config = { maxDuration: 60 };

export default async function handler(req, res) {
  // CORS headers
  var origin = (req.headers.origin || '').trim();
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    var body = req.body || {};
    var email = (body.email || '').trim();
    var subject = (body.subject || '').trim();
    var fromAddr = (body.from || 'roweos@therowecollection.com').trim();
    var htmlBody = body.html || '';
    var cc = Array.isArray(body.cc) ? body.cc : [];
    var bcc = Array.isArray(body.bcc) ? body.bcc : [];
    var uid = (body.uid || body.adminUid || '').trim();

    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }
    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!htmlBody) {
      return res.status(400).json({ error: 'Email body is required' });
    }
    if (!uid) {
      return res.status(403).json({ error: 'Authentication required' });
    }

    // v22.7: Auth — admin passes through, non-admin verified via Firestore
    var ADMIN_UID = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';
    var isAdmin = (uid === ADMIN_UID);

    if (!isAdmin) {
      // Verify user via Firestore if env vars available
      var projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
      var saRaw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
      if (!projectId || !saRaw) {
        return res.status(403).json({ error: 'Email sending requires admin access (Firebase not configured)' });
      }
      var serviceAccount;
      try { serviceAccount = JSON.parse(saRaw); } catch(e) {
        return res.status(500).json({ error: 'Invalid service account configuration' });
      }
      var accessToken = await getGoogleAccessToken(serviceAccount);
      var userExists = await verifyFirebaseUser(uid, projectId, accessToken);
      if (!userExists) {
        return res.status(403).json({ error: 'User not found' });
      }
      // Rate limit non-admin
      if (!checkRateLimit(uid)) {
        return res.status(429).json({ error: 'Rate limit exceeded (10 emails/hour)' });
      }
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    }

    // v22.8: Validate from address — known addresses get display names, custom addresses validated
    var allowedFrom = {
      'roweos@therowecollection.com': 'RoweOS <roweos@therowecollection.com>',
      'jordan@therowecollection.com': 'Jordan Rowe <jordan@therowecollection.com>'
    };
    var fromDisplay = allowedFrom[fromAddr];
    if (!fromDisplay) {
      // Allow custom from if it looks like a valid email (basic validation)
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(fromAddr)) {
        return res.status(400).json({ error: 'Invalid from email address' });
      }
      // Extract name part if provided as "Name <email>" format, otherwise use email as-is
      if (fromAddr.indexOf('<') !== -1 && fromAddr.indexOf('>') !== -1) {
        fromDisplay = fromAddr;
      } else {
        var namePart = fromAddr.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        fromDisplay = namePart + ' <' + fromAddr + '>';
      }
    }

    // v22.36: Strip any remaining base64 images from HTML (logo uses Firebase Storage URL)
    htmlBody = htmlBody.replace(/<img[^>]+src\s*=\s*["']data:[^"']+["'][^>]*>/gi, '');

    // v22.31: Build payload with optional attachments
    var resendPayload = Object.assign({
      from: fromDisplay,
      reply_to: 'jordan@therowecollection.com',
      to: [email],
      subject: subject,
      html: htmlBody
    }, cc.length ? { cc: cc } : {}, bcc.length ? { bcc: bcc } : {});

    // v22.36: Attachments — download URL-based ones, pass base64 directly
    var attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if (attachments.length > 0) {
      var resolvedAttachments = [];
      for (var ai = 0; ai < attachments.length; ai++) {
        var att = attachments[ai];
        if (att.url) {
          // Download from Firebase Storage URL, base64 encode for Resend REST API
          try {
            var dlResp = await fetch(att.url);
            if (dlResp.ok) {
              var dlBuf = Buffer.from(await dlResp.arrayBuffer());
              resolvedAttachments.push({
                filename: att.filename || 'attachment',
                content: dlBuf.toString('base64')
              });
              console.log('[resend-welcome] Downloaded attachment:', att.filename, dlBuf.length, 'bytes');
            } else {
              console.error('[resend-welcome] Failed to download attachment:', att.url, dlResp.status);
            }
          } catch(dlErr) {
            console.error('[resend-welcome] Attachment download error:', dlErr.message);
          }
        } else if (att.content) {
          resolvedAttachments.push({
            filename: att.filename || 'attachment',
            content: att.content
          });
        }
      }
      if (resolvedAttachments.length > 0) {
        resendPayload.attachments = resolvedAttachments;
      }
    }

    var resendBody = JSON.stringify(resendPayload);
    console.log('[resend-welcome] Payload size:', Math.round(resendBody.length / 1024), 'KB, attachments:', (resendPayload.attachments || []).length);
    var resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + (process.env.RESEND_API_KEY || '').trim(),
        'Content-Type': 'application/json'
      },
      body: resendBody
    });

    if (resendResp.ok) {
      var resendData = await resendResp.json();
      console.log('[resend-welcome] Email sent to:', email, 'from:', fromAddr, 'uid:', uid, 'id:', resendData.id, 'attachments:', resolvedAttachments.length);
      return res.status(200).json({ success: true, emailId: resendData.id, attachmentCount: resolvedAttachments.length });
    } else {
      var errText = await resendResp.text();
      console.error('[resend-welcome] Resend error:', resendResp.status, errText);
      return res.status(500).json({ error: 'Failed to send email: ' + errText });
    }

  } catch (error) {
    console.error('[resend-welcome] Handler error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
