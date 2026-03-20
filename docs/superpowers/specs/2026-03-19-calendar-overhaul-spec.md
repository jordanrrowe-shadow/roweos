# R1: Calendar Overhaul - Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Author:** Claude + Jordan Rowe

---

## Problem Statement

The calendar UI uses vertical text lists for events, has no visual differentiation between calendar sources, and only supports write-back to Google Calendar. Users need horizontal event cards with custom colors, a "Calendars" toggle panel, calendar picker on event creation, and full read/write/edit on all three platforms (Google, iCloud, Outlook).

## Architecture

Visual overhaul of the calendar rendering to use horizontal cards with color-coded borders per calendar source. Add a "Calendars" panel for toggling calendar visibility and setting custom colors. Extend the event creation modal with a "Push to" calendar picker. Implement write-back for Outlook (Microsoft Graph API) and iCloud (CalDAV via serverless proxy).

**Tech Stack:** Vanilla ES5 JavaScript, Google Calendar API v3, Microsoft Graph API, CalDAV protocol, Vercel serverless functions, single-file HTML app

**Critical Constraints:**
- ES5 only
- All edits in `RoweOS/dist/index.html` (plus Vercel serverless function for CalDAV proxy)
- No emojis in UI -- SVG icons only
- No em-dashes in UI text
- Existing calendar integrations: Google (read+write), iCloud (read), Outlook (read)

---

## Design

### Horizontal Event Cards

Each event rendered as a compact horizontal card:
- Left border: 3px solid in calendar source color
- Content: time (bold) + title + calendar source label (subtle, right-aligned)
- Click to edit (opens edit modal)
- Drag handle for RoweOS-local events (existing drag-drop, keep)

Day cells in month view:
- Show max 3 event cards
- If more than 3: show "+N" badge in top-right corner of day cell
- "+N" badge click expands the day to show all events in a slide-down panel
- Badge color matches brand accent

### Calendars Panel

Toggled via a "Calendars" button in the Rhythm header (next to month/week toggle).

Panel structure:
- Collapsible sections per provider: Google, iCloud, Outlook, RoweOS
- Each section shows sub-calendars (e.g., Google > Work, Google > Personal)
- Each calendar row: checkbox (toggle visibility) + name + color swatch
- Clicking color swatch opens a small color picker (preset palette, 12 colors)
- Changes saved immediately to `roweos_calendar_colors` and synced to Firestore

Storage:
- `roweos_calendar_colors`: `{"google_work": "#4ade80", "icloud_home": "#f87171", ...}`
- `roweos_calendar_visibility`: `{"google_work": true, "icloud_home": false, ...}` (existing, extended)
- Both synced to Firestore `profile/main`

### Calendar Picker on Event Creation

When creating/editing an event, the modal includes a "Push to" dropdown:
- Options: "RoweOS (local)", plus all connected external calendars
- Default: "RoweOS (local)"
- Selecting an external calendar triggers write-back on save
- Dropdown populated from `_gcalCalendars`, iCloud calendar list, Outlook calendar list

### Write-Back: Google Calendar (existing)

Already implemented:
- `pushEventToGoogleCalendar(event)` (~line 86079)
- Uses Google Calendar API v3 `events.insert`
- Auth: existing OAuth token `_gcalAccessToken`

Add:
- `updateGoogleCalendarEvent(event)` -- `events.update` (PATCH)
- `deleteGoogleCalendarEvent(eventId)` -- `events.delete`
- Token refresh handling (existing refresh flow)

### Write-Back: Outlook Calendar (new)

Uses Microsoft Graph API:
- Create: `POST https://graph.microsoft.com/v1.0/me/events`
- Update: `PATCH https://graph.microsoft.com/v1.0/me/events/{id}`
- Delete: `DELETE https://graph.microsoft.com/v1.0/me/events/{id}`
- Auth: existing OAuth token `roweos_outlook_cal_token`
- Token refresh: existing refresh flow with `roweos_outlook_cal_refresh_token`

Event body format:
```
{
  subject: event.title,
  start: { dateTime: "2026-03-20T09:00:00", timeZone: "America/Chicago" },
  end: { dateTime: "2026-03-20T10:00:00", timeZone: "America/Chicago" },
  body: { contentType: "text", content: event.description || "" },
  isAllDay: event.allDay || false
}
```

### Write-Back: iCloud Calendar (new)

Uses CalDAV protocol (PUT/DELETE) proxied through a Vercel serverless function to avoid CORS:

**Client side:**
- `pushEventToICloudCalendar(event)` -- POSTs to `/api/caldav-put`
- `updateICloudCalendarEvent(event)` -- same endpoint, PUT method
- `deleteICloudCalendarEvent(eventId)` -- POSTs to `/api/caldav-delete`

**Serverless function `/api/caldav-put`:**
- Receives: `{calendarHome, appleId, appPassword, eventUid, icsData}`
- Constructs CalDAV PUT request to `{calendarHome}/{eventUid}.ics`
- Auth: Basic auth with appleId + appPassword
- Returns: success/error

**ICS generation:**
- `generateICS(event)` -- creates iCalendar format string
- Required fields: VCALENDAR wrapper, VEVENT with DTSTART, DTEND, SUMMARY, UID
- Timezone: use `Intl.DateTimeFormat().resolvedOptions().timeZone`

### Event Edit Flow

1. User clicks event in calendar -> opens edit modal
2. Modal shows: title, date, time, end time, description, "Calendar" label (source)
3. If event is from external calendar:
   - Show "Save to [Platform]" button instead of plain "Save"
   - On save: call platform-specific update function
   - Show "Saving to [Platform]..." indicator during API call
   - On success: re-sync that calendar, show toast
   - On error: show error toast, keep modal open
4. If event is RoweOS-local:
   - Normal save to localStorage + Firestore
5. Delete button:
   - External events: call platform-specific delete, then re-sync
   - Local events: remove from array, save

### Functions

| Function | Action |
|----------|--------|
| Modify: `renderCalendar()` (~line 85671) | Horizontal cards, color borders, +N badge |
| Modify: `getCalendarEventsForDate()` (~line 86857) | Include calendar color + source in results |
| New: `renderCalendarsPanel()` | Toggle drawer with calendar list, checkboxes, color pickers |
| New: `setCalendarColor(calendarId, hexColor)` | Save to localStorage + Firestore |
| Modify: Event creation modal | Add "Push to" dropdown |
| New: `pushEventToOutlookCalendar(event)` | MS Graph POST |
| New: `updateOutlookCalendarEvent(event)` | MS Graph PATCH |
| New: `deleteOutlookCalendarEvent(eventId)` | MS Graph DELETE |
| New: `pushEventToICloudCalendar(event)` | CalDAV PUT via proxy |
| New: `updateICloudCalendarEvent(event)` | CalDAV PUT via proxy |
| New: `deleteICloudCalendarEvent(eventId)` | CalDAV DELETE via proxy |
| New: `generateICS(event)` | iCalendar format generator |
| New: Vercel function `/api/caldav-put` | CalDAV proxy for iCloud |
| New: Vercel function `/api/caldav-delete` | CalDAV proxy for iCloud |
| Modify: `pushEventToGoogleCalendar()` | Keep, add update/delete variants |

### Edge Cases

- **Token expired during write:** Attempt refresh, retry once, then show error
- **iCloud app-specific password invalid:** Show clear error with link to Apple ID settings
- **Conflict (event modified on both sides):** Last-write-wins, no merge (matches current approach)
- **Offline write-back:** Queue the write, execute on next sync (leverage Firestore pending writes)
- **Calendar color not set:** Default colors per provider (Google=green, iCloud=red, Outlook=blue, RoweOS=gold)
