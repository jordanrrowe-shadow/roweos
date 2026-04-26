# RoweOS v31.0 — Info Signup Capture + GPT-5.5 / GPT Image 2 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six things together as v31.0:
1. roweos.com/info bottom signup form that captures name + email + UTM/IP/UA, sends admin notification email (matches the existing Welcome Screen template), and redirects to roweos.com with prefilled signup
2. RoweOS auth gate accepts `?email`, `?name`, `?source` URL params and prefills + auto-switches to "Create Account" mode
3. GPT-5.5 / GPT-5.5 Pro / GPT-5.5 Thinking everywhere `gpt-5.4*` lives today (487 references), with `reasoning_effort` exposed for Thinking variant
4. GPT Image 2 replaces the current GPT Image / DALL-E flow in `generateImage()`
5. Admin **Campaigns** dashboard built out (currently an empty `<div>`) showing aggregated email-response data with template/date filters and CSV export
6. Update advertising surfaces (purchase.html, info.html, onboarding provider step, send-template-email.js, sidebar/Settings model labels) to advertise the new GPT-5.5 family + GPT Image 2

**Architecture:**
- **Info source consolidation:** Move `/info` source out of the lost `roweos.website` Vercel project and into the main RoweOS repo as `RoweOS/dist/info.html`. Update `RoweOS/dist/vercel.json` to route `/info` → `info.html` instead of proxying to `roweoswebsite.vercel.app`. Single deploy, single source of truth, shares `/api/notify-signup`.
- **Signup capture:** Reuse existing `/api/notify-signup` endpoint with a new `source` value (`"Info Page Lead"`). Add a new collection `info_leads` for prospect-only data (separate from authenticated `signups`). On form submit, write the lead, send admin email, then 302 to `https://roweos.com/?email=...&name=...&source=info` so the auth gate prefills.
- **GPT-5.5 migration:** Add new model strings alongside (not replacing) `gpt-5.4*` so users with cached `preferredModel: 'gpt-5.4'` keep working. Add a `_normalizeModel()` shim in `13-studio.js` that maps old `gpt-5.4*` → `gpt-5.5*` on read. Make `gpt-5.5` the new default.
- **GPT Image 2:** Update the `image_generation` tool name + model parameter in `generateImage()` per the new endpoint. Keep DALL-E REST fallback only as a clearly labeled legacy path.
- **Campaigns dashboard:** Lives in already-existing `#adminTabCampaigns` div (line 62213 of `dist/index.html`, source in `src/html/brand/25-admin.html`). New file `src/js/core/25-admin-campaigns.js` contains all logic.
- **Advertising:** Pure copy/HTML edits. No logic changes.

**Tech Stack:** Vanilla ES5 JS (RoweOS standard), Vercel Serverless Functions, Resend, Firestore REST API + client SDK, table-based dark email templates. No new deps.

**Spec source:** This plan was generated directly from a user request on 2026-04-25 (no separate spec doc).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `RoweOS/dist/info.html` | Create | New `/info` promo page (modernized V3 + bottom signup form + GPT-5.5 advertising) |
| `RoweOS/dist/api/info-signup.js` | Create | Capture lead, write `info_leads` Firestore doc, fire admin email via `notify-signup` template, return 302 |
| `RoweOS/dist/api/notify-signup.js` | Modify | Add `"Info Page Lead"` source styling; expose `_renderSignupEmail(payload)` helper for reuse from `info-signup.js` |
| `RoweOS/dist/vercel.json` | Modify | Replace `/info` rewrite to external Vercel project with internal route to `/info.html`; add `/api/info-signup` function config |
| `src/js/core/22-firebase-sync.js` | Modify | (a) Add `_parseSignupURLParams()` and call it in `showAuthGate()` to prefill; (b) Mark cloud signup `source: 'Info Page Lead'` when URL `source=info` |
| `src/html/core/02-shell-batch1.html` | Modify | Wire `value=""` slots on `#authNameInput`, `#authEmailInput` so prefill works without flicker |
| `src/js/core/13-studio.js` | Modify | Add `_normalizeModel()` shim; expand thinking detection to `gpt-5.5-thinking`; expose `reasoning_effort` setting; update `web_search_preview` injection to `gpt-5.5*`; update default OpenAI model |
| `src/js/core/14-calendar.js` | Modify | Update `generateImage()` to use `gpt-image-2`; UI text "Generating with GPT Image 2..."; update Intelligence ops model preference to `gpt-5.5` |
| `src/js/core/10-sync.js` | Modify | Update Intelligence ops 1101-1113 `preferredModel` → `gpt-5.5`; comment header |
| `src/js/core/11-agents.js` | Modify | Update agent descriptions/recommendations from "GPT-5.4" to "GPT-5.5" |
| `src/js/core/24-lifeai-identity.js` | Modify | Update model registry, default, dropdown options, color codes |
| `src/js/core/21-sidebar.js` | Modify | Update sidebar model labels (brief + extended) |
| `src/js/core/27-launch-brandai.js` | Modify | Update BrandAI model name mapping |
| `src/js/core/29-analytics-commerce.js` | Modify | Update pricing table for `gpt-5.5*` (verify against OpenAI docs); update model display name mapping |
| `src/js/core/16-bloom.js` | Modify | Update Bloom default model + selection logic |
| `src/js/core/17-automations.js` | Modify | Update automations model array + default selection |
| `src/js/core/18-social.js` | Modify | Update social-automations model selection + thinking detection |
| `src/js/core/26-smart-suggestions-onboarding.js` | Modify | Update default + provider mapping |
| `src/js/core/30-automations-init.js` | Modify | Update post/social/email model lists, default, web-search-condition |
| `src/js/core/25-documents-lifeai.js` | Modify | Update document AI default OpenAI model |
| `src/js/core/20-ui-misc.js` | Modify | Update LifeAI/Studio default model selection |
| `src/js/core/23-offline.js` | Modify | Update offline model translation comment + map |
| `src/js/late/00-api-bridge.js` | Modify | Update conditional web-search injection to `gpt-5.5*` prefix |
| `src/html/core/03-views-batch2.html` | Modify | Update onboarding + secondary model dropdown options |
| `src/html/core/04-views-batch3.html` | Modify | Update onboarding model tags display (provider step) |
| `src/html/brand/02-studio.html` | Modify | Update Studio model selector dropdown items |
| `RoweOS/dist/purchase.html` | Modify | Update OpenAI section to GPT-5.5, GPT-5.5 Pro, GPT-5.5 Thinking; add GPT Image 2 mention |
| `RoweOS/dist/api/send-template-email.js` | Modify | Update OpenAI model list strings in template body |
| `src/html/brand/25-admin.html` | Modify | Add Campaigns dashboard markup to existing empty `#adminTabCampaigns` div |
| `src/js/core/25-admin-campaigns.js` | Create | All Campaigns dashboard logic (load, render, filter, export CSV) |
| `src/js/core/22-firebase-sync.js` (admin tab map) | Modify | Bind `adminLoadCampaigns` to `showAdminTab('campaigns')` (currently just toggles visibility) |
| `CLAUDE.md` | Modify | Bump version v30.4 → v31.0 |
| Six other version locations | Modify | See Phase 6 Task 6.1 |

---

## Phase 1 — GPT-5.5 Model Family Migration

**Why first:** Every other phase advertises these new models. Get the foundation right, then advertise it.

### Task 1.1: Add `_normalizeModel()` backwards-compat shim + Thinking-as-alias mapping

**Files:**
- Modify: `src/js/core/13-studio.js` (near top, before `callOpenAIStreaming`)

Why a shim: (a) ~10 active users have `preferredModel: 'gpt-5.4'` saved in localStorage / Firestore brand configs. Without normalization their next API call would 404. (b) **`gpt-5.5-thinking` is not a real OpenAI model** — it's a UI alias. The shim must map it to actual `gpt-5.5` at the API layer while UI keeps showing "Thinking" branding.

- [ ] **Step 1: Add shim functions**

Insert near the top of `13-studio.js` (above `isOpenAIThinkingModel`, around current line 4910):

```javascript
// v31.0: Backwards-compat shim — maps deprecated gpt-5.4* model IDs to gpt-5.5* UI labels
function _normalizeModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return modelId;
  if (modelId === 'gpt-5.4') return 'gpt-5.5';
  if (modelId === 'gpt-5.4-pro') return 'gpt-5.5-pro';
  if (modelId === 'gpt-5.4-thinking') return 'gpt-5.5-thinking';
  return modelId;
}

// v31.0: Resolve UI model label to actual OpenAI API model ID.
// "gpt-5.5-thinking" is a UI alias — at the API layer it's gpt-5.5 with reasoning.effort:high.
function _apiModelFor(modelId) {
  if (modelId === 'gpt-5.5-thinking' || modelId === 'gpt-5.4-thinking') return 'gpt-5.5';
  return _normalizeModel(modelId);
}

// v31.0: True if the UI model label means the request should send reasoning.effort
function _isThinkingLabel(modelId) {
  if (!modelId) return false;
  var m = String(modelId);
  return m === 'gpt-5.5-thinking' || m === 'gpt-5.4-thinking' || m.indexOf('-thinking') !== -1;
}
```

- [ ] **Step 2: Wire into the two streaming entry points**

In `callOpenAIStreaming` (current line ~5795) and `callOpenAIStudioStreaming` (current line ~4929):

1. Read user-facing label, normalize, then resolve to API model:
```javascript
var uiModel = opts.model || 'gpt-5.5';
uiModel = _normalizeModel(uiModel);
var apiModel = _apiModelFor(uiModel);  // maps "gpt-5.5-thinking" → "gpt-5.5"
var thinkingMode = _isThinkingLabel(uiModel);
```

2. Use `apiModel` in the request body (`body.model = apiModel`). Replace any existing default of `'gpt-5.4'` with `'gpt-5.5'`.

3. Where the existing code checks `isOpenAIThinkingModel(model)` to inject `body.reasoning`, use `thinkingMode` instead — and force `effort: 'high'` (or whatever `roweos_reasoning_effort` is set to) since "Thinking" is the user's explicit choice for higher reasoning.

- [ ] **Step 3: Verify no remaining hardcoded gpt-5.4 defaults**

Run:
```bash
cd /Users/jordanrowe/Developer/roweOS && grep -rn "|| 'gpt-5.4'" src/js/ | grep -v "_normalizeModel\|// v"
```
Expected: empty (every `|| 'gpt-5.4'` fallback is replaced).

- [ ] **Step 4: Commit**

```bash
git add src/js/core/13-studio.js
git commit -m "v31.0: Add gpt-5.4 → gpt-5.5 normalization shim for backwards compat"
```

---

### Task 1.2: Thinking model detection + reasoning_effort surface

**Files:**
- Modify: `src/js/core/13-studio.js` lines 4918-4925 (`isOpenAIThinkingModel`)
- Modify: `src/js/core/13-studio.js` lines 4962-4966 + 5876-5879 (reasoning injection)

- [ ] **Step 1: Update `isOpenAIThinkingModel`**

Replace the suffix check with both 5.4 (legacy) and 5.5 (current) support:

```javascript
function isOpenAIThinkingModel(modelId) {
  if (!modelId) return false;
  var m = String(modelId);
  return m.indexOf('-thinking') !== -1 ||
         m === 'gpt-5.5-thinking' ||
         m === 'gpt-5.4-thinking'; // legacy
}
```

- [ ] **Step 2: Make reasoning_effort configurable**

Read user-selected effort from `localStorage.getItem('roweos_reasoning_effort')` with fallback to `'high'`. Update both injection sites:

```javascript
if (isOpenAIThinkingModel(model)) {
  var effort = (typeof window !== 'undefined' && window.localStorage)
    ? (localStorage.getItem('roweos_reasoning_effort') || 'high')
    : 'high';
  if (['low','medium','high'].indexOf(effort) === -1) effort = 'high';
  body.reasoning = { effort: effort, summary: 'auto' };
}
```

- [ ] **Step 3: Add Settings UI control**

In `src/html/core/03-views-batch2.html`, in the OpenAI Settings section (find the existing `gpt-5.4-thinking` dropdown ~line 1247), add this radio group below the model dropdown:

```html
<div style="margin-top:12px;font-size:12px;color:var(--text-2)">
  <div style="margin-bottom:6px">Thinking effort (gpt-5.5-thinking)</div>
  <label style="margin-right:12px"><input type="radio" name="roweos_reasoning_effort" value="low" onclick="localStorage.setItem('roweos_reasoning_effort','low')"> Low</label>
  <label style="margin-right:12px"><input type="radio" name="roweos_reasoning_effort" value="medium" onclick="localStorage.setItem('roweos_reasoning_effort','medium')"> Medium</label>
  <label><input type="radio" name="roweos_reasoning_effort" value="high" onclick="localStorage.setItem('roweos_reasoning_effort','high')" checked> High</label>
</div>
```

- [ ] **Step 4: Verify in browser**

After build+deploy: open Settings → set effort to Low → use a Thinking op → check Network tab for `reasoning.effort: 'low'` in request body. Then High → verify `'high'`.

- [ ] **Step 5: Commit**

```bash
git add src/js/core/13-studio.js src/html/core/03-views-batch2.html
git commit -m "v31.0: Expose reasoning_effort setting for gpt-5.5-thinking"
```

---

### Task 1.3: Web-search injection condition

**Files:**
- Modify: `src/js/core/13-studio.js:5883`
- Modify: `src/js/core/13-studio.js:4967`
- Modify: `src/js/core/30-automations-init.js:4006`
- Modify: `src/js/late/00-api-bridge.js:11042`

The current condition is `model.indexOf('gpt-5.4') === 0`. This must accept BOTH `gpt-5.4*` (legacy) and `gpt-5.5*` (new) so cached configs keep web search.

- [ ] **Step 1: Add helper at top of `13-studio.js`** (right after `_normalizeModel`)

```javascript
// v31.0: True if the model ID supports the web_search_preview tool
function _modelSupportsWebSearch(modelId) {
  if (!modelId) return false;
  var m = String(modelId);
  return m.indexOf('gpt-5.5') === 0 || m.indexOf('gpt-5.4') === 0;
}
```

- [ ] **Step 2: Replace the four condition sites with `_modelSupportsWebSearch(model)`**

Find each `model.indexOf('gpt-5.4') === 0` and replace with `_modelSupportsWebSearch(model)`. The four locations:

- `src/js/core/13-studio.js:4967` (callOpenAIStudioStreaming)
- `src/js/core/13-studio.js:5883` (callOpenAIStreaming)
- `src/js/core/30-automations-init.js:4006` (automations dispatch)
- `src/js/late/00-api-bridge.js:11042` (api bridge)

- [ ] **Step 3: Verify**

```bash
grep -rn "indexOf('gpt-5.4')" src/js/
```
Expected: only the line inside `_modelSupportsWebSearch` itself (one match in `13-studio.js`).

- [ ] **Step 4: Commit**

```bash
git add src/js/core/13-studio.js src/js/core/30-automations-init.js src/js/late/00-api-bridge.js
git commit -m "v31.0: Web search supports both gpt-5.4 (legacy) and gpt-5.5 models"
```

---

### Task 1.4: Update Intelligence Agent ops 1101-1113 default model

**Files:**
- Modify: `src/js/core/10-sync.js:2805-2852`
- Modify: `src/js/core/14-calendar.js:2673-2680`

- [ ] **Step 1: Find each `preferredModel: 'gpt-5.4'` in 10-sync.js (13 occurrences in ops 1101-1113) and replace with `'gpt-5.5'`**

Use search-then-edit (do NOT use replace_all — it could touch other strings). For each of the 13 ops, the line looks like:

```javascript
preferredProvider: 'openai', preferredModel: 'gpt-5.4',
```

Replace with:

```javascript
preferredProvider: 'openai', preferredModel: 'gpt-5.5',
```

- [ ] **Step 2: Update the comment at line 2805**

Find:
```javascript
// INTELLIGENCE OPERATIONS (Web Search powered, GPT-5.4)
```

Replace:
```javascript
// v31.0: INTELLIGENCE OPERATIONS (Web Search powered, GPT-5.5)
```

- [ ] **Step 3: Update calendar.js model override**

In `src/js/core/14-calendar.js:2673-2680`, find the comment + check that mentions `'gpt-5.4'`:

```javascript
// Preferred model override for intelligence ops (web search requires GPT-5.4)
```

Replace with:
```javascript
// v31.0: Preferred model override for intelligence ops (web search requires GPT-5.5)
```

And update any literal `'gpt-5.4'` in the override block to `'gpt-5.5'`.

- [ ] **Step 4: Verify**

```bash
grep -n "preferredModel: 'gpt-5.4'" src/js/core/10-sync.js
```
Expected: empty.

```bash
grep -c "preferredModel: 'gpt-5.5'" src/js/core/10-sync.js
```
Expected: `13` (one per Intelligence op).

- [ ] **Step 5: Commit**

```bash
git add src/js/core/10-sync.js src/js/core/14-calendar.js
git commit -m "v31.0: Intelligence Agent ops 1101-1113 use gpt-5.5"
```

---

### Task 1.5: Pricing table for gpt-5.5 family

**Files:**
- Modify: `src/js/core/29-analytics-commerce.js:515-517`

**Verified pricing from OpenAI docs (fetched 2026-04-25):**
- `gpt-5.5`: input $5.00 / 1M, cached input $0.50 / 1M, output $30.00 / 1M, context 1,050,000 tokens, max output 128k
- `gpt-5.5-pro`: input $30.00 / 1M, output $180.00 / 1M, context 1,050,000 tokens, max output 128k
- **`gpt-5.5-thinking` is NOT a separate model** — it's a UI alias for `gpt-5.5` with `reasoning.effort: 'high'`. Cost is the same as `gpt-5.5` ($5/$30) plus reasoning tokens billed at output rate.

- [ ] **Step 1: Add new entries (keep old ones for back-compat cost calc)**

Find the model-cost object (~line 515):

```javascript
'gpt-5.4': { input: 2.50, output: 15.00 },
'gpt-5.4-pro': { input: 30.00, output: 180.00 },
'gpt-5.4-thinking': { input: 2.50, output: 15.00 },
```

Add immediately below (do NOT delete the gpt-5.4 entries — they're needed for historical cost rendering of saved usage logs):

```javascript
// v31.0: gpt-5.5 family pricing per https://developers.openai.com/api/docs/models/gpt-5.5
'gpt-5.5': { input: 5.00, output: 30.00 },
'gpt-5.5-pro': { input: 30.00, output: 180.00 },
'gpt-5.5-thinking': { input: 5.00, output: 30.00 }, // UI alias → gpt-5.5 + reasoning.effort:high
```

- [ ] **Step 3: Update display-name mapping at line ~4668**

Find the model-name display map and add 5.5 entries:

```javascript
'gpt-5.5': 'GPT-5.5',
'gpt-5.5-pro': 'GPT-5.5 Pro',
'gpt-5.5-thinking': 'GPT-5.5 Thinking',
```

Keep the existing 5.4 entries.

- [ ] **Step 4: Commit**

```bash
git add src/js/core/29-analytics-commerce.js
git commit -m "v31.0: Add gpt-5.5 family pricing + display names"
```

---

### Task 1.6: Default OpenAI model picker (everywhere `'gpt-5.4'` is the default)

**Files:**
- Modify: `src/js/core/24-lifeai-identity.js:1736, 2676, 3903-3905`
- Modify: `src/js/core/20-ui-misc.js:6635, 7383`
- Modify: `src/js/core/25-documents-lifeai.js:6167`
- Modify: `src/js/core/16-bloom.js:1280, 1286, 1881, 1887`
- Modify: `src/js/core/17-automations.js:528, 534, 6969`
- Modify: `src/js/core/18-social.js:3678`
- Modify: `src/js/core/26-smart-suggestions-onboarding.js:2136, 2374, 3123, 3710`
- Modify: `src/js/core/30-automations-init.js:948, 957, 966, 1012`
- Modify: `src/js/core/27-launch-brandai.js:759-761`
- Modify: `src/js/core/29-analytics-commerce.js:4668-4670`
- Modify: `src/js/core/13-studio.js:606-607`
- Modify: `src/js/core/23-offline.js:952`
- Modify: `src/js/core/21-sidebar.js:1307-1309, 1757-1759`
- Modify: `src/js/core/11-agents.js:152, 324, 6694-6722`

This is the bulk of the migration. Strategy: ordered string replacement, longest-first to avoid double-replacement.

- [ ] **Step 1: Run replacements (inside `src/js/` only — never `RoweOS/dist/`)**

For each file listed above, perform these substitutions IN ORDER (Pro before plain, then thinking before plain):

| Find | Replace |
|---|---|
| `'gpt-5.4-pro'` | `'gpt-5.5-pro'` |
| `'gpt-5.4-thinking'` | `'gpt-5.5-thinking'` |
| `'gpt-5.4'` | `'gpt-5.5'` |
| `"gpt-5.4-pro"` | `"gpt-5.5-pro"` |
| `"gpt-5.4-thinking"` | `"gpt-5.5-thinking"` |
| `"gpt-5.4"` | `"gpt-5.5"` |
| `GPT-5.4 Pro` | `GPT-5.5 Pro` |
| `GPT-5.4 Thinking` | `GPT-5.5 Thinking` |
| `GPT-5.4` | `GPT-5.5` |
| `GPT 5.4` | `GPT 5.5` |
| `5.4 Pro` | `5.5 Pro` |
| `gpt-5.4` | `gpt-5.5` (catch-all for inline templates/comments) |

For each file: use `Edit` with `replace_all: true` per substitution row. Always do Pro/Thinking variants BEFORE the bare variant. **Do NOT run on `src/js/core/13-studio.js`** — its `_normalizeModel` and `_modelSupportsWebSearch` helpers reference legacy `gpt-5.4` literals on purpose. Skip it; you've handled it manually in Tasks 1.1-1.3.

- [ ] **Step 2: Verify**

```bash
cd /Users/jordanrowe/Developer/roweOS && grep -rn "gpt-5\.4\|GPT-5\.4\|GPT 5\.4\|5\.4 Pro" src/js/ src/html/ | grep -v "_normalizeModel\|_modelSupportsWebSearch\|legacy\|backwards-compat\|// v"
```

Expected: empty (or only intentional legacy shim references).

- [ ] **Step 3: Build**

```bash
cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh
```

Expected: build succeeds. If it fails, fix the error before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "v31.0: Migrate default OpenAI model to gpt-5.5 across all features"
```

---

### Task 1.7: HTML model dropdowns

**Files:**
- Modify: `src/html/core/03-views-batch2.html:163-165, 1247-1249`
- Modify: `src/html/core/04-views-batch3.html:814-816, 1833-1834, 3098-3100`
- Modify: `src/html/brand/02-studio.html:229-231, 264-266`

- [ ] **Step 1: Update each dropdown**

For each file, read the lines around the indicated number, and update each `<option value="gpt-5.4*">` and visible label text. Three options per group (`gpt-5.5`, `gpt-5.5-pro`, `gpt-5.5-thinking`). Update both `value=` and inner text.

Example pattern in `03-views-batch2.html:163-165`:

```html
<option value="gpt-5.4">GPT-5.4 (default)</option>
<option value="gpt-5.4-pro">GPT-5.4 Pro</option>
<option value="gpt-5.4-thinking">GPT-5.4 Thinking</option>
```

Replace with:

```html
<option value="gpt-5.5">GPT-5.5 (default)</option>
<option value="gpt-5.5-pro">GPT-5.5 Pro</option>
<option value="gpt-5.5-thinking">GPT-5.5 Thinking</option>
```

- [ ] **Step 2: Update onboarding model tags display in `04-views-batch3.html:814-816`**

Find the GPT provider tags:
```html
<span class="model-tag">GPT-5.4 Pro</span>
<span class="model-tag">GPT-5.4</span>
<span class="model-tag">GPT-5.4 Thinking</span>
```

Replace:
```html
<span class="model-tag">GPT-5.5 Pro</span>
<span class="model-tag">GPT-5.5</span>
<span class="model-tag">GPT-5.5 Thinking</span>
```

- [ ] **Step 3: Verify**

```bash
grep -rn "gpt-5\.4\|GPT-5\.4" src/html/
```
Expected: empty.

- [ ] **Step 4: Build + commit**

```bash
bash src/build.sh
git add src/html/
git commit -m "v31.0: Update model dropdowns + onboarding tags to gpt-5.5"
```

---

## Phase 2 — GPT Image 2 Upgrade

### Task 2.1: Update `generateImage()` to gpt-image-2

**Files:**
- Modify: `src/js/core/14-calendar.js:392-447`

⚠ **Verify the exact tool name + model parameter against** https://developers.openai.com/api/docs/guides/image-generation **before editing.** Use WebFetch to read the doc.

- [ ] **Step 1: Read OpenAI image-gen doc**

Use WebFetch on `https://developers.openai.com/api/docs/guides/image-generation`. Note: tool name (currently `image_generation`), required model field, supported sizes, supported formats.

- [ ] **Step 2: Update the Responses API call (lines 416-447)**

Find the tool definition:
```javascript
{ type: 'image_generation' }
```

Update per docs (likely something like):
```javascript
{ type: 'image_generation', model: 'gpt-image-2' }
```

Update the response parser at lines 436-447 if the response key changed (likely still `image_generation_call`, but verify).

- [ ] **Step 3: Update UI text (lines 836, 841)**

Find:
```javascript
'Generating with GPT Image...'
```
Replace:
```javascript
'Generating with GPT Image 2...'
```

- [ ] **Step 4: Update fallback DALL-E direct endpoint label (lines 480-520)**

Add comment marker:
```javascript
// v31.0: Legacy DALL-E direct fallback. Only used if gpt-image-2 Responses API is unavailable.
```

If the fallback uses `dall-e-3` and you'd like to drop it, replace with:
```javascript
model: 'gpt-image-2',
```

For now, **keep it for safety** — flag in a comment that it's the legacy path.

- [ ] **Step 5: Update Studio image model list (`src/js/core/13-studio.js:7376`)**

Find:
```javascript
'GPT Image': '...',
```
Update:
```javascript
'GPT Image 2': '...',
```

- [ ] **Step 6: Update DALL-E settings panel label (`src/js/core/13-studio.js:6790-6795`)**

Find any "DALL-E" or "GPT Image" header in the settings panel and rename to "GPT Image 2 (OpenAI)".

- [ ] **Step 7: Verify**

```bash
grep -rn "GPT Image\b" src/ | grep -v "GPT Image 2"
```
Expected: empty.

- [ ] **Step 8: Manual browser test**

Build + deploy. In Calendar or Studio, generate an image. Confirm:
- UI says "Generating with GPT Image 2..."
- Network tab shows the new model parameter
- Image renders successfully

- [ ] **Step 9: Commit**

```bash
git add src/
git commit -m "v31.0: Upgrade image generation to GPT Image 2"
```

---

## Phase 3 — Info Page Signup Capture & Redirect

### Task 3.1: Confirm consolidation approach with user

⚠ **STOP HERE before continuing.** This task requires a decision call. The current `/info` source is in a separate Vercel project (`roweos.website`) that is **not on disk**. Two options:

**Option A (recommended in this plan):** Move `/info` into the main RoweOS repo as `RoweOS/dist/info.html`, change the rewrite rule, retire the separate Vercel project. Atomic deploys, single source of truth, signup form shares `/api/notify-signup`.

**Option B:** Leave `roweoswebsite.vercel.app` as-is, recreate the source somewhere (or recover from `~/Downloads/RoweOS-Promo-V3/dist/index.html`), build the signup form there, hit a NEW endpoint on the main RoweOS API.

This plan assumes **Option A**. If you choose Option B, skip Task 3.6 and instead update the V4 source wherever it ends up; Task 3.4 still applies but the form posts cross-origin.

- [ ] **Step 1: Get user confirmation on approach**

If unsure, ask the user before proceeding to Task 3.2.

---

### Task 3.2: Create `RoweOS/dist/info.html` (modernized V3 + GPT-5.5 advertising)

**Files:**
- Source seed: `~/Downloads/RoweOS-Promo-V3/dist/index.html` (copy + modernize)
- Create: `RoweOS/dist/info.html`

- [ ] **Step 1: Copy V3 as starting point**

```bash
cp ~/Downloads/RoweOS-Promo-V3/dist/index.html /Users/jordanrowe/Developer/roweOS/RoweOS/dist/info.html
```

- [ ] **Step 2: Update copy for v31.0**

Find and replace these strings inside `info.html`:

| Find | Replace |
|---|---|
| `Beta` (in pricing/access copy) | `14-day free trial` |
| `Free Month` | `14-day free trial` |
| `private beta` | `now available` |
| Any `GPT-4*`/`GPT-5.4*` references | `GPT-5.5`, `GPT-5.5 Pro`, `GPT-5.5 Thinking` |
| Any "DALL-E" image references | `GPT Image 2` |

- [ ] **Step 3: Replace stub signup form with real one**

The V3 form (lines ~481-484) does `event.preventDefault()` and just changes button text. Replace the entire `<form>` with:

```html
<form id="infoSignupForm" action="/api/info-signup" method="POST"
      style="display:flex;gap:12px;max-width:520px;margin:0 auto;flex-wrap:wrap;justify-content:center">
  <input type="text" name="name" placeholder="Your name" required
         style="flex:1;min-width:180px;padding:14px 20px;background:rgba(255,255,255,0.03);border:1px solid var(--border-strong);border-radius:8px;color:var(--text);font-family:var(--sans);font-size:14px;outline:none;transition:border-color 0.3s;backdrop-filter:blur(4px)">
  <input type="email" name="email" placeholder="you@yourbrand.com" required
         style="flex:1;min-width:240px;padding:14px 20px;background:rgba(255,255,255,0.03);border:1px solid var(--border-strong);border-radius:8px;color:var(--text);font-family:var(--sans);font-size:14px;outline:none;transition:border-color 0.3s;backdrop-filter:blur(4px)">
  <input type="hidden" name="utm_source" id="infoUtmSource" value="">
  <input type="hidden" name="utm_medium" id="infoUtmMedium" value="">
  <input type="hidden" name="utm_campaign" id="infoUtmCampaign" value="">
  <input type="hidden" name="referrer" id="infoReferrer" value="">
  <button type="submit" class="btn-primary" style="white-space:nowrap">Start your trial</button>
</form>
<script>
(function() {
  var qs = new URLSearchParams(location.search);
  document.getElementById('infoUtmSource').value = qs.get('utm_source') || '';
  document.getElementById('infoUtmMedium').value = qs.get('utm_medium') || '';
  document.getElementById('infoUtmCampaign').value = qs.get('utm_campaign') || '';
  document.getElementById('infoReferrer').value = document.referrer || '';
})();
</script>
```

The form posts directly to `/api/info-signup` — server returns a 302 redirect to `roweos.com/?email=...&name=...&source=info`, so the browser navigates without JS.

- [ ] **Step 4: Add a section advertising GPT-5.5 + GPT Image 2**

In the features section, ensure there's a card mentioning:
- "GPT-5.5, GPT-5.5 Pro, GPT-5.5 Thinking"
- "Claude Sonnet 4.6, Opus 4.7, Haiku 4.5"
- "Gemini 3.1 Pro, Nano Banana 3 Pro"
- "GPT Image 2 + Veo video"

Match the visual style of existing feature cards.

- [ ] **Step 5: Commit**

```bash
git add RoweOS/dist/info.html
git commit -m "v31.0: New /info page in main repo (replaces roweos.website project)"
```

---

### Task 3.3: Refactor `notify-signup.js` to expose reusable email renderer

**Files:**
- Modify: `RoweOS/dist/api/notify-signup.js:47-106`

We want `info-signup.js` to send the SAME-styled admin email but with `source: "Info Page Lead"` and a different recipient context (lead, not authed user).

- [ ] **Step 1: Extract email-render logic into a named exported function**

In `notify-signup.js`, find the inline `var emailHtml = '<table ...>'` (lines 47-106). Replace with a call to:

```javascript
var emailHtml = renderSignupEmail({
  email: email,
  displayName: displayName,
  method: method,
  source: source,
  uid: uid,
  createdAt: createdAt
});
```

And define `renderSignupEmail(payload)` at the bottom of the file (before `module.exports = handler` if present). Move the entire HTML template into it; replace direct variable references with `payload.email`, etc.

- [ ] **Step 2: Export it**

At the bottom of `notify-signup.js`, add:

```javascript
module.exports = handler;
module.exports.renderSignupEmail = renderSignupEmail;
```

If the file uses ES modules instead of CJS, use `export { renderSignupEmail }` and `export default handler`.

- [ ] **Step 3: Verify existing flow still works**

After build+deploy, sign up a new test user via Welcome Screen. Confirm the admin email still arrives with the correct template.

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/api/notify-signup.js
git commit -m "v31.0: Refactor notify-signup to expose renderSignupEmail() for reuse"
```

---

### Task 3.4: Create `/api/info-signup` endpoint

**Files:**
- Create: `RoweOS/dist/api/info-signup.js`

- [ ] **Step 1: Write the handler**

```javascript
// v31.0: /api/info-signup — captures lead from roweos.com/info form,
// sends admin notification email, redirects to roweos.com with prefill params.

var notifySignup = require('./notify-signup');
var renderSignupEmail = notifySignup.renderSignupEmail;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  // Parse body (Vercel auto-parses for application/x-www-form-urlencoded and JSON)
  var body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      // form-encoded fallback
      body = require('querystring').parse(body);
    }
  }

  var name = String(body.name || '').trim().slice(0, 200);
  var email = String(body.email || '').trim().toLowerCase().slice(0, 320);
  var utmSource = String(body.utm_source || '').slice(0, 100);
  var utmMedium = String(body.utm_medium || '').slice(0, 100);
  var utmCampaign = String(body.utm_campaign || '').slice(0, 100);
  var referrer = String(body.referrer || '').slice(0, 500);

  var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Invalid email');
    return;
  }

  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  var userAgent = req.headers['user-agent'] || '';
  var createdAt = new Date().toISOString();

  // 1. Send admin notification email (reuse existing renderer)
  if (process.env.RESEND_API_KEY && renderSignupEmail) {
    try {
      var html = renderSignupEmail({
        email: email,
        displayName: name || '(no name)',
        method: 'Info Page Form',
        source: 'Info Page Lead',
        uid: '(prospect)',
        createdAt: createdAt
      });
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'RoweOS <roweos@therowecollection.com>',
          reply_to: 'jordan@therowecollection.com',
          to: ['jordan@therowecollection.com'],
          subject: 'New RoweOS Lead (Info Page): ' + email,
          html: html
        })
      });
    } catch (e) {
      console.error('[info-signup] Resend send failed:', e && e.message);
    }
  }

  // 2. Write to Firestore info_leads collection
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      var sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      // Reuse helper from notify-signup if exported, else inline minimum:
      var getToken = notifySignup.getFirebaseAccessToken
        || require('./notify-signup').getFirebaseAccessToken;
      // If not exported, copy the JWT-mint logic into this file (~50 lines)
      var accessToken = await getToken(sa);
      if (accessToken) {
        var projectId = process.env.FIREBASE_PROJECT_ID;
        var docUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId
          + '/databases/(default)/documents/info_leads';
        await fetch(docUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              email: { stringValue: email },
              name: { stringValue: name },
              utmSource: { stringValue: utmSource },
              utmMedium: { stringValue: utmMedium },
              utmCampaign: { stringValue: utmCampaign },
              referrer: { stringValue: referrer },
              ip: { stringValue: String(ip) },
              userAgent: { stringValue: userAgent },
              createdAt: { stringValue: createdAt },
              status: { stringValue: 'new' }
            }
          })
        });
      }
    } catch (e) {
      console.error('[info-signup] Firestore write failed:', e && e.message);
    }
  }

  // 3. 302 redirect to main app with prefill
  var qs = new URLSearchParams({
    email: email,
    name: name,
    source: 'info'
  }).toString();
  res.statusCode = 302;
  res.setHeader('Location', 'https://roweos.com/?' + qs);
  res.end();
};
```

- [ ] **Step 2: Ensure `getFirebaseAccessToken` is exported from notify-signup**

If not already exported, in `notify-signup.js` add:

```javascript
module.exports.getFirebaseAccessToken = getFirebaseAccessToken;
```

- [ ] **Step 3: Add function config to `vercel.json`**

In `RoweOS/dist/vercel.json`, find the `functions` block and add:

```json
"api/info-signup.js": {
  "maxDuration": 10
}
```

- [ ] **Step 4: Commit**

```bash
git add RoweOS/dist/api/info-signup.js RoweOS/dist/api/notify-signup.js RoweOS/dist/vercel.json
git commit -m "v31.0: Add /api/info-signup lead capture endpoint"
```

---

### Task 3.5: Update `vercel.json` `/info` rewrite

**Files:**
- Modify: `RoweOS/dist/vercel.json:22-23`

- [ ] **Step 1: Replace the proxy rewrite with internal route**

Find:
```json
{ "src": "/info/api/(.*)", "dest": "https://roweoswebsite.vercel.app/api/$1" },
{ "src": "/info", "dest": "https://roweoswebsite.vercel.app/" }
```

Replace with:
```json
{ "src": "/info", "dest": "/info.html" },
{ "src": "/info/", "dest": "/info.html" }
```

- [ ] **Step 2: Verify routing order**

Make sure these come BEFORE the catch-all `{ "src": "/(.*)", "dest": "/index.html" }` (which is at line 47). Vercel evaluates routes top-down.

- [ ] **Step 3: Commit**

```bash
git add RoweOS/dist/vercel.json
git commit -m "v31.0: Route /info to internal info.html (was external proxy)"
```

---

### Task 3.6: Auth gate URL-param prefill

**Files:**
- Modify: `src/js/core/22-firebase-sync.js` (`showAuthGate()`)
- Modify: `src/js/core/21-sidebar.js` (`handleEmailPasswordAuth()`, line 2533)

- [ ] **Step 1: Add `_parseSignupURLParams()` helper**

In `src/js/core/22-firebase-sync.js`, near the top of the file:

```javascript
// v31.0: Parse signup prefill from URL query (?email=...&name=...&source=info)
function _parseSignupURLParams() {
  try {
    var qs = new URLSearchParams(window.location.search);
    return {
      email: qs.get('email') || '',
      name: qs.get('name') || '',
      source: qs.get('source') || ''
    };
  } catch (e) {
    return { email: '', name: '', source: '' };
  }
}
```

- [ ] **Step 2: Wire into `showAuthGate()`**

Find `showAuthGate()` (existing function). Inside, after the splash/login phase elements are guaranteed visible, add:

```javascript
// v31.0: URL prefill from /info signup
var prefill = _parseSignupURLParams();
if (prefill.email) {
  // Skip splash, go straight to login form, switch to "Create Account" mode
  var splash = document.getElementById('authSplash');
  var login = document.getElementById('authLogin');
  if (splash) splash.style.display = 'none';
  if (login) login.style.display = '';
  if (typeof toggleEmailForm === 'function') toggleEmailForm();
  if (typeof toggleEmailAuthMode === 'function') {
    // Force into create-account mode
    if (window._authMode !== 'create') toggleEmailAuthMode();
  }
  var emailInput = document.getElementById('authEmailInput');
  var nameInput = document.getElementById('authNameInput');
  if (emailInput) emailInput.value = prefill.email;
  if (nameInput) nameInput.value = prefill.name;
  if (prefill.source === 'info') {
    window._signupSource = 'Info Page Lead';
  }
}
```

- [ ] **Step 3: Pass source to notify-signup**

Find the existing call to `/api/notify-signup` in `22-firebase-sync.js` (~line 4363-4369) where the body has `source: 'Welcome Screen'`. Update:

```javascript
source: window._signupSource || 'Welcome Screen',
```

This way, leads who came from /info get tagged correctly in admin notifications.

- [ ] **Step 4: Verify `#authNameInput` and `#authEmailInput` slot in HTML**

In `src/html/core/02-shell-batch1.html`, confirm both inputs exist with those IDs (they do per discovery: lines ~88-104). No HTML change needed.

- [ ] **Step 5: Manual browser test**

Build+deploy. Visit `https://roweos.com/?email=test@example.com&name=Test%20User&source=info`. Confirm:
- Splash is skipped
- Email form is shown
- Mode is "Create Account" (with name field visible)
- Email field is prefilled with `test@example.com`
- Name field is prefilled with `Test User`

Then complete signup → check admin email arrives with `Source: Info Page Lead`.

- [ ] **Step 6: Commit**

```bash
git add src/js/core/22-firebase-sync.js
git commit -m "v31.0: Prefill auth gate from URL params for /info → /signup handoff"
```

---

## Phase 4 — Admin Campaigns/Responses Dashboard

### Task 4.1: Build out empty `#adminTabCampaigns` markup

**Files:**
- Modify: `src/html/brand/25-admin.html` (find `id="adminTabCampaigns"`)

- [ ] **Step 1: Add dashboard skeleton**

Inside the existing `<div id="adminTabCampaigns">` (currently empty per discovery, dist line 62213), add:

```html
<div style="padding:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h3 style="margin:0;font-size:16px;color:var(--text)">Campaigns &amp; Responses</h3>
    <div style="display:flex;gap:8px">
      <select id="campaignsTemplateFilter" onchange="adminLoadCampaigns()" style="padding:6px 10px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
        <option value="">All templates</option>
      </select>
      <button onclick="adminLoadCampaigns()" style="padding:6px 12px;background:var(--accent);color:#0a0a0a;border:none;border-radius:6px;font-size:12px;cursor:pointer">Refresh</button>
      <button onclick="adminExportCampaignsCSV()" style="padding:6px 12px;background:var(--bg-2);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:12px;cursor:pointer">Export CSV</button>
    </div>
  </div>

  <div id="campaignsStats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px"></div>

  <div id="campaignsContent" style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:0;overflow:hidden">
    <div style="padding:24px;text-align:center;color:var(--text-2);font-size:13px">Loading…</div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/html/brand/25-admin.html
git commit -m "v31.0: Add Campaigns dashboard skeleton to Admin panel"
```

---

### Task 4.2: Create `25-admin-campaigns.js`

**Files:**
- Create: `src/js/core/25-admin-campaigns.js`
- Modify: `src/build.sh` if it doesn't auto-glob (verify build picks up the new file)

- [ ] **Step 1: Write the module**

```javascript
// v31.0: Admin Campaigns/Responses dashboard
// Aggregates email_log + collectionGroup('responses') into a unified view

(function() {

  var _campaignsCache = null;

  window.adminLoadCampaigns = function() {
    if (typeof isAdmin === 'function' && !isAdmin()) return;
    if (typeof firebase === 'undefined' || !firebase) return;

    var statsEl = document.getElementById('campaignsStats');
    var contentEl = document.getElementById('campaignsContent');
    if (!statsEl || !contentEl) return;

    contentEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-2);font-size:13px">Loading…</div>';

    var db = firebase.firestore();
    var emailLogP = db.collection('email_log').limit(500).get().catch(function() { return null; });
    var responsesP = db.collectionGroup('responses').limit(1000).get().catch(function() { return null; });
    var leadsP = db.collection('info_leads').limit(500).get().catch(function() { return null; });

    Promise.all([emailLogP, responsesP, leadsP]).then(function(results) {
      var emailSnap = results[0];
      var responseSnap = results[1];
      var leadsSnap = results[2];

      var emails = [];
      if (emailSnap && emailSnap.docs) {
        emailSnap.docs.forEach(function(doc) {
          var d = doc.data();
          emails.push({
            id: doc.id,
            userEmail: d.userEmail || d.email || '',
            template: d.template || '',
            subject: d.subject || '',
            sentAt: d.sentAt || d.createdAt || '',
            status: d.status || 'sent'
          });
        });
      }

      var responses = [];
      if (responseSnap && responseSnap.docs) {
        responseSnap.docs.forEach(function(doc) {
          var d = doc.data();
          responses.push({
            userId: doc.ref.parent.parent ? doc.ref.parent.parent.id : '',
            question: d.question || d.field || '',
            answer: d.answer || d.value || d.response || '',
            template: d.email_template || d.template || d.source || '',
            timestamp: d.timestamp || d.createdAt || ''
          });
        });
      }

      var leads = [];
      if (leadsSnap && leadsSnap.docs) {
        leadsSnap.docs.forEach(function(doc) {
          var d = doc.data();
          leads.push({
            id: doc.id,
            email: d.email || '',
            name: d.name || '',
            utmSource: d.utmSource || '',
            utmCampaign: d.utmCampaign || '',
            referrer: d.referrer || '',
            createdAt: d.createdAt || '',
            status: d.status || 'new'
          });
        });
      }

      _campaignsCache = { emails: emails, responses: responses, leads: leads };
      _renderCampaignStats(emails, responses, leads);
      _populateTemplateFilter(emails, responses);

      var filter = (document.getElementById('campaignsTemplateFilter') || {}).value || '';
      _renderCampaignContent(emails, responses, leads, filter);
    });
  };

  function _renderCampaignStats(emails, responses, leads) {
    var statsEl = document.getElementById('campaignsStats');
    if (!statsEl) return;
    var responseRate = emails.length > 0
      ? Math.round((responses.length / emails.length) * 100)
      : 0;
    statsEl.innerHTML = ''
      + _statCard('Emails Sent', emails.length)
      + _statCard('Responses', responses.length)
      + _statCard('Response Rate', responseRate + '%')
      + _statCard('Info Leads', leads.length);
  }

  function _statCard(label, value) {
    return '<div style="padding:12px 16px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px">'
      + '<div style="font-size:11px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">' + escapeHtml(label) + '</div>'
      + '<div style="font-size:22px;color:var(--accent);font-weight:300">' + escapeHtml(String(value)) + '</div>'
      + '</div>';
  }

  function _populateTemplateFilter(emails, responses) {
    var sel = document.getElementById('campaignsTemplateFilter');
    if (!sel) return;
    var existing = sel.value;
    var templates = {};
    emails.forEach(function(e) { if (e.template) templates[e.template] = true; });
    responses.forEach(function(r) { if (r.template) templates[r.template] = true; });
    var opts = ['<option value="">All templates</option>'];
    Object.keys(templates).sort().forEach(function(t) {
      opts.push('<option value="' + escapeHtml(t) + '"' + (t === existing ? ' selected' : '') + '>' + escapeHtml(t) + '</option>');
    });
    sel.innerHTML = opts.join('');
  }

  function _renderCampaignContent(emails, responses, leads, filter) {
    var contentEl = document.getElementById('campaignsContent');
    if (!contentEl) return;

    var filteredEmails = filter ? emails.filter(function(e) { return e.template === filter; }) : emails;
    var filteredResponses = filter ? responses.filter(function(r) { return r.template === filter; }) : responses;

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0">';

    // Left: recent emails
    html += '<div style="border-right:1px solid var(--border)">';
    html += '<div style="padding:12px 16px;font-size:12px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border)">Recent Emails (' + filteredEmails.length + ')</div>';
    html += '<div style="max-height:480px;overflow:auto">';
    filteredEmails.slice(0, 100).forEach(function(e) {
      html += '<div style="padding:10px 16px;border-bottom:1px solid var(--border)">'
        + '<div style="font-size:13px;color:var(--text)">' + escapeHtml(e.subject || '(no subject)') + '</div>'
        + '<div style="font-size:11px;color:var(--text-2);margin-top:2px">' + escapeHtml(e.userEmail) + ' · ' + escapeHtml(e.template) + ' · ' + _fmtDate(e.sentAt) + '</div>'
        + '</div>';
    });
    if (filteredEmails.length === 0) html += '<div style="padding:24px;text-align:center;color:var(--text-2);font-size:12px">No emails</div>';
    html += '</div></div>';

    // Right: responses
    html += '<div>';
    html += '<div style="padding:12px 16px;font-size:12px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border)">Responses (' + filteredResponses.length + ')</div>';
    html += '<div style="max-height:480px;overflow:auto">';
    filteredResponses.slice(0, 100).forEach(function(r) {
      html += '<div style="padding:10px 16px;border-bottom:1px solid var(--border)">'
        + '<div style="font-size:13px;color:var(--text)"><strong>Q:</strong> ' + escapeHtml(r.question) + '</div>'
        + '<div style="font-size:13px;color:var(--accent);margin-top:4px"><strong>A:</strong> ' + escapeHtml(r.answer) + '</div>'
        + '<div style="font-size:11px;color:var(--text-2);margin-top:4px">' + escapeHtml(r.userId) + ' · ' + escapeHtml(r.template) + ' · ' + _fmtDate(r.timestamp) + '</div>'
        + '</div>';
    });
    if (filteredResponses.length === 0) html += '<div style="padding:24px;text-align:center;color:var(--text-2);font-size:12px">No responses</div>';
    html += '</div></div>';

    html += '</div>';

    // Bottom: info leads
    html += '<div style="border-top:1px solid var(--border)">';
    html += '<div style="padding:12px 16px;font-size:12px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border)">Info Page Leads (' + leads.length + ')</div>';
    html += '<div style="max-height:300px;overflow:auto">';
    leads.forEach(function(l) {
      html += '<div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px">'
        + '<div><div style="font-size:13px;color:var(--text)">' + escapeHtml(l.name || '(no name)') + ' &lt;' + escapeHtml(l.email) + '&gt;</div>'
        + '<div style="font-size:11px;color:var(--text-2);margin-top:2px">' + escapeHtml(l.utmSource || 'direct') + ' · ' + escapeHtml(l.utmCampaign || '') + ' · ' + escapeHtml(l.referrer || '') + '</div></div>'
        + '<div style="font-size:11px;color:var(--text-2);align-self:center">' + _fmtDate(l.createdAt) + '</div>'
        + '</div>';
    });
    if (leads.length === 0) html += '<div style="padding:24px;text-align:center;color:var(--text-2);font-size:12px">No leads yet</div>';
    html += '</div></div>';

    contentEl.innerHTML = html;
  }

  function _fmtDate(s) {
    if (!s) return '';
    try {
      var d = new Date(s);
      return d.toLocaleString();
    } catch (e) { return String(s); }
  }

  window.adminExportCampaignsCSV = function() {
    if (!_campaignsCache) { adminLoadCampaigns(); return; }
    var rows = [['type','timestamp','email','name','template','question','answer','utm_source','utm_campaign']];
    _campaignsCache.emails.forEach(function(e) {
      rows.push(['email_sent', e.sentAt, e.userEmail, '', e.template, e.subject, '', '', '']);
    });
    _campaignsCache.responses.forEach(function(r) {
      rows.push(['response', r.timestamp, '', '', r.template, r.question, r.answer, '', '']);
    });
    _campaignsCache.leads.forEach(function(l) {
      rows.push(['lead', l.createdAt, l.email, l.name, '', '', '', l.utmSource, l.utmCampaign]);
    });
    var csv = rows.map(function(r) {
      return r.map(function(c) {
        var s = String(c == null ? '' : c).replace(/"/g, '""');
        return '"' + s + '"';
      }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'roweos-campaigns-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

})();
```

- [ ] **Step 2: Auto-load when admin tab opens**

In `src/js/core/22-firebase-sync.js`, find the `showAdminTab(tab)` function (or wherever `tabMap.campaigns` is bound, ~line 141527 of dist). Add inside the function, after the visibility toggle:

```javascript
if (tab === 'campaigns' && typeof adminLoadCampaigns === 'function') {
  adminLoadCampaigns();
}
```

- [ ] **Step 3: Verify build picks up the new file**

```bash
cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh && grep -c "adminLoadCampaigns" RoweOS/dist/index.html
```
Expected: ≥1 (function appears in built file).

- [ ] **Step 4: Browser test**

Deploy. Open Admin → Campaigns tab. Confirm:
- Stats cards render
- Emails column shows recent
- Responses column shows captured responses (if any)
- Leads section shows entries from `info_leads` (after Phase 3 deploys)
- Template filter populates
- Export CSV downloads correctly

- [ ] **Step 5: Commit**

```bash
git add src/js/core/25-admin-campaigns.js src/js/core/22-firebase-sync.js
git commit -m "v31.0: Admin Campaigns dashboard with emails, responses, info leads"
```

---

## Phase 5 — Advertising Updates Everywhere

### Task 5.1: Update purchase.html

**Files:**
- Modify: `RoweOS/dist/purchase.html:710-712` (OpenAI section)

- [ ] **Step 1: Update OpenAI model strings**

Find:
```html
<strong>OpenAI:</strong> ChatGPT (GPT-5.4, GPT-5.4 Pro, GPT-5.4 Thinking)
```

Replace:
```html
<strong>OpenAI:</strong> ChatGPT (GPT-5.5, GPT-5.5 Pro, GPT-5.5 Thinking) + GPT Image 2
```

- [ ] **Step 2: Verify and commit**

```bash
grep -n "GPT-5\." RoweOS/dist/purchase.html
git add RoweOS/dist/purchase.html
git commit -m "v31.0: Update purchase.html OpenAI section to GPT-5.5 + GPT Image 2"
```

---

### Task 5.2: Update `send-template-email.js` model strings

**Files:**
- Modify: `RoweOS/dist/api/send-template-email.js:402`

- [ ] **Step 1: Update the inline model list**

Find:
```javascript
'GPT-5.4, GPT-5.4 Pro, GPT-5.4 Thinking'
```

Replace:
```javascript
'GPT-5.5, GPT-5.5 Pro, GPT-5.5 Thinking, GPT Image 2'
```

- [ ] **Step 2: Commit**

```bash
git add RoweOS/dist/api/send-template-email.js
git commit -m "v31.0: Update email template model lists to gpt-5.5"
```

---

### Task 5.3: Update onboarding provider tags

Already covered in Task 1.7 Step 2 — verify by re-running the grep:

```bash
grep -n "GPT-5\." src/html/core/04-views-batch3.html
```
Expected: only `GPT-5.5*` references (no `GPT-5.4*`).

---

### Task 5.4: Update info.html marketing copy

Already covered in Task 3.2 Step 4. Verify:

```bash
grep -n "GPT-5\." RoweOS/dist/info.html
```
Expected: only `GPT-5.5*` references.

---

### Task 5.5: Update sidebar/Settings model labels

Already covered in Task 1.6. Verify:

```bash
grep -rn "GPT-5\.4" src/js/core/21-sidebar.js
```
Expected: empty.

---

## Phase 6 — Build, Version Bump, Deploy, Verify

### Task 6.1: Bump version to v31.0 in all 8 locations

⚠ **Memory rule:** Never use `replace_all` on the version string. Edit each location individually.

**Files & locations** (per CLAUDE.md "Version Updates"):

1. `src/js/core/08-foundation.js` — `var ROWEOS_VERSION = 'v30.4'` → `'v31.0'`
2. `src/html/core/02-shell-batch1.html` — launch screen version label
3. `src/html/core/02-shell-batch1.html` — mobile header version label (separate occurrence)
4. `src/html/brand/...` — Settings panel version row
5. `src/html/core/04-views-batch3.html` — onboarding step 0 version tag (currently shows `v30.4` per discovery)
6. `src/html/core/03-views-batch2.html` — sidebar footer version
7. `src/js/core/22-firebase-sync.js` — console log `'[RoweOS v30.4]'`
8. `CLAUDE.md` — `Version: v30.4` in Quick Reference

- [ ] **Step 1: Find all current version references**

```bash
cd /Users/jordanrowe/Developer/roweOS && grep -rn "v30\.4" src/ CLAUDE.md
```

- [ ] **Step 2: Edit each location individually**

Use `Edit` tool per file. Confirm each edit affects exactly the intended line.

- [ ] **Step 3: Verify all 8 are updated**

```bash
grep -rn "v30\.4" src/ CLAUDE.md
```
Expected: empty.

```bash
grep -rn "v31\.0" src/ CLAUDE.md | wc -l
```
Expected: ≥8.

- [ ] **Step 4: Commit**

```bash
git add src/ CLAUDE.md
git commit -m "v31.0: Version bump"
```

---

### Task 6.2: Build & verify

- [ ] **Step 1: Build**

```bash
cd /Users/jordanrowe/Developer/roweOS && bash src/build.sh
```
Expected: build succeeds with no errors. Note any warnings.

- [ ] **Step 2: Optional sanity check**

```bash
bash src/verify.sh
```

If verify.sh produces a large diff, that's expected (lots of model strings changed). Skim for any unexpected changes.

- [ ] **Step 3: Spot-check the built file**

```bash
grep -c "gpt-5.5" RoweOS/dist/index.html
grep -c "gpt-5.4" RoweOS/dist/index.html
```
Expected: many `gpt-5.5` matches; the only `gpt-5.4` matches should be in the `_normalizeModel` and `_modelSupportsWebSearch` shims.

---

### Task 6.3: Deploy

- [ ] **Step 1: Run deploy script**

```bash
cd /Users/jordanrowe/Developer/roweOS && ./deploy.sh
```

If deploy.sh fails on git push:
```bash
export PATH="$HOME/.local/share/fnm:$PATH" && eval "$(fnm env)" && cd RoweOS/dist && vercel --prod --yes
```

---

### Task 6.4: End-to-end verification (live)

- [ ] **Step 1: Verify /info loads**

Visit `https://roweos.com/info`. Confirm:
- Page renders (NOT a 404 or proxy error)
- Signup form is at the bottom with name + email fields
- Marketing copy mentions GPT-5.5 + GPT Image 2

- [ ] **Step 2: Verify /info signup flow**

Submit the form with `name="Test Name"` `email="test+v31@example.com"`.
- Browser should redirect to `https://roweos.com/?email=test%2Bv31%40example.com&name=Test+Name&source=info`
- Auth gate should show with email + name prefilled, in "Create Account" mode
- Admin email should arrive at jordan@therowecollection.com with `Source: Info Page Lead`
- Firestore should have a new doc in `info_leads` collection

- [ ] **Step 3: Verify GPT-5.5 in Studio chat**

Open Studio → start a chat → in network tab confirm `model: 'gpt-5.5'` is in the Responses API request body.

- [ ] **Step 4: Verify GPT-5.5 Thinking with reasoning_effort**

Settings → set thinking effort to Low → run a Thinking op → confirm `reasoning.effort: 'low'` in request body.

- [ ] **Step 5: Verify GPT Image 2**

Generate an image via Calendar's image gen flow → confirm UI says "Generating with GPT Image 2..." → image renders.

- [ ] **Step 6: Verify Campaigns dashboard**

Admin → Campaigns tab. Confirm:
- 4 stats cards render
- Emails / Responses / Leads sections show data
- Template filter dropdown works
- Export CSV downloads a valid file

- [ ] **Step 7: Verify backwards compat**

Open localStorage in browser console:
```javascript
localStorage.setItem('roweos_studio_model', 'gpt-5.4');
location.reload();
```
Then run a Studio op. Confirm the request body uses `model: 'gpt-5.5'` (the shim normalized it).

---

### Task 6.5: Update memory + close

- [ ] **Step 1: Update `MEMORY.md` priorities**

Mark items 1-3 (email_log, onboarding_responses, server email templates) as resolved if verified during E2E. Move "Onboarding redesign (remove access key)" up the priority list as the next major work.

- [ ] **Step 2: Update `feedback_v24_bugs.md` (or relevant memory)**

Add a note: "v31.0: `adminLoadEmailData()` already uses `collectionGroup('responses')` — query was correct; data flow now verified end-to-end via Campaigns dashboard."

- [ ] **Step 3: Final commit**

```bash
git add docs/superpowers/plans/2026-04-25-info-signup-and-gpt-5.5-upgrade.md
git commit -m "v31.0: Mark plan complete"
```

---

## Self-Review Checklist (run after writing, before executing)

- [x] **Spec coverage:**
  - [x] /info signup form → Phase 3 (Tasks 3.2–3.5)
  - [x] Capture name/email + max info → Phase 3 (Task 3.4 captures UTM/IP/UA/referrer)
  - [x] Redirect to roweos.com login/signup → Phase 3 (Task 3.4 → 3.6)
  - [x] Admin notification email matching Welcome Screen template → Phase 3 (Task 3.3 reuses renderer)
  - [x] Email response dashboard → Phase 4 (Tasks 4.1–4.2)
  - [x] GPT 5.5 / 5.5 Pro / 5.5 Thinking with reasoning_effort → Phase 1 (Tasks 1.1–1.7)
  - [x] GPT Image 2 → Phase 2
  - [x] Advertising updates (info, purchase, system settings, onboarding, emails) → Phase 5 + Tasks 1.6, 1.7
- [x] **Placeholder scan:** OpenAI pricing values are flagged for verification (Task 1.5 Step 2) — this is intentional, not a placeholder; user confirmation required.
- [x] **Type consistency:** `_normalizeModel`, `_modelSupportsWebSearch`, `isOpenAIThinkingModel`, `_parseSignupURLParams`, `renderSignupEmail`, `adminLoadCampaigns`, `adminExportCampaignsCSV` — all referenced consistently across tasks.
- [x] **Decision points flagged:** Task 3.1 explicitly stops for user input on /info consolidation approach.

---

## Open Questions for User

Before executing, confirm:
1. **Info source consolidation:** OK to move `/info` into the main repo and retire `roweos.website`? (Plan assumes yes.)
2. **Pricing:** OK to fetch GPT-5.5 pricing from OpenAI docs and use those values? (Or do you have your own pricing model?)
3. **Reasoning effort default:** Default to `'high'` for GPT-5.5 Thinking, or something else?
4. **Version number:** Bump to v31.0 (proposed) or smaller increment like v30.5?
