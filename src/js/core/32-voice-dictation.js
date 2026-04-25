// v29.4: Voice Dictation Module
// Records audio via MediaRecorder, sends to Google Speech-to-Text REST API

var _voiceRecorder = null;
var _voiceChunks = [];
var _voiceTargetId = null;
var _voiceBtnEl = null;
var _voiceTimeout = null;
var _voiceMaxDuration = 60000; // 60 seconds

function initVoiceDictation() {
  // Check browser support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.log('[Voice] MediaDevices not supported');
    return;
  }
  if (typeof MediaRecorder === 'undefined') {
    console.log('[Voice] MediaRecorder not supported');
    return;
  }
  console.log('[Voice] Dictation module initialized');
}

function getVoiceMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return null;
}

function toggleVoiceRecording(targetTextareaId, btnEl) {
  if (_voiceRecorder && _voiceRecorder.state === 'recording') {
    stopVoiceRecording();
    return;
  }
  startVoiceRecording(targetTextareaId, btnEl);
}

function startVoiceRecording(targetTextareaId, btnEl) {
  var mimeType = getVoiceMimeType();
  if (!mimeType) {
    showToast('Voice input not supported in this browser', 'error');
    return;
  }

  _voiceTargetId = targetTextareaId;
  _voiceBtnEl = btnEl;
  _voiceChunks = [];

  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    try {
      _voiceRecorder = new MediaRecorder(stream, { mimeType: mimeType });
    } catch(e) {
      _voiceRecorder = new MediaRecorder(stream);
    }

    _voiceRecorder.ondataavailable = function(e) {
      if (e.data && e.data.size > 0) _voiceChunks.push(e.data);
    };

    _voiceRecorder.onstop = function() {
      stream.getTracks().forEach(function(t) { t.stop(); });
      if (_voiceTimeout) { clearTimeout(_voiceTimeout); _voiceTimeout = null; }
      if (_voiceChunks.length === 0) {
        setVoiceBtnState('idle');
        return;
      }
      var blob = new Blob(_voiceChunks, { type: _voiceRecorder.mimeType || mimeType });
      _voiceChunks = [];
      setVoiceBtnState('processing');
      transcribeAudio(blob);
    };

    _voiceRecorder.start(1000); // 1s chunks
    setVoiceBtnState('recording');

    // Auto-stop after 60 seconds
    _voiceTimeout = setTimeout(function() {
      if (_voiceRecorder && _voiceRecorder.state === 'recording') {
        stopVoiceRecording();
        showToast('Recording stopped (60s limit)', 'info');
      }
    }, _voiceMaxDuration);

  }).catch(function(err) {
    console.warn('[Voice] Mic access error:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      showToast('Microphone access denied. Enable in device Settings.', 'error');
    } else {
      showToast('Could not access microphone', 'error');
    }
  });
}

function stopVoiceRecording() {
  if (_voiceRecorder && _voiceRecorder.state === 'recording') {
    _voiceRecorder.stop();
  }
}

function setVoiceBtnState(state) {
  if (!_voiceBtnEl) return;
  _voiceBtnEl.classList.remove('recording', 'processing');
  if (state === 'recording') _voiceBtnEl.classList.add('recording');
  else if (state === 'processing') _voiceBtnEl.classList.add('processing');
}

function transcribeAudio(blob) {
  // Get Google API key
  if (typeof getApiKey !== 'function') {
    showToast('Google API key required for voice input. Add in Settings.', 'error');
    setVoiceBtnState('idle');
    return;
  }

  getApiKey('google').then(function(apiKey) {
    if (!apiKey) {
      showToast('Google API key required for voice input. Add in Settings.', 'error');
      setVoiceBtnState('idle');
      return;
    }

    // Convert blob to base64
    var reader = new FileReader();
    reader.onloadend = function() {
      var base64 = reader.result.split(',')[1];
      if (!base64) {
        showToast('No speech detected. Try again.', 'error');
        setVoiceBtnState('idle');
        return;
      }

      // Determine encoding based on MIME
      var encoding = 'WEBM_OPUS';
      var sampleRate = 48000;
      if (blob.type && blob.type.indexOf('mp4') !== -1) {
        encoding = 'MP3'; // iOS Safari mp4 audio
        sampleRate = 44100;
      }

      var requestBody = {
        config: {
          encoding: encoding,
          sampleRateHertz: sampleRate,
          languageCode: 'en-US',
          model: 'latest_long',
          enableAutomaticPunctuation: true
        },
        audio: {
          content: base64
        }
      };

      var url = 'https://speech.googleapis.com/v1/speech:recognize?key=' + apiKey;

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }).then(function(res) { return res.json(); }).then(function(data) {
        setVoiceBtnState('idle');

        if (data.error) {
          if (data.error.status === 'PERMISSION_DENIED' || data.error.code === 403) {
            showToast('Enable Speech-to-Text API in Google Cloud Console', 'error');
          } else {
            showToast('Speech API error: ' + (data.error.message || 'Unknown'), 'error');
          }
          return;
        }

        if (!data.results || data.results.length === 0) {
          showToast('No speech detected. Try again.', 'error');
          return;
        }

        var transcript = '';
        for (var i = 0; i < data.results.length; i++) {
          if (data.results[i].alternatives && data.results[i].alternatives[0] && data.results[i].alternatives[0].transcript) {
            transcript += data.results[i].alternatives[0].transcript;
          }
        }

        if (!transcript.trim()) {
          showToast('No speech detected. Try again.', 'error');
          return;
        }

        insertTranscript(transcript.trim());
        showToast('Transcribed ' + transcript.trim().split(' ').length + ' words', 'success');

      }).catch(function(err) {
        setVoiceBtnState('idle');
        console.warn('[Voice] Transcription error:', err);
        showToast('Transcription failed. Try again.', 'error');
      });
    };
    reader.readAsDataURL(blob);

  }).catch(function() {
    showToast('Google API key required for voice input. Add in Settings.', 'error');
    setVoiceBtnState('idle');
  });
}

function insertTranscript(text) {
  var textarea = document.getElementById(_voiceTargetId);
  if (!textarea) return;

  var start = textarea.selectionStart || 0;
  var end = textarea.selectionEnd || 0;
  var current = textarea.value != null ? textarea.value : '';

  // Add space before if needed
  var prefix = '';
  if (start > 0 && current[start - 1] !== ' ' && current[start - 1] !== '\n') {
    prefix = ' ';
  }

  textarea.value = current.substring(0, start) + prefix + text + current.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + prefix.length + text.length;
  textarea.focus();

  // Trigger input event for any listeners
  try {
    var evt = new Event('input', { bubbles: true });
    textarea.dispatchEvent(evt);
  } catch(e) {}
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVoiceDictation);
} else {
  initVoiceDictation();
}
