# Calendar Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visual overhaul of the Rhythm calendar with horizontal event cards, color-coded borders per calendar source, a "Calendars" toggle panel, calendar picker on event creation, +N badge for overflow events, and write-back to Outlook (MS Graph) and iCloud (CalDAV via serverless proxy).

**Architecture:** Upgrade `renderCalendar()` to use horizontal card layout with color borders from `roweos_calendar_colors`. Add a "Calendars" button in the Rhythm header that opens a toggleable panel. Extend event creation modal with "Push to" calendar dropdown. Add Outlook write-back via Microsoft Graph API and iCloud write-back via CalDAV proxied through a Vercel serverless function.

**Tech Stack:** Vanilla ES5 JavaScript, Google Calendar API v3, Microsoft Graph API, CalDAV, Vercel serverless functions, single-file HTML app

**Spec:** `/Volumes/roweOS/docs/superpowers/specs/2026-03-19-calendar-overhaul-spec.md`

**Critical Constraints:**
- ES5 only (no arrow functions, let/const, template literals)
- Main edits in `/Volumes/roweOS/RoweOS/dist/index.html`
- Serverless function in `/Volumes/roweOS/functions/`
- No emojis in UI -- SVG icons only
- No em-dashes in UI text

---

## File Structure

| File | Purpose |
|------|---------|
| `RoweOS/dist/index.html` | All UI + client-side calendar logic |
| `functions/social-auth.js` (or new `functions/caldav-proxy.js`) | CalDAV write proxy for iCloud |

Key existing locations in `index.html`:
| Function | Line | Purpose |
|----------|------|---------|
| `renderCalendar()` | 85692 | Main calendar render (upgrade) |
| `getCalendarEventsForDate()` | 86878 | Event filtering (add color) |
| `pushEventToGoogleCalendar()` | 86100 | Google write (keep, add update/delete) |
| `initCalendar()` | 87744 | Calendar init |
| `saveCalendar()` | 87771 | Save + sync |
| `_calendarVisibility` | ~85889 | Calendar toggle state |
| `_mergedCalendarEvents` | ~85893 | Merged events array |

---

### Task 1: Add Calendar Colors + Calendars Panel CSS

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- CSS section

- [ ] **Step 1: Add CSS for horizontal event cards, colors, calendars panel, and +N badge**

Find the calendar/rhythm CSS section (search for `.calendar-day` or `.rhythm-` CSS). Add:

```css
/* v25.2: Calendar Overhaul */
.cal-event-card { display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background 0.1s;margin-bottom:2px;background:var(--bg-secondary,#1a1a1a); }
.cal-event-card:hover { background:var(--bg-tertiary,#222); }
.cal-event-border { width:3px;height:24px;border-radius:2px;flex-shrink:0; }
.cal-event-time { font-size:11px;font-weight:600;color:var(--text-primary,#e4e4e5);white-space:nowrap;min-width:52px; }
.cal-event-title { font-size:12px;color:var(--text-secondary,#999);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.cal-event-source { font-size:9px;color:var(--text-tertiary,#555);text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0; }
.cal-overflow-badge { position:absolute;top:4px;right:4px;font-size:9px;color:var(--accent,#a89878);background:rgba(168,152,120,0.15);padding:1px 5px;border-radius:8px;cursor:pointer; }
.cal-day-expanded { max-height:none !important; }
.calendars-panel { background:var(--bg-primary,#111);border:1px solid var(--border-color,#2a2a2a);border-radius:12px;padding:16px;margin-bottom:16px;display:none; }
.calendars-panel.open { display:block; }
.cal-provider-section { margin-bottom:12px; }
.cal-provider-label { font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-tertiary,#555);margin-bottom:6px;font-weight:600; }
.cal-calendar-row { display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer; }
.cal-calendar-row:hover { background:var(--bg-secondary,#1a1a1a); }
.cal-calendar-row input[type="checkbox"] { accent-color:var(--accent,#a89878); }
.cal-calendar-row .cal-color-swatch { width:14px;height:14px;border-radius:4px;border:1px solid var(--border-color,#333);cursor:pointer;flex-shrink:0; }
.cal-calendar-row .cal-name { font-size:12px;color:var(--text-secondary,#999);flex:1; }
.cal-color-picker { display:none;position:absolute;background:var(--bg-primary,#141414);border:1px solid var(--border-color,#2a2a2a);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:100;display:none; }
.cal-color-picker.open { display:grid;grid-template-columns:repeat(6,1fr);gap:4px; }
.cal-color-option { width:24px;height:24px;border-radius:6px;cursor:pointer;border:2px solid transparent; }
.cal-color-option:hover { border-color:var(--text-primary); }
.cal-color-option.selected { border-color:#fff; }
.cal-push-to { margin-top:8px; }
.cal-push-to select { width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;color:var(--text-primary);font-size:13px; }
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(calendar): add horizontal cards, calendars panel, color picker CSS v25.2"
```

---

### Task 2: Calendar Colors Storage + Calendars Panel

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- near calendar globals

- [ ] **Step 1: Add color management functions**

Find `var _calendarVisibility` (~line 85889). Insert nearby:

```javascript
// v25.2: Calendar colors
var _calendarColors = {};
try { _calendarColors = JSON.parse(localStorage.getItem('roweos_calendar_colors') || '{}'); } catch(e) {}

var DEFAULT_CAL_COLORS = { google: '#4ade80', icloud: '#f87171', outlook: '#818cf8', roweos: '#a89878' };
var COLOR_PALETTE = ['#f87171','#fb923c','#fbbf24','#a3e635','#4ade80','#2dd4bf','#38bdf8','#818cf8','#c084fc','#f472b6','#a89878','#94a3b8'];

function getCalendarColor(calId, source) {
  if (_calendarColors[calId]) return _calendarColors[calId];
  return DEFAULT_CAL_COLORS[source] || DEFAULT_CAL_COLORS.roweos;
}

function setCalendarColor(calId, color) {
  _calendarColors[calId] = color;
  localStorage.setItem('roweos_calendar_colors', JSON.stringify(_calendarColors));
  writeDB('profile/main', { calendarColors: _calendarColors });
  renderCalendar();
}

function renderCalendarsPanel() {
  var container = document.getElementById('calendarsPanel');
  if (!container) return;
  var html = '';

  // RoweOS
  html += '<div class="cal-provider-section"><div class="cal-provider-label">RoweOS</div>';
  html += renderCalendarRow('roweos_local', 'RoweOS (local)', 'roweos', true);
  html += '</div>';

  // Google
  if (_gcalConnected && _gcalCalendars && _gcalCalendars.length > 0) {
    html += '<div class="cal-provider-section"><div class="cal-provider-label">Google Calendar</div>';
    for (var gi = 0; gi < _gcalCalendars.length; gi++) {
      var gc = _gcalCalendars[gi];
      html += renderCalendarRow('google_' + (gc.id || gi), gc.summary || gc.name || 'Calendar', 'google', true);
    }
    html += '</div>';
  }

  // iCloud
  if (_icloudConnected) {
    html += '<div class="cal-provider-section"><div class="cal-provider-label">iCloud</div>';
    if (_icloudCalendars && _icloudCalendars.length > 0) {
      for (var ii = 0; ii < _icloudCalendars.length; ii++) {
        html += renderCalendarRow('icloud_' + ii, _icloudCalendars[ii].name || 'Calendar', 'icloud', true);
      }
    } else {
      html += renderCalendarRow('icloud_all', 'iCloud', 'icloud', true);
    }
    html += '</div>';
  }

  // Outlook
  if (_outlookCalConnected) {
    html += '<div class="cal-provider-section"><div class="cal-provider-label">Outlook</div>';
    html += renderCalendarRow('outlook_default', 'Outlook Calendar', 'outlook', true);
    html += '</div>';
  }

  container.innerHTML = html;
}

function renderCalendarRow(calId, name, source, checked) {
  var color = getCalendarColor(calId, source);
  var vis = _calendarVisibility[calId] !== false;
  return '<div class="cal-calendar-row">'
    + '<input type="checkbox" ' + (vis ? 'checked' : '') + ' onchange="toggleCalendarVisibility(\'' + calId + '\',this.checked)">'
    + '<div class="cal-color-swatch" style="background:' + color + ';" onclick="openCalColorPicker(event,\'' + calId + '\',\'' + source + '\')"></div>'
    + '<span class="cal-name">' + escapeHtml(name) + '</span>'
    + '</div>';
}

function toggleCalendarVisibility(calId, visible) {
  _calendarVisibility[calId] = visible;
  localStorage.setItem('roweos_calendar_visibility', JSON.stringify(_calendarVisibility));
  writeDB('profile/main', { calendarVisibility: _calendarVisibility });
  rebuildMergedCalendar();
  renderCalendar();
}

function openCalColorPicker(e, calId, source) {
  e.stopPropagation();
  // Remove any existing picker
  var existing = document.querySelector('.cal-color-picker.open');
  if (existing) existing.classList.remove('open');

  var picker = document.createElement('div');
  picker.className = 'cal-color-picker open';
  picker.style.position = 'fixed';
  picker.style.left = e.clientX + 'px';
  picker.style.top = e.clientY + 'px';
  var html = '';
  for (var i = 0; i < COLOR_PALETTE.length; i++) {
    var sel = _calendarColors[calId] === COLOR_PALETTE[i] ? ' selected' : '';
    html += '<div class="cal-color-option' + sel + '" style="background:' + COLOR_PALETTE[i] + ';" onclick="setCalendarColor(\'' + calId + '\',\'' + COLOR_PALETTE[i] + '\');this.parentNode.remove();"></div>';
  }
  picker.innerHTML = html;
  document.body.appendChild(picker);
  setTimeout(function() {
    document.addEventListener('click', function handler() {
      picker.remove();
      document.removeEventListener('click', handler);
    }, { once: true });
  }, 10);
}

function toggleCalendarsPanel() {
  var panel = document.getElementById('calendarsPanel');
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) renderCalendarsPanel();
}
```

- [ ] **Step 2: Add "Calendars" button to Rhythm header**

Find the Rhythm header HTML (search for `weekDisplay` or the month/week toggle buttons). Add a "Calendars" button:

```html
<button onclick="toggleCalendarsPanel()" style="padding:5px 12px;font-size:12px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer;">Calendars</button>
```

And add the panel container below the header:

```html
<div class="calendars-panel" id="calendarsPanel"></div>
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(calendar): calendar colors, Calendars toggle panel with color picker v25.2"
```

---

### Task 3: Upgrade Calendar Rendering to Horizontal Cards

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- `renderCalendar()` event rendering

- [ ] **Step 1: Find where events are rendered in day cells**

Inside `renderCalendar()`, find where events are looped and rendered for each day cell. Search for `getCalendarEventsForDate` calls inside `renderCalendar()`. The current code renders events as text items.

- [ ] **Step 2: Replace event rendering with horizontal cards**

Replace the event rendering loop with:

```javascript
      var events = getCalendarEventsForDate(dateStr);
      var maxShow = 3;
      var shownCount = Math.min(events.length, maxShow);
      for (var ei = 0; ei < shownCount; ei++) {
        var ev = events[ei];
        var source = ev.source || 'roweos';
        var calId = ev.calendarId || (source + '_' + (ev.calendarName || 'default'));
        var color = getCalendarColor(calId, source);
        var timeStr = ev.allDay ? 'All day' : (ev.time || '');
        var sourceLabel = source === 'google' ? 'Google' : source === 'icloud' ? 'iCloud' : source === 'outlook' ? 'Outlook' : '';
        html += '<div class="cal-event-card" onclick="editCalendarEvent(\'' + (ev.id || '') + '\')" draggable="' + (source === 'roweos' ? 'true' : 'false') + '"' + (source === 'roweos' ? ' ondragstart="handleDragStart(event,\'' + ev.id + '\')"' : '') + '>';
        html += '<div class="cal-event-border" style="background:' + color + ';"></div>';
        html += '<span class="cal-event-time">' + escapeHtml(timeStr) + '</span>';
        html += '<span class="cal-event-title">' + escapeHtml(ev.title || 'Untitled') + '</span>';
        if (sourceLabel) html += '<span class="cal-event-source">' + sourceLabel + '</span>';
        html += '</div>';
      }
      // +N overflow badge
      if (events.length > maxShow) {
        html += '<div class="cal-overflow-badge" onclick="expandCalendarDay(\'' + dateStr + '\',this)">+' + (events.length - maxShow) + '</div>';
      }
```

- [ ] **Step 3: Add expand function for +N badge**

```javascript
function expandCalendarDay(dateStr, badge) {
  var dayEl = badge.closest('.calendar-day');
  if (!dayEl) return;
  dayEl.classList.toggle('cal-day-expanded');
  if (dayEl.classList.contains('cal-day-expanded')) {
    // Re-render all events for this day
    var events = getCalendarEventsForDate(dateStr);
    var html = '';
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var source = ev.source || 'roweos';
      var calId = ev.calendarId || (source + '_default');
      var color = getCalendarColor(calId, source);
      var timeStr = ev.allDay ? 'All day' : (ev.time || '');
      var sourceLabel = source === 'google' ? 'Google' : source === 'icloud' ? 'iCloud' : source === 'outlook' ? 'Outlook' : '';
      html += '<div class="cal-event-card" onclick="editCalendarEvent(\'' + (ev.id || '') + '\')">';
      html += '<div class="cal-event-border" style="background:' + color + ';"></div>';
      html += '<span class="cal-event-time">' + escapeHtml(timeStr) + '</span>';
      html += '<span class="cal-event-title">' + escapeHtml(ev.title || 'Untitled') + '</span>';
      if (sourceLabel) html += '<span class="cal-event-source">' + sourceLabel + '</span>';
      html += '</div>';
    }
    // Replace just the events area
    var eventsContainer = dayEl.querySelector('.calendar-events') || dayEl;
    var badgeEl = dayEl.querySelector('.cal-overflow-badge');
    if (badgeEl) badgeEl.textContent = 'Show less';
  } else {
    renderCalendar(); // Re-render to collapse
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(calendar): horizontal event cards with color borders and +N overflow badge v25.2"
```

---

### Task 4: Calendar Picker on Event Creation

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- event creation modal

- [ ] **Step 1: Find the event creation modal**

Search for where new calendar events are created (search for `addCalendarEvent`, `createEvent`, `rhythmAddEvent`, or the modal that has title/date/time inputs for events).

- [ ] **Step 2: Add "Push to" dropdown**

In the event creation modal, add a "Push to" calendar selector:

```html
<div class="cal-push-to">
  <label style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;display:block;">Calendar</label>
  <select id="eventPushTo">
    <option value="local">RoweOS (local)</option>
  </select>
</div>
```

Populate the dropdown dynamically when the modal opens:

```javascript
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
```

- [ ] **Step 3: Wire the save button to push to selected calendar**

Find the event save handler. After saving locally, check the "Push to" value and route to the appropriate write-back function:

```javascript
  var pushTo = '';
  var pushSelect = document.getElementById('eventPushTo');
  if (pushSelect) pushTo = pushSelect.value;

  if (pushTo.indexOf('google_') === 0) {
    var calIdx = parseInt(pushTo.replace('google_', ''));
    var calId = _gcalCalendars[calIdx] ? _gcalCalendars[calIdx].id : 'primary';
    pushEventToGoogleCalendar(event, calId);
  } else if (pushTo === 'outlook') {
    pushEventToOutlookCalendar(event);
  } else if (pushTo === 'icloud') {
    pushEventToICloudCalendar(event);
  }
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(calendar): Push-to calendar picker on event creation v25.2"
```

---

### Task 5: Outlook Write-Back (Microsoft Graph)

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- after Google Calendar functions

- [ ] **Step 1: Add Outlook write functions**

Find `pushEventToGoogleCalendar` (~line 86100). Insert after the Google calendar functions:

```javascript
// v25.2: Outlook Calendar Write-Back (Microsoft Graph API)
function pushEventToOutlookCalendar(event) {
  var token = localStorage.getItem('roweos_outlook_cal_token');
  if (!token) { showToast('Outlook not connected', 'error'); return Promise.reject('Not connected'); }
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  var body = {
    subject: event.title || 'Untitled',
    start: { dateTime: event.date + 'T' + (event.time || '00:00') + ':00', timeZone: tz },
    end: { dateTime: event.date + 'T' + (event.endTime || event.time || '01:00') + ':00', timeZone: tz },
    body: { contentType: 'text', content: event.description || '' },
    isAllDay: event.allDay || false
  };
  showToast('Saving to Outlook...', 'info');
  return fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r) {
    if (r.status === 401) {
      showToast('Outlook token expired. Please reconnect.', 'error');
      return Promise.reject('Token expired');
    }
    return r.json();
  }).then(function(data) {
    if (data.id) {
      showToast('Event saved to Outlook', 'success');
      syncOutlookCalendarEvents();
    }
    return data;
  }).catch(function(err) {
    showToast('Failed to save to Outlook: ' + (err.message || err), 'error');
  });
}

function updateOutlookCalendarEvent(event) {
  var token = localStorage.getItem('roweos_outlook_cal_token');
  if (!token || !event.externalId) return Promise.reject('Missing token or event ID');
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  var body = {
    subject: event.title,
    start: { dateTime: event.date + 'T' + (event.time || '00:00') + ':00', timeZone: tz },
    end: { dateTime: event.date + 'T' + (event.endTime || event.time || '01:00') + ':00', timeZone: tz },
    body: { contentType: 'text', content: event.description || '' }
  };
  showToast('Updating Outlook event...', 'info');
  return fetch('https://graph.microsoft.com/v1.0/me/events/' + event.externalId, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); }).then(function(data) {
    showToast('Outlook event updated', 'success');
    syncOutlookCalendarEvents();
    return data;
  }).catch(function(err) {
    showToast('Update failed: ' + (err.message || err), 'error');
  });
}

function deleteOutlookCalendarEvent(eventId) {
  var token = localStorage.getItem('roweos_outlook_cal_token');
  if (!token || !eventId) return Promise.reject('Missing token or event ID');
  showToast('Deleting from Outlook...', 'info');
  return fetch('https://graph.microsoft.com/v1.0/me/events/' + eventId, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function(r) {
    if (r.ok) { showToast('Deleted from Outlook', 'success'); syncOutlookCalendarEvents(); }
    else showToast('Delete failed', 'error');
  }).catch(function(err) {
    showToast('Delete failed: ' + (err.message || err), 'error');
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(calendar): Outlook write-back via Microsoft Graph API v25.2"
```

---

### Task 6: iCloud Write-Back (CalDAV) + ICS Generator

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` -- after Outlook functions
- Create: `/Volumes/roweOS/functions/caldav-proxy.js` (Vercel serverless)

- [ ] **Step 1: Add ICS generator and iCloud write functions**

```javascript
// v25.2: iCloud Calendar Write-Back (CalDAV via serverless proxy)
function generateICS(event) {
  var uid = event.id || ('roweos-' + Date.now());
  var now = new Date();
  var stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  var dtStart = (event.date || '').replace(/-/g, '');
  if (event.time) dtStart += 'T' + event.time.replace(':', '') + '00';
  var dtEnd = (event.date || '').replace(/-/g, '');
  if (event.endTime) dtEnd += 'T' + event.endTime.replace(':', '') + '00';
  else if (event.time) {
    var parts = event.time.split(':');
    var endHour = (parseInt(parts[0]) + 1) % 24;
    dtEnd += 'T' + (endHour < 10 ? '0' : '') + endHour + parts[1] + '00';
  }

  return 'BEGIN:VCALENDAR\r\n'
    + 'VERSION:2.0\r\n'
    + 'PRODID:-//RoweOS//Calendar//EN\r\n'
    + 'BEGIN:VEVENT\r\n'
    + 'UID:' + uid + '@roweos.com\r\n'
    + 'DTSTAMP:' + stamp + '\r\n'
    + 'DTSTART:' + dtStart + '\r\n'
    + 'DTEND:' + dtEnd + '\r\n'
    + 'SUMMARY:' + (event.title || 'Untitled').replace(/\n/g, '\\n') + '\r\n'
    + (event.description ? 'DESCRIPTION:' + event.description.replace(/\n/g, '\\n') + '\r\n' : '')
    + 'END:VEVENT\r\n'
    + 'END:VCALENDAR\r\n';
}

function pushEventToICloudCalendar(event) {
  var calHome = localStorage.getItem('roweos_icloud_cal_home');
  var appleId = localStorage.getItem('roweos_icloud_apple_id');
  var appPwd = localStorage.getItem('roweos_icloud_app_password');
  if (!calHome || !appleId || !appPwd) { showToast('iCloud not configured', 'error'); return Promise.reject('Not configured'); }

  var icsData = generateICS(event);
  var uid = event.id || ('roweos-' + Date.now());
  showToast('Saving to iCloud...', 'info');
  return fetch('/api/caldav-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'put',
      calendarHome: calHome,
      appleId: appleId,
      appPassword: appPwd,
      eventUid: uid,
      icsData: icsData
    })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success) { showToast('Event saved to iCloud', 'success'); syncICloudCalendarEvents(); }
    else showToast('iCloud save failed: ' + (data.error || 'Unknown error'), 'error');
    return data;
  }).catch(function(err) {
    showToast('iCloud save failed: ' + (err.message || err), 'error');
  });
}

function deleteICloudCalendarEvent(eventUid) {
  var calHome = localStorage.getItem('roweos_icloud_cal_home');
  var appleId = localStorage.getItem('roweos_icloud_apple_id');
  var appPwd = localStorage.getItem('roweos_icloud_app_password');
  if (!calHome || !appleId || !appPwd) return Promise.reject('Not configured');
  showToast('Deleting from iCloud...', 'info');
  return fetch('/api/caldav-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'delete',
      calendarHome: calHome,
      appleId: appleId,
      appPassword: appPwd,
      eventUid: eventUid
    })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success) { showToast('Deleted from iCloud', 'success'); syncICloudCalendarEvents(); }
    else showToast('iCloud delete failed', 'error');
  }).catch(function(err) { showToast('iCloud delete failed', 'error'); });
}
```

- [ ] **Step 2: Create the Vercel serverless CalDAV proxy**

Check if `/Volumes/roweOS/functions/` exists. Create `/Volumes/roweOS/functions/caldav-proxy.js`:

```javascript
// CalDAV Proxy for iCloud Calendar Write-Back
// Vercel Serverless Function
const https = require('https');

module.exports = async function(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { action, calendarHome, appleId, appPassword, eventUid, icsData } = req.body;
  if (!calendarHome || !appleId || !appPassword) {
    res.status(400).json({ error: 'Missing credentials' }); return;
  }

  const auth = Buffer.from(appleId + ':' + appPassword).toString('base64');
  const eventUrl = calendarHome.replace(/\/$/, '') + '/' + eventUid + '.ics';
  const urlObj = new URL(eventUrl);

  const options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: action === 'delete' ? 'DELETE' : 'PUT',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Content-Type': 'text/calendar; charset=utf-8'
    }
  };

  if (action !== 'delete' && icsData) {
    options.headers['Content-Length'] = Buffer.byteLength(icsData);
  }

  try {
    const response = await new Promise(function(resolve, reject) {
      const request = https.request(options, function(resp) {
        let body = '';
        resp.on('data', function(chunk) { body += chunk; });
        resp.on('end', function() { resolve({ status: resp.statusCode, body: body }); });
      });
      request.on('error', reject);
      if (action !== 'delete' && icsData) request.write(icsData);
      request.end();
    });

    if (response.status >= 200 && response.status < 300) {
      res.status(200).json({ success: true });
    } else {
      res.status(200).json({ success: false, error: 'CalDAV returned ' + response.status, body: response.body });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
```

- [ ] **Step 3: Add the route to vercel.json**

Check `/Volumes/roweOS/RoweOS/dist/vercel.json` for existing routes. Add:

```json
{ "src": "/api/caldav-proxy", "dest": "/functions/caldav-proxy.js" }
```

Wait -- the functions directory may be at a different level. Check the existing vercel.json structure and add the route appropriately.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html functions/ && git commit -m "feat(calendar): iCloud write-back via CalDAV proxy + ICS generator v25.2"
```

---

### Task 7: Deploy

- [ ] **Step 1: Deploy**

```bash
cd /Volumes/roweOS && bash deploy.sh
```

- [ ] **Step 2: Final commit**

```bash
cd /Volumes/roweOS && git add -A && git commit -m "feat(calendar): Calendar Overhaul complete -- horizontal cards, colors, Calendars panel, write-back (Google + Outlook + iCloud) v25.2

Visual overhaul with horizontal event cards, color-coded borders per
calendar source, Calendars toggle panel with color picker, +N overflow
badge, calendar picker on event creation, and write-back on all 3
platforms (Google Calendar API, Microsoft Graph, CalDAV proxy).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
