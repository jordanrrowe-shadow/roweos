# Admin Email Templates & User Feedback System

**Date:** 2026-04-23
**Project:** RoweOS
**Scope:** 5 new email templates, response capture API, Admin panel email management UI

---

## Overview

Add five new admin email templates to RoweOS, a response capture system for interactive email elements, and an Admin panel section for viewing user feedback, sending emails manually, and managing automatic email triggers.

---

## Email Templates

All templates use the existing dark theme styling: `#0a0a0a` background, `#a89878` gold accent, table-based HTML layout, sent via Resend from `roweos@therowecollection.com` with reply-to `jordan@therowecollection.com`.

### 1. Onboarding Survey

**Purpose:** Collect feedback from new signups about their needs, discovery channel, and experience.

**Content sections:**
- Greeting with user's first name
- "We'd love to learn about your experience" intro
- **Question 1: "Do you need a beta API key?"**
  - Clickable options: `[Yes, I need one]` `[No, I have my own]` `[Not sure what this means]`
  - Each option is an `<a>` tag linking to `/api/email-response?user={uid}&q=api_key_need&a={answer}&token={hmac}`
- **Question 2: "How did you hear about RoweOS?"**
  - Clickable options: `[Twitter/X]` `[Google Search]` `[Friend/Referral]` `[LinkedIn]` `[Product Hunt]` `[Other]`
- **Question 3: "How has your experience been so far?"**
  - Clickable options: `[Smooth, love it]` `[Good, some questions]` `[Hit some bumps]` `[Need help]`
- Footer: "Have more to share? Just reply to this email."

**Auto-trigger:** 3 days after signup (when auto-send enabled).

### 2. Re-engagement

**Purpose:** Nudge users who signed up but haven't been active.

**Content sections:**
- "We noticed you haven't been back in a while"
- 3 quick-win suggestions (e.g. "Try a Studio operation," "Set up your first brand," "Ask BLAKE anything")
- CTA button: "Open RoweOS" linking to `https://roweos.com`
- "Need help getting started? Reply to this email."

**Auto-trigger:** 7 days since last activity with no prior re-engagement email sent (when auto-send enabled).

### 3. Feature Announcement

**Purpose:** Notify users about new capabilities. Content is dynamic per send.

**Content sections:**
- "What's New in RoweOS" header
- Feature name + short description (admin fills in when sending)
- Screenshot/image slot (optional, admin provides URL)
- CTA button: "Try it now" linking to `https://roweos.com`

**Trigger:** Manual only. Admin composes feature name, description, and optional image URL in the Admin panel.

### 4. Access Key Delivery

**Purpose:** Clean handoff when an access key is generated or assigned to a user.

**Content sections:**
- "Your RoweOS Access Key" header
- Access key displayed in a styled monospace box with copy-friendly formatting
- Tier badge (Founder/Basic/Premium)
- "How to activate" steps: Go to roweos.com, sign in, enter your key in Settings
- CTA button: "Activate Your Key" linking to `https://roweos.com`

**Trigger:** Automatic when admin generates and assigns a key via Admin panel, or manual send.

### 5. Check-in

**Purpose:** Periodic follow-up to gauge ongoing satisfaction.

**Content sections:**
- "How's everything going with RoweOS?"
- **Quick rating:** Clickable options: `[Loving it]` `[It's good]` `[Could be better]` `[Having issues]`
- "What would make RoweOS better for you?" prompt with reply-to fallback
- CTA: "Open RoweOS"

**Auto-trigger:** 14 days after signup, then every 30 days (when auto-send enabled). Only sends if no check-in sent in the last 25 days.

---

## Response Capture API

### Endpoint: `/api/email-response`

**Method:** GET (so email links work without JS)

**Query params:**
- `user` - Firebase UID
- `q` - question key (e.g. `api_key_need`, `heard_from`, `experience`, `checkin_rating`)
- `a` - answer value (e.g. `yes`, `twitter`, `smooth`)
- `token` - HMAC-SHA256 of `user:q:a` signed with a server secret, prevents tampering

**Flow:**
1. Validate HMAC token
2. Write to Firestore `onboarding_responses/{uid}/responses/{auto-id}`:
   ```
   {
     question: "api_key_need",
     answer: "yes",
     timestamp: serverTimestamp(),
     email_template: "onboarding_survey",
     source: "email_click"
   }
   ```
3. Return a styled HTML thank-you page (dark theme, "Thanks for your feedback!" message, link back to RoweOS)

### Firestore Collections

**`email_log`** - every email sent, keyed for querying by user:
```
{
  userId: "firebase-uid",
  userEmail: "user@example.com",
  template: "onboarding_survey",
  subject: "Welcome to RoweOS - Quick Questions",
  sentAt: serverTimestamp(),
  status: "sent" | "failed",
  metadata: { ... template-specific data }
}
```

**`onboarding_responses`** - subcollection per user:
```
onboarding_responses/{uid}/responses/{auto-id}
{
  question: "heard_from",
  answer: "twitter",
  timestamp: serverTimestamp(),
  email_template: "onboarding_survey"
}
```

**`email_settings`** - single doc for auto-send configuration:
```
email_settings/config
{
  autoSendEnabled: true,
  onboardingSurveyDays: 3,
  reEngagementDays: 7,
  checkInDays: 14,
  checkInRepeatDays: 30
}
```

---

## Admin Panel Additions

### User Email Management Section

Added as a new tab or section within the existing Admin view.

#### User List View
- Table of all signed-up users
- Columns: Name, Email, Signup Date, **Last Email Sent** (template name + relative time), Response Count
- Filter/search by email or name
- Bulk select for sending templates to multiple users
- "Send Email" dropdown: pick a template, send to selected users

#### User Detail View (click into a user)
- **Email History** - chronological list of every email sent to this user:
  - Template name, subject, sent date, delivery status
- **Responses** - all feedback this user has submitted:
  - Question, answer, timestamp, which template it came from
- **Quick Actions:**
  - Send any template to this user
  - Generate and send access key
  - View in Firebase Console link

#### Email Settings Panel
- **Auto-Send Toggle:** On/Off switch for automatic email triggers
- **Timing Configuration** (editable number inputs):
  - Onboarding survey: X days after signup (default: 3)
  - Re-engagement: X days inactive (default: 7)
  - Check-in: X days after signup (default: 14), repeat every X days (default: 30)
- **Preview:** Click any template name to see a rendered preview in a modal

#### Feature Announcement Composer
- Text input: Feature name
- Textarea: Feature description
- Optional: Image URL
- "Preview" button shows rendered email
- "Send to All Users" / "Send to Selected" buttons
- Confirmation modal before sending

### Aggregated Stats (top of section)
- **How they heard about us:** Bar/pill breakdown (Twitter: 12, Google: 8, Friend: 5, etc.)
- **Experience ratings:** Distribution (Smooth: 15, Good: 8, Bumps: 3, Need help: 1)
- **API key needs:** Yes/No/Not sure counts
- **Check-in ratings:** Distribution over time

---

## Auto-Send Scheduler Integration

Integrates with the existing cron-based scheduler (`/api/scheduler`).

**On each scheduler tick (when auto-send is enabled):**
1. Read `email_settings/config` from Firestore
2. Query users from `signups` collection
3. For each user, check `email_log` for what's already been sent
4. Determine which templates are due:
   - Onboarding survey: signup was X days ago AND no onboarding survey in email_log
   - Re-engagement: last activity was X days ago AND no re-engagement in email_log
   - Check-in: signup was X+ days ago AND no check-in in last Y days in email_log
5. Send applicable emails, write to `email_log`
6. Batch limit: max 10 auto-emails per scheduler tick to avoid rate limits

**Tracking last activity:** Use existing Firebase auth `lastSignInTime` or the last `_modifiedAt` timestamp from sync data.

---

## File Changes

### New Files
- `/api/email-response.js` - response capture endpoint + thank-you page
- `/api/send-template-email.js` - admin-triggered template email sender

### Modified Files
- `/api/scheduler.js` - add auto-send check logic
- `/api/notify-signup.js` - write to `email_log` on welcome email send
- `src/js/core/24-remaining.js` or new `25-admin-emails.js` - Admin panel UI for email management
- `src/html/brand/admin.html` or equivalent - Admin view HTML additions

---

## Security

- HMAC token validation on `/api/email-response` prevents users from spoofing responses
- `/api/send-template-email` restricted to `isAdmin()` check
- Email settings read/write restricted to admin UID
- Rate limiting: auto-send capped at 10 emails per scheduler tick
- All Resend API calls use server-side env var, never exposed to client
