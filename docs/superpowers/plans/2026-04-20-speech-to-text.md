# Speech-to-Text Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add microphone buttons to Chat (landing + followup) and Studio views that record audio via MediaRecorder, send to Google Speech-to-Text REST API, and insert the transcript into the target textarea.

**Architecture:** Browser `MediaRecorder` captures audio in chunks. On stop, the blob is converted to base64 and POSTed to `https://speech.googleapis.com/v1/speech:recognize`. The transcript text is inserted at cursor position into the associated textarea. Reuses existing `getApiKey('google')` for the API key. 60-second hard limit. Cross-platform: desktop Chrome (WebM/Opus), iOS Safari (MP4), Android Chrome (WebM/Opus).

**Tech Stack:** Vanilla ES5 JavaScript, modular source (`src/`) built into `RoweOS/dist/index.html` via `src/build.sh`

**Spec:** `docs/superpowers/specs/2026-04-16-phase1-ai-ops-platform-design.md` (Sub-Project 1)

**Critical Constraints:**
- ES5 only (no arrow functions, let/const, template literals, destructuring)
- Edit `src/` files only, never `RoweOS/dist/index.html` directly
- After any edit: run `bash src/build.sh` to regenerate
- No emojis in UI -- SVG icons only
- No test framework -- manual browser + mic testing

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| **Create** | `src/js/core/32-voice-dictation.js` | Voice dictation module (~200 lines) |
| **Modify** | `src/html/shared/01-blake.html` | Add mic buttons to landing + followup toolbars |
| **Modify** | `src/html/brand/02-studio.html` | Add mic button to Context & Notes header |
| **Modify** | `src/css/core/01-base.css` | Mic button states (idle, recording, processing) |

Build script (`src/build.sh`) already handles new files in `src/js/core/` automatically -- `concat_sorted` picks up files sorted by numeric prefix. No build.sh changes needed. File `32-voice-dictation.js` sorts between `31-google-drive.js` and `33-scribe.js`.

---

### Task 1: Add Voice Mic Button CSS

**Files:**
- Modify: `src/css/core/01-base.css`

- [ ] **Step 1: Find insertion point**

Search for `.studio-v2-smart-fill-btn:hover` (around line 7283). Insert the mic button styles AFTER the smart-fill-btn hover rule block (after the closing `}`).

- [ ] **Step 2: Add mic button CSS**

Insert after the `.studio-v2-smart-fill-btn:hover { ... }` block:

```css
    /* v29.3: Voice dictation mic button */
    .voice-mic-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
      color: var(--text-secondary, #999);
      flex-shrink: 0;
    }
    .voice-mic-btn svg {
      width: 16px;
      height: 16px;
    }
    .voice-mic-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    html.light-mode .voice-mic-btn:hover {
      background: rgba(0, 0, 0, 0.06);
    }
    .voice-mic-btn.recording {
      background: #ef4444;
      color: #fff;
      animation: mic-pulse 1.5s ease-in-out infinite;
    }
    .voice-mic-btn.processing {
      background: var(--accent, #a89878);
      color: #000;
      pointer-events: none;
    }
    @keyframes mic-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
    }
    /* Studio context header mic -- inline with Smart Fill */
    .studio-voice-mic-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1px solid var(--border-subtle, #333);
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      color: var(--text-secondary, #999);
      margin-left: 6px;
    }
    .studio-voice-mic-btn svg {
      width: 12px;
      height: 12px;
    }
    .studio-voice-mic-btn:hover {
      border-color: var(--gold, #a89878);
      color: var(--gold, #a89878);
    }
    .studio-voice-mic-btn.recording {
      background: #ef4444;
      border-color: #ef4444;
      color: #fff;
      animation: mic-pulse 1.5s ease-in-out infinite;
    }
    .studio-voice-mic-btn.processing {
      background: var(--accent, #a89878);
      border-color: var(--accent, #a89878);
      color: #000;
      pointer-events: none;
    }
```

- [ ] **Step 3: Verify**

Run `bash src/build.sh`. Grep the output for `voice-mic-btn` and `mic-pulse` to confirm CSS is present. Open in browser and inspect that the keyframe animation is defined.

- [ ] **Step 4: Commit**

```bash
cd ~/Developer/roweOS && git add src/css/core/01-base.css && git commit -m "feat(voice): add mic button CSS with recording pulse and processing states v29.3"
```

---

### Task 2: Add Mic Button HTML to Chat Landing Toolbar

**Files:**
- Modify: `src/html/shared/01-blake.html`

- [ ] **Step 1: Find insertion point in landing toolbar**

In `src/html/shared/01-blake.html`, find the landing toolbar's `.chat-input-tools-v2` div (around line 35). The mic button goes AFTER the attach button (`id="landingAttachBtn"`) and BEFORE the brand selector (`.landing-brand-selector`). This places the mic as the second tool from the left.

- [ ] **Step 2: Add mic button HTML**

Insert AFTER the closing `</button>` of `landingAttachBtn` (after line 42) and BEFORE the `<!-- 2. Brand selector -->` comment (line 43):

```html
                <!-- v29.3: Voice dictation mic button -->
                <button class="chat-tool-btn-v2 tool-icon-btn voice-mic-btn" id="landingVoiceMicBtn" onclick="toggleVoiceRecording('agentCommand', this)" title="Voice input">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="1" width="6" height="11" rx="3"/>
                    <path d="M19 10v1a7 7 0 01-14 0v-1"/>
                    <path d="M12 18v4M8 22h8"/>
                  </svg>
                </button>
```

- [ ] **Step 3: Verify**

Run `bash src/build.sh`. Open browser, navigate to Chat view. Confirm the mic button appears in the landing toolbar between Attach and Brand selector. It should be a 36px circle with a mic SVG icon in `var(--text-secondary)` color.

- [ ] **Step 4: Commit**

```bash
cd ~/Developer/roweOS && git add src/html/shared/01-blake.html && git commit -m "feat(voice): add mic button to chat landing toolbar v29.3"
```

---

### Task 3: Add Mic Button HTML to Chat Followup Toolbar

**Files:**
- Modify: `src/html/shared/01-blake.html`

- [ ] **Step 1: Find insertion point in followup toolbar**

In the followup section, find the `.chat-input-tools-v2` div (around line 202). The mic button goes AFTER the attach button (`id="followupAttachBtn"`) and BEFORE the model selector (`.model-selector-wrapper`).

- [ ] **Step 2: Add mic button HTML**

Insert AFTER the closing `</button>` of `followupAttachBtn` (after line 209) and BEFORE the `<!-- 2. Model selector -->` comment (line 210):

```html
                <!-- v29.3: Voice dictation mic button -->
                <button class="chat-tool-btn-v2 tool-icon-btn voice-mic-btn" id="followupVoiceMicBtn" onclick="toggleVoiceRecording('followupCommand', this)" title="Voice input">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="1" width="6" height="11" rx="3"/>
                    <path d="M19 10v1a7 7 0 01-14 0v-1"/>
                    <path d="M12 18v4M8 22h8"/>
                  </svg>
                </button>
```

- [ ] **Step 3: Verify**

Run `bash src/build.sh`. Open browser, send a message in Chat to reveal the followup input. Confirm mic button appears between Attach and Model selector.

- [ ] **Step 4: Commit**

```bash
cd ~/Developer/roweOS && git add src/html/shared/01-blake.html && git commit -m "feat(voice): add mic button to chat followup toolbar v29.3"
```

---

### Task 4: Add Mic Button HTML to Studio Context Header

**Files:**
- Modify: `src/html/brand/02-studio.html`

- [ ] **Step 1: Find insertion point**

In `src/html/brand/02-studio.html`, find the first `.studio-v2-context-header` div (around line 438) that contains the "Context & Notes" label and Smart Fill button. The mic button goes AFTER the Smart Fill `</button>` and BEFORE the closing `</div>` of the context header.

- [ ] **Step 2: Add mic button HTML**

Insert AFTER the Smart Fill button's closing `</button>` (after line 443) and BEFORE `</div>` (line 444):

```html
                      <button class="studio-voice-mic-btn" id="studioVoiceMicBtn" onclick="toggleVoiceRecording('studioContext', this)" title="Voice input">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="1" width="6" height="11" rx="3"/>
                          <path d="M19 10v1a7 7 0 01-14 0v-1"/>
                          <path d="M12 18v4M8 22h8"/>
                        </svg>
                      </button>
```

- [ ] **Step 3: Verify**

Run `bash src/build.sh`. Open Studio view, confirm the mic icon appears in the "Context & Notes" header row next to Smart Fill. It should match the Smart Fill button scale (28px, smaller than chat buttons).

- [ ] **Step 4: Commit**

```bash
cd ~/Developer/roweOS && git add src/html/brand/02-studio.html && git commit -m "feat(voice): add mic button to studio context header v29.3"
```

---

### Task 5: Create Voice Dictation Module

**Files:**
- Create: `src/js/core/32-voice-dictation.js`

- [ ] **Step 1: Create the file**

Create `src/js/core/32-voice-dictation.js` with the full voice dictation module:

```javascript
// v29.3: Voice Dictation Module
// Speech-to-Text via Google Speech-to-Text REST API
// Supports Chrome (WebM/Opus), iOS Safari (MP4), Android (WebM/Opus)

var _voiceMediaRecorder = null;
var _voiceAudioChunks = [];
var _voiceRecordingTarget = null;  // textarea ID
var _voiceRecordingBtn = null;     // button element
var _voiceRecordingTimer = null;   // 60s hard limit
var _voiceSupported = false;

// v29.3: Auto-detect best MIME type for this browser
function _voiceGetMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  // Prefer WebM/Opus (Chrome, Firefox, Android)
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  // iOS Safari uses MP4
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  // Last resort
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
  return null;
}

// v29.3: Map browser MIME to Google Speech-to-Text encoding
function _voiceGetEncoding(mime) {
  if (!mime) return 'ENCODING_UNSPECIFIED';
  if (mime.indexOf('webm') !== -1 && mime.indexOf('opus') !== -1) return 'WEBM_OPUS';
  if (mime.indexOf('webm') !== -1) return 'WEBM_OPUS';
  if (mime.indexOf('mp4') !== -1) return 'MP4';
  if (mime.indexOf('ogg') !== -1 && mime.indexOf('opus') !== -1) return 'OGG_OPUS';
  return 'ENCODING_UNSPECIFIED';
}

// v29.3: Convert Blob to base64 string (without data URI prefix)
function _voiceBlobToBase64(blob, callback) {
  var reader = new FileReader();
  reader.onloadend = function() {
    if (!reader.result) {
      callback(null);
      return;
    }
    // Strip "data:audio/webm;base64," prefix
    var base64 = reader.result.split(',')[1] || '';
    callback(base64);
  };
  reader.onerror = function() {
    callback(null);
  };
  reader.readAsDataURL(blob);
}

// v29.3: Insert text at cursor position in a textarea
function _voiceInsertAtCursor(textarea, text) {
  if (!textarea || !text) return;
  textarea.focus();
  var start = textarea.selectionStart || 0;
  var end = textarea.selectionEnd || 0;
  var before = textarea.value.substring(0, start);
  var after = textarea.value.substring(end);

  // Add a space separator if there is existing text and it does not end with whitespace
  var separator = '';
  if (before.length > 0 && before.charAt(before.length - 1) !== ' ' && before.charAt(before.length - 1) !== '\n') {
    separator = ' ';
  }

  textarea.value = before + separator + text + after;
  var newPos = start + separator.length + text.length;
  textarea.selectionStart = newPos;
  textarea.selectionEnd = newPos;

  // Trigger input event so auto-resize and live preview update
  var evt = new Event('input', { bubbles: true });
  textarea.dispatchEvent(evt);
}

// v29.3: Set button visual state
function _voiceSetBtnState(btn, state) {
  if (!btn) return;
  btn.classList.remove('recording', 'processing');
  if (state === 'recording') {
    btn.classList.add('recording');
  } else if (state === 'processing') {
    btn.classList.add('processing');
  }
}

// v29.3: Stop recording cleanup (shared by stop + timeout + error)
function _voiceCleanupRecording() {
  if (_voiceRecordingTimer) {
    clearTimeout(_voiceRecordingTimer);
    _voiceRecordingTimer = null;
  }
  if (_voiceMediaRecorder && _voiceMediaRecorder.state !== 'inactive') {
    try { _voiceMediaRecorder.stop(); } catch (e) {}
  }
  // Stop all tracks on the stream
  if (_voiceMediaRecorder && _voiceMediaRecorder.stream) {
    var tracks = _voiceMediaRecorder.stream.getTracks();
    for (var i = 0; i < tracks.length; i++) {
      tracks[i].stop();
    }
  }
  _voiceMediaRecorder = null;
  _voiceAudioChunks = [];
}

// v29.3: Main toggle function -- start or stop recording
function toggleVoiceRecording(targetTextareaId, btnEl) {
  // Already recording? Stop it.
  if (_voiceMediaRecorder && _voiceMediaRecorder.state === 'recording') {
    _voiceMediaRecorder.stop();
    return;
  }

  // Check browser support
  if (typeof navigator.mediaDevices === 'undefined' || typeof MediaRecorder === 'undefined') {
    showToast('Voice input not supported in this browser', 'error');
    return;
  }

  // Check MIME support
  var mimeType = _voiceGetMimeType();
  if (!mimeType) {
    showToast('Voice input not supported in this browser', 'error');
    return;
  }

  // Check Google API key
  getApiKey('google').then(function(apiKey) {
    if (!apiKey) {
      showToast('Google API key required for voice input. Add in Settings.', 'error');
      return;
    }

    // Request microphone
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      _voiceRecordingTarget = targetTextareaId;
      _voiceRecordingBtn = btnEl;
      _voiceAudioChunks = [];

      var recorder = new MediaRecorder(stream, { mimeType: mimeType });
      _voiceMediaRecorder = recorder;

      recorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
          _voiceAudioChunks.push(e.data);
        }
      };

      recorder.onstop = function() {
        // Stop all mic tracks
        var tracks = stream.getTracks();
        for (var t = 0; t < tracks.length; t++) {
          tracks[t].stop();
        }

        if (_voiceRecordingTimer) {
          clearTimeout(_voiceRecordingTimer);
          _voiceRecordingTimer = null;
        }

        _voiceSetBtnState(_voiceRecordingBtn, 'processing');

        if (_voiceAudioChunks.length === 0) {
          showToast('No speech detected. Try again.', 'error');
          _voiceSetBtnState(_voiceRecordingBtn, 'idle');
          _voiceMediaRecorder = null;
          return;
        }

        var audioBlob = new Blob(_voiceAudioChunks, { type: mimeType });
        _voiceAudioChunks = [];
        _voiceTranscribeAudio(audioBlob, mimeType, apiKey);
      };

      recorder.onerror = function(e) {
        console.error('[Voice] MediaRecorder error:', e);
        showToast('Recording failed. Try again.', 'error');
        _voiceCleanupRecording();
        _voiceSetBtnState(_voiceRecordingBtn, 'idle');
      };

      // Start recording
      recorder.start();
      _voiceSetBtnState(btnEl, 'recording');

      // 60-second hard limit
      _voiceRecordingTimer = setTimeout(function() {
        if (_voiceMediaRecorder && _voiceMediaRecorder.state === 'recording') {
          _voiceMediaRecorder.stop();
        }
      }, 60000);

    }).catch(function(err) {
      console.error('[Voice] getUserMedia error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showToast('Microphone access denied. Enable in device Settings.', 'error');
      } else {
        showToast('Could not access microphone. Check device settings.', 'error');
      }
    });

  }).catch(function(err) {
    console.error('[Voice] getApiKey error:', err);
    showToast('Google API key required for voice input. Add in Settings.', 'error');
  });
}

// v29.3: Send audio to Google Speech-to-Text REST API
function _voiceTranscribeAudio(blob, mimeType, apiKey) {
  var encoding = _voiceGetEncoding(mimeType);
  var sampleRate = 48000;

  _voiceBlobToBase64(blob, function(base64Audio) {
    if (!base64Audio) {
      showToast('Failed to process audio. Try again.', 'error');
      _voiceSetBtnState(_voiceRecordingBtn, 'idle');
      _voiceMediaRecorder = null;
      return;
    }

    var requestBody = JSON.stringify({
      config: {
        encoding: encoding,
        sampleRateHertz: sampleRate,
        languageCode: 'en-US',
        model: 'latest_long',
        enableAutomaticPunctuation: true
      },
      audio: {
        content: base64Audio
      }
    });

    var url = 'https://speech.googleapis.com/v1/speech:recognize?key=' + encodeURIComponent(apiKey);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    }).then(function(response) {
      return response.json().then(function(data) {
        return { status: response.status, data: data };
      });
    }).then(function(result) {
      _voiceSetBtnState(_voiceRecordingBtn, 'idle');
      _voiceMediaRecorder = null;

      if (result.status === 403) {
        var errMsg = (result.data && result.data.error && result.data.error.message) || '';
        if (errMsg.indexOf('SERVICE_DISABLED') !== -1 || errMsg.indexOf('has not been used') !== -1) {
          showToast('Enable Speech-to-Text API in Google Cloud Console', 'error');
        } else if (errMsg.indexOf('quota') !== -1 || errMsg.indexOf('QUOTA') !== -1) {
          showToast('Speech API quota exceeded. Try again later.', 'error');
        } else {
          showToast('Speech API access denied. Check your Google API key permissions.', 'error');
        }
        return;
      }

      if (result.status === 429) {
        showToast('Speech API quota exceeded. Try again later.', 'error');
        return;
      }

      if (result.status !== 200) {
        var msg = (result.data && result.data.error && result.data.error.message) || 'Unknown error';
        console.error('[Voice] API error:', result.status, msg);
        showToast('Speech recognition failed: ' + msg, 'error');
        return;
      }

      // Extract transcript
      var transcript = '';
      if (result.data && result.data.results && result.data.results.length > 0) {
        for (var r = 0; r < result.data.results.length; r++) {
          var alts = result.data.results[r].alternatives;
          if (alts && alts.length > 0 && alts[0].transcript) {
            if (transcript.length > 0) transcript += ' ';
            transcript += alts[0].transcript;
          }
        }
      }

      if (!transcript) {
        showToast('No speech detected. Try again.', 'error');
        return;
      }

      // Insert into target textarea
      var textarea = document.getElementById(_voiceRecordingTarget);
      if (textarea) {
        _voiceInsertAtCursor(textarea, transcript);
        showToast('Voice transcribed', 'success');
      }

    }).catch(function(err) {
      console.error('[Voice] fetch error:', err);
      _voiceSetBtnState(_voiceRecordingBtn, 'idle');
      _voiceMediaRecorder = null;
      showToast('Network error during transcription. Check connection.', 'error');
    });
  });
}

// v29.3: Init -- hide mic buttons if MediaRecorder not supported
function initVoiceDictation() {
  _voiceSupported = (typeof navigator.mediaDevices !== 'undefined' && typeof MediaRecorder !== 'undefined' && _voiceGetMimeType() !== null);

  if (!_voiceSupported) {
    // Hide all mic buttons
    var micBtns = document.querySelectorAll('.voice-mic-btn, .studio-voice-mic-btn');
    for (var i = 0; i < micBtns.length; i++) {
      micBtns[i].style.display = 'none';
    }
    if (typeof ROWEOS_DEBUG !== 'undefined' && localStorage.getItem('roweos_debug') === 'true') {
      console.log('[Voice] MediaRecorder not supported, mic buttons hidden');
    }
  }
}

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  initVoiceDictation();
});
```

- [ ] **Step 2: Verify file placement in build**

Run `bash src/build.sh`. Then verify the file is included:

```bash
grep -n 'v29.3: Voice Dictation Module' ~/Developer/roweOS/RoweOS/dist/index.html
```

Confirm the comment appears in the built output. Also check ordering:

```bash
grep -n 'google-drive\|voice-dictation\|scribe' ~/Developer/roweOS/RoweOS/dist/index.html | head -5
```

Confirm 31-google-drive content appears before 32-voice-dictation content, which appears before 33-scribe content.

- [ ] **Step 3: Manual browser test (all 3 buttons)**

1. Open RoweOS in Chrome. Go to Chat view.
2. Click the mic button in the landing toolbar. Browser should prompt for microphone permission.
3. Grant permission. Button should turn red with pulse animation.
4. Speak for a few seconds, then click the mic button again to stop.
5. Button should turn gold (processing). After 1-3 seconds, transcript text should appear in the textarea.
6. Send a message to reveal followup input. Test the followup mic button.
7. Go to Studio view. Test the mic button next to Smart Fill in the Context & Notes header.
8. Test error case: Deny microphone permission. Should see toast: "Microphone access denied."
9. Test error case: Remove Google API key from Settings. Should see toast: "Google API key required."

- [ ] **Step 4: iOS Safari test**

1. Deploy to preview. Open on iPhone in Safari.
2. Tap the mic button. iOS should prompt for microphone permission.
3. Grant permission. Record a few seconds. Tap again to stop.
4. Confirm transcript inserts correctly. MIME should be `audio/mp4`, encoding `MP4`.

- [ ] **Step 5: Commit**

```bash
cd ~/Developer/roweOS && git add src/js/core/32-voice-dictation.js && git commit -m "feat(voice): add speech-to-text dictation module with Google REST API v29.3"
```

---

### Task 6: End-to-End Verification and Edge Cases

**Files:** None (testing only)

- [ ] **Step 1: 60-second timeout test**

Start recording and wait 60 seconds without stopping manually. Confirm:
- Recording auto-stops at 60 seconds
- Button transitions from red (recording) to gold (processing) to idle
- Transcript is returned and inserted

- [ ] **Step 2: Empty audio test**

Start recording and immediately stop (within ~0.5s). Confirm toast: "No speech detected. Try again."

- [ ] **Step 3: Long speech test**

Record 30+ seconds of continuous speech. Confirm the full transcript is returned (Google REST endpoint supports up to 60s / ~10MB).

- [ ] **Step 4: Cursor position test**

Type some text in the textarea. Place cursor in the middle. Record speech. Confirm transcript is inserted at cursor position, not appended to end.

- [ ] **Step 5: Existing text spacing test**

Type "Hello" in textarea (no trailing space). Record "world". Confirm result is "Hello world" (automatic space separator) not "Helloworld".

- [ ] **Step 6: SERVICE_DISABLED test**

If Google API key does not have Speech-to-Text API enabled, confirm toast: "Enable Speech-to-Text API in Google Cloud Console"

- [ ] **Step 7: Build and deploy**

```bash
cd ~/Developer/roweOS && bash src/build.sh && ./deploy.sh
```

---

## Summary of Changes

| File | Lines Changed | What |
|------|---------------|------|
| `src/css/core/01-base.css` | +55 | `.voice-mic-btn`, `.studio-voice-mic-btn`, `@keyframes mic-pulse` |
| `src/html/shared/01-blake.html` | +14 (2 buttons) | Mic buttons in landing + followup toolbars |
| `src/html/brand/02-studio.html` | +7 (1 button) | Mic button in Context & Notes header |
| `src/js/core/32-voice-dictation.js` | ~215 (new file) | Full voice dictation module |

**Total:** ~290 lines across 4 files. No changes to build.sh (auto-discovered). No new dependencies.
