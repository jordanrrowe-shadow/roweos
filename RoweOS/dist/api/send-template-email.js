// v30.4: Template email sender serverless function
// Sends one of 6 email templates to a user via Resend API
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
  // v30.5: Intelligence, accessible promo section
  parts.push('<tr><td style="padding:24px 32px 0;text-align:center;border-top:1px solid #2a2a2a;">');
  parts.push('<p style="font-family:\'DM Sans\',sans-serif;font-size:20px;font-weight:300;color:#a89878;letter-spacing:1px;margin:0 0 4px;">Intelligence, accessible.</p>');
  parts.push('<p style="font-family:\'DM Sans\',sans-serif;font-size:13px;color:#888;margin:0 0 16px;">Simple plans. No hidden fees.</p>');
  parts.push('<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>');
  parts.push('<td style="padding-right:8px;"><a href="https://roweos.com/purchase" style="display:inline-block;padding:10px 24px;border:1px solid #a89878;border-radius:6px;color:#a89878;text-decoration:none;font-family:\'DM Sans\',sans-serif;font-size:13px;font-weight:500;">View Plans</a></td>');
  parts.push('<td style="padding-left:8px;"><a href="https://roweos.com/purchase" style="display:inline-block;padding:10px 24px;border:1px solid #a89878;border-radius:6px;color:#a89878;text-decoration:none;font-family:\'DM Sans\',sans-serif;font-size:13px;font-weight:500;">Get API Keys</a></td>');
  parts.push('</tr></table>');
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

// v30.4: Subscription Info email template
function buildSubscriptionInfo(userName) {
  var greeting = userName ? ('Hi ' + escapeHtml(userName) + ',') : 'Hi there,';
  var parts = [];

  parts.push('<p style="margin:0 0 16px;font-size:15px;color:#e0e0e0;line-height:1.6;">' + greeting + '</p>');
  parts.push('<p style="margin:0 0 24px;font-size:14px;color:#ccc;line-height:1.6;">Here is everything you need to know about RoweOS plans, AI API keys, and smart model routing.</p>');

  // --- Section 1: Choose Your Plan ---
  parts.push('<h2 style="margin:0 0 16px;font-size:18px;color:#a89878;font-weight:500;letter-spacing:0.5px;">Choose Your Plan</h2>');

  // Tier comparison table (email-safe table layout)
  parts.push('<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:separate;border-spacing:0;">');

  // Header row
  parts.push('<tr>');
  parts.push('<td style="padding:10px 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #2a2a2a;"></td>');
  parts.push('<td style="padding:10px 8px;font-size:11px;color:#a89878;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:1px solid #2a2a2a;text-align:center;">Solo</td>');
  parts.push('<td style="padding:10px 8px;font-size:11px;color:#a89878;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:1px solid #2a2a2a;text-align:center;">Founder</td>');
  parts.push('<td style="padding:10px 8px;font-size:11px;color:#a89878;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:1px solid #2a2a2a;text-align:center;">Premium</td>');
  parts.push('</tr>');

  // Price row
  parts.push('<tr>');
  parts.push('<td style="padding:10px 8px;font-size:12px;color:#888;border-bottom:1px solid #1e1e1e;">Price</td>');
  parts.push('<td style="padding:10px 8px;font-size:14px;color:#e0e0e0;font-weight:600;text-align:center;border-bottom:1px solid #1e1e1e;">$29/mo</td>');
  parts.push('<td style="padding:10px 8px;font-size:14px;color:#e0e0e0;font-weight:600;text-align:center;border-bottom:1px solid #1e1e1e;">$59/mo</td>');
  parts.push('<td style="padding:10px 8px;font-size:14px;color:#e0e0e0;font-weight:600;text-align:center;border-bottom:1px solid #1e1e1e;">$79/mo</td>');
  parts.push('</tr>');

  // Trial row
  parts.push('<tr>');
  parts.push('<td style="padding:10px 8px;font-size:12px;color:#888;border-bottom:1px solid #1e1e1e;">Trial</td>');
  parts.push('<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">7 days free</td>');
  parts.push('<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">14 days free</td>');
  parts.push('<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">14 days free</td>');
  parts.push('</tr>');

  // Brands row
  parts.push('<tr>');
  parts.push('<td style="padding:10px 8px;font-size:12px;color:#888;border-bottom:1px solid #1e1e1e;">Brands</td>');
  parts.push('<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">1 Brand</td>');
  parts.push('<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">Up to 5</td>');
  parts.push('<td style="padding:10px 8px;font-size:13px;color:#ccc;text-align:center;border-bottom:1px solid #1e1e1e;">Up to 15</td>');
  parts.push('</tr>');

  // Features row
  parts.push('<tr>');
  parts.push('<td style="padding:10px 8px;font-size:12px;color:#888;">Features</td>');
  parts.push('<td style="padding:10px 8px;font-size:12px;color:#ccc;text-align:center;line-height:1.5;">Studio, Identity, Analytics, Mail</td>');
  parts.push('<td style="padding:10px 8px;font-size:12px;color:#ccc;text-align:center;line-height:1.5;">+ Automations, Pipelines, Social, Cloud Sync</td>');
  parts.push('<td style="padding:10px 8px;font-size:12px;color:#ccc;text-align:center;line-height:1.5;">+ Bloom, Brand Sharing, Priority Support</td>');
  parts.push('</tr>');

  parts.push('</table>');

  // CTA: Choose Your Plan
  parts.push('<div style="text-align:center;margin:0 0 32px;">');
  parts.push(ctaButton('https://roweos.com', 'Choose Your Plan'));
  parts.push('</div>');

  // Divider
  parts.push('<div style="border-top:1px solid #2a2a2a;margin:0 0 24px;"></div>');

  // --- Section 2: AI API Keys ---
  parts.push('<h2 style="margin:0 0 16px;font-size:18px;color:#a89878;font-weight:500;letter-spacing:0.5px;">AI API Keys - Pay As You Go</h2>');
  parts.push('<p style="margin:0 0 20px;font-size:14px;color:#ccc;line-height:1.6;">RoweOS works with your own API keys from three providers:</p>');

  // Provider cards
  var providers = [
    { name: 'Anthropic (Claude)', models: 'Sonnet 4.6, Opus 4.7, Haiku 4.5' },
    { name: 'OpenAI (ChatGPT)', models: 'GPT-5.5, GPT-5.5 Pro, GPT-5.5 Thinking, GPT Image 2' },
    { name: 'Google (Gemini)', models: 'Gemini 3.1 Pro, Deep Research, NanoBanana 3 Pro' }
  ];
  for (var i = 0; i < providers.length; i++) {
    parts.push('<div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:14px 16px;margin:0 0 10px;">');
    parts.push('<p style="margin:0 0 4px;font-size:14px;color:#e0e0e0;font-weight:500;">' + escapeHtml(providers[i].name) + '</p>');
    parts.push('<p style="margin:0;font-size:12px;color:#888;">Latest: ' + escapeHtml(providers[i].models) + '</p>');
    parts.push('</div>');
  }

  parts.push('<p style="margin:16px 0 20px;font-size:14px;color:#ccc;line-height:1.6;">Bring your own keys and pay only for what you use. Or purchase pre-loaded keys from The Rowe Collection.</p>');

  // CTA: Get API Keys
  parts.push('<div style="text-align:center;margin:0 0 32px;">');
  parts.push(ctaButton('https://roweos.com/purchase', 'Get API Keys'));
  parts.push('</div>');

  // Divider
  parts.push('<div style="border-top:1px solid #2a2a2a;margin:0 0 24px;"></div>');

  // --- Section 3: RoweOS AI - Smart Routing ---
  parts.push('<h2 style="margin:0 0 16px;font-size:18px;color:#a89878;font-weight:500;letter-spacing:0.5px;">RoweOS AI - Unlock Smart Routing</h2>');
  parts.push('<p style="margin:0 0 16px;font-size:14px;color:#ccc;line-height:1.7;">When you have all three AI providers configured, RoweOS AI automatically selects the best model for each task. Strategy questions route to Claude. Creative content routes to GPT. Research and analysis routes to Gemini.</p>');
  parts.push('<p style="margin:0;font-size:14px;color:#ccc;line-height:1.7;">One prompt, the right model, every time.</p>');

  return {
    subject: 'RoweOS Plans, API Keys, and AI Routing',
    html: wrapEmail('Subscription', parts.join('\n'))
  };
}

// v31.2: Founder Lifetime Offer (Founder100). Personalized per-recipient.
// No em dashes, no sentence dashes - per Jordan's preference.
function buildFounderLifetimeOffer(userName) {
  var firstName = userName ? String(userName).split(' ')[0] : '';
  var greeting = firstName ? ('Hi ' + escapeHtml(firstName) + ',') : 'Hi there,';
  var parts = [];

  function providerCell(name, sub, svg) {
    return '<td align="center" style="padding:8px 6px;width:33.33%;">'
      + '<div style="display:inline-block;padding:14px 10px 12px;background:#0e0e0e;border:1px solid #1f1f1f;border-radius:10px;width:140px;">'
      + '<div style="line-height:1;margin-bottom:6px;">' + svg + '</div>'
      + '<div style="font-size:12px;color:#ddd;font-weight:500;letter-spacing:0.4px;">' + name + '</div>'
      + '<div style="font-size:10px;color:#666;margin-top:3px;letter-spacing:0.5px;text-transform:uppercase;">' + sub + '</div>'
      + '</div></td>';
  }
  var anthropicSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;"><path fill="#d4b896" d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/></svg>';
  var openaiSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;"><path fill="#d4b896" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>';
  var googleSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle;"><path fill="#d4b896" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/></svg>';

  parts.push('<p style="color:#d4b896;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;margin:0 0 8px;text-align:center;">Founder · Reserved Access</p>');
  parts.push('<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 18px;text-align:center;">' + greeting + '</p>');
  parts.push('<h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#f5ecd9;text-align:center;line-height:1.25;">Your Founder seat is ready.</h2>');
  parts.push('<p style="color:#a89878;font-size:14px;line-height:1.7;margin:0 0 28px;text-align:center;">You\'re one of the first 100 chosen for early Founder access to RoweOS. As a thank you, your trial unlocks at <span style="color:#d4b896;font-weight:500;">half price for life</span>.</p>');

  // Coupon code card
  parts.push('<div style="background:linear-gradient(180deg,#1a1a1a,#0e0e0e);border:1px solid rgba(212,184,150,0.4);border-radius:14px;padding:24px;margin:0 0 24px;text-align:center;">');
  parts.push('<p style="color:#a89878;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Your Lifetime Discount Code</p>');
  parts.push('<div style="font-family:\'SF Mono\',Menlo,Monaco,Consolas,monospace;font-size:30px;font-weight:600;color:#d4b896;letter-spacing:6px;padding:14px 0;border-top:1px dashed rgba(212,184,150,0.3);border-bottom:1px dashed rgba(212,184,150,0.3);margin:0 0 12px;">Founder100</div>');
  parts.push('<p style="color:#ccc;font-size:13px;line-height:1.6;margin:0 0 4px;"><strong style="color:#fff;">50% off, locked for life.</strong></p>');
  parts.push('<p style="color:#888;font-size:13px;margin:0;"><span style="text-decoration:line-through;color:#666;">$59/mo</span> &nbsp;→&nbsp; <span style="color:#d4b896;font-size:18px;font-weight:500;">$29.50/mo</span> &nbsp;forever</p>');
  parts.push('<p style="color:#666;font-size:11px;margin:14px 0 0;line-height:1.5;">Apply at checkout. Your 14 day free trial starts immediately. We don\'t charge until day 15. Limited to the first 100 Founder activations.</p>');
  parts.push('</div>');

  // CTA
  parts.push('<div style="text-align:center;margin:0 0 32px;">');
  parts.push('<a href="https://roweos.com/api/track-click?c=founder_offer&to=%2F" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#a89878,#d4b896);color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.5px;">Activate My Founder Trial</a>');
  parts.push('<p style="color:#666;font-size:11px;margin:10px 0 0;">Type <span style="color:#d4b896;">Founder100</span> at checkout to lock the discount.</p>');
  parts.push('</div>');

  // Vision
  parts.push('<div style="border-top:1px solid #2a2a2a;padding:28px 0 0;margin:0 0 24px;">');
  parts.push('<h3 style="margin:0 0 12px;font-family:Georgia,serif;font-size:20px;font-weight:400;color:#f5ecd9;">What you can build with RoweOS.</h3>');
  parts.push('<p style="color:#ccc;font-size:14px;line-height:1.75;margin:0 0 14px;">RoweOS is an operating system for the way you actually work. One workspace where your brand intelligence and your personal life sit side by side. Run five brands at once. Have an AI Strategy agent draft your quarter, a Marketing agent ship your social calendar, an Operations agent file your weekly review.</p>');
  parts.push('<p style="color:#ccc;font-size:14px;line-height:1.75;margin:0;">Then flip to LifeAI and have a Wellness Coach calendar your week, a Tax Copilot reconcile receipts, a Personal AI remember the names of your clients\' kids. One brain, two halves, no context switching.</p>');
  parts.push('</div>');

  // Powered by AI providers
  parts.push('<div style="background:#0e0e0e;border:1px solid #1e1e1e;border-radius:14px;padding:22px 18px;margin:0 0 24px;text-align:center;">');
  parts.push('<p style="color:#888;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;margin:0 0 14px;">Powered by</p>');
  parts.push('<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;width:100%;max-width:440px;"><tr>');
  parts.push(providerCell('Anthropic', 'Opus 4.7', anthropicSvg));
  parts.push(providerCell('OpenAI', 'GPT-5.5', openaiSvg));
  parts.push(providerCell('Google', 'Gemini 3.1', googleSvg));
  parts.push('</tr></table>');
  parts.push('<p style="color:#666;font-size:11.5px;margin:14px 0 0;line-height:1.5;">Claude · Opus 4.7, Sonnet 4.6 · GPT-5.5 family + High Reasoning · Gemini 3.1 Pro · Nano Banana 3 Pro · Imagen 4 · Veo 3.1</p>');
  parts.push('</div>');

  // API key invitation
  parts.push('<div style="background:linear-gradient(180deg,rgba(168,152,120,0.07),rgba(168,152,120,0.02));border:1px solid rgba(168,152,120,0.22);border-radius:14px;padding:22px 24px;margin:0 0 24px;">');
  parts.push('<p style="color:#a89878;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">Optional Add-on</p>');
  parts.push('<h3 style="margin:0 0 8px;font-family:Georgia,serif;font-size:18px;font-weight:400;color:#f5ecd9;">Skip the API key setup.</h3>');
  parts.push('<p style="color:#ccc;font-size:13.5px;line-height:1.65;margin:0 0 14px;">RoweOS routes to OpenAI, Anthropic, and Google. You can bring your own API keys, or buy a Rowe managed key pack with a single charge so you can start running operations the moment your trial activates. No monthly billing, no provider accounts to set up.</p>');
  parts.push('<a href="https://roweos.com/purchase" style="display:inline-block;padding:11px 22px;background:rgba(168,152,120,0.15);border:1px solid rgba(168,152,120,0.45);border-radius:9px;color:#d4b896;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.3px;">Browse API Key Packs &rarr;</a>');
  parts.push('</div>');

  // Google for Startups
  parts.push('<div style="text-align:center;padding:18px 16px;background:#0e0e0e;border:1px solid #1e1e1e;border-radius:12px;margin:0 0 24px;">');
  parts.push('<p style="color:#666;font-size:10.5px;letter-spacing:1.8px;text-transform:uppercase;margin:0 0 8px;">Backed by</p>');
  parts.push('<p style="font-family:Georgia,serif;font-size:17px;color:#d4b896;margin:0;">Google for Startups</p>');
  parts.push('<p style="color:#888;font-size:11.5px;margin:6px 0 0;line-height:1.5;max-width:380px;margin-left:auto;margin-right:auto;">RoweOS is part of the Google for Startups Cloud Program. Supported infrastructure, vetted product, real builders.</p>');
  parts.push('</div>');

  // Closing
  parts.push('<p style="color:#888;font-size:13px;line-height:1.7;margin:0 0 8px;">Reply to this email if you want a 1:1 walkthrough. Happy to demo the Founder workflow live.</p>');
  parts.push('<p style="color:#888;font-size:13px;line-height:1.7;margin:0;">Jordan, founder of The Rowe Collection</p>');

  return {
    subject: 'Your Founder Lifetime Discount. RoweOS is ready.',
    html: wrapEmail('Founder · Lifetime Offer', parts.join('\n'))
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
    case 'subscription_info':
      return buildSubscriptionInfo(userName);
    case 'founder_lifetime_offer':
      return buildFounderLifetimeOffer(userName);
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
      return false;
    }
    return true;
  } catch (err) {
    console.error('[send-template-email] Firestore log error:', err.message);
    return false;
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
    var validTemplates = ['onboarding_survey', 'reengagement', 'feature_announcement', 'access_key_delivery', 'checkin', 'subscription_info'];
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
        // v31.2: BCC roweos@therowecollection.com when recipient name is unknown,
        // so Jordan can audit what's actually delivered for unnamed signups.
        var _isUnknownRecipient = !userName || !String(userName).trim() || /^unknown$/i.test(String(userName).trim());
        var _payload = {
          from: 'RoweOS <roweos@therowecollection.com>',
          reply_to: 'jordan@therowecollection.com',
          to: [userEmail],
          subject: emailData.subject,
          html: emailData.html
        };
        if (_isUnknownRecipient) {
          _payload.bcc = ['roweos@therowecollection.com'];
        }
        var resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(_payload)
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
    var logged = false;
    if (projectId) {
      logged = await writeEmailLog(projectId, accessToken, {
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
        subject: emailData.subject,
        logged: logged
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
