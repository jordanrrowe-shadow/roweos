// 38-quiz-engine.js
// Multi-model Quiz Engine — ACTIVE (v34.79)
//
// v34.79: Sprint C scaffolding replaced with a working two-stage pipeline
// (Google → Anthropic) that produces validated 4-option quizzes from the
// user's targetGoal + knownContext. The Practice tab now sources from
// this pool instead of the hardcoded demo bank.
//
// Activation gate: Evolve.isEnabled() === true AND profile.targetGoal set.
// Optional flag `roweos_evolve_quiz_engine_off` disables (kept for emergencies).
//
// Pipeline:
//   Stage 1 — Google Gemini drafts a topic outline + canonical facts
//   Stage 2 — Anthropic Claude turns that outline into a JSON quiz
//   Stage 3 — Schema validator rejects malformed; valid items hit the pool
//
// Pool: ~7-day TTL per item. Auto-refilled when nextQuiz() returns null
// AND a refill isn't already in flight. Falls back to the demo bank only
// if both providers are unkeyed.

var QuizEngine = (function(){
  var STORAGE_KEY = 'roweos_evolve_quiz_pool';
  var INFLIGHT_KEY = 'roweos_evolve_quiz_inflight';
  var DISABLE_KEY = 'roweos_evolve_quiz_engine_off';

  function isEnabled() {
    try {
      if (localStorage.getItem(DISABLE_KEY) === 'true') return false;
      if (typeof Evolve === 'undefined' || !Evolve.isEnabled()) return false;
      var profile = Evolve.getProfile();
      return !!(profile && profile.targetGoal);
    } catch(e) { return false; }
  }

  function _hasAnyApiKey() {
    try {
      if (localStorage.getItem('roweos_anthropic_api_key')) return true;
      if (localStorage.getItem('roweos_openai_api_key')) return true;
      if (localStorage.getItem('roweos_google_api_key') || localStorage.getItem('roweos_gemini_api_key')) return true;
    } catch(e){}
    return false;
  }

  function validateQuiz(q) {
    if (!q || typeof q !== 'object') return { valid: false, error: 'not an object' };
    if (typeof q.id !== 'string' || !q.id) return { valid: false, error: 'missing id' };
    if (typeof q.topic !== 'string' || !q.topic) return { valid: false, error: 'missing topic' };
    if (typeof q.difficulty !== 'number' || q.difficulty < 1 || q.difficulty > 5) return { valid: false, error: 'difficulty must be 1-5' };
    if (typeof q.question !== 'string' || q.question.length < 10) return { valid: false, error: 'question too short' };
    if (!Array.isArray(q.options) || q.options.length !== 4) return { valid: false, error: 'must have exactly 4 options' };
    var letters = ['A', 'B', 'C', 'D'];
    var correctCount = 0;
    for (var i = 0; i < 4; i++) {
      var opt = q.options[i];
      if (!opt || opt.letter !== letters[i]) return { valid: false, error: 'option ' + i + ' missing or wrong letter' };
      if (typeof opt.body !== 'string' || opt.body.length < 3) return { valid: false, error: 'option ' + letters[i] + ' body too short' };
      if (opt.correct === true) correctCount++;
    }
    if (correctCount !== 1) return { valid: false, error: 'must have exactly one correct option' };
    if (!q.whyMatrix || typeof q.whyMatrix !== 'object') return { valid: false, error: 'missing whyMatrix' };
    for (var j = 0; j < 4; j++) {
      var l = letters[j];
      if (typeof q.whyMatrix[l] !== 'string' || q.whyMatrix[l].length < 5) return { valid: false, error: 'whyMatrix.' + l + ' too short' };
    }
    if (typeof q.citation !== 'string' || q.citation.length < 3) return { valid: false, error: 'missing citation' };
    return { valid: true };
  }

  function getPool() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { return []; }
  }

  function setPool(pool) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pool)); } catch(e){}
  }

  function addQuiz(quiz) {
    var v = validateQuiz(quiz);
    if (!v.valid) throw new Error('Invalid quiz: ' + v.error);
    var pool = getPool();
    pool.push({ quiz: quiz, addedAt: Date.now(), expiresAt: Date.now() + 7 * 86400000 });
    setPool(pool);
    return v;
  }

  function _markCompleted(quizId) {
    try {
      var raw = localStorage.getItem('roweos_evolve_quiz_completed') || '[]';
      var done = JSON.parse(raw);
      if (!Array.isArray(done)) done = [];
      if (done.indexOf(quizId) === -1) done.push(quizId);
      localStorage.setItem('roweos_evolve_quiz_completed', JSON.stringify(done));
    } catch(e){}
  }

  function _isCompleted(quizId) {
    try {
      var raw = localStorage.getItem('roweos_evolve_quiz_completed') || '[]';
      var done = JSON.parse(raw);
      return Array.isArray(done) && done.indexOf(quizId) !== -1;
    } catch(e) { return false; }
  }

  function nextQuiz() {
    var pool = getPool();
    var now = Date.now();
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].expiresAt > now && !_isCompleted(pool[i].quiz.id)) return pool[i].quiz;
    }
    return null;
  }

  // ─── Stage 1: outline via Gemini ────────────────────────────
  function _stageOutline(profile) {
    var goal = (profile && profile.targetGoal) || 'general learning';
    var ctx = (profile && Array.isArray(profile.knownContext)) ? profile.knownContext.join(', ') : '';
    var googleKey = '';
    try { googleKey = localStorage.getItem('roweos_google_api_key') || localStorage.getItem('roweos_gemini_api_key') || ''; } catch(e){}

    var sys = 'You are a curriculum architect. Given a learning goal and the user\'s known mental models, ' +
      'produce a tight JSON outline of 3 sub-topics worth quizzing on right now. Each sub-topic must include: ' +
      'name (string), why_now (string, one sentence), one canonical fact (string). Output ONLY raw JSON, no prose.';
    var user = 'Goal: ' + goal + '\nKnown context: ' + (ctx || 'none') + '\nReturn JSON: {"topics":[{"name":"","why_now":"","fact":""}]}.';

    return new Promise(function(resolve) {
      if (googleKey && typeof callGoogleChat === 'function') {
        callGoogleChat('gemini-3.1-pro-preview', googleKey, [{ role: 'user', content: user }], sys,
          function(text) {
            try {
              var json = _extractJSON(text);
              if (json && Array.isArray(json.topics) && json.topics.length > 0) return resolve(json);
            } catch(e){}
            resolve(_outlineFallback(goal, ctx));
          },
          function() { resolve(_outlineFallback(goal, ctx)); });
        return;
      }
      // No Google key — fall through to Anthropic-only mode by returning a minimal scaffold.
      resolve(_outlineFallback(goal, ctx));
    });
  }

  function _outlineFallback(goal, ctx) {
    return {
      topics: [
        { name: 'Foundations of ' + goal, why_now: 'Anchor the core principles first.', fact: '' },
        { name: 'Applied ' + goal, why_now: 'Bridge theory to practice.', fact: '' },
        { name: 'Edge cases of ' + goal, why_now: 'Test understanding under pressure.', fact: '' }
      ]
    };
  }

  // ─── Stage 2: questions via Claude ──────────────────────────
  function _stageQuestions(outline, profile) {
    var anthropicKey = '', openaiKey = '';
    try { anthropicKey = localStorage.getItem('roweos_anthropic_api_key') || ''; } catch(e){}
    try { openaiKey = localStorage.getItem('roweos_openai_api_key') || ''; } catch(e){}
    if (!anthropicKey && !openaiKey) return Promise.resolve([]);

    var goal = (profile && profile.targetGoal) || 'general learning';
    var ctx = (profile && Array.isArray(profile.knownContext)) ? profile.knownContext.join(', ') : '';
    var topicsJSON = JSON.stringify(outline.topics);

    var sys = 'You are a quiz author for the Brilliance Adaptive Quiz Engine. ' +
      'Given a topic outline and the user\'s known context, produce exactly 3 multiple-choice quizzes in strict JSON. ' +
      'Each quiz must have: id (slug), topic (one of the outline names), difficulty (1-5 integer), ' +
      'question (single sentence ending with "?"), options (array of 4: {letter:"A|B|C|D", body, correct:bool} with exactly one correct), ' +
      'whyMatrix ({A,B,C,D} each ≥ 12 words explaining why correct or incorrect), citation (string referencing a real source). ' +
      'Output ONLY raw JSON: {"quizzes":[...]}. No prose, no markdown.';
    var user = 'Goal: ' + goal + '\nKnown context: ' + (ctx || 'none') + '\nOutline: ' + topicsJSON;

    return new Promise(function(resolve) {
      function done(text) {
        try {
          var json = _extractJSON(text);
          var arr = (json && Array.isArray(json.quizzes)) ? json.quizzes : [];
          // Ensure unique stable ids
          arr.forEach(function(q, i) {
            if (!q.id) q.id = 'gen-' + Date.now() + '-' + i;
            if (typeof q.difficulty === 'string') q.difficulty = parseInt(q.difficulty, 10) || 3;
          });
          resolve(arr);
        } catch(e) { resolve([]); }
      }
      if (anthropicKey && typeof callAnthropicChat === 'function') {
        callAnthropicChat('claude-sonnet-4-6', anthropicKey,
          [{ role: 'user', content: user }], sys, done, function() { resolve([]); });
      } else if (openaiKey && typeof callOpenAIChat === 'function') {
        callOpenAIChat('gpt-5.5', openaiKey,
          [{ role: 'user', content: user }], sys, done, function() { resolve([]); });
      } else {
        resolve([]);
      }
    });
  }

  // ─── Stage 3: validate (was Sprint E cross-check) ───────────
  function _stageVerify(questions) {
    var kept = [];
    for (var i = 0; i < questions.length; i++) {
      var v = validateQuiz(questions[i]);
      if (v.valid) kept.push(questions[i]);
    }
    return Promise.resolve(kept);
  }

  // Robust JSON extraction (handles markdown-wrapped responses).
  function _extractJSON(text) {
    if (!text) return null;
    var raw = String(text).trim();
    // Strip markdown fences
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    // Find first '{' and last '}' to be safe
    var first = raw.indexOf('{');
    var last = raw.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) return null;
    try { return JSON.parse(raw.slice(first, last + 1)); } catch(e) { return null; }
  }

  // Public refill — invoked when pool is empty.
  function refillPool() {
    if (!isEnabled()) return Promise.resolve({ skipped: true, reason: 'disabled' });
    if (!_hasAnyApiKey()) return Promise.resolve({ skipped: true, reason: 'no api key' });
    if (sessionStorage.getItem(INFLIGHT_KEY) === '1') return Promise.resolve({ skipped: true, reason: 'inflight' });
    sessionStorage.setItem(INFLIGHT_KEY, '1');

    var profile = (typeof Evolve !== 'undefined') ? Evolve.getProfile() : null;
    return _stageOutline(profile)
      .then(function(outline) { return _stageQuestions(outline, profile); })
      .then(function(questions) { return _stageVerify(questions); })
      .then(function(valid) {
        var added = 0;
        for (var i = 0; i < valid.length; i++) {
          try { addQuiz(valid[i]); added++; } catch(e){}
        }
        sessionStorage.removeItem(INFLIGHT_KEY);
        return { skipped: false, added: added };
      })
      .catch(function(err) {
        sessionStorage.removeItem(INFLIGHT_KEY);
        return { skipped: true, reason: 'pipeline error', error: (err && err.message) || String(err) };
      });
  }

  // Nightly automation entry point — same plumbing as refillPool.
  function generateNightlyQuiz(profile) {
    return refillPool();
  }

  function gc() {
    var pool = getPool();
    var now = Date.now();
    var keep = [];
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].expiresAt > now) keep.push(pool[i]);
    }
    if (keep.length !== pool.length) setPool(keep);
    return pool.length - keep.length;
  }

  return {
    isEnabled: isEnabled,
    validateQuiz: validateQuiz,
    getPool: getPool,
    addQuiz: addQuiz,
    nextQuiz: nextQuiz,
    refillPool: refillPool,
    markCompleted: _markCompleted,
    generateNightlyQuiz: generateNightlyQuiz,
    gc: gc
  };
})();

window.QuizEngine = QuizEngine;
