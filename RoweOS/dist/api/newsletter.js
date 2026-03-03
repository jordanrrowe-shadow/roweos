// v22.4: Newsletter signup API — stores subscribers, generates access keys, sends typed emails
// POST { email, name?, source?, type?, companyName? } → Firestore newsletter_subscribers + access_keys

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

// v22.4: Generate access key string (same format as client-side)
function generateAccessKeyString() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
  var key = 'ROWE-';
  for (var i = 0; i < 4; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  key += '-';
  for (var j = 0; j < 4; j++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// v20.17: Original newsletter welcome email (waitlist)
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
    + '<p style="margin:0;font-size:16px;line-height:1.7;color:' + dimText + ';max-width:440px;display:inline-block;">You\'re now on the list for early access to RoweOS, a private AI platform for managing your brands and your life from a single, elegant interface.</p>'
    + '</td></tr>'

    // Divider
    + '<tr><td style="padding:0 0 40px;"><div style="height:1px;background:linear-gradient(to right,' + bg + ',' + borderColor + ',' + bg + ');"></div></td></tr>'

    // What is RoweOS
    + '<tr><td style="padding:0 0 32px;">'
    + '<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + gold + ';">What is RoweOS</p>'
    + '<h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:normal;color:' + textColor + ';">Operating Intelligence, Built for Brands</h2>'
    + '<p style="margin:0;font-size:15px;line-height:1.7;color:' + dimText + ';">RoweOS is not a chatbot. It\'s a unified intelligence platform that thinks in terms of brands, coaches, workflows, and outcomes. Every AI agent embodies your brand\'s identity, voice, and strategy, responding as an on-brand concierge that deeply understands who you are.</p>'
    + '</td></tr>'

    // Two Mode Cards
    + '<tr><td style="padding:0 0 32px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'

    // BrandAI Card
    + '<td width="48%" valign="top" style="padding-right:8px;">'
    + '<div style="background:' + cardBg + ';border:1px solid ' + borderColor + ';border-radius:12px;padding:24px 20px;">'
    + '<div style="width:36px;height:36px;border-radius:8px;background:' + gold + ';color:' + bg + ';font-family:Georgia,serif;font-size:18px;line-height:36px;text-align:center;margin-bottom:16px;">B</div>'
    + '<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:' + textColor + ';">BrandAI Mode</p>'
    + '<p style="margin:0;font-size:13px;line-height:1.6;color:' + dimText + ';">4 specialized agents: Strategy, Marketing, Operations, Documents, working in concert across your entire brand portfolio.</p>'
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
    + buildFeatureRow('Automated Workflows', 'Schedule AI-powered automations: content, social posts, reports, that run on your timeline.', gold, textColor, dimText, borderColor)
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

// v22.4: Individual welcome email — Solo tier, simple getting started
function buildIndividualWelcomeEmail(firstName, accessKey) {
  var gold = '#c4a882';
  var goldLight = '#f2dfc5';
  var bg = '#0a0a0a';
  var cardBg = '#141414';
  var borderColor = '#1e1e1e';
  var textColor = '#e8e4df';
  var dimText = '#8a857f';
  var greeting = firstName ? ('Welcome, ' + firstName) : 'Welcome';

  return '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
    + '<title>Welcome to RoweOS</title></head>'
    + '<body style="margin:0;padding:0;background-color:' + bg + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + bg + ';">'
    + '<tr><td align="center" style="padding:40px 16px 0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">'

    // Logo
    + '<tr><td align="center" style="padding:24px 0 40px;">'
    + '<span style="font-family:Georgia,\'Times New Roman\',serif;font-size:26px;font-weight:normal;letter-spacing:3px;color:' + gold + ';">ROWEOS</span>'
    + '</td></tr>'

    // Hero
    + '<tr><td style="padding:0 0 32px;text-align:center;">'
    + '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:32px;font-weight:normal;color:' + textColor + ';line-height:1.3;">' + greeting + '</h1>'
    + '<p style="margin:0;font-size:16px;line-height:1.7;color:' + dimText + ';max-width:440px;display:inline-block;">You\'ve been granted access to RoweOS Solo, your personal AI operating system for managing brands and life from a single, elegant interface.</p>'
    + '</td></tr>'

    // Divider
    + '<tr><td style="padding:0 0 32px;"><div style="height:1px;background:linear-gradient(to right,' + bg + ',' + borderColor + ',' + bg + ');"></div></td></tr>'

    // Access Key
    + '<tr><td style="padding:0 0 32px;">'
    + '<div style="background:' + cardBg + ';border:1px solid rgba(168,152,120,0.25);border-radius:12px;padding:24px;text-align:center;">'
    + '<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + gold + ';">Your Access Key</p>'
    + '<code style="font-size:24px;color:' + gold + ';letter-spacing:3px;font-weight:600;font-family:\'SF Mono\',Monaco,\'Courier New\',monospace;">' + accessKey + '</code>'
    + '<p style="margin:12px 0 0;font-size:12px;color:' + dimText + ';">Solo Tier: Full platform access</p>'
    + '</div>'
    + '</td></tr>'

    // Getting Started
    + '<tr><td style="padding:0 0 32px;">'
    + '<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + gold + ';">Getting Started</p>'
    + '<div style="background:' + cardBg + ';border:1px solid ' + borderColor + ';border-radius:12px;padding:20px;margin-top:12px;">'
    + '<ol style="line-height:2.2;color:' + dimText + ';margin:0;padding-left:20px;font-size:14px;">'
    + '<li>Go to <a href="https://roweos.com" style="color:' + gold + ';text-decoration:none;font-weight:500;">roweos.com</a></li>'
    + '<li>Create your account or sign in with Google</li>'
    + '<li>Open <strong style="color:' + textColor + ';">Settings</strong> and enter your Access Key above</li>'
    + '<li>Add your brand and start building with AI</li>'
    + '</ol>'
    + '</div>'
    + '</td></tr>'

    // Divider
    + '<tr><td style="padding:0 0 32px;"><div style="height:1px;background:linear-gradient(to right,' + bg + ',' + borderColor + ',' + bg + ');"></div></td></tr>'

    // What you get
    + '<tr><td style="padding:0 0 32px;">'
    + '<p style="margin:0 0 16px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + gold + ';">What You Get</p>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    + buildFeatureRow('AI Agents', '4 specialized agents (Strategy, Marketing, Operations, Documents) that embody your brand\'s voice.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('150+ Operations', 'Pre-built templates for content, strategy, client intake, and more.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Cloud Sync', 'Secure cross-device sync for all your data, conversations, and settings.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Automations', 'Schedule AI workflows that run on your timeline: content, social posts, reports.', gold, textColor, dimText, borderColor)
    + '</table>'
    + '</td></tr>'

    // Footer
    + '<tr><td style="padding:32px 0 48px;text-align:center;border-top:1px solid ' + borderColor + ';">'
    + '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:18px;letter-spacing:2px;color:' + gold + ';">ROWEOS</p>'
    + '<p style="margin:0 0 16px;font-size:12px;color:' + dimText + ';">Operating intelligence, built for brands.</p>'
    + '<p style="margin:0;font-size:11px;color:rgba(138,133,127,0.5);">The Rowe Collection LLC &middot; Austin, Texas</p>'
    + '<p style="margin:12px 0 0;font-size:11px;"><a href="https://roweos.com" style="color:' + dimText + ';text-decoration:none;">roweos.com</a> &middot; <a href="mailto:jordan@therowecollection.com" style="color:' + dimText + ';text-decoration:none;">Contact</a></p>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';
}

// v22.4: Company welcome email — Founder tier, company branding, admin guidance
function buildCompanyWelcomeEmail(firstName, accessKey, companyName) {
  var gold = '#c4a882';
  var goldLight = '#f2dfc5';
  var bg = '#0a0a0a';
  var cardBg = '#141414';
  var borderColor = '#1e1e1e';
  var textColor = '#e8e4df';
  var dimText = '#8a857f';
  var greeting = firstName ? ('Welcome, ' + firstName) : 'Welcome';
  var coName = companyName || 'Your Company';

  return '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
    + '<title>Welcome to RoweOS: ' + coName + '</title></head>'
    + '<body style="margin:0;padding:0;background-color:' + bg + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + bg + ';">'
    + '<tr><td align="center" style="padding:40px 16px 0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">'

    // Logo
    + '<tr><td align="center" style="padding:24px 0 16px;">'
    + '<span style="font-family:Georgia,\'Times New Roman\',serif;font-size:26px;font-weight:normal;letter-spacing:3px;color:' + gold + ';">ROWEOS</span>'
    + '</td></tr>'

    // Company badge
    + '<tr><td align="center" style="padding:0 0 40px;">'
    + '<div style="display:inline-block;padding:6px 20px;background:rgba(168,152,120,0.1);border:1px solid rgba(168,152,120,0.2);border-radius:20px;">'
    + '<span style="font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:' + gold + ';">' + coName + '</span>'
    + '</div>'
    + '</td></tr>'

    // Hero
    + '<tr><td style="padding:0 0 32px;text-align:center;">'
    + '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:32px;font-weight:normal;color:' + textColor + ';line-height:1.3;">' + greeting + '</h1>'
    + '<p style="margin:0;font-size:16px;line-height:1.7;color:' + dimText + ';max-width:440px;display:inline-block;">You\'ve been granted Founder access to RoweOS for <strong style="color:' + textColor + ';">' + coName + '</strong> , a private AI operating system for managing your brands, team, and operations from a single platform.</p>'
    + '</td></tr>'

    // Divider
    + '<tr><td style="padding:0 0 32px;"><div style="height:1px;background:linear-gradient(to right,' + bg + ',' + borderColor + ',' + bg + ');"></div></td></tr>'

    // Access Key
    + '<tr><td style="padding:0 0 32px;">'
    + '<div style="background:' + cardBg + ';border:1px solid rgba(168,152,120,0.25);border-radius:12px;padding:24px;text-align:center;">'
    + '<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + gold + ';">Your Access Key</p>'
    + '<code style="font-size:24px;color:' + gold + ';letter-spacing:3px;font-weight:600;font-family:\'SF Mono\',Monaco,\'Courier New\',monospace;">' + accessKey + '</code>'
    + '<p style="margin:12px 0 0;font-size:12px;color:' + dimText + ';">Founder Tier: Full platform + advanced features</p>'
    + '</div>'
    + '</td></tr>'

    // Admin Setup
    + '<tr><td style="padding:0 0 32px;">'
    + '<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + gold + ';">Admin Setup</p>'
    + '<div style="background:' + cardBg + ';border:1px solid ' + borderColor + ';border-radius:12px;padding:20px;margin-top:12px;">'
    + '<ol style="line-height:2.2;color:' + dimText + ';margin:0;padding-left:20px;font-size:14px;">'
    + '<li>Go to <a href="https://roweos.com" style="color:' + gold + ';text-decoration:none;font-weight:500;">roweos.com</a> and create your account</li>'
    + '<li>Open <strong style="color:' + textColor + ';">Settings</strong> and enter your Access Key</li>'
    + '<li>Set up your company brand in <strong style="color:' + textColor + ';">Identity</strong> (name, logo, colors, voice)</li>'
    + '<li>Configure your AI agents and operations in <strong style="color:' + textColor + ';">Studio</strong></li>'
    + '<li>Connect social accounts in <strong style="color:' + textColor + ';">Settings &gt; Social</strong></li>'
    + '</ol>'
    + '</div>'
    + '</td></tr>'

    // Team invitation
    + '<tr><td style="padding:0 0 32px;">'
    + '<div style="background:rgba(168,152,120,0.06);border:1px solid rgba(168,152,120,0.15);border-radius:12px;padding:20px;">'
    + '<p style="margin:0 0 8px;font-size:14px;font-weight:500;color:' + textColor + ';">Inviting Team Members</p>'
    + '<p style="margin:0;font-size:13px;line-height:1.6;color:' + dimText + ';">As a Founder, you can share your brand configuration with team members. Use the <strong style="color:' + textColor + ';">Share Brand</strong> button in Identity to generate a join link. Team members will need their own RoweOS accounts and access keys.</p>'
    + '</div>'
    + '</td></tr>'

    // Divider
    + '<tr><td style="padding:0 0 32px;"><div style="height:1px;background:linear-gradient(to right,' + bg + ',' + borderColor + ',' + bg + ');"></div></td></tr>'

    // Founder perks
    + '<tr><td style="padding:0 0 32px;">'
    + '<p style="margin:0 0 16px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:' + gold + ';">Founder Features</p>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    + buildFeatureRow('Multi-Brand Portfolio', 'Manage multiple brands from one interface, each with its own identity, voice, and agents.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Brand Config Sharing', 'Share your brand setup with team members via secure join links.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Automated Workflows', 'Schedule AI-powered automations for content, social, and operations.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Social Publishing', 'Connect and publish to X, Threads, and Instagram directly.', gold, textColor, dimText, borderColor)
    + buildFeatureRow('Analytics & Identity', 'Deep brand analytics, usage tracking, and AI-powered identity intelligence.', gold, textColor, dimText, borderColor)
    + '</table>'
    + '</td></tr>'

    // Footer
    + '<tr><td style="padding:32px 0 48px;text-align:center;border-top:1px solid ' + borderColor + ';">'
    + '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:18px;letter-spacing:2px;color:' + gold + ';">ROWEOS</p>'
    + '<p style="margin:0 0 16px;font-size:12px;color:' + dimText + ';">Operating intelligence, built for brands.</p>'
    + '<p style="margin:0;font-size:11px;color:rgba(138,133,127,0.5);">The Rowe Collection LLC &middot; Austin, Texas</p>'
    + '<p style="margin:12px 0 0;font-size:11px;"><a href="https://roweos.com" style="color:' + dimText + ';text-decoration:none;">roweos.com</a> &middot; <a href="mailto:jordan@therowecollection.com" style="color:' + dimText + ';text-decoration:none;">Contact</a></p>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';
}

export default async function handler(req, res) {
  // CORS
  var origin = req.headers.origin || '';
  var allowed = ['https://roweos.vercel.app', 'https://roweos.com', 'https://www.roweos.com', 'https://roweoswebsite.vercel.app', 'https://roweos.website', 'https://www.roweos.website'];
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
    // v22.4: New fields for typed signups
    var signupType = (body.type || 'individual').trim().toLowerCase();
    var companyName = (body.companyName || '').trim();

    // Validate email
    if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // v22.4: Validate company name for company signups
    if (signupType === 'company' && !companyName) {
      return res.status(400).json({ error: 'Company name is required for company signups' });
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
      // Already exists — don't overwrite or re-generate
      return res.status(200).json({ success: true, message: "You're already on the list!" });
    }

    // v22.4: Generate access key
    var tier = signupType === 'company' ? 'founder' : 'solo';
    var accessKeyString = generateAccessKeyString();

    // Write access key to Firestore
    var keyDocPath = baseUrl + '/access_keys/' + accessKeyString;
    var keyFields = {
      status: { stringValue: 'active' },
      tier: { stringValue: tier },
      createdAt: { stringValue: new Date().toISOString() },
      usedBy: { nullValue: null },
      usedAt: { nullValue: null },
      email: { stringValue: email },
      note: { stringValue: signupType === 'company' ? ((source === 'info_page' ? 'Info Page' : 'Newsletter') + ' signup: ' + companyName) : ((source === 'info_page' ? 'Info Page' : 'Newsletter') + ' signup') },
      source: { stringValue: 'newsletter_auto' }
    };

    var keyResp = await fetch(keyDocPath, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: keyFields })
    });

    if (!keyResp.ok) {
      console.warn('[Newsletter] Access key write failed:', keyResp.status);
    }

    // Write new subscriber (with access key + type info)
    var fields = {
      email: { stringValue: email },
      name: { stringValue: name },
      source: { stringValue: source },
      subscribedAt: { stringValue: new Date().toISOString() },
      status: { stringValue: 'active' },
      type: { stringValue: signupType },
      tier: { stringValue: tier },
      accessKey: { stringValue: accessKeyString }
    };
    if (companyName) {
      fields.companyName = { stringValue: companyName };
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
      console.error('[Newsletter] Firestore write failed:', writeResp.status, errText.substring(0, 300));
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    console.log('[Newsletter] New subscriber:', email, 'type:', signupType, 'tier:', tier, 'key:', accessKeyString);

    // v22.4: Send typed welcome email via Resend
    var resendKey = (process.env.RESEND_API_KEY || '').trim();
    if (resendKey) {
      try {
        var firstName = name ? name.split(' ')[0] : '';
        var emailHtml, emailSubject;

        if (signupType === 'company') {
          emailHtml = buildCompanyWelcomeEmail(firstName, accessKeyString, companyName);
          emailSubject = 'Welcome to RoweOS Founder: ' + companyName + ' Access Key';
        } else {
          emailHtml = buildIndividualWelcomeEmail(firstName, accessKeyString);
          emailSubject = 'Welcome to RoweOS Solo: Your Access Key';
        }

        var emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + resendKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'RoweOS <roweos@therowecollection.com>',
            to: [email],
            subject: emailSubject,
            html: emailHtml
          })
        });
        if (emailResp.ok) {
          console.log('[Newsletter] Welcome email sent to:', email, '(' + signupType + ')');
        } else {
          var emailErr = await emailResp.text().catch(function() { return ''; });
          console.warn('[Newsletter] Resend failed:', emailResp.status, emailErr.substring(0, 200));
        }
      } catch(emailErr) {
        console.warn('[Newsletter] Email send error (non-fatal):', emailErr.message);
      }
    }

    // v22.4: Admin push notification (non-fatal)
    var adminUid = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';
    try {
      var sourceLabel = source === 'info_page' ? 'Info' : 'Newsletter';
      var pushTitle = 'New Signup (' + sourceLabel + '): ' + (signupType === 'company' ? companyName : (name || email));
      var pushBody = (signupType === 'company' ? 'Company' : 'Individual') + ' | ' + email + ' | ' + tier + ' key: ' + accessKeyString;
      await fetch('https://roweos.com/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          uid: adminUid,
          title: pushTitle,
          body: pushBody
        })
      });
    } catch(pushErr) {
      console.warn('[Newsletter] Push notification failed (non-fatal):', pushErr.message);
    }

    // v22.4: Write to admin_notifications for in-app visibility (non-fatal)
    try {
      var notifDocId = 'signup_' + docId + '_' + Date.now();
      var notifPath = baseUrl + '/admin_notifications/' + notifDocId;
      await fetch(notifPath, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            type: { stringValue: 'signup' },
            email: { stringValue: email },
            name: { stringValue: name },
            signupType: { stringValue: signupType },
            companyName: { stringValue: companyName },
            tier: { stringValue: tier },
            accessKey: { stringValue: accessKeyString },
            source: { stringValue: source },
            createdAt: { stringValue: new Date().toISOString() },
            read: { booleanValue: false }
          }
        })
      });
    } catch(notifErr) {
      console.warn('[Newsletter] Admin notification write failed (non-fatal):', notifErr.message);
    }

    var successMsg = signupType === 'company'
      ? "You're on the list! Check your email for your Founder access key."
      : "You're on the list! Check your email for your access key.";

    return res.status(200).json({ success: true, message: successMsg });

  } catch(err) {
    console.error('[Newsletter] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
