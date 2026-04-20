# Google for Startups Promo Content - Implementation Plan (Revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create promotional content across 5 surfaces to announce RoweOS acceptance into the Google for Startups Cloud Program. The primary deliverable is `social3.html` -- a standalone Content Studio page at `roweos.com/social3` with ~48 templates and 2 animated pages.

**Architecture:** `social3.html` replicates `social2.html`'s template engine verbatim (`var templates = []`, `cardWrap()`, `watermark()`, `goldText()`, `screenshotFrame()`, `logoMark()`, `featureIcon()`, `checkIcon()` helpers + `html2canvas` + `JSZip` for PNG export). Two new helpers (`googleLogo()`, `backedBadge()`) and two device frame helpers (`macbookFrame()`, `iphoneFrame()`) are added. Templates span 4 categories: announcement carousel (6 slides), feature carousels (4 sets x 3 slides), social hooks (5 slides), and animated HTML pages (2 sequences).

**Tech Stack:** Vanilla HTML/CSS/JS (ES5 only), html2canvas CDN, JSZip CDN, Next.js (The Rowe Collection only)

**Design Language:**
- Dark mode: `#0a0a0a` bg, `#ece4d8` text, gold `#b2997b`
- Light mode: `#ffffff` bg, `#1a1a1a` text
- Fonts: Cormorant Garamond (headlines), DM Sans (body)
- Google multicolor ONLY on the word "Google" itself -- never bleeds into RoweOS design
- No one-sided borders. No emoji. SVG icons only.
- Card dimensions: 1080x1350 (standard social post)

**Already Completed (from prior session):**
- Vercel route `/social3` already in `RoweOS/dist/vercel.json` (line 25)
- The Rowe Collection badge already on `/roweos` page (lines 71-86 of `page.tsx`)
- RoweOS app launch screen badge already in `03-views-batch2.html` (line 109-111)
- Google logo asset already at `RoweOS/dist/images/promo/google-for-startups.png`
- The Rowe Collection logo at `the-rowe-collection/public/images/google-for-startups.png`

---

## File Map

| File | Action | Status |
|------|--------|--------|
| `RoweOS/dist/social3.html` | Create | **Remaining** |
| `RoweOS/dist/vercel.json` | Edit (add route) | Done |
| `RoweOS/dist/images/promo/google-for-startups.png` | Need asset | Done |
| `the-rowe-collection/src/app/roweos/page.tsx` | Edit (add badge) | Done |
| `the-rowe-collection/public/images/google-for-startups.png` | Copy asset | Done |
| `roweOS/src/html/core/03-views-batch2.html` | Edit (launch badge) | Done |

---

## Screenshot Assets (all from `/images/desktop/`)

| File | Used In |
|------|---------|
| `chat_brandAI.png` | Announcement 2, 3; Chat carousel |
| `studi_brandAI.png` | Studio carousel |
| `focus_brandAI.png` | Announcement 4; Focus carousel |
| `full_screen_brandAI.png` | Announcement 2; Studio carousel |
| `analytics_brandAI.png` | Focus carousel |
| `adaptive_brandAI.png` | Automations carousel; Animation 2 |

---

### Task 1: social3.html - Page Shell, CSS, Layout, Template Engine

**Files:**
- Create: `RoweOS/dist/social3.html`

This task creates the entire page: HTML shell, all CSS, sidebar/grid/preview layout, template engine (helpers + rendering + download), and theme toggle. Templates are empty at this point (added in Tasks 2-5).

- [ ] **Step 1: Create social3.html with the complete shell and engine**

Create the file at `RoweOS/dist/social3.html`. The structure follows `social2.html` exactly. Below is the complete file skeleton. Every function body is copied from social2.html unless otherwise noted.

**HTML Head (lines 1-11):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RoweOS - Content Studio: Google for Startups</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/png" href="/favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

**CSS (copy social2.html lines 12-112 verbatim)** -- the entire `<style>` block including:
- Reset, `:root` dark/light custom properties
- Top bar, layout, sidebar, grid, post-card, preview modal, hidden render, progress bar, responsive, mobile controls
- No changes to CSS variables or selectors

Then add these animation keyframes **before** `</style>`:
```css
/* ANIMATED PAGE STYLES */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes typeIn { from { width: 0; } to { width: 100%; } }
@keyframes scaleDown { from { transform: scale(1); } to { transform: scale(0.6); } }
@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes countUp { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
.anim-fade { animation: fadeIn 1.5s ease forwards; }
.anim-fade-up { animation: fadeInUp 1s ease forwards; }
.anim-slide-right { animation: slideInRight 0.8s ease forwards; }
.anim-count { animation: countUp 0.5s ease forwards; }
```

**HTML Body -- Top Bar:**
```html
<body>
<div class="top-bar">
<div class="top-bar-inner">
<div class="top-bar-left">
<img class="top-bar-logo" src="/images/logo-full.png" alt="RoweOS">
<div class="top-bar-divider"></div>
<span class="top-bar-title">Content Studio - Google for Startups</span>
</div>
<div class="top-bar-right">
<button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
</button>
</div>
</div>
</div>
```

**HTML Body -- Mobile filter, Sidebar, Grid, Preview, Render Container, Progress Bar:**
Copy from social2.html lines 133-197 verbatim. No changes.

**Script block -- Configuration and Categories:**
```javascript
<script>
/* ============================================
   ROWEOS CONTENT STUDIO - GOOGLE FOR STARTUPS
   ============================================ */

// --- CONFIGURATION ---
var CARD_W = 1080, CARD_H = 1350;
var IMG_BASE = '/images/desktop/';
var currentFilter = 'all';
var currentMode = 'all';
var previewIdx = -1;

// --- CATEGORIES ---
var CATEGORIES = [
  { id: 'all', label: 'All Templates' },
  { id: 'announcement', label: 'Announcement Carousel' },
  { id: 'feature-chat', label: 'Feature: Chat' },
  { id: 'feature-studio', label: 'Feature: Studio' },
  { id: 'feature-focus', label: 'Feature: Focus' },
  { id: 'feature-automations', label: 'Feature: Automations' },
  { id: 'social-hooks', label: 'Social Hooks' },
  { id: 'animated', label: 'Animated Pages' }
];
```

**Logo image paths:**
```javascript
// --- LOGO IMAGE PATHS ---
var LOGO_ICON_DARK = '/images/promo/logo-icon-dark.png';
var LOGO_ICON_LIGHT = '/images/promo/logo-icon.png';
var LOGO_WORDMARK = '/images/promo/logo-wordmark.png';
var GOOGLE_LOGO = '/images/promo/google-for-startups.png';

function logoIcon(mode, size) {
  return '<img src="' + LOGO_ICON_DARK + '" style="width:' + (size || 80) + 'px;height:' + (size || 80) + 'px;border-radius:18%;object-fit:cover;" crossorigin="anonymous" />';
}
```

**Existing helpers (copy from social2.html verbatim):**
- `cardWrap(mode, inner)` -- lines 242-258 of social2.html
- `watermark(mode)` -- lines 261-264
- `goldText(mode, text, size, weight, extra)` -- lines 267-270
- `screenshotFrame(src, mode, opts)` -- lines 273-283
- `logoMark(mode, size)` -- lines 286-291 (uses LOGO_WORDMARK image version from social2, not the text version from social.html)
- `checkIcon(mode)` -- lines 294-297
- `featureIcon(name, mode)` -- lines 300-318 (full icon map)

**New helpers:**
```javascript
// --- HELPER: GOOGLE LOGO IMAGE ---
function googleLogo(width) {
  return '<img src="' + GOOGLE_LOGO + '" style="width:' + (width || 200) + 'px;height:auto;" crossorigin="anonymous" />';
}

// --- HELPER: GOOGLE COLORED TEXT ---
function googleText(size) {
  var s = size || 32;
  return '<span style="font-size:' + s + 'px;font-weight:400;font-family:var(--sans);">'
    + '<span style="color:#4285F4;">G</span>'
    + '<span style="color:#EA4335;">o</span>'
    + '<span style="color:#FBBC05;">o</span>'
    + '<span style="color:#34A853;">g</span>'
    + '<span style="color:#EA4335;">l</span>'
    + '<span style="color:#4285F4;">e</span>'
    + '</span>';
}

// --- HELPER: "BACKED BY GOOGLE" BADGE ---
function backedBadge(mode) {
  var border = mode === 'dark' ? 'rgba(178,153,123,0.2)' : 'rgba(0,0,0,0.12)';
  var color = mode === 'dark' ? '#b2997b' : '#8b7b67';
  return '<div style="display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border:1px solid ' + border + ';border-radius:20px;font-size:13px;color:' + color + ';letter-spacing:0.05em;">'
    + '<span>Backed by </span>' + googleText(14)
    + '</div>';
}
```

**Device frame helpers:**
```javascript
// --- HELPER: MACBOOK FRAME ---
function macbookFrame(content, mode, opts) {
  opts = opts || {};
  var w = opts.width || '85%';
  var screenBg = mode === 'dark' ? 'linear-gradient(135deg, #151515, #1a1a1a)' : 'linear-gradient(135deg, #f5f5f5, #eee)';
  var frameBorder = mode === 'dark' ? '#333' : '#ccc';
  var barBg = mode === 'dark' ? 'linear-gradient(180deg, #2a2a2a, #1e1e1e)' : 'linear-gradient(180deg, #e5e5e5, #d5d5d5)';
  var baseBg = mode === 'dark' ? 'linear-gradient(180deg, #3a3a3a, #2a2a2a)' : 'linear-gradient(180deg, #d5d5d5, #c5c5c5)';
  return '<div style="width:' + w + ';margin:12px auto;position:relative;">'
    + '<div style="background:' + screenBg + ';border-radius:6px 6px 0 0;border:2px solid ' + frameBorder + ';border-bottom:none;aspect-ratio:16/10;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;">'
    + '<div style="position:absolute;top:0;left:0;right:0;height:16px;background:' + barBg + ';border-bottom:1px solid ' + frameBorder + ';z-index:1;"></div>'
    + '<div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:60px;height:12px;background:' + barBg + ';border-radius:0 0 8px 8px;border:1px solid ' + frameBorder + ';border-top:none;z-index:2;"></div>'
    + content
    + '</div>'
    + '<div style="height:8px;background:' + baseBg + ';border-radius:0 0 2px 2px;position:relative;">'
    + '<div style="position:absolute;bottom:-4px;left:25%;right:25%;height:4px;background:' + (mode === 'dark' ? '#2a2a2a' : '#c5c5c5') + ';border-radius:0 0 8px 8px;"></div>'
    + '</div></div>';
}

// --- HELPER: IPHONE FRAME ---
function iphoneFrame(content, mode, opts) {
  opts = opts || {};
  var w = opts.width || '36%';
  var bodyBg = mode === 'dark' ? '#1a1a1a' : '#f0f0f0';
  var frameBorder = mode === 'dark' ? '#333' : '#ccc';
  var screenBg = mode === 'dark' ? 'linear-gradient(135deg, #151515, #1a1a1a)' : 'linear-gradient(135deg, #fff, #f8f8f8)';
  var barColor = mode === 'dark' ? '#555' : '#999';
  return '<div style="width:' + w + ';margin:8px auto;position:relative;">'
    + '<div style="background:' + bodyBg + ';border-radius:20px;border:2px solid ' + frameBorder + ';padding:8px 4px;position:relative;">'
    + '<div style="background:' + screenBg + ';border-radius:14px;aspect-ratio:9/19.5;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;">'
    + '<div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);width:70px;height:18px;background:' + bodyBg + ';border-radius:0 0 12px 12px;z-index:2;"></div>'
    + content
    + '<div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:50%;height:3px;background:' + barColor + ';border-radius:3px;"></div>'
    + '</div></div></div>';
}
```

**Templates array (empty -- populated in Tasks 2-5):**
```javascript
// --- TEMPLATES (added by Tasks 2-5) ---
var templates = [];
```

**Rendering engine (copy from social2.html verbatim with noted changes):**
- `getVisibleTemplates()` -- identical to social2.html lines 2566-2572
- `renderGrid()` -- identical to social2.html lines 2574-2642
- `renderSidebar()` -- identical to social2.html lines 2646-2675
- `setFilter(catId)` -- identical to social2.html lines 2677-2681
- `setModeFilter(mode)` -- identical to social2.html lines 2683-2690
- `openPreview(idx)` -- identical to social2.html lines 2694-2721
- `closePreview()` -- identical to social2.html lines 2723-2727
- `rasterizeSvgs(container)` -- identical to social2.html lines 2732-2773
- `renderToCanvas(idx)` -- identical to social2.html lines 2775-2855

**Download functions (minor changes):**
- `downloadTemplate(idx)` -- change filename prefix from `RoweOS_S2_` to `RoweOS_GFS_`
- `downloadCurrent()` -- identical
- `downloadAll()` -- change ZIP filename from `RoweOS_Social_S2.zip` to `RoweOS_Google_Startups.zip`

**Theme (key change):**
```javascript
function toggleTheme() {
  document.documentElement.classList.toggle('light-mode');
  localStorage.setItem('roweos-social3-theme', document.documentElement.classList.contains('light-mode') ? 'light' : 'dark');
}

(function initTheme() {
  var saved = localStorage.getItem('roweos-social3-theme');
  if (saved === 'light') {
    document.documentElement.classList.add('light-mode');
  } else if (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.classList.add('light-mode');
  }
})();
```

**Init and keyboard:**
```javascript
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closePreview();
});

renderSidebar();
renderGrid();

var resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderGrid, 200);
});
</script>
</body>
</html>
```

**CRITICAL ES5 RULES:** No `let`/`const`, no arrow functions (`=>`), no template literals (backticks). Use `var`, `function(){}`, and string concatenation (`+`).

- [ ] **Step 2: Verify the page loads**

```bash
open /Users/jordanrowe/Developer/roweOS/RoweOS/dist/social3.html
```

Expected: Page loads with top bar reading "Content Studio - Google for Startups", sidebar with 8 categories, empty grid showing "0 templates", dark/light toggle works. No console errors.

**Commit:** `feat(social3): scaffold social3.html shell with template engine for Google for Startups promo`

---

### Task 2: Announcement Carousel Templates (6 slides x 2 modes = 12 templates)

**Files:**
- Modify: `RoweOS/dist/social3.html` (add templates to the `templates` array)

Add an IIFE block immediately after the `var templates = [];` line. Each slide has dark + light variants.

- [ ] **Step 1: Add announcement carousel templates**

Insert after `var templates = [];`:

```javascript
// --- ANNOUNCEMENT CAROUSEL (6 slides x dark/light) ---
(function() {
  var modes = ['dark', 'light'];
  modes.forEach(function(mode) {
    var suffix = mode === 'dark' ? '' : ' (Light)';
    var dim = mode === 'dark' ? '#655e54' : '#8a857e';
    var text = mode === 'dark' ? '#ece4d8' : '#1a1a1a';

    // Slide 1: Hero - App Icon + "Backed by Google"
    templates.push({
      id: 'ann-1-' + mode, category: 'announcement', mode: mode,
      label: 'Announcement 1: Backed by Google' + suffix,
      render: function() {
        return cardWrap(mode,
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:80px;">'
          + logoIcon(mode, 96)
          + '<div style="height:40px;"></div>'
          + '<div style="font-family:var(--serif);font-size:72px;font-weight:300;color:' + text + ';line-height:1.2;text-align:center;">Backed by<br>' + googleText(72) + '</div>'
          + '<div style="width:60px;height:1px;background:var(--c-g3);margin:32px auto;opacity:0.4;"></div>'
          + '<div style="font-size:18px;color:' + dim + ';letter-spacing:0.15em;text-transform:uppercase;">Google for Startups Cloud Program</div>'
          + '</div>'
        );
      }
    });

    // Slide 2: MacBook + iPhone - "What is RoweOS?"
    templates.push({
      id: 'ann-2-' + mode, category: 'announcement', mode: mode,
      label: 'Announcement 2: What is RoweOS' + suffix,
      render: function() {
        var screenshot = IMG_BASE + 'full_screen_brandAI.png';
        var mobileShot = IMG_BASE + 'chat_brandAI.png';
        return cardWrap(mode,
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 40px;">'
          + '<div style="font-size:16px;color:' + dim + ';letter-spacing:0.2em;text-transform:uppercase;margin-bottom:16px;">What is RoweOS?</div>'
          + '<div style="font-family:var(--serif);font-size:44px;font-weight:300;color:' + text + ';line-height:1.3;text-align:center;margin-bottom:24px;">Operating intelligence,<br>built for brands.</div>'
          + '<div style="display:flex;align-items:flex-end;justify-content:center;gap:16px;width:95%;margin:8px auto;">'
          + macbookFrame('<img src="' + screenshot + '" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:0;" crossorigin="anonymous">', mode, {width:'62%'})
          + iphoneFrame('<img src="' + mobileShot + '" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:0;" crossorigin="anonymous">', mode, {width:'20%'})
          + '</div>'
          + '<div style="font-size:16px;color:var(--c-muted);margin-top:12px;">Desktop and mobile. One platform.</div>'
          + '</div>'
        );
      }
    });

    // Slide 3: iPhone Chat - "AI agents that learn your voice"
    templates.push({
      id: 'ann-3-' + mode, category: 'announcement', mode: mode,
      label: 'Announcement 3: Brand Intelligence' + suffix,
      render: function() {
        var chatShot = IMG_BASE + 'chat_brandAI.png';
        return cardWrap(mode,
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 40px;">'
          + '<div style="font-size:16px;color:' + dim + ';letter-spacing:0.2em;text-transform:uppercase;margin-bottom:16px;">Brand Intelligence</div>'
          + '<div style="font-family:var(--serif);font-size:44px;font-weight:300;color:' + text + ';line-height:1.3;text-align:center;margin-bottom:16px;">AI agents that<br>learn your voice.</div>'
          + iphoneFrame('<img src="' + chatShot + '" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:0;" crossorigin="anonymous">', mode, {width:'44%'})
          + '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px;">'
          + '<span style="padding:5px 14px;border-radius:16px;font-size:13px;background:rgba(167,139,250,0.15);color:#a78bfa;">Strategy</span>'
          + '<span style="padding:5px 14px;border-radius:16px;font-size:13px;background:rgba(244,114,182,0.15);color:#f472b6;">Marketing</span>'
          + '<span style="padding:5px 14px;border-radius:16px;font-size:13px;background:rgba(74,222,128,0.15);color:#4ade80;">Ops</span>'
          + '<span style="padding:5px 14px;border-radius:16px;font-size:13px;background:rgba(251,191,36,0.15);color:#fbbf24;">Docs</span>'
          + '</div>'
          + '</div>'
        );
      }
    });

    // Slide 4: MacBook Automations - "Set it. Forget it."
    templates.push({
      id: 'ann-4-' + mode, category: 'announcement', mode: mode,
      label: 'Announcement 4: Automation' + suffix,
      render: function() {
        var autoShot = IMG_BASE + 'focus_brandAI.png';
        return cardWrap(mode,
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 40px;">'
          + '<div style="font-size:16px;color:' + dim + ';letter-spacing:0.2em;text-transform:uppercase;margin-bottom:16px;">Automation</div>'
          + '<div style="font-family:var(--serif);font-size:44px;font-weight:300;color:' + text + ';line-height:1.3;text-align:center;margin-bottom:16px;">Set it. Forget it.</div>'
          + macbookFrame('<img src="' + autoShot + '" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:0;" crossorigin="anonymous">', mode, {width:'90%'})
          + '<div style="font-size:16px;color:var(--c-muted);margin-top:16px;max-width:500px;text-align:center;">Scheduled tasks and multi-step pipelines that run while you sleep.</div>'
          + '</div>'
        );
      }
    });

    // Slide 5: Feature list stats
    templates.push({
      id: 'ann-5-' + mode, category: 'announcement', mode: mode,
      label: 'Announcement 5: Features' + suffix,
      render: function() {
        var features = [
          { dot: '#a78bfa', label: '6 AI Agents', desc: 'that learn your brand' },
          { dot: '#f472b6', label: 'Automations', desc: 'that run 24/7' },
          { dot: '#4ade80', label: 'Multi-brand', desc: 'portfolio management' },
          { dot: '#fbbf24', label: 'Content Studio', desc: 'for instant creation' },
          { dot: '#22d3ee', label: 'Identity Memory', desc: 'that never forgets' },
          { dot: '#b2997b', label: 'Desktop and Mobile', desc: 'everywhere you are' }
        ];
        var listHtml = '';
        features.forEach(function(f) {
          var borderColor = mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
          listHtml += '<div style="display:flex;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid ' + borderColor + ';">'
            + '<div style="width:8px;height:8px;border-radius:50%;background:' + f.dot + ';flex-shrink:0;"></div>'
            + '<div style="font-size:18px;color:var(--c-muted);"><strong style="color:' + text + ';font-weight:500;">' + f.label + '</strong> ' + f.desc + '</div>'
            + '</div>';
        });
        return cardWrap(mode,
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:80px 100px;">'
          + '<div style="font-size:16px;color:' + dim + ';letter-spacing:0.2em;text-transform:uppercase;margin-bottom:20px;">Everything you need</div>'
          + '<div style="font-family:var(--serif);font-size:44px;font-weight:300;color:' + text + ';line-height:1.3;text-align:center;margin-bottom:40px;">One platform.<br>Total intelligence.</div>'
          + '<div style="width:100%;">' + listHtml + '</div>'
          + '</div>'
        );
      }
    });

    // Slide 6: CTA - "Join the Beta"
    templates.push({
      id: 'ann-6-' + mode, category: 'announcement', mode: mode,
      label: 'Announcement 6: CTA' + suffix,
      render: function() {
        return cardWrap(mode,
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:80px;">'
          + '<div style="font-size:16px;color:' + dim + ';letter-spacing:0.2em;text-transform:uppercase;margin-bottom:40px;">Now in Beta</div>'
          + logoIcon(mode, 80)
          + '<div style="height:32px;"></div>'
          + '<div style="font-family:var(--serif);font-size:60px;font-weight:300;color:' + text + ';margin-bottom:12px;">Join the Beta.</div>'
          + '<div style="color:var(--c-g3);font-size:24px;letter-spacing:0.1em;margin-bottom:40px;">roweos.com</div>'
          + backedBadge(mode)
          + '</div>'
        );
      }
    });
  });
})();
```

- [ ] **Step 2: Verify in browser**

Open social3.html. "Announcement Carousel" category should show 12 templates (6 dark + 6 light). Click each to verify the render is correct in preview. Verify:
- Slide 1: Logo centered, "Backed by Google" with colored G-o-o-g-l-e
- Slide 2: MacBook + iPhone side by side with screenshots loading
- Slide 3: iPhone frame with Chat screenshot, agent pills below
- Slide 4: MacBook frame with Focus screenshot
- Slide 5: Feature list with colored dots
- Slide 6: CTA with "Join the Beta" and backed badge

**Commit:** `feat(social3): add announcement carousel templates (12)`

---

### Task 3: Feature Carousel Templates (4 sets x 3 slides x 2 modes = 24 templates)

**Files:**
- Modify: `RoweOS/dist/social3.html` (append to templates array)

- [ ] **Step 1: Add feature carousel templates**

Append after the announcement IIFE:

```javascript
// --- FEATURE CAROUSELS (4 features x 3 slides x dark/light) ---
(function() {
  var featureSets = [
    {
      catId: 'feature-chat', name: 'Chat',
      shot1: IMG_BASE + 'chat_brandAI.png',
      shot2: IMG_BASE + 'full_screen_brandAI.png',
      headline1: 'Your AI.<br>Your voice.',
      sub1: 'Same question. Different brand. Different tone.',
      headline2: 'Same content.<br>Two brands.<br>Two voices.',
      sub2: 'RoweOS adapts to each brand\'s identity automatically.'
    },
    {
      catId: 'feature-studio', name: 'Studio',
      shot1: IMG_BASE + 'studi_brandAI.png',
      shot2: IMG_BASE + 'full_screen_brandAI.png',
      headline1: 'One-click<br>content.',
      sub1: 'Studio operations that generate on-brand output instantly.',
      headline2: 'From idea<br>to polished output.',
      sub2: '50+ operations across strategy, marketing, ops, and docs.'
    },
    {
      catId: 'feature-focus', name: 'Focus',
      shot1: IMG_BASE + 'focus_brandAI.png',
      shot2: IMG_BASE + 'analytics_brandAI.png',
      headline1: 'Your command<br>center.',
      sub1: 'Calendar, tasks, streaks, and automations in one view.',
      headline2: 'Intelligence<br>at a glance.',
      sub2: 'Everything about your brand, always within reach.'
    },
    {
      catId: 'feature-automations', name: 'Automations',
      shot1: IMG_BASE + 'adaptive_brandAI.png',
      shot2: IMG_BASE + 'focus_brandAI.png',
      headline1: 'Set it.<br>Forget it.',
      sub1: 'Scheduled tasks and multi-step pipelines that run 24/7.',
      headline2: 'Multi-step<br>workflows.',
      sub2: 'Chain operations together into powerful automated pipelines.'
    }
  ];

  var modes = ['dark', 'light'];

  featureSets.forEach(function(feat) {
    modes.forEach(function(mode) {
      var suffix = mode === 'dark' ? '' : ' (Light)';
      var text = mode === 'dark' ? '#ece4d8' : '#1a1a1a';

      // Slide 1: iPhone with feature
      templates.push({
        id: feat.catId + '-1-' + mode, category: feat.catId, mode: mode,
        label: feat.name + ' 1: Hero' + suffix,
        render: function() {
          return cardWrap(mode,
            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 40px;">'
            + backedBadge(mode)
            + '<div style="height:24px;"></div>'
            + '<div style="font-family:var(--serif);font-size:48px;font-weight:300;color:' + text + ';line-height:1.2;text-align:center;margin-bottom:16px;">' + feat.headline1 + '</div>'
            + iphoneFrame('<img src="' + feat.shot1 + '" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:0;" crossorigin="anonymous">', mode, {width:'44%'})
            + '<div style="font-size:16px;color:var(--c-muted);margin-top:12px;text-align:center;">' + feat.sub1 + '</div>'
            + '</div>'
          );
        }
      });

      // Slide 2: Side-by-side iPhones
      templates.push({
        id: feat.catId + '-2-' + mode, category: feat.catId, mode: mode,
        label: feat.name + ' 2: Detail' + suffix,
        render: function() {
          return cardWrap(mode,
            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 40px;">'
            + '<div style="display:flex;gap:12px;width:85%;justify-content:center;">'
            + iphoneFrame('<img src="' + feat.shot1 + '" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:0;" crossorigin="anonymous">', mode, {width:'48%'})
            + iphoneFrame('<img src="' + feat.shot2 + '" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:0;" crossorigin="anonymous">', mode, {width:'48%'})
            + '</div>'
            + '<div style="font-family:var(--serif);font-size:36px;font-weight:300;color:' + text + ';margin-top:20px;text-align:center;line-height:1.3;">' + feat.headline2 + '</div>'
            + '<div style="font-size:16px;color:var(--c-muted);margin-top:10px;text-align:center;">' + feat.sub2 + '</div>'
            + '</div>'
          );
        }
      });

      // Slide 3: CTA with Google badge
      templates.push({
        id: feat.catId + '-3-' + mode, category: feat.catId, mode: mode,
        label: feat.name + ' 3: CTA' + suffix,
        render: function() {
          return cardWrap(mode,
            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:80px;">'
            + logoIcon(mode, 64)
            + '<div style="height:28px;"></div>'
            + '<div style="font-family:var(--serif);font-size:48px;font-weight:300;color:' + text + ';margin-bottom:10px;">Try it yourself.</div>'
            + '<div style="color:var(--c-g3);font-size:22px;letter-spacing:0.1em;margin-bottom:32px;">roweos.com</div>'
            + backedBadge(mode)
            + '</div>'
          );
        }
      });
    });
  });
})();
```

- [ ] **Step 2: Verify in browser**

Each feature category (Chat, Studio, Focus, Automations) should show 6 templates (3 dark + 3 light). Running total: 36 templates.

**Commit:** `feat(social3): add feature carousel templates (24)`

---

### Task 4: Social Hooks Templates (5 hooks x 2 modes = 10 templates)

**Files:**
- Modify: `RoweOS/dist/social3.html` (append to templates array)

- [ ] **Step 1: Add social hooks templates**

Append after the feature carousel IIFE:

```javascript
// --- SOCIAL HOOKS (5 hooks x dark/light) ---
(function() {
  var hooks = [
    { text: 'Backed by GOOGLE_PLACEHOLDER.<br>Built for brands.', id: 'backed' },
    { text: 'Your brand deserves<br>its own AI.', id: 'deserves' },
    { text: 'We didn\'t raise funding.<br>GOOGLE_PLACEHOLDER chose us.', id: 'chose' },
    { text: 'Operating intelligence,<br>backed by GOOGLE_PLACEHOLDER.', id: 'intel' },
    { text: 'The AI platform<br>GOOGLE_PLACEHOLDER believes in.', id: 'believes' }
  ];

  var modes = ['dark', 'light'];
  modes.forEach(function(mode) {
    var suffix = mode === 'dark' ? '' : ' (Light)';
    var text = mode === 'dark' ? '#ece4d8' : '#1a1a1a';
    var dim = mode === 'dark' ? '#655e54' : '#8a857e';

    hooks.forEach(function(hook) {
      templates.push({
        id: 'hook-' + hook.id + '-' + mode, category: 'social-hooks', mode: mode,
        label: 'Hook: ' + hook.id.charAt(0).toUpperCase() + hook.id.slice(1) + suffix,
        render: function() {
          var displayText = hook.text.replace(/GOOGLE_PLACEHOLDER/g, googleText(72));
          return cardWrap(mode,
            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:80px 60px;">'
            + '<div style="font-family:var(--serif);font-size:72px;font-weight:300;color:' + text + ';line-height:1.15;text-align:center;">' + displayText + '</div>'
            + '<div style="width:60px;height:1px;background:var(--c-g3);margin:40px auto;opacity:0.4;"></div>'
            + '<div style="display:flex;align-items:center;gap:12px;">'
            + logoIcon(mode, 40)
            + '<span style="font-size:20px;color:' + dim + ';letter-spacing:0.08em;">roweos.com</span>'
            + '</div>'
            + '</div>'
          );
        }
      });
    });
  });
})();
```

**Note on `GOOGLE_PLACEHOLDER`:** The hooks array stores the literal string `GOOGLE_PLACEHOLDER` which gets replaced in the `render()` function with the colored `googleText(72)` call. This avoids calling `googleText()` at array definition time and keeps the hook text scannable.

- [ ] **Step 2: Verify in browser**

"Social Hooks" category should show 10 templates. Running total: 46.

**Commit:** `feat(social3): add social hooks templates (10)`

---

### Task 5: Animated Pages (2 animations, dark mode only)

**Files:**
- Modify: `RoweOS/dist/social3.html` (append to templates array)

The animated pages are full-card 1080x1350 sequences designed for screen recording. They use CSS `@keyframes` (added in Task 1) with staggered `animation-delay` values. They render in the template grid like normal cards, but when the user opens the preview, the animation plays from the beginning. They are downloadable as static PNG (capturing whatever frame html2canvas renders).

- [ ] **Step 1: Add animated page templates**

Append after the social hooks IIFE:

```javascript
// --- ANIMATED PAGES (for screen recording) ---
(function() {
  // Animation 1: Launch Announcement (15-20s sequence)
  // Sequence: logo fade in -> "Backed by Google" types in -> Google logo -> stats count up -> CTA
  templates.push({
    id: 'anim-launch', category: 'animated', mode: 'dark',
    label: 'Animation: Launch Announcement',
    render: function() {
      return '<div style="width:' + CARD_W + 'px;height:' + CARD_H + 'px;background:#0a0a0a;color:#ece4d8;font-family:\'DM Sans\',sans-serif;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;">'
        + '<div style="opacity:0;animation:fadeIn 2s ease 0.5s forwards;">'
        + logoIcon('dark', 96)
        + '</div>'
        + '<div style="opacity:0;animation:fadeInUp 1.5s ease 2.5s forwards;margin-top:32px;">'
        + '<span style="font-family:\'Cormorant Garamond\',serif;font-size:60px;font-weight:300;">Backed by ' + googleText(60) + '</span>'
        + '</div>'
        + '<div style="opacity:0;animation:fadeIn 1.5s ease 4.5s forwards;margin-top:24px;">'
        + '<img src="' + GOOGLE_LOGO + '" style="width:240px;height:auto;" crossorigin="anonymous">'
        + '</div>'
        + '<div style="opacity:0;animation:fadeInUp 1s ease 7s forwards;margin-top:48px;">'
        + '<div style="display:flex;gap:48px;text-align:center;">'
        + '<div style="opacity:0;animation:countUp 0.5s ease 8s forwards;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:48px;color:#b2997b;">6</div><div style="font-size:13px;color:#655e54;letter-spacing:0.15em;text-transform:uppercase;">AI Agents</div></div>'
        + '<div style="opacity:0;animation:countUp 0.5s ease 8.5s forwards;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:48px;color:#b2997b;">20+</div><div style="font-size:13px;color:#655e54;letter-spacing:0.15em;text-transform:uppercase;">Views</div></div>'
        + '<div style="opacity:0;animation:countUp 0.5s ease 9s forwards;"><div style="font-family:\'Cormorant Garamond\',serif;font-size:48px;color:#b2997b;">5</div><div style="font-size:13px;color:#655e54;letter-spacing:0.15em;text-transform:uppercase;">Brands</div></div>'
        + '</div>'
        + '</div>'
        + '<div style="opacity:0;animation:fadeIn 1.5s ease 10.5s forwards;margin-top:48px;">'
        + '<div style="font-size:22px;color:#b2997b;letter-spacing:0.15em;">roweos.com</div>'
        + '</div>'
        + '</div>';
    }
  });

  // Animation 2: Feature Walkthrough (20-25s sequence)
  // Sequence: title types in -> Chat slides in -> Studio -> Focus -> Automations -> badge -> CTA
  templates.push({
    id: 'anim-walkthrough', category: 'animated', mode: 'dark',
    label: 'Animation: Feature Walkthrough',
    render: function() {
      var shots = [
        { src: IMG_BASE + 'chat_brandAI.png', label: 'Chat', delay: '3s' },
        { src: IMG_BASE + 'studi_brandAI.png', label: 'Studio', delay: '6s' },
        { src: IMG_BASE + 'focus_brandAI.png', label: 'Focus', delay: '9s' },
        { src: IMG_BASE + 'adaptive_brandAI.png', label: 'Automations', delay: '12s' }
      ];
      var shotsHtml = '';
      shots.forEach(function(s) {
        shotsHtml += '<div style="opacity:0;animation:slideInRight 0.8s ease ' + s.delay + ' forwards;position:absolute;top:200px;left:60px;right:60px;">'
          + '<div style="font-size:14px;color:#655e54;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:12px;">' + s.label + '</div>'
          + '<div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);box-shadow:0 8px 40px rgba(0,0,0,0.5);">'
          + '<img src="' + s.src + '" style="width:100%;display:block;" crossorigin="anonymous">'
          + '</div></div>';
      });
      return '<div style="width:' + CARD_W + 'px;height:' + CARD_H + 'px;background:#0a0a0a;color:#ece4d8;font-family:\'DM Sans\',sans-serif;position:relative;overflow:hidden;">'
        + '<div style="opacity:0;animation:fadeInUp 1.5s ease 0.5s forwards;position:absolute;top:80px;left:0;right:0;text-align:center;">'
        + '<span style="font-family:\'Cormorant Garamond\',serif;font-size:44px;font-weight:300;">Meet your operating intelligence</span>'
        + '</div>'
        + shotsHtml
        + '<div style="opacity:0;animation:fadeIn 1.5s ease 16s forwards;position:absolute;bottom:120px;left:0;right:0;text-align:center;">'
        + backedBadge('dark')
        + '</div>'
        + '<div style="opacity:0;animation:fadeIn 1s ease 18s forwards;position:absolute;bottom:60px;left:0;right:0;text-align:center;">'
        + '<div style="font-size:22px;color:#b2997b;letter-spacing:0.15em;">roweos.com</div>'
        + '</div>'
        + '</div>';
    }
  });
})();
```

- [ ] **Step 2: Verify in browser**

"Animated Pages" category should show 2 templates. Running total: 48 templates. Open the launch animation in preview and watch the staggered CSS animations play through (~15 seconds for all elements to appear). Open the walkthrough animation and verify screenshots slide in sequentially.

**Commit:** `feat(social3): add animated page templates (2)`

---

### Task 6: Final Verification and Polish

**Files:**
- Read-only verification of all files

- [ ] **Step 1: Verify template counts**

Open `social3.html` in browser. Expected counts per category:
| Category | Count |
|----------|-------|
| All Templates | 48 |
| Announcement Carousel | 12 |
| Feature: Chat | 6 |
| Feature: Studio | 6 |
| Feature: Focus | 6 |
| Feature: Automations | 6 |
| Social Hooks | 10 |
| Animated Pages | 2 |

- [ ] **Step 2: Test filtering**

Click each category in sidebar. Verify correct templates show. Toggle Dark/Light mode filter. Verify "All" shows all, "Dark" shows only dark templates, "Light" shows only light.

- [ ] **Step 3: Test preview modal**

Click any template card to open preview. Verify:
- Card renders at full resolution in the preview
- Download PNG button works (downloads a PNG file)
- Close button and Escape key close the modal
- Clicking outside the preview content closes modal

- [ ] **Step 4: Test Download All**

Click "Download All (.zip)" in sidebar. Verify:
- Progress bar appears and moves
- ZIP file downloads with name `RoweOS_Google_Startups.zip`
- ZIP contains folders per category with PNG files
- PNG files render correctly (open a few to check)

- [ ] **Step 5: Test mobile responsive**

Resize browser below 900px. Verify:
- Sidebar disappears
- Mobile filter bar appears with horizontally scrollable category pills
- Grid adapts to smaller column count
- Cards still clickable and preview works

- [ ] **Step 6: Verify dark/light theme toggle**

Click the theme toggle button (sun/moon icon in top bar). Verify:
- Page switches between dark and light mode
- Preference persists on reload (stored in `roweos-social3-theme`)
- Does not affect social.html or social2.html theme keys

- [ ] **Step 7: Verify existing deliverables still work**

```bash
# Check vercel.json route exists
grep 'social3' /Users/jordanrowe/Developer/roweOS/RoweOS/dist/vercel.json
```

```bash
# Check Google badge on RoweOS launch screen
grep -n 'google-for-startups' /Users/jordanrowe/Developer/roweOS/src/html/core/03-views-batch2.html
```

```bash
# Check Google badge on The Rowe Collection
grep -n 'google-for-startups' /Users/jordanrowe/Developer/the-rowe-collection/src/app/roweos/page.tsx
```

All three should return matches confirming the badges are already in place.

- [ ] **Step 8: Verify no ES5 violations**

Grep social3.html for common ES6+ patterns:
```bash
grep -n 'const \|let \|=> \|`' /Users/jordanrowe/Developer/roweOS/RoweOS/dist/social3.html
```

Expected: No matches. If any found, fix them to ES5 equivalents.

**Commit:** `feat(social3): final verification pass for Google for Startups promo content`

---

## Summary

| Deliverable | Templates/Changes | Status |
|-------------|-------------------|--------|
| `social3.html` Content Studio | 48 templates (12 announcement + 24 feature + 10 hooks + 2 animated) | Tasks 1-5 |
| Vercel route `/social3` | Already in vercel.json (line 25) | Done |
| The Rowe Collection badge | Google for Startups pill on `/roweos` page | Done |
| RoweOS login badge | Small badge on launch screen | Done |
| Google logo assets | Present in both projects | Done |

**Deployment after all tasks complete:**
```bash
cd ~/Developer/roweOS && ./deploy.sh
```
