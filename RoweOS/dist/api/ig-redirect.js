// v24.0: Instagram OAuth redirect proxy for iOS mobile
// iOS universal links intercept instagram.com URLs and open the Instagram app
// This serves an HTML page that submits a form to Instagram's OAuth endpoint
// Form submissions in SFSafariViewController may bypass universal link interception

export default function handler(req, res) {
  var url = req.query.url || '';
  if (!url || url.indexOf('https://www.instagram.com/oauth/authorize') !== 0 && url.indexOf('https://instagram.com/oauth/authorize') !== 0) {
    return res.status(400).send('Invalid redirect URL');
  }

  // Parse the OAuth URL into base + query params for form submission
  var qIdx = url.indexOf('?');
  var params = [];
  if (qIdx > -1) {
    var qs = url.substring(qIdx + 1);
    var pairs = qs.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var eq = pairs[i].indexOf('=');
      if (eq > -1) {
        params.push({ name: pairs[i].substring(0, eq), value: decodeURIComponent(pairs[i].substring(eq + 1)) });
      }
    }
  }

  // Build hidden form fields
  var fields = '';
  for (var j = 0; j < params.length; j++) {
    fields += '<input type="hidden" name="' + params[j].name + '" value="' + params[j].value.replace(/"/g, '&quot;') + '">';
  }

  res.setHeader('Content-Type', 'text/html');
  res.send('<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
    'body{background:#000;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}' +
    '.btn{background:linear-gradient(135deg,#833AB4,#C13584,#E1306C,#F77737);color:#fff;font-size:17px;font-weight:600;padding:14px 32px;border:none;border-radius:12px;cursor:pointer;display:inline-block;text-decoration:none}' +
    'p{color:#999;font-size:14px;margin-top:16px}' +
    '</style></head><body>' +
    '<div>' +
    '<form id="igForm" method="GET" action="https://instagram.com/oauth/authorize">' +
    fields +
    '<button type="submit" class="btn">Continue to Instagram Login</button>' +
    '</form>' +
    '<p>Tap the button to sign in with Instagram</p>' +
    '</div></body></html>');
}
