# Google for Startups Promo Content - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create promotional content across 4 surfaces (social3.html Content Studio, The Rowe Collection website, RoweOS app login screen, Vercel route) to announce RoweOS acceptance into Google for Startups Cloud Program.

**Architecture:** social3.html is a standalone page replicating social2.html's template engine (cardWrap, watermark, goldText, screenshotFrame, logoMark helpers + html2canvas + JSZip for PNG export). New templates use the `google-startups` category with announcement carousel (6 slides), feature carousels (4 sets x 3 slides), social hooks (5 slides), and animated HTML pages. The Rowe Collection gets a badge component on its RoweOS page. The RoweOS app gets a small badge below the "Early Access" link on the launch screen.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5), html2canvas, JSZip, Next.js (The Rowe Collection)

**Design Language:** Dark bg #0a0a0a, gold #b2997b, Cormorant Garamond headlines, DM Sans body. Google multicolor ONLY on the word "Google" itself. No one-sided borders. No emoji.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `RoweOS/dist/social3.html` | Create | Full Content Studio page with Google for Startups templates |
| `RoweOS/dist/vercel.json` | Edit (line 25) | Add `/social3` route |
| `RoweOS/dist/images/promo/google-for-startups.png` | Already copied | Google for Startups logo asset |
| `the-rowe-collection/src/app/roweos/page.tsx` | Edit | Add Google for Startups badge section |
| `the-rowe-collection/public/images/google-for-startups.png` | Create (copy) | Logo asset for TRC site |
| `roweOS/src/html/core/03-views-batch2.html` | Edit (~line 108) | Add small badge below "Early Access" on launch screen |

---

### Task 1: Vercel Route + Google Logo Asset

**Files:**
- Modify: `RoweOS/dist/vercel.json:25`
- Copy: `RoweOS/dist/images/promo/google-for-startups.png` (already done)
- Copy: `the-rowe-collection/public/images/google-for-startups.png`

- [ ] **Step 1: Add social3 route to vercel.json**

Insert before the existing `/social2` route (line 25):

```json
{ "src": "/social3", "dest": "/social3.html" },
```

The routes array should read:
```
...
{ "src": "/social3", "dest": "/social3.html" },
{ "src": "/social2", "dest": "/social2.html" },
...
```

- [ ] **Step 2: Copy Google logo to The Rowe Collection**

```bash
cp /Users/jordanrowe/Developer/roweOS/RoweOS/dist/images/promo/google-for-startups.png /Users/jordanrowe/Developer/the-rowe-collection/public/images/google-for-startups.png
```

- [ ] **Step 3: Verify assets**

```bash
ls -la /Users/jordanrowe/Developer/roweOS/RoweOS/dist/images/promo/google-for-startups.png
ls -la /Users/jordanrowe/Developer/the-rowe-collection/public/images/google-for-startups.png
```

Both files should exist with non-zero size (~27KB).

---

### Task 2: social3.html - Shell, CSS, Layout, Engine

**Files:**
- Create: `RoweOS/dist/social3.html`

This task creates the entire page structure: HTML shell, all CSS, the template engine (helpers + rendering + download), sidebar, grid, preview modal. Templates are added in Tasks 3-6.

- [ ] **Step 1: Create social3.html with full shell + engine**

Create `RoweOS/dist/social3.html`. The file structure follows social2.html exactly:

1. **HTML head** - same meta, fonts, html2canvas + JSZip CDN scripts
2. **CSS** - copy social2.html's CSS verbatim (lines 12-112), changing `roweos-social2-theme` to `roweos-social3-theme` in the theme JS
3. **Top bar** - same layout, title changed to "Content Studio — Google for Startups"
4. **Sidebar** - same mode toggle (All/Dark/Light) + category list + download all button
5. **Grid area** - same post-grid structure
6. **Preview modal** - same preview/download modal
7. **Hidden render container** - same `#renderContainer`
8. **Progress bar** - same progress bar

**Categories array:**
```javascript
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

**Helper functions** - copy from social2.html:
- `cardWrap(mode, inner)` - identical
- `watermark(mode)` - identical
- `goldText(mode, text, size, weight, extra)` - identical
- `screenshotFrame(src, mode, opts)` - identical
- `logoIcon(mode, size)` - identical (uses LOGO_ICON_DARK)
- `logoMark(mode, size)` - identical
- `checkIcon(mode)` - identical
- `featureIcon(name, mode)` - identical

**New helpers:**
```javascript
var GOOGLE_LOGO = '/images/promo/google-for-startups.png';

function googleLogo(width) {
  return '<img src="' + GOOGLE_LOGO + '" style="width:' + (width || 200) + 'px;height:auto;" crossorigin="anonymous" />';
}

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

**Rendering engine** - copy from social2.html verbatim:
- `getVisibleTemplates()`
- `renderGrid()`
- `renderSidebar()`
- `setFilter(catId)`
- `setModeFilter(mode)`
- `openPreview(idx)`
- `closePreview()`
- `rasterizeSvgs(container)`
- `renderToCanvas(idx)`
- `downloadTemplate(idx)` - change filename prefix to `RoweOS_GFS_`
- `downloadCurrent()`
- `downloadAll()` - change ZIP name to `RoweOS_Google_Startups.zip`
- `toggleTheme()` - use `roweos-social3-theme` key
- keyboard handler (Escape)
- init: `renderSidebar(); renderGrid();`
- resize handler

**Important:** All JS must be ES5. No arrow functions, no let/const, no template literals.

- [ ] **Step 2: Verify the page loads**

```bash
# Open in browser to verify layout renders (empty grid since no templates yet)
open /Users/jordanrowe/Developer/roweOS/RoweOS/dist/social3.html
```

Expected: Page loads with top bar "Content Studio — Google for Startups", sidebar with categories, empty grid showing "0 templates".

---

### Task 3: Announcement Carousel Templates (6 slides x 2 modes = 12 templates)

**Files:**
- Modify: `RoweOS/dist/social3.html` (add templates to the `templates` array)

Add an IIFE block after the `var templates = [];` line. Each slide has dark + light variants.

- [ ] **Step 1: Add announcement carousel templates**

Insert after `var templates = [];`:

```javascript
// ─── ANNOUNCEMENT CAROUSEL (6 slides x dark/light) ───
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
        var screenshot = '/images/desktop/full_screen_brandAI.png';
        var mobileShot = '/images/desktop/chat_brandAI.png';
        return cardWrap(mode,
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 40px;">'
          + '<div style="font-size:16px;color:' + dim + ';letter-spacing:0.2em;text-transform:uppercase;margin-bottom:16px;">What is RoweOS?</div>'
          + '<div style="font-family:var(--serif);font-size:44px;font-weight:300;color:' + text + ';line-height:1.3;text-align:center;margin-bottom:24px;">Operating intelligence,<br>built for brands.</div>'
          + '<div style="display:flex;align-items:flex-end;justify-content:center;gap:16px;width:95%;margin:8px auto;">'
          + macbookFrame('<img src="' + screenshot + '" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:0;" crossorigin="anonymous">', mode, {width:'62%'})
          + iphoneFrame('<img src="' + mobileShot + '" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:0;" crossorigin="anonymous">', mode, {width:'20%'})
          + '</div>'
          + '<div style="font-size:16px;color:var(--c-muted);margin-top:12px;">Desktop & mobile. One platform.</div>'
          + '</div>'
        );
      }
    });

    // Slide 3: iPhone Chat - "AI agents that learn your voice"
    templates.push({
      id: 'ann-3-' + mode, category: 'announcement', mode: mode,
      label: 'Announcement 3: Brand Intelligence' + suffix,
      render: function() {
        var chatShot = '/images/desktop/chat_brandAI.png';
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

    // Slide 4: MacBook Automations
    templates.push({
      id: 'ann-4-' + mode, category: 'announcement', mode: mode,
      label: 'Announcement 4: Automation' + suffix,
      render: function() {
        var autoShot = '/images/desktop/focus_brandAI.png';
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

    // Slide 5: Feature list (redesigned from stats)
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
          { dot: '#b2997b', label: 'Desktop & Mobile', desc: 'everywhere you are' }
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

    // Slide 6: CTA
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

Open social3.html and check the "Announcement Carousel" category shows 12 templates (6 dark + 6 light). Click through each to verify layout renders properly.

---

### Task 4: Feature Carousel Templates (4 sets x 3 slides x 2 modes = 24 templates)

**Files:**
- Modify: `RoweOS/dist/social3.html` (append to templates array)

- [ ] **Step 1: Add feature carousel templates**

Append after the announcement IIFE:

```javascript
// ─── FEATURE CAROUSELS (4 features x 3 slides x dark/light) ───
(function() {
  var featureSets = [
    {
      catId: 'feature-chat', name: 'Chat',
      shot1: '/images/desktop/chat_brandAI.png',
      shot2: '/images/desktop/long_chat_brandAI.png',
      headline1: 'Your AI.<br>Your voice.',
      sub1: 'Same question. Different brand. Different tone.',
      headline2: 'Same content.<br>Two brands.<br>Two voices.',
      sub2: 'RoweOS adapts to each brand\'s identity automatically.'
    },
    {
      catId: 'feature-studio', name: 'Studio',
      shot1: '/images/desktop/studi_brandAI.png',
      shot2: '/images/desktop/full_screen_brandAI.png',
      headline1: 'One-click<br>content.',
      sub1: 'Studio operations that generate on-brand output instantly.',
      headline2: 'From idea<br>to polished output.',
      sub2: '50+ operations across strategy, marketing, ops, and docs.'
    },
    {
      catId: 'feature-focus', name: 'Focus',
      shot1: '/images/desktop/focus_brandAI.png',
      shot2: '/images/desktop/analytics_brandAI.png',
      headline1: 'Your command<br>center.',
      sub1: 'Calendar, tasks, streaks, and automations in one view.',
      headline2: 'Intelligence<br>at a glance.',
      sub2: 'Everything about your brand, always within reach.'
    },
    {
      catId: 'feature-automations', name: 'Automations',
      shot1: '/images/desktop/adaptive_brandAI.png',
      shot2: '/images/desktop/settings_brandAI.png',
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

      // Slide 3: CTA
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

Check each feature category shows 6 templates (3 dark + 3 light). Total count should now be 36.

---

### Task 5: Social Hooks Templates (5 hooks x 2 modes = 10 templates)

**Files:**
- Modify: `RoweOS/dist/social3.html` (append to templates array)

- [ ] **Step 1: Add social hooks templates**

```javascript
// ─── SOCIAL HOOKS (5 hooks x dark/light) ───
(function() {
  var hooks = [
    { text: 'Backed by ' + 'GOOGLE_PLACEHOLDER' + '.<br>Built for brands.', id: 'backed' },
    { text: 'Your brand deserves<br>its own AI.', id: 'deserves' },
    { text: 'We didn\'t raise funding.<br>' + 'GOOGLE_PLACEHOLDER' + ' chose us.', id: 'chose' },
    { text: 'Operating intelligence,<br>backed by ' + 'GOOGLE_PLACEHOLDER' + '.', id: 'intel' },
    { text: 'The AI platform<br>' + 'GOOGLE_PLACEHOLDER' + ' believes in.', id: 'believes' }
  ];

  var modes = ['dark', 'light'];
  modes.forEach(function(mode) {
    var suffix = mode === 'dark' ? '' : ' (Light)';
    var text = mode === 'dark' ? '#ece4d8' : '#1a1a1a';
    var dim = mode === 'dark' ? '#655e54' : '#8a857e';

    hooks.forEach(function(hook) {
      // Replace GOOGLE_PLACEHOLDER with colored Google text in render
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

- [ ] **Step 2: Verify in browser**

"Social Hooks" category should show 10 templates. Total count: 46.

---

### Task 6: Animated Pages (2 animations, not downloadable as PNG)

**Files:**
- Modify: `RoweOS/dist/social3.html` (append to templates array, add CSS animations)

The animated pages are full-viewport sequences designed for screen recording. They render in the template grid like normal cards but at the bottom, and when opened full-screen they play their animation sequence. They use CSS keyframes only.

- [ ] **Step 1: Add animation CSS keyframes to the style block**

Add before `</style>`:

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

- [ ] **Step 2: Add animated page templates**

```javascript
// ─── ANIMATED PAGES (for screen recording) ───
(function() {
  // Animation 1: Launch Announcement (15s sequence)
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

  // Animation 2: Feature Walkthrough (20s sequence)
  templates.push({
    id: 'anim-walkthrough', category: 'animated', mode: 'dark',
    label: 'Animation: Feature Walkthrough',
    render: function() {
      var shots = [
        { src: '/images/desktop/chat_brandAI.png', label: 'Chat', delay: '3s' },
        { src: '/images/desktop/studi_brandAI.png', label: 'Studio', delay: '6s' },
        { src: '/images/desktop/focus_brandAI.png', label: 'Focus', delay: '9s' },
        { src: '/images/desktop/adaptive_brandAI.png', label: 'Automations', delay: '12s' }
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

- [ ] **Step 3: Verify in browser**

"Animated Pages" category should show 2 templates. Total count: 48. Open the launch animation in preview and watch the sequence play through.

---

### Task 7: The Rowe Collection - Google for Startups Badge

**Files:**
- Modify: `the-rowe-collection/src/app/roweos/page.tsx`

Add a "Google for Startups" badge section between the Hero and the "Who It's For" section.

- [ ] **Step 1: Add badge section to page.tsx**

After the `<Hero ... />` closing tag (line 47) and before the `{/* Who it's for */}` comment (line 49), insert:

```tsx
      {/* Google for Startups */}
      <section className="py-12 px-6 border-t border-trc-border">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <FadeUp>
            <div className="flex items-center gap-4 px-6 py-3 border border-trc-border rounded-full bg-white/[0.02]">
              <Image
                src="/images/google-for-startups.png"
                alt="Google for Startups"
                width={160}
                height={24}
                className="h-5 w-auto opacity-70"
              />
              <span className="text-xs text-trc-cream/40 tracking-wider uppercase">Cloud Program Member</span>
            </div>
          </FadeUp>
        </div>
      </section>
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/jordanrowe/Developer/the-rowe-collection && npm run build
```

Expected: Build succeeds with no errors. The badge should appear as a subtle pill-shaped element between the hero and the audience section.

---

### Task 8: RoweOS App - Launch Screen Badge

**Files:**
- Modify: `roweOS/src/html/core/03-views-batch2.html` (~line 108, after the "Early Access" link)

- [ ] **Step 1: Add Google badge below the "Early Access" link**

Find the line containing `launch-beta-link` and the "Early Access" text (~line 108). After that `</a>` tag, insert:

```html
      <!-- v28.9: Google for Startups badge -->
      <div style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:4px 12px;border:1px solid rgba(168,152,120,0.15);border-radius:16px;opacity:0.5;">
        <img src="/images/promo/google-for-startups.png" style="height:12px;width:auto;" alt="Google for Startups">
        <span style="font-size:8px;color:rgba(168,152,120,0.5);letter-spacing:1px;text-transform:uppercase;">Cloud Program</span>
      </div>
```

- [ ] **Step 2: Build RoweOS**

```bash
cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh
```

Expected: Build succeeds. The badge appears on the launch screen below "Early Access" as a very subtle, small element.

---

### Task 9: Final Verification

- [ ] **Step 1: Verify all routes work locally**

```bash
cd /Users/jordanrowe/Developer/roweOS/RoweOS/dist && npx serve .
```

Open in browser:
- `http://localhost:3000/social3` - Content Studio loads with 48 templates
- All categories filter correctly
- Download individual PNG works
- Download All ZIP works
- Dark/Light mode toggle works
- Preview modal opens/closes

- [ ] **Step 2: Verify The Rowe Collection locally**

```bash
cd /Users/jordanrowe/Developer/the-rowe-collection && npm run dev
```

Navigate to `/roweos` and verify the Google for Startups badge appears between hero and "Who It's For".

- [ ] **Step 3: Verify RoweOS launch screen**

Open `/Users/jordanrowe/Developer/roweOS/RoweOS/dist/index.html` and check the launch screen shows the small Google badge below "Early Access".

---

## Summary

| Deliverable | Templates/Changes | Status |
|-------------|-------------------|--------|
| social3.html Content Studio | 48 templates (12 announcement + 24 feature + 10 hooks + 2 animated) | - |
| Vercel route | `/social3` -> `social3.html` | - |
| The Rowe Collection badge | Google for Startups pill on /roweos page | - |
| RoweOS login badge | Small badge on launch screen | - |
| Google logo assets | Copied to both projects | - |
