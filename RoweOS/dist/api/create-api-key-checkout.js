// v20.9: API Key Checkout Session Creator
// Vercel serverless function — creates a one-time Stripe Checkout for purchasing a pre-loaded API key

export default async function handler(req, res) {
  // CORS headers
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com' || origin === 'https://roweoswebsite.vercel.app') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('[API Key Checkout] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'Payment system not configured' });
  }

  var body = req.body || {};
  var provider = body.provider; // 'anthropic', 'openai', 'google'
  var email = body.email || null;

  // Map provider to Stripe price ID (set these in Vercel env vars)
  var priceMap = {
    anthropic: process.env.STRIPE_PRICE_APIKEY_ANTHROPIC,
    openai: process.env.STRIPE_PRICE_APIKEY_OPENAI,
    google: process.env.STRIPE_PRICE_APIKEY_GOOGLE
  };

  var priceId = priceMap[provider];
  if (!priceId) {
    return res.status(400).json({ error: 'API key pricing not configured for: ' + (provider || 'unknown') });
  }

  // One-time payment, not subscription
  var sessionParams = {
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: 'https://roweos.com/?api_key_purchase=success&provider=' + provider + '&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://roweos.com/',
    metadata: { type: 'api_key_purchase', provider: provider },
    allow_promotion_codes: true
  };

  if (email) {
    sessionParams.customer_email = email;
  }

  try {
    var formBody = buildFormBody(sessionParams);

    var resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(stripeKey + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody
    });

    var data = await resp.json();

    if (!resp.ok) {
      console.error('[API Key Checkout] Stripe error:', data);
      return res.status(resp.status).json({ error: data.error ? data.error.message : 'Stripe error' });
    }

    return res.status(200).json({ url: data.url, sessionId: data.id });

  } catch (err) {
    console.error('[API Key Checkout] Error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

// Build x-www-form-urlencoded body for Stripe API (handles nested objects)
function buildFormBody(params) {
  var parts = [];

  function encode(prefix, value) {
    if (value === null || value === undefined) return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (var key in value) {
        encode(prefix + '[' + key + ']', value[key]);
      }
    } else if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        if (typeof value[i] === 'object') {
          for (var k in value[i]) {
            encode(prefix + '[' + i + '][' + k + ']', value[i][k]);
          }
        } else {
          encode(prefix + '[' + i + ']', value[i]);
        }
      }
    } else {
      parts.push(encodeURIComponent(prefix) + '=' + encodeURIComponent(value));
    }
  }

  for (var key in params) {
    encode(key, params[key]);
  }

  return parts.join('&');
}
