---
title: LifeAI Campaign Templates for Content Studio S2
date: 2026-03-25
status: approved
---

# LifeAI Campaign Templates

Add 22 campaign post designs (44 templates with dark/light variants) to the Content Studio Series 2 (`social2.html`) under a new "LifeAI Campaigns" sidebar category.

## Color System

LifeAI campaigns use a dedicated blue palette, distinct from the gold/ember used by BrandAI and Helix.

**Light mode (Coastal Blue):**
- Background gradient: `#edf2f8` to `#c4d4e4`
- Primary text: `#2c4f6b`
- Secondary text: `#3a5268`
- Muted text: `#627d94`
- Accent: `#5c8aab`
- Surface: `#8aabc4`
- Pill border: `rgba(44,79,107,0.25)`

**Dark mode (Midnight Blue):**
- Background: `#0a0a0a` (standard dark bg)
- Primary text: `#c4d4e4`
- Secondary text: `#8aabc4`
- Muted text: `#5c8aab`
- Accent: `#1e3a5f`
- Headline color: `#c4d4e4`
- Pill border: `rgba(140,171,196,0.25)`

**Coach accent colors (preserved from existing templates):**
- Life Coach: `#22c55e`
- Wellness: `#06b6d4`
- Tax Intelligence: `#f59e0b`
- Personal AI: `#a78bfa`
- Standard AI: `#b2997b`

## Naming

- Display name: **Tax Intelligence** (replaces "Tax Copilot" in all campaign copy)
- Internal code key: `tax-copilot` (unchanged to avoid breaking existing templates)

## Category Structure

- New sidebar category: `{ id: 'lifeai-campaigns', label: 'LifeAI Campaigns' }`
- Posts are grouped visually by campaign name within the single category
- Template IDs start at `7000`

## Disclaimer

All Tax Season posts include at the bottom in small text:

> *AI-powered guidance built on IRS knowledge. Not tax, legal, or financial advice.

Font size: 14px. Color: muted (`--c-dim` equivalent in Coastal/Midnight palette). Positioned above the `roweos.com` watermark.

## Standard Elements

Every post includes:
- **LifeAI pill badge**: `padding:4px 14px; border:1px solid; border-radius:20px; font-size:14px; letter-spacing:0.06em`
- **roweos.com watermark**: standard `watermark()` function, bottom-center
- **RoweOS logo icon**: top-left on spotlight/capability posts
- **Typography**: Cormorant Garamond serif for headlines, DM Sans for body
- **Dimensions**: 1080x1350 (standard social card)

## Campaign 1: Tax Season (8 posts, 16 templates)

### Post 1 -- Urgency Hook
- **Headline**: "April 15. Your AI is ready. Are you?"
- **Layout**: Large date "April 15" in Cormorant Garamond (72px), subtext below, Coastal Blue gradient bg
- **Elements**: LifeAI pill, minimal copy
- **Vibe**: Urgency, countdown energy

### Post 2 -- The Pitch
- **Headline**: "Tax Intelligence already knows your income, deductions, and business expenses."
- **Layout**: Headline in Cormorant serif, followed by check-icon feature list
- **Features**: Income tracking, Deduction finder, Business expenses, Quarterly estimates, Document organization
- **Elements**: LifeAI pill, Tax Intelligence accent border top (#f59e0b)

### Post 3 -- IRS Knowledge
- **Headline**: "Built on IRS publications. Guidance you can trust."
- **Layout**: Centered serif headline, knowledge base visual (stacked layers or document icon), small disclaimer at bottom
- **Elements**: LifeAI pill, disclaimer *

### Post 4 -- Personal + Business
- **Headline**: "Personal or business. LifeAI handles both."
- **Layout**: Split design -- left side "Personal" with personal tax items, right side "Business" with business tax items. Divider line between.
- **Elements**: LifeAI pill, both sections in Coastal Blue tones

### Post 5 -- CTA
- **Headline**: "Don't file alone."
- **Layout**: Large Cormorant serif text centered, RoweOS logo icon below, LifeAI pill, clean and minimal
- **Elements**: Logo, pill, watermark. No feature list. Pure statement.

### Post 6 -- Time Saving
- **Headline**: "Hours of prep. Seconds with Tax Intelligence."
- **Layout**: Headline-only with dramatic typography. "Hours" in large light weight, "Seconds" in large bold weight. Tax Intelligence name in DM Sans below.
- **Elements**: LifeAI pill, Tax Intelligence name prominent

### Post 7 -- Receipts Pain Point
- **Headline**: "Stop digging through receipts."
- **Layout**: Subtext: "Tax Intelligence organizes what you'd spend hours finding." Headline in Cormorant, subtext in DM Sans.
- **Elements**: LifeAI pill, disclaimer *

### Post 8 -- Summary Output
- **Headline**: "Your tax situation, summarized."
- **Layout**: Dashboard/summary feel -- show mock summary items: "Deductions found", "Deadlines tracked", "Estimates ready" with check icons or status indicators. Clean, output-focused.
- **Elements**: LifeAI pill, disclaimer *

## Campaign 2: "Your AI Already Knows You" (4 posts, 8 templates)

### Post 1 -- The Question
- **Headline**: "What if your AI already knew the answer?"
- **Layout**: Large Cormorant serif text centered on Coastal Blue gradient. Minimal. Intrigue hook.
- **Elements**: LifeAI pill

### Post 2 -- The Stack
- **Headline**: "Identity. History. Memory. Context."
- **Layout**: Four stacked layers/rows, each with an icon and the word. Visual suggests depth and accumulation. Icons from existing featureIcon set (identity, memory, etc.)
- **Elements**: LifeAI pill

### Post 3 -- Time Saving
- **Headline**: "Skip the catch-up. Start with the answer."
- **Layout**: Clean two-line Cormorant serif. Subtext in DM Sans: "LifeAI remembers so you don't have to repeat yourself."
- **Elements**: LifeAI pill

### Post 4 -- The Payoff
- **Headline**: "Not a chatbot. An intelligence that knows you."
- **Layout**: Large Cormorant serif statement centered. Clean closer.
- **Elements**: LifeAI pill, RoweOS logo

## Campaign 3: Life Coach Spotlight (4 posts, 8 templates)

### Post 1 -- Pain Point
- **Headline**: "Your goals deserve more than a notes app."
- **Layout**: Cormorant serif headline centered on Coastal Blue gradient. Practical hook.
- **Elements**: LifeAI pill, Life Coach accent border top (#22c55e)

### Post 2 -- Capabilities
- **Headline**: (none -- capabilities speak for themselves)
- **Layout**: Check-icon list: Goal setting, Habit tracking, Daily planning, Motivation, Life reviews. Life Coach accent (#22c55e) top border. "Life Coach" name + LifeAI pill at top.
- **Elements**: LifeAI pill, RoweOS logo top-left

### Post 3 -- Memory Angle
- **Headline**: "A coach that remembers every goal you've ever set."
- **Layout**: Cormorant serif headline, ties capabilities to LifeAI's memory/context system.
- **Elements**: LifeAI pill

### Post 4 -- Aspirational Closer
- **Headline**: "What would you do with a personal coach who never forgets?"
- **Layout**: Question format, large serif, centered. Aspirational energy.
- **Elements**: LifeAI pill, RoweOS logo

## Campaign 4: Wellness Check-In (3 posts, 6 templates)

### Post 1 -- The Prompt
- **Headline**: "When was the last time you checked in with yourself?"
- **Layout**: Reflective, calm. Cormorant serif centered. Leans hard into the blue palette -- softer end of Coastal Blue.
- **Elements**: LifeAI pill, Wellness accent border top (#06b6d4)

### Post 2 -- Capabilities
- **Headline**: (none)
- **Layout**: Check-icon list: Fitness guidance, Nutrition advice, Sleep optimization, Stress management, Mental health. Wellness accent (#06b6d4) top border. "Wellness" name + LifeAI pill at top.
- **Elements**: LifeAI pill, RoweOS logo top-left

### Post 3 -- Tagline
- **Headline**: "Your health, optimized."
- **Layout**: Clean Cormorant serif statement centered. Minimal closer.
- **Elements**: LifeAI pill, RoweOS logo

## Campaign 5: "One Platform, Every Part of Your Life" (3 posts, 6 templates)

### Post 1 -- The Breadth
- **Headline**: "Taxes. Wellness. Goals. Decisions. Conversation."
- **Layout**: Five words on separate lines or in a row, each with a colored dot matching the coach accent color. Unified statement visual.
- **Elements**: LifeAI pill

### Post 2 -- The Grid
- **Headline**: "5 AI coaches. One platform."
- **Layout**: Grid of all 5 coaches with their accent colors, initial letter in colored circle, name below. Similar to existing Unified Statement template but in Coastal Blue palette.
- **Elements**: LifeAI pill

### Post 3 -- The Close
- **Headline**: "Every part of your life. One intelligence."
- **Layout**: Large Cormorant serif statement centered. RoweOS logo icon. Final brand statement.
- **Elements**: LifeAI pill, RoweOS logo

## Implementation Notes

### Code Structure
- Add new IIFE block after the existing Life Intelligence templates section (after line ~862 in social2.html)
- Template IDs: `7000` series
- New category entry in `CATEGORIES` array: `{ id: 'lifeai-campaigns', label: 'LifeAI Campaigns' }`
- New `cardWrapBlue(mode, inner)` helper that uses Coastal Blue / Midnight palette instead of gold
- New `watermarkBlue(mode)` using blue-tinted watermark color
- New `pillBlue(mode, label)` using Coastal Blue pill styling
- New `goldTextBlue(mode, text, size, weight, extra)` equivalent using blue accent colors

### Helper Functions Needed
```
cardWrapBlue(mode, inner)    -- blue palette card wrapper
watermarkBlue(mode)          -- blue-tinted roweos.com watermark
pillBlue(mode, label)        -- LifeAI pill in Coastal/Midnight blue
blueText(mode, text, size, weight, extra) -- accent text in blue
checkIconBlue(mode)          -- check icon in blue accent
disclaimerText(mode)         -- small disclaimer text, positioned above watermark
```

### Campaign Grouping
Posts within the "LifeAI Campaigns" category are visually grouped by adding a `campaign` property to each template object. The label prefix indicates the campaign: e.g., "Tax Season -- Urgency Hook (light)".
