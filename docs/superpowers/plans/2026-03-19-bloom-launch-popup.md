# Bloom Launch Popup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "What do you want to see?" modal on Bloom launch that drives custom AI-generated content batches based on the user's selection of content type and topic.

**Architecture:** Intercept `renderBloom()` to check launch preference before rendering the feed. If "ask each time" or first launch, show a modal with content type cards (Text, Info Graphics, Videos), optional topic input with suggested topics, and preference save option. Selection calls `bloomGenerateWithDirective()` which passes the content type and topic into `generateBloomBatch()` as a directive that shapes the AI prompt.

**Tech Stack:** Vanilla ES5 JavaScript, single-file HTML app (`RoweOS/dist/index.html`)

**Spec:** `/Volumes/roweOS/docs/superpowers/specs/2026-03-19-bloom-launch-popup-spec.md`

**Critical Constraints:**
- ES5 only (no arrow functions, let/const, template literals)
- All edits in `/Volumes/roweOS/RoweOS/dist/index.html`
- No emojis in UI -- SVG icons only
- No em-dashes in UI text

---

## File Structure

All changes in one file:
- **Modify:** `/Volumes/roweOS/RoweOS/dist/index.html`

Key locations:
| Function/Area | Approx Line | Purpose |
|---------------|-------------|---------|
| `renderBloom()` | 92667 | Entry point -- add modal check |
| `generateBloomBatch()` | 93155 | Accept directive parameter |
| `generateSingleBloomPost()` | 93445 | Inject directive into AI prompt |
| Bloom CSS section | ~29000-30000 area | Add modal CSS |

---

### Task 1: Add Bloom Launch Modal HTML + CSS

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- CSS section + near Bloom HTML

- [ ] **Step 1: Find the Bloom CSS section**

Search for `.bloom-feed` or `.bloom-card` in the CSS. Add the modal styles nearby.

- [ ] **Step 2: Add modal CSS**

Insert these styles near the existing Bloom CSS:

```css
/* v25.2: Bloom Launch Modal */
.bloom-launch-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; opacity: 0; transition: opacity 0.2s ease;
}
.bloom-launch-overlay.visible { opacity: 1; }
.bloom-launch-modal {
  background: var(--bg-primary, #111); border: 1px solid var(--border-color, #2a2a2a);
  border-radius: 16px; padding: 28px 24px; width: 90%; max-width: 480px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
.bloom-launch-title {
  font-size: 20px; font-weight: 600; color: var(--text-primary, #f4f4f5);
  margin-bottom: 4px;
}
.bloom-launch-subtitle {
  font-size: 13px; color: var(--text-tertiary, #666); margin-bottom: 20px;
}
.bloom-launch-types {
  display: flex; gap: 10px; margin-bottom: 20px;
}
.bloom-launch-type-card {
  flex: 1; padding: 16px 12px; border: 1px solid var(--border-color, #2a2a2a);
  border-radius: 12px; text-align: center; cursor: pointer;
  background: var(--bg-secondary, #1a1a1a); transition: all 0.15s ease;
}
.bloom-launch-type-card:hover { border-color: var(--accent, #a89878); }
.bloom-launch-type-card.selected {
  border-color: var(--accent, #a89878); background: rgba(168,152,120,0.1);
}
.bloom-launch-type-card svg { width: 28px; height: 28px; margin-bottom: 8px; stroke: var(--text-secondary, #999); }
.bloom-launch-type-card.selected svg { stroke: var(--accent, #a89878); }
.bloom-launch-type-label {
  font-size: 13px; font-weight: 500; color: var(--text-secondary, #999);
}
.bloom-launch-type-card.selected .bloom-launch-type-label { color: var(--accent, #a89878); }
.bloom-launch-topic-input {
  width: 100%; padding: 10px 14px; background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border-color, #2a2a2a); border-radius: 10px;
  color: var(--text-primary, #f4f4f5); font-size: 14px; box-sizing: border-box;
  margin-bottom: 12px;
}
.bloom-launch-topic-input:focus { border-color: var(--accent, #a89878); outline: none; }
.bloom-launch-suggestions {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px;
}
.bloom-launch-suggestion {
  padding: 4px 12px; font-size: 11px; border-radius: 16px;
  border: 1px solid var(--border-color, #2a2a2a); color: var(--text-secondary, #999);
  cursor: pointer; background: transparent; transition: all 0.15s ease;
}
.bloom-launch-suggestion:hover {
  border-color: var(--accent, #a89878); color: var(--accent, #a89878);
}
.bloom-launch-pref {
  display: flex; gap: 16px; margin-bottom: 20px; font-size: 12px;
  color: var(--text-tertiary, #666);
}
.bloom-launch-pref label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.bloom-launch-pref input[type="radio"] { accent-color: var(--accent, #a89878); }
.bloom-launch-generate {
  width: 100%; padding: 12px; background: var(--accent, #a89878); color: #000;
  border: none; border-radius: 10px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: opacity 0.15s ease;
}
.bloom-launch-generate:hover { opacity: 0.85; }
.bloom-launch-generate:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(bloom): add launch modal CSS v25.2"
```

---

### Task 2: Create `showBloomLaunchModal()` Function

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- near `renderBloom()` (~line 92667)

- [ ] **Step 1: Find insertion point**

Search for `function renderBloom()`. Insert the new functions BEFORE it.

- [ ] **Step 2: Add the modal functions**

```javascript
// v25.2: Bloom Launch Modal
var _bloomLaunchType = null; // 'text', 'infographics', 'videos'

function showBloomLaunchModal() {
  // Build suggested topics from brand identity, Pulse goals, recent chats
  var suggestions = [];
  var brand = brands[selectedBrand || 0];
  if (brand) {
    // Brand identity keywords
    if (brand.keywords) {
      var kw = typeof brand.keywords === 'string' ? brand.keywords.split(',') : (brand.keywords || []);
      for (var ki = 0; ki < Math.min(kw.length, 2); ki++) {
        var trimmed = kw[ki].trim();
        if (trimmed) suggestions.push(trimmed);
      }
    }
    if (brand.industry) suggestions.push(brand.industry);
  }
  // Pulse goal names
  try {
    var goals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    for (var gi = 0; gi < Math.min(goals.length, 2); gi++) {
      if (goals[gi].name) suggestions.push(goals[gi].name);
    }
  } catch(e) {}
  // Cap at 6
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
  overlay.innerHTML = '<div class="bloom-launch-modal">'
    + '<div class="bloom-launch-title">What would you like to explore?</div>'
    + '<div class="bloom-launch-subtitle">Choose a content type and optional topic to generate your feed.</div>'
    + '<div class="bloom-launch-types">'
    + '<div class="bloom-launch-type-card" data-type="text" onclick="selectBloomLaunchType(this)">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M4 6h16M4 10h16M4 14h10M4 18h7"/></svg>'
    + '<div class="bloom-launch-type-label">Text</div></div>'
    + '<div class="bloom-launch-type-card" data-type="infographics" onclick="selectBloomLaunchType(this)">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>'
    + '<div class="bloom-launch-type-label">Info Graphics</div></div>'
    + '<div class="bloom-launch-type-card" data-type="videos" onclick="selectBloomLaunchType(this)">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>'
    + '<div class="bloom-launch-type-label">Videos</div></div>'
    + '</div>'
    + '<input type="text" id="bloomLaunchTopic" class="bloom-launch-topic-input" placeholder="Enter a topic or leave blank for general">'
    + suggestionsHtml
    + '<div class="bloom-launch-pref">'
    + '<label><input type="radio" name="bloomLaunchPref" value="ask" checked> Ask me each time</label>'
    + '<label><input type="radio" name="bloomLaunchPref" value="remember"> Remember my choice</label>'
    + '</div>'
    + '<button class="bloom-launch-generate" id="bloomLaunchBtn" disabled onclick="bloomSubmitLaunchChoice()">Generate Feed</button>'
    + '</div>';

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeBloomLaunchModal();
  });
  document.body.appendChild(overlay);
  // Animate in
  requestAnimationFrame(function() { overlay.classList.add('visible'); });
  _bloomLaunchType = null;
}

function selectBloomLaunchType(el) {
  // Deselect siblings
  var cards = el.parentNode.querySelectorAll('.bloom-launch-type-card');
  for (var i = 0; i < cards.length; i++) cards[i].classList.remove('selected');
  el.classList.add('selected');
  _bloomLaunchType = el.getAttribute('data-type');
  var btn = document.getElementById('bloomLaunchBtn');
  if (btn) btn.disabled = false;
}

function closeBloomLaunchModal() {
  var overlay = document.getElementById('bloomLaunchOverlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
  }
}

function bloomSubmitLaunchChoice() {
  if (!_bloomLaunchType) return;
  var topic = '';
  var topicEl = document.getElementById('bloomLaunchTopic');
  if (topicEl) topic = topicEl.value.trim();

  // Save preference
  var prefRadios = document.querySelectorAll('input[name="bloomLaunchPref"]');
  var pref = 'ask';
  for (var i = 0; i < prefRadios.length; i++) {
    if (prefRadios[i].checked) { pref = prefRadios[i].value; break; }
  }
  localStorage.setItem('roweos_bloom_launch_pref', pref);
  if (pref === 'remember') {
    localStorage.setItem('roweos_bloom_launch_type', _bloomLaunchType);
    localStorage.setItem('roweos_bloom_launch_topic', topic);
  }

  closeBloomLaunchModal();
  bloomGenerateWithDirective(_bloomLaunchType, topic);
}

function bloomGenerateWithDirective(contentType, topic) {
  // Store directive globally so generateBloomBatch can use it
  window._bloomDirective = { type: contentType, topic: topic };
  // Clear existing posts and generate fresh batch
  _bloomPosts = [];
  var feedContainer = document.getElementById('bloomFeed');
  if (feedContainer) feedContainer.innerHTML = '';
  generateBloomBatch(20);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(bloom): add launch modal functions (show, select, submit, generate) v25.2"
```

---

### Task 3: Intercept `renderBloom()` to Show Modal

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:92667`

- [ ] **Step 1: Find `function renderBloom()`**

Search for `function renderBloom()` at approximately line 92667.

- [ ] **Step 2: Add modal check at the start of the function**

After the existing `renderBloom._defaultApplied` block (after line ~92681), add:

```javascript
  // v25.2: Bloom Launch Modal -- show on first render if pref is "ask" or not set
  if (!renderBloom._launchChecked) {
    renderBloom._launchChecked = true;
    var launchPref = localStorage.getItem('roweos_bloom_launch_pref') || 'ask';
    if (launchPref === 'ask') {
      showBloomLaunchModal();
      return; // Don't render feed yet -- modal will trigger generation
    } else if (launchPref === 'remember') {
      var savedType = localStorage.getItem('roweos_bloom_launch_type');
      var savedTopic = localStorage.getItem('roweos_bloom_launch_topic') || '';
      if (savedType) {
        bloomGenerateWithDirective(savedType, savedTopic);
        return; // Directive will generate and re-render
      }
    }
  }
```

- [ ] **Step 3: Add "Change preferences" link to Bloom header**

Find where the Bloom header is rendered (search for `bloomBrandSelect` or the Bloom title area). Add a small link:

Search for the Bloom header HTML that contains the brand selector. After the selector, add:

```javascript
// Add after brand selector in bloom header rendering
var changePrefHtml = '<button onclick="renderBloom._launchChecked=false;showBloomLaunchModal()" style="background:none;border:none;color:var(--text-tertiary);font-size:11px;cursor:pointer;padding:4px 8px;">Change feed type</button>';
```

Insert this into the Bloom header near the brand selector.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(bloom): intercept renderBloom with launch modal check v25.2"
```

---

### Task 4: Modify `generateBloomBatch()` and `generateSingleBloomPost()` to Accept Directive

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:93155` and `93445`

- [ ] **Step 1: Modify `generateBloomBatch()` to use directive**

Find `async function generateBloomBatch(count)` (~line 93155). After the brand resolution block (after line ~93179), add directive-aware content mode override:

```javascript
  // v25.2: Apply launch directive if set
  var directive = window._bloomDirective || null;
  if (directive) {
    // Override content mode based on directive type
    if (directive.type === 'text') _bloomContentMode = 'text_only';
    else if (directive.type === 'videos') _bloomContentMode = 'video_text';
    else if (directive.type === 'infographics') _bloomContentMode = 'images_text';
  }
```

- [ ] **Step 2: Modify `generateSingleBloomPost()` to inject directive into prompt**

Find `async function generateSingleBloomPost(` (~line 93445). After the `var userPrompt = typePrompts[postType]` line (~line 93467), add:

```javascript
  // v25.2: Inject launch directive into prompt
  var directive = window._bloomDirective || null;
  if (directive) {
    if (directive.topic) {
      userPrompt = userPrompt.replace(op.name, directive.topic + ' (specifically: ' + op.name + ')');
    }
    if (directive.type === 'infographics') {
      userPrompt += ' FORMAT as an info graphic layout: use numbered points, clear data labels, and visual hierarchy suitable for a designed infographic.';
    } else if (directive.type === 'videos') {
      userPrompt += ' FORMAT as a video script: include a hook (first 3 seconds), key talking points, visual cues, and a call-to-action.';
    }
  }
```

- [ ] **Step 3: Clear directive after batch generation completes**

Find the end of `generateBloomBatch()` where `_bloomGenerating = false` is set. Add:

```javascript
  // v25.2: Clear directive after generation
  window._bloomDirective = null;
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(bloom): generateBloomBatch and generateSingleBloomPost accept launch directive v25.2"
```

---

### Task 5: Test and Deploy

- [ ] **Step 1: Test the modal flow**

Open RoweOS in browser. Navigate to Bloom. Verify:
- Modal appears on first Bloom load
- Three content type cards are clickable (only one selected at a time)
- Generate button is disabled until a type is selected
- Suggested topics appear (from brand keywords / Pulse goals)
- Clicking a suggestion fills the topic input
- "Ask me each time" / "Remember" radio buttons work
- Generate button triggers feed generation
- Modal closes and feed renders

- [ ] **Step 2: Test "Remember" preference**

1. Select a type + topic, choose "Remember my choice", click Generate
2. Navigate away from Bloom, then back
3. Verify: modal does NOT appear, feed generates with saved type/topic
4. Click "Change feed type" link in header
5. Verify: modal re-appears

- [ ] **Step 3: Test directive injection**

1. Select "Info Graphics" + topic "Investor Outreach"
2. Check generated posts -- they should reference investor outreach and have infographic-style formatting
3. Select "Videos" -- posts should have video script format

- [ ] **Step 4: Deploy**

```bash
cd /Volumes/roweOS && bash deploy.sh
```

- [ ] **Step 5: Final commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(bloom): Bloom Launch Popup complete -- content type + topic directive v25.2

Adds a 'What do you want to explore?' modal on Bloom launch with
content type selection (Text, Info Graphics, Videos), optional topic
input with suggested topics, and preference save. Selection generates
a custom 20-post batch tailored to the choice.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
