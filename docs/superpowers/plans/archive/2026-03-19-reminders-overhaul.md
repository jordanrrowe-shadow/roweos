# Reminders Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade reminders with scheduled notifications (in-app popups + push), action buttons (Talk to AI, Add to Pulse, Snooze, Complete), bottom-right stacking, and "can't dismiss until actioned" behavior.

**Architecture:** Upgrade the reminder data model to include `scheduledAt` and `status`. Add an in-app scheduler (`setInterval` every 30s) that checks for due reminders and fires bottom-right popup notifications. Wire into existing Web Push infrastructure for background delivery. Action buttons route to existing RoweOS features. Focus widget renders expanded on mobile by default.

**Tech Stack:** Vanilla ES5 JavaScript, existing Web Push (VAPID + sw.js), single-file HTML app

**Spec:** `/Volumes/roweOS/docs/superpowers/specs/2026-03-19-reminders-overhaul-spec.md`

**Critical Constraints:**
- ES5 only (no arrow functions, let/const, template literals)
- All edits in `/Volumes/roweOS/RoweOS/dist/index.html` (plus `sw.js` update)
- No emojis in UI -- SVG icons only
- No em-dashes in UI text

---

## File Structure

- **Modify:** `/Volumes/roweOS/RoweOS/dist/index.html`
- **Modify:** `/Volumes/roweOS/RoweOS/dist/sw.js`

Key existing locations:
| Function | Line | Purpose |
|----------|------|---------|
| `getReminders()` | ~157675 | Get from localStorage |
| `saveReminders()` | ~157679 | Save + write-through |
| `saveReminderToHistory()` | ~157686 | Create new reminder |
| `renderFocusReminders()` | ~157730 | Render Focus widget |
| `submitInlineReminder()` | ~157774 | Inline add form handler |
| Push notification code | ~157349 | VAPID, service worker |
| `sw.js` | Separate file | Push event handler |

---

### Task 1: Add Reminder Popup CSS

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- CSS section

- [ ] **Step 1: Add popup notification CSS**

Find the Focus CSS section (search for `.focus-2-` CSS). Add nearby:

```css
/* v25.2: Reminder Notification Popups */
.reminder-popup-container { position:fixed;bottom:20px;right:20px;z-index:9990;display:flex;flex-direction:column-reverse;gap:8px;max-height:80vh;pointer-events:none; }
.reminder-popup { pointer-events:all;width:360px;background:var(--bg-primary,#141414);border:1px solid var(--border-color,#2a2a2a);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.6);padding:16px;opacity:0;transform:translateX(20px);transition:all 0.25s ease; }
.reminder-popup.visible { opacity:1;transform:translateX(0); }
.reminder-popup-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px; }
.reminder-popup-label { font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:var(--accent,#a89878);font-weight:600; }
.reminder-popup-close { background:none;border:none;color:var(--text-tertiary,#444);cursor:not-allowed;padding:4px;opacity:0.3; }
.reminder-popup-close.enabled { color:var(--text-secondary,#888);cursor:pointer;opacity:1; }
.reminder-popup-title { font-size:15px;font-weight:500;color:var(--text-primary,#f4f4f5);margin-bottom:4px; }
.reminder-popup-time { font-size:12px;color:var(--text-tertiary,#666);margin-bottom:12px; }
.reminder-popup-time.overdue { color:#f87171; }
.reminder-popup-actions { display:flex;flex-wrap:wrap;gap:6px; }
.reminder-popup-btn { padding:6px 12px;font-size:11px;border-radius:8px;border:1px solid var(--border-color,#333);background:var(--bg-secondary,#1a1a1a);color:var(--text-secondary,#999);cursor:pointer;transition:all 0.15s;white-space:nowrap; }
.reminder-popup-btn:hover { border-color:var(--accent,#a89878);color:var(--text-primary,#f4f4f5); }
.reminder-popup-btn.primary { background:var(--accent,#a89878);color:#000;border-color:var(--accent,#a89878); }
.reminder-popup-snooze-menu { position:absolute;bottom:100%;right:0;background:var(--bg-primary,#141414);border:1px solid var(--border-color,#2a2a2a);border-radius:10px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.5);display:none;min-width:140px; }
.reminder-popup-snooze-menu.open { display:block; }
.reminder-popup-snooze-option { padding:8px 12px;font-size:12px;color:var(--text-secondary,#999);cursor:pointer;border-radius:6px; }
.reminder-popup-snooze-option:hover { background:var(--bg-secondary,#1a1a1a);color:var(--text-primary); }
@media (max-width:768px) { .reminder-popup-container { left:12px;right:12px;bottom:80px; } .reminder-popup { width:auto; } }
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(reminders): add notification popup CSS v25.2"
```

---

### Task 2: Upgrade Data Model + Save Functions

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- reminder functions (~line 157675)

- [ ] **Step 1: Upgrade `saveReminderToHistory()` to use new data model**

Find `function saveReminderToHistory` (~line 157686). Replace with:

```javascript
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
```

- [ ] **Step 2: Upgrade `submitInlineReminder()` to require datetime**

Find `function submitInlineReminder` (~line 157774). Replace with:

```javascript
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
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(reminders): upgrade data model with scheduledAt, status, actions v25.2"
```

---

### Task 3: Build Reminder Popup System

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- after existing reminder functions

- [ ] **Step 1: Add popup container HTML**

Find a suitable place in the HTML (before `</body>` or near other fixed overlays). Add:

```html
<div class="reminder-popup-container" id="reminderPopupContainer"></div>
```

- [ ] **Step 2: Add popup functions**

Insert after `submitInlineReminder()`:

```javascript
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
    showView('signal');
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
    showView('signal');
    if (typeof showScreen === 'function') showScreen('focus');
    showToast('Open Focus to add task', 'info');
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
```

- [ ] **Step 3: Start the checker on app init**

Find the main init function (search for `function init()` or where the app initializes). Add at the end:

```javascript
  // v25.2: Start reminder checker
  if (typeof startReminderChecker === 'function') startReminderChecker();
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(reminders): notification popup system with actions, snooze, complete v25.2"
```

---

### Task 4: Upgrade Focus Widget + Mobile Expand

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- `renderFocusReminders()` (~line 157730)

- [ ] **Step 1: Upgrade `renderFocusReminders()` with new card design**

Find `function renderFocusReminders()`. Replace the entire function with:

```javascript
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
```

- [ ] **Step 2: Ensure reminders widget is expanded by default on mobile**

Find the Focus widget config for reminders. Search for `data-widget="reminders"` and check if there's a mobile collapse/expand state. Ensure the widget renders expanded (not behind "Customize") on mobile. Search for `focus.*customize` or `focus.*widget.*expand` near mobile CSS and make sure reminders don't require clicking "Customize" first.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(reminders): upgraded Focus widget with scheduled times, overdue indicators, complete button v25.2"
```

---

### Task 5: Update Service Worker + Deploy

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/sw.js`
- Deploy via `deploy.sh`

- [ ] **Step 1: Update service worker to handle reminder-type push**

Find `/Volumes/roweOS/RoweOS/dist/sw.js`. In the `notificationclick` handler, add reminder-specific handling:

After the existing `clients.openWindow(url)` call, the current code is sufficient -- it opens RoweOS on click. The push payload already supports `{type: "reminder", reminderId: "..."}`. The in-app code will check for pending fired reminders on load.

No changes needed to `sw.js` at this point -- the existing handler works. The push payload just needs to include `type: "reminder"` which is already supported by the data structure.

- [ ] **Step 2: Add popup container to HTML**

Find `</body>` tag. Add before it:

```html
<div class="reminder-popup-container" id="reminderPopupContainer"></div>
```

- [ ] **Step 3: Deploy**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html RoweOS/dist/sw.js && git commit -m "feat(reminders): Reminders Overhaul complete -- scheduled notifications, popups, actions, snooze v25.2

Reminders fire as bottom-right popup notifications when scheduled
time arrives. Action buttons: Talk to AI, Add to Pulse, Add to Focus,
Snooze (15m/30m/1h/3h/tomorrow), Complete. Can't dismiss until
action taken. Focus widget shows overdue indicators and relative times.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>" && bash deploy.sh
```
