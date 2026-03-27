# Onboarding Web Search Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two onboarding issues: (1) mobile brand onboarding falls through to manual Brand Basics when web search should be showing the visual review, (2) LifeAI initial onboarding has no website import option.

**Architecture:** For brand mobile, the web search redirect at step 7 fails silently when the web search didn't start (API key not found, async timing). Fix by making the redirect also check for a pending URL and starting the search lazily if needed. For LifeAI, route the shared onboarding to the life web import fork (step 0 in the life onboarding modal) before falling through to the basics form.

**Tech Stack:** Vanilla JS (ES5), single file `/Volumes/roweOS/RoweOS/dist/index.html`

---

### Task 1: Fix brand web search redirect at step 7 to handle lazy start

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:138647-138654`

The web search redirect at step 7 currently only fires if the web search is already active (`wsState.status !== 'idle'`). On mobile, the web search may not have started due to async API key retrieval or the model picker being skipped. Fix: also check for `_pendingWebSearchUrl` alone and start the web search lazily.

- [ ] **Step 1: Replace the step 7 web search redirect block**

Find lines 138647-138654:

```js
  // v26.5: Redirect to web search review step if web search is active
  if (step === 7) {
    var wsState = typeof getWebSearchState === 'function' ? getWebSearchState() : null;
    if (wsState && wsState.status !== 'idle' && (window._pendingWebSearchUrl || localStorage.getItem('roweos_pending_web_search_url'))) {
      goToOnboardingStep('websearch-review');
      return;
    }
  }
```

Replace with:

```js
  // v27.0: Redirect to web search review if web search is active OR a URL is pending
  if (step === 7) {
    var _wsUrl = window._pendingWebSearchUrl || localStorage.getItem('roweos_pending_web_search_url');
    var wsState = typeof getWebSearchState === 'function' ? getWebSearchState() : null;
    if (_wsUrl) {
      // Web search already running — go straight to review
      if (wsState && wsState.status !== 'idle') {
        goToOnboardingStep('websearch-review');
        return;
      }
      // URL is pending but search hasn't started yet (mobile timing issue / model picker skipped)
      // Start it now and go to review
      if (typeof startOnboardingWebSearch === 'function') {
        startOnboardingWebSearch();
      }
      goToOnboardingStep('websearch-review');
      return;
    }
  }
```

This ensures that if a URL was saved from the website import step but the search didn't start (API key async, model picker skip, etc.), it starts lazily when step 7 is reached and redirects to the review.

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: lazily start web search at step 7 if URL pending but search not started (mobile fix)"
```

---

### Task 2: Add web import choice to LifeAI initial onboarding flow

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:139795-139801`

Currently `proceedFromBetaWelcome()` routes life mode directly to `life1` (basics form). The life onboarding modal already has a web import fork (step 0 with "Import from Website" / "Manual Setup"), but it's only shown when creating additional profiles from the memory view.

Fix: for life mode in initial onboarding, open the life onboarding modal (which shows step 0 with the web import choice) instead of going to `life1` in the shared onboarding.

- [ ] **Step 1: Update `proceedFromBetaWelcome()` to open life onboarding modal**

Find lines 139795-139801:

```js
function proceedFromBetaWelcome() {
  if (selectedOnboardingMode === 'life') {
    goToOnboardingStep('life1');
  } else {
    goToOnboardingStep(7);
  }
}
```

Replace with:

```js
function proceedFromBetaWelcome() {
  if (selectedOnboardingMode === 'life') {
    // v27.0: Open life onboarding modal which shows web import fork (step 0) first
    // Hide the shared onboarding so the life modal appears cleanly
    hideOnboarding();
    // Mark as new profile creation so finishLifeOnboarding saves correctly
    window.isCreatingNewLifeProfile = true;
    // Use pendingNewLifeProfile from proceedFromModeSelection if available
    if (!window.pendingNewLifeProfile) {
      var profiles = getLifeProfiles();
      if (profiles.length > 0) {
        window.pendingNewLifeProfile = profiles[profiles.length - 1];
      }
    }
    if (typeof openLifeOnboarding === 'function') {
      openLifeOnboarding();
    } else {
      goToOnboardingStep('life1');
    }
  } else {
    goToOnboardingStep(7);
  }
}
```

- [ ] **Step 2: Ensure life onboarding modal marks shared onboarding as complete on finish**

Find `function closeLifeOnboarding` and check if it marks shared onboarding as complete. Search for it:

Find the function `closeLifeOnboarding()`. After the modal is hidden, add a line to mark shared onboarding complete if it was the initial flow:

After the line that hides the modal (`modal.classList.remove('show')` or `modal.style.display = 'none'`), add:

```js
    // v27.0: If this was the initial onboarding flow, mark onboarding as complete
    if (localStorage.getItem(USER_DATA_KEYS.onboardingCompleted) !== 'true') {
      localStorage.setItem(USER_DATA_KEYS.onboardingCompleted, 'true');
      // Trigger post-onboarding setup (cloud scheduler, mode UI, etc.)
      if (typeof finalizeOnboarding === 'function') finalizeOnboarding();
    }
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: LifeAI initial onboarding shows web import choice before basics form"
```

---

### Task 3: Verify and deploy

- [ ] **Step 1: Test brand web search on mobile**

1. Start onboarding, pick Brand mode
2. Enter brand name, go through ownership
3. Choose "Analyze Website" on step 2, enter a URL
4. Complete provider/API key setup
5. Continue through shared steps to step 7
6. Verify: should see web search review with network graph, NOT Brand Basics

- [ ] **Step 2: Test LifeAI onboarding with web import**

1. Start onboarding, pick Life AI mode
2. Continue through shared steps
3. At betaWelcome, click "Let's Go"
4. Verify: should see web import fork ("Import from Website" / "Manual Setup") NOT the basics form directly

- [ ] **Step 3: Deploy**

```bash
cd /Volumes/roweOS/RoweOS/dist && vercel --prod
```
