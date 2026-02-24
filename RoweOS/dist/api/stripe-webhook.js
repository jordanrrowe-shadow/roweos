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

// --- Compound Firestore query (multiple field conditions) ---

async function firestoreCompoundQuery(projectId, accessToken, collection, conditions, limit) {
  var url = firestoreBaseUrl(projectId) + ':runQuery';
  var filters = conditions.map(function(c) {
    return {
      fieldFilter: {
        field: { fieldPath: c.field },
        op: 'EQUAL',
        value: { stringValue: c.value }
      }
    };
  });

  var where;
  if (filters.length === 1) {
    where = filters[0];
  } else {
    where = {
      compositeFilter: {
        op: 'AND',
        filters: filters
      }
    };
  }

  var body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: where,
      limit: limit || 1
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
    throw new Error('Firestore compound query failed: ' + resp.status + ' ' + errText);
  }

  var results = await resp.json();
  if (results && results.length > 0 && results[0].document) {
    return results[0].document;
  }
  return null;
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
        from: 'RoweOS <roweos@therowecollection.com>',
        reply_to: 'jordan@therowecollection.com',
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

    // --- v20.9: Check if this is an API key purchase (not a subscription) ---
    if (session.metadata && session.metadata.type === 'api_key_purchase') {
      var apiProvider = session.metadata.provider || 'unknown';
      var creditTier = session.metadata.creditTier || '';
      console.log('[Stripe Webhook] API key purchase detected:', apiProvider, '$' + creditTier, 'for', customerEmail);

      var projectId2 = process.env.FIREBASE_PROJECT_ID;
      var serviceAccountJson2 = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!projectId2 || !serviceAccountJson2) {
        console.error('[Stripe Webhook] Firebase not configured for API key purchase');
        // Notify Jordan even if Firebase fails
        var fbErrHtml = [
          '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; background: #0a0a0a; color: #fff; padding: 0; margin: 0;">',
          '<div style="max-width: 520px; margin: 0 auto; padding: 40px 32px;">',
          '  <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #1a1a1a;">',
          '    <h1 style="color: #a89878; margin: 0; font-size: 22px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
          '    <p style="color: #e05555; margin: 6px 0 0; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;">Firebase Not Configured</p>',
          '  </div>',
          '  <p style="color: #ccc; font-size: 14px;">Customer <strong style="color: #fff;">' + (customerEmail || 'unknown') + '</strong> purchased a <strong style="color: #a89878;">' + apiProvider + '</strong> API key but Firebase is not configured. Assign manually.</p>',
          '</div>',
          '</div>'
        ].join('\n');
        await sendEmail('jordan@therowecollection.com', 'API Key Purchase - Firebase Not Configured - ' + (customerEmail || 'unknown'), fbErrHtml);
        return res.status(200).json({ received: true, warning: 'Firebase not configured' });
      }

      var sa2;
      try { sa2 = JSON.parse(serviceAccountJson2); } catch(e) {
        return res.status(200).json({ received: true, warning: 'Invalid service account' });
      }

      try {
        var at2 = await getGoogleAccessToken(sa2);

        // Find an available key from the pool matching provider + credit tier
        var poolConditions = [
          { field: 'provider', value: apiProvider },
          { field: 'status', value: 'available' }
        ];
        if (creditTier) {
          poolConditions.push({ field: 'creditTier', value: creditTier });
        }
        var poolDoc = await firestoreCompoundQuery(projectId2, at2, 'api_key_pool', poolConditions, 1);

        if (poolDoc) {
          // Extract the document path and data
          var poolDocPath = poolDoc.name;
          var poolFields = poolDoc.fields || {};
          var assignedApiKey = poolFields.apiKey ? poolFields.apiKey.stringValue : '';
          var creditAmount = poolFields.creditAmount ? (poolFields.creditAmount.integerValue || poolFields.creditAmount.doubleValue || '0') : '0';

          // Mark as assigned
          await firestoreUpdate(projectId2, at2, poolDocPath, {
            status: 'assigned',
            assignedToEmail: customerEmail || '',
            assignedAt: new Date().toISOString(),
            stripeSessionId: session.id || ''
          });
          console.log('[Stripe Webhook] Pool key assigned to', customerEmail);

          // Try to write purchased key to user doc
          if (customerEmail) {
            try {
              var userDoc2 = await firestoreQuery(projectId2, at2, 'roweos_users', 'email', customerEmail);
              if (userDoc2) {
                var purchaseField = {};
                purchaseField['purchasedApiKey_' + apiProvider] = assignedApiKey;
                purchaseField['purchasedApiKey_' + apiProvider + '_credit'] = String(creditAmount);
                purchaseField['purchasedApiKey_' + apiProvider + '_at'] = new Date().toISOString();
                await firestoreUpdate(projectId2, at2, userDoc2.name, purchaseField);
                console.log('[Stripe Webhook] Wrote purchased key to user doc for', customerEmail);
              }
            } catch(linkErr2) {
              console.error('[Stripe Webhook] Failed to write purchased key to user doc:', linkErr2.message);
            }
          }

          // Check if this customer also has an access key (from a subscription purchase)
          var existingAccessKey = '';
          var existingTier = '';
          if (customerEmail) {
            try {
              var akDoc = await firestoreQuery(projectId2, at2, 'access_keys', 'email', customerEmail);
              if (akDoc && akDoc.fields) {
                existingAccessKey = akDoc.fields.key ? akDoc.fields.key.stringValue : '';
                existingTier = akDoc.fields.tier ? akDoc.fields.tier.stringValue : '';
              }
            } catch(akErr) {
              console.log('[Stripe Webhook] Could not check for existing access key:', akErr.message);
            }
          }

          // Email customer with their API key (and access key if they have one)
          if (customerEmail) {
            var providerLabel = { anthropic: 'Anthropic (Claude)', openai: 'OpenAI (GPT)', google: 'Google (Gemini)' }[apiProvider] || apiProvider;

            var apiKeyHtml = [
              '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0;">',
              '  <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); padding: 48px 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">',
              '    <h1 style="color: #a89878; margin: 0; font-size: 32px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
              '    <p style="color: #666; margin: 8px 0 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">Operating intelligence, built for brands &amp; life</p>',
              '  </div>',
              '  <div style="padding: 36px 40px 40px; background: #111;">',
            ].join('\n');

            // If they also have an access key, show it first
            if (existingAccessKey) {
              var tierLabel2 = existingTier ? existingTier.charAt(0).toUpperCase() + existingTier.slice(1) : '';
              apiKeyHtml += [
                '    <h2 style="color: #fff; margin: 0 0 8px; font-size: 22px; font-weight: 500;">Welcome to RoweOS' + (tierLabel2 ? ' ' + tierLabel2 : '') + '</h2>',
                '    <p style="color: #999; margin: 0 0 24px; font-size: 14px;">Your account is ready. Here\u2019s everything you need to get started.</p>',
                '    <div style="margin-bottom: 28px;">',
                '      <p style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Your Access Key</p>',
                '      <div style="background: #1a1a1a; border: 1px solid #a8987844; border-radius: 8px; padding: 18px; text-align: center;">',
                '        <code style="font-size: 22px; color: #a89878; letter-spacing: 3px; font-weight: 600;">' + existingAccessKey + '</code>',
                '      </div>',
                '    </div>',
              ].join('\n');
            } else {
              apiKeyHtml += [
                '    <h2 style="color: #fff; margin: 0 0 8px; font-size: 22px; font-weight: 500;">Your API Key is Ready</h2>',
                '    <p style="color: #999; margin: 0 0 24px; font-size: 14px;">Your ' + providerLabel + ' key has been loaded with credit and is ready to use.</p>',
              ].join('\n');
            }

            apiKeyHtml += [
              '    <div style="margin-bottom: 28px;">',
              '      <p style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">' + providerLabel + ' API Key &mdash; $' + creditAmount + ' Credit</p>',
              '      <div style="background: #1a1a1a; border: 1px solid #a8987844; border-radius: 8px; padding: 18px; text-align: center;">',
              '        <code style="font-size: 14px; color: #a89878; letter-spacing: 0.5px; word-break: break-all;">' + assignedApiKey + '</code>',
              '      </div>',
              '    </div>',
              '    <div style="background: #1a1a1a; border-radius: 8px; padding: 20px; margin-bottom: 28px;">',
              '      <p style="color: #fff; font-size: 14px; font-weight: 500; margin: 0 0 12px;">Getting Started</p>',
              '      <ol style="line-height: 2; color: #ccc; margin: 0; padding-left: 20px; font-size: 13px;">',
              '        <li>Go to <a href="https://roweos.com" style="color: #a89878; text-decoration: none;">roweos.com</a></li>',
              '        <li>Sign in with <strong style="color: #fff;">' + customerEmail + '</strong></li>',
              '        <li>Your keys will activate automatically</li>',
              '      </ol>',
              '    </div>',
              '    <p style="color: #555; font-size: 12px; margin: 28px 0 0; padding-top: 20px; border-top: 1px solid #222;">',
              '      Questions? Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color: #a89878; text-decoration: none;">jordan@therowecollection.com</a>',
              '    </p>',
              '  </div>',
              '</div>'
            ].join('\n');

            var emailSubject = existingAccessKey
              ? 'Welcome to RoweOS  - Your Access Key & ' + providerLabel + ' API Key'
              : 'Your ' + providerLabel + ' API Key  - RoweOS';
            await sendEmail(customerEmail, emailSubject, apiKeyHtml);
          }

          // Notify Jordan
          var providerColors2 = { anthropic: '#d4a574', openai: '#10a37f', google: '#4285f4' };
          var pColor2 = providerColors2[apiProvider] || '#a89878';
          var providerCompany = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google' };
          var providerModel = { anthropic: 'Claude', openai: 'ChatGPT', google: 'Gemini' };
          var notifyHtml2 = [
            '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; background: #0a0a0a; color: #fff; padding: 0; margin: 0;">',
            '<div style="max-width: 520px; margin: 0 auto; padding: 40px 32px;">',
            '  <div style="margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid #1a1a1a;">',
            '    <h1 style="color: #a89878; margin: 0; font-size: 22px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
            '    <p style="color: #a89878; margin: 6px 0 0; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.6;">API Key Sold</p>',
            '  </div>',
            '  <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px;">',
            '    <div style="width: 48px; height: 48px; border-radius: 12px; background: ' + pColor2 + '18; border: 1px solid ' + pColor2 + '33; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: ' + pColor2 + ';">$' + creditAmount + '</div>',
            '    <div>',
            '      <div style="font-size: 16px; font-weight: 600; color: #fff;">' + (providerCompany[apiProvider] || apiProvider) + '</div>',
            '      <div style="font-size: 13px; color: ' + pColor2 + ';">' + (providerModel[apiProvider] || '') + '</div>',
            '    </div>',
            '  </div>',
            '  <table style="width: 100%; border-collapse: collapse;">',
            '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878; border-bottom: 1px solid #1a1a1a;">Customer</td><td style="padding: 12px 0; font-size: 14px; color: #fff; text-align: right; border-bottom: 1px solid #1a1a1a;">' + (customerEmail || 'N/A') + '</td></tr>',
            '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878; border-bottom: 1px solid #1a1a1a;">Key (masked)</td><td style="padding: 12px 0; font-size: 13px; color: ' + pColor2 + '; text-align: right; font-family: monospace; border-bottom: 1px solid #1a1a1a;">' + (assignedApiKey ? assignedApiKey.substring(0, 10) + '...' : 'N/A') + '</td></tr>',
            '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878;">Credit</td><td style="padding: 12px 0; font-size: 14px; color: #fff; text-align: right; font-weight: 600;">$' + creditAmount + '</td></tr>',
            '  </table>',
            '</div>',
            '</div>'
          ].join('\n');
          await sendEmail('jordan@therowecollection.com', 'API Key Sold  - ' + (providerCompany[apiProvider] || apiProvider) + ' $' + creditAmount + ' to ' + (customerEmail || 'unknown'), notifyHtml2);

          return res.status(200).json({ received: true, type: 'api_key_purchase', provider: apiProvider, assigned: true });

        } else {
          // No keys available in pool! Notify Jordan for manual handling
          console.error('[Stripe Webhook] No available ' + apiProvider + ' keys in pool!');
          var providerCompanyOos = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google' };
          var providerModelOos = { anthropic: 'Claude', openai: 'ChatGPT', google: 'Gemini' };
          var providerColorsOos = { anthropic: '#d4a574', openai: '#10a37f', google: '#4285f4' };
          var pColorOos = providerColorsOos[apiProvider] || '#a89878';
          var outOfStockHtml = [
            '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; background: #0a0a0a; color: #fff; padding: 0; margin: 0;">',
            '<div style="max-width: 520px; margin: 0 auto; padding: 40px 32px;">',
            '  <div style="margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid #1a1a1a;">',
            '    <h1 style="color: #a89878; margin: 0; font-size: 22px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
            '    <p style="color: #e05555; margin: 6px 0 0; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;">Pool Empty - Action Needed</p>',
            '  </div>',
            '  <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px;">',
            '    <div style="width: 48px; height: 48px; border-radius: 12px; background: ' + pColorOos + '18; border: 1px solid ' + pColorOos + '33; display: flex; align-items: center; justify-content: center;">',
            '      <span style="font-size: 20px; font-weight: 700; color: ' + pColorOos + ';">!</span>',
            '    </div>',
            '    <div>',
            '      <div style="font-size: 16px; font-weight: 600; color: #fff;">' + (providerCompanyOos[apiProvider] || apiProvider) + '</div>',
            '      <div style="font-size: 13px; color: ' + pColorOos + ';">' + (providerModelOos[apiProvider] || '') + ' - No keys available</div>',
            '    </div>',
            '  </div>',
            '  <table style="width: 100%; border-collapse: collapse;">',
            '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878; border-bottom: 1px solid #1a1a1a;">Customer</td><td style="padding: 12px 0; font-size: 14px; color: #fff; text-align: right; border-bottom: 1px solid #1a1a1a;">' + (customerEmail || 'N/A') + '</td></tr>',
            '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878; border-bottom: 1px solid #1a1a1a;">Provider</td><td style="padding: 12px 0; font-size: 14px; color: ' + pColorOos + '; text-align: right; border-bottom: 1px solid #1a1a1a;">' + (providerCompanyOos[apiProvider] || apiProvider) + '</td></tr>',
            '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878;">Credit Tier</td><td style="padding: 12px 0; font-size: 14px; color: #fff; text-align: right; font-weight: 600;">' + (creditTier ? '$' + creditTier : 'N/A') + '</td></tr>',
            '  </table>',
            '  <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-top: 24px;">',
            '    <p style="color: #ccc; font-size: 13px; margin: 0;">Add a <strong style="color: ' + pColorOos + ';">' + (providerCompanyOos[apiProvider] || apiProvider) + '</strong> key to the pool in RoweOS Admin and send it to the customer manually.</p>',
            '  </div>',
            '</div>',
            '</div>'
          ].join('\n');
          await sendEmail('jordan@therowecollection.com', 'API Key Pool Empty - ' + (providerCompanyOos[apiProvider] || apiProvider) + ' - ' + (customerEmail || 'unknown'), outOfStockHtml);

          // Still email customer to let them know it's being processed
          if (customerEmail) {
            var providerLabelOos = { anthropic: 'Anthropic (Claude)', openai: 'OpenAI (ChatGPT)', google: 'Google (Gemini)' }[apiProvider] || apiProvider;
            var customerOosHtml = [
              '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0;">',
              '  <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); padding: 48px 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">',
              '    <h1 style="color: #a89878; margin: 0; font-size: 32px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
              '    <p style="color: #666; margin: 8px 0 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">Operating intelligence, built for brands &amp; life</p>',
              '  </div>',
              '  <div style="padding: 36px 40px 40px; background: #111;">',
              '    <h2 style="color: #fff; margin: 0 0 8px; font-size: 22px; font-weight: 500;">Your API Key is Being Prepared</h2>',
              '    <p style="color: #999; margin: 0 0 24px; font-size: 14px;">Thank you for your purchase. Your ' + providerLabelOos + ' API key is being personally configured and will be delivered to this email shortly.</p>',
              '    <div style="background: #1a1a1a; border: 1px solid #a8987844; border-radius: 8px; padding: 24px; margin-bottom: 28px; text-align: center;">',
              '      <p style="color: #a89878; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">What happens next</p>',
              '      <ol style="line-height: 2.2; color: #ccc; margin: 0; padding-left: 20px; font-size: 13px; text-align: left;">',
              '        <li>Your ' + providerLabelOos + ' key is being set up with your purchased credit</li>',
              '        <li>You will receive a follow-up email with your key within 24 hours</li>',
              '        <li>Once received, sign in at <a href="https://roweos.com" style="color: #a89878; text-decoration: none;">roweos.com</a> and your key will activate automatically</li>',
              '      </ol>',
              '    </div>',
              '    <p style="color: #555; font-size: 12px; margin: 28px 0 0; padding-top: 20px; border-top: 1px solid #222;">',
              '      Questions? Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color: #a89878; text-decoration: none;">jordan@therowecollection.com</a>',
              '    </p>',
              '  </div>',
              '</div>'
            ].join('\n');
            await sendEmail(customerEmail, 'Your ' + providerLabelOos + ' API Key - RoweOS', customerOosHtml);
          }

          return res.status(200).json({ received: true, type: 'api_key_purchase', provider: apiProvider, assigned: false, reason: 'pool_empty' });
        }
      } catch (apiKeyErr) {
        console.error('[Stripe Webhook] API key purchase error:', apiKeyErr.message, apiKeyErr.stack);
        await sendEmail('jordan@therowecollection.com', 'API Key Purchase ERROR', '<p>Error processing API key purchase for ' + (customerEmail || 'unknown') + ': ' + apiKeyErr.message + '</p>');
        return res.status(200).json({ received: true, error: apiKeyErr.message });
      }
    }

    // --- Normal subscription purchase flow ---
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

      // --- Check if subscription checkout included an API key add-on ---
      if (session.metadata && session.metadata.api_key_provider && customerEmail) {
        var addonProvider = session.metadata.api_key_provider;
        var addonAmount = session.metadata.api_key_amount || '';
        console.log('[Stripe Webhook] Subscription includes API key add-on:', addonProvider, '$' + addonAmount);

        try {
          var addonConditions = [
            { field: 'provider', value: addonProvider },
            { field: 'status', value: 'available' }
          ];
          if (addonAmount) {
            addonConditions.push({ field: 'creditTier', value: addonAmount });
          }
          var addonDoc = await firestoreCompoundQuery(projectId, accessToken, 'api_key_pool', addonConditions, 1);

          if (addonDoc) {
            var addonPath = addonDoc.name;
            var addonFields = addonDoc.fields || {};
            var addonApiKey = addonFields.apiKey ? addonFields.apiKey.stringValue : '';

            await firestoreUpdate(projectId, accessToken, addonPath, {
              status: 'assigned',
              assignedToEmail: customerEmail,
              assignedAt: new Date().toISOString(),
              stripeSessionId: session.id || ''
            });
            console.log('[Stripe Webhook] Add-on API key assigned to', customerEmail);

            // Write to user doc if exists
            if (userDoc) {
              try {
                var addonField = {};
                addonField['purchasedApiKey_' + addonProvider] = addonApiKey;
                addonField['purchasedApiKey_' + addonProvider + '_credit'] = addonAmount;
                addonField['purchasedApiKey_' + addonProvider + '_at'] = new Date().toISOString();
                await firestoreUpdate(projectId, accessToken, userDoc.name, addonField);
              } catch(af) {
                console.error('[Stripe Webhook] Failed to write add-on key to user doc:', af.message);
              }
            }
          } else {
            console.error('[Stripe Webhook] No available ' + addonProvider + ' $' + addonAmount + ' keys for add-on!');
            var addonProviderCompany = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google' };
            var addonProviderModel = { anthropic: 'Claude', openai: 'ChatGPT', google: 'Gemini' };
            var addonProviderColors = { anthropic: '#d4a574', openai: '#10a37f', google: '#4285f4' };
            var addonPColor = addonProviderColors[addonProvider] || '#a89878';
            var addonOosHtml = [
              '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; background: #0a0a0a; color: #fff; padding: 0; margin: 0;">',
              '<div style="max-width: 520px; margin: 0 auto; padding: 40px 32px;">',
              '  <div style="margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid #1a1a1a;">',
              '    <h1 style="color: #a89878; margin: 0; font-size: 22px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
              '    <p style="color: #e05555; margin: 6px 0 0; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;">Add-On Pool Empty - Action Needed</p>',
              '  </div>',
              '  <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px;">',
              '    <div style="width: 48px; height: 48px; border-radius: 12px; background: ' + addonPColor + '18; border: 1px solid ' + addonPColor + '33; display: flex; align-items: center; justify-content: center;">',
              '      <span style="font-size: 20px; font-weight: 700; color: ' + addonPColor + ';">!</span>',
              '    </div>',
              '    <div>',
              '      <div style="font-size: 16px; font-weight: 600; color: #fff;">' + (addonProviderCompany[addonProvider] || addonProvider) + '</div>',
              '      <div style="font-size: 13px; color: ' + addonPColor + ';">' + (addonProviderModel[addonProvider] || '') + ' - No keys available</div>',
              '    </div>',
              '  </div>',
              '  <table style="width: 100%; border-collapse: collapse;">',
              '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878; border-bottom: 1px solid #1a1a1a;">Customer</td><td style="padding: 12px 0; font-size: 14px; color: #fff; text-align: right; border-bottom: 1px solid #1a1a1a;">' + (customerEmail || 'N/A') + '</td></tr>',
              '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878; border-bottom: 1px solid #1a1a1a;">Context</td><td style="padding: 12px 0; font-size: 14px; color: #fff; text-align: right; border-bottom: 1px solid #1a1a1a;">Subscription add-on (' + tier + ' plan)</td></tr>',
              '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878;">Credit Tier</td><td style="padding: 12px 0; font-size: 14px; color: #fff; text-align: right; font-weight: 600;">$' + (addonAmount || 'N/A') + '</td></tr>',
              '  </table>',
              '  <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-top: 24px;">',
              '    <p style="color: #ccc; font-size: 13px; margin: 0;">This customer purchased a subscription with a <strong style="color: ' + addonPColor + ';">' + (addonProviderCompany[addonProvider] || addonProvider) + '</strong> add-on. Their subscription key was sent but the API key is pending. Add a key to the pool and send manually.</p>',
              '  </div>',
              '</div>',
              '</div>'
            ].join('\n');
            await sendEmail('jordan@therowecollection.com', 'API Key Add-On Pool Empty - ' + (addonProviderCompany[addonProvider] || addonProvider) + ' - ' + (customerEmail || 'unknown'), addonOosHtml);
          }
        } catch(addonErr) {
          console.error('[Stripe Webhook] Add-on API key error:', addonErr.message);
          var addonErrHtml = [
            '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; background: #0a0a0a; color: #fff; padding: 0; margin: 0;">',
            '<div style="max-width: 520px; margin: 0 auto; padding: 40px 32px;">',
            '  <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #1a1a1a;">',
            '    <h1 style="color: #a89878; margin: 0; font-size: 22px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
            '    <p style="color: #e05555; margin: 6px 0 0; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;">Add-On Assignment Error</p>',
            '  </div>',
            '  <p style="color: #ccc; font-size: 14px;">Error assigning add-on API key for <strong style="color: #fff;">' + (customerEmail || 'unknown') + '</strong>:</p>',
            '  <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-top: 16px;">',
            '    <code style="color: #e05555; font-size: 12px; word-break: break-all;">' + addonErr.message + '</code>',
            '  </div>',
            '</div>',
            '</div>'
          ].join('\n');
          await sendEmail('jordan@therowecollection.com', 'API Key Add-On Error - ' + (customerEmail || 'unknown'), addonErrHtml);
        }
      }

      // --- Check if this customer also purchased an API key (separate checkout) ---
      var purchasedApiKeys = [];
      if (customerEmail) {
        try {
          var poolUrl = firestoreBaseUrl(projectId) + ':runQuery';
          var poolQuery = {
            structuredQuery: {
              from: [{ collectionId: 'api_key_pool' }],
              where: {
                compositeFilter: {
                  op: 'AND',
                  filters: [
                    { fieldFilter: { field: { fieldPath: 'assignedToEmail' }, op: 'EQUAL', value: { stringValue: customerEmail } } },
                    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'assigned' } } }
                  ]
                }
              },
              limit: 5
            }
          };
          var poolResp = await fetch(poolUrl, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(poolQuery)
          });
          if (poolResp.ok) {
            var poolResults = await poolResp.json();
            if (poolResults) {
              poolResults.forEach(function(r) {
                if (r.document && r.document.fields) {
                  var f = r.document.fields;
                  purchasedApiKeys.push({
                    provider: f.provider ? f.provider.stringValue : '',
                    apiKey: f.apiKey ? f.apiKey.stringValue : '',
                    creditAmount: f.creditTier ? f.creditTier.stringValue : (f.creditAmount ? (f.creditAmount.integerValue || '0') : '0')
                  });
                }
              });
            }
          }
        } catch(poolErr) {
          console.log('[Stripe Webhook] Could not check for purchased API keys:', poolErr.message);
        }
      }

      // --- Send confirmation email to customer ---
      if (customerEmail) {
        var tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
        var providerLabels = { anthropic: 'Anthropic (Claude)', openai: 'OpenAI (ChatGPT)', google: 'Google (Gemini)' };

        var customerHtml = [
          '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0;">',
          '  <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); padding: 48px 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">',
          '    <h1 style="color: #a89878; margin: 0; font-size: 32px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
          '    <p style="color: #666; margin: 8px 0 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">Operating intelligence, built for brands &amp; life</p>',
          '  </div>',
          '  <div style="padding: 36px 40px 40px; background: #111;">',
          '    <h2 style="color: #fff; margin: 0 0 8px; font-size: 22px; font-weight: 500;">Welcome to RoweOS ' + tierLabel + '</h2>',
          '    <p style="color: #999; margin: 0 0 24px; font-size: 14px;">Your account is ready. Here\u2019s everything you need to get started.</p>',
          '    <div style="margin-bottom: 28px;">',
          '      <p style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Your Access Key</p>',
          '      <div style="background: #1a1a1a; border: 1px solid #a8987844; border-radius: 8px; padding: 18px; text-align: center;">',
          '        <code style="font-size: 22px; color: #a89878; letter-spacing: 3px; font-weight: 600;">' + accessKey + '</code>',
          '      </div>',
          '    </div>',
        ].join('\n');

        // Include any purchased API keys
        if (purchasedApiKeys.length > 0) {
          purchasedApiKeys.forEach(function(pk) {
            var pLabel = providerLabels[pk.provider] || pk.provider;
            customerHtml += [
              '    <div style="margin-bottom: 28px;">',
              '      <p style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">' + pLabel + ' API Key &mdash; $' + pk.creditAmount + ' Credit</p>',
              '      <div style="background: #1a1a1a; border: 1px solid #a8987844; border-radius: 8px; padding: 18px; text-align: center;">',
              '        <code style="font-size: 14px; color: #a89878; letter-spacing: 0.5px; word-break: break-all;">' + pk.apiKey + '</code>',
              '      </div>',
              '    </div>',
            ].join('\n');
          });
        }

        customerHtml += [
          '    <div style="background: #1a1a1a; border-radius: 8px; padding: 20px; margin-bottom: 28px;">',
          '      <p style="color: #fff; font-size: 14px; font-weight: 500; margin: 0 0 12px;">Getting Started</p>',
          '      <ol style="line-height: 2; color: #ccc; margin: 0; padding-left: 20px; font-size: 13px;">',
          '        <li>Go to <a href="https://roweos.com" style="color: #a89878; text-decoration: none;">roweos.com</a></li>',
          '        <li>Sign in with <strong style="color: #fff;">' + customerEmail + '</strong></li>',
          '        <li>Your ' + (purchasedApiKeys.length > 0 ? 'keys will activate' : 'key will activate') + ' automatically</li>',
          '      </ol>',
          '    </div>',
          '    <p style="color: #666; font-size: 11px; margin: 0 0 8px;">If auto-activation doesn\u2019t work, go to Settings \u2192 Access Key and enter: <strong style="color: #a89878;">' + accessKey + '</strong></p>',
          '    <p style="color: #555; font-size: 12px; margin: 28px 0 0; padding-top: 20px; border-top: 1px solid #222;">',
          '      Questions? Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color: #a89878; text-decoration: none;">jordan@therowecollection.com</a>',
          '    </p>',
          '  </div>',
          '</div>'
        ].join('\n');

        var subjectLine = purchasedApiKeys.length > 0
          ? 'Welcome to RoweOS ' + tierLabel + '  - Your Keys Are Ready'
          : 'Welcome to RoweOS ' + tierLabel + '  - Your Access Key';
        await sendEmail(customerEmail, subjectLine, customerHtml);
      }

      // --- Notify Jordan ---
      var tierLabel2 = tier.charAt(0).toUpperCase() + tier.slice(1);
      var notifyHtml = [
        '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; background: #0a0a0a; color: #fff; padding: 0; margin: 0;">',
        '<div style="max-width: 520px; margin: 0 auto; padding: 40px 32px;">',
        '  <div style="margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid #1a1a1a;">',
        '    <h1 style="color: #a89878; margin: 0; font-size: 22px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
        '    <p style="color: #a89878; margin: 6px 0 0; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.6;">New Purchase</p>',
        '  </div>',
        '  <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px;">',
        '    <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #a89878, #c4a882); display: flex; align-items: center; justify-content: center;">',
        '      <span style="font-family: Georgia, \'Times New Roman\', serif; font-size: 24px; font-weight: 400; font-style: italic; color: #0a0a0a;">' + tierLabel2.charAt(0) + '</span>',
        '    </div>',
        '    <div>',
        '      <div style="font-size: 18px; font-weight: 600; color: #fff;">' + tierLabel2 + ' Plan</div>',
        '      <div style="font-size: 12px; color: #a89878;">' + (amountTotal > 0 ? '$' + (amountTotal / 100).toFixed(2) + ' ' + currency.toUpperCase() : 'Beta (free)') + '</div>',
        '    </div>',
        '  </div>',
        '  <table style="width: 100%; border-collapse: collapse;">',
        '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878; border-bottom: 1px solid #1a1a1a;">Email</td><td style="padding: 12px 0; font-size: 14px; color: #fff; text-align: right; border-bottom: 1px solid #1a1a1a;">' + (customerEmail || 'N/A') + '</td></tr>',
        '    <tr><td style="padding: 12px 0; font-size: 12px; color: #a89878;">Access Key</td><td style="padding: 12px 0; font-size: 15px; color: #a89878; text-align: right; font-family: monospace; letter-spacing: 2px; font-weight: 600;">' + accessKey + '</td></tr>',
        '  </table>',
        '</div>',
        '</div>'
      ].join('\n');

      await sendEmail('jordan@therowecollection.com', 'New ' + tierLabel2 + ' Purchase  - ' + (customerEmail || 'unknown'), notifyHtml);

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
