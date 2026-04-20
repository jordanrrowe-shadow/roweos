# Analytics KPI Dashboard Overhaul

## Goal
Full redesign of the Dashboard tab in the Analytics view. Replace the current 3-section layout (Team, Custom KPIs, Screenshots) with a comprehensive KPI dashboard featuring revenue tracking, client metrics, social performance roll-up, brand health scoring, AI usage summary, upgraded custom KPIs with sparklines, and team + activity feed. All charts are inline SVG (no external library).

## Architecture
- **App type:** Monolithic ES5 JavaScript web app (single HTML file built from `src/`)
- **View:** Analytics view (`data-view="commerce"`, panel `commerceView`)
- **Tab:** Dashboard tab (`showCommerceTab('dashboard')`) renders into `#dashboardContainer`
- **Entry point:** `renderAnalyticsDashboard()` in `src/js/core/29-analytics-commerce.js` (line 4633)
- **Data sources (all localStorage, brand-scoped):**
  - `roweos_analytics` -- `{ entries: [...] }` with per-call cost/tokens/provider/model/timestamp/cached
  - `roweos_invoices` -- `[{ id, date, total, status: paid|pending|overdue, lineItems, client }]`
  - `roweos_people` -- `[{ personType, stage, dealValue, name, brandIndex, createdAt, ... }]`
  - `roweos_social_posts` -- `[{ id, platform, content, postUrl, status, postedAt, brandIndex }]`
  - `roweos_dashboard_kpis_{brandIdx}` -- `[{ id, title, value, target, unit }]`
  - `roweos_dashboard_screenshots_{brandIdx}` -- `[{ id, title, data, date }]`
  - `roweos_auto_lab_history` -- `[{ timestamp, success, type, name, ... }]`
- **Existing helpers:** `getAnalyticsData()`, `calculatePeriodStats()`, `getInvoices()`, `getPeople(typeFilter)`, `getSocialPosts()`, `getDashboardKPIs()`, `getDashboardScreenshots()`, `getStageColor()`, `getStageLabel()`, `CLIENT_PIPELINE_STAGES`
- **Brand scoping:** `selectedBrand` global, `clientsShowAllBrands` for cross-brand toggle

## Tech Stack
- ES5 JavaScript (no arrow functions, let/const, template literals, destructuring)
- No test framework -- verification is manual
- Build: `bash src/build.sh`
- SVG charts: inline `<svg>` elements with `<rect>`, `<path>`, `<circle>`, `<polyline>` -- no external charting library
- No one-sided borders -- full borders or subtle background tints only

## File Structure
```
src/js/core/29-analytics-commerce.js  -- All dashboard logic (lines 4601-4878 current)
src/html/brand/15-commerce.html       -- Dashboard container (lines 160-163)
```

No new files. All changes are in the existing analytics-commerce JS file. The HTML container (`#dashboardContainer`) stays as-is -- all content is rendered dynamically by `renderAnalyticsDashboard()`.

---

## Task 1: Data Aggregation Functions

Build the data layer that powers all dashboard cards and charts. These pure functions read from localStorage and return structured metric objects.

### Files
- `src/js/core/29-analytics-commerce.js`

### Step 1.1: Add `getDashboardRevenue()` function

Insert BEFORE `renderAnalyticsDashboard()` (before line 4633):

```javascript
// v29.3: Dashboard KPI data aggregation
function getDashboardRevenue() {
  var invoices = getInvoices();
  var now = new Date();
  var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var lastMonthStr = lastMonth.getFullYear() + '-' + String(lastMonth.getMonth() + 1).padStart(2, '0');

  var totalRevenue = 0;
  var outstanding = 0;
  var thisMonthRevenue = 0;
  var lastMonthRevenue = 0;
  var paidCount = 0;
  var monthlyTotals = {}; // { 'YYYY-MM': amount }

  invoices.forEach(function(inv) {
    var amt = parseFloat(inv.total) || 0;
    var dateStr = (inv.date || inv.createdAt || '').substring(0, 7);
    if (inv.status === 'paid') {
      totalRevenue += amt;
      paidCount++;
      if (dateStr === thisMonth) thisMonthRevenue += amt;
      if (dateStr === lastMonthStr) lastMonthRevenue += amt;
      // Monthly totals for sparkline (last 6 months)
      if (dateStr) {
        monthlyTotals[dateStr] = (monthlyTotals[dateStr] || 0) + amt;
      }
    }
    if (inv.status === 'pending' || inv.status === 'overdue') {
      outstanding += amt;
    }
  });

  // Build last 6 months sparkline data
  var sparkline = [];
  for (var mi = 5; mi >= 0; mi--) {
    var d = new Date(now.getFullYear(), now.getMonth() - mi, 1);
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    sparkline.push(monthlyTotals[key] || 0);
  }

  var mrrEstimate = paidCount > 0 ? Math.round(totalRevenue / Math.max(1, Object.keys(monthlyTotals).length)) : 0;

  return {
    totalRevenue: totalRevenue,
    outstanding: outstanding,
    thisMonth: thisMonthRevenue,
    lastMonth: lastMonthRevenue,
    mrrEstimate: mrrEstimate,
    trend: lastMonthRevenue > 0 ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0,
    sparkline: sparkline
  };
}
```

### Step 1.2: Add `getDashboardClients()` function

Insert immediately after `getDashboardRevenue()`:

```javascript
function getDashboardClients() {
  var clients = typeof getPeople === 'function' ? getPeople('client') : [];
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  if (!clientsShowAllBrands) {
    clients = clients.filter(function(c) { return c.brandIndex == null || String(c.brandIndex) === String(brandIdx); });
  }

  var now = new Date();
  var thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var newThisMonth = clients.filter(function(c) { return c.createdAt && c.createdAt >= thisMonthStart; }).length;

  var byStage = {};
  CLIENT_PIPELINE_STAGES.forEach(function(s) { byStage[s.id] = 0; });
  var totalDealValue = 0;
  var dealCount = 0;

  clients.forEach(function(c) {
    var stage = c.stage || 'lead';
    byStage[stage] = (byStage[stage] || 0) + 1;
    var dv = parseFloat(c.dealValue) || 0;
    if (dv > 0) { totalDealValue += dv; dealCount++; }
  });

  // Pipeline value = deal values of non-archived clients
  var pipelineValue = 0;
  clients.forEach(function(c) {
    if (c.stage !== 'archived') {
      pipelineValue += (parseFloat(c.dealValue) || 0);
    }
  });

  return {
    total: clients.length,
    newThisMonth: newThisMonth,
    byStage: byStage,
    avgDealValue: dealCount > 0 ? Math.round(totalDealValue / dealCount) : 0,
    pipelineValue: pipelineValue
  };
}
```

### Step 1.3: Add `getDashboardSocial()` function

```javascript
function getDashboardSocial() {
  var posts = typeof getSocialPosts === 'function' ? getSocialPosts() : [];
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  posts = posts.filter(function(p) { return p.brandIndex == null || String(p.brandIndex) === String(brandIdx); });

  var now = new Date();
  var thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var postsThisMonth = posts.filter(function(p) { return p.postedAt && p.postedAt >= thisMonthStart; });

  var byPlatform = {};
  posts.forEach(function(p) {
    var plat = p.platform || 'unknown';
    byPlatform[plat] = (byPlatform[plat] || 0) + 1;
  });

  // Weekly post counts for last 8 weeks (sparkline)
  var weeklyPosts = [];
  for (var wi = 7; wi >= 0; wi--) {
    var weekStart = new Date(now.getTime() - (wi + 1) * 7 * 24 * 60 * 60 * 1000).toISOString();
    var weekEnd = new Date(now.getTime() - wi * 7 * 24 * 60 * 60 * 1000).toISOString();
    var count = posts.filter(function(p) { return p.postedAt && p.postedAt >= weekStart && p.postedAt < weekEnd; }).length;
    weeklyPosts.push(count);
  }

  return {
    totalPosts: posts.length,
    postsThisMonth: postsThisMonth.length,
    byPlatform: byPlatform,
    weeklyPosts: weeklyPosts
  };
}
```

### Step 1.4: Add `getDashboardBrandHealth()` function

```javascript
function getDashboardBrandHealth() {
  var scores = { identity: 0, content: 0, clients: 0, social: 0 };
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;

  // Identity completeness (0-25): check brand fields
  try {
    var brands = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]');
    if (Array.isArray(brands) && brands[brandIdx]) {
      var b = brands[brandIdx];
      var fields = ['name', 'tagline', 'brandColor', 'logo', 'industry', 'targetAudience', 'mission'];
      var filled = 0;
      fields.forEach(function(f) { if (b[f] && String(b[f]).trim()) filled++; });
      scores.identity = Math.round((filled / fields.length) * 25);
    }
  } catch(e) {}

  // Content frequency (0-25): based on social posts in last 30 days
  var social = getDashboardSocial();
  if (social.postsThisMonth >= 12) scores.content = 25;
  else if (social.postsThisMonth >= 8) scores.content = 20;
  else if (social.postsThisMonth >= 4) scores.content = 15;
  else if (social.postsThisMonth >= 1) scores.content = 8;

  // Client growth (0-25): based on new clients this month
  var clientData = getDashboardClients();
  if (clientData.newThisMonth >= 5) scores.clients = 25;
  else if (clientData.newThisMonth >= 3) scores.clients = 20;
  else if (clientData.newThisMonth >= 1) scores.clients = 15;
  else if (clientData.total >= 1) scores.clients = 5;

  // Social reach (0-25): based on total posts and platforms
  var platformCount = Object.keys(social.byPlatform).length;
  if (social.totalPosts >= 50 && platformCount >= 2) scores.social = 25;
  else if (social.totalPosts >= 20) scores.social = 20;
  else if (social.totalPosts >= 5) scores.social = 10;
  else if (social.totalPosts >= 1) scores.social = 5;

  var total = scores.identity + scores.content + scores.clients + scores.social;

  return {
    total: total,
    max: 100,
    scores: scores,
    grade: total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : total >= 20 ? 'D' : 'F'
  };
}
```

### Step 1.5: Add `getDashboardAIUsage()` function

```javascript
function getDashboardAIUsage() {
  var analytics = getAnalyticsData();
  var now = Date.now();
  var thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  var stats = calculatePeriodStats(analytics, thirtyDaysAgo, now);

  // Daily spend for last 14 days (sparkline)
  var dailySpend = [];
  for (var di = 13; di >= 0; di--) {
    var dayStart = new Date(now - (di + 1) * 24 * 60 * 60 * 1000).getTime();
    var dayEnd = new Date(now - di * 24 * 60 * 60 * 1000).getTime();
    var dayCost = 0;
    (analytics.entries || []).forEach(function(e) {
      if (e.timestamp >= dayStart && e.timestamp < dayEnd) {
        dayCost += (e.cost || 0);
      }
    });
    dailySpend.push(Math.round(dayCost * 100) / 100);
  }

  // Top 3 models by cost
  var modelArr = Object.keys(stats.modelBreakdown).map(function(m) {
    return { model: m, cost: stats.modelBreakdown[m].cost, requests: stats.modelBreakdown[m].requests };
  }).sort(function(a, b) { return b.cost - a.cost; });

  var cacheRate = stats.totalRequests > 0 ? Math.round((stats.cacheHits / stats.totalRequests) * 100) : 0;

  return {
    totalSpend: stats.totalCost,
    totalRequests: stats.totalRequests,
    cacheRate: cacheRate,
    topModels: modelArr.slice(0, 3),
    dailySpend: dailySpend,
    contextCosts: stats.contextCosts || {}
  };
}
```

### Verification
- Build: `bash src/build.sh`
- Open Analytics > Dashboard tab -- should still render existing content (aggregation functions are unused yet)
- Console: `getDashboardRevenue()`, `getDashboardClients()`, `getDashboardSocial()`, `getDashboardBrandHealth()`, `getDashboardAIUsage()` should all return objects without errors

### Commit
`v29.3: Add dashboard KPI data aggregation functions (revenue, clients, social, brand health, AI usage)`

---

## Task 2: SVG Chart Helper Functions

Build reusable SVG chart primitives for sparklines, bar charts, donut charts, and funnel charts. These return SVG markup strings.

### Files
- `src/js/core/29-analytics-commerce.js`

### Step 2.1: Add `renderSVGSparkline()` function

Insert after the data aggregation functions from Task 1:

```javascript
// v29.3: SVG chart helpers for Dashboard KPIs
function renderSVGSparkline(data, width, height, color) {
  if (!data || data.length === 0) return '';
  var max = Math.max.apply(null, data);
  if (max === 0) max = 1;
  var step = width / Math.max(1, data.length - 1);
  var points = data.map(function(v, i) {
    var x = Math.round(i * step);
    var y = Math.round(height - (v / max) * (height - 4)) + 2;
    return x + ',' + y;
  }).join(' ');

  var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="display:block;">';
  svg += '<polyline points="' + points + '" fill="none" stroke="' + (color || 'var(--accent)') + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  // Dot on last point
  var lastParts = points.split(' ');
  var lastPoint = lastParts[lastParts.length - 1].split(',');
  svg += '<circle cx="' + lastPoint[0] + '" cy="' + lastPoint[1] + '" r="2.5" fill="' + (color || 'var(--accent)') + '"/>';
  svg += '</svg>';
  return svg;
}
```

### Step 2.2: Add `renderSVGBarChart()` function

```javascript
function renderSVGBarChart(data, labels, width, height, color) {
  // data: array of numbers, labels: array of strings
  if (!data || data.length === 0) return '';
  var max = Math.max.apply(null, data);
  if (max === 0) max = 1;
  var barCount = data.length;
  var gap = 4;
  var barWidth = Math.max(8, Math.floor((width - gap * (barCount - 1)) / barCount));
  var labelHeight = labels ? 18 : 0;
  var chartHeight = height - labelHeight;

  var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">';
  data.forEach(function(v, i) {
    var barH = Math.max(2, Math.round((v / max) * (chartHeight - 4)));
    var x = i * (barWidth + gap);
    var y = chartHeight - barH;
    svg += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barH + '" rx="2" fill="' + (color || 'var(--accent)') + '" opacity="0.8"/>';
    if (labels && labels[i]) {
      svg += '<text x="' + (x + barWidth / 2) + '" y="' + (height - 2) + '" text-anchor="middle" fill="var(--text-muted)" style="font-size:9px;font-family:inherit;">' + escapeHtml(labels[i]) + '</text>';
    }
  });
  svg += '</svg>';
  return svg;
}
```

### Step 2.3: Add `renderSVGDonut()` function

```javascript
function renderSVGDonut(value, max, size, color, bgColor) {
  // Renders a donut/ring chart with value/max filled
  var pct = max > 0 ? Math.min(1, value / max) : 0;
  var radius = (size / 2) - 6;
  var circumference = 2 * Math.PI * radius;
  var dashOffset = circumference * (1 - pct);
  var cx = size / 2;
  var cy = size / 2;

  var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
  // Background ring
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + (bgColor || 'var(--bg-tertiary)') + '" stroke-width="6"/>';
  // Value ring
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + (color || 'var(--accent)') + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + dashOffset + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
  svg += '</svg>';
  return svg;
}
```

### Step 2.4: Add `renderSVGFunnel()` function

```javascript
function renderSVGFunnel(stages, width, height) {
  // stages: [{ label, count, color }] -- renders horizontal funnel bars
  if (!stages || stages.length === 0) return '';
  var max = 0;
  stages.forEach(function(s) { if (s.count > max) max = s.count; });
  if (max === 0) max = 1;
  var rowH = Math.floor(height / stages.length);

  var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">';
  stages.forEach(function(s, i) {
    var barW = Math.max(20, Math.round((s.count / max) * (width - 80)));
    var y = i * rowH;
    svg += '<rect x="0" y="' + (y + 2) + '" width="' + barW + '" height="' + (rowH - 6) + '" rx="3" fill="' + (s.color || 'var(--accent)') + '" opacity="0.7"/>';
    svg += '<text x="' + (barW + 8) + '" y="' + (y + rowH / 2 + 4) + '" fill="var(--text-secondary)" style="font-size:11px;font-family:inherit;">' + escapeHtml(s.label) + ' (' + s.count + ')</text>';
  });
  svg += '</svg>';
  return svg;
}
```

### Step 2.5: Add `renderTrendArrow()` helper

```javascript
function renderTrendArrow(pctChange) {
  // Returns an SVG up/down arrow with color based on positive/negative change
  if (pctChange === 0 || isNaN(pctChange)) {
    return '<span style="font-size:11px;color:var(--text-muted);">--</span>';
  }
  var isUp = pctChange > 0;
  var color = isUp ? '#4ade80' : '#ef4444';
  var arrow = isUp ?
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="' + color + '" stroke-width="2.5" style="vertical-align:middle;"><polyline points="18 15 12 9 6 15"/></svg>' :
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="' + color + '" stroke-width="2.5" style="vertical-align:middle;"><polyline points="6 9 12 15 18 9"/></svg>';
  return arrow + '<span style="font-size:11px;color:' + color + ';font-weight:600;margin-left:2px;">' + Math.abs(pctChange) + '%</span>';
}
```

### Verification
- Build: `bash src/build.sh`
- Console: `renderSVGSparkline([1,3,2,5,4,6], 80, 24, '#4ade80')` should return valid SVG string
- Console: `renderSVGDonut(75, 100, 60, '#a89878')` should return valid SVG string

### Commit
`v29.3: Add inline SVG chart helpers (sparkline, bar chart, donut, funnel, trend arrow)`

---

## Task 3: KPI Modal Form (Replace prompt() Dialogs)

Replace the 4-prompt sequence in `addDashboardKPI()` / `editDashboardKPI()` with a proper modal form.

### Files
- `src/js/core/29-analytics-commerce.js`

### Step 3.1: Add `openKPIModal()` function

Insert after `saveDashboardScreenshots` (after line ~4630), replacing the existing `addDashboardKPI` and `editDashboardKPI`:

```javascript
// v29.3: KPI modal form (replaces prompt dialogs)
function openKPIModal(editIdx) {
  var kpis = getDashboardKPIs();
  var isEdit = typeof editIdx === 'number' && kpis[editIdx];
  var kpi = isEdit ? kpis[editIdx] : { title: '', value: 0, target: 0, unit: '' };

  var overlay = document.createElement('div');
  overlay.id = 'kpiModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg-primary);border:1px solid var(--border-color);border-radius:var(--radius-xl);padding:24px;width:380px;max-width:90vw;';

  var titleText = isEdit ? 'Edit KPI' : 'Add KPI';
  modal.innerHTML =
    '<div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:20px;">' + titleText + '</div>' +
    '<div style="margin-bottom:14px;">' +
      '<label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Title</label>' +
      '<input id="kpiModalTitle" type="text" value="' + escapeHtml(kpi.title) + '" placeholder="e.g., Monthly Revenue" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;">' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
      '<div>' +
        '<label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Current Value</label>' +
        '<input id="kpiModalValue" type="number" value="' + (kpi.value || 0) + '" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;">' +
      '</div>' +
      '<div>' +
        '<label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Target (0 = no target)</label>' +
        '<input id="kpiModalTarget" type="number" value="' + (kpi.target || 0) + '" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;">' +
      '</div>' +
    '</div>' +
    '<div style="margin-bottom:20px;">' +
      '<label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Unit (optional)</label>' +
      '<input id="kpiModalUnit" type="text" value="' + escapeHtml(kpi.unit || '') + '" placeholder="e.g., $, %, pts" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;">' +
    '</div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
      '<button id="kpiModalCancel" style="padding:8px 16px;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-secondary);font-size:13px;cursor:pointer;font-family:inherit;">Cancel</button>' +
      '<button id="kpiModalSave" style="padding:8px 16px;border-radius:var(--radius-md);border:none;background:var(--accent);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;">Save</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus title field
  setTimeout(function() {
    var titleInput = document.getElementById('kpiModalTitle');
    if (titleInput) titleInput.focus();
  }, 50);

  document.getElementById('kpiModalCancel').onclick = function() { overlay.remove(); };
  document.getElementById('kpiModalSave').onclick = function() {
    var title = (document.getElementById('kpiModalTitle').value || '').trim();
    if (!title) { showToast('Title is required', 'warning'); return; }
    var value = parseFloat(document.getElementById('kpiModalValue').value) || 0;
    var target = parseFloat(document.getElementById('kpiModalTarget').value) || 0;
    var unit = (document.getElementById('kpiModalUnit').value || '').trim();

    if (isEdit) {
      kpis[editIdx].title = title;
      kpis[editIdx].value = value;
      kpis[editIdx].target = target;
      kpis[editIdx].unit = unit;
    } else {
      kpis.push({ id: Date.now(), title: title, value: value, target: target, unit: unit });
    }
    saveDashboardKPIs(kpis);
    renderAnalyticsDashboard();
    overlay.remove();
    showToast(isEdit ? 'KPI updated' : 'KPI added', 'success');
  };
}
```

### Step 3.2: Replace `addDashboardKPI()` and `editDashboardKPI()` (lines 4772-4808)

Replace the existing `addDashboardKPI()` body:

```javascript
function addDashboardKPI() {
  openKPIModal();
}

function editDashboardKPI(idx) {
  openKPIModal(idx);
}
```

Keep `deleteDashboardKPI()` as-is (line 4810-4816).

### Verification
- Build: `bash src/build.sh`
- Open Analytics > Dashboard > click "Add KPI" -- should open modal form (not prompt dialogs)
- Fill in Title: "Test", Value: 50, Target: 100, Unit: "%" -- click Save -- KPI card appears
- Click Edit on the KPI -- modal pre-fills with values -- change value to 75, Save -- updates
- Click Delete -- confirm dialog -- KPI removed

### Commit
`v29.3: Replace KPI prompt dialogs with modal form`

---

## Task 4: Rewrite `renderAnalyticsDashboard()` -- Top Row Stat Cards

Replace the entire `renderAnalyticsDashboard()` function with the new layout. This task covers the top row of 5 large stat cards.

### Files
- `src/js/core/29-analytics-commerce.js`

### Step 4.1: Replace `renderAnalyticsDashboard()` (lines 4633-4769)

Delete the entire existing function body and replace with:

```javascript
function renderAnalyticsDashboard() {
  var container = document.getElementById('dashboardContainer');
  if (!container) return;

  var revenue = getDashboardRevenue();
  var clientData = getDashboardClients();
  var social = getDashboardSocial();
  var health = getDashboardBrandHealth();
  var aiUsage = getDashboardAIUsage();

  var html = '';

  // === TOP ROW: 5 Stat Cards ===
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px;">';

  // 1. Revenue
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
  html += '<div>';
  html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Revenue</div>';
  html += '<div style="font-size:26px;font-weight:700;color:var(--text-primary);">$' + revenue.totalRevenue.toLocaleString() + '</div>';
  html += '<div style="margin-top:4px;">' + renderTrendArrow(revenue.trend) + '</div>';
  html += '</div>';
  html += '<div style="opacity:0.7;">' + renderSVGSparkline(revenue.sparkline, 70, 28, 'var(--accent)') + '</div>';
  html += '</div>';
  html += '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:var(--text-muted);">';
  html += '<span>MRR ~$' + revenue.mrrEstimate.toLocaleString() + '</span>';
  html += '<span>Outstanding $' + revenue.outstanding.toLocaleString() + '</span>';
  html += '</div>';
  html += '</div>';

  // 2. Clients
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
  html += '<div>';
  html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Clients</div>';
  html += '<div style="font-size:26px;font-weight:700;color:var(--text-primary);">' + clientData.total + '</div>';
  if (clientData.newThisMonth > 0) {
    html += '<div style="font-size:11px;color:#4ade80;margin-top:4px;font-weight:600;">+' + clientData.newThisMonth + ' this month</div>';
  }
  html += '</div>';
  html += '<div style="color:var(--text-muted);opacity:0.5;"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>';
  html += '</div>';
  html += '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:var(--text-muted);">';
  html += '<span>Pipeline $' + clientData.pipelineValue.toLocaleString() + '</span>';
  html += '<span>Avg $' + clientData.avgDealValue.toLocaleString() + '</span>';
  html += '</div>';
  html += '</div>';

  // 3. Social Reach
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
  html += '<div>';
  html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Social</div>';
  html += '<div style="font-size:26px;font-weight:700;color:var(--text-primary);">' + social.postsThisMonth + '</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">posts this month</div>';
  html += '</div>';
  html += '<div style="opacity:0.7;">' + renderSVGSparkline(social.weeklyPosts, 70, 28, '#f472b6') + '</div>';
  html += '</div>';
  var platKeys = Object.keys(social.byPlatform);
  if (platKeys.length > 0) {
    html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">';
    platKeys.forEach(function(p) {
      html += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--bg-tertiary);color:var(--text-secondary);">' + escapeHtml(p) + ' ' + social.byPlatform[p] + '</span>';
    });
    html += '</div>';
  }
  html += '</div>';

  // 4. Brand Health
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
  html += '<div>';
  html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Brand Health</div>';
  var healthColor = health.total >= 80 ? '#4ade80' : health.total >= 60 ? 'var(--accent)' : health.total >= 40 ? '#fbbf24' : '#ef4444';
  html += '<div style="font-size:26px;font-weight:700;color:' + healthColor + ';">' + health.total + '<span style="font-size:14px;font-weight:500;color:var(--text-muted);">/100</span></div>';
  html += '<div style="font-size:11px;color:' + healthColor + ';margin-top:4px;font-weight:600;">Grade: ' + health.grade + '</div>';
  html += '</div>';
  html += '<div>' + renderSVGDonut(health.total, 100, 48, healthColor) + '</div>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">';
  var healthLabels = { identity: 'Identity', content: 'Content', clients: 'Clients', social: 'Social' };
  Object.keys(health.scores).forEach(function(k) {
    var s = health.scores[k];
    var c = s >= 20 ? '#4ade80' : s >= 10 ? '#fbbf24' : 'var(--text-muted)';
    html += '<span style="font-size:10px;padding:2px 6px;border-radius:8px;background:var(--bg-tertiary);color:' + c + ';">' + healthLabels[k] + ' ' + s + '/25</span>';
  });
  html += '</div>';
  html += '</div>';

  // 5. AI Spend
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
  html += '<div>';
  html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">AI Spend (30d)</div>';
  html += '<div style="font-size:26px;font-weight:700;color:var(--text-primary);">$' + aiUsage.totalSpend.toFixed(2) + '</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + aiUsage.totalRequests + ' requests</div>';
  html += '</div>';
  html += '<div style="opacity:0.7;">' + renderSVGSparkline(aiUsage.dailySpend, 70, 28, '#8b5cf6') + '</div>';
  html += '</div>';
  html += '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:var(--text-muted);">';
  html += '<span>Cache ' + aiUsage.cacheRate + '%</span>';
  if (aiUsage.topModels.length > 0) {
    html += '<span>' + (typeof getModelDisplayName === 'function' ? getModelDisplayName(aiUsage.topModels[0].model) : aiUsage.topModels[0].model) + '</span>';
  }
  html += '</div>';
  html += '</div>';

  html += '</div>'; // end top row

  // === SECOND ROW: Charts (Task 5) ===
  html += renderDashboardChartRow(revenue, clientData, social, aiUsage);

  // === THIRD ROW: Custom KPIs (Task 6) ===
  html += renderDashboardKPISection();

  // === FOURTH ROW: Team + Activity (Task 7) ===
  html += renderDashboardTeamActivity();

  // === FIFTH ROW: Screenshots (kept, existing) ===
  html += renderDashboardScreenshots();

  container.innerHTML = html;
}
```

### Verification
- Build: `bash src/build.sh`
- Open Analytics > Dashboard -- should show 5 stat cards in top row with sparklines and icons
- Cards should show: Revenue (with trend arrow, MRR, outstanding), Clients (with count, pipeline value), Social (posts this month, weekly sparkline), Brand Health (score donut), AI Spend (with daily sparkline)
- Responsive: resize browser to narrow -- cards should reflow to 2 columns then 1

### Commit
`v29.3: Rewrite dashboard top row with 5 KPI stat cards`

---

## Task 5: Chart Row (Revenue Trend, Client Pipeline Funnel, Social Bars)

### Files
- `src/js/core/29-analytics-commerce.js`

### Step 5.1: Add `renderDashboardChartRow()` function

Insert after `renderAnalyticsDashboard()`:

```javascript
// v29.3: Dashboard chart row
function renderDashboardChartRow(revenue, clientData, social, aiUsage) {
  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">';

  // Left: Revenue Trend (bar chart, last 6 months)
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Revenue Trend</div>';
  if (revenue.sparkline && revenue.sparkline.some(function(v) { return v > 0; })) {
    var now = new Date();
    var monthLabels = [];
    for (var mi = 5; mi >= 0; mi--) {
      var d = new Date(now.getFullYear(), now.getMonth() - mi, 1);
      monthLabels.push(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]);
    }
    html += '<div style="padding:8px 0;">' + renderSVGBarChart(revenue.sparkline, monthLabels, 300, 120, 'var(--accent)') + '</div>';
  } else {
    html += '<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:12px;">No revenue data yet. Create invoices to see trends.</div>';
  }
  html += '</div>';

  // Right: Client Pipeline Funnel
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Client Pipeline</div>';
  var stages = CLIENT_PIPELINE_STAGES.map(function(s) {
    return { label: s.label, count: clientData.byStage[s.id] || 0, color: s.color };
  }).filter(function(s) { return s.count > 0; });

  if (stages.length > 0) {
    html += '<div style="padding:8px 0;">' + renderSVGFunnel(stages, 280, stages.length * 28) + '</div>';
  } else {
    html += '<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:12px;">No clients yet. Add clients from <a href="#" onclick="showView(\'clients\');return false;" style="color:var(--accent);">People</a>.</div>';
  }
  html += '</div>';

  html += '</div>'; // end 2-col grid

  // Full-width row: AI Usage by Feature + Social by Platform
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">';

  // Left: AI Usage by Feature
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">AI Cost by Feature</div>';
  var featureData = aiUsage.contextCosts || {};
  var featureKeys = Object.keys(featureData).filter(function(k) { return featureData[k] > 0; });
  if (featureKeys.length > 0) {
    var featureLabels = { chat: 'Chat', studio: 'Studio', automation: 'Automations', image: 'Image Gen' };
    var maxFeatureCost = 0;
    featureKeys.forEach(function(k) { if (featureData[k] > maxFeatureCost) maxFeatureCost = featureData[k]; });
    featureKeys.sort(function(a, b) { return featureData[b] - featureData[a]; });
    featureKeys.forEach(function(k) {
      var pct = maxFeatureCost > 0 ? Math.max(3, Math.round((featureData[k] / maxFeatureCost) * 100)) : 0;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
      html += '<div style="width:70px;font-size:11px;color:var(--text-secondary);text-align:right;">' + (featureLabels[k] || k) + '</div>';
      html += '<div style="flex:1;height:14px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">';
      html += '<div style="height:100%;width:' + pct + '%;background:#8b5cf6;border-radius:3px;"></div>';
      html += '</div>';
      html += '<div style="width:50px;font-size:11px;font-weight:600;color:var(--text-primary);">$' + featureData[k].toFixed(2) + '</div>';
      html += '</div>';
    });
  } else {
    html += '<div style="text-align:center;padding:24px 0;color:var(--text-muted);font-size:12px;">No usage data yet.</div>';
  }
  html += '</div>';

  // Right: Social Posts by Platform
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Posts by Platform</div>';
  var platKeys = Object.keys(social.byPlatform);
  if (platKeys.length > 0) {
    var platColors = { x: '#1da1f2', twitter: '#1da1f2', instagram: '#e4405f', threads: '#000000', linkedin: '#0a66c2', facebook: '#1877f2' };
    var platData = platKeys.map(function(p) { return social.byPlatform[p]; });
    var platLabels = platKeys.map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1); });
    html += '<div style="padding:8px 0;">' + renderSVGBarChart(platData, platLabels, 280, 100, '#f472b6') + '</div>';
  } else {
    html += '<div style="text-align:center;padding:24px 0;color:var(--text-muted);font-size:12px;">No social posts yet. Post from <a href="#" onclick="showView(\'social\');return false;" style="color:var(--accent);">Social Hub</a>.</div>';
  }
  html += '</div>';

  html += '</div>'; // end 2-col grid

  return html;
}
```

### Verification
- Build: `bash src/build.sh`
- Open Analytics > Dashboard -- below stat cards should see 2x2 chart grid
- Revenue Trend: bar chart with month labels (or empty state message if no invoices)
- Client Pipeline: horizontal funnel bars color-coded by stage
- AI Cost by Feature: horizontal bars (Chat, Studio, Automations, Image Gen)
- Posts by Platform: bar chart with platform labels
- Responsive: narrow browser -- on mobile the 2-col grid should stack. Add this at the end of Task 8 with CSS.

### Commit
`v29.3: Add dashboard chart row (revenue trend, client pipeline, AI feature costs, social platforms)`

---

## Task 6: Custom KPIs Section (Upgraded)

### Files
- `src/js/core/29-analytics-commerce.js`

### Step 6.1: Add `renderDashboardKPISection()` function

Insert after `renderDashboardChartRow()`:

```javascript
// v29.3: Upgraded custom KPIs section with sparklines
function renderDashboardKPISection() {
  var kpis = getDashboardKPIs();
  var html = '<div style="margin-bottom:24px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<div style="font-size:14px;font-weight:600;color:var(--text-primary);">Custom KPIs</div>';
  html += '<button onclick="addDashboardKPI()" style="padding:5px 12px;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add KPI</button>';
  html += '</div>';

  if (kpis.length === 0) {
    html += '<div style="text-align:center;padding:28px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);color:var(--text-muted);font-size:12px;">';
    html += 'No custom KPIs yet. Track key metrics like conversion rate, NPS, or retention.';
    html += '</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">';
    kpis.forEach(function(kpi, idx) {
      var pct = kpi.target > 0 ? Math.min(100, Math.round((kpi.value / kpi.target) * 100)) : 0;
      var barColor = pct >= 100 ? '#4ade80' : pct >= 60 ? 'var(--accent)' : '#fbbf24';

      html += '<div style="padding:14px 16px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);position:relative;">';

      // Action buttons (top-right)
      html += '<div style="position:absolute;top:8px;right:8px;display:flex;gap:2px;">';
      html += '<button onclick="event.stopPropagation();editDashboardKPI(' + idx + ')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px 4px;" title="Edit">';
      html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
      html += '<button onclick="event.stopPropagation();deleteDashboardKPI(' + idx + ')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px 4px;" title="Remove">';
      html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
      html += '</div>';

      // KPI content
      html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;padding-right:40px;">' + escapeHtml(kpi.title || 'Untitled') + '</div>';
      html += '<div style="display:flex;align-items:baseline;gap:4px;margin-bottom:6px;">';
      html += '<span style="font-size:24px;font-weight:700;color:var(--text-primary);">' + escapeHtml(String(kpi.value || 0)) + '</span>';
      if (kpi.unit) html += '<span style="font-size:12px;color:var(--text-muted);">' + escapeHtml(kpi.unit) + '</span>';
      if (kpi.target > 0) html += '<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">/ ' + kpi.target + '</span>';
      html += '</div>';

      // Progress bar (if target set)
      if (kpi.target > 0) {
        html += '<div style="height:4px;background:var(--bg-tertiary);border-radius:2px;overflow:hidden;">';
        html += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px;transition:width 0.3s;"></div>';
        html += '</div>';
        html += '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;text-align:right;">' + pct + '%</div>';
      }

      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}
```

### Verification
- Build: `bash src/build.sh`
- Open Analytics > Dashboard -- below chart row, custom KPIs section should render
- Add a KPI via modal -- card appears with progress bar
- Edit/Delete via icon buttons (pencil and X SVGs, not text)

### Commit
`v29.3: Upgrade custom KPIs section with SVG icon buttons and cleaner layout`

---

## Task 7: Team and Activity Feed Section

### Files
- `src/js/core/29-analytics-commerce.js`

### Step 7.1: Add `renderDashboardTeamActivity()` function

Insert after `renderDashboardKPISection()`:

```javascript
// v29.3: Team + Recent Activity feed for dashboard
function renderDashboardTeamActivity() {
  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">';

  // Left: Team & Direct Reports (compact version of original)
  var team = typeof getPeople === 'function' ? getPeople('team') : [];
  var reports = typeof getPeople === 'function' ? getPeople('report') : [];
  var people = team.concat(reports);
  if (!clientsShowAllBrands && typeof selectedBrand !== 'undefined') {
    var bIdx = selectedBrand;
    people = people.filter(function(p) { return p.brandIndex == null || String(p.brandIndex) === String(bIdx); });
  }

  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);">Team</div>';
  html += '<span style="font-size:11px;color:var(--text-muted);">' + people.length + ' people</span>';
  html += '</div>';

  if (people.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">No team members yet. Add them from <a href="#" onclick="showView(\'clients\');return false;" style="color:var(--accent);">People</a>.</div>';
  } else {
    // Show up to 6 people
    var shown = people.slice(0, 6);
    shown.forEach(function(p) {
      var isReport = p.personType === 'report';
      var onclickFn = isReport ? 'openReportDetail' : 'openTeamDetail';
      var avatar = p.logo ?
        '<img src="' + p.logo + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;" alt="">' :
        '<div style="width:28px;height:28px;border-radius:50%;background:var(--brand-accent-10,rgba(168,152,120,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent);font-weight:700;font-size:11px;">' + (p.name ? p.name.charAt(0).toUpperCase() : '?') + '</div>';

      html += '<div onclick="' + onclickFn + '(\'' + p.id + '\')" style="display:flex;align-items:center;gap:10px;padding:6px 0;cursor:pointer;" onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'">';
      html += avatar;
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(p.name || 'Unnamed') + '</div>';
      html += '<div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(p.role || (isReport ? 'Direct Report' : 'Team')) + '</div>';
      html += '</div>';
      html += '</div>';
    });
    if (people.length > 6) {
      html += '<div style="font-size:11px;color:var(--accent);cursor:pointer;text-align:center;padding:6px 0;" onclick="showView(\'clients\')">View all ' + people.length + ' people</div>';
    }
  }
  html += '</div>';

  // Right: Recent Activity Feed
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px 18px;">';
  html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Recent Activity</div>';

  var activities = [];

  // Gather recent invoices
  try {
    var invoices = getInvoices().slice(0, 5);
    invoices.forEach(function(inv) {
      activities.push({
        type: 'invoice',
        label: (inv.status === 'paid' ? 'Invoice paid' : 'Invoice created') + ' - $' + (parseFloat(inv.total) || 0).toFixed(2),
        time: inv.date || inv.createdAt || '',
        icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
      });
    });
  } catch(e) {}

  // Gather recent social posts
  try {
    var posts = (typeof getSocialPosts === 'function' ? getSocialPosts() : []).slice(0, 5);
    posts.forEach(function(p) {
      activities.push({
        type: 'social',
        label: 'Posted to ' + (p.platform || 'social'),
        time: p.postedAt || '',
        icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f472b6" stroke-width="1.5"><path d="M17 2h4v4M14.5 9.5L21 3M7 22H3v-4M9.5 14.5L3 21"/></svg>'
      });
    });
  } catch(e) {}

  // Gather recent automation runs
  try {
    var history = JSON.parse(localStorage.getItem('roweos_auto_lab_history') || '[]').slice(0, 5);
    history.forEach(function(h) {
      activities.push({
        type: 'automation',
        label: (h.success ? 'Ran' : 'Failed') + ': ' + (h.name || 'Automation'),
        time: h.timestamp || '',
        icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="' + (h.success ? '#4ade80' : '#ef4444') + '" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'
      });
    });
  } catch(e) {}

  // Sort by time descending, take top 8
  activities.sort(function(a, b) {
    return (b.time || '').localeCompare(a.time || '');
  });
  activities = activities.slice(0, 8);

  if (activities.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">No recent activity. Start using RoweOS to see your timeline.</div>';
  } else {
    activities.forEach(function(a) {
      var timeAgo = '';
      if (a.time) {
        try {
          var diff = Date.now() - new Date(a.time).getTime();
          var mins = Math.floor(diff / 60000);
          if (mins < 60) timeAgo = mins + 'm ago';
          else if (mins < 1440) timeAgo = Math.floor(mins / 60) + 'h ago';
          else timeAgo = Math.floor(mins / 1440) + 'd ago';
        } catch(e) {}
      }
      html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;">';
      html += '<div style="flex-shrink:0;">' + a.icon + '</div>';
      html += '<div style="flex:1;min-width:0;font-size:12px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(a.label) + '</div>';
      html += '<div style="flex-shrink:0;font-size:10px;color:var(--text-muted);">' + timeAgo + '</div>';
      html += '</div>';
    });
  }
  html += '</div>';

  html += '</div>'; // end 2-col grid
  return html;
}
```

### Verification
- Build: `bash src/build.sh`
- Open Analytics > Dashboard -- below KPIs, should see Team (left) and Recent Activity (right)
- Team section: avatar circles, name, role. If >6 people, "View all" link appears.
- Activity feed: sorted by time, icons colored by type (gold invoice, pink social, green/red automation)

### Commit
`v29.3: Add dashboard team section and recent activity feed`

---

## Task 8: Screenshots Section + Responsive CSS

### Files
- `src/js/core/29-analytics-commerce.js`
- `src/css/core/01-base.css` (or the appropriate CSS file)

### Step 8.1: Add `renderDashboardScreenshots()` function

Insert after `renderDashboardTeamActivity()`:

```javascript
// v29.3: Screenshots section (preserved from original dashboard)
function renderDashboardScreenshots() {
  var shots = getDashboardScreenshots();
  var html = '<div style="margin-bottom:24px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<div style="font-size:14px;font-weight:600;color:var(--text-primary);">Screenshots</div>';
  html += '<label style="padding:5px 12px;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload';
  html += '<input type="file" accept="image/*" multiple onchange="handleDashboardScreenshots(this)" style="display:none;">';
  html += '</label>';
  html += '</div>';

  if (shots.length === 0) {
    html += '<div style="text-align:center;padding:28px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);color:var(--text-muted);font-size:12px;">';
    html += 'No screenshots uploaded. Track visual progress by uploading screenshots.';
    html += '</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">';
    shots.forEach(function(s, idx) {
      html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);overflow:hidden;position:relative;">';
      html += '<img src="' + s.data + '" style="width:100%;height:120px;object-fit:cover;display:block;cursor:pointer;" onclick="window.open(this.src)">';
      html += '<button onclick="event.stopPropagation();deleteDashboardScreenshot(' + idx + ')" style="position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:11px;cursor:pointer;line-height:20px;text-align:center;">x</button>';
      html += '<div style="padding:6px 10px;">';
      html += '<div style="font-size:11px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" contenteditable="true" onblur="updateDashboardScreenshotTitle(' + idx + ',this.textContent)">' + escapeHtml(s.title || 'Screenshot') + '</div>';
      html += '<div style="font-size:9px;color:var(--text-muted);">' + (s.date ? new Date(s.date).toLocaleDateString() : '') + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}
```

### Step 8.2: Add responsive CSS for dashboard chart rows

**File:** `src/css/core/01-base.css`

Find the mobile media query block `@media (max-width: 768px)` and add inside it:

```css
/* v29.3: Dashboard KPI responsive */
#dashboardContainer > div[style*="grid-template-columns: 1fr 1fr"],
#dashboardContainer > div[style*="grid-template-columns:1fr 1fr"] {
  grid-template-columns: 1fr !important;
}
```

NOTE: Because all chart grid styling is inline, mobile override needs `!important`. This is the standard approach in RoweOS for overriding inline grid columns on mobile. Alternatively, this can be handled via a resize check in JS that adjusts the inline styles. Since the app already uses `!important` overrides in mobile media queries for inline-styled grids, this approach is consistent.

### Verification
- Build: `bash src/build.sh`
- Open Analytics > Dashboard -- full layout should render: stat cards, charts, KPIs, team + activity, screenshots
- Resize to mobile width (<768px) -- chart rows should stack to 1 column
- Upload a screenshot -- appears in grid
- Delete a screenshot -- removed

### Commit
`v29.3: Add dashboard screenshots section and mobile responsive CSS`

---

## Task 9: Clean Up Dead Code

### Files
- `src/js/core/29-analytics-commerce.js`

### Step 9.1: Remove orphaned original code

The original `renderAnalyticsDashboard()` was replaced in Task 4. The original KPI CRUD functions (`addDashboardKPI`, `editDashboardKPI`, `deleteDashboardKPI`) were updated in Task 3 but the bodies of `addDashboardKPI` and `editDashboardKPI` still call `openKPIModal()` now. The screenshot CRUD functions (`handleDashboardScreenshots`, `deleteDashboardScreenshot`, `updateDashboardScreenshotTitle`) remain unchanged and are still referenced by the new screenshots section.

Ensure the following are the ONLY dashboard-related functions in the file:

**Data aggregation (Task 1):**
- `getDashboardRevenue()`
- `getDashboardClients()`
- `getDashboardSocial()`
- `getDashboardBrandHealth()`
- `getDashboardAIUsage()`

**Chart helpers (Task 2):**
- `renderSVGSparkline()`
- `renderSVGBarChart()`
- `renderSVGDonut()`
- `renderSVGFunnel()`
- `renderTrendArrow()`

**Modal (Task 3):**
- `openKPIModal()`
- `addDashboardKPI()` (now calls `openKPIModal()`)
- `editDashboardKPI()` (now calls `openKPIModal(idx)`)

**Render functions (Tasks 4-8):**
- `renderAnalyticsDashboard()` (main entry point)
- `renderDashboardChartRow()`
- `renderDashboardKPISection()`
- `renderDashboardTeamActivity()`
- `renderDashboardScreenshots()`

**Existing (unchanged):**
- `getDashboardKPIs()`
- `saveDashboardKPIs()`
- `getDashboardScreenshots()`
- `saveDashboardScreenshots()`
- `deleteDashboardKPI()`
- `handleDashboardScreenshots()`
- `deleteDashboardScreenshot()`
- `updateDashboardScreenshotTitle()`

No functions should be duplicated or orphaned.

### Verification
- Build: `bash src/build.sh`
- Full walkthrough: Analytics > Dashboard tab -- all sections render
- Click through all interactive elements: Add KPI (modal), Edit KPI (modal), Delete KPI (confirm), Upload screenshot, Delete screenshot
- Check console for any `undefined` or function-not-found errors
- Test with empty data (new brand with no invoices/clients/posts) -- all empty states render gracefully
- Test with populated data -- all cards show real numbers

### Commit
`v29.3: Analytics KPI Dashboard overhaul complete - clean up dead code`

---

## Summary of All Changes

| Task | What | Lines Changed |
|------|------|---------------|
| 1 | Data aggregation functions (5 new) | +~120 lines before `renderAnalyticsDashboard` |
| 2 | SVG chart helpers (5 new) | +~80 lines |
| 3 | KPI modal form (1 new, 2 replaced) | +~60 lines, -~40 lines |
| 4 | Top row stat cards (rewrite render fn) | ~135 lines replacing ~135 lines |
| 5 | Chart row (1 new render fn) | +~100 lines |
| 6 | Custom KPIs section (1 new render fn) | +~60 lines |
| 7 | Team + Activity feed (1 new render fn) | +~120 lines |
| 8 | Screenshots section + CSS | +~40 lines + 4 CSS lines |
| 9 | Dead code cleanup | net ~0 (verification pass) |

**Net change:** approximately +400 new lines, -170 removed lines = ~230 net new lines in `29-analytics-commerce.js`, plus 4 lines in CSS.

**No new files created. No new localStorage keys. No new dependencies. No Firebase sync changes needed** -- all data sources already exist and are already synced.
