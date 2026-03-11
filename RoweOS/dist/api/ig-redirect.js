// v24.1: Instagram OAuth intermediary for iOS PWA
// iOS universal links intercept instagram.com in PWA's SFSafariViewController.
// This page loads on our domain (no interception), then tries sized popup to Instagram OAuth.
// If popup blocked, provides copy-link fallback. Token syncs back via Firestore.

export default function handler(req, res) {
  var url = req.query.url || '';
  if (!url || (url.indexOf('https://www.instagram.com/oauth/authorize') !== 0 && url.indexOf('https://instagram.com/oauth/authorize') !== 0)) {
    return res.status(400).send('Invalid redirect URL');
  }

  // Escape for safe embedding in HTML attributes and JS strings
  var safeUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // For JS string context — escape backslashes, quotes, and angle brackets
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
    '.sub{color:#999;font-size:14px;line-height:1.5;margin:0 0 28px}' +
    '.btn{display:block;background:linear-gradient(135deg,#833AB4,#C13584,#E1306C,#F77737);color:#fff;font-size:17px;font-weight:600;padding:16px 32px;border:none;border-radius:14px;text-decoration:none;cursor:pointer;width:100%;-webkit-appearance:none}' +
    '.btn:active{opacity:0.85;transform:scale(0.98)}' +
    '.btn-copy{display:none;background:rgba(168,152,120,0.15);border:1px solid rgba(168,152,120,0.3);color:#a89878;font-size:15px;font-weight:600;padding:14px 24px;border-radius:14px;cursor:pointer;width:100%;margin-top:12px;-webkit-appearance:none}' +
    '.btn-copy:active{opacity:0.85}' +
    '.status{color:#666;font-size:13px;margin-top:20px;line-height:1.5;min-height:40px}' +
    '.status.success{color:#4ade80}' +
    '.hint{color:#555;font-size:12px;margin-top:24px;line-height:1.5}' +
    '</style></head><body>' +
    '<div class="wrap">' +
    '<div class="logo"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a89878" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="#a89878" stroke="none"/></svg></div>' +
    '<h2>Connect Instagram</h2>' +
    '<p class="sub">Tap the button below to open the Instagram login page.</p>' +
    '<button class="btn" id="connectBtn" onclick="openIG()">Sign in with Instagram</button>' +
    '<button class="btn-copy" id="copyBtn" onclick="copyLink()">Copy Login Link</button>' +
    '<p class="status" id="status"></p>' +
    '<p class="hint" id="hint"></p>' +
    '</div>' +
    '<script>' +
    'var igUrl = \'' + jsUrl + '\';' +
    'var attempted = false;' +
    'function openIG() {' +
    '  if (attempted) { copyLink(); return; }' +
    '  attempted = true;' +
    '  var w = Math.min(500, screen.width - 20);' +
    '  var h = Math.min(700, screen.height - 100);' +
    '  var left = Math.round((screen.width - w) / 2);' +
    '  var top = Math.round((screen.height - h) / 2);' +
    '  var popup = window.open(igUrl, "InstagramLogin", "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top + ",toolbar=no,menubar=no");' +
    '  if (popup) {' +
    '    document.getElementById("status").textContent = "Instagram login opened. Complete sign-in there, then return to RoweOS.";' +
    '    document.getElementById("status").className = "status success";' +
    '    document.getElementById("hint").textContent = "After signing in, your Instagram will sync automatically when you return to RoweOS.";' +
    '  } else {' +
    '    showFallback();' +
    '  }' +
    '}' +
    'function showFallback() {' +
    '  document.getElementById("status").textContent = "Could not open popup. Copy the link below and paste it in Safari to sign in.";' +
    '  document.getElementById("copyBtn").style.display = "block";' +
    '  document.getElementById("hint").textContent = "After signing in via Safari, your Instagram will sync automatically when you return to RoweOS.";' +
    '}' +
    'function copyLink() {' +
    '  if (navigator.clipboard && navigator.clipboard.writeText) {' +
    '    navigator.clipboard.writeText(igUrl).then(function() {' +
    '      document.getElementById("status").textContent = "Link copied! Open Safari and paste it in the address bar.";' +
    '      document.getElementById("status").className = "status success";' +
    '      document.getElementById("copyBtn").textContent = "Copied";' +
    '    }).catch(function() { promptFallback(); });' +
    '  } else { promptFallback(); }' +
    '}' +
    'function promptFallback() {' +
    '  prompt("Copy this link and paste it in Safari:", igUrl);' +
    '}' +
    '</script>' +
    '</body></html>');
}
