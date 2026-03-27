# Skip Provider Step on Add Brand/Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When adding a new brand or life profile (not first-time onboarding), skip the AI provider/API key selection steps since Research now handles its own provider resolution with fallback.

**Architecture:** Detect when keys already exist at the point where the provider step would be shown. If any valid API key is available, skip provider + API key + model picker steps and go directly to the brand setup (ownership -> step 2 choice) or life onboarding (step 0 fork). The first-time onboarding flow (no keys at all) remains unchanged.

**Tech Stack:** Vanilla JS (ES5), single file

**File:** All changes in `/Volumes/roweOS/RoweOS/dist/index.html`

---

### Context: Current Flows

**Add Brand (current):**
```
Welcome (0) -> Mode -> Name -> Provider -> API Key (4) -> Model Picker -> Logo -> BLAKE -> Sync -> ... -> betaWelcome -> Step 2 (choice) -> Website/Manual
```

**Add Brand (target -- when keys exist):**
```
Name (brand name only) -> Ownership -> Step 2 (Analyze Website / Manual) -> Brand Basics or Web Search
```

**Add Profile (current):**
```
Life onboarding modal -> Step 0 (web import fork) -> Steps 1-5 (basics, work, health, family, prefs)
```

**Add Profile (target -- same, already doesn't require provider):**
```
Life onboarding modal -> Step 0 (web import fork) -> Steps 1-5
```

LifeAI already skips provider. The main fix is for Add Brand.

---

### Task 1: Modify `launchOnboardingForNewBrand()` to skip to name step when keys exist

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:~144560`

- [ ] **Step 1: Find `launchOnboardingForNewBrand()` and add key detection**

Find `function launchOnboardingForNewBrand` (around line 144560). Read the current implementation.

The function currently resets state and calls `goToOnboardingStep(0)` (Welcome screen), which leads to the full onboarding flow including provider selection.

Replace it to detect existing API keys and skip straight to the name step:

```js
function launchOnboardingForNewBrand() {
  resetOnboardingState();
  selectedOnboardingMode = 'brand';
  localStorage.setItem('roweos_onboarding_mode', 'brand');
  window._onboardingInProgress = true;

  // Show onboarding modal
  var modal = document.getElementById('onboardingModal');
  if (modal) {
    modal.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 10000 !important;';
    modal.classList.add('show');
  }

  // v27.0: If API keys already exist, skip welcome/mode/provider steps
  // Go straight to name step (which routes to ownership -> step 2 choice)
  var hasKeys = false;
  try {
    var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    hasKeys = !!(keys.anthropic || keys.openai || keys.google);
  } catch(e) {}

  if (hasKeys) {
    // Pre-set mode as brand since we're skipping mode selection
    if (typeof setAppMode === 'function') setAppMode('brand');
    // Skip to name step -- user enters brand name, then ownership -> step 2
    goToOnboardingStep('name');
    // Update the name step UI for brand mode
    if (typeof updateSharedNameStepUI === 'function') updateSharedNameStepUI();
  } else {
    // No keys -- full onboarding flow needed
    goToOnboardingStep(0);
  }
}
```

**IMPORTANT:** Before making this edit, read the existing `launchOnboardingForNewBrand` function to preserve any other setup logic (like hiding welcome screens, setting z-index, etc.). Merge the new key-check logic with whatever exists.

- [ ] **Step 2: Verify `proceedFromSharedName` routes correctly for brand**

Read `proceedFromSharedName()` (~line 138883). Confirm that for brand mode, it goes to `goToOnboardingStep('ownership')` which then goes to `goToOnboardingStep(2)` (the Analyze Website / Manual choice). This should already work -- no changes needed.

- [ ] **Step 3: Ensure provider/model defaults are set when skipping**

When skipping the provider step, the brand's provider/model still needs to be set. Find where `completeBrandSetup()` reads the provider (~line 143638):

```js
var selectedProvider = window.onboardingSelectedProvider || 'anthropic';
```

This already falls back to 'anthropic' if no provider was selected. And the Research pipeline already forces valid model names. So no changes needed here.

- [ ] **Step 4: Test the Add Brand flow**

1. With API keys configured, click "+ Add Brand"
2. Should see: Name step (enter brand name) -> Ownership -> Step 2 (Analyze Website / Manual)
3. Should NOT see: Welcome, Mode selection, Provider, API Key, Model Picker
4. Verify brand is created and saved correctly

- [ ] **Step 5: Test first-time onboarding still works**

1. Clear all API keys from Settings
2. Start fresh onboarding
3. Should see full flow including Provider and API Key steps
4. Verify onboarding completes correctly

- [ ] **Step 6: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): skip provider/API key steps on Add Brand when keys already exist"
```

---

### Task 2: Skip shared steps on Add Brand (logo, sync, etc.)

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

The current flow after name -> ownership -> step 2 goes through: provider -> API key -> model -> logo -> BLAKE -> sync -> email -> social -> automations -> workspace -> sidebar -> push -> crossDevice -> betaWelcome -> step 7.

For Add Brand (not first-time), we should skip from step 2 directly to brand setup. The user already has logo, sync, workspace preferences from their first onboarding.

- [ ] **Step 1: Modify `proceedFromOwnership()` to detect Add Brand vs first-time**

Find `proceedFromOwnership()` (~line 158984). Currently it goes to `goToOnboardingStep(2)` (the website/manual choice). This is correct.

But step 2's "Create Manually" goes to `goToOnboardingStep(3)` (provider step), which we need to skip. And "Analyze Website" goes to `showWebsiteImportStep()` then `saveWebsiteUrlAndContinue()` -> `goToOnboardingStep(3)` (also provider).

**Step 2 choice buttons need to skip provider when keys exist:**

Find step 2 HTML (onboardingStep2, ~line 50592). The "Create Manually" button calls:
```html
onclick="goToOnboardingStep(3)"
```

And the "Analyze Website" button calls:
```html
onclick="showWebsiteImportStep()"
```

After `showWebsiteImportStep`, `saveWebsiteUrlAndContinue()` calls `goToOnboardingStep(3)`.

**Fix:** Create a routing function that skips provider when keys exist:

```js
function proceedFromOnboardingChoice(choice) {
  if (choice === 'website') {
    showWebsiteImportStep();
    return;
  }
  // "Manual" choice -- skip provider if keys exist
  var hasKeys = false;
  try {
    var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
    hasKeys = !!(keys.anthropic || keys.openai || keys.google);
  } catch(e) {}
  if (hasKeys) {
    // Skip provider/API/model, go straight to brand basics (step 7)
    goToOnboardingStep(7);
  } else {
    goToOnboardingStep(3);
  }
}
```

Update step 2 "Create Manually" button onclick from `goToOnboardingStep(3)` to `proceedFromOnboardingChoice('manual')`.

- [ ] **Step 2: Fix `saveWebsiteUrlAndContinue` to skip provider when keys exist**

Find `saveWebsiteUrlAndContinue()` (~line 159218). It calls `goToOnboardingStep(3)` after saving the URL. Change it to skip provider:

```js
// After saving URL...
var hasKeys = false;
try {
  var keys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}');
  hasKeys = !!(keys.anthropic || keys.openai || keys.google);
} catch(e) {}
if (hasKeys) {
  // Start web search immediately with existing keys, skip to step 7
  // (step 7 will redirect to websearch-review if URL is pending)
  if (typeof startOnboardingWebSearch === 'function') startOnboardingWebSearch();
  goToOnboardingStep(7);
} else {
  goToOnboardingStep(3);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): skip provider step from website/manual choice when keys exist"
```

---

### Task 3: Deploy and verify

- [ ] **Step 1: Test Add Brand with "Analyze Website"**

1. Click "+ Add Brand" (with keys configured)
2. Enter brand name -> Ownership -> Step 2
3. Click "Analyze Website" -> Enter URL -> Continue
4. Should start web search immediately and go to review step
5. Should NOT show provider/API key/model picker

- [ ] **Step 2: Test Add Brand with "Create Manually"**

1. Click "+ Add Brand"
2. Enter brand name -> Ownership -> Step 2
3. Click "Create Manually"
4. Should go straight to Brand Basics (step 7)
5. Should NOT show provider/API key steps

- [ ] **Step 3: Test first-time onboarding (no keys)**

1. Clear API keys
2. Start fresh onboarding
3. Full flow should work: Welcome -> Mode -> Name -> Provider -> API Key -> etc.

- [ ] **Step 4: Test Add Life Profile**

1. Switch to Life mode
2. Click "+ Add Profile"
3. Should show life onboarding modal with Step 0 (web import fork)
4. Already skips provider -- verify still works

- [ ] **Step 5: Deploy**

```bash
cd /Volumes/roweOS/RoweOS/dist && vercel --prod
```
