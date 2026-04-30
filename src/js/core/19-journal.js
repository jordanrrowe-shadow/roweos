
/**
 * v10.5.25: Generate AI suggestion for Focus
 */
function generateFocus2AISuggestion() {
  var today = new Date().toISOString().slice(0, 10);
  var isLife = getCurrentMode() === 'life';
  var _brandElJ1 = document.getElementById('brand'); // v30.1: ES5 fix
  var brandIdx = parseInt((_brandElJ1 ? _brandElJ1.value : null) || '0');
  var brand = window.brands && window.brands[brandIdx] ? window.brands[brandIdx].name : '';

  var pendingTasks = todos.filter(function(t) {
    return !t.completed && (!t.date || t.date <= today);
  });
  
  var suggestions = [];
  
  if (isLife) {
    suggestions = [
      'You have ' + pendingTasks.length + ' pending items. Consider using the "Weekly Review" operation in Studio to organize your priorities.',
      'Start your day with intention. Try the "Daily Planning" operation to set clear goals.',
      'Based on your task history, Tuesdays are your most productive days. Make the most of today!'
    ];
  } else {
    suggestions = [
      'You have ' + pendingTasks.length + ' pending items for ' + brand + '. Consider running "Social Media Content" in Studio to batch similar tasks.',
      'Your brand content velocity has been consistent. Keep the momentum going!',
      'Based on your patterns, now might be a good time to generate some "Email Campaign" content.'
    ];
  }
  
  var suggestionEl = document.getElementById('focus2AISuggestion');
  if (suggestionEl) {
    suggestionEl.textContent = suggestions[Math.floor(Math.random() * suggestions.length)];
  }
}

/**
 * v10.5.25: Run AI-suggested Studio operation
 */
function runFocus2AISuggestion() {
  showView('studio');
  showToast('Opening Studio...', 'info');
}

/**
 * v10.5.25: Dismiss AI suggestion
 */
function dismissFocus2AI() {
  var card = document.getElementById('focus2AICard');
  if (card) card.style.display = 'none';
}

/**
 * v10.5.25: Toggle inline add task form
 */
function toggleFocus2AddTask() {
  var form = document.getElementById('focus2AddTaskForm');
  if (form) {
    var isVisible = form.style.display !== 'none';
    form.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      var input = document.getElementById('focus2TaskInput');
      if (input) input.focus();
      populateFocus2Categories();
    }
  }
}

/**
 * v10.5.25: Save task from inline form
 */
function saveFocus2Task() {
  var input = document.getElementById('focus2TaskInput');
  var categorySelect = document.getElementById('focus2TaskCategory');
  
  if (!input || !input.value.trim()) {
    showToast('Please enter a task', 'warning');
    return;
  }
  
  var today = new Date().toISOString().slice(0, 10);
  var isLife = getCurrentMode() === 'life';
  var _brandElJ2 = document.getElementById('brand'); // v30.1: ES5 fix
  var brandIdx = parseInt((_brandElJ2 ? _brandElJ2.value : null) || '0');
  var brand = !isLife && window.brands && window.brands[brandIdx] ? window.brands[brandIdx].name : '';
  
  var newTask = {
    id: Date.now(),
    text: input.value.trim(),
    completed: false,
    date: today,
    category: categorySelect ? categorySelect.value : '',
    brand: brand,
    createdAt: new Date().toISOString()
  };
  
  todos.push(newTask);
  saveTodos();
  
  // Clear and hide form
  input.value = '';
  if (categorySelect) categorySelect.value = '';
  toggleFocus2AddTask();
  
  // Refresh UI
  renderFocus2Timeline();
  updateFocus2Stats();
  renderFocus2MiniCalendar();
  renderFocusTodoList();
  renderCalendar();
  
  showToast('Task added', 'success');
}

/**
 * v10.5.25: Open add task modal from Focus 2.0 (legacy)
 */
function openFocus2AddTask() {
  toggleFocus2AddTask();
}

/**
 * v10.5.25: Open day view from mini calendar
 */
function openDayFromFocus2(dateStr) {
  if (typeof openDayView === 'function') {
    showView('rhythm');
    setTimeout(function() {
      openDayView(dateStr);
    }, 100);
  }
}

/**
 * v10.5.25: Toggle between Focus 2.0 and classic view
 */
function showOldFocusView() {
  var focus2 = document.getElementById('focus2Container');
  var classic = document.getElementById('focusClassicContainer');
  
  if (focus2 && classic) {
    if (focus2.style.display === 'none') {
      focus2.style.display = 'grid';
      classic.style.display = 'none';
    } else {
      focus2.style.display = 'none';
      classic.style.display = 'block';
    }
  }
}

/**
 * v10.5.25: Save Focus 2.0 notes (auto-save)
 */
function saveFocus2Notes() {
  var textarea = document.getElementById('focus2NotesInput');
  if (textarea) {
    var today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('roweos_focus_notes_' + today, textarea.value);
  }
}

/**
 * v10.5.25: Load Focus 2.0 notes for today
 */
function loadFocus2Notes() {
  var textarea = document.getElementById('focus2NotesInput');
  if (textarea) {
    var today = new Date().toISOString().slice(0, 10);
    textarea.value = localStorage.getItem('roweos_focus_notes_' + today) || '';
    // v13.4: Update date label to clarify notes are per-day
    var dateLabel = document.getElementById('focus2NotesDateText');
    if (dateLabel) {
      var d = new Date();
      dateLabel.textContent = 'Notes for ' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }
}

/**
 * v10.5.25: Clear Focus 2.0 notes
 */
function clearFocus2Notes() {
  var textarea = document.getElementById('focus2NotesInput');
  if (textarea) {
    if (confirm('Clear today\'s notes?')) {
      textarea.value = '';
      saveFocus2Notes();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// v12.2.4: JOURNAL SYSTEM
// ═══════════════════════════════════════════════════════════════

/**
 * v12.2.4: Initialize journal
 */
function initJournal() {
  var saved = localStorage.getItem('roweos_journal');
  if (saved) {
    try {
      window.journalEntries = JSON.parse(saved);
    } catch(e) {
      window.journalEntries = [];
    }
  } else {
    window.journalEntries = [];
  }
  updateJournalLink();
}

/**
 * v12.2.4: Save journal
 */
function saveJournal() {
  localStorage.setItem('roweos_journal', JSON.stringify(window.journalEntries || []));
  if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    writeDB('profile/main', { journal: window.journalEntries || [] });
  }
}

/**
 * v12.2.4: Save Today's Notes to Journal
 */
function saveNotesToJournal() {
  var textarea = document.getElementById('focus2NotesInput');
  if (!textarea || !textarea.value.trim()) {
    showToast('No notes to save', 'warning');
    return;
  }

  var now = new Date();
  var entryId = Date.now();
  var entry = {
    id: entryId,
    date: now.toISOString(),
    dateFormatted: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    content: textarea.value.trim(),
    mode: getCurrentMode(),
    source: 'focus' // v13.9: Track source
  };

  if (!window.journalEntries) window.journalEntries = [];
  window.journalEntries.unshift(entry);
  saveJournal();
  updateJournalLink();

  // v13.9: Sync to Pulse journal
  if (typeof pulse2JournalEntries !== 'undefined') {
    var pulseEntry = {
      id: entryId,
      date: now.toISOString().slice(0, 10),
      timestamp: now.toISOString(),
      text: textarea.value.trim(),
      subject: '',
      tag: '',
      mood: 'okay',
      source: 'focus'
    };
    pulse2JournalEntries.push(pulseEntry);
    localStorage.setItem('roweos_pulse2_entries', JSON.stringify(pulse2JournalEntries));
  }

  showToast('Saved to Journal', 'success');
}

/**
 * v12.2.4: Update journal link visibility
 */
function updateJournalLink() {
  var link = document.getElementById('focus2JournalLink');
  if (link) {
    link.style.display = (window.journalEntries && window.journalEntries.length > 0) ? 'block' : 'none';
  }
}

/**
 * v12.2.4: Render journal entries
 */
function renderJournal() {
  var container = document.getElementById('journalEntriesList');
  if (!container) return;

  var entries = window.journalEntries || [];

  if (entries.length === 0) {
    container.innerHTML = '<div class="journal-empty">' +
      '<div class="journal-empty-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>' +
      '<div>No journal entries yet.</div>' +
      '<div style="margin-top: 8px; font-size: var(--text-sm);">Save notes from Focus to start your journal.</div>' +
      '</div>';
    return;
  }

  var html = '';
  entries.forEach(function(entry, idx) {
    var preview = entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '');
    html += '<div class="journal-entry" onclick="toggleJournalEntry(' + idx + ')" data-entry-idx="' + idx + '">';
    html += '<div class="journal-entry-date">' + escapeHtml(entry.dateFormatted) + '</div>';
    html += '<div class="journal-entry-preview">' + escapeHtml(preview) + '</div>';
    html += '</div>';
    html += '<div class="journal-entry-expanded" id="journalEntry' + idx + '">';
    html += '<div class="journal-entry-full">' + escapeHtml(entry.content) + '</div>';
    html += '<div class="journal-entry-meta">';
    var sourceLabel = entry.source === 'pulse' ? 'Pulse' : entry.source === 'focus' ? 'Focus' : (entry.mode === 'life' ? 'LifeAI' : 'BrandAI');
    html += '<span style="font-size: var(--text-xs); color: var(--text-muted);">' + sourceLabel + '</span>';
    html += '<button class="focus-2-btn focus-2-btn-danger" style="padding: 6px 12px; font-size: var(--text-xs);" onclick="event.stopPropagation(); deleteJournalEntry(' + idx + ')">Delete</button>';
    html += '</div>';
    html += '</div>';
  });

  container.innerHTML = html;
}

/**
 * v12.2.4: Toggle journal entry expanded view
 */
function toggleJournalEntry(idx) {
  var el = document.getElementById('journalEntry' + idx);
  if (el) {
    var isShown = el.classList.contains('show');
    // Close all others
    document.querySelectorAll('.journal-entry-expanded').forEach(function(e) {
      e.classList.remove('show');
    });
    if (!isShown) {
      el.classList.add('show');
    }
  }
}

/**
 * v12.2.4: Delete journal entry
 */
function deleteJournalEntry(idx) {
  if (!confirm('Delete this journal entry?')) return;

  if (window.journalEntries && window.journalEntries[idx]) {
    window.journalEntries.splice(idx, 1);
    saveJournal();
    renderJournal();
    updateJournalLink();
    showToast('Entry deleted', 'success');
  }
}

// ═══════════════════════════════════════════════════════════════
// v12.2.4: PRIORITY TASKS
// ═══════════════════════════════════════════════════════════════

/**
 * v12.2.4: Toggle task priority from detail modal
 */
function toggleFocus2TaskPriority() {
  var taskId = window.currentFocus2TaskId;
  if (!taskId) return;

  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task) return;

  task.priority = !task.priority;
  saveTodos();

  // Update button state
  var btn = document.getElementById('focus2TaskDetailPriority');
  if (btn) {
    btn.classList.toggle('active', task.priority);
  }

  renderFocus2Categories();
  showToast(task.priority ? 'Marked as priority' : 'Priority removed', 'success');
}

// ═══════════════════════════════════════════════════════════════
// v12.2.4: RECURRING TASKS
// ═══════════════════════════════════════════════════════════════

/**
 * v12.2.4: Set task recurrence type
 */
function setTaskRecurrence(type) {
  var taskId = window.currentFocus2TaskId;
  if (!taskId) return;

  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task) return;

  // Update button states
  document.querySelectorAll('.focus-2-recurrence-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-recurrence') === type);
  });

  // Show/hide options
  var optionsEl = document.getElementById('focus2RecurrenceOptions');
  var weeklyDays = document.getElementById('focus2RecurrenceWeeklyDays');
  var customEl = document.getElementById('focus2RecurrenceCustom');

  if (type === 'none') {
    task.recurrence = null;
    if (optionsEl) optionsEl.classList.remove('visible');
  } else {
    if (!task.recurrence) {
      task.recurrence = { type: type, interval: 1, days: [], endDate: null };
    } else {
      task.recurrence.type = type;
    }

    if (optionsEl) optionsEl.classList.add('visible');
    if (weeklyDays) weeklyDays.style.display = type === 'weekly' ? 'block' : 'none';
    if (customEl) customEl.style.display = type === 'custom' ? 'block' : 'none';
  }

  saveTodos();
  renderFocus2Categories();
}

/**
 * v12.2.4: Toggle day for weekly recurrence
 */
function toggleRecurrenceDay(day) {
  var taskId = window.currentFocus2TaskId;
  if (!taskId) return;

  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task || !task.recurrence) return;

  if (!task.recurrence.days) task.recurrence.days = [];

  var idx = task.recurrence.days.indexOf(day);
  if (idx === -1) {
    task.recurrence.days.push(day);
  } else {
    task.recurrence.days.splice(idx, 1);
  }

  // Update UI
  var dayEl = document.querySelector('.focus-2-recurrence-day[data-day="' + day + '"]');
  if (dayEl) dayEl.classList.toggle('selected', idx === -1);

  saveTodos();
}

/**
 * v12.2.4: Update recurrence interval
 */
function updateTaskRecurrenceInterval() {
  var taskId = window.currentFocus2TaskId;
  if (!taskId) return;

  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task || !task.recurrence) return;

  var input = document.getElementById('focus2RecurrenceInterval');
  if (input) {
    task.recurrence.interval = parseInt(input.value) || 1;
    saveTodos();
  }
}

/**
 * v12.2.4: Update recurrence unit
 */
function updateTaskRecurrenceUnit() {
  var taskId = window.currentFocus2TaskId;
  if (!taskId) return;

  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task || !task.recurrence) return;

  var select = document.getElementById('focus2RecurrenceUnit');
  if (select) {
    task.recurrence.unit = select.value;
    saveTodos();
  }
}

/**
 * v12.2.4: Update recurrence end date
 */
function updateTaskRecurrenceEndDate() {
  var taskId = window.currentFocus2TaskId;
  if (!taskId) return;

  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task || !task.recurrence) return;

  var input = document.getElementById('focus2RecurrenceEndDate');
  if (input) {
    task.recurrence.endDate = input.value || null;
    saveTodos();
  }
}

/**
 * v12.2.4: Create next occurrence of recurring task when completed
 */
function createNextRecurringTask(task) {
  if (!task.recurrence || task.recurrence.type === 'none') return;

  var today = new Date();
  var nextDate = new Date(task.date || today);

  // Calculate next date based on recurrence type
  switch (task.recurrence.type) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'custom':
      var interval = task.recurrence.interval || 1;
      var unit = task.recurrence.unit || 'days';
      if (unit === 'days') nextDate.setDate(nextDate.getDate() + interval);
      else if (unit === 'weeks') nextDate.setDate(nextDate.getDate() + (interval * 7));
      else if (unit === 'months') nextDate.setMonth(nextDate.getMonth() + interval);
      break;
  }

  // Check if past end date
  if (task.recurrence.endDate && nextDate > new Date(task.recurrence.endDate)) {
    return; // Don't create if past end date
  }

  // Create new task
  var newTask = {
    id: Date.now(),
    text: task.text,
    date: nextDate.toISOString().slice(0, 10),
    category: task.category,
    brand: task.brand,
    isLife: task.isLife,
    notes: task.notes,
    priority: task.priority,
    recurrence: JSON.parse(JSON.stringify(task.recurrence)),
    completed: false,
    createdAt: new Date().toISOString()
  };

  todos.push(newTask);
  saveTodos();
}

// ═══════════════════════════════════════════════════════════════
// v12.2.4: CATEGORY SORTING
// ═══════════════════════════════════════════════════════════════

/**
 * v12.2.4: Get category sort preference
 */
function getCategorySortPreference() {
  return localStorage.getItem('roweos_category_sort') || 'manual';
}

/**
 * v12.2.4: Toggle category sort
 */
function toggleCategorySort() {
  var current = getCategorySortPreference();
  var next = current === 'manual' ? 'alphabetical' : 'manual';
  localStorage.setItem('roweos_category_sort', next);

  // Update button state
  var btn = document.querySelector('.focus-2-sort-btn');
  if (btn) btn.classList.toggle('active', next === 'alphabetical');

  renderFocus2Categories();
  showToast(next === 'alphabetical' ? 'Sorted A-Z' : 'Manual order', 'success');
}

/**
 * v12.2.4: Sort categories
 */
function getSortedCategories() {
  var categories = window.todoCategories || [];
  var sortPref = getCategorySortPreference();

  if (sortPref === 'alphabetical') {
    return categories.slice().sort(function(a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  return categories;
}

// ═══════════════════════════════════════════════════════════════
// v12.2.4: INLINE AUTOMATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * v12.2.4: Show inline automation creator
 */
function showInlineAutomation(categoryName) {
  // Close any existing
  document.querySelectorAll('.focus-2-automation-inline').forEach(function(el) {
    el.remove();
  });

  var card = document.querySelector('.focus-2-category-card[data-category="' + categoryName.replace(/"/g, '\\"') + '"]');
  if (!card) return;

  var html = '<div class="focus-2-automation-inline" onclick="event.stopPropagation()">';
  html += '<div class="focus-2-automation-inline-header">';
  html += '<div class="focus-2-automation-inline-title">Quick Automation</div>';
  html += '<button onclick="event.stopPropagation(); this.closest(\'.focus-2-automation-inline\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">×</button>';
  html += '</div>';
  html += '<div class="focus-2-automation-field">';
  html += '<label>When</label>';
  html += '<select id="inlineAutoTrigger">';
  html += '<option value="time">At a specific time</option>';
  html += '<option value="complete">When task completed</option>';
  html += '<option value="daily">Daily</option>';
  html += '<option value="weekly">Weekly</option>';
  html += '</select>';
  html += '</div>';
  html += '<div class="focus-2-automation-field">';
  html += '<label>Then</label>';
  html += '<select id="inlineAutoAction">';
  html += '<option value="notify">Send notification</option>';
  html += '<option value="reminder">Show reminder popup</option>';
  html += '<option value="create">Create a task</option>';
  html += '<option value="message">Send to AI</option>';
  html += '</select>';
  html += '</div>';
  html += '<div class="focus-2-automation-field" id="inlineAutoTimeField">';
  html += '<label>Time</label>';
  html += '<input type="time" id="inlineAutoTime" value="09:00">';
  html += '</div>';
  html += '<div class="focus-2-automation-field">';
  html += '<label>Description</label>';
  html += '<input type="text" id="inlineAutoDesc" placeholder="e.g., Review ' + escapeHtml(categoryName) + ' tasks">';
  html += '</div>';
  html += '<div style="display:flex;gap:8px;margin-top:var(--space-3);">';
  html += '<button class="focus-2-btn" onclick="event.stopPropagation(); this.closest(\'.focus-2-automation-inline\').remove()">Cancel</button>';
  html += '<button class="focus-2-btn focus-2-btn-primary" onclick="event.stopPropagation(); saveCategoryInlineAutomation(\'' + escapeHtml(categoryName) + '\')">Create</button>';
  html += '</div>';
  html += '</div>';

  card.insertAdjacentHTML('beforeend', html);
}

/**
 * v12.2.4: Save inline automation (Focus2 category) - v24.27: renamed to avoid Rhythm collision
 */
function saveCategoryInlineAutomation(categoryName) {
  var trigger = document.getElementById('inlineAutoTrigger') ? document.getElementById('inlineAutoTrigger').value : 'time';
  var action = document.getElementById('inlineAutoAction') ? document.getElementById('inlineAutoAction').value : 'notify';
  var time = document.getElementById('inlineAutoTime') ? document.getElementById('inlineAutoTime').value : '09:00';
  var desc = document.getElementById('inlineAutoDesc') ? document.getElementById('inlineAutoDesc').value : 'Automation for ' + categoryName;
  if (!desc) desc = 'Automation for ' + categoryName;

  var todayStr = new Date().toISOString().slice(0, 10);
  var automation = {
    id: Date.now(),
    name: desc,
    trigger: trigger,
    action: action,
    time: time,
    category: categoryName,
    enabled: true,
    mode: getCurrentMode(),
    scheduledDate: todayStr,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString() // v24.14: Required for sync merge
  };

  // v12.2.6: Save to both roweos_automations and roweos_scheduled_tasks
  var automations = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
  automations.push(automation);
  localStorage.setItem('roweos_automations', JSON.stringify(automations));

  // Also add to scheduled tasks so it shows in the Focus automations widget
  var scheduled = getScheduledTasks();
  scheduled.push(automation);
  saveScheduledTasks(scheduled);

  // Close the inline form
  document.querySelectorAll('.focus-2-automation-inline').forEach(function(el) {
    el.remove();
  });

  // Refresh automations widget
  renderFocus2Automations();
  showToast('Automation created', 'success');
  // v25.1: saveScheduledTasks() already writes through to Firestore
}

/**
 * v10.5.25: Send notes to Pulse journal
 */
function sendNotesToPulse() {
  var textarea = document.getElementById('focus2NotesInput');
  if (!textarea || !textarea.value.trim()) {
    showToast('No notes to send', 'warning');
    return;
  }
  
  var today = new Date().toISOString().slice(0, 10);
  var journal = JSON.parse(localStorage.getItem('roweos_pulse_journal') || '[]');
  
  // Find or create today's entry
  var todayEntry = journal.find(function(e) { return e.date === today; });
  if (!todayEntry) {
    todayEntry = { date: today, notes: '', tasks: [], createdAt: new Date().toISOString() };
    journal.push(todayEntry);
  }
  
  todayEntry.notes = textarea.value;
  todayEntry.updatedAt = new Date().toISOString();
  
  // Also save completed tasks
  var completedToday = todos.filter(function(t) { return t.date === today && t.completed; });
  todayEntry.tasks = completedToday.map(function(t) { return { text: t.text, completedAt: t.completedAt }; });
  
  localStorage.setItem('roweos_pulse_journal', JSON.stringify(journal));
  showToast('Notes saved to Pulse journal', 'success');
}

function updateFocusStats() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  
  var filteredTodos = todoFilterMode === 'brand' 
    ? todos.filter(function(t) { return t.brand === brand.name; })
    : todos;
  
  var activeTodos = filteredTodos.filter(function(t) { return !t.completed; }).length;
  var completedToday = todos.filter(function(t) {
    if (!t.completed || !t.completedAt) return false;
    var today = new Date();
    var completedDate = new Date(t.completedAt);
    return completedDate.toDateString() === today.toDateString();
  }).length;
  
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  var upcomingCount = calendar.filter(function(item) {
    var itemDate = new Date(item.date);
    var matchesBrand = todoFilterMode === 'brand' ? item.brand === brand.name : true;
    return itemDate >= today && itemDate <= nextWeek && item.status !== 'completed' && matchesBrand;
  }).length;
  
  // Calculate streak
  var streak = parseInt(localStorage.getItem('roweosStreak') || '0');
  
  var statTodo = document.getElementById('statTodoCount');
  var statUpcoming = document.getElementById('statUpcoming');
  var statCompleted = document.getElementById('statCompletedToday');
  var statStreak = document.getElementById('statStreak');
  
  if (statTodo) statTodo.textContent = activeTodos;
  if (statUpcoming) statUpcoming.textContent = upcomingCount;
  if (statCompleted) statCompleted.textContent = completedToday;
  if (statStreak) statStreak.textContent = streak;
}

// v26.1: Update persistent header stat badges
function updateFocusPersistentStats() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];

  var activeTodos = todos.filter(function(t) {
    return !t.completed && (todoFilterMode === 'brand' ? t.brand === brand.name : true);
  }).length;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var todayEvents = calendar.filter(function(item) {
    var d = new Date(item.date);
    return d >= today && d < tomorrow;
  }).length;

  var reminders = [];
  try { var _rRaw = JSON.parse(localStorage.getItem('roweos_reminders') || '[]'); if (Array.isArray(_rRaw)) reminders = _rRaw; } catch(e) {}
  var activeReminders = reminders.filter(function(r) { return r.status === 'pending' || r.status === 'snoozed'; }).length;

  var el;
  el = document.getElementById('focusStatTasks');
  if (el) el.textContent = activeTodos;
  el = document.getElementById('focusStatEvents');
  if (el) el.textContent = todayEvents;
  el = document.getElementById('focusStatReminders');
  if (el) el.textContent = activeReminders;
}

// v26.1: Render Today & Upcoming pill
function renderFocusTodayView() {
  renderFocusAIBriefing();
  renderFocusSourceCards();
}

// v26.1: Render the 4 source-grouped cards
function renderFocusSourceCards() {
  renderFocusSourceCalendar();
  renderFocusSourceTasks();
  renderFocusSourceAutomations();
  renderFocusSourceReminders();
}

function renderFocusSourceCalendar() {
  var container = document.getElementById('focusSourceCalendar');
  if (!container) return;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  var calColors = {};
  try { calColors = JSON.parse(localStorage.getItem('roweos_calendar_colors') || '{}'); } catch(e) {}

  var todayEvents = calendar.filter(function(item) {
    var d = new Date(item.date);
    return d >= today && d < tomorrow;
  }).sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

  var upcomingEvents = calendar.filter(function(item) {
    var d = new Date(item.date);
    return d >= tomorrow && d < nextWeek;
  }).sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

  var html = '<div class="focus-source-card-title">Calendar Events</div>';

  if (todayEvents.length === 0 && upcomingEvents.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No events scheduled</div>';
  }

  for (var i = 0; i < todayEvents.length; i++) {
    var ev = todayEvents[i];
    var color = calColors[ev.calendarName || ev.source || 'default'] || '#a89878';
    var time = new Date(ev.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    html += '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">';
    html += '<div style="width:3px;height:28px;background:' + escapeHtml(color) + ';border-radius:2px;flex-shrink:0;margin-top:1px;"></div>';
    html += '<div><div style="font-size:12px;color:var(--text-secondary);">' + escapeHtml(ev.title || ev.name || 'Event') + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(time) + '</div></div></div>';
  }

  if (upcomingEvents.length > 0) {
    html += '<div class="focus-source-divider">';
    var upcomingText = upcomingEvents.slice(0, 3).map(function(ev) {
      var day = new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short' });
      return day + ': ' + (ev.title || ev.name || 'Event');
    }).join(' / ');
    html += '<div style="font-size:11px;color:var(--text-muted);">' + escapeHtml(upcomingText) + '</div></div>';
  }

  container.innerHTML = html;
}

function renderFocusSourceTasks() {
  var container = document.getElementById('focusSourceTasks');
  if (!container) return;

  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  var activeTodos = todos.filter(function(t) {
    return !t.completed && (todoFilterMode === 'brand' ? t.brand === brand.name : true);
  });

  var todayTodos = activeTodos.filter(function(t) {
    if (!t.dueDate) return false;
    var d = new Date(t.dueDate);
    d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  });

  var upcomingTodos = activeTodos.filter(function(t) {
    if (!t.dueDate) return false;
    var d = new Date(t.dueDate);
    d.setHours(0,0,0,0);
    return d > today && d < nextWeek;
  }).sort(function(a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });

  var noDueTodos = activeTodos.filter(function(t) { return !t.dueDate; });

  var html = '<div class="focus-source-card-title">Tasks Due</div>';

  var allItems = todayTodos.concat(upcomingTodos);
  if (allItems.length === 0 && noDueTodos.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No tasks due</div>';
  }

  for (var i = 0; i < todayTodos.length; i++) {
    var t = todayTodos[i];
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
    html += '<div style="width:11px;height:11px;border:1.5px solid var(--brand-accent, #a89878);border-radius:3px;flex-shrink:0;cursor:pointer;" onclick="toggleFocusSourceTask(\'' + escapeHtml(t.id) + '\')"></div>';
    html += '<div style="font-size:12px;color:var(--text-secondary);flex:1;">' + escapeHtml(t.text) + '</div>';
    html += '<div style="font-size:10px;color:var(--brand-accent, #a89878);">Today</div></div>';
  }

  for (var j = 0; j < Math.min(upcomingTodos.length, 4); j++) {
    var u = upcomingTodos[j];
    var day = new Date(u.dueDate).toLocaleDateString('en-US', { weekday: 'short' });
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
    html += '<div style="width:11px;height:11px;border:1.5px solid var(--text-muted);border-radius:3px;flex-shrink:0;cursor:pointer;opacity:0.5;" onclick="toggleFocusSourceTask(\'' + escapeHtml(u.id) + '\')"></div>';
    html += '<div style="font-size:12px;color:var(--text-muted);flex:1;">' + escapeHtml(u.text) + '</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(day) + '</div></div>';
  }

  container.innerHTML = html;
}

function toggleFocusSourceTask(taskId) {
  for (var i = 0; i < todos.length; i++) {
    if (todos[i].id === taskId) {
      todos[i].completed = true;
      todos[i].completedAt = new Date().toISOString();
      todos[i]._modifiedAt = Date.now();
      break;
    }
  }
  saveTodos();
  renderFocusSourceTasks();
  updateFocusPersistentStats();
}

function renderFocusSourceAutomations() {
  var container = document.getElementById('focusSourceAutomations');
  if (!container) return;

  var completed = [];
  try { completed = JSON.parse(localStorage.getItem('roweos_completed_automations') || '[]'); } catch(e) {}
  var scheduled = [];
  try { scheduled = typeof getScheduledTasks === 'function' ? getScheduledTasks() : []; } catch(e) {}

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  var todayCompleted = completed.filter(function(a) {
    if (!a.completedAt) return false;
    var d = new Date(a.completedAt);
    return d >= today && d < tomorrow;
  });

  var html = '<div class="focus-source-card-title">Automations</div>';

  if (todayCompleted.length === 0 && scheduled.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No automations today</div>';
  }

  for (var i = 0; i < todayCompleted.length; i++) {
    var c = todayCompleted[i];
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer;" onclick="viewCompletedAutomation(\'' + escapeHtml(c.id || '') + '\')">';
    html += '<div style="width:6px;height:6px;background:#4ade80;border-radius:50%;flex-shrink:0;"></div>';
    html += '<div style="font-size:12px;color:var(--text-secondary);flex:1;">' + escapeHtml(c.name || c.title || 'Automation') + '</div>';
    html += '<div style="font-size:10px;color:#4ade80;">Done</div></div>';
  }

  for (var j = 0; j < Math.min(scheduled.length, 3); j++) {
    var s = scheduled[j];
    var time = s.time || '';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
    html += '<div style="width:6px;height:6px;background:rgba(255,255,255,0.2);border-radius:50%;flex-shrink:0;"></div>';
    html += '<div style="font-size:12px;color:var(--text-muted);flex:1;">' + escapeHtml(s.name || s.title || 'Automation') + '</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(time) + '</div></div>';
  }

  container.innerHTML = html;
}

function renderFocusSourceReminders() {
  var container = document.getElementById('focusSourceReminders');
  if (!container) return;

  var reminders = [];
  try { var _rRaw = JSON.parse(localStorage.getItem('roweos_reminders') || '[]'); if (Array.isArray(_rRaw)) reminders = _rRaw; } catch(e) {}

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  var active = reminders.filter(function(r) {
    return r.status === 'pending' || r.status === 'snoozed';
  }).sort(function(a, b) { return new Date(a.scheduledAt) - new Date(b.scheduledAt); });

  var html = '<div class="focus-source-card-title">Reminders</div>';

  if (active.length === 0) {
    html += '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No active reminders</div>';
  }

  for (var i = 0; i < Math.min(active.length, 5); i++) {
    var r = active[i];
    var rDate = new Date(r.scheduledAt);
    var isToday = rDate >= today && rDate < new Date(today.getTime() + 86400000);
    var timeStr = isToday
      ? rDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : rDate.toLocaleDateString('en-US', { weekday: 'short' });
    var dotColor = isToday ? '#fbbf24' : 'rgba(255,255,255,0.2)';
    var textColor = isToday ? 'var(--text-secondary)' : 'var(--text-muted)';
    var timeColor = isToday ? '#fbbf24' : 'var(--text-muted)';

    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
    html += '<div style="width:6px;height:6px;background:' + dotColor + ';border-radius:50%;flex-shrink:0;"></div>';
    html += '<div style="font-size:12px;color:' + textColor + ';flex:1;">' + escapeHtml(r.title) + '</div>';
    html += '<div style="font-size:10px;color:' + timeColor + ';">' + escapeHtml(timeStr) + '</div></div>';
  }

  container.innerHTML = html;
}

// v26.1: Focus Tasks pill
function renderFocusTasksView() {
  renderFocusCategoryPills();
  renderFocusCategoryList();
}

function renderFocusCategoryPills() {
  var container = document.getElementById('focusCategoryPills');
  if (!container) return;

  // Show/hide AI Categories button based on whether categories exist
  var aiBtn = document.getElementById('focusAICategoriesBtn');
  if (aiBtn) aiBtn.style.display = window.todoCategories.length === 0 ? '' : 'none';

  var activeFilter = window._focusCategoryFilter || 'all';
  var html = '';

  // "All" pill
  var allCls = activeFilter === 'all' ? ' active' : '';
  html += '<div class="focus-category-pill' + allCls + '" style="background:rgba(168,152,120,' + (activeFilter === 'all' ? '0.2' : '0.08') + ');border-color:rgba(168,152,120,' + (activeFilter === 'all' ? '0.3' : '0.15') + ');color:#a89878;" onclick="filterFocusCategory(\'all\')">' +
    'All</div>';

  // Category pills
  for (var i = 0; i < window.todoCategories.length; i++) {
    var cat = window.todoCategories[i];
    var isActive = activeFilter === cat.name;
    var opacity = isActive ? '0.2' : '0.1';
    var borderOpacity = isActive ? '0.35' : '0.2';
    html += '<div class="focus-category-pill' + (isActive ? ' active' : '') + '" style="background:rgba(' + hexToRgbStr(cat.color) + ',' + opacity + ');border-color:rgba(' + hexToRgbStr(cat.color) + ',' + borderOpacity + ');color:' + escapeHtml(cat.color) + ';" onclick="filterFocusCategory(\'' + escapeHtml(cat.name) + '\')">' +
      escapeHtml(cat.name) + '</div>';
  }

  // "+ New" pill
  html += '<div class="focus-category-pill" style="background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08);color:var(--text-muted);" onclick="promptNewFocusCategory()">+ New</div>';

  container.innerHTML = html;
}

// Helper: hex color to "r,g,b" string (uses existing hexToRgb which returns {r,g,b} object)
function hexToRgbStr(hex) {
  var rgb = hexToRgb(hex);
  return rgb ? (rgb.r + ',' + rgb.g + ',' + rgb.b) : '255,255,255';
}

function filterFocusCategory(name) {
  window._focusCategoryFilter = name;
  renderFocusCategoryPills();
  renderFocusCategoryList();
}

function renderFocusCategoryList() {
  var container = document.getElementById('focusCategoryList');
  if (!container) return;

  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var filter = window._focusCategoryFilter || 'all';

  var activeTodos = todos.filter(function(t) {
    return !t.completed && (todoFilterMode === 'brand' ? t.brand === brand.name : true);
  });

  var html = '';

  // Build category groups
  var categories = window.todoCategories.slice();
  if (filter !== 'all') {
    categories = categories.filter(function(c) { return c.name === filter; });
  }

  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var catTodos = activeTodos.filter(function(t) { return t.category === cat.name; });
    if (catTodos.length === 0 && filter === 'all') continue;

    // Sort by due date
    catTodos.sort(function(a, b) {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    html += '<div class="focus-category-group">';
    html += '<div class="focus-category-group-header">';
    html += '<div class="focus-category-color" style="background:' + escapeHtml(cat.color) + ';"></div>';
    html += '<div class="focus-category-name">' + escapeHtml(cat.name) + '</div>';
    html += '<div class="focus-category-count">' + catTodos.length + '</div>';
    html += '<div class="focus-category-line"></div></div>';

    for (var j = 0; j < catTodos.length; j++) {
      var t = catTodos[j];
      var dueStr = '';
      var dueClass = '';
      if (t.dueDate) {
        var d = new Date(t.dueDate);
        var today = new Date();
        today.setHours(0,0,0,0);
        d.setHours(0,0,0,0);
        if (d.getTime() === today.getTime()) {
          dueStr = 'Today';
          dueClass = ' today';
        } else {
          dueStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        }
      }

      html += '<div class="focus-task-row">';
      html += '<div class="focus-task-checkbox" style="border-color:' + escapeHtml(cat.color) + ';" onclick="toggleFocusSourceTask(\'' + escapeHtml(t.id) + '\')"></div>';
      html += '<div class="focus-task-text">' + escapeHtml(t.text) + '</div>';
      if (t.brand) html += '<div class="focus-task-brand-tag">' + escapeHtml(t.brand) + '</div>';
      if (dueStr) html += '<div class="focus-task-due' + dueClass + '">' + escapeHtml(dueStr) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Uncategorized ("Other")
  if (filter === 'all') {
    var uncategorized = activeTodos.filter(function(t) {
      return !t.category || !window.todoCategories.some(function(c) { return c.name === t.category; });
    });
    if (uncategorized.length > 0) {
      html += '<div class="focus-category-group">';
      html += '<div class="focus-category-group-header">';
      html += '<div class="focus-category-color" style="background:rgba(255,255,255,0.2);"></div>';
      html += '<div class="focus-category-name">Other</div>';
      html += '<div class="focus-category-count">' + uncategorized.length + '</div>';
      html += '<div class="focus-category-line"></div></div>';
      for (var k = 0; k < uncategorized.length; k++) {
        var ut = uncategorized[k];
        var utDue = '';
        var utClass = '';
        if (ut.dueDate) {
          var ud = new Date(ut.dueDate);
          var utToday = new Date();
          utToday.setHours(0,0,0,0);
          ud.setHours(0,0,0,0);
          utDue = ud.getTime() === utToday.getTime() ? 'Today' : ud.toLocaleDateString('en-US', { weekday: 'short' });
          utClass = ud.getTime() === utToday.getTime() ? ' today' : '';
        }
        html += '<div class="focus-task-row">';
        html += '<div class="focus-task-checkbox" onclick="toggleFocusSourceTask(\'' + escapeHtml(ut.id) + '\')"></div>';
        html += '<div class="focus-task-text">' + escapeHtml(ut.text) + '</div>';
        if (ut.brand) html += '<div class="focus-task-brand-tag">' + escapeHtml(ut.brand) + '</div>';
        if (utDue) html += '<div class="focus-task-due' + utClass + '">' + escapeHtml(utDue) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }
  }

  if (!html) {
    html = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">No tasks yet. Add a task or use AI Categories to get started.</div>';
  }

  container.innerHTML = html;
}

function promptNewFocusCategory() {
  var name = prompt('Category name:');
  if (!name || !name.trim()) return;
  // Pick a color from a preset rotation
  var colors = ['#a78bfa', '#4ade80', '#fbbf24', '#f472b6', '#22d3ee', '#fb923c', '#a3e635'];
  var color = colors[window.todoCategories.length % colors.length];
  window.todoCategories.push({ name: name.trim(), color: color });
  saveTodoCategories();
  renderFocusTasksView();
}

function addTodoFromFocusTasks() {
  var text = prompt('Task:');
  if (!text || !text.trim()) return;
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var newTodo = {
    id: 'todo_' + Date.now(),
    text: text.trim(),
    brand: brand.name,
    category: '',
    completed: false,
    createdAt: Date.now(),
    notes: '',
    dueDate: '',
    assignedTo: '',
    _modifiedAt: Date.now()
  };
  todos.push(newTodo);
  saveTodos();
  renderFocusTasksView();
  updateFocusPersistentStats();
}

// v26.1: AI-powered category suggestions
function generateAICategories() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var activeTodos = todos.filter(function(t) { return !t.completed; });

  if (activeTodos.length === 0) {
    showToast('No tasks to categorize', 'info');
    return;
  }

  var taskList = activeTodos.map(function(t) {
    return t.text + (t.brand ? ' (' + t.brand + ')' : '');
  }).join(', ');

  var prompt = 'Given these tasks across brands: ' + taskList + '. ' +
    'Suggest 3-5 functional categories that group them (e.g., Marketing, Operations, Finance, Content, Strategy). ' +
    'Also assign each task to a category. ' +
    'Format as JSON: {"categories":["name1","name2"],"assignments":{"task text":"category name"}}';

  showToast('Generating categories...', 'info');

  try {
    var callback = function(response) {
      try {
        var jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON');
        var data = JSON.parse(jsonMatch[0]);

        if (!data.categories || !Array.isArray(data.categories)) throw new Error('Invalid format');

        // Show confirmation
        var msg = 'AI suggests these categories:\n\n' + data.categories.join(', ') + '\n\nApply these categories?';
        if (!confirm(msg)) return;

        // Create categories
        var colors = ['#a78bfa', '#4ade80', '#fbbf24', '#f472b6', '#22d3ee', '#fb923c', '#a3e635'];
        for (var i = 0; i < data.categories.length; i++) {
          var exists = window.todoCategories.some(function(c) { return c.name === data.categories[i]; });
          if (!exists) {
            window.todoCategories.push({
              name: data.categories[i],
              color: colors[window.todoCategories.length % colors.length]
            });
          }
        }
        saveTodoCategories();

        // Assign tasks
        if (data.assignments) {
          for (var j = 0; j < todos.length; j++) {
            var assigned = data.assignments[todos[j].text];
            if (assigned && data.categories.indexOf(assigned) !== -1) {
              todos[j].category = assigned;
            }
          }
          saveTodos();
        }

        renderFocusTasksView();
        showToast('Categories created and tasks assigned', 'success');
      } catch(e) {
        showToast('Could not generate categories', 'error');
      }
    };

    var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
    var provider = settings.provider || brand.provider || 'anthropic';
    var aiModel = settings.model || brand.model || 'claude-sonnet-4-6';
    getApiKey(provider).then(function(apiKey) {
      if (!apiKey) { showToast('No API key configured', 'error'); return; }
      callBrandAIGeneratorAPI(provider, aiModel, apiKey, prompt).then(callback).catch(function() {
        showToast('Could not generate categories', 'error');
      });
    }).catch(function() { showToast('Could not load API key', 'error'); });
  } catch(e) {
    showToast('Could not generate categories', 'error');
  }
}

// v26.1: AI Briefing Card
function renderFocusAIBriefing() {
  var container = document.getElementById('focusBriefingCard');
  if (!container) return;

  // Check cache -- generate once per day
  var cached = null;
  try {
    var raw = localStorage.getItem('roweos_focus_briefing');
    if (raw) {
      cached = JSON.parse(raw);
      var today = new Date().toDateString();
      if (cached.date !== today) cached = null;
    }
  } catch(e) { cached = null; }

  if (cached && cached.html) {
    container.innerHTML = cached.html;
    return;
  }

  // Show loading state
  container.innerHTML = '<div class="focus-briefing-card">' +
    '<div class="focus-briefing-header">' +
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>' +
    '<span class="focus-briefing-title">Daily Briefing</span>' +
    '<span class="focus-briefing-time">Generating...</span></div>' +
    '<div class="focus-briefing-summary" style="color:var(--text-muted);">Analyzing your day...</div></div>';

  generateFocusBriefing();
}

function generateFocusBriefing() {
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];

  var mode = localStorage.getItem('roweos_app_mode') || 'brand';
  // Collect context -- in life mode, don't filter by brand
  var activeTodos = todos.filter(function(t) {
    if (t.completed) return false;
    return mode === 'brand' ? t.brand === brand.name : true;
  });
  var today = new Date();
  today.setHours(0,0,0,0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var todayEvents = calendar.filter(function(item) {
    var d = new Date(item.date);
    return d >= today && d < tomorrow;
  });

  var reminders = [];
  try { var _rRaw = JSON.parse(localStorage.getItem('roweos_reminders') || '[]'); if (Array.isArray(_rRaw)) reminders = _rRaw; } catch(e) {}
  var activeReminders = reminders.filter(function(r) { return r.status === 'pending' || r.status === 'snoozed'; });

  var completed = [];
  try { completed = JSON.parse(localStorage.getItem('roweos_completed_automations') || '[]'); } catch(e) {}
  var todayCompleted = completed.filter(function(a) {
    if (!a.completedAt) return false;
    var d = new Date(a.completedAt);
    return d >= today && d < tomorrow;
  });

  var hour = new Date().getHours();
  var timeContext = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  var systemPrompt = 'You are a daily briefing assistant for ' + (mode === 'brand' ? brand.name : 'personal life management') + '.';
  var userPrompt = 'Time of day: ' + timeContext + '. ' +
    'Today: ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '. ' +
    'Active tasks (' + activeTodos.length + '): ' + activeTodos.slice(0, 8).map(function(t) { return t.text + (t.dueDate ? ' (due ' + t.dueDate + ')' : ''); }).join(', ') + '. ' +
    'Calendar events (' + todayEvents.length + '): ' + todayEvents.map(function(e) { return (e.title || e.name) + ' at ' + new Date(e.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }).join(', ') + '. ' +
    'Reminders (' + activeReminders.length + '): ' + activeReminders.slice(0, 3).map(function(r) { return r.title; }).join(', ') + '. ' +
    'Completed automations today: ' + todayCompleted.map(function(a) { return a.name || a.title; }).join(', ') + '. ' +
    'Give a brief daily briefing (2-3 sentences), then 2-3 actionable insights. ' +
    'Format as JSON: {"summary":"...","insights":[{"type":"trend|alert|done","title":"...","desc":"..."}]}';

  try {
    if (mode === 'life' && typeof callLifeAIForGoal === 'function') {
      // Life mode: callLifeAIForGoal(systemPrompt, userPrompt, onSuccess, onError)
      callLifeAIForGoal(systemPrompt, userPrompt,
        function(response) { processBriefingResponse(response); },
        function(err) { renderBriefingFallback(); }
      );
    } else {
      // Brand mode: get provider/model/apiKey, then call API
      var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
      var provider = settings.provider || brand.provider || 'anthropic';
      var aiModel = settings.model || brand.model || 'claude-sonnet-4-6';
      getApiKey(provider).then(function(apiKey) {
        if (!apiKey) { renderBriefingFallback(); return; }
        callBrandAIGeneratorAPI(provider, aiModel, apiKey, systemPrompt + '\n\n' + userPrompt).then(function(response) {
          processBriefingResponse(response);
        }).catch(function() { renderBriefingFallback(); });
      }).catch(function() { renderBriefingFallback(); });
    }
  } catch(e) {
    renderBriefingFallback();
  }
}

function processBriefingResponse(response) {
  var container = document.getElementById('focusBriefingCard');
  if (!container) return;

  var data = null;
  try {
    // Try to extract JSON from response
    var jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) data = JSON.parse(jsonMatch[0]);
  } catch(e) {}

  if (!data || !data.summary) {
    // Use raw text as summary if JSON parsing fails
    data = { summary: response, insights: [] };
  }

  var html = buildBriefingHTML(data);

  // Cache
  try {
    localStorage.setItem('roweos_focus_briefing', JSON.stringify({
      date: new Date().toDateString(),
      html: html
    }));
  } catch(e) {}

  container.innerHTML = html;
}

function buildBriefingHTML(data) {
  var now = new Date();
  var timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  var html = '<div class="focus-briefing-card">';
  html += '<div class="focus-briefing-header">';
  html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>';
  html += '<span class="focus-briefing-title">Daily Briefing</span>';
  html += '<span class="focus-briefing-time">' + escapeHtml(timeStr) + '</span></div>';
  html += '<div class="focus-briefing-summary">' + escapeHtml(data.summary) + '</div>';

  if (data.insights && data.insights.length > 0) {
    html += '<div class="focus-briefing-insights">';
    var iconMap = {
      trend: { bg: 'rgba(74,222,128,0.15)', svg: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' },
      alert: { bg: 'rgba(251,191,36,0.15)', svg: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' },
      done: { bg: 'rgba(34,211,238,0.15)', svg: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' }
    };

    for (var i = 0; i < data.insights.length; i++) {
      var insight = data.insights[i];
      var icon = iconMap[insight.type] || iconMap.alert;
      html += '<div class="focus-insight-item">';
      html += '<div class="focus-insight-icon" style="background:' + icon.bg + ';">' + icon.svg + '</div>';
      html += '<div><div class="focus-insight-title">' + escapeHtml(insight.title) + '</div>';
      html += '<div class="focus-insight-desc">' + escapeHtml(insight.desc) + '</div></div></div>';
    }
    html += '</div>';
  }

  // Inline chat
  html += '<div class="focus-inline-chat">';
  html += '<input type="text" id="focusChatInput" placeholder="Ask about your day..." onkeydown="if(event.key===\'Enter\')sendFocusAIChat()">';
  html += '<button class="focus-chat-send-btn" onclick="sendFocusAIChat()">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
  html += '</button></div>';

  html += '</div>';
  return html;
}

function renderBriefingFallback() {
  var container = document.getElementById('focusBriefingCard');
  if (!container) return;

  container.innerHTML = '<div class="focus-briefing-card"><div class="focus-briefing-error">' +
    'Could not generate briefing' +
    '<br><button class="focus-briefing-retry-btn" onclick="renderFocusAIBriefing()">Retry</button>' +
    '</div></div>';
}

// v26.1: Focus inline chat
var _focusChatHistory = [];

function sendFocusAIChat() {
  var input = document.getElementById('focusChatInput');
  if (!input || !input.value.trim()) return;

  var message = input.value.trim();
  input.value = '';

  // Show chat messages area (inside briefing card)
  var chatArea = document.getElementById('focusChatMessages');
  if (!chatArea) {
    // Create chat messages container inside briefing card if not yet present
    var briefingCard = document.querySelector('.focus-briefing-card');
    if (briefingCard) {
      var chatDiv = document.createElement('div');
      chatDiv.id = 'focusChatMessages';
      chatDiv.className = 'focus-chat-messages';
      var chatInput = briefingCard.querySelector('.focus-inline-chat');
      if (chatInput) briefingCard.insertBefore(chatDiv, chatInput);
      chatArea = chatDiv;
    }
  }
  if (chatArea) chatArea.style.display = 'flex';

  // Add user message
  _focusChatHistory.push({ role: 'user', text: message });
  renderFocusChatMessages();

  // Build context
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var activeTodos = todos.filter(function(t) { return !t.completed && t.brand === brand.name; });

  var sysPrompt = 'You are a Focus assistant for ' + brand.name + '. ' +
    'Active tasks: ' + activeTodos.slice(0, 5).map(function(t) { return t.text; }).join(', ') + '. ' +
    'Answer briefly and actionably.';

  try {
    var mode = localStorage.getItem('roweos_app_mode') || 'brand';
    var onSuccess = function(response) {
      _focusChatHistory.push({ role: 'ai', text: response });
      renderFocusChatMessages();
    };

    if (mode === 'life' && typeof callLifeAIForGoal === 'function') {
      callLifeAIForGoal(sysPrompt, message, onSuccess, function(err) {
        _focusChatHistory.push({ role: 'ai', text: 'Error: ' + (err || 'AI not available') });
        renderFocusChatMessages();
      });
    } else {
      var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
      var provider = settings.provider || brand.provider || 'anthropic';
      var aiModel = settings.model || brand.model || 'claude-sonnet-4-6';
      getApiKey(provider).then(function(apiKey) {
        if (!apiKey) {
          _focusChatHistory.push({ role: 'ai', text: 'No API key configured. Check Settings.' });
          renderFocusChatMessages();
          return;
        }
        callBrandAIGeneratorAPI(provider, aiModel, apiKey, sysPrompt + '\n\nUser: ' + message).then(onSuccess).catch(function(err) {
          _focusChatHistory.push({ role: 'ai', text: 'Error: ' + (err.message || 'Request failed') });
          renderFocusChatMessages();
        });
      }).catch(function() {
        _focusChatHistory.push({ role: 'ai', text: 'Could not load API key.' });
        renderFocusChatMessages();
      });
    }
  } catch(e) {
    showToast('Chat error: ' + e.message, 'error');
  }
}

function renderFocusChatMessages() {
  var chatArea = document.getElementById('focusChatMessages');
  if (!chatArea) return;

  var html = '';
  for (var i = 0; i < _focusChatHistory.length; i++) {
    var msg = _focusChatHistory[i];
    var cls = msg.role === 'user' ? 'focus-chat-msg-user' : 'focus-chat-msg-ai';
    html += '<div class="' + cls + '">' + escapeHtml(msg.text) + '</div>';
  }
  chatArea.innerHTML = html;
  chatArea.scrollTop = chatArea.scrollHeight;
}

// v9.1.14: Focus Brand Filter - now shows all brands in dropdown
var todoFilterBrand = 'all'; // 'all' or specific brand name

function toggleFocusBrandFilter() {
  var dropdown = document.getElementById('focusBrandFilterDropdown');
  if (!dropdown) return;
  
  // Populate brand list
  var listContainer = document.getElementById('focusBrandFilterList');
  if (listContainer) {
    var html = '';
    brands.forEach(function(brand) {
      var isActive = todoFilterBrand === brand.name ? ' style="color: var(--accent-gold);"' : '';
      html += '<div class="inline-dropdown-item"' + isActive + ' onclick="setFocusBrandFilter(\'' + escapeHtml(brand.name).replace(/'/g, "\\'") + '\')">' +
              '<span>' + escapeHtml(brand.name) + '</span>' +
              '</div>';
    });
    listContainer.innerHTML = html;
  }
  
  dropdown.classList.toggle('active');
}

function setFocusBrandFilter(brandNameOrAll) {
  todoFilterBrand = brandNameOrAll;
  
  // Update legacy mode for compatibility
  todoFilterMode = brandNameOrAll === 'all' ? 'all' : 'brand';
  
  // Update label
  var filterLabel = document.getElementById('todoFilterLabel');
  if (filterLabel) {
    filterLabel.textContent = brandNameOrAll === 'all' ? 'All Brands' : brandNameOrAll;
  }
  
  // Update button active state
  var filterBtn = document.getElementById('todoFilterBtn');
  if (filterBtn) {
    filterBtn.classList.toggle('active', brandNameOrAll !== 'all');
  }
  
  // Close dropdown
  var dropdown = document.getElementById('focusBrandFilterDropdown');
  if (dropdown) dropdown.classList.remove('active');
  
  // Re-render
  renderFocusTodoList();
  updateFocusStats();
  renderFocusUpNext();
}

// Legacy function for backwards compatibility
function toggleTodoFilter() {
  toggleFocusBrandFilter();
}

function renderFocusTodoList() {
  var container = document.getElementById('focusTodoList');
  if (!container) return;
  
  // v9.1.14: Use todoFilterBrand instead of sidebar brand
  var filterBrandName = todoFilterBrand;
  
  // Update filter label
  var filterLabel = document.getElementById('todoFilterLabel');
  if (filterLabel) {
    filterLabel.textContent = filterBrandName === 'all' ? 'All Brands' : filterBrandName;
  }
  
  // Filter todos based on selected brand
  var filteredTodos = filterBrandName === 'all' 
    ? todos
    : todos.filter(function(t) { return t.brand === filterBrandName; });
  
  // Apply hide done filter
  if (window.hideDoneTasks) {
    filteredTodos = filteredTodos.filter(function(t) { return !t.completed; });
  }
  
  // Apply category filter
  if (window.selectedCategoryFilter !== 'all') {
    filteredTodos = filteredTodos.filter(function(t) { 
      return t.category === window.selectedCategoryFilter; 
    });
  }
  
  if (filteredTodos.length === 0) {
    var emptyMsg = filterBrandName !== 'all' 
      ? 'No tasks for ' + filterBrandName + '. Add one below!'
      : 'No tasks yet. Add your first task below!';
    container.innerHTML = '<div class="focus-empty">' + emptyMsg + '</div>';
    return;
  }
  
  // v9.1.14: Group based on taskViewMode
  var html = '';
  var viewMode = window.taskViewMode || 'category';
  
  // Sort: incomplete first
  var sortedTodos = filteredTodos.slice().sort(function(a, b) {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return 0;
  });
  
  if (viewMode === 'brand') {
    // Group by brand
    var brandGroups = {};
    sortedTodos.forEach(function(todo) {
      var brandName = todo.brand || 'Uncategorized';
      if (!brandGroups[brandName]) brandGroups[brandName] = [];
      brandGroups[brandName].push(todo);
    });
    
    Object.keys(brandGroups).forEach(function(brandName) {
      html += '<div class="todo-group" data-group-type="brand" data-group-value="' + escapeHtml(brandName) + '">';
      html += '<div class="todo-group-header">';
      html += '<span style="color:' + getBrandColor(brandName) + '">●</span> ' + brandName + ' <span class="todo-group-count">' + brandGroups[brandName].length + '</span>';
      html += '<button class="todo-group-add-btn" onclick="event.stopPropagation(); showInlineGroupAdd(\'brand\', \'' + escapeHtml(brandName) + '\')" title="Add task to ' + escapeHtml(brandName) + '">+</button>';
      html += '</div>';
      html += '<div class="todo-group-inline-add" id="inlineAdd-brand-' + escapeHtml(brandName).replace(/\s/g, '-') + '" style="display: none;">';
      html += '<input type="text" class="todo-group-inline-input" placeholder="New task..." onkeypress="if(event.key===\'Enter\')saveInlineGroupTask(\'brand\', \'' + escapeHtml(brandName) + '\')">';
      html += '<button class="todo-group-inline-save" onclick="saveInlineGroupTask(\'brand\', \'' + escapeHtml(brandName) + '\')">Add</button>';
      html += '<button class="todo-group-inline-cancel" onclick="hideInlineGroupAdd(\'brand\', \'' + escapeHtml(brandName) + '\')">✕</button>';
      html += '</div>';
      brandGroups[brandName].forEach(function(todo) {
        var originalIndex = todos.indexOf(todo);
        html += renderTodoItem(todo, originalIndex, 'brand');
      });
      html += '</div>';
    });
  } else if (viewMode === 'category') {
    // Group by category
    var categoryGroups = {};
    sortedTodos.forEach(function(todo) {
      var catName = todo.category || 'Uncategorized';
      if (!categoryGroups[catName]) categoryGroups[catName] = [];
      categoryGroups[catName].push(todo);
    });
    
    Object.keys(categoryGroups).forEach(function(catName) {
      var cat = window.todoCategories.find(function(c) { return c.name === catName; });
      var catColor = cat ? cat.color : 'var(--text-muted)';
      var safeCatName = escapeHtml(catName).replace(/\s/g, '-');
      html += '<div class="todo-group" data-group-type="category" data-group-value="' + escapeHtml(catName) + '">';
      html += '<div class="todo-group-header">';
      html += '<span style="color:' + catColor + '">●</span> ' + catName + ' <span class="todo-group-count">' + categoryGroups[catName].length + '</span>';
      html += '<button class="todo-group-add-btn" onclick="event.stopPropagation(); showInlineGroupAdd(\'category\', \'' + escapeHtml(catName) + '\')" title="Add task to ' + escapeHtml(catName) + '">+</button>';
      html += '</div>';
      html += '<div class="todo-group-inline-add" id="inlineAdd-category-' + safeCatName + '" style="display: none;">';
      html += '<input type="text" class="todo-group-inline-input" placeholder="New task..." onkeypress="if(event.key===\'Enter\')saveInlineGroupTask(\'category\', \'' + escapeHtml(catName) + '\')">';
      html += '<button class="todo-group-inline-save" onclick="saveInlineGroupTask(\'category\', \'' + escapeHtml(catName) + '\')">Add</button>';
      html += '<button class="todo-group-inline-cancel" onclick="hideInlineGroupAdd(\'category\', \'' + escapeHtml(catName) + '\')">✕</button>';
      html += '</div>';
      categoryGroups[catName].forEach(function(todo) {
        var originalIndex = todos.indexOf(todo);
        html += renderTodoItem(todo, originalIndex, 'category');
      });
      html += '</div>';
    });
  } else {
    // Both - no grouping, show all metadata
    sortedTodos.forEach(function(todo) {
      var originalIndex = todos.indexOf(todo);
      html += renderTodoItem(todo, originalIndex, 'both');
    });
  }
  
  container.innerHTML = html;
  
  // v9.1.14: Apply layout class
  container.classList.toggle('todo-layout-vertical', window.taskLayout === 'vertical');
}

function renderTodoItem(todo, index, viewMode) {
  viewMode = viewMode || 'both';
  var html = '<div class="todo-item' + (todo.completed ? ' completed' : '') + '" data-index="' + index + '">';
  html += '<div class="todo-item-main" onclick="toggleTodoExpand(' + index + ')">';
  html += '<div class="todo-checkbox' + (todo.completed ? ' checked' : '') + '" onclick="event.stopPropagation(); toggleTodo(' + index + ')"></div>';
  html += '<div class="todo-content">';
  html += '<div class="todo-text">' + escapeHtml(todo.text) + '</div>';
  html += '<div class="todo-meta" style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">';
  
  // v9.1.14: Show metadata based on viewMode
  // If grouped by brand, show category (not brand)
  // If grouped by category, show brand (not category)
  // If both, show both
  if (viewMode === 'brand' || viewMode === 'both') {
    // Show category when grouped by brand
    if (todo.category) {
      var category = window.todoCategories.find(function(c) { return c.name === todo.category; });
      if (category) {
        html += '<span style="padding: 2px 8px; border-radius: var(--radius-xs); font-size: var(--text-sm); font-weight: 500; background: ' + category.color + '22; color: ' + category.color + '; border: 1px solid ' + category.color + ';">' + escapeHtml(category.name) + '</span>';
      } else {
        html += '<span style="padding: 2px 8px; border-radius: var(--radius-xs); font-size: var(--text-sm); font-weight: 500; background: rgba(150,150,150,0.15); color: var(--text-muted); border: 1px solid var(--border-color);">' + escapeHtml(todo.category) + '</span>';
      }
    }
  }
  
  if (viewMode === 'category' || viewMode === 'both') {
    // Show brand when grouped by category
    if (todo.brand) {
      html += '<span style="color:' + getBrandColor(todo.brand) + '">●</span> ' + todo.brand;
    }
  }
  // v25.3: Show assignee badge
  if (todo.assignedTo) {
    var _assigneePerson = getPersonById(todo.assignedTo);
    if (_assigneePerson) {
      html += '<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:var(--bg-tertiary);color:var(--text-muted);margin-left:6px;">' + escapeHtml(_assigneePerson.name.split(' ')[0]) + '</span>';
    }
  }
  html += '</div>';
  html += '</div>';
  html += '<span class="todo-expand-icon">▼</span>';
  html += '</div>';
  
  // Expandable details section
  html += '<div class="todo-details">';
  html += '<div class="todo-detail-row">';
  html += '<div class="todo-detail-label">Task Name</div>';
  html += '<input type="text" class="todo-detail-input" id="todoTitle' + index + '" value="' + escapeHtml(todo.text) + '">';
  html += '</div>';
  html += '<div class="todo-detail-row">';
  html += '<div class="todo-detail-label">Notes</div>';
  html += '<textarea class="todo-detail-input" id="todoNotes' + index + '" rows="3" placeholder="Add notes...">' + escapeHtml(todo.notes || '') + '</textarea>';
  html += '</div>';
  html += '<div class="todo-detail-row">';
  html += '<div class="todo-detail-label">Due Date</div>';
  html += '<input type="date" class="todo-detail-input" id="todoDue' + index + '" value="' + (todo.dueDate || '') + '">';
  html += '</div>';
  html += '<div class="todo-detail-row">';
  html += '<div class="todo-detail-label">Category</div>';
  html += '<select class="todo-detail-input" id="todoCategory' + index + '">';
  html += '<option value="">None</option>';
  window.todoCategories.forEach(function(cat) {
    var selected = todo.category === cat.name ? ' selected' : '';
    html += '<option value="' + escapeHtml(cat.name) + '"' + selected + '>' + escapeHtml(cat.name) + '</option>';
  });
  html += '</select>';
  html += '</div>';
  // v10.5.25: Add brand edit field
  html += '<div class="todo-detail-row">';
  html += '<div class="todo-detail-label">Brand</div>';
  html += '<select class="todo-detail-input" id="todoBrand' + index + '">';
  html += '<option value="">No brand</option>';
  brands.forEach(function(brand) {
    var selected = todo.brand === brand.name ? ' selected' : '';
    html += '<option value="' + escapeHtml(brand.name) + '"' + selected + '>' + escapeHtml(brand.name) + '</option>';
  });
  html += '</select>';
  html += '</div>';
  // v25.3: Assignee edit field
  var _allAssignees = getPeople('team').concat(getPeople('report'));
  if (_allAssignees.length > 0) {
    html += '<div class="todo-detail-row">';
    html += '<div class="todo-detail-label">Assigned To</div>';
    html += '<select class="todo-detail-input" id="todoAssignee' + index + '">';
    html += '<option value="">Unassigned</option>';
    _allAssignees.forEach(function(p) {
      var sel = todo.assignedTo === p.id ? ' selected' : '';
      html += '<option value="' + escapeHtml(p.id) + '"' + sel + '>' + escapeHtml(p.name) + '</option>';
    });
    html += '</select>';
    html += '</div>';
  }
  html += '<div class="todo-detail-actions">';
  html += '<button class="todo-detail-btn save" onclick="saveTodoDetails(' + index + ')">Save Changes</button>';
  html += '<button class="todo-detail-btn rhythm" onclick="addTodoToRhythm(' + index + ')">Add to Rhythm</button>';
  html += '<button class="todo-detail-btn studio" onclick="runTodoInStudio(' + index + ')">Run in Studio</button>';
  html += '<button class="todo-detail-btn delete" onclick="deleteTodo(' + index + ')">Delete</button>';
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  return html;
}

// v9.1.14: Show inline add for a specific group
function showInlineGroupAdd(type, value) {
  var safeValue = value.replace(/\s/g, '-');
  var id = 'inlineAdd-' + type + '-' + safeValue;
  var el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    var input = el.querySelector('input');
    if (input) {
      setTimeout(function() { input.focus(); }, 50);
    }
  }
}

// v9.1.14: Hide inline add for a specific group
function hideInlineGroupAdd(type, value) {
  var safeValue = value.replace(/\s/g, '-');
  var id = 'inlineAdd-' + type + '-' + safeValue;
  var el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
    var input = el.querySelector('input');
    if (input) input.value = '';
  }
}

// v9.1.14: Save inline task to a specific group
function saveInlineGroupTask(type, value) {
  var safeValue = value.replace(/\s/g, '-');
  var id = 'inlineAdd-' + type + '-' + safeValue;
  var el = document.getElementById(id);
  if (!el) return;
  
  var input = el.querySelector('input');
  var text = input ? input.value.trim() : '';
  if (!text) {
    showToast('Please enter a task', 'error');
    return;
  }
  
  // Get current brand
  var brandIdx = parseInt(document.getElementById('brand').value || 0);
  var currentBrand = brands[brandIdx] ? brands[brandIdx].name : 'My Brand';
  
  var newTodo = {
    id: Date.now() + Math.random(),
    text: text,
    brand: type === 'brand' ? value : currentBrand,
    category: type === 'category' ? value : null,
    completed: false,
    createdAt: Date.now(),
    notes: '',
    dueDate: '',
    assignedTo: '' // v25.3: Person assignment
  };

  todos.unshift(newTodo);
  saveTodos();

  // Hide the inline add
  hideInlineGroupAdd(type, value);
  
  // Re-render
  renderFocusTodoList();
  updateFocusStats();
  
  showToast('Task added to ' + value, 'success');
}

function toggleTodoExpand(index) {
  var items = document.querySelectorAll('.todo-item');
  items.forEach(function(item, i) {
    if (parseInt(item.dataset.index) === index) {
      item.classList.toggle('expanded');
    } else {
      item.classList.remove('expanded');
    }
  });
}

function saveTodoDetails(index) {
  var titleInput = document.getElementById('todoTitle' + index);
  var notesInput = document.getElementById('todoNotes' + index);
  var dueInput = document.getElementById('todoDue' + index);
  var categoryInput = document.getElementById('todoCategory' + index);
  var brandInput = document.getElementById('todoBrand' + index); // v10.5.25
  
  if (titleInput && titleInput.value.trim()) {
    todos[index].text = titleInput.value.trim();
  }
  if (notesInput) {
    todos[index].notes = notesInput.value.trim();
  }
  if (dueInput) {
    todos[index].dueDate = dueInput.value;
  }
  if (categoryInput) {
    todos[index].category = categoryInput.value || null; // Empty string becomes null
  }
  // v10.5.25: Save brand
  if (brandInput) {
    todos[index].brand = brandInput.value || null; // Empty string becomes null
  }
  // v25.3: Save assignee
  var assigneeInput = document.getElementById('todoAssignee' + index);
  if (assigneeInput) {
    todos[index].assignedTo = assigneeInput.value || '';
  }

  saveTodos();
  renderFocusTodoList();
  showToast('Task updated', 'success');
}

function runTodoInStudio(index) {
  var todo = todos[index];
  if (!todo) return;
  
  // Build a context prompt from the todo
  var prompt = todo.text;
  if (todo.notes) {
    prompt += '\n\nNotes: ' + todo.notes;
  }
  if (todo.dueDate) {
    prompt += '\n\nDue: ' + todo.dueDate;
  }
  
  // Find a relevant operation based on keywords
  var opName = 'Weekly Content Calendar'; // default
  var text = todo.text.toLowerCase();
  
  if (text.includes('content') || text.includes('social') || text.includes('post')) {
    opName = 'Ad Copy Kit';
  } else if (text.includes('email') || text.includes('newsletter')) {
    opName = 'Email Nurture Sequence';
  } else if (text.includes('analysis') || text.includes('review') || text.includes('audit')) {
    opName = 'SWOT Analysis';
  } else if (text.includes('competitor') || text.includes('market')) {
    opName = 'Competitor Analysis';
  } else if (text.includes('brand') || text.includes('voice') || text.includes('guide')) {
    opName = 'Brand Voice Guide';
  } else if (text.includes('landing') || text.includes('page')) {
    opName = 'Landing Page Copy';
  } else if (text.includes('seo') || text.includes('keyword')) {
    opName = 'SEO Content Brief';
  } else if (text.includes('persona') || text.includes('customer')) {
    opName = 'Customer Persona Builder';
  } else if (text.includes('campaign')) {
    opName = 'Monthly Campaign Sprint';
  }
  
  // Navigate to studio with the prompt
  goToStudioOperation(opName, prompt);
}

function addTodoToRhythm(index) {
  window.pendingRhythmTodoIndex = index;
  var today = new Date().toISOString().split('T')[0];
  document.getElementById('rhythmDateInput').value = today;
  document.getElementById('addToRhythmModal').classList.add('show');
  setTimeout(function() {
    document.getElementById('rhythmDateInput').focus();
  }, 100);
}

function closeAddToRhythmModal() {
  document.getElementById('addToRhythmModal').classList.remove('show');
  window.pendingRhythmTodoIndex = null;
}

function confirmAddToRhythm() {
  var index = window.pendingRhythmTodoIndex;
  var dateInput = document.getElementById('rhythmDateInput').value;
  
  if (!dateInput || index === null || index === undefined) {
    closeAddToRhythmModal();
    return;
  }
  
  var todo = todos[index];
  if (!todo) {
    closeAddToRhythmModal();
    return;
  }
  
  // Add date and type to mark as Rhythm task
  todo.date = dateInput;
  todo.type = 'task';
  todo.fromTodo = true; // Mark as originated from To-Do
  
  saveTodos();
  renderCalendar();
  renderFocusTodoList();
  showToast('Task added to Rhythm for ' + dateInput, 'success');
  closeAddToRhythmModal();
}

// ========== INLINE DROPDOWN SYSTEM v9.1.14 ==========

// Global function to toggle any inline dropdown
function toggleInlineDropdown(dropdownId, event) {
  if (event) event.stopPropagation();
  
  var dropdown = document.getElementById(dropdownId);
  var trigger = dropdown ? dropdown.previousElementSibling : null;
  
  // Close all other dropdowns first
  document.querySelectorAll('.inline-dropdown-menu.active').forEach(function(menu) {
    if (menu.id !== dropdownId) {
      menu.classList.remove('active');
      if (menu.previousElementSibling) {
        menu.previousElementSibling.classList.remove('active');
      }
    }
  });
  
  if (dropdown) {
    var isActive = dropdown.classList.contains('active');
    dropdown.classList.toggle('active');
    if (trigger) trigger.classList.toggle('active');
    
    // Populate content when opening
    if (!isActive) {
      if (dropdownId === 'focusBrandDropdown') {
        populateFocusBrandDropdown();
      } else if (dropdownId === 'focusCategoryDropdown') {
        populateFocusCategoryDropdown();
      }
    }
  }
}

function closeInlineDropdown(dropdownId) {
  var dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    dropdown.classList.remove('active');
    var trigger = dropdown.previousElementSibling;
    if (trigger) trigger.classList.remove('active');
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.inline-dropdown-container')) {
    document.querySelectorAll('.inline-dropdown-menu.active').forEach(function(menu) {
      menu.classList.remove('active');
      if (menu.previousElementSibling) {
        menu.previousElementSibling.classList.remove('active');
      }
    });
  }
});

// To-Do Brand Picker Functions (Inline Dropdown Version)
window.selectedTodoBrands = [];

function populateFocusBrandDropdown() {
  var container = document.getElementById('focusBrandCheckboxes');
  if (!container) return;
  
  var html = '';
  brands.forEach(function(brand, index) {
    var isChecked = window.selectedTodoBrands.indexOf(brand.name) !== -1;
    html += '<label class="inline-dropdown-item" style="cursor: pointer;">' +
      '<input type="checkbox" value="' + brand.name + '" ' + (isChecked ? 'checked' : '') + '>' +
      '<span>' + brand.name + '</span>' +
      '</label>';
  });
  
  container.innerHTML = html;
}

function openTodoBrandPicker() {
  // Legacy function - redirect to inline dropdown
  toggleInlineDropdown('focusBrandDropdown');
}

function closeTodoBrandPicker() {
  closeInlineDropdown('focusBrandDropdown');
}

function confirmFocusBrands() {
  var checkboxes = document.querySelectorAll('#focusBrandCheckboxes input[type="checkbox"]:checked');
  window.selectedTodoBrands = Array.from(checkboxes).map(function(cb) { return cb.value; });
  
  var label = document.getElementById('focusTodoBrandLabel');
  if (window.selectedTodoBrands.length === 0) {
    label.textContent = 'Brands';
  } else if (window.selectedTodoBrands.length === 1) {
    label.textContent = window.selectedTodoBrands[0];
  } else {
    label.textContent = window.selectedTodoBrands.length + ' brands';
  }
  
  closeInlineDropdown('focusBrandDropdown');
}

// Alias for compatibility
function confirmTodoBrands() {
  confirmFocusBrands();
}

// Category Dropdown Functions
function populateFocusCategoryDropdown() {
  var container = document.getElementById('focusCategoryList');
  if (!container) return;
  
  var isLife = getCurrentMode() === 'life';
  var allCategories = window.todoCategories || [];
  
  // v10.5.25: Filter categories by mode
  var categories = allCategories.filter(function(cat) {
    if (isLife) {
      return cat.isLife === true;
    } else {
      return cat.isLife !== true;
    }
  });
  
  var html = '<div class="inline-dropdown-item' + (!window.selectedTodoCategory ? ' selected' : '') + '" onclick="selectFocusCategory(null)">' +
    '<span>No Category</span></div>';
  
  categories.forEach(function(cat) {
    var isSelected = window.selectedTodoCategory === cat.name;
    html += '<div class="inline-dropdown-item' + (isSelected ? ' selected' : '') + '" onclick="selectFocusCategory(\'' + cat.name + '\')">' +
      '<span style="width: 12px; height: 12px; border-radius: 3px; background: ' + cat.color + ';"></span>' +
      '<span>' + cat.name + '</span></div>';
  });
  
  html += '<div class="inline-dropdown-divider"></div>';
  html += '<div class="inline-dropdown-item" onclick="openCategoryManager(); closeInlineDropdown(\'focusCategoryDropdown\');">' +
    '<span>⚙️</span><span>Manage</span></div>';
  
  container.innerHTML = html;
}

function selectFocusCategory(catName) {
  window.selectedTodoCategory = catName;
  var label = document.getElementById('focusTodoCategoryLabel');
  label.textContent = catName || 'Category';
  closeInlineDropdown('focusCategoryDropdown');
}

// v24.27: Removed dead openTodoCategoryPicker stub - real implementation below overwrites it

// ========== CATEGORY MANAGEMENT ==========

window.selectedTodoCategory = null;

// v9.1.14: Task View Mode (brand, category, both)
window.taskViewMode = localStorage.getItem('roweos_task_view_mode') || 'category';

function setTaskViewMode(mode) {
  window.taskViewMode = mode;
  localStorage.setItem('roweos_task_view_mode', mode);
  
  // Update toggle button states
  document.querySelectorAll('.inline-view-btn[data-mode]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  
  // Re-render todo list with new grouping
  renderFocusTodoList();
  showToast('Viewing by ' + mode.charAt(0).toUpperCase() + mode.slice(1), 'success');
}

// v9.1.14: Task layout toggle (horizontal/vertical)
window.taskLayout = localStorage.getItem('roweos_task_layout') || 'horizontal';

function setTaskLayout(layout) {
  window.taskLayout = layout;
  localStorage.setItem('roweos_task_layout', layout);
  
  // Update toggle button states
  document.querySelectorAll('.inline-view-btn[data-layout]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.layout === layout);
  });
  
  // Update todo-list class for layout
  var todoList = document.getElementById('focusTodoList');
  if (todoList) {
    todoList.classList.toggle('todo-layout-vertical', layout === 'vertical');
  }
  
  showToast('Layout: ' + layout.charAt(0).toUpperCase() + layout.slice(1), 'success');
}

function restoreTaskViewToggle() {
  var mode = window.taskViewMode;
  document.querySelectorAll('.inline-view-btn[data-mode]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  
  // Also restore layout toggle
  var layout = window.taskLayout || 'horizontal';
  document.querySelectorAll('.inline-view-btn[data-layout]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.layout === layout);
  });
}

// v9.1.14: Category filter for To-Do
window.selectedCategoryFilter = 'all';

function setFocusCategoryFilter(categoryNameOrAll) {
  // v10.5.25: Handle "Create New" option
  if (categoryNameOrAll === '__create_new__') {
    // Reset the select
    var select = document.getElementById('categoryFilterNativeSelect');
    if (select) select.value = window.selectedCategoryFilter || 'all';
    
    // Prompt for new category name
    var newCategoryName = prompt('Enter new category name:');
    if (newCategoryName && newCategoryName.trim()) {
      newCategoryName = newCategoryName.trim();
      
      // Check if already exists
      var exists = window.todoCategories.some(function(cat) {
        return cat.name.toLowerCase() === newCategoryName.toLowerCase();
      });
      
      if (exists) {
        showToast('Category already exists', 'warning');
        return;
      }
      
      // Create the new category with a random color
      var colors = ['#4ade80', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#84cc16'];
      var randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      window.todoCategories.push({
        name: newCategoryName,
        color: randomColor
      });
      saveTodoCategories();
      
      // Refresh dropdowns and select new category
      populateTodoFilterSelects();
      populateFocusNativeSelects();
      
      // Set the new category as filter
      window.selectedCategoryFilter = newCategoryName;
      var filterLabel = document.getElementById('categoryFilterLabel');
      if (filterLabel) filterLabel.textContent = newCategoryName;
      if (select) select.value = newCategoryName;
      
      showToast('Category "' + newCategoryName + '" created', 'success');
      renderFocusTodoList();
    }
    return;
  }
  
  window.selectedCategoryFilter = categoryNameOrAll;
  
  // Update label
  var filterLabel = document.getElementById('categoryFilterLabel');
  if (filterLabel) {
    filterLabel.textContent = categoryNameOrAll === 'all' ? 'All Categories' : categoryNameOrAll;
  }
  
  // Re-render
  renderFocusTodoList();
}

// v9.1.14: Populate native filter selects
function populateTodoFilterSelects() {
  // Populate brand filter select
  var brandSelect = document.getElementById('todoFilterNativeSelect');
  if (brandSelect) {
    var currentValue = todoFilterBrand || 'all';
    brandSelect.innerHTML = '<option value="all">All Brands</option>';
    brands.forEach(function(brand) {
      var option = document.createElement('option');
      option.value = brand.name;
      option.textContent = brand.name;
      if (brand.name === currentValue) option.selected = true;
      brandSelect.appendChild(option);
    });
  }
  
  // Populate category filter select
  // v10.5.25: Added "Create New" option
  var categorySelect = document.getElementById('categoryFilterNativeSelect');
  if (categorySelect) {
    var currentCat = window.selectedCategoryFilter || 'all';
    categorySelect.innerHTML = '<option value="all">All Categories</option>';
    window.todoCategories.forEach(function(cat) {
      var option = document.createElement('option');
      option.value = cat.name;
      option.textContent = cat.name;
      if (cat.name === currentCat) option.selected = true;
      categorySelect.appendChild(option);
    });
    // v10.5.25: Add "Create New Category" option at the end
    var createOption = document.createElement('option');
    createOption.value = '__create_new__';
    createOption.textContent = '+ Create New Category';
    categorySelect.appendChild(createOption);
  }
}

// v9.1.14: Toggle Add Task Panel
function toggleAddTaskPanel() {
  var panel = document.getElementById('addTaskPanel');
  var btn = document.querySelector('.todo-add-task-btn');
  
  if (panel.classList.contains('active')) {
    panel.classList.remove('active');
    if (btn) btn.innerHTML = '<span>+ Add Task</span>';
  } else {
    panel.classList.add('active');
    if (btn) btn.innerHTML = '<span>− Close</span>';
    // v25.3: Populate assignee selector
    if (typeof populateFocusAssigneeSelect === 'function') populateFocusAssigneeSelect();
    // Focus the input
    var input = document.getElementById('focusTodoInput');
    if (input) {
      setTimeout(function() { input.focus(); }, 100);
    }
  }
}

// v9.1.14: Inline Category Manager
function toggleInlineCategoryManager() {
  var panel = document.getElementById('inlineCategoryPanel');
  if (panel.classList.contains('active')) {
    closeInlineCategoryManager();
  } else {
    renderInlineCategoryList();
    renderRearrangeCardsList(); // v9.1.14: Populate rearrange cards for mobile
    restoreTaskViewToggle();
    panel.classList.add('active');
    // Close when clicking outside
    setTimeout(function() {
      document.addEventListener('click', handleCategoryPanelOutsideClick);
    }, 10);
  }
}

function closeInlineCategoryManager() {
  var panel = document.getElementById('inlineCategoryPanel');
  panel.classList.remove('active');
  document.removeEventListener('click', handleCategoryPanelOutsideClick);
  renderFocusTodoList(); // Refresh in case categories changed
  populateFocusNativeSelects(); // Update category select
}

function handleCategoryPanelOutsideClick(e) {
  var container = document.querySelector('.inline-category-manager-container');
  if (container && !container.contains(e.target)) {
    closeInlineCategoryManager();
  }
}

function renderInlineCategoryList() {
  var container = document.getElementById('inlineCategoryList');
  var html = '';
  
  // v10.5.25: Filter categories by mode
  var isLife = getCurrentMode() === 'life';
  var allCategories = window.todoCategories || [];
  var categories = allCategories.filter(function(cat) {
    if (isLife) {
      return cat.isLife === true;
    } else {
      return cat.isLife !== true;
    }
  });
  
  if (categories.length === 0) {
    html = '<div class="inline-category-empty">' +
           '<div class="inline-category-empty-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg></div>' +
           '<div>No categories yet</div>' +
           '</div>';
    container.innerHTML = html;
    return;
  }
  
  categories.forEach(function(cat) {
    // Find the actual index in the full array for update/delete operations
    var actualIndex = allCategories.indexOf(cat);
    html += '<div class="inline-category-item" data-index="' + actualIndex + '" onclick="event.stopPropagation()">';
    html += '<input type="color" class="inline-category-color" value="' + cat.color + '" onclick="event.stopPropagation()" onchange="event.stopPropagation(); updateCategoryColor(' + actualIndex + ', this.value)" title="Change color">';
    html += '<input type="text" class="inline-category-name" value="' + escapeHtml(cat.name) + '" onclick="event.stopPropagation()" onchange="event.stopPropagation(); updateCategoryName(' + actualIndex + ', this.value)" onkeypress="if(event.key===\'Enter\')this.blur()" title="Click to edit">';
    html += '<button class="inline-category-delete" onclick="event.stopPropagation(); deleteInlineCategory(' + actualIndex + ')" title="Delete"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

function updateCategoryColor(index, color) {
  if (window.todoCategories[index]) {
    window.todoCategories[index].color = color;
    saveTodoCategories();
    showToast('Category color updated', 'success');
  }
}

function updateCategoryName(index, newName) {
  newName = newName.trim();
  if (!newName) {
    renderInlineCategoryList(); // Reset to original
    showToast('Category name cannot be empty', 'error');
    return;
  }
  
  // Check for duplicates
  var exists = window.todoCategories.some(function(cat, i) {
    return i !== index && cat.name.toLowerCase() === newName.toLowerCase();
  });
  
  if (exists) {
    renderInlineCategoryList(); // Reset to original
    showToast('A category with this name already exists', 'error');
    return;
  }
  
  var oldName = window.todoCategories[index].name;
  window.todoCategories[index].name = newName;
  
  // Update todos that use this category
  todos.forEach(function(todo) {
    if (todo.category === oldName) {
      todo.category = newName;
    }
  });
  saveTodos();
  
  saveTodoCategories();
  showToast('Category renamed', 'success');
}

function deleteInlineCategory(index) {
  var category = window.todoCategories[index];
  if (!confirm('Delete "' + category.name + '"? Tasks with this category will lose their category.')) {
    return;
  }
  
  // Remove category from todos
  todos.forEach(function(todo) {
    if (todo.category === category.name) {
      todo.category = null;
    }
  });
  saveTodos();
  
  window.todoCategories.splice(index, 1);
  saveTodoCategories();
  renderInlineCategoryList();
  showToast('Category deleted', 'success');
}

function addInlineCategory() {
  var nameInput = document.getElementById('inlineNewCategoryName');
  var colorInput = document.getElementById('inlineNewCategoryColor');
  var name = nameInput.value.trim();
  
  if (!name) {
    showToast('Please enter a category name', 'error');
    return;
  }
  
  // Check if name already exists
  var exists = window.todoCategories.some(function(cat) {
    return cat.name.toLowerCase() === name.toLowerCase();
  });
  
  if (exists) {
    showToast('A category with this name already exists', 'error');
    return;
  }
  
  // v10.5.25: Add isLife flag based on current mode
  var isLife = getCurrentMode() === 'life';
  var newCategory = {
    id: 'cat_' + Date.now(),
    name: name,
    color: colorInput.value,
    isDefault: false,
    isLife: isLife
  };
  
  window.todoCategories.push(newCategory);
  saveTodoCategories();
  renderInlineCategoryList();
  
  nameInput.value = '';
  colorInput.value = '#a89878';
  
  showToast('Category "' + name + '" created', 'success');
}

// Keep old functions for backward compatibility
function openCategoryManager() {
  toggleInlineCategoryManager();
}

function closeCategoryManager() {
  closeInlineCategoryManager();
}

function openTodoCategoryPicker() {
  // v10.5.25: Filter categories by mode
  var isLife = getCurrentMode() === 'life';
  var allCategories = window.todoCategories || [];
  var categories = allCategories.filter(function(cat) {
    if (isLife) {
      return cat.isLife === true;
    } else {
      return cat.isLife !== true;
    }
  });
  
  if (categories.length === 0) {
    showToast('Create categories first in Manage', 'info');
    return;
  }
  
  var html = '';
  
  // Add "None" option
  var isNoneSelected = !window.selectedTodoCategory;
  html += '<label style="display: flex; align-items: center; padding: 10px; cursor: pointer; border-radius: var(--radius-xs); transition: background 0.2s; gap: var(--space-3);" ';
  html += 'onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'transparent\'">';
  html += '<input type="radio" name="todoCategory" value="" ' + (isNoneSelected ? 'checked' : '') + ' ';
  html += 'style="margin: 0; width: 16px; height: 16px; cursor: pointer;">';
  html += '<div style="width: 20px; height: 20px; border-radius: var(--radius-xs); border: 1px dashed var(--border-color);"></div>';
  html += '<span style="flex: 1; color: var(--text-muted);">None</span>';
  html += '</label>';
  
  // Add filtered categories
  categories.forEach(function(cat) {
    var isSelected = window.selectedTodoCategory === cat.id;
    html += '<label style="display: flex; align-items: center; padding: 10px; cursor: pointer; border-radius: var(--radius-xs); transition: background 0.2s; gap: var(--space-3);" ';
    html += 'onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'transparent\'">';
    html += '<input type="radio" name="todoCategory" value="' + cat.id + '" ' + (isSelected ? 'checked' : '') + ' ';
    html += 'style="margin: 0; width: 16px; height: 16px; cursor: pointer;">';
    html += '<div style="width: 20px; height: 20px; border-radius: var(--radius-xs); background: ' + cat.color + ';"></div>';
    html += '<span style="flex: 1;">' + escapeHtml(cat.name) + '</span>';
    html += '</label>';
  });
  
  // Create a temporary modal
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'todoCategoryPickerModal';
  modal.innerHTML = '<div class="modal" style="max-width: 350px; position: relative;">' +
    '<div class="modal-title">Select Category</div>' +
    '<button class="modal-close" onclick="closeTodoCategoryPicker()" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: var(--text-3xl); color: var(--text-muted); cursor: pointer;">×</button>' +
    '<div class="modal-body" style="margin-bottom: 0;">' +
      '<div id="todoCategoryRadios" style="max-height: 300px; overflow-y: auto; margin-bottom: var(--space-4);">' + html + '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-secondary" onclick="closeTodoCategoryPicker()">Cancel</button>' +
        '<button class="btn" onclick="confirmTodoCategory()">Apply</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  
  document.body.appendChild(modal);
  setTimeout(function() { modal.classList.add('show'); }, 10);
}

function closeTodoCategoryPicker() {
  var modal = document.getElementById('todoCategoryPickerModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(function() { modal.remove(); }, 300);
  }
}

function confirmTodoCategory() {
  var radio = document.querySelector('#todoCategoryRadios input[type="radio"]:checked');
  if (radio) {
    window.selectedTodoCategory = radio.value || null; // Empty string becomes null
    var label = document.getElementById('focusTodoCategoryLabel');
    if (!radio.value) {
      label.textContent = 'None';
    } else {
      var category = window.todoCategories.find(function(c) { return c.id === radio.value; });
      label.textContent = category ? category.name : 'None';
    }
  }
  closeTodoCategoryPicker();
}

function toggleCategoryFilter() {
  // Create category filter dropdown similar to brand filter
  var filterBtn = document.getElementById('categoryFilterBtn');
  var rect = filterBtn.getBoundingClientRect();
  
  // Remove existing dropdown if any
  var existing = document.getElementById('categoryFilterDropdown');
  if (existing) {
    existing.remove();
    return;
  }
  
  // v10.5.25: Filter categories by mode
  var isLife = getCurrentMode() === 'life';
  var allCategories = window.todoCategories || [];
  var categories = allCategories.filter(function(cat) {
    if (isLife) {
      return cat.isLife === true;
    } else {
      return cat.isLife !== true;
    }
  });
  
  var dropdown = document.createElement('div');
  dropdown.id = 'categoryFilterDropdown';
  dropdown.style.cssText = 'position: fixed; top: ' + (rect.bottom + 5) + 'px; left: ' + rect.left + 'px; ' +
    'background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); ' +
    'padding: var(--space-2); min-width: 200px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
  
  var html = '<div style="padding: 8px 12px; cursor: pointer; border-radius: var(--radius-xs); ' +
    (window.selectedCategoryFilter === 'all' ? 'background: var(--bg-hover);' : '') + '" ' +
    'onclick="setCategoryFilter(\'all\')" onmouseover="if(window.selectedCategoryFilter!==\'all\')this.style.background=\'var(--bg-hover)\'" ' +
    'onmouseout="if(window.selectedCategoryFilter!==\'all\')this.style.background=\'transparent\'">All Categories</div>';
  
  categories.forEach(function(cat) {
    var isSelected = window.selectedCategoryFilter === cat.id;
    html += '<div style="padding: 8px 12px; cursor: pointer; border-radius: var(--radius-xs); display: flex; align-items: center; gap: var(--space-2); ' +
      (isSelected ? 'background: var(--bg-hover);' : '') + '" ' +
      'onclick="setCategoryFilter(\'' + cat.id + '\')" ' +
      'onmouseover="if(window.selectedCategoryFilter!==\'' + cat.id + '\')this.style.background=\'var(--bg-hover)\'" ' +
      'onmouseout="if(window.selectedCategoryFilter!==\'' + cat.id + '\')this.style.background=\'transparent\'">' +
      '<div style="width: 12px; height: 12px; border-radius: 2px; background: ' + cat.color + ';"></div>' +
      escapeHtml(cat.name) +
    '</div>';
  });
  
  dropdown.innerHTML = html;
  document.body.appendChild(dropdown);
  
  // Close on click outside
  setTimeout(function() {
    document.addEventListener('click', function closeDropdown(e) {
      if (!dropdown.contains(e.target) && e.target !== filterBtn) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 10);
}

function setCategoryFilter(categoryId) {
  window.selectedCategoryFilter = categoryId;
  
  var label = document.getElementById('categoryFilterLabel');
  if (categoryId === 'all') {
    label.textContent = 'All Categories';
  } else {
    var category = window.todoCategories.find(function(c) { return c.id === categoryId; });
    label.textContent = category ? category.name : 'All Categories';
  }
  
  var dropdown = document.getElementById('categoryFilterDropdown');
  if (dropdown) dropdown.remove();
  
  renderFocusTodoList();
}

function addTodoFromFocus() {
  var input = document.getElementById('focusTodoInput');
  var dateInput = document.getElementById('focusTodoDate');
  var brandSelect = document.getElementById('focusTodoBrandSelect');
  var categorySelect = document.getElementById('focusTodoCategorySelect');
  
  var text = input.value.trim();
  if (!text) return;
  
  var selectedDate = dateInput.value;
  
  // v10.5.25: Allow null brand - don't default to current brand
  var selectedBrandName = brandSelect && brandSelect.value ? brandSelect.value : null;
  
  // v10.5.25: Handle __create_new__ in category (shouldn't be selected, but just in case)
  var selectedCategory = categorySelect && categorySelect.value && categorySelect.value !== '__create_new__'
    ? categorySelect.value
    : null;

  // v25.3: Read assignee from person selector
  var assigneeSelect = document.getElementById('focusTaskAssignee');
  var selectedAssignee = assigneeSelect && assigneeSelect.value ? assigneeSelect.value : '';

  var newTodo = {
    id: Date.now() + Math.random(),
    text: text,
    brand: selectedBrandName,
    category: selectedCategory,
    completed: false,
    createdAt: Date.now(),
    notes: '',
    dueDate: selectedDate || '',
    assignedTo: selectedAssignee // v25.3: Person assignment
  };
  
  // If date is selected, also add as Rhythm task
  if (selectedDate) {
    newTodo.date = selectedDate;
    newTodo.type = 'task';
  }
  
  todos.unshift(newTodo);
  
  saveTodos();
  renderFocusTodoList();
  updateFocusStats();
  if (selectedDate) {
    renderCalendar(); // Update Rhythm if date selected
  }
  
  // Reset inputs
  input.value = '';
  dateInput.value = '';
  if (brandSelect) {
    brandSelect.value = '';
    document.getElementById('focusTodoBrandLabel').textContent = 'Brand';
  }
  if (categorySelect) {
    categorySelect.value = '';
    document.getElementById('focusTodoCategoryLabel').textContent = 'Category';
  }
  // v25.3: Reset assignee select
  if (assigneeSelect) assigneeSelect.value = '';
  // v9.1.14: Reset date label
  var dateLabel = document.getElementById('focusTodoDateLabel');
  if (dateLabel) dateLabel.textContent = 'Select date';
  
  // v9.1.14: Close the add task panel
  var panel = document.getElementById('addTaskPanel');
  if (panel) panel.classList.remove('active');
  var btn = document.querySelector('.todo-add-task-btn');
  if (btn) btn.innerHTML = '<span>+ Add Task</span>';
  
  showToast('Task added' + (selectedDate ? ' to Rhythm' : ''), 'success');
}

// v9.1.14: Native select handlers for Focus to-do
function onFocusBrandSelectChange(value) {
  var label = document.getElementById('focusTodoBrandLabel');
  if (label) {
    if (value) {
      // Find brand display name
      var brand = brands.find(function(b) { return b.name === value; });
      label.textContent = brand ? (brand.shortName || brand.name) : value;
    } else {
      label.textContent = 'Brand';
    }
  }
}

function onFocusCategorySelectChange(value) {
  var label = document.getElementById('focusTodoCategoryLabel');
  var select = document.getElementById('focusTodoCategorySelect');
  
  // v10.5.25: Handle "Create New" option
  if (value === '__create_new__') {
    // Reset the select
    if (select) select.value = '';
    if (label) label.textContent = 'Category';
    
    // Prompt for new category name
    var newCategoryName = prompt('Enter new category name:');
    if (newCategoryName && newCategoryName.trim()) {
      newCategoryName = newCategoryName.trim();
      
      // Check if already exists
      var exists = window.todoCategories.some(function(cat) {
        return cat.name.toLowerCase() === newCategoryName.toLowerCase();
      });
      
      if (exists) {
        showToast('Category already exists', 'warning');
        return;
      }
      
      // Create the new category with a random color
      var colors = ['#4ade80', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#84cc16'];
      var randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      window.todoCategories.push({
        name: newCategoryName,
        color: randomColor
      });
      saveTodoCategories();
      
      // Refresh the dropdown
      populateFocusNativeSelects();
      
      // Select the new category
      if (select) select.value = newCategoryName;
      if (label) label.textContent = newCategoryName;
      
      showToast('Category "' + newCategoryName + '" created', 'success');
    }
    return;
  }
  
  if (label) {
    label.textContent = value || 'Category';
  }
}

// v9.1.14: Date change handler
function onFocusDateChange(value) {
  var label = document.getElementById('focusTodoDateLabel');
  if (label) {
    if (value) {
      // Format date nicely
      var date = new Date(value + 'T00:00:00');
      var options = { month: 'short', day: 'numeric', year: 'numeric' };
      label.textContent = date.toLocaleDateString('en-US', options);
    } else {
      label.textContent = 'Select date';
    }
  }
}

function populateFocusNativeSelects() {
  // Populate brand select
  var brandSelect = document.getElementById('focusTodoBrandSelect');
  if (brandSelect) {
    brandSelect.innerHTML = '<option value="">Select Brand</option>';
    brands.forEach(function(brand) {
      var option = document.createElement('option');
      option.value = brand.name;
      option.textContent = brand.name;
      brandSelect.appendChild(option);
    });
  }
  
  // Populate category select - v9.1.14: Fixed to use correct key
  // v10.5.25: Added "Create New" option
  var categorySelect = document.getElementById('focusTodoCategorySelect');
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    window.todoCategories.forEach(function(cat) {
      var option = document.createElement('option');
      option.value = cat.name;
      option.textContent = cat.name;
      categorySelect.appendChild(option);
    });
    // v10.5.25: Add "Create New" option at the end
    var createOption = document.createElement('option');
    createOption.value = '__create_new__';
    createOption.textContent = '+ Create New Category';
    createOption.style.color = 'var(--accent)';
    categorySelect.appendChild(createOption);
  }
}

function toggleTodo(index) {
  todos[index].completed = !todos[index].completed;
  if (todos[index].completed) {
    todos[index].completedAt = Date.now();
    // Update streak if this is first completion today
    var today = new Date().toDateString();
    var lastStreakDate = localStorage.getItem('roweosLastStreakDate');
    if (lastStreakDate !== today) {
      var streak = parseInt(localStorage.getItem('roweosStreak') || '0');
      localStorage.setItem('roweosStreak', streak + 1);
      localStorage.setItem('roweosLastStreakDate', today);
    }
  }
  saveTodos();
  renderFocusTodoList();
  updateFocusStats();
}

function deleteTodo(index) {
  todos.splice(index, 1);
  saveTodos();
  renderFocusTodoList();
  updateFocusStats();
  showToast('Task removed', 'success');
}

// Hide done tasks toggle - v9.1.14: Default to hidden
window.hideDoneTasks = true;

function toggleHideDone() {
  window.hideDoneTasks = !window.hideDoneTasks;
  var label = document.getElementById('hideDoneLabel');
  var btn = document.getElementById('hideDoneBtn');
  
  if (window.hideDoneTasks) {
    label.textContent = 'Show done';
    btn.style.background = 'rgba(212, 175, 55, 0.1)';
    btn.style.borderColor = 'var(--accent)';
  } else {
    label.textContent = 'Hide done';
    btn.style.background = '';
    btn.style.borderColor = '';
  }
  
  renderFocusTodoList();
  showToast(window.hideDoneTasks ? 'Completed tasks hidden' : 'Showing all tasks', 'info');
}

function clearCompletedTodos() {
  var hadCompleted = todos.some(function(t) { return t.completed; });
  todos = todos.filter(function(t) { return !t.completed; });
  saveTodos();
  renderFocusTodoList();
  updateFocusStats();
  if (hadCompleted) {
    showToast('Completed tasks cleared', 'success');
  }
}

function renderFocusUpNext() {
  var container = document.getElementById('focusUpNextList');
  if (!container) return;
  
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  
  // Get upcoming calendar items (next 7 days)
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  var upcoming = calendar.filter(function(item) {
    var itemDate = new Date(item.date);
    var matchesBrand = todoFilterMode === 'brand' ? item.brand === brand.name : true;
    return itemDate >= today && itemDate <= nextWeek && item.status !== 'completed' && matchesBrand;
  }).sort(function(a, b) {
    return new Date(a.date) - new Date(b.date);
  }).slice(0, 4);
  
  if (upcoming.length === 0) {
    var emptyMsg = todoFilterMode === 'brand'
      ? 'No upcoming items for ' + brand.name + '.'
      : 'No upcoming items in the next 7 days.';
    container.innerHTML = '<div class="focus-empty">' + emptyMsg + '<br>Add items in Calendar to see them here.</div>';
    return;
  }
  
  var html = '';
  upcoming.forEach(function(item) {
    var itemDate = new Date(item.date);
    var todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    var dayDiff = Math.floor((itemDate - todayStart) / (1000 * 60 * 60 * 24));
    var timeLabel = dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : itemDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    html += '<div class="upnext-item" onclick="openCalendarItem(' + item.id + ')" style="border-left-color:' + getBrandColor(item.brand) + '">';
    html += '<div class="upnext-icon">◈</div>';
    html += '<div class="upnext-content">';
    html += '<div class="upnext-title">' + escapeHtml(item.title) + '</div>';
    html += '<div class="upnext-subtitle">' + timeLabel + ' • ' + item.brand + '</div>';
    html += '</div>';
    html += '</div>';
  });
  container.innerHTML = html;
}

function renderFocusRecentActivity() {
  var container = document.getElementById('focusRecentActivity');
  if (!container) return;
  
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  
  // Get recent tuning items
  var tuningItems = [];
  
  // v9.1.14: Get from tuning history (runs with ratings)
  runs.forEach(function(run) {
    if (run.tuningRating && (todoFilterMode !== 'brand' || run.brand === brand.name)) {
      tuningItems.push({
        type: 'studio',
        operation: run.op || run.operation || 'Studio Output',
        brand: run.brand,
        rating: run.tuningRating,
        date: run.date || Date.now()
      });
    }
  });
  
  // v9.1.14: Get from agent commands (BrandAI conversations)
  if (typeof agentCommands !== 'undefined') {
    agentCommands.forEach(function(cmd) {
      // Check both rating and tuningRating properties
      var cmdRating = cmd.tuningRating || cmd.rating;
      if (cmdRating && (todoFilterMode !== 'brand' || cmd.brand === brand.name)) {
        tuningItems.push({
          type: 'agent',
          title: (cmd.title || 'BrandAI Chat').substring(0, 40),
          brand: cmd.brand,
          rating: cmdRating,
          date: cmd.date || Date.now()
        });
      }
    });
  }
  
  // Sort by date and take recent 4
  tuningItems.sort(function(a, b) { return (b.date || 0) - (a.date || 0); });
  tuningItems = tuningItems.slice(0, 4);
  
  if (tuningItems.length === 0) {
    container.innerHTML = '<div class="focus-empty">No tuning feedback yet. Rate outputs in Tuning to improve BrandAI.</div>';
    return;
  }
  
  var ratingLabels = { good: 'Good', 'needs-work': 'Needs Work', 'off-tone': 'Off-Tone', bad: 'Bad', needswork: 'Needs Work', offtone: 'Off-Tone' };
  var ratingColors = { good: '#4ade80', 'needs-work': '#fbbf24', 'off-tone': '#f97316', bad: '#ef4444', needswork: '#fbbf24', offtone: '#f97316' };
  
  var html = '';
  tuningItems.forEach(function(item) {
    var label = ratingLabels[item.rating] || item.rating;
    var color = ratingColors[item.rating] || 'var(--text-muted)';
    var title = item.operation || item.title || 'Item';
    var icon = item.type === 'agent' ? '◆' : '◇';
    
    html += '<div class="recent-activity-item" onclick="showView(\'tuning\')" style="cursor: pointer;">';
    html += '<div class="recent-activity-content">';
    html += '<div class="recent-activity-title">' + icon + ' ' + escapeHtml(title) + '</div>';
    html += '<div class="recent-activity-time">';
    html += '<span style="color: ' + color + '; font-weight: 500;">' + label + '</span>';
    html += ' • ' + (item.brand || 'Unknown');
    html += '</div>';
    html += '</div>';
    html += '</div>';
  });
  container.innerHTML = html;
}

// =====================================================
// v9.1.14: FOCUS CARD DRAG AND DROP
// =====================================================

var focusDraggedCard = null;
var focusCardOrder = {};

// Initialize drag and drop
function initFocusCardDragDrop() {
  var cards = document.querySelectorAll('.focus-card-draggable');
  
  cards.forEach(function(card) {
    // Drag start
    card.addEventListener('dragstart', function(e) {
      focusDraggedCard = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.cardId);
      
      // Add drag-over class to columns
      setTimeout(function() {
        document.querySelectorAll('.focus-column').forEach(function(col) {
          col.classList.add('drag-over-column');
        });
      }, 0);
    });
    
    // Drag end - v24.27: Reset ALL visual states including outline
    card.addEventListener('dragend', function(e) {
      card.classList.remove('dragging');
      card.style.outline = 'none';
      card.style.opacity = '';
      card.style.transform = '';
      focusDraggedCard = null;

      // Remove all drag states from all cards
      document.querySelectorAll('.focus-card-draggable').forEach(function(c) {
        c.classList.remove('drag-over');
        c.classList.remove('dragging');
        c.style.outline = 'none';
        c.style.opacity = '';
        c.style.transform = '';
      });
      document.querySelectorAll('.focus-column').forEach(function(col) {
        col.classList.remove('drag-over-column');
      });
      document.querySelectorAll('.focus-card-placeholder').forEach(function(p) {
        p.remove();
      });

      // Save new order
      saveFocusCardOrder();
    });
    
    // Drag over
    card.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (focusDraggedCard && focusDraggedCard !== card) {
        card.classList.add('drag-over');
      }
    });
    
    // Drag leave
    card.addEventListener('dragleave', function(e) {
      card.classList.remove('drag-over');
    });
    
    // Drop on card
    card.addEventListener('drop', function(e) {
      e.preventDefault();
      card.classList.remove('drag-over');
      
      if (focusDraggedCard && focusDraggedCard !== card) {
        var column = card.closest('.focus-column');
        var allCards = Array.from(column.querySelectorAll('.focus-card-draggable'));
        var draggedIndex = allCards.indexOf(focusDraggedCard);
        var targetIndex = allCards.indexOf(card);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          // Same column reorder
          if (draggedIndex < targetIndex) {
            card.parentNode.insertBefore(focusDraggedCard, card.nextSibling);
          } else {
            card.parentNode.insertBefore(focusDraggedCard, card);
          }
        } else {
          // Different column
          card.parentNode.insertBefore(focusDraggedCard, card);
        }
        
        showToast('Card moved', 'success');
      }
    });
  });
  
  // Column drop zones
  document.querySelectorAll('.focus-column').forEach(function(column) {
    column.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    
    column.addEventListener('drop', function(e) {
      e.preventDefault();
      
      // If dropped on empty area of column (not on a card)
      if (focusDraggedCard && e.target === column) {
        column.appendChild(focusDraggedCard);
        saveFocusCardOrder();
        showToast('Card moved to column', 'success');
      }
    });
  });
  
  // Load saved order
  loadFocusCardOrder();
}

// Save card order to localStorage
function saveFocusCardOrder() {
  var order = {};
  
  document.querySelectorAll('.focus-column').forEach(function(column, colIndex) {
    var columnId = column.dataset.column || colIndex;
    order[columnId] = [];
    
    column.querySelectorAll('.focus-card-draggable').forEach(function(card) {
      if (card.dataset.cardId) {
        order[columnId].push(card.dataset.cardId);
      }
    });
  });
  
  localStorage.setItem('roweosFocusCardOrder', JSON.stringify(order));
  focusCardOrder = order;
}

// Load card order from localStorage
function loadFocusCardOrder() {
  var saved = localStorage.getItem('roweosFocusCardOrder');
  if (!saved) return;
  
  try {
    focusCardOrder = JSON.parse(saved);
  } catch (e) {
    return;
  }
  
  Object.keys(focusCardOrder).forEach(function(columnId) {
    var column = document.querySelector('.focus-column[data-column="' + columnId + '"]');
    if (!column) return;
    
    var cardIds = focusCardOrder[columnId];
    
    // Reorder cards in this column
    cardIds.forEach(function(cardId) {
      var card = document.querySelector('.focus-card-draggable[data-card-id="' + cardId + '"]');
      if (card) {
        column.appendChild(card);
      }
    });
  });
}

// Reset card order to default
function resetFocusCardOrder() {
  localStorage.removeItem('roweosFocusCardOrder');
  focusCardOrder = {};
  showToast('Card order reset', 'success');
  location.reload();
}

// v9.1.14: Render rearrange cards list for mobile
function renderRearrangeCardsList() {
  var container = document.getElementById('rearrangeCardsList');
  if (!container) return;
  
  var cardNames = {
    'up-next': 'Up Next',
    'ai-suggestions': 'BrandAI Suggestions',
    'quick-actions': 'Quick Actions',
    'todays-rhythm': "Today's Rhythm",
    'scheduled-automations': 'Scheduled Automations',
    'suggested-recurring': 'Suggested Recurring',
    'recent-tuning': 'Recent Tuning'
  };
  
  // Get current order of cards
  var allCards = document.querySelectorAll('.focus-card-draggable[data-card-id]');
  var html = '';
  
  allCards.forEach(function(card, index) {
    var cardId = card.dataset.cardId;
    var cardName = cardNames[cardId] || cardId;
    var isFirst = index === 0;
    var isLast = index === allCards.length - 1;
    
    html += '<div class="rearrange-card-item" data-card-id="' + cardId + '">';
    html += '<span class="rearrange-card-handle">⋮⋮</span>';
    html += '<span class="rearrange-card-name">' + cardName + '</span>';
    html += '<div class="rearrange-card-arrows">';
    html += '<button class="rearrange-card-arrow" onclick="event.stopPropagation(); moveCardUp(\'' + cardId + '\')"' + (isFirst ? ' disabled style="opacity:0.3"' : '') + '>▲</button>';
    html += '<button class="rearrange-card-arrow" onclick="event.stopPropagation(); moveCardDown(\'' + cardId + '\')"' + (isLast ? ' disabled style="opacity:0.3"' : '') + '>▼</button>';
    html += '</div>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

// v9.1.14: Move card up in order
function moveCardUp(cardId) {
  var card = document.querySelector('.focus-card-draggable[data-card-id="' + cardId + '"]');
  if (!card) return;
  
  var prev = card.previousElementSibling;
  if (prev && prev.classList.contains('focus-card-draggable')) {
    card.parentNode.insertBefore(card, prev);
    saveFocusCardOrder();
    renderRearrangeCardsList();
    showToast('Card moved up', 'success');
  }
}

// v9.1.14: Move card down in order
function moveCardDown(cardId) {
  var card = document.querySelector('.focus-card-draggable[data-card-id="' + cardId + '"]');
  if (!card) return;
  
  var next = card.nextElementSibling;
  if (next && next.classList.contains('focus-card-draggable')) {
    card.parentNode.insertBefore(next, card);
    saveFocusCardOrder();
    renderRearrangeCardsList();
    showToast('Card moved down', 'success');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initFocusCardDragDrop, 500);
  // v22.39: Initialize event reminders for today
  setTimeout(initEventReminders, 2000);
});

// =====================================================
// END FOCUS CARD DRAG AND DROP
// =====================================================
