# v29.2: Pulse Sync + Scribe Editor + UI Polish - Design Spec

> **Scope:** Bug fixes for Pulse goals Firebase sync, Pulse goal creation UX, Scribe notebook editor (TinyMCE), Pulse UI spacing polish. Analytics KPI dashboard deferred to separate spec.

---

## Fix 1: Pulse Goals Not Syncing to Firebase (Critical)

### Root Cause

After the v28.8 Focus+Pulse merge, Pulse goals are not uploading to Firebase. The Sync inventory shows "Pulse Goals: 0 local, 0 cloud, Empty."

**Three issues found:**

1. **Sync inventory localCount doesn't handle wrapper format.** The `localCount()` function does `JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]').length`. If the stored data is in a `{ data: [...] }` wrapper format (used by v4 sync), `.length` returns `undefined` → treated as 0. The pull path in `loadFromFirebaseV2` handles both formats, but the inventory display does not.

2. **`saveInlineGoal()` missing `_modifiedAt` timestamp.** New goals created via Quick Goal don't get `_modifiedAt` stamped before being added to the array. While `savePulseGoals()` backfills missing `_modifiedAt`, the backfill only fires `if (!g._modifiedAt)` — it sets it to `now` but doesn't update it on subsequent edits. This means goals created in the same session may share timestamps, causing merge ambiguity.

3. **`shouldSyncCategory('goals')` gate.** If the user's sync mode doesn't include goals, the entire sync path is blocked. Need to verify this isn't the blocker — but the write-through path in `savePulseGoals()` calls `writeDB()` directly, which should bypass the category gate.

### Fix

1. **Sync inventory**: Update `localCount` for Pulse Goals to handle both array and `{ data: [...] }` wrapper formats. Also handle stringified JSON.

2. **`saveInlineGoal()`**: Stamp `_modifiedAt: Date.now()` on the new goal object before `pulseGoals.unshift()`.

3. **`savePulseGoals()` backfill**: Always re-stamp `_modifiedAt` on the goal when ANY item changes (not just when missing). Currently the backfill is `if (!g._modifiedAt) g._modifiedAt = now` — this should remain as-is for the goal-level stamp (we don't want to clobber item-level precision), but every function that modifies a goal should explicitly set `goal._modifiedAt = Date.now()` before calling `savePulseGoals()`.

4. **Verify write-through path**: Confirm that `writeDB('pulse/main', { goals: pulseGoals }, { category: 'goals' })` is actually executing (not silently failing due to auth or category gate).

### Files
- `src/js/core/25-documents-lifeai.js` — `saveInlineGoal()`, `savePulseGoals()`, `addItemToGoal()`, `deleteGoalItem()`, `togglePulseChecklistItem()`, `editTaskInline()`
- `src/js/core/29-analytics-commerce.js` — Sync inventory `localCount` for Pulse Goals

---

## Fix 2: Goal Creation Causes Existing Goals to Become Non-Interactive

### Root Cause

When `createInlineGoal()` is active (user is typing a new goal), interacting with existing goals (checking items off, editing, etc.) triggers `savePulseGoals()` → `renderPulse3Checklists()` → `container.innerHTML = html`. This full DOM replacement **destroys the inline goal creation card** mid-edit, causing the user's in-progress goal to vanish.

### Fix

**Preserve inline goal state across re-renders:**

1. Before `renderPulse3Checklists()` runs `container.innerHTML = html`, check if `.pulse-3-inline-goal` exists in the DOM.
2. If it does, capture its state (title input value, any added task inputs and their values).
3. After `innerHTML` replacement, re-inject the inline goal card at the top with preserved values.

**Alternative (simpler):** When an inline goal card is active, suppress full re-renders. Instead, update only the specific goal card that changed (toggle checkbox, delete item) via targeted DOM manipulation rather than full `innerHTML` replacement. Set a flag like `window._pulseInlineGoalActive = true` that `renderPulse3Checklists()` checks — if active, do a minimal targeted update instead of full rebuild.

**Recommendation:** Use the flag approach. It's simpler and avoids the complexity of state capture/restore. The flag gets cleared when the inline goal is saved or cancelled.

### Implementation

```
createInlineGoal():
  window._pulseInlineGoalActive = true;
  // ... existing code

saveInlineGoal() / cancel:
  window._pulseInlineGoalActive = false;
  // ... existing code, then full re-render

togglePulseChecklistItem(goalId, itemId):
  // ... toggle the item
  savePulseGoals();  // save to storage
  if (window._pulseInlineGoalActive) {
    // Targeted update: just toggle the checkbox visually + update progress
    updateGoalCardInPlace(goalId);
  } else {
    renderPulse3Checklists();  // full re-render
  }
```

Apply same pattern to: `editTaskInline()`, `deleteGoalItem()`, `addItemToGoal()`, `toggleGoalCollapse()`.

### Files
- `src/js/core/25-documents-lifeai.js` — `createInlineGoal()`, `saveInlineGoal()`, `renderPulse3Checklists()`, and all goal mutation functions

---

## Fix 3: Pulse UI Polish — Spacing + Button Placement

### Issue A: Last Goal Card Extra Spacing

The last item in each goal card has extra space before the action buttons. This is likely caused by `.pulse-3-checklist-items` having `padding-bottom: 20px` while the action buttons div `.pulse-3-checklist-actions` also has `padding-top`.

### Fix A

Remove bottom padding from `.pulse-3-checklist-items` (or reduce it) and ensure consistent spacing between items and the actions bar. The actions bar's own top padding provides the gap.

### Issue B: Action Buttons Should Be at Bottom of Each Card

Currently, "Add Item", "Import", "AI Tasks", "Delete", and "Mark Complete" buttons sit inside the card flow. They should be pinned to the bottom of each card so all cards have a uniform look regardless of how many items they contain.

### Fix B

Make each `.pulse-3-checklist-card` a flex column with the actions bar pushed to the bottom:

```css
.pulse-3-checklist-card {
  display: flex;
  flex-direction: column;
}
.pulse-3-checklist-items {
  flex: 1;
}
.pulse-3-checklist-actions {
  margin-top: auto;
}
```

This ensures the actions bar always sits at the card bottom, regardless of item count. Cards in the same grid row will have aligned action bars.

### Files
- `src/css/core/01-base.css` — `.pulse-3-checklist-card`, `.pulse-3-checklist-items`, `.pulse-3-checklist-actions`

---

## Fix 4: Scribe Notebook — TinyMCE Editor + ID Fixes

### Root Cause: Non-Functional Editor

Multiple element ID mismatches between HTML and JS prevent the notebook editor from working:

| JS References | Actual HTML ID | Fix |
|---|---|---|
| `scribeContentEditable` | `scribeContentArea` | Update JS to match HTML |
| `scribeMetadataPanel` | `scribeMetadata` | Update JS to match HTML |
| `scribeKnowledgeToggle` | `scribeKnowledgeModeBtn` | Update JS to match HTML |
| `scribeEditorArea` | (doesn't exist) | Add element or remove reference |

### TinyMCE Integration

Replace the basic `contenteditable` div with TinyMCE for a full rich-text editing experience.

**CDN Load:**
```html
<script src="https://cdn.tiny.cloud/1/no-api-key/tinymce/7/tinymce.min.js"></script>
```

**Self-hosted, no API key.** TinyMCE 7 community edition works fully without an API key when self-hosted. Download and place in `dist/tinymce/`. Load via `<script src="/tinymce/tinymce.min.js">`. No registration, no branding banner, all users get the full editor immediately.

**Editor Configuration:**
```javascript
tinymce.init({
  selector: '#scribeContentArea',
  skin: 'oxide-dark',
  content_css: 'dark',
  height: '100%',
  menubar: false,
  statusbar: false,
  plugins: 'lists link image table code wordcount searchreplace fullscreen autolink autoresize preview',
  toolbar: 'undo redo | blocks | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright | bullist numlist outdent indent | link image table | code fullscreen | searchreplace wordcount',
  content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #e8e0d4; background: transparent; }',
  setup: function(editor) {
    editor.on('change keyup', function() {
      scheduleScribeAutoSave();
    });
  }
});
```

**Features included:**
- Full formatting: headers (blocks), bold, italic, underline, strikethrough
- Colors: text color, background color
- Alignment: left, center, right
- Lists: ordered, unordered, indent/outdent
- Links: insert/edit hyperlinks
- Images: insert images (paste, URL)
- Tables: full table support
- Code view: raw HTML editing
- Search & replace
- Word count
- Fullscreen editing mode
- Auto-resize to content

**Dark Theme:** TinyMCE ships with `oxide-dark` skin. We'll customize CSS variables to match RoweOS's color palette (bg `#1a1a1a`, text `#e8e0d4`, accent `var(--brand-accent)`).

**Data Flow:**
- On notebook select: `tinymce.get('scribeContentArea').setContent(notebook.content)`
- On auto-save: `notebook.content = tinymce.get('scribeContentArea').getContent()`
- On notebook switch: save current, then `setContent()` with new notebook's content
- Content stored as HTML string in `notebook.content`

### Desktop Top Cutoff Fix

The `.scribe-layout` uses `height: calc(100vh - 160px)` which may not account for the actual header height (breadcrumb + title + description). Adjust to use the actual header measurement or switch to flex-based layout.

**Fix:** Make the Scribe panel a flex column. The header content gets natural height, the `.scribe-layout` gets `flex: 1; min-height: 0; overflow: hidden`.

### "Add New Notebook" Button Fix

The `createScribeNotebook()` function itself works (creates notebook, saves to localStorage + Firebase). The issue is that after creation, `selectScribeNotebook()` tries to populate `scribeContentEditable` which doesn't exist → content area stays blank → appears like nothing happened.

Once the ID mismatches are fixed and TinyMCE is integrated, the flow will work: create notebook → select it → TinyMCE initializes with empty content → user can type.

### Files
- `src/js/core/33-scribe.js` — Fix element ID references, integrate TinyMCE init/setContent/getContent
- `src/html/shared/30-scribe.html` — Ensure element IDs are consistent, add TinyMCE container
- `src/html/head/01-head.html` — Add TinyMCE script tag (or self-host path)
- `src/css/core/01-base.css` — TinyMCE dark theme overrides, scribe-layout flex fix
- `dist/tinymce/` — Self-hosted TinyMCE 7 community files (if self-hosting)

---

## Deferred: Analytics KPI Dashboard Overhaul

Full Analytics dashboard redesign is tracked in the Phase 1 AI Ops spec (`2026-04-16-phase1-ai-ops-platform-design.md`). Will be addressed in a dedicated session — not part of this v29.2 scope.

Key goals for that work:
- Real KPI cards with actual business metrics
- Revenue/expense tracking integration
- Client activity metrics
- Social media performance roll-up
- Brand health scoring

---

## Implementation Order

1. **Pulse sync fix** (highest priority — data not reaching cloud)
2. **Pulse goal creation UX** (goals disappearing during creation)
3. **Pulse UI polish** (spacing + button placement)
4. **Scribe ID fixes + TinyMCE** (new feature enablement)

---

## Open Questions

1. **TinyMCE hosting:** Self-hosted, no API key. ~2MB in dist/tinymce/. Confirmed.
2. **TinyMCE plugins:** The list above covers the essentials. Add `media` plugin for video embeds? `emoticons`? `charmap`? Or keep it focused?
3. **Notebook export:** TinyMCE content is HTML. Export to PDF/DOCX can reuse existing Studio document export. Include in this scope or defer?
