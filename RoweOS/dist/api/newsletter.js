// v20.17: Newsletter signup API — stores subscribers in Firestore
// POST { email, name?, source? } → Firestore newsletter_subscribers collection

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

function buildWelcomeEmail(greeting) {
  var gold = '#c4a882';
  var goldLight = '#f2dfc5';
  var bg = '#0a0a0a';
  var cardBg = '#141414';
  var borderColor = '#1e1e1e';
  var textColor = '#e8e4df';
  var dimText = '#8a857f';

  return '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
    + '<title>Welcome to RoweOS</title></head>'
    + '<body style="margin:0;padding:0;background-color:' + bg + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + bg + ';">'
    + '<tr><td align="center" style="padding:40px 16px 0;">'

    // Container
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">'

    // Logo
    + '<tr><td align="center" style="padding:24px 0 48px;">'
    + '<span style="font-family:Georgia,\'Times New Roman\',serif;font-size:26px;font-weight:normal;letter-spacing:3px;color:' + gold + ';">ROWEOS</span>'
    + '</td></tr>'

    // Hero
    + '<tr><td style="padding:0 0 40px;text-align:center;">'
    + '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:32px;font-weight:normal;color:' + textColor + ';line-height:1.3;">' + greeting + '</h1>'
    + '<p style="margin:0;font-size:16px;line-height:1.7;color:' + dimText + ';max-width:440px;display:inline-block;">You\'re now on the list for early access to RoweOS &mdash; a private AI platform for managing your brands and your life from a single, elegant interface.</p>'
    + '</td></tr>'

    // Divider
    + '<tr><td style="padding:0 0 40px;"><div style="height:1px;background:linear-gradient(to right,' + bg + ',' + borderColor + ',' + bg + ');"></div></td></tr>'

    // What is RoweOS
    + '<tr><td style="padding:0 0 32px;">'
    + '<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + gold + ';">What is RoweOS</p>'
    + '<h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:normal;color:' + textColor + ';">Operating Intelligence, Built for Brands</h2>'
    + '<p style="margin:0;font-size:15px;line-height:1.7;color:' + dimText + ';">RoweOS is not a chatbot. It\'s a unified intelligence platform that thinks in terms of brands, coaches, workflows, and outcomes. Every AI agent embodies your brand\'s identity, voice, and strategy &mdash; responding as an on-brand concierge that deeply understands who you are.</p>'
    + '</td></tr>'

    // Two Mode Cards
    + '<tr><td style="padding:0 0 32px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'

    // BrandAI Card
    + '<td width="48%" valign="top" style="padding-right:8px;">'
    + '<div style="background:' + cardBg + ';border:1px solid ' + borderColor + ';border-radius:12px;padding:24px 20px;">'
    + '<div style="width:36px;height:36px;border-radius:8px;background:' + gold + ';color:' + bg + ';font-family:Georgia,serif;font-size:18px;line-height:36px;text-align:center;margin-bottom:16px;">B</div>'
    + '<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:' + textColor + ';">BrandAI Mode</p>'
    + '<p style="margin:0;font-size:13px;line-height:1.6;color:' + dimText + ';">4 specialized agents &mdash; Strategy, Marketing, Operations, Documents &mdash; working in concert across your entire brand portfolio.</p>'
    + '</div></td>'

    // LifeAI Card
    + '<td width="48%" valign="top" style="padding-left:8px;">'
    + '<div style="background:' + cardBg + ';border:1px solid ' + borderColor + ';border-radius:12px;padding:24px 20px;">'
    + '<div style="width:36px;height:36px;border-radius:8px;background:' + gold + ';color:' + bg + ';font-family:Georgia,serif;font-size:18px;line-height:36px;text-align:center;margin-bottom:16px;">L</div>'
    + '<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:' + textColor + ';">LifeAI Mode</p>'
    + '<p style="margin:0;font-size:13px;line-height:1.6;color:' + dimText + ';">Coach archetypes for wellness, goals, finances, and daily ops. Your personal AI that learns your preferences and adapts over time.</p>'
    + '</div></td>'

    + '</tr></table></td></tr>'

    // Divider
    + '<tr><td style="padding:0 0 32px;"><div style="height:1px;background:linear-gradient(to right,' + bg + ',' + borderColor + ',' + bg + ');"></div></td></tr>'

    // Key Features
    + '<tr><td style="padding:0 0 32px;">'
    + '<p style="margin:0 0 20px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + gold + ';">Platform Highlights</p>'

    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    + buildFeatureRow('150+ Operations', 'Pre-built brand-specific templates for every vertical, from client intake to content strategy.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Multi-Brand Portfolio', 'Run five businesses from one interface. Each brand gets its own identity, voice, agents, and memory.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Automated Workflows', 'Schedule AI-powered automations &mdash; content generation, social posting, reports &mdash; that run on your timeline.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Social Publishing', 'Generate and publish to X, Threads, and Instagram directly from your brand\'s voice.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Your Data, Your Keys', 'API keys never leave your device. Optional cloud sync with full data sovereignty.', gold, textColor, dimText, borderColor)
    + '</table>'
    + '</td></tr>'

    // Divider
    + '<tr><td style="padding:0 0 32px;"><div style="height:1px;background:linear-gradient(to right,' + bg + ',' + borderColor + ',' + bg + ');"></div></td></tr>'

    // CTA
    + '<tr><td align="center" style="padding:0 0 40px;">'
    + '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:' + dimText + ';">We\'ll be in touch as we roll out access. In the meantime, explore what RoweOS can do.</p>'
    + '<a href="https://roweos.com/info" style="display:inline-block;padding:14px 36px;font-size:14px;font-weight:500;letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:' + bg + ';background:linear-gradient(135deg,' + goldLight + ',' + gold + ');border-radius:10px;">Learn More</a>'
    + '</td></tr>'

    // Footer
    + '<tr><td style="padding:32px 0 48px;text-align:center;border-top:1px solid ' + borderColor + ';">'
    + '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:18px;letter-spacing:2px;color:' + gold + ';">ROWEOS</p>'
    + '<p style="margin:0 0 16px;font-size:12px;color:' + dimText + ';">Operating intelligence, built for brands.</p>'
    + '<p style="margin:0;font-size:11px;color:rgba(138,133,127,0.5);">The Rowe Collection LLC &middot; Austin, Texas</p>'
    + '<p style="margin:12px 0 0;font-size:11px;"><a href="https://roweos.com" style="color:' + dimText + ';text-decoration:none;">roweos.com</a> &middot; <a href="https://roweos.com/info" style="color:' + dimText + ';text-decoration:none;">Learn More</a></p>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';
}

function buildFeatureRow(title, desc, gold, textColor, dimText, borderColor) {
  return '<tr><td style="padding:12px 0;border-bottom:1px solid ' + borderColor + ';">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    + '<td width="8" valign="top" style="padding-top:6px;padding-right:14px;">'
    + '<div style="width:6px;height:6px;border-radius:50%;background:' + gold + ';"></div></td>'
    + '<td>'
    + '<p style="margin:0 0 4px;font-size:14px;font-weight:500;color:' + textColor + ';">' + title + '</p>'
    + '<p style="margin:0;font-size:13px;line-height:1.5;color:' + dimText + ';">' + desc + '</p>'
    + '</td></tr></table></td></tr>';
}

export default async function handler(req, res) {
  // CORS
  var origin = req.headers.origin || '';
  var allowed = ['https://roweos.vercel.app', 'https://roweos.com', 'https://www.roweos.com'];
  res.setHeader('Access-Control-Allow-Origin', allowed.indexOf(origin) !== -1 ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    var email = (body.email || '').trim().toLowerCase();
    var name = (body.name || '').trim();
    var source = (body.source || 'unknown').trim();

    // Validate email
    if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Firebase setup
    var projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
    var saJson = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    if (!projectId || !saJson) {
      return res.status(500).json({ error: 'Server not configured' });
    }

    var sa = JSON.parse(saJson);
    var accessToken = await getGoogleAccessToken(sa);

    // Create doc ID from email hash (prevents duplicates)
    var docId = crypto.createHash('sha256').update(email).digest('hex').substring(0, 20);
    var baseUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
    var docPath = baseUrl + '/newsletter_subscribers/' + docId;

    // Check if already subscribed
    var checkResp = await fetch(docPath, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    if (checkResp.ok) {
      // Already exists — update name/source if provided, don't overwrite
      return res.status(200).json({ success: true, message: "You're already on the list!" });
    }

    // Write new subscriber
    var fields = {
      email: { stringValue: email },
      name: { stringValue: name },
      source: { stringValue: source },
      subscribedAt: { stringValue: new Date().toISOString() },
      status: { stringValue: 'active' }
    };

    var writeResp = await fetch(docPath, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: fields })
    });

    if (!writeResp.ok) {
      var errText = await writeResp.text().catch(function() { return ''; });
      console.error('[Newsletter] Firestore write failed:', writeResp.status, errText.substring(0, 300));
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    console.log('[Newsletter] New subscriber:', email, 'source:', source);

    // Send welcome email via Resend
    var resendKey = (process.env.RESEND_API_KEY || '').trim();
    if (resendKey) {
      try {
        var firstName = name ? name.split(' ')[0] : '';
        var greeting = firstName ? ('Welcome, ' + firstName) : 'Welcome';
        var emailHtml = buildWelcomeEmail(greeting);
        var emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + resendKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'RoweOS <roweos@therowecollection.com>',
            to: [email],
            subject: 'Welcome to RoweOS — Operating Intelligence, Built for Brands',
            html: emailHtml
          })
        });
        if (emailResp.ok) {
          console.log('[Newsletter] Welcome email sent to:', email);
        } else {
          var emailErr = await emailResp.text().catch(function() { return ''; });
          console.warn('[Newsletter] Resend failed:', emailResp.status, emailErr.substring(0, 200));
        }
      } catch(emailErr) {
        console.warn('[Newsletter] Email send error (non-fatal):', emailErr.message);
      }
    }

    return res.status(200).json({ success: true, message: "You're on the list!" });

  } catch(err) {
    console.error('[Newsletter] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
