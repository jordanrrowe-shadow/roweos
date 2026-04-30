# Research View -- Core Feature Design

**Date:** 2026-03-27
**Scope:** Standalone Research view with web search pipeline, visual output, flexible actions, history, and entry points from Identity + Studio.

---

## Overview

A new top-level view in the sidebar that lets users run the advanced web search pipeline on any URL, see the visual network graph + identity cards output, and then choose what to do with the results: save to a brand/life identity, send to an agent chat, save to Library, add to Folio, or just copy.

The existing 5-stage pipeline (`startWebSearch` -> discover -> crawl -> gap analysis -> web search -> synthesis) and the WebSearchVisualizer (network graph canvas + identity cards) are reused from onboarding. The floating indicator already works globally.

---

## 1. Research View Layout

### New View: `researchView`

**View ID:** `research`
**Sidebar position:** Between Folio and History (both Brand and LifeAI modes)
**Landing page config:** Yes, added to `_pageLandingConfigs`

### Three States

**Empty State (no active search):**
```
+--------------------------------------------------+
| [Globe icon]  Research                     [?]   |
|                                                  |
|  +--------------------------------------------+ |
|  | https://  [ Enter a URL to research...    ] | |
|  +--------------------------------------------+ |
|                                                  |
|  Recent Researches                               |
|  +------+ +------+ +------+                     |
|  | card | | card | | card |   (history items)   |
|  +------+ +------+ +------+                     |
+--------------------------------------------------+
```

**Running State (search in progress):**
```
+--------------------------------------------------+
| [Globe icon]  Research                     [?]   |
|                                                  |
|  +--------------------------------------------+ |
|  | https://  [ example.com              ] [X] | |
|  +--------------------------------------------+ |
|                                                  |
|  +--------------------------------------------+ |
|  |          NETWORK GRAPH CANVAS               | |
|  |    (reuse renderNetworkGraph)               | |
|  +--------------------------------------------+ |
|  +------+ +------+ +------+ +------+           |
|  | card | | card | | card | | card |  (ident.) |
|  +------+ +------+ +------+ +------+           |
+--------------------------------------------------+
```

**Results State (search complete):**
```
+--------------------------------------------------+
| [Globe icon]  Research                     [?]   |
|                                                  |
|  +--------------------------------------------+ |
|  | https://  [ example.com              ] [Go]| |
|  +--------------------------------------------+ |
|                                                  |
|  Summary: 18 pages scanned | 4 web searches |   |
|           12 sources | 45 seconds                |
|                                                  |
|  +------+ +------+ +------+ +------+           |
|  | card | | card | | card | | card |  (filled) |
|  +------+ +------+ +------+ +------+           |
|                                                  |
|  [Save to Identity] [Send to Chat]              |
|  [Save to Library]  [Add to Folio] [Copy]       |
|                                                  |
|  Sources Used                                    |
|  - example.com/about (depth 0)                   |
|  - example.com/team (depth 1)                    |
|  - linkedin.com/... (external)                   |
+--------------------------------------------------+
```

---

## 2. URL Input Bar

- Always visible at top of the Research view
- Prefix label "https://" (like onboarding)
- Input placeholder: "Enter a URL to research..."
- Submit button: "Research" (or enter key)
- Cancel button (X) visible during active search, calls `_webSearchState._aborted = true`
- Validates: must contain a dot, auto-prepends `https://` if missing

---

## 3. Pipeline Integration

Reuse the existing pipeline functions directly:

- `startWebSearch(url, provider, apiKey, model, brandName, mode, callbacks)` -- called with the current brand/profile's provider + model from `brandSettings` or equivalent
- Provider/model: use the currently selected brand's provider and model (from `brandSettings[selectedBrand]`), or the life profile's configured provider. Fall back to first available API key.
- API key: resolved via existing `getApiKey(provider)`

**Callbacks wired to Research view:**
- `onProgress`: update network graph + cards in the Research view (not onboarding)
- `onComplete`: transition to Results state, show action buttons + sources list
- `onError`: show error state with retry button

The floating indicator (`renderFloatingIndicator`) continues to work globally so users can navigate away.

---

## 4. Results Actions

Five action buttons, each independent (user can do multiple):

### Save to Identity
- Opens a dropdown/picker listing all brands (Brand mode) or life profiles (Life mode)
- Selecting one calls existing `saveWebSearchResults()` logic but targeted at the chosen brand/profile index
- If the selected brand/profile already has identity data, the `.ai` field on each section is **replaced** with the new research (not appended -- fresh research = fresh data)
- Shows toast: "Research saved to [brand name]'s identity"

### Send to Chat
- Formats the synthesis results as a context message
- Includes: all section summaries + source URLs
- Opens the agent chat view (`showView('agent')`) with the research injected as the first message or system context
- User can then ask follow-up questions about the research

### Save to Library
- Saves as a file in the current brand/life Library folder
- File structure:
  ```javascript
  {
    id: 'file_' + Date.now(),
    name: 'Research - ' + domain + ' - ' + dateString,
    type: 'text/markdown',
    content: markdownFormattedResults,
    folderId: 'root',
    createdAt: new Date().toISOString(),
    metadata: {
      source: 'research',
      url: researchUrl,
      pagesScanned: pageCount,
      provider: provider
    }
  }
  ```
- Shows toast: "Research saved to Library"

### Add to Folio
- Creates a Folio item using `saveFolioItem()`:
  ```javascript
  {
    id: 'folio_' + Date.now(),
    title: 'Research: ' + domain,
    html: renderedResearchHTML,
    versions: [{ id: 'v_' + Date.now(), html: renderedHTML, description: 'Web research', timestamp: ISO, source: 'research' }],
    comments: [],
    conversation: [],
    brand: currentBrandName,
    brandIdx: selectedBrand,
    createdAt: ISO,
    updatedAt: ISO,
    pinned: false
  }
  ```
- The `html` contains a formatted research report with sections, source links, and metadata
- Shows toast: "Research added to Folio"

### Copy
- Copies full synthesis as clean markdown to clipboard
- Format:
  ```
  # Research: example.com
  Date: 2026-03-27

  ## Brand Essence
  [synthesis text]

  ## Voice & Tone
  [synthesis text]

  ...

  ## Sources
  - https://example.com/about
  - https://example.com/team
  - https://linkedin.com/...
  ```
- Shows toast: "Research copied to clipboard"

---

## 5. Research History

### Storage
- **localStorage key:** `roweos_research_history`
- **Firebase path:** `profile/researchHistory`
- **Max entries:** 20 (oldest auto-pruned)

### History Item Structure
```javascript
{
  id: 'research_' + Date.now(),
  url: 'https://example.com',
  domain: 'example.com',
  mode: 'brand' | 'life',
  brandName: 'My Brand' | null,
  profileName: 'Jordan' | null,
  status: 'complete' | 'error',
  completedAt: ISO string,
  pageCount: 18,
  sourceCount: 12,
  durationMs: 45000,
  sections: { essence: '...first 100 chars...', voice: '...', ... },
  fullResults: { essence: '...full text...', voice: '...', ... },
  pages: [{ url, title, depth, isExternal }]
}
```

### History UI (Empty State)
- Grid of cards showing: domain favicon placeholder, domain name, brand/profile name, date, page count
- Clicking a card loads results into the Results state (no re-running the pipeline)
- Swipe-to-delete on mobile, X button on desktop
- "Clear All" link at bottom

### Sync
- Saved via `writeDB('profile/researchHistory', { items: historyArray })`
- Loaded during `loadFromFirebaseV2` alongside other profile data

---

## 6. Entry Points

### From Identity View
- On each brand card or identity section header, add a small "Research" button (globe icon)
- `onclick`: navigates to Research view with the brand's website URL pre-filled
- If brand has no website, opens Research view empty with a toast "Enter a URL to research"
- Implementation: `launchResearch(url, brandIdx)` function that sets `window._researchPrefill = { url, brandIdx }` then calls `showPageLanding('research')` or `showView('research')`

### From Studio
- In the Studio agent input area, add a "Research" quick action button
- Clicking it opens a small URL input inline, then navigates to Research view with that URL
- After research completes, "Send to Chat" brings results back to Studio conversation

### From Sidebar
- New nav item in both grouped and expanded sidebar modes
- Icon: globe with magnifying glass or similar
- Position: after Folio, before History

---

## 7. Mode Awareness

- **Brand mode:** Research outputs 7 brand identity sections (essence, voice, audience, messaging, products, visual, competitive). "Save to Identity" targets brands.
- **Life mode:** Research outputs 7 life sections (role, skills, communication, interests, goals, routine, personality). "Save to Identity" targets life profiles.
- The pipeline already handles this via the `mode` parameter passed to `startWebSearch()`.
- History entries tagged with mode so Brand/Life histories don't mix.

---

## Files Modified

All changes in `/Volumes/roweOS/RoweOS/dist/index.html`:

| Area | Change |
|------|--------|
| HTML | Add `#researchView` div with URL input, graph canvas, cards container, actions bar, history grid |
| HTML | Add sidebar nav item for Research (desktop + mobile) |
| JS | `renderResearchView()` -- initializes the view, renders history |
| JS | `startResearchFromView(url)` -- wires URL input to pipeline with Research view callbacks |
| JS | `renderResearchResults()` -- renders completed results with action buttons |
| JS | `saveResearchToIdentity(brandIdx)` -- delegates to modified `saveWebSearchResults()` |
| JS | `sendResearchToChat()` -- formats and injects into agent conversation |
| JS | `saveResearchToLibrary()` -- creates Library file entry |
| JS | `saveResearchToFolio()` -- creates Folio item |
| JS | `copyResearchResults()` -- clipboard copy as markdown |
| JS | `loadResearchHistory()` / `saveResearchHistory()` -- CRUD for history |
| JS | `launchResearch(url, brandIdx)` -- entry point from Identity/Studio |
| JS | `_pageLandingConfigs['research']` -- landing page config |
| JS | `showView('research')` case in view router |
| CSS | Research view styles (URL bar, history cards, action buttons, sources list) |
| Identity view | Add "Research" button on brand cards |
| Studio view | Add "Research" quick action |
| Sync | Add `researchHistory` to `loadFromFirebaseV2` and `syncToFirebase` |
