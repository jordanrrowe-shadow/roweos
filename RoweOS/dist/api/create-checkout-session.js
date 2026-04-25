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
  var apiKeyProvider = body.apiKeyProvider || null; // 'anthropic', 'openai', 'google'
  var apiKeyAmount = parseInt(body.apiKeyAmount) || 0; // 5, 10, or 20

  // Map tier to price ID
  var priceMap = {
    solo: process.env.STRIPE_PRICE_SOLO || 'price_1TQBok0XfMh3c11xvYETa6ws',
    founder: process.env.STRIPE_PRICE_FOUNDER || 'price_1T4PJZ0XfMh3c11xM5tfa2OE',
    premium: process.env.STRIPE_PRICE_PREMIUM || 'price_1T4PKm0XfMh3c11xE7WPn3E4'
  };

  var priceId = priceMap[tier];
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid tier. Use: solo, founder, or premium' });
  }

  // v30.5: Trial periods for all tiers (card captured upfront)
  var trialDays = { founder: 14, solo: 7, premium: 14 };

  // API key one-time price IDs (same as create-api-key-checkout.js)
  var apiKeyPriceMap = {
    google: { 5: 'price_1T4SF40XfMh3c11xcycUdSNl', 10: 'price_1T4S950XfMh3c11xUV4rwuWp', 20: 'price_1T4SEq0XfMh3c11xjOPXw3qa' },
    anthropic: { 5: 'price_1T4SFS0XfMh3c11xzxo2N4KA', 10: 'price_1T4SDN0XfMh3c11xUqVxITWV', 20: 'price_1T4SEX0XfMh3c11x4SCn0BXi' },
    openai: { 5: 'price_1T4SIX0XfMh3c11xfyWdchMr', 10: 'price_1T4SJ10XfMh3c11xPJVagSax', 20: 'price_1T4SJ10XfMh3c11xY5xQ1jaQ' }
  };

  // Build line items
  var lineItems = [{ price: priceId, quantity: 1 }];
  var metadata = { tier: tier };

  // Add API key as one-time add-on if selected
  if (apiKeyProvider && apiKeyAmount && apiKeyPriceMap[apiKeyProvider] && apiKeyPriceMap[apiKeyProvider][apiKeyAmount]) {
    lineItems.push({ price: apiKeyPriceMap[apiKeyProvider][apiKeyAmount], quantity: 1 });
    metadata.api_key_provider = apiKeyProvider;
    metadata.api_key_amount = String(apiKeyAmount);
  }

  // Build Checkout Session params
  var successParams = 'subscription=success&tier=' + tier;
  if (apiKeyProvider && apiKeyAmount) {
    successParams += '&api_key_provider=' + apiKeyProvider + '&api_key_amount=' + apiKeyAmount;
  }

  // v31.0: Auto-apply the first-100 launch promo for Founder + Premium so the
  // 50% lifetime discount lands without the user having to type the code.
  // We still keep allow_promotion_codes:true so manual codes work too, and
  // because Stripe uses promotion_code IDs (not the raw code), we hardcode
  // the promotion_code IDs from the dashboard. Override via env vars if needed.
  var autoPromoId = null;
  if (tier === 'founder') {
    autoPromoId = process.env.STRIPE_PROMO_FOUNDER100 || 'promo_1TQBX70XfMh3c11x5TE0B4g7';
  } else if (tier === 'premium') {
    autoPromoId = process.env.STRIPE_PROMO_PREMIER100 || 'promo_1TQBed0XfMh3c11x4eUx6bb2';
  }

  var sessionParams = {
    mode: 'subscription',
    line_items: lineItems,
    success_url: 'https://roweos.com/?' + successParams + '&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://roweos.com/purchase',
    metadata: metadata,
    subscription_data: {
      trial_period_days: trialDays[tier] || 7,
      metadata: { tier: tier }
    },
    payment_method_collection: 'always'
  };

  if (autoPromoId) {
    // discounts is mutually exclusive with allow_promotion_codes — picking
    // auto-apply means the code is locked in for this session. If a redemption
    // limit is hit, Stripe returns a session-creation error and we fall back
    // to allow_promotion_codes so the user can still check out at full price.
    sessionParams.discounts = [{ promotion_code: autoPromoId }];
  } else {
    sessionParams.allow_promotion_codes = true;
  }

  if (email) {
    sessionParams.customer_email = email;
  }

  // Create session via Stripe API (no SDK, direct REST)
  // v31.0: If the auto-applied promo is exhausted (max_redemptions reached),
  // retry once without it so the user can still check out at full price.
  async function createSession(params) {
    var formBody = buildFormBody(params);
    var resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(stripeKey + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody
    });
    var data = await resp.json();
    return { ok: resp.ok, status: resp.status, data: data };
  }

  try {
    var result = await createSession(sessionParams);

    if (!result.ok && autoPromoId) {
      var msg = (result.data && result.data.error && result.data.error.message) || '';
      var promoExhausted = /promotion code|coupon|expired|max_redemptions|cannot be redeemed|inactive/i.test(msg);
      if (promoExhausted) {
        console.warn('[Checkout] Auto-promo failed (' + msg + '), retrying without discount.');
        delete sessionParams.discounts;
        sessionParams.allow_promotion_codes = true;
        result = await createSession(sessionParams);
      }
    }

    if (!result.ok) {
      console.error('[Checkout] Stripe API error:', result.data);
      return res.status(result.status).json({ error: result.data.error ? result.data.error.message : 'Stripe error' });
    }

    return res.status(200).json({ url: result.data.url, sessionId: result.data.id });

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
