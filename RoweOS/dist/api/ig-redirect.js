// v24.0: Instagram OAuth mobile helper page
// iOS universal links intercept ALL navigation to instagram.com and open the Instagram app
// The only workaround: user long-presses the link and selects "Open in Safari"
// This page provides clear instructions for that flow

export default function handler(req, res) {
  var url = req.query.url || '';
  if (!url || (url.indexOf('https://www.instagram.com/oauth/authorize') !== 0 && url.indexOf('https://instagram.com/oauth/authorize') !== 0)) {
    return res.status(400).send('Invalid redirect URL');
  }

  var safeUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  res.setHeader('Content-Type', 'text/html');
  res.send('<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
    '*{box-sizing:border-box}' +
    'body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}' +
    '.wrap{max-width:340px;width:100%}' +
    '.icon{font-size:48px;margin-bottom:16px}' +
    'h2{font-size:20px;font-weight:600;margin:0 0 8px}' +
    '.sub{color:#999;font-size:14px;line-height:1.5;margin:0 0 28px}' +
    '.steps{text-align:left;margin:0 0 28px;padding:0;list-style:none;counter-reset:s}' +
    '.steps li{counter-increment:s;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:15px;line-height:1.4;display:flex;align-items:flex-start;gap:12px}' +
    '.steps li:last-child{border:none}' +
    '.num{background:rgba(168,152,120,0.2);color:#a89878;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}' +
    '.btn{display:block;background:linear-gradient(135deg,#833AB4,#C13584,#E1306C,#F77737);color:#fff;font-size:17px;font-weight:600;padding:16px 32px;border:none;border-radius:14px;text-decoration:none;-webkit-touch-callout:default}' +
    '.hint{color:#666;font-size:12px;margin-top:16px;line-height:1.5}' +
    '.highlight{color:#a89878;font-weight:600}' +
    '</style></head><body>' +
    '<div class="wrap">' +
    '<div class="icon">&#x1F4F1;</div>' +
    '<h2>Connect Instagram</h2>' +
    '<p class="sub">iPhone opens Instagram links in the app instead of the browser. Follow these steps to sign in:</p>' +
    '<ol class="steps">' +
    '<li><span class="num">1</span><span><span class="highlight">Long press</span> the button below (hold your finger on it)</span></li>' +
    '<li><span class="num">2</span><span>Tap <span class="highlight">"Open in Safari"</span> from the menu</span></li>' +
    '<li><span class="num">3</span><span>Sign in with your Instagram account</span></li>' +
    '<li><span class="num">4</span><span>You\'ll be redirected back to RoweOS</span></li>' +
    '</ol>' +
    '<a href="' + safeUrl + '" class="btn">Sign in with Instagram</a>' +
    '<p class="hint">Long press - don\'t tap. Tapping will open the Instagram app instead.</p>' +
    '</div></body></html>');
}
