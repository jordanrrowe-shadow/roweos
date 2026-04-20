# v29.2: Pulse Sync + Scribe Editor + UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Pulse goals Firebase sync, fix goal creation UX (goals disappearing), polish Pulse card spacing/button layout, and make Scribe notebook fully functional with TinyMCE rich editor.

**Architecture:** Four independent fixes sharing two source files. Pulse fixes are in `25-documents-lifeai.js` (goals JS) and `29-analytics-commerce.js` (sync inventory). Scribe fixes are in `33-scribe.js` (editor JS) and `30-scribe.html` (view HTML). CSS changes in `01-base.css`. TinyMCE self-hosted in `dist/tinymce/`.

**Tech Stack:** Vanilla JS (ES5), TinyMCE 7 Community (self-hosted, no API key), Firebase Firestore write-through sync.

---

### Task 1: Fix Pulse Goals Firebase Sync

**Files:**
- Modify: `src/js/core/25-documents-lifeai.js:10040-10050` (saveInlineGoal)
- Modify: `src/js/core/29-analytics-commerce.js:1008` (sync inventory localCount)

- [ ] **Step 1: Fix `saveInlineGoal()` missing `_modifiedAt`**

In `src/js/core/25-documents-lifeai.js`, at line 10040 inside `saveInlineGoal()`, the `newGoal` object is missing `_modifiedAt`. Add it:

```javascript
// Find this block (line ~10040):
  var newGoal = {
    id: 'goal_' + Date.now(),
    title: title,
    items: items,
    sections: null,
    createdAt: new Date().toISOString(),
    source: currentMode === 'life' ? 'lifeai' : 'manual',
    archived: false,
    completed: false
  };

// Replace with:
  var newGoal = {
    id: 'goal_' + Date.now(),
    title: title,
    items: items,
    sections: null,
    createdAt: new Date().toISOString(),
    source: currentMode === 'life' ? 'lifeai' : 'manual',
    archived: false,
    completed: false,
    _modifiedAt: Date.now()  // v29.2: Stamp for Firebase sync merge
  };
```

- [ ] **Step 2: Fix sync inventory `localCount` for Pulse Goals**

In `src/js/core/29-analytics-commerce.js`, at line 1008, the `localCount` function doesn't handle wrapper formats. Replace:

```javascript
// Find (line 1008):
    { name: 'Pulse Goals', syncKey: 'goals', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]').length; } catch(e) { return 0; } } },

// Replace with:
    { name: 'Pulse Goals', syncKey: 'goals', localCount: function() { try { var raw = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]'); if (Array.isArray(raw)) return raw.length; if (raw && Array.isArray(raw.data)) return raw.data.length; if (raw && Array.isArray(raw.goals)) return raw.goals.length; return 0; } catch(e) { return 0; } } },
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh`
Expected: Clean build, no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/jordanrowe/Developer/roweOS
git add src/js/core/25-documents-lifeai.js src/js/core/29-analytics-commerce.js
git commit -m "fix(pulse): stamp _modifiedAt on new goals + fix sync inventory count

v29.2: saveInlineGoal() now stamps _modifiedAt for Firebase merge support.
Sync inventory localCount handles wrapper formats (data/goals)."
```

---

### Task 2: Fix Goal Creation UX (Inline Goal Survives Re-renders)

**Files:**
- Modify: `src/js/core/25-documents-lifeai.js:9964` (createInlineGoal)
- Modify: `src/js/core/25-documents-lifeai.js:10015` (saveInlineGoal)
- Modify: `src/js/core/25-documents-lifeai.js:8571` (renderPulse3Checklists)
- Modify: `src/js/core/25-documents-lifeai.js:8731` (togglePulseChecklistItem)
- Modify: `src/js/core/25-documents-lifeai.js:9622` (deleteGoalItem)

- [ ] **Step 1: Add inline goal active flag to `createInlineGoal()`**

In `src/js/core/25-documents-lifeai.js`, add flag at the start of `createInlineGoal()` (after line 9964):

```javascript
// Find (line 9964-9968):
function createInlineGoal() {
  var container = document.getElementById('pulse3Checklists');
  if (!container) return;
  // Don't add twice
  if (container.querySelector('.pulse-3-inline-goal')) return;

// Replace with:
function createInlineGoal() {
  var container = document.getElementById('pulse3Checklists');
  if (!container) return;
  // Don't add twice
  if (container.querySelector('.pulse-3-inline-goal')) return;
  window._pulseInlineGoalActive = true; // v29.2: Suppress full re-renders while creating
```

- [ ] **Step 2: Clear flag in `saveInlineGoal()` and cancel handler**

In `src/js/core/25-documents-lifeai.js`, update `saveInlineGoal()` at line 10015 to clear the flag before re-rendering:

```javascript
// Find (line 10051-10055):
  pulseGoals.unshift(newGoal);
  savePulseGoals();
  renderPulse3Overview();
  renderPulse3Checklists();
  showToast('Goal created!', 'success');

// Replace with:
  pulseGoals.unshift(newGoal);
  savePulseGoals();
  window._pulseInlineGoalActive = false; // v29.2: Clear before re-render
  renderPulse3Overview();
  renderPulse3Checklists();
  showToast('Goal created!', 'success');
```

Also update the Cancel button in `createInlineGoal()` to clear the flag:

```javascript
// Find (line 9977):
      '<button class="pulse-3-btn pulse-3-btn-secondary" onclick="this.closest(\'.pulse-3-inline-goal\').remove()">Cancel</button>' +

// Replace with:
      '<button class="pulse-3-btn pulse-3-btn-secondary" onclick="window._pulseInlineGoalActive=false;this.closest(\'.pulse-3-inline-goal\').remove()">Cancel</button>' +
```

- [ ] **Step 3: Add `updateGoalCardInPlace()` helper function**

Add this new function right after `renderPulse3Checklists()` (after line 8716):

```javascript
// v29.2: Targeted in-place update for a single goal card (used when inline goal is active)
function updateGoalCardInPlace(goalId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;
  var card = document.querySelector('.pulse-3-checklist-card[data-goal-id="' + goalId + '"]');
  if (!card) return;

  // Update checkboxes
  var allItems = [];
  if (goal.sections && goal.sections.length > 0) {
    goal.sections.forEach(function(s) { if (s.items) allItems = allItems.concat(s.items); });
  }
  if ((!goal.sections || goal.sections.length === 0) && goal.items) {
    allItems = allItems.concat(goal.items);
  }

  allItems.forEach(function(item) {
    var checkboxEl = card.querySelector('.pulse-3-checkbox[onclick*="\\'" + item.id + "\\'"]');
    if (!checkboxEl) return;
    if (item.completed) {
      checkboxEl.classList.add('checked');
    } else {
      checkboxEl.classList.remove('checked');
    }
    var textEl = checkboxEl.nextElementSibling;
    if (textEl) {
      if (item.completed) {
        textEl.classList.add('completed');
      } else {
        textEl.classList.remove('completed');
      }
    }
  });

  // Update progress bar
  var total = allItems.length;
  var completed = allItems.filter(function(i) { return i.completed; }).length;
  var pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  var fillEl = card.querySelector('.pulse-3-checklist-progress-fill');
  if (fillEl) fillEl.style.width = pct + '%';
  var pctText = card.querySelector('.pulse-3-checklist-progress-text');
  if (pctText) pctText.textContent = pct + '%';
}
```

- [ ] **Step 4: Guard `togglePulseChecklistItem()` re-render**

In `src/js/core/25-documents-lifeai.js`, update the end of `togglePulseChecklistItem()` (line ~8774-8776):

```javascript
// Find (line 8774-8776):
  savePulseGoals();
  renderPulse3Overview();
  renderPulse3Checklists();

// Replace with:
  savePulseGoals();
  renderPulse3Overview();
  if (window._pulseInlineGoalActive) {
    updateGoalCardInPlace(goalId); // v29.2: Don't wipe inline goal card
  } else {
    renderPulse3Checklists();
  }
```

- [ ] **Step 5: Guard `deleteGoalItem()` re-render**

In `src/js/core/25-documents-lifeai.js`, update the end of `deleteGoalItem()` (line ~9636-9638):

```javascript
// Find (line 9636-9638):
  savePulseGoals();
  renderPulse3Overview();
  renderPulse3Checklists();

// Replace with:
  savePulseGoals();
  renderPulse3Overview();
  if (window._pulseInlineGoalActive) {
    // v29.2: Remove item from DOM directly instead of full re-render
    var delCard = document.querySelector('.pulse-3-checklist-card[data-goal-id="' + goalId + '"]');
    if (delCard) {
      var delItem = delCard.querySelector('.pulse-3-checklist-item .pulse-3-item-delete[onclick*="\\'" + itemId + "\\'"]');
      if (delItem && delItem.closest('.pulse-3-checklist-item')) {
        delItem.closest('.pulse-3-checklist-item').remove();
      }
    }
    updateGoalCardInPlace(goalId);
  } else {
    renderPulse3Checklists();
  }
```

- [ ] **Step 6: Build and verify**

Run: `cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh`
Expected: Clean build, no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/jordanrowe/Developer/roweOS
git add src/js/core/25-documents-lifeai.js
git commit -m "fix(pulse): preserve inline goal during existing goal interactions

v29.2: Flag-based approach suppresses full re-renders while inline goal
creation is active. Checkbox toggles and item deletes use targeted DOM
updates instead of innerHTML replacement."
```

---

### Task 3: Pulse UI Polish (Spacing + Button Placement)

**Files:**
- Modify: `src/css/core/01-base.css:19570` (.pulse-3-checklist-card)
- Modify: `src/css/core/01-base.css:19639` (.pulse-3-checklist-items)
- Modify: `src/css/core/01-base.css:19709` (.pulse-3-checklist-actions)

- [ ] **Step 1: Make checklist cards flex column with bottom-aligned actions**

In `src/css/core/01-base.css`, update `.pulse-3-checklist-card` at line 19570:

```css
/* Find (line 19570-19575): */
    .pulse-3-checklist-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-xl);
      overflow: hidden;
    }

/* Replace with: */
    .pulse-3-checklist-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-xl);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
```

- [ ] **Step 2: Make items section flex-grow and fix bottom padding**

In `src/css/core/01-base.css`, update `.pulse-3-checklist-items` at line 19639:

```css
/* Find (line 19639-19641): */
    .pulse-3-checklist-items {
      padding: 12px 20px 20px;
    }

/* Replace with: */
    .pulse-3-checklist-items {
      padding: 12px 20px 8px;
      flex: 1;
    }
```

- [ ] **Step 3: Push actions bar to bottom with margin-top auto**

In `src/css/core/01-base.css`, update `.pulse-3-checklist-actions` at line 19709:

```css
/* Find (line 19709-19716): */
    .pulse-3-checklist-actions {
      padding: 12px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      gap: var(--space-2);
      /* v13.9: Wrap on mobile so buttons don't overflow */
      flex-wrap: wrap;
    }

/* Replace with: */
    .pulse-3-checklist-actions {
      padding: 12px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      gap: var(--space-2);
      /* v13.9: Wrap on mobile so buttons don't overflow */
      flex-wrap: wrap;
      margin-top: auto;
    }
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh`
Expected: Clean build, no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/jordanrowe/Developer/roweOS
git add src/css/core/01-base.css
git commit -m "fix(pulse): unify goal card spacing and bottom-align action buttons

v29.2: Cards use flex column layout. Actions bar pinned to bottom via
margin-top:auto for uniform appearance across cards. Fixed extra spacing
on last item by reducing items container bottom padding."
```

---

### Task 4: Fix Scribe Element ID Mismatches

**Files:**
- Modify: `src/js/core/33-scribe.js:81,247,257,281,308,326,511` (all mismatched IDs)

- [ ] **Step 1: Fix `scribeEditorArea` references to `scribeActiveEditor`**

The HTML has `id="scribeActiveEditor"` (line 38 of 30-scribe.html) but JS references `scribeEditorArea`. Fix both occurrences:

In `src/js/core/33-scribe.js`:

```javascript
// Find (line 81):
  var editorArea = document.getElementById('scribeEditorArea');

// Replace with:
  var editorArea = document.getElementById('scribeActiveEditor');

// Find (line 247):
  var editorArea = document.getElementById('scribeEditorArea');

// Replace with:
  var editorArea = document.getElementById('scribeActiveEditor');
```

- [ ] **Step 2: Fix `scribeContentEditable` references to `scribeContentArea`**

The HTML has `id="scribeContentArea"` (line 61 of 30-scribe.html) but JS references `scribeContentEditable`. Fix all three occurrences:

In `src/js/core/33-scribe.js`:

```javascript
// Find (line 257):
  var contentEl = document.getElementById('scribeContentEditable');

// Replace with:
  var contentEl = document.getElementById('scribeContentArea');

// Find (line 281):
  var contentEl = document.getElementById('scribeContentEditable');

// Replace with:
  var contentEl = document.getElementById('scribeContentArea');

// Find (line 308):
  var contentEl = document.getElementById('scribeContentEditable');

// Replace with:
  var contentEl = document.getElementById('scribeContentArea');
```

- [ ] **Step 3: Fix `scribeKnowledgeToggle` reference to `scribeKnowledgeModeBtn`**

In `src/js/core/33-scribe.js`:

```javascript
// Find (line 326):
  var toggleBtn = document.getElementById('scribeKnowledgeToggle');

// Replace with:
  var toggleBtn = document.getElementById('scribeKnowledgeModeBtn');
```

- [ ] **Step 4: Fix `scribeMetadataPanel` reference to `scribeMetadata`**

In `src/js/core/33-scribe.js`:

```javascript
// Find (line 511):
  var metaEl = document.getElementById('scribeMetadataPanel');

// Replace with:
  var metaEl = document.getElementById('scribeMetadata');
```

- [ ] **Step 5: Build and verify**

Run: `cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh`
Expected: Clean build, no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/jordanrowe/Developer/roweOS
git add src/js/core/33-scribe.js
git commit -m "fix(scribe): correct element ID mismatches breaking editor

v29.2: JS referenced scribeEditorArea/scribeContentEditable/
scribeKnowledgeToggle/scribeMetadataPanel but HTML uses
scribeActiveEditor/scribeContentArea/scribeKnowledgeModeBtn/
scribeMetadata. Editor, metadata, and knowledge mode now functional."
```

---

### Task 5: Integrate TinyMCE Rich Editor into Scribe

**Files:**
- Download: TinyMCE 7 Community → `RoweOS/dist/tinymce/`
- Modify: `src/html/core/01-cdn-and-boot.html` (add script tag)
- Modify: `src/html/shared/30-scribe.html:39-61` (replace toolbar + contenteditable)
- Modify: `src/js/core/33-scribe.js:237,275,279-290,292-316` (TinyMCE init/get/set)
- Modify: `src/css/core/01-base.css` (TinyMCE dark theme overrides, layout fix)

- [ ] **Step 1: Download and self-host TinyMCE 7**

```bash
cd /Users/jordanrowe/Developer/roweOS/RoweOS/dist
curl -L "https://download.tiny.cloud/tinymce/community/tinymce_7.6.1.zip" -o tinymce.zip
unzip -q tinymce.zip -d tinymce_temp
mv tinymce_temp/tinymce/js/tinymce tinymce
rm -rf tinymce_temp tinymce.zip
```

If the CDN download URL doesn't work, alternative:

```bash
cd /tmp && npm pack tinymce@7 && tar -xzf tinymce-7.*.tgz
cp -r package/tinymce /Users/jordanrowe/Developer/roweOS/RoweOS/dist/tinymce
rm -rf package tinymce-7.*.tgz
```

Verify: `ls /Users/jordanrowe/Developer/roweOS/RoweOS/dist/tinymce/tinymce.min.js` should exist.

- [ ] **Step 2: Add TinyMCE script tag**

In `src/html/core/01-cdn-and-boot.html`, add after Three.js (line 27):

```html
  <!-- v29.2: TinyMCE 7 for Scribe rich text editor (self-hosted, no API key) -->
  <script src="/tinymce/tinymce.min.js"></script>
```

- [ ] **Step 3: Replace Scribe editor toolbar and content area with TinyMCE container**

In `src/html/shared/30-scribe.html`, replace the toolbar and contenteditable area (lines 40-61) with a TinyMCE target:

```html
<!-- Find (lines 40-61):
                <div class="scribe-editor-toolbar" id="scribeToolbar">
                  ... all toolbar buttons ...
                </div>
                <div class="scribe-content-area" id="scribeContentArea" contenteditable="true" oninput="onScribeContentChange()"></div>
-->

<!-- Replace with: -->
                <div class="scribe-editor-toolbar" id="scribeToolbar">
                  <button onclick="toggleScribeKnowledgeMode()" id="scribeKnowledgeModeBtn" title="Toggle Knowledge Mode" style="display:flex;align-items:center;gap:4px;margin-left:auto;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    <span style="font-size:11px;">Knowledge</span>
                  </button>
                </div>
                <div class="scribe-tinymce-wrap" id="scribeTinymceWrap">
                  <textarea id="scribeContentArea" style="visibility:hidden;"></textarea>
                </div>
```

Note: TinyMCE replaces the `<textarea>` with its own iframe editor. The Knowledge mode button stays in the simplified toolbar above. All formatting is handled by TinyMCE's own toolbar.

- [ ] **Step 4: Rewrite `selectScribeNotebook()` for TinyMCE**

In `src/js/core/33-scribe.js`, replace the content population block in `selectScribeNotebook()` (lines 256-258):

```javascript
// Find (line 256-258, after fixing IDs in Task 4):
  // v29.0: Populate content
  var contentEl = document.getElementById('scribeContentArea');
  if (contentEl) contentEl.innerHTML = nb.content || '';

// Replace with:
  // v29.2: Populate TinyMCE content
  var tinymceEditor = tinymce.get('scribeContentArea');
  if (tinymceEditor) {
    tinymceEditor.setContent(nb.content || '');
  }
```

- [ ] **Step 5: Rewrite `saveActiveScribeNotebook()` for TinyMCE**

In `src/js/core/33-scribe.js`, replace the content read in `saveActiveScribeNotebook()` (lines 307-311):

```javascript
// Find (line 307-311, after fixing IDs in Task 4):
  var titleInput = document.getElementById('scribeTitleInput');
  var contentEl = document.getElementById('scribeContentArea');

  if (titleInput) nb.title = titleInput.value || 'Untitled Notebook';
  if (contentEl) nb.content = contentEl.innerHTML || '';

// Replace with:
  var titleInput = document.getElementById('scribeTitleInput');
  var tinymceEditor = tinymce.get('scribeContentArea');

  if (titleInput) nb.title = titleInput.value || 'Untitled Notebook';
  if (tinymceEditor) nb.content = tinymceEditor.getContent() || '';
```

- [ ] **Step 6: Remove old `scribeExecCmd()` and `scribeInsertLink()` functions**

In `src/js/core/33-scribe.js`, delete the old formatting functions (lines 279-290) since TinyMCE handles all formatting:

```javascript
// DELETE these functions (lines 279-290):
function scribeExecCmd(cmd) { // v29.0:
  document.execCommand(cmd, false, null);
  var contentEl = document.getElementById('scribeContentEditable');
  if (contentEl) contentEl.focus();
}

function scribeInsertLink() { // v29.0:
  var url = prompt('Enter URL:');
  if (url) {
    document.execCommand('createLink', false, url);
  }
}
```

- [ ] **Step 7: Add TinyMCE initialization function**

In `src/js/core/33-scribe.js`, add this function after the `initScribe()` function (after line ~77):

```javascript
// v29.2: Initialize TinyMCE for Scribe editor
var _scribeTinymceReady = false;

function initScribeTinymce() {
  if (_scribeTinymceReady) return;
  if (typeof tinymce === 'undefined') return;

  tinymce.init({
    selector: '#scribeContentArea',
    skin: 'oxide-dark',
    content_css: 'dark',
    height: '100%',
    min_height: 400,
    menubar: false,
    statusbar: true,
    branding: false,
    promotion: false,
    resize: false,
    plugins: 'lists link image table code wordcount searchreplace fullscreen autolink autoresize preview',
    toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | hr blockquote | code fullscreen searchreplace wordcount',
    toolbar_mode: 'wrap',
    content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; color: #e8e0d4; background: #1a1816; line-height: 1.7; padding: 16px; } a { color: #a89878; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #333; padding: 8px; } blockquote { border-left: 3px solid #a89878; margin: 12px 0; padding: 8px 16px; opacity: 0.85; } img { max-width: 100%; height: auto; } code { background: rgba(168,152,120,0.15); padding: 2px 6px; border-radius: 4px; font-family: monospace; } pre { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; overflow-x: auto; }',
    setup: function(editor) {
      editor.on('change keyup', function() {
        scheduleScribeAutoSave();
      });
      editor.on('init', function() {
        _scribeTinymceReady = true;
        // v29.2: If a notebook was selected before TinyMCE was ready, load its content now
        if (_scribeActiveId) {
          var nb = null;
          for (var i = 0; i < scribeNotebooks.length; i++) {
            if (scribeNotebooks[i].id === _scribeActiveId) { nb = scribeNotebooks[i]; break; }
          }
          if (nb) editor.setContent(nb.content || '');
        }
      });
    }
  });
}
```

- [ ] **Step 8: Call `initScribeTinymce()` from `initScribe()`**

In `src/js/core/33-scribe.js`, add the TinyMCE init call at the end of `initScribe()`:

```javascript
// Find the end of initScribe() function. After the existing init logic, before the closing brace, add:
  // v29.2: Initialize TinyMCE rich editor
  initScribeTinymce();
```

Look for the `initScribe()` function definition and add the call before its closing `}`.

- [ ] **Step 9: Remove old `onScribeContentChange()` function reference**

The `oninput="onScribeContentChange()"` was on the old contenteditable div which is now replaced with a textarea. TinyMCE handles change events via its `setup` callback. The `onScribeContentChange()` function at line 275 can stay as-is (it just calls `scheduleScribeAutoSave()`), but it's no longer called from HTML. No change needed - TinyMCE's setup callback calls `scheduleScribeAutoSave()` directly.

- [ ] **Step 10: Fix Scribe layout height for desktop**

In `src/css/core/01-base.css`, find the `.scribe-layout` desktop styles and fix the height calculation. Add these overrides near the existing scribe styles:

```css
/* Find the existing scribe-layout desktop rule and update it.
   Search for ".scribe-layout" near line 46925-46935. */

/* If it currently says: */
    .scribe-layout {
      height: calc(100vh - 160px);
    }

/* Replace with: */
    .scribe-layout {
      height: calc(100vh - 160px);
      min-height: 500px;
    }
```

Also add TinyMCE dark theme overrides near the scribe styles:

```css
/* v29.2: TinyMCE dark theme overrides for Scribe */
.scribe-tinymce-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.scribe-tinymce-wrap .tox.tox-tinymce {
  border: none !important;
  border-radius: 0 !important;
}
.scribe-tinymce-wrap .tox .tox-toolbar__primary {
  background: var(--bg-secondary) !important;
  border-bottom: 1px solid var(--border-color) !important;
}
.scribe-tinymce-wrap .tox .tox-toolbar__group {
  border-right-color: var(--border-color) !important;
}
.scribe-tinymce-wrap .tox .tox-tbtn {
  color: var(--text-secondary) !important;
}
.scribe-tinymce-wrap .tox .tox-tbtn:hover {
  background: var(--bg-tertiary) !important;
  color: var(--text-primary) !important;
}
.scribe-tinymce-wrap .tox .tox-tbtn--enabled,
.scribe-tinymce-wrap .tox .tox-tbtn--enabled:hover {
  background: rgba(168,152,120,0.2) !important;
  color: var(--accent) !important;
}
.scribe-tinymce-wrap .tox .tox-statusbar {
  background: var(--bg-secondary) !important;
  border-top: 1px solid var(--border-color) !important;
  color: var(--text-muted) !important;
}
.scribe-tinymce-wrap .tox .tox-statusbar__text-container {
  color: var(--text-muted) !important;
}
/* v29.2: Make scribe-active-editor flex column for TinyMCE */
.scribe-active-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.scribe-active-editor .scribe-title-input {
  flex-shrink: 0;
}
.scribe-active-editor .scribe-editor-toolbar {
  flex-shrink: 0;
}
.scribe-active-editor .scribe-tinymce-wrap {
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 11: Build and verify**

Run: `cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh`
Expected: Clean build, no errors.

- [ ] **Step 12: Commit**

```bash
cd /Users/jordanrowe/Developer/roweOS
git add src/js/core/33-scribe.js src/html/shared/30-scribe.html src/html/core/01-cdn-and-boot.html src/css/core/01-base.css
git commit -m "feat(scribe): integrate TinyMCE 7 rich text editor

v29.2: Replace basic contenteditable with self-hosted TinyMCE 7.
Full formatting: headers, bold/italic/underline/strike, colors,
lists, links, images, tables, code view, search/replace, word count,
fullscreen. Dark theme styled to match RoweOS. No API key required."
```

---

### Task 6: Version Bump + Build + Final Verification

**Files:**
- Modify: Version string in all 8 locations (per CLAUDE.md rules)

- [ ] **Step 1: Update version from v29.1 to v29.2**

Find all 8 version locations and update them. The JS constant is in `src/js/core/08-foundation.js`. The 7 HTML locations are in various src/html files. Search for `29.1` in the src/ directory and update each to `29.2`.

Do NOT use `replace_all` on the version string - update each location individually.

- [ ] **Step 2: Final build**

```bash
cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh
```

- [ ] **Step 3: Verify TinyMCE files exist in dist**

```bash
ls /Users/jordanrowe/Developer/roweOS/RoweOS/dist/tinymce/tinymce.min.js
```

- [ ] **Step 4: Commit version bump**

```bash
cd /Users/jordanrowe/Developer/roweOS
git add -A
git commit -m "chore: bump version to v29.2"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Pulse sync: `_modifiedAt` + inventory count | 25-documents-lifeai.js, 29-analytics-commerce.js |
| 2 | Pulse UX: inline goal survives re-renders | 25-documents-lifeai.js |
| 3 | Pulse UI: flex cards, bottom-aligned actions | 01-base.css |
| 4 | Scribe: fix 4 element ID mismatches | 33-scribe.js |
| 5 | Scribe: TinyMCE 7 rich editor | 33-scribe.js, 30-scribe.html, 01-cdn-and-boot.html, 01-base.css |
| 6 | Version bump v29.1 → v29.2 | 8 locations |
