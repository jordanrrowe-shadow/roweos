# Chat Content Selection & Export System

## Goal
Add three integrated features for selecting and exporting specific content from chat messages: (A) a floating toolbar on text selection, (B) section markers with checkboxes on structured content, and (C) a clip tool for dragging start/end boundaries within a message.

## Architecture
- **App type:** Monolithic ES5 JavaScript web app (single HTML file built from `src/`)
- **Chat data:** `currentConversation` array (msg objects with `role`, `content`, `displayContent`, `attachedFiles`)
- **Existing export:** `exportChatMsg(btn, format)` in `src/js/core/11-agents.js` handles Copy/Word/Excel/Slides/PDF/Email per message. Delegates to `exportChatMsgAsPDF()`, `exportChatMsgAsDocx()`, `exportChatMsgAsXlsx()`, `exportChatMsgAsPptx()`, `chatSendAsEmail()`.
- **Message action bar:** `appendStreamingMsgActions()` in `src/js/core/20-ui-misc.js` appends `.chat-msg-actions` div to every assistant message bubble after streaming completes.
- **Rendered messages:** `renderConversation()` in `src/js/core/20-ui-misc.js` also appends a static `msgActionsHtml` to each assistant message.
- **Scribe:** `createScribeNotebook()` / `createScribePage(notebookId)` in `src/js/core/33-scribe.js`. Notebooks stored in `scribeNotebooks` array, saved via `saveScribeNotebooks()`. Pages live inside notebook's `.pages` array.
- **Save menu:** `openChatSaveMenu()` in `src/js/core/14-calendar.js` offers Save to Folio, Save to Library, Add as Goal.
- **PDF:** `roweosPDF(markdownOrHtml, options)` in `src/js/core/11-agents.js` generates dark-theme PDFs via jsPDF.
- **Email:** `chatSendAsEmail(btn)` in `src/js/late/02-mail.js` (built line ~203459) shows inline compose form.

## Tech Stack
- ES5 JavaScript (no arrow functions, let/const, template literals, destructuring)
- No test framework - verification is manual
- Build: `bash src/build.sh`

## File Structure
```
src/css/core/01-base.css                   -- All CSS (selection toolbar, section markers, clip tool)
src/js/core/11-agents.js                   -- exportChatMsg (line ~3867), export helpers, new exportSelectedContent()
src/js/core/20-ui-misc.js                  -- appendStreamingMsgActions (line ~4655), renderConversation (line ~4726)
src/js/core/14-calendar.js                 -- openChatSaveMenu (line ~3791), new saveContentToScribe()
src/js/core/33-scribe.js                   -- createScribeNotebook(), createScribePage(), saveScribeNotebooks()
```

## Shared Utility: `exportSelectedContent(htmlContent, textContent, format)`

All three features (A, B, C) need to export arbitrary HTML/text content in multiple formats. This shared function routes to existing export helpers and adds the new Scribe path.

---

## Task 1: Shared Export Utility + Scribe Integration

### Files
- `src/js/core/11-agents.js` (add `exportSelectedContent()` after `exportChatMsg` at line ~3901)
- `src/js/core/14-calendar.js` (add `saveContentToScribe()` after `openChatSaveMenu` at line ~3821)

### Step 1.1: Add `exportSelectedContent()` routing function

**File:** `src/js/core/11-agents.js`

Insert after the closing `}` of `exportChatMsg` (after line ~3901):

```javascript
// v29.3: Export arbitrary selected content (shared by selection toolbar, section markers, clip tool)
// Accepts htmlContent and textContent strings plus a format key.
function exportSelectedContent(htmlContent, textContent, format) {
  if (!htmlContent && !textContent) {
    showToast('No content selected', 'warning');
    return;
  }
  if (!textContent) textContent = htmlContent.replace(/<[^>]+>/g, '');
  if (!htmlContent) htmlContent = '<p>' + escapeHtml(textContent).replace(/\n/g, '<br>') + '</p>';

  if (format === 'copy') {
    navigator.clipboard.writeText(textContent).then(function() {
      showToast('Copied to clipboard', 'success');
    });
    return;
  }
  if (format === 'pdf') {
    exportChatMsgAsPDF(htmlContent);
    return;
  }
  if (format === 'docx') {
    exportChatMsgAsDocx(htmlContent, textContent);
    return;
  }
  if (format === 'xlsx') {
    exportChatMsgAsXlsx(htmlContent, textContent);
    return;
  }
  if (format === 'pptx') {
    exportChatMsgAsPptx(htmlContent, textContent);
    return;
  }
  if (format === 'scribe') {
    saveContentToScribe(htmlContent, textContent);
    return;
  }
  if (format === 'library') {
    // Reuse existing save-to-library flow with the selected content
    window.pendingSaveContent = textContent;
    window.pendingSaveSource = 'selection';
    openSaveConversationToLibrary();
    return;
  }
  if (format === 'email') {
    // Create a temporary message element so chatSendAsEmail can find content
    var tempDiv = document.createElement('div');
    tempDiv.className = 'conversation-message assistant';
    tempDiv.innerHTML = '<div class="conversation-message-bubble"><div class="conversation-message-content">' + htmlContent + '</div></div>';
    document.body.appendChild(tempDiv);
    chatSendAsEmail(tempDiv.querySelector('.conversation-message-content'));
    // Clean up the temp div after the email form is shown
    setTimeout(function() {
      if (tempDiv.parentNode && !tempDiv.querySelector('.chat-email-inline')) {
        tempDiv.remove();
      }
    }, 500);
    return;
  }
}
```

### Step 1.2: Add `saveContentToScribe()` function

**File:** `src/js/core/14-calendar.js`

Insert after the closing `}` of `openChatSaveMenu` (after line ~3821):

```javascript
// v29.3: Save arbitrary content to a new Scribe notebook page
function saveContentToScribe(htmlContent, textContent) {
  if (typeof scribeNotebooks === 'undefined' || typeof saveScribeNotebooks !== 'function') {
    showToast('Scribe is not available', 'error');
    return;
  }
  var now = new Date().toISOString();
  var ts = Date.now();

  // Generate a title from the first line of text
  var titleText = (textContent || '').split('\n')[0].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
  if (titleText.length > 60) titleText = titleText.substring(0, 57) + '...';
  if (!titleText) titleText = 'Chat Export ' + new Date().toLocaleDateString();

  // Create a new notebook with the content
  var nb = {
    id: 'nb_' + ts + '_' + Math.random().toString(36).substr(2, 6),
    title: titleText,
    content: htmlContent || textContent || '',
    pages: [],
    sources: ['chat-export'],
    linkedPeople: [],
    linkedLibraryItems: [],
    tags: ['chat-export'],
    brandIdx: (typeof selectedBrand !== 'undefined' ? selectedBrand : null),
    source: (typeof currentMode !== 'undefined' && currentMode === 'lifeai') ? 'lifeai' : 'brandai',
    createdAt: now,
    updatedAt: now,
    _modifiedAt: ts,
    archived: false
  };
  scribeNotebooks.unshift(nb);
  saveScribeNotebooks();
  showToast('Saved to Scribe: ' + titleText, 'success');
}
```

### Verification
1. Open Chat, get an AI response
2. Open browser console, run: `exportSelectedContent('<p>Test content</p>', 'Test content', 'copy')` - should copy "Test content" to clipboard
3. Run: `exportSelectedContent('<p>Test</p>', 'Test', 'scribe')` - should create a new Scribe notebook
4. Navigate to Scribe view - verify the new notebook appears with content

### Commit
`v29.3: Add exportSelectedContent() shared utility and saveContentToScribe() for chat export system`

---

## Task 2: Feature A - Text Selection Toolbar

### Files
- `src/css/core/01-base.css` (toolbar styles)
- `src/js/core/20-ui-misc.js` (selection listener + toolbar logic)

### Step 2.1: Add CSS for the floating selection toolbar

**File:** `src/css/core/01-base.css`

Insert after the `.chat-msg-actions button:hover` block (find the comment `/* v16.4: Document card in chat */` and insert before it):

```css
    /* v29.3: Chat text selection toolbar */
    .chat-selection-toolbar {
      position: fixed;
      z-index: 100001;
      display: flex;
      gap: 2px;
      padding: 4px;
      background: var(--bg-secondary, #1a1a1a);
      border: 1px solid var(--border-color, rgba(255,255,255,0.1));
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.15s, transform 0.15s;
      pointer-events: none;
    }
    .chat-selection-toolbar.visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    .chat-selection-toolbar button {
      background: transparent;
      border: none;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      color: var(--text-secondary, #999);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      font-family: inherit;
      transition: background 0.15s, color 0.15s;
    }
    .chat-selection-toolbar button:hover {
      background: var(--accent-10, rgba(168,152,120,0.1));
      color: var(--accent, #a89878);
    }
    .chat-selection-toolbar button svg {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
    }
    @media (max-width: 768px) {
      .chat-selection-toolbar {
        gap: 1px;
        padding: 3px;
      }
      .chat-selection-toolbar button {
        padding: 5px 7px;
        font-size: 10px;
        gap: 3px;
      }
      .chat-selection-toolbar button svg {
        width: 10px;
        height: 10px;
      }
    }
```

### Step 2.2: Add selection toolbar logic

**File:** `src/js/core/20-ui-misc.js`

Insert after the mobile tap toggle IIFE (after the closing `})();` at line ~4724, just before `function renderConversation()`):

```javascript
// v29.3: Chat text selection toolbar
(function() {
  var _selToolbar = null;
  var _selHideTimer = null;

  function _getSelToolbar() {
    if (_selToolbar) return _selToolbar;
    var tb = document.createElement('div');
    tb.className = 'chat-selection-toolbar';
    tb.innerHTML = ''
      + '<button data-action="copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</button>'
      + '<button data-action="pdf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13h4M10 17h4M8 9h1"/></svg> PDF</button>'
      + '<button data-action="scribe"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/></svg> Scribe</button>'
      + '<button data-action="library"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> Library</button>'
      + '<button data-action="docx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Word</button>'
      + '<button data-action="email"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg> Email</button>';
    tb.addEventListener('mousedown', function(e) {
      // Prevent toolbar click from clearing the selection
      e.preventDefault();
    });
    tb.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        _hideSelToolbar();
        return;
      }
      // Extract HTML from selection
      var range = sel.getRangeAt(0);
      var frag = range.cloneContents();
      var wrapper = document.createElement('div');
      wrapper.appendChild(frag);
      var htmlContent = wrapper.innerHTML;
      var textContent = sel.toString();
      exportSelectedContent(htmlContent, textContent, action);
      _hideSelToolbar();
      // Clear selection after export (except copy, which user may want to keep)
      if (action !== 'copy') {
        sel.removeAllRanges();
      }
    });
    document.body.appendChild(tb);
    _selToolbar = tb;
    return tb;
  }

  function _showSelToolbar(rect) {
    var tb = _getSelToolbar();
    if (_selHideTimer) { clearTimeout(_selHideTimer); _selHideTimer = null; }
    // Position above the selection rect
    var tbWidth = 420; // approximate; will be corrected after visible
    var left = rect.left + (rect.width / 2) - (tbWidth / 2);
    var top = rect.top - 44;
    // Keep on screen
    if (left < 8) left = 8;
    if (left + tbWidth > window.innerWidth - 8) left = window.innerWidth - tbWidth - 8;
    if (top < 8) {
      // Show below if not enough room above
      top = rect.bottom + 8;
    }
    tb.style.left = left + 'px';
    tb.style.top = top + 'px';
    tb.classList.add('visible');
    // Reposition after render to use actual width
    requestAnimationFrame(function() {
      var actualWidth = tb.offsetWidth;
      var correctedLeft = rect.left + (rect.width / 2) - (actualWidth / 2);
      if (correctedLeft < 8) correctedLeft = 8;
      if (correctedLeft + actualWidth > window.innerWidth - 8) correctedLeft = window.innerWidth - actualWidth - 8;
      tb.style.left = correctedLeft + 'px';
    });
  }

  function _hideSelToolbar() {
    if (_selToolbar) {
      _selToolbar.classList.remove('visible');
    }
  }

  // Listen for text selection within chat messages
  function _checkSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      _selHideTimer = setTimeout(_hideSelToolbar, 150);
      return;
    }
    // Check if selection is within a .conversation-message-content
    var anchorNode = sel.anchorNode;
    var focusNode = sel.focusNode;
    if (!anchorNode || !focusNode) { _hideSelToolbar(); return; }
    var anchorContent = anchorNode.nodeType === 1 ? anchorNode.closest('.conversation-message-content') : (anchorNode.parentElement ? anchorNode.parentElement.closest('.conversation-message-content') : null);
    var focusContent = focusNode.nodeType === 1 ? focusNode.closest('.conversation-message-content') : (focusNode.parentElement ? focusNode.parentElement.closest('.conversation-message-content') : null);
    if (!anchorContent || !focusContent) { _hideSelToolbar(); return; }
    // Show toolbar positioned at the selection
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { _hideSelToolbar(); return; }
    _showSelToolbar(rect);
  }

  var _selDebounce = null;
  document.addEventListener('mouseup', function(e) {
    // Don't trigger if clicking on the toolbar itself
    if (_selToolbar && _selToolbar.contains(e.target)) return;
    // Only check within conversation thread
    var thread = document.getElementById('conversationThread');
    if (!thread || !thread.contains(e.target)) return;
    clearTimeout(_selDebounce);
    _selDebounce = setTimeout(_checkSelection, 80);
  });

  // Touch support
  document.addEventListener('selectionchange', function() {
    // Only handle on touch devices; desktop uses mouseup
    if (!('ontouchstart' in window)) return;
    clearTimeout(_selDebounce);
    _selDebounce = setTimeout(function() {
      var thread = document.getElementById('conversationThread');
      if (!thread) return;
      var sel = window.getSelection();
      if (!sel || !sel.anchorNode) return;
      var node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      if (node && thread.contains(node)) {
        _checkSelection();
      }
    }, 300);
  });

  // Hide toolbar on scroll or click outside
  document.addEventListener('scroll', function() {
    _hideSelToolbar();
  }, true);
  document.addEventListener('mousedown', function(e) {
    if (_selToolbar && !_selToolbar.contains(e.target)) {
      _hideSelToolbar();
    }
  });
})();
```

### Verification
1. Open Chat, get an AI response with multiple paragraphs
2. Highlight some text within the response - a floating toolbar should appear above the selection
3. Click "Copy" - text should be copied to clipboard, toast confirms
4. Highlight again, click "PDF" - should open PDF orientation modal and generate PDF with only the selected text
5. Highlight again, click "Scribe" - should create new Scribe notebook with selected content
6. Highlight again, click "Word" - should download .docx with only selected text
7. Click outside the message or scroll - toolbar should hide
8. Test on mobile: long-press to select text, toolbar should appear via `selectionchange` listener
9. Verify toolbar stays on screen (doesn't overflow left/right/top)

### Commit
`v29.3: Add floating text selection toolbar for chat messages with Copy/PDF/Scribe/Library/Word/Email export`

---

## Task 3: Feature B - Section Markers with Checkboxes

### Files
- `src/css/core/01-base.css` (section marker + export bar styles)
- `src/js/core/20-ui-misc.js` (section scanning in `appendStreamingMsgActions()`, export bar logic)

### Step 3.1: Add CSS for section markers and export bar

**File:** `src/css/core/01-base.css`

Insert after the selection toolbar CSS added in Task 2:

```css
    /* v29.3: Chat section markers for selective export */
    .chat-section-wrap {
      position: relative;
    }
    .chat-section-wrap .chat-section-check {
      position: absolute;
      left: -28px;
      top: 4px;
      width: 18px;
      height: 18px;
      opacity: 0;
      cursor: pointer;
      accent-color: var(--accent, #a89878);
      transition: opacity 0.15s;
      z-index: 10;
    }
    .chat-section-wrap:hover .chat-section-check,
    .chat-section-wrap .chat-section-check:checked {
      opacity: 1;
    }
    .chat-section-wrap.checked {
      background: var(--accent-10, rgba(168,152,120,0.05));
      border-radius: 6px;
      padding: 4px 8px;
      margin-left: -8px;
      margin-right: -8px;
    }
    .chat-section-export-bar {
      display: flex;
      gap: 4px;
      padding: 8px 0 4px;
      flex-wrap: wrap;
      align-items: center;
      border-top: 1px solid var(--border-color, rgba(255,255,255,0.1));
      margin-top: 8px;
    }
    .chat-section-export-bar .section-export-label {
      font-size: 11px;
      color: var(--text-secondary, #999);
      margin-right: 4px;
    }
    .chat-section-export-bar button {
      background: var(--bg-secondary, rgba(255,255,255,0.05));
      border: 1px solid var(--border-primary, rgba(255,255,255,0.1));
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      color: var(--text-secondary, #999);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: inherit;
      transition: all 0.15s;
    }
    .chat-section-export-bar button:hover {
      background: var(--accent-10, rgba(168,152,120,0.1));
      color: var(--accent, #a89878);
      border-color: var(--accent-30, rgba(168,152,120,0.3));
    }
    @media (max-width: 768px) {
      .chat-section-wrap .chat-section-check {
        left: -22px;
        width: 16px;
        height: 16px;
      }
      .chat-section-export-bar button {
        padding: 3px 7px;
        font-size: 10px;
      }
    }
```

### Step 3.2: Add section scanning after streaming completes

**File:** `src/js/core/20-ui-misc.js`

Insert after the mobile code toggle block in `appendStreamingMsgActions()` (after line ~4683, before the closing `}` of the function):

```javascript
  // v29.3: Scan for structured sections and add hover checkboxes
  _addSectionMarkers(bubble);
```

### Step 3.3: Add section marker functions

**File:** `src/js/core/20-ui-misc.js`

Insert after `appendStreamingMsgActions()` (after line ~4684, before the mobile tap toggle IIFE):

```javascript
// v29.3: Scan a message bubble for structured content sections and wrap with checkboxes
function _addSectionMarkers(bubble) {
  var content = bubble.querySelector('.conversation-message-content');
  if (!content) return;

  // Find structural elements: headings, tables, code blocks
  var selectors = 'h1, h2, h3, h4, h5, h6, table, pre';
  var elements = content.querySelectorAll(selectors);
  if (elements.length < 2) return; // Only add markers when there are multiple sections

  var marked = 0;
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    // Skip if already wrapped
    if (el.parentElement && el.parentElement.classList.contains('chat-section-wrap')) continue;

    // Determine section scope: for headings, collect content until next heading of same or higher level
    var wrap = document.createElement('div');
    wrap.className = 'chat-section-wrap';
    wrap.setAttribute('data-section-idx', String(i));

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'chat-section-check';
    checkbox.setAttribute('data-section-idx', String(i));
    checkbox.addEventListener('change', function() {
      var w = this.closest('.chat-section-wrap');
      if (w) {
        if (this.checked) {
          w.classList.add('checked');
        } else {
          w.classList.remove('checked');
        }
      }
      _updateSectionExportBar(bubble);
    });

    // Wrap the element (and following siblings up to next section element) in the wrap div
    var tag = el.tagName;
    var isHeading = tag.match(/^H[1-6]$/);

    if (isHeading) {
      // Collect this heading + content until next heading of same/higher level or next structural element
      var headingLevel = parseInt(tag.charAt(1), 10);
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(checkbox);
      wrap.appendChild(el);

      // Collect subsequent siblings
      while (wrap.nextSibling) {
        var sib = wrap.nextSibling;
        if (sib.nodeType !== 1) {
          wrap.appendChild(sib);
          continue;
        }
        // Stop at next heading of same or higher level, or at another structural element that will get its own marker
        var sibTag = sib.tagName;
        if (sibTag && sibTag.match(/^H[1-6]$/)) {
          var sibLevel = parseInt(sibTag.charAt(1), 10);
          if (sibLevel <= headingLevel) break;
        }
        if (sibTag === 'TABLE' || sibTag === 'PRE') break;
        // Also stop at another chat-section-wrap (already processed)
        if (sib.classList && sib.classList.contains('chat-section-wrap')) break;
        wrap.appendChild(sib);
      }
    } else {
      // For tables and code blocks, just wrap the single element
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(checkbox);
      wrap.appendChild(el);
    }
    marked++;
  }

  if (marked < 2) {
    // Undo wrapping if we only found one section (not useful)
    var wraps = content.querySelectorAll('.chat-section-wrap');
    for (var w = 0; w < wraps.length; w++) {
      var parent = wraps[w].parentNode;
      var check = wraps[w].querySelector('.chat-section-check');
      if (check) check.remove();
      while (wraps[w].firstChild) {
        parent.insertBefore(wraps[w].firstChild, wraps[w]);
      }
      parent.removeChild(wraps[w]);
    }
  }
}

// v29.3: Show/hide "Export Selected Sections" bar based on checked sections
function _updateSectionExportBar(bubble) {
  var content = bubble.querySelector('.conversation-message-content');
  if (!content) return;
  var checked = content.querySelectorAll('.chat-section-check:checked');
  var existingBar = bubble.querySelector('.chat-section-export-bar');

  if (checked.length === 0) {
    if (existingBar) existingBar.remove();
    return;
  }

  if (!existingBar) {
    existingBar = document.createElement('div');
    existingBar.className = 'chat-section-export-bar';
    existingBar.innerHTML = ''
      + '<span class="section-export-label">Export selected:</span>'
      + '<button data-action="copy"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</button>'
      + '<button data-action="pdf"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13h4M10 17h4M8 9h1"/></svg> PDF</button>'
      + '<button data-action="scribe"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/></svg> Scribe</button>'
      + '<button data-action="docx"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Word</button>'
      + '<button data-action="email"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg> Email</button>';
    existingBar.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      // Collect HTML from all checked sections
      var checkedWraps = content.querySelectorAll('.chat-section-wrap.checked');
      var htmlParts = [];
      var textParts = [];
      for (var i = 0; i < checkedWraps.length; i++) {
        // Clone and remove the checkbox from the clone
        var clone = checkedWraps[i].cloneNode(true);
        var cb = clone.querySelector('.chat-section-check');
        if (cb) cb.remove();
        htmlParts.push(clone.innerHTML);
        textParts.push(clone.textContent || clone.innerText || '');
      }
      var htmlContent = htmlParts.join('\n');
      var textContent = textParts.join('\n\n');
      exportSelectedContent(htmlContent, textContent, action);
    });
    // Insert between content and action bar
    var actionsBar = bubble.querySelector('.chat-msg-actions');
    if (actionsBar) {
      bubble.insertBefore(existingBar, actionsBar);
    } else {
      bubble.appendChild(existingBar);
    }
  }

  // Update label count
  var label = existingBar.querySelector('.section-export-label');
  if (label) {
    label.textContent = 'Export ' + checked.length + ' section' + (checked.length > 1 ? 's' : '') + ':';
  }
}
```

### Step 3.4: Also apply section markers to `renderConversation()` assistant messages

**File:** `src/js/core/20-ui-misc.js`

In `renderConversation()`, after the assistant message HTML is set via `div.innerHTML = ...` and after `thread.appendChild(div)`, add a scan call. Find the block near the end of `renderConversation()` where `thread.appendChild(div)` is called (line ~4826) and add after it:

```javascript
    // v29.3: Add section markers to assistant messages rendered from history
    if (msg.role === 'assistant') {
      var renderedBubble = div.querySelector('.conversation-message-bubble');
      if (renderedBubble) _addSectionMarkers(renderedBubble);
    }
```

### Verification
1. Open Chat, ask a question that produces structured output (e.g., "Give me a comparison table of React vs Vue, then list 3 code examples with explanations")
2. Hover over a heading or table in the response - a checkbox should appear on the left margin
3. Check two sections - they should highlight with a subtle gold tint
4. An "Export 2 sections:" bar should appear at the bottom of the message
5. Click "Copy" in the export bar - should copy only the checked sections' text
6. Click "PDF" - should generate PDF with only checked content
7. Uncheck all sections - export bar should disappear
8. Navigate away and back to Chat (to test `renderConversation()` path) - markers should appear on history messages too
9. Verify the checkboxes don't appear when there's only one section (e.g., simple text response)

### Commit
`v29.3: Add section markers with checkboxes for selective chat content export`

---

## Task 4: Feature C - Clip Tool

### Files
- `src/css/core/01-base.css` (clip mode styles)
- `src/js/core/20-ui-misc.js` (clip mode logic + scissors button in action bar)

### Step 4.1: Add CSS for clip mode

**File:** `src/css/core/01-base.css`

Insert after the section marker CSS added in Task 3:

```css
    /* v29.3: Chat clip tool */
    .chat-clip-mode .conversation-message-content {
      position: relative;
      cursor: text;
      user-select: none;
      -webkit-user-select: none;
    }
    .chat-clip-overlay {
      position: absolute;
      left: 0;
      right: 0;
      background: var(--accent-10, rgba(168,152,120,0.12));
      border-top: 2px solid var(--accent, #a89878);
      border-bottom: 2px solid var(--accent, #a89878);
      pointer-events: none;
      z-index: 5;
      transition: top 0.1s, height 0.1s;
    }
    .chat-clip-handle {
      position: absolute;
      left: -4px;
      right: -4px;
      height: 12px;
      cursor: ns-resize;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chat-clip-handle::after {
      content: '';
      display: block;
      width: 32px;
      height: 4px;
      background: var(--accent, #a89878);
      border-radius: 2px;
    }
    .chat-clip-handle.start {
      top: -6px;
    }
    .chat-clip-handle.end {
      bottom: -6px;
    }
    .chat-clip-actions {
      display: flex;
      gap: 4px;
      justify-content: center;
      padding: 8px 0 4px;
      flex-wrap: wrap;
    }
    .chat-clip-actions button {
      background: var(--bg-secondary, rgba(255,255,255,0.05));
      border: 1px solid var(--border-primary, rgba(255,255,255,0.1));
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 11px;
      color: var(--text-secondary, #999);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: inherit;
      transition: all 0.15s;
    }
    .chat-clip-actions button:hover {
      background: var(--accent-10, rgba(168,152,120,0.1));
      color: var(--accent, #a89878);
      border-color: var(--accent-30, rgba(168,152,120,0.3));
    }
    .chat-clip-actions button.clip-cancel {
      color: var(--text-muted, #666);
    }
    .chat-clip-actions button.clip-export-btn {
      background: var(--accent-10, rgba(168,152,120,0.1));
      border-color: var(--accent-30, rgba(168,152,120,0.3));
      color: var(--accent, #a89878);
      font-weight: 600;
    }
    @media (max-width: 768px) {
      .chat-clip-actions button {
        padding: 4px 8px;
        font-size: 10px;
      }
    }
```

### Step 4.2: Add scissors icon to message action bar

**File:** `src/js/core/20-ui-misc.js`

In `appendStreamingMsgActions()`, modify the `actionsDiv.innerHTML` string (line ~4667) to add a scissors button at the end, before the closing of the innerHTML assignment. Find the `Save</button>'` at the end and append the scissors button after it:

Find the end of the `actionsDiv.innerHTML` assignment (the `Save</button>'` portion):

```javascript
// BEFORE (end of actionsDiv.innerHTML):
...Save</button>';

// AFTER:
...Save</button><button onclick="enterClipMode(this)"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg> Clip</button>';
```

Also do the same in `renderConversation()`'s static `msgActionsHtml` string (line ~4822). Find the `Save</button></div>` and add the scissors button before `</div>`:

```javascript
// BEFORE:
...Save</button></div>';

// AFTER:
...Save</button><button onclick="enterClipMode(this)"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg> Clip</button></div>';
```

### Step 4.3: Add clip mode logic

**File:** `src/js/core/20-ui-misc.js`

Insert after `_updateSectionExportBar()` (added in Task 3), before the selection toolbar IIFE:

```javascript
// v29.3: Clip tool - drag start/end boundaries within a message to select a range
var _clipActiveMsg = null;

function enterClipMode(btn) {
  var msgEl = btn.closest('.conversation-message');
  if (!msgEl) return;
  var bubble = msgEl.querySelector('.conversation-message-bubble');
  var content = msgEl.querySelector('.conversation-message-content');
  if (!bubble || !content) return;

  // If already in clip mode on this message, exit
  if (msgEl.classList.contains('chat-clip-mode')) {
    exitClipMode(msgEl);
    return;
  }

  // Exit any other active clip mode
  if (_clipActiveMsg && _clipActiveMsg !== msgEl) {
    exitClipMode(_clipActiveMsg);
  }

  _clipActiveMsg = msgEl;
  msgEl.classList.add('chat-clip-mode');

  // Create overlay and handles
  var contentRect = content.getBoundingClientRect();
  var contentHeight = content.scrollHeight;

  // Default clip: middle third of content
  var startPct = 0.0;
  var endPct = 1.0;

  var overlay = document.createElement('div');
  overlay.className = 'chat-clip-overlay';
  overlay.style.top = Math.round(contentHeight * startPct) + 'px';
  overlay.style.height = Math.round(contentHeight * (endPct - startPct)) + 'px';

  var startHandle = document.createElement('div');
  startHandle.className = 'chat-clip-handle start';

  var endHandle = document.createElement('div');
  endHandle.className = 'chat-clip-handle end';

  overlay.appendChild(startHandle);
  overlay.appendChild(endHandle);
  content.style.position = 'relative';
  content.appendChild(overlay);

  // Drag state
  var _dragging = null; // 'start' or 'end'
  var _startY = 0;
  var _origTop = 0;
  var _origBottom = 0;

  function onDragStart(e, which) {
    e.preventDefault();
    e.stopPropagation();
    _dragging = which;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    _startY = clientY;
    _origTop = parseInt(overlay.style.top, 10) || 0;
    _origBottom = _origTop + (parseInt(overlay.style.height, 10) || contentHeight);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  }

  function onDragMove(e) {
    if (!_dragging) return;
    e.preventDefault();
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var delta = clientY - _startY;

    if (_dragging === 'start') {
      var newTop = Math.max(0, Math.min(_origTop + delta, _origBottom - 20));
      overlay.style.top = newTop + 'px';
      overlay.style.height = (_origBottom - newTop) + 'px';
    } else {
      var newBottom = Math.max(parseInt(overlay.style.top, 10) + 20, Math.min(_origBottom + delta, contentHeight));
      overlay.style.height = (newBottom - parseInt(overlay.style.top, 10)) + 'px';
    }
  }

  function onDragEnd() {
    _dragging = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
  }

  startHandle.addEventListener('mousedown', function(e) { onDragStart(e, 'start'); });
  startHandle.addEventListener('touchstart', function(e) { onDragStart(e, 'start'); }, { passive: false });
  endHandle.addEventListener('mousedown', function(e) { onDragStart(e, 'end'); });
  endHandle.addEventListener('touchstart', function(e) { onDragStart(e, 'end'); }, { passive: false });

  // Add export actions bar below content
  var actionsBar = document.createElement('div');
  actionsBar.className = 'chat-clip-actions';
  actionsBar.innerHTML = ''
    + '<button class="clip-cancel" onclick="exitClipMode(this.closest(\'.conversation-message\'))"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel</button>'
    + '<button class="clip-export-btn" data-action="copy"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy Clip</button>'
    + '<button data-action="pdf"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13h4M10 17h4M8 9h1"/></svg> PDF</button>'
    + '<button data-action="scribe"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/></svg> Scribe</button>'
    + '<button data-action="docx"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Word</button>';

  actionsBar.addEventListener('click', function(e) {
    var actionBtn = e.target.closest('button[data-action]');
    if (!actionBtn) return;
    var action = actionBtn.getAttribute('data-action');
    // Extract content within clip boundaries
    var clipResult = _extractClipContent(content, overlay);
    if (!clipResult.html && !clipResult.text) {
      showToast('No content in clipped region', 'warning');
      return;
    }
    exportSelectedContent(clipResult.html, clipResult.text, action);
    if (action !== 'copy') {
      exitClipMode(msgEl);
    }
  });

  // Insert clip actions before the standard chat-msg-actions
  var standardActions = bubble.querySelector('.chat-msg-actions');
  if (standardActions) {
    bubble.insertBefore(actionsBar, standardActions);
  } else {
    bubble.appendChild(actionsBar);
  }

  // Store references for cleanup
  msgEl._clipOverlay = overlay;
  msgEl._clipActions = actionsBar;
}

// v29.3: Extract HTML/text content from the clipped region based on overlay position
function _extractClipContent(content, overlay) {
  var clipTop = parseInt(overlay.style.top, 10) || 0;
  var clipBottom = clipTop + (parseInt(overlay.style.height, 10) || 0);
  var htmlParts = [];
  var textParts = [];

  // Walk through child elements of content and include those that overlap with the clip region
  var children = content.children;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    // Skip the overlay itself and checkboxes
    if (child.classList.contains('chat-clip-overlay')) continue;
    if (child.classList.contains('chat-section-check')) continue;

    var childTop = child.offsetTop;
    var childBottom = childTop + child.offsetHeight;

    // Check if child overlaps with clip region
    if (childBottom > clipTop && childTop < clipBottom) {
      htmlParts.push(child.outerHTML);
      textParts.push(child.textContent || child.innerText || '');
    }
  }

  return {
    html: htmlParts.join('\n'),
    text: textParts.join('\n\n')
  };
}

function exitClipMode(msgEl) {
  if (!msgEl) return;
  msgEl.classList.remove('chat-clip-mode');
  if (msgEl._clipOverlay && msgEl._clipOverlay.parentNode) {
    msgEl._clipOverlay.remove();
  }
  if (msgEl._clipActions && msgEl._clipActions.parentNode) {
    msgEl._clipActions.remove();
  }
  msgEl._clipOverlay = null;
  msgEl._clipActions = null;
  // Restore content position
  var content = msgEl.querySelector('.conversation-message-content');
  if (content) content.style.position = '';
  if (_clipActiveMsg === msgEl) _clipActiveMsg = null;
}

// v29.3: Exit clip mode on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && _clipActiveMsg) {
    exitClipMode(_clipActiveMsg);
  }
});
```

### Verification
1. Open Chat, get a long AI response with multiple paragraphs/sections
2. Click the scissors icon ("Clip") in the message action bar - clip mode should activate
3. Two horizontal handles should appear at the top and bottom of the message content
4. Drag the top handle down - the highlighted (gold overlay) region should shrink from the top
5. Drag the bottom handle up - region shrinks from the bottom
6. Click "Copy Clip" - should copy only the text content within the clip boundaries
7. Click "PDF" - should generate PDF with only clipped content
8. Click "Cancel" - clip mode should exit, overlay and actions removed
9. Press Escape - should also exit clip mode
10. Click scissors icon again to toggle clip mode off
11. Test on mobile: touch-drag handles should work
12. Verify clip tool works alongside section markers (both can exist on same message)

### Commit
`v29.3: Add clip tool with draggable boundaries for chat message content export`

---

## Task 5: Integration Polish & Edge Cases

### Files
- `src/js/core/20-ui-misc.js` (edge case handling)
- `src/js/core/11-agents.js` (guard for missing functions)

### Step 5.1: Guard `exportSelectedContent` against missing dependencies

**File:** `src/js/core/11-agents.js`

In `exportSelectedContent()`, wrap the `scribe` and `library` cases with existence checks:

```javascript
  if (format === 'scribe') {
    if (typeof saveContentToScribe === 'function') {
      saveContentToScribe(htmlContent, textContent);
    } else {
      showToast('Scribe is not available', 'error');
    }
    return;
  }
  if (format === 'library') {
    if (typeof openSaveConversationToLibrary === 'function') {
      window.pendingSaveContent = textContent;
      window.pendingSaveSource = 'selection';
      openSaveConversationToLibrary();
    } else {
      showToast('Library is not available', 'error');
    }
    return;
  }
  if (format === 'email') {
    if (typeof chatSendAsEmail !== 'function') {
      showToast('Email is not available', 'error');
      return;
    }
    // ... rest of email handler
  }
```

### Step 5.2: Hide selection toolbar when entering clip mode

**File:** `src/js/core/20-ui-misc.js`

At the top of `enterClipMode()`, add:

```javascript
  // v29.3: Hide selection toolbar if visible
  var selTb = document.querySelector('.chat-selection-toolbar.visible');
  if (selTb) selTb.classList.remove('visible');
```

### Step 5.3: Prevent selection toolbar from appearing during clip mode

**File:** `src/js/core/20-ui-misc.js`

In the selection toolbar IIFE's `_checkSelection()` function, add an early-out:

```javascript
  function _checkSelection() {
    // Don't show selection toolbar if clip mode is active
    if (_clipActiveMsg) { _hideSelToolbar(); return; }
    // ... rest of function
  }
```

### Step 5.4: Clean up clip mode on view switch

**File:** `src/js/core/20-ui-misc.js`

There is no explicit hook needed here. The `_clipActiveMsg` reference will become stale when the view switches (the DOM is hidden, not destroyed). When the user returns to chat and `renderConversation()` rebuilds the thread, `_clipActiveMsg` should be reset. Add at the top of `renderConversation()`:

```javascript
  // v29.3: Clean up any active clip mode
  if (_clipActiveMsg) {
    exitClipMode(_clipActiveMsg);
  }
```

### Verification
1. Enter clip mode, then try to highlight text - selection toolbar should NOT appear
2. Exit clip mode, highlight text - selection toolbar should appear again
3. Switch views away from Chat and back - no lingering clip overlay
4. Test with a very short message (1-2 lines) - clip tool should still work
5. Test all three features back to back on same message
6. Test the "Save to Scribe" flow end to end: select text > click Scribe > navigate to Scribe view > verify notebook exists with correct content

### Commit
`v29.3: Polish chat content export edge cases and cross-feature interactions`

---

## Summary of All Changes

| File | Changes |
|------|---------|
| `src/css/core/01-base.css` | Selection toolbar CSS, section marker CSS, clip mode CSS |
| `src/js/core/11-agents.js` | `exportSelectedContent()` shared routing function |
| `src/js/core/14-calendar.js` | `saveContentToScribe()` Scribe integration |
| `src/js/core/20-ui-misc.js` | Selection toolbar IIFE, `_addSectionMarkers()`, `_updateSectionExportBar()`, `enterClipMode()`, `_extractClipContent()`, `exitClipMode()`, scissors button in both action bar paths, section marker call in both `appendStreamingMsgActions()` and `renderConversation()` |

**Execution order:** Task 1 (shared utility) > Task 2 (selection toolbar) > Task 3 (section markers) > Task 4 (clip tool) > Task 5 (polish). Each task is independently deployable after Task 1.
