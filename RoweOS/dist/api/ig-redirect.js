// v24.1: Instagram OAuth intermediary for iOS PWA
// iOS universal links intercept instagram.com in ALL iOS browser contexts except full Safari sized popups.
// SFSafariViewController (used by PWAs for window.open) does NOT support the sized popup bypass.
// This page copies the OAuth URL to clipboard and instructs user to paste in Safari.
// Token syncs back to PWA via Firestore.

export default function handler(req, res) {
  var url = req.query.url || '';
  if (!url || (url.indexOf('https://www.instagram.com/oauth/authorize') !== 0 && url.indexOf('https://instagram.com/oauth/authorize') !== 0)) {
    return res.status(400).send('Invalid redirect URL');
  }

  // For JS string context
  var jsUrl = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3c').replace(/>/g, '\\x3e');

  res.setHeader('Content-Type', 'text/html');
  res.send('<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
    '*{box-sizing:border-box}' +
    'body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}' +
    '.wrap{max-width:340px;width:100%}' +
    '.logo{margin-bottom:20px}' +
    'h2{font-size:20px;font-weight:600;margin:0 0 8px}' +
    '.sub{color:#999;font-size:14px;line-height:1.5;margin:0 0 24px}' +
    '.steps{text-align:left;margin:0 0 24px;padding:0;list-style:none}' +
    '.steps li{padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;line-height:1.5;display:flex;align-items:flex-start;gap:10px}' +
    '.steps li:last-child{border:none}' +
    '.num{background:rgba(168,152,120,0.2);color:#a89878;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px}' +
    '.btn{display:block;background:linear-gradient(135deg,#833AB4,#C13584,#E1306C,#F77737);color:#fff;font-size:17px;font-weight:600;padding:16px 32px;border:none;border-radius:14px;cursor:pointer;width:100%;-webkit-appearance:none}' +
    '.btn:active{opacity:0.85;transform:scale(0.98)}' +
    '.btn.copied{background:linear-gradient(135deg,#166534,#22c55e)}' +
    '.hint{color:#555;font-size:12px;margin-top:20px;line-height:1.5}' +
    '.highlight{color:#a89878;font-weight:600}' +
    '</style></head><body>' +
    '<div class="wrap">' +
    '<div class="logo"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a89878" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="#a89878" stroke="none"/></svg></div>' +
    '<h2>Connect Instagram</h2>' +
    '<p class="sub">iPhones redirect Instagram links to the app. Use these steps to sign in via Safari instead:</p>' +
    '<ol class="steps">' +
    '<li><span class="num">1</span><span>Tap <span class="highlight">Copy Link</span> below</span></li>' +
    '<li><span class="num">2</span><span>Open <span class="highlight">Safari</span> and paste the link in the address bar</span></li>' +
    '<li><span class="num">3</span><span>Sign in with Instagram</span></li>' +
    '<li><span class="num">4</span><span>Return to RoweOS - it syncs automatically</span></li>' +
    '</ol>' +
    '<button class="btn" id="copyBtn" onclick="copyLink()">Copy Login Link</button>' +
    '<p class="hint" id="hint"></p>' +
    '</div>' +
    '<script>' +
    'var igUrl = \'' + jsUrl + '\';' +
    'function copyLink() {' +
    '  if (navigator.clipboard && navigator.clipboard.writeText) {' +
    '    navigator.clipboard.writeText(igUrl).then(function() {' +
    '      var btn = document.getElementById("copyBtn");' +
    '      btn.textContent = "Copied!";' +
    '      btn.className = "btn copied";' +
    '      document.getElementById("hint").textContent = "Now open Safari and paste the link in the address bar.";' +
    '      document.getElementById("hint").style.color = "#a89878";' +
    '    }).catch(function() { promptCopy(); });' +
    '  } else { promptCopy(); }' +
    '}' +
    'function promptCopy() {' +
    '  prompt("Copy this link and paste it in Safari:", igUrl);' +
    '}' +
    '</script>' +
    '</body></html>');
}
