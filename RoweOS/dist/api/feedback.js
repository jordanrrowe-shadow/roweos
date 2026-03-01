// v20.20: User Feedback API — stores feedback in Firestore, emails admin, sends push
// POST { category, description, rating, screenshots[], deviceInfo, featureAreas[], platform, os } → Firestore feedback collection

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

function buildFeedbackEmail(feedback) {
  var gold = '#c4a882';
  var bg = '#0a0a0a';
  var cardBg = '#141414';
  var borderColor = '#1e1e1e';
  var textColor = '#e8e4df';
  var dimText = '#8a857f';

  var categoryColors = { bug: '#ff4444', feature: '#60a5fa', general: '#a89878', ui_ux: '#f472b6' };
  var categoryLabels = { bug: 'Bug Report', feature: 'Feature Request', general: 'General Feedback', ui_ux: 'UI/UX Issue' };
  var catColor = categoryColors[feedback.category] || gold;
  var catLabel = categoryLabels[feedback.category] || feedback.category;

  var deviceInfo = '';
  if (feedback.deviceInfo) {
    try {
      var d = typeof feedback.deviceInfo === 'string' ? JSON.parse(feedback.deviceInfo) : feedback.deviceInfo;
      deviceInfo = '<tr><td style="padding:12px 0;border-top:1px solid ' + borderColor + ';">'
        + '<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:' + gold + ';">Device Info</p>'
        + '<p style="margin:0;font-size:13px;color:' + dimText + ';line-height:1.6;">'
        + (d.platform ? 'Platform: ' + d.platform + '<br>' : '')
        + (d.screenSize ? 'Screen: ' + d.screenSize + '<br>' : '')
        + (d.appVersion ? 'Version: ' + d.appVersion + '<br>' : '')
        + (d.userAgent ? 'UA: ' + d.userAgent.substring(0, 120) : '')
        + '</p></td></tr>';
    } catch(e) {}
  }

  return '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
    + '<title>RoweOS Feedback</title></head>'
    + '<body style="margin:0;padding:0;background-color:' + bg + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + bg + ';">'
    + '<tr><td align="center" style="padding:40px 16px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">'

    // Logo
    + '<tr><td align="center" style="padding:0 0 32px;">'
    + '<span style="font-family:Georgia,\'Times New Roman\',serif;font-size:22px;letter-spacing:3px;color:' + gold + ';">ROWEOS</span>'
    + '</td></tr>'

    // Category badge
    + '<tr><td style="padding:0 0 20px;">'
    + '<div style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;background:' + catColor + ';color:#000;">' + catLabel + '</div>'
    + '</td></tr>'

    // User info
    + '<tr><td style="padding:0 0 16px;">'
    + '<p style="margin:0;font-size:12px;color:' + dimText + ';">'
    + (feedback.email ? 'From: ' + feedback.email : 'Anonymous')
    + (feedback.tier && feedback.tier !== 'unknown' ? ' &middot; ' + feedback.tier : '')
    + (feedback.brand ? ' &middot; ' + feedback.brand : '')
    + (feedback.mode ? ' &middot; ' + feedback.mode : '')
    + '</p></td></tr>'

    // Description
    + '<tr><td style="padding:16px;background:' + cardBg + ';border:1px solid ' + borderColor + ';border-radius:12px;">'
    + '<p style="margin:0;font-size:15px;line-height:1.7;color:' + textColor + ';white-space:pre-wrap;">' + (feedback.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>'
    + '</td></tr>'

    // Device info
    + deviceInfo

    // v21.12: Inline screenshot images in email
    + (function() {
      if (!feedback.screenshots || feedback.screenshots.length === 0) return '';
      var ssHtml = '<tr><td style="padding:12px 0;border-top:1px solid ' + borderColor + ';">'
        + '<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:' + gold + ';">Screenshots (' + feedback.screenshots.length + ')</p>';
      for (var si = 0; si < feedback.screenshots.length; si++) {
        var src = feedback.screenshots[si];
        if (typeof src === 'string' && src.indexOf('data:image') === 0) {
          ssHtml += '<img src="' + src + '" style="max-width:100%;height:auto;border-radius:8px;border:1px solid ' + borderColor + ';margin-bottom:8px;display:block;" alt="Screenshot ' + (si + 1) + '">';
        }
      }
      ssHtml += '</td></tr>';
      return ssHtml;
    })()

    // Footer
    + '<tr><td style="padding:24px 0 0;text-align:center;border-top:1px solid ' + borderColor + ';">'
    + '<p style="margin:0;font-size:11px;color:rgba(138,133,127,0.5);">RoweOS Feedback System</p>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';
}

export default async function handler(req, res) {
  // v21.9: Permissive CORS — echo back origin (feedback endpoint has no security concern)
  var origin = (req.headers.origin || '').trim();
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  function fetchWithTimeout(url, opts, ms) {
    ms = ms || 5000;
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, ms);
    opts.signal = ctrl.signal;
    return fetch(url, opts).then(function(r) { clearTimeout(timer); return r; }).catch(function(e) { clearTimeout(timer); throw e; });
  }

  // v21.9: Shared email + push logic
  async function sendNotifications(category, description, email, tier, brand, mode, deviceInfo, screenshots) {
    var sideEffects = [];
    var categoryLabels = { bug: 'Bug Report', feature: 'Feature Request', general: 'General Feedback', ui_ux: 'UI/UX Issue' };

    var resendKey = (process.env.RESEND_API_KEY || '').trim();
    if (resendKey) {
      sideEffects.push(
        (async function() {
          try {
            var emailHtml = buildFeedbackEmail({
              category: category, description: description, rating: 0,
              email: email, tier: tier, brand: brand,
              mode: mode, deviceInfo: deviceInfo, screenshots: screenshots
            });
            var emailResp = await fetchWithTimeout('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'RoweOS <roweos@therowecollection.com>',
                to: ['jordan@therowecollection.com'],
                subject: 'RoweOS Feedback: ' + (categoryLabels[category] || category) + ' — ' + description.substring(0, 60),
                html: emailHtml
              })
            }, 5000);
            if (emailResp.ok) { console.log('[Feedback] Admin email sent'); }
            else { console.warn('[Feedback] Resend failed:', emailResp.status); }
          } catch(e) { console.warn('[Feedback] Email error:', e.message); }
        })()
      );
    }

    var adminUid = (process.env.ADMIN_UID || '').trim();
    if (adminUid) {
      sideEffects.push(
        (async function() {
          try {
            var categoryLabels2 = { bug: 'Bug Report', feature: 'Feature Request', general: 'Feedback', ui_ux: 'UI/UX Issue' };
            var pushResp = await fetchWithTimeout('https://roweos.com/api/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'send', uid: adminUid,
                title: 'New ' + (categoryLabels2[category] || 'Feedback'),
                message: description.substring(0, 120)
              })
            }, 5000);
            if (pushResp.ok) { console.log('[Feedback] Push sent to admin'); }
            else { console.warn('[Feedback] Push failed:', pushResp.status); }
          } catch(e) { console.warn('[Feedback] Push error:', e.message); }
        })()
      );
    }

    if (sideEffects.length > 0) {
      await Promise.allSettled(sideEffects);
    }
  }

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    var description = (body.description || '').trim();
    var category = body.category || 'general';
    var validCategories = ['bug', 'feature', 'general', 'ui_ux'];
    if (validCategories.indexOf(category) === -1) category = 'general';

    // v21.9: notifyOnly — client already wrote to Firestore, just send email + push
    if (body.notifyOnly) {
      console.log('[Feedback] notifyOnly for:', body.feedbackId || 'unknown', category);
      await sendNotifications(category, description, body.email || '', body.tier || '', body.brand || '', body.mode || '', body.deviceInfo || '', body.screenshots || []);
      return res.status(200).json({ success: true, notified: true });
    }

    // Full mode: validate, write to Firestore, then notify
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    if (description.length > 5000) {
      return res.status(400).json({ error: 'Description too long (max 5000 chars)' });
    }

    var screenshots = [];
    if (Array.isArray(body.screenshots)) {
      var totalSize = 0;
      for (var i = 0; i < Math.min(body.screenshots.length, 3); i++) {
        var ss = body.screenshots[i];
        if (typeof ss === 'string' && ss.indexOf('data:image') === 0) {
          totalSize += ss.length;
          if (totalSize < 900000) {
            screenshots.push(ss);
          }
        }
      }
    }

    var projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
    var saJson = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    if (!projectId || !saJson) {
      return res.status(500).json({ error: 'Server not configured' });
    }

    var sa = JSON.parse(saJson);
    var accessToken = await getGoogleAccessToken(sa);

    var feedbackId = 'fb_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
    var baseUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
    var docPath = baseUrl + '/feedback/' + feedbackId;

    var fields = {
      uid: { stringValue: body.uid || '' },
      email: { stringValue: body.email || '' },
      category: { stringValue: category },
      description: { stringValue: description },
      rating: { integerValue: '0' },
      deviceInfo: { stringValue: typeof body.deviceInfo === 'string' ? body.deviceInfo : JSON.stringify(body.deviceInfo || {}) },
      tier: { stringValue: body.tier || 'unknown' },
      brand: { stringValue: body.brand || '' },
      mode: { stringValue: body.mode || '' },
      status: { stringValue: 'new' },
      createdAt: { stringValue: new Date().toISOString() },
      platform: { stringValue: body.platform || '' },
      os: { stringValue: body.os || '' }
    };

    if (Array.isArray(body.featureAreas) && body.featureAreas.length > 0) {
      fields.featureAreas = {
        arrayValue: {
          values: body.featureAreas.slice(0, 12).map(function(a) { return { stringValue: String(a) }; })
        }
      };
    } else {
      fields.featureAreas = { arrayValue: { values: [] } };
    }

    if (screenshots.length > 0) {
      fields.screenshots = {
        arrayValue: {
          values: screenshots.map(function(s) { return { stringValue: s }; })
        }
      };
    } else {
      fields.screenshots = { arrayValue: { values: [] } };
    }

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
      console.error('[Feedback] Firestore write failed:', writeResp.status, errText.substring(0, 300));
      return res.status(500).json({ error: 'Failed to save feedback' });
    }

    console.log('[Feedback] New feedback:', feedbackId, category, 'from:', body.email || 'anonymous');

    await sendNotifications(category, description, body.email || '', body.tier || '', body.brand || '', body.mode || '', body.deviceInfo || '', screenshots);

    return res.status(200).json({ success: true, feedbackId: feedbackId });

  } catch(err) {
    console.error('[Feedback] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
