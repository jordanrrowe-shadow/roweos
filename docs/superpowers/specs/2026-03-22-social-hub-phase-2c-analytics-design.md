# Social Hub Phase 2C: Analytics Dashboard

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Build the Analytics tab with AI-powered social insights, post performance tracking from Firestore data, and optional API metrics when available.

---

## Design

### 1. Data Strategy

**Primary data source: Firestore (always available)**
- `social_activity` subcollection -- all posts published, scavenger replies, timestamps, platforms
- `scavenger_targets` subcollection -- targets found, scores, approval rates, response times
- `roweos_social_post_history` localStorage -- post content, URLs, platforms, timestamps

**Secondary data source: X API (when available)**
- `GET /2/users/:id/tweets` with `tweet.fields=public_metrics` -- impressions, likes, replies, reposts per tweet
- `GET /2/users/:id` with `user.fields=public_metrics` -- follower count
- Requires user OAuth token with `tweet.read` scope (already granted)
- Basic tier supports these endpoints (no Pro required for own tweet metrics)

**Tertiary: AI-generated insights**
- AI analyzes patterns in the data and generates natural language insights
- Content recommendations, best posting times, engagement trends
- Competitor analysis by analyzing public profiles (no API needed -- uses search)

---

### 2. Dashboard Layout

**Summary cards (top row):**
- Total posts (this week/month)
- Total scavenger engagements (approved + posted)
- Average engagement score (from scavenger scoring)
- Active platforms count

**Post Performance section:**
- List of recent posts with per-post metrics (if X API available: impressions, likes, replies, reposts)
- If API not available: shows post content, platform, timestamp, and "Connect X for metrics" prompt
- Sortable by date, engagement
- Click a post to see details + "View on X" link

**Engagement Trends section:**
- Simple chart showing posts per day/week over time (rendered as CSS bar chart, no charting library needed)
- Scavenger activity over time (targets found, approved, posted)

**AI Insights section:**
- "Generate Insights" button -- analyzes last 30 days of activity data
- AI generates 3-5 bullet point insights:
  - Best performing content types
  - Optimal posting times based on engagement patterns
  - Keywords/topics that drive engagement
  - Recommendations for improvement
  - Competitor observations (if any competitor data from Engage tab searches)
- Insights cached in localStorage for 24 hours (`roweos_analytics_insights`)

**Content Breakdown section:**
- Platform distribution pie (CSS-based, no chart library): % of posts to X, Threads, Instagram, TikTok
- Post type breakdown: text only, with image, scavenger reply, blog summary

---

### 3. Competitor Tracking

**Simple approach (no API needed):**
- "Track Competitor" input -- enter an X handle
- Stores handles in localStorage: `roweos_analytics_competitors`
- When "Generate Insights" runs, it includes competitor handles in the AI prompt
- AI comments on how your posting frequency/topics compare
- Optional: use the Engage tab's X search to fetch recent competitor posts and analyze content patterns

---

### 4. Functions

- `initAnalyticsTab()` -- load data, render dashboard
- `loadAnalyticsData()` -- fetch from Firestore social_activity + scavenger_targets, merge with localStorage post history
- `renderAnalyticsSummary()` -- summary cards
- `renderPostPerformance()` -- post list with metrics
- `fetchPostMetrics()` -- call X API for tweet metrics (graceful if unavailable)
- `renderEngagementTrends()` -- CSS bar chart
- `generateAIInsights()` -- call AI with activity data, render insights
- `renderContentBreakdown()` -- platform/type distribution
- `addCompetitor()` / `removeCompetitor()` / `renderCompetitors()` -- competitor tracking
- `renderAnalyticsTab()` -- orchestrates all sections

---

## Files to Modify

| File | Change |
|---|---|
| `RoweOS/dist/index.html` | Replace Analytics placeholder with dashboard HTML + CSS + JS. Add all analytics functions. Update `showSocialTab()` to call `initAnalyticsTab()`. |

---

## Out of Scope

- Real-time metrics streaming
- Instagram/Threads API metrics (limited API access)
- Paid analytics integrations (Google Analytics, etc.)
- Export to PDF/CSV
- Historical data backfill
