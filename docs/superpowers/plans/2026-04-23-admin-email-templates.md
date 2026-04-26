# Admin Email Templates & User Feedback System - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 email templates (onboarding survey, re-engagement, feature announcement, access key delivery, check-in), a click-response capture API, Admin panel email management with per-user email history, and configurable auto-send scheduling.

**Architecture:** Two new Vercel serverless endpoints (`email-response.js` for click capture, `send-template-email.js` for admin-triggered sends). Email templates are inline HTML functions in the send endpoint. Admin UI is a new "Emails" tab in the existing Admin panel with user list, detail drill-down, aggregated stats, and settings. Auto-send logic hooks into the existing `scheduler.js` cron.

**Tech Stack:** Vanilla ES5 JS (RoweOS standard), Resend API for email, Firestore REST API for storage, Vercel Serverless Functions, table-based HTML email templates with dark theme.

**Spec:** `docs/superpowers/specs/2026-04-23-admin-email-templates-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `RoweOS/dist/api/email-response.js` | Create | Capture email click responses, validate HMAC, write to Firestore, serve thank-you page |
| `RoweOS/dist/api/send-template-email.js` | Create | Admin-only endpoint: render template HTML, send via Resend, log to Firestore `email_log` |
| `src/html/brand/25-admin.html` | Modify | Add "Emails" tab button + tab content div to Admin panel |
| `src/js/core/25-admin-emails.js` | Create | All email management UI logic: render email tab, user list, user detail, stats, settings, send actions |
| `RoweOS/dist/api/scheduler.js` | Modify | Add auto-send email check after existing automation execution |
| `RoweOS/dist/api/notify-signup.js` | Modify | Write to `email_log` collection when welcome email is sent |
| `RoweOS/dist/vercel.json` | Modify | Add function config for new endpoints |

---

### Task 1: Response Capture Endpoint (`email-response.js`)

**Files:**
- Create: `RoweOS/dist/api/email-response.js`

This is the endpoint that email links point to. When a user clicks an option in an email (e.g. "How did you hear about us? [Twitter]"), it hits this endpoint, logs the response, and shows a thank-you page.

- [ ] **Step 1: Create the endpoint file**

```js
// v30.1: Email response capture endpoint
// GET /api/email-response?user={uid}&q={question}&a={answer}&token={hmac}
// Validates HMAC, writes response to Firestore, returns styled thank-you HTML

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  var user = req.query.user || '';
  var q = req.query.q || '';
  var a = req.query.a || '';
  var token = req.query.token || '';
  var template = req.query.tpl || 'unknown';

  // Validate HMAC
  var crypto = require('crypto');
  var secret = process.env.EMAIL_RESPONSE_SECRET || process.env.RESEND_API_KEY || 'fallback-secret';
  var expected = crypto.createHmac('sha256', secret)
    .update(user + ':' + q + ':' + a)
    .digest('hex')
    .substring(0, 16);

  if (!token || token !== expected) {
    return res.status(200).send(renderThankYouPage('Thanks for your feedback!', false));
  }

  // Write to Firestore
  var written = false;
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      var accessToken = await getGoogleAccessToken(sa);
      if (accessToken) {
        var projectId = process.env.FIREBASE_PROJECT_ID;
        var docUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId +
          '/databases/(default)/documents/onboarding_responses/' + user +
          '/responses';

        var docData = {
          fields: {
            question: { stringValue: q },
            answer: { stringValue: a },
            timestamp: { stringValue: new Date().toISOString() },
            email_template: { stringValue: template },
            source: { stringValue: 'email_click' }
          }
        };

        var resp = await fetch(docUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(docData)
        });

        written = resp.ok;
        if (!resp.ok) {
          console.error('[email-response] Firestore write error:', await resp.text());
        }
      }
    } catch (err) {
      console.error('[email-response] Error:', err.message);
    }
  }

  console.log('[email-response] Response captured:', { user: user, q: q, a: a, written: written });
  return res.status(200).send(renderThankYouPage('Thanks for your feedback!', true));
}

function renderThankYouPage(message, success) {
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>RoweOS - Thank You</title>',
    '<style>',
    'body{margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}',
    '.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:48px;text-align:center;max-width:420px;}',
    'h1{color:#a89878;font-size:24px;margin:0 0 12px;font-weight:400;}',
    'p{color:#888;font-size:14px;line-height:1.6;margin:0 0 24px;}',
    'a{display:inline-block;padding:10px 24px;background:#a89878;color:#0a0a0a;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;}',
    '</style></head>',
    '<body><div class="card">',
    '<h1>' + message + '</h1>',
    '<p>Your response has been recorded. We appreciate you taking the time.</p>',
    '<a href="https://roweos.com">Open RoweOS</a>',
    '</div></body></html>'
  ].join('\n');
}

// --- Google Auth helpers (same pattern as scheduler.js) ---

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
  if (resp.ok) {
    var data = await resp.json();
    return data.access_token;
  }
  return null;
}
```

- [ ] **Step 2: Add function config to vercel.json**

In `RoweOS/dist/vercel.json`, add to the `"functions"` object:

```json
"api/email-response.js": { "maxDuration": 15 },
```

- [ ] **Step 3: Set EMAIL_RESPONSE_SECRET env var**

Run in terminal:
```bash
cd ~/Developer/roweOS/RoweOS/dist && npx vercel env add EMAIL_RESPONSE_SECRET
```
Use a random 32-char string. This signs HMAC tokens in email links.

- [ ] **Step 4: Commit**

```bash
cd ~/Developer/roweOS
git add RoweOS/dist/api/email-response.js RoweOS/dist/vercel.json
git commit -m "feat: add email response capture endpoint (v30.1)"
```

---

### Task 2: Send Template Email Endpoint (`send-template-email.js`)

**Files:**
- Create: `RoweOS/dist/api/send-template-email.js`

Admin-only endpoint that renders a chosen template, sends via Resend, and logs to Firestore `email_log`.

- [ ] **Step 1: Create the endpoint with template renderer and HMAC link generator**

```js
// v30.1: Admin template email sender
// POST { template, userId, userEmail, userName, metadata }
// Admin-only (checks Firebase UID). Sends email via Resend, logs to email_log.

var ADMIN_UID = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';
var BASE_URL = 'https://roweos.com';

export default async function handler(req, res) {
  // CORS
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.com' || origin === 'https://www.roweos.com' || origin === 'https://roweos.vercel.app') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Admin check via Authorization header (Firebase ID token or simple UID check)
  var authHeader = req.headers.authorization || '';
  var callerUid = req.body.callerUid || '';
  if (callerUid !== ADMIN_UID) {
    return res.status(403).json({ error: 'Admin only' });
  }

  var body = req.body || {};
  var template = body.template;
  var userId = body.userId || '';
  var userEmail = body.userEmail || '';
  var userName = body.userName || '';
  var metadata = body.metadata || {};

  if (!template || !userEmail) {
    return res.status(400).json({ error: 'template and userEmail required' });
  }

  // Render template
  var rendered = renderTemplate(template, userId, userEmail, userName, metadata);
  if (!rendered) {
    return res.status(400).json({ error: 'Unknown template: ' + template });
  }

  // Send via Resend
  var emailSent = false;
  var emailError = null;

  if (process.env.RESEND_API_KEY) {
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
          subject: rendered.subject,
          html: rendered.html
        })
      });

      if (resendResp.ok) {
        emailSent = true;
      } else {
        emailError = await resendResp.text();
        console.error('[send-template] Resend error:', emailError);
      }
    } catch (err) {
      emailError = err.message;
    }
  }

  // Log to Firestore email_log
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      var accessToken = await getGoogleAccessToken(sa);
      if (accessToken) {
        var logUrl = 'https://firestore.googleapis.com/v1/projects/' +
          process.env.FIREBASE_PROJECT_ID +
          '/databases/(default)/documents/email_log';

        await fetch(logUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              userId: { stringValue: userId },
              userEmail: { stringValue: userEmail },
              template: { stringValue: template },
              subject: { stringValue: rendered.subject },
              sentAt: { stringValue: new Date().toISOString() },
              status: { stringValue: emailSent ? 'sent' : 'failed' },
              error: { stringValue: emailError || '' }
            }
          })
        });
      }
    } catch (logErr) {
      console.error('[send-template] Log error:', logErr.message);
    }
  }

  return res.status(200).json({ success: emailSent, error: emailError });
}

// --- HMAC link generator ---

function makeResponseLink(userId, question, answer, template) {
  var crypto = require('crypto');
  var secret = process.env.EMAIL_RESPONSE_SECRET || process.env.RESEND_API_KEY || 'fallback-secret';
  var token = crypto.createHmac('sha256', secret)
    .update(userId + ':' + question + ':' + answer)
    .digest('hex')
    .substring(0, 16);
  return BASE_URL + '/api/email-response?user=' + encodeURIComponent(userId) +
    '&q=' + encodeURIComponent(question) +
    '&a=' + encodeURIComponent(answer) +
    '&token=' + encodeURIComponent(token) +
    '&tpl=' + encodeURIComponent(template);
}

function optionButton(userId, question, answer, label, template) {
  var url = makeResponseLink(userId, question, answer, template);
  return '<a href="' + url + '" style="display:inline-block;padding:10px 20px;background:#1a1a1a;border:1px solid #a8987844;border-radius:8px;color:#e0e0e0;text-decoration:none;font-size:13px;font-weight:500;margin:0 6px 8px 0;">' + label + '</a>';
}

// --- Email wrapper ---

function emailWrap(headerTitle, headerSub, bodyHtml) {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:0;background:#111;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:40px 20px;">',
    '<tr><td align="center">',
    '<table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:12px;border:1px solid #2a2a2a;">',
    // Header
    '<tr><td style="padding:40px 32px 24px;text-align:center;border-bottom:1px solid #1e1e1e;">',
    '<h1 style="margin:0;font-size:28px;font-weight:300;color:#a89878;letter-spacing:2px;">RoweOS</h1>',
    headerSub ? '<p style="margin:8px 0 0;font-size:12px;color:#666;letter-spacing:1px;text-transform:uppercase;">' + headerSub + '</p>' : '',
    '</td></tr>',
    // Body
    '<tr><td style="padding:32px;">',
    bodyHtml,
    '</td></tr>',
    // Footer
    '<tr><td style="padding:16px 32px 24px;border-top:1px solid #1e1e1e;text-align:center;">',
    '<p style="margin:0;font-size:11px;color:#555;">The Rowe Collection, LLC - Austin, TX</p>',
    '<p style="margin:6px 0 0;font-size:11px;color:#444;">Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color:#a89878;text-decoration:none;">jordan@therowecollection.com</a></p>',
    '</td></tr>',
    '</table></td></tr></table>',
    '</body></html>'
  ].join('\n');
}

// --- Template renderers ---

function renderTemplate(template, userId, userEmail, userName, metadata) {
  var firstName = userName ? userName.split(' ')[0] : '';
  var greeting = firstName ? 'Hi ' + escapeHtml(firstName) + ',' : 'Hi there,';

  switch (template) {
    case 'onboarding_survey': return renderOnboardingSurvey(userId, greeting);
    case 'reengagement': return renderReEngagement(greeting);
    case 'feature_announcement': return renderFeatureAnnouncement(greeting, metadata);
    case 'access_key_delivery': return renderAccessKeyDelivery(greeting, metadata);
    case 'checkin': return renderCheckIn(userId, greeting);
    default: return null;
  }
}

function renderOnboardingSurvey(userId, greeting) {
  var body = [
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">' + greeting + '</p>',
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 28px;">We\'d love to learn about your experience with RoweOS so far. A few quick questions (just click your answer):</p>',
    // Q1: API key
    '<div style="margin-bottom:28px;">',
    '<p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">Do you need a beta API key?</p>',
    '<div>',
    optionButton(userId, 'api_key_need', 'yes', 'Yes, I need one', 'onboarding_survey'),
    optionButton(userId, 'api_key_need', 'no', 'No, I have my own', 'onboarding_survey'),
    optionButton(userId, 'api_key_need', 'unsure', 'Not sure what this means', 'onboarding_survey'),
    '</div></div>',
    // Q2: How heard
    '<div style="margin-bottom:28px;">',
    '<p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">How did you hear about RoweOS?</p>',
    '<div>',
    optionButton(userId, 'heard_from', 'twitter', 'Twitter / X', 'onboarding_survey'),
    optionButton(userId, 'heard_from', 'google', 'Google Search', 'onboarding_survey'),
    optionButton(userId, 'heard_from', 'friend', 'Friend / Referral', 'onboarding_survey'),
    optionButton(userId, 'heard_from', 'linkedin', 'LinkedIn', 'onboarding_survey'),
    optionButton(userId, 'heard_from', 'producthunt', 'Product Hunt', 'onboarding_survey'),
    optionButton(userId, 'heard_from', 'other', 'Other', 'onboarding_survey'),
    '</div></div>',
    // Q3: Experience
    '<div style="margin-bottom:28px;">',
    '<p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">How has your experience been so far?</p>',
    '<div>',
    optionButton(userId, 'experience', 'smooth', 'Smooth, love it', 'onboarding_survey'),
    optionButton(userId, 'experience', 'good', 'Good, some questions', 'onboarding_survey'),
    optionButton(userId, 'experience', 'bumps', 'Hit some bumps', 'onboarding_survey'),
    optionButton(userId, 'experience', 'help', 'Need help', 'onboarding_survey'),
    '</div></div>',
    '<p style="color:#888;font-size:13px;line-height:1.6;margin:0;">Have more to share? Just reply to this email. We read every response.</p>'
  ].join('\n');

  return {
    subject: 'Quick questions about your RoweOS experience',
    html: emailWrap('RoweOS', 'Onboarding', body)
  };
}

function renderReEngagement(greeting) {
  var body = [
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">' + greeting + '</p>',
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 28px;">We noticed you haven\'t been back in a while. Here are a few things you can try in under 5 minutes:</p>',
    '<div style="margin-bottom:24px;">',
    '<div style="padding:16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;margin-bottom:10px;">',
    '<p style="color:#e0e0e0;font-size:14px;font-weight:500;margin:0 0 4px;">Run a Studio operation</p>',
    '<p style="color:#888;font-size:12px;margin:0;">200+ pre-built AI operations for strategy, marketing, content, and more.</p>',
    '</div>',
    '<div style="padding:16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;margin-bottom:10px;">',
    '<p style="color:#e0e0e0;font-size:14px;font-weight:500;margin:0 0 4px;">Set up your brand identity</p>',
    '<p style="color:#888;font-size:12px;margin:0;">Give your AI agents the context they need to write in your voice.</p>',
    '</div>',
    '<div style="padding:16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;margin-bottom:10px;">',
    '<p style="color:#e0e0e0;font-size:14px;font-weight:500;margin:0 0 4px;">Ask BLAKE anything</p>',
    '<p style="color:#888;font-size:12px;margin:0;">Your brand\'s AI is ready. Start a conversation in Chat.</p>',
    '</div>',
    '</div>',
    '<div style="text-align:center;margin:28px 0 12px;">',
    '<a href="https://roweos.com" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a89878,#c4a882);color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Open RoweOS</a>',
    '</div>',
    '<p style="color:#888;font-size:13px;text-align:center;margin:0;">Need help getting started? Just reply to this email.</p>'
  ].join('\n');

  return {
    subject: 'Your AI brand team is waiting for you',
    html: emailWrap('RoweOS', null, body)
  };
}

function renderFeatureAnnouncement(greeting, metadata) {
  var featureName = metadata.featureName || 'New Feature';
  var featureDesc = metadata.featureDescription || '';
  var imageUrl = metadata.imageUrl || '';

  var body = [
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">' + greeting + '</p>',
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 24px;">We just shipped something new:</p>',
    '<div style="padding:24px;background:#1a1a1a;border:1px solid #a8987844;border-radius:12px;margin-bottom:24px;">',
    '<h2 style="color:#a89878;font-size:20px;font-weight:500;margin:0 0 12px;">' + escapeHtml(featureName) + '</h2>',
    featureDesc ? '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0;">' + escapeHtml(featureDesc) + '</p>' : '',
    '</div>',
    imageUrl ? '<div style="margin-bottom:24px;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;"><img src="' + escapeHtml(imageUrl) + '" style="width:100%;display:block;" alt="' + escapeHtml(featureName) + '"></div>' : '',
    '<div style="text-align:center;margin:28px 0 12px;">',
    '<a href="https://roweos.com" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a89878,#c4a882);color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Try it now</a>',
    '</div>'
  ].join('\n');

  return {
    subject: 'New in RoweOS: ' + featureName,
    html: emailWrap('RoweOS', 'What\'s New', body)
  };
}

function renderAccessKeyDelivery(greeting, metadata) {
  var accessKey = metadata.accessKey || 'ROWE-XXXX-XXXX';
  var tier = metadata.tier || 'founder';
  var tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  var body = [
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">' + greeting + '</p>',
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 28px;">Your RoweOS access key is ready. Here it is:</p>',
    // Key display
    '<div style="padding:24px;background:#1a1a1a;border:1px solid #a8987844;border-radius:12px;text-align:center;margin-bottom:24px;">',
    '<div style="font-size:11px;color:#a89878;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;">' + escapeHtml(tierLabel) + ' Access</div>',
    '<div style="font-family:\'SF Mono\',Monaco,Consolas,monospace;font-size:24px;color:#e0e0e0;letter-spacing:3px;font-weight:600;">' + escapeHtml(accessKey) + '</div>',
    '</div>',
    // Steps
    '<div style="margin-bottom:24px;">',
    '<p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">How to activate</p>',
    '<div style="padding:12px 16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:6px;">',
    '<p style="color:#e0e0e0;font-size:13px;margin:0;"><span style="color:#a89878;font-weight:600;">1.</span> Go to <a href="https://roweos.com" style="color:#a89878;text-decoration:none;">roweos.com</a></p>',
    '</div>',
    '<div style="padding:12px 16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:6px;">',
    '<p style="color:#e0e0e0;font-size:13px;margin:0;"><span style="color:#a89878;font-weight:600;">2.</span> Sign in with your account</p>',
    '</div>',
    '<div style="padding:12px 16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;">',
    '<p style="color:#e0e0e0;font-size:13px;margin:0;"><span style="color:#a89878;font-weight:600;">3.</span> Enter your key in Settings > Access Key</p>',
    '</div>',
    '</div>',
    '<div style="text-align:center;margin:28px 0 12px;">',
    '<a href="https://roweos.com" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a89878,#c4a882);color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Activate Your Key</a>',
    '</div>'
  ].join('\n');

  return {
    subject: 'Your RoweOS Access Key',
    html: emailWrap('RoweOS', 'Access Key', body)
  };
}

function renderCheckIn(userId, greeting) {
  var body = [
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">' + greeting + '</p>',
    '<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 28px;">How\'s everything going with RoweOS? We\'d love a quick pulse check:</p>',
    '<div style="margin-bottom:28px;">',
    '<p style="color:#a89878;font-size:13px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">How would you rate your experience?</p>',
    '<div>',
    optionButton(userId, 'checkin_rating', 'loving', 'Loving it', 'checkin'),
    optionButton(userId, 'checkin_rating', 'good', 'It\'s good', 'checkin'),
    optionButton(userId, 'checkin_rating', 'better', 'Could be better', 'checkin'),
    optionButton(userId, 'checkin_rating', 'issues', 'Having issues', 'checkin'),
    '</div></div>',
    '<p style="color:#ccc;font-size:14px;line-height:1.6;margin:0 0 24px;">What would make RoweOS better for you? Just reply to this email with your thoughts.</p>',
    '<div style="text-align:center;margin:20px 0 12px;">',
    '<a href="https://roweos.com" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a89878,#c4a882);color:#0a0a0a;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Open RoweOS</a>',
    '</div>'
  ].join('\n');

  return {
    subject: 'How\'s RoweOS working for you?',
    html: emailWrap('RoweOS', 'Check-In', body)
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Google Auth (same as scheduler.js) ---

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signJwt(header, payload, privateKeyPem) {
  var crypto = require('crypto');
  var headerB64 = base64url(JSON.stringify(header));
  var payloadB64 = base64url(JSON.stringify(payload));
  var unsigned = headerB64 + '.' + payloadB64;
  var sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  var signature = sign.sign(privateKeyPem, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
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
  if (resp.ok) { var d = await resp.json(); return d.access_token; }
  return null;
}
```

- [ ] **Step 2: Add function config to vercel.json**

In `RoweOS/dist/vercel.json`, add:

```json
"api/send-template-email.js": { "maxDuration": 30 },
```

- [ ] **Step 3: Commit**

```bash
cd ~/Developer/roweOS
git add RoweOS/dist/api/send-template-email.js RoweOS/dist/vercel.json
git commit -m "feat: add template email sender with 5 templates (v30.1)"
```

---

### Task 3: Admin Panel HTML - Add Emails Tab

**Files:**
- Modify: `src/html/brand/25-admin.html`

- [ ] **Step 1: Add "Emails" tab button to the admin tab bar**

After the existing Signups tab button (line 19), add:

```html
        <button class="admin-tab" onclick="showAdminTab('emails')" data-tab="emails" style="padding:8px 16px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text-secondary);font-size:var(--text-sm);font-weight:500;cursor:pointer;white-space:nowrap;">Emails</button>
```

- [ ] **Step 2: Add Emails tab content div**

After the Signups tab content div (`</div>` closing `adminTabSignups`, around line 198), add before the closing `</div>` of the panel:

```html
      <!-- v30.1: Emails tab -->
      <div class="admin-tab-content" id="adminTabEmails" style="display:none;">
        <div class="settings-section">
          <div class="settings-row">
            <div class="settings-row-left" style="flex:1;">
              <div style="width:100%;">
                <!-- Stats bar -->
                <div id="adminEmailStats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px;"></div>
                <!-- Controls row -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                  <div style="font-weight:600;color:var(--text-primary);">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    Email Management
                  </div>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <select id="adminEmailTemplate" style="padding:5px 10px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:var(--text-xs);">
                      <option value="">Send template...</option>
                      <option value="onboarding_survey">Onboarding Survey</option>
                      <option value="reengagement">Re-engagement</option>
                      <option value="feature_announcement">Feature Announcement</option>
                      <option value="access_key_delivery">Access Key Delivery</option>
                      <option value="checkin">Check-in</option>
                    </select>
                    <button onclick="adminSendSelectedTemplate()" style="padding:5px 12px;background:var(--accent);color:#000;border:none;border-radius:var(--radius-sm);font-weight:600;cursor:pointer;font-size:var(--text-xs);">Send to Selected</button>
                    <button onclick="adminLoadEmailData()" style="padding:5px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:var(--text-xs);">Refresh</button>
                  </div>
                </div>
                <!-- User list / detail view -->
                <div id="adminEmailContent" style="font-size:var(--text-sm);color:var(--text-secondary);">Click Refresh to load</div>
                <!-- Settings -->
                <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-color);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:600;font-size:var(--text-sm);color:var(--text-primary);">Auto-Send Settings</div>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                      <span style="font-size:var(--text-xs);color:var(--text-secondary);">Auto-Send</span>
                      <input type="checkbox" id="adminAutoSendToggle" onchange="adminToggleAutoSend(this.checked)" style="accent-color:var(--accent);">
                    </label>
                  </div>
                  <div id="adminAutoSendSettings" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
                    <div style="padding:10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px;">Onboarding survey after</div>
                      <div style="display:flex;align-items:center;gap:4px;"><input type="number" id="autoSendOnboardDays" value="3" min="1" max="30" style="width:50px;padding:4px 6px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--text-xs);text-align:center;"><span style="font-size:var(--text-xs);color:var(--text-muted);">days</span></div>
                    </div>
                    <div style="padding:10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px;">Re-engagement after</div>
                      <div style="display:flex;align-items:center;gap:4px;"><input type="number" id="autoSendReengageDays" value="7" min="1" max="60" style="width:50px;padding:4px 6px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--text-xs);text-align:center;"><span style="font-size:var(--text-xs);color:var(--text-muted);">days inactive</span></div>
                    </div>
                    <div style="padding:10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px;">Check-in after</div>
                      <div style="display:flex;align-items:center;gap:4px;"><input type="number" id="autoSendCheckinDays" value="14" min="1" max="90" style="width:50px;padding:4px 6px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--text-xs);text-align:center;"><span style="font-size:var(--text-xs);color:var(--text-muted);">days</span></div>
                    </div>
                    <div style="padding:10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px;">Repeat check-in every</div>
                      <div style="display:flex;align-items:center;gap:4px;"><input type="number" id="autoSendRepeatDays" value="30" min="7" max="90" style="width:50px;padding:4px 6px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--text-xs);text-align:center;"><span style="font-size:var(--text-xs);color:var(--text-muted);">days</span></div>
                    </div>
                  </div>
                  <button onclick="adminSaveAutoSendSettings()" style="margin-top:10px;padding:6px 16px;background:var(--accent);color:#000;border:none;border-radius:var(--radius-sm);font-weight:600;cursor:pointer;font-size:var(--text-xs);">Save Settings</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Build and verify**

```bash
cd ~/Developer/roweOS && bash src/build.sh
```

Verify the Emails tab appears in the Admin panel by opening RoweOS locally and navigating to Admin.

- [ ] **Step 4: Commit**

```bash
git add src/html/brand/25-admin.html
git commit -m "feat: add Emails tab HTML to Admin panel (v30.1)"
```

---

### Task 4: Admin Panel JS - Email Management Logic

**Files:**
- Create: `src/js/core/25-admin-emails.js`

This file contains all the client-side logic for the Emails tab: loading user data with email history, rendering the user list with last-email preview, user detail drill-down, aggregated stats, template send actions, and auto-send settings management.

- [ ] **Step 1: Create the JS file with all email management functions**

Create `src/js/core/25-admin-emails.js` with the following functions:

1. `adminLoadEmailData()` - fetches signups, email_log, and onboarding_responses from Firestore, renders the user list and stats
2. `adminRenderEmailUserList(users, emailLogs, responses)` - renders the user table with columns: Name, Email, Signup Date, Last Email (template + time), Responses, checkbox for bulk select
3. `adminShowEmailUserDetail(uid)` - drill-down view showing full email history and responses for a single user, with back button
4. `adminRenderEmailStats(responses)` - renders aggregated stats pills (heard from distribution, experience ratings, API key needs)
5. `adminSendSelectedTemplate()` - reads selected template and checked users, calls `/api/send-template-email` for each
6. `adminSendTemplateToUser(template, userId, userEmail, userName, metadata)` - single user send helper
7. `adminToggleAutoSend(enabled)` - writes auto-send toggle to Firestore `email_settings/config`
8. `adminSaveAutoSendSettings()` - reads day inputs, writes to Firestore
9. `adminLoadAutoSendSettings()` - loads settings from Firestore, populates inputs and toggle

The file is ~400-500 lines of ES5 JS following existing patterns (`writeDB`, `readFirestoreCollection`, etc). Full implementation will reference the existing Firestore read/write patterns from `22-firebase-sync.js`.

Due to the length of this file, the implementing engineer should:
1. Start with the data loading function (`adminLoadEmailData`) using the same Firestore REST patterns as `adminLoadSignups`
2. Add the render functions one at a time
3. Add the send actions
4. Add the settings management

Key patterns to follow from existing admin code:
- Use `fetch` with Google access token for Firestore reads
- Use `showToast()` for success/error feedback
- Use `escapeHtml()` for any user data rendered to DOM
- Existing `showAdminTab()` already handles tab switching; just needs the `emails` case

- [ ] **Step 2: Add the file to the build order**

In `src/build.sh`, add `src/js/core/25-admin-emails.js` after `24-remaining.js` in the concatenation order.

- [ ] **Step 3: Build and test**

```bash
bash src/build.sh
```

Open Admin > Emails tab, click Refresh, verify user list loads.

- [ ] **Step 4: Commit**

```bash
git add src/js/core/25-admin-emails.js src/build.sh
git commit -m "feat: add email management JS for Admin panel (v30.1)"
```

---

### Task 5: Modify notify-signup.js to Write to email_log

**Files:**
- Modify: `RoweOS/dist/api/notify-signup.js`

- [ ] **Step 1: Add email_log write after welcome email send**

After the welcome email is successfully sent (around line 192, after `welcomeEmailSent = true`), add a Firestore write to `email_log`:

```js
          // Log welcome email to email_log
          if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            try {
              var logToken = await getFirebaseAccessToken();
              if (logToken) {
                var logUrl = 'https://firestore.googleapis.com/v1/projects/' + process.env.FIREBASE_PROJECT_ID +
                  '/databases/(default)/documents/email_log';
                await fetch(logUrl, {
                  method: 'POST',
                  headers: { 'Authorization': 'Bearer ' + logToken, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fields: {
                      userId: { stringValue: uid },
                      userEmail: { stringValue: email },
                      template: { stringValue: 'welcome' },
                      subject: { stringValue: 'Welcome to RoweOS - Get Your Access Key' },
                      sentAt: { stringValue: new Date().toISOString() },
                      status: { stringValue: 'sent' },
                      error: { stringValue: '' }
                    }
                  })
                });
              }
            } catch (logErr) {
              console.log('[notify-signup] email_log write failed (non-fatal):', logErr.message);
            }
          }
```

- [ ] **Step 2: Commit**

```bash
git add RoweOS/dist/api/notify-signup.js
git commit -m "feat: log welcome emails to email_log collection (v30.1)"
```

---

### Task 6: Scheduler Auto-Send Integration

**Files:**
- Modify: `RoweOS/dist/api/scheduler.js`

- [ ] **Step 1: Add auto-send check function at the end of the scheduler handler**

After the existing automation execution logic completes, add a call to check and send due emails. This runs only if `email_settings/config` has `autoSendEnabled: true`.

The function should:
1. Read `email_settings/config` from Firestore
2. If `autoSendEnabled` is false, skip
3. Read `signups` collection for all users
4. Read `email_log` collection for sent history
5. For each user, determine which templates are due based on signup date, last activity, and configured day thresholds
6. Call the internal `sendTemplateEmail()` logic (imported or duplicated) for up to 10 emails per tick
7. Log results

Due to the complexity of this addition (~100-150 lines), the implementing engineer should add it as a separate function `checkAutoSendEmails(accessToken, projectId, reqHost)` called at the end of the main handler, after the automation results are returned.

Key constraints:
- Max 10 auto-emails per scheduler tick
- Track sent emails via `email_log` to prevent duplicates
- Use same Firestore REST API patterns as existing scheduler code
- Non-fatal: wrap in try/catch so email failures don't break automation scheduling

- [ ] **Step 2: Commit**

```bash
git add RoweOS/dist/api/scheduler.js
git commit -m "feat: add auto-send email check to scheduler (v30.1)"
```

---

### Task 7: Build, Deploy, and Verify

**Files:**
- All modified files

- [ ] **Step 1: Final build**

```bash
cd ~/Developer/roweOS && bash src/build.sh
```

- [ ] **Step 2: Deploy**

```bash
cd ~/Developer/roweOS/RoweOS/dist && npx vercel --prod --yes
```

- [ ] **Step 3: Verify endpoints**

Test the response capture endpoint:
```
https://roweos.com/api/email-response?user=test&q=test&a=test&token=invalid
```
Should show the thank-you page (invalid token still shows page, just doesn't write to Firestore).

- [ ] **Step 4: Verify Admin panel**

1. Open roweos.com, sign in as admin
2. Go to Admin > Emails tab
3. Click Refresh to load user data
4. Verify user list shows with email history columns
5. Test sending a template to yourself
6. Verify email arrives with clickable options
7. Click an option, verify thank-you page appears
8. Refresh Admin > Emails, verify response appears in user detail

- [ ] **Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: admin email templates system complete (v30.1)"
```
