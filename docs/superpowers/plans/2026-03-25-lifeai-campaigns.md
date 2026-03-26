# LifeAI Campaign Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 22 LifeAI campaign post designs (44 templates with dark/light) to Content Studio S2 under a new "LifeAI Campaigns" sidebar category with a dedicated Coastal Blue / Midnight Blue color palette.

**Architecture:** All templates live in a single file (`social2.html`) as inline JS template functions pushed to the `templates[]` array. New blue-palette helper functions mirror the existing gold-palette helpers (`cardWrap`, `watermark`, `pill`, etc.). A new category entry in `CATEGORIES` and campaign label prefixes on each template provide filtering and grouping.

**Tech Stack:** Vanilla JS, inline HTML/CSS templates, html2canvas for PNG export. No build step.

**Spec:** `docs/superpowers/specs/2026-03-25-lifeai-campaigns-design.md`

---

### Task 1: Add Blue Palette Helpers and Category

**Files:**
- Modify: `RoweOS/dist/social2.html:213-228` (CATEGORIES array)
- Modify: `RoweOS/dist/social2.html:~862` (after Life Intelligence IIFE, before Premium Features)

- [ ] **Step 1: Add new category to CATEGORIES array**

In `RoweOS/dist/social2.html`, find the CATEGORIES array (line 213) and add the new entry after `life-intel`:

```js
  { id: 'life-intel', label: 'Life Intelligence' },
  { id: 'lifeai-campaigns', label: 'LifeAI Campaigns' },
```

- [ ] **Step 2: Add blue palette helper functions**

Insert after the closing `})();` of the Life Intelligence IIFE (line 862), before the Premium Features section:

```js
// ─── LIFEAI CAMPAIGN HELPERS ───

var COASTAL_BLUE = {
  light: {
    bg: '#ffffff',
    gradient: 'linear-gradient(145deg, #edf2f8 0%, #d4e0ec 40%, #c4d4e4 100%)',
    text: '#2c4f6b',
    secondary: '#3a5268',
    muted: '#627d94',
    accent: '#5c8aab',
    surface: '#8aabc4',
    pillBorder: 'rgba(44,79,107,0.25)',
    wmColor: 'rgba(44,79,107,0.25)',
    checkColor: '#5c8aab'
  },
  dark: {
    bg: '#0a0a0a',
    gradient: 'linear-gradient(145deg, #0a0a0a 0%, #0f1520 40%, #121e2e 100%)',
    text: '#c4d4e4',
    secondary: '#8aabc4',
    muted: '#5c8aab',
    accent: '#1e3a5f',
    surface: 'rgba(30,58,95,0.15)',
    pillBorder: 'rgba(140,171,196,0.25)',
    wmColor: 'rgba(140,171,196,0.25)',
    checkColor: '#8aabc4'
  }
};

function cardWrapBlue(mode, inner) {
  var c = COASTAL_BLUE[mode];
  return '<div style="width:'+CARD_W+'px;height:'+CARD_H+'px;background:'+c.gradient+';color:'+c.text+';font-family:\'DM Sans\',sans-serif;position:relative;overflow:hidden;">'
    + inner + watermarkBlue(mode) + '</div>';
}

function watermarkBlue(mode) {
  var c = COASTAL_BLUE[mode];
  return '<div style="position:absolute;bottom:32px;left:0;right:0;text-align:center;font-size:16px;letter-spacing:0.25em;text-transform:uppercase;color:'+c.wmColor+';font-weight:500;">roweos.com</div>';
}

function pillBlue(mode, label) {
  var c = COASTAL_BLUE[mode];
  return '<span style="display:inline-block;padding:4px 14px;border:1px solid '+c.pillBorder+';border-radius:20px;font-size:14px;color:'+c.accent+';letter-spacing:0.06em;">'+label+'</span>';
}

function checkIconBlue(mode) {
  var c = COASTAL_BLUE[mode];
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="'+c.checkColor+'" stroke-width="2" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>';
}

function disclaimerText(mode) {
  var c = COASTAL_BLUE[mode];
  return '<div style="position:absolute;bottom:60px;left:0;right:0;text-align:center;font-size:14px;color:'+c.muted+';padding:0 80px;">*AI-powered guidance built on IRS knowledge. Not tax, legal, or financial advice.</div>';
}
```

- [ ] **Step 3: Verify page still loads**

Open `roweos.com/social2` (or local file) in browser. Confirm:
- New "LifeAI Campaigns" category appears in sidebar with 0 count
- All existing templates still render correctly
- No console errors

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS
git add RoweOS/dist/social2.html
git commit -m "feat(social2): add blue palette helpers and LifeAI Campaigns category"
```

---

### Task 2: Tax Season Campaign Posts 1-4

**Files:**
- Modify: `RoweOS/dist/social2.html` (insert after blue palette helpers)

- [ ] **Step 1: Add Tax Season IIFE with posts 1-4**

Insert after the blue palette helper functions:

```js
// ─── LIFEAI CAMPAIGN TEMPLATES (44) ───

// Campaign 1: Tax Season (8 posts)
(function() {
  var tsId = 7000;

  ['dark', 'light'].forEach(function(mode) {
    var c = COASTAL_BLUE[mode];

    // Post 1: Urgency Hook
    templates.push({
      id: tsId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Tax Season — Urgency Hook (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;">'
            + '<div style="font-size:14px;letter-spacing:0.25em;text-transform:uppercase;color:'+cl.muted+';margin-bottom:40px;font-weight:500;">RoweOS</div>'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:96px;font-weight:300;color:'+cl.text+';margin-bottom:24px;">April 15</div>'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:36px;font-weight:400;color:'+cl.secondary+';text-align:center;margin-bottom:48px;">Your AI is ready. Are you?</div>'
            + '<div style="margin-bottom:20px;">' + pillBlue(m, 'LifeAI') + '</div>'
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 2: The Pitch
    templates.push({
      id: tsId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Tax Season — The Pitch (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var features = ['Income tracking', 'Deduction finder', 'Business expenses', 'Quarterly estimates', 'Document organization'];
          var featureList = '';
          for (var i = 0; i < features.length; i++) {
            featureList += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">'
              + checkIconBlue(m)
              + '<span style="font-size:20px;color:'+cl.text+';">' + features[i] + '</span>'
              + '</div>';
          }
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;border-top:4px solid #f59e0b;display:flex;flex-direction:column;justify-content:center;padding:80px 80px 100px;">'
            + '<div style="position:absolute;top:40px;left:40px;">' + logoIcon(m, 56) + '</div>'
            + '<div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">'
            + '<span style="font-size:28px;font-weight:600;color:'+cl.text+';">Tax Intelligence</span>'
            + pillBlue(m, 'LifeAI')
            + '</div>'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:40px;font-weight:400;color:'+cl.text+';margin-bottom:48px;line-height:1.15;">Already knows your income, deductions, and business expenses.</div>'
            + featureList
            + '</div>'
            + disclaimerText(m);
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 3: IRS Knowledge
    templates.push({
      id: tsId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Tax Season — IRS Knowledge (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;">'
            + '<div style="font-size:14px;letter-spacing:0.25em;text-transform:uppercase;color:'+cl.muted+';margin-bottom:40px;font-weight:500;">Tax Intelligence</div>'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:52px;font-weight:400;color:'+cl.text+';text-align:center;margin-bottom:32px;line-height:1.15;">Built on IRS publications.<br>Guidance you can trust.</div>'
            + '<div style="width:60px;height:1px;background:'+cl.accent+';margin-bottom:32px;"></div>'
            + pillBlue(m, 'LifeAI')
            + '</div>'
            + disclaimerText(m);
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 4: Personal + Business
    templates.push({
      id: tsId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Tax Season — Personal + Business (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var personalItems = ['W-2 income', 'Standard deduction', 'Credits & refunds'];
          var businessItems = ['1099 income', 'Business expenses', 'Quarterly estimates'];
          var leftCol = '';
          var rightCol = '';
          for (var i = 0; i < personalItems.length; i++) {
            leftCol += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
              + checkIconBlue(m)
              + '<span style="font-size:18px;color:'+cl.text+';">' + personalItems[i] + '</span></div>';
          }
          for (var j = 0; j < businessItems.length; j++) {
            rightCol += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
              + checkIconBlue(m)
              + '<span style="font-size:18px;color:'+cl.text+';">' + businessItems[j] + '</span></div>';
          }
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 60px 100px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:44px;font-weight:400;color:'+cl.text+';text-align:center;margin-bottom:60px;line-height:1.15;">Personal or business.<br>LifeAI handles both.</div>'
            + '<div style="display:flex;gap:40px;width:100%;">'
            + '<div style="flex:1;padding:32px;border:1px solid '+cl.pillBorder+';border-radius:16px;">'
            + '<div style="font-size:20px;font-weight:600;color:'+cl.text+';margin-bottom:24px;">Personal</div>'
            + leftCol + '</div>'
            + '<div style="flex:1;padding:32px;border:1px solid '+cl.pillBorder+';border-radius:16px;">'
            + '<div style="font-size:20px;font-weight:600;color:'+cl.text+';margin-bottom:24px;">Business</div>'
            + rightCol + '</div>'
            + '</div>'
            + '<div style="margin-top:32px;">' + pillBlue(m, 'LifeAI') + '</div>'
            + '</div>'
            + disclaimerText(m);
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });
  });
})();
```

- [ ] **Step 2: Verify in browser**

Open social2 in browser, click "LifeAI Campaigns" in sidebar. Confirm 8 templates show (4 designs x dark + light). Click each to preview. Verify:
- Coastal Blue gradient on light mode posts
- Midnight dark gradient on dark mode posts
- LifeAI pill renders correctly
- Disclaimer text appears on Posts 2, 3, 4
- Tax Intelligence accent border on Post 2
- roweos.com watermark on all

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS
git add RoweOS/dist/social2.html
git commit -m "feat(social2): add Tax Season campaign posts 1-4"
```

---

### Task 3: Tax Season Campaign Posts 5-8

**Files:**
- Modify: `RoweOS/dist/social2.html` (append inside Tax Season IIFE, before the closing `});` of the forEach and `})();`)

- [ ] **Step 1: Add posts 5-8 inside the existing Tax Season forEach loop**

Add these 4 templates after Post 4 (Personal + Business), still inside the `['dark', 'light'].forEach(function(mode) {` block:

```js
    // Post 5: CTA
    templates.push({
      id: tsId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Tax Season — CTA (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:72px;font-weight:300;color:'+cl.text+';text-align:center;margin-bottom:48px;">Don\'t file alone.</div>'
            + logoIcon(m, 80)
            + '<div style="margin-top:32px;">' + pillBlue(m, 'LifeAI') + '</div>'
            + '</div>'
            + disclaimerText(m);
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 6: Time Saving
    templates.push({
      id: tsId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Tax Season — Time Saving (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:64px;font-weight:300;color:'+cl.muted+';text-align:center;margin-bottom:8px;">Hours of prep.</div>'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:64px;font-weight:600;color:'+cl.text+';text-align:center;margin-bottom:48px;">Seconds with Tax Intelligence.</div>'
            + pillBlue(m, 'LifeAI')
            + '</div>'
            + disclaimerText(m);
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 7: Receipts Pain Point
    templates.push({
      id: tsId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Tax Season — Receipts (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 100px 100px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:56px;font-weight:400;color:'+cl.text+';text-align:center;margin-bottom:32px;line-height:1.15;">Stop digging through receipts.</div>'
            + '<div style="font-size:20px;color:'+cl.secondary+';text-align:center;line-height:1.6;margin-bottom:40px;">Tax Intelligence organizes what you\'d spend hours finding.</div>'
            + pillBlue(m, 'LifeAI')
            + '</div>'
            + disclaimerText(m);
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 8: Summary Output
    templates.push({
      id: tsId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Tax Season — Summary (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var items = [
            { label: 'Deductions found', status: '12 identified' },
            { label: 'Deadlines tracked', status: 'April 15, June 15' },
            { label: 'Estimates ready', status: 'Q1 & Q2 prepared' }
          ];
          var rows = '';
          for (var i = 0; i < items.length; i++) {
            rows += '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:1px solid '+cl.pillBorder+';">'
              + '<div style="display:flex;align-items:center;gap:14px;">'
              + checkIconBlue(m)
              + '<span style="font-size:20px;color:'+cl.text+';">' + items[i].label + '</span>'
              + '</div>'
              + '<span style="font-size:16px;color:'+cl.accent+';letter-spacing:0.04em;">' + items[i].status + '</span>'
              + '</div>';
          }
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;justify-content:center;padding:80px 80px 100px;">'
            + '<div style="font-size:14px;letter-spacing:0.25em;text-transform:uppercase;color:'+cl.muted+';margin-bottom:16px;font-weight:500;">Tax Intelligence</div>'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:48px;font-weight:400;color:'+cl.text+';margin-bottom:48px;line-height:1.15;">Your tax situation, summarized.</div>'
            + '<div style="width:100%;">' + rows + '</div>'
            + '<div style="margin-top:32px;text-align:center;">' + pillBlue(m, 'LifeAI') + '</div>'
            + '</div>'
            + disclaimerText(m);
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });
```

- [ ] **Step 2: Verify in browser**

LifeAI Campaigns should now show 16 templates (8 Tax Season x dark + light). Preview each new post. Verify:
- Post 5: Clean closer, logo + pill, no feature list
- Post 6: "Hours" in light weight, "Seconds" in bold
- Post 7: Headline + subtext layout
- Post 8: Dashboard/summary rows with status text
- All 4 have disclaimer text

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS
git add RoweOS/dist/social2.html
git commit -m "feat(social2): add Tax Season campaign posts 5-8"
```

---

### Task 4: "Your AI Already Knows You" Campaign (4 posts)

**Files:**
- Modify: `RoweOS/dist/social2.html` (add new IIFE after Tax Season)

- [ ] **Step 1: Add Campaign 2 IIFE**

Insert after the Tax Season IIFE closing `})();`:

```js
// Campaign 2: "Your AI Already Knows You" (4 posts)
(function() {
  var akId = 7100;

  ['dark', 'light'].forEach(function(mode) {
    var c = COASTAL_BLUE[mode];

    // Post 1: The Question
    templates.push({
      id: akId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Already Knows You — The Question (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 100px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:56px;font-weight:400;color:'+cl.text+';text-align:center;line-height:1.15;margin-bottom:48px;">What if your AI already knew the answer?</div>'
            + pillBlue(m, 'LifeAI')
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 2: The Stack
    templates.push({
      id: akId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Already Knows You — The Stack (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var layers = [
            { icon: 'identity', label: 'Identity' },
            { icon: 'memory', label: 'History' },
            { icon: 'memory', label: 'Memory' },
            { icon: 'focus', label: 'Context' }
          ];
          var stack = '';
          for (var i = 0; i < layers.length; i++) {
            var opacity = 1 - (i * 0.15);
            stack += '<div style="display:flex;align-items:center;gap:20px;padding:24px 32px;background:'+cl.surface+';border:1px solid '+cl.pillBorder+';border-radius:12px;opacity:'+opacity+';">'
              + '<div style="font-size:36px;font-weight:300;color:'+cl.accent+';width:40px;text-align:center;">' + (i + 1) + '</div>'
              + '<div style="font-size:24px;font-weight:500;color:'+cl.text+';letter-spacing:0.04em;">' + layers[i].label + '</div>'
              + '</div>';
          }
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 120px;">'
            + '<div style="font-size:14px;letter-spacing:0.25em;text-transform:uppercase;color:'+cl.muted+';margin-bottom:40px;font-weight:500;">What makes LifeAI different</div>'
            + '<div style="display:flex;flex-direction:column;gap:12px;width:100%;margin-bottom:40px;">' + stack + '</div>'
            + pillBlue(m, 'LifeAI')
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 3: Time Saving
    templates.push({
      id: akId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Already Knows You — Time Saving (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 100px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:52px;font-weight:400;color:'+cl.text+';text-align:center;line-height:1.15;margin-bottom:32px;">Skip the catch-up.<br>Start with the answer.</div>'
            + '<div style="font-size:20px;color:'+cl.secondary+';text-align:center;line-height:1.6;margin-bottom:40px;">LifeAI remembers so you don\'t have to repeat yourself.</div>'
            + pillBlue(m, 'LifeAI')
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 4: The Payoff
    templates.push({
      id: akId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Already Knows You — The Payoff (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 100px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:56px;font-weight:400;color:'+cl.text+';text-align:center;line-height:1.15;margin-bottom:48px;">Not a chatbot.<br>An intelligence that knows you.</div>'
            + logoIcon(m, 80)
            + '<div style="margin-top:32px;">' + pillBlue(m, 'LifeAI') + '</div>'
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });
  });
})();
```

- [ ] **Step 2: Verify in browser**

LifeAI Campaigns should now show 24 templates (16 Tax + 8 Already Knows You). Preview each new post. Verify:
- Post 1: Clean question, serif, centered
- Post 2: Four stacked layers with numbering and decreasing opacity
- Post 3: Two-line headline + subtext
- Post 4: Statement + logo + pill

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS
git add RoweOS/dist/social2.html
git commit -m "feat(social2): add 'Your AI Already Knows You' campaign (4 posts)"
```

---

### Task 5: Life Coach Spotlight Campaign (4 posts)

**Files:**
- Modify: `RoweOS/dist/social2.html` (add new IIFE after Campaign 2)

- [ ] **Step 1: Add Campaign 3 IIFE**

Insert after Campaign 2 closing `})();`:

```js
// Campaign 3: Life Coach Spotlight (4 posts)
(function() {
  var lcId = 7200;

  ['dark', 'light'].forEach(function(mode) {
    var c = COASTAL_BLUE[mode];

    // Post 1: Pain Point
    templates.push({
      id: lcId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Life Coach — Pain Point (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;border-top:4px solid #22c55e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 100px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:56px;font-weight:400;color:'+cl.text+';text-align:center;line-height:1.15;margin-bottom:48px;">Your goals deserve more than a notes app.</div>'
            + pillBlue(m, 'LifeAI')
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 2: Capabilities
    templates.push({
      id: lcId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Life Coach — Capabilities (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var caps = ['Goal setting', 'Habit tracking', 'Daily planning', 'Motivation', 'Life reviews'];
          var capList = '';
          for (var i = 0; i < caps.length; i++) {
            capList += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">'
              + checkIconBlue(m)
              + '<span style="font-size:20px;color:'+cl.text+';">' + caps[i] + '</span>'
              + '</div>';
          }
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;border-top:4px solid #22c55e;display:flex;flex-direction:column;justify-content:center;padding:80px 80px 60px;">'
            + '<div style="position:absolute;top:40px;left:40px;">' + logoIcon(m, 56) + '</div>'
            + '<div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">'
            + '<span style="font-size:28px;font-weight:600;color:'+cl.text+';">Life Coach</span>'
            + pillBlue(m, 'LifeAI')
            + '</div>'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:44px;font-weight:400;color:'+cl.text+';margin-bottom:48px;line-height:1.15;">Guidance for every chapter of your life.</div>'
            + capList
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 3: Memory Angle
    templates.push({
      id: lcId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Life Coach — Memory (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 100px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:52px;font-weight:400;color:'+cl.text+';text-align:center;line-height:1.15;margin-bottom:48px;">A coach that remembers every goal you\'ve ever set.</div>'
            + pillBlue(m, 'LifeAI')
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 4: Aspirational Closer
    templates.push({
      id: lcId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Life Coach — Never Forgets (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 100px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:48px;font-weight:400;color:'+cl.text+';text-align:center;line-height:1.15;margin-bottom:48px;">What would you do with a personal coach who never forgets?</div>'
            + logoIcon(m, 80)
            + '<div style="margin-top:32px;">' + pillBlue(m, 'LifeAI') + '</div>'
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });
  });
})();
```

- [ ] **Step 2: Verify in browser**

LifeAI Campaigns should now show 32 templates. Preview Life Coach posts. Verify:
- Post 1: Green (#22c55e) top border, serif headline
- Post 2: Green top border, capability checklist, logo top-left
- Post 3: Clean serif statement
- Post 4: Question + logo + pill

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS
git add RoweOS/dist/social2.html
git commit -m "feat(social2): add Life Coach Spotlight campaign (4 posts)"
```

---

### Task 6: Wellness Check-In Campaign (3 posts)

**Files:**
- Modify: `RoweOS/dist/social2.html` (add new IIFE after Campaign 3)

- [ ] **Step 1: Add Campaign 4 IIFE**

Insert after Campaign 3 closing `})();`:

```js
// Campaign 4: Wellness Check-In (3 posts)
(function() {
  var wcId = 7300;

  ['dark', 'light'].forEach(function(mode) {
    var c = COASTAL_BLUE[mode];

    // Post 1: The Prompt
    templates.push({
      id: wcId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Wellness — The Prompt (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;border-top:4px solid #06b6d4;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 100px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:52px;font-weight:400;color:'+cl.text+';text-align:center;line-height:1.15;margin-bottom:48px;">When was the last time you checked in with yourself?</div>'
            + pillBlue(m, 'LifeAI')
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 2: Capabilities
    templates.push({
      id: wcId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Wellness — Capabilities (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var caps = ['Fitness guidance', 'Nutrition advice', 'Sleep optimization', 'Stress management', 'Mental health'];
          var capList = '';
          for (var i = 0; i < caps.length; i++) {
            capList += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">'
              + checkIconBlue(m)
              + '<span style="font-size:20px;color:'+cl.text+';">' + caps[i] + '</span>'
              + '</div>';
          }
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;border-top:4px solid #06b6d4;display:flex;flex-direction:column;justify-content:center;padding:80px 80px 60px;">'
            + '<div style="position:absolute;top:40px;left:40px;">' + logoIcon(m, 56) + '</div>'
            + '<div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">'
            + '<span style="font-size:28px;font-weight:600;color:'+cl.text+';">Wellness</span>'
            + pillBlue(m, 'LifeAI')
            + '</div>'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:44px;font-weight:400;color:'+cl.text+';margin-bottom:48px;line-height:1.15;">Your health, optimized.</div>'
            + capList
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 3: Tagline
    templates.push({
      id: wcId++, category: 'lifeai-campaigns', mode: mode,
      label: 'Wellness — Tagline (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:64px;font-weight:300;color:'+cl.text+';text-align:center;margin-bottom:48px;">Your health, optimized.</div>'
            + logoIcon(m, 80)
            + '<div style="margin-top:32px;">' + pillBlue(m, 'LifeAI') + '</div>'
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });
  });
})();
```

- [ ] **Step 2: Verify in browser**

LifeAI Campaigns should now show 38 templates. Preview Wellness posts. Verify:
- Post 1: Cyan (#06b6d4) top border, reflective question
- Post 2: Cyan top border, capability checklist, logo top-left
- Post 3: Clean tagline + logo + pill

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS
git add RoweOS/dist/social2.html
git commit -m "feat(social2): add Wellness Check-In campaign (3 posts)"
```

---

### Task 7: "One Platform" Campaign (3 posts)

**Files:**
- Modify: `RoweOS/dist/social2.html` (add new IIFE after Campaign 4)

- [ ] **Step 1: Add Campaign 5 IIFE**

Insert after Campaign 4 closing `})();`:

```js
// Campaign 5: "One Platform, Every Part of Your Life" (3 posts)
(function() {
  var opId = 7400;

  var allCoaches = [
    { name: 'Tax Intelligence', color: '#f59e0b' },
    { name: 'Wellness', color: '#06b6d4' },
    { name: 'Life Coach', color: '#22c55e' },
    { name: 'Personal AI', color: '#a78bfa' },
    { name: 'Standard AI', color: '#b2997b' }
  ];

  var breadthWords = [
    { word: 'Taxes', color: '#f59e0b' },
    { word: 'Wellness', color: '#06b6d4' },
    { word: 'Goals', color: '#22c55e' },
    { word: 'Decisions', color: '#a78bfa' },
    { word: 'Conversation', color: '#b2997b' }
  ];

  ['dark', 'light'].forEach(function(mode) {
    var c = COASTAL_BLUE[mode];

    // Post 1: The Breadth
    templates.push({
      id: opId++, category: 'lifeai-campaigns', mode: mode,
      label: 'One Platform — The Breadth (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var words = '';
          for (var i = 0; i < breadthWords.length; i++) {
            words += '<div style="display:flex;align-items:center;gap:16px;">'
              + '<div style="width:12px;height:12px;border-radius:50%;background:'+breadthWords[i].color+';"></div>'
              + '<span style="font-family:\'Cormorant Garamond\',serif;font-size:40px;font-weight:400;color:'+cl.text+';">'+breadthWords[i].word+'</span>'
              + '</div>';
          }
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;">'
            + '<div style="display:flex;flex-direction:column;gap:16px;margin-bottom:48px;">' + words + '</div>'
            + pillBlue(m, 'LifeAI')
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 2: The Grid
    templates.push({
      id: opId++, category: 'lifeai-campaigns', mode: mode,
      label: 'One Platform — The Grid (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var cells = '';
          for (var i = 0; i < allCoaches.length; i++) {
            var coach = allCoaches[i];
            cells += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:'+cl.surface+';border-radius:12px;">'
              + '<div style="width:64px;height:64px;border-radius:50%;background:'+coach.color+'1a;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:28px;font-weight:600;color:'+coach.color+';">'
              + coach.name.charAt(0) + '</div>'
              + '<div style="font-size:16px;font-weight:500;color:'+cl.text+';margin-bottom:4px;text-align:center;">' + coach.name + '</div>'
              + '<div style="font-size:12px;color:'+cl.muted+';letter-spacing:0.08em;text-transform:uppercase;">Coach</div>'
              + '</div>';
          }
          cells += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:'+cl.surface+';border-radius:12px;">'
            + logoIcon(m, 48)
            + '<div style="font-size:16px;font-weight:500;color:'+cl.text+';margin-top:12px;">RoweOS</div>'
            + '</div>';
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 80px 60px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:48px;font-weight:400;color:'+cl.text+';text-align:center;margin-bottom:60px;">5 AI coaches.<br>One platform.</div>'
            + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;width:100%;">' + cells + '</div>'
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });

    // Post 3: The Close
    templates.push({
      id: opId++, category: 'lifeai-campaigns', mode: mode,
      label: 'One Platform — The Close (' + mode + ')',
      render: (function(m, cl) {
        return function() {
          var inner = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;">'
            + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:56px;font-weight:300;color:'+cl.text+';text-align:center;line-height:1.15;margin-bottom:48px;">Every part of your life.<br>One intelligence.</div>'
            + logoIcon(m, 80)
            + '<div style="margin-top:32px;">' + pillBlue(m, 'LifeAI') + '</div>'
            + '</div>';
          return cardWrapBlue(m, inner);
        };
      })(mode, c)
    });
  });
})();
```

- [ ] **Step 2: Verify in browser**

LifeAI Campaigns should now show **44 templates total** (22 designs x dark + light). Preview all One Platform posts. Verify:
- Post 1: Five words with colored dots, stacked vertically
- Post 2: 3x2 grid with coach initials in accent-colored circles + RoweOS logo cell
- Post 3: Clean serif closer with logo

- [ ] **Step 3: Final count verification**

Click "LifeAI Campaigns" in sidebar. Confirm count shows 44. Use the mode toggle to verify:
- "Light" filter: 22 templates
- "Dark" filter: 22 templates
- Template labels are prefixed by campaign name

- [ ] **Step 4: Test download**

Click "Download All (.zip)" while filtering LifeAI Campaigns. Verify ZIP contains a `LifeAI_Campaigns/` folder with 44 PNG files that render correctly.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS
git add RoweOS/dist/social2.html
git commit -m "feat(social2): add 'One Platform' campaign — all 44 LifeAI templates complete"
```

---

### Task 8: Deploy to Production

**Files:**
- Deploy: `RoweOS/dist/` directory to Vercel

- [ ] **Step 1: Deploy**

```bash
cd /Volumes/roweOS/RoweOS/dist
vercel --prod
```

- [ ] **Step 2: Verify on production**

Open `roweos.com/social2` in browser. Click "LifeAI Campaigns" category. Confirm:
- 44 templates visible
- Light/dark mode toggle works
- Download individual PNG works
- Download All ZIP works
- Coastal Blue palette renders correctly on light mode posts
- Midnight palette renders correctly on dark mode posts
- Disclaimer text appears on all Tax Season posts
- All pills read "LifeAI"
- Tax Intelligence naming used throughout (not Tax Copilot)
