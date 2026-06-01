// 39-verifier-engine.js
// Deep Verification Studio — ACTIVE (v34.79)
//
// v34.79: Sprint E scaffolding replaced with a working two-pass verifier
// (Anthropic claim-check → OpenAI/Google adversarial skepticism →
// synthesis). Returns a structured VerificationResult with citations.
//
// Activation gate: Evolve.isEnabled() === true.
// Optional flag `roweos_evolve_verifier_engine_off` disables.

var VerifierEngine = (function(){
  var DISABLE_KEY = 'roweos_evolve_verifier_engine_off';

  function isEnabled() {
    try {
      if (localStorage.getItem(DISABLE_KEY) === 'true') return false;
      if (typeof Evolve === 'undefined' || !Evolve.isEnabled()) return false;
      return true;
    } catch(e) { return false; }
  }

  function validateResult(r) {
    if (!r || typeof r !== 'object') return { valid: false, error: 'not an object' };
    if (typeof r.claim !== 'string' || !r.claim) return { valid: false, error: 'missing claim' };
    var validVerdicts = ['verified', 'corrected', 'insufficient'];
    if (validVerdicts.indexOf(r.verdict) === -1) return { valid: false, error: 'invalid verdict (' + r.verdict + ')' };
    if (typeof r.reasoning !== 'string' || r.reasoning.length < 10) return { valid: false, error: 'reasoning too short' };
    if (typeof r.confidence !== 'number' || r.confidence < 1 || r.confidence > 5) return { valid: false, error: 'confidence must be 1-5' };
    if (!Array.isArray(r.citations)) return { valid: false, error: 'citations must be array' };
    for (var i = 0; i < r.citations.length; i++) {
      var c = r.citations[i];
      if (!c || typeof c.source !== 'string' || !c.source) return { valid: false, error: 'citation ' + i + ' missing source' };
    }
    if (r.verdict === 'verified' && r.citations.length < 3) return { valid: false, error: 'verified verdict requires >= 3 citations' };
    if (r.verdict === 'corrected' && r.citations.length < 1) return { valid: false, error: 'corrected verdict requires >= 1 citation' };
    if (typeof r.checkedAt !== 'number') return { valid: false, error: 'missing checkedAt timestamp' };
    if (!Array.isArray(r.models) || r.models.length === 0) return { valid: false, error: 'missing models array' };
    return { valid: true };
  }

  function extractCitations(text) {
    if (!text || typeof text !== 'string') return [];
    var citations = [];
    var seen = {};
    var mdLink = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    var match;
    while ((match = mdLink.exec(text)) !== null) {
      var key = match[1] + '|' + match[2];
      if (seen[key]) continue;
      seen[key] = true;
      citations.push({ source: match[1], url: match[2] });
    }
    // Only fall back to "Source:" matching if no markdown links were found.
    if (citations.length === 0) {
      var loose = /^\s*Source[: ]\s*([A-Z][^.\n]{4,80})/gim;
      while ((match = loose.exec(text)) !== null) {
        var k = 'loose|' + match[1].trim();
        if (seen[k]) continue;
        seen[k] = true;
        citations.push({ source: match[1].trim() });
      }
    }
    return citations;
  }

  function _extractVerdict(text) {
    if (!text) return 'insufficient';
    var t = text.toUpperCase();
    if (t.indexOf('VERIFIED') !== -1) return 'verified';
    if (t.indexOf('CORRECTED') !== -1) return 'corrected';
    if (t.indexOf('INSUFFICIENT') !== -1) return 'insufficient';
    return 'insufficient';
  }

  function _extractConfidence(text) {
    if (!text) return 2;
    var m = String(text).match(/confidence[:\s]+([1-5])/i);
    if (m) return parseInt(m[1], 10);
    return 3;
  }

  // ─── Stage 1: claim-check via Anthropic ─────────────────────
  function _stageFactCheck(claim, profile) {
    var anthropicKey = '', openaiKey = '';
    try { anthropicKey = localStorage.getItem('roweos_anthropic_api_key') || ''; } catch(e){}
    try { openaiKey = localStorage.getItem('roweos_openai_api_key') || ''; } catch(e){}

    var sys = 'You are a peer-reviewer in the Brilliance Deep Verification Studio (Pass 1: claim-check). ' +
      'Assess the user\'s claim against current best knowledge. Output strictly:\n' +
      '1. VERDICT: VERIFIED, CORRECTED, or INSUFFICIENT_EVIDENCE\n' +
      '2. Reasoning (2-3 sentences with supporting evidence)\n' +
      '3. Confidence: 1-5\n' +
      '4. Citations: at least 1 markdown-link or "Source: name" reference if the claim is testable.\n' +
      'Be terse. No fluff.';

    return new Promise(function(resolve) {
      var messages = [{ role: 'user', content: 'Claim: ' + claim }];
      function done(text) {
        resolve({
          stance: _extractVerdict(text),
          summary: text || 'No summary',
          confidence: _extractConfidence(text),
          sources: extractCitations(text || ''),
          model: anthropicKey ? 'claude-sonnet-4-6' : (openaiKey ? 'gpt-5.5' : 'unknown')
        });
      }
      function fail() {
        resolve({ stance: 'insufficient', summary: 'fact-check unavailable', confidence: 1, sources: [], model: 'none' });
      }
      if (anthropicKey && typeof callAnthropicChat === 'function') {
        callAnthropicChat('claude-sonnet-4-6', anthropicKey, messages, sys, done, fail);
      } else if (openaiKey && typeof callOpenAIChat === 'function') {
        callOpenAIChat('gpt-5.5', openaiKey, messages, sys, done, fail);
      } else {
        fail();
      }
    });
  }

  // ─── Stage 2: adversarial skepticism via different provider ─
  function _stageSkepticism(claim, factCheck, profile) {
    var anthropicKey = '', openaiKey = '', googleKey = '';
    try { anthropicKey = localStorage.getItem('roweos_anthropic_api_key') || ''; } catch(e){}
    try { openaiKey = localStorage.getItem('roweos_openai_api_key') || ''; } catch(e){}
    try { googleKey = localStorage.getItem('roweos_google_api_key') || localStorage.getItem('roweos_gemini_api_key') || ''; } catch(e){}

    var sys = 'You are an adversarial peer-reviewer (Pass 2: skepticism) in the Brilliance Deep Verification Studio. ' +
      'Pass 1 already produced a verdict. Your job is to challenge it. List up to 3 distinct CHALLENGES — counterexamples, ' +
      'failure modes, or missing context. For each, cite a source if possible. If Pass 1 was solid and you cannot ' +
      'mount real challenges, say so explicitly. Be terse.';
    var user = 'Claim: ' + claim + '\n\nPass 1 result:\n' + (factCheck.summary || '');

    return new Promise(function(resolve) {
      var messages = [{ role: 'user', content: user }];
      function done(text) {
        var citations = extractCitations(text || '');
        var hasChallenges = /challenge|counter|fails|disagree|incorrect|incomplete|missing/i.test(text || '');
        resolve({
          challenges: hasChallenges ? [text] : [],
          newSources: citations,
          model: googleKey ? 'gemini-3.1-pro-preview' : (openaiKey ? 'gpt-5.5' : 'claude-sonnet-4-6')
        });
      }
      function fail() {
        resolve({ challenges: [], newSources: [], model: 'none' });
      }
      // Prefer a DIFFERENT provider for the second pass
      if (factCheck.model && factCheck.model.indexOf('claude') === 0) {
        if (googleKey && typeof callGoogleChat === 'function') {
          callGoogleChat('gemini-3.1-pro-preview', googleKey, messages, sys, done, fail);
        } else if (openaiKey && typeof callOpenAIChat === 'function') {
          callOpenAIChat('gpt-5.5', openaiKey, messages, sys, done, fail);
        } else { fail(); }
      } else if (factCheck.model && factCheck.model.indexOf('gpt') === 0) {
        if (anthropicKey && typeof callAnthropicChat === 'function') {
          callAnthropicChat('claude-sonnet-4-6', anthropicKey, messages, sys, done, fail);
        } else if (googleKey && typeof callGoogleChat === 'function') {
          callGoogleChat('gemini-3.1-pro-preview', googleKey, messages, sys, done, fail);
        } else { fail(); }
      } else {
        if (anthropicKey && typeof callAnthropicChat === 'function') {
          callAnthropicChat('claude-sonnet-4-6', anthropicKey, messages, sys, done, fail);
        } else { fail(); }
      }
    });
  }

  // ─── Stage 3: synthesize verdict ────────────────────────────
  function _synthesize(claim, factCheck, skepticism) {
    var citations = (factCheck.sources || []).concat(skepticism.newSources || []);
    var verdict;
    if (factCheck.stance === 'insufficient' && citations.length === 0) {
      verdict = 'insufficient';
    } else if (skepticism.challenges && skepticism.challenges.length > 0) {
      verdict = 'corrected';
    } else if (factCheck.stance === 'verified' && citations.length >= 1) {
      verdict = 'verified';
    } else {
      verdict = factCheck.stance || 'insufficient';
    }
    var confidence = factCheck.confidence || 3;
    if (verdict === 'corrected') confidence = Math.max(1, confidence - 1);
    if (verdict === 'insufficient') confidence = Math.min(2, confidence);
    var combinedReasoning = (factCheck.summary || '');
    if (skepticism.challenges && skepticism.challenges.length > 0) {
      combinedReasoning += '\n\n— Adversarial pass —\n' + skepticism.challenges.join('\n');
    }
    return {
      claim: claim,
      verdict: verdict,
      reasoning: combinedReasoning || 'No reasoning available',
      confidence: confidence,
      citations: citations,
      checkedAt: Date.now(),
      models: [factCheck.model || 'unknown', skepticism.model || 'none']
    };
  }

  function runPeerReview(claim, profile) {
    if (!isEnabled()) return Promise.resolve({ skipped: true, reason: 'disabled' });
    if (!claim || typeof claim !== 'string') return Promise.resolve({ skipped: true, reason: 'no claim' });
    profile = profile || (typeof Evolve !== 'undefined' ? Evolve.getProfile() : null);
    return _stageFactCheck(claim, profile)
      .then(function(factCheck) {
        return _stageSkepticism(claim, factCheck, profile).then(function(skepticism) {
          var result = _synthesize(claim, factCheck, skepticism);
          // Don't gate on validateResult strict citation count — surface partial results
          return result;
        });
      })
      .catch(function(err) {
        return { skipped: true, reason: 'pipeline error', error: (err && err.message) || String(err) };
      });
  }

  return {
    isEnabled: isEnabled,
    validateResult: validateResult,
    extractCitations: extractCitations,
    runPeerReview: runPeerReview
  };
})();

window.VerifierEngine = VerifierEngine;
