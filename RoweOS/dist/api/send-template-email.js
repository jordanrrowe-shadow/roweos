// v30.0: Template email sender serverless function
// Sends one of 5 email templates to a user via Resend API
// POST { template, userId, userEmail, userName, callerUid, metadata }
// Admin-only: callerUid must match hardcoded admin UID

var ADMIN_UID = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';

var ALLOWED_ORIGINS = [
  'https://roweos.com',
  'https://www.roweos.com',
  'https://roweos.vercel.app'
];

// --- JWT / Google Auth helpers (same pattern as scheduler.js) ---

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

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

// --- HMAC link signing ---

function generateHmac(userId, question, answer) {
  var crypto = require('crypto');
  var secret = process.env.EMAIL_RESPONSE_SECRET || process.env.RESEND_API_KEY || 'fallback-secret';
  var message = userId + ':' + question + ':' + answer;
  var hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return hmac.substring(0, 16);
}

function buildResponseUrl(userId, question, answer, template) {
  var token = generateHmac(userId, question, answer);
  return 'https://roweos.com/api/email-response'
    + '?user=' + encodeURIComponent(userId)
    + '&q=' + encodeURIComponent(question)
    + '&a=' + encodeURIComponent(answer)
    + '&token=' + encodeURIComponent(token)
    + '&tpl=' + encodeURIComponent(template);
}

// --- HTML helpers ---

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function optionButton(url, label) {
  return '<a href="' + url + '" style="display:inline-block;padding:10px 20px;background:#1a1a1a;border:1px solid rgba(168,152,120,0.27);border-radius:8px;color:#e0e0e0;text-decoration:none;font-size:13px;font-weight:500;margin:0 6px 8px 0;">' + escapeHtml(label) + '</a>';
}

function ctaButton(url, label) {
  return '<a href="' + url + '" style="display:inline-block;padding:12px 28px;background:#a89878;color:#111;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">' + escapeHtml(label) + '</a>';
}

function wrapEmail(subtitle, bodyHtml) {
  var tagline = subtitle || 'Operating intelligence, built for brands and life';
  var parts = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">',
    '<tr><td align="center">',
    '<table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;">',
    // Header
    '<tr><td style="padding:32px 32px 16px;border-bottom:1px solid #2a2a2a;background:linear-gradient(135deg,#1a1a1a 0%,#0a0a0a 100%);text-align:center;border-radius:12px 12px 0 0;">',
    '<img src="https://roweos.com/logo.png" alt="RoweOS" style="width:64px;height:64px;border-radius:12px;margin-bottom:12px;">',
    '<h1 style="margin:0;font-size:28px;font-weight:300;color:#a89878;letter-spacing:2px;">RoweOS</h1>',
    '<p style="margin:8px 0 0;font-size:12px;color:#666;letter-spacing:1.5px;text-transform:uppercase;">' + escapeHtml(tagline) + '</p>'
  ];

  parts.push('</td></tr>');
  // Body
  parts.push('<tr><td style="padding:24px 32px;">');
  parts.push(bodyHtml);
  parts.push('</td></tr>');
  // Footer
  parts.push('<tr><td style="padding:16px 32px;border-top:1px solid #2a2a2a;text-align:center;">');
  parts.push('<p style="margin:0 0 6px;font-size:11px;color:#555;">The Rowe Collection, LLC - Austin, TX</p>');
  parts.push('<p style="margin:0;font-size:11px;color:#555;">Questions? Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color:#a89878;text-decoration:none;">jordan@therowecollection.com</a></p>');
  parts.push('</td></tr>');
  parts.push('</table>');
  parts.push('</td></tr></table>');
  parts.push('</body></html>');

  return parts.join('\n');
}

// --- Template builders ---

function buildOnboardingSurvey(userId, userName) {
  var greeting = userName ? ('Hi ' + escapeHtml(userName) + ',') : 'Hi there,';
  var parts = [];

  parts.push('<p style="margin:0 0 20px;font-size:15px;color:#e0e0e0;line-height:1.6;">' + greeting + '</p>');
  parts.push('<p style="margin:0 0 24px;font-size:14px;color:#ccc;line-height:1.6;">We would love to learn a bit about your experience so far. A few quick questions:</p>');

  // Question 1: API key setup
  parts.push('<div style="margin:0 0 24px;">');
  parts.push('<p style="margin:0 0 10px;font-size:14px;color:#e0e0e0;font-weight:500;">Do you know how to set up your own AI API key?</p>');
  parts.push(optionButton(buildResponseUrl(userId, 'api_key_setup', 'own_key', 'onboarding_survey'), 'Yes, I have my own'));
  parts.push('<a href="https://roweos.com/info" style="display:inline-block;padding:10px 20px;background:#1a1a1a;border:1px solid rgba(168,152,120,0.27);border-radius:8px;color:#e0e0e0;text-decoration:none;font-size:13px;font-weight:500;margin:0 6px 8px 0;">No, help me get one</a>');
  parts.push('</div>');

  // Question 2: Beta API key
  parts.push('<div style="margin:0 0 24px;">');
  parts.push('<p style="margin:0 0 10px;font-size:14px;color:#e0e0e0;font-weight:500;">Do you need a beta API key?</p>');
  parts.push(optionButton(buildResponseUrl(userId, 'api_key_need', 'yes', 'onboarding_survey'), 'Yes, I need one'));
  parts.push(optionButton(buildResponseUrl(userId, 'api_key_need', 'no', 'onboarding_survey'), 'No, I have my own'));
  parts.push(optionButton(buildResponseUrl(userId, 'api_key_need', 'unsure', 'onboarding_survey'), 'Not sure what this means'));
  parts.push('</div>');

  // Question 3: How did you hear about RoweOS
  parts.push('<div style="margin:0 0 24px;">');
  parts.push('<p style="margin:0 0 10px;font-size:14px;color:#e0e0e0;font-weight:500;">How did you hear about RoweOS?</p>');
  var sources = ['Twitter/X', 'Google Search', 'Friend/Referral', 'LinkedIn', 'Product Hunt', 'Other'];
  for (var i = 0; i < sources.length; i++) {
    parts.push(optionButton(buildResponseUrl(userId, 'referral_source', sources[i].toLowerCase().replace(/[^a-z0-9]/g, '_'), 'onboarding_survey'), sources[i]));
  }
  parts.push('</div>');

  // Question 4: Experience so far
  parts.push('<div style="margin:0 0 24px;">');
  parts.push('<p style="margin:0 0 10px;font-size:14px;color:#e0e0e0;font-weight:500;">How has your experience been so far?</p>');
  var experiences = [
    { label: 'Smooth, love it', value: 'smooth' },
    { label: 'Good, some questions', value: 'good' },
    { label: 'Hit some bumps', value: 'bumpy' },
    { label: 'Need help', value: 'need_help' }
  ];
  for (var j = 0; j < experiences.length; j++) {
    parts.push(optionButton(buildResponseUrl(userId, 'experience', experiences[j].value, 'onboarding_survey'), experiences[j].label));
  }
  parts.push('</div>');

  parts.push('<p style="margin:16px 0 0;font-size:13px;color:#888;line-height:1.5;">Have more to share? Just reply to this email.</p>');

  return {
    subject: 'Quick questions about your RoweOS experience',
    html: wrapEmail('Onboarding Survey', parts.join('\n'))
  };
}

function buildReengagement(userId, userName) {
  var greeting = userName ? ('Hi ' + escapeHtml(userName) + ',') : 'Hi there,';
  var parts = [];

  parts.push('<p style="margin:0 0 16px;font-size:15px;color:#e0e0e0;line-height:1.6;">' + greeting + '</p>');
  parts.push('<p style="margin:0 0 24px;font-size:14px;color:#ccc;line-height:1.6;">We noticed you haven\'t been back in a while. Your AI brand team is ready and waiting.</p>');
  parts.push('<p style="margin:0 0 20px;font-size:14px;color:#ccc;line-height:1.6;">Here are a few things you can do in under 5 minutes:</p>');

  // Quick-win cards
  var quickWins = [
    { title: 'Run a Studio operation', desc: 'Generate strategy briefs, marketing plans, or documents with one click.' },
    { title: 'Set up brand identity', desc: 'Define your brand voice, values, and target audience for personalized AI.' },
    { title: 'Ask BLAKE anything', desc: 'Your AI assistant is ready to help with any business question.' }
  ];

  for (var i = 0; i < quickWins.length; i++) {
    parts.push('<div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:16px;margin:0 0 12px;">');
    parts.push('<p style="margin:0 0 6px;font-size:14px;color:#e0e0e0;font-weight:500;">' + escapeHtml(quickWins[i].title) + '</p>');
    parts.push('<p style="margin:0;font-size:13px;color:#888;line-height:1.5;">' + escapeHtml(quickWins[i].desc) + '</p>');
    parts.push('</div>');
  }

  parts.push('<div style="text-align:center;margin:28px 0 0;">');
  parts.push(ctaButton('https://roweos.com', 'Open RoweOS'));
  parts.push('</div>');

  return {
    subject: 'Your AI brand team is waiting for you',
    html: wrapEmail(null, parts.join('\n'))
  };
}

function buildFeatureAnnouncement(metadata) {
  var featureName = (metadata && metadata.featureName) || 'New Feature';
  var featureDescription = (metadata && metadata.featureDescription) || '';
  var imageUrl = (metadata && metadata.imageUrl) || '';
  var parts = [];

  parts.push('<p style="margin:0 0 20px;font-size:16px;color:#e0e0e0;font-weight:500;line-height:1.5;">Introducing: ' + escapeHtml(featureName) + '</p>');

  if (imageUrl) {
    parts.push('<div style="margin:0 0 20px;text-align:center;">');
    parts.push('<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(featureName) + '" style="max-width:100%;border-radius:8px;border:1px solid #2a2a2a;" />');
    parts.push('</div>');
  }

  if (featureDescription) {
    parts.push('<p style="margin:0 0 24px;font-size:14px;color:#ccc;line-height:1.7;">' + escapeHtml(featureDescription) + '</p>');
  }

  parts.push('<div style="text-align:center;margin:24px 0 0;">');
  parts.push(ctaButton('https://roweos.com', 'Try it now'));
  parts.push('</div>');

  return {
    subject: 'New in RoweOS: ' + featureName,
    html: wrapEmail('Feature Update', parts.join('\n'))
  };
}

function buildAccessKeyDelivery(metadata, userName) {
  var accessKey = (metadata && metadata.accessKey) || '';
  var tier = (metadata && metadata.tier) || 'Founder';
  var greeting = userName ? ('Hi ' + escapeHtml(userName) + ',') : 'Hi there,';
  var parts = [];

  parts.push('<p style="margin:0 0 16px;font-size:15px;color:#e0e0e0;line-height:1.6;">' + greeting + '</p>');
  parts.push('<p style="margin:0 0 24px;font-size:14px;color:#ccc;line-height:1.6;">Your RoweOS access key is ready. Here it is:</p>');

  // Tier badge
  parts.push('<div style="margin:0 0 16px;">');
  parts.push('<span style="display:inline-block;padding:4px 12px;background:rgba(168,152,120,0.15);border:1px solid rgba(168,152,120,0.3);border-radius:20px;color:#a89878;font-size:12px;font-weight:600;letter-spacing:0.5px;">' + escapeHtml(tier) + ' Tier</span>');
  parts.push('</div>');

  // Key box
  parts.push('<div style="background:#111;border:1px solid rgba(168,152,120,0.3);border-radius:8px;padding:20px;margin:0 0 24px;text-align:center;">');
  parts.push('<p style="margin:0;font-family:\'Courier New\',Courier,monospace;font-size:16px;color:#a89878;letter-spacing:1px;word-break:break-all;">' + escapeHtml(accessKey) + '</p>');
  parts.push('</div>');

  // Activation steps
  parts.push('<p style="margin:0 0 12px;font-size:14px;color:#e0e0e0;font-weight:500;">How to activate:</p>');
  var steps = [
    'Sign in at roweos.com',
    'Go to Settings and find the Access Key section',
    'Paste your key and click Activate'
  ];
  for (var i = 0; i < steps.length; i++) {
    parts.push('<div style="display:flex;align-items:flex-start;margin:0 0 10px;">');
    parts.push('<span style="display:inline-block;min-width:24px;height:24px;line-height:24px;text-align:center;background:rgba(168,152,120,0.15);border-radius:50%;color:#a89878;font-size:12px;font-weight:600;margin-right:12px;">' + (i + 1) + '</span>');
    parts.push('<p style="margin:0;font-size:13px;color:#ccc;line-height:24px;">' + escapeHtml(steps[i]) + '</p>');
    parts.push('</div>');
  }

  parts.push('<div style="text-align:center;margin:28px 0 0;">');
  parts.push(ctaButton('https://roweos.com', 'Activate Your Key'));
  parts.push('</div>');

  return {
    subject: 'Your RoweOS Access Key',
    html: wrapEmail('Access Key Delivery', parts.join('\n'))
  };
}

function buildCheckin(userId, userName) {
  var greeting = userName ? ('Hi ' + escapeHtml(userName) + ',') : 'Hi there,';
  var parts = [];

  parts.push('<p style="margin:0 0 16px;font-size:15px;color:#e0e0e0;line-height:1.6;">' + greeting + '</p>');
  parts.push('<p style="margin:0 0 24px;font-size:14px;color:#ccc;line-height:1.6;">We want to make sure RoweOS is working well for you. How would you rate your experience?</p>');

  // Rating options
  parts.push('<div style="margin:0 0 24px;text-align:center;">');
  var ratings = [
    { label: 'Loving it', value: 'loving_it' },
    { label: 'It\'s good', value: 'good' },
    { label: 'Could be better', value: 'could_be_better' },
    { label: 'Having issues', value: 'having_issues' }
  ];
  for (var i = 0; i < ratings.length; i++) {
    parts.push(optionButton(buildResponseUrl(userId, 'rating', ratings[i].value, 'checkin'), ratings[i].label));
  }
  parts.push('</div>');

  parts.push('<div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:20px;margin:0 0 16px;">');
  parts.push('<p style="margin:0 0 8px;font-size:14px;color:#e0e0e0;font-weight:500;">What would make RoweOS better?</p>');
  parts.push('<p style="margin:0;font-size:13px;color:#888;line-height:1.5;">We read every reply. Just hit reply and share your thoughts, feature requests, or anything on your mind.</p>');
  parts.push('</div>');

  return {
    subject: 'How\'s RoweOS working for you?',
    html: wrapEmail('Check-in', parts.join('\n'))
  };
}

// --- Template router ---

function buildTemplate(template, userId, userName, metadata) {
  switch (template) {
    case 'onboarding_survey':
      return buildOnboardingSurvey(userId, userName);
    case 'reengagement':
      return buildReengagement(userId, userName);
    case 'feature_announcement':
      return buildFeatureAnnouncement(metadata);
    case 'access_key_delivery':
      return buildAccessKeyDelivery(metadata, userName);
    case 'checkin':
      return buildCheckin(userId, userName);
    default:
      return null;
  }
}

// --- Firestore logging ---

async function writeEmailLog(projectId, accessToken, logData) {
  try {
    var url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/email_log';
    var firestoreDoc = {
      fields: {
        userId: { stringValue: logData.userId || '' },
        userEmail: { stringValue: logData.userEmail || '' },
        template: { stringValue: logData.template || '' },
        subject: { stringValue: logData.subject || '' },
        sentAt: { stringValue: logData.sentAt || new Date().toISOString() },
        status: { stringValue: logData.status || 'unknown' }
      }
    };
    if (logData.error) {
      firestoreDoc.fields.error = { stringValue: String(logData.error) };
    }

    var headers = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = 'Bearer ' + accessToken;
    }

    var resp = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(firestoreDoc)
    });

    if (!resp.ok) {
      var errText = await resp.text();
      console.error('[send-template-email] Firestore log write failed:', resp.status, errText);
    }
  } catch (err) {
    console.error('[send-template-email] Firestore log error:', err.message);
  }
}

// --- Main handler ---

module.exports = async function handler(req, res) {
  // CORS
  var origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
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

  try {
    var body = req.body || {};
    var template = body.template;
    var userId = body.userId || '';
    var userEmail = body.userEmail || '';
    var userName = body.userName || '';
    var callerUid = body.callerUid || '';
    var metadata = body.metadata || {};

    // Admin check
    if (callerUid !== ADMIN_UID) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    // Validate template
    var validTemplates = ['onboarding_survey', 'reengagement', 'feature_announcement', 'access_key_delivery', 'checkin'];
    if (validTemplates.indexOf(template) === -1) {
      return res.status(400).json({ error: 'Invalid template. Must be one of: ' + validTemplates.join(', ') });
    }

    // Validate email
    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }

    // Build template
    var emailData = buildTemplate(template, userId, userName, metadata);
    if (!emailData) {
      return res.status(500).json({ error: 'Failed to build email template' });
    }

    // Get Firebase access token for logging
    var accessToken = null;
    var projectId = process.env.FIREBASE_PROJECT_ID || '';
    if (process.env.FIREBASE_SERVICE_ACCOUNT && projectId) {
      try {
        var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        accessToken = await getGoogleAccessToken(sa);
      } catch (authErr) {
        console.error('[send-template-email] Firebase auth error:', authErr.message);
      }
    }

    // Send email via Resend
    var sendStatus = 'failed';
    var sendError = null;

    if (!process.env.RESEND_API_KEY) {
      sendError = 'RESEND_API_KEY not configured';
      console.error('[send-template-email]', sendError);
    } else {
      try {
        var resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'RoweOS <roweos@therowecollection.com>',
            reply_to: 'jordan@therowecollection.com',
            to: [userEmail],
            subject: emailData.subject,
            html: emailData.html
          })
        });

        if (resendResp.ok) {
          sendStatus = 'sent';
          console.log('[send-template-email] Email sent:', template, 'to', userEmail);
        } else {
          var resendErr = await resendResp.text();
          sendError = 'Resend API error: ' + resendResp.status + ' ' + resendErr;
          console.error('[send-template-email]', sendError);
        }
      } catch (fetchErr) {
        sendError = 'Resend fetch error: ' + fetchErr.message;
        console.error('[send-template-email]', sendError);
      }
    }

    // Write to Firestore email_log
    if (projectId) {
      await writeEmailLog(projectId, accessToken, {
        userId: userId,
        userEmail: userEmail,
        template: template,
        subject: emailData.subject,
        sentAt: new Date().toISOString(),
        status: sendStatus,
        error: sendError
      });
    }

    if (sendStatus === 'sent') {
      return res.status(200).json({
        success: true,
        template: template,
        userEmail: userEmail,
        subject: emailData.subject
      });
    } else {
      return res.status(500).json({
        success: false,
        error: sendError
      });
    }

  } catch (error) {
    console.error('[send-template-email] Handler error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
