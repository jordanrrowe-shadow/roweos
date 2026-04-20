# Travel Planner AI - New LifeAI Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Travel Planner AI as a new LifeAI coach type, providing full travel planning assistance through 12 dedicated operations (IDs 1201-1212), a new system prompt, and integration into all existing LifeAI touchpoints (agent selector, Guardrails, Studio categories, Automations, Focus).

**Architecture:** Follows the same pattern as Tax Intelligence (coach id `taxintelligence`, ops IDs 1080-1092). The new coach id is `travel`, with ops using category `travel` and `agent: 'travel'`. The system prompt lives in `buildLifeAISystemPromptForCategory()` in `13-studio.js`. Operations are appended to `window.lifeOps` in `10-sync.js`. All 7 LifeAI touchpoints must be updated to include the new coach.

**Tech Stack:** ES5 JavaScript (monolithic build), Firebase/Firestore sync, no new dependencies

---

## Codebase Touchpoints (7 locations for a new LifeAI coach)

| # | Location | File | What to add |
|---|----------|------|-------------|
| 1 | `COACHES` constant | `src/js/core/08-foundation.js:374` | `TRAVEL: { id: 'travel', name: 'Travel Planner' }` |
| 2 | `AGENT_COLORS` map | `src/js/core/11-agents.js:404` | `travel: '#f97316'` (orange - maps, exploration) |
| 3 | `lifeOptions` dropdown | `src/js/core/11-agents.js:4702` | `{ name: 'Travel Planner', value: 'travel' }` |
| 4 | System prompt | `src/js/core/13-studio.js:2597` | New `if (agentType === 'travel')` block |
| 5 | Guardrails coaches list | `src/js/core/25-documents-lifeai.js:12` | `{ id: 'travel', name: 'Travel Planner', ... }` |
| 6 | `getDefaultCoachPrompt()` | `src/js/core/25-documents-lifeai.js:104` | New `if (coachId === 'travel')` block |
| 7 | `window.lifeOps` array | `src/js/core/10-sync.js:2868` | 12 new operations (IDs 1201-1212) |

Plus these secondary touchpoints:

| # | Location | File | What to add |
|---|----------|------|-------------|
| 8 | Focus agent dropdown | `src/js/core/15-focus.js:4426` | `travel` option |
| 9 | Automations built-in agents | `src/js/core/17-automations.js:6841` | `{ name: 'Travel Planner', id: 'travel', ... }` |
| 10 | Automations agent category list (workflow) | `src/js/core/17-automations.js:1732` | `['travel','Travel']` |
| 11 | Automations agent category list (pipeline) | `src/js/core/17-automations.js:4652` | `['travel','Travel']` |
| 12 | Automations agent category map | `src/js/core/17-automations.js:6808` | `travel:'Travel'` |
| 13 | Automations agent category dropdown | `src/js/core/17-automations.js:6899` | `['travel','Travel']` |
| 14 | Firebase agent migration | `src/js/core/22-firebase-sync.js:9217` | No migration needed (new coach) |

---

## Task 1: Add Travel Planner Operations to `window.lifeOps`

**Files:**
- Modify: `src/js/core/10-sync.js`

- [ ] **Step 1: Add 12 travel operations after the research section (line ~2959)**

Find the closing of the research section (after id 1142) and insert before the `];` that closes `window.lifeOps`:

```js
  // v30.0: TRAVEL PLANNER
  { id: 1201, name: 'Plan a Trip', desc: 'Full trip planning with destination research, timing, and logistics', category: 'travel', agent: 'travel', outputs: ['Destination overview', 'Best time to visit', 'Trip duration recommendation', 'Logistics summary', 'Next steps checklist'], params: [
    { id: 'destination', label: 'Destination', type: 'text', placeholder: 'e.g., Tokyo, Amalfi Coast, Iceland' },
    { id: 'dates', label: 'Travel Dates (approx)', type: 'text', placeholder: 'e.g., July 2026, 2 weeks' },
    { id: 'travelers', label: 'Number of Travelers', type: 'select', options: ['1 (Solo)', '2 (Couple)', '3-4 (Small Group)', '5+ (Large Group/Family)'], default: '2 (Couple)' },
    { id: 'style', label: 'Travel Style', type: 'select', options: ['Budget', 'Mid-Range', 'Luxury', 'Adventure', 'Family-Friendly', 'Business'], default: 'Mid-Range' }
  ]},
  { id: 1202, name: 'Create Itinerary', desc: 'Day-by-day travel schedule with activities, meals, and transport', category: 'travel', agent: 'travel', outputs: ['Day-by-day schedule', 'Activity recommendations', 'Meal suggestions', 'Transport between stops', 'Timing and logistics'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'days', label: 'Number of Days', type: 'select', options: ['3', '5', '7', '10', '14', '21'], default: '7' },
    { id: 'pace', label: 'Pace Preference', type: 'select', options: ['Relaxed (2-3 activities/day)', 'Moderate (3-4 activities/day)', 'Packed (5+ activities/day)'], default: 'Moderate (3-4 activities/day)' }
  ]},
  { id: 1203, name: 'Budget Estimate', desc: 'Detailed cost breakdown by category with money-saving tips', category: 'travel', agent: 'travel', outputs: ['Flights estimate', 'Accommodation estimate', 'Food and dining budget', 'Activities and entrance fees', 'Transport and miscellaneous', 'Total estimated cost', 'Money-saving tips'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'days', label: 'Number of Days', type: 'select', options: ['3', '5', '7', '10', '14', '21'], default: '7' },
    { id: 'style', label: 'Budget Level', type: 'select', options: ['Backpacker', 'Budget', 'Mid-Range', 'Comfort', 'Luxury'], default: 'Mid-Range' },
    { id: 'currency', label: 'Home Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'], default: 'USD' }
  ]},
  { id: 1204, name: 'Packing List', desc: 'Climate-based and activity-specific packing checklist', category: 'travel', agent: 'travel', outputs: ['Clothing essentials', 'Toiletries and personal care', 'Electronics and gear', 'Documents and money', 'Activity-specific items', 'Carry-on vs checked strategy'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'season', label: 'Season/Weather', type: 'select', options: ['Summer/Hot', 'Winter/Cold', 'Spring/Mild', 'Fall/Cool', 'Tropical/Humid', 'Mixed/Varied'], default: 'Summer/Hot' },
    { id: 'duration', label: 'Trip Duration', type: 'select', options: ['Weekend (2-3 days)', '1 Week', '2 Weeks', '3+ Weeks'], default: '1 Week' },
    { id: 'activities', label: 'Planned Activities', type: 'text', placeholder: 'e.g., hiking, beach, business meetings, formal dining' }
  ]},
  { id: 1205, name: 'Visa and Documents Check', desc: 'Entry requirements, visa needs, and travel document checklist', category: 'travel', agent: 'travel', outputs: ['Visa requirements', 'Passport validity check', 'Required documents list', 'Travel insurance recommendations', 'Health requirements', 'Application timeline'], params: [
    { id: 'destination', label: 'Destination Country', type: 'text' },
    { id: 'passport', label: 'Passport Country', type: 'text', placeholder: 'e.g., United States' },
    { id: 'purpose', label: 'Purpose of Travel', type: 'select', options: ['Tourism', 'Business', 'Study', 'Transit', 'Work'], default: 'Tourism' }
  ]},
  { id: 1206, name: 'Restaurant and Food Guide', desc: 'Local cuisine recommendations, restaurant picks, and dietary tips', category: 'travel', agent: 'travel', outputs: ['Must-try local dishes', 'Restaurant recommendations by meal', 'Street food guide', 'Dietary accommodation tips', 'Food etiquette and customs', 'Budget dining options'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'dietary', label: 'Dietary Preferences', type: 'select', options: ['No Restrictions', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher', 'Allergies (specify in notes)'], default: 'No Restrictions' },
    { id: 'budget', label: 'Dining Budget', type: 'select', options: ['Street Food/Budget', 'Mid-Range', 'Fine Dining', 'Mixed'], default: 'Mixed' }
  ]},
  { id: 1207, name: 'Local Culture and Safety Brief', desc: 'Cultural norms, safety tips, and practical local knowledge', category: 'travel', agent: 'travel', outputs: ['Cultural norms and etiquette', 'Safety considerations', 'Common scams to avoid', 'Tipping customs', 'Useful local phrases', 'Emergency contacts and resources'], params: [
    { id: 'destination', label: 'Destination', type: 'text' }
  ]},
  { id: 1208, name: 'Flight and Hotel Research', desc: 'Best booking strategies, airline and hotel recommendations', category: 'travel', agent: 'travel', outputs: ['Best time to book', 'Recommended airlines', 'Hotel area recommendations', 'Accommodation alternatives', 'Price comparison tips', 'Loyalty program advice'], params: [
    { id: 'origin', label: 'Departing From', type: 'text', placeholder: 'e.g., Austin, TX' },
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'dates', label: 'Travel Dates', type: 'text', placeholder: 'e.g., July 10-20, 2026' },
    { id: 'class', label: 'Preferred Class', type: 'select', options: ['Economy', 'Premium Economy', 'Business', 'First', 'Flexible'], default: 'Economy' }
  ]},
  { id: 1209, name: 'Activity Recommendations', desc: 'Curated activities, excursions, and experiences for your destination', category: 'travel', agent: 'travel', outputs: ['Top attractions', 'Hidden gems and local favorites', 'Outdoor and adventure activities', 'Cultural experiences', 'Family-friendly options', 'Evening and nightlife'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'interests', label: 'Interests', type: 'text', placeholder: 'e.g., history, nature, art, nightlife, adventure sports' },
    { id: 'travelers', label: 'Group Type', type: 'select', options: ['Solo', 'Couple', 'Family with Kids', 'Friends Group', 'Seniors'], default: 'Couple' }
  ]},
  { id: 1210, name: 'Travel Checklist', desc: 'Pre-departure preparation checklist with timeline', category: 'travel', agent: 'travel', outputs: ['4 weeks before', '2 weeks before', '1 week before', 'Day before departure', 'Day of travel', 'At destination arrival'], params: [
    { id: 'destination', label: 'Destination', type: 'text' },
    { id: 'type', label: 'Trip Type', type: 'select', options: ['Domestic', 'International', 'Cruise', 'Road Trip'], default: 'International' }
  ]},
  { id: 1211, name: 'Emergency Travel Help', desc: 'Handling flight delays, lost luggage, medical emergencies, and travel disruptions', category: 'travel', agent: 'travel', outputs: ['Immediate action steps', 'Contact information', 'Rights and compensation', 'Alternative arrangements', 'Insurance claim guidance'], params: [
    { id: 'situation', label: 'Situation', type: 'select', options: ['Flight Delayed/Cancelled', 'Lost/Delayed Luggage', 'Medical Emergency', 'Lost Passport', 'Natural Disaster/Disruption', 'Missed Connection', 'Other Emergency'], default: 'Flight Delayed/Cancelled' },
    { id: 'location', label: 'Current Location', type: 'text' }
  ]},
  { id: 1212, name: 'Trip Summary and Export', desc: 'Compile all trip details into a shareable travel brief', category: 'travel', agent: 'travel', outputs: ['Trip overview', 'Key dates and bookings', 'Daily highlights', 'Budget summary', 'Important contacts', 'Shareable travel brief'] }
```

- [ ] **Step 2: Verify ID range does not conflict**

Check that IDs 1201-1212 are not used elsewhere. The existing ranges are:
- 1001-1073: Core life ops (planning, development, wellness, relationships, finances, home, creativity, reflection)
- 1080-1092: Tax Intelligence
- 1100: Image
- 1110-1112: Video
- 1120-1122: Social
- 1130-1132: Guided
- 1140-1142: Research

IDs 1201-1212 are safely outside all existing ranges.

- [ ] **Step 3: Verification**

1. Run `bash src/build.sh`
2. Open RoweOS in browser, switch to LifeAI mode
3. Open Studio, filter by "All" category
4. Confirm 12 new travel operations appear in the list
5. Click "Plan a Trip" - verify params render (destination, dates, travelers, style dropdowns)
6. No console errors

- [ ] **Step 4: Commit**

```
feat(lifeai): add 12 Travel Planner operations (IDs 1201-1212)
```

---

## Task 2: Register Travel Planner Coach in Foundation and Agent System

**Files:**
- Modify: `src/js/core/08-foundation.js`
- Modify: `src/js/core/11-agents.js`

- [ ] **Step 1: Add TRAVEL to COACHES constant**

In `src/js/core/08-foundation.js`, find the COACHES object (~line 374):

```js
  COACHES: {
    LIFE: { id: 'coach', name: 'Life Coach' },
    WELLNESS: { id: 'wellness', name: 'Wellness Coach' },
    TAX: { id: 'taxintelligence', name: 'Tax Intelligence' },
    PERSONAL: { id: 'personal', name: 'Personal AI' },
    STANDARD: { id: 'standard', name: 'Standard AI' }
  },
```

Add after the TAX entry:

```js
    TRAVEL: { id: 'travel', name: 'Travel Planner' },
```

Result:

```js
  COACHES: {
    LIFE: { id: 'coach', name: 'Life Coach' },
    WELLNESS: { id: 'wellness', name: 'Wellness Coach' },
    TAX: { id: 'taxintelligence', name: 'Tax Intelligence' },
    TRAVEL: { id: 'travel', name: 'Travel Planner' },
    PERSONAL: { id: 'personal', name: 'Personal AI' },
    STANDARD: { id: 'standard', name: 'Standard AI' }
  },
```

- [ ] **Step 2: Add travel to AGENT_COLORS map**

In `src/js/core/11-agents.js`, find the AGENT_COLORS object (~line 401):

```js
var AGENT_COLORS = {
  strategy: '#a78bfa', marketing: '#f472b6', operations: '#4ade80', documents: '#fbbf24',
  intelligence: '#22d3ee',
  coach: '#4ade80', wellness: '#60a5fa', taxintelligence: '#fbbf24', personal: '#a78bfa',
  image: '#a89878', research: '#3b82f6', social: '#1DA1F2', video: '#06b6d4', infographic: '#06b6d4'
};
```

Add `travel: '#f97316'` (orange) to the LifeAI coaches line:

```js
var AGENT_COLORS = {
  strategy: '#a78bfa', marketing: '#f472b6', operations: '#4ade80', documents: '#fbbf24',
  intelligence: '#22d3ee',
  coach: '#4ade80', wellness: '#60a5fa', taxintelligence: '#fbbf24', travel: '#f97316', personal: '#a78bfa',
  image: '#a89878', research: '#3b82f6', social: '#1DA1F2', video: '#06b6d4', infographic: '#06b6d4'
};
```

- [ ] **Step 3: Add Travel Planner to lifeOptions in agent selector dropdown**

In `src/js/core/11-agents.js`, find the `lifeOptions` array (~line 4702):

```js
    var lifeOptions = [
      { name: 'Personal Assistant', value: 'personal' },
      { name: 'Life Coach', value: 'coach' },
      { name: 'Wellness Guide', value: 'wellness' },
      { name: 'Tax Intelligence', value: 'taxintelligence' },
      { name: 'StandardAI', value: 'standard' }
    ];
```

Add after the Tax Intelligence entry:

```js
    var lifeOptions = [
      { name: 'Personal Assistant', value: 'personal' },
      { name: 'Life Coach', value: 'coach' },
      { name: 'Wellness Guide', value: 'wellness' },
      { name: 'Tax Intelligence', value: 'taxintelligence' },
      { name: 'Travel Planner', value: 'travel' },
      { name: 'StandardAI', value: 'standard' }
    ];
```

- [ ] **Step 4: Verification**

1. Run `bash src/build.sh`
2. Switch to LifeAI mode
3. Click the agent selector dropdown in Chat view
4. Confirm "Travel Planner" appears between Tax Intelligence and StandardAI
5. Select "Travel Planner" - toast says "Switched to Travel Planner"
6. Badge text updates to "Travel Planner"

- [ ] **Step 5: Commit**

```
feat(lifeai): register Travel Planner coach in foundation + agent selector
```

---

## Task 3: Add Travel Planner System Prompt

**Files:**
- Modify: `src/js/core/13-studio.js`

- [ ] **Step 1: Add the travel system prompt in `buildLifeAISystemPromptForCategory()`**

In `src/js/core/13-studio.js`, find the end of the `taxintelligence` block. After `return prompt;` for taxintelligence (~line 2702) and before the `if (agentType === 'standard')` block (~line 2705), insert:

```js
  // v30.0: Travel Planner AI
  if (agentType === 'travel') {
    var prompt = 'You are the Travel Planner AI for ' + userName + '.\n\n'
      + 'YOUR ROLE:\n'
      + 'You are an expert travel planning assistant. You help ' + userName + ' plan trips, create itineraries, estimate budgets, research destinations, and handle all aspects of travel preparation. You combine practical logistics with insider knowledge to create memorable travel experiences.\n\n'
      + 'PLANNING APPROACH:\n'
      + '- Always ask about travel dates, budget, group size, and travel style if not provided\n'
      + '- Consider seasonality, weather, local events, and peak/off-peak pricing\n'
      + '- Balance must-see highlights with hidden gems and local experiences\n'
      + '- Provide realistic time estimates for activities and transit between locations\n'
      + '- Account for jet lag, rest days, and travel fatigue in multi-day itineraries\n'
      + '- Include backup plans and rainy-day alternatives when relevant\n\n'
      + 'BUDGET GUIDANCE:\n'
      + '- Always break costs down by category (flights, accommodation, food, activities, transport, misc)\n'
      + '- Provide ranges (budget/mid-range/luxury) when possible\n'
      + '- Flag currency exchange considerations and tipping customs\n'
      + '- Suggest money-saving strategies specific to each destination\n'
      + '- Note when prices are seasonal estimates and may vary\n\n'
      + 'SAFETY AND PRACTICAL INFO:\n'
      + '- Always mention visa/entry requirements for international trips\n'
      + '- Include health advisories, vaccination requirements, and travel insurance recommendations\n'
      + '- Note cultural sensitivities and local customs\n'
      + '- Provide emergency contact information (embassy, local emergency numbers)\n'
      + '- Flag any current travel advisories or safety concerns\n\n'
      + 'OUTPUT FORMAT:\n'
      + '- Use clear headers and organized sections\n'
      + '- Format itineraries as day-by-day schedules with timing\n'
      + '- Present budgets as structured tables when possible\n'
      + '- Use checklists for packing lists and pre-departure tasks\n'
      + '- Keep recommendations actionable with specific names, addresses, and booking tips\n\n'
      + 'GUIDELINES:\n'
      + '- Be enthusiastic about travel while staying practical and realistic\n'
      + '- Cite specific restaurants, hotels, and attractions by name when possible\n'
      + '- Distinguish between verified facts and general estimates\n'
      + '- Tailor all recommendations to the traveler profile and stated preferences\n'
      + '- Never use emojis in your responses';

    if (userKnowledge) prompt += '\n\n' + userKnowledge;
    return prompt;
  }
```

- [ ] **Step 2: Verification**

1. Run `bash src/build.sh`
2. Switch to LifeAI mode, select "Travel Planner" agent
3. Send a message: "I want to plan a trip to Tokyo in October"
4. Confirm the AI responds with travel-relevant content (not generic LifeAI response)
5. Confirm the response has no emojis

- [ ] **Step 3: Commit**

```
feat(lifeai): add Travel Planner system prompt with planning/budget/safety guidance
```

---

## Task 4: Add Travel Planner to Guardrails Coach Prompts

**Files:**
- Modify: `src/js/core/25-documents-lifeai.js`

- [ ] **Step 1: Add travel to the coaches array in `renderCoachPrompts()`**

In `src/js/core/25-documents-lifeai.js`, find the coaches array (~line 12):

```js
  var coaches = [
    { id: 'personal', name: 'Personal Assistant', icon: '◇', desc: 'General life organization and task management' },
    { id: 'coach', name: 'Life Coach', icon: '◆', desc: 'Goal achievement, motivation, and accountability' },
    { id: 'wellness', name: 'Wellness Guide', icon: '❤', desc: 'Health, fitness, nutrition, and mental wellness' },
    { id: 'taxintelligence', name: 'Tax Intelligence', icon: '$', desc: 'Tax preparation, deductions, and compliance' }
  ];
```

Add the travel entry after taxintelligence:

```js
  var coaches = [
    { id: 'personal', name: 'Personal Assistant', icon: '◇', desc: 'General life organization and task management' },
    { id: 'coach', name: 'Life Coach', icon: '◆', desc: 'Goal achievement, motivation, and accountability' },
    { id: 'wellness', name: 'Wellness Guide', icon: '❤', desc: 'Health, fitness, nutrition, and mental wellness' },
    { id: 'taxintelligence', name: 'Tax Intelligence', icon: '$', desc: 'Tax preparation, deductions, and compliance' },
    { id: 'travel', name: 'Travel Planner', icon: '>', desc: 'Trip planning, itineraries, budgets, and travel logistics' }
  ];
```

Note: The icon `>` is a simple arrow/compass stand-in. Coaches in Guardrails use text characters since these are inside card headers, not SVG.

- [ ] **Step 2: Add travel to `getDefaultCoachPrompt()`**

In the same file, find `function getDefaultCoachPrompt(coachId)` (~line 104). After the `taxintelligence` block and before the default return, add:

```js
  if (coachId === 'travel') {
    return 'You are the Travel Planner AI for ' + userName + '.\n\nYOUR ROLE:\nYou are an expert travel planning assistant helping ' + userName + ' plan trips, create itineraries, estimate budgets, and handle all travel preparation.\n\nPLANNING APPROACH:\n- Ask about dates, budget, group size, and travel style\n- Consider seasonality, weather, and local events\n- Balance highlights with hidden gems\n- Provide realistic time estimates\n- Include backup plans\n\nBUDGET GUIDANCE:\n- Break costs down by category\n- Provide budget/mid-range/luxury ranges\n- Flag currency and tipping customs\n\nGUIDELINES:\n- Be enthusiastic but practical\n- Cite specific places by name when possible\n- Never use emojis in your responses';
  }
```

- [ ] **Step 3: Verification**

1. Run `bash src/build.sh`
2. Switch to LifeAI mode
3. Navigate to Guardrails view
4. Confirm "Travel Planner" card appears in the Coach Prompts section
5. Click "View Default" on Travel Planner - confirm default prompt appears
6. Edit the prompt, save, confirm "Custom" badge appears
7. Reset to default, confirm it reverts

- [ ] **Step 4: Commit**

```
feat(lifeai): add Travel Planner to Guardrails coach prompt management
```

---

## Task 5: Add Travel Category to Focus and Automations

**Files:**
- Modify: `src/js/core/15-focus.js`
- Modify: `src/js/core/17-automations.js`

- [ ] **Step 1: Add Travel Planner to Focus agent dropdown**

In `src/js/core/15-focus.js`, find the LifeAI agent options (~line 4426):

```js
  if (isLife) {
    html += '<option value="coach">Life Coach</option>';
    html += '<option value="wellness">Wellness Coach</option>';
    html += '<option value="taxintelligence">Tax Intelligence</option>';
    html += '<option value="personal">Personal AI</option>';
```

Add after Tax Intelligence:

```js
    html += '<option value="travel">Travel Planner</option>';
```

Result:

```js
  if (isLife) {
    html += '<option value="coach">Life Coach</option>';
    html += '<option value="wellness">Wellness Coach</option>';
    html += '<option value="taxintelligence">Tax Intelligence</option>';
    html += '<option value="travel">Travel Planner</option>';
    html += '<option value="personal">Personal AI</option>';
```

- [ ] **Step 2: Add Travel Planner to Automations built-in agents list**

In `src/js/core/17-automations.js`, find the LifeAI built-in agents (~line 6841):

```js
    ? [{ name: 'Life Coach', id: 'coach', color: '#4ade80' }, { name: 'Wellness Coach', id: 'wellness', color: '#60a5fa' }, { name: 'Tax Intelligence', id: 'taxintelligence', color: '#fbbf24' }, { name: 'Personal AI', id: 'personal', color: '#a78bfa' }, { name: 'Image', id: 'image', color: '#a89878' }]
```

Add Travel Planner entry after Tax Intelligence:

```js
    ? [{ name: 'Life Coach', id: 'coach', color: '#4ade80' }, { name: 'Wellness Coach', id: 'wellness', color: '#60a5fa' }, { name: 'Tax Intelligence', id: 'taxintelligence', color: '#fbbf24' }, { name: 'Travel Planner', id: 'travel', color: '#f97316' }, { name: 'Personal AI', id: 'personal', color: '#a78bfa' }, { name: 'Image', id: 'image', color: '#a89878' }]
```

- [ ] **Step 3: Add travel to Automations workflow agent category list**

In the same file, find the workflow agent list (~line 1732):

```js
      ? [['all','All'],['planning','Planning'],['development','Development'],['wellness','Wellness'],['relationships','Relationships'],['finances','Analytics'],['taxes','Taxes'],['home','Home'],['creativity','Creativity'],['reflection','Reflection'],['image','Image']]
```

Add `['travel','Travel']` after `['creativity','Creativity']`:

```js
      ? [['all','All'],['planning','Planning'],['development','Development'],['wellness','Wellness'],['relationships','Relationships'],['finances','Analytics'],['taxes','Taxes'],['home','Home'],['creativity','Creativity'],['travel','Travel'],['reflection','Reflection'],['image','Image']]
```

- [ ] **Step 4: Add travel to Automations pipeline agent category list**

Find the pipeline agent list (~line 4652):

```js
      ? [['all','All'],['planning','Planning'],['development','Development'],['wellness','Wellness'],['finances','Analytics'],['taxes','Taxes'],['creativity','Creativity']]
```

Add `['travel','Travel']`:

```js
      ? [['all','All'],['planning','Planning'],['development','Development'],['wellness','Wellness'],['finances','Analytics'],['taxes','Taxes'],['travel','Travel'],['creativity','Creativity']]
```

- [ ] **Step 5: Add travel to agent category display map**

Find the agentCatMap (~line 6808):

```js
  var agentCatMap = {strategy:'Strategy',marketing:'Marketing',operations:'Operations',documents:'Documents',social:'Social',coach:'Coach',research:'Research',image:'Image',planning:'Planning',wellness:'Wellness',taxes:'Taxes',development:'Development',custom:'Custom'};
```

Add `travel:'Travel'`:

```js
  var agentCatMap = {strategy:'Strategy',marketing:'Marketing',operations:'Operations',documents:'Documents',social:'Social',coach:'Coach',research:'Research',image:'Image',planning:'Planning',wellness:'Wellness',taxes:'Taxes',travel:'Travel',development:'Development',custom:'Custom'};
```

- [ ] **Step 6: Add travel to Automations custom agent category dropdown**

Find the categories array (~line 6899):

```js
  var categories = [['strategy','Strategy'],['marketing','Marketing'],['operations','Operations'],['documents','Documents'],['image','Image'],['planning','Planning'],['wellness','Wellness'],['taxes','Taxes'],['development','Development'],['social','Social Media'],['custom','Custom']];
```

Add `['travel','Travel']` after taxes:

```js
  var categories = [['strategy','Strategy'],['marketing','Marketing'],['operations','Operations'],['documents','Documents'],['image','Image'],['planning','Planning'],['wellness','Wellness'],['taxes','Taxes'],['travel','Travel'],['development','Development'],['social','Social Media'],['custom','Custom']];
```

- [ ] **Step 7: Verification**

1. Run `bash src/build.sh`
2. LifeAI mode > Focus: Create automation, confirm "Travel Planner" in agent dropdown
3. LifeAI mode > Automations > Agents Lab: Confirm "Travel Planner" pill appears with orange color
4. LifeAI mode > Automations > Workflows: Create workflow with Studio action, confirm "Travel" in agent dropdown
5. LifeAI mode > Automations > Pipelines: Add studio step, confirm "Travel" in agent dropdown
6. No console errors

- [ ] **Step 8: Commit**

```
feat(lifeai): integrate Travel Planner into Focus + Automations (5 touchpoints)
```

---

## Task 6: Replace Existing Travel Planning Op (1062) with Redirect

**Files:**
- Modify: `src/js/core/10-sync.js`

The existing op `{ id: 1062, name: 'Travel Planning', category: 'creativity' }` is a basic single op under "Creativity and Hobbies". Now that we have 12 dedicated travel ops, update it to point users to the Travel Planner agent.

- [ ] **Step 1: Update op 1062 to be a Travel Planner entry point**

Find the existing op (~line 2926):

```js
  { id: 1062, name: 'Travel Planning', desc: 'Plan trips and adventures', category: 'creativity', outputs: ['Destination ideas', 'Itinerary draft', 'Budget estimate', 'Booking checklist', 'Packing list'] },
```

Replace with:

```js
  { id: 1062, name: 'Quick Trip Plan', desc: 'Quick trip overview (for full planning, switch to Travel Planner agent)', category: 'creativity', agent: 'travel', outputs: ['Destination ideas', 'Itinerary draft', 'Budget estimate', 'Booking checklist', 'Packing list'] },
```

This keeps the existing op working (same ID, same category location for users who have it pinned) but routes it through the Travel Planner agent and signals that the full suite is available.

- [ ] **Step 2: Verification**

1. Run `bash src/build.sh`
2. LifeAI mode > Studio > filter "Creativity"
3. Confirm "Quick Trip Plan" appears with updated description
4. Run the op - confirm it uses travel agent context

- [ ] **Step 3: Commit**

```
refactor(lifeai): update op 1062 to reference Travel Planner agent
```

---

## Task 7: Build and Test End-to-End

**Files:**
- No new modifications. Full integration verification.

- [ ] **Step 1: Build**

```bash
bash src/build.sh
```

- [ ] **Step 2: End-to-end verification checklist**

Chat:
- [ ] Switch to LifeAI mode
- [ ] Open agent selector - "Travel Planner" appears
- [ ] Select Travel Planner - badge updates, toast shows
- [ ] Send message about travel - response uses travel context
- [ ] Switch between Travel Planner and other coaches - prompt changes

Studio:
- [ ] LifeAI mode > Studio > filter "All" - 12 travel ops appear
- [ ] Each travel op has correct params (dropdowns, text fields)
- [ ] "Plan a Trip" op executes successfully with all params filled
- [ ] "Budget Estimate" op produces structured cost breakdown
- [ ] Travel ops show correct agent color (orange #f97316)

Guardrails:
- [ ] LifeAI mode > Guardrails > Travel Planner card visible
- [ ] Can save custom prompt for Travel Planner
- [ ] Custom prompt overrides default in chat
- [ ] Reset to default works

Automations:
- [ ] LifeAI mode > Automations > Agents Lab shows Travel Planner
- [ ] Can create workflow with Travel Studio operation
- [ ] Pipeline step can select Travel category ops

Focus:
- [ ] Quick automation agent dropdown includes Travel Planner

- [ ] **Step 3: Commit final**

```
feat(lifeai): Travel Planner AI v30.0 - complete integration
```

---

## Summary of All Changes

| File | Changes |
|------|---------|
| `src/js/core/08-foundation.js` | Add `TRAVEL` to `COACHES` constant |
| `src/js/core/10-sync.js` | Add 12 travel ops (1201-1212) to `window.lifeOps`, update op 1062 |
| `src/js/core/11-agents.js` | Add `travel` to `AGENT_COLORS`, add to `lifeOptions` dropdown |
| `src/js/core/13-studio.js` | Add `travel` system prompt in `buildLifeAISystemPromptForCategory()` |
| `src/js/core/15-focus.js` | Add `travel` option to Focus agent dropdown |
| `src/js/core/17-automations.js` | Add `travel` to 5 locations: built-in agents, workflow categories, pipeline categories, agent category map, custom agent category dropdown |
| `src/js/core/25-documents-lifeai.js` | Add travel to `renderCoachPrompts()` coaches array + `getDefaultCoachPrompt()` |

**Total: 7 files, 14 edit locations, 0 new files**

No CSS changes needed - the travel category inherits existing LifeAI styling. Agent color (#f97316 orange) is set via `AGENT_COLORS` and rendered dynamically by existing code in Studio op cards, Automations pills, and agent badges.

No Firebase sync changes needed - coach prompts already sync via `roweos_life_coach_prompts` (handles arbitrary coach IDs). The agent selection syncs via `roweos_life_agent` (stores any string value). Operations are in the global `window.lifeOps` array (not user data).
