// ═══════════════════════════════════════════════════════════════
// FOCUS PANEL - To-Do, Up Next, AI Recommendations
// ═══════════════════════════════════════════════════════════════

var todos = [];

// Todo Categories - 100% custom, user-created, starts empty
window.todoCategories = [];
window.selectedCategoryFilter = 'all'; // 'all' or category id

// Brand Restore System - soft-delete brands with 30-day retention
window.deletedBrands = [];

function initDeletedBrands() {
  var saved = localStorage.getItem('roweos_deleted_brands');
  if (saved) {
    try {
      window.deletedBrands = JSON.parse(saved);
    } catch(e) {
      window.deletedBrands = [];
    }
  }
  // Auto-cleanup brands older than 30 days
  clearOldDeletedBrands();
}

function saveDeletedBrands() {
  localStorage.setItem('roweos_deleted_brands', JSON.stringify(window.deletedBrands));
}

function clearOldDeletedBrands() {
  var thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  var originalLength = window.deletedBrands.length;
  window.deletedBrands = window.deletedBrands.filter(function(item) {
    return item.deletedAt > thirtyDaysAgo;
  });
  if (window.deletedBrands.length < originalLength) {
    saveDeletedBrands();
  }
}

// v12.0.1: Get mode-specific storage key for todo categories
function getTodoCategoriesKey() {
  var mode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  return mode === 'life' ? 'roweos_life_todo_categories' : 'roweos_todo_categories';
}

// v12.0.1: Get mode-specific storage key for todos
function getTodosKey() {
  var mode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  return mode === 'life' ? 'roweos_life_todos' : 'roweosTodos';
}

// v12.0.1: Get mode-specific storage key for calendar
function getCalendarKey() {
  var mode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  return mode === 'life' ? 'roweos_life_calendar' : 'roweosCalendar';
}

function initTodoCategories() {
  var saved = localStorage.getItem(getTodoCategoriesKey()); // v12.0.1: Mode-specific
  if (saved) {
    try {
      window.todoCategories = JSON.parse(saved);
    } catch(e) {
      window.todoCategories = [];
    }
  } else {
    window.todoCategories = [];
  }
  // v25.0: Tombstone filtering removed — write-through sync handles deletions immediately
}

function saveTodoCategories() {
  localStorage.setItem(getTodoCategoriesKey(), JSON.stringify(window.todoCategories)); // v12.0.1: Mode-specific
  // v25.1: Write-through -- categories go in profile (always synced, no category gate)
  writeDB('profile/main', { todoCategories: window.todoCategories });
}

function initTodos() {
  var saved = localStorage.getItem(getTodosKey()); // v12.0.1: Mode-specific
  if (saved) {
    try {
      todos = JSON.parse(saved);
    } catch(e) {
      todos = [];
    }
  } else {
    todos = [];
  }
}

function saveTodos() {
  // v27.0: Stamp _modifiedAt on each todo for merge safety
  var now = Date.now();
  for (var _ti = 0; _ti < todos.length; _ti++) {
    todos[_ti]._modifiedAt = now;
    if (!todos[_ti].id) todos[_ti].id = 'todo_' + now + '_' + _ti;
  }
  localStorage.setItem(getTodosKey(), JSON.stringify(todos)); // v12.0.1: Mode-specific
  // v11.0.5: Track local save time to prevent same-device reload glitch
  stampLocalSave();
  writeDBTodos(); // v25.1: Write-through replaces scheduleAutoSync
}

// Calendar persistence
function initCalendar() {
  var saved = localStorage.getItem(getCalendarKey()); // v12.0.1: Mode-specific
  if (saved) {
    try {
      calendar = JSON.parse(saved);
    } catch(e) {
      calendar = [];
    }
  }
  // v16.12: Load cached external events + build merged view
  loadCalendarVisibility();
  loadCachedExternalEvents();
  rebuildMergedCalendar();
  // v16.12: Init Google Calendar auth (tries silent re-auth if previously connected)
  setTimeout(function() { initGoogleCalendarAuth(); }, 500);
  // v16.12: Sync iCloud if previously connected
  if (_icloudConnected) {
    setTimeout(function() { syncICloudCalendarEvents(); }, 1000);
  }
  // v22.44: Fetch calendar lists for connected providers on load
  setTimeout(function() {
    if (_gcalConnected && _gcalAccessToken) fetchGoogleCalendarList();
    if (_outlookCalConnected) fetchOutlookCalendarList();
    renderCalendarListUI();
  }, 1500);
}

function saveCalendar() {
  // v27.0: Stamp _modifiedAt on each event for merge safety
  var now = Date.now();
  for (var _ci = 0; _ci < calendar.length; _ci++) {
    calendar[_ci]._modifiedAt = now;
    if (!calendar[_ci].id) calendar[_ci].id = 'cal_' + now + '_' + _ci;
  }
  localStorage.setItem(getCalendarKey(), JSON.stringify(calendar)); // v12.0.1: Mode-specific
  stampLocalSave();
  writeDBCalendar(); // v25.1: Write-through replaces scheduleAutoSync
  // v16.12: Rebuild merged calendar after native save
  rebuildMergedCalendar();
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULED PROMPTS
// ═══════════════════════════════════════════════════════════════

var scheduledPrompts = [];
var editingScheduledPromptId = null;

function initScheduledPrompts() {
  var saved = localStorage.getItem('roweosScheduledPrompts');
  if (saved) {
    try {
      scheduledPrompts = JSON.parse(saved);
    } catch(e) {
      scheduledPrompts = [];
    }
  }
}

function saveScheduledPrompts() {
  localStorage.setItem('roweosScheduledPrompts', JSON.stringify(scheduledPrompts));
}

function openScheduledPromptsManager() {
  renderScheduledPromptsList();
  document.getElementById('scheduledPromptsModal').classList.add('show');
}

function closeScheduledPromptsManager() {
  document.getElementById('scheduledPromptsModal').classList.remove('show');
}

function renderScheduledPromptsList() {
  var container = document.getElementById('scheduledPromptsList');
  if (!container) return;
  
  if (scheduledPrompts.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No scheduled prompts yet. Click "+ Add Scheduled Prompt" to create one.</div>';
    return;
  }
  
  var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  var html = scheduledPrompts.map(function(sp) {
    var scheduleText = '';
    if (sp.frequency === 'daily') {
      scheduleText = 'Every day';
    } else if (sp.frequency === 'weekly') {
      var days = (sp.days || []).map(function(d) { return dayNames[d]; }).join(', ');
      scheduleText = 'Weekly: ' + (days || 'Not set');
    } else if (sp.frequency === 'biweekly') {
      var days = (sp.days || []).map(function(d) { return dayNames[d]; }).join(', ');
      scheduleText = 'Every 2 weeks: ' + (days || 'Not set');
    } else if (sp.frequency === 'monthly') {
      scheduleText = 'Monthly';
    }
    
    var isDueToday = isScheduledPromptDueToday(sp);
    
    return '<div class="scheduled-prompt-item ' + (isDueToday ? 'due-today' : '') + '">' +
      '<div class="scheduled-prompt-icon">✦</div>' +
      '<div class="scheduled-prompt-info">' +
        '<div class="scheduled-prompt-name">' + escapeHtml(sp.name) + '</div>' +
        '<div class="scheduled-prompt-meta">' +
          '<span>' + escapeHtml(sp.brand) + '</span>' +
          '<span class="scheduled-prompt-schedule">◇ ' + scheduleText + '</span>' +
          '<span>' + escapeHtml(sp.operation || 'Custom') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="scheduled-prompt-actions">' +
        '<button class="activity-btn" onclick="editScheduledPrompt(' + sp.id + ')">Edit</button>' +
        '<button class="activity-btn danger" onclick="deleteScheduledPrompt(' + sp.id + ')">Delete</button>' +
        '<button class="scheduled-prompt-run" onclick="runScheduledPrompt(' + sp.id + ')">Run Now</button>' +
      '</div>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
}

function isScheduledPromptDueToday(sp) {
  var today = new Date().getDay();
  
  if (sp.frequency === 'daily') return true;
  
  if (sp.frequency === 'weekly' || sp.frequency === 'biweekly') {
    return (sp.days || []).indexOf(today) !== -1;
  }
  
  if (sp.frequency === 'monthly') {
    var todayDate = new Date().getDate();
    return todayDate === 1; // First of month
  }
  
  return false;
}

function openAddScheduledPrompt() {
  editingScheduledPromptId = null;
  document.getElementById('editScheduledPromptTitle').textContent = 'Add Scheduled Prompt';
  document.getElementById('scheduledPromptName').value = '';
  document.getElementById('scheduledPromptBrand').value = brands.length > 0 ? brands[0].name : '';
  document.getElementById('scheduledPromptOperation').value = '';
  document.getElementById('scheduledPromptCustom').value = '';
  document.getElementById('scheduledPromptFrequency').value = 'weekly';
  // v15.14: Reset new fields
  document.getElementById('scheduledPromptTime').value = '09:00';
  document.getElementById('scheduledPromptModel').value = '';
  document.getElementById('customPromptField').style.display = 'none';
  document.getElementById('daySelector').style.display = 'block';
  
  // Reset day checkboxes
  document.querySelectorAll('#daySelector input[type="checkbox"]').forEach(function(cb) {
    cb.checked = false;
  });
  
  document.getElementById('editScheduledPromptModal').classList.add('show');
  setTimeout(function() {
    document.getElementById('scheduledPromptName').focus();
  }, 100);
}

function editScheduledPrompt(id) {
  var sp = scheduledPrompts.find(function(s) { return s.id === id; });
  if (!sp) return;
  
  editingScheduledPromptId = id;
  document.getElementById('editScheduledPromptTitle').textContent = 'Edit Scheduled Prompt';
  document.getElementById('scheduledPromptName').value = sp.name || '';
  document.getElementById('scheduledPromptBrand').value = sp.brand || (brands.length > 0 ? brands[0].name : '');
  document.getElementById('scheduledPromptOperation').value = sp.operation || 'custom';
  document.getElementById('scheduledPromptCustom').value = sp.customPrompt || '';
  document.getElementById('scheduledPromptFrequency').value = sp.frequency || 'weekly';
  // v15.14: Restore time and model
  document.getElementById('scheduledPromptTime').value = sp.time || '09:00';
  document.getElementById('scheduledPromptModel').value = sp.model || '';

  toggleCustomPromptField();
  toggleDaySelector();
  
  // Set day checkboxes
  document.querySelectorAll('#daySelector input[type="checkbox"]').forEach(function(cb) {
    cb.checked = (sp.days || []).indexOf(parseInt(cb.value)) !== -1;
  });
  
  document.getElementById('editScheduledPromptModal').classList.add('show');
}

function closeEditScheduledPrompt() {
  document.getElementById('editScheduledPromptModal').classList.remove('show');
  editingScheduledPromptId = null;
}

function toggleCustomPromptField() {
  var op = document.getElementById('scheduledPromptOperation').value;
  document.getElementById('customPromptField').style.display = op === 'custom' ? 'block' : 'none';
}

function toggleDaySelector() {
  var freq = document.getElementById('scheduledPromptFrequency').value;
  document.getElementById('daySelector').style.display = (freq === 'weekly' || freq === 'biweekly') ? 'block' : 'none';
}

function saveScheduledPrompt() {
  var name = document.getElementById('scheduledPromptName').value.trim();
  if (!name) {
    showToast('Please enter a name', 'error');
    return;
  }
  
  var brand = document.getElementById('scheduledPromptBrand').value;
  var operation = document.getElementById('scheduledPromptOperation').value;
  var customPrompt = document.getElementById('scheduledPromptCustom').value.trim();
  var frequency = document.getElementById('scheduledPromptFrequency').value;
  
  var days = [];
  document.querySelectorAll('#daySelector input[type="checkbox"]:checked').forEach(function(cb) {
    days.push(parseInt(cb.value));
  });
  
  if ((frequency === 'weekly' || frequency === 'biweekly') && days.length === 0) {
    showToast('Please select at least one day', 'error');
    return;
  }
  
  // v15.14: Include time and model for auto-execution
  var time = document.getElementById('scheduledPromptTime').value || '09:00';
  var model = document.getElementById('scheduledPromptModel').value || '';

  var sp = {
    id: editingScheduledPromptId || Date.now(),
    name: name,
    brand: brand,
    operation: operation === 'custom' ? null : operation,
    customPrompt: operation === 'custom' ? customPrompt : null,
    frequency: frequency,
    days: days,
    time: time,
    model: model,
    enabled: true,
    lastRun: null
  };
  
  if (editingScheduledPromptId) {
    var idx = scheduledPrompts.findIndex(function(s) { return s.id === editingScheduledPromptId; });
    if (idx !== -1) scheduledPrompts[idx] = sp;
  } else {
    scheduledPrompts.push(sp);
  }
  
  saveScheduledPrompts();
  closeEditScheduledPrompt();
  renderScheduledPromptsList();
  renderFocusScheduledPrompts();
  showToast('Scheduled prompt saved', 'success');
}

function deleteScheduledPrompt(id) {
  if (!confirm('Delete this scheduled prompt?')) return;
  
  scheduledPrompts = scheduledPrompts.filter(function(s) { return s.id !== id; });
  saveScheduledPrompts();
  renderScheduledPromptsList();
  renderFocusScheduledPrompts();
  showToast('Scheduled prompt deleted', 'success');
}

function runScheduledPrompt(id) {
  var sp = scheduledPrompts.find(function(s) { return s.id === id; });
  if (!sp) return;
  
  // Update last run
  sp.lastRun = Date.now();
  saveScheduledPrompts();
  
  // Set the brand
  var brandIdx = brands.findIndex(function(b) { return b.name === sp.brand; });
  if (brandIdx !== -1) {
    document.getElementById('brand').value = brandIdx;
    document.getElementById('studioBrand').value = brandIdx;
    studioSelectedBrand = brandIdx;
  }
  
  // Navigate to Studio and set up the prompt
  showView('studio');
  
  var promptText = sp.customPrompt || 'Create a ' + sp.operation + ' for ' + sp.brand;
  var contextEl = document.getElementById('studioContext');
  if (contextEl) {
    contextEl.value = promptText;
  }
  
  closeScheduledPromptsManager();
  showToast('Prompt loaded to Studio', 'success');
}

function renderFocusScheduledAutomations() {
  var container = document.getElementById('focusScheduledAutomations');
  if (!container) return;
  
  // Get scheduled tasks/automations from Rhythm
  var tasks = [];
  if (typeof getScheduledTasks === 'function') {
    tasks = getScheduledTasks();
  }
  
  // Filter for enabled automations
  var enabledTasks = tasks.filter(function(t) { return t.enabled; });
  
  // Get today's date for comparison
  var today = new Date();
  var todayStr = today.toISOString().split('T')[0];
  var dayOfWeek = today.getDay();
  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Filter automations that are due today or are recurring on this day
  var todayAutomations = enabledTasks.filter(function(task) {
    if (!task.scheduledDate) return false;
    var taskDate = task.scheduledDate.split('T')[0];
    
    // Check if it's scheduled for today
    if (taskDate === todayStr) return true;
    
    // Check recurring tasks
    if (task.frequency && task.frequency !== 'once') {
      if (task.frequency === 'daily') return true;
      if (task.frequency === 'weekly') {
        var taskDay = new Date(task.scheduledDate).getDay();
        return taskDay === dayOfWeek;
      }
      if (task.frequency === 'monthly') {
        var taskDayOfMonth = new Date(task.scheduledDate).getDate();
        return taskDayOfMonth === today.getDate();
      }
    }
    return false;
  });
  
  if (todayAutomations.length === 0 && enabledTasks.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: var(--text-base); padding: var(--space-3); text-align: center;">No scheduled automations. <a href="#" onclick="showView(\'rhythm\'); return false;" style="color: var(--accent);">Create one in Rhythm</a></div>';
    return;
  }
  
  if (todayAutomations.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: var(--text-base); padding: var(--space-3); text-align: center;">No automations scheduled for today. <span style="color: var(--text-secondary);">' + enabledTasks.length + ' active automation' + (enabledTasks.length !== 1 ? 's' : '') + '</span></div>';
    return;
  }
  
  var html = todayAutomations.map(function(task) {
    var timeStr = task.time || '09:00';
    var freqLabel = task.frequency === 'once' ? 'One-time' : 
                    task.frequency === 'daily' ? 'Daily' :
                    task.frequency === 'weekly' ? 'Weekly' :
                    task.frequency === 'monthly' ? 'Monthly' : task.frequency;
    
    return '<div class="focus-scheduled-item" onclick="runScheduledAutomation(' + task.id + ')">' +
      '<div class="focus-scheduled-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>' +
      '<div class="focus-scheduled-info">' +
        '<div class="focus-scheduled-name">' + escapeHtml(task.name) + '</div>' +
        '<div class="focus-scheduled-brand">' + (task.frequency === 'once' || task.frequency === 'none' || !task.frequency ? freqLabel : timeStr + ' • ' + freqLabel) + '</div>' +
      '</div>' +
      '<button class="focus-scheduled-run" onclick="event.stopPropagation(); runScheduledAutomation(' + task.id + ')">Run</button>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
}

// Run a scheduled automation
function runScheduledAutomation(taskId) {
  var tasks = getScheduledTasks();
  var task = tasks.find(function(t) { return t.id === taskId; });
  if (!task) {
    showToast('Automation not found', 'error');
    return;
  }
  
  // Execute the automation action
  if (task.action === 'studio') {
    showView('studio');
    showToast('Opening Studio for: ' + task.name, 'success');
  } else if (task.action === 'brandai') {
    showView('agent');
    showToast('Opening BrandAI for: ' + task.name, 'success');
  } else {
    showToast('Running: ' + task.name, 'success');
  }
}

// Legacy alias for compatibility
function renderFocusScheduledPrompts() {
  renderFocusScheduledAutomations();
}

// Pattern Detection - Analyze runs to suggest recurring prompts
function detectUsagePatterns() {
  if (runs.length < 5) return []; // Need enough data
  
  var dayPatterns = {};
  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Group runs by day of week and operation
  runs.forEach(function(run) {
    if (!run.timestamp) return;
    var d = new Date(run.timestamp);
    var dayOfWeek = d.getDay();
    var key = dayOfWeek + '-' + (run.op || 'unknown');
    
    if (!dayPatterns[key]) {
      dayPatterns[key] = {
        day: dayOfWeek,
        dayName: dayNames[dayOfWeek],
        operation: run.op || 'Unknown',
        brand: run.brand,
        count: 0,
        weeks: new Set()
      };
    }
    
    dayPatterns[key].count++;
    var weekNum = Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000));
    dayPatterns[key].weeks.add(weekNum);
  });
  
  // Find patterns (same operation on same day, multiple weeks)
  var suggestions = [];
  Object.values(dayPatterns).forEach(function(pattern) {
    if (pattern.weeks.size >= 2 && pattern.count >= 3) {
      // Check if already scheduled
      var alreadyScheduled = scheduledPrompts.some(function(sp) {
        return sp.operation === pattern.operation && 
               (sp.days || []).indexOf(pattern.day) !== -1;
      });
      
      if (!alreadyScheduled) {
        suggestions.push({
          dayName: pattern.dayName,
          day: pattern.day,
          operation: pattern.operation,
          brand: pattern.brand,
          occurrences: pattern.count
        });
      }
    }
  });
  
  return suggestions.slice(0, 3); // Max 3 suggestions
}

function renderSuggestedRecurring() {
  var suggestions = detectUsagePatterns();
  var card = document.getElementById('suggestedRecurringCard');
  var container = document.getElementById('focusSuggestedRecurring');
  
  if (!card || !container) return;
  
  if (suggestions.length === 0) {
    card.style.display = 'none';
    return;
  }
  
  card.style.display = 'block';
  
  var html = suggestions.map(function(sug) {
    return '<div class="suggested-recurring-item">' +
      '<div class="suggested-recurring-icon">◆</div>' +
      '<div class="suggested-recurring-info">' +
        '<div class="suggested-recurring-pattern">You often run "' + escapeHtml(sug.operation) + '" on ' + sug.dayName + 's</div>' +
        '<div class="suggested-recurring-detail">' + sug.occurrences + ' times • ' + escapeHtml(sug.brand) + '</div>' +
      '</div>' +
      '<button class="suggested-recurring-add" onclick="addSuggestedAsScheduled(\'' + escapeHtml(sug.operation) + '\', ' + sug.day + ', \'' + escapeHtml(sug.brand) + '\')">+ Schedule</button>' +
    '</div>';
  }).join('');
  
  container.innerHTML = html;
}

function addSuggestedAsScheduled(operation, day, brand) {
  var sp = {
    id: Date.now(),
    name: operation + ' (' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day] + ')',
    brand: brand,
    operation: operation,
    customPrompt: null,
    frequency: 'weekly',
    days: [day],
    enabled: true,
    lastRun: null
  };
  
  scheduledPrompts.push(sp);
  saveScheduledPrompts();
  renderFocusScheduledPrompts();
  renderSuggestedRecurring();
  showToast('Added to scheduled prompts', 'success');
}

function dismissSuggestedRecurring() {
  document.getElementById('suggestedRecurringCard').style.display = 'none';
  localStorage.setItem('roweosDismissedSuggestions', Date.now());
}

// ═══════════════════════════════════════════════════════════════
// FOCUS VIEW RENDERING
// ═══════════════════════════════════════════════════════════════

var todoFilterMode = 'all'; // 'all' or 'brand'

function renderFocusView() {
  // v26.1: Render persistent header + existing stats
  updateFocusHeader();
  updateFocusStats();
  updateFocusPersistentStats();

  // Render pill nav
  var pillItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'today', label: 'Today & Upcoming' },
    { id: 'tasks', label: 'Tasks' }
  ];
  var savedPill = 'dashboard';
  try { savedPill = localStorage.getItem('roweos_focus_active_pill') || 'dashboard'; } catch(e) {}

  renderPillNav('focusPillNavContainer', pillItems, savedPill, function(id) {
    showFocusPill(id);
  }, { viewId: 'signal' });

  // Render the active pill's content
  showFocusPill(savedPill);

  // Always render dashboard widgets (they need data populated)
  renderFocusTodoList();
  renderFocusUpNext();
  renderFocusAIRecommendations();
  renderFocusTodayRhythm();
  renderFocusScheduledPrompts();
  renderFocusReminders();
  renderSuggestedRecurring();
  renderFocusRecentActivity();
  populateFocusNativeSelects();
  populateTodoFilterSelects();
}

function updateFocusHeader() {
  var now = new Date();
  var hour = now.getHours();
  var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  
  var greetingEl = document.getElementById('focusGreeting');
  var dateEl = document.getElementById('focusDate');
  var brandBadge = document.getElementById('focusBrandBadge');
  
  if (greetingEl) greetingEl.textContent = greeting;
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  if (brandBadge) brandBadge.textContent = brand.name;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOCUS 2.0 - TODAY'S COMMAND CENTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * v10.5.25: Initialize Focus 2.0 view
 */
/**
 * v11.0.5: Fix Focus mobile layout by applying inline styles directly
 * This bypasses all CSS specificity issues
 */
function fixFocusMobileLayout() {
  var signalView = document.getElementById('signalView');
  if (!signalView) return;
  
  // Fix the main view container
  signalView.style.overflowX = 'hidden';
  signalView.style.width = '100%';
  signalView.style.maxWidth = '100vw';
  signalView.style.boxSizing = 'border-box';
  
  // Fix the panel inside
  var panel = signalView.querySelector('.panel');
  if (panel) {
    panel.style.overflowX = 'hidden';
    panel.style.width = '100%';
    panel.style.maxWidth = '100%';
    panel.style.boxSizing = 'border-box';
    panel.style.paddingLeft = '12px';
    panel.style.paddingRight = '12px';
  }
  
  // Fix the unified grid container
  var grid = signalView.querySelector('.focus-2-unified-grid');
  if (grid) {
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap = '12px';
    grid.style.width = '100%';
    grid.style.maxWidth = '100%';
    grid.style.overflowX = 'hidden';
    grid.style.boxSizing = 'border-box';
  }
  
  // Fix all widget cards
  var cards = signalView.querySelectorAll('.focus-2-widget-card');
  cards.forEach(function(card) {
    card.style.width = '100%';
    card.style.maxWidth = '100%';
    card.style.boxSizing = 'border-box';
    card.style.overflowX = 'hidden';
  });
  
  // Fix the today-calendar merged section
  var todayCalendar = signalView.querySelector('.focus-2-today-calendar-merged');
  if (todayCalendar) {
    todayCalendar.style.flexDirection = 'column';
    todayCalendar.style.width = '100%';
    todayCalendar.style.maxWidth = '100%';
  }
  
  // Fix calendar section
  var calendarSection = signalView.querySelector('.focus-2-calendar-section');
  if (calendarSection) {
    calendarSection.style.width = '100%';
    calendarSection.style.maxWidth = '100%';
  }
  
  // Fix mini calendar
  var miniCalendar = signalView.querySelector('.focus-2-mini-calendar');
  if (miniCalendar) {
    miniCalendar.style.width = '100%';
    miniCalendar.style.maxWidth = '100%';
  }
  
  // Fix breadcrumb
  var breadcrumb = signalView.querySelector('.breadcrumb');
  if (breadcrumb) {
    breadcrumb.style.width = '100%';
    breadcrumb.style.maxWidth = '100%';
    breadcrumb.style.boxSizing = 'border-box';
  }
  
  // Fix day detail content
  var dayDetail = signalView.querySelector('#focus2DayDetailContent');
  if (dayDetail) {
    dayDetail.style.overflowX = 'hidden';
    dayDetail.style.width = '100%';
  }
  
  // Fix stats grid
  var statsGrid = signalView.querySelector('.focus-2-stats-grid');
  if (statsGrid) {
    statsGrid.style.display = 'grid';
    statsGrid.style.gridTemplateColumns = '1fr 1fr';
    statsGrid.style.width = '100%';
    statsGrid.style.maxWidth = '100%';
    statsGrid.style.gap = '8px';
  }
  
  // Fix categories container
  var categoriesContainer = signalView.querySelector('.focus-2-categories-container');
  if (categoriesContainer) {
    categoriesContainer.style.display = 'flex';
    categoriesContainer.style.flexDirection = 'column';
    categoriesContainer.style.width = '100%';
    categoriesContainer.style.maxWidth = '100%';
  }
  
  // Fix category cards
  var categoryCards = signalView.querySelectorAll('.focus-2-category-card');
  categoryCards.forEach(function(card) {
    card.style.width = '100%';
    card.style.maxWidth = '100%';
    card.style.boxSizing = 'border-box';
  });
  
  console.log('[Focus Mobile] Applied mobile layout fixes');
}

function initFocus2() {
  // v11.0.5: Fix mobile layout on init if on mobile
  if (window.innerWidth <= 768) {
    fixFocusMobileLayout();
  }
  
  // v13.4: Restore expanded category from localStorage
  try {
    var savedExpanded = localStorage.getItem('roweos_focus2_expanded_category');
    if (savedExpanded) focus2ExpandedCategory = savedExpanded;
  } catch(e) {}

  // v10.5.25: Restore saved widget order and sizes first
  restoreFocus2WidgetOrder();
  restoreFocus2WidgetSizes();
  restoreCalendarOrientation();
  
  // v10.5.25: Set today as the selected date (use local date, not UTC)
  var now = new Date();
  var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  window.focus2SelectedDate = today;
  
  updateFocus2Date();
  renderFocus2MiniCalendar();
  renderFocus2Categories();
  updateFocus2Stats();
  renderFocus2Automations();
  loadFocus2Notes();
  
  // v10.5.25: Restore unified order (widgets + categories mixed) after categories render
  setTimeout(function() {
    restoreFocus2UnifiedOrder();
  }, 100);
  
  // v10.5.25: Init day detail with today's data
  showFocus2DayDetail(today);
  
  // v13.2: AI assistant removed, multi-select toolbar added
  
  // v10.5.25: Initialize drag-and-drop for ALL widget cards
  initFocus2WidgetDragDrop();

  // v13.1/v25.0: Always expand all categories on mobile - never show collapsed
  if (window.innerWidth <= 768) {
    setTimeout(function() {
      var allCards = document.querySelectorAll('.focus-2-category-card');
      allCards.forEach(function(card) {
        card.classList.add('expanded');
      });
      if (allCards.length > 0) {
        focus2ExpandedCategory = '_all_expanded';
      }
      // Also expand all collapsible focus cards
      var collapsibles = document.querySelectorAll('#signalView .focus-card-collapsible');
      collapsibles.forEach(function(card) {
        card.classList.remove('collapsed');
      });
    }, 200);
  }

  // v10.5.25: Customize mode controlled via CSS - no initialization needed
  // Click "Customize" button to toggle body.focus2-customize-mode class
}

/**
 * v10.5.25: Restore saved widget order from localStorage
 */
function restoreFocus2WidgetOrder() {
  var container = document.getElementById('focus2Container');
  if (!container) return;
  
  var savedOrder = [];
  try { savedOrder = JSON.parse(localStorage.getItem('roweos_focus2_widget_order') || '[]'); } catch(e) { return; }
  if (savedOrder.length === 0) return;
  
  // Get all widget cards
  var widgets = Array.from(container.querySelectorAll('.focus-2-widget-card[data-widget]'));
  if (widgets.length === 0) return;
  
  // Create a map of widget id to element
  var widgetMap = {};
  widgets.forEach(function(w) {
    var id = w.getAttribute('data-widget');
    if (id) widgetMap[id] = w;
  });
  
  // Find the tasks controls element (insertion point for categories)
  var tasksControls = container.querySelector('.focus-2-tasks-controls');
  
  // Reorder widgets based on saved order
  savedOrder.forEach(function(id) {
    var widget = widgetMap[id];
    if (widget && tasksControls) {
      // Insert before tasks controls
      container.insertBefore(widget, tasksControls);
    }
  });
}

// v13.2: updateFocus2AIAssistant() and sendFocus2AIMessage() removed -- assistant widget replaced by multi-select toolbar

/**
 * v10.5.25: Populate category dropdown
 */
function populateFocus2Categories() {
  var select = document.getElementById('focus2TaskCategory');
  if (!select) return;
  
  var categories = window.todoCategories || [];
  var html = '<option value="">Category</option>';
  
  categories.forEach(function(cat) {
    html += '<option value="' + escapeHtml(cat.name) + '">' + escapeHtml(cat.name) + '</option>';
  });
  
  select.innerHTML = html;
}

/**
 * v10.5.25: Update Focus 2.0 date display
 */
function updateFocus2Date() {
  var now = new Date();
  var dayNum = document.getElementById('focus2DayNumber');
  var month = document.getElementById('focus2Month');
  var weekday = document.getElementById('focus2Weekday');
  var year = document.getElementById('focus2Year');
  
  if (dayNum) dayNum.textContent = now.getDate();
  if (month) month.textContent = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  if (weekday) weekday.textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
  if (year) year.textContent = now.getFullYear();
  
  // Update breadcrumb label based on mode
  var breadcrumb = document.getElementById('focusBreadcrumbLabel');
  var isLife = getCurrentMode() === 'life';
  if (breadcrumb) breadcrumb.textContent = 'Focus';
  
  // Update AI badge
  var aiBadge = document.getElementById('focus2AIBadge');
  if (aiBadge) aiBadge.textContent = isLife ? 'LifeAI Suggests' : 'BrandAI Suggests';
}

/**
 * v10.5.25: Render mini calendar with dots
 */
function renderFocus2MiniCalendar() {
  var container = document.getElementById('focus2MiniCalendar');
  if (!container) return;
  
  var now = new Date();
  var firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  var startDay = firstOfMonth.getDay();
  
  // v10.5.25: Use local date (not UTC) for today
  var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  
  // v10.5.25: Default selected date to today - don't show old selections
  var selectedDate = window.focus2SelectedDate;
  if (!selectedDate || selectedDate < todayStr.substring(0, 7)) {
    // If no selection or selection from previous month, reset to today
    selectedDate = todayStr;
    window.focus2SelectedDate = todayStr;
  }
  
  // Day headers
  var days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  var html = '';
  days.forEach(function(d) {
    html += '<div class="focus-2-mini-calendar-header">' + d + '</div>';
  });
  
  // Adjust for Monday start
  var adjustedStartDay = startDay === 0 ? 6 : startDay - 1;
  
  // Empty cells before first day
  for (var i = 0; i < adjustedStartDay; i++) {
    html += '<div class="focus-2-mini-dot" style="visibility: hidden;"></div>';
  }
  
  // Days of month
  for (var d = 1; d <= lastOfMonth.getDate(); d++) {
    var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var isToday = dateStr === todayStr;
    var isSelected = dateStr === selectedDate && !isToday; // Only show selected style if NOT today
    var hasTasks = todos.some(function(t) { return t.date === dateStr; }) ||
                   calendar.some(function(e) { return e.date === dateStr; });
    
    var classes = 'focus-2-mini-dot';
    if (isToday) classes += ' is-today';
    if (isSelected) classes += ' is-selected';
    if (hasTasks) classes += ' has-tasks';
    if (hasTasks && d < now.getDate()) classes += ' light';
    
    // v10.5.25: Click shows day detail card and updates selection
    html += '<div class="' + classes + '" onclick="selectFocus2Date(\'' + dateStr + '\')">' + d + '</div>';
  }
  
  container.innerHTML = html;
}

/**
 * v10.5.25: Select a date and update day detail
 */
function selectFocus2Date(dateStr) {
  window.focus2SelectedDate = dateStr;
  showFocus2DayDetail(dateStr);
  renderFocus2MiniCalendar(); // Re-render to show selection
}

// v10.5.25: Track current day filter mode
var focus2DayFilter = 'today'; // v12.2.6: Default to today view
var focus2DaySort = 'date'; // v13.9: Sort preference for day detail

/**
 * v10.5.25: Show day detail card
 */
function showFocus2DayDetail(dateStr) {
  var container = document.getElementById('focus2DayDetail');
  var content = document.getElementById('focus2DayDetailContent');
  var title = document.getElementById('focus2DayDetailTitle');
  var dateLabel = document.getElementById('focus2DayDetailDate');
  
  if (!container || !content) return;
  
  // Parse date
  var date = new Date(dateStr + 'T12:00:00');
  // v10.5.25: Use local date for isToday check
  var now = new Date();
  var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  var isToday = dateStr === todayStr;
  
  // Update header
  if (title) title.textContent = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' });
  if (dateLabel) dateLabel.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  // Store selected date
  window.focus2SelectedDate = dateStr;
  
  // Render content
  renderFocus2DayDetailContent(dateStr);
  
  // Show card
  container.style.display = 'block';
}

/**
 * v10.5.25: Render day detail content
 */
function renderFocus2DayDetailContent(dateStr) {
  var content = document.getElementById('focus2DayDetailContent');
  if (!content) return;

  // v11.0.5: Prevent layout shift by maintaining height during rebuild
  var contentHeight = content.offsetHeight;
  if (contentHeight > 0) {
    content.style.minHeight = contentHeight + 'px';
  }

  var todayStr = new Date().toISOString().slice(0, 10);
  var isUpcoming = dateStr === '__upcoming__';
  var titleEl = document.getElementById('focus2DayDetailTitle');
  var dateEl = document.getElementById('focus2DayDetailDate');

  // v12.2.6: Today/Upcoming filter logic
  var dayTasks, dayEvents, dayAutomations;

  if (isUpcoming) {
    // Upcoming: show all pending tasks without a date, or with a future date
    if (titleEl) titleEl.textContent = 'Upcoming';
    if (dateEl) dateEl.textContent = 'Tasks to work on';
    dayTasks = todos.filter(function(t) {
      if (t.completed) return false;
      return !t.date || t.date === '' || t.date > todayStr;
    });
    // v13.9: Apply user-selected sort
    if (focus2DaySort === 'title') {
      dayTasks.sort(function(a, b) { return (a.text || '').localeCompare(b.text || ''); });
    } else if (focus2DaySort === 'brand') {
      dayTasks.sort(function(a, b) { return (a.brand || '').localeCompare(b.brand || ''); });
    } else if (focus2DaySort === 'category') {
      dayTasks.sort(function(a, b) { return (a.category || '').localeCompare(b.category || ''); });
    } else {
      // Default: tasks with dates first (nearest), then undated
      dayTasks.sort(function(a, b) {
        if (a.date && !b.date) return -1;
        if (!a.date && b.date) return 1;
        if (a.date && b.date) return a.date < b.date ? -1 : 1;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    }
    dayEvents = [];
    dayAutomations = [];
  } else {
    // Today or specific date view
    if (dateStr === todayStr) {
      if (titleEl) titleEl.textContent = 'Today';
    } else {
      var d = new Date(dateStr + 'T12:00:00');
      if (titleEl) titleEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long' });
    }
    var displayDate = new Date(dateStr + 'T12:00:00');
    if (dateEl) dateEl.textContent = displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    dayTasks = todos.filter(function(t) {
      return t.date === dateStr;
    });

    dayEvents = calendar.filter(function(e) {
      return e.date === dateStr;
    });

    var scheduledTasks = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
    dayAutomations = scheduledTasks.filter(function(a) {
      return a.scheduledDate && a.scheduledDate.slice(0, 10) === dateStr && a.enabled;
    });
  }

  var html = '';

  // Tasks section
  if (dayTasks.length > 0) {
    html += '<div class="focus-2-day-detail-section">';
    html += '<div class="focus-2-day-detail-section-title"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg> TASKS (' + dayTasks.length + ')</div>';
    dayTasks.forEach(function(task) {
      var completedClass = task.completed ? 'completed' : '';
      html += '<div class="focus-2-day-detail-item ' + completedClass + '">';
      html += '<div class="focus-2-day-detail-item-check ' + (task.completed ? 'checked' : '') + '" onclick="event.stopPropagation(); toggleDayDetailTask(' + task.id + ')">';
      html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/>' + (task.completed ? '<path d="M9 12l2 2 4-4"/>' : '') + '</svg>';
      html += '</div>';
      html += '<div class="focus-2-day-detail-item-text" onclick="openFocus2TaskDetail(' + task.id + ')">';
      html += '<div class="focus-2-day-detail-item-name">' + escapeHtml(task.text) + '</div>';
      var meta = [];
      if (task.category) meta.push(task.category);
      if (task.brand) meta.push(task.brand === '_life' ? 'Life' : task.brand);
      // v12.2.6: Show date for upcoming tasks
      if (isUpcoming && task.date) {
        var taskDate = new Date(task.date + 'T12:00:00');
        meta.push(taskDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      } else if (isUpcoming && !task.date) {
        meta.push('No date');
      }
      if (meta.length > 0) html += '<div class="focus-2-day-detail-item-meta">' + escapeHtml(meta.join(' \u2022 ')) + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  // Events section
  if (dayEvents.length > 0) {
    html += '<div class="focus-2-day-detail-section">';
    html += '<div class="focus-2-day-detail-section-title"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg> Events (' + dayEvents.length + ')</div>';
    dayEvents.forEach(function(event) {
      html += '<div class="focus-2-day-detail-item">';
      html += '<div class="focus-2-day-detail-item-icon event"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/></svg></div>';
      html += '<div class="focus-2-day-detail-item-text">';
      html += '<div class="focus-2-day-detail-item-name">' + escapeHtml(event.title) + '</div>';
      if (event.brand) html += '<div class="focus-2-day-detail-item-meta">' + escapeHtml(event.brand) + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  // Automations section
  if (dayAutomations.length > 0) {
    html += '<div class="focus-2-day-detail-section">';
    html += '<div class="focus-2-day-detail-section-title"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Automations (' + dayAutomations.length + ')</div>';
    dayAutomations.forEach(function(auto) {
      html += '<div class="focus-2-day-detail-item">';
      html += '<div class="focus-2-day-detail-item-icon auto"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>';
      html += '<div class="focus-2-day-detail-item-text">';
      html += '<div class="focus-2-day-detail-item-name">' + escapeHtml(auto.name) + '</div>';
      html += '<div class="focus-2-day-detail-item-meta">' + (auto.time || '9:00 AM') + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  // Empty state
  if (dayTasks.length === 0 && dayEvents.length === 0 && dayAutomations.length === 0) {
    html = '<div class="focus-2-day-detail-empty">' + (isUpcoming ? 'No upcoming tasks' : 'Nothing scheduled for this day') + '</div>';
  }

  content.innerHTML = html;

  // v11.0.5: Reset minHeight after content is set
  setTimeout(function() {
    content.style.minHeight = '';
  }, 100);
}

/**
 * v10.5.25: Toggle task completion from day detail view
 */
function toggleDayDetailTask(taskId) {
  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task) return;

  task.completed = !task.completed;
  if (task.completed) {
    task.completedAt = new Date().toISOString();
    // v13.4: Prompt to add to Pulse
    promptAddToPulse(task);
  }
  saveTodos();

  // v13.4: Use requestAnimationFrame to batch DOM updates and prevent glitch
  // Preserve current tab (Today vs Upcoming) instead of resetting to Today
  requestAnimationFrame(function() {
    // Re-render the day detail content based on active filter
    if (focus2DayFilter === 'upcoming') {
      renderFocus2DayDetailContent('__upcoming__');
    } else if (window.focus2SelectedDate) {
      renderFocus2DayDetailContent(window.focus2SelectedDate);
    }

    // Also update other views if visible
    if (typeof renderFocus2Categories === 'function') renderFocus2Categories();
    if (typeof updateFocus2Stats === 'function') updateFocus2Stats();
  });
}

/**
 * v10.5.25: Close day detail card
 */
function closeFocus2DayDetail() {
  var container = document.getElementById('focus2DayDetail');
  if (container) container.style.display = 'none';
}

/**
 * v10.5.25: Set day detail filter
 */
function setFocus2DayFilter(filter) {
  // v12.2.6: Changed from all/brand/life to today/upcoming
  focus2DayFilter = filter;

  // Update button states
  document.querySelectorAll('.focus-2-mode-filter-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });

  var activeBtn = document.getElementById('focus2Filter' + filter.charAt(0).toUpperCase() + filter.slice(1));
  if (activeBtn) activeBtn.classList.add('active');

  // Re-render content with new filter
  renderFocus2DayDetailContent(filter === 'today' ? new Date().toISOString().slice(0, 10) : '__upcoming__');
}

/**
 * v13.9: Set day detail sort preference and re-render
 */
function setFocus2DaySort(sortType) {
  focus2DaySort = sortType;
  if (focus2DayFilter === 'upcoming') {
    renderFocus2DayDetailContent('__upcoming__');
  } else if (window.focus2SelectedDate) {
    renderFocus2DayDetailContent(window.focus2SelectedDate);
  }
}

// v10.5.25: Track which category is expanded
var focus2ExpandedCategory = null;
var focus2ShowCompleted = false;

// v13.2: Multi-select state
var focus2MultiSelectMode = false;
var focus2SelectedTaskIds = [];

// v13.4: Per-category task sort preferences
function getCategoryTaskSort(catName) {
  try {
    var prefs = JSON.parse(localStorage.getItem('roweos_focus2_cat_sort') || '{}');
    return prefs[catName] || 'manual';
  } catch(e) { return 'manual'; }
}

function setCategoryTaskSort(catName, sortType) {
  try {
    var prefs = JSON.parse(localStorage.getItem('roweos_focus2_cat_sort') || '{}');
    prefs[catName] = sortType;
    localStorage.setItem('roweos_focus2_cat_sort', JSON.stringify(prefs));
  } catch(e) {}
  renderFocus2Categories();
}

function sortCategoryTasks(tasks, sortType) {
  if (!sortType || sortType === 'manual') return tasks;
  var sorted = tasks.slice();
  if (sortType === 'date') {
    sorted.sort(function(a, b) {
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      if (a.date && b.date) return a.date < b.date ? -1 : 1;
      return 0;
    });
  } else if (sortType === 'priority') {
    sorted.sort(function(a, b) {
      return (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
    });
  } else if (sortType === 'alpha') {
    sorted.sort(function(a, b) {
      return (a.text || '').localeCompare(b.text || '');
    });
  }
  return sorted;
}

// Color presets for categories
var focus2CategoryColors = ['gold', 'blue', 'green', 'purple', 'red', 'orange', 'pink', 'cyan'];

// Category icons SVG paths
// v10.5.25: Comprehensive icon library for category customization
var focus2CategoryIconLibrary = {
  // General
  'default': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>',
  'checkbox': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>',
  'star': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
  'heart': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
  'flag': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  'target': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  'zap': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>',
  
  // Work & Productivity
  'briefcase': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>',
  'folder': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  'inbox': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 16,12 14,15 10,15 8,12 2,12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>',
  'clipboard': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  'edit': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  'send': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>',
  'calendar': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  'clock': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
  
  // Finance & Shopping
  'dollar': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  'creditcard': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  'shoppingcart': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
  'shoppingbag': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>',
  'gift': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>',
  'bank': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/></svg>',
  
  // Home & Personal
  'home': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>',
  'key': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  'lock': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
  'shield': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  'umbrella': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 12a11.05 11.05 0 00-22 0zm-5 7a3 3 0 01-6 0v-7"/></svg>',
  
  // Health & Wellness
  'activity': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>',
  'thermometer': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>',
  'pill': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 117 7l-7-7"/><path d="M8.5 8.5l7 7"/></svg>',
  'dumbbell': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5h11v11h-11z" transform="rotate(45 12 12)"/><line x1="3" y1="3" x2="7" y2="7"/><line x1="17" y1="17" x2="21" y2="21"/></svg>',
  'moon': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
  'sun': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  
  // Travel & Transport
  'car': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
  'plane': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
  'mappin': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  'compass': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/></svg>',
  
  // Technology
  'laptop': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
  'phone': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  'wifi': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
  'database': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
  'code': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/></svg>',
  'settings': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  
  // Social & People
  'user': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  'users': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  'message': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  'mail': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  'bell': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
  
  // Creative & Media
  'camera': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  'image': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>',
  'film': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>',
  'music': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  'book': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
  'pen': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
  
  // Nature & Animals
  'leaf': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 21C3 17.5 3 12 6.5 8.5c3.5-3.5 10-3.5 14.5 0-4.5 4.5-4.5 11 0 15.5-4.5-4.5-11-4.5-14.5 0z"/><path d="M14 14c-3 3-7.5 3-10 .5"/></svg>',
  'tree': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22v-7"/><path d="M9 22h6"/><path d="M12 15l-4-4 2-2-3-3 7-4 7 4-3 3 2 2-4 4z"/></svg>',
  'flower': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>',
  'pet': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="5" cy="14" r="2"/><circle cx="19" cy="14" r="2"/><path d="M12 22c2.5 0 4.5-2 4.5-4.5 0-2-1.5-3.5-4.5-5.5-3 2-4.5 3.5-4.5 5.5 0 2.5 2 4.5 4.5 4.5z"/></svg>',
  
  // Food & Drink
  'coffee': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
  'utensils': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>',
  'wine': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 22h8"/><path d="M12 11v11"/><path d="M5 3l7 8 7-8"/><path d="M5.61 3.61c1.86 3.23 4.52 5.39 6.39 5.39s4.53-2.16 6.39-5.39"/></svg>',
  'apple': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c1-1 3-1 4.5.5M17 7.5c2 2 2 5.5.5 8.5-1.5 3-4 4-5.5 4s-4-1-5.5-4c-1.5-3-1.5-6.5.5-8.5 2-2 4.5-2 5-2s3 0 5 2z"/></svg>',
  
  // Education & Learning
  'graduation': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10l-10-5L2 10l10 5 10-5z"/><path d="M6 12v5c0 2 3 4 6 4s6-2 6-4v-5"/><path d="M22 10v6"/></svg>',
  'award': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21,13.89 7,23 12,20 17,23 15.79,13.88"/></svg>',
  'lightbulb': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 019 14"/></svg>',
  'brain': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/></svg>'
};

// Legacy mapping for backwards compatibility
var focus2CategoryIcons = focus2CategoryIconLibrary;

/**
 * v13.9: Debounce timer for renderFocus2Categories to prevent fluttering
 */
var _renderFocus2CategoriesTimer = null;
var _renderFocus2CategoriesReady = false;

/**
 * v10.5.25: Render task categories as fluid cards - COMPLETELY SEPARATE for Brand/Life
 * v13.9: Added debounce to prevent rapid successive renders causing flutter
 */
function renderFocus2Categories() {
  // v13.9: Debounce - skip if called within 50ms of last call
  if (_renderFocus2CategoriesTimer) {
    clearTimeout(_renderFocus2CategoriesTimer);
  }
  _renderFocus2CategoriesTimer = setTimeout(function() {
    _renderFocus2CategoriesTimer = null;
    _renderFocus2CategoriesActual();
  }, 50);
}

function _renderFocus2CategoriesActual() {
  var container = document.getElementById('focus2CategoriesGrid');
  var mainContainer = document.getElementById('focus2Container');
  if (!container) return;
  
  // v11.0.5: Prevent layout shift by maintaining container height during rebuild
  var containerHeight = container.offsetHeight;
  if (containerHeight > 0) {
    container.style.minHeight = containerHeight + 'px';
  }
  
  // v10.5.25: CRITICAL - Remove ALL existing category cards from ENTIRE container
  // This prevents duplicates when restoreFocus2UnifiedOrder moves cards around
  if (mainContainer) {
    var existingCards = mainContainer.querySelectorAll('.focus-2-category-card');
    existingCards.forEach(function(card) {
      card.remove();
    });
  }
  
  var isLife = getCurrentMode() === 'life';
  var brandIdx = parseInt(document.getElementById('brand')?.value || '0');
  var brand = window.brands && window.brands[brandIdx] ? window.brands[brandIdx].name : '';
  var allCategories = window.todoCategories || [];
  
  // v10.5.25: Filter categories by mode - LifeAI only sees Life categories, BrandAI only sees Brand categories
  var categories = allCategories.filter(function(cat) {
    if (isLife) {
      return cat.isLife === true;
    } else {
      return cat.isLife !== true;
    }
  });

  // v12.2.4: Apply sorting if enabled
  if (getCategorySortPreference() === 'alphabetical') {
    categories = categories.slice().sort(function(a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });
  } else if (focus2CategoryOrder && focus2CategoryOrder.length > 0) {
    // v16.0: Apply saved category order when not alphabetical
    var catOrderMap = {};
    focus2CategoryOrder.forEach(function(name, idx) { catOrderMap[name] = idx; });
    categories = categories.slice().sort(function(a, b) {
      var aIdx = catOrderMap[a.name] !== undefined ? catOrderMap[a.name] : 999;
      var bIdx = catOrderMap[b.name] !== undefined ? catOrderMap[b.name] : 999;
      return aIdx - bIdx;
    });
  }
  
  // v10.5.25: Fixed filtering - BrandAI gets all regular tasks, LifeAI only gets _life tagged
  // BrandAI mode: Tasks for current brand OR unassigned tasks (typical workflow)
  // LifeAI mode: Only tasks explicitly tagged as life tasks
  var allTasks = todos.filter(function(t) {
    if (isLife) {
      // LifeAI: Only tasks explicitly marked as personal/life
      return t.isLife === true || t.brand === '_life';
    } else {
      // BrandAI: Tasks for current brand OR unassigned (no brand)
      return !t.brand || t.brand === brand || t.brand === '';
    }
  });
  
  // Group tasks by category
  var tasksByCategory = {};
  var uncategorized = [];
  
  allTasks.forEach(function(task) {
    if (task.category) {
      if (!tasksByCategory[task.category]) tasksByCategory[task.category] = [];
      tasksByCategory[task.category].push(task);
    } else {
      uncategorized.push(task);
    }
  });
  
  var html = '';
  
  // v13.9: Add fade-in animation class, remove after transition completes
  container.classList.remove('focus-2-categories-animating');
  requestAnimationFrame(function() {
    container.classList.add('focus-2-categories-animating');
  });
  
  // Render ALL categories in BrandAI, show empty state if no tasks
  categories.forEach(function(cat, idx) {
    var catTasks = tasksByCategory[cat.name] || [];
    var pendingTasks = catTasks.filter(function(t) { return !t.completed; });
    var completedTasks = catTasks.filter(function(t) { return t.completed; });
    var totalTasks = pendingTasks.length + (focus2ShowCompleted ? completedTasks.length : 0);
    
    // v10.5.25: Show ALL categories (even empty ones) so users can add tasks to them
    // Previously skipped empty categories which made them invisible
    
    var colorPreset = cat.colorPreset || focus2CategoryColors[idx % focus2CategoryColors.length];
    var customHex = cat.customHex || null;
    var isExpanded = focus2ExpandedCategory === cat.name;
    // v10.5.25: Use category's stored icon, fallback to library by name, then default
    var iconKey = cat.icon || cat.name || 'default';
    var iconSvg = focus2CategoryIconLibrary[iconKey] || focus2CategoryIconLibrary['default'];

    // v12.2.4: Support custom hex colors via inline style
    var colorStyle = customHex ? ' style="--cat-color: ' + customHex + ';"' : '';
    html += '<div class="focus-2-category-card' + (isExpanded ? ' expanded' : '') + '" data-color="' + colorPreset + '" data-category="' + escapeHtml(cat.name) + '"' + colorStyle + ' onclick="toggleFocus2CategoryExpand(\'' + escapeHtml(cat.name) + '\', event)">';
    
    // v10.5.25: Drag handle for mobile
    html += '<div class="focus-2-widget-drag-handle" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" opacity="0.5"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></div>';
    
    // Icon
    html += '<div class="focus-2-category-icon">' + iconSvg + '</div>';
    
    // Header with edit/delete buttons
    html += '<div class="focus-2-category-header">';
    html += '<div class="focus-2-category-title">' + escapeHtml(cat.name) + ' <span class="focus-2-category-count">' + pendingTasks.length + '</span></div>';
    html += '<div class="focus-2-category-actions" onclick="event.stopPropagation()">';
    // v13.2: Multi-select button
    html += '<button class="focus-2-category-action-btn" onclick="toggleFocus2MultiSelect(\'' + escapeHtml(cat.name) + '\')" title="Select tasks"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></button>';
    html += '<button class="focus-2-category-action-btn" onclick="editCategory(\'' + escapeHtml(cat.name) + '\')" title="Edit category"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>';
    html += '<button class="focus-2-category-action-btn delete" onclick="deleteCategory(\'' + escapeHtml(cat.name) + '\')" title="Delete category"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
    html += '</div>';
    html += '</div>';
    
    // Description
    html += '<div class="focus-2-category-desc">' + (cat.description || 'Tasks in this category') + '</div>';
    
    // Task pills (preview - max 6)
    html += '<div class="focus-2-category-tasks">';
    var previewTasks = pendingTasks.slice(0, 6);
    previewTasks.forEach(function(task) {
      html += '<div class="focus-2-task-pill" onclick="event.stopPropagation(); openFocus2TaskDetail(' + task.id + ')">';
      html += '<span class="focus-2-task-pill-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg></span>';
      html += escapeHtml(task.text.length > 20 ? task.text.substring(0, 20) + '...' : task.text);
      html += '</div>';
    });
    if (pendingTasks.length > 6) {
      html += '<div class="focus-2-task-more">More <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>';
    }
    html += '</div>';
    
    // Expanded content
    html += '<div class="focus-2-category-expanded">';
    
    // Add task input
    html += '<div class="focus-2-category-add">';
    html += '<textarea class="focus-2-category-add-input" id="focus2AddInput_' + idx + '" placeholder="Add a task..." rows="1" onclick="event.stopPropagation()" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();event.stopPropagation();addTaskToCategory(\'' + escapeHtml(cat.name) + '\', ' + idx + ');}" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';"></textarea>';
    html += '<button class="focus-2-category-add-btn" onclick="event.stopPropagation(); addTaskToCategory(\'' + escapeHtml(cat.name) + '\', ' + idx + ')">Add</button>';
    html += '</div>';

    // v13.4: Per-category sort dropdown
    var catSortPref = getCategoryTaskSort(cat.name);
    html += '<div class="focus-2-category-sort" onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">';
    html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.5;"><path d="M3 6h18M6 12h12M9 18h6"/></svg>';
    html += '<select onchange="setCategoryTaskSort(\'' + escapeHtml(cat.name) + '\', this.value)" style="background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:2px 6px;font-size:11px;cursor:pointer;">';
    html += '<option value="manual"' + (catSortPref === 'manual' ? ' selected' : '') + '>Manual</option>';
    html += '<option value="date"' + (catSortPref === 'date' ? ' selected' : '') + '>Date</option>';
    html += '<option value="priority"' + (catSortPref === 'priority' ? ' selected' : '') + '>Priority</option>';
    html += '<option value="alpha"' + (catSortPref === 'alpha' ? ' selected' : '') + '>A-Z</option>';
    html += '</select></div>';

    // v13.4: Apply per-category sort to pending tasks
    var sortedPending = sortCategoryTasks(pendingTasks, catSortPref);

    // v13.9: Limit rendered tasks to prevent DOM bloat; show "show more" if truncated
    var maxPending = 100;
    var maxCompleted = 50;
    // Full task list (pending)
    html += '<div class="focus-2-category-task-list">';
    var pendingToRender = sortedPending.slice(0, maxPending);
    pendingToRender.forEach(function(task) {
      html += renderFocus2CategoryTaskItem(task);
    });
    if (sortedPending.length > maxPending) {
      html += '<div style="padding:8px 12px;font-size:12px;color:var(--text-muted);text-align:center;">+ ' + (sortedPending.length - maxPending) + ' more tasks</div>';
    }
    html += '</div>';

    // Completed toggle
    if (completedTasks.length > 0) {
      var showThisCompleted = focus2ShowCompleted;
      html += '<div class="focus-2-completed-toggle' + (showThisCompleted ? ' open' : '') + '" onclick="event.stopPropagation(); toggleFocus2CompletedSection(\'' + escapeHtml(cat.name) + '\')">';
      html += icon('chevronDown', {size: 14});
      html += completedTasks.length + ' completed';
      html += '</div>';
      html += '<div class="focus-2-completed-list"' + (showThisCompleted ? ' style="display:block;"' : '') + '>';
      var completedToRender = completedTasks.slice(0, maxCompleted);
      completedToRender.forEach(function(task) {
        html += renderFocus2CategoryTaskItem(task);
      });
      if (completedTasks.length > maxCompleted) {
        html += '<div style="padding:8px 12px;font-size:12px;color:var(--text-muted);text-align:center;">+ ' + (completedTasks.length - maxCompleted) + ' more completed</div>';
      }
      html += '</div>';
    }

    // v13.9: Removed per-category Create Automation button (moved to Automations Lab)

    html += '</div>'; // expanded
    html += '</div>'; // card
  });
  
  // Uncategorized card (if any)
  if (uncategorized.length > 0) {
    var pendingUncategorized = uncategorized.filter(function(t) { return !t.completed; });
    var completedUncategorized = uncategorized.filter(function(t) { return t.completed; });
    var isExpanded = focus2ExpandedCategory === '_uncategorized';
    
    html += '<div class="focus-2-category-card uncategorized' + (isExpanded ? ' expanded' : '') + '" data-color="gold" data-category="_uncategorized" onclick="toggleFocus2CategoryExpand(\'_uncategorized\', event)">';
    
    // v10.5.25: Drag handle for mobile
    html += '<div class="focus-2-widget-drag-handle" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" opacity="0.5"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></div>';
    
    html += '<div class="focus-2-category-header">';
    html += '<div class="focus-2-category-title">Uncategorized <span class="focus-2-category-count">' + pendingUncategorized.length + '</span></div>';
    html += '</div>';
    html += '<div class="focus-2-category-desc">Tasks without a specific category</div>';
    
    // Task pills
    html += '<div class="focus-2-category-tasks">';
    var previewTasks = pendingUncategorized.slice(0, 8);
    previewTasks.forEach(function(task) {
      html += '<div class="focus-2-task-pill" onclick="event.stopPropagation(); openFocus2TaskDetail(' + task.id + ')">';
      html += '<span class="focus-2-task-pill-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg></span>';
      html += escapeHtml(task.text.length > 25 ? task.text.substring(0, 25) + '...' : task.text);
      html += '</div>';
    });
    if (pendingUncategorized.length > 8) {
      html += '<div class="focus-2-task-more">More <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>';
    }
    html += '</div>';
    
    // Expanded content
    html += '<div class="focus-2-category-expanded">';
    html += '<div class="focus-2-category-add">';
    html += '<textarea class="focus-2-category-add-input" id="focus2AddInput_uncategorized" placeholder="Add a task..." rows="1" onclick="event.stopPropagation()" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();event.stopPropagation();addTaskToCategory(\'\', \'uncategorized\');}" oninput="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\';"></textarea>';
    html += '<button class="focus-2-category-add-btn" onclick="event.stopPropagation(); addTaskToCategory(\'\', \'uncategorized\')">Add</button>';
    html += '</div>';
    html += '<div class="focus-2-category-task-list">';
    pendingUncategorized.forEach(function(task) {
      html += renderFocus2CategoryTaskItem(task);
    });
    html += '</div>';
    
    if (completedUncategorized.length > 0) {
      html += '<div class="focus-2-completed-toggle' + (focus2ShowCompleted ? ' open' : '') + '" onclick="event.stopPropagation(); toggleFocus2CompletedSection(\'_uncategorized\')">';
      html += icon('chevronDown', {size: 14});
      html += completedUncategorized.length + ' completed';
      html += '</div>';
      html += '<div class="focus-2-completed-list"' + (focus2ShowCompleted ? ' style="display:block;"' : '') + '>';
      completedUncategorized.forEach(function(task) {
        html += renderFocus2CategoryTaskItem(task);
      });
      html += '</div>';
    }
    
    html += '</div>'; // expanded
    html += '</div>'; // card
  }
  
  // Empty state
  if (categories.length === 0 && uncategorized.length === 0) {
    html = '<div class="focus-2-empty" style="grid-column: 1 / -1; padding: 40px;"><div class="focus-2-empty-icon"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg></div><div class="focus-2-empty-text">No tasks yet. Create a category or add your first task!</div></div>';
  }
  
  container.innerHTML = html;
  
  // v11.0.5: Reset minHeight after content is set to allow natural sizing
  setTimeout(function() {
    container.style.minHeight = '';
  }, 100);
  
  // v10.5.25: Initialize drag-and-drop and restore unified order after render
  setTimeout(function() {
    initFocus2DragDrop();
    // Restore unified order if categories were moved among widgets
    restoreFocus2UnifiedOrder();
    // v15.18: Initialize task drag-and-drop between categories
    initFocus2TaskDragDrop();
  }, 50);
}

/**
 * v10.5.25: Initialize drag-and-drop for ALL widget cards
 */
// v13.9: Protected module-level JSON.parse to prevent script crash on corrupted data
var focus2WidgetOrder = [];
var focus2CategoryOrder = [];
try { focus2WidgetOrder = JSON.parse(localStorage.getItem('roweos_focus2_widget_order') || '[]'); } catch(e) { console.warn('[Focus] Corrupted widget order data, resetting'); }
try { focus2CategoryOrder = JSON.parse(localStorage.getItem('roweos_focus2_category_order') || '[]'); } catch(e) { console.warn('[Focus] Corrupted category order data, resetting'); }

function initFocus2WidgetDragDrop() {
  var container = document.getElementById('focus2Container');
  if (!container) return;
  
  // Handle ALL draggable cards (widgets + categories) in the same container
  var allCards = container.querySelectorAll('.focus-2-widget-card, .focus-2-category-card');
  allCards.forEach(function(card) {
    setupDragEvents(card, container);
  });
}

// v10.5.25: Touch drag state
var touchDragState = {
  isDragging: false,
  draggedEl: null,
  startY: 0,
  startX: 0,
  clone: null,
  placeholder: null,
  scrollInterval: null
};

function setupDragEvents(card, container) {
  // Skip if already has listeners
  if (card.dataset.dragInit) return;
  card.dataset.dragInit = 'true';

  // v13.4: Only enable dragging in Customize mode
  var isCustomize = document.body.classList.contains('focus2-customize-mode');
  card.setAttribute('draggable', isCustomize ? 'true' : 'false');

  // Desktop drag events
  card.addEventListener('dragstart', function(e) {
    // v13.4: Block drag outside Customize mode
    if (!document.body.classList.contains('focus2-customize-mode')) {
      e.preventDefault();
      return;
    }
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.getAttribute('data-widget') || card.getAttribute('data-category') || '');
  });
  
  card.addEventListener('dragend', function(e) {
    card.classList.remove('dragging');
    container.querySelectorAll('.drag-over').forEach(function(c) {
      c.classList.remove('drag-over');
    });
  });
  
  card.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    var dragging = container.querySelector('.dragging');
    if (dragging && dragging !== card && !card.classList.contains('focus-2-tasks-controls')) {
      // v10.5.25: In customize mode, allow any card to be dropped on any card
      var isCustomizeMode = document.body.classList.contains('focus2-customize-mode');
      if (isCustomizeMode) {
        card.classList.add('drag-over');
      } else {
        // Normal mode: Only show drag-over for same type (category<->category, widget<->widget)
        var isDraggedCategory = dragging.classList.contains('focus-2-category-card');
        var isTargetCategory = card.classList.contains('focus-2-category-card');
        var isDraggedWidget = dragging.classList.contains('focus-2-widget-card');
        var isTargetWidget = card.classList.contains('focus-2-widget-card');
        
        if ((isDraggedCategory && isTargetCategory) || (isDraggedWidget && isTargetWidget)) {
          card.classList.add('drag-over');
        }
      }
    }
  });
  
  card.addEventListener('dragleave', function(e) {
    card.classList.remove('drag-over');
  });
  
  card.addEventListener('drop', function(e) {
    e.preventDefault();
    card.classList.remove('drag-over');
    
    var dragging = container.querySelector('.dragging');
    if (!dragging || dragging === card) return;
    
    // v10.5.25: Get the dragged element type
    var isDraggedCategory = dragging.classList.contains('focus-2-category-card');
    var isTargetCategory = card.classList.contains('focus-2-category-card');
    var isDraggedWidget = dragging.classList.contains('focus-2-widget-card');
    var isTargetWidget = card.classList.contains('focus-2-widget-card');
    
    // v10.5.25: In customize mode, allow free mixing of widgets and categories
    var isCustomizeMode = document.body.classList.contains('focus2-customize-mode');
    
    if (isCustomizeMode) {
      // v10.5.25: Free placement - move dragged card to container (not categories grid)
      // If dragging a category, move it out of categories grid into main container
      var allCards = Array.from(container.querySelectorAll('.focus-2-widget-card, .focus-2-category-card'));
      var draggedIndex = allCards.indexOf(dragging);
      var targetIndex = allCards.indexOf(card);
      
      if (draggedIndex < targetIndex) {
        container.insertBefore(dragging, card.nextSibling);
      } else {
        container.insertBefore(dragging, card);
      }
      // Save unified order
      saveFocus2UnifiedOrder();
    } else {
      // Normal mode: categories stay in categories grid
      var categoriesGrid = document.getElementById('focus2CategoriesGrid');
      
      if (isDraggedCategory && isTargetCategory) {
        // Both are categories - reorder within categories grid
        var categoryCards = Array.from(categoriesGrid.querySelectorAll('.focus-2-category-card'));
        var draggedIndex = categoryCards.indexOf(dragging);
        var targetIndex = categoryCards.indexOf(card);

        if (draggedIndex < targetIndex) {
          categoriesGrid.insertBefore(dragging, card.nextSibling);
        } else {
          categoriesGrid.insertBefore(dragging, card);
        }
        // v13.1: Save both category order AND unified order to persist reorder
        saveFocus2CategoryOrder();
        saveFocus2UnifiedOrder();
      } else if (isDraggedWidget && isTargetWidget) {
        // Both are widgets - reorder within main container
        var widgetCards = Array.from(container.querySelectorAll('.focus-2-widget-card'));
        var draggedIndex = widgetCards.indexOf(dragging);
        var targetIndex = widgetCards.indexOf(card);
        
        if (draggedIndex < targetIndex) {
          card.parentNode.insertBefore(dragging, card.nextSibling);
        } else {
          card.parentNode.insertBefore(dragging, card);
        }
        // v13.1: Save both widget order AND unified order to persist reorder
        saveFocus2WidgetOrder();
        saveFocus2UnifiedOrder();
      }
    }
  });
  
  // v10.5.25: Touch events for mobile drag-drop
  card.addEventListener('touchstart', handleTouchDragStart, { passive: false });
  card.addEventListener('touchmove', handleTouchDragMove, { passive: false });
  card.addEventListener('touchend', handleTouchDragEnd, { passive: false });
}

// v10.5.25: Touch drag handlers
function handleTouchDragStart(e) {
  // Only start drag on long press or drag handle
  var target = e.target;
  var card = target.closest('.focus-2-widget-card, .focus-2-category-card');
  if (!card) return;
  
  // Check if touching drag handle
  var isDragHandle = target.closest('.focus-2-widget-drag-handle');
  if (!isDragHandle) return; // Only allow drag from handle on mobile
  
  e.preventDefault();
  
  var touch = e.touches[0];
  touchDragState.isDragging = true;
  touchDragState.draggedEl = card;
  touchDragState.startY = touch.clientY;
  touchDragState.startX = touch.clientX;
  
  // Add dragging class
  card.classList.add('dragging');
  card.style.opacity = '0.6';
  card.style.transform = 'scale(1.02)';
  card.style.zIndex = '1000';
}

function handleTouchDragMove(e) {
  if (!touchDragState.isDragging || !touchDragState.draggedEl) return;
  e.preventDefault();
  
  var touch = e.touches[0];
  var container = document.getElementById('focus2Container');
  if (!container) return;
  
  // Find element under touch point (excluding dragged element)
  touchDragState.draggedEl.style.pointerEvents = 'none';
  var elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
  touchDragState.draggedEl.style.pointerEvents = '';
  
  // Find the card under touch
  var targetCard = elemBelow ? elemBelow.closest('.focus-2-widget-card, .focus-2-category-card') : null;
  
  // Remove all drag-over classes
  container.querySelectorAll('.drag-over').forEach(function(c) {
    c.classList.remove('drag-over');
  });
  
  // v10.5.25: In customize mode, allow any card to be dropped on any card
  var isCustomizeMode = document.body.classList.contains('focus2-customize-mode');
  if (targetCard && targetCard !== touchDragState.draggedEl && !targetCard.classList.contains('focus-2-tasks-controls')) {
    if (isCustomizeMode) {
      targetCard.classList.add('drag-over');
    } else {
      var isDraggedCategory = touchDragState.draggedEl.classList.contains('focus-2-category-card');
      var isTargetCategory = targetCard.classList.contains('focus-2-category-card');
      var isDraggedWidget = touchDragState.draggedEl.classList.contains('focus-2-widget-card');
      var isTargetWidget = targetCard.classList.contains('focus-2-widget-card');
      
      if ((isDraggedCategory && isTargetCategory) || (isDraggedWidget && isTargetWidget)) {
        targetCard.classList.add('drag-over');
      }
    }
  }
  
  // Auto-scroll if near edges
  var panel = container.closest('.panel');
  if (panel) {
    var rect = panel.getBoundingClientRect();
    var scrollSpeed = 10;
    
    if (touch.clientY < rect.top + 60) {
      panel.scrollTop -= scrollSpeed;
    } else if (touch.clientY > rect.bottom - 100) {
      panel.scrollTop += scrollSpeed;
    }
  }
}

function handleTouchDragEnd(e) {
  if (!touchDragState.isDragging || !touchDragState.draggedEl) return;
  
  var container = document.getElementById('focus2Container');
  var draggedCard = touchDragState.draggedEl;
  
  // Reset styles
  draggedCard.classList.remove('dragging');
  draggedCard.style.opacity = '';
  draggedCard.style.transform = '';
  draggedCard.style.zIndex = '';
  
  // Find target (has drag-over class)
  var targetCard = container ? container.querySelector('.drag-over') : null;
  
  if (targetCard && targetCard !== draggedCard) {
    // v10.5.25: Check if customize mode is on
    var isCustomizeMode = document.body.classList.contains('focus2-customize-mode');
    var isDraggedCategory = draggedCard.classList.contains('focus-2-category-card');
    var isTargetCategory = targetCard.classList.contains('focus-2-category-card');
    var isDraggedWidget = draggedCard.classList.contains('focus-2-widget-card');
    var isTargetWidget = targetCard.classList.contains('focus-2-widget-card');
    
    if (isCustomizeMode) {
      // v10.5.25: Free placement - move dragged card anywhere
      var allCards = Array.from(container.querySelectorAll('.focus-2-widget-card, .focus-2-category-card'));
      var draggedIndex = allCards.indexOf(draggedCard);
      var targetIndex = allCards.indexOf(targetCard);
      
      if (draggedIndex < targetIndex) {
        container.insertBefore(draggedCard, targetCard.nextSibling);
      } else {
        container.insertBefore(draggedCard, targetCard);
      }
      saveFocus2UnifiedOrder();
    } else {
      var categoriesGrid = document.getElementById('focus2CategoriesGrid');
      
      if (isDraggedCategory && isTargetCategory && categoriesGrid) {
        // Both are categories - reorder within categories grid
        var categoryCards = Array.from(categoriesGrid.querySelectorAll('.focus-2-category-card'));
        var draggedIndex = categoryCards.indexOf(draggedCard);
        var targetIndex = categoryCards.indexOf(targetCard);
        
        if (draggedIndex < targetIndex) {
          categoriesGrid.insertBefore(draggedCard, targetCard.nextSibling);
        } else {
          categoriesGrid.insertBefore(draggedCard, targetCard);
        }
        saveFocus2CategoryOrder();
      } else if (isDraggedWidget && isTargetWidget) {
        // Both are widgets - reorder within main container
        var widgetCards = Array.from(container.querySelectorAll('.focus-2-widget-card'));
        var draggedIndex = widgetCards.indexOf(draggedCard);
        var targetIndex = widgetCards.indexOf(targetCard);
        
        if (draggedIndex < targetIndex) {
          targetCard.parentNode.insertBefore(draggedCard, targetCard.nextSibling);
        } else {
          targetCard.parentNode.insertBefore(draggedCard, targetCard);
        }
        saveFocus2WidgetOrder();
      }
    }
  }
  
  // Remove all drag-over classes
  if (container) {
    container.querySelectorAll('.drag-over').forEach(function(c) {
      c.classList.remove('drag-over');
    });
  }
  
  // Reset state
  touchDragState.isDragging = false;
  touchDragState.draggedEl = null;
}

/**
 * v10.5.25: Save widget order
 */
function saveFocus2WidgetOrder() {
  var container = document.getElementById('focus2Container');
  if (!container) return;
  
  var widgets = container.querySelectorAll('.focus-2-widget-card');
  var order = [];
  widgets.forEach(function(w) {
    var id = w.getAttribute('data-widget');
    if (id) order.push(id);
  });
  
  focus2WidgetOrder = order;
  localStorage.setItem('roweos_focus2_widget_order', JSON.stringify(order));
  
  // Also save category order
  saveFocus2CategoryOrder();
}

/**
 * v10.5.25: Save category card order
 */
function saveFocus2CategoryOrder() {
  var grid = document.getElementById('focus2CategoriesGrid');
  if (!grid) return;
  
  var cards = grid.querySelectorAll('.focus-2-category-card');
  var order = [];
  cards.forEach(function(card) {
    var cat = card.getAttribute('data-category');
    if (cat) order.push(cat);
  });
  
  focus2CategoryOrder = order;
  localStorage.setItem('roweos_focus2_category_order', JSON.stringify(order));
}

/**
 * v10.5.25: Save unified order of all widgets and categories
 * This is used when categories can be freely placed among widgets
 */
function saveFocus2UnifiedOrder() {
  var container = document.getElementById('focus2Container');
  if (!container) return;
  
  var allCards = container.querySelectorAll('.focus-2-widget-card, .focus-2-category-card');
  var order = [];
  allCards.forEach(function(card) {
    var widgetId = card.getAttribute('data-widget');
    var categoryId = card.getAttribute('data-category');
    if (widgetId) {
      order.push({ type: 'widget', id: widgetId });
    } else if (categoryId) {
      order.push({ type: 'category', id: categoryId });
    }
  });
  
  localStorage.setItem('roweos_focus2_unified_order', JSON.stringify(order));
  
  // v10.5.25: Sync to Firebase
  if (typeof syncFocus2OrderToFirebase === 'function') {
    syncFocus2OrderToFirebase(order);
  }
}

/**
 * v10.5.25: Sync Focus unified order to Firebase
 */
function syncFocus2OrderToFirebase(order) {
  if (!window.firebaseInitialized || !window.firebaseDB) return;
  
  var user = window.firebase && window.firebase.auth().currentUser;
  if (!user) return;
  
  try {
    var ref = window.firebaseDB.ref('users/' + user.uid + '/focus2UnifiedOrder');
    ref.set(order);
  } catch (err) {
    console.warn('Failed to sync Focus order to Firebase:', err);
  }
}

/**
 * v10.5.25: Restore unified order from localStorage or Firebase
 */
function restoreFocus2UnifiedOrder() {
  var container = document.getElementById('focus2Container');
  if (!container) return;

  var savedOrder = JSON.parse(localStorage.getItem('roweos_focus2_unified_order') || '[]');
  if (savedOrder.length === 0) {
    // v18.4: On mobile with no saved order, move Tasks/categories to top
    if (window.innerWidth <= 768) {
      var taskControls = container.querySelector('.focus-2-tasks-controls');
      var categories = container.querySelectorAll('.focus-2-category-card');
      if (taskControls && container.firstChild !== taskControls) {
        // Move categories first, then task controls before them
        categories.forEach(function(cat) { container.insertBefore(cat, container.firstChild); });
        container.insertBefore(taskControls, container.firstChild);
      }
    }
    return;
  }
  
  // Create maps of elements - look in both container AND categoriesGrid
  var widgetMap = {};
  var categoryMap = {};
  var categoriesGrid = document.getElementById('focus2CategoriesGrid');
  
  container.querySelectorAll('.focus-2-widget-card').forEach(function(w) {
    var id = w.getAttribute('data-widget');
    if (id) widgetMap[id] = w;
  });
  
  // v10.5.25: Categories could be in categoriesGrid OR directly in container
  var allCategories = container.querySelectorAll('.focus-2-category-card');
  allCategories.forEach(function(c) {
    var id = c.getAttribute('data-category');
    if (id) categoryMap[id] = c;
  });
  
  // Find the modals (new category, task detail) to insert before them
  var newCategoryModal = container.querySelector('.focus-2-new-category-modal');
  
  // Reorder based on saved order - move ALL cards to container (not categoriesGrid)
  savedOrder.forEach(function(item) {
    var element = null;
    if (item.type === 'widget' && widgetMap[item.id]) {
      element = widgetMap[item.id];
    } else if (item.type === 'category' && categoryMap[item.id]) {
      element = categoryMap[item.id];
    }
    
    if (element) {
      if (newCategoryModal) {
        container.insertBefore(element, newCategoryModal);
      } else {
        container.appendChild(element);
      }
    }
  });
  
  // v10.5.25: Re-init drag events after moving elements
  setTimeout(initFocus2DragDrop, 10);
}

/**
 * v10.5.25: Update drag handle visibility - now handled via CSS class on body
 * This function is kept for legacy compatibility but may not be needed
 */
function updateDragHandleVisibility(visible) {
  // Now handled via body.focus2-customize-mode class in CSS
  // This function is kept for any legacy calls
}

/**
 * v10.5.25: Unified Customize toggle (works on desktop and mobile)
 * - On desktop: shows resize controls
 * - On mobile: shows resize controls AND drag handles
 */
function toggleFocus2Customize() {
  var isActive = document.body.classList.toggle('focus2-customize-mode');
  
  // Also toggle the desktop resize mode class for CSS compatibility
  if (isActive) {
    document.body.classList.add('focus2-resize-mode');
  } else {
    document.body.classList.remove('focus2-resize-mode');
  }
  
  // v10.5.25: Update text color - gold when active, grey when not
  var btn = document.getElementById('focus2CustomizeBtn');
  if (btn) {
    btn.style.color = isActive ? 'var(--accent)' : 'var(--text-muted)';
    btn.style.fontWeight = isActive ? '600' : '400';
  }
  
  // v13.4: Update draggable attribute on all cards when toggling customize mode
  document.querySelectorAll('[data-drag-init]').forEach(function(card) {
    card.setAttribute('draggable', isActive ? 'true' : 'false');
  });

  showToast(isActive ? 'Customize mode ON' : 'Customize mode OFF', 'info');
}

/**
 * v10.5.25: Legacy - kept for compatibility
 */
function toggleFocus2DragHandles() {
  toggleFocus2Customize();
}

/**
 * v10.5.25: Legacy - kept for compatibility  
 */
function toggleFocus2ResizeMode() {
  toggleFocus2Customize();
}

/**
 * v10.5.25: Cycle widget size
 * Desktop: half width / full width
 * Mobile: compact (short) / expanded (tall)
 */
function cycleFocus2WidgetSize(card) {
  if (!card) return;
  
  var currentSize = card.getAttribute('data-size') || 'wide';
  var newSize = currentSize === 'wide' ? 'full' : 'wide';
  
  // Remove old size classes
  card.classList.remove('focus-2-widget-compact', 'focus-2-widget-wide', 'focus-2-widget-full');
  
  // Add new size class
  if (newSize === 'wide') {
    card.classList.add('focus-2-widget-wide');
  } else if (newSize === 'full') {
    card.classList.add('focus-2-widget-full');
  }
  
  // Update data attribute
  card.setAttribute('data-size', newSize);
  
  // Save sizes
  saveFocus2WidgetSizes();
  
  // v10.5.25: Mobile-aware feedback
  var isMobile = window.innerWidth <= 600;
  var label = '';
  if (isMobile) {
    label = newSize === 'wide' ? 'Compact' : 'Expanded';
  } else {
    label = newSize === 'wide' ? 'Half width' : 'Full width';
  }
  showToast(label, 'info');
}

/**
 * v10.5.25: Toggle calendar widget orientation (horizontal/vertical)
 */
function toggleCalendarOrientation() {
  var calendarCard = document.querySelector('.focus-2-widget-card[data-widget="today-calendar"]');
  if (!calendarCard) return;
  
  var currentOrientation = calendarCard.getAttribute('data-orientation') || 'horizontal';
  var newOrientation = currentOrientation === 'horizontal' ? 'vertical' : 'horizontal';
  
  calendarCard.setAttribute('data-orientation', newOrientation);
  
  // Save preference
  localStorage.setItem('roweos_focus2_calendar_orientation', newOrientation);
  
  // Update toggle button icon
  var toggleBtn = calendarCard.querySelector('.focus-2-widget-resize-btn');
  if (toggleBtn) {
    toggleBtn.innerHTML = newOrientation === 'horizontal'
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 3H3v7h18V3zM21 14H3v7h18v-7z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h7v18H3V3zM14 3h7v18h-7V3z"/></svg>';
  }
  
  showToast('Calendar: ' + (newOrientation === 'horizontal' ? 'Horizontal' : 'Vertical'), 'info');
}

/**
 * v10.5.25: Restore calendar orientation from localStorage
 */
function restoreCalendarOrientation() {
  var savedOrientation = localStorage.getItem('roweos_focus2_calendar_orientation');
  if (!savedOrientation) return;
  
  var calendarCard = document.querySelector('.focus-2-widget-card[data-widget="today-calendar"]');
  if (!calendarCard) return;
  
  calendarCard.setAttribute('data-orientation', savedOrientation);
  
  // Update toggle button icon
  var toggleBtn = calendarCard.querySelector('.focus-2-widget-resize-btn');
  if (toggleBtn) {
    toggleBtn.innerHTML = savedOrientation === 'horizontal'
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 3H3v7h18V3zM21 14H3v7h18v-7z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h7v18H3V3zM14 3h7v18h-7V3z"/></svg>';
  }
}

/**
 * v10.5.25: Save widget sizes to localStorage
 */
function saveFocus2WidgetSizes() {
  var container = document.getElementById('focus2Container');
  if (!container) return;
  
  var widgets = container.querySelectorAll('.focus-2-widget-card[data-widget]');
  var sizes = {};
  
  widgets.forEach(function(w) {
    var id = w.getAttribute('data-widget');
    var size = w.getAttribute('data-size') || 'default';
    if (id) sizes[id] = size;
  });
  
  localStorage.setItem('roweos_focus2_widget_sizes', JSON.stringify(sizes));
}

/**
 * v10.5.25: Restore widget sizes from localStorage
 */
function restoreFocus2WidgetSizes() {
  var savedSizes = JSON.parse(localStorage.getItem('roweos_focus2_widget_sizes') || '{}');
  
  var container = document.getElementById('focus2Container');
  if (!container) return;
  
  var widgets = container.querySelectorAll('.focus-2-widget-card[data-widget]');
  
  widgets.forEach(function(w) {
    var id = w.getAttribute('data-widget');
    // Use saved size if available, otherwise use data-size attribute default
    var size = savedSizes[id] || w.getAttribute('data-size') || 'wide';
    
    // Remove all size classes
    w.classList.remove('focus-2-widget-compact', 'focus-2-widget-wide', 'focus-2-widget-full');
    
    // Add appropriate class
    if (size === 'wide') {
      w.classList.add('focus-2-widget-wide');
    } else if (size === 'full') {
      w.classList.add('focus-2-widget-full');
    }
    
    w.setAttribute('data-size', size);
  });
}

// Backward compatibility
function initFocus2DragDrop() {
  initFocus2WidgetDragDrop();
}

/**
 * v10.5.25: Render single task item in expanded category - click opens detail
 * v12.2.4: Added priority styling and recurrence badge
 */
function renderFocus2CategoryTaskItem(task) {
  var completed = task.completed ? 'completed' : '';
  var priority = task.priority ? ' priority' : '';
  var checkIcon = task.completed ? icon('check', {size: 12, strokeWidth: 3}) : '';

  // v13.2: Multi-select mode shows selection checkboxes (no draggable)
  if (focus2MultiSelectMode) {
    var isSelected = focus2SelectedTaskIds.indexOf(task.id) !== -1;
    var html = '<div class="focus-2-category-task-item ' + completed + priority + (isSelected ? ' multi-selected' : '') + '" data-task-id="' + task.id + '" onclick="event.stopPropagation();toggleFocus2TaskSelect(' + task.id + ')">';
    html += '<div class="focus-2-multiselect-check ' + (isSelected ? 'checked' : '') + '">' + (isSelected ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : '') + '</div>';
    html += '<div class="focus-2-category-task-text">' + escapeHtml(task.text) + '</div>';
    html += '</div>';
    return html;
  }

  // v15.18: Drag handle SVG (grip dots)
  var dragHandle = '<div class="focus-2-task-drag-handle"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg></div>';

  // v10.5.25: Fixed - parent onclick checks if click was on checkbox
  var html = '<div class="focus-2-category-task-item ' + completed + priority + '" data-task-id="' + task.id + '" draggable="true" onclick="if(!event.target.closest(\'.focus-2-category-task-check\')&&!event.target.closest(\'.focus-2-task-drag-handle\')){openFocus2TaskDetail(' + task.id + ');}">';
  html += dragHandle;
  html += '<div class="focus-2-category-task-check ' + (task.completed ? 'checked' : '') + '" onclick="quickToggleFocus2Task(' + task.id + ', event)">' + checkIcon + '</div>';
  html += '<div class="focus-2-category-task-text">' + escapeHtml(task.text);
  // v18.7: Note badge — subtle indicator for tasks with notes
  if (task.notes && task.notes.trim()) {
    html += '<span title="Has notes" style="display:inline-block;vertical-align:middle;margin-left:4px;opacity:0.5;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>';
  }
  // v12.2.4: Recurrence badge
  if (task.recurrence && task.recurrence.type && task.recurrence.type !== 'none') {
    var recLabel = task.recurrence.type === 'daily' ? 'Daily' :
                   task.recurrence.type === 'weekly' ? 'Weekly' :
                   task.recurrence.type === 'monthly' ? 'Monthly' : 'Repeats';
    html += '<span class="focus-2-task-recurrence-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>' + recLabel + '</span>';
  }
  html += '</div>';
  if (task.date) {
    var d = new Date(task.date + 'T12:00:00');
    html += '<div class="focus-2-category-task-date">' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</div>';
  }
  html += '</div>';

  return html;
}

// ═══════════════════════════════════════════════════════════════
// v15.18: TASK DRAG-AND-DROP BETWEEN CATEGORIES
// ═══════════════════════════════════════════════════════════════

/**
 * v15.18: Initialize drag-and-drop for individual tasks between category cards
 */
function initFocus2TaskDragDrop() {
  // Skip in multi-select or customize mode
  if (focus2MultiSelectMode) return;
  if (document.body.classList.contains('focus2-customize-mode')) return;

  var taskItems = document.querySelectorAll('.focus-2-category-task-item[data-task-id][draggable="true"]');
  taskItems.forEach(function(item) {
    item.addEventListener('dragstart', function(e) {
      // Only allow drag from the handle or the item itself, not child interactive elements
      var taskId = item.getAttribute('data-task-id');
      e.dataTransfer.setData('text/task-id', taskId);
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('task-dragging');
    });

    item.addEventListener('dragend', function(e) {
      item.classList.remove('task-dragging');
      // Clean up all drop target highlights
      var targets = document.querySelectorAll('.focus-2-category-card.task-drop-target');
      targets.forEach(function(t) { t.classList.remove('task-drop-target'); });
    });
  });

  // Attach drop zone events to all category cards
  var categoryCards = document.querySelectorAll('.focus-2-category-card[data-category]');
  categoryCards.forEach(function(card) {
    card.addEventListener('dragover', function(e) {
      // Only respond to task drags (not widget/category reorder drags)
      if (!e.dataTransfer.types || e.dataTransfer.types.indexOf('text/task-id') === -1) return;
      // Skip if in customize mode
      if (document.body.classList.contains('focus2-customize-mode')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('task-drop-target');
    });

    card.addEventListener('dragleave', function(e) {
      // Only remove highlight if we actually left the card (not entering a child)
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('task-drop-target');
      }
    });

    card.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('task-drop-target');
      var taskId = e.dataTransfer.getData('text/task-id');
      if (!taskId) return;
      var newCategory = card.getAttribute('data-category');
      // _uncategorized maps to empty string
      if (newCategory === '_uncategorized') newCategory = '';
      moveFocus2TaskToCategory(taskId, newCategory);
    });
  });
}

/**
 * v15.18: Move a task to a different category and re-render
 */
function moveFocus2TaskToCategory(taskId, newCategory) {
  var task = todos.find(function(t) { return t.id === parseInt(taskId); });
  if (!task) return;
  if ((task.category || '') === newCategory) return;
  task.category = newCategory;
  saveTodos();
  renderFocus2Categories();
  var catLabel = newCategory || 'Uncategorized';
  showToast('Moved to ' + catLabel, 'success');
}

// ═══════════════════════════════════════════════════════════════
// v13.2: MULTI-SELECT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * v13.2: Toggle multi-select mode for a category
 */
function toggleFocus2MultiSelect(categoryName) {
  focus2MultiSelectMode = !focus2MultiSelectMode;
  focus2SelectedTaskIds = [];
  if (focus2MultiSelectMode && categoryName) {
    focus2ExpandedCategory = categoryName;
  }
  var toolbar = document.getElementById('focus2MultiSelectToolbar');
  if (toolbar) toolbar.style.display = focus2MultiSelectMode ? 'flex' : 'none';
  updateFocus2SelectCount();
  renderFocus2Categories();
}

/**
 * v13.2: Toggle individual task selection
 */
function toggleFocus2TaskSelect(taskId) {
  var idx = focus2SelectedTaskIds.indexOf(taskId);
  if (idx === -1) {
    focus2SelectedTaskIds.push(taskId);
  } else {
    focus2SelectedTaskIds.splice(idx, 1);
  }
  updateFocus2SelectCount();
  // v13.9: Update pulse banner count if in Add to Pulse mode
  var pulseCount = document.getElementById('focus2PulseCount');
  if (pulseCount) pulseCount.textContent = focus2SelectedTaskIds.length + ' selected';
  // v13.9: Don't re-render full categories (which collapses them) - just toggle the checkbox
  var taskEls = document.querySelectorAll('.focus-2-category-task-item');
  taskEls.forEach(function(el) {
    var check = el.querySelector('.focus-2-multiselect-check');
    if (!check) return;
    var elTaskId = parseInt(el.getAttribute('onclick') && el.getAttribute('onclick').match(/\d+/) ? el.getAttribute('onclick').match(/\d+/)[0] : '0');
  });
  renderFocus2Categories();
}

/**
 * v13.2: Update selection count display
 */
function updateFocus2SelectCount() {
  var el = document.getElementById('focus2SelectCount');
  if (el) el.textContent = focus2SelectedTaskIds.length + ' selected';
}

/**
 * v13.2: Add selected tasks to Pulse as a new goal
 */
function addSelectedTasksToPulse() {
  if (focus2SelectedTaskIds.length === 0) {
    showToast('No tasks selected', 'warning');
    return;
  }
  var selectedTasks = todos.filter(function(t) {
    return focus2SelectedTaskIds.indexOf(t.id) !== -1;
  });
  if (selectedTasks.length === 0) return;

  var isLifeMode = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  var newGoal = {
    id: 'goal_' + Date.now(),
    title: 'Tasks from Focus',
    items: selectedTasks.map(function(t, i) {
      return {
        id: 'item_' + Date.now() + '_' + i,
        text: t.text,
        completed: !!t.completed,
        completedAt: t.completedAt || null
      };
    }),
    createdAt: new Date().toISOString(),
    source: isLifeMode ? 'lifeai' : 'brandai'
  };
  pulseGoals.unshift(newGoal);
  savePulseGoals();
  exitFocus2MultiSelect();
  showToast('Added ' + selectedTasks.length + ' tasks to Pulse goal', 'success');
}

/**
 * v13.2: Complete all selected tasks
 */
function completeSelectedTasks() {
  if (focus2SelectedTaskIds.length === 0) {
    showToast('No tasks selected', 'warning');
    return;
  }
  var count = 0;
  var nowStr = new Date().toISOString();
  todos.forEach(function(t) {
    if (focus2SelectedTaskIds.indexOf(t.id) !== -1 && !t.completed) {
      t.completed = true;
      t.completedAt = nowStr;
      count++;
    }
  });
  saveTodos();
  exitFocus2MultiSelect();
  showToast('Completed ' + count + ' tasks', 'success');
}

/**
 * v13.2: Delete all selected tasks
 */
function deleteSelectedTasks() {
  if (focus2SelectedTaskIds.length === 0) {
    showToast('No tasks selected', 'warning');
    return;
  }
  var count = focus2SelectedTaskIds.length;
  todos = todos.filter(function(t) {
    return focus2SelectedTaskIds.indexOf(t.id) === -1;
  });
  saveTodos();
  exitFocus2MultiSelect();
  showToast('Deleted ' + count + ' tasks', 'success');
}

/**
 * v13.2: Exit multi-select mode
 */
function exitFocus2MultiSelect() {
  focus2MultiSelectMode = false;
  focus2SelectedTaskIds = [];
  var toolbar = document.getElementById('focus2MultiSelectToolbar');
  if (toolbar) toolbar.style.display = 'none';
  renderFocus2Categories();
  updateFocus2Stats();
}

/**
 * v13.9: Start "Add to Pulse" mode - expands all categories, enters multi-select,
 * shows notification banner at top
 */
function startAddToPulseMode() {
  // Enter multi-select mode for all categories
  focus2MultiSelectMode = true;
  focus2SelectedTaskIds = [];
  window.focus2AddToPulseMode = true;

  // Show persistent banner
  var existing = document.getElementById('focus2PulseBanner');
  if (existing) existing.remove();
  var banner = document.createElement('div');
  banner.id = 'focus2PulseBanner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10001;display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 20px;background:linear-gradient(135deg,rgba(212,175,55,0.95),rgba(180,140,20,0.95));backdrop-filter:blur(20px);color:#fff;font-size:14px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
  banner.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>' +
    '<span>Select tasks to add to Pulse</span>' +
    '<span id="focus2PulseCount" style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:12px;font-size:12px;">0 selected</span>' +
    '<button onclick="showPulseGoalPicker()" style="background:#fff;color:#333;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">Add to Goal</button>' +
    '<button onclick="cancelAddToPulseMode()" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.4);border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;">Cancel</button>';
  document.body.appendChild(banner);

  // Expand all categories to show tasks
  var cats = document.querySelectorAll('.focus-2-category-card:not(.expanded)');
  cats.forEach(function(card) {
    card.classList.add('expanded');
  });

  renderFocus2Categories();
  showToast('Select tasks, then click "Add to Goal"', 'info');
}

/**
 * v13.9: Cancel add to pulse mode
 */
function cancelAddToPulseMode() {
  window.focus2AddToPulseMode = false;
  focus2MultiSelectMode = false;
  focus2SelectedTaskIds = [];
  var banner = document.getElementById('focus2PulseBanner');
  if (banner) banner.remove();
  var toolbar = document.getElementById('focus2MultiSelectToolbar');
  if (toolbar) toolbar.style.display = 'none';
  renderFocus2Categories();
}

/**
 * v13.9: Show goal picker popup - existing goals or create new
 */
function showPulseGoalPicker() {
  if (focus2SelectedTaskIds.length === 0) {
    showToast('Select at least one task first', 'warning');
    return;
  }

  var isLifeMode = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  var accentColor = isLifeMode ? 'var(--life-accent, #22c55e)' : 'var(--accent, #a89878)';
  var activeGoals = (pulseGoals || []).filter(function(g) {
    return !g.completed && !g.archived;
  });

  var overlay = document.createElement('div');
  overlay.id = 'pulseGoalPickerOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10002;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);';

  var goalListHtml = '';
  if (activeGoals.length > 0) {
    goalListHtml = '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Existing Goals</div>';
    activeGoals.forEach(function(g) {
      var itemCount = (g.items || []).length;
      goalListHtml += '<button onclick="addTasksToExistingGoal(\'' + g.id + '\')" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 14px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;cursor:pointer;margin-bottom:6px;text-align:left;transition:border-color 0.15s;">' +
        '<span style="font-weight:500;">' + escapeHtml(g.title) + '</span>' +
        '<span style="font-size:11px;color:var(--text-muted);">' + itemCount + ' items</span>' +
      '</button>';
    });
    goalListHtml += '<div style="border-top:1px solid var(--border-color);margin:12px 0;"></div>';
  }

  overlay.innerHTML = '<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-2xl);padding:24px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<div style="font-size:18px;font-weight:700;color:var(--text-primary);">Add to Pulse Goal</div>' +
      '<button onclick="document.getElementById(\'pulseGoalPickerOverlay\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;padding:4px;">x</button>' +
    '</div>' +
    '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">' + focus2SelectedTaskIds.length + ' task' + (focus2SelectedTaskIds.length !== 1 ? 's' : '') + ' selected</div>' +
    goalListHtml +
    '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Create New Goal</div>' +
    '<input type="text" id="pulseNewGoalTitle" placeholder="Goal title..." style="width:100%;padding:12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;margin-bottom:10px;box-sizing:border-box;">' +
    '<button onclick="createNewGoalFromTasks()" style="width:100%;padding:12px;background:' + accentColor + ';color:#fff;border:none;border-radius:var(--radius-lg);font-size:14px;font-weight:600;cursor:pointer;">Create Goal</button>' +
  '</div>';
  document.body.appendChild(overlay);
}

/**
 * v13.9: Add selected tasks to an existing Pulse goal
 */
function addTasksToExistingGoal(goalId) {
  var goal = pulseGoals.find(function(g) { return g.id === goalId; });
  if (!goal) return;
  var selectedTasks = todos.filter(function(t) {
    return focus2SelectedTaskIds.indexOf(t.id) !== -1;
  });
  selectedTasks.forEach(function(t, i) {
    goal.items.push({
      id: 'item_' + Date.now() + '_' + i,
      text: t.text,
      completed: !!t.completed,
      completedAt: t.completedAt || null
    });
  });
  savePulseGoals();
  var overlay = document.getElementById('pulseGoalPickerOverlay');
  if (overlay) overlay.remove();
  cancelAddToPulseMode();
  showToast('Added ' + selectedTasks.length + ' tasks to "' + goal.title + '"', 'success');
}

/**
 * v13.9: Create a new Pulse goal from selected tasks
 */
function createNewGoalFromTasks() {
  var titleInput = document.getElementById('pulseNewGoalTitle');
  var title = titleInput ? titleInput.value.trim() : '';
  if (!title) {
    showToast('Enter a goal title', 'warning');
    return;
  }
  var selectedTasks = todos.filter(function(t) {
    return focus2SelectedTaskIds.indexOf(t.id) !== -1;
  });
  if (selectedTasks.length === 0) return;
  var isLifeMode = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  var newGoal = {
    id: 'goal_' + Date.now(),
    title: title,
    items: selectedTasks.map(function(t, i) {
      return {
        id: 'item_' + Date.now() + '_' + i,
        text: t.text,
        completed: !!t.completed,
        completedAt: t.completedAt || null
      };
    }),
    createdAt: new Date().toISOString(),
    source: isLifeMode ? 'lifeai' : 'brandai'
  };
  pulseGoals.unshift(newGoal);
  savePulseGoals();
  var overlay = document.getElementById('pulseGoalPickerOverlay');
  if (overlay) overlay.remove();
  cancelAddToPulseMode();
  showToast('Created Pulse goal: "' + title + '" with ' + selectedTasks.length + ' tasks', 'success');
}

/**
 * v13.9: Show "Add to Pulse" toast after completing a categorized task
 */
function promptAddToPulse(task) {
  if (!task || !task.category || !task.completed) return;
  var toastEl = document.createElement('div');
  toastEl.className = 'toast-notification';
  toastEl.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-xl);backdrop-filter:blur(20px);position:fixed;bottom:80px;right:20px;z-index:10000;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:slideUp 0.3s ease;';
  toastEl.innerHTML = '<span style="color:var(--text-secondary);font-size:13px;">Add to Pulse goal?</span>' +
    '<button onclick="addCompletedTaskToPulseWithPicker(' + task.id + ');this.parentElement.remove();" style="background:var(--accent);color:white;border:none;border-radius:var(--radius-md);padding:4px 10px;font-size:12px;cursor:pointer;">Yes</button>' +
    '<button onclick="this.parentElement.remove();" style="background:transparent;color:var(--text-muted);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:4px 10px;font-size:12px;cursor:pointer;">No</button>';
  document.body.appendChild(toastEl);
  // v13.9: Increased timeout from 6s to 10s so users have time to interact
  setTimeout(function() { if (toastEl.parentElement) toastEl.remove(); }, 10000);
}

/**
 * v13.9: Add completed task to Pulse via goal picker (single task version)
 */
function addCompletedTaskToPulseWithPicker(taskId) {
  // v13.9: Ensure taskId is numeric to match todos[].id type for indexOf
  focus2SelectedTaskIds = [parseInt(taskId)];
  showPulseGoalPicker();
}

/**
 * v10.5.25: Quick toggle task without opening detail
 * v12.2.4: Create next recurring task when completed
 */
function quickToggleFocus2Task(taskId, event) {
  event.stopPropagation();
  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task) return;

  var wasCompleted = task.completed;
  task.completed = !task.completed;
  if (task.completed) {
    task.completedAt = new Date().toISOString();
    // v12.2.4: Create next occurrence if recurring
    if (task.recurrence && task.recurrence.type && task.recurrence.type !== 'none') {
      createNextRecurringTask(task);
    }
    // v13.4: Prompt to add to Pulse
    promptAddToPulse(task);
  }
  saveTodos();
  renderFocus2Categories();
  updateFocus2Stats();
}

/**
 * v10.5.25: Toggle category expand/collapse
 */
function toggleFocus2CategoryExpand(categoryName, event) {
  // Don't toggle if clicking on task pill or button
  if (event && (event.target.closest('.focus-2-task-pill') || event.target.closest('.focus-2-category-add-btn') || event.target.closest('.focus-2-category-add-input'))) {
    return;
  }
  
  // v11.0.5: Use direct DOM manipulation instead of full re-render to prevent glitch
  var clickedCard = document.querySelector('.focus-2-category-card[data-category="' + categoryName + '"]');
  
  // v13.1: Handle all-expanded state (first mobile load)
  if (focus2ExpandedCategory === '_all_expanded') {
    // Collapse all cards, then expand only the clicked one
    var allCards = document.querySelectorAll('.focus-2-category-card');
    allCards.forEach(function(c) { c.classList.remove('expanded'); });
    focus2ExpandedCategory = categoryName;
    if (clickedCard) clickedCard.classList.add('expanded');
  } else if (focus2ExpandedCategory === categoryName) {
    // Collapse this card
    focus2ExpandedCategory = null;
    if (clickedCard) clickedCard.classList.remove('expanded');
  } else {
    // Collapse previously expanded card (if any)
    if (focus2ExpandedCategory) {
      var prevCard = document.querySelector('.focus-2-category-card[data-category="' + focus2ExpandedCategory + '"]');
      if (prevCard) prevCard.classList.remove('expanded');
    }
    // Expand clicked card
    focus2ExpandedCategory = categoryName;
    if (clickedCard) clickedCard.classList.add('expanded');
  }

  // v13.4: Persist expanded category to localStorage
  try {
    if (focus2ExpandedCategory) {
      localStorage.setItem('roweos_focus2_expanded_category', focus2ExpandedCategory);
    } else {
      localStorage.removeItem('roweos_focus2_expanded_category');
    }
  } catch(e) {}
}

/**
 * v10.5.25: Toggle completed tasks visibility
 */
function toggleFocus2CompletedSection(categoryName) {
  focus2ShowCompleted = !focus2ShowCompleted;
  renderFocus2Categories();
}

/**
 * v10.5.25: Toggle all completed tasks visibility + update eye icon
 */
function toggleFocus2CompletedAll() {
  focus2ShowCompleted = !focus2ShowCompleted;
  
  // Update eye icon (don't hide the button)
  var eyeIcon = document.getElementById('focus2EyeIcon');
  if (eyeIcon) {
    if (focus2ShowCompleted) {
      // Open eye - showing completed tasks
      eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    } else {
      // Eye with line through - hiding completed tasks
      eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    }
  }
  
  renderFocus2Categories();
}

/**
 * v10.5.25: Toggle + New dropdown
 */
function toggleFocus2NewDropdown() {
  var menu = document.getElementById('focus2NewMenu');
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  var menu = document.getElementById('focus2NewMenu');
  var btn = e.target.closest('.focus-2-new-dropdown');
  if (menu && !btn) {
    menu.style.display = 'none';
  }
});

/**
 * v10.5.25: Open New Task modal
 */
function openFocus2NewTask() {
  var menu = document.getElementById('focus2NewMenu');
  if (menu) menu.style.display = 'none';
  
  var modal = document.getElementById('focus2NewTaskModal');
  if (modal) {
    modal.style.display = 'block';
    
    // v10.5.25: Filter categories by current mode
    var isLife = getCurrentMode() === 'life';
    var catSelect = document.getElementById('focus2NewTaskCategory');
    if (catSelect) {
      var cats = window.todoCategories || [];
      // Filter to show only categories matching current mode
      var filteredCats = cats.filter(function(cat) {
        if (isLife) {
          return cat.isLife === true;
        } else {
          return cat.isLife !== true;
        }
      });
      
      catSelect.innerHTML = '<option value="">No Category</option>';
      filteredCats.forEach(function(cat) {
        catSelect.innerHTML += '<option value="' + escapeHtml(cat.name) + '">' + escapeHtml(cat.name) + '</option>';
      });
    }
    
    // Focus on input
    var textInput = document.getElementById('focus2NewTaskText');
    if (textInput) {
      textInput.focus();
      textInput.value = '';
    }
  }
}

function closeFocus2NewTask() {
  var modal = document.getElementById('focus2NewTaskModal');
  if (modal) modal.style.display = 'none';
}

/**
 * v10.5.25: Save new task from modal
 */
function saveFocus2NewTask() {
  var text = document.getElementById('focus2NewTaskText')?.value?.trim();
  if (!text) {
    showToast('Please enter a task', 'warning');
    return;
  }
  
  var category = document.getElementById('focus2NewTaskCategory')?.value || '';
  var date = document.getElementById('focus2NewTaskDate')?.value || ''; // v12.0.1: Default to no date
  var notes = document.getElementById('focus2NewTaskNotes')?.value || '';
  
  var isLife = getCurrentMode() === 'life';
  var brandIdx = parseInt(document.getElementById('brand')?.value || '0');
  var brand = !isLife && window.brands && window.brands[brandIdx] ? window.brands[brandIdx].name : '';
  
  var newTask = {
    id: Date.now(),
    text: text,
    completed: false,
    date: date,
    category: category,
    brand: isLife ? '_life' : brand,
    isLife: isLife,
    notes: notes,
    createdAt: new Date().toISOString()
  };
  
  todos.push(newTask);
  saveTodos();
  closeFocus2NewTask();
  
  // v11.0.5: Use requestAnimationFrame to batch DOM updates and prevent glitch
  requestAnimationFrame(function() {
    renderFocus2Categories();
    updateFocus2Stats();
    renderFocus2MiniCalendar();
  });
  
  showToast('Task created', 'success');
}

/**
 * v10.5.25: Open task detail panel (instead of toggling completion)
 */
var focus2CurrentTaskId = null;

function openFocus2TaskDetail(taskId) {
  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task) return;

  focus2CurrentTaskId = taskId;
  window.currentFocus2TaskId = taskId; // v12.2.4: For priority/recurrence functions
  var modal = document.getElementById('focus2TaskDetailModal');
  if (!modal) return;

  // Populate fields
  document.getElementById('focus2TaskDetailTitle').value = task.text || '';
  document.getElementById('focus2TaskDetailDate').value = task.date || '';
  document.getElementById('focus2TaskDetailNotes').value = task.notes || '';

  // v12.2.4: Priority button state
  var priorityBtn = document.getElementById('focus2TaskDetailPriority');
  if (priorityBtn) {
    priorityBtn.classList.toggle('active', !!task.priority);
  }

  // v12.2.4: Recurrence state
  var recType = (task.recurrence && task.recurrence.type) || 'none';
  document.querySelectorAll('.focus-2-recurrence-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-recurrence') === recType);
  });

  var optionsEl = document.getElementById('focus2RecurrenceOptions');
  var weeklyDays = document.getElementById('focus2RecurrenceWeeklyDays');
  var customEl = document.getElementById('focus2RecurrenceCustom');

  if (optionsEl) optionsEl.classList.toggle('visible', recType !== 'none');
  if (weeklyDays) weeklyDays.style.display = recType === 'weekly' ? 'block' : 'none';
  if (customEl) customEl.style.display = recType === 'custom' ? 'block' : 'none';

  // Set recurrence days if weekly
  if (task.recurrence && task.recurrence.days) {
    document.querySelectorAll('.focus-2-recurrence-day').forEach(function(dayEl) {
      var day = parseInt(dayEl.getAttribute('data-day'));
      dayEl.classList.toggle('selected', task.recurrence.days.indexOf(day) !== -1);
    });
  } else {
    document.querySelectorAll('.focus-2-recurrence-day').forEach(function(dayEl) {
      dayEl.classList.remove('selected');
    });
  }

  // Set custom interval/unit
  if (task.recurrence) {
    var intervalInput = document.getElementById('focus2RecurrenceInterval');
    var unitSelect = document.getElementById('focus2RecurrenceUnit');
    var endDateInput = document.getElementById('focus2RecurrenceEndDate');
    if (intervalInput) intervalInput.value = task.recurrence.interval || 1;
    if (unitSelect) unitSelect.value = task.recurrence.unit || 'days';
    if (endDateInput) endDateInput.value = task.recurrence.endDate || '';
  }

  // Check box
  var checkEl = document.getElementById('focus2TaskDetailCheck');
  if (checkEl) {
    if (task.completed) {
      checkEl.classList.add('completed');
      checkEl.innerHTML = icon('check', {size: 14, color: '#000', strokeWidth: 3});
    } else {
      checkEl.classList.remove('completed');
      checkEl.innerHTML = '';
    }
  }

  // Populate category select
  var catSelect = document.getElementById('focus2TaskDetailCategory');
  if (catSelect) {
    var cats = window.todoCategories || [];
    catSelect.innerHTML = '<option value="">No Category</option>';
    cats.forEach(function(cat) {
      var selected = cat.name === task.category ? ' selected' : '';
      catSelect.innerHTML += '<option value="' + escapeHtml(cat.name) + '"' + selected + '>' + escapeHtml(cat.name) + '</option>';
    });
  }

  // Populate brand select
  var brandSelect = document.getElementById('focus2TaskDetailBrand');
  if (brandSelect) {
    var brands = window.brands || [];
    brandSelect.innerHTML = '<option value="">No Brand</option>';
    brandSelect.innerHTML += '<option value="_life"' + (task.brand === '_life' ? ' selected' : '') + '>Personal (Life)</option>';
    brands.forEach(function(b) {
      var selected = b.name === task.brand ? ' selected' : '';
      brandSelect.innerHTML += '<option value="' + escapeHtml(b.name) + '"' + selected + '>' + escapeHtml(b.name) + '</option>';
    });
  }

  modal.style.display = 'block';

  // v10.5.25: Show backdrop on mobile
  var backdrop = document.getElementById('focus2TaskDetailBackdrop');
  if (backdrop) backdrop.style.display = 'block';
}

function closeFocus2TaskDetail() {
  var modal = document.getElementById('focus2TaskDetailModal');
  if (modal) modal.style.display = 'none';
  
  // v10.5.25: Hide backdrop
  var backdrop = document.getElementById('focus2TaskDetailBackdrop');
  if (backdrop) backdrop.style.display = 'none';
  
  focus2CurrentTaskId = null;
}

function toggleFocus2TaskFromDetail() {
  if (!focus2CurrentTaskId) return;
  var task = todos.find(function(t) { return t.id === focus2CurrentTaskId; });
  if (!task) return;
  
  task.completed = !task.completed;
  if (task.completed) task.completedAt = new Date().toISOString();
  saveTodos();
  
  // Update check UI
  var checkEl = document.getElementById('focus2TaskDetailCheck');
  if (checkEl) {
    if (task.completed) {
      checkEl.classList.add('completed');
      checkEl.innerHTML = icon('check', {size: 14, color: '#000', strokeWidth: 3});
    } else {
      checkEl.classList.remove('completed');
      checkEl.innerHTML = '';
    }
  }
  
  renderFocus2Categories();
  updateFocus2Stats();
}

function updateFocus2TaskTitle() {
  if (!focus2CurrentTaskId) return;
  var task = todos.find(function(t) { return t.id === focus2CurrentTaskId; });
  if (!task) return;
  task.text = document.getElementById('focus2TaskDetailTitle')?.value || task.text;
  saveTodos();
  renderFocus2Categories();
}

function updateFocus2TaskCategory() {
  if (!focus2CurrentTaskId) return;
  var task = todos.find(function(t) { return t.id === focus2CurrentTaskId; });
  if (!task) return;
  task.category = document.getElementById('focus2TaskDetailCategory')?.value || '';
  saveTodos();
  renderFocus2Categories();
}

function updateFocus2TaskBrand() {
  if (!focus2CurrentTaskId) return;
  var task = todos.find(function(t) { return t.id === focus2CurrentTaskId; });
  if (!task) return;
  var brand = document.getElementById('focus2TaskDetailBrand')?.value || '';
  task.brand = brand;
  task.isLife = brand === '_life';
  saveTodos();
  renderFocus2Categories();
}

function updateFocus2TaskDate() {
  if (!focus2CurrentTaskId) return;
  var task = todos.find(function(t) { return t.id === focus2CurrentTaskId; });
  if (!task) return;
  task.date = document.getElementById('focus2TaskDetailDate')?.value || '';
  saveTodos();
  renderFocus2Categories();
  renderFocus2MiniCalendar();
}

function updateFocus2TaskNotes() {
  if (!focus2CurrentTaskId) return;
  var task = todos.find(function(t) { return t.id === focus2CurrentTaskId; });
  if (!task) return;
  task.notes = document.getElementById('focus2TaskDetailNotes')?.value || '';
  saveTodos();
}

function deleteFocus2Task() {
  if (!focus2CurrentTaskId) return;
  if (!confirm('Delete this task?')) return;
  
  todos = todos.filter(function(t) { return t.id !== focus2CurrentTaskId; });
  saveTodos();
  closeFocus2TaskDetail();
  renderFocus2Categories();
  updateFocus2Stats();
  renderFocus2MiniCalendar();
  showToast('Task deleted', 'info');
}

/**
 * v10.5.25: Add task directly to category
 */
function addTaskToCategory(categoryName, inputIdx) {
  var inputId = 'focus2AddInput_' + inputIdx;
  var input = document.getElementById(inputId);
  if (!input || !input.value.trim()) {
    showToast('Please enter a task', 'warning');
    return;
  }
  
  var isLife = getCurrentMode() === 'life';
  var brandIdx = parseInt(document.getElementById('brand')?.value || '0');
  var brand = !isLife && window.brands && window.brands[brandIdx] ? window.brands[brandIdx].name : '';
  
  var newTask = {
    id: Date.now(),
    text: input.value.trim(),
    completed: false,
    date: '', // v12.0.1: Default to no date
    category: categoryName || '',
    brand: isLife ? '_life' : brand,
    isLife: isLife,
    createdAt: new Date().toISOString()
  };
  
  todos.push(newTask);
  saveTodos();

  input.value = '';
  // v13.9: Reset textarea height after clearing
  if (input.tagName === 'TEXTAREA') {
    input.style.height = 'auto';
  }

  // v11.0.5: Use requestAnimationFrame to batch DOM updates and prevent glitch
  requestAnimationFrame(function() {
    renderFocus2Categories();
    updateFocus2Stats();
    renderFocus2MiniCalendar();
  });
  
  showToast('Task added', 'success');
}

/**
 * v10.5.25: Open inline new category modal
 */
function openFocus2NewCategory() {
  var modal = document.getElementById('focus2NewCategoryModal');
  if (modal) {
    modal.style.display = 'block';
    var nameInput = document.getElementById('focus2NewCategoryName');
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
    // Init color picker
    initFocus2ColorPicker();
    // v10.5.25: Init icon picker
    initFocus2IconPicker();
  }
}

/**
 * v10.5.25: Close new category modal
 */
function closeFocus2NewCategory() {
  var modal = document.getElementById('focus2NewCategoryModal');
  if (modal) modal.style.display = 'none';
  
  // v10.5.25: Reset modal to create mode
  var editModeInput = document.getElementById('focus2CategoryEditMode');
  var originalNameInput = document.getElementById('focus2CategoryOriginalName');
  var modalTitle = document.getElementById('focus2CategoryModalTitle');
  var saveBtn = document.getElementById('focus2CategorySaveBtn');
  var nameInput = document.getElementById('focus2NewCategoryName');
  
  if (editModeInput) editModeInput.value = 'create';
  if (originalNameInput) originalNameInput.value = '';
  if (modalTitle) modalTitle.textContent = 'Create Category';
  if (saveBtn) saveBtn.textContent = 'Create';
  if (nameInput) nameInput.value = '';
  
  // Reset selected icon
  window.focus2SelectedIcon = 'default';
  
  // Reset icon picker selection
  var picker = document.getElementById('focus2IconPicker');
  if (picker) {
    picker.querySelectorAll('.focus-2-icon-btn').forEach(function(btn) {
      btn.classList.toggle('selected', btn.getAttribute('data-icon') === 'default');
    });
  }
  var preview = document.getElementById('focus2IconPreviewIcon');
  if (preview && focus2CategoryIconLibrary['default']) {
    preview.innerHTML = focus2CategoryIconLibrary['default'].replace('width="18"', 'width="24"').replace('height="18"', 'height="24"');
  }
  
  // Reset color picker to gold
  var colorPicker = document.getElementById('focus2ColorPicker');
  if (colorPicker) {
    colorPicker.querySelectorAll('.focus-2-color-btn').forEach(function(btn) {
      btn.classList.toggle('selected', btn.getAttribute('data-color') === 'gold');
    });
  }

  // v12.2.4: Reset custom color wheel
  window.focus2CustomColor = null;
  var colorWheelWrapper = document.getElementById('focus2ColorWheelWrapper');
  var colorWheelToggle = document.getElementById('focus2ColorWheelToggle');
  if (colorWheelWrapper) colorWheelWrapper.classList.remove('visible');
  if (colorWheelToggle) colorWheelToggle.classList.remove('active');
}

/**
 * v10.5.25: Initialize icon picker with library
 */
function initFocus2IconPicker() {
  var picker = document.getElementById('focus2IconPicker');
  var preview = document.getElementById('focus2IconPreviewIcon');
  if (!picker) return;
  
  // Set default selection
  window.focus2SelectedIcon = 'default';
  
  // Populate icons from library
  var html = '';
  var iconKeys = Object.keys(focus2CategoryIconLibrary);
  iconKeys.forEach(function(key) {
    var isSelected = key === 'default' ? ' selected' : '';
    html += '<button class="focus-2-icon-btn' + isSelected + '" data-icon="' + key + '" onclick="selectFocus2Icon(\'' + key + '\')" title="' + key + '">';
    html += focus2CategoryIconLibrary[key];
    html += '</button>';
  });
  picker.innerHTML = html;
  
  // Set default preview
  if (preview) {
    preview.innerHTML = focus2CategoryIconLibrary['default'].replace('width="18"', 'width="24"').replace('height="18"', 'height="24"');
  }
}

/**
 * v10.5.25: Select icon from picker
 */
function selectFocus2Icon(iconKey) {
  window.focus2SelectedIcon = iconKey;
  
  // Update button states
  var picker = document.getElementById('focus2IconPicker');
  if (picker) {
    picker.querySelectorAll('.focus-2-icon-btn').forEach(function(btn) {
      btn.classList.toggle('selected', btn.getAttribute('data-icon') === iconKey);
    });
  }
  
  // Update preview
  var preview = document.getElementById('focus2IconPreviewIcon');
  if (preview && focus2CategoryIconLibrary[iconKey]) {
    preview.innerHTML = focus2CategoryIconLibrary[iconKey].replace('width="18"', 'width="24"').replace('height="18"', 'height="24"');
  }
}

/**
 * v10.5.25: Initialize color picker
 */
function initFocus2ColorPicker() {
  var picker = document.getElementById('focus2ColorPicker');
  if (!picker) return;

  var buttons = picker.querySelectorAll('.focus-2-color-btn');
  buttons.forEach(function(btn) {
    btn.onclick = function() {
      buttons.forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      // v12.2.4: Deselect custom color when preset selected
      window.focus2CustomColor = null;
      var toggleBtn = document.getElementById('focus2ColorWheelToggle');
      if (toggleBtn) toggleBtn.classList.remove('active');
    };
  });
  // v12.2.4: Initialize color wheel
  initFocus2ColorWheel();
}

/**
 * v12.2.4: Color Wheel Implementation
 */
var focus2ColorWheelState = {
  hue: 0,
  saturation: 100,
  brightness: 100,
  isDragging: false
};

function initFocus2ColorWheel() {
  var canvas = document.getElementById('focus2ColorWheelCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  drawFocus2ColorWheel(ctx);

  // Mouse events
  canvas.addEventListener('mousedown', function(e) {
    focus2ColorWheelState.isDragging = true;
    handleFocus2ColorWheelClick(e);
  });

  canvas.addEventListener('mousemove', function(e) {
    if (focus2ColorWheelState.isDragging) {
      handleFocus2ColorWheelClick(e);
    }
  });

  document.addEventListener('mouseup', function() {
    focus2ColorWheelState.isDragging = false;
  });

  // Touch events for mobile
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    focus2ColorWheelState.isDragging = true;
    handleFocus2ColorWheelTouch(e);
  });

  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (focus2ColorWheelState.isDragging) {
      handleFocus2ColorWheelTouch(e);
    }
  });

  canvas.addEventListener('touchend', function() {
    focus2ColorWheelState.isDragging = false;
  });
}

function drawFocus2ColorWheel(ctx) {
  var canvas = ctx.canvas;
  var centerX = canvas.width / 2;
  var centerY = canvas.height / 2;
  var radius = Math.min(centerX, centerY);

  // Draw color wheel
  for (var angle = 0; angle < 360; angle++) {
    var startAngle = (angle - 1) * Math.PI / 180;
    var endAngle = (angle + 1) * Math.PI / 180;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();

    var gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'hsl(' + angle + ', 100%, 50%)');
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

function handleFocus2ColorWheelClick(e) {
  var canvas = document.getElementById('focus2ColorWheelCanvas');
  var rect = canvas.getBoundingClientRect();
  var x = e.clientX - rect.left;
  var y = e.clientY - rect.top;
  updateFocus2ColorFromPosition(x, y);
}

function handleFocus2ColorWheelTouch(e) {
  var canvas = document.getElementById('focus2ColorWheelCanvas');
  var rect = canvas.getBoundingClientRect();
  var touch = e.touches[0];
  var x = touch.clientX - rect.left;
  var y = touch.clientY - rect.top;
  updateFocus2ColorFromPosition(x, y);
}

function updateFocus2ColorFromPosition(x, y) {
  var canvas = document.getElementById('focus2ColorWheelCanvas');
  var centerX = canvas.width / 2;
  var centerY = canvas.height / 2;
  var radius = Math.min(centerX, centerY);

  var dx = x - centerX;
  var dy = y - centerY;
  var distance = Math.sqrt(dx * dx + dy * dy);

  // Clamp to circle
  if (distance > radius) {
    dx = dx * radius / distance;
    dy = dy * radius / distance;
    distance = radius;
  }

  // Calculate hue and saturation
  var angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;

  focus2ColorWheelState.hue = angle;
  focus2ColorWheelState.saturation = (distance / radius) * 100;

  // Update pointer position
  var pointer = document.getElementById('focus2ColorWheelPointer');
  if (pointer) {
    pointer.style.left = (centerX + dx) + 'px';
    pointer.style.top = (centerY + dy) + 'px';
    pointer.style.background = hslToHex(angle, focus2ColorWheelState.saturation, focus2ColorWheelState.brightness / 2);
  }

  updateFocus2ColorPreview();
}

function updateFocus2ColorFromBrightness() {
  var slider = document.getElementById('focus2BrightnessSlider');
  if (slider) {
    focus2ColorWheelState.brightness = parseInt(slider.value, 10);
    updateFocus2ColorPreview();
  }
}

function updateFocus2ColorPreview() {
  var hex = hslToHex(
    focus2ColorWheelState.hue,
    focus2ColorWheelState.saturation,
    focus2ColorWheelState.brightness / 2
  );

  var swatch = document.getElementById('focus2ColorWheelSwatch');
  var hexInput = document.getElementById('focus2ColorWheelHex');

  if (swatch) swatch.style.background = hex;
  if (hexInput) hexInput.value = hex;

  window.focus2CustomColor = hex;
}

function updateFocus2ColorFromHex() {
  var hexInput = document.getElementById('focus2ColorWheelHex');
  if (!hexInput) return;

  var hex = hexInput.value.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;

  var swatch = document.getElementById('focus2ColorWheelSwatch');
  if (swatch) swatch.style.background = hex;

  window.focus2CustomColor = hex;
}

function toggleFocus2ColorWheel() {
  var wrapper = document.getElementById('focus2ColorWheelWrapper');
  var toggleBtn = document.getElementById('focus2ColorWheelToggle');

  if (!wrapper) return;

  var isVisible = wrapper.classList.contains('visible');
  wrapper.classList.toggle('visible');
  if (toggleBtn) toggleBtn.classList.toggle('active');

  if (!isVisible) {
    // Initialize wheel when opening
    var canvas = document.getElementById('focus2ColorWheelCanvas');
    if (canvas) {
      var ctx = canvas.getContext('2d');
      drawFocus2ColorWheel(ctx);
    }
    // Set default color
    if (!window.focus2CustomColor) {
      window.focus2CustomColor = '#a89878';
      var hexInput = document.getElementById('focus2ColorWheelHex');
      var swatch = document.getElementById('focus2ColorWheelSwatch');
      if (hexInput) hexInput.value = '#a89878';
      if (swatch) swatch.style.background = '#a89878';
    }
  }
}

function applyFocus2CustomColor() {
  var hex = window.focus2CustomColor;
  if (!hex) return;

  // Deselect preset colors
  var picker = document.getElementById('focus2ColorPicker');
  if (picker) {
    picker.querySelectorAll('.focus-2-color-btn').forEach(function(btn) {
      btn.classList.remove('selected');
    });
  }

  // Mark toggle as active
  var toggleBtn = document.getElementById('focus2ColorWheelToggle');
  if (toggleBtn) toggleBtn.classList.add('active');

  showToast('Custom color applied: ' + hex, 'success');
}

function hslToHex(h, s, l) {
  s = s / 100;
  l = l / 100;

  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs((h / 60) % 2 - 1));
  var m = l - c / 2;
  var r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * v10.5.25: Save new category from Focus modal (supports create and edit modes)
 */
function saveFocus2NewCategory() {
  var nameInput = document.getElementById('focus2NewCategoryName');
  var colorPicker = document.getElementById('focus2ColorPicker');
  var editModeInput = document.getElementById('focus2CategoryEditMode');
  var originalNameInput = document.getElementById('focus2CategoryOriginalName');
  
  if (!nameInput || !nameInput.value.trim()) {
    showToast('Please enter a category name', 'warning');
    return;
  }
  
  var name = nameInput.value.trim();
  var selectedColor = colorPicker.querySelector('.focus-2-color-btn.selected');
  // v12.2.4: Support custom hex colors from color wheel
  var colorPreset = window.focus2CustomColor || (selectedColor ? selectedColor.getAttribute('data-color') : 'gold');
  var customHex = window.focus2CustomColor || null;
  var selectedIcon = window.focus2SelectedIcon || 'default';
  var isEditMode = editModeInput && editModeInput.value === 'edit';
  var originalName = originalNameInput ? originalNameInput.value : '';

  var categories = window.todoCategories || [];

  if (isEditMode) {
    // EDIT MODE - update existing category
    var catIdx = categories.findIndex(function(c) { return c.name === originalName; });
    if (catIdx === -1) {
      showToast('Category not found', 'error');
      return;
    }

    // Check for duplicate name (if name changed)
    if (name.toLowerCase() !== originalName.toLowerCase()) {
      var exists = categories.some(function(c) { return c.name.toLowerCase() === name.toLowerCase(); });
      if (exists) {
        showToast('Category name already exists', 'warning');
        return;
      }
    }

    // Update category
    categories[catIdx].name = name;
    categories[catIdx].colorPreset = colorPreset;
    categories[catIdx].customHex = customHex;
    categories[catIdx].icon = selectedIcon;
    
    // Update all tasks that reference this category
    if (name !== originalName) {
      todos.forEach(function(task) {
        if (task.category === originalName) {
          task.category = name;
        }
      });
      saveTodos();
    }
    
    window.todoCategories = categories;
    saveTodoCategories();
    
    closeFocus2NewCategory();
    renderFocus2Categories();
    showToast('Category updated: ' + name, 'success');
    
  } else {
    // CREATE MODE - add new category
    var exists = categories.some(function(c) { return c.name.toLowerCase() === name.toLowerCase(); });
    if (exists) {
      showToast('Category already exists', 'warning');
      return;
    }
    
    var isLife = getCurrentMode() === 'life';
    var newCat = {
      id: Date.now(),
      name: name,
      colorPreset: colorPreset,
      customHex: customHex,
      icon: selectedIcon,
      description: 'Tasks in this category',
      isLife: isLife
    };
    
    categories.push(newCat);
    window.todoCategories = categories;
    saveTodoCategories();
    
    closeFocus2NewCategory();
    renderFocus2Categories();
    showToast('Category created: ' + name, 'success');
  }
}

/**
 * v12.2.4: Edit existing category - inline editing within category card
 */
function editCategory(categoryName) {
  var categories = window.todoCategories || [];
  var cat = categories.find(function(c) { return c.name === categoryName; });

  if (!cat) {
    showToast('Category not found', 'error');
    return;
  }

  // Find the category card
  var card = document.querySelector('.focus-2-category-card[data-category="' + categoryName.replace(/"/g, '\\"') + '"]');
  if (!card) {
    showToast('Category card not found', 'error');
    return;
  }

  // Close any other editing categories
  document.querySelectorAll('.focus-2-category-card.editing').forEach(function(c) {
    c.classList.remove('editing');
    var oldEdit = c.querySelector('.focus-2-inline-edit');
    if (oldEdit) oldEdit.remove();
  });

  // Mark card as editing
  card.classList.add('editing');
  card.classList.add('expanded');

  // Store current edit state
  window.inlineEditState = {
    categoryName: categoryName,
    selectedColor: cat.colorPreset || 'gold',
    customHex: cat.customHex || null
  };

  // Build inline edit HTML
  var colorPresets = [
    {name: 'gold', hex: '#a89878'},
    {name: 'blue', hex: '#3b82f6'},
    {name: 'green', hex: '#22c55e'},
    {name: 'purple', hex: '#a855f7'},
    {name: 'red', hex: '#ef4444'},
    {name: 'orange', hex: '#f97316'},
    {name: 'pink', hex: '#ec4899'},
    {name: 'cyan', hex: '#06b6d4'}
  ];

  var colorBtnsHtml = '';
  colorPresets.forEach(function(preset) {
    var isSelected = !cat.customHex && (cat.colorPreset || 'gold') === preset.name;
    colorBtnsHtml += '<button class="focus-2-inline-color-btn' + (isSelected ? ' selected' : '') + '" data-color="' + preset.name + '" style="background: ' + preset.hex + ';" onclick="event.stopPropagation(); selectInlineEditColor(\'' + preset.name + '\', null)"></button>';
  });

  var editHtml = '<div class="focus-2-inline-edit" onclick="event.stopPropagation()">';
  editHtml += '<div class="focus-2-inline-edit-field">';
  editHtml += '<label>Name</label>';
  editHtml += '<input type="text" id="inlineEditName" value="' + escapeHtml(cat.name) + '" onclick="event.stopPropagation()">';
  editHtml += '</div>';
  editHtml += '<div class="focus-2-inline-edit-field">';
  editHtml += '<label>Color</label>';
  editHtml += '<div class="focus-2-inline-color-picker">';
  editHtml += colorBtnsHtml;
  editHtml += '<button class="focus-2-inline-custom-color-btn' + (cat.customHex ? ' active' : '') + '" onclick="event.stopPropagation(); toggleInlineColorWheel()">';
  editHtml += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>';
  editHtml += 'Custom</button>';
  editHtml += '</div>';
  editHtml += '<div class="focus-2-inline-color-wheel' + (cat.customHex ? ' visible' : '') + '" id="inlineColorWheelWrapper">';
  editHtml += '<div class="focus-2-inline-color-wheel-container">';
  editHtml += '<canvas class="focus-2-inline-color-wheel-canvas" id="inlineColorWheelCanvas" width="140" height="140"></canvas>';
  editHtml += '<div class="focus-2-inline-color-wheel-pointer" id="inlineColorWheelPointer"></div>';
  editHtml += '</div>';
  editHtml += '<div class="focus-2-inline-color-preview">';
  editHtml += '<div class="focus-2-inline-color-swatch" id="inlineColorSwatch" style="background: ' + (cat.customHex || '#a89878') + ';"></div>';
  editHtml += '<input type="text" class="focus-2-inline-color-hex" id="inlineColorHex" value="' + (cat.customHex || '#a89878') + '" maxlength="7" onclick="event.stopPropagation()" oninput="updateInlineColorFromHex()">';
  editHtml += '</div>';
  editHtml += '</div>';
  editHtml += '</div>';
  editHtml += '<div class="focus-2-inline-edit-actions">';
  editHtml += '<button class="focus-2-inline-edit-cancel" onclick="event.stopPropagation(); cancelInlineEdit()">Cancel</button>';
  editHtml += '<button class="focus-2-inline-edit-save" onclick="event.stopPropagation(); saveInlineEdit()">Save</button>';
  editHtml += '</div>';
  editHtml += '</div>';

  // Insert edit form into card
  card.insertAdjacentHTML('beforeend', editHtml);

  // Initialize color wheel if custom color is shown
  if (cat.customHex) {
    setTimeout(function() {
      initInlineColorWheel();
    }, 50);
  }

  // Focus name input
  setTimeout(function() {
    var nameInput = document.getElementById('inlineEditName');
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  }, 100);
}

/**
 * v12.2.4: Select a preset color in inline edit
 */
function selectInlineEditColor(colorName, customHex) {
  window.inlineEditState.selectedColor = colorName;
  window.inlineEditState.customHex = customHex;

  // Update button states
  document.querySelectorAll('.focus-2-inline-color-btn').forEach(function(btn) {
    btn.classList.toggle('selected', btn.getAttribute('data-color') === colorName && !customHex);
  });

  var customBtn = document.querySelector('.focus-2-inline-custom-color-btn');
  if (customBtn) customBtn.classList.toggle('active', !!customHex);

  // Hide color wheel when preset selected
  if (!customHex) {
    var wrapper = document.getElementById('inlineColorWheelWrapper');
    if (wrapper) wrapper.classList.remove('visible');
  }
}

/**
 * v12.2.4: Toggle inline color wheel
 */
function toggleInlineColorWheel() {
  var wrapper = document.getElementById('inlineColorWheelWrapper');
  var customBtn = document.querySelector('.focus-2-inline-custom-color-btn');
  if (!wrapper) return;

  var isVisible = wrapper.classList.contains('visible');
  wrapper.classList.toggle('visible');
  if (customBtn) customBtn.classList.toggle('active');

  if (!isVisible) {
    initInlineColorWheel();
    // Deselect preset colors
    document.querySelectorAll('.focus-2-inline-color-btn').forEach(function(btn) {
      btn.classList.remove('selected');
    });
  }
}

/**
 * v12.2.4: Initialize inline color wheel
 */
function initInlineColorWheel() {
  var canvas = document.getElementById('inlineColorWheelCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  drawInlineColorWheel(ctx);

  // Remove old listeners by cloning
  var newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  canvas = newCanvas;
  ctx = canvas.getContext('2d');
  drawInlineColorWheel(ctx);

  // Mouse events
  canvas.addEventListener('mousedown', function(e) {
    window.inlineColorDragging = true;
    handleInlineColorWheelClick(e);
  });

  canvas.addEventListener('mousemove', function(e) {
    if (window.inlineColorDragging) {
      handleInlineColorWheelClick(e);
    }
  });

  document.addEventListener('mouseup', function() {
    window.inlineColorDragging = false;
  });

  // Touch events
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    window.inlineColorDragging = true;
    handleInlineColorWheelTouch(e);
  });

  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (window.inlineColorDragging) {
      handleInlineColorWheelTouch(e);
    }
  });

  canvas.addEventListener('touchend', function() {
    window.inlineColorDragging = false;
  });
}

/**
 * v12.2.4: Draw inline color wheel
 */
function drawInlineColorWheel(ctx) {
  var canvas = ctx.canvas;
  var centerX = canvas.width / 2;
  var centerY = canvas.height / 2;
  var radius = Math.min(centerX, centerY);

  for (var angle = 0; angle < 360; angle++) {
    var startAngle = (angle - 1) * Math.PI / 180;
    var endAngle = (angle + 1) * Math.PI / 180;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();

    var gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'hsl(' + angle + ', 100%, 50%)');
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

/**
 * v12.2.4: Handle inline color wheel click
 */
function handleInlineColorWheelClick(e) {
  var canvas = document.getElementById('inlineColorWheelCanvas');
  if (!canvas) return;
  var rect = canvas.getBoundingClientRect();
  var x = e.clientX - rect.left;
  var y = e.clientY - rect.top;
  updateInlineColorFromPosition(x, y);
}

/**
 * v12.2.4: Handle inline color wheel touch
 */
function handleInlineColorWheelTouch(e) {
  var canvas = document.getElementById('inlineColorWheelCanvas');
  if (!canvas) return;
  var rect = canvas.getBoundingClientRect();
  var touch = e.touches[0];
  var x = touch.clientX - rect.left;
  var y = touch.clientY - rect.top;
  updateInlineColorFromPosition(x, y);
}

/**
 * v12.2.4: Update color from wheel position
 */
function updateInlineColorFromPosition(x, y) {
  var canvas = document.getElementById('inlineColorWheelCanvas');
  if (!canvas) return;
  var centerX = canvas.width / 2;
  var centerY = canvas.height / 2;
  var radius = Math.min(centerX, centerY);

  var dx = x - centerX;
  var dy = y - centerY;
  var distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > radius) {
    dx = dx * radius / distance;
    dy = dy * radius / distance;
    distance = radius;
  }

  var angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;

  var saturation = (distance / radius) * 100;
  var hex = hslToHex(angle, saturation, 50);

  // Update pointer
  var pointer = document.getElementById('inlineColorWheelPointer');
  if (pointer) {
    pointer.style.left = (centerX + dx) + 'px';
    pointer.style.top = (centerY + dy) + 'px';
    pointer.style.background = hex;
  }

  // Update preview
  var swatch = document.getElementById('inlineColorSwatch');
  var hexInput = document.getElementById('inlineColorHex');
  if (swatch) swatch.style.background = hex;
  if (hexInput) hexInput.value = hex;

  window.inlineEditState.customHex = hex;
  window.inlineEditState.selectedColor = null;
}

/**
 * v12.2.4: Update color from hex input
 */
function updateInlineColorFromHex() {
  var hexInput = document.getElementById('inlineColorHex');
  if (!hexInput) return;

  var hex = hexInput.value.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;

  var swatch = document.getElementById('inlineColorSwatch');
  if (swatch) swatch.style.background = hex;

  window.inlineEditState.customHex = hex;
  window.inlineEditState.selectedColor = null;

  // Deselect presets
  document.querySelectorAll('.focus-2-inline-color-btn').forEach(function(btn) {
    btn.classList.remove('selected');
  });
}

/**
 * v12.2.4: Cancel inline edit
 */
function cancelInlineEdit() {
  var card = document.querySelector('.focus-2-category-card.editing');
  if (card) {
    card.classList.remove('editing');
    var editForm = card.querySelector('.focus-2-inline-edit');
    if (editForm) editForm.remove();
  }
  window.inlineEditState = null;
}

/**
 * v12.2.4: Save inline edit
 */
function saveInlineEdit() {
  if (!window.inlineEditState) return;

  var nameInput = document.getElementById('inlineEditName');
  if (!nameInput || !nameInput.value.trim()) {
    showToast('Please enter a category name', 'warning');
    return;
  }

  var newName = nameInput.value.trim();
  var originalName = window.inlineEditState.categoryName;
  var categories = window.todoCategories || [];

  // Check for duplicate name
  if (newName.toLowerCase() !== originalName.toLowerCase()) {
    var exists = categories.some(function(c) { return c.name.toLowerCase() === newName.toLowerCase(); });
    if (exists) {
      showToast('Category name already exists', 'warning');
      return;
    }
  }

  // Find and update category
  var catIdx = categories.findIndex(function(c) { return c.name === originalName; });
  if (catIdx === -1) {
    showToast('Category not found', 'error');
    return;
  }

  categories[catIdx].name = newName;
  categories[catIdx].colorPreset = window.inlineEditState.selectedColor || 'gold';
  categories[catIdx].customHex = window.inlineEditState.customHex || null;

  // Update tasks if name changed
  if (newName !== originalName) {
    todos.forEach(function(task) {
      if (task.category === originalName) {
        task.category = newName;
      }
    });
    saveTodos();
  }

  window.todoCategories = categories;
  saveTodoCategories();

  // Close edit mode and re-render
  cancelInlineEdit();
  renderFocus2Categories();
  // v13.1: Also refresh Upcoming/Today to sync category name/color changes
  if (window.focus2SelectedDate) {
    renderFocus2DayDetailContent(window.focus2SelectedDate);
  }
  // v13.1: Re-initialize drag handlers after re-render
  if (typeof initFocus2DragDrop === 'function') {
    setTimeout(function() { initFocus2DragDrop(); }, 100);
  }
  showToast('Category updated', 'success');
}

/**
 * v10.5.25: Delete category with confirmation
 */
function deleteCategory(categoryName) {
  var categories = window.todoCategories || [];
  var cat = categories.find(function(c) { return c.name === categoryName; });
  
  if (!cat) {
    showToast('Category not found', 'error');
    return;
  }
  
  // Count tasks in this category
  var tasksInCategory = todos.filter(function(t) { return t.category === categoryName; }).length;
  
  var message = 'Delete category "' + categoryName + '"?';
  if (tasksInCategory > 0) {
    message += '\n\n' + tasksInCategory + ' task(s) will be moved to Uncategorized.';
  }
  
  if (!confirm(message)) return;
  
  // v25.1: Tombstone tracking removed -- write-through sync handles deletions via single-document pattern

  // Remove category
  var catIdx = categories.findIndex(function(c) { return c.name === categoryName; });
  if (catIdx !== -1) {
    categories.splice(catIdx, 1);
    window.todoCategories = categories;
    saveTodoCategories();
  }

  // Move tasks to uncategorized
  if (tasksInCategory > 0) {
    todos.forEach(function(task) {
      if (task.category === categoryName) {
        task.category = '';
      }
    });
    saveTodos();
  }
  
  renderFocus2Categories();
  // v25.1: saveTodos()/saveTodoCategories() already write through to Firestore
  showToast('Category deleted: ' + categoryName, 'success');
}

/**
 * v10.5.25: Toggle task completion from Focus 2.0
 */
function toggleFocus2Task(taskId) {
  var task = todos.find(function(t) { return t.id === taskId; });
  if (task) {
    task.completed = !task.completed;
    if (task.completed) {
      task.completedAt = new Date().toISOString();
    }
    saveTodos();
    renderFocus2Categories();
    updateFocus2Stats();
    renderFocusTodoList();
    renderCalendar();
    renderFocus2MiniCalendar();
  }
}

/**
 * v10.5.25: Update Focus 2.0 stats
 */
function updateFocus2Stats() {
  var today = new Date().toISOString().slice(0, 10);
  var isLife = getCurrentMode() === 'life';
  var brandIdx = parseInt(document.getElementById('brand')?.value || '0');
  var brand = window.brands && window.brands[brandIdx] ? window.brands[brandIdx].name : '';
  
  // v10.5.25: Count ALL tasks for current mode, not just today's
  var relevantTodos = todos.filter(function(t) {
    if (isLife) {
      return t.isLife === true || t.brand === '_life';
    } else {
      return !t.brand || t.brand === brand || t.brand === '';
    }
  });
  
  var pendingTasks = relevantTodos.filter(function(t) { return !t.completed; });
  var doneTasks = relevantTodos.filter(function(t) { return t.completed; });
  
  // v13.9: Calculate streak using Set for O(n) instead of O(365*n)
  var completedDates = {};
  relevantTodos.forEach(function(t) {
    if (t.completed && t.date) completedDates[t.date] = true;
  });
  var streak = 0;
  if (completedDates[today]) streak++;
  var checkDate = new Date();
  checkDate.setDate(checkDate.getDate() - 1);
  for (var si = 0; si < 365; si++) {
    var dateStr = checkDate.toISOString().slice(0, 10);
    if (completedDates[dateStr]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  // Get automations for today
  var scheduledTasks = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  var todayAutomations = scheduledTasks.filter(function(a) {
    return a.scheduledDate && a.scheduledDate.slice(0, 10) === today;
  });
  
  var statTasks = document.getElementById('focus2StatTasks');
  var statDone = document.getElementById('focus2StatDone');
  var statStreak = document.getElementById('focus2StatStreak');
  var statAuto = document.getElementById('focus2StatAuto');
  
  if (statTasks) statTasks.textContent = pendingTasks.length;
  if (statDone) statDone.textContent = doneTasks.length;
  if (statStreak) statStreak.textContent = streak;
  if (statAuto) statAuto.textContent = todayAutomations.length;
}

/**
 * v10.5.25: Render today's automations
 */
function renderFocus2Automations() {
  var container = document.getElementById('focus2AutomationsList');
  if (!container) return;

  // v18.7: Simplified — show compact upcoming automations list, link to Automations Lab for CRUD
  var scheduledTasks = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  var savedAutomations = [];
  try { savedAutomations = JSON.parse(localStorage.getItem('roweos_automations') || '[]'); } catch(e) {}

  // Merge by id, only include enabled automations
  var allIds = {};
  var allAutomations = [];
  scheduledTasks.forEach(function(a) { allIds[a.id] = true; allAutomations.push(a); });
  savedAutomations.forEach(function(a) { if (!allIds[a.id]) allAutomations.push(a); });
  var enabled = allAutomations.filter(function(a) { return a.enabled !== false; });

  // Sort by next run time (soonest first)
  var now = new Date();
  enabled.sort(function(a, b) {
    var aTime = a.time || '09:00';
    var bTime = b.time || '09:00';
    var aDate = a.scheduledDate || now.toISOString().slice(0, 10);
    var bDate = b.scheduledDate || now.toISOString().slice(0, 10);
    return (aDate + 'T' + aTime) < (bDate + 'T' + bTime) ? -1 : 1;
  });

  var upcoming = enabled.slice(0, 5);
  var recurMap = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', custom: 'Custom' };
  var actionMap = { notify: 'Notify', create: 'Task', message: 'AI', studio: 'Studio', pulse: 'Pulse', image: 'Image', post: 'Post', pipeline: 'Pipeline', library: 'Library' };

  var html = '';
  if (upcoming.length === 0) {
    html += '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:var(--text-sm);">No active automations</div>';
  } else {
    upcoming.forEach(function(auto) {
      var recurBadge = '';
      if (auto.recurType && auto.recurType !== 'none') {
        var recurText = auto.recurType === 'custom' && auto.recurInterval ? 'Every ' + auto.recurInterval + ' ' + (auto.recurUnit || 'days') : (recurMap[auto.recurType] || auto.recurType);
        recurBadge = '<span style="padding:1px 6px;border-radius:var(--radius-full);background:var(--accent-10,rgba(168,152,120,0.1));color:var(--accent);font-size:10px;font-weight:500;">' + recurText + '</span>';
      }
      var actionBadge = '<span style="padding:1px 6px;border-radius:var(--radius-full);background:var(--bg-tertiary);color:var(--text-secondary);font-size:10px;">' + (actionMap[auto.action] || auto.action || 'Notify') + '</span>';
      html += '<div class="focus-2-automation-item" style="padding:8px 0;border-bottom:1px solid var(--border-color);">';
      html += '<div class="focus-2-automation-icon" style="flex-shrink:0;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:13px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(auto.name) + '</div>';
      html += '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">';
      html += '<span style="font-size:11px;color:var(--text-muted);">' + (auto.time || '9:00') + '</span>';
      html += actionBadge + recurBadge;
      html += '</div></div></div>';
    });
  }

  // v18.7: "View All" link to Automations Lab
  html += '<div style="display:flex;gap:8px;margin-top:var(--space-3);justify-content:center;">';
  html += '<button onclick="showView(\'rhythm\');setTimeout(function(){var t=document.querySelector(\'[data-rhythm-tab=\\\'automations\\\']\');if(t)t.click();},100);" style="background:none;border:1px solid var(--border-color);border-radius:var(--radius-md);padding:6px 14px;font-size:12px;color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;gap:4px;">';
  html += '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
  html += 'View All (' + allAutomations.length + ')';
  html += '</button></div>';

  container.innerHTML = html;
}

// v12.2.6: Global automation form (not category-specific)
function showFocusGlobalAutomationForm() {
  var container = document.getElementById('focus2AutomationsList');
  if (!container) return;

  // Check if form already exists
  if (document.getElementById('globalAutoForm')) return;

  // v13.2: Expanded automation form with date, recurrence, and module targets
  var todayStr = new Date().toISOString().slice(0, 10);
  var html = '<div id="globalAutoForm" class="focus-2-automation-inline" style="margin-top: var(--space-3);">';
  html += '<div class="focus-2-automation-inline-header">';
  html += '<div class="focus-2-automation-inline-title">New Automation</div>';
  html += '<button onclick="cancelAutomationForm()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">x</button>';
  html += '</div>';
  html += '<div class="focus-2-automation-field"><label>Name</label>';
  html += '<input type="text" id="globalAutoDesc" placeholder="Automation name..."></div>';
  html += '<div class="focus-2-automation-field"><label>Date</label>';
  html += '<input type="date" id="globalAutoDate" value="' + todayStr + '"></div>';
  html += '<div class="focus-2-automation-field"><label>Time</label>';
  html += '<input type="time" id="globalAutoTime" value="09:00"></div>';
  html += '<div class="focus-2-automation-field"><label>Recurrence</label>';
  html += '<select id="globalAutoRecur">';
  html += '<option value="none">None (one-time)</option>';
  html += '<option value="daily">Daily</option>';
  html += '<option value="weekdays">Weekdays</option>';
  html += '<option value="weekly">Weekly</option>';
  html += '<option value="biweekly">Biweekly</option>';
  html += '<option value="monthly">Monthly</option>';
  html += '</select></div>';
  // v13.4: Agent selector
  var isLife = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  html += '<div class="focus-2-automation-field"><label>Agent</label>';
  html += '<select id="globalAutoAgent">';
  if (isLife) {
    html += '<option value="coach">Life Coach</option>';
    html += '<option value="wellness">Wellness Coach</option>';
    html += '<option value="taxintelligence">Tax Intelligence</option>';
    html += '<option value="personal">Personal AI</option>';
  } else {
    html += '<option value="strategy">Strategy</option>';
    html += '<option value="marketing">Marketing</option>';
    html += '<option value="operations">Operations</option>';
    html += '<option value="documents">Documents</option>';
  }
  html += '</select></div>';
  html += '<div class="focus-2-automation-field"><label>Action</label>';
  html += '<select id="globalAutoAction" onchange="renderAutoTargetConfig(this.value)">';
  html += '<option value="notify">Send notification</option>';
  html += '<option value="reminder">Show reminder popup</option>';
  html += '<option value="create">Create a task</option>';
  html += '<option value="message">Send to AI</option>';
  html += '<option value="studio">Run Studio operation</option>';
  html += '<option value="pulse">Update Pulse goal</option>';
  html += '<option value="rhythm">Add Rhythm event</option>';
  html += '<option value="library">Save to Library</option>';
  html += '</select></div>';
  html += '<div id="globalAutoTargetConfig"></div>';
  html += '<div style="display:flex;gap:8px;margin-top:var(--space-3);">';
  html += '<button class="focus-2-btn" onclick="cancelAutomationForm()">Cancel</button>';
  html += '<button class="focus-2-btn focus-2-btn-primary" onclick="saveGlobalAutomation()">Save</button>';
  html += '</div></div>';

  container.insertAdjacentHTML('beforeend', html);
}

/**
 * v13.2: Render target config sub-options based on selected action
 */
function renderAutoTargetConfig(action) {
  var container = document.getElementById('globalAutoTargetConfig');
  if (!container) return;
  var html = '';
  if (action === 'create') {
    var cats = (window.todoCategories || []);
    html += '<div class="focus-2-automation-field"><label>Category</label>';
    html += '<select id="globalAutoTargetCat"><option value="">Default</option>';
    cats.forEach(function(c) { html += '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>'; });
    html += '</select></div>';
    html += '<div class="focus-2-automation-field"><label>Task Text</label>';
    html += '<input type="text" id="globalAutoTargetText" placeholder="Task to create..."></div>';
  } else if (action === 'message') {
    html += '<div class="focus-2-automation-field"><label>Message</label>';
    html += '<input type="text" id="globalAutoTargetText" placeholder="Message to send to AI..."></div>';
  } else if (action === 'pulse') {
    html += '<div class="focus-2-automation-field"><label>Goal</label>';
    html += '<select id="globalAutoTargetGoal"><option value="">Select goal...</option>';
    (pulseGoals || []).forEach(function(g) {
      if (!g.completed && !g.archived) html += '<option value="' + g.id + '">' + escapeHtml(g.title) + '</option>';
    });
    html += '</select></div>';
  } else if (action === 'studio') {
    html += '<div class="focus-2-automation-field"><label>Operation</label>';
    html += '<input type="text" id="globalAutoTargetText" placeholder="Studio operation name..."></div>';
  } else if (action === 'reminder') {
    html += '<div class="focus-2-automation-field"><label>Reminder Title</label>';
    html += '<input type="text" id="globalAutoTargetReminderTitle" placeholder="Follow up with client..."></div>';
    html += '<div class="focus-2-automation-field"><label>Message</label>';
    html += '<input type="text" id="globalAutoTargetText" placeholder="Details (optional)"></div>';
  }
  container.innerHTML = html;
}

/**
 * v13.2: Cancel and remove automation form
 */
function cancelAutomationForm() {
  var form = document.getElementById('globalAutoForm');
  if (form) form.remove();
}

function saveGlobalAutomation() {
  // v13.2: Read expanded form fields
  var desc = document.getElementById('globalAutoDesc') ? document.getElementById('globalAutoDesc').value.trim() : '';
  var date = document.getElementById('globalAutoDate') ? document.getElementById('globalAutoDate').value : '';
  var time = document.getElementById('globalAutoTime') ? document.getElementById('globalAutoTime').value : '09:00';
  var recurType = document.getElementById('globalAutoRecur') ? document.getElementById('globalAutoRecur').value : 'none';
  var action = document.getElementById('globalAutoAction') ? document.getElementById('globalAutoAction').value : 'notify';
  if (!desc) { showToast('Please enter a name', 'warning'); return; }

  // Build target config based on action type
  var target = {};
  var targetText = document.getElementById('globalAutoTargetText');
  var targetCat = document.getElementById('globalAutoTargetCat');
  var targetGoal = document.getElementById('globalAutoTargetGoal');
  if (targetText) target.text = targetText.value.trim();
  if (targetCat) target.category = targetCat.value;
  if (targetGoal) target.goalId = targetGoal.value;
  var targetReminderTitle = document.getElementById('globalAutoTargetReminderTitle');
  if (targetReminderTitle) target.reminderTitle = targetReminderTitle.value.trim();
  target.module = action;

  // v13.4: Include agent selection
  var agentEl = document.getElementById('globalAutoAgent');
  var agent = agentEl ? agentEl.value : '';

  var automation = {
    id: Date.now(),
    name: desc,
    description: desc, // v24.27: Store description separately
    scheduledDate: date,
    time: time,
    recurType: recurType,
    action: action,
    agent: agent,
    target: target,
    enabled: true,
    mode: getCurrentMode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), // v24.14: Required for sync merge
    _modifiedAt: Date.now() // v25.2: Stamp for merge
  };

  var automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
  automations.push(automation);
  localStorage.setItem('roweos_automations', JSON.stringify(automations));

  var scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : [];
  scheduled.push(automation);
  if (typeof saveScheduledTasks === 'function') saveScheduledTasks(scheduled);

  cancelAutomationForm();
  renderFocus2Automations();
  showToast('Automation created', 'success');
  // v25.1: saveScheduledTasks() already writes through to Firestore
}

function deleteFocusAutomation(autoId) {
  if (!confirm('Delete this automation?')) return;
  var idStr = String(autoId);

  // v25.1: Write-through delete — remove from localStorage + Firestore immediately
  var automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
  automations = automations.filter(function(a) { return String(a.id) !== idStr; });
  localStorage.setItem('roweos_automations', JSON.stringify(automations));

  var scheduled = getScheduledTasks();
  scheduled = scheduled.filter(function(a) { return String(a.id) !== idStr; });
  saveScheduledTasks(scheduled);

  // Delete from Firestore via write-through
  deleteDBDoc('automations', idStr, 'automations');

  renderFocus2Automations();
  showToast('Automation deleted', 'success');
}

/**
 * v13.4: Toggle automation enabled/disabled
 */
// v23.11: Rewritten — uses getMergedAutomations as source of truth, writes back to BOTH stores
function toggleAutomationEnabled(autoId) {
  var idStr = String(autoId);
  var merged = getMergedAutomations();
  var newEnabled = true;
  merged.forEach(function(a) {
    if (String(a.id) === idStr) {
      a.enabled = !(a.enabled !== false);
      newEnabled = a.enabled;
    }
  });
  // v24.2: Write back to BOTH stores — update enabled in roweos_automations directly
  try {
    var rawAuto = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    var nowIso = new Date().toISOString();
    rawAuto.forEach(function(a) { if (String(a.id) === idStr) { a.enabled = newEnabled; a.updatedAt = nowIso; a._modifiedAt = Date.now(); } });
    localStorage.setItem('roweos_automations', JSON.stringify(rawAuto));
  } catch(e) {}
  if (typeof saveScheduledTasks === 'function') saveScheduledTasks(merged);
  renderFocus2Automations();
  // v25.1: saveScheduledTasks() already writes through to Firestore
}

