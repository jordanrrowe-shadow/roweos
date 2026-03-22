# Social Hub Phase 2B-1: Engage Tab + Activity Repurpose -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Scavenger placeholder with unified Engage tab (manual X search + automated pipeline results + review queue). Repurpose Activity tab as general social activity log.

**Architecture:** Client-side X API search with scoring, Firestore real-time listener for results feed, new `social_activity` subcollection for activity log. Reuses existing `renderScavengerCard()` and approve/reject functions from Phase 1.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5 only), Firebase SDK, X API v2

**Spec:** `docs/superpowers/specs/2026-03-22-social-hub-phase-2b-engage-design.md`

**Codebase conventions:**
- ES5 only (no arrow functions, no let/const, no template literals)
- `var` for all declarations, explicit `function` declarations
- No emoji -- SVG icons only
- Tag changes with `// v25.4:` comments

**Base path:** `/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `RoweOS/dist/index.html` | Main app | Modify -- rename tabs, build Engage UI, repurpose Activity, add functions |
| `functions/lib/scavenger.js` | Cloud Functions scavenger pipeline | Modify -- add activity log write in stepPost() |

---

## Task 1: Rename Scavenger Tab to Engage + Update Tab Switching

**Files:**
- Modify: `RoweOS/dist/index.html`

- [ ] **Step 1: Rename tab button**

Find line ~57335:
```html
<button class="social-hub-tab" onclick="showSocialTab('scavenger')" data-tab="scavenger">Scavenger</button>
```

Change to:
```html
<button class="social-hub-tab" onclick="showSocialTab('engage')" data-tab="engage">Engage</button>
```

- [ ] **Step 2: Replace Scavenger placeholder panel with Engage tab HTML**

Find `socialTabScavenger` at line ~57362-57369. Replace the entire div with:

```html
    <div id="socialTabEngage" class="social-tab-panel" style="display:none;">
      <div id="engageSearchSection" style="margin-bottom:16px;">
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input type="text" id="engageSearchInput" placeholder="Search for posts about..." style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:14px;font-family:inherit;">
          <button id="engageSearchBtn" onclick="searchEngagePosts()" style="padding:8px 14px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Search
          </button>
        </div>
        <div id="engageKeywordPills" style="display:flex;flex-wrap:wrap;gap:4px;"></div>
      </div>
      <div class="scavenger-filter-bar" id="engageFilterBar">
        <button class="scavenger-filter-btn active" onclick="filterEngageFeed('all')">All</button>
        <button class="scavenger-filter-btn" onclick="filterEngageFeed('pending_review')">Pending Review</button>
        <button class="scavenger-filter-btn" onclick="filterEngageFeed('posted')">Posted</button>
        <button class="scavenger-filter-btn" onclick="filterEngageFeed('rejected')">Rejected</button>
        <button class="scavenger-filter-btn" onclick="filterEngageFeed('post_failed')">Failed</button>
        <button class="scavenger-filter-btn" onclick="filterEngageFeed('auto_approved')">Auto-approved</button>
      </div>
      <div id="engageFeedList"></div>
      <div id="engageLoadMore" style="text-align:center;padding:16px;display:none;">
        <button onclick="loadMoreEngageTargets()" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;">Load more</button>
      </div>
      <div id="engageEmptyState" style="text-align:center;padding:40px;color:var(--text-tertiary);">
        Search for posts or wait for the automated pipeline to find targets.
      </div>
    </div>
```

- [ ] **Step 3: Repurpose Activity tab HTML**

Find `socialTabActivity` at line ~57345-57360. Replace its contents (keep the outer div) with:

```html
    <div id="socialTabActivity" class="social-tab-panel">
      <div class="scavenger-filter-bar" id="activityFilterBar">
        <button class="scavenger-filter-btn active" onclick="filterActivityLog('all')">All</button>
        <button class="scavenger-filter-btn" onclick="filterActivityLog('posts')">Posts</button>
        <button class="scavenger-filter-btn" onclick="filterActivityLog('scavenger')">Scavenger</button>
        <button class="scavenger-filter-btn" onclick="filterActivityLog('media')">Media</button>
        <button class="scavenger-filter-btn" onclick="filterActivityLog('settings')">Settings</button>
      </div>
      <div id="activityLogList"></div>
      <div id="activityLoadMore" style="text-align:center;padding:16px;display:none;">
        <button onclick="loadMoreActivityLog()" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;">Load more</button>
      </div>
      <div id="activityEmptyState" style="text-align:center;padding:40px;color:var(--text-tertiary);">
        No social activity yet. Actions you take across Social Hub will appear here.
      </div>
    </div>
```

- [ ] **Step 4: Update showSocialTab() render-on-switch**

Find `showSocialTab()` (line ~174694). Update the render-on-switch calls. Replace the `tab === 'activity'` line with engage and activity:

```javascript
  if (tab === 'engage' && typeof initEngageTab === 'function') initEngageTab();
  if (tab === 'activity' && typeof initSocialActivityLog === 'function') initSocialActivityLog();
```

- [ ] **Step 5: Update showView() social handler**

Find the `if (view === 'social')` block in `showView()`. Replace `initScavengerActivity` with `initSocialActivityLog`:

```javascript
  if (view === 'social') {
    if (typeof initSocialActivityLog === 'function') initSocialActivityLog();
    if (typeof loadScavengerConfigsFromFirestore === 'function') loadScavengerConfigsFromFirestore();
    if (typeof renderPublishTab === 'function') renderPublishTab();
  }
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project"
git add RoweOS/dist/index.html
git commit -m "feat: rename Scavenger to Engage tab, repurpose Activity tab HTML"
```

---

## Task 2: Add Engage Tab JavaScript (Search + Feed + Scoring)

**Files:**
- Modify: `RoweOS/dist/index.html`

Add all Engage tab functions near the other Social Hub functions (search for `showSocialTab` to find the area, around line ~174694).

- [ ] **Step 1: Add scoreScavengerTarget() function**

```javascript
// v25.4: Client-side scavenger scoring (mirrors Cloud Function algorithm)
function scoreScavengerTarget(target, keywords) {
  var matchChars = 0;
  var contentLen = (target.content || '').length;
  var matched = [];
  var contentLower = (target.content || '').toLowerCase();
  for (var k = 0; k < keywords.length; k++) {
    if (contentLower.indexOf(keywords[k].toLowerCase()) >= 0) {
      matchChars += keywords[k].length;
      matched.push(keywords[k]);
    }
  }
  var relevance = matched.length > 0 ? Math.min(100, Math.round((matchChars / Math.max(contentLen, 1)) * 500)) : 20;
  relevance = Math.max(20, Math.min(100, relevance));

  var followers = target.authorFollowers || 0;
  var authority;
  if (followers >= 50000) authority = 100;
  else if (followers >= 10000) authority = 80;
  else if (followers >= 2000) authority = 60;
  else if (followers >= 500) authority = 40;
  else authority = 20;

  var ageHours = 0;
  if (target.createdAt) {
    ageHours = (Date.now() - new Date(target.createdAt).getTime()) / (60 * 60 * 1000);
  }
  var engagement = Math.max(20, Math.round(100 - (ageHours * 10)));

  var score = Math.round(relevance * 0.5 + authority * 0.3 + engagement * 0.2);
  return {
    score: score,
    scoreBreakdown: { relevance: relevance, authority: authority, engagement: engagement },
    keywordsMatched: matched
  };
}
```

- [ ] **Step 2: Add Engage tab state and initEngageTab()**

```javascript
// v25.4: Engage tab state
var engageState = {
  targets: [],
  filter: 'all',
  lastDoc: null,
  pageSize: 20,
  listener: null,
  searchCooldown: false
};

function initEngageTab() {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();

  // Render keyword pills from scavenger configs
  renderEngageKeywordPills();

  // Real-time listener on scavenger_targets
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

function renderEngageKeywordPills() {
  var el = document.getElementById('engageKeywordPills');
  if (!el) return;
  var configs = typeof getScavengerConfigs === 'function' ? getScavengerConfigs() : [];
  var html = '';
  for (var i = 0; i < configs.length; i++) {
    var kws = configs[i].keywords;
    if (typeof kws === 'string') kws = kws.split(',');
    if (!Array.isArray(kws)) continue;
    for (var j = 0; j < kws.length; j++) {
      var kw = kws[j].trim();
      if (!kw) continue;
      html += '<button class="scavenger-keyword-pill" onclick="quickEngageSearch(\'' + escapeHtml(kw).replace(/'/g, "\\'") + '\')" style="cursor:pointer;border:none;">' + escapeHtml(kw) + '</button>';
    }
  }
  el.innerHTML = html;
}

function quickEngageSearch(keyword) {
  var input = document.getElementById('engageSearchInput');
  if (input) input.value = keyword;
  searchEngagePosts();
}
```

- [ ] **Step 3: Add searchEngagePosts() function**

```javascript
// v25.4: Manual X API search from Engage tab
function searchEngagePosts() {
  var input = document.getElementById('engageSearchInput');
  var btn = document.getElementById('engageSearchBtn');
  if (!input || !input.value.trim()) {
    showToast('Enter keywords to search', 'error');
    return;
  }
  if (engageState.searchCooldown) {
    showToast('Please wait before searching again', 'info');
    return;
  }

  var token = typeof getSocialToken === 'function' ? getSocialToken('x') : null;
  if (!token) {
    showToast('Connect X in Settings to search', 'error');
    return;
  }

  var keywords = input.value.trim().split(',');
  for (var i = 0; i < keywords.length; i++) keywords[i] = keywords[i].trim();
  keywords = keywords.filter(function(k) { return k; });

  var queryParts = [];
  for (var q = 0; q < keywords.length; q++) {
    var kw = keywords[q];
    queryParts.push(kw.indexOf(' ') >= 0 ? '"' + kw + '"' : kw);
  }
  var query = queryParts.join(' OR ') + ' -is:retweet -is:reply';

  // Rate limit cooldown
  engageState.searchCooldown = true;
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  setTimeout(function() {
    engageState.searchCooldown = false;
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }, 5000);

  showToast('Searching X...', 'info');

  var url = 'https://api.x.com/2/tweets/search/recent' +
    '?query=' + encodeURIComponent(query) +
    '&max_results=10' +
    '&tweet.fields=author_id,created_at,public_metrics' +
    '&expansions=author_id' +
    '&user.fields=public_metrics,username';

  fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(resp) {
    if (resp.status === 403) {
      showToast('Your X connection needs to be re-authorized with search permissions', 'error');
      return null;
    }
    if (!resp.ok) {
      showToast('Search failed (HTTP ' + resp.status + ')', 'error');
      return null;
    }
    return resp.json();
  })
  .then(function(data) {
    if (!data) return;
    var tweets = data.data || [];
    var users = {};
    if (data.includes && data.includes.users) {
      for (var u = 0; u < data.includes.users.length; u++) {
        var user = data.includes.users[u];
        users[user.id] = user;
      }
    }

    showToast('Found ' + tweets.length + ' posts', 'success');

    var uid = firebase.auth().currentUser.uid;
    var db = firebase.firestore();
    var existingIds = {};
    for (var e = 0; e < engageState.targets.length; e++) {
      existingIds[engageState.targets[e].postId] = true;
    }

    for (var t = 0; t < tweets.length; t++) {
      var tweet = tweets[t];
      if (existingIds[tweet.id]) continue;

      var author = users[tweet.author_id] || {};
      var authorHandle = author.username || '';
      var authorFollowers = (author.public_metrics && author.public_metrics.followers_count) || 0;

      var targetData = {
        content: tweet.text || '',
        authorHandle: authorHandle,
        authorFollowers: authorFollowers,
        createdAt: tweet.created_at || ''
      };

      var scored = scoreScavengerTarget(targetData, keywords);

      var target = {
        postId: tweet.id,
        postUrl: 'https://x.com/' + authorHandle + '/status/' + tweet.id,
        platform: 'x',
        authorHandle: authorHandle,
        authorFollowers: authorFollowers,
        content: tweet.text || '',
        keywordsMatched: scored.keywordsMatched,
        score: scored.score,
        scoreBreakdown: scored.scoreBreakdown,
        status: 'scored',
        source: 'manual',
        discoveredAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      db.collection('roweos_users/' + uid + '/scavenger_targets').add(target)
        .then(function(docRef) {
          // v25.4: Auto-draft if score meets config threshold
          var configs = typeof getScavengerConfigs === 'function' ? getScavengerConfigs() : [];
          for (var ci = 0; ci < configs.length; ci++) {
            var cfg = configs[ci];
            if (!cfg.active || !cfg.autoPostThreshold || cfg.autoPostThreshold === 0) continue;
            if (scored.score >= cfg.autoPostThreshold) {
              // Draft and decide async (don't block)
              autoDraftEngageTarget(uid, docRef.id, target, cfg, scored.score);
              break;
            }
          }
        })
        .catch(function(err) { console.warn('[Engage] Write error:', err); });
    }
  })
  .catch(function(err) {
    showToast('Search failed -- check your connection', 'error');
    console.error('[Engage] Search error:', err);
  });
}
```

- [ ] **Step 4: Add renderEngageFeed() and filter/pagination**

```javascript
// v25.4: Auto-draft and decide for high-scoring manual search targets
function autoDraftEngageTarget(uid, targetId, target, config, score) {
  var db = firebase.firestore();
  var toneInstructions = '';
  if (config.tonePriority === 'Thought Leader') toneInstructions = 'Respond as a thought leader.';
  else if (config.tonePriority === 'Conversational') toneInstructions = 'Respond conversationally.';
  else if (config.tonePriority === 'Professional') toneInstructions = 'Respond professionally.';
  else toneInstructions = 'Respond naturally and helpfully.';

  var systemPrompt = (config.customPrompt || 'You are a helpful brand voice.') + '\n\n' + toneInstructions +
    '\n\nRules:\n- Keep reply under 280 characters\n- Be genuine and add value\n- Never be salesy\n- Match the energy of the original post';
  var userPrompt = 'Draft a reply to this X post by @' + target.authorHandle + ':\n\n"' + target.content + '"';

  // Use the existing BrandAI chat API call pattern
  var provider = 'anthropic';
  var model = 'claude-sonnet-4-6';
  var apiKey = '';
  try {
    var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    apiKey = keys.anthropic || keys.openai || keys.google || '';
    if (keys.openai && !keys.anthropic) { provider = 'openai'; model = 'gpt-4o'; apiKey = keys.openai; }
    if (keys.google && !keys.anthropic && !keys.openai) { provider = 'google'; model = 'gemini-2.0-flash'; apiKey = keys.google; }
  } catch(e) {}

  if (!apiKey) { console.warn('[Engage] No API key for auto-draft'); return; }

  // Make AI call (reuse existing makeApiCall if available, or direct fetch)
  var makeCall = typeof makeScheduledTaskAPICall === 'function' ? makeScheduledTaskAPICall : null;
  if (!makeCall) {
    console.warn('[Engage] No API call function available for auto-draft');
    return;
  }

  makeCall(provider, model, apiKey, systemPrompt, userPrompt, function(response) {
    if (!response) return;
    var draft = response.replace(/^["']|["']$/g, '').trim();
    if (draft.length > 280) draft = draft.substring(0, 277) + '...';

    var updates = {
      draftText: draft,
      aiModel: provider + '/' + model,
      status: score >= 95 ? 'auto_approved' : 'pending_review',
      reviewedBy: score >= 95 ? 'auto' : null,
      draftedAt: new Date().toISOString(),
      decidedAt: new Date().toISOString()
    };
    db.doc('roweos_users/' + uid + '/scavenger_targets/' + targetId).update(updates);

    // If auto-approved and score >= 95, post immediately
    if (score >= 95) {
      approveScavengerTarget(targetId);
    }
  });
}

function filterEngageFeed(filter) {
  engageState.filter = filter;
  var btns = document.querySelectorAll('#engageFilterBar .scavenger-filter-btn');
  for (var i = 0; i < btns.length; i++) {
    var btnText = btns[i].textContent.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
    btns[i].classList.toggle('active', btnText === filter || (filter === 'all' && btns[i].textContent === 'All'));
  }
  renderEngageFeed();
}

function renderEngageFeed() {
  var container = document.getElementById('engageFeedList');
  var emptyState = document.getElementById('engageEmptyState');
  var loadMore = document.getElementById('engageLoadMore');
  if (!container) return;

  var filtered = engageState.targets;
  if (engageState.filter !== 'all') {
    filtered = filtered.filter(function(t) { return t.status === engageState.filter; });
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (loadMore) loadMore.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (loadMore) loadMore.style.display = engageState.targets.length >= engageState.pageSize ? 'block' : 'none';

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    html += renderScavengerCard(filtered[i]);
  }
  container.innerHTML = html;
}

function loadMoreEngageTargets() {
  if (!engageState.lastDoc || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();
  db.collection('roweos_users/' + uid + '/scavenger_targets')
    .orderBy('discoveredAt', 'desc')
    .startAfter(engageState.lastDoc)
    .limit(engageState.pageSize)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        document.getElementById('engageLoadMore').style.display = 'none';
        return;
      }
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        engageState.targets.push(data);
        engageState.lastDoc = doc;
      });
      renderEngageFeed();
    });
}
```

- [ ] **Step 5: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat: add Engage tab with X API search, scoring, and real-time feed"
```

---

## Task 3: Add Activity Log (Repurposed Tab)

**Files:**
- Modify: `RoweOS/dist/index.html`

- [ ] **Step 1: Add logSocialActivity() utility function**

Add near the other Social Hub functions:

```javascript
// v25.4: Social activity log utility
function logSocialActivity(type, details) {
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var platform = details.platform || '';
  var description = details.description || '';
  var automatic = details.automatic || false;
  // Remove fields that are top-level to avoid duplication
  var cleanDetails = {};
  var keys = Object.keys(details);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] !== 'platform' && keys[i] !== 'description' && keys[i] !== 'automatic') {
      cleanDetails[keys[i]] = details[keys[i]];
    }
  }
  var entry = {
    type: type,
    platform: platform,
    description: description,
    details: cleanDetails,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    automatic: automatic
  };
  firebase.firestore().collection('roweos_users/' + uid + '/social_activity').add(entry)
    .catch(function(e) { console.warn('[Social] Activity log error:', e); });
}
```

- [ ] **Step 2: Add initSocialActivityLog() and rendering**

```javascript
// v25.4: Activity log state
var activityLogState = {
  entries: [],
  filter: 'all',
  lastDoc: null,
  pageSize: 30,
  listener: null
};

function initSocialActivityLog() {
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();

  if (activityLogState.listener) activityLogState.listener();
  activityLogState.listener = db.collection('roweos_users/' + uid + '/social_activity')
    .orderBy('timestamp', 'desc')
    .limit(activityLogState.pageSize)
    .onSnapshot(function(snap) {
      activityLogState.entries = [];
      activityLogState.lastDoc = null;
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        activityLogState.entries.push(data);
        activityLogState.lastDoc = doc;
      });
      renderActivityLog();
    }, function(err) {
      console.warn('[Activity] Listener error:', err);
    });
}

function filterActivityLog(filter) {
  activityLogState.filter = filter;
  var btns = document.querySelectorAll('#activityFilterBar .scavenger-filter-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].textContent.toLowerCase() === filter || (filter === 'all' && btns[i].textContent === 'All'));
  }
  renderActivityLog();
}

function renderActivityLog() {
  var container = document.getElementById('activityLogList');
  var emptyState = document.getElementById('activityEmptyState');
  var loadMore = document.getElementById('activityLoadMore');
  if (!container) return;

  var typeGroups = {
    posts: ['post_published'],
    scavenger: ['scavenger_reply', 'scavenger_rejected'],
    media: ['image_generated', 'video_generated'],
    settings: ['account_connected', 'account_disconnected', 'config_changed']
  };

  var filtered = activityLogState.entries;
  if (activityLogState.filter !== 'all') {
    var allowedTypes = typeGroups[activityLogState.filter] || [];
    filtered = filtered.filter(function(e) {
      for (var i = 0; i < allowedTypes.length; i++) {
        if (e.type === allowedTypes[i]) return true;
      }
      return false;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (loadMore) loadMore.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (loadMore) loadMore.style.display = activityLogState.entries.length >= activityLogState.pageSize ? 'block' : 'none';

  var typeIcons = {
    post_published: '<path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    scavenger_reply: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    scavenger_rejected: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    image_generated: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    video_generated: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    account_connected: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    account_disconnected: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/>',
    config_changed: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
  };

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var entry = filtered[i];
    var icon = typeIcons[entry.type] || typeIcons.post_published;
    var timeAgo = typeof scavengerRelativeTime === 'function' ? scavengerRelativeTime(entry.timestamp) : '';
    var postUrl = (entry.details && entry.details.postUrl) ? entry.details.postUrl : '';

    html += '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-color);">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;">' + icon + '</svg>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:13px;color:var(--text-primary);">' + escapeHtml(entry.description || entry.type.replace(/_/g, ' ')) + '</div>';
    html += '<div style="display:flex;gap:8px;align-items:center;margin-top:4px;font-size:11px;color:var(--text-tertiary);">';
    if (entry.platform) html += '<span style="text-transform:capitalize;">' + escapeHtml(entry.platform) + '</span>';
    if (entry.automatic) html += '<span class="scavenger-status-badge auto_approved" style="font-size:10px;">Auto</span>';
    html += '<span>' + timeAgo + '</span>';
    if (postUrl) html += '<a href="' + escapeHtml(postUrl) + '" target="_blank" rel="noopener" style="color:var(--accent);">View</a>';
    html += '</div></div></div>';
  }
  container.innerHTML = html;
}

function loadMoreActivityLog() {
  if (!activityLogState.lastDoc || !firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  firebase.firestore().collection('roweos_users/' + uid + '/social_activity')
    .orderBy('timestamp', 'desc')
    .startAfter(activityLogState.lastDoc)
    .limit(activityLogState.pageSize)
    .get()
    .then(function(snap) {
      if (snap.empty) {
        var el = document.getElementById('activityLoadMore');
        if (el) el.style.display = 'none';
        return;
      }
      snap.forEach(function(doc) {
        var data = doc.data();
        data._id = doc.id;
        activityLogState.entries.push(data);
        activityLogState.lastDoc = doc;
      });
      renderActivityLog();
    });
}
```

- [ ] **Step 3: Add logSocialActivity() calls to existing functions**

Find and add calls to these existing functions:

**In `publishPostNow()`** -- after successful post (inside the `.then` callback where `result.success` is true):
```javascript
logSocialActivity('post_published', { platform: p, description: 'Posted to ' + p + ': ' + platContent.substring(0, 80), postUrl: result.postUrl || '' });
```

**In `approveScavengerTarget()`** -- after successful post (inside the `.then` where `result.ok`):
```javascript
logSocialActivity('scavenger_reply', { platform: 'x', description: 'Replied to @' + (target.authorHandle || '') + ': ' + (target.draftText || '').substring(0, 80), postUrl: replyUrl });
```

**In `rejectScavengerTarget()`** -- after the Firestore update:
```javascript
logSocialActivity('scavenger_rejected', { platform: 'x', description: 'Rejected target from @' + targetId });
```

**In `connectSocialAccount()`** -- the function routes to platform-specific connect functions, so add at the end of each successful connection callback. Or more practically, add to `setSocialConnected()` since that's called on successful connect:
```javascript
logSocialActivity('account_connected', { platform: platform, description: 'Connected ' + platform + ' account' });
```

**In `disconnectSocialAccount()`** -- after disconnecting:
```javascript
logSocialActivity('account_disconnected', { platform: platform, description: 'Disconnected ' + platform + ' account' });
```

**In `saveScavengerConfigEdit()`** -- after saving:
```javascript
logSocialActivity('config_changed', { description: 'Updated scavenger config: ' + configs[index].configName, configName: configs[index].configName });
```

**In `postMediaToPublish()`** -- after the toast:
```javascript
logSocialActivity('image_generated', { description: 'Attached generated image to Publish' });
```

**In `addScavengerConfig()`** -- after saving:
```javascript
logSocialActivity('config_changed', { description: 'Added new scavenger config' });
```

**In `deleteScavengerConfig()`** -- after saving:
```javascript
logSocialActivity('config_changed', { description: 'Deleted scavenger config' });
```

Note: The implementer should find each function, read its existing code, and add the `logSocialActivity()` call at the appropriate success point. Do NOT add it before the action succeeds.

- [ ] **Step 3b: Remove dead code**

Search for and remove the old functions that are replaced:
- `initScavengerActivity()` -- replaced by `initEngageTab()`
- `renderScavengerActivity()` -- replaced by `renderEngageFeed()`
- `filterScavengerActivity()` -- replaced by `filterEngageFeed()`
- `loadMoreScavengerTargets()` -- replaced by `loadMoreEngageTargets()`
- `scavengerActivityState` global variable -- replaced by `engageState`

Search for `function initScavengerActivity`, `function renderScavengerActivity`, `function filterScavengerActivity`, `function loadMoreScavengerTargets`, and `var scavengerActivityState` and remove each function body. Keep `renderScavengerCard()`, `approveScavengerTarget()`, `editScavengerTarget()`, `rejectScavengerTarget()`, `scavengerFormatFollowers()`, `scavengerRelativeTime()` -- these are still used.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/index.html
git commit -m "feat: add Activity log with timeline, filters, and logSocialActivity() calls"
```

---

## Task 4: Add Activity Logging to Cloud Functions + Deploy

**Files:**
- Modify: `functions/lib/scavenger.js`
- Deploy app

- [ ] **Step 1: Add activity log write in stepPost()**

Find `stepPost()` in `/functions/lib/scavenger.js`. After a successful post (where `postResult.success` is true), add:

```javascript
        // v25.4: Log to social_activity for Activity tab
        try {
          var activityEntry = {
            type: 'scavenger_reply',
            platform: 'x',
            description: 'Auto-replied to @' + target.authorHandle + ': ' + (target.draftText || '').substring(0, 80),
            details: {
              postUrl: postResult.postUrl || '',
              targetAuthor: target.authorHandle,
              content: (target.draftText || '').substring(0, 200)
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            automatic: true
          };
          await helpers.getDb().collection('roweos_users/' + uid + '/social_activity').add(activityEntry);
        } catch (logErr) {
          console.warn('[Scavenger:Post] Activity log error:', logErr.message);
        }
```

- [ ] **Step 2: Commit**

```bash
git add functions/lib/scavenger.js
git commit -m "feat: log automated scavenger posts to social_activity collection"
```

- [ ] **Step 3: Deploy app**

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project"
git push origin main
cd RoweOS/dist && export PATH="$HOME/.local/share/fnm:$PATH" && eval "$(fnm env)" && vercel --prod --yes
```

- [ ] **Step 4: Verify**

Check on roweos.com:
- Engage tab shows search bar with keyword pills from scavenger configs
- Searching for a keyword finds X posts and displays them as scored cards
- Filter bar works (All, Pending Review, Posted, etc.)
- Activity tab shows empty state (no activity yet)
- Publishing a post from Publish tab creates an entry in Activity log
- Approve/reject from Engage tab creates entries in Activity log
