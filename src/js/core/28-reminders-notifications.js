// ═══════════════════════════════════════════════════════════════
// v24.25: REMINDERS SYSTEM
// ═══════════════════════════════════════════════════════════════

// v25.2: Show simple notification popup for automations/pipelines (old v24.25 style)
function showNotificationPopup(opts) {
  var id = 'reminderPopup_' + Date.now();
  var title = opts.title || 'Reminder';
  var message = opts.message || '';
  var actionLabel = opts.actionLabel || '';
  var actionView = opts.actionView || '';
  var source = opts.source || '';

  // Remove any existing reminder popup
  var existing = document.querySelectorAll('.reminder-popup');
  for (var e = 0; e < existing.length; e++) existing[e].remove();

  var html = '<div id="' + id + '" class="reminder-popup" style="position:fixed;bottom:20px;right:20px;z-index:99999;background:var(--bg-secondary);border:1px solid var(--brand-accent, #a89878);border-radius:var(--radius-lg);padding:16px 20px;max-width:400px;min-width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:fadeIn 0.3s ease;">';
  // Header
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">';
  html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent, #a89878)" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>';
  html += '<span style="font-weight:600;font-size:14px;color:var(--text-primary);">' + escapeHtml(title) + '</span>';
  html += '<button onclick="dismissNotificationPopup(\'' + id + '\')" style="margin-left:auto;border:none;background:none;color:var(--text-muted);cursor:pointer;padding:2px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
  html += '</div>';
  // Body
  if (message) {
    html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5;">' + escapeHtml(message) + '</p>';
  }
  // Time
  var now = new Date();
  var timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">' + timeStr + (source ? ' - via ' + source : '') + '</div>';
  // Action buttons - primary row
  html += '<div style="display:flex;gap:8px;margin-bottom:6px;">';
  if (actionLabel && actionView) {
    html += '<button onclick="dismissNotificationPopup(\'' + id + '\');if(typeof showView===\'function\')showView(\'' + escapeHtml(actionView) + '\')" style="flex:1;padding:8px;background:var(--brand-accent, #a89878);color:#000;border:none;border-radius:var(--radius-md);font-weight:600;font-size:13px;cursor:pointer;">' + escapeHtml(actionLabel) + '</button>';
  }
  html += '<button onclick="dismissNotificationPopup(\'' + id + '\')" style="flex:1;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:13px;cursor:pointer;">Dismiss</button>';
  html += '</div>';

  document.body.insertAdjacentHTML('beforeend', html);

  // Auto-dismiss after 30 seconds
  setTimeout(function() {
    var el = document.getElementById(id);
    if (el) el.remove();
  }, 30000);

  // Play notification sound if available
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body: message || '', icon: '/favicon.ico' });
    }
  } catch(e) {}
}

// v25.2: Dismiss notification popup by element ID (for showNotificationPopup)
function dismissNotificationPopup(id) {
  var el = document.getElementById(id);
  if (el) el.remove();
}

function reminderAction(id, viewName) {
  dismissReminderPopup(id);
  if (viewName && typeof showView === 'function') {
    showView(viewName);
  }
}

// v24.26: Snooze reminder - reschedule 15 minutes later
function snoozeReminderPopup(id, title, message, source) {
  dismissReminderPopup(id);
  showToast('Snoozed for 15 minutes', 'info');
  setTimeout(function() {
    showNotificationPopup({
      title: title || 'Reminder',
      message: message || '',
      source: source || 'snoozed'
    });
  }, 15 * 60 * 1000);
}

// v24.26: Complete/dismiss reminder and mark in history
function completeReminderPopup(id) {
  dismissReminderPopup(id);
  showToast('Reminder completed', 'success');
}

// v24.26: Open BrandAI chat with reminder context
function talkToBrandAIFromReminder(id, context) {
  dismissReminderPopup(id);
  if (typeof showView === 'function') {
    showView('brand-ai');
  }
  // Pre-fill the chat input with reminder context if available
  setTimeout(function() {
    var chatInput = document.getElementById('brandAIChatInput') || document.getElementById('aiChatInput');
    if (chatInput) {
      chatInput.value = 'Regarding this reminder: ' + (context || '');
      chatInput.focus();
    }
  }, 300);
}

// Reminder history storage
function getReminders() {
  try { var _r = JSON.parse(localStorage.getItem('roweos_reminders') || '[]'); return Array.isArray(_r) ? _r : []; } catch(e) { return []; }
}

function saveReminders(reminders) {
  try {
    localStorage.setItem('roweos_reminders', JSON.stringify(reminders));
    writeDB('pulse/main', { reminders: JSON.stringify(reminders) }, { category: 'goals' }); // v25.1
  } catch(e) {}
}

function saveReminderToHistory(reminder) {
  var reminders = getReminders();
  reminder.id = 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  // v25.2: New data model
  if (!reminder.status) reminder.status = 'pending';
  if (!reminder.createdAt) reminder.createdAt = Date.now();
  if (!reminder.scheduledAt && reminder.timestamp) {
    reminder.scheduledAt = new Date(reminder.timestamp).getTime();
  }
  if (!reminder.scheduledAt) reminder.scheduledAt = Date.now();
  reminder._modifiedAt = Date.now();
  reminder.snoozedUntil = null;
  reminder.actions = [];
  reminders.unshift(reminder);
  if (reminders.length > 100) reminders = reminders.slice(0, 100);
  saveReminders(reminders);
  if (typeof renderFocusReminders === 'function') renderFocusReminders();
}

function dismissReminder(remId) {
  var reminders = getReminders();
  for (var i = 0; i < reminders.length; i++) {
    if (reminders[i].id === remId) { reminders[i].dismissed = true; break; }
  }
  saveReminders(reminders);
  if (typeof renderFocusReminders === 'function') renderFocusReminders();
}

function clearAllReminders() {
  var reminders = getReminders();
  for (var i = 0; i < reminders.length; i++) reminders[i].dismissed = true;
  saveReminders(reminders);
  if (typeof renderFocusReminders === 'function') renderFocusReminders();
}

// Quick add reminder from Focus
function addQuickReminder() {
  var title = prompt('Reminder title:');
  if (!title || !title.trim()) return;
  var message = prompt('Details (optional):') || '';
  var reminder = {
    title: title.trim(),
    message: message.trim(),
    source: 'manual',
    timestamp: new Date().toISOString()
  };
  saveReminderToHistory(reminder);
  showToast('Reminder added', 'success');
}

// v25.2: Render reminders widget in Focus view with scheduled times, overdue indicators
function renderFocusReminders() {
  var container = document.getElementById('focus2RemindersList');
  if (!container) return;
  var reminders = getReminders().filter(function(r) { return !r.dismissed && r.status !== 'completed'; });
  var now = Date.now();

  if (reminders.length === 0) {
    var emptyHtml = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:16px;">No active reminders</div>';
    emptyHtml += renderInlineReminderForm();
    container.innerHTML = emptyHtml;
    return;
  }

  var html = '';
  reminders.slice(0, 10).forEach(function(r) {
    var scheduledAt = r.snoozedUntil || r.scheduledAt || new Date(r.timestamp).getTime();
    var isOverdue = scheduledAt && scheduledAt < now;
    var isPending = r.status === 'pending';
    var isSnoozed = r.status === 'pending' && r.snoozedUntil && r.snoozedUntil > now;

    // Time display
    var timeText = '';
    if (isSnoozed) {
      var snoozeMins = Math.ceil((r.snoozedUntil - now) / 60000);
      timeText = 'Snoozed - ' + (snoozeMins > 60 ? Math.floor(snoozeMins / 60) + 'h' : snoozeMins + 'm');
    } else if (isOverdue && isPending) {
      var overdueMins = Math.floor((now - scheduledAt) / 60000);
      timeText = 'Overdue ' + (overdueMins > 60 ? Math.floor(overdueMins / 60) + 'h ago' : overdueMins + 'm ago');
    } else if (scheduledAt > now) {
      var inMins = Math.ceil((scheduledAt - now) / 60000);
      if (inMins > 1440) timeText = 'In ' + Math.floor(inMins / 1440) + ' day' + (Math.floor(inMins / 1440) !== 1 ? 's' : '');
      else if (inMins > 60) timeText = 'In ' + Math.floor(inMins / 60) + 'h';
      else timeText = 'In ' + inMins + 'm';
    } else {
      timeText = r.timestamp ? new Date(r.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    }

    var borderColor = isOverdue && isPending ? '#f87171' : 'var(--accent, #a89878)';
    var sourceIcons = { manual: 'M12 6v6l4 2M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z', 'focus-inline': 'M12 6v6l4 2M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z', automation: 'M13 2L3 14h9l-1 8 10-12h-9l1-8', 'ai-chat': 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' };
    var iconPath = sourceIcons[r.source] || sourceIcons.manual;

    html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-color);border-left:3px solid ' + borderColor + ';padding-left:10px;margin-left:-2px;">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + borderColor + '" stroke-width="2" style="margin-top:2px;flex-shrink:0;"><path d="' + iconPath + '"/></svg>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:13px;font-weight:500;color:var(--text-primary);margin-bottom:2px;">' + escapeHtml(r.title) + '</div>';
    html += '<div style="font-size:11px;color:' + (isOverdue && isPending ? '#f87171' : 'var(--text-muted)') + ';">' + timeText + '</div>';
    html += '</div>';
    if (isPending) {
      html += '<button onclick="completeReminder(\'' + r.id + '\')" style="border:none;background:none;color:var(--accent);cursor:pointer;padding:2px;flex-shrink:0;" title="Complete"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></button>';
    }
    html += '<button onclick="dismissReminder(\'' + r.id + '\')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;padding:2px;flex-shrink:0;" title="Dismiss"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
    html += '</div>';
  });

  html += renderInlineReminderForm();
  container.innerHTML = html;
}

function renderInlineReminderForm() {
  return '<div style="padding:10px 0 4px;border-top:1px solid var(--border-color);margin-top:4px;">'
    + '<div style="display:flex;gap:6px;align-items:center;">'
    + '<input type="text" id="focusInlineReminderTitle" placeholder="Add a reminder..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="flex:1;padding:6px 10px;font-size:12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);outline:none;" onkeydown="if(event.key===\'Enter\')submitInlineReminder();">'
    + '<input type="datetime-local" id="focusInlineReminderTime" style="padding:5px 6px;font-size:11px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);outline:none;max-width:160px;">'
    + '<button onclick="submitInlineReminder()" style="padding:6px 10px;background:var(--brand-accent, #a89878);color:#000;border:none;border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Add</button>'
    + '</div></div>';
}

// v24.26: Handle inline reminder submission from Focus widget
function submitInlineReminder() {
  var titleInput = document.getElementById('focusInlineReminderTitle');
  var timeInput = document.getElementById('focusInlineReminderTime');
  if (!titleInput) return;
  var title = titleInput.value.trim();
  if (!title) { showToast('Please enter a reminder title', 'warning'); return; }
  // v25.2: scheduledAt from datetime picker
  var scheduledAt = Date.now();
  if (timeInput && timeInput.value) {
    scheduledAt = new Date(timeInput.value).getTime();
  }
  var reminder = {
    title: title,
    message: '',
    source: 'focus-inline',
    timestamp: new Date().toISOString(),
    scheduledAt: scheduledAt,
    status: 'pending'
  };
  saveReminderToHistory(reminder);
  titleInput.value = '';
  if (timeInput) timeInput.value = '';
  showToast('Reminder set', 'success');
}

// v25.2: Reminder Notification Popup System
var _reminderPopups = []; // Currently visible popup IDs
var _reminderQueue = []; // Queued popups waiting to show
var _reminderCheckInterval = null;
var MAX_VISIBLE_POPUPS = 3;

function startReminderChecker() {
  if (_reminderCheckInterval) return;
  _reminderCheckInterval = setInterval(checkDueReminders, 30000);
  // Also check immediately
  checkDueReminders();
}

function checkDueReminders() {
  var reminders = getReminders();
  var now = Date.now();
  var changed = false;
  for (var i = 0; i < reminders.length; i++) {
    var r = reminders[i];
    if (r.status !== 'pending') continue;
    var dueAt = r.snoozedUntil || r.scheduledAt;
    if (!dueAt || dueAt > now) continue;
    // This reminder is due
    r.status = 'fired';
    r._modifiedAt = now;
    changed = true;
    showReminderPopup(r);
    // Browser notification
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('RoweOS Reminder', { body: r.title, icon: '/icons/icon-192.png', tag: 'rem-' + r.id }); } catch(e) {}
    }
  }
  if (changed) saveReminders(reminders);
}

function showReminderPopup(reminder) {
  if (_reminderPopups.indexOf(reminder.id) !== -1) return; // Already showing
  if (_reminderPopups.length >= MAX_VISIBLE_POPUPS) {
    _reminderQueue.push(reminder);
    return;
  }
  _reminderPopups.push(reminder.id);

  var container = document.getElementById('reminderPopupContainer');
  if (!container) return;

  var now = Date.now();
  var scheduledAt = reminder.scheduledAt || now;
  var diffMs = now - scheduledAt;
  var timeText = '';
  var isOverdue = diffMs > 60000;
  if (isOverdue) {
    var mins = Math.floor(diffMs / 60000);
    if (mins < 60) timeText = 'Overdue by ' + mins + ' minute' + (mins !== 1 ? 's' : '');
    else timeText = 'Overdue by ' + Math.floor(mins / 60) + ' hour' + (Math.floor(mins / 60) !== 1 ? 's' : '');
  } else {
    timeText = 'Just now';
  }

  var popup = document.createElement('div');
  popup.className = 'reminder-popup';
  popup.id = 'reminderPopup_' + reminder.id;
  popup.innerHTML = '<div class="reminder-popup-header">'
    + '<span class="reminder-popup-label">RoweOS Reminder</span>'
    + '<button class="reminder-popup-close" id="remClose_' + reminder.id + '" onclick="dismissReminderPopup(\'' + reminder.id + '\')" title="Complete an action first">'
    + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>'
    + '</div>'
    + '<div class="reminder-popup-title">' + escapeHtml(reminder.title) + '</div>'
    + (reminder.message ? '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">' + escapeHtml(reminder.message) + '</div>' : '')
    + '<div class="reminder-popup-time' + (isOverdue ? ' overdue' : '') + '">' + timeText + '</div>'
    + '<div class="reminder-popup-actions">'
    + '<button class="reminder-popup-btn" onclick="reminderAction(\'' + reminder.id + '\',\'chat\')">Talk to AI</button>'
    + '<button class="reminder-popup-btn" onclick="reminderAction(\'' + reminder.id + '\',\'pulse\')">Add to Pulse</button>'
    + '<button class="reminder-popup-btn" onclick="reminderAction(\'' + reminder.id + '\',\'focus\')">Add to Focus</button>'
    + '<div style="position:relative;display:inline-block;">'
    + '<button class="reminder-popup-btn" onclick="toggleSnoozeMenu(\'' + reminder.id + '\')">Snooze</button>'
    + '<div class="reminder-popup-snooze-menu" id="snoozeMenu_' + reminder.id + '">'
    + '<div class="reminder-popup-snooze-option" onclick="snoozeReminder(\'' + reminder.id + '\',15)">15 minutes</div>'
    + '<div class="reminder-popup-snooze-option" onclick="snoozeReminder(\'' + reminder.id + '\',30)">30 minutes</div>'
    + '<div class="reminder-popup-snooze-option" onclick="snoozeReminder(\'' + reminder.id + '\',60)">1 hour</div>'
    + '<div class="reminder-popup-snooze-option" onclick="snoozeReminder(\'' + reminder.id + '\',180)">3 hours</div>'
    + '<div class="reminder-popup-snooze-option" onclick="snoozeReminderTomorrow(\'' + reminder.id + '\')">Tomorrow 9 AM</div>'
    + '</div></div>'
    + '<button class="reminder-popup-btn primary" onclick="completeReminder(\'' + reminder.id + '\')">Complete</button>'
    + '</div>';

  container.appendChild(popup);
  requestAnimationFrame(function() { popup.classList.add('visible'); });
}

function toggleSnoozeMenu(remId) {
  var menu = document.getElementById('snoozeMenu_' + remId);
  if (menu) menu.classList.toggle('open');
}

function enablePopupDismiss(remId) {
  var closeBtn = document.getElementById('remClose_' + remId);
  if (closeBtn) { closeBtn.classList.add('enabled'); closeBtn.title = 'Dismiss'; closeBtn.style.cursor = 'pointer'; }
}

function dismissReminderPopup(remId) {
  var closeBtn = document.getElementById('remClose_' + remId);
  if (closeBtn && !closeBtn.classList.contains('enabled')) return; // Can't dismiss yet
  var popup = document.getElementById('reminderPopup_' + remId);
  if (popup) {
    popup.classList.remove('visible');
    setTimeout(function() { if (popup.parentNode) popup.parentNode.removeChild(popup); }, 250);
  }
  _reminderPopups = _reminderPopups.filter(function(id) { return id !== remId; });
  // Show next queued
  if (_reminderQueue.length > 0) {
    var next = _reminderQueue.shift();
    showReminderPopup(next);
  }
}

function reminderAction(remId, action) {
  var reminders = getReminders();
  var reminder = null;
  for (var i = 0; i < reminders.length; i++) {
    if (reminders[i].id === remId) { reminder = reminders[i]; break; }
  }
  if (!reminder) return;

  enablePopupDismiss(remId);
  reminder.actions.push({ type: action, at: Date.now() });
  reminder._modifiedAt = Date.now();
  saveReminders(reminders);

  if (action === 'chat') {
    showView('pulse'); // v28.8: Redirect to Pulse
    setTimeout(function() {
      var input = document.getElementById('chatInput') || document.getElementById('agentInput');
      if (input) { input.value = 'Regarding my reminder: ' + reminder.title; input.focus(); }
    }, 300);
  } else if (action === 'pulse') {
    if (typeof pulseGoals !== 'undefined') {
      pulseGoals.push({
        id: 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name: reminder.title,
        tasks: [],
        completed: false,
        _modifiedAt: Date.now()
      });
      if (typeof savePulseGoals === 'function') savePulseGoals();
      showToast('Added to Pulse goals', 'success');
    }
  } else if (action === 'focus') {
    showView('pulse'); // v28.8: Redirect to Pulse
    showToast('Added to Pulse', 'info');
  }
  dismissReminderPopup(remId);
}

function snoozeReminder(remId, minutes) {
  var reminders = getReminders();
  for (var i = 0; i < reminders.length; i++) {
    if (reminders[i].id === remId) {
      reminders[i].status = 'pending';
      reminders[i].snoozedUntil = Date.now() + (minutes * 60 * 1000);
      reminders[i]._modifiedAt = Date.now();
      break;
    }
  }
  saveReminders(reminders);
  enablePopupDismiss(remId);
  dismissReminderPopup(remId);
  showToast('Snoozed for ' + minutes + ' minutes', 'info');
}

function snoozeReminderTomorrow(remId) {
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  var reminders = getReminders();
  for (var i = 0; i < reminders.length; i++) {
    if (reminders[i].id === remId) {
      reminders[i].status = 'pending';
      reminders[i].snoozedUntil = tomorrow.getTime();
      reminders[i]._modifiedAt = Date.now();
      break;
    }
  }
  saveReminders(reminders);
  enablePopupDismiss(remId);
  dismissReminderPopup(remId);
  showToast('Snoozed until tomorrow 9 AM', 'info');
}

function completeReminder(remId) {
  var reminders = getReminders();
  for (var i = 0; i < reminders.length; i++) {
    if (reminders[i].id === remId) {
      reminders[i].status = 'completed';
      reminders[i].dismissed = true;
      reminders[i]._modifiedAt = Date.now();
      break;
    }
  }
  saveReminders(reminders);
  enablePopupDismiss(remId);
  dismissReminderPopup(remId);
  if (typeof renderFocusReminders === 'function') renderFocusReminders();
  showToast('Reminder completed', 'success');
}

// v20.10: Trigger sync from NC widget, refresh display
function triggerNCSync() {
  if (!firebaseUser) { showToast('Sign in to sync', 'info'); return; }
  var syncVal = document.getElementById('ncSyncValue');
  var syncBar = document.getElementById('ncSyncBar');
  var syncSub = document.getElementById('ncSyncSub');
  var syncIcon = document.querySelector('#ncWidgetSync .nc-widget-icon');
  if (syncVal) syncVal.textContent = 'Syncing...';
  if (syncIcon) syncIcon.style.animation = 'spin 1s linear infinite';
  try {
    // v25.0: Pull from cloud (write-through handles pushes)
    loadFromFirebaseV2(false).then(function() {
      if (syncVal) syncVal.textContent = 'Just now';
      if (syncBar) { syncBar.style.width = '0%'; syncBar.style.background = '#4ade80'; }
      if (syncSub) syncSub.textContent = 'Up to date';
      if (syncIcon) syncIcon.style.animation = '';
      showToast('Synced', 'success');
    }).catch(function() {
      if (syncVal) syncVal.textContent = 'Sync failed';
      if (syncIcon) syncIcon.style.animation = '';
    });
  } catch(e) {
    if (syncVal) syncVal.textContent = 'Sync failed';
    if (syncIcon) syncIcon.style.animation = '';
  }
}

// v20.5: NC Status Widgets
function renderNCWidgets() {
  try {
    // --- Sync Widget ---
    var syncVal = document.getElementById('ncSyncValue');
    var syncBar = document.getElementById('ncSyncBar');
    var syncSub = document.getElementById('ncSyncSub');
    if (syncVal) {
      var lastSync = localStorage.getItem('roweos_last_sync');
      if (lastSync) {
        try {
          // v25.2: Handle both epoch ms (numeric string) and ISO date strings
          var syncTs = parseInt(lastSync);
          var syncDate = !isNaN(syncTs) && String(syncTs).length >= 10 ? new Date(syncTs) : new Date(lastSync);
          if (isNaN(syncDate.getTime())) throw new Error('Invalid date');
          var now = new Date();
          var diffMs = now - syncDate;
          var diffMin = Math.floor(diffMs / 60000);
          if (diffMin < 1) syncVal.textContent = 'Just now';
          else if (diffMin < 60) syncVal.textContent = diffMin + 'm ago';
          else if (diffMin < 1440) syncVal.textContent = Math.floor(diffMin / 60) + 'h ago';
          else syncVal.textContent = Math.floor(diffMin / 1440) + 'd ago';
        } catch(e) { syncVal.textContent = 'Unknown'; }
      } else {
        syncVal.textContent = 'Not synced';
      }
      // v20.10: Sync status bar — 0% right after sync, grows with time
      var syncPct = 0;
      if (lastSync) {
        try {
          // v25.2: Handle both epoch ms and ISO date strings
          var _syncTsParsed = parseInt(lastSync);
          var _syncDateObj = !isNaN(_syncTsParsed) && String(_syncTsParsed).length >= 10 ? new Date(_syncTsParsed) : new Date(lastSync);
          var _syncAge = Math.floor((new Date() - _syncDateObj) / 60000);
          // 0% at sync, 100% after 60+ minutes
          syncPct = Math.min(100, Math.round((_syncAge / 60) * 100));
        } catch(e) {}
      } else {
        syncPct = 100; // Never synced
      }
      if (syncBar) {
        syncBar.style.width = syncPct + '%';
        syncBar.style.background = syncPct > 75 ? '#fbbf24' : syncPct > 0 ? '#60a5fa' : '#4ade80';
      }
      if (syncSub) {
        syncSub.textContent = syncPct === 0 ? 'Up to date' : (syncPct >= 100 ? 'Tap to sync' : '');
      }
    }

    // --- AI Activity Widget ---
    // v20.10: Also count task history (pipelines, automations) not just chat/studio runs
    var aiVal = document.getElementById('ncAiValue');
    var aiSub = document.getElementById('ncAiSub');
    if (aiVal) {
      var runsData = null;
      try { runsData = JSON.parse(localStorage.getItem('roweos_runs') || '{}'); } catch(e) {}
      var runs = (runsData && runsData.runs) ? runsData.runs : [];
      var cmds = (runsData && runsData.agentCommands) ? runsData.agentCommands : [];
      var todayStr = new Date().toISOString().substring(0, 10);
      var todayRuns = 0;
      var lastModel = '';
      for (var r = runs.length - 1; r >= 0; r--) {
        var runDate = (runs[r].timestamp || runs[r].date || '').substring(0, 10);
        if (runDate === todayStr) {
          todayRuns++;
          if (!lastModel && runs[r].model) lastModel = runs[r].model;
        }
      }
      for (var c = cmds.length - 1; c >= 0; c--) {
        var cmdDate = (cmds[c].timestamp || cmds[c].date || '').substring(0, 10);
        if (cmdDate === todayStr) {
          todayRuns++;
          if (!lastModel && cmds[c].model) lastModel = cmds[c].model;
        }
      }
      // v20.10: Count automation/pipeline executions from task history
      try {
        var taskHist = JSON.parse(localStorage.getItem('roweos_task_history') || '[]');
        for (var th = 0; th < taskHist.length; th++) {
          var thDate = (taskHist[th].timestamp || '').substring(0, 10);
          if (thDate === todayStr) todayRuns++;
        }
      } catch(e) {}
      aiVal.textContent = todayRuns + ' run' + (todayRuns !== 1 ? 's' : '') + ' today';
      if (aiSub) {
        if (lastModel) {
          var modelName = lastModel;
          try { if (typeof getModelDisplayName === 'function') modelName = getModelDisplayName(lastModel); } catch(e) {}
          aiSub.textContent = 'Last: ' + modelName;
        } else {
          aiSub.textContent = todayRuns === 0 ? 'No activity yet' : '';
        }
      }
    }

    // --- Automations Widget ---
    // v22.8: Use getMergedAutomations() — single source of truth with deletion filtering
    var autoVal = document.getElementById('ncAutoValue');
    var autoSub = document.getElementById('ncAutoSub');
    if (autoVal) {
      var _ncTasks = typeof getMergedAutomations === 'function' ? getMergedAutomations() : [];
      var enabled = _ncTasks.filter(function(t) { return t.enabled !== false; });
      autoVal.textContent = enabled.length + ' active';

      if (autoSub && enabled.length > 0) {
        var now = new Date();
        var _todayD = now.toISOString().substring(0, 10);
        var _nowMin = now.getHours() * 60 + now.getMinutes();
        var nearest = null;
        var nearestDiff = Infinity;
        for (var i = 0; i < enabled.length; i++) {
          var t = enabled[i];
          if (!t.time) continue;
          var parts = t.time.split(':');
          var _tMin = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
          var _isRecur = t.recurType && t.recurType !== 'none' && t.recurType !== 'once';
          var _mfn; // minutes from now
          if (t.recurType === 'custom') {
            // v20.10: Custom interval — find next fixed slot from base time
            var _cInt = t.recurInterval || 1;
            var _cUnit = t.recurUnit || 'days';
            if (_cUnit === 'hours' || _cUnit === 'minutes') {
              var _intMin = _cUnit === 'hours' ? _cInt * 60 : _cInt;
              // Fixed slots: baseTime, baseTime+interval, baseTime+2*interval...
              var _elapsed = _nowMin - _tMin;
              if (_elapsed < 0) _elapsed += 1440;
              var _remaining = _intMin - (_elapsed % _intMin);
              _mfn = _remaining >= _intMin ? 0 : _remaining;
            } else {
              // Days/weeks/months — use base time, wrap to next day if past
              _mfn = _tMin - _nowMin;
              if (_mfn < -2) _mfn += 1440;
            }
          } else if (_isRecur) {
            // Daily/weekly/monthly — next occurrence at base time
            _mfn = _tMin - _nowMin;
            if (_mfn < -2) _mfn += 1440;
          } else if (t.scheduledDate) {
            if (t.scheduledDate === _todayD) {
              _mfn = _tMin - _nowMin;
              if (_mfn < -2) _mfn = Infinity; // past
            } else if (t.scheduledDate > _todayD) {
              var _fd = new Date(t.scheduledDate + 'T' + t.time + ':00');
              _mfn = Math.round((_fd - now) / 60000);
            } else { _mfn = Infinity; }
          } else {
            _mfn = _tMin - _nowMin;
            if (_mfn < -2) _mfn += 1440;
          }
          if (_mfn >= 0 && _mfn < nearestDiff) {
            nearestDiff = _mfn;
            nearest = t;
          }
        }
        if (nearest && nearestDiff < Infinity) {
          var hrs = Math.floor(nearestDiff / 60);
          var mins = nearestDiff % 60;
          var timeStr = hrs > 0 ? hrs + 'h ' + mins + 'm' : mins + 'm';
          autoSub.textContent = 'Next: ' + timeStr;
          autoSub.title = nearest.name || nearest.prompt || 'Untitled';
        } else {
          autoSub.textContent = '';
        }
      } else if (autoSub) {
        autoSub.textContent = enabled.length === 0 ? 'None scheduled' : '';
      }
    }
    // --- Scheduler Clock Widget ---
    var clockVal = document.getElementById('ncClockValue');
    var clockSub = document.getElementById('ncClockSub');
    if (clockVal) {
      if (_schedulerLastCheck) {
        var _secAgo = Math.floor((Date.now() - _schedulerLastCheck) / 1000);
        var _secLeft = Math.max(0, 60 - _secAgo);
        clockVal.textContent = _secLeft + 's';
        if (clockSub) {
          var _lastTime = new Date(_schedulerLastCheck);
          var _hh = _lastTime.getHours();
          var _mm = _lastTime.getMinutes();
          var _ampm = _hh >= 12 ? 'PM' : 'AM';
          _hh = _hh % 12 || 12;
          clockSub.textContent = 'Last: ' + _hh + ':' + String(_mm).padStart(2, '0') + ' ' + _ampm;
        }
      } else {
        clockVal.textContent = 'Starting...';
        if (clockSub) clockSub.textContent = 'Engine initializing';
      }
    }
  } catch(e) {
    console.warn('[NC Widgets] Render error:', e);
  }
}

// ═══════════════════════════════════════════════════════════════
// v20.14: PUSH NOTIFICATIONS (Web Push API + Service Worker)
// ═══════════════════════════════════════════════════════════════

var VAPID_PUBLIC_KEY = 'BMLELzogi7u53W6RoxmX9tQo4Zwm_U-p262P4fyviFqIHKOvZ4Iqa74TajPjGg3G5c_k8S5IpKw4Hd4kto1gB4M';
var _pushSwRegistration = null;

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register('/sw.js').then(function(reg) {
    _pushSwRegistration = reg;
    if (ROWEOS_DEBUG) console.log('[Push] Service worker registered');
    return reg;
  }).catch(function(err) {
    console.warn('[Push] Service worker registration failed:', err);
    return null;
  });
}

function initPushNotifications() {
  if (!isPushSupported()) {
    updatePushNotificationUI('not-supported');
    return;
  }
  registerServiceWorker().then(function() {
    // Check current state
    var enabled = localStorage.getItem('roweos_push_enabled') === 'true';
    var toggle = document.getElementById('pushNotificationToggle');
    if (toggle) toggle.checked = enabled;
    if (enabled && Notification.permission === 'granted') {
      updatePushNotificationUI('enabled');
      var details = document.getElementById('pushNotificationDetails');
      if (details) details.style.display = 'block';
      // v20.14: Re-subscribe moved to completeFirebaseLogin() where firebaseUser is guaranteed set
    } else if (enabled && Notification.permission === 'denied') {
      updatePushNotificationUI('denied');
      if (toggle) toggle.checked = false;
      localStorage.setItem('roweos_push_enabled', 'false');
    } else {
      updatePushNotificationUI('disabled');
    }
  });
}

function updatePushNotificationUI(state) {
  var statusEl = document.getElementById('pushNotificationStatus');
  if (!statusEl) return;
  switch (state) {
    case 'not-supported':
      statusEl.textContent = 'Not available on this device';
      statusEl.style.color = '';
      break;
    case 'enabled':
      statusEl.textContent = 'Enabled: you will receive push notifications';
      statusEl.style.color = '#4ade80';
      break;
    case 'denied':
      statusEl.textContent = 'Blocked by browser: enable in device settings';
      statusEl.style.color = '#ef4444';
      break;
    case 'disabled':
      statusEl.textContent = 'Not enabled';
      statusEl.style.color = '';
      break;
    case 'subscribing':
      statusEl.textContent = 'Setting up...';
      statusEl.style.color = '#a89878';
      break;
    default:
      statusEl.textContent = state;
      statusEl.style.color = '';
  }
}

function togglePushNotifications(enabled) {
  if (enabled) {
    if (!isPushSupported()) {
      showToast('Push notifications are not supported on this device', 'warning');
      var toggle = document.getElementById('pushNotificationToggle');
      if (toggle) toggle.checked = false;
      return;
    }
    updatePushNotificationUI('subscribing');
    subscribeToPush();
  } else {
    unsubscribeFromPush();
    localStorage.setItem('roweos_push_enabled', 'false');
    updatePushNotificationUI('disabled');
    var details = document.getElementById('pushNotificationDetails');
    if (details) details.style.display = 'none';
  }
}

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function subscribeToPush(silent) {
  if (!_pushSwRegistration) {
    registerServiceWorker().then(function(reg) {
      if (reg) subscribeToPush(silent);
      else {
        if (!silent) showToast('Service worker not available', 'error');
        var toggle = document.getElementById('pushNotificationToggle');
        if (toggle && !silent) toggle.checked = false;
        if (!silent) updatePushNotificationUI('disabled');
      }
    });
    return;
  }

  // v20.16: Step-by-step push subscription with diagnostics
  var _pushSilent = silent;
  var _pushFail = function(step, err) {
    console.error('[Push] Step ' + step + ' failed:', err);
    if (!_pushSilent) showToast('Push failed at step ' + step + ': ' + (err.message || err), 'error');
    var toggle = document.getElementById('pushNotificationToggle');
    if (toggle && !_pushSilent) toggle.checked = false;
    if (!_pushSilent) updatePushNotificationUI('disabled');
  };

  // Step 0: Fetch VAPID public key from server (guarantees match with private key)
  var step = 0;
  fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'vapidkey' })
  }).then(function(resp) {
    if (!resp.ok) throw new Error('Failed to fetch VAPID key: ' + resp.status);
    return resp.json();
  }).then(function(keyData) {
    var serverVapidKey = keyData.vapidKey;
    if (!serverVapidKey) throw new Error('Server returned no VAPID key');

    // v20.16: Log if server key differs from hardcoded constant
    if (serverVapidKey !== VAPID_PUBLIC_KEY) {
      console.warn('[Push] Server VAPID key differs from hardcoded! Using server key.');
      console.log('[Push] Server:    ' + serverVapidKey.substring(0, 30) + '...');
      console.log('[Push] Hardcoded: ' + VAPID_PUBLIC_KEY.substring(0, 30) + '...');
    } else {
      console.log('[Push] VAPID key verified: server matches hardcoded');
    }

    // Step 1: Request permission
    step = 1;
    return Notification.requestPermission().then(function(permission) {
      if (permission !== 'granted') {
        if (!_pushSilent) showToast('Notification permission denied', 'warning');
        var toggle = document.getElementById('pushNotificationToggle');
        if (toggle && !_pushSilent) toggle.checked = false;
        if (!_pushSilent) updatePushNotificationUI(permission === 'denied' ? 'denied' : 'disabled');
        return;
      }

      // Step 2: Get existing subscription
      step = 2;
      return _pushSwRegistration.pushManager.getSubscription().then(function(existingSub) {
        // Step 3: Unsubscribe if exists
        step = 3;
        if (existingSub) {
          console.log('[Push] Clearing existing subscription');
          return existingSub.unsubscribe();
        }
        return Promise.resolve();
      }).then(function() {
        // Step 4: Create new subscription with SERVER's VAPID key
        step = 4;
        var keyArray;
        try {
          keyArray = urlBase64ToUint8Array(serverVapidKey);
          console.log('[Push] Key converted, length:', keyArray.length, 'first byte:', keyArray[0]);
        } catch(keyErr) {
          _pushFail('4a-key', keyErr);
          return;
        }
        return _pushSwRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyArray
        });
      }).then(function(subscription) {
        if (!subscription) return; // failed at step 4a
        // Step 5: Send to server
        step = 5;
        var subJson = subscription.toJSON();
        var uid = '';
        try { if (firebaseUser) uid = firebaseUser.uid; } catch(e) {}
        if (!uid) {
          if (!_pushSilent) showToast('Sign in to enable push notifications', 'warning');
          var toggle = document.getElementById('pushNotificationToggle');
          if (toggle && !_pushSilent) toggle.checked = false;
          if (!_pushSilent) updatePushNotificationUI('disabled');
          return;
        }
        console.log('[Push] Subscribing: uid=' + uid + ' endpoint=' + (subJson.endpoint || '').substring(0, 60));
        return fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'subscribe', uid: uid, subscription: subJson })
        }).then(function(resp) {
          step = 6;
          if (!resp.ok) {
            return resp.text().then(function(txt) {
              throw new Error('Server ' + resp.status + ': ' + txt.substring(0, 100));
            });
          }
          return resp.json();
        }).then(function(data) {
          step = 7;
          console.log('[Push] Subscribe response:', JSON.stringify(data));
          if (data.success) {
            localStorage.setItem('roweos_push_enabled', 'true');
            localStorage.setItem('roweos_push_endpoint', subJson.endpoint);
            updatePushNotificationUI('enabled');
            var details = document.getElementById('pushNotificationDetails');
            if (details) details.style.display = 'block';
            if (!_pushSilent) showToast('Push notifications enabled', 'success');
          } else {
            _pushFail('7-server', { message: data.error || 'Unknown server error' });
          }
        });
      });
    });
  }).catch(function(err) {
    _pushFail(step, err);
  });
}

function unsubscribeFromPush() {
  if (!_pushSwRegistration) return;
  _pushSwRegistration.pushManager.getSubscription().then(function(subscription) {
    if (!subscription) return;
    var endpoint = subscription.endpoint;
    subscription.unsubscribe().then(function() {
      // Remove from server
      var uid = '';
      try { if (firebaseUser) uid = firebaseUser.uid; } catch(e) {}
      if (uid) {
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unsubscribe', uid: uid, endpoint: endpoint })
        }).catch(function() {});
      }
      localStorage.removeItem('roweos_push_endpoint');
      showToast('Push notifications disabled', 'info');
    });
  });
}

function sendTestPushNotification() {
  var uid = '';
  try { if (firebaseUser) uid = firebaseUser.uid; } catch(e) {}
  if (!uid) { showToast('Sign in to test notifications', 'warning'); return; }

  // v20.16: Reset all old subscriptions first, then re-subscribe fresh, then test
  showToast('Resetting push subscriptions...', 'info');
  fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset', uid: uid })
  }).then(function(resp) { return resp.json(); }).then(function(resetData) {
    console.log('[Push] Reset result:', JSON.stringify(resetData));
    var serverVapidKey = (resetData && resetData.vapidKey) || VAPID_PUBLIC_KEY;

    showToast('Re-subscribing with fresh key...', 'info');
    // Unsubscribe from browser push manager first
    return _pushSwRegistration.pushManager.getSubscription().then(function(existingSub) {
      if (existingSub) return existingSub.unsubscribe();
    }).then(function() {
      // Subscribe with server's VAPID key
      return _pushSwRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(serverVapidKey)
      });
    }).then(function(subscription) {
      var subJson = subscription.toJSON();
      console.log('[Push] Fresh subscription: endpoint=' + (subJson.endpoint || '').substring(0, 60));
      // Store subscription on server
      return fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subscribe', uid: uid, subscription: subJson })
      }).then(function(subResp) { return subResp.json(); });
    }).then(function(subData) {
      console.log('[Push] Subscribe result:', JSON.stringify(subData));
      if (!subData.success) {
        showToast('Subscribe failed: ' + (subData.error || 'Unknown'), 'error');
        return;
      }
      // Now send test
      showToast('Sending test notification...', 'info');
      return fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', uid: uid })
      }).then(function(testResp) { return testResp.json(); }).then(function(data) {
        if (data.success && data.sent > 0) {
          showToast('Test notification sent!', 'success');
        } else {
          showToast('Push failed: sent=' + data.sent + ' failed=' + data.failed + '. Check Vercel logs.', 'error');
        }
      });
    });
  }).catch(function(err) {
    // v20.15: iOS PWA drops fetch when backgrounded — retry once
    if (err.message === 'Load failed' && !sendTestPushNotification._retried) {
      sendTestPushNotification._retried = true;
      showToast('Retrying...', 'info');
      setTimeout(function() { sendTestPushNotification(); }, 1500);
      return;
    }
    sendTestPushNotification._retried = false;
    showToast('Test failed: ' + err.message, 'error');
  });
  sendTestPushNotification._retried = false;
}

// v20.16: Force re-subscribe then retry test notification (fetches VAPID key from server)
function _pushResubscribeAndRetryTest(uid) {
  if (!_pushSwRegistration) {
    registerServiceWorker().then(function(reg) {
      if (reg) _pushResubscribeAndRetryTest(uid);
      else showToast('Service worker not available', 'error');
    });
    return;
  }

  // v20.16: Fetch VAPID key from server first
  fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'vapidkey' })
  }).then(function(resp) { return resp.json(); }).then(function(keyData) {
    var vapidKey = keyData.vapidKey || VAPID_PUBLIC_KEY;
    console.log('[Push] Re-subscribe: using server VAPID key, len=' + vapidKey.length);

    // Clear existing subscription first
    return _pushSwRegistration.pushManager.getSubscription().then(function(existingSub) {
      if (existingSub) {
        console.log('[Push] Re-subscribe: clearing existing subscription');
        return existingSub.unsubscribe();
      }
    }).then(function() {
      return _pushSwRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    });
  }).then(function(subscription) {
    var subJson = subscription.toJSON();
    console.log('[Push] Re-subscribe: endpoint=' + (subJson.endpoint || '').substring(0, 60) + '...');
    console.log('[Push] Re-subscribe: uid=' + uid);

    return fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'subscribe', uid: uid, subscription: subJson })
    }).then(function(resp) { return resp.json(); }).then(function(data) {
      console.log('[Push] Re-subscribe response:', JSON.stringify(data));
      if (data.success) {
        showToast('Re-registered. Sending test...', 'info');
        // Retry test after brief delay
        setTimeout(function() {
          fetch('/api/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test', uid: uid })
          }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.success && d.sent > 0) {
              showToast('Test notification sent (' + d.sent + ' device' + (d.sent === 1 ? '' : 's') + ')', 'success');
            } else {
              showToast('Still 0 devices: check Vercel logs for push API errors', 'error');
            }
          }).catch(function(e) { showToast('Retry failed: ' + e.message, 'error'); });
        }, 1500);
      } else {
        showToast('Re-register failed: ' + (data.error || 'Unknown'), 'error');
      }
    });
  }).catch(function(err) {
    console.error('[Push] Re-subscribe failed:', err);
    showToast('Push subscription failed: ' + err.message, 'error');
  });
}

// Send push notification from client (used by addNotification to also push)
function sendPushNotification(title, message, opts) {
  if (localStorage.getItem('roweos_push_enabled') !== 'true') return;
  var uid = '';
  try { if (firebaseUser) uid = firebaseUser.uid; } catch(e) {}
  if (!uid) return;

  fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send',
      uid: uid,
      title: title || 'RoweOS',
      message: message || '',
      tag: (opts && opts.tag) || '',
      url: (opts && opts.url) || '/',
      type: (opts && opts.type) || 'general'
    })
  }).catch(function() {});
}

// v19.6: Notification Center
var _lastSyncNotifTime = 0;

function getNotifications() {
  try {
    var raw = localStorage.getItem('roweos_notifications');
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveNotifications(arr) {
  try {
    localStorage.setItem('roweos_notifications', JSON.stringify(arr));
  } catch(e) {
    // Quota fallback — trim to 50
    try {
      localStorage.setItem('roweos_notifications', JSON.stringify(arr.slice(0, 50)));
    } catch(e2) {}
  }
}

function addNotification(type, title, message, data) {
  var notifs = getNotifications();
  // v23.17: Deduplicate — skip if same task created a notification within last 5 minutes
  if (data && data.taskId) {
    var _dupeWindow = 5 * 60 * 1000;
    var _now = Date.now();
    for (var _di = 0; _di < Math.min(notifs.length, 20); _di++) {
      var _dn = notifs[_di];
      if (_dn.data && _dn.data.taskId === data.taskId && _dn.title === title && (_now - _dn.timestamp) < _dupeWindow) {
        if (localStorage.getItem('roweos_debug') === 'true') console.log('[Notifications] Skipping duplicate:', title, data.taskId);
        return _dn;
      }
    }
  }
  // v20.17: Use data.timestamp if provided (cloud results pass execution time)
  var ts = (data && data.timestamp) ? new Date(data.timestamp).getTime() : Date.now();
  if (isNaN(ts)) ts = Date.now();
  var notif = {
    id: ts + '_' + Math.random().toString(36).substr(2, 6),
    type: type || 'info',
    title: title || '',
    message: message || '',
    timestamp: ts,
    read: false,
    data: data || {}
  };
  notifs.unshift(notif);
  if (notifs.length > 100) notifs = notifs.slice(0, 100);
  saveNotifications(notifs);
  updateNotificationBadge();
  if (isNotificationPanelOpen()) renderNotificationPanelContent();
  // v23.10: Only send push when app is backgrounded AND not for automation/pipeline results
  // (user-triggered automations already show toasts; push spam on other devices is bad UX)
  var _pushSkipTypes = ['pipeline', 'automation', 'sync'];
  if (document.hidden && _pushSkipTypes.indexOf(type) === -1) {
    sendPushNotification(title, message, { type: type, tag: 'roweos-' + type });
  }
  return notif;
}

function clearNotification(id) {
  var notifs = getNotifications().filter(function(n) { return n.id !== id; });
  saveNotifications(notifs);
  updateNotificationBadge();
  if (isNotificationPanelOpen()) renderNotificationPanelContent();
}

function clearAllNotifications() {
  saveNotifications([]);
  updateNotificationBadge();
  if (isNotificationPanelOpen()) renderNotificationPanelContent();
}

function getUnreadCount() {
  var lastSeen = parseInt(localStorage.getItem('roweos_notifications_last_seen') || '0');
  var notifs = getNotifications();
  var count = 0;
  for (var i = 0; i < notifs.length; i++) {
    if (notifs[i].timestamp > lastSeen) count++;
  }
  return count;
}

function markAllNotificationsRead() {
  localStorage.setItem('roweos_notifications_last_seen', String(Date.now()));
  updateNotificationBadge();
}

function updateNotificationBadge() {
  var count = getUnreadCount();
  // Only update the main notification center badges (not per-view badges)
  var ncBadge = document.getElementById('ncBadgeSidebar');
  if (ncBadge) {
    if (count > 0) ncBadge.classList.add('has-unread');
    else ncBadge.classList.remove('has-unread');
  }
  // Also update mobile NC badge if exists
  var ncMobile = document.getElementById('ncBadgeMobile');
  if (ncMobile) {
    if (count > 0) ncMobile.classList.add('has-unread');
    else ncMobile.classList.remove('has-unread');
  }
}

// v24.13: Per-view sidebar notification dots
function updateSidebarBadges() {
  // Automations: check for completed automations since last viewed
  try {
    var autoBadge = document.getElementById('ncBadgeAutomations');
    if (autoBadge) {
      var lastSeen = parseInt(localStorage.getItem('roweos_automations_last_seen') || '0');
      var completed = [];
      try { completed = JSON.parse(localStorage.getItem('roweos_completed_automations') || '[]'); } catch(e) {}
      var hasNew = completed.some(function(c) { return new Date(c.completedAt).getTime() > lastSeen; });
      if (hasNew) autoBadge.classList.add('has-unread');
      else autoBadge.classList.remove('has-unread');
    }
  } catch(e) {}
  // Mail: check for unread inbox messages
  try {
    var mailBadge = document.getElementById('ncBadgeMail');
    if (mailBadge) {
      var hasUnread = false;
      if (typeof _mailCurrentMessages !== 'undefined' && _mailCurrentMessages) {
        var accounts = Object.keys(_mailCurrentMessages);
        for (var i = 0; i < accounts.length; i++) {
          var msgs = _mailCurrentMessages[accounts[i]] || [];
          if (msgs.some(function(m) { return m.isUnread; })) { hasUnread = true; break; }
        }
      }
      // Also check outbox for pending items
      if (!hasUnread) {
        try {
          var outbox = JSON.parse(localStorage.getItem('roweos_mail_outbox') || '[]');
          if (outbox.length > 0) hasUnread = true;
        } catch(e) {}
      }
      if (hasUnread) mailBadge.classList.add('has-unread');
      else mailBadge.classList.remove('has-unread');
    }
  } catch(e) {}
}

// Mark automations as seen when view opens
function markAutomationsViewed() {
  localStorage.setItem('roweos_automations_last_seen', String(Date.now()));
  var badge = document.getElementById('ncBadgeAutomations');
  if (badge) badge.classList.remove('has-unread');
}

function isNotificationPanelOpen() {
  var panel = document.getElementById('notificationCenterPanel');
  return panel && panel.classList.contains('open');
}

function toggleNotificationPanel() {
  // v25.2: On desktop, use search side panel instead
  if (window.innerWidth > 768) {
    var panel = document.getElementById('searchSidePanel');
    if (panel && panel.classList.contains('open')) { closeSearchPanel(); return; }
    openSearchPanel('notifications');
    return;
  }
  if (isNotificationPanelOpen()) {
    closeNotificationPanel();
  } else {
    openNotificationPanel();
  }
}

function openNotificationPanel() {
  var scrim = document.getElementById('ncScrim');
  var panel = document.getElementById('notificationCenterPanel');
  if (!scrim || !panel) return;
  renderNCWidgets();
  renderNotificationPanelContent();
  scrim.classList.add('open');
  panel.classList.add('open');
  markAllNotificationsRead();
}

function closeNotificationPanel() {
  var scrim = document.getElementById('ncScrim');
  var panel = document.getElementById('notificationCenterPanel');
  if (scrim) scrim.classList.remove('open');
  if (panel) panel.classList.remove('open');
}

function renderNotificationPanelContent() {
  var body = document.getElementById('ncBody');
  if (!body) return;

  var notifs = getNotifications();
  if (notifs.length === 0) {
    body.innerHTML = '<div class="nc-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>' +
      '<path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<div class="nc-empty-title">No notifications</div>' +
      '<div class="nc-empty-desc">Automation results and events will appear here</div>' +
      '</div>';
    return;
  }

  var lastSeen = parseInt(localStorage.getItem('roweos_notifications_last_seen') || '0');
  var awaySince = parseInt(localStorage.getItem('roweos_notifications_away_since') || '0');
  var awayNotifs = [];
  var recentNotifs = [];

  for (var i = 0; i < notifs.length; i++) {
    if (awaySince > 0 && notifs[i].timestamp > awaySince) {
      awayNotifs.push(notifs[i]);
    } else {
      recentNotifs.push(notifs[i]);
    }
  }

  var html = '';
  if (awayNotifs.length > 0) {
    html += '<div class="nc-section-title">While You Were Away</div>';
    for (var a = 0; a < awayNotifs.length; a++) {
      html += renderNotificationCard(awayNotifs[a], lastSeen);
    }
  }
  if (recentNotifs.length > 0) {
    html += '<div class="nc-section-title">Recent</div>';
    for (var r = 0; r < recentNotifs.length; r++) {
      html += renderNotificationCard(recentNotifs[r], lastSeen);
    }
  }
  body.innerHTML = html;
}

function renderNotificationCard(notif, lastSeen) {
  var isUnread = notif.timestamp > lastSeen;
  var iconClass = '';
  var iconSvg = '';
  var isClickable = false;

  switch (notif.type) {
    case 'cloud_result':
      if (notif.data && notif.data.success === false) {
        iconClass = 'nc-icon-fail';
        iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>';
      } else {
        iconClass = 'nc-icon-success';
        iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>';
      }
      isClickable = !!(notif.data && notif.data.taskId);
      break;
    case 'sync':
      iconClass = 'nc-icon-sync';
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2.5 11.5a10 10 0 0 1 18.42-4.5M21.5 12.5a10 10 0 0 1-18.42 4.5"/></svg>';
      break;
    case 'brand_switch':
      iconClass = 'nc-icon-brand';
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
      break;
    case 'pipeline':
      iconClass = 'nc-icon-pipeline';
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';
      isClickable = !!(notif.data && notif.data.taskId);
      break;
    default:
      iconClass = 'nc-icon-sync';
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
  }

  var timeStr = '';
  try { timeStr = getTimeAgo(new Date(notif.timestamp)); } catch(e) { timeStr = ''; }

  var clickAttr = '';
  if (isClickable) {
    clickAttr = ' onclick="ncCardClick(\'' + escapeHtml(notif.data.taskId || '') + '\')"';
  }

  return '<div class="nc-card' + (isUnread ? ' unread' : '') + (isClickable ? ' nc-clickable' : '') + '"' + clickAttr + '>' +
    '<div class="nc-card-icon ' + iconClass + '">' + iconSvg + '</div>' +
    '<div class="nc-card-content">' +
    '<div class="nc-card-title">' + escapeHtml(notif.title) + '</div>' +
    '<div class="nc-card-message">' + escapeHtml(notif.message) + '</div>' +
    (timeStr ? '<div class="nc-card-time">' + escapeHtml(timeStr) + '</div>' : '') +
    '</div>' +
    '<button class="nc-card-delete" onclick="event.stopPropagation(); clearNotification(\'' + notif.id + '\')" aria-label="Delete">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
    '</button>' +
    '</div>';
}

// v20.6: Navigate to Automations → Executions tab with history, show result detail
function ncCardClick(taskId) {
  if (!taskId) return;
  closeNotificationPanel();
  // Navigate to Automations view → Executions tab
  showView('automations');
  setTimeout(function() {
    showAutoLabTab('scheduler');
    // Highlight the relevant history entry after render
    setTimeout(function() {
      var histEl = document.getElementById('autoLabHistoryEntry_' + taskId);
      if (histEl) {
        histEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        histEl.style.outline = '2px solid var(--brand-accent, #a89878)';
        histEl.style.outlineOffset = '2px';
        setTimeout(function() { histEl.style.outline = 'none'; }, 3000);
      }
    }, 300);
  }, 100);
}

// Loading Overlay
function showLoading(message) {
  message = message || 'Loading...';
  
  var overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div><div class="loading-spinner"></div><div class="loading-text">' + message + '</div></div>';
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('.loading-text').textContent = message;
    overlay.style.display = 'flex';
  }
}

function hideLoading() {
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Keyboard Event Handler
document.addEventListener('keydown', function(e) {
  // Cmd/Ctrl + K = Search
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
  }

  // v25.1: Cmd/Ctrl + = or + = zoom in; Cmd/Ctrl + - = zoom out (interface zoom)
  if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
    if (!(e.target && (e.target.matches('input, textarea') || e.target.isContentEditable || (e.target.closest && e.target.closest('[contenteditable]'))))) {
      e.preventDefault();
      try {
        var _curZoom = parseInt(localStorage.getItem('roweos_app_zoom') || '100') || 100;
        var _newZoom = Math.min(150, _curZoom + 5);
        if (typeof setAppZoom === 'function') setAppZoom(_newZoom);
      } catch(e2) {}
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '-') {
    if (!(e.target && (e.target.matches('input, textarea') || e.target.isContentEditable || (e.target.closest && e.target.closest('[contenteditable]'))))) {
      e.preventDefault();
      try {
        var _curZoom2 = parseInt(localStorage.getItem('roweos_app_zoom') || '100') || 100;
        var _newZoom2 = Math.max(75, _curZoom2 - 5);
        if (typeof setAppZoom === 'function') setAppZoom(_newZoom2);
      } catch(e3) {}
    }
  }
  
  // Cmd/Ctrl + N = New Brand (only when not typing)
  if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !(e.target && (e.target.matches('input, textarea') || e.target.isContentEditable || (e.target.closest && e.target.closest('[contenteditable]'))))) {
    e.preventDefault();
    openModal('addBrandModal');
  }

  // Cmd/Ctrl + E = Edit Brand (only when not typing)
  if ((e.metaKey || e.ctrlKey) && e.key === 'e' && !(e.target && (e.target.matches('input, textarea') || e.target.isContentEditable || (e.target.closest && e.target.closest('[contenteditable]'))))) {
    e.preventDefault();
    openEditBrandModal();
  }
  
  // Cmd/Ctrl + B = Bold in contenteditable, or Focus Brand Selector otherwise
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
    if (e.target && e.target.isContentEditable) {
      // v23.2: Let browser handle Ctrl+B for bold in contenteditable
      return;
    }
    e.preventDefault();
    var selector = document.getElementById('brandSelector');
    if (selector) selector.focus();
  }
  // v23.2: Ctrl+I/U in contenteditable — let browser handle natively
  if ((e.metaKey || e.ctrlKey) && (e.key === 'i' || e.key === 'u')) {
    if (e.target && e.target.isContentEditable) return;
  }
  
  // Cmd/Ctrl + \ = Toggle Sidebar
  if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
    e.preventDefault();
    toggleSidebar();
  }
  
  // ? = Show Shortcuts (when not in input)
  if (e.key === '?' && !e.target.matches('input, textarea') && !(e.target.isContentEditable || (e.target.closest && e.target.closest('[contenteditable]')))) {
    e.preventDefault();
    openShortcuts();
  }
  
  // ESC = Close overlays
  if (e.key === 'Escape') {
    if (typeof isNotificationPanelOpen === 'function' && isNotificationPanelOpen()) {
      closeNotificationPanel();
      return;
    }
    closeSearch();
    closeShortcuts();
    closeModal('addBrandModal');
    closeModal('editBrandModal');
    closeModal('deleteBrandModal');
    closeModal('importExportModal');
  }
  
  // v25.1: Guard — never trigger navigation shortcuts while typing in any editable field
  var _isEditing = e.target && (e.target.matches('input, textarea') || e.target.isContentEditable || (e.target.closest && e.target.closest('[contenteditable]')));

  // G then B = Go to BrandAI
  if (lastKey === 'g' && e.key === 'b' && !_isEditing) {
    e.preventDefault();
    showView('agent');
    lastKey = '';
  }

  // G then S = Go to Studio
  if (lastKey === 'g' && e.key === 's' && !_isEditing) {
    e.preventDefault();
    showView('studio');
    lastKey = '';
  }

  // G then D = Go to Pulse (Dashboard) // v28.8: Redirect to Pulse
  if (lastKey === 'g' && e.key === 'd' && !_isEditing) {
    e.preventDefault();
    showView('pulse');
    lastKey = '';
  }

  // Remember last key for sequences
  if (e.key === 'g' && !_isEditing) {
    lastKey = 'g';
    setTimeout(function() { lastKey = ''; }, 1000);
  }
});

var lastKey = '';

// Add toast slide out animation
var style = document.createElement('style');
style.textContent = '@keyframes toastSlideOut { to { transform: translateX(400px); opacity: 0; } }';
document.head.appendChild(style);


