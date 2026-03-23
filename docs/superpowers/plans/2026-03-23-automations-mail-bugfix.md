# Automations + Mail Bugfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Cloud Functions automation scheduler to reliably execute pipelines, add cloud outbox email pattern, fix template variables, prevent duplicates, and fix mail timestamps.

**Architecture:** Diagnostic-first approach for Bug #1 (deploy logging, read logs, then fix). Cloud outbox pattern for email steps (server composes, client sends). Early lastRun write for dedup. Date object parsing for mail timestamps.

**Tech Stack:** Firebase Cloud Functions (Node.js), Firestore, vanilla JS (ES5) in index.html

**Spec:** `docs/superpowers/specs/2026-03-23-automations-mail-bugfix-design.md`

**Critical rules (from CLAUDE.md):**
- ES5 only in index.html: no arrow functions, no let/const, no template literals
- Cloud Functions (Node.js): modern JS is fine (async/await used throughout)
- Tag changes with version: `// v25.6: Description`

---

### Task 1: Scheduler Diagnostic Logging (Bug #1)

**Files:**
- Modify: `functions/lib/scheduler.js:15-41` (getEnabledUsers)
- Modify: `functions/lib/scheduler.js:177-194` (getDueTasks)
- Modify: `functions/lib/scheduler.js:77-130` (isTaskDue)
- Modify: `functions/lib/firestore-helpers.js:84-91` (getUserAutomations -- add doc.id)

- [ ] **Step 1: Fix getUserAutomations to include doc.id**

The function at line 84-91 pushes `doc.data()` but does NOT include the Firestore document ID. The executor needs `task.id` for locking and lastRun updates. This is likely a root cause of execution failures.

Replace lines 84-91:
```javascript
async function getUserAutomations(uid) {
  var db = getDb();
  var snap = await db.collection('roweos_users/' + uid + '/automations').get();
  if (snap.empty) return [];
  var automations = [];
  snap.forEach(function(doc) {
    var data = doc.data();
    data.id = doc.id; // v25.6: Include doc ID for locking and lastRun updates
    automations.push(data);
  });
  return automations;
}
```

- [ ] **Step 2: Add logging to getEnabledUsers**

After line 30 (inside the `keysDoc.exists` check), add logging for the double-gate:

```javascript
      if (keysDoc.exists) {
        var data = keysDoc.data();
        if (data.cloudSchedulerEnabled) {
          users.push({ uid: uid, apiKeys: data });
        } else {
          // v25.6: Log double-gate failure
          console.warn('[Scheduler] User ' + uid.slice(0,6) + ' has parent flag but api_keys.cloudSchedulerEnabled is ' + data.cloudSchedulerEnabled);
        }
      } else {
        // v25.6: Log missing api_keys doc
        console.warn('[Scheduler] User ' + uid.slice(0,6) + ' has parent flag but no api_keys doc');
      }
```

- [ ] **Step 3: Add logging to getDueTasks**

Replace getDueTasks (lines 177-194) with:

```javascript
async function getDueTasks(uid, timezone) {
  var automations = await helpers.getUserAutomations(uid);
  var now = getUserLocalTime(timezone);
  var dueTasks = [];

  // v25.6: Diagnostic logging
  var tag = '[Scheduler:' + uid.slice(0,6) + ']';
  console.log(tag + ' getDueTasks: ' + automations.length + ' automations found, timezone: ' + timezone + ', local time: ' + now.toISOString());

  for (var i = 0; i < automations.length; i++) {
    var task = automations[i];
    if (task.action === 'none') {
      console.log(tag + ' Task "' + (task.name || task.id) + '": SKIP (action=none)');
      continue;
    }
    if (!task.enabled) {
      console.log(tag + ' Task "' + (task.name || task.id) + '": SKIP (disabled)');
      continue;
    }
    var due = isTaskDue(task, now, tag);
    if (due) {
      dueTasks.push(task);
    }
  }

  console.log(tag + ' getDueTasks: ' + dueTasks.length + ' tasks due');
  return dueTasks;
}
```

- [ ] **Step 4: Add logging to isTaskDue**

Update `isTaskDue` signature to accept `tag` parameter. Add logging at each decision point:

```javascript
function isTaskDue(task, now, tag) {
  tag = tag || '[Scheduler]';
  var taskName = task.name || task.id || 'unknown';

  if (!task.enabled) { return false; }

  var freq = task.frequency || task.recurType || 'none';
  var taskTime = task.time || '09:00';
  var lastRun = task.lastRun ? new Date(task.lastRun) : null;

  // v25.6: Handle Firestore Timestamp objects (Admin SDK returns objects with toDate())
  if (task.lastRun && typeof task.lastRun === 'object' && typeof task.lastRun.toDate === 'function') {
    lastRun = task.lastRun.toDate();
    console.warn(tag + ' Task "' + taskName + '": lastRun is Firestore Timestamp, converting via toDate()');
  } else if (task.lastRun && typeof task.lastRun === 'object' && task.lastRun.seconds) {
    lastRun = new Date(task.lastRun.seconds * 1000);
    console.warn(tag + ' Task "' + taskName + '": lastRun is raw Timestamp object, converting via .seconds');
  }

  var currentTime = now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0');
  var timeDiff = timeToMinutes(currentTime) - timeToMinutes(taskTime);

  // v25.6: Log time comparison
  console.log(tag + ' Task "' + taskName + '": freq=' + freq + ', time=' + taskTime + ', current=' + currentTime + ', timeDiff=' + timeDiff + 'min, lastRun=' + (lastRun ? lastRun.toISOString() : 'never'));
```

Then at the time window check (before `if (timeDiff < 0 || timeDiff > 30) return false;`), add:

```javascript
  if (freq !== 'custom') {
    if (timeDiff < 0 || timeDiff > 30) {
      console.log(tag + ' Task "' + taskName + '": NOT DUE (outside 0-30min window, timeDiff=' + timeDiff + ')');
      return false;
    }
  }
```

And at each frequency return, log the result.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add functions/lib/scheduler.js functions/lib/firestore-helpers.js && git commit -m "fix: add scheduler diagnostic logging, fix getUserAutomations missing doc.id"
```

- [ ] **Step 6: Deploy and check logs**

```bash
cd /Volumes/roweOS && FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions
```

Wait 5-10 minutes, then check logs:
```bash
firebase functions:log --only runScheduledTasks 2>&1 | head -60
```

Look for the diagnostic output to identify the actual root cause.

---

### Task 2: Duplicate Execution Prevention (Bug #4)

**Files:**
- Modify: `functions/lib/executor.js:64-70` (executeTask start)
- Modify: `functions/lib/executor.js:356` (writeResultAndUpdateLastRun)
- Modify: `functions/lib/firestore-helpers.js:151-163` (updateAutomationLastRun)
- Modify: `functions/lib/scheduler.js:77-130` (isTaskDue)

- [ ] **Step 1: Add early lastRun write at execution start**

In `executor.js`, after the lock acquisition at line 70, add:

```javascript
    var locked = await helpers.setCloudLock(uid, String(task.id), true);
    if (!locked) {
      console.log('[Executor] Task', task.name, 'already locked, skipping');
      return { success: false, error: 'Task locked' };
    }

    // v25.6: Write preliminary lastRun to prevent duplicate pickup
    await helpers.updateAutomationLastRun(uid, String(task.id), new Date().toISOString(), 'cloud_running');
```

- [ ] **Step 2: Update updateAutomationLastRun to accept status**

Replace lines 151-163 of firestore-helpers.js:

```javascript
async function updateAutomationLastRun(uid, taskId, timestamp, executor, errorMsg) {
  var db = getDb();
  var idStr = String(taskId);
  var docRef = db.doc('roweos_users/' + uid + '/automations/' + idStr);
  var doc = await docRef.get();
  if (doc.exists) {
    var update = {
      lastRun: timestamp,
      lastExecutor: executor || 'cloud'
    };
    // v25.6: For failed runs, clear lastRun back to previous value
    // so frequency logic isn't polluted by failures
    if (executor === 'cloud_failed') {
      var prevData = doc.data();
      update = {
        lastRun: prevData.lastRun || null, // Restore previous lastRun
        lastRunAttempt: timestamp,
        lastExecutor: 'cloud_failed',
        lastError: errorMsg || 'Unknown error'
      };
    }
    await docRef.set(update, { merge: true });
  }
}
```

- [ ] **Step 3: Update failure path in executor.js**

Find the catch/error handler in executeTask (around line 205-211). Update the failure path:

```javascript
    // v25.6: Mark as failed (doesn't pollute lastRun for frequency checks)
    try {
      await helpers.updateAutomationLastRun(uid, String(task.id), new Date().toISOString(), 'cloud_failed', err.message);
    } catch (e) {}
    try { await helpers.setCloudLock(uid, String(task.id), false); } catch (e) {}
```

- [ ] **Step 4: Update isTaskDue to check lastExecutor state**

In `isTaskDue()`, after the `lastRun` variable is set and before the time check, add:

```javascript
  // v25.6: Check execution state to prevent duplicates
  var lastExecutor = task.lastExecutor || '';
  if (lastRun && lastExecutor === 'cloud_running') {
    var runningMinutes = (now.getTime() - lastRun.getTime()) / 60000;
    if (runningMinutes < 15) {
      if (tag) console.log(tag + ' Task "' + taskName + '": NOT DUE (still running, ' + Math.round(runningMinutes) + 'min ago)');
      return false;
    }
    // Stale cloud_running — previous run died, allow retry
    if (tag) console.warn(tag + ' Task "' + taskName + '": stale cloud_running (' + Math.round(runningMinutes) + 'min), allowing retry');
  }
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add functions/lib/executor.js functions/lib/firestore-helpers.js functions/lib/scheduler.js && git commit -m "fix: write early lastRun to prevent duplicate execution"
```

---

### Task 3: Email Step Handler + Template Context (Bugs #2 + #3)

**Files:**
- Modify: `functions/lib/pipeline-executor.js:185-192` (add email handler before library step)
- Modify: `functions/lib/pipeline-executor.js:46-50` (seed context with template vars)
- Modify: `functions/lib/executor.js:296-326` (pass template context to pipeline executor)

- [ ] **Step 1: Pass template context into handlePipelineAction**

In `executor.js`, find `handlePipelineAction` (~line 296). It currently calls:
```javascript
var pipeResult = await pipelineExecutor.executePipeline(uid, task, apiKeys, brands, allOps);
```

Update `handlePipelineAction` to accept and pass the template context:

```javascript
async function handlePipelineAction(uid, task, apiKeys, brands, templateContext) {
  var customOps = await helpers.getUserCustomOps(uid);
  var generatedOps = await helpers.getUserGeneratedBrandOps(uid);
  var allOps = [].concat(customOps, generatedOps);

  // v25.6: Pass template context for {{current_date}} etc. in pipeline steps
  var pipeResult = await pipelineExecutor.executePipeline(uid, task, apiKeys, brands, allOps, templateContext);
```

Also update the call site in executeTask (~line 113-117) to pass template context:

```javascript
if (task.type === 'pipeline' && task.steps) {
  var pipeResult = await handlePipelineAction(uid, task, apiKeys, brands, templateCtx);
  await finishTask(uid, task, brand, pipeResult, startTime);
  return pipeResult;
}
```

Where `templateCtx` is the result of `buildTemplateContext()` already called earlier in executeTask.

- [ ] **Step 2: Seed pipeline context with template vars**

In `pipeline-executor.js`, update `executePipeline` signature and context initialization (lines 37-50):

```javascript
async function executePipeline(uid, task, apiKeys, brands, allOps, templateContext) {
  var steps = task.steps || [];
  if (steps.length === 0) {
    return { completedSteps: [], failedSteps: [], context: {} };
  }

  var brandIdx = task.brandIdx !== undefined ? parseInt(task.brandIdx) : 0;
  var brand = brands[brandIdx] || brands[0] || {};

  var context = {
    brandName: brand.shortName || brand.name || '',
    _brandIdx: brandIdx,
    _uid: uid
  };

  // v25.6: Seed with template variables (current_date, current_time, brand_name, etc.)
  if (templateContext) {
    var keys = Object.keys(templateContext);
    for (var k = 0; k < keys.length; k++) {
      if (!context[keys[k]]) context[keys[k]] = templateContext[keys[k]];
    }
  }
```

- [ ] **Step 3: Add email step handler**

In `pipeline-executor.js`, before the library step handler (~line 190), add the email handler:

```javascript
  // v25.6: Email step — compose and write to cloud_outbox for client pickup
  if (action === 'email') {
    var helpers = require('./firestore-helpers');
    var emailTo = step.target && step.target.emailTo ? step.target.emailTo : '';
    var emailSubject = step.target && step.target.emailSubject ? step.target.emailSubject : step.name || 'Automation Email';
    var emailBody = step.target && step.target.emailBody ? step.target.emailBody : '';

    // Resolve template variables ({{current_date}}, {{step1_output}}, etc.)
    emailTo = resolveVars(emailTo, context);
    emailSubject = resolveVars(emailSubject, context);
    emailBody = resolveVars(emailBody, context);

    // If body is empty/placeholder, use concatenated outputs from previous steps
    if (!emailBody || emailBody === step.name || emailBody.length < 20) {
      var parts = [];
      for (var ei = 0; ei < i; ei++) {
        var prevKey = steps[ei].outputKey || ('step' + ei + '_output');
        var prevOutput = context[prevKey];
        if (prevOutput && prevOutput.length > 10) parts.push(prevOutput);
      }
      emailBody = parts.join('\n\n---\n\n');
    }

    if (!emailTo) {
      throw new Error('Email step missing recipient (emailTo)');
    }

    // Write to cloud_outbox for client-side pickup and sending
    var db = helpers.getDb();
    await db.collection('roweos_users/' + uid + '/cloud_outbox').add({
      to: emailTo,
      subject: emailSubject,
      bodyMarkdown: emailBody,
      status: 'pending',
      createdAt: new Date().toISOString(),
      automationId: task.id || '',
      automationName: task.name || '',
      pipelineStepIndex: i,
      brandIdx: brandIdx
    });

    console.log('[Pipeline] Email step: queued to cloud_outbox for ' + emailTo + ', subject: ' + emailSubject.substring(0, 50));
    return 'Email queued for delivery to ' + emailTo;
  }
```

- [ ] **Step 4: Use existing resolveTemplateVars**

`pipeline-executor.js` already has `resolveTemplateVars` at line 18 (supports `{{var}}` and `{{var|truncate:N}}`). The email step handler in Step 3 uses `resolveVars` -- replace all `resolveVars(` calls with `resolveTemplateVars(` to use the existing function. Do NOT create a duplicate function.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add functions/lib/executor.js functions/lib/pipeline-executor.js && git commit -m "feat: add email step handler with cloud outbox, pass template context to pipeline"
```

---

### Task 4: Client-Side Cloud Outbox Pickup (Bug #2 continued)

**Files:**
- Modify: `RoweOS/dist/index.html` (add processCloudOutbox function)

- [ ] **Step 1: Add processCloudOutbox function**

In the JS section of index.html (near the mail/email functions), add:

```javascript
// v25.6: Process pending emails from cloud_outbox (sent by Cloud Functions pipelines)
function processCloudOutbox() {
  if (!firebase.auth().currentUser) return;
  var uid = firebase.auth().currentUser.uid;
  var db = firebase.firestore();

  db.collection('roweos_users/' + uid + '/cloud_outbox')
    .where('status', '==', 'pending')
    .get()
    .then(function(snap) {
      if (snap.empty) return;
      console.log('[CloudOutbox] Found ' + snap.size + ' pending emails');

      snap.forEach(function(doc) {
        var email = doc.data();
        var docRef = doc.ref;

        // Mark as processing to prevent double-send
        docRef.set({ status: 'processing' }, { merge: true });

        // Convert markdown body to HTML using existing mail compose flow
        var htmlBody = '';
        try {
          if (typeof marked !== 'undefined' && email.bodyMarkdown) {
            htmlBody = marked.parse(email.bodyMarkdown);
          } else {
            htmlBody = (email.bodyMarkdown || '').replace(/\n/g, '<br>');
          }
        } catch(e) {
          htmlBody = (email.bodyMarkdown || '').replace(/\n/g, '<br>');
        }

        // Wrap in branded email template if available
        try {
          if (typeof generateBrandedEmail === 'function') {
            var brandIdx = email.brandIdx || 0;
            htmlBody = generateBrandedEmail(htmlBody, brandIdx);
          }
        } catch(e) {}

        // Send via existing mail outbox mechanism
        // Write to the local mail outbox, then use mailSendOutboxItem to send
        // The agent MUST search index.html for the actual outbox send function name
        // (likely mailSendOutboxItem, addToMailOutbox, or similar) and use it here.
        //
        // Pattern: write the composed email into the mail outbox data structure
        // that the existing Send flow uses, then trigger the send.
        // Search for: mailSendOutboxItem, _mailOutbox, mailComposeAndSend, sendMailMessage
        try {
          // Use the Gmail/Outlook compose+send path directly
          // The agent must read the actual mail send implementation and adapt
          var mailAccount = getDefaultMailAccount(); // or however the active account is retrieved
          if (mailAccount && mailAccount.provider === 'gmail') {
            mailSendRawGmail(mailAccount, email.to, email.subject, htmlBody)
              .then(function() {
                docRef.set({ status: 'sent', sentAt: new Date().toISOString() }, { merge: true });
                console.log('[CloudOutbox] Sent email to ' + email.to + ': ' + email.subject);
              })
              .catch(function(err) {
                docRef.set({ status: 'failed', error: err.message, failedAt: new Date().toISOString() }, { merge: true });
                console.error('[CloudOutbox] Failed to send to ' + email.to + ':', err.message);
              });
          } else if (mailAccount && mailAccount.provider === 'outlook') {
            mailSendRawOutlook(mailAccount, email.to, email.subject, htmlBody)
              .then(function() {
                docRef.set({ status: 'sent', sentAt: new Date().toISOString() }, { merge: true });
                console.log('[CloudOutbox] Sent email to ' + email.to + ': ' + email.subject);
              })
              .catch(function(err) {
                docRef.set({ status: 'failed', error: err.message, failedAt: new Date().toISOString() }, { merge: true });
                console.error('[CloudOutbox] Failed to send to ' + email.to + ':', err.message);
              });
          } else {
            console.warn('[CloudOutbox] No mail account configured, keeping as pending');
            docRef.set({ status: 'pending' }, { merge: true });
          }
        } catch(sendErr) {
          docRef.set({ status: 'failed', error: sendErr.message, failedAt: new Date().toISOString() }, { merge: true });
        }
      });
    })
    .catch(function(err) {
      console.error('[CloudOutbox] Error querying outbox:', err);
    });
}
```

**CRITICAL NOTE:** The function names `mailSendRawGmail`, `mailSendRawOutlook`, and `getDefaultMailAccount` are placeholders. The agent MUST search index.html for the actual mail sending functions before implementing. Search for: `mailSendOutboxItem`, `gmail-proxy`, `_gmailSendFn`, `sendMailMessage`, `mailComposeSend`. Read the existing send flow (around line 107264-107445 and line 174661) to understand how emails are actually sent, then adapt the cloud outbox pickup to use the same mechanism. The core pattern is: build a raw MIME message, POST to `/api/gmail-proxy` with action `send` and the user's OAuth access token.

Also add a staleness check for `processing` status: query for `status == 'processing'` docs older than 5 minutes and revert them to `pending` before processing new `pending` docs.

- [ ] **Step 2: Call processCloudOutbox on page load and periodically**

Find `initScheduledTasksEngine()` (~line 171840) or the main app initialization. Add:

```javascript
  // v25.6: Process cloud outbox emails on load and every 60 seconds
  setTimeout(function() { processCloudOutbox(); }, 10000); // 10 sec after load
  setInterval(function() { processCloudOutbox(); }, 60000); // Every 60 sec
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat: add cloud outbox email pickup on client side"
```

---

### Task 5: Mail Timestamp Fix (Bug #5)

**Files:**
- Modify: `RoweOS/dist/index.html:181543` (mailRenderCombinedInbox date)
- Modify: `RoweOS/dist/index.html:181870` (mailOpenGmailMessage date passthrough)
- Modify: `RoweOS/dist/index.html:182953` (mailSetDetailHeader date display)

- [ ] **Step 1: Add a mail date formatting helper**

In the JS section near the mail functions, add:

```javascript
// v25.6: Convert email date string to local time display
function formatMailDate(rawDate) {
  if (!rawDate) return '';
  try {
    var d = new Date(rawDate);
    if (isNaN(d.getTime())) return rawDate; // Fallback for unparseable dates
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var hours = d.getHours();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    var h12 = hours % 12 || 12;
    var mins = d.getMinutes();
    mins = mins < 10 ? '0' + mins : String(mins);
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ' ' + h12 + ':' + mins + ' ' + ampm;
  } catch(e) {
    return rawDate; // Fallback to raw string
  }
}
```

- [ ] **Step 2: Update inbox date rendering**

In `mailRenderCombinedInbox`, replace line 181543:
```javascript
var dateStr = (msg.date || '').replace(/\s*[+-]\d{4}$/, '');
```

With:
```javascript
// v25.6: Convert to local timezone
var dateStr = formatMailDate(msg.date);
```

- [ ] **Step 3: Update Gmail detail view date**

In `mailOpenGmailMessage` (~line 181870), where it calls `mailSetDetailHeader`, change the date argument:

Replace:
```javascript
mailSetDetailHeader(data.from || '', data.to || '', data.date || '', data.subject);
```

With:
```javascript
// v25.6: Convert Gmail date to local time for detail view
mailSetDetailHeader(data.from || '', data.to || '', formatMailDate(data.date), data.subject);
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: convert mail timestamps from UTC to local timezone"
```

---

### Task 6: Deploy + Verify

- [ ] **Step 1: Deploy Cloud Functions**

```bash
cd /Volumes/roweOS && FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions
```

- [ ] **Step 2: Check scheduler logs after 5-10 minutes**

```bash
cd /Volumes/roweOS && firebase functions:log --only runScheduledTasks 2>&1 | head -80
```

Look for:
- `getDueTasks: N automations found` -- confirms automations are being read
- Task-level diagnostics -- shows why each task is/isn't due
- Any `cloud_running` dedup logs

- [ ] **Step 3: Update ROWEOS_VERSION**

In index.html, update `var ROWEOS_VERSION = 'v25.5';` to `var ROWEOS_VERSION = 'v25.6';`

- [ ] **Step 4: Deploy to Vercel production**

```bash
cd /Volumes/roweOS && ./deploy.sh
```

- [ ] **Step 5: Verify mail timestamps**

Open RoweOS in browser, go to Mail inbox. Timestamps should show local time (e.g., "Mon, Mar 23 2026 7:08 AM") instead of UTC.

- [ ] **Step 6: Verify cloud outbox**

If any automation has run, check browser console for `[CloudOutbox]` logs on page load.

- [ ] **Step 7: Commit final state**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "chore: bump version to v25.6"
```
