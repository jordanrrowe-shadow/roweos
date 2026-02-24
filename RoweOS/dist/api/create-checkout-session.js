// v20.6: Stripe Checkout Session Creator
// Vercel serverless function — creates a Stripe Checkout Session for subscription billing

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
    console.error('[Checkout] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'Payment system not configured' });
  }

  // Parse request body
  var body = req.body || {};
  var tier = body.tier; // 'solo', 'founder', or 'premium'
  var email = body.email || null;

  // Map tier to price ID
  var priceMap = {
    solo: process.env.STRIPE_PRICE_SOLO || 'price_1T4PCn0XfMh3c11xArbx8gt8',
    founder: process.env.STRIPE_PRICE_FOUNDER || 'price_1T4PJZ0XfMh3c11xM5tfa2OE',
    premium: process.env.STRIPE_PRICE_PREMIUM || 'price_1T4PKm0XfMh3c11xE7WPn3E4'
  };

  var priceId = priceMap[tier];
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid tier. Use: solo, founder, or premium' });
  }

  // Build Checkout Session params
  var sessionParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: 'https://roweos.com/?subscription=success&tier=' + tier + '&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://roweos.com/info#pricing',
    metadata: { tier: tier },
    subscription_data: { metadata: { tier: tier } },
    allow_promotion_codes: true
  };

  if (email) {
    sessionParams.customer_email = email;
  }

  // Create session via Stripe API (no SDK, direct REST)
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
      console.error('[Checkout] Stripe API error:', data);
      return res.status(resp.status).json({ error: data.error ? data.error.message : 'Stripe error' });
    }

    // Return the checkout URL for redirect
    return res.status(200).json({ url: data.url, sessionId: data.id });

  } catch (err) {
    console.error('[Checkout] Error creating session:', err.message);
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
