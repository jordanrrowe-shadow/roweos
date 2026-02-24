// v20.6: Stripe Customer Portal Session Creator
// Vercel serverless function — creates a Stripe Billing Portal session for subscription management

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
    console.error('[Portal] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'Payment system not configured' });
  }

  var body = req.body || {};
  var customerId = body.customerId;

  if (!customerId) {
    return res.status(400).json({ error: 'Missing customerId' });
  }

  try {
    var formBody = 'customer=' + encodeURIComponent(customerId) +
      '&return_url=' + encodeURIComponent('https://roweos.com');

    var resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(stripeKey + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody
    });

    var data = await resp.json();

    if (!resp.ok) {
      console.error('[Portal] Stripe API error:', data);
      return res.status(resp.status).json({ error: data.error ? data.error.message : 'Stripe error' });
    }

    return res.status(200).json({ url: data.url });

  } catch (err) {
    console.error('[Portal] Error creating session:', err.message);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
}
