# Research View -- Polish & Discoverability Design

**Date:** 2026-03-27
**Depends on:** `2026-03-27-research-view-core-design.md` (Spec 1 must be complete first)
**Scope:** Guide/helper knowledge update, guided tour, help/feedback integration for the Research view.

---

## Overview

After the core Research view is built (Spec 1), this spec covers making it discoverable and self-documenting: updating the RoweOS guide/helper so it knows about Research, creating a guided tour for first-time visitors, and wiring up the standard "?" help menu.

---

## 1. RoweOS Guide/Helper Knowledge Update

### What to Update

The RoweOS Helper agent's system prompt (line ~64843) contains a comprehensive feature overview. Add a new section for Research:

```
## RESEARCH (Web Intelligence)
Research lets you analyze any website or URL to extract structured intelligence.

**How to use:**
1. Open Research from the sidebar
2. Enter a URL (website, portfolio, LinkedIn, competitor site)
3. The system crawls the site (up to 20 pages), searches the web for additional context, and synthesizes a complete profile
4. View results as identity cards with a visual network graph showing all sources
5. Choose what to do with results: Save to Identity, Send to Chat, Save to Library, Add to Folio, or Copy

**Use cases:**
- Refresh or build a brand identity from a website
- Research a competitor before writing content
- Analyze a prospect's website before a sales call
- Import a life profile from a personal site or portfolio
- Save research for reference in Library or Folio

**Entry points:**
- Sidebar: click Research
- Identity view: click the Research button on any brand card
- Studio: use the Research quick action

**History:**
- Past researches are saved and accessible from the Research view
- Click any history card to re-view results without re-running
```

### Where to Add

Inside the system prompt string at line ~64843, after the existing feature sections (Studio, Bloom, Mail, etc.), add the Research section. Follow the same format as existing sections.

### Also Update

- `VIEW_FEATURE_MAP` (line ~130888): add `research: 'research'`
- The helper should be able to answer: "How do I research a competitor?" or "Where do I import brand identity from a website?"

---

## 2. Guided Tour

### Tour Definition

Add to `GUIDED_TOURS` object (line ~176121):

```javascript
research: [
  {
    selector: '#researchUrlInput',
    title: 'Start a Search',
    text: 'Enter any URL to analyze. We will crawl the site, search the web, and build a complete profile.'
  },
  {
    selector: '#researchGraphCanvas',
    title: 'Visual Network Graph',
    text: 'Watch pages being discovered and analyzed in real-time. Blue nodes are external web sources.'
  },
  {
    selector: '#researchCardsContainer',
    title: 'Identity Cards',
    text: 'Results are organized into identity sections. Each card shows AI-synthesized intelligence from all sources.'
  },
  {
    selector: '#researchActionsBar',
    title: 'Use Your Results',
    text: 'Save to a brand or life profile, send to an agent chat, add to Library or Folio, or copy as markdown.'
  },
  {
    selector: '#researchHistoryGrid',
    title: 'Research History',
    text: 'Past researches are saved here. Click any card to re-view results without running again.'
  }
]
```

### First-Visit Trigger

When `showView('research')` runs for the first time:
- Check `localStorage.getItem('roweos_tour_research') !== 'true'`
- If first visit, show a subtle prompt: "First time here? Take a quick tour" with [Start Tour] [Dismiss] buttons
- On dismiss, set `localStorage.setItem('roweos_tour_research', 'true')`
- On start, call `startGuidedTour('research')`
- Follow the existing pattern used by other views (e.g., `checkFirstVisitHelp`)

---

## 3. Help/Feedback Integration

### "?" Menu

Add the standard section help button to the Research view header. Wire it with `showSectionHelp('research')` which uses the existing `showSectionHelpDropdown` system.

The dropdown will show:
- **Take a Tour** -- triggers `startGuidedTour('research')`
- **Send Feedback** -- triggers `openFeedbackModal('research')`
- **Skip landing** toggle -- standard per-section pref
- **Open to** picker -- options: "Search" (URL input focused), "History" (history grid shown)
- **Reorder tabs** -- if Research has tabs/pills

### Feedback Area

Register `'research'` in the feedback system so submissions are tagged correctly. The `sectionToArea` map in `showSectionHelpDropdown` (line ~175752) doesn't need a mapping since 'research' maps to itself.

---

## 4. Landing Page Config

Add to `_pageLandingConfigs`:

```javascript
research: {
  label: 'RESEARCH',
  tagline: 'Web intelligence on demand',
  description: 'Analyze any website to extract structured intelligence. Crawl pages, search the web, and synthesize complete profiles.',
  features: [
    { id: 'search', label: 'New Search', desc: 'Enter a URL and run the full analysis pipeline' },
    { id: 'history', label: 'History', desc: 'View and revisit past research results' }
  ],
  secondary: [],
  tabHandler: 'switchResearchTab'
}
```

---

## Files Modified

All changes in `/Volumes/roweOS/RoweOS/dist/index.html`:

| Area | Change |
|------|--------|
| JS | Update RoweOS Helper system prompt (~line 64843) with Research section |
| JS | Add `research` to `VIEW_FEATURE_MAP` (~line 130888) |
| JS | Add `research` tour to `GUIDED_TOURS` (~line 176121) |
| JS | Add first-visit tour prompt logic in `showView('research')` |
| JS | Add `research` landing config to `_pageLandingConfigs` |
| HTML | Add "?" help button to Research view header |
| JS | Wire `showSectionHelp('research')` |

---

## Testing

1. Open Research view for the first time -- should see "Take a tour" prompt
2. Start the tour -- 5 steps highlighting URL input, graph, cards, actions, history
3. Ask the RoweOS helper "How do I research a competitor?" -- should explain the Research view
4. Click "?" in Research header -- should show tour, feedback, skip landing, open to options
5. Enable "Skip landing" for Research, then click Research in sidebar -- should go directly to view, not landing page
