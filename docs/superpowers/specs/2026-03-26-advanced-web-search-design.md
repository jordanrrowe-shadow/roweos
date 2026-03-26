# Advanced Web Search -- Onboarding & Reusable Module

**Date**: 2026-03-26
**Status**: Approved design
**Scope**: New onboarding step + standalone reusable module

---

## Overview

A deep web crawling + AI analysis pipeline that extracts brand identity (or personal identity for LifeAI) from a website URL. Runs in the background during onboarding while the user completes other setup steps. Includes a network graph visualization showing pages being discovered and identity cards filling in progressively.

The pipeline is built as a standalone reusable module (`advancedWebSearch`) so it can be used beyond onboarding -- in the Identity section for rescans, for research, competitor analysis, or a future mini AI browser experience.

---

## Onboarding Flow Changes

### BrandAI Sequence

1. Welcome screen (existing, unchanged)
2. Choose Business/Personal (existing, unchanged)
3. Enter name + brand name (existing, unchanged)
4. **NEW: "Import from Website" or "Manual Setup" fork**
   - Replaces existing `onboardingWebsiteImport` step entirely
   - If Import: user enters URL (just the domain -- `https://` auto-prepended if missing)
   - If Manual: skips to API key selection, no crawl
5. Select AI provider + enter API key (existing, unchanged)
6. **Crawl begins immediately after API key is validated** -- uses the selected provider
7. Remaining onboarding steps (integrations, calendar, social, email, automations) -- **floating crawl indicator visible** in bottom-right corner
8. **Brand setup step: full-screen visualization takeover** -- network graph + identity cards
9. Pre-filled identity fields for review/edit -- user adjusts before finishing

### LifeAI Sequence

Same fork after entering name:
- "Import from website/portfolio" or "Manual setup"
- Crawl extracts personal identity: role, skills, communication style, interests, etc.
- Pre-fills the 5 LifeAI onboarding steps instead of the 7 brand identity sections
- Same floating indicator + takeover visualization

### URL Input Behavior

- Input field placeholder: "yourcompany.com"
- No `https://` required from user
- Backend normalization: if URL doesn't start with `http://` or `https://`, auto-prepend `https://`
- Strip trailing slashes
- Validate it's a plausible domain before starting crawl
- Show inline error for obviously invalid input (no dots, spaces, etc.)

---

## Crawl Pipeline Architecture

Client-orchestrated, 5 stages. All runs in the browser -- no new backend infrastructure beyond enhancing the existing endpoint.

### Stage 1 -- Homepage Discovery (~2-3s)

- Enhanced `/api/fetch-site-meta` call with `mode: "deep"`
- Returns: page content (12k char limit), metadata, and `links[]` array of discovered internal URLs
- Links capped at 30, prioritized by keyword relevance (about, team, services, products, pricing, blog, contact)
- Network graph: center node appears (the homepage)

### Stage 2 -- Subpage Fan-out (~10-20s)

- Client fires parallel requests to `/api/fetch-site-meta` (mode: "content") for each discovered link
- Batched in groups of 5 to avoid rate limits
- Each response adds a node to the network graph and stores scraped text
- Cap: 20 subpages max
- 2 levels deep: subpages can discover their own links which get crawled too (within the 20 page cap)
- Pages returning errors or redirects get a dimmed node in the graph

### Stage 3 -- Gap Analysis (~3-5s)

- Client sends all accumulated text (concatenated, trimmed to model context limits) to user's AI provider
- Prompt: assess coverage of each identity section, identify gaps, suggest targeted search queries
- Returns JSON: `{ covered: [], partial: [], missing: [], searchQueries: [] }`
- No web search tool needed for this call -- pure text analysis

### Stage 4 -- External Web Search (~5-10s)

- Single AI call with web search enabled
- Uses provider's native capability: Claude `web_search` tool, GPT browsing, Gemini Google grounding
- Prompt includes gap analysis results, asks AI to research what's missing
- Network graph: external search nodes appear in blue with dashed lines (distinct from gold internal nodes)

### Stage 5 -- Final Synthesis (~3-5s)

- One AI call receives all scraped content + external research
- Produces polished content for each section (2-4 paragraphs each)
- BrandAI outputs: essence, voice, audience, messaging, products, visual, competitive
- LifeAI outputs: role/profession, skills & expertise, communication style, interests & passions, goals, daily routine, personality traits

**Total estimated time: 25-45 seconds**

### Token Budget

Concatenated scraped text trimmed to fit model context with room for prompt + response:
- Claude: ~80k chars
- GPT: ~60k chars
- Gemini: ~100k chars

If total exceeds limit, pages prioritized by relevance (About > Services > Blog posts) and lower-priority content dropped.

### Error Handling

- Individual page fetch failures: skip page, dimmed node in graph, continue pipeline
- Stage 3 (gap analysis) failure: skip to Stage 5 with just scraped data, no external search
- Stage 4 (web search) failure: Stage 5 runs with scraped data only, gaps flagged as "needs manual input"
- Complete pipeline failure: user sees message at brand setup step, falls back to manual entry
- Network offline: detect early, don't start crawl, show manual setup

---

## Visualization Design

Two visual states that work together:

### Floating Indicator (During Onboarding Steps)

- Compact pill positioned bottom-right on desktop, bottom-center on mobile
- Desktop: mini canvas network graph (pulsing) + "SCANNING" label + page count
- Mobile: simplified -- pulse dot + "Scanning..." text, no mini graph
- Non-intrusive, doesn't block onboarding interaction
- Tappable on mobile to see expanded status

### Full-Screen Takeover (Brand Setup Step)

- Triggers when user reaches the brand setup onboarding step
- Desktop: split layout -- network graph on left, identity cards on right
- Mobile: stacked vertically -- simplified graph top (~40% height), scrollable cards below

**Network Graph**:
- Canvas-based, force-directed layout
- Gold nodes = internal pages (labeled with path: /about, /services, etc.)
- Blue dashed nodes = external web search results
- Center node = homepage (larger)
- Lines connect pages to their parent discoverer
- Nodes appear with subtle animation as pages are crawled
- Node opacity reflects depth (deeper = more transparent)

**Identity Cards**:
- 7 cards for BrandAI (or LifeAI equivalent)
- States: waiting (dim, no content) -> analyzing (pulsing, "Analyzing...") -> filled (full opacity, content visible)
- Cards animate in as synthesis completes each section
- After all cards filled, brief completion animation, then transition to editable form

### Transition to Editable Fields

After the visualization completes:
- Cards transform into the standard onboarding form fields
- Each field pre-populated with the synthesized content
- User can edit any field before proceeding
- Clear indication these are AI-generated and editable: "We found this from your website. Edit anything that needs adjusting."

---

## Reusable Module Design

### `advancedWebSearch` Module

Core API:
```
startWebSearch(url, provider, apiKey, options) -> stateObject
onProgress(callback)   -- fires on stage change, page discovery, page completion
onComplete(callback)   -- fires with final structured results
cancel()               -- stops crawl at any point
getState()             -- returns current state for visualization
```

Options:
```
{
  mode: 'brand' | 'life' | 'custom',
  maxPages: 20,
  maxDepth: 2,
  enableExternalSearch: true,
  targetSections: [...],          // which sections to fill
  onPageDiscovered: fn,           // granular callback
  onPageCrawled: fn,              // granular callback
  onSectionFilled: fn             // granular callback
}
```

State object (`_webImportState`):
```
{
  status: 'idle' | 'discovering' | 'crawling' | 'analyzing' | 'searching' | 'synthesizing' | 'complete' | 'error',
  url: string,
  provider: 'anthropic' | 'openai' | 'google',
  pages: [{ url, title, content, status, depth }],
  gapAnalysis: { covered: [], missing: [], searchQueries: [] },
  externalResults: string,
  finalResults: {
    [sectionKey]: { ai: string, source: 'web-import' }
  }
}
```

State saved to localStorage periodically so page refresh doesn't lose progress.

### `WebSearchVisualizer` Component

Standalone rendering functions consuming the search state:
- `renderNetworkGraph(canvasEl, state)` -- force-directed graph
- `renderIdentityCards(containerEl, state)` -- progressive card fill
- `renderFloatingIndicator(containerEl, state)` -- compact pill

### Future Reuse

The module can be dropped into:
- Identity section: re-scan/refresh a brand's website anytime
- Mini AI browser experience for research tasks
- Social Hub: competitor website analysis
- Any view needing structured web intelligence

---

## API Changes

### Enhanced `/api/fetch-site-meta.js`

New `mode: "deep"` alongside existing `"meta"` and `"content"`:

**Request**:
```
POST /api/fetch-site-meta
{
  url: "https://acme.com",
  mode: "deep"
}
```

**Response** (deep mode):
```
{
  title: "Acme Corp",
  description: "...",
  ogImage: "...",
  favicon: "...",
  socialLinks: { x: "...", instagram: "...", ... },
  content: "full page text...",
  links: [
    { url: "https://acme.com/about", text: "About Us", priority: 1 },
    { url: "https://acme.com/services", text: "Services", priority: 2 },
    ...
  ]
}
```

Link priority scoring:
1. about, team, people, who-we-are
2. services, products, offerings, solutions, pricing
3. blog, news, press, media
4. contact, location
5. everything else

**URL normalization** (applied to all modes):
- Auto-prepend `https://` if no protocol present
- Strip trailing slashes
- Reject private IPs (existing security check)

Existing `"meta"` and `"content"` modes unchanged -- no breaking changes.

---

## Data Storage

### BrandAI Results

Written to existing Identity localStorage keys:
- `identity_essence_ai_[brandIdx]`
- `identity_voice_ai_[brandIdx]`
- `identity_audience_ai_[brandIdx]`
- `identity_messaging_ai_[brandIdx]`
- `identity_products_ai_[brandIdx]`
- `identity_visual_ai_[brandIdx]`
- `identity_competitive_ai_[brandIdx]`

Synced to Firestore via existing `autoSaveIdentityField()`.

### LifeAI Results

Written to existing LifeAI profile structure via `saveLifeProfiles()`:
- `profile.identityData.personal` -- age, location, traits (array of `{ type, value, source: 'web-import' }`)
- `profile.identityData.work` -- role, business, schedule
- `profile.identityData.health` -- conditions, dietary, allergies (if found on personal site)
- `profile.identityData.family` -- status (if found)
- `profile.preferences.productiveTime` -- work style
- `profile.preferences.communicationStyle` -- communication approach
- `profile.aboutMe` -- synthesized bio from website/portfolio

The synthesis prompt maps website content to these LifeAI categories rather than brand identity sections.

### Crawl State

- `roweos_web_import_state` -- serialized pipeline state for refresh resilience
- Cleared after onboarding completes successfully

---

## AI Prompt Design

### Call 1 -- Gap Analysis

**Input**: Concatenated scraped page content + brand name + URL
**System prompt**: You are a brand strategist analyzing website content.
**Task**: Assess which identity sections have strong data coverage and which need external research. Return JSON with covered/partial/missing sections and suggested search queries.
**Output**: Structured JSON -- no web search tool needed.

### Call 2 -- External Web Search

**Input**: Gap analysis results + brand context
**System prompt**: You are researching a brand to fill gaps in their identity profile.
**Task**: Use web search to find information about the missing/partial sections.
**Tools**: Provider-native web search (Claude web_search, GPT browsing, Gemini grounding)
**Output**: Research findings organized by identity section.

### Call 3 -- Final Synthesis

**Input**: All scraped content + external research + brand name
**System prompt**: You are a brand strategist creating a comprehensive brand identity profile.
**Task**: Synthesize all gathered information into polished, concise content for each section. 2-4 paragraphs per section. Professional tone, specific to the brand (not generic filler).
**Output**: Structured JSON with content per section key.

For LifeAI, prompts are adapted to extract personal identity rather than brand identity.

### Error Resilience

- Call 2 failure: Call 3 runs with scraped data only, flags gaps as "needs manual input"
- Call 3 failure: raw scraped data presented to user with message to manually organize
- Provider rate limit: exponential backoff with 3 retries, then fail gracefully
