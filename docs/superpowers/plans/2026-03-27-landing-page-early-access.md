# Landing Page Overhaul & Early Access Launch - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the auth gate splash with a cinematic welcome screen using the script wordmark, switch from private beta to auto-generated Early Access codes emailed on signup, and update all related branding.

**Architecture:** The existing `#authGate` container gets a new Phase 0 (welcome splash) inserted before the current Phase 1 (old splash becomes Phase 1 with emblem logo). A new `autoGenerateAccessKey()` function fires on new user detection, generates a ROWE-XXXX-XXXX key, saves to Firestore, and emails via the existing Resend API. All changes are in the single `index.html` file.

**Tech Stack:** Vanilla JS (ES5), Firebase Auth + Firestore, Resend email API, CSS animations

**Spec:** `docs/superpowers/specs/2026-03-27-landing-page-early-access-design.md`

---

### Task 1: Add New Welcome Splash Screen (Phase 0)

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:46773-46813` (authGate / authSplash HTML)

- [ ] **Step 1: Insert new Phase 0 welcome splash before current authSplash**

Replace the current `#authSplash` div (lines 46776-46813) with the new cinematic welcome screen. The old splash content (Launch RoweOS / Experience Intelligence cards) moves into `#authLogin` in Task 2.

Find this block:
```html
    <!-- Phase 1: Splash Gateway -->
    <div id="authSplash" style="text-align:center;max-width:480px;padding:40px 32px;position:relative;">
```

Replace the entire `#authSplash` div (from line 46776 through line 46813's closing `</div>`) with:

```html
    <!-- v27.1: Phase 0: Cinematic Welcome Splash -->
    <div id="authSplash" style="text-align:center;position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
      <!-- Breathing ambient gold glow -->
      <div id="splashGlow" style="position:absolute;width:550px;height:550px;background:radial-gradient(circle,rgba(201,181,122,0.09) 0%,transparent 65%);top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;animation:splashBreathe 6s ease-in-out infinite;"></div>
      <!-- Corner accents -->
      <div style="position:absolute;top:32px;left:32px;width:48px;height:48px;border-top:1px solid rgba(201,181,122,0.25);border-left:1px solid rgba(201,181,122,0.25);opacity:0;animation:splashFadeIn 1s ease forwards 0.8s;"></div>
      <div style="position:absolute;bottom:32px;right:32px;width:48px;height:48px;border-bottom:1px solid rgba(201,181,122,0.25);border-right:1px solid rgba(201,181,122,0.25);opacity:0;animation:splashFadeIn 1s ease forwards 1s;"></div>
      <!-- Horizontal gold lines -->
      <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(201,181,122,0.2),transparent);opacity:0;animation:splashFadeIn 1.2s ease forwards 0.6s;"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(201,181,122,0.2),transparent);opacity:0;animation:splashFadeIn 1.2s ease forwards 0.6s;"></div>

      <div style="text-align:center;position:relative;z-index:1;">
        <!-- "WELCOME, TO" -->
        <div style="font-family:'DM Sans',sans-serif;font-size:18px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:rgba(201,181,122,0.45);margin-bottom:20px;opacity:0;animation:splashFadeUp 0.8s ease forwards 0.3s;">Welcome, to</div>
        <!-- Script wordmark -->
        <img src="/icons/roweos-wordmark.png" alt="RoweOS" style="max-width:480px;width:80vw;height:auto;margin-bottom:8px;opacity:0;animation:splashFadeUp 0.9s ease forwards 0.5s;" onerror="this.outerHTML='<div style=&quot;font-family:Cormorant Garamond,Georgia,serif;font-size:82px;font-weight:300;letter-spacing:3px;background:linear-gradient(135deg,#e0cc8a,#c9b57a,#d4b978);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px;&quot;>RoweOS</div>'">
        <!-- Gold divider -->
        <div style="width:48px;height:1px;background:rgba(201,181,122,0.35);margin:0 auto 20px;opacity:0;animation:splashFadeUp 0.6s ease forwards 0.7s;"></div>
        <!-- Tagline -->
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-style:italic;color:rgba(255,255,255,0.3);letter-spacing:0.5px;margin-bottom:48px;opacity:0;animation:splashFadeUp 0.7s ease forwards 0.9s;">Brand & Life Intelligence</div>
        <!-- CTA Button -->
        <a onclick="triggerGoldTransition()" style="display:inline-block;padding:16px 40px;border:1px solid rgba(201,181,122,0.4);border-radius:8px;background:transparent;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:#c9b57a;cursor:pointer;transition:all 0.4s ease;text-decoration:none;opacity:0;animation:splashFadeUp 0.7s ease forwards 1.2s;" onmouseover="this.style.background='rgba(201,181,122,0.08)';this.style.borderColor='rgba(201,181,122,0.6)';this.style.boxShadow='0 0 40px rgba(201,181,122,0.06)'" onmouseout="this.style.background='transparent';this.style.borderColor='rgba(201,181,122,0.4)';this.style.boxShadow='none'">Begin Experience</a>
        <!-- Early Access badge -->
        <div style="margin-top:32px;opacity:0;animation:splashFadeUp 0.6s ease forwards 1.5s;"><span style="padding:4px 14px;border:1px solid rgba(201,181,122,0.2);border-radius:6px;color:rgba(201,181,122,0.5);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-family:'DM Sans',sans-serif;">Early Access</span></div>
      </div>
    </div>

    <!-- Gold transition overlay -->
    <div id="goldTransitionOverlay" style="position:fixed;inset:0;z-index:100001;pointer-events:none;opacity:0;"></div>
```

- [ ] **Step 2: Add CSS keyframes for splash animations**

Find the closing `</style>` tag for the main stylesheet (search for the last `</style>` before `</head>`) and insert these keyframes just before it:

```css
    /* v27.1: Welcome splash animations */
    @keyframes splashBreathe {
      0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
    }
    @keyframes splashFadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes splashFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes splashGoldFlash {
      0% { opacity: 0; }
      15% { opacity: 1; background: radial-gradient(circle at center, rgba(201,181,122,0.25) 0%, rgba(10,10,10,0.95) 70%); }
      40% { opacity: 1; background: radial-gradient(circle at center, rgba(201,181,122,0.15) 0%, rgba(10,10,10,1) 60%); }
      100% { opacity: 1; background: #0a0a0a; }
    }
```

- [ ] **Step 3: Add the gold transition function**

Find `function showAuthLogin()` and insert this new function immediately BEFORE it:

```javascript
// v27.1: Gold transition from welcome splash to auth login
function triggerGoldTransition() {
  var splash = document.getElementById('authSplash');
  var gold = document.getElementById('goldTransitionOverlay');
  var login = document.getElementById('authLogin');

  // Fade out splash content
  splash.style.transition = 'opacity 0.4s ease';
  splash.style.opacity = '0';

  // Fire gold flash
  setTimeout(function() {
    gold.style.pointerEvents = 'all';
    gold.style.animation = 'splashGoldFlash 1.4s ease forwards';
    gold.style.opacity = '1';
  }, 200);

  // Show login screen
  setTimeout(function() {
    splash.style.display = 'none';
    login.style.display = 'block';
    login.style.opacity = '0';
    login.style.transition = 'opacity 0.6s ease';
    setTimeout(function() { login.style.opacity = '1'; }, 50);
  }, 900);

  // Clear gold overlay
  setTimeout(function() {
    gold.style.transition = 'opacity 0.5s ease';
    gold.style.opacity = '0';
    setTimeout(function() {
      gold.style.animation = '';
      gold.style.pointerEvents = 'none';
    }, 500);
  }, 1600);
}
```

- [ ] **Step 4: Verify splash renders correctly**

Open roweos.com locally or check the file. The `#authSplash` should show the wordmark, staggered fade-in animations, and the "Begin Experience" button should trigger the gold transition to the login screen.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add cinematic welcome splash with gold transition animation"
```

---

### Task 2: Update Auth Login Screen (Phase 1) with Emblem Logo

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:46816-46887` (authLogin HTML)

- [ ] **Step 1: Replace logo image in authLogin**

Find this line in the `#authLogin` div:
```html
      <img src="/icons/roweos-logo.png" alt="RoweOS" style="width:180px;margin-bottom:12px;margin-top:16px;position:relative;" onerror="this.style.display='none'">
```

Replace with:
```html
      <img src="/icons/roweos-emblem.png" alt="RoweOS" style="width:120px;height:120px;object-fit:contain;margin-bottom:16px;margin-top:16px;position:relative;filter:brightness(1.1);" onerror="this.style.display='none'">
```

- [ ] **Step 2: Add "Early Access" badge and "Learn More" link to authLogin**

Find the footer div in `#authLogin` (the one starting with `<!-- Footer -->`):
```html
      <!-- Footer -->
      <div class="auth-footer" style="margin-top:36px;
```

Insert this block immediately BEFORE that footer:
```html
      <!-- v27.1: Early Access badge + Learn More -->
      <div style="margin-top:24px;display:flex;align-items:center;justify-content:center;gap:16px;">
        <span style="padding:4px 12px;border:1px solid rgba(201,181,122,0.2);border-radius:6px;color:rgba(201,181,122,0.5);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-family:'DM Sans',sans-serif;">Early Access</span>
        <a href="/info" style="font-size:12px;color:rgba(201,181,122,0.5);text-decoration:none;letter-spacing:0.5px;transition:color 0.2s;" onmouseover="this.style.color='rgba(201,181,122,0.8)'" onmouseout="this.style.color='rgba(201,181,122,0.5)'">Learn More</a>
      </div>
```

- [ ] **Step 3: Update showAuthSplash() to reset splash for re-entry**

Find `function showAuthSplash()` and update it to reset the splash screen when the back button is clicked:

Find:
```javascript
function showAuthSplash() {
```

In the function body, add at the end (before closing `}`):
```javascript
  // v27.1: Reset splash visibility for gold transition re-entry
  var splash = document.getElementById('authSplash');
  if (splash) {
    splash.style.display = 'flex';
    splash.style.opacity = '1';
    splash.style.transition = 'none';
  }
  var gold = document.getElementById('goldTransitionOverlay');
  if (gold) {
    gold.style.opacity = '0';
    gold.style.animation = '';
    gold.style.pointerEvents = 'none';
  }
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: update auth screen with emblem logo and Early Access badge"
```

---

### Task 3: Replace "Private Beta" with "Early Access" Everywhere

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` (multiple locations)

- [ ] **Step 1: Update "Join Private Beta" links**

Find line 46797 (the first "Join Private Beta" link in authSplash). This link is now INSIDE the new splash screen from Task 1 -- it should have been removed when we replaced authSplash. If it's still present, remove it. If it was already removed by Task 1, skip this sub-step.

Find line ~47034 (the second "Join Private Beta" link, on the welcome screen):
```html
      <a href="/info" class="launch-beta-link" style="display:inline-block;margin-top:16px;padding:4px 14px;border:1px solid rgba(168,152,120,0.2);border-radius:6px;color:rgba(168,152,120,0.6);font-size:9px;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;font-weight:400;transition:all 0.3s ease;" onmouseover="this.style.borderColor='rgba(168,152,120,0.5)';this.style.background='rgba(168,152,120,0.06)'" onmouseout="this.style.borderColor='rgba(168,152,120,0.2)';this.style.background='transparent'">Join Private Beta</a>
```

Replace the text `Join Private Beta` with `Early Access`:
```html
      <a href="/info" class="launch-beta-link" style="display:inline-block;margin-top:16px;padding:4px 14px;border:1px solid rgba(168,152,120,0.2);border-radius:6px;color:rgba(168,152,120,0.6);font-size:9px;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;font-weight:400;transition:all 0.3s ease;" onmouseover="this.style.borderColor='rgba(168,152,120,0.5)';this.style.background='rgba(168,152,120,0.06)'" onmouseout="this.style.borderColor='rgba(168,152,120,0.2)';this.style.background='transparent'">Early Access</a>
```

- [ ] **Step 2: Search for any remaining "Private Beta" or "Beta" references in auth/UI text**

Run this search to find remaining instances:
```bash
grep -n "Private Beta\|Join.*Beta\|private beta" /Volumes/roweOS/RoweOS/dist/index.html | head -20
```

Update any UI-facing text from "Private Beta" to "Early Access". Leave code comments and function names (like `generateBetaWelcomeEmail`) as-is -- only change user-visible text.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: replace Private Beta with Early Access branding"
```

---

### Task 4: Auto-Generate Access Key on New User Signup

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:127302-127333` (new user detection in completeFirebaseLogin)

- [ ] **Step 1: Add the key generation function**

Find `function validateAccessKey(` and insert this new function immediately BEFORE it:

```javascript
// v27.1: Auto-generate access key for new users (Early Access)
function autoGenerateAccessKey(user) {
  if (!user || !user.uid || !firebase) return Promise.resolve(null);
  var db = firebase.firestore();
  var uid = user.uid;
  var email = user.email || '';

  // Check if user already has an access key
  return db.doc('roweos_users/' + uid).get().then(function(doc) {
    if (doc.exists && doc.data().accessKey) {
      console.log('[EarlyAccess] User already has key:', doc.data().accessKey);
      return doc.data().accessKey;
    }

    // Generate ROWE-XXXX-XXXX format key
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
    var part1 = '';
    var part2 = '';
    for (var i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    var accessKey = 'ROWE-' + part1 + '-' + part2;
    console.log('[EarlyAccess] Generated key:', accessKey, 'for', email);

    // Write to access_keys collection
    return db.doc('access_keys/' + accessKey).set({
      key: accessKey,
      email: email,
      status: 'active',
      tier: 'solo',
      createdAt: new Date().toISOString(),
      autoGenerated: true,
      usedBy: uid,
      usedAt: new Date().toISOString()
    }).then(function() {
      // Link key to user profile
      return db.doc('roweos_users/' + uid).set({
        accessKey: accessKey,
        accessKeyAutoGenerated: true,
        email: email
      }, { merge: true });
    }).then(function() {
      console.log('[EarlyAccess] Key saved and linked:', accessKey);
      return accessKey;
    });
  }).catch(function(err) {
    console.error('[EarlyAccess] Key generation failed:', err);
    return null;
  });
}
```

- [ ] **Step 2: Add the welcome email sending function**

Insert this function immediately after `autoGenerateAccessKey`:

```javascript
// v27.1: Send Early Access welcome email with access key
function sendEarlyAccessEmail(user, accessKey) {
  if (!user || !accessKey) return;
  var email = user.email;
  if (!email) return;

  // Use existing generateBetaWelcomeEmail template (it will be updated to say Early Access)
  var htmlBody = '';
  if (typeof generateBetaWelcomeEmail === 'function') {
    htmlBody = generateBetaWelcomeEmail(accessKey, 'Solo');
  } else {
    // Minimal fallback
    htmlBody = '<div style="font-family:sans-serif;padding:40px;"><h2>Welcome to RoweOS Early Access</h2><p>Your access key: <strong>' + accessKey + '</strong></p><p>Visit <a href="https://roweos.com">roweos.com</a> to get started.</p></div>';
  }

  fetch('/api/resend-welcome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email,
      subject: 'Welcome to RoweOS Early Access -- Your Access Key',
      from: 'roweos@therowecollection.com',
      html: htmlBody,
      bcc: ['jordan@therowecollection.com'],
      uid: user.uid
    })
  }).then(function(res) {
    if (res.ok) {
      console.log('[EarlyAccess] Welcome email sent to', email);
    } else {
      console.warn('[EarlyAccess] Email send failed:', res.status);
    }
  }).catch(function(err) {
    console.error('[EarlyAccess] Email send error:', err);
  });
}
```

- [ ] **Step 3: Wire auto-generation into new user detection**

Find the new user detection block in `completeFirebaseLogin()` (around line 127308):

```javascript
      if (isNewUser) {
        console.log('[RoweOS] New user detected:', user.email);
```

After the existing `fetch('/api/notify-signup', ...)` block (around line 127331) and BEFORE the closing `}` of the `if (isNewUser)` block, add:

```javascript
        // v27.1: Auto-generate access key and send welcome email
        if (typeof autoGenerateAccessKey === 'function') {
          autoGenerateAccessKey(user).then(function(generatedKey) {
            if (generatedKey) {
              // Send welcome email with key
              sendEarlyAccessEmail(user, generatedKey);
              // Show the access key verification screen
              showAccessKeyVerification(user.email);
            }
          });
        }
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: auto-generate access key and send welcome email on signup"
```

---

### Task 5: Add Inline Access Key Verification Screen

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` (authGate HTML + new JS function)

- [ ] **Step 1: Add verification screen HTML**

Find the `#authGateAccessKey` div (line ~46870):
```html
      <!-- Access key section (preserved) -->
      <div id="authGateAccessKey" style="display:none;margin-top:24px;">
```

Replace the entire `#authGateAccessKey` div (through its closing `</div>` at line ~46875) with:

```html
      <!-- v27.1: Access key verification (shown after signup email is sent) -->
      <div id="authGateAccessKey" style="display:none;margin-top:24px;">
        <div id="accessKeyCheckEmail" style="display:none;text-align:center;margin-bottom:20px;">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#c9b57a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><rect x="2" y="4" width="20" height="16" rx="3"/><polyline points="22,5 12,13 2,5"/></svg>
          <div style="font-family:'DM Sans',sans-serif;font-size:18px;font-weight:600;color:#fff;margin-bottom:8px;">Check Your Email</div>
          <div id="accessKeyEmailHint" style="font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:4px;">We've sent your access key</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:16px;">Enter it below to activate RoweOS</div>
        </div>
        <div class="auth-muted" id="accessKeyDefaultPrompt" style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:16px;">Enter your access key to activate RoweOS</div>
        <input type="text" id="accessKeyInput" placeholder="ROWE-XXXX-XXXX" maxlength="14" style="width:100%;padding:14px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:#fff;font-size:18px;font-weight:600;text-align:center;letter-spacing:3px;text-transform:uppercase;font-family:'SF Mono',Monaco,monospace;outline:none;" oninput="this.value=this.value.toUpperCase()">
        <button onclick="handleAccessKeySubmit()" style="width:100%;padding:14px;background:linear-gradient(135deg,#c9b57a,#d4b978);color:#0a0a0a;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;margin-top:12px;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Activate</button>
        <div id="accessKeyResend" style="display:none;margin-top:12px;">
          <span onclick="resendAccessKeyEmail()" style="font-size:12px;color:rgba(201,181,122,0.5);cursor:pointer;transition:color 0.2s;" onmouseover="this.style.color='rgba(201,181,122,0.8)'" onmouseout="this.style.color='rgba(201,181,122,0.5)'">Didn't receive it? Resend</span>
        </div>
        <div id="accessKeyStatus" class="auth-status" style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:12px;min-height:20px;"></div>
      </div>
```

- [ ] **Step 2: Add the showAccessKeyVerification function**

Find `function handleAccessKeySubmit()` and insert these functions immediately BEFORE it:

```javascript
// v27.1: Show access key verification screen after signup email sent
function showAccessKeyVerification(email) {
  var keySection = document.getElementById('authGateAccessKey');
  var checkEmail = document.getElementById('accessKeyCheckEmail');
  var defaultPrompt = document.getElementById('accessKeyDefaultPrompt');
  var resendLink = document.getElementById('accessKeyResend');
  var emailHint = document.getElementById('accessKeyEmailHint');

  if (keySection) keySection.style.display = 'block';
  if (checkEmail) checkEmail.style.display = 'block';
  if (defaultPrompt) defaultPrompt.style.display = 'none';
  if (resendLink) resendLink.style.display = 'block';
  if (emailHint && email) {
    emailHint.textContent = 'We\'ve sent your access key to ' + email;
  }

  // Hide the sign-in options since user is already authenticated
  var signInSection = document.getElementById('authGateSignIn');
  if (signInSection) signInSection.style.display = 'none';
}

// v27.1: Resend the Early Access welcome email
function resendAccessKeyEmail() {
  if (!firebaseUser) return;
  var resendLink = document.getElementById('accessKeyResend');
  if (resendLink) resendLink.innerHTML = '<span style="font-size:12px;color:rgba(201,181,122,0.5);">Sending...</span>';

  autoGenerateAccessKey(firebaseUser).then(function(key) {
    if (key) {
      sendEarlyAccessEmail(firebaseUser, key);
      if (resendLink) resendLink.innerHTML = '<span style="font-size:12px;color:#22c55e;">Email resent!</span>';
      setTimeout(function() {
        if (resendLink) resendLink.innerHTML = '<span onclick="resendAccessKeyEmail()" style="font-size:12px;color:rgba(201,181,122,0.5);cursor:pointer;">Didn\'t receive it? Resend</span>';
      }, 3000);
    }
  });
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add inline access key verification screen with email check UI"
```

---

### Task 6: Update Email Template to Say "Early Access"

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:133718-133755` (generateBetaWelcomeEmail)

- [ ] **Step 1: Update email template text**

Find `function generateBetaWelcomeEmail(` (line ~133718) and read the entire function. Within the HTML template string:

1. Replace all instances of the text `Beta` with `Early Access` in the email body HTML (not the function name)
2. Replace `Welcome to the RoweOS Beta` (or similar heading) with `Welcome to RoweOS Early Access`
3. Replace any `Private Beta` text with `Early Access`
4. Update the subject reference if present in the template

Use `replace_all` or carefully find each instance. Keep the function name `generateBetaWelcomeEmail` as-is for backward compatibility.

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: update welcome email template to Early Access branding"
```

---

### Task 7: Verify Logo Assets Are Deployed

**Files:**
- Verify: `/Volumes/roweOS/RoweOS/dist/icons/roweos-wordmark.png`
- Verify: `/Volumes/roweOS/RoweOS/dist/icons/roweos-emblem.png`

- [ ] **Step 1: Confirm both logo files exist**

```bash
ls -la /Volumes/roweOS/RoweOS/dist/icons/roweos-wordmark.png /Volumes/roweOS/RoweOS/dist/icons/roweos-emblem.png
```

Both should exist (they were copied during the brainstorming session). If missing, copy them:

```bash
cp "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/RoweOS logo/RoweOS.png" /Volumes/roweOS/RoweOS/dist/icons/roweos-wordmark.png
cp "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/RoweOS logo/PNG high res emblem.png" /Volumes/roweOS/RoweOS/dist/icons/roweos-emblem.png
```

- [ ] **Step 2: Commit the logo assets**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/icons/roweos-wordmark.png RoweOS/dist/icons/roweos-emblem.png && git commit -m "feat: add wordmark and emblem logo assets for new landing page"
```

---

### Task 8: End-to-End Smoke Test

**Files:**
- Test: `/Volumes/roweOS/RoweOS/dist/index.html` (all changes)

- [ ] **Step 1: Verify the full flow visually**

Test the complete flow by checking each screen state:

1. On page load, `#authSplash` shows the wordmark with staggered animations
2. Click "Begin Experience" -- gold transition plays, login screen appears
3. Login screen shows emblem logo, "Early Access" badge, "Learn More" link
4. Back button returns to splash with reset animations
5. No "Private Beta" text visible anywhere in auth flow

- [ ] **Step 2: Verify auto-key generation code is syntactically correct**

Search for any obvious syntax issues:
```bash
grep -c "function autoGenerateAccessKey" /Volumes/roweOS/RoweOS/dist/index.html
grep -c "function sendEarlyAccessEmail" /Volumes/roweOS/RoweOS/dist/index.html
grep -c "function showAccessKeyVerification" /Volumes/roweOS/RoweOS/dist/index.html
grep -c "function triggerGoldTransition" /Volumes/roweOS/RoweOS/dist/index.html
```

Each should return `1`.

- [ ] **Step 3: Search for any remaining "Private Beta" in user-facing text**

```bash
grep -n "Private Beta\|Join.*Beta" /Volumes/roweOS/RoweOS/dist/index.html | grep -v "^.*//\|^.*\*\|function\|var " | head -20
```

Should return no user-facing matches. Code comments and function names are fine.

- [ ] **Step 4: Final commit with all changes**

If any fixups were needed, commit them:
```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: landing page overhaul cleanup and verification"
```
