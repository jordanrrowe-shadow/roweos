// v22.2: Admin email composer — sends arbitrary HTML email via Resend
// POST { email, subject, from, html, adminUid }

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
    var adminUid = (body.adminUid || '').trim();

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

    // Verify admin UID
    var ADMIN_UID = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';
    if (adminUid !== ADMIN_UID) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    }

    // Validate from address — only allow known addresses
    var allowedFrom = {
      'roweos@therowecollection.com': 'RoweOS <roweos@therowecollection.com>',
      'jordan@therowecollection.com': 'Jordan Rowe <jordan@therowecollection.com>'
    };
    var fromDisplay = allowedFrom[fromAddr];
    if (!fromDisplay) {
      return res.status(400).json({ error: 'Invalid from address. Allowed: roweos@ or jordan@therowecollection.com' });
    }

    var resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromDisplay,
        reply_to: 'jordan@therowecollection.com',
        to: [email],
        subject: subject,
        html: htmlBody
      })
    });

    if (resendResp.ok) {
      var resendData = await resendResp.json();
      console.log('[resend-welcome] Email sent to:', email, 'from:', fromAddr, 'id:', resendData.id);
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
