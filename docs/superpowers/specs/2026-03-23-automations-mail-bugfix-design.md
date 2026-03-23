# Automations + Mail Bugfix -- Design Spec

**Date:** 2026-03-23
**Scope:** 4 bugs: scheduler not executing, email step missing in Cloud Functions, template vars unreplaced, duplicate execution, mail timestamps in UTC
**Approach:** Fix Cloud Functions as the reliable execution path, add email step handler, fix mail display
**Files affected:** `functions/index.js`, `functions/lib/executor.js`, `functions/lib/pipeline-executor.js`, `functions/lib/scheduler.js`, `functions/lib/firestore-helpers.js`, `RoweOS/dist/index.html`

---

## Bug #1: Cloud Functions Scheduler Executes 0 Tasks

**Symptoms:** Logs show `[Cloud Scheduler] Found 3 enabled users` then `Done. Executed 0 tasks` every 5 minutes. The `getEnabledUsers()` query works (finds users), but `getDueTasks()` returns empty arrays for all users.

**Root cause investigation needed:** The Firestore paths align (`roweos_users/{uid}/automations` is used by both client and Cloud Functions). Possible causes:
- All automations have `enabled: false` or `action: 'none'`
- The `isTaskDue()` time window check fails (timezone issue, or scheduled time format mismatch)
- The automation documents in Firestore don't have the fields `isTaskDue()` expects
- `task.lastRun` may be a Firestore Timestamp object (with `seconds`/`nanoseconds`) rather than an ISO string, causing `new Date(task.lastRun)` to produce `Invalid Date`
- **Double-gate in `getEnabledUsers()`**: The function queries parent docs where `cloudSchedulerEnabled == true` (line 20), then re-checks the `secure/api_keys` sub-doc (line 31). If the flag is set on the parent but not the sub-doc, users pass gate 1 but fail gate 2, and `getDueTasks()` never runs for them

**Fix:**
1. Add diagnostic logging to `getEnabledUsers()` in `scheduler.js`: log when a user passes the parent query but fails the api_keys gate. Log the actual value of `cloudSchedulerEnabled` from both locations
2. Add diagnostic logging to `getDueTasks()`: log how many automations were fetched, how many are enabled, and for each enabled one, log why `isTaskDue()` returned false (frequency, scheduledTime, lastRun, current local time)
3. Add diagnostic logging to `isTaskDue()`: log the comparison values (scheduled time vs current time, last run vs now, time window check result). Also log `typeof task.lastRun` to catch Firestore Timestamp vs ISO string mismatches
4. This will immediately reveal the root cause in the next deploy's logs
5. Based on findings, fix the actual issue (likely the double-gate, a field name mismatch, or time format issue)

**Validation:** Deploy, wait for next 5-minute tick, check logs. Should see exactly why each automation is not considered due.

---

## Bug #2: Email Steps Not Handled in Cloud Functions Pipeline

**Root cause:** `functions/lib/pipeline-executor.js` handles step types like "Research", "AI Message", "Library", "Notify" but has NO handler for "Email" step type. When the pipeline reaches the "Email Package to Jordan" step, it falls through to the AI/unknown handler, which treats the step description as an AI prompt. This produces "Email Package to Jordan" as literal output instead of actually sending an email.

**Constraint:** Email sending in roweOS uses Gmail/Outlook OAuth tokens obtained through browser-based OAuth flows. Cloud Functions cannot directly send emails because:
- Gmail sending goes through `/api/gmail-proxy` (Vercel serverless) with an OAuth `accessToken`
- Outlook sending uses Microsoft Graph API with a Bearer token
- OAuth access tokens expire (~1 hour) and refresh requires browser-stored refresh tokens
- The client-side email handler uses `marked.js` for markdown-to-HTML, DOM-based template generation (`generateBrandedEmail()`), and inline CSS injection -- none of which are available in Cloud Functions

**Fix (Cloud Outbox pattern):**
1. Add an email step handler in `pipeline-executor.js` that composes the email server-side but does NOT send it directly
2. The handler:
   - Reads the email config from the step (recipient, subject, body template)
   - Resolves template variables (`{{current_date}}`, `{{step1_output}}`, etc.) in subject and body
   - Composes the email body from previous step outputs (concatenates step outputs as the email content, in markdown format)
   - Writes the composed email to Firestore at `roweos_users/{uid}/cloud_outbox/{docId}` with fields: `{ to, subject, bodyMarkdown, status: 'pending', createdAt, automationId, pipelineStepIndex }`
3. On the client side (index.html), add a `processCloudOutbox()` function that:
   - Runs on page load and periodically (every 60 seconds)
   - Queries `cloud_outbox` where `status == 'pending'`
   - For each pending email, applies the existing email sending flow (markdown-to-HTML via `marked`, branded template via `generateBrandedEmail()`, Gmail/Outlook OAuth send)
   - Updates status to `'sent'` or `'failed'` after processing
4. The pipeline step output for the email step should be "Email queued for delivery" (so subsequent steps know it was processed)

**Why this approach:** Matches the existing `cloud_results` pickup pattern. The Cloud Function does the heavy lifting (AI research, composition, template resolution), and the client handles the last-mile email delivery with its existing OAuth flow and HTML rendering.

**Validation:** Run automation via Cloud Functions. On next browser open, the email sends automatically with full content and proper formatting.

---

## Bug #3: Template Variable `{{current_date}}` Not Replaced in Email

**Root cause:** `executor.js` builds template context (`current_date`, `current_time`, `day_of_week`, `brand_name`, `user_name`) and applies `resolveTemplateVars()` to `task.name`, `task.description`, and `task.target.text`. But it does NOT apply template resolution to:
- Pipeline step email subject
- Pipeline step email body
- Pipeline step email recipient

The `resolveTemplateVars()` function exists and works -- it just isn't called on email fields.

**Fix (two layers):**
1. **Pass template context into pipeline executor:** In `handlePipelineAction()` in `executor.js` (~line 296), the `buildTemplateContext()` output must be passed into `pipelineExecutor.executePipeline()`. Currently the pipeline executor builds its own context with only step outputs and `brandName` -- it lacks `current_date`, `current_time`, etc.
2. **Seed pipeline context with standard variables:** In `executePipeline()` in `pipeline-executor.js` (~line 46), initialize the context object with the passed-in template vars: `Object.assign(context, templateContext)`
3. **In the email step handler (Bug #2):** Apply `resolveTemplateVars()` to `subject` and `bodyMarkdown` using the merged context (standard vars + step outputs) before writing to cloud_outbox
4. This ensures `{{current_date}}`, `{{step1_output}}`, `{{brand_name}}`, etc. all resolve in email fields

**Validation:** Email subject shows "Your Weekly AI Job Application Package - March 23, 2026" instead of raw `{{current_date}}`.

---

## Bug #4: Duplicate Execution

**Root cause:** `lastRun` is updated at the END of task execution (after all pipeline steps complete). The scheduler runs every 5 minutes with a 30-minute time window. If a pipeline takes >5 minutes to complete (plausible for a 6-step AI pipeline with research), the next scheduler tick sees the task as still due (no `lastRun` update yet) and starts a second execution.

The lock mechanism (`cloud_locks/{taskId}`) prevents truly concurrent execution but has a 10-minute expiry. If the first run takes >10 minutes, the lock expires and the second run can proceed.

**Fix:**
1. Write a preliminary `lastRun` timestamp at the START of execution (before running pipeline steps) with `lastExecutor: 'cloud_running'`
2. `isTaskDue()` should check these states:
   - If `lastExecutor === 'cloud_running'` AND `lastRun` is within the last 15 minutes: skip (still running)
   - If `lastExecutor === 'cloud_running'` AND `lastRun` is older than 15 minutes: treat as eligible (previous run died/timed out, allow retry)
   - If `lastExecutor === 'cloud'` AND `lastRun` is within the current frequency window: skip (already completed)
   - If `lastExecutor === 'cloud_failed'`: treat as eligible for retry on next frequency cycle (don't block)
3. On successful completion, update `lastRun` with `lastExecutor: 'cloud'`
4. On failure, update with `lastExecutor: 'cloud_failed'` and a `lastError` field. Write to a separate `lastRunAttempt` field so the frequency logic (`lastRun` for daily/weekly checks) isn't polluted by failed attempts
5. The Cloud Function timeout is 300 seconds (5 min). The lock expires after 10 minutes. The 15-minute staleness window for `cloud_running` covers both scenarios (function timeout + lock expiry + buffer)

**Validation:** Run automation, verify only one email is sent. Check logs show "already running" or "already completed" for subsequent ticks.

---

## Bug #5: Mail Timestamps Show UTC Instead of Local Time

**Root cause:** `mailRenderCombinedInbox()` at line 181543 strips the timezone offset from the raw date string but doesn't convert to local time:
```javascript
var dateStr = (msg.date || '').replace(/\s*[+-]\d{4}$/, '');
```
This displays "Mon, 23 Mar 2026 12:08:06" (UTC time with offset removed) instead of the local equivalent.

The email detail view has the same issue for Gmail messages -- `mailOpenGmailMessage` passes the raw `data.date` to `mailSetDetailHeader`. Note: Outlook detail view already converts correctly using `new Date(data.receivedDateTime).toLocaleString()`.

**Fix:**
1. Parse the email date string into a `Date` object: `new Date(msg.date)`
2. Format using `toLocaleDateString()` and `toLocaleTimeString()` (same pattern as the Sent tab which already does this correctly at line 179272-179273)
3. Display format: `"Mon, Mar 23 7:08 AM"` (local time, no timezone label)
4. Apply to both inbox list view (`mailRenderCombinedInbox`) and detail view header
5. Handle invalid dates gracefully (fallback to raw string if `Date` parse fails)

**Validation:** Email timestamps show local time (CST for Austin). The "Mon, 23 Mar 2026 12:08:06 +0000" UTC timestamp should display as "Mon, Mar 23 7:08 AM".

---

## Files Modified

| File | Changes |
|------|---------|
| `functions/lib/scheduler.js` | Bug #1 (diagnostic logging in getEnabledUsers/getDueTasks/isTaskDue) |
| `functions/lib/pipeline-executor.js` | Bug #2 (add email step handler with cloud_outbox write), Bug #3 (template context seeding) |
| `functions/lib/executor.js` | Bug #3 (pass buildTemplateContext to pipeline executor), Bug #4 (early lastRun write) |
| `functions/lib/firestore-helpers.js` | Bug #4 (updateAutomationLastRun with status/lastRunAttempt) |
| `functions/index.js` | Bug #1 (additional logging) |
| `RoweOS/dist/index.html` | Bug #2 (processCloudOutbox client pickup), Bug #5 (mail timestamp conversion) |

## Execution Order

1. Bug #1 first (diagnostic logging) -- deploy and check logs to confirm root cause
2. Bug #4 (dedup) -- prevents duplicate execution while we fix other issues
3. Bug #2 + #3 (email step handler + template vars) -- these are intertwined
4. Bug #5 (mail timestamps) -- independent UI fix

## Out of Scope

- Client-side scheduler fixes (Cloud Functions is the primary path once fixed)
- Email logo not displaying (separate issue mentioned by user)
- Scavenger `cloudSchedulerEnabled` being undefined (separate from automation execution)
