// v20.6: Signup notification serverless function
// Sends email via Resend API and writes to Firestore signups collection
// POST { email, displayName, method, uid, createdAt }
// v31.0: Extracted renderSignupEmail() + exported getFirebaseAccessToken()
// so /api/info-signup can reuse them.

async function handler(req, res) {
  // CORS headers
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
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
    var email = body.email || 'unknown';
    var displayName = body.displayName || 'No name provided';
    var method = body.method || 'unknown';
    var uid = body.uid || 'unknown';
    var createdAt = body.createdAt || new Date().toISOString();
    var source = body.source || 'Unknown';

    var timestamp = new Date(createdAt);
    var formattedDate = timestamp.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // v31.0: Build email HTML via shared renderer (used by /api/info-signup too)
    var emailHtml = renderSignupEmail({
      email: email,
      displayName: displayName,
      method: method,
      source: source,
      uid: uid,
      createdAt: createdAt
    });

    var emailSent = false;
    var emailError = null;
    var welcomeEmailSent = false;

    if (process.env.RESEND_API_KEY) {
      // --- Send admin notification email ---
      try {
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
            subject: 'New Brilliance Signup: ' + email,
            html: emailHtml
          })
        });

        if (resendResp.ok) {
          emailSent = true;
          console.log('[notify-signup] Admin email sent for:', email);
        } else {
          var resendErr = await resendResp.text();
          emailError = 'Resend API error: ' + resendResp.status + ' ' + resendErr;
          console.error('[notify-signup] Resend error:', emailError);
        }
      } catch (err) {
        emailError = 'Resend fetch error: ' + err.message;
        console.error('[notify-signup]', emailError);
      }

      // --- Send welcome email to new user ---
      if (email && email !== 'unknown') {
        try {
          var firstName = displayName ? displayName.split(' ')[0] : '';
          var greeting = firstName ? 'Hi ' + escapeHtml(firstName) + ',' : 'Welcome,';

          // v34.7: Brilliance branding — monogram + italic accents, no duplicate wordmark.
          var welcomeHtml = [
            '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #f5ecd9;">',
            '  <div style="background: linear-gradient(180deg, #1a1610 0%, #14110d 100%); padding: 44px 40px 30px; border-radius: 14px 14px 0 0; text-align: center; border: 1px solid rgba(201,169,97,0.18); border-bottom: 1px solid rgba(201,169,97,0.14);">',
            '    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>',
            '      <td style="background:radial-gradient(circle, rgba(201,169,97,0.20) 0%, rgba(201,169,97,0) 70%);border-radius:50%;padding:14px;">',
            '        <img src="https://roweos.com/images/brilliance/monogram-circle.png" alt="Brilliance" width="84" height="84" style="display:block;width:84px;height:84px;border-radius:50%;" />',
            '      </td>',
            '    </tr></table>',
            '    <p style="margin: 18px 0 0; font-family:\'DM Sans\',sans-serif; font-size: 11px; color: rgba(201,169,97,0.85); letter-spacing: 0.32em; text-transform: uppercase; font-weight: 500;">Brilliance</p>',
            '    <p style="margin: 6px 0 0; font-family: Georgia, serif; font-style: italic; font-size: 14px; color: rgba(245,236,217,0.6);">Intelligence, accessible.</p>',
            '  </div>',
            '  <div style="padding: 36px 40px 40px; background: #14110d; border-left: 1px solid rgba(201,169,97,0.18); border-right: 1px solid rgba(201,169,97,0.18);">',
            '    <p style="color: #f5ecd9; font-size: 15px; margin: 0 0 20px; line-height: 1.6;">' + greeting + '</p>',
            '    <p style="color: rgba(245,236,217,0.78); font-size: 15px; margin: 0 0 20px; line-height: 1.65;">Thanks for creating your Brilliance account. To unlock the full platform, you\'ll need an access key.</p>',
            '    <div style="background: #1a1610; border: 1px solid rgba(201,169,97,0.22); border-radius: 12px; padding: 22px 24px; margin: 24px 0;">',
            '      <p style="color: #f5ecd9; font-size: 14.5px; font-weight: 500; margin: 0 0 12px;">What you get with a plan:</p>',
            '      <ul style="color: rgba(245,236,217,0.72); font-size: 13px; line-height: 1.95; margin: 0; padding-left: 18px;">',
            '        <li><strong style="color: #e2c79b; font-weight:500;">BrandAI</strong>  - 4 AI agents for strategy, marketing, operations & documents</li>',
            '        <li><strong style="color: #e2c79b; font-weight:500;">LifeAI</strong>  - Personal life management with coach archetypes</li>',
            '        <li><strong style="color: #e2c79b; font-weight:500;">Cloud Sync</strong>  - Your data synced across all devices</li>',
            '        <li><strong style="color: #e2c79b; font-weight:500;">Studio, Pulse, Automations</strong>  - The full toolkit</li>',
            '      </ul>',
            '    </div>',
            '    <div style="text-align: center; margin: 32px 0;">',
            '      <a href="https://roweos.com/info#pricing" style="display: inline-block; padding: 14px 36px; background: linear-gradient(180deg, #d4b87f 0%, #b8975f 100%); color: #1a1610; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 9px; letter-spacing: 0.02em;">View Plans & Get Your Access Key</a>',
            '    </div>',
            '    <p style="color: rgba(245,236,217,0.5); font-size: 12.5px; margin: 0 0 8px; text-align: center;">Solo $9/mo · Founder $59/mo · Premium $79/mo · all start with a free trial</p>',
            '    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(201,169,97,0.12);">',
            '      <p style="color: rgba(245,236,217,0.55); font-size: 13px; margin: 0 0 12px; line-height:1.65;">Already have an access key? Just sign back in at <a href="https://roweos.com" style="color: #c9a961; text-decoration: none;">roweos.com</a> and it will activate automatically.</p>',
            '      <p style="color: rgba(245,236,217,0.55); font-size: 13px; margin: 0 0 12px; line-height:1.65;">Want a pre-loaded API key so you don\'t need your own? You can purchase one during checkout or in Settings after signing in.</p>',
            '    </div>',
            '    <p style="color: rgba(245,236,217,0.4); font-size: 12px; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid rgba(201,169,97,0.10);">',
            '      Questions? Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color: #c9a961; text-decoration: none;">jordan@therowecollection.com</a>',
            '    </p>',
            '  </div>',
            '  <div style="background: #14110d; border: 1px solid rgba(201,169,97,0.18); border-top: none; border-radius: 0 0 14px 14px; padding: 16px 32px; text-align: center;">',
            '    <p style="margin: 0; font-size: 11px; color: rgba(245,236,217,0.4);">A product of <a href="https://therowecollection.com" style="color: #c9a961; text-decoration: none;">The Rowe Collection, LLC</a> &middot; Austin, TX</p>',
            '  </div>',
            '</div>'
          ].join('\n');

          var welcomeResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Brilliance <roweos@therowecollection.com>',
              reply_to: 'jordan@therowecollection.com',
              to: [email],
              subject: 'Welcome to Brilliance — Get Your Access Key',
              html: welcomeHtml
            })
          });

          if (welcomeResp.ok) {
            welcomeEmailSent = true;
            console.log('[notify-signup] Welcome email sent to:', email);

            // v30.1: Log welcome email to email_log collection
            try {
              var logToken = await getFirebaseAccessToken();
              if (logToken && process.env.FIREBASE_PROJECT_ID) {
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
                      subject: { stringValue: 'Welcome to Brilliance - Get Your Access Key' },
                      sentAt: { stringValue: new Date().toISOString() },
                      status: { stringValue: 'sent' },
                      error: { stringValue: '' }
                    }
                  })
                });
                console.log('[notify-signup] email_log entry written for:', email);
              }
            } catch (logErr) {
              console.log('[notify-signup] email_log write failed (non-fatal):', logErr.message);
            }
          } else {
            var wErr = await welcomeResp.text();
            console.error('[notify-signup] Welcome email error:', wErr);
          }
        } catch (wErr2) {
          console.error('[notify-signup] Welcome email error:', wErr2.message);
        }
      }
    } else {
      console.log('[notify-signup] RESEND_API_KEY not set, skipping emails. Signup:', email, displayName, method);
    }

    // Write to Firestore via REST API
    var firestoreWritten = false;
    var firestoreError = null;

    if (process.env.FIREBASE_PROJECT_ID) {
      try {
        var projectId = process.env.FIREBASE_PROJECT_ID;
        var firestoreUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/signups';

        var firestoreDoc = {
          fields: {
            email: { stringValue: email },
            displayName: { stringValue: displayName },
            method: { stringValue: method },
            uid: { stringValue: uid },
            createdAt: { stringValue: createdAt },
            emailSent: { booleanValue: emailSent },
            source: { stringValue: source },
            notifiedAt: { stringValue: new Date().toISOString() }
          }
        };

        // Use Firebase service account if available, otherwise unauthenticated write
        var firestoreHeaders = { 'Content-Type': 'application/json' };

        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          // Generate access token from service account
          var token = await getFirebaseAccessToken();
          if (token) {
            firestoreHeaders['Authorization'] = 'Bearer ' + token;
          }
        }

        var fsResp = await fetch(firestoreUrl, {
          method: 'POST',
          headers: firestoreHeaders,
          body: JSON.stringify(firestoreDoc)
        });

        if (fsResp.ok) {
          firestoreWritten = true;
          console.log('[notify-signup] Firestore write success for:', email);
        } else {
          var fsErr = await fsResp.text();
          firestoreError = 'Firestore error: ' + fsResp.status + ' ' + fsErr;
          console.error('[notify-signup]', firestoreError);
        }
      } catch (err) {
        firestoreError = 'Firestore fetch error: ' + err.message;
        console.error('[notify-signup]', firestoreError);
      }
    } else {
      console.log('[notify-signup] FIREBASE_PROJECT_ID not set, skipping Firestore write');
    }

    // v30.5: Write to newsletter_subscribers so signup appears in Admin Signups tab
    try {
      if (process.env.FIREBASE_PROJECT_ID) {
        var nsToken = await getFirebaseAccessToken();
        if (nsToken) {
          var nsUrl = 'https://firestore.googleapis.com/v1/projects/' + process.env.FIREBASE_PROJECT_ID +
            '/databases/(default)/documents/newsletter_subscribers';
          await fetch(nsUrl, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + nsToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                email: { stringValue: email },
                name: { stringValue: displayName || '' },
                displayName: { stringValue: displayName || '' },
                uid: { stringValue: uid },
                source: { stringValue: source },
                subscribedAt: { stringValue: new Date().toISOString() },
                type: { stringValue: 'individual' }
              }
            })
          });
          console.log('[notify-signup] newsletter_subscribers written for:', email);
        }
      }
    } catch (nsErr) {
      console.warn('[notify-signup] newsletter_subscribers write failed (non-fatal):', nsErr.message);
    }

    // v30.5: Send push notification to admin (same pattern as newsletter.js)
    try {
      var adminUid = 'cG3DEoz2Kkd9i1cSPLOFqPfUYB93';
      var pushTitle = 'New Signup (' + source + '): ' + (displayName || email);
      var pushBody = method + ' | ' + email;
      await fetch('https://roweos.com/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', uid: adminUid, title: pushTitle, body: pushBody })
      });
      console.log('[notify-signup] Push notification sent');
    } catch (pushErr) {
      console.warn('[notify-signup] Push notification failed (non-fatal):', pushErr.message);
    }

    // v30.5: Write to admin_notifications for in-app Signups tab
    try {
      if (process.env.FIREBASE_PROJECT_ID) {
        var notifToken = await getFirebaseAccessToken();
        if (notifToken) {
          var notifId = 'signup_app_' + Date.now();
          var notifUrl = 'https://firestore.googleapis.com/v1/projects/' + process.env.FIREBASE_PROJECT_ID +
            '/databases/(default)/documents/admin_notifications/' + notifId;
          await fetch(notifUrl, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + notifToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                type: { stringValue: 'signup' },
                email: { stringValue: email },
                name: { stringValue: displayName },
                signupType: { stringValue: 'individual' },
                source: { stringValue: source },
                createdAt: { stringValue: new Date().toISOString() },
                read: { booleanValue: false }
              }
            })
          });
          console.log('[notify-signup] admin_notifications written');
        }
      }
    } catch (notifErr) {
      console.warn('[notify-signup] admin_notifications write failed (non-fatal):', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      emailSent: emailSent,
      welcomeEmailSent: welcomeEmailSent,
      firestoreWritten: firestoreWritten,
      emailError: emailError,
      firestoreError: firestoreError
    });

  } catch (error) {
    console.error('[notify-signup] Handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// HTML escape utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// v31.0: Render the admin signup notification email.
// Shared by /api/notify-signup and /api/info-signup so both endpoints
// produce visually identical admin emails (only Source/Method differ).
// payload: { email, displayName, method, source, uid, createdAt }
function renderSignupEmail(payload) {
  var p = payload || {};
  var email = p.email || 'unknown';
  var displayName = p.displayName || 'No name provided';
  var method = p.method || 'unknown';
  var source = p.source || 'Unknown';
  var uid = p.uid || 'unknown';
  var createdAt = p.createdAt || new Date().toISOString();

  var timestamp = new Date(createdAt);
  var formattedDate;
  try {
    formattedDate = timestamp.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch (e) {
    formattedDate = createdAt;
  }

  var methodLabel = method === 'google' ? 'Google'
    : method === 'x' ? 'X (Twitter)'
    : method === 'email' ? 'Email/Password'
    : method;

  var firebaseConsoleUrl = 'https://console.firebase.google.com/project/roweos-app/authentication/users';

  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:0;background:#111;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:40px 20px;">',
    '<tr><td align="center">',
    '<table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;">',
    // Header
    '<tr><td style="padding:32px 32px 16px;border-bottom:1px solid #2a2a2a;">',
    '<h1 style="margin:0;font-size:20px;font-weight:600;color:#a89878;letter-spacing:0.5px;">Brilliance</h1>',
    '<p style="margin:8px 0 0;font-size:13px;color:#888;">New User Signup via ' + escapeHtml(source) + '</p>',
    '</td></tr>',
    // Body
    '<tr><td style="padding:24px 32px;">',
    '<table width="100%" cellpadding="0" cellspacing="0">',
    // Email
    '<tr>',
    '<td style="padding:8px 0;font-size:13px;color:#888;width:120px;vertical-align:top;">Email</td>',
    '<td style="padding:8px 0;font-size:14px;color:#e0e0e0;font-weight:500;">' + escapeHtml(email) + '</td>',
    '</tr>',
    // Display Name
    '<tr>',
    '<td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">Display Name</td>',
    '<td style="padding:8px 0;font-size:14px;color:#e0e0e0;">' + escapeHtml(displayName) + '</td>',
    '</tr>',
    // Sign-in Method
    '<tr>',
    '<td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">Sign-in Method</td>',
    '<td style="padding:8px 0;font-size:14px;color:#e0e0e0;">' + escapeHtml(methodLabel) + '</td>',
    '</tr>',
    // Source
    '<tr>',
    '<td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">Source</td>',
    '<td style="padding:8px 0;font-size:14px;color:#a89878;font-weight:500;">' + escapeHtml(source) + '</td>',
    '</tr>',
    // UID
    '<tr>',
    '<td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">UID</td>',
    '<td style="padding:8px 0;font-size:12px;color:#666;font-family:monospace;">' + escapeHtml(uid) + '</td>',
    '</tr>',
    // Timestamp
    '<tr>',
    '<td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">Created</td>',
    '<td style="padding:8px 0;font-size:14px;color:#e0e0e0;">' + escapeHtml(formattedDate) + '</td>',
    '</tr>',
    '</table>',
    '</td></tr>',
    // CTA
    '<tr><td style="padding:8px 32px 32px;">',
    '<a href="' + firebaseConsoleUrl + '" style="display:inline-block;padding:10px 20px;background:#a89878;color:#111;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px;">View in Firebase Console</a>',
    '</td></tr>',
    // Footer
    '<tr><td style="padding:16px 32px;border-top:1px solid #2a2a2a;">',
    '<p style="margin:0;font-size:11px;color:#555;">Sent automatically by Brilliance signup monitoring.</p>',
    '</td></tr>',
    '</table>',
    '</td></tr></table>',
    '</body></html>'
  ].join('\n');
}

// Generate Firebase access token from service account JSON (stored as env var)
async function getFirebaseAccessToken() {
  try {
    var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    var now = Math.floor(Date.now() / 1000);

    // Build JWT header and claim set
    var header = { alg: 'RS256', typ: 'JWT' };
    var claimSet = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    };

    var headerB64 = base64url(JSON.stringify(header));
    var claimB64 = base64url(JSON.stringify(claimSet));
    var unsignedJwt = headerB64 + '.' + claimB64;

    // Sign with service account private key using Web Crypto
    var pemKey = sa.private_key;
    var pemBody = pemKey.replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');
    var keyBuffer = Uint8Array.from(atob(pemBody), function(c) { return c.charCodeAt(0); });

    var cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    var encoder = new TextEncoder();
    var signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(unsignedJwt));
    var signatureB64 = base64url(String.fromCharCode.apply(null, new Uint8Array(signature)));

    var jwt = unsignedJwt + '.' + signatureB64;

    // Exchange JWT for access token
    var tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
    });

    if (tokenResp.ok) {
      var tokenData = await tokenResp.json();
      return tokenData.access_token;
    } else {
      var errText = await tokenResp.text();
      console.error('[notify-signup] Token exchange error:', errText);
      return null;
    }
  } catch (err) {
    console.error('[notify-signup] getFirebaseAccessToken error:', err.message);
    return null;
  }
}

// URL-safe base64 encode
function base64url(str) {
  var b64 = btoa(str);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// v31.0: Default export = handler (preserves existing /api/notify-signup behavior).
// Named exports allow /api/info-signup to reuse the email template + Firebase auth helper.
export default handler;
export { renderSignupEmail, getFirebaseAccessToken };
