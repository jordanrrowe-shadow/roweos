// v22.2: Resend welcome email — admin-only endpoint
// POST { email, accessKey, tier }

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
    var accessKey = (body.accessKey || '').trim();
    var tier = (body.tier || 'solo').trim();
    var adminUid = (body.adminUid || '').trim();

    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!accessKey) {
      return res.status(400).json({ error: 'Access key is required' });
    }

    // Verify admin UID
    var ADMIN_UID = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';
    if (adminUid !== ADMIN_UID) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    }

    // Build the beta welcome email HTML (mirrors generateBetaWelcomeEmail in client)
    var tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
      + '<body style="margin:0;padding:0;background:#0a0a0a;">'
      + '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e0e0e0;">'
      // Header
      + '<div style="background:linear-gradient(135deg,#1a1a1a 0%,#0a0a0a 100%);padding:48px 40px 32px;border-radius:12px 12px 0 0;text-align:center;">'
      + '<img src="https://roweos.com/logo.png" alt="RoweOS" style="width:80px;height:80px;border-radius:16px;margin-bottom:16px;">'
      + '<h1 style="color:#a89878;margin:0;font-size:28px;font-weight:300;letter-spacing:3px;">RoweOS</h1>'
      + '<p style="color:#666;margin:8px 0 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Operating intelligence, built for brands &amp; life</p>'
      + '</div>'
      // Content
      + '<div style="background:#111;padding:36px 40px 40px;">'
      + '<h2 style="color:#fff;font-size:22px;font-weight:500;margin:0 0 8px;">Welcome to RoweOS ' + escapeHtml(tierLabel) + '</h2>'
      + '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 28px;">You\'ve been granted early access to RoweOS \u2014 an AI operating system built for brands and life. Your access key is below.</p>'
      // Key block
      + '<div style="background:#1a1a1a;border:1px solid #a8987844;border-radius:8px;padding:18px;text-align:center;margin-bottom:28px;">'
      + '<p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">Your Access Key</p>'
      + '<code style="font-size:22px;color:#a89878;letter-spacing:3px;font-weight:600;">' + escapeHtml(accessKey) + '</code>'
      + '</div>'
      // Getting Started
      + '<div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:28px;">'
      + '<p style="color:#fff;font-size:14px;font-weight:500;margin:0 0 12px;">Getting Started</p>'
      + '<ol style="line-height:2;color:#ccc;margin:0;padding-left:20px;font-size:13px;">'
      + '<li>Go to <a href="https://roweos.com" style="color:#a89878;text-decoration:none;">roweos.com</a></li>'
      + '<li>Create your account or sign in</li>'
      + '<li>Go to <strong style="color:#fff;">Settings</strong> and enter your Access Key</li>'
      + '<li>Start building with AI</li>'
      + '</ol>'
      + '</div>'
      // Footer
      + '<p style="color:#555;font-size:12px;margin:28px 0 0;padding-top:20px;border-top:1px solid #222;">'
      + 'Questions? Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color:#a89878;text-decoration:none;">jordan@therowecollection.com</a>'
      + '</p>'
      + '</div>'
      + '</div>'
      + '</body></html>';

    var resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'RoweOS <roweos@therowecollection.com>',
        reply_to: 'jordan@therowecollection.com',
        to: [email],
        subject: 'Welcome to RoweOS ' + tierLabel + ' \u2014 Your Access Key',
        html: html
      })
    });

    if (resendResp.ok) {
      var resendData = await resendResp.json();
      console.log('[resend-welcome] Email sent to:', email, 'id:', resendData.id);
      return res.status(200).json({ success: true, emailId: resendData.id });
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
