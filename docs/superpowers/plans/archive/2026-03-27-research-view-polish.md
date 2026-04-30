# Research View Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Research view discoverable via guide/helper knowledge update, guided tour, and help/feedback integration.

**Architecture:** Update the RoweOS Helper system prompt with Research feature documentation, add a 5-step guided tour to `GUIDED_TOURS`, and wire the standard "?" help menu. Depends on Plan 1 (core) being complete.

**Tech Stack:** Vanilla JS (ES5), single file

**File:** All changes in `/Volumes/roweOS/RoweOS/dist/index.html`

**Spec:** `docs/superpowers/specs/2026-03-27-research-view-polish-design.md`

---

### Task 1: Update RoweOS Helper system prompt

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:~64843-64879`

- [ ] **Step 1: Add Research section to the guide's system prompt**

Find the RoweOS Helper agent system prompt (line ~64843). Look for the last feature section (it will be something like AUTOMATIONS or SOCIAL). After the last feature section, add:

```
## RESEARCH (Web Intelligence)
Research lets you analyze any website or URL to extract structured intelligence.

How to use:
1. Open Research from the sidebar
2. Enter a URL (website, portfolio, LinkedIn, competitor site)
3. The system crawls up to 20 pages, searches the web for gaps, and synthesizes a complete identity profile
4. View results as identity cards alongside a visual network graph showing all sources
5. Choose what to do: Save to Identity, Send to Chat, Save to Library, Add to Folio, or Copy

Use cases:
- Refresh or build a brand identity from a website
- Research a competitor before writing content
- Analyze a prospect's website before outreach
- Import a life profile from a personal site or portfolio
- Save research for reference in Library or Folio

Entry points: Sidebar (Research), Identity view (Research button on brand cards)

History: Past researches are saved and viewable. Click any history card to re-view results without re-running.
```

- [ ] **Step 2: Update VIEW_FEATURE_MAP**

Find `VIEW_FEATURE_MAP` (line ~130888). Add:
```js
research: 'research',
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): update RoweOS Helper knowledge with Research feature"
```

---

### Task 2: Add guided tour for Research view

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:~176121`

- [ ] **Step 1: Add research tour to GUIDED_TOURS**

Find the `GUIDED_TOURS` object (line ~176121). After the `folio` tour entry, add:

```js
research: [
  { selector: '#researchUrlInput', title: 'Start a Search', text: 'Enter any URL to analyze. RoweOS will crawl the site, search the web for context, and build a complete profile.' },
  { selector: '#researchGraphCanvas', title: 'Visual Network Graph', text: 'Watch pages being discovered and analyzed in real-time. Each node represents a page or web source.' },
  { selector: '#researchCardsContainer', title: 'Identity Cards', text: 'Results appear as identity section cards. Each shows AI-synthesized intelligence from all sources.' },
  { selector: '#researchActionsBar', title: 'Use Your Results', text: 'Save to a brand or life identity, send to an agent chat, save to Library, add to Folio, or copy as markdown.' },
  { selector: '#researchHistoryGrid', title: 'Research History', text: 'Past researches are saved here. Click any card to re-view results without running the search again.' }
],
```

- [ ] **Step 2: Add first-visit tour prompt in renderResearchView()**

Find the `renderResearchView()` function (added in Plan 1). At the end of the function, add:

```js
  // v27.0: First-visit tour prompt
  if (localStorage.getItem('roweos_tour_research') !== 'true') {
    var histSection = document.getElementById('researchHistorySection');
    if (histSection) {
      var tourPrompt = document.createElement('div');
      tourPrompt.id = 'researchTourPrompt';
      tourPrompt.style.cssText = 'text-align:center;padding:20px;margin-top:var(--space-4);background:rgba(168,152,120,0.06);border:1px solid rgba(168,152,120,0.15);border-radius:var(--radius-md);';
      tourPrompt.innerHTML = '<p style="margin:0 0 12px;color:var(--text-secondary);font-size:var(--text-sm);">First time here? Take a quick tour of Research.</p>' +
        '<div style="display:flex;gap:8px;justify-content:center;">' +
        '<button class="btn btn-primary" onclick="localStorage.setItem(\'roweos_tour_research\',\'true\');document.getElementById(\'researchTourPrompt\').remove();startGuidedTour(\'research\')" style="padding:8px 20px;font-size:var(--text-sm);">Start Tour</button>' +
        '<button class="btn btn-secondary" onclick="localStorage.setItem(\'roweos_tour_research\',\'true\');document.getElementById(\'researchTourPrompt\').remove()" style="padding:8px 16px;font-size:var(--text-sm);">Dismiss</button>' +
        '</div>';
      histSection.parentNode.insertBefore(tourPrompt, histSection);
    }
  }
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): add Research guided tour + first-visit prompt"
```

---

### Task 3: Wire help/feedback "?" menu

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Verify the "?" button is in the Research view HTML**

The Research view HTML (added in Plan 1, Task 2) already includes:
```html
<button class="section-help-btn" onclick="showSectionHelp('research')" title="Help">?</button>
```

Verify this is present. If so, no additional HTML changes needed.

- [ ] **Step 2: Verify showSectionHelpDropdown handles 'research'**

The existing `showSectionHelpDropdown` (line ~175747) already:
- Checks `_pageLandingConfigs[sectionId]` (research config added in Plan 1)
- Checks `GUIDED_TOURS[sectionId]` (research tour added in Task 2)
- Shows tour link, feedback link, skip landing toggle, open-to picker

Since research is registered in both `_pageLandingConfigs` and `GUIDED_TOURS`, the "?" menu should work automatically. No code changes needed -- just verify.

- [ ] **Step 3: Test the "?" menu**

1. Open Research view
2. Click "?" button
3. Verify dropdown shows: Take a Tour, Send Feedback, Skip landing toggle, Open to picker
4. Test "Take a Tour" triggers the research tour
5. Test "Send Feedback" opens feedback modal tagged as 'research'
6. Test "Skip landing" toggle persists and works on next sidebar click
7. Test "Open to" with "Search" and "History" options

- [ ] **Step 4: Commit (if any fixes needed)**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(v27.0): verify Research help/feedback integration"
```

---

### Task 4: Deploy and verify polish

- [ ] **Step 1: Test guide knowledge**

Ask the RoweOS Helper (agent chat): "How do I research a competitor?" -- should explain the Research view.

- [ ] **Step 2: Test guided tour**

Open Research for the first time (clear `roweos_tour_research` from localStorage if needed). Should see "First time here?" prompt. Start the tour. All 5 steps should highlight correctly.

- [ ] **Step 3: Test landing page**

Click Research in sidebar. Should show landing page with "New Search" and "History" feature cards. Enable "Skip landing" via "?" menu, click Research again -- should go straight to view.

- [ ] **Step 4: Deploy**

```bash
cd /Volumes/roweOS/RoweOS/dist && vercel --prod
```
