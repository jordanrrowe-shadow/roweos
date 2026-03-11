// v24.0: Instagram OAuth redirect proxy
// Bypasses iOS universal link interception by serving an HTML page with JS redirect
// iOS intercepts HTTP 302 redirects to instagram.com, but not JS-initiated navigation

export default function handler(req, res) {
  var url = req.query.url || '';
  if (!url || url.indexOf('https://www.instagram.com/oauth/authorize') !== 0) {
    return res.status(400).send('Invalid redirect URL');
  }

  // Serve HTML page that redirects via JavaScript
  // This keeps navigation inside Safari/SFSafariViewController instead of opening Instagram app
  var safeUrl = url.replace(/"/g, '&quot;').replace(/</g, '&lt;');
  res.setHeader('Content-Type', 'text/html');
  res.send('<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{background:#000;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}a{color:#a89878;font-size:18px;text-decoration:none;padding:14px 32px;border:1px solid #a89878;border-radius:12px;display:inline-block}</style>' +
    '<script>setTimeout(function(){window.location.replace("' + safeUrl + '");},100);</script>' +
    '</head><body><div><p>Redirecting to Instagram...</p>' +
    '<p style="margin-top:20px"><a href="' + safeUrl + '">Tap here if not redirected</a></p>' +
    '</div></body></html>');
}
