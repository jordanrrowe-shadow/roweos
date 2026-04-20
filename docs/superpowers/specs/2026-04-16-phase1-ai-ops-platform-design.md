# Phase 1: AI Operations Platform - Design Spec

> **Three-phase strategic trajectory:** Phase 1 (AI Ops Foundation) -> Phase 2 (Content Intelligence Absorbed) -> Phase 3 (Enterprise Platform + API)
> This spec covers Phase 1 only.

**Goal:** Transform RoweOS from a stateful AI platform into a genuinely intelligent one by adding Google Cloud integrations that deepen the AI's knowledge of each brand and make automations event-driven.

---

## Sub-Project 1: Speech-to-Text (P0)

### Summary
Add a microphone button to Studio and Chat views that streams voice to Google Speech-to-Text REST API and inserts transcription as prompt text.

### Architecture
- **Chunked REST recognition** (not streaming) - Google REST `POST /v1/speech:recognize` with Base64 audio
- Browser `MediaRecorder` captures audio (WebM/Opus on Chrome, MP4 on iOS Safari)
- Reuses existing Google API key from `getApiKey('google')` - same key, needs Speech-to-Text API enabled in GCP console
- 60-second recording hard limit
- Cross-platform: desktop + mobile PWA + iOS Safari

### Integration Points
- Chat landing: `<textarea id="agentCommand">` - mic button in `.chat-input-tools-v2` toolbar
- Chat followup: `<textarea id="followupCommand">` - mic button in followup toolbar
- Studio: `<textarea id="studioContext">` - mic button in `.studio-v2-context-header` next to Smart Fill

### Files
- **Create:** `src/js/core/32-voice-dictation.js` - entire voice module (~200 lines)
- **Modify:** `src/html/shared/01-blake.html` - add mic buttons to landing + followup toolbars
- **Modify:** `src/html/brand/02-studio.html` - add mic button to context header
- **Modify:** `src/css/core/01-base.css` - mic button states (idle, recording w/ red pulse, processing)

### Key Functions
- `initVoiceDictation()` - auto-init on DOMContentLoaded
- `toggleVoiceRecording(targetTextareaId, btnEl)` - start/stop toggle
- `startVoiceRecording()` / `stopVoiceRecording()` - MediaRecorder lifecycle
- `transcribeAudio(blob)` - blob -> base64 -> Google REST API -> insert text
- `buildSpeechRequest(base64Audio, mimeType)` - request body with encoding detection
- `blobToBase64(blob, callback)` - FileReader wrapper

### Button States (CSS)
- `.voice-mic-btn` - idle, 36px circle, inherits `.chat-tool-btn-v2`
- `.voice-mic-btn.recording` - red #ef4444, pulse ring animation
- `.voice-mic-btn.processing` - gold, spinner animation

### Error Handling
| Condition | Response |
|-----------|----------|
| No Google API key | Toast: "Google API key required for voice input. Add in Settings." |
| Mic denied | Toast: "Microphone access denied. Enable in device Settings." |
| MediaRecorder unsupported | Toast: "Voice input not supported in this browser" |
| Empty transcript | Toast: "No speech detected. Try again." |
| API quota exceeded | Toast: "Speech API quota exceeded. Try again later." |
| SERVICE_DISABLED 403 | Toast: "Enable Speech-to-Text API in Google Cloud Console for your project." |

### iOS/Mobile Notes
- iOS Safari: `audio/mp4` MIME only (check `MediaRecorder.isTypeSupported()`)
- PWA mic permission: HTTPS required (already satisfied), one-time system prompt
- `getUserMedia` + `MediaRecorder` supported from iOS 14.3+

---

## Sub-Project 2: Cloud Pub/Sub Scheduler (P0)

### Summary
Replace the 5-minute polling scheduler with event-driven Pub/Sub triggers. Each user gets a Cloud Scheduler job that fans out to per-automation Pub/Sub messages.

### Current Architecture (3 parallel paths)
1. **Firebase Cloud Functions** - `runScheduledTasks` every 5 min, queries enabled users, sequential execution
2. **Vercel Serverless Cron** - `scheduler.js` every 1 min (per vercel.json), duplicates all logic
3. **Client-side** - `checkAndRunDueTasks()` no-ops if cloud scheduler enabled

### New Architecture
- **Per-user Cloud Scheduler jobs** (not per-automation, to avoid $50/mo cost at scale)
- **Pub/Sub topics:** `roweos-automation-dispatch` (execution), `roweos-schedule-mutations` (CRUD), `roweos-automation-dispatch-dlq` (failures)
- **Cloud Function subscribers:** `executeAutomationFromPubSub`, `manageSchedulerJob`, `handleAutomationDlq`
- **Client notifies Pub/Sub on CRUD:** `notifyAutomationChange()` -> POST `/api/automation-events`
- **Real-time completion:** Replace `pickUpCloudResults()` polling with Firestore `onSnapshot`

### Files
- **Create:** `functions/lib/scheduler-job-manager.js` - cron computation, job CRUD
- **Create:** `functions/lib/pubsub-helpers.js` - publish helpers
- **Create:** `RoweOS/dist/api/automation-events.js` - Vercel endpoint for client CRUD events
- **Modify:** `functions/index.js` - add 3 new exports (keep existing during migration)
- **Modify:** `src/js/core/17-automations.js` - add `notifyAutomationChange()` call sites
- **Modify:** `RoweOS/dist/vercel.json` - add route, adjust cron schedule

### Migration Strategy (5 phases)
1. **Parallel Run** - deploy Pub/Sub alongside existing polling (no regressions possible)
2. **Migration Job** - bootstrap Cloud Scheduler jobs for all existing automations
3. **Real-time Results** - swap `pickUpCloudResults()` to `onSnapshot`
4. **Cutover** - disable Vercel cron, reduce Firebase polling to 30min backstop
5. **Cleanup** - remove polling entirely after 4 weeks stable

### Cost Model (per-user jobs)
| Item | Current | Pub/Sub |
|------|---------|---------|
| Cloud Scheduler | $0 | ~$0.70/mo (10 jobs) |
| Pub/Sub | $0 | ~$0/mo (free tier) |
| Cloud Functions | $0 | $0 (same compute) |

### Idempotency (3 layers)
1. Pub/Sub message dedup via correlation `messageId`
2. `lastExecutor: 'cloud_running'` lock (15-min window)
3. `isTaskDue()` frequency check prevents re-execution within window

### Key Constraints
- Cloud Function timeout: 540s (Deep Research can run 9 min)
- Pub/Sub ack-deadline must match: 540s
- Scavenger pipeline stays on polling backstop (separate concern)
- ES5 for all client-side code

---

## Sub-Project 3: Document AI (P1) - To Be Designed

### Summary
Auto-parse uploaded documents (invoices, receipts, contracts, brand guides) in Library and Inventory using Google Document AI.

### Deferred
Architecture design pending completion of Speech-to-Text and Pub/Sub sub-projects.

---

## Sub-Project 4: Vertex AI Search (P1) - To Be Designed

### Summary
Semantic search across Identity, conversations, Library files, and brand knowledge. Replaces current string matching with vector-based retrieval.

### Deferred
Architecture design pending. Depends on Document AI feeding structured data into the search index.

---

## Sub-Project 5: BigQuery Analytics (P2) - To Be Designed

### Summary
Instrumentation pipeline + real analytics dashboards in the Analytics view. Track ROI on AI-generated content.

### Deferred
Requires instrumentation sprint first to capture the data BigQuery would analyze.
