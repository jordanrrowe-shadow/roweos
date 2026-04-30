# B1: Bloom Launch Popup - Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Author:** Claude + Jordan Rowe

---

## Problem Statement

Bloom currently generates a default feed on launch with no user input on what kind of content they want to see. Users want to direct the AI generation with a "What do you want to see?" popup that drives a custom batch tailored to their selection.

## Architecture

On Bloom launch, show a modal with content type selection (text, info graphics, videos), optional topic input, and suggested topics pulled from brand identity/recent activity. The selection generates a custom 20-post batch using the chosen content type and topic as the AI generation directive. Users can choose "Ask me each time" or "Remember my choice."

**Tech Stack:** Vanilla ES5 JavaScript, single-file HTML app, existing Bloom feed infrastructure

**Critical Constraints:**
- ES5 only (no arrow functions, let/const, template literals)
- All edits in `RoweOS/dist/index.html`
- No emojis in UI -- SVG icons only

---

## Design

### Modal UI

On Bloom launch, if preference is "ask" or not set, show:

- **Content type selector:** Three clickable cards -- "Text", "Info Graphics", "Videos" (single select, default none)
- **Topic input:** Optional text field with placeholder "Enter a topic or leave blank for general"
- **Suggested topics:** Pills pulled from brand identity keywords, recent chat topics, Pulse goal names (max 6)
- **Preference toggle:** Radio buttons -- "Ask me each time" (default) / "Remember my choice"
- **Generate button:** "Generate Feed" -- disabled until content type is selected

### Data Flow

1. User opens Bloom -> `renderBloom()` checks `roweos_bloom_launch_pref`
2. If pref is `"ask"` or not set -> `showBloomLaunchModal()`
3. If pref is `"remember"` -> read `roweos_bloom_launch_type` and `roweos_bloom_launch_topic`, call `bloomGenerateWithDirective(type, topic)` directly
4. User selects content type + optional topic -> clicks "Generate Feed"
5. Modal closes, `bloomGenerateWithDirective(type, topic)` called
6. Directive injected into AI prompt: "Generate {contentType} content about {topic} for {brandName}"
7. `generateBloomBatch(20)` receives the directive and passes it through to `generateSingleBloomPost()`

### Storage

| Key | Values | Purpose |
|-----|--------|---------|
| `roweos_bloom_launch_pref` | `"ask"` or `"remember"` | Whether to show modal |
| `roweos_bloom_launch_type` | `"text"`, `"infographics"`, `"videos"` | Saved content type |
| `roweos_bloom_launch_topic` | Free text or empty | Saved topic |

### Suggested Topics Source

Pull from (in order, max 6 total):
1. Current brand's identity keywords (from brand settings)
2. Active Pulse goal names (top 3 by progress)
3. Recent chat conversation titles (last 3)

### Functions

| Function | Action |
|----------|--------|
| `showBloomLaunchModal()` | Creates and shows the modal overlay |
| `closeBloomLaunchModal()` | Removes modal, does NOT generate |
| `bloomSubmitLaunchChoice()` | Reads selections, stores prefs, calls generate, closes modal |
| `bloomGenerateWithDirective(type, topic)` | Wraps `generateBloomBatch()` with directive context |
| Modify: `renderBloom()` (~line 92667) | Add modal check before feed render |
| Modify: `generateBloomBatch()` (~line 93155) | Accept optional directive parameter |
| Modify: `generateSingleBloomPost()` | Inject directive into AI system prompt |

### Edge Cases

- **No content type selected:** Generate button stays disabled
- **Blank topic:** AI generates general content for the brand (existing behavior)
- **"Remember" then wants to change:** Add a "Change preferences" link in the Bloom header that re-shows the modal
- **LifeAI mode:** Suggested topics come from life goals/areas instead of brand identity
