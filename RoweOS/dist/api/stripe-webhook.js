// v20.6: Stripe Webhook Handler
// Vercel serverless function — handles Stripe checkout.session.completed events
// Generates access key, writes to Firestore, sends confirmation email via Resend
// Uses Firestore REST API (no npm deps) with service account JWT for auth

// --- JWT / Google Auth helpers ---

// Base64url encode (no padding)
function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Sign JWT with RS256 using Node crypto
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

// Get a Google access token from service account credentials
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

// --- Firestore REST helpers ---

function firestoreBaseUrl(projectId) {
  return 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
}

// Write a document to Firestore
async function firestoreSet(projectId, accessToken, collection, docId, fields) {
  var url = firestoreBaseUrl(projectId) + '/' + collection + '/' + docId;
  var firestoreFields = {};
  for (var key in fields) {
    var val = fields[key];
    if (typeof val === 'string') {
      firestoreFields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      firestoreFields[key] = { integerValue: String(val) };
    } else if (typeof val === 'boolean') {
      firestoreFields[key] = { booleanValue: val };
    } else if (val === null || val === undefined) {
      firestoreFields[key] = { nullValue: null };
    }
  }

  var resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: firestoreFields })
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Firestore write failed (' + collection + '/' + docId + '): ' + resp.status + ' ' + errText);
  }

  return await resp.json();
}

// Query Firestore collection by field
async function firestoreQuery(projectId, accessToken, collection, fieldPath, value) {
  var url = firestoreBaseUrl(projectId) + ':runQuery';
  var body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: fieldPath },
          op: 'EQUAL',
          value: { stringValue: value }
        }
      },
      limit: 1
    }
  };

  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Firestore query failed: ' + resp.status + ' ' + errText);
  }

  var results = await resp.json();
  // Results is an array; each entry may have a `document` field
  if (results && results.length > 0 && results[0].document) {
    return results[0].document;
  }
  return null;
}

// Update specific fields on an existing Firestore document
async function firestoreUpdate(projectId, accessToken, docPath, fields) {
  var url = 'https://firestore.googleapis.com/v1/' + docPath;
  var firestoreFields = {};
  var updateMask = [];
  for (var key in fields) {
    updateMask.push(key);
    var val = fields[key];
    if (typeof val === 'string') {
      firestoreFields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      firestoreFields[key] = { integerValue: String(val) };
    } else if (typeof val === 'boolean') {
      firestoreFields[key] = { booleanValue: val };
    }
  }

  var queryParams = updateMask.map(function(f) { return 'updateMask.fieldPaths=' + f; }).join('&');
  var resp = await fetch(url + '?' + queryParams, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: firestoreFields })
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Firestore update failed (' + docPath + '): ' + resp.status + ' ' + errText);
  }

  return await resp.json();
}

// --- Stripe signature verification ---

function verifyStripeSignature(rawBody, sigHeader, secret) {
  var crypto = require('crypto');

  if (!sigHeader || !secret) return false;

  // Parse Stripe-Signature header: t=timestamp,v1=signature
  var parts = {};
  sigHeader.split(',').forEach(function(item) {
    var kv = item.split('=');
    if (kv.length === 2) {
      parts[kv[0].trim()] = kv[1].trim();
    }
  });

  var timestamp = parts.t;
  var expectedSig = parts.v1;

  if (!timestamp || !expectedSig) return false;

  // Check timestamp tolerance (5 minutes)
  var now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.error('[Stripe Webhook] Timestamp too old:', timestamp, 'now:', now);
    return false;
  }

  // Compute expected signature: HMAC-SHA256 of "timestamp.rawBody"
  var signedPayload = timestamp + '.' + rawBody;
  var hmac = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedSig));
  } catch (e) {
    return false;
  }
}

// --- Access key generation ---

function generateAccessKey() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  var part1 = '';
  var part2 = '';
  var crypto = require('crypto');
  var bytes = crypto.randomBytes(8);
  for (var i = 0; i < 4; i++) {
    part1 += chars[bytes[i] % chars.length];
    part2 += chars[bytes[i + 4] % chars.length];
  }
  return 'ROWE-' + part1 + '-' + part2;
}

// --- Tier mapping ---

// Map Stripe price/product to tier. Uses metadata first, then falls back to price lookup table.
function mapSessionToTier(session) {
  // 1. Check session metadata
  if (session.metadata && session.metadata.tier) {
    return session.metadata.tier;
  }

  // 2. Check line items metadata (if expanded)
  if (session.line_items && session.line_items.data) {
    for (var i = 0; i < session.line_items.data.length; i++) {
      var item = session.line_items.data[i];
      if (item.price && item.price.metadata && item.price.metadata.tier) {
        return item.price.metadata.tier;
      }
      if (item.price && item.price.product && typeof item.price.product === 'object' && item.price.product.metadata && item.price.product.metadata.tier) {
        return item.price.product.metadata.tier;
      }
    }
  }

  // 3. Fallback: check price ID against known prices (configure in Stripe dashboard metadata instead)
  // Add price_xxx -> tier mappings here if needed
  var priceMap = {};
  if (process.env.STRIPE_PRICE_SOLO || process.env.STRIPE_PRICE_BASIC) priceMap[process.env.STRIPE_PRICE_SOLO || process.env.STRIPE_PRICE_BASIC] = 'solo';
  if (process.env.STRIPE_PRICE_FOUNDER) priceMap[process.env.STRIPE_PRICE_FOUNDER] = 'founder';
  if (process.env.STRIPE_PRICE_PREMIUM) priceMap[process.env.STRIPE_PRICE_PREMIUM] = 'premium';

  if (session.line_items && session.line_items.data) {
    for (var j = 0; j < session.line_items.data.length; j++) {
      var priceId = session.line_items.data[j].price && session.line_items.data[j].price.id;
      if (priceId && priceMap[priceId]) {
        return priceMap[priceId];
      }
    }
  }

  // Default
  console.warn('[Stripe Webhook] Could not determine tier from session, defaulting to solo');
  return 'solo';
}

// --- Email via Resend ---

async function sendEmail(to, subject, htmlBody) {
  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Stripe Webhook] RESEND_API_KEY not set, skipping email to:', to);
    return false;
  }

  try {
    var resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'RoweOS <noreply@roweos.com>',
        to: [to],
        subject: subject,
        html: htmlBody
      })
    });

    if (!resp.ok) {
      var errText = await resp.text();
      console.error('[Stripe Webhook] Resend API error:', resp.status, errText);
      return false;
    }

    console.log('[Stripe Webhook] Email sent to:', to);
    return true;
  } catch (e) {
    console.error('[Stripe Webhook] Email send error:', e.message);
    return false;
  }
}

// --- Vercel config: disable body parsing so we get the raw body for signature verification ---
export const config = {
  api: {
    bodyParser: false
  }
};

// --- Main handler ---

export default async function handler(req, res) {
  // CORS headers
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Read raw body ---
  var rawBody;
  try {
    rawBody = await new Promise(function(resolve, reject) {
      var chunks = [];
      req.on('data', function(chunk) { chunks.push(chunk); });
      req.on('end', function() { resolve(Buffer.concat(chunks).toString('utf8')); });
      req.on('error', function(err) { reject(err); });
    });
  } catch (e) {
    console.error('[Stripe Webhook] Failed to read request body:', e.message);
    return res.status(400).json({ error: 'Failed to read request body' });
  }

  // --- Verify signature ---
  var webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  var sigHeader = req.headers['stripe-signature'];
  if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
    console.error('[Stripe Webhook] Invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // --- Parse event ---
  var event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    console.error('[Stripe Webhook] Invalid JSON:', e.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log('[Stripe Webhook] Received event:', event.type, event.id);

  // --- Handle checkout.session.completed ---
  if (event.type === 'checkout.session.completed') {
    var session = event.data && event.data.object;
    if (!session) {
      console.error('[Stripe Webhook] Missing session object in event');
      return res.status(400).json({ error: 'Missing session data' });
    }

    var customerEmail = session.customer_email || (session.customer_details && session.customer_details.email) || null;
    var tier = mapSessionToTier(session);
    var accessKey = generateAccessKey();
    var stripeSessionId = session.id || '';
    var stripeCustomerId = session.customer || '';
    var amountTotal = session.amount_total || 0;
    var currency = session.currency || 'usd';

    console.log('[Stripe Webhook] Processing checkout:', {
      email: customerEmail,
      tier: tier,
      accessKey: accessKey,
      sessionId: stripeSessionId
    });

    // --- Write to Firestore ---
    var projectId = process.env.FIREBASE_PROJECT_ID;
    var serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!projectId || !serviceAccountJson) {
      console.error('[Stripe Webhook] FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT not configured');
      // Still return 200 to Stripe so it doesn't retry, but log the failure
      return res.status(200).json({
        received: true,
        warning: 'Firestore not configured, key not saved',
        accessKey: accessKey,
        tier: tier
      });
    }

    var serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      console.error('[Stripe Webhook] Invalid FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
      return res.status(200).json({
        received: true,
        warning: 'Invalid service account config',
        accessKey: accessKey,
        tier: tier
      });
    }

    try {
      var accessToken = await getGoogleAccessToken(serviceAccount);

      // Write access key to Firestore
      var keyDoc = {
        key: accessKey,
        tier: tier,
        status: 'active',
        email: customerEmail || '',
        createdAt: new Date().toISOString(),
        stripeSessionId: stripeSessionId,
        stripeCustomerId: stripeCustomerId,
        amountTotal: amountTotal,
        currency: currency,
        source: 'stripe_webhook'
      };

      await firestoreSet(projectId, accessToken, 'access_keys', accessKey, keyDoc);
      console.log('[Stripe Webhook] Access key written to Firestore:', accessKey);

      // Try to find user by email and link the key
      if (customerEmail) {
        try {
          var userDoc = await firestoreQuery(projectId, accessToken, 'roweos_users', 'email', customerEmail);
          if (userDoc) {
            // Extract document path for update
            var docPath = userDoc.name; // Full resource path
            await firestoreUpdate(projectId, accessToken, docPath, {
              accessKey: accessKey,
              tier: tier,
              stripeCustomerId: stripeCustomerId,
              accessKeyLinkedAt: new Date().toISOString()
            });
            console.log('[Stripe Webhook] Linked access key to user:', customerEmail);
          } else {
            console.log('[Stripe Webhook] No existing user found for email:', customerEmail);
          }
        } catch (linkErr) {
          // Non-fatal — the key is still in access_keys collection
          console.error('[Stripe Webhook] Failed to link key to user:', linkErr.message);
        }
      }

      // --- Send confirmation email to customer ---
      if (customerEmail) {
        var tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
        var customerHtml = [
          '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #e0e0e0; padding: 40px; border-radius: 12px;">',
          '  <div style="text-align: center; margin-bottom: 30px;">',
          '    <h1 style="color: #a89878; margin: 0; font-size: 28px;">RoweOS</h1>',
          '    <p style="color: #888; margin: 4px 0 0;">Operating intelligence, built for brands.</p>',
          '  </div>',
          '  <h2 style="color: #fff; margin-bottom: 16px;">Welcome to RoweOS ' + tierLabel + '</h2>',
          '  <p>Thank you for your purchase. Your access key is ready:</p>',
          '  <div style="background: #2a2a2a; border: 1px solid #a89878; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">',
          '    <code style="font-size: 24px; color: #a89878; letter-spacing: 2px;">' + accessKey + '</code>',
          '  </div>',
          '  <h3 style="color: #fff; margin-top: 24px;">How to activate:</h3>',
          '  <ol style="line-height: 1.8; color: #ccc;">',
          '    <li>Go to <a href="https://roweos.com" style="color: #a89878;">roweos.com</a></li>',
          '    <li>Sign in with this email address (<strong>' + customerEmail + '</strong>)</li>',
          '    <li>Your key will activate automatically</li>',
          '  </ol>',
          '  <p style="color: #999; font-size: 12px; margin-top: 8px;">If auto-activation doesn\'t work, go to Settings &rarr; Access Key and enter: <strong style="color: #a89878;">' + accessKey + '</strong></p>',
          '  <p style="color: #888; font-size: 13px; margin-top: 30px; border-top: 1px solid #333; padding-top: 16px;">',
          '    If you have any questions, reply to this email or contact jordan@therowecollection.com',
          '  </p>',
          '</div>'
        ].join('\n');

        await sendEmail(customerEmail, 'Your RoweOS ' + tierLabel + ' Access Key', customerHtml);
      }

      // --- Notify Jordan ---
      var notifyHtml = [
        '<div style="font-family: monospace; padding: 20px;">',
        '  <h2>New RoweOS Purchase</h2>',
        '  <table style="border-collapse: collapse;">',
        '    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Tier:</td><td>' + tier + '</td></tr>',
        '    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Email:</td><td>' + (customerEmail || 'N/A') + '</td></tr>',
        '    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Access Key:</td><td>' + accessKey + '</td></tr>',
        '    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Amount:</td><td>' + (amountTotal / 100).toFixed(2) + ' ' + currency.toUpperCase() + '</td></tr>',
        '    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Stripe Session:</td><td>' + stripeSessionId + '</td></tr>',
        '    <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Time:</td><td>' + new Date().toISOString() + '</td></tr>',
        '  </table>',
        '</div>'
      ].join('\n');

      await sendEmail('jordan@therowecollection.com', 'New RoweOS ' + tier + ' Purchase — ' + (customerEmail || 'unknown'), notifyHtml);

      return res.status(200).json({
        received: true,
        accessKey: accessKey,
        tier: tier,
        email: customerEmail
      });

    } catch (err) {
      console.error('[Stripe Webhook] Processing error:', err.message, err.stack);
      // Return 200 to prevent Stripe retries on our errors
      // The key generation succeeded; it's the Firestore/email that failed
      return res.status(200).json({
        received: true,
        error: 'Processing error: ' + err.message,
        accessKey: accessKey,
        tier: tier
      });
    }
  }

  // --- Other event types: acknowledge but don't process ---
  console.log('[Stripe Webhook] Unhandled event type:', event.type);
  return res.status(200).json({ received: true });
}
