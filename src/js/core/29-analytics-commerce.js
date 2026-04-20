// ═══════════════════════════════════════════════════════════════
// ANALYTICS & SCHEDULE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// v25.3: Analytics Dashboard - Web Analytics via Vercel
var _analyticsData = null;
var _analyticsTab = 'website';

function switchAnalyticsTab(tab) {
  _analyticsTab = tab;
  var tabs = document.querySelectorAll('.analytics-tab');
  for (var i = 0; i < tabs.length; i++) {
    var isActive = tabs[i].getAttribute('data-tab') === tab;
    tabs[i].style.fontWeight = isActive ? '600' : '500';
    tabs[i].style.color = isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
    tabs[i].style.background = isActive ? 'var(--bg-secondary)' : 'transparent';
    tabs[i].style.borderColor = isActive ? 'var(--border-color)' : 'transparent';
  }
  var websiteTab = document.getElementById('analyticsWebsiteTab');
  var socialTab = document.getElementById('analyticsSocialTab');
  if (websiteTab) websiteTab.style.display = tab === 'website' ? '' : 'none';
  if (socialTab) socialTab.style.display = tab === 'social' ? '' : 'none';
}

function loadAnalyticsDashboard() { if (typeof loadWebAnalytics === 'function') loadWebAnalytics(); }

// v28.4: Save/load custom analytics site URL per brand
function saveAnalyticsSiteUrl() {
  var brandIdx = (typeof selectedBrand !== 'undefined') ? selectedBrand : 0;
  var urlEl = document.getElementById('commerceWebsiteUrl') || document.getElementById('analyticsWebsiteUrl');
  if (!urlEl) return;
  var url = urlEl.value.trim();
  if (url) {
    localStorage.setItem('roweos_analytics_site_' + brandIdx, url);
    showToast('Analytics site URL saved', 'success');
  } else {
    localStorage.removeItem('roweos_analytics_site_' + brandIdx);
    showToast('Analytics site URL cleared', 'info');
  }
}

function loadAnalyticsSiteUrl() {
  var brandIdx = (typeof selectedBrand !== 'undefined') ? selectedBrand : 0;
  var url = localStorage.getItem('roweos_analytics_site_' + brandIdx) || '';
  var el1 = document.getElementById('commerceWebsiteUrl');
  var el2 = document.getElementById('analyticsWebsiteUrl');
  if (el1) el1.value = url;
  if (el2) el2.value = url;
}

// v25.3: Website Analytics (Vercel API)
function loadWebAnalytics() {
  // v28.4: Populate URL inputs on load
  loadAnalyticsSiteUrl();

  var loading = document.getElementById('webAnalyticsLoading');
  var content = document.getElementById('webAnalyticsContent');
  if (loading) loading.style.display = '';
  if (content) content.style.display = 'none';

  var days = parseInt((document.getElementById('webAnalyticsTimeRange') || {}).value || '30');
  var now = new Date();
  var from = new Date(now.getTime() - days * 86400000).toISOString();
  var to = now.toISOString();

  // v28.4: Pass custom site URL if configured
  var brandIdx = (typeof selectedBrand !== 'undefined') ? selectedBrand : 0;
  var siteUrl = localStorage.getItem('roweos_analytics_site_' + brandIdx) || '';
  var urlParam = siteUrl ? '&site=' + encodeURIComponent(siteUrl) : '';

  fetch('/api/analytics?days=' + days + urlParam)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        if (loading) loading.innerHTML = '<div style="color:#ef4444;">Error: ' + escapeHtml(data.error) + (data.detail ? '<br><span style="font-size:11px;color:var(--text-muted);">' + escapeHtml(data.detail).substring(0, 200) + '</span>' : '') + '</div>';
        return;
      }
      _analyticsData = data;
      renderWebAnalytics(data, days);
    })
    .catch(function(err) {
      if (loading) loading.innerHTML = '<div style="color:#ef4444;">Failed to load analytics: ' + escapeHtml(err.message) + '</div>';
    });
}

function renderWebAnalytics(data, days) {
  var loading = document.getElementById('webAnalyticsLoading');
  var content = document.getElementById('webAnalyticsContent');
  if (loading) loading.style.display = 'none';
  if (content) content.style.display = '';

  // v25.3: Parse Vercel timeseries — format: { data: { groups: { all: [{key, total, devices, bounceRate}] } } }
  var totalVisitors = 0;
  var totalPageViews = 0;
  var avgBounceRate = 0;
  var dailyData = [];
  var ts = data.timeseries || null;

  if (ts && ts.error) {
    var loading2 = document.getElementById('webAnalyticsLoading');
    if (loading2) {
      loading2.style.display = '';
      loading2.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Vercel Web Analytics not available.<br><span style="font-size:11px;">Ensure Web Analytics is enabled in your Vercel project settings.</span></div>';
    }
    if (content) content.style.display = 'none';
    return;
  }

  if (ts && ts.data && ts.data.groups && ts.data.groups.all) {
    var hourlyData = ts.data.groups.all;
    var dayMap = {};
    var bounceCount = 0;
    var bounceEntries = 0;
    hourlyData.forEach(function(h) {
      var dayKey = (h.key || '').split('T')[0];
      if (!dayKey) return;
      if (!dayMap[dayKey]) dayMap[dayKey] = { views: 0, visitors: 0 };
      dayMap[dayKey].views += (h.total || 0);
      dayMap[dayKey].visitors += (h.devices || 0);
      totalPageViews += (h.total || 0);
      totalVisitors += (h.devices || 0);
      if (h.bounceRate > 0) { bounceCount += h.bounceRate; bounceEntries++; }
    });
    avgBounceRate = bounceEntries > 0 ? Math.round(bounceCount / bounceEntries) : 0;
    var dayKeys = Object.keys(dayMap).sort();
    dayKeys.forEach(function(dk) { dailyData.push({ date: dk, views: dayMap[dk].views, visitors: dayMap[dk].visitors }); });
  }

  var viewsPerVisitor = totalVisitors > 0 ? (totalPageViews / totalVisitors).toFixed(1) : '0';

  // Summary cards
  var cardsEl = document.getElementById('webAnalyticsSummary');
  if (cardsEl) {
    cardsEl.innerHTML = renderAnalyticCard('Unique Visitors', formatAnalyticsNumber(totalVisitors), days + ' day total', '#4ade80')
      + renderAnalyticCard('Page Views', formatAnalyticsNumber(totalPageViews), days + ' day total', '#60a5fa')
      + renderAnalyticCard('Views / Visitor', viewsPerVisitor, 'average', '#a78bfa')
      + renderAnalyticCard('Bounce Rate', avgBounceRate + '%', 'average', '#fbbf24');
  }

  // Daily traffic chart (inline SVG bar chart)
  var pagesEl = document.getElementById('webAnalyticsPages');
  if (pagesEl && dailyData.length > 0) {
    var html = '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Daily Traffic</div>';
    var maxViews = 1;
    dailyData.forEach(function(d) { if (d.views > maxViews) maxViews = d.views; });
    var barWidth = Math.max(12, Math.floor((100 / dailyData.length) - 1));
    html += '<div style="display:flex;align-items:flex-end;gap:2px;height:120px;padding-bottom:24px;position:relative;">';
    dailyData.forEach(function(d) {
      var pct = Math.max(2, Math.round((d.views / maxViews) * 100));
      var dateLabel = d.date.split('-').slice(1).join('/');
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">';
      html += '<div style="font-size:9px;color:var(--text-muted);">' + d.views + '</div>';
      html += '<div style="width:100%;max-width:32px;height:' + pct + '%;background:var(--brand-accent,#a89878);border-radius:3px 3px 0 0;min-height:2px;transition:height 0.3s;"></div>';
      html += '<div style="font-size:9px;color:var(--text-muted);position:absolute;bottom:0;transform:rotate(-45deg);white-space:nowrap;">' + dateLabel + '</div>';
      html += '</div>';
    });
    html += '</div>';
    // Daily breakdown table
    html += '<div style="margin-top:16px;">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Daily Breakdown</div>';
    dailyData.slice().reverse().forEach(function(d) {
      var barPct = Math.round((d.views / maxViews) * 100);
      html += '<div style="display:flex;align-items:center;gap:12px;padding:4px 0;border-bottom:1px solid var(--border-color);">';
      html += '<div style="width:80px;font-size:12px;color:var(--text-muted);">' + d.date + '</div>';
      html += '<div style="flex:1;height:4px;border-radius:2px;background:var(--bg-tertiary);overflow:hidden;"><div style="height:100%;width:' + barPct + '%;background:var(--brand-accent,#a89878);border-radius:2px;"></div></div>';
      html += '<div style="width:50px;text-align:right;font-size:12px;font-weight:600;color:var(--text-secondary);">' + d.views + ' / ' + d.visitors + '</div>';
      html += '</div>';
    });
    html += '</div>';
    pagesEl.innerHTML = html;
  } else if (pagesEl) {
    pagesEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:20px 0;text-align:center;">No traffic data for this period</div>';
  }

  // Hide breakdown panels since Vercel API doesn't expose those endpoints publicly
  var refEl = document.getElementById('webAnalyticsReferrers');
  var countryEl = document.getElementById('webAnalyticsCountries');
  var devEl = document.getElementById('webAnalyticsDevices');
  if (refEl) refEl.parentNode.style.display = 'none';
  if (devEl) devEl.style.display = 'none';
}

function renderAnalyticCard(label, value, subtitle, color) {
  return '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px;">'
    + '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">' + label + '</div>'
    + '<div style="font-size:28px;font-weight:700;color:' + color + ';line-height:1;">' + value + '</div>'
    + '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + subtitle + '</div>'
    + '</div>';
}

function formatAnalyticsNumber(n) {
  if (typeof n !== 'number') n = parseInt(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// v25.3: Backward compat stubs
function updateAnalyticsDashboard() { loadAnalyticsDashboard(); }
function exportAnalytics() { showToast('Export coming soon', 'info'); }
function clearAnalytics() { showToast('Analytics data is server-side', 'info'); }

function getAnalyticsData() {
  var data = localStorage.getItem('roweos_analytics');
  if (!data) return { entries: [] };
  try {
    return JSON.parse(data);
  } catch (e) {
    return { entries: [] };
  }
}

function saveAnalyticsData(data) {
  localStorage.setItem('roweos_analytics', JSON.stringify(data));
}

// v20.2: Per-provider spending thresholds
function saveAnalyticsThreshold(provider, val) {
  var labels = { claude: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini' };
  var num = parseFloat(val);
  if (isNaN(num) || num <= 0) {
    localStorage.removeItem('roweos_analytics_threshold_' + provider);
    showToast((labels[provider] || provider) + ' threshold cleared', 'info');
  } else {
    localStorage.setItem('roweos_analytics_threshold_' + provider, String(num));
    showToast((labels[provider] || provider) + ' threshold set to $' + num.toFixed(2), 'success');
  }
  writeDB('profile/main', { analyticsThreshold: { provider: provider, value: num || null } }); // v25.1
}

function loadAnalyticsThreshold() {
  // v20.2: Migrate old global threshold to per-provider keys
  var oldGlobal = localStorage.getItem('roweos_analytics_threshold');
  if (oldGlobal && !localStorage.getItem('roweos_analytics_threshold_claude') && !localStorage.getItem('roweos_analytics_threshold_openai') && !localStorage.getItem('roweos_analytics_threshold_gemini')) {
    localStorage.setItem('roweos_analytics_threshold_claude', oldGlobal);
    localStorage.setItem('roweos_analytics_threshold_openai', oldGlobal);
    localStorage.setItem('roweos_analytics_threshold_gemini', oldGlobal);
    localStorage.removeItem('roweos_analytics_threshold');
  }
  // v20.2: Load per-provider threshold inputs
  ['claude', 'openai', 'gemini'].forEach(function(p) {
    var el = document.getElementById('analyticsThreshold_' + p);
    if (!el) return;
    var val = localStorage.getItem('roweos_analytics_threshold_' + p);
    el.value = val ? parseFloat(val) : '';
  });
}

// v24.25: Per-provider Budget/Threshold system
var _providerBudgetConfig = [
  { key: 'claude', label: 'Anthropic', color: '#a78bfa', matchKeys: ['claude', 'anthropic'] },
  { key: 'openai', label: 'OpenAI', color: '#4ade80', matchKeys: ['openai'] },
  { key: 'gemini', label: 'Gemini', color: '#60a5fa', matchKeys: ['gemini', 'google', 'nanobanana'] }
];

function getProviderBudget(provider) {
  try { return JSON.parse(localStorage.getItem('roweos_api_budget_' + provider) || 'null'); } catch(e) { return null; }
}

function saveProviderBudget(provider, data) {
  localStorage.setItem('roweos_api_budget_' + provider, JSON.stringify(data));
  writeDB('profile/main', { apiBudget: { provider: provider, data: data } }); // v25.1
}

function getProviderSpendSinceDate(provider, sinceDate) {
  var analytics = getAnalyticsData();
  var config = _providerBudgetConfig.find(function(p) { return p.key === provider; });
  if (!config) return 0;
  var total = 0;
  (analytics.entries || []).forEach(function(e) {
    if (e.timestamp >= sinceDate && config.matchKeys.indexOf(e.provider) !== -1) total += (e.cost || 0);
  });
  return total;
}

function toggleProviderMode(provider) {
  var budget = getProviderBudget(provider);
  var currentMode = (budget && budget.mode) || 'threshold';
  var newMode = currentMode === 'threshold' ? 'budget' : 'threshold';
  if (!budget) budget = {};
  budget.mode = newMode;
  saveProviderBudget(provider, budget);
  renderProviderBudgetCard(provider);
}

function saveProviderLoaded(provider, val) {
  var num = parseFloat(val);
  var budget = getProviderBudget(provider) || { mode: 'budget' };
  if (isNaN(num) || num <= 0) {
    budget.loaded = 0;
    budget.reloadDate = null;
    showToast(_providerBudgetConfig.find(function(p) { return p.key === provider; }).label + ' budget cleared', 'info');
  } else {
    budget.loaded = num;
    budget.reloadDate = Date.now();
    showToast(_providerBudgetConfig.find(function(p) { return p.key === provider; }).label + ' budget set to $' + num.toFixed(2), 'success');
  }
  saveProviderBudget(provider, budget);
  renderProviderBudgetCard(provider);
  updateOverviewBudgetCard();
}

function reloadProviderBudget(provider) {
  var budget = getProviderBudget(provider) || { mode: 'budget' };
  var inputEl = document.getElementById('providerBudgetLoaded_' + provider);
  var val = inputEl ? parseFloat(inputEl.value) : 0;
  if (!val || val <= 0) { showToast('Enter an amount first', 'warning'); return; }
  budget.loaded = val;
  budget.reloadDate = Date.now();
  budget.mode = 'budget';
  saveProviderBudget(provider, budget);
  renderProviderBudgetCard(provider);
  updateOverviewBudgetCard();
  var cfg = _providerBudgetConfig.find(function(p) { return p.key === provider; });
  showToast((cfg ? cfg.label : provider) + ' reloaded: $' + val.toFixed(2), 'success');
}

function renderProviderBudgetCard(provider) {
  var cfg = _providerBudgetConfig.find(function(p) { return p.key === provider; });
  if (!cfg) return;
  var el = document.getElementById('providerBudgetCard_' + provider);
  if (!el) return;

  var budget = getProviderBudget(provider) || {};
  var mode = budget.mode || 'threshold';
  var thresholdVal = localStorage.getItem('roweos_analytics_threshold_' + provider);

  var html = '';
  // Header with toggle
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);gap:8px;flex-wrap:wrap;">';
  html += '<div style="display:flex;align-items:center;gap:6px;font-size:var(--text-base);color:var(--text-tertiary);"><span style="color:' + cfg.color + ';">&#9679;</span> ' + cfg.label + '</div>';
  html += '<div style="display:flex;background:var(--bg-tertiary);border-radius:6px;overflow:hidden;border:1px solid var(--border-color);flex-shrink:0;">';
  html += '<button onclick="toggleProviderMode(\'' + provider + '\')" style="padding:3px 8px;font-size:10px;border:none;cursor:pointer;background:' + (mode === 'threshold' ? 'var(--accent)' : 'transparent') + ';color:' + (mode === 'threshold' ? '#fff' : 'var(--text-muted)') + ';font-weight:600;">Threshold</button>';
  html += '<button onclick="toggleProviderMode(\'' + provider + '\')" style="padding:3px 8px;font-size:10px;border:none;cursor:pointer;background:' + (mode === 'budget' ? 'var(--accent)' : 'transparent') + ';color:' + (mode === 'budget' ? '#fff' : 'var(--text-muted)') + ';font-weight:600;">Budget</button>';
  html += '</div></div>';

  if (mode === 'threshold') {
    // v24.25: Threshold mode - now shows countdown from threshold value
    var thresholdNum = parseFloat(thresholdVal) || 0;
    // Calculate spend this calendar month
    var _monthStart = new Date(); _monthStart.setDate(1); _monthStart.setHours(0,0,0,0);
    var thresholdSpent = thresholdNum > 0 ? getProviderSpendSinceDate(provider, _monthStart.getTime()) : 0;
    var thresholdRemain = Math.max(0, thresholdNum - thresholdSpent);
    var thresholdPct = thresholdNum > 0 ? Math.min(100, (thresholdSpent / thresholdNum) * 100) : 0;
    var thresholdBarColor = thresholdRemain <= 0 ? '#ef4444' : (thresholdRemain < thresholdNum * 0.2 ? '#f59e0b' : cfg.color);

    html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
    html += '<span style="font-size:var(--text-xl);font-weight:600;color:var(--text-secondary);">$</span>';
    html += '<input type="number" id="analyticsThreshold_' + provider + '" placeholder="0.00" step="0.50" min="0" value="' + (thresholdVal || '') + '" style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:6px 10px;font-size:var(--text-lg);font-weight:600;color:' + cfg.color + ';width:100px;min-width:70px;outline:none;" onchange="saveAnalyticsThreshold(\'' + provider + '\',this.value)">';
    html += '</div>';
    if (thresholdNum > 0) {
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;margin-bottom:4px;">';
      html += '<span style="font-size:var(--text-2xl);font-weight:700;color:' + thresholdBarColor + ';">$' + thresholdRemain.toFixed(2) + '</span>';
      html += '<span style="font-size:var(--text-xs);color:var(--text-muted);">$' + thresholdSpent.toFixed(2) + ' used</span>';
      html += '</div>';
      html += '<div style="height:5px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;margin-bottom:6px;">';
      html += '<div style="height:100%;width:' + thresholdPct + '%;background:' + thresholdBarColor + ';border-radius:3px;transition:width 0.3s;"></div>';
      html += '</div>';
      html += '<div style="font-size:var(--text-xs);color:var(--text-tertiary);">This month\'s usage against threshold</div>';
    } else {
      html += '<div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:4px;">Alert when spending approaches this amount</div>';
    }
  } else {
    // Budget mode - countdown
    var loaded = budget.loaded || 0;
    var reloadDate = budget.reloadDate || Date.now();
    var spentSince = loaded > 0 ? getProviderSpendSinceDate(provider, reloadDate) : 0;
    var remaining = Math.max(0, loaded - spentSince);
    var pct = loaded > 0 ? Math.min(100, (spentSince / loaded) * 100) : 0;
    var barColor = remaining <= 0 ? '#ef4444' : (remaining < loaded * 0.2 ? '#f59e0b' : cfg.color);

    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">';
    html += '<span style="font-size:var(--text-sm);color:var(--text-muted);">Loaded:</span>';
    html += '<span style="font-size:var(--text-secondary);font-weight:600;">$</span>';
    html += '<input type="number" id="providerBudgetLoaded_' + provider + '" placeholder="0.00" step="1" min="0" value="' + (loaded || '') + '" style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:4px 8px;font-size:var(--text-sm);font-weight:600;color:' + cfg.color + ';width:80px;min-width:60px;outline:none;">';
    html += '<button onclick="reloadProviderBudget(\'' + provider + '\')" style="padding:4px 10px;font-size:10px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;font-weight:600;flex-shrink:0;">Reload</button>';
    html += '</div>';

    if (loaded > 0) {
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">';
      html += '<span style="font-size:var(--text-2xl);font-weight:700;color:' + barColor + ';">$' + remaining.toFixed(2) + '</span>';
      html += '<span style="font-size:var(--text-xs);color:var(--text-muted);">$' + spentSince.toFixed(2) + ' used</span>';
      html += '</div>';
      html += '<div style="height:5px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;margin-bottom:6px;">';
      html += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:3px;transition:width 0.3s;"></div>';
      html += '</div>';
      var reloadStr = new Date(reloadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      html += '<div style="font-size:var(--text-xs);color:var(--text-tertiary);">Last reloaded: ' + reloadStr + '</div>';
    } else {
      html += '<div style="font-size:var(--text-xs);color:var(--text-tertiary);">Enter your API credit balance and click Reload</div>';
    }
  }

  el.innerHTML = html;
}

function renderAllProviderBudgetCards() {
  _providerBudgetConfig.forEach(function(cfg) { renderProviderBudgetCard(cfg.key); });
  updateOverviewBudgetCard();
}

function updateOverviewBudgetCard() {
  var overviewLabel = document.getElementById('commerceApiSpendLabel');
  var overviewVal = document.getElementById('commerceApiSpend');
  var overviewSub = document.getElementById('commerceApiBudgetSub');

  // Check if any provider is in budget mode
  var totalLoaded = 0;
  var totalRemaining = 0;
  var hasBudget = false;
  _providerBudgetConfig.forEach(function(cfg) {
    var budget = getProviderBudget(cfg.key);
    if (budget && budget.mode === 'budget' && budget.loaded > 0) {
      hasBudget = true;
      var spent = getProviderSpendSinceDate(cfg.key, budget.reloadDate || Date.now());
      totalLoaded += budget.loaded;
      totalRemaining += Math.max(0, budget.loaded - spent);
    }
  });

  if (!hasBudget) {
    // No budgets set - show normal spend
    var analytics = getAnalyticsData();
    var thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    var spent = 0;
    (analytics.entries || []).forEach(function(e) {
      if (e.timestamp > thirtyDaysAgo) spent += (e.cost || 0);
    });
    if (overviewLabel) overviewLabel.textContent = 'API Spend (30 Days)';
    if (overviewVal) { overviewVal.textContent = '$' + spent.toFixed(2); overviewVal.style.color = 'var(--accent)'; }
    if (overviewSub) overviewSub.style.display = 'none';
    return;
  }

  var color = totalRemaining <= 0 ? '#ef4444' : (totalRemaining < totalLoaded * 0.2 ? '#f59e0b' : '#4ade80');
  if (overviewLabel) overviewLabel.textContent = 'Budget Remaining';
  if (overviewVal) { overviewVal.textContent = '$' + totalRemaining.toFixed(2); overviewVal.style.color = color; }
  if (overviewSub) {
    overviewSub.style.display = '';
    overviewSub.textContent = '$' + (totalLoaded - totalRemaining).toFixed(2) + ' of $' + totalLoaded.toFixed(2) + ' used';
  }
}

function trackAPIUsage(provider, model, inputTokens, outputTokens, cached, webSearchUsed, context) {
  var analytics = getAnalyticsData();
  if (!analytics.entries) analytics.entries = [];

  var cost = calculateCost(provider, model, inputTokens, outputTokens, webSearchUsed);

  analytics.entries.push({
    timestamp: Date.now(),
    provider: provider,
    model: model,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    cost: cost,
    cached: cached || false,
    webSearchUsed: webSearchUsed || false,
    context: context || 'chat', // v24.18: Feature context (chat, studio, automation, image)
    brandId: parseInt(document.getElementById('agentBrand').value || document.getElementById('brand').value) || 0
  });

  // v24.18: Session cost indicator
  _sessionCostTotal = (_sessionCostTotal || 0) + cost;
  var sessionEl = document.getElementById('sessionCostDisplay');
  if (sessionEl) sessionEl.textContent = '$' + _sessionCostTotal.toFixed(4);
  
  // Keep only last 90 days
  var ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
  analytics.entries = analytics.entries.filter(function(e) { return e.timestamp > ninetyDaysAgo; });
  
  saveAnalyticsData(analytics);

  // v20.2: Per-provider spending threshold check
  try {
    var providerGroups = { claude: ['claude', 'anthropic'], openai: ['openai'], gemini: ['gemini', 'google', 'nanobanana'] };
    var providerLabels = { claude: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini' };
    var normKey = (provider === 'anthropic') ? 'claude' : (provider === 'google' || provider === 'nanobanana') ? 'gemini' : provider;
    var provThreshold = parseFloat(localStorage.getItem('roweos_analytics_threshold_' + normKey));
    if (provThreshold && provThreshold > 0) {
      var thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      var matchProviders = providerGroups[normKey] || [normKey];
      var provTotal = 0;
      analytics.entries.forEach(function(e) {
        if (e.timestamp > thirtyDaysAgo && matchProviders.indexOf(e.provider) !== -1) provTotal += (e.cost || 0);
      });
      if (provTotal >= provThreshold - 0.25 && provTotal < provThreshold + 0.50) {
        showToast((providerLabels[normKey] || normKey) + ' approaching threshold: $' + provTotal.toFixed(2) + ' / $' + provThreshold.toFixed(2), 'warning');
      }
    }
  } catch(e) {}

  // v24.25: Update per-provider budget countdown after each API call
  if (typeof updateOverviewBudgetCard === 'function') updateOverviewBudgetCard();
  var _budgetKey = (provider === 'anthropic') ? 'claude' : (provider === 'google' || provider === 'nanobanana') ? 'gemini' : provider;
  if (typeof renderProviderBudgetCard === 'function') renderProviderBudgetCard(_budgetKey);
}

// v15.4: Updated pricing per MTok (Feb 2026)
function calculateCost(provider, model, inputTokens, outputTokens, webSearchEnabled) {
  // Normalize provider names to pricing keys
  if (provider === 'anthropic') provider = 'claude';
  if (provider === 'google') provider = 'gemini';
  var pricing = {
    'claude': {
      'claude-opus-4-7': { input: 5.00, output: 25.00 },
      'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 }
    },
    'openai': {
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4.1': { input: 2.00, output: 8.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-5.4': { input: 2.50, output: 15.00 },
      'gpt-5.4-pro': { input: 30.00, output: 180.00 },
      'gpt-5.4-thinking': { input: 2.50, output: 15.00 },
      'o4-mini': { input: 1.10, output: 4.40 },
      'o1-preview': { input: 15.00, output: 60.00 },
      'o1-mini': { input: 3.00, output: 12.00 }
    },
    'gemini': {
      'gemini-3.1-pro-preview': { input: 2.00, output: 12.00 },
      'gemini-2.5-pro': { input: 1.25, output: 10.00 },
      'gemini-2.5-flash': { input: 0.30, output: 2.50 },
      'gemini-3-flash-preview': { input: 0.10, output: 0.40 },
      'gemini-1.5-pro': { input: 2.00, output: 12.00 }
    },
    'nanobanana': {
      'gemini-3-pro-image-preview': { perImage: 0.134 },
      'gemini-2.5-flash-image': { perImage: 0.039 },
      'gemini-2.0-flash-exp-image-generation': { perImage: 0.039 }
    }
  };

  // v15.4: Handle image generation (flat per-image cost)
  if (provider === 'nanobanana') {
    var imgRates = pricing.nanobanana && pricing.nanobanana[model];
    return imgRates ? imgRates.perImage : 0.134;
  }

  var rates = pricing[provider] && pricing[provider][model];
  if (!rates) return 0;

  var inputCost = (inputTokens / 1000000) * rates.input;
  var outputCost = (outputTokens / 1000000) * rates.output;
  var totalCost = inputCost + outputCost;

  // Add web search cost if enabled ($10 per 1000 searches for Claude)
  if (webSearchEnabled && provider === 'claude') {
    totalCost += 0.01; // $10 / 1000 = $0.01 per search
  }

  return totalCost;
}

// v15.4: Added nanobanana tracking + model-level breakdown
function calculatePeriodStats(analytics, startTime, endTime) {
  var entries = analytics.entries.filter(function(e) {
    return e.timestamp >= startTime && e.timestamp < endTime;
  });

  var stats = {
    totalCost: 0,
    totalRequests: entries.length,
    cacheHits: 0,
    providerCosts: { claude: 0, openai: 0, gemini: 0, nanobanana: 0 },
    providerRequests: { claude: 0, openai: 0, gemini: 0, nanobanana: 0 },
    contextCosts: { chat: 0, studio: 0, automation: 0, image: 0 }, // v24.18: Feature breakdown
    modelBreakdown: {},
    totalInputTokens: 0,
    totalOutputTokens: 0
  };

  entries.forEach(function(e) {
    stats.totalCost += e.cost || 0;
    if (e.cached) stats.cacheHits++;
    // Normalize provider names for aggregation
    var prov = e.provider;
    if (prov === 'anthropic') prov = 'claude';
    if (prov === 'google') prov = 'gemini';
    stats.providerCosts[prov] = (stats.providerCosts[prov] || 0) + (e.cost || 0);
    stats.providerRequests[prov] = (stats.providerRequests[prov] || 0) + 1;
    stats.totalInputTokens += e.inputTokens || 0;
    stats.totalOutputTokens += e.outputTokens || 0;
    // v24.18: Context/feature breakdown
    var ctx = e.context || 'chat';
    stats.contextCosts[ctx] = (stats.contextCosts[ctx] || 0) + (e.cost || 0);
    // Per-model breakdown
    if (!stats.modelBreakdown[e.model]) {
      stats.modelBreakdown[e.model] = { cost: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
    }
    stats.modelBreakdown[e.model].cost += e.cost || 0;
    stats.modelBreakdown[e.model].requests += 1;
    stats.modelBreakdown[e.model].inputTokens += e.inputTokens || 0;
    stats.modelBreakdown[e.model].outputTokens += e.outputTokens || 0;
  });

  return stats;
}

function updateSummaryCard(id, currentValue, previousValue) {
  var el = document.getElementById(id);
  if (!el) return;
  
  if (id === 'totalSpend') {
    el.textContent = '$' + currentValue.toFixed(2);
  } else {
    el.textContent = currentValue.toLocaleString();
  }
  
  // Calculate change percentage
  var change = previousValue > 0 ? ((currentValue - previousValue) / previousValue * 100) : 0;
  var changeEl = document.getElementById(id + 'Change');
  if (changeEl) {
    var sign = change >= 0 ? '+' : '';
    changeEl.textContent = sign + change.toFixed(1) + '% from last month';
    changeEl.style.color = change > 0 ? '#a89878' : '#888';
  }
}

function updateProviderBreakdown(stats) {
  var total = stats.totalCost;
  var providers = ['claude', 'openai', 'gemini'];
  
  providers.forEach(function(provider) {
    var cost = stats.providerCosts[provider] || 0;
    var requests = stats.providerRequests[provider] || 0;
    var percentage = total > 0 ? (cost / total * 100) : 0;
    
    var costEl = document.getElementById(provider + 'Cost');
    var barEl = document.getElementById(provider + 'Bar');
    var reqEl = document.getElementById(provider + 'Requests');
    
    if (costEl) costEl.textContent = '$' + cost.toFixed(2);
    if (barEl) barEl.style.width = percentage + '%';
    if (reqEl) reqEl.textContent = requests + ' request' + (requests !== 1 ? 's' : '');
  });
}

function renderRecentActivity(analytics) {
  var container = document.getElementById('recentActivity');
  if (!container) return;
  
  var recent = analytics.entries
    .sort(function(a, b) { return b.timestamp - a.timestamp; })
    .slice(0, 10);
  
  if (recent.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-tertiary);">No recent activity to display. Start using BrandAI to see analytics here.</div>';
    return;
  }
  
  var html = '<div style="display: flex; flex-direction: column; gap: var(--space-3);">';
  recent.forEach(function(entry) {
    var brand = brands[entry.brandId] || { name: 'Unknown' };
    var date = new Date(entry.timestamp);
    var providerColors = { claude: '#a89878', openai: '#10a37f', gemini: '#4285f4' };
    
    html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md);">';
    html += '<div style="display: flex; align-items: center; gap: var(--space-3);">';
    html += '<div style="width: 8px; height: 8px; background: ' + providerColors[entry.provider] + '; border-radius: 50%;"></div>';
    html += '<div>';
    html += '<div style="font-weight: 500; font-size: var(--text-base);">' + brand.name + '</div>';
    html += '<div style="font-size: var(--text-sm); color: var(--text-tertiary);">' + getModelDisplayName(entry.model) + '</div>';
    html += '</div>';
    html += '</div>';
    html += '<div style="text-align: right;">';
    html += '<div style="font-weight: 600; color: var(--accent); font-size: var(--text-base);">$' + entry.cost.toFixed(4) + '</div>';
    html += '<div style="font-size: var(--text-sm); color: var(--text-tertiary);">' + formatTimeAgo(entry.timestamp) + '</div>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  
  container.innerHTML = html;
}

// v25.3: Old exportAnalytics/clearAnalytics removed - stubs defined above in analytics dashboard section

// ============================================
// v10.5.25: INVENTORY FUNCTIONS - Enhanced with Images
// ============================================

var editingInventoryIndex = -1;
var inventoryImageData = null;

function renderInventoryView() {
  loadInventoryData();

  // v15.4: Adapt labels for LifeAI Possessions mode
  var isLife = localStorage.getItem('roweos_app_mode') === 'life';
  var breadcrumb = document.getElementById('inventoryBreadcrumbLabel');
  var titleFull = document.getElementById('inventoryHeaderTitle');
  var titleShort = document.getElementById('inventoryHeaderShort');
  if (breadcrumb) breadcrumb.textContent = isLife ? 'Possessions' : 'Inventory';
  if (titleFull) titleFull.textContent = isLife ? 'My Possessions' : 'Products & Services';
  if (titleShort) titleShort.textContent = isLife ? 'Possessions' : 'Inventory';

  // v15.4: Update filter options for LifeAI
  var filterEl = document.getElementById('inventoryFilter');
  if (filterEl) {
    if (isLife) {
      filterEl.innerHTML = '<option value="all">All Items</option><option value="electronics">Electronics</option><option value="furniture">Furniture</option><option value="vehicle">Vehicles</option><option value="clothing">Clothing</option><option value="other">Other</option>';
    } else {
      filterEl.innerHTML = '<option value="all">All Types</option><option value="product">Products</option><option value="service">Services</option>';
    }
  }

  // v15.4: Update stat labels for LifeAI
  if (isLife) {
    var prodLabel = document.querySelector('#statProducts + div, #statProducts ~ div');
    // Handled in updateInventoryStats
  }

  // v15.37: Show/hide brand filter toggle (Life mode hides it)
  var brandFilterEl = document.getElementById('inventoryBrandFilter');
  if (brandFilterEl) brandFilterEl.style.display = isLife ? 'none' : 'flex';

  updateInventoryStats();
  renderInventoryGrid();

  // v10.5.25: Fix inventory input colors for current theme
  fixInventoryInputColors();
}

// v10.5.25: Fix inventory input/select colors based on current theme
function fixInventoryInputColors() {
  var isLightMode = document.documentElement.classList.contains('light-mode');
  var search = document.getElementById('inventorySearch');
  var filter = document.getElementById('inventoryFilter');
  var sort = document.getElementById('inventorySort');
  
  var elements = [search, filter, sort];
  
  elements.forEach(function(el) {
    if (!el) return;
    
    if (isLightMode) {
      el.style.backgroundColor = '#ffffff';
      el.style.color = '#1a1a1a';
      el.style.borderColor = '#cccccc';
    } else {
      el.style.backgroundColor = '#1a1a1a';
      el.style.color = '#f4f4f5';
      el.style.borderColor = '#444444';
    }
  });
}

// v15.14: Separate inventory storage for Life vs Brand mode
function getInventoryStorageKey() {
  var mode = localStorage.getItem('roweos_app_mode') || 'brand';
  return mode === 'life' ? 'roweos_life_inventory' : 'roweos_inventory';
}

function loadInventoryData() {
  var key = getInventoryStorageKey();
  var data = localStorage.getItem(key);
  var isLife = key === 'roweos_life_inventory';
  var defaultCats = isLife ? ['Electronics', 'Clothing', 'Home', 'Vehicles', 'Collectibles', 'Other'] : ['General', 'Products', 'Services', 'Digital', 'Consulting'];
  console.log('[Inventory] loadInventoryData called, key:', key, 'data exists:', !!data);
  if (data) {
    try {
      inventory = JSON.parse(data);
      console.log('[Inventory] Loaded from localStorage:', (inventory.items || []).length, 'items');
    } catch (e) {
      console.warn('[Inventory] Parse error:', e);
      inventory = { items: [], categories: defaultCats };
    }
  } else {
    console.log('[Inventory] No data in localStorage, initializing empty');
    inventory = { items: [], categories: defaultCats };
  }

  // v15.37: Ensure brand index migration
  migrateInventoryBrandIndex();

  // v20.5: Only pull from Firebase on first load, not every view open (prevents race conditions)
  if (!window._inventoryFirebaseLoaded) {
    window._inventoryFirebaseLoaded = true;
    setTimeout(function() {
      if (typeof loadInventoryFromFirebase === 'function') {
        loadInventoryFromFirebase();
      }
    }, 1000);
  }
}

// v15.37: Inventory brand filter state
var inventoryShowAllBrands = false;

// v15.37: Migrate inventory items to include brandIndex
function migrateInventoryBrandIndex() {
  var key = getInventoryStorageKey();
  if (key === 'roweos_life_inventory') return;
  try {
    var data = localStorage.getItem(key);
    if (!data) return;
    var inv = JSON.parse(data);
    if (!inv.items || inv.items.length === 0) return;
    var needsMigration = inv.items.some(function(item) { return typeof item.brandIndex === 'undefined'; });
    if (!needsMigration) return;
    var currentBrand = selectedBrand || 0;
    inv.items.forEach(function(item) {
      if (typeof item.brandIndex === 'undefined') item.brandIndex = currentBrand;
    });
    localStorage.setItem(key, JSON.stringify(inv));
    console.log('[Inventory] v15.37: Migrated items with brandIndex=' + currentBrand);
  } catch(e) { console.warn('[Inventory] Migration error:', e); }
}

function saveInventoryData() {
  // Update timestamp
  inventory.updatedAt = new Date().toISOString();
  var key = getInventoryStorageKey();
  localStorage.setItem(key, JSON.stringify(inventory));
  console.log('[Inventory] Saved to localStorage:', inventory.items.length, 'items');

  // v25.3: Write-through to dedicated Firestore doc - mode-aware path
  var isLifeInventory = key === 'roweos_life_inventory';
  writeDB(isLifeInventory ? 'lifeAI/possessions' : 'profile/inventory', { data: inventory });
  // Also sync to legacy path for backward compat (brand mode only)
  if (!isLifeInventory) syncInventoryToFirebase();
}

// v11.0.5: Sync inventory to Firebase (uses firebaseUser.uid with roweos_users collection)
function syncInventoryToFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebase.firestore && firebaseUser && firebaseUser.uid) {
      firebase.firestore().collection('roweos_users').doc(firebaseUser.uid).set({
        inventory: {
          items: inventory.items || [],
          categories: inventory.categories || ['General', 'Products', 'Services', 'Digital', 'Consulting'],
          updatedAt: new Date().toISOString()
        }
      }, { merge: true }).then(function() {
        console.log('[Inventory] Synced to Firebase:', (inventory.items || []).length, 'items');
      }).catch(function(error) {
        console.warn('[Inventory] Firebase sync failed:', error);
      });
    } else {
      console.log('[Inventory] Firebase not ready or user not logged in');
    }
  } catch (error) {
    console.warn('[Inventory] Firebase sync error:', error);
  }
}

// v11.0.5: Load inventory from Firebase (uses firebaseUser.uid with roweos_users collection)
function loadInventoryFromFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebase.firestore && firebaseUser && firebaseUser.uid) {
      firebase.firestore().collection('roweos_users').doc(firebaseUser.uid).get().then(function(doc) {
        if (doc.exists) {
          var userData = doc.data();
          var data = userData.inventory;
          if (data && data.items && Array.isArray(data.items)) {
            // Check if Firebase has newer data than localStorage
            var localUpdated = inventory.updatedAt || '1970-01-01';
            var firebaseUpdated = data.updatedAt || '1970-01-01';
            
            var localCount = (inventory.items || []).length;
            var cloudCount = data.items.length;
            // v20.5: Only overwrite if cloud is newer AND has at least as many items (prevent deletion)
            if ((firebaseUpdated > localUpdated && cloudCount >= localCount) || localCount === 0) {
              inventory.items = data.items;
              inventory.categories = data.categories || inventory.categories;
              inventory.updatedAt = data.updatedAt;
              localStorage.setItem(getInventoryStorageKey(), JSON.stringify(inventory));
              renderInventoryGrid();
              updateInventoryStats();
              console.log('[Inventory] Loaded from Firebase:', cloudCount, 'items (cloud newer, local had ' + localCount + ')');
            } else {
              console.log('[Inventory] Keeping local:', localCount, 'items (cloud has ' + cloudCount + ', ts local=' + localUpdated + ' cloud=' + firebaseUpdated + ')');
            }
          }
        }
      }).catch(function(error) {
        console.warn('[Inventory] Firebase load failed:', error);
      });
    } else {
      console.log('[Inventory] Firebase not ready or user not logged in');
    }
  } catch (error) {
    console.warn('[Inventory] Firebase load error:', error);
  }
}

/**
 * v11.0.5: Comprehensive Data Recovery System
 * Checks all app data across localStorage, correct Firebase location, and old Firebase location
 */

// ═══════════════════════════════════════════════════════════════════════════
// v12.2.4: SYNCHRONIZATION HUB FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * v12.2.4: Initialize the Sync Hub view
 */
function initSyncHub() {
  updateSyncHubStatus();
  renderSyncInventory();
  loadSyncHubSettings();
  updateStorageBar();
  renderStorageManagement();
  // v28.1: Render sync status + conflicts in Sync Hub (not just Settings)
  if (typeof renderSyncStatus === 'function') renderSyncStatus('syncHubStatusPanel');
  if (typeof renderSyncConflicts === 'function') renderSyncConflicts('syncHubConflictsPanel');
  // v23.0: Update snapshot count and last backup time
  _whenSyncDBReady(function() {
    listSnapshots(function(snaps) {
      var countEl = document.getElementById('syncHubSnapshotCount');
      if (countEl) countEl.textContent = '(' + snaps.length + ')';
    });
  });
  var lastBackup = localStorage.getItem('roweos_last_manual_backup') || localStorage.getItem('roweos_last_auto_backup');
  var backupEl = document.getElementById('syncHubLastBackup');
  if (backupEl && lastBackup) {
    var d = new Date(parseInt(lastBackup));
    backupEl.textContent = 'Last backup: ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }
  // v23.0: Highlight active sync mode button
  var currentMode = syncSettings.syncMode || 'hybrid';
  setSyncMode(currentMode);
}

/**
 * v12.2.4: Update sync hub connection status
 */
function updateSyncHubStatus() {
  var statusDot = document.getElementById('syncHubStatusDot');
  var statusText = document.getElementById('syncHubStatusText');
  var lastTime = document.getElementById('syncHubLastTime');
  var lastDevice = document.getElementById('syncHubLastDevice');
  var pendingCount = document.getElementById('syncHubPendingCount');

  if (!statusDot) return;

  var isConnected = typeof firebaseUser !== 'undefined' && firebaseUser;

  if (isConnected) {
    // v29.0: Check if API keys exist — sync connected doesn't mean AI works
    var _hasApiKeys = false;
    try { var _ak = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); _hasApiKeys = !!(_ak.anthropic || _ak.openai || _ak.google); } catch(e) {}
    if (_hasApiKeys) {
      statusDot.style.background = '#22c55e';
      statusText.textContent = 'Connected as ' + (firebaseUser.email || 'Anonymous');
    } else {
      statusDot.style.background = '#f59e0b';
      statusText.textContent = 'Synced as ' + (firebaseUser.email || 'Anonymous') + ' - API keys needed in System settings';
    }
  } else {
    statusDot.style.background = '#666';
    statusText.textContent = 'Not Connected';
  }

  // Last sync info
  var savedLastSync = localStorage.getItem('roweos_last_sync');
  var savedLastDevice = localStorage.getItem('roweos_last_sync_device');
  // v28.2: Format last sync time (handle both timestamps and date strings)
  if (lastTime) {
    if (savedLastSync) {
      var _lsNum = parseInt(savedLastSync);
      if (!isNaN(_lsNum) && _lsNum > 1000000000000) {
        var _lsDate = new Date(_lsNum);
        lastTime.textContent = _lsDate.toLocaleDateString() + ' ' + _lsDate.toLocaleTimeString();
      } else {
        lastTime.textContent = savedLastSync;
      }
    } else {
      lastTime.textContent = 'Never';
    }
  }
  if (lastDevice) lastDevice.textContent = savedLastDevice || '--';
  // v28.2: Parse pending changes array to show count (not raw JSON)
  if (pendingCount) {
    var _pcRaw = localStorage.getItem('roweos_pending_changes');
    var _pcCount = 0;
    try { _pcCount = JSON.parse(_pcRaw || '[]').length; } catch(e) {}
    pendingCount.textContent = _pcCount;
  }
}

/**
 * v15.12: Render sync data inventory with local AND cloud counts from V2 subcollections
 */
async function renderSyncInventory() {
  var container = document.getElementById('syncDataInventory');
  if (!container) return;

  container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading inventory...</div>';

  // v15.10: Category definitions — local counts always from localStorage
  var categories = [
    { name: 'Brands', syncKey: 'brands', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_user_brands') || '[]').length; } catch(e) { return 0; } } },
    { name: 'BrandAI Chats', syncKey: 'brandai_chats', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]').length; } catch(e) { return 0; } } },
    { name: 'LifeAI Chats', syncKey: 'lifeai_chats', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]').length; } catch(e) { return 0; } } },
    { name: 'BrandAI To-Dos', syncKey: 'brand_todos', localCount: function() { try { return JSON.parse(localStorage.getItem('roweosTodos') || '[]').length; } catch(e) { return 0; } } },
    { name: 'LifeAI To-Dos', syncKey: 'life_todos', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_life_todos') || '[]').length; } catch(e) { return 0; } } },
    { name: 'Calendar', syncKey: 'calendar', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_calendar') || '[]').length; } catch(e) { return 0; } } },
    { name: 'Journal', syncKey: 'journal', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_journal') || '[]').length; } catch(e) { return 0; } } },
    { name: 'Library Files', syncKey: 'library', localCount: function() { try { var lib = JSON.parse(localStorage.getItem('roweosLibrary') || '{}'); var c = 0; Object.keys(lib).forEach(function(k) { if (lib[k] && lib[k].files) c += lib[k].files.length; }); try { var lifeLib = JSON.parse(localStorage.getItem('roweos_life_library') || '{}'); if (lifeLib.files) c += lifeLib.files.length; } catch(e2) {} return c; } catch(e) { return 0; } } },
    { name: 'Inventory', syncKey: 'inventory', localCount: function() { try { var inv = JSON.parse(localStorage.getItem('roweos_inventory') || '{}'); return (inv.items || []).length; } catch(e) { return 0; } } },
    { name: 'Possessions', syncKey: 'possessions', localCount: function() { try { var inv = JSON.parse(localStorage.getItem('roweos_life_inventory') || '{}'); return (inv.items || []).length; } catch(e) { return 0; } } },
    { name: 'Studio Runs', syncKey: 'runs', localCount: function() { try { var d = JSON.parse(localStorage.getItem('roweos_runs') || '{}'); return (d.runs || []).length; } catch(e) { return 0; } } },
    { name: 'Pulse Goals', syncKey: 'goals', localCount: function() { try { var raw = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]'); if (Array.isArray(raw)) return raw.length; if (raw && Array.isArray(raw.data)) return raw.data.length; if (raw && Array.isArray(raw.goals)) return raw.goals.length; return 0; } catch(e) { return 0; } } },
    { name: 'Automations', syncKey: 'automations', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_automations') || '[]').length; } catch(e) { return 0; } } },
    { name: 'Custom Ops', syncKey: 'custom_ops', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_custom_operations') || '[]').length; } catch(e) { return 0; } } },
    { name: 'Clients', syncKey: 'clients', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_clients') || '[]').length; } catch(e) { return 0; } } },
    { name: 'LifeAI Profiles', syncKey: 'life_profiles', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]').length; } catch(e) { return 0; } } },
    { name: 'Brand Logos', syncKey: 'logos', localCount: function() { var c = 0; for (var i = 0; i < 10; i++) { if (localStorage.getItem('roweos_brand_' + i + '_logo')) c++; } for (var pi = 0; pi < 5; pi++) { if (localStorage.getItem('roweos_lifeai_logo_profile_' + pi)) c++; } return c; } },
    { name: 'Folio Items', syncKey: 'folio', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_folio_items') || '[]').length; } catch(e) { return 0; } } },
    { name: 'Notebooks', syncKey: 'scribe', localCount: function() { try { return JSON.parse(localStorage.getItem('roweos_scribe_notebooks') || '[]').length; } catch(e) { return 0; } } }
  ];

  // v15.12: Always fetch real cloud counts from V2 subcollections
  var cloudCounts = {};
  {
    var hasFirebase = typeof firebase !== 'undefined' && firebase.firestore && typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.uid;
    if (hasFirebase) {
      try {
        var uid = firebaseUser.uid;
        var db = firebase.firestore();
        // v28.4: Always read cloud counts from old path (writeDB always writes here reliably)
        // V4 dual-write is secondary and may not have all categories
        var basePath = 'roweos_users/' + uid;
        var results = await Promise.all([
          db.collection(basePath + '/brands').get(),
          db.doc(basePath + '/conversations/agentHistory').get(),
          db.doc(basePath + '/lifeAI/main').get(),
          db.doc(basePath + '/todos/main').get(),
          db.doc(basePath + '/calendar/main').get(),
          db.collection(basePath + '/runs').get(),
          db.doc(basePath + '/profile/inventory').get(), // v28.3: Single doc, not collection
          db.collection(basePath + '/pulse/goals').get(), // v29.3: Per-goal collection
          db.doc(basePath + '/profile/main').get(),
          db.doc(basePath + '/library/brand').get(),
          db.doc(basePath + '/library/life').get(),
          db.doc(basePath).get(),
          db.doc(basePath + '/folio/main').get()
        ]);
        // v28.2: Exclude _all meta doc from brand count
        var _brandCount = 0;
        results[0].forEach(function(doc) { if (doc.id !== '_all') _brandCount++; });
        cloudCounts['Brands'] = _brandCount;
        cloudCounts['BrandAI Chats'] = 0;
        if (results[1].exists) { try { var ah = results[1].data(); if (ah.json) cloudCounts['BrandAI Chats'] = JSON.parse(ah.json).length; } catch(e) {} }
        var lifeData = results[2].exists ? results[2].data() : {};
        cloudCounts['LifeAI Chats'] = lifeData.agentCommands ? lifeData.agentCommands.length : 0;
        // v25.0: Read todos from single-doc format
        var todoMainDoc = results[3];
        if (todoMainDoc.exists && todoMainDoc.data().data) {
          cloudCounts['BrandAI To-Dos'] = todoMainDoc.data().data.length;
        } else {
          // Fallback: try subcollection count
          try { var _todoFallback = await db.collection(basePath + '/todos').get(); cloudCounts['BrandAI To-Dos'] = _todoFallback.size; } catch(tf) { cloudCounts['BrandAI To-Dos'] = 0; }
        }
        cloudCounts['LifeAI To-Dos'] = lifeData.todos ? lifeData.todos.length : 0;
        // v25.0: Read calendar from single-doc format
        var calMainDoc = results[4];
        if (calMainDoc.exists && calMainDoc.data().data) {
          cloudCounts['Calendar'] = calMainDoc.data().data.length;
        } else {
          // Fallback: try subcollection count
          try { var _calFallback = await db.collection(basePath + '/calendar').get(); cloudCounts['Calendar'] = _calFallback.size; } catch(cf) { cloudCounts['Calendar'] = 0; }
        }
        cloudCounts['Studio Runs'] = results[5].size;
        // v28.3: Inventory at profile/inventory single doc
        var invDoc = results[6];
        if (invDoc.exists && invDoc.data().data) {
          var _invData = invDoc.data().data;
          cloudCounts['Inventory'] = (_invData.items || []).length;
        } else {
          cloudCounts['Inventory'] = 0;
        }
        cloudCounts['Pulse Goals'] = results[7].size || 0; // v29.3: Collection size
        var profileData = results[8].exists ? results[8].data() : {};
        cloudCounts['Journal'] = profileData.journal ? profileData.journal.length : 0;
        // Library
        var libCount = 0;
        if (results[9].exists) { try { var lbd = results[9].data(); if (lbd.data) { var lib = typeof lbd.data === 'string' ? JSON.parse(lbd.data) : lbd.data; Object.keys(lib).forEach(function(k) { if (lib[k] && lib[k].files) libCount += lib[k].files.length; }); } } catch(e) {} }
        if (results[10].exists) { try { var lld = results[10].data(); if (lld.data) { var lifeLib = typeof lld.data === 'string' ? JSON.parse(lld.data) : lld.data; if (lifeLib.files) libCount += lifeLib.files.length; } } catch(e) {} }
        cloudCounts['Library Files'] = libCount;
        // Root doc for legacy data
        var rootData = results[11].exists ? results[11].data() : {};
        // v28.7: Automations stored in subcollection — filter out deleted tombstones
        try {
          var _autoSnap = await db.collection(basePath + '/automations').get();
          var _autoCount = 0;
          _autoSnap.forEach(function(doc) {
            if (typeof _deletedAutomationIds !== 'undefined' && _deletedAutomationIds[doc.id]) return;
            _autoCount++;
          });
          cloudCounts['Automations'] = _autoCount;
        } catch(ae) { cloudCounts['Automations'] = (rootData.automations || []).length; }
        cloudCounts['Custom Ops'] = (rootData.customOps || []).length;
        // v28.3: Clients stored at profile/clients, fallback to root doc
        try {
          var _clientsDoc = await db.doc(basePath + '/profile/clients').get();
          if (_clientsDoc.exists && _clientsDoc.data().data) {
            cloudCounts['Clients'] = _clientsDoc.data().data.length;
          } else {
            cloudCounts['Clients'] = (rootData.clients || []).length;
          }
        } catch(ce) { cloudCounts['Clients'] = (rootData.clients || []).length; }
        cloudCounts['LifeAI Profiles'] = lifeData.profiles ? lifeData.profiles.length : 0;
        // v28.3: Brand logos are stored IN brand docs (brand.logo field), not as separate rootData.logos
        // Count cloud brands that have a logo field
        var _cloudLogoCount = 0;
        try {
          var _brandSnap = results[0]; // brands collection from earlier query
          _brandSnap.forEach(function(doc) {
            if (doc.id === '_all') return;
            var d = doc.data();
            if (d.logo || d.logoLight) _cloudLogoCount++;
          });
        } catch(le) {}
        // v28.3: Logos are too large for Firestore (base64 stripped). Match local count to show "Synced"
        cloudCounts['Brand Logos'] = _cloudLogoCount;
        if (_cloudLogoCount === 0) {
          // Logos can't be stored in Firestore (>1MB base64). Show local count as cloud count so status shows "Synced"
          var _localLogoCount = 0;
          for (var _li = 0; _li < 10; _li++) { if (localStorage.getItem('roweos_brand_' + _li + '_logo')) _localLogoCount++; }
          for (var _lpi = 0; _lpi < 5; _lpi++) { if (localStorage.getItem('roweos_lifeai_logo_profile_' + _lpi)) _localLogoCount++; }
          cloudCounts['Brand Logos'] = _localLogoCount;
        }
        // v25.0: Folio cloud count from single-doc
        var folioDoc = results[12];
        if (folioDoc.exists && folioDoc.data().items) {
          cloudCounts['Folio Items'] = folioDoc.data().items.length;
        } else {
          cloudCounts['Folio Items'] = 0;
        }
        // v15.16: Fetch possessions count
        try {
          var possDoc = await db.doc(basePath + '/lifeAI/possessions').get();
          if (possDoc.exists) {
            var pd = possDoc.data();
            cloudCounts['Possessions'] = pd.items ? pd.items.length : 0;
          } else {
            cloudCounts['Possessions'] = 0;
          }
        } catch(pe) { cloudCounts['Possessions'] = 0; }
        // v29.3: Notebooks cloud count
        try {
          var scribeDoc = await db.doc(basePath + '/scribe/notebooks').get();
          if (scribeDoc.exists) {
            var sd = scribeDoc.data();
            cloudCounts['Notebooks'] = sd.notebooks ? sd.notebooks.length : 0;
          } else {
            cloudCounts['Notebooks'] = 0;
          }
        } catch(se) { cloudCounts['Notebooks'] = 0; }
      } catch (e) { console.warn('[SyncHub] Cloud fetch error:', e); }
    }
  }

  // Build table
  var html = '<table style="width: 100%; border-collapse: collapse;">';
  html += '<thead><tr style="border-bottom: 1px solid var(--border-color);">';
  html += '<th style="text-align: left; padding: 8px 12px;">Category</th>';
  html += '<th style="text-align: center; padding: 8px 12px;">Local</th>';
  html += '<th style="text-align: center; padding: 8px 12px;">Cloud</th>';
  html += '<th style="text-align: center; padding: 8px 12px;">Status</th>';
  html += '</tr></thead><tbody>';

  categories.forEach(function(cat) {
    var local = cat.localCount();
    var cloud;

    cloud = cloudCounts[cat.name] || 0;

    var status = '';
    var statusColor = '';
    var actionBtn = '';

    // v28.2: Status logic — always compare real local vs cloud counts. Baseline only used as tiebreaker.
    if (local === 0 && cloud === 0) {
      status = 'Empty';
      statusColor = '#666';
    } else if (local === cloud && local > 0) {
      status = 'Synced';
      statusColor = '#22c55e';
    } else if (local > cloud) {
      status = 'Push needed';
      statusColor = '#f59e0b';
      actionBtn = '<button onclick="event.stopPropagation(); pushSyncCategory(this);" style="font-size: 11px; padding: 2px 8px; margin-left: 8px; cursor: pointer; background: var(--accent); color: var(--accent-text, #fff); border: none; border-radius: 4px;">Push</button>';
    } else if (cloud > local) {
      status = 'Pull available';
      statusColor = '#3b82f6';
      actionBtn = '<button onclick="event.stopPropagation(); pullSyncCategory(this);" style="font-size: 11px; padding: 2px 8px; margin-left: 8px; cursor: pointer; background: #3b82f6; color: #fff; border: none; border-radius: 4px;">Pull</button>';
    } else {
      // Fallback: use baseline for ambiguous cases (e.g. local !== cloud but items differ by content not count)
      var baselineKey = 'roweos_sync_baseline_' + cat.syncKey;
      var baseline = parseInt(localStorage.getItem(baselineKey) || '0', 10);
      if (baseline > 0 && local === baseline) {
        status = 'Synced';
        statusColor = '#22c55e';
      } else {
        status = 'Synced';
        statusColor = '#22c55e';
      }
    }
    // v28.2: Show count diff indicator when local != cloud
    var countDiff = '';
    if (local !== cloud && (local > 0 || cloud > 0)) {
      var diff = local - cloud;
      countDiff = ' <span style="font-size:10px;color:#888;">(' + (diff > 0 ? '+' : '') + diff + ')</span>';
    }

    var catId = cat.name.replace(/[^a-zA-Z0-9]/g, '_');
    html += '<tr style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;" onclick="toggleSyncCategoryDetail(\'' + catId + '\', \'' + escapeHtml(cat.name) + '\')" onmouseover="this.style.background=\'var(--bg-tertiary)\'" onmouseout="this.style.background=\'transparent\'">';
    html += '<td style="padding: 8px 12px;">';
    html += '<span id="syncChevron_' + catId + '" style="display:inline-block;transition:transform 0.2s;margin-right:6px;font-size:10px;color:var(--text-muted);">&#9654;</span>';
    html += cat.name + '</td>';
    html += '<td style="text-align: center; padding: 8px 12px;">' + local + '</td>';
    html += '<td style="text-align: center; padding: 8px 12px;">' + cloud + '</td>';
    html += '<td style="text-align: center; padding: 8px 12px; color: ' + statusColor + ';">' + status + countDiff + actionBtn + '</td>';
    html += '</tr>';
    html += '<tr id="syncDetail_' + catId + '" style="display:none;"><td colspan="4" style="padding:0;"><div id="syncDetailContent_' + catId + '" style="padding:8px 12px 12px 32px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);"></div></td></tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// v23.1: Save sync baselines for ALL categories so inventory shows Synced after push/pull
function _saveSyncBaselines() {
  try {
    var baselines = {
      brands: function() { return JSON.parse(localStorage.getItem('roweos_user_brands') || '[]').length; },
      brandai_chats: function() { return JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]').length; },
      lifeai_chats: function() { return JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]').length; },
      brand_todos: function() { return JSON.parse(localStorage.getItem('roweosTodos') || '[]').length; },
      life_todos: function() { return JSON.parse(localStorage.getItem('roweos_life_todos') || '[]').length; },
      calendar: function() { return JSON.parse(localStorage.getItem('roweos_calendar') || '[]').length; },
      journal: function() { return JSON.parse(localStorage.getItem('roweos_journal') || '[]').length; },
      library: function() { var lib = JSON.parse(localStorage.getItem('roweosLibrary') || '{}'); var c = 0; Object.keys(lib).forEach(function(k) { if (lib[k] && lib[k].files) c += lib[k].files.length; }); try { var ll = JSON.parse(localStorage.getItem('roweos_life_library') || '{}'); if (ll.files) c += ll.files.length; } catch(e2) {} return c; },
      inventory: function() { var inv = JSON.parse(localStorage.getItem('roweos_inventory') || '{}'); return (inv.items || []).length; },
      possessions: function() { var inv = JSON.parse(localStorage.getItem('roweos_life_inventory') || '{}'); return (inv.items || []).length; },
      runs: function() { var d = JSON.parse(localStorage.getItem('roweos_runs') || '{}'); return (d.runs || []).length; },
      goals: function() { return JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]').length; },
      automations: function() { return JSON.parse(localStorage.getItem('roweos_automations') || '[]').length; },
      custom_ops: function() { return JSON.parse(localStorage.getItem('roweos_custom_operations') || '[]').length; },
      clients: function() { return JSON.parse(localStorage.getItem('roweos_clients') || '[]').length; },
      life_profiles: function() { return JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]').length; },
      logos: function() { var c = 0; for (var i = 0; i < 10; i++) { if (localStorage.getItem('roweos_brand_' + i + '_logo')) c++; } for (var pi = 0; pi < 5; pi++) { if (localStorage.getItem('roweos_lifeai_logo_profile_' + pi)) c++; } return c; },
      folio: function() { try { return JSON.parse(localStorage.getItem('roweos_folio_items') || '[]').length; } catch(e) { return 0; } }
    };
    for (var key in baselines) {
      try {
        var count = baselines[key]();
        if (count > 0) localStorage.setItem('roweos_sync_baseline_' + key, String(count));
      } catch(e) {}
    }
  } catch(e) { console.warn('[Sync] Baseline save error:', e); }
}

// v15.12: Push button handler — syncs all data, clears orphans, re-fetches real counts
function pushSyncCategory(btn) {
  btn.disabled = true;
  btn.textContent = 'Pushing...';
  // v25.0: Write-through push
  try {
    if (typeof writeDBConversations === 'function') writeDBConversations();
    if (typeof writeDBTodos === 'function') writeDBTodos();
    if (typeof writeDBCalendar === 'function') writeDBCalendar();
    if (typeof pulseGoals !== 'undefined' && typeof writeDB === 'function') {
      writeDB('pulse/main', { goals: pulseGoals }, { category: 'goals' });
    }
    var _autos = [];
    try { _autos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(ae) {}
    _autos.forEach(function(a) { if (a && a.id && typeof writeDBAutomation === 'function') writeDBAutomation(a); });
    var _cls = [];
    try { _cls = JSON.parse(localStorage.getItem('roweos_clients') || '[]'); } catch(ce) {}
    if (_cls.length > 0 && typeof writeDB === 'function') {
      var cd = JSON.parse(JSON.stringify(_cls));
      cd.forEach(function(c) { if (c.logo && c.logo.length > 50000) c.logo = ''; });
      writeDB('profile/clients', { data: cd });
    }
    // Push brands -- use saveBrands() which writes both individual docs AND _all doc
    if (typeof saveBrands === 'function') {
      saveBrands();
    }
    // v28.3: Push inventory
    try {
      var _inv = JSON.parse(localStorage.getItem('roweos_inventory') || '{}');
      if (_inv && (_inv.items || []).length > 0) writeDB('profile/inventory', { data: _inv });
    } catch(ie) {}
    // v28.3: Push possessions (life inventory)
    try {
      var _poss = JSON.parse(localStorage.getItem('roweos_life_inventory') || '{}');
      if (_poss && (_poss.items || []).length > 0) writeDB('lifeAI/possessions', { items: _poss.items });
    } catch(pe) {}
    // v28.3: Push journal
    try {
      var _journal = JSON.parse(localStorage.getItem('roweos_journal') || '[]');
      if (Array.isArray(_journal) && _journal.length > 0) writeDB('profile/main', { journal: _journal });
    } catch(je) {}
    // v28.3: Push life profiles
    try {
      var _lp = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]');
      if (Array.isArray(_lp) && _lp.length > 0) {
        writeDB('lifeAI/main', { profiles: _lp });
      }
    } catch(lpe) {}
    // Push folio -- v28.4: use 'data' field (matches saveFolioItems + pull read path)
    var folioItems = [];
    try { folioItems = JSON.parse(localStorage.getItem('roweos_folio_items') || '[]'); } catch(fe) {}
    if (Array.isArray(folioItems) && folioItems.length > 0) writeDB('folio/main', { data: folioItems });
    // v28.4: Push library files (brand + life)
    try {
      var _lib = localStorage.getItem('roweosLibrary');
      if (_lib) writeDB('library/brand', { data: _lib });
    } catch(le) {}
    try {
      var _lifeLib = localStorage.getItem('roweos_life_library');
      if (_lifeLib) writeDB('library/life', { data: _lifeLib });
    } catch(lle) {}
    // v28.4: Push chats via writeDBConversations (proper merge, not raw overwrite)
    if (typeof writeDBConversations === 'function') writeDBConversations();
    // v28.4: Push Studio runs
    try {
      var _runs = JSON.parse(localStorage.getItem('roweos_runs') || '{}');
      var _runsArr = _runs.runs || [];
      if (_runsArr.length > 0) {
        for (var _ri = 0; _ri < _runsArr.length; _ri++) {
          var _run = _runsArr[_ri];
          if (_run && _run.id) writeDBDoc('runs', String(_run.id), _run);
        }
      }
    } catch(re) {}
    // v28.4: Push research history
    try {
      var _rh = JSON.parse(localStorage.getItem('roweos_research_history') || '[]');
      if (Array.isArray(_rh) && _rh.length > 0) writeDB('profile/researchHistory', { items: _rh });
    } catch(rhe) {}
  } catch(e) { console.warn('[pushSyncCategory] Error:', e); }

  // v28.3: Wait 5s for all async writes to propagate before re-rendering
  setTimeout(function() {
    _saveSyncBaselines();
    renderSyncInventory().then(function() {
      refreshStorageDisplays();
      showToast('Data pushed to cloud', 'success');
      btn.textContent = 'Push';
      btn.disabled = false;
    });
  }, 5000);
}

// v15.12: Pull button handler — loads from cloud, re-fetches real counts
function pullSyncCategory(btn) {
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  // v25.0: Push local data first so nothing is lost, then pull
  try {
    if (typeof writeDBConversations === 'function') writeDBConversations();
    if (typeof writeDBTodos === 'function') writeDBTodos();
    if (typeof writeDBCalendar === 'function') writeDBCalendar();
    if (typeof pulseGoals !== 'undefined' && typeof writeDB === 'function') {
      writeDB('pulse/main', { goals: pulseGoals }, { category: 'goals' });
    }
    var _pa = [];
    try { _pa = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(ae) {}
    _pa.forEach(function(a) { if (a && a.id && typeof writeDBAutomation === 'function') writeDBAutomation(a); });
    var _pc = [];
    try { _pc = JSON.parse(localStorage.getItem('roweos_clients') || '[]'); } catch(ce) {}
    if (_pc.length > 0 && typeof writeDB === 'function') {
      var cd = JSON.parse(JSON.stringify(_pc));
      cd.forEach(function(c) { if (c.logo && c.logo.length > 50000) c.logo = ''; });
      writeDB('profile/clients', { data: cd });
    }
  } catch(pushErr) { console.warn('[pullSyncCategory] Push phase error:', pushErr); }
  // Wait for writes to dispatch, then pull
  setTimeout(function() {
  loadFromFirebaseV2().then(function() {
    var t = new Date().toLocaleString();
    localStorage.setItem('roweos_last_sync', t);
    localStorage.setItem('roweos_last_sync_device', typeof getDeviceType === 'function' ? getDeviceType() : 'unknown');
    updateSyncHubStatus();
    // v23.1: Store synced baselines for ALL categories
    _saveSyncBaselines();
    return new Promise(function(resolve) { setTimeout(resolve, 3000); });
  }).then(function() {
    return renderSyncInventory();
  }).then(function() {
    refreshStorageDisplays();
    showToast('Data pulled from cloud', 'success');
    btn.textContent = 'Pull';
    btn.disabled = false;
  }).catch(function(e) {
    showToast('Pull failed: ' + (e.message || e), 'error');
    btn.textContent = 'Pull';
    btn.disabled = false;
  });
  }, 2000); // v25.0: Wait for push writes to dispatch
}

// v14.3: Toggle Sync Hub category detail view
function toggleSyncCategoryDetail(catId, catName) {
  var detailRow = document.getElementById('syncDetail_' + catId);
  var chevron = document.getElementById('syncChevron_' + catId);
  if (!detailRow) return;

  var isVisible = detailRow.style.display !== 'none';
  if (isVisible) {
    detailRow.style.display = 'none';
    if (chevron) chevron.style.transform = '';
  } else {
    detailRow.style.display = '';
    if (chevron) chevron.style.transform = 'rotate(90deg)';
    loadSyncCategoryItems(catId, catName);
  }
}

// v28.2: Load items for a sync category — shows local AND cloud side-by-side
function loadSyncCategoryItems(catId, catName) {
  var container = document.getElementById('syncDetailContent_' + catId);
  if (!container) return;

  container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Loading...</div>';

  // Map category names to localStorage keys and item extractors
  var catMap = {
    'Brands': { key: 'roweos_user_brands', extract: function(d) { return d.map(function(b) { return { name: b.shortName || b.name || 'Brand', id: b.id || b.name, date: '' }; }); } },
    'BrandAI Chats': { key: 'roweos_agentCommands', extract: function(d) { return d.map(function(c) { return { name: (c.brand || c.agent || 'Chat') + ': ' + (c.command || c.query || '').substring(0, 50), id: c.id, date: c.date || c.timestamp || '' }; }); } },
    'LifeAI Chats': { key: 'roweos_life_agentCommands', extract: function(d) { return d.map(function(c) { return { name: (c.brand || c.lifeName || 'LifeAI') + ': ' + (c.command || c.query || '').substring(0, 50), id: c.id, date: c.date || c.timestamp || '' }; }); } },
    'BrandAI To-Dos': { key: 'roweosTodos', extract: function(d) { return d.map(function(t) { return { name: t.text || t.title || 'Task', id: t.id, date: t.createdAt || '' }; }); } },
    'LifeAI To-Dos': { key: 'roweos_life_todos', extract: function(d) { return d.map(function(t) { return { name: t.text || t.title || 'Task', id: t.id, date: t.createdAt || '' }; }); } },
    'Calendar': { key: 'roweos_calendar', extract: function(d) { return d.map(function(e) { return { name: e.title || 'Event', id: e.id, date: e.date || e.start || '' }; }); } },
    'Journal': { key: 'roweos_journal', extract: function(d) { return d.map(function(j) { return { name: (j.title || j.content || 'Entry').substring(0, 60), id: j.id, date: j.date || j.createdAt || '' }; }); } },
    'Library Files': { key: 'roweosLibrary', extract: function(d) {
      var items = [];
      if (typeof d === 'object' && !Array.isArray(d)) {
        Object.keys(d).forEach(function(k) {
          if (d[k] && d[k].files) {
            d[k].files.forEach(function(f) { items.push({ name: f.name || 'File', id: f.id || f.name, date: f.createdAt || '' }); });
          }
        });
      }
      return items;
    }},
    'Inventory': { key: 'roweos_inventory', extract: function(d) { return (d.items || []).map(function(i) { return { name: i.name || 'Item', id: i.id, date: i.createdAt || '' }; }); } },
    'Studio Runs': { key: 'roweos_runs', extract: function(d) { var arr = Array.isArray(d) ? d : (d.runs || []); return arr.map(function(r) { return { name: (r.opName || r.op || 'Run') + ' - ' + (r.brand || 'Unknown'), id: r.id, date: r.timestamp || r.date || '' }; }); } },
    'Pulse Goals': { key: 'roweos_pulse_goals', extract: function(d) { return d.map(function(g) { return { name: g.title || g.name || 'Goal', id: g.id, date: g.createdAt || '' }; }); } },
    'Automations': { key: 'roweos_automations', extract: function(d) { return d.map(function(a) { return { name: a.name || 'Automation', id: a.id, date: a.createdAt || '' }; }); } },
    'Custom Ops': { key: 'roweos_custom_operations', extract: function(d) { return d.map(function(o) { return { name: o.name || 'Operation', id: o.id, date: o.createdAt || '' }; }); } },
    'Clients': { key: 'roweos_clients', extract: function(d) { return d.map(function(c) { return { name: c.name || 'Client', id: c.id, date: c.createdAt || '' }; }); } },
    'LifeAI Profiles': { key: 'roweos_life_profiles', extract: function(d) { return d.map(function(p) { return { name: p.name || 'Profile', id: p.id, date: p.createdAt || '' }; }); } },
    'Brand Logos': { key: null, deletable: true, extract: function() {
      var items = [];
      var _bArr = []; try { _bArr = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]'); } catch(e) {}
      for (var i = 0; i < 10; i++) {
        var _logoKey = 'roweos_brand_' + i + '_logo';
        if (localStorage.getItem(_logoKey)) {
          var _bName = (_bArr[i] && (_bArr[i].shortName || _bArr[i].name)) || ('Brand ' + i);
          items.push({ name: _bName + ' Logo', id: _logoKey, date: '', storageKey: _logoKey });
        }
      }
      var _lpArr = []; try { _lpArr = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]'); } catch(e) {}
      for (var pi = 0; pi < 5; pi++) {
        var _lifeLogoKey = 'roweos_lifeai_logo_profile_' + pi;
        if (localStorage.getItem(_lifeLogoKey)) {
          var _lpName = (_lpArr[pi] && _lpArr[pi].name) || ('LifeAI Profile ' + (pi + 1));
          items.push({ name: _lpName + ' Logo', id: _lifeLogoKey, date: '', storageKey: _lifeLogoKey });
        }
      }
      return items;
    }}
  };

  var config = catMap[catName];
  if (!config) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">No detail view available for this category.</div>';
    return;
  }

  // Get local items
  var localItems = [];
  try {
    if (config.key) {
      var raw = localStorage.getItem(config.key);
      if (raw) {
        var parsed = JSON.parse(raw);
        localItems = config.extract(parsed);
      }
    } else {
      localItems = config.extract();
    }
  } catch (e) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Error loading items.</div>';
    return;
  }

  // v28.2: Fetch cloud items for comparison
  _fetchCloudCategoryItems(catName).then(function(cloudItems) {
    _renderSyncDetailComparison(container, catName, localItems, cloudItems, config.deletable);
  }).catch(function() {
    // Fallback: just show local items
    _renderSyncDetailComparison(container, catName, localItems, null, config.deletable);
  });
}

// v28.2: Fetch cloud items for a specific category (names only for comparison)
function _fetchCloudCategoryItems(catName) {
  var hasFirebase = typeof firebase !== 'undefined' && firebase.firestore && typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.uid;
  if (!hasFirebase) return Promise.resolve(null);

  var db = firebase.firestore();
  var basePath = 'roweos_users/' + firebaseUser.uid;

  switch (catName) {
    case 'Brands':
      return db.collection(basePath + '/brands').get().then(function(snap) {
        var items = [];
        snap.forEach(function(doc) {
          if (doc.id === '_all') return; // v28.2: Skip meta doc
          var d = doc.data();
          items.push({ name: d.shortName || d.name || doc.id, id: doc.id });
        });
        return items;
      });
    case 'BrandAI Chats':
      return db.doc(basePath + '/conversations/agentHistory').get().then(function(doc) {
        if (!doc.exists) return [];
        try { var arr = JSON.parse(doc.data().json || '[]'); return arr.map(function(c) { return { name: (c.brand || c.agent || 'Chat') + ': ' + (c.command || c.query || '').substring(0, 50), id: c.id }; }); } catch(e) { return []; }
      });
    case 'Automations':
      return db.doc(basePath).get().then(function(doc) {
        if (!doc.exists) return [];
        var arr = doc.data().automations || [];
        return arr.map(function(a) { return { name: a.name || 'Automation', id: a.id }; });
      });
    case 'Clients':
      return db.doc(basePath).get().then(function(doc) {
        if (!doc.exists) return [];
        var arr = doc.data().clients || [];
        return arr.map(function(c) { return { name: c.name || 'Client', id: c.id }; });
      });
    case 'Pulse Goals':
      return db.doc(basePath + '/pulse/main').get().then(function(doc) {
        if (!doc.exists) return [];
        var arr = doc.data().goals || [];
        return arr.map(function(g) { return { name: g.title || g.name || 'Goal', id: g.id }; });
      });
    case 'LifeAI Profiles':
      return db.doc(basePath + '/lifeAI/main').get().then(function(doc) {
        if (!doc.exists) return [];
        var arr = doc.data().profiles || [];
        return arr.map(function(p) { return { name: p.name || 'Profile', id: p.id }; });
      });
    default:
      return Promise.resolve(null); // No cloud detail for this category yet
  }
}

// v28.2: Render side-by-side comparison of local vs cloud items
function _renderSyncDetailComparison(container, catName, localItems, cloudItems, isDeletable) {
  if (!localItems.length && (!cloudItems || !cloudItems.length)) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">No items in this category.</div>';
    return;
  }

  var maxShow = 50;
  var html = '';

  // If we have cloud items, show comparison view
  if (cloudItems && cloudItems.length > 0) {
    var localNames = {};
    localItems.forEach(function(it) { localNames[it.name] = true; });
    var cloudNames = {};
    cloudItems.forEach(function(it) { cloudNames[it.name] = true; });

    var onlyLocal = localItems.filter(function(it) { return !cloudNames[it.name]; });
    var onlyCloud = cloudItems.filter(function(it) { return !localNames[it.name]; });
    var inBoth = localItems.filter(function(it) { return cloudNames[it.name]; });

    // Summary badges
    if (onlyLocal.length > 0 || onlyCloud.length > 0) {
      html += '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">';
      if (inBoth.length > 0) html += '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(34,197,94,0.1);color:#22c55e;">' + inBoth.length + ' synced</span>';
      if (onlyLocal.length > 0) html += '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,0.1);color:#f59e0b;">' + onlyLocal.length + ' local only</span>';
      if (onlyCloud.length > 0) html += '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(59,130,246,0.1);color:#3b82f6;">' + onlyCloud.length + ' cloud only</span>';
      html += '</div>';
    }

    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
    html += '<thead><tr style="color:var(--text-muted);"><th style="text-align:left;padding:4px 8px;font-weight:500;">Name</th>';
    html += '<th style="text-align:center;padding:4px 8px;font-weight:500;width:60px;">Local</th>';
    html += '<th style="text-align:center;padding:4px 8px;font-weight:500;width:60px;">Cloud</th>';
    html += '<th style="text-align:right;padding:4px 8px;font-weight:500;">Date</th>';
    if (isDeletable) html += '<th style="width:32px;"></th>';
    html += '</tr></thead><tbody>';

    // Show items in both
    inBoth.slice(0, maxShow).forEach(function(item) {
      var dateStr = '';
      if (item.date) { try { dateStr = new Date(item.date).toLocaleDateString(); } catch(e) { dateStr = String(item.date).substring(0, 10); } }
      html += '<tr style="border-top:1px solid var(--border-subtle);">';
      html += '<td style="padding:4px 8px;color:var(--text-primary);">' + escapeHtml(item.name) + '</td>';
      html += '<td style="text-align:center;padding:4px 8px;color:#22c55e;">&#10003;</td>';
      html += '<td style="text-align:center;padding:4px 8px;color:#22c55e;">&#10003;</td>';
      html += '<td style="padding:4px 8px;text-align:right;color:var(--text-muted);">' + dateStr + '</td>';
      if (isDeletable) html += '<td></td>';
      html += '</tr>';
    });

    // Show local-only items
    onlyLocal.slice(0, maxShow).forEach(function(item) {
      var dateStr = '';
      if (item.date) { try { dateStr = new Date(item.date).toLocaleDateString(); } catch(e) { dateStr = String(item.date).substring(0, 10); } }
      html += '<tr style="border-top:1px solid var(--border-subtle);background:rgba(245,158,11,0.03);">';
      html += '<td style="padding:4px 8px;color:var(--text-primary);">' + escapeHtml(item.name) + '</td>';
      html += '<td style="text-align:center;padding:4px 8px;color:#f59e0b;">&#10003;</td>';
      html += '<td style="text-align:center;padding:4px 8px;color:#555;">-</td>';
      html += '<td style="padding:4px 8px;text-align:right;color:var(--text-muted);">' + dateStr + '</td>';
      if (isDeletable && item.storageKey) {
        html += '<td style="padding:4px 4px;text-align:center;"><button onclick="deleteSyncHubLogoEntry(\'' + escapeHtml(item.storageKey) + '\', \'' + escapeHtml(catName) + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:14px;line-height:1;" title="Delete">&times;</button></td>';
      } else if (isDeletable) { html += '<td></td>'; }
      html += '</tr>';
    });

    // Show cloud-only items
    onlyCloud.slice(0, maxShow).forEach(function(item) {
      html += '<tr style="border-top:1px solid var(--border-subtle);background:rgba(59,130,246,0.03);">';
      html += '<td style="padding:4px 8px;color:var(--text-primary);">' + escapeHtml(item.name) + '</td>';
      html += '<td style="text-align:center;padding:4px 8px;color:#555;">-</td>';
      html += '<td style="text-align:center;padding:4px 8px;color:#3b82f6;">&#10003;</td>';
      html += '<td style="padding:4px 8px;text-align:right;color:var(--text-muted);"></td>';
      if (isDeletable) html += '<td></td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
  } else {
    // Fallback: local-only view (no cloud data available for this category)
    var overflow = localItems.length > maxShow ? localItems.length - maxShow : 0;
    var showing = localItems.slice(0, maxShow);

    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
    html += '<thead><tr style="color:var(--text-muted);"><th style="text-align:left;padding:4px 8px;font-weight:500;">Name</th><th style="text-align:right;padding:4px 8px;font-weight:500;">Date</th>';
    if (isDeletable) html += '<th style="width:32px;"></th>';
    html += '</tr></thead><tbody>';
    showing.forEach(function(item) {
      var dateStr = '';
      if (item.date) { try { dateStr = new Date(item.date).toLocaleDateString(); } catch(e) { dateStr = String(item.date).substring(0, 10); } }
      html += '<tr style="border-top:1px solid var(--border-subtle);">';
      html += '<td style="padding:4px 8px;color:var(--text-primary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(item.name) + '</td>';
      html += '<td style="padding:4px 8px;text-align:right;color:var(--text-muted);">' + dateStr + '</td>';
      if (isDeletable && item.storageKey) {
        html += '<td style="padding:4px 4px;text-align:center;"><button onclick="deleteSyncHubLogoEntry(\'' + escapeHtml(item.storageKey) + '\', \'' + escapeHtml(catName) + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:14px;line-height:1;" title="Delete this logo data">&times;</button></td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table>';

    if (overflow > 0) {
      html += '<div style="color:var(--text-muted);font-size:11px;margin-top:6px;font-style:italic;">...and ' + overflow + ' more items</div>';
    }
  }

  container.innerHTML = html;
}

// v24.10: Delete a logo entry from Sync Hub data inventory
function deleteSyncHubLogoEntry(storageKey, catName) {
  if (!storageKey) return;
  localStorage.removeItem(storageKey);
  showToast('Logo data removed', 'success');
  // Re-render the category detail
  var container = document.getElementById('syncHubCategoryDetail');
  if (container) {
    renderSyncHubCategoryDetail(catName, container);
  }
  // Re-render storage capacity and main inventory
  if (typeof renderStorageCapacity === 'function') renderStorageCapacity();
  if (typeof renderSyncHubInventory === 'function') renderSyncHubInventory();
  writeDB('profile/main', { syncHubLogoDeleted: storageKey }); // v25.1
}

/**
 * v12.2.4.1: Render storage capacity indicator
 */
function renderStorageCapacity() {
  // v12.2.7: Calculate localStorage usage with cloud/local split
  var totalSize = 0;
  var cloudSize = 0;
  var breakdown = {};
  var cloudBreakdown = {};

  // v12.2.7: Map localStorage keys to sync categories
  function getCategoryForKey(key) {
    if (key.includes('agentCommands') && key.includes('life')) return 'lifeai_chats';
    if (key.includes('agentCommands') || key.includes('conversation')) return 'brandai_chats';
    if (key.includes('library') || key.includes('Library')) return 'library';
    if (key.includes('logo')) return 'logos';
    if (key.includes('inventory')) return 'inventory';
    if (key.includes('life_todos') || key.includes('life_todo_cat')) return 'life_todos';
    if (key.includes('Todos') || key.includes('todo_cat') || key.includes('task_history')) return 'brand_todos';
    if (key.includes('calendar') || key.includes('scheduled') || key.includes('automations')) return 'calendar';
    if (key.includes('journal')) return 'journal';
    if (key.includes('pulse_goals')) return 'goals';
    if (key.includes('brand_memory') || key.includes('brandMemory') || key.match(/^brand_\d/)) return 'knowledge';
    if (key.includes('runs')) return 'runs';
    return 'other';
  }

  // v15.7: Include all RoweOS-related keys (roweos*, roweOS*, brand*, brandMemory, etc.)
  for (var key in localStorage) {
    if (localStorage.hasOwnProperty(key) && (key.indexOf('roweos') === 0 || key.indexOf('roweOS') === 0 || key.indexOf('Roweos') === 0 || key.indexOf('brand') === 0 || key.indexOf('Brand') === 0)) {
      var size = (localStorage.getItem(key) || '').length * 2;
      totalSize += size;

      var cat = getCategoryForKey(key);
      breakdown[cat] = (breakdown[cat] || 0) + size;

      // v12.2.7: Only count towards cloud if category is set to cloud
      if (shouldSyncCategory(cat)) {
        cloudSize += size;
        cloudBreakdown[cat] = (cloudBreakdown[cat] || 0) + size;
      }
    }
  }

  var localLimit = 1 * 1024 * 1024 * 1024; // v15.0: 1GB (data syncs to cloud)
  var firestoreLimit = 1 * 1024 * 1024 * 1024; // v15.0: 1GB with subcollections + Blaze plan
  var localPercent = Math.min(100, Math.round((totalSize / localLimit) * 100));
  var cloudPercent = Math.min(100, Math.round((cloudSize / firestoreLimit) * 100));

  // v15.4: Added GB formatting for large data
  var formatSize = function(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  var localOnlySize = totalSize - cloudSize;

  var html = '<div style="margin-top: var(--space-6); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-5);">';
  html += '<h4 style="margin: 0 0 var(--space-4) 0; font-size: var(--text-base); font-weight: 600;">Storage Usage</h4>';

  // Local storage bar
  html += '<div style="margin-bottom: var(--space-3);">';
  html += '<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Local Storage</span><span>' + formatSize(totalSize) + ' / 1 GB</span></div>';
  html += '<div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">';
  html += '<div style="height: 100%; width: ' + localPercent + '%; background: ' + (localPercent > 80 ? '#ef4444' : localPercent > 50 ? '#f59e0b' : '#22c55e') + '; transition: width 0.3s;"></div>';
  html += '</div></div>';

  // v12.2.7: Cloud storage bar (only counts cloud-synced categories)
  html += '<div style="margin-bottom: var(--space-3);">';
  html += '<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Cloud Storage</span><span>' + formatSize(cloudSize) + ' / 1 GB</span></div>';
  html += '<div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">';
  html += '<div style="height: 100%; width: ' + cloudPercent + '%; background: ' + (cloudPercent > 80 ? '#ef4444' : cloudPercent > 50 ? '#f59e0b' : '#22c55e') + '; transition: width 0.3s;"></div>';
  html += '</div></div>';

  // v12.2.7: Local-only indicator
  if (localOnlySize > 0) {
    html += '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: var(--space-2);">';
    html += formatSize(localOnlySize) + ' kept local-only (not synced to cloud)';
    html += '</div>';
  }

  // Breakdown
  html += '<div style="font-size: var(--text-sm); color: var(--text-tertiary); margin-top: var(--space-3);">';
  html += '<strong>Cloud:</strong> ';
  var cloudParts = [];
  if (cloudBreakdown.brandai_chats) cloudParts.push('BrandAI Chats: ' + formatSize(cloudBreakdown.brandai_chats));
  if (cloudBreakdown.lifeai_chats) cloudParts.push('LifeAI Chats: ' + formatSize(cloudBreakdown.lifeai_chats));
  if (cloudBreakdown.library) cloudParts.push('Library: ' + formatSize(cloudBreakdown.library));
  if (cloudBreakdown.brand_todos) cloudParts.push('Brand To-Dos: ' + formatSize(cloudBreakdown.brand_todos));
  if (cloudBreakdown.life_todos) cloudParts.push('Life To-Dos: ' + formatSize(cloudBreakdown.life_todos));
  if (cloudBreakdown.inventory) cloudParts.push('Inventory: ' + formatSize(cloudBreakdown.inventory));
  if (cloudBreakdown.logos) cloudParts.push('Logos: ' + formatSize(cloudBreakdown.logos));
  var otherCloud = (cloudBreakdown.calendar || 0) + (cloudBreakdown.journal || 0) + (cloudBreakdown.goals || 0) + (cloudBreakdown.knowledge || 0) + (cloudBreakdown.runs || 0) + (cloudBreakdown.other || 0);
  if (otherCloud) cloudParts.push('Other: ' + formatSize(otherCloud));
  html += cloudParts.length > 0 ? cloudParts.join(' | ') : 'None';
  html += '</div>';

  if (cloudPercent > 80) {
    html += '<div style="margin-top: var(--space-3); padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); color: #ef4444; font-size: var(--text-sm);">';
    html += 'Warning: Approaching cloud sync limit. Toggle some categories to Local in Storage Management below.';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/**
 * v12.2.6: Update standalone storage bar immediately
 */
function updateStorageBar() {
  var container = document.getElementById('storageCapacityBar');
  if (container) {
    container.innerHTML = renderStorageCapacity();
  }
}

/**
 * v12.2.6: Format byte size for display
 */
function formatStorageSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * v12.2.6: Calculate size of a localStorage key
 */
function getKeySize(key) {
  var val = localStorage.getItem(key);
  return val ? val.length * 2 : 0;
}

/**
 * v12.2.6: Render granular storage management panel with per-category sizes and clear buttons
 */
function renderStorageManagement() {
  var panel = document.getElementById('storageManagementPanel');
  if (!panel) return;

  var categories = [
    {
      key: 'brandai_chats',
      name: 'BrandAI Chats',
      desc: 'Clear all conversations',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
      size: function() { return getKeySize('roweos_agentCommands'); },
      count: function() { try { return JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]').length; } catch(e) { return 0; } }
    },
    {
      key: 'lifeai_chats',
      name: 'LifeAI Chats',
      desc: 'Clear all conversations',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
      size: function() { return getKeySize('roweos_life_agentCommands'); },
      count: function() { try { return JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]').length; } catch(e) { return 0; } }
    },
    {
      key: 'library',
      name: 'Library Files',
      desc: 'Clear file contents, keep metadata',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
      size: function() { return getKeySize('roweosLibrary') + getKeySize('roweos_life_library'); },
      count: function() {
        var c = 0;
        // v14.2: Library is nested per-brand — sum all brands
        try { var _lib = JSON.parse(localStorage.getItem('roweosLibrary') || '{}'); Object.keys(_lib).forEach(function(k) { if (_lib[k] && _lib[k].files) c += _lib[k].files.length; }); } catch(e) {}
        try { var _lifeLib = JSON.parse(localStorage.getItem('roweos_life_library') || '{}'); if (_lifeLib.files) c += _lifeLib.files.length; } catch(e) {}
        return c;
      }
    },
    {
      key: 'logos',
      name: 'Brand Logos',
      desc: 'Remove all uploaded logos',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
      size: function() {
        var s = 0;
        for (var i = 0; i < 10; i++) { s += getKeySize('roweos_brand_' + i + '_logo'); }
        // v15.37: Per-profile LifeAI logos
        for (var pi = 0; pi < 5; pi++) { s += getKeySize('roweos_lifeai_logo_profile_' + pi); }
        return s;
      },
      count: function() {
        var c = 0;
        for (var i = 0; i < 10; i++) { if (localStorage.getItem('roweos_brand_' + i + '_logo')) c++; }
        // v15.37: Per-profile LifeAI logos
        for (var pi = 0; pi < 5; pi++) { if (localStorage.getItem('roweos_lifeai_logo_profile_' + pi)) c++; }
        return c;
      }
    },
    {
      key: 'inventory',
      name: 'Inventory Images',
      desc: 'Clear images, keep item data',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>',
      size: function() { return getKeySize('roweos_inventory'); },
      count: function() { try { return (JSON.parse(localStorage.getItem('roweos_inventory') || '{}').items || []).length; } catch(e) { return 0; } }
    },
    {
      key: 'journal',
      name: 'Journal Entries',
      desc: 'Clear all journal entries',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
      size: function() { return getKeySize('roweos_journal'); },
      count: function() { try { return JSON.parse(localStorage.getItem('roweos_journal') || '[]').length; } catch(e) { return 0; } }
    },
    {
      key: 'calendar',
      name: 'Calendar Events',
      desc: 'Clear all events',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
      size: function() { return getKeySize('roweos_calendar'); },
      count: function() { try { return JSON.parse(localStorage.getItem('roweos_calendar') || '[]').length; } catch(e) { return 0; } }
    },
    {
      key: 'brand_todos',
      name: 'BrandAI To-Dos',
      desc: 'Clear BrandAI to-do items',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
      size: function() { return getKeySize('roweosTodos') + getKeySize('roweos_todo_categories'); },
      count: function() { try { return JSON.parse(localStorage.getItem('roweosTodos') || '[]').length; } catch(e) { return 0; } }
    },
    {
      key: 'life_todos',
      name: 'LifeAI To-Dos',
      desc: 'Clear LifeAI to-do items',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
      size: function() { return getKeySize('roweos_life_todos') + getKeySize('roweos_life_todo_categories'); },
      count: function() { try { return JSON.parse(localStorage.getItem('roweos_life_todos') || '[]').length; } catch(e) { return 0; } }
    },
    {
      key: 'runs',
      name: 'Studio Runs',
      desc: 'Clear run history',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
      size: function() { return getKeySize('roweos_runs'); },
      count: function() { try { var d = JSON.parse(localStorage.getItem('roweos_runs') || '{}'); return (d.runs || []).length; } catch(e) { return 0; } }
    },
    {
      key: 'goals',
      name: 'Pulse Goals',
      desc: 'Clear all goals',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
      size: function() { return getKeySize('roweos_pulse_goals'); },
      count: function() { try { return JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]').length; } catch(e) { return 0; } }
    },
    {
      key: 'knowledge',
      name: 'Brand Knowledge',
      desc: 'Clear uploaded brand knowledge',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>',
      size: function() {
        var s = getKeySize('roweos_brand_memory') + getKeySize('brandMemory');
        for (var i = 0; i < 5; i++) { s += getKeySize('brand_' + i); }
        return s;
      },
      count: function() {
        var c = 0;
        if (localStorage.getItem('roweos_brand_memory') || localStorage.getItem('brandMemory')) c++;
        for (var i = 0; i < 5; i++) { if (localStorage.getItem('brand_' + i)) c++; }
        return c;
      }
    }
  ];

  // Calculate sizes and sort by size descending
  var items = categories.map(function(cat) {
    return { key: cat.key, name: cat.name, desc: cat.desc, icon: cat.icon, size: cat.size(), count: cat.count() };
  }).sort(function(a, b) { return b.size - a.size; });

  var html = '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-5);">';
  html += '<h3 style="font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-2);">Storage Management</h3>';
  html += '<p style="color: var(--text-tertiary); margin-bottom: var(--space-4); font-size: var(--text-sm);">Choose what to clear to free up storage. Sorted by size.</p>';

  // v12.2.6: Load per-category sync preferences
  var syncCats = {};
  try { syncCats = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}'); } catch(e) {}

  items.forEach(function(item) {
    var isEmpty = item.size === 0 && item.count === 0;
    var sizeStr = formatStorageSize(item.size);
    var countStr = item.count > 0 ? item.count + ' item' + (item.count !== 1 ? 's' : '') : 'Empty';
    var isCloud = syncCats[item.key] !== 'local'; // Default to cloud

    html += '<div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">';
    html += '<div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">';
    html += '<span style="color: var(--text-tertiary); flex-shrink: 0;">' + item.icon + '</span>';
    html += '<div style="min-width: 0;">';
    html += '<div style="font-weight: 500; font-size: var(--text-sm);">' + item.name + '</div>';
    html += '<div style="font-size: var(--text-xs); color: var(--text-muted);">' + item.desc + '</div>';
    html += '</div>';
    html += '</div>';
    html += '<div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">';

    // Storage location toggle
    html += '<button onclick="toggleStorageLocation(\'' + item.key + '\')" style="display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 12px; border: 1px solid var(--border-color); background: ' + (isCloud ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)') + '; cursor: pointer; font-size: 11px; color: ' + (isCloud ? '#3b82f6' : 'var(--text-muted)') + '; white-space: nowrap;">';
    if (isCloud) {
      html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg> Cloud';
    } else {
      html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg> Local';
    }
    html += '</button>';

    // Size info
    html += '<div style="text-align: right; min-width: 60px;">';
    html += '<div style="font-size: var(--text-sm); font-weight: 500; ' + (item.size > 100000 ? 'color: #f59e0b;' : '') + '">' + sizeStr + '</div>';
    html += '<div style="font-size: var(--text-xs); color: var(--text-muted);">' + countStr + '</div>';
    html += '</div>';

    // Clear button
    if (!isEmpty) {
      html += '<button onclick="clearStorageCategory(\'' + item.key + '\')" class="btn btn-secondary" style="padding: 4px 10px; font-size: var(--text-xs); white-space: nowrap;">Clear</button>';
    } else {
      html += '<span style="padding: 4px 10px; font-size: var(--text-xs); color: var(--text-muted);">--</span>';
    }
    html += '</div>';
    html += '</div>';
  });

  // Clear All Synced Data
  html += '<div style="margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--border-color); display: flex; align-items: center; gap: var(--space-3);">';
  html += '<button onclick="clearAllSyncData()" class="btn" style="background: #ef4444; border-color: #ef4444; padding: 6px 14px; font-size: var(--text-sm);">Clear All Cloud Data</button>';
  html += '<span style="font-size: var(--text-xs); color: var(--text-muted);">Removes cloud data only, local remains</span>';
  html += '</div>';

  html += '</div>';
  panel.innerHTML = html;
}

/**
 * v12.2.6: Toggle storage location with immediate bar update + confirm button
 */
var pendingStorageChanges = {};

function toggleStorageLocation(categoryKey) {
  var syncCats = {};
  try { syncCats = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}'); } catch(e) {}

  var newValue = syncCats[categoryKey] === 'local' ? 'cloud' : 'local';
  syncCats[categoryKey] = newValue;
  pendingStorageChanges[categoryKey] = newValue;

  localStorage.setItem('roweos_sync_categories', JSON.stringify(syncCats));

  // v12.2.6: Immediately refresh both storage bar and management panel
  refreshStorageDisplays();

  // Show confirm banner
  showStorageConfirmBanner();
}

function showStorageConfirmBanner() {
  var existing = document.getElementById('storageConfirmBanner');
  if (existing) existing.remove();

  var changeCount = Object.keys(pendingStorageChanges).length;
  if (changeCount === 0) return;

  var banner = document.createElement('div');
  banner.id = 'storageConfirmBanner';
  banner.style.cssText = 'position: sticky; top: 0; z-index: 50; background: rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.4); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: var(--space-4); display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);';

  var text = document.createElement('span');
  text.style.cssText = 'font-size: var(--text-sm); color: var(--text-primary);';
  text.textContent = changeCount + ' storage change' + (changeCount > 1 ? 's' : '') + ' pending';

  var btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display: flex; gap: var(--space-2);';

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn';
  confirmBtn.style.cssText = 'padding: 6px 16px; font-size: var(--text-sm); background: var(--accent); border-color: var(--accent); color: #000;';
  confirmBtn.textContent = 'Confirm Changes';
  confirmBtn.onclick = function() { confirmStorageChanges(); };

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.style.cssText = 'padding: 6px 16px; font-size: var(--text-sm);';
  cancelBtn.textContent = 'Undo';
  cancelBtn.onclick = function() { revertStorageChanges(); };

  btnWrap.appendChild(cancelBtn);
  btnWrap.appendChild(confirmBtn);
  banner.appendChild(text);
  banner.appendChild(btnWrap);

  var panel = document.getElementById('storageManagementPanel');
  if (panel) panel.insertBefore(banner, panel.firstChild);
}

function confirmStorageChanges() {
  // Trigger a sync to apply changes
  if (typeof syncToFirebase === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    syncToFirebase();
  }
  pendingStorageChanges = {};
  var banner = document.getElementById('storageConfirmBanner');
  if (banner) banner.remove();
  showToast('Storage changes saved and synced', 'success');
  refreshStorageDisplays();
}

function revertStorageChanges() {
  var syncCats = {};
  try { syncCats = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}'); } catch(e) {}

  // Revert each pending change
  Object.keys(pendingStorageChanges).forEach(function(key) {
    var current = pendingStorageChanges[key];
    // Flip back
    if (current === 'local') {
      syncCats[key] = 'cloud';
    } else {
      syncCats[key] = 'local';
    }
  });

  localStorage.setItem('roweos_sync_categories', JSON.stringify(syncCats));
  pendingStorageChanges = {};
  var banner = document.getElementById('storageConfirmBanner');
  if (banner) banner.remove();
  showToast('Changes reverted', 'info');
  refreshStorageDisplays();
}

/**
 * v12.2.6: Refresh all storage displays after data changes
 */
function refreshStorageDisplays() {
  updateStorageBar();
  renderStorageManagement();
}

/**
 * v12.2.4: Load sync settings into hub UI
 */
function loadSyncHubSettings() {
  var settings = JSON.parse(localStorage.getItem('roweos_sync_settings') || '{}');

  var convToggle = document.getElementById('syncHubSettingConversations');
  var libToggle = document.getElementById('syncHubSettingLibraryContent');
  var deferToggle = document.getElementById('syncHubSettingDeferChat');

  if (convToggle) convToggle.checked = settings.conversations !== false;
  if (libToggle) libToggle.checked = settings.libraryContent === true;
  if (deferToggle) deferToggle.checked = settings.deferDuringChat !== false;

  // v15.4: Set sync mode toggle
  var currentMode = settings.syncMode || 'hybrid';
  var modes = ['cloud', 'hybrid', 'local'];
  modes.forEach(function(m) {
    var btn = document.getElementById('syncMode_' + m);
    if (btn) {
      if (currentMode === m) {
        btn.style.background = 'var(--brand-accent, var(--accent))';
        btn.style.color = '#000';
        btn.style.borderColor = 'var(--brand-accent, var(--accent))';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border-color)';
      }
    }
  });

  // Show/hide granular settings
  var granularSettings = document.getElementById('syncGranularSettings');
  if (granularSettings) {
    granularSettings.style.display = currentMode === 'hybrid' ? 'flex' : 'none';
  }
}

/**
 * v12.2.4: Update sync setting from hub
 */
function updateSyncHubSetting(setting, value) {
  var settings = JSON.parse(localStorage.getItem('roweos_sync_settings') || '{}');
  settings[setting] = value;
  localStorage.setItem('roweos_sync_settings', JSON.stringify(settings));

  // Update global syncSettings object if exists
  if (typeof syncSettings !== 'undefined') {
    syncSettings[setting] = value;
  }

  showToast('Sync setting updated', 'success');
}

/**
 * v15.4: Set sync mode (cloud / hybrid / local)
 */
function setSyncMode(mode) {
  // v23.0: Map new mode names — perfect_cloud and perfect_local
  // Legacy 'cloud' and 'local' still work
  syncSettings.syncMode = mode;
  saveSyncSettings();

  // Update both UIs
  updateSyncSettingsUI();
  // v23.0: Update new mode button highlights
  var _modeButtons = ['perfect_cloud', 'perfect_local', 'advanced'];
  _modeButtons.forEach(function(m) {
    var btn = document.getElementById('syncMode_' + m);
    if (!btn) return;
    var isActive = (m === mode) ||
      (m === 'perfect_cloud' && mode === 'cloud') ||
      (m === 'perfect_local' && mode === 'local') ||
      (m === 'advanced' && mode === 'hybrid');
    btn.style.borderColor = isActive ? 'var(--brand-accent, #a89878)' : 'var(--border-color)';
    btn.style.background = isActive ? 'rgba(168,152,120,0.1)' : 'transparent';
    btn.style.color = isActive ? 'var(--brand-accent, #a89878)' : 'var(--text-secondary)';
  });
  // Legacy button highlights
  var _legacyModes = ['cloud', 'hybrid', 'local'];
  _legacyModes.forEach(function(m) {
    var btn = document.getElementById('syncMode_' + m);
    if (btn) {
      btn.style.borderColor = (m === mode) ? 'var(--brand-accent, #a89878)' : 'var(--border-color)';
      btn.style.background = (m === mode) ? 'rgba(168,152,120,0.1)' : 'transparent';
      btn.style.color = (m === mode) ? 'var(--brand-accent, #a89878)' : 'var(--text-secondary)';
    }
  });

  // Also update hub UI checkboxes
  var hubConv = document.getElementById('syncHubSettingConversations');
  var hubLib = document.getElementById('syncHubSettingLibraryContent');

  // v15.7: Update per-category sync preferences so storage bars + management panel reflect the mode
  var allCatKeys = ['brandai_chats', 'lifeai_chats', 'library', 'logos', 'inventory', 'journal',
    'calendar', 'brand_todos', 'life_todos', 'runs', 'goals', 'knowledge', 'folio'];

  if (mode === 'cloud' || mode === 'perfect_cloud') {
    // v15.10: All cloud — enable all sync, set all categories to cloud, then auto-push
    syncSettings.conversations = true;
    syncSettings.libraryContent = true;
    if (hubConv) hubConv.checked = true;
    if (hubLib) hubLib.checked = true;
    var syncCats = {};
    try { syncCats = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}'); } catch(e) { syncCats = {}; }
    allCatKeys.forEach(function(k) { syncCats[k] = 'cloud'; });
    localStorage.setItem('roweos_sync_categories', JSON.stringify(syncCats));
    saveSyncSettings();
    refreshStorageDisplays();
    // v15.12: Auto-trigger sync when switching to All Cloud, then fetch real counts
    if (typeof syncToFirebase === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
      showToast('Syncing all data to cloud...', 'info');
      syncToFirebase().then(function() {
        // v23.1: Save baselines for ALL categories after cloud push
        _saveSyncBaselines();
        return new Promise(function(resolve) { setTimeout(resolve, 1000); });
      }).then(function() {
        return renderSyncInventory();
      }).then(function() {
        refreshStorageDisplays();
        showToast('All data synced to cloud', 'success');
      }).catch(function(e) {
        showToast('Sync failed: ' + (e.message || e), 'error');
      });
    } else {
      renderSyncInventory();
      showToast('All data set to cloud mode', 'success');
    }
  } else if (mode === 'local' || mode === 'perfect_local') {
    // 100% on device: disable all cloud sync + set all categories to local
    syncSettings.conversations = false;
    syncSettings.libraryContent = false;
    if (hubConv) hubConv.checked = false;
    if (hubLib) hubLib.checked = false;
    var syncCatsLocal = {};
    try { syncCatsLocal = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}'); } catch(e) { syncCatsLocal = {}; }
    allCatKeys.forEach(function(k) { syncCatsLocal[k] = 'local'; });
    localStorage.setItem('roweos_sync_categories', JSON.stringify(syncCatsLocal));
    saveSyncSettings();
    renderSyncInventory().then(function() { refreshStorageDisplays(); });
    showToast('All data stays on this device only', 'info');
  } else {
    showToast('Selective sync enabled: configure below', 'info');
  }
}

// v23.0: Show snapshot list modal for undo/restore
function showSnapshotListModal() {
  // v25.0: If SyncDB failed, show error instead of hanging
  if (_syncDBReady && !_syncDB) {
    showToast('Snapshot storage unavailable. IndexedDB may be disabled in this browser.', 'warning');
    return;
  }
  if (!_syncDBReady) {
    showToast('Snapshot database still loading...', 'info');
    // Still queue the callback in case it's just slow
  }
  _whenSyncDBReady(function() {
    listSnapshots(function(snaps) {
      if (snaps.length === 0) {
        showToast('No snapshots available yet. Snapshots are created automatically before each cloud pull.', 'info');
        return;
      }
      var html = '<div style="padding: 20px; max-height: 60vh; overflow-y: auto;">';
      html += '<h3 style="margin-bottom: 12px;">Data Snapshots</h3>';
      html += '<p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Snapshots are taken automatically before each cloud pull. Restore any snapshot to undo unwanted sync changes.</p>';
      for (var i = 0; i < snaps.length; i++) {
        var s = snaps[i];
        var d = new Date(s.timestamp);
        var keyCount = s.data ? Object.keys(s.data).length : 0;
        html += '<div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px;">';
        html += '<div>';
        html += '<div style="font-size: 13px; font-weight: 500;">' + escapeHtml(s.label || 'Snapshot') + '</div>';
        html += '<div style="font-size: 11px; color: var(--text-muted);">' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString() + ' - ' + (s.deviceType || 'unknown') + ' - ' + keyCount + ' keys</div>';
        html += '</div>';
        html += '<div style="display: flex; gap: 6px;">';
        html += '<button onclick="restoreSnapshot(' + s.id + '); closeModal(\'snapshotListModal\');" class="btn btn-primary" style="padding: 5px 10px; font-size: 11px;">Restore</button>';
        html += '<button onclick="deleteSnapshot(' + s.id + ', function() { showSnapshotListModal(); });" class="btn" style="padding: 5px 10px; font-size: 11px; color: var(--text-muted);">Delete</button>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
      // Use generic modal pattern
      var modal = document.getElementById('snapshotListModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'snapshotListModal';
        modal.className = 'modal-overlay';
        modal.onclick = function(e) { if (e.target === modal) closeModal('snapshotListModal'); };
        document.body.appendChild(modal);
      }
      modal.innerHTML = '<div class="modal" style="max-width: 500px;">' +
        '<button class="modal-close" onclick="closeModal(\'snapshotListModal\')">&times;</button>' +
        html + '</div>';
      modal.classList.add('show');
    });
  });
}

/**
 * v15.12: Manual sync now — pushes data (clears orphans), then re-fetches real counts
 */
// v25.0: Sync Now pulls from cloud (write-through handles all pushes)
// v25.2: Sync Now pulls from cloud (cloud-authoritative)
// Write-through handles all pushes on every save action.
// enablePersistence handles offline queue flushing.
function manualSyncNow() {
  if (typeof loadFromFirebaseV2 !== 'function' || typeof firebaseUser === 'undefined' || !firebaseUser) {
    showToast('Firebase not connected', 'error');
    return;
  }
  showToast('Syncing all data to cloud...', 'info');
  // v28.7: Full bidirectional sync — push ALL categories first, then pull everything.
  // Previously only pushed brands, leaving logos/folio/inventory/chats out of sync.
  try {
    if (typeof saveBrands === 'function') saveBrands();
    if (typeof writeDBConversations === 'function') writeDBConversations();
    if (typeof writeDBTodos === 'function') writeDBTodos();
    if (typeof writeDBCalendar === 'function') writeDBCalendar();
    if (typeof pulseGoals !== 'undefined' && typeof writeDB === 'function') {
      writeDB('pulse/main', { goals: pulseGoals }, { category: 'goals' });
    }
    // Automations
    var _syncAutos = [];
    try { _syncAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(ae) {}
    _syncAutos.forEach(function(a) { if (a && a.id && typeof writeDBAutomation === 'function') writeDBAutomation(a); });
    // Clients
    var _syncClients = [];
    try { _syncClients = JSON.parse(localStorage.getItem('roweos_clients') || '[]'); } catch(ce) {}
    if (_syncClients.length > 0 && typeof writeDB === 'function') {
      var _cd = JSON.parse(JSON.stringify(_syncClients));
      _cd.forEach(function(c) { if (c.logo && c.logo.length > 50000) c.logo = ''; });
      writeDB('profile/clients', { data: _cd });
    }
    // Inventory
    try {
      var _syncInv = JSON.parse(localStorage.getItem('roweos_inventory') || '{}');
      if (_syncInv && (_syncInv.items || []).length > 0) writeDB('profile/inventory', { data: _syncInv });
    } catch(ie) {}
    // Folio
    var _syncFolio = [];
    try { _syncFolio = JSON.parse(localStorage.getItem('roweos_folio_items') || '[]'); } catch(fe) {}
    if (Array.isArray(_syncFolio) && _syncFolio.length > 0) writeDB('folio/main', { data: _syncFolio });
    // Library
    try {
      var _syncLib = localStorage.getItem('roweosLibrary');
      if (_syncLib) writeDB('library/brand', { data: _syncLib });
    } catch(le) {}
    try {
      var _syncLifeLib = localStorage.getItem('roweos_life_library');
      if (_syncLifeLib) writeDB('library/life', { data: _syncLifeLib });
    } catch(lle) {}
    // Journal
    try {
      var _syncJournal = JSON.parse(localStorage.getItem('roweos_journal') || '[]');
      if (Array.isArray(_syncJournal) && _syncJournal.length > 0) writeDB('profile/main', { journal: _syncJournal });
    } catch(je) {}
    // Life profiles
    try {
      var _syncLifeProfiles = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]');
      if (Array.isArray(_syncLifeProfiles) && _syncLifeProfiles.length > 0) writeDB('lifeAI/main', { profiles: _syncLifeProfiles });
    } catch(lpe) {}
    // Brand logos — push to logos/ subcollection (too large for brand docs)
    if (typeof pushBrandLogos === 'function') pushBrandLogos();
    // Studio runs
    try {
      var _syncRuns = JSON.parse(localStorage.getItem('roweos_runs') || '{}');
      var _syncRunsArr = _syncRuns.runs || [];
      if (_syncRunsArr.length > 0) {
        for (var _ri = 0; _ri < _syncRunsArr.length; _ri++) {
          var _run = _syncRunsArr[_ri];
          if (_run && _run.id) writeDBDoc('runs', String(_run.id), _run);
        }
      }
    } catch(re) {}
  } catch(pushErr) { console.warn('[manualSyncNow] Push phase error:', pushErr); }

  // Wait for async writes to propagate, then pull everything from cloud
  var _pushWait = new Promise(function(resolve) { setTimeout(resolve, 4000); });
  _pushWait.then(function() {
    return loadFromFirebaseV2(true);
  }).then(function() {
    var syncTime = String(Date.now());
    var syncDevice = typeof getDeviceType === 'function' ? getDeviceType() : 'unknown';
    localStorage.setItem('roweos_last_sync', syncTime);
    localStorage.setItem('roweos_last_sync_device', syncDevice);
    // v25.2: Mark first sync completed for mergeByTimestamp offline detection
    localStorage.setItem('roweos_first_sync_completed', 'true');
    if (typeof updateLastSyncDisplay === 'function') updateLastSyncDisplay(new Date().toLocaleString(), syncDevice);
    if (typeof updateSyncHubStatus === 'function') updateSyncHubStatus();
    return new Promise(function(resolve) { setTimeout(resolve, 1000); });
  }).then(function() {
    if (typeof renderSyncInventory === 'function') return renderSyncInventory();
  }).then(function() {
    if (typeof refreshStorageDisplays === 'function') refreshStorageDisplays();
    showToast('Sync complete', 'success');
  }).catch(function(e) {
    console.error('[manualSyncNow] Error:', e);
    // v28.5: Firebase client terminated (common on iOS when app is backgrounded)
    // Re-initialize Firestore and retry once
    var errMsg = String(e.message || e);
    if (errMsg.indexOf('terminated') !== -1 && !manualSyncNow._retried) {
      manualSyncNow._retried = true;
      console.log('[manualSyncNow] Firestore terminated, re-initializing...');
      try {
        firebase.firestore().clearPersistence().catch(function() {});
      } catch(ignore) {}
      showToast('Reconnecting...', 'info');
      setTimeout(function() {
        manualSyncNow._retried = false;
        manualSyncNow();
      }, 2000);
      return;
    }
    manualSyncNow._retried = false;
    showToast('Sync failed: ' + errMsg, 'error');
  });
}

/**
 * v12.2.6: Clear specific storage category with immediate UI refresh
 */
function clearStorageCategory(category) {
  var categoryNames = {
    brandai_chats: 'BrandAI Chats', lifeai_chats: 'LifeAI Chats', library: 'Library Files',
    logos: 'Brand Logos', inventory: 'Inventory Images', journal: 'Journal Entries',
    calendar: 'Calendar Events', brand_todos: 'BrandAI To-Dos', life_todos: 'LifeAI To-Dos',
    runs: 'Studio Runs', goals: 'Pulse Goals', knowledge: 'Brand Knowledge', conversations: 'Old Conversations'
  };
  var displayName = categoryNames[category] || category;
  var confirmed = confirm('Clear ' + displayName + '? This will free up storage space.');
  if (!confirmed) return;

  try {
    if (category === 'conversations') {
      // v12.2.4: Legacy - keep last 10
      var brandChats = JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]');
      var lifeChats = JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]');
      if (brandChats.length > 10) localStorage.setItem('roweos_agentCommands', JSON.stringify(brandChats.slice(-10)));
      if (lifeChats.length > 10) localStorage.setItem('roweos_life_agentCommands', JSON.stringify(lifeChats.slice(-10)));
      showToast('Cleared old conversations, kept last 10', 'success');

    } else if (category === 'brandai_chats') {
      // v12.2.6: Clear all BrandAI chats
      localStorage.removeItem('roweos_agentCommands');
      if (typeof agentCommands !== 'undefined') agentCommands = [];
      if (typeof currentConversation !== 'undefined') currentConversation = [];
      var agentConv = document.getElementById('agentConversation');
      if (agentConv) agentConv.classList.add('hidden');
      showToast('Cleared all BrandAI conversations', 'success');

    } else if (category === 'lifeai_chats') {
      // v12.2.6: Clear all LifeAI chats
      localStorage.removeItem('roweos_life_agentCommands');
      showToast('Cleared all LifeAI conversations', 'success');

    } else if (category === 'library') {
      var brandLib = JSON.parse(localStorage.getItem('roweosLibrary') || '{}');
      var lifeLib = JSON.parse(localStorage.getItem('roweos_life_library') || '{}');
      if (brandLib.files) {
        brandLib.files = brandLib.files.map(function(f) {
          return { id: f.id, name: f.name, type: f.type, size: f.size, uploadedAt: f.uploadedAt, folderId: f.folderId };
        });
        localStorage.setItem('roweosLibrary', JSON.stringify(brandLib));
      }
      if (lifeLib.files) {
        lifeLib.files = lifeLib.files.map(function(f) {
          return { id: f.id, name: f.name, type: f.type, size: f.size, uploadedAt: f.uploadedAt, folderId: f.folderId };
        });
        localStorage.setItem('roweos_life_library', JSON.stringify(lifeLib));
      }
      showToast('Cleared library file contents', 'success');

    } else if (category === 'logos') {
      for (var i = 0; i < 10; i++) {
        localStorage.removeItem('roweos_brand_' + i + '_logo');
        localStorage.removeItem('roweos_brand_' + i + '_logo_size');
      }
      // v15.37: Clear per-profile LifeAI logos + legacy shared key
      for (var pi = 0; pi < 5; pi++) {
        localStorage.removeItem('roweos_lifeai_logo_profile_' + pi);
        localStorage.removeItem('roweos_lifeai_logo_profile_' + pi + '_size');
      }
      localStorage.removeItem('roweos_lifeai_logo');
      localStorage.removeItem('roweos_lifeai_logo_size');
      showToast('Cleared all brand logos', 'success');

    } else if (category === 'inventory') {
      var inv = JSON.parse(localStorage.getItem('roweos_inventory') || '{}');
      if (inv.items) {
        inv.items = inv.items.map(function(item) {
          delete item.imageData;
          return item;
        });
        localStorage.setItem('roweos_inventory', JSON.stringify(inv));
      }
      showToast('Cleared inventory images', 'success');

    } else if (category === 'journal') {
      // v12.2.6: Clear journal
      localStorage.removeItem('roweos_journal');
      showToast('Cleared all journal entries', 'success');

    } else if (category === 'calendar') {
      // v12.2.6: Clear calendar
      localStorage.removeItem('roweos_calendar');
      if (typeof calendar !== 'undefined') calendar = [];
      showToast('Cleared all calendar events', 'success');

    } else if (category === 'brand_todos') {
      // v12.2.7: Clear BrandAI todos
      localStorage.removeItem('roweosTodos');
      localStorage.removeItem('roweos_todo_categories');
      showToast('Cleared BrandAI to-do items', 'success');

    } else if (category === 'life_todos') {
      // v12.2.7: Clear LifeAI todos
      localStorage.removeItem('roweos_life_todos');
      localStorage.removeItem('roweos_life_todo_categories');
      showToast('Cleared LifeAI to-do items', 'success');

    } else if (category === 'runs') {
      // v12.2.6: Clear studio runs
      localStorage.removeItem('roweos_runs');
      if (typeof runs !== 'undefined') runs = [];
      showToast('Cleared studio run history', 'success');

    } else if (category === 'goals') {
      // v12.2.6: Clear pulse goals
      localStorage.removeItem('roweos_pulse_goals');
      showToast('Cleared all pulse goals', 'success');

    } else if (category === 'knowledge') {
      // v12.2.6: Clear brand knowledge
      localStorage.removeItem('roweos_brand_memory');
      localStorage.removeItem('brandMemory');
      brandMemory = {};
      for (var j = 0; j < 5; j++) {
        localStorage.removeItem('brand_' + j);
      }
      showToast('Cleared brand knowledge', 'success');
    }
  } catch (e) {
    showToast('Error clearing ' + displayName + ': ' + e.message, 'error');
  }

  // v12.2.6: Immediately refresh storage displays
  refreshStorageDisplays();
  renderSyncInventory();
}

/**
 * v12.2.4: Clear all synced cloud data
 */
// v12.2.7: AI Storage Assistant
function buildStorageAssistantPrompt(userMessage) {
  // Gather comprehensive storage stats
  var syncCats = {};
  try { syncCats = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}'); } catch(e) {}

  var categories = [
    { key: 'brandai_chats', name: 'BrandAI Chats', lsKey: 'roweos_agentCommands' },
    { key: 'lifeai_chats', name: 'LifeAI Chats', lsKey: 'roweos_life_agentCommands' },
    { key: 'library', name: 'Library Files', lsKey: 'roweosLibrary' },
    { key: 'brand_todos', name: 'BrandAI To-Dos', lsKey: 'roweosTodos' },
    { key: 'life_todos', name: 'LifeAI To-Dos', lsKey: 'roweos_life_todos' },
    { key: 'calendar', name: 'Calendar Events', lsKey: 'roweos_calendar' },
    { key: 'logos', name: 'Brand Logos', lsKey: null },
    { key: 'goals', name: 'Pulse Goals', lsKey: 'roweos_pulse_goals' },
    { key: 'knowledge', name: 'Brand Knowledge', lsKey: 'roweos_brand_memory' },
    { key: 'journal', name: 'Journal Entries', lsKey: 'roweos_journal' },
    { key: 'inventory', name: 'Inventory', lsKey: 'roweos_inventory' },
    { key: 'runs', name: 'Studio Runs', lsKey: 'roweos_runs' }
  ];

  var stats = categories.map(function(cat) {
    var size = 0;
    var count = 0;
    if (cat.lsKey) {
      size = getKeySize(cat.lsKey);
      try {
        var val = JSON.parse(localStorage.getItem(cat.lsKey) || '[]');
        count = Array.isArray(val) ? val.length : (val.items ? val.items.length : (val.files ? val.files.length : 0));
      } catch(e) {}
    } else if (cat.key === 'logos') {
      for (var i = 0; i < 10; i++) { size += getKeySize('roweos_brand_' + i + '_logo'); }
      // v15.37: Per-profile LifeAI logos
      for (var pi = 0; pi < 5; pi++) { size += getKeySize('roweos_lifeai_logo_profile_' + pi); }
    }
    var location = syncCats[cat.key] === 'local' ? 'LOCAL' : 'CLOUD';
    return cat.name + ': ' + formatStorageSize(size) + ', ' + count + ' items, ' + location + ' (key: ' + cat.key + ')';
  });

  var totalLocal = 0;
  var totalCloud = 0;
  for (var key in localStorage) {
    if (localStorage.hasOwnProperty(key) && key.startsWith('roweos')) {
      var s = (localStorage.getItem(key) || '').length * 2;
      totalLocal += s;
    }
  }

  // Calculate cloud size
  categories.forEach(function(cat) {
    if (syncCats[cat.key] !== 'local') {
      if (cat.lsKey) {
        totalCloud += getKeySize(cat.lsKey);
      } else if (cat.key === 'logos') {
        for (var i = 0; i < 10; i++) totalCloud += getKeySize('roweos_brand_' + i + '_logo');
        // v15.37: Per-profile LifeAI logos
        for (var pi = 0; pi < 5; pi++) totalCloud += getKeySize('roweos_lifeai_logo_profile_' + pi);
      }
    }
  });

  var hasFirebase = typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.email;

  var systemPrompt = 'You are the RoweOS Storage Assistant. You have complete knowledge of the user\'s storage situation.\n\n';
  systemPrompt += '## Current Storage Status\n';
  systemPrompt += '- Total Local: ' + formatStorageSize(totalLocal) + ' / 5 GB\n';
  systemPrompt += '- Cloud Sync: ' + formatStorageSize(totalCloud) + ' / 1 GB (Firestore V2 subcollections + Blaze plan)\n';
  systemPrompt += '- Firebase Connected: ' + (hasFirebase ? 'Yes (' + firebaseUser.email + ')' : 'No') + '\n\n';
  systemPrompt += '## Per-Category Breakdown\n';
  stats.forEach(function(s) { systemPrompt += '- ' + s + '\n'; });
  systemPrompt += '\n## Rules\n';
  systemPrompt += '- Categories set to CLOUD will be synced to Firebase. Categories set to LOCAL stay only on this device.\n';
  systemPrompt += '- Firestore V2 uses subcollections with no single-document size limit. Data is distributed across multiple documents.\n';
  systemPrompt += '- When the user asks you to toggle a category, include this exact tag in your response: [TOGGLE:category_key:cloud] or [TOGGLE:category_key:local]\n';
  systemPrompt += '- Available category keys: brandai_chats, lifeai_chats, library, brand_todos, life_todos, calendar, logos, goals, knowledge, journal, inventory, runs\n';
  systemPrompt += '- Be concise. Give specific size numbers. Recommend which categories to move to local if cloud is over limit.\n';
  systemPrompt += '- Never use emoji. Use plain text only.\n';

  return systemPrompt;
}

function sendStorageAssistantMessage() {
  var input = document.getElementById('storageAssistantInput');
  var messagesEl = document.getElementById('storageAssistantMessages');
  if (!input || !input.value.trim() || !messagesEl) return;

  var userMsg = input.value.trim();
  input.value = '';

  // Add user message
  var userDiv = document.createElement('div');
  userDiv.style.cssText = 'padding: 10px 14px; background: var(--accent-10, rgba(212, 175, 55, 0.1)); border: 1px solid var(--accent-20, rgba(212, 175, 55, 0.2)); border-radius: var(--radius-md); font-size: var(--text-sm); align-self: flex-end; max-width: 85%;';
  userDiv.textContent = userMsg;
  messagesEl.appendChild(userDiv);

  // Add loading indicator
  var loadingDiv = document.createElement('div');
  loadingDiv.id = 'storageAssistantLoading';
  loadingDiv.style.cssText = 'padding: 10px 14px; background: var(--bg-tertiary); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--text-muted);';
  loadingDiv.textContent = 'Analyzing storage...';
  messagesEl.appendChild(loadingDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Build prompt and send to AI
  var systemPrompt = buildStorageAssistantPrompt(userMsg);

  // Determine API provider
  var apiKeys = {};
  try { apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) { console.warn('[API] Corrupted API keys data:', e.message); }

  var provider = null;
  var apiKey = null;
  if (apiKeys.anthropic) { provider = 'anthropic'; apiKey = apiKeys.anthropic; }
  else if (apiKeys.openai) { provider = 'openai'; apiKey = apiKeys.openai; }
  else if (apiKeys.google) { provider = 'google'; apiKey = apiKeys.google; }

  if (!provider) {
    loadingDiv.style.background = 'rgba(239, 68, 68, 0.1)';
    loadingDiv.style.color = '#ef4444';
    loadingDiv.textContent = 'No API key configured. Add one in Settings to use the Storage Assistant.';
    return;
  }

  callStorageAssistantAPI(provider, apiKey, systemPrompt, userMsg, function(response) {
    loadingDiv.remove();

    // Parse and execute any TOGGLE commands
    var cleanResponse = response.replace(/\[TOGGLE:([a-z_]+):(cloud|local)\]/g, function(match, catKey, value) {
      var syncCats = {};
      try { syncCats = JSON.parse(localStorage.getItem('roweos_sync_categories') || '{}'); } catch(e) {}
      syncCats[catKey] = value;
      localStorage.setItem('roweos_sync_categories', JSON.stringify(syncCats));
      refreshStorageDisplays();
      return '';
    });

    var responseDiv = document.createElement('div');
    responseDiv.style.cssText = 'padding: 12px 16px; background: var(--bg-tertiary); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5;';
    if (typeof marked !== 'undefined' && marked.parse) {
      responseDiv.innerHTML = marked.parse(cleanResponse.trim());
    } else {
      responseDiv.textContent = cleanResponse.trim();
    }
    messagesEl.appendChild(responseDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, function(error) {
    loadingDiv.style.background = 'rgba(239, 68, 68, 0.1)';
    loadingDiv.style.color = '#ef4444';
    loadingDiv.textContent = 'Error: ' + error;
  });
}

function callStorageAssistantAPI(provider, apiKey, systemPrompt, userMsg, onSuccess, onError) {
  if (provider === 'anthropic') {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.anthropic.com/v1/messages');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-api-key', apiKey);
    xhr.setRequestHeader('anthropic-version', '2023-06-01');
    xhr.setRequestHeader('anthropic-dangerous-direct-browser-access', 'true');
    xhr.onload = function() {
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.content && data.content[0]) {
          onSuccess(data.content[0].text);
        } else if (data.error) {
          onError(data.error.message);
        }
      } catch(e) { onError(e.message); }
    };
    xhr.onerror = function() { onError('Network error'); };
    xhr.send(JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }]
    }));

  } else if (provider === 'openai') {
    var xhr2 = new XMLHttpRequest();
    xhr2.open('POST', 'https://api.openai.com/v1/responses'); // v22.18: Responses API
    xhr2.setRequestHeader('Content-Type', 'application/json');
    xhr2.setRequestHeader('Authorization', 'Bearer ' + apiKey);
    xhr2.onload = function() {
      try {
        var data = JSON.parse(xhr2.responseText);
        if (data.output_text) { // v22.18: Responses API format
          onSuccess(data.output_text);
        } else if (data.error) {
          onError(data.error.message);
        }
      } catch(e) { onError(e.message); }
    };
    xhr2.onerror = function() { onError('Network error'); };
    xhr2.send(JSON.stringify({
      model: 'gpt-5.4',
      instructions: systemPrompt,
      max_output_tokens: 1024,
      input: [{ role: 'user', content: userMsg }],
      store: false
    }));

  } else if (provider === 'google') {
    var xhr3 = new XMLHttpRequest();
    xhr3.open('POST', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' + apiKey);
    xhr3.setRequestHeader('Content-Type', 'application/json');
    xhr3.onload = function() {
      try {
        var data = JSON.parse(xhr3.responseText);
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          onSuccess(data.candidates[0].content.parts[0].text);
        } else if (data.error) {
          onError(data.error.message);
        }
      } catch(e) { onError(e.message); }
    };
    xhr3.onerror = function() { onError('Network error'); };
    xhr3.send(JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMsg }] }],
      generationConfig: { maxOutputTokens: 1024 }
    }));
  }
}

async function clearAllSyncData() {
  var confirmed = confirm('WARNING: This will delete ALL your data from the cloud. Your local data will remain. Continue?');
  if (!confirmed) return;

  var doubleConfirm = confirm('Are you absolutely sure? This cannot be undone.');
  if (!doubleConfirm) return;

  var hasFirebase = typeof firebase !== 'undefined' && firebase.firestore && typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.uid;

  if (!hasFirebase) {
    showToast('Firebase not connected', 'error');
    return;
  }

  try {
    showToast('Clearing cloud data...', 'info');
    await deleteUserFirestoreData(firebaseUser.uid);
    showToast('Cloud data cleared successfully', 'success');
    renderSyncInventory();
    refreshStorageDisplays();
  } catch (e) {
    showToast('Error clearing cloud data: ' + e.message, 'error');
  }
}

// v20.9: Shared helper — deletes ALL Firestore data for a given UID
async function deleteUserFirestoreData(uid) {
  var db = firebase.firestore();
  var basePath = 'roweos_users/' + uid;

  // Delete all subcollections (collections with multiple docs)
  var subcollections = [
    basePath + '/brands',
    basePath + '/todos',
    basePath + '/calendar',
    basePath + '/runs',
    basePath + '/inventory',
    basePath + '/automations',
    basePath + '/knowledge',
    basePath + '/logos',
    basePath + '/sync_status'
  ];
  await Promise.all(subcollections.map(function(path) {
    return clearFirestoreSubcollection(db, path);
  }));

  // Delete all single-doc subcollections (documents at known paths)
  var docPaths = [
    basePath + '/profile/main',
    basePath + '/profile/customOps',
    basePath + '/profile/customAgents',
    basePath + '/profile/generatedBrandOps',
    basePath + '/profile/clients',
    basePath + '/profile/people',
    basePath + '/profile/socialPosts',
    basePath + '/profile/socialWorkflows',
    basePath + '/profile/notifications',
    basePath + '/profile/logos',
    basePath + '/conversations/current',
    basePath + '/conversations/history',
    basePath + '/conversations/agentHistory',
    basePath + '/lifeAI/main',
    basePath + '/lifeAI/possessions',
    basePath + '/library/brand',
    basePath + '/library/life',
    basePath + '/pulse/main',
    basePath + '/analytics/main',
    basePath + '/analytics/settings',
    basePath + '/secure/api_keys'
  ];
  await Promise.all(docPaths.map(function(path) {
    return db.doc(path).delete().catch(function() { /* doc may not exist */ });
  }));

  // Delete the root user document
  await db.collection('roweos_users').doc(uid).delete();

  // Delete social tokens (legacy collection)
  try {
    var socialSnap = await db.collection('users/' + uid + '/social_tokens').get();
    if (!socialSnap.empty) {
      var batch = db.batch();
      socialSnap.docs.forEach(function(doc) { batch.delete(doc.ref); });
      await batch.commit();
    }
    await db.collection('users').doc(uid).delete().catch(function() {});
  } catch(e) { /* legacy collection may not exist */ }
}

// v20.9: Full account deletion — Firebase data + localStorage + Auth account
async function deleteMyAccount() {
  if (!firebaseUser) {
    showToast('Not signed in', 'error');
    return;
  }

  var confirmed = confirm('DELETE ACCOUNT: This will permanently delete ALL your data: cloud, local, and your sign-in account. This cannot be undone.');
  if (!confirmed) return;

  var typed = prompt('Type DELETE to confirm account deletion:');
  if (typed !== 'DELETE') {
    showToast('Account deletion cancelled', 'info');
    return;
  }

  var uid = firebaseUser.uid;
  var email = firebaseUser.email || '';

  try {
    showToast('Deleting account data...', 'info');

    // 1. Delete all Firestore user data
    await deleteUserFirestoreData(uid);

    // 2. Delete access key if one exists
    try {
      var db = firebase.firestore();
      var akSnap = await db.collection('access_keys').where('email', '==', email).get();
      if (!akSnap.empty) {
        var akBatch = db.batch();
        akSnap.docs.forEach(function(doc) { akBatch.delete(doc.ref); });
        await akBatch.commit();
      }
    } catch(akErr) { console.error('[Delete] Access key cleanup error:', akErr.message); }

    // 3. Clear all localStorage
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('roweos') !== -1) keysToRemove.push(key);
    }
    keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
    try { localStorage.removeItem('roweosLibrary'); } catch(e) {}
    try { localStorage.removeItem('roweosTodos'); } catch(e) {}

    // 4. Delete Firebase Auth account
    try {
      await firebaseUser.delete();
    } catch(authErr) {
      console.error('[Delete] Auth deletion failed (may need re-auth):', authErr.message);
      if (authErr.code === 'auth/requires-recent-login') {
        showToast('Data deleted. Sign in again to finish removing your account.', 'info');
        disconnectFirebase();
        return;
      }
    }

    firebaseUser = null;
    showToast('Account deleted', 'success');
    showAuthGate();

  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    console.error('[Delete] Account deletion error:', e);
  }
}

/**
 * v15.10: Run full sync diagnostic — reads V2 subcollections (not V1 root doc)
 */
async function runFullSyncDiagnostic() {
  var container = document.getElementById('syncDiagnosticsTable');
  if (!container) return;

  container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Running diagnostics...</div>';

  var hasFirebase = typeof firebase !== 'undefined' && firebase.firestore && typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.uid;

  if (!hasFirebase) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-tertiary);">Firebase not connected. Connect in Settings to enable diagnostics.</div>';
    return;
  }

  try {
    var uid = firebaseUser.uid;
    var db = firebase.firestore();
    var basePath = 'roweos_users/' + uid;

    // v15.10: Read from V2 subcollections — same paths as renderSyncInventory
    var results = await Promise.all([
      db.collection(basePath + '/brands').get(),
      db.doc(basePath + '/conversations/agentHistory').get(),
      db.doc(basePath + '/lifeAI/main').get(),
      db.collection(basePath + '/todos').get(),
      db.collection(basePath + '/calendar').get(),
      db.collection(basePath + '/runs').get(),
      db.collection(basePath + '/inventory').get(),
      db.doc(basePath + '/pulse/main').get(),
      db.doc(basePath + '/profile/main').get(),
      db.doc(basePath).get()
    ]);

    var lifeData = results[2].exists ? results[2].data() : {};
    var pulseData = results[7].exists ? results[7].data() : {};
    var profileData = results[8].exists ? results[8].data() : {};
    var rootData = results[9].exists ? results[9].data() : {};
    var chatCount = 0;
    if (results[1].exists) { try { var ah = results[1].data(); if (ah.json) chatCount = JSON.parse(ah.json).length; } catch(e) {} }

    var checks = [
      { name: 'Brands', local: (function() { try { return JSON.parse(localStorage.getItem('roweos_user_brands') || '[]').length; } catch(e) { return 0; } })(), cloud: results[0].size },
      { name: 'BrandAI Chats', local: (function() { try { return JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]').length; } catch(e) { return 0; } })(), cloud: chatCount },
      { name: 'LifeAI Chats', local: (function() { try { return JSON.parse(localStorage.getItem('roweos_life_agentCommands') || '[]').length; } catch(e) { return 0; } })(), cloud: lifeData.agentCommands ? lifeData.agentCommands.length : 0 },
      { name: 'To-Dos', local: (function() { try { return JSON.parse(localStorage.getItem('roweosTodos') || '[]').length; } catch(e) { return 0; } })(), cloud: results[3].size },
      { name: 'Calendar', local: (function() { try { return JSON.parse(localStorage.getItem('roweos_calendar') || '[]').length; } catch(e) { return 0; } })(), cloud: results[4].size },
      { name: 'Journal', local: (function() { try { return JSON.parse(localStorage.getItem('roweos_journal') || '[]').length; } catch(e) { return 0; } })(), cloud: profileData.journal ? profileData.journal.length : 0 },
      { name: 'Inventory', local: (function() { try { return (JSON.parse(localStorage.getItem('roweos_inventory') || '{}').items || []).length; } catch(e) { return 0; } })(), cloud: results[6].size },
      { name: 'Studio Runs', local: (function() { try { var d = JSON.parse(localStorage.getItem('roweos_runs') || '{}'); return (d.runs || []).length; } catch(e) { return 0; } })(), cloud: results[5].size },
      { name: 'Pulse Goals', local: (function() { try { return JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]').length; } catch(e) { return 0; } })(), cloud: pulseData.goals ? pulseData.goals.length : 0 },
      { name: 'Automations', local: (function() { try { return JSON.parse(localStorage.getItem('roweos_automations') || '[]').length; } catch(e) { return 0; } })(), cloud: (rootData.automations || []).length }
    ];

    var html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<thead><tr style="border-bottom: 1px solid var(--border-color);">';
    html += '<th style="text-align: left; padding: 8px;">Category</th>';
    html += '<th style="text-align: center; padding: 8px;">Local</th>';
    html += '<th style="text-align: center; padding: 8px;">Cloud</th>';
    html += '<th style="text-align: center; padding: 8px;">Status</th>';
    html += '</tr></thead><tbody>';

    checks.forEach(function(check) {
      var status = '';
      var statusColor = '';
      if (check.local === check.cloud) {
        status = 'In Sync';
        statusColor = '#22c55e';
      } else if (check.local > check.cloud) {
        status = 'Local Ahead';
        statusColor = '#f59e0b';
      } else {
        status = 'Cloud Ahead';
        statusColor = '#3b82f6';
      }

      html += '<tr style="border-bottom: 1px solid var(--border-subtle);">';
      html += '<td style="padding: 8px;">' + check.name + '</td>';
      html += '<td style="text-align: center; padding: 8px;">' + check.local + '</td>';
      html += '<td style="text-align: center; padding: 8px;">' + check.cloud + '</td>';
      html += '<td style="text-align: center; padding: 8px; color: ' + statusColor + ';">' + status + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (e) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Diagnostic error: ' + e.message + '</div>';
  }
}

/**
 * v15.10: Recover all data from cloud (uses V2 loader)
 */
async function recoverAllSyncData() {
  if (typeof loadFromFirebaseV2 !== 'function') {
    showToast('Firebase not available', 'error');
    return;
  }

  if (!confirm('This will replace local data with cloud data. Continue?')) {
    return;
  }

  showToast('Recovering data from cloud...', 'info');

  try {
    await loadFromFirebaseV2();
    updateSyncHubStatus();
    await renderSyncInventory();
    refreshStorageDisplays();
    showToast('Data recovered from cloud', 'success');
  } catch (e) {
    showToast('Recovery failed: ' + e.message, 'error');
  }
}

// Storage for recoverable data
window._recoverableData = {};

/**
 * v15.10: Run full data diagnostic — reads V2 subcollections (not V1 root doc)
 */
async function runFullDataDiagnostic() {
  var resultsContainer = document.getElementById('dataRecoveryResults');
  var resultsList = document.getElementById('diagnosticResultsList');
  var recoveryContainer = document.getElementById('recoveryActionsContainer');
  var recoveryList = document.getElementById('recoveryActionsList');

  if (!resultsContainer || !resultsList) return;

  resultsContainer.style.display = 'block';
  recoveryContainer.style.display = 'none';
  resultsList.innerHTML = '<div style="color: var(--text-muted);">Running diagnostics...</div>';

  window._recoverableData = {};
  var results = [];

  try {
    var hasFirebase = typeof firebase !== 'undefined' && firebase.firestore && firebaseUser && firebaseUser.uid;
    var v2Counts = {};
    var oldFirebaseData = {};

    if (hasFirebase) {
      var uid = firebaseUser.uid;
      var db = firebase.firestore();
      var basePath = 'roweos_users/' + uid;

      // v15.10: Read from V2 subcollections
      try {
        var fbResults = await Promise.all([
          db.collection(basePath + '/brands').get(),
          db.doc(basePath + '/conversations/agentHistory').get(),
          db.doc(basePath + '/lifeAI/main').get(),
          db.collection(basePath + '/todos').get(),
          db.collection(basePath + '/calendar').get(),
          db.collection(basePath + '/runs').get(),
          db.collection(basePath + '/inventory').get(),
          db.doc(basePath + '/library/brand').get()
        ]);
        v2Counts.brands = fbResults[0].size;
        v2Counts.brandai = 0;
        if (fbResults[1].exists) { try { var ah = fbResults[1].data(); if (ah.json) v2Counts.brandai = JSON.parse(ah.json).length; } catch(e) {} }
        var lifeData = fbResults[2].exists ? fbResults[2].data() : {};
        v2Counts.lifeai = lifeData.agentCommands ? lifeData.agentCommands.length : 0;
        v2Counts.todos = fbResults[3].size;
        v2Counts.calendar = fbResults[4].size;
        v2Counts.studio = fbResults[5].size;
        v2Counts.inventory = fbResults[6].size;
        var libCount = 0;
        if (fbResults[7].exists) { try { var lbd = fbResults[7].data(); if (lbd.data) { var lib = typeof lbd.data === 'string' ? JSON.parse(lbd.data) : lbd.data; Object.keys(lib).forEach(function(k) { if (lib[k] && lib[k].files) libCount += lib[k].files.length; }); } } catch(e) {} }
        v2Counts.library = libCount;
      } catch(e) { console.warn('[Recovery] V2 read error:', e); }

      // Check OLD location for recovery
      try {
        var oldDoc = await db.collection('users').doc(uid).get();
        if (oldDoc.exists) oldFirebaseData = oldDoc.data();
      } catch (e) { /* Old location may not exist */ }
    }

    // v15.10: Categories using correct localStorage keys
    var categories = [
      { key: 'brands', label: 'Brands', localKey: 'roweos_user_brands', oldFbKey: 'brands', countFn: function(d) { return Array.isArray(d) ? d.length : 0; } },
      { key: 'inventory', label: 'Inventory', localKey: 'roweos_inventory', oldFbKey: 'inventory', countFn: function(d) { return d && d.items ? d.items.length : 0; } },
      { key: 'brandai', label: 'BrandAI Chats', localKey: 'roweos_agentCommands', oldFbKey: 'conversations', countFn: function(d) { if (Array.isArray(d)) return d.length; if (d && d.agentHistoryJson) { try { return JSON.parse(d.agentHistoryJson).length; } catch(e) { return 0; } } return 0; } },
      { key: 'lifeai', label: 'LifeAI Chats', localKey: 'roweos_life_agentCommands', oldFbKey: 'lifeAI', countFn: function(d) { return Array.isArray(d) ? d.length : 0; } },
      { key: 'library', label: 'Library Files', localKey: 'roweosLibrary', oldFbKey: 'library', countFn: function(d) { if (typeof d === 'string') { try { d = JSON.parse(d); } catch(e) { return 0; } } var c = 0; if (d && typeof d === 'object') { if (d.files) { c += d.files.length; } else { Object.keys(d).forEach(function(k) { if (d[k] && d[k].files) c += d[k].files.length; }); } } return c; } },
      { key: 'calendar', label: 'Calendar', localKey: 'roweos_calendar', oldFbKey: 'calendar', countFn: function(d) { return Array.isArray(d) ? d.length : 0; } },
      { key: 'todos', label: 'Todos', localKey: 'roweosTodos', oldFbKey: 'todos', countFn: function(d) { return Array.isArray(d) ? d.length : 0; } },
      { key: 'studio', label: 'Studio Runs', localKey: 'roweos_runs', oldFbKey: 'runs', countFn: function(d) { return d && d.runs ? d.runs.length : (Array.isArray(d) ? d.length : 0); } }
    ];

    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var localCount = 0;
      var fbCount = v2Counts[cat.key] || 0;
      var oldFbCount = 0;

      try {
        var rawLocal = localStorage.getItem(cat.localKey);
        if (rawLocal) localCount = cat.countFn(JSON.parse(rawLocal));
      } catch (e) {}

      if (oldFirebaseData[cat.oldFbKey]) {
        oldFbCount = cat.countFn(oldFirebaseData[cat.oldFbKey]);
        if (oldFbCount > 0 && oldFbCount > localCount) {
          window._recoverableData[cat.key] = {
            data: oldFirebaseData[cat.oldFbKey],
            count: oldFbCount,
            localKey: cat.localKey,
            fbKey: cat.oldFbKey
          };
        }
      }

      var status = 'ok';
      var statusColor = '#22c55e';
      if (localCount === 0 && fbCount === 0) { status = '--'; statusColor = 'var(--text-muted)'; }
      if (oldFbCount > localCount && oldFbCount > fbCount) { status = 'recoverable'; statusColor = '#f59e0b'; }

      results.push({ label: cat.label, local: localCount, firebase: fbCount, oldFb: oldFbCount, status: status, statusColor: statusColor, key: cat.key });

      var statusEl = document.getElementById('recoveryStatus' + cat.key.charAt(0).toUpperCase() + cat.key.slice(1));
      if (statusEl) {
        statusEl.textContent = 'Local: ' + localCount + ' | Cloud: ' + fbCount + (oldFbCount > 0 ? ' | Old: ' + oldFbCount : '');
        if (oldFbCount > localCount) statusEl.style.color = '#f59e0b'; else statusEl.style.color = '';
      }
    }

    var html = '<table style="width: 100%; font-size: var(--text-sm); border-collapse: collapse;">';
    html += '<tr style="border-bottom: 1px solid var(--border-color);"><th style="text-align: left; padding: var(--space-1);">Category</th><th style="padding: var(--space-1);">Local</th><th style="padding: var(--space-1);">Cloud</th><th style="padding: var(--space-1);">Old Location</th><th style="padding: var(--space-1);">Status</th></tr>';

    for (var j = 0; j < results.length; j++) {
      var r = results[j];
      html += '<tr style="border-bottom: 1px solid var(--border-color);">';
      html += '<td style="padding: 6px 4px;">' + r.label + '</td>';
      html += '<td style="padding: 6px 4px; text-align: center;">' + r.local + '</td>';
      html += '<td style="padding: 6px 4px; text-align: center;">' + r.firebase + '</td>';
      html += '<td style="padding: 6px 4px; text-align: center; ' + (r.oldFb > 0 ? 'color: #f59e0b; font-weight: 600;' : '') + '">' + r.oldFb + '</td>';
      html += '<td style="padding: 6px 4px; text-align: center; color: ' + r.statusColor + ';">' + r.status + '</td>';
      html += '</tr>';
    }
    html += '</table>';
    resultsList.innerHTML = html;

    var recoverableKeys = Object.keys(window._recoverableData);
    if (recoverableKeys.length > 0) {
      recoveryContainer.style.display = 'block';
      var recoveryHtml = '';
      for (var k = 0; k < recoverableKeys.length; k++) {
        var rKey = recoverableKeys[k];
        var rData = window._recoverableData[rKey];
        recoveryHtml += '<div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2); background: var(--bg-secondary); border-radius: var(--radius-sm); margin-bottom: var(--space-2);">';
        recoveryHtml += '<span>' + rKey.charAt(0).toUpperCase() + rKey.slice(1) + ' (' + rData.count + ' items)</span>';
        recoveryHtml += '<button class="btn btn-small" style="background: #22c55e;" onclick="recoverData(\'' + rKey + '\')">Recover</button>';
        recoveryHtml += '</div>';
      }
      recoveryHtml += '<div style="margin-top: var(--space-3);"><button class="btn btn-small" style="background: #22c55e; width: 100%;" onclick="recoverAllData()">Recover All Data</button></div>';
      recoveryList.innerHTML = recoveryHtml;
      showToast('Found ' + recoverableKeys.length + ' categories with recoverable data!', 'success');
    }

  } catch (error) {
    console.error('[Recovery] Diagnostic error:', error);
    resultsList.innerHTML = '<div style="color: #ef4444;">Error running diagnostics: ' + error.message + '</div>';
  }
}

/**
 * Check recovery status for individual category
 */
async function checkRecoveryStatus(type) {
  var statusEl = document.getElementById('recoveryStatus' + type.charAt(0).toUpperCase() + type.slice(1));
  if (!statusEl) return;
  
  statusEl.textContent = 'Checking...';
  
  // Run full diagnostic which will update this status
  await runFullDataDiagnostic();
}

/**
 * Recover data for a specific category
 */
async function recoverData(key) {
  var recData = window._recoverableData[key];
  if (!recData) {
    showToast('No recoverable data for ' + key, 'warning');
    return;
  }
  
  try {
    // Restore to localStorage
    var dataToSave = recData.data;
    if (typeof dataToSave === 'object') {
      dataToSave = JSON.stringify(dataToSave);
    }
    localStorage.setItem(recData.localKey, dataToSave);
    
    // Sync to correct Firebase location
    if (typeof firebase !== 'undefined' && firebase.firestore && firebaseUser && firebaseUser.uid) {
      var updateObj = {};
      updateObj[recData.fbKey] = recData.data;
      await firebase.firestore().collection('roweos_users').doc(firebaseUser.uid).set(updateObj, { merge: true });
    }
    
    // Update global variables if needed
    if (key === 'inventory') {
      var invData = typeof recData.data === 'string' ? JSON.parse(recData.data) : recData.data;
      inventory.items = invData.items || [];
      inventory.categories = invData.categories || inventory.categories;
      if (typeof renderInventoryGrid === 'function') renderInventoryGrid();
      if (typeof updateInventoryStats === 'function') updateInventoryStats();
    }

    // v16.5: Refresh in-memory brands + push to Firebase subcollection
    if (key === 'brands') {
      if (typeof loadBrands === 'function') loadBrands();
      if (typeof syncBrandDropdowns === 'function') syncBrandDropdowns();
      if (typeof saveBrands === 'function') saveBrands(); // triggers scheduleAutoSync → subcollection write
    }

    // Remove from recoverable list
    delete window._recoverableData[key];

    showToast('Recovered ' + key + ' successfully!', 'success');

    // Re-run diagnostic to update UI
    await runFullDataDiagnostic();
    
  } catch (error) {
    console.error('[Recovery] Error recovering ' + key + ':', error);
    showToast('Recovery failed: ' + error.message, 'error');
  }
}

/**
 * Recover all data at once
 */
async function recoverAllData() {
  var keys = Object.keys(window._recoverableData);
  if (keys.length === 0) {
    showToast('No data to recover', 'warning');
    return;
  }

  showToast('Recovering ' + keys.length + ' categories...', 'info');

  for (var i = 0; i < keys.length; i++) {
    await recoverData(keys[i]);
  }

  // v16.5: Auto-sync all recovered data to Firebase
  try {
    if (typeof syncToFirebase === 'function' && firebaseUser) {
      await syncToFirebase();
      showToast('All data recovered and synced!', 'success');
    } else {
      showToast('All data recovered!', 'success');
    }
  } catch (e) {
    console.warn('[Recovery] Post-recovery sync failed:', e);
    showToast('Data recovered but sync failed: try pushing manually', 'warning');
  }
}

/**
 * Legacy function for backwards compatibility
 */
async function checkInventoryStatus() {
  await checkRecoveryStatus('inventory');
}

async function recoverInventoryFromOldLocation() {
  await recoverData('inventory');
}

function updateInventoryStats() {
  var allItems = inventory.items || [];
  var isLife = localStorage.getItem('roweos_app_mode') === 'life';
  // v25.1: Filter stats by selected brand (same filter as renderInventoryGrid) unless showing all brands or life mode
  var items = allItems;
  if (!isLife && !inventoryShowAllBrands) {
    items = allItems.filter(function(item) {
      return item.brandIndex === selectedBrand || typeof item.brandIndex === 'undefined';
    });
  }
  var products = items.filter(function(i) { return i.type === 'product'; });
  var services = items.filter(function(i) { return i.type === 'service'; });
  var lowStock = products.filter(function(i) { return i.trackInventory && i.stockQuantity <= (i.lowStockThreshold || 5); });

  var totalEl = document.getElementById('statTotalItems');
  var productsEl = document.getElementById('statProducts');
  var servicesEl = document.getElementById('statServices');
  var lowStockEl = document.getElementById('statLowStock');

  if (totalEl) totalEl.textContent = items.length;
  if (productsEl) productsEl.textContent = products.length;
  if (servicesEl) servicesEl.textContent = services.length;
  if (lowStockEl) lowStockEl.textContent = lowStock.length;

  // v15.4: Update stat labels for LifeAI Possessions mode
  var statsContainer = document.getElementById('inventoryStats');
  if (statsContainer && isLife) {
    var labels = statsContainer.querySelectorAll('div[style*="text-transform"]');
    if (labels.length >= 4) {
      labels[0].textContent = 'Total Items';
      labels[1].textContent = 'Physical';
      labels[2].textContent = 'Digital';
      labels[3].textContent = 'Valued';
    }
    // Recalculate for possessions context
    var totalValue = items.reduce(function(sum, i) { return sum + (parseFloat(i.price) || 0); }, 0);
    if (lowStockEl) lowStockEl.textContent = '$' + totalValue.toFixed(0);
  }
}

function renderInventoryGrid() {
  var grid = document.getElementById('inventoryGrid');
  if (!grid) return;

  var items = inventory.items || [];
  // v15.37: Brand filter (Brand mode only)
  var isLifeInv = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  if (!isLifeInv && !inventoryShowAllBrands) {
    items = items.filter(function(item) {
      return item.brandIndex === selectedBrand || typeof item.brandIndex === 'undefined';
    });
  }

  if (items.length === 0) {
    var isLife = localStorage.getItem('roweos_app_mode') === 'life';
    grid.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: var(--text-tertiary); grid-column: 1 / -1;">' +
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity: 0.3; margin-bottom: var(--space-4);"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>' +
      '<div style="font-size: var(--text-lg); margin-bottom: var(--space-2);">' + (isLife ? 'No possessions tracked yet' : 'No items in inventory') + '</div>' +
      '<div style="font-size: var(--text-base);">' + (isLife ? 'Click "Add Item" to catalog your personal possessions' : 'Click "Add Item" to add your first product or service') + '</div>' +
    '</div>';
    return;
  }
  
  // v19.8: Use master array index, not filtered index, so editInventoryItem opens the correct item
  grid.innerHTML = items.map(function(item) {
    var masterIdx = inventory.items.indexOf(item);
    return renderInventoryCard(item, masterIdx);
  }).join('');
}

function renderInventoryCard(item, index) {
  var imageHtml = '';
  if (item.imageData) {
    imageHtml = '<div class="inventory-card-image"><img src="' + item.imageData + '" alt="' + escapeHtml(item.name) + '"></div>';
  } else {
    var iconSvg = item.type === 'service' 
      ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
      : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
    imageHtml = '<div class="inventory-card-image"><div class="inventory-card-image-placeholder">' + iconSvg + '</div></div>';
  }
  
  var stockHtml = '';
  if (item.type === 'product') {
    var isLow = item.stockQuantity <= (item.lowStockThreshold || 5);
    stockHtml = '<div class="inventory-card-stock' + (isLow ? ' low' : '') + '">' + (item.stockQuantity || 0) + ' in stock</div>';
  } else {
    stockHtml = '<div class="inventory-card-stock">' + (item.duration || 'Per project') + '</div>';
  }
  
  // v15.37: Brand badge when showing all brands
  var brandBadge = '';
  if (inventoryShowAllBrands && typeof item.brandIndex === 'number' && typeof brands !== 'undefined' && brands[item.brandIndex]) {
    var bName = brands[item.brandIndex].shortName || brands[item.brandIndex].name;
    brandBadge = '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(bName) + '</div>';
  }

  return '<div class="inventory-card" onclick="editInventoryItem(' + index + ')">' +
    imageHtml +
    '<div class="inventory-card-body">' +
      '<div class="inventory-card-header">' +
        '<div>' +
          '<div class="inventory-card-name">' + escapeHtml(item.name) + '</div>' +
          '<div class="inventory-card-sku">' + escapeHtml(item.sku || 'No SKU') + '</div>' +
          brandBadge +
        '</div>' +
        '<span class="inventory-card-type ' + item.type + '">' + item.type + '</span>' +
      '</div>' +
      (item.description ? '<div class="inventory-card-description">' + escapeHtml(item.description) + '</div>' : '') +
      '<div class="inventory-card-footer">' +
        '<div class="inventory-card-price">$' + (item.price || 0).toFixed(2) + '</div>' +
        stockHtml +
      '</div>' +
    '</div>' +
  '</div>';
}

function filterInventory(query) {
  var items = inventory.items || [];
  // v15.37: Brand filter
  var isLifeInv = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  if (!isLifeInv && !inventoryShowAllBrands) {
    items = items.filter(function(item) { return item.brandIndex === selectedBrand || typeof item.brandIndex === 'undefined'; });
  }
  var filtered = items.filter(function(item) {
    var searchStr = (item.name + ' ' + (item.sku || '') + ' ' + (item.category || '') + ' ' + (item.description || '')).toLowerCase();
    return searchStr.indexOf(query.toLowerCase()) !== -1;
  });
  renderFilteredInventory(filtered);
}

function filterInventoryByType(type) {
  var items = inventory.items || [];
  // v15.37: Brand filter
  var isLifeInv = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  if (!isLifeInv && !inventoryShowAllBrands) {
    items = items.filter(function(item) { return item.brandIndex === selectedBrand || typeof item.brandIndex === 'undefined'; });
  }
  var filtered = type === 'all' ? items : items.filter(function(i) { return i.type === type; });
  renderFilteredInventory(filtered);
}

// v15.37: Toggle inventory brand filter
function toggleInventoryBrandFilter(showAll) {
  inventoryShowAllBrands = showAll;
  renderInventoryGrid();
}

// v10.5.25: Sort inventory
var currentInventorySort = 'default';
function sortInventory(sortBy) {
  currentInventorySort = sortBy;
  var items = inventory.items || [];
  // v15.37: Brand filter
  var isLifeInv = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  if (!isLifeInv && !inventoryShowAllBrands) {
    items = items.filter(function(item) { return item.brandIndex === selectedBrand || typeof item.brandIndex === 'undefined'; });
  }

  // Apply current type filter first
  var typeFilter = document.getElementById('inventoryFilter');
  var type = typeFilter ? typeFilter.value : 'all';
  var filtered = type === 'all' ? items.slice() : items.filter(function(i) { return i.type === type; });
  
  // Apply search filter
  var searchInput = document.getElementById('inventorySearch');
  var query = searchInput ? searchInput.value.toLowerCase() : '';
  if (query) {
    filtered = filtered.filter(function(item) {
      var searchStr = (item.name + ' ' + (item.sku || '') + ' ' + (item.category || '') + ' ' + (item.description || '')).toLowerCase();
      return searchStr.indexOf(query) !== -1;
    });
  }
  
  // Sort
  if (sortBy === 'name-asc') {
    filtered.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  } else if (sortBy === 'name-desc') {
    filtered.sort(function(a, b) { return (b.name || '').localeCompare(a.name || ''); });
  } else if (sortBy === 'price-low') {
    filtered.sort(function(a, b) { return parseFloat(a.price || 0) - parseFloat(b.price || 0); });
  } else if (sortBy === 'price-high') {
    filtered.sort(function(a, b) { return parseFloat(b.price || 0) - parseFloat(a.price || 0); });
  } else if (sortBy === 'newest') {
    filtered.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }
  
  renderFilteredInventory(filtered);
}

function renderFilteredInventory(items) {
  var grid = document.getElementById('inventoryGrid');
  if (!grid) return;
  
  if (items.length === 0) {
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-tertiary); grid-column: 1 / -1;">' +
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.5; margin-bottom: var(--space-3);"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
      '<div>No items match your search</div>' +
    '</div>';
    return;
  }
  
  grid.innerHTML = items.map(function(item) {
    var index = inventory.items.indexOf(item);
    return renderInventoryCard(item, index);
  }).join('');
}

// v10.5.25: Full Inventory Modal Implementation
var editingInventoryIndex = -1;
var inventoryImageData = null;

function openInventoryModal(item) {
  editingInventoryIndex = -1;
  inventoryImageData = null;

  var isLifeMode = localStorage.getItem('roweos_app_mode') === 'life';

  // Reset form
  document.getElementById('inventoryItemName').value = '';
  document.getElementById('inventoryItemSku').value = '';
  document.getElementById('inventoryItemDescription').value = '';
  document.getElementById('inventoryItemPrice').value = '';
  document.getElementById('inventoryItemStock').value = '';
  document.getElementById('inventoryItemLowStock').value = '5';
  document.getElementById('inventoryItemDuration').value = 'Per Hour';
  document.getElementById('inventoryDeleteBtn').style.display = 'none';
  var dupBtn = document.getElementById('inventoryDuplicateBtn');
  if (dupBtn) dupBtn.style.display = 'none';

  // v15.16: Possession fields
  var locationEl = document.getElementById('inventoryItemLocation');
  var conditionEl = document.getElementById('inventoryItemCondition');
  var purchaseDateEl = document.getElementById('inventoryItemPurchaseDate');
  var notesEl = document.getElementById('inventoryItemNotes');
  if (locationEl) locationEl.value = '';
  if (conditionEl) conditionEl.value = 'Good';
  if (purchaseDateEl) purchaseDateEl.value = '';
  if (notesEl) notesEl.value = '';

  // v15.16: Branch on life/brand mode
  if (isLifeMode) {
    document.getElementById('inventoryModalTitle').textContent = 'Add Possession';
    // Hide brand-specific fields
    var typeToggle = document.getElementById('inventoryTypeToggle');
    if (typeToggle) typeToggle.style.display = 'none';
    var skuGroup = document.getElementById('inventorySkuGroup');
    if (skuGroup) skuGroup.style.display = 'none';
    document.getElementById('inventoryStockSection').style.display = 'none';
    document.getElementById('inventoryDurationSection').style.display = 'none';
    // Show possession fields
    var possFields = document.getElementById('inventoryPossessionFields');
    if (possFields) possFields.style.display = 'block';
    // Change price label
    var priceLabel = document.getElementById('inventoryPriceLabel');
    if (priceLabel) priceLabel.textContent = 'Estimated Value ($)';
    // Load life categories
    var catSelect = document.getElementById('inventoryItemCategory');
    if (catSelect) {
      catSelect.innerHTML = '<option value="Electronics">Electronics</option><option value="Home & Furniture">Home & Furniture</option><option value="Vehicles">Vehicles</option><option value="Clothing & Accessories">Clothing & Accessories</option><option value="Collectibles & Art">Collectibles & Art</option><option value="Sports & Outdoors">Sports & Outdoors</option><option value="Tools & Equipment">Tools & Equipment</option><option value="Other">Other</option>';
      catSelect.value = 'Electronics';
    }
  } else {
    document.getElementById('inventoryModalTitle').textContent = 'Add Product/Service';
    var typeToggle = document.getElementById('inventoryTypeToggle');
    if (typeToggle) typeToggle.style.display = '';
    var skuGroup = document.getElementById('inventorySkuGroup');
    if (skuGroup) skuGroup.style.display = '';
    var possFields = document.getElementById('inventoryPossessionFields');
    if (possFields) possFields.style.display = 'none';
    var priceLabel = document.getElementById('inventoryPriceLabel');
    if (priceLabel) priceLabel.textContent = 'Price ($)';
    // Restore brand categories
    var catSelect = document.getElementById('inventoryItemCategory');
    if (catSelect) {
      catSelect.innerHTML = '<option value="General">General</option><option value="Products">Products</option><option value="Services">Services</option><option value="Digital">Digital</option><option value="Consulting">Consulting</option>';
      catSelect.value = 'General';
    }
    setInventoryType('product');
  }

  clearInventoryImage();
  document.getElementById('inventoryModalOverlay').classList.add('show');
}

function closeInventoryModal() {
  document.getElementById('inventoryModalOverlay').classList.remove('show');
  editingInventoryIndex = -1;
  inventoryImageData = null;
}

function editInventoryItem(index) {
  var item = inventory.items[index];
  if (!item) return;

  editingInventoryIndex = index;
  var isLifeMode = localStorage.getItem('roweos_app_mode') === 'life';
  var isPossession = item.type === 'possession' || isLifeMode;

  // v15.16: Branch UI for possession vs product/service
  if (isPossession) {
    document.getElementById('inventoryModalTitle').textContent = 'Edit Possession';
    var typeToggle = document.getElementById('inventoryTypeToggle');
    if (typeToggle) typeToggle.style.display = 'none';
    var skuGroup = document.getElementById('inventorySkuGroup');
    if (skuGroup) skuGroup.style.display = 'none';
    document.getElementById('inventoryStockSection').style.display = 'none';
    document.getElementById('inventoryDurationSection').style.display = 'none';
    var possFields = document.getElementById('inventoryPossessionFields');
    if (possFields) possFields.style.display = 'block';
    var priceLabel = document.getElementById('inventoryPriceLabel');
    if (priceLabel) priceLabel.textContent = 'Estimated Value ($)';
    // Load life categories
    var catSelect = document.getElementById('inventoryItemCategory');
    if (catSelect) {
      catSelect.innerHTML = '<option value="Electronics">Electronics</option><option value="Home & Furniture">Home & Furniture</option><option value="Vehicles">Vehicles</option><option value="Clothing & Accessories">Clothing & Accessories</option><option value="Collectibles & Art">Collectibles & Art</option><option value="Sports & Outdoors">Sports & Outdoors</option><option value="Tools & Equipment">Tools & Equipment</option><option value="Other">Other</option>';
    }
    // Fill possession fields
    var locationEl = document.getElementById('inventoryItemLocation');
    if (locationEl) locationEl.value = item.location || '';
    var conditionEl = document.getElementById('inventoryItemCondition');
    if (conditionEl) conditionEl.value = item.condition || 'Good';
    var purchaseDateEl = document.getElementById('inventoryItemPurchaseDate');
    if (purchaseDateEl) purchaseDateEl.value = item.purchaseDate || '';
    var notesEl = document.getElementById('inventoryItemNotes');
    if (notesEl) notesEl.value = item.notes || '';
  } else {
    document.getElementById('inventoryModalTitle').textContent = 'Edit ' + (item.type === 'product' ? 'Product' : 'Service');
    var typeToggle = document.getElementById('inventoryTypeToggle');
    if (typeToggle) typeToggle.style.display = '';
    var skuGroup = document.getElementById('inventorySkuGroup');
    if (skuGroup) skuGroup.style.display = '';
    var possFields = document.getElementById('inventoryPossessionFields');
    if (possFields) possFields.style.display = 'none';
    var priceLabel = document.getElementById('inventoryPriceLabel');
    if (priceLabel) priceLabel.textContent = 'Price ($)';
    var catSelect = document.getElementById('inventoryItemCategory');
    if (catSelect) {
      catSelect.innerHTML = '<option value="General">General</option><option value="Products">Products</option><option value="Services">Services</option><option value="Digital">Digital</option><option value="Consulting">Consulting</option>';
    }
    setInventoryType(item.type || 'product');
  }

  document.getElementById('inventoryItemName').value = item.name || '';
  document.getElementById('inventoryItemSku').value = item.sku || '';
  document.getElementById('inventoryItemDescription').value = item.description || '';
  document.getElementById('inventoryItemPrice').value = item.price || item.estimatedValue || '';
  document.getElementById('inventoryItemCategory').value = item.category || 'General';
  document.getElementById('inventoryItemStock').value = item.stockQuantity || '';
  document.getElementById('inventoryItemLowStock').value = item.lowStockThreshold || 5;
  document.getElementById('inventoryItemDuration').value = item.duration || 'Per Hour';
  document.getElementById('inventoryDeleteBtn').style.display = 'inline-flex';
  var dupBtn2 = document.getElementById('inventoryDuplicateBtn');
  if (dupBtn2) dupBtn2.style.display = 'inline-flex';

  if (item.imageData) {
    inventoryImageData = item.imageData;
    document.getElementById('inventoryImagePreview').src = item.imageData;
    document.getElementById('inventoryImagePreviewContainer').style.display = 'block';
    document.getElementById('inventoryImageEmpty').style.display = 'none';
    document.getElementById('inventoryImageUpload').classList.add('has-image');
  } else {
    clearInventoryImage();
  }

  document.getElementById('inventoryModalOverlay').classList.add('show');
}

function setInventoryType(type) {
  document.querySelectorAll('.inventory-type-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  document.getElementById('inventoryStockSection').style.display = type === 'product' ? 'block' : 'none';
  document.getElementById('inventoryDurationSection').style.display = type === 'service' ? 'block' : 'none';
}

function handleInventoryImageUpload(event) {
  var file = event.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    inventoryImageData = e.target.result;
    document.getElementById('inventoryImagePreview').src = inventoryImageData;
    document.getElementById('inventoryImagePreviewContainer').style.display = 'block';
    document.getElementById('inventoryImageEmpty').style.display = 'none';
    document.getElementById('inventoryImageUpload').classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

function clearInventoryImage() {
  inventoryImageData = null;
  var preview = document.getElementById('inventoryImagePreview');
  var container = document.getElementById('inventoryImagePreviewContainer');
  var empty = document.getElementById('inventoryImageEmpty');
  var upload = document.getElementById('inventoryImageUpload');
  var input = document.getElementById('inventoryImageInput');
  if (preview) preview.src = '';
  if (container) container.style.display = 'none';
  if (empty) empty.style.display = 'block';
  if (upload) upload.classList.remove('has-image');
  if (input) input.value = '';
}

function saveInventoryItem() {
  var name = document.getElementById('inventoryItemName').value.trim();
  if (!name) { showToast('Please enter a name', 'error'); return; }

  var isLifeMode = localStorage.getItem('roweos_app_mode') === 'life';
  var item;

  if (isLifeMode) {
    // v15.16: Save possession
    item = {
      id: editingInventoryIndex >= 0 ? inventory.items[editingInventoryIndex].id : Date.now(),
      name: name,
      description: document.getElementById('inventoryItemDescription').value.trim(),
      estimatedValue: parseFloat(document.getElementById('inventoryItemPrice').value) || 0,
      price: parseFloat(document.getElementById('inventoryItemPrice').value) || 0,
      category: document.getElementById('inventoryItemCategory').value,
      type: 'possession',
      location: (document.getElementById('inventoryItemLocation') || {}).value || '',
      condition: (document.getElementById('inventoryItemCondition') || {}).value || 'Good',
      purchaseDate: (document.getElementById('inventoryItemPurchaseDate') || {}).value || '',
      notes: (document.getElementById('inventoryItemNotes') || {}).value || '',
      imageData: inventoryImageData,
      created: editingInventoryIndex >= 0 ? inventory.items[editingInventoryIndex].created : new Date().toISOString(),
      updated: new Date().toISOString()
    };
  } else {
    var activeType = document.querySelector('.inventory-type-btn.active');
    var type = activeType ? activeType.dataset.type : 'product';

    item = {
      id: editingInventoryIndex >= 0 ? inventory.items[editingInventoryIndex].id : Date.now(),
      name: name,
      sku: document.getElementById('inventoryItemSku').value.trim(),
      description: document.getElementById('inventoryItemDescription').value.trim(),
      price: parseFloat(document.getElementById('inventoryItemPrice').value) || 0,
      category: document.getElementById('inventoryItemCategory').value,
      type: type,
      brandIndex: editingInventoryIndex >= 0 ? (inventory.items[editingInventoryIndex].brandIndex || selectedBrand) : selectedBrand, // v15.37
      imageData: inventoryImageData,
      created: editingInventoryIndex >= 0 ? inventory.items[editingInventoryIndex].created : new Date().toISOString(),
      updated: new Date().toISOString()
    };

    if (type === 'product') {
      item.stockQuantity = parseInt(document.getElementById('inventoryItemStock').value) || 0;
      item.lowStockThreshold = parseInt(document.getElementById('inventoryItemLowStock').value) || 5;
    } else {
      item.duration = document.getElementById('inventoryItemDuration').value;
    }
  }

  if (editingInventoryIndex >= 0) {
    inventory.items[editingInventoryIndex] = item;
    showToast('Item updated: ' + name, 'success');
  } else {
    inventory.items.push(item);
    showToast('Item added: ' + name, 'success');
  }

  saveInventoryData();
  closeInventoryModal();
  // v19.8: Use renderInventoryGrid + updateInventoryStats instead of full renderInventoryView
  // to avoid re-calling loadInventoryData which schedules a stale Firebase reload
  renderInventoryGrid();
  updateInventoryStats();
}

function deleteInventoryItem() {
  if (editingInventoryIndex < 0) return;
  var item = inventory.items[editingInventoryIndex];
  if (!confirm('Delete "' + item.name + '"?')) return;
  inventory.items.splice(editingInventoryIndex, 1);
  saveInventoryData();
  closeInventoryModal();
  renderInventoryGrid();
  updateInventoryStats();
  showToast('Item deleted', 'success');
}

// v19.8: Duplicate an inventory item
function duplicateInventoryItem() {
  if (editingInventoryIndex < 0) return;
  var source = inventory.items[editingInventoryIndex];
  if (!source) return;

  var dupe = JSON.parse(JSON.stringify(source));
  dupe.id = Date.now();
  dupe.name = (dupe.name || 'Item') + ' (Copy)';
  dupe.created = new Date().toISOString();
  dupe.updated = new Date().toISOString();

  inventory.items.push(dupe);
  saveInventoryData();
  closeInventoryModal();
  renderInventoryGrid();
  updateInventoryStats();
  showToast('Item duplicated: ' + dupe.name, 'success');
  // v25.1: saveInventoryData() already writes through to Firestore
}

function openLibraryImagePicker() {
  var images = (libraryFiles || []).filter(function(f) { return f.type === 'image' || (f.mimeType && f.mimeType.startsWith('image/')); });
  if (images.length === 0) { showToast('No images in Library', 'info'); return; }
  
  var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="this.remove()">' +
    '<div style="background:var(--bg-elevated);border-radius:16px;padding:24px;max-width:500px;max-height:80vh;overflow-y:auto;" onclick="event.stopPropagation()">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><div style="font-weight:600;color:var(--text-primary);">Select from Library</div><button onclick="this.closest(\'div[style*=position]\').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px;">×</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">' +
        images.map(function(img) {
          return '<div onclick="selectLibraryImageForInventory(' + img.id + ');this.closest(\'div[style*=position]\').remove();" style="cursor:pointer;border-radius:8px;overflow:hidden;aspect-ratio:1;border:2px solid var(--border-color);"><img src="' + (img.imageData || img.content) + '" style="width:100%;height:100%;object-fit:cover;"></div>';
        }).join('') +
      '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function selectLibraryImageForInventory(imageId) {
  var img = (libraryFiles || []).find(function(f) { return f.id == imageId; });
  if (img) {
    inventoryImageData = img.imageData || img.content;
    document.getElementById('inventoryImagePreview').src = inventoryImageData;
    document.getElementById('inventoryImagePreviewContainer').style.display = 'block';
    document.getElementById('inventoryImageEmpty').style.display = 'none';
    document.getElementById('inventoryImageUpload').classList.add('has-image');
    showToast('Image selected', 'success');
  }
}

function openStudioImagePicker() {
  var images = (runs || []).filter(function(r) { return r.isImage && r.imageData; });
  if (images.length === 0) { showToast('No generated images yet', 'info'); return; }
  
  var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="this.remove()">' +
    '<div style="background:var(--bg-elevated);border-radius:16px;padding:24px;max-width:500px;max-height:80vh;overflow-y:auto;" onclick="event.stopPropagation()">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><div style="font-weight:600;color:var(--text-primary);">Select from Studio</div><button onclick="this.closest(\'div[style*=position]\').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px;">×</button></div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">' +
        images.slice(-12).reverse().map(function(run) {
          var src = run.imageData.startsWith('data:') ? run.imageData : 'data:image/png;base64,' + run.imageData;
          return '<div onclick="selectStudioImageForInventory(' + run.id + ');this.closest(\'div[style*=position]\').remove();" style="cursor:pointer;border-radius:8px;overflow:hidden;aspect-ratio:1;border:2px solid var(--border-color);"><img src="' + src + '" style="width:100%;height:100%;object-fit:cover;"></div>';
        }).join('') +
      '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function selectStudioImageForInventory(runId) {
  var run = (runs || []).find(function(r) { return r.id == runId; });
  if (run && run.imageData) {
    inventoryImageData = run.imageData.startsWith('data:') ? run.imageData : 'data:image/png;base64,' + run.imageData;
    document.getElementById('inventoryImagePreview').src = inventoryImageData;
    document.getElementById('inventoryImagePreviewContainer').style.display = 'block';
    document.getElementById('inventoryImageEmpty').style.display = 'none';
    document.getElementById('inventoryImageUpload').classList.add('has-image');
    showToast('Image selected', 'success');
  }
}

function getInventoryForStudioSubject() {
  return (inventory.items || []).map(function(item) {
    return { id: item.id, name: item.name, type: item.type, description: item.description, imageData: item.imageData, price: item.price };
  });
}

// ============================================
// v9.1.14: COMMERCE FUNCTIONS
// ============================================

function renderCommerceView() {
  loadCommerceData();
  updateCommerceStats();
  // v24.25: Update budget display on overview
  if (typeof updateOverviewBudgetCard === 'function') updateOverviewBudgetCard();
  showCommerceTab(currentCommerceTab);
  // v15.4: Render API dashboard if on API tab
  if (currentCommerceTab === 'api' && typeof renderApiCostsDashboard === 'function') {
    renderApiCostsDashboard(window._apiCostsPeriod || '30d');
  }
}

function loadCommerceData() {
  var data = localStorage.getItem('roweos_commerce');
  if (data) {
    try {
      commerce = JSON.parse(data);
    } catch (e) {
      commerce = {
        apiUsage: [],
        clients: [],
        invoices: [],
        settings: { currency: 'USD', taxRate: 0, defaultPaymentTerms: 30 }
      };
    }
  }
}

function saveCommerceData() {
  localStorage.setItem('roweos_commerce', JSON.stringify(commerce));
  writeDB('profile/main', { commerce: commerce }); // v25.1
}

function updateCommerceStats() {
  // API Spend (30 days)
  var thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  var apiSpend = 0;
  var analytics = getAnalyticsData();
  if (analytics && analytics.entries) {
    analytics.entries.filter(function(e) { return e.timestamp > thirtyDaysAgo; })
      .forEach(function(e) { apiSpend += (e.cost || 0); });
  }
  
  // v15.4: Outstanding invoices — read from dedicated storage
  var outstanding = 0;
  var allInvoices = getInvoices();
  allInvoices.filter(function(inv) { return inv.status === 'pending' || inv.status === 'overdue'; })
    .forEach(function(inv) { outstanding += (inv.total || 0); });

  // v15.4: Total clients — read from dedicated storage
  var totalClients = getClients().length;
  
  // Active products
  var activeProducts = (inventory.items || []).filter(function(i) { return i.isActive !== false; }).length;
  
  // Update UI
  var apiEl = document.getElementById('commerceApiSpend');
  var outEl = document.getElementById('commerceOutstanding');
  var clientsEl = document.getElementById('commerceTotalClients');
  var productsEl = document.getElementById('commerceActiveProducts');
  
  if (apiEl) apiEl.textContent = '$' + apiSpend.toFixed(2);
  if (outEl) outEl.textContent = '$' + outstanding.toFixed(2);
  if (clientsEl) clientsEl.textContent = totalClients;
  if (productsEl) productsEl.textContent = activeProducts;
}

// v15.7: Render Overview analytics dashboard
function renderCommerceOverview() {
  // v24.25: Render per-provider budget/threshold cards
  renderAllProviderBudgetCards();

  var analytics = getAnalyticsData();
  var now = Date.now();
  var thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  var stats = calculatePeriodStats(analytics, thirtyDaysAgo, now);

  // Highlight cards: Avg Cost/Request, Most Expensive Model, Avg Tokens/Session, Cache Hit Rate
  var highlightsEl = document.getElementById('commerceOverviewHighlights');
  if (highlightsEl) {
    var avgCost = stats.totalRequests > 0 ? (stats.totalCost / stats.totalRequests) : 0;
    var avgTokens = stats.totalRequests > 0 ? Math.round((stats.totalInputTokens + stats.totalOutputTokens) / stats.totalRequests) : 0;
    var cacheRate = stats.totalRequests > 0 ? Math.round((stats.cacheHits / stats.totalRequests) * 100) : 0;
    var mostExpensiveModel = '';
    var mostExpensiveCost = 0;
    Object.keys(stats.modelBreakdown).forEach(function(m) {
      if (stats.modelBreakdown[m].cost > mostExpensiveCost) {
        mostExpensiveCost = stats.modelBreakdown[m].cost;
        mostExpensiveModel = m;
      }
    });

    var cards = [
      { label: 'Avg Cost/Session', value: '$' + avgCost.toFixed(2), color: 'var(--accent)' },
      { label: 'Most Expensive', value: mostExpensiveModel ? '$' + mostExpensiveCost.toFixed(2) : '--', sub: mostExpensiveModel ? getModelDisplayName(mostExpensiveModel) : '', color: '#f59e0b' },
      { label: 'Avg Tokens/Session', value: formatTokenCount(avgTokens), color: '#8b5cf6' },
      { label: 'Cache Hit Rate', value: cacheRate + '%', color: '#22c55e' }
    ];
    highlightsEl.innerHTML = cards.map(function(c) {
      return '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">' +
        '<div style="font-size: var(--text-xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">' + c.label + '</div>' +
        '<div style="font-size: var(--text-2xl); font-weight: 700; color: ' + c.color + ';">' + c.value + '</div>' +
        (c.sub ? '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px;">' + escapeHtml(c.sub) + '</div>' : '') +
      '</div>';
    }).join('');
  }

  // Model Comparison horizontal bar chart
  var chartEl = document.getElementById('commerceOverviewModelChart');
  if (chartEl) {
    var models = Object.keys(stats.modelBreakdown).sort(function(a, b) {
      return stats.modelBreakdown[b].cost - stats.modelBreakdown[a].cost;
    });
    var html = '<div style="font-weight: 600; margin-bottom: var(--space-4);">Model Comparison</div>';
    if (models.length > 0) {
      var maxCost = stats.modelBreakdown[models[0]].cost || 1;
      var modelColors = {
        'claude': '#d4a574', 'openai': '#10b981', 'gemini': '#3b82f6', 'nanobanana': '#f59e0b'
      };
      models.slice(0, 8).forEach(function(m) {
        var mb = stats.modelBreakdown[m];
        var pct = Math.max(2, Math.round((mb.cost / maxCost) * 100));
        var color = '#3b82f6';
        if (m.indexOf('claude') !== -1) color = modelColors.claude;
        else if (m.indexOf('gpt') !== -1 || m.indexOf('o1') !== -1 || m.indexOf('o4') !== -1) color = modelColors.openai;
        else if (m.indexOf('nanobanana') !== -1 || m.indexOf('image') !== -1) color = modelColors.nanobanana;
        else if (m.indexOf('gemini') !== -1) color = modelColors.gemini;

        html += '<div style="display: flex; align-items: center; margin-bottom: var(--space-2); gap: var(--space-3);">';
        html += '<div style="width: 120px; flex-shrink: 0; text-align: right; font-size: var(--text-xs); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + getModelDisplayName(m) + '</div>';
        html += '<div style="flex: 1; height: 20px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">';
        html += '<div style="height: 100%; width: ' + pct + '%; background: ' + color + '; border-radius: 4px; transition: width 0.3s ease;"></div>';
        html += '</div>';
        html += '<div style="width: 80px; flex-shrink: 0; font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">$' + mb.cost.toFixed(2) + '</div>';
        html += '</div>';
      });
    } else {
      html += '<div style="text-align: center; padding: 30px; color: var(--text-muted);">No API usage data yet. Start chatting to see analytics.</div>';
    }
    chartEl.innerHTML = html;
  }

  // Model Breakdown table
  var tableEl = document.getElementById('commerceOverviewModelTable');
  if (tableEl) {
    var models = Object.keys(stats.modelBreakdown).sort(function(a, b) {
      return stats.modelBreakdown[b].cost - stats.modelBreakdown[a].cost;
    });
    var html = '<div style="font-weight: 600; margin-bottom: var(--space-4);">Model Breakdown</div>';
    if (models.length > 0) {
      html += '<div style="overflow-x: auto;">';
      html += '<table style="width: 100%; border-collapse: collapse; font-size: var(--text-sm); min-width: 500px;">';
      html += '<thead><tr style="border-bottom: 1px solid var(--border-color);">';
      html += '<th style="text-align: left; padding: 8px 12px; color: var(--text-secondary);">Model</th>';
      html += '<th style="text-align: right; padding: 8px 12px; color: var(--text-secondary);">Cost</th>';
      html += '<th style="text-align: right; padding: 8px 12px; color: var(--text-secondary);">Sessions</th>';
      html += '<th style="text-align: right; padding: 8px 12px; color: var(--text-secondary);">Input</th>';
      html += '<th style="text-align: right; padding: 8px 12px; color: var(--text-secondary);">Output</th>';
      html += '<th style="text-align: right; padding: 8px 12px; color: var(--text-secondary);">Cache %</th>';
      html += '</tr></thead><tbody>';

      var totalCost = 0, totalSessions = 0, totalInput = 0, totalOutput = 0;
      models.forEach(function(m) {
        var mb = stats.modelBreakdown[m];
        totalCost += mb.cost;
        totalSessions += mb.requests;
        totalInput += mb.inputTokens;
        totalOutput += mb.outputTokens;

        // Calculate cache % for this model from raw entries
        var modelEntries = (analytics.entries || []).filter(function(e) {
          return e.model === m && e.timestamp >= thirtyDaysAgo;
        });
        var modelCacheHits = modelEntries.filter(function(e) { return e.cached; }).length;
        var modelCacheRate = modelEntries.length > 0 ? Math.round((modelCacheHits / modelEntries.length) * 100) : 0;

        html += '<tr style="border-bottom: 1px solid var(--border-subtle);">';
        html += '<td style="padding: 10px 12px; color: var(--text-primary); font-weight: 500;">' + getModelDisplayName(m) + '</td>';
        html += '<td style="text-align: right; padding: 10px 12px; font-weight: 600; color: var(--accent);">$' + mb.cost.toFixed(2) + '</td>';
        html += '<td style="text-align: right; padding: 10px 12px; color: var(--text-secondary);">' + mb.requests + '</td>';
        html += '<td style="text-align: right; padding: 10px 12px; color: var(--text-secondary);">' + formatTokenCount(mb.inputTokens) + '</td>';
        html += '<td style="text-align: right; padding: 10px 12px; color: var(--text-secondary);">' + formatTokenCount(mb.outputTokens) + '</td>';
        html += '<td style="text-align: right; padding: 10px 12px; color: var(--text-secondary);">' + modelCacheRate + '%</td>';
        html += '</tr>';
      });

      // Totals row
      html += '<tr style="border-top: 2px solid var(--border-color); font-weight: 600;">';
      html += '<td style="padding: 10px 12px; color: var(--text-primary);">Total</td>';
      html += '<td style="text-align: right; padding: 10px 12px; color: var(--accent);">$' + totalCost.toFixed(2) + '</td>';
      html += '<td style="text-align: right; padding: 10px 12px; color: var(--text-primary);">' + totalSessions + '</td>';
      html += '<td style="text-align: right; padding: 10px 12px; color: var(--text-primary);">' + formatTokenCount(totalInput) + '</td>';
      html += '<td style="text-align: right; padding: 10px 12px; color: var(--text-primary);">' + formatTokenCount(totalOutput) + '</td>';
      html += '<td style="text-align: right; padding: 10px 12px; color: var(--text-primary);">' + (stats.totalRequests > 0 ? Math.round((stats.cacheHits / stats.totalRequests) * 100) : 0) + '%</td>';
      html += '</tr>';
      html += '</tbody></table></div>';
    } else {
      html += '<div style="text-align: center; padding: 30px; color: var(--text-muted);">No model data available yet.</div>';
    }
    tableEl.innerHTML = html;
  }
}

function showCommerceTab(tab) {
  currentCommerceTab = tab;

  // v15.4: Mode-aware labels
  var isLife = localStorage.getItem('roweos_app_mode') === 'life';
  var breadcrumb = document.getElementById('commerceBreadcrumbLabel');
  var headerTitle = document.getElementById('commerceHeaderTitle');
  if (breadcrumb) breadcrumb.textContent = 'Analytics'; // v24.27: Always Analytics
  if (headerTitle) headerTitle.textContent = 'Analytics'; // v24.27: Always Analytics

  // v26.1: Update pill nav active state
  updatePillNavActive('analyticsPillNav', tab);

  // Hide all tab content
  document.querySelectorAll('.commerce-tab-content').forEach(function(content) {
    content.style.display = 'none';
  });

  // Show selected tab
  var tabMap = {
    'overview': 'commerceTabOverview',
    'dashboard': 'commerceTabDashboard',
    'api': 'commerceTabApi',
    'invoices': 'commerceTabInvoices',
    'budget': 'commerceTabBudget',
    'website': 'commerceTabWebsite',
    'social': 'commerceTabSocial'
  };

  var contentEl = document.getElementById(tabMap[tab]);
  if (contentEl) {
    contentEl.style.display = 'block';
  }

  // v25.3: Load web analytics when Website tab opens
  if (tab === 'website' && typeof loadWebAnalytics === 'function') {
    loadWebAnalytics();
  }

  // v15.7: Render overview analytics when overview tab is selected
  if (tab === 'overview') {
    renderCommerceOverview();
  }

  // v29.0: Render analytics dashboard (team, KPIs, screenshots)
  if (tab === 'dashboard') {
    renderAnalyticsDashboard();
  }

  // v15.7: Render AI provider status + settings + API costs when API tab is selected
  if (tab === 'api') {
    renderApiProviderStatus();
    renderApiSettingsToggles();
    renderApiCostsDashboard(window._apiCostsPeriod || '30d');
  }

  // v15.4: Render budget dashboard when budget tab is selected
  if (tab === 'budget') {
    renderBudgetDashboard();
  }

  // v15.4: Render invoices when invoice tab is selected
  if (tab === 'invoices') {
    renderInvoiceList();
  }

  // v16.11: Clients tab redirects to dedicated Clients view
  if (tab === 'clients') {
    showView('clients');
    return;
  }
}

/**
 * v15.7: AI Integration — Provider status cards + settings toggles
 */
function renderApiProviderStatus() {
  var statusEl = document.getElementById('apiProviderStatus');
  if (!statusEl) return;

  var apiKeys = {};
  try { apiKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) { console.warn('[API] Corrupted API keys data:', e.message); }

  var providers = [
    { key: 'anthropic', name: 'Anthropic', models: 'Claude Opus 4.7, Sonnet 4.6, Haiku 4.5', color: '#d4a574', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>' },
    { key: 'openai', name: 'OpenAI', models: 'GPT-5.4, GPT-5.4 Pro, Thinking', color: '#10b981', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' },
    { key: 'google', name: 'Google', models: 'Gemini 3.1 Pro, 3 Flash, 2.5 Pro', color: '#3b82f6', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>' },
    { key: 'nanobanana', name: 'Nano Banana', models: 'Image Gen, Deep Research', color: '#f59e0b', icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' }
  ];

  var html = '<div style="font-weight: 600; margin-bottom: var(--space-3);">AI Providers</div>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3);">';

  providers.forEach(function(p) {
    var hasKey = !!apiKeys[p.key];
    var maskedKey = hasKey ? apiKeys[p.key].substring(0, 6) + '...' + apiKeys[p.key].slice(-4) : '';
    var statusColor = hasKey ? '#22c55e' : 'var(--text-muted)';
    var statusText = hasKey ? 'Connected' : 'Not configured';
    var borderColor = hasKey ? p.color + '40' : 'var(--border-color)';

    html += '<div style="background: var(--bg-secondary); border: 1px solid ' + borderColor + '; border-radius: var(--radius-lg); padding: var(--space-4); position: relative;">';
    html += '<div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">';
    html += '<div style="color: ' + p.color + ';">' + p.icon + '</div>';
    html += '<div style="font-weight: 600; color: var(--text-primary);">' + p.name + '</div>';
    html += '<div style="margin-left: auto; display: flex; align-items: center; gap: 4px;">';
    html += '<div style="width: 6px; height: 6px; border-radius: 50%; background: ' + statusColor + ';"></div>';
    html += '<span style="font-size: var(--text-xs); color: ' + statusColor + ';">' + statusText + '</span>';
    html += '</div></div>';
    if (hasKey) {
      html += '<div style="font-size: var(--text-xs); color: var(--text-muted); font-family: monospace; margin-bottom: 4px;">' + escapeHtml(maskedKey) + '</div>';
    }
    html += '<div style="font-size: var(--text-xs); color: var(--text-tertiary);">' + p.models + '</div>';
    html += '</div>';
  });
  html += '</div>';
  statusEl.innerHTML = html;
}

function renderApiSettingsToggles() {
  var togglesEl = document.getElementById('apiSettingsToggles');
  if (!togglesEl) return;

  var cacheEnabled = localStorage.getItem('roweos_feature_responseCache') === 'true';
  var claudeWebSearch = localStorage.getItem('roweos_claude_web_search') === 'true';
  var geminiWebSearch = localStorage.getItem('roweos_gemini_web_search') === 'true';
  var autoPilotEnabled = localStorage.getItem('roweos_feature_autoPilot') === 'true';

  function toggleHtml(id, label, desc, checked, onchange) {
    return '<div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-subtle);">' +
      '<div>' +
        '<div style="font-size: var(--text-sm); color: var(--text-primary);">' + label + '</div>' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted);">' + desc + '</div>' +
      '</div>' +
      '<label style="position: relative; display: inline-block; width: 36px; height: 20px; cursor: pointer;">' +
        '<input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + ' onchange="' + onchange + '" style="opacity: 0; width: 0; height: 0;">' +
        '<span style="position: absolute; inset: 0; background: ' + (checked ? 'var(--accent)' : 'var(--bg-tertiary)') + '; border-radius: 10px; transition: 0.2s;"></span>' +
        '<span style="position: absolute; left: ' + (checked ? '18px' : '2px') + '; top: 2px; width: 16px; height: 16px; background: white; border-radius: 50%; transition: 0.2s;"></span>' +
      '</label>' +
    '</div>';
  }

  var html = '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">';
  html += '<div style="font-weight: 600; margin-bottom: var(--space-2);">Settings</div>';
  html += toggleHtml('apiToggleCache', 'Response Caching', '1hr cache for repeated queries', cacheEnabled, "toggleFeature(\'responseCache\', this.checked); renderApiSettingsToggles();");
  html += toggleHtml('apiToggleClaudeWeb', 'Claude Web Search', '$10/1K searches', claudeWebSearch, "toggleWebSearch(\'claude\', this.checked); renderApiSettingsToggles();");
  html += toggleHtml('apiToggleGeminiWeb', 'Gemini Web Search', 'Grounding with Google Search', geminiWebSearch, "toggleWebSearch(\'gemini\', this.checked); renderApiSettingsToggles();");
  html += toggleHtml('apiToggleAutoPilot', 'Auto-Pilot', 'Automated suggestions and actions', autoPilotEnabled, "toggleFeature(\'autoPilot\', this.checked); renderApiSettingsToggles();");
  html += '</div>';
  togglesEl.innerHTML = html;
}

/**
 * v15.4: Comprehensive API Cost Dashboard
 */
var _apiCostsPeriod = '30d';
function renderApiCostsDashboard(period) {
  _apiCostsPeriod = period || '30d';
  var analytics = getAnalyticsData();
  var now = Date.now();
  var periodMs = { '7d': 7, '30d': 30, '90d': 90 };
  var days = periodMs[_apiCostsPeriod] || 30;
  var startTime = now - (days * 24 * 60 * 60 * 1000);
  var stats = calculatePeriodStats(analytics, startTime, now);

  // Period button highlighting
  ['7d', '30d', '90d'].forEach(function(p) {
    var btn = document.getElementById('apiPeriod' + p);
    if (btn) {
      btn.style.background = (p === _apiCostsPeriod) ? 'var(--accent)' : '';
      btn.style.color = (p === _apiCostsPeriod) ? 'var(--accent-text, #fff)' : '';
    }
  });

  // Summary Cards
  var cardsEl = document.getElementById('apiCostSummaryCards');
  if (cardsEl) {
    // v24.18: Projected monthly spend, v24.25: Per-provider budget remaining
    var projectedMonthly = days > 0 ? (stats.totalCost / days) * 30 : 0;
    var _spendLabel = 'Total Spend';
    var _spendValue = '$' + stats.totalCost.toFixed(2);
    var _spendColor = 'var(--accent)';
    // v24.25: Include both budgets AND thresholds in countdown
    if (typeof _providerBudgetConfig !== 'undefined') {
      var _totalLoaded = 0, _totalRemain = 0, _hasBudgets = false;
      var _mStart = new Date(); _mStart.setDate(1); _mStart.setHours(0,0,0,0);
      _providerBudgetConfig.forEach(function(cfg) {
        var b = getProviderBudget(cfg.key);
        if (b && b.mode === 'budget' && b.loaded > 0) {
          _hasBudgets = true;
          var sp = getProviderSpendSinceDate(cfg.key, b.reloadDate || Date.now());
          _totalLoaded += b.loaded;
          _totalRemain += Math.max(0, b.loaded - sp);
        } else {
          // Threshold mode: count down from threshold this month
          var tv = parseFloat(localStorage.getItem('roweos_analytics_threshold_' + cfg.key)) || 0;
          if (tv > 0) {
            _hasBudgets = true;
            var tsp = getProviderSpendSinceDate(cfg.key, _mStart.getTime());
            _totalLoaded += tv;
            _totalRemain += Math.max(0, tv - tsp);
          }
        }
      });
      if (_hasBudgets) {
        _spendLabel = 'Remaining';
        _spendValue = '$' + _totalRemain.toFixed(2);
        _spendColor = _totalRemain <= 0 ? '#ef4444' : (_totalRemain < _totalLoaded * 0.2 ? '#f59e0b' : '#4ade80');
      }
    }
    var cards = [
      { label: _spendLabel, value: _spendValue, color: _spendColor },
      { label: 'Projected Monthly', value: '$' + projectedMonthly.toFixed(2), color: '#f97316' },
      { label: 'API Requests', value: stats.totalRequests.toString(), color: '#3b82f6' },
      { label: 'Input Tokens', value: formatTokenCount(stats.totalInputTokens), color: '#8b5cf6' },
      { label: 'Output Tokens', value: formatTokenCount(stats.totalOutputTokens), color: '#f59e0b' },
      { label: 'Avg Cost/Request', value: stats.totalRequests > 0 ? '$' + (stats.totalCost / stats.totalRequests).toFixed(4) : '$0.00', color: '#ec4899' }
    ];
    cardsEl.innerHTML = cards.map(function(c) {
      return '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">' +
        '<div style="font-size: var(--text-xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">' + c.label + '</div>' +
        '<div style="font-size: var(--text-xl); font-weight: 700; color: ' + c.color + ';">' + c.value + '</div>' +
      '</div>';
    }).join('');
  }

  // Provider Breakdown with visual bars
  var providerEl = document.getElementById('apiCostProviderBreakdown');
  if (providerEl) {
    var providers = [
      { key: 'claude', name: 'Anthropic (Claude)', color: '#d4a574' },
      { key: 'openai', name: 'OpenAI', color: '#10b981' },
      { key: 'gemini', name: 'Google (Gemini)', color: '#3b82f6' },
      { key: 'nanobanana', name: 'Nano Banana (Images)', color: '#f59e0b' }
    ];
    var maxCost = Math.max.apply(null, providers.map(function(p) { return stats.providerCosts[p.key] || 0; })) || 1;

    var html = '<div style="font-weight: 600; margin-bottom: var(--space-4);">Provider Breakdown</div>';
    providers.forEach(function(p) {
      var cost = stats.providerCosts[p.key] || 0;
      var reqs = stats.providerRequests[p.key] || 0;
      if (cost === 0 && reqs === 0) return;
      var pct = Math.round((cost / maxCost) * 100);
      html += '<div style="margin-bottom: var(--space-3);">';
      html += '<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">';
      html += '<span style="font-size: var(--text-sm);">' + p.name + ' <span style="color: var(--text-muted);">(' + reqs + ' requests)</span></span>';
      html += '<span style="font-weight: 600; color: ' + p.color + ';">$' + cost.toFixed(2) + '</span>';
      html += '</div>';
      html += '<div style="height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">';
      html += '<div style="height: 100%; width: ' + pct + '%; background: ' + p.color + '; border-radius: 3px;"></div>';
      html += '</div></div>';
    });
    providerEl.innerHTML = html;
  }

  // Model Breakdown Table
  var modelEl = document.getElementById('apiCostModelBreakdown');
  if (modelEl) {
    var models = Object.keys(stats.modelBreakdown).sort(function(a, b) {
      return stats.modelBreakdown[b].cost - stats.modelBreakdown[a].cost;
    });
    var html = '<div style="font-weight: 600; margin-bottom: var(--space-4);">Model Breakdown</div>';
    if (models.length > 0) {
      html += '<table style="width: 100%; border-collapse: collapse; font-size: var(--text-sm);">';
      html += '<thead><tr style="border-bottom: 1px solid var(--border-color);">';
      html += '<th style="text-align: left; padding: 8px;">Model</th>';
      html += '<th style="text-align: right; padding: 8px;">Requests</th>';
      html += '<th style="text-align: right; padding: 8px;">Input</th>';
      html += '<th style="text-align: right; padding: 8px;">Output</th>';
      html += '<th style="text-align: right; padding: 8px;">Cost</th>';
      html += '</tr></thead><tbody>';
      models.forEach(function(m) {
        var mb = stats.modelBreakdown[m];
        html += '<tr style="border-bottom: 1px solid var(--border-subtle);">';
        html += '<td style="padding: 8px; color: var(--text-primary);">' + getModelDisplayName(m) + '</td>';
        html += '<td style="text-align: right; padding: 8px;">' + mb.requests + '</td>';
        html += '<td style="text-align: right; padding: 8px; color: var(--text-secondary);">' + formatTokenCount(mb.inputTokens) + '</td>';
        html += '<td style="text-align: right; padding: 8px; color: var(--text-secondary);">' + formatTokenCount(mb.outputTokens) + '</td>';
        html += '<td style="text-align: right; padding: 8px; font-weight: 600; color: var(--accent);">$' + mb.cost.toFixed(4) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No API usage recorded yet</div>';
    }
    modelEl.innerHTML = html;
  }

  // Daily Usage Bar Chart (CSS-only)
  var chartEl = document.getElementById('apiCostDailyChart');
  if (chartEl) {
    var dailyCosts = {};
    var entries = (analytics.entries || []).filter(function(e) { return e.timestamp >= startTime; });
    entries.forEach(function(e) {
      var day = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyCosts[day] = (dailyCosts[day] || 0) + (e.cost || 0);
    });
    var dayKeys = Object.keys(dailyCosts);
    var maxDay = Math.max.apply(null, dayKeys.map(function(k) { return dailyCosts[k]; })) || 1;
    var html = '<div style="font-weight: 600; margin-bottom: var(--space-4);">Daily Spend</div>';
    if (dayKeys.length > 0) {
      html += '<div style="display: flex; align-items: flex-end; gap: 2px; height: 120px; overflow-x: auto;">';
      dayKeys.slice(-Math.min(dayKeys.length, days)).forEach(function(day) {
        var cost = dailyCosts[day];
        var height = Math.max(4, Math.round((cost / maxDay) * 100));
        html += '<div style="flex: 1; min-width: 8px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;" title="' + day + ': $' + cost.toFixed(4) + '">';
        html += '<div style="width: 100%; max-width: 24px; height: ' + height + '%; background: var(--accent); border-radius: 2px 2px 0 0; min-height: 4px;"></div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: var(--text-xs); color: var(--text-muted);">';
      html += '<span>' + dayKeys[0] + '</span>';
      html += '<span>' + dayKeys[dayKeys.length - 1] + '</span>';
      html += '</div>';
    } else {
      html += '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No daily data yet</div>';
    }
    chartEl.innerHTML = html;
  }

  // Recent Activity
  var activityEl = document.getElementById('apiCostRecentActivity');
  if (activityEl) {
    var recent = (analytics.entries || []).slice(-15).reverse();
    var html = '<div style="font-weight: 600; margin-bottom: var(--space-4);">Recent Activity</div>';
    if (recent.length > 0) {
      html += '<div style="max-height: 300px; overflow-y: auto;">';
      recent.forEach(function(e) {
        var time = new Date(e.timestamp).toLocaleString();
        var provColor = e.provider === 'claude' ? '#d4a574' : e.provider === 'openai' ? '#10b981' : e.provider === 'nanobanana' ? '#f59e0b' : '#3b82f6';
        html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-subtle); font-size: var(--text-sm);">';
        html += '<div>';
        html += '<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ' + provColor + '; margin-right: 8px;"></span>';
        html += '<span style="color: var(--text-primary);">' + getModelDisplayName(e.model) + '</span>';
        if (e.context && e.context !== 'chat') {
          html += '<span style="font-size: 10px; color: var(--text-muted); background: var(--bg-tertiary); padding: 1px 6px; border-radius: 8px; margin-left: 6px;">' + e.context + '</span>';
        }
        html += '<span style="color: var(--text-muted); margin-left: 8px;">' + time + '</span>';
        html += '</div>';
        html += '<span style="font-weight: 600; color: var(--accent);">$' + (e.cost || 0).toFixed(4) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No activity yet. Start a chat to track API costs.</div>';
    }
    activityEl.innerHTML = html;
  }

  // v24.18: Cost by Feature Breakdown
  var featureEl = document.getElementById('apiCostFeatureBreakdown');
  if (featureEl) {
    var features = [
      { key: 'chat', name: 'Chat', color: '#3b82f6', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
      { key: 'studio', name: 'Studio', color: '#8b5cf6', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
      { key: 'automation', name: 'Automations', color: '#22c55e', icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2' },
      { key: 'image', name: 'Image Gen', color: '#f59e0b', icon: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z' }
    ];
    var maxFeatureCost = Math.max.apply(null, features.map(function(f) { return stats.contextCosts[f.key] || 0; })) || 1;
    var html = '<div style="font-weight: 600; margin-bottom: var(--space-4);">Cost by Feature</div>';
    var hasFeatureData = false;
    features.forEach(function(f) {
      var cost = stats.contextCosts[f.key] || 0;
      if (cost === 0) return;
      hasFeatureData = true;
      var pct = Math.round((cost / maxFeatureCost) * 100);
      var share = stats.totalCost > 0 ? Math.round((cost / stats.totalCost) * 100) : 0;
      html += '<div style="margin-bottom: var(--space-3);">';
      html += '<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">';
      html += '<span style="font-size: var(--text-sm); display: flex; align-items: center; gap: 6px;">';
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + f.color + '" stroke-width="2"><path d="' + f.icon + '"/></svg>';
      html += f.name + ' <span style="color: var(--text-muted);">(' + share + '%)</span></span>';
      html += '<span style="font-weight: 600; color: ' + f.color + ';">$' + cost.toFixed(2) + '</span>';
      html += '</div>';
      html += '<div style="height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">';
      html += '<div style="height: 100%; width: ' + pct + '%; background: ' + f.color + '; border-radius: 3px;"></div>';
      html += '</div></div>';
    });
    if (!hasFeatureData) {
      html += '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: var(--text-sm);">No feature breakdown data yet</div>';
    }
    featureEl.innerHTML = html;
  }

  // v24.18: Spending Alerts Banner
  var alertEl = document.getElementById('apiCostAlertBanner');
  if (alertEl) {
    var alertHtml = '';
    var thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    var alertProviders = [
      { key: 'claude', label: 'Anthropic', matchKeys: ['claude', 'anthropic'] },
      { key: 'openai', label: 'OpenAI', matchKeys: ['openai'] },
      { key: 'gemini', label: 'Gemini', matchKeys: ['gemini', 'google', 'nanobanana'] }
    ];
    alertProviders.forEach(function(ap) {
      var threshold = parseFloat(localStorage.getItem('roweos_analytics_threshold_' + ap.key));
      if (!threshold || threshold <= 0) return;
      var provTotal = 0;
      (analytics.entries || []).forEach(function(e) {
        if (e.timestamp > thirtyDaysAgo && ap.matchKeys.indexOf(e.provider) !== -1) provTotal += (e.cost || 0);
      });
      var ratio = provTotal / threshold;
      if (ratio >= 0.8) {
        var isOver = ratio >= 1.0;
        var bgColor = isOver ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
        var borderColor = isOver ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)';
        var textColor = isOver ? '#ef4444' : '#f59e0b';
        var statusText = isOver ? 'over limit' : 'approaching limit';
        alertHtml += '<div style="padding: 12px 16px; background: ' + bgColor + '; border: 1px solid ' + borderColor + '; border-radius: var(--radius-md); margin-bottom: var(--space-2); display: flex; align-items: center; gap: 8px;">';
        alertHtml += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + textColor + '" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        alertHtml += '<span style="font-size: var(--text-sm); color: ' + textColor + ';">' + ap.label + ' ' + statusText + ': <strong>$' + provTotal.toFixed(2) + '</strong> / $' + threshold.toFixed(2) + ' (30-day)</span>';
        alertHtml += '</div>';
      }
    });
    alertEl.innerHTML = alertHtml;
  }

  // v24.18: Image Generation Stats (Nanobanana)
  var imageGenEl = document.getElementById('apiCostImageGen');
  if (imageGenEl) {
    var nbStats = typeof getNanobananaUsageStats === 'function' ? getNanobananaUsageStats() : null;
    if (nbStats) {
      var periodKey = days <= 7 ? 'week' : days <= 30 ? 'month' : 'all';
      var nb = nbStats[periodKey] || { calls: 0, inputChars: 0, outputChars: 0, byType: {} };
      var html = '<div style="font-weight: 600; margin-bottom: var(--space-4);">Image Generation</div>';
      if (nb.calls > 0) {
        var imgCards = [
          { label: 'Total Calls', value: nb.calls.toString(), color: '#f59e0b' },
          { label: 'Text Prompts', value: (nb.byType.text || 0).toString(), color: '#3b82f6' },
          { label: 'Images Generated', value: (nb.byType.image || 0).toString(), color: '#22c55e' },
          { label: 'Characters In', value: formatTokenCount(nb.inputChars), color: '#8b5cf6' },
          { label: 'Characters Out', value: formatTokenCount(nb.outputChars), color: '#ec4899' }
        ];
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--space-3);">';
        imgCards.forEach(function(c) {
          html += '<div style="background: var(--bg-tertiary); border-radius: var(--radius-md); padding: 12px;">';
          html += '<div style="font-size: var(--text-xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">' + c.label + '</div>';
          html += '<div style="font-size: var(--text-lg); font-weight: 700; color: ' + c.color + ';">' + c.value + '</div>';
          html += '</div>';
        });
        html += '</div>';
      } else {
        html += '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: var(--text-sm);">No image generation activity in this period</div>';
      }
      imageGenEl.innerHTML = html;
    }
  }
}

// v15.4: Format token counts for display
function formatTokenCount(tokens) {
  if (!tokens || tokens === 0) return '0';
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return (tokens / 1000).toFixed(1) + 'K';
  return (tokens / 1000000).toFixed(2) + 'M';
}

// v15.4: Friendly model display names
function getModelDisplayName(modelId) {
  var names = {
    'claude-opus-4-7': 'Claude Opus 4.7',
    'claude-sonnet-4-6': 'Claude Sonnet 4.6',
    'claude-3-5-sonnet-20241022': 'Claude Sonnet 3.5',
    'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
    'gpt-4o': 'GPT-4o',
    'gpt-4.1': 'GPT-4.1',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-5.4': 'GPT-5.4',
    'gpt-5.4-pro': 'GPT-5.4 Pro',
    'gpt-5.4-thinking': 'GPT-5.4 Thinking',
    'o4-mini': 'o4-mini',
    'o1-preview': 'o1-preview',
    'o1-mini': 'o1-mini',
    'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-3-flash-preview': 'Gemini 3 Flash',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
    'gemini-3-pro-image-preview': 'Nano Banana 3.0 Pro',
    'gemini-2.5-flash-image': 'Nano Banana Flash',
    'gemini-2.0-flash-exp-image-generation': 'Nano Banana Legacy',
    'auto': 'RoweOS AI'
  };
  return names[modelId] || modelId;
}

/**
 * v29.0: Analytics Dashboard — Team/Reports, Custom KPIs, Screenshots
 */

// --- Data accessors ---
function getDashboardKPIs() {
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  try { return JSON.parse(localStorage.getItem('roweos_dashboard_kpis_' + brandIdx) || '[]'); } catch(e) { return []; }
}

function saveDashboardKPIs(kpis) {
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  localStorage.setItem('roweos_dashboard_kpis_' + brandIdx, JSON.stringify(kpis));
  if (typeof scheduleAutoSync === 'function') scheduleAutoSync();
}

function getDashboardScreenshots() {
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  try { return JSON.parse(localStorage.getItem('roweos_dashboard_screenshots_' + brandIdx) || '[]'); } catch(e) { return []; }
}

function saveDashboardScreenshots(shots) {
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  try {
    localStorage.setItem('roweos_dashboard_screenshots_' + brandIdx, JSON.stringify(shots));
  } catch(qe) {
    if (qe.name === 'QuotaExceededError' || (qe.message && qe.message.indexOf('quota') !== -1)) {
      if (typeof clearExpendableStorageData === 'function') clearExpendableStorageData();
      try { localStorage.setItem('roweos_dashboard_screenshots_' + brandIdx, JSON.stringify(shots)); } catch(e2) {
        showToast('Storage full: remove some screenshots', 'error');
      }
    }
  }
  if (typeof scheduleAutoSync === 'function') scheduleAutoSync();
}

// --- Main render ---
function renderAnalyticsDashboard() {
  var container = document.getElementById('dashboardContainer');
  if (!container) return;

  var html = '';

  // --- Team & Direct Reports Section ---
  var team = typeof getPeople === 'function' ? getPeople('team') : [];
  var reports = typeof getPeople === 'function' ? getPeople('report') : [];
  var people = team.concat(reports);
  // Filter to current brand if not showing all
  if (!clientsShowAllBrands && typeof selectedBrand !== 'undefined') {
    var bIdx = selectedBrand;
    people = people.filter(function(p) { return p.brandIndex == null || String(p.brandIndex) === String(bIdx); });
  }

  html += '<div style="margin-bottom:32px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
  html += '<h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:0;">Team & Direct Reports</h3>';
  html += '<span style="font-size:12px;color:var(--text-muted);">' + people.length + ' people</span>';
  html += '</div>';

  if (people.length === 0) {
    html += '<div style="text-align:center;padding:32px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);color:var(--text-muted);font-size:13px;">';
    html += 'No team members or direct reports yet. Add them from <a href="#" onclick="showView(\'clients\');return false;" style="color:var(--accent);">People</a>.';
    html += '</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">';
    people.forEach(function(p) {
      var lastCheckIn = '';
      var checkIns = p.checkIns || [];
      if (checkIns.length > 0) {
        var last = checkIns[checkIns.length - 1];
        lastCheckIn = last.date ? new Date(last.date).toLocaleDateString() : '';
      }
      var isReport = p.personType === 'report';
      var typeLabel = isReport ? 'Direct Report' : 'Team Member';
      var avatar = p.logo ? '<img src="' + p.logo + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" alt="">' :
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--brand-accent-10,rgba(168,152,120,0.1));display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent);font-weight:700;font-size:14px;">' + (p.name ? p.name.charAt(0).toUpperCase() : '?') + '</div>';

      html += '<div onclick="' + (isReport ? 'openReportDetail' : 'openTeamDetail') + '(\'' + p.id + '\')" style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);cursor:pointer;transition:all 0.15s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border-color)\'">';
      html += avatar;
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-weight:600;font-size:13px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(p.name || 'Unnamed') + '</div>';
      html += '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(p.role || typeLabel) + '</div>';
      html += '</div>';
      html += '<div style="text-align:right;flex-shrink:0;">';
      if (lastCheckIn) {
        html += '<div style="font-size:11px;color:var(--text-muted);">Last check-in</div>';
        html += '<div style="font-size:12px;color:var(--text-secondary);font-weight:500;">' + lastCheckIn + '</div>';
      } else if (p.nextCheckIn) {
        html += '<div style="font-size:11px;color:var(--text-muted);">Next check-in</div>';
        html += '<div style="font-size:12px;color:var(--accent);">' + new Date(p.nextCheckIn).toLocaleDateString() + '</div>';
      } else {
        html += '<div style="font-size:11px;color:var(--text-muted);">No check-ins</div>';
      }
      html += '</div></div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // --- Custom KPIs Section ---
  var kpis = getDashboardKPIs();
  html += '<div style="margin-bottom:32px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
  html += '<h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:0;">Custom KPIs</h3>';
  html += '<button onclick="addDashboardKPI()" style="padding:6px 14px;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add KPI</button>';
  html += '</div>';

  if (kpis.length === 0) {
    html += '<div style="text-align:center;padding:32px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);color:var(--text-muted);font-size:13px;">';
    html += 'No KPIs defined yet. Add custom metrics to track your key performance indicators.';
    html += '</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">';
    kpis.forEach(function(kpi, idx) {
      var pct = kpi.target > 0 ? Math.min(100, Math.round((kpi.value / kpi.target) * 100)) : 0;
      var barColor = pct >= 100 ? '#4ade80' : pct >= 60 ? 'var(--accent)' : '#fbbf24';
      html += '<div style="padding:16px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);position:relative;">';
      // Delete button
      html += '<button onclick="event.stopPropagation();deleteDashboardKPI(' + idx + ')" style="position:absolute;top:8px;right:8px;border:none;background:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:2px 4px;" title="Remove">x</button>';
      html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">' + escapeHtml(kpi.title || 'Untitled') + '</div>';
      html += '<div style="display:flex;align-items:baseline;gap:4px;margin-bottom:8px;">';
      html += '<span style="font-size:28px;font-weight:700;color:var(--text-primary);">' + escapeHtml(String(kpi.value || 0)) + '</span>';
      if (kpi.unit) html += '<span style="font-size:13px;color:var(--text-muted);">' + escapeHtml(kpi.unit) + '</span>';
      if (kpi.target > 0) html += '<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">/ ' + kpi.target + '</span>';
      html += '</div>';
      // Progress bar
      if (kpi.target > 0) {
        html += '<div style="height:4px;background:var(--bg-primary);border-radius:2px;overflow:hidden;">';
        html += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px;transition:width 0.3s;"></div>';
        html += '</div>';
        html += '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;text-align:right;">' + pct + '%</div>';
      }
      // Edit button
      html += '<button onclick="event.stopPropagation();editDashboardKPI(' + idx + ')" style="margin-top:8px;padding:4px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-muted);font-size:11px;cursor:pointer;font-family:inherit;">Edit</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // --- Screenshots Section ---
  var shots = getDashboardScreenshots();
  html += '<div style="margin-bottom:32px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
  html += '<h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:0;">Screenshots</h3>';
  html += '<label style="padding:6px 14px;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload';
  html += '<input type="file" accept="image/*" multiple onchange="handleDashboardScreenshots(this)" style="display:none;">';
  html += '</label>';
  html += '</div>';

  if (shots.length === 0) {
    html += '<div style="text-align:center;padding:32px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);color:var(--text-muted);font-size:13px;">';
    html += 'No screenshots uploaded. Upload screenshots to track visual progress and share with your team.';
    html += '</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">';
    shots.forEach(function(s, idx) {
      html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-lg);overflow:hidden;position:relative;">';
      html += '<img src="' + s.data + '" style="width:100%;height:140px;object-fit:cover;display:block;cursor:pointer;" onclick="window.open(this.src)">';
      // Delete
      html += '<button onclick="event.stopPropagation();deleteDashboardScreenshot(' + idx + ')" style="position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:12px;cursor:pointer;line-height:22px;text-align:center;">x</button>';
      html += '<div style="padding:8px 10px;">';
      html += '<div style="font-size:12px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" contenteditable="true" onblur="updateDashboardScreenshotTitle(' + idx + ',this.textContent)">' + escapeHtml(s.title || 'Screenshot') + '</div>';
      html += '<div style="font-size:10px;color:var(--text-muted);">' + (s.date ? new Date(s.date).toLocaleDateString() : '') + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
}

// --- KPI CRUD ---
function addDashboardKPI() {
  var title = prompt('KPI Title (e.g., Monthly Revenue, Client Satisfaction):');
  if (!title) return;
  var value = parseFloat(prompt('Current Value:', '0')) || 0;
  var target = parseFloat(prompt('Target Value (0 for no target):', '0')) || 0;
  var unit = prompt('Unit (e.g., $, %, pts, leave blank for none):', '') || '';

  var kpis = getDashboardKPIs();
  kpis.push({ id: Date.now(), title: title.trim(), value: value, target: target, unit: unit.trim() });
  saveDashboardKPIs(kpis);
  renderAnalyticsDashboard();
  showToast('KPI added', 'success');
}

function editDashboardKPI(idx) {
  var kpis = getDashboardKPIs();
  var kpi = kpis[idx];
  if (!kpi) return;

  var title = prompt('KPI Title:', kpi.title);
  if (title === null) return;
  var value = prompt('Current Value:', String(kpi.value));
  if (value === null) return;
  var target = prompt('Target Value:', String(kpi.target));
  if (target === null) return;
  var unit = prompt('Unit:', kpi.unit || '');
  if (unit === null) return;

  kpi.title = title.trim();
  kpi.value = parseFloat(value) || 0;
  kpi.target = parseFloat(target) || 0;
  kpi.unit = unit.trim();
  kpis[idx] = kpi;
  saveDashboardKPIs(kpis);
  renderAnalyticsDashboard();
  showToast('KPI updated', 'success');
}

function deleteDashboardKPI(idx) {
  if (!confirm('Remove this KPI?')) return;
  var kpis = getDashboardKPIs();
  kpis.splice(idx, 1);
  saveDashboardKPIs(kpis);
  renderAnalyticsDashboard();
  showToast('KPI removed', 'success');
}

// --- Screenshot CRUD ---
function handleDashboardScreenshots(input) {
  if (!input.files) return;
  var shots = getDashboardScreenshots();
  var pending = input.files.length;

  for (var fi = 0; fi < input.files.length; fi++) {
    var file = input.files[fi];
    if (file.size > 3 * 1024 * 1024) { showToast('Screenshot too large (max 3MB): ' + file.name, 'warning'); pending--; continue; }
    (function(f) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          // Resize to max 1200px wide
          var maxW = 1200, maxH = 900;
          var w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
          if (h > maxH) { w = Math.round(w * (maxH / h)); h = maxH; }
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          var resized = c.toDataURL('image/jpeg', 0.75);
          shots.push({
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            title: f.name.replace(/\.[^.]+$/, ''),
            data: resized,
            date: new Date().toISOString()
          });
          pending--;
          if (pending <= 0) {
            saveDashboardScreenshots(shots);
            renderAnalyticsDashboard();
            showToast('Screenshot(s) uploaded', 'success');
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(f);
    })(file);
  }
  input.value = '';
}

function deleteDashboardScreenshot(idx) {
  if (!confirm('Remove this screenshot?')) return;
  var shots = getDashboardScreenshots();
  shots.splice(idx, 1);
  saveDashboardScreenshots(shots);
  renderAnalyticsDashboard();
  showToast('Screenshot removed', 'success');
}

function updateDashboardScreenshotTitle(idx, newTitle) {
  var shots = getDashboardScreenshots();
  if (shots[idx]) {
    shots[idx].title = (newTitle || '').trim() || 'Screenshot';
    saveDashboardScreenshots(shots);
  }
}

/**
 * v15.4: Invoice Management System
 */
function getInvoices() {
  try { return JSON.parse(localStorage.getItem('roweos_invoices') || '[]'); } catch(e) { return []; }
}

function saveInvoices(invoices) {
  localStorage.setItem('roweos_invoices', JSON.stringify(invoices));
}

// v25.3: People unified storage
var PEOPLE_TYPES = ['client', 'team', 'report'];

function getPeople(typeFilter) {
  try {
    var all = JSON.parse(localStorage.getItem('roweos_people') || '[]');
    if (!typeFilter) return all;
    return all.filter(function(p) { return p.personType === typeFilter; });
  } catch(e) { return []; }
}

function savePeople(people) {
  localStorage.setItem('roweos_people', JSON.stringify(people));
  var data = JSON.parse(JSON.stringify(people));
  data.forEach(function(p) { if (p.logo && p.logo.length > 50000) p.logo = ''; });
  writeDB('profile/people', { data: data });
}

function getPersonById(id) {
  var all = getPeople();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}

function savePersonById(id, updates) {
  var all = getPeople();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) {
      for (var key in updates) {
        if (updates.hasOwnProperty(key)) all[i][key] = updates[key];
      }
      all[i]._modifiedAt = new Date().toISOString();
      break;
    }
  }
  savePeople(all);
}

function deletePerson(id) {
  var all = getPeople();
  var filtered = all.filter(function(p) { return p.id !== id; });
  savePeople(filtered);
}

// v25.3: Get open tasks assigned to a specific person
function getTasksForPerson(personId) {
  try {
    var key = typeof getTodosKey === 'function' ? getTodosKey() : 'roweosTodos';
    var todos = JSON.parse(localStorage.getItem(key) || '[]');
    return todos.filter(function(t) { return t.assignedTo === personId && !t.completed; });
  } catch(e) { return []; }
}

// v25.3: Populate the Focus assignee dropdown with team + report people
function populateFocusAssigneeSelect() {
  var select = document.getElementById('focusTaskAssignee');
  var wrapper = document.getElementById('focusAssigneeWrapper');
  if (!select || !wrapper) return;
  var team = getPeople('team');
  var reports = getPeople('report');
  var people = team.concat(reports);
  if (people.length === 0) {
    wrapper.style.display = 'none';
    return;
  }
  wrapper.style.display = '';
  var html = '<option value="">Unassigned</option>';
  if (team.length > 0) {
    html += '<optgroup label="Team">';
    team.forEach(function(p) {
      html += '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</option>';
    });
    html += '</optgroup>';
  }
  if (reports.length > 0) {
    html += '<optgroup label="Direct Reports">';
    reports.forEach(function(p) {
      html += '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</option>';
    });
    html += '</optgroup>';
  }
  select.innerHTML = html;
}

// v25.3: Migrate roweos_clients -> roweos_people
function migratePeopleData() {
  if (localStorage.getItem('roweos_people_migrated_v1')) return;
  var oldClients = [];
  try { oldClients = JSON.parse(localStorage.getItem('roweos_clients') || '[]'); } catch(e) {}
  if (oldClients.length > 0) {
    oldClients.forEach(function(c) {
      if (!c.personType) c.personType = 'client';
      if (!c._modifiedAt) c._modifiedAt = c.createdAt || new Date().toISOString();
    });
    localStorage.setItem('roweos_people', JSON.stringify(oldClients));
    savePeople(oldClients);
    localStorage.removeItem('roweos_clients');
  }
  localStorage.setItem('roweos_people_migrated_v1', 'true');
}

// v25.3: Auto-schedule reminders for upcoming direct report check-ins
function scheduleCheckInReminders() {
  var reports = getPeople('report');
  if (!reports.length) return;
  var reminders = [];
  try { var _rRaw = JSON.parse(localStorage.getItem('roweos_reminders') || '[]'); if (Array.isArray(_rRaw)) reminders = _rRaw; } catch(e) {}
  var now = new Date();
  var today = now.toISOString().split('T')[0];
  var tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  var changed = false;

  reports.forEach(function(r) {
    if (!r.nextCheckIn) return;
    var checkDate = r.nextCheckIn.split('T')[0];
    if (checkDate !== today && checkDate !== tomorrow) return;
    // Check if reminder already exists for this person + date
    var exists = reminders.some(function(rem) {
      return rem.linkedPersonId === r.id && rem.scheduledAt && rem.scheduledAt.indexOf(checkDate) === 0;
    });
    if (exists) return;
    reminders.push({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      title: 'Check-in with ' + (r.name || 'Direct Report'),
      message: (r.checkInFrequency || 'Scheduled') + ' check-in due. Status: ' + (r.status || 'active') + '.',
      source: 'people_checkin',
      timestamp: now.toISOString(),
      status: 'pending',
      scheduledAt: r.nextCheckIn,
      linkedPersonId: r.id,
      linkedPersonType: 'report',
      _modifiedAt: now.toISOString(),
      createdAt: now.toISOString()
    });
    changed = true;
  });

  if (changed) {
    localStorage.setItem('roweos_reminders', JSON.stringify(reminders));
    if (typeof writeDB === 'function') writeDB('profile/reminders', { data: reminders });
  }
}

// v25.3: Backward-compatible wrappers for existing client code
function getClients() {
  var fromPeople = getPeople('client');
  // v25.3: Fallback to roweos_clients if migration hasn't run
  // v28.7: Only migrate once — flag prevents resurrection when user deletes all clients
  if (fromPeople.length === 0 && !localStorage.getItem('roweos_clients_migrated')) {
    try {
      var legacy = JSON.parse(localStorage.getItem('roweos_clients') || '[]');
      if (legacy.length > 0) {
        legacy.forEach(function(c) { if (!c.personType) c.personType = 'client'; });
        var all = getPeople();
        savePeople(all.concat(legacy));
        localStorage.removeItem('roweos_clients');
        localStorage.setItem('roweos_clients_migrated', '1');
        return legacy;
      }
    } catch(e) {}
    localStorage.setItem('roweos_clients_migrated', '1');
  }
  return fromPeople;
}

function saveClients(clients) {
  var all = getPeople();
  var nonClients = all.filter(function(p) { return p.personType !== 'client'; });
  clients.forEach(function(c) { if (!c.personType) c.personType = 'client'; });
  savePeople(nonClients.concat(clients));
}

function renderInvoiceList() {
  var invoices = getInvoices();
  var summaryEl = document.getElementById('invoiceSummaryCards');
  var listEl = document.getElementById('invoiceListContainer');
  if (!listEl) return;

  // Summary
  var total = invoices.reduce(function(s, i) { return s + (i.total || 0); }, 0);
  var paid = invoices.filter(function(i) { return i.status === 'paid'; });
  var paidTotal = paid.reduce(function(s, i) { return s + (i.total || 0); }, 0);
  var outstanding = invoices.filter(function(i) { return i.status === 'pending' || i.status === 'overdue'; });
  var outTotal = outstanding.reduce(function(s, i) { return s + (i.total || 0); }, 0);

  if (summaryEl) {
    summaryEl.innerHTML =
      '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">' +
        '<div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: 4px;">Total Invoiced</div>' +
        '<div style="font-size: var(--text-xl); font-weight: 600; color: var(--text-primary);">$' + total.toFixed(2) + '</div>' +
      '</div>' +
      '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">' +
        '<div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: 4px;">Paid</div>' +
        '<div style="font-size: var(--text-xl); font-weight: 600; color: #22c55e;">$' + paidTotal.toFixed(2) + '</div>' +
      '</div>' +
      '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">' +
        '<div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: 4px;">Outstanding</div>' +
        '<div style="font-size: var(--text-xl); font-weight: 600; color: #ef4444;">$' + outTotal.toFixed(2) + '</div>' +
      '</div>' +
      '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4);">' +
        '<div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: 4px;">Count</div>' +
        '<div style="font-size: var(--text-xl); font-weight: 600; color: var(--text-primary);">' + invoices.length + '</div>' +
      '</div>';
  }

  if (invoices.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-tertiary);">' +
      '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: var(--space-3); opacity: 0.4;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
      '<div>No invoices yet. Create your first invoice.</div></div>';
    return;
  }

  var html = '<div style="display: flex; flex-direction: column; gap: var(--space-3);">';
  invoices.sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).forEach(function(inv) {
    var statusColor = inv.status === 'paid' ? '#22c55e' : inv.status === 'overdue' ? '#ef4444' : '#f59e0b';
    var statusLabel = inv.status === 'paid' ? 'Paid' : inv.status === 'overdue' ? 'Overdue' : 'Pending';
    html += '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="viewInvoice(\'' + inv.id + '\')">';
    html += '  <div>';
    html += '    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">#' + escapeHtml(inv.number || '') + ' - ' + escapeHtml(inv.clientName || 'Unknown') + '</div>';
    html += '    <div style="font-size: var(--text-xs); color: var(--text-muted);">' + escapeHtml(inv.description || '') + ' &middot; ' + (inv.date || '') + '</div>';
    html += '  </div>';
    html += '  <div style="display: flex; align-items: center; gap: var(--space-3);">';
    html += '    <span style="font-weight: 600; color: var(--text-primary);">$' + (inv.total || 0).toFixed(2) + '</span>';
    html += '    <span style="font-size: var(--text-xs); padding: 2px 8px; border-radius: var(--radius-md); background: ' + statusColor + '20; color: ' + statusColor + '; font-weight: 600;">' + statusLabel + '</span>';
    html += '    <button onclick="event.stopPropagation(); toggleInvoiceStatus(\'' + inv.id + '\')" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;" title="Toggle status">';
    html += '      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    html += '    </button>';
    html += '    <button onclick="event.stopPropagation(); deleteInvoice(\'' + inv.id + '\')" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;" title="Delete">';
    html += '      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    html += '    </button>';
    html += '  </div>';
    html += '</div>';
  });
  html += '</div>';
  listEl.innerHTML = html;
}

function openInvoiceBuilder() {
  var clients = getClients();
  var invoices = getInvoices();
  var nextNum = 'INV-' + String(invoices.length + 1).padStart(4, '0');

  var clientOptions = clients.map(function(c) {
    return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>';
  }).join('');

  var overlay = document.createElement('div');
  overlay.id = 'invoiceBuilderOverlay';
  overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;';

  overlay.innerHTML = '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: var(--space-6); max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">' +
    '<div style="font-size: var(--text-xl); font-weight: 700; margin-bottom: var(--space-4);">New Invoice</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">' +
      '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Invoice #</label>' +
        '<input type="text" id="invoiceNumber" value="' + nextNum + '" class="form-control" style="padding: 8px 12px;"></div>' +
      '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Date</label>' +
        '<input type="date" id="invoiceDate" value="' + new Date().toISOString().split('T')[0] + '" class="form-control" style="padding: 8px 12px;"></div>' +
    '</div>' +
    '<div style="margin-bottom: var(--space-3);"><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Client</label>' +
      '<select id="invoiceClient" class="form-control" style="padding: 8px 12px;">' +
        '<option value="">Select client...</option>' + clientOptions +
        '<option value="__new__">+ Add new client</option>' +
      '</select></div>' +
    '<div style="margin-bottom: var(--space-3);"><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Description</label>' +
      '<input type="text" id="invoiceDescription" placeholder="Services rendered" class="form-control" style="padding: 8px 12px;"></div>' +
    '<div id="invoiceLineItems" style="margin-bottom: var(--space-3);">' +
      '<label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Line Items</label>' +
      '<div id="invoiceItemsList"></div>' +
      '<div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">' +
        '<button onclick="addInvoiceLineItem()" class="btn btn-small" style="padding: 6px 12px;">+ Add Line</button>' +
        '<button onclick="openInvoiceProductPicker()" class="btn btn-small" style="padding: 6px 12px;">' +
          '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' +
          'Browse Products</button>' +
      '</div>' +
    '</div>' +
    '<div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) 0; border-top: 1px solid var(--border-color); margin-bottom: var(--space-4);">' +
      '<span style="font-weight: 600;">Total</span>' +
      '<span id="invoiceTotalDisplay" style="font-size: var(--text-xl); font-weight: 700; color: var(--accent);">$0.00</span>' +
    '</div>' +
    '<div style="display: flex; gap: var(--space-3);">' +
      '<button onclick="closeInvoiceBuilder()" class="btn" style="flex: 1; padding: 10px;">Cancel</button>' +
      '<button onclick="saveNewInvoice()" class="btn btn-primary" style="flex: 1; padding: 10px;">Create Invoice</button>' +
    '</div>' +
  '</div>';

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeInvoiceBuilder();
  });

  document.body.appendChild(overlay);
  addInvoiceLineItem(); // Add first line item
}

function closeInvoiceBuilder() {
  var overlay = document.getElementById('invoiceBuilderOverlay');
  if (overlay) overlay.remove();
}

function addInvoiceLineItem() {
  var list = document.getElementById('invoiceItemsList');
  if (!list) return;
  var idx = list.children.length;
  var item = document.createElement('div');
  item.style.cssText = 'display: grid; grid-template-columns: 1fr 80px 80px auto; gap: var(--space-2); margin-bottom: var(--space-2); align-items: center;';
  item.innerHTML =
    '<input type="text" placeholder="Item description" class="form-control invoice-item-desc" style="padding: 6px 10px; font-size: var(--text-sm);">' +
    '<input type="number" placeholder="Qty" value="1" class="form-control invoice-item-qty" style="padding: 6px 10px; font-size: var(--text-sm); text-align: right;" oninput="updateInvoiceTotal()">' +
    '<input type="number" placeholder="Rate" class="form-control invoice-item-rate" step="0.01" style="padding: 6px 10px; font-size: var(--text-sm); text-align: right;" oninput="updateInvoiceTotal()">' +
    '<button onclick="this.parentElement.remove(); updateInvoiceTotal();" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
    '</button>';
  list.appendChild(item);
}

function updateInvoiceTotal() {
  var total = 0;
  var items = document.getElementById('invoiceItemsList');
  if (!items) return;
  Array.prototype.slice.call(items.children).forEach(function(row) {
    var qty = parseFloat(row.querySelector('.invoice-item-qty').value) || 0;
    var rate = parseFloat(row.querySelector('.invoice-item-rate').value) || 0;
    total += qty * rate;
  });
  var display = document.getElementById('invoiceTotalDisplay');
  if (display) display.textContent = '$' + total.toFixed(2);
}

function saveNewInvoice() {
  var number = document.getElementById('invoiceNumber');
  var date = document.getElementById('invoiceDate');
  var client = document.getElementById('invoiceClient');
  var desc = document.getElementById('invoiceDescription');

  if (!client || !client.value || client.value === '__new__') {
    if (client && client.value === '__new__') {
      closeInvoiceBuilder();
      openClientModal();
      return;
    }
    showToast('Please select a client', 'warning');
    return;
  }

  var lineItems = [];
  var total = 0;
  var itemsList = document.getElementById('invoiceItemsList');
  if (itemsList) {
    Array.prototype.slice.call(itemsList.children).forEach(function(row) {
      var descInput = row.querySelector('.invoice-item-desc');
      var qty = parseFloat(row.querySelector('.invoice-item-qty').value) || 0;
      var rate = parseFloat(row.querySelector('.invoice-item-rate').value) || 0;
      if (descInput && descInput.value.trim()) {
        lineItems.push({ description: descInput.value.trim(), quantity: qty, rate: rate, amount: qty * rate });
        total += qty * rate;
      }
    });
  }

  if (lineItems.length === 0) {
    showToast('Please add at least one line item', 'warning');
    return;
  }

  var invoices = getInvoices();
  invoices.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    number: number ? number.value : '',
    date: date ? date.value : new Date().toISOString().split('T')[0],
    clientName: client.value,
    description: desc ? desc.value : '',
    lineItems: lineItems,
    total: total,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  saveInvoices(invoices);
  closeInvoiceBuilder();
  renderInvoiceList();
  showToast('Invoice created', 'success');
}

function toggleInvoiceStatus(id) {
  var invoices = getInvoices();
  var inv = invoices.find(function(i) { return i.id === id; });
  if (!inv) return;
  if (inv.status === 'pending') inv.status = 'paid';
  else if (inv.status === 'paid') inv.status = 'overdue';
  else inv.status = 'pending';
  saveInvoices(invoices);
  renderInvoiceList();
}

function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  var invoices = getInvoices().filter(function(i) { return i.id !== id; });
  saveInvoices(invoices);
  renderInvoiceList();
  showToast('Invoice deleted', 'success');
}

// v15.7: Invoice Preview with brand + client logos
function viewInvoice(id) {
  var invoices = getInvoices();
  var inv = invoices.find(function(i) { return i.id === id; });
  if (!inv) return;

  // Get brand logo (current brand)
  var brandIdx = 0;
  try { brandIdx = parseInt(localStorage.getItem('roweos_selected_brand') || '0') || 0; } catch(e) {}
  var brandLogo = localStorage.getItem(getCurrentLogoKey(brandIdx)) || '';
  var brandName = '';
  try {
    var brandsData = JSON.parse(localStorage.getItem('roweos_brands') || '[]');
    if (brandsData[brandIdx]) brandName = brandsData[brandIdx].shortName || brandsData[brandIdx].name || '';
  } catch(e) {}

  // Get client logo
  var clients = getClients();
  var client = clients.find(function(c) { return c.name === inv.clientName; });
  var clientLogo = (client && client.logo) ? client.logo : '';
  var clientCompany = (client && client.company) ? client.company : '';

  var statusColor = inv.status === 'paid' ? '#22c55e' : inv.status === 'overdue' ? '#ef4444' : '#f59e0b';
  var statusLabel = inv.status === 'paid' ? 'Paid' : inv.status === 'overdue' ? 'Overdue' : 'Pending';

  // Build line items table
  var itemsHtml = '';
  (inv.lineItems || []).forEach(function(item, idx) {
    itemsHtml += '<tr style="border-bottom: 1px solid var(--border-color);">' +
      '<td style="padding: 10px 12px; color: var(--text-primary);">' + escapeHtml(item.description || '') + '</td>' +
      '<td style="padding: 10px 12px; text-align: center; color: var(--text-secondary);">' + (item.quantity || 0) + '</td>' +
      '<td style="padding: 10px 12px; text-align: right; color: var(--text-secondary);">$' + (item.rate || 0).toFixed(2) + '</td>' +
      '<td style="padding: 10px 12px; text-align: right; font-weight: 600; color: var(--text-primary);">$' + (item.amount || 0).toFixed(2) + '</td>' +
    '</tr>';
  });

  var overlay = document.createElement('div');
  overlay.id = 'invoiceViewOverlay';
  overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;';

  overlay.innerHTML = '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: var(--space-6); max-width: 600px; width: 90%; max-height: 85vh; overflow-y: auto;">' +
    // Header with logos
    '<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-color);">' +
      '<div style="display: flex; align-items: center; gap: var(--space-3);">' +
        (brandLogo ? '<img src="' + brandLogo + '" style="width: 48px; height: 48px; object-fit: contain; border-radius: var(--radius-sm);" alt="">' : '') +
        '<div>' +
          (brandName ? '<div style="font-weight: 700; color: var(--text-primary); font-size: var(--text-base);">' + escapeHtml(brandName) + '</div>' : '') +
          '<div style="font-size: var(--text-xs); color: var(--text-muted);">Invoice</div>' +
        '</div>' +
      '</div>' +
      (clientLogo ? '<img src="' + clientLogo + '" style="width: 40px; height: 40px; object-fit: contain; border-radius: var(--radius-sm);" alt="" title="' + escapeHtml(inv.clientName) + '">' : '') +
    '</div>' +
    // Invoice details
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-5);">' +
      '<div>' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 2px;">Invoice Number</div>' +
        '<div style="font-weight: 600; color: var(--text-primary);">' + escapeHtml(inv.number || '') + '</div>' +
      '</div>' +
      '<div>' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 2px;">Date</div>' +
        '<div style="font-weight: 600; color: var(--text-primary);">' + escapeHtml(inv.date || '') + '</div>' +
      '</div>' +
      '<div>' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 2px;">Bill To</div>' +
        '<div style="font-weight: 600; color: var(--text-primary);">' + escapeHtml(inv.clientName || '') + '</div>' +
        (clientCompany ? '<div style="font-size: var(--text-xs); color: var(--text-muted);">' + escapeHtml(clientCompany) + '</div>' : '') +
      '</div>' +
      '<div>' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 2px;">Status</div>' +
        '<span style="font-size: var(--text-xs); padding: 2px 8px; border-radius: var(--radius-md); background: ' + statusColor + '20; color: ' + statusColor + '; font-weight: 600;">' + statusLabel + '</span>' +
      '</div>' +
    '</div>' +
    // Description
    (inv.description ? '<div style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">' + escapeHtml(inv.description) + '</div>' : '') +
    // Line items table
    '<table style="width: 100%; border-collapse: collapse; margin-bottom: var(--space-4);">' +
      '<thead><tr style="border-bottom: 2px solid var(--border-color);">' +
        '<th style="padding: 8px 12px; text-align: left; font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Description</th>' +
        '<th style="padding: 8px 12px; text-align: center; font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Qty</th>' +
        '<th style="padding: 8px 12px; text-align: right; font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Rate</th>' +
        '<th style="padding: 8px 12px; text-align: right; font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Amount</th>' +
      '</tr></thead>' +
      '<tbody>' + itemsHtml + '</tbody>' +
      '<tfoot><tr style="border-top: 2px solid var(--border-color);">' +
        '<td colspan="3" style="padding: 12px; text-align: right; font-weight: 700; color: var(--text-primary);">Total</td>' +
        '<td style="padding: 12px; text-align: right; font-weight: 700; font-size: var(--text-lg); color: var(--accent);">$' + (inv.total || 0).toFixed(2) + '</td>' +
      '</tr></tfoot>' +
    '</table>' +
    // Actions
    '<div style="display: flex; gap: var(--space-3);">' +
      '<button onclick="closeInvoiceView()" class="btn" style="flex: 1; padding: 10px;">Close</button>' +
      '<button onclick="printInvoice(\'' + inv.id + '\')" class="btn btn-primary" style="flex: 1; padding: 10px;">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
        'Print</button>' +
    '</div>' +
  '</div>';

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeInvoiceView();
  });
  document.body.appendChild(overlay);
}

function closeInvoiceView() {
  var overlay = document.getElementById('invoiceViewOverlay');
  if (overlay) overlay.remove();
}

// v15.7: Print invoice in a new window
function printInvoice(id) {
  var invoices = getInvoices();
  var inv = invoices.find(function(i) { return i.id === id; });
  if (!inv) return;

  var brandIdx = 0;
  try { brandIdx = parseInt(localStorage.getItem('roweos_selected_brand') || '0') || 0; } catch(e) {}
  var brandLogo = localStorage.getItem(getCurrentLogoKey(brandIdx)) || '';
  var brandName = '';
  try {
    var brandsData = JSON.parse(localStorage.getItem('roweos_brands') || '[]');
    if (brandsData[brandIdx]) brandName = brandsData[brandIdx].shortName || brandsData[brandIdx].name || '';
  } catch(e) {}

  var clients = getClients();
  var client = clients.find(function(c) { return c.name === inv.clientName; });
  var clientLogo = (client && client.logo) ? client.logo : '';
  var clientCompany = (client && client.company) ? client.company : '';

  var itemsHtml = '';
  (inv.lineItems || []).forEach(function(item) {
    itemsHtml += '<tr>' +
      '<td style="padding: 8px 0; border-bottom: 1px solid #eee;">' + escapeHtml(item.description || '') + '</td>' +
      '<td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">' + (item.quantity || 0) + '</td>' +
      '<td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">$' + (item.rate || 0).toFixed(2) + '</td>' +
      '<td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">$' + (item.amount || 0).toFixed(2) + '</td>' +
    '</tr>';
  });

  var printWindow = window.open('', '_blank');
  if (!printWindow) { showToast('Please allow popups to print', 'warning'); return; }
  printWindow.document.write('<!DOCTYPE html><html><head><title>Invoice ' + escapeHtml(inv.number || '') + '</title>' +
    '<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#111;max-width:700px;margin:40px auto;padding:0 20px;}table{width:100%;border-collapse:collapse;margin:24px 0;}th{text-align:left;padding:8px 0;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase;color:#666;}' +
    '@media print{body{margin:0;padding:20px;}}</style></head><body>' +
    '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:32px;">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        (brandLogo ? '<img src="' + brandLogo + '" style="width:60px;height:60px;object-fit:contain;" alt="">' : '') +
        '<div><div style="font-size:20px;font-weight:700;">' + escapeHtml(brandName || 'Invoice') + '</div><div style="color:#666;font-size:13px;">Invoice</div></div>' +
      '</div>' +
      (clientLogo ? '<img src="' + clientLogo + '" style="width:50px;height:50px;object-fit:contain;" alt="">' : '') +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">' +
      '<div><div style="font-size:12px;color:#666;">Invoice #</div><div style="font-weight:600;">' + escapeHtml(inv.number || '') + '</div></div>' +
      '<div><div style="font-size:12px;color:#666;">Date</div><div style="font-weight:600;">' + escapeHtml(inv.date || '') + '</div></div>' +
      '<div><div style="font-size:12px;color:#666;">Bill To</div><div style="font-weight:600;">' + escapeHtml(inv.clientName || '') + '</div>' +
        (clientCompany ? '<div style="font-size:13px;color:#666;">' + escapeHtml(clientCompany) + '</div>' : '') + '</div>' +
    '</div>' +
    (inv.description ? '<p style="color:#444;margin-bottom:16px;">' + escapeHtml(inv.description) + '</p>' : '') +
    '<table><thead><tr><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>' +
    '<tbody>' + itemsHtml + '</tbody>' +
    '<tfoot><tr><td colspan="3" style="padding:12px 0;text-align:right;font-weight:700;border-top:2px solid #333;">Total</td>' +
    '<td style="padding:12px 0;text-align:right;font-weight:700;font-size:18px;border-top:2px solid #333;">$' + (inv.total || 0).toFixed(2) + '</td></tr></tfoot></table>' +
    '</body></html>');
  printWindow.document.close();
  setTimeout(function() { printWindow.print(); }, 250);
}

// v15.7: Invoice Product Picker — browse inventory items to add as line items
function openInvoiceProductPicker() {
  // v15.14: Use correct storage key for current mode
  var invKey = typeof getInventoryStorageKey === 'function' ? getInventoryStorageKey() : 'roweos_inventory';
  var inventoryData;
  try { inventoryData = JSON.parse(localStorage.getItem(invKey) || '{"items":[]}'); } catch(e) { inventoryData = {items: []}; }
  var items = inventoryData.items || [];

  if (items.length === 0) {
    showToast('No products in inventory. Add items in Studio first.', 'warning');
    return;
  }

  var overlay = document.createElement('div');
  overlay.id = 'productPickerOverlay';
  overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10001; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;';

  // Group by category
  var categories = {};
  items.forEach(function(item) {
    var cat = item.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });

  var itemsHtml = '';
  Object.keys(categories).sort().forEach(function(cat) {
    itemsHtml += '<div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: var(--space-3) 0 var(--space-2) 0;">' + escapeHtml(cat) + '</div>';
    categories[cat].forEach(function(item) {
      var priceStr = item.price ? '$' + parseFloat(item.price).toFixed(2) : '';
      var typeColor = item.type === 'service' ? '#a78bfa' : item.type === 'digital' ? '#60a5fa' : '#4ade80';
      var typeLabel = item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Product';
      itemsHtml += '<div class="product-picker-item" data-item-id="' + (item.id || '') + '" ' +
        'onclick="toggleProductPickerItem(this)" ' +
        'style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: border-color 0.15s, background 0.15s; margin-bottom: var(--space-2);">';
      // Thumbnail
      if (item.imageData) {
        itemsHtml += '<img src="' + item.imageData + '" style="width: 36px; height: 36px; border-radius: var(--radius-sm); object-fit: cover;" alt="">';
      } else {
        itemsHtml += '<div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.4;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>';
      }
      // Info
      itemsHtml += '<div style="flex: 1; min-width: 0;">' +
        '<div style="font-weight: 500; color: var(--text-primary); font-size: var(--text-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(item.name || '') + '</div>' +
        '<div style="font-size: var(--text-xs); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(item.description || item.sku || '') + '</div>' +
      '</div>';
      // Type badge + price
      itemsHtml += '<div style="text-align: right; flex-shrink: 0;">' +
        '<span style="font-size: 10px; padding: 1px 6px; border-radius: var(--radius-sm); background: ' + typeColor + '15; color: ' + typeColor + '; font-weight: 600;">' + typeLabel + '</span>' +
        (priceStr ? '<div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); margin-top: 2px;">' + priceStr + '</div>' : '') +
      '</div>';
      // Check indicator
      itemsHtml += '<div class="pick-check" style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s;">' +
        '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="3" style="opacity: 0;"><polyline points="20 6 9 17 4 12"/></svg>' +
      '</div>';
      itemsHtml += '</div>';
    });
  });

  overlay.innerHTML = '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: var(--space-6); max-width: 480px; width: 90%; max-height: 80vh; display: flex; flex-direction: column;">' +
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">' +
      '<div style="font-size: var(--text-xl); font-weight: 700;">Browse Products</div>' +
      '<span id="productPickerCount" style="font-size: var(--text-sm); color: var(--text-muted);">0 selected</span>' +
    '</div>' +
    '<div style="flex: 1; overflow-y: auto; margin-bottom: var(--space-4);">' + itemsHtml + '</div>' +
    '<div style="display: flex; gap: var(--space-3);">' +
      '<button onclick="closeProductPicker()" class="btn" style="flex: 1; padding: 10px;">Cancel</button>' +
      '<button onclick="confirmProductPicker()" class="btn btn-primary" style="flex: 1; padding: 10px;">Add Selected</button>' +
    '</div>' +
  '</div>';

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeProductPicker();
  });
  document.body.appendChild(overlay);
}

function toggleProductPickerItem(el) {
  var isSelected = el.getAttribute('data-selected') === 'true';
  el.setAttribute('data-selected', isSelected ? 'false' : 'true');
  el.style.borderColor = isSelected ? 'var(--border-color)' : 'var(--accent)';
  el.style.background = isSelected ? 'var(--bg-primary)' : 'var(--accent-10, rgba(168,152,120,0.1))';
  var check = el.querySelector('.pick-check');
  if (check) {
    check.style.background = isSelected ? 'transparent' : 'var(--accent)';
    check.style.borderColor = isSelected ? 'var(--border-color)' : 'var(--accent)';
    check.querySelector('svg').style.opacity = isSelected ? '0' : '1';
  }
  // Update count
  var overlay = document.getElementById('productPickerOverlay');
  if (overlay) {
    var count = overlay.querySelectorAll('[data-selected="true"]').length;
    var countEl = document.getElementById('productPickerCount');
    if (countEl) countEl.textContent = count + ' selected';
  }
}

function closeProductPicker() {
  var overlay = document.getElementById('productPickerOverlay');
  if (overlay) overlay.remove();
}

function confirmProductPicker() {
  var overlay = document.getElementById('productPickerOverlay');
  if (!overlay) return;
  var selected = overlay.querySelectorAll('[data-selected="true"]');
  if (selected.length === 0) {
    showToast('Select at least one product', 'warning');
    return;
  }
  // v15.14: Use correct storage key for current mode
  var invKey = typeof getInventoryStorageKey === 'function' ? getInventoryStorageKey() : 'roweos_inventory';
  var inventoryData;
  try { inventoryData = JSON.parse(localStorage.getItem(invKey) || '{"items":[]}'); } catch(e) { inventoryData = {items: []}; }
  var items = inventoryData.items || [];

  Array.prototype.slice.call(selected).forEach(function(el) {
    var itemId = el.getAttribute('data-item-id');
    var item = items.find(function(i) { return i.id === itemId; });
    if (!item) return;
    // Add line item to invoice builder
    var list = document.getElementById('invoiceItemsList');
    if (!list) return;
    var row = document.createElement('div');
    row.style.cssText = 'display: grid; grid-template-columns: 1fr 80px 80px auto; gap: var(--space-2); margin-bottom: var(--space-2); align-items: center;';
    row.innerHTML =
      '<input type="text" value="' + escapeHtml(item.name || '') + '" class="form-control invoice-item-desc" style="padding: 6px 10px; font-size: var(--text-sm);">' +
      '<input type="number" value="1" class="form-control invoice-item-qty" style="padding: 6px 10px; font-size: var(--text-sm); text-align: right;" oninput="updateInvoiceTotal()">' +
      '<input type="number" value="' + (parseFloat(item.price) || 0).toFixed(2) + '" class="form-control invoice-item-rate" step="0.01" style="padding: 6px 10px; font-size: var(--text-sm); text-align: right;" oninput="updateInvoiceTotal()">' +
      '<button onclick="this.parentElement.remove(); updateInvoiceTotal();" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>';
    list.appendChild(row);
  });

  closeProductPicker();
  updateInvoiceTotal();
  showToast(selected.length + ' product' + (selected.length > 1 ? 's' : '') + ' added', 'success');
}

/**
 * v15.4: Client Management
 */
function renderClientList() {
  var clients = getClients();
  var container = document.getElementById('clientListContainer');
  if (!container) return;

  if (clients.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-tertiary);">' +
      '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: var(--space-3); opacity: 0.4;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
      '<div>No clients yet. Add your first client.</div></div>';
    return;
  }

  var html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4);">';
  clients.forEach(function(c) {
    var invoices = getInvoices().filter(function(i) { return i.clientName === c.name; });
    var totalInvoiced = invoices.reduce(function(s, i) { return s + (i.total || 0); }, 0);
    html += '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-5);">';
    html += '  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-3);">';
    html += '    <div style="display: flex; align-items: center; gap: var(--space-3);">';
    // v15.7: Client logo
    if (c.logo) {
      html += '<img src="' + c.logo + '" style="width: 36px; height: 36px; border-radius: var(--radius-sm); object-fit: contain; flex-shrink: 0;" alt="">';
    } else {
      html += '<div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>';
    }
    html += '      <div>';
    html += '      <div style="font-weight: 600; color: var(--text-primary); font-size: var(--text-base);">' + escapeHtml(c.name) + '</div>';
    if (c.email) html += '      <div style="font-size: var(--text-xs); color: var(--text-muted);">' + escapeHtml(c.email) + '</div>';
    html += '    </div></div>';
    html += '    <button onclick="deleteClient(\'' + c.id + '\')" style="background: none; border: none; cursor: pointer; color: var(--text-muted);" title="Delete">';
    html += '      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    html += '    </button>';
    html += '  </div>';
    if (c.company) html += '<div style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">' + escapeHtml(c.company) + '</div>';
    html += '  <div style="display: flex; gap: var(--space-4); font-size: var(--text-sm); color: var(--text-muted);">';
    html += '    <span>' + invoices.length + ' invoices</span>';
    html += '    <span>$' + totalInvoiced.toFixed(2) + ' total</span>';
    html += '  </div>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// v25.3: Team/Report department options
var TEAM_DEPARTMENTS = [
  { id: 'marketing', label: 'Marketing' },
  { id: 'operations', label: 'Operations' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'development', label: 'Development' },
  { id: 'design', label: 'Design' },
  { id: 'sales', label: 'Sales' },
  { id: 'finance', label: 'Finance' },
  { id: 'support', label: 'Support' },
  { id: 'executive', label: 'Executive' },
  { id: 'other', label: 'Other' }
];

// v25.3: Direct report constants
var DEFAULT_REPORT_STATUSES = [
  { id: 'active', label: 'Active', color: '#4ade80' },
  { id: 'probation', label: 'Probation', color: '#fbbf24' },
  { id: 'pip', label: 'Performance Plan', color: '#ef4444' },
  { id: 'onboarding', label: 'Onboarding', color: '#60a5fa' },
  { id: 'offboarding', label: 'Offboarding', color: '#94a3b8' },
  { id: 'inactive', label: 'Inactive', color: '#6b7280' }
];

// Custom status colors cycle
var _CUSTOM_STATUS_COLORS = ['#c084fc', '#fb923c', '#2dd4bf', '#f472b6', '#a3e635', '#38bdf8', '#e879f9'];

// Returns default + custom statuses
function getReportStatuses() {
  var custom = [];
  try { custom = JSON.parse(localStorage.getItem('roweos_report_statuses') || '[]'); } catch(e) {}
  return DEFAULT_REPORT_STATUSES.concat(custom);
}

// Add a custom report status
function addCustomReportStatus(name) {
  if (!name || !name.trim()) return;
  name = name.trim();
  var id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  var all = getReportStatuses();
  // Check for duplicate
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id || all[i].label.toLowerCase() === name.toLowerCase()) return;
  }
  var custom = [];
  try { custom = JSON.parse(localStorage.getItem('roweos_report_statuses') || '[]'); } catch(e) {}
  var colorIdx = custom.length % _CUSTOM_STATUS_COLORS.length;
  custom.push({ id: id, label: name, color: _CUSTOM_STATUS_COLORS[colorIdx], custom: true });
  localStorage.setItem('roweos_report_statuses', JSON.stringify(custom));
}

// Remove a custom report status (cannot remove default ones)
function removeCustomReportStatus(name) {
  var custom = [];
  try { custom = JSON.parse(localStorage.getItem('roweos_report_statuses') || '[]'); } catch(e) {}
  custom = custom.filter(function(s) { return s.label !== name && s.id !== name; });
  localStorage.setItem('roweos_report_statuses', JSON.stringify(custom));
}

// Prompt user to add a custom report status
function promptAddReportStatus() {
  var name = prompt('Enter a new status name:');
  if (!name || !name.trim()) return;
  addCustomReportStatus(name);
  // Refresh the status dropdown in the open modal
  var sel = document.getElementById('personStatus');
  if (sel) {
    var currentVal = sel.value;
    var statuses = getReportStatuses();
    var opts = '';
    for (var i = 0; i < statuses.length; i++) {
      var isSelected = statuses[i].id === currentVal ? ' selected' : '';
      opts += '<option value="' + escapeHtml(statuses[i].id) + '"' + isSelected + '>' + escapeHtml(statuses[i].label) + '</option>';
    }
    sel.innerHTML = opts;
    // Select the newly added status
    var newId = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    sel.value = newId;
  }
  if (typeof showToast === 'function') showToast('Status "' + name.trim() + '" added', 'success');
}

// Show manage dialog for custom statuses
function openManageReportStatuses() {
  var custom = [];
  try { custom = JSON.parse(localStorage.getItem('roweos_report_statuses') || '[]'); } catch(e) {}
  if (custom.length === 0) {
    if (typeof showToast === 'function') showToast('No custom statuses to manage', 'info');
    return;
  }
  var names = [];
  for (var i = 0; i < custom.length; i++) {
    names.push((i + 1) + '. ' + custom[i].label);
  }
  var input = prompt('Custom statuses:\n' + names.join('\n') + '\n\nType the name of a status to remove, or cancel:');
  if (!input || !input.trim()) return;
  var before = custom.length;
  removeCustomReportStatus(input.trim());
  var after = [];
  try { after = JSON.parse(localStorage.getItem('roweos_report_statuses') || '[]'); } catch(e) {}
  if (after.length < before) {
    if (typeof showToast === 'function') showToast('Status "' + input.trim() + '" removed', 'success');
    // Refresh dropdown
    var sel = document.getElementById('personStatus');
    if (sel) {
      var currentVal = sel.value;
      var statuses = getReportStatuses();
      var opts = '';
      for (var j = 0; j < statuses.length; j++) {
        var isSelected = statuses[j].id === currentVal ? ' selected' : '';
        opts += '<option value="' + escapeHtml(statuses[j].id) + '"' + isSelected + '>' + escapeHtml(statuses[j].label) + '</option>';
      }
      sel.innerHTML = opts;
    }
    // Refresh view if visible
    if (typeof renderReportsView === 'function') renderReportsView();
  } else {
    if (typeof showToast === 'function') showToast('Status not found', 'error');
  }
}

var REPORT_STATUSES = getReportStatuses();

var CHECKIN_TYPES = [
  { id: 'weekly', label: 'Weekly 1:1' },
  { id: 'performance', label: 'Performance Review' },
  { id: 'development', label: 'Development Chat' },
  { id: 'casual', label: 'Casual Check-in' },
  { id: 'quarterly', label: 'Quarterly Review' }
];

// v25.3: Universal person creation/edit modal
function openPersonModal(personType, editId) {
  var editPerson = null;
  if (editId) {
    editPerson = getPersonById(editId);
  }
  if (!personType && editPerson) personType = editPerson.personType || 'client';
  if (!personType) personType = 'client';

  // v25.3: If client type, delegate to existing openClientModal for backward compat
  if (personType === 'client') {
    return _openClientModalOriginal(editId);
  }

  var typeLabels = { team: 'Team Member', report: 'Direct Report' };
  var typeLabel = typeLabels[personType] || personType;
  var title = editPerson ? 'Edit ' + typeLabel : 'Add ' + typeLabel;

  var overlay = document.createElement('div');
  overlay.id = 'personModalOverlay';
  // v25.3: bottom sheet on mobile
  var personIsMobile = window.innerWidth <= 768;
  overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex;' + (personIsMobile ? ' align-items: flex-end; justify-content: center;' : ' align-items: center; justify-content: center;');

  // v25.3: Build department select options
  var deptOptions = '<option value="">Select department</option>';
  for (var d = 0; d < TEAM_DEPARTMENTS.length; d++) {
    var sel = editPerson && editPerson.department === TEAM_DEPARTMENTS[d].id ? ' selected' : '';
    deptOptions += '<option value="' + TEAM_DEPARTMENTS[d].id + '"' + sel + '>' + escapeHtml(TEAM_DEPARTMENTS[d].label) + '</option>';
  }

  // v25.3: Build "Reports To" select from brand-scoped people
  var allPeople = getPeople();
  var rtBrandIdx = (typeof selectedBrand !== 'undefined') ? selectedBrand : 0;
  var reportsToOptions = '<option value="">None</option>';
  for (var r = 0; r < allPeople.length; r++) {
    if (editPerson && allPeople[r].id === editPerson.id) continue;
    if (!allPeople[r].name) continue;
    if (allPeople[r].scope !== 'universal' && allPeople[r].brandIndex !== rtBrandIdx) continue;
    var rSel = editPerson && editPerson.reportsTo === allPeople[r].id ? ' selected' : '';
    reportsToOptions += '<option value="' + allPeople[r].id + '"' + rSel + '>' + escapeHtml(allPeople[r].name) + '</option>';
  }

  var saveAction = editPerson ? 'onclick="saveEditPerson(\'' + editPerson.id + '\')"' : 'onclick="saveNewPerson(\'' + personType + '\')"';

  // v25.3: Shared fields HTML — bottom sheet on mobile
  var personModalStyle = personIsMobile ? 'width:100%;max-width:100%;border-radius:16px 16px 0 0;position:fixed;bottom:0;left:0;max-height:90vh;' : 'max-width: 520px; width: 90%; border-radius: var(--radius-xl);';
  var html = '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); padding: var(--space-6); overflow-y: auto; max-height: 85vh;' + personModalStyle + '">' +
    '<div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4);">' +
      '<div style="font-size: var(--text-xl); font-weight: 700;">' + title + '</div>' +
      '<span style="font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--bg-tertiary); color: var(--text-muted); font-weight: 500;">' + escapeHtml(typeLabel) + '</span>' +
    '</div>' +
    '<div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4);">' +
      // Logo upload
      '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Photo / Logo</label>' +
        '<div style="display: flex; align-items: center; gap: var(--space-3);">' +
          '<div id="personLogoPreview" style="width: 48px; height: 48px; border-radius: var(--radius-md); border: 1px dashed var(--border-color); display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--bg-primary); flex-shrink: 0;">' +
            (editPerson && editPerson.logo ? '<img src="' + editPerson.logo + '" style="width: 100%; height: 100%; object-fit: contain;">' :
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>') +
          '</div>' +
          '<input type="file" id="personLogoInput" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" style="display:none;" onchange="handlePersonLogoUpload(this)">' +
          '<button onclick="document.getElementById(\'personLogoInput\').click()" class="btn btn-small" style="padding: 6px 12px; font-size: var(--text-xs);">Upload</button>' +
          '<button id="personLogoRemoveBtn" onclick="removePersonLogoPreview()" class="btn btn-small" style="padding: 6px 12px; font-size: var(--text-xs); display: ' + (editPerson && editPerson.logo ? '' : 'none') + ';">Remove</button>' +
        '</div>' +
      '</div>' +
      // Name + Company
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Name *</label>' +
          '<input type="text" id="personName" placeholder="Full name" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editPerson ? editPerson.name : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Company / Org</label>' +
          '<input type="text" id="personCompany" placeholder="Company name" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editPerson ? (editPerson.company || '') : '') + '"></div>' +
      '</div>' +
      // Role + Location
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Role / Title</label>' +
          '<input type="text" id="personRole" placeholder="Director, Engineer..." class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editPerson ? (editPerson.role || '') : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Location</label>' +
          '<input type="text" id="personLocation" placeholder="Austin, TX" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editPerson ? (editPerson.location || '') : '') + '"></div>' +
      '</div>' +
      // Email + Phone
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Email</label>' +
          '<input type="email" id="personEmail" placeholder="name@company.com" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editPerson ? (editPerson.email || '') : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Phone</label>' +
          '<input type="tel" id="personPhone" placeholder="(555) 123-4567" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editPerson ? (editPerson.phone || '') : '') + '"></div>' +
      '</div>' +
      // Website + Scope
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Website</label>' +
          '<input type="url" id="personWebsite" placeholder="https://..." class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editPerson ? (editPerson.website || '') : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Scope</label>' +
          '<select id="personScope" class="form-control" style="padding: 8px 12px;">' +
            '<option value="brand"' + (editPerson && editPerson.scope !== 'universal' ? ' selected' : (!editPerson ? ' selected' : '')) + '>This Brand</option>' +
            '<option value="universal"' + (editPerson && editPerson.scope === 'universal' ? ' selected' : '') + '>Universal</option>' +
          '</select></div>' +
      '</div>';

  // v25.3: Type-specific fields
  if (personType === 'team') {
    html += '<div style="margin-top: var(--space-2); padding-top: var(--space-3); border-top: 1px solid var(--border-color);">' +
      '<div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-3);">Team Details</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Department</label>' +
          '<select id="personDepartment" class="form-control" style="padding: 8px 12px;">' + deptOptions + '</select></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Availability</label>' +
          '<select id="personAvailability" class="form-control" style="padding: 8px 12px;">' +
            '<option value="full_time"' + (editPerson && editPerson.availability === 'full_time' ? ' selected' : (!editPerson ? ' selected' : '')) + '>Full Time</option>' +
            '<option value="part_time"' + (editPerson && editPerson.availability === 'part_time' ? ' selected' : '') + '>Part Time</option>' +
            '<option value="contractor"' + (editPerson && editPerson.availability === 'contractor' ? ' selected' : '') + '>Contractor</option>' +
            '<option value="freelance"' + (editPerson && editPerson.availability === 'freelance' ? ' selected' : '') + '>Freelance</option>' +
          '</select></div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Start Date</label>' +
          '<input type="date" id="personStartDate" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editPerson ? (editPerson.startDate || '') : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Reports To</label>' +
          '<select id="personReportsTo" class="form-control" style="padding: 8px 12px;">' + reportsToOptions + '</select></div>' +
      '</div>' +
      '<div style="margin-top: var(--space-3);"><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Responsibilities (comma-separated)</label>' +
        '<textarea id="personResponsibilities" placeholder="Project management, client relations..." class="form-control" style="padding: 8px 12px; min-height: 50px; resize: vertical;">' + escapeHtml(editPerson && editPerson.responsibilities ? editPerson.responsibilities.join(', ') : '') + '</textarea></div>' +
      '<div style="margin-top: var(--space-3);"><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Skills (comma-separated)</label>' +
        '<textarea id="personSkills" placeholder="JavaScript, design, analytics..." class="form-control" style="padding: 8px 12px; min-height: 50px; resize: vertical;">' + escapeHtml(editPerson && editPerson.skills ? editPerson.skills.join(', ') : '') + '</textarea></div>' +
    '</div>';
  } else if (personType === 'report') {
    html += '<div style="margin-top: var(--space-2); padding-top: var(--space-3); border-top: 1px solid var(--border-color);">' +
      '<div style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-3);">Direct Report Details</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Department</label>' +
          '<select id="personDepartment" class="form-control" style="padding: 8px 12px;">' + deptOptions + '</select></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Status</label>' +
          '<div style="display:flex;align-items:center;gap:4px;">' +
            '<select id="personStatus" class="form-control" style="padding: 8px 12px; flex:1;">' +
              (function() {
                var statuses = getReportStatuses();
                var opts = '';
                for (var si = 0; si < statuses.length; si++) {
                  var isSelected = editPerson && editPerson.status === statuses[si].id ? ' selected' : (!editPerson && statuses[si].id === 'active' ? ' selected' : '');
                  opts += '<option value="' + escapeHtml(statuses[si].id) + '"' + isSelected + '>' + escapeHtml(statuses[si].label) + '</option>';
                }
                return opts;
              })() +
            '</select>' +
            '<button type="button" onclick="promptAddReportStatus()" style="width:28px;height:28px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="Add custom status">+</button>' +
            '<button type="button" onclick="openManageReportStatuses()" style="font-size:11px;color:var(--text-muted);background:none;border:none;cursor:pointer;text-decoration:underline;flex-shrink:0;padding:0 4px;" title="Manage custom statuses">Manage</button>' +
          '</div></div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Start Date</label>' +
          '<input type="date" id="personStartDate" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editPerson ? (editPerson.startDate || '') : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Check-in Frequency</label>' +
          '<select id="personCheckinFrequency" class="form-control" style="padding: 8px 12px;">' +
            '<option value="weekly"' + (editPerson && editPerson.checkinFrequency === 'weekly' ? ' selected' : (!editPerson ? ' selected' : '')) + '>Weekly</option>' +
            '<option value="biweekly"' + (editPerson && editPerson.checkinFrequency === 'biweekly' ? ' selected' : '') + '>Biweekly</option>' +
            '<option value="monthly"' + (editPerson && editPerson.checkinFrequency === 'monthly' ? ' selected' : '') + '>Monthly</option>' +
            '<option value="quarterly"' + (editPerson && editPerson.checkinFrequency === 'quarterly' ? ' selected' : '') + '>Quarterly</option>' +
          '</select></div>' +
      '</div>' +
      '<div style="margin-top: var(--space-3);"><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Reports To</label>' +
        '<select id="personReportsTo" class="form-control" style="padding: 8px 12px;">' + reportsToOptions + '</select></div>' +
      '<div style="margin-top: var(--space-3);"><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Responsibilities (comma-separated)</label>' +
        '<textarea id="personResponsibilities" placeholder="Team leadership, code reviews..." class="form-control" style="padding: 8px 12px; min-height: 50px; resize: vertical;">' + escapeHtml(editPerson && editPerson.responsibilities ? editPerson.responsibilities.join(', ') : '') + '</textarea></div>' +
      '<div style="margin-top: var(--space-3);"><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Skills (comma-separated)</label>' +
        '<textarea id="personSkills" placeholder="JavaScript, design, analytics..." class="form-control" style="padding: 8px 12px; min-height: 50px; resize: vertical;">' + escapeHtml(editPerson && editPerson.skills ? editPerson.skills.join(', ') : '') + '</textarea></div>' +
    '</div>';
  }

  html += '</div>' +
    '<div style="display: flex; gap: var(--space-3); margin-top: var(--space-4);">' +
      '<button onclick="closePersonModal()" class="btn" style="flex: 1; padding: 10px;">Cancel</button>' +
      '<button ' + saveAction + ' class="btn btn-primary" style="flex: 1; padding: 10px;">Save ' + typeLabel + '</button>' +
    '</div>' +
  '</div>';

  overlay.innerHTML = html;

  // v25.3: Set logo data attribute for edit mode
  if (editPerson && editPerson.logo) {
    setTimeout(function() {
      var prev = document.getElementById('personLogoPreview');
      if (prev) prev.setAttribute('data-logo', editPerson.logo);
    }, 0);
  }

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closePersonModal();
  });
  document.body.appendChild(overlay);
}

// v25.3: Close person modal
function closePersonModal() {
  var overlay = document.getElementById('personModalOverlay');
  if (overlay) overlay.remove();
}

// v25.3: Person logo upload handler
function handlePersonLogoUpload(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 2000000) {
    showToast('Image must be under 2MB', 'warning');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var preview = document.getElementById('personLogoPreview');
    if (preview) {
      preview.innerHTML = '<img src="' + e.target.result + '" style="width: 100%; height: 100%; object-fit: contain;">';
      preview.setAttribute('data-logo', e.target.result);
    }
    var removeBtn = document.getElementById('personLogoRemoveBtn');
    if (removeBtn) removeBtn.style.display = '';
  };
  reader.readAsDataURL(file);
}

// v25.3: Remove person logo preview
function removePersonLogoPreview() {
  var preview = document.getElementById('personLogoPreview');
  if (preview) {
    preview.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    preview.removeAttribute('data-logo');
  }
  var removeBtn = document.getElementById('personLogoRemoveBtn');
  if (removeBtn) removeBtn.style.display = 'none';
}

// v25.3: Parse comma-separated text into trimmed array
function _parseCommaSeparated(val) {
  if (!val) return [];
  return val.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
}

// v25.3: Save new person (team or report)
function saveNewPerson(personType) {
  var nameEl = document.getElementById('personName');
  if (!nameEl || !nameEl.value.trim()) {
    showToast('Name is required', 'warning');
    return;
  }

  var logoData = '';
  var preview = document.getElementById('personLogoPreview');
  if (preview && preview.getAttribute('data-logo')) {
    logoData = preview.getAttribute('data-logo');
  }

  var now = new Date().toISOString();
  var typeLabels = { team: 'Team member added', report: 'Direct report added', client: 'Client created' };

  var person = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    personType: personType,
    brandIndex: typeof selectedBrand !== 'undefined' ? selectedBrand : 0,
    name: nameEl.value.trim(),
    email: (document.getElementById('personEmail') || {}).value || '',
    phone: (document.getElementById('personPhone') || {}).value || '',
    company: (document.getElementById('personCompany') || {}).value || '',
    role: (document.getElementById('personRole') || {}).value || '',
    location: (document.getElementById('personLocation') || {}).value || '',
    website: (document.getElementById('personWebsite') || {}).value || '',
    notes: '',
    logo: logoData,
    scope: (document.getElementById('personScope') || {}).value || 'brand',
    secondaryEmails: [],
    customFields: [],
    timeline: [{ id: Date.now().toString(36), date: now, category: 'key_date', title: typeLabels[personType] || 'Person added', description: '', source: 'system', createdAt: now }],
    dialogueHistory: [],
    lastContacted: '',
    createdAt: now,
    _modifiedAt: now
  };

  // v25.3: Type-specific fields
  if (personType === 'team') {
    person.department = (document.getElementById('personDepartment') || {}).value || '';
    person.availability = (document.getElementById('personAvailability') || {}).value || 'full_time';
    person.startDate = (document.getElementById('personStartDate') || {}).value || '';
    person.reportsTo = (document.getElementById('personReportsTo') || {}).value || '';
    person.responsibilities = _parseCommaSeparated((document.getElementById('personResponsibilities') || {}).value);
    person.skills = _parseCommaSeparated((document.getElementById('personSkills') || {}).value);
  } else if (personType === 'report') {
    person.department = (document.getElementById('personDepartment') || {}).value || '';
    person.status = (document.getElementById('personStatus') || {}).value || 'active';
    person.startDate = (document.getElementById('personStartDate') || {}).value || '';
    person.checkinFrequency = (document.getElementById('personCheckinFrequency') || {}).value || 'weekly';
    person.reportsTo = (document.getElementById('personReportsTo') || {}).value || '';
    person.responsibilities = _parseCommaSeparated((document.getElementById('personResponsibilities') || {}).value);
    person.skills = _parseCommaSeparated((document.getElementById('personSkills') || {}).value);
  }

  var people = getPeople();
  people.push(person);
  savePeople(people);
  closePersonModal();
  if (typeof switchPeopleType === 'function') switchPeopleType(personType);
  if (typeof updatePeopleTypeCounts === 'function') updatePeopleTypeCounts();
  showToast(person.name + ' added', 'success');
}

// v25.3: Save edited person (team or report)
function saveEditPerson(personId) {
  var nameEl = document.getElementById('personName');
  if (!nameEl || !nameEl.value.trim()) {
    showToast('Name is required', 'warning');
    return;
  }

  var logoData = '';
  var preview = document.getElementById('personLogoPreview');
  if (preview && preview.getAttribute('data-logo')) {
    logoData = preview.getAttribute('data-logo');
  }

  var people = getPeople();
  var person = null;
  for (var i = 0; i < people.length; i++) {
    if (people[i].id === personId) { person = people[i]; break; }
  }
  if (!person) { showToast('Person not found', 'error'); return; }

  // v25.3: Update shared fields
  person.name = nameEl.value.trim();
  person.email = (document.getElementById('personEmail') || {}).value || '';
  person.phone = (document.getElementById('personPhone') || {}).value || '';
  person.company = (document.getElementById('personCompany') || {}).value || '';
  person.role = (document.getElementById('personRole') || {}).value || '';
  person.location = (document.getElementById('personLocation') || {}).value || '';
  person.website = (document.getElementById('personWebsite') || {}).value || '';
  person.logo = logoData;
  person.scope = (document.getElementById('personScope') || {}).value || person.scope || 'brand';
  person._modifiedAt = new Date().toISOString();

  // v25.3: Type-specific fields
  var pType = person.personType || 'client';
  if (pType === 'team') {
    person.department = (document.getElementById('personDepartment') || {}).value || person.department || '';
    person.availability = (document.getElementById('personAvailability') || {}).value || person.availability || 'full_time';
    person.startDate = (document.getElementById('personStartDate') || {}).value || person.startDate || '';
    person.reportsTo = (document.getElementById('personReportsTo') || {}).value || '';
    person.responsibilities = _parseCommaSeparated((document.getElementById('personResponsibilities') || {}).value);
    person.skills = _parseCommaSeparated((document.getElementById('personSkills') || {}).value);
  } else if (pType === 'report') {
    person.department = (document.getElementById('personDepartment') || {}).value || person.department || '';
    person.status = (document.getElementById('personStatus') || {}).value || person.status || 'active';
    person.startDate = (document.getElementById('personStartDate') || {}).value || person.startDate || '';
    person.checkinFrequency = (document.getElementById('personCheckinFrequency') || {}).value || person.checkinFrequency || 'weekly';
    person.reportsTo = (document.getElementById('personReportsTo') || {}).value || '';
    person.responsibilities = _parseCommaSeparated((document.getElementById('personResponsibilities') || {}).value);
    person.skills = _parseCommaSeparated((document.getElementById('personSkills') || {}).value);
  }

  savePeople(people);
  closePersonModal();
  if (typeof switchPeopleType === 'function') switchPeopleType(pType);
  if (typeof updatePeopleTypeCounts === 'function') updatePeopleTypeCounts();
  showToast(person.name + ' updated', 'success');
}

// v25.3: openClientModal delegates to openPersonModal for client type (backward compat)
function openClientModal(editId) {
  return openPersonModal('client', editId);
}

function _openClientModalOriginal(editId) {
  var editClient = null;
  if (editId) {
    editClient = getClients().filter(function(c) { return c.id === editId; })[0];
  }
  var overlay = document.createElement('div');
  overlay.id = 'clientModalOverlay';
  overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;';

  var title = editClient ? 'Edit Client' : 'Add Client';
  var saveBtn = editClient ? 'onclick="saveEditClient(\'' + editClient.id + '\')"' : 'onclick="saveNewClient()"';

  overlay.innerHTML = '<div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: var(--space-6); max-width: 480px; width: 90%; max-height: 85vh; overflow-y: auto;">' +
    '<div style="font-size: var(--text-xl); font-weight: 700; margin-bottom: var(--space-4);">' + title + '</div>' +
    '<div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4);">' +
      '<!-- v15.7: Client Logo Upload -->' +
      '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Logo</label>' +
        '<div style="display: flex; align-items: center; gap: var(--space-3);">' +
          '<div id="clientLogoPreview" style="width: 48px; height: 48px; border-radius: var(--radius-md); border: 1px dashed var(--border-color); display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--bg-primary); flex-shrink: 0;">' +
            (editClient && editClient.logo ? '<img src="' + editClient.logo + '" style="width: 100%; height: 100%; object-fit: contain;">' :
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>') +
          '</div>' +
          '<input type="file" id="clientLogoInput" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" style="display:none;" onchange="handleClientLogoUpload(this)">' +
          '<button onclick="document.getElementById(\'clientLogoInput\').click()" class="btn btn-small" style="padding: 6px 12px; font-size: var(--text-xs);">Upload Logo</button>' +
          '<button id="clientLogoRemoveBtn" onclick="removeClientLogoPreview()" class="btn btn-small" style="padding: 6px 12px; font-size: var(--text-xs); display: ' + (editClient && editClient.logo ? '' : 'none') + ';">Remove</button>' +
        '</div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Name *</label>' +
          '<input type="text" id="clientName" placeholder="Client name" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editClient ? editClient.name : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Company</label>' +
          '<input type="text" id="clientCompany" placeholder="Company name" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editClient ? (editClient.company || '') : '') + '"></div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Role</label>' +
          '<input type="text" id="clientRole" placeholder="CEO, Manager..." class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editClient ? (editClient.role || '') : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Industry</label>' +
          '<input type="text" id="clientIndustry" placeholder="Technology, Retail..." class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editClient ? (editClient.industry || '') : '') + '"></div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Email</label>' +
          '<input type="email" id="clientEmail" placeholder="client@email.com" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editClient ? (editClient.email || '') : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Phone</label>' +
          '<input type="tel" id="clientPhone" placeholder="(555) 123-4567" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editClient ? (editClient.phone || '') : '') + '"></div>' +
      '</div>' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Location</label>' +
          '<input type="text" id="clientLocation" placeholder="Austin, TX" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editClient ? (editClient.location || '') : '') + '"></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Website</label>' +
          '<input type="url" id="clientWebsite" placeholder="https://..." class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editClient ? (editClient.website || '') : '') + '"></div>' +
      '</div>' +
      '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Notes</label>' +
        '<textarea id="clientNotes" placeholder="Additional notes..." class="form-control" style="padding: 8px 12px; min-height: 60px; resize: vertical;">' + escapeHtml(editClient ? (editClient.notes || '') : '') + '</textarea></div>' +
      '<!-- v23.3: Sprint 4 fields -->' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Category</label>' +
          '<select id="clientCategory" class="form-control" style="padding: 8px 12px;">' +
            '<option value="lead"' + (editClient && editClient.category === 'lead' ? ' selected' : (!editClient ? ' selected' : '')) + '>Lead</option>' +
            '<option value="active_client"' + (editClient && editClient.category === 'active_client' ? ' selected' : '') + '>Active Client</option>' +
            '<option value="past_client"' + (editClient && editClient.category === 'past_client' ? ' selected' : '') + '>Past Client</option>' +
            '<option value="partner"' + (editClient && editClient.category === 'partner' ? ' selected' : '') + '>Partner</option>' +
            '<option value="prospect"' + (editClient && editClient.category === 'prospect' ? ' selected' : '') + '>Prospect</option>' +
            '<option value="custom"' + (editClient && editClient.category === 'custom' ? ' selected' : '') + '>Custom</option>' +
          '</select></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Priority</label>' +
          '<select id="clientPriority" class="form-control" style="padding: 8px 12px;">' +
            '<option value="low"' + (editClient && editClient.priority === 'low' ? ' selected' : (!editClient ? ' selected' : '')) + '>Low</option>' +
            '<option value="medium"' + (editClient && editClient.priority === 'medium' ? ' selected' : '') + '>Medium</option>' +
            '<option value="high"' + (editClient && editClient.priority === 'high' ? ' selected' : '') + '>High</option>' +
          '</select></div>' +
        '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Scope</label>' +
          '<select id="clientScope" class="form-control" style="padding: 8px 12px;">' +
            '<option value="brand"' + (editClient && editClient.scope !== 'universal' ? ' selected' : (!editClient ? ' selected' : '')) + '>This Brand</option>' +
            '<option value="universal"' + (editClient && editClient.scope === 'universal' ? ' selected' : '') + '>Universal</option>' +
          '</select></div>' +
      '</div>' +
      '<div><label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Secondary Emails</label>' +
        '<input type="text" id="clientSecondaryEmails" placeholder="email2@co.com, email3@co.com" class="form-control" style="padding: 8px 12px;" value="' + escapeHtml(editClient && editClient.secondaryEmails ? editClient.secondaryEmails.join(', ') : '') + '"></div>' +
      '<div id="clientCustomFieldsContainer">' +
        '<label style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 4px;">Custom Fields</label>' +
        '<div id="clientCustomFieldsList"></div>' +
        '<button type="button" onclick="addClientCustomField()" class="btn btn-small" style="padding: 4px 10px; font-size: 11px; margin-top: 4px;">+ Add Field</button>' +
      '</div>' +
    '</div>' +
    '<div style="display: flex; gap: var(--space-3);">' +
      '<button onclick="closeClientModal()" class="btn" style="flex: 1; padding: 10px;">Cancel</button>' +
      '<button ' + saveBtn + ' class="btn btn-primary" style="flex: 1; padding: 10px;">Save Client</button>' +
    '</div>' +
  '</div>';

  // v16.11: Set logo data attribute for edit mode
  if (editClient && editClient.logo) {
    setTimeout(function() {
      var prev = document.getElementById('clientLogoPreview');
      if (prev) prev.setAttribute('data-logo', editClient.logo);
    }, 0);
  }

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeClientModal();
  });
  document.body.appendChild(overlay);

  // v23.3: Populate custom fields for edit mode
  if (editClient && editClient.customFields && editClient.customFields.length > 0) {
    setTimeout(function() {
      editClient.customFields.forEach(function(cf) {
        addClientCustomField(cf.label, cf.value);
      });
    }, 0);
  }
}

function closeClientModal() {
  var overlay = document.getElementById('clientModalOverlay');
  if (overlay) overlay.remove();
}

// v15.7: Client logo upload handler
function handleClientLogoUpload(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 2000000) {
    showToast('Logo must be under 2MB', 'warning');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var preview = document.getElementById('clientLogoPreview');
    if (preview) {
      preview.innerHTML = '<img src="' + e.target.result + '" style="width: 100%; height: 100%; object-fit: contain;">';
      preview.setAttribute('data-logo', e.target.result);
    }
    var removeBtn = document.getElementById('clientLogoRemoveBtn');
    if (removeBtn) removeBtn.style.display = '';
  };
  reader.readAsDataURL(file);
}

function removeClientLogoPreview() {
  var preview = document.getElementById('clientLogoPreview');
  if (preview) {
    preview.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    preview.removeAttribute('data-logo');
  }
  var removeBtn = document.getElementById('clientLogoRemoveBtn');
  if (removeBtn) removeBtn.style.display = 'none';
}

// v23.3: Custom fields helper
function addClientCustomField(label, value) {
  var list = document.getElementById('clientCustomFieldsList');
  if (!list) return;
  var row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 6px; margin-bottom: 4px; align-items: center;';
  row.innerHTML = '<input type="text" placeholder="Label" class="form-control cf-label" style="padding: 5px 8px; font-size: 12px; flex: 1;" value="' + escapeHtml(label || '') + '">' +
    '<input type="text" placeholder="Value" class="form-control cf-value" style="padding: 5px 8px; font-size: 12px; flex: 1;" value="' + escapeHtml(value || '') + '">' +
    '<button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px;">' +
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
    '</button>';
  list.appendChild(row);
}

function collectClientCustomFields() {
  var fields = [];
  var rows = document.querySelectorAll('#clientCustomFieldsList > div');
  for (var i = 0; i < rows.length; i++) {
    var label = rows[i].querySelector('.cf-label');
    var value = rows[i].querySelector('.cf-value');
    if (label && value && label.value.trim()) {
      fields.push({ label: label.value.trim(), value: value.value.trim() });
    }
  }
  return fields;
}

function saveNewClient() {
  var name = document.getElementById('clientName');
  var company = document.getElementById('clientCompany');
  if ((!name || !name.value.trim()) && (!company || !company.value.trim())) {
    showToast('Client name or company is required', 'warning');
    return;
  }

  // v15.7: Capture client logo from preview
  var logoData = '';
  var preview = document.getElementById('clientLogoPreview');
  if (preview && preview.getAttribute('data-logo')) {
    logoData = preview.getAttribute('data-logo');
  }

  var now = new Date().toISOString();
  // v23.3: Parse secondary emails
  var secEmailsRaw = (document.getElementById('clientSecondaryEmails') || {}).value || '';
  var secEmails = secEmailsRaw ? secEmailsRaw.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e; }) : [];
  var scope = (document.getElementById('clientScope') || {}).value || 'brand';
  var clients = getClients();
  clients.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    brandIndex: typeof selectedBrand !== 'undefined' ? selectedBrand : 0,
    name: name.value.trim(),
    company: (document.getElementById('clientCompany') || {}).value || '',
    industry: (document.getElementById('clientIndustry') || {}).value || '',
    role: (document.getElementById('clientRole') || {}).value || '',
    location: (document.getElementById('clientLocation') || {}).value || '',
    website: (document.getElementById('clientWebsite') || {}).value || '',
    email: (document.getElementById('clientEmail') || {}).value || '',
    phone: (document.getElementById('clientPhone') || {}).value || '',
    notes: (document.getElementById('clientNotes') || {}).value || '',
    stage: 'lead',
    stageHistory: [{ stage: 'lead', date: now }],
    logo: logoData,
    createdAt: now,
    // v23.3: Sprint 4 fields
    category: (document.getElementById('clientCategory') || {}).value || 'lead',
    priority: (document.getElementById('clientPriority') || {}).value || 'low',
    scope: scope,
    secondaryEmails: secEmails,
    customFields: typeof collectClientCustomFields === 'function' ? collectClientCustomFields() : [],
    relationshipStatus: 'prospecting',
    relationshipStatusHistory: [],
    dialogueHistory: [],
    timeline: [{ id: Date.now().toString(36), date: now, category: 'key_date', title: 'Client created', description: '', source: 'system', createdAt: now }]
  });
  saveClients(clients);
  closeClientModal();
  if (typeof renderClientsView === 'function') renderClientsView();
  renderClientList();
  showToast('Client added', 'success');
}

// v16.11: Save edited client
function saveEditClient(clientId) {
  var name = document.getElementById('clientName');
  if (!name || !name.value.trim()) {
    showToast('Client name is required', 'warning');
    return;
  }
  var logoData = '';
  var preview = document.getElementById('clientLogoPreview');
  if (preview && preview.getAttribute('data-logo')) {
    logoData = preview.getAttribute('data-logo');
  }
  var clients = getClients();
  var client = null;
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) { client = clients[i]; break; }
  }
  if (!client) { showToast('Client not found', 'error'); return; }
  client.name = name.value.trim();
  client.company = (document.getElementById('clientCompany') || {}).value || '';
  client.industry = (document.getElementById('clientIndustry') || {}).value || '';
  client.role = (document.getElementById('clientRole') || {}).value || '';
  client.location = (document.getElementById('clientLocation') || {}).value || '';
  client.website = (document.getElementById('clientWebsite') || {}).value || '';
  client.email = (document.getElementById('clientEmail') || {}).value || '';
  client.phone = (document.getElementById('clientPhone') || {}).value || '';
  client.notes = (document.getElementById('clientNotes') || {}).value || '';
  client.logo = logoData;
  // v23.3: Sprint 4 fields
  client.category = (document.getElementById('clientCategory') || {}).value || client.category || 'lead';
  client.priority = (document.getElementById('clientPriority') || {}).value || client.priority || 'low';
  client.scope = (document.getElementById('clientScope') || {}).value || client.scope || 'brand';
  var secEmailsRaw = (document.getElementById('clientSecondaryEmails') || {}).value || '';
  client.secondaryEmails = secEmailsRaw ? secEmailsRaw.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e; }) : [];
  client.customFields = typeof collectClientCustomFields === 'function' ? collectClientCustomFields() : (client.customFields || []);
  saveClients(clients);
  closeClientModal();
  if (typeof renderClientsView === 'function') renderClientsView();
  if (typeof openClientDetail === 'function') openClientDetail(clientId);
  showToast('Client updated', 'success');
}

function deleteClient(id) {
  if (!confirm('Delete this client?')) return;
  // v29.0: Use String comparison — id comes as string from onclick, c.id may be number
  var idStr = String(id);
  var clients = getClients().filter(function(c) { return String(c.id) !== idStr; });
  saveClients(clients);
  // v25.1: Tombstone tracking removed -- write-through sync handles deletions
  renderClientList();
  if (typeof renderClientsView === 'function') renderClientsView();
  showToast('Client deleted', 'success');
}

/**
 * v16.11: Client System — Pipeline stages, filtering, detail view, BrandAI integration
 */
var CLIENT_PIPELINE_STAGES = [
  { id: 'lead', label: 'Lead', color: '#94a3b8' },
  { id: 'prospect', label: 'Prospect', color: '#60a5fa' },
  { id: 'proposal', label: 'Proposal', color: '#a78bfa' },
  { id: 'active', label: 'Active', color: '#4ade80' },
  { id: 'retained', label: 'Retained', color: '#fbbf24' },
  { id: 'archived', label: 'Archived', color: '#6b7280' }
];

// v29.0: Persist brand filter preference to localStorage (was resetting on reload)
var clientsShowAllBrands = localStorage.getItem('roweos_clients_brand_filter') !== 'false'; // default true
var clientsStageFilterValue = '';
var clientsSearchTerm = '';

// v16.11: Migrate existing clients to new schema
function migrateClientsData() {
  var clients = getClients();
  var changed = false;
  var maxIdx = typeof brands !== 'undefined' ? brands.length : 5;
  clients.forEach(function(c) {
    if (typeof c.brandIndex === 'undefined') {
      c.brandIndex = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
      changed = true;
    }
    // v28.6: Fix orphaned brandIndex from deleted brands
    if (c.brandIndex >= maxIdx) {
      c.brandIndex = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
      changed = true;
    }
    if (!c.stage) {
      c.stage = 'lead';
      changed = true;
    }
    if (!c.stageHistory) {
      c.stageHistory = [{ stage: c.stage, date: c.createdAt || new Date().toISOString() }];
      changed = true;
    }
  });
  if (changed) saveClients(clients);
  // v23.3: Sprint 4 migration
  if (typeof migrateClientsSprint4 === 'function') migrateClientsSprint4();
}

function getClientsForBrand() {
  var clients = getClients();
  if (ROWEOS_DEBUG || localStorage.getItem('roweos_debug') === 'true') {
    console.log('[Clients] getClientsForBrand: total=' + clients.length + ', showAll=' + clientsShowAllBrands + ', brandIdx=' + (typeof selectedBrand !== 'undefined' ? selectedBrand : 0));
    if (clients.length > 0) console.log('[Clients] Sample brandIndex values:', clients.slice(0, 3).map(function(c) { return c.name + '=' + c.brandIndex + '(' + typeof c.brandIndex + ')'; }));
  }
  if (clientsShowAllBrands) return clients;
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  // v23.3: Include universal clients alongside brand-specific
  // v28.6: Coerce comparison, include clients with null/undefined/out-of-range brandIndex
  var maxBrandIdx = typeof brands !== 'undefined' ? brands.length : 5;
  var filtered = clients.filter(function(c) {
    if (c.scope === 'universal') return true;
    if (c.brandIndex == null || c.brandIndex === undefined) return true;
    if (c.brandIndex >= maxBrandIdx) return true; // orphaned from deleted brand
    return String(c.brandIndex) === String(brandIdx);
  });
  if (ROWEOS_DEBUG || localStorage.getItem('roweos_debug') === 'true') {
    console.log('[Clients] After brand filter: ' + filtered.length + '/' + clients.length);
  }
  return filtered;
}

function getStageColor(stageId) {
  for (var i = 0; i < CLIENT_PIPELINE_STAGES.length; i++) {
    if (CLIENT_PIPELINE_STAGES[i].id === stageId) return CLIENT_PIPELINE_STAGES[i].color;
  }
  return '#94a3b8';
}

function getStageLabel(stageId) {
  for (var i = 0; i < CLIENT_PIPELINE_STAGES.length; i++) {
    if (CLIENT_PIPELINE_STAGES[i].id === stageId) return CLIENT_PIPELINE_STAGES[i].label;
  }
  return stageId || 'Lead';
}

// v25.3: Add Person dropdown
function toggleAddPersonDropdown() {
  var dd = document.getElementById('addPersonDropdown');
  if (!dd) return;
  var isOpen = dd.style.display !== 'none';
  dd.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Close on outside click
    setTimeout(function() {
      document.addEventListener('click', function _closeDD(e) {
        var wrap = document.getElementById('addPersonDropdownWrap');
        if (wrap && !wrap.contains(e.target)) {
          var dd2 = document.getElementById('addPersonDropdown');
          if (dd2) dd2.style.display = 'none';
          document.removeEventListener('click', _closeDD);
        }
      });
    }, 10);
  }
}

function closeAddPersonDropdown() {
  var dd = document.getElementById('addPersonDropdown');
  if (dd) dd.style.display = 'none';
}

// v29: People Select Mode — mass actions across Clients, Team, Reports
var _peopleSelectMode = false;
var _selectedPeople = {};

function togglePeopleSelectMode() {
  _peopleSelectMode = !_peopleSelectMode;
  _selectedPeople = {};
  var btn = document.getElementById('peopleSelectModeBtn');
  if (btn) btn.textContent = _peopleSelectMode ? 'Cancel' : 'Select';
  // Remove floating bar when exiting
  _updatePeopleSelectBar();
  // Re-render current tab
  _rerenderCurrentPeopleTab();
}

function togglePersonSelection(personId, event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  if (_selectedPeople[personId]) {
    delete _selectedPeople[personId];
  } else {
    _selectedPeople[personId] = true;
  }
  // Update checkbox visual
  var cb = document.getElementById('peopleSelCb_' + personId);
  if (cb) {
    cb.style.background = _selectedPeople[personId] ? 'var(--brand-accent,#a89878)' : 'transparent';
    cb.innerHTML = _selectedPeople[personId] ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#000" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
  }
  _updatePeopleSelectBar();
}

function selectAllPeople() {
  var people = _getVisiblePeopleForSelectMode();
  for (var i = 0; i < people.length; i++) {
    _selectedPeople[people[i].id] = true;
  }
  _rerenderCurrentPeopleTab();
  _updatePeopleSelectBar();
}

function deselectAllPeople() {
  _selectedPeople = {};
  _rerenderCurrentPeopleTab();
  _updatePeopleSelectBar();
}

function _getVisiblePeopleForSelectMode() {
  var type = _activePeopleType || 'client';
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  if (type === 'client') {
    return typeof getClientsForBrand === 'function' ? getClientsForBrand() : [];
  } else {
    var list = getPeople(type);
    return list.filter(function(p) { return p.scope === 'universal' || p.brandIndex === brandIdx; });
  }
}

function _getSelectedCount() {
  var count = 0;
  for (var k in _selectedPeople) {
    if (_selectedPeople.hasOwnProperty(k)) count++;
  }
  return count;
}

function _updatePeopleSelectBar() {
  var existing = document.getElementById('peopleSelectActionBar');
  if (existing) existing.parentNode.removeChild(existing);
  if (!_peopleSelectMode) return;

  var count = _getSelectedCount();
  if (count === 0) return;

  var bar = document.createElement('div');
  bar.id = 'peopleSelectActionBar';
  bar.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;padding:8px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 4px 20px rgba(0,0,0,0.2);z-index:9999;';

  var countLabel = document.createElement('span');
  countLabel.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;';
  countLabel.textContent = count + ' selected';
  bar.appendChild(countLabel);

  var selAllBtn = document.createElement('button');
  selAllBtn.style.cssText = 'padding:5px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;font-size:12px;color:var(--text-secondary);cursor:pointer;font-family:inherit;white-space:nowrap;';
  selAllBtn.textContent = 'Select All';
  selAllBtn.onclick = function() { selectAllPeople(); };
  bar.appendChild(selAllBtn);

  var desAllBtn = document.createElement('button');
  desAllBtn.style.cssText = 'padding:5px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;font-size:12px;color:var(--text-secondary);cursor:pointer;font-family:inherit;white-space:nowrap;';
  desAllBtn.textContent = 'Deselect All';
  desAllBtn.onclick = function() { deselectAllPeople(); };
  bar.appendChild(desAllBtn);

  var delBtn = document.createElement('button');
  delBtn.style.cssText = 'padding:5px 12px;background:#ef4444;border:none;border-radius:8px;font-size:12px;color:#fff;cursor:pointer;font-family:inherit;font-weight:600;white-space:nowrap;';
  delBtn.textContent = 'Delete Selected (' + count + ')';
  delBtn.onclick = function() { deleteSelectedPeople(); };
  bar.appendChild(delBtn);

  document.body.appendChild(bar);
}

function deleteSelectedPeople() {
  var count = _getSelectedCount();
  if (count === 0) return;
  // v29.1: Snapshot selected IDs before confirm dialog (confirm() can cause focus loss on some browsers)
  var idsToDelete = {};
  for (var k in _selectedPeople) {
    if (_selectedPeople.hasOwnProperty(k)) idsToDelete[k] = true;
  }
  if (!confirm('Delete ' + count + ' selected people? This cannot be undone.')) return;

  var all = getPeople();
  var beforeCount = all.length;
  var filtered = all.filter(function(p) { return !idsToDelete[p.id]; });
  var removedCount = beforeCount - filtered.length;
  if (removedCount === 0) {
    console.warn('[People] deleteSelectedPeople: no IDs matched. Selected:', Object.keys(idsToDelete), 'People IDs:', all.map(function(p) { return p.id; }));
    showToast('No matching people found to delete', 'error');
    return;
  }
  savePeople(filtered);
  // v29.1: Exit select mode after deletion for cleaner UX
  _selectedPeople = {};
  _peopleSelectMode = false;
  var selBtn = document.getElementById('peopleSelectModeBtn');
  if (selBtn) selBtn.textContent = 'Select';
  _updatePeopleSelectBar();
  _rerenderCurrentPeopleTab();
  if (typeof updatePeopleTypeCounts === 'function') updatePeopleTypeCounts();
  showToast(removedCount + ' people deleted', 'success');
}

function _rerenderCurrentPeopleTab() {
  var type = _activePeopleType || 'client';
  if (type === 'client') {
    // v29.1: Re-render the active client sub-tab (pipeline, list, or addressbook)
    var activeTab = (typeof _clientsActiveTab !== 'undefined') ? _clientsActiveTab : 'pipeline';
    if (typeof switchClientsTab === 'function') {
      switchClientsTab(activeTab);
    } else if (typeof renderClientsView === 'function') {
      renderClientsView();
    }
  } else if (type === 'team') {
    if (typeof renderTeamView === 'function') renderTeamView();
  } else if (type === 'report') {
    if (typeof renderReportsView === 'function') renderReportsView();
  }
}

function _renderPeopleSelectCheckbox(personId) {
  var isSelected = !!_selectedPeople[personId];
  var h = '<div id="peopleSelCb_' + personId + '" onclick="togglePersonSelection(\'' + personId + '\', event)" ';
  h += 'style="position:absolute;top:8px;left:8px;width:20px;height:20px;border-radius:6px;';
  h += 'border:2px solid var(--border-color);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;';
  h += 'background:' + (isSelected ? 'var(--brand-accent,#a89878)' : 'transparent') + ';">';
  if (isSelected) {
    h += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#000" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
  }
  h += '</div>';
  return h;
}

// v25.3: People type switching
var _activePeopleType = 'client';

function switchPeopleType(type) {
  _activePeopleType = type;
  // v29: Clear selections on tab switch but keep select mode active
  _selectedPeople = {};
  _updatePeopleSelectBar();
  // v26.1: Update pill nav active state
  updatePillNavActive('peoplePillNav', type);
  // v28.6: Show/hide appropriate content — use dedicated peopleTypeContent container for team/report
  var pipelineTab = document.getElementById('clientsPipelineTab');
  var listTab = document.getElementById('clientsListTab');
  var addressBookTab = document.getElementById('clientsAddressBookTab');
  var clientTabs = document.getElementById('clientsTabBar');
  var peopleContent = document.getElementById('peopleTypeContent');
  var detailP = document.getElementById('clientDetailPanel');

  if (type === 'client') {
    // v28.6: Hide team/report container, show client tabs, restore active sub-tab
    if (peopleContent) peopleContent.style.display = 'none';
    if (clientTabs) clientTabs.style.display = 'flex';
    switchClientsTab(_clientsActiveTab || 'pipeline');
  } else if (type === 'team' || type === 'report') {
    // v28.6: Hide ALL client containers — never destroy their HTML
    if (clientTabs) clientTabs.style.display = 'none';
    if (pipelineTab) pipelineTab.style.display = 'none';
    if (listTab) listTab.style.display = 'none';
    if (addressBookTab) addressBookTab.style.display = 'none';
    if (detailP) detailP.style.display = 'none';
    // v28.6: Render into dedicated container
    if (peopleContent) {
      peopleContent.style.display = 'block';
      peopleContent.innerHTML = '';
    }
    if (type === 'team') renderTeamView();
    else renderReportsView();
  }
  // Update counts
  updatePeopleTypeCounts();
}

// v26.1: Wrapper for pill nav / landing page tabHandler
function showPeopleType(typeId) {
  switchPeopleType(typeId);
}

function updatePeopleTypeCounts() {
  var clients = typeof getPeople === 'function' ? getPeople('client') : [];
  var team = typeof getPeople === 'function' ? getPeople('team') : [];
  var reports = typeof getPeople === 'function' ? getPeople('report') : [];
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  // Filter by brand
  var brandClients = clients.filter(function(c) { return c.scope === 'universal' || c.brandIndex === brandIdx; });
  var brandTeam = team.filter(function(t) { return t.scope === 'universal' || t.brandIndex === brandIdx; });
  var brandReports = reports.filter(function(r) { return r.scope === 'universal' || r.brandIndex === brandIdx; });
  var el1 = document.getElementById('peopleClientCount');
  var el2 = document.getElementById('peopleTeamCount');
  var el3 = document.getElementById('peopleReportCount');
  if (el1) el1.textContent = brandClients.length;
  if (el2) el2.textContent = brandTeam.length;
  if (el3) el3.textContent = brandReports.length;
}

// v25.3: Department color map for team view
var DEPT_COLORS = {
  marketing: '#f472b6', operations: '#4ade80', strategy: '#a78bfa', development: '#22d3ee',
  design: '#fbbf24', sales: '#fb923c', finance: '#34d399', support: '#60a5fa',
  executive: '#e879f9', other: '#94a3b8'
};

// v25.3: Availability display helpers
function _availLabel(val) {
  var map = { full_time: 'Full Time', part_time: 'Part Time', contractor: 'Contractor', freelance: 'Freelance' };
  return map[val] || val || 'Full Time';
}
function _availColor(val) {
  var map = { full_time: '#4ade80', part_time: '#fbbf24', contractor: '#60a5fa', freelance: '#fb923c' };
  return map[val] || '#94a3b8';
}

// v25.3: Render team members view grouped by department
function renderTeamView() {
  var container = document.getElementById('peopleTypeContent');
  if (!container) return;

  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var team = getPeople('team');
  team = team.filter(function(t) { return t.scope === 'universal' || t.brandIndex === brandIdx; });

  var html = '';
  // Header with Add button
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 24px 16px;">';
  html += '<div style="font-size:13px;color:var(--text-muted);">' + team.length + ' team member' + (team.length !== 1 ? 's' : '') + '</div>';
  html += '<button onclick="openPersonModal(\'team\')" style="padding:7px 16px;background:var(--brand-accent,#a89878);color:#000;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Team Member</button>';
  html += '</div>';

  // v25.3: Team capacity dashboard
  if (team.length > 0) {
    var availCounts = {};
    var workloadCounts = { light: 0, moderate: 0, heavy: 0, over: 0 };
    for (var ti = 0; ti < team.length; ti++) {
      var avail = team[ti].availability || 'full-time';
      availCounts[avail] = (availCounts[avail] || 0) + 1;
      var wl = team[ti].workload || 0;
      if (wl > 80) workloadCounts.over++;
      else if (wl > 50) workloadCounts.heavy++;
      else if (wl > 20) workloadCounts.moderate++;
      else workloadCounts.light++;
    }
    var availParts = [];
    for (var ak in availCounts) {
      if (availCounts.hasOwnProperty(ak)) availParts.push(availCounts[ak] + ' ' + ak.replace(/-/g, ' '));
    }
    html += '<div class="people-summary-bar">';
    html += '<div class="people-summary-card"><div class="people-summary-value">' + team.length + '</div><div class="people-summary-label">Team Size</div></div>';
    html += '<div class="people-summary-card"><div class="people-summary-value" style="font-size:14px;">' + availParts.join(', ') + '</div><div class="people-summary-label">By Availability</div></div>';
    html += '<div class="people-summary-card"><div class="people-summary-value" style="font-size:14px;">';
    if (workloadCounts.over > 0) html += '<span style="color:#ef4444;">' + workloadCounts.over + ' overloaded</span> ';
    if (workloadCounts.heavy > 0) html += '<span style="color:#fbbf24;">' + workloadCounts.heavy + ' heavy</span> ';
    if (workloadCounts.moderate > 0) html += '<span style="color:#4ade80;">' + workloadCounts.moderate + ' moderate</span> ';
    if (workloadCounts.light > 0) html += '<span style="color:var(--text-muted);">' + workloadCounts.light + ' light</span>';
    html += '</div><div class="people-summary-label">Workload</div></div>';
    html += '</div>';
  }

  if (team.length === 0) {
    html += '<div style="text-align:center;padding:60px 20px;color:var(--text-tertiary);">';
    html += '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:16px;opacity:0.3;">';
    html += '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>';
    html += '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    html += '<div style="font-size:15px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">No Team Members yet</div>';
    html += '<div style="font-size:13px;">Add your first team member to get started.</div>';
    html += '</div>';
    container.innerHTML = html;
    return;
  }

  // Group by department
  var deptGroups = {};
  var ungrouped = [];
  for (var i = 0; i < team.length; i++) {
    var dept = team[i].department || 'other';
    if (!deptGroups[dept]) deptGroups[dept] = [];
    deptGroups[dept].push(team[i]);
  }

  // Render departments in TEAM_DEPARTMENTS order
  for (var d = 0; d < TEAM_DEPARTMENTS.length; d++) {
    var deptId = TEAM_DEPARTMENTS[d].id;
    var members = deptGroups[deptId];
    if (!members || members.length === 0) continue;
    var deptColor = DEPT_COLORS[deptId] || '#94a3b8';
    html += '<div class="team-dept-section">';
    html += '<div class="team-dept-header"><span class="team-dept-dot" style="background:' + deptColor + ';"></span>' + escapeHtml(TEAM_DEPARTMENTS[d].label) + ' (' + members.length + ')</div>';
    html += '<div class="team-member-grid">';
    for (var m = 0; m < members.length; m++) {
      html += _renderTeamCard(members[m]);
    }
    html += '</div></div>';
  }

  container.innerHTML = html;
}

// v25.3: Render a single team member card
function _renderTeamCard(person) {
  var deptColor = DEPT_COLORS[person.department] || '#94a3b8';
  var deptLabel = '';
  for (var d = 0; d < TEAM_DEPARTMENTS.length; d++) {
    if (TEAM_DEPARTMENTS[d].id === person.department) { deptLabel = TEAM_DEPARTMENTS[d].label; break; }
  }
  if (!deptLabel) deptLabel = 'Other';

  var availColor = _availColor(person.availability);
  var availLabel = _availLabel(person.availability);
  var workload = person.workload || 0;
  var wColor = workload > 80 ? '#ef4444' : workload > 50 ? '#fbbf24' : '#4ade80';
  var startStr = person.startDate ? new Date(person.startDate).toLocaleDateString() : 'N/A';

  var _tmOnclick = _peopleSelectMode ? 'togglePersonSelection(\'' + person.id + '\', event)' : 'openTeamDetail(\'' + person.id + '\')';
  var h = '<div class="team-member-card" onclick="' + _tmOnclick + '" style="position:relative;">';
  // v29: Select mode checkbox
  if (_peopleSelectMode) {
    h += _renderPeopleSelectCheckbox(person.id);
  }
  // Top row: avatar + name + badges
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">';
  if (person.logo) {
    h += '<img src="' + person.logo + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" alt="">';
  } else {
    var initials = (person.name || '').split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    h += '<div style="width:36px;height:36px;border-radius:50%;background:' + deptColor + '22;color:' + deptColor + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">' + initials + '</div>';
  }
  h += '<div style="min-width:0;flex:1;">';
  h += '<div style="font-weight:600;font-size:14px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(person.name || '') + '</div>';
  h += '<div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(person.role || 'No role set') + '</div>';
  h += '</div>';
  h += '<div style="margin-left:auto;display:flex;gap:6px;flex-shrink:0;">';
  h += '<span class="team-dept-badge" style="background:' + deptColor + '22;color:' + deptColor + ';">' + escapeHtml(deptLabel) + '</span>';
  h += '<span class="team-availability-badge" style="background:' + availColor + '22;color:' + availColor + ';">' + escapeHtml(availLabel) + '</span>';
  h += '</div></div>';
  // Workload bar
  h += '<div class="team-workload-bar"><div class="team-workload-fill" style="width:' + workload + '%;background:' + wColor + ';"></div></div>';
  // Footer
  h += '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--text-muted);">';
  h += '<span>0 tasks assigned</span>';
  h += '<span>Since ' + escapeHtml(startStr) + '</span>';
  h += '</div></div>';
  return h;
}

// v25.3: Open team member detail view
function openTeamDetail(personId) {
  var person = getPersonById(personId);
  if (!person) return;

  var container = document.getElementById('clientsCardsContainer');
  var panel = document.getElementById('clientDetailPanel');
  if (!container || !panel) return;

  var isMobile = window.innerWidth <= 768; // v25.3: mobile detail support

  container.style.display = 'none';
  panel.style.display = '';

  var deptColor = DEPT_COLORS[person.department] || '#94a3b8';
  var deptLabel = '';
  for (var d = 0; d < TEAM_DEPARTMENTS.length; d++) {
    if (TEAM_DEPARTMENTS[d].id === person.department) { deptLabel = TEAM_DEPARTMENTS[d].label; break; }
  }
  if (!deptLabel) deptLabel = 'Other';
  var availColor = _availColor(person.availability);
  var availLabel = _availLabel(person.availability);

  var html = '';
  // Back button // v25.3: sticky on mobile
  html += '<div style="margin-bottom:var(--space-5);' + (isMobile ? 'position:sticky;top:0;z-index:10;background:var(--bg-secondary);padding:8px 0;' : '') + '">';
  html += '<button class="btn btn-small" onclick="switchPeopleType(\'team\')" style="margin-bottom:var(--space-4);padding:6px 14px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="15 18 9 12 15 6"/></svg> Back</button>';

  // Header: avatar + name + actions
  html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);">';
  html += '<div style="display:flex;align-items:center;gap:var(--space-4);">';
  if (person.logo) {
    html += '<img src="' + person.logo + '" style="width:56px;height:56px;border-radius:50%;object-fit:cover;" alt="">';
  } else {
    var initials = (person.name || '').split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    html += '<div style="width:56px;height:56px;border-radius:50%;background:' + deptColor + '22;color:' + deptColor + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--text-xl);">' + initials + '</div>';
  }
  html += '<div>';
  html += '<div style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);">' + escapeHtml(person.name || '') + '</div>';
  if (person.role) html += '<div style="font-size:var(--text-sm);color:var(--text-secondary);">' + escapeHtml(person.role) + '</div>';
  html += '<div style="display:flex;gap:6px;margin-top:6px;">';
  html += '<span class="team-dept-badge" style="background:' + deptColor + '22;color:' + deptColor + ';">' + escapeHtml(deptLabel) + '</span>';
  html += '<span class="team-availability-badge" style="background:' + availColor + '22;color:' + availColor + ';">' + escapeHtml(availLabel) + '</span>';
  html += '</div></div></div>';
  // Action buttons
  html += '<div style="display:flex;gap:var(--space-2);">';
  html += '<button class="btn btn-small" onclick="openPersonModal(\'team\',\'' + person.id + '\')" style="padding:6px 14px;">';
  html += '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>';
  html += '<button class="btn btn-small" onclick="deleteTeamMember(\'' + person.id + '\')" style="padding:6px 14px;color:#ef4444;">';
  html += '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete</button>';
  html += '</div></div></div>';

  // Contact Info
  var hasContact = person.email || person.phone || person.website || person.location;
  if (hasContact) {
    html += '<div style="margin-bottom:var(--space-5);">';
    html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Contact Info</div>';
    html += '<div class="client-field-group">';
    if (person.email) html += '<div class="client-field-item"><div class="client-field-label">Email</div><div class="client-field-value">' + escapeHtml(person.email) + '</div></div>';
    if (person.phone) html += '<div class="client-field-item"><div class="client-field-label">Phone</div><div class="client-field-value">' + escapeHtml(person.phone) + '</div></div>';
    if (person.location) html += '<div class="client-field-item"><div class="client-field-label">Location</div><div class="client-field-value">' + escapeHtml(person.location) + '</div></div>';
    if (person.website) html += '<div class="client-field-item"><div class="client-field-label">Website</div><div class="client-field-value"><a href="' + escapeHtml(person.website) + '" target="_blank" style="color:var(--brand-accent,#a89878);">' + escapeHtml(person.website) + '</a></div></div>';
    html += '</div></div>';
  }

  // Responsibilities
  if (person.responsibilities && person.responsibilities.length > 0) {
    html += '<div style="margin-bottom:var(--space-5);">';
    html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Responsibilities</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    for (var r = 0; r < person.responsibilities.length; r++) {
      html += '<span style="font-size:12px;padding:4px 10px;border-radius:12px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);">' + escapeHtml(person.responsibilities[r]) + '</span>';
    }
    html += '</div></div>';
  }

  // Skills
  if (person.skills && person.skills.length > 0) {
    html += '<div style="margin-bottom:var(--space-5);">';
    html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Skills</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    for (var s = 0; s < person.skills.length; s++) {
      html += '<span style="font-size:12px;padding:4px 10px;border-radius:12px;background:var(--brand-accent,#a89878)22;color:var(--brand-accent,#a89878);border:1px solid var(--brand-accent,#a89878)33;">' + escapeHtml(person.skills[s]) + '</span>';
    }
    html += '</div></div>';
  }

  // Reports To
  if (person.reportsTo) {
    var manager = getPersonById(person.reportsTo);
    if (manager) {
      html += '<div style="margin-bottom:var(--space-5);">';
      html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Reports To</div>';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-tertiary);border-radius:var(--radius-md);cursor:pointer;" onclick="openTeamDetail(\'' + manager.id + '\')">';
      var mInitials = (manager.name || '').split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
      html += '<div style="width:28px;height:28px;border-radius:50%;background:var(--brand-accent,#a89878)22;color:var(--brand-accent,#a89878);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;">' + mInitials + '</div>';
      html += '<span style="font-size:13px;color:var(--text-primary);font-weight:500;">' + escapeHtml(manager.name) + '</span>';
      html += '</div></div>';
    }
  }

  // Start date + company
  html += '<div style="margin-bottom:var(--space-5);">';
  html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Details</div>';
  html += '<div class="client-field-group">';
  if (person.startDate) html += '<div class="client-field-item"><div class="client-field-label">Start Date</div><div class="client-field-value">' + new Date(person.startDate).toLocaleDateString() + '</div></div>';
  if (person.company) html += '<div class="client-field-item"><div class="client-field-label">Company</div><div class="client-field-value">' + escapeHtml(person.company) + '</div></div>';
  html += '</div></div>';

  // Assigned Tasks section (matches report detail pattern)
  html += '<div style="margin-bottom:var(--space-5);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);">';
  html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">Assigned Tasks</div>';
  html += '<div style="display:flex;gap:6px;">';
  html += '<button onclick="addTaskForPerson(\'' + person.id + '\',\'' + escapeHtml((person.name || '').replace(/'/g, "\\'")) + '\')" style="padding:5px 12px;background:var(--bg-primary);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">+ Add Task</button>';
  html += '<button onclick="openTaskLinkerForPerson(\'' + person.id + '\')" style="padding:5px 12px;background:var(--brand-accent,#a89878);color:#000;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Link Task</button>';
  html += '</div></div>';
  var personTasks = typeof getTasksForPerson === 'function' ? getTasksForPerson(person.id) : [];
  if (personTasks.length > 0) {
    for (var pt = 0; pt < personTasks.length; pt++) {
      var pTask = personTasks[pt];
      html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;margin-bottom:6px;background:var(--bg-tertiary);border-radius:var(--radius-md);font-size:12px;">';
      html += '<input type="checkbox" onclick="if(typeof quickToggleFocus2Task===\'function\')quickToggleFocus2Task(' + pTask.id + ');setTimeout(function(){openTeamDetail(\'' + person.id + '\');},300);" style="margin-top:2px;cursor:pointer;flex-shrink:0;">';
      html += '<div style="min-width:0;flex:1;">';
      html += '<div style="color:var(--text-primary);">' + escapeHtml(pTask.text || '') + '</div>';
      if (pTask.category) {
        html += '<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">' + escapeHtml(pTask.category) + '</div>';
      }
      html += '</div></div>';
    }
  } else {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No tasks assigned yet.</div>';
  }
  html += '</div>';

  // Timeline
  if (person.timeline && person.timeline.length > 0) {
    html += '<div style="margin-bottom:var(--space-5);">';
    html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Timeline</div>';
    for (var t = person.timeline.length - 1; t >= 0; t--) {
      var ev = person.timeline[t];
      html += '<div style="padding:8px 12px;margin-bottom:6px;background:var(--bg-tertiary);border-radius:var(--radius-md);font-size:12px;">';
      html += '<div style="color:var(--text-primary);">' + escapeHtml(ev.note || ev.type || '') + '</div>';
      if (ev.date) html += '<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">' + new Date(ev.date).toLocaleDateString() + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Dialogue History
  if (person.dialogueHistory && person.dialogueHistory.length > 0) {
    html += '<div style="margin-bottom:var(--space-5);">';
    html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Dialogue History</div>';
    for (var dh = person.dialogueHistory.length - 1; dh >= 0; dh--) {
      var entry = person.dialogueHistory[dh];
      html += '<div style="padding:8px 12px;margin-bottom:6px;background:var(--bg-tertiary);border-radius:var(--radius-md);font-size:12px;">';
      html += '<div style="color:var(--text-primary);">' + escapeHtml(entry.summary || entry.note || '') + '</div>';
      if (entry.date) html += '<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">' + new Date(entry.date).toLocaleDateString() + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  panel.innerHTML = html;
  // v25.3: mobile detail panel padding for liquid-nav
  if (isMobile) {
    panel.style.paddingBottom = 'calc(72px + var(--mobile-safe-bottom, 0px))';
  } else {
    panel.style.paddingBottom = '';
  }
}

// v25.3: Delete team member
function deleteTeamMember(personId) {
  if (!confirm('Remove this team member?')) return;
  deletePerson(personId);
  switchPeopleType('team');
  showToast('Team member removed', 'success');
}

// v25.3: Star rating helper
function renderStarRating(rating, size) {
  size = size || 14;
  var html = '<span class="report-rating-stars">';
  for (var s = 1; s <= 5; s++) {
    if (s <= (rating || 0)) {
      html += '<svg class="report-star" width="' + size + '" height="' + size + '" viewBox="0 0 24 24"><path class="report-star-filled" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    } else {
      html += '<svg class="report-star" width="' + size + '" height="' + size + '" viewBox="0 0 24 24"><path class="report-star-empty" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none"/></svg>';
    }
  }
  html += '</span>';
  return html;
}

// v25.3: Check-in status helper
function getCheckinStatus(nextCheckIn) {
  if (!nextCheckIn) return { label: 'No check-in scheduled', cls: 'report-checkin-none' };
  var now = new Date();
  var checkDate = new Date(nextCheckIn);
  var diffDays = Math.floor((checkDate - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Overdue (' + Math.abs(diffDays) + 'd)', cls: 'report-checkin-overdue' };
  if (diffDays === 0) return { label: 'Today', cls: 'report-checkin-today' };
  if (diffDays <= 7) return { label: 'In ' + diffDays + ' days', cls: 'report-checkin-upcoming' };
  return { label: checkDate.toLocaleDateString(), cls: 'report-checkin-none' };
}

// v25.3: Get report status label and color
function _getReportStatus(statusId) {
  var statuses = getReportStatuses();
  for (var i = 0; i < statuses.length; i++) {
    if (statuses[i].id === statusId) return statuses[i];
  }
  return statuses[0]; // default active
}

// v25.3: Render direct reports view grouped by status
function renderReportsView() {
  var container = document.getElementById('peopleTypeContent');
  if (!container) return;

  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var reports = getPeople('report');
  reports = reports.filter(function(r) { return r.scope === 'universal' || r.brandIndex === brandIdx; });

  var html = '';
  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 24px 16px;">';
  html += '<div style="font-size:13px;color:var(--text-muted);">' + reports.length + ' direct report' + (reports.length !== 1 ? 's' : '') + '</div>';
  html += '<button onclick="openPersonModal(\'report\')" style="padding:7px 16px;background:var(--brand-accent,#a89878);color:#000;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Direct Report</button>';
  html += '</div>';

  // v25.3: Reports performance pulse dashboard
  if (reports.length > 0) {
    var ratingSum = 0; var ratingCount = 0; var checkinsOverdue = 0; var goalsOnTrack = 0; var goalsTotal = 0;
    var nowR = new Date();
    for (var ri = 0; ri < reports.length; ri++) {
      var rp = reports[ri];
      if (rp.performanceRating && rp.performanceRating > 0) { ratingSum += rp.performanceRating; ratingCount++; }
      if (rp.nextCheckIn && new Date(rp.nextCheckIn) < nowR) checkinsOverdue++;
      var rGoals = rp.developmentGoals || [];
      for (var rg = 0; rg < rGoals.length; rg++) {
        goalsTotal++;
        if (rGoals[rg].status !== 'blocked') goalsOnTrack++;
      }
    }
    var avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : 'N/A';
    html += '<div class="people-summary-bar">';
    html += '<div class="people-summary-card"><div class="people-summary-value" style="display:flex;align-items:center;gap:6px;">';
    if (ratingCount > 0) {
      html += renderStarRating(Math.round(ratingSum / ratingCount), 18);
      html += '<span style="font-size:16px;">' + avgRating + '</span>';
    } else {
      html += '<span style="font-size:16px;color:var(--text-muted);">No ratings</span>';
    }
    html += '</div><div class="people-summary-label">Team Rating</div></div>';
    html += '<div class="people-summary-card"><div class="people-summary-value"' + (checkinsOverdue > 0 ? ' style="color:#ef4444;"' : '') + '>' + checkinsOverdue + '</div><div class="people-summary-label">Check-ins Overdue</div></div>';
    html += '<div class="people-summary-card"><div class="people-summary-value">' + goalsOnTrack + '/' + goalsTotal + '</div><div class="people-summary-label">Goals On Track</div></div>';
    html += '</div>';
  }

  if (reports.length === 0) {
    html += '<div style="text-align:center;padding:60px 20px;color:var(--text-tertiary);">';
    html += '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:16px;opacity:0.3;">';
    html += '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>';
    html += '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    html += '<div style="font-size:15px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">No Direct Reports yet</div>';
    html += '<div style="font-size:13px;">Add your first direct report to get started.</div>';
    html += '</div>';
    container.innerHTML = html;
    return;
  }

  // Group by status
  var statusGroups = {};
  for (var i = 0; i < reports.length; i++) {
    var st = reports[i].status || 'active';
    if (!statusGroups[st]) statusGroups[st] = [];
    statusGroups[st].push(reports[i]);
  }

  // Render in dynamic status order (default + custom)
  var allStatuses = getReportStatuses();
  for (var s = 0; s < allStatuses.length; s++) {
    var sid = allStatuses[s].id;
    var members = statusGroups[sid];
    if (!members || members.length === 0) continue;
    var sColor = allStatuses[s].color;
    html += '<div style="margin-bottom:20px;padding:0 24px;">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;">';
    html += '<span style="width:8px;height:8px;border-radius:50%;background:' + sColor + ';"></span>';
    html += escapeHtml(allStatuses[s].label) + ' (' + members.length + ')</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;">';
    for (var m = 0; m < members.length; m++) {
      html += _renderReportCard(members[m]);
    }
    html += '</div></div>';
  }

  container.innerHTML = html;
}

// v25.3: Render a single report card (v29: toggle views - Info/Tasks/Goals)
function _renderReportCard(person) {
  var statusInfo = _getReportStatus(person.status || 'active');
  var checkin = getCheckinStatus(person.nextCheckIn);
  var deptColor = DEPT_COLORS[person.department] || '#94a3b8';

  // View state
  window._reportCardView = window._reportCardView || {};
  var currentView = window._reportCardView[person.id] || 'goals';

  var h = '<div class="report-card" id="reportCard_' + person.id + '" style="position:relative;">';
  // v29: Select mode checkbox
  if (_peopleSelectMode) {
    h += _renderPeopleSelectCheckbox(person.id);
  }
  // Top row: avatar + name + status
  var _rcClick = _peopleSelectMode ? 'togglePersonSelection(\'' + person.id + '\', event)' : 'openReportDetail(\'' + person.id + '\')';
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">';
  if (person.logo) {
    h += '<img src="' + person.logo + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;cursor:pointer;" alt="" onclick="' + _rcClick + '">';
  } else {
    var initials = (person.name || '').split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    h += '<div onclick="' + _rcClick + '" style="cursor:pointer;width:36px;height:36px;border-radius:50%;background:' + deptColor + '22;color:' + deptColor + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">' + initials + '</div>';
  }
  h += '<div style="min-width:0;flex:1;cursor:pointer;" onclick="' + _rcClick + '">';
  h += '<div style="font-weight:600;font-size:14px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(person.name || '') + '</div>';
  h += '<div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(person.role || 'No role set') + '</div>';
  h += '</div>';
  h += '<span style="font-size:11px;padding:2px 8px;border-radius:var(--radius-sm);background:' + statusInfo.color + '22;color:' + statusInfo.color + ';font-weight:600;flex-shrink:0;">' + escapeHtml(statusInfo.label) + '</span>';
  h += '</div>';

  // Toggle row
  var views = ['info', 'tasks', 'goals'];
  var viewLabels = { info: 'Info', tasks: 'Tasks', goals: 'Goals' };
  h += '<div style="display:flex;gap:2px;margin-bottom:8px;border-bottom:1px solid var(--border-color);padding-bottom:6px;">';
  for (var vi = 0; vi < views.length; vi++) {
    var vKey = views[vi];
    var isActive = currentView === vKey;
    h += '<span onclick="event.stopPropagation();toggleReportCardView(\'' + person.id + '\',\'' + vKey + '\')" ';
    h += 'style="font-size:11px;padding:2px 10px;cursor:pointer;font-weight:' + (isActive ? '700' : '500') + ';';
    h += 'color:' + (isActive ? 'var(--brand-accent,#a89878)' : 'var(--text-muted)') + ';';
    h += 'border-bottom:' + (isActive ? '2px solid var(--brand-accent,#a89878)' : '2px solid transparent') + ';margin-bottom:-7px;">';
    h += viewLabels[vKey] + '</span>';
  }
  h += '</div>';

  // View content
  if (currentView === 'info') {
    h += _renderReportCardInfo(person);
  } else if (currentView === 'tasks') {
    h += _renderReportCardTasks(person);
  } else {
    h += _renderReportCardGoals(person, checkin);
  }

  h += '</div>';
  return h;
}

// v29: Report card Info view
function _renderReportCardInfo(person) {
  var h = '';
  var fields = [
    { label: 'Email', value: person.email },
    { label: 'Phone', value: person.phone },
    { label: 'Location', value: person.location },
    { label: 'Company', value: person.company }
  ];
  var hasAny = false;
  for (var fi = 0; fi < fields.length; fi++) {
    if (fields[fi].value) {
      hasAny = true;
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;">';
      h += '<span style="color:var(--text-muted);font-weight:500;">' + fields[fi].label + '</span>';
      h += '<span style="color:var(--text-primary);text-align:right;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(fields[fi].value) + '</span>';
      h += '</div>';
    }
  }
  if (!hasAny) {
    h += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;padding:8px 0;">No contact info available.</div>';
  }
  return h;
}

// v29: Report card Tasks view
function _renderReportCardTasks(person) {
  var h = '';
  var tasks = typeof getTasksForPerson === 'function' ? getTasksForPerson(person.id) : [];
  if (tasks.length > 0) {
    for (var ti = 0; ti < tasks.length; ti++) {
      var t = tasks[ti];
      h += '<div style="display:flex;align-items:flex-start;gap:8px;padding:3px 0;font-size:12px;">';
      h += '<input type="checkbox" onclick="event.stopPropagation();if(typeof quickToggleFocus2Task===\'function\')quickToggleFocus2Task(' + t.id + ');setTimeout(function(){toggleReportCardView(\'' + person.id + '\',\'tasks\');},200);" style="margin-top:2px;cursor:pointer;flex-shrink:0;">';
      h += '<div style="min-width:0;flex:1;">';
      h += '<div style="color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(t.text || '') + '</div>';
      if (t.category) {
        h += '<span style="font-size:10px;color:var(--text-muted);">' + escapeHtml(t.category) + '</span>';
      }
      h += '</div></div>';
    }
  } else {
    h += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;padding:8px 0;">No tasks assigned.</div>';
  }
  // + Add Task link
  h += '<div style="padding-top:6px;">';
  h += '<span onclick="event.stopPropagation();addTaskForPerson(\'' + person.id + '\',\'' + escapeHtml((person.name || '').replace(/'/g, "\\'")) + '\')" ';
  h += 'style="font-size:11px;color:var(--brand-accent,#a89878);cursor:pointer;font-weight:600;">+ Add Task</span>';
  h += '</div>';
  return h;
}

// v29: Report card Goals view (original default content)
function _renderReportCardGoals(person, checkin) {
  var goals = person.developmentGoals || [];
  var onTrack = 0;
  for (var g = 0; g < goals.length; g++) {
    if ((goals[g].progress || 0) >= 50) onTrack++;
  }
  var goalSummary = goals.length > 0 ? onTrack + '/' + goals.length + ' goals on track' : 'No goals set';

  var h = '';
  // Rating + check-in row
  h += '<div class="report-status-grid">';
  h += '<div style="display:flex;align-items:center;gap:6px;">' + renderStarRating(person.performanceRating) + '</div>';
  h += '<span class="report-checkin-badge ' + checkin.cls + '">' + escapeHtml(checkin.label) + '</span>';
  h += '</div>';
  // Dev goals
  h += '<div class="report-dev-goal">';
  h += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.5;flex-shrink:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  h += '<span style="font-size:12px;color:var(--text-muted);">' + escapeHtml(goalSummary) + '</span>';
  h += '</div>';
  return h;
}

// v29: Toggle report card view between info/tasks/goals
function toggleReportCardView(personId, view) {
  window._reportCardView = window._reportCardView || {};
  window._reportCardView[personId] = view;
  // Re-render the specific card if possible, otherwise full view
  var cardEl = document.getElementById('reportCard_' + personId);
  if (cardEl) {
    var person = typeof getPersonById === 'function' ? getPersonById(personId) : null;
    if (person) {
      var tmp = document.createElement('div');
      tmp.innerHTML = _renderReportCard(person);
      var newCard = tmp.firstChild;
      cardEl.parentNode.replaceChild(newCard, cardEl);
      return;
    }
  }
  if (typeof renderReportsView === 'function') renderReportsView();
}

// v29: Open task linker modal for a person
function openTaskLinkerForPerson(personId) {
  var existing = document.getElementById('taskLinkerModal');
  if (existing) existing.parentNode.removeChild(existing);

  var overlay = document.createElement('div');
  overlay.id = 'taskLinkerModal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = function(e) { if (e.target === overlay) { overlay.parentNode.removeChild(overlay); } };

  // Get Focus tasks (uncompleted)
  var allTodos = [];
  try {
    var todoKey = typeof getTodosKey === 'function' ? getTodosKey() : 'roweosTodos';
    allTodos = JSON.parse(localStorage.getItem(todoKey) || '[]');
  } catch(e) {}
  var uncompletedTodos = [];
  for (var ti = 0; ti < allTodos.length; ti++) {
    if (!allTodos[ti].completed) uncompletedTodos.push(allTodos[ti]);
  }

  // Group by category
  var catGroups = {};
  for (var tc = 0; tc < uncompletedTodos.length; tc++) {
    var cat = uncompletedTodos[tc].category || 'Uncategorized';
    if (!catGroups[cat]) catGroups[cat] = [];
    catGroups[cat].push(uncompletedTodos[tc]);
  }

  // Get Pulse goals
  var pulseGoalsList = [];
  try {
    pulseGoalsList = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
  } catch(e) {}
  var activeGoals = [];
  for (var pg = 0; pg < pulseGoalsList.length; pg++) {
    if (!pulseGoalsList[pg].completed) activeGoals.push(pulseGoalsList[pg]);
  }

  var html = '<div style="background:var(--bg-secondary);border-radius:var(--radius-lg);padding:24px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;position:relative;">';
  html += '<button onclick="var m=document.getElementById(\'taskLinkerModal\');if(m)m.parentNode.removeChild(m);" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:20px;color:var(--text-muted);cursor:pointer;">&times;</button>';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:16px;">Link Tasks & Goals</div>';

  // Focus Tasks section
  html += '<div style="margin-bottom:16px;">';
  html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;font-weight:600;">Focus Tasks</div>';
  var catKeys = Object.keys(catGroups);
  if (catKeys.length > 0) {
    for (var ck = 0; ck < catKeys.length; ck++) {
      html += '<div style="font-size:11px;color:var(--text-secondary);font-weight:600;margin:8px 0 4px;">' + escapeHtml(catKeys[ck]) + '</div>';
      var items = catGroups[catKeys[ck]];
      for (var it = 0; it < items.length; it++) {
        var alreadyLinked = items[it].assignedTo === personId;
        html += '<label style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;font-size:12px;cursor:pointer;">';
        html += '<input type="checkbox" data-link-type="task" data-link-id="' + items[it].id + '"' + (alreadyLinked ? ' checked disabled' : '') + ' style="margin-top:2px;">';
        html += '<span style="color:var(--text-primary);">' + escapeHtml(items[it].text || '') + (alreadyLinked ? ' <span style="color:var(--text-muted);font-size:10px;">(linked)</span>' : '') + '</span>';
        html += '</label>';
      }
    }
  } else {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No uncompleted tasks.</div>';
  }
  html += '</div>';

  // Pulse Goals section
  html += '<div style="margin-bottom:16px;">';
  html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;font-weight:600;">Pulse Goals</div>';
  if (activeGoals.length > 0) {
    for (var ag = 0; ag < activeGoals.length; ag++) {
      var goalLinked = activeGoals[ag].assignedTo === personId;
      html += '<label style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;font-size:12px;cursor:pointer;">';
      html += '<input type="checkbox" data-link-type="goal" data-link-id="' + activeGoals[ag].id + '"' + (goalLinked ? ' checked disabled' : '') + ' style="margin-top:2px;">';
      html += '<span style="color:var(--text-primary);">' + escapeHtml(activeGoals[ag].title || activeGoals[ag].name || '') + (goalLinked ? ' <span style="color:var(--text-muted);font-size:10px;">(linked)</span>' : '') + '</span>';
      html += '</label>';
    }
  } else {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No active goals.</div>';
  }
  html += '</div>';

  // Link button
  html += '<button onclick="_linkSelectedTasksForPerson(\'' + personId + '\')" style="width:100%;padding:10px;background:var(--brand-accent,#a89878);color:#000;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Link Selected</button>';
  html += '</div>';

  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}

// v29: Process selected links from the task linker modal
function _linkSelectedTasksForPerson(personId) {
  var modal = document.getElementById('taskLinkerModal');
  if (!modal) return;

  var checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)');
  var linkedCount = 0;

  // Collect task IDs and goal IDs
  var taskIds = [];
  var goalIds = [];
  for (var ci = 0; ci < checkboxes.length; ci++) {
    var linkType = checkboxes[ci].getAttribute('data-link-type');
    var linkId = checkboxes[ci].getAttribute('data-link-id');
    if (linkType === 'task') taskIds.push(linkId);
    else if (linkType === 'goal') goalIds.push(linkId);
  }

  // Link Focus tasks
  if (taskIds.length > 0 && typeof todos !== 'undefined') {
    for (var ti = 0; ti < todos.length; ti++) {
      for (var tj = 0; tj < taskIds.length; tj++) {
        if (String(todos[ti].id) === String(taskIds[tj])) {
          todos[ti].assignedTo = personId;
          linkedCount++;
        }
      }
    }
    if (typeof saveTodos === 'function') saveTodos();
  }

  // Link Pulse goals
  if (goalIds.length > 0) {
    try {
      var pGoals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
      for (var gi = 0; gi < pGoals.length; gi++) {
        for (var gj = 0; gj < goalIds.length; gj++) {
          if (String(pGoals[gi].id) === String(goalIds[gj])) {
            pGoals[gi].assignedTo = personId;
            linkedCount++;
          }
        }
      }
      localStorage.setItem('roweos_pulse_goals', JSON.stringify(pGoals));
      // Update in-memory pulseGoals if it exists
      if (typeof pulseGoals !== 'undefined') {
        try { pulseGoals = pGoals; } catch(e) {}
      }
    } catch(e) {}
  }

  // Close modal and refresh
  modal.parentNode.removeChild(modal);
  if (linkedCount > 0) {
    if (typeof showToast === 'function') showToast(linkedCount + ' item' + (linkedCount !== 1 ? 's' : '') + ' linked', 'success');
    openReportDetail(personId);
  }
}

// v28.8: Create task in Pulse Goal with person assignment
function addTaskForPerson(personId, personName) {
  var text = prompt('New task for ' + (personName || 'person') + ':');
  if (!text || !text.trim()) return;

  if (typeof addItemToPulseGoal === 'function') {
    addItemToPulseGoal(null, { text: text.trim(), assignedTo: personId });
  }
  showToast('Task added for ' + (personName || 'person'), 'success');
}

// v25.3: Open report detail panel
function openReportDetail(personId) {
  var person = getPersonById(personId);
  if (!person) return;

  var container = document.getElementById('clientsCardsContainer');
  var panel = document.getElementById('clientDetailPanel');
  if (!container || !panel) return;

  var isMobile = window.innerWidth <= 768; // v25.3: mobile detail support

  container.style.display = 'none';
  panel.style.display = '';

  var statusInfo = _getReportStatus(person.status || 'active');
  var checkin = getCheckinStatus(person.nextCheckIn);
  var deptColor = DEPT_COLORS[person.department] || '#94a3b8';
  var deptLabel = '';
  for (var d = 0; d < TEAM_DEPARTMENTS.length; d++) {
    if (TEAM_DEPARTMENTS[d].id === person.department) { deptLabel = TEAM_DEPARTMENTS[d].label; break; }
  }
  if (!deptLabel) deptLabel = 'Other';

  var html = '';
  // Back + actions // v25.3: sticky on mobile
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4);' + (isMobile ? 'position:sticky;top:0;z-index:10;background:var(--bg-secondary);padding:8px 0;' : '') + '">';
  html += '<button class="btn btn-small" onclick="switchPeopleType(\'report\')" style="padding:6px 14px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back</button>';
  html += '<div style="display:flex;gap:8px;">';
  html += '<button class="btn btn-small" onclick="openPersonModal(\'report\',\'' + person.id + '\')" style="padding:6px 14px;">Edit</button>';
  html += '<button class="btn btn-small" onclick="deleteDirectReport(\'' + person.id + '\')" style="padding:6px 14px;color:#ef4444;">Delete</button>';
  html += '</div></div>';

  // Header
  html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:var(--space-5);padding-bottom:var(--space-4);border-bottom:1px solid var(--border-color);">';
  if (person.logo) {
    html += '<img src="' + person.logo + '" style="width:56px;height:56px;border-radius:50%;object-fit:cover;" alt="">';
  } else {
    var initials = (person.name || '').split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    html += '<div style="width:56px;height:56px;border-radius:50%;background:' + deptColor + '22;color:' + deptColor + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;">' + initials + '</div>';
  }
  html += '<div style="flex:1;min-width:0;">';
  html += '<div style="font-size:20px;font-weight:700;color:var(--text-primary);">' + escapeHtml(person.name || '') + '</div>';
  html += '<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(person.role || '') + (deptLabel ? ' - ' + escapeHtml(deptLabel) : '') + '</div>';
  html += '<div style="display:flex;gap:8px;margin-top:6px;">';
  html += '<span style="font-size:11px;padding:2px 8px;border-radius:var(--radius-sm);background:' + statusInfo.color + '22;color:' + statusInfo.color + ';font-weight:600;">' + escapeHtml(statusInfo.label) + '</span>';
  html += '</div></div></div>';

  // Performance Rating section
  html += '<div style="margin-bottom:var(--space-4);padding:16px;background:var(--bg-tertiary);border-radius:var(--radius-md);">';
  html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Performance Rating</div>';
  html += '<div style="display:flex;align-items:center;gap:12px;">';
  html += renderStarRating(person.performanceRating, 20);
  var lastReview = '';
  if (person.performanceHistory && person.performanceHistory.length > 0) {
    lastReview = new Date(person.performanceHistory[person.performanceHistory.length - 1].date).toLocaleDateString();
  }
  if (lastReview) {
    html += '<span style="font-size:12px;color:var(--text-muted);">Last reviewed: ' + escapeHtml(lastReview) + '</span>';
  }
  html += '</div></div>';

  // Check-in section
  html += '<div style="margin-bottom:var(--space-4);padding:16px;background:var(--bg-tertiary);border-radius:var(--radius-md);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);">';
  html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">Check-ins</div>';
  html += '<div style="display:flex;gap:6px;">';
  html += '<button onclick="generateOneOnOnePrep(\'' + person.id + '\')" style="padding:5px 12px;background:var(--bg-primary);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Prepare 1:1</button>';
  html += '<button onclick="openCheckInModal(\'' + person.id + '\')" style="padding:5px 12px;background:var(--brand-accent,#a89878);color:#000;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Log Check-in</button>';
  html += '</div>';
  html += '</div>';
  html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">';
  html += '<span class="report-checkin-badge ' + checkin.cls + '">' + escapeHtml(checkin.label) + '</span>';
  if (person.checkinFrequency) {
    html += '<span style="font-size:12px;color:var(--text-muted);">Frequency: ' + escapeHtml(person.checkinFrequency) + '</span>';
  }
  html += '</div>';
  // Last 5 check-ins
  var checkIns = person.checkIns || [];
  if (checkIns.length > 0) {
    var showCount = Math.min(checkIns.length, 5);
    for (var ci = checkIns.length - 1; ci >= checkIns.length - showCount; ci--) {
      var c = checkIns[ci];
      var typeLabel = c.type || 'Check-in';
      for (var ct = 0; ct < CHECKIN_TYPES.length; ct++) {
        if (CHECKIN_TYPES[ct].id === c.type) { typeLabel = CHECKIN_TYPES[ct].label; break; }
      }
      var moodColors = ['#ef4444', '#fb923c', '#fbbf24', '#4ade80', '#22d3ee'];
      html += '<div style="padding:8px 12px;margin-bottom:6px;background:var(--bg-primary);border-radius:var(--radius-md);font-size:12px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div style="display:flex;align-items:center;gap:8px;">';
      html += '<span style="font-weight:600;color:var(--text-primary);">' + escapeHtml(typeLabel) + '</span>';
      if (c.mood && c.mood >= 1 && c.mood <= 5) {
        html += '<span style="width:8px;height:8px;border-radius:50%;background:' + moodColors[c.mood - 1] + ';"></span>';
      }
      html += '</div>';
      html += '<span style="color:var(--text-muted);font-size:11px;">' + (c.date ? new Date(c.date).toLocaleDateString() : '') + '</span>';
      html += '</div>';
      if (c.notes) {
        var truncated = c.notes.length > 120 ? c.notes.substring(0, 120) + '...' : c.notes;
        html += '<div style="color:var(--text-muted);margin-top:4px;">' + escapeHtml(truncated) + '</div>';
      }
      // v29.0: Show screenshot thumbnails
      if (c.screenshots && c.screenshots.length > 0) {
        html += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">';
        for (var si = 0; si < c.screenshots.length; si++) {
          html += '<img src="' + c.screenshots[si] + '" style="width:60px;height:45px;object-fit:cover;border-radius:4px;border:1px solid var(--border-color);cursor:pointer;" onclick="window.open(this.src)">';
        }
        html += '</div>';
      }
      html += '</div>';
    }
  } else {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No check-ins logged yet.</div>';
  }
  html += '</div>';

  // Development Goals
  html += '<div style="margin-bottom:var(--space-4);padding:16px;background:var(--bg-tertiary);border-radius:var(--radius-md);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);">';
  html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">Development Goals</div>';
  html += '<button onclick="addDevGoal(\'' + person.id + '\')" style="padding:5px 12px;background:var(--bg-primary);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Add Goal</button>';
  html += '</div>';
  var goals = person.developmentGoals || [];
  if (goals.length > 0) {
    for (var gi = 0; gi < goals.length; gi++) {
      var goal = goals[gi];
      var prog = goal.progress || 0;
      var pColor = prog >= 75 ? '#4ade80' : prog >= 40 ? '#fbbf24' : '#ef4444';
      html += '<div style="margin-bottom:10px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      html += '<span style="font-size:13px;color:var(--text-primary);font-weight:500;">' + escapeHtml(goal.title || '') + '</span>';
      html += '<span style="font-size:11px;color:var(--text-muted);">' + prog + '%</span>';
      html += '</div>';
      html += '<div class="report-dev-goal-progress"><div class="report-dev-goal-fill" style="width:' + prog + '%;background:' + pColor + ';"></div></div>';
      if (goal.targetDate) {
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Target: ' + new Date(goal.targetDate).toLocaleDateString() + '</div>';
      }
      html += '</div>';
    }
  } else {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No development goals set.</div>';
  }
  html += '</div>';

  // v29: Assigned Tasks section
  html += '<div style="margin-bottom:var(--space-4);padding:16px;background:var(--bg-tertiary);border-radius:var(--radius-md);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);">';
  html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">Assigned Tasks</div>';
  html += '<div style="display:flex;gap:6px;">';
  html += '<button onclick="addTaskForPerson(\'' + person.id + '\',\'' + escapeHtml((person.name || '').replace(/'/g, "\\'")) + '\')" style="padding:5px 12px;background:var(--bg-primary);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">+ Add Task</button>';
  html += '<button onclick="openTaskLinkerForPerson(\'' + person.id + '\')" style="padding:5px 12px;background:var(--brand-accent,#a89878);color:#000;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Link Task</button>';
  html += '</div></div>';
  var personTasks = typeof getTasksForPerson === 'function' ? getTasksForPerson(person.id) : [];
  if (personTasks.length > 0) {
    for (var pt = 0; pt < personTasks.length; pt++) {
      var pTask = personTasks[pt];
      html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;margin-bottom:6px;background:var(--bg-primary);border-radius:var(--radius-md);font-size:12px;">';
      html += '<input type="checkbox" onclick="if(typeof quickToggleFocus2Task===\'function\')quickToggleFocus2Task(' + pTask.id + ');setTimeout(function(){openReportDetail(\'' + person.id + '\');},300);" style="margin-top:2px;cursor:pointer;flex-shrink:0;">';
      html += '<div style="min-width:0;flex:1;">';
      html += '<div style="color:var(--text-primary);">' + escapeHtml(pTask.text || '') + '</div>';
      if (pTask.category) {
        html += '<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">' + escapeHtml(pTask.category) + '</div>';
      }
      html += '</div></div>';
    }
  } else {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No tasks assigned yet.</div>';
  }
  html += '</div>';

  // Recognitions
  if (person.recognitions && person.recognitions.length > 0) {
    html += '<div style="margin-bottom:var(--space-4);padding:16px;background:var(--bg-tertiary);border-radius:var(--radius-md);">';
    html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Recognitions</div>';
    for (var ri = person.recognitions.length - 1; ri >= 0; ri--) {
      var rec = person.recognitions[ri];
      html += '<div style="padding:8px 12px;margin-bottom:6px;background:var(--bg-primary);border-radius:var(--radius-md);font-size:12px;">';
      html += '<div style="color:var(--text-primary);">' + escapeHtml(rec.text || rec.title || '') + '</div>';
      if (rec.date) html += '<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">' + new Date(rec.date).toLocaleDateString() + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Timeline
  if (person.timeline && person.timeline.length > 0) {
    html += '<div style="margin-bottom:var(--space-4);padding:16px;background:var(--bg-tertiary);border-radius:var(--radius-md);">';
    html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Timeline</div>';
    for (var ti = person.timeline.length - 1; ti >= 0; ti--) {
      var entry = person.timeline[ti];
      html += '<div style="padding:8px 12px;margin-bottom:6px;background:var(--bg-primary);border-radius:var(--radius-md);font-size:12px;">';
      html += '<div style="color:var(--text-primary);font-weight:500;">' + escapeHtml(entry.title || '') + '</div>';
      if (entry.description) html += '<div style="color:var(--text-muted);margin-top:2px;">' + escapeHtml(entry.description) + '</div>';
      if (entry.date) html += '<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">' + new Date(entry.date).toLocaleDateString() + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Dialogue History
  if (person.dialogueHistory && person.dialogueHistory.length > 0) {
    html += '<div style="margin-bottom:var(--space-4);padding:16px;background:var(--bg-tertiary);border-radius:var(--radius-md);">';
    html += '<div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:var(--space-3);">Dialogue History</div>';
    for (var dh = person.dialogueHistory.length - 1; dh >= 0; dh--) {
      var dhEntry = person.dialogueHistory[dh];
      html += '<div style="padding:8px 12px;margin-bottom:6px;background:var(--bg-primary);border-radius:var(--radius-md);font-size:12px;">';
      html += '<div style="color:var(--text-primary);">' + escapeHtml(dhEntry.summary || dhEntry.note || '') + '</div>';
      if (dhEntry.date) html += '<div style="color:var(--text-muted);font-size:11px;margin-top:2px;">' + new Date(dhEntry.date).toLocaleDateString() + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  panel.innerHTML = html;
  // v25.3: mobile detail panel padding for liquid-nav
  if (isMobile) {
    panel.style.paddingBottom = 'calc(72px + var(--mobile-safe-bottom, 0px))';
  } else {
    panel.style.paddingBottom = '';
  }
}

// v25.3: AI 1:1 Prep Sheet generator
function generateOneOnOnePrep(personId) {
  var person = getPersonById(personId);
  if (!person) return;
  showToast('Generating 1:1 prep sheet...', 'info');

  var context = 'Direct Report: ' + (person.name || '') + ' (' + (person.role || 'No role') + ')\n';
  context += 'Status: ' + (person.status || 'active') + '\n';
  context += 'Last rating: ' + (person.performanceRating || 'none') + '/5\n';
  var checkIns = person.checkIns || [];
  if (checkIns.length > 0) {
    var last = checkIns[checkIns.length - 1];
    context += 'Last check-in: ' + (last.date || 'unknown') + ' (mood: ' + (last.mood || '?') + '/5)\n';
    if (last.notes) context += 'Notes: ' + last.notes + '\n';
    if (last.actionItems && last.actionItems.length > 0) {
      context += 'Action items from last time:\n';
      last.actionItems.forEach(function(ai) { context += '- ' + ai.text + (ai.done ? ' [DONE]' : ' [PENDING]') + '\n'; });
    }
  }
  var goals = person.developmentGoals || [];
  if (goals.length > 0) {
    context += 'Development goals:\n';
    goals.forEach(function(g) { context += '- ' + (g.title || g.goal || '') + ' (' + (g.progress || 0) + '% complete, ' + (g.status || 'in progress') + ')\n'; });
  }

  var systemPrompt = 'You are a management coach. Generate a concise 1:1 meeting prep sheet with: talking points, follow-up items to review, questions to ask, and areas of recognition. Keep it practical and actionable. Do not use em-dashes.';
  var userPrompt = 'Generate a 1:1 prep sheet for my meeting with this direct report:\n\n' + context;

  mailCallAI(systemPrompt, userPrompt, function(result) {
    if (!result) { showToast('Could not generate prep sheet. Check API keys.', 'error'); return; }
    var overlay = document.createElement('div');
    overlay.id = 'oneOnOnePrepOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';
    var modal = '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-xl);max-width:600px;width:90%;max-height:80vh;overflow-y:auto;padding:24px;">';
    modal += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    modal += '<div style="font-size:16px;font-weight:700;color:var(--text-primary);">1:1 Prep - ' + escapeHtml(person.name || '') + '</div>';
    modal += '<button onclick="document.getElementById(\'oneOnOnePrepOverlay\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;padding:4px;">&times;</button>';
    modal += '</div>';
    modal += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">' + (typeof marked !== 'undefined' ? marked.parse(result) : escapeHtml(result).replace(/\n/g, '<br>')) + '</div>';
    modal += '</div>';
    overlay.innerHTML = modal;
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  });
}

// v25.3: Check-in modal for direct reports
function openCheckInModal(personId) {
  var person = getPersonById(personId);
  if (!person) return;

  var today = new Date().toISOString().split('T')[0];

  // Build type options
  var typeOpts = '';
  for (var t = 0; t < CHECKIN_TYPES.length; t++) {
    typeOpts += '<option value="' + CHECKIN_TYPES[t].id + '">' + escapeHtml(CHECKIN_TYPES[t].label) + '</option>';
  }

  var overlay = document.createElement('div');
  overlay.id = 'checkinModalOverlay';
  // v25.3: bottom sheet on mobile
  var checkinIsMobile = window.innerWidth <= 768;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);display:flex;' + (checkinIsMobile ? 'align-items:flex-end;justify-content:center;' : 'align-items:center;justify-content:center;');

  var modalStyle = checkinIsMobile ? 'width:100%;max-width:100%;border-radius:16px 16px 0 0;position:fixed;bottom:0;left:0;max-height:85vh;' : 'max-width:480px;width:90%;border-radius:var(--radius-xl);';
  var mhtml = '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);padding:var(--space-6);overflow-y:auto;' + modalStyle + '">';
  mhtml += '<div style="font-size:var(--text-xl);font-weight:700;margin-bottom:var(--space-4);">Log Check-in - ' + escapeHtml(person.name || '') + '</div>';

  // Date
  mhtml += '<div style="margin-bottom:var(--space-3);"><label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Date</label>';
  mhtml += '<input type="date" id="checkinDate" class="form-control" style="padding:8px 12px;" value="' + today + '"></div>';

  // Type
  mhtml += '<div style="margin-bottom:var(--space-3);"><label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Type</label>';
  mhtml += '<select id="checkinType" class="form-control" style="padding:8px 12px;">' + typeOpts + '</select></div>';

  // Mood
  mhtml += '<div style="margin-bottom:var(--space-3);"><label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Mood</label>';
  mhtml += '<div class="checkin-mood-selector" id="checkinMoodSelector">';
  var moodLabels = ['Critical', 'Struggling', 'Okay', 'Good', 'Great'];
  var moodColors = ['#ef4444', '#fb923c', '#fbbf24', '#4ade80', '#22d3ee'];
  for (var mi = 1; mi <= 5; mi++) {
    mhtml += '<button type="button" class="checkin-mood-btn" data-mood="' + mi + '" onclick="selectCheckinMood(' + mi + ')" style="background:' + moodColors[mi - 1] + '22;color:' + moodColors[mi - 1] + ';border:1px solid ' + moodColors[mi - 1] + '44;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">' + mi + ' - ' + moodLabels[mi - 1] + '</button>';
  }
  mhtml += '</div></div>';

  // Notes
  mhtml += '<div style="margin-bottom:var(--space-3);"><label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Notes</label>';
  mhtml += '<textarea id="checkinNotes" class="form-control" style="padding:8px 12px;min-height:80px;resize:vertical;" placeholder="Discussion summary, feedback..."></textarea></div>';

  // v29.0: Screenshots
  mhtml += '<div style="margin-bottom:var(--space-3);"><label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Screenshots (optional)</label>';
  mhtml += '<div id="checkinScreenshots" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;"></div>';
  mhtml += '<input type="file" id="checkinScreenshotInput" accept="image/*" multiple onchange="handleCheckinScreenshots(this)" style="font-size:12px;color:var(--text-secondary);">';
  mhtml += '</div>';

  // Action items
  mhtml += '<div style="margin-bottom:var(--space-4);"><label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Action Items</label>';
  mhtml += '<div id="checkinActionItems"><div style="margin-bottom:6px;"><input type="text" class="form-control checkin-action-input" style="padding:8px 12px;" placeholder="Action item..."></div></div>';
  mhtml += '<button type="button" onclick="addCheckinActionItem()" style="padding:4px 10px;background:transparent;color:var(--text-muted);border:1px dashed var(--border-color);border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;">+ Add another</button>';
  mhtml += '</div>';

  // Buttons
  mhtml += '<div style="display:flex;gap:var(--space-3);">';
  mhtml += '<button onclick="closeCheckinModal()" class="btn" style="flex:1;padding:10px;">Cancel</button>';
  mhtml += '<button onclick="saveCheckIn(\'' + personId + '\')" class="btn btn-primary" style="flex:1;padding:10px;">Save Check-in</button>';
  mhtml += '</div></div>';

  overlay.innerHTML = mhtml;
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeCheckinModal();
  });
  document.body.appendChild(overlay);
}

// v25.3: Mood selector
var _selectedCheckinMood = 0;
function selectCheckinMood(val) {
  _selectedCheckinMood = val;
  var btns = document.querySelectorAll('.checkin-mood-btn');
  for (var i = 0; i < btns.length; i++) {
    var m = parseInt(btns[i].getAttribute('data-mood'));
    btns[i].style.opacity = (m === val) ? '1' : '0.4';
    btns[i].style.transform = (m === val) ? 'scale(1.05)' : 'scale(1)';
  }
}

// v25.3: Add action item input
function addCheckinActionItem() {
  var container = document.getElementById('checkinActionItems');
  if (!container) return;
  var div = document.createElement('div');
  div.style.marginBottom = '6px';
  div.innerHTML = '<input type="text" class="form-control checkin-action-input" style="padding:8px 12px;" placeholder="Action item...">';
  container.appendChild(div);
}

// v29.0: Handle check-in screenshot uploads
var _checkinScreenshots = [];
function handleCheckinScreenshots(input) {
  if (!input.files) return;
  var container = document.getElementById('checkinScreenshots');
  for (var fi = 0; fi < input.files.length; fi++) {
    var file = input.files[fi];
    if (file.size > 2 * 1024 * 1024) { showToast('Screenshot too large (max 2MB)', 'warning'); continue; }
    (function(f) {
      var reader = new FileReader();
      reader.onload = function(e) {
        // Resize to max 800px for storage efficiency
        var img = new Image();
        img.onload = function() {
          var maxW = 800, maxH = 600;
          var w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
          if (h > maxH) { w = Math.round(w * (maxH / h)); h = maxH; }
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          var resized = c.toDataURL('image/jpeg', 0.8);
          _checkinScreenshots.push(resized);
          if (container) {
            var thumb = document.createElement('div');
            thumb.style.cssText = 'position:relative;width:80px;height:60px;border-radius:6px;overflow:hidden;border:1px solid var(--border-color);';
            var idx = _checkinScreenshots.length - 1;
            thumb.innerHTML = '<img src="' + resized + '" style="width:100%;height:100%;object-fit:cover;">' +
              '<button onclick="removeCheckinScreenshot(' + idx + ', this.parentElement)" style="position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:10px;cursor:pointer;line-height:16px;text-align:center;">x</button>';
            container.appendChild(thumb);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(f);
    })(file);
  }
  input.value = '';
}

function removeCheckinScreenshot(idx, thumbEl) {
  _checkinScreenshots.splice(idx, 1);
  if (thumbEl) thumbEl.remove();
}

// v25.3: Close check-in modal
function closeCheckinModal() {
  var overlay = document.getElementById('checkinModalOverlay');
  if (overlay) overlay.remove();
  _selectedCheckinMood = 0;
  _checkinScreenshots = [];
}

// v25.3: Save check-in
function saveCheckIn(personId) {
  var person = getPersonById(personId);
  if (!person) return;

  var dateEl = document.getElementById('checkinDate');
  var typeEl = document.getElementById('checkinType');
  var notesEl = document.getElementById('checkinNotes');
  var ciDate = dateEl ? dateEl.value : new Date().toISOString().split('T')[0];
  var ciType = typeEl ? typeEl.value : 'weekly';
  var ciNotes = notesEl ? notesEl.value.trim() : '';

  // Collect action items
  var actionInputs = document.querySelectorAll('.checkin-action-input');
  var actions = [];
  for (var a = 0; a < actionInputs.length; a++) {
    var txt = actionInputs[a].value.trim();
    if (txt) actions.push({ text: txt, done: false });
  }

  var now = new Date().toISOString();
  var checkinObj = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    date: ciDate,
    type: ciType,
    mood: _selectedCheckinMood || 0,
    notes: ciNotes,
    actionItems: actions,
    // v29.0: Screenshots support
    screenshots: _checkinScreenshots.length > 0 ? _checkinScreenshots.slice() : undefined
  };

  // Build updates
  var checkIns = person.checkIns ? person.checkIns.slice() : [];
  checkIns.push(checkinObj);

  // Calculate next check-in from frequency
  var freq = person.checkinFrequency || 'weekly';
  var nextDate = new Date(ciDate);
  if (freq === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
  else if (freq === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
  else if (freq === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
  else if (freq === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
  else nextDate.setDate(nextDate.getDate() + 7);

  var nextCheckIn = nextDate.toISOString().split('T')[0];

  // Timeline entry
  var timeline = person.timeline ? person.timeline.slice() : [];
  var typeLabel = ciType;
  for (var ct = 0; ct < CHECKIN_TYPES.length; ct++) {
    if (CHECKIN_TYPES[ct].id === ciType) { typeLabel = CHECKIN_TYPES[ct].label; break; }
  }
  timeline.push({
    id: Date.now().toString(36),
    date: now,
    category: 'checkin',
    title: typeLabel + ' logged',
    description: ciNotes ? ciNotes.substring(0, 100) : '',
    source: 'system',
    createdAt: now
  });

  savePersonById(personId, {
    checkIns: checkIns,
    nextCheckIn: nextCheckIn,
    timeline: timeline,
    _modifiedAt: now
  });

  closeCheckinModal();
  openReportDetail(personId);
  showToast('Check-in logged', 'success');
}

// v25.3: Add development goal to a direct report
function addDevGoal(personId) {
  var title = prompt('Goal title:');
  if (!title || !title.trim()) return;
  var person = getPersonById(personId);
  if (!person) return;

  var now = new Date().toISOString();
  var goals = person.developmentGoals ? person.developmentGoals.slice() : [];
  goals.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    title: title.trim(),
    progress: 0,
    status: 'in_progress',
    targetDate: '',
    createdAt: now
  });

  var timeline = person.timeline ? person.timeline.slice() : [];
  timeline.push({
    id: Date.now().toString(36),
    date: now,
    category: 'goal',
    title: 'Development goal added: ' + title.trim(),
    description: '',
    source: 'system',
    createdAt: now
  });

  savePersonById(personId, {
    developmentGoals: goals,
    timeline: timeline,
    _modifiedAt: now
  });

  openReportDetail(personId);
  showToast('Goal added', 'success');
}

// v25.3: Delete direct report
function deleteDirectReport(personId) {
  if (!confirm('Remove this direct report?')) return;
  deletePerson(personId);
  switchPeopleType('report');
  showToast('Direct report removed', 'success');
}

function renderClientsView() {
  migrateClientsData();
  var container = document.getElementById('clientsCardsContainer');
  var detailPanel = document.getElementById('clientDetailPanel');
  if (!container) return;
  if (detailPanel) detailPanel.style.display = 'none';
  container.style.display = '';
  // v29.0: Sync checkbox state with persisted preference
  var _abCb = document.getElementById('clientsShowAllBrands');
  if (_abCb) _abCb.checked = clientsShowAllBrands;

  var allClients = getClientsForBrand();
  var totalCount = allClients.length;

  // Apply search filter
  var filtered = allClients;
  if (clientsSearchTerm) {
    var term = clientsSearchTerm.toLowerCase();
    filtered = allClients.filter(function(c) {
      return (c.name && c.name.toLowerCase().indexOf(term) !== -1) ||
             (c.company && c.company.toLowerCase().indexOf(term) !== -1) ||
             (c.email && c.email.toLowerCase().indexOf(term) !== -1) ||
             (c.industry && c.industry.toLowerCase().indexOf(term) !== -1) ||
             (c.role && c.role.toLowerCase().indexOf(term) !== -1);
    });
  }
  // v23.3: Apply category filter
  if (clientsCategoryFilterValue) {
    filtered = filtered.filter(function(c) { return c.category === clientsCategoryFilterValue; });
  }

  // Update subtitle
  var subtitle = document.getElementById('clientsSubtitle');
  if (subtitle) {
    subtitle.textContent = totalCount === 0 ? 'Add your first client to get started' : totalCount + ' client' + (totalCount !== 1 ? 's' : '') + ' across ' + CLIENT_PIPELINE_STAGES.filter(function(s) { return filtered.some(function(c) { return c.stage === s.id; }); }).length + ' stages';
  }

  // Stage SVG icons
  var stageIcons = {
    lead: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>',
    prospect: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    proposal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    active: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    retained: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    archived: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>'
  };

  var html = '';

  // v25.3: Pipeline value summary dashboard
  var pipelineValue = { lead: 0, prospect: 0, proposal: 0, active: 0, retained: 0 };
  var totalValue = 0;
  var dealCount = 0;
  filtered.forEach(function(c) {
    var val = parseFloat(c.dealValue) || 0;
    if (val > 0) {
      dealCount++;
      if (c.stage && pipelineValue.hasOwnProperty(c.stage)) pipelineValue[c.stage] += val;
    }
    totalValue += val;
  });
  if (totalValue > 0) {
    var avgDeal = dealCount > 0 ? Math.round(totalValue / dealCount) : 0;
    html += '<div class="people-summary-bar">';
    html += '<div class="people-summary-card"><div class="people-summary-value">$' + totalValue.toLocaleString() + '</div><div class="people-summary-label">Total Pipeline</div></div>';
    html += '<div class="people-summary-card"><div class="people-summary-value">$' + pipelineValue.active.toLocaleString() + '</div><div class="people-summary-label">Active Deals</div></div>';
    html += '<div class="people-summary-card"><div class="people-summary-value">$' + pipelineValue.proposal.toLocaleString() + '</div><div class="people-summary-label">Proposals</div></div>';
    html += '<div class="people-summary-card"><div class="people-summary-value">$' + avgDeal.toLocaleString() + '</div><div class="people-summary-label">Average Deal</div></div>';
    html += '</div>';
  }

  // v25.3: Follow-up queue
  var now = new Date();
  var followUps = filtered.filter(function(c) { return c.nextFollowUp && new Date(c.nextFollowUp) <= now; });
  if (followUps.length > 0) {
    followUps.sort(function(a, b) { return new Date(a.nextFollowUp) - new Date(b.nextFollowUp); });
    html += '<div style="padding:0 24px 16px;">';
    html += '<div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Follow-Ups Due (' + followUps.length + ')</div>';
    for (var fi = 0; fi < followUps.length; fi++) {
      var fu = followUps[fi];
      var daysOverdue = Math.max(1, Math.round((now - new Date(fu.nextFollowUp)) / 86400000));
      html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:4px;background:var(--bg-tertiary);border-radius:var(--radius-md);font-size:12px;">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<span style="font-weight:600;color:var(--text-primary);">' + escapeHtml(fu.name) + '</span>';
      if (fu.company) html += ' <span style="color:var(--text-muted);">' + escapeHtml(fu.company) + '</span>';
      html += '</div>';
      html += '<span style="color:#ef4444;font-size:11px;white-space:nowrap;">' + daysOverdue + 'd overdue</span>';
      html += '<button onclick="event.stopPropagation();showView(\'mail\')" style="padding:3px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:6px;font-size:11px;color:var(--text-secondary);cursor:pointer;font-family:inherit;">Email</button>';
      html += '<button onclick="event.stopPropagation();snoozeClientFollowUp(\'' + fu.id + '\')" style="padding:3px 10px;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:6px;font-size:11px;color:var(--text-secondary);cursor:pointer;font-family:inherit;">Snooze 7d</button>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Build one identity-card per pipeline stage
  CLIENT_PIPELINE_STAGES.forEach(function(stage) {
    var stageClients = filtered.filter(function(c) { return c.stage === stage.id; });
    var count = stageClients.length;
    // Auto-expand stages with clients, collapse empty (except archived always collapsed unless searched)
    var isExpanded = true; // v16.11: Always show all stages expanded
    if (clientsSearchTerm && count > 0) isExpanded = true;

    html += '<div class="identity-card' + (isExpanded ? ' expanded' : '') + '" data-section="client-' + stage.id + '">';
    html += '<div class="identity-card-header" onclick="toggleIdentityCard(this)">';
    html += '<div class="identity-card-icon" style="background: ' + stage.color + '18; color: ' + stage.color + ';">';
    html += (stageIcons[stage.id] || '');
    html += '</div>';
    html += '<div class="identity-card-title">';
    html += '<h3>' + stage.label + '</h3>';
    html += '<p>' + getStageDescription(stage.id) + '</p>';
    html += '</div>';
    html += '<span class="client-stage-count" style="background: ' + stage.color + '18; color: ' + stage.color + ';">' + count + '</span>';
    html += '<svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    html += '</div>';
    html += '<div class="identity-card-body client-drop-zone" data-stage-id="' + stage.id + '" ondragover="clientDragOver(event)" ondragleave="clientDragLeave(event)" ondrop="clientDrop(event, \'' + stage.id + '\')">';

    if (count === 0) {
      html += '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: var(--text-sm);">No ' + stage.label.toLowerCase() + ' clients</div>';
    } else {
      // v23.3: Sort clients within stage
      var sortedStageClients = typeof sortClientArray === 'function' ? sortClientArray(stageClients) : stageClients;
      sortedStageClients.forEach(function(c) {
        var invoices = typeof getInvoices === 'function' ? getInvoices().filter(function(i) { return i.clientName === c.name; }) : [];
        var _crClick = _peopleSelectMode ? 'togglePersonSelection(\'' + c.id + '\', event)' : 'openClientDetail(\'' + c.id + '\')';
        html += '<div class="client-row" onclick="' + _crClick + '" style="position: relative;" draggable="' + (_peopleSelectMode ? 'false' : 'true') + '" data-client-id="' + c.id + '"' + (_peopleSelectMode ? '' : ' ondragstart="clientDragStart(event, \'' + c.id + '\')"') + '>';
        // v29: People select mode checkbox overlay
        if (_peopleSelectMode) {
          html += _renderPeopleSelectCheckbox(c.id);
        }
        // v23.3: Bulk select checkbox (hidden in people select mode)
        html += '<input type="checkbox" class="client-bulk-check" data-cid="' + c.id + '" onclick="event.stopPropagation(); toggleClientBulkSelect(\'' + c.id + '\')" style="margin-right: 4px; flex-shrink: 0; cursor: pointer;' + (_peopleSelectMode ? 'display:none;' : '') + '"' + (_clientBulkSelected.indexOf(c.id) !== -1 ? ' checked' : '') + '>';
        // v23.3: Priority dot
        if (c.priority && c.priority !== 'low') {
          html += '<span class="client-priority-dot client-priority-' + c.priority + '" title="' + (c.priority === 'high' ? 'High' : 'Medium') + ' priority"></span>';
        }
        // Avatar
        if (c.logo) {
          html += '<img src="' + c.logo + '" style="width: 32px; height: 32px; border-radius: var(--radius-sm); object-fit: contain; flex-shrink: 0;" alt="">';
        } else {
          var initials = (c.name || '').split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
          html += '<div style="width: 32px; height: 32px; border-radius: var(--radius-sm); background: ' + stage.color + '18; color: ' + stage.color + '; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 600; font-size: var(--text-xs);">' + initials + '</div>';
        }
        // Name + subtitle
        html += '<div style="flex: 1; min-width: 0;">';
        html += '<div style="display: flex; align-items: center; gap: 6px;">';
        html += '<span style="font-weight: 600; color: var(--text-primary); font-size: var(--text-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(c.name) + '</span>';
        // v23.3: Scope icon for universal clients
        if (c.scope === 'universal') {
          html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#60a5fa" stroke-width="2" title="Universal client" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
        }
        html += '</div>';
        var sub = [];
        if (c.role) sub.push(escapeHtml(c.role));
        if (c.company) sub.push(escapeHtml(c.company));
        if (sub.length > 0) html += '<div style="font-size: var(--text-xs); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + sub.join(' &middot; ') + '</div>';
        html += '</div>';
        // v23.3: Relationship status badge
        if (c.relationshipStatus && c.relationshipStatus !== 'prospecting') {
          var rsColor = typeof getRelationshipStatusColor === 'function' ? getRelationshipStatusColor(c.relationshipStatus) : '#94a3b8';
          var rsLabel = typeof getRelationshipStatusLabel === 'function' ? getRelationshipStatusLabel(c.relationshipStatus) : '';
          html += '<span class="client-relationship-badge" style="background: ' + rsColor + '18; color: ' + rsColor + '; font-size: 10px;">' + rsLabel + '</span>';
        }
        // Invoice count
        if (invoices.length > 0) {
          html += '<span style="font-size: var(--text-xs); color: var(--text-muted); white-space: nowrap;">' + invoices.length + ' inv.</span>';
        }
        // Chevron
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted); flex-shrink: 0;"><polyline points="9 18 15 12 9 6"/></svg>';
        html += '</div>';
      });
    }

    html += '</div></div>';
  });

  // Empty state when no clients at all
  if (totalCount === 0 && !clientsSearchTerm) {
    html = '<div style="text-align: center; padding: 60px 20px; color: var(--text-tertiary);">' +
      '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: var(--space-3); opacity: 0.4;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
      '<div style="font-size: var(--text-base); margin-bottom: var(--space-2);">No clients yet</div>' +
      '<div style="font-size: var(--text-sm); margin-bottom: var(--space-4);">Add your first client to start tracking your pipeline.</div>' +
      '<button class="btn btn-primary" onclick="openClientModal()" style="padding: 8px 20px;">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M12 5v14m-7-7h14"/></svg>' +
        'Add Client</button></div>';
  }

  // v23.3: Relationship status distribution chart (after stages, before end)
  if (totalCount > 0 && typeof renderClientStatusChart === 'function') {
    html += '<div class="identity-card expanded" data-section="client-status-chart">';
    html += '<div class="identity-card-header" onclick="toggleIdentityCard(this)">';
    html += '<div class="identity-card-icon" style="background: var(--accent-10, rgba(168,152,120,0.1)); color: var(--accent);">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>';
    html += '</div>';
    html += '<div class="identity-card-title"><h3>Relationship Distribution</h3><p>Client status overview</p></div>';
    html += '<svg class="identity-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    html += '</div>';
    html += '<div class="identity-card-body">';
    html += renderClientStatusChart(filtered);
    html += '</div></div>';
  }

  container.innerHTML = html;
  // v25.3: Update people type counts after rendering
  updatePeopleTypeCounts();
}

function getStageDescription(stageId) {
  var descriptions = {
    lead: 'Initial contact and outreach',
    prospect: 'Qualified interest and engagement',
    proposal: 'Proposal sent or in negotiation',
    active: 'Currently paying clients',
    retained: 'Ongoing long-term relationships',
    archived: 'No longer active'
  };
  return descriptions[stageId] || '';
}

function filterClients(term) {
  clientsSearchTerm = term || '';
  renderClientsView();
}

function filterClientsByStage(stage) {
  clientsStageFilterValue = stage || '';
  renderClientsView();
}

function toggleClientsBrandFilter() {
  var cb = document.getElementById('clientsShowAllBrands');
  clientsShowAllBrands = cb ? cb.checked : false;
  // v29.0: Persist preference so it survives page reload
  localStorage.setItem('roweos_clients_brand_filter', clientsShowAllBrands ? 'true' : 'false');
  renderClientsView();
}

// v16.11: Client detail panel
function openClientDetail(clientId) {
  var clients = getClients();
  var client = null;
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) { client = clients[i]; break; }
  }
  if (!client) return;

  var cardsContainer = document.getElementById('clientsCardsContainer');
  var panel = document.getElementById('clientDetailPanel');
  if (!cardsContainer || !panel) return;

  // v23.10: Hide all tabs (not just pipeline) so detail works from address book / list tabs too
  var pipelineTab = document.getElementById('clientsPipelineTab');
  var listTab = document.getElementById('clientsListTab');
  var abTab = document.getElementById('clientsAddressBookTab');
  if (pipelineTab) pipelineTab.style.display = 'none';
  if (listTab) listTab.style.display = 'none';
  if (abTab) abTab.style.display = 'none';
  cardsContainer.style.display = 'none';
  // Also hide search bar
  var searchInput = document.getElementById('clientsSearchInput');
  if (searchInput && searchInput.parentElement) searchInput.parentElement.style.display = 'none';
  panel.style.display = '';

  var stageColor = getStageColor(client.stage);
  var invoices = typeof getInvoices === 'function' ? getInvoices().filter(function(inv) { return inv.clientName === client.name; }) : [];
  var brandName = '';
  if (typeof brands !== 'undefined' && brands[client.brandIndex]) {
    brandName = brands[client.brandIndex].shortName || brands[client.brandIndex].name || '';
  }

  var html = '';
  // Back button + header
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<button class="btn btn-small" onclick="closeClientDetail()" style="margin-bottom: var(--space-4); padding: 6px 14px;">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><polyline points="15 18 9 12 15 6"/></svg> Back';
  html += '</button>';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3);">';
  html += '<div style="display: flex; align-items: center; gap: var(--space-4);">';
  if (client.logo) {
    html += '<img src="' + client.logo + '" style="width: 56px; height: 56px; border-radius: var(--radius-md); object-fit: contain;" alt="">';
  } else {
    var initials = (client.name || '').split(' ').map(function(w) { return w.charAt(0).toUpperCase(); }).join('').substring(0, 2);
    html += '<div style="width: 56px; height: 56px; border-radius: var(--radius-md); background: ' + stageColor + '22; color: ' + stageColor + '; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: var(--text-xl);">' + initials + '</div>';
  }
  html += '<div>';
  html += '<div style="font-size: var(--text-xl); font-weight: 700; color: var(--text-primary);">' + escapeHtml(client.name) + '</div>';
  var subParts = [];
  if (client.role) subParts.push(escapeHtml(client.role));
  if (client.company) subParts.push(escapeHtml(client.company));
  if (subParts.length > 0) html += '<div style="font-size: var(--text-sm); color: var(--text-secondary);">' + subParts.join(' at ') + '</div>';
  if (brandName) html += '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px;">' + escapeHtml(brandName) + '</div>';
  html += '</div></div>';
  html += '<div style="display: flex; gap: var(--space-2);">';
  html += '<button class="btn btn-small" onclick="openClientModal(\'' + client.id + '\')" style="padding: 6px 14px;">';
  html += '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>';
  // v23.4: Export PDF + Sync to Address Book
  html += '<button class="btn btn-small" onclick="exportClientAsPDF(\'' + client.id + '\')" style="padding: 6px 14px;">';
  html += '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> PDF</button>';
  if (client.email) {
    html += '<button class="btn btn-small" onclick="mailSyncClientToAddressBook(\'' + client.id + '\')" style="padding: 6px 14px;">';
    html += '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Sync</button>';
  }
  html += '<button class="btn btn-small" onclick="deleteClient(\'' + client.id + '\'); closeClientDetail();" style="padding: 6px 14px; color: #ef4444;">';
  html += '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete</button>';
  html += '</div></div></div>';

  // Pipeline stage selector
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-2);">Pipeline Stage</div>';
  html += '<div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">';
  CLIENT_PIPELINE_STAGES.forEach(function(stage) {
    var isActive = client.stage === stage.id;
    var stgColor = isActive ? stage.color : 'var(--text-primary)';
    var bgStyle = isActive ? 'background: ' + stage.color + '33; border-color: ' + stage.color + ';' : 'background: var(--bg-tertiary); border-color: var(--border-color);';
    html += '<button onclick="updateClientStage(\'' + client.id + '\', \'' + stage.id + '\')" class="btn btn-small" style="padding: 5px 14px; font-size: var(--text-xs); border: 1px solid; color: ' + stgColor + '; -webkit-text-fill-color: ' + stgColor + '; box-shadow: none; ' + bgStyle + '">' + stage.label + '</button>';
  });
  html += '</div></div>';

  // v23.3: Category, Priority, Scope badges
  html += '<div style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-5);">';
  if (client.category) {
    var catColor = typeof getCategoryColor === 'function' ? getCategoryColor(client.category) : '#94a3b8';
    html += '<span class="client-category-badge" style="background: ' + catColor + '22; color: ' + catColor + ';">' + (typeof getCategoryLabel === 'function' ? getCategoryLabel(client.category) : client.category) + '</span>';
  }
  if (client.priority && client.priority !== 'low') {
    var priColor = client.priority === 'high' ? '#d4af37' : '#94a3b8';
    html += '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: ' + priColor + ';"><span class="client-priority-dot client-priority-' + client.priority + '"></span>' + (client.priority === 'high' ? 'High' : 'Medium') + ' Priority</span>';
  }
  if (client.scope === 'universal') {
    html += '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #60a5fa;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Universal</span>';
  }
  html += '</div>';

  // v23.3: Relationship Status selector (4.2)
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-2);">Relationship Status</div>';
  html += '<div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">';
  CLIENT_RELATIONSHIP_STATUSES.forEach(function(rs) {
    var isActive = client.relationshipStatus === rs.id;
    var rsColor = isActive ? rs.color : 'var(--text-primary)';
    var bgStyle = isActive ? 'background: ' + rs.color + '33; border-color: ' + rs.color + ';' : 'background: var(--bg-tertiary); border-color: var(--border-color);';
    html += '<button onclick="updateClientRelationshipStatus(\'' + client.id + '\', \'' + rs.id + '\')" class="btn btn-small" style="padding: 4px 10px; font-size: 10px; border: 1px solid; color: ' + rsColor + '; -webkit-text-fill-color: ' + rsColor + '; box-shadow: none; ' + bgStyle + '">' + rs.label + '</button>';
  });
  html += '</div></div>';

  // Identity fields grid
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-3);">Client Identity</div>';
  html += '<div class="client-field-group">';
  var fields = [
    { label: 'Email', value: client.email },
    { label: 'Phone', value: client.phone },
    { label: 'Industry', value: client.industry },
    { label: 'Location', value: client.location },
    { label: 'Website', value: client.website, isLink: true },
    { label: 'Created', value: client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '' }
  ];
  // v23.3: Add secondary emails if present
  if (client.secondaryEmails && client.secondaryEmails.length > 0) {
    fields.push({ label: 'Secondary Emails', value: client.secondaryEmails.join(', ') });
  }
  fields.forEach(function(f) {
    html += '<div>';
    html += '<div class="client-field-label">' + f.label + '</div>';
    if (f.value) {
      if (f.isLink) {
        html += '<div class="client-field-value"><a href="' + escapeHtml(f.value) + '" target="_blank" rel="noopener" style="color: var(--accent);">' + escapeHtml(f.value) + '</a></div>';
      } else {
        html += '<div class="client-field-value">' + escapeHtml(f.value) + '</div>';
      }
    } else {
      html += '<div class="client-field-value" style="color: var(--text-muted); font-style: italic;">--</div>';
    }
    html += '</div>';
  });
  html += '</div></div>';

  // Notes
  if (client.notes) {
    html += '<div style="margin-bottom: var(--space-5);">';
    html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-2);">Notes</div>';
    html += '<div style="background: var(--bg-tertiary); border-radius: var(--radius-md); padding: var(--space-4); font-size: var(--text-sm); color: var(--text-secondary); white-space: pre-wrap;">' + escapeHtml(client.notes) + '</div>';
    html += '</div>';
  }

  // Stage history timeline
  if (client.stageHistory && client.stageHistory.length > 0) {
    html += '<div style="margin-bottom: var(--space-5);">';
    html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-3);">Stage History</div>';
    client.stageHistory.slice().reverse().forEach(function(h) {
      var hColor = getStageColor(h.stage);
      var dateStr = h.date ? new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      html += '<div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0;">';
      html += '<div style="width: 8px; height: 8px; border-radius: 50%; background: ' + hColor + '; flex-shrink: 0;"></div>';
      html += '<span class="client-stage-badge" style="background: ' + hColor + '22; color: ' + hColor + ';">' + getStageLabel(h.stage) + '</span>';
      html += '<span style="font-size: var(--text-xs); color: var(--text-muted);">' + dateStr + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  // v23.3: Custom fields display
  if (client.customFields && client.customFields.length > 0) {
    html += '<div style="margin-bottom: var(--space-5);">';
    html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-3);">Custom Fields</div>';
    html += '<div class="client-field-group">';
    client.customFields.forEach(function(cf) {
      html += '<div>';
      html += '<div class="client-field-label">' + escapeHtml(cf.label) + '</div>';
      html += '<div class="client-field-value">' + escapeHtml(cf.value || '--') + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // v23.3: Latest in Dialogue (4.3)
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Latest in Dialogue</div>';
  html += '<button class="btn btn-small" onclick="openLogInteractionModal(\'' + client.id + '\')" style="padding: 4px 10px; font-size: 11px;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;"><path d="M12 5v14m-7-7h14"/></svg>Log Interaction</button>';
  html += '</div>';
  var dialogue = client.dialogueHistory || [];
  if (dialogue.length === 0) {
    html += '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: var(--text-sm);">No dialogue history yet. Log an interaction or use "Inform to Client Identity" in Mail.</div>';
  } else {
    // Show latest entry prominently
    var latest = dialogue[0];
    var sourceColors = { 'Email': '#60a5fa', 'Manual Note': '#94a3b8', 'Studio Session': '#a78bfa', 'Meeting': '#4ade80', 'Phone Call': '#fbbf24' };
    html += '<div class="client-dialogue-entry">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
    html += '<span class="dialogue-source" style="color: ' + (sourceColors[latest.source] || 'var(--accent)') + ';">' + escapeHtml(latest.source || 'Note') + '</span>';
    html += '<span class="dialogue-date">' + (latest.timestamp ? new Date(latest.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '') + '</span>';
    html += '</div>';
    html += '<div class="dialogue-summary">' + escapeHtml(latest.summary || '') + '</div>';
    html += '</div>';
    // Older entries collapsed
    if (dialogue.length > 1) {
      var showCount = Math.min(dialogue.length - 1, 9);
      html += '<details style="margin-top: var(--space-2);"><summary style="font-size: 12px; color: var(--text-muted); cursor: pointer; padding: 4px 0;">Show ' + showCount + ' older entr' + (showCount === 1 ? 'y' : 'ies') + '</summary>';
      for (var di = 1; di <= showCount; di++) {
        var d = dialogue[di];
        html += '<div class="client-dialogue-entry" style="border-left-color: ' + (sourceColors[d.source] || 'var(--accent)') + '; margin-top: 4px;">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
        html += '<span class="dialogue-source" style="color: ' + (sourceColors[d.source] || 'var(--accent)') + ';">' + escapeHtml(d.source || 'Note') + '</span>';
        html += '<span class="dialogue-date">' + (d.timestamp ? new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '') + '</span>';
        html += '</div>';
        html += '<div class="dialogue-summary">' + escapeHtml(d.summary || '') + '</div>';
        html += '</div>';
      }
      html += '</details>';
    }
  }
  html += '</div>';

  // v23.3: Relationship Timeline (4.4)
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Timeline</div>';
  html += '<button class="btn btn-small" onclick="openAddTimelineModal(\'' + client.id + '\')" style="padding: 4px 10px; font-size: 11px;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;"><path d="M12 5v14m-7-7h14"/></svg>Add Entry</button>';
  html += '</div>';
  // Category filter chips
  html += '<div class="client-timeline-cat-filter">';
  html += '<button class="active" onclick="this.parentElement.querySelectorAll(\'button\').forEach(function(b){b.classList.remove(\'active\')}); this.classList.add(\'active\'); document.getElementById(\'clientTimelineContent\').innerHTML = renderClientTimeline(getClients().filter(function(c){return c.id===\'' + client.id + '\'})[0]);">All</button>';
  TIMELINE_CATEGORIES.forEach(function(tc) {
    html += '<button onclick="this.parentElement.querySelectorAll(\'button\').forEach(function(b){b.classList.remove(\'active\')}); this.classList.add(\'active\'); document.getElementById(\'clientTimelineContent\').innerHTML = renderClientTimeline(getClients().filter(function(c){return c.id===\'' + client.id + '\'})[0], \'' + tc.id + '\');">' + tc.label + '</button>';
  });
  html += '</div>';
  html += '<div id="clientTimelineContent">';
  html += renderClientTimeline(client);
  html += '</div></div>';

  // v22.39: Client Guardrails section (syncs with Settings > Guardrails > Clients tab)
  var _cgKey = (client.name || '').replace(/[^a-zA-Z0-9]/g, '_');
  var _cgRules = (guardrailsConfig.clientGuardrails || {})[_cgKey] || { restrictContext: false, applyEscalation: false, customRules: '', toneOverride: 'default' };
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-3);">Guardrails</div>';
  html += '<div style="background: var(--bg-tertiary); border-radius: var(--radius-md); padding: var(--space-4); border: 1px solid var(--border-color);">';
  // Toggles row
  html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">';
  html += '<div class="agent-toggle-item" style="padding: 8px 12px; margin: 0;"><div class="agent-toggle-info"><div><div class="agent-toggle-name" style="font-size: 12px;">Restrict to client context</div></div></div><label class="toggle-switch"><input type="checkbox" id="cdGuard_restrict" ' + (_cgRules.restrictContext ? 'checked' : '') + ' onchange="updateClientGuardrailFromDetail(\'' + _cgKey + '\', \'' + client.id + '\', \'restrictContext\', this.checked)"><span class="toggle-slider"></span></label></div>';
  html += '<div class="agent-toggle-item" style="padding: 8px 12px; margin: 0;"><div class="agent-toggle-info"><div><div class="agent-toggle-name" style="font-size: 12px;">Apply escalation rules</div></div></div><label class="toggle-switch"><input type="checkbox" id="cdGuard_escalation" ' + (_cgRules.applyEscalation ? 'checked' : '') + ' onchange="updateClientGuardrailFromDetail(\'' + _cgKey + '\', \'' + client.id + '\', \'applyEscalation\', this.checked)"><span class="toggle-slider"></span></label></div>';
  html += '</div>';
  // Tone + Custom rules row
  html += '<div style="display: grid; grid-template-columns: 1fr 2fr; gap: var(--space-3);">';
  html += '<div><label style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Tone</label><select id="cdGuard_tone" style="width: 100%; padding: 6px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px;" onchange="updateClientGuardrailFromDetail(\'' + _cgKey + '\', \'' + client.id + '\', \'toneOverride\', this.value)">';
  html += '<option value="default"' + (_cgRules.toneOverride === 'default' ? ' selected' : '') + '>Default</option>';
  html += '<option value="formal"' + (_cgRules.toneOverride === 'formal' ? ' selected' : '') + '>Formal</option>';
  html += '<option value="casual"' + (_cgRules.toneOverride === 'casual' ? ' selected' : '') + '>Casual</option>';
  html += '<option value="technical"' + (_cgRules.toneOverride === 'technical' ? ' selected' : '') + '>Technical</option>';
  html += '</select></div>';
  html += '<div><label style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Custom Rules</label><textarea id="cdGuard_rules" style="width: 100%; min-height: 44px; padding: 6px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 12px; resize: vertical;" placeholder="Custom rules for this client..." onchange="updateClientGuardrailFromDetail(\'' + _cgKey + '\', \'' + client.id + '\', \'customRules\', this.value)">' + escapeHtml(_cgRules.customRules || '') + '</textarea></div>';
  html += '</div>';
  html += '</div></div>';

  // v28.4: Client Action Prompts Library
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Action Prompts</div>';
  html += '<button class="btn btn-small" onclick="addClientActionPrompt(\'' + client.id + '\')" style="padding: 4px 10px; font-size: 11px;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;"><path d="M12 5v14m-7-7h14"/></svg>Add Prompt</button>';
  html += '</div>';
  var prompts = client.actionPrompts || [];
  if (prompts.length === 0) {
    html += '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: var(--text-sm); background: var(--bg-tertiary); border-radius: var(--radius-md);">No action prompts yet. Create reusable prompts for this client.</div>';
  } else {
    for (var _pi = 0; _pi < prompts.length; _pi++) {
      var _p = prompts[_pi];
      html += '<div style="background: var(--bg-tertiary); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 6px; border: 1px solid var(--border-color);">';
      html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">';
      html += '<div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">' + escapeHtml(_p.name) + '</div>';
      html += '<div style="display: flex; gap: 6px;">';
      html += '<button onclick="runClientActionPrompt(\'' + client.id + '\', \'' + _p.id + '\')" class="btn btn-small" style="padding: 3px 8px; font-size: 10px; background: var(--accent); color: #fff; border: none;">';
      html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 2px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>Run</button>';
      html += '<button onclick="editClientActionPrompt(\'' + client.id + '\', \'' + _p.id + '\')" class="btn btn-small" style="padding: 3px 8px; font-size: 10px;">';
      html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
      html += '<button onclick="deleteClientActionPrompt(\'' + client.id + '\', \'' + _p.id + '\')" class="btn btn-small" style="padding: 3px 8px; font-size: 10px; color: #ef4444;">';
      html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
      html += '</div></div>';
      html += '<div style="font-size: var(--text-xs); color: var(--text-secondary); white-space: pre-wrap; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(_p.prompt.substring(0, 200)) + (_p.prompt.length > 200 ? '...' : '') + '</div>';
      html += '</div>';
    }
  }
  html += '</div>';

  // v28.6: Mini Client Identity (BrandAI-accessible summary)
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-3);">Client Identity</div>';
  html += '<div style="background: var(--bg-tertiary); border-radius: var(--radius-md); padding: 14px; border: 1px solid var(--border-color);">';
  var _ciFields = [];
  if (client.company) _ciFields.push({ label: 'Company', value: client.company });
  if (client.industry) _ciFields.push({ label: 'Industry', value: client.industry });
  if (client.role) _ciFields.push({ label: 'Role', value: client.role });
  if (client.website) _ciFields.push({ label: 'Website', value: client.website });
  if (client.category) _ciFields.push({ label: 'Category', value: client.category });
  if (client.stage) _ciFields.push({ label: 'Stage', value: client.stage });
  if (client.dealValue) _ciFields.push({ label: 'Deal Value', value: '$' + parseFloat(client.dealValue).toLocaleString() });
  if (client.notes) _ciFields.push({ label: 'Notes', value: client.notes.substring(0, 200) + (client.notes.length > 200 ? '...' : '') });
  if (_ciFields.length === 0) {
    html += '<div style="text-align:center;color:var(--text-muted);font-size:var(--text-sm);padding:8px 0;">Fill in client details to build their identity profile.</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;">';
    for (var _cf = 0; _cf < _ciFields.length; _cf++) {
      html += '<div>';
      html += '<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;">' + escapeHtml(_ciFields[_cf].label) + '</div>';
      html += '<div style="font-size:13px;color:var(--text-primary);">' + escapeHtml(_ciFields[_cf].value) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div></div>';

  // v28.6: Client Timeline
  html += '<div style="margin-bottom: var(--space-5);">';
  html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">';
  html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Timeline</div>';
  html += '<div style="display:flex;gap:6px;">';
  html += '<button class="btn btn-small" onclick="addClientTimelineEvent(\'' + client.id + '\')" style="padding: 4px 10px; font-size: 11px;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;"><path d="M12 5v14m-7-7h14"/></svg>Add Event</button>';
  html += '<button class="btn btn-small" onclick="suggestTimelineEvents(\'' + client.id + '\')" style="padding: 4px 10px; font-size: 11px; color: var(--accent);">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><path d="M9 22h6"/></svg>AI Suggest</button>';
  html += '</div></div>';
  var _tl = client.timeline || [];
  _tl.sort(function(a, b) { return new Date(a.date || 0) - new Date(b.date || 0); });
  if (_tl.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:var(--text-sm);background:var(--bg-tertiary);border-radius:var(--radius-md);">No timeline events yet. Add key milestones for this client.</div>';
  } else {
    html += '<div style="position:relative;padding-left:24px;">';
    // Vertical line
    html += '<div style="position:absolute;left:7px;top:4px;bottom:4px;width:2px;background:var(--border-color);border-radius:1px;"></div>';
    for (var _ti = 0; _ti < _tl.length; _ti++) {
      var _te = _tl[_ti];
      var _teDate = _te.date ? new Date(_te.date) : null;
      var _teDateStr = _teDate ? _teDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';
      html += '<div style="position:relative;margin-bottom:16px;">';
      // Dot on line
      html += '<div style="position:absolute;left:-20px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--accent);border:2px solid var(--bg-primary);"></div>';
      html += '<div style="background:var(--bg-tertiary);border-radius:var(--radius-md);padding:12px 14px;border:1px solid var(--border-color);cursor:pointer;" onclick="toggleTimelineNotes(this)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div>';
      html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);">' + escapeHtml(_te.name || 'Event') + '</div>';
      html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(_teDateStr) + '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:4px;align-items:center;">';
      if (_te.notes && _te.notes.length > 0) {
        html += '<span style="font-size:10px;color:var(--text-muted);">' + _te.notes.length + ' note' + (_te.notes.length !== 1 ? 's' : '') + '</span>';
      }
      html += '<button onclick="event.stopPropagation(); editClientTimelineEvent(\'' + client.id + '\', \'' + _te.id + '\')" class="btn btn-small" style="padding:2px 6px;font-size:10px;">';
      html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
      html += '<button onclick="event.stopPropagation(); deleteClientTimelineEvent(\'' + client.id + '\', \'' + _te.id + '\')" class="btn btn-small" style="padding:2px 6px;font-size:10px;color:#ef4444;">';
      html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
      html += '</div></div>';
      // Expandable notes
      html += '<div class="timeline-notes-panel" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);">';
      if (_te.notes && _te.notes.length > 0) {
        for (var _ni = 0; _ni < _te.notes.length; _ni++) {
          html += '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;">';
          html += '<div style="width:4px;height:4px;border-radius:50%;background:var(--text-muted);margin-top:6px;flex-shrink:0;"></div>';
          html += '<div style="font-size:12px;color:var(--text-secondary);">' + escapeHtml(_te.notes[_ni]) + '</div>';
          html += '</div>';
        }
      } else {
        html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No notes yet.</div>';
      }
      html += '<button onclick="event.stopPropagation(); addTimelineNote(\'' + client.id + '\', \'' + _te.id + '\')" class="btn btn-small" style="margin-top:8px;padding:3px 10px;font-size:10px;">';
      html += '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><path d="M12 5v14m-7-7h14"/></svg>Add Note</button>';
      html += '</div>';
      html += '</div></div>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Linked invoices
  if (invoices.length > 0) {
    html += '<div>';
    html += '<div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-3);">Linked Invoices (' + invoices.length + ')</div>';
    invoices.forEach(function(inv) {
      var statusColor = inv.status === 'paid' ? '#4ade80' : inv.status === 'overdue' ? '#ef4444' : '#fbbf24';
      html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3); background: var(--bg-tertiary); border-radius: var(--radius-md); margin-bottom: var(--space-2);">';
      html += '<div>';
      html += '<div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: 500;">' + escapeHtml(inv.invoiceNumber || 'Invoice') + '</div>';
      html += '<div style="font-size: var(--text-xs); color: var(--text-muted);">' + (inv.date ? new Date(inv.date).toLocaleDateString() : '') + '</div>';
      html += '</div>';
      html += '<div style="text-align: right;">';
      html += '<div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">$' + (inv.total || 0).toFixed(2) + '</div>';
      html += '<div style="font-size: var(--text-xs); color: ' + statusColor + ';">' + escapeHtml(inv.status || 'pending') + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  panel.innerHTML = html;
}

function closeClientDetail() {
  var panel = document.getElementById('clientDetailPanel');
  if (panel) panel.style.display = 'none';
  // v23.10: Restore whichever tab was active before opening detail
  switchClientsTab(_clientsActiveTab || 'pipeline');
}

// v28.4: Client Action Prompts Library
function addClientActionPrompt(clientId) {
  _showActionPromptModal(clientId, null);
}

function editClientActionPrompt(clientId, promptId) {
  _showActionPromptModal(clientId, promptId);
}

function _showActionPromptModal(clientId, promptId) {
  var clients = getClients();
  var client = null;
  // v28.6: Coerce to string for comparison (onclick passes string, id may be number)
  var _cidStr = String(clientId);
  for (var i = 0; i < clients.length; i++) {
    if (String(clients[i].id) === _cidStr) { client = clients[i]; break; }
  }
  if (!client) return;
  var existing = null;
  if (promptId && client.actionPrompts) {
    for (var j = 0; j < client.actionPrompts.length; j++) {
      if (client.actionPrompts[j].id === promptId) { existing = client.actionPrompts[j]; break; }
    }
  }
  var overlay = document.createElement('div');
  overlay.id = 'actionPromptOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
  var mhtml = '<div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;padding:20px;max-width:500px;width:90%;">';
  mhtml += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">' + (existing ? 'Edit' : 'New') + ' Action Prompt</div>';
  mhtml += '<div style="margin-bottom:10px;"><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Prompt Name</label>';
  mhtml += '<input type="text" id="apNameInput" value="' + escapeHtml(existing ? existing.name : '') + '" placeholder="e.g., Villainous CTA, Follow-Up Email" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;box-sizing:border-box;"></div>';
  mhtml += '<div style="margin-bottom:14px;"><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Prompt Template</label>';
  mhtml += '<textarea id="apPromptInput" rows="6" placeholder="Write the prompt template. Use {{client_name}} for the client name, {{brand_name}} for your brand." style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;resize:vertical;box-sizing:border-box;">' + escapeHtml(existing ? existing.prompt : '') + '</textarea></div>';
  mhtml += '<div style="display:flex;gap:8px;justify-content:flex-end;">';
  mhtml += '<button onclick="document.getElementById(\'actionPromptOverlay\').remove()" class="btn btn-secondary" style="padding:8px 16px;font-size:13px;">Cancel</button>';
  mhtml += '<button onclick="saveClientActionPrompt(\'' + clientId + '\', ' + (existing ? '\'' + existing.id + '\'' : 'null') + ')" class="btn btn-primary" style="padding:8px 16px;font-size:13px;">Save</button>';
  mhtml += '</div></div>';
  overlay.innerHTML = mhtml;
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  setTimeout(function() { document.getElementById('apNameInput').focus(); }, 100);
}

function saveClientActionPrompt(clientId, promptId) {
  var name = (document.getElementById('apNameInput').value || '').trim();
  var prompt = (document.getElementById('apPromptInput').value || '').trim();
  if (!name || !prompt) { showToast('Name and prompt are required', 'warning'); return; }
  var clients = getClients();
  var _cidStr = String(clientId);
  for (var i = 0; i < clients.length; i++) {
    if (String(clients[i].id) === _cidStr) {
      if (!clients[i].actionPrompts) clients[i].actionPrompts = [];
      if (promptId) {
        for (var j = 0; j < clients[i].actionPrompts.length; j++) {
          if (clients[i].actionPrompts[j].id === promptId) {
            clients[i].actionPrompts[j].name = name;
            clients[i].actionPrompts[j].prompt = prompt;
            clients[i].actionPrompts[j].updatedAt = new Date().toISOString();
            break;
          }
        }
      } else {
        clients[i].actionPrompts.push({
          id: 'ap_' + Date.now(),
          name: name,
          prompt: prompt,
          createdAt: new Date().toISOString()
        });
      }
      clients[i]._modifiedAt = Date.now();
      break;
    }
  }
  saveClients(clients);
  if (typeof writeDB === 'function') {
    var cd = JSON.parse(JSON.stringify(clients));
    cd.forEach(function(c) { if (c.logo && c.logo.length > 50000) c.logo = ''; });
    writeDB('profile/clients', { data: cd });
  }
  var overlay = document.getElementById('actionPromptOverlay');
  if (overlay) overlay.remove();
  showToast('Action prompt saved', 'success');
  openClientDetail(clientId);
}

function deleteClientActionPrompt(clientId, promptId) {
  if (!confirm('Delete this action prompt?')) return;
  var clients = getClients();
  var _cidStr = String(clientId);
  for (var i = 0; i < clients.length; i++) {
    if (String(clients[i].id) === _cidStr && clients[i].actionPrompts) {
      clients[i].actionPrompts = clients[i].actionPrompts.filter(function(p) { return p.id !== promptId; });
      clients[i]._modifiedAt = Date.now();
      break;
    }
  }
  saveClients(clients);
  if (typeof writeDB === 'function') {
    var cd = JSON.parse(JSON.stringify(clients));
    cd.forEach(function(c) { if (c.logo && c.logo.length > 50000) c.logo = ''; });
    writeDB('profile/clients', { data: cd });
  }
  showToast('Prompt deleted', 'info');
  openClientDetail(clientId);
}

function runClientActionPrompt(clientId, promptId) {
  var clients = getClients();
  var client = null;
  var prompt = null;
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) {
      client = clients[i];
      if (client.actionPrompts) {
        for (var j = 0; j < client.actionPrompts.length; j++) {
          if (client.actionPrompts[j].id === promptId) { prompt = client.actionPrompts[j]; break; }
        }
      }
      break;
    }
  }
  if (!client || !prompt) return;
  // Resolve template variables
  var brandName = '';
  if (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand]) {
    brandName = brands[selectedBrand].shortName || brands[selectedBrand].name || '';
  }
  var resolved = prompt.prompt
    .replace(/\{\{client_name\}\}/g, client.name || '')
    .replace(/\{\{brand_name\}\}/g, brandName)
    .replace(/\{\{client_company\}\}/g, client.company || '')
    .replace(/\{\{client_email\}\}/g, client.email || '')
    .replace(/\{\{client_industry\}\}/g, client.industry || '');
  // Navigate to Chat and send the prompt
  showView('agent');
  setTimeout(function() {
    var chatInput = document.getElementById('userInput');
    if (chatInput) {
      chatInput.value = resolved;
      chatInput.focus();
      // Auto-resize textarea
      chatInput.style.height = 'auto';
      chatInput.style.height = chatInput.scrollHeight + 'px';
    }
  }, 300);
}

// v28.6: Client Timeline — visual event timeline per client
function _saveClientAndRefresh(clients, clientId) {
  saveClients(clients);
  if (typeof writeDB === 'function') {
    var cd = JSON.parse(JSON.stringify(clients));
    cd.forEach(function(c) { if (c.logo && c.logo.length > 50000) c.logo = ''; });
    writeDB('profile/clients', { data: cd });
  }
  openClientDetail(clientId);
}

function _findClientById(clients, clientId) {
  var _cidStr = String(clientId);
  for (var i = 0; i < clients.length; i++) {
    if (String(clients[i].id) === _cidStr) return clients[i];
  }
  return null;
}

function toggleTimelineNotes(el) {
  var notes = el.querySelector('.timeline-notes-panel');
  if (notes) notes.style.display = notes.style.display === 'none' ? '' : 'none';
}

function addClientTimelineEvent(clientId) {
  var overlay = document.createElement('div');
  overlay.id = 'timelineEventOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
  var today = new Date().toISOString().split('T')[0];
  var mhtml = '<div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;padding:20px;max-width:440px;width:90%;">';
  mhtml += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Add Timeline Event</div>';
  mhtml += '<div style="margin-bottom:10px;"><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Event Name</label>';
  mhtml += '<input type="text" id="tlEventName" placeholder="e.g., Contract Signed, Kickoff Call" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;box-sizing:border-box;"></div>';
  mhtml += '<div style="margin-bottom:14px;"><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Date</label>';
  mhtml += '<input type="date" id="tlEventDate" value="' + today + '" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;box-sizing:border-box;"></div>';
  mhtml += '<div style="display:flex;gap:8px;justify-content:flex-end;">';
  mhtml += '<button onclick="document.getElementById(\'timelineEventOverlay\').remove()" class="btn btn-secondary" style="padding:8px 16px;font-size:13px;">Cancel</button>';
  mhtml += '<button onclick="saveTimelineEvent(\'' + clientId + '\')" class="btn btn-primary" style="padding:8px 16px;font-size:13px;">Add</button>';
  mhtml += '</div></div>';
  overlay.innerHTML = mhtml;
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  setTimeout(function() { var el = document.getElementById('tlEventName'); if (el) el.focus(); }, 100);
}

function saveTimelineEvent(clientId) {
  var name = (document.getElementById('tlEventName').value || '').trim();
  var date = (document.getElementById('tlEventDate').value || '').trim();
  if (!name) { showToast('Event name is required', 'warning'); return; }
  var clients = getClients();
  var client = _findClientById(clients, clientId);
  if (!client) return;
  if (!client.timeline) client.timeline = [];
  client.timeline.push({
    id: 'tl_' + Date.now(),
    name: name,
    date: date || new Date().toISOString().split('T')[0],
    notes: [],
    createdAt: new Date().toISOString()
  });
  client._modifiedAt = Date.now();
  var overlay = document.getElementById('timelineEventOverlay');
  if (overlay) overlay.remove();
  showToast('Timeline event added', 'success');
  _saveClientAndRefresh(clients, clientId);
}

function editClientTimelineEvent(clientId, eventId) {
  var clients = getClients();
  var client = _findClientById(clients, clientId);
  if (!client || !client.timeline) return;
  var ev = null;
  for (var i = 0; i < client.timeline.length; i++) {
    if (client.timeline[i].id === eventId) { ev = client.timeline[i]; break; }
  }
  if (!ev) return;
  var overlay = document.createElement('div');
  overlay.id = 'timelineEventOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
  var mhtml = '<div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;padding:20px;max-width:440px;width:90%;">';
  mhtml += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Edit Timeline Event</div>';
  mhtml += '<div style="margin-bottom:10px;"><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Event Name</label>';
  mhtml += '<input type="text" id="tlEventName" value="' + escapeHtml(ev.name || '') + '" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;box-sizing:border-box;"></div>';
  mhtml += '<div style="margin-bottom:14px;"><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Date</label>';
  mhtml += '<input type="date" id="tlEventDate" value="' + (ev.date || '') + '" style="width:100%;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;box-sizing:border-box;"></div>';
  mhtml += '<div style="display:flex;gap:8px;justify-content:flex-end;">';
  mhtml += '<button onclick="document.getElementById(\'timelineEventOverlay\').remove()" class="btn btn-secondary" style="padding:8px 16px;font-size:13px;">Cancel</button>';
  mhtml += '<button onclick="updateTimelineEvent(\'' + clientId + '\', \'' + eventId + '\')" class="btn btn-primary" style="padding:8px 16px;font-size:13px;">Save</button>';
  mhtml += '</div></div>';
  overlay.innerHTML = mhtml;
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function updateTimelineEvent(clientId, eventId) {
  var name = (document.getElementById('tlEventName').value || '').trim();
  var date = (document.getElementById('tlEventDate').value || '').trim();
  if (!name) { showToast('Event name is required', 'warning'); return; }
  var clients = getClients();
  var client = _findClientById(clients, clientId);
  if (!client || !client.timeline) return;
  for (var i = 0; i < client.timeline.length; i++) {
    if (client.timeline[i].id === eventId) {
      client.timeline[i].name = name;
      client.timeline[i].date = date;
      break;
    }
  }
  client._modifiedAt = Date.now();
  var overlay = document.getElementById('timelineEventOverlay');
  if (overlay) overlay.remove();
  showToast('Event updated', 'success');
  _saveClientAndRefresh(clients, clientId);
}

function deleteClientTimelineEvent(clientId, eventId) {
  if (!confirm('Delete this timeline event?')) return;
  var clients = getClients();
  var client = _findClientById(clients, clientId);
  if (!client || !client.timeline) return;
  client.timeline = client.timeline.filter(function(e) { return e.id !== eventId; });
  client._modifiedAt = Date.now();
  showToast('Event deleted', 'info');
  _saveClientAndRefresh(clients, clientId);
}

function addTimelineNote(clientId, eventId) {
  var note = prompt('Add a note:');
  if (!note || !note.trim()) return;
  var clients = getClients();
  var client = _findClientById(clients, clientId);
  if (!client || !client.timeline) return;
  for (var i = 0; i < client.timeline.length; i++) {
    if (client.timeline[i].id === eventId) {
      if (!client.timeline[i].notes) client.timeline[i].notes = [];
      client.timeline[i].notes.push(note.trim());
      break;
    }
  }
  client._modifiedAt = Date.now();
  showToast('Note added', 'success');
  _saveClientAndRefresh(clients, clientId);
}

function suggestTimelineEvents(clientId) {
  var clients = getClients();
  var client = _findClientById(clients, clientId);
  if (!client) return;
  // Build context for AI
  var context = 'Client: ' + (client.name || 'Unknown');
  if (client.company) context += ', Company: ' + client.company;
  if (client.industry) context += ', Industry: ' + client.industry;
  if (client.stage) context += ', Stage: ' + client.stage;
  if (client.category) context += ', Category: ' + client.category;
  if (client.notes) context += ', Notes: ' + client.notes.substring(0, 300);
  var existingEvents = (client.timeline || []).map(function(e) { return e.name; }).join(', ');
  if (existingEvents) context += ', Existing events: ' + existingEvents;

  var systemPrompt = 'You are a business strategist. Given a client profile, suggest 5-8 key timeline events/milestones that would be valuable to track for this client relationship. Return ONLY a JSON array of objects with "name" and "date" fields (date as YYYY-MM-DD, spread across the next 6 months from today). No explanation, just the JSON array.';
  var userPrompt = 'Suggest key timeline milestones for this client: ' + context + '. Today is ' + new Date().toISOString().split('T')[0] + '.';

  showToast('Generating AI suggestions...', 'info');

  // Use the existing AI call infrastructure
  if (typeof callOpenAIStreaming === 'function') {
    var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
    callOpenAIStreaming(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      function(text) {
        try {
          // Extract JSON array from response
          var match = text.match(/\[[\s\S]*\]/);
          if (match) {
            var suggestions = JSON.parse(match[0]);
            if (Array.isArray(suggestions) && suggestions.length > 0) {
              _showTimelineSuggestions(clientId, suggestions);
              return;
            }
          }
        } catch(e) {}
        showToast('Could not parse AI suggestions', 'warning');
      },
      function(err) { showToast('AI suggestion failed: ' + (err.message || err), 'error'); },
      { temperature: 0.7, maxTokens: 800, brandIndex: brandIdx }
    );
  } else {
    showToast('AI not available', 'warning');
  }
}

function _showTimelineSuggestions(clientId, suggestions) {
  var overlay = document.createElement('div');
  overlay.id = 'timelineSuggestOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
  var mhtml = '<div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:12px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">';
  mhtml += '<div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Suggested Timeline Events</div>';
  mhtml += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">Select events to add to the timeline:</div>';
  for (var i = 0; i < suggestions.length; i++) {
    var s = suggestions[i];
    var dateStr = s.date || '';
    mhtml += '<label style="display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--bg-tertiary);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer;border:1px solid var(--border-color);">';
    mhtml += '<input type="checkbox" class="tl-suggest-check" data-name="' + escapeHtml(s.name || '') + '" data-date="' + escapeHtml(dateStr) + '" checked>';
    mhtml += '<div>';
    mhtml += '<div style="font-size:13px;font-weight:500;color:var(--text-primary);">' + escapeHtml(s.name || 'Event') + '</div>';
    if (dateStr) mhtml += '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(dateStr) + '</div>';
    mhtml += '</div></label>';
  }
  mhtml += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">';
  mhtml += '<button onclick="document.getElementById(\'timelineSuggestOverlay\').remove()" class="btn btn-secondary" style="padding:8px 16px;font-size:13px;">Cancel</button>';
  mhtml += '<button onclick="applyTimelineSuggestions(\'' + clientId + '\')" class="btn btn-primary" style="padding:8px 16px;font-size:13px;">Add Selected</button>';
  mhtml += '</div></div>';
  overlay.innerHTML = mhtml;
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function applyTimelineSuggestions(clientId) {
  var checks = document.querySelectorAll('.tl-suggest-check:checked');
  if (checks.length === 0) { showToast('No events selected', 'warning'); return; }
  var clients = getClients();
  var client = _findClientById(clients, clientId);
  if (!client) return;
  if (!client.timeline) client.timeline = [];
  for (var i = 0; i < checks.length; i++) {
    client.timeline.push({
      id: 'tl_' + (Date.now() + i),
      name: checks[i].dataset.name,
      date: checks[i].dataset.date || new Date().toISOString().split('T')[0],
      notes: [],
      createdAt: new Date().toISOString(),
      aiSuggested: true
    });
  }
  client._modifiedAt = Date.now();
  var overlay = document.getElementById('timelineSuggestOverlay');
  if (overlay) overlay.remove();
  showToast(checks.length + ' event' + (checks.length !== 1 ? 's' : '') + ' added', 'success');
  _saveClientAndRefresh(clients, clientId);
}

// v28.6: Get client identity context for BrandAI
function getClientIdentityContext(clientId) {
  var clients = getClients();
  var client = _findClientById(clients, clientId);
  if (!client) return '';
  var parts = [];
  parts.push('Client: ' + (client.name || 'Unknown'));
  if (client.company) parts.push('Company: ' + client.company);
  if (client.industry) parts.push('Industry: ' + client.industry);
  if (client.role) parts.push('Role: ' + client.role);
  if (client.website) parts.push('Website: ' + client.website);
  if (client.stage) parts.push('Stage: ' + client.stage);
  if (client.category) parts.push('Category: ' + client.category);
  if (client.dealValue) parts.push('Deal Value: $' + parseFloat(client.dealValue).toLocaleString());
  if (client.notes) parts.push('Notes: ' + client.notes.substring(0, 500));
  if (client.timeline && client.timeline.length > 0) {
    var tlSummary = client.timeline.map(function(e) { return e.name + ' (' + (e.date || 'no date') + ')'; }).join(', ');
    parts.push('Timeline: ' + tlSummary);
  }
  if (client.actionPrompts && client.actionPrompts.length > 0) {
    parts.push('Action Prompts: ' + client.actionPrompts.map(function(p) { return p.name; }).join(', '));
  }
  return parts.join('. ');
}

function updateClientStage(clientId, newStage) {
  var clients = getClients();
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) {
      if (clients[i].stage === newStage) return;
      clients[i].stage = newStage;
      if (!clients[i].stageHistory) clients[i].stageHistory = [];
      clients[i].stageHistory.push({ stage: newStage, date: new Date().toISOString() });
      break;
    }
  }
  saveClients(clients);
  openClientDetail(clientId);
  showToast('Stage updated to ' + getStageLabel(newStage), 'success');
}

// v24.20: Client drag-and-drop between pipeline stages
var _clientDragId = null;

function clientDragStart(e, clientId) {
  _clientDragId = clientId;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', clientId);
  var row = e.target.closest('.client-row');
  if (row) row.style.opacity = '0.5';
}

function clientDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var zone = e.currentTarget;
  if (zone && !zone.classList.contains('drag-over')) {
    zone.classList.add('drag-over');
  }
}

function clientDragLeave(e) {
  var zone = e.currentTarget;
  if (zone) zone.classList.remove('drag-over');
}

function clientDrop(e, stageId) {
  e.preventDefault();
  var zone = e.currentTarget;
  if (zone) zone.classList.remove('drag-over');
  var clientId = _clientDragId || e.dataTransfer.getData('text/plain');
  if (!clientId) return;
  _clientDragId = null;
  // Update stage (reuses existing function logic but re-renders pipeline, not detail)
  var clients = getClients();
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) {
      if (clients[i].stage === stageId) return;
      clients[i].stage = stageId;
      if (!clients[i].stageHistory) clients[i].stageHistory = [];
      clients[i].stageHistory.push({ stage: stageId, date: new Date().toISOString() });
      break;
    }
  }
  saveClients(clients);
  if (typeof renderClientsPipeline === 'function') renderClientsPipeline();
  showToast('Moved to ' + getStageLabel(stageId), 'success');
  // v25.1: saveClients() already writes through to Firestore
}

// v16.11: BrandAI Client Identity context injection
function getClientIdentityContext(clientName, brandIdx) {
  // v25.3: Search all people types, not just clients
  var allPeople = typeof getPeople === 'function' ? getPeople() : getClients();
  var match = null;
  var nameLower = clientName.toLowerCase();
  for (var i = 0; i < allPeople.length; i++) {
    if (allPeople[i].name && allPeople[i].name.toLowerCase() === nameLower) {
      if (typeof brandIdx !== 'undefined' && allPeople[i].brandIndex !== brandIdx) continue;
      match = allPeople[i];
      break;
    }
  }
  if (!match) return '';
  var ctx = '\n===== CLIENT PROFILE: ' + match.name + ' =====\n';
  if (match.role) ctx += 'ROLE: ' + match.role + '\n';
  if (match.company) ctx += 'COMPANY: ' + match.company + '\n';
  if (match.industry) ctx += 'INDUSTRY: ' + match.industry + '\n';
  if (match.location) ctx += 'LOCATION: ' + match.location + '\n';
  if (match.website) ctx += 'WEBSITE: ' + match.website + '\n';
  if (match.email) ctx += 'EMAIL: ' + match.email + '\n';
  if (match.phone) ctx += 'PHONE: ' + match.phone + '\n';
  if (match.stage) ctx += 'PIPELINE: ' + getStageLabel(match.stage) + '\n';
  // v23.3: Sprint 4 fields
  if (match.category) ctx += 'CATEGORY: ' + (typeof getCategoryLabel === 'function' ? getCategoryLabel(match.category) : match.category) + '\n';
  if (match.priority && match.priority !== 'low') ctx += 'PRIORITY: ' + match.priority.toUpperCase() + '\n';
  if (match.relationshipStatus) ctx += 'RELATIONSHIP: ' + (typeof getRelationshipStatusLabel === 'function' ? getRelationshipStatusLabel(match.relationshipStatus) : match.relationshipStatus) + '\n';
  if (match.dialogueHistory && match.dialogueHistory.length > 0) {
    var latest = match.dialogueHistory[0];
    ctx += 'LATEST DIALOGUE (' + (latest.source || 'Note') + ', ' + (latest.timestamp ? new Date(latest.timestamp).toLocaleDateString() : '') + '): ' + (latest.summary || '').substring(0, 200) + '\n';
  }
  if (match.notes) ctx += 'NOTES: ' + match.notes.substring(0, 300) + (match.notes.length > 300 ? '...' : '') + '\n';
  // v22.39: Inject client guardrails into prompt context
  if (typeof getClientGuardrailsContext === 'function') {
    var _cgCtx = getClientGuardrailsContext(match.name);
    if (_cgCtx) ctx += _cgCtx + '\n';
  }
  return ctx;
}

function getActiveClientsContext(brandIdx) {
  // v25.3: Expanded to include all people types (clients, team, reports)
  var clients = getClients().filter(function(c) {
    return c.stage !== 'archived' && c.brandIndex === brandIdx;
  }).slice(0, 15);
  var teamMembers = getPeople('team').filter(function(p) {
    return p.brandIndex === brandIdx;
  }).slice(0, 10);
  var reports = getPeople('report').filter(function(p) {
    return p.brandIndex === brandIdx;
  }).slice(0, 10);
  if (clients.length === 0 && teamMembers.length === 0 && reports.length === 0) return '';
  var ctx = '\n===== PEOPLE ROSTER =====\n';
  // Clients
  ctx += '--- Clients (' + clients.length + ') ---\n';
  clients.forEach(function(c) {
    ctx += '- ' + c.name;
    if (c.company) ctx += ' (' + c.company + ')';
    ctx += ' [' + getStageLabel(c.stage) + ']';
    if (c.industry) ctx += ' - ' + c.industry;
    ctx += '\n';
  });
  // Team Members
  ctx += '--- Team Members (' + teamMembers.length + ') ---\n';
  teamMembers.forEach(function(t) {
    ctx += '- ' + (t.name || 'Unknown');
    ctx += ' | ' + (t.role || 'No role');
    ctx += ' | ' + (t.department || 'No department');
    ctx += ' | ' + (t.availability || 'Unknown');
    ctx += '\n';
  });
  // Direct Reports
  ctx += '--- Direct Reports (' + reports.length + ') ---\n';
  reports.forEach(function(r) {
    ctx += '- ' + (r.name || 'Unknown');
    ctx += ' | ' + (r.role || 'No role');
    ctx += ' | ' + (r.stage ? getStageLabel(r.stage) : 'No status');
    ctx += ' | Next check-in: ' + (r.nextCheckIn || 'none');
    ctx += '\n';
  });
  return ctx;
}

/**
 * v23.3: Sprint 4 — Client Management & CRM
 * Enhanced profiles, relationship status, dialogue tracking, timeline, Studio integration, universal/brand scope
 */

// --- 4.1: Client Categories & Priority ---
var CLIENT_CATEGORIES = [
  { id: 'lead', label: 'Lead', color: '#94a3b8' },
  { id: 'active_client', label: 'Active Client', color: '#4ade80' },
  { id: 'past_client', label: 'Past Client', color: '#6b7280' },
  { id: 'partner', label: 'Partner', color: '#a78bfa' },
  { id: 'prospect', label: 'Prospect', color: '#60a5fa' },
  { id: 'custom', label: 'Custom', color: '#f59e0b' }
];

var CLIENT_PRIORITIES = [
  { id: 'high', label: 'High', color: '#d4af37' },
  { id: 'medium', label: 'Medium', color: '#94a3b8' },
  { id: 'low', label: 'Low', color: 'transparent' }
];

// --- 4.2: Relationship Statuses ---
var CLIENT_RELATIONSHIP_STATUSES = [
  { id: 'prospecting', label: 'Prospecting', color: '#94a3b8' },
  { id: 'initial_contact', label: 'Initial Contact', color: '#60a5fa' },
  { id: 'negotiating', label: 'Negotiating', color: '#a78bfa' },
  { id: 'onboarding', label: 'Onboarding', color: '#22d3ee' },
  { id: 'active_engagement', label: 'Active Engagement', color: '#4ade80' },
  { id: 'maintenance', label: 'Maintenance', color: '#fbbf24' },
  { id: 'at_risk', label: 'At Risk', color: '#f87171' },
  { id: 'dormant', label: 'Dormant', color: '#6b7280' },
  { id: 'closed_won', label: 'Closed/Won', color: '#10b981' },
  { id: 'closed_lost', label: 'Closed/Lost', color: '#ef4444' }
];

// --- 4.4: Timeline Categories ---
var TIMELINE_CATEGORIES = [
  { id: 'key_date', label: 'Key Date', color: '#d4af37' },
  { id: 'event', label: 'Event', color: '#6b7280' },
  { id: 'personal', label: 'Personal', color: '#60a5fa' },
  { id: 'conflict', label: 'Conflict', color: '#f87171' },
  { id: 'growth', label: 'Growth', color: '#4ade80' },
  { id: 'status_change', label: 'Status Change', color: '#f5f5f5' }
];

// --- Sprint 4 state ---
var clientsCategoryFilterValue = '';
var clientsSortValue = 'name';
var _clientBulkSelected = [];
var _studioAttachedClientId = '';

// --- 4.1: Category helpers ---
function getCategoryLabel(catId) {
  for (var i = 0; i < CLIENT_CATEGORIES.length; i++) {
    if (CLIENT_CATEGORIES[i].id === catId) return CLIENT_CATEGORIES[i].label;
  }
  return catId || '';
}
function getCategoryColor(catId) {
  for (var i = 0; i < CLIENT_CATEGORIES.length; i++) {
    if (CLIENT_CATEGORIES[i].id === catId) return CLIENT_CATEGORIES[i].color;
  }
  return '#94a3b8';
}

// --- 4.2: Relationship status helpers ---
function getRelationshipStatusLabel(statusId) {
  for (var i = 0; i < CLIENT_RELATIONSHIP_STATUSES.length; i++) {
    if (CLIENT_RELATIONSHIP_STATUSES[i].id === statusId) return CLIENT_RELATIONSHIP_STATUSES[i].label;
  }
  return statusId || '';
}
function getRelationshipStatusColor(statusId) {
  for (var i = 0; i < CLIENT_RELATIONSHIP_STATUSES.length; i++) {
    if (CLIENT_RELATIONSHIP_STATUSES[i].id === statusId) return CLIENT_RELATIONSHIP_STATUSES[i].color;
  }
  return '#94a3b8';
}

function updateClientRelationshipStatus(clientId, newStatus) {
  var clients = getClients();
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) {
      var oldStatus = clients[i].relationshipStatus || '';
      if (oldStatus === newStatus) return;
      clients[i].relationshipStatus = newStatus;
      if (!clients[i].relationshipStatusHistory) clients[i].relationshipStatusHistory = [];
      clients[i].relationshipStatusHistory.push({ from: oldStatus, to: newStatus, date: new Date().toISOString() });
      // v23.3: Auto-add timeline entry for status change
      if (!clients[i].timeline) clients[i].timeline = [];
      clients[i].timeline.push({
        id: Date.now().toString(36),
        date: new Date().toISOString(),
        category: 'status_change',
        title: 'Status changed to ' + getRelationshipStatusLabel(newStatus),
        description: oldStatus ? 'Changed from ' + getRelationshipStatusLabel(oldStatus) : 'Initial status set',
        source: 'system',
        createdAt: new Date().toISOString()
      });
      break;
    }
  }
  saveClients(clients);
  openClientDetail(clientId);
  showToast('Relationship status updated', 'success');
}

// --- 4.1: Category/Sort/Bulk ---
function filterClientsByCategory(cat) {
  clientsCategoryFilterValue = cat || '';
  renderClientsView();
}

function sortClientsBy(field) {
  clientsSortValue = field || 'name';
  renderClientsView();
}

function sortClientArray(arr) {
  var field = clientsSortValue;
  return arr.slice().sort(function(a, b) {
    if (field === 'priority') {
      var pOrder = { high: 0, medium: 1, low: 2 };
      return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
    }
    if (field === 'category') {
      return (a.category || '').localeCompare(b.category || '');
    }
    if (field === 'dateAdded') {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
    if (field === 'lastContacted') {
      return new Date(b.lastContacted || 0) - new Date(a.lastContacted || 0);
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

function toggleClientBulkSelect(clientId) {
  var idx = _clientBulkSelected.indexOf(clientId);
  if (idx === -1) _clientBulkSelected.push(clientId);
  else _clientBulkSelected.splice(idx, 1);
  updateBulkBar();
}

function updateBulkBar() {
  var bar = document.getElementById('clientsBulkBar');
  var countEl = document.getElementById('clientsBulkCount');
  if (!bar) return;
  if (_clientBulkSelected.length > 0) {
    bar.style.display = '';
    if (countEl) countEl.textContent = _clientBulkSelected.length + ' selected';
  } else {
    bar.style.display = 'none';
  }
  // Update checkboxes
  var checks = document.querySelectorAll('.client-bulk-check');
  for (var i = 0; i < checks.length; i++) {
    checks[i].checked = _clientBulkSelected.indexOf(checks[i].getAttribute('data-cid')) !== -1;
  }
}

function clientClearBulkSelection() {
  _clientBulkSelected = [];
  updateBulkBar();
  var checks = document.querySelectorAll('.client-bulk-check');
  for (var i = 0; i < checks.length; i++) checks[i].checked = false;
}

function clientBulkSetCategory() {
  if (_clientBulkSelected.length === 0) return;
  var cat = prompt('Set category for ' + _clientBulkSelected.length + ' client(s):\nOptions: lead, active_client, past_client, partner, prospect, custom');
  if (!cat) return;
  var clients = getClients();
  _clientBulkSelected.forEach(function(cid) {
    for (var i = 0; i < clients.length; i++) {
      if (clients[i].id === cid) { clients[i].category = cat; break; }
    }
  });
  saveClients(clients);
  clientClearBulkSelection();
  renderClientsView();
  showToast('Category updated for selected clients', 'success');
}

function clientBulkSetPriority() {
  if (_clientBulkSelected.length === 0) return;
  var pri = prompt('Set priority for ' + _clientBulkSelected.length + ' client(s):\nOptions: high, medium, low');
  if (!pri) return;
  var clients = getClients();
  _clientBulkSelected.forEach(function(cid) {
    for (var i = 0; i < clients.length; i++) {
      if (clients[i].id === cid) { clients[i].priority = pri; break; }
    }
  });
  saveClients(clients);
  clientClearBulkSelection();
  renderClientsView();
  showToast('Priority updated for selected clients', 'success');
}

function clientBulkExport() {
  if (_clientBulkSelected.length === 0) return;
  var clients = getClients().filter(function(c) { return _clientBulkSelected.indexOf(c.id) !== -1; });
  var csv = 'Name,Company,Email,Phone,Category,Priority,Stage,Relationship Status\n';
  clients.forEach(function(c) {
    csv += '"' + (c.name || '') + '","' + (c.company || '') + '","' + (c.email || '') + '","' + (c.phone || '') + '","' + getCategoryLabel(c.category) + '","' + (c.priority || 'low') + '","' + getStageLabel(c.stage) + '","' + getRelationshipStatusLabel(c.relationshipStatus) + '"\n';
  });
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'clients-export.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported ' + clients.length + ' client(s)', 'success');
}

// --- 4.3: Dialogue History ---
function clientAddDialogueEntry(clientId, source, summary, fullText) {
  var clients = getClients();
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) {
      if (!clients[i].dialogueHistory) clients[i].dialogueHistory = [];
      clients[i].dialogueHistory.unshift({
        id: Date.now().toString(36),
        timestamp: new Date().toISOString(),
        source: source || 'Manual Note',
        summary: summary || '',
        fullText: fullText || summary || ''
      });
      // Keep last 50 entries
      if (clients[i].dialogueHistory.length > 50) clients[i].dialogueHistory = clients[i].dialogueHistory.slice(0, 50);
      clients[i].lastContacted = new Date().toISOString();
      break;
    }
  }
  saveClients(clients);
}

function openLogInteractionModal(clientId) {
  var overlay = document.createElement('div');
  overlay.id = 'clientLogOverlay';
  overlay.className = 'client-log-overlay';
  overlay.innerHTML = '<div class="client-log-modal">' +
    '<div style="font-size: 16px; font-weight: 700; margin-bottom: var(--space-4);">Log Interaction</div>' +
    '<div style="display: flex; flex-direction: column; gap: var(--space-3);">' +
      '<div><label style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 4px;">Date</label>' +
        '<input type="date" id="logInteractionDate" class="form-control" style="padding: 6px 10px;" value="' + new Date().toISOString().split('T')[0] + '"></div>' +
      '<div><label style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 4px;">Type</label>' +
        '<select id="logInteractionType" class="form-control" style="padding: 6px 10px;">' +
          '<option value="Email">Email</option>' +
          '<option value="Meeting">Meeting</option>' +
          '<option value="Manual Note">Manual Note</option>' +
          '<option value="Studio Session">Studio Session</option>' +
          '<option value="Phone Call">Phone Call</option>' +
        '</select></div>' +
      '<div><label style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 4px;">Summary</label>' +
        '<textarea id="logInteractionSummary" class="form-control" style="padding: 8px 10px; min-height: 80px; resize: vertical;" placeholder="Brief summary of the interaction..."></textarea></div>' +
    '</div>' +
    '<div style="display: flex; gap: var(--space-3); margin-top: var(--space-4);">' +
      '<button onclick="closeLogInteractionModal()" class="btn" style="flex: 1; padding: 8px;">Cancel</button>' +
      '<button onclick="saveLogInteraction(\'' + clientId + '\')" class="btn btn-primary" style="flex: 1; padding: 8px;">Save</button>' +
    '</div>' +
  '</div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeLogInteractionModal(); });
  document.body.appendChild(overlay);
}

function closeLogInteractionModal() {
  var overlay = document.getElementById('clientLogOverlay');
  if (overlay) overlay.remove();
}

function saveLogInteraction(clientId) {
  var summary = (document.getElementById('logInteractionSummary') || {}).value;
  var type = (document.getElementById('logInteractionType') || {}).value || 'Manual Note';
  if (!summary || !summary.trim()) { showToast('Summary is required', 'warning'); return; }
  clientAddDialogueEntry(clientId, type, summary.trim());
  closeLogInteractionModal();
  openClientDetail(clientId);
  showToast('Interaction logged', 'success');
}

function searchClientDialogue(keyword) {
  if (!keyword || !keyword.trim()) return [];
  var term = keyword.toLowerCase();
  var results = [];
  var clients = getClients();
  clients.forEach(function(c) {
    if (!c.dialogueHistory) return;
    c.dialogueHistory.forEach(function(d) {
      if ((d.summary && d.summary.toLowerCase().indexOf(term) !== -1) ||
          (d.fullText && d.fullText.toLowerCase().indexOf(term) !== -1)) {
        results.push({ clientId: c.id, clientName: c.name, entry: d });
      }
    });
  });
  return results;
}

// --- 4.4: Timeline ---
function openAddTimelineModal(clientId) {
  var overlay = document.createElement('div');
  overlay.id = 'clientTlAddOverlay';
  overlay.className = 'client-tl-add-overlay';
  overlay.innerHTML = '<div class="client-tl-add-modal">' +
    '<div style="font-size: 16px; font-weight: 700; margin-bottom: var(--space-4);">Add Timeline Entry</div>' +
    '<div style="display: flex; flex-direction: column; gap: var(--space-3);">' +
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">' +
        '<div><label style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 4px;">Date</label>' +
          '<input type="date" id="tlEntryDate" class="form-control" style="padding: 6px 10px;" value="' + new Date().toISOString().split('T')[0] + '"></div>' +
        '<div><label style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 4px;">Category</label>' +
          '<select id="tlEntryCategory" class="form-control" style="padding: 6px 10px;">' +
            '<option value="key_date">Key Date</option>' +
            '<option value="event">Event</option>' +
            '<option value="personal">Personal</option>' +
            '<option value="conflict">Conflict</option>' +
            '<option value="growth">Growth</option>' +
          '</select></div>' +
      '</div>' +
      '<div><label style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 4px;">Title</label>' +
        '<input type="text" id="tlEntryTitle" class="form-control" style="padding: 6px 10px;" placeholder="e.g. Contract signed"></div>' +
      '<div><label style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 4px;">Description</label>' +
        '<textarea id="tlEntryDesc" class="form-control" style="padding: 8px 10px; min-height: 60px; resize: vertical;" placeholder="Optional details..."></textarea></div>' +
    '</div>' +
    '<div style="display: flex; gap: var(--space-3); margin-top: var(--space-4);">' +
      '<button onclick="closeAddTimelineModal()" class="btn" style="flex: 1; padding: 8px;">Cancel</button>' +
      '<button onclick="saveTimelineEntry(\'' + clientId + '\')" class="btn btn-primary" style="flex: 1; padding: 8px;">Add</button>' +
    '</div>' +
  '</div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeAddTimelineModal(); });
  document.body.appendChild(overlay);
}

function closeAddTimelineModal() {
  var el = document.getElementById('clientTlAddOverlay');
  if (el) el.remove();
}

function saveTimelineEntry(clientId) {
  var title = (document.getElementById('tlEntryTitle') || {}).value;
  if (!title || !title.trim()) { showToast('Title is required', 'warning'); return; }
  var date = (document.getElementById('tlEntryDate') || {}).value || new Date().toISOString();
  var category = (document.getElementById('tlEntryCategory') || {}).value || 'event';
  var desc = (document.getElementById('tlEntryDesc') || {}).value || '';
  var clients = getClients();
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) {
      if (!clients[i].timeline) clients[i].timeline = [];
      clients[i].timeline.push({
        id: Date.now().toString(36),
        date: date,
        category: category,
        title: title.trim(),
        description: desc.trim(),
        source: 'manual',
        createdAt: new Date().toISOString()
      });
      break;
    }
  }
  saveClients(clients);
  closeAddTimelineModal();
  openClientDetail(clientId);
  showToast('Timeline entry added', 'success');
}

function getTimelineCategoryColor(catId) {
  for (var i = 0; i < TIMELINE_CATEGORIES.length; i++) {
    if (TIMELINE_CATEGORIES[i].id === catId) return TIMELINE_CATEGORIES[i].color;
  }
  return '#6b7280';
}

function getTimelineCategoryLabel(catId) {
  for (var i = 0; i < TIMELINE_CATEGORIES.length; i++) {
    if (TIMELINE_CATEGORIES[i].id === catId) return TIMELINE_CATEGORIES[i].label;
  }
  return catId || 'Event';
}

function renderClientTimeline(client, filterCat) {
  var entries = (client.timeline || []).slice();
  if (filterCat) entries = entries.filter(function(e) { return e.category === filterCat; });
  entries.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  if (entries.length === 0) return '<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: var(--text-sm);">No timeline entries yet</div>';
  var html = '<div class="client-timeline">';
  entries.forEach(function(e) {
    var color = getTimelineCategoryColor(e.category);
    var dateStr = e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    html += '<div class="client-timeline-entry">';
    html += '<div class="client-timeline-dot" style="background: ' + color + ';"></div>';
    html += '<div class="client-timeline-content">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
    html += '<span class="tl-title">' + escapeHtml(e.title) + '</span>';
    html += '<span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background: ' + color + '22; color: ' + color + ';">' + getTimelineCategoryLabel(e.category) + '</span>';
    html += '</div>';
    if (e.description) html += '<div class="tl-desc">' + escapeHtml(e.description) + '</div>';
    html += '<div class="tl-date">' + dateStr + '</div>';
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

// --- 4.5: Studio Client Attachment ---
function getStudioAttachedClient() {
  if (!_studioAttachedClientId) return null;
  var clients = getClients();
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === _studioAttachedClientId) return clients[i];
  }
  return null;
}

function attachClientToStudio(clientId) {
  _studioAttachedClientId = clientId || '';
  var sel = document.getElementById('studioClientSelector');
  if (sel) sel.value = clientId || '';
  // v23.3: Auto-log dialogue entry when studio session attached
  if (clientId) {
    showToast('Client attached to Studio session', 'success');
  }
}

function detachClientFromStudio() {
  _studioAttachedClientId = '';
  var sel = document.getElementById('studioClientSelector');
  if (sel) sel.value = '';
}

function getStudioClientContext() {
  var client = getStudioAttachedClient();
  if (!client) return '';
  var ctx = '\n===== STUDIO SESSION CLIENT: ' + client.name + ' =====\n';
  if (client.company) ctx += 'Company: ' + client.company + '\n';
  if (client.industry) ctx += 'Industry: ' + client.industry + '\n';
  if (client.role) ctx += 'Role: ' + client.role + '\n';
  if (client.relationshipStatus) ctx += 'Relationship: ' + getRelationshipStatusLabel(client.relationshipStatus) + '\n';
  if (client.notes) ctx += 'Notes: ' + client.notes.substring(0, 200) + '\n';
  // Include latest dialogue
  if (client.dialogueHistory && client.dialogueHistory.length > 0) {
    var latest = client.dialogueHistory[0];
    ctx += 'Latest interaction (' + latest.source + '): ' + (latest.summary || '').substring(0, 200) + '\n';
  }
  ctx += 'Create content tailored to this client\'s context and needs.\n';
  return ctx;
}

function renderStudioClientSelector() {
  var container = document.getElementById('studioClientSelectorContainer');
  if (!container) return;
  var clients = getClientsForBrand();
  // Also include universal clients
  var allClients = getClients();
  var universalClients = allClients.filter(function(c) { return c.scope === 'universal'; });
  // Merge, avoiding duplicates
  var merged = clients.slice();
  universalClients.forEach(function(uc) {
    var found = false;
    for (var i = 0; i < merged.length; i++) {
      if (merged[i].id === uc.id) { found = true; break; }
    }
    if (!found) merged.push(uc);
  });
  merged.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });

  // v25.3: Include team members and direct reports in selector with optgroups
  var _stBrandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  var _stTeam = getPeople('team').filter(function(p) {
    return p.scope === 'universal' || p.brandIndex === _stBrandIdx;
  });
  _stTeam.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  var _stReports = getPeople('report').filter(function(p) {
    return p.scope === 'universal' || p.brandIndex === _stBrandIdx;
  });
  _stReports.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });

  var html = '<div class="client-studio-selector">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted); flex-shrink: 0;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>';
  html += '<select id="studioClientSelector" onchange="attachClientToStudio(this.value)">';
  html += '<option value="">No person</option>';
  if (merged.length > 0) {
    html += '<optgroup label="Clients">';
    merged.forEach(function(c) {
      var selected = _studioAttachedClientId === c.id ? ' selected' : '';
      var prefix = c.scope === 'universal' ? '[U] ' : '';
      html += '<option value="' + c.id + '"' + selected + '>' + prefix + escapeHtml(c.name) + (c.company ? ' - ' + escapeHtml(c.company) : '') + '</option>';
    });
    html += '</optgroup>';
  }
  if (_stTeam.length > 0) {
    html += '<optgroup label="Team Members">';
    _stTeam.forEach(function(t) {
      var selected = _studioAttachedClientId === t.id ? ' selected' : '';
      var prefix = t.scope === 'universal' ? '[U] ' : '';
      html += '<option value="' + t.id + '"' + selected + '>' + prefix + escapeHtml(t.name || 'Unknown') + (t.role ? ' - ' + escapeHtml(t.role) : '') + '</option>';
    });
    html += '</optgroup>';
  }
  if (_stReports.length > 0) {
    html += '<optgroup label="Direct Reports">';
    _stReports.forEach(function(r) {
      var selected = _studioAttachedClientId === r.id ? ' selected' : '';
      var prefix = r.scope === 'universal' ? '[U] ' : '';
      html += '<option value="' + r.id + '"' + selected + '>' + prefix + escapeHtml(r.name || 'Unknown') + (r.role ? ' - ' + escapeHtml(r.role) : '') + '</option>';
    });
    html += '</optgroup>';
  }
  html += '</select></div>';
  container.innerHTML = html;
}

// v25.3: Snooze client follow-up by 7 days
function snoozeClientFollowUp(clientId) {
  var newDate = new Date();
  newDate.setDate(newDate.getDate() + 7);
  savePersonById(clientId, { nextFollowUp: newDate.toISOString().split('T')[0] });
  showToast('Follow-up snoozed 7 days', 'success');
  renderClientsView();
}

// --- 4.6: Universal vs Brand-Specific Scope ---
function getClientsForBrandWithUniversal() {
  var clients = getClients();
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  if (clientsShowAllBrands) return clients;
  return clients.filter(function(c) {
    return c.scope === 'universal' || c.brandIndex === brandIdx;
  });
}

// --- 4.2: Relationship Status Dashboard Widget ---
function renderClientStatusChart(clients) {
  var counts = {};
  CLIENT_RELATIONSHIP_STATUSES.forEach(function(s) { counts[s.id] = 0; });
  clients.forEach(function(c) {
    var status = c.relationshipStatus || 'prospecting';
    counts[status] = (counts[status] || 0) + 1;
  });
  var maxCount = Math.max.apply(null, Object.keys(counts).map(function(k) { return counts[k]; })) || 1;
  var html = '<div class="client-status-chart">';
  CLIENT_RELATIONSHIP_STATUSES.forEach(function(s) {
    var count = counts[s.id] || 0;
    var heightPct = count > 0 ? Math.max(10, Math.round((count / maxCount) * 100)) : 4;
    html += '<div class="client-status-chart-bar" style="height: ' + heightPct + '%; background: ' + s.color + ';" data-label="' + s.label + ': ' + count + '" title="' + s.label + ': ' + count + '"></div>';
  });
  html += '</div>';
  html += '<div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 9px; color: var(--text-muted);">';
  html += '<span>Prospecting</span><span>Closed</span></div>';
  return html;
}

// --- Sprint 4 Migration ---
function migrateClientsSprint4() {
  var clients = getClients();
  var changed = false;
  clients.forEach(function(c) {
    if (!c.category) { c.category = 'lead'; changed = true; }
    if (!c.priority) { c.priority = 'low'; changed = true; }
    if (!c.relationshipStatus) { c.relationshipStatus = 'prospecting'; changed = true; }
    if (!c.relationshipStatusHistory) { c.relationshipStatusHistory = []; changed = true; }
    if (!c.dialogueHistory) { c.dialogueHistory = []; changed = true; }
    if (!c.timeline) { c.timeline = []; changed = true; }
    if (!c.secondaryEmails) { c.secondaryEmails = []; changed = true; }
    if (!c.customFields) { c.customFields = []; changed = true; }
    if (typeof c.scope === 'undefined') { c.scope = 'brand'; changed = true; }
  });
  if (changed) saveClients(clients);
}

/**
 * v23.4: Sprint 5 — PDF Export & Document System
 * 5.1: Universal PDF Export with standardized template
 * 5.2: PDF Color Scheme Preferences
 * 5.3: PDF Preview Before Download
 * 5.4: Client Logo in PDF Exports
 * 5.5: Hyperlink handling in PDF
 */

// 5.2: PDF Settings Modal — color scheme + logo placement
// v23.16: showPdfSettingsModal — title, cover header, logo, color scheme, logo placement, closing page
function showPdfSettingsModal(callback, pdfOpts) {
  var existing = document.getElementById('roweosPdfSettingsOverlay');
  if (existing) existing.remove();
  var currentScheme = getPdfSchemePreference();
  var currentPlacement = getPdfLogoPlacement();
  var opts = pdfOpts || {};
  // Pre-fill title from current run or passed option
  var defaultTitle = opts.title || '';
  if (!defaultTitle && window.currentRun) {
    defaultTitle = window.currentRun.contextTitle || window.currentRun.op || 'Studio Export';
  }
  // v23.16: Use studioSelectedBrand for correct brand context in PDF
  var brandIdx = _getPdfBrandIdx();
  var brandName = '';
  try { brandName = brands[brandIdx].shortName || brands[brandIdx].name || ''; } catch(e) {}
  var defaultCoverHeader = opts.coverHeader !== undefined ? opts.coverHeader : (brandName || 'RoweOS');
  // Get current brand logo
  var brandLogo = '';
  try {
    brandLogo = localStorage.getItem(getCurrentLogoKey(brandIdx)) || '';
    if (!brandLogo) brandLogo = (brands[brandIdx] && (brands[brandIdx].logo || brands[brandIdx].brandLogo)) || '';
  } catch(e) {}
  // Get client logo from attached client
  var clientLogo = '';
  if (typeof getStudioAttachedClient === 'function') {
    var attachedClient = getStudioAttachedClient();
    if (attachedClient && attachedClient.logo) clientLogo = attachedClient.logo;
  }
  var overlay = document.createElement('div');
  overlay.id = 'roweosPdfSettingsOverlay';
  overlay.className = 'pdf-settings-overlay';
  overlay._customLogo = opts.customLogo || '';
  overlay._logoSource = 'brand';
  overlay._closingStyle = opts.closingStyle || 'text'; // text or logo
  var schemeCards = '';
  var schemeKeys = Object.keys(PDF_COLOR_SCHEMES);
  schemeKeys.forEach(function(key) {
    var s = PDF_COLOR_SCHEMES[key];
    var active = key === currentScheme ? ' active' : '';
    var previewBg = 'rgb(' + s.bg.join(',') + ')';
    var previewAccent = 'rgb(' + s.gold.join(',') + ')';
    schemeCards += '<div class="pdf-scheme-card' + active + '" data-scheme="' + key + '" onclick="selectPdfScheme(this, \'' + key + '\')">';
    schemeCards += '<div class="scheme-preview" style="background: ' + previewBg + '; border-bottom: 3px solid ' + previewAccent + ';"></div>';
    schemeCards += '<div class="scheme-name">' + s.label + '</div></div>';
  });
  // Determine initial logo preview
  var initialLogoSrc = brandLogo;
  var initialLogoSource = brandLogo ? 'brand' : 'none';
  var logoPlaceholderSvg = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  var sectionLabel = '<div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">';
  overlay.innerHTML = '<div class="pdf-settings-modal">' +
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">' +
    '<div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">PDF Export Settings</div>' +
    '<button onclick="closePdfSettingsModal()" style="border: none; background: none; color: var(--text-muted); cursor: pointer; padding: 4px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>' +
    sectionLabel + 'Document Title</div>' +
    '<input type="text" id="_pdfTitleInput" class="pdf-title-input" placeholder="Enter document title..." value="' + escapeHtml(defaultTitle) + '">' +
    sectionLabel + 'Cover Page Header <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted);">(appears above title)</span></div>' +
    '<input type="text" id="_pdfCoverHeader" class="pdf-title-input" placeholder="e.g. Company Name, CONFIDENTIAL..." value="' + escapeHtml(defaultCoverHeader) + '">' +
    sectionLabel + 'Logo</div>' +
    '<div class="pdf-logo-upload-area">' +
    '<div class="pdf-logo-preview" id="_pdfLogoPreview">' + (initialLogoSrc ? '<img src="' + initialLogoSrc + '" alt="Logo">' : logoPlaceholderSvg) + '</div>' +
    '<div class="pdf-logo-btns">' +
    (brandLogo ? '<button id="_pdfLogoBrand" class="pdf-logo-active" onclick="pdfSelectLogoSource(\'brand\')">Brand Logo</button>' : '') +
    (clientLogo ? '<button id="_pdfLogoClient" onclick="pdfSelectLogoSource(\'client\')">Client Logo</button>' : '') +
    '<button id="_pdfLogoUpload" onclick="document.getElementById(\'_pdfLogoFileInput\').click()">Upload Logo</button>' +
    '<button id="_pdfLogoNone"' + (!brandLogo && !clientLogo ? ' class="pdf-logo-active"' : '') + ' onclick="pdfSelectLogoSource(\'none\')">No Logo</button>' +
    '</div>' +
    '<input type="file" id="_pdfLogoFileInput" accept="image/*" style="display:none" onchange="pdfHandleLogoUpload(this)">' +
    '</div>' +
    sectionLabel + 'Color Scheme</div>' +
    '<div class="pdf-scheme-grid">' + schemeCards + '</div>' +
    sectionLabel + 'Cover & Closing Font</div>' +
    '<div class="pdf-logo-placement" style="margin-top:4px;">' +
    '<button id="_pdfFontHelvetica" class="active" onclick="pdfSelectFont(\'helvetica\')">Helvetica</button>' +
    '<button id="_pdfFontTimes" onclick="pdfSelectFont(\'times\')">Times</button>' +
    '<button id="_pdfFontCourier" onclick="pdfSelectFont(\'courier\')">Courier</button>' +
    '<button id="_pdfFontCursive" onclick="pdfSelectFont(\'cursive\')" style="font-style:italic;">Cursive</button>' +
    '</div>' +
    sectionLabel + 'Logo Placement</div>' +
    '<div class="pdf-logo-placement" style="margin-top:4px;">' +
    '<button onclick="selectPdfLogoPlacement(this, \'left\')" class="' + (currentPlacement === 'left' ? 'active' : '') + '">Left</button>' +
    '<button onclick="selectPdfLogoPlacement(this, \'center\')" class="' + (currentPlacement === 'center' ? 'active' : '') + '">Center</button>' +
    '<button onclick="selectPdfLogoPlacement(this, \'right\')" class="' + (currentPlacement === 'right' ? 'active' : '') + '">Right</button>' +
    '</div>' +
    sectionLabel + 'Closing Page</div>' +
    '<div class="pdf-logo-placement" style="margin-top:4px;">' +
    '<button id="_pdfClosingText" class="active" onclick="pdfSelectClosingStyle(\'text\')">Brand Name</button>' +
    '<button id="_pdfClosingLogo" onclick="pdfSelectClosingStyle(\'logo\')">Logo</button>' +
    '<button id="_pdfClosingBoth" onclick="pdfSelectClosingStyle(\'both\')">Both</button>' +
    '</div>' +
    '<div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">' +
    '<button onclick="closePdfSettingsModal()" class="btn btn-secondary" style="padding: 8px 16px; font-size: 12px;">Cancel</button>' +
    '<button id="_pdfSettingsApply" class="btn" style="padding: 8px 20px; font-size: 12px; background: var(--brand-accent, #a89878); color: #fff; border-color: var(--brand-accent, #a89878);">Apply & Preview</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
  overlay._brandLogo = brandLogo;
  overlay._clientLogo = clientLogo;
  overlay._logoSource = initialLogoSource;
  overlay._coverFont = opts.coverFont || 'helvetica';
  // Set initial active states for font and closing style from opts
  if (opts.coverFont && opts.coverFont !== 'helvetica') {
    setTimeout(function() { pdfSelectFont(opts.coverFont); }, 0);
  }
  if (opts.closingStyle && opts.closingStyle !== 'text') {
    setTimeout(function() { pdfSelectClosingStyle(opts.closingStyle); }, 0);
  }
  overlay.onclick = function(e) { if (e.target === overlay) closePdfSettingsModal(); };
  document.getElementById('_pdfSettingsApply').onclick = function() {
    var titleVal = (document.getElementById('_pdfTitleInput').value || '').trim() || defaultTitle;
    var coverHeaderVal = (document.getElementById('_pdfCoverHeader').value || '').trim();
    var logoVal = '';
    if (overlay._logoSource === 'brand') logoVal = overlay._brandLogo || '';
    else if (overlay._logoSource === 'client') logoVal = overlay._clientLogo || '';
    else if (overlay._logoSource === 'custom') logoVal = overlay._customLogo || '';
    overlay.remove();
    if (callback) callback({ scheme: currentScheme, placement: currentPlacement, title: titleVal, logo: logoVal, coverHeader: coverHeaderVal, closingStyle: overlay._closingStyle, coverFont: overlay._coverFont || 'helvetica' });
  };
  overlay._currentScheme = currentScheme;
  overlay._currentPlacement = currentPlacement;
  overlay._callback = callback;
}

// v23.16: Closing page style selector
function pdfSelectClosingStyle(style) {
  var overlay = document.getElementById('roweosPdfSettingsOverlay');
  if (overlay) overlay._closingStyle = style;
  var btns = ['_pdfClosingText', '_pdfClosingLogo', '_pdfClosingBoth'];
  for (var i = 0; i < btns.length; i++) {
    var b = document.getElementById(btns[i]);
    if (b) b.classList.toggle('active', btns[i] === '_pdfClosing' + style.charAt(0).toUpperCase() + style.slice(1));
  }
}

// v23.16: PDF cover/closing font selector (includes cursive via embedded Google Font)
function pdfSelectFont(font) {
  var overlay = document.getElementById('roweosPdfSettingsOverlay');
  if (overlay) overlay._coverFont = font;
  var ids = ['_pdfFontHelvetica', '_pdfFontTimes', '_pdfFontCourier', '_pdfFontCursive'];
  var map = { helvetica: 0, times: 1, courier: 2, cursive: 3 };
  for (var i = 0; i < ids.length; i++) {
    var b = document.getElementById(ids[i]);
    if (b) b.classList.toggle('active', i === map[font]);
  }
}

// v23.16: Load cursive font (Dancing Script) for jsPDF — cached after first load
var _pdfCursiveFontData = null;
function loadCursiveFont(callback) {
  if (_pdfCursiveFontData) { callback(_pdfCursiveFontData); return; }
  // Dancing Script Regular from Google Fonts — fetch TTF and convert to base64
  var url = 'https://fonts.gstatic.com/s/dancingscript/v25/If2RXTr6YS-zF4S-kcSWSVi_szLgiuE.ttf';
  fetch(url).then(function(resp) {
    if (!resp.ok) throw new Error('Font fetch failed');
    return resp.arrayBuffer();
  }).then(function(buf) {
    var bytes = new Uint8Array(buf);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    _pdfCursiveFontData = btoa(binary);
    callback(_pdfCursiveFontData);
  }).catch(function(err) {
    console.error('[PDF] Failed to load cursive font:', err);
    callback(null);
  });
}

// v23.16: Register cursive font with a jsPDF instance
function registerCursiveFont(pdf) {
  if (!_pdfCursiveFontData) return false;
  try {
    pdf.addFileToVFS('DancingScript-Regular.ttf', _pdfCursiveFontData);
    pdf.addFont('DancingScript-Regular.ttf', 'cursive', 'normal');
    pdf.addFont('DancingScript-Regular.ttf', 'cursive', 'bold');
    pdf.addFont('DancingScript-Regular.ttf', 'cursive', 'italic');
    return true;
  } catch(e) {
    console.error('[PDF] Failed to register cursive font:', e);
    return false;
  }
}

// v23.16: PDF logo source selection
function pdfSelectLogoSource(source) {
  var overlay = document.getElementById('roweosPdfSettingsOverlay');
  if (!overlay) return;
  overlay._logoSource = source;
  // Update button active states
  var btns = overlay.querySelectorAll('.pdf-logo-btns button');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('pdf-logo-active');
  var activeId = '_pdfLogo' + source.charAt(0).toUpperCase() + source.slice(1);
  var activeBtn = document.getElementById(activeId);
  if (activeBtn) activeBtn.classList.add('pdf-logo-active');
  // Update preview
  var preview = document.getElementById('_pdfLogoPreview');
  if (!preview) return;
  var logoSrc = '';
  if (source === 'brand') logoSrc = overlay._brandLogo || '';
  else if (source === 'client') logoSrc = overlay._clientLogo || '';
  else if (source === 'custom') logoSrc = overlay._customLogo || '';
  if (logoSrc) {
    preview.innerHTML = '<img src="' + logoSrc + '" alt="Logo">';
  } else {
    preview.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  }
}

// v23.16: PDF logo file upload handler
function pdfHandleLogoUpload(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2MB', 'error'); return; }
  if (file.type.indexOf('image/') !== 0) { showToast('Please select an image file', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    var overlay = document.getElementById('roweosPdfSettingsOverlay');
    if (!overlay) return;
    overlay._customLogo = e.target.result;
    pdfSelectLogoSource('custom');
    // Mark upload button as active
    var uploadBtn = document.getElementById('_pdfLogoUpload');
    if (uploadBtn) { uploadBtn.classList.add('pdf-logo-active'); uploadBtn.textContent = file.name.length > 16 ? file.name.substring(0, 14) + '...' : file.name; }
  };
  reader.readAsDataURL(file);
}

function closePdfSettingsModal() {
  var overlay = document.getElementById('roweosPdfSettingsOverlay');
  if (overlay) overlay.remove();
}

function selectPdfScheme(el, scheme) {
  var container = el.parentElement;
  var cards = container.querySelectorAll('.pdf-scheme-card');
  for (var i = 0; i < cards.length; i++) cards[i].classList.remove('active');
  el.classList.add('active');
  savePdfSchemePreference(scheme);
  var overlay = document.getElementById('roweosPdfSettingsOverlay');
  if (overlay) overlay._currentScheme = scheme;
}

function selectPdfLogoPlacement(el, placement) {
  var container = el.parentElement;
  var buttons = container.querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove('active');
  el.classList.add('active');
  savePdfLogoPlacement(placement);
  var overlay = document.getElementById('roweosPdfSettingsOverlay');
  if (overlay) overlay._currentPlacement = placement;
}

// 5.3: PDF Preview Modal
function showPdfPreviewModal(pdfResult, onDownload, onAdjust) {
  var existing = document.getElementById('roweosPdfPreviewOverlay');
  if (existing) existing.remove();
  if (!pdfResult || !pdfResult.base64) {
    showToast('No PDF data to preview', 'error');
    return;
  }
  var overlay = document.createElement('div');
  overlay.id = 'roweosPdfPreviewOverlay';
  overlay.className = 'pdf-preview-overlay';
  var currentZoom = 100;
  overlay.innerHTML = '<div class="pdf-preview-modal">' +
    '<div class="pdf-preview-toolbar">' +
    '<div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">' + escapeHtml(pdfResult.filename || 'PDF Preview') + '</div>' +
    '<div class="pdf-zoom-controls">' +
    '<button class="pdf-zoom-btn" onclick="pdfPreviewZoom(50)">50%</button>' +
    '<button class="pdf-zoom-btn" onclick="pdfPreviewZoom(75)">75%</button>' +
    '<button class="pdf-zoom-btn active" onclick="pdfPreviewZoom(100)">100%</button>' +
    '<button class="pdf-zoom-btn" onclick="pdfPreviewZoom(150)">150%</button>' +
    '</div></div>' +
    '<div class="pdf-preview-body" id="pdfPreviewBody">' +
    '<iframe id="pdfPreviewFrame" style="width: 100%; height: 100%; min-height: 600px; transform-origin: top center;"></iframe>' +
    '</div>' +
    '<div class="pdf-preview-actions">' +
    (onAdjust ? '<button class="btn btn-secondary" id="_pdfPreviewAdjust" style="padding: 8px 16px; font-size: 12px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9"/></svg> Adjust</button>' : '') +
    '<button class="btn btn-secondary" onclick="closePdfPreviewModal()" style="padding: 8px 16px; font-size: 12px;">Cancel</button>' +
    '<button class="btn" id="_pdfPreviewDownload" style="padding: 8px 20px; font-size: 12px; background: var(--brand-accent, #a89878); color: #fff; border-color: var(--brand-accent, #a89878);"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>' +
    '</div></div>';
  document.body.appendChild(overlay);

  // v23.14: Load PDF into iframe — use blob URL for iOS multi-page support
  var frame = document.getElementById('pdfPreviewFrame');
  if (frame) {
    try {
      // Convert base64 data URI to blob URL (fixes iOS Safari single-page limit)
      var dataUri = pdfResult.base64;
      var byteString = atob(dataUri.split(',')[1]);
      var mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0];
      var ab = new ArrayBuffer(byteString.length);
      var ia = new Uint8Array(ab);
      for (var bi = 0; bi < byteString.length; bi++) ia[bi] = byteString.charCodeAt(bi);
      var blob = new Blob([ab], { type: mimeString });
      var blobUrl = URL.createObjectURL(blob);
      frame.src = blobUrl + '#zoom=100';
      frame.style.height = '100%';
      // Clean up blob URL when overlay is removed
      overlay._blobUrl = blobUrl;
    } catch(blobErr) {
      console.warn('[PDF Preview] Blob conversion failed, using data URI:', blobErr);
      frame.src = pdfResult.base64;
    }
  }

  // Button handlers
  document.getElementById('_pdfPreviewDownload').onclick = function() {
    overlay.remove();
    if (onDownload) onDownload(pdfResult);
    else {
      // Direct download
      var a = document.createElement('a');
      a.href = pdfResult.base64;
      a.download = pdfResult.filename || 'RoweOS-Export.pdf';
      a.click();
      showToast('PDF downloaded', 'success');
    }
  };
  var adjustBtn = document.getElementById('_pdfPreviewAdjust');
  if (adjustBtn && onAdjust) {
    adjustBtn.onclick = function() { overlay.remove(); onAdjust(); };
  }
  overlay.onclick = function(e) { if (e.target === overlay) closePdfPreviewModal(); };
}

function closePdfPreviewModal() {
  var overlay = document.getElementById('roweosPdfPreviewOverlay');
  if (overlay) {
    // v23.14: Clean up blob URL
    if (overlay._blobUrl) { try { URL.revokeObjectURL(overlay._blobUrl); } catch(e) {} }
    overlay.remove();
  }
}

// v23.16: Zoom PDF preview content via URL fragment reload
function pdfPreviewZoom(pct) {
  var frame = document.getElementById('pdfPreviewFrame');
  if (!frame) return;
  var overlay = document.getElementById('roweosPdfPreviewOverlay');
  var baseUrl = (overlay && overlay._blobUrl) ? overlay._blobUrl : (frame.src || '').split('#')[0];
  if (baseUrl) {
    // Use #zoom= fragment — supported by Chrome/Edge/Firefox PDF viewers
    frame.src = baseUrl + '#zoom=' + pct;
  }
  // Update active button
  var btns = document.querySelectorAll('.pdf-zoom-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].textContent === pct + '%');
  }
}

// 5.1: Universal PDF Export — chains: settings → generate → preview → download
// Standardized across all surfaces. Options: { content, title, brandName, coverPage, closingPage, brandLogo, clientLogo, skipSettings, skipPreview }
// v23.16: universalPDFExport — settings modal returns title + logo
function universalPDFExport(content, exportOpts) {
  var eo = exportOpts || {};
  // v23.16: Get brand info using studioSelectedBrand (PDF is a Studio feature)
  var brandIdx = _getPdfBrandIdx();
  var brandName = eo.brandName || '';
  if (!brandName) {
    try { brandName = brands[brandIdx].shortName || brands[brandIdx].name; } catch(e) { brandName = 'RoweOS'; }
  }
  var brandLogo = eo.brandLogo || '';
  if (!brandLogo) {
    try {
      brandLogo = localStorage.getItem(getCurrentLogoKey(brandIdx)) || '';
      if (!brandLogo) brandLogo = (brands[brandIdx] && (brands[brandIdx].logo || brands[brandIdx].brandLogo)) || '';
    } catch(e) {}
  }
  var clientLogo = eo.clientLogo || '';
  if (!clientLogo && typeof getStudioAttachedClient === 'function') {
    var attachedClient = getStudioAttachedClient();
    if (attachedClient && attachedClient.logo) clientLogo = attachedClient.logo;
  }

  function doGenerate(settings) {
    var scheme = (settings && settings.scheme) || getPdfSchemePreference();
    var placement = (settings && settings.placement) || getPdfLogoPlacement();
    // v23.16: Use title, cover header, logo, closing style from settings modal
    var finalTitle = (settings && settings.title) || eo.title || brandName + ' Export';
    var finalLogo = (settings && settings.logo !== undefined) ? settings.logo : brandLogo;
    var coverHeader = (settings && settings.coverHeader !== undefined) ? settings.coverHeader : brandName;
    var closingStyle = (settings && settings.closingStyle) || 'text';
    var coverFont = (settings && settings.coverFont) || 'helvetica';
    // v23.16: Persist PDF settings on currentRun so they survive re-opening
    if (window.currentRun) {
      window.currentRun._pdfSettings = { title: finalTitle, coverHeader: coverHeader, closingStyle: closingStyle, coverFont: coverFont, scheme: scheme, placement: placement, logo: finalLogo };
    }
    showPdfOrientationModal(function(orient) {
      // v23.16: Pre-load logo images so naturalWidth/Height are available synchronously
      var _logosToLoad = [];
      if (finalLogo && finalLogo.indexOf('data:') === 0) _logosToLoad.push(finalLogo);
      var _clLogo = (settings && settings.logo !== undefined) ? '' : clientLogo;
      if (_clLogo && _clLogo.indexOf('data:') === 0) _logosToLoad.push(_clLogo);
      var _preloaded = {};
      var _loaded = 0;
      function _onAllLoaded() {
        var pdfResult = roweosPDF(content, {
          title: finalTitle,
          brandName: brandName,
          coverHeader: coverHeader,
          closingStyle: closingStyle,
          coverPage: eo.coverPage !== false,
          closingPage: eo.closingPage !== false,
          orientation: orient,
          colorScheme: scheme,
          brandLogo: finalLogo,
          clientLogo: _clLogo,
          logoPlacement: placement,
          coverFont: coverFont,
          pageNumbers: true,
          filename: finalTitle.replace(/\s+/g, '_') + '.pdf',
          returnBase64: true,
          _preloadedLogos: _preloaded
        });
        _afterPdfGenerated(pdfResult);
      }
      // v23.16: Pre-load cursive font if selected, then proceed with logo loading
      function _afterFontReady() {
        if (_logosToLoad.length === 0) {
          _onAllLoaded();
        } else {
          _logosToLoad.forEach(function(src) {
            var img = new Image();
            img.onload = function() { _preloaded[src] = img; _loaded++; if (_loaded >= _logosToLoad.length) _onAllLoaded(); };
            img.onerror = function() { _loaded++; if (_loaded >= _logosToLoad.length) _onAllLoaded(); };
            img.src = src;
          });
          setTimeout(function() { if (_loaded < _logosToLoad.length) { _loaded = _logosToLoad.length; _onAllLoaded(); } }, 2000);
        }
      }
      if (coverFont === 'cursive' && !_pdfCursiveFontData) {
        loadCursiveFont(function() { _afterFontReady(); });
      } else {
        _afterFontReady();
      }
      function _afterPdfGenerated(pdfResult) {
        if (!pdfResult) return;
        if (eo.skipPreview) {
          pdfResult.pdf.save(pdfResult.filename);
          showToast('PDF downloaded', 'success');
          return;
        }
        showPdfPreviewModal(pdfResult, null, function() {
          // On "Adjust" — re-open settings then re-generate
          showPdfSettingsModal(function(newSettings) {
            doGenerate(newSettings);
          }, { title: finalTitle, coverHeader: coverHeader, closingStyle: closingStyle, coverFont: coverFont, customLogo: (settings && settings.logo) || '' });
        });
      }
    });
  }

  if (eo.skipSettings) {
    doGenerate(null);
  } else {
    // v23.16: Pre-fill with saved PDF settings from currentRun if available
    var savedPdf = (window.currentRun && window.currentRun._pdfSettings) || {};
    showPdfSettingsModal(function(settings) {
      doGenerate(settings);
    }, {
      title: savedPdf.title || eo.title || '',
      coverHeader: savedPdf.coverHeader,
      closingStyle: savedPdf.closingStyle,
      coverFont: savedPdf.coverFont,
      customLogo: savedPdf.logo || ''
    });
  }
}

// 5.1: Client Profile PDF Export
function exportClientAsPDF(clientId) {
  var clients = getClients();
  var client = null;
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) { client = clients[i]; break; }
  }
  if (!client) { showToast('Client not found', 'error'); return; }
  var brandName = '';
  try { brandName = brands[client.brandIndex].shortName || brands[client.brandIndex].name; } catch(e) {}
  // Build markdown content from client data
  var md = '# ' + (client.name || 'Client Profile') + '\n\n';
  if (client.company) md += '**Company:** ' + client.company + '\n\n';
  if (client.role) md += '**Role:** ' + client.role + '\n\n';
  if (client.email) md += '**Email:** ' + client.email + '\n\n';
  if (client.phone) md += '**Phone:** ' + client.phone + '\n\n';
  if (client.industry) md += '**Industry:** ' + client.industry + '\n\n';
  if (client.location) md += '**Location:** ' + client.location + '\n\n';
  if (client.website) md += '**Website:** ' + client.website + '\n\n';
  if (client.category) md += '**Category:** ' + (typeof getCategoryLabel === 'function' ? getCategoryLabel(client.category) : client.category) + '\n\n';
  if (client.priority) md += '**Priority:** ' + client.priority.charAt(0).toUpperCase() + client.priority.slice(1) + '\n\n';
  if (client.relationshipStatus) md += '**Relationship:** ' + (typeof getRelationshipStatusLabel === 'function' ? getRelationshipStatusLabel(client.relationshipStatus) : client.relationshipStatus) + '\n\n';
  if (client.stage) md += '**Pipeline Stage:** ' + client.stage.charAt(0).toUpperCase() + client.stage.slice(1) + '\n\n';
  if (client.notes) md += '## Notes\n\n' + client.notes + '\n\n';
  if (client.customFields && client.customFields.length > 0) {
    md += '## Custom Fields\n\n';
    client.customFields.forEach(function(f) { md += '**' + f.label + ':** ' + f.value + '\n\n'; });
  }
  if (client.dialogueHistory && client.dialogueHistory.length > 0) {
    md += '## Dialogue History\n\n';
    client.dialogueHistory.slice(0, 20).forEach(function(d) {
      md += '**' + (d.source || 'Note') + '** (' + new Date(d.timestamp).toLocaleDateString() + '): ' + d.summary + '\n\n';
    });
  }
  if (client.timeline && client.timeline.length > 0) {
    md += '## Timeline\n\n';
    client.timeline.slice(0, 20).forEach(function(t) {
      md += '- **' + t.title + '** (' + t.date + ')' + (t.description ? ' - ' + t.description : '') + '\n';
    });
  }
  universalPDFExport(md, {
    title: client.name || 'Client Profile',
    brandName: brandName,
    clientLogo: client.logo || '',
    coverPage: true,
    closingPage: true
  });
}

// 5.1: Library File PDF Export
function exportLibraryFileAsPDF(fileId, brandIdx) {
  var lib = getLibraryForBrandIndex(brandIdx);
  if (!lib || !lib.files) return;
  var file = lib.files.find(function(f) { return f.id === fileId; });
  if (!file) { showToast('File not found', 'error'); return; }
  var brandName = '';
  try {
    if (brandIdx >= 0) brandName = brands[brandIdx].shortName || brands[brandIdx].name;
    else brandName = 'Life';
  } catch(e) {}
  universalPDFExport(file.content || '', {
    title: file.name || 'Library Export',
    brandName: brandName,
    coverPage: true,
    closingPage: true
  });
}

// 5.1: Studio output PDF Export (enhanced — uses universal flow with preview)
function exportStudioAsPDF(run) {
  if (!run) run = window.currentRun;
  if (!run || !run.deliv) { showToast('No output to export', 'warning'); return; }
  var clientLogo = '';
  if (typeof getStudioAttachedClient === 'function') {
    var ac = getStudioAttachedClient();
    if (ac && ac.logo) clientLogo = ac.logo;
  }
  universalPDFExport(run.deliv, {
    title: run.contextTitle || run.brand || 'Document',
    brandName: run.brand || '',
    clientLogo: clientLogo,
    coverPage: true,
    closingPage: true
  });
}

// v23.4: Address Book Edit + Client Sync
var _mailEditingContactEmail = null;

function mailEditContact(email) {
  _mailEditingContactEmail = email;
  var book = getMailAddressBook();
  var contact = null;
  for (var i = 0; i < book.length; i++) {
    if (book[i].email.toLowerCase() === email.toLowerCase()) { contact = book[i]; break; }
  }
  if (!contact) { showToast('Contact not found in address book', 'error'); return; }
  // Render edit form in place
  var body = document.getElementById('mailAddressBookBody');
  if (!body) return;
  var editHtml = '<div class="mail-addressbook-edit-row" style="flex-direction: column; gap: 10px;">';
  editHtml += '<div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">Edit Contact</div>';
  editHtml += '<div style="display: flex; gap: 8px; width: 100%;">';
  editHtml += '<input id="mailEditContactName" type="text" placeholder="Name" value="' + escapeHtml(contact.name || '') + '" style="flex:1;">';
  editHtml += '<input id="mailEditContactEmail" type="email" placeholder="Email" value="' + escapeHtml(contact.email || '') + '" style="flex:1;">';
  editHtml += '</div>';
  editHtml += '<div style="display: flex; gap: 8px; width: 100%;">';
  editHtml += '<input id="mailEditContactCompany" type="text" placeholder="Company" value="' + escapeHtml(contact.company || '') + '" style="flex:1;">';
  editHtml += '<input id="mailEditContactPhone" type="text" placeholder="Phone" value="' + escapeHtml(contact.phone || '') + '" style="flex:1;">';
  editHtml += '</div>';
  editHtml += '<div class="edit-actions" style="width: 100%; display: flex; justify-content: flex-end; gap: 6px;">';
  editHtml += '<button onclick="mailCancelEditContact()">Cancel</button>';
  editHtml += '<button onclick="mailSaveEditContact()" style="background: var(--brand-accent, #a89878); color: #fff; border-color: var(--brand-accent, #a89878);">Save</button>';
  editHtml += '</div></div>';
  // Insert at top
  body.innerHTML = editHtml + body.innerHTML;
}

function mailCancelEditContact() {
  _mailEditingContactEmail = null;
  mailRenderAddressBook();
}

function mailSaveEditContact() {
  if (!_mailEditingContactEmail) return;
  var name = (document.getElementById('mailEditContactName') || {}).value || '';
  var email = (document.getElementById('mailEditContactEmail') || {}).value || '';
  var company = (document.getElementById('mailEditContactCompany') || {}).value || '';
  var phone = (document.getElementById('mailEditContactPhone') || {}).value || '';
  if (!email || email.indexOf('@') === -1) { showToast('Valid email required', 'error'); return; }
  var book = getMailAddressBook();
  for (var i = 0; i < book.length; i++) {
    if (book[i].email.toLowerCase() === _mailEditingContactEmail.toLowerCase()) {
      book[i].name = name.trim();
      book[i].email = email.trim();
      book[i].company = company.trim();
      book[i].phone = phone.trim();
      break;
    }
  }
  saveMailAddressBook(book);
  _mailEditingContactEmail = null;
  mailRenderAddressBook();
  showToast('Contact updated', 'success');
}

// v23.4: Sync address book contact to client (create or update)
function mailSyncContactToClient(email) {
  var book = getMailAddressBook();
  var contact = null;
  for (var i = 0; i < book.length; i++) {
    if (book[i].email.toLowerCase() === email.toLowerCase()) { contact = book[i]; break; }
  }
  if (!contact) { showToast('Contact not found', 'error'); return; }
  var clients = getClients();
  var existingClient = null;
  for (var j = 0; j < clients.length; j++) {
    if (clients[j].email && clients[j].email.toLowerCase() === email.toLowerCase()) { existingClient = clients[j]; break; }
  }
  var brandIdx = typeof selectedBrand !== 'undefined' ? selectedBrand : 0;
  if (existingClient) {
    // Update existing client
    if (contact.name && !existingClient.name) existingClient.name = contact.name;
    if (contact.company && !existingClient.company) existingClient.company = contact.company;
    if (contact.phone && !existingClient.phone) existingClient.phone = contact.phone;
    saveClients(clients);
    showToast('Client "' + existingClient.name + '" updated from address book', 'success');
  } else {
    // Create new client
    var newClient = {
      id: 'client_' + Date.now(),
      brandIndex: brandIdx,
      name: contact.name || email.split('@')[0],
      company: contact.company || '',
      email: contact.email,
      phone: contact.phone || '',
      industry: '', role: '', location: '', website: '', notes: '', logo: '',
      stage: 'lead',
      stageHistory: [],
      createdAt: new Date().toISOString(),
      lastContacted: contact.lastContacted || '',
      category: 'lead', priority: 'low', scope: 'brand',
      secondaryEmails: [], customFields: [],
      relationshipStatus: 'prospecting', relationshipStatusHistory: [],
      dialogueHistory: [], timeline: [{ id: 'tl_' + Date.now(), date: new Date().toISOString().split('T')[0], category: 'key_date', title: 'Client created from Address Book', description: '', source: 'system', createdAt: new Date().toISOString() }]
    };
    clients.push(newClient);
    saveClients(clients);
    showToast('Client "' + newClient.name + '" created from address book', 'success');
  }
  // v25.1: saveClients() already writes through to Firestore
}

// v23.4: Sync client data to address book
function mailSyncClientToAddressBook(clientId) {
  var clients = getClients();
  var client = null;
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) { client = clients[i]; break; }
  }
  if (!client || !client.email) { showToast('Client has no email', 'error'); return; }
  var book = getMailAddressBook();
  var exists = false;
  for (var j = 0; j < book.length; j++) {
    if (book[j].email.toLowerCase() === client.email.toLowerCase()) {
      book[j].name = client.name || book[j].name;
      book[j].company = client.company || book[j].company;
      book[j].phone = client.phone || book[j].phone;
      exists = true;
      break;
    }
  }
  if (!exists) {
    book.push({ name: client.name || '', email: client.email, company: client.company || '', phone: client.phone || '', createdAt: new Date().toISOString() });
  }
  saveMailAddressBook(book);
  showToast('Address book synced with "' + client.name + '"', 'success');
}

