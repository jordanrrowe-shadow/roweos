// ═══════════════════════════════════════════════════════════════════════════
// BLOOM - AI-Powered Brand Feed v22.11
// ═══════════════════════════════════════════════════════════════════════════

var _bloomPosts = [];
var _bloomFilter = 'all';
var _bloomGenerating = false;
var _bloomBatchSize = 20; // v22.56: Increased from 12 to 20 — full garden per batch
var _bloomLikedIds = {};
var _bloomSavedIds = {};
var _bloomSavedPosts = {}; // v22.51: Full saved post data for persistence
var _bloomObserver = null;
var _bloomVideoObserver = null; // v22.14: Autoplay videos on scroll
var _bloomLastBrandIdx = -1;

// v22.12: Phase 2 - Algorithm Learning globals
var _bloomDwellObserver = null;
var _bloomPostLength = localStorage.getItem('roweos_bloom_length') || 'short'; // 'short' or 'long'
var _bloomContentMode = localStorage.getItem('roweos_bloom_content_mode') || 'text_only'; // v22.14: 'all_media', 'images_video_text', 'images_text', 'video_text', 'text_only'
var _bloomSource = 'all'; // 'all', 'brand_0', 'brand_1', ..., 'life_0', 'life_1', ...
var _bloomDwellTimers = {};

var BLOOM_SIGNAL_WEIGHTS = {
  like: 1.0, unlike: -1.0,
  save: 1.5, unsave: -1.5,
  comment: 2.0, share: 3.0,
  dwell: 0.3, skip: -0.2,
  filter: 0.5
};

// v22.16: Content Library globals
var _bloomLibraryOpen = false;
var _bloomLibraryTab = 'all';
var BLOOM_LIBRARY_MAX = 15;
var BLOOM_LIBRARY_MAX_PX = 800;
var BLOOM_LIBRARY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operations', label: 'Operations' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'documents', label: 'Documents' },
  { id: 'coach', label: 'Coach' }
];

// v22.17: Bloom Knowledge Repository
var BLOOM_KNOWLEDGE_MAX = 30;

var BLOOM_FILTERS = [
  { id: 'foryou', label: 'For You' },
  { id: 'all', label: 'All' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operations', label: 'Operations' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'research', label: 'Research' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'idea', label: 'Ideas' },
  { id: 'saved', label: 'Saved' }
];

var BLOOM_POST_TYPES = ['insight', 'social', 'idea', 'analysis'];

// v22.51: Bloom save persistence
function bloomGetSaveKey(brandIdx) {
  var brand = brands[brandIdx] || brands[0];
  if (!brand) return 'roweos_bloom_saved_unknown';
  return 'roweos_bloom_saved_' + (brand.shortName || brand.name).replace(/\s+/g, '_').toLowerCase();
}

function bloomLoadSaved(brandIdx) {
  try {
    var raw = localStorage.getItem(bloomGetSaveKey(brandIdx));
    if (raw) {
      var data = JSON.parse(raw);
      _bloomSavedIds = {};
      _bloomSavedPosts = {};
      if (Array.isArray(data)) {
        data.forEach(function(p) {
          _bloomSavedIds[p.id] = true;
          _bloomSavedPosts[p.id] = p;
        });
      }
      return;
    }
  } catch(e) { console.warn('[Bloom] Saved load error:', e); }
  _bloomSavedIds = {};
  _bloomSavedPosts = {};
}

function bloomPersistSaved(brandIdx) {
  try {
    var saved = [];
    Object.keys(_bloomSavedIds).forEach(function(id) {
      if (_bloomSavedPosts[id]) {
        saved.push(_bloomSavedPosts[id]);
      }
    });
    localStorage.setItem(bloomGetSaveKey(brandIdx), JSON.stringify(saved));
  } catch(e) { console.warn('[Bloom] Saved persist error:', e); }
}

var BLOOM_CATEGORY_MAP = {
  marketing: ['social', 'idea', 'insight'],
  strategic: ['analysis', 'insight', 'idea'],
  operations: ['insight', 'idea', 'analysis'],
  intelligence: ['analysis', 'insight'],
  research: ['insight', 'analysis'],
  image: ['image'],
  video: ['video'],
  documents: ['insight', 'idea']
};

// v22.12: Phase 2 - Signal Storage Layer
function bloomGetSignals(brandIdx) {
  var brand = brands[brandIdx] || brands[0];
  if (!brand) return null;
  var key = 'roweos_bloom_signals_' + (brand.shortName || brand.name).replace(/\s+/g, '_').toLowerCase();
  try {
    var raw = localStorage.getItem(key);
    if (raw) {
      var signals = JSON.parse(raw);
      return bloomApplyDecay(signals);
    }
  } catch(e) { console.warn('[Bloom] Signal load error:', e); }
  return {
    version: 2,
    categories: {},
    postTypes: {},
    agents: {},
    ops: {},
    filterUsage: {},
    timeSlots: [0,0,0,0,0,0],
    totalInteractions: 0,
    totalSessions: 0,
    likedPostOps: [],
    savedPostOps: [],
    lastDecay: Date.now(),
    lastUpdated: Date.now(),
    recentSignals: []
  };
}

function bloomSaveSignals(brandIdx, signals) {
  var brand = brands[brandIdx] || brands[0];
  if (!brand || !signals) return;
  var key = 'roweos_bloom_signals_' + (brand.shortName || brand.name).replace(/\s+/g, '_').toLowerCase();
  signals.lastUpdated = Date.now();
  // Prune ops to top 30 by score
  var opKeys = Object.keys(signals.ops);
  if (opKeys.length > 30) {
    opKeys.sort(function(a, b) { return (signals.ops[b].score || 0) - (signals.ops[a].score || 0); });
    var pruned = {};
    for (var i = 0; i < 30; i++) { pruned[opKeys[i]] = signals.ops[opKeys[i]]; }
    signals.ops = pruned;
  }
  // Keep recentSignals at 100
  if (signals.recentSignals.length > 100) {
    signals.recentSignals = signals.recentSignals.slice(-100);
  }
  try {
    localStorage.setItem(key, JSON.stringify(signals));
    writeDB('profile/main', { bloomSignals: JSON.stringify(signals) }); // v25.1
  } catch(e) { console.warn('[Bloom] Signal save error:', e); }
}

function bloomApplyDecay(signals) {
  if (!signals || !signals.lastDecay) return signals;
  var now = Date.now();
  var hoursSinceDecay = (now - signals.lastDecay) / (1000 * 60 * 60);
  if (hoursSinceDecay < 24) return signals;
  // 7-day half-life: decay = 0.5^(days/7)
  var days = hoursSinceDecay / 24;
  var factor = Math.pow(0.5, days / 7);
  var buckets = ['categories', 'postTypes', 'agents'];
  for (var b = 0; b < buckets.length; b++) {
    var bucket = signals[buckets[b]];
    if (!bucket) continue;
    var keys = Object.keys(bucket);
    for (var k = 0; k < keys.length; k++) {
      if (bucket[keys[k]] && typeof bucket[keys[k]].score === 'number') {
        bucket[keys[k]].score *= factor;
      }
    }
  }
  var opKeys = Object.keys(signals.ops || {});
  for (var o = 0; o < opKeys.length; o++) {
    if (signals.ops[opKeys[o]] && typeof signals.ops[opKeys[o]].score === 'number') {
      signals.ops[opKeys[o]].score *= factor;
    }
  }
  signals.lastDecay = now;
  return signals;
}

// v22.12: Phase 2 - Signal Recorder
function bloomRecordSignal(type, post) {
  if (!post) return;
  var brandIdx = post.brandIdx != null ? post.brandIdx : (selectedBrand || 0);
  var signals = bloomGetSignals(brandIdx);
  if (!signals) return;
  var weight = BLOOM_SIGNAL_WEIGHTS[type] || 0;
  // Update category affinity
  if (post.category) {
    if (!signals.categories[post.category]) signals.categories[post.category] = { score: 0, interactions: 0 };
    signals.categories[post.category].score += weight;
    signals.categories[post.category].interactions++;
  }
  // Update post type affinity
  if (post.type) {
    if (!signals.postTypes[post.type]) signals.postTypes[post.type] = { score: 0, interactions: 0 };
    signals.postTypes[post.type].score += weight;
    signals.postTypes[post.type].interactions++;
  }
  // Update agent affinity
  if (post.agent) {
    if (!signals.agents[post.agent]) signals.agents[post.agent] = { score: 0, interactions: 0 };
    signals.agents[post.agent].score += weight;
    signals.agents[post.agent].interactions++;
  }
  // Update direct op affinity
  if (post.operationId) {
    var opId = String(post.operationId);
    if (!signals.ops[opId]) signals.ops[opId] = { score: 0, interactions: 0, lastSeen: 0 };
    signals.ops[opId].score += weight;
    signals.ops[opId].interactions++;
    signals.ops[opId].lastSeen = Date.now();
  }
  // Track liked/saved op IDs for cross-session restore
  if (type === 'like' && post.operationId) {
    if (signals.likedPostOps.indexOf(String(post.operationId)) === -1) {
      signals.likedPostOps.push(String(post.operationId));
    }
  } else if (type === 'unlike' && post.operationId) {
    signals.likedPostOps = signals.likedPostOps.filter(function(id) { return id !== String(post.operationId); });
  }
  if (type === 'save' && post.operationId) {
    if (signals.savedPostOps.indexOf(String(post.operationId)) === -1) {
      signals.savedPostOps.push(String(post.operationId));
    }
  } else if (type === 'unsave' && post.operationId) {
    signals.savedPostOps = signals.savedPostOps.filter(function(id) { return id !== String(post.operationId); });
  }
  // Time slot (4hr buckets)
  var hour = new Date().getHours();
  var slot = Math.floor(hour / 4);
  signals.timeSlots[slot]++;
  // Total interactions
  if (weight > 0) signals.totalInteractions++;
  // Recent signals log
  signals.recentSignals.push({ type: type, opId: post.operationId || '', category: post.category || '', ts: Date.now() });
  bloomSaveSignals(brandIdx, signals);
}

function bloomRecordFilterSignal(filterId) {
  var brandIdx = selectedBrand || 0;
  var signals = bloomGetSignals(brandIdx);
  if (!signals) return;
  if (!signals.filterUsage[filterId]) signals.filterUsage[filterId] = 0;
  signals.filterUsage[filterId]++;
  bloomSaveSignals(brandIdx, signals);
}

// v22.12: Phase 2 - Weighted Op Selection
function bloomSelectWeightedOps(brandOps, count, brandIdx) {
  var signals = bloomGetSignals(brandIdx);
  if (!signals || signals.totalInteractions < 3) {
    // Not enough data - pure random
    var shuffled = brandOps.slice().sort(function() { return Math.random() - 0.5; });
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
  // Exploration ratio: starts 70% random, converges to 20% after 50 interactions
  var exploreRatio = Math.max(0.20, 0.70 - signals.totalInteractions * 0.01);
  var exploreCount = Math.max(1, Math.round(count * exploreRatio));
  var exploitCount = count - exploreCount;
  // Score each op
  var scored = [];
  for (var i = 0; i < brandOps.length; i++) {
    var op = brandOps[i];
    var score = 1.0;
    // Category affinity
    if (op.category && signals.categories[op.category]) {
      score += signals.categories[op.category].score * 0.4;
    }
    // Agent affinity
    var agent = op.category === 'strategic' ? 'strategy' : (op.category || 'strategy');
    if (signals.agents[agent]) {
      score += signals.agents[agent].score * 0.2;
    }
    // Direct op affinity
    if (signals.ops[String(op.id)]) {
      score += signals.ops[String(op.id)].score * 0.3;
    }
    // Recency bonus for recently seen ops
    if (signals.ops[String(op.id)] && signals.ops[String(op.id)].lastSeen) {
      var hoursSince = (Date.now() - signals.ops[String(op.id)].lastSeen) / (1000 * 60 * 60);
      if (hoursSince < 24) score += 0.1;
    }
    score = Math.max(0.1, score); // Floor to prevent zero/negative
    scored.push({ op: op, score: score });
  }
  // Exploit: weighted random sampling
  var result = [];
  var remaining = scored.slice();
  for (var e = 0; e < exploitCount && remaining.length > 0; e++) {
    var totalScore = 0;
    for (var s = 0; s < remaining.length; s++) totalScore += remaining[s].score;
    var rand = Math.random() * totalScore;
    var cumul = 0;
    for (var j = 0; j < remaining.length; j++) {
      cumul += remaining[j].score;
      if (cumul >= rand) {
        result.push(remaining[j].op);
        remaining.splice(j, 1);
        break;
      }
    }
  }
  // Explore: pure random from remaining
  var remOps = remaining.slice().sort(function() { return Math.random() - 0.5; });
  for (var x = 0; x < exploreCount && x < remOps.length; x++) {
    result.push(remOps[x].op);
  }
  return result.slice(0, count);
}

function bloomSelectWeightedPostType(op, signals) {
  var types = BLOOM_CATEGORY_MAP[op.category] || BLOOM_POST_TYPES;
  if (!signals || signals.totalInteractions < 5) {
    return types[Math.floor(Math.random() * types.length)];
  }
  // 30% chance of random to maintain variety
  if (Math.random() < 0.3) {
    return types[Math.floor(Math.random() * types.length)];
  }
  // Weighted by postType affinity
  var scored = [];
  var totalScore = 0;
  for (var i = 0; i < types.length; i++) {
    var s = 1.0;
    if (signals.postTypes[types[i]]) {
      s += signals.postTypes[types[i]].score;
    }
    s = Math.max(0.1, s);
    scored.push({ type: types[i], score: s });
    totalScore += s;
  }
  var rand = Math.random() * totalScore;
  var cumul = 0;
  for (var j = 0; j < scored.length; j++) {
    cumul += scored[j].score;
    if (cumul >= rand) return scored[j].type;
  }
  return types[0];
}

// v22.12: Phase 2 - Prompt Injection
function getBloomLearningContext(brandIdx) {
  var signals = bloomGetSignals(brandIdx);
  if (!signals || signals.totalInteractions < 5) return '';
  var context = '\n\n[BLOOM PERSONALIZATION:]\n';
  // Top 2 preferred categories
  var catKeys = Object.keys(signals.categories);
  if (catKeys.length > 0) {
    catKeys.sort(function(a, b) { return (signals.categories[b].score || 0) - (signals.categories[a].score || 0); });
    var topCats = catKeys.slice(0, 2).join(' and ');
    context += 'User prefers ' + topCats + ' content. Lean into these themes.\n';
  }
  // Top 2 preferred post types
  var typeKeys = Object.keys(signals.postTypes);
  if (typeKeys.length > 0) {
    typeKeys.sort(function(a, b) { return (signals.postTypes[b].score || 0) - (signals.postTypes[a].score || 0); });
    var topTypes = typeKeys.slice(0, 2).join(' and ');
    context += 'Preferred formats: ' + topTypes + '.\n';
  }
  // Engagement depth hint
  var commentCount = 0;
  var shareCount = 0;
  for (var i = 0; i < signals.recentSignals.length; i++) {
    if (signals.recentSignals[i].type === 'comment') commentCount++;
    if (signals.recentSignals[i].type === 'share') shareCount++;
  }
  if (commentCount > 3 || shareCount > 2) {
    context += 'User engages deeply - provide detailed, thorough analysis.\n';
  } else {
    context += 'User prefers concise, scannable content.\n';
  }
  return context;
}

// v22.12: Phase 2 - Dwell Tracking
function setupBloomDwellTracking() {
  if (_bloomDwellObserver) { _bloomDwellObserver.disconnect(); }
  _bloomDwellTimers = {};
  if (typeof IntersectionObserver === 'undefined') return;
  _bloomDwellObserver = new IntersectionObserver(function(entries) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var cardEl = entry.target;
      var postId = cardEl.id ? cardEl.id.replace('bloom-card-', '') : '';
      if (!postId) continue;
      if (entry.isIntersecting) {
        _bloomDwellTimers[postId] = Date.now();
      } else {
        if (_bloomDwellTimers[postId]) {
          var elapsed = Date.now() - _bloomDwellTimers[postId];
          var post = _bloomPosts.find(function(p) { return p.id === postId; });
          if (post) {
            if (elapsed > 3000) {
              bloomRecordSignal('dwell', post);
            } else if (elapsed < 1000) {
              bloomRecordSignal('skip', post);
            }
          }
          delete _bloomDwellTimers[postId];
        }
      }
    }
  }, { threshold: 0.5 });
}

function bloomRegisterCardForDwell(cardEl) {
  if (_bloomDwellObserver && cardEl) {
    _bloomDwellObserver.observe(cardEl);
  }
}

// v22.14: Video autoplay on scroll - play when visible, pause when not
function setupBloomVideoAutoplay() {
  if (_bloomVideoObserver) { _bloomVideoObserver.disconnect(); }
  if (typeof IntersectionObserver === 'undefined') return;
  _bloomVideoObserver = new IntersectionObserver(function(entries) {
    for (var i = 0; i < entries.length; i++) {
      var video = entries[i].target;
      if (entries[i].isIntersecting) {
        try { video.play(); } catch(e) {}
      } else {
        try { video.pause(); } catch(e) {}
      }
    }
  }, { threshold: 0.5 });
}

function bloomRegisterVideoForAutoplay(containerEl) {
  if (!_bloomVideoObserver) return;
  var videos = containerEl.querySelectorAll('.bloom-card-video');
  for (var i = 0; i < videos.length; i++) {
    _bloomVideoObserver.observe(videos[i]);
  }
}

// v22.12: Phase 2 - For You sorting and relevance
function bloomSortByRelevance(posts, brandIdx) {
  var signals = bloomGetSignals(brandIdx);
  if (!signals || signals.totalInteractions < 3) return posts.slice();
  var scored = [];
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    var score = 1.0;
    if (p.category && signals.categories[p.category]) {
      score += signals.categories[p.category].score * 0.4;
    }
    if (p.type && signals.postTypes[p.type]) {
      score += signals.postTypes[p.type].score * 0.3;
    }
    if (p.agent && signals.agents[p.agent]) {
      score += signals.agents[p.agent].score * 0.2;
    }
    if (p.operationId && signals.ops[String(p.operationId)]) {
      score += signals.ops[String(p.operationId)].score * 0.1;
    }
    scored.push({ post: p, score: score });
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  var result = [];
  for (var j = 0; j < scored.length; j++) result.push(scored[j].post);
  return result;
}

function bloomGetRecommendReason(post, signals) {
  if (!signals || signals.totalInteractions < 10) return '';
  // Find the strongest signal match
  var bestReason = '';
  var bestScore = 0;
  if (post.category && signals.categories[post.category] && signals.categories[post.category].score > bestScore) {
    bestScore = signals.categories[post.category].score;
    bestReason = 'Because you like ' + post.category.charAt(0).toUpperCase() + post.category.slice(1) + ' content';
  }
  if (post.agent && signals.agents[post.agent] && signals.agents[post.agent].score > bestScore) {
    bestScore = signals.agents[post.agent].score;
    var agentName = post.agent.charAt(0).toUpperCase() + post.agent.slice(1);
    bestReason = 'Based on your ' + agentName + ' preferences';
  }
  if (post.type && signals.postTypes[post.type] && signals.postTypes[post.type].score > bestScore) {
    bestScore = signals.postTypes[post.type].score;
    bestReason = 'You enjoy ' + post.type + ' posts';
  }
  if (!bestReason && signals.totalInteractions > 10) {
    bestReason = 'Based on your recent activity';
  }
  return bestReason;
}

function renderBloomStatsCard(brandIdx) {
  var signals = bloomGetSignals(brandIdx);
  if (!signals || signals.totalInteractions < 3) return '';
  var html = '<div class="bloom-stats-card">';
  html += '<div class="bloom-stats-header">';
  html += '<span class="bloom-stats-title">Your Feed Intelligence</span>';
  html += '<span class="bloom-stats-count">' + signals.totalInteractions + ' interactions</span>';
  html += '</div>';
  // Top category pills
  var catKeys = Object.keys(signals.categories);
  if (catKeys.length > 0) {
    catKeys.sort(function(a, b) { return (signals.categories[b].score || 0) - (signals.categories[a].score || 0); });
    html += '<div class="bloom-stats-pills">';
    for (var i = 0; i < Math.min(catKeys.length, 3); i++) {
      html += '<span class="bloom-stats-pill">' + catKeys[i].charAt(0).toUpperCase() + catKeys[i].slice(1) + '</span>';
    }
    html += '</div>';
  }
  // Personalization meter
  var pctPersonalized = Math.min(100, Math.round((1 - Math.max(0.20, 0.70 - signals.totalInteractions * 0.01)) * 125));
  html += '<div class="bloom-personalization-meter"><div class="bloom-personalization-fill" style="width:' + pctPersonalized + '%"></div></div>';
  html += '<div class="bloom-personalization-label"><span>Personalization</span><span>' + pctPersonalized + '%</span></div>';
  html += '</div>';
  return html;
}

function bloomRestoreInteractions(brandIdx) {
  var signals = bloomGetSignals(brandIdx);
  if (!signals) return;
  // Restore liked/saved states from signals to session
  for (var i = 0; i < _bloomPosts.length; i++) {
    var post = _bloomPosts[i];
    if (post.operationId) {
      var opId = String(post.operationId);
      if (signals.likedPostOps.indexOf(opId) !== -1) {
        _bloomLikedIds[post.id] = true;
        post.likeCount = Math.max(post.likeCount || 0, 1);
      }
      if (signals.savedPostOps.indexOf(opId) !== -1) {
        _bloomSavedIds[post.id] = true;
      }
    }
  }
}

function bloomIncrementSession(brandIdx) {
  var signals = bloomGetSignals(brandIdx);
  if (!signals) return;
  signals.totalSessions++;
  var hour = new Date().getHours();
  var slot = Math.floor(hour / 4);
  signals.timeSlots[slot]++;
  bloomSaveSignals(brandIdx, signals);
}

/**
 * v22.12: Background prefetch - generates bloom posts before user opens the view
 */
function bloomPrefetch() {
  if (_bloomPosts.length > 0 || _bloomGenerating) return;
  if (!brands || brands.length === 0) return;
  console.log('[Bloom] Prefetching content in background');
  generateBloomBatch(_bloomBatchSize);
}

// v25.2: Bloom Launch Modal
var _bloomLaunchType = null;
var _bloomLaunchTypes = ['text']; // v25.3: multi-select types

function showBloomLaunchModal() {
  var suggestions = [];
  var brand = brands[selectedBrand || 0];
  if (brand) {
    if (brand.keywords) {
      var kw = typeof brand.keywords === 'string' ? brand.keywords.split(',') : (brand.keywords || []);
      for (var ki = 0; ki < Math.min(kw.length, 2); ki++) {
        var trimmed = kw[ki].trim();
        if (trimmed) suggestions.push(trimmed);
      }
    }
    if (brand.industry) suggestions.push(brand.industry);
  }
  try {
    var goals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    for (var gi = 0; gi < Math.min(goals.length, 2); gi++) {
      if (goals[gi].name) suggestions.push(goals[gi].name);
    }
  } catch(e) {}
  suggestions = suggestions.slice(0, 6);

  var suggestionsHtml = '';
  if (suggestions.length > 0) {
    suggestionsHtml = '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;">Suggested topics:</div><div class="bloom-launch-suggestions">';
    for (var si = 0; si < suggestions.length; si++) {
      suggestionsHtml += '<button class="bloom-launch-suggestion" onclick="document.getElementById(\'bloomLaunchTopic\').value=this.textContent">' + escapeHtml(suggestions[si]) + '</button>';
    }
    suggestionsHtml += '</div>';
  }

  var overlay = document.createElement('div');
  overlay.id = 'bloomLaunchOverlay';
  overlay.className = 'bloom-launch-overlay';
  // v25.3: Multi-select content types with images as separate option
  overlay.innerHTML = '<div class="bloom-launch-modal">'
    + '<div class="bloom-launch-title">What would you like to explore?</div>'
    + '<div class="bloom-launch-subtitle">Select content types and an optional topic to focus your feed.</div>'
    + '<div class="bloom-launch-types">'
    + '<div class="bloom-launch-type-card selected" data-type="text" onclick="toggleBloomLaunchType(this)">'
    + '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 10h16M4 14h10M4 18h7"/></svg>'
    + '<div class="bloom-launch-type-label">Text</div></div>'
    + '<div class="bloom-launch-type-card" data-type="images" onclick="toggleBloomLaunchType(this)">'
    + '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
    + '<div class="bloom-launch-type-label">Images</div></div>'
    + '<div class="bloom-launch-type-card" data-type="infographics" onclick="toggleBloomLaunchType(this)">'
    + '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 17V11M12 17V7M16 17V13"/></svg>'
    + '<div class="bloom-launch-type-label">Info Graphics</div></div>'
    + '<div class="bloom-launch-type-card" data-type="videos" onclick="toggleBloomLaunchType(this)">'
    + '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>'
    + '<div class="bloom-launch-type-label">Videos</div></div>'
    + '</div>'
    + '<div style="margin-top:16px;">'
    + '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;font-weight:500;">What do you want to focus on?</div>'
    + '<input type="text" id="bloomLaunchTopic" class="bloom-launch-topic-input" placeholder="e.g. marketing strategy, brand growth, social media...">'
    + '</div>'
    + suggestionsHtml
    + '<div class="bloom-launch-pref">'
    + '<label><input type="radio" name="bloomLaunchPref" value="ask" checked> Ask me each time</label>'
    + '<label><input type="radio" name="bloomLaunchPref" value="remember"> Remember my choice</label>'
    + '</div>'
    + '<button class="bloom-launch-generate" id="bloomLaunchBtn" onclick="bloomSubmitLaunchChoice()">Generate Feed</button>'
    + '</div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeBloomLaunchModal(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('visible'); });
  _bloomLaunchTypes = ['text']; // v25.3: default to text selected
}

// v25.3: Multi-select toggle for content types
function toggleBloomLaunchType(el) {
  el.classList.toggle('selected');
  // Rebuild selected types array
  var cards = el.parentNode.querySelectorAll('.bloom-launch-type-card.selected');
  _bloomLaunchTypes = [];
  for (var i = 0; i < cards.length; i++) {
    _bloomLaunchTypes.push(cards[i].getAttribute('data-type'));
  }
}

// Legacy compat
function selectBloomLaunchType(el) { toggleBloomLaunchType(el); }

function closeBloomLaunchModal() {
  var overlay = document.getElementById('bloomLaunchOverlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
  }
}

function bloomSubmitLaunchChoice() {
  // v25.3: Use multi-select types, default to text if nothing selected
  var types = (typeof _bloomLaunchTypes !== 'undefined' && _bloomLaunchTypes.length > 0) ? _bloomLaunchTypes : ['text'];
  var topic = '';
  var topicEl = document.getElementById('bloomLaunchTopic');
  if (topicEl) topic = topicEl.value.trim();
  var prefRadios = document.querySelectorAll('input[name="bloomLaunchPref"]');
  var pref = 'ask';
  for (var i = 0; i < prefRadios.length; i++) {
    if (prefRadios[i].checked) { pref = prefRadios[i].value; break; }
  }
  localStorage.setItem('roweos_bloom_launch_pref', pref);
  if (pref === 'remember') {
    localStorage.setItem('roweos_bloom_launch_type', types.join(','));
    localStorage.setItem('roweos_bloom_launch_topic', topic);
  }
  closeBloomLaunchModal();
  bloomGenerateWithDirective(types.join(','), topic);
}

function bloomGenerateWithDirective(contentType, topic) {
  // v25.3: contentType can be comma-separated (e.g. "text,images,infographics")
  var types = contentType.split(',');
  window._bloomDirective = { type: contentType, types: types, topic: topic };

  // v25.3: Map multi-select types to content mode + sync media checkboxes
  var hasText = types.indexOf('text') >= 0;
  var hasImages = types.indexOf('images') >= 0;
  var hasVideo = types.indexOf('videos') >= 0;
  var hasInfographic = types.indexOf('infographics') >= 0;
  window._bloomWantInfographic = hasInfographic;

  // Sync checkbox UI
  var cbText = document.getElementById('bloomMediaText');
  var cbImages = document.getElementById('bloomMediaImages');
  var cbVideo = document.getElementById('bloomMediaVideo');
  var cbInfographic = document.getElementById('bloomMediaInfographic');
  if (cbText) cbText.checked = hasText;
  if (cbImages) cbImages.checked = hasImages;
  if (cbVideo) cbVideo.checked = hasVideo;
  if (cbInfographic) cbInfographic.checked = hasInfographic;

  // Determine content mode
  if (hasImages && hasVideo) _bloomContentMode = 'images_video_text';
  else if (hasImages) _bloomContentMode = 'images_text';
  else if (hasVideo) _bloomContentMode = 'video_text';
  else _bloomContentMode = 'text_only';
  if (hasImages && hasVideo && hasInfographic) _bloomContentMode = 'all_media';

  _bloomPosts = [];
  var feedContainer = document.getElementById('bloomFeed');
  if (feedContainer) feedContainer.innerHTML = '';
  generateBloomBatch(20);
}

/**
 * v22.11: Render Bloom view - called from showView('bloom')
 */
function renderBloom() {
  var brandIdx = selectedBrand || 0;
  var brand = brands[brandIdx] || brands[0];
  if (!brand && _bloomSource !== 'all') return;

  // v22.20: Apply Bloom default feed setting on first render
  if (!renderBloom._defaultApplied) {
    renderBloom._defaultApplied = true;
    var bloomDefault = localStorage.getItem('roweos_bloom_default_source') || 'match_brand';
    if (bloomDefault === 'match_brand') {
      _bloomSource = 'brand_' + (selectedBrand || 0);
    } else {
      _bloomSource = bloomDefault;
    }
  }

  // v25.3: Bloom Launch Modal -- show on first render if pref is "ask" or not set
  // No longer returns early -- lets filters and UI render behind the modal
  var _bloomShouldLaunch = false;
  if (!renderBloom._launchChecked) {
    renderBloom._launchChecked = true;
    var launchPref = localStorage.getItem('roweos_bloom_launch_pref') || 'ask';
    if (launchPref === 'ask') {
      _bloomShouldLaunch = true;
    } else if (launchPref === 'remember') {
      var savedType = localStorage.getItem('roweos_bloom_launch_type');
      var savedTopic = localStorage.getItem('roweos_bloom_launch_topic') || '';
      if (savedType) {
        bloomGenerateWithDirective(savedType, savedTopic);
      }
    }
  }

  // v22.12: Populate brand/life source selector
  var sel = document.getElementById('bloomBrandSelect');
  if (sel) {
    var html = '<option value="all"' + (_bloomSource === 'all' ? ' selected' : '') + '>All Profiles</option>';
    if (brands.length > 0) {
      html += '<optgroup label="BrandAI">';
      for (var bi = 0; bi < brands.length; bi++) {
        html += '<option value="brand_' + bi + '"' + (_bloomSource === 'brand_' + bi ? ' selected' : '') + '>' + escapeHtml(brands[bi].shortName || brands[bi].name) + '</option>';
      }
      html += '</optgroup>';
    }
    var lifeProfiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    if (lifeProfiles.length > 0) {
      html += '<optgroup label="LifeAI">';
      for (var li = 0; li < lifeProfiles.length; li++) {
        html += '<option value="life_' + li + '"' + (_bloomSource === 'life_' + li ? ' selected' : '') + '>' + escapeHtml(lifeProfiles[li].name || 'Life Profile') + '</option>';
      }
      html += '</optgroup>';
    }
    sel.innerHTML = html;
  }

  // v23.7: Sync media type checkboxes from stored mode (9.2)
  bloomSyncMediaCheckboxes();

  // v22.13: Update length select state
  var lenSelect = document.getElementById('bloomLengthSelect');
  if (lenSelect) lenSelect.value = _bloomPostLength;

  // v22.12: Dynamic filter pills based on source (brand vs life vs all)
  var isLifeSource = _bloomSource.indexOf('life_') === 0;
  var isBrandSource = _bloomSource.indexOf('brand_') === 0;
  var BLOOM_LIFE_FILTERS = [
    { id: 'foryou', label: 'For You' }, { id: 'all', label: 'All' },
    { id: 'planning', label: 'Planning' }, { id: 'development', label: 'Development' },
    { id: 'wellness', label: 'Wellness' }, { id: 'relationships', label: 'Relationships' },
    { id: 'finances', label: 'Analytics' }, { id: 'taxes', label: 'Taxes' },
    { id: 'creativity', label: 'Creativity' }, { id: 'saved', label: 'Saved' }
  ];
  var BLOOM_ALL_FILTERS = [
    { id: 'foryou', label: 'For You' }, { id: 'all', label: 'All' },
    { id: '_divBrand', label: 'BrandAI', divider: true },
    { id: 'strategy', label: 'Strategy' }, { id: 'marketing', label: 'Marketing' },
    { id: 'operations', label: 'Operations' }, { id: 'intelligence', label: 'Intelligence' }, { id: 'research', label: 'Research' },
    { id: '_divLife', label: 'LifeAI', divider: true },
    { id: 'planning', label: 'Planning' }, { id: 'wellness', label: 'Wellness' },
    { id: 'finances', label: 'Analytics' }, { id: 'taxes', label: 'Taxes' },
    { id: 'creativity', label: 'Creativity' },
    { id: '_divOther', label: '', divider: true },
    { id: 'image', label: 'Images' }, { id: 'video', label: 'Videos' }, { id: 'saved', label: 'Saved' }
  ];
  var activeFilters = isLifeSource ? BLOOM_LIFE_FILTERS : (isBrandSource ? BLOOM_FILTERS : BLOOM_ALL_FILTERS);
  var filtersEl = document.getElementById('bloomFilters');
  if (filtersEl) {
    var html = '';
    for (var i = 0; i < activeFilters.length; i++) {
      var f = activeFilters[i];
      if (f.divider) {
        if (f.label) html += '<span class="bloom-filter-divider">' + f.label + '</span>';
        else html += '<span class="bloom-filter-divider-line"></span>';
        continue;
      }
      html += '<button class="bloom-filter-pill' + (f.id === _bloomFilter ? ' active' : '') + '" data-filter="' + f.id + '" onclick="bloomFilter(\'' + f.id + '\')">' + f.label + '</button>';
    }
    filtersEl.innerHTML = html;
  }

  // If brand changed, start fresh. If posts exist (prefetched), just render.
  if (brandIdx !== _bloomLastBrandIdx) {
    _bloomPosts = [];
    _bloomLikedIds = {};
    bloomLoadSaved(brandIdx); // v22.51: Load persisted saves instead of resetting
    _bloomGenerating = false; // v22.12: Cancel any in-progress generation for old brand
    _bloomLastBrandIdx = brandIdx;
  }
  // v22.12: Default to For You if user has enough interactions
  var initSignals = bloomGetSignals(brandIdx);
  _bloomFilter = (initSignals && initSignals.totalInteractions >= 10) ? 'foryou' : 'all';

  if (_bloomPosts.length === 0) {
    bloomIncrementSession(brandIdx);
    renderBloomFeed();
    // v25.3: Don't auto-generate if launch modal is about to show
    if (!_bloomShouldLaunch) generateBloomBatch(_bloomBatchSize);
  } else {
    // v22.12: Restore liked/saved states from signals
    bloomRestoreInteractions(brandIdx);
    renderBloomFeed();
  }

  // Re-render filter pills after _bloomFilter may have changed (use same dynamic filters)
  if (filtersEl) {
    var pillHtml = '';
    for (var fi = 0; fi < activeFilters.length; fi++) {
      var ff = activeFilters[fi];
      if (ff.divider) {
        if (ff.label) pillHtml += '<span class="bloom-filter-divider">' + ff.label + '</span>';
        else pillHtml += '<span class="bloom-filter-divider-line"></span>';
        continue;
      }
      pillHtml += '<button class="bloom-filter-pill' + (ff.id === _bloomFilter ? ' active' : '') + '" data-filter="' + ff.id + '" onclick="bloomFilter(\'' + ff.id + '\')">' + ff.label + '</button>';
    }
    filtersEl.innerHTML = pillHtml;
    // v22.56: On mobile, append Library + Create as last items in scroll track
    if (window.innerWidth <= 768) {
      var libBtn = document.getElementById('bloomLibraryToggle');
      var createBtn = document.getElementById('bloomCreateBtn');
      if (libBtn) filtersEl.appendChild(libBtn);
      if (createBtn) filtersEl.appendChild(createBtn);
    }
  }

  // Setup infinite scroll + pull-to-refresh + scroll collapse
  setupBloomInfiniteScroll();
  setupBloomPullToRefresh();
  setupBloomScrollCollapse();

  // v22.16: Update content library badge count
  updateBloomLibraryCount();

  // v25.3: Show launch modal after UI is rendered (filters visible behind it)
  if (_bloomShouldLaunch) showBloomLaunchModal();
}

/**
 * v22.11: Show skeleton loading cards
 */
function showBloomSkeletons() {
  var feed = document.getElementById('bloomFeed');
  if (!feed) return;
  var html = '';
  for (var i = 0; i < 4; i++) {
    html += '<div class="bloom-skeleton"><div class="bloom-skeleton-line"></div><div class="bloom-skeleton-line"></div><div class="bloom-skeleton-line"></div><div class="bloom-skeleton-line"></div></div>';
  }
  feed.innerHTML = html;
}

/**
 * v22.11: Render the feed based on current filter
 */
function renderBloomFeed() {
  var feed = document.getElementById('bloomFeed');
  if (!feed) return;

  var filtered = getFilteredBloomPosts().filter(function(p) { return isBloomSeedComplete(p); });

  if (filtered.length === 0 && !_bloomGenerating) {
    feed.innerHTML = '<div class="bloom-empty">' +
      '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<ellipse cx="12" cy="6.5" rx="2.8" ry="4.5"/>' +
      '<ellipse cx="17" cy="10" rx="2.8" ry="4.5" transform="rotate(72 17 10)"/>' +
      '<ellipse cx="15.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(144 15.5 15.5)"/>' +
      '<ellipse cx="8.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(-144 8.5 15.5)"/>' +
      '<ellipse cx="7" cy="10" rx="2.8" ry="4.5" transform="rotate(-72 7 10)"/>' +
      '<circle cx="12" cy="11" r="2.2"/>' +
      '<path d="M12 14v8"/><path d="M10 18c-1.5-.5-2.5-1-3-2"/><path d="M14 18c1.5-.5 2.5-1 3-2"/></svg>' +
      '<div class="bloom-empty-title">Your seeds are growing</div>' +
      '<div class="bloom-empty-text">Bloom will generate fresh brand seeds momentarily.</div></div>';
    return;
  }

  var html = '';

  // v22.12: Stats card on For You tab
  if (_bloomFilter === 'foryou') {
    var brandIdx = selectedBrand || 0;
    html += renderBloomStatsCard(brandIdx);
  }

  // v23.7: Show all posts (Load More appends to _bloomPosts, no cap needed)
  var displayPosts = filtered;
  for (var i = 0; i < displayPosts.length; i++) {
    html += renderBloomPost(displayPosts[i]);
  }

  // v22.56: Sentinel kept for compatibility but infinite scroll is disabled
  html += '<div id="bloomSentinel" style="height:1px;"></div>';

  if (_bloomGenerating) {
    html += '<div class="bloom-generating">more seeds in bloom\u2026 <svg class="bloom-sprout-anim" viewBox="0 0 24 24"><ellipse class="seed" cx="12" cy="21" rx="3.5" ry="2"/><path class="stem" d="M12 20 C12 16 12 12 12 8"/><path class="leaf-l" d="M12 12 C10 10 7 10 6 12 C7 13 10 13 12 12Z"/><path class="leaf-r" d="M12 10 C14 8 17 8 18 10 C17 11 14 11 12 10Z"/><circle class="bloom-fl" cx="12" cy="5" r="2.5"/></svg></div>';
  }

  // v23.7: "Load More Seeds" button — appends more seeds to current feed (9.7)
  if (displayPosts.length > 0) {
    html += '<div class="bloom-load-more"><button onclick="bloomLoadMoreSeeds()" id="bloomLoadMoreBtn"' + (_bloomGenerating ? ' disabled' : '') + '>Load More Seeds</button></div>';
  }

  // v22.56: "Grow New Seeds" button at bottom of feed — always show if posts exist
  if (displayPosts.length > 0) {
    html += '<div class="bloom-grow-section">'
      + '<div class="bloom-grow-hint">New garden will replace current posts</div>'
      + '<button class="bloom-grow-btn" onclick="bloomGrowNewSeeds()"' + (_bloomGenerating ? ' disabled' : '') + '>'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">'
      + '<ellipse cx="12" cy="6.5" rx="2.8" ry="4.5"/>'
      + '<ellipse cx="17" cy="10" rx="2.8" ry="4.5" transform="rotate(72 17 10)"/>'
      + '<ellipse cx="15.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(144 15.5 15.5)"/>'
      + '<ellipse cx="8.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(-144 8.5 15.5)"/>'
      + '<ellipse cx="7" cy="10" rx="2.8" ry="4.5" transform="rotate(-72 7 10)"/>'
      + '<circle cx="12" cy="11" r="2.2"/>'
      + '<path d="M12 14v8"/></svg>'
      + ' Grow New Seeds</button></div>';
  }

  feed.innerHTML = html;
  setupBloomInfiniteScroll();

  // v22.12: Register cards for dwell tracking
  setupBloomDwellTracking();
  var cards = feed.querySelectorAll('.bloom-card');
  for (var d = 0; d < cards.length; d++) {
    bloomRegisterCardForDwell(cards[d]);
  }

  // v22.14: Video autoplay on scroll
  setupBloomVideoAutoplay();
  bloomRegisterVideoForAutoplay(feed);
}

/**
 * v22.11: Get posts matching current filter
 */
function getFilteredBloomPosts() {
  if (_bloomFilter === 'foryou') {
    // v22.12: Sort by relevance for For You tab
    var brandIdx = selectedBrand || 0;
    return bloomSortByRelevance(_bloomPosts, brandIdx);
  }
  if (_bloomFilter === 'all') return interleaveSeedsByCategory(_bloomPosts);
  if (_bloomFilter === 'saved') {
    // v22.56: Return persisted saved posts, not just matching current feed posts
    var savedArr = [];
    var savedKeys = Object.keys(_bloomSavedIds);
    for (var si = 0; si < savedKeys.length; si++) {
      var sp = _bloomSavedPosts[savedKeys[si]];
      if (sp) savedArr.push(sp);
    }
    // Sort by save time (newest first)
    savedArr.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    return savedArr;
  }
  if (_bloomFilter === 'image') {
    return _bloomPosts.filter(function(p) { return p.type === 'image'; });
  }
  if (_bloomFilter === 'video') {
    return _bloomPosts.filter(function(p) { return p.type === 'video'; });
  }
  if (_bloomFilter === 'idea') {
    return _bloomPosts.filter(function(p) { return p.type === 'idea'; });
  }
  // Agent/category filter
  return _bloomPosts.filter(function(p) {
    return p.agent === _bloomFilter || p.category === _bloomFilter;
  });
}

/**
 * v22.11: Render a single bloom card
 */
function renderBloomPost(post) {
  var agentColor = AGENT_COLORS[post.agent] || '#a89878';
  var timeAgo = bloomTimeAgo(post.timestamp);
  var isLiked = _bloomLikedIds[post.id];
  var isSaved = _bloomSavedIds[post.id];

  var html = '<div class="bloom-card" id="bloom-card-' + post.id + '" style="border: 1px solid ' + agentColor + '40; box-shadow: 0 0 12px ' + agentColor + '15, inset 0 0 30px ' + agentColor + '10; background: linear-gradient(135deg, ' + agentColor + '18 0%, ' + agentColor + '0a 50%, ' + agentColor + '14 100%);">';

  // Header - brand name as primary, like social media
  html += '<div class="bloom-card-header">';
  html += '<div class="bloom-agent-badge">';
  html += '<span class="bloom-agent-name" style="font-weight:600;color:var(--text-primary,#e8e4de)">' + escapeHtml(post.brandName || 'Brand') + '</span>';
  html += '</div>';
  html += '<span class="bloom-timestamp">' + timeAgo + '</span>';
  html += '</div>';

  // v22.12: Recommendation badge (For You tab only)
  if (_bloomFilter === 'foryou') {
    var recSignals = bloomGetSignals(selectedBrand || 0);
    var reason = bloomGetRecommendReason(post, recSignals);
    if (reason) {
      html += '<div class="bloom-rec-badge"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ' + escapeHtml(reason) + '</div>';
    }
  }

  // Title
  if (post.title) {
    html += '<div class="bloom-card-title">' + escapeHtml(post.title) + '</div>';
  }

  // Content - Video
  if (post.type === 'video') {
    if (post.videoPending) {
      // Loading placeholder
      var elapsed = post.videoProgress || 0;
      html += '<div class="bloom-card-video-placeholder" id="bloom-video-ph-' + post.id + '">';
      html += '<div class="bloom-video-placeholder-icon">&#9654;</div>';
      html += '<div class="bloom-video-placeholder-text">Generating video...</div>';
      html += '<div class="bloom-video-placeholder-sub" id="bloom-video-time-' + post.id + '">' + (elapsed > 0 ? elapsed + 's elapsed' : 'Starting...') + '</div>';
      html += '<div class="bloom-video-progress-bar"><div class="bloom-video-progress-fill"></div></div>';
      html += '</div>';
    } else if (post.videoError) {
      // v22.56: Friendly quota/rate-limit message vs generic error
      var _isQuota = post.videoError.toLowerCase().indexOf('quota') !== -1
        || post.videoError.toLowerCase().indexOf('rate') !== -1
        || post.videoError.toLowerCase().indexOf('429') !== -1
        || post.videoError.toLowerCase().indexOf('limit') !== -1
        || post.videoError.toLowerCase().indexOf('rpm') !== -1
        || post.videoError.toLowerCase().indexOf('exhausted') !== -1;
      html += '<div class="bloom-card-video-placeholder" style="' + (_isQuota ? 'border-color:var(--brand-accent,#a89878)40;' : '') + '">';
      if (_isQuota) {
        html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent,#a89878)" stroke-width="1.5" style="opacity:0.7;margin-bottom:6px;">'
          + '<ellipse cx="12" cy="6.5" rx="2.8" ry="4.5"/><ellipse cx="17" cy="10" rx="2.8" ry="4.5" transform="rotate(72 17 10)"/>'
          + '<ellipse cx="15.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(144 15.5 15.5)"/><ellipse cx="8.5" cy="15.5" rx="2.8" ry="4.5" transform="rotate(-144 8.5 15.5)"/>'
          + '<ellipse cx="7" cy="10" rx="2.8" ry="4.5" transform="rotate(-72 7 10)"/><circle cx="12" cy="11" r="2.2"/></svg>';
        html += '<div class="bloom-video-placeholder-text" style="color:var(--brand-accent,#a89878);">Video seeds are resting</div>';
        html += '<div class="bloom-video-placeholder-sub">API rate limit reached - new videos will bloom shortly</div>';
      } else {
        html += '<div class="bloom-video-placeholder-icon">&#10007;</div>';
        html += '<div class="bloom-video-placeholder-text">Video generation failed</div>';
        html += '<div class="bloom-video-placeholder-sub">' + escapeHtml(post.videoError) + '</div>';
      }
      html += '</div>';
    } else if (post.videoUrl) {
      // Ready - playable video
      html += '<div style="position:relative;">';
      html += '<video class="bloom-card-video" controls loop playsinline muted autoplay preload="metadata" src="' + post.videoUrl + '"></video>';
      // v22.52: Download button overlay
      html += '<button onclick="bloomDownloadVideo(\'' + post.id + '\')" title="Download video" style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;backdrop-filter:blur(4px);transition:background 0.2s;" onmouseover="this.style.background=\'rgba(0,0,0,0.85)\'" onmouseout="this.style.background=\'rgba(0,0,0,0.6)\'">';
      html += '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      html += '</button>';
      html += '</div>';
      html += '<div class="bloom-video-stats">';
      if (post.videoModel) html += '<span>' + escapeHtml(post.videoModel) + '</span>';
      if (post.videoDuration) html += '<span>' + post.videoDuration + 's</span>';
      if (post.videoGenTime) html += '<span>Generated in ' + post.videoGenTime + 's</span>';
      html += '</div>';
    } else if (post._hadVideo) {
      // Expired blob
      html += '<div class="bloom-card-video-placeholder expired">';
      html += '<div class="bloom-video-placeholder-text" style="font-size:12px;opacity:0.5">[Video expired - refresh to regenerate]</div>';
      html += '</div>';
    }
  }
  // Content - Image
  if (post.type === 'image' && post.imageData) {
    html += '<img class="bloom-card-image" src="' + post.imageData + '" alt="' + escapeHtml(post.title || 'Generated image') + '" onerror="bloomMediaError(\'' + post.id + '\')">';
  }
  // v23.8: Content - Infographic
  if (post.type === 'infographic' && post.imageData) {
    html += '<img class="bloom-card-image" src="' + post.imageData + '" alt="' + escapeHtml(post.title || 'Infographic') + '" onerror="bloomMediaError(\'' + post.id + '\')" style="border:1px solid var(--border-color);border-radius:8px;">';
  }
  if (post.content) {
    var rendered = '';
    try { rendered = typeof marked !== 'undefined' && marked.parse ? marked.parse(post.content) : post.content; } catch(e) { rendered = post.content; }
    html += '<div class="bloom-card-content">' + rendered + '</div>';
  }

  // Agent + Operation tags
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
  var agentLabel = post.agentLabel || (post.agent ? post.agent.charAt(0).toUpperCase() + post.agent.slice(1) + ' Agent' : '');
  if (agentLabel) {
    html += '<span class="bloom-op-tag" style="border-color:' + agentColor + '30;color:' + agentColor + '"><span class="bloom-agent-dot" style="background:' + agentColor + ';width:6px;height:6px;display:inline-block;border-radius:50%;margin-right:4px;vertical-align:middle"></span>' + escapeHtml(agentLabel) + '</span>';
  }
  if (post.operationName) {
    html += '<span class="bloom-op-tag bloom-op-tag-link" onclick="bloomGoToOperation(' + (post.operationId || 0) + ')" title="Open in Studio">' + escapeHtml(post.operationName) + '</span>';
  }
  html += '</div>';

  // Actions
  html += '<div class="bloom-actions">';
  html += '<button class="bloom-action-btn' + (isLiked ? ' liked' : '') + '" onclick="bloomLike(\'' + post.id + '\')">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
    (post.likeCount ? ' ' + post.likeCount : '') + '</button>';
  html += '<button class="bloom-action-btn" onclick="bloomToggleComments(\'' + post.id + '\')">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
    (post.comments && post.comments.length ? ' ' + post.comments.length : '') + '</button>';
  html += '<button class="bloom-action-btn' + (isSaved ? ' saved' : '') + '" onclick="bloomSave(\'' + post.id + '\')">' +
    '<svg viewBox="0 0 24 24" fill="' + (isSaved ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>';
  // v25.0: Save to Folio button
  html += '<button class="bloom-action-btn" onclick="bloomSaveToFolio(\'' + post.id + '\')" title="Save to Folio">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg></button>';
  // v22.22: Updated icons to match sidebar for consistency
  html += '<button class="bloom-action-btn" onclick="bloomShareToChat(\'' + post.id + '\')" title="Share to Chat">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 15 10-15-10-5z"/><path d="M2 7h20"/></svg></button>';
  html += '<button class="bloom-action-btn" onclick="bloomAddToPulse(\'' + post.id + '\')" title="Add to Pulse">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.09 6.26L20 9.27l-4 3.87.94 5.86L12 16.27 7.06 19l.94-5.86-4-3.87 5.91-1.01L12 2z"/></svg></button>';
  html += '<button class="bloom-action-btn" onclick="bloomCreateAutomation(\'' + post.id + '\')" title="Create Automation">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/><path d="M13 8l3-5M11 16l-3 5"/></svg></button>';
  // v25.1: Post to Social button with editable caption
  if (post.type === 'social' || post.type === 'insight' || post.content) {
    html += '<button class="bloom-action-btn" onclick="bloomShowSocialPost(\'' + post.id + '\')" title="Post to Social">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>';
  }
  // v23.8: Push to Identity button
  html += '<button class="bloom-action-btn" onclick="bloomShowIdentityPush(\'' + post.id + '\')" title="Push to Identity">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 14v3m-2-1.5h4"/></svg></button>';
  html += '</div>';
  // v23.8: Push to Identity section picker (hidden by default)
  html += '<div class="bloom-identity-push" id="bloom-identity-push-' + post.id + '" style="display:none;">';
  html += '<div style="font-size:12px;font-weight:500;color:var(--text-secondary);margin-bottom:6px;">Push insight to Identity:</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
  var idSections = [['essence','Essence'],['voice','Voice'],['audience','Audience'],['messaging','Messaging'],['products','Products'],['visual','Visual'],['competitive','Competitive']];
  for (var ids = 0; ids < idSections.length; ids++) {
    html += '<button class="bloom-identity-section-btn" onclick="bloomPushToIdentity(\'' + post.id + '\',\'' + idSections[ids][0] + '\')" style="font-size:11px;padding:4px 8px;background:var(--bg-tertiary,rgba(255,255,255,0.05));border:1px solid var(--border-color);border-radius:4px;color:var(--text-secondary);cursor:pointer;transition:all 0.15s;" onmouseover="this.style.borderColor=\'var(--brand-accent,#a89878)\';this.style.color=\'var(--brand-accent,#a89878)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-secondary)\'">' + idSections[ids][1] + '</button>';
  }
  html += '</div></div>';

  // v25.1: Social post panel (hidden by default)
  var _bloomPostCaption = '';
  if (post.content) {
    _bloomPostCaption = post.content.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '').trim();
    if (_bloomPostCaption.length > 500) _bloomPostCaption = _bloomPostCaption.substring(0, 497) + '...';
  } else if (post.title) {
    _bloomPostCaption = post.title;
  }
  html += '<div class="bloom-identity-push" id="bloom-social-post-' + post.id + '" style="display:none;">';
  html += '<div style="font-size:12px;font-weight:500;color:var(--text-secondary);margin-bottom:8px;">Post to Social</div>';
  html += '<textarea id="bloom-social-caption-' + post.id + '" style="width:100%;min-height:80px;font-size:13px;color:var(--text-primary);background:var(--bg-tertiary,rgba(255,255,255,0.05));border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;resize:vertical;font-family:inherit;line-height:1.5;box-sizing:border-box;" placeholder="Edit caption before posting...">' + escapeHtml(_bloomPostCaption) + '</textarea>';
  html += '<div style="display:flex;gap:8px;margin-top:8px;">';
  html += '<button onclick="bloomPostToSocial(\'' + post.id + '\')" style="flex:1;padding:7px 12px;background:var(--brand-accent,#a89878);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Post Now</button>';
  html += '<button onclick="bloomOpenPublisherWithCaption(\'' + post.id + '\')" style="padding:7px 12px;background:var(--bg-tertiary,rgba(255,255,255,0.05));border:1px solid var(--border-color);border-radius:6px;font-size:12px;color:var(--text-secondary);cursor:pointer;">Open Publisher</button>';
  html += '</div></div>';

  // Comments section (hidden by default)
  html += '<div class="bloom-comments" id="bloom-comments-' + post.id + '" style="display:none;">';
  if (post.comments && post.comments.length > 0) {
    for (var c = 0; c < post.comments.length; c++) {
      html += renderBloomComment(post.comments[c]);
    }
  }
  html += '<div class="bloom-comment-input-wrap">';
  html += '<textarea class="bloom-comment-input" rows="1" id="bloom-input-' + post.id + '" placeholder="Add a comment..." oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\'" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();bloomComment(\'' + post.id + '\');}"></textarea>';
  html += '<button class="bloom-comment-send" onclick="bloomComment(\'' + post.id + '\')">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>';
  html += '</div></div>';

  html += '</div>';
  return html;
}

/**
 * v22.11: Render a single comment
 */
function renderBloomComment(comment) {
  var bgColor = comment.isAI ? 'var(--brand-accent, #a89878)' : '#6b6560';
  var label = comment.isAI ? 'AI' : 'You';
  var time = bloomTimeAgo(comment.timestamp);
  // v22.26: AI comments render as rich text (markdown), user comments stay escaped
  var textHtml = comment.isAI && typeof marked !== 'undefined' && marked.parse
    ? '<span class="bloom-comment-text bloom-comment-rich">' + marked.parse(comment.text) + '</span>'
    : '<span class="bloom-comment-text">' + escapeHtml(comment.text) + '</span>';
  return '<div class="bloom-comment">' +
    '<div class="bloom-comment-avatar" style="background:' + bgColor + '">' + label.charAt(0) + '</div>' +
    '<div class="bloom-comment-body">' +
    '<span class="bloom-comment-author">' + label + '</span>' +
    textHtml +
    '<div class="bloom-comment-time">' + time + '</div>' +
    '</div></div>';
}

/**
 * v22.11: Time ago helper
 */
function bloomTimeAgo(ts) {
  var diff = Date.now() - ts;
  var sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  var min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  return Math.floor(hr / 24) + 'd ago';
}

/**
 * v22.11: Core batch content generator
 */
async function generateBloomBatch(count) {
  if (_bloomGenerating) return;
  _bloomGenerating = true;

  // Update UI to show generating state
  var sentinel = document.getElementById('bloomSentinel');
  if (sentinel) {
    sentinel.insertAdjacentHTML('afterend', '<div class="bloom-generating" id="bloomGenIndicator">more seeds in bloom\u2026 <svg class="bloom-sprout-anim" viewBox="0 0 24 24"><ellipse class="seed" cx="12" cy="21" rx="3.5" ry="2"/><path class="stem" d="M12 20 C12 16 12 12 12 8"/><path class="leaf-l" d="M12 12 C10 10 7 10 6 12 C7 13 10 13 12 12Z"/><path class="leaf-r" d="M12 10 C14 8 17 8 18 10 C17 11 14 11 12 10Z"/><circle class="bloom-fl" cx="12" cy="5" r="2.5"/></svg></div>');
  }

  // v22.12: Resolve source to brand list
  var bloomBrands = [];
  if (_bloomSource === 'all') {
    for (var ab = 0; ab < brands.length; ab++) bloomBrands.push({ type: 'brand', idx: ab, brand: brands[ab] });
    var lifeP = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    for (var lp = 0; lp < lifeP.length; lp++) bloomBrands.push({ type: 'life', idx: lp, brand: { name: lifeP[lp].name || 'LifeAI', shortName: lifeP[lp].name || 'LifeAI' } });
  } else if (_bloomSource.indexOf('life_') === 0) {
    var liIdx = parseInt(_bloomSource.replace('life_', ''));
    var lifeP2 = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    if (lifeP2[liIdx]) bloomBrands.push({ type: 'life', idx: liIdx, brand: { name: lifeP2[liIdx].name || 'LifeAI', shortName: lifeP2[liIdx].name || 'LifeAI' } });
  } else {
    var bIdx = _bloomSource.indexOf('brand_') === 0 ? parseInt(_bloomSource.replace('brand_', '')) : (selectedBrand || 0);
    if (brands[bIdx]) bloomBrands.push({ type: 'brand', idx: bIdx, brand: brands[bIdx] });
  }
  if (bloomBrands.length === 0 && brands[0]) bloomBrands.push({ type: 'brand', idx: 0, brand: brands[0] });

  // v25.3: Content mode is already set by bloomGenerateWithDirective, no override needed here
  var directive = window._bloomDirective || null;

  // Get API provider from first brand's settings
  var brandIdx = bloomBrands[0].idx;
  var brand = bloomBrands[0].brand;
  var provider = null;
  var model = null;
  var apiKey = null;

  try {
    var bSettings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
    provider = bSettings.provider || (brand && brand.provider) || 'anthropic';
    model = bSettings.model || (brand && brand.model) || 'claude-sonnet-4-6';
    if (provider === 'roweos' && typeof resolveRoweOSAI === 'function') {
      try { var _resolved = resolveRoweOSAI({ userMessage: 'Generate brand content', systemPrompt: '' }); provider = _resolved.provider; model = _resolved.model; } catch(routeErr) { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
    }
    // v22.49: For text gen, use selectedProvider — nanobanana can't do text so fall back
    if (provider === 'nanobanana') {
      var selProv = localStorage.getItem('selectedProvider') || 'google';
      if (selProv !== 'nanobanana') { provider = selProv; }
      else { provider = 'google'; }
      var bs2 = brandSettings[brandIdx];
      model = (bs2 && bs2.model) || (provider === 'google' ? 'gemini-3.1-pro-preview' : provider === 'openai' ? 'gpt-5.5' : 'claude-sonnet-4-6');
    }
    apiKey = await getApiKey(provider);
    if (!apiKey) {
      var available = getAvailableProviders();
      if (available.google) { provider = 'google'; model = 'gemini-3.1-pro-preview'; apiKey = await getApiKey('google'); }
      else if (available.openai) { provider = 'openai'; model = 'gpt-5.5'; apiKey = await getApiKey('openai'); }
      else if (available.anthropic) { provider = 'anthropic'; model = 'claude-sonnet-4-6'; apiKey = await getApiKey('anthropic'); }
    }
  } catch(e) { console.warn('[Bloom] API key error:', e); }

  if (!apiKey) {
    _bloomGenerating = false;
    var genInd = document.getElementById('bloomGenIndicator');
    if (genInd) genInd.remove();
    showToast('Add an API key in Settings to use Bloom', 'warning');
    return;
  }
  console.log('[Bloom] Using provider:', provider, 'model:', model, 'sources:', bloomBrands.length);

  // v22.12: Distribute ops across all source brands round-robin
  var allSelected = [];
  var perBrand = Math.max(2, Math.ceil(count / bloomBrands.length));
  for (var bb = 0; bb < bloomBrands.length; bb++) {
    var bbItem = bloomBrands[bb];
    var bbIdx = bbItem.idx;
    var bbBrand = bbItem.brand;
    var bbName = bbBrand.shortName || bbBrand.name;
    // v22.12: Use lifeOps for LifeAI sources, brand ops for BrandAI
    var bbOps;
    if (bbItem.type === 'life') {
      var lifeOpsArr = typeof window.lifeOps !== 'undefined' ? window.lifeOps : [];
      var genLifeOps = [];
      try { genLifeOps = JSON.parse(localStorage.getItem('roweos_generated_life_ops') || '[]'); } catch(e) {}
      bbOps = lifeOpsArr.concat(genLifeOps).filter(function(o) { return !o.isVideoOp && !o.isConversational; });
      if (_bloomContentMode === 'text_only' || _bloomContentMode === 'video_text') bbOps = bbOps.filter(function(o) { return !o.isImageOp; });
    } else {
      bbOps = ops.filter(function(o) { return !o.isVideoOp && !o.isConversational && (o.brand === null || o.brand === bbIdx); });
      if (_bloomContentMode === 'text_only' || _bloomContentMode === 'video_text') bbOps = bbOps.filter(function(o) { return !o.isImageOp; });
    }
    if (bbOps.length === 0) continue;
    var bbSel = bloomSelectWeightedOps(bbOps, Math.min(perBrand, bbOps.length), bbIdx);
    var bbPrompt = bbItem.type === 'life' && typeof buildLifeAISystemPrompt === 'function' ? buildLifeAISystemPrompt() : buildBrandSystemPrompt(bbBrand, 'strategy');
    var bbCtx = getBloomLearningContext(bbIdx);
    if (bbCtx) bbPrompt += bbCtx;
    // v22.17: Inject bloom knowledge preferences
    var bbKnowledge = getBloomKnowledgePrompt(bbIdx);
    if (bbKnowledge) bbPrompt += '\n' + bbKnowledge;
    for (var bs = 0; bs < bbSel.length; bs++) {
      allSelected.push({ op: bbSel[bs], brand: bbBrand, brandName: bbName, brandIdx: bbIdx, systemPrompt: bbPrompt, isLife: bbItem.type === 'life' });
    }
  }
  // Shuffle for natural feed mix
  allSelected.sort(function() { return Math.random() - 0.5; });
  var selected = allSelected.slice(0, count);

  // v22.13: Ensure 2 image slots per batch when nanobanana key available (respects content mode)
  var hasNBKey = typeof getNanobananaKey === 'function' && getNanobananaKey();
  var wantsImages = _bloomContentMode === 'images_text' || _bloomContentMode === 'all_media' || _bloomContentMode === 'images_video_text';
  if (hasNBKey && selected.length >= 4 && wantsImages) {
    var imageOps = ops.filter(function(o) { return o.isImageOp; });
    if (imageOps.length > 0) {
      // Replace 2 random slots with image ops
      var imgSlots = [Math.floor(selected.length / 3), Math.floor(selected.length * 2 / 3)];
      for (var is = 0; is < imgSlots.length; is++) {
        var imgOp = imageOps[Math.floor(Math.random() * imageOps.length)];
        selected[imgSlots[is]].op = imgOp;
      }
    }
  }

  // v22.14: Inject 1 video op at midpoint when video mode is active and Google API key available
  var wantsVideo = _bloomContentMode === 'all_media' || _bloomContentMode === 'video_text' || _bloomContentMode === 'images_video_text';
  var hasGoogleKey = false;
  try { hasGoogleKey = !!(await getApiKey('google')); } catch(e) {}
  console.warn('[Bloom] Video check: wantsVideo=' + wantsVideo + ' hasGoogleKey=' + hasGoogleKey + ' mode=' + _bloomContentMode + ' selected=' + selected.length);
  if (wantsVideo && !hasGoogleKey) {
    showToast('Add a Google API key in Settings to enable video generation', 'warning');
  }
  if (wantsVideo && hasGoogleKey && selected.length >= 3) {
    var videoOps = ops.filter(function(o) { return o.isVideoOp; });
    console.warn('[Bloom] Found ' + videoOps.length + ' video ops, injecting at slot ' + Math.floor(selected.length / 2));
    if (videoOps.length > 0) {
      var vidOp = videoOps[Math.floor(Math.random() * videoOps.length)];
      var vidSlot = Math.floor(selected.length / 2);
      selected[vidSlot].op = vidOp;
      selected[vidSlot]._isVideoSlot = true;
    }
  }

  // v23.8: Inject 1 infographic slot when infographic checkbox is active
  var wantsInfographic = !!window._bloomWantInfographic;
  if (wantsInfographic && selected.length >= 3) {
    // Pick a random op for infographic data source
    var infSlot = Math.floor(selected.length * 0.7);
    selected[infSlot]._isInfographicSlot = true;
  }

  var bloomSignals = bloomGetSignals(brandIdx);
  var batchSource = _bloomSource; // Track for stale guard

  // v23.7: Reset generation stats for this batch (9.5/9.6)
  _bloomGenStats = { attempted: selected.length, succeeded: 0, failed: 0, consecutiveFailures: _bloomGenStats.consecutiveFailures };
  removeBloomStatusMessage();
  if (_bloomCooldown.active) { _bloomGenerating = false; return; }

  // v23.8: Four-way sort - text, image, video, infographic items
  var textItems = [];
  var imageItems = [];
  var videoItems = [];
  var infographicItems = [];
  for (var si = 0; si < selected.length; si++) {
    if (selected[si]._isInfographicSlot) infographicItems.push(selected[si]);
    else if (selected[si]._isVideoSlot || selected[si].op.isVideoOp) videoItems.push(selected[si]);
    else if (selected[si].op.isImageOp) imageItems.push(selected[si]);
    else textItems.push(selected[si]);
  }

  // Generate first image immediately so it appears at the top of the feed (only if user wants images)
  if (imageItems.length > 0 && wantsImages) {
    if (_bloomSource !== batchSource) { _bloomGenerating = false; return; }
    try {
      var firstImg = imageItems.shift();
      var imgPost = await generateSingleBloomPost(firstImg.op, 'image', firstImg.brand, firstImg.brandName, firstImg.brandIdx, firstImg.systemPrompt, provider, model, apiKey);
      if (imgPost) {
        _bloomPosts.unshift(imgPost); // Put at the very top
        appendBloomPostToFeed(imgPost);
      }
    } catch(firstImgErr) {
      console.warn('[Bloom] Lead image failed:', firstImgErr);
      _bloomGenStats.failed++;
      var rlSec = bloomCheckRateLimit(firstImgErr);
      if (rlSec > 0) { startBloomCooldown(rlSec); _bloomGenerating = false; return; }
    }
  }

  // Generate text posts in parallel batches of 3
  var promises = [];
  for (var i = 0; i < textItems.length; i++) {
    var item = textItems[i];
    var postType = bloomSelectWeightedPostType(item.op, bloomSignals);
    promises.push(generateSingleBloomPost(item.op, postType, item.brand, item.brandName, item.brandIdx, item.systemPrompt, provider, model, apiKey));
    if (promises.length >= 3 || i === textItems.length - 1) {
      var results = await Promise.allSettled(promises);
      if (_bloomSource !== batchSource) { _bloomGenerating = false; return; }
      for (var r = 0; r < results.length; r++) {
        if (results[r].status === 'fulfilled' && results[r].value) {
          _bloomPosts.push(results[r].value);
          appendBloomPostToFeed(results[r].value);
          _bloomGenStats.succeeded++;
        } else {
          _bloomGenStats.failed++;
          // v23.7: Check for rate limit (9.6)
          if (results[r].reason) {
            var rlSec = bloomCheckRateLimit(results[r].reason);
            if (rlSec > 0) { startBloomCooldown(rlSec); _bloomGenerating = false; return; }
          }
        }
      }
      promises = [];
    }
  }

  // Generate image posts one at a time (nanobanana needs sequential calls)
  for (var ii = 0; ii < imageItems.length; ii++) {
    if (_bloomSource !== batchSource) { _bloomGenerating = false; return; }
    try {
      var imgItem = imageItems[ii];
      var imgPost = await generateSingleBloomPost(imgItem.op, 'image', imgItem.brand, imgItem.brandName, imgItem.brandIdx, imgItem.systemPrompt, provider, model, apiKey);
      if (imgPost) {
        _bloomPosts.push(imgPost);
        appendBloomPostToFeed(imgPost);
        _bloomGenStats.succeeded++;
      } else { _bloomGenStats.failed++; }
    } catch(imgBatchErr) {
      console.warn('[Bloom] Image batch item failed:', imgBatchErr);
      _bloomGenStats.failed++;
      var rlSec2 = bloomCheckRateLimit(imgBatchErr);
      if (rlSec2 > 0) { startBloomCooldown(rlSec2); _bloomGenerating = false; return; }
    }
  }

  // v22.14: Fire-and-forget video generation (non-blocking)
  console.warn('[Bloom] Video items to generate:', videoItems.length);
  for (var vi = 0; vi < videoItems.length; vi++) {
    var vidItem = videoItems[vi];
    console.warn('[Bloom] Firing video gen for:', vidItem.op.name);
    bloomGenerateVideoPost(vidItem, provider, model, apiKey, batchSource);
  }

  // v23.8: Generate infographic posts sequentially
  for (var ini = 0; ini < infographicItems.length; ini++) {
    if (_bloomSource !== batchSource) { _bloomGenerating = false; return; }
    try {
      var infItem = infographicItems[ini];
      var infPost = await generateSingleBloomPost(infItem.op, 'infographic', infItem.brand, infItem.brandName, infItem.brandIdx, infItem.systemPrompt, provider, model, apiKey);
      if (infPost) {
        _bloomPosts.push(infPost);
        appendBloomPostToFeed(infPost);
        _bloomGenStats.succeeded++;
      } else { _bloomGenStats.failed++; }
    } catch(infBatchErr) {
      console.warn('[Bloom] Infographic batch item failed:', infBatchErr);
      _bloomGenStats.failed++;
    }
  }

  _bloomGenerating = false;
  // v25.2: Clear directive after generation
  window._bloomDirective = null;
  var genInd2 = document.getElementById('bloomGenIndicator');
  if (genInd2) genInd2.remove();

  // Remove skeletons if they exist
  var skeletons = document.querySelectorAll('.bloom-skeleton');
  for (var s = 0; s < skeletons.length; s++) {
    skeletons[s].remove();
  }

  // v23.7: Show status messages based on generation results (9.5)
  if (_bloomGenStats.succeeded === 0 && _bloomGenStats.failed > 0) {
    _bloomGenStats.consecutiveFailures++;
    showBloomStatusMessage('full');
  } else if (_bloomGenStats.failed > 0 && _bloomGenStats.succeeded > 0) {
    _bloomGenStats.consecutiveFailures = 0;
    showBloomStatusMessage('partial');
  } else {
    _bloomGenStats.consecutiveFailures = 0;
  }

  // Re-setup infinite scroll
  setupBloomInfiniteScroll();
}

/**
 * v22.11: Pick a post type based on operation category
 */
function pickBloomPostType(category) {
  // v22.12: Fallback random selection (main path uses bloomSelectWeightedPostType)
  var types = BLOOM_CATEGORY_MAP[category] || BLOOM_POST_TYPES;
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * v22.11: Generate a single bloom post via AI
 */
async function generateSingleBloomPost(op, postType, brand, brandName, brandIdx, systemPrompt, provider, model, apiKey) {
  // v22.12: No em-dashes, plain text only
  // v22.13: Post length: short, long, or mix (random per post)
  var isLong = _bloomPostLength === 'long' || (_bloomPostLength === 'mix' && Math.random() > 0.5);
  var noEmDash = ' Never use em-dashes or en-dashes. Output plain text only - no JSON, no code blocks.';
  var styleRule = isLong
    ? ' FORMAT: Write a thorough, well-structured analysis. 400-600 words. Use subheadings, numbered lists, and bold key terms. Provide detailed strategic context and multiple actionable recommendations.' + noEmDash
    : ' FORMAT: Write like a social media post or short LinkedIn article. MAX 150 words. No giant headers. One bold hook line, then 2-3 short paragraphs max. End with a single actionable takeaway.' + noEmDash;
  var typePrompts = {
    insight: (isLong
      ? 'Generate a comprehensive insight for ' + brandName + ' about: ' + op.name + '. Include strategic context, actionable takeaways, and specific recommendations.'
      : 'Write a short, punchy insight for ' + brandName + ' about: ' + op.name + '. Lead with a bold hook, then 2-3 tight sentences of value. End with one clear takeaway.') + styleRule,
    social: 'Draft a social media post for ' + brandName + ' about: ' + op.name + '. Punchy, engaging, ready to post. Include a call-to-action.' + (isLong ? ' 200-300 words.' : ' Under 100 words.') + noEmDash,
    idea: (isLong
      ? 'Generate a detailed creative brand idea for ' + brandName + ' related to: ' + op.name + '. Describe the concept, execution strategy, expected outcomes, and implementation steps.'
      : 'Pitch a creative brand idea for ' + brandName + ' related to: ' + op.name + '. One bold concept statement, then 2-3 sentences explaining why it works.') + styleRule,
    analysis: (isLong
      ? 'Provide a detailed strategic analysis for ' + brandName + ' on: ' + op.name + '. Include market positioning, key metrics to watch, competitive context, and 3-5 specific recommendations.'
      : 'Give a quick strategic take for ' + brandName + ' on: ' + op.name + '. One key insight, one metric to watch, one recommendation. Keep it tight.') + styleRule,
    image: 'Create a vivid, detailed image description for ' + brandName + ' related to: ' + op.name + '. Describe the ideal brand image in one paragraph.' + noEmDash
  };

  var userPrompt = typePrompts[postType] || typePrompts.insight;

  // v25.3: Inject launch directive topic and content type modifiers
  var directive = window._bloomDirective || null;
  if (directive) {
    if (directive.topic) {
      // Strong topic injection - prepend focus directive so AI centers content around the topic
      userPrompt = 'IMPORTANT: The user wants content specifically about "' + directive.topic + '". Frame everything through the lens of ' + directive.topic + ' for ' + brandName + '. ' + userPrompt;
    }
    var dTypes = directive.types || [directive.type];
    if (dTypes.indexOf('infographics') >= 0 && postType !== 'image') {
      userPrompt += ' FORMAT as an info graphic layout: use numbered points, clear data labels, and visual hierarchy suitable for a designed infographic.';
    } else if (dTypes.indexOf('videos') >= 0 && postType !== 'image') {
      userPrompt += ' FORMAT as a video script: include a hook (first 3 seconds), key talking points, visual cues, and a call-to-action.';
    }
  }

  // Title generation - extract from prompt
  var titlePrompts = {
    insight: op.name,
    social: brandName + ' - ' + op.name,
    idea: 'Idea: ' + op.name,
    analysis: op.name + ' Analysis',
    image: op.name
  };

  var title = titlePrompts[postType] || op.name;
  var agentForOp = op.category === 'strategic' ? 'strategy' : (op.category || 'strategy');

  try {
    var content = '';

    // v23.8: Infographic generation for Bloom
    if (postType === 'infographic' && typeof generateInfographicForPipeline === 'function') {
      try {
        console.log('[Bloom] Generating infographic for:', op.name);
        var infDataUrl = await generateInfographicForPipeline(op.name + ': ' + (op.desc || ''), brandIdx, {});
        if (infDataUrl) {
          // Generate a short summary caption
          var infCaption = op.desc || op.name;
          try {
            var capPrompt = 'Write a 2-sentence summary for an infographic about "' + brandName + ' - ' + op.name + '". Be concise and informative. Never use em-dashes.';
            var capMsgs = [{ role: 'user', content: capPrompt }];
            if (provider === 'anthropic') infCaption = await callAnthropicAPI(model, apiKey, capMsgs, systemPrompt);
            else if (provider === 'google') infCaption = await callGoogleAPI(model, apiKey, capMsgs, systemPrompt);
            else if (provider === 'openai') infCaption = await callOpenAIAPI(model, apiKey, capMsgs, systemPrompt);
            if (infCaption) infCaption = infCaption.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
          } catch(capErr) { console.warn('[Bloom] Infographic caption failed:', capErr); }
          return {
            id: 'bloom_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            type: 'infographic',
            agent: 'infographic',
            agentLabel: 'Infographic Agent',
            category: 'infographic',
            title: title,
            content: infCaption,
            imageData: infDataUrl,
            operationId: op.id,
            operationName: op.name,
            brandIdx: brandIdx,
            brandName: brandName,
            timestamp: Date.now() - Math.floor(Math.random() * 600000),
            liked: false,
            saved: false,
            likeCount: 0,
            comments: []
          };
        }
      } catch(infErr) {
        console.warn('[Bloom] Infographic gen failed, falling back to text:', infErr);
        postType = 'insight';
        userPrompt = typePrompts.insight;
      }
    }

    if (postType === 'image' && typeof generateImageWithNanobanana === 'function' && typeof getNanobananaKey === 'function' && getNanobananaKey()) {
      // v22.13: Generate actual image - silently, no toast on failure (suppressToasts)
      try {
        console.log('[Bloom] Generating image for:', op.name);
        // v22.13: Build rich, brand-aware image prompt
        var imgCtx = '';
        if (brand.industry) imgCtx += ' Industry: ' + brand.industry + '.';
        if (brand.products) imgCtx += ' What they do: ' + brand.products + '.';
        if (brand.tagline) imgCtx += ' Brand tagline: ' + brand.tagline + '.';
        if (brand.audience) imgCtx += ' Target audience: ' + brand.audience + '.';
        if (brand.positioning) imgCtx += ' Positioning: ' + brand.positioning + '.';
        if (brand.voice) imgCtx += ' Brand voice: ' + brand.voice + '.';
        var imgColorHint = '';
        if (brand.visual && brand.visual.colors && brand.visual.colors.length > 0) {
          imgColorHint = ' Brand colors: ' + brand.visual.colors.slice(0, 3).join(', ') + '.';
        } else if (brand.brandColor) {
          imgColorHint = ' Brand accent color: ' + brand.brandColor + '.';
        }
        var imgPrompt = 'Generate a high-quality, photorealistic brand image for "' + brandName + '".' + imgCtx + imgColorHint
          + ' Subject: ' + (op.desc || op.name) + '.'
          + ' Style: Premium, editorial-quality photography. Clean composition, professional lighting, modern aesthetic.'
          + ' The image should authentically represent what this brand does and feels like.'
          + ' IMPORTANT: Do NOT include any text, words, logos, watermarks, or typography in the image. Pure visual content only.';
        // v22.17: Inject bloom knowledge into image prompt
        var _imgKnowledge = getBloomKnowledgePrompt(brandIdx);
        if (_imgKnowledge) imgPrompt += ' ' + _imgKnowledge;
        // v22.16: Inject content library reference images
        var _libRefs = getBloomLibraryReferences(brandIdx, agentForOp, 2);
        var _imgOpts = { suppressToasts: true };
        if (_libRefs.length > 0) {
          _imgOpts.referenceImages = _libRefs;
          imgPrompt += ' Use the provided reference image(s) as stylistic and compositional inspiration. Maintain the brand feel while incorporating the visual elements shown.';
          if (typeof ROWEOS_DEBUG !== 'undefined' && localStorage.getItem('roweos_debug') === 'true') console.log('[Bloom] Using ' + _libRefs.length + ' content library reference(s) for image generation');
        }
        var imgResult = await generateImageWithNanobanana(imgPrompt, _imgOpts);
        // v22.12: Extract base64 from correct return format {images: [{base64}]}
        var imgBase64 = null;
        if (imgResult && imgResult.images && imgResult.images.length > 0 && imgResult.images[0].base64) {
          imgBase64 = 'data:image/png;base64,' + imgResult.images[0].base64;
        } else if (imgResult && imgResult.imageData) {
          imgBase64 = imgResult.imageData;
        }
        if (imgBase64) {
          // v22.12: Also generate a text caption/article to pair with the image
          var captionText = op.desc || '';
          try {
            var isLongCap = _bloomPostLength === 'long';
            var captionPrompt = isLongCap
              ? 'You are writing a brand post for ' + brandName + ' about: ' + op.name + '. Write ONLY the post text. 3-4 short paragraphs. Bold opening line, then substance, end with one actionable takeaway. No options, no meta-commentary, no "here is", no alternatives. Just the final post text. Never use em-dashes.'
              : 'You are writing an Instagram caption for ' + brandName + ' about: ' + op.name + '. Write ONLY the caption text. 2-3 sentences, punchy, end with a CTA. No options, no commentary, no "here is a caption". Just the exact words to post. Never use em-dashes.';
            var capMsgs = [{ role: 'user', content: captionPrompt }];
            if (provider === 'anthropic') captionText = await callAnthropicAPI(model, apiKey, capMsgs, systemPrompt);
            else if (provider === 'google') captionText = await callGoogleAPI(model, apiKey, capMsgs, systemPrompt);
            else if (provider === 'openai') captionText = await callOpenAIAPI(model, apiKey, capMsgs, systemPrompt);
            if (captionText) captionText = captionText.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
          } catch(capErr) { console.warn('[Bloom] Caption gen failed:', capErr); }
          return {
            id: 'bloom_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            type: 'image',
            agent: 'image',
            agentLabel: 'Image Agent',
            category: 'image',
            title: title,
            content: captionText,
            imageData: imgBase64,
            operationId: op.id,
            operationName: op.name,
            brandIdx: brandIdx,
            brandName: brandName,
            timestamp: Date.now() - Math.floor(Math.random() * 600000),
            liked: false,
            saved: false,
            likeCount: 0,
            comments: []
          };
        }
      } catch(imgErr) {
        console.warn('[Bloom] Image gen failed, falling back to text:', imgErr);
        postType = 'insight';
        userPrompt = typePrompts.insight;
      }
    }

    // Text generation via API
    var messages = [{ role: 'user', content: userPrompt }];

    if (provider === 'anthropic') {
      content = await callAnthropicAPI(model, apiKey, messages, systemPrompt);
    } else if (provider === 'google') {
      content = await callGoogleAPI(model, apiKey, messages, systemPrompt);
    } else if (provider === 'openai') {
      content = await callOpenAIAPI(model, apiKey, messages, systemPrompt);
    }

    if (!content) return null;

    // v22.12: Sanitize content - extract text from JSON if model returned structured data
    try {
      if (content.charAt(0) === '{' || content.charAt(0) === '[') {
        var parsed = JSON.parse(content);
        if (parsed.text) content = parsed.text;
        else if (parsed.content) content = parsed.content;
        else if (typeof parsed === 'string') content = parsed;
      }
    } catch(jsonErr) { /* not JSON, use as-is */ }
    // Strip em-dashes and en-dashes
    content = content.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
    // Strip markdown code fences if model wrapped response
    content = content.replace(/^```[\s\S]*?\n/m, '').replace(/\n```\s*$/m, '');

    return {
      id: 'bloom_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
      type: postType,
      agent: agentForOp,
      agentLabel: (agentForOp.charAt(0).toUpperCase() + agentForOp.slice(1)) + ' Agent',
      category: op.category || 'strategy',
      title: title,
      content: content,
      imageData: null,
      operationId: op.id,
      operationName: op.name,
      brandIdx: brandIdx,
      brandName: brandName,
      timestamp: Date.now() - Math.floor(Math.random() * 600000),
      liked: false,
      saved: false,
      likeCount: 0,
      comments: []
    };
  } catch(err) {
    console.warn('[Bloom] Post generation failed:', err);
    return null;
  }
}

/**
 * v22.11: Append a single post to the feed without full re-render
 */
function appendBloomPostToFeed(post) {
  var feed = document.getElementById('bloomFeed');
  if (!feed) return;

  // Check if post passes current filter
  if (_bloomFilter !== 'all' && _bloomFilter !== 'foryou') {
    var passes = false;
    if (_bloomFilter === 'saved') passes = _bloomSavedIds[post.id];
    else if (_bloomFilter === 'image') passes = post.type === 'image';
    else if (_bloomFilter === 'video') passes = post.type === 'video';
    else if (_bloomFilter === 'idea') passes = post.type === 'idea';
    else passes = post.agent === _bloomFilter || post.category === _bloomFilter;
    if (!passes) return;
  }

  // Remove empty state if present
  var empty = feed.querySelector('.bloom-empty');
  if (empty) empty.remove();

  var sentinel = document.getElementById('bloomSentinel');
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderBloomPost(post);
  var card = tempDiv.firstChild;

  if (sentinel) {
    feed.insertBefore(card, sentinel);
  } else {
    feed.appendChild(card);
  }

  // v22.12: Register for dwell tracking
  if (card) bloomRegisterCardForDwell(card);
  // v22.14: Register video for autoplay on scroll
  if (card) bloomRegisterVideoForAutoplay(card);
}

/**
 * v22.56: Bloom Create — custom content generation from user prompt
 */
function openBloomCreateModal() {
  var overlay = document.getElementById('bloomCreateOverlay');
  if (!overlay) return;
  var isOpen = overlay.classList.contains('open');
  if (isOpen) {
    closeBloomCreateModal();
    return;
  }
  overlay.classList.add('open');
  document.getElementById('bloomCreateBtn').classList.add('active');
  var input = document.getElementById('bloomCreateInput');
  if (input) setTimeout(function() { input.focus(); }, 100);
}

function closeBloomCreateModal() {
  var overlay = document.getElementById('bloomCreateOverlay');
  if (overlay) overlay.classList.remove('open');
  var btn = document.getElementById('bloomCreateBtn');
  if (btn) btn.classList.remove('active');
}

/**
 * v22.56: Grow New Seeds — clear current posts and generate a fresh batch of 20
 * Generates a mix of text, images, and video based on user's content mode preferences.
 */
function bloomGrowNewSeeds() {
  if (_bloomGenerating) return;
  _bloomPosts = [];
  _bloomLikedIds = {};
  // Keep saved IDs intact — they're persisted
  _bloomGenerating = false;
  var feed = document.getElementById('bloomFeed');
  if (feed) feed.scrollTop = 0;
  renderBloomFeed();
  generateBloomBatch(20);
}

/**
 * v23.7: Load More Seeds — appends more seeds without clearing current feed (9.7)
 */
function bloomLoadMoreSeeds() {
  if (_bloomGenerating || _bloomCooldown.active) return;
  var btn = document.getElementById('bloomLoadMoreBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }
  generateBloomBatch(_bloomBatchSize);
}

async function bloomGenerateCustomContent() {
  var input = document.getElementById('bloomCreateInput');
  var statusEl = document.getElementById('bloomCreateStatus');
  var submitBtn = document.getElementById('bloomCreateSubmit');
  if (!input || !input.value.trim()) {
    if (statusEl) statusEl.textContent = 'Please describe what you want to see.';
    return;
  }

  var userPrompt = input.value.trim();
  submitBtn.disabled = true;
  if (statusEl) statusEl.textContent = 'Generating content...';

  // Resolve brand context (same pattern as generateBloomBatch)
  var brandIdx = selectedBrand || 0;
  if (_bloomSource && _bloomSource.indexOf('brand_') === 0) {
    brandIdx = parseInt(_bloomSource.replace('brand_', ''));
  }
  var brand = brands[brandIdx] || brands[0];
  if (!brand) { submitBtn.disabled = false; if (statusEl) statusEl.textContent = 'No brand selected.'; return; }
  var brandName = brand.shortName || brand.name;

  // Resolve API provider/key
  var provider = null, model = null, apiKey = null;
  try {
    var bSettings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
    provider = bSettings.provider || (brand && brand.provider) || 'anthropic';
    model = bSettings.model || (brand && brand.model) || 'claude-sonnet-4-6';
    if (provider === 'roweos' && typeof resolveRoweOSAI === 'function') {
      try { var _res = resolveRoweOSAI({ userMessage: userPrompt, systemPrompt: '' }); provider = _res.provider; model = _res.model; } catch(e) { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
    }
    if (provider === 'nanobanana') {
      var selProv = localStorage.getItem('selectedProvider') || 'google';
      provider = selProv !== 'nanobanana' ? selProv : 'google';
      model = provider === 'google' ? 'gemini-3.1-pro-preview' : provider === 'openai' ? 'gpt-5.5' : 'claude-sonnet-4-6';
    }
    apiKey = await getApiKey(provider);
    if (!apiKey) {
      var available = getAvailableProviders();
      if (available.google) { provider = 'google'; model = 'gemini-3.1-pro-preview'; apiKey = await getApiKey('google'); }
      else if (available.openai) { provider = 'openai'; model = 'gpt-5.5'; apiKey = await getApiKey('openai'); }
      else if (available.anthropic) { provider = 'anthropic'; model = 'claude-sonnet-4-6'; apiKey = await getApiKey('anthropic'); }
    }
  } catch(e) { console.warn('[Bloom Create] API key error:', e); }

  if (!apiKey) {
    submitBtn.disabled = false;
    if (statusEl) statusEl.textContent = '';
    showToast('Add an API key in Settings to use Bloom', 'warning');
    return;
  }

  // Build system prompt with brand context
  var systemPrompt = buildBrandSystemPrompt(brand, 'strategy');
  var bbCtx = getBloomLearningContext(brandIdx);
  if (bbCtx) systemPrompt += bbCtx;
  var bbKnowledge = getBloomKnowledgePrompt(brandIdx);
  if (bbKnowledge) systemPrompt += '\n' + bbKnowledge;

  // Close the modal
  closeBloomCreateModal();
  input.value = '';

  // Show generating indicator
  var feed = document.getElementById('bloomFeed');
  if (feed) {
    var genHtml = '<div class="bloom-generating" id="bloomCreateGenIndicator">creating your content\u2026 <svg class="bloom-sprout-anim" viewBox="0 0 24 24"><ellipse class="seed" cx="12" cy="21" rx="3.5" ry="2"/><path class="stem" d="M12 20 C12 16 12 12 12 8"/><path class="leaf-l" d="M12 12 C10 10 7 10 6 12 C7 13 10 13 12 12Z"/><path class="leaf-r" d="M12 10 C14 8 17 8 18 10 C17 11 14 11 12 10Z"/><circle class="bloom-fl" cx="12" cy="5" r="2.5"/></svg></div>';
    feed.insertAdjacentHTML('afterbegin', genHtml);
  }

  var noEmDash = ' Never use em-dashes or en-dashes. Output plain text only - no JSON, no code blocks.';
  var isLong = _bloomPostLength === 'long' || (_bloomPostLength === 'mix' && Math.random() > 0.5);

  // Build custom post types from the user prompt
  var postConfigs = [
    {
      type: 'insight',
      prompt: (isLong
        ? 'Generate a comprehensive insight for ' + brandName + ' about the following topic: ' + userPrompt + '. Include strategic context, actionable takeaways, and specific recommendations. 400-600 words.'
        : 'Write a short, punchy insight for ' + brandName + ' about: ' + userPrompt + '. Lead with a bold hook, then 2-3 tight sentences. End with one clear takeaway. MAX 150 words.') + noEmDash,
      title: userPrompt
    },
    {
      type: 'idea',
      prompt: (isLong
        ? 'Generate a detailed creative brand idea for ' + brandName + ' inspired by: ' + userPrompt + '. Describe the concept, execution strategy, expected outcomes, and implementation steps. 400-600 words.'
        : 'Pitch a creative brand idea for ' + brandName + ' inspired by: ' + userPrompt + '. One bold concept statement, then 2-3 sentences explaining why it works. MAX 150 words.') + noEmDash,
      title: 'Idea: ' + userPrompt
    },
    {
      type: 'social',
      prompt: 'Draft a social media post for ' + brandName + ' about: ' + userPrompt + '. Punchy, engaging, ready to post. Include a call-to-action.' + (isLong ? ' 200-300 words.' : ' Under 100 words.') + noEmDash,
      title: brandName + ' - ' + userPrompt
    }
  ];

  // Generate text posts in parallel
  var textPromises = [];
  for (var ti = 0; ti < postConfigs.length; ti++) {
    var pc = postConfigs[ti];
    textPromises.push((function(cfg) {
      return (async function() {
        try {
          var messages = [{ role: 'user', content: cfg.prompt }];
          var content = '';
          if (provider === 'anthropic') content = await callAnthropicAPI(model, apiKey, messages, systemPrompt);
          else if (provider === 'google') content = await callGoogleAPI(model, apiKey, messages, systemPrompt);
          else if (provider === 'openai') content = await callOpenAIAPI(model, apiKey, messages, systemPrompt);
          if (!content) return null;
          content = content.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
          content = content.replace(/^```[\s\S]*?\n/m, '').replace(/\n```\s*$/m, '');
          try {
            if (content.charAt(0) === '{' || content.charAt(0) === '[') {
              var parsed = JSON.parse(content);
              if (parsed.text) content = parsed.text;
              else if (parsed.content) content = parsed.content;
            }
          } catch(e) {}
          var agentMap = { insight: 'strategy', idea: 'marketing', social: 'marketing', analysis: 'strategy' };
          var agent = agentMap[cfg.type] || 'strategy';
          return {
            id: 'bloom_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            type: cfg.type,
            agent: agent,
            agentLabel: (agent.charAt(0).toUpperCase() + agent.slice(1)) + ' Agent',
            category: cfg.type === 'social' ? 'marketing' : 'strategy',
            title: cfg.title,
            content: content,
            imageData: null,
            operationId: null,
            operationName: cfg.title,
            brandIdx: brandIdx,
            brandName: brandName,
            timestamp: Date.now() - Math.floor(Math.random() * 300000),
            liked: false, saved: false, likeCount: 0, comments: [],
            _customPrompt: userPrompt
          };
        } catch(err) {
          console.warn('[Bloom Create] Text gen failed:', err);
          return null;
        }
      })();
    })(pc));
  }

  var textResults = await Promise.allSettled(textPromises);
  for (var tr = 0; tr < textResults.length; tr++) {
    if (textResults[tr].status === 'fulfilled' && textResults[tr].value) {
      _bloomPosts.unshift(textResults[tr].value);
      appendBloomPostToFeed(textResults[tr].value);
    }
  }

  // Generate image if nanobanana key available and content mode allows
  var hasNBKey = typeof getNanobananaKey === 'function' && getNanobananaKey();
  var wantsImages = _bloomContentMode !== 'text_only' && _bloomContentMode !== 'video_text';
  if (hasNBKey && wantsImages) {
    try {
      var imgCtx = '';
      if (brand.industry) imgCtx += ' Industry: ' + brand.industry + '.';
      if (brand.products) imgCtx += ' What they do: ' + brand.products + '.';
      if (brand.tagline) imgCtx += ' Brand tagline: ' + brand.tagline + '.';
      var imgColorHint = '';
      if (brand.visual && brand.visual.colors && brand.visual.colors.length > 0) {
        imgColorHint = ' Brand colors: ' + brand.visual.colors.slice(0, 3).join(', ') + '.';
      } else if (brand.brandColor) {
        imgColorHint = ' Brand accent color: ' + brand.brandColor + '.';
      }
      var imgPrompt = 'Generate a high-quality, photorealistic brand image for "' + brandName + '".' + imgCtx + imgColorHint
        + ' Subject: ' + userPrompt + '.'
        + ' Style: Premium, editorial-quality photography. Clean composition, professional lighting, modern aesthetic.'
        + ' IMPORTANT: Do NOT include any text, words, logos, watermarks, or typography in the image. Pure visual content only.';
      var _imgKnowledge = getBloomKnowledgePrompt(brandIdx);
      if (_imgKnowledge) imgPrompt += ' ' + _imgKnowledge;
      var _libRefs = getBloomLibraryReferences(brandIdx, 'strategy', 2);
      var _imgOpts = { suppressToasts: true };
      if (_libRefs.length > 0) {
        _imgOpts.referenceImages = _libRefs;
        imgPrompt += ' Use the provided reference image(s) as stylistic inspiration.';
      }
      var imgResult = await generateImageWithNanobanana(imgPrompt, _imgOpts);
      var imgBase64 = null;
      if (imgResult && imgResult.images && imgResult.images.length > 0 && imgResult.images[0].base64) {
        imgBase64 = 'data:image/png;base64,' + imgResult.images[0].base64;
      } else if (imgResult && imgResult.imageData) {
        imgBase64 = imgResult.imageData;
      }
      if (imgBase64) {
        var captionText = '';
        try {
          var capPrompt = isLong
            ? 'Write a brand post for ' + brandName + ' about: ' + userPrompt + '. Write ONLY the post text. 3-4 short paragraphs. Bold opening line, then substance. Never use em-dashes.'
            : 'Write an Instagram caption for ' + brandName + ' about: ' + userPrompt + '. Write ONLY the caption. 2-3 sentences, punchy. Never use em-dashes.';
          var capMsgs = [{ role: 'user', content: capPrompt }];
          if (provider === 'anthropic') captionText = await callAnthropicAPI(model, apiKey, capMsgs, systemPrompt);
          else if (provider === 'google') captionText = await callGoogleAPI(model, apiKey, capMsgs, systemPrompt);
          else if (provider === 'openai') captionText = await callOpenAIAPI(model, apiKey, capMsgs, systemPrompt);
          if (captionText) captionText = captionText.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
        } catch(capErr) { console.warn('[Bloom Create] Caption failed:', capErr); }
        var imgPost = {
          id: 'bloom_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
          type: 'image', agent: 'image', agentLabel: 'Image Agent', category: 'image',
          title: userPrompt, content: captionText, imageData: imgBase64,
          operationId: null, operationName: userPrompt,
          brandIdx: brandIdx, brandName: brandName,
          timestamp: Date.now() - Math.floor(Math.random() * 300000),
          liked: false, saved: false, likeCount: 0, comments: [],
          _customPrompt: userPrompt
        };
        _bloomPosts.unshift(imgPost);
        appendBloomPostToFeed(imgPost);
      }
    } catch(imgErr) { console.warn('[Bloom Create] Image gen failed:', imgErr); }
  }

  // Generate video if Google key available and content mode allows
  var wantsVideo = _bloomContentMode !== 'text_only' && _bloomContentMode !== 'images_text';
  var hasGoogleKey = false;
  try { hasGoogleKey = !!(await getApiKey('google')); } catch(e) {}
  if (wantsVideo && hasGoogleKey && typeof generateVideoWithVeo === 'function') {
    try {
      var videoPostId = 'bloom_' + Date.now() + '_vid_' + Math.floor(Math.random() * 100000);
      var videoPost = {
        id: videoPostId, type: 'video', agent: 'video', agentLabel: 'Video Agent', category: 'video',
        title: userPrompt, content: '', videoPending: true, videoProgress: 0,
        videoError: null, videoUrl: null, videoBlob: null, videoModel: '', videoDuration: 6, videoGenTime: 0,
        operationId: null, operationName: userPrompt,
        brandIdx: brandIdx, brandName: brandName,
        timestamp: Date.now() - Math.floor(Math.random() * 300000),
        liked: false, saved: false, likeCount: 0, comments: [],
        _customPrompt: userPrompt
      };
      _bloomPosts.push(videoPost);
      appendBloomPostToFeed(videoPost);

      // Fire-and-forget video generation
      (async function() {
        try {
          var vidCtx = '';
          if (brand.industry) vidCtx += ' Industry: ' + brand.industry + '.';
          if (brand.products) vidCtx += ' Products: ' + brand.products + '.';
          var vidPrompt = 'Create a cinematic, professional brand video for "' + brandName + '".' + vidCtx
            + ' Subject: ' + userPrompt + '.'
            + ' Style: Premium, smooth camera movement, professional lighting. Modern brand aesthetic.'
            + ' IMPORTANT: No text overlays, no watermarks. Pure visual content.';
          var _vidKnowledge = getBloomKnowledgePrompt(brandIdx);
          if (_vidKnowledge) vidPrompt += ' ' + _vidKnowledge;
          var _vidOpts = {
            aspectRatio: '9:16', duration: 6, model: 'veo-3.1-generate-preview',
            onProgress: function(elapsed) {
              videoPost.videoProgress = elapsed;
              bloomUpdateVideoProgress(videoPostId, elapsed);
            }
          };
          var _vidLibRefs = getBloomLibraryReferences(brandIdx, 'video', 1);
          if (_vidLibRefs.length > 0) _vidOpts.referenceImage = _vidLibRefs[0];
          var videoResult = await generateVideoWithVeo(vidPrompt, _vidOpts);
          videoPost.videoPending = false;
          videoPost.videoUrl = videoResult.videoUrl;
          videoPost.videoBlob = videoResult.videoBlob;
          videoPost.videoModel = videoResult.model;
          videoPost.videoDuration = videoResult.duration;
          videoPost.videoGenTime = videoResult.generationTime;
          // Generate caption
          try {
            var vcapPrompt = 'Write a short social caption for a brand video by ' + brandName + ' about: ' + userPrompt + '. Write ONLY the caption. 1-2 sentences, punchy. Never use em-dashes.';
            var vcapMsgs = [{ role: 'user', content: vcapPrompt }];
            var vcaption = '';
            if (provider === 'anthropic') vcaption = await callAnthropicAPI(model, apiKey, vcapMsgs, systemPrompt);
            else if (provider === 'google') vcaption = await callGoogleAPI(model, apiKey, vcapMsgs, systemPrompt);
            else if (provider === 'openai') vcaption = await callOpenAIAPI(model, apiKey, vcapMsgs, systemPrompt);
            if (vcaption) videoPost.content = vcaption.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
          } catch(vcapErr) { console.warn('[Bloom Create] Video caption failed:', vcapErr); }
          bloomUpdateVideoCard(videoPostId);
        } catch(vidErr) {
          videoPost.videoPending = false;
          videoPost.videoError = vidErr.message || 'Video generation failed';
          bloomUpdateVideoCard(videoPostId);
          console.warn('[Bloom Create] Video gen failed:', vidErr);
        }
      })();
    } catch(vidSetupErr) { console.warn('[Bloom Create] Video setup failed:', vidSetupErr); }
  }

  // Clean up generating indicator
  var genInd = document.getElementById('bloomCreateGenIndicator');
  if (genInd) genInd.remove();
  submitBtn.disabled = false;
  if (statusEl) statusEl.textContent = '';
  showToast('Custom content generated for "' + userPrompt.substring(0, 40) + (userPrompt.length > 40 ? '...' : '') + '"', 'success');
}

/**
 * v22.11/v22.56: Setup IntersectionObserver for infinite scroll — DISABLED in v22.56
 * Posts now only refresh via "Grow New Seeds" button. No more auto-load on scroll.
 */
function setupBloomInfiniteScroll() {
  // v22.56: Disconnect and do nothing — no more infinite scroll
  if (_bloomObserver) {
    _bloomObserver.disconnect();
    _bloomObserver = null;
  }
}

/**
 * v22.12/v22.56: Pull-to-refresh — DISABLED in v22.56
 * Posts now only refresh via "Grow New Seeds" button.
 */
function setupBloomPullToRefresh() {
  return; // v22.56: Disabled — use Grow New Seeds button instead
  /* eslint-disable no-unreachable */
  var feed = document.getElementById('bloomFeed');
  if (!feed) return;

  var startY = 0;
  var pulling = false;
  var pullEl = null;
  var _pullRefreshSvg = '<svg class="bloom-sprout-anim" viewBox="0 0 24 24" style="width:24px;height:24px"><ellipse class="seed" cx="12" cy="21" rx="3.5" ry="2"/><path class="stem" d="M12 20 C12 16 12 12 12 8"/><path class="leaf-l" d="M12 12 C10 10 7 10 6 12 C7 13 10 13 12 12Z"/><path class="leaf-r" d="M12 10 C14 8 17 8 18 10 C17 11 14 11 12 10Z"/><circle class="bloom-fl" cx="12" cy="5" r="2.5"/></svg>';

  function doRefresh() {
    if (pullEl) {
      pullEl.className = 'bloom-pull-refresh refreshing';
      pullEl.innerHTML = _pullRefreshSvg + ' Refreshing...';
    }
    _bloomPosts = [];
    _bloomLikedIds = {};
    _bloomSavedIds = {};
    _bloomGenerating = false;
    setTimeout(function() {
      if (pullEl) pullEl.remove();
      pullEl = null;
      renderBloomFeed();
      generateBloomBatch(_bloomBatchSize);
    }, 800);
  }

  function showPullIndicator() {
    if (!pullEl) {
      pullEl = document.createElement('div');
      pullEl.className = 'bloom-pull-refresh pulling';
      pullEl.innerHTML = _pullRefreshSvg + ' Pull to refresh';
      feed.insertBefore(pullEl, feed.firstChild);
    }
  }

  // Touch events (mobile + desktop trackpad)
  feed.addEventListener('touchstart', function(e) {
    if (feed.scrollTop <= 0) {
      startY = e.touches[0].pageY;
      pulling = true;
    }
  }, { passive: true });

  feed.addEventListener('touchmove', function(e) {
    if (!pulling) return;
    var dy = e.touches[0].pageY - startY;
    if (dy > 40 && feed.scrollTop <= 0) { showPullIndicator(); }
  }, { passive: true });

  feed.addEventListener('touchend', function() {
    if (!pulling || !pullEl) { pulling = false; return; }
    pulling = false;
    doRefresh();
  }, { passive: true });

  // v22.22: Mouse drag for desktop (click + drag down)
  var mouseStartY = 0;
  var mousePulling = false;

  feed.addEventListener('mousedown', function(e) {
    if (feed.scrollTop <= 0) {
      mouseStartY = e.pageY;
      mousePulling = true;
    }
  });

  feed.addEventListener('mousemove', function(e) {
    if (!mousePulling) return;
    var dy = e.pageY - mouseStartY;
    if (dy > 50 && feed.scrollTop <= 0) { showPullIndicator(); }
  });

  feed.addEventListener('mouseup', function() {
    if (!mousePulling || !pullEl) { mousePulling = false; return; }
    mousePulling = false;
    doRefresh();
  });

  feed.addEventListener('mouseleave', function() {
    if (mousePulling && pullEl) { pullEl.remove(); pullEl = null; }
    mousePulling = false;
  });
}

// v22.44: Collapse header on scroll for full-screen feed experience (mobile only)
function setupBloomScrollCollapse() {
  if (window.innerWidth > 768) return;
  var feed = document.getElementById('bloomFeed');
  var header = document.getElementById('bloomHeaderBlock');
  if (!feed || !header) return;
  if (feed._scrollCollapseAttached) return;
  feed._scrollCollapseAttached = true;
  var lastScrollTop = 0;
  feed.addEventListener('scroll', function() {
    var st = feed.scrollTop;
    if (st > 30) {
      header.classList.add('collapsed');
    } else if (st < 10) {
      header.classList.remove('collapsed');
    }
    lastScrollTop = st;
  }, { passive: true });
}

/**
 * v22.12: Toggle post length between short (social) and long (essay)
 */
/**
 * v22.12: Switch bloom source (All, specific brand, life profile)
 */
function bloomSwitchSource(value) {
  _bloomSource = value;
  _bloomPosts = [];
  _bloomLikedIds = {};
  _bloomSavedIds = {};
  _bloomGenerating = false;
  _bloomFilter = 'all'; // Reset filter on source change
  _bloomLastBrandIdx = -1;
  // Re-render filters for new source type (brand vs life)
  renderBloom();
  // v22.16: Re-render content library for new source scope
  if (_bloomLibraryOpen) renderBloomLibrary();
}

function bloomSetLength(val) {
  _bloomPostLength = val;
  localStorage.setItem('roweos_bloom_length', val);
  var toastMsg = val === 'short' ? 'Short posts (social style)' : (val === 'long' ? 'Long posts (deep analysis)' : 'Hybrid (short + long)');
  showToast(toastMsg, 'success');
}

/**
 * v22.13: Content mode handler (text only vs images + text)
 */
function bloomSwitchContentMode(mode) {
  _bloomContentMode = mode;
  localStorage.setItem('roweos_bloom_content_mode', mode);
  writeDB('profile/main', { bloomContentMode: mode }); // v25.1
  var modeLabels = { all_media: 'All media mode', images_video_text: 'Images + video mode', images_text: 'Images + text mode', video_text: 'Video + text mode', text_only: 'Text only mode' };
  showToast(modeLabels[mode] || mode, 'success');
  // Clear and regenerate if switching modes
  _bloomPosts = [];
  _bloomGenerating = false;
  renderBloomFeed();
  generateBloomBatch(_bloomBatchSize);
}

/**
 * v23.7: Media type checkbox handler (9.2) - replaces old select dropdown
 */
function bloomUpdateMediaTypes() {
  var textEl = document.getElementById('bloomMediaText');
  var imgEl = document.getElementById('bloomMediaImages');
  var vidEl = document.getElementById('bloomMediaVideo');
  var infEl = document.getElementById('bloomMediaInfographic');
  var wText = textEl ? textEl.checked : true;
  var wImg = imgEl ? imgEl.checked : false;
  var wVid = vidEl ? vidEl.checked : false;
  var wInf = infEl ? infEl.checked : false;
  // v23.8: Store infographic flag globally
  window._bloomWantInfographic = wInf;
  // At least one must be checked
  if (!wText && !wImg && !wVid && !wInf) {
    wText = true;
    if (textEl) textEl.checked = true;
  }
  // Map checkbox state to legacy content mode string for compatibility
  var mode = 'text_only';
  if (wText && wImg && wVid) mode = 'all_media';
  else if (wText && wImg) mode = 'images_text';
  else if (wText && wVid) mode = 'video_text';
  else if (wImg && wVid) mode = 'images_video_text';
  else if (wImg) mode = 'images_text';
  else if (wVid) mode = 'video_text';
  // Update label highlight
  var labels = document.querySelectorAll('.bloom-media-check');
  for (var i = 0; i < labels.length; i++) {
    var cb = labels[i].querySelector('input');
    labels[i].classList.toggle('checked', cb && cb.checked);
  }
  bloomSwitchContentMode(mode);
}

/**
 * v23.7: Sync media checkboxes from stored content mode (9.2)
 */
function bloomSyncMediaCheckboxes() {
  var textEl = document.getElementById('bloomMediaText');
  var imgEl = document.getElementById('bloomMediaImages');
  var vidEl = document.getElementById('bloomMediaVideo');
  if (!textEl || !imgEl || !vidEl) return;
  var m = _bloomContentMode;
  textEl.checked = (m !== 'images_video_text');
  imgEl.checked = (m === 'images_text' || m === 'all_media' || m === 'images_video_text');
  vidEl.checked = (m === 'video_text' || m === 'all_media' || m === 'images_video_text');
  // Highlight checked labels
  var labels = document.querySelectorAll('.bloom-media-check');
  for (var i = 0; i < labels.length; i++) {
    var cb = labels[i].querySelector('input');
    labels[i].classList.toggle('checked', cb && cb.checked);
  }
}

/**
 * v23.7: Interleave seeds by category for diversity (9.1)
 * No two consecutive seeds from the same category in the "All" feed.
 */
function interleaveSeedsByCategory(seeds) {
  if (seeds.length <= 2) return seeds;
  // Group by category
  var buckets = {};
  var catOrder = [];
  for (var i = 0; i < seeds.length; i++) {
    var cat = seeds[i].category || seeds[i].agent || 'unknown';
    if (!buckets[cat]) { buckets[cat] = []; catOrder.push(cat); }
    buckets[cat].push(seeds[i]);
  }
  // Shuffle within each bucket for variety
  for (var c = 0; c < catOrder.length; c++) {
    var b = buckets[catOrder[c]];
    for (var j = b.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = b[j]; b[j] = b[k]; b[k] = tmp;
    }
  }
  // Sort categories by count descending for better interleaving
  catOrder.sort(function(a, b) { return buckets[b].length - buckets[a].length; });
  // Round-robin interleave
  var result = [];
  var lastCat = null;
  var totalRemaining = seeds.length;
  while (totalRemaining > 0) {
    var placed = false;
    for (var ci = 0; ci < catOrder.length; ci++) {
      var cat2 = catOrder[ci];
      if (buckets[cat2].length === 0) continue;
      if (cat2 === lastCat && catOrder.length > 1) continue; // Skip same category
      result.push(buckets[cat2].shift());
      lastCat = cat2;
      totalRemaining--;
      placed = true;
      break;
    }
    if (!placed) {
      // Only one category left, just push the rest
      for (var fi = 0; fi < catOrder.length; fi++) {
        while (buckets[catOrder[fi]].length > 0) {
          result.push(buckets[catOrder[fi]].shift());
          totalRemaining--;
        }
      }
    }
  }
  return result;
}

/**
 * v23.7: Navigate to Studio operation from Bloom seed card (9.3)
 */
function bloomGoToOperation(operationId) {
  var op = typeof findOperationById === 'function' ? findOperationById(operationId) : null;
  if (!op) {
    showToast('This operation is no longer available', 'warning');
    return;
  }
  showView('studio');
  // Select the operation in Studio after a brief delay for view render
  setTimeout(function() {
    // Try to select the op in the Studio operation list
    var opSelect = document.getElementById('studioOpSelect');
    if (opSelect) {
      opSelect.value = String(operationId);
      // Trigger change event
      var evt = document.createEvent('HTMLEvents');
      evt.initEvent('change', true, false);
      opSelect.dispatchEvent(evt);
    }
  }, 200);
}

/**
 * v23.7: Check if a seed is complete (9.4)
 * A seed is complete when all expected media has loaded.
 */
function isBloomSeedComplete(post) {
  if (!post) return false;
  if (post.type === 'image' && !post.imageData) return false;
  if (post.type === 'video' && !post.videoUrl && !post.videoPending) return false;
  if (!post.content && post.type !== 'image' && post.type !== 'video') return false;
  return true;
}

/**
 * v23.7: Handle media load error on bloom card (9.4)
 * Hides the card if image/video fails to load at render time.
 */
function bloomMediaError(postId) {
  var card = document.getElementById('bloom-card-' + postId);
  if (card) card.classList.add('bloom-card-hidden');
}

// v23.7: Bloom generation status tracking (9.5/9.6)
var _bloomGenStats = { attempted: 0, succeeded: 0, failed: 0, consecutiveFailures: 0 };
var _bloomCooldown = { active: false, until: 0, timerId: null };

/**
 * v23.7: Show inline status message in Bloom feed (9.5)
 */
function showBloomStatusMessage(type, details) {
  var feed = document.getElementById('bloomFeed');
  if (!feed) return;
  // Remove existing status messages
  var existing = feed.querySelectorAll('.bloom-status-msg');
  for (var i = 0; i < existing.length; i++) existing[i].remove();

  var html = '<div class="bloom-status-msg' + (type === 'cooldown' ? ' bloom-status-cooldown' : '') + '" id="bloomStatusMsg">';
  if (type === 'partial') {
    html += '<div class="bloom-status-msg-title">Some seeds had trouble growing</div>';
    html += '<div>Try an alternate media type or refresh to try again.</div>';
    html += '<div class="bloom-status-msg-actions">';
    html += '<button onclick="bloomUpdateMediaTypes()">Switch Media Type</button>';
    html += '<button onclick="bloomGrowNewSeeds();this.parentNode.parentNode.remove()">Refresh Seeds</button>';
    html += '</div>';
  } else if (type === 'full') {
    var msg = _bloomGenStats.consecutiveFailures >= 3
      ? 'Persistent trouble generating seeds. Check your AI settings or contact support.'
      : 'Your seeds could not sprout this time. This might be due to the media type or a temporary issue.';
    html += '<div class="bloom-status-msg-title">Generation trouble</div>';
    html += '<div>' + msg + '</div>';
    html += '<div class="bloom-status-msg-actions">';
    html += '<button onclick="bloomForceTextOnly()">Try Text Only</button>';
    html += '<button onclick="bloomForceImagesOnly()">Try Images Only</button>';
    html += '<button onclick="bloomGrowNewSeeds();this.parentNode.parentNode.remove()">Refresh</button>';
    html += '</div>';
  } else if (type === 'cooldown') {
    html += '<div class="bloom-status-msg-title">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="6.5" rx="2.8" ry="4.5"/><ellipse cx="17" cy="10" rx="2.8" ry="4.5" transform="rotate(72 17 10)"/><circle cx="12" cy="11" r="2.2"/></svg>';
    html += 'Seeds are resting <span class="bloom-cooldown-timer" id="bloomCooldownTimer">' + (details || '') + '</span>';
    html += '</div>';
    html += '<div>Too many seeds have sprouted for the moment. Your next harvest will be ready shortly.</div>';
    html += '</div>';
  }
  html += '</div>';

  // Insert at top of feed, after stats card if present
  var statsCard = feed.querySelector('.bloom-stats-card');
  if (statsCard) {
    statsCard.insertAdjacentHTML('afterend', html);
  } else {
    feed.insertAdjacentHTML('afterbegin', html);
  }
}

/**
 * v23.7: Remove status message from feed
 */
function removeBloomStatusMessage() {
  var el = document.getElementById('bloomStatusMsg');
  if (el) el.remove();
}

/**
 * v23.7: Handle rate limit cooldown (9.6)
 */
function startBloomCooldown(seconds) {
  if (_bloomCooldown.timerId) clearInterval(_bloomCooldown.timerId);
  _bloomCooldown.active = true;
  _bloomCooldown.until = Date.now() + (seconds * 1000);
  showBloomStatusMessage('cooldown', formatBloomCooldown(seconds));
  // Disable grow button
  var growBtn = document.querySelector('.bloom-grow-btn');
  if (growBtn) { growBtn.disabled = true; growBtn.title = 'Rate limit active'; }
  _bloomCooldown.timerId = setInterval(function() {
    var remaining = Math.max(0, Math.ceil((_bloomCooldown.until - Date.now()) / 1000));
    var timerEl = document.getElementById('bloomCooldownTimer');
    if (timerEl) timerEl.textContent = formatBloomCooldown(remaining);
    if (remaining <= 0) {
      clearInterval(_bloomCooldown.timerId);
      _bloomCooldown.active = false;
      _bloomCooldown.timerId = null;
      removeBloomStatusMessage();
      var growBtn2 = document.querySelector('.bloom-grow-btn');
      if (growBtn2) { growBtn2.disabled = false; growBtn2.title = ''; }
    }
  }, 1000);
}

function formatBloomCooldown(sec) {
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m > 0 ? m + ':' + (s < 10 ? '0' : '') + s : s + 's';
}

/**
 * v23.7: Quick media type helpers for status message buttons (9.5)
 */
function bloomForceTextOnly() {
  var textEl = document.getElementById('bloomMediaText');
  var imgEl = document.getElementById('bloomMediaImages');
  var vidEl = document.getElementById('bloomMediaVideo');
  if (textEl) textEl.checked = true;
  if (imgEl) imgEl.checked = false;
  if (vidEl) vidEl.checked = false;
  bloomUpdateMediaTypes();
  removeBloomStatusMessage();
}
function bloomForceImagesOnly() {
  var textEl = document.getElementById('bloomMediaText');
  var imgEl = document.getElementById('bloomMediaImages');
  var vidEl = document.getElementById('bloomMediaVideo');
  if (textEl) textEl.checked = false;
  if (imgEl) imgEl.checked = true;
  if (vidEl) vidEl.checked = false;
  bloomUpdateMediaTypes();
  removeBloomStatusMessage();
}

/**
 * v23.7: Check for rate limit in API error response (9.6)
 * Returns retry-after seconds or 0 if not a rate limit error.
 */
function bloomCheckRateLimit(error) {
  if (!error) return 0;
  var msg = (error.message || error.body || String(error)).toLowerCase();
  if (msg.indexOf('429') !== -1 || msg.indexOf('rate') !== -1 || msg.indexOf('quota') !== -1 || msg.indexOf('limit') !== -1 || msg.indexOf('too many') !== -1) {
    // Try to extract retry-after
    var retryMatch = msg.match(/retry.?after[:\s]*(\d+)/i);
    if (retryMatch) return parseInt(retryMatch[1]);
    return 60; // Default 60s cooldown
  }
  return 0;
}

/**
 * v23.7: Navigate to Studio with specific op pre-selected (9.3)
 */
function bloomNavigateToStudioOp(operationId) {
  bloomGoToOperation(operationId);
}

/**
 * v22.14: Build a brand-aware video prompt for Veo generation
 */
function bloomBuildVideoPrompt(op, brand, brandName) {
  var ctx = '';
  if (brand.industry) ctx += ' Industry: ' + brand.industry + '.';
  if (brand.products) ctx += ' What they do: ' + brand.products + '.';
  if (brand.tagline) ctx += ' Brand tagline: ' + brand.tagline + '.';
  if (brand.audience) ctx += ' Target audience: ' + brand.audience + '.';
  if (brand.positioning) ctx += ' Positioning: ' + brand.positioning + '.';
  var colorHint = '';
  if (brand.visual && brand.visual.colors && brand.visual.colors.length > 0) {
    colorHint = ' Brand colors: ' + brand.visual.colors.slice(0, 3).join(', ') + '.';
  } else if (brand.brandColor) {
    colorHint = ' Brand accent color: ' + brand.brandColor + '.';
  }
  return 'Create a short, cinematic video for "' + brandName + '".' + ctx + colorHint
    + ' Subject: ' + (op.desc || op.name) + '.'
    + ' Style: Premium, cinematic quality. Smooth camera movement, professional lighting, modern aesthetic.'
    + ' The video should authentically represent what this brand does and feels like.'
    + ' IMPORTANT: Do NOT include any text, words, logos, watermarks, or typography. Pure visual motion content only.';
}

// ═══════════════════════════════════════════════════════════════
// v22.16: Bloom Content Library
// Upload reference images per-agent-type, injected into AI generation
// ═══════════════════════════════════════════════════════════════

function getBloomLibraryScope() {
  if (_bloomSource === 'all') {
    return 'brand_' + (selectedBrand || 0);
  }
  if (_bloomSource.indexOf('brand_') === 0) return _bloomSource;
  if (_bloomSource.indexOf('life_') === 0) return _bloomSource;
  return 'brand_' + (selectedBrand || 0);
}

function getBloomLibrary() {
  try {
    return JSON.parse(localStorage.getItem('roweos_bloom_library') || '{}');
  } catch (e) { return {}; }
}

function getBloomLibraryItems(scope, agentType) {
  var lib = getBloomLibrary();
  var items = lib[scope] || [];
  if (!agentType || agentType === 'all') return items;
  return items.filter(function(item) { return item.agentType === agentType; });
}

function saveBloomLibrary(lib) {
  try {
    localStorage.setItem('roweos_bloom_library', JSON.stringify(lib));
    writeDB('profile/main', { bloomLibrary: JSON.stringify(lib) }); // v25.1
  } catch (e) {
    console.warn('[Bloom Library] Save failed:', e);
    if (typeof showToast === 'function') showToast('Content library save failed - storage may be full', 'error');
  }
}

function toggleBloomLibrary() {
  _bloomLibraryOpen = !_bloomLibraryOpen;
  var panel = document.getElementById('bloomLibraryPanel');
  var toggle = document.getElementById('bloomLibraryToggle');
  if (panel) {
    if (_bloomLibraryOpen) {
      panel.classList.add('open');
      renderBloomLibrary();
    } else {
      panel.classList.remove('open');
    }
  }
  // v22.37: Toggle active on both desktop and mobile library buttons
  var toggleBtns = document.querySelectorAll('.bloom-library-toggle');
  toggleBtns.forEach(function(btn) {
    if (_bloomLibraryOpen) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function renderBloomLibrary() {
  var scope = getBloomLibraryScope();
  var allItems = getBloomLibraryItems(scope, 'all');
  var items = (_bloomLibraryTab === 'all') ? allItems : allItems.filter(function(i) { return i.agentType === _bloomLibraryTab; });

  // Render tabs
  var tabsEl = document.getElementById('bloomLibraryTabs');
  if (tabsEl) {
    var html = '';
    for (var t = 0; t < BLOOM_LIBRARY_TABS.length; t++) {
      var tab = BLOOM_LIBRARY_TABS[t];
      var tabCount = (tab.id === 'all') ? allItems.length : allItems.filter(function(i) { return i.agentType === tab.id; }).length;
      html += '<button class="bloom-library-tab' + (tab.id === _bloomLibraryTab ? ' active' : '') + '" onclick="bloomLibrarySetTab(\'' + tab.id + '\')">'
        + tab.label + (tabCount > 0 ? ' (' + tabCount + ')' : '') + '</button>';
    }
    tabsEl.innerHTML = html;
  }

  // Render grid
  var gridEl = document.getElementById('bloomLibraryGrid');
  if (gridEl) {
    // v22.17: Resolve brand name for label
    var _libBrandIdx = scope.indexOf('brand_') === 0 ? parseInt(scope.replace('brand_', ''), 10) : -1;
    var _libBrandName = '';
    if (_libBrandIdx >= 0 && typeof brands !== 'undefined' && brands[_libBrandIdx]) {
      _libBrandName = brands[_libBrandIdx].shortName || brands[_libBrandIdx].name || '';
    } else if (scope.indexOf('life_') === 0) {
      _libBrandName = 'LifeAI';
    }
    var ghtml = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var _itemBrandLabel = item.brandLabel || _libBrandName;
      ghtml += '<div class="bloom-library-item ' + (item.active ? 'active' : 'inactive') + '" onclick="toggleBloomLibraryItem(\'' + item.id + '\')" title="' + escapeHtml(item.name) + ' (' + item.agentType + ')">'
        + '<img src="' + item.base64 + '" alt="' + escapeHtml(item.name) + '">'
        + '<span class="bloom-library-item-badge ' + (item.active ? 'on' : 'off') + '">' + (item.active ? '\u2713' : '\u2717') + '</span>'
        + '<button class="bloom-library-item-remove" onclick="event.stopPropagation(); removeBloomLibraryItem(\'' + item.id + '\')" title="Remove">\u00d7</button>'
        + '<div class="bloom-library-item-brand" onclick="event.stopPropagation(); bloomLibraryReassignBrand(\'' + item.id + '\')" title="Click to reassign brand">' + escapeHtml(_itemBrandLabel) + '</div>'
        + '</div>';
    }
    // Dropzone
    ghtml += '<div class="bloom-library-dropzone" id="bloomLibraryDropzone"'
      + ' onclick="document.getElementById(\'bloomLibraryFileInput\').click();"'
      + ' ondragover="event.preventDefault(); this.classList.add(\'dragover\');"'
      + ' ondragleave="this.classList.remove(\'dragover\');"'
      + ' ondrop="handleBloomLibraryDrop(event); this.classList.remove(\'dragover\');">'
      + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14"/><path d="M5 12h14"/></svg>'
      + '<div>Drop images here or click to upload</div>'
      + '</div>';
    gridEl.innerHTML = ghtml;
  }

  // Limit indicator
  var limitEl = document.getElementById('bloomLibraryLimit');
  if (limitEl) {
    limitEl.textContent = allItems.length + ' / ' + BLOOM_LIBRARY_MAX + ' reference images';
  }

  updateBloomLibraryCount();
}

function bloomLibrarySetTab(tabId) {
  _bloomLibraryTab = tabId;
  renderBloomLibrary();
}

function updateBloomLibraryCount() {
  var scope = getBloomLibraryScope();
  var allItems = getBloomLibraryItems(scope, 'all');
  var activeCount = allItems.filter(function(i) { return i.active; }).length;
  // v22.37: Update count on both desktop and mobile library buttons
  var countEls = document.querySelectorAll('.bloom-library-toggle-count');
  countEls.forEach(function(el) {
    el.textContent = String(activeCount);
    el.style.display = activeCount > 0 ? '' : 'none';
  });
}

function handleBloomLibraryUpload(event) {
  var files = event.target.files;
  if (!files || files.length === 0) return;
  var scope = getBloomLibraryScope();
  var lib = getBloomLibrary();
  if (!lib[scope]) lib[scope] = [];

  var remaining = BLOOM_LIBRARY_MAX - lib[scope].length;
  if (remaining <= 0) {
    showToast('Content library is full (' + BLOOM_LIBRARY_MAX + ' max). Remove some to add more.', 'warning');
    event.target.value = '';
    return;
  }

  var filesToProcess = Math.min(files.length, remaining);
  var processed = 0;

  for (var f = 0; f < filesToProcess; f++) {
    (function(file) {
      if (!file.type || (!file.type.match(/^image\//) && !file.type.match(/^video\//))) {
        processed++;
        return;
      }

      if (file.type.match(/^video\//)) {
        extractVideoThumbnail(file, function(base64) {
          if (base64) addBloomLibraryItem(scope, base64, 'image/jpeg', file.name);
          processed++;
          if (processed >= filesToProcess) { renderBloomLibrary(); event.target.value = ''; }
        });
        return;
      }

      compressBloomLibraryImage(file, function(base64) {
        if (base64) addBloomLibraryItem(scope, base64, 'image/jpeg', file.name);
        processed++;
        if (processed >= filesToProcess) { renderBloomLibrary(); event.target.value = ''; }
      });
    })(files[f]);
  }
}

function handleBloomLibraryDrop(event) {
  event.preventDefault();
  var dt = event.dataTransfer;
  if (!dt || !dt.files || dt.files.length === 0) return;
  handleBloomLibraryUpload({ target: { files: dt.files, value: '' } });
}

function compressBloomLibraryImage(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var maxDim = BLOOM_LIBRARY_MAX_PX;
      var w = img.width;
      var h = img.height;
      if (w > maxDim) { h = Math.round(h * (maxDim / w)); w = maxDim; }
      if (h > maxDim) { w = Math.round(w * (maxDim / h)); h = maxDim; }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = function() { callback(null); };
    img.src = e.target.result;
  };
  reader.onerror = function() { callback(null); };
  reader.readAsDataURL(file);
}

function extractVideoThumbnail(file, callback) {
  try {
    var video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    var url = URL.createObjectURL(file);
    video.src = url;
    video.onloadeddata = function() {
      video.currentTime = Math.min(1, video.duration / 2);
    };
    video.onseeked = function() {
      var canvas = document.createElement('canvas');
      var w = Math.min(video.videoWidth, BLOOM_LIBRARY_MAX_PX);
      var h = Math.round(video.videoHeight * (w / video.videoWidth));
      canvas.width = w;
      canvas.height = h;
      var ctx2d = canvas.getContext('2d');
      ctx2d.drawImage(video, 0, 0, w, h);
      var base64 = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(url);
      callback(base64);
    };
    video.onerror = function() {
      URL.revokeObjectURL(url);
      callback(null);
    };
  } catch (e) {
    console.warn('[Bloom Library] Video thumbnail extraction failed:', e);
    callback(null);
  }
}

function addBloomLibraryItem(scope, base64, mimeType, name) {
  var lib = getBloomLibrary();
  if (!lib[scope]) lib[scope] = [];
  if (lib[scope].length >= BLOOM_LIBRARY_MAX) return;

  var agentType = (_bloomLibraryTab && _bloomLibraryTab !== 'all') ? _bloomLibraryTab : 'strategy';

  // v22.17: Resolve brand label for item
  var _addBrandIdx = scope.indexOf('brand_') === 0 ? parseInt(scope.replace('brand_', ''), 10) : -1;
  var _addBrandLabel = '';
  if (_addBrandIdx >= 0 && typeof brands !== 'undefined' && brands[_addBrandIdx]) {
    _addBrandLabel = brands[_addBrandIdx].shortName || brands[_addBrandIdx].name || '';
  }

  var item = {
    id: 'blib_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
    base64: base64,
    mimeType: mimeType || 'image/jpeg',
    agentType: agentType,
    active: true,
    name: name || 'Reference image',
    brandLabel: _addBrandLabel,
    addedAt: Date.now(),
    thumbnailUrl: ''
  };

  lib[scope].push(item);
  saveBloomLibrary(lib);
  uploadBloomLibraryToStorage(scope, item);
  showToast('Added to ' + agentType + ' content library', 'success');
}

function toggleBloomLibraryItem(itemId) {
  var scope = getBloomLibraryScope();
  var lib = getBloomLibrary();
  var items = lib[scope] || [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === itemId) {
      items[i].active = !items[i].active;
      break;
    }
  }
  lib[scope] = items;
  saveBloomLibrary(lib);
  renderBloomLibrary();
}

function removeBloomLibraryItem(itemId) {
  var scope = getBloomLibraryScope();
  var lib = getBloomLibrary();
  var items = lib[scope] || [];
  lib[scope] = items.filter(function(item) { return item.id !== itemId; });
  saveBloomLibrary(lib);
  renderBloomLibrary();

  if (typeof firebaseUser !== 'undefined' && firebaseUser && typeof firebase !== 'undefined' && firebase && firebase.storage) {
    var storagePath = 'users/' + firebaseUser.uid + '/bloom_library/' + scope + '/' + itemId;
    try { deleteFromStorage(storagePath).catch(function() {}); } catch(e) {}
  }
  showToast('Removed from content library', 'success');
}

// v22.17: Reassign a library item to a different brand
function bloomLibraryReassignBrand(itemId) {
  var currentScope = getBloomLibraryScope();
  var lib = getBloomLibrary();
  var items = lib[currentScope] || [];
  var item = null;
  var itemIdx = -1;
  for (var fi = 0; fi < items.length; fi++) {
    if (items[fi].id === itemId) { item = items[fi]; itemIdx = fi; break; }
  }
  if (!item) return;

  // Build brand options
  var opts = [];
  if (typeof brands !== 'undefined') {
    for (var bi = 0; bi < brands.length; bi++) {
      var bName = brands[bi].shortName || brands[bi].name || ('Brand ' + bi);
      var bScope = 'brand_' + bi;
      if (bScope !== currentScope) {
        opts.push({ name: bName, scope: bScope });
      }
    }
  }
  if (opts.length === 0) {
    showToast('No other brands to move to', 'info');
    return;
  }

  // Simple dropdown overlay
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
  var card = document.createElement('div');
  card.style.cssText = 'background:var(--bg-secondary, #1c1c1e);border:1px solid var(--border-color, rgba(255,255,255,0.1));border-radius:12px;padding:16px 20px;min-width:220px;max-width:320px;';
  card.innerHTML = '<div style="font-size:13px;font-weight:600;color:var(--text-primary,#fff);margin-bottom:12px;">Move to brand</div>';
  for (var oi = 0; oi < opts.length; oi++) {
    var btn = document.createElement('button');
    btn.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:4px;background:transparent;border:1px solid var(--border-color, rgba(255,255,255,0.08));border-radius:8px;color:var(--text-primary,#fff);font-size:13px;cursor:pointer;transition:background 0.15s;';
    btn.textContent = opts[oi].name;
    btn.setAttribute('data-scope', opts[oi].scope);
    btn.setAttribute('data-name', opts[oi].name);
    btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.06)'; };
    btn.onmouseout = function() { this.style.background = 'transparent'; };
    btn.onclick = function() {
      var newScope = this.getAttribute('data-scope');
      var newName = this.getAttribute('data-name');
      // Move item from current scope to new scope
      var libNow = getBloomLibrary();
      var srcItems = libNow[currentScope] || [];
      var moved = null;
      libNow[currentScope] = srcItems.filter(function(si) {
        if (si.id === itemId) { moved = si; return false; }
        return true;
      });
      if (moved) {
        moved.brandLabel = newName;
        if (!libNow[newScope]) libNow[newScope] = [];
        if (libNow[newScope].length < BLOOM_LIBRARY_MAX) {
          libNow[newScope].push(moved);
          saveBloomLibrary(libNow);
          // Move in Storage too
          if (typeof firebaseUser !== 'undefined' && firebaseUser && typeof firebase !== 'undefined' && firebase && firebase.storage) {
            var oldPath = 'users/' + firebaseUser.uid + '/bloom_library/' + currentScope + '/' + itemId;
            try { deleteFromStorage(oldPath).catch(function() {}); } catch(e) {}
            uploadBloomLibraryToStorage(newScope, moved);
          }
          showToast('Moved to ' + newName, 'success');
        } else {
          showToast(newName + ' library is full (' + BLOOM_LIBRARY_MAX + ' max)', 'warning');
          // Put it back
          libNow[currentScope].push(moved);
          saveBloomLibrary(libNow);
        }
      }
      overlay.remove();
      renderBloomLibrary();
    };
    card.appendChild(btn);
  }
  var cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'display:block;width:100%;text-align:center;padding:8px;margin-top:8px;background:transparent;border:none;color:var(--text-dim,#6b6560);font-size:12px;cursor:pointer;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() { overlay.remove(); };
  card.appendChild(cancelBtn);
  overlay.appendChild(card);
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function uploadBloomLibraryToStorage(scope, item) {
  if (typeof firebaseUser === 'undefined' || !firebaseUser) return;
  if (typeof firebase === 'undefined' || !firebase || !firebase.storage) return;
  try {
    var storagePath = 'users/' + firebaseUser.uid + '/bloom_library/' + scope + '/' + item.id;
    uploadToStorage(storagePath, item.base64, item.mimeType).then(function(url) {
      var lib = getBloomLibrary();
      var items = lib[scope] || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === item.id) {
          items[i].thumbnailUrl = url;
          break;
        }
      }
      lib[scope] = items;
      saveBloomLibrary(lib);
      // v25.1: saveBloomLibrary() already writes through to Firestore
    }).catch(function(err) {
      console.warn('[Bloom Library] Storage upload failed:', err);
    });
  } catch (e) {
    console.warn('[Bloom Library] Storage upload error:', e);
  }
}

function getBloomLibraryReferences(brandIdx, agentType, count) {
  if (!count) count = 2;
  var scope = 'brand_' + brandIdx;
  var items = getBloomLibraryItems(scope, 'all');
  if (items.length === 0) return [];

  var matching = items.filter(function(item) { return item.active && item.agentType === agentType; });
  var pool = matching.length > 0 ? matching : items.filter(function(item) { return item.active; });
  if (pool.length === 0) return [];

  var shuffled = pool.slice().sort(function() { return Math.random() - 0.5; });
  var selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return selected.map(function(item) {
    var raw = item.base64;
    if (raw.indexOf('data:') === 0) {
      raw = raw.split(',')[1] || raw;
    }
    return {
      base64: raw,
      mimeType: item.mimeType || 'image/jpeg'
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// v22.17: Bloom Knowledge Repository
// Text-based style/content preferences injected into generation prompts
// ═══════════════════════════════════════════════════════════════

function getBloomKnowledge() {
  try {
    return JSON.parse(localStorage.getItem('roweos_bloom_knowledge') || '{}');
  } catch (e) { return {}; }
}

function getBloomKnowledgeForScope(scope) {
  var k = getBloomKnowledge();
  return k[scope] || [];
}

function saveBloomKnowledge(knowledge) {
  try {
    localStorage.setItem('roweos_bloom_knowledge', JSON.stringify(knowledge));
    writeDB('profile/main', { bloomKnowledge: JSON.stringify(knowledge) }); // v25.1
  } catch (e) {
    console.warn('[Bloom Knowledge] Save failed:', e);
    if (typeof showToast === 'function') showToast('Knowledge save failed - storage may be full', 'error');
  }
}

function addBloomKnowledgeEntry(scope, text, agentType) {
  if (!text || !text.trim()) return false;
  var knowledge = getBloomKnowledge();
  if (!knowledge[scope]) knowledge[scope] = [];

  if (knowledge[scope].length >= BLOOM_KNOWLEDGE_MAX) {
    showToast('Bloom knowledge is full (' + BLOOM_KNOWLEDGE_MAX + ' max). Remove older entries in Settings to add more.', 'warning');
    return false;
  }

  // Simple dedup: skip if very similar text already exists
  var lowerText = text.trim().toLowerCase();
  for (var i = 0; i < knowledge[scope].length; i++) {
    if (knowledge[scope][i].text.toLowerCase() === lowerText) {
      showToast('This preference is already saved', 'info');
      return false;
    }
  }

  knowledge[scope].push({
    id: 'bk_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
    text: text.trim(),
    source: 'comment',
    agentType: agentType || 'general',
    addedAt: Date.now()
  });

  saveBloomKnowledge(knowledge);
  return true;
}

function bloomAddToKnowledge(postId, commentIdx) {
  var post = _bloomPosts.find(function(p) { return p.id === postId; });
  if (!post || !post.comments || !post.comments[commentIdx]) return;

  var userComment = post.comments[commentIdx].text;
  var scope = getBloomLibraryScope();
  var added = addBloomKnowledgeEntry(scope, userComment, post.agent || 'general');

  // Update button to "Added" state
  var btn = document.getElementById('bloom-knowledge-btn-' + postId);
  if (btn && added) {
    btn.className = 'bloom-comment-knowledge-btn added';
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Added';
    showToast('Preference saved to Bloom knowledge', 'success');
  }
}

function getBloomKnowledgePrompt(brandIdx) {
  var scope = 'brand_' + brandIdx;
  var entries = getBloomKnowledgeForScope(scope);
  if (entries.length === 0) return '';

  var prefs = entries.map(function(e) { return e.text; });
  return 'User content preferences for this brand (apply these to all generated content): ' + prefs.join('; ') + '.';
}

// v22.33: Settings Bloom preferences panel
function openSettingsBloomPreferences() {
  var panel = document.getElementById('settingsBloomPrefsPanel');
  if (!panel) return;
  var isVisible = panel.style.display !== 'none';
  panel.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) renderSettingsBloomPrefs();
}

function renderSettingsBloomPrefs() {
  var listEl = document.getElementById('settingsBloomPrefsList');
  if (!listEl) return;
  var knowledge = getBloomKnowledge();
  var allEntries = [];
  Object.keys(knowledge).forEach(function(scope) {
    knowledge[scope].forEach(function(entry) {
      allEntries.push({ scope: scope, entry: entry });
    });
  });
  // Update count
  var countEl = document.getElementById('bloomPrefsCount');
  if (countEl) countEl.textContent = allEntries.length + ' entr' + (allEntries.length === 1 ? 'y' : 'ies');

  if (allEntries.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No Bloom knowledge saved yet. Comment on Bloom posts and tap "+ Add to Bloom Knowledge" to build preferences.</div>';
    return;
  }
  var html = '';
  allEntries.forEach(function(item) {
    var scopeLabel = item.scope.replace('brand_', 'Brand ').replace('life_', 'Life ');
    html += '<div class="bloom-knowledge-entry" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border-color);">' +
      '<div style="flex:1;"><div style="font-size:13px;color:var(--text-primary);">' + escapeHtml(item.entry.text) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(scopeLabel) + ' &middot; ' + (item.entry.agentType || '') + '</div></div>' +
      '<button onclick="removeSettingsBloomPref(\'' + escapeHtml(item.entry.id) + '\',\'' + escapeHtml(item.scope) + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;" title="Remove">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
  });
  listEl.innerHTML = html;
}

// v22.33: Render Bloom knowledge in Identity view
function renderIdentityBloomKnowledge() {
  var listEl = document.getElementById('identityBloomKnowledgeList');
  if (!listEl) return;
  var scope = 'brand_' + (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
  var entries = getBloomKnowledgeForScope(scope);
  if (entries.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No Bloom knowledge for this brand yet. Comment on Bloom posts and tap "+ Add to Bloom Knowledge" to build preferences.</div>';
    return;
  }
  var html = '';
  entries.forEach(function(entry) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border-color);">' +
      '<div style="flex:1;"><div style="font-size:13px;color:var(--text-primary);line-height:1.5;">' + escapeHtml(entry.text) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + (entry.agentType || 'general') + ' &middot; ' + new Date(entry.addedAt).toLocaleDateString() + '</div></div>' +
      '<button onclick="removeIdentityBloomEntry(\'' + escapeHtml(entry.id) + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;" title="Remove">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
  });
  listEl.innerHTML = html;
}

function removeIdentityBloomEntry(entryId) {
  var scope = 'brand_' + (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
  var knowledge = getBloomKnowledge();
  if (knowledge[scope]) {
    knowledge[scope] = knowledge[scope].filter(function(e) { return e.id !== entryId; });
    if (knowledge[scope].length === 0) delete knowledge[scope];
    saveBloomKnowledge(knowledge);
    renderIdentityBloomKnowledge();
    showToast('Bloom preference removed', 'success');
  }
}

function removeSettingsBloomPref(entryId, scope) {
  var knowledge = getBloomKnowledge();
  if (knowledge[scope]) {
    knowledge[scope] = knowledge[scope].filter(function(e) { return e.id !== entryId; });
    if (knowledge[scope].length === 0) delete knowledge[scope];
    saveBloomKnowledge(knowledge);
    renderSettingsBloomPrefs();
    showToast('Preference removed', 'success');
  }
}

// v24.8: Populate User Contact Card UI from localStorage
function loadUserContactUI() {
  var c = getUserContact();
  var fields = ['Name','Title','Company','Email','WorkEmail','Phone','Website','Location'];
  for (var i = 0; i < fields.length; i++) {
    var el = document.getElementById('uc' + fields[i]);
    if (el) el.value = c[fields[i].charAt(0).toLowerCase() + fields[i].slice(1)] || '';
  }
}

function saveUserContactFromUI() {
  var contact = {};
  var fields = {ucName:'name',ucTitle:'title',ucCompany:'company',ucEmail:'email',ucWorkEmail:'workEmail',ucPhone:'phone',ucWebsite:'website',ucLocation:'location'};
  var keys = Object.keys(fields);
  for (var i = 0; i < keys.length; i++) {
    var el = document.getElementById(keys[i]);
    if (el && el.value.trim()) contact[fields[keys[i]]] = el.value.trim();
  }
  saveUserContact(contact);
  showToast('Contact info saved', 'success');
}

// v24.8: Render Automation Memory list in Identity view
function renderAutomationMemoryList() {
  var listEl = document.getElementById('automationMemoryList');
  var countEl = document.getElementById('automationMemoryCount');
  if (!listEl) return;
  var entries = getAutomationMemory();
  if (countEl) countEl.textContent = entries.length;
  if (entries.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No automation preferences learned yet. Save pipelines with recurring settings to build memory.</div>';
    return;
  }
  var html = '';
  entries.forEach(function(entry) {
    var active = (entry.count || 1) >= 2;
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border-color);">' +
      '<div style="flex:1;"><div style="font-size:13px;color:var(--text-primary);line-height:1.5;">' +
      '<span style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;font-size:11px;margin-right:6px;">' + escapeHtml(entry.category) + '</span>' +
      escapeHtml(entry.key) + ': <strong>' + escapeHtml(entry.value) + '</strong></div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Seen ' + (entry.count || 1) + 'x' +
      (active ? ' <span style="color:var(--color-success);">Active</span>' : ' <span style="opacity:0.5;">Pending (needs 2+)</span>') +
      ' &middot; ' + (entry.source || 'manual') + '</div></div>' +
      '<button onclick="removeAutomationMemoryEntry(\'' + escapeHtml(entry.id) + '\');renderAutomationMemoryList();" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;" title="Remove">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
  });
  listEl.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// v24.8: USER CONTACT CARD — Stores owner's contact info for AI injection
// ═══════════════════════════════════════════════════════════════

function getUserContact() {
  try { return JSON.parse(localStorage.getItem('roweos_user_contact') || '{}'); } catch(e) { return {}; }
}

function saveUserContact(contact) {
  if (!contact) return;
  contact.updatedAt = Date.now();
  try { localStorage.setItem('roweos_user_contact', JSON.stringify(contact)); } catch(e) {}
  // v25.3: Write to correct Firestore path (was profile/main, should be profile/userContact)
  writeDB('profile/userContact', { data: contact });
}

function getUserContactPrompt() {
  var c = getUserContact();
  if (!c.name && !c.email && !c.workEmail) return '';
  var parts = ['OWNER CONTACT INFORMATION (the user you are assisting):'];
  if (c.name) parts.push('Name: ' + c.name);
  if (c.title) parts.push('Title: ' + c.title);
  if (c.company) parts.push('Company: ' + c.company);
  if (c.email) parts.push('Personal Email: ' + c.email);
  if (c.workEmail) parts.push('Work Email: ' + c.workEmail);
  if (c.phone) parts.push('Phone: ' + c.phone);
  if (c.website) parts.push('Website: ' + c.website);
  if (c.location) parts.push('Location: ' + c.location);
  return parts.join('\n');
}

