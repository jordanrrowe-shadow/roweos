// ═══════════════════════════════════════════════════════════════
// v17.0: SOCIAL MEDIA INTEGRATION
// ═══════════════════════════════════════════════════════════════

// --- Social Account State ---
var SOCIAL_PLATFORMS = ['x', 'threads', 'instagram', 'tiktok'];
var SOCIAL_PLATFORM_LIMITS = { x: 280, threads: 500, instagram: 2200, tiktok: 2200 };
var SOCIAL_PLATFORM_NAMES = { x: 'X (Twitter)', threads: 'Threads', instagram: 'Instagram', tiktok: 'TikTok' };
// v17.0: PKCE helpers
function generateCodeVerifier() {
  var arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode.apply(null, arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function generateCodeChallenge(verifier) {
  var encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(verifier)).then(function(hash) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  });
}
function generateState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// v18.0: Per-brand/per-life-profile social connection scoping
function getSocialKeyScope() {
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : (localStorage.getItem('roweos_app_mode') || 'brand');
  if (mode === 'life') {
    var lifeIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
    return '_life_' + lifeIdx;
  }
  // v25.5: Always read from localStorage — it is the source of truth and avoids
  // race condition where selectedBrand=0 (default) before initializeBrands() runs
  var brandIdx = parseInt(localStorage.getItem('roweos_selected_brand') || '0');
  return '_brand_' + brandIdx;
}

// v18.0: One-time migration — copies global social keys to _brand_0 scoped keys
function migrateSocialConnectionsToPerBrand() {
  try {
    if (localStorage.getItem('roweos_social_migration_v18') === 'done') return;
    var platforms = ['x', 'threads', 'instagram'];
    var scope = '_brand_0';
    platforms.forEach(function(p) {
      // Connected flag
      var connKey = 'roweos_social_' + p + '_connected';
      var connVal = localStorage.getItem(connKey);
      if (connVal) {
        localStorage.setItem(connKey + scope, connVal);
        localStorage.removeItem(connKey);
      }
      // Handle
      var handleKey = 'roweos_social_' + p + '_handle';
      var handleVal = localStorage.getItem(handleKey);
      if (handleVal) {
        localStorage.setItem(handleKey + scope, handleVal);
        localStorage.removeItem(handleKey);
      }
      // Token
      var tokenKey = 'roweos_social_token_' + p;
      var tokenVal = localStorage.getItem(tokenKey);
      if (tokenVal) {
        localStorage.setItem(tokenKey + scope, tokenVal);
        localStorage.removeItem(tokenKey);
      }
      // Pending token
      var pendingKey = 'roweos_social_pending_token_' + p;
      var pendingVal = localStorage.getItem(pendingKey);
      if (pendingVal) {
        localStorage.setItem(pendingKey + scope, pendingVal);
        localStorage.removeItem(pendingKey);
      }
    });
    localStorage.setItem('roweos_social_migration_v18', 'done');
  } catch(e) {}
}

function isSocialConnected(platform) {
  var scope = getSocialKeyScope();
  try { return localStorage.getItem('roweos_social_' + platform + '_connected' + scope) === 'true'; } catch(e) { return false; }
}
function getSocialHandle(platform) {
  var scope = getSocialKeyScope();
  try { return localStorage.getItem('roweos_social_' + platform + '_handle' + scope) || ''; } catch(e) { return ''; }
}
function setSocialConnected(platform, connected, handle, scopeOverride) {
  var scope = scopeOverride || getSocialKeyScope();
  try {
    localStorage.setItem('roweos_social_' + platform + '_connected' + scope, connected ? 'true' : 'false');
    if (handle) localStorage.setItem('roweos_social_' + platform + '_handle' + scope, handle);
    else localStorage.removeItem('roweos_social_' + platform + '_handle' + scope);
  } catch(e) {}
  refreshSocialAccountCards();
  // v25.1: Write-through social connection state to Firestore
  writeDB('profile/main', { socialConnected: { platform: platform, connected: connected, handle: handle || '' } });
  // v25.4: Log social activity
  if (connected) {
    logSocialActivity('account_connected', { platform: platform, description: 'Connected ' + platform + ' account' });
  }
}

function refreshSocialAccountCards() {
  // v18.5: Set up event delegation on the grid (once) for reliable platform routing
  var grid = document.getElementById('socialAccountsGrid');
  if (grid && !grid._delegated) {
    grid._delegated = true;
    grid.addEventListener('click', function(e) {
      var btn = e.target.closest('.social-connect-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var platform = btn.getAttribute('data-platform');
      if (!platform) return;
      if (isSocialConnected(platform)) {
        disconnectSocialAccount(platform);
      } else {
        connectSocialAccount(platform);
      }
    }, true);
  }

  // v18.0: Update context hint to show which brand/profile connections are displayed
  var hintEl = document.getElementById('socialContextHint');
  if (hintEl) {
    var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
    if (mode === 'life') {
      var lifeProfile = typeof getCurrentLifeProfile === 'function' ? getCurrentLifeProfile() : null;
      var lifeName = lifeProfile ? (lifeProfile.name || 'Life Profile') : 'Life Profile';
      hintEl.textContent = 'Connections for: ' + lifeName;
    } else {
      var bIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
      var bName = (typeof brands !== 'undefined' && brands[bIdx]) ? (brands[bIdx].shortName || brands[bIdx].name) : 'Brand';
      hintEl.textContent = 'Connections for: ' + bName;
    }
  }
  ['x', 'threads', 'instagram'].forEach(function(p) {
    var statusEl = document.getElementById('socialStatus' + (p === 'x' ? 'X' : p === 'threads' ? 'Threads' : 'IG'));
    var btnEl = document.getElementById('socialBtn' + (p === 'x' ? 'X' : p === 'threads' ? 'Threads' : 'IG'));
    if (!statusEl || !btnEl) return;
    if (isSocialConnected(p)) {
      var handle = getSocialHandle(p);
      statusEl.textContent = 'Connected' + (handle ? ' as @' + handle : '');
      statusEl.classList.add('connected');
      btnEl.textContent = 'Disconnect';
      btnEl.classList.add('btn-secondary');
      btnEl.onclick = null; // v19.3: Delegated listener handles routing
    } else {
      statusEl.textContent = 'Not connected';
      statusEl.classList.remove('connected');
      btnEl.textContent = 'Connect';
      btnEl.classList.remove('btn-secondary');
      btnEl.onclick = null; // v19.3: Delegated listener handles routing
    }
  });
}

// --- OAuth Connection Flows ---
function connectSocialAccount(platform) {
  // v19.3: Removed redundant isSocialConnected guard — delegated listener already checks
  if (platform === 'x') {
    connectX();
  } else if (platform === 'threads') {
    connectThreads();
  } else if (platform === 'instagram') {
    connectInstagram();
  } else if (platform === 'tiktok') {
    connectTikTok();
  }
  // v25.4: Poll for connection status change and re-render Settings
  var wasConnected = isSocialConnected(platform);
  var pollCount = 0;
  var pollInterval = setInterval(function() {
    pollCount++;
    if (pollCount > 30) { clearInterval(pollInterval); return; } // 30s max
    var nowConnected = isSocialConnected(platform);
    if (nowConnected !== wasConnected) {
      clearInterval(pollInterval);
      if (typeof renderSocialSettings === 'function') renderSocialSettings();
      if (typeof refreshSocialAccountCards === 'function') refreshSocialAccountCards();
    }
  }, 1000);
}

function getOwnSocialKey(platform) {
  try {
    var toggle = document.getElementById('socialOwnKeysToggle');
    if (!toggle || !toggle.checked) return null;
    var keyMap = { x: 'socialOwnKeyX', threads: 'socialOwnKeyThreads', instagram: 'socialOwnKeyIG' };
    var el = document.getElementById(keyMap[platform]);
    return el && el.value.trim() ? el.value.trim() : null;
  } catch(e) { return null; }
}

// v17.0: Public app IDs (not secrets — safe for client-side)
var ROWEOS_SOCIAL_APP_IDS = {
  threads: '925207080456321',
  instagram: '1277280787606457', // v23.18: Instagram-specific App ID (not main Meta App ID)
  x: 'Nzh0SHZIbnZJM0FnbVlCR3FDc1Q6MTpjaQ', // v22.33: RoweOS X Client ID
  tiktok: '' // v25.4: Requires developer app approval — user provides own key
};

function connectX() {
  var clientId = getOwnSocialKey('x') || ROWEOS_SOCIAL_APP_IDS.x;
  if (!clientId) {
    showToast('X Client ID not configured. Enable "Use Own API Keys" in Settings and enter your X Client ID.', 'warning');
    return;
  }
  var redirectUri = window.location.origin + '/social-callback';
  // v18.0: Encode brand/life scope in state prefix for per-brand connections
  var scope = getSocialKeyScope();
  var scopeCode = scope.replace('_brand_', 'b').replace('_life_', 'l'); // e.g. "b2" or "l1"
  var codeVerifier = generateCodeVerifier();
  // v20.6: Embed verifier + clientId in state so callback can recover them when localStorage is partitioned (iOS Safari, mobile redirect)
  // v20.12: Also embed Firebase UID (prefixed 'u:') for Firestore token storage on mobile
  // Format: x_scopeCode_random~verifier~clientId~u:firebaseUid — X echoes state back unchanged
  var stateBase = 'x_' + scopeCode + '_' + generateState();
  var fbUid = '';
  try { if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) fbUid = firebase.auth().currentUser.uid; } catch(e) {}
  var state = stateBase + '~' + codeVerifier + '~' + clientId + (fbUid ? '~u:' + fbUid : '');

  // v18.0: Store brand context for callback to read
  try { localStorage.setItem('roweos_social_pending_context', scope); } catch(e) {}

  // Store PKCE verifier for callback (localStorage so popup tab can read it — primary path)
  try {
    localStorage.setItem('roweos_x_code_verifier', codeVerifier);
    localStorage.setItem('roweos_x_state', stateBase);
    localStorage.setItem('roweos_x_client_id', clientId);
  } catch(e) {}

  generateCodeChallenge(codeVerifier).then(function(challenge) {
    var authUrl = 'https://x.com/i/oauth2/authorize' +
      '?response_type=code' +
      '&client_id=' + encodeURIComponent(clientId) +
      '&redirect_uri=' + encodeURIComponent(redirectUri) +
      '&scope=tweet.write%20tweet.read%20users.read%20offline.access%20dm.read%20dm.write' +
      '&state=' + encodeURIComponent(state) +
      '&code_challenge=' + challenge +
      '&code_challenge_method=S256';
    // v19.0: In-app modal for all platforms — works on both desktop and mobile
    showSocialAuthModal('x', authUrl, scope);
  });
}

function connectThreads() {
  var appId = getOwnSocialKey('threads') || ROWEOS_SOCIAL_APP_IDS.threads;
  var redirectUri = window.location.origin + '/social-callback';
  // v18.0: Encode brand/life scope in state prefix for per-brand connections
  var scope = getSocialKeyScope();
  var scopeCode = scope.replace('_brand_', 'b').replace('_life_', 'l');
  // v20.12: Embed Firebase UID for Firestore token storage on mobile
  var fbUid = '';
  try { if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) fbUid = firebase.auth().currentUser.uid; } catch(e) {}
  var state = 'threads_' + scopeCode + '_' + generateState() + (fbUid ? '~u:' + fbUid : '');
  try {
    localStorage.setItem('roweos_social_pending_context', scope);
    localStorage.setItem('roweos_threads_state', state);
  } catch(e) {}

  // v18.9: Use threads.com directly (threads.net 301→threads.com)
  var authUrl = 'https://www.threads.com/oauth/authorize' +
    '?client_id=' + encodeURIComponent(appId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&scope=threads_basic,threads_content_publish' +
    '&response_type=code' +
    '&state=' + encodeURIComponent(state);

  // v18.9: In-app modal for all platforms. User clicks link to sign in,
  // then returns to RoweOS. Polls localStorage + visibilitychange to detect connection.
  showSocialAuthModal('threads', authUrl, scope);
}

// v18.9: In-app modal for social OAuth — Safari blocks scripted navigation to Meta domains.
// Shows a branded overlay with a real <a target="_blank"> link the user clicks.
// Polls localStorage for successful connection while user authenticates in new tab.
function showSocialAuthModal(platform, authUrl, scope) {
  var platformNames = { threads: 'Threads', instagram: 'Instagram', x: 'X' };
  var platformName = platformNames[platform] || platform;
  var existing = document.getElementById('socialAuthModal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'socialAuthModal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;'; // v24.26: z-index max to guarantee above everything including onboarding

  var card = document.createElement('div');
  card.style.cssText = 'background:#18181b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:36px;max-width:340px;width:90%;text-align:center;';

  var svgIcon = '';
  if (platform === 'threads') {
    svgIcon = '<svg viewBox="0 0 192 192" style="width:32px;height:32px;fill:#f4f4f5;margin-bottom:16px" xmlns="http://www.w3.org/2000/svg"><path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.326-38.092 34.705.528 9.818 5.235 18.303 13.258 23.904 6.783 4.736 15.524 7.125 24.629 6.724 12.031-.53 21.46-5.071 28.03-13.503 4.988-6.404 8.122-14.667 9.478-25.059 5.673 3.43 9.876 7.982 12.363 13.465 4.222 9.306 4.468 24.591-3.612 32.674-7.143 7.145-15.724 10.222-30.166 10.336-16.029-.126-28.139-5.263-35.986-15.27C70.26 141.248 66 126.907 65.843 109.77c.157-17.137 4.417-31.478 12.657-42.605 9.513-12.854 23.538-19.666 41.7-20.25 18.29.597 32.507 7.5 42.248 20.518l13.742-9.712c-12.694-16.98-31.06-26.008-54.093-26.76h-.414c-20.697.662-37.39 8.74-49.647 24.013C61.58 69.082 56.459 86.661 56.273 109.7l.003.452c.186 23.04 5.307 40.618 15.763 54.727 12.263 16.542 30.232 25.309 53.44 26.073h.42c17.478-.136 30.376-4.996 40.624-15.314 13.354-13.442 12.893-30.083 7.364-42.218-3.96-8.694-11.16-15.857-21.35-21.432Zm-52.072 40.36c-10.09.554-20.574-3.96-21.122-14.158-.405-7.53 5.338-15.937 25.14-17.076 2.203-.127 4.357-.186 6.464-.186 6.26 0 12.123.587 17.42 1.716-1.981 24.456-14.39 29.148-27.902 29.704Z"/></svg>';
  }

  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // v19.0: iOS universal links intercept ALL navigations to threads.com/x.com/instagram.com
  // (302 redirects, JS window.location, form submissions — all intercepted)
  // On iOS: show copy-link as PRIMARY action (paste in Safari address bar bypasses universal links)
  // On other mobile: use direct link (Android handles OAuth in browser)
  // On desktop: direct link in new tab

  var cardBody = '';
  if (isMobile && isIOS) {
    cardBody = svgIcon +
      '<h3 style="color:#f4f4f5;font-size:17px;font-weight:600;margin-bottom:6px;">Connect ' + platformName + '</h3>' +
      '<p style="color:rgba(255,255,255,0.45);font-size:13px;line-height:1.5;margin-bottom:20px;">' +
        'Copy the sign-in link below and paste it in Safari. After signing in, come back to RoweOS. Connection will be detected automatically.</p>' +
      '<button id="socialCopyLinkBtn" style="display:inline-block;background:#a89878;color:#fff;padding:12px 32px;font-size:14px;font-weight:600;border-radius:10px;border:none;cursor:pointer;width:100%;max-width:260px;">' +
        'Copy Sign-In Link</button>' +
      '<div id="socialCopyConfirm" style="display:none;color:#4ade80;font-size:12px;margin-top:8px;">Copied! Paste in Safari\'s address bar</div>' +
      '<div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">' +
        '<p style="color:rgba(255,255,255,0.3);font-size:11px;margin-bottom:8px;">Or try opening directly:</p>' +
        '<a href="' + authUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" ' +
        'style="color:rgba(255,255,255,0.4);font-size:12px;text-decoration:underline;">' +
        'Open ' + platformName + ' Sign In</a></div>' +
      '<div id="socialAuthStatus" style="margin-top:16px;font-size:12px;color:rgba(255,255,255,0.35);">Waiting for connection...</div>' +
      '<button onclick="closeSocialAuthModal()" style="margin-top:8px;background:none;border:none;color:rgba(255,255,255,0.35);font-size:13px;cursor:pointer;padding:8px;">Cancel</button>';
  } else {
    // v19.1: Desktop uses window.open() so callback page has window.opener and can close itself.
    // Mobile uses <a target="_blank"> (popup blockers prevent window.open on some mobile browsers).
    if (isMobile) {
      var helpText = 'Sign in via your browser, then switch back to RoweOS. Connection will be detected automatically.';
      cardBody = svgIcon +
        '<h3 style="color:#f4f4f5;font-size:17px;font-weight:600;margin-bottom:6px;">Connect ' + platformName + '</h3>' +
        '<p style="color:rgba(255,255,255,0.45);font-size:13px;line-height:1.5;margin-bottom:24px;">' + helpText + '</p>' +
        (platform === 'instagram' ? '<div style="background:rgba(168,152,120,0.15);border:1px solid rgba(168,152,120,0.3);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.7);"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#a89878" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> <strong>Important:</strong> When Instagram asks for permissions, make sure <strong>both toggles are switched ON</strong> -- especially "Access profile and posts." Publishing will not work if either is denied.</div>' : '') +
        '<a href="' + authUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" ' +
        'style="display:inline-block;background:#a89878;color:#fff;padding:12px 32px;font-size:14px;font-weight:600;border-radius:10px;text-decoration:none;cursor:pointer;transition:opacity 0.2s;" ' +
        'onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">' +
        'Open ' + platformName + ' Sign In</a>' +
        '<div id="socialAuthStatus" style="margin-top:16px;font-size:12px;color:rgba(255,255,255,0.35);">Waiting for connection...</div>' +
        '<button onclick="closeSocialAuthModal()" style="margin-top:12px;background:none;border:none;color:rgba(255,255,255,0.35);font-size:13px;cursor:pointer;padding:8px;">Cancel</button>';
    } else {
      // Desktop: stash authUrl globally, use onclick with window.open() so popup has window.opener
      window._socialAuthUrl = authUrl;
      cardBody = svgIcon +
        '<h3 style="color:#f4f4f5;font-size:17px;font-weight:600;margin-bottom:6px;">Connect ' + platformName + '</h3>' +
        '<p style="color:rgba(255,255,255,0.45);font-size:13px;line-height:1.5;margin-bottom:24px;">Sign in on a new tab. This window will update automatically when connected.</p>' +
        (platform === 'instagram' ? '<div style="background:rgba(168,152,120,0.15);border:1px solid rgba(168,152,120,0.3);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.7);"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#a89878" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> <strong>Important:</strong> When Instagram asks for permissions, make sure <strong>both toggles are switched ON</strong> -- especially "Access profile and posts." Publishing will not work if either is denied.</div>' : '') +
        '<button onclick="window.open(window._socialAuthUrl, \'_blank\')" ' +
        'style="display:inline-block;background:#a89878;color:#fff;padding:12px 32px;font-size:14px;font-weight:600;border-radius:10px;border:none;cursor:pointer;transition:opacity 0.2s;" ' +
        'onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">' +
        'Open ' + platformName + ' Sign In</button>' +
        '<div id="socialAuthStatus" style="margin-top:16px;font-size:12px;color:rgba(255,255,255,0.35);">Waiting for connection...</div>' +
        '<button onclick="closeSocialAuthModal()" style="margin-top:12px;background:none;border:none;color:rgba(255,255,255,0.35);font-size:13px;cursor:pointer;padding:8px;">Cancel</button>';
    }
  }
  card.innerHTML = cardBody;

  overlay.appendChild(card);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeSocialAuthModal();
  });
  document.body.appendChild(overlay);

  // v19.0: iOS copy-link handler
  if (isIOS) {
    var copyBtn = document.getElementById('socialCopyLinkBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(authUrl).then(function() {
            var confirm = document.getElementById('socialCopyConfirm');
            if (confirm) confirm.style.display = 'block';
            copyBtn.textContent = 'Copied!';
            copyBtn.style.background = '#22c55e';
            setTimeout(function() { copyBtn.textContent = 'Copy Again'; copyBtn.style.background = '#a89878'; }, 2000);
          });
        } else {
          // Fallback: select text from hidden input
          var tmp = document.createElement('input');
          tmp.value = authUrl;
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand('copy');
          document.body.removeChild(tmp);
          var confirm = document.getElementById('socialCopyConfirm');
          if (confirm) confirm.style.display = 'block';
          copyBtn.textContent = 'Copied!';
          copyBtn.style.background = '#22c55e';
          setTimeout(function() { copyBtn.textContent = 'Copy Again'; copyBtn.style.background = '#a89878'; }, 2000);
        }
      });
    }
  }

  // Poll localStorage for successful connection
  var key = 'roweos_social_' + platform + '_connected' + scope;
  var wasConnected = localStorage.getItem(key) === 'true';
  var attempts = 0;

  function checkConnection() {
    var nowConnected = localStorage.getItem(key) === 'true';
    if (nowConnected && !wasConnected) {
      clearInterval(window._socialAuthPoll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
      var statusEl = document.getElementById('socialAuthStatus');
      if (statusEl) { statusEl.style.color = '#4ade80'; statusEl.textContent = platformName + ' connected!'; }
      if (typeof refreshSocialAccountCards === 'function') refreshSocialAccountCards();
      if (typeof renderDigitalPresenceCard === 'function') renderDigitalPresenceCard();
      // v28.4: Update onboarding social step if visible
      if (typeof updateOnboardingSocialStatus === 'function') updateOnboardingSocialStatus();
      showToast(platformName + ' connected', 'success');
      setTimeout(closeSocialAuthModal, 1200);
      return true;
    }
    return false;
  }

  // v18.9: visibilitychange fires when user returns to PWA from Safari
  function onVisible() {
    if (document.visibilityState === 'visible') checkConnection();
  }
  document.addEventListener('visibilitychange', onVisible);

  // v19.0: pageshow is more reliable than visibilitychange on iOS PWAs
  function onPageShow() { checkConnection(); }
  window.addEventListener('pageshow', onPageShow);

  window._socialAuthPoll = setInterval(function() {
    attempts++;
    if (checkConnection()) return;
    if (attempts >= 600) { // v19.0: 10 min timeout (iOS users need time to copy-paste in Safari)
      clearInterval(window._socialAuthPoll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    }
  }, 1000);
}

function closeSocialAuthModal() {
  if (window._socialAuthPoll) clearInterval(window._socialAuthPoll);
  var modal = document.getElementById('socialAuthModal');
  if (modal) modal.remove();
}

// v18.5: Listen for social connection when user returns from mobile OAuth
// iOS universal links can intercept the OAuth URL and open the native app.
// The callback completes in a separate Safari tab, writing tokens to localStorage.
// This listener detects when the user returns and picks up the new connection.
function listenForSocialReturn(platform, scope) {
  var key = 'roweos_social_' + platform + '_connected' + scope;
  var wasConnected = localStorage.getItem(key) === 'true';
  var platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
  var cleaned = false;

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('storage', onStorage);
    clearTimeout(timeout);
  }

  function checkConnection() {
    if (cleaned) return;
    var nowConnected = localStorage.getItem(key) === 'true';
    if (nowConnected && !wasConnected) {
      cleanup();
      refreshSocialAccountCards();
      showToast(platformName + ' connected', 'success');
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') {
      // Small delay to let localStorage sync
      setTimeout(checkConnection, 300);
      // Check again after a longer delay (token exchange might still be in progress)
      setTimeout(checkConnection, 2000);
      setTimeout(checkConnection, 5000);
    }
  }

  function onStorage(e) {
    if (e.key === key && e.newValue === 'true') {
      checkConnection();
    }
  }

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('storage', onStorage);

  // Auto-cleanup after 5 minutes
  var timeout = setTimeout(cleanup, 300000);
}

// v17.0: Poll for social connection from opener tab while popup handles OAuth
// v18.0: Poll scoped key for per-brand/per-life-profile connections
function pollForSocialConnection(platform, popup) {
  var scope = getSocialKeyScope();
  var key = 'roweos_social_' + platform + '_connected' + scope;
  var wasConnected = localStorage.getItem(key) === 'true';
  var attempts = 0;
  var maxAttempts = 120; // 2 minutes
  var pollInterval = setInterval(function() {
    attempts++;
    var nowConnected = localStorage.getItem(key) === 'true';
    var popupClosed = !popup || popup.closed;
    if (nowConnected && !wasConnected) {
      clearInterval(pollInterval);
      refreshSocialAccountCards();
      showToast(platform.charAt(0).toUpperCase() + platform.slice(1) + ' connected', 'success');
    } else if (popupClosed && attempts > 5) {
      // Popup closed without connecting — stop polling
      clearInterval(pollInterval);
      refreshSocialAccountCards();
    } else if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
    }
  }, 1000);
}

function connectInstagram() {
  var appId = getOwnSocialKey('instagram') || ROWEOS_SOCIAL_APP_IDS.instagram;
  var redirectUri = window.location.origin + '/social-callback';
  // v18.0: Encode brand/life scope in state prefix for per-brand connections
  var scope = getSocialKeyScope();
  var scopeCode = scope.replace('_brand_', 'b').replace('_life_', 'l');
  // v20.12: Embed Firebase UID for Firestore token storage on mobile
  var fbUid = '';
  try { if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) fbUid = firebase.auth().currentUser.uid; } catch(e) {}
  var state = 'ig_' + scopeCode + '_' + generateState() + (fbUid ? '~u:' + fbUid : '');
  try {
    localStorage.setItem('roweos_social_pending_context', scope);
    localStorage.setItem('roweos_ig_state', state);
  } catch(e) {}

  // v23.18: Use www.instagram.com for new Instagram Business API (api.instagram.com returns "Invalid platform app")
  var igAuthUrl = 'https://www.instagram.com/oauth/authorize' +
    '?client_id=' + encodeURIComponent(appId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&scope=instagram_business_basic,instagram_business_content_publish' +
    '&response_type=code' +
    '&enable_fb_login=0' +
    '&force_authentication=1' +
    '&state=' + encodeURIComponent(state);
  // v24.0: iOS universal links intercept instagram.com URLs in PWA (SFSafariViewController).
  // Sized popup window.open works in mobile Safari but not PWA standalone mode.
  // PWA: copy URL to clipboard so user can paste in Safari. Token syncs back via Firestore.
  // Mobile Safari: sized popup bypasses universal link interception.
  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    try { localStorage.setItem('roweos_ig_oauth_pending', '1'); } catch(e) {}
    var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
    if (isStandalone) {
      // v24.1: PWA mode — open our intermediary page (our domain loads fine in SFSafariViewController).
      // From there, it tries sized popup to Instagram OAuth, with copy-link fallback.
      var igRedirectUrl = 'https://' + window.location.host + '/api/ig-redirect?url=' + encodeURIComponent(igAuthUrl);
      window.open(igRedirectUrl);
    } else {
      // Mobile Safari: sized popup works
      var popupW = Math.min(500, screen.width - 20);
      var popupH = Math.min(700, screen.height - 100);
      var popupLeft = Math.round((screen.width - popupW) / 2);
      var popupTop = Math.round((screen.height - popupH) / 2);
      window.open(igAuthUrl, 'InstagramLogin', 'width=' + popupW + ',height=' + popupH + ',left=' + popupLeft + ',top=' + popupTop + ',toolbar=no,menubar=no');
    }
    return;
  }
  // Desktop: in-app modal
  showSocialAuthModal('instagram', igAuthUrl, scope);
}

// v25.4: TikTok OAuth (Login Kit)
function connectTikTok() {
  var clientKey = '';
  // Check for own API keys first
  var ownKeys = localStorage.getItem('roweos_social_own_keys');
  if (ownKeys) {
    try {
      var parsed = JSON.parse(ownKeys);
      if (parsed.tiktok_client_key) clientKey = parsed.tiktok_client_key;
    } catch(e) {}
  }
  if (!clientKey) {
    clientKey = ROWEOS_SOCIAL_APP_IDS.tiktok || '';
  }
  if (!clientKey) {
    showToast('TikTok app key not configured', 'error');
    return;
  }

  var scope = getSocialKeyScope();
  var state = 'tiktok' + scope + '_' + Math.random().toString(36).substring(2, 10);
  // v20.12: Append UID for Firestore token storage
  if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
    state += '~u:' + firebase.auth().currentUser.uid;
  }
  localStorage.setItem('roweos_tiktok_state', state);

  var redirectUri = encodeURIComponent(window.location.origin + '/social-callback.html');
  var authUrl = 'https://www.tiktok.com/v2/auth/authorize/' +
    '?client_key=' + clientKey +
    '&scope=user.info.basic,video.publish,video.upload' +
    '&response_type=code' +
    '&redirect_uri=' + redirectUri +
    '&state=' + state;

  window.open(authUrl, '_blank', 'width=600,height=700');
}

function disconnectSocialAccount(platform) {
  if (!confirm('Disconnect ' + SOCIAL_PLATFORM_NAMES[platform] + '?')) return;
  var scope = getSocialKeyScope();
  setSocialConnected(platform, false, '', scope);
  // v17.1: Remove tokens from localStorage and Firestore
  // v18.0: Scoped per-brand/per-life-profile
  try { localStorage.removeItem('roweos_social_token_' + platform + scope); } catch(e) {}
  if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
    try {
      var uid = firebase.auth().currentUser.uid;
      firebase.firestore().collection('roweos_users').doc(uid).collection('social_tokens').doc(platform + scope).delete(); // v26.7: Fix collection name (was 'users', should match server-side 'roweos_users')
      // v28.0: Dual-write social token delete to v4
      if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
        try { syncEngine.delete('social_tokens', platform + scope); } catch(_e) {}
      }
    } catch(e) {}
  }
  showToast(SOCIAL_PLATFORM_NAMES[platform] + ' disconnected', 'success');
  logSocialActivity('account_disconnected', { platform: platform, description: 'Disconnected ' + platform + ' account' });
  // v25.1: setSocialConnected() already writes through to Firestore
}

// v17.0: Handle OAuth callback on page load
// Uses localStorage (not sessionStorage) so popup tab can read state set by opener
function handleSocialOAuthCallback() {
  try {
    var params = new URLSearchParams(window.location.search);
    var code = params.get('code');
    var state = params.get('state');
    if (!code || !state) return;

    // Determine which platform by checking stored state (localStorage, shared across tabs)
    var xState = localStorage.getItem('roweos_x_state');
    var tState = localStorage.getItem('roweos_threads_state');
    var igState = localStorage.getItem('roweos_ig_state');
    var platform = null;
    var callbackPromise = null;

    if (state === xState) { platform = 'x'; callbackPromise = handleXCallback(code); }
    else if (state === tState) { platform = 'threads'; callbackPromise = handleThreadsCallback(code); }
    else if (state === igState) { platform = 'instagram'; callbackPromise = handleInstagramCallback(code); }

    // v17.3: Fallback — detect platform from state prefix (iOS Safari localStorage partitioning)
    if (!platform && state) {
      if (state.indexOf('x_') === 0) { platform = 'x'; callbackPromise = handleXCallback(code); }
      else if (state.indexOf('threads_') === 0) { platform = 'threads'; callbackPromise = handleThreadsCallback(code); }
      else if (state.indexOf('ig_') === 0) { platform = 'instagram'; callbackPromise = handleInstagramCallback(code); }
    }

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);

    // Wait for token exchange to complete, THEN close popup
    if (platform && callbackPromise) {
      callbackPromise.then(function() {
        if (window.opener) {
          setTimeout(function() { window.close(); }, 500);
        } else {
          if (typeof showView === 'function') showView('settings');
          // v25.1: Navigate directly to connections folder so user sees updated status
          setTimeout(function() {
            if (typeof openSettingsFolder === 'function') openSettingsFolder('connections');
          }, 100);
        }
      }).catch(function() {
        // Even on error, close after a delay
        if (window.opener) {
          setTimeout(function() { window.close(); }, 1500);
        }
      });
    }
  } catch(e) {}
}

function handleXCallback(code) {
  var codeVerifier = localStorage.getItem('roweos_x_code_verifier');
  var clientId = getOwnSocialKey('x') || 'ROWEOS_X_CLIENT';
  var redirectUri = window.location.origin + '/social-callback';
  localStorage.removeItem('roweos_x_code_verifier');
  localStorage.removeItem('roweos_x_state');

  return fetch('/api/social-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: 'x', action: 'exchange', code: code, redirectUri: redirectUri, codeVerifier: codeVerifier, clientId: clientId })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) { showToast('X connection failed: ' + data.error, 'error'); return; }
    storeSocialToken('x', data);
    // Fetch user handle
    return fetch('https://api.x.com/2/users/me', {
      headers: { 'Authorization': 'Bearer ' + data.accessToken }
    }).then(function(r) { return r.json(); }).then(function(user) {
      var handle = user.data && user.data.username ? user.data.username : '';
      setSocialConnected('x', true, handle);
      showToast('X connected as @' + handle, 'success');
    }).catch(function() {
      setSocialConnected('x', true, '');
      showToast('X connected', 'success');
    });
  }).catch(function(err) {
    showToast('X connection failed', 'error');
  });
}

function handleThreadsCallback(code) {
  var redirectUri = window.location.origin + '/social-callback';
  var appId = getOwnSocialKey('threads');
  var body = { platform: 'threads', code: code, redirectUri: redirectUri };
  if (appId) body.appId = appId;
  localStorage.removeItem('roweos_threads_state');

  return fetch('/api/social-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) { showToast('Threads connection failed: ' + data.error, 'error'); return; }
    data.userId = data.userId || '';
    storeSocialToken('threads', data);
    setSocialConnected('threads', true, '');
    showToast('Threads connected', 'success');
  }).catch(function() { showToast('Threads connection failed', 'error'); });
}

function handleInstagramCallback(code) {
  var redirectUri = window.location.origin + '/social-callback';
  var appId = getOwnSocialKey('instagram');
  var body = { platform: 'instagram', code: code, redirectUri: redirectUri };
  if (appId) body.appId = appId;
  localStorage.removeItem('roweos_ig_state');

  return fetch('/api/social-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) { showToast('Instagram connection failed: ' + data.error, 'error'); return; }
    data.userId = data.userId || '';
    storeSocialToken('instagram', data);
    setSocialConnected('instagram', true, '');
    showToast('Instagram connected', 'success');
  }).catch(function() { showToast('Instagram connection failed', 'error'); });
}

function storeSocialToken(platform, tokenData, scopeOverride) {
  // v17.1: Save to localStorage as primary + Firestore as backup
  // v18.0: Scoped per-brand/per-life-profile
  var scope = scopeOverride || getSocialKeyScope();
  var tokenObj = {
    accessToken: tokenData.accessToken || '',
    refreshToken: tokenData.refreshToken || '',
    expiresAt: tokenData.expiresAt || 0,
    userId: tokenData.userId || '',
    updatedAt: new Date().toISOString()
  };
  try { localStorage.setItem('roweos_social_token_' + platform + scope, JSON.stringify(tokenObj)); } catch(e) {}
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      var uid = firebase.auth().currentUser.uid;
      // v18.0: Firestore doc key includes scope (e.g. "x_brand_2")
      firebase.firestore().collection('roweos_users').doc(uid).collection('social_tokens').doc(platform + scope).set(tokenObj); // v26.7: Fix collection name
      // v28.0: Dual-write social token to v4
      if (typeof syncEngine !== 'undefined' && syncEngine.isV4Active()) {
        try { syncEngine.write('social_tokens', platform + scope, tokenObj); } catch(_e) {}
      }
    }
  } catch(e) {}
  // v25.1: Write-through social token to Firestore
  writeDB('profile/main', { socialTokenUpdated: platform + scope });
}

function getSocialToken(platform) {
  // v18.0: Scoped per-brand/per-life-profile
  var scope = getSocialKeyScope();
  return new Promise(function(resolve) {
    // v17.1: Try Firestore first, fall back to localStorage
    function resolveFromLocal() {
      try {
        var stored = localStorage.getItem('roweos_social_token_' + platform + scope);
        if (stored) {
          var parsed = JSON.parse(stored);
          if (parsed && parsed.accessToken) { resolve(parsed); return; }
        }
      } catch(e) {}
      // v17.2: Last resort — check pending token (callback timing bug)
      try {
        var pending = localStorage.getItem('roweos_social_pending_token_' + platform + scope);
        if (pending) {
          var pendingParsed = JSON.parse(pending);
          if (pendingParsed && pendingParsed.accessToken) {
            // Move to final key so future reads are fast
            localStorage.setItem('roweos_social_token_' + platform + scope, pending);
            localStorage.removeItem('roweos_social_pending_token_' + platform + scope);
            resolve(pendingParsed);
            return;
          }
        }
      } catch(e) {}
      resolve(null);
    }
    try {
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        var uid = firebase.auth().currentUser.uid;
        firebase.firestore().collection('roweos_users').doc(uid).collection('social_tokens').doc(platform + scope).get().then(function(doc) { // v26.7: Fix collection name
          if (doc.exists && doc.data() && doc.data().accessToken) resolve(doc.data());
          else resolveFromLocal();
        }).catch(function() { resolveFromLocal(); });
      } else { resolveFromLocal(); }
    } catch(e) { resolveFromLocal(); }
  });
}

// v24.1: When returning from mobile OAuth or cross-device, check Firestore for all social tokens
// Checks ALL scopes (brand_0..N, life_0..N) to handle mode-flip edge cases
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState !== 'visible') return;
  var hasPending = false;
  try { hasPending = localStorage.getItem('roweos_ig_oauth_pending') === '1'; } catch(e) {}
  if (hasPending) {
    try { localStorage.removeItem('roweos_ig_oauth_pending'); } catch(e) {}
  }
  var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!hasPending && !isMobile) return;
  try {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) return;
    var uid = firebase.auth().currentUser.uid;
    // Query ALL social_tokens docs — covers all scopes regardless of current mode
    firebase.firestore().collection('roweos_users').doc(uid).collection('social_tokens').get().then(function(snap) { // v26.7: Fix collection name
      if (snap.empty) return;
      var foundNew = false;
      snap.forEach(function(doc) {
        var docId = doc.id; // e.g. "instagram_brand_0"
        var parts = docId.match(/^(x|threads|instagram)(_brand_\d+|_life_\d+)$/);
        if (!parts) return;
        var p = parts[1];
        var s = parts[2];
        var connKey = 'roweos_social_' + p + '_connected' + s;
        if (localStorage.getItem(connKey) === 'true') return;
        var tData = doc.data();
        if (tData && tData.accessToken) {
          try { localStorage.setItem('roweos_social_token_' + p + s, JSON.stringify(tData)); } catch(e) {}
          localStorage.setItem(connKey, 'true');
          foundNew = true;
        }
      });
      if (foundNew) {
        if (typeof refreshSocialAccountCards === 'function') refreshSocialAccountCards();
        if (typeof showToast === 'function') showToast('Social accounts synced', 'success');
        // v24.2: On mobile PWA, reload after short delay so UI fully picks up new connections
        var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isStandalone) {
          setTimeout(function() { window.location.reload(); }, 1500);
        }
      }
    }).catch(function() {});
  } catch(e) {}
});

// --- Settings Helpers ---
function toggleSocialOwnKeys() {
  var panel = document.getElementById('socialOwnKeysPanel');
  var toggle = document.getElementById('socialOwnKeysToggle');
  if (panel && toggle) {
    panel.style.display = toggle.checked ? 'block' : 'none';
  }
  try { localStorage.setItem('roweos_social_own_keys', toggle && toggle.checked ? 'true' : 'false'); } catch(e) {}
}

function saveSocialOwnKeys() {
  try {
    var keys = {};
    var xEl = document.getElementById('socialOwnKeyX');
    var tEl = document.getElementById('socialOwnKeyThreads');
    var igEl = document.getElementById('socialOwnKeyIG');
    if (xEl) keys.x = xEl.value.trim();
    if (tEl) keys.threads = tEl.value.trim();
    if (igEl) keys.instagram = igEl.value.trim();
    localStorage.setItem('roweos_social_own_api_keys', JSON.stringify(keys));
  } catch(e) {}
}

function loadSocialOwnKeys() {
  try {
    var ownKeys = localStorage.getItem('roweos_social_own_keys') === 'true';
    var toggle = document.getElementById('socialOwnKeysToggle');
    if (toggle) toggle.checked = ownKeys;
    var panel = document.getElementById('socialOwnKeysPanel');
    if (panel) panel.style.display = ownKeys ? 'block' : 'none';

    var keys = JSON.parse(localStorage.getItem('roweos_social_own_api_keys') || '{}');
    var xEl = document.getElementById('socialOwnKeyX');
    var tEl = document.getElementById('socialOwnKeyThreads');
    var igEl = document.getElementById('socialOwnKeyIG');
    if (xEl && keys.x) xEl.value = keys.x;
    if (tEl && keys.threads) tEl.value = keys.threads;
    if (igEl && keys.instagram) igEl.value = keys.instagram;
  } catch(e) {}
}

// v17.3: Strip markdown syntax for social posting (plain text output)
function stripMarkdownForSocial(text) {
  if (!text) return '';
  // Remove bold/italic markers
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '$1');
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/___(.*?)___/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/_(.*?)_/g, '$1');
  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');
  // Convert markdown links to just text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove heading markers
  text = text.replace(/^#{1,6}\s+/gm, '');
  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  // Remove blockquote markers
  text = text.replace(/^>\s?/gm, '');
  // Remove list markers (unordered)
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  // Remove list markers (ordered)
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');
  // Clean up multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

// --- Social Content Formatting ---
function formatForPlatform(content, platform) {
  if (!content) return '';
  // v17.3: Strip markdown before formatting for social platforms
  var text = stripMarkdownForSocial(content.trim());

  if (platform === 'x') {
    // 280 char limit, compress hashtags
    if (text.length > 280) {
      // Try to cut at last complete sentence within limit
      var cut = text.substring(0, 277);
      var lastDot = cut.lastIndexOf('.');
      var lastBang = cut.lastIndexOf('!');
      var lastQ = cut.lastIndexOf('?');
      var breakIdx = Math.max(lastDot, lastBang, lastQ);
      if (breakIdx > 200) text = text.substring(0, breakIdx + 1);
      else text = cut + '...';
    }
  } else if (platform === 'threads') {
    // 500 char limit, preserve line breaks
    if (text.length > 500) {
      text = text.substring(0, 497) + '...';
    }
  } else if (platform === 'instagram') {
    // 2200 char caption, 30 hashtag max
    if (text.length > 2200) {
      text = text.substring(0, 2197) + '...';
    }
    // Count hashtags
    var hashMatches = text.match(/#\w+/g) || [];
    if (hashMatches.length > 30) {
      // Remove excess hashtags
      var kept = 0;
      text = text.replace(/#\w+/g, function(match) {
        kept++;
        return kept <= 30 ? match : '';
      }).replace(/  +/g, ' ').trim();
    }
  } else if (platform === 'tiktok') {
    // 2200 char, hook-first
    if (text.length > 2200) {
      text = text.substring(0, 2197) + '...';
    }
  }
  return text;
}

// --- Social Publisher Panel ---
function showSocialPublisher(content, platforms) {
  // v28.4: Redirect to Media Lab Post tab
  window._socialPublisherContent = content || null;
  window._socialPublisherImage = window._socialPublisherImage || null;
  showView('social');
  showSocialTab('post');
  // Re-render after tab switch to pick up pre-filled content
  setTimeout(function() { renderPublishTab(); }, 50);
}

// v18.2: Toggle edit mode for social post content per platform
function toggleSocialEditMode(platform) {
  var preview = document.getElementById('socialPreview_' + platform);
  var editor = document.getElementById('socialEdit_' + platform);
  var btn = document.getElementById('socialEditBtn_' + platform);
  if (!preview || !editor) return;

  var isEditing = editor.style.display !== 'none';
  if (isEditing) {
    // Save edits back
    var edited = editor.value;
    window._socialPublisherEditedContent = window._socialPublisherEditedContent || {};
    window._socialPublisherEditedContent[platform] = edited;
    preview.textContent = edited;
    // Update char count
    var limit = SOCIAL_PLATFORM_LIMITS[platform];
    var countEl = document.getElementById('socialCharCount_' + platform);
    if (countEl) {
      countEl.textContent = edited.length + ' / ' + limit;
      countEl.className = 'social-char-count' + (edited.length > limit ? ' over-limit' : '');
    }
    preview.style.display = '';
    editor.style.display = 'none';
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit';
  } else {
    // Enter edit mode
    preview.style.display = 'none';
    editor.style.display = '';
    editor.focus();
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Done';
  }
}

// v18.2: Live char count update while editing
function onSocialEditInput(platform) {
  var editor = document.getElementById('socialEdit_' + platform);
  var countEl = document.getElementById('socialCharCount_' + platform);
  if (!editor || !countEl) return;
  var limit = SOCIAL_PLATFORM_LIMITS[platform];
  var len = editor.value.length;
  countEl.textContent = len + ' / ' + limit;
  countEl.className = 'social-char-count' + (len > limit ? ' over-limit' : '');
}

// v18.2: Remove attached image
function removeSocialPublisherImage() {
  window._socialPublisherImage = null;
  var imgPreview = document.getElementById('socialPublisherImgPreview');
  if (imgPreview) imgPreview.remove();
  var imgArea = document.getElementById('socialPublisherImageArea');
  if (imgArea) imgArea.remove();
  // Re-render the image area without the remove button
  var cardsEl = document.getElementById('socialPlatformCards');
  if (cardsEl) {
    var imgArea2 = document.createElement('div');
    imgArea2.id = 'socialPublisherImageArea';
    imgArea2.style.cssText = 'padding:12px 0;display:flex;align-items:center;gap:10px;';
    imgArea2.innerHTML = '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);padding:6px 12px;border:1px solid var(--border-color);border-radius:8px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>Attach Image<input type="file" accept="image/*" onchange="handleSocialPublisherImageUpload(this)" style="display:none;"></label><span id="socialPublisherImageStatus" style="font-size:11px;color:var(--text-muted);"></span>';
    cardsEl.parentNode.insertBefore(imgArea2, cardsEl.nextSibling);
  }
  showToast('Image removed', 'info');
}

// v18.1: FEATURE 10 — Handle image upload for social publisher
function handleSocialPublisherImageUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'warning'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    window._socialPublisherImage = e.target.result;
    var status = document.getElementById('socialPublisherImageStatus');
    if (status) { status.textContent = 'Image attached'; status.style.color = 'var(--accent)'; }
    // v18.2: Show image preview
    var existingPreview = document.getElementById('socialPublisherImgPreview');
    if (existingPreview) existingPreview.remove();
    var cardsEl = document.getElementById('socialPlatformCards');
    if (cardsEl) {
      var imgPreview = document.createElement('div');
      imgPreview.className = 'social-publisher-image-preview';
      imgPreview.id = 'socialPublisherImgPreview';
      imgPreview.innerHTML = '<img src="' + e.target.result + '" alt="Attached image">';
      cardsEl.parentNode.insertBefore(imgPreview, cardsEl);
    }
    showToast('Image attached for posting', 'success');
  };
  reader.readAsDataURL(file);
}

function closeSocialPublisher() {
  // v25.4: No-op — publisher is now a permanent tab in Media Lab
}

// v20.8: Auto-refresh expired social tokens before posting
// X tokens expire after 2 hours; Threads/Instagram after 60 days
function refreshSocialTokenIfNeeded(platform, tokenData) {
  if (!tokenData || !tokenData.accessToken) return Promise.resolve(tokenData);
  var now = Date.now();
  var expiresAt = tokenData.expiresAt || 0;
  if (expiresAt && expiresAt > now + 300000) return Promise.resolve(tokenData);
  if (!expiresAt && platform !== 'x') return Promise.resolve(tokenData);
  // v20.12: If X token is expired and has no refreshToken, surface the error instead of silently using stale token
  if (platform === 'x' && !tokenData.refreshToken) {
    if (expiresAt && expiresAt < now) {
      showToast('X token expired. Reconnect X in Settings.', 'error');
      return Promise.resolve(null);
    }
    return Promise.resolve(tokenData);
  }
  var refreshBody = { platform: platform, action: 'refresh' };
  if (platform === 'x') { refreshBody.refreshToken = tokenData.refreshToken; }
  else { refreshBody.accessToken = tokenData.accessToken; }
  // v20.14: Pass UID + scope so server can update Firestore with refreshed token (cross-device)
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      refreshBody.uid = firebase.auth().currentUser.uid;
      refreshBody.scope = getSocialKeyScope();
    }
  } catch(e) {}
  return fetch('/api/social-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(refreshBody)
  }).then(function(resp) {
    if (!resp.ok) throw new Error('Refresh HTTP ' + resp.status);
    return resp.json();
  }).then(function(data) {
    if (!data || !data.accessToken) throw new Error('No accessToken in refresh');
    var updated = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || tokenData.refreshToken || '',
      expiresAt: data.expiresAt || (now + ((data.expiresIn || 7200) * 1000)),
      userId: tokenData.userId || ''
    };
    storeSocialToken(platform, updated);
    return updated;
  }).catch(function(err) {
    // v20.12: If token is expired AND refresh failed, don't silently use the stale token
    if (expiresAt && expiresAt < now) {
      var pName = (typeof SOCIAL_PLATFORM_NAMES !== 'undefined' && SOCIAL_PLATFORM_NAMES[platform]) || platform;
      showToast(pName + ' token expired and refresh failed. Reconnect in Settings.', 'error');
      return null;
    }
    return tokenData;
  });
}

// v22.39: Social Outbox — queue posts for review when guardrails require approval
var _socialOutboxCache = null;

function getSocialOutbox() {
  if (_socialOutboxCache !== null) return _socialOutboxCache;
  try { return JSON.parse(localStorage.getItem('roweos_social_outbox') || '[]'); } catch(e) { return []; }
}

function saveSocialOutbox(items) {
  _socialOutboxCache = items;
  localStorage.setItem('roweos_social_outbox', JSON.stringify(items));
  writeDB('profile/main', { socialOutbox: items }); // v25.1
  updateSocialOutboxBadge();
  if (typeof updatePendingApprovalBadge === 'function') updatePendingApprovalBadge();
}

function addToSocialOutbox(platform, content, image) {
  var outbox = getSocialOutbox();
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var brandName = (typeof brands !== 'undefined' && brands[brandIdx]) ? (brands[brandIdx].shortName || brands[brandIdx].name) : '';
  outbox.push({
    id: 'so_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
    platform: platform,
    content: content,
    image: image || null,
    brandIndex: brandIdx,
    brandName: brandName,
    createdAt: new Date().toISOString(),
    status: 'pending'
  });
  saveSocialOutbox(outbox);
  showToast('Post queued for approval in Automations', 'info');
}

function socialOutboxSend(itemId) {
  var outbox = getSocialOutbox();
  var item = null;
  var idx = -1;
  for (var i = 0; i < outbox.length; i++) {
    if (outbox[i].id === itemId) { item = outbox[i]; idx = i; break; }
  }
  if (!item) return;
  // Set globals for postToSocial
  window._socialPublisherContent = item.content;
  window._socialPublisherEditedContent = {};
  window._socialPublisherImage = item.image || null;
  // Post with bypass flag to skip outbox re-queue
  window._socialOutboxBypass = true;
  postToSocial(item.platform, { silent: false }).then(function(result) {
    window._socialOutboxBypass = false;
    if (result && result.success) {
      // v22.44: Don't tombstone sent posts — they're posted, not deleted
      outbox.splice(idx, 1);
      saveSocialOutbox(outbox);
      if (typeof renderPendingApproval === 'function') renderPendingApproval();
      showToast('Posted to ' + (SOCIAL_PLATFORM_NAMES[item.platform] || item.platform) + '!', 'success');
    } else {
      showToast('Post failed: ' + (result && result.error || 'Unknown error'), 'error');
    }
  }).catch(function() {
    window._socialOutboxBypass = false;
  });
}

function socialOutboxDelete(itemId) {
  var outbox = getSocialOutbox().filter(function(m) { return m.id !== itemId; });
  saveSocialOutbox(outbox);
  addMailDeletedId(itemId); // v22.39: Tombstone for cross-device sync
  if (typeof renderPendingApproval === 'function') renderPendingApproval();
  showToast('Post removed from pending approval', 'success');
}

function updateSocialOutboxBadge() {
  var count = getSocialOutbox().length;
  var badge = document.getElementById('socialOutboxBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

function renderSocialOutbox() {
  var container = document.getElementById('socialOutboxContent');
  if (!container) return;
  var outbox = getSocialOutbox();
  if (outbox.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: var(--text-muted);"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 10px; opacity: 0.4;"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg><div style="font-size: 13px; margin-bottom: 4px;">No posts pending review</div><div style="font-size: 11px;">Posts will appear here when approval is required in Guardrails.</div></div>';
    return;
  }
  var html = '';
  outbox.forEach(function(item) {
    var pName = (typeof SOCIAL_PLATFORM_NAMES !== 'undefined' && SOCIAL_PLATFORM_NAMES[item.platform]) || item.platform;
    var timeStr = item.createdAt ? new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    html += '<div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; margin-bottom: 10px;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
    html += '<div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">' + escapeHtml(pName) + '</span>';
    if (item.brandName) html += '<span style="font-size: 10px; color: var(--text-muted); background: var(--bg-primary); padding: 2px 6px; border-radius: 4px;">' + escapeHtml(item.brandName) + '</span>';
    html += '</div>';
    html += '<span style="font-size: 11px; color: var(--text-muted);">' + timeStr + '</span>';
    html += '</div>';
    html += '<div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 10px; white-space: pre-wrap; max-height: 100px; overflow-y: auto;">' + escapeHtml((item.content || '').substring(0, 500)) + '</div>';
    if (item.image) html += '<div style="margin-bottom: 10px;"><img src="' + item.image.substring(0, 200) + '..." style="max-height: 60px; border-radius: 6px; opacity: 0.7;" alt="Attached image"></div>';
    html += '<div style="display: flex; gap: 8px; justify-content: flex-end;">';
    html += '<button onclick="socialOutboxDelete(\'' + item.id + '\')" class="btn btn-small" style="padding: 5px 12px; font-size: 11px; color: #ef4444;">Delete</button>';
    html += '<button onclick="socialOutboxSend(\'' + item.id + '\')" class="btn btn-small" style="padding: 5px 12px; font-size: 11px; background: var(--brand-accent); color: #000; font-weight: 600;">Approve & Post</button>';
    html += '</div></div>';
  });
  container.innerHTML = html;
}

// v22.39: Check if social posting requires approval via guardrails
function socialPostRequiresApproval() {
  return guardrailsConfig && guardrailsConfig.automationGuardrails && guardrailsConfig.automationGuardrails.approvalRequired && guardrailsConfig.automationGuardrails.approvalRequired.social;
}

// v22.40: Unified Pending Approval — email and document queues
function emailApprovalRequired() {
  return guardrailsConfig && guardrailsConfig.automationGuardrails && guardrailsConfig.automationGuardrails.approvalRequired && guardrailsConfig.automationGuardrails.approvalRequired.email;
}
function docApprovalRequired() {
  return guardrailsConfig && guardrailsConfig.automationGuardrails && guardrailsConfig.automationGuardrails.approvalRequired && guardrailsConfig.automationGuardrails.approvalRequired.docs;
}

var _pendingApprovalCache = null;
function getPendingApproval() {
  if (_pendingApprovalCache !== null) return _pendingApprovalCache;
  try { return JSON.parse(localStorage.getItem('roweos_pending_approval') || '[]'); } catch(e) { return []; }
}
function savePendingApproval(items) {
  _pendingApprovalCache = items;
  localStorage.setItem('roweos_pending_approval', JSON.stringify(items));
  writeDB('profile/main', { pendingApproval: items }); // v25.1
  updatePendingApprovalBadge();
}
function addToPendingApproval(item) {
  var queue = getPendingApproval();
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var brandName = (typeof brands !== 'undefined' && brands[brandIdx]) ? (brands[brandIdx].shortName || brands[brandIdx].name) : '';
  item.id = 'pa_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  item.brandIndex = brandIdx;
  item.brandName = brandName;
  item.createdAt = new Date().toISOString();
  item.status = 'pending';
  queue.push(item);
  savePendingApproval(queue);
  return item;
}

function pendingApprovalDelete(itemId) {
  // Check social outbox first
  var socOutbox = getSocialOutbox();
  var socIdx = -1;
  for (var si = 0; si < socOutbox.length; si++) { if (socOutbox[si].id === itemId) { socIdx = si; break; } }
  if (socIdx !== -1) {
    socialOutboxDelete(itemId);
    renderPendingApproval();
    return;
  }
  // Check pending approval queue
  var queue = getPendingApproval().filter(function(m) { return m.id !== itemId; });
  savePendingApproval(queue);
  if (typeof addMailDeletedId === 'function') addMailDeletedId(itemId);
  renderPendingApproval();
  showToast('Item removed from pending approval', 'success');
}

function pendingApprovalApprove(itemId) {
  // Check social outbox
  var socOutbox = getSocialOutbox();
  var socItem = null;
  for (var si = 0; si < socOutbox.length; si++) { if (socOutbox[si].id === itemId) { socItem = socOutbox[si]; break; } }
  if (socItem) {
    socialOutboxSend(itemId);
    return;
  }
  // Check pending approval queue
  var queue = getPendingApproval();
  var item = null;
  var idx = -1;
  for (var i = 0; i < queue.length; i++) { if (queue[i].id === itemId) { item = queue[i]; idx = i; break; } }
  if (!item) return;

  if (item.type === 'email') {
    // Move to mail outbox and auto-send
    var emailData = item.data || {};
    emailData._approvalBypass = true;
    var outboxItem = addToMailOutbox(emailData);
    if (outboxItem && typeof mailSendOutboxItem === 'function') {
      mailSendOutboxItem(outboxItem.id);
    }
    queue.splice(idx, 1);
    savePendingApproval(queue);
    // v22.44: Don't tombstone approved emails — they move to outbox/sent, not deleted
    renderPendingApproval();
    showToast('Email approved and sending', 'success');
  } else if (item.type === 'document') {
    // Save to library directly using same logic as confirmSaveToLibrary
    var docData = item.data || {};
    try {
      var file = {
        id: 'file_' + Date.now(),
        name: docData.name || 'Untitled Document',
        folderId: docData.folderId || 'root',
        content: docData.content || '',
        operation: docData.agentType || 'Documents',
        source: docData.source || '',
        savedAt: Date.now(),
        storageMode: 'local'
      };
      if (docData.conversation) file.conversation = docData.conversation;
      if (docData.isLifeMode) {
        var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{"files":[],"folders":[]}');
        if (!lifeLib.files) lifeLib.files = [];
        lifeLib.files.push(file);
        if (typeof fileLibrary !== 'undefined') fileLibrary['_life'] = lifeLib;
        if (typeof saveLifeLibrary === 'function') saveLifeLibrary();
        else localStorage.setItem('roweos_life_library', JSON.stringify(lifeLib));
      } else {
        var bIdx = docData.brandIdx != null ? docData.brandIdx : item.brandIndex;
        var lib = typeof getLibraryForBrandIndex === 'function' ? getLibraryForBrandIndex(bIdx) : { files: [], folders: [] };
        file.brand = docData.source || '';
        lib.files.push(file);
        if (typeof saveLibrary === 'function') saveLibrary();
      }
    } catch(e) {
      console.error('[pendingApprovalApprove] Library save error:', e);
    }
    queue.splice(idx, 1);
    savePendingApproval(queue);
    // v22.44: Don't tombstone approved documents — they move to library, not deleted
    renderPendingApproval();
    if (typeof currentView !== 'undefined' && currentView === 'library' && typeof renderLibraryView === 'function') renderLibraryView();
    showToast('Document approved and saved to Library', 'success');
  }
}

function updatePendingApprovalBadge() {
  var total = getSocialOutbox().length + getPendingApproval().length;
  var badge = document.getElementById('pendingApprovalBadge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
}

function renderPendingApproval() {
  var container = document.getElementById('autoLabPending');
  if (!container) return;

  // Merge social outbox + pending approval queue
  var socialItems = getSocialOutbox().map(function(s) {
    return { id: s.id, type: 'social', label: (typeof SOCIAL_PLATFORM_NAMES !== 'undefined' && SOCIAL_PLATFORM_NAMES[s.platform]) || s.platform, preview: (s.content || '').substring(0, 300), brandName: s.brandName || '', createdAt: s.createdAt, raw: s };
  });
  var otherItems = getPendingApproval().map(function(p) {
    var label = p.type === 'email' ? 'Email to ' + escapeHtml((p.data && p.data.to) || 'unknown') : 'Document: ' + escapeHtml((p.data && p.data.name) || 'Untitled');
    var preview = p.type === 'email' ? (p.data && p.data.subject ? escapeHtml(p.data.subject) : '(No subject)') : (p.data && p.data.content ? escapeHtml(p.data.content.substring(0, 200)) : '');
    return { id: p.id, type: p.type, label: label, preview: preview, brandName: p.brandName || '', createdAt: p.createdAt, raw: p };
  });

  var allItems = socialItems.concat(otherItems);
  allItems.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  updatePendingApprovalBadge();

  if (allItems.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);">' +
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.3;"><path d="M9 12l2 2 4-4"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>' +
      '<div style="font-size:14px;font-weight:500;margin-bottom:4px;">No items pending approval</div>' +
      '<div style="font-size:12px;">When Guardrails require approval for social posts, emails, or documents, they will appear here.</div>' +
      '</div>';
    return;
  }

  var typeColors = { social: '#a78bfa', email: '#f472b6', document: '#4ade80' };
  var typeIcons = {
    social: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
    email: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    document: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  };
  var actionLabels = { social: 'Approve & Post', email: 'Approve & Send', document: 'Approve & Save' };

  var html = '<div style="padding:4px 0;">';
  allItems.forEach(function(item, idx) {
    var color = typeColors[item.type] || '#a89878';
    var icon = typeIcons[item.type] || '';
    var actionLabel = actionLabels[item.type] || 'Approve';
    var timeStr = item.createdAt ? new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    var typeName = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    var expandId = 'pendingPreview_' + idx;

    html += '<div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:14px;margin-bottom:10px;">';
    // Header row — clickable to expand
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:pointer;" onclick="var el=document.getElementById(\'' + expandId + '\');if(el)el.style.display=el.style.display===\'none\'?\'block\':\'none\';">';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:' + color + ';background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">' + icon + ' ' + typeName + '</span>';
    html += '<span style="font-size:12px;font-weight:600;color:var(--text-primary);">' + escapeHtml(item.label) + '</span>';
    if (item.brandName) html += '<span style="font-size:10px;color:var(--text-muted);background:var(--bg-primary);padding:2px 6px;border-radius:4px;">' + escapeHtml(item.brandName) + '</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<span style="font-size:11px;color:var(--text-muted);">' + timeStr + '</span>';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" style="transition:transform 0.15s;"><path d="M6 9l6 6 6-6"/></svg>';
    html += '</div></div>';
    // Preview text (always visible)
    if (item.preview) {
      html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin-bottom:10px;">' + escapeHtml(item.preview) + '</div>';
    }
    // v22.44: Expandable email template preview
    var hasHtmlPreview = item.type === 'email' && item.raw && item.raw.data && item.raw.data.html;
    html += '<div id="' + expandId + '" style="display:none;margin-bottom:10px;">';
    if (hasHtmlPreview) {
      html += '<div style="border:1px solid var(--border-color);border-radius:8px;overflow:hidden;overflow-y:auto;background:#fff;">';
      html += '<iframe id="pendingFrame_' + idx + '" style="width:100%;min-height:300px;border:none;" srcdoc="' + escapeHtml(item.raw.data.html).replace(/"/g, '&quot;') + '" onload="try{var d=this.contentDocument||this.contentWindow.document;var h=d.documentElement.scrollHeight||d.body.scrollHeight;if(h>100)this.style.height=(h+20)+\'px\';}catch(e){}"></iframe>';
      html += '</div>';
      // Email metadata
      html += '<div style="margin-top:8px;font-size:11px;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:12px;">';
      html += '<span>To: <strong style="color:var(--text-secondary);">' + escapeHtml((item.raw.data && item.raw.data.to) || '') + '</strong></span>';
      html += '<span>From: <strong style="color:var(--text-secondary);">' + escapeHtml((item.raw.data && item.raw.data.from) || '') + '</strong></span>';
      if (item.raw.data && item.raw.data.attachments && item.raw.data.attachments.length) {
        html += '<span>' + item.raw.data.attachments.length + ' attachment(s)</span>';
      }
      html += '</div>';
    } else if (item.type === 'social' && item.raw) {
      // Social post expanded preview
      var socialContent = (item.raw.content || '').replace(/\n/g, '<br>');
      html += '<div style="font-size:13px;color:var(--text-primary);line-height:1.6;padding:12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border-color);white-space:pre-wrap;">' + socialContent + '</div>';
      if (item.raw.imageUrl) html += '<img src="' + escapeHtml(item.raw.imageUrl) + '" style="max-width:200px;border-radius:8px;margin-top:8px;">';
    }
    html += '</div>';
    // Actions — v22.47: Use auto-lab-card-btn instead of btn class to avoid dark mode text color issues
    html += '<div style="display:flex;gap:8px;justify-content:flex-end;">';
    html += '<button onclick="pendingApprovalDelete(\'' + item.id + '\')" class="auto-lab-card-btn" style="padding:5px 12px;font-size:11px;color:#ef4444;background:none;border:1px solid rgba(239,68,68,0.2);">Delete</button>';
    if (item.type === 'email') {
      html += '<button onclick="pendingApprovalEditInMail(\'' + item.id + '\')" class="auto-lab-card-btn" style="padding:5px 12px;font-size:11px;color:var(--text-primary);background:none;border:1px solid var(--border-color);"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> Edit</button>';
    }
    html += '<button onclick="pendingApprovalApprove(\'' + item.id + '\')" class="auto-lab-card-btn" style="padding:5px 12px;font-size:11px;background:var(--brand-accent);color:#fff;font-weight:600;border:none;">' + actionLabel + '</button>';
    html += '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// v22.44: Edit pending email in Mail Compose
function pendingApprovalEditInMail(id) {
  var items = getPendingApproval();
  var item = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === id) { item = items[i]; break; }
  }
  if (!item || item.type !== 'email' || !item.data) { showToast('Item not found', 'error'); return; }

  // Move to outbox first (so it persists), then open in compose
  var emailData = item.data;
  emailData._approvalBypass = true;
  var outboxItem = addToMailOutbox(emailData);

  // Remove from pending
  items = items.filter(function(p) { return p.id !== id; });
  savePendingApproval(items);
  renderPendingApproval();

  // Switch to Mail view and open in compose
  showView('mail');
  setTimeout(function() {
    if (outboxItem && outboxItem.id && typeof mailEditOutboxItem === 'function') {
      mailEditOutboxItem(outboxItem.id);
    }
  }, 300);
}

// v25.4: Post to TikTok via Content Posting API
function postToTikTok(content, imageBase64) {
  // TikTok requires media — text-only not supported
  if (!imageBase64) {
    return Promise.resolve({ success: false, platform: 'tiktok', error: 'TikTok requires an image or video' });
  }
  // For now, use Photo Mode for image posts
  // Video posting requires more complex upload flow
  var token = getSocialToken('tiktok');
  if (!token) {
    return Promise.resolve({ success: false, platform: 'tiktok', error: 'TikTok not connected' });
  }

  // TikTok Photo Mode: POST /v2/post/publish/content/init/
  return fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      post_info: {
        title: content.substring(0, 2200),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_comment: false
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: [imageBase64]
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO'
    })
  })
  .then(function(resp) { return resp.json(); })
  .then(function(data) {
    if (data.error && data.error.code !== 'ok') {
      return { success: false, platform: 'tiktok', error: data.error.message || 'TikTok post failed' };
    }
    return { success: true, platform: 'tiktok', postId: data.data ? data.data.publish_id : null };
  })
  .catch(function(err) {
    return { success: false, platform: 'tiktok', error: err.message };
  });
}

// v20.6: postToSocial returns a Promise with {success, platform, postUrl, error} for tracking
function postToSocial(platform, opts) {
  opts = opts || {};
  var silent = opts.silent || false; // suppress toasts when called from postFromChatCard
  // v18.2: Use edited content if user made changes
  var edited = window._socialPublisherEditedContent && window._socialPublisherEditedContent[platform];
  var content = edited || window._socialPublisherContent || '';
  var formatted = edited || formatForPlatform(content, platform);

  // v22.39: Intercept — queue to outbox if approval required (unless bypassing from outbox send)
  // v22.47: Also intercept if _forceApprovalQueue is set (per-automation requireApproval toggle)
  if (!window._socialOutboxBypass && (socialPostRequiresApproval() || window._forceApprovalQueue)) {
    addToSocialOutbox(platform, formatted, window._socialPublisherImage || null);
    return Promise.resolve({ success: true, platform: platform, queued: true });
  }

  if (!isSocialConnected(platform)) {
    if (!silent) showToast('Connect ' + SOCIAL_PLATFORM_NAMES[platform] + ' in Settings first', 'warning');
    return Promise.resolve({ success: false, platform: platform, error: 'Not connected' });
  }

  if (!silent) showToast('Posting to ' + SOCIAL_PLATFORM_NAMES[platform] + '...', 'info');

  return getSocialToken(platform).then(function(tokenData) {
    if (!tokenData || !tokenData.accessToken) {
      if (!silent) showToast('No token found. Reconnect ' + SOCIAL_PLATFORM_NAMES[platform] + ' in Settings.', 'error');
      return { success: false, platform: platform, error: 'No token found' };
    }

    // v17.2: Threads/Instagram require userId from OAuth
    if ((platform === 'threads' || platform === 'instagram') && !tokenData.userId) {
      if (!silent) showToast('Missing user ID for ' + SOCIAL_PLATFORM_NAMES[platform] + '. Disconnect and reconnect in Settings.', 'error');
      return { success: false, platform: platform, error: 'Missing user ID' };
    }

    // v20.8: Auto-refresh expired tokens before posting
    return refreshSocialTokenIfNeeded(platform, tokenData);
  }).then(function(tokenData) {
    if (!tokenData || !tokenData.accessToken) {
      return { success: false, platform: platform, error: 'No token after refresh' };
    }

    var postBody = {
      platform: platform,
      accessToken: tokenData.accessToken,
      content: formatted,
      userId: tokenData.userId || ''
    };

    // v25.4: TikTok — client-side direct posting via Content Posting API
    if (platform === 'tiktok') {
      return postToTikTok(formatted, window._socialPublisherImage || null).then(function(result) {
        if (result.success) {
          saveSocialPost(platform, formatted, null, 'posted');
        } else {
          saveSocialPost(platform, formatted, null, 'failed');
        }
        return result;
      });
    }

    // v18.5: Upload image for all platforms if attached
    var imgUploadPromise = Promise.resolve(null);
    if (window._socialPublisherImage) {
      if (platform === 'x') {
        imgUploadPromise = fetch('/api/social-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'x', accessToken: tokenData.accessToken, imageBase64: window._socialPublisherImage })
        }).then(function(r) { return r.json(); }).then(function(d) { return d.mediaId || null; }).catch(function() { return null; });
      } else if (platform === 'threads' || platform === 'instagram') {
        postBody.imageBase64 = window._socialPublisherImage;
      }
    }

    return imgUploadPromise.then(function(mediaId) {
      if (mediaId) postBody.mediaIds = [mediaId];
      return fetch('/api/social-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody)
      });
    }).then(function(resp) {
      if (!resp) return { success: false, platform: platform, error: 'No response' };
      return resp.json();
    }).then(function(data) {
      if (!data) return { success: false, platform: platform, error: 'No data' };
      if (data.error) {
        var detail = data.detail ? (data.detail.error ? JSON.stringify(data.detail.error) : JSON.stringify(data.detail)).substring(0, 120) : '';
        var errorMsg = data.error + (detail ? ' (' + detail + ')' : '');
        saveSocialPost(platform, formatted, null, 'failed');
        return { success: false, platform: platform, error: errorMsg };
      }
      saveSocialPost(platform, formatted, data.postUrl || null, 'posted');
      return { success: true, platform: platform, postUrl: data.postUrl || null };
    });
  }).catch(function(err) {
    saveSocialPost(platform, formatted, null, 'failed');
    return { success: false, platform: platform, error: err.message || 'Unknown error' };
  });
}

// v20.6: Post directly from chat social card — properly awaits each platform result
function postFromChatCard(cardIndex) {
  var proposal = window._chatSocialProposals && window._chatSocialProposals[cardIndex];
  if (!proposal) { showToast('Post data not found', 'error'); return; }

  var card = document.getElementById('socialChatCard_' + cardIndex);
  if (!card) return;

  // v20.6: Only post to checked AND enabled platforms (disabled = already posted successfully)
  var checkedBoxes = card.querySelectorAll('.chat-social-plat:checked:not(:disabled)');
  var platforms = [];
  for (var i = 0; i < checkedBoxes.length; i++) {
    platforms.push(checkedBoxes[i].getAttribute('data-platform'));
  }
  if (platforms.length === 0) { showToast('Select at least one platform', 'warning'); return; }

  var text = proposal.editedText || proposal.data.text;

  // Set globals that postToSocial reads
  window._socialPublisherContent = text;
  window._socialPublisherImage = proposal.image || null;
  window._socialPublisherEditedContent = {};

  // Disable button during posting
  var btn = document.getElementById('socialChatPostBtn_' + cardIndex);
  if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; btn.style.opacity = '0.6'; }

  var results = [];

  function postNext(idx) {
    if (idx >= platforms.length) {
      // All done — update per-platform pill status
      var successCount = 0;
      var failCount = 0;
      var queuedCount = 0;
      var successUrls = [];
      results.forEach(function(r) {
        if (r.queued) { queuedCount++; }
        else if (r.success) { successCount++; if (r.postUrl) successUrls.push({ platform: r.platform, url: r.postUrl }); }
        else { failCount++; }
        // v20.6: Update platform pill to show success/fail/queued status
        if (r.queued) { updateChatSocialPlatformStatus(cardIndex, { success: true, platform: r.platform, queued: true }); }
        else { updateChatSocialPlatformStatus(cardIndex, r); }
      });

      if (btn) {
        if (queuedCount > 0 && failCount === 0 && successCount === 0) {
          btn.textContent = 'Queued for Review';
          btn.style.background = '#f59e0b';
          btn.disabled = true;
          btn.style.opacity = '1';
        } else if (failCount === 0) {
          btn.textContent = 'Posted!';
          btn.style.background = '#22c55e';
          btn.disabled = true;
          btn.style.opacity = '1';
        } else if (successCount > 0) {
          btn.textContent = 'Retry Failed (' + failCount + ')';
          btn.style.background = '#f59e0b';
          btn.disabled = false; btn.style.opacity = '1';
        } else {
          btn.textContent = 'Post Failed: Retry';
          btn.style.background = '#ef4444';
          btn.disabled = false; btn.style.opacity = '1';
        }
      }

      // Show summary toast with details
      if (queuedCount > 0) {
        showToast(queuedCount + ' post' + (queuedCount > 1 ? 's' : '') + ' queued for approval in Automations > Pending', 'info');
      } else if (failCount > 0 && successCount > 0) {
        var failedNames = results.filter(function(r) { return !r.success; }).map(function(r) { return SOCIAL_PLATFORM_NAMES[r.platform]; }).join(', ');
        showToast(successCount + ' posted, ' + failCount + ' failed (' + failedNames + ')', 'warning');
      } else if (failCount > 0) {
        var errDetail = results[0] && results[0].error ? ': ' + results[0].error.substring(0, 100) : '';
        showToast('Post failed' + errDetail, 'error');
      } else if (successCount > 0 && successUrls.length > 0) {
        showToast('Posted to ' + successCount + ' platform' + (successCount > 1 ? 's' : '') + '!', 'success');
      }
      return;
    }

    var p = platforms[idx];
    if (btn) btn.textContent = 'Posting to ' + SOCIAL_PLATFORM_NAMES[p] + '...';

    postToSocial(p, { silent: true }).then(function(result) {
      results.push(result);
      // Show per-platform toast for individual results
      if (result.success) {
        showToast('Posted to ' + SOCIAL_PLATFORM_NAMES[p] + '!', 'success');
      } else {
        showToast(SOCIAL_PLATFORM_NAMES[p] + ' failed: ' + (result.error || 'Unknown error').substring(0, 100), 'error');
      }
      setTimeout(function() { postNext(idx + 1); }, 500);
    }).catch(function() {
      results.push({ success: false, platform: p, error: 'Unknown error' });
      setTimeout(function() { postNext(idx + 1); }, 500);
    });
  }
  postNext(0);
}

// v20.6: Update platform pill in chat social card to show post result status
function updateChatSocialPlatformStatus(cardIndex, result) {
  var card = document.getElementById('socialChatCard_' + cardIndex);
  if (!card) return;

  // Find the label containing this platform's checkbox
  var checkboxes = card.querySelectorAll('.chat-social-plat');
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].getAttribute('data-platform') === result.platform) {
      var label = checkboxes[i].closest('label');
      if (!label) continue;

      if (result.success) {
        // Green background, checkmark, disable checkbox
        label.style.background = 'rgba(34,197,94,0.15)';
        label.style.borderColor = 'rgba(34,197,94,0.3)';
        label.style.border = '1px solid rgba(34,197,94,0.3)';
        checkboxes[i].disabled = true;
        // Add success indicator + post link
        var statusEl = label.querySelector('.chat-social-status');
        if (!statusEl) {
          statusEl = document.createElement('span');
          statusEl.className = 'chat-social-status';
          label.appendChild(statusEl);
        }
        var linkHtml = result.postUrl ? '<a href="' + result.postUrl + '" target="_blank" onclick="event.stopPropagation();" style="color:#22c55e;text-decoration:underline;font-size:11px;margin-left:4px;">View</a>' : '';
        statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;vertical-align:middle;"><polyline points="20 6 9 17 4 12"/></svg>' + linkHtml;
      } else {
        // Red border, error indicator, keep checkbox enabled for retry
        label.style.background = 'rgba(239,68,68,0.1)';
        label.style.border = '1px solid rgba(239,68,68,0.3)';
        checkboxes[i].checked = true; // keep checked for retry
        var statusEl2 = label.querySelector('.chat-social-status');
        if (!statusEl2) {
          statusEl2 = document.createElement('span');
          statusEl2.className = 'chat-social-status';
          label.appendChild(statusEl2);
        }
        statusEl2.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;vertical-align:middle;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
          '<span style="color:#ef4444;font-size:10px;margin-left:2px;" title="' + escapeHtml(result.error || 'Failed') + '">Failed</span>';
      }
      break;
    }
  }
}

// v19.8: Toggle edit mode on chat social card text
function toggleChatSocialEdit(cardIndex) {
  var preview = document.getElementById('socialChatPreview_' + cardIndex);
  var editor = document.getElementById('socialChatEdit_' + cardIndex);
  if (!preview || !editor) return;

  var proposal = window._chatSocialProposals && window._chatSocialProposals[cardIndex];
  if (!proposal) return;

  if (editor.style.display === 'none') {
    // Switch to edit mode
    editor.value = proposal.editedText || proposal.data.text;
    preview.style.display = 'none';
    editor.style.display = 'block';
    editor.focus();
  } else {
    // Switch back to preview, save edits
    proposal.editedText = editor.value;
    preview.textContent = editor.value;
    editor.style.display = 'none';
    preview.style.display = 'block';
    updateChatSocialCharCounts(cardIndex);
  }
}

// v19.8: Update char counts in chat social card when editing
function updateChatSocialCharCounts(cardIndex) {
  var proposal = window._chatSocialProposals && window._chatSocialProposals[cardIndex];
  if (!proposal) return;

  var editor = document.getElementById('socialChatEdit_' + cardIndex);
  var text = editor && editor.style.display !== 'none' ? editor.value : (proposal.editedText || proposal.data.text);

  var allPlatforms = ['x', 'threads', 'instagram', 'tiktok'];
  allPlatforms.forEach(function(p) {
    var el = document.getElementById('socialCharCount_' + cardIndex + '_' + p);
    if (!el) return;
    var limit = SOCIAL_PLATFORM_LIMITS[p];
    el.textContent = text.length + '/' + limit;
    el.style.color = text.length > limit ? '#ef4444' : 'var(--apc-sub, #b0a898)';
  });
}

// v19.8: Open full publisher pre-filled from chat card
// v20.8: Open Publisher navigates to Studio and opens the social publisher panel pre-filled
function openPublisherFromChat(cardIndex) {
  var proposal = window._chatSocialProposals && window._chatSocialProposals[cardIndex];
  if (!proposal) { showToast('Post data not found', 'error'); return; }

  var text = proposal.editedText || proposal.data.text;
  window._socialPublisherContent = text;
  window._socialPublisherImage = proposal.image || null;
  window._socialPublisherEditedContent = {};

  // Navigate to Studio view first, then open publisher after DOM is ready
  showView('studio');
  setTimeout(function() {
    showSocialPublisher(text, proposal.data.platforms);
  }, 150);
}

function copyAndOpenSocial(platform) {
  // v18.2: Use edited content if user made changes
  var edited = window._socialPublisherEditedContent && window._socialPublisherEditedContent[platform];
  var content = edited || window._socialPublisherContent || '';
  var formatted = edited || formatForPlatform(content, platform);

  try {
    navigator.clipboard.writeText(formatted);
    showToast('Copied! Opening ' + SOCIAL_PLATFORM_NAMES[platform] + '...', 'success');
  } catch(e) {
    showToast('Copy failed', 'error');
    return;
  }

  var deepLinks = {
    x: 'https://x.com/intent/tweet?text=' + encodeURIComponent(formatted.substring(0, 280)),
    threads: 'https://www.threads.net/intent/post?text=' + encodeURIComponent(formatted.substring(0, 500)),
    instagram: 'https://www.instagram.com/',
    tiktok: 'https://www.tiktok.com/upload'
  };

  setTimeout(function() {
    window.open(deepLinks[platform], '_blank');
  }, 300);

  saveSocialPost(platform, formatted, null, 'copied');
}

function scheduleSocialPost(platform) {
  var content = window._socialPublisherContent || '';
  var formatted = formatForPlatform(content, platform);
  // Pre-fill Automation Lab with a workflow
  window._prefillWorkflow = {
    action: 'post',
    target: {
      platforms: [platform],
      text: formatted,
      includeImage: false
    }
  };
  showView('automations');
  showToast('Create a scheduled workflow for ' + SOCIAL_PLATFORM_NAMES[platform], 'info');
}

// --- Post History ---
function getSocialPosts() {
  try { var _sp = JSON.parse(localStorage.getItem('roweos_social_posts') || '[]'); return Array.isArray(_sp) ? _sp : []; } catch(e) { return []; }
}
function saveSocialPost(platform, content, postUrl, status) {
  try {
    var posts = getSocialPosts();
    var selectedBrandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
    posts.unshift({
      id: String(Date.now()),
      platform: platform,
      content: content.substring(0, 500),
      postUrl: postUrl || null,
      status: status || 'posted',
      postedAt: new Date().toISOString(),
      brandIndex: selectedBrandIdx,
      source: 'studio'
    });
    // Keep last 100
    if (posts.length > 100) posts = posts.slice(0, 100);
    localStorage.setItem('roweos_social_posts', JSON.stringify(posts));
    renderSocialPostHistory();
  } catch(e) {}
}

function toggleSocialPostHistory() {
  var body = document.getElementById('socialPostHistoryBody');
  var toggle = document.getElementById('socialPostHistoryToggle');
  if (!body) return;
  var showing = body.style.display === 'none';
  body.style.display = showing ? 'block' : 'none';
  if (toggle) toggle.innerHTML = showing ? '&#9650;' : '&#9660;';
  if (showing) renderSocialPostHistory();
}

function renderSocialPostHistory() {
  var list = document.getElementById('socialPostHistoryList');
  var countEl = document.getElementById('socialPostHistoryCount');
  if (!list) return;

  var posts = getSocialPosts();
  var selectedBrandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';

  // Filter to current brand
  var filtered = mode === 'brand' ? posts.filter(function(p) { return p.brandIndex === selectedBrandIdx; }) : posts;
  if (countEl) countEl.textContent = filtered.length > 0 ? '(' + filtered.length + ')' : '';

  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px;">No posts yet</div>';
    return;
  }

  var html = '';
  filtered.slice(0, 20).forEach(function(post) {
    var platformIcon = SOCIAL_PLATFORM_NAMES[post.platform] || post.platform;
    var timeStr = '';
    try {
      var d = new Date(post.postedAt);
      timeStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + formatDateTimeDisplay(d);
    } catch(e) { timeStr = post.postedAt; }

    html += '<div class="social-post-history-item"' + (post.postUrl ? ' onclick="window.open(\'' + escapeHtml(post.postUrl) + '\', \'_blank\')"' : '') + '>';
    html += '<div class="social-post-history-header">';
    html += '<div style="display:flex;align-items:center;gap:6px;">';
    html += '<span style="font-weight:600;font-size:12px;">' + escapeHtml(platformIcon) + '</span>';
    html += '<span style="font-size:11px;color:var(--text-muted);">' + timeStr + '</span>';
    html += '</div>';
    html += '<span class="social-post-status ' + (post.status || 'posted') + '">' + (post.status || 'posted') + '</span>';
    html += '</div>';
    html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml((post.content || '').substring(0, 100)) + '</div>';
    html += '</div>';
  });
  list.innerHTML = html;
}

// --- Agent Category Change Handler ---
function onAgentCategoryChange(val) {
  var customWrap = document.getElementById('autoLabAgentCategoryCustomWrap');
  var socialRow = document.getElementById('autoLabAgentSocialRow');
  var socialTemplates = document.getElementById('autoLabSocialTemplates');

  if (customWrap) customWrap.style.display = val === 'custom' ? 'block' : 'none';
  if (socialRow) socialRow.style.display = val === 'social' ? 'flex' : 'none';
  if (socialTemplates) socialTemplates.style.display = val === 'social' ? 'block' : 'none';
}

// --- Social Agent Templates ---
var SOCIAL_AGENT_TEMPLATES = {
  x: {
    name: 'X Strategist',
    platform: 'x',
    tone: 'witty',
    prompt: 'You are an expert X (Twitter) content strategist. You craft punchy, engaging posts that maximize engagement within 280 characters. You understand viral hooks, thread structures, engagement bait (ethical), trending topics, and hashtag strategy. Your posts are concise, impactful, and drive conversation. Always include a hook in the first line. Format threads with numbered parts. Use relevant hashtags sparingly (2-3 max). Consider timing and audience psychology.'
  },
  threads: {
    name: 'Threads Creator',
    platform: 'threads',
    tone: 'casual',
    prompt: 'You are a Threads content creator who specializes in authentic, conversational content. You build community through genuine dialogue, hot takes, and relatable observations. Your posts feel personal and invite discussion. You write within 500 characters, use line breaks for readability, and put hashtags at the end. You avoid hard-sell language and focus on building connection and trust. Your tone is warm, slightly irreverent, and always authentic.'
  },
  instagram: {
    name: 'Instagram Curator',
    platform: 'instagram',
    tone: 'professional',
    prompt: 'You are an Instagram content strategist who creates visual-first captions, story hooks, and carousel copy. You write captions up to 2200 characters with strategic line breaks (using periods on empty lines), compelling opening hooks that avoid being cut off by "...more", and organize hashtags into branded, industry, and community groups (max 30). You understand the Instagram algorithm, optimal posting patterns, and how to drive saves and shares over likes.'
  },
  tiktok: {
    name: 'TikTok Script Writer',
    platform: 'tiktok',
    tone: 'casual',
    prompt: 'You are a TikTok content strategist who writes hook-first video scripts and captions. You understand trending sounds, duet/stitch opportunities, and the TikTok algorithm. Every script starts with a pattern-interrupt hook in the first 1-3 seconds. You write scripts in a natural, speaking voice with stage directions in brackets. Captions are up to 2200 characters with trending hashtags. You format: HOOK > CONTEXT > VALUE > CTA.'
  }
};

function applySocialAgentTemplate(templateId) {
  var template = SOCIAL_AGENT_TEMPLATES[templateId];
  if (!template) return;

  var nameEl = document.getElementById('autoLabAgentName');
  var promptEl = document.getElementById('autoLabAgentPrompt');
  var platformEl = document.getElementById('autoLabAgentSocialPlatform');
  var toneEl = document.getElementById('autoLabAgentDefaultTone');

  if (nameEl) nameEl.value = template.name;
  if (promptEl) promptEl.value = template.prompt;
  if (platformEl) platformEl.value = template.platform;
  if (toneEl) toneEl.value = template.tone;

  showToast('Template applied: ' + template.name, 'success');
}

function prefillSocialAgentPrompt() {
  var platformEl = document.getElementById('autoLabAgentSocialPlatform');
  if (!platformEl) return;
  var p = platformEl.value;
  if (SOCIAL_AGENT_TEMPLATES[p]) {
    var promptEl = document.getElementById('autoLabAgentPrompt');
    if (promptEl && (!promptEl.value.trim() || confirm('Replace current prompt with ' + SOCIAL_PLATFORM_NAMES[p] + ' template?'))) {
      promptEl.value = SOCIAL_AGENT_TEMPLATES[p].prompt;
    }
  }
}

// --- Studio Social Op Integration ---
// After a social op completes, auto-show publisher panel
function checkAndShowSocialPublisher(opId, output) {
  var op = null;
  if (typeof ops !== 'undefined') {
    op = ops.find(function(o) { return o.id === opId; });
  }
  if (!op || !op.isSocialOp) return;

  // v17.0: Use pre-selected platforms if available, else default all
  var platforms = (window._selectedSocialPlatforms && window._selectedSocialPlatforms.length > 0)
    ? window._selectedSocialPlatforms.slice()
    : ['x', 'threads', 'instagram', 'tiktok'];
  showSocialPublisher(output, platforms);
}

// v17.0: Social Platform Selector — pre-run UI for choosing which platforms to publish to
window._selectedSocialPlatforms = [];

function updateSocialPlatformSelector(op) {
  var container = document.getElementById('socialPlatformSelector');
  var grid = document.getElementById('socialPlatformSelectorGrid');
  if (!container || !grid) return;

  if (!op || !op.isSocialOp) {
    container.style.display = 'none';
    window._selectedSocialPlatforms = [];
    return;
  }

  container.style.display = 'flex';
  var allPlatforms = ['x', 'threads', 'instagram', 'tiktok'];
  window._selectedSocialPlatforms = [];
  var html = '';

  allPlatforms.forEach(function(p) {
    var connected = isSocialConnected(p);
    var handle = getSocialHandle(p);
    var name = SOCIAL_PLATFORM_NAMES[p] || p;
    var statusText = '';
    var disabledClass = '';
    var selectedClass = '';

    if (p === 'tiktok') {
      statusText = 'Copy + Open only';
      if (connected) {
        selectedClass = ' selected';
        window._selectedSocialPlatforms.push(p);
      } else {
        disabledClass = ' disabled';
      }
    } else if (connected) {
      statusText = handle ? '@' + escapeHtml(handle) : 'Connected';
      selectedClass = ' selected';
      window._selectedSocialPlatforms.push(p);
    } else {
      statusText = 'Not Connected';
      disabledClass = ' disabled';
    }

    html += '<div class="social-platform-select-item' + selectedClass + disabledClass + '" data-platform="' + p + '"'
      + (disabledClass ? '' : ' onclick="toggleSocialPlatformSelection(\'' + p + '\', this)"')
      + '>';
    html += '<input type="checkbox"' + (selectedClass ? ' checked' : '') + (disabledClass ? ' disabled' : '') + '>';
    html += '<div class="platform-select-info">';
    html += '<span class="platform-select-name">' + escapeHtml(name) + '</span>';
    html += '<span class="platform-select-handle">' + escapeHtml(statusText) + '</span>';
    html += '</div></div>';
  });

  grid.innerHTML = html;
}

function toggleSocialPlatformSelection(platform, el) {
  var idx = window._selectedSocialPlatforms.indexOf(platform);
  var cb = el.querySelector('input[type="checkbox"]');
  if (idx > -1) {
    window._selectedSocialPlatforms.splice(idx, 1);
    el.classList.remove('selected');
    if (cb) cb.checked = false;
  } else {
    window._selectedSocialPlatforms.push(platform);
    el.classList.add('selected');
    if (cb) cb.checked = true;
  }
}

// --- Workflow Engine (v17.0) ---
// v24.18: Comprehensive automation presets - BrandAI focused, both modes
var WORKFLOW_PRESETS = [
  // ═══════════════════════════════════════════════
  // CONTENT & SOCIAL POSTING
  // ═══════════════════════════════════════════════
  {
    id: 'preset_gen_post_x',
    name: 'Write + Post to X',
    desc: 'Marketing Agent writes a platform-optimized X post using your brand voice, hashtag strategy, and current trends, then publishes directly',
    steps: [
      { stepId: 1, action: 'studio', name: 'Write X Post', target: { operationId: 48, agentId: 'marketing', contextRef: 'Write a single X post (max 280 chars). Use the brand voice. Include a strong hook in the first line. Add 1-2 relevant hashtags. Make it engaging and shareable. Output ONLY the post text.' }, outputKey: 'step1_content' },
      { stepId: 2, action: 'post', name: 'Publish to X', target: { platforms: ['x'], contentRef: '{{step1_content}}' } }
    ]
  },
  {
    id: 'preset_gen_img_threads',
    name: 'Write + Image + Post to Threads',
    desc: 'AI writes an authentic Threads post, generates a matching brand image, then publishes both together',
    steps: [
      { stepId: 1, action: 'studio', name: 'Write Threads Post', target: { operationId: 48, agentId: 'marketing', contextRef: 'Write a conversational, authentic Threads post (max 500 chars). Brand voice, relatable tone. Include a thought-provoking question or observation. Output ONLY the post text.' }, outputKey: 'step1_content' },
      { stepId: 2, action: 'image', name: 'Generate Brand Image', target: { text: 'Create a polished brand lifestyle image that complements this social post: {{step1_content}}' }, outputKey: 'step2_image' },
      { stepId: 3, action: 'post', name: 'Publish to Threads', target: { platforms: ['threads'], contentRef: '{{step1_content}}', imageRef: '{{step2_image}}' } }
    ]
  },
  {
    id: 'preset_cross_platform',
    name: 'Cross-Platform Content Blast',
    desc: 'Creates one message adapted for each platform format (X 280 chars, Threads conversational, Instagram visual-first) and posts to all simultaneously',
    steps: [
      { stepId: 1, action: 'studio', name: 'Adapt for All Platforms', target: { operationId: 47, agentId: 'marketing', contextRef: 'Create platform-adapted versions of a brand update. X: punchy, 280 chars max, 1-2 hashtags. Threads: conversational and authentic, 500 chars. Instagram: visual-first caption with line breaks, up to 10 hashtags at end. Output all three versions.' }, outputKey: 'step1_content' },
      { stepId: 2, action: 'post', name: 'Post Everywhere', target: { platforms: ['x', 'threads', 'instagram'], contentRef: '{{step1_content}}' } }
    ]
  },
  {
    id: 'preset_daily_brand',
    name: 'Daily Brand Update',
    desc: 'Recurring automation: AI generates a fresh, topical brand post based on current trends and your brand identity, then publishes to X and Threads',
    steps: [
      { stepId: 1, action: 'studio', name: 'Generate Daily Content', target: { operationId: 45, agentId: 'marketing', contextRef: 'Write a daily brand update post. Reference something timely or relevant to the industry. Keep it fresh and avoid repeating themes from recent posts. Be authentic to the brand voice. Output both an X version (280 chars) and a Threads version (500 chars).' }, outputKey: 'step1_content' },
      { stepId: 2, action: 'post', name: 'Publish Daily', target: { platforms: ['x', 'threads'], contentRef: '{{step1_content}}' } }
    ]
  },
  {
    id: 'preset_image_campaign',
    name: 'Visual Campaign (Image + Caption)',
    desc: 'Generates a brand lifestyle image first, then writes a matching Instagram caption with strategic hashtags, and posts the complete package',
    steps: [
      { stepId: 1, action: 'image', name: 'Create Campaign Image', target: { text: 'Professional brand lifestyle photo for {{brandName}}. Clean, modern aesthetic. No text overlays.' }, outputKey: 'step1_image' },
      { stepId: 2, action: 'studio', name: 'Write Instagram Caption', target: { operationId: 48, agentId: 'marketing', contextRef: 'Write an Instagram caption for a brand lifestyle photo. Open with a hook that wont get cut off by "...more". Use line breaks for readability. Include a call to action. Add 15-20 hashtags at the end, organized by branded, industry, and community groups. Output ONLY the caption text.' }, outputKey: 'step2_content' },
      { stepId: 3, action: 'post', name: 'Post to Instagram', target: { platforms: ['instagram'], contentRef: '{{step2_content}}', imageRef: '{{step1_image}}' } }
    ]
  },
  {
    id: 'preset_thread_series',
    name: 'X Thread Series',
    desc: 'Marketing Agent writes a compelling multi-part X thread (5-7 tweets) with a strong hook, value delivery, and CTA, then posts as a thread',
    steps: [
      { stepId: 1, action: 'studio', name: 'Write Thread', target: { operationId: 46, agentId: 'marketing', contextRef: 'Write a 5-7 part X thread. Part 1: pattern-interrupt hook. Parts 2-5: deliver value, insights, or a story. Part 6: summary or key takeaway. Part 7: CTA (follow, share, reply). Number each part. Each under 280 chars. Use the brand voice throughout.' }, outputKey: 'step1_content' },
      { stepId: 2, action: 'post', name: 'Post Thread to X', target: { platforms: ['x'], contentRef: '{{step1_content}}' } }
    ]
  },

  // ═══════════════════════════════════════════════
  // EMAIL & OUTREACH
  // ═══════════════════════════════════════════════
  {
    id: 'preset_weekly_newsletter',
    name: 'Weekly Newsletter Draft',
    desc: 'Strategy Agent summarizes this week highlights, Marketing writes newsletter copy with branded template, queues to Outbox for review',
    steps: [
      { stepId: 1, action: 'studio', name: 'Summarize Week', target: { operationId: 501, agentId: 'strategy', contextRef: 'Summarize the brand highlights and key developments from this week. Include any wins, milestones, upcoming events, or interesting insights. Keep it concise - 3-5 bullet points max. This will be used as the basis for a client/audience newsletter.' }, outputKey: 'step1_summary' },
      { stepId: 2, action: 'studio', name: 'Write Newsletter', target: { operationId: 509, agentId: 'marketing', contextRef: 'Using these weekly highlights, write a short, engaging newsletter email. Tone: professional but personable. Structure: greeting, 2-3 highlight sections with brief commentary, one CTA, sign-off. Under 400 words. No em-dashes.\n\n{{step1_summary}}' }, outputKey: 'step2_newsletter' },
      { stepId: 3, action: 'outbox', name: 'Queue Newsletter', target: { emailTo: '', emailSubject: 'Weekly Update from {{brandName}}' }, config: { emailTemplate: 'newsletter', emailFrom: '', bccSelf: true } }
    ]
  },
  {
    id: 'preset_client_followup',
    name: 'Client Follow-Up Email',
    desc: 'Documents Agent writes a personalized follow-up email based on your notes about the meeting/conversation, then queues it to Outbox',
    steps: [
      { stepId: 1, action: 'studio', name: 'Write Follow-Up', target: { operationId: 508, agentId: 'documents', contextRef: 'Write a professional follow-up email. Reference specific topics discussed, action items agreed upon, and next steps. Warm but professional tone. Include a clear next step or CTA. Under 200 words. No em-dashes. Output ONLY the email content (greeting, body, sign-off).' }, outputKey: 'step1_email' },
      { stepId: 2, action: 'outbox', name: 'Queue Follow-Up', target: { emailTo: '', emailSubject: 'Great connecting - Next steps' }, config: { emailTemplate: 'professional', emailFrom: '', bccSelf: true } }
    ]
  },
  {
    id: 'preset_email_campaign',
    name: 'Email Campaign (3-Part Sequence)',
    desc: 'Marketing Agent writes a 3-email nurture sequence with A/B subject lines, preview text, and send timing for each. Queues first email to Outbox',
    steps: [
      { stepId: 1, action: 'studio', name: 'Write Email Sequence', target: { operationId: 509, agentId: 'marketing', contextRef: 'Write a 3-email campaign sequence. Email 1 (Day 0): Introduction/value proposition. Email 2 (Day 3): Social proof/case study. Email 3 (Day 7): Urgency/final CTA. For each email include: 2 subject line options (A/B), preview text, email body, CTA button text, and recommended send time. Keep each email under 250 words. Professional but warm tone. No em-dashes.' }, outputKey: 'step1_sequence' },
      { stepId: 2, action: 'outbox', name: 'Queue Email 1', target: { emailTo: '', emailSubject: '' }, config: { emailTemplate: 'professional', emailFrom: '', bccSelf: true } },
      { stepId: 3, action: 'notify', name: 'Save Full Sequence', target: { notifyMessage: 'Email campaign sequence generated. Email 1 queued to Outbox. Full 3-email sequence saved to Library.' } },
      { stepId: 4, action: 'library', name: 'Archive Sequence', target: { libraryTitle: 'Email Campaign Sequence', libraryTags: 'email,campaign,sequence' } }
    ]
  },
  {
    id: 'preset_generate_email_template',
    name: 'Generate AI Email Template',
    desc: 'Creates a custom branded email template (HTML layout) tailored to your brand colors, voice, and use case, then saves to Library',
    steps: [
      { stepId: 1, action: 'studio', name: 'Design Email Template', target: { operationId: 508, agentId: 'documents', contextRef: 'Design a custom branded email template. Output clean, inline-CSS HTML that works in email clients. Use the brand colors and voice. Include sections: header with brand name, hero area, body content placeholder, CTA button, footer with unsubscribe link. Use table-based layout for email client compatibility. Make it visually polished. Output ONLY the HTML code.' }, outputKey: 'step1_template' },
      { stepId: 2, action: 'library', name: 'Save Template', target: { libraryTitle: 'Custom Email Template - {{brandName}}', libraryTags: 'email,template,brand,html' } },
      { stepId: 3, action: 'notify', name: 'Confirm', target: { notifyMessage: 'Custom email template created and saved to Library. You can use it in Mail > Settings > AI Custom template.' } }
    ]
  },

  // ═══════════════════════════════════════════════
  // RESEARCH & INTELLIGENCE (Normal API, not Deep Research)
  // ═══════════════════════════════════════════════
  {
    id: 'preset_competitor_report',
    name: 'Competitor Analysis Report',
    desc: 'Intelligence Agent researches a competitor using web search, then Strategy Agent writes a SWOT analysis and strategic recommendations',
    steps: [
      { stepId: 1, action: 'studio', name: 'Research Competitor', target: { operationId: 1101, agentId: 'intelligence', contextRef: 'Research this competitor thoroughly. Cover: market position, pricing, recent product launches, marketing strategy, strengths, and weaknesses. Use current data.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_research' },
      { stepId: 2, action: 'studio', name: 'SWOT + Strategy', target: { operationId: 6, agentId: 'strategy', contextRef: 'Based on this competitor research, write a SWOT analysis and 5 actionable strategic recommendations for how our brand can differentiate and win. Be specific.\n\n{{step1_research}}' }, outputKey: 'step2_swot' },
      { stepId: 3, action: 'library', name: 'Save Report', target: { libraryTitle: 'Competitor Analysis', libraryTags: 'research,competitor,strategy,swot' } }
    ]
  },
  {
    id: 'preset_market_scan',
    name: 'Weekly Market Intelligence',
    desc: 'Intelligence Agent scans your industry for latest news, trends, and competitor moves, then emails you the brief. Great as a weekly recurring automation',
    steps: [
      { stepId: 1, action: 'studio', name: 'Scan Industry', target: { operationId: 1103, agentId: 'intelligence', contextRef: 'Generate this week latest intelligence brief. Cover: industry news, competitor moves, regulatory changes, emerging trends, and any opportunities or threats. Be specific with company names and dates.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_brief' },
      { stepId: 2, action: 'email', name: 'Email Brief to Me', target: { emailTo: 'me', emailSubject: 'Weekly Intelligence Brief - {{brandName}}', emailBody: '{{step1_brief}}' }, config: { emailTemplate: 'professional', emailFrom: '' } }
    ]
  },
  {
    id: 'preset_pricing_research',
    name: 'Pricing & Positioning Study',
    desc: 'Intelligence researches competitor pricing and market rates, then Strategy Agent recommends optimal pricing with positioning rationale',
    steps: [
      { stepId: 1, action: 'studio', name: 'Research Pricing', target: { operationId: 1104, agentId: 'intelligence', contextRef: 'Research competitor pricing strategies and market rates in our industry. Compare pricing tiers, packaging, and positioning. Include specific numbers where possible.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_pricing' },
      { stepId: 2, action: 'studio', name: 'Pricing Strategy', target: { operationId: 503, agentId: 'strategy', contextRef: 'Based on this competitive pricing research, recommend an optimal pricing strategy. Include: suggested price points, tier structure, positioning rationale, and how to communicate value. Be specific with numbers.\n\n{{step1_pricing}}' }, outputKey: 'step2_strategy' },
      { stepId: 3, action: 'library', name: 'Save Analysis', target: { libraryTitle: 'Pricing & Positioning Analysis', libraryTags: 'pricing,research,strategy,competitive' } }
    ]
  },
  {
    id: 'preset_local_market',
    name: 'Local Market Report',
    desc: 'Intelligence researches your local market - demographics, competitors, foot traffic patterns, and opportunities specific to your area',
    steps: [
      { stepId: 1, action: 'studio', name: 'Local Intel', target: { operationId: 1112, agentId: 'intelligence', contextRef: 'Research the local market in our area. Cover: demographics, local competitors, market saturation, foot traffic patterns, seasonal trends, and underserved opportunities. Be specific to our location.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_local' },
      { stepId: 2, action: 'library', name: 'Save Report', target: { libraryTitle: 'Local Market Report', libraryTags: 'research,local,market,demographics' } },
      { stepId: 3, action: 'notify', name: 'Done', target: { notifyMessage: 'Local market report generated and saved to Library.' } }
    ]
  },

  // ═══════════════════════════════════════════════
  // PROSPECTING & CLIENT OUTREACH
  // ═══════════════════════════════════════════════
  {
    id: 'preset_find_prospects',
    name: 'Find + Research Prospects',
    desc: 'Intelligence Agent identifies potential clients matching your ideal customer profile, then researches each one with company details and outreach angles',
    steps: [
      { stepId: 1, action: 'studio', name: 'Find Prospects', target: { operationId: 1105, agentId: 'intelligence', contextRef: 'Find 5-7 potential clients that match our ideal customer profile. For each, include: company name, what they do, why they are a good fit, key decision maker if identifiable, and estimated company size. Prioritize by fit quality.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_prospects' },
      { stepId: 2, action: 'studio', name: 'Deep Dive Top 3', target: { operationId: 1106, agentId: 'intelligence', contextRef: 'Take the top 3 prospects from this list and do a deeper dive on each. For each: recent news, social media presence, pain points we could solve, and a specific angle for outreach.\n\n{{step1_prospects}}' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step2_deepdive' },
      { stepId: 3, action: 'library', name: 'Save Research', target: { libraryTitle: 'Prospect Research', libraryTags: 'prospects,clients,research,outreach' } }
    ]
  },
  {
    id: 'preset_lead_proposal_outbox',
    name: 'Partnership Proposal Pipeline',
    desc: 'Intelligence scouts partners, Documents writes a personalized proposal email with specific partnership benefits, queues to Outbox for your review before sending',
    steps: [
      { stepId: 1, action: 'studio', name: 'Scout Partners', target: { operationId: 1108, agentId: 'intelligence', contextRef: 'Find potential business partners or strategic alliances. Look for companies with complementary services, shared audience, or mutual benefit opportunities. Provide 3-5 candidates with fit analysis.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_output' },
      { stepId: 2, action: 'studio', name: 'Write Proposal', target: { operationId: 508, agentId: 'documents', contextRef: 'Using the partner research from step 1, write a compelling partnership proposal email to the top candidate. Include specific details about why this partnership makes sense for both sides. Reference their business specifically. Professional but enthusiastic tone. Under 300 words. No em-dashes.\n\n{{step1_output}}' }, outputKey: 'step2_output' },
      { stepId: 3, action: 'outbox', name: 'Queue for Review', target: { emailTo: '', emailSubject: 'Partnership Opportunity' }, config: { emailTemplate: 'professional', emailFrom: '', bccSelf: true } }
    ]
  },
  {
    id: 'preset_client_outreach',
    name: 'Batch Client Outreach',
    desc: 'Researches potential clients, writes a unique personalized email for each prospect referencing their specific business, then batch queues all to Outbox',
    steps: [
      { stepId: 1, action: 'studio', name: 'Research Clients', target: { operationId: 1105, agentId: 'intelligence', contextRef: 'Find 3-5 potential clients matching our ideal customer profile. For each, provide: company name, industry, what they do, key person to contact, and why they need our services.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_output' },
      { stepId: 2, action: 'studio', name: 'Write Personalized Emails', target: { operationId: 508, agentId: 'documents', contextRef: 'Using the research from step 1, write a personalized outreach email for EACH potential client. Each email must reference their specific business, industry challenges, and how we can help. No generic templates. For each email, use EXACTLY this format:\n\n---EMAIL---\nTO: [their name or company]\nSUBJECT: [personalized subject - not generic]\nBODY:\n[personalized email, 150-200 words, professional but warm, specific CTA]\n---END---\n\nWrite one email per prospect. No em-dashes.\n\n{{step1_output}}' }, outputKey: 'step2_output' },
      { stepId: 3, action: 'batch_email', name: 'Queue All to Outbox', target: {}, config: { emailTemplate: 'professional' } }
    ]
  },
  {
    id: 'preset_client_pitch_packet',
    name: 'Client Pitch Packet + Email',
    desc: 'Full pipeline: researches a client, generates a branded pitch PDF document, writes a personalized cover email, and queues everything to Outbox with PDF attached',
    steps: [
      { stepId: 1, action: 'studio', name: 'Research Client', target: { operationId: 1106, agentId: 'intelligence', contextRef: 'Thoroughly research this potential client. Cover: what they do, recent news, key challenges, decision makers, and specific ways our services would benefit them.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_research' },
      { stepId: 2, action: 'studio', name: 'Generate Pitch Doc', target: { operationId: 510, agentId: 'documents', contextRef: 'Create a branded pitch document for this client. Reference their specific business throughout. Structure: Executive Summary, Our Services, Strategic Approach (tailored to them), Key Differentiators, Engagement Model. Under 1200 words.\n\n{{step1_research}}' }, outputKey: 'step2_pitch' },
      { stepId: 3, action: 'pdf_generate', name: 'Create PDF', target: {}, config: { sourceStep: 'step2_pitch', pdfTitle: '{{brandName}} - Client Pitch', orientation: 'portrait' }, outputKey: 'step3_pdf' },
      { stepId: 4, action: 'studio', name: 'Write Cover Email', target: { operationId: 508, agentId: 'documents', contextRef: 'Write a concise cover email for the attached pitch document. Personalize with references to their business. Mention 2-3 specific benefits. Include CTA to schedule a call. 150-200 words. Mention the attached document. No em-dashes.\n\nFormat EXACTLY as:\n---EMAIL---\nTO: [their name]\nSUBJECT: [personalized subject]\nBODY:\n[email body]\n---END---\n\nClient Research:\n{{step1_research|truncate:1500}}\n\nPitch highlights:\n{{step2_pitch|truncate:1000}}' }, outputKey: 'step4_email' },
      { stepId: 5, action: 'batch_email', name: 'Queue with PDF', target: {}, config: { emailTemplate: 'professional', attachPdfFromStep: 'step3_pdf' } }
    ]
  },
  {
    id: 'preset_smart_outreach',
    name: 'Smart Outreach (Research + Message)',
    desc: 'Intelligence Agent researches a specific prospect and generates multiple personalized outreach messages - email, LinkedIn, and a follow-up sequence',
    steps: [
      { stepId: 1, action: 'studio', name: 'Research Prospect', target: { operationId: 1107, agentId: 'intelligence', contextRef: 'Research this prospect and generate personalized outreach. Include: background research, 3 conversation starters, an initial outreach email, a LinkedIn message, and a 3-step follow-up sequence. Make everything specific to their business and role.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_outreach' },
      { stepId: 2, action: 'outbox', name: 'Queue Initial Email', target: { emailTo: '', emailSubject: '' }, config: { emailTemplate: 'minimal', emailFrom: '', bccSelf: true } },
      { stepId: 3, action: 'library', name: 'Save Full Sequence', target: { libraryTitle: 'Outreach Sequence', libraryTags: 'outreach,prospect,follow-up,sales' } }
    ]
  },

  // ═══════════════════════════════════════════════
  // STRATEGY & DOCUMENTS
  // ═══════════════════════════════════════════════
  {
    id: 'preset_brand_audit',
    name: 'Brand Audit + Action Plan',
    desc: 'Strategy Agent performs a comprehensive brand audit (voice, positioning, gaps), then creates a prioritized 30-day action plan with specific tasks',
    steps: [
      { stepId: 1, action: 'studio', name: 'Brand Audit', target: { operationId: 502, agentId: 'strategy', contextRef: 'Perform a comprehensive brand audit. Evaluate: brand voice consistency, visual identity, market positioning, customer perception, competitive differentiation, and digital presence. Be honest about gaps and weaknesses. Provide specific examples.' }, outputKey: 'step1_audit' },
      { stepId: 2, action: 'studio', name: '30-Day Action Plan', target: { operationId: 503, agentId: 'strategy', contextRef: 'Based on this brand audit, create a prioritized 30-day action plan. Week 1: quick wins. Week 2-3: strategic improvements. Week 4: measurement and iteration. Each item should be specific and actionable, not vague.\n\n{{step1_audit}}' }, outputKey: 'step2_plan' },
      { stepId: 3, action: 'library', name: 'Save Audit', target: { libraryTitle: 'Brand Audit + Action Plan', libraryTags: 'brand,audit,strategy,action-plan' } }
    ]
  },
  {
    id: 'preset_quarterly_review',
    name: 'Quarterly Business Review',
    desc: 'Strategy Agent writes a comprehensive QBR document covering performance, wins, challenges, and next quarter priorities. Saves as PDF',
    steps: [
      { stepId: 1, action: 'studio', name: 'Write QBR', target: { operationId: 505, agentId: 'documents', contextRef: 'Write a Quarterly Business Review document. Structure: Executive Summary, Key Wins, Challenges and Lessons, Metrics Overview, Client/Customer Highlights, Next Quarter Priorities and Goals, Resource Needs. Professional tone, data-driven where possible. Reference the brand context and any known metrics.' }, outputKey: 'step1_qbr' },
      { stepId: 2, action: 'pdf_generate', name: 'Generate PDF', target: {}, config: { sourceStep: 'step1_qbr', pdfTitle: 'Quarterly Business Review - {{brandName}}', orientation: 'portrait' }, outputKey: 'step2_pdf' },
      { stepId: 3, action: 'library', name: 'Save to Library', target: { libraryTitle: 'QBR - Q' + (Math.ceil((new Date().getMonth() + 1) / 3)) + ' ' + new Date().getFullYear(), libraryTags: 'qbr,quarterly,review,strategy' } }
    ]
  },

  // ═══════════════════════════════════════════════
  // DEEP RESEARCH + EMAIL
  // ═══════════════════════════════════════════════
  {
    id: 'preset_research_email',
    name: 'Email Report',
    desc: 'Gemini Deep Research performs comprehensive multi-source analysis on a topic, then emails you the full report. Best for complex industry or market questions',
    steps: [
      { stepId: 1, action: 'research', name: 'Deep Research', target: { researchQuery: '' }, config: { includeBrandContext: true }, outputKey: 'step1_research' },
      { stepId: 2, action: 'email', name: 'Email Report', target: { emailTo: 'me', emailSubject: 'Deep Research Report', emailBody: '{{step1_research}}' }, config: { includeStepOutput: false, emailFrom: '', emailTemplate: 'professional' } }
    ]
  },
  {
    id: 'preset_research_library',
    name: 'Save to Library',
    desc: 'Gemini Deep Research on a topic, automatically saved to your Library for future reference',
    steps: [
      { stepId: 1, action: 'research', name: 'Deep Research', target: { researchQuery: '' }, config: { includeBrandContext: true }, outputKey: 'step1_research' },
      { stepId: 2, action: 'library', name: 'Save Research', target: { libraryTitle: 'Research Report', libraryTags: 'research,deep-research,analysis' } },
      { stepId: 3, action: 'notify', name: 'Done', target: { notifyMessage: 'Deep Research complete and saved to Library.' } }
    ]
  },

  // ═══════════════════════════════════════════════
  // GRANTS & FUNDING
  // ═══════════════════════════════════════════════
  {
    id: 'preset_grant_search',
    name: 'Grant Search + Application Prep',
    desc: 'Intelligence finds matching grants and funding opportunities, then helps prepare application materials and narratives',
    steps: [
      { stepId: 1, action: 'studio', name: 'Find Grants', target: { operationId: 1109, agentId: 'intelligence', contextRef: 'Search for grants and funding opportunities matching our business. Include federal, state, local, and private grants. For each: name, amount, deadline, eligibility requirements, and application URL if available.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_grants' },
      { stepId: 2, action: 'studio', name: 'Prep Application', target: { operationId: 1110, agentId: 'intelligence', contextRef: 'For the top 2 most relevant grants from this list, prepare application content. Include: an impact statement, budget justification narrative, and a project description tailored to each grant requirements.\n\n{{step1_grants}}' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step2_app' },
      { stepId: 3, action: 'library', name: 'Save Materials', target: { libraryTitle: 'Grant Research + Application Materials', libraryTags: 'grants,funding,application' } }
    ]
  },

  // ═══════════════════════════════════════════════
  // CONTENT CREATION + LIBRARY
  // ═══════════════════════════════════════════════
  {
    id: 'preset_blog_to_social',
    name: 'Blog Post + Social Promotion',
    desc: 'Marketing writes a full blog post/article, then creates social media posts promoting it across all platforms',
    steps: [
      { stepId: 1, action: 'studio', name: 'Write Blog Post', target: { operationId: 8, agentId: 'marketing', contextRef: 'Write a blog post or article on a topic relevant to the brand. 600-800 words. Include: compelling headline, introduction with hook, 3-4 subheaded sections, conclusion with CTA. SEO-optimized. No em-dashes.' }, outputKey: 'step1_blog' },
      { stepId: 2, action: 'studio', name: 'Create Social Posts', target: { operationId: 47, agentId: 'marketing', contextRef: 'Create social media posts promoting this blog post. Write platform-specific versions: X (280 chars, hook + link placeholder), Threads (500 chars, conversational teaser), Instagram (visual caption with hashtags). Each should make people want to read the full post.\n\n{{step1_blog|truncate:2000}}' }, outputKey: 'step2_social' },
      { stepId: 3, action: 'library', name: 'Save Blog', target: { libraryTitle: 'Blog Post Draft', libraryTags: 'blog,content,article' } },
      { stepId: 4, action: 'post', name: 'Promote on Social', target: { platforms: ['x', 'threads'], contentRef: '{{step2_social}}' } }
    ]
  },
  {
    id: 'preset_content_calendar',
    name: 'Weekly Content Calendar',
    desc: 'Marketing Agent creates a full 7-day content calendar with ready-to-use post copy for each day, organized by platform and theme',
    steps: [
      { stepId: 1, action: 'studio', name: 'Generate Calendar', target: { operationId: 1, agentId: 'marketing', contextRef: 'Create a 7-day content calendar starting from tomorrow. For each day include: theme/topic, X post (280 chars), Threads post (500 chars), and Instagram caption. Mix content types: educational (2 days), behind-the-scenes (1), promotional (1), engagement/question (1), industry insight (1), user-generated/community (1). All posts should be complete and ready to copy-paste.' }, outputKey: 'step1_calendar' },
      { stepId: 2, action: 'library', name: 'Save Calendar', target: { libraryTitle: 'Content Calendar - Week of ' + new Date().toISOString().slice(0, 10), libraryTags: 'content,calendar,social,weekly' } },
      { stepId: 3, action: 'notify', name: 'Done', target: { notifyMessage: 'Weekly content calendar created with 7 days of ready-to-post content. Saved to Library.' } }
    ]
  },
  {
    id: 'preset_vendor_research',
    name: 'Vendor Research + Comparison',
    desc: 'Intelligence Agent researches and compares vendors/suppliers for a specific need, with pricing, reviews, and a recommendation',
    steps: [
      { stepId: 1, action: 'studio', name: 'Research Vendors', target: { operationId: 1111, agentId: 'intelligence', contextRef: 'Find and evaluate 5-7 vendors or service providers. For each include: company name, services offered, estimated pricing, notable clients, pros, cons, and overall rating (1-5). Organize in a comparison table format.' }, config: { provider: 'openai', model: 'gpt-5.4' }, outputKey: 'step1_vendors' },
      { stepId: 2, action: 'studio', name: 'Recommendation', target: { operationId: 503, agentId: 'strategy', contextRef: 'Based on this vendor research, provide a clear recommendation. Rank the top 3, explain why, and suggest negotiation points. Include a decision matrix.\n\n{{step1_vendors}}' }, outputKey: 'step2_rec' },
      { stepId: 3, action: 'library', name: 'Save Comparison', target: { libraryTitle: 'Vendor Comparison', libraryTags: 'vendors,research,comparison,procurement' } }
    ]
  }
];

// v24.20: Browse Preset Library — categorized, expandable preset cards
var _browsePresetCategory = 'all';

// Map preset IDs to categories for Browse tab
var PRESET_CATEGORIES = {
  preset_gen_post_x: 'content',
  preset_gen_img_threads: 'content',
  preset_cross_platform: 'content',
  preset_daily_brand: 'content',
  preset_image_campaign: 'content',
  preset_thread_series: 'content',
  preset_blog_to_social: 'content',
  preset_content_calendar: 'content',
  preset_weekly_newsletter: 'email',
  preset_client_followup: 'email',
  preset_email_campaign: 'email',
  preset_generate_email_template: 'email',
  preset_competitor_report: 'research',
  preset_market_scan: 'research',
  preset_pricing_research: 'research',
  preset_local_market: 'research',
  preset_vendor_research: 'research',
  preset_find_prospects: 'prospecting',
  preset_lead_proposal_outbox: 'prospecting',
  preset_client_outreach: 'prospecting',
  preset_client_pitch_packet: 'prospecting',
  preset_smart_outreach: 'prospecting',
  preset_brand_audit: 'strategy',
  preset_quarterly_review: 'strategy',
  preset_research_email: 'deep-research',
  preset_research_library: 'deep-research',
  preset_grant_search: 'grants'
};

var PRESET_CAT_LABELS = {
  all: 'All',
  content: 'Content & Social',
  email: 'Email',
  research: 'Research',
  prospecting: 'Prospecting',
  strategy: 'Strategy',
  'deep-research': 'Deep Research',
  grants: 'Grants',
  custom: 'My Presets'
};

var PRESET_CAT_COLORS = {
  content: '#10b981',
  email: '#8b5cf6',
  research: '#06b6d4',
  prospecting: '#fbbf24',
  strategy: '#0d9488',
  'deep-research': '#a78bfa',
  grants: '#60a5fa',
  custom: 'var(--accent, #a89878)'
};

// Short badge text for cards (not the filter pills)
var PRESET_CAT_BADGE = {
  content: 'Content',
  email: 'Email',
  research: 'Research',
  prospecting: 'Prospect',
  strategy: 'Strategy',
  'deep-research': 'Deep Research',
  grants: 'Grants',
  custom: 'Custom'
};

function renderAutoLabBrowse() {
  var container = document.getElementById('autoLabBrowse');
  if (!container) return;

  var allPresets = (typeof WORKFLOW_PRESETS !== 'undefined' ? WORKFLOW_PRESETS : []).slice();
  var customPresets = [];
  try { customPresets = JSON.parse(localStorage.getItem('roweos_custom_presets') || '[]'); } catch(e) {}
  // Track which built-in presets are in user's library
  var savedIds = {};
  customPresets.forEach(function(cp) { savedIds[cp._sourcePresetId || cp.id] = true; });

  var allWithCustom = allPresets.slice();
  customPresets.forEach(function(cp) {
    // Only show custom presets that aren't clones of built-ins (those show as "saved" on the built-in card)
    if (!cp._sourcePresetId) {
      cp._isCustom = true;
      allWithCustom.push(cp);
    }
  });

  // Filter by category
  var filtered = allWithCustom;
  if (_browsePresetCategory !== 'all') {
    filtered = allWithCustom.filter(function(p) {
      if (_browsePresetCategory === 'custom') return p._isCustom;
      return (PRESET_CATEGORIES[p.id] || 'custom') === _browsePresetCategory;
    });
  }

  var html = '';

  // Category filter pills
  html += '<div class="browse-preset-categories">';
  Object.keys(PRESET_CAT_LABELS).forEach(function(catKey) {
    var count = 0;
    if (catKey === 'all') {
      count = allWithCustom.length;
    } else if (catKey === 'custom') {
      count = customPresets.filter(function(cp) { return !cp._sourcePresetId; }).length;
    } else {
      count = allWithCustom.filter(function(p) { return PRESET_CATEGORIES[p.id] === catKey; }).length;
    }
    if (count === 0 && catKey !== 'all') return;
    html += '<button class="browse-preset-cat-btn' + (_browsePresetCategory === catKey ? ' active' : '') + '" onclick="_browsePresetCategory=\'' + catKey + '\';renderAutoLabBrowse();">' + PRESET_CAT_LABELS[catKey] + ' (' + count + ')</button>';
  });
  html += '</div>';

  // Cards grid
  html += '<div class="browse-preset-grid">';
  filtered.forEach(function(p) {
    var cat = p._isCustom ? 'custom' : (PRESET_CATEGORIES[p.id] || 'custom');
    var badgeText = PRESET_CAT_BADGE[cat] || cat;
    var stepCount = (p.steps && p.steps.length) || 0;
    var isSaved = savedIds[p.id] || p._isCustom;

    html += '<div class="browse-preset-card" data-preset-cat="' + cat + '" data-preset-id="' + escapeHtml(p.id) + '" onclick="toggleBrowsePresetExpand(this)">';

    // Header — name + short badge
    html += '<div class="browse-preset-card-header">';
    html += '<div class="browse-preset-card-name">' + escapeHtml(p.name) + '</div>';
    html += '<span class="browse-preset-card-badge cat-' + cat + '">' + escapeHtml(badgeText) + '</span>';
    html += '</div>';

    // Description
    html += '<div class="browse-preset-card-desc">' + escapeHtml(p.desc || '') + '</div>';

    // Meta line — step count + chevron
    html += '<div class="browse-preset-card-meta">';
    html += '<span style="display:inline-flex;align-items:center;gap:4px;">';
    // Step type dots (compact)
    if (p.steps && p.steps.length > 0) {
      p.steps.forEach(function(s) {
        var st = (typeof PIPELINE_STEP_TYPES !== 'undefined' && PIPELINE_STEP_TYPES[s.action]) ? PIPELINE_STEP_TYPES[s.action] : null;
        html += '<span style="width:6px;height:6px;border-radius:50%;background:' + (st ? st.color : '#666') + ';display:inline-block;"></span>';
      });
    }
    html += ' ' + stepCount + ' step' + (stepCount !== 1 ? 's' : '');
    html += '</span>';
    if (isSaved) {
      html += '<span style="display:inline-flex;align-items:center;gap:3px;color:var(--accent,#a89878);font-size:10px;font-weight:600;"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" stroke="none"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Saved</span>';
    }
    html += '<svg class="browse-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto;transition:transform 0.2s;"><path d="M6 9l6 6 6-6"/></svg>';
    html += '</div>';

    // Expandable step detail
    html += '<div class="browse-preset-card-expand">';
    if (p.steps && p.steps.length > 0) {
      p.steps.forEach(function(s, si) {
        var st = (typeof PIPELINE_STEP_TYPES !== 'undefined' && PIPELINE_STEP_TYPES[s.action]) ? PIPELINE_STEP_TYPES[s.action] : null;
        var sc = st ? st.color : '#666';
        var sl = st ? st.label : s.action;
        html += '<div class="browse-preset-step">';
        html += '<div class="browse-preset-step-num" style="background:' + sc + ';">' + (si + 1) + '</div>';
        html += '<div class="browse-preset-step-info">';
        html += '<div class="browse-preset-step-name">' + escapeHtml(s.name || sl) + '</div>';
        html += '<div class="browse-preset-step-type">' + escapeHtml(sl) + '</div>';
        html += '</div>';
        html += '</div>';
      });
    }
    // Action buttons
    html += '<div class="browse-preset-card-actions">';
    if (p._isCustom) {
      // Already in library — show Use + Delete
      html += '<button class="browse-preset-action-btn primary" onclick="event.stopPropagation();browsePresetUse(\'' + escapeHtml(p.id) + '\')">Use Preset</button>';
      html += '<button class="browse-preset-action-btn" onclick="event.stopPropagation();browsePresetChat(\'' + escapeHtml(p.id) + '\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Chat</button>';
      html += '<button class="browse-preset-action-btn" onclick="event.stopPropagation();deleteCustomPreset(\'' + escapeHtml(p.id) + '\');renderAutoLabBrowse();" style="color:#ef4444;">Remove</button>';
    } else if (isSaved) {
      // Built-in but already saved to library
      html += '<button class="browse-preset-action-btn primary" onclick="event.stopPropagation();browsePresetUse(\'' + escapeHtml(p.id) + '\')">Use Preset</button>';
      html += '<button class="browse-preset-action-btn" onclick="event.stopPropagation();browsePresetChat(\'' + escapeHtml(p.id) + '\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Chat</button>';
    } else {
      // Not saved — show Add to Library + Chat
      html += '<button class="browse-preset-action-btn primary" onclick="event.stopPropagation();browsePresetAddToLibrary(\'' + escapeHtml(p.id) + '\',this)"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path d="M12 5v14M5 12h14"/></svg> Add to Library</button>';
      html += '<button class="browse-preset-action-btn" onclick="event.stopPropagation();browsePresetChat(\'' + escapeHtml(p.id) + '\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Chat</button>';
    }
    html += '</div>';
    html += '</div>'; // end expand

    html += '</div>'; // end card
  });
  html += '</div>';

  if (filtered.length === 0) {
    html += '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);"><div style="font-size:14px;">No presets in this category</div></div>';
  }

  container.innerHTML = html;
}

function toggleBrowsePresetExpand(card) {
  card.classList.toggle('expanded');
  var chevron = card.querySelector('.browse-chevron');
  if (chevron) {
    chevron.style.transform = card.classList.contains('expanded') ? 'rotate(180deg)' : '';
  }
}

// v24.20: Add a built-in preset to user's custom presets library
function browsePresetAddToLibrary(presetId, btnEl) {
  var preset = null;
  if (typeof WORKFLOW_PRESETS !== 'undefined') {
    preset = WORKFLOW_PRESETS.find(function(p) { return p.id === presetId; });
  }
  if (!preset) { showToast('Preset not found', 'error'); return; }

  var customPresets = [];
  try { customPresets = JSON.parse(localStorage.getItem('roweos_custom_presets') || '[]'); } catch(e) {}

  // Check if already saved
  if (customPresets.some(function(cp) { return cp._sourcePresetId === presetId; })) {
    showToast('Already in your library', 'info');
    return;
  }

  // Clone preset with a custom ID
  var clone = JSON.parse(JSON.stringify(preset));
  clone.id = 'custom_' + Date.now();
  clone._sourcePresetId = presetId;
  customPresets.push(clone);

  try {
    localStorage.setItem('roweos_custom_presets', JSON.stringify(customPresets));
  } catch(e) {
    showToast('Failed to save: storage full', 'error');
    return;
  }

  // v24.25: Also add as a workflow in roweos_automations so it appears in Workflows tab
  try {
    var autoEntry = {
      id: clone.id,
      name: clone.name,
      description: clone.desc || clone.description || '',
      type: 'pipeline',
      steps: clone.steps || [],
      enabled: false,
      schedule: { type: 'one-time' },
      brandIdx: typeof currentBrandIdx !== 'undefined' ? currentBrandIdx : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    var autos = [];
    try { autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(ae) {}
    autos.push(autoEntry);
    localStorage.setItem('roweos_automations', JSON.stringify(autos));
    // Dual storage
    var tasks = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
    tasks.push(autoEntry);
    if (typeof saveScheduledTasks === 'function') saveScheduledTasks(tasks);
  } catch(e) { console.warn('[BrowsePreset] Failed to add to workflows:', e); }

  // v24.24: Also save to actual Library so it appears in Library view
  try {
    var brandLib = getCurrentBrandLibrary();
    if (brandLib && brandLib.files) {
      var stepsDesc = preset.steps ? preset.steps.map(function(s) { return s.name || s.action; }).join(', ') : '';
      brandLib.files.push({
        id: 'file_' + Date.now(),
        name: preset.name,
        folderId: 'root',
        content: (preset.description || '') + '\n\nWorkflow: ' + stepsDesc + '\n\nSteps: ' + preset.steps.length,
        operation: 'Workflow Preset',
        source: 'Automations',
        savedAt: Date.now(),
        storageMode: 'local'
      });
      saveLibrary();
    }
  } catch(e) {}

  writeDB('library/brand', { data: JSON.stringify(fileLibrary) }, { category: 'library' }); // v25.1

  // v24.20: Immediate visual feedback on button before re-render
  if (btnEl) {
    btnEl.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none" style="vertical-align:-1px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Saved';
    btnEl.style.pointerEvents = 'none';
    btnEl.style.opacity = '0.7';
  }

  showToast('Added "' + preset.name + '" to your library', 'success');

  // Re-render after brief delay so user sees button change
  setTimeout(function() {
    // Remember which card was expanded
    var expandedId = presetId;
    renderAutoLabBrowse();
    // v24.25: Also re-render Workflows tab so the new entry appears there
    if (typeof renderAutoLabWorkflows === 'function') renderAutoLabWorkflows();
    // Re-expand the card that was just clicked
    var cards = document.querySelectorAll('.browse-preset-card');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.presetId === expandedId) {
        cards[i].classList.add('expanded');
        var chev = cards[i].querySelector('.browse-chevron');
        if (chev) chev.style.transform = 'rotate(180deg)';
        break;
      }
    }
  }, 400);
}

// v24.20: Use a preset — open pipeline builder with the preset loaded
function browsePresetUse(presetId) {
  // Check built-in presets first, then custom
  var preset = null;
  if (typeof WORKFLOW_PRESETS !== 'undefined') {
    preset = WORKFLOW_PRESETS.find(function(p) { return p.id === presetId; });
  }
  if (!preset) {
    try {
      var cp = JSON.parse(localStorage.getItem('roweos_custom_presets') || '[]');
      preset = cp.find(function(p) { return p.id === presetId; });
    } catch(e) {}
  }
  if (!preset || !preset.steps) {
    showToast('Preset not found', 'error');
    return;
  }

  // Switch to Workflows tab and load preset into pipeline builder
  showAutoLabTab('workflows');
  setTimeout(function() {
    showPipelineBuilder();
    setTimeout(function() {
      if (typeof loadPipelinePreset === 'function') loadPipelinePreset(presetId);
    }, 100);
  }, 150);
}

// v24.20: Chat about a preset — send it to the Agent tab for customization
function browsePresetChat(presetId) {
  var preset = null;
  if (typeof WORKFLOW_PRESETS !== 'undefined') {
    preset = WORKFLOW_PRESETS.find(function(p) { return p.id === presetId; });
  }
  if (!preset) {
    try {
      var cp = JSON.parse(localStorage.getItem('roweos_custom_presets') || '[]');
      preset = cp.find(function(p) { return p.id === presetId; });
    } catch(e) {}
  }
  if (!preset) return;

  // Build a natural language description of the preset
  var stepDescs = [];
  if (preset.steps) {
    preset.steps.forEach(function(s, i) {
      var st = (typeof PIPELINE_STEP_TYPES !== 'undefined' && PIPELINE_STEP_TYPES[s.action]) ? PIPELINE_STEP_TYPES[s.action] : null;
      var label = st ? st.label : s.action;
      stepDescs.push('Step ' + (i + 1) + ': ' + (s.name || label) + ' (' + label + ')');
    });
  }

  var prompt = 'I want to set up the "' + preset.name + '" automation. Here are the steps:\n' + stepDescs.join('\n') + '\n\nHelp me customize this for my brand. I may need to adjust the context, add recipients, or tweak the steps.';

  // Switch to Agent tab and populate the input
  showAutoLabTab('autoagent');
  setTimeout(function() {
    var input = document.getElementById('autoAgentInput');
    if (input) {
      input.value = prompt;
      if (typeof autoResizeTextarea === 'function') autoResizeTextarea(input);
      input.focus();
    }
  }, 200);
}

function getWorkflows() {
  try { return JSON.parse(localStorage.getItem('roweos_social_workflows') || '[]'); } catch(e) { return []; }
}
function saveWorkflows(workflows) {
  try { localStorage.setItem('roweos_social_workflows', JSON.stringify(workflows)); } catch(e) {}
}

function resolveTemplateVars(text, context) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{\{(\w+)(\|truncate:(\d+))?\}\}/g, function(match, key, truncGroup, truncLen) {
    var val = context[key] || '';
    if (truncLen) {
      var limit = parseInt(truncLen, 10);
      if (val.length > limit) val = val.substring(0, limit - 3) + '...';
    }
    return val;
  });
}

// v18.7: Clear expendable localStorage data to free quota — very aggressive
function clearExpendableStorageData() {
  try {
    // Clear response cache (can be very large)
    localStorage.removeItem('roweos_response_cache');
    // Clear auto lab images entirely (base64 = huge)
    localStorage.removeItem('roweos_auto_lab_images');
    // Clear task history (stores full result text — often biggest offender)
    localStorage.removeItem('roweos_task_history');
    // Clear completed automations metadata
    localStorage.removeItem('roweos_completed_automations');
    // Trim runs aggressively — keep last 5
    var runsRaw = localStorage.getItem('roweos_runs');
    if (runsRaw) {
      try {
        var runsData = JSON.parse(runsRaw);
        if (runsData && runsData.runs) runsData.runs = runsData.runs.slice(-5);
        if (runsData && runsData.agentCommands) runsData.agentCommands = runsData.agentCommands.slice(-5);
        localStorage.setItem('roweos_runs', JSON.stringify(runsData));
      } catch(e) {}
    }
    // Trim auto lab history to last 10
    var histRaw = localStorage.getItem('roweos_auto_lab_history');
    if (histRaw) {
      try {
        var hist = JSON.parse(histRaw);
        localStorage.setItem('roweos_auto_lab_history', JSON.stringify(hist.slice(-10)));
      } catch(e) {}
    }
    // Trim social posts
    try {
      var posts = JSON.parse(localStorage.getItem('roweos_social_posts') || '[]');
      if (posts.length > 10) {
        localStorage.setItem('roweos_social_posts', JSON.stringify(posts.slice(-10)));
      }
    } catch(e) {}
    // Clear social workflows (regenerable)
    localStorage.removeItem('roweos_social_workflows');
    console.log('[Storage] Cleared expendable data to free quota');
  } catch(e) {}
}

// v18.5: Sync lastRun timestamp to roweos_automations so card rendering shows it
// v28.4: Also write to Firestore so lastRun syncs across devices
function syncLastRunToAutomations(taskId, timestamp) {
  var idStr = String(taskId);
  try {
    var automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    var updated = false;
    var updatedAuto = null;
    for (var i = 0; i < automations.length; i++) {
      if (String(automations[i].id) === idStr) {
        automations[i].lastRun = timestamp;
        automations[i]._modifiedAt = Date.now();
        updated = true;
        updatedAuto = automations[i];
        break;
      }
    }
    if (updated) {
      localStorage.setItem('roweos_automations', JSON.stringify(automations));
      // v28.4: Write lastRun to Firestore so second device sees it
      if (updatedAuto && typeof writeDBAutomation === 'function') {
        writeDBAutomation(updatedAuto);
      }
    }
  } catch(e) {}
}

// v20.11: Write lastRun to scheduled tasks by ID (not array index — index mismatch caused wrong task updates)
function writeLastRunById(taskId, timestamp, extras) {
  var idStr = String(taskId);
  try {
    var tasks = getScheduledTasks();
    for (var i = 0; i < tasks.length; i++) {
      if (String(tasks[i].id) === idStr) {
        tasks[i].lastRun = timestamp;
        if (extras) {
          for (var k in extras) {
            if (extras.hasOwnProperty(k)) tasks[i][k] = extras[k];
          }
        }
        saveScheduledTasks(tasks);
        break;
      }
    }
  } catch(e) {}
  // Also sync to automations storage
  syncLastRunToAutomations(taskId, timestamp);
}

function executeWorkflow(workflow) {
  if (!workflow || !workflow.steps || workflow.steps.length === 0) {
    showToast('Workflow has no steps', 'warning');
    return Promise.resolve({ completedSteps: [], failedSteps: [], context: {} });
  }

  // v18.5: Pre-flight error checks — read API keys from roweos_api_keys JSON
  var preflightErrors = [];
  // v19.2: Use workflow's saved brandIdx instead of global selectedBrand
  var brandIdx = workflow.brandIdx !== undefined ? parseInt(workflow.brandIdx) : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
  var pfSettings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
  var pfApiKeys = {};
  try { pfApiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
  var validProviders = ['anthropic', 'openai', 'google'];
  workflow.steps.forEach(function(step, si) {
    if (step.action === 'studio') {
      var pfProv = (pfSettings.provider && validProviders.indexOf(pfSettings.provider) !== -1) ? pfSettings.provider : 'anthropic';
      var prov = (step.config && step.config.provider && validProviders.indexOf(step.config.provider) !== -1) ? step.config.provider : pfProv;
      // Check roweos_api_keys JSON object, then fallback to legacy format
      var hasKey = pfApiKeys[prov] || localStorage.getItem('roweos_' + prov + '_key');
      if (!hasKey) {
        preflightErrors.push('Step ' + (si + 1) + ': No API key for ' + prov);
      }
    } else if (step.action === 'post') {
      var plats = (step.target && step.target.platforms) || [];
      plats.forEach(function(p) {
        if (typeof isSocialConnected === 'function' && !isSocialConnected(p)) { // v25.4: All platforms checked
          preflightErrors.push('Step ' + (si + 1) + ': ' + (p || 'platform') + ' not connected');
        }
      });
    } else if (step.action === 'image') {
      if (typeof generateImageWithNanobanana !== 'function') {
        preflightErrors.push('Step ' + (si + 1) + ': Image generation not available');
      }
    } else if (step.action === 'email') {
      // v22.8: Preflight — check for recipient
      if (!step.target || !step.target.emailTo) {
        preflightErrors.push('Step ' + (si + 1) + ': No recipient email address');
      }
    } else if (step.action === 'outbox') {
      // v22.24: Outbox step — no hard preflight, To can be auto-extracted at runtime
    } else if (step.action === 'research') {
      // v22.8: Preflight — check for Google API key
      var hasGoogleKey = pfApiKeys['google'] || localStorage.getItem('roweos_google_key');
      if (!hasGoogleKey) {
        preflightErrors.push('Step ' + (si + 1) + ': No Google API key (required for Deep Research)');
      }
    }
  });
  if (preflightErrors.length > 0) {
    showToast(preflightErrors[0], 'error');
    return Promise.resolve({ completedSteps: [], failedSteps: preflightErrors.map(function(e) { return { error: e }; }), context: {} });
  }

  var context = {};
  // v19.2: Use workflow's saved brandIdx for brand context
  if (typeof brands !== 'undefined' && brands[brandIdx]) {
    context.brandName = brands[brandIdx].shortName || brands[brandIdx].name;
    context._brandIdx = brandIdx;
  }

  showToast('Running workflow: ' + (workflow.name || 'Untitled') + '...', 'info');

  // v22.37: Determine running animation type and register globally
  // GPT-5.4 thinking takes priority over deep research glow
  var _runningCard = null;
  var _isThinkingWorkflow = workflow.steps && workflow.steps.some(function(s) {
    return s.config && (s.config.model === 'gpt-5.4' || (s.config.model && s.config.model.indexOf('gpt-5') === 0));
  });
  var _isResearchWorkflow = !_isThinkingWorkflow && typeof automationHasDeepResearch === 'function' && automationHasDeepResearch(workflow);
  var _runType = _isThinkingWorkflow ? 'thinking' : (_isResearchWorkflow ? 'research' : 'standard');
  var _runningClass = _isThinkingWorkflow ? 'is-running-thinking' : (_isResearchWorkflow ? 'is-running-research' : 'is-running');
  var _drTimerInterval = null;
  if (workflow.id) {
    markAutomationRunning(workflow.id, _runType);
    var allCards = document.querySelectorAll('.auto-lab-card');
    allCards.forEach(function(c) {
      var runBtn = c.querySelector('[onclick*="runAutoLabNow(\'' + workflow.id + '\')"]');
      if (!runBtn && c.getAttribute('data-auto-id') === String(workflow.id)) runBtn = c;
      if (runBtn || c.getAttribute('data-auto-id') === String(workflow.id)) {
        c.classList.add(_runningClass);
        _runningCard = c;
        // v22.32: Update last run text to "In Progress"
        var lastRunEl = c.querySelector('.auto-lab-card-actions > span:first-child');
        if (lastRunEl) { lastRunEl.style.color = 'var(--accent)'; lastRunEl.style.fontWeight = '500'; lastRunEl.textContent = 'In Progress'; }
        // v22.10: Show timer badge on card for research or thinking
        if (_isResearchWorkflow || _isThinkingWorkflow) {
          var timerBadge = document.createElement('div');
          timerBadge.className = _isResearchWorkflow ? 'dr-timer-badge' : 'thinking-timer-badge';
          var _badgeColor = _isResearchWorkflow ? '#a78bfa' : '#22d3ee';
          var _badgeLabel = _isResearchWorkflow ? 'Deep Research' : 'Thinking';
          var _badgeIcon = _isResearchWorkflow
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + _badgeColor + '" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + _badgeColor + '" stroke-width="2"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><path d="M10 21h4"/></svg>';
          timerBadge.innerHTML = _badgeIcon + '<span class="dr-timer-text">' + _badgeLabel + ': 0s</span>';
          c.appendChild(timerBadge);
          var drStart = Date.now();
          _drTimerInterval = setInterval(function() {
            var el = timerBadge.querySelector('.dr-timer-text');
            var _drEl = Math.round((Date.now() - drStart) / 1000);
            if (el) el.textContent = _badgeLabel + ': ' + (_drEl >= 60 ? Math.floor(_drEl / 60) + 'm ' + (_drEl % 60) + 's' : _drEl + 's');
          }, 1000);
        }
      }
    });
  }

  // v18.1: BUG 6 — Track failed/completed steps for accurate history reporting
  var completedSteps = [];
  var failedSteps = [];
  var stepIndex = 0;

  function runNextStep() {
    // v23.10: Check if automation was stopped
    if (workflow.id && isAutomationStopped(workflow.id)) {
      if (_drTimerInterval) clearInterval(_drTimerInterval);
      markAutomationDone(workflow.id);
      if (_runningCard) {
        _runningCard.classList.remove('is-running', 'is-running-research', 'is-running-thinking', 'is-stopped');
        var _sDots = _runningCard.querySelectorAll('.step-dot-active');
        for (var sd = 0; sd < _sDots.length; sd++) { _sDots[sd].classList.remove('step-dot-active'); _sDots[sd].style.boxShadow = ''; }
        var sBadge = _runningCard.querySelector('.dr-timer-badge, .thinking-timer-badge');
        if (sBadge) sBadge.remove();
        var _sLastRun = _runningCard.querySelector('.auto-lab-card-actions > span:first-child');
        if (_sLastRun) { _sLastRun.style.color = '#f59e0b'; _sLastRun.style.fontWeight = '400'; _sLastRun.textContent = 'Stopped'; }
      }
      showToast('Automation stopped after ' + completedSteps.length + '/' + workflow.steps.length + ' steps', 'warning');
      showPipelineResultsPanel(workflow, completedSteps, failedSteps, context);
      return Promise.resolve({ completedSteps: completedSteps, failedSteps: failedSteps, context: context, stopped: true });
    }
    if (stepIndex >= workflow.steps.length) {
      // v22.32: Remove running animation + timer badge + global tracker
      if (_drTimerInterval) clearInterval(_drTimerInterval);
      if (workflow.id) markAutomationDone(workflow.id);
      if (_runningCard) {
        _runningCard.classList.remove('is-running');
        _runningCard.classList.remove('is-running-research');
        _runningCard.classList.remove('is-running-thinking');
        // v22.46: Clear step dot glow
        var _glowDots = _runningCard.querySelectorAll('.step-dot-active');
        for (var gd = 0; gd < _glowDots.length; gd++) { _glowDots[gd].classList.remove('step-dot-active'); _glowDots[gd].style.boxShadow = ''; }
        var drBadge = _runningCard.querySelector('.dr-timer-badge');
        if (drBadge) drBadge.remove();
        var thinkBadge = _runningCard.querySelector('.thinking-timer-badge');
        if (thinkBadge) thinkBadge.remove();
      }
      var total = workflow.steps.length;
      if (failedSteps.length === 0) {
        showToast('Workflow complete! (' + total + ' steps)', 'success');
      } else {
        showToast('Workflow completed with errors (' + completedSteps.length + '/' + total + ' steps succeeded)', 'warning');
      }
      // v18.5: Sync lastRun to automations storage
      if (workflow.id) syncLastRunToAutomations(workflow.id, new Date().toISOString());
      // v18.5: Show pipeline results panel with image previews
      showPipelineResultsPanel(workflow, completedSteps, failedSteps, context);
      return Promise.resolve({ completedSteps: completedSteps, failedSteps: failedSteps, context: context, _runningCard: _runningCard });
    }

    var step = workflow.steps[stepIndex];
    // v22.46: Highlight current step dot on the running card
    // v29.x: Re-find the card in case DOM was re-rendered (tab switch)
    if (workflow.id) {
      var freshCard = document.querySelector('.auto-lab-card[data-auto-id="' + workflow.id + '"]');
      if (freshCard) _runningCard = freshCard;
    }
    if (_runningCard) {
      var _dots = _runningCard.querySelectorAll('.pipeline-step-dot');
      for (var d = 0; d < _dots.length; d++) {
        _dots[d].classList.remove('step-dot-active');
        _dots[d].style.boxShadow = '';
      }
      if (_dots[stepIndex]) {
        _dots[stepIndex].classList.add('step-dot-active');
      }
    }
    // v29.x: Persist step index so glow survives tab switches
    if (workflow.id && typeof updateRunningStepIndex === 'function') {
      updateRunningStepIndex(workflow.id, stepIndex);
    }
    stepIndex++;

    return executeWorkflowStep(step, context).then(function(output) {
      // v20.10: Always store output in context (even empty) so template vars resolve
      if (step.outputKey) {
        context[step.outputKey] = output || '';
      }
      completedSteps.push(step);
      // v18.1: FEATURE 7 — Per-step history entry
      if (typeof addAutoLabHistory === 'function') {
        addAutoLabHistory({ name: (workflow.name || 'Pipeline') + ' > Step ' + step.stepId + ': ' + (step.name || step.action), action: step.action }, true, output ? String(output).substring(0, 50000) : '');
      }
      // v22.47: Per-step approval gate — pause pipeline and show review modal
      if (step.config && step.config.requireApproval) {
        return showPipelineApprovalModal(step, output, workflow, stepIndex, workflow.steps.length).then(function(approved) {
          if (approved) {
            return runNextStep();
          } else {
            // User rejected — stop pipeline, clean up
            if (_drTimerInterval) clearInterval(_drTimerInterval);
            if (workflow.id) markAutomationDone(workflow.id);
            if (_runningCard) {
              _runningCard.classList.remove('is-running', 'is-running-research', 'is-running-thinking');
              var _glowDots2 = _runningCard.querySelectorAll('.step-dot-active');
              for (var gd2 = 0; gd2 < _glowDots2.length; gd2++) { _glowDots2[gd2].classList.remove('step-dot-active'); _glowDots2[gd2].style.boxShadow = ''; }
              var drBadge2 = _runningCard.querySelector('.dr-timer-badge');
              if (drBadge2) drBadge2.remove();
              var thinkBadge2 = _runningCard.querySelector('.thinking-timer-badge');
              if (thinkBadge2) thinkBadge2.remove();
            }
            showToast('Pipeline stopped at step ' + step.stepId + ' (rejected)', 'warning');
            if (workflow.id) syncLastRunToAutomations(workflow.id, new Date().toISOString());
            showPipelineResultsPanel(workflow, completedSteps, failedSteps, context);
            return Promise.resolve({ completedSteps: completedSteps, failedSteps: failedSteps, context: context });
          }
        });
      }
      return runNextStep();
    }).catch(function(err) {
      failedSteps.push({ step: step, error: err.message || 'Unknown error' });
      showToast('Workflow step ' + step.stepId + ' failed: ' + (err.message || 'Unknown error'), 'error');
      // v18.1: FEATURE 7 — Per-step failure history
      if (typeof addAutoLabHistory === 'function') {
        addAutoLabHistory({ name: (workflow.name || 'Pipeline') + ' > Step ' + step.stepId + ': ' + (step.name || step.action), action: step.action }, false, err.message || 'Unknown error');
      }
      return runNextStep(); // Continue to next step
    });
  }

  return runNextStep();
}

// v18.5: Show results panel after pipeline execution with image previews
function showPipelineResultsPanel(workflow, completedSteps, failedSteps, context) {
  // Only show if there's meaningful output (images or text)
  var hasImages = false;
  var ctxKeys = Object.keys(context);
  ctxKeys.forEach(function(k) {
    if (typeof context[k] === 'string' && context[k].indexOf('data:image') === 0) hasImages = true;
  });
  if (!hasImages && completedSteps.length === 0) return;

  var existing = document.getElementById('pipelineResultsPanel');
  if (existing) existing.remove();

  var html = '<div id="pipelineResultsPanel" style="position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">';
  html += '<div style="background:var(--bg-primary);border-radius:16px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;padding:28px;border:1px solid var(--border-primary);" onclick="event.stopPropagation()">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">';
  html += '<div style="font-size:16px;font-weight:600;color:var(--text-primary);">Pipeline Results: ' + escapeHtml(workflow.name || 'Untitled') + '</div>';
  html += '<button onclick="document.getElementById(\'pipelineResultsPanel\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">&times;</button>';
  html += '</div>';

  // Show each step result
  var allSteps = workflow.steps || [];
  allSteps.forEach(function(step) {
    var key = step.outputKey;
    var output = key ? context[key] : null;
    var failed = failedSteps.some(function(f) { return f.step && f.step.stepId === step.stepId; });
    var statusColor = failed ? '#ef4444' : '#4ade80';
    var statusText = failed ? 'Failed' : 'Completed';

    html += '<div style="padding:12px;border:1px solid var(--border-color);border-radius:10px;margin-bottom:10px;">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
    html += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + statusColor + ';"></span>';
    html += '<span style="font-weight:600;font-size:13px;color:var(--text-primary);">Step ' + step.stepId + ': ' + escapeHtml(step.name || step.action) + '</span>';
    html += '<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">' + statusText + '</span>';
    html += '</div>';

    if (output && typeof output === 'string') {
      if (output.indexOf('data:image') === 0) {
        html += '<div style="text-align:center;"><img src="' + output + '" style="max-width:100%;max-height:300px;border-radius:10px;border:1px solid var(--border-color);" loading="lazy"></div>';
      } else {
        // v18.6: Rich text rendering, no char truncation
        var _stepRendered = typeof formatMessageContent === 'function' ? formatMessageContent(output) : escapeHtml(output);
        html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;max-height:200px;overflow-y:auto;padding:8px;background:var(--bg-secondary);border-radius:8px;">' + _stepRendered + '</div>';
      }
    }
    html += '</div>';
  });

  html += '<div style="text-align:right;margin-top:16px;">';
  html += '<button class="auto-lab-card-btn" onclick="document.getElementById(\'pipelineResultsPanel\').remove()">Close</button>';
  html += '</div>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

// v22.47: Pipeline step approval modal — pauses execution, returns Promise<boolean>
function showPipelineApprovalModal(step, output, workflow, currentStepIdx, totalSteps) {
  return new Promise(function(resolve) {
    var existing = document.getElementById('pipelineApprovalModal');
    if (existing) existing.remove();

    var sType = PIPELINE_STEP_TYPES[step.action] || PIPELINE_STEP_TYPES.studio;
    var stepNum = step.stepId || currentStepIdx;
    var stepLabel = step.name || sType.label;
    var remainingSteps = totalSteps - currentStepIdx;

    var html = '<div id="pipelineApprovalModal" style="position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;" onclick="event.stopPropagation()">';
    html += '<div style="background:var(--bg-primary);border-radius:16px;max-width:640px;width:100%;max-height:85vh;overflow-y:auto;padding:28px;border:1px solid ' + sType.color + '33;">';

    // Header with step info
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">';
    html += '<div style="width:32px;height:32px;border-radius:50%;background:' + sType.color + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2">' + sType.icon + '</svg></div>';
    html += '<div><div style="font-size:16px;font-weight:600;color:var(--text-primary);">Approval Required</div>';
    html += '<div style="font-size:12px;color:var(--text-muted);">Step ' + stepNum + ': ' + escapeHtml(stepLabel) + ' (' + escapeHtml(workflow.name || 'Pipeline') + ')</div></div>';
    html += '</div>';

    // Progress indicator
    html += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:16px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;">';
    for (var pi = 0; pi < totalSteps; pi++) {
      var pStep = workflow.steps[pi];
      var pType = PIPELINE_STEP_TYPES[pStep.action] || PIPELINE_STEP_TYPES.studio;
      var dotStyle = 'width:10px;height:10px;border-radius:50%;flex-shrink:0;';
      if (pi < currentStepIdx) {
        dotStyle += 'background:' + pType.color + ';';
      } else if (pi === currentStepIdx - 1) {
        dotStyle += 'background:' + pType.color + ';box-shadow:0 0 8px ' + pType.color + ';';
      } else {
        dotStyle += 'background:var(--bg-tertiary);border:1px solid var(--border-color);';
      }
      if (pi > 0) html += '<div style="width:12px;height:2px;background:' + (pi < currentStepIdx ? pType.color : 'var(--border-color)') + ';flex-shrink:0;"></div>';
      html += '<div style="' + dotStyle + '" title="Step ' + (pi + 1) + ': ' + escapeHtml(pStep.name || pType.label) + '"></div>';
    }
    html += '<span style="font-size:11px;color:var(--text-muted);margin-left:8px;">' + remainingSteps + ' step' + (remainingSteps !== 1 ? 's' : '') + ' remaining</span>';
    html += '</div>';

    // Output preview
    html += '<div style="margin-bottom:16px;">';
    html += '<div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Step Output Preview</div>';
    if (output && typeof output === 'string') {
      if (output.indexOf('data:image') === 0) {
        html += '<div style="text-align:center;padding:12px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border-color);"><img src="' + output + '" style="max-width:100%;max-height:300px;border-radius:8px;" loading="lazy"></div>';
      } else {
        var _approvalRendered = typeof formatMessageContent === 'function' ? formatMessageContent(output) : escapeHtml(output);
        html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;max-height:300px;overflow-y:auto;padding:12px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border-color);">' + _approvalRendered + '</div>';
      }
    } else {
      html += '<div style="font-size:13px;color:var(--text-muted);padding:12px;background:var(--bg-secondary);border-radius:10px;text-align:center;">No output generated</div>';
    }
    html += '</div>';

    // Action buttons
    html += '<div style="display:flex;gap:10px;justify-content:flex-end;">';
    html += '<button id="pipelineApprovalReject" class="auto-lab-card-btn" style="background:rgba(239,68,68,0.1);border:1px solid #ef4444;color:#ef4444;padding:8px 20px;font-size:13px;font-weight:500;">';
    html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;vertical-align:-2px;"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    html += 'Reject & Stop</button>';
    html += '<button id="pipelineApprovalApprove" class="auto-lab-card-btn" style="background:rgba(74,222,128,0.15);border:1px solid #4ade80;color:#4ade80;padding:8px 20px;font-size:13px;font-weight:500;">';
    html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;vertical-align:-2px;"><polyline points="20 6 9 17 4 12"/></svg>';
    html += 'Approve & Continue</button>';
    html += '</div>';

    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    // Bind button handlers
    var approveBtn = document.getElementById('pipelineApprovalApprove');
    var rejectBtn = document.getElementById('pipelineApprovalReject');
    if (approveBtn) {
      approveBtn.onclick = function() {
        var modal = document.getElementById('pipelineApprovalModal');
        if (modal) modal.remove();
        resolve(true);
      };
    }
    if (rejectBtn) {
      rejectBtn.onclick = function() {
        var modal = document.getElementById('pipelineApprovalModal');
        if (modal) modal.remove();
        resolve(false);
      };
    }
  });
}

// v18.5: Results panel for single (non-pipeline) workflow execution
function showSingleWorkflowResultsPanel(task, success, result) {
  if (!result && !task) return;

  var existing = document.getElementById('pipelineResultsPanel');
  if (existing) existing.remove();

  var statusColor = success ? '#4ade80' : '#ef4444';
  var statusText = success ? 'Completed' : 'Failed';
  var actionNames = { post: 'Post to Social', studio: 'Studio Operation', image: 'Image Generation', video: 'Video Generation', message: 'AI Message', library: 'Save to Library', notify: 'Notification', pulse: 'Pulse Update', reminder: 'Reminder' };
  var actionLabel = actionNames[task.action] || task.action || 'Task';

  var html = '<div id="pipelineResultsPanel" style="position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">';
  html += '<div style="background:var(--bg-primary);border-radius:16px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;padding:28px;border:1px solid var(--border-primary);" onclick="event.stopPropagation()">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">';
  html += '<div style="font-size:16px;font-weight:600;color:var(--text-primary);">Automation Result: ' + escapeHtml(task.name || 'Untitled') + '</div>';
  html += '<button onclick="document.getElementById(\'pipelineResultsPanel\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">&times;</button>';
  html += '</div>';

  html += '<div style="padding:12px;border:1px solid var(--border-color);border-radius:10px;margin-bottom:10px;">';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
  html += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + statusColor + ';"></span>';
  html += '<span style="font-weight:600;font-size:13px;color:var(--text-primary);">' + escapeHtml(actionLabel) + '</span>';
  html += '<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">' + statusText + '</span>';
  html += '</div>';

  if (result && typeof result === 'string') {
    if (result.indexOf('data:image') === 0) {
      html += '<div style="text-align:center;"><img src="' + result + '" style="max-width:100%;max-height:300px;border-radius:10px;border:1px solid var(--border-color);" loading="lazy"></div>';
    } else {
      // v18.6: Rich text via formatMessageContent instead of escapeHtml, no char truncation
      var _renderedResult = typeof formatMessageContent === 'function' ? formatMessageContent(result) : escapeHtml(result);
      html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6;max-height:400px;overflow-y:auto;padding:12px;background:var(--bg-secondary);border-radius:8px;">' + _renderedResult + '</div>';
    }
  }
  html += '</div>';

  // v18.7: Extract post URLs from result for "View Post" buttons
  var _postUrlMatches = [];
  if (result && typeof result === 'string') {
    var _urlRegex = /\[View on ([^\]]+)\]\(([^)]+)\)/g;
    var _urlMatch;
    while ((_urlMatch = _urlRegex.exec(result)) !== null) {
      _postUrlMatches.push({ label: _urlMatch[1], url: _urlMatch[2] });
    }
  }

  // v18.6: Smart action buttons based on result type — stash data in global to avoid inline JSON escaping issues
  window._autoResultData = { result: result, taskName: task.name || 'Automation' };
  html += '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;justify-content:flex-end;">';
  // v18.7: "View Post" buttons for social post results
  if (_postUrlMatches.length > 0) {
    _postUrlMatches.forEach(function(pu) {
      html += '<button class="auto-lab-card-btn" style="background:var(--accent-10,rgba(168,152,120,0.1));border:1px solid var(--accent);color:var(--accent);" onclick="window.open(\'' + escapeHtml(pu.url) + '\',\'_blank\')"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;vertical-align:middle;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>View on ' + escapeHtml(pu.label) + '</button>';
    });
  }
  if (result && typeof result === 'string' && result.indexOf('data:image') !== 0) {
    html += '<button class="auto-lab-card-btn" style="background:var(--bg-tertiary);border:1px solid var(--border-color);" onclick="continueAutomationInChat(window._autoResultData.result)">Continue in Chat</button>';
    html += '<button class="auto-lab-card-btn" style="background:var(--bg-tertiary);border:1px solid var(--border-color);" onclick="saveAutomationResultDirect(window._autoResultData.taskName, window._autoResultData.result)">Save to Library</button>';
    html += '<button class="auto-lab-card-btn" style="background:var(--brand-accent-10, rgba(168,152,120,0.1));border:1px solid var(--brand-accent-20, rgba(168,152,120,0.3));color:var(--brand-accent, #a89878);" onclick="saveToFolio(window._autoResultData.result, window._autoResultData.taskName, \'automation\')">Save to Folio</button>';
    if (/^[\s]*[-*\d]+[\.\)]/m.test(result)) {
      html += '<button class="auto-lab-card-btn" style="background:var(--bg-tertiary);border:1px solid var(--border-color);" onclick="addAutomationResultToPulse(window._autoResultData.result)">Add to Pulse</button>';
    }
  } else if (result && typeof result === 'string' && result.indexOf('data:image') === 0) {
    html += '<button class="auto-lab-card-btn" style="background:var(--bg-tertiary);border:1px solid var(--border-color);" onclick="saveAutomationImageToLibrary(window._autoResultData.taskName)">Save to Library</button>';
  }
  html += '<button class="auto-lab-card-btn" onclick="document.getElementById(\'pipelineResultsPanel\').remove()">Close</button>';
  html += '</div>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

// v18.6: Smart action button handlers for automation result panels
function continueAutomationInChat(resultText) {
  var panel = document.getElementById('pipelineResultsPanel');
  if (panel) panel.remove();
  showView('agent');
  // Pre-fill chat input with context from result
  var chatInput = document.getElementById('agentInput');
  if (chatInput) {
    chatInput.value = 'Based on this automation result, please help me continue:\n\n' + resultText.substring(0, 2000);
    chatInput.focus();
  }
}

function saveAutomationResultDirect(taskName, resultText) {
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib.files) lib.files = [];
  var formattedContent = typeof formatMessageContent === 'function' ? formatMessageContent(resultText) : resultText;
  var content = '<div class="automation-output"><div class="automation-header" style="margin-bottom:var(--space-4);padding-bottom:var(--space-3);border-bottom:1px solid var(--border-color);"><h2 style="margin:0 0 4px 0;color:var(--text-primary);">' + escapeHtml(taskName) + '</h2><p style="margin:0;font-size:var(--text-sm);color:var(--text-muted);">Saved: ' + new Date().toLocaleString() + '</p></div><div class="automation-body">' + formattedContent + '</div></div>';
  lib.files.push({ id: 'auto-' + Date.now(), name: taskName + ' - ' + new Date().toLocaleDateString(), type: 'automation-output', content: content, folderId: 'scheduled-outputs', savedAt: new Date().toISOString() });
  saveLibraryForBrandIndex(brandIdx, lib);
  showToast('Saved to Library', 'success');
}

function saveAutomationImageToLibrary(taskName) {
  // Find the image from the results panel
  var panel = document.getElementById('pipelineResultsPanel');
  if (!panel) return;
  var img = panel.querySelector('img');
  if (!img || !img.src) { showToast('No image found', 'warning'); return; }
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib.files) lib.files = [];
  lib.files.push({ id: 'auto-img-' + Date.now(), name: taskName + ' - ' + new Date().toLocaleDateString(), type: 'image', content: '<img src="' + img.src + '" style="max-width:100%;border-radius:8px;">', folderId: 'scheduled-outputs', savedAt: new Date().toISOString() });
  saveLibraryForBrandIndex(brandIdx, lib);
  showToast('Image saved to Library', 'success');
}

function addAutomationResultToPulse(resultText) {
  var panel = document.getElementById('pipelineResultsPanel');
  if (panel) panel.remove();
  // Parse list items from result
  var lines = resultText.split('\n');
  var items = [];
  lines.forEach(function(line) {
    var trimmed = line.replace(/^[\s]*[-*•]\s*/, '').replace(/^[\s]*\d+[\.\)]\s*/, '').trim();
    if (trimmed.length > 3 && trimmed.length < 200) items.push(trimmed);
  });
  if (items.length === 0) { showToast('No list items found', 'warning'); return; }
  // Add first 5 items as a single pulse goal with sub-items
  var goal = {
    id: 'auto_' + Date.now(),
    title: 'Automation Items (' + new Date().toLocaleDateString() + ')',
    category: 'Automations',
    source: 'studio',
    completed: false,
    archived: false,
    items: items.slice(0, 5).map(function(item, i) {
      return { id: 'item_' + Date.now() + '_' + i, text: item, completed: false };
    }),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  if (typeof pulseGoals !== 'undefined') {
    pulseGoals.push(goal);
    if (typeof savePulseGoals === 'function') savePulseGoals();
    showToast(items.slice(0, 5).length + ' item' + (items.length > 1 ? 's' : '') + ' added to Pulse', 'success');
    showView('pulse');
  } else {
    showToast('Pulse not available', 'warning');
  }
}

function executeWorkflowStep(step, context) {
  var action = step.action;
  var target = step.target || {};

  if (action === 'post') {
    var platforms = target.platforms || ['x'];
    var content = resolveTemplateVars(target.contentRef || target.text || '', context);
    // v20.10: If template vars didn't resolve (still has {{ }}), treat as empty
    if (content && content.indexOf('{{') !== -1) content = '';
    // v18.5: Auto-resolve content from last text output if contentRef was empty or didn't resolve
    if (!content && context) {
      var _autoKeys = Object.keys(context);
      for (var _ak = _autoKeys.length - 1; _ak >= 0; _ak--) {
        var _akVal = context[_autoKeys[_ak]];
        if (typeof _akVal === 'string' && _akVal.length > 0 && _akVal.indexOf('data:image') !== 0 && _autoKeys[_ak] !== 'brandName') {
          content = _akVal;
          break;
        }
      }
    }
    // v18.2: Resolve explicit imageRef template variable first
    var postImageUrl = null;
    if (target.imageRef) {
      var resolvedImg = resolveTemplateVars(target.imageRef, context);
      if (resolvedImg && typeof resolvedImg === 'string' && resolvedImg.indexOf('data:image') === 0) {
        postImageUrl = resolvedImg;
      }
    }
    // v18.2: Check for directly uploaded image on target or stashed in memory
    if (!postImageUrl && target.uploadedImage && typeof target.uploadedImage === 'string' && target.uploadedImage.indexOf('data:image') === 0) {
      postImageUrl = target.uploadedImage;
    }
    if (!postImageUrl && target._hasUploadedImage && window._wfUploadedImages) {
      // Look for stashed image from workflow save
      var stashedKeys = Object.keys(window._wfUploadedImages);
      if (stashedKeys.length > 0) {
        postImageUrl = window._wfUploadedImages[stashedKeys[stashedKeys.length - 1]];
      }
    }
    // v24.4: Check for agent-attached image stored in memory (not localStorage)
    if (!postImageUrl && step.config && step.config._hasUserImage && window._autoAgentImages) {
      var _agentImgKeys = Object.keys(window._autoAgentImages);
      if (_agentImgKeys.length > 0) {
        postImageUrl = window._autoAgentImages[_agentImgKeys[_agentImgKeys.length - 1]];
      }
    }
    // v18.1: FEATURE 6 — Smart image detection from previous step outputs (fallback)
    if (!postImageUrl && context) {
      var ctxKeys = Object.keys(context);
      for (var ci = 0; ci < ctxKeys.length; ci++) {
        var ctxVal = context[ctxKeys[ci]];
        if (typeof ctxVal === 'string' && ctxVal.indexOf('data:image') === 0) {
          postImageUrl = ctxVal;
          break;
        }
      }
    }
    // Also check if target.includeImage was set
    if (target.includeImage && !postImageUrl) {
      var ctxKeys2 = Object.keys(context);
      for (var ci2 = ctxKeys2.length - 1; ci2 >= 0; ci2--) {
        if (typeof context[ctxKeys2[ci2]] === 'string' && context[ctxKeys2[ci2]].indexOf('data:image') === 0) {
          postImageUrl = context[ctxKeys2[ci2]]; break;
        }
      }
    }
    // v20.10: Early check — no content means step 1 likely failed/returned empty
    if (!content && !postImageUrl) {
      return Promise.reject(new Error('Post failed: No content available (previous step may have returned empty)'));
    }
    // v18.2: Track failures across platforms for accurate status reporting
    var postFailures = [];
    var postUrls = []; // v18.7: Track post URLs for result panel
    var promises = platforms.map(function(platform) {
      if (platform === 'tiktok') {
        saveSocialPost(platform, formatForPlatform(content, platform), null, 'copied');
        return Promise.resolve(content);
      }
      if (!isSocialConnected(platform)) {
        showToast(SOCIAL_PLATFORM_NAMES[platform] + ' not connected, skipping', 'warning');
        postFailures.push(platform + ': not connected');
        return Promise.resolve(content);
      }
      var formatted = formatForPlatform(content, platform);
      return getSocialToken(platform).then(function(tokenData) {
        if (!tokenData || !tokenData.accessToken) {
          postFailures.push(platform + ': no token');
          return content;
        }
        // v20.8: Auto-refresh expired tokens before posting
        return refreshSocialTokenIfNeeded(platform, tokenData);
      }).then(function(tokenData) {
        if (!tokenData || !tokenData.accessToken) {
          postFailures.push(platform + ': no token after refresh');
          return content;
        }
        // v18.2: Upload image for X and Threads if available
        var mediaIdPromise = Promise.resolve([]);
        if (postImageUrl && platform === 'x') {
          mediaIdPromise = fetch('/api/social-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'x', accessToken: tokenData.accessToken, imageBase64: postImageUrl })
          }).then(function(r) { return r.json(); }).then(function(d) {
            return d.mediaId ? [d.mediaId] : [];
          }).catch(function() { return []; });
        }
        return mediaIdPromise.then(function(mIds) {
          var postBody = {
            platform: platform,
            accessToken: tokenData.accessToken,
            content: formatted,
            mediaIds: mIds,
            userId: tokenData.userId || ''
          };
          // v18.2: Pass image for Threads/Instagram via imageUrl field
          if (postImageUrl && (platform === 'threads' || platform === 'instagram')) {
            postBody.imageBase64 = postImageUrl;
          }
          return fetch('/api/social-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postBody)
          }).then(function(r) { return r.json(); }).then(function(data) {
            if (data.error) {
              // v18.6: Surface full API error detail
              var _errDetail = data.error;
              if (data.detail) {
                var _detailStr = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
                if (_detailStr.length < 200) _errDetail += ' (' + _detailStr + ')';
              }
              showToast('Post to ' + SOCIAL_PLATFORM_NAMES[platform] + ' failed: ' + _errDetail, 'error');
              saveSocialPost(platform, formatted, null, 'failed');
              postFailures.push(platform + ': ' + _errDetail);
            } else {
              showToast('Posted to ' + SOCIAL_PLATFORM_NAMES[platform], 'success');
              saveSocialPost(platform, formatted, data.postUrl || null, 'posted');
              // v18.7: Track post URLs for result panel
              if (data.postUrl) postUrls.push({ platform: platform, url: data.postUrl });
            }
            return content;
          });
        });
      }).catch(function(err) {
        postFailures.push(platform + ': ' + (err.message || 'Unknown error'));
        return content;
      });
    });
    return Promise.all(promises).then(function() {
      // v18.2: Reject if any platform failed so pipeline history reflects failure
      if (postFailures.length > 0) {
        throw new Error('Post failed: ' + postFailures.join('; '));
      }
      // v18.6: Return rich result with posted content for display in results panel
      var richResult = 'Posted to ' + platforms.join(', ') + '\n\n**Content:**\n' + content.substring(0, 2000);
      // v18.7: Include post URLs
      if (postUrls.length > 0) {
        richResult += '\n\n**Post Links:**\n';
        postUrls.forEach(function(pu) { richResult += '- [View on ' + (pu.platform === 'x' ? 'X' : pu.platform.charAt(0).toUpperCase() + pu.platform.slice(1)) + '](' + pu.url + ')\n'; });
      }
      if (postImageUrl) richResult += '\n\n[Image attached]';
      return richResult;
    });
  }

  if (action === 'studio') {
    // v22.9: Route to Deep Research if toggle is on
    if (step.config && step.config.useDeepResearch && typeof startDeepResearch === 'function') {
      var drQuery = '';
      var drOp = typeof findOperationById === 'function' ? findOperationById(target.operationId) : null;
      if (drOp) drQuery = drOp.name + (drOp.desc ? ': ' + drOp.desc : '');
      if (target.contextRef) {
        var drResolved = resolveTemplateVars(target.contextRef, context);
        if (drResolved) drQuery = (drQuery ? drQuery + '\n\n' : '') + drResolved;
      }
      if (!drQuery) drQuery = 'Deep research analysis';
      showToast('Starting Deep Research (step ' + step.stepId + ')... This may take 1-5 minutes.', 'info');
      // v22.10: Use runDeepResearchFull with auto-retry
      return runDeepResearchFull(drQuery, function(status, elapsed) {
        // Progress in pipeline context
      }, 3).then(function(result) {
        showToast('Step ' + step.stepId + ' Deep Research complete (' + result.elapsed + 's)', 'success');
        return result.text || '';
      });
    }
    // v17.4: Actually call the AI API for studio operations
    showToast('Generating content (step ' + step.stepId + ')...', 'info');
    var operation = typeof findOperationById === 'function' ? findOperationById(target.operationId) : null;
    if (!operation) {
      showToast('Operation not found for step ' + step.stepId, 'warning');
      return Promise.resolve('');
    }
    // v19.0: Pipeline steps always use focused task prompt — prevents conversational AI responses
    // v23.10: Restructured prompt — context FIRST, then task, then directive. Prevents thinking models from ignoring user instructions.
    var userPrompt = '';
    // Add user-provided context/instructions FIRST so it's most prominent
    if (target.contextRef) {
      var resolved = resolveTemplateVars(target.contextRef, context);
      if (resolved) userPrompt += 'USER INSTRUCTIONS:\n' + resolved + '\n\n';
    }
    userPrompt += 'TASK: ' + operation.name + '\n';
    if (operation.desc) userPrompt += operation.desc + '\n';
    if (operation.isRawOutput) {
      userPrompt += '\nCRITICAL OUTPUT RULE: Your ENTIRE response must be ONLY the final content text. No titles, no headers, no section labels, no analysis, no brand voice scores, no tone analysis, no posting time suggestions, no markdown formatting (no #, no **, no |), no explanations, no preamble. Output the raw text exactly as it should be published.\n';
    } else if (operation.outputs) {
      userPrompt += '\nRequired Deliverables:\n';
      operation.outputs.forEach(function(o) { userPrompt += '- ' + o + '\n'; });
    }
    // v19.2: Resolve API settings — use workflow brand from context, not global selectedBrand
    var brandIdx = (context && context._brandIdx !== undefined) ? context._brandIdx : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
    var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : { name: 'Brand' };
    var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    var _validProvs = ['anthropic', 'openai', 'google'];
    var provider = (settings.provider && _validProvs.indexOf(settings.provider) !== -1) ? settings.provider : 'anthropic';
    var model = settings.model || 'claude-sonnet-4-6';
    // v18.1: FEATURE 4 — Per-step provider override
    // v20.9: Only accept known providers — AI sometimes sets brand name as provider
    if (step.config && step.config.provider && _validProvs.indexOf(step.config.provider) !== -1) {
      provider = step.config.provider;
      // Pick a sensible default model for the overridden provider
      if (provider === 'anthropic') model = 'claude-sonnet-4-6';
      else if (provider === 'openai') model = 'gpt-5.4';
      else if (provider === 'google') model = 'gemini-2.0-flash';
    }
    // v18.7: Per-step model override
    if (step.config && step.config.model) {
      model = step.config.model;
    }
    // v20.10: Resolve 'auto' smart routing to actual provider/model
    if (model === 'auto' || provider === 'roweos') {
      var _resolved = (typeof resolveRoweOSAI === 'function') ? resolveRoweOSAI({ userMessage: userPrompt, agentCategory: target.agentId }) : null;
      if (_resolved) { provider = _resolved.provider; model = _resolved.model; }
      else { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
    }
    // v18.7: Per-step output length
    if (step.config && step.config.length && step.config.length !== 'standard') {
      var _len = step.config.length;
      if (_len === 'brief') userPrompt += '\n\nKeep response concise and brief, under 200 words.';
      else if (_len === 'comprehensive') userPrompt += '\n\nProvide a thorough, comprehensive, detailed response. Do NOT cut short or abbreviate. Write the FULL content with all sections, details, and supporting points. Minimum 800 words.';
      else if (_len.indexOf('social-') === 0) {
        var _charLimit = _len.replace('social-', '');
        userPrompt += '\n\nOutput must be under ' + _charLimit + ' characters. This is for social media posting.';
      }
    }
    // v23.10: Stronger final directive — explicitly tells thinking models to execute, not converse
    userPrompt += '\n\n---\nYou are in a non-interactive automated pipeline. There is NO user to respond to. You MUST produce the complete output NOW using the instructions and context above. Do NOT ask questions, request clarification, or say anything like "Could you provide" or "I need more details". Execute the task with the information given.\n\nOutput:';
    // v19.0: Build system prompt — always use focused pipeline prompt, not conversational brand prompt
    var sysPrompt = '';
    var agentId = target.agentId || (operation.category || null);
    var brandName = (brand.shortName || brand.name || 'Brand');
    // v23.10: Stronger pipeline system prompt — prevents thinking models from going into "helpful assistant" mode
    sysPrompt = 'You are an automated task executor for ' + brandName + '. You are running inside a non-interactive automation pipeline with no user present to answer questions.';
    if (brand.tagline) sysPrompt += ' ' + brand.tagline + '.';
    if (brand.voice) sysPrompt += ' Voice: ' + brand.voice + '.';
    if (brand.tone) sysPrompt += ' Tone: ' + brand.tone + '.';
    if (brand.audience) sysPrompt += ' Audience: ' + brand.audience + '.';
    sysPrompt += ' RULES: 1) Execute the task immediately and produce complete output. 2) NEVER ask questions, seek clarification, or say you lack information. 3) NEVER produce meta-commentary about the task. 4) Use the provided context and instructions as your input data. 5) If details are missing, use reasonable defaults and proceed.';
    // v24.8: Inject user contact card and automation memory into pipeline step prompts
    var _ucStepPrompt = typeof getUserContactPrompt === 'function' ? getUserContactPrompt() : '';
    if (_ucStepPrompt) sysPrompt += '\n\n' + _ucStepPrompt;
    var _amStepPrompt = typeof getAutomationMemoryPrompt === 'function' ? getAutomationMemoryPrompt() : '';
    if (_amStepPrompt) sysPrompt += '\n\n' + _amStepPrompt;
    return (typeof getApiKey === 'function' ? getApiKey(provider) : Promise.resolve(null)).then(function(apiKey) {
      if (!apiKey) {
        showToast('No API key for ' + provider, 'error');
        return '';
      }
      // v22.37: Pass higher token limit for comprehensive length
      var _maxTok = (step.config && step.config.length === 'comprehensive') ? 16384 : 4096;
      return makeScheduledTaskAPICall(provider, model, apiKey, sysPrompt, userPrompt, 0, _maxTok);
    }).then(function(result) {
      if (result) showToast('Step ' + step.stepId + ' content generated', 'success');
      return result || '';
    });
  }

  if (action === 'image') {
    // v17.4: Actually call image generation API
    var imgPrompt = resolveTemplateVars(target.text || '', context);
    showToast('Generating image (step ' + step.stepId + ')...', 'info');
    if (typeof generateImageWithNanobanana !== 'function') {
      showToast('Image generation not available', 'error');
      return Promise.resolve('');
    }
    // v18.1: FEATURE 5 — Pass reference images if attached
    var imgGenOpts = {};
    if (step.config && step.config.referenceImage) {
      imgGenOpts.referenceImages = [step.config.referenceImage];
    }
    // v18.7: Pass image model if specified
    if (step.config && step.config.imageModel) {
      imgGenOpts.model = step.config.imageModel;
    }
    // v18.7: Pass image provider if specified
    if (step.config && step.config.provider) {
      imgGenOpts.provider = step.config.provider;
    }
    return generateImageWithNanobanana(imgPrompt, imgGenOpts).then(function(imgResult) {
      var imgDataUrl = '';
      if (imgResult && imgResult.images && imgResult.images[0] && imgResult.images[0].base64) {
        imgDataUrl = 'data:' + (imgResult.images[0].mimeType || 'image/png') + ';base64,' + imgResult.images[0].base64;
      } else if (imgResult && imgResult.imageData) {
        imgDataUrl = 'data:image/png;base64,' + imgResult.imageData;
      } else if (imgResult && imgResult.base64) {
        imgDataUrl = 'data:image/png;base64,' + imgResult.base64;
      }
      // Save to image gallery
      try {
        var labImages = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]');
        labImages.push({ prompt: imgPrompt, model: 'auto', dataUrl: imgDataUrl, createdAt: new Date().toISOString() });
        if (labImages.length > 50) labImages = labImages.slice(-50);
        localStorage.setItem('roweos_auto_lab_images', JSON.stringify(labImages));
      } catch(e) {}
      // v18.1: FEATURE 9 — Also push to Image Lab chat messages
      if (typeof _imageLabChatMessages !== 'undefined' && imgDataUrl) {
        _imageLabChatMessages.push({ role: 'assistant', content: 'Pipeline generated: ' + (imgPrompt || '').substring(0, 100), imageUrl: imgDataUrl, timestamp: new Date().toISOString() });
        if (typeof saveImageLabChatMessages === 'function') saveImageLabChatMessages();
      }
      showToast('Step ' + step.stepId + ' image generated', 'success');
      return imgDataUrl;
    });
  }

  // v21.15: Video generation step
  if (action === 'video') {
    var vidPrompt = resolveTemplateVars(target.text || '', context);
    showToast('Generating video (step ' + step.stepId + ')...', 'info');
    if (typeof generateVideoWithVeo !== 'function') {
      showToast('Video generation not available', 'error');
      return Promise.resolve('');
    }
    var vidOpts = {};
    if (step.config && step.config.videoModel) vidOpts.model = step.config.videoModel;
    if (step.config && step.config.videoDuration) vidOpts.duration = parseInt(step.config.videoDuration) || 8;
    if (step.config && step.config.videoAspect) vidOpts.aspectRatio = step.config.videoAspect;
    if (step.config && step.config.referenceImage) {
      vidOpts.referenceImage = step.config.referenceImage;
    }
    return generateVideoWithVeo(vidPrompt, vidOpts).then(function(vidResult) {
      var vidUrl = vidResult && vidResult.videoUrl ? vidResult.videoUrl : '';
      // Save to video gallery
      try {
        var labVideos = JSON.parse(localStorage.getItem('roweos_auto_lab_videos') || '[]');
        labVideos.push({
          prompt: vidPrompt,
          model: vidResult.model || 'veo-3.1-fast-generate-preview',
          duration: vidResult.duration || 8,
          aspectRatio: vidResult.aspectRatio || '16:9',
          generationTime: vidResult.generationTime || 0,
          createdAt: new Date().toISOString()
        });
        if (labVideos.length > 50) labVideos = labVideos.slice(-50);
        localStorage.setItem('roweos_auto_lab_videos', JSON.stringify(labVideos));
      } catch(e) {}
      showToast('Step ' + step.stepId + ' video generated', 'success');
      return vidUrl;
    });
  }

  // v23.8: Infographic generation step
  if (action === 'infographic') {
    var infTopic = resolveTemplateVars(target.text || '', context);
    showToast('Generating infographic (step ' + step.stepId + ')...', 'info');
    if (typeof generateInfographicForPipeline !== 'function') {
      showToast('Infographic generation not available', 'error');
      return Promise.resolve('');
    }
    var brandIdx = (context && context._brandIdx !== undefined) ? context._brandIdx : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
    var infConfig = {};
    if (step.config && step.config.provider) infConfig.provider = step.config.provider;
    if (step.config && step.config.model) infConfig.model = step.config.model;
    return generateInfographicForPipeline(infTopic, brandIdx, infConfig).then(function(pngDataUrl) {
      // Save to image gallery
      try {
        var labImages = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]');
        labImages.push({ prompt: infTopic, model: 'infographic', dataUrl: pngDataUrl, createdAt: new Date().toISOString() });
        if (labImages.length > 50) labImages = labImages.slice(-50);
        localStorage.setItem('roweos_auto_lab_images', JSON.stringify(labImages));
      } catch(e) {}
      showToast('Step ' + step.stepId + ' infographic generated', 'success');
      return pngDataUrl;
    });
  }

  // v17.4: Save to Library step
  if (action === 'library') {
    var libContent = resolveTemplateVars(target.text || target.contentRef || '', context);
    // v24.20: Fallback — if no explicit content, use most recent context value (previous step output)
    if (!libContent) {
      var _libCtxKeys = Object.keys(context || {});
      for (var _lk = _libCtxKeys.length - 1; _lk >= 0; _lk--) {
        if (typeof context[_libCtxKeys[_lk]] === 'string' && context[_libCtxKeys[_lk]].length > 20 && _libCtxKeys[_lk] !== 'brandName') {
          libContent = context[_libCtxKeys[_lk]];
          break;
        }
      }
    }
    if (libContent) {
      var libTitle = resolveTemplateVars(target.libraryTitle || '', context) || step.name || 'Pipeline Output';
      var libTags = resolveTemplateVars(target.libraryTags || '', context) || '';
      try {
        var lib = JSON.parse(localStorage.getItem('roweosLibrary') || '{"files":[],"folders":[]}');
        lib.files.push({
          id: Date.now(),
          name: libTitle,
          content: libContent,
          type: 'text',
          folder: 'Drafts',
          tags: libTags ? libTags.split(',').map(function(t) { return t.trim(); }) : [],
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('roweosLibrary', JSON.stringify(lib));
      } catch(e) {}
      showToast('Step ' + step.stepId + ' saved to Library', 'success');
      writeDB('library/brand', { data: JSON.stringify(lib) }, { category: 'library' }); // v25.1
    }
    return Promise.resolve(libContent);
  }

  // v22.31: Generate PDF from previous step output
  if (action === 'pdf_generate') {
    var pdfSourceKey = (step.config && step.config.sourceStep) ? step.config.sourceStep : '';
    var pdfContent = pdfSourceKey && context[pdfSourceKey] ? context[pdfSourceKey] : '';
    if (!pdfContent) {
      // Fallback: use most recent string context value
      var ctxKeys = Object.keys(context || {});
      for (var _pk = ctxKeys.length - 1; _pk >= 0; _pk--) {
        if (typeof context[ctxKeys[_pk]] === 'string' && context[ctxKeys[_pk]].length > 50 && ctxKeys[_pk] !== 'brandName') {
          pdfContent = context[ctxKeys[_pk]];
          break;
        }
      }
    }
    if (!pdfContent) {
      return Promise.reject(new Error('PDF generation failed: no content available'));
    }
    var pdfTitle = (step.config && step.config.pdfTitle) ? resolveTemplateVars(step.config.pdfTitle, context) : 'RoweOS Export';
    var pdfOrient = (step.config && step.config.orientation) ? step.config.orientation : 'portrait';
    var pdfFilename = pdfTitle.replace(/\s+/g, '_') + '_' + Date.now() + '.pdf';
    try {
      var pdfResult = roweosPDF(pdfContent, {
        title: pdfTitle,
        subtitle: 'Generated by RoweOS Pipeline',
        orientation: pdfOrient,
        filename: pdfFilename,
        returnBase64: true
      });
      if (pdfResult && pdfResult.base64) {
        // Store PDF data in context for later steps (e.g., email attachment)
        context[step.outputKey || '_pdfData'] = JSON.stringify({
          filename: pdfFilename,
          base64: pdfResult.base64.split(',')[1] || pdfResult.base64,
          type: 'application/pdf',
          size: pdfResult.blob ? pdfResult.blob.size : 0
        });
        showToast('Step ' + step.stepId + ': PDF generated (' + pdfFilename + ')', 'success');
        return Promise.resolve('PDF generated: ' + pdfFilename);
      }
      return Promise.reject(new Error('PDF generation returned no data'));
    } catch(pdfErr) {
      return Promise.reject(new Error('PDF generation failed: ' + pdfErr.message));
    }
  }

  // v22.8: Send Email step
  if (action === 'email') {
    var emailTo = resolveTemplateVars(target.emailTo || '', context);
    var emailSubject = resolveTemplateVars(target.emailSubject || '', context);
    var emailBody = resolveTemplateVars(target.emailBody || '', context);
    var emailCc = target.emailCc ? target.emailCc.split(',').map(function(e) { return e.trim(); }).filter(Boolean) : [];
    var emailBcc = target.emailBcc ? target.emailBcc.split(',').map(function(e) { return e.trim(); }).filter(Boolean) : [];
    // v22.22: Auto-include previous step output in body (always, not just when checkbox set)
    // This ensures pipeline content→email flows naturally without manual config
    if (context) {
      var prevKeys = Object.keys(context);
      for (var _ek = prevKeys.length - 1; _ek >= 0; _ek--) {
        var _ev = context[prevKeys[_ek]];
        if (typeof _ev === 'string' && _ev.length > 0 && prevKeys[_ek] !== 'brandName' && prevKeys[_ek].indexOf('_brandIdx') === -1) {
          emailBody = (emailBody ? emailBody + '\n\n---\n\n' : '') + _ev;
          break;
        }
      }
    }
    if (!emailTo) {
      return Promise.reject(new Error('Email step failed: No recipient'));
    }
    // v22.22: If subject is too long (>150 chars), it's likely step output - move to body and use fallback subject
    if (emailSubject && emailSubject.length > 150) {
      emailBody = (emailBody ? emailBody + '\n\n---\n\n' : '') + emailSubject;
      emailSubject = '';
    }
    // v22.22: Fallback subject if empty (prevents "Subject is required" API error)
    if (!emailSubject) {
      emailSubject = (context && context.brandName ? context.brandName : 'RoweOS') + ' - Pipeline Output';
    }
    // v22.9: Use template type from step config
    var emailTemplate = (step.config && step.config.emailTemplate) ? step.config.emailTemplate : 'professional';
    // v22.22: Render markdown to rich HTML for email body with inline email-safe styles
    var _renderedEmailBody = emailBody;
    try {
      if (typeof marked !== 'undefined' && marked.parse) {
        _renderedEmailBody = marked.parse(emailBody);
        // Post-process: inject inline styles for email clients
        _renderedEmailBody = _renderedEmailBody
          .replace(/<table>/g, '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:16px 0;table-layout:fixed;">')
          .replace(/<th>/g, '<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #d1d1d1;font-size:11px;font-weight:600;background:#f5f5f5;word-wrap:break-word;">')
          .replace(/<th /g, '<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #d1d1d1;font-size:11px;font-weight:600;background:#f5f5f5;word-wrap:break-word;" ')
          .replace(/<td>/g, '<td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:12px;vertical-align:top;word-wrap:break-word;">')
          .replace(/<td /g, '<td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:12px;vertical-align:top;word-wrap:break-word;" ')
          .replace(/<h1>/g, '<h1 style="font-size:20px;font-weight:600;margin:24px 0 8px;line-height:1.3;">')
          .replace(/<h2>/g, '<h2 style="font-size:17px;font-weight:600;margin:20px 0 6px;line-height:1.3;">')
          .replace(/<h3>/g, '<h3 style="font-size:15px;font-weight:600;margin:16px 0 4px;line-height:1.3;">')
          .replace(/<p>/g, '<p style="margin:0 0 12px;line-height:1.6;font-size:14px;">')
          .replace(/<ul>/g, '<ul style="margin:0 0 12px;padding-left:20px;font-size:14px;">')
          .replace(/<ol>/g, '<ol style="margin:0 0 12px;padding-left:20px;font-size:14px;">')
          .replace(/<li>/g, '<li style="margin:0 0 4px;line-height:1.5;">')
          .replace(/<hr>/g, '<hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">')
          .replace(/<blockquote>/g, '<blockquote style="margin:12px 0;padding:8px 16px;border-left:3px solid #d1d1d1;color:#666;font-size:13px;">');
      } else if (typeof markdownToHtml === 'function') {
        // v25.2: Fallback to built-in markdownToHtml when marked.js CDN not loaded
        _renderedEmailBody = markdownToHtml(emailBody);
      } else {
        _renderedEmailBody = escapeHtml(emailBody).replace(/\n/g, '<br>');
      }
    } catch(mdErr) {
      // v25.2: Use built-in markdown converter as catch fallback too
      try { _renderedEmailBody = typeof markdownToHtml === 'function' ? markdownToHtml(emailBody) : escapeHtml(emailBody).replace(/\n/g, '<br>'); } catch(e2) { _renderedEmailBody = escapeHtml(emailBody).replace(/\n/g, '<br>'); }
    }
    var htmlBody = '';
    if (emailTemplate === 'plain') {
      htmlBody = '<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">' + _renderedEmailBody + '</div>';
    } else if (emailTemplate === 'ai_custom') {
      htmlBody = '<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">' + _renderedEmailBody + '</div>';
    } else {
      // Use branded template
      var _brandName = (context && context.brandName) ? context.brandName : 'Brand';
      var _accent = '#a89878';
      try { _accent = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#a89878'; } catch(e) {}
      var _logo = '';
      // v23.11: Respect logo toggle from pipeline step config
      // v24.4: Prefer uploaded URL over base64 (email clients block base64 images)
      var _showLogo = !(step.config && step.config.includeLogo === false);
      if (_showLogo) {
        // v28.4: Prefer base64 over Firebase Storage URL (Storage URLs expire after ~1hr)
        if (window._mailLogoBase64) {
          _logo = window._mailLogoBase64;
        } else {
          try {
            var _logoEl = document.querySelector('.brand-logo-img');
            if (_logoEl) _logo = _logoEl.src;
            // Resize logo for email use (fire-and-forget)
            if (_logo && _logo.indexOf('data:') === 0 && typeof mailEnsureLogoUrl === 'function') {
              mailEnsureLogoUrl(_logo);
            }
          } catch(e) {}
        }
      }
      var _logoAlign = (step.config && step.config.logoAlignment) || 'center';
      window._studioEmailContext = {
        contentHtml: '<div style="font-size:15px;line-height:1.7;">' + _renderedEmailBody + '</div>',
        brandName: _brandName,
        accentColor: _accent,
        brandLogo: _logo,
        logoAlignment: _logoAlign,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      };
      htmlBody = generateBrandedEmail(emailTemplate);
    }
    var rawEmailFrom = (step.config && step.config.emailFrom) ? step.config.emailFrom : (typeof getDefaultFromAddress === 'function' ? getDefaultFromAddress() : '');
    var emailFrom = rawEmailFrom;
    // v23.10: Route through Gmail/Outlook API when from is a connected account
    var _useGmailSend = false;
    var _useOutlookSend = false;
    if (emailFrom.indexOf('gmail:') === 0) {
      emailFrom = emailFrom.substring(6);
      _useGmailSend = true;
    } else if (emailFrom.indexOf('outlook:') === 0) {
      emailFrom = emailFrom.substring(8);
      _useOutlookSend = true;
    } else {
      // Check if bare email matches a connected account
      var _emailCreds = typeof getMailAccountCredentials === 'function' ? getMailAccountCredentials(emailFrom) : null;
      if (_emailCreds && _emailCreds.provider === 'gmail' && _emailCreds.token) _useGmailSend = true;
      else if (_emailCreds && _emailCreds.provider === 'outlook' && _emailCreds.token) _useOutlookSend = true;
    }
    // v22.23: BCC yourself
    if (step.config && step.config.bccSelf && emailFrom) {
      var selfAddr = emailFrom;
      if (emailBcc.indexOf(selfAddr) === -1) emailBcc.push(selfAddr);
    }
    // v22.23: Queue to Outbox instead of auto-sending
    if (step.config && step.config.queueToOutbox && typeof addToMailOutbox === 'function') {
      var pipelineName = '';
      try { pipelineName = _pipelineName || ''; } catch(e) {}
      addToMailOutbox({
        to: emailTo,
        from: rawEmailFrom,
        subject: emailSubject,
        body: emailBody,
        canvasHtml: _renderedEmailBody,
        html: htmlBody,
        cc: emailCc,
        bcc: emailBcc,
        template: emailTemplate,
        pipelineName: pipelineName,
        folder: (step.config && step.config.outboxFolder) || ''
      });
      showToast('Email queued to outbox for review', 'success');
      return Promise.resolve('Email queued to outbox\nTo: ' + emailTo + '\nSubject: ' + emailSubject);
    }
    var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
    showToast('Sending email (step ' + step.stepId + ')...', 'info');
    // v23.10: Route through Gmail API for connected Gmail accounts
    if (_useGmailSend) {
      var _gmailCreds = typeof getMailAccountCredentials === 'function' ? getMailAccountCredentials(emailFrom) : null;
      var _gmailToken = _gmailCreds ? _gmailCreds.token : (getMailConfig().gmailToken || '');
      var _gmailExpiresAt = _gmailCreds ? (_gmailCreds.expiresAt || 0) : (getMailConfig().gmailExpiresAt || 0);
      // v23.10: Get display name for From header
      var _gmailDisplayName = '';
      var _gmailAccts = getMailGmailAccounts();
      for (var _ga = 0; _ga < _gmailAccts.length; _ga++) {
        if (_gmailAccts[_ga].email === emailFrom && _gmailAccts[_ga].displayName) { _gmailDisplayName = _gmailAccts[_ga].displayName; break; }
      }
      // v23.10: Proactive token refresh if expired or about to expire (within 5 min)
      var _gmailSendFn = function(token) {
        return fetch('/api/gmail-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send',
            accessToken: token,
            to: emailTo,
            subject: emailSubject,
            html: htmlBody,
            from: emailFrom,
            fromName: _gmailDisplayName,
            cc: emailCc,
            bcc: emailBcc,
            uid: uid
          })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.error) throw new Error('Gmail send failed: ' + data.error);
          if (typeof addToMailSent === 'function') {
            addToMailSent({ to: emailTo, from: emailFrom, subject: emailSubject, html: htmlBody, body: emailBody, emailId: data.messageId || '', sentVia: 'gmail' });
          }
          showToast('Step ' + step.stepId + ' email sent via Gmail to ' + emailTo, 'success');
          return 'Email sent via Gmail to ' + emailTo + '\nSubject: ' + emailSubject + '\n\n' + emailBody.substring(0, 2000);
        });
      };
      if (_gmailExpiresAt && Date.now() > (_gmailExpiresAt - 300000)) {
        return new Promise(function(resolve, reject) {
          mailRefreshGmailToken(function(newToken) {
            if (newToken) {
              _gmailSendFn(newToken).then(resolve).catch(reject);
            } else {
              reject(new Error('Gmail token expired for ' + emailFrom + '. Please reconnect in Mail settings.'));
            }
          }, emailFrom);
        });
      }
      return _gmailSendFn(_gmailToken);
    }
    // v23.10: Route through Outlook API for connected Outlook accounts
    if (_useOutlookSend) {
      var _outlookCreds = typeof getMailAccountCredentials === 'function' ? getMailAccountCredentials(emailFrom) : null;
      var _outlookToken = _outlookCreds ? _outlookCreds.token : (getMailConfig().outlookToken || '');
      var _outlookExpiresAt = _outlookCreds ? (_outlookCreds.expiresAt || 0) : 0;
      var _outlookPayload = {
        message: {
          subject: emailSubject,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: [{ emailAddress: { address: emailTo } }]
        },
        saveToSentItems: true
      };
      if (emailCc.length > 0) {
        _outlookPayload.message.ccRecipients = emailCc.map(function(e) { return { emailAddress: { address: e } }; });
      }
      if (emailBcc.length > 0) {
        _outlookPayload.message.bccRecipients = emailBcc.map(function(e) { return { emailAddress: { address: e } }; });
      }
      // v23.10: Proactive Outlook token refresh if expired or about to expire (within 5 min)
      var _outlookSendFn = function(token) {
        return fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(_outlookPayload)
        }).then(function(r) {
          if (!r.ok) throw new Error('Outlook send failed (HTTP ' + r.status + ')');
          if (typeof addToMailSent === 'function') {
            addToMailSent({ to: emailTo, from: emailFrom, subject: emailSubject, html: htmlBody, body: emailBody, sentVia: 'outlook' });
          }
          showToast('Step ' + step.stepId + ' email sent via Outlook to ' + emailTo, 'success');
          return 'Email sent via Outlook to ' + emailTo + '\nSubject: ' + emailSubject + '\n\n' + emailBody.substring(0, 2000);
        });
      };
      if (_outlookExpiresAt && Date.now() > (_outlookExpiresAt - 300000)) {
        var _olAcct = { email: emailFrom, token: _outlookToken, refreshToken: _outlookCreds ? _outlookCreds.refreshToken : '' };
        return new Promise(function(resolve, reject) {
          mailRefreshOutlookTokenForAccount(_olAcct, function(newToken) {
            if (newToken) _outlookSendFn(newToken).then(resolve).catch(reject);
            else reject(new Error('Outlook token expired for ' + emailFrom + '. Please reconnect in Mail settings.'));
          });
        });
      }
      return _outlookSendFn(_outlookToken);
    }
    // Fallback: send via Resend
    return fetch('/api/resend-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailTo,
        subject: emailSubject,
        from: emailFrom,
        html: htmlBody,
        cc: emailCc,
        bcc: emailBcc,
        uid: uid
      })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.error) {
        throw new Error('Email failed: ' + data.error);
      }
      if (typeof addToMailSent === 'function') {
        addToMailSent({ to: emailTo, from: emailFrom, subject: emailSubject, html: htmlBody, body: emailBody, emailId: data.emailId });
      }
      showToast('Step ' + step.stepId + ' email sent to ' + emailTo, 'success');
      return 'Email sent to ' + emailTo + '\nSubject: ' + emailSubject + '\n\n' + emailBody.substring(0, 2000);
    });
  }

  // v22.24: Queue to Outbox step — auto-extracts email from previous step output
  if (action === 'outbox') {
    var outboxTo = resolveTemplateVars(target.emailTo || '', context);
    var outboxSubject = resolveTemplateVars(target.emailSubject || '', context);
    var outboxBody = '';
    // v29.x: Use contentRef to get the specific step's output (not just the last one)
    if (target.contentRef && context) {
      outboxBody = resolveTemplateVars(target.contentRef, context);
    }
    // Fallback: gather previous step output as email body (last non-meta string in context)
    if (!outboxBody && context) {
      // v29.x: If step has an outputKey reference from the immediately previous step, use that
      var _prevStepKey = 'step' + (step.stepId - 1) + '_content';
      if (context[_prevStepKey] && typeof context[_prevStepKey] === 'string') {
        outboxBody = context[_prevStepKey];
      } else {
        var _obKeys = Object.keys(context);
        for (var _obk = _obKeys.length - 1; _obk >= 0; _obk--) {
          var _obv = context[_obKeys[_obk]];
          if (typeof _obv === 'string' && _obv.length > 0 && _obKeys[_obk] !== 'brandName' && _obKeys[_obk].indexOf('_brandIdx') === -1) {
            outboxBody = _obv;
            break;
          }
        }
      }
    }
    // Auto-extract email addresses from the referenced step output first, then all outputs
    if (!outboxTo && context) {
      var _emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
      // v29.x: Check the specific body content first for email extraction
      var _sourceTexts = [];
      if (outboxBody) _sourceTexts.push(outboxBody);
      var _ctxKeys = Object.keys(context);
      for (var _ei = 0; _ei < _ctxKeys.length; _ei++) {
        var _ctxVal = context[_ctxKeys[_ei]];
        if (typeof _ctxVal === 'string' && _ctxKeys[_ei] !== 'brandName') {
          _sourceTexts.push(_ctxVal);
        }
      }
      for (var _si = 0; _si < _sourceTexts.length; _si++) {
        var _foundEmails = _sourceTexts[_si].match(_emailRegex);
        if (_foundEmails && _foundEmails.length > 0) {
          var _filtered = _foundEmails.filter(function(em) {
            var lower = em.toLowerCase();
            return lower.indexOf('noreply') === -1 && lower.indexOf('no-reply') === -1 && lower.indexOf('example.com') === -1 && lower.indexOf('test@') === -1;
          });
          if (_filtered.length > 0) {
            outboxTo = _filtered[0];
            break;
          }
        }
      }
    }
    // Fallback subject
    if (!outboxSubject) {
      if (outboxSubject !== '' || !target.emailSubject) {
        outboxSubject = (context && context.brandName ? context.brandName : 'RoweOS') + ' - Pipeline Output';
      }
    }
    // Render markdown to HTML
    var _obRendered = outboxBody;
    try {
      if (typeof marked !== 'undefined' && marked.parse) {
        _obRendered = marked.parse(outboxBody);
        _obRendered = _obRendered
          .replace(/<table>/g, '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:16px 0;">')
          .replace(/<th>/g, '<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #d1d1d1;font-size:11px;font-weight:600;background:#f5f5f5;">')
          .replace(/<td>/g, '<td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:12px;vertical-align:top;">')
          .replace(/<h1>/g, '<h1 style="font-size:20px;font-weight:600;margin:24px 0 8px;">')
          .replace(/<h2>/g, '<h2 style="font-size:17px;font-weight:600;margin:20px 0 6px;">')
          .replace(/<h3>/g, '<h3 style="font-size:15px;font-weight:600;margin:16px 0 4px;">')
          .replace(/<p>/g, '<p style="margin:0 0 12px;line-height:1.6;font-size:14px;">')
          .replace(/<ul>/g, '<ul style="margin:0 0 12px;padding-left:20px;">')
          .replace(/<ol>/g, '<ol style="margin:0 0 12px;padding-left:20px;">')
          .replace(/<li>/g, '<li style="margin:0 0 4px;line-height:1.5;">');
      } else {
        _obRendered = escapeHtml(outboxBody).replace(/\n/g, '<br>');
      }
    } catch(e) {
      _obRendered = escapeHtml(outboxBody).replace(/\n/g, '<br>');
    }
    // Build branded HTML email
    var outboxTemplate = (step.config && step.config.emailTemplate) ? step.config.emailTemplate : 'professional';
    var outboxHtml = '';
    if (outboxTemplate === 'plain') {
      outboxHtml = '<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">' + _obRendered + '</div>';
    } else {
      var _obBrand = (context && context.brandName) ? context.brandName : 'Brand';
      var _obAccent = '#a89878';
      try { _obAccent = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#a89878'; } catch(e) {}
      var _obLogo = '';
      var _obBrandIdx = (context && context._brandIdx !== undefined) ? context._brandIdx : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
      try { _obLogo = localStorage.getItem('roweos_brand_' + _obBrandIdx + '_logo') || ''; } catch(e) {}
      if (!_obLogo) { try { var _obLogoEl = document.querySelector('.brand-logo-img'); if (_obLogoEl) _obLogo = _obLogoEl.src; } catch(e) {} }
      window._studioEmailContext = {
        contentHtml: '<div style="font-size:15px;line-height:1.7;">' + _obRendered + '</div>',
        brandName: _obBrand,
        accentColor: _obAccent,
        brandLogo: _obLogo,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      };
      outboxHtml = generateBrandedEmail(outboxTemplate);
    }
    // v22.32: Use mail config default if no step-level from is set
    var _obMailCfg2 = {};
    try { _obMailCfg2 = JSON.parse(localStorage.getItem('roweos_mail_config') || '{}'); } catch(e) {}
    var outboxFrom = (step.config && step.config.emailFrom) ? step.config.emailFrom : (_obMailCfg2.defaultFromAddress || getDefaultFromAddress());
    // v23.1: Strip gmail:/outlook: prefix from From address
    if (outboxFrom.indexOf('gmail:') === 0) outboxFrom = outboxFrom.substring(6);
    if (outboxFrom.indexOf('outlook:') === 0) outboxFrom = outboxFrom.substring(8);
    var outboxBcc = [];
    if (step.config && step.config.bccSelf && outboxFrom) {
      outboxBcc.push(outboxFrom);
    }
    var pipelineName = '';
    try { pipelineName = _pipelineName || ''; } catch(e) {}
    if (typeof addToMailOutbox === 'function') {
      addToMailOutbox({
        to: outboxTo || '',
        from: outboxFrom,
        subject: outboxSubject,
        body: outboxBody,
        canvasHtml: _obRendered,
        html: outboxHtml,
        bcc: outboxBcc,
        template: outboxTemplate,
        pipelineName: pipelineName,
        autoExtracted: !target.emailTo && !!outboxTo,
        folder: (step.config && step.config.outboxFolder) || ''
      });
    }
    // v24.25: Auto-send when running from scheduler or when autoSend config is set
    var _shouldAutoSend = (step.config && step.config.autoSend) || window._runningFromScheduler;
    if (_shouldAutoSend && outboxTo && outboxFrom) {
      // Send immediately via Resend/Gmail/Outlook instead of just queuing
      var uid = '';
      try { uid = firebaseUser ? firebaseUser.uid : ''; } catch(e) {}
      var _autoSendResult = null;
      // Check Gmail
      var _obMailCfgSend = {};
      try { _obMailCfgSend = JSON.parse(localStorage.getItem('roweos_mail_config') || '{}'); } catch(e) {}
      if (_obMailCfgSend.gmailConnected && outboxFrom.indexOf('gmail') !== -1) {
        _autoSendResult = (typeof sendViaGmail === 'function') ? sendViaGmail(outboxTo, outboxSubject, outboxHtml, outboxFrom) : null;
      }
      if (!_autoSendResult) {
        // Fallback: send via Resend API
        _autoSendResult = fetch('/api/resend-welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: outboxTo, subject: outboxSubject, from: outboxFrom, html: outboxHtml, bcc: outboxBcc.length ? outboxBcc.join(',') : undefined, uid: uid })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.error) throw new Error('Email send failed: ' + data.error);
          if (typeof addToMailSent === 'function') addToMailSent({ to: outboxTo, from: outboxFrom, subject: outboxSubject, html: outboxHtml, body: outboxBody });
          return 'Email sent to ' + outboxTo + '\nSubject: ' + outboxSubject;
        });
      }
      if (_autoSendResult && typeof _autoSendResult.then === 'function') {
        return _autoSendResult.then(function(msg) {
          showToast('Email sent to ' + outboxTo, 'success');
          return msg || 'Email sent to ' + outboxTo;
        }).catch(function(err) {
          console.warn('[Pipeline] Auto-send failed, email remains in outbox:', err);
          showToast('Email queued to outbox (auto-send failed)', 'warning');
          return 'Email queued to outbox (auto-send failed: ' + err.message + ')';
        });
      }
    }

    var _obMsg = 'Email queued to outbox';
    if (outboxTo) {
      _obMsg += '\nTo: ' + outboxTo + ((!target.emailTo) ? ' (auto-detected)' : '');
    } else {
      _obMsg += '\nTo: (needs manual entry in outbox)';
    }
    _obMsg += '\nSubject: ' + outboxSubject;
    showToast(outboxTo ? 'Email queued to outbox for ' + outboxTo : 'Email queued to outbox (add recipient in Mail)', 'success');
    return Promise.resolve(_obMsg);
  }

  // v22.28: Batch Email step — parses previous step output into multiple outbox emails
  if (action === 'batch_email') {
    var batchBody = '';
    // Gather previous step output
    if (context) {
      var _beKeys = Object.keys(context);
      for (var _bek = _beKeys.length - 1; _bek >= 0; _bek--) {
        var _bev = context[_beKeys[_bek]];
        if (typeof _bev === 'string' && _bev.length > 0 && _beKeys[_bek] !== 'brandName' && _beKeys[_bek].indexOf('_brandIdx') === -1) {
          batchBody = _bev;
          break;
        }
      }
    }
    if (!batchBody) {
      return Promise.reject(new Error('Batch Email failed: No content from previous step'));
    }
    // Parse ---EMAIL--- blocks
    var emailBlocks = batchBody.split('---EMAIL---').filter(function(b) { return b.trim().length > 0; });
    if (emailBlocks.length === 0) {
      // Fallback: try splitting by double newline patterns with TO: headers
      emailBlocks = batchBody.split(/\n(?=TO:)/i).filter(function(b) { return b.trim().length > 0; });
    }
    // v22.32: Use mail config default if no step-level from is set
    var _beMcfg = {};
    try { _beMcfg = JSON.parse(localStorage.getItem('roweos_mail_config') || '{}'); } catch(e) {}
    var batchFrom = (step.config && step.config.emailFrom) ? step.config.emailFrom : (_beMcfg.defaultFromAddress || getDefaultFromAddress());
    var batchTemplate = (step.config && step.config.emailTemplate) ? step.config.emailTemplate : 'professional';
    var pipelineName = '';
    try { pipelineName = _pipelineName || ''; } catch(e) {}
    var queuedCount = 0;
    var _beBrandName = (context && context.brandName) ? context.brandName : 'Brand';
    var _beAccent = '#a89878';
    try { _beAccent = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#a89878'; } catch(e) {}
    // v28.4: Prefer base64 over Firebase Storage URL (Storage URLs expire after ~1hr)
    var _beLogo = '';
    if (window._mailLogoBase64) {
      _beLogo = window._mailLogoBase64;
    } else {
      try {
        var _beLogoEl = document.querySelector('.brand-logo-img');
        if (_beLogoEl) _beLogo = _beLogoEl.src;
        // Resize logo for email use (fire-and-forget)
        if (_beLogo && _beLogo.indexOf('data:') === 0 && typeof mailEnsureLogoUrl === 'function') {
          mailEnsureLogoUrl(_beLogo);
        }
      } catch(e) {}
    }
    // v22.31: Resolve PDF attachment before email loop
    var _beAttachments = [];
    var _beAttachKey = (step.config && step.config.attachPdfFromStep) ? step.config.attachPdfFromStep : '';
    if (_beAttachKey && context[_beAttachKey]) {
      try {
        var _pdfData = JSON.parse(context[_beAttachKey]);
        if (_pdfData && _pdfData.base64) {
          _beAttachments.push({
            filename: _pdfData.filename || 'RoweOS-Pitch.pdf',
            content: _pdfData.base64,
            type: 'application/pdf'
          });
        }
      } catch(e) {}
    }
    emailBlocks.forEach(function(block) {
      var cleaned = block.replace(/---END---/g, '').trim();
      if (!cleaned) return;
      // Extract TO, SUBJECT, BODY
      var toMatch = cleaned.match(/^TO:\s*(.+)$/mi);
      var subMatch = cleaned.match(/^SUBJECT:\s*(.+)$/mi);
      // v22.29: Greedy capture — grab everything from BODY: to end of block
      var bodyMatch = cleaned.match(/^BODY:\s*([\s\S]+)/mi);
      var emailTo = toMatch ? toMatch[1].trim() : '';
      var emailSubject = subMatch ? subMatch[1].trim() : _beBrandName + ' - Outreach';
      var emailBodyRaw = bodyMatch ? bodyMatch[1].trim() : cleaned;
      // If no BODY: marker, take everything after SUBJECT line
      if (!bodyMatch && subMatch) {
        var subIdx = cleaned.indexOf(subMatch[0]);
        emailBodyRaw = cleaned.substring(subIdx + subMatch[0].length).trim();
      }
      // v25.3: Render markdown to HTML with full fallback chain (same as single email step)
      var _beRendered = emailBodyRaw;
      try {
        if (typeof marked !== 'undefined' && marked.parse) {
          _beRendered = marked.parse(emailBodyRaw);
          _beRendered = _beRendered
            .replace(/<table>/g, '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:16px 0;table-layout:fixed;">')
            .replace(/<th>/g, '<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #d1d1d1;font-size:11px;font-weight:600;background:#f5f5f5;word-wrap:break-word;">')
            .replace(/<th /g, '<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #d1d1d1;font-size:11px;font-weight:600;background:#f5f5f5;word-wrap:break-word;" ')
            .replace(/<td>/g, '<td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:12px;vertical-align:top;word-wrap:break-word;">')
            .replace(/<td /g, '<td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:12px;vertical-align:top;word-wrap:break-word;" ')
            .replace(/<h1>/g, '<h1 style="font-size:20px;font-weight:600;margin:24px 0 8px;line-height:1.3;">')
            .replace(/<h2>/g, '<h2 style="font-size:17px;font-weight:600;margin:20px 0 6px;line-height:1.3;">')
            .replace(/<h3>/g, '<h3 style="font-size:15px;font-weight:600;margin:16px 0 4px;line-height:1.3;">')
            .replace(/<p>/g, '<p style="margin:0 0 12px;line-height:1.6;font-size:14px;">')
            .replace(/<ul>/g, '<ul style="margin:0 0 12px;padding-left:20px;font-size:14px;">')
            .replace(/<ol>/g, '<ol style="margin:0 0 12px;padding-left:20px;font-size:14px;">')
            .replace(/<li>/g, '<li style="margin:0 0 4px;line-height:1.5;">')
            .replace(/<hr>/g, '<hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">')
            .replace(/<blockquote>/g, '<blockquote style="margin:12px 0;padding:8px 16px;border-left:3px solid #d1d1d1;color:#666;font-size:13px;">');
        } else if (typeof markdownToHtml === 'function') {
          _beRendered = markdownToHtml(emailBodyRaw);
        } else {
          _beRendered = escapeHtml(emailBodyRaw).replace(/\n/g, '<br>');
        }
      } catch(e) {
        try { _beRendered = typeof markdownToHtml === 'function' ? markdownToHtml(emailBodyRaw) : escapeHtml(emailBodyRaw).replace(/\n/g, '<br>'); } catch(e2) { _beRendered = escapeHtml(emailBodyRaw).replace(/\n/g, '<br>'); }
      }
      // Build branded HTML
      var beHtml = '';
      if (batchTemplate === 'plain') {
        beHtml = '<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">' + _beRendered + '</div>';
      } else {
        window._studioEmailContext = {
          contentHtml: '<div style="font-size:15px;line-height:1.7;">' + _beRendered + '</div>',
          brandName: _beBrandName,
          accentColor: _beAccent,
          brandLogo: _beLogo,
          date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        };
        beHtml = generateBrandedEmail(batchTemplate);
      }
      if (typeof addToMailOutbox === 'function') {
        addToMailOutbox({
          to: emailTo,
          from: batchFrom,
          subject: emailSubject,
          body: emailBodyRaw,
          canvasHtml: _beRendered,
          html: beHtml,
          template: batchTemplate,
          pipelineName: pipelineName,
          batchGenerated: true,
          attachments: _beAttachments,
          folder: (step.config && step.config.outboxFolder) || ''
        });
        queuedCount++;
      }
    });
    var _attachNote = (_beAttachments.length > 0) ? ' (with PDF attachment)' : '';
    showToast(queuedCount + ' email' + (queuedCount !== 1 ? 's' : '') + ' queued to outbox' + _attachNote, 'success');
    return Promise.resolve('Batch email complete: ' + queuedCount + ' emails queued to outbox for review');
  }

  // v22.8: Deep Research step
  if (action === 'research') {
    // v29.0: Fall back to contextRef/text if researchQuery not set (AI may use any field)
    var researchQuery = resolveTemplateVars(target.researchQuery || target.contextRef || target.text || '', context);
    if (!researchQuery) {
      return Promise.reject(new Error('Research step failed: No query'));
    }
    showToast('Starting Deep Research (step ' + step.stepId + ')... This may take 1-5 minutes.', 'info');
    // Enrich with brand context (same pattern as handleDeepResearchChat)
    var enrichedQuery = researchQuery;
    if (step.config && step.config.includeBrandContext !== false) {
      try {
        var _ctxParts = [];
        var _rBrandIdx = (context && context._brandIdx !== undefined) ? context._brandIdx : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
        if (typeof brands !== 'undefined' && brands[_rBrandIdx]) {
          var _rb = brands[_rBrandIdx];
          var _rbName = _rb.shortName || _rb.name;
          _ctxParts.push('Business context: ' + _rbName + (_rb.tagline ? ' - ' + _rb.tagline : '') + (_rb.industry ? ' (Industry: ' + _rb.industry + ')' : ''));
          if (_rb.location) _ctxParts.push('Location: ' + _rb.location);
        }
        if (_ctxParts.length > 0) {
          enrichedQuery = _ctxParts.join('. ') + '.\n\nResearch request: ' + researchQuery;
        }
      } catch(ce) {}
    }
    // v25.0: Prepend contextRef as primary research instructions (merged into query)
    if (target.contextRef) {
      var resolvedCtx = resolveTemplateVars(target.contextRef, context);
      if (resolvedCtx) {
        enrichedQuery = resolvedCtx + (enrichedQuery ? '\n\n' + enrichedQuery : '');
      }
    }
    // v22.10: Use runDeepResearchFull with auto-retry on cancellation
    return runDeepResearchFull(enrichedQuery, function(status, elapsed) {
      // Progress — update timer badge on automation card if visible
    }, 3).then(function(result) {
      showToast('Step ' + step.stepId + ' research complete (' + result.elapsed + 's)', 'success');
      return result.text;
    });
  }

  // v24.9: Pulse step — AI generates tasks for a goal
  if (action === 'pulse') {
    var _wfGoalId = target.goalId || '';
    if (!_wfGoalId || typeof pulseGoals === 'undefined') return Promise.resolve('No goal selected');
    var _wfGoal = pulseGoals.find(function(g) { return String(g.id) === String(_wfGoalId); });
    if (!_wfGoal) return Promise.resolve('Goal not found');
    var _wfInstr = target.contextRef || target.text || '';
    // Resolve template vars from previous steps
    if (_wfInstr && context) _wfInstr = resolveTemplateVars(_wfInstr, context);
    if (!_wfInstr) return Promise.resolve('Goal "' + _wfGoal.title + '" marked as updated');
    var _wfExisting = (_wfGoal.items || []).map(function(i) { return i.text; }).join(', ');
    var _wfIsLife = _wfGoal.source === 'lifeai';
    var _wfCtx = _wfIsLife ? (typeof getLifeIdentityContextForGoals === 'function' ? getLifeIdentityContextForGoals() : '') : (typeof getBrandContextForGoals === 'function' ? getBrandContextForGoals() : '');
    var _wfSys = 'You are a goal planning assistant. Given a goal and specific instructions, generate actionable tasks. Return ONLY a JSON array of strings, no other text. Each task should be concise and actionable. Never use em-dashes.';
    var _wfUser = 'Goal: "' + _wfGoal.title + '"';
    if (_wfExisting) _wfUser += '\nExisting tasks: ' + _wfExisting;
    _wfUser += '\nInstructions: ' + _wfInstr;
    if (_wfCtx) _wfUser += _wfCtx;
    _wfUser += '\n\nReturn a JSON array of 3-8 recommended task strings based on the instructions.';
    return new Promise(function(resolve) {
      callLifeAIForGoal(_wfSys, _wfUser, function(responseText) {
        var tasks = [];
        try { tasks = JSON.parse(responseText); } catch(e) {
          var jsonMatch = responseText.match(/\[[\s\S]*?\]/);
          if (jsonMatch) { try { tasks = JSON.parse(jsonMatch[0]); } catch(e2) {} }
        }
        if (Array.isArray(tasks) && tasks.length > 0) {
          if (!_wfGoal.items) _wfGoal.items = [];
          var _wfCount = 0;
          tasks.forEach(function(taskText, tIdx) {
            if (typeof taskText === 'string' && taskText.trim()) {
              _wfGoal.items.push({ id: 'item_' + Date.now() + '_' + tIdx, text: taskText.trim(), completed: false, completedAt: null });
              _wfCount++;
            }
          });
          _wfGoal.lastUpdated = new Date().toISOString();
          savePulseGoals();
          if (typeof renderPulse3Overview === 'function') renderPulse3Overview();
          if (typeof renderPulse3Checklists === 'function') renderPulse3Checklists();
          resolve('Added ' + _wfCount + ' tasks to "' + _wfGoal.title + '"');
        } else {
          resolve('Could not parse AI suggestions for "' + _wfGoal.title + '"');
        }
      }, function(err) {
        resolve('AI task generation failed: ' + (err || 'Unknown'));
      });
    });
  }

  // v24.25: Reminder step — interactive popup
  if (action === 'reminder') {
    var remTitle = resolveTemplateVars(target.reminderTitle || 'Reminder', context);
    var remText = resolveTemplateVars(target.text || '', context);
    var remConfig = step.config || {};
    showNotificationPopup({
      title: remTitle,
      message: remText,
      actionLabel: remConfig.actionLabel || '',
      actionView: remConfig.actionView || '',
      source: 'pipeline'
    });
    saveReminderToHistory({ title: remTitle, message: remText, source: 'pipeline', timestamp: new Date().toISOString() });
    return Promise.resolve(remTitle + ': ' + remText);
  }

  // v17.4: Notify step
  if (action === 'notify') {
    var notifyText = resolveTemplateVars(target.text || '', context);
    showToast(notifyText || ('Pipeline step ' + step.stepId + ' complete'), 'info');
    return Promise.resolve(notifyText);
  }

  // For other actions, delegate to existing task execution
  return Promise.resolve('');
}

// --- Social Init ---
function initSocialMedia() {
  // v18.0: One-time migration of global social keys to per-brand scoped keys
  migrateSocialConnectionsToPerBrand();
  refreshSocialAccountCards();
  loadSocialOwnKeys();
  // v17.0: Check for pending tokens from social-callback.html and store in Firestore
  processPendingSocialTokens();
  renderSocialPostHistory();
}

// v17.0: social-callback.html stores tokens in localStorage as pending — pick them up and save to Firestore
// v18.0: Scan all brand/life scopes for pending tokens
function processPendingSocialTokens() {
  var platforms = ['x', 'threads', 'instagram'];
  // Build list of all possible scopes
  var scopes = [];
  var brandCount = typeof brands !== 'undefined' ? brands.length : 5;
  for (var bi = 0; bi < brandCount; bi++) scopes.push('_brand_' + bi);
  var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
  for (var li = 0; li < profiles.length; li++) scopes.push('_life_' + li);
  // Also check unsuffixed keys (legacy)
  scopes.push('');

  platforms.forEach(function(platform) {
    scopes.forEach(function(scope) {
      try {
        var pending = localStorage.getItem('roweos_social_pending_token_' + platform + scope);
        if (!pending) return;
        var tokenData = JSON.parse(pending);
        localStorage.removeItem('roweos_social_pending_token_' + platform + scope);
        // Store in Firestore with scope
        storeSocialToken(platform, tokenData, scope);
      } catch(e) {}
    });
  });
  refreshSocialAccountCards();
}

/**
 * v13.9: Show built-in agent expanded view with Studio operations
 */
function showAutoLabBuiltInAgent(agentId) {
  var el = document.getElementById('autoLabAgents');
  if (!el) return;

  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var allOps = [];

  // v13.9: Map agent IDs to operation categories (they don't always match)
  var categoryMap = { strategy: 'strategic', coach: 'planning', taxintelligence: 'taxes', personal: 'development' };
  var filterCat = categoryMap[agentId] || agentId;

  // Gather operations for this agent category
  if (mode === 'brand') {
    var brandOps = typeof ops !== 'undefined' ? ops : [];
    var genBrandOps = typeof generatedBrandOps !== 'undefined' ? generatedBrandOps : [];
    allOps = brandOps.concat(genBrandOps).filter(function(o) {
      if (agentId === 'social') return o.isSocialOp;
      return o.category === filterCat || o.category === agentId;
    });
  } else {
    var lifeOpsArr = typeof window.lifeOps !== 'undefined' ? window.lifeOps : [];
    var genLifeOps = typeof generatedLifeOps !== 'undefined' ? generatedLifeOps : [];
    allOps = lifeOpsArr.concat(genLifeOps).filter(function(o) { return o.category === filterCat || o.category === agentId; });
  }

  var agentColor = (AGENT_COLORS[agentId]) || '#a89878'; // v16.0: use global constant

  var html = '<div id="autoLabBuiltInPanel" style="margin-bottom:20px;">';
  html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">';
  html += '<button class="auto-lab-card-btn" onclick="document.getElementById(\'autoLabBuiltInPanel\').remove();renderAutoLabAgents();">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back</button>';
  var agentDisplayName = agentId === 'social' ? 'Social Media' : agentId.charAt(0).toUpperCase() + agentId.slice(1);
  html += '<div style="font-size:16px;font-weight:600;color:' + agentColor + ';">' + escapeHtml(agentDisplayName) + ' Operations</div>';
  html += '<span style="font-size:12px;color:var(--text-muted);">' + allOps.length + ' operations</span>';
  html += '</div>';

  if (allOps.length === 0) {
    html += '<div class="auto-lab-empty">No operations found for this agent.</div>';
  } else {
    html += '<div class="auto-lab-grid">';
    allOps.forEach(function(op) {
      html += '<div class="auto-lab-card">';
      html += '<div class="auto-lab-card-header">';
      html += '<div class="auto-lab-card-icon" style="background:' + agentColor + '20;color:' + agentColor + ';"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg></div>';
      html += '<div class="auto-lab-card-title">' + escapeHtml(op.name || '') + '</div>';
      html += '</div>';
      html += '<div class="auto-lab-card-meta">' + escapeHtml(op.desc || '') + '</div>';
      html += '<div class="auto-lab-card-actions">';
      html += '<button class="auto-lab-card-btn primary" onclick="runAutoLabBuiltInOp(' + op.id + ')">Run Now</button>';
      html += '<button class="auto-lab-card-btn" onclick="scheduleAutoLabOperation(' + op.id + ',\'' + agentId + '\')">Schedule</button>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  // Create Custom Operation button
  html += '<div style="margin-top:16px;text-align:center;">';
  html += '<button class="auto-lab-card-btn primary" onclick="createAutoLabCustomOp(\'' + agentId + '\')">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create Custom Operation</button>';
  html += '</div>';
  html += '</div>';

  el.innerHTML = html;
}

/**
 * v13.9: Run a built-in operation from Agents Lab
 */
function runAutoLabBuiltInOp(opId) {
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var allOps = [];
  if (mode === 'brand') {
    allOps = (typeof operations !== 'undefined' ? operations : []).concat(typeof generatedBrandOps !== 'undefined' ? generatedBrandOps : []);
  } else {
    allOps = (typeof window.lifeOps !== 'undefined' ? window.lifeOps : []).concat(typeof generatedLifeOps !== 'undefined' ? generatedLifeOps : []);
  }
  var op = allOps.find(function(o) { return o.id === opId; });
  if (!op) { showToast('Operation not found', 'error'); return; }

  // v14.2: Use 'run_operation' action with operationId so buildTaskPrompt() can resolve the op
  var task = { name: op.name, action: 'run_operation', operationId: opId, description: op.desc || '' };
  showToast('Running "' + op.name + '"...', 'info');
  if (typeof executeScheduledTask === 'function') {
    executeScheduledTask(task, -1);
  }
}

/**
 * v13.9: Pre-fill workflow form from an operation
 */
function scheduleAutoLabOperation(opId, agentId) {
  showAutoLabTab('workflows');
  setTimeout(function() {
    showAutoLabWorkflowForm();
    setTimeout(function() {
      var nameEl = document.getElementById('autoLabWfName');
      var allOps = [];
      var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
      if (mode === 'brand') {
        allOps = (typeof operations !== 'undefined' ? operations : []).concat(typeof generatedBrandOps !== 'undefined' ? generatedBrandOps : []);
      } else {
        allOps = (typeof window.lifeOps !== 'undefined' ? window.lifeOps : []).concat(typeof generatedLifeOps !== 'undefined' ? generatedLifeOps : []);
      }
      var op = allOps.find(function(o) { return o.id === opId; });
      if (nameEl && op) nameEl.value = op.name;
      var actionEl = document.getElementById('autoLabWfAction');
      if (actionEl) {
        actionEl.value = 'studio';
        renderAutoLabTargetConfig('studio');
        setTimeout(function() {
          var agentEl = document.getElementById('autoLabWfTargetAgent');
          if (agentEl) agentEl.value = agentId;
          updateAutoLabWfOperations(agentId);
          setTimeout(function() {
            var opEl = document.getElementById('autoLabWfTargetOp');
            if (opEl) opEl.value = String(opId);
          }, 50);
        }, 50);
      }
    }, 100);
  }, 50);
}

/**
 * v13.9: Create custom operation inline in Agents Lab
 */
function createAutoLabCustomOp(agentId) {
  var el = document.getElementById('autoLabAgents');
  if (!el) return;

  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var html = '<div id="autoLabCustomOpForm" class="auto-lab-form" style="margin-bottom:20px;">';
  html += '<div class="auto-lab-form-title">Create Custom Operation for ' + escapeHtml(agentId) + '</div>';
  html += '<input type="hidden" id="autoLabCustomOpAgent" value="' + escapeHtml(agentId) + '">';
  html += '<div class="auto-lab-form-row"><div class="auto-lab-form-field"><label>Operation Name</label>';
  html += '<input type="text" id="autoLabCustomOpName" placeholder="e.g. Quarterly Report Generator"></div></div>';
  html += '<div class="auto-lab-form-row"><div class="auto-lab-form-field"><label>Description</label>';
  html += '<input type="text" id="autoLabCustomOpDesc" placeholder="What this operation does"></div></div>';
  html += '<div class="auto-lab-form-row"><div class="auto-lab-form-field"><label>Outputs (comma-separated)</label>';
  html += '<input type="text" id="autoLabCustomOpOutputs" placeholder="e.g. Report draft, Key insights, Action items"></div></div>';
  html += '<div class="auto-lab-form-row"><div class="auto-lab-form-field"><label>Prompt Template</label>';
  html += '<textarea id="autoLabCustomOpPrompt" rows="4" placeholder="Write the prompt template. Use {context} for user input."></textarea></div></div>';
  html += '<div class="auto-lab-form-actions">';
  html += '<button class="auto-lab-card-btn" onclick="document.getElementById(\'autoLabCustomOpForm\').remove();">Cancel</button>';
  html += '<button class="auto-lab-card-btn primary" onclick="saveAutoLabCustomOp()">Save Operation</button>';
  html += '</div></div>';
  el.insertAdjacentHTML('afterbegin', html);
  var form = document.getElementById('autoLabCustomOpForm');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * v13.9: Save custom operation created in Agents Lab
 */
function saveAutoLabCustomOp() {
  var name = document.getElementById('autoLabCustomOpName');
  var desc = document.getElementById('autoLabCustomOpDesc');
  var outputs = document.getElementById('autoLabCustomOpOutputs');
  var promptTpl = document.getElementById('autoLabCustomOpPrompt');
  var agentEl = document.getElementById('autoLabCustomOpAgent');

  if (!name || !name.value.trim()) { showToast('Please enter an operation name', 'warning'); return; }

  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var agentId = agentEl ? agentEl.value : '';
  var categoryMap = { strategy: 'strategic', coach: 'planning', taxintelligence: 'taxes', personal: 'development' };
  var category = categoryMap[agentId] || agentId;

  var op = {
    id: Date.now(),
    name: name.value.trim(),
    desc: desc ? desc.value.trim() : '',
    category: category,
    outputs: outputs && outputs.value.trim() ? outputs.value.split(',').map(function(s) { return s.trim(); }) : [],
    promptTemplate: promptTpl ? promptTpl.value.trim() : '',
    custom: true,
    isSocialOp: category === 'social'
  };

  // v18.5: Tag with brand name so Studio can filter correctly
  if (mode === 'brand' && typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand]) {
    op.generatedForBrand = brands[selectedBrand].name;
  }

  if (mode === 'brand') {
    if (typeof generatedBrandOps === 'undefined') window.generatedBrandOps = [];
    generatedBrandOps.push(op);
    try { localStorage.setItem('roweos_generated_brand_ops', JSON.stringify(generatedBrandOps)); } catch(e) {}
  } else {
    if (typeof generatedLifeOps === 'undefined') window.generatedLifeOps = [];
    generatedLifeOps.push(op);
    try { localStorage.setItem('roweos_generated_life_ops', JSON.stringify(generatedLifeOps)); } catch(e) {}
  }

  var form = document.getElementById('autoLabCustomOpForm');
  if (form) form.remove();
  showToast('Custom operation "' + op.name + '" created!', 'success');
  // v18.5: Refresh operations list so new op appears in Studio
  if (typeof renderOperations === 'function') renderOperations();
  // Refresh the built-in agent view to show new op
  if (agentId) showAutoLabBuiltInAgent(agentId);
}

// v18.5: Migrate existing custom ops to add generatedForBrand
function migrateCustomOpsGeneratedForBrand() {
  try {
    var brandOps = JSON.parse(localStorage.getItem('roweos_generated_brand_ops') || '[]');
    var changed = false;
    var primaryBrand = typeof brands !== 'undefined' && brands[0] ? brands[0].name : '';
    brandOps.forEach(function(op) {
      if (!op.generatedForBrand && primaryBrand) {
        op.generatedForBrand = primaryBrand;
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('roweos_generated_brand_ops', JSON.stringify(brandOps));
      if (typeof generatedBrandOps !== 'undefined') window.generatedBrandOps = brandOps;
    }
  } catch(e) {}
}

// ─── SCHEDULER TAB ──────────────────────────────────────────────────────

/**
 * v13.9: Render Scheduler tab
 */
function renderAutoLabScheduler() {
  var el = document.getElementById('autoLabScheduler');
  if (!el) return;

  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) { console.warn('[Automations] Parse error:', e.message); }
  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  // Merge
  var merged = {};
  automations.forEach(function(a) { merged[String(a.id)] = a; });
  scheduled.forEach(function(s) { if (!merged[String(s.id)]) merged[String(s.id)] = s; });
  var all = Object.keys(merged).map(function(k) { return merged[k]; });
  var enabled = all.filter(function(a) { return a.enabled !== false; });

  var html = '';

  // Upcoming (next 24h)
  html += '<div class="auto-lab-section-title">Upcoming (Next 24 Hours)</div>';
  var now = new Date();
  var upcoming = [];
  enabled.forEach(function(a) {
    if (!a.time) return;
    var parts = a.time.split(':');
    var runTime = new Date();
    runTime.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, 0, 0);
    // If already passed today, show tomorrow
    if (runTime < now) runTime.setDate(runTime.getDate() + 1);
    var diff = runTime - now;
    if (diff > 0 && diff < 86400000) {
      upcoming.push({ auto: a, runTime: runTime });
    }
  });
  upcoming.sort(function(a, b) { return a.runTime - b.runTime; });

  if (upcoming.length > 0) {
    html += '<div class="auto-lab-grid">';
    upcoming.forEach(function(u) {
      var timeStr = formatDateTimeDisplay(u.runTime);
      html += '<div class="auto-lab-card">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
      html += '<div>';
      html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-variant-numeric:tabular-nums;">' + timeStr + '</div>';
      html += '<div class="auto-lab-card-title">' + escapeHtml(u.auto.name || 'Untitled') + '</div>';
      html += '</div>';
      html += '<span class="auto-lab-card-badge recurrence">' + escapeHtml(u.auto.recurType || 'one-time') + '</span>';
      html += '</div>';
      html += '<div class="auto-lab-card-meta">' + escapeHtml(u.auto.action || 'notify') + '</div>';
      html += '<div class="auto-lab-card-actions">';
      html += '<button class="auto-lab-card-btn primary" onclick="runAutoLabNow(\'' + u.auto.id + '\')">Run Now</button>';
      html += '</div></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="auto-lab-empty">No automations scheduled in the next 24 hours.</div>';
  }

  // Active Schedules
  html += '<div class="auto-lab-section-title">Active Schedules</div>';
  var recurring = enabled.filter(function(a) { return a.recurType && a.recurType !== 'none'; });
  if (recurring.length > 0) {
    html += '<div class="auto-lab-grid">';
    recurring.forEach(function(a) {
      html += '<div class="auto-lab-card" style="cursor:pointer;" onclick="showAutoLabWorkflowDetail(\'' + a.id + '\')">';
      html += '<div class="auto-lab-card-header">';
      html += '<div class="auto-lab-card-title">' + escapeHtml(a.name || 'Untitled') + '</div>';
      html += '<span class="auto-lab-card-badge recurrence">' + escapeHtml(a.recurType) + '</span>';
      html += '</div>';
      html += '<div class="auto-lab-card-meta">' + (a.time || '') + ' &middot; ' + escapeHtml(a.action || 'notify');
      if (a.lastRun) html += '<br>Last: ' + new Date(a.lastRun).toLocaleString();
      html += '</div></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="auto-lab-empty">No recurring schedules active.</div>';
  }

  // v18.1: FEATURE 8 — Execution History with filter bar
  html += '<div class="auto-lab-section-title">Execution History</div>';
  html += '<div class="auto-lab-history-filters" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;">';
  html += '<select id="autoLabHistoryFilter" onchange="filterAutoLabHistory()" class="auto-lab-filter-control">';
  html += '<option value="all">All</option><option value="success">Succeeded</option><option value="failed">Failed</option></select>';
  html += '<input type="text" id="autoLabHistorySearch" placeholder="Search history..." oninput="filterAutoLabHistory()" class="auto-lab-filter-control" style="flex:1;min-width:120px;">';
  html += '<select id="autoLabHistorySort" onchange="filterAutoLabHistory()" class="auto-lab-filter-control">';
  html += '<option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>';
  html += '</div>';
  html += '<div id="autoLabHistoryTimeline"></div>';

  el.innerHTML = html;
  filterAutoLabHistory();
}

/**
 * v13.9: Add entry to execution history
 */
function addAutoLabHistory(task, success, result, opts) {
  var history = [];
  try { history = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]'); } catch(e) {}
  opts = opts || {};
  // v18.7: Detect image URL in result but DON'T store full base64 in history
  var imageUrl = opts.imageUrl || '';
  if (!imageUrl && result && typeof result === 'string' && result.indexOf('data:image') === 0) {
    imageUrl = result.substring(0, 200000); // cap base64 for preview
  }
  // v18.7: Strip base64 data from result text to prevent quota issues
  var cleanResult = result ? String(result) : '';
  if (cleanResult.indexOf('data:image') === 0) {
    cleanResult = '[Image generated]';
  }
  // v22.29: Increased from 5K to 50K to show full execution output
  cleanResult = cleanResult.substring(0, 50000);
  history.push({
    id: Date.now(),
    name: task.name || 'Unknown',
    action: task.action || 'unknown',
    brand: task.brand || '',
    success: !!success,
    result: cleanResult,
    timestamp: new Date().toISOString(),
    imageUrl: imageUrl || '',
    duration: opts.duration || 0
  });
  // Keep last 100 entries (was 200)
  if (history.length > 100) history = history.slice(-100);
  // v18.7: Wrap in try/catch to prevent QuotaExceededError from crashing pipeline
  try {
    localStorage.setItem('roweos_auto_lab_history', JSON.stringify(history));
  } catch(e) {
    // Storage full — trim aggressively and retry
    if (typeof clearExpendableStorageData === 'function') clearExpendableStorageData();
    history = history.slice(-20);
    // Strip all imageUrl data to save space
    history.forEach(function(h) { h.imageUrl = ''; h.result = (h.result || '').substring(0, 500); });
    try { localStorage.setItem('roweos_auto_lab_history', JSON.stringify(history)); } catch(e2) {}
  }
}

// v18.1: FEATURE 8 — Filter/sort/search execution history
function filterAutoLabHistory() {
  var container = document.getElementById('autoLabHistoryTimeline');
  if (!container) return;
  var filterVal = (document.getElementById('autoLabHistoryFilter') || {}).value || 'all';
  var searchVal = ((document.getElementById('autoLabHistorySearch') || {}).value || '').toLowerCase().trim();
  var sortVal = (document.getElementById('autoLabHistorySort') || {}).value || 'newest';
  var history = [];
  try { history = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]'); } catch(e) {}
  // Filter
  if (filterVal === 'success') history = history.filter(function(h) { return h.success; });
  else if (filterVal === 'failed') history = history.filter(function(h) { return !h.success; });
  if (searchVal) history = history.filter(function(h) { return (h.name || '').toLowerCase().indexOf(searchVal) > -1 || (h.result || '').toLowerCase().indexOf(searchVal) > -1; });
  // Sort
  history.sort(function(a, b) { return sortVal === 'oldest' ? new Date(a.timestamp) - new Date(b.timestamp) : new Date(b.timestamp) - new Date(a.timestamp); });
  var recentHistory = history.slice(0, 50);
  // v18.5: Action icon map
  var actionIcons = {
    studio: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    image: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    post: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
    pipeline: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="20" r="2"/><path d="M12 6v4M12 14v4"/></svg>',
    prompt: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    notify: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>'
  };
  var html = '';
  if (recentHistory.length > 0) {
    html += '<div class="auto-lab-timeline">';
    recentHistory.forEach(function(h, idx) {
      var status = h.success ? 'success' : 'failed';
      var timeStr = h.timestamp ? new Date(h.timestamp).toLocaleString() : 'Unknown';
      var actionIcon = actionIcons[h.action] || actionIcons['studio'];
      var durationStr = '';
      if (h.duration && h.duration > 0) {
        durationStr = h.duration < 1000 ? h.duration + 'ms' : (h.duration / 1000).toFixed(1) + 's';
      }
      // v18.1: FEATURE 7 — Indent pipeline sub-steps
      var isSubStep = (h.name || '').indexOf(' > Step ') > -1;
      // v20.6: Add id for notification center deep-link scroll
      var entryId = h.id ? ' id="autoLabHistoryEntry_' + h.id + '"' : '';
      html += '<div class="auto-lab-timeline-item"' + entryId + ' style="cursor:pointer;' + (isSubStep ? 'padding-left:24px;opacity:0.85;' : '') + '" onclick="toggleAutoLabHistoryDetail(' + idx + ')">';
      html += '<div class="auto-lab-timeline-dot ' + status + '">' + actionIcon + '</div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div class="auto-lab-timeline-desc">' + escapeHtml(h.name || 'Unknown task') + '</div>';
      html += '<div class="auto-lab-timeline-status">' + timeStr + ' &middot; ' + (h.success ? 'Completed' : 'Failed') + (durationStr ? ' &middot; ' + durationStr : '') + (h.brand ? ' &middot; ' + escapeHtml(h.brand) : '') + '</div>';
      // v18.5: Image preview for image results
      if (h.imageUrl) {
        html += '<div style="margin-top:6px;"><img src="' + h.imageUrl + '" style="max-width:120px;max-height:80px;border-radius:8px;border:1px solid var(--border-color);" loading="lazy"></div>';
      }
      // v18.7: Content preview snippet (2 lines) — skip base64 data
      if (h.result && !h.imageUrl && h.result.indexOf('data:image') !== 0 && h.result.indexOf('data:') !== 0) {
        var _preview = h.result.replace(/\*\*/g, '').replace(/#{1,3}\s*/g, '').replace(/\n+/g, ' ').trim();
        if (_preview.length > 120) _preview = _preview.substring(0, 120) + '...';
        if (_preview) {
          html += '<div style="font-size:12px;color:var(--text-muted);line-height:1.4;max-height:2.4em;overflow:hidden;margin-top:4px;">' + escapeHtml(_preview) + '</div>';
        }
      }
      if (h.result) {
        html += '<div id="autoLabHistDetail' + idx + '" style="display:none;margin-top:8px;padding:12px;background:var(--bg-secondary);border-radius:10px;font-size:13px;color:var(--text-primary);line-height:1.5;max-height:none;overflow-y:visible;"></div>';
      }
      // v18.8: View Post buttons for social post history items
      if (h.action === 'post' && h.result) {
        var _hUrlRegex = /\[View on ([^\]]+)\]\(([^)]+)\)/g;
        var _hUrlMatch;
        while ((_hUrlMatch = _hUrlRegex.exec(h.result)) !== null) {
          html += '<a href="' + escapeHtml(_hUrlMatch[2]) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;margin-right:6px;padding:3px 10px;font-size:11px;font-weight:500;color:var(--accent);background:var(--accent-10,rgba(168,152,120,0.1));border:1px solid var(--accent);border-radius:var(--radius-full);text-decoration:none;cursor:pointer;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>View on ' + escapeHtml(_hUrlMatch[1]) + '</a>';
        }
      }
      html += '</div>';
      html += '<span style="font-size:11px;color:var(--text-muted);white-space:nowrap;margin-left:auto;">' + (h.result ? 'View details' : '') + '</span>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div class="auto-lab-empty">No execution history' + (filterVal !== 'all' || searchVal ? ' matching filters' : ' yet. Run an automation to see results here.') + '</div>';
  }
  container.innerHTML = html;
}

/**
 * v13.9: Toggle expand/collapse of history item to show full output
 */
function toggleAutoLabHistoryDetail(idx) {
  var el = document.getElementById('autoLabHistDetail' + idx);
  if (!el) return;
  if (el.style.display === 'none' || !el.style.display) {
    // v18.1: Re-apply same filter/sort to match displayed index
    var filterVal = (document.getElementById('autoLabHistoryFilter') || {}).value || 'all';
    var searchVal = ((document.getElementById('autoLabHistorySearch') || {}).value || '').toLowerCase().trim();
    var sortVal = (document.getElementById('autoLabHistorySort') || {}).value || 'newest';
    var history = [];
    try { history = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]'); } catch(e) {}
    if (filterVal === 'success') history = history.filter(function(h) { return h.success; });
    else if (filterVal === 'failed') history = history.filter(function(h) { return !h.success; });
    if (searchVal) history = history.filter(function(h) { return (h.name || '').toLowerCase().indexOf(searchVal) > -1 || (h.result || '').toLowerCase().indexOf(searchVal) > -1; });
    history.sort(function(a, b) { return sortVal === 'oldest' ? new Date(a.timestamp) - new Date(b.timestamp) : new Date(b.timestamp) - new Date(a.timestamp); });
    var item = history[idx];
    if (item && item.result) {
      var content = item.result;
      if (typeof marked !== 'undefined' && marked.parse) {
        try { content = marked.parse(content); } catch(e) { content = escapeHtml(content).replace(/\n/g, '<br>'); }
      } else {
        content = escapeHtml(content).replace(/\n/g, '<br>');
      }
      el.innerHTML = content;
    }
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

/**
 * v13.9: Show workflow detail view with config, last run, history
 */
function showAutoLabWorkflowDetail(autoId) {
  var idStr = String(autoId);
  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) { console.warn('[Automations] Parse error:', e.message); }
  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];

  var task = null;
  automations.forEach(function(a) { if (String(a.id) === idStr) task = a; });
  if (!task) {
    scheduled.forEach(function(s) { if (String(s.id) === idStr) task = s; });
  }
  if (!task) { showToast('Workflow not found', 'error'); return; }

  var freq = task.frequency || task.recurType || 'none';
  var lastRunStr = task.lastRun ? new Date(task.lastRun).toLocaleString() : 'Never';

  // Get history for this task
  var history = [];
  try { history = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]'); } catch(e) {}
  var taskHistory = history.filter(function(h) { return h.name === task.name; }).slice(0, 10);

  var html = '<div id="autoLabWorkflowDetail" style="position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">';
  html += '<div style="background:var(--bg-primary);border-radius:16px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;padding:28px;border:1px solid var(--border-primary);">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">';
  html += '<div style="font-size:18px;font-weight:600;color:var(--text-primary);">' + escapeHtml(task.name || 'Untitled Workflow') + '</div>';
  html += '<button onclick="document.getElementById(\'autoLabWorkflowDetail\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;padding:4px 8px;">&times;</button>';
  html += '</div>';

  // Configuration
  html += '<div style="margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:10px;font-size:13px;">';
  html += '<div style="font-weight:600;margin-bottom:8px;color:var(--text-primary);">Configuration</div>';
  html += '<div style="color:var(--text-secondary);">Action: ' + escapeHtml(task.action || 'notify') + '</div>';
  // v22.44: Hide time for one-time (on-demand) automations
  html += '<div style="color:var(--text-secondary);">Schedule: ' + escapeHtml(freq) + (freq === 'none' || freq === 'once' ? ' (on demand)' : ' at ' + escapeHtml(task.time || 'N/A')) + '</div>';
  html += '<div style="color:var(--text-secondary);">Last Run: ' + lastRunStr + '</div>';
  html += '<div style="color:var(--text-secondary);">Status: ' + (task.enabled !== false ? 'Enabled' : 'Disabled') + '</div>';
  html += '</div>';

  // Last run output
  if (taskHistory.length > 0 && taskHistory[0].result) {
    html += '<div style="margin-bottom:16px;">';
    html += '<div style="font-weight:600;margin-bottom:8px;color:var(--text-primary);font-size:13px;">Last Run Output</div>';
    var lastResult = taskHistory[0].result;
    var rendered = lastResult;
    if (typeof marked !== 'undefined' && marked.parse) {
      try { rendered = marked.parse(lastResult); } catch(e) { rendered = escapeHtml(lastResult).replace(/\n/g, '<br>'); }
    } else {
      rendered = escapeHtml(lastResult).replace(/\n/g, '<br>');
    }
    html += '<div style="padding:12px;background:var(--bg-secondary);border-radius:10px;font-size:13px;color:var(--text-primary);line-height:1.5;max-height:300px;overflow-y:auto;">' + rendered + '</div>';
    html += '</div>';
  }

  // Run history timeline
  if (taskHistory.length > 1) {
    html += '<div style="margin-bottom:16px;">';
    html += '<div style="font-weight:600;margin-bottom:8px;color:var(--text-primary);font-size:13px;">Run History</div>';
    taskHistory.forEach(function(h) {
      var timeStr = h.timestamp ? new Date(h.timestamp).toLocaleString() : '';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-primary);font-size:12px;">';
      html += '<div style="width:8px;height:8px;border-radius:50%;background:' + (h.success ? '#4ade80' : '#ef4444') + ';flex-shrink:0;"></div>';
      html += '<span style="color:var(--text-secondary);">' + timeStr + '</span>';
      html += '<span style="color:var(--text-muted);">' + (h.success ? 'Completed' : 'Failed') + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Actions
  html += '<div style="display:flex;gap:8px;justify-content:flex-end;">';
  html += '<button class="auto-lab-card-btn primary" onclick="document.getElementById(\'autoLabWorkflowDetail\').remove();runAutoLabNow(\'' + autoId + '\')">Run Now</button>';
  html += '</div>';
  html += '</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * v13.9: Manually trigger an automation
 */
// v22.10: Check if automation contains a deep research step
function automationHasDeepResearch(auto) {
  if (auto.action === 'research') return true;
  if ((auto.type === 'pipeline' || auto.action === 'pipeline') && auto.steps) {
    return auto.steps.some(function(s) {
      return s.action === 'research' || (s.action === 'studio' && s.config && s.config.useDeepResearch);
    });
  }
  return false;
}

async function runAutoLabNow(autoId) {
  var idStr = String(autoId);
  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  var idx = -1;
  var task = null;
  for (var i = 0; i < scheduled.length; i++) {
    if (String(scheduled[i].id) === idStr) { task = scheduled[i]; idx = i; break; }
  }
  // v19.1: Always check roweos_automations for the full object — scheduled tasks
  // may have been stripped of action/target/config by loadFromFirebaseV2()
  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) { console.warn('[Automations] Parse error:', e.message); }
  var fullTask = automations.find(function(a) { return String(a.id) === idStr; });
  if (!task && fullTask) {
    task = fullTask;
    scheduled.push(task);
    if (typeof saveScheduledTasks === 'function') saveScheduledTasks(scheduled);
    idx = scheduled.length - 1;
  } else if (task && fullTask && !task.action && fullTask.action) {
    // Scheduled version is stripped — use full version from roweos_automations
    task = fullTask;
    scheduled[idx] = fullTask;
    if (typeof saveScheduledTasks === 'function') saveScheduledTasks(scheduled);
  }
  if (!task) { showToast('Automation not found', 'error'); return; }

  // v22.47: Force approval queue if automation has requireApproval toggle
  if (task.config && task.config.requireApproval) {
    window._forceApprovalQueue = true;
  }

  showToast('Running "' + (task.name || 'automation') + '"...', 'info');
  // v23.11: Create AbortController for stop support
  if (!window._activeAutoFetch) window._activeAutoFetch = {};
  var _ac = new AbortController();
  window._activeAutoFetch[idStr] = _ac;
  task._abortSignal = _ac.signal;
  if (typeof executeScheduledTask === 'function') {
    try {
      await executeScheduledTask(task, idx);
    } finally {
      window._forceApprovalQueue = false;
      delete window._activeAutoFetch[idStr];
    }
  } else {
    window._forceApprovalQueue = false;
    delete window._activeAutoFetch[idStr];
    showToast('Scheduler engine not available', 'error');
  }
}

// ─── IMAGE LAB TAB ──────────────────────────────────────────────────────

/**
 * v13.9: Render Image Lab tab
 */
function renderAutoLabImageLab(targetId) {
  var el = document.getElementById(targetId || 'autoLabImageLab');
  window._imageLabTargetId = targetId || 'autoLabImageLab';
  if (!el) return;

  // v15.18: Track active sub-tab
  if (!window._imageLabSubTab) window._imageLabSubTab = 'quick';

  var html = '';

  // v15.18: Sub-tabs
  html += '<div class="imagelab-subtabs">';
  html += '<button class="imagelab-subtab' + (window._imageLabSubTab === 'quick' ? ' active' : '') + '" onclick="window._imageLabSubTab=\'quick\';renderAutoLabImageLab(window._imageLabTargetId);">Quick Generate</button>';
  html += '<button class="imagelab-subtab' + (window._imageLabSubTab === 'chat' ? ' active' : '') + '" onclick="window._imageLabSubTab=\'chat\';renderAutoLabImageLab(window._imageLabTargetId);">Image Chat</button>';
  html += '</div>';

  if (window._imageLabSubTab === 'chat') {
    // v15.18: Image Chat sub-tab
    html += renderImageLabChatHTML();
    el.innerHTML = html;
    loadImageLabChatHistory();
    renderImageLabChatThread();
    // v15.22: Attach paste listener to Image Lab chat input
    var ilInput = document.getElementById('imageLabChatInput');
    if (ilInput) ilInput.addEventListener('paste', handleChatPaste);
    return;
  }

  // Quick Generate sub-tab (existing UI)
  html += '<div class="auto-lab-prompt-bar">';
  html += '<input type="text" id="autoLabImagePrompt" placeholder="Describe the image you want to generate...">';
  html += '<select id="autoLabImageModel">';
  html += '<option value="gemini-2.5-flash-image">Nano Banana 3.0</option>';
  html += '<option value="gemini-3-pro-image-preview">Nano Banana 3.0 Pro</option>';
  html += '<option value="gemini-2.0-flash-exp-image-generation">Gemini 2.0 Flash Image (Legacy)</option>';
  html += '<option value="imagen3">Imagen 4</option>';
  html += '</select>';
  html += '<select id="autoLabImageAspect">';
  html += '<option value="1:1">1:1</option>';
  html += '<option value="16:9">16:9</option>';
  html += '<option value="9:16">9:16</option>';
  html += '<option value="4:3">4:3</option>';
  html += '</select>';
  html += '<button id="autoLabImageBtn" onclick="generateAutoLabImage()">Generate</button>';
  // v14.3: Reference image indicator next to Generate button
  if (window.autoLabRefImage) {
    html += '<span style="font-size:11px;color:#a78bfa;font-weight:500;padding:4px 8px;background:rgba(168,139,250,0.1);border-radius:6px;white-space:nowrap;">+ ref image</span>';
  }
  html += '</div>';
  // v14: Reference image upload
  html += '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">';
  html += '<label class="auto-lab-card-btn" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:10px;font-size:12px;white-space:nowrap;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload Reference';
  html += '<input type="file" accept="image/*" id="autoLabImageRef" style="display:none" onchange="handleAutoLabImageUpload(this)">';
  html += '</label>';
  // v14.3: Browse Library and Inventory for reference images
  html += '<button class="auto-lab-card-btn" onclick="openImageLabLibraryBrowser()" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:10px;font-size:12px;white-space:nowrap;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> From Library';
  html += '</button>';
  html += '<button class="auto-lab-card-btn" onclick="openImageLabInventoryBrowser()" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:10px;font-size:12px;white-space:nowrap;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> From Inventory';
  html += '</button>';
  // v13.9: Reference preview with thumbnail, filename, and size
  if (window.autoLabRefImage) {
    html += '<div id="autoLabRefPreview" style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-secondary);border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">';
    if (window.autoLabRefImage.base64) {
      html += '<img src="data:' + (window.autoLabRefImage.mimeType || 'image/png') + ';base64,' + window.autoLabRefImage.base64 + '" style="width:36px;height:36px;object-fit:cover;border-radius:6px;">';
    }
    var refName = window.autoLabRefImage.name || 'Reference image';
    var refSize = window.autoLabRefImage.size ? (Math.round(window.autoLabRefImage.size / 1024) + ' KB') : '';
    html += '<div style="font-size:12px;"><div style="color:var(--text-primary);font-weight:500;">' + escapeHtml(refName) + '</div>';
    if (refSize) html += '<div style="color:var(--text-muted);font-size:11px;">' + refSize + '</div>';
    html += '</div>';
    html += '<button class="auto-lab-card-btn danger" onclick="window.autoLabRefImage=null;renderAutoLabImageLab(window._imageLabTargetId);" style="padding:4px 8px;font-size:11px;">&times;</button>';
    html += '</div>';
  }
  html += '</div>';

  // Gallery
  html += '<div class="auto-lab-section-title">Gallery</div>';
  var images = [];
  try { images = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]'); } catch(e) {}
  images.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  if (images.length > 0) {
    html += '<div class="auto-lab-gallery">';
    images.forEach(function(img, idx) {
      html += '<div class="auto-lab-gallery-item">';
      if (img.dataUrl) {
        html += '<img class="auto-lab-gallery-img" src="' + img.dataUrl + '" alt="' + escapeHtml(img.prompt || '') + '" style="cursor:pointer;" onclick="expandAutoLabImage(' + idx + ')">';
      } else {
        html += '<div class="auto-lab-gallery-img" style="display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);color:var(--text-muted);font-size:12px;">No image</div>';
      }
      html += '<div class="auto-lab-gallery-caption">' + escapeHtml(img.prompt || '') + '</div>';
      html += '<div class="auto-lab-gallery-caption" style="padding-top:0;font-size:11px;">' + (img.createdAt ? new Date(img.createdAt).toLocaleString() : '') + '</div>';
      html += '<div class="auto-lab-gallery-actions">';
      if (img.dataUrl) {
        html += '<button class="auto-lab-card-btn" onclick="expandAutoLabImage(' + idx + ')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Expand</button>';
        html += '<button class="auto-lab-card-btn" onclick="saveAutoLabImageToLibrary(' + idx + ')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Library</button>';
        html += '<button class="auto-lab-card-btn" onclick="downloadAutoLabImage(' + idx + ')">Download</button>';
      }
      html += '<button class="auto-lab-card-btn danger" onclick="deleteAutoLabImage(' + idx + ')">Delete</button>';
      html += '</div></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="auto-lab-empty">No images generated yet. Use the prompt bar above to create your first image.</div>';
  }

  el.innerHTML = html;
}

// v15.18: Render Image Lab Chat HTML structure
function renderImageLabChatHTML() {
  var h = '';
  h += '<div class="imagelab-chat-container">';

  // Toolbar
  h += '<div class="imagelab-chat-toolbar">';
  h += '<select id="imageLabChatModel" onchange="_imageLabChatModel=this.value;">';
  h += '<option value="gemini-2.5-flash-image"' + (_imageLabChatModel === 'gemini-2.5-flash-image' ? ' selected' : '') + '>Nano Banana 3.0</option>';
  h += '<option value="gemini-3-pro-image-preview"' + (_imageLabChatModel === 'gemini-3-pro-image-preview' ? ' selected' : '') + '>Nano Banana 3.0 Pro</option>';
  h += '<option value="gemini-2.0-flash-exp-image-generation"' + (_imageLabChatModel === 'gemini-2.0-flash-exp-image-generation' ? ' selected' : '') + '>Gemini 2.0 Flash Image (Legacy)</option>';
  h += '<option value="imagen3"' + (_imageLabChatModel === 'imagen3' ? ' selected' : '') + '>Imagen 4</option>';
  h += '</select>';
  h += '<select id="imageLabChatAspect">';
  h += '<option value="1:1">1:1</option>';
  h += '<option value="16:9">16:9</option>';
  h += '<option value="9:16">9:16</option>';
  h += '<option value="4:3">4:3</option>';
  h += '</select>';
  h += '<button class="auto-lab-card-btn" onclick="clearImageLabChat()" style="margin-left:auto;display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:10px;font-size:12px;">';
  h += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> New Conversation</button>';
  h += '</div>';

  // Thread
  h += '<div class="imagelab-chat-thread" id="imageLabChatThread"></div>';

  // v28.4: Recent generated images gallery strip
  h += '<div id="imageLabGalleryStrip" style="margin-top:8px;"></div>';

  // v25.4: Reference image chips (shown above input bar if any refs attached)
  if (window._imageLabChatRefImages && window._imageLabChatRefImages.length > 0) {
    h += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;flex-wrap:wrap;padding:0 4px;">';
    window._imageLabChatRefImages.forEach(function(ref, ri) {
      h += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#a78bfa;padding:3px 8px;background:rgba(168,139,250,0.1);border-radius:6px;">';
      h += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
      h += escapeHtml(ref.name || ('ref ' + (ri + 1)));
      h += '<button onclick="window._imageLabChatRefImages.splice(' + ri + ',1);renderAutoLabImageLab(window._imageLabTargetId);" style="padding:1px 4px;font-size:10px;line-height:1;border:none;background:none;color:#f87171;cursor:pointer;">&times;</button>';
      h += '</span>';
    });
    h += '</div>';
  }
  // v25.4: Input bar with Ref button inline on left, input in middle, Send on right
  var isImagen4 = window._imageLabChatModel === 'imagen3';
  h += '<div class="imagelab-chat-input-bar" style="display:flex;gap:0;">';
  h += '<label style="cursor:' + (isImagen4 ? 'not-allowed' : 'pointer') + ';display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 16px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-right:none;border-radius:8px 0 0 8px;color:var(--text-secondary);font-size:13px;font-weight:500;opacity:' + (isImagen4 ? '0.4' : '1') + ';white-space:nowrap;" title="' + (isImagen4 ? 'Imagen 4 does not support reference images' : 'Attach reference image') + '">';
  h += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> Ref';
  if (!isImagen4) {
    h += '<input type="file" accept="image/*" multiple id="imageLabChatRef" style="display:none" onchange="handleImageLabChatRefUploads(this)">';
  }
  h += '</label>';
  h += '<input type="text" id="imageLabChatInput" placeholder="Describe an image or edit the last one..." onkeydown="if(event.key===\'Enter\')sendImageLabMessage();" style="border-radius:0;border-left:none;border-right:none;">';
  h += '<button id="imageLabChatSendBtn" onclick="sendImageLabMessage()" style="border-radius:0 8px 8px 0;">Send</button>';
  h += '</div>';

  h += '</div>';
  return h;
}

// v15.18: Load Image Lab Chat history from localStorage
function loadImageLabChatHistory() {
  try {
    var stored = localStorage.getItem('roweos_imagelab_chat');
    if (stored) {
      _imageLabChatMessages = JSON.parse(stored);
    } else {
      _imageLabChatMessages = [];
    }
  } catch (e) {
    _imageLabChatMessages = [];
  }
  // v15.47: If no saved messages, clear stale API history to prevent old conversation bleed
  if (_imageLabChatMessages.length === 0) {
    _imageLabChatHistory = [];
  }
}

// v28.4: Render gallery strip of recent generated images below Image Chat
function renderImageLabGalleryStrip() {
  var strip = document.getElementById('imageLabGalleryStrip');
  if (!strip) return;
  var images = [];
  try {
    images = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]');
    if (!Array.isArray(images)) images = [];
  } catch(e) { images = []; }
  if (images.length === 0) {
    strip.innerHTML = '';
    return;
  }
  // Show last 10 images, newest first
  var recent = images.slice(-10).reverse();
  var html = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
  html += '<span style="font-size:11px;color:var(--text-tertiary);font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Recent Images</span>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;">';
  for (var i = 0; i < recent.length; i++) {
    var img = recent[i];
    if (!img.dataUrl) continue;
    html += '<div style="flex-shrink:0;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid var(--border-color);cursor:pointer;" onclick="window.open(this.querySelector(\'img\').src)" title="' + escapeHtml((img.prompt || '').substring(0, 60)) + '">';
    html += '<img src="' + img.dataUrl + '" style="width:100%;height:100%;object-fit:cover;" alt="Generated image">';
    html += '</div>';
  }
  html += '</div>';
  strip.innerHTML = html;
}

// v15.18: Render the chat thread from _imageLabChatMessages
function renderImageLabChatThread() {
  var thread = document.getElementById('imageLabChatThread');
  if (!thread) return;

  if (_imageLabChatMessages.length === 0) {
    thread.innerHTML = '<div class="imagelab-chat-empty">' +
      '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' +
      '<div>Start a conversation to generate and refine images.</div>' +
      '<div style="font-size:12px;color:var(--text-muted);">Each message builds on the previous, so you can iteratively edit.</div>' +
      '</div>';
    return;
  }

  var html = '';
  _imageLabChatMessages.forEach(function(msg, idx) {
    html += '<div class="imagelab-chat-message ' + escapeHtml(msg.role) + '">';
    html += '<div class="imagelab-chat-bubble">';
    if (msg.type === 'image' && msg.content && msg.content.indexOf('data:') === 0) {
      // v25.4: Render image data URLs as <img> tags
      html += '<img src="' + msg.content + '" alt="Generated image" onclick="window.open(this.src)" style="max-width:400px;border-radius:8px;cursor:pointer;">';
    } else if (msg.content) {
      html += '<div>' + escapeHtml(msg.content) + '</div>';
    }
    if (msg._hasImage && !msg.imageUrl) {
      html += '<div style="padding:8px;background:var(--bg-tertiary);border-radius:8px;font-size:11px;color:var(--text-muted);text-align:center;margin-top:4px;">Image generated (view in gallery below)</div>';
    }
    if (msg.imageUrl) {
      html += '<img src="' + msg.imageUrl + '" alt="Generated image" onclick="window.open(this.src)" style="max-width:400px;border-radius:8px;">';
    }
    if (msg.timestamp) {
      html += '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">' + formatDateTimeDisplay(new Date(msg.timestamp)) + '</div>';
    }
    html += '</div></div>';
  });

  thread.innerHTML = html;
  thread.scrollTop = thread.scrollHeight;
  // v28.4: Update gallery strip after thread render
  if (typeof renderImageLabGalleryStrip === 'function') renderImageLabGalleryStrip();
}

// v15.23: Handle multi-file reference image upload for Image Lab Chat
function handleImageLabChatRefUploads(input) {
  if (!input || !input.files || !input.files.length) return;
  if (!window._imageLabChatRefImages) window._imageLabChatRefImages = [];
  var filesToRead = Array.from(input.files);
  var pending = filesToRead.length;
  filesToRead.forEach(function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;
      var parts = dataUrl.split(',');
      var base64 = parts.length > 1 ? parts[1] : parts[0];
      var mimeMatch = dataUrl.match(/data:([^;]+);/);
      var mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      window._imageLabChatRefImages.push({ base64: base64, mimeType: mimeType, name: file.name });
      pending--;
      if (pending === 0) renderAutoLabImageLab(window._imageLabTargetId);
    };
    reader.readAsDataURL(file);
  });
}
// v15.23: Backwards-compatible alias
function handleImageLabChatRefUpload(input) { handleImageLabChatRefUploads(input); }

// v15.18: Send a message in Image Lab Chat
async function sendImageLabMessage() {
  if (_imageLabChatSending) return;

  var input = document.getElementById('imageLabChatInput');
  var prompt = input ? input.value.trim() : '';
  if (!prompt) return;

  var apiKey = getNanobananaKey();
  if (!apiKey) {
    showToast('Nano Banana API key not configured. Go to Settings to add your key.', 'error');
    return;
  }

  var modelSelect = document.getElementById('imageLabChatModel');
  var model = modelSelect ? modelSelect.value : _imageLabChatModel;
  var aspectSelect = document.getElementById('imageLabChatAspect');
  var aspectRatio = aspectSelect ? aspectSelect.value : '1:1';

  _imageLabChatSending = true;
  if (input) input.value = '';
  var sendBtn = document.getElementById('imageLabChatSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  // Add user message
  _imageLabChatMessages.push({ role: 'user', content: prompt, timestamp: new Date().toISOString() });
  renderImageLabChatThread();

  // Show generating indicator
  var thread = document.getElementById('imageLabChatThread');
  var loadingDiv = document.createElement('div');
  loadingDiv.className = 'imagelab-chat-message assistant';
  loadingDiv.id = 'imageLabChatLoading';
  loadingDiv.innerHTML = '<div class="imagelab-chat-bubble" style="display:flex;align-items:center;gap:8px;"><span class="streaming-cursor"></span> Generating...</div>';
  if (thread) {
    thread.appendChild(loadingDiv);
    thread.scrollTop = thread.scrollHeight;
  }

  try {
    // v25.4: Imagen 4 path
    if (window._imageLabChatModel === 'imagen3') {
      var imgResult = await generateImageWithImagen3(prompt, window._imageLabAspectRatio || aspectRatio || '1:1');
      var loading3 = document.getElementById('imageLabChatLoading');
      if (loading3) loading3.remove();
      if (imgResult.success && imgResult.images && imgResult.images.length > 0) {
        var imgSrc = 'data:' + imgResult.images[0].mimeType + ';base64,' + imgResult.images[0].base64;
        _imageLabChatMessages.push({
          role: 'assistant',
          content: imgSrc,
          type: 'image',
          model: 'imagen3',
          aspectRatio: window._imageLabAspectRatio || aspectRatio || '1:1',
          timestamp: new Date().toISOString()
        });
        saveImageLabChatMessages();
        renderImageLabChatThread();
        window._nanobananaLastImage = imgSrc;
      } else {
        _imageLabChatMessages.push({
          role: 'assistant',
          content: 'Image generation failed: ' + (imgResult.error || 'Unknown error'),
          type: 'text',
          timestamp: new Date().toISOString()
        });
        saveImageLabChatMessages();
        renderImageLabChatThread();
      }
      window._imageLabChatSending = false;
      if (sendBtn) sendBtn.disabled = false;
      if (input) input.focus();
      return;
    }

    var opts = { model: model, aspectRatio: aspectRatio };

    // Multi-turn: pass history if we have prior turns
    if (_imageLabChatHistory.length > 0) {
      opts.imageHistory = _imageLabChatHistory;
    }

    // v15.23: Pass reference images whenever available (not just first turn)
    if (window._imageLabChatRefImages && window._imageLabChatRefImages.length > 0) {
      opts.referenceImages = window._imageLabChatRefImages;
    }

    var result = await generateImageWithNanobanana(prompt, opts);

    // Remove loading indicator
    var loading = document.getElementById('imageLabChatLoading');
    if (loading) loading.remove();

    if (result && result.images && result.images.length > 0) {
      var imgData = result.images[0];
      var dataUrl = 'data:' + (imgData.mimeType || 'image/png') + ';base64,' + imgData.base64;
      var responseText = result.text || '';

      // v15.23: Include ref images in user history turn for context
      var userParts = [];
      if (opts.referenceImages && opts.referenceImages.length > 0) {
        for (var rhi = 0; rhi < opts.referenceImages.length; rhi++) {
          var rh = opts.referenceImages[rhi];
          if (rh && rh.base64) userParts.push({ inlineData: { mimeType: rh.mimeType || 'image/png', data: rh.base64 } });
        }
      }
      userParts.push({ text: prompt });
      _imageLabChatHistory.push({ role: 'user', parts: userParts });
      if (result.rawModelParts && result.rawModelParts.length > 0) {
        _imageLabChatHistory.push({ role: 'model', parts: result.rawModelParts });
      } else {
        var modelParts = [];
        if (responseText) modelParts.push({ text: responseText });
        modelParts.push({ inlineData: { mimeType: imgData.mimeType || 'image/png', data: imgData.base64 } });
        _imageLabChatHistory.push({ role: 'model', parts: modelParts });
      }

      // Add assistant message to display
      _imageLabChatMessages.push({
        role: 'assistant',
        content: responseText,
        imageUrl: dataUrl,
        timestamp: new Date().toISOString()
      });

      renderImageLabChatThread();
      saveImageLabChatMessages();

      // v15.47: Don't clear ref images after use — keep them for multi-turn editing
      // Ref images are preserved so user can continue referencing them
      renderAutoLabImageLab(window._imageLabTargetId);
    } else if (result && result.text) {
      // Text-only response (no image generated)
      // v15.23: Include ref images in user history
      var textUserParts = [];
      if (opts.referenceImages && opts.referenceImages.length > 0) {
        for (var tri = 0; tri < opts.referenceImages.length; tri++) {
          var tr = opts.referenceImages[tri];
          if (tr && tr.base64) textUserParts.push({ inlineData: { mimeType: tr.mimeType || 'image/png', data: tr.base64 } });
        }
      }
      textUserParts.push({ text: prompt });
      _imageLabChatHistory.push({ role: 'user', parts: textUserParts });
      if (result.rawModelParts && result.rawModelParts.length > 0) {
        _imageLabChatHistory.push({ role: 'model', parts: result.rawModelParts });
      } else {
        _imageLabChatHistory.push({ role: 'model', parts: [{ text: result.text }] });
      }

      _imageLabChatMessages.push({
        role: 'assistant',
        content: result.text,
        timestamp: new Date().toISOString()
      });
      renderImageLabChatThread();
      saveImageLabChatMessages();
    } else {
      showToast('No image was generated. Try a different prompt.', 'warning');
      // Remove the user message we added
      _imageLabChatMessages.pop();
      renderImageLabChatThread();
    }
  } catch (err) {
    var loading = document.getElementById('imageLabChatLoading');
    if (loading) loading.remove();
    showToast('Image generation failed: ' + (err.message || err), 'error');
    // Remove the user message we added
    _imageLabChatMessages.pop();
    renderImageLabChatThread();
  }

  _imageLabChatSending = false;
  if (sendBtn) sendBtn.disabled = false;
  if (input) input.focus();
}

// v15.18: Save Image Lab Chat messages to localStorage
// v18.5: Strip large base64 imageUrl before saving to avoid QuotaExceededError
function saveImageLabChatMessages() {
  try {
    var toSave = _imageLabChatMessages.map(function(msg) {
      if (msg.imageUrl && msg.imageUrl.length > 500) {
        var copy = {};
        for (var k in msg) { if (msg.hasOwnProperty(k)) copy[k] = msg[k]; }
        copy._hasImage = true;
        copy._imagePreview = msg.imageUrl.substring(0, 80);
        delete copy.imageUrl;
        return copy;
      }
      return msg;
    });
    localStorage.setItem('roweos_imagelab_chat', JSON.stringify(toSave));
  } catch (e) {
    console.warn('[ImageLabChat] Failed to save messages:', e);
    // v18.5: Try again with more aggressive trimming
    try {
      var trimmed = _imageLabChatMessages.map(function(msg) {
        var copy = {};
        for (var k in msg) { if (msg.hasOwnProperty(k)) copy[k] = msg[k]; }
        delete copy.imageUrl;
        if (msg.imageUrl) copy._hasImage = true;
        return copy;
      });
      localStorage.setItem('roweos_imagelab_chat', JSON.stringify(trimmed));
    } catch (e2) { console.warn('[ImageLabChat] Save failed even after trimming:', e2); }
  }
}

// v15.18: Clear Image Lab Chat
function clearImageLabChat() {
  _imageLabChatHistory = [];
  _imageLabChatMessages = [];
  window._imageLabChatRefImages = [];
  try { localStorage.removeItem('roweos_imagelab_chat'); } catch (e) {}
  renderImageLabChatThread();
  showToast('Image Chat conversation cleared', 'info');
}

/**
 * v13.9: Handle reference image upload for image-to-image generation
 */
function handleAutoLabImageUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  var fileName = file.name || 'image';
  var fileSize = file.size || 0;
  var reader = new FileReader();
  reader.onload = function(e) {
    var dataUrl = e.target.result;
    var parts = dataUrl.split(',');
    var mimeMatch = parts[0].match(/data:([^;]+)/);
    var mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    var base64 = parts[1];
    // v13.9: Store name and size for preview
    window.autoLabRefImage = { base64: base64, mimeType: mimeType, name: fileName, size: fileSize };
    renderAutoLabImageLab(window._imageLabTargetId);
    showToast('Reference image loaded', 'success');
  };
  reader.onerror = function() {
    showToast('Failed to read image', 'error');
  };
  reader.readAsDataURL(file);
}

// v14.3: Browse Library for reference images
function openImageLabLibraryBrowser() {
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var images = [];

  try {
    if (mode === 'life') {
      var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{}');
      if (lifeLib.files) {
        lifeLib.files.forEach(function(f) {
          if (f.type && f.type.indexOf('image') !== -1 && f.content) {
            images.push({ name: f.name, dataUrl: f.content, source: 'library' });
          }
        });
      }
    } else {
      var lib = JSON.parse(localStorage.getItem('roweos_file_library') || localStorage.getItem('roweosLibrary') || '{}');
      Object.keys(lib).forEach(function(brandKey) {
        if (lib[brandKey] && lib[brandKey].files) {
          lib[brandKey].files.forEach(function(f) {
            if (f.type && f.type.indexOf('image') !== -1 && f.content) {
              images.push({ name: f.name, dataUrl: f.content, source: 'library' });
            }
          });
        }
      });
    }
  } catch (e) { console.warn('[ImageLab] Library parse error:', e); }

  if (images.length === 0) {
    showToast('No images found in Library', 'info');
    return;
  }

  showImageBrowserModal(images, 'Library');
}

// v14.3: Browse Inventory for reference images
function openImageLabInventoryBrowser() {
  var images = [];
  try {
    // v15.18: Use mode-aware storage key
    var inv = JSON.parse(localStorage.getItem(getInventoryStorageKey()) || '{}');
    if (inv.items) {
      inv.items.forEach(function(item) {
        if (item.image) {
          images.push({ name: item.name || 'Item', dataUrl: item.image, source: 'inventory' });
        }
      });
    }
  } catch (e) { console.warn('[ImageLab] Inventory parse error:', e); }

  if (images.length === 0) {
    showToast('No images found in Inventory', 'info');
    return;
  }

  showImageBrowserModal(images, 'Inventory');
}

// v14.3: Show image browser modal for Library/Inventory selection
function showImageBrowserModal(images, sourceLabel) {
  var existingModal = document.getElementById('imageLabBrowserModal');
  if (existingModal) existingModal.remove();

  var modal = document.createElement('div');
  modal.id = 'imageLabBrowserModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  var html = '<div style="background:var(--bg-primary);border-radius:16px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;" onclick="event.stopPropagation()">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">';
  html += '<div style="font-size:16px;font-weight:600;color:var(--text-primary);">Select from ' + sourceLabel + '</div>';
  html += '<button onclick="document.getElementById(\'imageLabBrowserModal\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">&times;</button>';
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;">';

  images.forEach(function(img, idx) {
    html += '<div onclick="selectImageLabBrowserImage(' + idx + ')" style="cursor:pointer;border-radius:10px;overflow:hidden;border:2px solid var(--border-color);transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border-color)\'">';
    html += '<img src="' + img.dataUrl + '" style="width:100%;height:100px;object-fit:cover;display:block;">';
    html += '<div style="padding:6px 8px;font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(img.name) + '</div>';
    html += '</div>';
  });

  html += '</div></div>';
  modal.innerHTML = html;

  // Store images for selection
  window._imageLabBrowserImages = images;
  document.body.appendChild(modal);
}

// v14.3: Select image from browser modal as reference
function selectImageLabBrowserImage(idx) {
  var images = window._imageLabBrowserImages || [];
  var img = images[idx];
  if (!img || !img.dataUrl) return;

  var parts = img.dataUrl.split(',');
  var mimeMatch = parts[0] ? parts[0].match(/data:([^;]+)/) : null;
  var mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  var base64 = parts[1] || '';

  window.autoLabRefImage = {
    base64: base64,
    mimeType: mimeType,
    name: img.name || 'Reference',
    size: base64.length
  };

  var modal = document.getElementById('imageLabBrowserModal');
  if (modal) modal.remove();
  window._imageLabBrowserImages = null;

  renderAutoLabImageLab(window._imageLabTargetId);
  showToast('Reference image set from ' + (img.source || 'selection'), 'success');
}

/**
 * v13.9: Generate image via Nanobanana
 */
async function generateAutoLabImage() {
  var promptEl = document.getElementById('autoLabImagePrompt');
  var modelEl = document.getElementById('autoLabImageModel');
  var aspectEl = document.getElementById('autoLabImageAspect');
  var btn = document.getElementById('autoLabImageBtn');
  if (!promptEl || !promptEl.value.trim()) { showToast('Please enter an image prompt', 'warning'); return; }

  var imgPrompt = promptEl.value.trim();
  var model = modelEl ? modelEl.value : 'gemini-2.5-flash-image';
  var aspect = aspectEl ? aspectEl.value : '1:1';

  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
  showToast('Generating image...', 'info');

  try {
    // v25.4: Route Imagen 4 to its own API
    var result;
    if (model === 'imagen3') {
      result = await generateImageWithImagen3(imgPrompt, aspect);
    } else {
      // v13.9: Pass reference image for image-to-image if uploaded
      var genOpts = { model: model, aspectRatio: aspect };
      if (window.autoLabRefImage) {
        genOpts.referenceImage = window.autoLabRefImage;
      }
      result = await generateImageWithNanobanana(imgPrompt, genOpts);
    }

    // v25.4: Check for API error before extracting image
    if (result && result.success === false) {
      throw new Error(result.error || 'Image generation failed');
    }
    // v13.9: Fix image data extraction - Nanobanana returns {images:[{base64,mimeType}]}
    var dataUrl = '';
    if (result && result.images && result.images[0] && result.images[0].base64) {
      dataUrl = 'data:' + (result.images[0].mimeType || 'image/png') + ';base64,' + result.images[0].base64;
    } else if (result && result.imageData) {
      dataUrl = 'data:image/png;base64,' + result.imageData;
    } else if (result && result.base64) {
      dataUrl = 'data:image/png;base64,' + result.base64;
    } else if (typeof result === 'string' && result.indexOf('data:') === 0) {
      dataUrl = result;
    }

    var images = [];
    try { images = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]'); } catch(e) {}
    images.push({
      prompt: imgPrompt,
      model: model,
      aspectRatio: aspect,
      dataUrl: dataUrl,
      createdAt: new Date().toISOString()
    });
    // Keep last 50 images
    if (images.length > 50) images = images.slice(-50);
    localStorage.setItem('roweos_auto_lab_images', JSON.stringify(images));

    promptEl.value = '';
    renderAutoLabImageLab(window._imageLabTargetId);
    addAutoLabHistory({ name: 'Image: ' + imgPrompt.substring(0, 50), action: 'image' }, true, 'Image generated successfully');
    showToast('Image generated!', 'success');
  } catch (err) {
    showToast('Image generation failed: ' + err.message, 'error');
    addAutoLabHistory({ name: 'Image: ' + imgPrompt.substring(0, 50), action: 'image' }, false, err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Generate'; }
  }
}

function deleteAutoLabImage(idx) {
  if (!confirm('Delete this image?')) return;
  var images = [];
  try { images = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]'); } catch(e) {}
  images.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  images.splice(idx, 1);
  localStorage.setItem('roweos_auto_lab_images', JSON.stringify(images));
  renderAutoLabImageLab(window._imageLabTargetId);
  showToast('Image deleted', 'success');
}

function downloadAutoLabImage(idx) {
  var images = [];
  try { images = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]'); } catch(e) {}
  images.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  var img = images[idx];
  if (!img || !img.dataUrl) return;
  var a = document.createElement('a');
  a.href = img.dataUrl;
  a.download = 'roweos-image-' + Date.now() + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * v13.9: Fullscreen lightbox for gallery images
 */
function expandAutoLabImage(idx) {
  var images = [];
  try { images = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]'); } catch(e) {}
  images.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  var img = images[idx];
  if (!img || !img.dataUrl) return;

  var html = '<div id="autoLabImageLightbox" style="position:fixed;inset:0;z-index:2500;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">';
  html += '<img src="' + img.dataUrl + '" style="max-width:90vw;max-height:75vh;object-fit:contain;border-radius:8px;">';
  if (img.prompt) {
    html += '<div style="margin-top:12px;color:#ccc;font-size:13px;text-align:center;max-width:600px;">' + escapeHtml(img.prompt) + '</div>';
  }
  html += '<div style="margin-top:16px;display:flex;gap:8px;">';
  html += '<button class="auto-lab-card-btn" onclick="event.stopPropagation();downloadAutoLabImage(' + idx + ');" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);padding:8px 16px;border-radius:8px;cursor:pointer;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>';
  html += '<button class="auto-lab-card-btn" onclick="event.stopPropagation();saveAutoLabImageToLibrary(' + idx + ');" style="background:rgba(212,175,55,0.2);color:#a89878;border:1px solid rgba(212,175,55,0.4);padding:8px 16px;border-radius:8px;cursor:pointer;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/></svg> Save to Library</button>';
  html += '<button onclick="event.stopPropagation();document.getElementById(\'autoLabImageLightbox\').remove();" style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:8px 16px;border-radius:8px;cursor:pointer;">Close</button>';
  html += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * v13.9: Save generated image to Library
 */
// v14.3: Route Image Lab save through folder picker modal
function saveAutoLabImageToLibrary(idx) {
  var images = [];
  try { images = JSON.parse(localStorage.getItem('roweos_auto_lab_images') || '[]'); } catch(e) {}
  images.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  var img = images[idx];
  if (!img || !img.dataUrl) { showToast('No image data found', 'error'); return; }

  // Store pending save data for the folder picker
  var fileName = 'AI Image - ' + (img.prompt ? img.prompt.substring(0, 40) : 'Generated') + '.png';
  window.pendingImageLabSave = {
    fileName: fileName,
    dataUrl: img.dataUrl,
    createdAt: img.createdAt || new Date().toISOString(),
    prompt: img.prompt || ''
  };

  // v14.3: Use folder picker modal if available
  var saveModal = document.getElementById('saveLibraryModal');
  if (saveModal) {
    var currentMode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
    window.pendingSaveMode = currentMode;
    window.pendingSaveSource = 'imagelab';
    var fileNameInput = document.getElementById('saveFileName');
    if (fileNameInput) fileNameInput.value = fileName;
    if (typeof renderSaveFolderList === 'function') renderSaveFolderList();
    saveModal.classList.add('open');
  } else {
    // Fallback: save directly to root
    saveImageLabToLibraryDirect(img, fileName);
  }
}

// v14.3: Direct save fallback (no folder picker available)
function saveImageLabToLibraryDirect(img, fileName) {
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var key = 'LifeAI';
  if (mode === 'brand' && typeof brands !== 'undefined' && brands.length > 0) {
    var brandIdx = typeof studioSelectedBrand !== 'undefined' ? studioSelectedBrand : 0;
    key = brands[brandIdx] ? brands[brandIdx].name : 'LifeAI';
  }

  if (typeof fileLibrary === 'undefined') window.fileLibrary = {};
  if (!fileLibrary[key]) {
    fileLibrary[key] = { folders: [{ id: 'root', name: 'Root', parentId: null }], files: [] };
  }
  if (!fileLibrary[key].files) fileLibrary[key].files = [];

  fileLibrary[key].files.push({
    id: 'file_' + Date.now(),
    name: fileName,
    type: 'image/png',
    content: img.dataUrl,
    folderId: 'root',
    createdAt: img.createdAt || new Date().toISOString(),
    metadata: { source: 'image-lab', prompt: img.prompt || '' }
  });

  try { localStorage.setItem('roweos_file_library', JSON.stringify(fileLibrary)); } catch(e) {}
  showToast('Image saved to Library (' + key + ')', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// v21.15: VIDEO LAB
// ═══════════════════════════════════════════════════════════════════════════
var _videoLabChatHistory = [];
var _videoLabChatMessages = [];
var _videoLabChatModel = 'veo-3.1-fast-generate-preview';
var _videoLabChatSending = false;

var VIDEO_MODELS = [
  { id: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast', audio: true },
  { id: 'veo-3.1-generate-preview', label: 'Veo 3.1', audio: true },
  { id: 'veo-3-fast-generate-preview', label: 'Veo 3 Fast', audio: true },
  { id: 'veo-3-generate-preview', label: 'Veo 3', audio: true },
  { id: 'veo-2-generate-preview', label: 'Veo 2', audio: false }
];

function renderAutoLabVideoLab(targetId) {
  var el = document.getElementById(targetId || 'autoLabVideoLab');
  window._videoLabTargetId = targetId || 'autoLabVideoLab';
  if (!el) return;

  var h = '<div style="margin-bottom:16px;">';
  h += '<div class="videolab-subtabs">';
  h += '<button class="active" onclick="showVideoLabSubTab(\'quickgen\', this)">Quick Generate</button>';
  h += '<button onclick="showVideoLabSubTab(\'chat\', this)">Video Chat</button>';
  h += '</div></div>';

  // Quick Generate sub-tab
  h += '<div id="videoLabQuickGen">';
  h += renderVideoLabQuickGenHTML();
  h += '</div>';

  // Video Chat sub-tab
  h += '<div id="videoLabChat" style="display:none;">';
  h += renderVideoLabChatHTML();
  h += '</div>';

  el.innerHTML = h;
  loadVideoLabChatHistory();
}

function showVideoLabSubTab(tab, btn) {
  var quickGen = document.getElementById('videoLabQuickGen');
  var chat = document.getElementById('videoLabChat');
  if (!quickGen || !chat) return;
  quickGen.style.display = tab === 'quickgen' ? 'block' : 'none';
  chat.style.display = tab === 'chat' ? 'block' : 'none';
  // Update tab buttons
  var btns = btn ? btn.parentElement.querySelectorAll('button') : [];
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  if (btn) btn.classList.add('active');
  if (tab === 'chat') renderVideoLabChatThread();
}

function renderVideoLabQuickGenHTML() {
  var h = '';
  // Prompt
  h += '<div style="margin-bottom:12px;">';
  h += '<textarea id="videoLabPrompt" rows="3" placeholder="Describe the video you want to create..." style="width:100%;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-sm);resize:vertical;font-family:inherit;box-sizing:border-box;"></textarea>';
  h += '</div>';

  // Controls row
  h += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;">';
  // Model
  h += '<select id="videoLabModel" style="padding:8px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--text-xs);">';
  for (var i = 0; i < VIDEO_MODELS.length; i++) {
    var m = VIDEO_MODELS[i];
    h += '<option value="' + m.id + '"' + (i === 0 ? ' selected' : '') + '>' + m.label + (m.audio ? ' (Audio)' : '') + '</option>';
  }
  h += '</select>';
  // Duration
  h += '<select id="videoLabDuration" style="padding:8px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--text-xs);">';
  h += '<option value="4">4 seconds</option><option value="6">6 seconds</option><option value="8" selected>8 seconds</option>';
  h += '</select>';
  // Aspect Ratio
  h += '<select id="videoLabAspect" style="padding:8px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--text-xs);">';
  h += '<option value="16:9" selected>16:9 Landscape</option><option value="9:16">9:16 Portrait</option>';
  h += '</select>';
  // Resolution
  h += '<select id="videoLabResolution" style="padding:8px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--text-xs);">';
  h += '<option value="720p" selected>720p</option><option value="1080p">1080p</option>';
  h += '</select>';
  // Generate button
  h += '<button id="videoLabGenBtn" onclick="generateAutoLabVideo()" style="padding:8px 20px;background:var(--accent);color:#000;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;font-size:var(--text-sm);white-space:nowrap;">';
  h += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  h += 'Generate</button>';
  h += '</div>';

  // Reference image upload
  h += '<div style="margin-bottom:16px;">';
  h += '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--text-secondary);font-size:var(--text-xs);">';
  h += '<input type="file" accept="image/*" onchange="handleVideoLabRefUpload(this)" style="display:none;">';
  h += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
  h += 'Add reference image (image-to-video)</label>';
  if (window.videoLabRefImage) {
    h += '<span style="margin-left:8px;color:var(--accent);font-size:var(--text-xs);">' + escapeHtml(window.videoLabRefImage.name || 'Loaded') + ' <button onclick="window.videoLabRefImage=null;renderAutoLabVideoLab(window._videoLabTargetId);" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;">x</button></span>';
  }
  h += '</div>';

  // Progress area (hidden initially)
  h += '<div id="videoLabProgress" style="display:none;"></div>';

  // Output area
  h += '<div id="videoLabOutput"></div>';

  // Gallery
  h += '<div style="margin-top:24px;">';
  h += '<div style="font-weight:600;color:var(--text-primary);margin-bottom:12px;">Generated Videos</div>';
  h += '<div id="videoLabGallery">';
  h += renderVideoLabGalleryHTML();
  h += '</div></div>';

  return h;
}

function renderVideoLabGalleryHTML() {
  var videos = [];
  try { videos = JSON.parse(localStorage.getItem('roweos_auto_lab_videos') || '[]'); } catch(e) {}
  videos.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  if (!videos.length) return '<div style="color:var(--text-muted);font-size:var(--text-sm);">No videos generated yet. Try the Quick Generate above.</div>';

  var h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">';
  for (var i = 0; i < videos.length; i++) {
    var v = videos[i];
    h += '<div class="videolab-gallery-item" style="padding:12px;">';
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">';
    h += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--accent)" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    h += '<span class="duration-badge" style="position:static;background:var(--bg-tertiary);color:var(--text-secondary);">' + (v.duration || '8') + 's</span>';
    h += '<span style="font-size:10px;color:var(--text-muted);margin-left:auto;">' + (v.model || 'veo').split('-')[0] + '</span>';
    h += '</div>';
    h += '<div style="font-size:var(--text-xs);color:var(--text-secondary);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + escapeHtml(v.prompt || 'No prompt') + '</div>';
    h += '<div style="margin-top:8px;font-size:10px;color:var(--text-muted);">' + new Date(v.createdAt).toLocaleDateString() + '</div>';
    h += '<div style="margin-top:8px;display:flex;gap:4px;">';
    h += '<button onclick="regenerateVideoLabVideo(' + i + ')" style="flex:1;padding:4px 8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-size:10px;">Regenerate</button>';
    h += '<button onclick="deleteVideoLabVideo(' + i + ')" style="padding:4px 8px;background:none;border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-muted);cursor:pointer;font-size:10px;">x</button>';
    h += '</div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function handleVideoLabRefUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    var dataUrl = e.target.result;
    var parts = dataUrl.split(',');
    var mimeMatch = parts[0].match(/data:([^;]+)/);
    window.videoLabRefImage = { base64: parts[1], mimeType: mimeMatch ? mimeMatch[1] : 'image/png', name: file.name };
    renderAutoLabVideoLab(window._videoLabTargetId);
    showToast('Reference image loaded', 'success');
  };
  reader.readAsDataURL(file);
}

async function generateAutoLabVideo() {
  var prompt = document.getElementById('videoLabPrompt');
  if (!prompt || !prompt.value.trim()) { showToast('Enter a video prompt', 'error'); return; }

  var model = document.getElementById('videoLabModel');
  var duration = document.getElementById('videoLabDuration');
  var aspect = document.getElementById('videoLabAspect');
  var resolution = document.getElementById('videoLabResolution');
  var btn = document.getElementById('videoLabGenBtn');
  var progressEl = document.getElementById('videoLabProgress');
  var outputEl = document.getElementById('videoLabOutput');

  // Disable UI
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

  // Show progress
  if (progressEl) {
    progressEl.style.display = 'block';
    progressEl.innerHTML = '<div class="videolab-progress">'
      + '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--accent)" stroke-width="2" style="margin-bottom:8px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
      + '<div style="font-weight:500;color:var(--text-primary);margin-bottom:4px;">Generating video...</div>'
      + '<div id="videoLabProgressTime" style="font-size:var(--text-xs);color:var(--text-muted);">Starting...</div>'
      + '<div class="videolab-progress-bar"><div class="videolab-progress-bar-fill"></div></div>'
      + '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">This may take 15 seconds to 3 minutes depending on model and complexity.</div>'
      + '</div>';
  }

  var opts = {
    model: model ? model.value : 'veo-3.1-fast-generate-preview',
    duration: duration ? parseInt(duration.value) : 8,
    aspectRatio: aspect ? aspect.value : '16:9',
    resolution: resolution ? resolution.value : '720p',
    onProgress: function(elapsed, polls) {
      var timeEl = document.getElementById('videoLabProgressTime');
      if (timeEl) timeEl.textContent = 'Elapsed: ' + elapsed + 's (poll ' + polls + ')';
    }
  };
  if (window.videoLabRefImage) {
    opts.referenceImage = { base64: window.videoLabRefImage.base64, mimeType: window.videoLabRefImage.mimeType };
  }

  try {
    var result = await generateVideoWithVeo(prompt.value.trim(), opts);

    // Save to gallery (metadata only — blob URL doesn't persist)
    var videos = [];
    try { videos = JSON.parse(localStorage.getItem('roweos_auto_lab_videos') || '[]'); } catch(e) {}
    videos.push({
      prompt: prompt.value.trim(),
      model: opts.model,
      duration: opts.duration,
      resolution: opts.resolution,
      aspectRatio: opts.aspectRatio,
      generationTime: result.generationTime,
      createdAt: new Date().toISOString()
    });
    // Cap at 50 entries
    if (videos.length > 50) videos = videos.slice(-50);
    try { localStorage.setItem('roweos_auto_lab_videos', JSON.stringify(videos)); } catch(e) {}

    // Show output
    if (progressEl) progressEl.style.display = 'none';
    if (outputEl) {
      outputEl.innerHTML = '<div style="margin-bottom:16px;">'
        + '<video class="videolab-player" src="' + result.videoUrl + '" controls autoplay loop></video>'
        + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">'
        + '<span style="font-size:var(--text-xs);color:var(--text-muted);">' + result.model + ' | ' + result.duration + 's | ' + result.resolution + ' | ' + result.generationTime + 's generation</span>'
        + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:12px;">'
        + '<button onclick="downloadVideoLabOutput()" style="padding:8px 16px;background:var(--accent);color:#000;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;font-size:var(--text-sm);">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
        + 'Download</button>'
        + '</div></div>';
    }
    window._lastVideoResult = result;

    // Refresh gallery
    var gallery = document.getElementById('videoLabGallery');
    if (gallery) gallery.innerHTML = renderVideoLabGalleryHTML();

    showToast('Video generated in ' + result.generationTime + 's', 'success');
  } catch(err) {
    if (progressEl) progressEl.style.display = 'none';
    showToast('Video generation failed: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg> Generate'; }
  }
}

function downloadVideoLabOutput() {
  var result = window._lastVideoResult;
  if (!result || !result.videoBlob) { showToast('No video to download', 'error'); return; }
  var a = document.createElement('a');
  a.href = result.videoUrl;
  a.download = 'roweos-video-' + Date.now() + '.mp4';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function regenerateVideoLabVideo(idx) {
  var videos = [];
  try { videos = JSON.parse(localStorage.getItem('roweos_auto_lab_videos') || '[]'); } catch(e) {}
  videos.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  var v = videos[idx];
  if (!v) return;
  var promptEl = document.getElementById('videoLabPrompt');
  if (promptEl) promptEl.value = v.prompt || '';
  var modelEl = document.getElementById('videoLabModel');
  if (modelEl && v.model) modelEl.value = v.model;
  var durationEl = document.getElementById('videoLabDuration');
  if (durationEl && v.duration) durationEl.value = String(v.duration);
  showToast('Prompt loaded: click Generate to create', 'info');
}

function deleteVideoLabVideo(idx) {
  var videos = [];
  try { videos = JSON.parse(localStorage.getItem('roweos_auto_lab_videos') || '[]'); } catch(e) {}
  videos.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  videos.splice(idx, 1);
  try { localStorage.setItem('roweos_auto_lab_videos', JSON.stringify(videos)); } catch(e) {}
  var gallery = document.getElementById('videoLabGallery');
  if (gallery) gallery.innerHTML = renderVideoLabGalleryHTML();
  showToast('Video entry removed', 'info');
}

// ── Video Lab Chat ──
function renderVideoLabChatHTML() {
  var h = '<div class="videolab-chat-container">';
  // Toolbar
  h += '<div class="videolab-chat-toolbar">';
  h += '<select id="videoLabChatModel" onchange="_videoLabChatModel=this.value;">';
  for (var i = 0; i < VIDEO_MODELS.length; i++) {
    var m = VIDEO_MODELS[i];
    h += '<option value="' + m.id + '"' + (m.id === _videoLabChatModel ? ' selected' : '') + '>' + m.label + '</option>';
  }
  h += '</select>';
  h += '<select id="videoLabChatDuration"><option value="4">4s</option><option value="6">6s</option><option value="8" selected>8s</option></select>';
  h += '<select id="videoLabChatAspect"><option value="16:9" selected>16:9</option><option value="9:16">9:16</option></select>';
  h += '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;color:var(--text-secondary);font-size:var(--text-xs);">';
  h += '<input type="file" accept="image/*" onchange="handleVideoLabChatRefUpload(this)" style="display:none;">';
  h += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg> Ref</label>';
  h += '<button onclick="clearVideoLabChat()" style="margin-left:auto;padding:4px 10px;background:none;border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-muted);cursor:pointer;font-size:var(--text-xs);">Clear</button>';
  h += '</div>';
  // Thread
  h += '<div class="videolab-chat-thread" id="videoLabChatThread"></div>';
  // Input bar
  h += '<div class="videolab-chat-input-bar">';
  h += '<input type="text" id="videoLabChatInput" placeholder="Describe a video to create..." onkeydown="if(event.key===\'Enter\')sendVideoLabMessage();">';
  h += '<button id="videoLabChatSendBtn" onclick="sendVideoLabMessage()" style="padding:8px 16px;background:var(--accent);color:#000;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;font-size:var(--text-sm);">Send</button>';
  h += '</div>';
  h += '</div>';
  return h;
}

function loadVideoLabChatHistory() {
  try {
    var saved = localStorage.getItem('roweos_videolab_chat');
    if (saved) {
      _videoLabChatMessages = JSON.parse(saved);
    }
  } catch(e) { _videoLabChatMessages = []; }
}

function renderVideoLabChatThread() {
  var thread = document.getElementById('videoLabChatThread');
  if (!thread) return;
  if (!_videoLabChatMessages.length) {
    thread.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:var(--text-sm);padding:40px 20px;">'
      + '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.4;"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
      + '<div>Send a prompt to generate a video</div>'
      + '<div style="font-size:var(--text-xs);margin-top:4px;">Videos are generated using Google Veo</div></div>';
    return;
  }
  var h = '';
  for (var i = 0; i < _videoLabChatMessages.length; i++) {
    var msg = _videoLabChatMessages[i];
    h += '<div class="videolab-chat-message ' + (msg.role === 'user' ? 'user' : 'assistant') + '">';
    h += '<div class="videolab-chat-bubble">';
    if (msg.role === 'user') {
      h += escapeHtml(msg.content || '');
      if (msg.hasRefImage) h += '<div style="font-size:11px;margin-top:4px;opacity:0.7;">[Reference image attached]</div>';
    } else {
      if (msg.videoUrl) {
        h += '<video class="videolab-player" src="' + msg.videoUrl + '" controls style="max-width:100%;border-radius:6px;margin-bottom:6px;"></video>';
      } else if (msg._hadVideo) {
        h += '<div style="padding:12px;background:var(--bg-tertiary);border-radius:6px;text-align:center;color:var(--text-muted);font-size:var(--text-xs);">[Video expired: regenerate to view]</div>';
      }
      if (msg.text) h += '<div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px;">' + escapeHtml(msg.text) + '</div>';
      if (msg.generationTime) h += '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">' + msg.model + ' | ' + msg.duration + 's | ' + msg.generationTime + 's</div>';
    }
    h += '</div></div>';
  }
  thread.innerHTML = h;
  thread.scrollTop = thread.scrollHeight;
}

function saveVideoLabChatMessages() {
  // Save display messages only — strip blob URLs (they don't persist)
  var toSave = _videoLabChatMessages.map(function(m) {
    var copy = {};
    for (var k in m) copy[k] = m[k];
    if (copy.videoUrl) {
      copy._hadVideo = true;
      delete copy.videoUrl;
    }
    return copy;
  });
  try { localStorage.setItem('roweos_videolab_chat', JSON.stringify(toSave)); } catch(e) {}
}

async function sendVideoLabMessage() {
  if (_videoLabChatSending) return;
  var input = document.getElementById('videoLabChatInput');
  if (!input || !input.value.trim()) return;
  var text = input.value.trim();
  input.value = '';

  _videoLabChatSending = true;
  var sendBtn = document.getElementById('videoLabChatSendBtn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }

  // Add user message
  var userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
  if (window._videoLabChatRefImages && window._videoLabChatRefImages.length) {
    userMsg.hasRefImage = true;
  }
  _videoLabChatMessages.push(userMsg);
  renderVideoLabChatThread();

  // Build options
  var modelSel = document.getElementById('videoLabChatModel');
  var durSel = document.getElementById('videoLabChatDuration');
  var aspectSel = document.getElementById('videoLabChatAspect');

  var opts = {
    model: modelSel ? modelSel.value : _videoLabChatModel,
    duration: durSel ? parseInt(durSel.value) : 8,
    aspectRatio: aspectSel ? aspectSel.value : '16:9',
    onProgress: function(elapsed) {
      // Update last message to show progress
      var thread = document.getElementById('videoLabChatThread');
      if (thread) {
        var last = thread.lastElementChild;
        if (last && last.classList.contains('assistant')) {
          var bubble = last.querySelector('.videolab-chat-bubble');
          if (bubble) bubble.innerHTML = '<div class="videolab-progress" style="padding:12px;margin:0;"><div style="font-size:var(--text-xs);color:var(--text-muted);">Generating... ' + elapsed + 's</div><div class="videolab-progress-bar"><div class="videolab-progress-bar-fill"></div></div></div>';
        }
      }
    }
  };
  if (window._videoLabChatRefImages && window._videoLabChatRefImages.length) {
    opts.referenceImage = window._videoLabChatRefImages[0];
  }

  // Add placeholder assistant message
  _videoLabChatMessages.push({ role: 'assistant', text: 'Generating...', timestamp: new Date().toISOString() });
  renderVideoLabChatThread();

  try {
    var result = await generateVideoWithVeo(text, opts);

    // Update last assistant message with result
    var lastMsg = _videoLabChatMessages[_videoLabChatMessages.length - 1];
    lastMsg.videoUrl = result.videoUrl;
    lastMsg.text = '';
    lastMsg.model = result.model;
    lastMsg.duration = result.duration;
    lastMsg.generationTime = result.generationTime;

    renderVideoLabChatThread();
    saveVideoLabChatMessages();
    showToast('Video generated in ' + result.generationTime + 's', 'success');
  } catch(err) {
    // Update error in last message
    var errMsg = _videoLabChatMessages[_videoLabChatMessages.length - 1];
    errMsg.text = 'Error: ' + err.message;
    renderVideoLabChatThread();
    saveVideoLabChatMessages();
    showToast('Video generation failed: ' + err.message, 'error');
  } finally {
    _videoLabChatSending = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
  }
}

function handleVideoLabChatRefUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    var dataUrl = e.target.result;
    var parts = dataUrl.split(',');
    var mimeMatch = parts[0].match(/data:([^;]+)/);
    if (!window._videoLabChatRefImages) window._videoLabChatRefImages = [];
    window._videoLabChatRefImages = [{ base64: parts[1], mimeType: mimeMatch ? mimeMatch[1] : 'image/png', name: file.name }];
    showToast('Reference image loaded for video generation', 'success');
  };
  reader.readAsDataURL(file);
}

function clearVideoLabChat() {
  _videoLabChatHistory = [];
  _videoLabChatMessages = [];
  window._videoLabChatRefImages = [];
  try { localStorage.removeItem('roweos_videolab_chat'); } catch(e) {}
  renderVideoLabChatThread();
  showToast('Video Chat cleared', 'info');
}

// v14.3: All Operations searchable grid
function renderAllOperationsGrid() {
  var el = document.getElementById('autoLabAgents');
  if (!el) return;

  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var allOps = mode === 'life' ? (window.lifeOps || []) : (window.ops || []);
  var customOps = [];
  try { customOps = JSON.parse(localStorage.getItem('roweos_custom_operations') || '[]'); } catch(e) {}
  var combined = allOps.concat(customOps);

  // Build category list with counts
  var catCounts = {};
  combined.forEach(function(op) {
    var cat = op.category || 'other';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  var html = '';
  html += '<div style="margin-bottom:16px;">';
  html += '<button class="auto-lab-card-btn" onclick="renderAutoLabAgents()" style="margin-bottom:12px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to Agents';
  html += '</button>';
  html += '<div style="font-size:18px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">All Operations</div>';
  html += '<div style="font-size:13px;color:var(--text-muted);">' + combined.length + ' operations available</div>';
  html += '</div>';

  // Search input
  html += '<div style="margin-bottom:12px;">';
  html += '<input type="text" id="allOpsSearch" placeholder="Search operations..." oninput="filterAllOperationsGrid(this.value)" style="width:100%;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;color:var(--text-primary);font-size:14px;box-sizing:border-box;">';
  html += '</div>';

  // Category chips
  html += '<div id="allOpsCategoryChips" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">';
  html += '<button class="auto-lab-card-btn primary" data-cat="all" onclick="filterAllOpsByCategory(\'all\')" style="font-size:12px;padding:4px 12px;border-radius:20px;">All (' + combined.length + ')</button>';
  var catNames = Object.keys(catCounts).sort();
  catNames.forEach(function(cat) {
    html += '<button class="auto-lab-card-btn" data-cat="' + cat + '" onclick="filterAllOpsByCategory(\'' + escapeHtml(cat) + '\')" style="font-size:12px;padding:4px 12px;border-radius:20px;text-transform:capitalize;">' + cat + ' (' + catCounts[cat] + ')</button>';
  });
  html += '</div>';

  // Operations grid
  html += '<div id="allOpsGrid" class="auto-lab-grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));">';
  combined.forEach(function(op) {
    html += renderOperationCard(op);
  });
  html += '</div>';

  el.innerHTML = html;
}

// v14.3: Render a single operation card
function renderOperationCard(op) {
  var catColors = {
    strategic: '#a78bfa', strategy: '#a78bfa',
    marketing: '#f472b6',
    operations: '#4ade80',
    documents: '#fbbf24', document: '#fbbf24',
    research: '#3b82f6',
    planning: '#8b5cf6',
    development: '#06b6d4',
    wellness: '#22c55e',
    relationships: '#ec4899',
    finances: '#f59e0b',
    taxes: '#ef4444',
    home: '#84cc16',
    creativity: '#a855f7',
    reflection: '#6366f1',
    other: '#6b7280'
  };
  var color = catColors[op.category] || '#6b7280';
  var card = '<div class="auto-lab-card" data-op-name="' + escapeHtml(op.name || '').toLowerCase() + '" data-op-cat="' + escapeHtml(op.category || 'other') + '" style="padding:14px;">';
  card += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
  card += '<div style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;"></div>';
  card += '<div style="font-weight:600;font-size:13px;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(op.name || 'Operation') + '</div>';
  card += '</div>';
  card += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escapeHtml(op.desc || '') + '</div>';
  card += '<div style="display:flex;align-items:center;justify-content:space-between;">';
  card += '<span style="font-size:11px;color:' + color + ';background:' + color + '15;padding:2px 8px;border-radius:10px;text-transform:capitalize;">' + escapeHtml(op.category || 'other') + '</span>';
  card += '<button class="auto-lab-card-btn primary" onclick="runOperationFromGrid(' + op.id + ')" style="font-size:11px;padding:4px 10px;">Run</button>';
  card += '</div>';
  card += '</div>';
  return card;
}

// v14.3: Filter operations by search term
function filterAllOperationsGrid(query) {
  var q = (query || '').toLowerCase().trim();
  var cards = document.querySelectorAll('#allOpsGrid .auto-lab-card');
  cards.forEach(function(card) {
    var name = card.getAttribute('data-op-name') || '';
    var cat = card.getAttribute('data-op-cat') || '';
    if (!q || name.indexOf(q) !== -1 || cat.indexOf(q) !== -1) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// v14.3: Filter operations by category chip
function filterAllOpsByCategory(cat) {
  // Update chip styles
  var chips = document.querySelectorAll('#allOpsCategoryChips button');
  chips.forEach(function(btn) {
    if (btn.getAttribute('data-cat') === cat) {
      btn.className = 'auto-lab-card-btn primary';
    } else {
      btn.className = 'auto-lab-card-btn';
    }
  });

  var cards = document.querySelectorAll('#allOpsGrid .auto-lab-card');
  cards.forEach(function(card) {
    if (cat === 'all' || card.getAttribute('data-op-cat') === cat) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// v14.3: Run operation from all operations grid
function runOperationFromGrid(opId) {
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var allOps = mode === 'life' ? (window.lifeOps || []) : (window.ops || []);
  var customOps = [];
  try { customOps = JSON.parse(localStorage.getItem('roweos_custom_operations') || '[]'); } catch(e) {}
  var combined = allOps.concat(customOps);
  var op = combined.find(function(o) { return o.id === opId; });
  if (op) {
    selectedOp = op;
    showView('studio');
    setTimeout(function() {
      if (typeof renderOperationDetails === 'function') {
        renderOperationDetails(op);
      }
    }, 200);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// END AUTOMATIONS LAB v13.9
// ═══════════════════════════════════════════════════════════════════════════
