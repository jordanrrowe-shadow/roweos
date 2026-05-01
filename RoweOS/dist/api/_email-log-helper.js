// v34.66: Shared email_log writer.
//
// Every Vercel function that calls api.resend.com/emails MUST log the send to
// the Firestore `email_log` collection so the admin Campaigns dashboard sees
// every send, not just the ones routed through send-template-email.js.
//
// Pre-v34.66: only send-template-email.js, notify-signup.js, and resend-welcome.js
// wrote to email_log. feedback.js, newsletter.js, info-signup.js, scheduler.js,
// and stripe-webhook.js sent mail invisibly. Per memory/project_email_system_bugs.md
// rule: "Any new server send endpoint MUST include a writeEmailLog call mirroring
// send-template-email.js."
//
// Usage:
//   var emailLog = require('./_email-log-helper');
//   var ok = await emailLog.write({
//     userEmail: 'user@example.com',
//     template: 'newsletter',
//     subject: 'Subject line',
//     status: 'sent',                  // or 'failed' / 'queued'
//     resendId: 'res_xxx',             // optional
//     sentBy: 'newsletter',            // which endpoint did the send (audit trail)
//   });
//
// Returns true if the log was written, false if env vars were missing or write failed.
// Never throws — silent failure is preferable to losing the actual mail send.

async function getGoogleAccessToken(serviceAccount) {
  var crypto = require('crypto');
  function base64url(str) {
    return Buffer.from(str).toString('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  var headerB64 = base64url(JSON.stringify(header));
  var payloadB64 = base64url(JSON.stringify(payload));
  var unsigned = headerB64 + '.' + payloadB64;
  var sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  var signature = sign.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  var jwt = unsigned + '.' + signature;

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

async function write(logData) {
  var endpoint = (logData && logData.sentBy) || 'unknown';
  try {
    var projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId || !process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('[' + endpoint + '] email_log write skipped: env missing');
      return false;
    }
    var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    var accessToken = await getGoogleAccessToken(sa);

    var url = 'https://firestore.googleapis.com/v1/projects/' + projectId
      + '/databases/(default)/documents/email_log';
    var fields = {
      userId:    { stringValue: String(logData.userId    || '') },
      userEmail: { stringValue: String(logData.userEmail || '') },
      template:  { stringValue: String(logData.template  || '') },
      subject:   { stringValue: String(logData.subject   || '') },
      sentAt:    { stringValue: String(logData.sentAt    || new Date().toISOString()) },
      status:    { stringValue: String(logData.status    || 'sent') },
      sentBy:    { stringValue: String(logData.sentBy    || '') }
    };
    if (logData.resendId)  fields.resendId  = { stringValue: String(logData.resendId) };
    if (logData.campaign)  fields.campaign  = { stringValue: String(logData.campaign) };
    if (logData.error)     fields.error     = { stringValue: String(logData.error) };

    var resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify({ fields: fields })
    });
    if (!resp.ok) {
      var errText = await resp.text();
      console.error('[' + endpoint + '] email_log write failed:', resp.status, errText);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[' + endpoint + '] email_log write exception:', e && e.message);
    return false;
  }
}

module.exports = { write: write };
