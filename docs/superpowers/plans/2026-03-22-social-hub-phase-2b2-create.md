# Social Hub Phase 2B-2: Create Tab -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Create tab with AI chat for crafting social posts and X DMs inbox.

**Architecture:** The Create tab replaces its current placeholder with two sub-tabs: "Create" (AI chat for post crafting with quick actions and Send to Publish) and "DMs" (X direct messages inbox with thread view and reply). The AI chat reuses the existing `callStudioAPIStreaming` pattern already used in Studio/BrandAI. DM API calls route through a new Vercel serverless proxy (`/api/x-dm-proxy.js`) to bypass X API CORS restrictions.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5 only), Firebase SDK, X API v2

**Spec:** `docs/superpowers/specs/2026-03-22-social-hub-phase-2b2-create-design.md`

**Codebase conventions:**
- ES5 only (no arrow functions, no let/const, no template literals)
- var for all declarations
- No emoji -- SVG icons only
- Tag changes with `// v25.4:` comments

**Base path:** `/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project`

---

## Task 1: Replace Create Tab Placeholder with Sub-tab HTML

**File:** `RoweOS/dist/index.html`

**What:** Replace the current `#socialTabCreate` placeholder div (lines ~57402-57409) with the full two-sub-tab structure. Model the sub-tab switcher on the Media tab (`scavenger-filter-btn` pills, same CSS already in place).

**Find this block** (search for `id="socialTabCreate"`):

```html
<div id="socialTabCreate" class="social-tab-panel" style="display:none;">
  <div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/></svg>
    <h3 style="color:var(--text-primary);margin-bottom:8px;">Create</h3>
    <p>AI-powered post crafting with image generation. Plus read and reply to social DMs.</p>
    <p style="margin-top:12px;font-size:12px;color:var(--text-tertiary);">Coming in Phase 2B</p>
  </div>
</div>
```

**Replace with:**

```html
<!-- v25.4: Create tab — AI chat + DMs sub-tabs -->
<div id="socialTabCreate" class="social-tab-panel" style="display:none;">
  <!-- Sub-tab switcher (pill style, same as Media tab) -->
  <div class="scavenger-filter-bar" style="margin-bottom:16px;">
    <button class="scavenger-filter-btn active" id="createSubCreate" onclick="showCreateSubTab('chat')">Create</button>
    <button class="scavenger-filter-btn" id="createSubDMs" onclick="showCreateSubTab('dms')">DMs</button>
  </div>

  <!-- Create (AI Chat) sub-tab -->
  <div id="createChatPanel">
    <!-- Quick action buttons -->
    <div id="createQuickActions" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
      <button class="scavenger-filter-btn" onclick="handleCreateQuickAction('post')">Generate Post</button>
      <button class="scavenger-filter-btn" onclick="handleCreateQuickAction('image')">Generate Image</button>
      <button class="scavenger-filter-btn" onclick="handleCreateQuickAction('hashtags')">Suggest Hashtags</button>
      <button class="scavenger-filter-btn" onclick="handleCreateQuickAction('rewrite')">Rewrite for Platform</button>
      <button class="scavenger-filter-btn" style="margin-left:auto;" onclick="clearCreateChat()">Clear chat</button>
    </div>
    <!-- Chat thread -->
    <div id="createChatThread" style="display:flex;flex-direction:column;gap:12px;min-height:200px;max-height:420px;overflow-y:auto;padding:4px 0 12px;margin-bottom:10px;"></div>
    <!-- Input bar -->
    <div style="display:flex;gap:8px;align-items:flex-end;">
      <textarea id="createChatInput" rows="2" placeholder="Ask the AI to write a post, suggest hashtags, rewrite copy..." style="flex:1;resize:none;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:10px;color:var(--text-primary);font-size:13px;padding:10px 12px;font-family:inherit;line-height:1.4;" onkeydown="handleCreateChatKey(event)"></textarea>
      <button onclick="sendCreateMessage()" style="padding:10px 16px;border-radius:10px;background:var(--accent);color:#0a0a0a;border:none;cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;flex-shrink:0;">Send</button>
    </div>
    <!-- Quick action pending label (hidden by default) -->
    <div id="createQuickActionLabel" style="display:none;font-size:11px;color:var(--accent);margin-top:6px;"></div>
  </div>

  <!-- DMs sub-tab -->
  <div id="createDMsPanel" style="display:none;">
    <!-- Conversation list view -->
    <div id="dmListView">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:13px;color:var(--text-secondary);">X Direct Messages</span>
        <button onclick="loadDMConversations('x')" style="padding:4px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;font-size:12px;">Refresh</button>
      </div>
      <div id="dmConversationList"></div>
    </div>
    <!-- Thread view (hidden until conversation opened) -->
    <div id="dmThreadView" style="display:none;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <button onclick="closeDMThread()" style="padding:4px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;font-size:12px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <span id="dmThreadTitle" style="font-size:13px;font-weight:600;color:var(--text-primary);"></span>
      </div>
      <div id="dmThreadMessages" style="display:flex;flex-direction:column;gap:8px;min-height:150px;max-height:380px;overflow-y:auto;padding:4px 0 12px;margin-bottom:10px;"></div>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <textarea id="dmReplyInput" rows="2" placeholder="Reply..." style="flex:1;resize:none;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:10px;color:var(--text-primary);font-size:13px;padding:10px 12px;font-family:inherit;line-height:1.4;" onkeydown="handleDMReplyKey(event)"></textarea>
        <button onclick="sendDMReply()" style="padding:10px 16px;border-radius:10px;background:var(--accent);color:#0a0a0a;border:none;cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap;flex-shrink:0;">Send</button>
      </div>
    </div>
  </div>
</div>
```

**Checklist:**
- [ ] Search for the exact placeholder block (the `id="socialTabCreate"` div)
- [ ] Replace with the HTML above using a precise Edit tool call
- [ ] Verify the file still has balanced tags by grepping for `socialTabCreate` and confirming one match

---

## Task 2: Sub-tab Switching JS

**File:** `RoweOS/dist/index.html`

**Where to insert:** Immediately after the `showMediaSubTab` function (search for `// v25.4: Media tab sub-tab switching`), add a new block.

**What to add:**

```javascript
// v25.4: Create tab sub-tab switching
function showCreateSubTab(tab) {
  var chatPanel = document.getElementById('createChatPanel');
  var dmsPanel = document.getElementById('createDMsPanel');
  var chatBtn = document.getElementById('createSubCreate');
  var dmsBtn = document.getElementById('createSubDMs');
  if (tab === 'chat') {
    if (chatPanel) chatPanel.style.display = '';
    if (dmsPanel) dmsPanel.style.display = 'none';
    if (chatBtn) chatBtn.classList.add('active');
    if (dmsBtn) dmsBtn.classList.remove('active');
  } else {
    if (chatPanel) chatPanel.style.display = 'none';
    if (dmsPanel) dmsPanel.style.display = '';
    if (chatBtn) chatBtn.classList.remove('active');
    if (dmsBtn) dmsBtn.classList.add('active');
    initDMsTab();
  }
}
```

Also update `showSocialTab()` to call `initCreateChat()` when the Create tab is activated. Find this block inside `showSocialTab`:

```javascript
  if (tab === 'engage' && typeof initEngageTab === 'function') initEngageTab();
  if (tab === 'activity' && typeof initSocialActivityLog === 'function') initSocialActivityLog();
```

Replace with:

```javascript
  if (tab === 'engage' && typeof initEngageTab === 'function') initEngageTab();
  if (tab === 'activity' && typeof initSocialActivityLog === 'function') initSocialActivityLog();
  // v25.4: Init Create tab on switch
  if (tab === 'create' && typeof initCreateChat === 'function') initCreateChat();
```

**Checklist:**
- [ ] Insert `showCreateSubTab` function after `showMediaSubTab`
- [ ] Add the `initCreateChat` call to `showSocialTab`
- [ ] Verify no duplicate function names by grepping for `function showCreateSubTab`

---

## Task 3: AI Chat JS (init, send, render, quick actions, send to publish, clear)

**File:** `RoweOS/dist/index.html`

**Where to insert:** After `showCreateSubTab` (at end of Create tab section, before DMs functions in Task 4).

**State variables** (add near other social state vars -- search for `var engageState` for placement context, add after that block):

```javascript
// v25.4: Create tab AI chat state
var createChatState = {
  messages: [],         // [{role:'user'|'assistant', content:str, ts:number}]
  pendingAction: null,  // quick action pending on next send
  streaming: false
};
```

**Core functions:**

```javascript
// v25.4: Create Tab -- AI Chat
// ────────────────────────────────────────────────────────────────

function initCreateChat() {
  // Load persisted history
  try {
    var raw = localStorage.getItem('roweos_social_create_chat');
    createChatState.messages = raw ? JSON.parse(raw) : [];
  } catch(e) {
    createChatState.messages = [];
  }
  renderCreateThread();
}

function renderCreateThread() {
  var thread = document.getElementById('createChatThread');
  if (!thread) return;
  if (!createChatState.messages.length) {
    thread.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-secondary);font-size:13px;">Start a conversation to craft social posts, generate images, or get hashtag suggestions.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < createChatState.messages.length; i++) {
    var msg = createChatState.messages[i];
    html += renderCreateMessage(msg, i);
  }
  thread.innerHTML = html;
  thread.scrollTop = thread.scrollHeight;
}

function renderCreateMessage(msg, idx) {
  var isUser = msg.role === 'user';
  var bubbleStyle = isUser
    ? 'background:linear-gradient(135deg,rgba(168,152,120,0.18),rgba(184,152,106,0.12));border:1px solid rgba(168,152,120,0.3);border-radius:12px 12px 4px 12px;'
    : 'background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:12px 12px 12px 4px;';
  var align = isUser ? 'margin-left:auto;max-width:80%;' : 'max-width:88%;';
  var content = '';
  // Render markdown via marked.js if available, else plain text
  if (!isUser && typeof marked !== 'undefined') {
    try { content = marked.parse(msg.content || ''); } catch(e) { content = escapeHtml(msg.content || ''); }
  } else {
    content = escapeHtml(msg.content || '');
  }
  var sendToPublishBtn = '';
  if (!isUser && idx > 0) {
    sendToPublishBtn = '<div style="margin-top:8px;">'
      + '<button onclick="sendCreateToPublish(' + idx + ')" style="padding:4px 12px;border-radius:8px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-size:11px;">Send to Publish</button>'
      + '</div>';
  }
  return '<div style="display:flex;flex-direction:column;' + align + '">'
    + '<div style="padding:10px 14px;' + bubbleStyle + 'font-size:13px;line-height:1.5;color:var(--text-primary);">'
    + content
    + '</div>'
    + sendToPublishBtn
    + '</div>';
}

function handleCreateChatKey(e) {
  // Cmd/Ctrl+Enter sends; Enter alone is newline
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    sendCreateMessage();
  }
}

function sendCreateMessage() {
  if (createChatState.streaming) return;
  var input = document.getElementById('createChatInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;

  // Apply pending quick action prefix
  var finalText = text;
  if (createChatState.pendingAction) {
    finalText = createChatState.pendingAction + text;
    createChatState.pendingAction = null;
    var lbl = document.getElementById('createQuickActionLabel');
    if (lbl) lbl.style.display = 'none';
  }

  input.value = '';

  // Append user message
  createChatState.messages.push({ role: 'user', content: finalText, ts: Date.now() });
  renderCreateThread();
  _saveCreateChat();

  // Build messages array for API (last 20 to stay under limits)
  var historySlice = createChatState.messages.slice(-20);
  var apiMessages = [];
  for (var i = 0; i < historySlice.length; i++) {
    apiMessages.push({ role: historySlice[i].role, content: historySlice[i].content });
  }

  _streamCreateResponse(apiMessages);
}

function _streamCreateResponse(apiMessages) {
  createChatState.streaming = true;

  // Resolve provider + API key (same routing as BrandAI Studio)
  var provider = localStorage.getItem('selectedProvider') || 'anthropic';
  var apiKeysRaw = localStorage.getItem('roweos_api_keys') || '{}';
  var apiKeys = {};
  try { apiKeys = JSON.parse(apiKeysRaw); } catch(e) {}

  var anthropicKey = apiKeys.anthropic || localStorage.getItem('anthropicApiKey') || '';
  var openaiKey = apiKeys.openai || localStorage.getItem('openaiApiKey') || '';
  var googleKey = apiKeys.google || localStorage.getItem('googleApiKey') || '';

  if (provider === 'anthropic' && !anthropicKey) provider = openaiKey ? 'openai' : googleKey ? 'google' : '';
  if (provider === 'openai' && !openaiKey) provider = anthropicKey ? 'anthropic' : googleKey ? 'google' : '';
  if (provider === 'google' && !googleKey) provider = openaiKey ? 'openai' : anthropicKey ? 'anthropic' : '';

  if (!provider) {
    showToast('Add an API key in Settings to use AI chat.', 'warning');
    createChatState.streaming = false;
    return;
  }

  var model;
  if (provider === 'anthropic') model = localStorage.getItem('claudeModel') || 'claude-sonnet-4-6';
  else if (provider === 'openai') model = localStorage.getItem('openaiModel') || 'gpt-5.4';
  else model = localStorage.getItem('googleModel') || 'gemini-2.0-flash';

  var apiKey = provider === 'anthropic' ? anthropicKey : provider === 'openai' ? openaiKey : googleKey;

  // Build system prompt with brand voice context
  var systemPrompt = _buildCreateSystemPrompt();

  // Add streaming placeholder to DOM
  var thread = document.getElementById('createChatThread');
  var placeholderId = 'createStreamPlaceholder';
  if (thread) {
    var placeholder = document.createElement('div');
    placeholder.id = placeholderId;
    placeholder.style.cssText = 'max-width:88%;display:flex;flex-direction:column;';
    placeholder.innerHTML = '<div style="padding:10px 14px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:12px 12px 12px 4px;font-size:13px;line-height:1.5;color:var(--text-secondary);">...</div>';
    thread.appendChild(placeholder);
    thread.scrollTop = thread.scrollHeight;
  }

  // Streaming prompt: include system as first user turn for providers that don't support system param directly
  // Use callStudioAPIStreaming which handles all three providers
  var promptForAPI = systemPrompt + '\n\n---\n\n';
  // For multi-turn: pass last N messages; callStudioAPIStreaming takes a single prompt string
  // Build a flattened conversation string as context
  for (var i = 0; i < apiMessages.length; i++) {
    var prefix = apiMessages[i].role === 'user' ? 'User: ' : 'Assistant: ';
    promptForAPI += prefix + apiMessages[i].content + '\n\n';
  }
  promptForAPI += 'Assistant:';

  var accum = '';
  callStudioAPIStreaming(
    provider,
    model,
    apiKey,
    promptForAPI,
    function onChunk(chunk, full) {
      accum = full;
      var el = document.getElementById(placeholderId);
      if (el) {
        var bubble = el.querySelector('div');
        if (bubble) {
          var rendered = '';
          if (typeof marked !== 'undefined') {
            try { rendered = marked.parse(full); } catch(ex) { rendered = escapeHtml(full); }
          } else {
            rendered = escapeHtml(full);
          }
          bubble.innerHTML = rendered;
          bubble.style.color = 'var(--text-primary)';
        }
        var thread2 = document.getElementById('createChatThread');
        if (thread2) thread2.scrollTop = thread2.scrollHeight;
      }
    },
    function onComplete(full) {
      createChatState.streaming = false;
      createChatState.messages.push({ role: 'assistant', content: full, ts: Date.now() });
      _saveCreateChat();
      renderCreateThread();
    },
    function onError(err) {
      createChatState.streaming = false;
      var el = document.getElementById(placeholderId);
      if (el) el.remove();
      showToast('AI error: ' + err, 'error');
    }
  );
}

function _buildCreateSystemPrompt() {
  var brandName = 'this brand';
  var brandVoice = '';
  var brandTagline = '';
  try {
    var brands = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]');
    var settings = JSON.parse(localStorage.getItem('roweos_user_brand_settings') || '{}');
    var idx = settings.activeBrandIndex || 0;
    var brand = brands[idx] || {};
    brandName = brand.shortName || brand.name || 'this brand';
    brandVoice = brand.voice || '';
    brandTagline = brand.tagline || '';
  } catch(e) {}
  var prompt = 'You are a social media content strategist for ' + brandName + '.';
  if (brandTagline) prompt += ' Brand tagline: "' + brandTagline + '".';
  if (brandVoice) prompt += ' Brand voice: ' + brandVoice + '.';
  prompt += '\n\nHelp craft compelling social media content. Be aware of platform character limits:'
    + '\n- X (Twitter): 280 characters'
    + '\n- Instagram: 2200 characters (caption)'
    + '\n- Threads: 500 characters'
    + '\n- TikTok: 2200 characters'
    + '\nUse hashtags strategically (5-10 max for most platforms). Write engaging, on-brand copy.'
    + ' When generating posts, present the final post text clearly, formatted for easy copying.'
    + ' When asked to generate an image, describe the image concept in vivid detail instead (image generation is handled separately by the publish flow).';
  return prompt;
}

function _saveCreateChat() {
  try {
    // Keep last 50 messages to avoid localStorage bloat
    var toSave = createChatState.messages.slice(-50);
    localStorage.setItem('roweos_social_create_chat', JSON.stringify(toSave));
  } catch(e) {}
}

function handleCreateQuickAction(action) {
  var prefixes = {
    post: 'Create a social media post about: ',
    image: 'Describe a compelling image concept for a social media post about: ',
    hashtags: 'Suggest relevant hashtags for: ',
    rewrite: 'Rewrite the following for X (280 chars), Instagram (2200 chars), and Threads (500 chars): '
  };
  createChatState.pendingAction = prefixes[action] || '';
  var lbl = document.getElementById('createQuickActionLabel');
  if (lbl) {
    lbl.textContent = 'Mode: ' + document.querySelector('[onclick="handleCreateQuickAction(\'' + action + '\')"]').textContent;
    lbl.style.display = 'block';
  }
  var input = document.getElementById('createChatInput');
  if (input) input.focus();
}

function sendCreateToPublish(messageIdx) {
  var msg = createChatState.messages[messageIdx];
  if (!msg) return;
  showSocialPublisher(msg.content);
  logSocialActivity('create_to_publish', { description: 'Sent AI-crafted content to Publish' });
}

function clearCreateChat() {
  createChatState.messages = [];
  createChatState.pendingAction = null;
  try { localStorage.removeItem('roweos_social_create_chat'); } catch(e) {}
  renderCreateThread();
  var lbl = document.getElementById('createQuickActionLabel');
  if (lbl) lbl.style.display = 'none';
}
```

**Checklist:**
- [ ] Add `createChatState` var block near social state vars (after `var engageState` block)
- [ ] Add all functions above in a clearly commented block after `showCreateSubTab`
- [ ] Grep for `function initCreateChat` to confirm no duplicate
- [ ] Grep for `function sendCreateMessage` to confirm no duplicate
- [ ] Grep for `function clearCreateChat` to confirm no duplicate

---

## Task 4: DMs Sub-tab JS (init, load conversations, thread view, send reply)

**File:** `RoweOS/dist/index.html`

**Where to insert:** Immediately after the Create AI Chat block from Task 3.

**State variables** (add alongside `createChatState`):

```javascript
// v25.4: DMs tab state
var dmState = {
  conversations: [],        // [{id, participantName, lastMessage, lastAt}]
  openConversationId: null,
  openConversationName: '',
  messages: [],             // thread messages [{id, text, senderId, createdAt}]
  cacheKey: 'roweos_social_dms_cache',
  cacheTTL: 5 * 60 * 1000  // 5 minutes
};
```

**Functions:**

```javascript
// v25.4: Create Tab -- DMs
// ────────────────────────────────────────────────────────────────

function initDMsTab() {
  var listView = document.getElementById('dmListView');
  var threadView = document.getElementById('dmThreadView');
  if (threadView) threadView.style.display = 'none';
  if (listView) listView.style.display = '';
  loadDMConversations('x');
}

function loadDMConversations(platform) {
  // v25.4: X only for initial release
  var listEl = document.getElementById('dmConversationList');
  if (!listEl) return;

  // Check cache
  try {
    var cacheRaw = localStorage.getItem(dmState.cacheKey);
    if (cacheRaw) {
      var cache = JSON.parse(cacheRaw);
      if (cache.platform === platform && cache.ts && (Date.now() - cache.ts < dmState.cacheTTL)) {
        dmState.conversations = cache.conversations || [];
        renderDMList();
        return;
      }
    }
  } catch(e) {}

  listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Loading...</div>';

  getSocialToken('x').then(function(tokenData) {
    if (!tokenData || !tokenData.access_token) {
      listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">X not connected. Connect X in Social Hub Settings to view DMs.</div>';
      return;
    }
    var token = tokenData.access_token;
    // Proxy request to avoid CORS
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GET',
        endpoint: '/2/dm_conversations?dm_conversation.fields=id,created_at&participant_type=NON_GROUP',
        token: token
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error === 'scope_missing') {
        listEl.innerHTML = '<div style="padding:24px;text-align:center;"><p style="color:var(--text-secondary);font-size:13px;margin-bottom:8px;">X DMs require elevated API access.</p><p style="color:var(--text-tertiary);font-size:12px;">Upgrade your X developer account to Pro tier ($200/mo) and reconnect X to enable DM access.</p></div>';
        return;
      }
      if (data.error === 'token_expired') {
        listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">X connection expired. Please reconnect X in Settings.</div>';
        return;
      }
      if (data.error === 'rate_limited') {
        showToast('Rate limited, try again shortly.', 'warning');
        listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Rate limited. Try again in a moment.</div>';
        return;
      }
      if (data.xError || !data.data) {
        listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Could not load DMs. ' + escapeHtml(data.xError || 'Unknown error') + '</div>';
        return;
      }
      dmState.conversations = data.data || [];
      // Cache result
      try {
        localStorage.setItem(dmState.cacheKey, JSON.stringify({ platform: 'x', ts: Date.now(), conversations: dmState.conversations }));
      } catch(e) {}
      renderDMList();
    })
    .catch(function(err) {
      listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Failed to load DMs. Check network connection.</div>';
    });
  });
}

function renderDMList() {
  var listEl = document.getElementById('dmConversationList');
  if (!listEl) return;
  if (!dmState.conversations.length) {
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-secondary);font-size:13px;">No DM conversations found.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < dmState.conversations.length; i++) {
    var conv = dmState.conversations[i];
    var name = escapeHtml(conv.participantName || conv.id || 'Unknown');
    var preview = escapeHtml(conv.lastMessage || '');
    var ts = conv.lastAt ? _relativeTime(conv.lastAt) : '';
    html += '<div onclick="openDMThread(\'' + escapeHtml(conv.id) + '\',\'' + name + '\')"'
      + ' style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-secondary);cursor:pointer;margin-bottom:8px;">'
      + '<div style="width:36px;height:36px;border-radius:50%;background:var(--bg-tertiary);border:1px solid var(--border-color);flex-shrink:0;display:flex;align-items:center;justify-content:center;">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:600;color:var(--text-primary);">' + name + '</div>'
      + (preview ? '<div style="font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + preview + '</div>' : '')
      + '</div>'
      + (ts ? '<div style="font-size:11px;color:var(--text-tertiary);flex-shrink:0;">' + ts + '</div>' : '')
      + '</div>';
  }
  listEl.innerHTML = html;
}

function openDMThread(conversationId, name) {
  dmState.openConversationId = conversationId;
  dmState.openConversationName = name;
  var listView = document.getElementById('dmListView');
  var threadView = document.getElementById('dmThreadView');
  var titleEl = document.getElementById('dmThreadTitle');
  if (listView) listView.style.display = 'none';
  if (threadView) threadView.style.display = '';
  if (titleEl) titleEl.textContent = name;

  var threadEl = document.getElementById('dmThreadMessages');
  if (threadEl) threadEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">Loading...</div>';

  getSocialToken('x').then(function(tokenData) {
    if (!tokenData || !tokenData.access_token) return;
    var token = tokenData.access_token;
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GET',
        endpoint: '/2/dm_conversations/' + conversationId + '/dm_events?dm_event.fields=id,text,sender_id,created_at',
        token: token
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error === 'rate_limited') {
        showToast('Rate limited, try again shortly.', 'warning');
        return;
      }
      if (data.error === 'token_expired') {
        showToast('X connection expired. Please reconnect X in Settings.', 'warning');
        return;
      }
      dmState.messages = (data.data || []).reverse(); // chronological
      renderDMThread();
    })
    .catch(function() {
      if (threadEl) threadEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">Failed to load messages.</div>';
    });
  });
}

function renderDMThread() {
  var threadEl = document.getElementById('dmThreadMessages');
  if (!threadEl) return;
  if (!dmState.messages.length) {
    threadEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">No messages in this conversation.</div>';
    return;
  }
  // Determine own user ID from stored token data
  var ownUserId = '';
  try {
    var scope = (typeof getSocialKeyScope === 'function') ? getSocialKeyScope() : '';
    var stored = localStorage.getItem('roweos_social_token_x' + scope);
    if (stored) { var td = JSON.parse(stored); ownUserId = td.userId || td.user_id || ''; }
  } catch(e) {}

  var html = '';
  for (var i = 0; i < dmState.messages.length; i++) {
    var msg = dmState.messages[i];
    var isOwn = ownUserId && msg.sender_id === ownUserId;
    var align = isOwn ? 'margin-left:auto;' : '';
    var bgStyle = isOwn
      ? 'background:linear-gradient(135deg,rgba(168,152,120,0.18),rgba(184,152,106,0.12));border:1px solid rgba(168,152,120,0.3);'
      : 'background:var(--bg-tertiary);border:1px solid var(--border-color);';
    var ts = msg.created_at ? _relativeTime(msg.created_at) : '';
    html += '<div style="max-width:80%;' + align + '">'
      + '<div style="padding:8px 12px;border-radius:10px;' + bgStyle + 'font-size:13px;line-height:1.4;color:var(--text-primary);">'
      + escapeHtml(msg.text || '')
      + '</div>'
      + (ts ? '<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;' + (isOwn ? 'text-align:right;' : '') + '">' + ts + '</div>' : '')
      + '</div>';
  }
  threadEl.innerHTML = html;
  threadEl.scrollTop = threadEl.scrollHeight;
}

function closeDMThread() {
  dmState.openConversationId = null;
  var listView = document.getElementById('dmListView');
  var threadView = document.getElementById('dmThreadView');
  if (threadView) threadView.style.display = 'none';
  if (listView) listView.style.display = '';
}

function handleDMReplyKey(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    sendDMReply();
  }
}

function sendDMReply() {
  var input = document.getElementById('dmReplyInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text || !dmState.openConversationId) return;
  input.value = '';
  input.disabled = true;

  getSocialToken('x').then(function(tokenData) {
    if (!tokenData || !tokenData.access_token) {
      showToast('X not connected.', 'warning');
      input.disabled = false;
      return;
    }
    var token = tokenData.access_token;
    fetch('/api/x-dm-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'POST',
        endpoint: '/2/dm_conversations/' + dmState.openConversationId + '/messages',
        token: token,
        body: { text: text }
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      input.disabled = false;
      if (data.error === 'rate_limited') { showToast('Rate limited, try again shortly.', 'warning'); return; }
      if (data.error === 'token_expired') { showToast('X connection expired. Please reconnect X in Settings.', 'warning'); return; }
      if (data.xError) { showToast('Failed to send: ' + data.xError, 'error'); return; }
      // Optimistically append sent message
      dmState.messages.push({ text: text, sender_id: '__own__', created_at: new Date().toISOString() });
      renderDMThread();
      logSocialActivity('dm_reply', { description: 'Sent X DM reply' });
    })
    .catch(function() {
      input.disabled = false;
      showToast('Failed to send reply.', 'error');
    });
  });
}

// v25.4: Relative time helper (used by DMs and create thread)
function _relativeTime(isoOrMs) {
  var then = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  var diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}
```

**Checklist:**
- [ ] Add `dmState` var block alongside `createChatState`
- [ ] Add all DM functions in a block after the Create AI Chat functions
- [ ] Grep for `function initDMsTab` to confirm no duplicate
- [ ] Grep for `function sendDMReply` to confirm no duplicate
- [ ] Grep for `function _relativeTime` to confirm no duplicate

---

## Task 5: Create `/api/x-dm-proxy.js` Vercel Serverless Function

**File:** `RoweOS/dist/api/x-dm-proxy.js` (create new file)

This proxy handles all X DM API calls from the browser, forwarding them to `api.twitter.com` with the user's OAuth token. It follows the exact same pattern as `/api/fetch-site-meta.js`.

```javascript
// v25.4: X DM API proxy — avoids CORS restrictions on X API
// Accepts: { method, endpoint, token, body? }
// Forwards to X API v2 and returns response

export default async function handler(req, res) {
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    var method = (body && body.method) ? body.method.toUpperCase() : 'GET';
    var endpoint = body && body.endpoint;
    var token = body && body.token;
    var reqBody = body && body.body;

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'Missing endpoint' });
    }
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Missing token' });
    }

    // Whitelist only X DM endpoints
    if (!/^\/2\/dm_conversations/.test(endpoint)) {
      return res.status(400).json({ error: 'Endpoint not allowed' });
    }

    var url = 'https://api.twitter.com' + endpoint;

    var fetchOptions = {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    if (method !== 'GET' && reqBody) {
      fetchOptions.body = JSON.stringify(reqBody);
    }

    var xResponse = await fetch(url, fetchOptions);

    // Handle token expiry
    if (xResponse.status === 401) {
      return res.status(200).json({ error: 'token_expired' });
    }

    // Handle rate limiting with retry once
    if (xResponse.status === 429) {
      // Wait 1s and retry once
      await new Promise(function(resolve) { setTimeout(resolve, 1000); });
      var retry = await fetch(url, fetchOptions);
      if (retry.status === 429) {
        return res.status(200).json({ error: 'rate_limited' });
      }
      xResponse = retry;
    }

    var xData = await xResponse.json();

    // Normalise X API errors
    if (xData.errors && xData.errors.length) {
      var firstErr = xData.errors[0];
      // DM scope error: code 220 or 403 with specific message
      if (firstErr.code === 220 || (xResponse.status === 403 && firstErr.message && firstErr.message.indexOf('dm') !== -1)) {
        return res.status(200).json({ error: 'scope_missing', xError: firstErr.message });
      }
      return res.status(200).json({ xError: firstErr.message || 'X API error', raw: xData });
    }

    return res.status(200).json(xData);

  } catch (err) {
    return res.status(500).json({ error: 'Proxy error: ' + (err.message || 'Unknown') });
  }
}
```

**Checklist:**
- [ ] Create `RoweOS/dist/api/x-dm-proxy.js` with the code above
- [ ] Verify `RoweOS/dist/api/` directory exists (`ls RoweOS/dist/api/`)
- [ ] Confirm `vercel.json` does not restrict API routes (it uses default routing, so new files in `api/` auto-register)

---

## Task 6: X OAuth Scope Update (add dm.read + dm.write)

**File:** `RoweOS/dist/index.html`

**What:** Add `dm.read` and `dm.write` to the X OAuth scope string in `connectX()`.

**Find** (inside `connectX()`, around line 103075):

```javascript
      '&scope=tweet.write%20tweet.read%20users.read%20offline.access' +
```

**Replace with:**

```javascript
      // v25.4: Added dm.read and dm.write for DMs sub-tab
      '&scope=tweet.write%20tweet.read%20users.read%20offline.access%20dm.read%20dm.write' +
```

**Note:** Users who already have X connected will need to disconnect and reconnect X to gain DM scopes. No automated migration is needed -- the DMs tab handles missing scope gracefully with a prompt.

**Checklist:**
- [ ] Locate the exact `scope=tweet.write...` string in `connectX()`
- [ ] Verify it appears only once (grep for `tweet.write.*tweet.read`)
- [ ] Apply the replacement with the Edit tool

---

## Task 7: Deploy

```bash
cd "/Users/jordanrowe/Library/Mobile Documents/com~apple~CloudDocs/The Rowe Collection, LLC/roweOS/Project"
git add RoweOS/dist/index.html RoweOS/dist/api/x-dm-proxy.js
git commit -m "feat: Social Hub Create tab -- AI chat and X DMs (Phase 2B-2)"
./deploy.sh
```

If `deploy.sh` fails on git push:
```bash
export PATH="$HOME/.local/share/fnm:$PATH" && eval "$(fnm env)"
cd RoweOS/dist && npx vercel --prod
```

**Post-deploy smoke tests:**
- [ ] Open Social Hub > Create tab -- confirm sub-tab pills render (Create / DMs)
- [ ] Send a message in Create chat -- confirm AI response streams and "Send to Publish" button appears
- [ ] Click "Generate Post" quick action -- confirm prompt prefix label appears above input
- [ ] Click "Send to Publish" on an AI response -- confirm navigates to Publish tab with content pre-filled
- [ ] Click "Clear chat" -- confirm thread empties
- [ ] Open DMs sub-tab -- confirm graceful degradation message if X not connected or DM scope missing
- [ ] Verify `/api/x-dm-proxy` responds (can test via browser DevTools Network on DMs tab load)
- [ ] Reconnect X -- confirm OAuth URL now includes `dm.read%20dm.write`

---

## Appendix: Key Code Locations

| Symbol | File | Approx line |
|--------|------|-------------|
| `#socialTabCreate` HTML | `index.html` | ~57402 |
| `showSocialTab` function | `index.html` | ~175094 |
| `showMediaSubTab` function | `index.html` | ~175113 |
| `connectX` function | `index.html` | ~103041 |
| `callStudioAPIStreaming` | `index.html` | ~78934 |
| `getSocialToken` | `index.html` | ~103605 |
| `showSocialPublisher` | `index.html` | ~103810 |
| `logSocialActivity` | `index.html` | (search for `function logSocialActivity`) |
| `var engageState` | `index.html` | (search for `var engageState`) |
| `escapeHtml` | `index.html` | (search for `function escapeHtml`) |
| `fetch-site-meta.js` (proxy pattern reference) | `RoweOS/dist/api/fetch-site-meta.js` | full file |
