# Scribe Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four enhancements to the Scribe notebook system: (A) @-mention autocomplete for People + Library inline in TinyMCE, (B) wire up the Knowledge mode AI panel with proper streaming UI, (C) People view backlinks showing which notebooks reference a person, (D) Library "Link to Scribe" action to connect library files to notebooks.

**Architecture:** Scribe lives in `src/js/core/33-scribe.js` (1207 lines) with HTML in `src/html/shared/30-scribe.html`. TinyMCE 6 is the rich-text editor. Knowledge mode AI already has `askScribeQuestion()` and `synthesizeScribeNotebook()` wired to `callAnthropicStreaming()` but the thread UI needs markdown rendering and loading states. People are stored via `getPeople()` in `src/js/core/29-analytics-commerce.js`. Library files come from `getLibraryForBrandIndex()` in `src/js/core/12-library.js`. Notebooks store `linkedPeople` and `linkedLibraryItems` arrays.

**Tech Stack:** Vanilla ES5 JavaScript, TinyMCE 6 API, single-file HTML app (modular source in `src/`)

**Critical Constraints:**
- ES5 only (no arrow functions, let/const, template literals)
- Edit `src/` files only, then `bash src/build.sh` to regenerate dist
- No emojis in UI - SVG icons only
- No em-dashes in UI text
- No one-sided borders for accents/highlights

---

## File Structure

| File | Purpose |
|------|---------|
| `src/js/core/33-scribe.js` | Scribe notebook system (all four features) |
| `src/html/shared/30-scribe.html` | Scribe view HTML template |
| `src/css/core/01-base.css` | CSS for mention dropdown, knowledge thread, backlinks |
| `src/js/core/29-analytics-commerce.js` | People detail view (backlinks section) |
| `src/js/core/12-library.js` | Library file actions (Link to Scribe button) |

Key existing functions:
| Function | File | Line | Purpose |
|----------|------|------|---------|
| `initScribeTinymce()` | 33-scribe.js | 90 | TinyMCE init with setup callback |
| `askScribeQuestion()` | 33-scribe.js | 827 | Knowledge Q&A with streaming |
| `synthesizeScribeNotebook()` | 33-scribe.js | 913 | AI summary of notebook |
| `renderScribeKnowledgeThread()` | 33-scribe.js | 975 | Render knowledge thread messages |
| `_getActiveScribeNotebook()` | 33-scribe.js | 1180 | Get current notebook |
| `getPeople()` | 29-analytics-commerce.js | 4894 | Get all people (optional type filter) |
| `getLibraryForBrandIndex()` | 12-library.js | 1158 | Get library files for a brand |
| `linkScribePerson()` | 33-scribe.js | 1028 | Current prompt-based person linking |
| `linkScribeLibraryItem()` | 33-scribe.js | 1041 | Current prompt-based library linking |

---

### Task 1: @-Mention Autocomplete CSS

**Files:**
- Modify: `src/css/core/01-base.css`

- [ ] **Step 1: Add CSS for the @-mention dropdown overlay**

Find the Scribe CSS section (search for `.scribe-` CSS rules). Add at the end of that section:

```css
/* v29.3: @-mention autocomplete dropdown */
.scribe-mention-dropdown {
  position: absolute;
  z-index: 100001;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  max-height: 240px;
  overflow-y: auto;
  min-width: 220px;
  max-width: 320px;
  padding: 4px;
  display: none;
}
.scribe-mention-dropdown.visible { display: block; }
.scribe-mention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.1s;
}
.scribe-mention-item:hover,
.scribe-mention-item.selected {
  background: var(--bg-tertiary);
}
.scribe-mention-item-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(168,152,120,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--brand-accent, #a89878);
}
.scribe-mention-item-info { flex: 1; min-width: 0; }
.scribe-mention-item-name {
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scribe-mention-item-type {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.scribe-mention-tag {
  color: var(--brand-accent, #a89878);
  text-decoration: underline;
  text-decoration-color: rgba(168,152,120,0.4);
  text-underline-offset: 2px;
  cursor: pointer;
}
/* v29.3: Knowledge thread markdown rendering */
.scribe-km-content p { margin: 0 0 8px 0; }
.scribe-km-content p:last-child { margin-bottom: 0; }
.scribe-km-content ul, .scribe-km-content ol { margin: 4px 0 8px 20px; padding: 0; }
.scribe-km-content li { margin-bottom: 2px; font-size: 13px; }
.scribe-km-content code {
  background: rgba(168,152,120,0.12);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}
.scribe-km-content pre {
  background: rgba(0,0,0,0.2);
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 6px 0;
}
.scribe-km-content pre code { background: none; padding: 0; }
.scribe-km-content strong { font-weight: 700; }
.scribe-km-content h1, .scribe-km-content h2, .scribe-km-content h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 8px 0 4px 0;
}
.scribe-km-loading {
  display: inline-block;
  width: 6px;
  height: 14px;
  background: var(--brand-accent, #a89878);
  animation: scribe-blink 0.8s steps(1) infinite;
  margin-left: 2px;
  vertical-align: text-bottom;
  border-radius: 1px;
}
@keyframes scribe-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

- [ ] **Step 2: Verify and commit**

```
Verification: Open Scribe in browser, inspect CSS classes are available.
```

```bash
cd ~/Developer/roweOS && bash src/build.sh && git add src/css/core/01-base.css && git commit -m "feat(scribe): add @-mention dropdown and knowledge thread CSS v29.3"
```

---

### Task 2: @-Mention Autocomplete in TinyMCE

**Files:**
- Modify: `src/js/core/33-scribe.js`

- [ ] **Step 1: Add the mention dropdown element and data-fetching logic**

Find the `// === HELPERS ===` comment near line 1178 of `33-scribe.js`. Insert BEFORE it:

```javascript
// === @-MENTION AUTOCOMPLETE === // v29.3:

var _scribeMentionDropdown = null; // v29.3: DOM element
var _scribeMentionQuery = ''; // v29.3: current search text after @
var _scribeMentionItems = []; // v29.3: current filtered results
var _scribeMentionIdx = 0; // v29.3: keyboard selection index
var _scribeMentionActive = false; // v29.3: is dropdown open
var _scribeMentionRange = null; // v29.3: TinyMCE range where @ was typed

function _getScribeMentionCandidates() { // v29.3:
  var candidates = [];
  // People
  if (typeof getPeople === 'function') {
    var people = getPeople();
    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      if (!p.name) continue;
      candidates.push({
        type: 'person',
        id: p.id || '',
        name: p.name,
        label: (p.personType || 'contact').charAt(0).toUpperCase() + (p.personType || 'contact').slice(1)
      });
    }
  }
  // Library files
  var brandIdx = (typeof selectedBrand !== 'undefined') ? selectedBrand : 0;
  if (typeof getLibraryForBrandIndex === 'function') {
    var lib = getLibraryForBrandIndex(brandIdx);
    if (lib && lib.files) {
      for (var f = 0; f < lib.files.length; f++) {
        var file = lib.files[f];
        candidates.push({
          type: 'library',
          id: file.id || '',
          name: file.name || file.filename || 'Untitled',
          label: 'Library'
        });
      }
    }
  }
  return candidates;
}

function _filterScribeMentions(query) { // v29.3:
  var all = _getScribeMentionCandidates();
  if (!query) return all.slice(0, 8);
  var q = query.toLowerCase();
  var filtered = all.filter(function(c) {
    return c.name.toLowerCase().indexOf(q) !== -1;
  });
  return filtered.slice(0, 8);
}

function _createScribeMentionDropdown() { // v29.3:
  if (_scribeMentionDropdown) return _scribeMentionDropdown;
  var el = document.createElement('div');
  el.className = 'scribe-mention-dropdown';
  el.id = 'scribeMentionDropdown';
  document.body.appendChild(el);
  _scribeMentionDropdown = el;
  return el;
}

function _renderScribeMentionDropdown() { // v29.3:
  var dd = _createScribeMentionDropdown();
  _scribeMentionItems = _filterScribeMentions(_scribeMentionQuery);
  if (_scribeMentionItems.length === 0) {
    dd.classList.remove('visible');
    _scribeMentionActive = false;
    return;
  }
  var html = '';
  for (var i = 0; i < _scribeMentionItems.length; i++) {
    var c = _scribeMentionItems[i];
    var sel = (i === _scribeMentionIdx) ? ' selected' : '';
    var initials = c.name.split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    var iconSvg = c.type === 'person'
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    html += '<div class="scribe-mention-item' + sel + '" data-idx="' + i + '" onmousedown="event.preventDefault();_selectScribeMention(' + i + ')">';
    html += '<div class="scribe-mention-item-icon">' + iconSvg + '</div>';
    html += '<div class="scribe-mention-item-info">';
    html += '<div class="scribe-mention-item-name">' + _escapeScribeHtml(c.name) + '</div>';
    html += '<div class="scribe-mention-item-type">' + _escapeScribeHtml(c.label) + '</div>';
    html += '</div></div>';
  }
  dd.innerHTML = html;
  dd.classList.add('visible');
  _scribeMentionActive = true;

  // Position near TinyMCE caret
  _positionScribeMentionDropdown();
}

function _positionScribeMentionDropdown() { // v29.3:
  var dd = _scribeMentionDropdown;
  if (!dd) return;
  var editor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
  if (!editor) return;
  try {
    var rng = editor.selection.getRng();
    var rect = rng.getBoundingClientRect();
    var iframeEl = editor.getContentAreaContainer().querySelector('iframe');
    if (!iframeEl) return;
    var iframeRect = iframeEl.getBoundingClientRect();
    dd.style.left = (iframeRect.left + rect.left) + 'px';
    dd.style.top = (iframeRect.top + rect.bottom + 4) + 'px';
  } catch (e) {
    // Fallback: center under TinyMCE wrapper
    var wrap = document.getElementById('scribeTinymceWrap');
    if (wrap) {
      var wRect = wrap.getBoundingClientRect();
      dd.style.left = (wRect.left + 20) + 'px';
      dd.style.top = (wRect.top + 60) + 'px';
    }
  }
}

function _selectScribeMention(idx) { // v29.3:
  var item = _scribeMentionItems[idx];
  if (!item) return;
  var editor = (typeof tinymce !== 'undefined') ? tinymce.get('scribeContentArea') : null;
  if (!editor) return;

  // Delete the @query text from the editor
  // We find the @ character and remove everything from @ to current caret
  var content = editor.getContent({ format: 'text' });
  // Use bookmark approach: select from stored range to current pos and replace
  editor.undoManager.transact(function() {
    // Find and remove @query by walking backward from caret
    var sel = editor.selection;
    var rng = sel.getRng();
    var textNode = rng.startContainer;
    var offset = rng.startOffset;

    if (textNode.nodeType === 3) { // Text node
      var text = textNode.textContent;
      // Find the @ character walking backward
      var atPos = -1;
      for (var i = offset - 1; i >= 0; i--) {
        if (text.charAt(i) === '@') { atPos = i; break; }
      }
      if (atPos !== -1) {
        // Remove @query
        var before = text.substring(0, atPos);
        var after = text.substring(offset);
        textNode.textContent = before + after;

        // Insert mention span
        var mentionSpan = editor.dom.create('span', {
          'class': 'scribe-mention-tag',
          'data-mention-type': item.type,
          'data-mention-id': item.id,
          'contenteditable': 'false'
        }, '@' + item.name);
        var newRng = editor.dom.createRng();
        newRng.setStart(textNode, atPos);
        newRng.setEnd(textNode, atPos);
        sel.setRng(newRng);
        sel.collapse(false);
        editor.selection.setNode(mentionSpan);

        // Insert a trailing space after the mention
        var spaceNode = editor.getDoc().createTextNode('\u00A0');
        mentionSpan.parentNode.insertBefore(spaceNode, mentionSpan.nextSibling);
        newRng = editor.dom.createRng();
        newRng.setStartAfter(spaceNode);
        newRng.collapse(true);
        sel.setRng(newRng);
      }
    }
  });

  // Also link this person/library item in notebook metadata
  var nb = _getActiveScribeNotebook();
  if (nb && item.type === 'person') {
    if (!nb.linkedPeople) nb.linkedPeople = [];
    if (nb.linkedPeople.indexOf(item.name) === -1) {
      nb.linkedPeople.push(item.name);
    }
  } else if (nb && item.type === 'library') {
    if (!nb.linkedLibraryItems) nb.linkedLibraryItems = [];
    if (nb.linkedLibraryItems.indexOf(item.name) === -1) {
      nb.linkedLibraryItems.push(item.name);
    }
  }

  _closeScribeMentionDropdown();
  scheduleScribeAutoSave();
}

function _closeScribeMentionDropdown() { // v29.3:
  if (_scribeMentionDropdown) {
    _scribeMentionDropdown.classList.remove('visible');
  }
  _scribeMentionActive = false;
  _scribeMentionQuery = '';
  _scribeMentionIdx = 0;
}
```

- [ ] **Step 2: Hook the @-mention listener into TinyMCE setup**

In `initScribeTinymce()`, find the `setup: function(editor) {` block (around line 112). Inside the setup function, AFTER the existing `editor.on('change keyup', ...)` handler, add:

```javascript
      // v29.3: @-mention autocomplete
      editor.on('keydown', function(e) {
        if (_scribeMentionActive) {
          if (e.keyCode === 40) { // ArrowDown
            e.preventDefault();
            _scribeMentionIdx = Math.min(_scribeMentionIdx + 1, _scribeMentionItems.length - 1);
            _renderScribeMentionDropdown();
          } else if (e.keyCode === 38) { // ArrowUp
            e.preventDefault();
            _scribeMentionIdx = Math.max(_scribeMentionIdx - 1, 0);
            _renderScribeMentionDropdown();
          } else if (e.keyCode === 13 || e.keyCode === 9) { // Enter or Tab
            e.preventDefault();
            _selectScribeMention(_scribeMentionIdx);
          } else if (e.keyCode === 27) { // Escape
            e.preventDefault();
            _closeScribeMentionDropdown();
          }
        }
      });

      editor.on('keyup', function(e) {
        // Ignore navigation keys
        if ([38, 40, 13, 9, 27, 16, 17, 18, 91].indexOf(e.keyCode) !== -1) return;
        var sel = editor.selection;
        var rng = sel.getRng();
        var textNode = rng.startContainer;
        if (textNode.nodeType !== 3) {
          _closeScribeMentionDropdown();
          return;
        }
        var text = textNode.textContent;
        var offset = rng.startOffset;
        // Walk backward to find @
        var atPos = -1;
        for (var i = offset - 1; i >= 0; i--) {
          var ch = text.charAt(i);
          if (ch === '@') { atPos = i; break; }
          if (ch === ' ' || ch === '\n' || ch === '\u00A0') break;
        }
        if (atPos !== -1) {
          _scribeMentionQuery = text.substring(atPos + 1, offset);
          _scribeMentionIdx = 0;
          _renderScribeMentionDropdown();
        } else {
          _closeScribeMentionDropdown();
        }
      });

      // Close dropdown on blur
      editor.on('blur', function() {
        setTimeout(function() { _closeScribeMentionDropdown(); }, 200);
      });
```

- [ ] **Step 3: Add mention tag styling to TinyMCE content_style**

In `initScribeTinymce()`, find the `content_style` property (around line 109-111). Append to BOTH the light and dark content_style strings (before the closing single quote):

For the dark theme content_style string, append:
```
 .scribe-mention-tag { color: #a89878; text-decoration: underline; text-decoration-color: rgba(168,152,120,0.4); text-underline-offset: 2px; cursor: default; }
```

For the light theme content_style string, append:
```
 .scribe-mention-tag { color: #6d6352; text-decoration: underline; text-decoration-color: rgba(109,99,82,0.4); text-underline-offset: 2px; cursor: default; }
```

- [ ] **Step 4: Verify and commit**

```
Verification:
1. Open Scribe, select a notebook
2. Type @ in the TinyMCE editor - dropdown should appear with People and Library items
3. Type a few characters to filter results
4. Use arrow keys + Enter to select a mention
5. Verify the mention appears as a styled span with gold underline
6. Verify the person/file is added to notebook linkedPeople/linkedLibraryItems
7. Press Escape to dismiss dropdown without selecting
```

```bash
cd ~/Developer/roweOS && bash src/build.sh && git add src/js/core/33-scribe.js && git commit -m "feat(scribe): @-mention autocomplete for People and Library in TinyMCE v29.3"
```

---

### Task 3: Knowledge Mode AI - Proper Streaming UI

**Files:**
- Modify: `src/js/core/33-scribe.js`

- [ ] **Step 1: Upgrade `renderScribeKnowledgeThread()` with markdown rendering and loading indicator**

Replace the existing `renderScribeKnowledgeThread` function (around line 975) with:

```javascript
function renderScribeKnowledgeThread() { // v29.3: Upgraded with markdown rendering
  var threadEl = document.getElementById('scribeKnowledgeThread');
  if (!threadEl) return;

  if (_scribeKnowledgeThread.length === 0) {
    threadEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px;">' +
      'Ask a question about this notebook, or synthesize its contents.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < _scribeKnowledgeThread.length; i++) {
    var msg = _scribeKnowledgeThread[i];
    var roleClass = msg.role === 'user' ? 'user' : 'ai';
    var roleLabel = msg.role === 'user' ? 'You' : 'AI';
    var isStreaming = (msg.role === 'assistant' && i === _scribeKnowledgeThread.length - 1 && _scribeKnowledgeIsStreaming);
    html += '<div class="scribe-knowledge-msg ' + roleClass + '">';
    html += '<div class="scribe-km-role">' + roleLabel + '</div>';
    html += '<div class="scribe-km-content">';
    if (msg.role === 'assistant' && msg.content) {
      // Render markdown if marked.js is available
      if (typeof marked !== 'undefined') {
        try {
          html += marked.parse(msg.content);
        } catch (e) {
          html += _escapeScribeHtml(msg.content);
        }
      } else {
        html += _escapeScribeHtml(msg.content);
      }
      if (isStreaming) {
        html += '<span class="scribe-km-loading"></span>';
      }
    } else if (msg.role === 'assistant' && !msg.content) {
      html += '<span class="scribe-km-loading"></span>';
    } else {
      html += _escapeScribeHtml(msg.content || '...');
    }
    html += '</div></div>';
  }
  threadEl.innerHTML = html;
  // Auto-scroll to bottom
  threadEl.scrollTop = threadEl.scrollHeight;
}
```

- [ ] **Step 2: Add streaming state variable and update `askScribeQuestion()`**

Near the top of `33-scribe.js` (after the existing `_scribeKnowledgeThread` declaration around line 11), add:

```javascript
var _scribeKnowledgeIsStreaming = false; // v29.3: tracks active streaming state
```

In `askScribeQuestion()`, find the line that adds the assistant placeholder (around line 873):
```javascript
    _scribeKnowledgeThread.push({ role: 'assistant', content: '' });
```

Add immediately before that line:
```javascript
    _scribeKnowledgeIsStreaming = true; // v29.3
```

Find the `onComplete` callback (around line 893):
```javascript
        function() { // v29.0: onComplete
          renderScribeKnowledgeThread();
        },
```

Replace with:
```javascript
        function() { // v29.3: onComplete
          _scribeKnowledgeIsStreaming = false;
          renderScribeKnowledgeThread();
        },
```

Find the `onError` callback (around line 895):
```javascript
        function(err) { // v29.0: onError
          _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Failed to get response');
          renderScribeKnowledgeThread();
        }
```

Replace with:
```javascript
        function(err) { // v29.3: onError
          _scribeKnowledgeIsStreaming = false;
          _scribeKnowledgeThread[threadIdx].content = 'Error: ' + (err.message || 'Failed to get response');
          renderScribeKnowledgeThread();
        }
```

Also find the API key error catch block (around line 901-903) and add `_scribeKnowledgeIsStreaming = false;` before the content assignment.

- [ ] **Step 3: Apply the same streaming state to `synthesizeScribeNotebook()`**

In `synthesizeScribeNotebook()`, find the line that adds the assistant placeholder (around line 930):
```javascript
  _scribeKnowledgeThread.push({ role: 'assistant', content: '' });
```

Add immediately before it:
```javascript
  _scribeKnowledgeIsStreaming = true; // v29.3
```

In the `onComplete` callback (around line 958), add `_scribeKnowledgeIsStreaming = false;` before `renderScribeKnowledgeThread();`.

In the `onError` callback (around line 960), add `_scribeKnowledgeIsStreaming = false;` before the content assignment.

In the catch block (around line 965), add `_scribeKnowledgeIsStreaming = false;` before the content assignment.

In the fallback else block (around line 969), ensure `_scribeKnowledgeIsStreaming` stays false (it already would be, but for safety).

- [ ] **Step 4: Disable input during streaming**

In `askScribeQuestion()`, after setting `_scribeKnowledgeIsStreaming = true`, add:

```javascript
    // v29.3: Disable input during streaming
    var _sendBtn = document.querySelector('.scribe-knowledge-send-btn');
    var _kInput = document.getElementById('scribeKnowledgeInput');
    if (_sendBtn) _sendBtn.disabled = true;
    if (_kInput) _kInput.disabled = true;
```

In both the `onComplete` and `onError` callbacks for `askScribeQuestion()`, add:

```javascript
          var _sendBtn2 = document.querySelector('.scribe-knowledge-send-btn');
          var _kInput2 = document.getElementById('scribeKnowledgeInput');
          if (_sendBtn2) _sendBtn2.disabled = false;
          if (_kInput2) { _kInput2.disabled = false; _kInput2.focus(); }
```

Apply the same pattern in `synthesizeScribeNotebook()` for its `onComplete` and `onError` callbacks.

- [ ] **Step 5: Verify and commit**

```
Verification:
1. Open Scribe, select a notebook with content
2. Type a question in the knowledge input and press Enter
3. Verify: blinking cursor indicator appears while AI is responding
4. Verify: response streams in with proper markdown formatting (headers, lists, code)
5. Verify: input is disabled during streaming, re-enabled after
6. Click "Synthesize" button
7. Verify: same streaming UX with loading indicator and formatted output
8. Check that errors are handled (disconnect API key temporarily)
```

```bash
cd ~/Developer/roweOS && bash src/build.sh && git add src/js/core/33-scribe.js && git commit -m "feat(scribe): upgrade knowledge mode AI with markdown rendering and streaming indicator v29.3"
```

---

### Task 4: People View Backlinks - "Referenced in Notebooks"

**Files:**
- Modify: `src/js/core/29-analytics-commerce.js`

- [ ] **Step 1: Add function to find notebook references for a person**

Find `function getPersonById(id)` (around line 4910 in `29-analytics-commerce.js`). Insert AFTER the `getPersonById` function:

```javascript
// v29.3: Find Scribe notebooks that reference a person (by name or ID)
function getScribeBacklinksForPerson(personId, personName) {
  if (typeof scribeNotebooks === 'undefined' || !Array.isArray(scribeNotebooks)) return [];
  var results = [];
  var lowerName = (personName || '').toLowerCase();

  for (var i = 0; i < scribeNotebooks.length; i++) {
    var nb = scribeNotebooks[i];
    if (nb.archived) continue;
    var found = false;

    // Check linkedPeople array
    if (nb.linkedPeople && nb.linkedPeople.length > 0) {
      for (var lp = 0; lp < nb.linkedPeople.length; lp++) {
        if (nb.linkedPeople[lp] === personName || nb.linkedPeople[lp] === personId) {
          found = true;
          break;
        }
      }
    }

    // Check content for @-mention spans or name text
    if (!found && nb.content) {
      var contentLower = nb.content.toLowerCase();
      // Check for @-mention data attribute
      if (nb.content.indexOf('data-mention-id="' + personId + '"') !== -1) {
        found = true;
      }
      // Check for name occurrence (at least 3 chars to avoid false positives)
      if (!found && lowerName.length >= 3 && contentLower.indexOf(lowerName) !== -1) {
        found = true;
      }
    }

    // Check pages content too
    if (!found && nb.pages) {
      for (var pi = 0; pi < nb.pages.length; pi++) {
        var pgContent = (nb.pages[pi].content || '').toLowerCase();
        if (pgContent.indexOf('data-mention-id="' + personId + '"') !== -1) {
          found = true; break;
        }
        if (lowerName.length >= 3 && pgContent.indexOf(lowerName) !== -1) {
          found = true; break;
        }
      }
    }

    if (found) {
      results.push({
        id: nb.id,
        title: nb.title || 'Untitled',
        updatedAt: nb.updatedAt
      });
    }
  }
  return results;
}
```

- [ ] **Step 2: Inject backlinks section into the People detail rendering**

Find the team member detail rendering function. In `29-analytics-commerce.js`, locate the section that renders the person detail card (search for `// Responsibilities` comment, around line 6980). After the Responsibilities section ends (around line 6988), insert:

```javascript
  // v29.3: Scribe notebook backlinks
  var scribeBacklinks = getScribeBacklinksForPerson(person.id, person.name);
  if (scribeBacklinks.length > 0) {
    html += '<div style="margin-bottom:var(--space-5);">';
    html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Referenced in Notebooks</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    for (var _bk = 0; _bk < scribeBacklinks.length; _bk++) {
      var bk = scribeBacklinks[_bk];
      var bkDate = '';
      try { bkDate = new Date(bk.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch(e) {}
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;cursor:pointer;" onclick="showView(\'scribe\');setTimeout(function(){selectScribeNotebook(\'' + bk.id + '\');},200);">';
      html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--brand-accent,#a89878);"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(bk.title) + '</div>';
      html += '</div>';
      if (bkDate) html += '<div style="font-size:11px;color:var(--text-muted);flex-shrink:0;">' + bkDate + '</div>';
      html += '</div>';
    }
    html += '</div></div>';
  }
```

NOTE: The exact insertion point depends on the HTML structure. Look for the pattern after the "Responsibilities" `</div></div>` and before the "Tasks" or next section. The key is to insert a new section block in the detail card flow.

- [ ] **Step 3: Also add backlinks to the client detail view**

Search for the client detail rendering (look for `renderClientsView` or the client detail card area). If clients use a similar expanded detail card, add the same `getScribeBacklinksForPerson` call and backlinks section there. If clients use a modal-only pattern (no detail card), skip this step.

- [ ] **Step 4: Verify and commit**

```
Verification:
1. Create a notebook in Scribe that mentions a person by name or uses @-mention
2. Navigate to People view, open that person's detail card
3. Verify "Referenced in Notebooks" section appears with the notebook listed
4. Click the notebook entry - verify it navigates to Scribe and opens that notebook
5. Verify: person not mentioned in any notebook shows no backlinks section
```

```bash
cd ~/Developer/roweOS && bash src/build.sh && git add src/js/core/29-analytics-commerce.js && git commit -m "feat(people): show Scribe notebook backlinks on person detail cards v29.3"
```

---

### Task 5: Library "Link to Scribe" Action

**Files:**
- Modify: `src/js/core/12-library.js`
- Modify: `src/js/core/33-scribe.js`

- [ ] **Step 1: Add `openScribeWithLibraryItem()` function in `33-scribe.js`**

Find the `// === HELPERS ===` section in `33-scribe.js` (around line 1178). Insert before it:

```javascript
// === LIBRARY INTEGRATION === // v29.3:

function openScribeWithLibraryItem(fileName, fileContent, fileId) { // v29.3:
  // Switch to Scribe view
  if (typeof showView === 'function') showView('scribe');

  // Small delay for view transition
  setTimeout(function() {
    // Create a new notebook pre-populated with the file reference
    var now = new Date().toISOString();
    var ts = Date.now();
    var nb = {
      id: 'nb_' + ts + '_' + Math.random().toString(36).substr(2, 6),
      title: 'Notes: ' + (fileName || 'Library Item'),
      content: '<p><strong>Source:</strong> <span class="scribe-mention-tag" data-mention-type="library" data-mention-id="' + _escapeScribeHtml(fileId || '') + '">@' + _escapeScribeHtml(fileName || 'Untitled') + '</span></p><hr>',
      pages: [],
      sources: [],
      linkedPeople: [],
      linkedLibraryItems: [fileName || 'Untitled'],
      tags: [],
      brandIdx: (typeof selectedBrand !== 'undefined' ? selectedBrand : null),
      source: (typeof currentMode !== 'undefined' && currentMode === 'lifeai') ? 'lifeai' : 'brandai',
      createdAt: now,
      updatedAt: now,
      _modifiedAt: ts,
      archived: false
    };

    // If file content is available (text-based), include a snippet
    if (fileContent && typeof fileContent === 'string') {
      var snippet = fileContent.substring(0, 2000);
      if (fileContent.length > 2000) snippet += '...';
      nb.content += '<blockquote>' + _escapeScribeHtml(snippet).replace(/\n/g, '<br>') + '</blockquote>';
    }

    scribeNotebooks.unshift(nb);
    saveScribeNotebooks();
    renderScribeNotebookList();
    selectScribeNotebook(nb.id);
    if (typeof showToast === 'function') showToast('Notebook created from library item', 'success');
  }, 300);
}

function linkExistingScribeNotebook(fileName, fileId) { // v29.3:
  // Link a library item to the currently active notebook
  var nb = _getActiveScribeNotebook();
  if (!nb) {
    if (typeof showToast === 'function') showToast('No notebook selected. Open Scribe and select a notebook first.', 'warning');
    return;
  }
  if (!nb.linkedLibraryItems) nb.linkedLibraryItems = [];
  if (nb.linkedLibraryItems.indexOf(fileName) === -1) {
    nb.linkedLibraryItems.push(fileName);
    nb.updatedAt = new Date().toISOString();
    nb._modifiedAt = Date.now();
    saveScribeNotebooks();
    renderScribeMetadata(nb);
    if (typeof showToast === 'function') showToast('Linked "' + fileName + '" to notebook', 'success');
  } else {
    if (typeof showToast === 'function') showToast('Already linked to this notebook', 'info');
  }
}
```

- [ ] **Step 2: Add "Link to Scribe" button in Library file actions**

In `src/js/core/12-library.js`, find the file action buttons in the file detail/context menu rendering. Search for file action patterns like `onclick="deleteLibraryFile"` or file row action buttons. Near the existing action buttons (download, delete, etc.), add:

```javascript
// v29.3: Link to Scribe button
html += '<button class="btn btn-small" onclick="openScribeWithLibraryItem(\'' + escapeHtml((file.name || file.filename || '').replace(/'/g, "\\'")) + '\', null, \'' + (file.id || '') + '\')" style="padding:5px 10px;font-size:11px;" title="Open in Scribe notebook">';
html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
html += 'Scribe</button>';
```

The exact insertion point will vary depending on how library file action buttons are rendered (row actions vs context menu). Find the pattern by searching for `deleteLibraryFile` or `downloadLibraryFile` in `12-library.js` and add the Scribe button alongside them.

- [ ] **Step 3: Verify and commit**

```
Verification:
1. Open Library view, select a file
2. Verify "Scribe" button appears in the file actions
3. Click the button - verify it navigates to Scribe view
4. Verify a new notebook is created with the file name as title
5. Verify the file is listed in the notebook's linkedLibraryItems
6. The notebook content should have a reference link to the library item
```

```bash
cd ~/Developer/roweOS && bash src/build.sh && git add src/js/core/33-scribe.js src/js/core/12-library.js && git commit -m "feat(scribe): library integration - Link to Scribe from Library file actions v29.3"
```

---

### Task 6: Final Integration Testing

- [ ] **Step 1: End-to-end verification**

```
Verification checklist:
1. @-mention: Type @ in TinyMCE - dropdown shows People + Library items, filtered by query
2. @-mention: Arrow keys navigate, Enter/Tab selects, Escape closes
3. @-mention: Selected mention appears as gold-underlined span in editor
4. @-mention: Linked person/file automatically added to notebook metadata
5. Knowledge AI: Question gets streaming response with blinking cursor
6. Knowledge AI: Response renders with markdown (headers, lists, bold, code)
7. Knowledge AI: Input disabled during streaming, re-enabled on complete
8. Knowledge AI: Synthesize button works with same streaming UX
9. Backlinks: Person detail shows "Referenced in Notebooks" when mentioned
10. Backlinks: Clicking notebook entry opens it in Scribe
11. Library: "Scribe" button visible on library files
12. Library: Creates new notebook with file reference and linked metadata
13. No console errors during any of the above flows
```

```bash
cd ~/Developer/roweOS && bash src/build.sh
```
