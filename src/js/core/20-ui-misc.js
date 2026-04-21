
function renderFocusTodayRhythm() {
  var container = document.getElementById('focusTodayRhythm');
  if (!container) return;
  
  var today = new Date().toISOString().slice(0, 10);
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  
  // Get today's calendar items
  var todayItems = calendar.filter(function(item) {
    return item.date === today && (todoFilterMode !== 'brand' || item.brand === brand.name);
  });
  
  // Sort by time if available
  todayItems.sort(function(a, b) {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });
  
  if (todayItems.length === 0) {
    container.innerHTML = '<div class="focus-empty">Nothing scheduled for today. <a href="#" onclick="openAddCalendarModal(); return false;" style="color: var(--accent);">Add an item</a></div>';
    return;
  }
  
  var html = '';
  todayItems.forEach(function(item) {
    var timeStr = item.time ? formatTime12h(item.time) : 'All day';
    var statusClass = item.status === 'completed' ? 'completed' : '';
    
    html += '<div class="today-rhythm-item ' + statusClass + '" onclick="openCalendarItem(' + item.id + ')">';
    html += '<div class="today-rhythm-time">' + timeStr + '</div>';
    html += '<div class="today-rhythm-content">';
    html += '<div class="today-rhythm-title">' + escapeHtml(item.title) + '</div>';
    html += '<div class="today-rhythm-brand">' + escapeHtml(item.brand) + '</div>';
    html += '</div>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

// v12.0.0: formatTime12h and getTimeAgo moved to utils object (aliases at top of JS section)

function getOperationIcon(opName) {
  var icons = {
    'Ad Copy Kit': '◇',
    'Email Nurture Sequence': '◆',
    'Weekly Content Calendar': '◈',
    'Brand Voice Guide': '◎',
    'SEO Content Brief': '○',
    'Landing Page Copy': '□'
  };
  return icons[opName] || '◇';
}

function renderFocusAIRecommendations() {
  var container = document.getElementById('focusAiRecList');
  if (!container) return;
  
  // Get currently selected brand
  var brandIdx = document.getElementById('brand').value;
  var currentBrand = brands[brandIdx] || brands[0];
  var brandColor = getBrandColor(currentBrand.name);
  
  var html = '';
  
  // Get 3 brand-specific recommendations
  var recommendations = getBrandSpecificRecommendations(currentBrand);
  
  html += '<div class="brand-rec-header" style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4);">';
  html += '<div style="width: 4px; height: 20px; background: ' + brandColor + '; border-radius: 2px;"></div>';
  html += '<div style="font-weight: 600; font-size: var(--text-base); color: var(--text-primary);">' + currentBrand.name + '</div>';
  html += '</div>';
  
  recommendations.forEach(function(rec, idx) {
    html += '<div class="ai-rec-item" onclick="' + rec.action + '" style="border-left: 2px solid ' + brandColor + '; animation: fadeInUp 0.3s ease ' + (idx * 0.1) + 's both;">';
    html += '<div class="ai-rec-title">✦ ' + rec.title + '</div>';
    html += '<div class="ai-rec-reason">' + rec.reason + '</div>';
    html += '<div class="ai-rec-action">→ ' + rec.actionLabel + '</div>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

function getBrandSpecificRecommendations(brand) {
  var recs = [];
  var today = new Date();
  var dayOfWeek = today.getDay();
  var dayOfMonth = today.getDate();

  // v13.0: Generic brand management suggestions (personalized with brand.name)
  var brandName = brand.shortName || brand.name;
  var pool = [
    { title: 'Content Planning Session', reason: 'Plan upcoming content and campaigns for ' + brandName, action: "goToStudioOperation('Weekly Content Calendar')", actionLabel: 'Plan Content' },
    { title: 'Brand Strategy Review', reason: 'Analyze ' + brandName + ' positioning and identify growth opportunities', action: "goToStudioOperation('SWOT Analysis')", actionLabel: 'Open Analysis' },
    { title: 'Client Outreach', reason: 'Strengthen relationships with key ' + brandName + ' clients and partners', action: "showView('agent')", actionLabel: 'Draft with BrandAI' },
    { title: 'Voice & Messaging Audit', reason: 'Ensure ' + brandName + ' voice consistency across all channels', action: "goToStudioOperation('Brand Voice Guide')", actionLabel: 'Open in Studio' },
    { title: 'Competitive Analysis', reason: 'Review ' + brandName + ' competitive landscape and market position', action: "goToStudioOperation('Competitor Analysis')", actionLabel: 'Run Analysis' }
  ];
  
  // Add time-based suggestions
  if (dayOfWeek === 1) {
    recs.push({ title: 'Weekly Planning Session', reason: 'Set priorities and objectives for ' + brand.name + ' this week', action: "goToStudioOperation('Weekly Content Calendar')", actionLabel: 'Start Planning' });
  } else if (dayOfWeek === 5) {
    recs.push({ title: 'Week-in-Review', reason: 'Reflect on ' + brand.name + ' accomplishments and prep for next week', action: "goToStudioOperation('Portfolio SWOT Analysis')", actionLabel: 'Start Review' });
  }
  
  if (dayOfMonth <= 3) {
    recs.push({ title: 'Monthly Strategy Review', reason: 'New month - review ' + brand.name + ' performance and plan ahead', action: "goToStudioOperation('Portfolio SWOT Analysis')", actionLabel: 'Start Review' });
  }
  
  // Check for pending calendar items
  var pendingItems = calendar.filter(function(item) {
    return item.status === 'proposed' && item.brand === brand.name;
  });
  if (pendingItems.length > 0) {
    recs.push({ title: 'Review ' + pendingItems.length + ' Pending Item(s)', reason: 'You have proposed items awaiting review for ' + brand.name, action: "showView('rhythm')", actionLabel: 'View Calendar' });
  }
  
  // Fill remaining slots from brand pool (randomized for variety)
  var shuffledPool = pool.sort(function() { return 0.5 - Math.random(); });
  shuffledPool.forEach(function(sug) {
    if (recs.length < 3) {
      recs.push(sug);
    }
  });
  
  return recs.slice(0, 3);
}

function refreshFocusRecommendations() {
  renderFocusAIRecommendations();
  showToast('Suggestions refreshed', 'success');
}

function goToStudioOperation(opName, prefillPrompt) {
  var op = ops.find(function(o) { return o.name === opName; });
  if (!op) {
    showToast('Operation not found: ' + opName, 'error');
    return;
  }
  
  // Check if there's work in progress
  var contextField = document.getElementById('studioContext');
  var hasWorkInProgress = selectedOp !== null || (contextField && contextField.value.trim() !== '');
  
  if (hasWorkInProgress) {
    // Show confirmation dialog
    var currentWork = selectedOp ? selectedOp.name : 'unsaved notes';
    if (confirm('You have work in progress (' + currentWork + '). Clear it and open "' + opName + '" instead?')) {
      proceedToStudioOperation(op, prefillPrompt);
    }
  } else {
    proceedToStudioOperation(op, prefillPrompt);
  }
}

function proceedToStudioOperation(op, prefillPrompt) {
  showView('studio');
  setTimeout(function() {
    // Map operation category to agent
    var categoryToAgent = {
      'strategic': 'strategy',
      'marketing': 'marketing',
      'operations': 'operations',
      'documents': 'documents',
      'social': 'social',
      'brand-specific': 'strategy'
    };
    
    var agentId = categoryToAgent[op.category] || 'all';
    
    // Select the appropriate agent (this also filters operations)
    selectAgent(agentId);
    
    // Small delay to let agent selection render
    setTimeout(function() {
      // Select the operation
      selectedOp = op;
      updateSelectedOpDisplay();
      updateRunButton();
      
      // Generate or use prefill prompt
      var contextField = document.getElementById('studioContext');
      if (contextField) {
        if (prefillPrompt) {
          contextField.value = prefillPrompt;
        } else {
          // Auto-generate a helpful prompt based on the operation
          var generatedPrompt = generateOperationPrompt(op);
          contextField.value = generatedPrompt;
        }
        contextField.focus();
      }
      
      // Find and highlight the operation item in the list
      var opItems = document.querySelectorAll('.studio-op-item');
      opItems.forEach(function(item) {
        item.classList.remove('selected');
        if (item.dataset.opId == op.id) {
          item.classList.add('selected');
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      
      // Add glow effect to execute button
      var runBtn = document.getElementById('runBtn');
      if (runBtn && !runBtn.disabled) {
        runBtn.classList.add('glow-ready');
        
        // Remove glow after user clicks or after 10 seconds
        var removeGlow = function() {
          runBtn.classList.remove('glow-ready');
          runBtn.removeEventListener('click', removeGlow);
        };
        runBtn.addEventListener('click', removeGlow);
        setTimeout(removeGlow, 10000);
      }
    }, 150);
  }, 100);
}

function generateOperationPrompt(op) {
  // Get current brand
  var brandSelect = document.getElementById('brand');
  var brandIdx = brandSelect ? parseInt(brandSelect.value) : 0;
  var brand = brands[brandIdx];
  var brandName = brand ? brand.name : (brands.length > 0 ? brands[0].name : 'your brand');
  
  // Operation-specific prompts
  var prompts = {
    'Weekly Content Calendar': 'Create a week of engaging social content for ' + brandName + '. Focus on brand storytelling, audience engagement, and highlighting our unique value proposition.',
    'Monthly Campaign Sprint': 'Develop a comprehensive monthly campaign for ' + brandName + '. Include strategy, messaging pillars, and cross-channel coordination.',
    'Email Nurture Sequence': 'Build a welcome sequence for new ' + brandName + ' subscribers. Focus on building trust and showcasing our expertise.',
    'Competitor Analysis': 'Analyze key competitors in the ' + brandName + ' space. Identify differentiators and strategic opportunities.',
    'Customer Persona Builder': 'Define the ideal customer for ' + brandName + '. Include demographics, psychographics, and buying motivations.',
    'SWOT Analysis': 'Conduct a thorough SWOT analysis for ' + brandName + '. Focus on actionable insights and strategic priorities.',
    'Brand Voice Guide': 'Define the distinctive voice and tone for ' + brandName + '. Include vocabulary, style guidelines, and examples.',
    'SEO Content Brief': 'Create an SEO-optimized content strategy for ' + brandName + '. Target high-intent keywords relevant to our audience.',
    'Ad Copy Kit': 'Develop compelling ad copy variations for ' + brandName + '. Create headlines and descriptions for paid campaigns.',
    'Landing Page Copy': 'Write conversion-focused landing page copy for ' + brandName + '. Emphasize benefits, social proof, and clear CTAs.',
    'Review Response Pack': 'Create thoughtful review response templates for ' + brandName + '. Maintain brand voice while addressing feedback.',
    'Crisis Response Playbook': 'Develop crisis communication protocols for ' + brandName + '. Prepare for various scenarios with approved messaging.',
    'Influencer Outreach Pack': 'Create influencer partnership pitches for ' + brandName + '. Focus on authentic collaborations that align with our values.',
    'Press Release Template': 'Write a professional press release for ' + brandName + '. Announce recent developments or upcoming initiatives.',
    'Customer Journey Map': 'Map the complete customer experience for ' + brandName + '. Identify touchpoints and opportunities for improvement.',
    'Master Brand Guide': 'Document the core brand architecture for ' + brandName + '. Define positioning, values, and visual identity standards.',
    'Portfolio SWOT Analysis': 'Analyze cross-brand synergies and opportunities within your brand portfolio. Identify strategic priorities.',
    'Unified Messaging Framework': 'Create L1/L2/L3 messaging hierarchy for ' + brandName + '. Ensure consistency across all communications.',
    'Cross-Brand Campaign': 'Develop a multi-brand promotional strategy leveraging your brand ecosystem.',
    'Annual Report Template': 'Create a comprehensive year-in-review document for ' + brandName + '. Highlight achievements and future direction.',
    'Investor/Partner Deck': 'Build a professional presentation for ' + brandName + ' stakeholders. Showcase value proposition and growth potential.',
    'Brand Architecture Document': 'Define sub-brand relationships and hierarchy within ' + brandName + '.'
  };
  
  return prompts[op.name] || 'Generate ' + op.name + ' content for ' + brandName + '. ' + op.desc + '.';
}

// Drag and Drop Functions
var draggedItemId = null;

function handleDragStart(e) {
  draggedItemId = parseInt(e.target.dataset.itemId);
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedItemId);
  
  // Add dragging class to body for global styles
  document.body.classList.add('is-dragging');
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.body.classList.remove('is-dragging');
  
  // Remove drag-over from all drop zones
  document.querySelectorAll('.drop-zone').forEach(function(zone) {
    zone.classList.remove('drag-over');
  });
  
  draggedItemId = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  // Find the drop zone (might be the target or a parent)
  var dropZone = e.target.closest('.drop-zone');
  if (dropZone) {
    dropZone.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  var dropZone = e.target.closest('.drop-zone');
  if (dropZone && !dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  
  var dropZone = e.target.closest('.drop-zone');
  if (!dropZone) return;
  
  dropZone.classList.remove('drag-over');
  
  var newDate = dropZone.dataset.date;
  var itemId = parseInt(e.dataTransfer.getData('text/plain')) || draggedItemId;
  
  if (!itemId || !newDate) return;
  
  // Find and update the item
  var item = calendar.find(function(c) { return c.id === itemId; });
  if (item && item.date !== newDate) {
    var oldDate = item.date;
    item.date = newDate;
    saveRuns();
    renderCalendar();
    
    // Format dates for toast
    var oldDateFormatted = new Date(oldDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var newDateFormatted = new Date(newDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    showToast('Moved "' + item.title.substring(0, 20) + '" to ' + newDateFormatted, 'success');
  }
}

// Calendar Item Modal Functions
var editingCalendarItemId = null;

function openAddCalendarModal() {
  editingCalendarItemId = null;
  document.getElementById('calModalTitle').textContent = 'Add Calendar Item';
  document.getElementById('calItemTitle').value = '';
  document.getElementById('calItemDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('calItemTime').value = '';
  document.getElementById('calItemAllDay').checked = true;
  document.getElementById('calItemTime').disabled = true;
  document.getElementById('calItemBrand').value = brands[parseInt(document.getElementById('brand').value)].name;
  document.getElementById('calItemStatus').value = 'scheduled';
  document.getElementById('calItemNotes').value = '';
  // v22.39: Reset reminder
  var reminderSel = document.getElementById('calItemReminder');
  if (reminderSel) reminderSel.value = '15';
  document.getElementById('calDeleteBtn').style.display = 'none';
  document.getElementById('calExecuteActions').style.display = 'none';
  // v22.39: Populate calendar sync checkboxes
  populateCalItemSyncCalendars();
  document.getElementById('calendarItemModal').classList.add('show');
}

function toggleAllDay() {
  var allDay = document.getElementById('calItemAllDay').checked;
  document.getElementById('calItemTime').disabled = allDay;
  var endTime = document.getElementById('calItemEndTime');
  if (endTime) endTime.disabled = allDay;
  if (allDay) {
    document.getElementById('calItemTime').value = '';
    if (endTime) endTime.value = '';
  }
}

function openCalendarItem(id) {
  var item = calendar.find(function(c) { return c.id === id; });
  if (!item) return;

  editingCalendarItemId = id;
  document.getElementById('calModalTitle').textContent = 'Edit Calendar Item';
  document.getElementById('calItemTitle').value = item.title || '';
  document.getElementById('calItemDate').value = item.date || '';
  document.getElementById('calItemTime').value = item.time || '';
  var endTimeEl = document.getElementById('calItemEndTime');
  if (endTimeEl) endTimeEl.value = item.endTime || '';
  var isAllDay = item.allDay || !item.time;
  document.getElementById('calItemAllDay').checked = isAllDay;
  document.getElementById('calItemTime').disabled = isAllDay;
  if (endTimeEl) endTimeEl.disabled = isAllDay;
  document.getElementById('calItemBrand').value = item.brand || (brands.length > 0 ? brands[0].name : '');
  document.getElementById('calItemStatus').value = item.status || 'proposed';
  document.getElementById('calItemNotes').value = item.notes || '';
  // v22.39: Set reminder
  var reminderSel = document.getElementById('calItemReminder');
  if (reminderSel) reminderSel.value = item.reminder || '';
  document.getElementById('calDeleteBtn').style.display = 'block';
  document.getElementById('calExecuteActions').style.display = 'block';
  populateCalItemSyncCalendars();
  // v24.26: Set calendar selector to saved target
  var calTargetSel = document.getElementById('calItemCalendar');
  if (calTargetSel && item.calendarTarget) calTargetSel.value = item.calendarTarget;
  document.getElementById('calendarItemModal').classList.add('show');
}

// v22.39: Populate per-calendar sync checkboxes in calendar item modal
function populateCalItemSyncCalendars() {
  var container = document.getElementById('calItemSyncCalendars');
  var label = document.getElementById('calSyncExternalLabel');
  var group = document.getElementById('calSyncExternalGroup');
  if (!container || !group) return;

  var calendars = [];
  if (typeof _gcalConnected !== 'undefined' && _gcalConnected) calendars.push({ value: 'google', label: 'Google' });
  if (typeof _icloudConnected !== 'undefined' && _icloudConnected) calendars.push({ value: 'icloud', label: 'iCloud' });
  if (typeof _outlookCalConnected !== 'undefined' && _outlookCalConnected) calendars.push({ value: 'outlook', label: 'Outlook' });

  if (calendars.length === 0) {
    group.style.display = 'none';
    return;
  }
  group.style.display = '';
  container.innerHTML = '';
  calendars.forEach(function(cal) {
    var lbl = document.createElement('label');
    lbl.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;';
    lbl.innerHTML = '<input type="checkbox" value="' + cal.value + '" checked> <span>' + cal.label + '</span>';
    container.appendChild(lbl);
  });
  if (label) label.textContent = 'Select calendars to sync this event to';

  // v24.26: Also populate the calendar selector dropdown
  populateCalendarSelectors();
}

// Backwards compat alias
function updateCalSyncExternalLabel() { populateCalItemSyncCalendars(); }

function closeCalendarItemModal() {
  document.getElementById('calendarItemModal').classList.remove('show');
  editingCalendarItemId = null;
}

var currentDayViewDate = null;

var selectedDayDate = null;
var selectedDayItem = null;
var dayViewMode = 'stack'; // 'stack' or 'hour'
var rhythmSelectedDate = null;

function openDayView(dateStr) {
  // If in month view, show inline panel instead of modal
  if (calendarView === 'month') {
    openRhythmDayPanel(dateStr);
    return;
  }
  
  // Week view uses the modal
  selectedDayDate = dateStr;
  selectedDayItem = null;
  
  var date = new Date(dateStr + 'T12:00:00');
  document.getElementById('dayViewTitle').textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('dayViewSubtitle').textContent = date.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Set view mode toggle
  document.querySelectorAll('.day-toggle-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.view === dayViewMode);
  });
  
  renderDayView();
  resetDaySidebar();
  
  document.getElementById('dayViewModal').classList.add('show');
}

// v9.1.14: Unified Add to Rhythm System
var currentRhythmAddType = 'event';

function toggleRhythmAddDropdown() {
  var dropdown = document.getElementById('rhythmAddDropdown');
  dropdown.classList.toggle('open');
  
  // Close on outside click
  if (dropdown.classList.contains('open')) {
    setTimeout(function() {
      document.addEventListener('click', closeRhythmDropdownOnOutsideClick);
    }, 10);
  }
}

function closeRhythmDropdownOnOutsideClick(e) {
  var dropdown = document.getElementById('rhythmAddDropdown');
  if (!dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
    document.removeEventListener('click', closeRhythmDropdownOnOutsideClick);
  }
}

function openRhythmAddForm(type) {
  // v22.39: Only event and todo supported now
  if (type === 'automation') type = 'event';
  currentRhythmAddType = type;

  // Close dropdown
  document.getElementById('rhythmAddDropdown').classList.remove('open');

  // Update tabs
  document.querySelectorAll('.rhythm-type-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.type === type);
  });

  // v22.39: Show/hide event-only fields (time, reminder, calendar sync)
  var isEvent = (type === 'event');
  var timeRow = document.getElementById('rhythmAddTimeRow');
  var reminderRow = document.getElementById('rhythmAddReminderRow');
  var calSyncRow = document.getElementById('rhythmAddCalSyncRow');
  if (timeRow) timeRow.style.display = isEvent ? '' : 'none';
  if (reminderRow) reminderRow.style.display = isEvent ? '' : 'none';
  if (calSyncRow) calSyncRow.style.display = isEvent ? '' : 'none';

  // Show/hide category for todo
  var categoryRow = document.getElementById('rhythmAddCategoryRow');
  if (categoryRow) {
    categoryRow.style.display = type === 'todo' ? 'block' : 'none';
    if (type === 'todo') populateRhythmCategorySelect();
  }

  // Update save button text
  var saveText = document.getElementById('rhythmAddSaveText');
  if (saveText) {
    saveText.textContent = isEvent ? 'Add Event' : 'Add To-Do';
  }

  // Set default date
  var dateInput = document.getElementById('rhythmAddDate');
  if (dateInput) {
    dateInput.value = rhythmSelectedDate || new Date().toISOString().slice(0, 10);
  }

  // Reset form fields
  document.getElementById('rhythmAddTitle').value = '';
  document.getElementById('rhythmAddDescription').value = '';
  document.getElementById('rhythmAddRecurring').checked = false;
  document.getElementById('rhythmRecurringFrequency').style.display = 'none';

  // v22.39: Reset time/reminder
  var timeInput = document.getElementById('rhythmAddTime');
  if (timeInput) { timeInput.value = '09:00'; timeInput.disabled = false; }
  var endTimeInput = document.getElementById('rhythmAddEndTime');
  if (endTimeInput) { endTimeInput.value = '10:00'; endTimeInput.disabled = false; }
  var allDayCheck = document.getElementById('rhythmAddAllDay');
  if (allDayCheck) allDayCheck.checked = false;
  var reminderSelect = document.getElementById('rhythmAddReminder');
  if (reminderSelect) reminderSelect.value = '15';

  // v22.39: Populate calendar sync checkboxes
  populateRhythmCalSyncOptions();

  // v25.2: Populate Push-to calendar picker
  if (isEvent) populateEventCalendarPicker();

  // v13.9: Show form with null safety for life mode
  var formPanel = document.getElementById('rhythmAddFormPanel');
  if (formPanel) {
    formPanel.style.display = 'block';
    var titleEl = document.getElementById('rhythmAddTitle');
    if (titleEl) titleEl.focus();
  }
}

function closeRhythmAddForm() {
  document.getElementById('rhythmAddFormPanel').style.display = 'none';
}

function switchRhythmAddType(type) {
  // v22.39: Only event and todo supported
  if (type === 'automation') type = 'event';
  currentRhythmAddType = type;

  // Update tabs
  document.querySelectorAll('.rhythm-type-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.type === type);
  });

  // v22.39: Show/hide event-only fields
  var isEvent = (type === 'event');
  var timeRow = document.getElementById('rhythmAddTimeRow');
  var reminderRow = document.getElementById('rhythmAddReminderRow');
  var calSyncRow = document.getElementById('rhythmAddCalSyncRow');
  if (timeRow) timeRow.style.display = isEvent ? '' : 'none';
  if (reminderRow) reminderRow.style.display = isEvent ? '' : 'none';
  if (calSyncRow) calSyncRow.style.display = isEvent ? '' : 'none';

  // Show/hide category field (only for todo)
  var categoryRow = document.getElementById('rhythmAddCategoryRow');
  if (categoryRow) {
    categoryRow.style.display = type === 'todo' ? 'block' : 'none';
    if (type === 'todo') populateRhythmCategorySelect();
  }

  // Update save button text
  var saveText = document.getElementById('rhythmAddSaveText');
  if (saveText) {
    saveText.textContent = isEvent ? 'Add Event' : 'Add To-Do';
  }
}

// v10.5.25: Populate categories for To-Do
function populateRhythmCategorySelect() {
  var select = document.getElementById('rhythmAddCategory');
  if (!select) return;
  
  select.innerHTML = '<option value="">Select Category</option>';
  window.todoCategories.forEach(function(cat) {
    var option = document.createElement('option');
    option.value = cat.name;
    option.textContent = cat.name;
    select.appendChild(option);
  });
  
  // Add create new option
  var createOption = document.createElement('option');
  createOption.value = '__create_new__';
  createOption.textContent = '+ Create New Category';
  select.appendChild(createOption);
}

// v10.5.25: Handle category change (create new inline)
function handleRhythmCategoryChange(value) {
  if (value === '__create_new__') {
    var select = document.getElementById('rhythmAddCategory');
    var newCategoryName = prompt('Enter new category name:');
    if (newCategoryName && newCategoryName.trim()) {
      newCategoryName = newCategoryName.trim();
      var exists = window.todoCategories.some(function(cat) {
        return cat.name.toLowerCase() === newCategoryName.toLowerCase();
      });
      if (!exists) {
        var colors = ['#4ade80', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#84cc16'];
        window.todoCategories.push({
          name: newCategoryName,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
        saveTodoCategories();
        showToast('Category "' + newCategoryName + '" created', 'success');
      }
      // Refresh dropdown and select the new category
      populateRhythmCategorySelect();
      if (select) select.value = newCategoryName;
    } else {
      // Reset to empty
      if (select) select.value = '';
    }
  }
}

function toggleRhythmRecurring() {
  var checkbox = document.getElementById('rhythmAddRecurring');
  var frequencyRow = document.getElementById('rhythmRecurringFrequency');
  if (frequencyRow) {
    frequencyRow.style.display = checkbox.checked ? 'block' : 'none';
  }
}

// v9.1.14: Show/hide operation selector based on action type
function toggleOperationSelect() {
  var actionSelect = document.getElementById('rhythmAddAction');
  var operationRow = document.getElementById('rhythmOperationSelect');
  if (operationRow) {
    if (actionSelect.value === 'run_operation') {
      operationRow.style.display = 'block';
      populateOperationSelect();
    } else {
      operationRow.style.display = 'none';
    }
  }
}

// v9.1.14: Populate the operation selector with available operations
function populateOperationSelect() {
  var select = document.getElementById('rhythmAddOperation');
  if (!select) return;
  
  select.innerHTML = '<option value="">Select an operation...</option>';
  
  // Add all operations grouped by category
  var categories = ['marketing', 'strategic', 'operations', 'documents', 'research'];
  
  categories.forEach(function(cat) {
    var catOps = ops.filter(function(op) { return op.category === cat; });
    if (catOps.length > 0) {
      var optgroup = document.createElement('optgroup');
      optgroup.label = cat.charAt(0).toUpperCase() + cat.slice(1);
      catOps.forEach(function(op) {
        var option = document.createElement('option');
        option.value = op.id;
        option.textContent = op.name;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    }
  });
  
  // Also add AI-generated operations if any
  if (generatedBrandOps.length > 0) {
    var aiOptgroup = document.createElement('optgroup');
    aiOptgroup.label = 'AI Generated';
    generatedBrandOps.forEach(function(op) {
      var option = document.createElement('option');
      option.value = op.id;
      option.textContent = '✦ ' + op.name;
      aiOptgroup.appendChild(option);
    });
    select.appendChild(aiOptgroup);
  }
}

function selectRhythmColor(color) {
  document.getElementById('rhythmAddColor').value = color;
  document.querySelectorAll('.rhythm-color-btn').forEach(function(btn) {
    btn.classList.toggle('selected', btn.dataset.color === color);
  });
}

// v22.39: Populate calendar sync checkboxes based on connected calendars
function populateRhythmCalSyncOptions() {
  var container = document.getElementById('rhythmAddCalSyncOptions');
  if (!container) return;
  container.innerHTML = '';

  var calendars = [];
  if (_gcalConnected) calendars.push({ value: 'google', label: 'Google Calendar', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' });
  if (_icloudConnected) calendars.push({ value: 'icloud', label: 'iCloud', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>' });
  if (_outlookCalConnected) calendars.push({ value: 'outlook', label: 'Outlook', icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7v10M16 7v10M2 12h20"/></svg>' });

  if (calendars.length === 0) {
    container.innerHTML = '<span style="color: var(--text-tertiary); font-size: 12px;">No calendars connected</span>';
    return;
  }

  calendars.forEach(function(cal) {
    var label = document.createElement('label');
    label.className = 'rhythm-checkbox-label';
    label.style.cssText = 'cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px;';
    label.innerHTML = '<input type="checkbox" value="' + cal.value + '" checked> ' + cal.icon + ' <span>' + cal.label + '</span>';
    container.appendChild(label);
  });

  // v24.26: Also populate the calendar selector dropdown
  populateCalendarSelectors();
}

// v24.26: Populate calendar selector dropdowns with all connected calendars
function populateCalendarSelectors() {
  var selectors = ['eventPushTo', 'calItemCalendar'];
  selectors.forEach(function(selId) {
    var sel = document.getElementById(selId);
    if (!sel) return;
    // Remember current value
    var curVal = sel.value || 'roweos';
    sel.innerHTML = '<option value="roweos">RoweOS (Local)</option>';

    // Google calendars
    if (typeof _gcalConnected !== 'undefined' && _gcalConnected && typeof _gcalCalendars !== 'undefined') {
      _gcalCalendars.forEach(function(cal) {
        var opt = document.createElement('option');
        opt.value = 'gcal_' + cal.id;
        opt.textContent = cal.name + ' (Google)';
        sel.appendChild(opt);
      });
    }

    // iCloud calendars
    if (typeof _icloudConnected !== 'undefined' && _icloudConnected && typeof _icloudCalendars !== 'undefined') {
      _icloudCalendars.forEach(function(cal) {
        var opt = document.createElement('option');
        opt.value = 'icloud_' + (cal.id || cal.name);
        opt.textContent = (cal.name || cal.title || 'iCloud') + ' (iCloud)';
        sel.appendChild(opt);
      });
    }

    // Outlook calendars
    if (typeof _outlookCalConnected !== 'undefined' && _outlookCalConnected && typeof _outlookCalendars !== 'undefined') {
      _outlookCalendars.forEach(function(cal) {
        var opt = document.createElement('option');
        opt.value = 'outlook_' + (cal.id || cal.name);
        opt.textContent = (cal.name || cal.title || 'Outlook') + ' (Outlook)';
        sel.appendChild(opt);
      });
    }

    // Restore previous selection if still valid
    var found = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === curVal) { found = true; break; }
    }
    if (found) sel.value = curVal;
  });
}

// v25.2: Populate the "Push to" calendar picker dropdown
function populateEventCalendarPicker() {
  var sel = document.getElementById('eventPushTo');
  if (!sel) return;
  var html = '<option value="local">RoweOS (local)</option>';
  if (_gcalConnected && _gcalCalendars) {
    for (var i = 0; i < _gcalCalendars.length; i++) {
      html += '<option value="google_' + i + '">Google: ' + escapeHtml(_gcalCalendars[i].summary || 'Calendar') + '</option>';
    }
  }
  if (_outlookCalConnected) {
    html += '<option value="outlook">Outlook Calendar</option>';
  }
  if (_icloudConnected) {
    html += '<option value="icloud">iCloud Calendar</option>';
  }
  sel.innerHTML = html;
}

// v22.39: Event reminder system
var _eventReminderTimers = {};

function scheduleEventReminder(event) {
  if (!event || !event.reminder || event.reminder === '' || !event.time || !event.date) return;

  var reminderMinutes = parseInt(event.reminder, 10);
  if (isNaN(reminderMinutes)) return;

  // Calculate when the event occurs
  var eventDateTime = new Date(event.date + 'T' + event.time + ':00');
  var reminderTime = new Date(eventDateTime.getTime() - (reminderMinutes * 60 * 1000));
  var now = new Date();
  var delay = reminderTime.getTime() - now.getTime();

  if (delay <= 0) return; // Already passed

  // Clear any existing timer for this event
  if (_eventReminderTimers[event.id]) {
    clearTimeout(_eventReminderTimers[event.id]);
  }

  _eventReminderTimers[event.id] = setTimeout(function() {
    delete _eventReminderTimers[event.id];
    fireEventReminder(event);
  }, delay);
}

function fireEventReminder(event) {
  var timeStr = event.time ? (' at ' + event.time) : '';
  showToast('Reminder: ' + event.title + timeStr, 'info');

  // Browser notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('RoweOS Reminder', {
        body: event.title + timeStr,
        icon: '/favicon.ico'
      });
    } catch (e) { /* silent */ }
  }
}

// v22.39: Check and schedule reminders for today's events on load
function initEventReminders() {
  var today = new Date().toISOString().slice(0, 10);
  calendar.forEach(function(ev) {
    if (ev.date === today && ev.reminder && ev.reminder !== '' && ev.time) {
      scheduleEventReminder(ev);
    }
  });
}

function saveRhythmItem() {
  var title = document.getElementById('rhythmAddTitle').value.trim();
  var description = document.getElementById('rhythmAddDescription').value.trim();
  var date = document.getElementById('rhythmAddDate').value;
  var brand = document.getElementById('rhythmAddBrand').value;
  var color = document.getElementById('rhythmAddColor').value;
  var isRecurring = document.getElementById('rhythmAddRecurring').checked;
  var frequency = isRecurring ? document.getElementById('rhythmAddFrequency').value : 'once';

  if (!title) {
    showToast('Please enter a title', 'error');
    return;
  }

  if (!date) {
    showToast('Please select a date', 'error');
    return;
  }

  if (currentRhythmAddType === 'event') {
    // v22.39: Read time, all-day, reminder, calendar sync targets
    var allDay = document.getElementById('rhythmAddAllDay') ? document.getElementById('rhythmAddAllDay').checked : false;
    var timeVal = allDay ? '' : (document.getElementById('rhythmAddTime') ? document.getElementById('rhythmAddTime').value : '');
    var endTimeVal = allDay ? '' : (document.getElementById('rhythmAddEndTime') ? document.getElementById('rhythmAddEndTime').value : '');
    var reminderVal = document.getElementById('rhythmAddReminder') ? document.getElementById('rhythmAddReminder').value : '';

    // v25.2: Read "Push to" calendar picker
    var pushTo = '';
    var pushSelect = document.getElementById('eventPushTo');
    if (pushSelect) pushTo = pushSelect.value;

    var calSyncTargets = [];
    // v25.2: Route to external calendar based on Push-to selection
    if (pushTo.indexOf('google_') === 0) calSyncTargets.push('google');
    else if (pushTo === 'outlook') calSyncTargets.push('outlook');
    else if (pushTo === 'icloud') calSyncTargets.push('icloud');
    document.querySelectorAll('#rhythmAddCalSyncOptions input[type="checkbox"]:checked').forEach(function(cb) {
      if (calSyncTargets.indexOf(cb.value) === -1) calSyncTargets.push(cb.value);
    });

    var newEvent = {
      id: Date.now(),
      title: title,
      description: description,
      brand: brand || 'My Brand',
      date: date,
      time: timeVal,
      endTime: endTimeVal,
      allDay: allDay,
      reminder: reminderVal,
      color: color,
      status: 'planned',
      recurring: isRecurring,
      frequency: frequency,
      calendarTarget: pushTo || 'local',
      createdAt: new Date().toISOString()
    };
    calendar.push(newEvent);
    saveCalendar();
    syncToFirebase('calendar', calendar);

    // v22.39: Push to selected external calendars
    if (calSyncTargets.length > 0) {
      var externalEvent = {
        title: title,
        description: description,
        date: date,
        time: timeVal,
        allDay: allDay
      };
      var pushed = [];
      calSyncTargets.forEach(function(target) {
        if (target === 'google' && _gcalConnected && _gcalAccessToken) {
          // v25.2: Use specific Google calendar ID from Push-to picker
          var gcalId = 'primary';
          if (pushTo && pushTo.indexOf('google_') === 0) {
            var calIdx = parseInt(pushTo.replace('google_', ''));
            if (_gcalCalendars[calIdx]) gcalId = _gcalCalendars[calIdx].id || 'primary';
          }
          pushEventToGoogleCalendar(externalEvent, gcalId);
          pushed.push('Google');
        } else if (target === 'icloud' && _icloudConnected && _icloudCalendars.length > 0) {
          pushEventToICloudCalendar(externalEvent);
          pushed.push('iCloud');
        } else if (target === 'outlook' && _outlookCalConnected) {
          pushEventToOutlookCalendar(externalEvent);
          pushed.push('Outlook');
        }
      });
      if (pushed.length > 0) {
        showToast('Event added and synced to ' + pushed.join(', '), 'success');
      } else {
        showToast('Event added to Rhythm', 'success');
      }
    } else {
      showToast('Event added to Rhythm', 'success');
    }

    // v22.39: Schedule reminder if set
    if (reminderVal !== '' && timeVal) {
      scheduleEventReminder(newEvent);
    }

  } else if (currentRhythmAddType === 'todo') {
    // v10.5.25: Get category and handle create new
    var categorySelect = document.getElementById('rhythmAddCategory');
    var category = categorySelect ? categorySelect.value : null;

    if (category === '__create_new__') {
      var newCategoryName = prompt('Enter new category name:');
      if (newCategoryName && newCategoryName.trim()) {
        newCategoryName = newCategoryName.trim();
        var exists = window.todoCategories.some(function(cat) {
          return cat.name.toLowerCase() === newCategoryName.toLowerCase();
        });
        if (!exists) {
          var colors = ['#4ade80', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#84cc16'];
          window.todoCategories.push({
            name: newCategoryName,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
          saveTodoCategories();
          category = newCategoryName;
        } else {
          category = newCategoryName;
        }
      } else {
        category = null;
      }
    }

    var newTodo = {
      id: Date.now(),
      text: title,
      description: description,
      completed: false,
      brand: brand,
      category: category,
      date: date,
      color: color,
      recurring: isRecurring,
      frequency: frequency,
      createdAt: new Date().toISOString()
    };
    todos.push(newTodo);
    saveTodos();
    syncToFirebase('todos', todos);
    renderFocusTodos();
    showToast('To-Do added to Rhythm', 'success');
  }

  closeRhythmAddForm();
  renderCalendar();

  // Refresh day panel if open
  if (rhythmSelectedDate) {
    renderRhythmDayPanel();
  }
}

// Inline Rhythm Day Panel functions
function openRhythmDayPanel(dateStr) {
  rhythmSelectedDate = dateStr;
  
  var date = new Date(dateStr + 'T12:00:00');
  document.getElementById('rhythmDayTitle').textContent = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('rhythmDaySubtitle').textContent = date.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Highlight selected day in calendar
  document.querySelectorAll('.calendar-month-day').forEach(function(day) {
    day.classList.toggle('selected', day.dataset.date === dateStr);
  });
  
  // v9.1.14: Render all sections (no tabs)
  renderRhythmDayPanel();

  var dayPanel = document.getElementById('rhythmDayPanel');
  // v15.43: On mobile, use class toggle + scrim
  if (window.innerWidth <= 768) {
    dayPanel.classList.add('mobile-day-open');
    var scrim = document.getElementById('mobileDayScrim');
    if (scrim) scrim.classList.add('show');
    document.body.style.overflow = 'hidden';
  } else {
    dayPanel.style.display = 'block';
    dayPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function closeRhythmDayPanel() {
  var dayPanel = document.getElementById('rhythmDayPanel');
  if (dayPanel) {
    dayPanel.style.display = 'none';
    dayPanel.classList.remove('mobile-day-open');
  }
  rhythmSelectedDate = null;

  // v15.43: Clean up scrim
  var scrim = document.getElementById('mobileDayScrim');
  if (scrim) scrim.classList.remove('show');
  document.body.style.overflow = '';

  // Remove selected highlight
  document.querySelectorAll('.calendar-month-day').forEach(function(day) {
    day.classList.remove('selected');
  });
  
  // Hide any open inline forms
  hideInlineAdd('event');
  hideInlineAdd('todo');
}

// v9.1.14: Tab switching
function switchRhythmTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.rhythm-day-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  // Update tab panes
  document.querySelectorAll('.rhythm-tab-pane').forEach(function(pane) {
    pane.classList.remove('active');
  });
  
  var paneId = 'rhythmTab' + tab.charAt(0).toUpperCase() + tab.slice(1);
  var pane = document.getElementById(paneId);
  if (pane) pane.classList.add('active');
  
  // Render content for the active tab
  if (tab === 'events') renderRhythmEvents();
  else if (tab === 'todos') renderRhythmTodos();
  else if (tab === 'automations') renderRhythmDayAutomations();
}

// v9.1.14: Inline add forms
function showInlineAdd(type) {
  var form = document.getElementById(type + 'AddForm');
  var btn = document.getElementById(type + 'AddBtn');
  if (form) form.style.display = 'block';
  if (btn) btn.style.display = 'none';
  
  // Focus input based on type
  var inputId = type === 'event' ? 'inlineEventTitle' : 
                type === 'todo' ? 'inlineTodoText' : 
                'inlineAutomationName';
  var input = document.getElementById(inputId);
  if (input) input.focus();
  
  // Setup automation recurring toggle
  if (type === 'automation') {
    var recurringCheckbox = document.getElementById('inlineAutomationRecurring');
    var frequencySelect = document.getElementById('inlineAutomationFrequency');
    if (recurringCheckbox && frequencySelect) {
      recurringCheckbox.onchange = function() {
        frequencySelect.style.display = this.checked ? 'block' : 'none';
      };
    }
  }
}

function hideInlineAdd(type) {
  var form = document.getElementById(type + 'AddForm');
  var btn = document.getElementById(type + 'AddBtn');
  if (form) form.style.display = 'none';
  if (btn) btn.style.display = 'flex';
  
  // Clear inputs based on type
  if (type === 'event') {
    var input = document.getElementById('inlineEventTitle');
    if (input) input.value = '';
  } else if (type === 'todo') {
    var input = document.getElementById('inlineTodoText');
    if (input) input.value = '';
  } else if (type === 'automation') {
    var input = document.getElementById('inlineAutomationName');
    if (input) input.value = '';
    var checkbox = document.getElementById('inlineAutomationRecurring');
    if (checkbox) checkbox.checked = false;
    var freq = document.getElementById('inlineAutomationFrequency');
    if (freq) freq.style.display = 'none';
  }
}

function saveInlineEvent() {
  var title = document.getElementById('inlineEventTitle').value.trim();
  var brand = document.getElementById('inlineEventBrand').value;
  var time = document.getElementById('inlineEventTime') ? document.getElementById('inlineEventTime').value : '';

  if (!title) {
    showToast('Please enter an event title', 'error');
    return;
  }

  var newEvent = {
    id: Date.now(),
    title: title,
    brand: brand || 'My Brand',
    date: rhythmSelectedDate,
    time: time || '',
    status: 'planned'
  };

  calendar.push(newEvent);
  saveCalendar();
  syncToFirebase('calendar', calendar);

  // v22.39: Push to connected external calendars
  if (typeof pushEventToExternalCalendars === 'function') {
    pushEventToExternalCalendars(newEvent);
  }

  hideInlineAdd('event');
  renderRhythmEvents();
  renderCalendar();
  showToast('Event added', 'success');
}

function saveInlineTodo() {
  var text = document.getElementById('inlineTodoText').value.trim();
  var priority = document.getElementById('inlineTodoPriority').value;
  
  if (!text) {
    showToast('Please enter a to-do item', 'error');
    return;
  }
  
  var newTodo = {
    id: Date.now(),
    text: text,
    completed: false,
    priority: priority,
    date: rhythmSelectedDate,
    createdAt: new Date().toISOString()
  };
  
  todos.push(newTodo);
  saveTodos();
  syncToFirebase('todos', todos);
  
  hideInlineAdd('todo');
  renderRhythmTodos();
  renderCalendar();
  renderFocusTodos();
  showToast('To-do added', 'success');
}

// v9.1.14: Save inline automation
function saveInlineAutomation() {
  var name = document.getElementById('inlineAutomationName').value.trim();
  var action = document.getElementById('inlineAutomationAction').value;
  var time = document.getElementById('inlineAutomationTime').value || '09:00';
  var isRecurring = document.getElementById('inlineAutomationRecurring').checked;
  var frequency = isRecurring ? document.getElementById('inlineAutomationFrequency').value : 'once';
  
  if (!name) {
    showToast('Please enter an automation name', 'error');
    return;
  }
  
  var tasks = getScheduledTasks();
  var newTask = {
    id: Date.now(),
    name: name,
    description: '',
    frequency: frequency,
    scheduledDate: rhythmSelectedDate + 'T' + time + ':00',
    enabled: true,
    action: action,
    color: '#a89878',
    time: time,
    brand: '',
    brandIdx: ''
  };
  
  tasks.push(newTask);
  saveScheduledTasks(tasks);
  
  hideInlineAdd('automation');
  renderRhythmDayAutomations();
  renderRhythmAutomations();
  renderCalendar();
  showToast('Automation "' + name + '" created', 'success');
}

// v9.1.14: Open automation modal with selected date
function openAutomationModal() {
  document.getElementById('taskDateInput').value = rhythmSelectedDate || new Date().toISOString().slice(0, 10);
  createScheduledTask();
}

// v9.1.14: Toggle recurring options
function toggleRecurringOptions() {
  var checkbox = document.getElementById('taskRecurringInput');
  var options = document.getElementById('recurringOptions');
  if (options) {
    options.style.display = checkbox.checked ? 'block' : 'none';
  }
}

// Render events for rhythm day panel
// v13.1: Filter by current mode (brand vs life)
function renderRhythmEvents() {
  if (!rhythmSelectedDate) return;

  var container = document.getElementById('rhythmDayEvents');
  var isLifeMode = (localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand') === 'life';
  // v16.12: Use merged calendar — native mode-filtered + external (always shown)
  var dayEvents = getCalendarEventsForDate(rhythmSelectedDate).filter(function(item) {
    // External events show in both modes
    if (item.source === 'google' || item.source === 'icloud') return true;
    // v13.1: Mode filtering for native events
    if (isLifeMode) return item.brand === '_life' || item.brand === 'Life';
    return item.brand !== '_life' && item.brand !== 'Life';
  });
  
  if (dayEvents.length === 0) {
    container.innerHTML = '<div class="rhythm-day-empty rhythm-day-add" onclick="addRhythmEventForDate()"><span class="rhythm-add-icon">+</span> Tap to add event</div>';
  } else {
    var html = dayEvents.map(function(ev) {
      var isExternal = ev.source === 'google' || ev.source === 'icloud';
      var brandColor = isExternal ? ev.color : getBrandColor(ev.brand);
      var externalClass = isExternal ? ' external-event' : '';
      var sourceBadge = '';
      if (ev.source === 'google') sourceBadge = '<span class="cal-source-badge google">G</span>';
      else if (ev.source === 'icloud') sourceBadge = '<span class="cal-source-badge icloud">iC</span>';

      if (isExternal) {
        var clickHandler = 'openExternalEventDetail(\'' + ev.id + '\')';
        return '<div class="rhythm-day-item event external-event" onclick="' + clickHandler + '">' +
          '<div class="rhythm-item-title">' + escapeHtml(ev.title) + ' ' + sourceBadge + '</div>' +
          '<div class="rhythm-item-meta">' +
            '<span style="color: ' + ev.color + ';">' + (ev.source === 'google' ? 'Google Calendar' : 'iCloud Calendar') + '</span>' +
            (ev.time ? '<span>' + escapeHtml(ev.time) + '</span>' : '<span>All day</span>') +
          '</div>' +
        '</div>';
      } else {
        // v22.39: Show time and reminder badge for native events
        var evTime = ev.allDay ? 'All day' : (ev.time ? escapeHtml(ev.time) : '');
        var reminderBadge = ev.reminder && ev.reminder !== '' ? ' <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;opacity:0.5;"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>' : '';
        return '<div class="rhythm-day-item event" onclick="editRhythmEvent(' + ev.id + ')">' +
          '<div class="rhythm-item-title">' + escapeHtml(ev.title) + reminderBadge + '</div>' +
          '<div class="rhythm-item-meta">' +
            (evTime ? '<span style="color:var(--text-secondary);">' + evTime + '</span>' : '') +
            '<span class="rhythm-item-brand"><span class="rhythm-item-brand-dot" style="background:' + brandColor + '"></span>' + escapeHtml(ev.brand || 'No brand') + '</span>' +
            '<span style="text-transform:capitalize">' + (ev.status || '') + '</span>' +
          '</div>' +
          '<div class="rhythm-item-actions">' +
            '<button class="rhythm-item-action" onclick="event.stopPropagation(); editRhythmEvent(' + ev.id + ')">Edit</button>' +
            '<button class="rhythm-item-action danger" onclick="event.stopPropagation(); deleteRhythmEvent(' + ev.id + ')">Delete</button>' +
          '</div>' +
        '</div>';
      }
    }).join('');
    container.innerHTML = html;
  }
}

// Render todos for rhythm day panel
// v13.1: Filter by current mode (brand vs life)
function renderRhythmTodos() {
  if (!rhythmSelectedDate) return;

  var container = document.getElementById('rhythmDayTodos');
  var isLifeMode = (localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand') === 'life';
  var dayTodos = todos.filter(function(t) {
    if (t.date !== rhythmSelectedDate) return false;
    // v13.1: Mode filtering
    if (isLifeMode) return t.brand === '_life' || t.brand === 'Life';
    return t.brand !== '_life' && t.brand !== 'Life';
  });
  
  if (dayTodos.length === 0) {
    container.innerHTML = '<div class="rhythm-day-empty rhythm-day-add" onclick="addRhythmTodoForDate()"><span class="rhythm-add-icon">+</span> Tap to add to-do</div>';
  } else {
    var html = dayTodos.map(function(task) {
      var isCompleted = task.completed;
      return '<div class="rhythm-day-item task ' + (isCompleted ? 'completed' : '') + '">' +
        '<div style="display: flex; align-items: flex-start; gap: var(--space-3);">' +
          '<div class="rhythm-item-checkbox ' + (isCompleted ? 'checked' : '') + '" onclick="toggleRhythmTask(' + task.id + ')">' +
            (isCompleted ? '✓' : '') +
          '</div>' +
          '<div style="flex: 1;">' +
            '<div class="rhythm-item-title">' + escapeHtml(task.text || '') + '</div>' +
            '<div class="rhythm-item-meta">' +
              '<span style="text-transform: capitalize;">' + (task.priority || 'medium') + ' priority</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="rhythm-item-actions">' +
          '<button class="rhythm-item-action danger" onclick="event.stopPropagation(); deleteRhythmTodo(' + task.id + ')">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
    container.innerHTML = html;
  }
}

// v15.47: Render ALL automations in day view (full list, not date-filtered)
function renderRhythmDayAutomations() {
  var container = document.getElementById('rhythmDayAutomations');
  if (!container) return;

  var tasks = typeof getScheduledTasks === 'function' ? getScheduledTasks() : JSON.parse(localStorage.getItem('roweos_scheduled_tasks') || '[]');

  if (tasks.length === 0) {
    container.innerHTML = '<div class="rhythm-day-empty rhythm-day-add" onclick="addRhythmAutomationForDate()"><span class="rhythm-add-icon">+</span> Tap to add automation</div>';
    return;
  }

  var accentColor = getAccentFallback();
  var html = tasks.map(function(task) {
    var taskColor = task.color || '#6366f1';
    var taskTime = task.time || '09:00';
    var brandDisplay = task.brand === '_life' ? 'Life' : (task.brand || '');
    return '<div class="rhythm-day-item event" style="border-left:3px solid ' + taskColor + ';padding:8px;margin-bottom:6px;">' +
      '<div class="rhythm-item-title" style="display:flex;align-items:center;gap:6px;">' +
        '<span>' + escapeHtml(task.name || 'Automation') + '</span>' +
        (brandDisplay ? '<span style="font-size:10px;padding:2px 6px;background:' + accentColor + '22;color:' + accentColor + ';border-radius:4px;font-weight:600;text-transform:uppercase;">' + escapeHtml(brandDisplay) + '</span>' : '') +
      '</div>' +
      '<div class="rhythm-item-meta">' +
        '<span>' + (typeof formatFrequency === 'function' ? formatFrequency(task.frequency) : (task.frequency || 'Once')) + (task.frequency === 'none' || task.frequency === 'once' || !task.frequency ? '' : ' at ' + taskTime) + '</span>' +
        '<span style="color:' + (task.enabled ? accentColor : '#888') + ';">' + (task.enabled ? 'Active' : 'Paused') + '</span>' +
      '</div>' +
      '<div class="rhythm-item-actions" style="margin-top:4px;">' +
        '<button class="rhythm-item-action" onclick="runScheduledTask(\'' + task.id + '\')">Run</button>' +
        '<button class="rhythm-item-action danger" onclick="deleteScheduledTask(\'' + task.id + '\'); renderRhythmDayAutomations();">Delete</button>' +
      '</div>' +
    '</div>';
  }).join('');
  container.innerHTML = html;
}

// Delete a rhythm todo
function deleteRhythmTodo(id) {
  todos = todos.filter(function(t) { return t.id !== id; });
  saveTodos();
  syncToFirebase('todos', todos);
  renderRhythmTodos();
  renderCalendar();
  renderFocusTodos();
  showToast('To-do deleted', 'success');
}

function renderRhythmDayPanel() {
  if (!rhythmSelectedDate) return;
  // v22.39: Use unified renderer
  renderRhythmDayPanelUnified();
}

// v22.39: Unified day panel — events, tasks, automations in one stream
function renderRhythmDayPanelUnified() {
  var container = document.getElementById('rhythmDayUnified');
  if (!container || !rhythmSelectedDate) return;

  var isLifeMode = (localStorage.getItem('roweos_app_mode') || 'brand') === 'life';
  var html = '';

  // --- Events ---
  var dayEvents = getCalendarEventsForDate(rhythmSelectedDate).filter(function(item) {
    if (item.source === 'google' || item.source === 'icloud' || item.source === 'outlook') return true;
    if (isLifeMode) return item.brand === '_life' || item.brand === 'Life';
    return item.brand !== '_life' && item.brand !== 'Life';
  });

  if (dayEvents.length > 0) {
    html += '<div class="rhythm-day-unified-section">';
    html += '<div class="rhythm-day-unified-label"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Events</div>';
    dayEvents.forEach(function(ev) {
      var isExternal = ev.source === 'google' || ev.source === 'icloud' || ev.source === 'outlook';
      var cardClass = isExternal ? 'external-card' : 'event-card';
      var brandColor = isExternal ? (ev.color || '#6366f1') : getBrandColor(ev.brand);
      var clickFn = isExternal ? 'openExternalEventDetail(\'' + ev.id + '\')' : 'openCalendarItem(' + ev.id + ')';

      // Time display
      var timeHtml = '';
      if (ev.allDay) {
        timeHtml = '<span style="color: var(--text-tertiary);">All day</span>';
      } else if (ev.time) {
        timeHtml = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ' + escapeHtml(ev.time);
        if (ev.endTime) timeHtml += ' - ' + escapeHtml(ev.endTime);
      }

      // Source badge
      var sourceBadge = '';
      if (ev.source === 'google') sourceBadge = '<span style="background:#4285f4;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;">Google</span>';
      else if (ev.source === 'icloud') sourceBadge = '<span style="background:#333;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;">iCloud</span>';
      else if (ev.source === 'outlook') sourceBadge = '<span style="background:#0078d4;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;">Outlook</span>';

      // Reminder badge
      var reminderBadge = (ev.reminder && ev.reminder !== '') ? '<span class="rhythm-day-card-meta-item"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> Reminder</span>' : '';

      html += '<div class="rhythm-day-card ' + cardClass + '" onclick="' + clickFn + '">';
      html += '<div class="rhythm-day-card-header">';
      html += '<div class="rhythm-day-card-title">' + escapeHtml(ev.title) + '</div>';
      if (timeHtml) html += '<div class="rhythm-day-card-time">' + timeHtml + '</div>';
      html += '</div>';
      html += '<div class="rhythm-day-card-meta">';
      if (!isExternal) html += '<span class="rhythm-day-card-meta-item"><span style="width:8px;height:8px;border-radius:50%;background:' + brandColor + ';display:inline-block;"></span> ' + escapeHtml(ev.brand || '') + '</span>';
      if (sourceBadge) html += '<span class="rhythm-day-card-meta-item">' + sourceBadge + '</span>';
      if (ev.status && !isExternal) html += '<span class="rhythm-day-card-meta-item" style="text-transform:capitalize;">' + ev.status + '</span>';
      html += reminderBadge;
      if (ev.description) html += '<span class="rhythm-day-card-meta-item" style="width:100%;margin-top:4px;color:var(--text-secondary);line-height:1.4;">' + escapeHtml(ev.description.substring(0, 120)) + '</span>';
      html += '</div>';
      if (!isExternal) {
        html += '<div class="rhythm-day-card-actions">';
        html += '<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); openCalendarItem(' + ev.id + ')" style="font-size:11px;padding:3px 8px;">Edit</button>';
        html += '<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); deleteRhythmEvent(' + ev.id + ')" style="font-size:11px;padding:3px 8px;color:#ef4444;">Delete</button>';
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  }

  // --- Tasks ---
  var dayTodos = todos.filter(function(t) {
    if (t.date !== rhythmSelectedDate) return false;
    if (isLifeMode) return t.brand === '_life' || t.brand === 'Life';
    return t.brand !== '_life' && t.brand !== 'Life';
  });

  if (dayTodos.length > 0) {
    html += '<div class="rhythm-day-unified-section">';
    html += '<div class="rhythm-day-unified-label"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg> Tasks</div>';
    dayTodos.forEach(function(task) {
      var completedClass = task.completed ? ' completed-card' : '';
      html += '<div class="rhythm-day-card task-card' + completedClass + '">';
      html += '<div class="rhythm-day-card-header">';
      html += '<div style="display:flex;align-items:center;gap:8px;">';
      html += '<div class="rhythm-item-checkbox ' + (task.completed ? 'checked' : '') + '" onclick="event.stopPropagation(); toggleRhythmTask(' + task.id + ')" style="width:18px;height:18px;border-radius:4px;border:2px solid ' + (task.completed ? '#22c55e' : 'var(--border-color)') + ';display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;color:#22c55e;flex-shrink:0;">' + (task.completed ? '&#10003;' : '') + '</div>';
      html += '<div class="rhythm-day-card-title">' + escapeHtml(task.text || '') + '</div>';
      html += '</div>';
      html += '</div>';
      html += '<div class="rhythm-day-card-meta">';
      if (task.category) html += '<span class="rhythm-day-card-meta-item"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> ' + escapeHtml(task.category) + '</span>';
      if (task.priority) html += '<span class="rhythm-day-card-meta-item" style="text-transform:capitalize;">' + task.priority + '</span>';
      if (task.description) html += '<span class="rhythm-day-card-meta-item" style="width:100%;margin-top:4px;color:var(--text-secondary);line-height:1.4;">' + escapeHtml((task.description || '').substring(0, 120)) + '</span>';
      html += '</div>';
      html += '<div class="rhythm-day-card-actions">';
      html += '<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); editRhythmTodo(' + task.id + ')" style="font-size:11px;padding:3px 8px;">Edit</button>';
      html += '<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); deleteRhythmTodo(' + task.id + ')" style="font-size:11px;padding:3px 8px;color:#ef4444;">Delete</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // --- Automations (read-only, managed in Automations Lab) ---
  var scheduledTasks = getScheduledTasks();
  var dayAutos = scheduledTasks.filter(function(a) { return a.scheduledDate && a.scheduledDate.slice(0, 10) === rhythmSelectedDate; });

  if (dayAutos.length > 0) {
    html += '<div class="rhythm-day-unified-section">';
    html += '<div class="rhythm-day-unified-label"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Automations</div>';
    dayAutos.forEach(function(auto) {
      var autoTime = auto.time || '';
      html += '<div class="rhythm-day-card automation-card" onclick="editScheduledAutomation(\'' + auto.id + '\')">';
      html += '<div class="rhythm-day-card-header">';
      html += '<div class="rhythm-day-card-title">' + escapeHtml(auto.name || '') + '</div>';
      if (autoTime) html += '<div class="rhythm-day-card-time"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ' + escapeHtml(autoTime) + '</div>';
      html += '</div>';
      html += '<div class="rhythm-day-card-meta">';
      html += '<span class="rhythm-day-card-meta-item">' + (auto.enabled ? '<span style="color:#22c55e;">Active</span>' : '<span style="color:var(--text-muted);">Paused</span>') + '</span>';
      if (auto.frequency && auto.frequency !== 'once') html += '<span class="rhythm-day-card-meta-item" style="text-transform:capitalize;">' + auto.frequency + '</span>';
      if (auto.brand) html += '<span class="rhythm-day-card-meta-item">' + escapeHtml(auto.brand === '_life' ? 'Life' : auto.brand) + '</span>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // --- Empty state ---
  if (!html) {
    html = '<div class="rhythm-day-empty-state">No events, tasks, or automations for this day. Use the buttons above to add something.</div>';
  }

  container.innerHTML = html;
}

// v10.5.25: Inline add functions for day panel sections
function toggleInlineDayAdd(section) {
  var formId = 'inlineDayAdd' + section.charAt(0).toUpperCase() + section.slice(1);
  var form = document.getElementById(formId);
  if (!form) return;
  
  var isVisible = form.style.display !== 'none';
  
  // Hide all other inline forms first
  ['Events', 'Todos'].forEach(function(s) {
    var f = document.getElementById('inlineDayAdd' + s);
    if (f) f.style.display = 'none';
  });
  
  if (!isVisible) {
    form.style.display = 'flex';
    // Populate category dropdown for todos
    if (section === 'todos') {
      populateInlineTodoCategories();
    }
    // Focus the input
    var input = form.querySelector('input[type="text"]');
    if (input) setTimeout(function() { input.focus(); }, 50);
  }
}

function populateInlineTodoCategories() {
  var select = document.getElementById('inlineTodoCategory');
  if (!select) return;
  
  select.innerHTML = '<option value="">Category</option>';
  if (window.todoCategories) {
    window.todoCategories.forEach(function(cat) {
      var option = document.createElement('option');
      option.value = cat.name;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  }
}

function saveInlineDayEvent() {
  var input = document.getElementById('inlineEventInput');
  var timeInput = document.getElementById('inlineEventTimeInput');
  var title = input ? input.value.trim() : '';
  var time = timeInput ? timeInput.value : '';

  if (!title || !rhythmSelectedDate) return;

  var event = {
    id: Date.now(),
    title: title,
    date: rhythmSelectedDate,
    time: time || '',
    brand: brands[parseInt(document.getElementById('brand').value)].name,
    status: 'planned',
    color: '#a89878',
    type: 'event'
  };

  calendar.push(event);
  saveCalendar();
  renderCalendar();
  renderRhythmDayPanel();

  // v22.39: Push to connected external calendars
  if (typeof pushEventToExternalCalendars === 'function') {
    pushEventToExternalCalendars(event);
  }

  // Clear and hide form
  input.value = '';
  if (timeInput) timeInput.value = '';
  document.getElementById('inlineDayAddEvents').style.display = 'none';

  showToast('Event added', 'success');
}

function saveInlineDayTodo() {
  var input = document.getElementById('inlineTodoInput');
  var categorySelect = document.getElementById('inlineTodoCategory');
  var text = input ? input.value.trim() : '';
  var category = categorySelect ? categorySelect.value : null;
  
  if (!text || !rhythmSelectedDate) return;
  
  var todo = {
    id: Date.now(),
    text: text,
    date: rhythmSelectedDate,
    brand: brands[parseInt(document.getElementById('brand').value)].name,
    category: category || null,
    completed: false,
    color: '#22c55e',
    type: 'task',
    createdAt: new Date().toISOString()
  };
  
  todos.push(todo);
  saveTodos();
  renderCalendar();
  renderRhythmDayPanel();
  if (typeof renderFocusTodoList === 'function') renderFocusTodoList();
  
  // Clear and hide form
  input.value = '';
  if (categorySelect) categorySelect.value = '';
  document.getElementById('inlineDayAddTodos').style.display = 'none';
  
  showToast('To-Do added', 'success');
}

function saveInlineDayAutomation() {
  var input = document.getElementById('inlineAutomationInput');
  var actionSelect = document.getElementById('inlineAutomationAction');
  var name = input ? input.value.trim() : '';
  var action = actionSelect ? actionSelect.value : 'none';
  
  if (!name || !rhythmSelectedDate) return;
  
  var tasks = getScheduledTasks();
  var selectedDateObj = new Date(rhythmSelectedDate + 'T12:00:00');
  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  var newTask = {
    id: Date.now(),
    name: name,
    description: '',
    frequency: 'once',
    scheduledDate: rhythmSelectedDate + 'T09:00:00',
    dayOfWeek: dayNames[selectedDateObj.getDay()],
    dayOfMonth: selectedDateObj.getDate(),
    enabled: true,
    action: action,
    color: '#a89878',
    time: '09:00',
    brand: brands[parseInt(document.getElementById('brand').value)].name,
    brandIdx: document.getElementById('brand').value
  };
  
  tasks.push(newTask);
  saveScheduledTasks(tasks);
  renderCalendar();
  renderRhythmDayPanel();
  renderRhythmAutomations();
  
  // Clear and hide form
  input.value = '';
  if (actionSelect) actionSelect.value = 'none';
  document.getElementById('inlineDayAddAutomations').style.display = 'none';
  
  showToast('Automation added', 'success');
}

// Keep old functions for backwards compatibility but they now just toggle inline forms
function addRhythmEventForDate() {
  if (!rhythmSelectedDate) {
    showToast('Please select a date first', 'warning');
    return;
  }
  toggleInlineDayAdd('events');
}

function addRhythmTodoForDate() {
  if (!rhythmSelectedDate) {
    showToast('Please select a date first', 'warning');
    return;
  }
  toggleInlineDayAdd('todos');
}

function addRhythmAutomationForDate() {
  if (!rhythmSelectedDate) {
    showToast('Please select a date first', 'warning');
    return;
  }
  toggleInlineDayAdd('automations');
}

var pendingAddType = null;

function addRhythmEvent() {
  if (!rhythmSelectedDate) return;
  
  pendingAddType = 'event';
  document.getElementById('addItemModalTitle').textContent = 'Add Event';
  document.getElementById('addItemLabel').textContent = 'Event Title';
  document.getElementById('addItemInput').value = '';
  document.getElementById('addItemInput').placeholder = 'Enter event title...';
  document.getElementById('addItemExtraFields').innerHTML = '';
  document.getElementById('addItemModal').classList.add('show');
  
  setTimeout(function() {
    document.getElementById('addItemInput').focus();
  }, 100);
}

function addRhythmTask() {
  if (!rhythmSelectedDate) return;
  
  pendingAddType = 'task';
  document.getElementById('addItemModalTitle').textContent = 'Add Task';
  document.getElementById('addItemLabel').textContent = 'Task Description';
  document.getElementById('addItemInput').value = '';
  document.getElementById('addItemInput').placeholder = 'Enter task description...';
  document.getElementById('addItemExtraFields').innerHTML = '';
  document.getElementById('addItemModal').classList.add('show');
  
  setTimeout(function() {
    document.getElementById('addItemInput').focus();
  }, 100);
}

function closeAddItemModal() {
  document.getElementById('addItemModal').classList.remove('show');
  pendingAddType = null;
}

function confirmAddItem() {
  var value = document.getElementById('addItemInput').value.trim();
  if (!value) {
    closeAddItemModal();
    return;
  }
  
  var brand = document.getElementById('addItemBrand').value;
  
  if (pendingAddType === 'event') {
    var event = {
      id: Date.now(),
      title: value,
      date: rhythmSelectedDate,
      brand: brand,
      status: 'proposed',
      type: 'event'
    };
    
    calendar.push(event);
    saveCalendar();
    renderCalendar();
    renderRhythmDayPanel();
    showToast('Event added', 'success');
  } else if (pendingAddType === 'task') {
    var task = {
      id: Date.now(),
      text: value,
      date: rhythmSelectedDate,
      brand: brand,
      completed: false,
      type: 'task'
    };
    
    todos.push(task);
    saveTodos();
    renderCalendar();
    renderRhythmDayPanel();
    showToast('Task added', 'success');
  }
  
  closeAddItemModal();
}

function deleteRhythmEvent(id) {
  if (!confirm('Delete this event?')) return;
  
  calendar = calendar.filter(function(e) { return e.id !== id; });
  saveCalendar();
  renderCalendar();
  renderRhythmDayPanel();
  showToast('Event deleted', 'success');
}

function toggleRhythmTask(id) {
  var task = todos.find(function(t) { return t.id === id; });
  if (!task) return;
  
  task.completed = !task.completed;
  saveTodos();
  renderRhythmDayPanel();
}

var pendingEditItem = null;
var pendingEditType = null;

function editRhythmTask(id) {
  var task = todos.find(function(t) { return t.id === id; });
  if (!task) return;
  
  pendingEditItem = task;
  pendingEditType = 'task';
  
  document.getElementById('editItemModalTitle').textContent = 'Edit Task';
  document.getElementById('editItemLabel').textContent = 'Task Description';
  document.getElementById('editItemInput').value = task.text || '';
  document.getElementById('editItemExtraFields').innerHTML = '';
  document.getElementById('editItemModal').classList.add('show');
  
  setTimeout(function() {
    document.getElementById('editItemInput').focus();
  }, 100);
}

function editRhythmEvent(id) {
  var event = calendar.find(function(e) { return e.id === id; });
  if (!event) return;
  
  pendingEditItem = event;
  pendingEditType = 'event';
  
  document.getElementById('editItemModalTitle').textContent = 'Edit Event';
  document.getElementById('editItemLabel').textContent = 'Event Title';
  document.getElementById('editItemInput').value = event.title || '';
  document.getElementById('editItemExtraFields').innerHTML = 
    '<label style="display: block; margin-bottom: var(--space-2); color: var(--text-secondary);">Status</label>' +
    '<select id="editItemStatus" class="settings-input" style="width: 100%; margin-bottom: var(--space-4);">' +
      '<option value="proposed"' + (event.status === 'proposed' ? ' selected' : '') + '>Proposed</option>' +
      '<option value="approved"' + (event.status === 'approved' ? ' selected' : '') + '>Approved</option>' +
      '<option value="executed"' + (event.status === 'executed' ? ' selected' : '') + '>Executed</option>' +
    '</select>';
  document.getElementById('editItemModal').classList.add('show');
  
  setTimeout(function() {
    document.getElementById('editItemInput').focus();
  }, 100);
}

function closeEditItemModal() {
  document.getElementById('editItemModal').classList.remove('show');
  pendingEditItem = null;
  pendingEditType = null;
}

function confirmEditItem() {
  var newValue = document.getElementById('editItemInput').value.trim();
  if (!newValue || !pendingEditItem) {
    closeEditItemModal();
    return;
  }
  
  if (pendingEditType === 'task') {
    pendingEditItem.text = newValue;
    saveTodos();
    renderRhythmDayPanel();
    renderCalendar();
    showToast('Task updated', 'success');
  } else if (pendingEditType === 'event') {
    pendingEditItem.title = newValue;
    var statusEl = document.getElementById('editItemStatus');
    if (statusEl) {
      pendingEditItem.status = statusEl.value;
    }
    saveCalendar();
    renderRhythmDayPanel();
    renderCalendar();
    showToast('Event updated', 'success');
  }
  
  closeEditItemModal();
}

function deleteRhythmTask(id) {
  if (!confirm('Delete this task?')) return;
  
  todos = todos.filter(function(t) { return t.id !== id; });
  saveTodos();
  renderCalendar();
  renderRhythmDayPanel();
  showToast('Task deleted', 'success');
}

function setDayViewMode(mode) {
  dayViewMode = mode;
  document.querySelectorAll('.day-toggle-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
  document.getElementById('dayStackView').classList.toggle('hidden', mode !== 'stack');
  document.getElementById('dayHourView').classList.toggle('hidden', mode !== 'hour');
  renderDayView();
}

function renderDayView() {
  if (dayViewMode === 'stack') {
    renderDayStackView();
  } else {
    renderDayHourView();
  }
}

function renderDayStackView() {
  var container = document.getElementById('dayStackList');
  var dayEvents = calendar.filter(function(item) { return item.date === selectedDayDate; });
  var dayTasks = todos.filter(function(t) { return t.date === selectedDayDate; });
  
  var html = '';
  
  // Events section
  if (dayEvents.length > 0) {
    html += '<div class="day-stack-section">';
    html += '<div class="day-stack-section-title">Events</div>';
    dayEvents.forEach(function(event) {
      var brandColor = getBrandColor(event.brand);
      var isSelected = selectedDayItem && selectedDayItem.type === 'event' && selectedDayItem.id === event.id;
      html += '<div class="day-stack-item event ' + (isSelected ? 'selected' : '') + '" style="border-left-color: ' + brandColor + ';" onclick="selectDayItem(\'event\', ' + event.id + ')">';
      html += '<div class="day-stack-content">';
      html += '<div class="day-stack-title">' + event.title + '</div>';
      html += '<div class="day-stack-meta">';
      html += '<span class="day-stack-brand"><span class="day-stack-brand-dot" style="background:' + brandColor + '"></span>' + event.brand + '</span>';
      html += '<span style="text-transform:capitalize">' + event.status + '</span>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  
  // Tasks section
  if (dayTasks.length > 0) {
    html += '<div class="day-stack-section">';
    html += '<div class="day-stack-section-title">☑ Tasks</div>';
    dayTasks.forEach(function(task) {
      var isSelected = selectedDayItem && selectedDayItem.type === 'task' && selectedDayItem.id === task.id;
      html += '<div class="day-stack-item task ' + (task.completed ? 'completed' : '') + ' ' + (isSelected ? 'selected' : '') + '" onclick="selectDayItem(\'task\', ' + task.id + ')">';
      html += '<div class="day-stack-check" onclick="event.stopPropagation();toggleDayTaskComplete(' + task.id + ')">' + (task.completed ? '✓' : '') + '</div>';
      html += '<div class="day-stack-content">';
      html += '<div class="day-stack-title">' + task.text + '</div>';
      if (task.subtasks && task.subtasks.length > 0) {
        var completedSubs = task.subtasks.filter(function(s) { return s.done; }).length;
        html += '<div class="day-stack-meta">' + completedSubs + '/' + task.subtasks.length + ' subtasks</div>';
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  
  if (dayEvents.length === 0 && dayTasks.length === 0) {
    html = '<div class="day-stack-empty">';
    html += '<div style="font-size: var(--text-base); color: var(--text-muted);">No items for this day</div>';
    html += '<div style="margin-top: var(--space-2); font-size: var(--text-sm);">Add a task or event below</div>';
    html += '</div>';
  }
  
  container.innerHTML = html;
}

function renderDayHourView() {
  var container = document.getElementById('dayViewTimeline');
  var html = '';
  
  var dayEvents = calendar.filter(function(item) { return item.date === selectedDayDate; });
  var dayTasks = todos.filter(function(t) { return t.date === selectedDayDate; });
  
  // Render hours 7am to 9pm
  for (var hour = 7; hour <= 21; hour++) {
    // v24.18: Respect time format preference
    var _tfPref = localStorage.getItem('roweos_time_format') || '12h';
    var hourLabel = _tfPref === '24h' ? (hour < 10 ? '0' + hour : hour) + ':00' : (hour === 12 ? '12 PM' : hour > 12 ? (hour - 12) + ' PM' : hour + ' AM');
    html += '<div class="day-hour-row-item" data-hour="' + hour + '">';
    html += '<div class="day-time-label">' + hourLabel + '</div>';
    html += '<div class="day-hour-events"></div>';
    html += '</div>';
  }
  
  container.innerHTML = html;
  
  // Position events
  dayEvents.forEach(function(event) {
    var startHour = event.startHour || 9;
    var duration = event.duration || 1;
    var brandColor = getBrandColor(event.brand);
    
    var eventEl = document.createElement('div');
    eventEl.className = 'day-event-block';
    eventEl.style.top = ((startHour - 7) * 60 + 2) + 'px';
    eventEl.style.height = (duration * 60 - 4) + 'px';
    eventEl.style.background = brandColor + '25';
    eventEl.style.borderLeftColor = brandColor;
    eventEl.onclick = function() { selectDayItem('event', event.id); };
    eventEl.innerHTML = '<div style="font-weight:600">' + event.title + '</div><div style="font-size:11px;opacity:0.7">' + event.brand + '</div>';
    
    var eventsContainer = container.querySelector('.day-hour-row-item[data-hour="' + startHour + '"] .day-hour-events');
    if (eventsContainer) {
      eventsContainer.style.position = 'relative';
      eventsContainer.appendChild(eventEl);
    }
  });
  
  // Render all-day section
  var allDayContainer = document.getElementById('dayViewAllDay');
  var allDayHtml = '';
  dayTasks.forEach(function(task) {
    allDayHtml += '<div class="day-allday-event" style="background: rgba(201,168,108,0.15); color: var(--accent); cursor: pointer;" onclick="selectDayItem(\'task\', ' + task.id + ')">';
    allDayHtml += (task.completed ? '✓ ' : '○ ') + task.text;
    allDayHtml += '</div>';
  });
  if (allDayHtml === '') {
    allDayHtml = '<div style="color: var(--text-muted); font-size: var(--text-sm);">No tasks</div>';
  }
  allDayContainer.innerHTML = allDayHtml;
  
  // Current time indicator
  var today = new Date().toISOString().slice(0, 10);
  if (selectedDayDate === today) {
    var now = new Date();
    var currentHour = now.getHours();
    var currentMinute = now.getMinutes();
    if (currentHour >= 7 && currentHour <= 21) {
      var timeIndicator = document.createElement('div');
      timeIndicator.className = 'day-current-time';
      timeIndicator.style.top = ((currentHour - 7) * 60 + currentMinute) + 'px';
      container.appendChild(timeIndicator);
    }
  }
}

function selectDayItem(type, id) {
  selectedDayItem = { type: type, id: id };
  
  // Update selection in list
  document.querySelectorAll('.day-stack-item').forEach(function(el) { el.classList.remove('selected'); });
  
  if (type === 'event') {
    renderEventSidebar(id);
  } else {
    renderTaskSidebar(id);
  }
  
  renderDayView(); // Re-render to show selection
}

function renderEventSidebar(eventId) {
  var event = calendar.find(function(e) { return e.id === eventId; });
  if (!event) return;
  
  var brandColor = getBrandColor(event.brand);
  var html = '<div class="day-sidebar-detail">';
  html += '<div class="day-sidebar-color-bar" style="background: ' + brandColor + ';"></div>';
  html += '<div class="day-sidebar-title">' + event.title + '</div>';
  html += '<div class="day-sidebar-brand"><span style="width:8px;height:8px;border-radius:50%;background:' + brandColor + ';"></span>' + event.brand + ' • ' + event.status + '</div>';
  
  // Notes
  html += '<div class="day-sidebar-section">';
  html += '<div class="day-sidebar-section-header">Notes</div>';
  html += '<div class="day-sidebar-notes">';
  html += '<textarea placeholder="Add notes..." onchange="updateEventNotes(' + eventId + ', this.value)">' + (event.notes || '') + '</textarea>';
  html += '</div></div>';
  
  // AI Suggestions
  html += '<div class="day-sidebar-section">';
  html += '<div class="day-sidebar-section-header">✦ Suggestions</div>';
  html += '<div class="day-sidebar-suggestions">';
  html += '<div class="day-suggestion-chip" onclick="askAIAboutItem(\'event\', ' + eventId + ', \'help execute\')"><div class="day-suggestion-chip-title">Help execute this</div><div class="day-suggestion-chip-desc">Get step-by-step guidance</div></div>';
  html += '<div class="day-suggestion-chip" onclick="askAIAboutItem(\'event\', ' + eventId + ', \'create content\')"><div class="day-suggestion-chip-title">Create related content</div><div class="day-suggestion-chip-desc">Draft posts, emails, etc.</div></div>';
  html += '</div></div>';
  
  // AI Chat
  html += renderAIChatSection('event', eventId, event.aiChat || []);
  
  // Actions
  html += '<div class="day-sidebar-actions">';
  html += '<button class="btn btn-small" onclick="openCalendarItem(' + eventId + ');closeDayView();">Edit Details</button>';
  html += '<button class="btn btn-secondary btn-small" onclick="exportEventToStudio(' + eventId + ')">Export to Studio</button>';
  html += '<button class="btn btn-secondary btn-small btn-danger" onclick="deleteEvent(' + eventId + ')">Delete</button>';
  html += '</div>';
  html += '</div>';
  
  document.getElementById('dayViewSidebarContent').innerHTML = html;
}

function renderTaskSidebar(taskId) {
  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task) return;
  
  var html = '<div class="day-sidebar-detail">';
  html += '<div class="day-sidebar-color-bar" style="background: var(--accent);"></div>';
  html += '<div class="day-sidebar-title">' + task.text + '</div>';
  // v10.5.25: Show "Life" instead of "_life"
  var brandDisplay = task.brand === '_life' ? 'Life' : (task.brand || 'General Task');
  html += '<div class="day-sidebar-brand">' + brandDisplay + ' • ' + (task.completed ? 'Completed' : 'Pending') + '</div>';
  
  // Notes
  html += '<div class="day-sidebar-section">';
  html += '<div class="day-sidebar-section-header">Notes</div>';
  html += '<div class="day-sidebar-notes">';
  html += '<textarea placeholder="Add notes..." onchange="updateTaskNotes(' + taskId + ', this.value)">' + (task.notes || '') + '</textarea>';
  html += '</div></div>';
  
  // Subtasks
  html += '<div class="day-sidebar-section">';
  html += '<div class="day-sidebar-section-header">Subtasks <span class="day-sidebar-section-action" onclick="addSubtask(' + taskId + ')">+ Add</span></div>';
  html += '<div class="day-subtask-list" id="subtaskList-' + taskId + '">';
  if (task.subtasks && task.subtasks.length > 0) {
    task.subtasks.forEach(function(sub, idx) {
      html += '<div class="day-subtask-item">';
      html += '<div class="day-subtask-check ' + (sub.done ? 'done' : '') + '" onclick="toggleSubtask(' + taskId + ', ' + idx + ')">' + (sub.done ? '✓' : '') + '</div>';
      html += '<span class="day-subtask-text ' + (sub.done ? 'done' : '') + '">' + sub.text + '</span>';
      html += '<span class="day-subtask-delete" onclick="deleteSubtask(' + taskId + ', ' + idx + ')">×</span>';
      html += '</div>';
    });
  } else {
    html += '<div style="color: var(--text-muted); font-size: var(--text-sm); padding: 8px 0;">No subtasks yet</div>';
  }
  html += '</div>';
  html += '<div class="day-subtask-add">';
  html += '<input type="text" id="newSubtask-' + taskId + '" placeholder="Add subtask..." onkeypress="if(event.key===\'Enter\')addSubtaskFromInput(' + taskId + ')">';
  html += '</div></div>';
  
  // AI Suggestions
  html += '<div class="day-sidebar-section">';
  html += '<div class="day-sidebar-section-header">✦ Suggestions</div>';
  html += '<div class="day-sidebar-suggestions">';
  html += '<div class="day-suggestion-chip" onclick="askAIAboutItem(\'task\', ' + taskId + ', \'break down\')"><div class="day-suggestion-chip-title">Break into subtasks</div><div class="day-suggestion-chip-desc">Get actionable steps</div></div>';
  html += '<div class="day-suggestion-chip" onclick="askAIAboutItem(\'task\', ' + taskId + ', \'help complete\')"><div class="day-suggestion-chip-title">Help complete this</div><div class="day-suggestion-chip-desc">Get guidance and tips</div></div>';
  html += '</div></div>';
  
  // AI Chat
  html += renderAIChatSection('task', taskId, task.aiChat || []);
  
  // Actions
  html += '<div class="day-sidebar-actions">';
  html += '<button class="btn btn-small" onclick="toggleDayTaskComplete(' + taskId + ')">' + (task.completed ? 'Mark Incomplete' : 'Complete') + '</button>';
  html += '<button class="btn btn-secondary btn-small" onclick="exportTaskToStudio(' + taskId + ')">Export to Studio</button>';
  html += '<button class="btn btn-secondary btn-small btn-danger" onclick="deleteDayTask(' + taskId + ')">Delete</button>';
  html += '</div>';
  html += '</div>';
  
  document.getElementById('dayViewSidebarContent').innerHTML = html;
}

function renderAIChatSection(type, id, messages) {
  var html = '<div class="day-sidebar-section">';
  html += '<div class="day-sidebar-section-header">💬 Quick AI Chat <span class="day-sidebar-section-action" onclick="clearAIChat(\'' + type + '\', ' + id + ')">Clear</span></div>';
  html += '<div class="day-ai-chat">';
  html += '<div class="day-ai-chat-messages" id="aiChatMessages-' + type + '-' + id + '">';
  if (messages.length === 0) {
    html += '<div class="day-ai-chat-empty">Ask a question about this ' + type + '</div>';
  } else {
    messages.forEach(function(msg) {
      html += '<div class="day-ai-message ' + msg.role + '">' + msg.content + '</div>';
    });
  }
  html += '</div>';
  html += '<div class="day-ai-chat-input">';
  html += '<input type="text" id="aiChatInput-' + type + '-' + id + '" placeholder="Ask something..." onkeypress="if(event.key===\'Enter\')sendAIChat(\'' + type + '\', ' + id + ')">';
  html += '<button class="btn btn-small" onclick="sendAIChat(\'' + type + '\', ' + id + ')">Send</button>';
  html += '</div>';
  html += '</div></div>';
  return html;
}

function resetDaySidebar() {
  var brand = brands[document.getElementById('brand').value] || brands[0];
  var date = new Date(selectedDayDate + 'T12:00:00');
  var dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  
  var html = '<div class="day-sidebar-welcome">';
  html += '<div class="day-sidebar-welcome-title">✦ AI Suggestions</div>';
  html += '<div class="day-sidebar-welcome-subtitle">Ideas for ' + brand.name + '</div>';
  html += '</div>';
  
  html += '<div class="day-sidebar-suggestions-list">';
  
  var suggestions = getAISuggestionsForDay(brand.name, dayName);
  suggestions.forEach(function(sug) {
    html += '<div class="day-sidebar-suggestion-card" onclick="addSuggestionAsTask(\'' + sug.title.replace(/'/g, "\\'") + '\')">';
    html += '<div class="day-sidebar-suggestion-title">' + sug.title + '</div>';
    html += '<div class="day-sidebar-suggestion-desc">' + sug.description + '</div>';
    html += '<div class="day-sidebar-suggestion-action">+ Add as task</div>';
    html += '</div>';
  });
  
  html += '</div>';
  
  html += '<div class="day-sidebar-tip">';
  html += '<div class="day-sidebar-tip-icon">◆</div>';
  html += '<div class="day-sidebar-tip-text">Click any item on the left to view details, add notes, subtasks, and chat with AI.</div>';
  html += '</div>';
  
  document.getElementById('dayViewSidebarContent').innerHTML = html;
}

function getAISuggestionsForDay(brandName, dayName) {
  // v13.0: Generic brand management suggestions personalized with brand name
  var genericSuggestions = [
    { title: 'Review ' + brandName + ' strategy', description: 'Analyze brand metrics and identify growth opportunities.' },
    { title: 'Plan content for ' + brandName, description: 'Schedule upcoming content and campaigns.' },
    { title: 'Client relationship check', description: 'Reach out to strengthen key ' + brandName + ' relationships.' }
  ];

  var daySpecific = [];
  if (dayName === 'Monday') {
    daySpecific.push({ title: 'Weekly planning', description: 'Set priorities and key objectives for the week ahead.' });
  } else if (dayName === 'Friday') {
    daySpecific.push({ title: 'Week-in-review', description: 'Reflect on wins and prepare for next week.' });
  }

  return daySpecific.concat(genericSuggestions).slice(0, 4);
}

// Subtask functions
function addSubtask(taskId) {
  var input = document.getElementById('newSubtask-' + taskId);
  if (input) input.focus();
}

function addSubtaskFromInput(taskId) {
  var input = document.getElementById('newSubtask-' + taskId);
  var text = input.value.trim();
  if (!text) return;
  
  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task.subtasks) task.subtasks = [];
  task.subtasks.push({ text: text, done: false });
  saveTodos();
  input.value = '';
  renderTaskSidebar(taskId);
  renderDayView();
}

function toggleSubtask(taskId, idx) {
  var task = todos.find(function(t) { return t.id === taskId; });
  if (task && task.subtasks && task.subtasks[idx]) {
    task.subtasks[idx].done = !task.subtasks[idx].done;
    saveTodos();
    renderTaskSidebar(taskId);
  }
}

function deleteSubtask(taskId, idx) {
  var task = todos.find(function(t) { return t.id === taskId; });
  if (task && task.subtasks) {
    task.subtasks.splice(idx, 1);
    saveTodos();
    renderTaskSidebar(taskId);
    renderDayView();
  }
}

// AI Chat functions
function sendAIChat(type, id) {
  var input = document.getElementById('aiChatInput-' + type + '-' + id);
  var question = input.value.trim();
  if (!question) return;
  
  var item = type === 'task' ? todos.find(function(t) { return t.id === id; }) : calendar.find(function(e) { return e.id === id; });
  if (!item) return;
  
  if (!item.aiChat) item.aiChat = [];
  item.aiChat.push({ role: 'user', content: question });
  
  // Simulate AI response
  var response = generateAIResponse(type, item, question);
  item.aiChat.push({ role: 'assistant', content: response });
  
  if (type === 'task') saveTodos();
  else saveCalendar();
  
  input.value = '';
  if (type === 'task') renderTaskSidebar(id);
  else renderEventSidebar(id);
}

function generateAIResponse(type, item, question) {
  var title = type === 'task' ? item.text : item.title;
  var q = question.toLowerCase();
  
  if (q.includes('break') || q.includes('subtask') || q.includes('step')) {
    return 'For "' + title + '", consider these steps: 1) Research and gather requirements, 2) Draft initial plan or outline, 3) Execute the main work, 4) Review and refine, 5) Finalize and document results.';
  } else if (q.includes('help') || q.includes('how')) {
    return 'To complete "' + title + '": Start by clarifying the end goal, then break it into smaller actions. Focus on one step at a time, and don\'t hesitate to delegate or use templates where possible.';
  } else if (q.includes('idea') || q.includes('suggest')) {
    return 'Some ideas for "' + title + '": Consider your target audience, look at what competitors are doing, leverage your brand\'s unique strengths, and focus on delivering genuine value.';
  } else if (q.includes('priority') || q.includes('important')) {
    return 'To prioritize "' + title + '": Consider urgency, impact on business goals, dependencies with other tasks, and available resources. This seems like a medium-high priority given its nature.';
  } else {
    return 'For "' + title + '": This is a great ' + type + ' to focus on. Consider the impact it will have, and make sure to allocate dedicated time for it. Break it down if it feels overwhelming.';
  }
}

function clearAIChat(type, id) {
  var item = type === 'task' ? todos.find(function(t) { return t.id === id; }) : calendar.find(function(e) { return e.id === id; });
  if (item) {
    item.aiChat = [];
    if (type === 'task') { saveTodos(); renderTaskSidebar(id); }
    else { saveCalendar(); renderEventSidebar(id); }
  }
}

function askAIAboutItem(type, id, prompt) {
  var input = document.getElementById('aiChatInput-' + type + '-' + id);
  if (input) {
    input.value = 'Please ' + prompt + ' for this ' + type;
    sendAIChat(type, id);
  }
}

// Other day view functions
function updateEventNotes(eventId, notes) {
  var event = calendar.find(function(e) { return e.id === eventId; });
  if (event) { event.notes = notes; saveCalendar(); }
}

function updateTaskNotes(taskId, notes) {
  var task = todos.find(function(t) { return t.id === taskId; });
  if (task) { task.notes = notes; saveTodos(); }
}

function toggleDayTaskComplete(taskId) {
  var task = todos.find(function(t) { return t.id === taskId; });
  if (task) {
    task.completed = !task.completed;
    saveTodos();
    renderDayView();
    if (selectedDayItem && selectedDayItem.type === 'task' && selectedDayItem.id === taskId) {
      renderTaskSidebar(taskId);
    }
    updateFocusTodos();
    showToast(task.completed ? 'Task completed!' : 'Task uncompleted', 'success');
  }
}

function deleteDayTask(taskId) {
  if (confirm('Delete this task?')) {
    todos = todos.filter(function(t) { return t.id !== taskId; });
    saveTodos();
    renderDayView();
    resetDaySidebar();
    updateFocusTodos();
    showToast('Task deleted', 'info');
  }
}

function deleteEvent(eventId) {
  if (confirm('Delete this event?')) {
    calendar = calendar.filter(function(e) { return e.id !== eventId; });
    saveCalendar();
    renderDayView();
    resetDaySidebar();
    renderCalendar();
    showToast('Event deleted', 'info');
  }
}

function exportTaskToStudio(taskId) {
  var task = todos.find(function(t) { return t.id === taskId; });
  if (!task) return;
  
  var content = '<h2>' + escapeHtml(task.text) + '</h2>';
  // v10.5.25: Show "Life" instead of "_life"
  var brandDisplay = task.brand === '_life' ? 'Life' : (task.brand || 'General');
  content += '<p><strong>Brand:</strong> ' + escapeHtml(brandDisplay) + '</p>';
  content += '<p><strong>Status:</strong> ' + (task.completed ? 'Completed' : 'Pending') + '</p>';
  
  if (task.notes) {
    content += '<h3>Notes</h3><p>' + escapeHtml(task.notes).replace(/\n/g, '<br>') + '</p>';
  }
  
  if (task.subtasks && task.subtasks.length > 0) {
    content += '<h3>Subtasks</h3><ul>';
    task.subtasks.forEach(function(sub) {
      content += '<li>' + (sub.done ? '✓ ' : '☐ ') + escapeHtml(sub.text) + '</li>';
    });
    content += '</ul>';
  }
  
  if (task.aiChat && task.aiChat.length > 0) {
    content += '<h3>AI Conversation</h3>';
    task.aiChat.forEach(function(msg) {
      if (msg.role === 'user') {
        content += '<p><strong>You:</strong> ' + escapeHtml(msg.content) + '</p>';
      } else {
        content += '<p><em>' + msg.content + '</em></p>';
      }
    });
  }
  
  document.getElementById('studioOutputContent').innerHTML = '<div class="output-canvas">' + content + '</div>';
  closeDayView();
  showView('studio');
  showToast('Exported to Studio', 'success');
}

function exportEventToStudio(eventId) {
  var event = calendar.find(function(e) { return e.id === eventId; });
  if (!event) return;
  
  var brandColor = getBrandColor(event.brand);
  var content = '<h2>' + escapeHtml(event.title) + '</h2>';
  content += '<p><strong>Brand:</strong> ' + escapeHtml(event.brand || 'Unassigned') + '</p>';
  content += '<p><strong>Date:</strong> ' + event.date + '</p>';
  content += '<p><strong>Status:</strong> ' + event.status + '</p>';
  
  if (event.notes) {
    content += '<h3>Notes</h3><p>' + escapeHtml(event.notes).replace(/\n/g, '<br>') + '</p>';
  }
  
  if (event.aiChat && event.aiChat.length > 0) {
    content += '<h3>AI Conversation</h3>';
    event.aiChat.forEach(function(msg) {
      if (msg.role === 'user') {
        content += '<p><strong>You:</strong> ' + escapeHtml(msg.content) + '</p>';
      } else {
        content += '<p><em>' + msg.content + '</em></p>';
      }
    });
  }
  
  document.getElementById('studioOutputContent').innerHTML = '<div class="output-canvas">' + content + '</div>';
  closeDayView();
  showView('studio');
  showToast('Exported to Studio', 'success');
}

var dayAddType = 'task';

function openDayAddForm() {
  document.querySelector('.day-add-btn').classList.add('hidden');
  document.getElementById('dayAddForm').classList.remove('hidden');
  
  // Populate brand dropdown
  var brandSelect = document.getElementById('dayAddBrand');
  brandSelect.innerHTML = '<option value="">Select Brand (optional)...</option>';
  brands.forEach(function(brand, idx) {
    var selected = idx === parseInt(document.getElementById('brand').value);
    brandSelect.innerHTML += '<option value="' + idx + '" ' + (selected ? 'selected' : '') + '>' + brand.name + '</option>';
  });
  
  // Reset form
  document.getElementById('dayAddTitle').value = '';
  document.getElementById('dayAddNotes').value = '';
  setDayAddType('task');
  
  // Focus the input
  setTimeout(function() {
    document.getElementById('dayAddTitle').focus();
  }, 100);
}

function closeDayAddForm() {
  document.getElementById('dayAddForm').classList.add('hidden');
  document.querySelector('.day-add-btn').classList.remove('hidden');
}

function setDayAddType(type) {
  dayAddType = type;
  document.querySelectorAll('.day-type-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  
  // Update placeholder
  var placeholder = type === 'task' ? 'What needs to be done?' : 'Event title...';
  document.getElementById('dayAddTitle').placeholder = placeholder;
}

function submitDayAddForm() {
  var title = document.getElementById('dayAddTitle').value.trim();
  if (!title) {
    showToast('Please enter a title', 'error');
    return;
  }
  
  var brandIdx = document.getElementById('dayAddBrand').value;
  var brandName = brandIdx !== '' ? brands[brandIdx].name : null;
  var notes = document.getElementById('dayAddNotes').value.trim();
  
  if (dayAddType === 'task') {
    todos.push({
      id: Date.now(),
      text: title,
      completed: false,
      date: selectedDayDate,
      brand: brandName,
      notes: notes || '',
      subtasks: [],
      aiChat: []
    });
    saveTodos();
  } else {
    calendar.push({
      id: Date.now(),
      title: title,
      date: selectedDayDate,
      brand: brandName || (brands.length > 0 ? brands[0].name : ''),
      status: 'proposed',
      notes: notes || '',
      startHour: 10,
      duration: 1,
      aiChat: []
    });
    saveCalendar();
  }
  
  closeDayAddForm();
  renderDayView();
  updateFocusTodos();
  showToast((dayAddType === 'task' ? 'Task' : 'Event') + ' added', 'success');
}

function dayViewPrev() {
  var date = new Date(selectedDayDate + 'T12:00:00');
  date.setDate(date.getDate() - 1);
  openDayView(date.toISOString().slice(0, 10));
}

function dayViewNext() {
  var date = new Date(selectedDayDate + 'T12:00:00');
  date.setDate(date.getDate() + 1);
  openDayView(date.toISOString().slice(0, 10));
}

function dayViewToday() {
  openDayView(new Date().toISOString().slice(0, 10));
}

function closeDayView() {
  document.getElementById('dayViewModal').classList.remove('show');
}

function addSuggestionAsTask(title) {
  var brand = brands[document.getElementById('brand').value];
  todos.push({
    id: Date.now(),
    text: title,
    completed: false,
    date: selectedDayDate,
    brand: brand ? brand.name : (brands.length > 0 ? brands[0].name : ''),
    subtasks: [],
    aiChat: []
  });
  saveTodos();
  renderDayView();
  updateFocusTodos();
  showToast('Task added from suggestion', 'success');
}

function sendCalendarToAgent() {
  var item = calendar.find(function(c) { return c.id === editingCalendarItemId; });
  if (!item) return;
  
  // Find brand index
  var brandIdx = brands.findIndex(function(b) { return b.name === item.brand; });
  if (brandIdx === -1) brandIdx = 0;
  
  // Set brand
  document.getElementById('brand').value = brandIdx;
  document.getElementById('agentBrand').value = brandIdx;
  
  // Build the prompt
  var prompt = 'I need help executing this task:\n\n';
  prompt += '📋 ' + item.title + '\n';
  prompt += 'Date: ' + item.date + '\n';
  prompt += '🏷️ Brand: ' + item.brand + '\n';
  prompt += 'Status: ' + item.status + '\n';
  if (item.notes) {
    prompt += 'Notes: ' + item.notes + '\n';
  }
  prompt += '\nPlease help me complete this task.';
  
  // Close modal and go to agent
  closeCalendarItemModal();
  showView('agent');
  
  // Pre-fill the agent input
  document.getElementById('agentCommand').value = prompt;
  document.getElementById('agentCommand').focus();
  
  showToast('Sent to BrandAI - press Enter to execute', 'success');
}

function sendCalendarToStudio() {
  var item = calendar.find(function(c) { return c.id === editingCalendarItemId; });
  if (!item) return;
  
  // Find brand index
  var brandIdx = brands.findIndex(function(b) { return b.name === item.brand; });
  if (brandIdx === -1) brandIdx = 0;
  
  // Set brand
  document.getElementById('brand').value = brandIdx;
  document.getElementById('studioBrand').value = brandIdx;
  studioSelectedBrand = brandIdx;
  
  // Try to find a matching operation - first try exact match on opName (from proposed schedules)
  var matchedOp = null;
  if (item.opName) {
    matchedOp = ops.find(function(op) { return op.name === item.opName; });
  }
  
  // If no exact match, try fuzzy matching on title
  if (!matchedOp) {
    matchedOp = ops.find(function(op) {
      return item.title.toLowerCase().includes(op.name.toLowerCase()) ||
             op.name.toLowerCase().includes(item.title.toLowerCase());
    });
  }
  
  // Build context from calendar item
  var context = 'From Calendar Item:\n';
  context += 'Scheduled: ' + item.date + '\n';
  context += 'Status: ' + item.status + '\n';
  if (item.notes) {
    context += 'Notes: ' + item.notes;
  }
  
  // Close modal and go to studio
  closeCalendarItemModal();
  showView('studio');
  renderOperations();
  
  // Set context
  var _ctx = document.getElementById('studioContext'); if (_ctx) _ctx.value = context;
  
  // If we found a matching operation, select it
  if (matchedOp) {
    selectedOp = matchedOp;
    renderOperations();
    
    // Scroll to and highlight the card
    setTimeout(function() {
      var card = document.querySelector('.op-card[data-op-id="' + matchedOp.id + '"]');
      if (card) {
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    showToast('Operation "' + matchedOp.name + '" selected - click Run to execute', 'success');
  } else {
    showToast('Select an Agent task and click Execute', 'info');
  }
}

function saveCalendarItem() {
  var title = document.getElementById('calItemTitle').value.trim();
  var date = document.getElementById('calItemDate').value;
  var time = document.getElementById('calItemTime').value || '';
  var endTime = document.getElementById('calItemEndTime') ? document.getElementById('calItemEndTime').value || '' : '';
  var allDay = document.getElementById('calItemAllDay').checked;
  var brand = document.getElementById('calItemBrand').value;
  var status = document.getElementById('calItemStatus').value;
  var notes = document.getElementById('calItemNotes').value.trim();
  var reminderSel = document.getElementById('calItemReminder');
  var reminder = reminderSel ? reminderSel.value : '';

  if (!title) {
    showToast('Please enter a title', 'warning');
    return;
  }
  if (!date) {
    showToast('Please select a date', 'warning');
    return;
  }

  if (allDay) { time = ''; endTime = ''; }

  // v24.26: Read selected calendar
  var selectedCalendar = 'roweos';
  var calSelEl = document.getElementById('calItemCalendar');
  if (calSelEl) selectedCalendar = calSelEl.value;

  var calSyncTargets = [];
  // v24.26: If a non-local calendar is selected, auto-add its provider as a sync target
  if (selectedCalendar !== 'roweos') {
    if (selectedCalendar.indexOf('gcal_') === 0) calSyncTargets.push('google');
    else if (selectedCalendar.indexOf('icloud_') === 0) calSyncTargets.push('icloud');
    else if (selectedCalendar.indexOf('outlook_') === 0) calSyncTargets.push('outlook');
  }
  document.querySelectorAll('#calItemSyncCalendars input[type="checkbox"]:checked').forEach(function(cb) {
    if (calSyncTargets.indexOf(cb.value) === -1) calSyncTargets.push(cb.value);
  });

  if (editingCalendarItemId) {
    var item = calendar.find(function(c) { return c.id === editingCalendarItemId; });
    if (item) {
      item.title = title;
      item.date = date;
      item.time = time;
      item.endTime = endTime;
      item.allDay = allDay;
      item.brand = brand;
      item.status = status;
      item.notes = notes;
      item.reminder = reminder;
      item.calendarTarget = selectedCalendar;
      // v22.39: Push to selected external calendars
      if (calSyncTargets.length > 0) {
        pushToSelectedCalendars(item, calSyncTargets);
      }
      if (reminder !== '' && time) scheduleEventReminder(item);
      showToast('Item updated', 'success');
    }
  } else {
    var newItem = {
      id: Date.now(),
      title: title,
      date: date,
      time: time,
      endTime: endTime,
      allDay: allDay,
      brand: brand,
      status: status,
      notes: notes,
      reminder: reminder,
      calendarTarget: selectedCalendar,
      createdAt: new Date().toISOString()
    };
    calendar.push(newItem);
    if (calSyncTargets.length > 0) {
      pushToSelectedCalendars(newItem, calSyncTargets);
    }
    if (reminder !== '' && time) scheduleEventReminder(newItem);
    showToast('Item added', 'success');
  }

  saveRuns();
  renderCalendar();
  renderFocusTodayRhythm();
  closeCalendarItemModal();
}

// v22.39: Push event to specific selected calendars
function pushToSelectedCalendars(event, targets) {
  var pushed = [];
  targets.forEach(function(target) {
    if (target === 'google' && _gcalConnected && _gcalAccessToken) {
      pushEventToGoogleCalendar(event);
      pushed.push('Google');
    } else if (target === 'icloud' && _icloudConnected && _icloudCalendars.length > 0) {
      pushEventToICloudCalendar(event);
      pushed.push('iCloud');
    } else if (target === 'outlook' && _outlookCalConnected) {
      pushEventToOutlookCalendar(event);
      pushed.push('Outlook');
    }
  });
  if (pushed.length > 0) {
    showToast('Synced to ' + pushed.join(', '), 'success');
  }
}

function deleteCalendarItem() {
  if (!editingCalendarItemId) return;
  
  var idx = calendar.findIndex(function(c) { return c.id === editingCalendarItemId; });
  if (idx !== -1) {
    calendar.splice(idx, 1);
    saveRuns();
    renderCalendar();
    showToast('Item deleted', 'info');
  }
  
  closeCalendarItemModal();
}

function clearCalendar() {
  if (calendar.length === 0) {
    showToast('Calendar is already empty', 'info');
    return;
  }
  
  if (confirm('Are you sure you want to clear all ' + calendar.length + ' calendar items?')) {
    calendar = [];
    saveRuns();
    renderCalendar();
    showToast('Calendar cleared', 'info');
  }
}

function approveItem(id) {
  var item = calendar.find(function(c) { return c.id === id; });
  if (item) {
    item.status = 'approved';
    saveRuns();
    renderCalendar();
    showToast('Item approved', 'success');
  }
}

function executeItem(id) {
  var item = calendar.find(function(c) { return c.id === id; });
  if (item) {
    item.status = 'executed';
    saveRuns();
    renderCalendar();
    showToast('Item executed', 'success');
  }
}

// File upload state - v10.5.33: Arrays for multiple file support
var currentAgentFile = null;
var currentAgentFileContent = null;
var currentAgentFiles = []; // Array of {file, content, status}
var currentFollowupFile = null;
var currentFollowupFileContent = null;
var currentStudioFile = null;
var currentStudioFileContent = null;
var currentStudioFiles = []; // Array of {file, content, status}
var brandAIActive = true;
var deepResearchActive = false;

function toggleDeepResearch() {
  deepResearchActive = !deepResearchActive;
  window._deepResearchActive = deepResearchActive;
  updateDeepResearchUI();
  showToast(deepResearchActive ? 'Deep Research mode enabled - responses will take 5-30 minutes' : 'Deep Research mode disabled', 'info');
}

// v16.6: Reset deep research UI without toggling (for completion handlers)
function resetDeepResearchUI() {
  deepResearchActive = false;
  window._deepResearchActive = false;
  updateDeepResearchUI();
}

// v16.8: Update all deep research UI elements to match current state
function updateDeepResearchUI() {
  var btns = [document.getElementById('deepResearchToggle'), document.getElementById('landingDeepResearchToggle')];
  btns.forEach(function(toggle) {
    if (!toggle) return;
    if (deepResearchActive) {
      // v24.20: Purple circle when active
      toggle.style.setProperty('display', 'inline-flex', 'important');
      toggle.style.setProperty('background', 'linear-gradient(135deg,#7c3aed,#a78bfa)', 'important');
      toggle.style.setProperty('color', 'white', 'important');
      toggle.style.setProperty('border', '2px solid rgba(167,139,250,0.5)', 'important');
      toggle.style.setProperty('border-radius', '50%');
      toggle.style.setProperty('padding', '0');
      toggle.style.setProperty('width', '36px');
      toggle.style.setProperty('height', '36px');
      var svg = toggle.querySelector('svg');
      if (svg) svg.style.setProperty('stroke', '#ffffff', 'important');
    } else {
      // v24.20: Match standard circle button style
      toggle.style.cssText = 'display:inline-flex;';
      var svg = toggle.querySelector('svg');
      if (svg) svg.style.removeProperty('stroke');
    }
  });
  // v16.8: Hide response length toggle when deep research active (saves space, always detailed)
  var lengthWrapper = document.querySelector('.chat-length-wrapper');
  if (lengthWrapper) lengthWrapper.style.display = deepResearchActive ? 'none' : '';
  // v16.10: Deep research avatars now use .research-icon/.research-label classes
  // (bypasses gold .avatar-icon CSS entirely — no specificity battle needed)
  // Mobile header brand pill
  var mobileBrandPill = document.querySelector('.mobile-brand-pill');
  if (mobileBrandPill) {
    if (deepResearchActive) {
      mobileBrandPill.setAttribute('data-research-active', 'true');
    } else {
      mobileBrandPill.removeAttribute('data-research-active');
    }
  }
}

function updateDeepResearchButton() {
  var toggle = document.getElementById('deepResearchToggle');
  var landingToggle = document.getElementById('landingDeepResearchToggle');

  // v15.13: Deep Research ONLY for Gemini 3.x Pro
  var brandIdx = parseInt((document.getElementById('agentBrand') || {}).value || '0');
  var settings = brandSettings[brandIdx] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };

  var model = settings.model || '';
  // v16.2: Match gemini-3-* and gemini-3.1-*, exclude image models
  var isSupported = model.indexOf('gemini-3') === 0 && model.indexOf('image') === -1;

  if (isSupported) {
    if (toggle) toggle.style.display = 'inline-flex';
    if (landingToggle) landingToggle.style.display = 'inline-flex';
  } else {
    if (toggle) toggle.style.display = 'none';
    if (landingToggle) landingToggle.style.display = 'none';
    deepResearchActive = false;
  }
}

function updateAPIsStatus() {
  var pill = document.getElementById('apisStatusText');
  var pillLanding = document.getElementById('apisStatusTextLanding');
  var pillContainerLanding = document.getElementById('apisStatusPillLanding');
  
  // Check which API keys exist
  var hasAnthropic = localStorage.getItem('roweos_anthropic_key');
  var hasOpenAI = localStorage.getItem('roweos_openai_key');
  var hasGoogle = localStorage.getItem('roweos_google_key');
  
  var activeAPIs = [];
  if (hasAnthropic) activeAPIs.push('Anthropic');
  if (hasOpenAI) activeAPIs.push('OpenAI');
  if (hasGoogle) activeAPIs.push('Google');
  
  if (activeAPIs.length === 0) {
    // Hide the APIs status pill when no APIs configured
    if (pillContainerLanding) pillContainerLanding.parentElement.style.display = 'none';
  } else {
    // Show and update the APIs status pill
    var text = activeAPIs.join(', ');
    if (pill) pill.textContent = text;
    if (pillLanding) pillLanding.textContent = text;
    if (pillContainerLanding) pillContainerLanding.parentElement.style.display = 'block';
  }

  // v13.9: Update Nanobanana key status in settings
  // v24.11: Reflects toggle state (key stored but generation disabled)
  var nanoStatus = document.getElementById('nanobananaKeyStatus');
  if (nanoStatus) {
    var hasKey = typeof hasNanobananaKeyStored === 'function' && hasNanobananaKeyStored();
    var genEnabled = typeof isImageGenEnabled === 'function' && isImageGenEnabled();
    if (hasKey && genEnabled) {
      nanoStatus.textContent = 'Connected';
      nanoStatus.style.color = '#a89878';
      nanoStatus.style.fontWeight = '600';
    } else if (hasKey && !genEnabled) {
      nanoStatus.textContent = 'Key saved - generation disabled';
      nanoStatus.style.color = 'var(--text-muted)';
      nanoStatus.style.fontWeight = '500';
    } else {
      nanoStatus.textContent = 'Not configured';
      nanoStatus.style.color = 'var(--text-muted)';
      nanoStatus.style.fontWeight = '400';
    }
  }
}

function openCustomOperationModal() {
  var modal = document.getElementById('customOpModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    
    // Reset form
    document.getElementById('customOpName').value = '';
    document.getElementById('customOpDesc').value = '';
    document.getElementById('customOpCategory').value = 'strategic';
    document.getElementById('customOpPrompt').value = '';
    
    // Reset outputs list to single input
    var outputsList = document.getElementById('customOpOutputsList');
    outputsList.innerHTML = '<input type="text" class="custom-op-output" placeholder="Output 1" style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--text-base);">';
  }
}

function closeCustomOpModal() {
  var modal = document.getElementById('customOpModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

function addCustomOpOutput() {
  var outputsList = document.getElementById('customOpOutputsList');
  var currentCount = outputsList.querySelectorAll('.custom-op-output').length;
  var newInput = document.createElement('input');
  newInput.type = 'text';
  newInput.className = 'custom-op-output';
  newInput.placeholder = 'Output ' + (currentCount + 1);
  newInput.style.cssText = 'width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--text-base);';
  outputsList.appendChild(newInput);
}

function saveCustomOperation() {
  var name = document.getElementById('customOpName').value.trim();
  var desc = document.getElementById('customOpDesc').value.trim();
  var category = document.getElementById('customOpCategory').value;
  var prompt = document.getElementById('customOpPrompt').value.trim();
  
  if (!name) {
    showToast('Please enter an operation name', 'error');
    return;
  }
  
  if (!prompt) {
    showToast('Please enter a prompt template', 'error');
    return;
  }
  
  // Collect outputs
  var outputs = [];
  document.querySelectorAll('.custom-op-output').forEach(function(input) {
    if (input.value.trim()) {
      outputs.push(input.value.trim());
    }
  });
  
  if (outputs.length === 0) {
    outputs = ['Generated content'];
  }
  
  // Load existing custom operations
  var customOps = JSON.parse(localStorage.getItem('roweos_custom_operations') || '[]');
  
  // Create new operation
  var newOp = {
    id: 1000 + customOps.length,
    name: name,
    desc: desc,
    category: category,
    brand: null,
    outputs: outputs,
    promptTemplate: prompt,
    custom: true,
    isSocialOp: category === 'social',
    createdAt: Date.now()
  };
  
  customOps.push(newOp);
  localStorage.setItem('roweos_custom_operations', JSON.stringify(customOps));
  
  // Add to operations list
  operations.push(newOp);
  
  // Refresh Studio
  renderStudioOperations();
  
  showToast('Custom operation "' + name + '" created!', 'success');
  closeCustomOpModal();
}




// v12.0.2: Fixed web search toggle to save to correct keys
function toggleWebSearch(provider, enabled) {
  // Store in both formats for compatibility
  var webSearchPrefs = JSON.parse(localStorage.getItem('roweos_web_search_prefs') || '{}');
  webSearchPrefs[provider] = enabled;
  localStorage.setItem('roweos_web_search_prefs', JSON.stringify(webSearchPrefs));

  // Also save to the individual keys that the API code reads from
  if (provider === 'claude') {
    localStorage.setItem('roweos_claude_web_search', enabled ? 'true' : 'false');
  } else if (provider === 'gemini') {
    localStorage.setItem('roweos_gemini_web_search', enabled ? 'true' : 'false');
  }

  // v25.1: Write-through to Firestore (replaces deprecated syncToFirebase)
  if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    writeDB('profile/main', { 'settings.webSearchPrefs': webSearchPrefs, 'settings.claudeWebSearch': localStorage.getItem('roweos_claude_web_search') === 'true', 'settings.geminiWebSearch': localStorage.getItem('roweos_gemini_web_search') === 'true' });
  }

  var message = enabled ?
    'Web search enabled for ' + (provider === 'claude' ? 'Claude' : 'Gemini') :
    'Web search disabled for ' + (provider === 'claude' ? 'Claude' : 'Gemini');
  showToast(message, 'info');
}

// v12.0.2: Generic feature toggle function for autoPilot, responseCache, etc.
function toggleFeature(featureName, enabled) {
  var key = 'roweos_feature_' + featureName;
  localStorage.setItem(key, enabled ? 'true' : 'false');

  // v25.1: Write-through to Firestore (replaces deprecated syncToFirebase)
  if (typeof writeDB === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
    var settingsUpdate = {};
    settingsUpdate['settings.' + featureName] = enabled;
    writeDB('profile/main', settingsUpdate);
  }

  var displayName = featureName === 'autoPilot' ? 'Auto-Pilot Mode' :
                    featureName === 'responseCache' ? 'Response Caching' : featureName;
  showToast(displayName + (enabled ? ' enabled' : ' disabled'), 'info');
}

// ═══════════════════════════════════════════════════════════════════════════════
// v12.0.3: RESPONSE CACHING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function generateCacheKey(messages, systemPrompt) {
  // Create a hash from the last user message + system prompt summary
  var lastUserMsg = '';
  for (var i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserMsg = typeof messages[i].content === 'string' ? messages[i].content : JSON.stringify(messages[i].content);
      break;
    }
  }
  // Simple hash function
  var str = lastUserMsg + '|' + (systemPrompt || '').substring(0, 200);
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'cache_' + Math.abs(hash).toString(36);
}

function getCachedResponse(messages, systemPrompt) {
  if (localStorage.getItem('roweos_feature_responseCache') !== 'true') {
    return null;
  }

  var key = generateCacheKey(messages, systemPrompt);
  var cached = responseCache.entries[key];

  if (cached && (Date.now() - cached.timestamp) < responseCache.maxAge) {
    cached.hits = (cached.hits || 0) + 1;
    console.log('[Cache] HIT for key:', key, 'hits:', cached.hits);
    return cached.response;
  }

  return null;
}

function setCachedResponse(messages, systemPrompt, response) {
  if (localStorage.getItem('roweos_feature_responseCache') !== 'true') {
    return;
  }

  var key = generateCacheKey(messages, systemPrompt);

  // Enforce max entries limit
  var keys = Object.keys(responseCache.entries);
  if (keys.length >= responseCache.maxEntries) {
    // Remove oldest entry
    var oldest = keys.reduce(function(a, b) {
      return responseCache.entries[a].timestamp < responseCache.entries[b].timestamp ? a : b;
    });
    delete responseCache.entries[oldest];
  }

  responseCache.entries[key] = {
    response: response,
    timestamp: Date.now(),
    hits: 0
  };

  // Save to localStorage for persistence
  try {
    localStorage.setItem('roweos_response_cache', JSON.stringify(responseCache.entries));
  } catch (e) {
    console.warn('[Cache] Could not persist cache:', e.message);
  }

  console.log('[Cache] STORED response for key:', key);
}

function loadResponseCache() {
  try {
    var saved = localStorage.getItem('roweos_response_cache');
    if (saved) {
      responseCache.entries = JSON.parse(saved);
      // Clean expired entries
      var now = Date.now();
      Object.keys(responseCache.entries).forEach(function(key) {
        if (now - responseCache.entries[key].timestamp > responseCache.maxAge) {
          delete responseCache.entries[key];
        }
      });
      console.log('[Cache] Loaded', Object.keys(responseCache.entries).length, 'cached responses');
    }
  } catch (e) {
    console.warn('[Cache] Could not load cache:', e.message);
  }
}

function getCacheStats() {
  var entries = Object.keys(responseCache.entries).length;
  var totalHits = 0;
  Object.values(responseCache.entries).forEach(function(e) {
    totalHits += e.hits || 0;
  });
  return { entries: entries, hits: totalHits };
}

// ═══════════════════════════════════════════════════════════════════════════════
// v12.0.3: AUTO-PILOT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function loadAutoPilotData() {
  try {
    var savedQueue = localStorage.getItem('roweos_autopilot_queue');
    if (savedQueue) {
      autoPilotQueue = JSON.parse(savedQueue);
    }
    var savedLearnings = localStorage.getItem('roweos_autopilot_learnings');
    if (savedLearnings) {
      autoPilotLearnings = JSON.parse(savedLearnings);
    }
  } catch (e) {
    console.warn('[AutoPilot] Could not load data:', e.message);
  }
}

function saveAutoPilotData() {
  try {
    localStorage.setItem('roweos_autopilot_queue', JSON.stringify(autoPilotQueue));
    localStorage.setItem('roweos_autopilot_learnings', JSON.stringify(autoPilotLearnings));
  } catch (e) {
    console.warn('[AutoPilot] Could not save data:', e.message);
  }
}

function addAutoPilotAction(type, title, description, actionData) {
  if (localStorage.getItem('roweos_feature_autoPilot') !== 'true') {
    return null;
  }

  var action = {
    id: Date.now(),
    type: type,  // 'task', 'reminder', 'content', 'analysis', 'suggestion'
    title: title,
    description: description,
    action: actionData,
    createdAt: new Date().toISOString(),
    status: 'pending'  // 'pending', 'approved', 'dismissed', 'executed'
  };

  autoPilotQueue.push(action);
  saveAutoPilotData();
  renderAutoPilotActions();

  console.log('[AutoPilot] Added action:', title);
  return action;
}

function approveAutoPilotAction(actionId) {
  var action = autoPilotQueue.find(function(a) { return a.id === actionId; });
  if (action) {
    action.status = 'approved';
    executeAutoPilotAction(action);
    saveAutoPilotData();
    renderAutoPilotActions();
  }
}

function dismissAutoPilotAction(actionId) {
  // v26.3: Splice out instead of status change to guarantee removal
  autoPilotQueue = autoPilotQueue.filter(function(a) { return a.id !== actionId; });
  saveAutoPilotData();
  renderAutoPilotActions();
}

function executeAutoPilotAction(action) {
  console.log('[AutoPilot] Executing action:', action.title);

  switch (action.type) {
    case 'task':
      // Add to Pulse tasks
      if (action.action && action.action.task) {
        if (typeof addTodo === 'function') {
          addTodo(action.action.task, action.action.category || 'Auto-Pilot');
          showToast('Task added to Pulse: ' + action.action.task, 'success');
        }
      }
      break;

    case 'reminder':
      // Add to calendar
      if (action.action && action.action.reminder) {
        showToast('Reminder set: ' + action.action.reminder, 'success');
      }
      break;

    case 'content':
      // Queue content for generation
      if (action.action && action.action.prompt) {
        showToast('Content queued for generation', 'success');
      }
      break;

    case 'suggestion':
      // Just show the suggestion
      showToast('Suggestion noted', 'info');
      break;

    default:
      console.log('[AutoPilot] Unknown action type:', action.type);
  }

  action.status = 'executed';
  action.executedAt = new Date().toISOString();
  saveAutoPilotData();
}

function analyzeUserPatterns() {
  // v13.9: Enhanced pattern analysis - scans tasks, calendar, conversations, and Studio runs
  localStorage.setItem('roweos_feature_autoPilot', 'true');

  var patterns = [];

  // 1. Analyze task categories
  var taskPatterns = {};
  var completedCount = 0;
  var overdueCount = 0;
  var today = new Date().toISOString().slice(0, 10);
  todos.forEach(function(t) {
    var cat = (t.category || 'general').toLowerCase();
    taskPatterns[cat] = (taskPatterns[cat] || 0) + 1;
    if (t.completed) completedCount++;
    if (!t.completed && t.date && t.date < today) overdueCount++;
  });
  Object.keys(taskPatterns).forEach(function(cat) {
    if (taskPatterns[cat] >= 2) {
      patterns.push({
        type: cat,
        frequency: taskPatterns[cat],
        suggestion: 'You have ' + taskPatterns[cat] + ' tasks in "' + cat + '". Consider a weekly review automation.'
      });
    }
  });
  if (overdueCount > 0) {
    patterns.push({
      type: 'overdue',
      frequency: overdueCount,
      suggestion: 'You have ' + overdueCount + ' overdue task' + (overdueCount > 1 ? 's' : '') + '. Consider a daily reminder automation.'
    });
  }

  // 2. Analyze conversation history
  var cmds = typeof agentCommands !== 'undefined' ? agentCommands : [];
  if (cmds.length >= 1) {
    var queryTypes = {};
    cmds.slice(-30).forEach(function(cmd) {
      var query = (cmd.command || cmd.query || '').toLowerCase();
      if (query.includes('report')) queryTypes.reports = (queryTypes.reports || 0) + 1;
      if (query.includes('content') || query.includes('write') || query.includes('draft')) queryTypes.content = (queryTypes.content || 0) + 1;
      if (query.includes('schedule') || query.includes('remind') || query.includes('plan')) queryTypes.scheduling = (queryTypes.scheduling || 0) + 1;
      if (query.includes('analyze') || query.includes('review') || query.includes('audit')) queryTypes.analysis = (queryTypes.analysis || 0) + 1;
      if (query.includes('market') || query.includes('social') || query.includes('campaign')) queryTypes.marketing = (queryTypes.marketing || 0) + 1;
      if (query.includes('email') || query.includes('outreach') || query.includes('follow')) queryTypes.outreach = (queryTypes.outreach || 0) + 1;
    });
    Object.keys(queryTypes).forEach(function(type) {
      if (queryTypes[type] >= 1) {
        patterns.push({
          type: type,
          frequency: queryTypes[type],
          suggestion: 'You request ' + type + ' ' + queryTypes[type] + ' time' + (queryTypes[type] > 1 ? 's' : '') + ' recently. Set up a recurring automation.'
        });
      }
    });
  }

  // 3. Analyze Studio run history
  var studioRuns = typeof window.runs !== 'undefined' ? window.runs : [];
  if (studioRuns.length >= 1) {
    var opTypes = {};
    studioRuns.forEach(function(run) {
      var op = (run.op || run.operation || '').toLowerCase();
      opTypes[op] = (opTypes[op] || 0) + 1;
    });
    Object.keys(opTypes).forEach(function(op) {
      if (opTypes[op] >= 2 && op) {
        patterns.push({
          type: 'studio_' + op.replace(/\s+/g, '_'),
          frequency: opTypes[op],
          suggestion: 'You ran "' + op + '" ' + opTypes[op] + ' times. Schedule it as a recurring automation.'
        });
      }
    });
  }

  // 4. Analyze calendar for busy/empty days
  var dayLoad = {};
  (calendar || []).forEach(function(item) {
    if (item.date) {
      var dayName = new Date(item.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      dayLoad[dayName] = (dayLoad[dayName] || 0) + 1;
    }
  });
  var busiestDay = '';
  var busiestCount = 0;
  Object.keys(dayLoad).forEach(function(day) {
    if (dayLoad[day] > busiestCount) {
      busiestCount = dayLoad[day];
      busiestDay = day;
    }
  });
  if (busiestDay && busiestCount >= 3) {
    patterns.push({
      type: 'scheduling',
      frequency: busiestCount,
      suggestion: busiestDay + ' is your busiest day with ' + busiestCount + ' events. Consider spreading tasks or adding a prep automation.'
    });
  }

  // Save and generate suggestions
  autoPilotLearnings.patterns = patterns;
  autoPilotLearnings.lastAnalysis = new Date().toISOString();
  saveAutoPilotData();

  patterns.forEach(function(pattern) {
    if (!autoPilotQueue.find(function(a) { return a.type === 'suggestion' && a.title.toLowerCase().includes(pattern.type.replace('studio_', '')); })) {
      var title = pattern.type.replace('studio_', '').replace(/_/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);
      addAutoPilotAction('suggestion', title + ' Automation',
        pattern.suggestion, { suggestedAction: 'automate_' + pattern.type });
    }
  });

  renderAutoPilotActions();

  if (patterns.length > 0) {
    showToast('Found ' + patterns.length + ' pattern' + (patterns.length > 1 ? 's' : '') + ' - suggestions added', 'success');
  } else {
    showToast('No patterns detected yet. Add tasks, chat with agents, or run Studio ops first.', 'info');
  }

  return patterns;
}

function renderAutoPilotActions() {
  var container = document.getElementById('autoPilotActionsContainer');
  if (!container) return;

  var pendingActions = autoPilotQueue.filter(function(a) { return a.status === 'pending'; });

  // v22.39: Update badge and status text
  var badge = document.getElementById('autoPilotBadge');
  var statusText = document.getElementById('autoPilotStatusText');
  if (badge) {
    badge.textContent = pendingActions.length;
    badge.style.display = pendingActions.length > 0 ? '' : 'none';
  }
  if (statusText) {
    statusText.textContent = pendingActions.length > 0
      ? pendingActions.length + ' pending action' + (pendingActions.length > 1 ? 's' : '') + ' ready for review'
      : 'AI-suggested actions based on your patterns';
  }

  if (pendingActions.length === 0) {
    container.innerHTML = '<div style="padding: 14px; color: var(--text-tertiary); font-size: 13px; line-height: 1.5; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md);">No pending actions. Enable Auto-Pilot in Settings.</div>';
    return;
  }

  var html = '';
  pendingActions.forEach(function(action) {
    var icon = action.type === 'task' ? '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>' :
               action.type === 'suggestion' ? '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>' :
               action.type === 'content' ? '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>' :
               '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>';

    html += '<div class="autopilot-action-card" data-id="' + action.id + '">';
    html += '<div class="autopilot-action-header">';
    html += '<svg class="autopilot-action-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">' + icon + '</svg>';
    html += '<span class="autopilot-action-type">' + action.type.charAt(0).toUpperCase() + action.type.slice(1) + '</span>';
    html += '</div>';
    html += '<div class="autopilot-action-title">' + action.title + '</div>';
    html += '<div class="autopilot-action-desc">' + action.description + '</div>';
    html += '<div class="autopilot-action-buttons">';
    html += '<button class="autopilot-btn approve" onclick="approveAutoPilotAction(' + action.id + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Approve</button>';
    html += '<button class="autopilot-btn dismiss" onclick="dismissAutoPilotAction(' + action.id + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg> Dismiss</button>';
    html += '</div>';
    html += '</div>';
  });

  container.innerHTML = html;
}

// v12.0.2: toggleRileyLogo removed - feature deprecated

/**
 * v11.0.5: Toggle Cross-Mode Intelligence
 * When enabled, LifeAI coaches get BrandAI business data and vice versa
 */
function toggleCrossMode(enabled) {
  localStorage.setItem('roweos_cross_mode_enabled', enabled ? 'true' : 'false');
  
  if (enabled) {
    showToast('Cross-Mode Intelligence enabled. LifeAI and BrandAI will share relevant context.', 'success');
  } else {
    showToast('Cross-Mode Intelligence disabled. Modes operate independently.', 'info');
  }
  
  console.log('[RoweOS] Cross-Mode Intelligence:', enabled ? 'ENABLED' : 'DISABLED');
}

/**
 * v11.0.5: Initialize cross-mode toggle state
 */
function initCrossModeToggle() {
  var toggle = document.getElementById('toggleCrossMode');
  if (toggle) {
    var enabled = localStorage.getItem('roweos_cross_mode_enabled') !== 'false'; // Default true
    toggle.checked = enabled;
  }
}

function toggleBrandAI() {
  brandAIActive = !brandAIActive;
  var toggle = document.getElementById('brandAIToggle');
  var text = document.getElementById('brandAIToggleText');
  var input = document.getElementById('agentCommand');
  
  if (brandAIActive) {
    toggle.classList.remove('brandai-inactive');
    toggle.classList.add('brandai-active');
    text.textContent = '✦BrandAI';
    text.style.color = '#0a0a0a';
    input.placeholder = "Ask about your brand...";
    showToast('BrandAI mode enabled', 'info');
  } else {
    toggle.classList.remove('brandai-active');
    toggle.classList.add('brandai-inactive');
    text.textContent = '✧BrandAI';
    text.style.color = '';
    input.placeholder = "Explore anything...";
    showToast('StandardAI mode', 'info');
  }
}

function showConversationView() {
  // v24.26: Always clear stale progress bars on conversation view entry
  if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
  if (typeof hideThinkingProgress === 'function') hideThinkingProgress();
  // Add conversation-active class to handle CSS properly
  document.getElementById('agentView').classList.add('conversation-active');
  document.getElementById('agentLandingContent').style.display = 'none';
  var header = document.getElementById('agentConversationHeader');
  header.classList.remove('hidden');
  header.style.cssText = 'width:100%;display:flex;flex-direction:column;padding:2px 12px;margin:0;border:none;background:transparent;flex:0 0 auto;';
  // v24.27: Force zero margins on all header children (h2, p get browser defaults)
  var headerEls = header.querySelectorAll('*');
  for (var i = 0; i < headerEls.length; i++) {
    headerEls[i].style.margin = '0';
    headerEls[i].style.padding = '0';
  }
  var agentConv = document.getElementById('agentConversation');
  agentConv.classList.remove('hidden');
  agentConv.style.marginTop = '0';

  // v24.25: Show reduce-transparency button if ambient shape is active
  if (typeof updateHelixDimBtn === 'function') updateHelixDimBtn();

  // v9.1.14: Clear inputs now that user message is displayed in conversation thread
  var agentInput = document.getElementById('agentCommand');
  var followupInput = document.getElementById('followupCommand');
  if (agentInput) agentInput.value = '';
  if (followupInput) {
    followupInput.value = '';
    followupInput.style.height = 'auto'; // v10.5.28: Reset height
  }
  
  // Set conversation title based on first user message
  var titleEl = document.getElementById('conversationTitleText');
  var subtitleEl = document.getElementById('conversationSubtitle');
  if (titleEl && currentConversation.length > 0) {
    // v9.1.14: Check for AI-generated title in the current command record
    var aiTitle = null;
    if (agentCommands.length > 0) {
      // Find matching conversation by comparing first message
      // v20.1: Use displayContent for comparison (content may be multimodal array)
      var firstMsg = currentConversation[0].displayContent || (typeof currentConversation[0].content === 'string' ? currentConversation[0].content : '');
      var matchingCmd = agentCommands.find(function(cmd) {
        if (!cmd.conversation || !cmd.conversation[0]) return false;
        var cmdMsg = cmd.conversation[0].displayContent || (typeof cmd.conversation[0].content === 'string' ? cmd.conversation[0].content : '');
        return cmdMsg && cmdMsg === firstMsg;
      });
      if (matchingCmd && matchingCmd.title) {
        aiTitle = matchingCmd.title;
      }
    }
    
    var title;
    if (aiTitle) {
      title = aiTitle;
    } else {
      // v20.1: Handle multimodal content (array) — use displayContent fallback
      var firstMessage = currentConversation[0].displayContent || (typeof currentConversation[0].content === 'string' ? currentConversation[0].content : 'Image conversation');
      // Generate title from first message (first 50 chars or first sentence)
      title = firstMessage.split('\n')[0].substring(0, 60);
      if (title.length >= 60) title += '...';
    }
    titleEl.textContent = title || 'Conversation';
    
    // Set subtitle with brand and timestamp
    var agentBrandVal = document.getElementById('agentBrand').value;
    var brandIdx = parseInt(agentBrandVal);
    var brand = brands[brandIdx];
    var now = new Date();
    if (subtitleEl) {
      // v10.5.25: Handle LifeAI mode, StandardAI mode, and Brand mode
      var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
      var isLifeMode = currentMode === 'life';
      // v15.13: Use shortName || name
      var brandName = window._villainousMode ? 'Villainous' : (isLifeMode ? 'LifeAI' : ((agentBrandVal === 'none' || !brand) ? 'StandardAI' : (brand.shortName || brand.name)));
      subtitleEl.textContent = brandName + ' • ' + now.toLocaleDateString() + ', ' + formatDateTimeDisplay(now);
    }
  }
  
  // v9.1.14: If identity refine context exists, add the Apply to Identity button
  if (window.identityRefineContext) {
    setTimeout(function() {
      addApplyToIdentityButton(window.identityRefineContext.section, window.identityRefineContext.displayName);
    }, 100);
  }

  // v15.43: Init scroll-collapse for mobile chat input
  setTimeout(initChatInputCollapse, 500);
}

function handleAgentFileUpload(input) {
  console.log('handleAgentFileUpload called', input.files);
  if (input.files && input.files.length > 0) {
    var filesToProcess = Array.from(input.files);
    console.log('Files selected:', filesToProcess.length);
    
    // Process each file
    filesToProcess.forEach(function(file) {
      processAgentFile(file);
    });
    
    // Clear the input so user can re-upload same file if needed
    input.value = '';
  }
}

/**
 * v15.22: Handle image paste into chat inputs
 */
function handleChatPaste(e) {
  var clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData || !clipboardData.items) return;

  for (var i = 0; i < clipboardData.items.length; i++) {
    var item = clipboardData.items[i];
    if (item.type.indexOf('image/') === 0) {
      e.preventDefault();
      var file = item.getAsFile();
      if (!file) continue;

      // Check if we're in Image Lab context
      var isImageLab = e.target && e.target.id === 'imageLabChatInput';
      if (isImageLab) {
        // Route to Image Lab reference image
        var reader = new FileReader();
        reader.onload = function(ev) {
          var dataUrl = ev.target.result;
          var parts = dataUrl.split(',');
          var base64 = parts.length > 1 ? parts[1] : parts[0];
          var mimeMatch = dataUrl.match(/data:([^;]+);/);
          var mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
          // v15.23: Push to array instead of overwriting
          if (!window._imageLabChatRefImages) window._imageLabChatRefImages = [];
          window._imageLabChatRefImages.push({ base64: base64, mimeType: mimeType, name: 'pasted-image.png' });
          renderAutoLabImageLab(window._imageLabTargetId);
          showToast('Reference image pasted', 'success');
        };
        reader.readAsDataURL(file);
      } else {
        // Regular chat — add as file attachment
        processAgentFile(file);
        showToast('Image attached', 'success');
      }
      break; // Only process first image
    }
  }
}

/**
 * v10.5.33: Process a single file and add to currentAgentFiles array
 */
function processAgentFile(file) {
  // v29.0: Hide any stale progress bars when attaching a file mid-conversation
  if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
  if (typeof hideThinkingProgress === 'function') hideThinkingProgress();

  var fileId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // v20.1: Fallback type detection from extension if MIME type is empty
  var fileType = file.type;
  if (!fileType) {
    var extForType = file.name.toLowerCase().split('.').pop();
    var extTypeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', json: 'application/json', md: 'text/markdown' };
    fileType = extTypeMap[extForType] || '';
  }

  // Add to array with loading status
  var fileEntry = {
    id: fileId,
    file: file,
    name: file.name,
    type: fileType,
    content: null,
    status: 'loading'
  };
  currentAgentFiles.push(fileEntry);
  
  // Render chips
  renderAgentFileChips();
  
  // Handle PDF files (v20.1: use resolved fileType)
  if (fileType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    var reader = new FileReader();
    reader.onload = async function(e) {
      try {
        var pdfData = new Uint8Array(e.target.result);
        var pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        var textContent = '';
        
        for (var i = 1; i <= pdf.numPages; i++) {
          var page = await pdf.getPage(i);
          var text = await page.getTextContent();
          var pageText = text.items.map(function(item) { return item.str; }).join(' ');
          textContent += '\n--- Page ' + i + ' ---\n' + pageText;
        }
        
        // Update file entry
        var entry = currentAgentFiles.find(function(f) { return f.id === fileId; });
        if (entry) {
          entry.content = '[PDF Document: ' + file.name + ' (' + pdf.numPages + ' pages)]\n' + textContent;
          entry.status = 'ready';
          entry.pages = pdf.numPages;
        }
        
        renderAgentFileChips();
        updateAgentFileButtonState();
        showToast('PDF ready: ' + file.name + ' (' + pdf.numPages + ' pages)', 'success');
      } catch (err) {
        console.error('PDF parsing error:', err);
        var entry = currentAgentFiles.find(function(f) { return f.id === fileId; });
        if (entry) {
          entry.status = 'error';
          entry.error = err.message;
        }
        renderAgentFileChips();
        showToast('Error parsing PDF: ' + file.name, 'error');
      }
    };
    reader.onerror = function() {
      var entry = currentAgentFiles.find(function(f) { return f.id === fileId; });
      if (entry) entry.status = 'error';
      renderAgentFileChips();
      showToast('Error reading PDF: ' + file.name, 'error');
    };
    reader.readAsArrayBuffer(file);
    return;
  }
  
  // Handle non-PDF files
  var reader = new FileReader();
  reader.onload = function(e) {
    var entry = currentAgentFiles.find(function(f) { return f.id === fileId; });
    if (entry) {
      entry.content = e.target.result;
      entry.status = 'ready';
    }
    renderAgentFileChips();
    updateAgentFileButtonState();
    showToast('File ready: ' + file.name, 'success');
  };
  reader.onerror = function() {
    var entry = currentAgentFiles.find(function(f) { return f.id === fileId; });
    if (entry) entry.status = 'error';
    renderAgentFileChips();
    showToast('Error reading file: ' + file.name, 'error');
  };
  
  // v20.1: Use resolved fileType (has extension fallback)
  if (fileType.startsWith('image/')) {
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file);
  }
}

/**
 * v10.5.33: Render file chips in the container
 * v11.0.5: Also update followup container
 */
function renderAgentFileChips() {
  // Render in landing container
  var container = document.getElementById('agentFileChips');
  if (container) {
    if (currentAgentFiles.length === 0) {
      container.innerHTML = '';
    } else {
      var html = '';
      currentAgentFiles.forEach(function(entry) {
        var statusText = '';
        var statusClass = entry.status;
        
        if (entry.status === 'loading') {
          statusText = 'Reading...';
        } else if (entry.status === 'ready') {
          statusText = entry.pages ? entry.pages + ' pages' : '✓';
        } else if (entry.status === 'error') {
          statusText = 'Error';
        }
        
        // File type icon
        var iconSvg = getFileIcon(entry.name);
        
        // v28.4: Show "From Library" badge for library-sourced files
        var sourceBadge = entry.source === 'library' ? '<span class="file-chip-status" style="color: var(--accent); font-weight: 500;">From Library</span>' : '';

        html += '<div class="file-chip ' + statusClass + '" data-file-id="' + entry.id + '">' +
          '<span class="file-chip-icon">' + iconSvg + '</span>' +
          '<span class="file-chip-name" title="' + escapeHtml(entry.name) + '">' + escapeHtml(entry.name) + '</span>' +
          (sourceBadge || '<span class="file-chip-status">' + statusText + '</span>') +
          '<button class="file-chip-remove" onclick="removeAgentFileById(\'' + entry.id + '\')" title="Remove">✕</button>' +
        '</div>';
      });

      container.innerHTML = html;
    }
  }

  // v11.0.5: Also render in followup container (if visible)
  var followupContainer = document.getElementById('followupFileChips');
  if (followupContainer) {
    if (currentAgentFiles.length === 0) {
      followupContainer.innerHTML = '';
    } else {
      var html = '';
      currentAgentFiles.forEach(function(entry) {
        var statusText = '';
        var statusClass = entry.status;
        
        if (entry.status === 'loading') {
          statusText = 'Reading...';
        } else if (entry.status === 'ready') {
          statusText = entry.pages ? entry.pages + ' pages' : '✓';
        } else if (entry.status === 'error') {
          statusText = 'Error';
        }
        
        var iconSvg = getFileIcon(entry.name);

        // v28.4: Show "From Library" badge for library-sourced files
        var sourceBadge2 = entry.source === 'library' ? '<span class="file-chip-status" style="color: var(--accent); font-weight: 500;">From Library</span>' : '';

        html += '<div class="file-chip ' + statusClass + '" data-file-id="' + entry.id + '">' +
          '<span class="file-chip-icon">' + iconSvg + '</span>' +
          '<span class="file-chip-name" title="' + escapeHtml(entry.name) + '">' + escapeHtml(entry.name) + '</span>' +
          (sourceBadge2 || '<span class="file-chip-status">' + statusText + '</span>') +
          '<button class="file-chip-remove" onclick="removeAgentFileById(\'' + entry.id + '\')" title="Remove">✕</button>' +
        '</div>';
      });

      followupContainer.innerHTML = html;
    }
  }
  
  // Also update legacy preview for backward compatibility
  var preview = document.getElementById('agentFilePreview');
  if (preview) {
    preview.classList.add('hidden'); // Hide legacy, use chips instead
  }
  
  console.log('[FileChips] Rendered', currentAgentFiles.length, 'files');
}

/**
 * v10.5.33: Get appropriate icon for file type
 * v11.0.5: Added width/height for proper rendering
 */
function getFileIcon(filename) {
  var ext = filename.toLowerCase().split('.').pop();
  
  if (ext === 'pdf') {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].indexOf(ext) !== -1) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  } else if (['csv', 'xlsx', 'xls'].indexOf(ext) !== -1) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="12" y1="9" x2="12" y2="21"/></svg>';
  } else if (ext === 'json') {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 16l2-2-2-2"/><path d="M12 18h4"/></svg>';
  } else {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  }
}

/**
 * v10.5.33: Update attach button state based on files
 */
function updateAgentFileButtonState() {
  var hasFiles = currentAgentFiles.length > 0;
  var landingAttach = document.getElementById('landingAttachBtn');
  var followupAttach = document.getElementById('followupAttachBtn');
  
  if (landingAttach) {
    if (hasFiles) {
      landingAttach.classList.add('has-file');
    } else {
      landingAttach.classList.remove('has-file');
    }
  }
  if (followupAttach) {
    if (hasFiles) {
      followupAttach.classList.add('has-file');
    } else {
      followupAttach.classList.remove('has-file');
    }
  }
}

/**
 * v10.5.33: Remove a specific file by ID
 */
function removeAgentFileById(fileId) {
  currentAgentFiles = currentAgentFiles.filter(function(f) { return f.id !== fileId; });
  renderAgentFileChips();
  updateAgentFileButtonState();
  
  // Update legacy single file vars for backward compatibility
  if (currentAgentFiles.length === 0) {
    currentAgentFile = null;
    currentAgentFileContent = null;
  } else {
    currentAgentFile = currentAgentFiles[0].file;
    currentAgentFileContent = currentAgentFiles[0].content;
  }
}

/**
 * v10.5.33: Get all file contents combined for sending to AI
 */
function getAllAgentFileContents() {
  var readyFiles = currentAgentFiles.filter(function(f) { return f.status === 'ready' && f.content; });
  if (readyFiles.length === 0) return null;
  
  if (readyFiles.length === 1) {
    return readyFiles[0].content;
  }
  
  // Multiple files - combine with separators
  return readyFiles.map(function(f, idx) {
    return '--- ATTACHED FILE ' + (idx + 1) + ': ' + f.name + ' ---\n' + f.content;
  }).join('\n\n');
}

function handleFollowupFileUpload(input) {
  // v11.0.5: Use same multi-file system as landing area
  console.log('handleFollowupFileUpload called', input.files);
  if (input.files && input.files.length > 0) {
    var filesToProcess = Array.from(input.files);
    console.log('Followup files selected:', filesToProcess.length);
    
    // Process each file using the shared function
    filesToProcess.forEach(function(file) {
      processAgentFile(file);
    });
    
    // Also render in followup chips container
    renderFollowupFileChips();
    
    // Clear the input so user can re-upload same file if needed
    input.value = '';
  }
}

/**
 * v11.0.5: Render file chips in followup container (shares currentAgentFiles)
 */
function renderFollowupFileChips() {
  var container = document.getElementById('followupFileChips');
  if (!container) return;
  
  if (currentAgentFiles.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  var html = '';
  currentAgentFiles.forEach(function(entry) {
    var statusText = '';
    var statusClass = entry.status;
    
    if (entry.status === 'loading') {
      statusText = 'Reading...';
    } else if (entry.status === 'ready') {
      statusText = entry.pages ? entry.pages + ' pages' : '✓';
    } else if (entry.status === 'error') {
      statusText = 'Error';
    }
    
    var iconSvg = getFileIcon(entry.name);
    
    html += '<div class="file-chip ' + statusClass + '" data-file-id="' + entry.id + '">' +
      '<span class="file-chip-icon">' + iconSvg + '</span>' +
      '<span class="file-chip-name" title="' + escapeHtml(entry.name) + '">' + escapeHtml(entry.name) + '</span>' +
      '<span class="file-chip-status">' + statusText + '</span>' +
      '<button class="file-chip-remove" onclick="removeAgentFileById(\'' + entry.id + '\')" title="Remove">✕</button>' +
    '</div>';
  });
  
  container.innerHTML = html;
}

function removeAgentFile() {
  // v10.5.33: Clear all files
  currentAgentFile = null;
  currentAgentFileContent = null;
  currentAgentFiles = [];
  
  var fileInput = document.getElementById('agentFileInput');
  if (fileInput) fileInput.value = '';
  
  // Clear chips containers
  var chipsContainer = document.getElementById('agentFileChips');
  if (chipsContainer) chipsContainer.innerHTML = '';
  
  // v11.0.5: Clear followup chips container
  var followupChipsContainer = document.getElementById('followupFileChips');
  if (followupChipsContainer) followupChipsContainer.innerHTML = '';
  
  // Clear legacy preview
  var preview = document.getElementById('agentFilePreview');
  if (preview) {
    preview.classList.add('hidden');
    preview.innerHTML = '';
  }
  
  // v11.0.5: Clear followup legacy preview  
  var followupPreview = document.getElementById('followupFilePreview');
  if (followupPreview) {
    followupPreview.classList.add('hidden');
    followupPreview.innerHTML = '';
  }
  
  // Remove has-file class from attach buttons
  var landingAttach = document.getElementById('landingAttachBtn');
  var followupAttach = document.getElementById('followupAttachBtn');
  if (landingAttach) landingAttach.classList.remove('has-file');
  if (followupAttach) followupAttach.classList.remove('has-file');

  // v13.4: Extra safety - clear any stray file chip elements
  document.querySelectorAll('.agent-file-chip, .file-chip').forEach(function(el) { el.remove(); });
  console.log('All files removed');
}

function removeFollowupFile() {
  // v11.0.5: Use same system as landing - just call removeAgentFile
  removeAgentFile();
}

/**
 * v10.5.25: Drag-and-drop file upload for BrandAI / LifeAI chat
 * 
 * Supports drag to either:
 * - Landing input (#agentInputContainer) → routes to handleAgentFileUpload
 * - Followup input (#followupInputContainer) → routes to handleFollowupFileUpload
 * 
 * Also supports whole-page drag detection with auto-target to the visible input.
 * Accepted file types mirror the file input accept attributes.
 */
var chatDragCounter = 0;
var chatDragAcceptedTypes = [
  'text/plain', 'text/rtf', 'text/csv', 'text/markdown', 'text/md',
  'application/pdf', 'application/json',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff'
];
var chatDragAcceptedExtensions = ['.txt', '.rtf', '.pdf', '.doc', '.docx', '.csv', '.json', '.md', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.bmp', '.tiff'];

function isChatDragAccepted(dataTransfer) {
  if (!dataTransfer || !dataTransfer.types) return false;
  // Check if it's a file drag (not text selection drag)
  return dataTransfer.types.indexOf('Files') !== -1;
}

function getActiveChatInput() {
  // If conversation is active (followup visible), use followup input
  var conv = document.getElementById('agentConversation');
  if (conv && !conv.classList.contains('hidden') && conv.style.display !== 'none') {
    return {
      container: document.getElementById('followupInputContainer'),
      handler: 'followup',
      fileInput: document.getElementById('followupFileInput')
    };
  }
  // Otherwise use landing input
  return {
    container: document.getElementById('agentInputContainer'),
    handler: 'landing',
    fileInput: document.getElementById('agentFileInput')
  };
}

function initChatDragDrop() {
  var agentView = document.getElementById('agentView');
  if (!agentView) return;
  
  // Prevent browser default file open behavior on the whole view
  agentView.addEventListener('dragover', function(e) {
    if (!isChatDragAccepted(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, false);
  
  // Track drag enter/leave on the whole agent view for auto-highlight
  agentView.addEventListener('dragenter', function(e) {
    if (!isChatDragAccepted(e.dataTransfer)) return;
    e.preventDefault();
    chatDragCounter++;
    if (chatDragCounter === 1) {
      var active = getActiveChatInput();
      if (active.container) {
        active.container.classList.add('drag-over');
      }
    }
  }, false);
  
  agentView.addEventListener('dragleave', function(e) {
    if (!isChatDragAccepted(e.dataTransfer)) return;
    chatDragCounter--;
    if (chatDragCounter <= 0) {
      chatDragCounter = 0;
      clearChatDragState();
    }
  }, false);
  
  // Handle drop on the whole agent view - route to active input
  agentView.addEventListener('drop', function(e) {
    if (!isChatDragAccepted(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    chatDragCounter = 0;
    clearChatDragState();
    
    var files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // v26.3: Process ALL dropped files, not just the first
    var active = getActiveChatInput();
    for (var _fi = 0; _fi < files.length; _fi++) {
      var file = files[_fi];

      // Validate file type by extension
      var fileName = file.name.toLowerCase();
      var ext = '.' + fileName.split('.').pop();
      var typeOk = chatDragAcceptedExtensions.indexOf(ext) !== -1;
      if (!typeOk && file.type) {
        typeOk = chatDragAcceptedTypes.indexOf(file.type) !== -1;
      }
      // v25.6: iOS drag-from-recents may send image/* types not in the list
      if (!typeOk && file.type && file.type.indexOf('image/') === 0) {
        typeOk = true;
      }

      if (!typeOk) {
        showToast('Unsupported file type: ' + file.name, 'error');
        continue;
      }

      // Route to the correct handler
      if (active.handler === 'followup') {
        routeDroppedFileToFollowup(file);
      } else {
        routeDroppedFileToLanding(file);
      }
    }
  }, false);
  
  // Also attach direct listeners on each input container for precise targeting
  setupContainerDragDrop('agentInputContainer', 'landing');
  setupContainerDragDrop('followupInputContainer', 'followup');
  
  console.log('[v10.5.25] Chat drag-and-drop initialized');
}

function setupContainerDragDrop(containerId, handler) {
  var container = document.getElementById(containerId);
  if (!container) return;
  
  container.addEventListener('dragover', function(e) {
    if (!isChatDragAccepted(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    container.classList.add('drag-over');
  }, false);
  
  container.addEventListener('dragleave', function(e) {
    // Only remove if we actually left the container (not entered a child)
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove('drag-over');
    }
  }, false);
  
  container.addEventListener('drop', function(e) {
    // Handled by agentView listener — just clean up state
    container.classList.remove('drag-over');
  }, false);
}

function clearChatDragState() {
  var agent = document.getElementById('agentInputContainer');
  var followup = document.getElementById('followupInputContainer');
  if (agent) agent.classList.remove('drag-over');
  if (followup) followup.classList.remove('drag-over');
}

/**
 * Route a dropped file to the landing (initial) chat input
 */
function routeDroppedFileToLanding(file) {
  // v16.9: Use shared processAgentFile + chips system (same as attach button)
  if (typeof processAgentFile === 'function') {
    processAgentFile(file);
    if (typeof renderAgentFileChips === 'function') renderAgentFileChips();
  }
}

/**
 * Route a dropped file to the followup (conversation) chat input
 */
function routeDroppedFileToFollowup(file) {
  // v16.9: Use shared processAgentFile + chips system (same as attach button)
  if (typeof processAgentFile === 'function') {
    processAgentFile(file);
    renderFollowupFileChips();
  }
}

/**
 * Universal file reader that handles PDF, images, and text files
 * @param {File} file - The file to read
 * @param {Function} onSuccess - Called with content string
 * @param {Function} onError - Called with error message
 */
function readDroppedFile(file, onSuccess, onError) {
  // PDF handling with pdf.js
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    var reader = new FileReader();
    reader.onload = async function(e) {
      try {
        if (typeof pdfjsLib === 'undefined') {
          // Fallback if pdf.js not loaded
          onSuccess('[PDF Document: ' + file.name + '] (PDF parser unavailable, content not extracted)');
          return;
        }
        var pdfData = new Uint8Array(e.target.result);
        var pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        var textContent = '';
        for (var i = 1; i <= pdf.numPages; i++) {
          var page = await pdf.getPage(i);
          var text = await page.getTextContent();
          var pageText = text.items.map(function(item) { return item.str; }).join(' ');
          textContent += '\n--- Page ' + i + ' ---\n' + pageText;
        }
        onSuccess('[PDF Document: ' + file.name + ' (' + pdf.numPages + ' pages)]\n' + textContent);
      } catch (err) {
        console.error('[DragDrop] PDF parse error:', err);
        onError('PDF parsing failed: ' + err.message);
      }
    };
    reader.onerror = function() { onError('File read error'); };
    reader.readAsArrayBuffer(file);
    return;
  }
  
  // Image handling — read as data URL
  if (file.type && file.type.startsWith('image/')) {
    var reader = new FileReader();
    reader.onload = function(e) { onSuccess(e.target.result); };
    reader.onerror = function() { onError('Image read error'); };
    reader.readAsDataURL(file);
    return;
  }
  
  // Text-based files
  var reader = new FileReader();
  reader.onload = function(e) { onSuccess(e.target.result); };
  reader.onerror = function() { onError('File read error'); };
  reader.readAsText(file);
}

// v10.5.25: Studio Reference Image Upload for image operations
var currentReferenceImage = null;
var currentReferenceImageData = null;

function handleReferenceImageUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }
  
  currentReferenceImage = file;
  console.log('[Studio] Reference image selected:', file.name, file.type);
  
  var reader = new FileReader();
  reader.onload = function(e) {
    currentReferenceImageData = e.target.result;
    
    // Update preview
    var placeholder = document.getElementById('imageUploadPlaceholder');
    var preview = document.getElementById('imageUploadPreview');
    var previewImg = document.getElementById('referenceImagePreview');
    
    if (placeholder) placeholder.style.display = 'none';
    if (preview) preview.style.display = 'flex';
    if (previewImg) previewImg.src = currentReferenceImageData;
    
    showToast('Reference image ready: ' + file.name, 'success');
    console.log('[Studio] Reference image loaded, size:', currentReferenceImageData.length);
  };
  reader.onerror = function() {
    showToast('Error reading image', 'error');
    currentReferenceImage = null;
    currentReferenceImageData = null;
  };
  reader.readAsDataURL(file);
}

function removeReferenceImage() {
  currentReferenceImage = null;
  currentReferenceImageData = null;
  
  var input = document.getElementById('referenceImageInput');
  var placeholder = document.getElementById('imageUploadPlaceholder');
  var preview = document.getElementById('imageUploadPreview');
  var previewImg = document.getElementById('referenceImagePreview');
  
  if (input) input.value = '';
  if (placeholder) placeholder.style.display = 'flex';
  if (preview) preview.style.display = 'none';
  if (previewImg) previewImg.src = '';
  
  showToast('Reference image removed', 'info');
}

function handleStudioFileUpload(input) {
  if (input.files && input.files.length > 0) {
    var filesToProcess = Array.from(input.files);
    console.log('[Studio] Files selected:', filesToProcess.length);
    
    filesToProcess.forEach(function(file) {
      processStudioFile(file);
    });
    
    input.value = '';
  }
}

/**
 * v10.5.33: Process a single file for Studio
 */
function processStudioFile(file) {
  var fileId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  var fileEntry = {
    id: fileId,
    file: file,
    name: file.name,
    type: file.type,
    content: null,
    status: 'loading'
  };
  currentStudioFiles.push(fileEntry);
  
  renderStudioFileChips();
  
  // Handle PDF
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    var reader = new FileReader();
    reader.onload = async function(e) {
      try {
        var pdfData = new Uint8Array(e.target.result);
        var pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        var textContent = '';
        
        for (var i = 1; i <= pdf.numPages; i++) {
          var page = await pdf.getPage(i);
          var text = await page.getTextContent();
          var pageText = text.items.map(function(item) { return item.str; }).join(' ');
          textContent += '\n--- Page ' + i + ' ---\n' + pageText;
        }
        
        var entry = currentStudioFiles.find(function(f) { return f.id === fileId; });
        if (entry) {
          entry.content = '[PDF Document: ' + file.name + ' (' + pdf.numPages + ' pages)]\n' + textContent;
          entry.status = 'ready';
          entry.pages = pdf.numPages;
        }
        
        renderStudioFileChips();
        showToast('PDF ready: ' + file.name + ' (' + pdf.numPages + ' pages)', 'success');
      } catch (err) {
        console.error('PDF parsing error:', err);
        var entry = currentStudioFiles.find(function(f) { return f.id === fileId; });
        if (entry) entry.status = 'error';
        renderStudioFileChips();
        showToast('Error parsing PDF: ' + file.name, 'error');
      }
    };
    reader.onerror = function() {
      var entry = currentStudioFiles.find(function(f) { return f.id === fileId; });
      if (entry) entry.status = 'error';
      renderStudioFileChips();
    };
    reader.readAsArrayBuffer(file);
    return;
  }
  
  // Non-PDF
  var reader = new FileReader();
  reader.onload = function(e) {
    var entry = currentStudioFiles.find(function(f) { return f.id === fileId; });
    if (entry) {
      entry.content = e.target.result;
      entry.status = 'ready';
    }
    renderStudioFileChips();
    showToast('File ready: ' + file.name, 'success');
  };
  reader.onerror = function() {
    var entry = currentStudioFiles.find(function(f) { return f.id === fileId; });
    if (entry) entry.status = 'error';
    renderStudioFileChips();
  };
  
  if (file.type.startsWith('image/')) {
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file);
  }
}

/**
 * v10.5.33: Render Studio file chips
 */
function renderStudioFileChips() {
  var container = document.getElementById('studioFileChips');
  if (!container) return;
  
  if (currentStudioFiles.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  var html = '';
  currentStudioFiles.forEach(function(entry) {
    var statusText = '';
    var statusClass = entry.status;
    
    if (entry.status === 'loading') {
      statusText = 'Reading...';
    } else if (entry.status === 'ready') {
      statusText = entry.pages ? entry.pages + ' pages' : '✓';
    } else if (entry.status === 'error') {
      statusText = 'Error';
    }
    
    var iconSvg = getFileIcon(entry.name);
    
    html += '<div class="file-chip ' + statusClass + '" data-file-id="' + entry.id + '">' +
      '<span class="file-chip-icon">' + iconSvg + '</span>' +
      '<span class="file-chip-name" title="' + escapeHtml(entry.name) + '">' + escapeHtml(entry.name) + '</span>' +
      '<span class="file-chip-status">' + statusText + '</span>' +
      '<button class="file-chip-remove" onclick="removeStudioFileById(\'' + entry.id + '\')" title="Remove">✕</button>' +
    '</div>';
  });
  
  container.innerHTML = html;
  
  // Hide legacy preview
  var preview = document.getElementById('studioFilePreview');
  if (preview) preview.classList.add('hidden');
}

/**
 * v10.5.33: Remove a specific Studio file by ID
 */
function removeStudioFileById(fileId) {
  currentStudioFiles = currentStudioFiles.filter(function(f) { return f.id !== fileId; });
  renderStudioFileChips();
  
  // Update legacy single file vars
  if (currentStudioFiles.length === 0) {
    currentStudioFile = null;
    currentStudioFileContent = null;
  } else {
    currentStudioFile = currentStudioFiles[0].file;
    currentStudioFileContent = currentStudioFiles[0].content;
  }
}

/**
 * v10.5.33: Get all Studio file contents combined
 */
function getAllStudioFileContents() {
  var readyFiles = currentStudioFiles.filter(function(f) { return f.status === 'ready' && f.content; });
  if (readyFiles.length === 0) return null;
  
  if (readyFiles.length === 1) {
    return readyFiles[0].content;
  }
  
  return readyFiles.map(function(f, idx) {
    return '--- ATTACHED FILE ' + (idx + 1) + ': ' + f.name + ' ---\n' + f.content;
  }).join('\n\n');
}

function removeStudioFile() {
  // v10.5.33: Clear all Studio files
  currentStudioFile = null;
  currentStudioFileContent = null;
  currentStudioFiles = [];
  
  document.getElementById('studioFileInput').value = '';
  
  // Clear chips container
  var chipsContainer = document.getElementById('studioFileChips');
  if (chipsContainer) chipsContainer.innerHTML = '';
  
  // Clear legacy preview
  var preview = document.getElementById('studioFilePreview');
  if (preview) {
    preview.classList.add('hidden');
    preview.innerHTML = '';
  }
}

function saveBrandAIChat() {
  if (!currentConversation || currentConversation.length === 0) {
    showToast('No conversation to save', 'warning');
    return;
  }
  
  // Get the last assistant response
  var lastAssistant = null;
  for (var i = currentConversation.length - 1; i >= 0; i--) {
    if (currentConversation[i].role === 'assistant') {
      lastAssistant = currentConversation[i];
      break;
    }
  }
  
  if (!lastAssistant) {
    showToast('No response to save', 'warning');
    return;
  }
  
  openSaveLibraryModalForBrandAI(lastAssistant.content);
}

function newConversation() {
  currentConversation = [];
  conversationStartBrand = null; // Reset conversation brand
  window._continuedHistoryIndex = null; // v10.5.25: Clear continued conversation tracking
  continuingFromHistoryIndex = null; // v10.5.25: Clear continued conversation tracking
  nanobananaImageActive = false; // v15.7: Reset image conversation state
  _nanobananaLastImage = null; // v15.10: Clear multi-turn image history
  _nanobananaImageHistory = []; // v15.10: Clear multi-turn image history
  window._villainousMode = false; // v29.0: Reset Villainous mode on new chat
  window._chatModelOverride = null; // v30.1: Reset session-only model overrides (e.g. Nanobanana)
  if (typeof syncChatModelDisplay === 'function') syncChatModelDisplay(); // v30.1: Refresh pill text
  if (typeof updateProviderPills === 'function') updateProviderPills(); // v30.1: Refresh active pill
  if (typeof updateStarButtonProvider === 'function') updateStarButtonProvider(); // v30.1: Refresh star button
  expandChatInput(); // v15.43: Reset collapsed chat input

  // v11.0.5: Reset "Add to Pulse" shown flag for new conversation
  if (typeof resetPulseShownFlag === 'function') resetPulseShownFlag();
  
  // Clear the conversation thread DOM
  var thread = document.getElementById('conversationThread');
  if (thread) thread.innerHTML = '';
  
  // v9.1.14: Reset sending button states
  var agentRunBtn = document.getElementById('agentRunBtn');
  var followupBtn = document.getElementById('followupBtn');
  if (agentRunBtn) {
    agentRunBtn.disabled = false;
    agentRunBtn.classList.remove('sending');
  }
  if (followupBtn) {
    followupBtn.disabled = false;
    followupBtn.classList.remove('sending');
  }
  setAgentStatus('ready');
  
  // Remove conversation-active class
  document.getElementById('agentView').classList.remove('conversation-active');

  document.getElementById('agentConversation').classList.add('hidden');
  var header = document.getElementById('agentConversationHeader');
  header.classList.add('hidden');
  header.style.display = 'none';
  var landingContent = document.getElementById('agentLandingContent');
  landingContent.style.display = 'flex';
  landingContent.classList.remove('hidden');
  var logo = landingContent.querySelector('.landing-logo');
  if (logo) logo.style.display = 'block';
  // v25.0: Re-trigger blob/helix after returning from conversation (animation stops when landing is hidden)
  setTimeout(function() {
    var savedShape = localStorage.getItem('roweos_blob_shape') || 'smooth';
    if (typeof setBlobShape === 'function') setBlobShape(savedShape);
  }, 100);
  // Restore chat input area
  var chatInputArea = landingContent.querySelector('.chat-input-area');
  if (chatInputArea) chatInputArea.style.display = 'block';
  var agentInputContainer = document.getElementById('agentInputContainer');
  if (agentInputContainer) agentInputContainer.style.display = 'block';
  var agentCmdEl = document.getElementById('agentCommand');
  if (agentCmdEl) {
    agentCmdEl.value = '';
    agentCmdEl.style.height = 'auto'; // v10.5.28: Reset height
  }
  var followupCmdEl = document.getElementById('followupCommand');
  if (followupCmdEl) {
    followupCmdEl.value = '';
    followupCmdEl.style.height = 'auto'; // v10.5.28: Reset height
  }
  // Clear file previews
  document.getElementById('agentFilePreview').classList.add('hidden');
  document.getElementById('agentFilePreview').innerHTML = '';
  document.getElementById('followupFilePreview').classList.add('hidden');
  document.getElementById('followupFilePreview').innerHTML = '';
  currentAgentFile = null;
  currentAgentFileContent = null;
  currentFollowupFile = null;
  currentFollowupFileContent = null;
  showToast('New conversation started', 'info');
}

// v16.10: Append export action bar (Copy/Word/Excel/Slides/PDF) to streaming message bubble on complete
function appendStreamingMsgActions() {
  var sm = document.getElementById('streamingMessage');
  if (!sm) return;
  var bubble = sm.querySelector('.conversation-message-bubble');
  if (!bubble) return;
  // v26.3: Clean up stuck "Building Visual" placeholders on stream end
  var stuckVisuals = bubble.querySelectorAll('.visual-building');
  stuckVisuals.forEach(function(v) { v.remove(); });
  // Don't double-add
  if (bubble.querySelector('.chat-msg-actions')) return;
  var actionsDiv = document.createElement('div');
  actionsDiv.className = 'chat-msg-actions';
  actionsDiv.innerHTML = '<button onclick="exportChatMsg(this,\'copy\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</button><button onclick="exportChatMsg(this,\'docx\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Word</button><button onclick="exportChatMsg(this,\'xlsx\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg> Excel</button><button onclick="exportChatMsg(this,\'pptx\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> Slides</button><button onclick="exportChatMsg(this,\'pdf\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13h4M10 17h4M8 9h1"/></svg> PDF</button><button onclick="chatSendAsEmail(this)"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg> Email</button><button onclick="openChatSaveMenu(this)"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> Save</button>';
  bubble.appendChild(actionsDiv);

  // v29.3: Clip tool button
  var clipBtn = document.createElement('button');
  clipBtn.className = 'chat-msg-action-btn';
  clipBtn.title = 'Clip content';
  clipBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg> Clip';
  clipBtn.onclick = function() { enterClipMode(clipBtn); };
  actionsDiv.appendChild(clipBtn);

  // v29.3: Section markers for structured content
  var contentEl = bubble.querySelector('.conversation-message-content');
  if (contentEl && typeof addSectionMarkers === 'function') {
    addSectionMarkers(contentEl);
  }

  // v24.27: On mobile, add toggle buttons for code blocks
  if (window.innerWidth <= 768) {
    bubble.querySelectorAll('pre').forEach(function(pre) {
      if (pre.previousElementSibling && pre.previousElementSibling.classList.contains('code-toggle-btn')) return;
      var btn = document.createElement('button');
      btn.className = 'code-toggle-btn';
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> View code';
      btn.onclick = function() {
        pre.classList.toggle('show-code');
        btn.textContent = pre.classList.contains('show-code') ? 'Hide code' : 'View code';
      };
      pre.parentNode.insertBefore(btn, pre);
    });
  }
}

// v24.27: Force all external links to open in new tab
document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href]');
  if (!link) return;
  var href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('javascript')) return;
  // Internal navigation (onclick handlers like showView) — skip
  if (link.getAttribute('onclick')) return;
  // External or absolute URLs — open in new tab
  if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:')) {
    e.preventDefault();
    window.open(href, '_blank', 'noopener');
  }
});

// v24.27: Toggle export actions on mobile tap
(function() {
  document.addEventListener('click', function(e) {
    if (window.innerWidth > 768) return;
    var bubble = e.target.closest('.conversation-message-bubble');
    // If tapped an action button, don't toggle
    if (e.target.closest('.chat-msg-actions')) return;
    // Close all other open action bars
    document.querySelectorAll('.conversation-message-bubble.show-actions').forEach(function(b) {
      if (b !== bubble) b.classList.remove('show-actions');
    });
    // Toggle tapped bubble
    if (bubble && bubble.querySelector('.chat-msg-actions')) {
      bubble.classList.toggle('show-actions');
      // Scroll so actions are visible
      if (bubble.classList.contains('show-actions')) {
        setTimeout(function() {
          var actions = bubble.querySelector('.chat-msg-actions');
          if (actions) actions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 250);
      }
    }
  });
})();

function renderConversation() {
  var thread = document.getElementById('conversationThread');
  thread.innerHTML = '';
  
  currentConversation.forEach(function(msg) {
    // Skip messages with undefined content
    if (!msg.content) return;
    
    var div = document.createElement('div');
    div.className = 'conversation-message ' + msg.role;
    
    // v10.5.25: Check for LifeAI mode FIRST
    var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    var isLifeMode = currentMode === 'life' || document.documentElement.classList.contains('life-mode');
    
    // v9.1.14: Show StandardAI label when in StandardAI mode
    var agentBrandVal = document.getElementById('agentBrand') ? document.getElementById('agentBrand').value : '';
    var isStandardAI = agentBrandVal === 'none' && !isLifeMode;
    
    var roleLabel = msg.role === 'user' ? 'YOU' : (isLifeMode ? '◇ LifeAI' : (isStandardAI ? '◇ StandardAI' : '◆ BrandAI'));
    // Use displayContent if available (for multimodal messages), otherwise use content
    // v15.47: Use full content first, fall back to displayContent (prevents truncated history)
    // v22.14: Handle stringified multimodal arrays (from saved history) gracefully
    var content;
    if (typeof msg.content === 'string') {
      // Check if it's a stringified JSON array of multimodal parts
      if (msg.content.charAt(0) === '[' && msg.content.indexOf('"type"') !== -1) {
        // Stringified multimodal - extract text parts, use displayContent if available
        content = msg.displayContent || '';
        try {
          var parsedParts = JSON.parse(msg.content);
          if (Array.isArray(parsedParts)) {
            var textParts = parsedParts.filter(function(p) { return p.type === 'text' && p.text; }).map(function(p) { return p.text; });
            if (textParts.length > 0 && !content) content = textParts.join('\n');
            // If there were image parts, add a note
            var hasImgParts = parsedParts.some(function(p) { return p.type === 'image' || p.type === 'image_url'; });
            if (hasImgParts && !msg.attachedFiles) content = (content || '') + (content ? '' : '[Image]');
          }
        } catch(e) { if (!content) content = msg.displayContent || '[Multimodal content]'; }
      } else {
        // v26.3: Prefer displayContent for user messages (hides raw file text)
        content = (msg.role === 'user' && msg.displayContent) ? msg.displayContent : msg.content;
      }
    } else if (Array.isArray(msg.content)) {
      // Live multimodal array - extract text, use displayContent
      content = msg.displayContent || '';
      if (!content) {
        var textParts2 = msg.content.filter(function(p) { return p.type === 'text' && p.text; }).map(function(p) { return p.text; });
        content = textParts2.join('\n') || '[Image]';
      }
    } else {
      content = msg.displayContent || '[Multimodal content]';
    }

    // v12.0.3: Render file attachments as nice cards instead of plain text
    var fileCardHtml = '';
    // v22.50: Strip embedded file content blocks from display (preserved in msg.content for API)
    if (msg.role === 'user') {
      content = content.replace(/\n?\n?--- ATTACHED FILE: [^\n]+ ---\n[\s\S]*?--- END OF FILE ---/g, '').trim();
      // v26.3: Also strip format without END OF FILE marker
      content = content.replace(/\n?\n?--- ATTACHED FILE[S]? ?[\d]*:?[^\n]*---\n[\s\S]*/g, '').trim();
      content = content.replace(/\n?\n?\[File: [^\]]+\]\n[\s\S]*/g, '').trim();
    }
    if (msg.role === 'user' && msg.attachedFiles && msg.attachedFiles.length > 0) {
      fileCardHtml = renderAttachedFileCards(msg.attachedFiles, msg.id || Date.now());
      // Remove the [Attached X file(s): ...] text from content since we're showing cards
      content = content.replace(/\n?\n?\[Attached \d+ (?:file|image)\(s\): [^\]]+\]/g, '').trim();
    } else if (msg.role === 'user' && content.match(/\[Attached[\s:][^\]]+\]/)) {
      // Legacy: Extract file names from text and render cards
      // v13.9: Handle both "[Attached N file(s): ...]" and "[Attached: ...]" patterns
      var fileMatch = content.match(/\[Attached \d+ (?:file|image)\(s\): ([^\]]+)\]/) || content.match(/\[Attached:\s*([^\]]+)\]/);
      if (fileMatch) {
        var fileNames = fileMatch[1].split(', ');
        var pseudoFiles = fileNames.map(function(name, idx) {
          return { name: name.trim(), id: 'legacy_' + idx };
        });
        fileCardHtml = renderAttachedFileCards(pseudoFiles, msg.id || Date.now());
        content = content.replace(/\n?\n?\[Attached[^\]]*\]/g, '').trim();
      }
    }

    // v15.22: Use formatMessageContent() for assistant (handles images, markdown properly)
    // Use simple escapeHtml for user messages to prevent XSS but preserve readability
    if (msg.role === 'assistant') {
      content = formatMessageContent(content);
      // v15.22: Fallback — if msg has imageUrl but content lost the image, re-inject it
      if (msg.imageUrl && content.indexOf('<img') === -1) {
        content += '<div style="margin-top:8px;"><img src="' + msg.imageUrl + '" alt="Generated Image" style="max-width:100%;border-radius:8px;" /></div>';
      }
    } else {
      content = escapeHtml(content).replace(/\n/g, '<br>');
    }
    
    // Create proper bubble structure with avatar for assistant messages
    // v16.4: Add export action bar to assistant messages
    var msgActionsHtml = '<div class="chat-msg-actions"><button onclick="exportChatMsg(this,\'copy\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</button><button onclick="exportChatMsg(this,\'docx\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Word</button><button onclick="exportChatMsg(this,\'xlsx\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg> Excel</button><button onclick="exportChatMsg(this,\'pptx\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> Slides</button><button onclick="exportChatMsg(this,\'pdf\')"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13h4M10 17h4M8 9h1"/></svg> PDF</button><button onclick="openChatSaveMenu(this)"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> Save</button></div>';

    if (msg.role === 'user') {
      // v12.0.3: Include file cards if present
      var userContent = content;
      if (fileCardHtml) {
        userContent = fileCardHtml + (content ? '<div style="margin-top: var(--space-3);">' + content + '</div>' : '');
      }
      div.innerHTML = '<div class="conversation-message-bubble"><div class="conversation-message-role">' + roleLabel + '</div><div class="conversation-message-content">' + userContent + '</div></div>';
    } else {
      // v10.5.25: Check LifeAI first, then StandardAI, then BrandAI
      if (isLifeMode) {
        div.classList.add('life-ai-response');
        div.innerHTML = '<div class="conversation-avatar life-ai-avatar"><span class="avatar-icon">◇</span><span class="avatar-label">LifeAI</span></div><div class="conversation-message-bubble"><div class="conversation-message-content">' + content + '</div>' + msgActionsHtml + '</div>';
      } else if (isStandardAI) {
        div.classList.add('standard-ai-response');
        div.innerHTML = '<div class="conversation-avatar standard-ai-avatar"><span class="avatar-icon">◇</span><span class="avatar-label">StandardAI</span></div><div class="conversation-message-bubble"><div class="conversation-message-content">' + content + '</div>' + msgActionsHtml + '</div>';
      } else if (content.indexOf('deep-research-card') !== -1) {
        // v16.10: Deep research results — add class for mobile ::before pill
        div.classList.add('deep-research-message');
        div.innerHTML = '<div class="conversation-avatar"><span class="research-icon">&#9670;</span><span class="research-label">Research</span></div><div class="conversation-message-bubble"><div class="conversation-message-content">' + content + '</div>' + msgActionsHtml + '</div>';
      } else if (window._villainousMode) {
        // v29.0: Villainous Game Master mode
        div.classList.add('villainous-response');
        div.innerHTML = '<div class="conversation-avatar"><span class="avatar-icon" style="background:linear-gradient(135deg,#7c3aed,#4c1d95)!important;color:#fff!important;">&#9876;</span><span class="avatar-label" style="color:#a78bfa!important;">Villainous</span></div><div class="conversation-message-bubble"><div class="conversation-message-content">' + content + '</div>' + msgActionsHtml + '</div>';
      } else {
        div.innerHTML = '<div class="conversation-avatar"><span class="avatar-icon">◆</span><span class="avatar-label">BrandAI</span></div><div class="conversation-message-bubble"><div class="conversation-message-content">' + content + '</div>' + msgActionsHtml + '</div>';
      }
    }
    thread.appendChild(div);
  });
  
  thread.scrollTop = thread.scrollHeight;
}

// v12.0.3: Render attached file cards for chat messages
function renderAttachedFileCards(files, messageId) {
  if (!files || files.length === 0) return '';

  var html = '<div class="chat-file-cards">';

  files.forEach(function(file, idx) {
    var ext = (file.name || '').split('.').pop().toLowerCase();
    var isPdf = ext === 'pdf';
    var isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].indexOf(ext) > -1;
    var fileId = file.id || (messageId + '_' + idx);

    // Icon based on file type
    var iconSvg = isPdf
      ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M9 11h6"/></svg>'
      : isImage
        ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
        : '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

    var fileSize = file.size ? formatFileSize(file.size) : '';
    var pageInfo = file.pages ? file.pages + ' pages' : '';
    var metaInfo = pageInfo || fileSize || ext.toUpperCase();

    // v20.1: Show image thumbnail for image files with data URL content
    var hasImagePreview = isImage && file.content && typeof file.content === 'string' && file.content.indexOf('data:image') === 0;

    if (hasImagePreview) {
      html += '<div class="chat-file-card chat-file-card-image" data-file-id="' + fileId + '">';
      html += '<img src="' + file.content + '" alt="' + escapeHtml(file.name) + '" class="chat-file-card-thumb" />';
      html += '<div class="chat-file-card-info">';
      html += '<div class="chat-file-card-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</div>';
      html += '<div class="chat-file-card-meta">' + metaInfo + '</div>';
      html += '</div>';
      html += '</div>';
    } else {
      html += '<div class="chat-file-card" data-file-id="' + fileId + '">';
      html += '<div class="chat-file-card-icon">' + iconSvg + '</div>';
      html += '<div class="chat-file-card-info">';
      html += '<div class="chat-file-card-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</div>';
      html += '<div class="chat-file-card-meta">' + metaInfo + '</div>';
      html += '</div>';

      // If we have stored content, show expand button
      if (file.hasContent || file.content) {
        html += '<button class="chat-file-card-btn" onclick="toggleFileContentPreview(\'' + fileId + '\')" title="View content">';
        html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        html += '</button>';
      }

      html += '</div>';
    }
  });

  html += '</div>';
  return html;
}

// v24.27: Removed duplicate formatFileSize — the version at line ~68623 handles null guard + GB tier

function toggleFileContentPreview(fileId) {
  // Find the file card and toggle content preview
  var card = document.querySelector('.chat-file-card[data-file-id="' + fileId + '"]');
  if (!card) return;

  var existingPreview = card.querySelector('.chat-file-content-preview');
  if (existingPreview) {
    existingPreview.remove();
    return;
  }

  // Find the file content from the current conversation
  var fileContent = null;
  currentConversation.forEach(function(msg) {
    if (msg.attachedFiles) {
      msg.attachedFiles.forEach(function(f) {
        if (f.id === fileId && f.content) {
          fileContent = f.content;
        }
      });
    }
  });

  if (!fileContent) {
    showToast('File content not available for preview', 'info');
    return;
  }

  // Create preview panel
  var preview = document.createElement('div');
  preview.className = 'chat-file-content-preview';
  preview.innerHTML = '<div class="chat-file-content-preview-header">' +
    '<span>File Content</span>' +
    '<button onclick="this.parentElement.parentElement.remove()">✕</button>' +
    '</div>' +
    '<div class="chat-file-content-preview-body">' + escapeHtml(fileContent).substring(0, 5000) +
    (fileContent.length > 5000 ? '\n\n... [Content truncated - ' + Math.round(fileContent.length / 1000) + 'KB total]' : '') +
    '</div>';

  card.appendChild(preview);
}

// v24.27: Strip AI tool call XML from display
function stripToolCallXml(text) {
  if (!text) return text;
  // Remove function_calls blocks entirely
  text = text.replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '');
  text = text.replace(/<function_results>[\s\S]*?<\/function_results>/gi, '');
  // Remove antml:invoke / antml:parameter blocks
  text = text.replace(/<invoke[\s\S]*?<\/antml:invoke>/gi, '');
  text = text.replace(/<parameter[^>]*>[\s\S]*?<\/antml:parameter>/gi, '');
  // Remove individual tags if blocks aren't complete (streaming)
  text = text.replace(/<\/?(?:function_calls|function_results|antml:invoke|antml:parameter|invoke)[^>]*>/gi, '');
  // Remove parameter tags with content
  text = text.replace(/<parameter[^>]*>[\s\S]*?<\/parameter>/gi, '');
  return text.trim();
}

// Format message content with markdown-like formatting
function formatMessageContent(content) {
  // v20.18: Guard against undefined/null/empty content
  if (!content || (typeof content === 'string' && !content.trim())) {
    return '<p style="color:var(--text-dim, #8a857f);font-style:italic;">No response received - the AI may be temporarily overloaded. Try again.</p>';
  }
  if (typeof content !== 'string') {
    try { content = String(content); } catch(e) { return '<p style="color:var(--text-dim);">Unable to display response.</p>'; }
  }
  var displayContent = content;

  // v25.1: Strip em-dashes and en-dashes from AI output
  displayContent = displayContent.replace(/\u2014/g, ' - ').replace(/\u2013/g, ' - ').replace(/\u2015/g, ' - ');

  // v24.27: Detect web search invocations BEFORE stripping XML, replace with indicator
  var webSearchIndicatorHtml = '<div class="web-search-indicator" style="display:flex;align-items:center;gap:8px;padding:12px;background:rgba(168,152,120,0.08);border:1px solid rgba(168,152,120,0.15);border-radius:8px;margin:8px 0;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--brand-accent,#a89878)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><span style="font-size:13px;color:var(--text-secondary);">Searching the web...</span></div>';
  // Match XML-style invoke with web_search/WebSearch
  displayContent = displayContent.replace(/<(?:antml:)?invoke\s+name\s*=\s*["'](?:web_search|WebSearch|web-search)["'][^>]*>[\s\S]*?<\/(?:antml:)?invoke>/gi, '%%WEB_SEARCH_INDICATOR%%');
  // Match incomplete XML invoke for web_search (streaming — block not yet closed)
  displayContent = displayContent.replace(/<(?:antml:)?invoke\s+name\s*=\s*["'](?:web_search|WebSearch|web-search)["'][^>]*>[\s\S]*$/gi, '%%WEB_SEARCH_INDICATOR%%');
  // Match function-call style: web_search("query")
  displayContent = displayContent.replace(/(?:web_search|WebSearch|web-search)\s*\([^)]*\)/gi, '%%WEB_SEARCH_INDICATOR%%');

  // v24.27: Strip AI tool call XML before rendering
  displayContent = stripToolCallXml(displayContent);

  // v15.45: Strip web_search tool call lines from displayed text (model simulates tool calls as text)
  displayContent = displayContent.replace(/^[ \t]*web_search\(["'][^"']*["']\)[ \t]*\n?/gm, '');
  // v20.6: Strip XML-style tool call/response blocks (Gemini outputs these as text)
  displayContent = displayContent.replace(/<tool_call>\s*[\s\S]*?<\/tool_call>\s*/gi, '');
  displayContent = displayContent.replace(/<tool_response>\s*[\s\S]*?<\/tool_response>\s*/gi, '');
  displayContent = displayContent.replace(/<tool_call>\s*[\s\S]*?$/gi, ''); // unclosed at end
  displayContent = displayContent.replace(/<tool_response>\s*[\s\S]*?$/gi, ''); // unclosed at end

  // v20.6: Strip URL context blocks from display (injected for API only)
  displayContent = displayContent.replace(/\n\n---\n\[Web page content from [^\]]*\]\n[\s\S]*?\[End of web page content\]/g, '');

  // v20.5: Strip markdown blockquote prefix (> ) — AI models output it but it looks wrong in chat
  displayContent = displayContent.replace(/^> ?/gm, '');

  // v14.2: Extract image markdown before HTML escape to prevent base64 rendering as text
  var imageStore = [];
  displayContent = displayContent.replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, function(match, alt, src) {
    var idx = imageStore.length;
    imageStore.push('<img src="' + src + '" alt="' + (alt || 'Generated Image') + '" style="max-width:100%;border-radius:8px;margin:8px 0;" />');
    return '%%IMG_PLACEHOLDER_' + idx + '%%';
  });

  // v19.7: Extract roweos-pipeline and roweos-automation JSON blocks before HTML escape
  // v20.8: Use global counter so card IDs never collide across messages
  if (!window._automationProposals) window._automationProposals = {};
  if (!window._autoCardCounter) window._autoCardCounter = 0;
  var autoCardStore = [];
  displayContent = displayContent.replace(/```roweos-(pipeline|automation)\s*\n([\s\S]*?)```/g, function(match, blockType, jsonStr) {
    var cardIdx = window._autoCardCounter++;
    var localIdx = autoCardStore.length;
    var cardHtml = renderAutomationProposalCard(blockType, jsonStr, cardIdx);
    autoCardStore.push(cardHtml);
    return '%%AUTOMATION_PLACEHOLDER_' + localIdx + '%%';
  });

  // v20.6: Extract roweos-identity-update JSON blocks — apply to identity and render confirmation card
  var identityCardStore = [];
  displayContent = displayContent.replace(/```roweos-identity-update\s*\n([\s\S]*?)```/g, function(match, jsonStr) {
    var cardIdx = identityCardStore.length;
    var cardHtml = applyIdentityUpdateFromChat(jsonStr, cardIdx);
    identityCardStore.push(cardHtml);
    return '%%IDENTITY_PLACEHOLDER_' + cardIdx + '%%';
  });

  // v22.35: Extract roweos-add-clients JSON blocks — add to clients (deduplicated)
  if (!window._processedClientBlocks) window._processedClientBlocks = {};
  var clientCardStore = [];
  displayContent = displayContent.replace(/```roweos-add-clients\s*\n([\s\S]*?)```/g, function(match, jsonStr) {
    var cardIdx = clientCardStore.length;
    var blockKey = jsonStr.trim();
    var cardHtml = '';
    try {
      var newClients = JSON.parse(blockKey);
      if (Array.isArray(newClients) && newClients.length > 0) {
        var names = newClients.map(function(c) { return c.name; }).join(', ');
        // v22.35: Only add clients once — skip if this exact block was already processed
        if (!window._processedClientBlocks[blockKey]) {
          window._processedClientBlocks[blockKey] = true;
          var clients = getClients();
          var now = new Date().toISOString();
          var addedCount = 0;
          newClients.forEach(function(nc) {
            if (nc.name) {
              clients.push({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                brandIndex: typeof selectedBrand !== 'undefined' ? selectedBrand : 0,
                name: nc.name || '',
                company: nc.company || nc.name || '',
                industry: nc.industry || '',
                role: nc.role || '',
                location: nc.location || '',
                website: nc.website || '',
                email: nc.email || '',
                phone: nc.phone || '',
                notes: nc.notes || 'Added via Chat AI',
                stage: 'lead',
                stageHistory: [{ stage: 'lead', date: now }],
                logo: '',
                createdAt: now
              });
              addedCount++;
            }
          });
          if (addedCount > 0) {
            saveClients(clients);
          }
        }
        cardHtml = '<div style="background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.3); border-radius: var(--radius-lg); padding: 12px 16px; margin: 8px 0;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>' +
          '<span style="font-weight:600;color:#22c55e;font-size:13px;">' + newClients.length + ' client' + (newClients.length > 1 ? 's' : '') + ' added as leads</span></div>' +
          '<div style="font-size:12px;color:var(--text-muted);">' + escapeHtml(names) + '</div></div>';
      }
    } catch(e) { console.warn('[Chat] Client add parse failed:', e); }
    clientCardStore.push(cardHtml);
    return '%%CLIENT_PLACEHOLDER_' + cardIdx + '%%';
  });

  // v19.8: Extract roweos-social-post JSON blocks before HTML escape
  // v20.8: Use global counter so card IDs never collide across messages
  if (!window._chatSocialProposals) window._chatSocialProposals = {};
  if (!window._socialCardCounter) window._socialCardCounter = 0;
  var socialCardStore = [];
  displayContent = displayContent.replace(/```roweos-social-post\s*\n([\s\S]*?)```/g, function(match, jsonStr) {
    var cardIdx = window._socialCardCounter++;
    var localIdx = socialCardStore.length;
    var cardHtml = renderSocialPostCard(jsonStr, cardIdx);
    socialCardStore.push(cardHtml);
    return '%%SOCIAL_PLACEHOLDER_' + localIdx + '%%';
  });

  // v24.25: Extract ```html blocks and render as live sandboxed visuals
  if (!window._visualCardCounter) window._visualCardCounter = 0;
  var visualCardStore = [];
  displayContent = displayContent.replace(/```html\s*\n([\s\S]*?)```/g, function(match, htmlCode) {
    // Only render as visual if it looks like a full document or has meaningful HTML (not just a snippet)
    var trimmed = htmlCode.trim();
    var isVisual = (trimmed.indexOf('<') !== -1) && (
      trimmed.indexOf('<div') !== -1 || trimmed.indexOf('<svg') !== -1 ||
      trimmed.indexOf('<canvas') !== -1 || trimmed.indexOf('<style') !== -1 ||
      trimmed.indexOf('<!DOCTYPE') !== -1 || trimmed.indexOf('<html') !== -1 ||
      trimmed.indexOf('<script') !== -1 || trimmed.indexOf('<table') !== -1
    );
    if (!isVisual) return match; // Leave as regular code block
    var cardId = window._visualCardCounter++;
    var localIdx = visualCardStore.length;
    // Build the iframe srcdoc — inject base styles for dark background + viewport meta
    var srcdocHtml = trimmed;
    if (srcdocHtml.indexOf('<meta name="viewport"') === -1 && srcdocHtml.indexOf('<!DOCTYPE') === -1) {
      srcdocHtml = '<meta name="viewport" content="width=device-width,initial-scale=1">' + srcdocHtml;
    }
    // Escape for srcdoc attribute (double-encode quotes and ampersands)
    var escapedSrcdoc = srcdocHtml
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    var escapedSource = trimmed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    var cardHtml = '<div class="visual-card" id="visualCard_' + cardId + '">'
      + '<div class="visual-card-header">'
      + '<span class="visual-label"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> Visual</span>'
      + '<span class="visual-actions">'
      + '<button onclick="toggleVisualSource(' + cardId + ',false)" class="active">Preview</button>'
      + '<button onclick="toggleVisualSource(' + cardId + ',true)">Source</button>'
      + '<button onclick="expandVisual(' + cardId + ')" title="Expand preview">Expand</button>'
      + '<button onclick="saveVisualToFolio(' + cardId + ')" title="Save to Folio">Save</button>'
      + '<button onclick="showView(\'folio\')" title="View Visual Library" style="color:var(--brand-accent,#a89878);">Library</button>'
      + '</span></div>'
      + '<iframe sandbox="allow-scripts" srcdoc="' + escapedSrcdoc + '" onload="resizeVisualIframe(this)"></iframe>'
      + '<div class="visual-source">' + escapedSource + '</div>'
      + '</div>';
    visualCardStore.push(cardHtml);
    return '%%VISUAL_PLACEHOLDER_' + localIdx + '%%';
  });

  // v29.0: Extract ```pulse_goal blocks and render as styled goal cards (not raw JSON)
  if (!window._pulseGoalCardCounter) window._pulseGoalCardCounter = 0;
  var pulseGoalCardStore = [];
  displayContent = displayContent.replace(/```pulse_goal\s*\n([\s\S]*?)```/g, function(match, jsonStr) {
    var localIdx = pulseGoalCardStore.length;
    var cardHtml = '';
    try {
      var parsed = JSON.parse(jsonStr.trim());
      var title = parsed.title || 'Untitled Goal';
      var desc = parsed.description || '';
      var items = (parsed.items && Array.isArray(parsed.items)) ? parsed.items : [];
      var previewDesc = desc.length > 120 ? desc.substring(0, 120) + '...' : desc;
      var goalId = 'pulseGoalCard_' + (window._pulseGoalCardCounter++);
      // Store for later use by action buttons
      if (!window._pendingPulseGoals) window._pendingPulseGoals = {};
      window._pendingPulseGoals[goalId] = parsed;
      cardHtml = '<div style="padding:14px 16px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:10px;margin:8px 0;">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
        + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a89878" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>'
        + '<span style="font-weight:600;color:var(--brand-accent, #a89878);font-size:13px;">' + escapeHtml(title) + '</span>'
        + '</div>'
        + (previewDesc ? '<div style="font-size:12px;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">' + escapeHtml(previewDesc) + '</div>' : '')
        + (items.length > 0 ? '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">' + items.length + ' task' + (items.length > 1 ? 's' : '') + '</div>' : '')
        + '<div style="display:flex;gap:8px;">'
        + '<button onclick="addPendingPulseGoal(\'' + goalId + '\', this)" style="padding:5px 12px;border-radius:var(--radius-sm, 6px);border:1px solid var(--brand-accent, #a89878);background:var(--brand-accent-10, rgba(168,152,120,0.1));color:var(--brand-accent, #a89878);font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;">Add to Pulse</button>'
        + '<button onclick="this.closest(\'div[style]\').parentElement.style.display=\'none\'" style="padding:5px 12px;border-radius:var(--radius-sm, 6px);border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;">Dismiss</button>'
        + '</div></div>';
    } catch(e) {
      cardHtml = '<div style="padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#ef4444;font-size:13px;">Failed to parse pulse goal</div>';
    }
    pulseGoalCardStore.push(cardHtml);
    return '%%PULSE_GOAL_PLACEHOLDER_' + localIdx + '%%';
  });

  // v25.1: ST2 fix — detect incomplete ```html blocks (still streaming) and show building animation
  // If there's an open ```html block without a closing ```, replace it with a pulsating placeholder
  var incompleteHtmlMatch = displayContent.match(/```html\s*\n([\s\S]*)$/);
  if (incompleteHtmlMatch) {
    var preBlock = displayContent.substring(0, incompleteHtmlMatch.index);
    displayContent = preBlock + '%%VISUAL_BUILDING%%';
  }

  // Escape HTML first
  displayContent = displayContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Headers
  displayContent = displayContent.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  displayContent = displayContent.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  displayContent = displayContent.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Bold and italic
  displayContent = displayContent.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  displayContent = displayContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  displayContent = displayContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code blocks
  displayContent = displayContent.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  displayContent = displayContent.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Horizontal rules
  displayContent = displayContent.replace(/^---$/gm, '<hr>');
  
  // v15.47: Markdown table rendering — detect lines with | separators
  displayContent = displayContent.replace(/((?:^[^\n]*\|[^\n]*$\n?){2,})/gm, function(tableBlock) {
    var tableLines = tableBlock.trim().split('\n').filter(function(l) { return l.trim(); });
    if (tableLines.length < 2) return tableBlock;
    // Check for separator row (---|---|---)
    var hasSep = false;
    var sepIdx = -1;
    for (var ti = 0; ti < tableLines.length; ti++) {
      if (tableLines[ti].replace(/[\s|:-]/g, '') === '') { hasSep = true; sepIdx = ti; break; }
    }
    var headerRow = hasSep && sepIdx === 1 ? tableLines[0] : null;
    var dataStart = hasSep ? sepIdx + 1 : 0;
    var tHtml = '<table style="border-collapse:collapse;border:1px solid var(--border-color);width:100%;margin:8px 0;font-size:var(--text-sm);">';
    if (headerRow) {
      var hCells = headerRow.split('|').map(function(c) { return c.trim(); }).filter(function(c) { return c; });
      tHtml += '<thead><tr>';
      hCells.forEach(function(c) { tHtml += '<th style="border:1px solid var(--border-color);padding:6px 10px;text-align:left;font-weight:600;background:var(--bg-secondary);">' + c + '</th>'; });
      tHtml += '</tr></thead>';
    }
    tHtml += '<tbody>';
    for (var di = dataStart; di < tableLines.length; di++) {
      var cells = tableLines[di].split('|').map(function(c) { return c.trim(); }).filter(function(c) { return c; });
      if (cells.length === 0) continue;
      tHtml += '<tr>';
      cells.forEach(function(c) { tHtml += '<td style="border:1px solid var(--border-color);padding:6px 10px;">' + c + '</td>'; });
      tHtml += '</tr>';
    }
    tHtml += '</tbody></table>';
    return tHtml;
  });

  // Lists - handle different bullet types
  var lines = displayContent.split('\n');
  var inList = false;
  var listType = null;
  var result = [];
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var bulletMatch = line.match(/^[\s]*[-•○■▪▸*]\s+(.*)$/);
    var numberMatch = line.match(/^[\s]*(\d+)[.)]\s+(.*)$/);
    
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) result.push('</' + listType + '>');
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push('<li>' + bulletMatch[1] + '</li>');
    } else if (numberMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push('</' + listType + '>');
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push('<li>' + numberMatch[2] + '</li>');
    } else {
      // v10.5.25: Look ahead past blank lines — don't close the list if the next
      // non-empty line is another list item of the same type
      if (inList && !line.trim()) {
        var keepOpen = false;
        for (var j = i + 1; j < lines.length; j++) {
          if (lines[j].trim()) {
            if (listType === 'ol' && lines[j].match(/^[\s]*(\d+)[.)]\s+/)) keepOpen = true;
            if (listType === 'ul' && lines[j].match(/^[\s]*[-•○■▪▸*]\s+/)) keepOpen = true;
            break;
          }
        }
        if (keepOpen) continue; // Skip the blank line, keep list open
      }
      if (inList) {
        result.push('</' + listType + '>');
        inList = false;
        listType = null;
      }
      if (line.trim()) {
        // Check if it's already wrapped in a block element
        if (!line.match(/^<(h[1-6]|pre|blockquote|hr|ul|ol|li)/)) {
          result.push('<p>' + line + '</p>');
        } else {
          result.push(line);
        }
      }
    }
  }
  if (inList) {
    result.push('</' + listType + '>');
  }
  
  displayContent = result.join('');
  
  // Clean up empty paragraphs
  displayContent = displayContent.replace(/<p><\/p>/g, '');
  displayContent = displayContent.replace(/<p>\s*<\/p>/g, '');

  // v14.2: Restore image placeholders
  for (var imgIdx = 0; imgIdx < imageStore.length; imgIdx++) {
    displayContent = displayContent.replace('%%IMG_PLACEHOLDER_' + imgIdx + '%%', imageStore[imgIdx]);
  }

  // v19.7: Restore automation proposal card placeholders
  for (var acIdx = 0; acIdx < autoCardStore.length; acIdx++) {
    displayContent = displayContent.replace('%%AUTOMATION_PLACEHOLDER_' + acIdx + '%%', autoCardStore[acIdx]);
  }

  // v19.8: Restore social post card placeholders
  for (var scIdx = 0; scIdx < socialCardStore.length; scIdx++) {
    displayContent = displayContent.replace('%%SOCIAL_PLACEHOLDER_' + scIdx + '%%', socialCardStore[scIdx]);
  }

  // v20.6: Restore identity update card placeholders
  for (var idIdx = 0; idIdx < identityCardStore.length; idIdx++) {
    displayContent = displayContent.replace('%%IDENTITY_PLACEHOLDER_' + idIdx + '%%', identityCardStore[idIdx]);
  }

  // v22.33: Restore client add card placeholders
  for (var clIdx = 0; clIdx < clientCardStore.length; clIdx++) {
    displayContent = displayContent.replace('%%CLIENT_PLACEHOLDER_' + clIdx + '%%', clientCardStore[clIdx]);
  }

  // v24.25: Restore visual card placeholders
  for (var vIdx = 0; vIdx < visualCardStore.length; vIdx++) {
    displayContent = displayContent.replace('%%VISUAL_PLACEHOLDER_' + vIdx + '%%', visualCardStore[vIdx]);
  }

  // v29.0: Restore pulse goal card placeholders
  for (var pgIdx = 0; pgIdx < pulseGoalCardStore.length; pgIdx++) {
    displayContent = displayContent.replace('%%PULSE_GOAL_PLACEHOLDER_' + pgIdx + '%%', pulseGoalCardStore[pgIdx]);
  }

  // v24.27: Restore web search indicator placeholders
  displayContent = displayContent.replace(/%%WEB_SEARCH_INDICATOR%%/g, webSearchIndicatorHtml);

  // v25.1: Restore visual building placeholder (streaming incomplete html block)
  var visualBuildingHtml = '<div class="visual-building">'
    + '<div class="visual-building-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div>'
    + '<div class="visual-building-text">Building Visual</div>'
    + '<div class="visual-building-sub">Generating your design...</div>'
    + '</div>';
  displayContent = displayContent.replace(/%%VISUAL_BUILDING%%/g, visualBuildingHtml);

  return displayContent;
}

// v24.25: Visual card helpers
function toggleVisualSource(cardId, showSource) {
  var card = document.getElementById('visualCard_' + cardId);
  if (!card) return;
  card.classList.toggle('show-source', showSource);
  var btns = card.querySelectorAll('.visual-actions button');
  if (btns.length >= 2) {
    btns[0].classList.toggle('active', !showSource);
    btns[1].classList.toggle('active', showSource);
  }
}

// v24.27: Expand visual as modal overlay (not window.open which takes over the page)
function expandVisual(cardId) {
  var card = document.getElementById('visualCard_' + cardId);
  if (!card) return;
  var source = card.querySelector('.visual-source');
  if (!source) return;
  // Decode the escaped source back to raw HTML
  var raw = source.innerHTML.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  // Remove any existing expand modal
  var existing = document.getElementById('visualExpandModal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'visualExpandModal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:env(safe-area-inset-top, 0px);';

  var closeBar = document.createElement('div');
  closeBar.style.cssText = 'position:absolute;top:calc(12px + env(safe-area-inset-top, 0px));left:0;right:0;z-index:100000;display:flex;justify-content:space-between;align-items:center;padding:0 16px;pointer-events:none;';
  closeBar.innerHTML = '<button onclick="document.getElementById(\'visualExpandModal\').remove()" style="pointer-events:auto;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.25);color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);" title="Close">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
    '<div style="display:flex;gap:8px;pointer-events:auto;">' +
    '<button onclick="saveVisualToFolio(' + cardId + ')" style="background:rgba(168,152,120,0.2);border:1px solid rgba(168,152,120,0.4);color:#a89878;font-size:14px;padding:8px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;backdrop-filter:blur(4px);"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> Save</button>' +
    '<button onclick="document.getElementById(\'visualExpandModal\').remove();showView(\'folio\')" style="background:rgba(168,152,120,0.1);border:1px solid rgba(168,152,120,0.3);color:#a89878;font-size:14px;padding:8px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;backdrop-filter:blur(4px);">Library</button>' +
    '</div>';

  var iframeContainer = document.createElement('div');
  iframeContainer.style.cssText = 'width:90vw;height:85vh;max-width:1200px;border-radius:12px;overflow:auto;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.5);';

  var iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-scripts';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.srcdoc = raw;

  iframeContainer.appendChild(iframe);
  overlay.appendChild(closeBar);
  overlay.appendChild(iframeContainer);

  // Close on overlay background click (not iframe)
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  // Close on Escape key
  var escHandler = function(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);
}

// v25.1: Save visual card content to Folio
function saveVisualToFolio(cardId) {
  var card = document.getElementById('visualCard_' + cardId);
  if (!card) { showToast('Visual card not found', 'error'); return; }
  var source = card.querySelector('.visual-source');
  if (!source) { showToast('No visual source found', 'error'); return; }
  var raw = source.innerHTML.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  if (typeof saveToFolio === 'function') {
    saveToFolio(raw, 'Chat Visual ' + new Date().toLocaleDateString(), 'folio-chat');
    showToast('Saved to Folio', 'success');
  } else {
    showToast('Folio not available', 'error');
  }
}

function resizeVisualIframe(iframe) {
  try {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    if (doc && doc.body) {
      var h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 200);
      iframe.style.height = Math.min(h + 20, window.innerHeight * 0.8) + 'px';
    }
  } catch(e) {
    iframe.style.height = '400px';
  }
}

// v20.6 / v29.0: Render identity update proposal card — does NOT auto-apply, user must confirm
function applyIdentityUpdateFromChat(jsonStr, cardIndex) {
  try {
    var trimmedJson = jsonStr.trim();
    var parsed = JSON.parse(trimmedJson);
    var section = parsed.section;
    var content = parsed.content;
    var validSections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
    var sectionLabels = { essence: 'Brand Essence', voice: 'Brand Voice', audience: 'Target Audience', messaging: 'Key Messaging', products: 'Products & Services', visual: 'Visual Identity', competitive: 'Competitive Position' };

    if (!section || validSections.indexOf(section) === -1 || !content) {
      return '<div style="padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#ef4444;font-size:13px;">Invalid identity update: unknown section "' + escapeHtml(section || '') + '"</div>';
    }

    // Store pending update data for confirmation
    if (!window._pendingIdentityUpdates) window._pendingIdentityUpdates = {};
    var updateId = 'identityUpdate_' + (window._identityUpdateCounter = (window._identityUpdateCounter || 0) + 1);
    window._pendingIdentityUpdates[updateId] = { section: section, content: content };

    var preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
    // v29.0: Render as a proposal card with Add/Dismiss — NOT auto-applied
    return '<div id="' + updateId + '_card" style="padding:14px 16px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:10px;margin:8px 0;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a89878" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
      '<span style="font-weight:600;color:var(--brand-accent, #a89878);font-size:13px;">Update: ' + escapeHtml(sectionLabels[section] || section) + '</span>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary);line-height:1.5;white-space:pre-wrap;margin-bottom:10px;">' + escapeHtml(preview) + '</div>' +
      '<div style="display:flex;gap:8px;">' +
      '<button onclick="confirmIdentityUpdate(\'' + updateId + '\', this)" style="padding:5px 12px;border-radius:var(--radius-sm, 6px);border:1px solid var(--brand-accent, #a89878);background:var(--brand-accent-10, rgba(168,152,120,0.1));color:var(--brand-accent, #a89878);font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;">Add to Identity</button>' +
      '<button onclick="this.closest(\'[id$=_card]\').style.display=\'none\'" style="padding:5px 12px;border-radius:var(--radius-sm, 6px);border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;font-family:inherit;">Dismiss</button>' +
      '</div></div>';
  } catch(e) {
    return '<div style="padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#ef4444;font-size:13px;">Failed to parse identity update</div>';
  }
}

// v29.0: Confirm and apply an identity update when user clicks "Add to Identity"
function confirmIdentityUpdate(updateId, btn) {
  var updateData = window._pendingIdentityUpdates && window._pendingIdentityUpdates[updateId];
  if (!updateData) { showToast('Could not find update data', 'error'); return; }
  var section = updateData.section;
  var content = updateData.content;
  var sectionLabels = { essence: 'Brand Essence', voice: 'Brand Voice', audience: 'Target Audience', messaging: 'Key Messaging', products: 'Products & Services', visual: 'Visual Identity', competitive: 'Competitive Position' };

  if (typeof brands !== 'undefined' && typeof selectedBrand !== 'undefined' && brands[selectedBrand]) {
    var brand = brands[selectedBrand];
    if (!brand.identityData) brand.identityData = {};
    if (!brand.identityData[section]) brand.identityData[section] = {};
    var existingAi = brand.identityData[section].ai || '';
    if (Array.isArray(existingAi)) {
      existingAi = existingAi.map(function(item) {
        return typeof item === 'string' ? item : (item.text || '');
      }).join('\n');
    }
    brand.identityData[section].ai = existingAi ? existingAi + '\n\n' + content : content;
    saveBrands();
    var textarea = document.getElementById('identity-' + section + '-ai');
    if (textarea) textarea.value = brand.identityData[section].ai;
    if (typeof updateIdentityBadges === 'function') updateIdentityBadges(section);
    if (typeof saveBrandAIPromptTimestamp === 'function') saveBrandAIPromptTimestamp(selectedBrand);
  }

  // Transform the card to green confirmed state
  var card = document.getElementById(updateId + '_card');
  if (card) {
    card.style.background = 'rgba(34,197,94,0.08)';
    card.style.borderColor = 'rgba(34,197,94,0.25)';
  }
  btn.textContent = 'Added';
  btn.style.background = '#22c55e';
  btn.style.borderColor = '#22c55e';
  btn.style.color = '#fff';
  btn.style.pointerEvents = 'none';
  // Update the header icon and text to green checkmark
  var header = btn.closest('[id$="_card"]').querySelector('span[style*="font-weight:600"]');
  if (header) {
    header.style.color = '#22c55e';
    header.textContent = 'Updated: ' + (sectionLabels[section] || section);
  }
  var iconSvg = btn.closest('[id$="_card"]').querySelector('svg');
  if (iconSvg) iconSvg.setAttribute('stroke', '#22c55e');
  var dismissBtn = btn.nextElementSibling;
  if (dismissBtn) dismissBtn.style.display = 'none';
  showToast((sectionLabels[section] || section) + ' updated', 'success');
}

// v19.7: Render an inline automation/pipeline proposal card from AI-generated JSON
function renderAutomationProposalCard(blockType, jsonStr, cardIndex) {
  var parsed = null;
  try {
    // Clean trailing commas that AI might produce
    var cleaned = jsonStr.trim().replace(/,\s*([}\]])/g, '$1');
    parsed = JSON.parse(cleaned);
  } catch(e) {
    // Parse error — return error card
    return '<div style="border:1px solid #ef4444;border-radius:12px;padding:16px;margin:12px 0;background:rgba(239,68,68,0.08);">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
      '<span style="color:#ef4444;font-weight:600;font-size:14px;">Could not parse automation</span></div>' +
      '<span style="color:var(--apc-sub, rgba(255,255,255,0.5));font-size:12px;">The JSON block was malformed. Try asking again.</span></div>';
  }

  // Guard against null/non-object parse results
  if (!parsed || typeof parsed !== 'object') {
    return '<div style="border:1px solid #ef4444;border-radius:12px;padding:16px;margin:12px 0;background:rgba(239,68,68,0.08);">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
      '<span style="color:#ef4444;font-weight:600;font-size:14px;">Could not parse automation</span></div>' +
      '<span style="color:var(--apc-sub, rgba(255,255,255,0.5));font-size:12px;">Invalid JSON structure. Try asking again.</span></div>';
  }

  // Store parsed data for button handlers
  window._automationProposals[cardIndex] = { type: blockType, data: parsed };

  var accent = 'var(--brand-accent, #a89878)';
  var isPipeline = blockType === 'pipeline';
  var name = escapeHtml(parsed.name || (isPipeline ? 'Untitled Pipeline' : 'Untitled Automation'));
  var timeStr = parsed.time || '09:00';
  var recurLabel = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', none: 'One-time' }[parsed.recurType] || 'One-time';
  var schedLabel = recurLabel + ' at ' + timeStr;

  // Icon SVG
  var icon = isPipeline
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + accent + '" stroke-width="1.5"><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="1.5" fill="' + accent + '"/><circle cx="12" cy="12" r="1.5" fill="' + accent + '"/><circle cx="16" cy="19" r="1.5" fill="' + accent + '"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + accent + '" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

  var html = '<div class="automation-proposal-card" id="autoProposalCard_' + cardIndex + '" ' +
    'style="border:1px solid var(--apc-border);border-radius:12px;padding:16px;margin:12px 0;' +
    'background:rgba(168,152,120,0.06);backdrop-filter:blur(8px);">';

  // Header
  html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
    icon +
    '<div style="flex:1;min-width:0;">' +
    '<div style="font-weight:600;font-size:14px;color:var(--apc-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
    '<div style="font-size:12px;color:var(--apc-sub);margin-top:2px;">' +
    (isPipeline ? 'Pipeline' : 'Automation') + ' &middot; ' + escapeHtml(schedLabel) + '</div>' +
    '</div></div>';

  // Steps visualization (pipeline) or action summary (single)
  if (isPipeline && parsed.steps && parsed.steps.length > 0) {
    var stepColors = { studio: '#a78bfa', image: '#f472b6', post: '#4ade80', notify: '#fbbf24', create: '#60a5fa', message: '#818cf8' };
    html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">';
    for (var si = 0; si < parsed.steps.length; si++) {
      var step = parsed.steps[si];
      var sColor = stepColors[step.action] || '#a89878';
      var sName = escapeHtml(step.name || ('Step ' + (si + 1)));
      var sAction = escapeHtml(step.action || 'studio');
      html += '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div style="width:3px;height:28px;border-radius:2px;background:' + sColor + ';flex-shrink:0;"></div>' +
        '<div style="background:var(--apc-bg);border-radius:8px;padding:6px 10px;flex:1;min-width:0;">' +
        '<span style="font-size:12px;font-weight:600;color:' + sColor + ';text-transform:uppercase;margin-right:6px;">S' + (si + 1) + '</span>' +
        '<span style="font-size:13px;color:var(--apc-body);">' + sName + '</span>' +
        '<span style="font-size:11px;color:var(--apc-dim);margin-left:6px;">' + sAction + '</span>' +
        '</div></div>';
    }
    html += '</div>';
  } else if (!isPipeline) {
    var actionLabel = escapeHtml(parsed.action || 'notify');
    var targetPreview = '';
    if (parsed.target && parsed.target.text) targetPreview = escapeHtml(parsed.target.text.substring(0, 80)) + (parsed.target.text.length > 80 ? '...' : '');
    html += '<div style="background:var(--apc-bg);border-radius:8px;padding:8px 12px;margin-bottom:14px;">' +
      '<span style="font-size:12px;font-weight:600;color:rgba(168,152,120,0.9);text-transform:uppercase;">' + actionLabel + '</span>' +
      (targetPreview ? '<div style="font-size:13px;color:var(--apc-body);margin-top:4px;">' + targetPreview + '</div>' : '') +
      '</div>';
  }

  // v20.8: Check if a matching automation already exists (same name) — show "Update" instead
  var existingId = null;
  var btnLabel = isPipeline ? 'Schedule Pipeline' : 'Schedule This';
  try {
    var existingAutos = JSON.parse(localStorage.getItem('roweos_automations') || '[]');
    var pName = (parsed.name || '').trim().toLowerCase();
    if (pName) {
      for (var ei = 0; ei < existingAutos.length; ei++) {
        if ((existingAutos[ei].name || '').trim().toLowerCase() === pName) {
          existingId = existingAutos[ei].id;
          btnLabel = isPipeline ? 'Update Pipeline' : 'Update Automation';
          break;
        }
      }
    }
  } catch(e) {}
  // Store match info on proposal for createAutomationFromChat
  window._automationProposals[cardIndex].existingId = existingId;

  // Buttons
  html += '<div style="display:flex;gap:8px;">' +
    '<button onclick="createAutomationFromChat(' + cardIndex + ')" ' +
    'style="flex:1;padding:8px 14px;border-radius:8px;border:none;background:var(--brand-accent, #a89878);color:#fff;' +
    'font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">' +
    btnLabel + '</button>' +
    '<button onclick="editAutomationProposal(' + cardIndex + ')" ' +
    'style="padding:8px 14px;border-radius:8px;border:1px solid var(--apc-bg);background:transparent;color:var(--apc-sub);' +
    'font-size:13px;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">Edit in Lab</button>' +
    '</div>';

  html += '</div>';
  return html;
}

// v19.8: Render inline social post card from AI-generated JSON
function renderSocialPostCard(jsonStr, cardIndex) {
  var parsed = null;
  try {
    var cleaned = jsonStr.trim().replace(/,\s*([}\]])/g, '$1');
    parsed = JSON.parse(cleaned);
  } catch(e) {
    return '<div style="background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.3);border-radius:12px;padding:16px;margin:12px 0;">' +
      '<div style="color:#ef4444;font-weight:600;font-size:13px;">Failed to parse social post data</div>' +
      '<div style="color:#ef4444;opacity:0.7;font-size:12px;margin-top:4px;">' + escapeHtml(jsonStr.substring(0, 200)) + '</div></div>';
  }

  if (!parsed.text) {
    return '<div style="background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.3);border-radius:12px;padding:16px;margin:12px 0;">' +
      '<div style="color:#ef4444;font-weight:600;font-size:13px;">Social post missing required "text" field</div></div>';
  }

  // v19.8: Find last image in conversation if requested
  // v24.0: Also check attachedFiles for user-uploaded images
  var chatImage = null;
  if (parsed.useConversationImage !== false && typeof currentConversation !== 'undefined') {
    for (var ci = currentConversation.length - 1; ci >= 0; ci--) {
      var msg = currentConversation[ci];
      if (!msg) continue;
      if (msg.imageUrl) { chatImage = msg.imageUrl; break; }
      if (msg.attachedFiles && msg.attachedFiles.length > 0) {
        for (var fi = msg.attachedFiles.length - 1; fi >= 0; fi--) {
          var af = msg.attachedFiles[fi];
          if (af && af.type && af.type.indexOf('image') === 0 && af.content) {
            chatImage = af.content.indexOf('data:') === 0 ? af.content : 'data:' + af.type + ';base64,' + af.content;
            break;
          }
        }
        if (chatImage) break;
      }
    }
  }

  window._chatSocialProposals[cardIndex] = { data: parsed, image: chatImage, editedText: null };

  // Detect connected platforms
  var allPlatforms = ['x', 'threads', 'instagram', 'tiktok'];
  var connectedPlatforms = allPlatforms.filter(function(p) { return isSocialConnected(p); });
  var suggestedPlatforms = parsed.platforms || connectedPlatforms;
  var hasConnected = connectedPlatforms.length > 0;

  var html = '<div class="chat-social-post-card" id="socialChatCard_' + cardIndex + '" style="' +
    'background:var(--apc-bg, rgba(168,152,120,0.08));border:1px solid var(--apc-border, rgba(168,152,120,0.2));' +
    'border-radius:12px;padding:16px;margin:12px 0;">';

  // Header
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
    '<span style="font-weight:600;font-size:14px;color:var(--apc-text, #e8e0d4);">Social Post</span></div>';

  // Image preview
  if (chatImage) {
    html += '<div style="margin-bottom:12px;">' +
      '<img src="' + chatImage + '" alt="Post image" style="max-width:100%;max-height:200px;object-fit:cover;border-radius:8px;display:block;" />' +
      '</div>';
  }

  // Post text preview + edit toggle
  html += '<div id="socialChatText_' + cardIndex + '" style="margin-bottom:12px;">' +
    '<div id="socialChatPreview_' + cardIndex + '" style="white-space:pre-wrap;font-size:13px;color:var(--apc-sub, #b0a898);' +
    'line-height:1.5;background:var(--apc-stepbg, rgba(0,0,0,0.15));padding:10px 12px;border-radius:8px;">' +
    escapeHtml(parsed.text) + '</div>' +
    '<textarea id="socialChatEdit_' + cardIndex + '" style="display:none;width:100%;min-height:80px;font-size:13px;' +
    'color:var(--apc-text, #e8e0d4);background:var(--apc-stepbg, rgba(0,0,0,0.15));border:1px solid var(--apc-border, rgba(168,152,120,0.2));' +
    'border-radius:8px;padding:10px 12px;resize:vertical;font-family:inherit;line-height:1.5;" ' +
    'oninput="updateChatSocialCharCounts(' + cardIndex + ')">' + escapeHtml(parsed.text) + '</textarea>' +
    '<button onclick="toggleChatSocialEdit(' + cardIndex + ')" style="background:none;border:none;color:var(--brand-accent, #a89878);' +
    'font-size:12px;cursor:pointer;padding:4px 0;margin-top:4px;">Edit text</button></div>';

  // Platform checkboxes with char counts
  if (hasConnected) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">';
    connectedPlatforms.forEach(function(p) {
      var handle = getSocialHandle(p);
      var limit = SOCIAL_PLATFORM_LIMITS[p];
      var textLen = parsed.text.length;
      var isOver = textLen > limit;
      var isChecked = suggestedPlatforms.indexOf(p) !== -1;
      var needsImage = p === 'instagram' && !chatImage;
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--apc-sub, #b0a898);' +
        'background:var(--apc-stepbg, rgba(0,0,0,0.15));padding:6px 10px;border-radius:8px;cursor:pointer;">' +
        '<input type="checkbox" class="chat-social-plat" data-platform="' + p + '" ' + (isChecked && !needsImage ? 'checked' : '') + ' style="accent-color:var(--brand-accent, #a89878);" />' +
        '<span>' + SOCIAL_PLATFORM_NAMES[p] + (handle ? ' <span class="spc-handle">@' + escapeHtml(handle) + '</span>' : '') + '</span>' +
        '<span id="socialCharCount_' + cardIndex + '_' + p + '" style="font-size:11px;color:' + (isOver ? '#ef4444' : 'var(--apc-sub, #b0a898)') + ';">' +
        textLen + '/' + limit + '</span>' +
        (needsImage ? '<span style="font-size:11px;color:#f59e0b;" title="Instagram requires an image">No image</span>' : '') +
        '</label>';
    });
    html += '</div>';
  } else {
    html += '<div style="font-size:13px;color:var(--apc-sub, #b0a898);margin-bottom:12px;padding:10px;' +
      'background:var(--apc-stepbg, rgba(0,0,0,0.15));border-radius:8px;">' +
      'No platforms connected. <a onclick="showView(\'settings\')" style="color:var(--brand-accent, #a89878);cursor:pointer;text-decoration:underline;">Connect in Settings</a></div>';
  }

  // Buttons
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
  if (hasConnected) {
    html += '<button onclick="postFromChatCard(' + cardIndex + ')" ' +
      'id="socialChatPostBtn_' + cardIndex + '" ' +
      'style="flex:1;padding:8px 14px;border-radius:8px;border:none;background:var(--brand-accent, #a89878);color:#fff;' +
      'font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">Post Now</button>';
  }
  html += '<button onclick="openPublisherFromChat(' + cardIndex + ')" ' +
    'style="padding:8px 14px;border-radius:8px;border:1px solid var(--apc-border, rgba(168,152,120,0.2));background:transparent;color:var(--apc-sub, #b0a898);' +
    'font-size:13px;cursor:pointer;transition:opacity 0.2s;" onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">Open Publisher</button>' +
    '</div>';

  html += '</div>';
  return html;
}

function addMessageToThread(role, content) {
  var thread = document.getElementById('conversationThread');
  var div = document.createElement('div');
  div.className = 'conversation-message ' + role;
  
  // v10.7.9: Mode-aware role label
  var currentModeForLabel = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var roleLabel = role === 'user' ? 'YOU' : (currentModeForLabel === 'life' ? '◇LifeAI' : '✦BrandAI');
  var displayContent = formatMessageContent(content);
  
  div.innerHTML = '<div class="conversation-message-bubble"><div class="conversation-message-role">' + roleLabel + '</div><div class="conversation-message-content">' + displayContent + '</div></div>';
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

function runAgent() {
  // v24.20: Blob thinking state
  if (typeof setBlobState === 'function') setBlobState('thinking');
  // v22.39: Always hide stale progress bars on new message (mobile fix)
  if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
  if (typeof hideThinkingProgress === 'function') hideThinkingProgress();

  // v12.2.4: Mark chat activity to defer sync during active conversation
  if (typeof markChatActivity === 'function') markChatActivity();

  var command = document.getElementById('agentCommand').value;

  // v9.1.14: Don't clear input immediately - keep it visible until response starts
  // Input will be cleared in showConversationView() when user message is displayed
  
  // v10.5.33: Check if any files are still loading
  var loadingFiles = currentAgentFiles.filter(function(f) { return f.status === 'loading'; });
  if (loadingFiles.length > 0) {
    showToast('Please wait for ' + loadingFiles.length + ' file(s) to finish loading', 'warning');
    return;
  }
  
  var hasFiles = currentAgentFiles.length > 0 && currentAgentFiles.some(function(f) { return f.status === 'ready'; });
  
  if (!command.trim() && !hasFiles) {
    showToast('Please enter a command or attach a file', 'warning');
    return;
  }
  
  var btn = document.getElementById('agentRunBtn');
  btn.disabled = true;
  btn.classList.add('sending');
  setAgentStatus('executing');
  
  // v10.5.25: Check for LifeAI mode FIRST - don't change mode
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life' || document.documentElement.classList.contains('life-mode');
  
  var brandIdx = 0;
  var brand = null;
  
  if (!isLifeMode) {
    var agentBrandEl = document.getElementById('agentBrand');
    brandIdx = agentBrandEl ? parseInt(agentBrandEl.value) : 0;
    brand = brands[brandIdx];
  }
  
  // v10.5.33: Build message with multiple file content if present
  var messageContent;
  var displayContent = command; // For UI display
  var readyFiles = currentAgentFiles.filter(function(f) { return f.status === 'ready' && f.content; });
  
  if (readyFiles.length > 0) {
    console.log('Including ' + readyFiles.length + ' file(s) in message');
    
    // Check if any are images (for multimodal)
    var imageFiles = readyFiles.filter(function(f) { return f.type && f.type.startsWith('image/'); });
    var textFiles = readyFiles.filter(function(f) { return !f.type || !f.type.startsWith('image/'); });
    
    if (imageFiles.length > 0 && textFiles.length === 0) {
      // Only images - use multimodal format
      var contentParts = [];
      imageFiles.forEach(function(f) {
        var base64Data = f.content.split(',')[1];
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: f.type,
            data: base64Data
          }
        });
      });
      contentParts.push({
        type: 'text',
        text: command || 'Please analyze these image(s).'
      });
      messageContent = contentParts;
      displayContent = command + '\n\n[Attached ' + imageFiles.length + ' image(s): ' + imageFiles.map(function(f) { return f.name; }).join(', ') + ']';
    } else {
      // Text files (or mixed) - include content inline
      var allFileContents = getAllAgentFileContents();
      messageContent = command + '\n\n' + allFileContents;
      displayContent = command + '\n\n[Attached ' + readyFiles.length + ' file(s): ' + readyFiles.map(function(f) { return f.name; }).join(', ') + ']';
    }
    
    showToast(readyFiles.length + ' file(s) included', 'info');
  } else {
    messageContent = command;
    displayContent = command;
  }

  // v12.0.3: Build file metadata for display
  var attachedFiles = readyFiles.map(function(f) {
    return {
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.file ? f.file.size : null,
      pages: f.pages || null,
      content: f.content,  // Store content for preview
      hasContent: !!f.content
    };
  });

  // Start new conversation - store display version for UI, actual content for API
  var userMessage = { role: 'user', content: messageContent, displayContent: displayContent };
  if (attachedFiles.length > 0) {
    userMessage.attachedFiles = attachedFiles;
    userMessage.id = Date.now();  // ID for file card references
  }
  currentConversation = [userMessage];
  
  // Track which brand this conversation started with
  conversationStartBrand = brandIdx;
  
  // v11.0.5: Immediate save after starting new conversation
  // Create preliminary history entry so data isn't lost during API call
  var preliminaryEntry = {
    id: Date.now(),
    brand: brand ? brand.name : 'Unknown',
    brandIndex: brandIdx,
    mode: document.documentElement.classList.contains('life-mode') ? 'life' : 'brand',
    command: displayContent.substring(0, 200),
    conversation: JSON.parse(JSON.stringify(currentConversation)),
    time: new Date().toLocaleString(),
    preliminary: true
  };
  agentCommands.push(preliminaryEntry);
  window._currentPreliminaryIndex = agentCommands.length - 1;
  saveRuns();
  console.log('[AutoSave] Created preliminary entry for new conversation');
  
  // Clear files after including in message
  removeAgentFile();

  // v16.6: Deep Research intercept for first message (was only in sendFollowup before)
  // v22.14: Skip deep research for multimodal messages (images)
  var isMultimodalFirst = Array.isArray(messageContent);
  if (window._deepResearchActive && typeof handleDeepResearchChat === 'function' && !isMultimodalFirst) {
    var userQuery = typeof messageContent === 'string' ? messageContent : command;
    showConversationView();
    renderConversation();

    if (typeof showDeepResearchProgress === 'function') showDeepResearchProgress();

    var convThread = document.getElementById('conversationThread');
    var streamingDiv = document.createElement('div');
    streamingDiv.className = 'conversation-message assistant deep-research-message';
    streamingDiv.id = 'streamingMessage';
    streamingDiv.innerHTML = '<div class="conversation-avatar"><span class="research-icon">&#9830;</span><span class="research-label">Research</span></div><div class="conversation-message-bubble"><div class="conversation-message-content" id="streamingContent"><div style="display:flex;align-items:center;gap:8px;color:#a78bfa;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a78bfa" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Starting Deep Research...</div></div></div>';
    if (convThread) { convThread.appendChild(streamingDiv); convThread.scrollTop = convThread.scrollHeight; }
    setAgentStatus('executing');

    handleDeepResearchChat(userQuery, function(cardHtml) {
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      var streamContent = document.getElementById('streamingContent');
      if (streamContent) streamContent.innerHTML = cardHtml;
      appendStreamingMsgActions();
      currentConversation.push({ role: 'assistant', content: cardHtml });
      autoSaveConversation(true);
      if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
      var fb = document.getElementById('followupBtn');
      if (fb) fb.disabled = false;
      setAgentStatus('ready');
      resetDeepResearchUI();
    }, function(err) {
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      showToast('Deep Research error: ' + err, 'error');
      var streamingMsg = document.getElementById('streamingMessage');
      if (streamingMsg) streamingMsg.remove();
      if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
      var fb = document.getElementById('followupBtn');
      if (fb) fb.disabled = false;
      setAgentStatus('error');
      resetDeepResearchUI();
    });
    return;
  }

  executeAgentRequest(brand, messageContent, btn, 'agentRunBtn');

  // v15.38: Ensure followup button is enabled after view transition
  setTimeout(function() {
    var fb = document.getElementById('followupBtn');
    if (fb) { fb.disabled = false; fb.classList.remove('sending'); }
  }, 3000);
}

function sendFollowup() {
  // v24.20: Blob thinking state
  if (typeof setBlobState === 'function') setBlobState('thinking');
  expandChatInput(); // v15.43: Ensure chat input visible after send
  var followupInput = document.getElementById('followupCommand');
  var followup = followupInput.value;

  // v9.1.14: Clear input immediately after capturing value
  followupInput.value = '';
  // v10.5.28: Reset textarea height after clearing
  followupInput.style.height = 'auto';
  
  // v13.9: Check both legacy followup vars and modern multi-file array
  var hasFollowupFile = (currentFollowupFile && currentFollowupFileContent);
  var hasAgentFiles = (currentAgentFiles && currentAgentFiles.length > 0 && currentAgentFiles.some(function(f) { return f.status === 'ready'; }));
  var hasAnyFile = hasFollowupFile || hasAgentFiles;

  // Check if file is selected but still loading
  if (currentFollowupFile && !currentFollowupFileContent) {
    showToast('Please wait for file to finish loading', 'warning');
    return;
  }
  if (currentAgentFiles && currentAgentFiles.some(function(f) { return f.status === 'loading'; })) {
    showToast('Please wait for file to finish loading', 'warning');
    return;
  }

  if (!followup.trim() && !hasAnyFile) {
    showToast('Please enter a follow-up or attach a file', 'warning');
    return;
  }
  
  var btn = document.getElementById('followupBtn');
  btn.disabled = true;
  btn.classList.add('sending');
  setAgentStatus('executing');
  
  // v10.5.25: Check for LifeAI mode FIRST - don't change mode
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var isLifeMode = currentMode === 'life' || document.documentElement.classList.contains('life-mode');
  
  var brandIdx = 0;
  var brand = null;
  
  if (!isLifeMode) {
    var agentBrandEl = document.getElementById('agentBrand');
    brandIdx = agentBrandEl ? parseInt(agentBrandEl.value) : 0;
    brand = brands[brandIdx];
  }
  
  // Build message with file content if present
  var messageContent;
  var displayContent = followup;
  
  if (currentFollowupFileContent && currentFollowupFile) {
    if (currentFollowupFile.type.startsWith('image/')) {
      var base64Data = currentFollowupFileContent.split(',')[1];
      var mediaType = currentFollowupFile.type;
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data
          }
        },
        {
          type: 'text',
          text: followup || 'Please analyze this image.'
        }
      ];
      displayContent = followup + '\n\n[Attached Image: ' + currentFollowupFile.name + ']';
    } else {
      messageContent = followup + '\n\n--- ATTACHED FILE: ' + currentFollowupFile.name + ' ---\n' + currentFollowupFileContent + '\n--- END OF FILE ---';
      displayContent = messageContent;
    }
  } else if (hasAgentFiles) {
    // v13.9: Use multi-file system for mid-conversation attachments
    // v20.1: Handle image files with multimodal format (same as runAgent)
    var readyFilesFollowup = currentAgentFiles.filter(function(f) { return f.status === 'ready' && f.content; });
    var imageFilesFollowup = readyFilesFollowup.filter(function(f) { return f.type && f.type.startsWith('image/'); });
    var textFilesFollowup = readyFilesFollowup.filter(function(f) { return !f.type || !f.type.startsWith('image/'); });

    if (imageFilesFollowup.length > 0 && textFilesFollowup.length === 0) {
      // Only images — use multimodal format
      var contentPartsFollowup = [];
      imageFilesFollowup.forEach(function(f) {
        var base64DataFollowup = f.content.split(',')[1];
        contentPartsFollowup.push({ type: 'image', source: { type: 'base64', media_type: f.type, data: base64DataFollowup } });
      });
      contentPartsFollowup.push({ type: 'text', text: followup || 'Please analyze these image(s).' });
      messageContent = contentPartsFollowup;
      displayContent = followup + '\n\n[Attached ' + imageFilesFollowup.length + ' image(s): ' + imageFilesFollowup.map(function(f) { return f.name; }).join(', ') + ']';
    } else {
      var allContent = getAllAgentFileContents();
      if (allContent) {
        var fileNames = readyFilesFollowup.map(function(f) { return f.name; });
        messageContent = followup + '\n\n' + allContent;
        displayContent = followup + '\n\n[Attached: ' + fileNames.join(', ') + ']';
      } else {
        messageContent = followup;
        displayContent = followup;
      }
    }
  } else {
    messageContent = followup;
    displayContent = followup;
  }
  
  // Add to conversation
  // v20.1: Include attachedFiles metadata for image thumbnail rendering
  var followupMsg = { role: 'user', content: messageContent, displayContent: displayContent };
  var followupReadyFiles = currentAgentFiles.filter(function(f) { return f.status === 'ready'; });
  if (followupReadyFiles.length > 0 || (currentFollowupFile && currentFollowupFileContent)) {
    var followupAttachedFiles = followupReadyFiles.map(function(f) {
      return { id: f.id, name: f.name, type: f.type, size: f.file ? f.file.size : null, content: f.content, hasContent: !!f.content };
    });
    if (currentFollowupFile && currentFollowupFileContent && followupAttachedFiles.length === 0) {
      followupAttachedFiles.push({ id: Date.now(), name: currentFollowupFile.name, type: currentFollowupFile.type, content: currentFollowupFileContent, hasContent: true });
    }
    followupMsg.attachedFiles = followupAttachedFiles;
    followupMsg.id = Date.now();
  }
  currentConversation.push(followupMsg);
  renderConversation();

  // v11.0.5: Immediate save after user message to prevent loss
  autoSaveConversation(true);

  // Clear file after including in message
  removeFollowupFile();
  // v13.9: Also clear multi-file attachments
  if (typeof removeAgentFile === 'function') removeAgentFile();
  
  // v13.9: Deep Research intercept
  // v14.3: Show progress bar with timer
  // v22.14: Skip deep research for multimodal messages (images) - not supported
  var isMultimodalFollowup = Array.isArray(messageContent);
  // v22.39: Always hide stale progress bars on every send (not just multimodal)
  if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
  if (typeof hideThinkingProgress === 'function') hideThinkingProgress();
  if (window._deepResearchActive && typeof handleDeepResearchChat === 'function' && !isMultimodalFollowup) {
    var userQuery = typeof messageContent === 'string' ? messageContent : followup;
    showConversationView();
    renderConversation();

    if (typeof showDeepResearchProgress === 'function') showDeepResearchProgress();

    var convThread = document.getElementById('conversationThread');
    var streamingDiv = document.createElement('div');
    streamingDiv.className = 'conversation-message assistant deep-research-message';
    streamingDiv.id = 'streamingMessage';
    streamingDiv.innerHTML = '<div class="conversation-avatar"><span class="research-icon">&#9830;</span><span class="research-label">Research</span></div><div class="conversation-message-bubble"><div class="conversation-message-content" id="streamingContent"><div style="display:flex;align-items:center;gap:8px;color:#a78bfa;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a78bfa" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Starting Deep Research...</div></div></div>';
    if (convThread) { convThread.appendChild(streamingDiv); convThread.scrollTop = convThread.scrollHeight; }
    setAgentStatus('executing');

    handleDeepResearchChat(userQuery, function(cardHtml) {
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      var streamContent = document.getElementById('streamingContent');
      if (streamContent) streamContent.innerHTML = cardHtml;
      appendStreamingMsgActions();
      currentConversation.push({ role: 'assistant', content: cardHtml });
      autoSaveConversation(true);
      if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
      var fb = document.getElementById('followupBtn');
      if (fb) { fb.disabled = false; fb.classList.remove('sending'); }
      setAgentStatus('ready');
      resetDeepResearchUI();
    }, function(err) {
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      showToast('Deep Research error: ' + err, 'error');
      var streamingMsg = document.getElementById('streamingMessage');
      if (streamingMsg) streamingMsg.remove();
      if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
      var fb = document.getElementById('followupBtn');
      if (fb) { fb.disabled = false; fb.classList.remove('sending'); }
      setAgentStatus('error');
      resetDeepResearchUI();
    });
    return;
  }

  executeAgentRequest(brand, messageContent, btn, 'followupBtn');
}

// v20.6: Detect URLs in message and fetch page content for AI context
function extractUrlsFromMessage(text) {
  if (typeof text !== 'string') return [];
  var urls = [];
  // Match full URLs with protocol
  var fullUrlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  var fullMatches = text.match(fullUrlRegex);
  if (fullMatches) urls = urls.concat(fullMatches);
  // Match bare domains like domain.com/path (must have TLD + at least a path or subdomain)
  var bareRegex = /(?:^|\s)((?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|app|dev|co|ai|xyz|me|info|biz|us|uk|ca)(?:\/[^\s<>"')\]]*)?)/gi;
  var bareMatch;
  while ((bareMatch = bareRegex.exec(text)) !== null) {
    var bare = bareMatch[1];
    // Only add if not already captured with protocol
    var hasProtocol = urls.some(function(u) { return u.indexOf(bare) !== -1; });
    if (!hasProtocol) urls.push('https://' + bare);
  }
  // Deduplicate
  var seen = {};
  return urls.filter(function(url) {
    if (seen[url]) return false;
    seen[url] = true;
    return true;
  });
}

function fetchUrlContent(url) {
  // Race fetch against 6s timeout
  var timeoutPromise = new Promise(function(resolve) { setTimeout(function() { resolve(null); }, 6000); });
  var fetchPromise = fetch('/api/fetch-site-meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url, mode: 'content' })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error || !data.content) return null;
    return { url: data.url || url, title: data.title || '', content: data.content };
  }).catch(function() { return null; });
  return Promise.race([fetchPromise, timeoutPromise]);
}

// v20.6: Build messages for API with hidden URL context injected into last user message
function buildMessagesForAPI(conversation) {
  return conversation
    .filter(function(msg) { return msg.content && msg.role !== 'system'; })
    .map(function(msg) {
      var content = msg.content;
      // Inject URL context into the last user message for the API only
      if (msg.role === 'user' && msg._urlContext) {
        content = (typeof content === 'string' ? content : '') + msg._urlContext;
      }
      return { role: msg.role, content: content };
    });
}

async function enrichMessageWithUrlContent(userMessage) {
  if (typeof userMessage !== 'string') return userMessage;
  var urls = extractUrlsFromMessage(userMessage);
  if (urls.length === 0) return userMessage;
  // Limit to 3 URLs max
  urls = urls.slice(0, 3);
  if (typeof showToast === 'function') showToast('Fetching ' + urls.length + ' URL' + (urls.length > 1 ? 's' : '') + '...', 'info');
  var results = await Promise.all(urls.map(fetchUrlContent));
  var contextBlocks = [];
  results.forEach(function(r) {
    if (r && r.content && r.content.length > 50) {
      contextBlocks.push('[Web page content from ' + r.url + (r.title ? ' ("' + r.title + '")' : '') + ']\n' + r.content + '\n[End of web page content]');
    }
  });
  if (contextBlocks.length === 0) return userMessage;
  return userMessage + '\n\n---\n' + contextBlocks.join('\n\n');
}

async function executeAgentRequest(brand, userMessage, btn, btnId) {
  // v22.41: Defense-in-depth — hide stale progress bars (especially for multimodal/image sends)
  if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
  if (typeof hideThinkingProgress === 'function') hideThinkingProgress();
  // v20.6: Fetch URL content and store as hidden context (not in conversation display)
  var _urlContext = '';
  try {
    var _enriched = await enrichMessageWithUrlContent(userMessage);
    if (_enriched !== userMessage) {
      // Extract just the URL context part (after the ---\n separator)
      var _sepIdx = _enriched.indexOf('\n\n---\n');
      if (_sepIdx !== -1) _urlContext = _enriched.substring(_sepIdx);
    }
  } catch(urlErr) {
    console.warn('[URL Fetch] Error enriching message:', urlErr.message);
  }
  // Store URL context on the conversation entry for API use only (never displayed)
  if (_urlContext && currentConversation.length > 0) {
    var _lastIdx = currentConversation.length - 1;
    if (currentConversation[_lastIdx] && currentConversation[_lastIdx].role === 'user') {
      currentConversation[_lastIdx]._urlContext = _urlContext;
    }
  }


  // v29.0: Villainous Game Master — hidden /villain command intercept
  var _msgStr = typeof userMessage === 'string' ? userMessage : '';
  var _villainCmd = _msgStr.trim().toLowerCase();
  // Activate: "/villain" alone or "/villain <question>"
  // Deactivate: "/villain off"
  if (_villainCmd === '/villain off') {
    window._villainousMode = false;
    showToast('Villainous mode deactivated', 'info');
    // Remove the /villain off message from conversation
    if (currentConversation.length > 0 && currentConversation[currentConversation.length - 1].role === 'user') {
      currentConversation.pop();
    }
    if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
    var _fb = document.getElementById('followupBtn');
    if (_fb) { _fb.disabled = false; _fb.classList.remove('sending'); }
    setAgentStatus('ready');
    return;
  }
  if (_villainCmd === '/villain' || _villainCmd.indexOf('/villain ') === 0) {
    window._villainousMode = true;
    // Strip /villain prefix from message
    var _villainMsg = _msgStr.trim().substring('/villain'.length).trim();
    if (!_villainMsg) {
      _villainMsg = 'Hello! I need help with a Villainous rules question.';
      // Update the displayed user message
      if (currentConversation.length > 0 && currentConversation[currentConversation.length - 1].role === 'user') {
        currentConversation[currentConversation.length - 1].content = _villainMsg;
        currentConversation[currentConversation.length - 1].displayContent = _villainMsg;
      }
    } else {
      // Update display to hide /villain prefix
      if (currentConversation.length > 0 && currentConversation[currentConversation.length - 1].role === 'user') {
        currentConversation[currentConversation.length - 1].displayContent = _villainMsg;
      }
    }
    userMessage = _villainMsg;
    showToast('Villainous Game Master activated', 'info');
  }

  if (window._villainousMode) {
    // Build Villainous system prompt
    var _vPrompt = buildVillainousSystemPrompt();
    // Resolve provider/model (use current settings)
    var _vProvider = localStorage.getItem('selectedProvider') || 'anthropic';
    var _vModel = localStorage.getItem('selectedModel') || 'claude-sonnet-4-6';
    if (_vProvider === 'roweos') {
      try {
        var _vResolved = resolveRoweOSAI({ userMessage: userMessage, systemPrompt: _vPrompt, hasImages: false });
        _vProvider = _vResolved.provider;
        _vModel = _vResolved.model;
      } catch(e) { _vProvider = 'anthropic'; _vModel = 'claude-sonnet-4-6'; }
    }
    _vModel = getModelForTier(_vProvider, _vModel);
    var _vApiKey = await getApiKey(_vProvider);
    if (!_vApiKey) {
      showToast('Please configure an API key in System settings', 'error');
      if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
      setAgentStatus('ready');
      return;
    }

    showConversationView();
    renderConversation();

    var _vVisibleBtn = document.getElementById('followupBtn');
    if (_vVisibleBtn) { _vVisibleBtn.disabled = true; _vVisibleBtn.classList.add('sending'); }
    setAgentStatus('executing');

    var _vConvThread = document.getElementById('conversationThread');
    var _vStreamDiv = document.createElement('div');
    _vStreamDiv.className = 'conversation-message assistant villainous-response';
    _vStreamDiv.id = 'streamingMessage';
    _vStreamDiv.innerHTML = '<div class="conversation-avatar"><span class="avatar-icon" style="background:linear-gradient(135deg,#7c3aed,#4c1d95)!important;color:#fff!important;">&#9876;</span><span class="avatar-label" style="color:#a78bfa!important;">Villainous</span></div><div class="conversation-message-bubble"><div class="conversation-message-content" id="streamingContent"><span class="streaming-cursor"></span></div></div>';
    if (_vConvThread) { _vConvThread.appendChild(_vStreamDiv); _vConvThread.scrollTop = _vConvThread.scrollHeight; }

    if (typeof setBlobState === 'function') setBlobState('responding');

    var _vMessages = buildMessagesForAPI(currentConversation);

    function _vOnChunk(chunk, fullText) {
      try {
        var sc = document.getElementById('streamingContent');
        if (sc) {
          sc.innerHTML = formatMessageContent(fullText) + '<span class="streaming-cursor"></span>';
          if (_vConvThread) {
            var nearBottom = _vConvThread.scrollHeight - _vConvThread.scrollTop - _vConvThread.clientHeight < 150;
            if (nearBottom) _vConvThread.scrollTop = _vConvThread.scrollHeight;
          }
        }
      } catch(e) { console.error('[Villainous] onChunk error:', e); }
    }

    function _vOnComplete(fullText) {
      if (typeof setBlobState === 'function') setBlobState('idle');
      var sc = document.getElementById('streamingContent');
      if (sc) {
        try { sc.innerHTML = formatMessageContent(fullText); }
        catch(e) { sc.innerHTML = '<p style="color:var(--error-red,#ef4444);">Error rendering response.</p>'; }
      }
      appendStreamingMsgActions();
      var _vMsgObj = { role: 'assistant', content: fullText };
      currentConversation.push(_vMsgObj);
      if (currentConversation.length === 2) {
        var _vRecord = {
          id: Date.now(),
          brand: 'Villainous',
          mode: 'brand',
          command: currentConversation[0].displayContent || currentConversation[0].content,
          conversation: JSON.parse(JSON.stringify(currentConversation)),
          time: new Date().toLocaleString()
        };
        agentCommands.push(_vRecord);
        saveRuns();
        renderAgentHistory();
      } else {
        var _vLastCmd = agentCommands[agentCommands.length - 1];
        if (_vLastCmd) {
          _vLastCmd.conversation = JSON.parse(JSON.stringify(currentConversation));
          saveRuns();
        }
      }
      autoSaveConversation(true);
      if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
      var _vFb = document.getElementById('followupBtn');
      if (_vFb) { _vFb.disabled = false; _vFb.classList.remove('sending'); }
      setAgentStatus('ready');
    }

    function _vOnError(err) {
      if (typeof setBlobState === 'function') setBlobState('idle');
      console.error('[Villainous] Streaming error:', err);
      var sm = document.getElementById('streamingMessage');
      if (sm) sm.remove();
      showToast('Villainous error: ' + (err.message || err), 'error');
      if (btn) { btn.disabled = false; btn.classList.remove('sending'); }
      var _vFb2 = document.getElementById('followupBtn');
      if (_vFb2) { _vFb2.disabled = false; _vFb2.classList.remove('sending'); }
      setAgentStatus('error');
    }

    try {
      if (_vProvider === 'anthropic') {
        callAnthropicStreaming(_vApiKey, _vModel, _vPrompt, _vMessages, _vOnChunk, _vOnComplete, _vOnError);
      } else if (_vProvider === 'openai') {
        callOpenAIStreaming(_vApiKey, _vModel, _vPrompt, _vMessages, _vOnChunk, _vOnComplete, _vOnError);
      } else if (_vProvider === 'google') {
        callGoogleStreaming(_vApiKey, _vModel, _vPrompt, _vMessages, _vOnChunk, _vOnComplete, _vOnError);
      } else if (_vProvider === 'nanobanana') {
        var _nbKey = getNanobananaKey();
        callNanobananaStreaming(_nbKey, _vModel, _vPrompt, _vMessages, _vOnChunk, _vOnComplete, _vOnError);
      } else {
        callAnthropicStreaming(_vApiKey, _vModel, _vPrompt, _vMessages, _vOnChunk, _vOnComplete, _vOnError);
      }
    } catch(apiErr) { _vOnError(apiErr); }
    return;
  }

  var prompt = '';

  // v10.5.25: Check for LifeAI mode FIRST
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  if (currentMode === 'life') {
    // Use LifeAI system prompt
    prompt = buildLifeAISystemPrompt();
    console.log('[LifeAI] Using LifeAI system prompt');
    
    // v15.18: Read LifeAI-specific provider and model (not hardcoded)
    var provider = localStorage.getItem('roweos_life_provider')
      || localStorage.getItem('selectedProvider') || 'anthropic';
    var model = localStorage.getItem('roweos_life_model') || 'claude-sonnet-4-6';

    // v30.1: Session override (Nanobanana image chat) takes precedence
    if (window._chatModelOverride && window._chatModelOverride.provider) {
      provider = window._chatModelOverride.provider;
      model = window._chatModelOverride.model;
    }

    // v20.5: RoweOS AI — resolve to actual provider/model
    if (provider === 'roweos') {
      try {
        var _hasImg = false;
        try { _hasImg = currentConversation.some(function(m) { return Array.isArray(m.content); }); } catch(e) {}
        var _resolved = resolveRoweOSAI({ userMessage: userMessage, systemPrompt: prompt, hasImages: _hasImg });
        provider = _resolved.provider;
        model = _resolved.model;
      } catch(routeErr) {
        console.warn('[RoweOS AI] Route error, falling back:', routeErr);
        provider = 'anthropic'; model = 'claude-sonnet-4-6';
      }
    }

    // v23.5: Apply model tier filtering
    model = getModelForTier(provider, model);

    // v15.18: Use correct API key source per provider
    var apiKey;
    if (provider === 'nanobanana') {
      apiKey = getNanobananaKey();
    } else {
      apiKey = await getApiKey(provider);
    }

    if (!apiKey) {
      showToast('Please configure an API key in Settings', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    // Switch to conversation view
    showConversationView();
    renderConversation();
    
    // Apply sending animation
    var visibleBtn = document.getElementById('followupBtn');
    if (visibleBtn) {
      visibleBtn.disabled = true;
      visibleBtn.classList.add('sending');
    }
    setAgentStatus('executing');
    
    // Create streaming message bubble for LifeAI
    var convThread = document.getElementById('conversationThread');
    var streamingDiv = document.createElement('div');
    streamingDiv.className = 'conversation-message assistant life-ai-response';
    streamingDiv.id = 'streamingMessage';
    
    var userName = localStorage.getItem('roweos_user_name') || 'You';
    streamingDiv.innerHTML = '<div class="conversation-avatar life-ai-avatar"><span class="avatar-icon">◇</span><span class="avatar-label">LifeAI</span></div><div class="conversation-message-bubble"><div class="conversation-message-content" id="streamingContent"><span class="streaming-cursor"></span></div></div>';
    if (convThread) {
      convThread.appendChild(streamingDiv);
      convThread.scrollTop = convThread.scrollHeight;
    }
    
    var messages = buildMessagesForAPI(currentConversation);
    
    // Streaming callbacks for LifeAI
    // v20.18: Wrapped in try/catch to prevent silent failures
    function onChunk(chunk, fullText) {
      try {
        var streamContent = document.getElementById('streamingContent');
        if (streamContent) {
          streamContent.innerHTML = formatMessageContent(fullText) + '<span class="streaming-cursor"></span>';
          // v16.4: Smart scroll — only auto-scroll if user is near bottom
          if (convThread) {
            var isNearBottom = convThread.scrollHeight - convThread.scrollTop - convThread.clientHeight < 150;
            if (isNearBottom) convThread.scrollTop = convThread.scrollHeight;
          }
        }
      } catch(chunkErr) {
        console.error('[LifeAI] onChunk error:', chunkErr);
      }
    }

    function onComplete(fullText) {
      var streamContent = document.getElementById('streamingContent');
      if (streamContent) {
        try {
          streamContent.innerHTML = formatMessageContent(fullText);
        } catch(fmtErr) {
          console.error('[LifeAI] formatMessageContent error:', fmtErr);
          streamContent.innerHTML = '<p style="color:var(--error-red, #ef4444);">Error rendering response.</p>';
        }

        // v12.2.4: Check for attached files and offer save to identity
        if (typeof checkForSaveToIdentity === 'function') {
          checkForSaveToIdentity(streamContent, fullText, 'life');
        }
        // v28.4: Check for pulse_goal blocks in response
        if (typeof checkForPulseGoalInResponse === 'function') {
          checkForPulseGoalInResponse(streamContent, fullText);
        }
      }
      // v16.10: Append export actions (Copy/Word/Excel/Slides/PDF)
      appendStreamingMsgActions();

      // v15.22: Capture image URL for multi-turn persistence
      var msgObj = { role: 'assistant', content: fullText };
      if (window._lastChatImageUrl) {
        msgObj.imageUrl = window._lastChatImageUrl;
        window._lastChatImageUrl = null;
      }
      currentConversation.push(msgObj);

      // v10.5.25: Save to agentCommands for History view
      // v11.0.5: Update preliminary entry instead of creating new one
      console.log('[LifeAI] onComplete - currentConversation.length:', currentConversation.length);
      if (currentConversation.length === 2) {
        var lifeProfile = typeof getCurrentLifeProfile === 'function' ? getCurrentLifeProfile() : null;
        console.log('[LifeAI] Saving to history, profile:', lifeProfile ? lifeProfile.name : 'none');
        
        // Check for preliminary entry to update
        var existingIdx = window._currentPreliminaryIndex;
        if (existingIdx !== null && existingIdx !== undefined && agentCommands[existingIdx] && agentCommands[existingIdx].preliminary) {
          // Update existing preliminary entry
          agentCommands[existingIdx].brand = lifeProfile ? lifeProfile.name : 'LifeAI';
          agentCommands[existingIdx].mode = 'life';
          agentCommands[existingIdx].lifeName = lifeProfile ? lifeProfile.name : null;
          agentCommands[existingIdx].command = currentConversation[0].displayContent || currentConversation[0].content;
          agentCommands[existingIdx].conversation = JSON.parse(JSON.stringify(currentConversation));
          agentCommands[existingIdx].time = new Date().toLocaleString();
          delete agentCommands[existingIdx].preliminary;
          console.log('[LifeAI] Updated preliminary entry at index', existingIdx);
          
          saveRuns();
          renderAgentHistory();
          
          if (typeof syncToFirebase === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
            syncToFirebase();
          }
          
          if (typeof generateConversationTitle === 'function' && lifeProfile) {
            generateConversationTitle(currentConversation, { name: lifeProfile.name }, agentCommands[existingIdx].id);
          }
        } else {
          // Create new entry (fallback)
          var commandRecord = {
            id: Date.now(),
            brand: lifeProfile ? lifeProfile.name : 'LifeAI',
            mode: 'life',
            lifeName: lifeProfile ? lifeProfile.name : null,
            command: currentConversation[0].displayContent || currentConversation[0].content,
            conversation: JSON.parse(JSON.stringify(currentConversation)),
            time: new Date().toLocaleString()
          };
          agentCommands.push(commandRecord);
          console.log('[LifeAI] agentCommands now has', agentCommands.length, 'items');
          saveRuns();
          renderAgentHistory();
          
          if (typeof syncToFirebase === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
            syncToFirebase();
          }
          
          if (typeof generateConversationTitle === 'function' && lifeProfile) {
            generateConversationTitle(currentConversation, { name: lifeProfile.name }, commandRecord.id);
          }
        }
      } else {
        // v10.5.25: Update the CORRECT conversation entry - use tracked index if continuing from history
        var targetCmd = null;
        if (window._continuedHistoryIndex !== null && window._continuedHistoryIndex !== undefined && agentCommands[window._continuedHistoryIndex]) {
          targetCmd = agentCommands[window._continuedHistoryIndex];
        } else {
          targetCmd = agentCommands[agentCommands.length - 1];
        }
        if (targetCmd) {
          targetCmd.conversation = JSON.parse(JSON.stringify(currentConversation));
          saveRuns();
          // v10.5.25: Sync followup messages to Firebase too
          if (typeof syncToFirebase === 'function' && typeof firebaseUser !== 'undefined' && firebaseUser) {
            syncToFirebase();
          }
        }
      }
      
      // Also save to LifeAI profile history
      saveLifeAIConversation();
      
      // v10.6: Detect checklist content and show import button
      if (typeof detectChecklistInResponse === 'function' && detectChecklistInResponse(fullText)) {
        var streamContent = document.getElementById('streamingContent');
        if (streamContent) {
          var items = extractChecklistItems(fullText);
          var title = extractChecklistTitle(fullText);
          var rawText = fullText; // v11.0.5: Store raw text for section parsing
          
          if (items.length >= 2) {
            var importBtn = document.createElement('button');
            importBtn.className = 'chat-checklist-import-btn';
            importBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> Add to Pulse';
            // v15.22: Show multi-select overlay instead of importing all
            importBtn.onclick = function() {
              showPulseImportSelector(items, title, 'lifeai', rawText);
            };

            streamContent.appendChild(importBtn);
          }
        }
      }

      // v11.0.5: Detect personal facts in user's last message and offer to save to Identity
      if (typeof detectPersonalFacts === 'function') {
        var lastUserMsg = currentConversation.filter(function(m) { return m.role === 'user'; }).pop();
        if (lastUserMsg) {
          var msgContent = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : 
                          (lastUserMsg.displayContent || '');
          var facts = detectPersonalFacts(msgContent);
          if (facts.length > 0) {
            var streamContent = document.getElementById('streamingContent');
            if (streamContent) {
              showSaveToIdentityPrompt(facts, streamContent);
            }
          }
        }
      }
      
      // v16.4: Clear abort controller and restore button
      _streamAbortController = null;
      restoreSendButton('followupBtn');
      // v22.39: Safety — always hide progress bars on completion
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      if (typeof hideThinkingProgress === 'function') hideThinkingProgress();
      setAgentStatus('ready');

    }

    function onError(error) {
      console.error('[LifeAI] Error:', error);
      var errorMsg = typeof error === 'string' ? error : (error.message || 'Unknown error');
      showToast('Error: ' + errorMsg, 'error');
      _streamAbortController = null;
      restoreSendButton('followupBtn');
      // v22.39: Safety — always hide progress bars on error
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      if (typeof hideThinkingProgress === 'function') hideThinkingProgress();
      setAgentStatus('error');
    }

    // v15.45: Inject current date so AI knows the real date
    prompt = 'Today\'s date is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.\n\n' + prompt;

    // v11.0.5: Add chat length instruction to prompt
    var lengthInstruction = getChatLengthInstruction();
    if (lengthInstruction) {
      prompt = prompt + '\n\n' + lengthInstruction;
    }
    // v24.25: Add inline visual capability
    prompt += VISUAL_CAPABILITY_HINT;

    // v16.4: Set up abort controller and stop button
    _streamAbortController = new AbortController();
    setSendButtonStopping('followupBtn');
    var _lifeSignal = _streamAbortController.signal;

    // Make API call with streaming - use provider-specific functions
    if (provider === 'anthropic') {
      callAnthropicStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _lifeSignal);
    } else if (provider === 'openai') {
      callOpenAIStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _lifeSignal);
    } else if (provider === 'google') {
      callGoogleStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _lifeSignal);
    } else if (provider === 'nanobanana') {
      // v13.9: Nanobanana chat — detect image requests and route accordingly
      var lastUserMsg = messages.length > 0 ? (typeof messages[messages.length - 1].content === 'string' ? messages[messages.length - 1].content : '') : '';
      if (isNanobananaImageRequest(model, lastUserMsg)) {
        handleNanobananaChatImage(model, lastUserMsg, onChunk, onComplete, onError);
      } else {
        callNanobananaStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _lifeSignal);
      }
    }
    return;
  }

  // v8.0: Check for "No BrandAI" mode - use standard chat without brand system prompt
  var agentBrandValue = document.getElementById('agentBrand').value;
  if (agentBrandValue === 'none') {
    prompt = 'You are a helpful, intelligent assistant. Respond naturally and helpfully to the user\'s request. Be concise, accurate, and conversational.';
    
    // Skip all brand-specific prompt building - use getApiKey() properly
    var provider = 'anthropic';
    var model = 'claude-sonnet-4-6';
    
    // Get first available brand's settings for provider/model preference
    var settings = brandSettings[0] || {};
    provider = settings.provider || 'anthropic';
    model = settings.model || 'claude-sonnet-4-6';

    // v20.5: RoweOS AI — resolve to actual provider/model
    if (provider === 'roweos') {
      try {
        var _resolved = resolveRoweOSAI({ userMessage: userMessage, systemPrompt: prompt });
        provider = _resolved.provider;
        model = _resolved.model;
      } catch(routeErr) {
        console.warn('[RoweOS AI] Route error, falling back:', routeErr);
        provider = 'anthropic'; model = 'claude-sonnet-4-6';
      }
    }

    // v23.5: Apply model tier filtering
    model = getModelForTier(provider, model);

    // v8.0: Retrieve API key using the proper async function
    var apiKey = await getApiKey(provider);

    if (!apiKey) {
      showToast('Please configure an API key in System settings', 'error');
      if (btn) btn.disabled = false;
      return;
    }
    
    // v8.0: Switch to conversation view BEFORE streaming
    showConversationView();
    renderConversation();
    
    // v8.0: Apply sending animation to the VISIBLE send button (followupBtn in conversation view)
    var visibleBtn = document.getElementById('followupBtn');
    if (visibleBtn) {
      visibleBtn.disabled = true;
      visibleBtn.classList.add('sending');
    }
    setAgentStatus('executing');
    
    // v8.0: Create streaming message bubble immediately
    var convThread = document.getElementById('conversationThread');
    var streamingDiv = document.createElement('div');
    streamingDiv.className = 'conversation-message assistant standard-ai-response';
    streamingDiv.id = 'streamingMessage';
    streamingDiv.innerHTML = '<div class="conversation-avatar standard-ai-avatar"><span class="avatar-icon">◇</span><span class="avatar-label">StandardAI</span></div><div class="conversation-message-bubble"><div class="conversation-message-content" id="streamingContent"><span class="streaming-cursor"></span></div></div>';
    if (convThread) {
      convThread.appendChild(streamingDiv);
      convThread.scrollTop = convThread.scrollHeight;
    }

    var messages = buildMessagesForAPI(currentConversation);

    // v8.0: Streaming callbacks
    // v20.18: Wrapped in try/catch to prevent silent failures
    function onChunk(chunk, fullText) {
      try {
        var streamContent = document.getElementById('streamingContent');
        if (streamContent) {
          streamContent.innerHTML = formatMessageContent(fullText) + '<span class="streaming-cursor"></span>';
          // v16.4: Smart scroll — only auto-scroll if user is near bottom
          if (convThread) {
            var isNearBottom = convThread.scrollHeight - convThread.scrollTop - convThread.clientHeight < 150;
            if (isNearBottom) convThread.scrollTop = convThread.scrollHeight;
          }
        }
      } catch(chunkErr) {
        console.error('[StandardAI] onChunk error:', chunkErr);
      }
    }

    function onComplete(fullText) {
      // Remove streaming cursor
      var streamContent = document.getElementById('streamingContent');
      if (streamContent) {
        try {
          streamContent.innerHTML = formatMessageContent(fullText);
        } catch(fmtErr) {
          console.error('[StandardAI] formatMessageContent error:', fmtErr);
          streamContent.innerHTML = '<p style="color:var(--error-red, #ef4444);">Error rendering response.</p>';
        }
      }
      if (!fullText || !fullText.trim()) {
        console.warn('[StandardAI] onComplete received empty response. Provider:', provider, 'Model:', model);
      }
      // v28.4: Check for pulse_goal blocks in response
      if (streamContent && typeof checkForPulseGoalInResponse === 'function') {
        checkForPulseGoalInResponse(streamContent, fullText);
      }
      // v16.10: Append export actions (Copy/Word/Excel/Slides/PDF)
      appendStreamingMsgActions();

      // v15.22: Capture image URL for multi-turn persistence
      var msgObj = { role: 'assistant', content: fullText };
      if (window._lastChatImageUrl) {
        msgObj.imageUrl = window._lastChatImageUrl;
        window._lastChatImageUrl = null;
      }
      currentConversation.push(msgObj);

      // v10.5.25: Save to agentCommands for History view
      if (currentConversation.length === 2) {
        var commandRecord = {
          id: Date.now(),
          brand: 'StandardAI',
          mode: 'brand',
          command: currentConversation[0].displayContent || currentConversation[0].content,
          conversation: JSON.parse(JSON.stringify(currentConversation)),
          time: new Date().toLocaleString()
        };
        agentCommands.push(commandRecord);
        saveRuns();
        renderAgentHistory();
      } else {
        // v10.5.25: Update the CORRECT conversation entry
        var targetCmd = null;
        if (window._continuedHistoryIndex !== null && window._continuedHistoryIndex !== undefined && agentCommands[window._continuedHistoryIndex]) {
          targetCmd = agentCommands[window._continuedHistoryIndex];
        } else {
          targetCmd = agentCommands[agentCommands.length - 1];
        }
        if (targetCmd) {
          targetCmd.conversation = JSON.parse(JSON.stringify(currentConversation));
          saveRuns();
        }
      }
      
      // v16.4: Clear abort controller and restore button
      _streamAbortController = null;
      restoreSendButton('followupBtn');
      // v22.39: Safety — always hide progress bars on completion
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      if (typeof hideThinkingProgress === 'function') hideThinkingProgress();
      setAgentStatus('ready');

      // v10.6: Detect checklist content and show import button
      if (typeof detectChecklistInResponse === 'function' && detectChecklistInResponse(fullText)) {
        var streamContent = document.getElementById('streamingContent');
        if (streamContent) {
          var items = extractChecklistItems(fullText);
          var title = extractChecklistTitle(fullText);
          var rawText = fullText; // v11.0.5: Store raw text for section parsing

          if (items.length >= 2) {
            var importBtn = document.createElement('button');
            importBtn.className = 'chat-checklist-import-btn';
            importBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> Add to Pulse';
            // v15.22: Show multi-select overlay instead of importing all
            importBtn.onclick = function() {
              showPulseImportSelector(items, title, 'brandai', rawText);
            };

            streamContent.appendChild(importBtn);
          }
        }
      }

    }

    function onError(error) {
      var streamingMsg = document.getElementById('streamingMessage');
      if (streamingMsg) streamingMsg.remove();
      showToast('Error: ' + error, 'error');
      _streamAbortController = null;
      restoreSendButton('followupBtn');
      // v22.39: Safety — always hide progress bars on error
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      if (typeof hideThinkingProgress === 'function') hideThinkingProgress();
      setAgentStatus('ready');
    }

    // v15.45: Inject current date so AI knows the real date
    prompt = 'Today\'s date is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.\n\n' + prompt;

    // v11.0.5: Add chat length instruction to prompt
    var lengthInstruction = getChatLengthInstruction();
    if (lengthInstruction) {
      prompt = prompt + '\n\n' + lengthInstruction;
    }
    // v24.25: Add inline visual capability
    prompt += VISUAL_CAPABILITY_HINT;

    // v16.4: Set up abort controller and stop button
    _streamAbortController = new AbortController();
    setSendButtonStopping('followupBtn');
    var _stdSignal = _streamAbortController.signal;

    // v8.0: Use streaming API calls
    if (provider === 'anthropic') {
      callAnthropicStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _stdSignal);
    } else if (provider === 'openai') {
      callOpenAIStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _stdSignal);
    } else if (provider === 'google') {
      callGoogleStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _stdSignal);
    } else if (provider === 'nanobanana') {
      // v13.9: Nanobanana chat — detect image requests and route accordingly
      var lastUserMsg = messages.length > 0 ? (typeof messages[messages.length - 1].content === 'string' ? messages[messages.length - 1].content : '') : '';
      if (isNanobananaImageRequest(model, lastUserMsg)) {
        handleNanobananaChatImage(model, lastUserMsg, onChunk, onComplete, onError);
      } else {
        callNanobananaStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _stdSignal);
      }
    }
    return;
  }

  if (brandAIActive) {
    // v13.9: Null-safe brand fallback — prevents "invalid brand" errors
    if (!brand && brands.length > 0) {
      brand = brands[0];
      console.log('[BrandAI] Brand was null, falling back to first brand:', brand.name);
    }
    if (!brand) {
      showToast('No brands configured. Please add a brand in Identity.', 'error');
      if (btn) btn.disabled = false;
      return;
    }
    // Check for custom BrandAI prompt first
    var customPrompts = JSON.parse(localStorage.getItem('roweos_brandai_main_prompts') || '{}');
    var brandIdx = brands.indexOf(brand);

    console.log('[BrandAI] Brand index:', brandIdx, 'Brand:', brand.name);
    console.log('[BrandAI] Brand data keys:', Object.keys(brand));
    console.log('[BrandAI] Custom prompts available:', Object.keys(customPrompts));
    
    if (customPrompts[brandIdx]) {
      // Use custom prompt
      prompt = customPrompts[brandIdx];
      // v15.14: Still inject Identity knowledge into custom prompts
      if (typeof getBrandIdentityIntelligence === 'function') {
        var customIdentityKnowledge = getBrandIdentityIntelligence(brand);
        if (customIdentityKnowledge) prompt += customIdentityKnowledge;
      }
      console.log('[BrandAI] Using CUSTOM prompt (length:', prompt.length, 'chars)');
    } else {
      // Generate default BrandAI prompt with robust field handling
      prompt = 'You are the dedicated AI operator for ' + brand.name + '. You ARE this brand - respond as an on-brand concierge who deeply understands and embodies this specific brand\'s identity, voice, and values.\n\n';
      prompt += 'PRIME DIRECTIVE:\n';
      prompt += '- ALWAYS respond in the voice and context of ' + brand.name + ' - never generic responses.\n';
      prompt += '- Use the brand context below to inform EVERY response.\n';
      prompt += '- Protect the brand. No hype, no desperation, no sales-y voice. Quiet competence.\n';
      prompt += '- Be operational. Provide clear next steps, templates, options.\n';
      prompt += '- Be consistent. Every response from the same premium, thoughtful brand system.\n\n';
      
      prompt += 'CAPABILITIES:\n';
      prompt += '- You have access to web search via the web_search tool. Use it when you need:\n';
      prompt += '  * Current information beyond your knowledge cutoff\n';
      prompt += '  * Real-time data (pricing, trends, competitors, news)\n';
      prompt += '  * Research on specific topics\n';
      prompt += '  * Verification of facts\n';
      prompt += '- Search proactively when the request requires current information\n';
      prompt += '- After searching, synthesize findings with brand context\n\n';

      // v19.7: Automation creation capability
      prompt += buildAutomationCapabilityPrompt();

      prompt += '===== YOU ARE: ' + brand.name + ' =====\n\n';
      
      // Core brand identity - check multiple possible field names
      if (brand.tagline) prompt += 'TAGLINE: ' + brand.tagline + '\n\n';
      if (brand.essence) prompt += 'ESSENCE: ' + brand.essence + '\n\n';
      if (brand.philosophy) prompt += 'PHILOSOPHY: ' + brand.philosophy + '\n\n';
      if (brand.coreBelief) prompt += 'CORE BELIEF: ' + brand.coreBelief + '\n\n';
      if (brand.mission) prompt += 'MISSION: ' + brand.mission + '\n\n';
      if (brand.ethos) prompt += 'ETHOS: ' + brand.ethos + '\n\n';
      if (brand.vision) prompt += 'VISION: ' + brand.vision + '\n\n';
      
      // Industry and positioning
      if (brand.industry) prompt += 'INDUSTRY: ' + brand.industry + '\n';
      if (brand.positioning || brand.products) prompt += 'PRODUCTS/POSITIONING: ' + (brand.products || brand.positioning) + '\n';
      if (brand.audience) prompt += 'TARGET AUDIENCE: ' + brand.audience + '\n';
      if (brand.promise) prompt += 'BRAND PROMISE: ' + brand.promise + '\n';
      if (brand.cta) prompt += 'PRIMARY CTA: ' + brand.cta + '\n';
      prompt += '\n';
      
      // Voice and communication
      if (brand.voice) prompt += 'VOICE: ' + brand.voice + '\n';
      if (brand.tone) prompt += 'TONE: ' + brand.tone + '\n';
      if (brand.approach) prompt += 'APPROACH: ' + brand.approach + '\n';
      prompt += '\n';
      
      // Vocabulary guidance
      if (brand.vocabDo) prompt += 'VOCABULARY DO: ' + brand.vocabDo + '\n';
      if (brand.vocabDont) prompt += 'VOCABULARY DON\'T: ' + brand.vocabDont + '\n';
      if (brand.constraints) prompt += 'CONSTRAINTS: ' + brand.constraints + '\n';
      prompt += '\n';
      
      // Values (array or string)
      if (brand.values) {
        if (Array.isArray(brand.values)) {
          prompt += 'VALUES: ' + brand.values.join(', ') + '\n\n';
        } else {
          prompt += 'VALUES: ' + brand.values + '\n\n';
        }
      }
      
      // Additional context fields
      if (brand.trainingApproach) prompt += 'TRAINING APPROACH: ' + brand.trainingApproach + '\n';
      if (brand.programs) prompt += 'PROGRAMS: ' + brand.programs + '\n';
      if (brand.adaEssentials) prompt += 'ADA ESSENTIALS: ' + brand.adaEssentials + '\n';
      if (brand.experience) prompt += 'EXPERIENCE: ' + brand.experience + '\n';
      if (brand.properties) prompt += 'PROPERTIES: ' + brand.properties + '\n';
      if (brand.services) prompt += 'SERVICES: ' + brand.services + '\n';
      if (brand.pricing) prompt += 'PRICING: ' + brand.pricing + '\n';
      if (brand.partnerships) prompt += 'PARTNERSHIPS: ' + brand.partnerships + '\n';
      if (brand.deliverables) prompt += 'DELIVERABLES: ' + brand.deliverables + '\n';
      if (brand.location) prompt += 'LOCATION: ' + brand.location + '\n';
      if (brand.contacts) prompt += 'CONTACTS: ' + brand.contacts + '\n';
      
      // Visual identity
      if (brand.visual) {
        if (brand.visual.colors && brand.visual.colors.length > 0) {
          prompt += 'BRAND COLORS: ' + brand.visual.colors.join(', ') + '\n';
        }
        if (brand.visual.fonts && brand.visual.fonts.length > 0) {
          prompt += 'BRAND FONTS: ' + brand.visual.fonts.join(', ') + '\n';
        }
      }
      
      prompt += '\n';
      console.log('[BrandAI] Using DEFAULT prompt (length:', prompt.length, 'chars)');
    // v9.1.14: Add comprehensive context from Library, Focus, Rhythm, To-dos
    var brandIdxForContext = brands.indexOf(brand);
    if (typeof buildBrandContext === 'function') {
      var extraContext = buildBrandContext(brandIdxForContext, brand);
      if (extraContext) prompt += extraContext;
    }

    // v15.14: BRAND IDENTITY INTELLIGENCE — inject learned knowledge from Identity
    if (typeof getBrandIdentityIntelligence === 'function') {
      var identityKnowledge = getBrandIdentityIntelligence(brand);
      if (identityKnowledge) prompt += identityKnowledge;
    }

    // v16.11: CLIENT ROSTER — inject active clients context for this brand
    if (typeof getActiveClientsContext === 'function') {
      var clientRoster = getActiveClientsContext(brandIdxForContext);
      if (clientRoster) prompt += clientRoster;
    }
    // v22.33: CLIENT PROFILE — scan user message for client name mentions (uses actual message, not DOM)
    if (typeof getClientIdentityContext === 'function' && typeof getClients === 'function') {
      try {
        var userMsg = typeof userMessage === 'string' ? userMessage.toLowerCase() : '';
        if (!userMsg && currentConversation.length > 0) {
          var lastUserEntry = currentConversation[currentConversation.length - 1];
          if (lastUserEntry && lastUserEntry.role === 'user') {
            userMsg = (lastUserEntry.displayContent || (typeof lastUserEntry.content === 'string' ? lastUserEntry.content : '')).toLowerCase();
          }
        }
        if (userMsg) {
          // v25.3: Scan all people types (clients, team, reports) for name mentions
          var allClients = getClients().filter(function(cc) { return cc.brandIndex === brandIdxForContext && cc.stage !== 'archived'; });
          var allTeam = typeof getPeople === 'function' ? getPeople('team').filter(function(p) { return p.brandIndex === brandIdxForContext; }) : [];
          var allReports = typeof getPeople === 'function' ? getPeople('report').filter(function(p) { return p.brandIndex === brandIdxForContext; }) : [];
          var matchedClients = [];
          allClients.forEach(function(cc) {
            if (cc.name && userMsg.indexOf(cc.name.toLowerCase()) !== -1) {
              prompt += getClientIdentityContext(cc.name, brandIdxForContext);
              matchedClients.push(cc);
            }
          });
          // v25.3: Check team members and direct reports for name mentions
          allTeam.concat(allReports).forEach(function(pp) {
            if (pp.name && userMsg.indexOf(pp.name.toLowerCase()) !== -1) {
              prompt += getClientIdentityContext(pp.name, brandIdxForContext);
              matchedClients.push(pp);
            }
          });
          // v22.33: If client mentioned with email intent, add email composition instructions
          if (matchedClients.length > 0 && /\b(email|write|send|draft|compose|message|reach out|contact)\b/i.test(userMsg)) {
            prompt += '\n===== EMAIL COMPOSITION CONTEXT =====\n';
            prompt += 'The user wants to compose an email to a client. Use the client profile above to:\n';
            prompt += '- Address the recipient by name\n';
            prompt += '- Reference their company/role/industry if relevant\n';
            prompt += '- Match the brand voice and tone\n';
            prompt += '- If the client has an email address on file, mention it so the user knows where to send\n';
            prompt += '- Provide the full email draft (subject line + body) ready to send\n';
            prompt += '- Keep the tone professional and on-brand\n';
          }
        }
      } catch(e) {}
    }
    }
  } else {
    // StandardAI mode - minimal context
    prompt = 'You are a helpful AI assistant. Respond clearly and concisely.\n\n';
  }
  
  // v20.6: Build conversation messages for API (with hidden URL context)
  var messages = buildMessagesForAPI(currentConversation);
  
  // Check if we have API access
  if (!apiConnected && !isDesktopApp) {
    // Browser mode without API - simulate response
    setTimeout(function() {
      var simulatedResponse = '## Agent Response\n\n';
      simulatedResponse += 'I\'m currently running without **API access**.\n\n';
      simulatedResponse += 'To enable full AI capabilities:\n\n';
      simulatedResponse += '- Open the **sidebar menu** and go to **System**\n';
      simulatedResponse += '- Under **AI Provider**, enter your API key (Anthropic, OpenAI, or Google)\n';
      simulatedResponse += '- API keys are stored locally on this device and are not synced between devices for security\n\n';
      simulatedResponse += '### What I can help with once connected:\n\n';
      simulatedResponse += '- Brand strategy and positioning questions\n';
      simulatedResponse += '- Content generation for all your brands\n';
      simulatedResponse += '- Marketing recommendations\n';
      simulatedResponse += '- Operational guidance\n\n';
      simulatedResponse += '*For now, you can explore the Studio, Calendar, and other features.*';
      
      currentConversation.push({ role: 'assistant', content: simulatedResponse });
      showConversationView();
      renderConversation();
      
      // Scroll to show the latest message
      setTimeout(function() {
        var conversationThread = document.getElementById('conversationThread');
        if (conversationThread) {
          conversationThread.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 100);
      
      // v15.38: Re-enable both send buttons
      ['agentRunBtn', 'followupBtn'].forEach(function(id) {
        var b = document.getElementById(id);
        if (b) { b.disabled = false; b.classList.remove('sending'); }
      });
      setAgentStatus('ready');
    }, 1000);
    return;
  }
  
  // Use IPC handler for API call
  var brandIdx = brands.indexOf(brand);
  var settings = brandSettings[brandIdx] || {};
  var provider = settings.provider || brand.provider || 'anthropic';
  var model = settings.model || brand.model || (provider === 'anthropic' ? 'claude-sonnet-4-6' : (provider === 'openai' ? 'gpt-5.4' : 'gemini-3.1-pro-preview'));

  // v30.1: Session override (Nanobanana image chat) takes precedence over persisted brandSettings
  if (window._chatModelOverride && window._chatModelOverride.provider) {
    provider = window._chatModelOverride.provider;
    model = window._chatModelOverride.model;
  }

  // v20.5: RoweOS AI — resolve to actual provider/model before dispatch
  if (provider === 'roweos') {
    try {
      var _hasImg = false;
      try { _hasImg = currentConversation.some(function(m) { return Array.isArray(m.content); }); } catch(e) {}
      var _resolved = resolveRoweOSAI({ userMessage: userMessage, systemPrompt: prompt, hasImages: _hasImg, agentCategory: (brand.agents && brand.agents[0]) || '' });
      provider = _resolved.provider;
      model = _resolved.model;
    } catch(routeErr) {
      console.warn('[RoweOS AI] Route error, falling back:', routeErr);
      provider = 'anthropic'; model = 'claude-sonnet-4-6';
    }
  }

  // v23.5: Apply model tier filtering
  model = getModelForTier(provider, model);

  var apiKey = await getApiKey(provider);

  if (!apiKey) {
    showToast('API key not configured. Please add your API key in Settings.', 'error');
    // v15.38: Re-enable both send buttons
    ['agentRunBtn', 'followupBtn'].forEach(function(id) {
      var b = document.getElementById(id);
      if (b) { b.disabled = false; b.classList.remove('sending'); }
    });
    setAgentStatus('ready');
    return;
  }


  // Check if Electron API is available, otherwise use web fallback
  var useWebFallback = !window.roweosAPI || !window.roweosAPI.agentChatStream;

  if (useWebFallback) {
    console.log('[Chat v8.0] Using STREAMING web-based API for provider:', provider);

    console.log('[BrandAI] Using model:', model, 'from settings:', !!settings.model);
    
    // v8.0: Switch to conversation view IMMEDIATELY (like StandardAI)
    showConversationView();
    renderConversation();
    
    // v8.0: Apply sending animation to the VISIBLE send button
    var visibleBtn = document.getElementById('followupBtn');
    if (visibleBtn) {
      visibleBtn.disabled = true;
      visibleBtn.classList.add('sending');
    }
    
    // v8.0: Create streaming message bubble immediately
    var convThread = document.getElementById('conversationThread');
    var streamingDiv = document.createElement('div');
    streamingDiv.className = 'conversation-message assistant';
    streamingDiv.id = 'streamingMessage';
    streamingDiv.innerHTML = '<div class="conversation-avatar"><span class="avatar-icon">◆</span><span class="avatar-label">BrandAI</span></div><div class="conversation-message-bubble"><div class="conversation-message-content" id="streamingContent"><span class="streaming-cursor"></span></div></div>';
    if (convThread) {
      convThread.appendChild(streamingDiv);
      convThread.scrollTop = convThread.scrollHeight;
    }

    // v24.20: Blob responding state
    if (typeof setBlobState === 'function') setBlobState('responding');
    // v8.0: Streaming callbacks
    // v20.18: Wrapped in try/catch to prevent silent failures causing blank responses
    function onChunk(chunk, fullText) {
      try {
        var streamContent = document.getElementById('streamingContent');
        if (streamContent) {
          streamContent.innerHTML = formatMessageContent(fullText) + '<span class="streaming-cursor"></span>';
          // v16.4: Smart scroll — only auto-scroll if user is near bottom
          if (convThread) {
            var isNearBottom = convThread.scrollHeight - convThread.scrollTop - convThread.clientHeight < 150;
            if (isNearBottom) convThread.scrollTop = convThread.scrollHeight;
          }
        }
      } catch(chunkErr) {
        console.error('[BrandAI] onChunk error:', chunkErr);
      }
    }

    function onComplete(fullText) {
      // v24.20: Blob back to idle
      if (typeof setBlobState === 'function') setBlobState('idle');
      // Remove streaming cursor
      var streamContent = document.getElementById('streamingContent');
      if (streamContent) {
        try {
          streamContent.innerHTML = formatMessageContent(fullText);
        } catch(fmtErr) {
          console.error('[BrandAI] formatMessageContent error:', fmtErr);
          streamContent.innerHTML = '<p style="color:var(--error-red, #ef4444);">Error rendering response.</p>';
        }
      }
      // v28.4: Check for pulse_goal blocks in response
      if (streamContent && typeof checkForPulseGoalInResponse === 'function') {
        checkForPulseGoalInResponse(streamContent, fullText);
      }
      // v20.18: Debug logging for blank response investigation
      if (!fullText || !fullText.trim()) {
        console.warn('[BrandAI] onComplete received empty response. Provider:', provider, 'Model:', model);
      }
      // v16.10: Append export actions (Copy/Word/Excel/Slides/PDF)
      appendStreamingMsgActions();

      // v15.22: Capture image URL for multi-turn persistence
      var msgObj = { role: 'assistant', content: fullText };
      if (window._lastChatImageUrl) {
        msgObj.imageUrl = window._lastChatImageUrl;
        window._lastChatImageUrl = null;
      }
      currentConversation.push(msgObj);

      // v10.5.25: Save to history - this was missing and causing History to not update!
      if (currentConversation.length === 2) {
        var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
        var lifeProfile = currentMode === 'life' && typeof getCurrentLifeProfile === 'function' ? getCurrentLifeProfile() : null;
        
        var commandRecord = {
          id: Date.now(),
          brand: brand.name,
          mode: currentMode,
          lifeName: lifeProfile ? lifeProfile.name : null,
          command: currentConversation[0].displayContent || currentConversation[0].content,
          conversation: JSON.parse(JSON.stringify(currentConversation)),
          time: new Date().toLocaleString()
        };
        agentCommands.push(commandRecord);
        saveRuns();
        renderAgentHistory();
        
        // Generate AI title in background
        generateConversationTitle(currentConversation, brand, commandRecord.id);
      } else {
        // v10.5.25: Update the CORRECT conversation entry
        var targetCmd = null;
        if (window._continuedHistoryIndex !== null && window._continuedHistoryIndex !== undefined && agentCommands[window._continuedHistoryIndex]) {
          targetCmd = agentCommands[window._continuedHistoryIndex];
        } else {
          targetCmd = agentCommands[agentCommands.length - 1];
        }
        if (targetCmd) {
          targetCmd.conversation = JSON.parse(JSON.stringify(currentConversation));
          saveRuns();
        }
      }
      
      // v16.4: Clear abort controller and restore button
      _streamAbortController = null;
      restoreSendButton('followupBtn');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('sending');
      }
      // v22.39: Safety — always hide progress bars on completion
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      if (typeof hideThinkingProgress === 'function') hideThinkingProgress();
      setAgentStatus('ready');

    }

    function onError(error) {
      var streamingMsg = document.getElementById('streamingMessage');
      if (streamingMsg) streamingMsg.remove();
      _streamAbortController = null;
      restoreSendButton('followupBtn');
      // v22.39: Safety — always hide progress bars on error
      if (typeof hideDeepResearchProgress === 'function') hideDeepResearchProgress();
      if (typeof hideThinkingProgress === 'function') hideThinkingProgress();
      handleChatError(error, btnId, btn);
    }

    // v15.45: Inject current date so AI knows the real date
    prompt = 'Today\'s date is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.\n\n' + prompt;

    // v11.0.5: Add chat length instruction to prompt
    var lengthInstruction = getChatLengthInstruction();
    if (lengthInstruction) {
      prompt = prompt + '\n\n' + lengthInstruction;
    }
    // v24.25: Add inline visual capability
    prompt += VISUAL_CAPABILITY_HINT;

    // v16.4: Set up abort controller and stop button
    _streamAbortController = new AbortController();
    setSendButtonStopping('followupBtn');
    var _brandSignal = _streamAbortController.signal;

    // v8.0: Use streaming API calls
    if (provider === 'anthropic') {
      callAnthropicStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _brandSignal);
    } else if (provider === 'openai') {
      callOpenAIStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _brandSignal);
    } else if (provider === 'google') {
      callGoogleStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _brandSignal);
    } else if (provider === 'nanobanana') {
      // v13.9: Nanobanana chat — detect image requests and route accordingly
      var lastUserMsg = messages.length > 0 ? (typeof messages[messages.length - 1].content === 'string' ? messages[messages.length - 1].content : '') : '';
      if (isNanobananaImageRequest(model, lastUserMsg)) {
        handleNanobananaChatImage(model, lastUserMsg, onChunk, onComplete, onError);
      } else {
        callNanobananaStreaming(model, apiKey, messages, prompt, onChunk, onComplete, onError, _brandSignal);
      }
    }
    return;
  }

  console.log('[Chat] Using v2.2.1 streaming pattern with provider:', provider);
  
  // Set up stream listeners (v2.2.1 working pattern)
  var fullText = '';
  
  window.roweosAPI.onStreamChunk(function(data) {
    fullText += data.text;
    console.log('[Chat] Stream chunk received');
  });
  
  window.roweosAPI.onStreamComplete(function() {
    console.log('[Chat] Stream complete. Full text length:', fullText.length);
    
    // Add assistant response to conversation
    currentConversation.push({ role: 'assistant', content: fullText });
    
    // Show conversation UI
    showConversationView();
    renderConversation();
    
    // Scroll to show the latest message
    setTimeout(function() {
      var conversationThread = document.getElementById('conversationThread');
      if (conversationThread) {
        conversationThread.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);
    
    // Save to history only on first message
    if (currentConversation.length === 2) {
      // v10.5.25: Include mode and life profile info
      var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
      var lifeProfile = currentMode === 'life' && typeof getCurrentLifeProfile === 'function' ? getCurrentLifeProfile() : null;
      
      var commandRecord = {
        id: Date.now(),
        brand: brand.name,
        mode: currentMode,
        lifeName: lifeProfile ? lifeProfile.name : null,
        command: currentConversation[0].content,
        conversation: JSON.parse(JSON.stringify(currentConversation)),
        time: new Date().toLocaleString()
      };
      agentCommands.push(commandRecord);
      saveRuns();
      renderAgentHistory();
      
      // v9.1.14: Generate AI title in background
      generateConversationTitle(currentConversation, brand, commandRecord.id);
    } else {
      // v10.5.25: Update the CORRECT conversation entry
      var targetCmd = null;
      if (window._continuedHistoryIndex !== null && window._continuedHistoryIndex !== undefined && agentCommands[window._continuedHistoryIndex]) {
        targetCmd = agentCommands[window._continuedHistoryIndex];
      } else {
        targetCmd = agentCommands[agentCommands.length - 1];
      }
      if (targetCmd) {
        targetCmd.conversation = JSON.parse(JSON.stringify(currentConversation));
        saveRuns();
      }
    }
    
    if (btnId === 'agentRunBtn') {
      document.getElementById('agentCommand').value = '';
    } else {
      var _fc2 = document.getElementById('followupCommand');
      _fc2.value = '';
      autoResizeTextarea(_fc2); // v10.5.25: Reset height
    }
    
    btn.disabled = false;
    btn.classList.remove('sending');
    setAgentStatus('ready');
    
    
    
    // Clean up listeners
    window.roweosAPI.removeStreamListeners();
  });
  
  window.roweosAPI.onStreamError(function(data) {
    console.error('[Chat] Stream error:', data);
    showToast('Error: ' + (data.error || 'Stream failed'), 'error');
    btn.disabled = false;
    btn.classList.remove('sending');
    setAgentStatus('ready');
    window.roweosAPI.removeStreamListeners();
  });
  
  // Add debug log listener to capture backend logs
  if (window.roweosAPI.onDebugLog) {
    window.roweosAPI.onDebugLog(function(message) {
      console.log(message);
    });
  }
  
  // Log the prompt being sent for debugging
  console.log('[BrandAI] === FINAL PROMPT BEING SENT TO API ===');
  console.log('[BrandAI] Prompt preview (first 500 chars):', prompt.substring(0, 500) + '...');
  console.log('[BrandAI] Prompt preview (last 500 chars):', '...' + prompt.substring(prompt.length - 500));
  console.log('[BrandAI] Total prompt length:', prompt.length, 'characters');
  console.log('[BrandAI] Contains "Mr. Rowe":', prompt.includes('Mr. Rowe'));
  console.log('[BrandAI] =====================================');
  
  // Start the stream (v2.2.1 API call)
  window.roweosAPI.agentChatStream({
    messages: messages,
    systemPrompt: prompt,
    provider: provider,
    model: brand.model || (provider === 'anthropic' ? 'claude-sonnet-4-6' : (provider === 'openai' ? 'gpt-5.4' : 'gemini-3.1-pro-preview')),
    deepResearch: deepResearchActive
  }).then(function(result) {
    if (!result || !result.success) {
      throw new Error((result && result.error) || 'Failed to start stream');
    }
  }).catch(function(e) {
    console.error('[Chat] Error:', e);
    showToast('Error: ' + e.message, 'error');
    btn.disabled = false;
    btn.classList.remove('sending');
    setAgentStatus('ready');
    window.roweosAPI.removeStreamListeners();
  });
}

function copyAgentResponse() {
  if (currentConversation.length === 0) {
    showToast('No response to copy', 'warning');
    return;
  }
  
  var lastAssistant = currentConversation[currentConversation.length - 1];
  if (lastAssistant && lastAssistant.role === 'assistant') {
    var text = lastAssistant.content;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('Response copied to clipboard', 'success');
      }).catch(function() {
        showToast('Could not copy to clipboard', 'error');
      });
    } else {
      showToast('Clipboard not available', 'warning');
    }
  }
}

function renderAgentHistory() {
  var h = document.getElementById('agentHistory');
  // v9.1.14: Element may not exist if Tuning view is redesigned
  if (!h) return;
  
  if (agentCommands.length === 0) {
    h.innerHTML = '<div style="color:#888;padding:24px;text-align:center">No conversations yet</div>';
    return;
  }
  h.innerHTML = '';
  agentCommands.slice().reverse().forEach(function(cmd, reverseIdx) {
    // v10.5.29: Calculate actual index in agentCommands array
    var actualIndex = agentCommands.length - 1 - reverseIdx;
    
    var item = document.createElement('div');
    item.className = 'history-item';
    var turnCount = cmd.conversation ? Math.floor(cmd.conversation.length / 2) : 1;
    // v9.1.14: Use AI-generated title if available, otherwise truncate command
    var displayTitle = cmd.title || ((cmd.command || '').substring(0, 60) + ((cmd.command || '').length > 60 ? '...' : ''));
    
    // v10.5.31: Mode badge
    var isLifeMode = cmd.mode === 'life';
    var modeBadge = isLifeMode 
      ? '<span style="display:inline-block;padding:2px 6px;background:var(--life-accent-20, rgba(34,197,94,0.2));color:var(--life-accent, #22c55e);font-size:10px;border-radius:4px;margin-right:6px;">◇ Life</span>'
      : '<span style="display:inline-block;padding:2px 6px;background:rgba(212,175,55,0.15);color:var(--accent-gold, #a89878);font-size:10px;border-radius:4px;margin-right:6px;">◆ Brand</span>';
    
    // v10.5.31: Add actions row
    var actionsRow = '<div class="history-item-actions" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-subtle);gap:8px;">';
    actionsRow += '<button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); uploadHistoryToStudio(' + actualIndex + ')">↗ Upload to Studio</button>';
    actionsRow += '<button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); chatWithHistoryItem(' + actualIndex + ')">💬 Chat</button>';
    actionsRow += '</div>';
    
    item.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
      '<div><div style="font-weight:600">' + modeBadge + displayTitle + '</div>' +
      '<div style="font-size:13px;color:#888">' + (cmd.brand || 'Unknown') + ' • ' + turnCount + ' turn' + (turnCount > 1 ? 's' : '') + ' • ' + cmd.time + '</div></div>' +
      '<button class="history-expand-btn" onclick="event.stopPropagation(); toggleHistoryActions(this)" style="background:none;border:none;cursor:pointer;padding:4px 8px;color:#888;font-size:16px;">⋮</button>' +
      '</div>' + actionsRow;
    
    item.onclick = (function(idx, cmdRef) {
      return function() { 
        if (cmdRef.conversation) {
          currentConversation = JSON.parse(JSON.stringify(cmdRef.conversation));
          
          // v10.5.29: Set continuingFromHistoryIndex so followups update THIS entry
          continuingFromHistoryIndex = idx;
          window._continuedHistoryIndex = idx;
          console.log('[History] Loading conversation at index', idx);
          
          // v10.5.29: Set mode based on history entry
          if (cmdRef.mode === 'life') {
            localStorage.setItem('roweos_app_mode', 'life');
            document.documentElement.classList.add('life-mode');
            document.documentElement.classList.remove('brand-mode');
          } else if (cmdRef.brandIndex !== undefined) {
            selectedBrand = cmdRef.brandIndex;
            var brandSelect = document.getElementById('agentBrand');
            if (brandSelect) brandSelect.value = cmdRef.brandIndex.toString();
          }
          
          showConversationView();
          renderConversation();
          window.scrollTo(0, 0);
        }
      };
    })(actualIndex, cmd);
    h.appendChild(item);
  });
}

/**
 * v10.5.31: Toggle history item actions
 */
function toggleHistoryActions(btn) {
  var actionsEl = btn.parentElement.nextElementSibling;
  if (actionsEl && actionsEl.classList.contains('history-item-actions')) {
    var isHidden = actionsEl.style.display === 'none';
    actionsEl.style.display = isHidden ? 'flex' : 'none';
    btn.style.color = isHidden ? 'var(--accent)' : '#888';
  }
}

/**
 * v10.5.31: Upload history item content to Studio's Context field
 */
function uploadHistoryToStudio(index) {
  var cmd = agentCommands[index];
  if (!cmd) {
    showToast('Could not find history item', 'error');
    return;
  }
  
  // Get content from conversation or response
  var content = '';
  var sourceName = cmd.title || cmd.command || 'History';
  
  if (cmd.conversation && cmd.conversation.length > 0) {
    // Format conversation as context
    cmd.conversation.forEach(function(msg) {
      var role = msg.role === 'user' ? 'User' : 'AI';
      content += role + ': ' + (msg.content || '') + '\n\n';
    });
  } else if (cmd.response) {
    content = cmd.response;
  }
  
  if (!content.trim()) {
    showToast('No content to upload', 'warning');
    return;
  }
  
  uploadToStudioContext(content.trim(), sourceName);
}

/**
 * v10.5.31: Open chat with history item content
 */
function chatWithHistoryItem(index) {
  var cmd = agentCommands[index];
  if (!cmd) {
    showToast('Could not find history item', 'error');
    return;
  }
  
  // Get content from conversation or response
  var content = '';
  var sourceName = cmd.title || cmd.command || 'History';
  
  if (cmd.conversation && cmd.conversation.length > 0) {
    // Get last assistant response
    for (var i = cmd.conversation.length - 1; i >= 0; i--) {
      if (cmd.conversation[i].role === 'assistant') {
        content = cmd.conversation[i].content;
        break;
      }
    }
  } else if (cmd.response) {
    content = cmd.response;
  }
  
  if (!content.trim()) {
    showToast('No content to chat about', 'warning');
    return;
  }
  
  // Set mode based on history entry
  if (cmd.mode === 'life') {
    localStorage.setItem('roweos_app_mode', 'life');
    document.documentElement.classList.add('life-mode');
    document.documentElement.classList.remove('brand-mode');
  } else if (cmd.brandIndex !== undefined) {
    selectedBrand = cmd.brandIndex;
    localStorage.setItem('roweos_app_mode', 'brand');
    document.documentElement.classList.remove('life-mode');
    document.documentElement.classList.add('brand-mode');
    var brandSelect = document.getElementById('agentBrand');
    if (brandSelect) brandSelect.value = cmd.brandIndex.toString();
  }
  
  // Navigate to chat
  showView('agent');
  currentConversation = [];
  continuingFromHistoryIndex = null;
  
  setTimeout(function() {
    var agentInput = document.getElementById('agentCommand');
    if (agentInput) {
      agentInput.value = 'Let\'s continue discussing this:\n\n[From: ' + sourceName + ']\n' + content.substring(0, 5000);
      autoResizeTextarea(agentInput);
      agentInput.focus();
    }
    showToast('Content loaded into chat', 'success');
  }, 100);
}

function saveRuns() {
  // v11.0.5: Strip large file content from conversations before saving
  // Files are analyzed once, we don't need to store the full content
  var cleanedAgentCommands = agentCommands.map(function(cmd) {
    if (!cmd.conversation) return cmd;
    
    var cleanedConv = cmd.conversation.map(function(msg) {
      if (!msg.content) return msg;
      
      // If content is array (multipart), clean images
      if (Array.isArray(msg.content)) {
        return {
          role: msg.role,
          displayContent: msg.displayContent,
          content: msg.content.map(function(part) {
            if (part.type === 'image' && part.source && part.source.data) {
              // Strip base64 image data, keep reference
              return { type: 'image', note: '[Image attached - data stripped for storage]' };
            }
            return part;
          })
        };
      }
      
      // If content is string with file data, trim it
      if (typeof msg.content === 'string') {
        var content = msg.content;
        
        // Check for embedded PDF content
        if (content.indexOf('[PDF Document:') !== -1 && content.length > 5000) {
          var pdfMatch = content.match(/\[PDF Document: ([^\]]+)\]/);
          var pdfRef = pdfMatch ? pdfMatch[0] : '[PDF Document]';
          content = content.substring(0, 2000) + '\n\n...[Content trimmed for storage - ' + pdfRef + ']...';
        }
        
        // v16.6: Only trim at very high safety cap — preserve full content
        if (content.length > 500000) {
          content = content.substring(0, 500000) + '\n\n...[Content trimmed for storage (' + Math.round(content.length/1000) + 'KB)]...';
        }
        
        return {
          role: msg.role,
          displayContent: msg.displayContent || content.substring(0, 500),
          content: content
        };
      }
      
      return msg;
    });
    
    return Object.assign({}, cmd, { conversation: cleanedConv });
  });
  
  var data = {
    runs: runs.slice(-50), // Keep last 50 runs
    calendar: calendar,
    agentCommands: cleanedAgentCommands,
    currentWeekOffset: currentWeekOffset,
    pinnedOps: pinnedOps,
    recentOps: recentOps
  };
  
  try {
    var json = JSON.stringify(data);
    var sizeKB = Math.round(json.length / 1024);
    console.log('[saveRuns] Saving', sizeKB, 'KB of data,', cleanedAgentCommands.length, 'conversations');
    
    // Check size before saving
    if (json.length > 4500000) {
      console.warn('[saveRuns] Data approaching limit, aggressive trim...');
      // Keep only last 10 conversations
      data.agentCommands = cleanedAgentCommands.slice(-10);
      data.runs = runs.slice(-10);
      json = JSON.stringify(data);
    }
    
    localStorage.setItem('roweos_runs', json);
    // v15.20: Also write mode-separated agentCommands for Firebase sync
    try {
      var lifeCommands = cleanedAgentCommands.filter(function(cmd) { return cmd.mode === 'life'; });
      var brandCommands = cleanedAgentCommands.filter(function(cmd) { return cmd.mode !== 'life'; });
      localStorage.setItem('roweos_life_agentCommands', JSON.stringify(lifeCommands));
      localStorage.setItem('roweos_agentCommands', JSON.stringify(brandCommands));
      // v15.25: Clear sync baselines — local data changed, needs re-push
      localStorage.removeItem('roweos_sync_baseline_brandai_chats');
      localStorage.removeItem('roweos_sync_baseline_lifeai_chats');
    } catch (e) { console.warn('[saveRuns] Could not save split agentCommands:', e.message); }
    console.log('[saveRuns] Saved successfully');
  } catch (e) {
    console.error('[saveRuns] ⚠️ STORAGE QUOTA EXCEEDED!', e);
    console.error('[saveRuns] Data size: ' + (JSON.stringify(data).length / 1024 / 1024).toFixed(2) + ' MB');
    showToast('⚠️ Storage full! Trimming old data...', 'error');
    
    // Emergency: Keep only last 5 conversations
    try {
      var emergencyData = {
        runs: runs.slice(-5),
        calendar: calendar.slice(-30),
        agentCommands: cleanedAgentCommands.slice(-5),
        currentWeekOffset: currentWeekOffset,
        pinnedOps: pinnedOps,
        recentOps: recentOps
      };
      localStorage.setItem('roweos_runs', JSON.stringify(emergencyData));
      console.log('[saveRuns] Emergency save succeeded (kept last 5)');
      showToast('Saved last 5 conversations (storage was full)', 'warning');
    } catch (e2) {
      console.error('[saveRuns] Emergency save also failed!', e2);
      showToast('⚠️ CRITICAL: Cannot save! Export data NOW!', 'error');
    }
  }
}

function loadRuns() {
  var saved = localStorage.getItem('roweos_runs');
  console.log('[loadRuns] roweos_runs present:', !!saved, saved ? (saved.length / 1024).toFixed(1) + 'KB' : '');
  if (saved) {
    var data;
    try { data = JSON.parse(saved); } catch (e) {
      console.error('[loadRuns] Corrupt roweos_runs data, clearing:', e.message);
      localStorage.removeItem('roweos_runs');
      return;
    }

    // v15.37: Handle both formats — flat array (from sync) and object (from saveRuns)
    if (Array.isArray(data)) {
      console.log('[loadRuns] Migrating flat array format (' + data.length + ' runs) to object format');
      runs = data;
      // Restore agentCommands/calendar from their separate localStorage keys if available
      try { agentCommands = JSON.parse(localStorage.getItem('roweos_agentCommands') || '[]'); } catch(e) { agentCommands = []; }
      try { calendar = JSON.parse(localStorage.getItem('roweos_calendar') || '[]'); } catch(e) { calendar = []; }
      // Re-save in correct object format
      saveRuns();
      return;
    }

    runs = data.runs || [];
    calendar = data.calendar || [];
    agentCommands = data.agentCommands || [];
    currentWeekOffset = data.currentWeekOffset || 0;
    console.log('[loadRuns] Loaded', runs.length, 'runs,', agentCommands.length, 'agentCommands');

    // Handle migration from old array format to per-brand object format
    if (data.pinnedOps) {
      if (Array.isArray(data.pinnedOps)) {
        // Old format: migrate to new format (put all in brand 0)
        pinnedOps = { 0: data.pinnedOps, 1: [], 2: [], 3: [], 4: [] };
      } else {
        // New format: use as-is
        pinnedOps = data.pinnedOps;
      }
    }

    if (data.recentOps) {
      if (Array.isArray(data.recentOps)) {
        // Old format: migrate to new format (put all in brand 0)
        recentOps = { 0: data.recentOps, 1: [], 2: [], 3: [], 4: [] };
      } else {
        // New format: use as-is
        recentOps = data.recentOps;
      }
    }
  }
}

/**
 * v10.5.25: Recovery tool - find conversations with the most messages
 * Run in browser console: recoverConversation()
 */
function recoverConversation(minMessages) {
  minMessages = minMessages || 0;
  console.log('=== DEEP CONVERSATION RECOVERY v10.5.25 ===');
  console.log('Scanning ALL storage locations...\n');
  
  // 1. Check agentCommands (roweos_runs)
  var saved = localStorage.getItem('roweos_runs');
  if (saved) {
    var data = JSON.parse(saved);
    var cmds = data.agentCommands || [];
    console.log('📁 agentCommands (roweos_runs): ' + cmds.length + ' total entries');
    cmds.forEach(function(cmd, idx) {
      var msgCount = cmd.conversation ? cmd.conversation.length : 0;
      if (msgCount >= minMessages) {
        var lastContent = cmd.conversation && cmd.conversation.length > 0 ? 
          cmd.conversation[cmd.conversation.length - 1].content : '';
        console.log('  [' + idx + '] ' + msgCount + ' msgs | ' + (cmd.mode || 'brand') + ' | ' + (cmd.title || cmd.command?.substring(0, 40) || 'Untitled'));
        console.log('       Brand: ' + (cmd.brand || '?') + ' | Time: ' + (cmd.time || '?'));
        console.log('       Last msg: ' + (lastContent ? lastContent.substring(0, 100) : '(empty)'));
      }
    });
  } else {
    console.log('📁 agentCommands: NOT FOUND');
  }
  
  // 2. Check LifeAI profile history (may have truncated versions)
  console.log('\n');
  var lifeProfile = localStorage.getItem('roweos_life_profile');
  if (lifeProfile) {
    var profile = JSON.parse(lifeProfile);
    var history = profile.conversationHistory || [];
    console.log('📁 LifeAI Profile History (roweos_life_profile): ' + history.length + ' entries');
    console.log('   ⚠️  Messages truncated to 500 chars each in this storage');
    history.forEach(function(convo, idx) {
      var msgCount = convo.messages ? convo.messages.length : 0;
      console.log('  [' + idx + '] ' + msgCount + ' msgs | ' + convo.timestamp + ' | ' + (convo.summary || '').substring(0, 60));
      if (convo.messages && convo.messages.length > 0) {
        var last = convo.messages[convo.messages.length - 1];
        console.log('       Last: ' + (last.content || '').substring(0, 100));
      }
    });
  } else {
    console.log('📁 LifeAI Profile History: NOT FOUND');
  }
  
  // 3. Check LifeAI Library
  console.log('\n');
  var lifeLib = localStorage.getItem('roweos_life_library');
  if (lifeLib) {
    var lib = JSON.parse(lifeLib);
    var files = lib.files || [];
    console.log('📁 LifeAI Library (roweos_life_library): ' + files.length + ' files');
    files.forEach(function(f, idx) {
      var hasConvo = f.content && f.content.indexOf('data-conversation') > -1;
      var convoMatch = hasConvo ? f.content.match(/data-conversation='([^']+)'/) : null;
      var convoMsgCount = 0;
      if (convoMatch) {
        try { convoMsgCount = JSON.parse(convoMatch[1].replace(/&#39;/g, "'")).length; } catch(e) {}
      }
      console.log('  [' + idx + '] "' + f.name + '" | ' + new Date(f.savedAt).toLocaleString());
      if (hasConvo) console.log('       📌 Has conversation data: ' + convoMsgCount + ' messages');
    });
  } else {
    console.log('📁 LifeAI Library: NOT FOUND');
  }
  
  // 4. Check Brand Library
  var brandLib = localStorage.getItem('roweos_library');
  if (brandLib) {
    var bl = JSON.parse(brandLib);
    console.log('\n📁 Brand Library (roweos_library):');
    for (var key in bl) {
      if (bl[key] && bl[key].files) {
        bl[key].files.forEach(function(f) {
          var hasConvo = f.content && f.content.indexOf('data-conversation') > -1;
          if (hasConvo) {
            var convoMatch = f.content.match(/data-conversation='([^']+)'/);
            var convoMsgCount = 0;
            if (convoMatch) {
              try { convoMsgCount = JSON.parse(convoMatch[1].replace(/&#39;/g, "'")).length; } catch(e) {}
            }
            console.log('  "' + f.name + '" | ' + convoMsgCount + ' msgs | ' + new Date(f.savedAt).toLocaleString());
          }
        });
      }
    }
  }
  
  // 5. Check localStorage size
  console.log('\n📊 localStorage Usage:');
  var totalSize = 0;
  for (var k in localStorage) {
    if (localStorage.hasOwnProperty(k)) {
      var size = localStorage[k].length * 2; // UTF-16
      totalSize += size;
      if (size > 50000) {
        console.log('  ' + k + ': ' + (size / 1024).toFixed(1) + ' KB');
      }
    }
  }
  console.log('  TOTAL: ' + (totalSize / 1024 / 1024).toFixed(2) + ' MB');
  console.log('  ⚠️  If near 5-10MB, saveRuns() may have been silently failing!\n');
  
  console.log('=== RECOVERY COMMANDS ===');
  console.log('saveRecoveredConversation(INDEX)  - Save from agentCommands');
  console.log('saveLifeProfileConversation(INDEX) - Save from LifeAI profile history (truncated)');
  console.log('recoverConversation(0) - Show ALL entries including small ones');
}

/**
 * v10.5.25: Save a recovered conversation from agentCommands to Library
 */
function saveRecoveredConversation(index) {
  var saved = localStorage.getItem('roweos_runs');
  if (!saved) { showToast('No saved runs', 'error'); return; }
  var data = JSON.parse(saved);
  var cmd = (data.agentCommands || [])[index];
  if (!cmd || !cmd.conversation) { showToast('Conversation not found at index ' + index, 'error'); return; }
  
  currentConversation = cmd.conversation.map(function(m) {
    return { role: m.role, content: m.content, displayContent: m.displayContent || m.content };
  });
  
  openSaveConversationToLibrary();
  showToast('Loaded conversation with ' + cmd.conversation.length + ' messages - save it now', 'success');
}

/**
 * v10.5.25: Save from LifeAI profile history (may be truncated)
 */
function saveLifeProfileConversation(index) {
  var lifeProfile = localStorage.getItem('roweos_life_profile');
  if (!lifeProfile) { showToast('No LifeAI profile found', 'error'); return; }
  var profile = JSON.parse(lifeProfile);
  var history = profile.conversationHistory || [];
  var convo = history[index];
  if (!convo || !convo.messages) { showToast('Conversation not found at index ' + index, 'error'); return; }
  
  currentConversation = convo.messages.map(function(m) {
    return { role: m.role, content: m.content, displayContent: m.content };
  });
  
  openSaveConversationToLibrary();
  showToast('Loaded ' + convo.messages.length + ' messages (⚠️ may be truncated to 500 chars each)', 'warning');
}

function openExportModal() {
  updateExportSummary();
  document.getElementById('exportModal').classList.add('show');
}

function closeExportModal() {
  document.getElementById('exportModal').classList.remove('show');
}

function updateExportSummary() {
  var summary = document.getElementById('exportSummary');
  var lines = [];
  
  lines.push('• 74 studio operations');
  lines.push('• 5 brand profiles');
  lines.push('• ' + runs.length + ' saved runs');
  lines.push('• ' + calendar.length + ' calendar items');
  lines.push('• ' + agentCommands.length + ' agent conversations');
  
  var totalPinned = 0;
  for (var i = 0; i < 5; i++) {
    totalPinned += (pinnedOps[i] || []).length;
  }
  lines.push('• ' + totalPinned + ' pinned operations');
  
  summary.innerHTML = lines.join('<br>');
}

function exportHTML() {
  openExportModal();
}

function confirmExport() {
  var html = document.documentElement.outerHTML;
  var blob = new Blob([html], { type: 'text/html' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  
  // Generate filename with date
  var date = new Date().toISOString().slice(0, 10);
  a.download = 'RoweOS_v58_' + date + '.html';
  
  a.click();
  URL.revokeObjectURL(url);
  closeExportModal();
  showToast('RoweOS exported successfully', 'success');
}

// ═══════════════════════════════════════════════════════════════
// MOBILE MENU FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function toggleMobileMenu() {
  var menu = document.getElementById('mobileMenu');
  var overlay = document.getElementById('mobileMenuOverlay');
  var isOpen = menu.classList.contains('show');
  
  if (isOpen) {
    closeMobileMenu();
  } else {
    menu.classList.add('show');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileMenu() {
  var menu = document.getElementById('mobileMenu');
  var overlay = document.getElementById('mobileMenuOverlay');
  
  menu.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

function mobileNavTo(view) {
  // Update mobile nav active state
  document.querySelectorAll('.mobile-nav-item').forEach(function(item) {
    item.classList.toggle('active', item.dataset.view === view);
  });
  
  showView(view);
}

function onMobileBrandChange(value) {
  var brandIdx = parseInt(value);
  
  // Sync all brand selectors
  document.getElementById('brand').value = brandIdx;
  document.getElementById('agentBrand').value = brandIdx;
  document.getElementById('studioBrand').value = brandIdx;
  studioSelectedBrand = brandIdx;
  
  showAllOps = false;
  renderOperations();
  renderToolOpsGrid();
  
  // v9.1.14: Removed toast - silent brand switch
  
  // Update settings if on that view
  if (currentView === 'settings') {
    showSettings();
  }
}

// Sync mobile brand selector on init and brand changes
var originalOnBrandChange = onBrandChange;
onBrandChange = function() {
  originalOnBrandChange();
  var brandIdx = parseInt(document.getElementById('brand').value);
  var mobileBrand = document.getElementById('mobileBrand');
  if (mobileBrand) mobileBrand.value = brandIdx;
  // Also sync v2 mobile brand selector and pill
  syncMobileBrandV2();
};

// Update mobile nav when view changes
var originalShowView = showView;
showView = function(view) {
  // Update mobile nav active state (legacy)
  document.querySelectorAll('.mobile-nav-item').forEach(function(item) {
    item.classList.toggle('active', item.dataset.view === view);
  });
  
  // Update mobile nav v2 active state
  document.querySelectorAll('.mobile-tab').forEach(function(tab) {
    var tabView = tab.dataset.view;
    tab.classList.toggle('active', tabView === view || (tabView === 'more' && !['agent', 'studio', 'signal', 'rhythm'].includes(view)));
  });
  
  // Update full menu active state
  document.querySelectorAll('.mobile-menu-item').forEach(function(item) {
    item.classList.toggle('active', item.dataset.menuView === view);
  });
  
  originalShowView(view);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE SYSTEM v2.0 - JavaScript Functions
// ═══════════════════════════════════════════════════════════════════════════════

// Mobile Full Menu Functions
// v15.43: Redirect to liquid grid system
function openMobileFullMenu() {
  openLiquidGrid();
}

function closeMobileFullMenu() {
  closeLiquidGrid();
  // Legacy cleanup — also close old full menu if somehow open
  var overlay = document.getElementById('mobileFullMenuOverlay');
  var menu = document.getElementById('mobileFullMenu');
  if (overlay) overlay.classList.remove('show');
  if (menu) menu.classList.remove('show');
  document.body.style.overflow = '';
}

// v15.43: Liquid Grid — toggle/open/close
var liquidGridOpen = false;

function toggleLiquidGrid() {
  if (liquidGridOpen) {
    closeLiquidGrid();
  } else {
    openLiquidGrid();
  }
}

function openLiquidGrid() {
  liquidGridOpen = true;
  var overlay = document.getElementById('liquidGridOverlay');
  var panel = document.getElementById('liquidGridPanel');
  var fab = document.getElementById('liquidNavFab');
  var nav = document.getElementById('liquidNav');

  // Build grid items
  renderLiquidGridItems();

  if (overlay) overlay.classList.add('show');
  if (panel) panel.classList.add('show');
  if (fab) fab.classList.add('active');
  if (nav) nav.classList.add('grid-open');
  document.body.style.overflow = 'hidden';
}

function closeLiquidGrid() {
  if (!liquidGridOpen) return;
  liquidGridOpen = false;
  var overlay = document.getElementById('liquidGridOverlay');
  var panel = document.getElementById('liquidGridPanel');
  var fab = document.getElementById('liquidNavFab');
  var nav = document.getElementById('liquidNav');

  if (overlay) overlay.classList.remove('show');
  if (panel) panel.classList.remove('show');
  if (fab) fab.classList.remove('active');
  if (nav) nav.classList.remove('grid-open');
  document.body.style.overflow = '';
}

// v15.43: Build grid panel items — all views NOT in the pill, plus utility toggles
function renderLiquidGridItems() {
  var container = document.getElementById('liquidGridItems');
  if (!container) return;

  var pillTabs = getLiquidNavTabs();
  var isLifeMode = document.documentElement.classList.contains('life-mode');
  var isDark = !document.documentElement.classList.contains('light-mode');

  // v15.43: Include ALL views in grid (including pill tabs) for full access
  var sections = {};
  var sectionOrder = ['Core', 'Orchestration', 'Intelligence', 'Governance'];
  Object.keys(liquidGridViews).forEach(function(viewId) {
    var v = liquidGridViews[viewId];
    var sec = v.section || 'Other';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push({ id: viewId, label: (viewId === 'agent' && isLifeMode && v.lifeLabel) ? v.lifeLabel : v.label, icon: v.icon });
  });

  var html = '';

  sectionOrder.forEach(function(secName) {
    if (!sections[secName] || sections[secName].length === 0) return;
    html += '<div class="liquid-grid-section-label">' + secName + '</div>';
    sections[secName].forEach(function(item) {
      html += '<div class="liquid-grid-item" onclick="liquidGridNavTo(\'' + item.id + '\')">';
      html += '<span class="liquid-grid-item-icon">' + item.icon + '</span>';
      html += '<span class="liquid-grid-item-label">' + item.label + '</span>';
      html += '</div>';
    });
  });

  // Utilities row
  html += '<div class="liquid-grid-section-label">Utilities</div>';

  // Theme toggle
  html += '<div class="liquid-grid-item" onclick="toggleThemeFromGrid()">';
  html += '<span class="liquid-grid-item-icon">';
  if (isDark) {
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  } else {
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  html += '</span>';
  html += '<span class="liquid-grid-item-label">' + (isDark ? 'Light' : 'Dark') + '</span>';
  html += '</div>';

  // Mode toggle
  html += '<div class="liquid-grid-item" onclick="toggleModeFromGrid()">';
  html += '<span class="liquid-grid-item-icon">';
  if (isLifeMode) {
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
  } else {
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  }
  html += '</span>';
  html += '<span class="liquid-grid-item-label">' + (isLifeMode ? 'BrandAI' : 'LifeAI') + '</span>';
  html += '</div>';

  // Update
  html += '<div class="liquid-grid-item" onclick="forceReloadFromServer(); closeLiquidGrid();">';
  html += '<span class="liquid-grid-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></span>';
  html += '<span class="liquid-grid-item-label">Update</span>';
  html += '</div>';

  // Clear
  html += '<div class="liquid-grid-item" onclick="openClearModal(); closeLiquidGrid();">';
  html += '<span class="liquid-grid-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span>';
  html += '<span class="liquid-grid-item-label">Clear</span>';
  html += '</div>';

  container.innerHTML = html;
}

// v15.43: Navigate from grid
function liquidGridNavTo(view) {
  closeLiquidGrid();
  // Update active tab if this view is in the pill
  var pillTabs = getLiquidNavTabs();
  if (pillTabs.indexOf(view) !== -1) {
    liquidNavActiveTab = view;
    document.querySelectorAll('.liquid-tab').forEach(function(tab) {
      tab.classList.toggle('active', tab.dataset.view === view);
    });
  }
  showView(view);
}

// v15.43: Theme toggle from grid
function toggleThemeFromGrid() {
  closeLiquidGrid();
  toggleTheme();
  updateMobileThemeLabel();
}

// v15.43: Mode toggle from grid
function toggleModeFromGrid() {
  closeLiquidGrid();
  toggleRoweOSMode();
  updateMobileModeLabel();
  // Re-render liquid nav since Chat label may change
  renderLiquidNav();
}

// v29.3: Chat text selection toolbar
(function() {
  var _selToolbar = null;
  var _selRange = null;

  function createSelToolbar() {
    if (_selToolbar) return _selToolbar;
    var div = document.createElement('div');
    div.id = 'chatSelectionToolbar';
    div.className = 'chat-sel-toolbar';
    div.style.display = 'none';
    div.innerHTML = '<button onclick="chatSelAction(\'copy\')">Copy</button>' +
      '<button onclick="chatSelAction(\'pdf\')">PDF</button>' +
      '<button onclick="chatSelAction(\'scribe\')">Scribe</button>' +
      '<button onclick="chatSelAction(\'library\')">Library</button>' +
      '<button onclick="chatSelAction(\'word\')">Word</button>' +
      '<button onclick="chatSelAction(\'email\')">Email</button>';
    document.body.appendChild(div);
    _selToolbar = div;
    return div;
  }

  function showSelToolbar(rect) {
    var tb = createSelToolbar();
    tb.style.display = 'flex';
    tb.style.position = 'fixed';
    tb.style.left = Math.max(10, rect.left + (rect.width / 2) - 150) + 'px';
    tb.style.top = Math.max(10, rect.top - 44) + 'px';
    tb.style.zIndex = '10000';
  }

  function hideSelToolbar() {
    if (_selToolbar) _selToolbar.style.display = 'none';
    _selRange = null;
  }

  document.addEventListener('mouseup', function(e) {
    setTimeout(function() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        hideSelToolbar();
        return;
      }
      var node = sel.anchorNode;
      while (node && node !== document.body) {
        if (node.classList && node.classList.contains('conversation-message-content')) break;
        node = node.parentElement;
      }
      if (!node || !node.classList || !node.classList.contains('conversation-message-content')) {
        hideSelToolbar();
        return;
      }
      _selRange = sel.getRangeAt(0).cloneRange();
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      showSelToolbar(rect);
    }, 50);
  });

  document.addEventListener('mousedown', function(e) {
    if (_selToolbar && !_selToolbar.contains(e.target)) {
      hideSelToolbar();
    }
  });

  window.chatSelAction = function(action) {
    if (!_selRange) return;
    var sel = window.getSelection();
    var text = sel ? sel.toString() : '';
    var container = document.createElement('div');
    container.appendChild(_selRange.cloneContents());
    var html = container.innerHTML;
    hideSelToolbar();

    if (action === 'copy') {
      navigator.clipboard.writeText(text).then(function() {
        showToast('Copied to clipboard', 'success');
      });
    } else if (action === 'pdf') {
      if (typeof roweosPDF === 'function') {
        var pdfDiv = document.createElement('div');
        pdfDiv.innerHTML = html;
        pdfDiv.style.padding = '20px';
        document.body.appendChild(pdfDiv);
        roweosPDF(pdfDiv, 'chat-selection.pdf');
        document.body.removeChild(pdfDiv);
      }
    } else if (action === 'scribe') {
      if (typeof createScribeNotebook === 'function') {
        var nb = createScribeNotebook();
        if (nb && typeof selectScribeNotebook === 'function') {
          selectScribeNotebook(nb.id);
          setTimeout(function() {
            var editor = typeof tinymce !== 'undefined' ? tinymce.get('scribeContentArea') : null;
            if (editor) editor.setContent(html);
            if (typeof saveActiveScribeNotebook === 'function') saveActiveScribeNotebook();
          }, 500);
          showView('scribe');
          showToast('Saved to new Scribe notebook', 'success');
        }
      }
    } else if (action === 'library') {
      if (typeof openSaveConversationToLibrary === 'function') {
        window._chatSelectionContent = html;
        openSaveConversationToLibrary();
      }
    } else if (action === 'word') {
      if (typeof exportContentAsDocx === 'function') {
        exportContentAsDocx(html, 'chat-selection');
      } else {
        var blob = new Blob(['<html><body>' + html + '</body></html>'], { type: 'application/msword' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'chat-selection.doc';
        a.click();
        showToast('Downloaded as Word doc', 'success');
      }
    } else if (action === 'email') {
      if (typeof chatSendAsEmail === 'function') {
        window._chatSelectionContent = html;
        chatSendAsEmail();
      }
    }
  };
})();

// v29.3: Section markers for structured content export
function addSectionMarkers(contentEl) {
  if (!contentEl) return;
  var sections = contentEl.querySelectorAll('h1, h2, h3, h4, h5, h6, table, pre');
  if (sections.length < 2) return;

  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    if (sec.parentElement && sec.parentElement.classList.contains('chat-section-wrap')) continue;
    var wrap = document.createElement('div');
    wrap.className = 'chat-section-wrap';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'chat-section-check';
    cb.setAttribute('data-section-idx', String(i));
    cb.onchange = function() { updateSectionExportBar(contentEl); };
    sec.parentElement.insertBefore(wrap, sec);
    wrap.appendChild(cb);
    wrap.appendChild(sec);
  }
}

function updateSectionExportBar(contentEl) {
  var msgBubble = contentEl.closest('.conversation-message-bubble');
  if (!msgBubble) return;
  var checked = contentEl.querySelectorAll('.chat-section-check:checked');
  var bar = msgBubble.querySelector('.chat-section-export-bar');
  if (checked.length > 0) {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'chat-section-export-bar';
      bar.innerHTML = '<span class="chat-section-export-count"></span>' +
        '<button onclick="exportCheckedSections(this)">Export Selected</button>';
      msgBubble.appendChild(bar);
    }
    bar.querySelector('.chat-section-export-count').textContent = checked.length + ' section(s) selected';
    bar.style.display = 'flex';
  } else if (bar) {
    bar.style.display = 'none';
  }
}

function exportCheckedSections(btn) {
  var bubble = btn.closest('.conversation-message-bubble');
  if (!bubble) return;
  var contentEl = bubble.querySelector('.conversation-message-content');
  if (!contentEl) return;
  var checked = contentEl.querySelectorAll('.chat-section-check:checked');
  var html = '';
  for (var i = 0; i < checked.length; i++) {
    var wrap = checked[i].closest('.chat-section-wrap');
    if (wrap) {
      var clone = wrap.cloneNode(true);
      var cbEl = clone.querySelector('.chat-section-check');
      if (cbEl) cbEl.remove();
      html += clone.innerHTML;
    }
  }
  if (!html) return;
  var blob = new Blob(['<html><body>' + html + '</body></html>'], { type: 'application/msword' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chat-sections.doc';
  a.click();
  showToast('Exported ' + checked.length + ' section(s)', 'success');
}

// v29.3: Clip mode for precise content selection
var _clipModeActive = false;
var _clipOverlay = null;

function enterClipMode(btn) {
  if (_clipModeActive) { exitClipMode(); return; }
  var bubble = btn.closest('.conversation-message-bubble');
  if (!bubble) return;
  var content = bubble.querySelector('.conversation-message-content');
  if (!content) return;

  _clipModeActive = true;
  content.style.position = 'relative';

  var overlay = document.createElement('div');
  overlay.className = 'chat-clip-overlay';
  overlay.innerHTML = '<div class="chat-clip-handle chat-clip-start" style="top:0"></div>' +
    '<div class="chat-clip-region"></div>' +
    '<div class="chat-clip-handle chat-clip-end" style="bottom:0"></div>' +
    '<div class="chat-clip-actions">' +
    '<button onclick="exportClipContent(this)">Export Clip</button>' +
    '<button onclick="exitClipMode()" style="background:none;color:var(--text-muted);">Cancel</button>' +
    '</div>';
  content.appendChild(overlay);
  _clipOverlay = overlay;

  var startHandle = overlay.querySelector('.chat-clip-start');
  var endHandle = overlay.querySelector('.chat-clip-end');
  var region = overlay.querySelector('.chat-clip-region');

  function updateRegion() {
    var startY = parseInt(startHandle.style.top) || 0;
    var endY = parseInt(endHandle.style.top) || content.scrollHeight;
    region.style.top = startY + 'px';
    region.style.height = Math.max(0, endY - startY) + 'px';
  }

  function makeDraggable(handle) {
    var startPageY = 0;
    var startTop = 0;
    handle.onmousedown = function(e) {
      e.preventDefault();
      startPageY = e.pageY;
      startTop = parseInt(handle.style.top) || 0;
      function onMove(ev) {
        var newTop = Math.max(0, Math.min(content.scrollHeight, startTop + (ev.pageY - startPageY)));
        handle.style.top = newTop + 'px';
        updateRegion();
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
  }

  makeDraggable(startHandle);
  endHandle.style.top = content.scrollHeight + 'px';
  makeDraggable(endHandle);
  updateRegion();
}

function exitClipMode() {
  _clipModeActive = false;
  if (_clipOverlay && _clipOverlay.parentElement) {
    _clipOverlay.parentElement.removeChild(_clipOverlay);
  }
  _clipOverlay = null;
}

function exportClipContent(btn) {
  var overlay = btn.closest('.chat-clip-overlay');
  if (!overlay) return;
  var content = overlay.parentElement;
  if (!content) return;

  var startY = parseInt(overlay.querySelector('.chat-clip-start').style.top) || 0;
  var endY = parseInt(overlay.querySelector('.chat-clip-end').style.top) || content.scrollHeight;

  var children = content.children;
  var html = '';
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child === overlay) continue;
    var top = child.offsetTop;
    var bottom = top + child.offsetHeight;
    if (bottom > startY && top < endY) {
      html += child.outerHTML;
    }
  }

  exitClipMode();
  if (!html) { showToast('No content in clip region', 'error'); return; }

  var blob = new Blob(['<html><body>' + html + '</body></html>'], { type: 'application/msword' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chat-clip.doc';
  a.click();
  showToast('Clip exported', 'success');
}

