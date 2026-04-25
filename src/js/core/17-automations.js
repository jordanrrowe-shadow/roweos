// ═══════════════════════════════════════════════════════════════
// v24.8: AUTOMATION MEMORY — Learns user preferences from automation configs
// ═══════════════════════════════════════════════════════════════

var AUTOMATION_MEMORY_MAX = 50;

function getAutomationMemory() {
  try { return JSON.parse(localStorage.getItem('roweos_automation_memory') || '[]'); } catch(e) { return []; }
}

function saveAutomationMemory(entries) {
  if (!Array.isArray(entries)) return;
  if (entries.length > AUTOMATION_MEMORY_MAX) entries = entries.slice(0, AUTOMATION_MEMORY_MAX);
  try { localStorage.setItem('roweos_automation_memory', JSON.stringify(entries)); } catch(e) {}
  writeDB('profile/main', { automationMemory: entries }); // v25.1
}

function addAutomationMemoryEntry(category, key, value, source) {
  if (!category || !key || !value) return;
  var entries = getAutomationMemory();
  // Dedup: update existing entry with same category+key+value
  var found = false;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].category === category && entries[i].key === key && entries[i].value.toLowerCase() === value.toLowerCase()) {
      entries[i].count = (entries[i].count || 1) + 1;
      entries[i].lastSeen = Date.now();
      entries[i].source = source || entries[i].source;
      found = true;
      break;
    }
  }
  if (!found) {
    entries.push({
      id: 'amem_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      category: category,
      key: key,
      value: value,
      count: 1,
      source: source || 'manual',
      addedAt: Date.now(),
      lastSeen: Date.now()
    });
  }
  saveAutomationMemory(entries);
}

function removeAutomationMemoryEntry(entryId) {
  var entries = getAutomationMemory();
  entries = entries.filter(function(e) { return e.id !== entryId; });
  saveAutomationMemory(entries);
}

function getAutomationMemoryPrompt() {
  var entries = getAutomationMemory();
  if (entries.length === 0) return '';
  // Only include entries seen 2+ times (confirmed preferences)
  var confirmed = entries.filter(function(e) { return (e.count || 1) >= 2; });
  if (confirmed.length === 0) return '';
  var grouped = {};
  for (var i = 0; i < confirmed.length; i++) {
    var cat = confirmed[i].category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(confirmed[i].key + ': ' + confirmed[i].value);
  }
  var parts = ['USER AUTOMATION PREFERENCES (learned from past configurations):'];
  var cats = Object.keys(grouped);
  for (var c = 0; c < cats.length; c++) {
    parts.push(cats[c].charAt(0).toUpperCase() + cats[c].slice(1) + ' - ' + grouped[cats[c]].join(', '));
  }
  return parts.join('\n');
}

function getAutomationMemoryTracking() {
  try { return JSON.parse(localStorage.getItem('roweos_automation_memory_tracking') || '{}'); } catch(e) { return {}; }
}

function saveAutomationMemoryTracking(tracking) {
  try { localStorage.setItem('roweos_automation_memory_tracking', JSON.stringify(tracking)); } catch(e) {}
}

// v24.8: Auto-learn from pipeline saves — extract preferences from step configs
function learnFromPipelineConfig(pipeline) {
  if (!pipeline || !pipeline.steps) return;
  var tracking = getAutomationMemoryTracking();
  for (var i = 0; i < pipeline.steps.length; i++) {
    var step = pipeline.steps[i];
    var config = step.config || {};
    var target = step.target || {};
    // Learn email recipients
    if (step.action === 'email' || step.action === 'batch_email') {
      var to = target.to || config.to || '';
      if (to) {
        var tKey = 'email_to:' + to.toLowerCase();
        if (!tracking[tKey]) tracking[tKey] = 0;
        tracking[tKey]++;
        if (tracking[tKey] >= 2) addAutomationMemoryEntry('email', 'preferred recipient', to, 'pipeline');
      }
      var from = target.from || config.from || '';
      if (from) {
        var fKey = 'email_from:' + from.toLowerCase();
        if (!tracking[fKey]) tracking[fKey] = 0;
        tracking[fKey]++;
        if (tracking[fKey] >= 2) addAutomationMemoryEntry('email', 'preferred sender', from, 'pipeline');
      }
    }
    // Learn provider/model preferences
    if (config.provider) {
      var pKey = 'provider:' + config.provider;
      if (!tracking[pKey]) tracking[pKey] = 0;
      tracking[pKey]++;
      if (tracking[pKey] >= 2) addAutomationMemoryEntry('ai', 'preferred provider', config.provider, 'pipeline');
    }
    if (config.model) {
      var mKey = 'model:' + config.model;
      if (!tracking[mKey]) tracking[mKey] = 0;
      tracking[mKey]++;
      if (tracking[mKey] >= 2) addAutomationMemoryEntry('ai', 'preferred model', config.model, 'pipeline');
    }
    // Learn platform preferences for social posts
    if (step.action === 'post' && target.platforms && target.platforms.length > 0) {
      var platKey = 'platforms:' + target.platforms.sort().join(',');
      if (!tracking[platKey]) tracking[platKey] = 0;
      tracking[platKey]++;
      if (tracking[platKey] >= 2) addAutomationMemoryEntry('social', 'preferred platforms', target.platforms.join(', '), 'pipeline');
    }
    // Learn image provider preferences
    if (step.action === 'image' && config.imageProvider) {
      var ipKey = 'image_provider:' + config.imageProvider;
      if (!tracking[ipKey]) tracking[ipKey] = 0;
      tracking[ipKey]++;
      if (tracking[ipKey] >= 2) addAutomationMemoryEntry('media', 'preferred image provider', config.imageProvider, 'pipeline');
    }
    if (step.action === 'video' && config.videoModel) {
      var vmKey = 'video_model:' + config.videoModel;
      if (!tracking[vmKey]) tracking[vmKey] = 0;
      tracking[vmKey]++;
      if (tracking[vmKey] >= 2) addAutomationMemoryEntry('media', 'preferred video model', config.videoModel, 'pipeline');
    }
  }
  saveAutomationMemoryTracking(tracking);
}

/**
 * v22.14: Fire-and-forget async video post generation
 * Creates a placeholder immediately, then updates when the video is ready
 */
async function bloomGenerateVideoPost(item, textProvider, textModel, textApiKey, batchSource) {
  var op = item.op;
  var brand = item.brand;
  var brandName = item.brandName;
  var brandIdx = item.brandIdx;

  // Create placeholder post immediately
  var postId = 'bloom_' + Date.now() + '_vid_' + Math.floor(Math.random() * 100000);
  var post = {
    id: postId,
    type: 'video',
    agent: 'video',
    agentLabel: 'Video Agent',
    category: 'video',
    title: op.name,
    content: '',
    videoPending: true,
    videoProgress: 0,
    videoError: null,
    videoUrl: null,
    videoBlob: null,
    videoModel: '',
    videoDuration: 6,
    videoGenTime: 0,
    operationId: op.id,
    operationName: op.name,
    brandIdx: brandIdx,
    brandName: brandName,
    timestamp: Date.now() - Math.floor(Math.random() * 300000),
    liked: false,
    saved: false,
    likeCount: 0,
    comments: []
  };

  // Add to feed immediately (shows loading placeholder)
  _bloomPosts.push(post);
  appendBloomPostToFeed(post);

  try {
    // Build video prompt
    var videoPrompt = bloomBuildVideoPrompt(op, brand, brandName);
    // v22.17: Inject bloom knowledge into video prompt
    var _vidKnowledge = getBloomKnowledgePrompt(brandIdx);
    if (_vidKnowledge) videoPrompt += ' ' + _vidKnowledge;

    // Call Veo with progress callback
    console.warn('[Bloom] Starting Veo video generation for:', op.name, 'prompt:', videoPrompt.substring(0, 100) + '...');
    // v22.16: Inject content library reference image for image-to-video mode
    var _vidLibRefs = getBloomLibraryReferences(brandIdx, 'video', 1);
    // v22.49: Default Bloom video to Veo 3.1 (full quality)
    var _vidOpts = {
      aspectRatio: '9:16',
      duration: 6,
      model: 'veo-3.1-generate-preview',
      onProgress: function(elapsed, pollCount) {
        if (_bloomSource !== batchSource) return;
        post.videoProgress = elapsed;
        bloomUpdateVideoProgress(postId, elapsed);
      }
    };
    if (_vidLibRefs.length > 0) {
      _vidOpts.referenceImage = _vidLibRefs[0];
      if (typeof ROWEOS_DEBUG !== 'undefined' && localStorage.getItem('roweos_debug') === 'true') console.log('[Bloom] Using content library reference for video generation');
    }
    var videoResult = await generateVideoWithVeo(videoPrompt, _vidOpts);

    // Stale guard - if source changed while generating, don't update
    if (_bloomSource !== batchSource) {
      console.log('[Bloom] Video ready but source changed, discarding');
      return;
    }

    // Success - update post with video data
    post.videoPending = false;
    post.videoUrl = videoResult.videoUrl;
    post.videoBlob = videoResult.videoBlob;
    post.videoModel = videoResult.model;
    post.videoDuration = videoResult.duration;
    post.videoGenTime = videoResult.generationTime;

    // Generate a caption for the video
    try {
      var capPrompt = 'You are writing a short social caption for a brand video by ' + brandName + ' about: ' + op.name + '. Write ONLY the caption. 1-2 sentences, punchy, end with a CTA. No options, no commentary. Never use em-dashes.';
      var capMsgs = [{ role: 'user', content: capPrompt }];
      var sysPrompt = item.systemPrompt || '';
      var caption = '';
      if (textProvider === 'anthropic') caption = await callAnthropicAPI(textModel, textApiKey, capMsgs, sysPrompt);
      else if (textProvider === 'google') caption = await callGoogleAPI(textModel, textApiKey, capMsgs, sysPrompt);
      else if (textProvider === 'openai') caption = await callOpenAIAPI(textModel, textApiKey, capMsgs, sysPrompt);
      if (caption) post.content = caption.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
    } catch(capErr) { console.warn('[Bloom] Video caption failed:', capErr); }

    console.warn('[Bloom] Video ready:', op.name, '(' + videoResult.generationTime + 's)');
    bloomUpdateVideoCard(postId);

  } catch(err) {
    // Stale guard
    if (_bloomSource !== batchSource) return;

    post.videoPending = false;
    post.videoError = err.message || 'Unknown error';
    console.warn('[Bloom] Video generation failed:', err);
    bloomUpdateVideoCard(postId);
  }
}

/**
 * v22.14: Update video progress text in loading card
 */
function bloomUpdateVideoProgress(postId, elapsed) {
  var timeEl = document.getElementById('bloom-video-time-' + postId);
  if (timeEl) {
    timeEl.textContent = elapsed + 's elapsed';
  }
}

/**
 * v22.14: Replace video card DOM with re-rendered version
 */
function bloomUpdateVideoCard(postId) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post) return;
  var card = document.getElementById('bloom-card-' + postId);
  if (!card) return;

  // v22.56: If quota error and not on video filter, silently remove the failed card
  if (post.videoError && _bloomFilter !== 'video') {
    var errLower = post.videoError.toLowerCase();
    if (errLower.indexOf('quota') !== -1 || errLower.indexOf('rate') !== -1 || errLower.indexOf('429') !== -1 || errLower.indexOf('limit') !== -1 || errLower.indexOf('rpm') !== -1 || errLower.indexOf('exhausted') !== -1) {
      card.remove();
      return;
    }
  }

  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderBloomPost(post);
  var newCard = tempDiv.firstChild;
  card.parentNode.replaceChild(newCard, card);
  if (newCard) bloomRegisterCardForDwell(newCard);
  // v22.14: Register video for autoplay on scroll
  if (newCard) bloomRegisterVideoForAutoplay(newCard);
}

/**
 * v22.11: Filter handler
 */
function bloomFilter(filterId) {
  _bloomFilter = filterId;
  bloomRecordFilterSignal(filterId); // v22.12

  // Update pill active states
  var pills = document.querySelectorAll('.bloom-filter-pill');
  for (var i = 0; i < pills.length; i++) {
    pills[i].classList.toggle('active', pills[i].getAttribute('data-filter') === filterId);
  }

  renderBloomFeed();
}

/**
 * v22.11: Like handler
 */
function bloomLike(postId) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post) return;

  if (_bloomLikedIds[postId]) {
    delete _bloomLikedIds[postId];
    post.likeCount = Math.max(0, (post.likeCount || 1) - 1);
    bloomRecordSignal('unlike', post); // v22.12
  } else {
    _bloomLikedIds[postId] = true;
    post.likeCount = (post.likeCount || 0) + 1;
    bloomRecordSignal('like', post); // v22.12
  }

  // Update just the like button
  var card = document.getElementById('bloom-card-' + postId);
  if (card) {
    var likeBtn = card.querySelector('.bloom-action-btn');
    if (likeBtn) {
      likeBtn.classList.toggle('liked', !!_bloomLikedIds[postId]);
      var countText = post.likeCount ? ' ' + post.likeCount : '';
      likeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' + countText;
    }
  }
}

/**
 * v22.11: Save handler
 */
function bloomSave(postId) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; }); // v22.12
  if (_bloomSavedIds[postId]) {
    delete _bloomSavedIds[postId];
    delete _bloomSavedPosts[postId];
    if (post) bloomRecordSignal('unsave', post); // v22.12
    // v22.51: Remove from Library Bloom folder
    bloomRemoveFromLibrary(postId);
  } else {
    _bloomSavedIds[postId] = true;
    // v22.51: Store full post data for persistence
    if (post) {
      _bloomSavedPosts[postId] = {
        id: post.id,
        title: post.title || '',
        content: post.content || '',
        category: post.category || '',
        agent: post.agent || '',
        type: post.type || 'insight',
        imageUrl: post.imageUrl || '',
        videoUrl: post.videoUrl || '',
        savedAt: new Date().toISOString()
      };
    }
    if (post) bloomRecordSignal('save', post); // v22.12
    // v22.51: Save to Library Bloom folder
    if (post) bloomSaveToLibrary(post);
  }

  // v22.51: Persist to localStorage
  bloomPersistSaved(selectedBrand);

  var card = document.getElementById('bloom-card-' + postId);
  if (card) {
    var btns = card.querySelectorAll('.bloom-action-btn');
    // Save is the 3rd button (index 2)
    if (btns[2]) {
      var isSaved = !!_bloomSavedIds[postId];
      btns[2].classList.toggle('saved', isSaved);
      btns[2].innerHTML = '<svg viewBox="0 0 24 24" fill="' + (isSaved ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    }
  }

  showToast(_bloomSavedIds[postId] ? 'Post saved to Library' : 'Post unsaved', 'success');
}

// v22.51: Save bloom post to Library "Bloom Posts" folder
function bloomSaveToLibrary(post) {
  try {
    var brandIdx = selectedBrand;
    var lib = JSON.parse(localStorage.getItem('roweos_brand_library_' + brandIdx) || '{"files":[],"folders":[]}');
    // Build content from post
    var content = '';
    if (post.title) content += post.title + '\n\n';
    if (post.content) content += post.content;
    if (post.imageUrl) content += '\n\n[Image: ' + post.imageUrl + ']';
    if (post.videoUrl) content += '\n\n[Video: ' + post.videoUrl + ']';

    lib.files.push({
      id: 'bloom_' + post.id,
      name: (post.title || 'Bloom Post').substring(0, 60),
      content: content,
      folder: 'bloom',
      type: 'text',
      createdAt: new Date().toISOString(),
      source: 'bloom',
      category: post.category || '',
      agent: post.agent || ''
    });
    saveBrandLibrary(brandIdx, lib);
  } catch(e) { console.warn('[Bloom] Library save error:', e); }
}

// v22.51: Remove bloom post from Library
function bloomRemoveFromLibrary(postId) {
  try {
    var brandIdx = selectedBrand;
    var lib = JSON.parse(localStorage.getItem('roweos_brand_library_' + brandIdx) || '{"files":[],"folders":[]}');
    lib.files = lib.files.filter(function(f) { return f.id !== 'bloom_' + postId; });
    saveBrandLibrary(brandIdx, lib);
  } catch(e) { console.warn('[Bloom] Library remove error:', e); }
}

/**
 * v22.11: Toggle comments visibility
 */
// v22.52: Download video from Bloom post
function bloomDownloadVideo(postId) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post || !post.videoUrl) {
    showToast('Video not available', 'error');
    return;
  }
  try {
    var a = document.createElement('a');
    a.href = post.videoUrl;
    a.download = (post.title || 'bloom-video').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) + '.mp4';
    // For blob URLs, direct download works. For remote URLs, fetch first.
    if (post.videoUrl.indexOf('blob:') === 0) {
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Downloading video...', 'success');
    } else {
      // Remote URL - fetch and create blob
      showToast('Preparing download...', 'info');
      fetch(post.videoUrl).then(function(resp) {
        return resp.blob();
      }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
        showToast('Video downloaded', 'success');
      }).catch(function(err) {
        showToast('Download failed: ' + err.message, 'error');
      });
    }
  } catch(e) {
    showToast('Download failed', 'error');
  }
}

function bloomToggleComments(postId) {
  var commentsEl = document.getElementById('bloom-comments-' + postId);
  if (!commentsEl) return;
  var isHidden = commentsEl.style.display === 'none';
  commentsEl.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    var input = document.getElementById('bloom-input-' + postId);
    if (input) input.focus();
  }
}

/**
 * v22.11: Add comment with AI auto-reply
 */
var _bloomCommentPending = {}; // v22.56: Track pending AI replies per post
async function bloomComment(postId) {
  console.log('[Bloom Comment] Called with postId:', postId);
  var input = document.getElementById('bloom-input-' + postId);
  if (!input) { console.warn('[Bloom Comment] Input not found for:', postId); showToast('Comment input not found', 'warning'); return; }
  if (!input.value.trim()) { console.warn('[Bloom Comment] Empty input'); return; }

  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post) { console.warn('[Bloom Comment] Post not found in _bloomPosts:', postId, '_bloomPosts count:', _bloomPosts.length); showToast('Post not found - try refreshing', 'warning'); return; }

  // v22.56: Prevent rapid-fire — wait for previous AI reply on this post
  if (_bloomCommentPending[postId]) {
    showToast('Waiting for previous reply...', 'info');
    return;
  }

  var commentText = input.value.trim();
  input.value = '';
  input.style.height = 'auto'; // v22.56: Reset textarea height after send

  bloomRecordSignal('comment', post); // v22.12

  // Add user comment
  if (!post.comments) post.comments = [];
  post.comments.push({
    text: commentText,
    timestamp: Date.now(),
    isAI: false
  });

  // Re-render comments section
  renderBloomComments(postId);

  // Update comment count on button
  updateBloomCommentCount(postId);

  // AI auto-reply - v22.12: use user's selected provider/model
  try {
    var brandIdx = selectedBrand || 0;
    var brand = brands[brandIdx] || brands[0];
    var bSettings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
    var provider = bSettings.provider || (brand && brand.provider) || 'anthropic';
    var model = bSettings.model || (brand && brand.model) || 'claude-sonnet-4-6';
    if (provider === 'roweos' && typeof resolveRoweOSAI === 'function') {
      try { var _r = resolveRoweOSAI({ userMessage: commentText }); provider = _r.provider; model = _r.model; } catch(e) { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
    }
    // v22.49: Use selectedProvider for nanobanana fallback, not hardcoded anthropic
    if (provider === 'nanobanana') {
      var sp = localStorage.getItem('selectedProvider') || 'google';
      provider = sp !== 'nanobanana' ? sp : 'google';
      model = provider === 'google' ? 'gemini-3.1-pro-preview' : provider === 'openai' ? 'gpt-5.5' : 'claude-sonnet-4-6';
    }
    var apiKey = await getApiKey(provider);
    if (!apiKey) {
      var available = getAvailableProviders();
      if (available.google) { provider = 'google'; model = 'gemini-3.1-pro-preview'; apiKey = await getApiKey('google'); }
      else if (available.openai) { provider = 'openai'; model = 'gpt-5.5'; apiKey = await getApiKey('openai'); }
      else if (available.anthropic) { provider = 'anthropic'; model = 'claude-sonnet-4-6'; apiKey = await getApiKey('anthropic'); }
    }

    if (apiKey) {
      _bloomCommentPending[postId] = true; // v22.56: Lock this post
      // v22.56: Show typing indicator while AI generates reply
      var _typingEl = document.createElement('div');
      _typingEl.className = 'bloom-comment';
      _typingEl.id = 'bloom-typing-' + postId;
      _typingEl.innerHTML = '<div class="bloom-comment-avatar" style="background:var(--brand-accent,#a89878);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div><div class="bloom-comment-text" style="opacity:0.5;font-style:italic;">thinking...</div>';
      var _commentsForTyping = document.getElementById('bloom-comments-' + postId);
      if (_commentsForTyping) {
        var _inputWrapForTyping = _commentsForTyping.querySelector('.bloom-comment-input-wrap');
        if (_inputWrapForTyping) _commentsForTyping.insertBefore(_typingEl, _inputWrapForTyping);
        else _commentsForTyping.appendChild(_typingEl);
      }

      // v22.33: Enhanced prompt with client-add capability
      var replyPrompt = 'You are a helpful brand AI assistant for Bloom content. The user gave feedback on this content about "' + (post.title || '') + '": "' + commentText + '". Acknowledge their feedback briefly in 1-2 sentences. Be conversational. Do not use em-dashes.\n\nIMPORTANT: If the user asks you to add clients, leads, contacts, or businesses to the client list, you MUST output a JSON block at the end of your reply in this exact format:\n```roweos-add-clients\n[{"name":"Business Name","company":"Company","industry":"Industry","location":"City, ST","notes":"Brief note"}]\n```\nInclude as many fields as you know from context. Always include this block when the user asks to add to clients/leads.';
      var messages = [{ role: 'user', content: replyPrompt }];
      var sysPrompt = brand ? buildBrandSystemPrompt(brand, post.agent || 'strategy') : 'You are a helpful AI assistant.';

      var reply = '';
      if (provider === 'anthropic') {
        reply = await callAnthropicAPI(model, apiKey, messages, sysPrompt);
      } else if (provider === 'google') {
        reply = await callGoogleAPI(model, apiKey, messages, sysPrompt);
      } else if (provider === 'openai') {
        reply = await callOpenAIAPI(model, apiKey, messages, sysPrompt);
      }

      // v22.56: Remove typing indicator
      var _typingDone = document.getElementById('bloom-typing-' + postId);
      if (_typingDone) _typingDone.remove();

      if (reply) {
        // v22.33: Parse and execute client-add commands
        var cleanReply = reply;
        var clientMatch = reply.match(/```roweos-add-clients\s*\n([\s\S]*?)```/);
        if (clientMatch) {
          cleanReply = reply.replace(/```roweos-add-clients\s*\n[\s\S]*?```/, '').trim();
          try {
            var newClients = JSON.parse(clientMatch[1]);
            if (Array.isArray(newClients) && newClients.length > 0) {
              var clients = getClients();
              var now = new Date().toISOString();
              var addedCount = 0;
              newClients.forEach(function(nc) {
                if (nc.name) {
                  clients.push({
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                    brandIndex: typeof selectedBrand !== 'undefined' ? selectedBrand : 0,
                    name: nc.name || '',
                    company: nc.company || nc.name || '',
                    industry: nc.industry || '',
                    role: nc.role || '',
                    location: nc.location || '',
                    website: nc.website || '',
                    email: nc.email || '',
                    phone: nc.phone || '',
                    notes: nc.notes || 'Added via Bloom AI',
                    stage: 'lead',
                    stageHistory: [{ stage: 'lead', date: now }],
                    logo: '',
                    createdAt: now
                  });
                  addedCount++;
                }
              });
              if (addedCount > 0) {
                saveClients(clients);
                showToast(addedCount + ' client' + (addedCount > 1 ? 's' : '') + ' added as leads', 'success');
              }
            }
          } catch(parseErr) { console.warn('[Bloom] Client parse failed:', parseErr); }
        }

        post.comments.push({
          text: cleanReply,
          timestamp: Date.now(),
          isAI: true
        });
        renderBloomComments(postId);
        updateBloomCommentCount(postId);

        // v22.17: Inject knowledge suggestion after AI reply
        var userCommentIdx = post.comments.length - 2; // The user comment before AI reply
        var commentsEl = document.getElementById('bloom-comments-' + postId);
        if (commentsEl) {
          // Remove any existing suggestion for this post
          var existing = document.getElementById('bloom-knowledge-suggest-' + postId);
          if (existing) existing.remove();

          var suggestDiv = document.createElement('div');
          suggestDiv.className = 'bloom-comment-knowledge';
          suggestDiv.id = 'bloom-knowledge-suggest-' + postId;
          suggestDiv.innerHTML = '<button class="bloom-comment-knowledge-btn" id="bloom-knowledge-btn-' + postId + '" onclick="bloomAddToKnowledge(\'' + postId + '\', ' + userCommentIdx + ')">'
            + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14"/><path d="M5 12h14"/></svg>'
            + ' Add to Bloom Knowledge</button>';
          var inputWrap = commentsEl.querySelector('.bloom-comment-input-wrap');
          if (inputWrap) {
            commentsEl.insertBefore(suggestDiv, inputWrap);
          } else {
            commentsEl.appendChild(suggestDiv);
          }
        }
      }
    }
  } catch(err) {
    console.warn('[Bloom] AI reply failed:', err);
    // v22.56: Clean up typing indicator on error
    var _typingErr = document.getElementById('bloom-typing-' + postId);
    if (_typingErr) _typingErr.remove();
    var errMsg = (err && err.message) ? err.message : 'Unknown error';
    if (errMsg.length > 60) errMsg = errMsg.substring(0, 60) + '...';
    showToast('AI reply failed: ' + errMsg, 'warning');
  } finally {
    _bloomCommentPending[postId] = false; // v22.56: Unlock
  }
}

/**
 * v22.11: Re-render comments for a post
 */
function renderBloomComments(postId) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post) return;

  var commentsEl = document.getElementById('bloom-comments-' + postId);
  if (!commentsEl) return;

  var html = '';
  if (post.comments && post.comments.length > 0) {
    for (var c = 0; c < post.comments.length; c++) {
      html += renderBloomComment(post.comments[c]);
    }
  }
  html += '<div class="bloom-comment-input-wrap">';
  html += '<textarea class="bloom-comment-input" rows="1" id="bloom-input-' + postId + '" placeholder="Add a comment..." oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\'" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();bloomComment(\'' + postId + '\');}"></textarea>';
  html += '<button class="bloom-comment-send" onclick="bloomComment(\'' + postId + '\')">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>';
  html += '</div>';

  commentsEl.innerHTML = html;
  commentsEl.style.display = 'block';
}

/**
 * v22.11: Update comment count badge
 */
function updateBloomCommentCount(postId) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post) return;
  var card = document.getElementById('bloom-card-' + postId);
  if (!card) return;
  var btns = card.querySelectorAll('.bloom-action-btn');
  // Comment is 2nd button (index 1)
  if (btns[1]) {
    var count = post.comments ? post.comments.length : 0;
    btns[1].innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' + (count ? ' ' + count : '');
  }
}

/**
 * v22.11: Share post to Chat view
 */
function bloomShareToChat(postId) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post) return;

  // Navigate to chat
  showView('agent');

  // v22.22: Fix - use correct chat input ID (agentCommand, not userInput)
  setTimeout(function() {
    var chatInput = document.getElementById('agentCommand');
    if (chatInput) {
      var context = 'I want to discuss this ' + post.type + ' from Bloom:\n\n';
      context += '**' + (post.title || 'Untitled') + '**\n\n';
      context += (post.content || '').substring(0, 500);
      if (post.content && post.content.length > 500) context += '...';
      chatInput.value = context;
      chatInput.focus();
      // Trigger auto-resize
      autoResizeTextarea(chatInput);
    }
  }, 100);

  bloomRecordSignal('share', post); // v22.12
  showToast('Post shared to Chat', 'success');
}

/**
 * v22.12: Add bloom post to Pulse as a goal
 */
function bloomAddToPulse(postId) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post) return;
  // v22.12: Use correct Pulse goals system
  var goalTitle = post.title || post.operationName || 'Bloom insight';
  var goal = {
    id: 'bloom_' + Date.now(),
    title: goalTitle,
    category: post.category ? post.category.charAt(0).toUpperCase() + post.category.slice(1) : 'Strategy',
    source: 'bloom',
    completed: false,
    archived: false,
    items: [{ id: 'item_' + Date.now(), text: (post.content || '').substring(0, 300), completed: false }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    _modifiedAt: Date.now() // v25.2: Stamp for merge
  };
  if (typeof pulseGoals !== 'undefined') {
    pulseGoals.push(goal);
    if (typeof savePulseGoals === 'function') savePulseGoals();
    showToast('Added to Pulse', 'success');
  } else {
    showToast('Pulse not available', 'warning');
  }
}

/**
 * v22.12: Create automation from bloom post content
 */
function bloomCreateAutomation(postId) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post) return;
  // v22.12: Navigate to automations and open workflow form
  // v25.1: Autofill name, description, and action target from bloom post content
  showView('automations');
  if (typeof showAutoLabWorkflowForm === 'function') {
    setTimeout(function() {
      showAutoLabWorkflowForm();
      setTimeout(function() {
        var nameInput = document.getElementById('autoLabWfName');
        if (nameInput) {
          nameInput.value = post.title || post.operationName || 'Bloom automation';
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        var descInput = document.getElementById('autoLabWfDescription');
        if (descInput && !descInput.value) {
          var descText = '';
          if (post.content) {
            descText = post.content.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '').trim();
            if (descText.length > 200) descText = descText.substring(0, 197) + '...';
          } else if (post.operationName) {
            descText = 'Automate: ' + post.operationName;
          }
          if (descText) {
            descInput.value = descText;
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        // v25.1: Pre-select action based on post type
        var actionInput = document.getElementById('autoLabWfAction');
        if (actionInput && !actionInput.value || actionInput.value === 'notify') {
          var suggestedAction = 'studio';
          if (post.type === 'social' || post.category === 'social') suggestedAction = 'social';
          if (post.isImageOp) suggestedAction = 'image';
          actionInput.value = suggestedAction;
          if (typeof renderAutoLabTargetConfig === 'function') renderAutoLabTargetConfig(suggestedAction);
          // Pre-fill agent and op if available
          if (suggestedAction === 'studio' && post.agent) {
            setTimeout(function() {
              var agentEl = document.getElementById('autoLabWfTargetAgent');
              if (agentEl) {
                agentEl.value = post.agent;
                if (typeof updateAutoLabWfOperations === 'function') updateAutoLabWfOperations(post.agent);
              }
              if (post.operationId) {
                setTimeout(function() {
                  var opEl = document.getElementById('autoLabWfTargetOp');
                  if (opEl) opEl.value = String(post.operationId);
                }, 80);
              }
            }, 150);
          }
          // Pre-fill text prompt if studio message action
          if (suggestedAction === 'studio' && post.content) {
            setTimeout(function() {
              var textEl = document.getElementById('autoLabWfTargetText');
              if (textEl && !textEl.value) {
                var prompt = post.title ? 'Based on: ' + post.title : '';
                if (prompt) textEl.value = prompt;
              }
            }, 200);
          }
        }
      }, 200);
    }, 300);
  }
  showToast('Creating automation from this seed', 'success');
}

// v25.1: Show/hide the social post panel on a bloom card
function bloomShowSocialPost(postId) {
  var el = document.getElementById('bloom-social-post-' + postId);
  if (!el) return;
  // Close all others first
  var allPanels = document.querySelectorAll('[id^="bloom-social-post-"]');
  for (var i = 0; i < allPanels.length; i++) {
    if (allPanels[i].id !== 'bloom-social-post-' + postId) allPanels[i].style.display = 'none';
  }
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// v25.1: Post bloom caption directly to connected social platforms
function bloomPostToSocial(postId) {
  var captionEl = document.getElementById('bloom-social-caption-' + postId);
  if (!captionEl) { showToast('Caption not found', 'error'); return; }
  var caption = captionEl.value.trim();
  if (!caption) { showToast('Caption is empty', 'warning'); return; }

  // Set the social publisher content and use existing postToSocial infrastructure
  window._socialPublisherContent = caption;
  window._socialPublisherImage = null;
  window._socialPublisherEditedContent = {};

  var connectedPlatforms = [];
  var allPlats = ['x', 'threads', 'instagram', 'tiktok'];
  for (var i = 0; i < allPlats.length; i++) {
    if (typeof isSocialConnected === 'function' && isSocialConnected(allPlats[i])) {
      connectedPlatforms.push(allPlats[i]);
    }
  }

  if (connectedPlatforms.length === 0) {
    showToast('No platforms connected. Go to Settings to connect.', 'warning');
    return;
  }

  // Post to all connected platforms
  showToast('Posting to ' + connectedPlatforms.length + ' platform' + (connectedPlatforms.length !== 1 ? 's' : '') + '...', 'info');
  var successes = 0, failures = 0;
  var total = connectedPlatforms.length;
  function checkDone() {
    if (successes + failures === total) {
      if (successes > 0) {
        showToast('Posted to ' + successes + ' platform' + (successes !== 1 ? 's' : ''), 'success');
        var panel = document.getElementById('bloom-social-post-' + postId);
        if (panel) panel.style.display = 'none';
      }
      if (failures > 0) showToast(failures + ' post' + (failures !== 1 ? 's' : '') + ' failed', 'error');
    }
  }
  connectedPlatforms.forEach(function(platform) {
    if (typeof postToSocial === 'function') {
      postToSocial(platform, { silent: true }).then(function(result) {
        if (result && result.success) { successes++; } else { failures++; }
        checkDone();
      }).catch(function() { failures++; checkDone(); });
    } else { failures++; checkDone(); }
  });
}

// v25.1: Open full publisher pre-filled from bloom card
function bloomOpenPublisherWithCaption(postId) {
  var captionEl = document.getElementById('bloom-social-caption-' + postId);
  var caption = captionEl ? captionEl.value.trim() : '';
  if (!caption) {
    var post = _bloomPosts.find(function(p) { return p.id === postId; });
    if (post) caption = post.content || post.title || '';
  }
  window._socialPublisherContent = caption;
  window._socialPublisherImage = null;
  window._socialPublisherEditedContent = {};
  showView('studio');
  setTimeout(function() {
    if (typeof showSocialPublisher === 'function') showSocialPublisher(caption, []);
  }, 150);
}

// v23.8: Toggle identity section picker on a bloom card
function bloomShowIdentityPush(postId) {
  var el = document.getElementById('bloom-identity-push-' + postId);
  if (!el) return;
  // Close all others first
  var allPush = document.querySelectorAll('.bloom-identity-push');
  for (var i = 0; i < allPush.length; i++) {
    if (allPush[i].id !== 'bloom-identity-push-' + postId) allPush[i].style.display = 'none';
  }
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// v23.8: Push bloom post content to a brand identity section
function bloomPushToIdentity(postId, section) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post) { showToast('Post not found', 'warning'); return; }

  var brandIdx = post.brandIdx !== undefined ? post.brandIdx : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
  var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : null;
  if (!brand) { showToast('Brand not found', 'warning'); return; }

  // Ensure identityData structure exists
  if (!brand.identityData) brand.identityData = {};
  if (!brand.identityData[section]) brand.identityData[section] = { owner: '', ai: '' };

  // Build insight text from post content
  var insight = '';
  if (post.title) insight += post.title + ': ';
  if (post.content) {
    // Clean up content - remove markdown formatting
    var cleanContent = post.content.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '- ').trim();
    insight += cleanContent;
  }
  if (!insight) { showToast('No content to push', 'warning'); return; }

  // Truncate if very long
  if (insight.length > 500) insight = insight.substring(0, 497) + '...';

  // Append to AI field with separator
  var existing = brand.identityData[section].ai || '';
  if (typeof existing !== 'string') {
    existing = Array.isArray(existing) ? existing.join('\n') : String(existing);
  }
  var separator = existing.trim() ? '\n\n[Bloom Insight] ' : '[Bloom Insight] ';
  brand.identityData[section].ai = existing + separator + insight;

  // Save
  if (typeof saveBrands === 'function') saveBrands();
  // v25.1: saveBrands() already writes through to Firestore

  // Hide the picker
  var el = document.getElementById('bloom-identity-push-' + postId);
  if (el) el.style.display = 'none';

  var sectionNames = { essence: 'Brand Essence', voice: 'Voice & Tone', audience: 'Target Audience', messaging: 'Key Messaging', products: 'Products & Services', visual: 'Visual Identity', competitive: 'Competitive Positioning' };
  showToast('Pushed to ' + (sectionNames[section] || section), 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATIONS LAB v13.9
// ═══════════════════════════════════════════════════════════════════════════

/**
 * v14: Master init for Automations Lab
 */
function initAutomationsLab() {
  renderAutoLabStats();
  renderAutoLabWorkflows();
}

/**
 * v13.9: Tab switcher
 */
function showAutoLabTab(tabName) {
  // v24.11: Gate Founder-only tabs for Solo users
  var founderOnlyTabs = { autoagent: 'automationsAgent', imagelab: 'automationsAgent', videolab: 'automationsAgent', agents: 'automationsAgent' };
  if (founderOnlyTabs[tabName] && typeof hasFeatureAccess === 'function' && !hasFeatureAccess(founderOnlyTabs[tabName])) {
    if (typeof showUpgradeModal === 'function') showUpgradeModal(founderOnlyTabs[tabName], 'founder');
    return;
  }
  // v26.0: Only toggle old-style tab buttons if they still exist
  var tabs = document.querySelectorAll('.auto-lab-tab');
  if (tabs.length > 0) {
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-auto-tab') === tabName) {
        tabs[i].classList.add('active');
      } else {
        tabs[i].classList.remove('active');
      }
    }
  }
  // v26.0: Update pill nav active state
  if (typeof updatePillNavActive === 'function') updatePillNavActive('autoLabPillNav', tabName);
  // Update tab content
  var contents = document.querySelectorAll('.auto-lab-tab-content');
  for (var j = 0; j < contents.length; j++) {
    contents[j].classList.remove('active');
  }
  var map = { workflows: 'autoLabWorkflows', agents: 'autoLabAgents', scheduler: 'autoLabScheduler', imagelab: 'autoLabImageLab', videolab: 'autoLabVideoLab', usage: 'autoLabUsage', pending: 'autoLabPending', autoagent: 'autoLabAutoAgent', browse: 'autoLabBrowse' };
  var target = document.getElementById(map[tabName]);
  if (target) target.classList.add('active');

  // Render content for the selected tab
  if (tabName === 'workflows') renderAutoLabWorkflows();
  else if (tabName === 'agents') renderAutoLabAgents();
  else if (tabName === 'scheduler') renderAutoLabScheduler();
  else if (tabName === 'imagelab') {
    var target = document.getElementById(map[tabName]);
    if (target) {
      target.classList.add('active');
      target.innerHTML = '<div style="text-align:center;padding:60px 20px;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:12px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><h3 style="color:var(--text-primary);margin-bottom:8px;">Image Lab has moved</h3><p style="color:var(--text-secondary);margin-bottom:16px;">Image Lab is now in Media Lab > Media</p><button onclick="showView(\'social\');showSocialTab(\'media\');" style="padding:8px 20px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;">Go to Media</button></div>';
    }
  }
  else if (tabName === 'videolab') {
    var target2 = document.getElementById(map[tabName]);
    if (target2) {
      target2.classList.add('active');
      target2.innerHTML = '<div style="text-align:center;padding:60px 20px;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:12px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg><h3 style="color:var(--text-primary);margin-bottom:8px;">Video Lab has moved</h3><p style="color:var(--text-secondary);margin-bottom:16px;">Video Lab is now in Media Lab > Media</p><button onclick="showView(\'social\');showSocialTab(\'media\');setTimeout(function(){showMediaSubTab(\'video\');},100);" style="padding:8px 20px;border-radius:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;">Go to Media</button></div>';
    }
  }
  else if (tabName === 'usage') renderAutoLabUsage();
  else if (tabName === 'pending') renderPendingApproval();
  else if (tabName === 'browse') renderAutoLabBrowse();
  else if (tabName === 'autoagent') initAutoAgent();
}

/**
 * v24.16: Dynamic reorderable auto-lab tabs
 */
var _autoLabDefaultOrder = ['autoagent', 'browse', 'workflows', 'scheduler', 'agents', 'imagelab', 'videolab', 'pending'];
var _autoLabTabLabels = {
  autoagent: 'Agent',
  browse: 'Browse',
  workflows: 'Workflows',
  scheduler: 'Executions',
  agents: 'Studio Lab',
  imagelab: 'Image Lab',
  videolab: 'Video Lab',
  pending: 'Pending'
};

function getAutoLabTabOrder() {
  try {
    var saved = JSON.parse(localStorage.getItem('roweos_autolab_tab_order') || 'null');
    if (saved && Array.isArray(saved)) {
      // Remove any tabs no longer in the set, add any new ones
      var valid = saved.filter(function(t) { return _autoLabTabLabels[t]; });
      Object.keys(_autoLabTabLabels).forEach(function(t) {
        if (valid.indexOf(t) === -1) valid.push(t);
      });
      return valid;
    }
  } catch(e) {}
  return _autoLabDefaultOrder.slice();
}

function saveAutoLabTabOrder(order) {
  try { localStorage.setItem('roweos_autolab_tab_order', JSON.stringify(order)); } catch(e) {}
  writeDB('profile/main', { autoLabTabOrder: order }); // v25.1
}

function buildAutoLabTabs() {
  // v26.0: Use pill nav instead of old tab buttons
  var order = getAutoLabTabOrder();
  var items = [];
  var primaryTabs = ['autoagent', 'browse', 'workflows', 'scheduler'];
  order.forEach(function(tabId) {
    var label = _autoLabTabLabels[tabId];
    if (!label) return;
    items.push({ id: tabId, label: label, secondary: primaryTabs.indexOf(tabId) === -1 });
  });
  renderPillNav('autoLabPillNav', items, 'autoagent', function(tabId) { showAutoLabTab(tabId); }, { viewId: 'automations' });
}

// Build tabs on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildAutoLabTabs);
} else {
  setTimeout(buildAutoLabTabs, 0);
}

/**
 * v15.7: Render Nanobanana Usage/Cost Counter tab
 */
function renderAutoLabUsage() {
  var container = document.getElementById('autoLabUsage');
  if (!container) return;

  var stats = getNanobananaUsageStats();

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function statCard(label, period) {
    var s = stats[period];
    var textCalls = s.byType.text || 0;
    var imgCalls = s.byType.image || 0;
    var resCalls = s.byType.research || 0;

    // Model breakdown
    var modelHtml = '';
    var models = Object.keys(s.byModel);
    models.sort(function(a, b) { return s.byModel[b] - s.byModel[a]; });
    for (var i = 0; i < Math.min(models.length, 5); i++) {
      var mName = models[i].replace('gemini-', '').replace('-preview', '').replace('-exp', '');
      modelHtml += '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:12px;">' +
        '<span style="color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;">' + escapeHtml(mName) + '</span>' +
        '<span style="color:var(--text-primary);font-weight:500;">' + s.byModel[models[i]] + '</span></div>';
    }
    if (models.length === 0) {
      modelHtml = '<div style="font-size:12px;color:var(--text-tertiary);text-align:center;padding:8px 0;">No calls yet</div>';
    }

    return '<div style="background:var(--bg-secondary);border:1px solid var(--border-primary);border-radius:12px;padding:16px;flex:1;min-width:200px;">' +
      '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">' + label + '</div>' +
      '<div style="font-size:28px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">' + s.calls + ' <span style="font-size:14px;font-weight:400;color:var(--text-tertiary);">calls</span></div>' +
      '<div style="display:flex;gap:12px;margin-bottom:12px;">' +
        '<div style="font-size:12px;"><span style="color:var(--brand-accent);">' + textCalls + '</span> text</div>' +
        '<div style="font-size:12px;"><span style="color:#f472b6;">' + imgCalls + '</span> image</div>' +
        '<div style="font-size:12px;"><span style="color:#60a5fa;">' + resCalls + '</span> research</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;">Characters: ' + formatNum(s.inputChars) + ' in / ' + formatNum(s.outputChars) + ' out</div>' +
      '<div style="border-top:1px solid var(--border-primary);padding-top:8px;margin-top:4px;">' +
        '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">Top Models</div>' +
        modelHtml +
      '</div>' +
    '</div>';
  }

  var html = '<div style="padding:16px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--brand-accent)" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>' +
      '<h3 style="margin:0;font-size:16px;font-weight:600;color:var(--text-primary);">Nano Banana Usage</h3>' +
      '<button onclick="if(confirm(\'Clear all usage data?\')) { localStorage.removeItem(\'roweos_nanobanana_usage\'); nanobananaUsage = []; renderAutoLabUsage(); showToast(\'Usage data cleared\', \'success\'); }" ' +
        'style="margin-left:auto;background:none;border:1px solid var(--border-primary);border-radius:6px;padding:4px 10px;font-size:12px;color:var(--text-secondary);cursor:pointer;" ' +
        'onmouseover="this.style.borderColor=\'var(--brand-accent)\'" onmouseout="this.style.borderColor=\'var(--border-primary)\'">Clear Data</button>' +
    '</div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
      statCard('Today', 'today') +
      statCard('This Week', 'week') +
      statCard('This Month', 'month') +
      statCard('All Time', 'all') +
    '</div>' +
  '</div>';

  container.innerHTML = html;
}

/**
 * v13.9: Render 4 stat pills
 */
function renderAutoLabStats() {
  var el = document.getElementById('autoLabStats');
  if (!el) return;
  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) { console.warn('[Automations] Parse error:', e.message); }
  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  // Merge and dedupe by id
  var allAutos = automations.slice();
  scheduled.forEach(function(s) {
    var exists = allAutos.some(function(a) { return String(a.id) === String(s.id); });
    if (!exists) allAutos.push(s);
  });
  var total = allAutos.length;
  var active = allAutos.filter(function(a) { return a.enabled !== false; }).length;

  // Runs today from history
  var history = [];
  try { history = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]'); } catch(e) {}
  var todayStr = new Date().toISOString().slice(0, 10);
  var runsToday = history.filter(function(h) { return h.timestamp && h.timestamp.slice(0, 10) === todayStr; }).length;
  var successCount = history.filter(function(h) { return h.success; }).length;
  var successRate = history.length > 0 ? Math.round((successCount / history.length) * 100) : 100;

  // v22.37: Stat cards like Analytics view
  var _cardStyle = 'background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:var(--space-4) var(--space-5);';
  var _labelStyle = 'font-size:var(--text-sm);color:var(--text-tertiary);margin-bottom:4px;';
  var _valStyle = 'font-size:var(--text-2xl);font-weight:600;';
  var statsHtml = '';
  statsHtml += '<div style="' + _cardStyle + '"><div style="' + _labelStyle + '">Workflows</div><div style="' + _valStyle + 'color:var(--text-primary);">' + total + '</div></div>';
  statsHtml += '<div style="' + _cardStyle + '"><div style="' + _labelStyle + '">Active</div><div style="' + _valStyle + 'color:#4ade80;">' + active + '</div></div>';
  statsHtml += '<div style="' + _cardStyle + '"><div style="' + _labelStyle + '">Runs Today</div><div style="' + _valStyle + 'color:var(--accent);">' + runsToday + '</div></div>';
  statsHtml += '<div style="' + _cardStyle + '"><div style="' + _labelStyle + '">Success Rate</div><div style="' + _valStyle + 'color:var(--text-primary);">' + successRate + '%</div></div>';
  el.innerHTML = statsHtml;
}

// ─── WORKFLOWS TAB ──────────────────────────────────────────────────────

/**
 * v13.9: Render workflows grid
 */
// v24.4: Color picker for custom workflow categories
function selectWfCatColor(btn, color) {
  var parent = btn.parentElement;
  if (!parent) return;
  var btns = parent.querySelectorAll('.auto-lab-cat-color-btn');
  btns.forEach(function(b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
}

function renderAutoLabWorkflows() {
  var el = document.getElementById('autoLabWorkflows');
  if (!el) return;

  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) { console.warn('[Automations] Parse error:', e.message); }
  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  // Merge by id
  var merged = {};
  automations.forEach(function(a) { merged[String(a.id)] = a; });
  scheduled.forEach(function(s) { if (!merged[String(s.id)]) merged[String(s.id)] = s; });
  var all = Object.keys(merged).map(function(k) { return merged[k]; });
  // Sort newest first
  all.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });

  var html = '';

  // v22.46: Create cards in their own row, separate from pipeline list
  // v24.11: Pipeline and Agent cards only for Founder+
  var _hasFullAuto = typeof hasFeatureAccess === 'function' && hasFeatureAccess('automationsAgent');
  html += '<div class="auto-lab-create-row">';
  html += '<div class="auto-lab-card create-card" onclick="showAutoLabWorkflowForm()">';
  html += '<div style="text-align:center;color:var(--text-muted);">';
  html += '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.5;"><path d="M12 5v14M5 12h14"/></svg>';
  html += '<div style="font-size:14px;font-weight:500;">Create Workflow</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Single action</div>';
  html += '</div></div>';
  if (_hasFullAuto) {
    html += '<div class="auto-lab-card create-card" onclick="showPipelineBuilder()">';
    html += '<div style="text-align:center;color:var(--text-muted);">';
    html += '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.5;"><circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="20" r="2"/><path d="M12 6v4M12 14v4"/></svg>';
    html += '<div style="font-size:14px;font-weight:500;">Create Pipeline</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Multi-step chain</div>';
    html += '</div></div>';
    // v24.2: Automations Agent card
    html += '<div class="auto-lab-card create-card" onclick="showAutoLabTab(\'autoagent\')" style="border-color:var(--brand-accent-10, rgba(168,152,120,0.15));">';
    html += '<div style="text-align:center;color:var(--brand-accent, #a89878);">';
    html += '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.7;"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
    html += '<div style="font-size:14px;font-weight:500;">Automations Agent</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Build with AI</div>';
    html += '</div></div>';
  }
  html += '</div>';

  // v22.46: Apply saved custom order
  var _savedOrder = [];
  try { _savedOrder = JSON.parse(localStorage.getItem('roweos_automation_order') || '[]'); } catch(e) {}
  if (_savedOrder.length > 0) {
    var _orderMap = {};
    _savedOrder.forEach(function(id, idx) { _orderMap[String(id)] = idx; });
    all.sort(function(a, b) {
      var aIdx = _orderMap[String(a.id)] !== undefined ? _orderMap[String(a.id)] : 9999;
      var bIdx = _orderMap[String(b.id)] !== undefined ? _orderMap[String(b.id)] : 9999;
      if (aIdx === bIdx) return (b.id || 0) - (a.id || 0);
      return aIdx - bIdx;
    });
  }

  // v23.2: Empty state if no workflows/pipelines exist
  if (all.length === 0) {
    html += '<div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:13px;border-top:1px solid var(--border-color);margin-top:4px;">Your workflows and pipelines will appear here</div>';
  }

  // v22.46: Pipeline/workflow grid on second row
  html += '<div class="auto-lab-grid" id="autoLabCardGrid">';
  all.forEach(function(a) {
    var isEnabled = a.enabled !== false;
    var isPipeline = a.type === 'pipeline';
    var actionLabel = isPipeline ? 'pipeline' : (a.action || 'notify');
    var recurLabel = a.recurType === 'custom' && a.recurInterval ? 'Every ' + a.recurInterval + ' ' + (a.recurUnit || 'days') : (a.recurType && a.recurType !== 'none' ? a.recurType : 'one-time');
    var idShort = String(a.id).slice(-4);
    var lastRunText = '';
    if (a.lastRun) {
      var diff = Date.now() - new Date(a.lastRun).getTime();
      var mins = Math.floor(diff / 60000);
      if (mins < 1) lastRunText = 'just now';
      else if (mins < 60) lastRunText = mins + 'm ago';
      else if (mins < 1440) lastRunText = Math.floor(mins / 60) + 'h ago';
      else lastRunText = Math.floor(mins / 1440) + 'd ago';
    }
    // v22.32: Check if this automation is currently running
    var _runInfo = isAutomationRunning(a.id);
    var _runClass = '';
    if (_runInfo) {
      if (_runInfo.type === 'research') _runClass = ' is-running-research';
      else if (_runInfo.type === 'thinking') _runClass = ' is-running-thinking';
      else _runClass = ' is-running';
    }
    // v23.2: Category badge + drag handle
    var _catLabel = a.category || '';
    var _catColors = { content: '#8b5cf6', client: '#3b82f6', operations: '#f59e0b', custom: '#6b7280' };
    // v24.4: Use custom category color if set
    var _catColor = a.categoryColor || _catColors[(_catLabel || '').toLowerCase()] || 'var(--text-muted)';
    html += '<div class="auto-lab-card' + _runClass + '" data-auto-id="' + escapeHtml(String(a.id)) + '" draggable="true" onclick="toggleAutoCardExpand(this,event)" ondragstart="onAutoCardDragStart(event,\'' + a.id + '\')" ondragover="onAutoCardDragOver(event)" ondragleave="onAutoCardDragLeave(event)" ondrop="onAutoCardDrop(event,\'' + a.id + '\')" ondragend="onAutoCardDragEnd(event)">';
    html += '<div class="auto-lab-drag-handle" title="Drag to reorder"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><circle cx="8" cy="4" r="1.5"/><circle cx="16" cy="4" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="20" r="1.5"/><circle cx="16" cy="20" r="1.5"/></svg></div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-variant-numeric:tabular-nums;">' + (isPipeline ? 'PL' : 'WF') + '-' + escapeHtml(idShort);
    if (_catLabel) html += ' <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:' + _catColor + ';color:#fff;text-transform:uppercase;letter-spacing:0.3px;margin-left:4px;vertical-align:1px;">' + escapeHtml(_catLabel) + '</span>';
    html += '</div>';
    html += '<div class="auto-lab-card-title">' + escapeHtml(a.name || 'Untitled') + '</div>';
    // v19.2: Brand badge on automation cards
    var _cardBrand = (typeof brands !== 'undefined' && a.brandIdx !== undefined && brands[a.brandIdx]) ? (brands[a.brandIdx].shortName || brands[a.brandIdx].name) : '';
    if (_cardBrand) html += '<div style="font-size:11px;color:var(--accent);margin-top:2px;">' + escapeHtml(_cardBrand) + '</div>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    var badgeDot = isEnabled ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#4ade80;margin-right:4px;"></span>' : '';
    html += '<span class="auto-lab-card-badge ' + (isEnabled ? 'enabled' : 'disabled') + '" onclick="event.stopPropagation();toggleAutoLabWorkflow(\'' + a.id + '\')" style="cursor:pointer;" title="Click to ' + (isEnabled ? 'deactivate' : 'activate') + '">' + badgeDot + (isEnabled ? 'Active' : 'Off') + '</span>';
    html += '<svg class="auto-lab-card-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    html += '</div>';
    html += '</div>';

    // v22.46: Workflow action badge (non-pipeline) — shows action type with color
    if (!isPipeline) {
      var _wfType = PIPELINE_STEP_TYPES[a.action];
      if (_wfType) {
        html += '<div style="margin:6px 0 2px;">';
        html += '<span class="auto-lab-action-badge" style="background:' + _wfType.color + ';">';
        html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" stroke-width="2">' + _wfType.icon + '</svg>';
        html += _wfType.label + '</span>';
        html += '</div>';
      }
    }

    // v22.46: Pipeline step dots visualization with full color map
    if (isPipeline && a.steps && a.steps.length > 0) {
      html += '<div style="display:flex;align-items:center;gap:4px;margin:8px 0;flex-wrap:wrap;">';
      a.steps.forEach(function(s, si) {
        var sType = PIPELINE_STEP_TYPES[s.action];
        var col = sType ? sType.color : 'var(--text-muted)';
        var sLabel = sType ? sType.label : s.action;
        if (si > 0) {
          // v22.49: Show approval gate indicator between dots if previous step requires approval
          var prevStep = a.steps[si - 1];
          if (prevStep.config && prevStep.config.requireApproval) {
            html += '<div style="display:flex;align-items:center;justify-content:center;width:14px;height:14px;flex-shrink:0;" title="Approval required after Step ' + si + '">';
            html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#f59e0b" stroke-width="3"><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
            html += '</div>';
          } else {
            html += '<div style="width:12px;height:2px;background:' + col + ';opacity:0.4;flex-shrink:0;"></div>';
          }
        }
        html += '<div class="pipeline-step-dot" title="Step ' + (si + 1) + ': ' + escapeHtml(s.name || sLabel) + '" style="width:10px;height:10px;border-radius:50%;background:' + col + ';color:' + col + ';flex-shrink:0;"></div>';
      });
      html += '<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">' + a.steps.length + ' steps</span>';
      html += '</div>';
    }

    // v24.18: Show date+time for one-time automations, use formatTimeDisplay for preference
    var _metaParts = [escapeHtml(recurLabel)];
    if (recurLabel === 'one-time' && a.scheduledDate) {
      var _schedParts = [];
      _schedParts.push(escapeHtml(a.scheduledDate));
      if (a.time) _schedParts.push(escapeHtml(typeof formatTimeDisplay === 'function' ? formatTimeDisplay(a.time) : a.time));
      _metaParts.push(_schedParts.join(' '));
    } else if (recurLabel !== 'one-time') {
      _metaParts.push(a.time ? escapeHtml(typeof formatTimeDisplay === 'function' ? formatTimeDisplay(a.time) : a.time) : '--:--');
    }
    _metaParts.push(escapeHtml(actionLabel));
    html += '<div class="auto-lab-card-meta">' + _metaParts.join(' &middot; ') + '</div>';
    // v22.47: Show approval indicator if requireApproval is enabled
    var _hasApproval = (a.config && a.config.requireApproval) || (isPipeline && a.steps && a.steps.some(function(s) { return s.config && s.config.requireApproval; }));
    if (_hasApproval) {
      html += '<div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:10px;color:#f59e0b;">';
      html += '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
      html += 'Requires Approval</div>';
    }
    // v22.32: Show timer badge for running automations
    if (_runInfo) {
      var _elapsed = Math.round((Date.now() - _runInfo.startTime) / 1000);
      var _elapsedFmt = _elapsed >= 60 ? Math.floor(_elapsed / 60) + 'm ' + (_elapsed % 60) + 's' : _elapsed + 's';
      if (_runInfo.type === 'research') {
        html += '<div class="dr-timer-badge"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#a78bfa" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg><span class="dr-timer-text">Deep Research: ' + _elapsedFmt + '</span></div>';
      } else if (_runInfo.type === 'thinking') {
        html += '<div class="thinking-timer-badge"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22d3ee" stroke-width="2"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><path d="M10 21h4"/></svg><span>Thinking: ' + _elapsedFmt + '</span></div>';
      }
    }
    // v23.11: Expandable detail section
    html += '<div class="auto-lab-card-expand">';
    if (a.description) {
      html += '<div class="auto-lab-card-desc">' + escapeHtml(a.description) + '</div>';
    }
    if (isPipeline && a.steps && a.steps.length > 0) {
      html += '<div class="auto-lab-expand-steps">';
      a.steps.forEach(function(s, si) {
        var sType = PIPELINE_STEP_TYPES[s.action] || PIPELINE_STEP_TYPES.studio;
        html += '<div class="auto-lab-expand-step">';
        html += '<div class="auto-lab-expand-dot" style="background:rgba(' + sType.rgb + ',0.15);">';
        html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + sType.color + '" stroke-width="2">' + sType.icon + '</svg>';
        html += '</div>';
        html += '<div class="auto-lab-expand-step-info">';
        html += '<div class="auto-lab-expand-step-name">' + escapeHtml(s.name || 'Step ' + (si + 1)) + '</div>';
        html += '<div class="auto-lab-expand-step-type">' + sType.label + '</div>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    } else if (!isPipeline) {
      var _wfActionType = PIPELINE_STEP_TYPES[a.action];
      if (_wfActionType) {
        html += '<div class="auto-lab-expand-steps"><div class="auto-lab-expand-step">';
        html += '<div class="auto-lab-expand-dot" style="background:rgba(' + _wfActionType.rgb + ',0.15);">';
        html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + _wfActionType.color + '" stroke-width="2">' + _wfActionType.icon + '</svg>';
        html += '</div>';
        html += '<div class="auto-lab-expand-step-info">';
        html += '<div class="auto-lab-expand-step-name">' + _wfActionType.label + '</div>';
        var _wfDesc = (a.target && a.target.text) || (a.target && a.target.contextRef) || '';
        if (_wfDesc) html += '<div class="auto-lab-expand-step-type" style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(_wfDesc.substring(0, 80)) + '</div>';
        html += '</div></div></div>';
      }
    }
    html += '<div class="auto-lab-card-actions" style="margin-top:8px;">';
    // v22.32: Show "In Progress" when running, otherwise show last run
    var _lastRunDisplay = '';
    if (_runInfo) {
      _lastRunDisplay = '<span style="font-size:11px;color:var(--accent);font-weight:500;">In Progress</span>';
    } else {
      _lastRunDisplay = '<span style="font-size:11px;color:var(--text-muted);">' + (lastRunText ? 'Last run: ' + lastRunText : 'Never run') + '</span>';
    }
    html += _lastRunDisplay;
    html += '<span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;">';
    // v17.4: Edit button routes to pipeline builder for pipeline type
    if (isPipeline) {
      html += '<button class="auto-lab-card-btn" onclick="event.stopPropagation();showPipelineBuilder(\'' + a.id + '\')">Edit</button>';
    } else {
      html += '<button class="auto-lab-card-btn" onclick="event.stopPropagation();showAutoLabWorkflowForm(\'' + a.id + '\')">Edit</button>';
    }
    html += '<button class="auto-lab-card-btn" onclick="event.stopPropagation();duplicateAutoLabWorkflow(\'' + a.id + '\')">Duplicate</button>';
    if (isAutomationRunning(a.id)) {
      html += '<button class="auto-lab-card-btn danger" onclick="event.stopPropagation();stopAutomation(\'' + a.id + '\')">Stop</button>';
    } else {
      html += '<button class="auto-lab-card-btn primary" onclick="event.stopPropagation();runAutoLabNow(\'' + a.id + '\')">Run Now</button>';
    }
    html += '<button class="auto-lab-card-btn danger" onclick="event.stopPropagation();deleteAutoLabWorkflow(\'' + a.id + '\')">Delete</button>';
    html += '</span>';
    html += '</div></div></div>';
  });
  html += '</div>';

  if (all.length === 0) {
    html += '<div class="auto-lab-empty">No workflows yet. Create your first automation above.</div>';
  }

  el.innerHTML = html;

  // v29.x: Restore pulsing glow on active step dots for running pipelines
  // Use requestAnimationFrame to ensure DOM is painted before querying dots
  requestAnimationFrame(function() { restoreRunningStepDots(); });
}

// v22.46: Drag-and-drop for automation/pipeline cards on main grid
var _autoCardDragId = '';

function onAutoCardDragStart(e, id) {
  // v23.2: Only allow drag from handle — prevent text selection interference
  var handle = e.target.closest('.auto-lab-drag-handle');
  if (!handle) { e.preventDefault(); return; }
  _autoCardDragId = String(id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
  var card = e.target.closest('.auto-lab-card');
  if (card) setTimeout(function() { card.classList.add('dragging'); }, 0);
}

function onAutoCardDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var card = e.target.closest('.auto-lab-card');
  if (card && card.getAttribute('data-auto-id') !== _autoCardDragId) {
    card.classList.add('drag-over');
  }
}

function onAutoCardDragLeave(e) {
  var card = e.target.closest('.auto-lab-card');
  if (card) card.classList.remove('drag-over');
}

// v23.2: Clean up drag state on dragend — prevents ghost/dotted cards
function onAutoCardDragEnd(e) {
  var grid = document.getElementById('autoLabCardGrid');
  if (grid) {
    var cards = grid.querySelectorAll('.auto-lab-card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('dragging', 'drag-over');
  }
  _autoCardDragId = '';
}

function onAutoCardDrop(e, targetId) {
  e.preventDefault();
  var card = e.target.closest('.auto-lab-card');
  if (card) card.classList.remove('drag-over');
  if (!_autoCardDragId || _autoCardDragId === String(targetId)) return;
  // Get current card order from the DOM grid
  var grid = document.getElementById('autoLabCardGrid');
  if (!grid) return;
  var cards = grid.querySelectorAll('.auto-lab-card[data-auto-id]');
  var ids = [];
  for (var c = 0; c < cards.length; c++) ids.push(cards[c].getAttribute('data-auto-id'));
  var fromIdx = ids.indexOf(_autoCardDragId);
  var toIdx = ids.indexOf(String(targetId));
  if (fromIdx === -1 || toIdx === -1) return;
  // Move item
  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, _autoCardDragId);
  // Save order
  try { localStorage.setItem('roweos_automation_order', JSON.stringify(ids)); } catch(e) {}
  _autoCardDragId = '';
  renderAutoLabWorkflows();
  showToast('Card order saved', 'success');
}

/**
 * v13.9: Show workflow creation/edit form
 */
function showAutoLabWorkflowForm(editId) {
  var el = document.getElementById('autoLabWorkflows');
  if (!el) return;

  // Find existing automation if editing
  var existing = null;
  if (editId) {
    var idStr = String(editId);
    var automations = [];
    try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) { console.warn('[Automations] Parse error:', e.message); }
    existing = automations.find(function(a) { return String(a.id) === idStr; });
    if (!existing) {
      var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
      existing = scheduled.find(function(a) { return String(a.id) === idStr; });
    }
  }

  var html = '<div class="auto-lab-form" id="autoLabWorkflowForm">';
  html += '<div class="auto-lab-form-title">' + (existing ? 'Edit Workflow' : 'Create Workflow') + '</div>';
  html += '<input type="hidden" id="autoLabWfEditId" value="' + (existing ? existing.id : '') + '">';

  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field" style="flex:2;"><label>Name</label>';
  html += '<input type="text" id="autoLabWfName" placeholder="e.g. Weekly content review" value="' + escapeHtml(existing ? existing.name || '' : '') + '"></div>';
  // v23.11: Description field
  html += '<div class="auto-lab-form-field" style="flex:1;"><label>Description</label>';
  html += '<input type="text" id="autoLabWfDescription" placeholder="What does this workflow do?" value="' + escapeHtml(existing ? existing.description || '' : '') + '"></div>';
  html += '</div>';
  html += '<div class="auto-lab-form-row">';
  // v23.2: Category selector
  // v23.17: Custom category with text input
  var _wfCatIsCustom = existing && existing.category && ['Content','Client','Operations',''].indexOf(existing.category) === -1;
  html += '<div class="auto-lab-form-field" style="flex:1;"><label>Category</label>';
  html += '<select id="autoLabWfCategory" onchange="var isC=this.value===\'Custom\';var ci=document.getElementById(\'autoLabWfCustomCat\');if(ci)ci.style.display=isC?\'\':\'none\';var cc=document.getElementById(\'autoLabWfCustomCatColor\');if(cc)cc.style.display=isC?\'\':\'none\';"><option value="">None</option><option value="Content"' + (existing && existing.category === 'Content' ? ' selected' : '') + '>Content</option><option value="Client"' + (existing && existing.category === 'Client' ? ' selected' : '') + '>Client</option><option value="Operations"' + (existing && existing.category === 'Operations' ? ' selected' : '') + '>Operations</option><option value="Custom"' + (_wfCatIsCustom || (existing && existing.category === 'Custom') ? ' selected' : '') + '>Custom</option></select></div>';
  html += '<div class="auto-lab-form-field" id="autoLabWfCustomCat" style="flex:1;' + (_wfCatIsCustom || (existing && existing.category === 'Custom') ? '' : 'display:none;') + '"><label>Custom Category Name</label>';
  html += '<input type="text" id="autoLabWfCustomCatInput" placeholder="Enter category name..." value="' + escapeHtml(_wfCatIsCustom ? existing.category : '') + '"></div>';
  var _existingCatColor = (existing && existing.categoryColor) || '#6b7280';
  html += '<div class="auto-lab-form-field" id="autoLabWfCustomCatColor" style="flex:0 0 auto;' + (_wfCatIsCustom || (existing && existing.category === 'Custom') ? '' : 'display:none;') + '"><label>Color</label>';
  html += '<div class="auto-lab-cat-colors" id="autoLabWfCatColors">';
  var _catColorOpts = ['#8b5cf6','#3b82f6','#f59e0b','#ef4444','#22c55e','#ec4899','#06b6d4','#f97316','#a89878','#6b7280'];
  _catColorOpts.forEach(function(c) { html += '<span class="auto-lab-cat-color-btn' + (c === _existingCatColor ? ' selected' : '') + '" style="background:' + c + ';" onclick="selectWfCatColor(this,\'' + c + '\')" data-color="' + c + '"></span>'; });
  html += '</div></div>';
  html += '</div>';

  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field"><label>Date</label>';
  html += '<input type="date" id="autoLabWfDate" value="' + (existing && existing.scheduledDate ? existing.scheduledDate : '') + '"></div>';
  // v23.17: Always show time picker (one-time automations need a time too)
  html += '<div class="auto-lab-form-field" id="autoLabWfTimeWrap"><label>Time</label>';
  html += '<input type="time" id="autoLabWfTime" value="' + (existing && existing.time ? existing.time : '09:00') + '"></div>';
  html += '</div>';

  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field"><label>Recurrence</label>';
  html += '<select id="autoLabWfRecur" onchange="var cr=document.getElementById(\'autoLabWfCustomRecur\');if(cr)cr.style.display=this.value===\'custom\'?\'flex\':\'none\';">';
  var recurOpts = [['none','One-time'],['daily','Daily'],['weekly','Weekly'],['monthly','Monthly'],['custom','Custom']];
  recurOpts.forEach(function(r) {
    html += '<option value="' + r[0] + '"' + (existing && existing.recurType === r[0] ? ' selected' : '') + '>' + r[1] + '</option>';
  });
  html += '</select></div>';

  html += '</div>';
  // v18.8: Custom recurrence interval/unit
  var showWfCustom = existing && existing.recurType === 'custom';
  html += '<div id="autoLabWfCustomRecur" class="auto-lab-form-row" style="display:' + (showWfCustom ? 'flex' : 'none') + ';gap:12px;">';
  html += '<div class="auto-lab-form-field"><label>Every</label>';
  html += '<input type="number" id="autoLabWfRecurInterval" min="1" value="' + (existing && existing.recurInterval ? existing.recurInterval : 1) + '" style="width:70px"></div>';
  html += '<div class="auto-lab-form-field"><label>Unit</label>';
  html += '<select id="autoLabWfRecurUnit">';
  var wfUnits = [['minutes','Minutes'],['hours','Hours'],['days','Days'],['weeks','Weeks'],['months','Months']];
  wfUnits.forEach(function(u) {
    html += '<option value="' + u[0] + '"' + (existing && existing.recurUnit === u[0] ? ' selected' : '') + '>' + u[1] + '</option>';
  });
  html += '</select></div>';
  html += '</div>';
  // v19.2: Brand selector for per-brand automation identity
  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field"><label>Brand</label>';
  html += '<select id="autoLabWfBrand" onchange="onAutoLabWfBrandChange()">';
  if (typeof brands !== 'undefined') {
    var wfDefaultBrand = existing && existing.brandIdx !== undefined ? existing.brandIdx : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
    brands.forEach(function(b, bi) {
      html += '<option value="' + bi + '"' + (bi === wfDefaultBrand ? ' selected' : '') + '>' + escapeHtml(b.shortName || b.name) + '</option>';
    });
  }
  html += '</select></div>';
  html += '</div>';
  // v14.3: Card-based action picker replaces dropdown
  html += '<div class="auto-lab-form-field" style="margin-bottom:16px;"><label>Action</label>';
  html += '<input type="hidden" id="autoLabWfAction" value="' + (existing && existing.action ? existing.action : 'notify') + '">';
  html += '<div id="wfActionCardGrid" class="wf-action-grid">';
  var wfActions = [
    { val: 'notify', label: 'Notify', iconPath: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0' },
    { val: 'create', label: 'Create Task', iconPath: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
    { val: 'message', label: 'Send to AI', iconPath: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
    { val: 'studio', label: 'Run Studio Op', iconPath: 'M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z' },
    { val: 'pulse', label: 'Update Goal', iconPath: 'M22 12h-4l-3 9L9 3l-3 9H2' },
    { val: 'rhythm', label: 'Add Event', iconPath: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18' },
    { val: 'library', label: 'Save to Library', iconPath: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8' },
    { val: 'image', label: 'Generate Image', iconPath: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z' },
    { val: 'video', label: 'Generate Video', iconPath: 'M5 3l14 9-14 9V3z' },
    { val: 'post', label: 'Post to Social', iconPath: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13' },
    { val: 'email', label: 'Send Email', iconPath: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6' },
    { val: 'batch_email', label: 'Batch Emails', iconPath: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z' },
    { val: 'pdf_generate', label: 'Generate PDF', iconPath: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8' }
  ];
  var currentAction = existing && existing.action ? existing.action : 'notify';
  wfActions.forEach(function(a) {
    var isActive = a.val === currentAction;
    html += '<div class="wf-action-card' + (isActive ? ' active' : '') + '" data-action="' + a.val + '" onclick="selectWfAction(\'' + a.val + '\')">';
    html += '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke-width="1.5"><path d="' + a.iconPath + '"/></svg>';
    html += '<div class="wf-action-card-label">' + a.label + '</div>';
    html += '</div>';
  });
  html += '</div></div>';

  html += '<div id="autoLabTargetConfig"></div>';

  // v18.7: Notes textarea for automation tasks
  html += '<div class="auto-lab-form-field" style="margin-top:12px;"><label>Notes (optional)</label>';
  html += '<textarea id="autoLabWfNotes" rows="2" placeholder="Add notes for this automation...">' + escapeHtml(existing && existing.notes ? existing.notes : '') + '</textarea></div>';

  // v14.3.1: Reference document attachment
  var existingRef = existing && existing.target && existing.target.referenceDoc ? existing.target.referenceDoc : null;
  html += '<div class="auto-lab-form-field" style="margin-top:12px;"><label>Reference Document (optional)</label>';
  html += '<div id="wfRefDisplay" style="font-size:13px;color:var(--text-secondary);padding:8px 0;">' + (existingRef ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>' + escapeHtml(existingRef.name) : 'No reference attached') + '</div>';
  html += '<div style="display:flex;gap:8px;margin-top:4px;">';
  html += '<button class="auto-lab-card-btn" onclick="openWfLibraryBrowser()" style="font-size:12px;padding:6px 12px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px;"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/></svg>From Library</button>';
  html += '<button class="auto-lab-card-btn" onclick="document.getElementById(\'wfRefFileInput\').click()" style="font-size:12px;padding:6px 12px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload File</button>';
  if (existingRef) {
    html += '<button class="auto-lab-card-btn" onclick="clearWfReference()" style="font-size:12px;padding:6px 12px;color:#ef4444;">Clear</button>';
  }
  html += '<input type="file" id="wfRefFileInput" style="display:none" onchange="handleWfRefUpload(this)">';
  html += '</div></div>';

  // v22.47: Require manual approval toggle for single automations
  var _wfReqApproval = existing && existing.config && existing.config.requireApproval;
  html += '<div class="auto-lab-form-field" style="margin-top:12px;border-top:1px solid var(--border-color);padding-top:12px;">';
  html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">';
  html += '<input type="checkbox" id="autoLabWfApproval"' + (_wfReqApproval ? ' checked' : '') + ' style="accent-color:#f59e0b;">';
  html += '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
  html += ' Require manual approval before execution (queue to Pending)</label></div>';

  html += '<div class="auto-lab-form-actions">';
  html += '<button class="auto-lab-card-btn" onclick="closeAutoLabWorkflowForm()">Cancel</button>';
  html += '<button class="auto-lab-card-btn primary" onclick="saveAutoLabWorkflow()">Save Workflow</button>';
  html += '</div></div>';

  // Insert form at top
  el.insertAdjacentHTML('afterbegin', html);
  // Render target config for current action
  if (existing && existing.action) {
    renderAutoLabTargetConfig(existing.action, existing);
  }
  // v14.3.1: Init reference doc from existing workflow
  window.wfReferenceDoc = existingRef ? { name: existingRef.name, content: existingRef.content } : null;
  // Scroll to form
  var form = document.getElementById('autoLabWorkflowForm');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// v14.3: Select workflow action from card grid
function selectWfAction(action) {
  // v18.7: Simplified — CSS .active class handles all visual states
  var hidden = document.getElementById('autoLabWfAction');
  if (hidden) hidden.value = action;

  var cards = document.querySelectorAll('.wf-action-card');
  cards.forEach(function(card) {
    card.classList.toggle('active', card.getAttribute('data-action') === action);
  });

  renderAutoLabTargetConfig(action);
}

// v19.2: Re-filter Studio operations when brand changes in form
function onAutoLabWfBrandChange() {
  var actionEl = document.getElementById('autoLabWfAction');
  if (actionEl && actionEl.value === 'studio') {
    var agentEl = document.getElementById('autoLabWfTargetAgent');
    updateAutoLabWfOperations(agentEl ? agentEl.value : 'all');
  }
}

/**
 * v13.9: Render target config fields based on action type
 */
function renderAutoLabTargetConfig(action, existing) {
  var container = document.getElementById('autoLabTargetConfig');
  if (!container) return;
  var target = existing && existing.target ? existing.target : {};
  var html = '<div class="auto-lab-form-row">';

  if (action === 'create') {
    var cats = (window.todoCategories || []);
    html += '<div class="auto-lab-form-field"><label>Category</label>';
    html += '<select id="autoLabWfTargetCat"><option value="">Default</option>';
    cats.forEach(function(c) {
      html += '<option value="' + escapeHtml(c.name) + '"' + (target.category === c.name ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>';
    });
    html += '</select></div>';
    html += '<div class="auto-lab-form-field"><label>Task Text</label>';
    html += '<input type="text" id="autoLabWfTargetText" placeholder="Task to create..." value="' + escapeHtml(target.text || '') + '"></div>';
  } else if (action === 'studio') {
    // v13.9: Agent + Operation cascade picker for Studio ops
    var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
    var agentList = mode === 'life'
      ? [['all','All'],['planning','Planning'],['development','Development'],['wellness','Wellness'],['relationships','Relationships'],['finances','Analytics'],['taxes','Taxes'],['home','Home'],['creativity','Creativity'],['travel','Travel'],['reflection','Reflection'],['image','Image']]
      : [['all','All'],['strategy','Strategy'],['marketing','Marketing'],['operations','Operations'],['documents','Documents'],['social','Social Media'],['research','Research'],['image','Image']];
    html += '<div class="auto-lab-form-field"><label>Agent</label>';
    html += '<select id="autoLabWfTargetAgent" onchange="updateAutoLabWfOperations(this.value)">';
    agentList.forEach(function(a) {
      html += '<option value="' + a[0] + '"' + (target.agentId === a[0] ? ' selected' : '') + '>' + a[1] + '</option>';
    });
    html += '</select></div>';
    html += '<div class="auto-lab-form-field"><label>Operation</label>';
    html += '<select id="autoLabWfTargetOp"></select></div>';
    // v18.5: Context textarea for studio operations — mirrors Studio context input
    html += '<div class="auto-lab-form-field"><label>Context / Instructions</label>';
    html += '<textarea id="autoLabWfTargetContext" rows="3" placeholder="Provide context, topic, or specific instructions for this operation..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.contextRef || target.text || '') + '</textarea></div>';
    // v18.7: Provider + model + length for single-step studio automations
    var wfProvOpts = [['','Brand Default'],['anthropic','Anthropic'],['openai','OpenAI'],['google','Gemini']];
    var wfProv = (existing && existing.config && existing.config.provider) ? existing.config.provider : '';
    html += '<div class="auto-lab-form-field"><label>API Provider</label>';
    html += '<select id="autoLabWfProvider" onchange="updateAutoLabWfModelOptions(this.value)">';
    wfProvOpts.forEach(function(po) { html += '<option value="' + po[0] + '"' + (wfProv === po[0] ? ' selected' : '') + '>' + po[1] + '</option>'; });
    html += '</select></div>';
    var wfModel = (existing && existing.config && existing.config.model) ? existing.config.model : '';
    html += '<div class="auto-lab-form-field" id="autoLabWfModelWrap" style="' + (wfProv ? '' : 'display:none;') + '"><label>Model</label>';
    html += '<select id="autoLabWfModel">';
    if (wfProv && typeof providerConfigs !== 'undefined' && providerConfigs[wfProv]) {
      providerConfigs[wfProv].models.forEach(function(m) { html += '<option value="' + m.id + '"' + (wfModel === m.id ? ' selected' : '') + '>' + m.name + '</option>'; });
    }
    html += '</select></div>';
    var wfLen = (existing && existing.config && existing.config.length) ? existing.config.length : 'standard';
    html += '<div class="auto-lab-form-field"><label>Output Length</label>';
    html += '<select id="autoLabWfLength">';
    var wfLenOpts = [['standard','Standard'],['brief','Brief'],['comprehensive','Comprehensive'],['social-100','Social (100 chars)'],['social-250','Social (250 chars)'],['social-500','Social (500 chars)']];
    wfLenOpts.forEach(function(lo) { html += '<option value="' + lo[0] + '"' + (wfLen === lo[0] ? ' selected' : '') + '>' + lo[1] + '</option>'; });
    html += '</select></div>';
    // Populate operations after container is in DOM
    setTimeout(function() {
      updateAutoLabWfOperations(target.agentId || 'all', target.operationId);
    }, 10);
  } else if (action === 'message' || action === 'library') {
    var placeholder = action === 'message' ? 'Message / Instructions for AI...' : 'Content to save...';
    var label = action === 'message' ? 'Message / Instructions' : 'Text';
    html += '<div class="auto-lab-form-field"><label>' + label + '</label>';
    html += '<textarea id="autoLabWfTargetText" rows="3" placeholder="' + placeholder + '" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.text || '') + '</textarea></div>';
  } else if (action === 'pulse') {
    html += '<div class="auto-lab-form-field"><label>Goal</label>';
    html += '<select id="autoLabWfTargetGoal"><option value="">Select goal...</option>';
    (typeof pulseGoals !== 'undefined' ? pulseGoals : []).forEach(function(g) {
      if (!g.completed && !g.archived) html += '<option value="' + g.id + '"' + (target.goalId === String(g.id) ? ' selected' : '') + '>' + escapeHtml(g.title) + '</option>';
    });
    html += '</select></div>';
    // v18.6: Instructions textarea for pulse action
    html += '<div class="auto-lab-form-field"><label>Instructions / Context</label>';
    html += '<textarea id="autoLabWfTargetContext" rows="3" placeholder="What should the AI do with this goal? (e.g., generate sub-tasks, write a progress update, create an action plan)">' + escapeHtml(target.contextRef || '') + '</textarea></div>';
  } else if (action === 'image') {
    html += '<div class="auto-lab-form-field"><label>Image Prompt</label>';
    html += '<input type="text" id="autoLabWfTargetText" placeholder="Describe the image to generate..." value="' + escapeHtml(target.text || '') + '"></div>';
    // v20.0: Image model selector — default to Nano Banana Pro 3
    var imgModelVal = (existing && existing.config && existing.config.imageModel) ? existing.config.imageModel : 'gemini-3-pro-image-preview';
    var imgModels = [
      ['gemini-3-pro-image-preview', 'Nano Banana 3.0 Pro'],
      ['gemini-2.5-flash-image', 'Nano Banana 3.0'],
      ['gemini-2.0-flash-exp-image-generation', 'Flash Image (Legacy)']
    ];
    html += '<div class="auto-lab-form-field"><label>Image Model</label>';
    html += '<select id="autoLabWfImageModel">';
    imgModels.forEach(function(m) { html += '<option value="' + m[0] + '"' + (imgModelVal === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; });
    html += '</select></div>';
    // v18.8: Reference image upload for image generation
    html += '<div class="auto-lab-form-field"><label>Reference Image (optional)</label>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<input type="file" accept="image/*" onchange="handleWfImageRefUpload(this)" style="font-size:12px;color:var(--text-secondary);">';
    var _hasWfRef = target.referenceImage || (existing && existing.config && existing.config.referenceImage);
    html += '<span id="wfImgRefStatus" style="font-size:11px;color:' + (_hasWfRef ? 'var(--accent)' : 'var(--text-muted)') + ';">' + (_hasWfRef ? 'Attached' : '') + '</span>';
    html += '</div></div>';
  } else if (action === 'video') {
    // v21.15: Video generation config
    html += '<div class="auto-lab-form-field"><label>Video Prompt</label>';
    html += '<textarea id="autoLabWfTargetText" rows="3" placeholder="Describe the video to generate..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.text || '') + '</textarea></div>';
    var vidModelVal = (existing && existing.config && existing.config.videoModel) ? existing.config.videoModel : 'veo-3.1-fast-generate-preview';
    html += '<div class="auto-lab-form-field"><label>Video Model</label>';
    html += '<select id="autoLabWfVideoModel">';
    VIDEO_MODELS.forEach(function(m) { html += '<option value="' + m.id + '"' + (vidModelVal === m.id ? ' selected' : '') + '>' + m.label + (m.audio ? ' (Audio)' : '') + '</option>'; });
    html += '</select></div>';
    var vidDurVal = (existing && existing.config && existing.config.videoDuration) ? existing.config.videoDuration : '8';
    html += '<div class="auto-lab-form-field"><label>Duration</label>';
    html += '<select id="autoLabWfVideoDuration"><option value="4"' + (vidDurVal === '4' ? ' selected' : '') + '>4 seconds</option><option value="6"' + (vidDurVal === '6' ? ' selected' : '') + '>6 seconds</option><option value="8"' + (vidDurVal === '8' ? ' selected' : '') + '>8 seconds</option></select></div>';
    var vidAspVal = (existing && existing.config && existing.config.videoAspect) ? existing.config.videoAspect : '16:9';
    html += '<div class="auto-lab-form-field"><label>Aspect Ratio</label>';
    html += '<select id="autoLabWfVideoAspect"><option value="16:9"' + (vidAspVal === '16:9' ? ' selected' : '') + '>16:9 Landscape</option><option value="9:16"' + (vidAspVal === '9:16' ? ' selected' : '') + '>9:16 Portrait</option></select></div>';
  } else if (action === 'post') {
    // v17.4: Visual platform cards with connected status
    var preSelected = target.platforms || [];
    window._wfSelectedPlatforms = preSelected.slice();
    html += '<div class="auto-lab-form-field full-width"><label>Platforms</label>';
    html += '<div id="wfPlatformCards" class="wf-platform-grid">';
    var platIcons = {
      x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
      threads: 'M12.186 24h-.007C5.461 24 .064 18.497.064 11.76.064 4.964 5.593-.002 12.21-.002c6.617 0 12.148 4.963 12.148 11.762-.003 6.736-5.4 12.24-12.172 12.24zm5.39-14.09c-.26-1.71-1.18-3.043-2.66-3.85-1.2-.655-2.6-.92-3.79-.82-2.05.17-3.69 1.08-4.74 2.64-.67 1 .37 2.16 1.31 1.45.71-.54 1.55-1.12 2.62-1.29 1.61-.26 3.35.19 3.88 1.87.23.73.21 1.53-.05 2.25-.35.97-1.09 1.63-2.09 1.88-1.39.35-2.67-.24-3.17-1.48-.16-.39-.22-.81-.18-1.23.05-.53.22-1.03.5-1.48.45-.72 1.15-1.16 1.98-1.25.77-.08 1.5.17 2.02.7.4.4.62.93.64 1.49 0 .55-.18 1.08-.54 1.49-.6.68-1.58.76-2.28.19-.2-.16-.35-.37-.46-.61-.2-.43.17-.77.5-.92.22-.1.46-.11.69-.05.14.04.28.1.39.2-.25-.36-.66-.57-1.1-.54-.64.04-1.17.48-1.38 1.09-.22.65-.09 1.37.34 1.88.67.8 1.88 1.03 2.93.59 1.26-.53 2.02-1.74 2.08-3.31.05-1.2-.3-2.3-1.01-3.2',
      instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12s.014 3.668.072 4.948c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24s3.668-.014 4.948-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948s-.014-3.667-.072-4.947c-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
      tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z'
    };
    ['x', 'threads', 'instagram', 'tiktok'].forEach(function(p) {
      var connected = typeof isSocialConnected === 'function' && isSocialConnected(p);
      var handle = typeof getSocialHandle === 'function' ? getSocialHandle(p) : '';
      var isSelected = preSelected.indexOf(p) > -1;
      var disabled = !connected; // v25.4: All platforms now support direct API posting
      var pName = p === 'x' ? 'X' : p.charAt(0).toUpperCase() + p.slice(1);
      // v18.7: Use CSS classes instead of inline styles for platform cards
      html += '<div class="wf-platform-card' + (isSelected ? ' selected' : '') + (disabled ? ' disabled' : '') + '" data-platform="' + p + '" onclick="' + (disabled ? '' : 'toggleWfPlatformSelection(\'' + p + '\', this)') + '">';
      html += '<svg class="wf-platform-icon" viewBox="0 0 24 24" width="20" height="20"><path d="' + platIcons[p] + '"/></svg>';
      html += '<div class="wf-platform-info">';
      html += '<div class="wf-platform-name">' + pName + '</div>';
      if (connected) {
        html += '<div class="wf-platform-status">' + (handle ? '@' + escapeHtml(handle) : 'Connected') + '</div>';
      } else if (p === 'tiktok') {
        html += '<div class="wf-platform-status">Copy-to-clipboard</div>';
      } else {
        html += '<div class="wf-platform-status wf-not-connected">Not connected</div>';
      }
      html += '</div>';
      html += '<div class="wf-platform-check">';
      if (isSelected) html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div></div>';
    html += '<div class="auto-lab-form-field full-width"><label>Content (or use {{step_output}})</label>';
    html += '<textarea id="autoLabWfTargetText" rows="3" placeholder="Post content or template variable...">' + escapeHtml(target.text || '') + '</textarea></div>';
    html += '<div class="auto-lab-form-field full-width"><label>Include Image</label>';
    html += '<select id="autoLabWfTargetIncludeImage" onchange="onWfIncludeImageChange(this.value)">';
    // v18.5: Check _hasUploadedImage flag (base64 stripped for storage) alongside uploadedImage
    var _hasUpImg = target.uploadedImage || target._hasUploadedImage;
    html += '<option value="no"' + (!target.includeImage && !_hasUpImg ? ' selected' : '') + '>No</option>';
    html += '<option value="yes"' + (target.includeImage && !_hasUpImg ? ' selected' : '') + '>Yes (from previous step)</option>';
    html += '<option value="upload"' + (_hasUpImg ? ' selected' : '') + '>Upload image to post</option>';
    html += '</select></div>';
    // v18.2: Upload image area (hidden until "Upload image to post" selected)
    html += '<div class="auto-lab-form-field full-width" id="autoLabWfImageUploadArea" style="display:' + (_hasUpImg ? 'block' : 'none') + ';">';
    html += '<label>Image to Post</label>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<input type="file" accept="image/*" onchange="handleWfImageUpload(this)" style="font-size:12px;color:var(--text-secondary);">';
    html += '<span id="autoLabWfImageStatus" style="font-size:11px;color:' + (_hasUpImg ? 'var(--accent)' : 'var(--text-muted)') + ';">' + (_hasUpImg ? (target.uploadedImage ? 'Attached' : 'Previously attached: re-upload to update') : '') + '</span>';
    html += '</div></div>';
  } else if (action === 'email') {
    // v22.9: Send Email workflow action
    var emailTemplateVal = (existing && existing.config && existing.config.emailTemplate) ? existing.config.emailTemplate : 'professional';
    html += '<div class="auto-lab-form-field"><label>Email Template</label>';
    html += '<select id="autoLabWfEmailTemplate">';
    var emailTemplates = [['professional','Professional'],['minimal','Minimal'],['bold','Bold'],['newsletter','Newsletter'],['ai_custom','AI Custom'],['plain','Plain Text']];
    emailTemplates.forEach(function(t) { html += '<option value="' + t[0] + '"' + (emailTemplateVal === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; });
    html += '</select></div>';
    var emailFrom = (target.emailFrom || (existing && existing.config && existing.config.emailFrom)) || getDefaultFromAddress();
    html += '<div class="auto-lab-form-field"><label>From</label>';
    html += '<select id="autoLabWfEmailFrom" onchange="var c=document.getElementById(\'autoLabWfEmailFromCustom\');if(c)c.parentElement.style.display=this.value===\'custom\'?\'block\':\'none\';">';
    html += buildFromOptionsHtml(emailFrom);
    var _knownFrom = buildFromOptionsHtml(emailFrom).indexOf('value="' + emailFrom.replace(/"/g, '') + '"') !== -1;
    html += '<option value="custom"' + (!_knownFrom && emailFrom ? ' selected' : '') + '>Custom...</option>';
    html += '</select></div>';
    html += '<div class="auto-lab-form-field" style="' + (!_knownFrom && emailFrom ? '' : 'display:none;') + '"><label>Custom From Email</label>';
    html += '<input type="email" id="autoLabWfEmailFromCustom" placeholder="name@yourdomain.com" value="' + escapeHtml(!_knownFrom && emailFrom ? emailFrom : '') + '"></div>';
    html += '<div class="auto-lab-form-field" style="flex:2;"><label>To (required)</label>';
    html += '<input type="email" id="autoLabWfEmailTo" placeholder="recipient@example.com" value="' + escapeHtml(target.emailTo || '') + '"></div>';
    html += '<div class="auto-lab-form-field"><label>CC (optional)</label>';
    html += '<input type="text" id="autoLabWfEmailCc" placeholder="Comma-separated" value="' + escapeHtml(target.emailCc || '') + '"></div>';
    html += '<div class="auto-lab-form-field"><label>BCC (optional)</label>';
    html += '<input type="text" id="autoLabWfEmailBcc" placeholder="Comma-separated" value="' + escapeHtml(target.emailBcc || '') + '"></div>';
    html += '<div class="auto-lab-form-field full-width"><label>Subject</label>';
    html += '<input type="text" id="autoLabWfEmailSubject" placeholder="Subject line..." value="' + escapeHtml(target.emailSubject || '') + '"></div>';
    html += '<div class="auto-lab-form-field full-width"><label>Body</label>';
    html += '<textarea id="autoLabWfEmailBody" rows="4" placeholder="Email body text..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.emailBody || '') + '</textarea></div>';
  } else if (action === 'batch_email') {
    // v22.28: Batch Email — parses previous step output into multiple outbox emails
    var batchFrom = (existing && existing.config && existing.config.emailFrom) || getDefaultFromAddress();
    var batchTemplate = (existing && existing.config && existing.config.emailTemplate) || 'professional';
    html += '<div style="padding:8px 12px;background:var(--bg-tertiary,rgba(255,255,255,0.03));border-radius:8px;margin-bottom:12px;">';
    html += '<p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.5;">Parses the previous step output into multiple emails and queues each to your Outbox. The AI step before this should format each email as:<br><code style="font-size:11px;color:var(--accent);">---EMAIL---<br>TO: name or email<br>SUBJECT: line<br>BODY:<br>email content<br>---END---</code></p>';
    html += '</div>';
    html += '<div class="auto-lab-form-field"><label>From</label>';
    html += '<select id="autoLabWfBatchFrom">';
    html += buildFromOptionsHtml(batchFrom);
    html += '</select></div>';
    html += '<div class="auto-lab-form-field"><label>Email Template</label>';
    html += '<select id="autoLabWfBatchTemplate">';
    var _batchTemplates = [['professional','Professional'],['minimal','Minimal'],['bold','Bold'],['plain','Plain Text']];
    _batchTemplates.forEach(function(t) { html += '<option value="' + t[0] + '"' + (batchTemplate === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; });
    html += '</select></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

/**
 * v13.9: Populate operation dropdown filtered by agent
 */
function updateAutoLabWfOperations(agentId, preselect) {
  var opEl = document.getElementById('autoLabWfTargetOp');
  if (!opEl) return;

  // v18.1: BUG 2+3+4 — use `ops` (not `operations`), apply categoryMap, filter by current brand
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var categoryMap = { strategy: 'strategic', coach: 'planning', research: 'research' };
  var mappedAgent = (agentId && categoryMap[agentId]) ? categoryMap[agentId] : agentId;
  // v19.2: Use form brand selector if present, fallback to selectedBrand (pipeline builder)
  var currentBrandName = '';
  var _wfBrandEl = document.getElementById('autoLabWfBrand');
  var _wfBrandIdx = _wfBrandEl ? parseInt(_wfBrandEl.value) : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
  if (typeof brands !== 'undefined' && brands[_wfBrandIdx]) {
    currentBrandName = brands[_wfBrandIdx].shortName || brands[_wfBrandIdx].name;
  }
  var allOps = [];
  if (mode === 'brand') {
    var baseOps = typeof ops !== 'undefined' ? ops : [];
    var brandOps = typeof generatedBrandOps !== 'undefined' ? generatedBrandOps.filter(function(o) { return !o.generatedForBrand || o.generatedForBrand === currentBrandName; }) : [];
    allOps = baseOps.concat(brandOps);
  } else {
    allOps = (typeof window.lifeOps !== 'undefined' ? window.lifeOps : []).concat(typeof generatedLifeOps !== 'undefined' ? generatedLifeOps : []);
  }

  var filtered = mappedAgent && mappedAgent !== 'all' ? allOps.filter(function(o) { return o.category === mappedAgent; }) : allOps;
  var html = '<option value="">Select operation...</option>';
  filtered.forEach(function(op) {
    html += '<option value="' + op.id + '"' + (preselect && String(preselect) === String(op.id) ? ' selected' : '') + '>' + escapeHtml(op.name || 'Op #' + op.id) + '</option>';
  });
  opEl.innerHTML = html;
}

// v18.7: Update model dropdown for single-step workflow studio action
function updateAutoLabWfModelOptions(provider) {
  var wrap = document.getElementById('autoLabWfModelWrap');
  var sel = document.getElementById('autoLabWfModel');
  if (!wrap || !sel) return;
  if (!provider || typeof providerConfigs === 'undefined' || !providerConfigs[provider]) {
    wrap.style.display = 'none';
    sel.innerHTML = '';
    return;
  }
  wrap.style.display = '';
  var html = '';
  providerConfigs[provider].models.forEach(function(m) { html += '<option value="' + m.id + '">' + m.name + '</option>'; });
  sel.innerHTML = html;
}

// v17.4: Toggle platform selection in workflow form
function toggleWfPlatformSelection(platform, el) {
  // v18.7: Simplified — CSS .selected class handles all visual states
  if (!window._wfSelectedPlatforms) window._wfSelectedPlatforms = [];
  var idx = window._wfSelectedPlatforms.indexOf(platform);
  if (idx > -1) {
    window._wfSelectedPlatforms.splice(idx, 1);
    el.classList.remove('selected');
  } else {
    window._wfSelectedPlatforms.push(platform);
    el.classList.add('selected');
  }
  // Update checkbox SVG
  var cb = el.querySelector('.wf-platform-check');
  if (cb) {
    cb.innerHTML = el.classList.contains('selected') ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
  }
}

// v18.2: Toggle image upload area in workflow form
function onWfIncludeImageChange(val) {
  var area = document.getElementById('autoLabWfImageUploadArea');
  if (area) area.style.display = val === 'upload' ? 'block' : 'none';
  if (val !== 'upload') window._wfUploadedImage = null;
}

// v18.2: Handle image upload for workflow post action
function handleWfImageUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'warning'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    window._wfUploadedImage = e.target.result;
    var status = document.getElementById('autoLabWfImageStatus');
    if (status) { status.textContent = 'Attached'; status.style.color = 'var(--accent)'; }
    showToast('Image attached', 'success');
  };
  reader.readAsDataURL(file);
}

// v18.8: Handle reference image upload for image generation workflow
function handleWfImageRefUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'warning'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    window._wfImageRef = e.target.result;
    var status = document.getElementById('wfImgRefStatus');
    if (status) { status.textContent = 'Attached'; status.style.color = 'var(--accent)'; }
    showToast('Reference image attached', 'success');
  };
  reader.readAsDataURL(file);
}

function closeAutoLabWorkflowForm() {
  var form = document.getElementById('autoLabWorkflowForm');
  if (form) form.remove();
  window.wfReferenceDoc = null;
  window._wfImageRef = null;
}

// ─── PIPELINE BUILDER (v17.4, overhauled v22.46) ───────────────────────

// v22.46: Global step type definitions — color, label, icon SVG, description
// =====================================================
// v24.2: AUTOMATIONS AGENT — Conversational automation builder
// =====================================================
var _autoAgentMessages = [];
var _autoAgentStreaming = false;
var _autoAgentRenderTimer = null; // v24.25: Debounce streaming renders to prevent spazzing
var _autoAgentFiles = []; // attached images [{name, dataUrl, base64}]

function initAutoAgent() {
  if (_autoAgentMessages.length === 0) return; // show welcome
  renderAutoAgentMessages();
}

// v24.4: Drag and drop handler for automations agent (inline ondrop calls this)
function handleAutoAgentDrop(e) {
  var files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length) return;
  // v24.8: Reuse handleAutoAgentFile for all file types (images, PDFs, docs, etc.)
  var fakeInput = { files: files, value: '' };
  handleAutoAgentFile(fakeInput);
}

// v24.4: New chat for automations agent — clears messages and shows welcome
function newAutoAgentChat() {
  _autoAgentMessages = [];
  _autoAgentFiles = [];
  _autoAgentStreaming = false;
  var container = document.getElementById('autoAgentMessages');
  if (container) {
    // v24.4: Remove has-messages to return to compact welcome state
    var chatEl = container.closest('.auto-agent-chat');
    if (chatEl) chatEl.classList.remove('has-messages');
    container.innerHTML = '<div class="auto-agent-welcome">'
      + '<div class="auto-agent-welcome-icon"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>'
      + '<div class="auto-agent-welcome-title">Automations Agent</div>'
      + '<div class="auto-agent-welcome-sub">Describe what you want to automate and I will build it for you.</div>'
      + '<div class="auto-agent-suggestions">'
      + '<button class="auto-agent-suggest-btn" onclick="autoAgentQuickPrompt(\'Generate a social media post and publish it to X tonight at 9pm\')">Post to X tonight at 9pm</button>'
      + '<button class="auto-agent-suggest-btn" onclick="autoAgentQuickPrompt(\'Create an image and post it to Instagram with a caption\')">Image + Instagram post</button>'
      + '<button class="auto-agent-suggest-btn" onclick="autoAgentQuickPrompt(\'Research my competitors and email me a report every Monday\')">Weekly competitor report</button>'
      + '<button class="auto-agent-suggest-btn" onclick="autoAgentQuickPrompt(\'Generate content, create an image, and post to X, Threads, and Instagram\')">Cross-platform campaign</button>'
      + '</div></div>';
  }
  var chips = document.getElementById('autoAgentFileChips');
  if (chips) chips.innerHTML = '';
  var input = document.getElementById('autoAgentInput');
  if (input) { input.value = ''; input.style.height = ''; }
}

function autoAgentQuickPrompt(text) {
  var input = document.getElementById('autoAgentInput');
  if (input) input.value = text;
  sendAutoAgentMessage();
}

function handleAutoAgentFile(input) {
  if (!input.files || !input.files.length) return;
  Array.from(input.files).forEach(function(file) {
    var ext = file.name.split('.').pop().toLowerCase();
    if (file.type.startsWith('image/')) {
      // Image files — read as base64 data URL
      var reader = new FileReader();
      reader.onload = function(e) {
        _autoAgentFiles.push({ name: file.name, type: 'image', dataUrl: e.target.result, base64: e.target.result });
        renderAutoAgentFileChips();
      };
      reader.readAsDataURL(file);
    } else if (ext === 'pdf') {
      // v24.8: PDF — extract text via pdf.js
      var reader = new FileReader();
      reader.onload = function(e) {
        if (typeof pdfjsLib !== 'undefined') {
          pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise.then(function(pdf) {
            var textPromises = [];
            for (var p = 1; p <= Math.min(pdf.numPages, 30); p++) {
              textPromises.push(pdf.getPage(p).then(function(page) {
                return page.getTextContent().then(function(tc) {
                  return tc.items.map(function(i) { return i.str; }).join(' ');
                });
              }));
            }
            Promise.all(textPromises).then(function(pages) {
              var fullText = pages.join('\n\n');
              _autoAgentFiles.push({ name: file.name, type: 'document', text: fullText, preview: fullText.substring(0, 200) + '...' });
              renderAutoAgentFileChips();
              showToast('PDF attached (' + pdf.numPages + ' pages)', 'success');
            });
          }).catch(function(err) {
            showToast('Could not read PDF: ' + err.message, 'error');
          });
        } else {
          showToast('PDF reader not available', 'warning');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (['xlsx', 'xls', 'csv'].indexOf(ext) !== -1) {
      // v24.8: Spreadsheet — extract via SheetJS
      var reader = new FileReader();
      reader.onload = function(e) {
        if (typeof XLSX !== 'undefined') {
          try {
            var wb = XLSX.read(e.target.result, { type: 'array' });
            var allText = '';
            wb.SheetNames.forEach(function(name) {
              var ws = wb.Sheets[name];
              allText += '--- Sheet: ' + name + ' ---\n';
              allText += XLSX.utils.sheet_to_csv(ws) + '\n\n';
            });
            _autoAgentFiles.push({ name: file.name, type: 'document', text: allText, preview: allText.substring(0, 200) + '...' });
            renderAutoAgentFileChips();
            showToast('Spreadsheet attached (' + wb.SheetNames.length + ' sheets)', 'success');
          } catch(err) { showToast('Could not read spreadsheet: ' + err.message, 'error'); }
        } else { showToast('Spreadsheet reader not available', 'warning'); }
      };
      reader.readAsArrayBuffer(file);
    } else if (['txt', 'md', 'json', 'csv'].indexOf(ext) !== -1) {
      // v24.8: Plain text files
      var reader = new FileReader();
      reader.onload = function(e) {
        var text = e.target.result;
        _autoAgentFiles.push({ name: file.name, type: 'document', text: text, preview: text.substring(0, 200) + '...' });
        renderAutoAgentFileChips();
        showToast('File attached', 'success');
      };
      reader.readAsText(file);
    } else if (['doc', 'docx', 'ppt', 'pptx'].indexOf(ext) !== -1) {
      // v24.8: Office docs — read raw text (best effort, XML-based extraction)
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          // For .docx/.pptx (ZIP-based), try to extract text from XML
          if (ext === 'docx' || ext === 'pptx') {
            if (typeof JSZip !== 'undefined') {
              JSZip.loadAsync(e.target.result).then(function(zip) {
                var xmlFile = ext === 'docx' ? 'word/document.xml' : 'ppt/slides/slide1.xml';
                var textPromises = [];
                zip.forEach(function(path, entry) {
                  if ((ext === 'docx' && path === 'word/document.xml') || (ext === 'pptx' && path.match(/ppt\/slides\/slide\d+\.xml/))) {
                    textPromises.push(entry.async('string'));
                  }
                });
                if (textPromises.length === 0) {
                  _autoAgentFiles.push({ name: file.name, type: 'document', text: '[Office document attached - content extraction unavailable. File: ' + file.name + ']', preview: file.name });
                  renderAutoAgentFileChips();
                  return;
                }
                Promise.all(textPromises).then(function(xmlTexts) {
                  var fullText = xmlTexts.map(function(xml) {
                    return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                  }).join('\n\n');
                  _autoAgentFiles.push({ name: file.name, type: 'document', text: fullText, preview: fullText.substring(0, 200) + '...' });
                  renderAutoAgentFileChips();
                  showToast('Document attached', 'success');
                });
              }).catch(function() {
                _autoAgentFiles.push({ name: file.name, type: 'document', text: '[Office document attached: ' + file.name + ']', preview: file.name });
                renderAutoAgentFileChips();
              });
            } else {
              _autoAgentFiles.push({ name: file.name, type: 'document', text: '[Office document attached: ' + file.name + ' - install JSZip for text extraction]', preview: file.name });
              renderAutoAgentFileChips();
              showToast('Document attached (limited text extraction)', 'info');
            }
          } else {
            // .doc/.ppt (legacy binary) — just note attachment
            _autoAgentFiles.push({ name: file.name, type: 'document', text: '[Legacy Office document attached: ' + file.name + ']', preview: file.name });
            renderAutoAgentFileChips();
            showToast('Document attached (binary format - limited extraction)', 'info');
          }
        } catch(err) {
          _autoAgentFiles.push({ name: file.name, type: 'document', text: '[Document attached: ' + file.name + ']', preview: file.name });
          renderAutoAgentFileChips();
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      showToast('Unsupported file type: .' + ext, 'warning');
    }
  });
  input.value = '';
}

function renderAutoAgentFileChips() {
  var container = document.getElementById('autoAgentFileChips');
  if (!container) return;
  if (_autoAgentFiles.length === 0) { container.innerHTML = ''; return; }
  var html = '';
  _autoAgentFiles.forEach(function(f, i) {
    if (f.type === 'image' && f.dataUrl) {
      html += '<div class="auto-agent-file-chip"><img src="' + f.dataUrl + '" alt=""><span>' + escapeHtml(f.name) + '</span><button onclick="_autoAgentFiles.splice(' + i + ',1);renderAutoAgentFileChips();">&times;</button></div>';
    } else {
      // v24.8: Document file chip with file icon
      var ext = f.name.split('.').pop().toLowerCase();
      var iconColor = ext === 'pdf' ? '#e74c3c' : ['xlsx','xls','csv'].indexOf(ext) !== -1 ? '#27ae60' : ['pptx','ppt'].indexOf(ext) !== -1 ? '#e67e22' : '#3498db';
      html += '<div class="auto-agent-file-chip"><span style="width:20px;height:20px;border-radius:4px;background:' + iconColor + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;flex-shrink:0;">' + ext.toUpperCase().substring(0, 3) + '</span><span>' + escapeHtml(f.name) + '</span><button onclick="_autoAgentFiles.splice(' + i + ',1);renderAutoAgentFileChips();">&times;</button></div>';
    }
  });
  container.innerHTML = html;
}

function sendAutoAgentMessage() {
  if (_autoAgentStreaming) return;
  var input = document.getElementById('autoAgentInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text && _autoAgentFiles.length === 0) return;

  // Build user message
  var userMsg = { role: 'user', content: text, files: _autoAgentFiles.slice(), timestamp: Date.now() };
  _autoAgentMessages.push(userMsg);
  input.value = '';
  input.style.height = 'auto'; // v24.11: Reset textarea height after send (mimic BrandAI chat)
  _autoAgentFiles = [];
  renderAutoAgentFileChips();

  // Hide welcome, render messages
  renderAutoAgentMessages();

  // Build API messages
  var systemPrompt = buildAutoAgentSystemPrompt();
  var apiMessages = buildAutoAgentApiMessages();

  // Start streaming
  _autoAgentStreaming = true;
  var assistantMsg = { role: 'assistant', content: '', timestamp: Date.now() };
  _autoAgentMessages.push(assistantMsg);
  renderAutoAgentMessages();
  scrollAutoAgentToBottom();

  // v24.4: Use brandSettings like main chat — selectedProvider/selectedModel are stale legacy keys
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var provider, modelKey;
  if (currentMode === 'life') {
    provider = localStorage.getItem('roweos_life_provider') || localStorage.getItem('selectedProvider') || 'anthropic';
    modelKey = localStorage.getItem('roweos_life_model') || 'claude-sonnet-4-6';
  } else {
    // Read from brandSettings (per-brand config) — same source as main chat
    var _brandIdx = 0;
    try {
      var _agentBrandEl = document.getElementById('agentBrand');
      if (_agentBrandEl) _brandIdx = parseInt(_agentBrandEl.value) || 0;
    } catch(e) {}
    var _bs = brandSettings[_brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    provider = _bs.provider || 'anthropic';
    modelKey = _bs.model || 'claude-sonnet-4-6';
  }

  // v24.4: Handle RoweOS AI smart routing — resolve to actual provider/model
  if (provider === 'roweos') {
    try {
      var _resolved = resolveRoweOSAI({ userMessage: text, systemPrompt: '' });
      provider = _resolved.provider;
      modelKey = _resolved.model;
    } catch(routeErr) {
      provider = 'anthropic'; modelKey = 'claude-sonnet-4-6';
    }
  }

  // v24.4: Apply model tier filtering if available
  if (typeof getModelForTier === 'function') {
    modelKey = getModelForTier(provider, modelKey);
  }

  // v24.4: Nanobanana uses its own key source
  var _apiKeyPromise;
  if (provider === 'nanobanana') {
    _apiKeyPromise = Promise.resolve(typeof getNanobananaKey === 'function' ? getNanobananaKey() : '');
  } else {
    _apiKeyPromise = typeof getApiKey === 'function' ? getApiKey(provider) : Promise.resolve('');
  }

  _apiKeyPromise.then(function(apiKey) {
    if (!apiKey) {
      assistantMsg.content = 'Please set an API key in Settings to use the Automations Agent.';
      _autoAgentStreaming = false;
      renderAutoAgentMessages();
      return;
    }

    var streamFn = provider === 'anthropic' ? callAnthropicStreaming :
                   provider === 'openai' ? callOpenAIStreaming :
                   provider === 'google' ? callGoogleStreaming :
                   provider === 'nanobanana' ? callNanobananaStreaming : null;

    if (!streamFn) {
      assistantMsg.content = 'Unsupported provider. Please select Anthropic, OpenAI, or Google in Settings.';
      _autoAgentStreaming = false;
      renderAutoAgentMessages();
      return;
    }

    streamFn(
      modelKey, apiKey, apiMessages, systemPrompt,
      function onChunk(chunk) {
        assistantMsg.content += chunk;
        // v24.25: Debounce renders to ~60ms to prevent DOM thrashing during streaming
        if (!_autoAgentRenderTimer) {
          _autoAgentRenderTimer = setTimeout(function() {
            _autoAgentRenderTimer = null;
            renderAutoAgentMessages();
            scrollAutoAgentToBottom();
          }, 60);
        }
      },
      function onComplete(fullText) {
        // v24.25: Clear debounce timer and do final render
        if (_autoAgentRenderTimer) { clearTimeout(_autoAgentRenderTimer); _autoAgentRenderTimer = null; }
        assistantMsg.content = fullText;
        _autoAgentStreaming = false;
        renderAutoAgentMessages();
        scrollAutoAgentToBottom();
      },
      function onError(err) {
        if (_autoAgentRenderTimer) { clearTimeout(_autoAgentRenderTimer); _autoAgentRenderTimer = null; }
        assistantMsg.content = (assistantMsg.content || '') + '\n\n[Error: ' + (err.message || err) + ']';
        _autoAgentStreaming = false;
        renderAutoAgentMessages();
      }
    );
  });
}

function buildAutoAgentSystemPrompt() {
  // v24.4: Use global selectedBrand (set by onBrandChange), not stale localStorage
  var brandIdx = (typeof selectedBrand === 'number' && !isNaN(selectedBrand)) ? selectedBrand : parseInt(localStorage.getItem('selectedBrand') || '0', 10);
  var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : null;
  var brandName = brand ? (brand.shortName || brand.name) : 'Your Brand';
  var isLife = (localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand') === 'life';

  var stepTypes = Object.keys(PIPELINE_STEP_TYPES).map(function(k) {
    return k + ' (' + PIPELINE_STEP_TYPES[k].desc + ')';
  }).join(', ');

  // Get connected social platforms
  var scope = typeof getSocialKeyScope === 'function' ? getSocialKeyScope() : '_brand_0';
  var connected = [];
  ['x', 'threads', 'instagram'].forEach(function(p) {
    if (localStorage.getItem('roweos_social_' + p + '_connected' + scope) === 'true') connected.push(p);
  });

  return 'You are the RoweOS Automations Agent. You help users build automations, pipelines, and scheduled workflows through conversation.\n\n' +
    'CURRENT CONTEXT:\n' +
    '- Mode: ' + (isLife ? 'LifeAI' : 'BrandAI') + '\n' +
    '- Brand: ' + brandName + '\n' +
    '- Connected social: ' + (connected.length ? connected.join(', ') : 'none') + '\n' +
    '- Current time: ' + new Date().toLocaleString() + '\n\n' +
    'AVAILABLE STEP TYPES: ' + stepTypes + '\n\n' +
    'RULES:\n' +
    '1. When the user describes an automation, respond with a brief explanation then include a JSON block wrapped in ```automation markers.\n' +
    '2. JSON format for a pipeline:\n' +
    '```\n' +
    '{"type":"pipeline","name":"Name Here","description":"Brief desc","schedule":{"type":"one-time|daily|weekly|monthly","time":"HH:mm","date":"YYYY-MM-DD","dayOfWeek":"Monday"},"steps":[{"stepId":1,"action":"studio|image|post|email|research|etc","name":"Step Name","target":{"platforms":["x"],"text":"prompt","contentRef":"{{step1_content}}","emailTo":"addr","emailSubject":"subj"},"config":{},"outputKey":"step1_content"}]}\n' +
    '```\n' +
    '3. For single actions (just one step), still use the pipeline format with one step.\n' +
    '4. For social posts, use action "post" with target.platforms array and target.contentRef for the content.\n' +
    '5. For AI-generated content, use action "studio" with target.operationId AND target.contextRef containing the detailed instructions/prompt for what the AI should generate. Operation IDs: 45=Social Post, 47=Cross-Platform, 48=Caption (for social content); 508=Email Writer with agentId "documents" (for any email drafting/writing tasks). Use outputKey like "step1_content" so later steps can reference {{step1_content}}.\n' +
    '6. For images, use action "image" with target.text as the image prompt AND target.contextRef for any additional instructions. outputKey like "step1_image".\n' +
    '7. For research steps, use target.researchQuery for the main research question/query text. Optionally include target.contextRef for additional research instructions.\n' +
    '8. For post steps that reference a previous step, use target.contentRef like "{{step1_content}}" to pull in that step\'s output. You can also add target.contextRef for additional posting instructions.\n' +
    '8b. For pulse (goal) steps, use action "pulse" with target.goalId (ID of existing goal) and target.contextRef for instructions on what the AI should do with the goal.\n' +
    '9. If the user provides an image file, set "includeUserImage": true in the config of the post step that should use it. The system will automatically attach the image.\n' +
    '10. For scheduling: type "one-time" needs date+time. "daily" needs time. "weekly" needs dayOfWeek+time. "monthly" needs dayOfMonth+time.\n' +
    '11. Use 24-hour time format (e.g., "21:00" for 9pm).\n' +
    '12. Keep explanations concise. The preview card will show the pipeline visually.\n' +
    '13. If the request is unclear, ask a clarifying question instead of guessing.\n' +
    '14. After showing the automation, tell the user they can click "Add" to save it or ask you to modify it.\n' +
    '15. ALWAYS wrap the JSON in ```automation and ``` markers (not ```json).\n' +
    '16. For email steps, if no recipient specified, leave emailTo empty and note the user should fill it in.\n' +
    '16b. For outbox steps, ALWAYS set target.contentRef to reference the specific studio step output (e.g., "{{step3_content}}"). This is critical when a pipeline has multiple studio+outbox pairs — each outbox must reference its own studio step, not just the last one.\n' +
    '17. NEVER suggest or mention integrations that do not exist in RoweOS. There is NO Slack, Discord, Zapier, webhook, or SMS integration. Only suggest capabilities from the available step types listed above.';
}

function buildAutoAgentApiMessages() {
  var msgs = [];
  _autoAgentMessages.forEach(function(m) {
    if (m.role === 'user') {
      var content = m.content || '';
      if (m.files && m.files.length > 0) {
        var imageFiles = m.files.filter(function(f) { return f.type === 'image'; });
        var docFiles = m.files.filter(function(f) { return f.type === 'document'; });
        if (imageFiles.length > 0) {
          content += '\n\n[User attached ' + imageFiles.length + ' image(s): ' + imageFiles.map(function(f) { return f.name; }).join(', ') + ']';
        }
        // v24.8: Include document text content in the message
        docFiles.forEach(function(f) {
          content += '\n\n[Attached document: ' + f.name + ']\n' + (f.text || '');
        });
      }
      msgs.push({ role: 'user', content: content });
    } else if (m.role === 'assistant' && m.content) {
      msgs.push({ role: 'assistant', content: m.content });
    }
  });
  // Remove last assistant msg if it's the current streaming one with empty content
  if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant' && !msgs[msgs.length - 1].content) {
    msgs.pop();
  }
  return msgs;
}

function renderAutoAgentMessages() {
  var container = document.getElementById('autoAgentMessages');
  if (!container) return;
  if (_autoAgentMessages.length === 0) return; // welcome screen stays

  // v24.4: Add has-messages class to expand chat to full height
  var chatEl = container.closest('.auto-agent-chat');
  if (chatEl) chatEl.classList.add('has-messages');

  // v24.11: Init scroll listener for scroll-to-bottom bubble
  if (typeof initAutoAgentScrollListener === 'function') initAutoAgentScrollListener();

  var html = '';
  _autoAgentMessages.forEach(function(msg, idx) {
    if (msg.role === 'user') {
      html += '<div class="auto-agent-msg user"><div class="auto-agent-bubble">';
      if (msg.files && msg.files.length > 0) {
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">';
        msg.files.forEach(function(f) {
          if (f.type === 'image' && f.dataUrl) {
            html += '<img src="' + f.dataUrl + '" style="width:60px;height:60px;border-radius:8px;object-fit:cover;">';
          } else {
            // v24.8: Document file badge
            var _ext = f.name.split('.').pop().toLowerCase();
            var _ic = _ext === 'pdf' ? '#e74c3c' : ['xlsx','xls','csv'].indexOf(_ext) !== -1 ? '#27ae60' : ['pptx','ppt'].indexOf(_ext) !== -1 ? '#e67e22' : '#3498db';
            html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg-tertiary);border-radius:8px;font-size:11px;color:var(--text-secondary);"><span style="width:24px;height:24px;border-radius:4px;background:' + _ic + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;">' + _ext.toUpperCase().substring(0,3) + '</span>' + escapeHtml(f.name) + '</div>';
          }
        });
        html += '</div>';
      }
      if (msg.content) html += '<p>' + escapeHtml(msg.content) + '</p>';
      html += '</div></div>';
    } else if (msg.role === 'assistant') {
      html += '<div class="auto-agent-msg assistant">';
      html += '<div class="auto-agent-avatar"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>';
      html += '<div class="auto-agent-bubble">';
      if (!msg.content && _autoAgentStreaming) {
        html += '<p class="auto-agent-thinking">Thinking...</p>';
      } else {
        // v24.4: Hide raw JSON during streaming — show "Building" animation instead
        var content = msg.content || '';
        var hasAutoBlock = content.indexOf('```automation') !== -1;
        var blockClosed = hasAutoBlock && content.indexOf('```', content.indexOf('```automation') + 14) !== -1;
        if (_autoAgentStreaming && hasAutoBlock && !blockClosed) {
          // Still streaming the automation JSON — show building animation, no flicker
          var preBlock = content.substring(0, content.indexOf('```automation'));
          html += renderAutoAgentText(preBlock);
          html += '<div class="auto-agent-building">';
          html += '<div class="auto-agent-building-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>';
          html += '<div class="auto-agent-building-text">Building Automation</div>';
          html += '<div class="auto-agent-building-sub">Assembling your workflow...</div>';
          html += '</div>';
        } else {
          html += renderAutoAgentContent(content, idx);
        }
      }
      html += '</div></div>';
    }
  });
  container.innerHTML = html;
}

function renderAutoAgentContent(text, msgIdx) {
  // Parse text, extract ```automation blocks, render inline
  var parts = text.split(/```automation\s*/);
  var html = '';

  parts.forEach(function(part, i) {
    if (i === 0) {
      // Before first automation block — just text
      html += renderAutoAgentText(part);
    } else {
      // Contains automation JSON followed by closing ```
      var endIdx = part.indexOf('```');
      var jsonStr = endIdx !== -1 ? part.substring(0, endIdx) : part;
      var afterJson = endIdx !== -1 ? part.substring(endIdx + 3) : '';

      try {
        var data = JSON.parse(jsonStr.trim());
        html += renderAutoAgentPreviewCard(data, msgIdx + '_' + i);
      } catch(e) {
        // v24.4: Show building animation instead of raw JSON — user should never see code
        html += '<div class="auto-agent-building" style="animation:none;opacity:0.5;">';
        html += '<div class="auto-agent-building-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>';
        html += '<div class="auto-agent-building-text" style="color:var(--text-muted);">Could not parse automation</div>';
        html += '</div>';
      }

      if (afterJson.trim()) {
        html += renderAutoAgentText(afterJson);
      }
    }
  });

  return html;
}

function renderAutoAgentText(text) {
  if (!text || !text.trim()) return '';
  // Simple markdown: bold, line breaks
  var safe = escapeHtml(text.trim());
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  var paragraphs = safe.split(/\n\n+/);
  return paragraphs.map(function(p) {
    return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function renderAutoAgentPreviewCard(data, cardId) {
  var steps = data.steps || [];
  var schedule = data.schedule || {};

  var html = '<div class="auto-agent-preview">';

  // Header
  html += '<div class="auto-agent-preview-header">';
  if (steps.length > 1) {
    html += '<span class="preview-type-badge" style="background:linear-gradient(135deg,#a78bfa,#f472b6);">Pipeline</span>';
  } else if (steps.length === 1) {
    var st = PIPELINE_STEP_TYPES[steps[0].action];
    html += '<span class="preview-type-badge" style="background:' + (st ? st.color : '#666') + ';">' + (st ? st.label : steps[0].action) + '</span>';
  }
  html += '<span class="preview-name">' + escapeHtml(data.name || 'Untitled Automation') + '</span>';
  html += '</div>';

  // Body — steps
  html += '<div class="auto-agent-preview-body"><div class="auto-agent-preview-steps">';
  steps.forEach(function(step, i) {
    var st = PIPELINE_STEP_TYPES[step.action] || { color: '#666', label: step.action };
    var _isMobile = window.innerWidth <= 768;
    if (_isMobile) {
      // v25.0: Mobile-optimized vertical step layout
      html += '<div class="auto-agent-preview-step" style="flex-direction:column;align-items:stretch;padding:10px 12px;position:relative;">';
      // Step number in top-left, badge in top-right
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">';
      html += '<div style="display:flex;align-items:center;gap:6px;">';
      html += '<span class="step-num" style="background:' + st.color + ';flex-shrink:0;">' + (i + 1) + '</span>';
      html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + st.color + '" stroke-width="2" style="flex-shrink:0;">' + (st.icon || '') + '</svg>';
      html += '<strong style="font-size:13px;color:var(--text-primary);">' + escapeHtml(step.name || st.label) + '</strong>';
      html += '</div>';
      // Platform badges
      if (step.target && step.target.platforms && step.target.platforms.length) {
        html += '<span style="font-size:10px;color:var(--text-muted);white-space:nowrap;">' + escapeHtml(step.target.platforms.join(', ')) + '</span>';
      }
      html += '</div>';
      // To: line for email steps
      if (step.target && step.target.emailTo) {
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
        html += '<span style="font-size:11px;color:var(--text-muted);font-weight:600;white-space:nowrap;">To:</span>';
        html += '<span style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(step.target.emailTo) + '</span>';
        html += '</div>';
      }
      // Inline email editor
      if ((step.action === 'email' || step.action === 'outbox' || step.action === 'batch_email') && step.target) {
        html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">';
        html += '<span style="font-size:11px;color:var(--text-muted);white-space:nowrap;font-weight:600;">To:</span>';
        html += '<input type="email" value="' + escapeHtml(step.target.emailTo || '') + '" placeholder="recipient@example.com" style="flex:1;min-width:0;padding:4px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;" onchange="updateAutoAgentStepEmail(\'' + cardId + '\',' + i + ',this.value)">';
        html += '</div>';
      }
      // Context/instructions vertical
      var contextText = (step.target && step.target.contextRef) ? step.target.contextRef : '';
      var contentRef = (step.target && step.target.contentRef) ? step.target.contentRef : '';
      var outputKey = step.outputKey || '';
      if (contextText) {
        html += '<div style="font-size:11px;color:var(--text-secondary);background:var(--bg-tertiary);padding:6px 8px;border-radius:6px;margin-top:4px;white-space:pre-wrap;max-height:100px;overflow-y:auto;word-break:break-word;">' + escapeHtml(contextText) + '</div>';
      }
      if (contentRef && contentRef.indexOf('{{') !== -1) {
        html += '<div style="font-size:10px;color:var(--accent);opacity:0.7;margin-top:3px;">Uses ' + escapeHtml(contentRef) + '</div>';
      }
      if (outputKey) {
        html += '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Outputs as {{' + escapeHtml(outputKey) + '}}</div>';
      }
      html += '</div>';
    } else {
      // Desktop: original horizontal layout
      html += '<div class="auto-agent-preview-step">';
      html += '<span class="step-num" style="background:' + st.color + ';">' + (i + 1) + '</span>';
      html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + st.color + '" stroke-width="2">' + (st.icon || '') + '</svg>';
      html += '<span><strong>' + escapeHtml(step.name || st.label) + '</strong>';

      // Show key details
      var details = [];
      if (step.target) {
        if (step.target.platforms && step.target.platforms.length) details.push(step.target.platforms.join(', '));
        if (step.target.text && step.action === 'image') details.push('"' + step.target.text.substring(0, 50) + (step.target.text.length > 50 ? '...' : '') + '"');
        if (step.target.emailTo) details.push('to: ' + step.target.emailTo);
      }
      if (details.length) html += ' <span style="color:var(--text-muted);">- ' + escapeHtml(details.join(', ')) + '</span>';
      html += '</span>';
      // v25.0: Inline email recipient editor for email/outbox steps
      if ((step.action === 'email' || step.action === 'outbox' || step.action === 'batch_email') && step.target) {
        var _cardStepId = cardId + '_step' + i;
        html += '<div style="margin-top:6px;margin-left:26px;display:flex;gap:6px;align-items:center;">';
        html += '<span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">To:</span>';
        html += '<input type="email" value="' + escapeHtml(step.target.emailTo || '') + '" placeholder="recipient@example.com" style="flex:1;padding:4px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:11px;font-family:inherit;outline:none;" onchange="updateAutoAgentStepEmail(\'' + cardId + '\',' + i + ',this.value)">';
        html += '</div>';
      }
      // v24.18: Show context/instructions and data flow
      var contextText = (step.target && step.target.contextRef) ? step.target.contextRef : '';
      var contentRef = (step.target && step.target.contentRef) ? step.target.contentRef : '';
      var outputKey = step.outputKey || '';
      if (contextText || contentRef || outputKey) {
        html += '<div style="margin-top:4px;margin-left:26px;font-size:11px;">';
        if (contextText) {
          html += '<div style="color:var(--text-secondary);background:var(--bg-tertiary);padding:4px 8px;border-radius:4px;margin-bottom:3px;white-space:pre-wrap;max-height:120px;overflow-y:auto;">' + escapeHtml(contextText) + '</div>';
        }
        if (contentRef && contentRef.indexOf('{{') !== -1) {
          html += '<div style="color:var(--accent);opacity:0.7;">Uses ' + escapeHtml(contentRef) + '</div>';
        }
        if (outputKey) {
          html += '<div style="color:var(--text-muted);">Outputs as {{' + escapeHtml(outputKey) + '}}</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    if (i < steps.length - 1) {
      html += '<div style="text-align:center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--text-muted)" stroke-width="2" style="opacity:0.4;"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></div>';
    }
  });
  html += '</div>';

  // Schedule info
  if (schedule.type && schedule.type !== 'none') {
    html += '<div class="auto-agent-preview-schedule">';
    html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    var schedText = '';
    if (schedule.type === 'one-time') schedText = (schedule.date || 'Today') + ' at ' + (schedule.time || '--:--');
    else if (schedule.type === 'daily') schedText = 'Daily at ' + (schedule.time || '--:--');
    else if (schedule.type === 'weekly') schedText = 'Weekly on ' + (schedule.dayOfWeek || 'Monday') + ' at ' + (schedule.time || '--:--');
    else if (schedule.type === 'monthly') schedText = 'Monthly on day ' + (schedule.dayOfMonth || '1') + ' at ' + (schedule.time || '--:--');
    html += '<span>' + schedText + '</span>';
    html += '</div>';
  }
  html += '</div>';

  // Actions
  html += '<div class="auto-agent-preview-actions">';
  html += '<button class="auto-agent-add-btn" id="autoAgentAdd_' + cardId + '" onclick="addAutoAgentAutomation(' + "'" + cardId + "'" + ')">Add Automation</button>';
  html += '<button class="auto-agent-edit-btn" onclick="editAutoAgentAutomation(' + "'" + cardId + "'" + ')">Edit in Builder</button>';
  html += '<button class="auto-agent-edit-btn" onclick="addAndRunAutoAgentAutomation(' + "'" + cardId + "'" + ')" style="background:var(--brand-accent,#a89878);color:#fff;border-color:var(--brand-accent,#a89878);">Run Now</button>';
  html += '</div>';

  html += '</div>';

  // Store data for retrieval
  if (!window._autoAgentPreviews) window._autoAgentPreviews = {};
  window._autoAgentPreviews[cardId] = data;

  return html;
}

// v25.0: Update email recipient inline in automation preview card
function updateAutoAgentStepEmail(cardId, stepIdx, email) {
  var data = window._autoAgentPreviews && window._autoAgentPreviews[cardId];
  if (data && data.steps && data.steps[stepIdx]) {
    if (!data.steps[stepIdx].target) data.steps[stepIdx].target = {};
    data.steps[stepIdx].target.emailTo = email;
  }
}

function addAutoAgentAutomation(cardId) {
  var data = window._autoAgentPreviews && window._autoAgentPreviews[cardId];
  if (!data) { showToast('Could not find automation data', 'error'); return; }

  var steps = data.steps || [];
  var schedule = data.schedule || {};
  // v24.4: Use global selectedBrand, not stale localStorage
  var brandIdx = (typeof selectedBrand === 'number' && !isNaN(selectedBrand)) ? selectedBrand : parseInt(localStorage.getItem('selectedBrand') || '0', 10);
  var now = Date.now();

  // v24.4: Find the most recent user image attachment from the conversation
  var userImage = null;
  for (var mi = _autoAgentMessages.length - 1; mi >= 0; mi--) {
    if (_autoAgentMessages[mi].role === 'user' && _autoAgentMessages[mi].files && _autoAgentMessages[mi].files.length > 0) {
      userImage = _autoAgentMessages[mi].files[0].base64 || _autoAgentMessages[mi].files[0].dataUrl;
      break;
    }
  }

  // Build automation object matching RoweOS format
  var automation = {
    id: now,
    name: data.name || 'Agent Automation',
    description: data.description || '',
    type: steps.length > 1 ? 'pipeline' : 'workflow', // v24.12: Always set type
    action: steps.length === 1 ? steps[0].action : 'pipeline',
    enabled: true,
    brandIdx: brandIdx,
    category: 'custom',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), // v24.14: Required for sync merge
    recurType: schedule.type === 'daily' ? 'daily' : schedule.type === 'weekly' ? 'weekly' : schedule.type === 'monthly' ? 'monthly' : 'none',
    time: schedule.time || '',
    dayOfWeek: schedule.dayOfWeek || '',
    dayOfMonth: schedule.dayOfMonth || '',
    steps: steps.map(function(s) {
      var stepConfig = s.config || {};
      // v24.4: Flag post steps to include user image at execution time (don't store base64 in localStorage)
      if (userImage && (stepConfig.includeUserImage || s.action === 'post')) {
        stepConfig.includeImage = 'custom';
        stepConfig._hasUserImage = true;
      }
      // v28.4/v29.0: For research steps, ensure main query maps to researchQuery (AI may use text, contextRef, or researchQuery)
      var stepTarget = s.target || {};
      if (s.action === 'research' && !stepTarget.researchQuery) {
        if (stepTarget.contextRef) {
          stepTarget.researchQuery = stepTarget.contextRef;
          delete stepTarget.contextRef;
        } else if (stepTarget.text) {
          stepTarget.researchQuery = stepTarget.text;
          delete stepTarget.text;
        }
      }
      return {
        stepId: s.stepId || 1,
        name: s.name || (PIPELINE_STEP_TYPES[s.action] ? PIPELINE_STEP_TYPES[s.action].label : s.action),
        action: s.action,
        target: stepTarget,
        config: stepConfig,
        outputKey: s.outputKey || ('step' + (s.stepId || 1) + '_content')
      };
    }),
    target: steps.length === 1 ? (steps[0].target || {}) : {},
    config: {}
  };

  // For one-time scheduled, set scheduledDate (v24.18: date-only YYYY-MM-DD to match scheduler comparison)
  if (schedule.type === 'one-time' && schedule.date) {
    automation.scheduledDate = schedule.date.split('T')[0]; // Strip any time component, keep YYYY-MM-DD only
  }

  // v24.4: Store user image in memory for execution (too large for localStorage)
  if (userImage) {
    if (!window._autoAgentImages) window._autoAgentImages = {};
    window._autoAgentImages[String(now)] = userImage;
  }

  // Save to roweos_automations
  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) { automations = []; }
  automations.push(automation);
  try {
    localStorage.setItem('roweos_automations', JSON.stringify(automations));
  } catch(qe) {
    if (qe.name === 'QuotaExceededError' || (qe.message && qe.message.indexOf('quota') !== -1)) {
      if (typeof clearExpendableStorageData === 'function') clearExpendableStorageData();
      try { localStorage.setItem('roweos_automations', JSON.stringify(automations)); } catch(qe2) {
        showToast('Storage full - could not save automation', 'error');
        return;
      }
    }
  }

  // v24.14: Always write to scheduled tasks (dual storage required — was conditional, causing split state)
  var tasks = getScheduledTasks();
  tasks.push(automation); // v24.14: Push full automation object (was building stripped copy with String ID mismatch)
  saveScheduledTasks(tasks);

  // v25.1: saveScheduledTasks() already writes through to Firestore

  // Update button
  var btn = document.getElementById('autoAgentAdd_' + cardId);
  if (btn) {
    btn.textContent = 'Added';
    btn.className = 'auto-agent-add-btn added';
  }

  showToast('Automation added: ' + escapeHtml(automation.name), 'success');
  return automation.id;
}

// v25.0: Add automation and immediately run it
function addAndRunAutoAgentAutomation(cardId) {
  var btn = document.getElementById('autoAgentAdd_' + cardId);
  var alreadyAdded = btn && btn.classList.contains('added');
  if (!alreadyAdded) {
    var autoId = addAutoAgentAutomation(cardId);
    if (!autoId) return;
    setTimeout(function() { runAutoLabNow(autoId); }, 300);
  } else {
    // Already added — find the automation ID from stored data
    var data = window._autoAgentPreviews && window._autoAgentPreviews[cardId];
    if (!data) { showToast('Could not find automation', 'error'); return; }
    var automations = [];
    try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}
    var match = automations.filter(function(a) { return a.name === data.name; });
    if (match.length > 0) {
      runAutoLabNow(match[match.length - 1].id);
    } else {
      showToast('Add the automation first', 'error');
    }
  }
}

function editAutoAgentAutomation(cardId) {
  var data = window._autoAgentPreviews && window._autoAgentPreviews[cardId];
  if (!data || !data.steps) return;

  // v24.4: Find user's attached image to inject into post steps
  var userImage = null;
  for (var mi = _autoAgentMessages.length - 1; mi >= 0; mi--) {
    if (_autoAgentMessages[mi].role === 'user' && _autoAgentMessages[mi].files && _autoAgentMessages[mi].files.length > 0) {
      userImage = _autoAgentMessages[mi].files[0].base64 || _autoAgentMessages[mi].files[0].dataUrl;
      break;
    }
  }

  // Pre-populate pipeline builder steps
  _pipelineSteps = data.steps.map(function(s, idx) {
    var stepConfig = s.config || {};
    if (userImage && (stepConfig.includeUserImage || s.action === 'post')) {
      stepConfig.includeImage = 'custom';
      stepConfig._hasUserImage = true;
      // Store in target for pipeline execution (in-memory, not localStorage)
      if (!s.target) s.target = {};
      s.target.uploadedImage = userImage;
    }
    // v28.4/v29.0: For research steps, map to researchQuery (AI may use text, contextRef, or researchQuery)
    var editTarget = s.target || {};
    if ((s.action || 'studio') === 'research' && !editTarget.researchQuery) {
      if (editTarget.contextRef) {
        editTarget.researchQuery = editTarget.contextRef;
        delete editTarget.contextRef;
      } else if (editTarget.text) {
        editTarget.researchQuery = editTarget.text;
        delete editTarget.text;
      }
    }
    return {
      stepId: s.stepId || (idx + 1),
      name: s.name || '',
      action: s.action || 'studio',
      target: editTarget,
      config: stepConfig,
      outputKey: s.outputKey || ('step' + (idx + 1) + '_output')
    };
  });

  showAutoLabTab('workflows');
  setTimeout(function() {
    // v29.0: Save temp pipeline to localStorage BEFORE opening builder so editId is set
    // This prevents duplication on save (was calling renderPipelineForm(null, null) which always created new)
    var tempId = Date.now();
    var tempPipeline = {
      id: tempId,
      name: data.name || 'Chat Pipeline',
      type: 'pipeline',
      action: 'pipeline',
      scheduledDate: '',
      time: '09:00',
      recurType: 'none',
      enabled: true,
      mode: typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand',
      brandIdx: typeof selectedBrand !== 'undefined' ? selectedBrand : 0,
      steps: _pipelineSteps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'chat'
    };
    var _tempAutos = [];
    try { _tempAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}
    _tempAutos.push(tempPipeline);
    try { localStorage.setItem('roweos_automations', JSON.stringify(_tempAutos)); } catch(e) {}

    // Open builder with editId so Save updates instead of duplicates
    showPipelineBuilder(tempId);
    var nameEl = document.getElementById('pipelineName');
    if (nameEl) nameEl.value = data.name || '';
    var descEl = document.getElementById('pipelineDescription');
    // v25.0: Build description from pipeline data + step contexts if description is empty
    var desc = data.description || '';
    if (!desc && data.steps) {
      var parts = [];
      data.steps.forEach(function(s) {
        if (s.target && s.target.contextRef) parts.push(s.name + ': ' + s.target.contextRef);
      });
      if (parts.length) desc = parts.join('\n');
    }
    if (descEl) descEl.value = desc;

    // Populate schedule fields
    var schedule = data.schedule || {};
    if (schedule.date) {
      var dateEl = document.getElementById('pipelineScheduleDate');
      if (dateEl) dateEl.value = schedule.date;
    }
    if (schedule.time) {
      var timeEl = document.getElementById('pipelineScheduleTime');
      if (timeEl) {
        // Convert 24h "22:00" to 12h "10:00 PM" if needed
        var timeParts = schedule.time.split(':');
        var h = parseInt(timeParts[0]); var m = timeParts[1] || '00';
        var ampm = h >= 12 ? 'PM' : 'AM';
        var h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        timeEl.value = (h12 < 10 ? '0' : '') + h12 + ':' + m + ' ' + ampm;
      }
    }
    if (schedule.type) {
      var recurEl = document.getElementById('pipelineRecurrence');
      if (recurEl) {
        var recurMap = { 'one-time': 'once', 'daily': 'daily', 'weekly': 'weekly', 'monthly': 'monthly' };
        recurEl.value = recurMap[schedule.type] || 'once';
      }
    }

    // v24.4: Skip collect since we set _pipelineSteps directly from agent data
    window._skipPipelineCollect = true;
    reRenderPipelineSteps();
  }, 150);
}

function scrollAutoAgentToBottom() {
  var container = document.getElementById('autoAgentMessages');
  if (container) {
    requestAnimationFrame(function() {
      container.scrollTop = container.scrollHeight;
      // v24.11: Hide scroll button when at bottom
      var btn = document.getElementById('autoAgentScrollBtn');
      if (btn) btn.classList.remove('visible');
    });
  }
}

// v24.11: Scroll listener for showing/hiding the scroll-to-bottom bubble
var _autoAgentScrollListenerAttached = false;
function initAutoAgentScrollListener() {
  if (_autoAgentScrollListenerAttached) return;
  var container = document.getElementById('autoAgentMessages');
  if (!container) return;
  _autoAgentScrollListenerAttached = true;
  container.addEventListener('scroll', function() {
    var btn = document.getElementById('autoAgentScrollBtn');
    if (!btn) return;
    var distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distFromBottom > 150) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });
}

// ============================================================
// v25.0: FOLIO — Living Canvas
// ============================================================

var _folioMessages = [];
var _folioFiles = [];

// Escape HTML for use in srcdoc="" attribute (only escape quotes and ampersands, keep tags intact)
function escapeSrcdoc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
var _folioStreaming = false;
var _folioChatSessions = [];
var _folioRenderTimer = null;
var _folioScrollListenerAttached = false;

// --- Folio Init & Tabs ---
function initFolioView() {
  // v25.0: Restore chat messages from localStorage
  if (_folioMessages.length === 0) {
    try {
      var saved = JSON.parse(localStorage.getItem('roweos_folio_chat_messages') || '[]');
      if (saved.length > 0) { _folioMessages = saved; renderFolioChatMessages(); }
    } catch(e) {}
  }
  renderFolioGallery();
}

function switchFolioTab(tab) {
  var galleryTab = document.getElementById('folioGalleryTab');
  var chatTab = document.getElementById('folioChatTab');
  if (!galleryTab || !chatTab) return;
  var btns = document.querySelectorAll('[data-folio-tab]');
  btns.forEach(function(b) {
    var isActive = b.dataset.folioTab === tab;
    b.style.background = isActive ? 'var(--bg-elevated)' : 'transparent';
    b.style.color = isActive ? 'var(--text-primary)' : 'var(--text-muted)';
    b.style.fontWeight = isActive ? '600' : '500';
    b.classList.toggle('active', isActive);
  });
  galleryTab.style.display = tab === 'gallery' ? '' : 'none';
  chatTab.style.display = tab === 'chat' ? '' : 'none';
  if (tab === 'gallery') {
    renderFolioGallery();
    // Show header on gallery
    var folioViewEl = document.getElementById('folioView');
    if (folioViewEl) folioViewEl.classList.remove('folio-chat-active');
  }
  if (tab === 'chat') {
    // On mobile, hide header when chat has messages
    var chatEl = document.getElementById('folioChatContainer');
    var folioViewEl = document.getElementById('folioView');
    if (chatEl && chatEl.classList.contains('has-messages') && window.innerWidth <= 768 && folioViewEl) {
      folioViewEl.classList.add('folio-chat-active');
    }
    initFolioChatCollapse();
  }
}

// --- Folio Data Model ---
function getFolioItems() {
  try {
    return JSON.parse(localStorage.getItem('roweos_folio_items') || '[]');
  } catch(e) { return []; }
}

function saveFolioItems(items) {
  try {
    localStorage.setItem('roweos_folio_items', JSON.stringify(items));
    // v25.3: Use 'data' field to match pull path (was 'items', pull reads 'data')
    writeDB('folio/main', { data: items });
    return true;
  } catch(e) {
    console.error('[Folio] Save failed:', e.message);
    showToast('Save failed - storage may be full. Try clearing old items.', 'error');
    return false;
  }
}

function saveFolioItem(item) {
  var items = getFolioItems();
  var idx = -1;
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === item.id) { idx = i; break; }
  }
  item.updatedAt = new Date().toISOString();
  if (idx !== -1) { items[idx] = item; } else { items.unshift(item); }
  return saveFolioItems(items);
}

function deleteFolioItem(id) {
  var items = getFolioItems().filter(function(i) { return i.id !== id; });
  saveFolioItems(items);
  renderFolioGallery();
}

function duplicateFolioItem(id, atVersion) {
  var items = getFolioItems();
  var src = null;
  for (var i = 0; i < items.length; i++) { if (items[i].id === id) { src = items[i]; break; } }
  if (!src) return;
  var html = src.html;
  if (atVersion && src.versions) {
    for (var v = 0; v < src.versions.length; v++) {
      if (src.versions[v].id === atVersion) { html = src.versions[v].html; break; }
    }
  }
  var now = new Date().toISOString();
  var newItem = {
    id: 'folio_' + Date.now(),
    title: src.title + ' (copy)',
    html: html,
    thumbnail: null,
    versions: [{ id: 'v_' + Date.now(), html: html, description: 'Branched from ' + src.title, timestamp: now, source: 'created' }],
    comments: [],
    conversation: [],
    branchedFrom: { itemId: src.id, versionId: atVersion || null, date: now },
    brand: src.brand,
    brandIdx: src.brandIdx,
    createdAt: now,
    updatedAt: now,
    pinned: false
  };
  items.unshift(newItem);
  saveFolioItems(items);
  renderFolioGallery();
  showToast('Duplicated to Folio', 'success');
}

// --- Gallery Rendering ---
function renderFolioGallery() {
  var grid = document.getElementById('folioGalleryGrid');
  var empty = document.getElementById('folioEmptyState');
  if (!grid) return;
  var items = getFolioItems();
  // Sort: pinned first, then by updatedAt
  items.sort(function(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });
  if (items.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  var html = '';
  items.forEach(function(item) {
    var versionCount = (item.versions && item.versions.length) || 1;
    var dateStr = '';
    try { dateStr = new Date(item.updatedAt || item.createdAt).toLocaleDateString(); } catch(e) {}
    html += '<div class="folio-card" onclick="openFolioItem(\'' + item.id + '\')">';
    if (item.pinned) {
      html += '<div class="folio-card-pinned"><svg viewBox="0 0 24 24" width="14" height="14" fill="var(--brand-accent, #a89878)" stroke="none"><path d="M12 2l2.09 6.26L21 9.27l-5 3.64L17.18 20 12 16.77 6.82 20 8 12.91l-5-3.64 6.91-1.01z"/></svg></div>';
    }
    html += '<div class="folio-card-preview">';
    html += '<iframe sandbox="allow-scripts" srcdoc="' + escapeSrcdoc(item.html || '<html><body style="background:#111;color:#555;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;"><div>Empty</div></body></html>') + '" style="width:200%;height:200%;transform:scale(0.5);transform-origin:0 0;pointer-events:none;"></iframe>';
    html += '</div>';
    html += '<div class="folio-card-body">';
    html += '<div class="folio-card-title" onclick="event.stopPropagation();editFolioTitle(this,\'' + item.id + '\')" title="Click to rename">' + escapeHtml(item.title || 'Untitled') + '</div>';
    html += '<div class="folio-card-meta">';
    html += '<span class="folio-card-version-badge"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg> v' + versionCount + '</span>';
    if (item.branchedFrom) {
      html += '<span class="folio-card-branch"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6z"/><path d="M18 9c0 4-6 6-12 6"/></svg> branch</span>';
    }
    html += '<span>' + dateStr + '</span>';
    html += '</div></div>';
    html += '<div class="folio-card-actions" onclick="event.stopPropagation();">';
    html += '<button onclick="openFolioEditChat(\'' + item.id + '\')">Edit with AI</button>';
    html += '<button onclick="toggleFolioPin(\'' + item.id + '\')">' + (item.pinned ? 'Unpin' : 'Pin') + '</button>';
    html += '<button onclick="if(confirm(\'Delete this Folio item?\'))deleteFolioItem(\'' + item.id + '\')">Delete</button>';
    html += '</div>';
    html += '</div>';
  });
  grid.innerHTML = html;
}

function toggleFolioPin(id) {
  var items = getFolioItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === id) { items[i].pinned = !items[i].pinned; break; }
  }
  saveFolioItems(items);
  renderFolioGallery();
}

// v28.4: Inline folio title editing
function editFolioTitle(el, id) {
  if (el.querySelector('input')) return; // already editing
  var currentTitle = '';
  var items = getFolioItems();
  for (var i = 0; i < items.length; i++) { if (items[i].id === id) { currentTitle = items[i].title || 'Untitled'; break; } }
  var input = document.createElement('input');
  input.type = 'text';
  input.value = currentTitle;
  input.style.cssText = 'width:100%;background:var(--bg-secondary);border:1px solid var(--brand-accent, #a89878);border-radius:6px;color:var(--text-primary);font-size:inherit;font-weight:inherit;font-family:inherit;padding:2px 6px;outline:none;';
  input.onclick = function(e) { e.stopPropagation(); };
  var save = function() {
    var newTitle = input.value.trim() || 'Untitled';
    var items2 = getFolioItems();
    for (var j = 0; j < items2.length; j++) {
      if (items2[j].id === id) {
        items2[j].title = newTitle;
        items2[j].updatedAt = new Date().toISOString();
        break;
      }
    }
    saveFolioItems(items2);
    renderFolioGallery();
  };
  input.onblur = save;
  input.onkeydown = function(e) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); renderFolioGallery(); }
  };
  el.textContent = '';
  el.appendChild(input);
  input.focus();
  input.select();
}

// --- Full-Screen Living Canvas View ---
function openFolioItem(id) {
  var items = getFolioItems();
  var item = null;
  for (var i = 0; i < items.length; i++) { if (items[i].id === id) { item = items[i]; break; } }
  if (!item) return;

  // Remove existing overlay if any
  var existing = document.getElementById('folioFullscreenOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'folioFullscreenOverlay';
  overlay.className = 'folio-fullscreen-overlay';
  overlay.innerHTML = '<div class="folio-fullscreen-main">'
    + '<div class="folio-fullscreen-header">'
    + '<button class="folio-back-btn" onclick="closeFolioFullscreen()"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>'
    + '<div class="folio-fullscreen-title">' + escapeHtml(item.title || 'Untitled') + '</div>'
    + '<button class="folio-back-btn" onclick="duplicateFolioItem(\'' + item.id + '\')" title="Duplicate"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>'
    + '</div>'
    + '<iframe class="folio-fullscreen-iframe" sandbox="allow-scripts allow-same-origin" srcdoc="' + escapeSrcdoc(item.html || '') + '"></iframe>'
    + '</div>'
    + '<div class="folio-side-panel" id="folioSidePanel">'
    + '<div class="folio-side-tabs">'
    + '<button class="folio-side-tab active" onclick="switchFolioSideTab(\'edit\',\'' + item.id + '\')" data-folio-side="edit">Edit</button>'
    + '<button class="folio-side-tab" onclick="switchFolioSideTab(\'versions\',\'' + item.id + '\')" data-folio-side="versions">Versions</button>'
    + '<button class="folio-side-tab" onclick="switchFolioSideTab(\'notes\',\'' + item.id + '\')" data-folio-side="notes">Notes</button>'
    + '</div>'
    + '<div class="folio-side-content" id="folioSideContent"></div>'
    + '</div>';
  document.body.appendChild(overlay);
  // Trigger open animation
  requestAnimationFrame(function() { overlay.classList.add('open'); });
  // Show edit tab by default
  switchFolioSideTab('edit', item.id);
  // v25.1: On mobile portrait, show landscape hint for editing
  if (window.innerWidth <= 768 && window.innerHeight > window.innerWidth) {
    showToast('Rotate to landscape to access editing tools', 'info');
  }
}

function closeFolioFullscreen() {
  var overlay = document.getElementById('folioFullscreenOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(function() { overlay.remove(); renderFolioGallery(); }, 250);
  }
}

function switchFolioSideTab(tab, itemId) {
  var tabs = document.querySelectorAll('[data-folio-side]');
  tabs.forEach(function(t) { t.classList.toggle('active', t.dataset.folioSide === tab); });
  var content = document.getElementById('folioSideContent');
  if (!content) return;
  if (tab === 'edit') renderFolioEditPanel(itemId, content);
  else if (tab === 'versions') renderFolioVersions(itemId, content);
  else if (tab === 'notes') renderFolioNotes(itemId, content);
}

// --- Inline Edit Chat ---
function openFolioEditChat(id) {
  // On mobile: open full screen view to edit tab
  if (window.innerWidth <= 768) {
    openFolioItem(id);
    return;
  }
  openFolioItem(id);
}

function renderFolioEditPanel(itemId, container) {
  var item = null;
  var items = getFolioItems();
  for (var i = 0; i < items.length; i++) { if (items[i].id === itemId) { item = items[i]; break; } }
  if (!item) { container.innerHTML = '<p style="color:var(--text-muted);">Item not found</p>'; return; }

  var convo = item.conversation || [];
  var html = '<div style="display:flex;flex-direction:column;height:100%;">';
  html += '<div id="folioEditMessages" style="flex:1;overflow-y:auto;padding-bottom:12px;">';
  if (convo.length === 0) {
    html += '<div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:13px;">Describe changes to your visual.<br>AI will update it live.</div>';
  } else {
    convo.forEach(function(msg) {
      if (msg.role === 'user') {
        html += '<div class="auto-agent-msg user"><div class="auto-agent-bubble"><p>' + escapeHtml(msg.content || '') + '</p></div></div>';
      } else {
        html += '<div class="auto-agent-msg assistant"><div class="auto-agent-avatar" style="background:var(--brand-accent-10, rgba(168,152,120,0.1));color:var(--brand-accent, #a89878);">F</div><div class="auto-agent-bubble">';
        html += renderFolioEditText(msg.content || '');
        html += '</div></div>';
      }
    });
  }
  html += '</div>';
  html += '<div style="padding:8px 0 0;border-top:1px solid var(--border-color);">';
  html += '<div style="display:flex;gap:6px;align-items:center;">';
  html += '<textarea id="folioEditInput" placeholder="Describe a change..." rows="1" style="flex:1;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;color:var(--text-primary);font-size:13px;font-family:inherit;resize:none;outline:none;" oninput="autoResizeTextarea(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendFolioEditMessage(\'' + itemId + '\');}"></textarea>';
  html += '<button onclick="sendFolioEditMessage(\'' + itemId + '\')" style="width:36px;height:36px;border-radius:50%;border:none;background:var(--brand-accent, #a89878);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>';
  html += '</div></div></div>';
  container.innerHTML = html;
}

function renderFolioEditText(text) {
  if (!text || !text.trim()) return '';
  // Strip out HTML blocks for display, show summary
  var stripped = text;
  if (stripped.indexOf('```html') !== -1) {
    stripped = stripped.replace(/```html[\s\S]*?```/g, '[Updated visual]');
  }
  var safe = escapeHtml(stripped.trim());
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  var paragraphs = safe.split(/\n\n+/);
  return paragraphs.map(function(p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
}

function sendFolioEditMessage(itemId) {
  var input = document.getElementById('folioEditInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = '';

  var items = getFolioItems();
  var item = null;
  var itemIdx = -1;
  for (var i = 0; i < items.length; i++) { if (items[i].id === itemId) { item = items[i]; itemIdx = i; break; } }
  if (!item) return;

  if (!item.conversation) item.conversation = [];
  item.conversation.push({ role: 'user', content: text, timestamp: new Date().toISOString() });

  // Build messages for API
  var systemPrompt = buildFolioEditSystemPrompt(item);
  var apiMessages = [];
  item.conversation.forEach(function(m) {
    if (m.role === 'user' || (m.role === 'assistant' && m.content)) {
      apiMessages.push({ role: m.role, content: m.content });
    }
  });

  // Add streaming assistant message
  var assistantMsg = { role: 'assistant', content: '', timestamp: new Date().toISOString() };
  item.conversation.push(assistantMsg);
  items[itemIdx] = item;
  saveFolioItems(items);

  var content = document.getElementById('folioSideContent');
  if (content) renderFolioEditPanel(itemId, content);

  // Get provider/model
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var provider, modelKey;
  if (currentMode === 'life') {
    provider = localStorage.getItem('roweos_life_provider') || 'anthropic';
    modelKey = localStorage.getItem('roweos_life_model') || 'claude-sonnet-4-6';
  } else {
    var _brandIdx = 0;
    try {
      var _agentBrandEl = document.getElementById('agentBrand');
      if (_agentBrandEl) _brandIdx = parseInt(_agentBrandEl.value) || 0;
    } catch(e) {}
    var _bs = brandSettings[_brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    provider = _bs.provider || 'anthropic';
    modelKey = _bs.model || 'claude-sonnet-4-6';
  }
  if (provider === 'roweos') {
    try { var _r = resolveRoweOSAI({ userMessage: text, systemPrompt: '' }); provider = _r.provider; modelKey = _r.model; } catch(e) { provider = 'anthropic'; modelKey = 'claude-sonnet-4-6'; }
  }
  if (typeof getModelForTier === 'function') modelKey = getModelForTier(provider, modelKey);

  var _apiKeyPromise;
  if (provider === 'nanobanana') {
    _apiKeyPromise = Promise.resolve(typeof getNanobananaKey === 'function' ? getNanobananaKey() : '');
  } else {
    _apiKeyPromise = typeof getApiKey === 'function' ? getApiKey(provider) : Promise.resolve('');
  }

  _apiKeyPromise.then(function(apiKey) {
    if (!apiKey) {
      assistantMsg.content = 'Please set an API key in Settings.';
      var its = getFolioItems(); for (var x = 0; x < its.length; x++) { if (its[x].id === itemId) { its[x] = item; break; } }
      saveFolioItems(its);
      if (content) renderFolioEditPanel(itemId, content);
      return;
    }
    var streamFn = provider === 'anthropic' ? callAnthropicStreaming :
                   provider === 'openai' ? callOpenAIStreaming :
                   provider === 'google' ? callGoogleStreaming :
                   provider === 'nanobanana' ? callNanobananaStreaming : null;
    if (!streamFn) {
      assistantMsg.content = 'Unsupported provider.';
      var its = getFolioItems(); for (var x = 0; x < its.length; x++) { if (its[x].id === itemId) { its[x] = item; break; } }
      saveFolioItems(its);
      if (content) renderFolioEditPanel(itemId, content);
      return;
    }
    streamFn(modelKey, apiKey, apiMessages, systemPrompt,
      function onChunk(chunk) {
        assistantMsg.content += chunk;
      },
      function onComplete(fullText) {
        assistantMsg.content = fullText;
        // Extract HTML if present
        var htmlMatch = fullText.match(/```html\s*([\s\S]*?)```/);
        if (htmlMatch) {
          item.html = htmlMatch[1].trim();
          var now = new Date().toISOString();
          if (!item.versions) item.versions = [];
          item.versions.push({ id: 'v_' + Date.now(), html: item.html, description: text.substring(0, 80), timestamp: now, source: 'edited' });
          // Update iframe in fullscreen
          var iframe = document.querySelector('.folio-fullscreen-iframe');
          if (iframe) iframe.srcdoc = item.html;
        }
        var its = getFolioItems(); for (var x = 0; x < its.length; x++) { if (its[x].id === itemId) { its[x] = item; break; } }
        saveFolioItems(its);
        if (content) renderFolioEditPanel(itemId, content);
      },
      function onError(err) {
        assistantMsg.content += '\n\n[Error: ' + (err.message || err) + ']';
        var its = getFolioItems(); for (var x = 0; x < its.length; x++) { if (its[x].id === itemId) { its[x] = item; break; } }
        saveFolioItems(its);
        if (content) renderFolioEditPanel(itemId, content);
      }
    );
  });
}

function buildFolioEditSystemPrompt(item) {
  var accentColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#a89878';
  return 'You are Folio, the visual editing engine inside RoweOS. ' +
    'The user has an existing HTML visualization and wants to modify it. ' +
    'Current HTML:\n```html\n' + (item.html || '') + '\n```\n\n' +
    'When the user describes a change, produce the COMPLETE updated HTML document in a ```html code block. ' +
    'The HTML must be fully self-contained with inline CSS and JS. ' +
    'Keep the same structure but apply the requested changes. ' +
    'Maintain dark backgrounds (#1a1a1a), accent color (' + accentColor + '), and Inter/SF Pro fonts. ' +
    'Always produce the full HTML, not a partial diff. ' +
    'NEVER use <canvas> elements. Use SVG, CSS, and DOM elements instead. ' +
    'Use window.onload for initialization, NOT DOMContentLoaded. ' +
    'Always include <meta name="viewport" content="width=device-width, initial-scale=1"> in the head.';
}

// --- Version History ---
function renderFolioVersions(itemId, container) {
  var items = getFolioItems();
  var item = null;
  for (var i = 0; i < items.length; i++) { if (items[i].id === itemId) { item = items[i]; break; } }
  if (!item || !item.versions || item.versions.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:13px;">No versions yet.</div>';
    return;
  }
  var html = '<div style="display:flex;flex-direction:column;gap:8px;">';
  // Reverse to show newest first
  var versions = item.versions.slice().reverse();
  versions.forEach(function(v, idx) {
    var dateStr = '';
    try { dateStr = new Date(v.timestamp).toLocaleString(); } catch(e) {}
    var isCurrent = idx === 0;
    html += '<div style="padding:12px;border:1px solid ' + (isCurrent ? 'rgba(212,175,55,0.3)' : 'var(--border-color)') + ';border-radius:10px;background:' + (isCurrent ? 'rgba(212,175,55,0.05)' : 'var(--bg-secondary)') + ';">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">';
    html += '<span style="font-size:12px;font-weight:600;color:' + (isCurrent ? 'var(--brand-accent, #a89878)' : 'var(--text-primary)') + ';">' + (isCurrent ? 'Current' : 'v' + (item.versions.length - idx)) + '</span>';
    html += '<span style="font-size:11px;color:var(--text-muted);">' + dateStr + '</span>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">' + escapeHtml(v.description || v.source || '') + '</div>';
    if (!isCurrent) {
      html += '<button onclick="restoreFolioVersion(\'' + itemId + '\',\'' + v.id + '\')" style="padding:4px 12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-secondary);font-size:11px;cursor:pointer;font-family:inherit;">Restore</button>';
    }
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function restoreFolioVersion(itemId, versionId) {
  var items = getFolioItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === itemId) {
      var item = items[i];
      for (var v = 0; v < item.versions.length; v++) {
        if (item.versions[v].id === versionId) {
          item.html = item.versions[v].html;
          var now = new Date().toISOString();
          item.versions.push({ id: 'v_' + Date.now(), html: item.html, description: 'Restored from ' + new Date(item.versions[v].timestamp).toLocaleDateString(), timestamp: now, source: 'edited' });
          item.updatedAt = now;
          // Update iframe
          var iframe = document.querySelector('.folio-fullscreen-iframe');
          if (iframe) iframe.srcdoc = item.html;
          break;
        }
      }
      items[i] = item;
      break;
    }
  }
  saveFolioItems(items);
  var content = document.getElementById('folioSideContent');
  if (content) renderFolioVersions(itemId, content);
  showToast('Version restored', 'success');
}

// --- Comments/Notes ---
function renderFolioNotes(itemId, container) {
  var items = getFolioItems();
  var item = null;
  for (var i = 0; i < items.length; i++) { if (items[i].id === itemId) { item = items[i]; break; } }
  if (!item) { container.innerHTML = ''; return; }
  var comments = item.comments || [];
  var html = '<div style="display:flex;flex-direction:column;height:100%;">';
  html += '<div style="flex:1;overflow-y:auto;padding-bottom:12px;">';
  if (comments.length === 0) {
    html += '<div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:13px;">No notes yet.</div>';
  } else {
    comments.forEach(function(c) {
      var dateStr = '';
      try { dateStr = new Date(c.timestamp).toLocaleString(); } catch(e) {}
      html += '<div style="padding:10px 12px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-secondary);margin-bottom:8px;position:relative;">';
      html += '<div style="font-size:13px;color:var(--text-primary);margin-bottom:4px;">' + escapeHtml(c.text) + '</div>';
      html += '<div style="font-size:10px;color:var(--text-muted);">' + dateStr + '</div>';
      html += '<button onclick="deleteFolioComment(\'' + itemId + '\',\'' + c.id + '\')" style="position:absolute;top:8px;right:8px;border:none;background:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:2px 4px;">x</button>';
      html += '</div>';
    });
  }
  html += '</div>';
  html += '<div style="padding:8px 0 0;border-top:1px solid var(--border-color);">';
  html += '<div style="display:flex;gap:6px;align-items:center;">';
  html += '<input id="folioNoteInput" placeholder="Add a note..." style="flex:1;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addFolioComment(\'' + itemId + '\');}">';
  html += '<button onclick="addFolioComment(\'' + itemId + '\')" style="padding:8px 16px;border-radius:10px;border:none;background:var(--brand-accent, #a89878);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Add</button>';
  html += '</div></div></div>';
  container.innerHTML = html;
}

function addFolioComment(itemId) {
  var input = document.getElementById('folioNoteInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  var items = getFolioItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === itemId) {
      if (!items[i].comments) items[i].comments = [];
      items[i].comments.push({ id: 'c_' + Date.now(), text: text, timestamp: new Date().toISOString() });
      break;
    }
  }
  saveFolioItems(items);
  var content = document.getElementById('folioSideContent');
  if (content) renderFolioNotes(itemId, content);
}

function deleteFolioComment(itemId, commentId) {
  var items = getFolioItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === itemId) {
      items[i].comments = (items[i].comments || []).filter(function(c) { return c.id !== commentId; });
      break;
    }
  }
  saveFolioItems(items);
  var content = document.getElementById('folioSideContent');
  if (content) renderFolioNotes(itemId, content);
}

// --- Folio Chat (Creation Chat) ---
function buildFolioChatSystemPrompt() {
  var brandIdx = (typeof selectedBrand === 'number' && !isNaN(selectedBrand)) ? selectedBrand : parseInt(localStorage.getItem('selectedBrand') || '0', 10);
  var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : null;
  var brandName = brand ? (brand.shortName || brand.name) : 'RoweOS';

  // Get the brand's accent color from CSS
  var accentColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#a89878';

  var isMobile = window.innerWidth <= 768;
  var prompt = 'You are Folio, the visual creation engine inside RoweOS. ' +
    'You create interactive HTML visualizations, diagrams, charts, dashboards, and canvas-style outputs. ' +
    'When the user describes what they want, produce a COMPLETE, self-contained HTML document with inline CSS and JS. ' +
    'The HTML must be fully interactive. All clicks, hovers, inputs, and animations must work. ' +
    'Wrap your HTML output in ```html code blocks. ' +
    'You can iterate on previous outputs. When the user says "make the bars blue" or "add a legend", update the visualization. ' +
    'Always produce beautiful, polished, professional visuals. ' +
    'Use dark backgrounds (#1a1a1a), accent color (' + accentColor + '), and Inter/SF Pro fonts.\n\n' +
    'CRITICAL RENDERING RULES (your HTML renders inside an iframe):\n' +
    '- Always include <meta name="viewport" content="width=device-width, initial-scale=1"> in your <head>\n' +
    '- NEVER use <canvas> elements. They do not render in iframe previews. Use SVG, CSS grid, flexbox, and DOM elements instead.\n' +
    '- Use setTimeout(function(){ ... }, 100) to initialize after layout is complete. Do NOT use DOMContentLoaded.\n' +
    '- Use width:100% and height:100vh for full-page layouts.\n' +
    '- Always include sample/demo data so the visual is never empty.\n' +
    '- All styles must be inline in a <style> tag, all scripts in a <script> tag at the end of <body>.\n\n';

  if (isMobile) {
    prompt += 'MOBILE CONTEXT: The user is on a mobile device (screen width: ' + window.innerWidth + 'px). ' +
      'Design for mobile-first. Use single-column layouts, larger touch targets (min 44px), ' +
      'scrollable containers, and avoid fixed-position toolbars that overlap content. ' +
      'Use viewport units (vw/vh) for sizing.\n\n';
  }

  // Inject full brand identity context (same as main BrandAI chat)
  if (brand) {
    prompt += 'BRAND CONTEXT:\n' +
      '- Name: ' + (brand.name || '') + '\n' +
      '- Tagline: ' + (brand.tagline || 'N/A') + '\n' +
      '- Voice: ' + (brand.voice || 'Professional and warm') + '\n' +
      '- Audience: ' + (brand.audience || '') + '\n' +
      '- Positioning: ' + (brand.positioning || '') + '\n' +
      '- Values: ' + (brand.values || '') + '\n';
    if (brand.philosophy) prompt += '- Philosophy: ' + brand.philosophy + '\n';
    if (brand.tone) prompt += '- Tone: ' + brand.tone + '\n';
    if (brand.colorPalette) prompt += '- Brand Colors: ' + brand.colorPalette + '\n';
    if (brand.typography) prompt += '- Typography: ' + brand.typography + '\n';
  }

  // Brand identity intelligence (knowledge base, document analysis)
  if (typeof getBrandIdentityIntelligence === 'function' && brand) {
    var bii = getBrandIdentityIntelligence(brand);
    if (bii) prompt += '\n' + bii + '\n';
  }

  // Owner context from LifeAI (cross-mode)
  if (typeof getBrandOwnerContext === 'function') {
    var oc = getBrandOwnerContext();
    if (oc) prompt += '\n' + oc + '\n';
  }

  // Guardrails
  if (typeof getGuardrailsContext === 'function') {
    prompt += getGuardrailsContext();
  }

  // Folio-specific knowledge from Identity
  var folioKnowledge = getFolioKnowledge();
  if (folioKnowledge && folioKnowledge.length > 0) {
    prompt += '\n\nFOLIO DESIGN PREFERENCES:\n';
    folioKnowledge.forEach(function(entry) {
      prompt += '- ' + entry.text + '\n';
    });
  }

  return prompt;
}

function buildFolioChatApiMessages() {
  var msgs = [];
  _folioMessages.forEach(function(m) {
    if (m.role === 'user') {
      var content = m.content || '';
      if (m.files && m.files.length > 0) {
        var imageFiles = m.files.filter(function(f) { return f.type === 'image'; });
        var docFiles = m.files.filter(function(f) { return f.type === 'document'; });
        if (imageFiles.length > 0) {
          content += '\n\n[User attached ' + imageFiles.length + ' image(s): ' + imageFiles.map(function(f) { return f.name; }).join(', ') + ']';
        }
        docFiles.forEach(function(f) {
          content += '\n\n[Attached document: ' + f.name + ']\n' + (f.text || '');
        });
      }
      msgs.push({ role: 'user', content: content });
    } else if (m.role === 'assistant' && m.content) {
      msgs.push({ role: 'assistant', content: m.content });
    }
  });
  if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant' && !msgs[msgs.length - 1].content) {
    msgs.pop();
  }
  return msgs;
}

function sendFolioChatMessage() {
  if (_folioStreaming) return;
  var input = document.getElementById('folioChatInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text && _folioFiles.length === 0) return;

  var userMsg = { role: 'user', content: text, files: _folioFiles.slice(), timestamp: Date.now() };
  _folioMessages.push(userMsg);
  input.value = '';
  input.style.height = 'auto';
  _folioFiles = [];
  renderFolioFileChips();
  renderFolioChatMessages();

  var systemPrompt = buildFolioChatSystemPrompt();
  var apiMessages = buildFolioChatApiMessages();

  _folioStreaming = true;
  var assistantMsg = { role: 'assistant', content: '', timestamp: Date.now() };
  _folioMessages.push(assistantMsg);
  renderFolioChatMessages();
  scrollFolioChatToBottom();

  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var provider, modelKey;
  if (currentMode === 'life') {
    provider = localStorage.getItem('roweos_life_provider') || 'anthropic';
    modelKey = localStorage.getItem('roweos_life_model') || 'claude-sonnet-4-6';
  } else {
    var _brandIdx = 0;
    try {
      var _agentBrandEl = document.getElementById('agentBrand');
      if (_agentBrandEl) _brandIdx = parseInt(_agentBrandEl.value) || 0;
    } catch(e) {}
    var _bs = brandSettings[_brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    provider = _bs.provider || 'anthropic';
    modelKey = _bs.model || 'claude-sonnet-4-6';
  }
  if (provider === 'roweos') {
    try { var _r = resolveRoweOSAI({ userMessage: text, systemPrompt: '' }); provider = _r.provider; modelKey = _r.model; } catch(e) { provider = 'anthropic'; modelKey = 'claude-sonnet-4-6'; }
  }
  if (typeof getModelForTier === 'function') modelKey = getModelForTier(provider, modelKey);

  var _apiKeyPromise;
  if (provider === 'nanobanana') {
    _apiKeyPromise = Promise.resolve(typeof getNanobananaKey === 'function' ? getNanobananaKey() : '');
  } else {
    _apiKeyPromise = typeof getApiKey === 'function' ? getApiKey(provider) : Promise.resolve('');
  }

  _apiKeyPromise.then(function(apiKey) {
    if (!apiKey) {
      assistantMsg.content = 'Please set an API key in Settings to use Folio Chat.';
      _folioStreaming = false;
      renderFolioChatMessages();
      return;
    }
    var streamFn = provider === 'anthropic' ? callAnthropicStreaming :
                   provider === 'openai' ? callOpenAIStreaming :
                   provider === 'google' ? callGoogleStreaming :
                   provider === 'nanobanana' ? callNanobananaStreaming : null;
    if (!streamFn) {
      assistantMsg.content = 'Unsupported provider. Please select Anthropic, OpenAI, or Google in Settings.';
      _folioStreaming = false;
      renderFolioChatMessages();
      return;
    }
    streamFn(modelKey, apiKey, apiMessages, systemPrompt,
      function onChunk(chunk) {
        assistantMsg.content += chunk;
        if (!_folioRenderTimer) {
          _folioRenderTimer = setTimeout(function() {
            _folioRenderTimer = null;
            renderFolioChatMessages();
            scrollFolioChatToBottom();
          }, 60);
        }
      },
      function onComplete(fullText) {
        if (_folioRenderTimer) { clearTimeout(_folioRenderTimer); _folioRenderTimer = null; }
        assistantMsg.content = fullText;
        _folioStreaming = false;
        renderFolioChatMessages();
        scrollFolioChatToBottom();
      },
      function onError(err) {
        if (_folioRenderTimer) { clearTimeout(_folioRenderTimer); _folioRenderTimer = null; }
        assistantMsg.content = (assistantMsg.content || '') + '\n\n[Error: ' + (err.message || err) + ']';
        _folioStreaming = false;
        renderFolioChatMessages();
      }
    );
  }).catch(function(err) {
    // v28.4: Reset streaming flag on promise rejection to prevent stuck state
    if (_folioRenderTimer) { clearTimeout(_folioRenderTimer); _folioRenderTimer = null; }
    assistantMsg.content = (assistantMsg.content || '') + '\n\n[Error: ' + (err.message || err) + ']';
    _folioStreaming = false;
    renderFolioChatMessages();
  });
}

function renderFolioChatMessages() {
  var container = document.getElementById('folioChatMessages');
  if (!container) return;
  if (_folioMessages.length === 0) return;

  var chatEl = container.closest('.folio-chat');
  if (chatEl) chatEl.classList.add('has-messages');

  // On mobile, hide header when chat has messages
  if (window.innerWidth <= 768) {
    var folioViewEl = document.getElementById('folioView');
    if (folioViewEl) folioViewEl.classList.add('folio-chat-active');
    initFolioChatCollapse();
  }

  if (!_folioScrollListenerAttached) {
    _folioScrollListenerAttached = true;
    container.addEventListener('scroll', function() {
      var btn = document.getElementById('folioChatScrollBtn');
      if (!btn) return;
      var dist = container.scrollHeight - container.scrollTop - container.clientHeight;
      btn.style.display = dist > 150 ? 'flex' : 'none';
    });
  }

  // During streaming, only update the last message div to avoid iframe flash
  if (_folioStreaming && container.children.length > 0) {
    var lastMsg = _folioMessages[_folioMessages.length - 1];
    var lastDiv = container.lastElementChild;
    if (lastMsg && lastMsg.role === 'assistant' && lastDiv) {
      var bubbleDiv = lastDiv.querySelector('.auto-agent-bubble');
      if (bubbleDiv) {
        if (!lastMsg.content) {
          bubbleDiv.innerHTML = '<p class="auto-agent-thinking">Creating visual...</p>';
        } else {
          // Only update text during streaming (no iframe re-render until complete)
          // v28.4: Case-insensitive check for ```html
          var _lc = lastMsg.content.toLowerCase();
          var hasCompleteHtml = _lc.indexOf('```html') !== -1 && _lc.indexOf('```', _lc.indexOf('```html') + 7) !== -1;
          if (!hasCompleteHtml) {
            bubbleDiv.innerHTML = renderFolioChatContent(lastMsg.content, _folioMessages.length - 1);
          }
        }
      }
    }
    return;
  }

  var html = '';
  _folioMessages.forEach(function(msg, idx) {
    if (msg.role === 'user') {
      html += '<div class="auto-agent-msg user"><div class="auto-agent-bubble">';
      if (msg.files && msg.files.length > 0) {
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">';
        msg.files.forEach(function(f) {
          if (f.type === 'image' && f.dataUrl) {
            html += '<img src="' + f.dataUrl + '" style="width:60px;height:60px;border-radius:8px;object-fit:cover;">';
          } else {
            var _ext = f.name.split('.').pop().toLowerCase();
            var _ic = _ext === 'pdf' ? '#e74c3c' : ['xlsx','xls','csv'].indexOf(_ext) !== -1 ? '#27ae60' : '#3498db';
            html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg-tertiary);border-radius:8px;font-size:11px;color:var(--text-secondary);"><span style="width:24px;height:24px;border-radius:4px;background:' + _ic + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;">' + _ext.toUpperCase().substring(0,3) + '</span>' + escapeHtml(f.name) + '</div>';
          }
        });
        html += '</div>';
      }
      if (msg.content) html += '<p>' + escapeHtml(msg.content) + '</p>';
      html += '</div></div>';
    } else if (msg.role === 'assistant') {
      html += '<div class="auto-agent-msg assistant">';
      html += '<div class="auto-agent-bubble">';
      if (!msg.content && _folioStreaming) {
        html += '<p class="auto-agent-thinking">Creating visual...</p>';
      } else {
        html += renderFolioChatContent(msg.content || '', idx);
      }
      html += '</div></div>';
    }
  });
  container.innerHTML = html;
  // v25.0: Persist chat messages for cross-session continuity
  try { localStorage.setItem('roweos_folio_chat_messages', JSON.stringify(_folioMessages)); } catch(e) {}
}

function renderFolioChatContent(text, msgIdx) {
  // v28.4: Case-insensitive match for ```html, ```HTML, ```Html etc.
  var parts = text.split(/```html\s*/i);
  // v28.4: Also detect bare ``` code fences containing HTML (<!DOCTYPE or <html)
  if (parts.length === 1) {
    var bareMatch = text.split(/```\s*\n/);
    if (bareMatch.length > 1) {
      for (var bm = 1; bm < bareMatch.length; bm++) {
        var bareEnd = bareMatch[bm].indexOf('```');
        var bareCode = bareEnd !== -1 ? bareMatch[bm].substring(0, bareEnd) : bareMatch[bm];
        if (bareCode.indexOf('<!DOCTYPE') !== -1 || bareCode.indexOf('<html') !== -1 || (bareCode.indexOf('<head') !== -1 && bareCode.indexOf('<body') !== -1)) {
          parts = text.split(/```\s*\n/);
          break;
        }
      }
    }
  }
  var html = '';
  parts.forEach(function(part, i) {
    if (i === 0) {
      html += renderFolioChatText(part);
    } else {
      var endIdx = part.indexOf('```');
      var isComplete = endIdx !== -1;
      var htmlCode = isComplete ? part.substring(0, endIdx) : part;
      var afterCode = isComplete ? part.substring(endIdx + 3) : '';

      if (!isComplete && _folioStreaming) {
        // Still streaming this HTML block - show building animation only, no iframe
        html += '<div class="auto-agent-building" style="border-color:var(--brand-accent-20, rgba(168,152,120,0.2));background:var(--brand-accent-10, rgba(168,152,120,0.05));">';
        html += '<div class="auto-agent-building-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg></div>';
        html += '<div class="auto-agent-building-text" style="color:var(--brand-accent, #a89878);">Creating Visual</div>';
        html += '<div class="auto-agent-building-sub">Building your artifact...</div>';
        html += '</div>';
      } else if (htmlCode.trim()) {
        // Complete HTML block - render preview with iframe
        var previewId = 'folioPreview_' + msgIdx + '_' + i;
        if (!window._folioPreviews) window._folioPreviews = {};
        window._folioPreviews[previewId] = htmlCode.trim();
        html += '<div class="auto-agent-preview" style="border-color:var(--brand-accent-20, rgba(168,152,120,0.2));">';
        html += '<div class="auto-agent-preview-header" style="border-color:var(--brand-accent-10, rgba(168,152,120,0.1));">';
        html += '<span class="preview-type-badge" style="background:var(--brand-accent, #a89878);">Visual</span>';
        html += '<span class="preview-name">Live Preview</span>';
        html += '</div>';
        html += '<div class="folio-preview-frame" style="height:auto;overflow:visible;">';
        html += '<iframe sandbox="allow-scripts allow-same-origin" srcdoc="' + escapeSrcdoc(htmlCode.trim()) + '" style="width:100%;border:none;min-height:200px;" onload="resizeFolioPreviewIframe(this)"></iframe>';
        html += '</div>';
        html += '<div class="auto-agent-preview-actions" style="border-color:var(--brand-accent-10, rgba(168,152,120,0.1));">';
        html += '<button class="auto-agent-add-btn" id="' + previewId + '" onclick="savePreviewToFolio(this)">Save to Folio</button>';
        html += '<button class="auto-agent-edit-btn" onclick="saveFolioPreviewToLibrary(\'' + previewId + '\')">Save to Library</button>';
        html += '</div>';
        html += '</div>';
      }

      if (afterCode.trim()) {
        html += renderFolioChatText(afterCode);
      }
    }
  });

  return html;
}

function renderFolioChatText(text) {
  if (!text || !text.trim()) return '';
  var safe = escapeHtml(text.trim());
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  var paragraphs = safe.split(/\n\n+/);
  return paragraphs.map(function(p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
}

function savePreviewToFolio(btn) {
  var previewId = btn.id;
  var htmlCode = window._folioPreviews && window._folioPreviews[previewId];
  if (!htmlCode) { showToast('Could not find preview data', 'error'); return; }
  saveToFolio(htmlCode, 'Folio Visual ' + new Date().toLocaleDateString(), 'folio-chat');
  btn.textContent = 'Saved';
  btn.style.background = '#22c55e';
  btn.style.pointerEvents = 'none';
}

// v28.4: Save folio preview content to Library
function saveFolioPreviewToLibrary(previewId) {
  var htmlCode = window._folioPreviews && window._folioPreviews[previewId];
  if (!htmlCode) { showToast('Could not find preview data', 'error'); return; }
  var currentMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var key = currentMode === 'life' ? '_life' : (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand] ? (brands[selectedBrand].shortName || brands[selectedBrand].name) : 'default');
  if (typeof fileLibrary === 'undefined') window.fileLibrary = {};
  if (!fileLibrary[key]) fileLibrary[key] = { folders: [{ id: 'root', name: 'Root', parentId: null }], files: [] };
  if (!fileLibrary[key].files) fileLibrary[key].files = [];
  var dateStr = new Date().toLocaleDateString();
  fileLibrary[key].files.push({
    id: 'file_' + Date.now(),
    name: 'Folio Visual - ' + dateStr,
    type: 'text/html',
    content: htmlCode,
    folderId: 'root',
    createdAt: new Date().toISOString(),
    metadata: { source: 'folio-chat' }
  });
  try { localStorage.setItem('roweos_file_library', JSON.stringify(fileLibrary)); } catch(e) {}
  if (typeof writeDB === 'function') writeDB('library/brand', { data: JSON.stringify(fileLibrary) });
  showToast('Folio visual saved to Library', 'success');
}

function expandFolioPreview(previewId) {
  var htmlCode = window._folioPreviews && window._folioPreviews[previewId];
  if (!htmlCode) { showToast('Could not find preview data', 'error'); return; }
  var overlay = document.createElement('div');
  overlay.id = 'folioExpandOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0a0a;z-index:99999;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top, 0px);';
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;';
  header.innerHTML = '<button onclick="document.getElementById(\'folioExpandOverlay\').remove();" style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);background:transparent;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>'
    + '<span style="color:#fff;font-size:14px;font-weight:600;margin-left:12px;">Preview</span>'
    + '<button onclick="savePreviewToFolioById(\'' + previewId + '\')" style="margin-left:auto;padding:6px 14px;border-radius:8px;border:1px solid var(--brand-accent, #a89878);background:var(--brand-accent-10, rgba(168,152,120,0.1));color:var(--brand-accent, #a89878);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Save to Folio</button>';
  overlay.appendChild(header);
  var iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.srcdoc = htmlCode;
  iframe.style.cssText = 'flex:1;border:none;width:100%;background:#111;';
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}

// v29.0: Auto-resize folio preview iframe to match its content height
function resizeFolioPreviewIframe(iframe) {
  try {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    if (doc && doc.body) {
      var h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 200);
      iframe.style.height = h + 'px';
    }
  } catch(e) {
    iframe.style.height = '400px';
  }
}

function savePreviewToFolioById(previewId) {
  var htmlCode = window._folioPreviews && window._folioPreviews[previewId];
  if (!htmlCode) { showToast('Could not find preview data', 'error'); return; }
  saveToFolio(htmlCode, 'Folio Visual ' + new Date().toLocaleDateString(), 'folio-chat');
  showToast('Saved to Folio', 'success');
}

function scrollFolioChatToBottom() {
  var container = document.getElementById('folioChatMessages');
  if (container) {
    requestAnimationFrame(function() {
      container.scrollTop = container.scrollHeight;
      var btn = document.getElementById('folioChatScrollBtn');
      if (btn) btn.style.display = 'none';
    });
  }
}

// --- Folio Chat Collapse (Mobile) ---
var _folioChatCollapseAttached = false;
function initFolioChatCollapse() {
  if (_folioChatCollapseAttached || window.innerWidth > 768) return;
  var msgContainer = document.getElementById('folioChatMessages');
  if (!msgContainer) return;
  _folioChatCollapseAttached = true;
  var lastScrollTop = 0;
  msgContainer.addEventListener('scroll', function() {
    var inputArea = document.getElementById('folioInputArea');
    if (!inputArea) return;
    var scrollTop = msgContainer.scrollTop;
    var atBottom = msgContainer.scrollHeight - scrollTop - msgContainer.clientHeight < 100;
    if (scrollTop > lastScrollTop && scrollTop > 60 && !atBottom) {
      // Scrolling up (away from bottom) - collapse
      inputArea.classList.add('folio-input-collapsed');
    } else if (atBottom || scrollTop < lastScrollTop) {
      // At bottom or scrolling down - expand
      inputArea.classList.remove('folio-input-collapsed');
    }
    lastScrollTop = scrollTop;
    // Also hide header when chat has messages on mobile
    var folioViewEl = document.getElementById('folioView');
    if (folioViewEl && scrollTop > 10) {
      folioViewEl.classList.add('folio-chat-active');
    }
  }, { passive: true });
}

function expandFolioInput() {
  var inputArea = document.getElementById('folioInputArea');
  if (inputArea) {
    inputArea.classList.remove('folio-input-collapsed');
    var textarea = document.getElementById('folioChatInput');
    if (textarea) textarea.focus();
  }
}

function newFolioChatSession() {
  _folioMessages = [];
  _folioFiles = [];
  _folioStreaming = false;
  localStorage.removeItem('roweos_folio_chat_messages'); // v25.0
  var container = document.getElementById('folioChatMessages');
  if (container) {
    var chatEl = container.closest('.folio-chat');
    if (chatEl) chatEl.classList.remove('has-messages');
    container.innerHTML = document.getElementById('folioChatWelcome') ? '' : '';
    // Restore welcome
    container.innerHTML = '<div class="auto-agent-welcome" id="folioChatWelcome">'
      + '<div class="auto-agent-welcome-icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg></div>'
      + '<div class="auto-agent-welcome-title">Folio Chat</div>'
      + '<div class="auto-agent-welcome-sub">Describe a visual — dashboard, chart, diagram, interactive — and I will build it.</div>'
      + '<div class="auto-agent-suggestions">'
      + '<button class="auto-agent-suggest-btn" onclick="folioQuickPrompt(\'Build a brand performance dashboard\')">Brand performance dashboard</button>'
      + '<button class="auto-agent-suggest-btn" onclick="folioQuickPrompt(\'Create an interactive org chart\')">Interactive org chart</button>'
      + '<button class="auto-agent-suggest-btn" onclick="folioQuickPrompt(\'Design a pricing comparison table\')">Pricing comparison table</button>'
      + '<button class="auto-agent-suggest-btn" onclick="folioQuickPrompt(\'Make a project timeline visualization\')">Project timeline</button>'
      + '<button class="auto-agent-suggest-btn" onclick="folioQuickPrompt(\'Build a competitive analysis framework\')">Competitive analysis</button>'
      + '<button class="auto-agent-suggest-btn" onclick="folioQuickPrompt(\'Create an interactive pitch deck\')">Interactive pitch deck</button>'
      + '</div></div>';
  }
  var chips = document.getElementById('folioFileChips');
  if (chips) chips.innerHTML = '';
  var input = document.getElementById('folioChatInput');
  if (input) { input.value = ''; input.style.height = ''; }
}

function folioQuickPrompt(text) {
  var input = document.getElementById('folioChatInput');
  if (input) input.value = text;
  sendFolioChatMessage();
}

// --- Folio File Handling ---
function handleFolioFile(input) {
  var files = input.target ? input.target.files : (input.files || null);
  if (!files || !files.length) return;
  Array.from(files).forEach(function(file) {
    var ext = file.name.split('.').pop().toLowerCase();
    if (file.type.startsWith('image/')) {
      var reader = new FileReader();
      reader.onload = function(e) {
        _folioFiles.push({ name: file.name, type: 'image', dataUrl: e.target.result, base64: e.target.result });
        renderFolioFileChips();
      };
      reader.readAsDataURL(file);
    } else if (ext === 'pdf') {
      var reader = new FileReader();
      reader.onload = function(e) {
        if (typeof pdfjsLib !== 'undefined') {
          pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise.then(function(pdf) {
            var textPromises = [];
            for (var p = 1; p <= Math.min(pdf.numPages, 30); p++) {
              textPromises.push(pdf.getPage(p).then(function(page) {
                return page.getTextContent().then(function(tc) {
                  return tc.items.map(function(i) { return i.str; }).join(' ');
                });
              }));
            }
            Promise.all(textPromises).then(function(pages) {
              _folioFiles.push({ name: file.name, type: 'document', text: pages.join('\n\n'), preview: pages.join('\n\n').substring(0, 200) + '...' });
              renderFolioFileChips();
              showToast('PDF attached (' + pdf.numPages + ' pages)', 'success');
            });
          }).catch(function(err) { showToast('Could not read PDF: ' + err.message, 'error'); });
        } else { showToast('PDF reader not available', 'warning'); }
      };
      reader.readAsArrayBuffer(file);
    } else if (['xlsx', 'xls', 'csv'].indexOf(ext) !== -1) {
      var reader = new FileReader();
      reader.onload = function(e) {
        if (typeof XLSX !== 'undefined') {
          try {
            var wb = XLSX.read(e.target.result, { type: 'array' });
            var allText = '';
            wb.SheetNames.forEach(function(name) {
              allText += '--- Sheet: ' + name + ' ---\n';
              allText += XLSX.utils.sheet_to_csv(wb.Sheets[name]) + '\n\n';
            });
            _folioFiles.push({ name: file.name, type: 'document', text: allText, preview: allText.substring(0, 200) + '...' });
            renderFolioFileChips();
            showToast('Spreadsheet attached', 'success');
          } catch(err) { showToast('Could not read spreadsheet: ' + err.message, 'error'); }
        } else { showToast('Spreadsheet reader not available', 'warning'); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Read any other file as text (html, js, py, css, sql, xml, yaml, rtf, doc, etc.)
      var reader = new FileReader();
      reader.onload = function(e) {
        _folioFiles.push({ name: file.name, type: 'document', text: e.target.result, preview: e.target.result.substring(0, 200) + '...' });
        renderFolioFileChips();
        showToast('File attached', 'success');
      };
      reader.readAsText(file);
    }
  });
  // Reset file input
  if (input.target && input.target.value) input.target.value = '';
}

function renderFolioFileChips() {
  var chips = document.getElementById('folioFileChips');
  if (!chips) return;
  if (_folioFiles.length === 0) { chips.innerHTML = ''; return; }
  var html = '';
  _folioFiles.forEach(function(f, i) {
    html += '<div class="auto-agent-file-chip">';
    if (f.type === 'image' && f.dataUrl) {
      html += '<img src="' + f.dataUrl + '">';
    }
    html += '<span>' + escapeHtml(f.name) + '</span>';
    html += '<button onclick="_folioFiles.splice(' + i + ',1);renderFolioFileChips();">x</button>';
    html += '</div>';
  });
  chips.innerHTML = html;
}

// --- Save to Folio (Global) ---
function saveToFolio(content, title, source) {
  var isHtml = content.trim().indexOf('<') === 0 || content.indexOf('<!DOCTYPE') !== -1 || content.indexOf('<html') !== -1;
  // v25.1: Render markdown to rich HTML for text content
  var renderedContent = '';
  if (!isHtml && typeof markdownToHtml === 'function') {
    try { renderedContent = markdownToHtml(content); } catch(e) { renderedContent = escapeHtml(content).replace(/\n/g, '<br>'); }
  } else if (!isHtml) {
    renderedContent = escapeHtml(content).replace(/\n/g, '<br>');
  }
  var html = isHtml ? content : '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#1a1a1a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif;padding:32px;line-height:1.7;}h1,h2,h3{color:#fff;margin:1em 0 0.5em;}h1{font-size:24px;}h2{font-size:20px;}h3{font-size:16px;}p{margin:0 0 1em;}ul,ol{margin:0 0 1em;padding-left:24px;}li{margin-bottom:4px;}strong{color:#fff;}code{background:rgba(168,152,120,0.15);color:#a89878;padding:2px 6px;border-radius:4px;font-size:0.9em;}pre{background:#111;border:1px solid #333;border-radius:8px;padding:16px;overflow-x:auto;margin:0 0 1em;}pre code{background:transparent;padding:0;}blockquote{border-left:3px solid #a89878;padding-left:16px;margin:0 0 1em;color:#999;}a{color:#a89878;}</style></head><body><div style="max-width:720px;margin:0 auto;">' + renderedContent + '</div></body></html>';
  var now = new Date().toISOString();
  var brandIdx = (typeof selectedBrand === 'number') ? selectedBrand : 0;
  var brandName = (typeof brands !== 'undefined' && brands[brandIdx]) ? (brands[brandIdx].shortName || brands[brandIdx].name) : '';
  var item = {
    id: 'folio_' + Date.now(),
    title: title || 'Untitled',
    html: html,
    thumbnail: null,
    versions: [{ id: 'v_' + Date.now(), html: html, description: 'Created from ' + (source || 'save'), timestamp: now, source: 'created' }],
    comments: [],
    conversation: [],
    branchedFrom: null,
    brand: brandName,
    brandIdx: brandIdx,
    createdAt: now,
    updatedAt: now,
    pinned: false
  };
  if (saveFolioItem(item) !== false) {
    showToast('Saved to Folio', 'success');
  }
}

// --- Save Destination Picker ---
function openSaveDestinationPicker(content, title, source, originalSaveFn) {
  // Remove existing picker
  var existing = document.getElementById('folioSavePicker');
  if (existing) existing.remove();

  var lastChoice = '';
  try { lastChoice = localStorage.getItem('roweos_save_preference') || ''; } catch(e) {}

  var overlay = document.createElement('div');
  overlay.id = 'folioSavePicker';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var card = document.createElement('div');
  card.style.cssText = 'background:var(--bg-elevated,#1c1c1e);border:1px solid var(--border-color,rgba(255,255,255,0.1));border-radius:16px;padding:24px;max-width:340px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);';
  card.innerHTML = '<div style="font-size:16px;font-weight:600;color:var(--text-primary,#fff);margin-bottom:4px;">Save Destination</div>'
    + '<div style="font-size:12px;color:var(--text-muted,#888);margin-bottom:20px;">Choose where to save this content.</div>'
    + '<div id="folioPickerOptions" style="display:flex;flex-direction:column;gap:8px;"></div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  var options = card.querySelector('#folioPickerOptions');
  var makeBtn = function(label, icon, key) {
    var btn = document.createElement('button');
    var isLast = key === lastChoice;
    btn.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;border:1px solid ' + (isLast ? 'rgba(212,175,55,0.4)' : 'var(--border-color,rgba(255,255,255,0.1))') + ';background:' + (isLast ? 'rgba(212,175,55,0.08)' : 'var(--bg-secondary,#2c2c2e)') + ';color:var(--text-primary,#fff);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;text-align:left;width:100%;transition:all 0.15s;';
    btn.innerHTML = '<span style="width:32px;height:32px;border-radius:8px;background:var(--brand-accent-10, rgba(168,152,120,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icon + '</span><span>' + label + (isLast ? ' <span style="font-size:10px;color:var(--brand-accent, #a89878);font-weight:600;">(last used)</span>' : '') + '</span>';
    btn.onmouseover = function() { btn.style.borderColor = 'rgba(212,175,55,0.5)'; };
    btn.onmouseout = function() { btn.style.borderColor = isLast ? 'rgba(212,175,55,0.4)' : 'var(--border-color,rgba(255,255,255,0.1))'; };
    btn.onclick = function() {
      try { localStorage.setItem('roweos_save_preference', key); } catch(e) {}
      overlay.remove();
      if (key === 'library' || key === 'both') {
        if (typeof originalSaveFn === 'function') originalSaveFn();
      }
      if (key === 'folio' || key === 'both') {
        saveToFolio(content, title, source);
      }
    };
    return btn;
  };

  var _accentColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#a89878';
  options.appendChild(makeBtn('Save to Library', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + _accentColor + '" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>', 'library'));
  options.appendChild(makeBtn('Save to Folio', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + _accentColor + '" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>', 'folio'));
  options.appendChild(makeBtn('Save to Both', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="' + _accentColor + '" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>', 'both'));
}

// ============================================================
// --- Folio Knowledge (Identity) ---
function getFolioKnowledge() {
  try { return JSON.parse(localStorage.getItem('roweos_folio_knowledge') || '[]'); }
  catch(e) { return []; }
}

function saveFolioKnowledge(entries) {
  try {
    localStorage.setItem('roweos_folio_knowledge', JSON.stringify(entries));
    writeDB('folio/main', { knowledge: entries }); // v25.1
  } catch(e) {}
}

function addFolioKnowledgeEntry() {
  var input = document.getElementById('folioKnowledgeInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  var entries = getFolioKnowledge();
  entries.push({ id: 'fk_' + Date.now(), text: text, timestamp: new Date().toISOString() });
  saveFolioKnowledge(entries);
  renderFolioKnowledgeSection();
}

function removeFolioKnowledgeEntry(id) {
  var entries = getFolioKnowledge().filter(function(e) { return e.id !== id; });
  saveFolioKnowledge(entries);
  renderFolioKnowledgeSection();
}

function renderFolioKnowledgeSection() {
  var list = document.getElementById('folioKnowledgeList');
  var count = document.getElementById('folioKnowledgeCount');
  if (!list) return;
  var entries = getFolioKnowledge();
  if (count) count.textContent = entries.length;
  if (entries.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">No preferences yet. Add visual style preferences below.</div>';
    return;
  }
  var html = '';
  entries.forEach(function(e) {
    html += '<div class="bloom-knowledge-entry" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:6px;">';
    html += '<span class="bloom-knowledge-entry-text" style="flex:1;font-size:12px;color:var(--text-secondary);">' + escapeHtml(e.text) + '</span>';
    html += '<button class="bloom-knowledge-entry-remove" onclick="removeFolioKnowledgeEntry(\'' + e.id + '\')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:2px 4px;">x</button>';
    html += '</div>';
  });
  list.innerHTML = html;
}

// --- Studio Integration ---
function studioSaveToFolio() {
  var outputArea = document.getElementById('studioOutputArea');
  if (!outputArea || !outputArea.textContent.trim()) { showToast('No output to save', 'warning'); return; }
  var content = outputArea.innerHTML || outputArea.textContent;
  var opSelect = document.getElementById('studioOperationSelect') || document.getElementById('operationSelect');
  var title = opSelect ? opSelect.options[opSelect.selectedIndex].text : 'Studio Output';
  saveToFolio(content, title + ' - ' + new Date().toLocaleDateString(), 'studio');
}

// --- Bloom Integration ---
function bloomSaveToFolio(postId) {
  var post = null;
  if (typeof _bloomPosts !== 'undefined') {
    post = _bloomPosts.find(function(p) { return p.id === postId; });
  }
  if (!post) { showToast('Post not found', 'error'); return; }
  var content = post.content || post.title || '';
  var title = (post.title || 'Bloom Post').substring(0, 60);
  saveToFolio(content, title, 'bloom');
}

// END FOLIO
// ============================================================

var PIPELINE_STEP_TYPES = {
  studio:       { color: '#22d3ee', rgb: '34,211,238',  label: 'Studio',        desc: 'Run a Studio operation',       icon: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>' },
  image:        { color: '#f472b6', rgb: '244,114,182', label: 'Image',         desc: 'Generate an image',            icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>' },
  video:        { color: '#c084fc', rgb: '192,132,252', label: 'Video',         desc: 'Generate a video',             icon: '<polygon points="5 3 19 12 5 21 5 3"/>' },
  post:         { color: '#60a5fa', rgb: '96,165,250',  label: 'Social Post',   desc: 'Post to social media',         icon: '<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>' },
  email:        { color: '#34d399', rgb: '52,211,153',  label: 'Email',         desc: 'Send an email',                icon: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>' },
  research:     { color: '#a78bfa', rgb: '167,139,250',  label: 'Research',      desc: 'Deep research via Gemini',     icon: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>' },
  outbox:       { color: '#fb923c', rgb: '251,146,60',  label: 'Outbox',        desc: 'Queue email to outbox',        icon: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>' },
  batch_email:  { color: '#f59e0b', rgb: '245,158,11',  label: 'Batch Email',   desc: 'Send emails in bulk',          icon: '<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>' },
  pdf_generate: { color: '#ef4444', rgb: '239,68,68',   label: 'PDF',           desc: 'Generate a PDF document',      icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-2h2a1.5 1.5 0 010 3H9"/>' },
  library:      { color: '#fbbf24', rgb: '251,191,36',  label: 'Library',       desc: 'Save output to Library',       icon: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>' },
  notify:       { color: '#4ade80', rgb: '74,222,128',  label: 'Notify',        desc: 'Send a notification',          icon: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>' },
  infographic:  { color: '#06b6d4', rgb: '6,182,212',    label: 'Infographic',   desc: 'Generate an infographic',      icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17V13M12 17V7M17 17V11"/>' },
  reminder:     { color: '#f97316', rgb: '249,115,22',  label: 'Reminder',      desc: 'Show an interactive reminder',  icon: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/><circle cx="18" cy="4" r="3" fill="#f97316" stroke="#fff"/>' },
  // v22.47: Additional types for single-automation workflow badges
  message:      { color: '#818cf8', rgb: '129,140,248', label: 'AI Message',    desc: 'Send to AI for a response',    icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>' },
  create:       { color: '#38bdf8', rgb: '56,189,248',  label: 'Task',          desc: 'Create a task',                icon: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>' },
  pulse:        { color: '#e879f9', rgb: '232,121,249', label: 'Goal',          desc: 'Update a Pulse goal',          icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
  rhythm:       { color: '#fb7185', rgb: '251,113,133', label: 'Event',         desc: 'Add a calendar event',         icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' }
};

var _pipelineSteps = [];

function showPipelineBuilder(editId) {
  var existing = null;
  if (editId) {
    try {
      var automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
      existing = automations.find(function(a) { return String(a.id) === String(editId) && a.type === 'pipeline'; });
      // v24.9: Also check scheduledTasks (dual storage) if not found in automations
      if (!existing && typeof getScheduledTasks === 'function') {
        var scheduled = getScheduledTasks();
        existing = scheduled.find(function(a) { return String(a.id) === String(editId) && a.type === 'pipeline'; });
      }
    } catch(e) {}
  }
  _pipelineSteps = existing && existing.steps ? existing.steps.map(function(s, i) {
    return { stepId: s.stepId || (i + 1), action: s.action || 'studio', name: s.name || '', target: s.target || {}, outputKey: s.outputKey || ('step' + (i + 1) + '_output'), config: s.config || {} };
  }) : [{ stepId: 1, action: 'studio', name: '', target: {}, outputKey: 'step1_output', config: {} }];
  // v22.47: Clear undo stack when opening builder fresh
  _pipelineUndoStack = [];
  renderPipelineForm(editId, existing);
}

function renderPipelineForm(editId, existing) {
  var el = document.getElementById('autoLabWorkflows');
  if (!el) return;

  var html = '<div class="pipeline-builder" id="pipelineBuilderForm">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">';
  html += '<div class="auto-lab-form-title" style="margin:0;">' + (existing ? 'Edit Pipeline' : 'Pipeline Builder') + '</div>';
  html += '<button class="auto-lab-card-btn" onclick="closePipelineBuilder()">Back</button>';
  html += '</div>';
  html += '<input type="hidden" id="pipelineEditId" value="' + (existing ? existing.id : '') + '">';

  // Name + category + schedule
  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field" style="flex:2;"><label>Pipeline Name</label>';
  html += '<input type="text" id="pipelineName" placeholder="e.g. Campaign Pipeline" value="' + escapeHtml(existing ? existing.name || '' : '') + '"></div>';
  // v23.11: Description field
  html += '<div class="auto-lab-form-field" style="flex:1;"><label>Description</label>';
  html += '<input type="text" id="pipelineDescription" placeholder="What does this pipeline do?" value="' + escapeHtml(existing ? existing.description || '' : '') + '"></div>';
  html += '</div>';
  html += '<div class="auto-lab-form-row">';
  // v23.2: Category
  // v23.17: Custom category with text input
  var _pipeCatIsCustom = existing && existing.category && ['Content','Client','Operations',''].indexOf(existing.category) === -1;
  html += '<div class="auto-lab-form-field" style="flex:1;"><label>Category</label>';
  html += '<select id="pipelineCategory" onchange="var isC=this.value===\'Custom\';var ci=document.getElementById(\'pipelineCustomCat\');if(ci)ci.style.display=isC?\'\':\'none\';var cc=document.getElementById(\'pipelineCustomCatColor\');if(cc)cc.style.display=isC?\'\':\'none\';"><option value="">None</option><option value="Content"' + (existing && existing.category === 'Content' ? ' selected' : '') + '>Content</option><option value="Client"' + (existing && existing.category === 'Client' ? ' selected' : '') + '>Client</option><option value="Operations"' + (existing && existing.category === 'Operations' ? ' selected' : '') + '>Operations</option><option value="Custom"' + (_pipeCatIsCustom || (existing && existing.category === 'Custom') ? ' selected' : '') + '>Custom</option></select></div>';
  html += '<div class="auto-lab-form-field" id="pipelineCustomCat" style="flex:1;' + (_pipeCatIsCustom || (existing && existing.category === 'Custom') ? '' : 'display:none;') + '"><label>Custom Category Name</label>';
  html += '<input type="text" id="pipelineCustomCatInput" placeholder="Enter category name..." value="' + escapeHtml(_pipeCatIsCustom ? existing.category : '') + '"></div>';
  var _pipeCatColor = (existing && existing.categoryColor) || '#6b7280';
  html += '<div class="auto-lab-form-field" id="pipelineCustomCatColor" style="flex:0 0 auto;' + (_pipeCatIsCustom || (existing && existing.category === 'Custom') ? '' : 'display:none;') + '"><label>Color</label>';
  html += '<div class="auto-lab-cat-colors" id="pipelineCatColors">';
  var _pipeCatColorOpts = ['#8b5cf6','#3b82f6','#f59e0b','#ef4444','#22c55e','#ec4899','#06b6d4','#f97316','#a89878','#6b7280'];
  _pipeCatColorOpts.forEach(function(c) { html += '<span class="auto-lab-cat-color-btn' + (c === _pipeCatColor ? ' selected' : '') + '" style="background:' + c + ';" onclick="selectWfCatColor(this,\'' + c + '\')" data-color="' + c + '"></span>'; });
  html += '</div></div>';
  html += '</div>';

  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field"><label>Date</label>';
  html += '<input type="date" id="pipelineDate" value="' + (existing && existing.scheduledDate ? existing.scheduledDate : '') + '"></div>';
  // v23.17: Always show time picker (one-time pipelines need a time too)
  html += '<div class="auto-lab-form-field" id="pipelineTimeWrap"><label>Time</label>';
  html += '<input type="time" id="pipelineTime" value="' + (existing && existing.time ? existing.time : '09:00') + '"></div>';
  html += '<div class="auto-lab-form-field"><label>Recurrence</label>';
  html += '<select id="pipelineRecur" onchange="var cr=document.getElementById(\'pipelineCustomRecur\');if(cr)cr.style.display=this.value===\'custom\'?\'flex\':\'none\';">';
  var rOpts = [['none','One-time'],['as_needed','As Needed (manual)'],['daily','Daily'],['weekly','Weekly'],['monthly','Monthly'],['custom','Custom']];
  rOpts.forEach(function(r) {
    html += '<option value="' + r[0] + '"' + (existing && existing.recurType === r[0] ? ' selected' : '') + '>' + r[1] + '</option>';
  });
  html += '</select></div>';
  html += '</div>';
  // v18.8: Custom recurrence interval/unit
  var showCustom = existing && existing.recurType === 'custom';
  html += '<div id="pipelineCustomRecur" class="auto-lab-form-row" style="display:' + (showCustom ? 'flex' : 'none') + ';gap:12px;">';
  html += '<div class="auto-lab-form-field"><label>Every</label>';
  html += '<input type="number" id="pipelineRecurInterval" min="1" value="' + (existing && existing.recurInterval ? existing.recurInterval : 1) + '" style="width:70px"></div>';
  html += '<div class="auto-lab-form-field"><label>Unit</label>';
  html += '<select id="pipelineRecurUnit">';
  var pUnits = [['minutes','Minutes'],['hours','Hours'],['days','Days'],['weeks','Weeks'],['months','Months']];
  pUnits.forEach(function(u) {
    html += '<option value="' + u[0] + '"' + (existing && existing.recurUnit === u[0] ? ' selected' : '') + '>' + u[1] + '</option>';
  });
  html += '</select></div>';
  html += '</div>';

  // Step cards — v22.47: Undo button next to Steps label
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin:20px 0 8px;">';
  html += '<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);">Steps</div>';
  html += '<button id="pipelineUndoBtn" class="auto-lab-card-btn" onclick="undoPipelineAction()" style="font-size:11px;padding:3px 10px;opacity:0.3;pointer-events:none;" title="Nothing to undo">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:3px;"><path d="M3 10h13a4 4 0 010 8H7"/><polyline points="7 6 3 10 7 14"/></svg>Undo</button>';
  html += '</div>';
  html += '<div class="pipeline-step-list" id="pipelineStepList">';
  for (var i = 0; i < _pipelineSteps.length; i++) {
    if (i > 0) {
      var _pType = PIPELINE_STEP_TYPES[_pipelineSteps[i - 1].action] || PIPELINE_STEP_TYPES.studio;
      var _nType = PIPELINE_STEP_TYPES[_pipelineSteps[i].action] || PIPELINE_STEP_TYPES.studio;
      html += '<div class="pipeline-connector" style="--connector-color-top:' + _pType.color + ';--connector-color-bot:' + _nType.color + ';"></div>';
    }
    html += renderPipelineStepCard(_pipelineSteps[i], i, _pipelineSteps.length);
  }
  html += '</div>';

  // Add Step button
  html += '<div style="text-align:center;margin-top:12px;">';
  html += '<button class="auto-lab-card-btn" onclick="addPipelineStep()" style="padding:8px 20px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M12 5v14M5 12h14"/></svg>';
  html += 'Add Step</button>';
  html += '</div>';

  // v24.20: Compact presets — link to Browse tab + custom presets only
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:20px;">';
  html += '<div style="display:flex;align-items:center;gap:10px;">';
  html += '<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);">Presets</div>';
  html += '<button class="auto-lab-card-btn" onclick="showAutoLabTab(\'browse\')" style="font-size:11px;padding:3px 10px;display:inline-flex;align-items:center;gap:4px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg> Browse Library</button>';
  html += '</div>';
  html += '<button class="auto-lab-card-btn" onclick="saveCurrentAsPreset()" style="font-size:11px;padding:4px 12px;">Save as Preset</button>';
  html += '</div>';
  // Show custom presets inline (user's saved presets only)
  var _customPresets = [];
  try { _customPresets = JSON.parse(localStorage.getItem('roweos_custom_presets') || '[]'); } catch(e) {}
  if (_customPresets.length > 0) {
    html += '<div class="pipeline-presets" style="margin-top:8px;">';
    _customPresets.forEach(function(p) {
      html += '<div class="pipeline-preset-card" onclick="loadPipelinePreset(\'' + escapeHtml(p.id) + '\')">';
      html += '<div class="pipeline-preset-card-name">';
      html += '<span>' + escapeHtml(p.name) + '</span>';
      html += '<span class="pipeline-preset-actions" onclick="event.stopPropagation();">';
      html += '<button onclick="renameCustomPreset(\'' + escapeHtml(p.id) + '\')" title="Rename"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
      html += '<button onclick="deleteCustomPreset(\'' + escapeHtml(p.id) + '\')" title="Delete" style="color:#ef4444;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
      html += '</span>';
      html += '</div>';
      if (p.steps && p.steps.length > 0) {
        html += '<div class="pipeline-preset-card-steps">';
        p.steps.forEach(function(s, si) {
          var st = PIPELINE_STEP_TYPES[s.action];
          var sc = st ? st.color : 'var(--text-muted)';
          var sl = st ? st.label : s.action;
          if (si > 0) html += '<div style="width:8px;height:1.5px;background:' + sc + ';opacity:0.4;"></div>';
          html += '<div title="' + escapeHtml(s.name || sl) + '" style="width:7px;height:7px;border-radius:50%;background:' + sc + ';flex-shrink:0;"></div>';
        });
        html += '<span style="font-size:10px;color:var(--text-muted);margin-left:4px;">' + p.steps.length + ' steps</span>';
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  }

  // Actions
  html += '<div class="auto-lab-form-actions" style="margin-top:24px;">';
  html += '<button class="auto-lab-card-btn" onclick="closePipelineBuilder()">Cancel</button>';
  html += '<button class="auto-lab-card-btn primary" onclick="savePipeline()">Save Pipeline</button>';
  html += '</div>';
  html += '</div>';

  el.innerHTML = html;
  // Populate operation dropdowns for studio steps
  setTimeout(function() {
    for (var s = 0; s < _pipelineSteps.length; s++) {
      if (_pipelineSteps[s].action === 'studio') {
        updatePipelineStepOps(s, _pipelineSteps[s].target.agentId || 'all', _pipelineSteps[s].target.operationId);
      }
    }
  }, 20);
  // Scroll to form
  var form = document.getElementById('pipelineBuilderForm');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPipelineStepCard(step, index, totalSteps) {
  var sType = PIPELINE_STEP_TYPES[step.action] || PIPELINE_STEP_TYPES.studio;
  // v22.46: Draggable step card with step-type color coding
  var html = '<div class="pipeline-step-card" data-step-index="' + index + '" style="border-color:rgba(' + sType.rgb + ',0.35);" draggable="true" ondragstart="onPipelineDragStart(event,' + index + ')" ondragover="onPipelineDragOver(event,' + index + ')" ondragleave="onPipelineDragLeave(event)" ondrop="onPipelineDrop(event,' + index + ')">';
  // Header with drag handle
  html += '<div class="pipeline-step-header">';
  html += '<span class="pipeline-drag-handle" title="Drag to reorder"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></span>';
  html += '<span class="pipeline-step-number" style="background:' + sType.color + ';">' + (index + 1) + '</span>';
  // v22.46: Step type badge — prominent, left-aligned next to step number
  html += '<button class="pipeline-step-type-badge" style="background:' + sType.color + ';" onclick="togglePipelineTypePicker(' + index + ')" title="Change step type">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2">' + sType.icon + '</svg>';
  html += sType.label + '</button>';
  html += '<input type="text" id="pipelineStepName_' + index + '" placeholder="Step name..." value="' + escapeHtml(step.name || '') + '" style="flex:1;">';
  if (totalSteps > 1) {
    html += '<button class="pipeline-step-remove" onclick="event.stopPropagation(); removePipelineStep(' + index + ')" title="Remove step">';
    html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    html += '</button>';
  }
  html += '</div>';

  // v22.46: Hidden step type picker (shown on badge click)
  html += '<div class="pipeline-type-picker" id="pipelineTypePicker_' + index + '" style="display:none;">';
  var typeKeys = Object.keys(PIPELINE_STEP_TYPES);
  for (var ti = 0; ti < typeKeys.length; ti++) {
    var tk = typeKeys[ti];
    var tt = PIPELINE_STEP_TYPES[tk];
    var isSelected = step.action === tk;
    html += '<div class="pipeline-type-card' + (isSelected ? ' selected' : '') + '" style="--pipeline-type-color:' + tt.color + ';--pipeline-type-rgb:' + tt.rgb + ';" onclick="selectPipelineStepType(' + index + ',\'' + tk + '\')">';
    html += '<div class="pipeline-type-dot" style="background:' + tt.color + ';"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2">' + tt.icon + '</svg></div>';
    html += '<div class="pipeline-type-label">' + tt.label + '</div>';
    html += '</div>';
  }
  html += '</div>';

  // Hidden select for data collection (keeps existing collectPipelineStepData working)
  html += '<select id="pipelineStepAction_' + index + '" style="display:none;">';
  typeKeys.forEach(function(tk) {
    html += '<option value="' + tk + '"' + (step.action === tk ? ' selected' : '') + '>' + PIPELINE_STEP_TYPES[tk].label + '</option>';
  });
  html += '</select>';

  // Config area (dynamic based on action)
  html += '<div class="pipeline-step-config">';
  html += renderPipelineStepConfig(step, index);
  html += '</div>';

  // v24.8: Output variable pill — shows as a referenceable output label
  var _outputKey = step.outputKey || 'step' + (index + 1) + '_output';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color);">';
  // Output label
  html += '<div class="pipeline-output-var" data-var="{{' + _outputKey + '}}" onclick="insertPipelineTemplateVar(this)" title="Click to insert reference into a text field" style="cursor:pointer;background:rgba(' + sType.rgb + ',0.12);border-color:rgba(' + sType.rgb + ',0.25);color:' + sType.color + ';"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.7;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Outputs as Step ' + (index + 1) + '</div>';
  // v24.8: Quick-insert previous step reference (if not step 1)
  if (index > 0) {
    // Build dropdown of all previous steps
    html += '<select onchange="quickInsertStepRef(this,' + index + ')" style="font-size:11px;padding:3px 6px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer;">';
    html += '<option value="">Insert ref...</option>';
    for (var _ri = 0; _ri < index; _ri++) {
      var _rLabel = 'Step ' + (_ri + 1) + ' Output';
      var _rSelected = (_ri === index - 1) ? ' style="font-weight:600;"' : '';
      html += '<option value="{{step' + (_ri + 1) + '_output}}"' + _rSelected + '>' + _rLabel + '</option>';
    }
    html += '</select>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

// v18.5: Click template var pill to insert into the nearest text field in the same step
function insertPipelineTemplateVar(el) {
  var varText = el.getAttribute('data-var') || '';
  if (!varText) return;
  // Find the parent step card and its text input/textarea
  var stepCard = el.closest('.pipeline-step-card') || el.parentElement;
  if (stepCard) {
    var textField = stepCard.querySelector('textarea') || stepCard.querySelector('input[type="text"]');
    if (textField) {
      var curVal = textField.value;
      var pos = textField.selectionStart || curVal.length;
      textField.value = curVal.substring(0, pos) + varText + curVal.substring(pos);
      textField.focus();
      textField.setSelectionRange(pos + varText.length, pos + varText.length);
      showToast('Inserted ' + varText, 'success');
      return;
    }
  }
  // Fallback: copy to clipboard
  if (navigator.clipboard) {
    navigator.clipboard.writeText(varText);
    showToast('Copied ' + varText, 'success');
  }
}

// v24.8: Quick-insert step reference from dropdown into the step's first text field
function quickInsertStepRef(selectEl, stepIndex) {
  var varText = selectEl.value;
  if (!varText) return;
  selectEl.value = ''; // reset dropdown
  var stepCard = selectEl.closest('.pipeline-step-card');
  if (stepCard) {
    var textField = stepCard.querySelector('textarea') || stepCard.querySelector('input[type="text"]');
    if (textField) {
      var curVal = textField.value;
      var pos = textField.selectionStart || curVal.length;
      textField.value = curVal.substring(0, pos) + varText + curVal.substring(pos);
      textField.focus();
      textField.setSelectionRange(pos + varText.length, pos + varText.length);
      showToast('Inserted reference', 'success');
      return;
    }
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(varText);
    showToast('Copied ' + varText, 'success');
  }
}

function renderPipelineStepConfig(step, index) {
  var html = '';
  var target = step.target || {};
  // v24.8: Dynamic previous step reference
  var _prevStep = index > 0 ? '{{step' + index + '_output}}' : '';
  var _prevStepLabel = index > 0 ? 'Step ' + index + ' Output' : '';

  if (step.action === 'studio') {
    var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
    var agentList = mode === 'life'
      ? [['all','All'],['planning','Planning'],['development','Development'],['wellness','Wellness'],['finances','Analytics'],['taxes','Taxes'],['travel','Travel'],['creativity','Creativity']]
      : [['all','All'],['strategy','Strategy'],['marketing','Marketing'],['operations','Operations'],['documents','Documents'],['intelligence','Intelligence'],['social','Social Media'],['research','Research']];
    html += '<div class="auto-lab-form-field"><label>Agent</label>';
    html += '<select id="pipelineStepAgent_' + index + '" onchange="updatePipelineStepOps(' + index + ', this.value)">';
    agentList.forEach(function(a) {
      html += '<option value="' + a[0] + '"' + (target.agentId === a[0] ? ' selected' : '') + '>' + a[1] + '</option>';
    });
    html += '</select></div>';
    html += '<div class="auto-lab-form-field"><label>Operation</label>';
    html += '<select id="pipelineStepOp_' + index + '"><option value="">Select...</option></select></div>';
    // v18.1: FEATURE 1 — Context/instructions field for studio steps
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label>Instructions / Context</label>';
    html += '<textarea id="pipelineStepContext_' + index + '" rows="2" placeholder="' + (index > 0 ? 'Instructions or reference ' + _prevStepLabel + '...' : 'Instructions for this step...') + '" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.contextRef || '') + '</textarea></div>';
    // v18.1: FEATURE 4 — Per-step API/model selection for studio steps
    var studioProvOpts = [['','Brand Default'],['anthropic','Anthropic'],['openai','OpenAI'],['google','Gemini']];
    var stepProv = (step.config && step.config.provider) ? step.config.provider : '';
    html += '<div class="auto-lab-form-field"><label>API Provider</label>';
    html += '<select id="pipelineStepProvider_' + index + '" onchange="updatePipelineStepModelOptions(' + index + ', this.value)">';
    studioProvOpts.forEach(function(po) { html += '<option value="' + po[0] + '"' + (stepProv === po[0] ? ' selected' : '') + '>' + po[1] + '</option>'; });
    html += '</select></div>';
    // v18.7: Model selection dropdown — populated from providerConfigs
    var stepModel = (step.config && step.config.model) ? step.config.model : '';
    html += '<div class="auto-lab-form-field" id="pipelineStepModelWrap_' + index + '" style="' + (stepProv ? '' : 'display:none;') + '"><label>Model</label>';
    html += '<select id="pipelineStepModel_' + index + '">';
    if (stepProv && typeof providerConfigs !== 'undefined' && providerConfigs[stepProv]) {
      providerConfigs[stepProv].models.forEach(function(m) { html += '<option value="' + m.id + '"' + (stepModel === m.id ? ' selected' : '') + '>' + m.name + '</option>'; });
    }
    html += '</select></div>';
    // v18.7: Output length dropdown
    var stepLength = (step.config && step.config.length) ? step.config.length : 'standard';
    html += '<div class="auto-lab-form-field"><label>Output Length</label>';
    html += '<select id="pipelineStepLength_' + index + '">';
    var lengthOpts = [['standard','Standard'],['brief','Brief'],['comprehensive','Comprehensive'],['social-100','Social (100 chars)'],['social-250','Social (250 chars)'],['social-500','Social (500 chars)']];
    lengthOpts.forEach(function(lo) { html += '<option value="' + lo[0] + '"' + (stepLength === lo[0] ? ' selected' : '') + '>' + lo[1] + '</option>'; });
    html += '</select></div>';
    // v22.9: Deep Research toggle for pipeline studio steps
    var stepDR = step.config && step.config.useDeepResearch;
    var showDR = stepProv === 'google' && stepModel && stepModel.indexOf('gemini-3') !== -1;
    html += '<div class="auto-lab-form-field" id="pipelineStepDRToggle_' + index + '" style="flex-basis:100%;' + (showDR ? '' : 'display:none;') + '">';
    html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">';
    html += '<input type="checkbox" id="pipelineStepDeepResearch_' + index + '"' + (stepDR ? ' checked' : '') + ' style="accent-color:#a78bfa;">';
    html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#a78bfa" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>';
    html += ' Use Deep Research (Gemini)</label></div>';
  } else if (step.action === 'image') {
    html += '<div class="auto-lab-form-field" style="flex:2;"><label>Image Prompt</label>';
    html += '<input type="text" id="pipelineStepText_' + index + '" placeholder="' + (index > 0 ? 'Describe image or use ' + _prevStepLabel + '...' : 'Describe the image to generate...') + '" value="' + escapeHtml(target.text || '') + '"></div>';
    // v18.1: FEATURE 4 — Per-step image provider selection
    var imgProvOpts = [['','Default (Nano Banana 3.0)'],['nanobanana','Nano Banana 3.0'],['nanobanana_pro','Nano Banana 3.0 Pro'],['gemini','Gemini 2.0 Flash'],['dalle','DALL-E']];
    var imgProv = (step.config && step.config.provider) ? step.config.provider : '';
    html += '<div class="auto-lab-form-field"><label>Image Provider</label>';
    html += '<select id="pipelineStepImgProvider_' + index + '" onchange="updatePipelineStepImageModelOptions(' + index + ', this.value)">';
    imgProvOpts.forEach(function(po) { html += '<option value="' + po[0] + '"' + (imgProv === po[0] ? ' selected' : '') + '>' + po[1] + '</option>'; });
    html += '</select></div>';
    // v18.7: Image sub-model dropdown — only for providers with multiple models
    var imgModel = (step.config && step.config.imageModel) ? step.config.imageModel : '';
    var imgModelProviders = { gemini: [['gemini-2.0-flash-preview-image-generation','Gemini 2.0 Flash'],['imagen-3.0-generate-002','Imagen 4']], dalle: [['dall-e-3','DALL-E 3'],['dall-e-2','DALL-E 2']] };
    var showImgModel = imgProv && imgModelProviders[imgProv];
    html += '<div class="auto-lab-form-field" id="pipelineStepImgModelWrap_' + index + '" style="' + (showImgModel ? '' : 'display:none;') + '"><label>Image Model</label>';
    html += '<select id="pipelineStepImgModel_' + index + '">';
    if (showImgModel) { imgModelProviders[imgProv].forEach(function(m) { html += '<option value="' + m[0] + '"' + (imgModel === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }); }
    html += '</select></div>';
    // v18.1: FEATURE 5 — Reference image upload
    html += '<div class="auto-lab-form-field"><label>Reference Image</label>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<input type="file" accept="image/*" onchange="handlePipelineRefImageUpload(' + index + ', this)" style="font-size:12px;color:var(--text-secondary);">';
    var hasRef = step.config && step.config.referenceImage;
    html += '<span id="pipelineRefImgStatus_' + index + '" style="font-size:11px;color:' + (hasRef ? 'var(--accent)' : 'var(--text-muted)') + ';">' + (hasRef ? 'Attached' : '') + '</span>';
    html += '</div></div>';
  } else if (step.action === 'video') {
    // v21.15: Video generation pipeline step config
    html += '<div class="auto-lab-form-field" style="flex:2;"><label>Video Prompt</label>';
    html += '<input type="text" id="pipelineStepText_' + index + '" placeholder="' + (index > 0 ? 'Describe video or use ' + _prevStepLabel + '...' : 'Describe the video to generate...') + '" value="' + escapeHtml(target.text || '') + '"></div>';
    var vidModels = [['veo-3.1-fast-generate-preview','Veo 3.1 Fast'],['veo-3.1-generate-preview','Veo 3.1'],['veo-3-fast-generate-preview','Veo 3 Fast'],['veo-3-generate-preview','Veo 3'],['veo-2-generate-preview','Veo 2']];
    var vidModel = (step.config && step.config.videoModel) ? step.config.videoModel : 'veo-3.1-fast-generate-preview';
    html += '<div class="auto-lab-form-field"><label>Model</label>';
    html += '<select id="pipelineStepVideoModel_' + index + '">';
    vidModels.forEach(function(m) { html += '<option value="' + m[0] + '"' + (vidModel === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; });
    html += '</select></div>';
    var vidDur = (step.config && step.config.videoDuration) ? step.config.videoDuration : '8';
    html += '<div class="auto-lab-form-field"><label>Duration</label>';
    html += '<select id="pipelineStepVideoDuration_' + index + '">';
    [['4','4s'],['6','6s'],['8','8s']].forEach(function(d) { html += '<option value="' + d[0] + '"' + (vidDur === d[0] ? ' selected' : '') + '>' + d[1] + '</option>'; });
    html += '</select></div>';
    var vidAspect = (step.config && step.config.videoAspect) ? step.config.videoAspect : '16:9';
    html += '<div class="auto-lab-form-field"><label>Aspect</label>';
    html += '<select id="pipelineStepVideoAspect_' + index + '">';
    [['16:9','16:9 Landscape'],['9:16','9:16 Portrait']].forEach(function(a) { html += '<option value="' + a[0] + '"' + (vidAspect === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; });
    html += '</select></div>';
    // Reference image for image-to-video
    html += '<div class="auto-lab-form-field"><label>Reference Image</label>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<input type="file" accept="image/*" onchange="handlePipelineRefImageUpload(' + index + ', this)" style="font-size:12px;color:var(--text-secondary);">';
    var hasVidRef = step.config && step.config.referenceImage;
    html += '<span id="pipelineRefImgStatus_' + index + '" style="font-size:11px;color:' + (hasVidRef ? 'var(--accent)' : 'var(--text-muted)') + ';">' + (hasVidRef ? 'Attached' : 'Optional: image-to-video') + '</span>';
    html += '</div></div>';
  } else if (step.action === 'infographic') {
    // v23.8: Infographic pipeline step config
    html += '<div class="auto-lab-form-field" style="flex:2;"><label>Topic / Prompt</label>';
    html += '<input type="text" id="pipelineStepText_' + index + '" placeholder="' + (index > 0 ? 'Topic or use ' + _prevStepLabel + '...' : 'Infographic topic...') + '" value="' + escapeHtml(target.text || '') + '"></div>';
    var infProvOpts = [['','Brand Default'],['anthropic','Anthropic'],['openai','OpenAI'],['google','Gemini']];
    var infProv = (step.config && step.config.provider) ? step.config.provider : '';
    html += '<div class="auto-lab-form-field"><label>API Provider</label>';
    html += '<select id="pipelineStepInfProvider_' + index + '">';
    infProvOpts.forEach(function(po) { html += '<option value="' + po[0] + '"' + (infProv === po[0] ? ' selected' : '') + '>' + po[1] + '</option>'; });
    html += '</select></div>';
  } else if (step.action === 'post') {
    // Platform checkboxes inline
    html += '<div class="auto-lab-form-field"><label>Platforms</label>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">';
    var platNames = { x: 'X', threads: 'Threads', instagram: 'Instagram', tiktok: 'TikTok' };
    var selPlats = target.platforms || [];
    ['x', 'threads', 'instagram', 'tiktok'].forEach(function(p) {
      var checked = selPlats.indexOf(p) > -1;
      var connected = typeof isSocialConnected === 'function' && isSocialConnected(p);
      var handle = typeof getSocialHandle === 'function' ? getSocialHandle(p) : '';
      html += '<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary);cursor:pointer;padding:4px 8px;border:1px solid var(--border-color);border-radius:6px;' + (!connected ? 'opacity:0.4;' : '') + '">';
      html += '<input type="checkbox" class="pipelineStepPlat_' + index + '" value="' + p + '"' + (checked ? ' checked' : '') + '> ';
      html += platNames[p];
      if (connected && handle) html += ' <span style="color:var(--text-muted);font-size:10px;">@' + escapeHtml(handle) + '</span>';
      html += '</label>';
    });
    html += '</div></div>';
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label>Social Media Caption</label>';
    html += '<textarea id="pipelineStepText_' + index + '" rows="3" placeholder="' + (index > 0 ? 'Caption text or use ' + _prevStepLabel + '...' : 'Enter caption text...') + '" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.contentRef || target.text || '') + '</textarea></div>';
    // v18.2: Upload image for post step
    html += '<div class="auto-lab-form-field"><label>Image to Post</label>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<input type="file" accept="image/*" onchange="handlePipelinePostImageUpload(' + index + ', this)" style="font-size:12px;color:var(--text-secondary);">';
    var hasPostImg = (step.config && step.config.uploadedImage) || (step.config && step.config._hasReferenceImage) || (step.config && step.config._hasUserImage) || (step.target && step.target._hasUploadedImage) || (step.target && step.target.uploadedImage);
    html += '<span id="pipelinePostImgStatus_' + index + '" style="font-size:11px;color:' + (hasPostImg ? 'var(--accent)' : 'var(--text-muted)') + ';">' + (hasPostImg ? 'Image attached' : 'Optional, or auto-detects from previous steps') + '</span>';
    html += '</div></div>';
  } else if (step.action === 'email') {
    // v22.9: Email template type selector
    var emailTemplateVal = (step.config && step.config.emailTemplate) ? step.config.emailTemplate : 'professional';
    html += '<div class="auto-lab-form-field"><label>Email Template</label>';
    html += '<select id="pipelineStepEmailTemplate_' + index + '">';
    var emailTemplateOpts = [['professional','Professional'],['minimal','Minimal'],['bold','Bold'],['newsletter','Newsletter'],['ai_custom','AI Custom'],['plain','Plain Text']];
    emailTemplateOpts.forEach(function(t) { html += '<option value="' + t[0] + '"' + (emailTemplateVal === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; });
    html += '</select></div>';
    // v22.8: Send Email pipeline step
    var emailFrom = (step.config && step.config.emailFrom) ? step.config.emailFrom : getDefaultFromAddress();
    var emailFromCustom = (step.config && step.config.emailFromCustom) ? step.config.emailFromCustom : '';
    html += '<div class="auto-lab-form-field"><label>From</label>';
    html += '<select id="pipelineStepEmailFrom_' + index + '" onchange="var c=document.getElementById(\'pipelineStepEmailFromCustom_' + index + '\');if(c)c.parentElement.style.display=this.value===\'custom\'?\'block\':\'none\';">';
    html += buildFromOptionsHtml(emailFrom);
    var _knownPipeFrom = buildFromOptionsHtml(emailFrom).indexOf('value="' + (emailFrom || '').replace(/"/g, '') + '"') !== -1;
    html += '<option value="custom"' + (!_knownPipeFrom && emailFrom ? ' selected' : '') + '>Custom...</option>';
    html += '</select></div>';
    html += '<div class="auto-lab-form-field" style="' + (!_knownPipeFrom && emailFrom ? '' : 'display:none;') + '"><label>Custom From Email</label>';
    html += '<input type="email" id="pipelineStepEmailFromCustom_' + index + '" placeholder="name@yourdomain.com" value="' + escapeHtml(!_knownPipeFrom && emailFrom ? emailFrom : emailFromCustom) + '"></div>';
    // v23.17: Add address book button and autocomplete to pipeline email fields
    html += '<div class="auto-lab-form-field" style="flex:2;position:relative;"><label>To (recipient email)';
    html += ' <button type="button" onclick="if(typeof mailOpenAddressBook===\'function\')mailOpenAddressBook(\'pipelineTo_' + index + '\')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:2px;vertical-align:middle;" title="Address Book"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></button>';
    html += '</label>';
    html += '<input type="text" id="pipelineStepEmailTo_' + index + '" placeholder="recipient@example.com" value="' + escapeHtml(target.emailTo || '') + '" oninput="if(typeof mailShowContactSuggestions===\'function\')mailShowContactSuggestions(this,\'pipelineTo_' + index + '\')" onfocus="if(typeof mailShowContactSuggestions===\'function\')mailShowContactSuggestions(this,\'pipelineTo_' + index + '\')" autocomplete="off"></div>';
    html += '<div class="auto-lab-form-field" style="position:relative;"><label>CC</label>';
    html += '<input type="text" id="pipelineStepEmailCc_' + index + '" placeholder="Optional CC emails" value="' + escapeHtml(target.emailCc || '') + '" oninput="if(typeof mailShowContactSuggestions===\'function\')mailShowContactSuggestions(this,\'pipelineCc_' + index + '\')" onfocus="if(typeof mailShowContactSuggestions===\'function\')mailShowContactSuggestions(this,\'pipelineCc_' + index + '\')" autocomplete="off"></div>';
    html += '<div class="auto-lab-form-field" style="position:relative;"><label>BCC</label>';
    html += '<input type="text" id="pipelineStepEmailBcc_' + index + '" placeholder="Optional BCC emails" value="' + escapeHtml(target.emailBcc || '') + '" oninput="if(typeof mailShowContactSuggestions===\'function\')mailShowContactSuggestions(this,\'pipelineBcc_' + index + '\')" onfocus="if(typeof mailShowContactSuggestions===\'function\')mailShowContactSuggestions(this,\'pipelineBcc_' + index + '\')" autocomplete="off"></div>';
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label>Subject</label>';
    html += '<input type="text" id="pipelineStepEmailSubject_' + index + '" placeholder="' + (index > 0 ? 'Subject line or reference ' + _prevStepLabel : 'Email subject line') + '" value="' + escapeHtml(target.emailSubject || '') + '"></div>';
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label>Body</label>';
    html += '<textarea id="pipelineStepEmailBody_' + index + '" rows="4" placeholder="' + (index > 0 ? 'Email body or use ' + _prevStepLabel + ' to include previous step...' : 'Email body text...') + '" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.emailBody || '') + '</textarea></div>';
    var incPrev = step.config && step.config.includeStepOutput;
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">';
    html += '<input type="checkbox" id="pipelineStepEmailInclude_' + index + '"' + (incPrev ? ' checked' : '') + '> Include previous step output in email body</label></div>';
    // v22.23: BCC yourself checkbox
    var bccSelf = step.config && step.config.bccSelf;
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">';
    html += '<input type="checkbox" id="pipelineStepEmailBccSelf_' + index + '"' + (bccSelf ? ' checked' : '') + '> BCC yourself (auto-adds From address to BCC)</label></div>';
    // v22.23: Queue to Outbox toggle
    var queueToOutbox = step.config && step.config.queueToOutbox;
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">';
    html += '<input type="checkbox" id="pipelineStepEmailQueue_' + index + '"' + (queueToOutbox ? ' checked' : '') + '> Queue to Mail Outbox for review (instead of auto-sending)</label></div>';
    // v23.11: Logo toggle + alignment
    var showLogo = step.config && step.config.includeLogo !== false;
    var logoAlign = (step.config && step.config.logoAlignment) || 'center';
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">';
    html += '<input type="checkbox" id="pipelineStepEmailLogo_' + index + '"' + (showLogo ? ' checked' : '') + ' onchange="pipelineEmailLogoPreview(' + index + ')">';
    html += ' Include brand logo in email header</label></div>';
    html += '<div class="auto-lab-form-field" id="pipelineStepLogoAlignWrap_' + index + '" style="' + (showLogo ? '' : 'display:none;') + '">';
    html += '<label>Logo Alignment</label>';
    html += '<select id="pipelineStepLogoAlign_' + index + '" onchange="pipelineEmailLogoPreview(' + index + ')">';
    [['left','Left'],['center','Center'],['right','Right']].forEach(function(a) { html += '<option value="' + a[0] + '"' + (logoAlign === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; });
    html += '</select></div>';
    // v23.11: Template header preview
    html += '<div id="pipelineEmailHeaderPreview_' + index + '" style="flex-basis:100%;margin-top:4px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;min-height:40px;text-align:' + logoAlign + ';">';
    if (showLogo) {
      var _prevBidx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
      var _prevLogo = '';
      try { _prevLogo = localStorage.getItem(getCurrentLogoKey(_prevBidx)) || ''; } catch(e) {}
      if (!_prevLogo) { var _pb = (typeof brands !== 'undefined' && brands[_prevBidx]) ? brands[_prevBidx] : null; if (_pb) _prevLogo = _pb.logo || _pb.brandLogo || ''; }
      if (_prevLogo) html += '<img src="' + _prevLogo + '" alt="Logo" style="max-height:40px;max-width:120px;">';
      else html += '<span style="font-size:11px;color:var(--text-muted);">No logo set</span>';
    }
    html += '</div>';
  } else if (step.action === 'research') {
    // v22.8: Deep Research pipeline step
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label>Research Query</label>';
    html += '<textarea id="pipelineStepResearchQuery_' + index + '" rows="3" placeholder="' + (index > 0 ? 'What should be researched? Can reference ' + _prevStepLabel + '...' : 'What should be researched?') + '" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.researchQuery || '') + '</textarea></div>';
    var brandCtx = step.config && step.config.includeBrandContext !== false;
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">';
    html += '<input type="checkbox" id="pipelineStepResearchBrandCtx_' + index + '"' + (brandCtx ? ' checked' : '') + '> Include brand/profile context for relevance</label></div>';
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label>Research Instructions (added to query)</label>';
    html += '<textarea id="pipelineStepResearchCtx_' + index + '" rows="2" placeholder="' + (index > 0 ? 'Detailed research instructions. Can reference ' + _prevStepLabel + '...' : 'Detailed research instructions (merged into the research query)...') + '" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.contextRef || '') + '</textarea></div>';
    html += '<div style="font-size:11px;color:var(--text-muted);padding:4px 0;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Deep Research uses Gemini to conduct comprehensive research. May take 1-5 minutes to complete.</div>';
  } else if (step.action === 'outbox') {
    // v22.24: Queue to Outbox pipeline step — auto-extracts emails from previous steps
    html += '<div class="auto-lab-form-field" style="flex:2;"><label>To (recipient email)</label>';
    html += '<input type="email" id="pipelineStepOutboxTo_' + index + '" placeholder="Auto-extracted from previous steps, or enter manually" value="' + escapeHtml(target.emailTo || '') + '"></div>';
    html += '<div style="font-size:11px;color:var(--text-muted);padding:0 0 8px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Leave empty to auto-detect email addresses from previous step output (e.g. from Deep Research)</div>';
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label>Subject</label>';
    html += '<input type="text" id="pipelineStepOutboxSubject_' + index + '" placeholder="' + (index > 0 ? 'Subject line or reference ' + _prevStepLabel : 'Email subject line') + '" value="' + escapeHtml(target.emailSubject || '') + '"></div>';
    var outboxTemplate = (step.config && step.config.emailTemplate) ? step.config.emailTemplate : 'professional';
    html += '<div class="auto-lab-form-field"><label>Email Template</label>';
    html += '<select id="pipelineStepOutboxTemplate_' + index + '">';
    var outboxTemplateOpts = [['professional','Professional'],['minimal','Minimal'],['bold','Bold'],['newsletter','Newsletter'],['plain','Plain Text']];
    outboxTemplateOpts.forEach(function(t) { html += '<option value="' + t[0] + '"' + (outboxTemplate === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; });
    html += '</select></div>';
    // v22.26: Use default from address, include Gmail/Outlook connected accounts
    var _obMailCfg = {};
    try { _obMailCfg = JSON.parse(localStorage.getItem('roweos_mail_config') || '{}'); } catch(e) {}
    var outboxFrom = (step.config && step.config.emailFrom) ? step.config.emailFrom : (_obMailCfg.defaultFromAddress || getDefaultFromAddress());
    html += '<div class="auto-lab-form-field"><label>From</label>';
    html += '<select id="pipelineStepOutboxFrom_' + index + '">';
    html += buildFromOptionsHtml(outboxFrom);
    html += '</select></div>';
    var outboxBccSelf = step.config && step.config.bccSelf;
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">';
    html += '<input type="checkbox" id="pipelineStepOutboxBccSelf_' + index + '"' + (outboxBccSelf ? ' checked' : '') + '> BCC yourself</label></div>';
    // v22.44: Outbox folder selector
    var _obFolders = [];
    try { _obFolders = JSON.parse(localStorage.getItem('roweos_mail_outbox_folders') || '[]'); } catch(e) {}
    var outboxFolder = (step.config && step.config.outboxFolder) || '';
    html += '<div class="auto-lab-form-field"><label>Outbox Folder</label>';
    html += '<select id="pipelineStepOutboxFolder_' + index + '">';
    html += '<option value=""' + (!outboxFolder ? ' selected' : '') + '>None (unfiled)</option>';
    _obFolders.forEach(function(f) { html += '<option value="' + escapeHtml(f) + '"' + (outboxFolder === f ? ' selected' : '') + '>' + escapeHtml(f) + '</option>'; });
    html += '</select></div>';
  } else if (step.action === 'pdf_generate') {
    // v22.31: PDF generation step config
    var pdfSourceStep = (step.config && step.config.sourceStep) || '';
    var pdfTitle = (step.config && step.config.pdfTitle) || '';
    var pdfOrient = (step.config && step.config.orientation) || 'portrait';
    html += '<div class="auto-lab-form-field" style="flex:1;"><label>Source Step Key</label>';
    html += '<input type="text" id="pipelineStepPdfSource_' + index + '" placeholder="' + (index > 0 ? 'step' + index + '_output' : 'step1_output') + '" value="' + escapeHtml(pdfSourceStep) + '"></div>';
    html += '<div class="auto-lab-form-field" style="flex:1;"><label>PDF Title</label>';
    html += '<input type="text" id="pipelineStepPdfTitle_' + index + '" placeholder="RoweOS Pitch" value="' + escapeHtml(pdfTitle) + '"></div>';
    html += '<div class="auto-lab-form-field" style="flex:1;"><label>Orientation</label>';
    html += '<select id="pipelineStepPdfOrient_' + index + '">';
    html += '<option value="portrait"' + (pdfOrient === 'portrait' ? ' selected' : '') + '>Portrait</option>';
    html += '<option value="landscape"' + (pdfOrient === 'landscape' ? ' selected' : '') + '>Landscape</option>';
    html += '</select></div>';
  } else if (step.action === 'library') {
    html += '<div class="auto-lab-form-field" style="flex:2;"><label>Content (or template var)</label>';
    html += '<input type="text" id="pipelineStepText_' + index + '" placeholder="' + (index > 0 ? _prevStepLabel : 'Content or template variable') + '" value="' + escapeHtml(target.text || target.contentRef || '') + '"></div>';
  } else if (step.action === 'reminder') {
    // v24.25: Interactive reminder pipeline step
    html += '<div class="auto-lab-form-field" style="flex:2;"><label>Reminder Title</label>';
    html += '<input type="text" id="pipelineStepReminderTitle_' + index + '" placeholder="e.g. Follow up with client" value="' + escapeHtml(target.reminderTitle || '') + '"></div>';
    html += '<div class="auto-lab-form-field" style="flex-basis:100%;"><label>Reminder Message</label>';
    html += '<textarea id="pipelineStepText_' + index + '" rows="2" placeholder="Details for this reminder..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:13px;resize:vertical;">' + escapeHtml(target.text || '') + '</textarea></div>';
    // Action button config
    var actionLabel = (step.config && step.config.actionLabel) ? step.config.actionLabel : '';
    var actionView = (step.config && step.config.actionView) ? step.config.actionView : '';
    html += '<div class="auto-lab-form-field"><label>Action Button Label</label>';
    html += '<input type="text" id="pipelineStepReminderAction_' + index + '" placeholder="e.g. Open Chat, View Tasks (optional)" value="' + escapeHtml(actionLabel) + '"></div>';
    html += '<div class="auto-lab-form-field"><label>Navigate To</label>';
    html += '<select id="pipelineStepReminderView_' + index + '">';
    html += '<option value=""' + (!actionView ? ' selected' : '') + '>None (dismiss only)</option>';
    [['agent','Chat'],['signal','Focus'],['pulse','Pulse'],['studio','Studio'],['rhythm','Automations'],['library','Library'],['memory','Identity'],['tuning','Memory'],['settings','Settings'],['inventory','Inventory'],['clients','Clients'],['commerce','Analytics'],['mail','Mail']].forEach(function(v) {
      html += '<option value="' + v[0] + '"' + (actionView === v[0] ? ' selected' : '') + '>' + v[1] + '</option>';
    });
    html += '</select></div>';
  } else if (step.action === 'notify') {
    html += '<div class="auto-lab-form-field" style="flex:2;"><label>Notification text</label>';
    html += '<input type="text" id="pipelineStepText_' + index + '" placeholder="Pipeline complete!" value="' + escapeHtml(target.text || '') + '"></div>';
  } else if (step.action === 'pulse') {
    // v24.9: Goal selector + instructions for pulse pipeline step
    html += '<div class="auto-lab-form-field" style="flex:1;"><label>Goal</label>';
    html += '<select id="pipelineStepGoal_' + index + '"><option value="">Select goal...</option>';
    (typeof pulseGoals !== 'undefined' ? pulseGoals : []).forEach(function(g) {
      if (!g.completed && !g.archived) html += '<option value="' + g.id + '"' + (target.goalId === String(g.id) ? ' selected' : '') + '>' + escapeHtml(g.title) + '</option>';
    });
    html += '</select></div>';
    html += '<div class="auto-lab-form-field" style="flex:2;"><label>Instructions / Context</label>';
    html += '<input type="text" id="pipelineStepContext_' + index + '" placeholder="What should the AI do with this goal?" value="' + escapeHtml(target.contextRef || '') + '"></div>';
  }
  // v22.47: Per-step "Require Approval" toggle — pauses pipeline for review before continuing
  var _reqApproval = step.config && step.config.requireApproval;
  html += '<div class="auto-lab-form-field" style="flex-basis:100%;margin-top:4px;border-top:1px solid var(--border-color);padding-top:8px;">';
  html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">';
  html += '<input type="checkbox" id="pipelineStepApproval_' + index + '"' + (_reqApproval ? ' checked' : '') + ' style="accent-color:#f59e0b;">';
  html += '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
  html += ' Require approval before continuing to next step</label></div>';
  return html;
}

// v18.1: FEATURE 2 — Collect ALL DOM field data back into _pipelineSteps before re-render
function collectPipelineStepData() {
  for (var i = 0; i < _pipelineSteps.length; i++) {
    var nameEl = document.getElementById('pipelineStepName_' + i);
    if (nameEl) _pipelineSteps[i].name = nameEl.value;
    var actionEl = document.getElementById('pipelineStepAction_' + i);
    if (actionEl) _pipelineSteps[i].action = actionEl.value;
    if (!_pipelineSteps[i].target) _pipelineSteps[i].target = {};
    if (_pipelineSteps[i].action === 'studio') {
      var agentEl = document.getElementById('pipelineStepAgent_' + i);
      if (agentEl) _pipelineSteps[i].target.agentId = agentEl.value;
      var opEl = document.getElementById('pipelineStepOp_' + i);
      if (opEl) _pipelineSteps[i].target.operationId = opEl.value;
      var ctxEl = document.getElementById('pipelineStepContext_' + i);
      if (ctxEl) _pipelineSteps[i].target.contextRef = ctxEl.value;
      var provEl = document.getElementById('pipelineStepProvider_' + i);
      if (provEl) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.provider = provEl.value; }
      // v18.7: Read model + length
      var modelEl = document.getElementById('pipelineStepModel_' + i);
      if (modelEl && modelEl.value) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.model = modelEl.value; }
      var lenEl = document.getElementById('pipelineStepLength_' + i);
      if (lenEl) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.length = lenEl.value; }
      // v22.9: Read Deep Research toggle
      var drEl = document.getElementById('pipelineStepDeepResearch_' + i);
      if (drEl) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.useDeepResearch = drEl.checked; }
    } else if (_pipelineSteps[i].action === 'post') {
      var platChecks = document.querySelectorAll('.pipelineStepPlat_' + i + ':checked');
      var plats = [];
      platChecks.forEach(function(cb) { plats.push(cb.value); });
      _pipelineSteps[i].target.platforms = plats;
      var textEl = document.getElementById('pipelineStepText_' + i);
      if (textEl) _pipelineSteps[i].target.contentRef = textEl.value;
      // v24.18: Preserve uploaded image from config (set by handlePipelinePostImageUpload)
      if (_pipelineSteps[i].config && _pipelineSteps[i].config.uploadedImage) {
        _pipelineSteps[i].target.uploadedImage = _pipelineSteps[i].config.uploadedImage;
      }
    } else if (_pipelineSteps[i].action === 'image') {
      var imgTextEl = document.getElementById('pipelineStepText_' + i);
      if (imgTextEl) _pipelineSteps[i].target.text = imgTextEl.value;
      var imgProvEl = document.getElementById('pipelineStepImgProvider_' + i);
      if (imgProvEl) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.provider = imgProvEl.value; }
      // v18.7: Read image sub-model
      var imgModelEl = document.getElementById('pipelineStepImgModel_' + i);
      if (imgModelEl && imgModelEl.value) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.imageModel = imgModelEl.value; }
    } else if (_pipelineSteps[i].action === 'infographic') {
      // v23.8: Collect infographic step data
      var infTextEl = document.getElementById('pipelineStepText_' + i);
      if (infTextEl) _pipelineSteps[i].target.text = infTextEl.value;
      var infProvEl = document.getElementById('pipelineStepInfProvider_' + i);
      if (infProvEl) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.provider = infProvEl.value; }
    } else if (_pipelineSteps[i].action === 'email') {
      // v22.9: Collect email template
      var emailTemplateEl = document.getElementById('pipelineStepEmailTemplate_' + i);
      if (emailTemplateEl) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.emailTemplate = emailTemplateEl.value; }
      // v22.8: Collect email step data
      var emailFromEl = document.getElementById('pipelineStepEmailFrom_' + i);
      var emailFromCustomEl = document.getElementById('pipelineStepEmailFromCustom_' + i);
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      if (emailFromEl) {
        if (emailFromEl.value === 'custom' && emailFromCustomEl && emailFromCustomEl.value.trim()) {
          _pipelineSteps[i].config.emailFrom = emailFromCustomEl.value.trim();
          _pipelineSteps[i].config.emailFromCustom = emailFromCustomEl.value.trim();
        } else {
          _pipelineSteps[i].config.emailFrom = emailFromEl.value;
        }
      }
      var emailToEl = document.getElementById('pipelineStepEmailTo_' + i);
      if (emailToEl) _pipelineSteps[i].target.emailTo = emailToEl.value.trim();
      var emailCcEl = document.getElementById('pipelineStepEmailCc_' + i);
      if (emailCcEl) _pipelineSteps[i].target.emailCc = emailCcEl.value.trim();
      var emailBccEl = document.getElementById('pipelineStepEmailBcc_' + i);
      if (emailBccEl) _pipelineSteps[i].target.emailBcc = emailBccEl.value.trim();
      var emailSubEl = document.getElementById('pipelineStepEmailSubject_' + i);
      if (emailSubEl) _pipelineSteps[i].target.emailSubject = emailSubEl.value.trim();
      var emailBodyEl = document.getElementById('pipelineStepEmailBody_' + i);
      if (emailBodyEl) _pipelineSteps[i].target.emailBody = emailBodyEl.value;
      var emailIncEl = document.getElementById('pipelineStepEmailInclude_' + i);
      if (emailIncEl) _pipelineSteps[i].config.includeStepOutput = emailIncEl.checked;
      // v22.23: BCC self + Queue to Outbox
      var emailBccSelfEl = document.getElementById('pipelineStepEmailBccSelf_' + i);
      if (emailBccSelfEl) _pipelineSteps[i].config.bccSelf = emailBccSelfEl.checked;
      var emailQueueEl = document.getElementById('pipelineStepEmailQueue_' + i);
      if (emailQueueEl) _pipelineSteps[i].config.queueToOutbox = emailQueueEl.checked;
      // v23.11: Logo toggle + alignment
      var emailLogoEl = document.getElementById('pipelineStepEmailLogo_' + i);
      if (emailLogoEl) _pipelineSteps[i].config.includeLogo = emailLogoEl.checked;
      var emailLogoAlignEl = document.getElementById('pipelineStepLogoAlign_' + i);
      if (emailLogoAlignEl) _pipelineSteps[i].config.logoAlignment = emailLogoAlignEl.value;
    } else if (_pipelineSteps[i].action === 'outbox') {
      // v22.24: Collect outbox step data
      var outboxToEl = document.getElementById('pipelineStepOutboxTo_' + i);
      if (outboxToEl) _pipelineSteps[i].target.emailTo = outboxToEl.value.trim();
      var outboxSubEl = document.getElementById('pipelineStepOutboxSubject_' + i);
      if (outboxSubEl) _pipelineSteps[i].target.emailSubject = outboxSubEl.value.trim();
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      var outboxTemplateEl = document.getElementById('pipelineStepOutboxTemplate_' + i);
      if (outboxTemplateEl) _pipelineSteps[i].config.emailTemplate = outboxTemplateEl.value;
      var outboxFromEl = document.getElementById('pipelineStepOutboxFrom_' + i);
      if (outboxFromEl) _pipelineSteps[i].config.emailFrom = outboxFromEl.value;
      var outboxBccSelfEl = document.getElementById('pipelineStepOutboxBccSelf_' + i);
      if (outboxBccSelfEl) _pipelineSteps[i].config.bccSelf = outboxBccSelfEl.checked;
      var outboxFolderEl = document.getElementById('pipelineStepOutboxFolder_' + i);
      if (outboxFolderEl) _pipelineSteps[i].config.outboxFolder = outboxFolderEl.value;
    } else if (_pipelineSteps[i].action === 'batch_email') {
      // v22.28: Collect batch email step data
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      var batchFromEl = document.getElementById('autoLabWfBatchFrom');
      if (batchFromEl) _pipelineSteps[i].config.emailFrom = batchFromEl.value;
      var batchTemplateEl = document.getElementById('autoLabWfBatchTemplate');
      if (batchTemplateEl) _pipelineSteps[i].config.emailTemplate = batchTemplateEl.value;
    } else if (_pipelineSteps[i].action === 'pdf_generate') {
      // v22.31: Collect PDF step data
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      var pdfSrcEl = document.getElementById('pipelineStepPdfSource_' + i);
      if (pdfSrcEl) _pipelineSteps[i].config.sourceStep = pdfSrcEl.value.trim();
      var pdfTitleEl = document.getElementById('pipelineStepPdfTitle_' + i);
      if (pdfTitleEl) _pipelineSteps[i].config.pdfTitle = pdfTitleEl.value.trim();
      var pdfOrientEl = document.getElementById('pipelineStepPdfOrient_' + i);
      if (pdfOrientEl) _pipelineSteps[i].config.orientation = pdfOrientEl.value;
    } else if (_pipelineSteps[i].action === 'research') {
      // v22.8: Collect research step data
      var resQueryEl = document.getElementById('pipelineStepResearchQuery_' + i);
      if (resQueryEl) _pipelineSteps[i].target.researchQuery = resQueryEl.value;
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      var resBrandEl = document.getElementById('pipelineStepResearchBrandCtx_' + i);
      if (resBrandEl) _pipelineSteps[i].config.includeBrandContext = resBrandEl.checked;
      var resCtxEl = document.getElementById('pipelineStepResearchCtx_' + i);
      if (resCtxEl) _pipelineSteps[i].target.contextRef = resCtxEl.value;
    } else if (_pipelineSteps[i].action === 'pulse') {
      // v24.9: Collect pulse step data (goalId + context)
      var pulseGoalEl = document.getElementById('pipelineStepGoal_' + i);
      if (pulseGoalEl) _pipelineSteps[i].target.goalId = pulseGoalEl.value;
      var pulseCtxEl = document.getElementById('pipelineStepContext_' + i);
      if (pulseCtxEl && pulseCtxEl.value.trim()) _pipelineSteps[i].target.contextRef = pulseCtxEl.value.trim();
    } else if (_pipelineSteps[i].action === 'reminder') {
      // v24.25: Collect reminder step data
      var remTitleEl = document.getElementById('pipelineStepReminderTitle_' + i);
      if (remTitleEl) _pipelineSteps[i].target.reminderTitle = remTitleEl.value;
      var remTextEl = document.getElementById('pipelineStepText_' + i);
      if (remTextEl) _pipelineSteps[i].target.text = remTextEl.value;
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      var remActionEl = document.getElementById('pipelineStepReminderAction_' + i);
      if (remActionEl) _pipelineSteps[i].config.actionLabel = remActionEl.value;
      var remViewEl = document.getElementById('pipelineStepReminderView_' + i);
      if (remViewEl) _pipelineSteps[i].config.actionView = remViewEl.value;
    } else {
      var otherTextEl = document.getElementById('pipelineStepText_' + i);
      if (otherTextEl) _pipelineSteps[i].target.text = otherTextEl.value;
    }
    // v22.47: Collect per-step approval toggle (universal for all step types)
    var approvalEl = document.getElementById('pipelineStepApproval_' + i);
    if (approvalEl) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.requireApproval = approvalEl.checked; }
  }
}

// v22.46: Toggle step type picker visibility
function togglePipelineTypePicker(index) {
  var picker = document.getElementById('pipelineTypePicker_' + index);
  if (!picker) return;
  var isVisible = picker.style.display !== 'none';
  // Close all other pickers first
  var allPickers = document.querySelectorAll('.pipeline-type-picker');
  for (var p = 0; p < allPickers.length; p++) allPickers[p].style.display = 'none';
  if (!isVisible) picker.style.display = '';
}

// v22.46: Select a step type from the visual picker
// v22.56: Skip collect inside reRender to prevent double-collect clobbering the new action
function selectPipelineStepType(index, action) {
  collectPipelineStepData();
  _pipelineSteps[index].action = action;
  _pipelineSteps[index].target = {};
  window._skipPipelineCollect = true;
  reRenderPipelineSteps();
}

// v22.46: Drag and drop for pipeline step reordering
var _pipelineDragIndex = -1;

// v23.10: Disable draggable on pipeline cards when focusing form elements
// The draggable attribute itself blocks text selection at the browser level
document.addEventListener('mousedown', function(e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    var card = e.target.closest('.pipeline-step-card[draggable]');
    if (card) {
      card.setAttribute('draggable', 'false');
      var restore = function() {
        card.setAttribute('draggable', 'true');
        e.target.removeEventListener('mouseup', restore);
        e.target.removeEventListener('blur', restore);
      };
      e.target.addEventListener('mouseup', restore);
      e.target.addEventListener('blur', restore);
    }
  }
}, true);

function onPipelineDragStart(e, index) {
  // v23.10: Don't drag when interacting with form elements (allows text selection)
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
    e.preventDefault();
    return;
  }
  _pipelineDragIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  var card = e.target.closest('.pipeline-step-card');
  if (card) setTimeout(function() { card.classList.add('dragging'); }, 0);
}

function onPipelineDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (index !== _pipelineDragIndex) {
    var card = e.target.closest('.pipeline-step-card');
    if (card) card.classList.add('drag-over');
  }
}

function onPipelineDragLeave(e) {
  var card = e.target.closest('.pipeline-step-card');
  if (card) card.classList.remove('drag-over');
}

function onPipelineDrop(e, targetIndex) {
  e.preventDefault();
  var card = e.target.closest('.pipeline-step-card');
  if (card) card.classList.remove('drag-over');
  if (_pipelineDragIndex === -1 || _pipelineDragIndex === targetIndex) return;
  collectPipelineStepData();
  // Move step from dragIndex to targetIndex
  var moved = _pipelineSteps.splice(_pipelineDragIndex, 1)[0];
  _pipelineSteps.splice(targetIndex, 0, moved);
  // Re-number
  for (var i = 0; i < _pipelineSteps.length; i++) {
    _pipelineSteps[i].stepId = i + 1;
    _pipelineSteps[i].outputKey = 'step' + (i + 1) + '_output';
  }
  _pipelineDragIndex = -1;
  reRenderPipelineSteps();
  showToast('Step reordered', 'success');
}

function addPipelineStep() {
  collectPipelineStepData();
  var newIdx = _pipelineSteps.length + 1;
  var pipeName = (document.getElementById('pipelineName') || {}).value || '';
  var isEmailTask = /email|write.*to|send.*to|draft.*letter|proposal/i.test(pipeName);
  var newTarget = isEmailTask ? { agentId: 'documents', operationId: 508 } : {};
  _pipelineSteps.push({ stepId: newIdx, action: 'studio', name: '', target: newTarget, outputKey: 'step' + newIdx + '_output', config: {} });
  reRenderPipelineSteps();
}

function removePipelineStep(index) {
  if (_pipelineSteps.length <= 1) return;
  // v24.4: Collect current form data before modifying array
  collectPipelineStepData();
  // v22.47: Push undo before removing
  pushPipelineUndo();
  _pipelineSteps.splice(index, 1);
  // Re-number outputKeys
  for (var i = 0; i < _pipelineSteps.length; i++) {
    _pipelineSteps[i].stepId = i + 1;
    _pipelineSteps[i].outputKey = 'step' + (i + 1) + '_output';
  }
  // v24.4: Skip re-collect in reRender — we already collected and array indices shifted
  window._skipPipelineCollect = true;
  reRenderPipelineSteps();
}

// v18.1: FEATURE 5 — Handle reference image upload for image gen pipeline steps (in-memory only)
function handlePipelineRefImageUpload(index, input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'warning'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    if (!_pipelineSteps[index]) return;
    _pipelineSteps[index].config = _pipelineSteps[index].config || {};
    _pipelineSteps[index].config.referenceImage = e.target.result;
    var status = document.getElementById('pipelineRefImgStatus_' + index);
    if (status) { status.textContent = 'Attached'; status.style.color = 'var(--accent)'; }
    showToast('Reference image attached to step ' + (index + 1), 'success');
  };
  reader.readAsDataURL(file);
}

// v18.2: Upload image directly for pipeline post step
function handlePipelinePostImageUpload(index, input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'warning'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    if (!_pipelineSteps[index]) return;
    _pipelineSteps[index].config = _pipelineSteps[index].config || {};
    _pipelineSteps[index].config.uploadedImage = e.target.result;
    _pipelineSteps[index].target = _pipelineSteps[index].target || {};
    _pipelineSteps[index].target.uploadedImage = e.target.result;
    var status = document.getElementById('pipelinePostImgStatus_' + index);
    if (status) { status.textContent = 'Attached'; status.style.color = 'var(--accent)'; }
    showToast('Image attached for posting', 'success');
  };
  reader.readAsDataURL(file);
}

function onPipelineStepActionChange(index, action) {
  // v18.1: FEATURE 2 — Collect all fields before re-render
  collectPipelineStepData();
  _pipelineSteps[index].action = action;
  _pipelineSteps[index].target = {};
  reRenderPipelineSteps();
}

function reRenderPipelineSteps() {
  // v22.9: Skip collect when loading presets to prevent stale DOM overwrite
  if (!window._skipPipelineCollect) {
    // v18.1: FEATURE 2 — Collect ALL fields (not just names)
    collectPipelineStepData();
  }
  window._skipPipelineCollect = false;
  var list = document.getElementById('pipelineStepList');
  if (!list) return;
  var html = '';
  for (var i = 0; i < _pipelineSteps.length; i++) {
    if (i > 0) {
      var _prevType = PIPELINE_STEP_TYPES[_pipelineSteps[i - 1].action] || PIPELINE_STEP_TYPES.studio;
      var _nextType = PIPELINE_STEP_TYPES[_pipelineSteps[i].action] || PIPELINE_STEP_TYPES.studio;
      html += '<div class="pipeline-connector" style="--connector-color-top:' + _prevType.color + ';--connector-color-bot:' + _nextType.color + ';"></div>';
    }
    html += renderPipelineStepCard(_pipelineSteps[i], i, _pipelineSteps.length);
  }
  list.innerHTML = html;
  // Populate op dropdowns for studio steps
  setTimeout(function() {
    for (var s = 0; s < _pipelineSteps.length; s++) {
      if (_pipelineSteps[s].action === 'studio') {
        updatePipelineStepOps(s, _pipelineSteps[s].target.agentId || 'all', _pipelineSteps[s].target.operationId);
      }
    }
  }, 20);
}

// v23.11: Pipeline email logo toggle + preview
function pipelineEmailLogoPreview(index) {
  var logoEl = document.getElementById('pipelineStepEmailLogo_' + index);
  var alignWrap = document.getElementById('pipelineStepLogoAlignWrap_' + index);
  var preview = document.getElementById('pipelineEmailHeaderPreview_' + index);
  var showLogo = logoEl && logoEl.checked;
  if (alignWrap) alignWrap.style.display = showLogo ? '' : 'none';
  if (!preview) return;
  var alignEl = document.getElementById('pipelineStepLogoAlign_' + index);
  var align = alignEl ? alignEl.value : 'center';
  preview.style.textAlign = align;
  if (showLogo) {
    var _bidx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
    var _logo = '';
    try { _logo = localStorage.getItem(getCurrentLogoKey(_bidx)) || ''; } catch(e) {}
    if (!_logo) { var _b = (typeof brands !== 'undefined' && brands[_bidx]) ? brands[_bidx] : null; if (_b) _logo = _b.logo || _b.brandLogo || ''; }
    if (_logo) preview.innerHTML = '<img src="' + _logo + '" alt="Logo" style="max-height:40px;max-width:120px;">';
    else preview.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">No logo set</span>';
  } else {
    preview.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Logo disabled</span>';
  }
}

function updatePipelineStepOps(index, agentId, preselect) {
  var opEl = document.getElementById('pipelineStepOp_' + index);
  if (!opEl) return;
  // v18.1: BUG 3+4 — apply categoryMap (strategy→strategic) and filter by current brand
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var categoryMap = { strategy: 'strategic', coach: 'planning', research: 'research' };
  var mappedAgent = (agentId && categoryMap[agentId]) ? categoryMap[agentId] : agentId;
  var currentBrandName = '';
  if (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand]) {
    currentBrandName = brands[selectedBrand].shortName || brands[selectedBrand].name;
  }
  var allOps = [];
  if (mode === 'brand') {
    var baseOps = typeof ops !== 'undefined' ? ops : [];
    var brandOps = typeof generatedBrandOps !== 'undefined' ? generatedBrandOps.filter(function(o) { return !o.generatedForBrand || o.generatedForBrand === currentBrandName; }) : [];
    allOps = baseOps.concat(brandOps);
  } else {
    allOps = (typeof window.lifeOps !== 'undefined' ? window.lifeOps : []).concat(typeof generatedLifeOps !== 'undefined' ? generatedLifeOps : []);
  }
  var filtered = mappedAgent && mappedAgent !== 'all' ? allOps.filter(function(o) { return o.category === mappedAgent; }) : allOps;
  var html = '<option value="">Select operation...</option>';
  filtered.forEach(function(op) {
    html += '<option value="' + op.id + '"' + (preselect && String(preselect) === String(op.id) ? ' selected' : '') + '>' + escapeHtml(op.name || 'Op #' + op.id) + '</option>';
  });
  opEl.innerHTML = html;
}

// v18.7: Update model dropdown when provider changes in pipeline studio step
function updatePipelineStepModelOptions(index, provider) {
  var wrap = document.getElementById('pipelineStepModelWrap_' + index);
  var sel = document.getElementById('pipelineStepModel_' + index);
  if (!wrap || !sel) return;
  if (!provider || typeof providerConfigs === 'undefined' || !providerConfigs[provider]) {
    wrap.style.display = 'none';
    sel.innerHTML = '';
    // v22.9: Hide DR toggle when no provider
    var drToggle = document.getElementById('pipelineStepDRToggle_' + index);
    if (drToggle) drToggle.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  var html = '';
  providerConfigs[provider].models.forEach(function(m) { html += '<option value="' + m.id + '">' + m.name + '</option>'; });
  sel.innerHTML = html;
  // v22.9: Show/hide DR toggle based on Gemini 3 model selection
  var drToggle = document.getElementById('pipelineStepDRToggle_' + index);
  if (drToggle) {
    var selectedModel = sel.value || '';
    var isGemini3 = provider === 'google' && selectedModel.indexOf('gemini-3') !== -1;
    drToggle.style.display = isGemini3 ? '' : 'none';
    // Also listen for model change within the dropdown
    sel.onchange = function() {
      var m = sel.value || '';
      drToggle.style.display = (provider === 'google' && m.indexOf('gemini-3') !== -1) ? '' : 'none';
    };
  }
}

// v18.7: Update image model dropdown when image provider changes
function updatePipelineStepImageModelOptions(index, provider) {
  var wrap = document.getElementById('pipelineStepImgModelWrap_' + index);
  var sel = document.getElementById('pipelineStepImgModel_' + index);
  if (!wrap || !sel) return;
  var imgModelProviders = { gemini: [['gemini-2.0-flash-preview-image-generation','Gemini 2.0 Flash'],['imagen-3.0-generate-002','Imagen 4']], dalle: [['dall-e-3','DALL-E 3'],['dall-e-2','DALL-E 2']] };
  if (!provider || !imgModelProviders[provider]) {
    wrap.style.display = 'none';
    sel.innerHTML = '';
    return;
  }
  wrap.style.display = '';
  var html = '';
  imgModelProviders[provider].forEach(function(m) { html += '<option value="' + m[0] + '">' + m[1] + '</option>'; });
  sel.innerHTML = html;
}

// v22.47: Pipeline undo history — stores snapshots of _pipelineSteps before destructive actions
var _pipelineUndoStack = [];

function pushPipelineUndo() {
  // Deep clone current steps before any destructive action
  collectPipelineStepData();
  _pipelineUndoStack.push(JSON.parse(JSON.stringify(_pipelineSteps)));
  // Limit stack to 20 entries
  if (_pipelineUndoStack.length > 20) _pipelineUndoStack.shift();
  updatePipelineUndoButton();
}

function undoPipelineAction() {
  if (_pipelineUndoStack.length === 0) { showToast('Nothing to undo', 'warning'); return; }
  var prev = _pipelineUndoStack.pop();
  _pipelineSteps = prev;
  window._skipPipelineCollect = true;
  reRenderPipelineSteps();
  updatePipelineUndoButton();
  showToast('Undone', 'success');
}

function updatePipelineUndoButton() {
  var btn = document.getElementById('pipelineUndoBtn');
  if (btn) {
    btn.style.opacity = _pipelineUndoStack.length > 0 ? '1' : '0.3';
    btn.style.pointerEvents = _pipelineUndoStack.length > 0 ? 'auto' : 'none';
    btn.title = _pipelineUndoStack.length > 0 ? 'Undo (' + _pipelineUndoStack.length + ')' : 'Nothing to undo';
  }
}

function loadPipelinePreset(presetId) {
  var preset = null;
  if (typeof WORKFLOW_PRESETS !== 'undefined') {
    preset = WORKFLOW_PRESETS.find(function(p) { return p.id === presetId; });
  }
  // v22.46: Also search custom presets
  if (!preset) {
    try {
      var _cp = JSON.parse(localStorage.getItem('roweos_custom_presets') || '[]');
      preset = _cp.find(function(p) { return p.id === presetId; });
    } catch(e) {}
  }
  if (!preset || !preset.steps) return;

  // v22.47: If user has existing steps, ask whether to merge, replace, or cancel
  var hasExistingSteps = _pipelineSteps.length > 0 && (_pipelineSteps.length > 1 || _pipelineSteps[0].name || (_pipelineSteps[0].target && Object.keys(_pipelineSteps[0].target).length > 0));
  if (hasExistingSteps) {
    showPipelinePresetDialog(preset);
    return;
  }

  applyPipelinePreset(preset, 'replace');
}

// v22.47: Show dialog for merge/replace/cancel when loading preset with existing steps
function showPipelinePresetDialog(preset) {
  var existing = document.getElementById('pipelinePresetDialog');
  if (existing) existing.remove();

  var html = '<div id="pipelinePresetDialog" style="position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">';
  html += '<div style="background:var(--bg-primary);border-radius:14px;max-width:380px;width:100%;padding:24px;border:1px solid var(--border-color);" onclick="event.stopPropagation()">';
  html += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">Load Preset: ' + escapeHtml(preset.name) + '</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">You have steps in progress. What would you like to do?</div>';
  html += '<div style="display:flex;flex-direction:column;gap:8px;">';
  html += '<button class="auto-lab-card-btn" style="padding:10px 16px;font-size:13px;text-align:left;background:var(--bg-secondary);border:1px solid var(--border-color);" onclick="document.getElementById(\'pipelinePresetDialog\').remove();applyPipelinePreset(window._pendingPreset,\'merge\')">';
  html += '<div style="font-weight:600;color:var(--text-primary);">Merge - Add preset steps to current pipeline</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Appends ' + preset.steps.length + ' steps after your existing steps</div>';
  html += '</button>';
  html += '<button class="auto-lab-card-btn" style="padding:10px 16px;font-size:13px;text-align:left;background:var(--bg-secondary);border:1px solid var(--border-color);" onclick="document.getElementById(\'pipelinePresetDialog\').remove();applyPipelinePreset(window._pendingPreset,\'replace\')">';
  html += '<div style="font-weight:600;color:var(--text-primary);">Replace - Clear current and load preset</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Replaces all current steps (can undo)</div>';
  html += '</button>';
  html += '<button class="auto-lab-card-btn" style="padding:10px 16px;font-size:13px;color:var(--text-muted);background:none;border:1px solid var(--border-color);" onclick="document.getElementById(\'pipelinePresetDialog\').remove()">Cancel</button>';
  html += '</div></div></div>';

  window._pendingPreset = preset;
  document.body.insertAdjacentHTML('beforeend', html);
}

// v22.47: Apply a preset with merge or replace mode
function applyPipelinePreset(preset, mode) {
  if (!preset || !preset.steps) return;

  // Push undo snapshot before any change
  pushPipelineUndo();

  var presetSteps = preset.steps.map(function(s, i) {
    var stepOffset = mode === 'merge' ? _pipelineSteps.length : 0;
    return {
      stepId: stepOffset + i + 1,
      action: s.action || 'studio',
      name: s.name || preset.name + ' Step ' + (i + 1),
      target: JSON.parse(JSON.stringify(s.target || {})),
      outputKey: 'step' + (stepOffset + i + 1) + '_output',
      config: JSON.parse(JSON.stringify(s.config || {}))
    };
  });

  if (mode === 'merge') {
    // Append preset steps after existing steps
    _pipelineSteps = _pipelineSteps.concat(presetSteps);
    // Renumber all step IDs
    for (var ri = 0; ri < _pipelineSteps.length; ri++) {
      _pipelineSteps[ri].stepId = ri + 1;
      _pipelineSteps[ri].outputKey = 'step' + (ri + 1) + '_output';
    }
    showToast('Merged ' + preset.steps.length + ' steps from ' + preset.name, 'success');
  } else {
    // Replace
    _pipelineSteps = presetSteps;
    var nameEl = document.getElementById('pipelineName');
    if (nameEl && !nameEl.value.trim()) nameEl.value = preset.name;
    showToast('Loaded preset: ' + preset.name, 'success');
  }

  window._skipPipelineCollect = true;
  reRenderPipelineSteps();
}

// v22.46: Save current pipeline steps as a custom preset
function saveCurrentAsPreset() {
  collectPipelineStepData();
  if (_pipelineSteps.length === 0) { showToast('Add at least one step first', 'warning'); return; }
  var nameEl = document.getElementById('pipelineName');
  var baseName = (nameEl && nameEl.value.trim()) ? nameEl.value.trim() : 'Custom Preset';
  var presetName = prompt('Preset name:', baseName);
  if (!presetName || !presetName.trim()) return;
  var presetId = 'custom_' + Date.now();
  var preset = {
    id: presetId,
    name: presetName.trim(),
    steps: _pipelineSteps.map(function(s, i) {
      return { stepId: i + 1, action: s.action, name: s.name || '', target: JSON.parse(JSON.stringify(s.target || {})), outputKey: s.outputKey || ('step' + (i + 1) + '_output'), config: JSON.parse(JSON.stringify(s.config || {})) };
    })
  };
  // Remove large data from preset (reference images, uploaded images)
  preset.steps.forEach(function(s) {
    if (s.config) { delete s.config.referenceImage; delete s.config.uploadedImage; }
    if (s.target) { delete s.target.uploadedImage; }
  });
  var customs = [];
  try { customs = JSON.parse(localStorage.getItem('roweos_custom_presets') || '[]'); } catch(e) {}
  customs.push(preset);
  try { localStorage.setItem('roweos_custom_presets', JSON.stringify(customs)); } catch(e) {}
  showToast('Preset saved: ' + presetName.trim(), 'success');
  // Re-render the form to show new preset
  var editIdEl = document.getElementById('pipelineEditId');
  var editId = editIdEl ? editIdEl.value : '';
  renderPipelineForm(editId || null, editId ? { id: editId, name: nameEl ? nameEl.value : '', steps: _pipelineSteps } : null);
}

function renameCustomPreset(presetId) {
  var customs = [];
  try { customs = JSON.parse(localStorage.getItem('roweos_custom_presets') || '[]'); } catch(e) {}
  var preset = customs.find(function(p) { return p.id === presetId; });
  if (!preset) return;
  var newName = prompt('Rename preset:', preset.name);
  if (!newName || !newName.trim() || newName.trim() === preset.name) return;
  preset.name = newName.trim();
  try { localStorage.setItem('roweos_custom_presets', JSON.stringify(customs)); } catch(e) {}
  showToast('Preset renamed', 'success');
  var editIdEl = document.getElementById('pipelineEditId');
  var editId = editIdEl ? editIdEl.value : '';
  renderPipelineForm(editId || null, editId ? { id: editId, steps: _pipelineSteps } : null);
}

function deleteCustomPreset(presetId) {
  if (!confirm('Delete this custom preset?')) return;
  var customs = [];
  try { customs = JSON.parse(localStorage.getItem('roweos_custom_presets') || '[]'); } catch(e) {}
  customs = customs.filter(function(p) { return p.id !== presetId; });
  try { localStorage.setItem('roweos_custom_presets', JSON.stringify(customs)); } catch(e) {}
  showToast('Preset deleted', 'success');
  var editIdEl = document.getElementById('pipelineEditId');
  var editId = editIdEl ? editIdEl.value : '';
  renderPipelineForm(editId || null, editId ? { id: editId, steps: _pipelineSteps } : null);
}

function savePipeline() {
  var nameEl = document.getElementById('pipelineName');
  if (!nameEl || !nameEl.value.trim()) { showToast('Please enter a pipeline name', 'warning'); return; }

  var editIdEl = document.getElementById('pipelineEditId');
  var editId = editIdEl ? editIdEl.value : '';

  // Collect step data from DOM
  var steps = [];
  for (var i = 0; i < _pipelineSteps.length; i++) {
    var stepNameEl = document.getElementById('pipelineStepName_' + i);
    var stepActionEl = document.getElementById('pipelineStepAction_' + i);
    var action = stepActionEl ? stepActionEl.value : _pipelineSteps[i].action;
    var stepTarget = {};

    if (action === 'studio') {
      var agentEl = document.getElementById('pipelineStepAgent_' + i);
      var opEl = document.getElementById('pipelineStepOp_' + i);
      if (agentEl) stepTarget.agentId = agentEl.value;
      if (opEl) stepTarget.operationId = opEl.value;
      // v18.1: FEATURE 1 — Save context/instructions
      var ctxEl = document.getElementById('pipelineStepContext_' + i);
      if (ctxEl && ctxEl.value.trim()) stepTarget.contextRef = ctxEl.value.trim();
      // v18.1: FEATURE 4 — Save provider override
      var provEl = document.getElementById('pipelineStepProvider_' + i);
      if (provEl && provEl.value) _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      if (provEl && provEl.value) _pipelineSteps[i].config.provider = provEl.value;
      // v18.7: Save model + length
      var modelEl = document.getElementById('pipelineStepModel_' + i);
      if (modelEl && modelEl.value) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.model = modelEl.value; }
      var lenEl = document.getElementById('pipelineStepLength_' + i);
      if (lenEl && lenEl.value) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.length = lenEl.value; }
      // v22.9: Save Deep Research toggle
      var drEl = document.getElementById('pipelineStepDeepResearch_' + i);
      if (drEl) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.useDeepResearch = drEl.checked; }
    } else if (action === 'post') {
      var platChecks = document.querySelectorAll('.pipelineStepPlat_' + i + ':checked');
      var plats = [];
      platChecks.forEach(function(cb) { plats.push(cb.value); });
      stepTarget.platforms = plats;
      var textEl = document.getElementById('pipelineStepText_' + i);
      if (textEl) stepTarget.contentRef = textEl.value.trim();
      // v18.2: Flag uploaded image (base64 stripped for storage, kept in memory for execution)
      if (_pipelineSteps[i].target && _pipelineSteps[i].target.uploadedImage) {
        stepTarget._hasUploadedImage = true;
      }
    } else if (action === 'email') {
      // v22.9: Save email template type
      var emailTemplateEl2 = document.getElementById('pipelineStepEmailTemplate_' + i);
      if (emailTemplateEl2) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.emailTemplate = emailTemplateEl2.value; }
      // v22.8: Save email step data
      var emailFromEl2 = document.getElementById('pipelineStepEmailFrom_' + i);
      var emailFromCustomEl2 = document.getElementById('pipelineStepEmailFromCustom_' + i);
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      if (emailFromEl2) {
        if (emailFromEl2.value === 'custom' && emailFromCustomEl2 && emailFromCustomEl2.value.trim()) {
          _pipelineSteps[i].config.emailFrom = emailFromCustomEl2.value.trim();
        } else {
          _pipelineSteps[i].config.emailFrom = emailFromEl2.value;
        }
      }
      var emailToEl2 = document.getElementById('pipelineStepEmailTo_' + i);
      if (emailToEl2) stepTarget.emailTo = emailToEl2.value.trim();
      var emailCcEl2 = document.getElementById('pipelineStepEmailCc_' + i);
      if (emailCcEl2) stepTarget.emailCc = emailCcEl2.value.trim();
      var emailBccEl2 = document.getElementById('pipelineStepEmailBcc_' + i);
      if (emailBccEl2) stepTarget.emailBcc = emailBccEl2.value.trim();
      var emailSubEl2 = document.getElementById('pipelineStepEmailSubject_' + i);
      if (emailSubEl2) stepTarget.emailSubject = emailSubEl2.value.trim();
      var emailBodyEl2 = document.getElementById('pipelineStepEmailBody_' + i);
      if (emailBodyEl2) stepTarget.emailBody = emailBodyEl2.value;
      var emailIncEl2 = document.getElementById('pipelineStepEmailInclude_' + i);
      if (emailIncEl2) _pipelineSteps[i].config.includeStepOutput = emailIncEl2.checked;
      // v22.23: BCC self + Queue to Outbox
      var emailBccSelfEl2 = document.getElementById('pipelineStepEmailBccSelf_' + i);
      if (emailBccSelfEl2) _pipelineSteps[i].config.bccSelf = emailBccSelfEl2.checked;
      var emailQueueEl2 = document.getElementById('pipelineStepEmailQueue_' + i);
      if (emailQueueEl2) _pipelineSteps[i].config.queueToOutbox = emailQueueEl2.checked;
    } else if (action === 'outbox') {
      // v22.24: Save outbox step data
      var outboxToEl2 = document.getElementById('pipelineStepOutboxTo_' + i);
      if (outboxToEl2) stepTarget.emailTo = outboxToEl2.value.trim();
      var outboxSubEl2 = document.getElementById('pipelineStepOutboxSubject_' + i);
      if (outboxSubEl2) stepTarget.emailSubject = outboxSubEl2.value.trim();
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      var outboxTemplateEl2 = document.getElementById('pipelineStepOutboxTemplate_' + i);
      if (outboxTemplateEl2) _pipelineSteps[i].config.emailTemplate = outboxTemplateEl2.value;
      var outboxFromEl2 = document.getElementById('pipelineStepOutboxFrom_' + i);
      if (outboxFromEl2) _pipelineSteps[i].config.emailFrom = outboxFromEl2.value;
      var outboxBccSelfEl2 = document.getElementById('pipelineStepOutboxBccSelf_' + i);
      if (outboxBccSelfEl2) _pipelineSteps[i].config.bccSelf = outboxBccSelfEl2.checked;
    } else if (action === 'batch_email') {
      // v22.28: Save batch email step data
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      var batchFromEl2 = document.getElementById('autoLabWfBatchFrom');
      if (batchFromEl2) _pipelineSteps[i].config.emailFrom = batchFromEl2.value;
      var batchTemplateEl2 = document.getElementById('autoLabWfBatchTemplate');
      if (batchTemplateEl2) _pipelineSteps[i].config.emailTemplate = batchTemplateEl2.value;
    } else if (action === 'pdf_generate') {
      // v22.31: Save PDF generation step data
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      var pdfSrcEl2 = document.getElementById('pipelineStepPdfSource_' + i);
      if (pdfSrcEl2) _pipelineSteps[i].config.sourceStep = pdfSrcEl2.value.trim();
      var pdfTitleEl2 = document.getElementById('pipelineStepPdfTitle_' + i);
      if (pdfTitleEl2) _pipelineSteps[i].config.pdfTitle = pdfTitleEl2.value.trim();
      var pdfOrientEl2 = document.getElementById('pipelineStepPdfOrient_' + i);
      if (pdfOrientEl2) _pipelineSteps[i].config.orientation = pdfOrientEl2.value;
    } else if (action === 'research') {
      // v22.8: Save research step data
      var resQueryEl2 = document.getElementById('pipelineStepResearchQuery_' + i);
      if (resQueryEl2) stepTarget.researchQuery = resQueryEl2.value;
      _pipelineSteps[i].config = _pipelineSteps[i].config || {};
      var resBrandEl2 = document.getElementById('pipelineStepResearchBrandCtx_' + i);
      if (resBrandEl2) _pipelineSteps[i].config.includeBrandContext = resBrandEl2.checked;
    } else if (action === 'pulse') {
      // v28.4: Save pulse step data (goalId + context) — was missing, causing data loss on save
      var pulseGoalEl2 = document.getElementById('pipelineStepGoal_' + i);
      if (pulseGoalEl2) stepTarget.goalId = pulseGoalEl2.value;
      var pulseCtxEl2 = document.getElementById('pipelineStepContext_' + i);
      if (pulseCtxEl2 && pulseCtxEl2.value.trim()) stepTarget.contextRef = pulseCtxEl2.value.trim();
    } else {
      var textEl2 = document.getElementById('pipelineStepText_' + i);
      if (textEl2) stepTarget.text = textEl2.value.trim();
      // v18.1: FEATURE 4 — Save image provider override
      if (action === 'image') {
        var imgProvEl = document.getElementById('pipelineStepImgProvider_' + i);
        if (imgProvEl && imgProvEl.value) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.provider = imgProvEl.value; }
        // v18.7: Save image sub-model
        var imgModelEl = document.getElementById('pipelineStepImgModel_' + i);
        if (imgModelEl && imgModelEl.value) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.imageModel = imgModelEl.value; }
      }
      // v21.15: Save video config
      if (action === 'video') {
        var vidModelEl = document.getElementById('pipelineStepVideoModel_' + i);
        if (vidModelEl && vidModelEl.value) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.videoModel = vidModelEl.value; }
        var vidDurEl = document.getElementById('pipelineStepVideoDuration_' + i);
        if (vidDurEl && vidDurEl.value) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.videoDuration = vidDurEl.value; }
        var vidAspEl = document.getElementById('pipelineStepVideoAspect_' + i);
        if (vidAspEl && vidAspEl.value) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.videoAspect = vidAspEl.value; }
      }
    }

    // v22.47: Read approval toggle in save path
    var approvalEl2 = document.getElementById('pipelineStepApproval_' + i);
    if (approvalEl2) { _pipelineSteps[i].config = _pipelineSteps[i].config || {}; _pipelineSteps[i].config.requireApproval = approvalEl2.checked; }

    // v18.2: Strip base64 reference images before saving to localStorage to prevent QuotaExceededError
    var saveConfig = {};
    var srcConfig = _pipelineSteps[i].config || {};
    Object.keys(srcConfig).forEach(function(k) {
      if (k === 'referenceImage') {
        saveConfig._hasReferenceImage = true; // flag only, don't store base64
      } else {
        saveConfig[k] = srcConfig[k];
      }
    });

    steps.push({
      stepId: i + 1,
      action: action,
      name: stepNameEl ? stepNameEl.value.trim() : '',
      target: stepTarget,
      outputKey: 'step' + (i + 1) + (action === 'image' ? '_image' : action === 'video' ? '_video' : action === 'infographic' ? '_infographic' : action === 'research' ? '_research' : '_output'),
      config: saveConfig
    });
  }

  if (steps.length === 0) { showToast('Pipeline must have at least one step', 'warning'); return; }

  var dateEl = document.getElementById('pipelineDate');
  var timeEl = document.getElementById('pipelineTime');
  var recurEl = document.getElementById('pipelineRecur');
  var recurType = recurEl ? recurEl.value : 'none';

  var descEl = document.getElementById('pipelineDescription');
  var pipeline = {
    id: editId ? Number(editId) : Date.now(),
    name: nameEl.value.trim(),
    description: descEl ? descEl.value.trim() : '',
    type: 'pipeline',
    scheduledDate: recurType === 'as_needed' ? '' : (dateEl ? dateEl.value : ''),
    time: timeEl ? timeEl.value : '09:00',
    recurType: recurType,
    // v18.8: Custom recurrence fields
    recurInterval: recurType === 'custom' ? (Number(document.getElementById('pipelineRecurInterval').value) || 1) : null,
    recurUnit: recurType === 'custom' ? document.getElementById('pipelineRecurUnit').value : null,
    action: 'pipeline',
    enabled: editId ? (function() { try { var _ea = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); var _ep = _ea.find(function(a) { return String(a.id) === String(editId); }); return _ep ? _ep.enabled !== false : true; } catch(e) { return true; } })() : true,
    mode: typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand',
    brandIdx: typeof selectedBrand !== 'undefined' ? selectedBrand : 0,
    // v23.2: Category
    category: (function() { var el = document.getElementById('pipelineCategory'); var v = el ? el.value : ''; if (v === 'Custom') { var ci = document.getElementById('pipelineCustomCatInput'); v = (ci && ci.value.trim()) || 'Custom'; } return v; })(),
    // v24.4: Custom category color
    categoryColor: (function() { var sel = document.querySelector('#pipelineCatColors .auto-lab-cat-color-btn.selected'); return sel ? sel.getAttribute('data-color') : ''; })(),
    steps: steps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // v24.6: Preserve original createdAt when editing
  if (editId) {
    try {
      var _origAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
      var _orig = _origAutos.find(function(a) { return String(a.id) === String(editId); });
      if (_orig && _orig.createdAt) pipeline.createdAt = _orig.createdAt;
    } catch(e) {}
  }

  // Save to roweos_automations
  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}
  if (editId) {
    var idStr = String(editId);
    var found = false;
    automations = automations.map(function(a) {
      if (String(a.id) === idStr) { found = true; return pipeline; }
      return a;
    });
    if (!found) automations.push(pipeline);
  } else {
    automations.push(pipeline);
  }
  // v18.5: Handle QuotaExceededError by clearing expendable data first
  try {
    localStorage.setItem('roweos_automations', JSON.stringify(automations));
  } catch(qe) {
    if (qe.name === 'QuotaExceededError' || (qe.message && qe.message.indexOf('quota') !== -1)) {
      clearExpendableStorageData();
      try { localStorage.setItem('roweos_automations', JSON.stringify(automations)); } catch(qe2) {
        showToast('Storage full: clear browser data or old runs', 'error');
        return;
      }
    } else { throw qe; }
  }

  // Sync to scheduled tasks
  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  if (editId) {
    var idStr2 = String(editId);
    var found2 = false;
    scheduled = scheduled.map(function(s) {
      if (String(s.id) === idStr2) { found2 = true; return pipeline; }
      return s;
    });
    if (!found2) scheduled.push(pipeline);
  } else {
    scheduled.push(pipeline);
  }
  if (typeof saveScheduledTasks === 'function') saveScheduledTasks(scheduled);

  // v24.7: Stamp local save immediately to protect against onSnapshot/reload overwrites
  stampLocalSave();
  // v24.7: Verify save persisted to localStorage
  try {
    var _verifyAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    var _verifyPipeline = _verifyAutos.find(function(a) { return String(a.id) === String(pipeline.id); });
    if (_verifyPipeline) {
      console.log('[savePipeline] Verified: pipeline ' + pipeline.id + ' saved with updatedAt=' + _verifyPipeline.updatedAt + ', steps=' + (_verifyPipeline.steps ? _verifyPipeline.steps.length : 0));
    } else {
      console.error('[savePipeline] WARNING: pipeline ' + pipeline.id + ' NOT found in localStorage after save!');
    }
  } catch(ve) { console.error('[savePipeline] Verify error:', ve); }

  // v24.8: Auto-learn preferences from pipeline config
  if (typeof learnFromPipelineConfig === 'function') learnFromPipelineConfig(pipeline);

  closePipelineBuilder();
  renderAutoLabWorkflows();
  if (typeof renderAutoLabStats === 'function') renderAutoLabStats();
  showToast(editId ? 'Pipeline updated' : 'Pipeline created', 'success');
  // v25.1: saveScheduledTasks() already writes through to Firestore
}

function closePipelineBuilder() {
  var form = document.getElementById('pipelineBuilderForm');
  if (form) form.remove();
  _pipelineSteps = [];
  renderAutoLabWorkflows();
}

// v19.7: Create a real automation from an AI-proposed JSON block in chat
function createAutomationFromChat(cardIndex) {
  var proposal = window._automationProposals ? window._automationProposals[cardIndex] : null;
  if (!proposal || !proposal.data) { showToast('Automation data not found', 'error'); return; }

  var d = proposal.data;
  var isPipeline = proposal.type === 'pipeline';
  var today = new Date().toISOString().split('T')[0];
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;

  // Validate and default name
  var name = (d.name && d.name.trim()) ? d.name.trim() : (isPipeline ? 'Chat Pipeline' : 'Chat Automation');

  // Validate schedule date — bump past dates to tomorrow for one-time
  var schedDate = d.scheduledDate || today;
  var recurType = d.recurType || 'none';
  if ((recurType === 'none' || recurType === 'once') && schedDate < today) {
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    schedDate = tomorrow.toISOString().split('T')[0];
    showToast('Date was in the past: moved to tomorrow', 'info');
  }

  var time = d.time || '09:00';
  var automation;

  if (isPipeline) {
    // Build pipeline steps
    var steps = [];
    if (d.steps && d.steps.length > 0) {
      for (var i = 0; i < d.steps.length; i++) {
        var s = d.steps[i];
        var stepTarget = {};
        if (s.target) {
          if (s.target.agentId) stepTarget.agentId = s.target.agentId;
          if (s.target.operationId) stepTarget.operationId = s.target.operationId;
          if (s.target.text) stepTarget.text = s.target.text;
          if (s.target.platforms) stepTarget.platforms = s.target.platforms;
          if (s.target.contentRef) stepTarget.contentRef = s.target.contentRef;
          // v24.12: Copy all pipeline step target fields (were missing, breaking context passing)
          if (s.target.contextRef) stepTarget.contextRef = s.target.contextRef;
          if (s.target.researchQuery) stepTarget.researchQuery = s.target.researchQuery;
          if (s.target.emailTo) stepTarget.emailTo = s.target.emailTo;
          if (s.target.emailSubject) stepTarget.emailSubject = s.target.emailSubject;
          if (s.target.emailBody) stepTarget.emailBody = s.target.emailBody;
          if (s.target.goalId) stepTarget.goalId = s.target.goalId;
          if (s.target.imageRef) stepTarget.imageRef = s.target.imageRef;
        }
        // v28.4/v29.0: For research steps, map to researchQuery if missing (AI may use text or contextRef)
        if ((s.action || 'studio') === 'research' && !stepTarget.researchQuery) {
          if (stepTarget.contextRef) {
            stepTarget.researchQuery = stepTarget.contextRef;
            delete stepTarget.contextRef;
          } else if (stepTarget.text) {
            stepTarget.researchQuery = stepTarget.text;
            delete stepTarget.text;
          }
        }
        steps.push({
          stepId: i + 1,
          action: s.action || 'studio',
          name: s.name || ('Step ' + (i + 1)),
          target: stepTarget,
          outputKey: 'step' + (i + 1) + ((s.action === 'image') ? '_image' : '_output'),
          config: s.config || {}
        });
      }
    }
    automation = {
      id: Date.now(),
      name: name,
      description: d.description || '', // v24.27: Capture AI-generated description
      type: 'pipeline',
      action: 'pipeline',
      scheduledDate: schedDate,
      time: time,
      recurType: recurType,
      enabled: true,
      mode: mode,
      brandIdx: brandIdx,
      steps: steps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), // v24.14: Required for sync merge
      source: 'chat'
    };
  } else {
    // Single-step automation
    var target = {};
    if (d.target) {
      if (d.target.agentId) target.agentId = d.target.agentId;
      if (d.target.operationId) target.operationId = d.target.operationId;
      if (d.target.text) target.text = d.target.text;
      if (d.target.platforms) target.platforms = d.target.platforms;
      if (d.target.category) target.category = d.target.category;
      if (d.target.goalId) target.goalId = d.target.goalId;
    }
    target.module = d.action || 'notify';
    automation = {
      id: Date.now(),
      name: name,
      description: d.description || '', // v24.27: Capture AI-generated description
      type: 'workflow', // v24.12: Explicit type
      action: d.action || 'notify',
      target: target,
      config: d.config || {},
      scheduledDate: schedDate,
      time: time,
      recurType: recurType,
      enabled: true,
      mode: mode,
      brandIdx: brandIdx,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), // v24.14: Required for sync merge
      source: 'chat'
    };
  }

  // v20.8: Check if this is an update to an existing automation
  var existingId = proposal.existingId || null;
  var isUpdate = false;

  // Dual storage write: roweos_automations
  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}

  if (existingId) {
    // Update existing — replace by ID
    for (var ai = 0; ai < automations.length; ai++) {
      if (automations[ai].id === existingId) {
        automation.id = existingId; // Keep same ID
        automations[ai] = automation;
        isUpdate = true;
        break;
      }
    }
    if (!isUpdate) automations.push(automation); // ID gone, fall back to add
  } else {
    automations.push(automation);
  }

  try {
    localStorage.setItem('roweos_automations', JSON.stringify(automations));
  } catch(qe) {
    if (qe.name === 'QuotaExceededError' || (qe.message && qe.message.indexOf('quota') !== -1)) {
      if (typeof clearExpendableStorageData === 'function') clearExpendableStorageData();
      try { localStorage.setItem('roweos_automations', JSON.stringify(automations)); } catch(qe2) {
        showToast('Storage full: clear old data first', 'error');
        return;
      }
    } else { throw qe; }
  }

  // Dual storage write: scheduled tasks
  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  if (isUpdate && existingId) {
    for (var si = 0; si < scheduled.length; si++) {
      if (scheduled[si].id === existingId) {
        scheduled[si] = automation;
        break;
      }
    }
  } else {
    scheduled.push(automation);
  }
  if (typeof saveScheduledTasks === 'function') saveScheduledTasks(scheduled);

  // UI feedback: replace card buttons with green checkmark confirmation
  var card = document.getElementById('autoProposalCard_' + cardIndex);
  if (card) {
    var btns = card.querySelectorAll('button');
    var btnContainer = btns.length > 0 ? btns[0].parentElement : null;
    if (btnContainer) {
      var statusLabel = isUpdate ? 'Updated!' : 'Scheduled!';
      btnContainer.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' +
        '<span style="color:#4ade80;font-weight:600;font-size:13px;">' + statusLabel + '</span>' +
        '<span style="color:rgba(255,255,255,0.4);font-size:12px;">Visible in Automations Lab</span></div>';
    }
  }

  showToast((isPipeline ? 'Pipeline' : 'Automation') + (isUpdate ? ' updated: ' : ' created: ') + name, 'success');

  // v25.1: saveScheduledTasks() already writes through to Firestore

  // Refresh Automations Lab if visible
  if (typeof renderAutoLabWorkflows === 'function') renderAutoLabWorkflows();
  if (typeof renderAutoLabStats === 'function') renderAutoLabStats();
}

// v19.7: Navigate to Automations Lab and pre-fill pipeline/automation editor with proposal data
// v19.9: Edit in Lab — navigate to Automations view and open the builder pre-filled
function editAutomationProposal(cardIndex) {
  var proposal = window._automationProposals ? window._automationProposals[cardIndex] : null;
  if (!proposal || !proposal.data) { showToast('Automation data not found', 'error'); return; }

  var d = proposal.data;
  var isPipeline = proposal.type === 'pipeline';

  // Navigate to Automations Lab view
  if (typeof showView === 'function') showView('automations');

  // Delay for view to render, then open the appropriate builder
  setTimeout(function() {
    if (isPipeline) {
      // Save proposal to roweos_automations so showPipelineBuilder can find it
      var tempId = Date.now();
      var tempPipeline = {
        id: tempId,
        name: d.name || 'Chat Pipeline',
        type: 'pipeline',
        action: 'pipeline',
        scheduledDate: d.scheduledDate || new Date().toISOString().split('T')[0],
        time: d.time || '09:00',
        recurType: d.recurType || 'none',
        enabled: true,
        mode: typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand',
        brandIdx: typeof selectedBrand !== 'undefined' ? selectedBrand : 0,
        steps: (d.steps || []).map(function(s, i) {
          return {
            stepId: i + 1,
            action: s.action || 'studio',
            name: s.name || ('Step ' + (i + 1)),
            target: s.target || {},
            outputKey: 'step' + (i + 1) + ((s.action === 'image') ? '_image' : '_output'),
            config: s.config || {}
          };
        }),
        createdAt: new Date().toISOString(),
        source: 'chat'
      };
      var automations = [];
      try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}
      automations.push(tempPipeline);
      try { localStorage.setItem('roweos_automations', JSON.stringify(automations)); } catch(e) {}

      if (typeof showPipelineBuilder === 'function') showPipelineBuilder(tempId);
      if (typeof renderAutoLabWorkflows === 'function') renderAutoLabWorkflows();
    } else {
      // For single-step, open the workflow form and pre-fill
      if (typeof showAutoLabWorkflowForm === 'function') showAutoLabWorkflowForm();
      setTimeout(function() {
        var nameEl = document.getElementById('autoLabWfName');
        var dateEl = document.getElementById('autoLabWfDate');
        var timeEl = document.getElementById('autoLabWfTime');
        var recurEl = document.getElementById('autoLabWfRecur');
        var actionEl = document.getElementById('autoLabWfAction');
        var textEl = document.getElementById('autoLabWfTargetText');
        if (nameEl) nameEl.value = d.name || '';
        if (dateEl) dateEl.value = d.scheduledDate || new Date().toISOString().split('T')[0];
        if (timeEl) timeEl.value = d.time || '09:00';
        if (recurEl) recurEl.value = d.recurType || 'none';
        if (actionEl) {
          actionEl.value = d.action || 'notify';
          // Trigger change to show correct target fields
          if (actionEl.onchange) actionEl.onchange();
          else actionEl.dispatchEvent(new Event('change'));
        }
        if (textEl && d.target && d.target.text) textEl.value = d.target.text;
      }, 200);
    }
  }, 300);
}

// v14.3.1: Browse library for workflow reference document
function openWfLibraryBrowser() {
  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  var files = [];

  try {
    if (mode === 'life') {
      var lifeLib = typeof getLifeLibrary === 'function' ? getLifeLibrary() : JSON.parse(localStorage.getItem('roweos_life_library') || '{}');
      if (lifeLib.files) {
        lifeLib.files.forEach(function(f) {
          files.push({ name: f.name, content: f.content || '', type: f.type || '' });
        });
      }
    } else {
      var lib = JSON.parse(localStorage.getItem('roweos_file_library') || localStorage.getItem('roweosLibrary') || '{}');
      Object.keys(lib).forEach(function(brandKey) {
        if (lib[brandKey] && lib[brandKey].files) {
          lib[brandKey].files.forEach(function(f) {
            files.push({ name: f.name, content: f.content || '', type: f.type || '' });
          });
        }
      });
    }
  } catch (e) { console.warn('[Workflow] Library parse error:', e); }

  if (files.length === 0) {
    showToast('No files found in Library', 'info');
    return;
  }

  var existingModal = document.getElementById('wfLibraryBrowserModal');
  if (existingModal) existingModal.remove();

  var modal = document.createElement('div');
  modal.id = 'wfLibraryBrowserModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  window._wfLibraryFiles = files;

  var html = '<div style="background:var(--bg-primary);border-radius:16px;padding:24px;max-width:500px;width:90%;max-height:70vh;overflow-y:auto;" onclick="event.stopPropagation()">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">';
  html += '<div style="font-size:16px;font-weight:600;color:var(--text-primary);">Select Reference Document</div>';
  html += '<button onclick="document.getElementById(\'wfLibraryBrowserModal\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">&times;</button>';
  html += '</div>';

  files.forEach(function(f, idx) {
    var icon = f.type && f.type.indexOf('image') !== -1 ? 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14' : 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z';
    html += '<div onclick="selectWfLibraryFile(' + idx + ')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.background=\'rgba(212,175,55,0.05)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.background=\'transparent\'">';
    html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"><path d="' + icon + '"/></svg>';
    html += '<div style="font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(f.name) + '</div>';
    html += '</div>';
  });

  html += '</div>';
  modal.innerHTML = html;
  document.body.appendChild(modal);
}

// v14.3.1: Select a library file as workflow reference
function selectWfLibraryFile(idx) {
  var files = window._wfLibraryFiles || [];
  if (!files[idx]) return;

  window.wfReferenceDoc = { name: files[idx].name, content: files[idx].content };

  var display = document.getElementById('wfRefDisplay');
  if (display) {
    display.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>' + escapeHtml(files[idx].name);
  }

  var modal = document.getElementById('wfLibraryBrowserModal');
  if (modal) modal.remove();
  showToast('Reference attached: ' + files[idx].name, 'success');
}

// v14.3.1: Handle file upload for workflow reference
function handleWfRefUpload(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];

  if (typeof readFileContent === 'function') {
    readFileContent(file).then(function(content) {
      window.wfReferenceDoc = { name: file.name, content: content };
      var display = document.getElementById('wfRefDisplay');
      if (display) {
        display.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>' + escapeHtml(file.name);
      }
      showToast('Reference attached: ' + file.name, 'success');
    }).catch(function(err) {
      showToast('Error reading file: ' + err.message, 'error');
    });
  } else {
    // Fallback: read as text
    var reader = new FileReader();
    reader.onload = function(e) {
      window.wfReferenceDoc = { name: file.name, content: e.target.result };
      var display = document.getElementById('wfRefDisplay');
      if (display) {
        display.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>' + escapeHtml(file.name);
      }
      showToast('Reference attached: ' + file.name, 'success');
    };
    reader.readAsText(file);
  }
  input.value = '';
}

// v14.3.1: Clear workflow reference document
function clearWfReference() {
  window.wfReferenceDoc = null;
  var display = document.getElementById('wfRefDisplay');
  if (display) display.textContent = 'No reference attached';
}

/**
 * v13.9: Save workflow automation
 */
function saveAutoLabWorkflow() {
  var name = document.getElementById('autoLabWfName');
  if (!name || !name.value.trim()) { showToast('Please enter a name', 'warning'); return; }

  var editIdEl = document.getElementById('autoLabWfEditId');
  var editId = editIdEl ? editIdEl.value : '';
  var date = document.getElementById('autoLabWfDate');
  var time = document.getElementById('autoLabWfTime');
  var recur = document.getElementById('autoLabWfRecur');
  var action = document.getElementById('autoLabWfAction');

  // Build target
  var target = {};
  var targetText = document.getElementById('autoLabWfTargetText');
  var targetCat = document.getElementById('autoLabWfTargetCat');
  var targetGoal = document.getElementById('autoLabWfTargetGoal');
  // v13.9: Capture agent + operation from cascade picker
  var targetAgent = document.getElementById('autoLabWfTargetAgent');
  var targetOp = document.getElementById('autoLabWfTargetOp');
  if (targetText) target.text = targetText.value.trim();
  if (targetCat) target.category = targetCat.value;
  if (targetGoal) target.goalId = targetGoal.value;
  if (targetAgent) target.agentId = targetAgent.value;
  if (targetOp) target.operationId = targetOp.value;
  // v18.5: Read context/instructions for studio operations
  var targetContext = document.getElementById('autoLabWfTargetContext');
  if (targetContext && targetContext.value.trim()) target.contextRef = targetContext.value.trim();
  target.module = action ? action.value : 'notify';
  // v18.7: Read provider/model/length for studio automations
  var wfProviderEl = document.getElementById('autoLabWfProvider');
  var wfModelEl = document.getElementById('autoLabWfModel');
  var wfLengthEl = document.getElementById('autoLabWfLength');
  // v17.4: Read platforms from card UI
  if (action && action.value === 'post' && window._wfSelectedPlatforms) {
    target.platforms = window._wfSelectedPlatforms.slice();
  }
  // v18.2: Read include image (supports upload)
  var includeImgEl = document.getElementById('autoLabWfTargetIncludeImage');
  if (includeImgEl) {
    if (includeImgEl.value === 'yes') {
      target.includeImage = true;
    } else if (includeImgEl.value === 'upload' && window._wfUploadedImage) {
      target.includeImage = true;
      target.uploadedImage = window._wfUploadedImage;
    }
  }
  // v14.3.1: Include reference document if attached (only for studio/run_operation actions — not post)
  var _wfAction = action ? action.value : '';
  if (window.wfReferenceDoc && _wfAction !== 'post') {
    target.referenceDoc = { name: window.wfReferenceDoc.name, content: window.wfReferenceDoc.content };
  }
  // v18.8: Include reference image for image generation
  if (_wfAction === 'image' && window._wfImageRef) {
    target.referenceImage = window._wfImageRef;
  }
  // v22.9: Read email fields for email action
  if (_wfAction === 'email') {
    var wfEmailTo = document.getElementById('autoLabWfEmailTo');
    var wfEmailCc = document.getElementById('autoLabWfEmailCc');
    var wfEmailBcc = document.getElementById('autoLabWfEmailBcc');
    var wfEmailSubject = document.getElementById('autoLabWfEmailSubject');
    var wfEmailBody = document.getElementById('autoLabWfEmailBody');
    var wfEmailFromEl = document.getElementById('autoLabWfEmailFrom');
    var wfEmailFromCustomEl = document.getElementById('autoLabWfEmailFromCustom');
    if (wfEmailTo) target.emailTo = wfEmailTo.value.trim();
    if (wfEmailCc) target.emailCc = wfEmailCc.value.trim();
    if (wfEmailBcc) target.emailBcc = wfEmailBcc.value.trim();
    if (wfEmailSubject) target.emailSubject = wfEmailSubject.value.trim();
    if (wfEmailBody) target.emailBody = wfEmailBody.value;
    if (wfEmailFromEl) {
      if (wfEmailFromEl.value === 'custom' && wfEmailFromCustomEl && wfEmailFromCustomEl.value.trim()) {
        target.emailFrom = wfEmailFromCustomEl.value.trim();
      } else {
        target.emailFrom = wfEmailFromEl.value;
      }
    }
  }

  // v18.2: Keep uploaded image in memory for immediate execution, strip from storage
  var uploadedImageData = target.uploadedImage || null;
  var refImageData = target.referenceImage || null; // v18.8
  var storageTarget = JSON.parse(JSON.stringify(target));
  if (storageTarget.uploadedImage) {
    storageTarget._hasUploadedImage = true;
    delete storageTarget.uploadedImage;
  }
  // v18.8: Strip reference image from storage too (base64 is too large for localStorage)
  if (storageTarget.referenceImage) {
    storageTarget._hasReferenceImage = true;
    delete storageTarget.referenceImage;
  }

  // v18.7: Build config for provider/model/length
  var wfConfig = {};
  if (wfProviderEl && wfProviderEl.value) wfConfig.provider = wfProviderEl.value;
  if (wfModelEl && wfModelEl.value) wfConfig.model = wfModelEl.value;
  if (wfLengthEl && wfLengthEl.value && wfLengthEl.value !== 'standard') wfConfig.length = wfLengthEl.value;
  // v20.0: Read image model for image actions
  var wfImageModelEl = document.getElementById('autoLabWfImageModel');
  if (wfImageModelEl && wfImageModelEl.value) wfConfig.imageModel = wfImageModelEl.value;
  // v21.15: Read video config for video actions
  var wfVideoModelEl = document.getElementById('autoLabWfVideoModel');
  if (wfVideoModelEl && wfVideoModelEl.value) wfConfig.videoModel = wfVideoModelEl.value;
  var wfVideoDurEl = document.getElementById('autoLabWfVideoDuration');
  if (wfVideoDurEl && wfVideoDurEl.value) wfConfig.videoDuration = wfVideoDurEl.value;
  // v22.9: Read email template for email action
  var wfEmailTemplateEl = document.getElementById('autoLabWfEmailTemplate');
  if (wfEmailTemplateEl && wfEmailTemplateEl.value) wfConfig.emailTemplate = wfEmailTemplateEl.value;
  var wfVideoAspEl = document.getElementById('autoLabWfVideoAspect');
  if (wfVideoAspEl && wfVideoAspEl.value) wfConfig.videoAspect = wfVideoAspEl.value;
  // v22.47: Read approval toggle
  var wfApprovalEl = document.getElementById('autoLabWfApproval');
  if (wfApprovalEl && wfApprovalEl.checked) wfConfig.requireApproval = true;
  // v18.7: Read notes
  var wfNotesEl = document.getElementById('autoLabWfNotes');
  var wfNotes = wfNotesEl && wfNotesEl.value.trim() ? wfNotesEl.value.trim() : '';

  var wfRecurType = recur ? recur.value : 'none';
  var automation = {
    id: editId ? Number(editId) : Date.now(),
    name: name.value.trim(),
    type: 'workflow', // v24.12: Explicit type so scheduler filter preserves it
    description: (function() { var el = document.getElementById('autoLabWfDescription'); return el ? el.value.trim() : ''; })(),
    scheduledDate: date ? date.value : '',
    time: time ? time.value : '09:00',
    recurType: wfRecurType,
    // v18.8: Custom recurrence fields
    recurInterval: wfRecurType === 'custom' ? (Number(document.getElementById('autoLabWfRecurInterval').value) || 1) : null,
    recurUnit: wfRecurType === 'custom' ? document.getElementById('autoLabWfRecurUnit').value : null,
    action: action ? action.value : 'notify',
    target: storageTarget,
    config: wfConfig,
    notes: wfNotes,
    enabled: true,
    mode: typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand',
    // v19.2: Save selected brand index for per-brand execution
    brandIdx: (function() { var el = document.getElementById('autoLabWfBrand'); return el ? parseInt(el.value) : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0); })(),
    // v23.2: Category
    category: (function() { var el = document.getElementById('autoLabWfCategory'); var v = el ? el.value : ''; if (v === 'Custom') { var ci = document.getElementById('autoLabWfCustomCatInput'); v = (ci && ci.value.trim()) || 'Custom'; } return v; })(),
    // v24.4: Custom category color
    categoryColor: (function() { var sel = document.querySelector('#autoLabWfCatColors .auto-lab-cat-color-btn.selected'); return sel ? sel.getAttribute('data-color') : ''; })(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // v29.0: Preserve original createdAt when editing (matches savePipeline v24.6 fix)
  if (editId) {
    try {
      var _origAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
      var _orig = _origAutos.find(function(a) { return String(a.id) === String(editId); });
      if (_orig && _orig.createdAt) automation.createdAt = _orig.createdAt;
    } catch(e) {}
  }

  // Save to roweos_automations
  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) { console.warn('[Automations] Parse error:', e.message); }
  if (editId) {
    // v29.0: Use found flag pattern (matches savePipeline) — more reliable than map+some
    var idStr = String(editId);
    var found = false;
    automations = automations.map(function(a) {
      if (String(a.id) === idStr) { found = true; return automation; }
      return a;
    });
    if (!found) automations.push(automation);
  } else {
    automations.push(automation);
  }
  // v18.5: Handle QuotaExceededError by clearing expendable data first
  try {
    localStorage.setItem('roweos_automations', JSON.stringify(automations));
  } catch(qe) {
    if (qe.name === 'QuotaExceededError' || (qe.message && qe.message.indexOf('quota') !== -1)) {
      clearExpendableStorageData();
      try { localStorage.setItem('roweos_automations', JSON.stringify(automations)); } catch(qe2) {
        showToast('Storage full: clear browser data or old runs', 'error');
        return;
      }
    } else { throw qe; }
  }

  // Also sync to scheduled tasks
  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  if (editId) {
    var idStr2 = String(editId);
    var found = false;
    scheduled = scheduled.map(function(s) {
      if (String(s.id) === idStr2) { found = true; return automation; }
      return s;
    });
    if (!found) scheduled.push(automation);
  } else {
    scheduled.push(automation);
  }
  if (typeof saveScheduledTasks === 'function') saveScheduledTasks(scheduled);

  // v18.2: Stash uploaded image in memory so Run Now can access it
  if (uploadedImageData) {
    if (!window._wfUploadedImages) window._wfUploadedImages = {};
    window._wfUploadedImages[String(automation.id)] = uploadedImageData;
  }
  // v18.8: Stash reference image for image generation Run Now
  if (refImageData) {
    if (!window._wfRefImages) window._wfRefImages = {};
    window._wfRefImages[String(automation.id)] = refImageData;
  }

  closeAutoLabWorkflowForm();
  window._wfUploadedImage = null;
  renderAutoLabWorkflows();
  renderAutoLabStats();
  // v22.8: Update notification center count after save
  if (typeof renderNCWidgets === 'function') try { renderNCWidgets(); } catch(e) {}
  showToast(editId ? 'Workflow updated' : 'Workflow created', 'success');
  // v25.1: saveScheduledTasks() already writes through to Firestore
}

// v21.13: Persistent deletion guard — survives page refresh, prevents zombie restoration
// v22.8: Extended expiry from 48h to 30 days
// v28.7: Restored tombstone persistence — write-through alone can't prevent zombie
// restoration because cloud scheduler writes lastRun back to the doc, and sync inventory
// reads the subcollection raw. Tombstones must survive page refresh.
var _deletedAutomationIds = {};
try { _deletedAutomationIds = JSON.parse(localStorage.getItem('roweos_deleted_automation_ids') || '{}'); } catch(e) {}
function _persistDeletedIds() {
  try { localStorage.setItem('roweos_deleted_automation_ids', JSON.stringify(_deletedAutomationIds)); } catch(e) {}
}

// v22.32: Track running automation IDs globally so animation persists across tab switches
// Map of id -> { type: 'standard'|'research'|'thinking', startTime: timestamp }
var _runningAutomationIds = {};

var _runningTimerInterval = null;

function _startRunningTimer() {
  if (_runningTimerInterval) return;
  _runningTimerInterval = setInterval(function() {
    // Update all visible timer badges without full re-render
    var keys = Object.keys(_runningAutomationIds);
    if (keys.length === 0) {
      clearInterval(_runningTimerInterval);
      _runningTimerInterval = null;
      return;
    }
    // Update thinking/research timer text elements
    var thinkingBadges = document.querySelectorAll('.thinking-timer-badge span, .dr-timer-text');
    thinkingBadges.forEach(function(el) {
      // Find closest card to get automation ID
      var card = el.closest('.auto-lab-card');
      if (!card || !card.dataset.autoId) return;
      var info = _runningAutomationIds[card.dataset.autoId];
      if (!info) return;
      var elapsed = Math.round((Date.now() - info.startTime) / 1000);
      var elFmt = elapsed >= 60 ? Math.floor(elapsed / 60) + 'm ' + (elapsed % 60) + 's' : elapsed + 's';
      if (info.type === 'research') {
        el.textContent = 'Deep Research: ' + elFmt;
      } else if (info.type === 'thinking') {
        el.textContent = 'Thinking: ' + elFmt;
      }
    });
  }, 1000);
}

function markAutomationRunning(id, type, stepIndex) {
  _runningAutomationIds[String(id)] = { type: type || 'standard', startTime: Date.now(), stepIndex: typeof stepIndex === 'number' ? stepIndex : -1 };
  _startRunningTimer();
  // v23.10: Update card button to show Stop
  _updateAutoCardStopBtn(id, true);
}

function markAutomationDone(id) {
  delete _runningAutomationIds[String(id)];
  delete _stoppedAutomationIds[String(id)];
  if (Object.keys(_runningAutomationIds).length === 0 && _runningTimerInterval) {
    clearInterval(_runningTimerInterval);
    _runningTimerInterval = null;
  }
  // v23.10: Restore card button to Run Now
  _updateAutoCardStopBtn(id, false);
  // v24.12: Clean up running animation classes and timer badges from card
  var _doneCards = document.querySelectorAll('.auto-lab-card[data-auto-id="' + id + '"]');
  for (var _dc = 0; _dc < _doneCards.length; _dc++) {
    _doneCards[_dc].classList.remove('is-running', 'is-running-research', 'is-running-thinking');
    var _badge = _doneCards[_dc].querySelector('.dr-timer-badge, .thinking-timer-badge');
    if (_badge) _badge.remove();
    var _dots = _doneCards[_dc].querySelectorAll('.step-dot-active');
    for (var _di = 0; _di < _dots.length; _di++) { _dots[_di].classList.remove('step-dot-active'); _dots[_di].style.boxShadow = ''; }
  }
}

function isAutomationRunning(id) {
  return _runningAutomationIds[String(id)] || null;
}

// v29.x: Update which step is active for a running automation
function updateRunningStepIndex(id, stepIndex) {
  var info = _runningAutomationIds[String(id)];
  if (info) info.stepIndex = stepIndex;
}

// v29.x: Restore step-dot-active glow on cards after re-render (tab switch, etc.)
function restoreRunningStepDots() {
  var keys = Object.keys(_runningAutomationIds);
  console.log('[StepDots] restoreRunningStepDots called, running:', keys.length, JSON.stringify(_runningAutomationIds));
  for (var k = 0; k < keys.length; k++) {
    var info = _runningAutomationIds[keys[k]];
    if (!info || info.stepIndex < 0) {
      console.log('[StepDots] Skipping', keys[k], '- stepIndex:', info ? info.stepIndex : 'no info');
      continue;
    }
    var cards = document.querySelectorAll('.auto-lab-card[data-auto-id="' + keys[k] + '"]');
    console.log('[StepDots] ID:', keys[k], 'stepIndex:', info.stepIndex, 'cards found:', cards.length);
    for (var c = 0; c < cards.length; c++) {
      var dots = cards[c].querySelectorAll('.pipeline-step-dot');
      console.log('[StepDots] Card', c, 'dots found:', dots.length, 'target dot:', dots[info.stepIndex] ? 'exists' : 'MISSING');
      if (dots[info.stepIndex]) {
        dots[info.stepIndex].classList.add('step-dot-active');
      }
    }
  }
}

// v23.10: Stop automation — sets flag checked by workflow runner
var _stoppedAutomationIds = {};

function stopAutomation(id) {
  _stoppedAutomationIds[String(id)] = true;
  showToast('Stopping automation...', 'info');
  // Update card UI immediately
  var cards = document.querySelectorAll('.auto-lab-card[data-auto-id="' + id + '"]');
  cards.forEach(function(c) {
    c.classList.remove('is-running', 'is-running-research', 'is-running-thinking');
    c.classList.add('is-stopped');
    var badge = c.querySelector('.dr-timer-badge, .thinking-timer-badge');
    if (badge) badge.remove();
    var lastRunEl = c.querySelector('.auto-lab-card-actions > span:first-child');
    if (lastRunEl) { lastRunEl.style.color = '#f59e0b'; lastRunEl.textContent = 'Stopped'; }
  });
  _updateAutoCardStopBtn(id, false);
  // v23.11: Mark as done immediately so it doesn't show as running
  markAutomationDone(id);
  // v23.11: Abort any active fetch for this automation
  if (window._activeAutoFetch && window._activeAutoFetch[String(id)]) {
    try { window._activeAutoFetch[String(id)].abort(); } catch(e) {}
    delete window._activeAutoFetch[String(id)];
  }
}

function isAutomationStopped(id) {
  return !!_stoppedAutomationIds[String(id)];
}

// v23.10: Swap Run Now <-> Stop button on card
function _updateAutoCardStopBtn(id, isRunning) {
  var cards = document.querySelectorAll('.auto-lab-card[data-auto-id="' + id + '"]');
  cards.forEach(function(c) {
    var btns = c.querySelectorAll('.auto-lab-card-btn.primary');
    btns.forEach(function(btn) {
      if (isRunning) {
        btn.className = 'auto-lab-card-btn danger';
        btn.textContent = 'Stop';
        btn.setAttribute('onclick', 'stopAutomation(\'' + id + '\')');
      } else {
        btn.className = 'auto-lab-card-btn primary';
        btn.textContent = 'Run Now';
        btn.setAttribute('onclick', 'runAutoLabNow(\'' + id + '\')');
      }
    });
  });
}

// v22.8: Single source of truth for merged automation list — used by scheduler and notification center
function getMergedAutomations() {
  var scheduledTasks = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  var merged = {};
  scheduledTasks.forEach(function(t) { merged[String(t.id)] = t; });
  try {
    var autoArr = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    autoArr.forEach(function(a) {
      var existing = merged[String(a.id)];
      if (!existing) {
        merged[String(a.id)] = a;
      } else if (!existing.action && a.action) {
        // v19.1: Scheduled version is stripped — use full version from roweos_automations
        // v22.8: Always keep MAX lastRun from either source
        var mLr = existing.lastRun ? new Date(existing.lastRun).getTime() : 0;
        var aLr = a.lastRun ? new Date(a.lastRun).getTime() : 0;
        merged[String(a.id)] = a;
        if (mLr > aLr) merged[String(a.id)].lastRun = existing.lastRun;
      } else {
        // v24.14: Both have action — prefer the one with newer updatedAt (fixes edits being discarded)
        var eUp = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        var aUp = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        if (aUp > eUp) {
          // roweos_automations version is newer — use it
          merged[String(a.id)] = a;
        }
        // Sync MAX lastRun regardless of which version won
        var mLr2 = merged[String(a.id)].lastRun ? new Date(merged[String(a.id)].lastRun).getTime() : 0;
        var aLr2 = a.lastRun ? new Date(a.lastRun).getTime() : 0;
        var eLr2 = existing.lastRun ? new Date(existing.lastRun).getTime() : 0;
        var maxLr = Math.max(mLr2, aLr2, eLr2);
        if (maxLr > 0) {
          merged[String(a.id)].lastRun = maxLr === aLr2 ? a.lastRun : existing.lastRun;
        }
      }
    });
  } catch(e) {}
  // v22.8: Filter out deleted automation IDs
  var result = [];
  Object.keys(merged).forEach(function(k) {
    if (!_deletedAutomationIds[k]) result.push(merged[k]);
  });
  return result;
}

// v22.8: Proactive Firestore cleanup — deletes zombie docs from both collection paths
function _cleanupDeletedFromFirestore() {
  if (!firebaseUser || !firebase) return;
  var deletedIds = Object.keys(_deletedAutomationIds);
  if (deletedIds.length === 0) return;
  try {
    var db = firebase.firestore();
    var uid = firebaseUser.uid;
    deletedIds.forEach(function(idStr) {
      db.collection('users/' + uid + '/automations').doc(idStr).delete().catch(function() {});
      db.collection('roweos_users/' + uid + '/automations').doc(idStr).delete().catch(function() {});
    });
    if (localStorage.getItem('roweos_debug') === 'true') {
      console.log('[Automations] Cleaned up ' + deletedIds.length + ' deleted IDs from Firestore');
    }
  } catch(e) {}
}

function deleteAutoLabWorkflow(id) {
  if (!confirm('Delete this workflow?')) return;
  var idStr = String(id);

  // v28.7: Track deletion in tombstone registry (prevents resurrection on sync)
  if (typeof _deletedAutomationIds !== 'undefined') {
    _deletedAutomationIds[idStr] = Date.now();
    _persistDeletedIds();
    // Push tombstone to cloud immediately
    if (typeof writeDB === 'function') {
      writeDB('profile/deletedAutomationIds', { data: _deletedAutomationIds });
    }
  }

  // v25.1: Write-through delete — remove from localStorage + Firestore immediately
  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) { console.warn('[Automations] Parse error:', e.message); }
  automations = automations.filter(function(a) { return String(a.id) !== idStr; });
  localStorage.setItem('roweos_automations', JSON.stringify(automations));
  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  scheduled = scheduled.filter(function(a) { return String(a.id) !== idStr; });
  if (typeof saveScheduledTasks === 'function') saveScheduledTasks(scheduled);

  // Delete from Firestore
  deleteDBDoc('automations', idStr, 'automations');

  renderAutoLabWorkflows();
  renderAutoLabStats();
  // v22.8: Update notification center count after delete
  if (typeof renderNCWidgets === 'function') try { renderNCWidgets(); } catch(e) {}
  showToast('Workflow deleted', 'success');
}

// v19.8: Duplicate an automation or pipeline
function duplicateAutoLabWorkflow(id) {
  var idStr = String(id);
  var automations = [];
  try { automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}
  var source = automations.find(function(a) { return String(a.id) === idStr; });
  if (!source) {
    var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
    source = scheduled.find(function(a) { return String(a.id) === idStr; });
  }
  if (!source) { showToast('Automation not found', 'error'); return; }

  var dupe = JSON.parse(JSON.stringify(source));
  dupe.id = Date.now();
  dupe.name = (dupe.name || 'Automation') + ' (Copy)';
  dupe.createdAt = new Date().toISOString();
  dupe.lastRun = undefined;
  dupe.enabled = false;

  automations.push(dupe);
  try {
    localStorage.setItem('roweos_automations', JSON.stringify(automations));
  } catch(qe) {
    if (qe.name === 'QuotaExceededError') {
      if (typeof clearExpendableStorageData === 'function') clearExpendableStorageData();
      try { localStorage.setItem('roweos_automations', JSON.stringify(automations)); } catch(e2) {
        showToast('Storage full', 'error'); return;
      }
    }
  }

  var tasks = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  tasks.push(dupe);
  if (typeof saveScheduledTasks === 'function') saveScheduledTasks(tasks);

  renderAutoLabWorkflows();
  renderAutoLabStats();
  // v22.8: Update notification center count after duplicate
  if (typeof renderNCWidgets === 'function') try { renderNCWidgets(); } catch(e) {}
  showToast('Automation duplicated', 'success');
  // v25.1: saveScheduledTasks() already writes through to Firestore
}

// v23.11: Toggle card expand on click
function toggleAutoCardExpand(card, e) {
  // Don't expand when clicking buttons, badges, drag handle
  if (e && e.target.closest && (e.target.closest('button') || e.target.closest('.auto-lab-card-badge') || e.target.closest('.auto-lab-drag-handle'))) return;
  card.classList.toggle('expanded');
}

function toggleAutoLabWorkflow(id) {
  if (typeof toggleAutomationEnabled === 'function') toggleAutomationEnabled(id);
  renderAutoLabWorkflows();
  renderAutoLabStats();
  // v22.8: Update notification center count after toggle
  if (typeof renderNCWidgets === 'function') try { renderNCWidgets(); } catch(e) {}
}

// ─── AGENTS LAB TAB ─────────────────────────────────────────────────────

/**
 * v13.9: Get custom agents from localStorage
 */
function getCustomAutoAgents() {
  try { return JSON.parse(localStorage.getItem('roweos_custom_agents') || '[]'); } catch(e) { return []; }
}

function saveCustomAutoAgents(agents) {
  localStorage.setItem('roweos_custom_agents', JSON.stringify(agents));
}

/**
 * v13.9: Render Agents Lab tab
 */
function renderAutoLabAgents() {
  var el = document.getElementById('autoLabAgents');
  if (!el) return;

  var customAgents = getCustomAutoAgents();
  var html = '';

  // v14.3: Prominent action cards at top
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">';
  html += '<div onclick="showAutoLabAgentForm()" style="padding:20px;border:2px dashed var(--accent);border-radius:12px;cursor:pointer;text-align:center;transition:all 0.2s;background:transparent;" onmouseover="this.style.background=\'rgba(212,175,55,0.05)\'" onmouseout="this.style.background=\'transparent\'">';
  html += '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:8px;"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 10-16 0"/><path d="M12 11v6M9 14h6"/></svg>';
  html += '<div style="font-weight:600;color:var(--accent);font-size:14px;">Create Custom Operation</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Build a tailored operation for your brand</div>';
  html += '</div>';
  html += '<div onclick="renderAllOperationsGrid()" style="padding:20px;border:2px solid var(--border-color);border-radius:12px;cursor:pointer;text-align:center;transition:all 0.2s;background:transparent;" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.background=\'rgba(212,175,55,0.05)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.background=\'transparent\'">';
  html += '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-primary)" stroke-width="1.5" style="margin-bottom:8px;"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
  html += '<div style="font-weight:600;color:var(--text-primary);font-size:14px;">Browse All Operations</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">150+ built-in ops across all categories</div>';
  html += '</div>';
  html += '</div>';

  html += '<div class="auto-lab-section-title">Custom Agents</div>';
  html += '<div class="auto-lab-grid">';

  // Create agent card
  html += '<div class="auto-lab-card create-card" onclick="showAutoLabAgentForm()">';
  html += '<div style="text-align:center;color:var(--text-muted);">';
  html += '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.5;"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 10-16 0"/></svg>';
  html += '<div style="font-size:14px;font-weight:500;">Create Custom Agent</div>';
  html += '</div></div>';

  // v18.5: Category display map for agent badges
  var agentCatMap = {strategy:'Strategy',marketing:'Marketing',operations:'Operations',documents:'Documents',social:'Social',coach:'Coach',research:'Research',image:'Image',planning:'Planning',wellness:'Wellness',taxes:'Taxes',travel:'Travel',development:'Development',custom:'Custom'};
  customAgents.forEach(function(agent, idx) {
    var num = (idx + 1) < 10 ? '0' + (idx + 1) : '' + (idx + 1);
    var catLabel = agentCatMap[agent.category] || 'Custom';
    var catClass = 'cat-' + (agent.category === 'strategic' ? 'strategy' : agent.category === 'planning' ? 'coach' : (agent.category || 'custom'));
    html += '<div class="auto-lab-card">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
    html += '<div>';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-variant-numeric:tabular-nums;">' + num + '</div>';
    html += '<div class="auto-lab-card-title">' + escapeHtml(agent.name || 'Untitled Agent') + '</div>';
    html += '</div>';
    html += '<span class="auto-lab-card-badge ' + catClass + '">' + escapeHtml(catLabel) + '</span>';
    html += '</div>';
    html += '<div class="auto-lab-card-meta">';
    html += escapeHtml(agent.model || 'default');
    if (agent.systemPrompt) html += ' &middot; ' + escapeHtml(agent.systemPrompt.substring(0, 60)) + (agent.systemPrompt.length > 60 ? '...' : '');
    html += '</div>';
    html += '<div class="auto-lab-card-actions">';
    html += '<button class="auto-lab-card-btn" onclick="showAutoLabAgentForm(\'' + agent.id + '\')">Edit</button>';
    html += '<button class="auto-lab-card-btn primary" onclick="testAutoLabAgent(\'' + agent.id + '\')">Test</button>';
    html += '<button class="auto-lab-card-btn danger" onclick="deleteCustomAutoAgent(\'' + agent.id + '\')">Delete</button>';
    html += '</div></div>';
  });

  html += '</div>';

  // Built-in agents section
  html += '<div class="auto-lab-section-title">Built-in Agents</div>';
  html += '<div class="auto-lab-grid">';

  var mode = typeof getCurrentMode === 'function' ? getCurrentMode() : 'brand';
  // v13.9: Added Image agent to both modes
  var builtInAgents = mode === 'life'
    ? [{ name: 'Life Coach', id: 'coach', color: '#4ade80' }, { name: 'Wellness Coach', id: 'wellness', color: '#60a5fa' }, { name: 'Tax Intelligence', id: 'taxintelligence', color: '#fbbf24' }, { name: 'Travel Planner', id: 'travel', color: '#f97316' }, { name: 'Personal AI', id: 'personal', color: '#a78bfa' }, { name: 'Image', id: 'image', color: '#a89878' }]
    : [{ name: 'Strategy', id: 'strategy', color: '#a78bfa' }, { name: 'Marketing', id: 'marketing', color: '#f472b6' }, { name: 'Operations', id: 'operations', color: '#4ade80' }, { name: 'Documents', id: 'documents', color: '#fbbf24' }, { name: 'Social Media', id: 'social', color: '#1DA1F2' }, { name: 'Image', id: 'image', color: '#a89878' }];

  builtInAgents.forEach(function(agent) {
    html += '<div class="auto-lab-card" style="cursor:pointer;" onclick="showAutoLabBuiltInAgent(\'' + agent.id + '\')">';
    html += '<div style="display:flex;align-items:center;gap:10px;">';
    html += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + agent.color + ';flex-shrink:0;"></span>';
    html += '<div class="auto-lab-card-title">' + escapeHtml(agent.name) + '</div>';
    html += '<span class="auto-lab-card-badge agent" style="margin-left:auto;">Built-in</span>';
    html += '</div>';
    html += '<div class="auto-lab-card-meta" style="padding-left:18px;">System agent for ' + mode + ' mode &middot; Click to view</div>';
    html += '</div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

/**
 * v13.9: Show agent creation/edit form
 */
function showAutoLabAgentForm(agentId) {
  var el = document.getElementById('autoLabAgents');
  if (!el) return;

  var existing = null;
  if (agentId) {
    var agents = getCustomAutoAgents();
    existing = agents.find(function(a) { return String(a.id) === String(agentId); });
  }

  var html = '<div class="auto-lab-form" id="autoLabAgentForm">';
  html += '<div class="auto-lab-form-title">' + (existing ? 'Edit Agent' : 'Create Custom Agent') + '</div>';
  html += '<input type="hidden" id="autoLabAgentEditId" value="' + (existing ? existing.id : '') + '">';

  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field"><label>Agent Name</label>';
  html += '<input type="text" id="autoLabAgentName" placeholder="e.g. Brand Analyst" value="' + escapeHtml(existing ? existing.name || '' : '') + '"></div>';
  html += '<div class="auto-lab-form-field"><label>Provider</label>';
  html += '<select id="autoLabAgentProvider" onchange="updateAutoLabAgentModels()">';
  var providers = [['gemini','Gemini'],['nanobanana','Nano Banana (Gemini)'],['anthropic','Anthropic'],['openai','OpenAI']];
  providers.forEach(function(p) {
    html += '<option value="' + p[0] + '"' + (existing && existing.provider === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
  });
  html += '</select></div>';
  html += '</div>';

  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field"><label>Model</label>';
  html += '<select id="autoLabAgentModel"></select></div>';
  html += '<div class="auto-lab-form-field"><label>Temperature (' + (existing && existing.temperature != null ? existing.temperature : '0.7') + ')</label>';
  html += '<input type="range" id="autoLabAgentTemp" min="0" max="2" step="0.1" value="' + (existing && existing.temperature != null ? existing.temperature : 0.7) + '" oninput="this.parentElement.querySelector(\'label\').textContent=\'Temperature (\'+this.value+\')\'"></div>';
  html += '</div>';

  // v13.9: Category selection for custom agents
  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field"><label>Category</label>';
  html += '<select id="autoLabAgentCategory" onchange="onAgentCategoryChange(this.value)">';
  var categories = [['strategy','Strategy'],['marketing','Marketing'],['operations','Operations'],['documents','Documents'],['image','Image'],['planning','Planning'],['wellness','Wellness'],['taxes','Taxes'],['travel','Travel'],['development','Development'],['social','Social Media'],['custom','Custom']];
  categories.forEach(function(c) {
    html += '<option value="' + c[0] + '"' + (existing && existing.category === c[0] ? ' selected' : '') + '>' + c[1] + '</option>';
  });
  html += '</select></div>';
  html += '<div class="auto-lab-form-field" id="autoLabAgentCategoryCustomWrap" style="display:' + (existing && existing.category === 'custom' ? 'block' : 'none') + ';"><label>Custom Category</label>';
  html += '<input type="text" id="autoLabAgentCategoryCustom" placeholder="e.g. analytics" value="' + escapeHtml(existing && existing.customCategory ? existing.customCategory : '') + '"></div>';
  html += '</div>';

  // v17.0: Social platform sub-selector (shown when category = social)
  html += '<div class="auto-lab-form-row" id="autoLabAgentSocialRow" style="display:' + (existing && existing.category === 'social' ? 'flex' : 'none') + ';">';
  html += '<div class="auto-lab-form-field"><label>Platform</label>';
  html += '<select id="autoLabAgentSocialPlatform" onchange="prefillSocialAgentPrompt()">';
  var socialPlatforms = [['x','X (Twitter)'],['threads','Threads'],['instagram','Instagram'],['tiktok','TikTok'],['all','All Platforms']];
  socialPlatforms.forEach(function(p) {
    html += '<option value="' + p[0] + '"' + (existing && existing.socialPlatform === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
  });
  html += '</select></div>';
  html += '<div class="auto-lab-form-field"><label>Default Tone</label>';
  html += '<select id="autoLabAgentDefaultTone">';
  ['casual','professional','witty','inspirational','storytelling'].forEach(function(t) {
    html += '<option value="' + t + '"' + (existing && existing.defaultTone === t ? ' selected' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
  });
  html += '</select></div>';
  html += '</div>';
  // v17.0: Social agent templates
  html += '<div id="autoLabSocialTemplates" style="display:' + (existing && existing.category === 'social' ? 'block' : 'none') + ';">';
  html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">Quick Start Templates:</div>';
  html += '<div class="social-agent-templates">';
  html += '<div class="social-agent-template-card" onclick="applySocialAgentTemplate(\'x\')"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg><div class="social-agent-template-name">X Strategist</div><div class="social-agent-template-platform">Punchy 280-char posts</div></div>';
  html += '<div class="social-agent-template-card" onclick="applySocialAgentTemplate(\'threads\')"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164z"/></svg><div class="social-agent-template-name">Threads Creator</div><div class="social-agent-template-platform">Conversational, authentic</div></div>';
  html += '<div class="social-agent-template-card" onclick="applySocialAgentTemplate(\'instagram\')"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/></svg><div class="social-agent-template-name">Instagram Curator</div><div class="social-agent-template-platform">Visual-first captions</div></div>';
  html += '<div class="social-agent-template-card" onclick="applySocialAgentTemplate(\'tiktok\')"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.11V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.77 1.52V6.78a4.84 4.84 0 01-1.01-.09z"/></svg><div class="social-agent-template-name">TikTok Script Writer</div><div class="social-agent-template-platform">Hook-first, trending</div></div>';
  html += '</div></div>';

  html += '<div class="auto-lab-form-row">';
  html += '<div class="auto-lab-form-field"><label>System Prompt</label>';
  html += '<textarea id="autoLabAgentPrompt" placeholder="You are a helpful assistant specialized in..." rows="4">' + escapeHtml(existing ? existing.systemPrompt || '' : '') + '</textarea></div>';
  html += '</div>';

  html += '<div class="auto-lab-form-actions">';
  html += '<button class="auto-lab-card-btn" onclick="closeAutoLabAgentForm()">Cancel</button>';
  html += '<button class="auto-lab-card-btn primary" onclick="saveCustomAutoAgent()">Save Agent</button>';
  html += '</div></div>';

  el.insertAdjacentHTML('afterbegin', html);
  // v13.9: Populate model dropdown for current provider
  updateAutoLabAgentModels(existing ? existing.model : null);
  var form = document.getElementById('autoLabAgentForm');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * v13.9: Update model dropdown based on selected provider
 */
function updateAutoLabAgentModels(preselect) {
  var providerEl = document.getElementById('autoLabAgentProvider');
  var modelEl = document.getElementById('autoLabAgentModel');
  if (!providerEl || !modelEl) return;

  var provider = providerEl.value;
  // v13.9: Updated Gemini models to 3.0
  var modelsByProvider = {
    gemini: ['gemini-3-flash-preview', 'gemini-3.1-pro-preview'],
    nanobanana: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-2.0-flash-exp-image-generation'],
    anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-20250514', 'claude-opus-4-7'],
    openai: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.5-thinking']
  };
  var models = modelsByProvider[provider] || modelsByProvider.gemini;
  var html = '';
  models.forEach(function(m) {
    html += '<option value="' + m + '"' + (preselect === m ? ' selected' : '') + '>' + m + '</option>';
  });
  modelEl.innerHTML = html;
}

function closeAutoLabAgentForm() {
  var form = document.getElementById('autoLabAgentForm');
  if (form) form.remove();
}

function saveCustomAutoAgent() {
  var nameEl = document.getElementById('autoLabAgentName');
  if (!nameEl || !nameEl.value.trim()) { showToast('Please enter an agent name', 'warning'); return; }

  var editIdEl = document.getElementById('autoLabAgentEditId');
  var editId = editIdEl ? editIdEl.value : '';
  var providerEl = document.getElementById('autoLabAgentProvider');
  var modelEl = document.getElementById('autoLabAgentModel');
  var tempEl = document.getElementById('autoLabAgentTemp');
  var promptEl = document.getElementById('autoLabAgentPrompt');

  // v13.9: Include category from form
  var catEl = document.getElementById('autoLabAgentCategory');
  var catCustomEl = document.getElementById('autoLabAgentCategoryCustom');
  var agentCategory = catEl ? catEl.value : '';
  if (agentCategory === 'custom' && catCustomEl && catCustomEl.value.trim()) {
    agentCategory = catCustomEl.value.trim().toLowerCase();
  }

  // v17.0: Social fields
  var socialPlatformEl = document.getElementById('autoLabAgentSocialPlatform');
  var socialToneEl = document.getElementById('autoLabAgentDefaultTone');

  var agent = {
    id: editId || String(Date.now()),
    name: nameEl.value.trim(),
    provider: providerEl ? providerEl.value : 'nanobanana',
    model: modelEl ? modelEl.value.trim() : 'gemini-3-flash-preview',
    temperature: tempEl ? parseFloat(tempEl.value) : 0.7,
    systemPrompt: promptEl ? promptEl.value.trim() : '',
    category: agentCategory,
    createdAt: new Date().toISOString(),
    socialPlatform: agentCategory === 'social' && socialPlatformEl ? socialPlatformEl.value : undefined,
    defaultTone: agentCategory === 'social' && socialToneEl ? socialToneEl.value : undefined,
    autoPublish: false
  };

  var agents = getCustomAutoAgents();
  if (editId) {
    agents = agents.map(function(a) { return String(a.id) === editId ? agent : a; });
    if (!agents.some(function(a) { return String(a.id) === editId; })) agents.push(agent);
  } else {
    agents.push(agent);
  }
  saveCustomAutoAgents(agents);

  closeAutoLabAgentForm();
  renderAutoLabAgents();
  showToast(editId ? 'Agent updated' : 'Agent created', 'success');
}

/**
 * v13.9: Test a custom agent with a sample message
 */
function testAutoLabAgent(agentId) {
  // v13.9: Navigate to Studio instead of prompt() dialog
  var agents = getCustomAutoAgents();
  var agent = agents.find(function(a) { return String(a.id) === String(agentId); });
  if (!agent) { showToast('Agent not found', 'error'); return; }

  // Store agent for Studio to pick up
  window._labTestAgent = agent;
  showView('studio');
  showToast('Testing "' + agent.name + '" in Studio. Use any operation to run with this agent\'s prompt.', 'info');
}

function showAutoLabAgentResult(agent, input, output) {
  var el = document.getElementById('autoLabAgents');
  if (!el) return;
  // Remove any existing preview
  var old = document.getElementById('autoLabAgentPreview');
  if (old) old.remove();

  var html = '<div id="autoLabAgentPreview" class="auto-lab-agent-card" style="margin-bottom:20px;">';
  html += '<div class="auto-lab-card-header" style="margin-bottom:12px;">';
  html += '<div class="auto-lab-card-title">Test Result: ' + escapeHtml(agent.name) + '</div>';
  html += '<button class="auto-lab-card-btn" onclick="document.getElementById(\'autoLabAgentPreview\').remove()">Close</button>';
  html += '</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Input: ' + escapeHtml(input) + '</div>';
  html += '<div class="auto-lab-agent-preview">' + escapeHtml(output) + '</div>';
  html += '</div>';
  el.insertAdjacentHTML('afterbegin', html);
}

function deleteCustomAutoAgent(agentId) {
  if (!confirm('Delete this custom agent?')) return;
  var agents = getCustomAutoAgents();
  agents = agents.filter(function(a) { return String(a.id) !== String(agentId); });
  saveCustomAutoAgents(agents);
  renderAutoLabAgents();
  showToast('Agent deleted', 'success');
}

