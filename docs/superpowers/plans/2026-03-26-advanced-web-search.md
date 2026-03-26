# Advanced Web Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deep web crawling + AI analysis to onboarding that extracts brand/personal identity from a website URL, running in the background with a network graph visualization.

**Architecture:** Client-orchestrated 5-stage pipeline (homepage discovery, subpage fan-out, gap analysis, external web search, final synthesis). Enhanced `/api/fetch-site-meta.js` returns discovered links. Standalone `advancedWebSearch` module + `WebSearchVisualizer` component built into index.html. Results save to existing Identity localStorage/Firestore paths.

**Tech Stack:** Vanilla JS (ES5 compat), HTML5 Canvas for network graph, existing Vercel serverless function, Anthropic/OpenAI/Google AI APIs (client-side, user's key).

**Spec:** `/Volumes/roweOS/docs/superpowers/specs/2026-03-26-advanced-web-search-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `/Volumes/roweOS/RoweOS/dist/api/fetch-site-meta.js` | Modify | Add `mode: "deep"` -- returns page content + discovered internal links |
| `/Volumes/roweOS/RoweOS/dist/index.html` ~50412-50570 | Modify | Replace onboarding Step 2 + WebsiteImport HTML with new fork + deep search UI |
| `/Volumes/roweOS/RoweOS/dist/index.html` ~48048-48225 | Modify | Add website import fork to LifeAI onboarding modal |
| `/Volumes/roweOS/RoweOS/dist/index.html` (new section after ~189090) | Create section | `advancedWebSearch` module -- crawl pipeline manager |
| `/Volumes/roweOS/RoweOS/dist/index.html` (new section after advancedWebSearch) | Create section | `WebSearchVisualizer` -- network graph canvas + identity cards + floating pill |
| `/Volumes/roweOS/RoweOS/dist/index.html` ~158832-158971 | Modify | Update `parseWebsiteForBrand()` to use new pipeline |
| `/Volumes/roweOS/RoweOS/dist/index.html` ~2790-2810 | Modify | Add CSS for floating indicator, takeover view, network graph |

---

### Task 1: Enhance `/api/fetch-site-meta.js` with Deep Mode

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/api/fetch-site-meta.js`

- [ ] **Step 1: Add URL normalization to all modes**

At the top of the handler, after the existing URL validation (line 31), the code already auto-prepends `https://`. Update the placeholder comment and ensure trailing slashes are stripped:

```javascript
// Line 31-33: Replace existing block
if (!/^https?:\/\//i.test(url)) {
  url = 'https://' + url;
}
url = url.replace(/\/+$/, ''); // Strip trailing slashes
```

- [ ] **Step 2: Add `mode: "deep"` handler**

After the `mode === 'content'` block (after line 105), add the deep mode handler before the meta mode section:

```javascript
    if (mode === 'deep') {
      // Step 1: Extract page content (same as content mode)
      var text = fullHtml
        .replace(/<img\b[^>]*(?:>|$)/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<picture[\s\S]*?<\/picture>/gi, '')
        .replace(/<video[\s\S]*?<\/video>/gi, '')
        .replace(/<audio[\s\S]*?<\/audio>/gi, '')
        .replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 12000) text = text.substring(0, 12000) + '...';

      // Step 2: Extract title
      var titleMatchDeep = fullHtml.substring(0, 50000).match(/<title[^>]*>([^<]*)<\/title>/i);

      // Step 3: Extract meta info
      var descDeep = '';
      var ogImageDeep = '';
      var faviconDeep = '';
      var metaRegexDeep = /<meta\s+[^>]*>/gi;
      var metaMatchDeep;
      while ((metaMatchDeep = metaRegexDeep.exec(fullHtml.substring(0, 100000))) !== null) {
        var tagD = metaMatchDeep[0];
        var nameD = (tagD.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i) || [])[1];
        var contentD = (tagD.match(/content\s*=\s*["']([^"']+)["']/i) || [])[1];
        if (nameD && contentD) {
          nameD = nameD.toLowerCase();
          if ((nameD === 'description' || nameD === 'og:description') && !descDeep) descDeep = contentD;
          if (nameD === 'og:image' && !ogImageDeep) ogImageDeep = contentD;
        }
      }
      var favMatchDeep = fullHtml.substring(0, 100000).match(/<link[^>]*rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href\s*=\s*["']([^"']+)["']/i);
      if (!favMatchDeep) favMatchDeep = fullHtml.substring(0, 100000).match(/<link[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon)["']/i);
      if (favMatchDeep) {
        faviconDeep = favMatchDeep[1];
        if (faviconDeep.startsWith('//')) faviconDeep = 'https:' + faviconDeep;
        else if (faviconDeep.startsWith('/')) faviconDeep = parsed.origin + faviconDeep;
        else if (!faviconDeep.startsWith('http')) faviconDeep = parsed.origin + '/' + faviconDeep;
      }
      if (!faviconDeep) faviconDeep = parsed.origin + '/favicon.ico';
      if (ogImageDeep && !ogImageDeep.startsWith('http')) {
        if (ogImageDeep.startsWith('//')) ogImageDeep = 'https:' + ogImageDeep;
        else if (ogImageDeep.startsWith('/')) ogImageDeep = parsed.origin + ogImageDeep;
        else ogImageDeep = parsed.origin + '/' + ogImageDeep;
      }

      // Step 4: Extract social links
      var socialDeep = {};
      var socialPatternsDeep = {
        x: [/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/],
        threads: [/threads\.net\/@?([a-zA-Z0-9_.]+)/],
        instagram: [/instagram\.com\/([a-zA-Z0-9_.]+)/],
        facebook: [/facebook\.com\/([a-zA-Z0-9_.]+)/],
        linkedin: [/linkedin\.com\/(?:in|company)\/([a-zA-Z0-9_-]+)/],
        youtube: [/youtube\.com\/(?:@|channel\/|c\/)?([a-zA-Z0-9_-]+)/],
        tiktok: [/tiktok\.com\/@([a-zA-Z0-9_.]+)/]
      };
      var linkRegexDeep = /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
      var linkMatchDeep;
      while ((linkMatchDeep = linkRegexDeep.exec(fullHtml.substring(0, 200000))) !== null) {
        var hrefD = linkMatchDeep[1];
        for (var platD in socialPatternsDeep) {
          var patsD = socialPatternsDeep[platD];
          for (var pd = 0; pd < patsD.length; pd++) {
            var mD = hrefD.match(patsD[pd]);
            if (mD && mD[1] && !socialDeep[platD]) {
              var handleD = mD[1].toLowerCase();
              if (['share', 'intent', 'sharer', 'home', 'explore', 'search', 'about', 'help', 'login', 'signup', 'policy', 'terms'].indexOf(handleD) === -1) {
                socialDeep[platD] = { handle: mD[1], url: hrefD };
              }
            }
          }
        }
      }

      // Step 5: Discover internal links
      var internalLinks = [];
      var seenUrls = {};
      seenUrls[parsed.href] = true;
      seenUrls[parsed.href + '/'] = true;
      var anchorRegex = /<a\s+[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([^<]*)<\/a>/gi;
      var anchorMatch;
      while ((anchorMatch = anchorRegex.exec(fullHtml)) !== null) {
        var linkHref = anchorMatch[1].trim();
        var linkText = anchorMatch[2].trim();
        // Resolve relative URLs
        var absUrl;
        try {
          absUrl = new URL(linkHref, parsed.href).href;
        } catch (e) { continue; }
        // Must be same domain
        var linkParsed;
        try { linkParsed = new URL(absUrl); } catch (e) { continue; }
        if (linkParsed.hostname !== parsed.hostname) continue;
        // Strip hash and trailing slash for dedup
        var cleanUrl = absUrl.split('#')[0].replace(/\/+$/, '');
        if (seenUrls[cleanUrl]) continue;
        seenUrls[cleanUrl] = true;
        // Skip file downloads, anchors, mailto, tel
        if (/\.(pdf|zip|png|jpg|jpeg|gif|svg|mp4|mp3|doc|docx|xls|xlsx)$/i.test(cleanUrl)) continue;
        if (cleanUrl.indexOf('mailto:') === 0 || cleanUrl.indexOf('tel:') === 0) continue;
        // Priority scoring
        var path = linkParsed.pathname.toLowerCase();
        var priority = 5;
        if (/\/(about|team|people|who-we-are|our-story)/.test(path)) priority = 1;
        else if (/\/(services|products|offerings|solutions|pricing|what-we-do|features)/.test(path)) priority = 2;
        else if (/\/(blog|news|press|media|articles|resources|insights)/.test(path)) priority = 3;
        else if (/\/(contact|location|get-in-touch|support)/.test(path)) priority = 4;
        internalLinks.push({ url: cleanUrl, text: linkText || path, priority: priority });
      }
      // Sort by priority, cap at 30
      internalLinks.sort(function(a, b) { return a.priority - b.priority; });
      if (internalLinks.length > 30) internalLinks = internalLinks.slice(0, 30);

      return res.status(200).json({
        url: parsed.href,
        domain: parsed.hostname,
        title: titleMatchDeep ? titleMatchDeep[1].trim() : '',
        description: descDeep,
        ogImage: ogImageDeep,
        favicon: faviconDeep,
        socialLinks: socialDeep,
        content: text,
        links: internalLinks
      });
    }
```

- [ ] **Step 3: Test the endpoint locally**

Run: `cd /Volumes/roweOS/RoweOS/dist && vercel dev`

Test with curl:
```bash
curl -X POST http://localhost:3000/api/fetch-site-meta \
  -H "Content-Type: application/json" \
  -d '{"url":"example.com","mode":"deep"}'
```

Expected: JSON response with `content`, `links[]` array with priority-sorted internal URLs, plus meta fields.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS/RoweOS/dist
git add api/fetch-site-meta.js
git commit -m "feat: add deep mode to fetch-site-meta for advanced web search"
```

---

### Task 2: Add CSS for Advanced Web Search Components

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` ~2790 (CSS section)

- [ ] **Step 1: Add CSS after the existing `#blobContainer` styles (after line ~2810)**

Insert after the `.blob-shape-btn:hover {` block (find the closing brace of `.blob-shape-btn` styles):

```css
/* v26.5: Advanced Web Search styles */
#webSearchFloatingIndicator {
  position: fixed;
  bottom: 80px;
  right: 20px;
  background: rgba(20, 20, 20, 0.95);
  border: 1px solid rgba(168, 152, 120, 0.3);
  border-radius: 16px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(12px);
  z-index: 1000;
  cursor: pointer;
  transition: all 0.3s ease;
  opacity: 0;
  transform: translateY(10px);
}
#webSearchFloatingIndicator.visible {
  opacity: 1;
  transform: translateY(0);
}
#webSearchFloatingIndicator .ws-mini-canvas {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
#webSearchFloatingIndicator .ws-label {
  font-size: 11px;
  color: var(--accent, #a89878);
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
#webSearchFloatingIndicator .ws-count {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}
#webSearchTakeover {
  display: none;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}
#webSearchTakeover.active {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
#webSearchTakeover .ws-graph-panel {
  flex: 1;
  min-width: 0;
  position: relative;
}
#webSearchTakeover .ws-graph-panel canvas {
  width: 100%;
  border-radius: 12px;
}
#webSearchTakeover .ws-cards-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
}
.ws-identity-card {
  background: rgba(168, 152, 120, 0.05);
  border: 1px solid rgba(168, 152, 120, 0.1);
  border-radius: 10px;
  padding: 10px 12px;
  transition: all 0.5s ease;
  opacity: 0.3;
}
.ws-identity-card.analyzing {
  opacity: 0.6;
  border-color: rgba(168, 152, 120, 0.2);
}
.ws-identity-card.filled {
  opacity: 1;
  background: rgba(168, 152, 120, 0.1);
  border-color: rgba(168, 152, 120, 0.25);
}
.ws-identity-card .ws-card-label {
  font-size: 10px;
  color: var(--accent, #a89878);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 4px;
  font-weight: 500;
}
.ws-identity-card .ws-card-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  max-height: 80px;
  overflow: hidden;
}
.ws-identity-card .ws-card-status {
  font-size: 10px;
  color: var(--text-muted);
  font-style: italic;
}
.ws-completion-msg {
  text-align: center;
  padding: 16px;
  color: var(--accent, #a89878);
  font-size: 13px;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.5s;
}
.ws-completion-msg.visible { opacity: 1; }
@media (max-width: 768px) {
  #webSearchFloatingIndicator {
    bottom: 70px;
    right: auto;
    left: 50%;
    transform: translateX(-50%) translateY(10px);
  }
  #webSearchFloatingIndicator.visible {
    transform: translateX(-50%) translateY(0);
  }
  #webSearchFloatingIndicator .ws-mini-canvas { display: none; }
  #webSearchTakeover.active {
    flex-direction: column;
  }
  #webSearchTakeover .ws-graph-panel {
    max-height: 200px;
    overflow: hidden;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS/RoweOS/dist
git add index.html
git commit -m "feat: add CSS for advanced web search visualization"
```

---

### Task 3: Build the `advancedWebSearch` Module

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` (insert new section after `setSymbioteColor` function, ~line 189090)

- [ ] **Step 1: Add the crawl state and core module**

Insert after the `setSymbioteColor` function closing brace (after line 189090):

```javascript
// v26.5: Advanced Web Search module — reusable deep crawl + AI analysis pipeline
var _webSearchState = {
  status: 'idle', // idle|discovering|crawling|analyzing|searching|synthesizing|complete|error
  url: '',
  provider: '',
  apiKey: '',
  model: '',
  brandName: '',
  mode: 'brand', // brand|life
  pages: [],       // [{ url, title, content, status:'pending'|'fetching'|'done'|'error', depth, priority }]
  gapAnalysis: null,
  externalResults: '',
  finalResults: null,
  error: null,
  _callbacks: { onProgress: null, onComplete: null, onError: null },
  _aborted: false
};

function startWebSearch(url, provider, apiKey, model, brandName, mode, callbacks) {
  // Normalize URL
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = url.replace(/\/+$/, '');

  _webSearchState = {
    status: 'discovering',
    url: url,
    provider: provider,
    apiKey: apiKey,
    model: model,
    brandName: brandName,
    mode: mode || 'brand',
    pages: [],
    gapAnalysis: null,
    externalResults: '',
    finalResults: null,
    error: null,
    _callbacks: callbacks || {},
    _aborted: false
  };

  // Save to localStorage for refresh resilience
  _saveWebSearchState();
  _fireProgress('discovering', 'Discovering pages...');

  // Stage 1: Homepage discovery
  _wsStage1Discover(url);
}

function cancelWebSearch() {
  _webSearchState._aborted = true;
  _webSearchState.status = 'idle';
  localStorage.removeItem('roweos_web_import_state');
}

function getWebSearchState() {
  return _webSearchState;
}

function _fireProgress(status, message) {
  _webSearchState.status = status;
  if (_webSearchState._callbacks.onProgress) {
    _webSearchState._callbacks.onProgress(_webSearchState, message);
  }
}

function _saveWebSearchState() {
  try {
    var toSave = {
      status: _webSearchState.status,
      url: _webSearchState.url,
      provider: _webSearchState.provider,
      brandName: _webSearchState.brandName,
      mode: _webSearchState.mode,
      pages: _webSearchState.pages.map(function(p) {
        return { url: p.url, title: p.title, status: p.status, depth: p.depth, priority: p.priority };
      })
    };
    localStorage.setItem('roweos_web_import_state', JSON.stringify(toSave));
  } catch (e) { /* quota exceeded - non-critical */ }
}
```

- [ ] **Step 2: Add Stage 1 -- Homepage Discovery**

```javascript
async function _wsStage1Discover(url) {
  if (_webSearchState._aborted) return;
  try {
    var resp = await fetch('/api/fetch-site-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, mode: 'deep' })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    if (data.error) throw new Error(data.error);

    // Add homepage as first page
    _webSearchState.pages.push({
      url: data.url || url,
      title: data.title || '',
      content: data.content || '',
      status: 'done',
      depth: 0,
      priority: 0
    });

    // Queue discovered links
    var links = data.links || [];
    for (var i = 0; i < links.length && i < 20; i++) {
      _webSearchState.pages.push({
        url: links[i].url,
        title: links[i].text || '',
        content: '',
        status: 'pending',
        depth: 1,
        priority: links[i].priority || 5
      });
    }

    _saveWebSearchState();
    _fireProgress('crawling', 'Found ' + links.length + ' pages. Crawling...');

    // Stage 2: Fan out
    _wsStage2Crawl();
  } catch (err) {
    _webSearchState.error = err.message;
    _fireProgress('error', 'Failed to reach website: ' + err.message);
    if (_webSearchState._callbacks.onError) _webSearchState._callbacks.onError(err);
  }
}
```

- [ ] **Step 3: Add Stage 2 -- Subpage Fan-out**

```javascript
async function _wsStage2Crawl() {
  if (_webSearchState._aborted) return;
  var pending = _webSearchState.pages.filter(function(p) { return p.status === 'pending'; });
  var batchSize = 5;
  var totalCrawled = 1; // homepage already done
  var maxPages = 20;

  while (pending.length > 0 && totalCrawled < maxPages) {
    if (_webSearchState._aborted) return;
    var batch = pending.splice(0, batchSize);

    var promises = batch.map(function(page) {
      page.status = 'fetching';
      _fireProgress('crawling', 'Crawling ' + totalCrawled + ' of ' + Math.min(_webSearchState.pages.length, maxPages) + ' pages...');
      return fetch('/api/fetch-site-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: page.url, mode: 'content' })
      }).then(function(r) { return r.json(); }).then(function(data) {
        page.content = data.content || '';
        page.title = data.title || page.title;
        page.status = 'done';
        totalCrawled++;
        _saveWebSearchState();
        _fireProgress('crawling', 'Crawled ' + totalCrawled + ' pages...');
      }).catch(function(err) {
        page.status = 'error';
        page.content = '';
        console.warn('[WebSearch] Failed to crawl:', page.url, err.message);
      });
    });

    await Promise.all(promises);
    pending = _webSearchState.pages.filter(function(p) { return p.status === 'pending'; });
  }

  // Mark any remaining as skipped
  _webSearchState.pages.forEach(function(p) {
    if (p.status === 'pending') p.status = 'error';
  });

  _saveWebSearchState();
  _fireProgress('analyzing', 'Analyzing content...');

  // Stage 3
  _wsStage3GapAnalysis();
}
```

- [ ] **Step 4: Add Stage 3 -- Gap Analysis**

```javascript
async function _wsStage3GapAnalysis() {
  if (_webSearchState._aborted) return;
  // Concatenate all scraped content
  var allContent = _webSearchState.pages
    .filter(function(p) { return p.status === 'done' && p.content; })
    .map(function(p) { return '--- PAGE: ' + p.url + ' ---\n' + p.content; })
    .join('\n\n');

  // Trim to token budget
  var maxChars = _webSearchState.provider === 'google' ? 100000 : (_webSearchState.provider === 'anthropic' ? 80000 : 60000);
  if (allContent.length > maxChars) allContent = allContent.substring(0, maxChars);

  var sections = _webSearchState.mode === 'brand'
    ? ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive']
    : ['role', 'skills', 'communication', 'interests', 'goals', 'routine', 'personality'];

  var sectionLabels = _webSearchState.mode === 'brand'
    ? { essence: 'Brand Essence', voice: 'Voice & Tone', audience: 'Target Audience', messaging: 'Key Messaging', products: 'Products & Services', visual: 'Visual Identity', competitive: 'Competitive Positioning' }
    : { role: 'Role & Profession', skills: 'Skills & Expertise', communication: 'Communication Style', interests: 'Interests & Passions', goals: 'Goals', routine: 'Daily Routine', personality: 'Personality Traits' };

  var prompt = 'You are analyzing website content for a ' + (_webSearchState.mode === 'brand' ? 'brand' : 'person') + ' called "' + _webSearchState.brandName + '" (URL: ' + _webSearchState.url + ').\n\n'
    + 'Here is the scraped content from their website:\n\n' + allContent + '\n\n'
    + 'Assess which of these identity sections have strong data coverage from the website content, which are partially covered, and which are missing entirely:\n'
    + sections.map(function(s) { return '- ' + sectionLabels[s]; }).join('\n') + '\n\n'
    + 'Return ONLY valid JSON in this exact format (no markdown, no code blocks):\n'
    + '{"covered":["section_key",...],"partial":["section_key",...],"missing":["section_key",...],"searchQueries":["query 1","query 2","query 3"]}\n\n'
    + 'The searchQueries should be web search queries to find information about the missing/partial sections. Use the brand name in queries. Max 5 queries.';

  try {
    var gapResult = await _wsCallAI(prompt, false);
    // Parse JSON from response
    var jsonMatch = gapResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      _webSearchState.gapAnalysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON in gap analysis response');
    }
    _saveWebSearchState();
    _fireProgress('searching', 'Searching the web for additional info...');
    _wsStage4WebSearch();
  } catch (err) {
    console.warn('[WebSearch] Gap analysis failed, skipping to synthesis:', err.message);
    _webSearchState.gapAnalysis = { covered: [], partial: [], missing: sections, searchQueries: [] };
    _fireProgress('synthesizing', 'Synthesizing brand identity...');
    _wsStage5Synthesis();
  }
}
```

- [ ] **Step 5: Add Stage 4 -- External Web Search**

```javascript
async function _wsStage4WebSearch() {
  if (_webSearchState._aborted) return;
  var gap = _webSearchState.gapAnalysis;
  if (!gap || (!gap.missing.length && !gap.partial.length) || !gap.searchQueries || !gap.searchQueries.length) {
    // Nothing to search for
    _fireProgress('synthesizing', 'Synthesizing identity...');
    _wsStage5Synthesis();
    return;
  }

  var prompt = 'You are researching a ' + (_webSearchState.mode === 'brand' ? 'brand' : 'person') + ' called "' + _webSearchState.brandName + '" (website: ' + _webSearchState.url + ').\n\n'
    + 'I need you to search the web for information about these aspects that are missing or incomplete from their website:\n'
    + gap.searchQueries.map(function(q, i) { return (i + 1) + '. ' + q; }).join('\n') + '\n\n'
    + 'Search for each query and compile your findings. Focus on factual information -- reviews, press mentions, competitor comparisons, social media presence, and public perception.\n\n'
    + 'Return your findings organized by topic. Be specific and cite sources where possible.';

  try {
    var searchResult = await _wsCallAI(prompt, true); // true = enable web search
    _webSearchState.externalResults = searchResult;
    // Add virtual "external search" pages for the visualization
    var extPages = (gap.searchQueries || []).slice(0, 5);
    for (var ei = 0; ei < extPages.length; ei++) {
      _webSearchState.pages.push({
        url: 'search://' + extPages[ei].substring(0, 40),
        title: extPages[ei],
        content: '',
        status: 'done',
        depth: 2,
        priority: 6,
        isExternal: true
      });
    }
    _saveWebSearchState();
    _fireProgress('synthesizing', 'Synthesizing identity...');
    _wsStage5Synthesis();
  } catch (err) {
    console.warn('[WebSearch] Web search failed, continuing with scraped data:', err.message);
    _fireProgress('synthesizing', 'Synthesizing identity...');
    _wsStage5Synthesis();
  }
}
```

- [ ] **Step 6: Add Stage 5 -- Final Synthesis**

```javascript
async function _wsStage5Synthesis() {
  if (_webSearchState._aborted) return;
  var allContent = _webSearchState.pages
    .filter(function(p) { return p.status === 'done' && p.content && !p.isExternal; })
    .map(function(p) { return '--- ' + p.url + ' ---\n' + p.content; })
    .join('\n\n');

  var maxChars = _webSearchState.provider === 'google' ? 100000 : (_webSearchState.provider === 'anthropic' ? 80000 : 60000);
  // Reserve space for external results + prompt
  var extLen = (_webSearchState.externalResults || '').length;
  var contentBudget = maxChars - extLen - 3000;
  if (allContent.length > contentBudget) allContent = allContent.substring(0, contentBudget);

  var isBrand = _webSearchState.mode === 'brand';
  var sectionsJson = isBrand
    ? '{"essence":"...","voice":"...","audience":"...","messaging":"...","products":"...","visual":"...","competitive":"..."}'
    : '{"role":"...","skills":"...","communication":"...","interests":"...","goals":"...","routine":"...","personality":"..."}';

  var prompt = 'You are a ' + (isBrand ? 'brand strategist' : 'personal branding expert') + ' creating a comprehensive identity profile for "' + _webSearchState.brandName + '".\n\n'
    + 'WEBSITE CONTENT:\n' + allContent + '\n\n';

  if (_webSearchState.externalResults) {
    prompt += 'EXTERNAL RESEARCH:\n' + _webSearchState.externalResults + '\n\n';
  }

  prompt += 'Synthesize all information into a polished identity profile. Write 2-4 paragraphs for each section. '
    + 'Be specific to this ' + (isBrand ? 'brand' : 'person') + ' -- no generic filler. Professional tone.\n\n'
    + 'Return ONLY valid JSON (no markdown, no code blocks) in this exact format:\n' + sectionsJson + '\n\n'
    + 'Each value should be 2-4 paragraphs of rich, specific content. If a section has insufficient data, write what you can and note what could be added manually.';

  try {
    var result = await _wsCallAI(prompt, false);
    var jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in synthesis response');
    _webSearchState.finalResults = JSON.parse(jsonMatch[0]);
    _webSearchState.status = 'complete';
    _saveWebSearchState();
    _fireProgress('complete', 'Identity profile complete!');
    if (_webSearchState._callbacks.onComplete) {
      _webSearchState._callbacks.onComplete(_webSearchState.finalResults);
    }
  } catch (err) {
    _webSearchState.error = err.message;
    _fireProgress('error', 'Synthesis failed: ' + err.message);
    if (_webSearchState._callbacks.onError) _webSearchState._callbacks.onError(err);
  }

  // Clean up localStorage state
  localStorage.removeItem('roweos_web_import_state');
}
```

- [ ] **Step 7: Add the AI call helper that works with all 3 providers**

```javascript
async function _wsCallAI(prompt, enableWebSearch) {
  var provider = _webSearchState.provider;
  var apiKey = _webSearchState.apiKey;
  var model = _webSearchState.model;

  if (provider === 'anthropic') {
    return _wsCallClaude(prompt, apiKey, model, enableWebSearch);
  } else if (provider === 'openai') {
    return _wsCallGPT(prompt, apiKey, model, enableWebSearch);
  } else if (provider === 'google') {
    return _wsCallGemini(prompt, apiKey, model, enableWebSearch);
  }
  throw new Error('Unknown provider: ' + provider);
}

async function _wsCallClaude(prompt, apiKey, model, enableWebSearch) {
  var body = {
    model: model || 'claude-sonnet-4-6-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }]
  };
  if (enableWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];
  }
  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Claude API error: ' + resp.status + ' ' + errText.substring(0, 200));
  }
  var data = await resp.json();
  // Extract text from content blocks
  var text = '';
  if (data.content) {
    for (var i = 0; i < data.content.length; i++) {
      if (data.content[i].type === 'text') text += data.content[i].text;
    }
  }
  return text;
}

async function _wsCallGPT(prompt, apiKey, model, enableWebSearch) {
  var body = {
    model: model || 'gpt-5.4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8192
  };
  if (enableWebSearch) {
    body.tools = [{ type: 'web_search_preview' }];
  }
  var resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('GPT API error: ' + resp.status + ' ' + errText.substring(0, 200));
  }
  var data = await resp.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

async function _wsCallGemini(prompt, apiKey, model, enableWebSearch) {
  var gemModel = model || 'gemini-2.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + gemModel + ':generateContent?key=' + apiKey;
  var body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 8192 }
  };
  if (enableWebSearch) {
    body.tools = [{ googleSearch: {} }];
  }
  var resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Gemini API error: ' + resp.status + ' ' + errText.substring(0, 200));
  }
  var data = await resp.json();
  var text = '';
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    data.candidates[0].content.parts.forEach(function(p) { if (p.text) text += p.text; });
  }
  return text;
}
```

- [ ] **Step 8: Commit**

```bash
cd /Volumes/roweOS/RoweOS/dist
git add index.html
git commit -m "feat: add advancedWebSearch crawl pipeline module"
```

---

### Task 4: Build the WebSearchVisualizer

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` (insert after the advancedWebSearch module)

- [ ] **Step 1: Add the network graph renderer**

Insert after the `_wsCallGemini` function:

```javascript
// v26.5: WebSearchVisualizer — network graph + identity cards + floating pill

// Force-directed graph state
var _wsGraphNodes = [];
var _wsGraphAnimId = null;

function renderNetworkGraph(canvasEl, state) {
  if (!canvasEl) return;
  var ctx = canvasEl.getContext('2d');
  var w = canvasEl.width;
  var h = canvasEl.height;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasEl.width = canvasEl.offsetWidth * dpr;
  canvasEl.height = canvasEl.offsetHeight * dpr;
  w = canvasEl.width;
  h = canvasEl.height;
  ctx.scale(dpr, dpr);
  var cw = w / dpr;
  var ch = h / dpr;

  // Build nodes from state
  _wsGraphNodes = [];
  var pages = state.pages || [];
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    var existing = _wsGraphNodes[i];
    var angle = (i === 0) ? 0 : ((i / pages.length) * Math.PI * 2 + Math.random() * 0.3);
    var dist = p.depth === 0 ? 0 : (p.depth === 1 ? 80 + Math.random() * 40 : 140 + Math.random() * 30);
    _wsGraphNodes.push({
      x: existing ? existing.x : (cw / 2 + Math.cos(angle) * dist),
      y: existing ? existing.y : (ch / 2 + Math.sin(angle) * dist),
      tx: cw / 2 + Math.cos(angle) * dist,
      ty: ch / 2 + Math.sin(angle) * dist,
      url: p.url,
      title: p.title,
      status: p.status,
      depth: p.depth,
      isExternal: p.isExternal || false,
      radius: p.depth === 0 ? 8 : (p.depth === 1 ? 5 : 3)
    });
  }

  // Animate
  if (_wsGraphAnimId) cancelAnimationFrame(_wsGraphAnimId);

  function drawGraph() {
    ctx.clearRect(0, 0, cw, ch);

    // Draw edges
    for (var i = 1; i < _wsGraphNodes.length; i++) {
      var node = _wsGraphNodes[i];
      var parent = _wsGraphNodes[0]; // all connect to center for simplicity
      ctx.beginPath();
      ctx.moveTo(parent.x, parent.y);
      ctx.lineTo(node.x, node.y);
      if (node.isExternal) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(120, 160, 200, 0.25)';
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(168, 152, 120, ' + (node.status === 'done' ? '0.35' : '0.12') + ')';
      }
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw nodes
    for (var j = 0; j < _wsGraphNodes.length; j++) {
      var n = _wsGraphNodes[j];
      // Lerp to target position
      n.x += (n.tx - n.x) * 0.05;
      n.y += (n.ty - n.y) * 0.05;

      var alpha = n.status === 'done' ? 0.9 : (n.status === 'fetching' ? 0.6 : 0.25);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      if (n.isExternal) {
        ctx.fillStyle = 'rgba(120, 160, 200, ' + alpha + ')';
      } else {
        ctx.fillStyle = 'rgba(168, 152, 120, ' + alpha + ')';
      }
      ctx.fill();

      // Pulse for fetching nodes
      if (n.status === 'fetching') {
        var pulseR = n.radius + 4 + Math.sin(Date.now() * 0.005) * 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(168, 152, 120, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label for depth 0 and 1 nodes
      if (n.depth <= 1 && n.status === 'done') {
        var label = n.depth === 0 ? (new URL(n.url).hostname) : ('/' + n.url.split('/').slice(3).join('/'));
        if (label.length > 20) label = label.substring(0, 20) + '...';
        ctx.fillStyle = 'rgba(150, 140, 125, 0.6)';
        ctx.font = '9px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, n.x, n.y + n.radius + 12);
      }
    }

    // Pulse for center node when discovering
    if (_wsGraphNodes.length > 0 && (state.status === 'discovering' || state.status === 'crawling')) {
      var cn = _wsGraphNodes[0];
      var pr = cn.radius + 6 + Math.sin(Date.now() * 0.003) * 3;
      ctx.beginPath();
      ctx.arc(cn.x, cn.y, pr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168, 152, 120, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    _wsGraphAnimId = requestAnimationFrame(drawGraph);
  }
  drawGraph();
}

function stopNetworkGraph() {
  if (_wsGraphAnimId) {
    cancelAnimationFrame(_wsGraphAnimId);
    _wsGraphAnimId = null;
  }
}
```

- [ ] **Step 2: Add identity cards renderer**

```javascript
function renderIdentityCards(containerEl, state) {
  if (!containerEl) return;
  var isBrand = state.mode === 'brand';
  var sections = isBrand
    ? [
        { key: 'essence', label: 'Brand Essence', icon: '\u2726' },
        { key: 'voice', label: 'Voice & Tone', icon: '\u25CE' },
        { key: 'audience', label: 'Target Audience', icon: '\u25C7' },
        { key: 'messaging', label: 'Key Messaging', icon: '\u25C6' },
        { key: 'products', label: 'Products & Services', icon: '\u25A3' },
        { key: 'visual', label: 'Visual Identity', icon: '\u2727' },
        { key: 'competitive', label: 'Competitive Positioning', icon: '\u2B21' }
      ]
    : [
        { key: 'role', label: 'Role & Profession', icon: '\u25CE' },
        { key: 'skills', label: 'Skills & Expertise', icon: '\u2726' },
        { key: 'communication', label: 'Communication Style', icon: '\u25C7' },
        { key: 'interests', label: 'Interests & Passions', icon: '\u25C6' },
        { key: 'goals', label: 'Goals', icon: '\u25A3' },
        { key: 'routine', label: 'Daily Routine', icon: '\u2727' },
        { key: 'personality', label: 'Personality Traits', icon: '\u2B21' }
      ];

  var html = '';
  for (var i = 0; i < sections.length; i++) {
    var s = sections[i];
    var filled = state.finalResults && state.finalResults[s.key];
    var analyzing = state.status === 'synthesizing' || state.status === 'analyzing' || state.status === 'searching';
    var cssClass = filled ? 'filled' : (analyzing ? 'analyzing' : '');
    html += '<div class="ws-identity-card ' + cssClass + '" data-section="' + s.key + '">';
    html += '<div class="ws-card-label">' + s.icon + ' ' + s.label + '</div>';
    if (filled) {
      var content = state.finalResults[s.key];
      if (content.length > 200) content = content.substring(0, 200) + '...';
      html += '<div class="ws-card-content">' + content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
    } else if (analyzing) {
      html += '<div class="ws-card-status">Analyzing...</div>';
    } else {
      html += '<div class="ws-card-status">Waiting...</div>';
    }
    html += '</div>';
  }
  containerEl.innerHTML = html;
}
```

- [ ] **Step 3: Add floating indicator renderer**

```javascript
function renderFloatingIndicator(state) {
  var el = document.getElementById('webSearchFloatingIndicator');
  if (!el) return;

  if (state.status === 'idle' || state.status === 'complete' || state.status === 'error') {
    el.classList.remove('visible');
    return;
  }

  el.classList.add('visible');

  var doneCount = state.pages.filter(function(p) { return p.status === 'done'; }).length;
  var totalCount = state.pages.length;

  var labelEl = el.querySelector('.ws-label');
  var countEl = el.querySelector('.ws-count');
  if (labelEl) {
    var labels = {
      discovering: 'DISCOVERING',
      crawling: 'SCANNING',
      analyzing: 'ANALYZING',
      searching: 'SEARCHING WEB',
      synthesizing: 'SYNTHESIZING'
    };
    labelEl.textContent = labels[state.status] || 'WORKING';
  }
  if (countEl) countEl.textContent = doneCount + ' of ' + totalCount + ' pages';

  // Update mini canvas
  var miniCanvas = el.querySelector('.ws-mini-canvas');
  if (miniCanvas) {
    renderMiniGraph(miniCanvas, state);
  }
}

function renderMiniGraph(canvas, state) {
  var ctx = canvas.getContext('2d');
  var s = 36;
  canvas.width = s * 2;
  canvas.height = s * 2;
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, s, s);

  var cx = s / 2, cy = s / 2;
  var pages = state.pages || [];

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#a89878';
  ctx.fill();

  // Satellite dots
  for (var i = 1; i < Math.min(pages.length, 12); i++) {
    var angle = (i / Math.min(pages.length, 12)) * Math.PI * 2;
    var r = 10 + (pages[i].depth || 1) * 3;
    var nx = cx + Math.cos(angle) * r;
    var ny = cy + Math.sin(angle) * r;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = 'rgba(168, 152, 120, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(nx, ny, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = pages[i].status === 'done' ? 'rgba(168, 152, 120, 0.7)' : 'rgba(168, 152, 120, 0.2)';
    ctx.fill();
  }

  // Pulse ring
  var pulseR = 5 + Math.sin(Date.now() * 0.004) * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(168, 152, 120, 0.15)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS/RoweOS/dist
git add index.html
git commit -m "feat: add WebSearchVisualizer - network graph, identity cards, floating pill"
```

---

### Task 5: Add HTML for Floating Indicator and Takeover View

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` (HTML section)

- [ ] **Step 1: Add the floating indicator HTML**

Find the `<div id="blobTitleGroup"` container (line ~52456). Insert immediately BEFORE it (outside the blobTitleGroup, at the top level of the landing page area):

```html
<!-- v26.5: Advanced Web Search floating indicator -->
<div id="webSearchFloatingIndicator">
  <canvas class="ws-mini-canvas" width="72" height="72"></canvas>
  <div>
    <div class="ws-label">SCANNING</div>
    <div class="ws-count">0 pages</div>
  </div>
</div>
```

- [ ] **Step 2: Add the takeover view HTML inside the onboarding step area**

Find the `onboardingWebsiteImport` div (line ~50453). Replace the ENTIRE div from `<div id="onboardingWebsiteImport"` through its closing `</div>` (lines 50453-50570) with:

```html
      <!-- Step 2.5a: Website Import (v26.5: Advanced deep search) -->
      <div id="onboardingWebsiteImport" class="onboarding-step" style="display: none;">
        <div class="onboarding-header">
          <h2 class="onboarding-title">Import from Website</h2>
          <p class="onboarding-subtitle">Enter your website and we'll build your brand identity while you finish setup</p>
        </div>

        <div class="onboarding-content" style="max-width: 600px; margin: 0 auto;">

          <!-- URL Input -->
          <div class="onboarding-input-group">
            <label class="onboarding-label">Website URL</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="color: var(--text-muted); font-size: var(--text-base); flex-shrink: 0;">https://</span>
              <input
                type="text"
                id="websiteImportUrl"
                class="onboarding-input"
                placeholder="yourbrand.com"
                style="font-size: var(--text-lg); padding: 14px 16px; width: 100%; box-sizing: border-box;"
              />
            </div>
          </div>

          <div style="background: rgba(168, 152, 120, 0.06); border: 1px solid rgba(168, 152, 120, 0.15); border-radius: var(--radius-md); padding: var(--space-4); margin-top: var(--space-4);">
            <div style="font-size: var(--text-base); color: var(--text-secondary); line-height: 1.6;">
              <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px; color: var(--accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              We'll deep-scan your website and search the web to extract your complete brand identity. This runs in the background while you continue setup.
            </div>
          </div>

        </div>

        <div class="onboarding-actions">
          <button class="onboarding-btn onboarding-btn-secondary" onclick="backToOnboardingChoice()">Back</button>
          <button class="onboarding-btn onboarding-btn-primary" id="websiteContinueBtn" onclick="saveWebsiteUrlAndContinue()">Continue</button>
        </div>
      </div>

      <!-- Step: Brand Identity Review (v26.5: shows after crawl) -->
      <div id="onboardingWebSearchReview" class="onboarding-step" style="display: none;">
        <div class="onboarding-header">
          <h2 class="onboarding-title">Building Your Brand Identity</h2>
          <p class="onboarding-subtitle" id="wsReviewSubtitle">Analyzing your website and the web...</p>
        </div>

        <div class="onboarding-content" style="max-width: 900px; margin: 0 auto;">
          <div id="webSearchTakeover">
            <div class="ws-graph-panel">
              <canvas id="wsGraphCanvas" style="width: 100%; height: 350px;"></canvas>
            </div>
            <div class="ws-cards-panel" id="wsCardsContainer"></div>
          </div>
          <div class="ws-completion-msg" id="wsCompletionMsg">Identity profile built! Review and edit below.</div>
        </div>

        <!-- Pre-filled editable fields (shown after completion) -->
        <div id="wsEditableFields" style="display: none; max-width: 600px; margin: 24px auto 0;">
          <div style="font-size: var(--text-sm); color: var(--text-muted); margin-bottom: 12px;">Edit any section before continuing:</div>
          <div style="display: flex; flex-direction: column; gap: var(--space-3); max-height: 50vh; overflow-y: auto; padding-right: var(--space-2);">
            <div class="onboarding-input-group" style="margin: 0;">
              <label class="onboarding-label" style="font-size: var(--text-sm);"><span style="color: var(--accent);">\u2726</span> Brand Essence</label>
              <textarea id="wsField_essence" class="onboarding-input" style="padding: 10px 12px; min-height: 80px; resize: vertical;"></textarea>
            </div>
            <div class="onboarding-input-group" style="margin: 0;">
              <label class="onboarding-label" style="font-size: var(--text-sm);"><span style="color: var(--accent);">\u25CE</span> Voice & Tone</label>
              <textarea id="wsField_voice" class="onboarding-input" style="padding: 10px 12px; min-height: 70px; resize: vertical;"></textarea>
            </div>
            <div class="onboarding-input-group" style="margin: 0;">
              <label class="onboarding-label" style="font-size: var(--text-sm);"><span style="color: var(--accent);">\u25C7</span> Target Audience</label>
              <textarea id="wsField_audience" class="onboarding-input" style="padding: 10px 12px; min-height: 70px; resize: vertical;"></textarea>
            </div>
            <div class="onboarding-input-group" style="margin: 0;">
              <label class="onboarding-label" style="font-size: var(--text-sm);"><span style="color: var(--accent);">\u25C6</span> Key Messaging</label>
              <textarea id="wsField_messaging" class="onboarding-input" style="padding: 10px 12px; min-height: 70px; resize: vertical;"></textarea>
            </div>
            <div class="onboarding-input-group" style="margin: 0;">
              <label class="onboarding-label" style="font-size: var(--text-sm);"><span style="color: var(--accent);">\u25A3</span> Products & Services</label>
              <textarea id="wsField_products" class="onboarding-input" style="padding: 10px 12px; min-height: 70px; resize: vertical;"></textarea>
            </div>
            <div class="onboarding-input-group" style="margin: 0;">
              <label class="onboarding-label" style="font-size: var(--text-sm);"><span style="color: var(--accent);">\u2727</span> Visual Identity</label>
              <textarea id="wsField_visual" class="onboarding-input" style="padding: 10px 12px; min-height: 70px; resize: vertical;"></textarea>
            </div>
            <div class="onboarding-input-group" style="margin: 0;">
              <label class="onboarding-label" style="font-size: var(--text-sm);"><span style="color: var(--accent);">\u2B21</span> Competitive Positioning</label>
              <textarea id="wsField_competitive" class="onboarding-input" style="padding: 10px 12px; min-height: 70px; resize: vertical;"></textarea>
            </div>
          </div>
        </div>

        <div class="onboarding-actions">
          <button class="onboarding-btn onboarding-btn-secondary" onclick="goToOnboardingStep('provider')">Back</button>
          <button class="onboarding-btn onboarding-btn-primary" id="wsReviewContinueBtn" onclick="saveWebSearchResults()" style="display: none;">Save & Continue</button>
        </div>
      </div>
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS/RoweOS/dist
git add index.html
git commit -m "feat: add HTML for web search floating indicator and takeover view"
```

---

### Task 6: Wire Up Onboarding Flow

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` (~158832 area, near parseWebsiteForBrand)

- [ ] **Step 1: Add the `saveWebsiteUrlAndContinue` function**

Find the existing `parseWebsiteForBrand()` function (~line 158832). Insert BEFORE it:

```javascript
// v26.5: Save website URL and continue to API key step (crawl starts after key validation)
function saveWebsiteUrlAndContinue() {
  var urlInput = document.getElementById('websiteImportUrl');
  if (!urlInput) return;
  var url = urlInput.value.trim();
  if (!url) {
    showToast('Please enter a website URL', 'warning');
    return;
  }
  // Basic validation
  if (url.indexOf('.') === -1) {
    showToast('Please enter a valid domain', 'warning');
    return;
  }
  // Normalize
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  // Store for later use
  window._pendingWebSearchUrl = url;
  localStorage.setItem('roweos_pending_web_search_url', url);
  // Continue to provider/API key step
  goToOnboardingStep('provider');
}
```

- [ ] **Step 2: Add the function that starts crawl after API key validation**

Insert after `saveWebsiteUrlAndContinue`:

```javascript
// v26.5: Start web search after API key is validated
function startOnboardingWebSearch() {
  var url = window._pendingWebSearchUrl || localStorage.getItem('roweos_pending_web_search_url');
  if (!url) return; // Manual setup, no URL

  var provider = localStorage.getItem('roweos_provider') || 'anthropic';
  var apiKey = '';
  var model = '';
  if (provider === 'anthropic') {
    apiKey = localStorage.getItem('roweos_anthropic_key') || '';
    model = localStorage.getItem('roweos_anthropic_model') || 'claude-sonnet-4-6-20250514';
  } else if (provider === 'openai') {
    apiKey = localStorage.getItem('roweos_openai_key') || '';
    model = localStorage.getItem('roweos_openai_model') || 'gpt-5.4';
  } else if (provider === 'google') {
    apiKey = localStorage.getItem('roweos_gemini_key') || '';
    model = localStorage.getItem('roweos_gemini_model') || 'gemini-2.5-flash';
  }

  if (!apiKey) {
    console.warn('[WebSearch] No API key found, skipping web search');
    return;
  }

  var brandName = localStorage.getItem('roweos_brand_name') || document.getElementById('onb_brandName')?.value || 'Brand';
  var isLife = document.documentElement.classList.contains('life-mode');

  startWebSearch(url, provider, apiKey, model, brandName, isLife ? 'life' : 'brand', {
    onProgress: function(state, msg) {
      renderFloatingIndicator(state);
      console.log('[WebSearch]', msg);
    },
    onComplete: function(results) {
      renderFloatingIndicator(_webSearchState);
      console.log('[WebSearch] Complete:', results);
      // If user is already on the review step, show results
      var reviewStep = document.getElementById('onboardingWebSearchReview');
      if (reviewStep && reviewStep.style.display !== 'none') {
        _showWebSearchResults();
      }
    },
    onError: function(err) {
      renderFloatingIndicator(_webSearchState);
      console.error('[WebSearch] Error:', err);
      showToast('Web search encountered an issue. You can fill in details manually.', 'warning');
    }
  });
}
```

- [ ] **Step 3: Add the review step display function**

```javascript
// v26.5: Show web search results on the review step
function _showWebSearchResults() {
  var state = getWebSearchState();
  var takeover = document.getElementById('webSearchTakeover');
  var canvas = document.getElementById('wsGraphCanvas');
  var cardsContainer = document.getElementById('wsCardsContainer');
  var subtitle = document.getElementById('wsReviewSubtitle');
  var completionMsg = document.getElementById('wsCompletionMsg');
  var editFields = document.getElementById('wsEditableFields');
  var continueBtn = document.getElementById('wsReviewContinueBtn');

  if (takeover) takeover.classList.add('active');
  if (canvas) renderNetworkGraph(canvas, state);
  if (cardsContainer) renderIdentityCards(cardsContainer, state);

  if (state.status === 'complete' && state.finalResults) {
    if (subtitle) subtitle.textContent = 'We found your brand identity. Review and edit below.';
    if (completionMsg) completionMsg.classList.add('visible');
    if (continueBtn) continueBtn.style.display = '';

    // Populate editable fields
    var sections = state.mode === 'brand'
      ? ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive']
      : ['role', 'skills', 'communication', 'interests', 'goals', 'routine', 'personality'];
    for (var i = 0; i < sections.length; i++) {
      var field = document.getElementById('wsField_' + sections[i]);
      if (field && state.finalResults[sections[i]]) {
        field.value = state.finalResults[sections[i]];
      }
    }
    if (editFields) editFields.style.display = '';

    // Hide takeover after a moment
    setTimeout(function() {
      if (takeover) takeover.classList.remove('active');
      stopNetworkGraph();
    }, 2000);
  } else if (state.status === 'error') {
    if (subtitle) subtitle.textContent = 'We had trouble analyzing the website. You can fill in the details manually.';
    if (editFields) editFields.style.display = '';
    if (continueBtn) continueBtn.style.display = '';
  } else {
    // Still in progress -- show visualization and update periodically
    if (subtitle) subtitle.textContent = 'Analyzing your website and the web...';
    var checkInterval = setInterval(function() {
      var s = getWebSearchState();
      if (cardsContainer) renderIdentityCards(cardsContainer, s);
      if (canvas) renderNetworkGraph(canvas, s);
      if (s.status === 'complete' || s.status === 'error') {
        clearInterval(checkInterval);
        _showWebSearchResults(); // Re-call to show final state
      }
    }, 1000);
  }
}
```

- [ ] **Step 4: Add the save function that writes results to Identity**

```javascript
// v26.5: Save web search results to brand identity
function saveWebSearchResults() {
  var state = getWebSearchState();
  var isBrand = state.mode === 'brand';

  if (isBrand) {
    var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
    var brands = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]');
    var brandIdx = parseInt(localStorage.getItem('roweos_selected_brand') || '0');
    var brand = brands[brandIdx];
    if (!brand) {
      showToast('No brand found to save to', 'error');
      return;
    }
    if (!brand.identityData) brand.identityData = {};
    for (var i = 0; i < sections.length; i++) {
      var field = document.getElementById('wsField_' + sections[i]);
      var value = field ? field.value : (state.finalResults && state.finalResults[sections[i]] || '');
      if (value) {
        if (!brand.identityData[sections[i]]) brand.identityData[sections[i]] = {};
        brand.identityData[sections[i]].ai = value;
      }
    }
    brands[brandIdx] = brand;
    localStorage.setItem('roweos_user_brands', JSON.stringify(brands));
    if (typeof saveBrands === 'function') saveBrands();
    if (typeof queueBackgroundSync === 'function') queueBackgroundSync();
  } else {
    // LifeAI: save to life profile
    var profiles = typeof getLifeProfiles === 'function' ? getLifeProfiles() : [];
    var profileIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
    var profile = profiles[profileIdx];
    if (profile && state.finalResults) {
      if (!profile.identityData) profile.identityData = {};
      if (state.finalResults.role) {
        if (!profile.identityData.work) profile.identityData.work = [];
        profile.identityData.work.push({ type: 'role', value: state.finalResults.role, source: 'web-import', addedAt: new Date().toISOString() });
      }
      if (state.finalResults.skills) {
        if (!profile.identityData.work) profile.identityData.work = [];
        profile.identityData.work.push({ type: 'skills', value: state.finalResults.skills, source: 'web-import', addedAt: new Date().toISOString() });
      }
      if (state.finalResults.communication) {
        if (!profile.preferences) profile.preferences = {};
        profile.preferences.communicationStyle = state.finalResults.communication;
      }
      if (state.finalResults.interests) {
        if (!profile.identityData.personal) profile.identityData.personal = [];
        profile.identityData.personal.push({ type: 'interests', value: state.finalResults.interests, source: 'web-import', addedAt: new Date().toISOString() });
      }
      if (state.finalResults.personality) {
        if (!profile.identityData.personal) profile.identityData.personal = [];
        profile.identityData.personal.push({ type: 'trait', value: state.finalResults.personality, source: 'web-import', addedAt: new Date().toISOString() });
      }
      if (state.finalResults.goals) profile.aboutMe = (profile.aboutMe || '') + '\n\nGoals: ' + state.finalResults.goals;
      if (typeof saveLifeProfiles === 'function') saveLifeProfiles(profiles);
    }
  }

  // Clean up
  window._pendingWebSearchUrl = null;
  localStorage.removeItem('roweos_pending_web_search_url');
  stopNetworkGraph();
  showToast('Brand identity saved!', 'success');

  // Continue onboarding
  goToOnboardingStep(7);
}
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS/RoweOS/dist
git add index.html
git commit -m "feat: wire up onboarding flow to advanced web search pipeline"
```

---

### Task 7: Hook Into Onboarding Navigation

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` (~138245 -- `goToOnboardingStep`)

- [ ] **Step 1: Add 'websearch-review' step to `goToOnboardingStep`**

Find the `goToOnboardingStep` function (~line 138245). In the section where step IDs are mapped (after the existing step name mappings), add handling for the new review step. Find where the function hides all steps and add `'onboardingWebSearchReview'` to the list of step IDs that get hidden.

Then add a step name mapping:

```javascript
// Inside goToOnboardingStep, in the step name mapping section:
if (step === 'websearch-review') {
  document.getElementById('onboardingWebSearchReview').style.display = '';
  _showWebSearchResults();
  return;
}
```

- [ ] **Step 2: Trigger web search start after provider step completes**

Find the existing function that handles the "Continue" action on the provider/API key step. This is typically where the provider step validates the API key and moves to the next step. After the API key is validated and saved, add:

```javascript
// After API key is validated and saved:
if (typeof startOnboardingWebSearch === 'function') startOnboardingWebSearch();
```

Also, when the onboarding flow reaches the brand setup area (after integrations etc.), check if web search was active and redirect to the review step:

Find where the flow navigates to `onboardingStep7` (the brand basics step). Before showing that step, add:

```javascript
// Before showing step 7 (brand basics), check if web search is active
var wsState = typeof getWebSearchState === 'function' ? getWebSearchState() : null;
if (wsState && wsState.status !== 'idle' && window._pendingWebSearchUrl) {
  goToOnboardingStep('websearch-review');
  return;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS/RoweOS/dist
git add index.html
git commit -m "feat: integrate web search into onboarding navigation flow"
```

---

### Task 8: Add LifeAI Onboarding Fork

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` (~48048-48225, LifeAI onboarding modal)

- [ ] **Step 1: Add website import option to LifeAI onboarding**

Find the LifeAI onboarding modal content. Before the existing Step 1 (life areas selection, ~line 49929), insert a new pre-step:

```html
<!-- v26.5: LifeAI website import fork -->
<div class="life-onboarding-step" id="lifeOnbStep0" style="display: none;">
  <h3 style="font-size: var(--text-lg); font-weight: 600; margin-bottom: 8px;">How would you like to set up?</h3>
  <p style="color: var(--text-secondary); margin-bottom: 20px;">We can import your identity from your website or portfolio, or you can set up manually.</p>
  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
    <button type="button" class="onboarding-choice-btn" onclick="showLifeWebImport()" style="padding: 20px 16px; background: rgba(168, 152, 120, 0.08); border: 1px solid rgba(168, 152, 120, 0.2); border-radius: var(--radius-lg); cursor: pointer; text-align: center;">
      <svg style="width: 24px; height: 24px; margin: 0 auto 8px; display: block; color: var(--accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      <div style="font-weight: 600; margin-bottom: 4px;">Import from Website</div>
      <div style="color: var(--text-muted); font-size: var(--text-sm);">Portfolio, LinkedIn, personal site</div>
    </button>
    <button type="button" class="onboarding-choice-btn" onclick="skipLifeWebImport()" style="padding: 20px 16px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-lg); cursor: pointer; text-align: center;">
      <svg style="width: 24px; height: 24px; margin: 0 auto 8px; display: block; color: var(--accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      <div style="font-weight: 600; margin-bottom: 4px;">Manual Setup</div>
      <div style="color: var(--text-muted); font-size: var(--text-sm);">Fill in your details yourself</div>
    </button>
  </div>
</div>

<!-- v26.5: LifeAI website URL input -->
<div class="life-onboarding-step" id="lifeOnbWebImport" style="display: none;">
  <h3 style="font-size: var(--text-lg); font-weight: 600; margin-bottom: 8px;">Your Website or Portfolio</h3>
  <p style="color: var(--text-secondary); margin-bottom: 16px;">We'll extract your identity while you continue setup.</p>
  <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px;">
    <span style="color: var(--text-muted); flex-shrink: 0;">https://</span>
    <input type="text" id="lifeWebImportUrl" class="onboarding-input" placeholder="yourname.com" style="padding: 12px; width: 100%; box-sizing: border-box;" />
  </div>
  <button class="onboarding-btn onboarding-btn-primary" onclick="saveLifeWebUrlAndContinue()" style="width: 100%;">Continue</button>
</div>
```

- [ ] **Step 2: Add the LifeAI web import handler functions**

Insert near the existing LifeAI onboarding functions:

```javascript
// v26.5: LifeAI web import handlers
function showLifeWebImport() {
  var steps = document.querySelectorAll('.life-onboarding-step');
  steps.forEach(function(s) { s.style.display = 'none'; });
  var el = document.getElementById('lifeOnbWebImport');
  if (el) el.style.display = '';
}

function skipLifeWebImport() {
  window._pendingWebSearchUrl = null;
  localStorage.removeItem('roweos_pending_web_search_url');
  // Go to normal step 1
  nextLifeOnboardingStep();
}

function saveLifeWebUrlAndContinue() {
  var urlInput = document.getElementById('lifeWebImportUrl');
  if (!urlInput) return;
  var url = urlInput.value.trim();
  if (!url) { showToast('Please enter a URL', 'warning'); return; }
  if (url.indexOf('.') === -1) { showToast('Please enter a valid domain', 'warning'); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  window._pendingWebSearchUrl = url;
  localStorage.setItem('roweos_pending_web_search_url', url);
  // Continue to normal LifeAI steps -- crawl starts after they enter API key
  nextLifeOnboardingStep();
}
```

- [ ] **Step 3: Update LifeAI onboarding init to show Step 0 first**

Find the function that opens/shows the LifeAI onboarding modal. When it first opens, show `lifeOnbStep0` instead of the previous first step:

```javascript
// In the LifeAI modal open function, show step 0 first:
var step0 = document.getElementById('lifeOnbStep0');
if (step0) step0.style.display = '';
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS/RoweOS/dist
git add index.html
git commit -m "feat: add website import fork to LifeAI onboarding"
```

---

### Task 9: Integration Testing & Deploy

**Files:**
- All modified files

- [ ] **Step 1: Test BrandAI flow end-to-end**

1. Clear localStorage (`localStorage.clear()` in console)
2. Refresh the app, trigger onboarding
3. Choose "Business" (BrandAI)
4. Enter a name and brand name
5. Choose "Analyze Website"
6. Enter a real URL (e.g., `stripe.com` -- no https:// prefix)
7. Click Continue
8. Enter API key for any provider
9. Verify floating indicator appears and shows scanning progress
10. Continue through remaining onboarding steps
11. Verify the web search review step appears with network graph + cards
12. Verify fields are pre-filled
13. Click "Save & Continue"
14. Go to Identity section -- verify data is saved

- [ ] **Step 2: Test LifeAI flow end-to-end**

1. Switch to LifeAI mode or create new life profile
2. Verify Step 0 fork appears ("Import from Website" / "Manual Setup")
3. Choose Import, enter a personal website URL
4. Continue through LifeAI steps
5. Verify crawl runs in background with floating indicator

- [ ] **Step 3: Test error handling**

1. Enter an invalid URL (e.g., "notasite") -- verify inline error
2. Enter a URL that will fail (e.g., "thissitedoesnotexist12345.com") -- verify graceful fallback
3. Cancel mid-crawl by going back -- verify no stuck state

- [ ] **Step 4: Test Manual Setup path**

1. Choose "Create Manually" -- verify no crawl starts
2. Verify normal onboarding flow works unchanged
3. No floating indicator should appear

- [ ] **Step 5: Deploy to production**

```bash
cd /Volumes/roweOS/RoweOS/dist
vercel --prod --yes
```

- [ ] **Step 6: Commit final state**

```bash
cd /Volumes/roweOS/RoweOS/dist
git add -A
git commit -m "feat: complete advanced web search onboarding integration"
```
