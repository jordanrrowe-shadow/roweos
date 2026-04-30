# F1: Reminders Overhaul - Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Author:** Claude + Jordan Rowe

---

## Problem Statement

Current reminders are a basic list with no notifications, no action buttons, and no scheduling. Users need reminders that fire as popup notifications (in-app and push), stack in the bottom-right, require an action before dismissal, and integrate with other RoweOS features.

## Architecture

Upgrade reminder data model with scheduling support. Build notification popup UI that stacks in bottom-right with action buttons. Wire into existing Web Push infrastructure (VAPID + service worker already set up) for background notifications. Add a Cloud Function for server-side push delivery when the app is closed.

**Tech Stack:** Vanilla ES5 JavaScript, existing Web Push (VAPID), Firebase Cloud Functions, single-file HTML app

**Critical Constraints:**
- ES5 only
- All edits in `RoweOS/dist/index.html` (plus Cloud Function and sw.js updates)
- No emojis in UI -- SVG icons only
- No em-dashes in UI text
- Existing push infrastructure: VAPID key, service worker, Firestore subscription storage

---

## Design

### Data Model

```
{
  id: "rem_1710882000_abc123",
  title: "Follow up with Sarah",
  message: "Re: investment thesis email",
  scheduledAt: 1710882000000,
  createdAt: 1710880000000,
  source: "manual" | "focus-inline" | "automation" | "ai-chat",
  status: "pending" | "fired" | "snoozed" | "completed",
  snoozedUntil: null,
  actions: [],
  _modifiedAt: 1710882000000
}
```

Storage: `roweos_reminders` (localStorage) + `pulse/main` -> `reminders` (Firestore, write-through)

### Focus Widget (expanded by default on mobile)

- Each reminder card shows: title, scheduled time (relative), source SVG icon
- Overdue reminders highlighted with subtle red/gold accent
- Inline add form: title + datetime-local picker + "Add" button (existing, upgraded)
- On mobile: `data-widget="reminders"` renders expanded, not behind "Customize" gate
- New reminders get `scheduledAt` from the datetime picker (required field)

### Notification Popup (bottom-right stack)

When `scheduledAt <= Date.now()` and `status === "pending"`:

- Popup appears bottom-right, 360px wide
- Shows: "RoweOS Reminder" header, title, relative time ("overdue by 5 min")
- Action buttons (two rows):
  - Row 1: [Talk to AI] [Add to Pulse] [Snooze v]
  - Row 2: [Create Automation] [Add to Focus] [Complete]
- X button is DISABLED until an action is taken
- After any action, X becomes active and popup can be dismissed
- Max 3 popups visible, additional queued (FIFO)
- Stacks vertically from bottom with 8px gap

### Action Button Behaviors

| Action | What it does |
|--------|-------------|
| Talk to AI | Opens BrandAI/LifeAI chat with "Regarding my reminder: {title}" pre-filled |
| Add to Pulse | Creates a Pulse goal from reminder title with due date |
| Add to Focus | Creates a Focus task from reminder title |
| Create Automation | Opens automation builder with reminder context |
| Snooze | Dropdown: 15 min, 30 min, 1 hour, 3 hours, Tomorrow 9 AM. Sets `snoozedUntil`, status back to `pending` |
| Complete | Sets `status: "completed"`, enables X dismiss |

### Notification Delivery

**In-app (tab open):**
- `setInterval(checkDueReminders, 30000)` -- every 30 seconds
- `checkDueReminders()` queries `roweos_reminders` for `scheduledAt <= now AND status === "pending"`
- Also checks `snoozedUntil <= now` for snoozed reminders
- Fires `showReminderPopup(reminder)` for each due item
- Also fires browser `Notification API` (if permitted) for system-level alert

**Background (tab closed):**
- Firebase Cloud Function `checkReminders` runs on cron (every 5 minutes)
- Queries Firestore: user's `pulse/main` -> `reminders` where `scheduledAt <= now AND status === "pending"`
- For each due reminder, sends Web Push via existing VAPID subscription
- Push payload: `{title: "RoweOS Reminder", body: reminder.title, type: "reminder", reminderId: reminder.id}`
- Marks `status: "fired"` in Firestore to prevent duplicate sends
- Service worker (`sw.js`) handles push event, shows system notification
- Notification click opens RoweOS and triggers `showReminderPopup(reminder)`

### Functions

| Function | Action |
|----------|--------|
| Modify: `renderFocusReminders()` (~line 157066) | New card design, action buttons, expanded on mobile |
| Modify: `submitInlineReminder()` (~line 157110) | Use new data model with `scheduledAt` |
| New: `checkDueReminders()` | In-app scheduler, runs every 30s |
| New: `showReminderPopup(reminder)` | Bottom-right notification card |
| New: `dismissReminderPopup(id)` | Remove popup (only after action taken) |
| New: `snoozeReminder(id, duration)` | Update snoozedUntil, reset status |
| New: `completeReminder(id)` | Mark complete, enable dismiss |
| New: `reminderAction(id, action)` | Route to Talk to AI / Pulse / Focus / Automation |
| New: Cloud Function `checkReminders` | Server-side push for background delivery |
| Modify: `sw.js` | Handle reminder-type push payload, click opens RoweOS with reminder context |

### Edge Cases

- **Multiple reminders due at same time:** Queue them, show max 3, cycle through
- **Reminder fired while offline:** In-app check on next load catches overdue items
- **Snoozed reminder fires again:** Only if `snoozedUntil <= now`, not the original `scheduledAt`
- **Reminder from automation:** Source shown as "Automation" icon, action buttons same
