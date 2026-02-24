// v20.6: Signup notification serverless function
// Sends email via Resend API and writes to Firestore signups collection
// POST { email, displayName, method, uid, createdAt }

export default async function handler(req, res) {
  // CORS headers
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.vercel.app');
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

    var methodLabel = method === 'google' ? 'Google' : method === 'x' ? 'X (Twitter)' : method === 'email' ? 'Email/Password' : method;
    var firebaseConsoleUrl = 'https://console.firebase.google.com/project/roweos-app/authentication/users';

    // Build email HTML
    var emailHtml = [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8"></head>',
      '<body style="margin:0;padding:0;background:#111;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">',
      '<table width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:40px 20px;">',
      '<tr><td align="center">',
      '<table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;">',
      // Header
      '<tr><td style="padding:32px 32px 16px;border-bottom:1px solid #2a2a2a;">',
      '<h1 style="margin:0;font-size:20px;font-weight:600;color:#a89878;letter-spacing:0.5px;">RoweOS</h1>',
      '<p style="margin:8px 0 0;font-size:13px;color:#888;">New User Signup</p>',
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
      '<p style="margin:0;font-size:11px;color:#555;">Sent automatically by RoweOS signup monitoring.</p>',
      '</td></tr>',
      '</table>',
      '</td></tr></table>',
      '</body></html>'
    ].join('\n');

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
            from: 'RoweOS <roweos@therowecollection.com>',
            reply_to: 'jordan@therowecollection.com',
            to: ['jordan@therowecollection.com'],
            subject: 'New RoweOS Signup: ' + email,
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

          var welcomeHtml = [
            '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0;">',
            '  <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); padding: 48px 40px 32px; border-radius: 12px 12px 0 0; text-align: center;">',
            '    <h1 style="color: #a89878; margin: 0; font-size: 32px; font-weight: 300; letter-spacing: 3px;">RoweOS</h1>',
            '    <p style="color: #666; margin: 8px 0 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">Operating intelligence, built for brands &amp; life</p>',
            '  </div>',
            '  <div style="padding: 36px 40px 40px; background: #111;">',
            '    <p style="color: #ccc; font-size: 15px; margin: 0 0 20px; line-height: 1.6;">' + greeting + '</p>',
            '    <p style="color: #ccc; font-size: 15px; margin: 0 0 20px; line-height: 1.6;">Thanks for creating your RoweOS account. To unlock the full platform, you\'ll need an access key.</p>',
            '    <div style="background: #1a1a1a; border: 1px solid #a8987844; border-radius: 10px; padding: 24px; margin: 24px 0;">',
            '      <p style="color: #fff; font-size: 15px; font-weight: 500; margin: 0 0 12px;">What you get with a plan:</p>',
            '      <ul style="color: #bbb; font-size: 13px; line-height: 2; margin: 0; padding-left: 20px;">',
            '        <li><strong style="color: #fff;">BrandAI</strong>  - 4 AI agents for strategy, marketing, operations & documents</li>',
            '        <li><strong style="color: #fff;">LifeAI</strong>  - Personal life management with coach archetypes</li>',
            '        <li><strong style="color: #fff;">Cloud Sync</strong>  - Your data synced across all devices</li>',
            '        <li><strong style="color: #fff;">Studio, Focus, Automations</strong>  - The full toolkit</li>',
            '      </ul>',
            '    </div>',
            '    <div style="text-align: center; margin: 32px 0;">',
            '      <a href="https://roweos.com/info#pricing" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #a89878, #c4a882); color: #0a0a0a; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px;">View Plans & Get Your Access Key</a>',
            '    </div>',
            '    <p style="color: #888; font-size: 13px; margin: 0 0 8px; text-align: center;">Plans start at $4.99/month</p>',
            '    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #222;">',
            '      <p style="color: #888; font-size: 13px; margin: 0 0 12px;">Already have an access key? Just sign back in at <a href="https://roweos.com" style="color: #a89878; text-decoration: none;">roweos.com</a> and it will activate automatically.</p>',
            '      <p style="color: #888; font-size: 13px; margin: 0 0 12px;">Want a pre-loaded API key so you don\'t need your own? You can purchase one during checkout or in Settings after signing in.</p>',
            '    </div>',
            '    <p style="color: #555; font-size: 12px; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #222;">',
            '      Questions? Reply to this email or contact <a href="mailto:jordan@therowecollection.com" style="color: #a89878; text-decoration: none;">jordan@therowecollection.com</a>',
            '    </p>',
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
              from: 'RoweOS <roweos@therowecollection.com>',
              reply_to: 'jordan@therowecollection.com',
              to: [email],
              subject: 'Welcome to RoweOS - Get Your Access Key',
              html: welcomeHtml
            })
          });

          if (welcomeResp.ok) {
            welcomeEmailSent = true;
            console.log('[notify-signup] Welcome email sent to:', email);
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
            notifiedAt: { stringValue: new Date().toISOString() }
          }
        };

        // Use Firebase service account if available, otherwise unauthenticated write
        var firestoreHeaders = { 'Content-Type': 'application/json' };

        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
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

// Generate Firebase access token from service account JSON (stored as env var)
async function getFirebaseAccessToken() {
  try {
    var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
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
