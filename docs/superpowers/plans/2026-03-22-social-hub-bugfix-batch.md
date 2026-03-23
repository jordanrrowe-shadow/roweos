# Social Hub Bugfix Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 8 outstanding Social Hub bugs and add help icon, guided tour, and feedback button.

**Architecture:** Surgical edits to the monolithic `index.html` (181K lines), `social-callback.html`, and Cloud Functions. Each task targets specific line ranges. No refactoring, no new files (except Cloud Functions logging). ES5 only.

**Tech Stack:** Vanilla JS (ES5), Firebase/Firestore, Vercel serverless functions, X API v2

**Spec:** `docs/superpowers/specs/2026-03-22-social-hub-bugfix-batch-design.md`

**Critical rules (from CLAUDE.md):**
- ES5 only: no arrow functions, no let/const, no template literals
- No emojis: always inline SVG icons
- Brand names: `brands[idx].shortName || brands[idx].name`
- Tag changes with version: `// v25.5: Description`

---

### Task 1: Fix Draft Reply CORS (Bug #1)

**Files:**
- Modify: `RoweOS/dist/index.html:175610-175655`

- [ ] **Step 1: Add Anthropic CORS header**

At line 175618 (after `headers['anthropic-version'] = '2023-06-01';`), add:

```javascript
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
```

- [ ] **Step 2: Update OpenAI endpoint and request format**

Replace lines 175621-175623:
```javascript
  } else if (provider === 'openai') {
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = 'Bearer ' + apiKey;
    body = { model: model, max_tokens: 300, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] };
```

With:
```javascript
  } else if (provider === 'openai') {
    // v25.5: Use /v1/responses endpoint (matches callStudioAPI)
    apiUrl = 'https://api.openai.com/v1/responses';
    headers['Authorization'] = 'Bearer ' + apiKey;
    body = { model: model, max_output_tokens: 300, input: [{ role: 'developer', content: systemPrompt }, { role: 'user', content: userPrompt }] };
```

- [ ] **Step 3: Update OpenAI response parsing**

Replace line 175634:
```javascript
      else if (provider === 'openai' && data.choices) draft = data.choices[0].message.content;
```

With:
```javascript
      // v25.5: /v1/responses format
      else if (provider === 'openai' && data.output) draft = data.output[0].content[0].text;
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: add CORS header to draftEngageReply, update OpenAI to /v1/responses"
```

---

### Task 2: Fix Like Endpoint + Store X User ID (Bug #2)

**Files:**
- Modify: `RoweOS/dist/social-callback.html:409-413`
- Modify: `RoweOS/dist/index.html:175657-175694`

- [ ] **Step 1: Store X user ID in social-callback.html**

In `social-callback.html`, after line 410 (`var handle = user.data && user.data.username ? user.data.username : '';`), add code to store the user ID and update the token data:

```javascript
          // v25.5: Store X numeric userId for API calls (likes, etc.)
          var xUserId = user.data && user.data.id ? user.data.id : '';
          if (xUserId) {
            try {
              var existingToken = JSON.parse(localStorage.getItem('roweos_social_token_x' + scope) || '{}');
              existingToken.userId = xUserId;
              localStorage.setItem('roweos_social_token_x' + scope, JSON.stringify(existingToken));
              // v25.5: Also persist to Firestore for cross-device PWA access
              if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
                var fuid = firebase.auth().currentUser.uid;
                firebase.firestore().doc('roweos_users/' + fuid + '/social_tokens/x' + scope).set({ userId: xUserId }, { merge: true });
              }
            } catch(e) {}
          }
```

- [ ] **Step 2: Update likeEngagePost to use userId instead of /me**

Replace the token reading section and fetch call in `likeEngagePost` (lines 175665-175683). Replace:

```javascript
  var token = '';
  try {
    var scope = typeof getSocialKeyScope === 'function' ? getSocialKeyScope() : '_brand_0';
    var stored = localStorage.getItem('roweos_social_token_x' + scope);
    if (stored) { var parsed = JSON.parse(stored); token = parsed.accessToken || ''; }
  } catch(e) {}

  if (!token) { showToast('Connect X to like posts', 'error'); return; }

  // Like via proxy
  fetch('/api/x-dm-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'POST',
      endpoint: '/2/users/me/likes',
      token: token,
      body: { tweet_id: target.postId }
    })
  })
```

With:

```javascript
  // v25.5: Read token + userId for likes endpoint
  var token = '';
  var xUserId = '';
  try {
    var scope = typeof getSocialKeyScope === 'function' ? getSocialKeyScope() : '_brand_0';
    var stored = localStorage.getItem('roweos_social_token_x' + scope);
    if (stored) { var parsed = JSON.parse(stored); token = parsed.accessToken || ''; xUserId = parsed.userId || ''; }
  } catch(e) {}

  if (!token) { showToast('Connect X to like posts', 'error'); return; }

  // v25.5: Fallback — fetch userId via /2/users/me if not stored (pre-fix connections)
  var likeWithUserId = function(userId) {
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'POST',
        endpoint: '/2/users/' + userId + '/likes',
        token: token,
        body: { tweet_id: target.postId }
      })
    })
```

Then after the existing `.catch` handler (around line 175694), add the userId resolution:

```javascript
  };

  if (xUserId) {
    likeWithUserId(xUserId);
  } else {
    // v25.5: Fetch and cache userId for pre-fix connections
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'GET', endpoint: '/2/users/me', token: token })
    }).then(function(r) { return r.json(); }).then(function(user) {
      var id = user.data && user.data.id ? user.data.id : '';
      if (id) {
        try {
          var scope = typeof getSocialKeyScope === 'function' ? getSocialKeyScope() : '_brand_0';
          var existing = JSON.parse(localStorage.getItem('roweos_social_token_x' + scope) || '{}');
          existing.userId = id;
          localStorage.setItem('roweos_social_token_x' + scope, JSON.stringify(existing));
        } catch(e) {}
        likeWithUserId(id);
      } else {
        showToast('Could not get X user ID. Reconnect in Settings.', 'error');
      }
    }).catch(function() { showToast('Like failed: could not resolve user ID', 'error'); });
  }
```

- [ ] **Step 3: Add visual like state to button**

In the `likeEngagePost` success handler, after the `showToast('Liked...')` line, add:

```javascript
      // v25.5: Visual feedback — toggle heart fill
      try {
        var btn = document.querySelector('[data-like-target="' + targetId + '"]');
        if (btn) { btn.style.color = 'var(--accent)'; btn.setAttribute('data-liked', 'true'); }
      } catch(e) {}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html RoweOS/dist/social-callback.html && git commit -m "fix: store X userId in token, use /2/users/{id}/likes endpoint"
```

---

### Task 3: Fix X Token Disconnected on Reload (Bug #3)

**Files:**
- Modify: `RoweOS/dist/index.html:103318-103326` (getSocialKeyScope)
- Modify: `RoweOS/dist/index.html:177256-177362` (renderSocialSettings)

- [ ] **Step 1: Ensure selectedBrand is initialized early**

Check `getSocialKeyScope()` at line 103318. It already has a localStorage fallback:
```javascript
var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : parseInt(localStorage.getItem('roweos_selected_brand') || '0');
```

The issue is that `selectedBrand` is declared as `var selectedBrand = 0;` at line 63334, so `typeof selectedBrand !== 'undefined'` is always true and returns `0` before `initializeBrands()` sets it to the saved value.

Fix: In `getSocialKeyScope()`, replace:
```javascript
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : parseInt(localStorage.getItem('roweos_selected_brand') || '0');
```
With:
```javascript
  // v25.5: Always read from localStorage — it is the source of truth and avoids
  // race condition where selectedBrand=0 (default) before initializeBrands() runs
  var brandIdx = parseInt(localStorage.getItem('roweos_selected_brand') || '0');
```

- [ ] **Step 2: Refresh connection status when Settings tab opens**

Find `renderSocialSettings()` (line ~177256). At the top of the function (after the guard), add:

```javascript
  // v25.5: Re-read brand scope to ensure correct connection status after page reload
  var currentScope = getSocialKeyScope();
```

This ensures the scope is recalculated each time Settings opens, not cached from init.

Also find the `showSocialTab` function. Add a call to re-render settings when switching to the settings tab:

```javascript
  if (tab === 'settings') renderSocialSettings();
```

(This may already exist -- verify and add only if missing.)

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: use localStorage for brand scope on reload, refresh settings on tab open"
```

---

### Task 4: Engage Starts Empty + Load Feed Button (Bug #4)

**Files:**
- Modify: `RoweOS/dist/index.html:57484-57514` (Engage tab HTML)
- Modify: `RoweOS/dist/index.html:175234-175241` (engageState)
- Modify: `RoweOS/dist/index.html:175260-175289` (initEngageTab)
- Modify: `RoweOS/dist/index.html:175316-175319` (searchEngagePosts)

- [ ] **Step 1: Add Load Feed button to Engage HTML**

After the Clear button (line 57492), add a Load Feed button:

```html
          <button id="engageLoadFeedBtn" onclick="loadEngageFeed()" style="padding:8px 14px;border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:13px;">Load Feed</button>
```

- [ ] **Step 2: Update empty state message**

Replace line 57512-57513:
```html
      <div id="engageEmptyState" style="text-align:center;padding:40px;color:var(--text-tertiary);">
        Search for posts or wait for the automated pipeline to find targets.
```

With:
```html
      <div id="engageEmptyState" style="text-align:center;padding:40px;color:var(--text-tertiary);">
        Search for posts or click Load Feed to see your pipeline targets.
```

- [ ] **Step 3: Remove auto-listener from initEngageTab**

Replace `initEngageTab()` (lines 175260-175289) with:

```javascript
function initEngageTab() {
  if (!firebase.auth().currentUser) return;
  // v25.5: Render keyword pills but don't auto-load feed — starts empty
  renderEngageKeywordPills();
}
```

- [ ] **Step 4: Add loadEngageFeed function**

After the new `initEngageTab`, add:

```javascript
// v25.5: Load Feed button — attaches Firestore listener on demand
function loadEngageFeed() {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();

  // Detach old listener if exists
  if (engageState.listener) engageState.listener();

  engageState.listener = db.collection('roweos_users/' + uid + '/scavenger_targets')
    .orderBy('discoveredAt', 'desc')
    .limit(engageState.pageSize)
    .onSnapshot(function(snap) {
      engageState.targets = [];
      engageState.lastDoc = null;
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        engageState.targets.push(data);
        engageState.lastDoc = doc;
      });
      renderEngageFeed();
    }, function(err) {
      console.warn('[Engage] Listener error:', err);
    });
}
```

- [ ] **Step 5: Update searchEngagePosts — remove cleared logic and auto-listener**

Replace lines 175317-175319:
```javascript
  // v25.4: Reset cleared state and re-init listener
  engageState.cleared = false;
  if (!engageState.listener) initEngageTab();
```

With:
```javascript
  // v25.5: Search runs independently — no auto-listener attachment
```

- [ ] **Step 6: Remove engageState.cleared references**

Search for all references to `engageState.cleared` in the file and remove them. Check around lines 175269, 175318, 175717 (clearEngageSearch function). In `clearEngageSearch`, remove the line that sets `engageState.cleared = true` and instead just clear targets and detach listener:

Find the `clearEngageSearch` function and update it to:
```javascript
function clearEngageSearch() {
  // v25.5: Detach listener and clear feed
  if (engageState.listener) { engageState.listener(); engageState.listener = null; }
  engageState.targets = [];
  engageState.lastDoc = null;
  renderEngageFeed();
  var input = document.getElementById('engageSearchInput');
  if (input) input.value = '';
}
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: engage starts empty, add Load Feed button, remove auto-listener"
```

---

### Task 5: Fix Publish Image Posting (Bug #5)

**Files:**
- Modify: `RoweOS/dist/index.html:177580-177635` (publishPostNow)

- [ ] **Step 1: Update the early-return guard**

Replace lines 177581-177585:
```javascript
  var caption = document.getElementById('publishCaption');
  if (!caption || !caption.value.trim()) {
    showToast('Enter a caption first', 'error');
    return;
  }
```

With:
```javascript
  var caption = document.getElementById('publishCaption');
  var hasContent = caption && caption.value.trim();
  var hasImage = !!_publishAttachedImage;
  // v25.5: Allow image-only posts (no caption required if image attached)
  if (!hasContent && !hasImage) {
    showToast('Enter a caption or attach an image', 'error');
    return;
  }
```

- [ ] **Step 2: Set globals before calling postToSocial**

Replace lines 177603-177610 (the toast and loop start through the postToSocial call):

```javascript
  showToast('Posting to ' + platforms.join(', ') + '...', 'info');

  var posted = 0;
  var errors = [];
  for (var j = 0; j < platforms.length; j++) {
    (function(p) {
      var platContent = getPublishTextForPlatform(p);
      postToSocial(p, platContent, { image: _publishAttachedImage })
```

With:

```javascript
  // v25.5: Set globals that postToSocial reads (correct 2-arg calling convention)
  var content = caption ? caption.value.trim() : '';
  window._socialPublisherContent = content;
  window._socialPublisherImage = _publishAttachedImage || null;
  // v25.5: Always build per-platform edited content map to avoid edge cases
  window._socialPublisherEditedContent = {};
  for (var pi = 0; pi < platforms.length; pi++) {
    window._socialPublisherEditedContent[platforms[pi]] = getPublishTextForPlatform(platforms[pi]);
  }

  showToast('Posting to ' + platforms.join(', ') + '...', 'info');

  var posted = 0;
  var errors = [];
  for (var j = 0; j < platforms.length; j++) {
    (function(p) {
      postToSocial(p, { silent: false })
```

- [ ] **Step 3: Clear globals after posting**

After the loop (around line 177629), before the "Clear compose area" comment, add:

```javascript
  // v25.5: Clear publisher globals after all posts dispatched
  window._socialPublisherContent = '';
  window._socialPublisherImage = null;
  window._socialPublisherEditedContent = null;
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: set publisher globals before postToSocial, allow image-only posts"
```

---

### Task 6: Scavenger Pipeline Diagnostics (Bug #6)

**Files:**
- Modify: `functions/index.js:34-96`
- Modify: `functions/lib/scavenger.js:69-400`

- [ ] **Step 1: Add entry-point logging in index.js**

In `functions/index.js`, around line 78 where scavenger configs are loaded, enhance the logging:

Before the scavenger call block, add:
```javascript
      // v25.5: Diagnostic logging for scavenger pipeline
      var userSettings = await helpers.getUserSettings(user.uid);
      if (!userSettings || !userSettings.cloudSchedulerEnabled) {
        console.warn('[Scavenger:' + user.uid.slice(0,6) + '] SKIPPED — cloudSchedulerEnabled is ' + (userSettings ? userSettings.cloudSchedulerEnabled : 'missing'));
        continue;
      }
      console.log('[Scavenger:' + user.uid.slice(0,6) + '] Pipeline starting — ' + scavengerConfigs.length + ' configs, autoPostThreshold: ' + (scavengerConfigs[0].autoPostThreshold || 'not set'));
```

- [ ] **Step 2: Add logging to stepPoll in scavenger.js**

At the start of `stepPoll` (line 69), add:
```javascript
  var tag = '[Scavenger:' + uid.slice(0,6) + ':poll]';
  console.log(tag + ' Starting poll for config "' + config.name + '", keywords: ' + (Array.isArray(config.keywords) ? config.keywords.join(', ') : config.keywords));
```

At the end of stepPoll (before return), add:
```javascript
  console.log(tag + ' Poll complete — ' + newTargets + ' new targets created');
```

- [ ] **Step 3: Add logging to stepScore**

At start of `stepScore` (line 176):
```javascript
  var tag = '[Scavenger:' + uid.slice(0,6) + ':score]';
```

After scoring loop:
```javascript
  console.log(tag + ' Scored ' + scored + ' targets — min: ' + minScore + ', max: ' + maxScore + ', avg: ' + avgScore);
```

- [ ] **Step 4: Add logging to stepDraft**

At start of `stepDraft` (line 230):
```javascript
  var tag = '[Scavenger:' + uid.slice(0,6) + ':draft]';
  console.log(tag + ' Drafting — threshold: ' + (config.autoPostThreshold || 'none') + ', model: ' + (config.aiModel || 'default'));
```

After drafting:
```javascript
  console.log(tag + ' Drafted ' + successCount + ' replies, ' + failCount + ' failures');
```

- [ ] **Step 5: Add logging to stepDecide**

At start of `stepDecide` (line 316):
```javascript
  var tag = '[Scavenger:' + uid.slice(0,6) + ':decide]';
```

After decisions:
```javascript
  console.log(tag + ' Decisions — auto_approved: ' + autoCount + ', pending_review: ' + pendingCount);
```

- [ ] **Step 6: Add logging to stepPost**

At start of `stepPost` (line 342):
```javascript
  var tag = '[Scavenger:' + uid.slice(0,6) + ':post]';
```

Check token:
```javascript
  if (!token || !token.accessToken) {
    console.error(tag + ' NO X TOKEN — cannot post. User needs to reconnect X.');
    return;
  }
  if (token.expiresAt && token.expiresAt < Date.now()) {
    console.error(tag + ' X TOKEN EXPIRED at ' + new Date(token.expiresAt).toISOString());
    return;
  }
```

Rate limit check -- add logging AROUND the existing rate-limit condition in `stepPost`. The agent must read the actual rate-limit logic at line 342+ and insert logging before the existing check:
```javascript
  console.log(tag + ' Rate limit check — posted last hour: ' + hourCount + '/' + (config.maxPerHour || 'unlimited') + ', today: ' + dayCount + '/' + (config.maxPerDay || 'unlimited'));
```
And inside the existing rate-limit branch (where it returns early), add:
```javascript
    console.warn(tag + ' RATE LIMITED — skipping post');
```

After each post attempt:
```javascript
  console.log(tag + ' Posted reply to @' + target.authorHandle + ' — postId: ' + result.postId);
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/roweOS && git add functions/index.js functions/lib/scavenger.js && git commit -m "fix: add diagnostic logging to scavenger pipeline"
```

---

### Task 7: Custom Keyword Groupings (Bug #7)

**Files:**
- Modify: `RoweOS/dist/index.html:57484-57498` (Engage tab HTML)
- Modify: `RoweOS/dist/index.html:175291-175307` (renderEngageKeywordPills)
- Modify: `RoweOS/dist/index.html` (Settings scavenger config editor)

- [ ] **Step 1: Add keyword group dropdown to Engage HTML**

Before the keyword pills toggle (line 57494), add a dropdown:

```html
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <select id="engageKeywordGroupSelect" onchange="filterEngageKeywordGroup()" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;font-family:inherit;">
            <option value="all">All Keywords</option>
          </select>
          <div style="display:flex;align-items:center;gap:4px;cursor:pointer;" onclick="toggleEngageKeywords()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" id="engageKeywordsChevron" style="transition:transform 0.2s;transform:rotate(-90deg);"><polyline points="6 9 12 15 18 9"/></svg>
            <span style="font-size:12px;color:var(--text-tertiary);">Keywords</span>
          </div>
        </div>
```

And remove the old toggle (lines 57494-57497) since it's now inside the new div.

- [ ] **Step 2: Update renderEngageKeywordPills to support group filtering**

Replace `renderEngageKeywordPills()` (lines 175291-175307) with:

```javascript
// v25.5: Render keyword pills with group filter support
function renderEngageKeywordPills(groupFilter) {
  var el = document.getElementById('engageKeywordPills');
  var select = document.getElementById('engageKeywordGroupSelect');
  if (!el) return;
  var configs = typeof getScavengerConfigs === 'function' ? getScavengerConfigs() : [];
  var html = '';

  // Populate group dropdown
  if (select) {
    var groupHtml = '<option value="all">All Keywords</option>';
    for (var c = 0; c < configs.length; c++) {
      var groups = configs[c].keywordGroups || [];
      for (var g = 0; g < groups.length; g++) {
        groupHtml += '<option value="' + escapeHtml(groups[g].name) + '">' + escapeHtml(groups[g].name) + '</option>';
      }
    }
    select.innerHTML = groupHtml;
    if (groupFilter && groupFilter !== 'all') select.value = groupFilter;
  }

  // Build allowed keywords set for current group
  var allowedKeywords = null; // null = all
  if (groupFilter && groupFilter !== 'all') {
    allowedKeywords = {};
    for (var c2 = 0; c2 < configs.length; c2++) {
      var grps = configs[c2].keywordGroups || [];
      for (var g2 = 0; g2 < grps.length; g2++) {
        if (grps[g2].name === groupFilter) {
          var gkws = grps[g2].keywords || [];
          for (var k = 0; k < gkws.length; k++) allowedKeywords[gkws[k].toLowerCase().trim()] = true;
        }
      }
    }
  }

  for (var i = 0; i < configs.length; i++) {
    var kws = configs[i].keywords;
    if (typeof kws === 'string') kws = kws.split(',');
    if (!Array.isArray(kws)) continue;
    for (var j = 0; j < kws.length; j++) {
      var kw = kws[j].trim();
      if (!kw) continue;
      if (allowedKeywords && !allowedKeywords[kw.toLowerCase()]) continue;
      html += '<button class="scavenger-keyword-pill" onclick="quickEngageSearch(\'' + escapeHtml(kw).replace(/'/g, "\\'") + '\')" style="cursor:pointer;border:none;">' + escapeHtml(kw) + '</button>';
    }
  }
  el.innerHTML = html || '<span style="font-size:12px;color:var(--text-tertiary);">No keywords in this group</span>';
}
```

- [ ] **Step 3: Add group filter function**

After `renderEngageKeywordPills`, add:

```javascript
function filterEngageKeywordGroup() {
  var select = document.getElementById('engageKeywordGroupSelect');
  var group = select ? select.value : 'all';
  renderEngageKeywordPills(group);
}
```

- [ ] **Step 4: Update searchEngagePosts to use group-filtered keywords**

In `searchEngagePosts()`, the search input is used directly (user types or keyword pill fills it). The group filtering already affects which keyword pills are visible (Step 2), so pill clicks will only trigger searches for group-filtered keywords. No changes needed to `searchEngagePosts()` itself -- it searches whatever text is in the input field. The group dropdown controls which pills are shown, which controls what gets searched via `quickEngageSearch()`.

No code changes needed for this step -- the architecture handles it through the pill filtering in Step 2.

- [ ] **Step 5: Add keyword groups UI to Settings scavenger config editor**

Find the scavenger config editor section in Settings. After the keywords input field, add a "Keyword Groups" section:

```javascript
  // v25.5: Keyword Groups editor
  html += '<div style="margin-top:12px;"><label style="font-size:13px;color:var(--text-secondary);font-weight:500;">Keyword Groups</label>';
  var groups = config.keywordGroups || [];
  for (var gi = 0; gi < groups.length; gi++) {
    html += '<div class="keyword-group-row" data-group-idx="' + gi + '" style="display:flex;gap:8px;align-items:center;margin-top:8px;">';
    html += '<input type="text" value="' + escapeHtml(groups[gi].name) + '" placeholder="Group name" style="width:120px;padding:6px 8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;">';
    // Keyword checkboxes
    var allKws = typeof config.keywords === 'string' ? config.keywords.split(',') : (config.keywords || []);
    for (var ki = 0; ki < allKws.length; ki++) {
      var kwTrimmed = allKws[ki].trim();
      if (!kwTrimmed) continue;
      var checked = (groups[gi].keywords || []).indexOf(kwTrimmed) >= 0 ? ' checked' : '';
      html += '<label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:2px;"><input type="checkbox" value="' + escapeHtml(kwTrimmed) + '"' + checked + '>' + escapeHtml(kwTrimmed) + '</label>';
    }
    html += '<button onclick="removeKeywordGroup(this,' + gi + ')" style="padding:2px 6px;border:none;background:none;color:var(--text-tertiary);cursor:pointer;font-size:16px;">x</button>';
    html += '</div>';
  }
  html += '<button onclick="addKeywordGroup(this)" style="margin-top:8px;padding:4px 12px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;font-size:12px;">+ Add Group</button>';
  html += '</div>';
```

- [ ] **Step 6: Add addKeywordGroup and removeKeywordGroup functions**

**Agent instructions:** Before writing these functions, read the existing scavenger config editor code. Search for `renderScavengerConfig` or `saveScavengerConfig` in index.html to understand how the Settings config editor renders and saves. The add/remove functions must follow the same pattern (DOM-based or state-object-based). The functions should:

- `addKeywordGroup`: Append a new empty group row to the keyword groups section in the DOM. The row should have a name input and keyword checkboxes (matching Step 5 HTML structure).
- `removeKeywordGroup`: Remove the group row from the DOM by index. On next save, the group will not be included.

Both are purely DOM manipulations -- the actual persistence happens in Step 7 when the save function runs.

- [ ] **Step 7: Save keyword groups with config**

In the scavenger config save function, extract `keywordGroups` from the DOM group rows and include it in the Firestore write:

```javascript
  // v25.5: Extract keyword groups
  var groupRows = configEditor.querySelectorAll('.keyword-group-row');
  var keywordGroups = [];
  for (var gi = 0; gi < groupRows.length; gi++) {
    var nameInput = groupRows[gi].querySelector('input[type="text"]');
    var checkboxes = groupRows[gi].querySelectorAll('input[type="checkbox"]:checked');
    var groupKws = [];
    for (var ci = 0; ci < checkboxes.length; ci++) groupKws.push(checkboxes[ci].value);
    if (nameInput && nameInput.value.trim()) {
      keywordGroups.push({ name: nameInput.value.trim(), keywords: groupKws });
    }
  }
  configData.keywordGroups = keywordGroups;
```

- [ ] **Step 8: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add keyword category groupings to Engage and Settings"
```

---

### Task 8: Fix Create Chat Brand Scoping (Bug #8)

**Files:**
- Modify: `RoweOS/dist/index.html:176916-176941` (_buildCreateSystemPrompt)
- Modify: `RoweOS/dist/index.html:175572-175610` (draftEngageReply brand refs)

- [ ] **Step 1: Fix _buildCreateSystemPrompt**

The function at line 176923 reads `var idx = settings.activeBrandIndex || 0;`. The issue: `settings.activeBrandIndex` may be stale or not in sync with `selectedBrand`. Replace:

```javascript
    var idx = settings.activeBrandIndex || 0;
```

With:

```javascript
    // v25.5: Read from localStorage (source of truth) instead of potentially stale settings
    var idx = parseInt(localStorage.getItem('roweos_selected_brand') || '0');
```

- [ ] **Step 2: Check draftEngageReply for brand references**

Read `draftEngageReply()` (lines 175572-175610) to see if it references brand data. If it builds a system prompt that mentions the brand, ensure it uses `brands[selectedBrand]`. Based on the code, it reads from scavenger config (tone, keywords) not brand data directly -- but verify and fix if needed.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: use live selectedBrand in Create tab system prompt"
```

---

### Task 9: Help Icon + Feedback Button

**Files:**
- Modify: `RoweOS/dist/index.html:57447-57465` (Social Hub header HTML)
- Modify: `RoweOS/dist/index.html` (add CSS + JS functions)

- [ ] **Step 1: Add help and feedback buttons to Social Hub header**

After the panel-description line (line 57456), add:

```html
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button id="socialHelpBtn" onclick="showSocialHelp()" title="Help" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </button>
      <button id="socialFeedbackBtn" onclick="showSocialFeedback()" title="Feedback" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
    </div>
```

- [ ] **Step 2: Add help modal HTML**

After the Social Hub view closing div, add the help modal:

```html
    <!-- v25.5: Social Hub Help Modal -->
    <div id="socialHelpModal" class="modal-overlay" style="display:none;">
      <div class="modal-content" style="max-width:480px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:600;color:var(--text-primary);">Social Hub Guide</h3>
          <button onclick="closeSocialHelp()" style="border:none;background:none;color:var(--text-secondary);cursor:pointer;font-size:18px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div><strong style="color:var(--accent);">Publish</strong><br><span style="color:var(--text-secondary);font-size:13px;">Post content to your connected social accounts</span></div>
          <div><strong style="color:var(--accent);">Engage</strong><br><span style="color:var(--text-secondary);font-size:13px;">Find and reply to relevant posts in your niche</span></div>
          <div><strong style="color:var(--accent);">Create</strong><br><span style="color:var(--text-secondary);font-size:13px;">AI-powered content drafting and DMs</span></div>
          <div><strong style="color:var(--accent);">Blog</strong><br><span style="color:var(--text-secondary);font-size:13px;">Write and publish blog content with AI assistance</span></div>
          <div><strong style="color:var(--accent);">Analytics</strong><br><span style="color:var(--text-secondary);font-size:13px;">Track post performance and audience insights</span></div>
          <div><strong style="color:var(--accent);">Settings</strong><br><span style="color:var(--text-secondary);font-size:13px;">Connect social accounts and configure automation</span></div>
        </div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border-color);text-align:center;">
          <a href="#" onclick="replaySocialTour(); return false;" style="font-size:12px;color:var(--text-tertiary);">Replay guided tour</a>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Add help modal JS functions**

```javascript
// v25.5: Social Hub Help
function showSocialHelp() {
  var modal = document.getElementById('socialHelpModal');
  if (modal) modal.style.display = 'flex';
}

function closeSocialHelp() {
  var modal = document.getElementById('socialHelpModal');
  if (modal) modal.style.display = 'none';
  localStorage.setItem('roweos_social_help_dismissed', 'true');
}
```

- [ ] **Step 4: Add feedback form HTML**

After the help modal, add:

```html
    <!-- v25.5: Social Hub Feedback Form -->
    <div id="socialFeedbackModal" class="modal-overlay" style="display:none;">
      <div class="modal-content" style="max-width:400px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:600;color:var(--text-primary);">Feedback</h3>
          <button onclick="closeSocialFeedback()" style="border:none;background:none;color:var(--text-secondary);cursor:pointer;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:12px;">
          <button id="feedbackThumbUp" onclick="setSocialFeedbackSentiment('positive')" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);cursor:pointer;color:var(--text-secondary);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          </button>
          <button id="feedbackThumbDown" onclick="setSocialFeedbackSentiment('negative')" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);cursor:pointer;color:var(--text-secondary);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
          </button>
        </div>
        <textarea id="socialFeedbackText" rows="4" placeholder="What's on your mind?" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>
        <button onclick="submitSocialFeedback()" style="margin-top:12px;width:100%;padding:10px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:14px;font-weight:500;">Submit</button>
      </div>
    </div>
```

- [ ] **Step 5: Add feedback JS functions**

```javascript
// v25.5: Social Hub Feedback
var _socialFeedbackSentiment = '';

function showSocialFeedback() {
  var modal = document.getElementById('socialFeedbackModal');
  if (modal) modal.style.display = 'flex';
  _socialFeedbackSentiment = '';
}

function closeSocialFeedback() {
  var modal = document.getElementById('socialFeedbackModal');
  if (modal) modal.style.display = 'none';
}

function setSocialFeedbackSentiment(val) {
  _socialFeedbackSentiment = val;
  var up = document.getElementById('feedbackThumbUp');
  var down = document.getElementById('feedbackThumbDown');
  if (up) up.style.borderColor = val === 'positive' ? 'var(--accent)' : 'var(--border-color)';
  if (down) down.style.borderColor = val === 'negative' ? '#e74c3c' : 'var(--border-color)';
}

function submitSocialFeedback() {
  // v25.5: Rate limit — one per 60 seconds
  var lastSubmit = parseInt(localStorage.getItem('roweos_feedback_last') || '0');
  if (Date.now() - lastSubmit < 60000) {
    showToast('Please wait before submitting again', 'info');
    return;
  }

  var text = document.getElementById('socialFeedbackText');
  if (!text || !text.value.trim()) {
    showToast('Please enter feedback', 'error');
    return;
  }
  if (!_socialFeedbackSentiment) {
    showToast('Please select thumbs up or down', 'error');
    return;
  }

  var user = firebase.auth().currentUser;
  if (!user) return;

  firebase.firestore().collection('roweos_feedback').add({
    uid: user.uid,
    section: 'social_hub',
    text: text.value.trim(),
    sentiment: _socialFeedbackSentiment,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    version: typeof ROWEOS_VERSION !== 'undefined' ? ROWEOS_VERSION : ''
  }).then(function() {
    showToast('Thanks for the feedback!', 'success');
    localStorage.setItem('roweos_feedback_last', String(Date.now()));
    text.value = '';
    _socialFeedbackSentiment = '';
    closeSocialFeedback();
  }).catch(function(err) {
    showToast('Failed to submit: ' + err.message, 'error');
  });
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add help icon and feedback button to Social Hub"
```

---

### Task 10: Guided Tour

**Files:**
- Modify: `RoweOS/dist/index.html` (CSS, HTML, JS)

- [ ] **Step 1: Add tour overlay CSS**

In the CSS section (before line ~15000), add:

```css
/* v25.5: Social Hub Guided Tour */
.social-tour-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7); z-index: 10000;
}
.social-tour-spotlight {
  position: absolute; box-shadow: 0 0 0 9999px rgba(0,0,0,0.7);
  border-radius: 8px; z-index: 10001;
}
.social-tour-tooltip {
  position: absolute; background: var(--bg-primary);
  border: 1px solid var(--border-color); border-radius: 12px;
  padding: 16px; max-width: 280px; z-index: 10002;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.social-tour-tooltip h4 { margin: 0 0 4px; font-size: 14px; color: var(--accent); }
.social-tour-tooltip p { margin: 0 0 12px; font-size: 13px; color: var(--text-secondary); }
.social-tour-actions { display: flex; gap: 8px; justify-content: flex-end; }
.social-tour-actions button { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; }
.social-tour-skip { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color) !important; }
.social-tour-next { background: var(--accent); color: #fff; }
```

- [ ] **Step 2: Add tour JS**

```javascript
// v25.5: Social Hub Guided Tour
var _socialTourSteps = [
  { tab: 'settings', title: 'Settings', desc: 'Connect your social accounts here' },
  { tab: 'publish', title: 'Publish', desc: 'Post content to all your platforms at once' },
  { tab: 'engage', title: 'Engage', desc: 'Find relevant posts and draft replies' },
  { tab: 'create', title: 'Create', desc: 'Use AI to craft content and manage DMs' },
  { tab: 'blog', title: 'Blog', desc: 'Write blog posts with AI assistance' },
  { tab: 'analytics', title: 'Analytics', desc: 'Track your social performance' }
];
var _socialTourStep = 0;

function startSocialTour() {
  if (localStorage.getItem('roweos_social_tour_complete') === 'true') return;
  _socialTourStep = 0;
  showSocialTourStep();
}

function showSocialTourStep() {
  // Remove previous
  var old = document.getElementById('socialTourOverlay');
  if (old) old.remove();

  if (_socialTourStep >= _socialTourSteps.length) {
    localStorage.setItem('roweos_social_tour_complete', 'true');
    return;
  }

  var step = _socialTourSteps[_socialTourStep];
  var tabBtn = document.querySelector('.social-hub-tab[data-tab="' + step.tab + '"]');
  if (!tabBtn) { _socialTourStep++; showSocialTourStep(); return; }

  var rect = tabBtn.getBoundingClientRect();

  var overlay = document.createElement('div');
  overlay.id = 'socialTourOverlay';
  overlay.className = 'social-tour-overlay';

  var spotlight = document.createElement('div');
  spotlight.className = 'social-tour-spotlight';
  spotlight.style.top = (rect.top - 4) + 'px';
  spotlight.style.left = (rect.left - 4) + 'px';
  spotlight.style.width = (rect.width + 8) + 'px';
  spotlight.style.height = (rect.height + 8) + 'px';

  var tooltip = document.createElement('div');
  tooltip.className = 'social-tour-tooltip';
  tooltip.style.top = (rect.bottom + 12) + 'px';
  tooltip.style.left = Math.max(8, rect.left) + 'px';
  tooltip.innerHTML = '<h4>' + step.title + '</h4>'
    + '<p>' + step.desc + '</p>'
    + '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px;">' + (_socialTourStep + 1) + ' of ' + _socialTourSteps.length + '</div>'
    + '<div class="social-tour-actions">'
    + '<button class="social-tour-skip" onclick="skipSocialTour()">Skip</button>'
    + '<button class="social-tour-next" onclick="nextSocialTourStep()">' + (_socialTourStep < _socialTourSteps.length - 1 ? 'Next' : 'Done') + '</button>'
    + '</div>';

  overlay.appendChild(spotlight);
  overlay.appendChild(tooltip);
  document.body.appendChild(overlay);
}

function nextSocialTourStep() {
  _socialTourStep++;
  showSocialTourStep();
}

function skipSocialTour() {
  var old = document.getElementById('socialTourOverlay');
  if (old) old.remove();
  localStorage.setItem('roweos_social_tour_complete', 'true');
}

function replaySocialTour() {
  closeSocialHelp();
  localStorage.removeItem('roweos_social_tour_complete');
  _socialTourStep = 0;
  showSocialTourStep();
}
```

- [ ] **Step 3: Trigger tour after first social connection**

In the Settings tab, find where a successful social connection is confirmed (after OAuth callback writes `_connected` to localStorage). Add a check:

```javascript
  // v25.5: Trigger guided tour after first connection
  if (localStorage.getItem('roweos_social_tour_complete') !== 'true') {
    setTimeout(function() { startSocialTour(); }, 500);
  }
```

This should be placed in the polling/callback that detects a newly connected account, or in `renderSocialSettings` when it detects at least one connected platform.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add guided tour for Social Hub"
```

---

### Task 11: Final Verification + Deploy

- [ ] **Step 1: Search for any remaining `engageState.cleared` references**

```bash
cd /Volumes/roweOS && grep -n 'engageState.cleared' RoweOS/dist/index.html
```

Expected: zero results. If any remain, remove them.

- [ ] **Step 2: Search for `brands[0]` in Social Hub code**

```bash
cd /Volumes/roweOS && grep -n 'brands\[0\]' RoweOS/dist/index.html | grep -i -E 'social|engage|create|publish|scavenger'
```

Expected: zero results in Social Hub functions.

- [ ] **Step 3: Verify no ES5 violations were introduced**

```bash
cd /Volumes/roweOS && grep -n 'const \|let \|=>\|`' RoweOS/dist/index.html | tail -20
```

Expected: no new arrow functions, let/const, or template literals.

- [ ] **Step 4: Update ROWEOS_VERSION**

At line 63320, update `var ROWEOS_VERSION = 'v25.4';` to `var ROWEOS_VERSION = 'v25.5';`

- [ ] **Step 5: Deploy Cloud Functions**

```bash
cd /Volumes/roweOS && FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions
```

- [ ] **Step 6: Deploy to Vercel production**

```bash
cd /Volumes/roweOS && ./deploy.sh
```

- [ ] **Step 7: Commit final state**

```bash
cd /Volumes/roweOS && git add -A && git status
```

If clean, no commit needed. If there are uncommitted changes, commit:
```bash
git commit -m "chore: final cleanup for social hub bugfix batch"
```
