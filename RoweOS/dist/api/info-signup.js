// v31.0: /api/info-signup
// Captures a lead from roweos.com/info bottom signup form, sends an admin
// notification email (reusing the notify-signup template), writes to the
// info_leads Firestore collection, then 302-redirects the visitor back to
// roweos.com with prefill query params so the auth gate can finish signup.
//
// POST body fields (form-encoded or JSON):
//   name, email, utm_source, utm_medium, utm_campaign, referrer
//
// IP + User-Agent are captured server-side from request headers.

import { renderSignupEmail, getFirebaseAccessToken } from './notify-signup.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Method not allowed');
    return;
  }

  // Vercel auto-parses JSON and application/x-www-form-urlencoded into
  // req.body, but be defensive in case the body arrived as a raw string.
  var body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (jsonErr) {
      try {
        var parsed = {};
        var parts = body.split('&');
        for (var i = 0; i < parts.length; i++) {
          var pair = parts[i].split('=');
          var k = decodeURIComponent((pair[0] || '').replace(/\+/g, ' '));
          var v = decodeURIComponent((pair[1] || '').replace(/\+/g, ' '));
          if (k) parsed[k] = v;
        }
        body = parsed;
      } catch (formErr) {
        body = {};
      }
    }
  }

  var name = String(body.name || '').trim().slice(0, 200);
  var email = String(body.email || '').trim().toLowerCase().slice(0, 320);
  var utmSource = String(body.utm_source || '').slice(0, 100);
  var utmMedium = String(body.utm_medium || '').slice(0, 100);
  var utmCampaign = String(body.utm_campaign || '').slice(0, 100);
  var referrer = String(body.referrer || '').slice(0, 500);

  var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Invalid email');
    return;
  }

  var ipHeader = req.headers['x-forwarded-for'] || '';
  var ip = ipHeader ? String(ipHeader).split(',')[0].trim()
    : (req.connection && req.connection.remoteAddress) || '';
  var userAgent = req.headers['user-agent'] || '';
  var createdAt = new Date().toISOString();

  // 1. Send admin notification email (reuse shared renderer)
  if (process.env.RESEND_API_KEY && typeof renderSignupEmail === 'function') {
    try {
      var html = renderSignupEmail({
        email: email,
        displayName: name || '(no name)',
        method: 'Info Page Form',
        source: 'Info Page Lead',
        uid: '(prospect)',
        createdAt: createdAt
      });
      var infoSubject = 'New Brilliance Lead (Info Page): ' + email;
      var resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Brilliance <roweos@therowecollection.com>',
          reply_to: 'jordan@therowecollection.com',
          to: ['jordan@therowecollection.com'],
          subject: infoSubject,
          html: html
        })
      });
      if (!resendResp.ok) {
        var errText = await resendResp.text();
        console.error('[info-signup] Resend non-2xx:', resendResp.status, errText);
      } else {
        console.log('[info-signup] Admin email sent for:', email);
      }
      // v34.66: Log to email_log so admin Campaigns dashboard sees Info-page leads.
      try {
        var emailLog = require('./_email-log-helper');
        var resendBody = null;
        try { resendBody = await resendResp.clone().json(); } catch (eR) {}
        await emailLog.write({
          userEmail: 'jordan@therowecollection.com',
          template: 'info_signup_admin',
          subject: infoSubject,
          status: resendResp.ok ? 'sent' : 'failed',
          resendId: (resendBody && resendBody.id) || '',
          sentBy: 'info-signup'
        });
      } catch (eL) { console.warn('[info-signup] email_log helper missing:', eL.message); }
    } catch (e) {
      console.error('[info-signup] Resend send failed:', e && e.message);
    }
  } else {
    console.log('[info-signup] RESEND_API_KEY not set, skipping admin email');
  }

  // 2. Write to Firestore info_leads collection
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      var accessToken = typeof getFirebaseAccessToken === 'function'
        ? await getFirebaseAccessToken()
        : null;
      if (accessToken) {
        var docUrl = 'https://firestore.googleapis.com/v1/projects/'
          + process.env.FIREBASE_PROJECT_ID
          + '/databases/(default)/documents/info_leads';
        var fsResp = await fetch(docUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              email: { stringValue: email },
              name: { stringValue: name },
              utmSource: { stringValue: utmSource },
              utmMedium: { stringValue: utmMedium },
              utmCampaign: { stringValue: utmCampaign },
              referrer: { stringValue: referrer },
              ip: { stringValue: String(ip) },
              userAgent: { stringValue: userAgent },
              createdAt: { stringValue: createdAt },
              status: { stringValue: 'new' }
            }
          })
        });
        if (!fsResp.ok) {
          var fsErr = await fsResp.text();
          console.error('[info-signup] Firestore write non-2xx:', fsResp.status, fsErr);
        } else {
          console.log('[info-signup] info_leads doc written for:', email);
        }
      } else {
        console.warn('[info-signup] No Firebase access token — skipping info_leads write');
      }
    } catch (e) {
      console.error('[info-signup] Firestore write failed:', e && e.message);
    }
  } else {
    console.log('[info-signup] FIREBASE_PROJECT_ID/SERVICE_ACCOUNT not set, skipping info_leads');
  }

  // 3. Return JSON success. Client (AJAX form on /info) will show its own
  //    success state and provide a "Continue to RoweOS" button with prefill
  //    query params. Keeping JSON instead of 302 because XHR can't display a
  //    cross-origin redirect target without losing the in-page success state.
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    redirect: 'https://roweos.com/?email=' + encodeURIComponent(email)
      + '&name=' + encodeURIComponent(name) + '&source=info'
  }));
}
