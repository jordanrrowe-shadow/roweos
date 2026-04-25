
// v10.5.25: Nanobanana Text Streaming (for Studio text operations)
async function callNanobananaStreaming(model, apiKey, messages, systemPrompt, onChunk, onComplete, onError, abortSignal) {
  if (systemPrompt) systemPrompt += '\n\nCRITICAL: Never use em-dashes or en-dashes in your writing. Use commas, semicolons, colons, periods, or hyphens instead.'; // v22.12
  console.log('[Nanobanana] Text streaming call, model:', model);

  if (!apiKey) {
    apiKey = getNanobananaKey();
  }
  
  if (!apiKey) {
    onError('Nano Banana API key not configured. Go to Settings to add your key.');
    return;
  }
  
  try {
    // Build prompt from messages and system context
    var fullPrompt = systemPrompt ? 'System: ' + systemPrompt + '\n\n' : '';
    messages.forEach(function(m) {
      fullPrompt += (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content + '\n\n';
    });
    
    // v13.9: Default to Gemini 3 Flash
    var useModel = model || 'gemini-3-flash-preview';
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + useModel + ':streamGenerateContent?alt=sse&key=' + apiKey;
    
    var nbFetchOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { maxOutputTokens: 4096 }
      })
    };
    if (abortSignal) nbFetchOpts.signal = abortSignal;
    var response = await fetch(url, nbFetchOpts);

    if (!response.ok) {
      var errorData = await response.json().catch(function() { return {}; });
      throw new Error('HTTP ' + response.status + ': ' + (errorData.error ? errorData.error.message : 'API Error'));
    }
    
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var fullText = '';
    var buffer = '';
    
    while (true) {
      var result = await reader.read();
      if (result.done) break;
      
      buffer += decoder.decode(result.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.startsWith('data: ')) {
          var jsonStr = line.slice(6);
          try {
            var data = JSON.parse(jsonStr);
            if (data.candidates && data.candidates[0] && data.candidates[0].content &&
                data.candidates[0].content.parts) {
              var chunk = extractGeminiResponseText(data.candidates[0].content.parts);
              if (chunk) {
                fullText += chunk;
                onChunk(chunk, fullText);
              }
            }
            // v16.2: Track token usage from Gemini usageMetadata
            if (data.usageMetadata) {
              var nbInputTokens = data.usageMetadata.promptTokenCount || 0;
              var nbOutputTokens = data.usageMetadata.candidatesTokenCount || 0;
              if (nbInputTokens > 0 || nbOutputTokens > 0) {
                trackAPIUsage('nanobanana', useModel, nbInputTokens, nbOutputTokens, false, false, 'text'); // v30.1: Fix — nanobanana text gen, not image
              }
            }
          } catch (e) { /* skip invalid JSON */ }
        }
      }
    }

    // v15.7: Track call count
    trackNanobananaCall(useModel, 'text', fullPrompt.length, fullText.length);
    onComplete(fullText);
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[Nanobanana] Stream aborted, returning partial text');
      onComplete(fullText || '');
      return;
    }
    console.error('[Nanobanana] Streaming error:', err);
    onError(err.message);
  }
}

// v10.5.25: Nanobanana Image Generation (uses Gemini 3.0 Pro Image model)
async function generateImageWithNanobanana(prompt, options) {
  // v13.1: ES5-safe default parameter
  if (!options) options = {};
  var apiKey = getNanobananaKey();

  // v22.13: suppressToasts option for silent callers (e.g. Bloom)
  var _nbSilent = options.suppressToasts || false;

  if (!apiKey) {
    if (!_nbSilent) showToast('Nano Banana API key not configured. Go to Settings to add your key.', 'error');
    throw new Error('Nano Banana API key not configured. Go to Settings to add your key.');
  }

  console.log('[Nanobanana] Generating image...');
  console.log('[Nanobanana] Prompt:', prompt.substring(0, 100) + '...');

  // v22.13: Always use Nano Banana 3 Pro for all image generation
  var model = 'gemini-3-pro-image-preview';
  var aspectRatio = options.aspectRatio || '1:1';

  // v15.13: Build request using Google's Gemini API structure (role required for multi-turn)
  var requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      responseMimeType: 'text/plain'
    }
  };

  // v15.23: Build reference image inlineData parts (array support)
  var refParts = [];
  if (options.referenceImages && options.referenceImages.length > 0) {
    for (var ri = 0; ri < options.referenceImages.length; ri++) {
      var ref = options.referenceImages[ri];
      if (ref && ref.base64) {
        refParts.push({ inlineData: { mimeType: ref.mimeType || 'image/png', data: ref.base64 } });
      }
    }
  } else if (options.referenceImage && options.referenceImage.base64) {
    // Legacy single-image fallback
    refParts.push({ inlineData: { mimeType: options.referenceImage.mimeType || 'image/png', data: options.referenceImage.base64 } });
  }

  // v15.10: Multi-turn image editing — use full conversation history
  if (options.imageHistory && options.imageHistory.length > 0) {
    // Build multi-turn contents: [prev user, prev model image, ..., new user prompt]
    var multiTurnContents = [];
    for (var hi = 0; hi < options.imageHistory.length; hi++) {
      multiTurnContents.push(options.imageHistory[hi]);
    }
    // v15.23: Append ref images to the final user turn if present
    var lastUserParts = [{ text: prompt }];
    if (refParts.length > 0) {
      lastUserParts = refParts.concat(lastUserParts);
      console.log('[Nanobanana] Adding', refParts.length, 'reference image(s) to multi-turn');
    }
    multiTurnContents.push({ role: 'user', parts: lastUserParts });
    requestBody.contents = multiTurnContents;
    console.log('[Nanobanana] Multi-turn image editing with', multiTurnContents.length, 'turns');
  } else if (refParts.length > 0) {
    // Single-turn with reference images
    requestBody.contents[0].parts = refParts.concat(requestBody.contents[0].parts);
    console.log('[Nanobanana] Using image-to-image mode with', refParts.length, 'reference(s)');
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
  console.log('[Nanobanana] API URL:', url.replace(apiKey, apiKey.substring(0, 8) + '...'));

  var response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch (fetchErr) {
    console.error('[Nanobanana] Network error:', fetchErr);
    if (!_nbSilent) showToast('Network error connecting to Nano Banana. Check your internet connection.', 'error');
    throw new Error('Network error: ' + fetchErr.message);
  }

  if (!response.ok) {
    var errorData = await response.json().catch(function() { return {}; });
    var errorMsg = errorData.error ? errorData.error.message : response.statusText;
    console.error('[Nanobanana] Image Error (HTTP ' + response.status + '):', errorMsg);
    // v13.1: User-facing error message (v22.13: gated by suppressToasts)
    if (!_nbSilent) {
      if (response.status === 400) {
        showToast('Nano Banana rejected the prompt. Try rephrasing it.', 'error');
      } else if (response.status === 403 || response.status === 401) {
        showToast('Nano Banana API key is invalid or expired. Check Settings.', 'error');
      } else if (response.status === 429) {
        showToast('Nano Banana rate limit reached. Wait a moment and try again.', 'warning');
      } else {
        showToast('Nano Banana error: ' + errorMsg, 'error');
      }
    }
    throw new Error('Nano Banana Image Error: ' + errorMsg);
  }

  var data = await response.json();
  console.log('[Nanobanana] Response received:', JSON.stringify(data).substring(0, 200));

  // Extract base64 image from Gemini response
  var images = [];

  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    data.candidates[0].content.parts.forEach(function(part) {
      if (part.inlineData && part.inlineData.data) {
        images.push({
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png'
        });
      }
    });
  }

  if (images.length === 0) {
    // v15.3: Return text response instead of throwing — prevents ChatAI from breaking
    var textResponse = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      data.candidates[0].content.parts.forEach(function(part) {
        if (part.text) textResponse += part.text;
      });
    }
    console.warn('[Nanobanana] No image in response. Text:', textResponse);
    if (textResponse) {
      return {
        images: [],
        text: textResponse,
        model: model,
        aspectRatio: aspectRatio,
        provider: 'nanobanana',
        revisedPrompt: null
      };
    }
    if (!_nbSilent) showToast('No image generated. Try a more specific prompt.', 'warning');
    throw new Error('No image data received from Nano Banana. Try a different prompt.');
  }
  
  console.log('[Nanobanana] Success, received', images.length, 'image(s)');

  // v15.7: Track image generation usage
  trackNanobananaCall(model, 'image', prompt.length, 0);

  // v15.13: Extract text from successful response for multi-turn history
  var successText = '';
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    data.candidates[0].content.parts.forEach(function(part) {
      if (part.text) successText += part.text;
    });
  }

  // v15.18: Preserve raw response parts for multi-turn (includes thought_signature)
  var rawModelParts = [];
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    rawModelParts = data.candidates[0].content.parts;
  }

  return {
    images: images,
    text: successText || null,
    model: model,
    aspectRatio: aspectRatio,
    provider: 'nanobanana',
    revisedPrompt: null,
    rawModelParts: rawModelParts
  };
}

// v21.15: Google Veo Video Generation (async predictLongRunning)
async function generateVideoWithVeo(prompt, options) {
  // v24.26: TEMP BLOCKER — video generation disabled to investigate billing. Remove this block to re-enable.
  showToast('Video generation is temporarily disabled while billing is being reviewed.', 'warning');
  throw new Error('Video generation temporarily disabled');
  if (!options) options = {};
  var apiKey = await getApiKey('google');
  if (!apiKey) throw new Error('Google API key not configured. Add your API key in Settings.');

  var model = options.model || 'veo-3.1-fast-generate-preview';
  var aspectRatio = options.aspectRatio || '16:9';
  var resolution = options.resolution || '720p';
  var duration = options.duration || 8;
  var negativePrompt = options.negativePrompt || '';
  var onProgress = options.onProgress || function() {};

  // Build request
  var instance = { prompt: prompt };
  // Image-to-video: attach reference image
  if (options.referenceImage && options.referenceImage.base64) {
    instance.image = {
      bytesBase64Encoded: options.referenceImage.base64,
      mimeType: options.referenceImage.mimeType || 'image/png'
    };
  }

  var params = {
    aspectRatio: aspectRatio,
    durationSeconds: parseInt(duration, 10) || 8
  };
  // Resolution only for certain models
  if (resolution && resolution !== '720p') {
    params.resolution = resolution;
  }
  if (negativePrompt) {
    params.negativePrompt = negativePrompt;
  }

  var startTime = Date.now();

  // Step 1: Start generation
  var startResp = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':predictLongRunning',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        instances: [instance],
        parameters: params
      })
    }
  );

  if (!startResp.ok) {
    var errData = null;
    try { errData = await startResp.json(); } catch(e) {}
    var errMsg = (errData && errData.error && errData.error.message) ? errData.error.message : 'Video generation failed (HTTP ' + startResp.status + ')';
    throw new Error(errMsg);
  }

  var op = await startResp.json();
  if (!op.name) throw new Error('No operation name returned from Veo API');

  // Step 2: Poll until done
  var pollCount = 0;
  while (!op.done) {
    await new Promise(function(r) { setTimeout(r, 10000); }); // 10s interval
    pollCount++;
    var elapsed = Math.round((Date.now() - startTime) / 1000);
    onProgress(elapsed, pollCount);

    var pollResp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/' + op.name,
      { headers: { 'x-goog-api-key': apiKey } }
    );
    if (!pollResp.ok) {
      throw new Error('Video poll failed (HTTP ' + pollResp.status + ')');
    }
    op = await pollResp.json();

    // Safety: bail after 5 minutes
    if (Date.now() - startTime > 300000) {
      throw new Error('Video generation timed out after 5 minutes');
    }
  }

  // Check for errors in completed operation
  if (op.error) {
    throw new Error(op.error.message || 'Video generation failed');
  }

  // Step 3: Extract video URI
  var videoUri = null;
  try {
    videoUri = op.response.generateVideoResponse.generatedSamples[0].video.uri;
  } catch(e) {
    throw new Error('No video URI in response');
  }

  // Step 4: Download video blob
  var videoResp = await fetch(videoUri, {
    headers: { 'x-goog-api-key': apiKey }
  });
  if (!videoResp.ok) throw new Error('Failed to download video (HTTP ' + videoResp.status + ')');
  var videoBlob = await videoResp.blob();
  var videoUrl = URL.createObjectURL(videoBlob);

  var totalTime = Math.round((Date.now() - startTime) / 1000);

  return {
    videoUrl: videoUrl,
    videoBlob: videoBlob,
    duration: duration,
    model: model,
    resolution: resolution,
    aspectRatio: aspectRatio,
    generationTime: totalTime,
    provider: 'veo'
  };
}

// v22.19: OpenAI Image Generation via Responses API (native image_generation tool)
async function generateImage(prompt, options) {
  if (!options) options = {};
  var apiKey = await getApiKey('openai');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add your API key in Settings.');
  }

  var size = options.size || '1024x1024';
  var quality = options.quality || 'standard';
  var n = options.n || 1;

  console.log('[generateImage] Calling OpenAI Responses API with image_generation tool');
  console.log('[generateImage] Size:', size);
  console.log('[generateImage] Quality:', quality);

  // v22.19: Use Responses API image_generation tool instead of DALL-E endpoint
  var response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5.4',
      input: prompt,
      tools: [{ type: 'image_generation', quality: quality === 'hd' ? 'high' : quality, size: size }],
      store: false
    })
  });

  if (!response.ok) {
    var errorData = await response.json().catch(function() { return {}; });
    var errorMsg = (errorData.error && errorData.error.message) || response.statusText || 'Unknown error';
    throw new Error(errorMsg);
  }

  var data = await response.json();

  // v22.19: Extract image from Responses API output
  var images = [];
  if (data.output) {
    for (var i = 0; i < data.output.length; i++) {
      var item = data.output[i];
      if (item.type === 'image_generation_call' && item.result) {
        images.push({
          base64: item.result,
          url: null,
          revisedPrompt: prompt
        });
      }
    }
  }

  if (images.length === 0) {
    throw new Error('No image generated in response');
  }

  // v22.19: Track usage
  try {
    var usg = data.usage || {};
    if (typeof trackAPIUsage === 'function') {
      trackAPIUsage('openai', 'gpt-5.4', usg.input_tokens || 0, usg.output_tokens || 0, false, false, 'image');
    }
  } catch(e) {}

  return {
    images: images,
    model: 'gpt-5.4',
    size: size,
    quality: quality
  };
}

// v30.1: GPT Image 2 via OpenAI Images API
async function generateImageWithGPT2(prompt, options) {
  if (!options) options = {};
  var apiKey = await getApiKey('openai');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  var size = options.size || '1024x1024';
  var quality = options.quality || 'auto';

  console.log('[GPT-Image-2] Generating image...');
  console.log('[GPT-Image-2] Prompt:', prompt.substring(0, 100) + '...');

  var response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-image-2-2026-04-21',
      prompt: prompt,
      n: 1,
      size: size,
      quality: quality,
      output_format: 'png',
      response_format: 'b64_json'
    })
  });

  if (!response.ok) {
    var errorData = await response.json().catch(function() { return {}; });
    var errorMsg = errorData.error ? errorData.error.message : response.statusText;
    console.error('[GPT-Image-2] Error:', errorMsg);
    throw new Error('GPT Image 2 Error: ' + errorMsg);
  }

  var data = await response.json();

  var images = [];
  if (data.data && data.data.length > 0) {
    for (var i = 0; i < data.data.length; i++) {
      if (data.data[i].b64_json) {
        images.push({
          base64: data.data[i].b64_json,
          mimeType: 'image/png'
        });
      }
    }
  }

  if (images.length === 0) {
    throw new Error('No image generated');
  }

  // Track usage
  try {
    if (typeof trackAPIUsage === 'function') {
      trackAPIUsage('openai', 'gpt-image-2', 0, 0, false, false, 'image');
    }
  } catch(e) {}

  return {
    images: images,
    model: 'gpt-image-2-2026-04-21',
    provider: 'openai',
    size: size,
    quality: quality
  };
}

// v21.15: Video Operation Handler for Studio
async function runVideoOperation() {
  var btn = document.getElementById('studioRunBtn') || document.getElementById('runBtn');
  var outputPanel = document.getElementById('studioOutputContent');
  if (!outputPanel) return;

  // Get operation params
  var selectedOp = window.currentStudioOp || {};
  var context = (document.getElementById('studioContext') || {}).value || '';
  var brandName = 'RoweOS';
  var brandIdx = typeof studioSelectedBrand !== 'undefined' ? studioSelectedBrand : 0;
  if (typeof brands !== 'undefined' && brands[brandIdx]) {
    brandName = brands[brandIdx].shortName || brands[brandIdx].name;
  }

  // v22.0: Read video model from unified Studio model dropdown, settings from video row
  var videoModel = (studioProviderOverride === 'veo' && studioModelOverride) ? studioModelOverride : 'veo-3.1-fast-generate-preview';
  var videoDurEl = document.getElementById('studioVideoDuration');
  var videoAspEl = document.getElementById('studioVideoAspect');
  var videoResEl = document.getElementById('studioVideoResolution');
  var durationParam = videoDurEl ? videoDurEl.value : '8';
  var aspectParam = videoAspEl ? videoAspEl.value : '16:9';
  var resolutionParam = videoResEl ? videoResEl.value : '720p';
  var styleParam = 'Cinematic';

  // Also check op params for style overrides
  if (selectedOp.params) {
    for (var i = 0; i < selectedOp.params.length; i++) {
      var p = selectedOp.params[i];
      var paramEl = document.getElementById('studioParam_' + p.id);
      if (!paramEl) continue;
      if (p.id === 'videoStyle') styleParam = paramEl.value;
    }
  }

  // Build prompt
  var prompt = context || selectedOp.name;
  if (selectedOp.id !== 52) {
    // Add brand context for non-freeform ops
    prompt = brandName + ' brand video. Style: ' + styleParam + '. ' + prompt;
  }

  // Get display name for selected model
  var veoModelNames = { 'veo-3.1-fast-generate-preview': 'Veo 3.1 Fast', 'veo-3.1-generate-preview': 'Veo 3.1', 'veo-3-fast-generate-preview': 'Veo 3 Fast', 'veo-3-generate-preview': 'Veo 3', 'veo-2-generate-preview': 'Veo 2' };
  var modelDisplayName = veoModelNames[videoModel] || videoModel;

  // Disable button
  if (btn) { btn.disabled = true; btn.textContent = 'Generating video...'; }

  // Show progress in output panel
  outputPanel.innerHTML = '<div class="videolab-progress" style="margin:20px 0;">'
    + '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--accent)" stroke-width="2" style="margin-bottom:10px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
    + '<div style="font-weight:500;color:var(--text-primary);margin-bottom:6px;">Generating video with ' + modelDisplayName + '...</div>'
    + '<div id="studioVideoProgressTime" style="font-size:var(--text-xs);color:var(--text-muted);">Starting...</div>'
    + '<div class="videolab-progress-bar"><div class="videolab-progress-bar-fill"></div></div>'
    + '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">15 seconds to 3 minutes depending on model</div>'
    + '</div>';

  try {
    var result = await generateVideoWithVeo(prompt, {
      model: videoModel,
      duration: parseInt(durationParam) || 8,
      aspectRatio: aspectParam,
      resolution: resolutionParam,
      onProgress: function(elapsed) {
        var timeEl = document.getElementById('studioVideoProgressTime');
        if (timeEl) timeEl.textContent = 'Elapsed: ' + elapsed + 's';
      }
    });

    // Display result
    outputPanel.innerHTML = '<div style="margin-bottom:16px;">'
      + '<video class="videolab-player" src="' + result.videoUrl + '" controls autoplay loop style="width:100%;"></video>'
      + '<div style="margin-top:8px;font-size:var(--text-xs);color:var(--text-muted);">'
      + result.model + ' | ' + result.duration + 's | ' + result.resolution + ' | Generated in ' + result.generationTime + 's'
      + '</div></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      + '<button onclick="downloadStudioVideo()" style="padding:8px 16px;background:var(--accent);color:#000;border:none;border-radius:var(--radius-md);font-weight:600;cursor:pointer;font-size:var(--text-sm);">'
      + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
      + 'Download</button>'
      + '</div>';

    // Save to runs
    window.currentRun = {
      id: Date.now(),
      op: selectedOp.name || 'Video',
      brand: brandName,
      plan: prompt,
      deliv: '[Video generated: ' + result.duration + 's, ' + result.model + ']',
      time: new Date().toISOString(),
      aiGenerated: true,
      isVideo: true,
      videoUrl: result.videoUrl,
      source: 'studio'
    };
    window._lastVideoResult = result;

    if (typeof runs !== 'undefined') {
      runs.push(window.currentRun);
      if (typeof saveRuns === 'function') saveRuns();
    }
    if (typeof agentCommands !== 'undefined') {
      agentCommands.push({
        op: selectedOp.name || 'Video',
        brand: brandName,
        result: '[Video: ' + result.duration + 's]',
        time: new Date().toISOString(),
        source: 'studio'
      });
    }
    if (typeof renderStudioRunHistory === 'function') renderStudioRunHistory();

    showToast('Video generated in ' + result.generationTime + 's', 'success');
  } catch(err) {
    outputPanel.innerHTML = '<div style="padding:20px;text-align:center;color:#e05555;">'
      + '<div style="font-weight:500;margin-bottom:8px;">Video generation failed</div>'
      + '<div style="font-size:var(--text-sm);">' + escapeHtml(err.message) + '</div></div>';
    showToast('Video error: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Agent'; }
  }
}

function downloadStudioVideo() {
  var result = window._lastVideoResult;
  if (!result || !result.videoBlob) { showToast('No video to download', 'error'); return; }
  var a = document.createElement('a');
  a.href = result.videoUrl;
  a.download = 'roweos-video-' + Date.now() + '.mp4';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function runImageOperation() {
  var btn = document.getElementById('studioRunBtn') || document.getElementById('runBtn');
  var studioLayout = document.querySelector('.studio-layout');
  var mainSidebar = document.querySelector('.sidebar');
  
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating Image...';
    btn.classList.add('running');
  }
  if (studioLayout) studioLayout.classList.add('agent-thinking');
  if (mainSidebar) mainSidebar.classList.add('shimmer-active');
  
  // Use Studio selectors first, fall back to old selectors
  var brandSelect = document.getElementById('studioBrand') || document.getElementById('brand');
  var brandIdx = brandSelect ? parseInt(brandSelect.value) : studioSelectedBrand;
  var brand = brands[brandIdx];
  var contextEl = document.getElementById('studioContext') || document.getElementById('studioContext');
  var context = contextEl ? contextEl.value : '';
  
  addToRecent(selectedOp.id);
  
  var outputContent = document.getElementById('studioOutputContent');
  var outputHeader = document.getElementById('studioOutputHeader');
  var outputActions = document.getElementById('studioOutputActions');
  
  // Show generating state
  if (outputHeader) {
    outputHeader.innerHTML = '<div class="studio-selected-op-info"><div class="studio-selected-op-name"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:6px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' + selectedOp.name + '</div><div class="studio-selected-op-brand">' + brand.name + '</div></div>';
  }
  if (outputContent) {
    outputContent.innerHTML = '<div class="studio-image-generating"><div class="spinner"></div><div class="generating-text">Generating image with AI...</div><div style="font-size: var(--text-sm); color: var(--text-faint); margin-top: var(--space-2);">This may take 30-60 seconds</div></div>';
  }
  
  // v10.5.25: Image prompt variable - declare outside if/else for proper scoping
  var imagePrompt = '';
  
  // Check for regenerate override prompt - use EXACTLY as typed
  if (window.regeneratePromptOverride) {
    imagePrompt = window.regeneratePromptOverride;
    window.regeneratePromptOverride = null; // Clear after use
    console.log('[runImageOperation] Using regenerate override prompt:', imagePrompt);
  } else {
    // Build image prompt using FULL brand identity like BrandAI
    
    // Gather brand identity info
    var brandName = brand.name || '';
    var brandPhilosophy = brand.philosophy || '';
    var brandPositioning = brand.positioning || '';
    var brandVoice = brand.voice || '';
    var brandTone = brand.tone || '';
    var brandAudience = brand.audience || '';
    var brandDifferentiators = (brand.differentiators || []).join(', ');
    
    if (selectedOp.id === 44 || selectedOp.id === 1100) {
      // v13.9: AI Image - use user's prompt as-is, don't inject brand name
      if (context) {
        imagePrompt = context;
      } else {
        imagePrompt = 'A professional brand image for ' + brandName;
      }
    } else {
      // Other image ops - build a comprehensive prompt with full brand identity
      imagePrompt = 'Create a professional, high-quality image for the brand "' + brandName + '". ';
      
      // Add brand context
      if (brandPhilosophy) {
        imagePrompt += 'About this brand: ' + brandPhilosophy + '. ';
      }
      if (brandPositioning) {
        imagePrompt += 'Brand positioning: ' + brandPositioning + '. ';
      }
      if (brandAudience) {
        imagePrompt += 'Target audience: ' + brandAudience + '. ';
      }
      if (brandVoice) {
        imagePrompt += 'Brand voice: ' + brandVoice + '. ';
      }
      if (brandTone) {
        imagePrompt += 'Brand tone: ' + brandTone + '. ';
      }
      
      // Add style based on operation type
      if (selectedOp.id === 40) {
        imagePrompt += 'Style: Brand hero image, lifestyle photography, elegant and sophisticated. ';
      } else if (selectedOp.id === 41) {
        imagePrompt += 'Style: Product mockup, clean background, professional lighting, commercial quality. ';
      } else if (selectedOp.id === 42) {
        imagePrompt += 'Style: Social media visual, eye-catching, modern, Instagram-worthy aesthetic. ';
      } else if (selectedOp.id === 43) {
        imagePrompt += 'Style: Mood board inspiration, artistic, textural, design-forward. ';
      }
      
      // Add user context if provided
      if (context) {
        imagePrompt += 'Specific direction from user: ' + context + '. ';
      }
      
      imagePrompt += 'The image should authentically represent this brand\'s identity and values.';
    }
  }
  
  // v9.1.14: Show the prompt in editable section
  var promptSection = document.getElementById('studioPromptSection');
  var editablePrompt = document.getElementById('editablePrompt');
  if (promptSection && editablePrompt) {
    promptSection.style.display = 'block';
    editablePrompt.value = imagePrompt;
  }
  
  console.log('[runImageOperation] Final image prompt:', imagePrompt);
  console.log('[runImageOperation] Selected provider:', selectedImageProvider);
  
  var startTime = Date.now();
  
  try {
    var result;
    var providerName = '';
    
    // v10.5.25: Use selected image provider
    if (selectedImageProvider === 'nanobanana') {
      // Nanobanana API
      var _arEl1 = document.getElementById('geminiAspectRatio'); // v30.1: ES5 safe
      var aspectRatio = (_arEl1 ? _arEl1.value : null) || '1:1';
      providerName = 'Nano Banana';
      
      if (outputContent) {
        outputContent.innerHTML = '<div class="studio-image-generating"><div class="spinner"></div><div class="generating-text">Generating with Nano Banana...</div><div style="font-size: var(--text-sm); color: var(--text-faint); margin-top: var(--space-2);">This may take 30-60 seconds</div></div>';
      }
      
      // v13.9: Pass selected Nanobanana model
      var nanoModel = window.selectedNanobananaModel || (document.getElementById('nanobananaImageModel') ? document.getElementById('nanobananaImageModel').value : 'gemini-2.0-flash-exp-image-generation');
      // v25.4: Route Imagen 4 to its own API
      if (nanoModel === 'imagen3') {
        providerName = 'Imagen 4';
        if (outputContent) {
          outputContent.innerHTML = '<div class="studio-image-generating"><div class="spinner"></div><div class="generating-text">Generating with Imagen 4...</div><div style="font-size: var(--text-sm); color: var(--text-faint); margin-top: var(--space-2);">This may take 30-60 seconds</div></div>';
        }
        result = await generateImageWithImagen3(imagePrompt, aspectRatio);
      } else {
      result = await generateImageWithNanobanana(imagePrompt, {
        model: nanoModel,
        aspectRatio: aspectRatio,
        referenceImage: currentReferenceImageData ? {
          base64: currentReferenceImageData.split(',')[1],
          mimeType: currentReferenceImage ? currentReferenceImage.type : 'image/png'
        } : null
      });
      }
    } else if (selectedImageProvider === 'gemini') {
      // Gemini
      var _arEl2 = document.getElementById('geminiAspectRatio'); // v30.1: ES5 safe
      var aspectRatio = (_arEl2 ? _arEl2.value : null) || '1:1';
      providerName = 'Gemini';
      
      if (outputContent) {
        outputContent.innerHTML = '<div class="studio-image-generating"><div class="spinner"></div><div class="generating-text">Generating with Gemini...</div><div style="font-size: var(--text-sm); color: var(--text-faint); margin-top: var(--space-2);">This may take 30-60 seconds</div></div>';
      }
      
      result = await generateImageWithGemini(imagePrompt, {
        aspectRatio: aspectRatio
      });
    } else {
      // OpenAI DALL-E (default)
      var _szEl = document.getElementById('dalleSize'); // v30.1: ES5 safe
      var size = (_szEl ? _szEl.value : null) || '1024x1024';
      providerName = 'GPT Image';
      
      if (outputContent) {
        outputContent.innerHTML = '<div class="studio-image-generating"><div class="spinner"></div><div class="generating-text">Generating with GPT Image...</div><div style="font-size: var(--text-sm); color: var(--text-faint); margin-top: var(--space-2);">This may take 30-60 seconds</div></div>';
      }
      
      result = await generateImage(imagePrompt, {
        size: size,
        quality: 'standard'
      });
    }
    
    var genTime = ((Date.now() - startTime) / 1000).toFixed(1);
    var imageData = result.images[0];
    
    // Build output HTML with generated image
    var outputHtml = '<div class="studio-output-meta">';
    outputHtml += '<span>' + new Date().toLocaleString() + '</span>';
    outputHtml += ' · <span style="color: #22c55e;">✓ AI Generated</span>';
    outputHtml += ' · <span>Provider: ' + providerName + '</span>';
    outputHtml += ' · <span>Model: ' + result.model + '</span>';
    if (result.size) outputHtml += ' · <span>' + result.size + '</span>';
    if (result.aspectRatio) outputHtml += ' · <span>Aspect: ' + result.aspectRatio + '</span>';
    outputHtml += ' · <span>' + genTime + 's</span>';
    outputHtml += '</div>';
    
    outputHtml += '<div class="studio-image-output">';
    
    // Display image - handle both OpenAI and Gemini formats
    var imgSrc;
    if (imageData.base64) {
      var mimeType = imageData.mimeType || 'image/png';
      imgSrc = 'data:' + mimeType + ';base64,' + imageData.base64;
    } else if (imageData.url) {
      imgSrc = imageData.url;
    }
    
    outputHtml += '<div class="generated-image-container">';
    outputHtml += '<img class="generated-image" src="' + imgSrc + '" alt="Generated image" />';
    outputHtml += '</div>';
    
    // Show editable prompt section
    var promptToShow = imageData.revisedPrompt || imagePrompt;
    outputHtml += '<div class="image-prompt-section">';
    outputHtml += '<div class="image-prompt-label">Prompt Used:</div>';
    outputHtml += '<textarea class="image-prompt-edit" id="imagePromptEdit" rows="3">' + promptToShow.replace(/"/g, '&quot;') + '</textarea>';
    outputHtml += '</div>';
    
    // Show text response if available (Gemini)
    if (result.textResponse) {
      outputHtml += '<div class="image-prompt"><strong>Model Notes:</strong> ' + result.textResponse + '</div>';
    }
    
    // v10.5.25: Reordered buttons - Regenerate (outline), Library, Product, Download (solid)
    outputHtml += '<div class="image-actions">';
    outputHtml += '<button class="image-action-btn outline" onclick="regenerateImage()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg> Regenerate</button>';
    outputHtml += '<button class="image-action-btn" onclick="saveGeneratedImageToLibrary()">' + icon('folder', {size: 14}) + ' Library</button>';
    outputHtml += '<button class="image-action-btn" onclick="saveImageToProduct()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Product</button>';
    outputHtml += '<button class="image-action-btn primary" onclick="downloadGeneratedImage()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>';
    outputHtml += '</div>';
    
    outputHtml += '</div>';
    
    if (outputContent) {
      outputContent.innerHTML = outputHtml;
    }
    
    // Store for download/regenerate
    window.lastGeneratedImage = {
      base64: imageData.base64,
      url: imageData.url,
      mimeType: imageData.mimeType,
      prompt: imagePrompt,
      revisedPrompt: imageData.revisedPrompt,
      model: result.model,
      size: result.size,
      aspectRatio: result.aspectRatio,
      provider: selectedImageProvider,
      brand: brand.name,
      operation: selectedOp.name
    };
    
    // Create run record
    var run = {
      id: Date.now(),
      op: selectedOp.name,
      brand: brand.name,
      plan: 'Image Generation (' + providerName + '): ' + selectedOp.name,
      deliv: '![Generated Image](' + imgSrc + ')\n\n**Provider:** ' + providerName + '\n\n**Prompt:** ' + imagePrompt + (imageData.revisedPrompt ? '\n\n**Revised:** ' + imageData.revisedPrompt : '') + (result.textResponse ? '\n\n**Model Notes:** ' + result.textResponse : ''),
      context: context,
      time: new Date().toLocaleString(),
      aiGenerated: true,
      isImage: true,
      imageData: imageData.base64 || imageData.url,
      imageProvider: selectedImageProvider
    };
    runs.push(run);
    saveRuns();
    window.currentRun = run;

    if (outputActions) outputActions.style.display = 'flex';
    showHistory();
    renderOperations();
    if (typeof renderStudioRunHistory === 'function') renderStudioRunHistory();

    showToast('Image generated with ' + providerName + ' in ' + genTime + 's', 'success');
    
  } catch (error) {
    console.error('[runImageOperation] Error:', error);
    
    var errorHtml = '<div class="studio-image-error">';
    errorHtml += '<div class="error-icon">⚠️</div>';
    errorHtml += '<div class="error-message">Failed to generate image</div>';
    errorHtml += '<div class="error-detail">' + (error.message || 'Unknown error') + '</div>';
    errorHtml += '<button class="image-action-btn" onclick="runImageOperation()" style="margin-top: var(--space-4);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Try Again</button>';
    errorHtml += '</div>';
    
    if (outputContent) {
      outputContent.innerHTML = errorHtml;
    }
    
    showToast('Image generation failed: ' + error.message, 'error');
  }
  
  // Cleanup
  if (studioLayout) studioLayout.classList.remove('agent-thinking');
  if (mainSidebar) mainSidebar.classList.remove('shimmer-active');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('running');
    btn.style.cssText = '';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg><span>Run Agent</span>';
  }
}

// ═══════════════════════════════════════════════════════════════
// INFOGRAPHIC ENGINE (v23.8) — AI JSON -> HTML/CSS -> Chart.js -> html2canvas -> PNG
// ═══════════════════════════════════════════════════════════════

// v23.8: Infographic template registry — each returns HTML string for a layout
var INFOGRAPHIC_TEMPLATES = {
  vertical: function(data, theme) {
    var html = '<div style="width:800px;padding:48px;background:' + theme.bg + ';color:' + theme.text + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">';
    // Header
    html += '<div style="text-align:center;margin-bottom:32px;border-bottom:3px solid ' + theme.accent + ';padding-bottom:24px;">';
    html += '<div style="font-size:28px;font-weight:700;color:' + theme.accent + ';margin-bottom:8px;">' + escapeHtml(data.title || 'Infographic') + '</div>';
    if (data.subtitle) html += '<div style="font-size:16px;color:' + theme.textSecondary + ';">' + escapeHtml(data.subtitle) + '</div>';
    if (data.brandName) html += '<div style="font-size:12px;color:' + theme.textSecondary + ';margin-top:8px;text-transform:uppercase;letter-spacing:2px;">' + escapeHtml(data.brandName) + '</div>';
    html += '</div>';
    // Sections
    var sections = data.sections || [];
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      html += '<div style="margin-bottom:28px;">';
      if (s.heading) html += '<div style="font-size:18px;font-weight:600;color:' + theme.accent + ';margin-bottom:12px;">' + escapeHtml(s.heading) + '</div>';
      if (s.text) html += '<div style="font-size:14px;line-height:1.6;color:' + theme.text + ';margin-bottom:12px;">' + escapeHtml(s.text) + '</div>';
      // Stats row
      if (s.stats && s.stats.length > 0) {
        html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin:12px 0;">';
        for (var si = 0; si < s.stats.length; si++) {
          var st = s.stats[si];
          html += '<div style="flex:1;min-width:120px;background:' + theme.cardBg + ';border-radius:8px;padding:16px;text-align:center;border:1px solid ' + theme.border + ';">';
          html += '<div style="font-size:24px;font-weight:700;color:' + theme.accent + ';">' + escapeHtml(String(st.value || '')) + '</div>';
          html += '<div style="font-size:11px;color:' + theme.textSecondary + ';margin-top:4px;">' + escapeHtml(st.label || '') + '</div>';
          html += '</div>';
        }
        html += '</div>';
      }
      // Chart placeholder
      if (s.chart) {
        html += '<div style="margin:16px 0;background:' + theme.cardBg + ';border-radius:8px;padding:16px;border:1px solid ' + theme.border + ';">';
        html += '<canvas data-chart-spec=\'' + JSON.stringify(s.chart).replace(/'/g, '&#39;') + '\' width="700" height="300" style="width:100%;max-height:300px;"></canvas>';
        html += '</div>';
      }
      // Bullet points
      if (s.bullets && s.bullets.length > 0) {
        html += '<ul style="margin:8px 0;padding-left:20px;">';
        for (var bi = 0; bi < s.bullets.length; bi++) {
          html += '<li style="font-size:13px;color:' + theme.text + ';margin-bottom:6px;line-height:1.5;">' + escapeHtml(s.bullets[bi]) + '</li>';
        }
        html += '</ul>';
      }
      html += '</div>';
    }
    // Footer
    html += '<div style="border-top:1px solid ' + theme.border + ';padding-top:12px;margin-top:24px;text-align:center;font-size:11px;color:' + theme.textSecondary + ';">Generated by RoweOS</div>';
    html += '</div>';
    return html;
  },

  timeline: function(data, theme) {
    var html = '<div style="width:800px;padding:48px;background:' + theme.bg + ';color:' + theme.text + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">';
    html += '<div style="text-align:center;margin-bottom:36px;">';
    html += '<div style="font-size:28px;font-weight:700;color:' + theme.accent + ';">' + escapeHtml(data.title || 'Timeline') + '</div>';
    if (data.subtitle) html += '<div style="font-size:16px;color:' + theme.textSecondary + ';margin-top:8px;">' + escapeHtml(data.subtitle) + '</div>';
    html += '</div>';
    var sections = data.sections || [];
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      var isLeft = i % 2 === 0;
      html += '<div style="display:flex;align-items:flex-start;margin-bottom:24px;position:relative;">';
      // Line
      html += '<div style="position:absolute;left:50%;top:0;bottom:-24px;width:2px;background:' + theme.accent + '40;transform:translateX(-50%);"></div>';
      // Dot
      html += '<div style="position:absolute;left:50%;top:12px;width:14px;height:14px;background:' + theme.accent + ';border-radius:50%;transform:translateX(-50%);z-index:1;"></div>';
      // Content
      if (isLeft) {
        html += '<div style="width:45%;padding-right:32px;text-align:right;">';
      } else {
        html += '<div style="width:45%;"></div><div style="width:10%;"></div><div style="width:45%;padding-left:32px;">';
      }
      html += '<div style="background:' + theme.cardBg + ';border-radius:8px;padding:16px;border:1px solid ' + theme.border + ';">';
      if (s.heading) html += '<div style="font-size:15px;font-weight:600;color:' + theme.accent + ';margin-bottom:6px;">' + escapeHtml(s.heading) + '</div>';
      if (s.text) html += '<div style="font-size:13px;color:' + theme.text + ';line-height:1.5;">' + escapeHtml(s.text) + '</div>';
      if (s.stats && s.stats.length > 0) {
        for (var si = 0; si < s.stats.length; si++) {
          html += '<div style="margin-top:8px;"><span style="font-weight:600;color:' + theme.accent + ';">' + escapeHtml(String(s.stats[si].value || '')) + '</span> <span style="font-size:12px;color:' + theme.textSecondary + ';">' + escapeHtml(s.stats[si].label || '') + '</span></div>';
        }
      }
      html += '</div></div>';
      if (isLeft) html += '<div style="width:10%;"></div><div style="width:45%;"></div>';
      html += '</div>';
    }
    html += '<div style="text-align:center;font-size:11px;color:' + theme.textSecondary + ';margin-top:24px;">Generated by RoweOS</div>';
    html += '</div>';
    return html;
  },

  grid: function(data, theme) {
    var html = '<div style="width:800px;padding:48px;background:' + theme.bg + ';color:' + theme.text + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">';
    html += '<div style="text-align:center;margin-bottom:32px;">';
    html += '<div style="font-size:28px;font-weight:700;color:' + theme.accent + ';">' + escapeHtml(data.title || 'Overview') + '</div>';
    if (data.subtitle) html += '<div style="font-size:16px;color:' + theme.textSecondary + ';margin-top:8px;">' + escapeHtml(data.subtitle) + '</div>';
    html += '</div>';
    // Top chart if present on first section
    var sections = data.sections || [];
    if (sections.length > 0 && sections[0].chart) {
      html += '<div style="margin-bottom:24px;background:' + theme.cardBg + ';border-radius:8px;padding:16px;border:1px solid ' + theme.border + ';">';
      html += '<canvas data-chart-spec=\'' + JSON.stringify(sections[0].chart).replace(/'/g, '&#39;') + '\' width="700" height="280" style="width:100%;max-height:280px;"></canvas>';
      html += '</div>';
    }
    // Grid cards
    html += '<div style="display:flex;flex-wrap:wrap;gap:16px;">';
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      html += '<div style="flex:1;min-width:220px;max-width:48%;background:' + theme.cardBg + ';border-radius:8px;padding:20px;border:1px solid ' + theme.border + ';">';
      if (s.heading) html += '<div style="font-size:15px;font-weight:600;color:' + theme.accent + ';margin-bottom:8px;">' + escapeHtml(s.heading) + '</div>';
      if (s.text) html += '<div style="font-size:13px;color:' + theme.text + ';line-height:1.5;margin-bottom:8px;">' + escapeHtml(s.text) + '</div>';
      if (s.stats && s.stats.length > 0) {
        for (var si = 0; si < s.stats.length; si++) {
          html += '<div style="display:flex;justify-content:space-between;margin-top:6px;padding:4px 0;border-top:1px solid ' + theme.border + ';">';
          html += '<span style="font-size:12px;color:' + theme.textSecondary + ';">' + escapeHtml(s.stats[si].label || '') + '</span>';
          html += '<span style="font-size:14px;font-weight:600;color:' + theme.accent + ';">' + escapeHtml(String(s.stats[si].value || '')) + '</span>';
          html += '</div>';
        }
      }
      if (s.bullets && s.bullets.length > 0) {
        html += '<ul style="margin:6px 0 0;padding-left:16px;">';
        for (var bi = 0; bi < s.bullets.length; bi++) {
          html += '<li style="font-size:12px;color:' + theme.text + ';margin-bottom:4px;">' + escapeHtml(s.bullets[bi]) + '</li>';
        }
        html += '</ul>';
      }
      html += '</div>';
    }
    html += '</div>';
    html += '<div style="text-align:center;font-size:11px;color:' + theme.textSecondary + ';margin-top:24px;">Generated by RoweOS</div>';
    html += '</div>';
    return html;
  },

  comparison: function(data, theme) {
    var html = '<div style="width:800px;padding:48px;background:' + theme.bg + ';color:' + theme.text + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">';
    html += '<div style="text-align:center;margin-bottom:32px;">';
    html += '<div style="font-size:28px;font-weight:700;color:' + theme.accent + ';">' + escapeHtml(data.title || 'Comparison') + '</div>';
    if (data.subtitle) html += '<div style="font-size:16px;color:' + theme.textSecondary + ';margin-top:8px;">' + escapeHtml(data.subtitle) + '</div>';
    html += '</div>';
    // Table-style comparison
    var sections = data.sections || [];
    if (sections.length > 0) {
      html += '<div style="border:1px solid ' + theme.border + ';border-radius:8px;overflow:hidden;">';
      for (var i = 0; i < sections.length; i++) {
        var s = sections[i];
        var rowBg = i === 0 ? theme.accent + '20' : (i % 2 === 0 ? theme.cardBg : theme.bg);
        html += '<div style="display:flex;align-items:stretch;border-bottom:1px solid ' + theme.border + ';background:' + rowBg + ';">';
        html += '<div style="width:200px;padding:14px 16px;font-weight:' + (i === 0 ? '700' : '500') + ';font-size:14px;color:' + (i === 0 ? theme.accent : theme.text) + ';border-right:1px solid ' + theme.border + ';">' + escapeHtml(s.heading || '') + '</div>';
        html += '<div style="flex:1;padding:14px 16px;font-size:13px;color:' + theme.text + ';line-height:1.5;">';
        if (s.text) html += escapeHtml(s.text);
        if (s.stats && s.stats.length > 0) {
          for (var si = 0; si < s.stats.length; si++) {
            html += '<span style="display:inline-block;margin-right:16px;"><strong style="color:' + theme.accent + ';">' + escapeHtml(String(s.stats[si].value || '')) + '</strong> ' + escapeHtml(s.stats[si].label || '') + '</span>';
          }
        }
        html += '</div></div>';
      }
      html += '</div>';
    }
    // Chart below
    for (var ci = 0; ci < sections.length; ci++) {
      if (sections[ci].chart) {
        html += '<div style="margin-top:24px;background:' + theme.cardBg + ';border-radius:8px;padding:16px;border:1px solid ' + theme.border + ';">';
        html += '<canvas data-chart-spec=\'' + JSON.stringify(sections[ci].chart).replace(/'/g, '&#39;') + '\' width="700" height="300" style="width:100%;max-height:300px;"></canvas>';
        html += '</div>';
        break;
      }
    }
    html += '<div style="text-align:center;font-size:11px;color:' + theme.textSecondary + ';margin-top:24px;">Generated by RoweOS</div>';
    html += '</div>';
    return html;
  },

  flow: function(data, theme) {
    var html = '<div style="width:800px;padding:48px;background:' + theme.bg + ';color:' + theme.text + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">';
    html += '<div style="text-align:center;margin-bottom:32px;">';
    html += '<div style="font-size:28px;font-weight:700;color:' + theme.accent + ';">' + escapeHtml(data.title || 'Process Flow') + '</div>';
    if (data.subtitle) html += '<div style="font-size:16px;color:' + theme.textSecondary + ';margin-top:8px;">' + escapeHtml(data.subtitle) + '</div>';
    html += '</div>';
    var sections = data.sections || [];
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      html += '<div style="display:flex;align-items:flex-start;margin-bottom:16px;">';
      // Step number
      html += '<div style="width:48px;height:48px;border-radius:50%;background:' + theme.accent + ';color:' + theme.bg + ';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0;">' + (i + 1) + '</div>';
      // Arrow connector
      if (i < sections.length - 1) {
        html += '<div style="position:absolute;left:72px;top:60px;width:2px;height:calc(100% - 48px);background:' + theme.accent + '40;"></div>';
      }
      // Content
      html += '<div style="flex:1;margin-left:16px;background:' + theme.cardBg + ';border-radius:8px;padding:16px;border:1px solid ' + theme.border + ';">';
      if (s.heading) html += '<div style="font-size:15px;font-weight:600;color:' + theme.accent + ';margin-bottom:6px;">' + escapeHtml(s.heading) + '</div>';
      if (s.text) html += '<div style="font-size:13px;color:' + theme.text + ';line-height:1.5;">' + escapeHtml(s.text) + '</div>';
      if (s.stats && s.stats.length > 0) {
        html += '<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;">';
        for (var si = 0; si < s.stats.length; si++) {
          html += '<span style="font-size:12px;padding:4px 8px;background:' + theme.accent + '15;border-radius:4px;color:' + theme.accent + ';"><strong>' + escapeHtml(String(s.stats[si].value || '')) + '</strong> ' + escapeHtml(s.stats[si].label || '') + '</span>';
        }
        html += '</div>';
      }
      html += '</div></div>';
    }
    html += '<div style="text-align:center;font-size:11px;color:' + theme.textSecondary + ';margin-top:24px;">Generated by RoweOS</div>';
    html += '</div>';
    return html;
  }
};

// v23.8: Build infographic theme from brand colors
function buildInfographicTheme(brandIdx) {
  var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : {};
  var accent = brand.brandColor || '#a89878';
  var isLight = document.documentElement.classList.contains('light-mode');
  if (isLight) {
    return { accent: accent, bg: '#ffffff', text: '#1a1a1a', textSecondary: '#666666', cardBg: '#f8f8f8', border: '#e0e0e0' };
  }
  return { accent: accent, bg: '#0f1117', text: '#e8e4de', textSecondary: '#8a8578', cardBg: '#1a1b23', border: '#2a2b33' };
}

// v23.8: Parse AI response into infographic JSON
function parseInfographicJSON(text) {
  if (!text) return null;
  // Try to extract JSON from code blocks first
  var jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  var jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  // If it doesn't start with { try to find the first {
  if (jsonStr.charAt(0) !== '{') {
    var braceIdx = jsonStr.indexOf('{');
    if (braceIdx !== -1) jsonStr = jsonStr.substring(braceIdx);
  }
  // Find matching closing brace
  var depth = 0;
  var end = -1;
  for (var i = 0; i < jsonStr.length; i++) {
    if (jsonStr.charAt(i) === '{') depth++;
    else if (jsonStr.charAt(i) === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end !== -1) jsonStr = jsonStr.substring(0, end + 1);
  try {
    var parsed = JSON.parse(jsonStr);
    // Validate minimum structure
    if (!parsed.title && !parsed.sections) return null;
    if (!parsed.sections) parsed.sections = [];
    if (!Array.isArray(parsed.sections)) parsed.sections = [parsed.sections];
    return parsed;
  } catch(e) {
    console.warn('[Infographic] JSON parse failed:', e.message);
    return null;
  }
}

// v23.8: Build the AI prompt for infographic JSON generation
function buildInfographicPrompt(op, brand, params) {
  var brandName = (brand.shortName || brand.name || 'Brand');
  var prompt = 'You are generating structured data for an infographic for ' + brandName + '.\n\n';
  prompt += 'TASK: ' + op.name + '\n';
  if (op.desc) prompt += op.desc + '\n';
  // Add param values
  if (params) {
    var paramKeys = Object.keys(params);
    for (var i = 0; i < paramKeys.length; i++) {
      if (params[paramKeys[i]]) prompt += paramKeys[i] + ': ' + params[paramKeys[i]] + '\n';
    }
  }
  // Brand context
  if (brand.industry) prompt += 'Industry: ' + brand.industry + '\n';
  if (brand.products) prompt += 'Products/Services: ' + brand.products + '\n';
  if (brand.audience) prompt += 'Target Audience: ' + brand.audience + '\n';

  prompt += '\nYou MUST respond with ONLY valid JSON (no markdown, no explanation) in this exact schema:\n';
  prompt += '{\n';
  prompt += '  "title": "Main Title",\n';
  prompt += '  "subtitle": "Optional subtitle",\n';
  prompt += '  "layout": "vertical|timeline|grid|comparison|flow",\n';
  prompt += '  "sections": [\n';
  prompt += '    {\n';
  prompt += '      "heading": "Section Title",\n';
  prompt += '      "text": "Brief description text",\n';
  prompt += '      "stats": [{"label": "Metric Name", "value": "42%"}],\n';
  prompt += '      "bullets": ["Point 1", "Point 2"],\n';
  prompt += '      "chart": {\n';
  prompt += '        "type": "bar|line|doughnut|pie|radar",\n';
  prompt += '        "labels": ["Label1", "Label2"],\n';
  prompt += '        "datasets": [{"label": "Series", "data": [10, 20]}]\n';
  prompt += '      }\n';
  prompt += '    }\n';
  prompt += '  ]\n';
  prompt += '}\n\n';
  prompt += 'RULES:\n';
  prompt += '- Use realistic, plausible data that fits the brand and topic\n';
  prompt += '- Include 3-6 sections with a mix of stats, text, bullets, and at least 1 chart\n';
  prompt += '- Chart data arrays must have the same length as labels\n';
  prompt += '- Choose the layout that best fits the content type\n';
  prompt += '- Keep text concise - this is a visual infographic, not an essay\n';
  prompt += '- Stats values should be short strings like "42%", "$1.2M", "3.5x"\n';
  prompt += '- Never use em-dashes. Use hyphens instead.\n';
  return prompt;
}

// v23.8: Inject Chart.js charts into rendered infographic DOM
function injectInfographicCharts(container, theme) {
  var canvases = container.querySelectorAll('canvas[data-chart-spec]');
  for (var i = 0; i < canvases.length; i++) {
    var canvas = canvases[i];
    try {
      var spec = JSON.parse(canvas.getAttribute('data-chart-spec'));
      if (!spec || !spec.type) continue;
      // Apply theme colors to datasets
      var colors = [theme.accent, '#f472b6', '#4ade80', '#fbbf24', '#60a5fa', '#c084fc', '#22d3ee', '#fb923c'];
      var datasets = spec.datasets || [];
      for (var d = 0; d < datasets.length; d++) {
        if (!datasets[d].backgroundColor) {
          if (spec.type === 'doughnut' || spec.type === 'pie') {
            datasets[d].backgroundColor = colors.slice(0, (spec.labels || []).length);
          } else {
            datasets[d].backgroundColor = colors[d % colors.length] + '80';
            datasets[d].borderColor = colors[d % colors.length];
            datasets[d].borderWidth = 2;
          }
        }
      }
      new Chart(canvas.getContext('2d'), {
        type: spec.type,
        data: { labels: spec.labels || [], datasets: datasets },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            legend: { labels: { color: theme.text, font: { size: 11 } } }
          },
          scales: (spec.type !== 'doughnut' && spec.type !== 'pie' && spec.type !== 'radar') ? {
            x: { ticks: { color: theme.textSecondary, font: { size: 10 } }, grid: { color: theme.border } },
            y: { ticks: { color: theme.textSecondary, font: { size: 10 } }, grid: { color: theme.border } }
          } : undefined
        }
      });
    } catch(e) {
      console.warn('[Infographic] Chart injection failed:', e.message);
    }
  }
}

// v23.8: Capture infographic DOM to PNG via html2canvas
function captureInfographicPNG(container) {
  if (typeof html2canvas !== 'function') {
    return Promise.reject(new Error('html2canvas not loaded'));
  }
  return html2canvas(container, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
    width: 800
  }).then(function(canvas) {
    return canvas.toDataURL('image/png');
  });
}

// v23.8: Render infographic JSON to PNG — returns Promise<dataURL>
function renderInfographic(jsonData, brandIdx) {
  var theme = buildInfographicTheme(brandIdx);
  var layout = jsonData.layout || 'vertical';
  var templateFn = INFOGRAPHIC_TEMPLATES[layout] || INFOGRAPHIC_TEMPLATES.vertical;
  var htmlStr = templateFn(jsonData, theme);

  var host = document.getElementById('infographicCanvas');
  if (!host) return Promise.reject(new Error('Infographic canvas host not found'));
  host.innerHTML = htmlStr;

  // Inject charts
  injectInfographicCharts(host, theme);

  // Small delay for charts to render, then capture
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      captureInfographicPNG(host).then(function(dataUrl) {
        host.innerHTML = '';
        resolve(dataUrl);
      }).catch(function(err) {
        host.innerHTML = '';
        reject(err);
      });
    }, 300);
  });
}

// v23.8: Main Studio infographic execution
async function runInfographicOperation() {
  var btn = document.getElementById('studioRunBtn') || document.getElementById('runBtn');
  var studioLayout = document.querySelector('.studio-layout');
  var mainSidebar = document.querySelector('.sidebar');

  if (btn) { btn.disabled = true; btn.textContent = 'Generating Infographic...'; btn.classList.add('running'); }
  if (studioLayout) studioLayout.classList.add('agent-thinking');
  if (mainSidebar) mainSidebar.classList.add('shimmer-active');

  var brandSelect = document.getElementById('studioBrand') || document.getElementById('brand');
  var brandIdx = brandSelect ? parseInt(brandSelect.value) : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
  var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : { name: 'Brand' };
  var brandName = brand.shortName || brand.name || 'Brand';
  var contextEl = document.getElementById('studioContext');
  var context = contextEl ? contextEl.value : '';

  addToRecent(selectedOp.id);

  var outputContent = document.getElementById('studioOutputContent');
  var outputHeader = document.getElementById('studioOutputHeader');
  var outputActions = document.getElementById('studioOutputActions');

  if (outputContent) outputContent.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary);"><div style="font-size:14px;margin-bottom:8px;">Generating infographic data...</div><div style="font-size:12px;opacity:0.6;">Step 1 of 2: AI is creating structured content</div></div>';
  if (outputHeader) outputHeader.textContent = selectedOp.name;

  try {
    // Step 1: Get AI to generate structured JSON
    var params = {};
    if (selectedOp.params && typeof currentParamValues !== 'undefined' && currentParamValues[selectedOp.id]) {
      var pv = currentParamValues[selectedOp.id];
      for (var pk in pv) { if (pv[pk]) params[pk] = pv[pk]; }
    }
    if (context) params.context = context;

    var prompt = buildInfographicPrompt(selectedOp, brand, params);
    var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
    var provider = settings.provider || 'anthropic';
    var model = settings.model || 'claude-sonnet-4-6';
    // v28.8: Resolve 'roweos'/'auto' smart routing to actual provider/model
    if (model === 'auto' || provider === 'roweos') {
      var _resolved = (typeof resolveRoweOSAI === 'function') ? resolveRoweOSAI({ userMessage: prompt.substring(0, 200) }) : null;
      if (_resolved) { provider = _resolved.provider; model = _resolved.model; }
      else { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
    }
    var apiKey = typeof getApiKey === 'function' ? await getApiKey(provider) : null;
    if (!apiKey) throw new Error('No API key configured for ' + provider);

    var sysPrompt = 'You are an infographic data architect for ' + brandName + '. You produce only valid JSON. Never include explanations, markdown, or text outside the JSON object.';
    var messages = [{ role: 'user', content: prompt }];
    var aiResponse = '';
    if (provider === 'anthropic') aiResponse = await callAnthropicAPI(model, apiKey, messages, sysPrompt);
    else if (provider === 'google') aiResponse = await callGoogleAPI(model, apiKey, messages, sysPrompt);
    else if (provider === 'openai') aiResponse = await callOpenAIAPI(model, apiKey, messages, sysPrompt);

    if (!aiResponse) throw new Error('AI returned empty response');

    // Step 2: Parse JSON
    var jsonData = parseInfographicJSON(aiResponse);
    if (!jsonData) throw new Error('Failed to parse infographic data from AI response');
    jsonData.brandName = brandName;

    if (outputContent) outputContent.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary);"><div style="font-size:14px;margin-bottom:8px;">Rendering infographic...</div><div style="font-size:12px;opacity:0.6;">Step 2 of 2: Building visual layout with charts</div></div>';

    // Step 3: Render to PNG
    var pngDataUrl = await renderInfographic(jsonData, brandIdx);
    if (!pngDataUrl) throw new Error('Failed to capture infographic image');

    // Store for download
    window.lastInfographic = {
      jsonData: jsonData,
      pngDataUrl: pngDataUrl,
      brand: brandName,
      operation: selectedOp.name,
      timestamp: Date.now()
    };

    // Display result
    var outHtml = '<div style="text-align:center;">';
    outHtml += '<img src="' + pngDataUrl + '" alt="' + escapeHtml(jsonData.title || 'Infographic') + '" style="max-width:100%;border-radius:8px;border:1px solid var(--border-color);margin-bottom:16px;">';
    outHtml += '</div>';
    // Data summary
    outHtml += '<div style="margin:16px 0;padding:12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border-color);">';
    outHtml += '<div style="font-size:13px;font-weight:500;color:var(--text-primary);margin-bottom:8px;">Infographic Data</div>';
    outHtml += '<div style="font-size:12px;color:var(--text-secondary);line-height:1.5;">';
    outHtml += '<strong>Title:</strong> ' + escapeHtml(jsonData.title || '') + '<br>';
    outHtml += '<strong>Layout:</strong> ' + escapeHtml(jsonData.layout || 'vertical') + '<br>';
    outHtml += '<strong>Sections:</strong> ' + (jsonData.sections || []).length + '<br>';
    var chartCount = 0;
    for (var si = 0; si < (jsonData.sections || []).length; si++) { if (jsonData.sections[si].chart) chartCount++; }
    outHtml += '<strong>Charts:</strong> ' + chartCount;
    outHtml += '</div></div>';
    // Actions
    outHtml += '<div class="image-actions">';
    outHtml += '<button class="image-action-btn outline" onclick="regenerateInfographic()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg> Regenerate</button>';
    outHtml += '<button class="image-action-btn" onclick="saveInfographicToLibrary()">' + (typeof icon === 'function' ? icon('folder', {size: 14}) : '') + ' Library</button>';
    outHtml += '<button class="image-action-btn primary" onclick="downloadInfographic()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>';
    outHtml += '</div>';

    if (outputContent) outputContent.innerHTML = outHtml;

    // Save run record
    var run = {
      id: Date.now(),
      op: selectedOp.name,
      brand: brandName,
      plan: 'Infographic: ' + selectedOp.name,
      deliv: '![Infographic](' + pngDataUrl.substring(0, 100) + '...)\n\n**Layout:** ' + (jsonData.layout || 'vertical') + '\n**Sections:** ' + (jsonData.sections || []).length,
      context: context,
      time: new Date().toLocaleString(),
      aiGenerated: true,
      isInfographic: true,
      imageData: pngDataUrl
    };
    if (typeof runs !== 'undefined') { runs.push(run); if (typeof saveRuns === 'function') saveRuns(); }
    window.currentRun = run;

    if (outputActions) outputActions.style.display = 'flex';
    if (typeof showHistory === 'function') showHistory();
    if (typeof renderOperations === 'function') renderOperations();
    if (typeof renderStudioRunHistory === 'function') renderStudioRunHistory();

    showToast('Infographic generated: ' + (jsonData.title || selectedOp.name), 'success');

  } catch(err) {
    console.error('[Infographic] Error:', err);
    if (outputContent) {
      outputContent.innerHTML = '<div style="padding:20px;text-align:center;color:#e05555;">'
        + '<div style="font-weight:500;margin-bottom:8px;">Infographic generation failed</div>'
        + '<div style="font-size:var(--text-sm);">' + escapeHtml(err.message) + '</div>'
        + '<button class="image-action-btn" onclick="runInfographicOperation()" style="margin-top:12px;">Try Again</button></div>';
    }
    showToast('Infographic error: ' + err.message, 'error');
  } finally {
    if (studioLayout) studioLayout.classList.remove('agent-thinking');
    if (mainSidebar) mainSidebar.classList.remove('shimmer-active');
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('running');
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg><span>Run Agent</span>';
    }
  }
}

// v23.8: Regenerate infographic with same operation
function regenerateInfographic() {
  if (!selectedOp || !selectedOp.isInfographicOp) {
    showToast('No infographic operation selected', 'warning');
    return;
  }
  runInfographicOperation();
}

// v23.8: Download infographic PNG
function downloadInfographic() {
  if (!window.lastInfographic || !window.lastInfographic.pngDataUrl) {
    showToast('No infographic to download', 'warning');
    return;
  }
  var a = document.createElement('a');
  a.href = window.lastInfographic.pngDataUrl;
  a.download = 'infographic-' + (window.lastInfographic.operation || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Infographic downloaded', 'success');
}

// v23.8: Save infographic to content library
function saveInfographicToLibrary() {
  if (!window.lastInfographic || !window.lastInfographic.pngDataUrl) {
    showToast('No infographic to save', 'warning');
    return;
  }
  try {
    var lib = JSON.parse(localStorage.getItem('roweos_library') || '[]');
    lib.push({
      id: 'lib_infographic_' + Date.now(),
      type: 'image',
      title: window.lastInfographic.jsonData.title || 'Infographic',
      content: window.lastInfographic.pngDataUrl,
      brand: window.lastInfographic.brand,
      source: 'infographic',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('roweos_library', JSON.stringify(lib));
    writeDB('library/brand', { data: JSON.stringify(lib) }, { category: 'library' }); // v25.1
    showToast('Infographic saved to Library', 'success');
  } catch(e) {
    showToast('Failed to save: ' + e.message, 'error');
  }
}

// v23.8: Generate infographic for pipeline/automation execution (returns Promise<dataURL>)
function generateInfographicForPipeline(topic, brandIdx, config) {
  var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : { name: 'Brand' };
  var brandName = brand.shortName || brand.name || 'Brand';
  var fakeOp = { name: topic || 'Custom Infographic', desc: 'Generate an infographic about: ' + (topic || 'brand overview') };
  var params = { topic: topic };
  if (config && config.style) params.style = config.style;

  var prompt = buildInfographicPrompt(fakeOp, brand, params);
  var settings = (typeof brandSettings !== 'undefined' && brandSettings[brandIdx]) ? brandSettings[brandIdx] : {};
  var provider = settings.provider || 'anthropic';
  var model = settings.model || 'claude-sonnet-4-6';
  // Per-step overrides
  if (config && config.provider) provider = config.provider;
  if (config && config.model) model = config.model;
  // v28.8: Resolve 'roweos'/'auto' smart routing to actual provider/model
  if (model === 'auto' || provider === 'roweos') {
    var _resolved = (typeof resolveRoweOSAI === 'function') ? resolveRoweOSAI({ userMessage: topic || 'infographic' }) : null;
    if (_resolved) { provider = _resolved.provider; model = _resolved.model; }
    else { provider = 'anthropic'; model = 'claude-sonnet-4-6'; }
  }

  var sysPrompt = 'You are an infographic data architect for ' + brandName + '. You produce only valid JSON. Never include explanations, markdown, or text outside the JSON object.';

  return (typeof getApiKey === 'function' ? getApiKey(provider) : Promise.resolve(null)).then(function(apiKey) {
    if (!apiKey) throw new Error('No API key for ' + provider);
    var messages = [{ role: 'user', content: prompt }];
    if (provider === 'anthropic') return callAnthropicAPI(model, apiKey, messages, sysPrompt);
    else if (provider === 'google') return callGoogleAPI(model, apiKey, messages, sysPrompt);
    else if (provider === 'openai') return callOpenAIAPI(model, apiKey, messages, sysPrompt);
    return '';
  }).then(function(aiResponse) {
    if (!aiResponse) throw new Error('AI returned empty response');
    var jsonData = parseInfographicJSON(aiResponse);
    if (!jsonData) throw new Error('Failed to parse infographic JSON');
    jsonData.brandName = brandName;
    return renderInfographic(jsonData, brandIdx);
  });
}

// v10.5.25: Regenerate image with edited prompt - uses prompt EXACTLY as user typed
async function regenerateImage() {
  if (!window.lastGeneratedImage || !selectedOp) {
    showToast('No image to regenerate', 'warning');
    return;
  }
  
  // Get edited prompt from textarea
  var promptEdit = document.getElementById('imagePromptEdit');
  var newPrompt = promptEdit ? promptEdit.value.trim() : '';
  
  if (!newPrompt) {
    showToast('Please enter a prompt', 'warning');
    return;
  }
  
  // Store the override prompt so runImageOperation uses it directly
  window.regeneratePromptOverride = newPrompt;
  
  // Run the image operation again
  runImageOperation();
}

function downloadGeneratedImage() {
  if (!window.lastGeneratedImage) {
    showToast('No image to download', 'warning');
    return;
  }
  
  var img = window.lastGeneratedImage;
  var link = document.createElement('a');
  
  if (img.base64) {
    link.href = 'data:image/png;base64,' + img.base64;
  } else if (img.url) {
    link.href = img.url;
  } else {
    showToast('Image data not available', 'error');
    return;
  }
  
  var filename = (img.brand || 'RoweOS').replace(/\s+/g, '_') + '_' + (img.operation || 'image').replace(/\s+/g, '_') + '_' + Date.now() + '.png';
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Image downloaded: ' + filename, 'success');
}

// v9.1.16: Save generated image to Library
function saveGeneratedImageToLibrary() {
  if (!window.lastGeneratedImage) {
    showToast('No image to save', 'warning');
    return;
  }
  
  var img = window.lastGeneratedImage;
  var imageData = null;
  var mimeType = img.mimeType || 'image/png';
  
  if (img.base64) {
    imageData = 'data:' + mimeType + ';base64,' + img.base64;
  } else if (img.url) {
    imageData = img.url;
  } else {
    showToast('Image data not available', 'error');
    return;
  }
  
  // Generate filename
  var filename = (img.brand || 'RoweOS').replace(/\s+/g, '_') + '_' + (img.operation || 'image').replace(/\s+/g, '_') + '_' + Date.now();
  
  // Create library file entry
  var libraryFile = {
    id: Date.now(),
    name: filename,
    type: 'image',
    mimeType: mimeType,
    content: imageData,
    imageData: imageData,
    folder: 'Images',
    brand: img.brand || 'General',
    created: new Date().toISOString(),
    metadata: {
      prompt: img.prompt,
      revisedPrompt: img.revisedPrompt,
      model: img.model,
      provider: img.provider,
      operation: img.operation,
      size: img.size,
      aspectRatio: img.aspectRatio
    }
  };
  
  // Ensure Images folder exists
  if (!libraryFolders) {
    libraryFolders = ['General', 'Images', 'Documents'];
  }
  if (!libraryFolders.includes('Images')) {
    libraryFolders.push('Images');
    saveLibraryFolders();
  }
  
  // Add to library
  if (!libraryFiles) {
    libraryFiles = [];
  }
  libraryFiles.push(libraryFile);
  saveLibraryFiles();
  
  showToast('Image saved to Library → Images', 'success');
  console.log('[Library] Saved generated image:', filename);
}

// v10.5.25: Save generated image as product/service image
function saveImageToProduct() {
  if (!window.lastGeneratedImage) {
    showToast('No image to save', 'warning');
    return;
  }
  
  var items = inventory.items || [];
  if (items.length === 0) {
    showToast('No products/services yet. Create one first in Inventory.', 'info');
    return;
  }
  
  var img = window.lastGeneratedImage;
  var imageData = null;
  var mimeType = img.mimeType || 'image/png';
  
  if (img.base64) {
    imageData = 'data:' + mimeType + ';base64,' + img.base64;
  } else if (img.url) {
    imageData = img.url;
  } else {
    showToast('Image data not available', 'error');
    return;
  }
  
  // Create picker modal
  var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="this.remove()">' +
    '<div style="background:var(--bg-elevated);border-radius:16px;padding:24px;max-width:400px;max-height:80vh;overflow-y:auto;" onclick="event.stopPropagation()">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<div style="font-weight:600;color:var(--text-primary);">Save as Product Image</div>' +
        '<button onclick="this.closest(\'div[style*=position]\').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:18px;">×</button>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Select a product or service to set this image:</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;">' +
        items.map(function(item, idx) {
          return '<div onclick="setProductImage(' + idx + ');this.closest(\'div[style*=position]\').remove();" style="cursor:pointer;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;display:flex;align-items:center;gap:12px;transition:border-color 0.15s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border-color)\'">' +
            '<div style="width:40px;height:40px;border-radius:6px;overflow:hidden;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">' +
              (item.imageData ? '<img src="' + item.imageData + '" style="width:100%;height:100%;object-fit:cover;">' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>') +
            '</div>' +
            '<div style="flex:1;">' +
              '<div style="font-weight:500;color:var(--text-primary);font-size:13px;">' + escapeHtml(item.name) + '</div>' +
              '<div style="font-size:11px;color:var(--text-tertiary);">' + item.type + ' • $' + (item.price || 0).toFixed(2) + '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>' +
  '</div>';
  
  document.body.insertAdjacentHTML('beforeend', html);
}

function setProductImage(itemIndex) {
  if (!window.lastGeneratedImage || !inventory.items[itemIndex]) return;
  
  var img = window.lastGeneratedImage;
  var mimeType = img.mimeType || 'image/png';
  var imageData = img.base64 ? 'data:' + mimeType + ';base64,' + img.base64 : img.url;
  
  inventory.items[itemIndex].imageData = imageData;
  inventory.items[itemIndex].updated = new Date().toISOString();
  saveInventoryData();
  
  showToast('Image set for: ' + inventory.items[itemIndex].name, 'success');
}

async function regenerateImage() {
  // v10.5.25: Check for custom edited prompt first, then fallback to last generated
  var customPrompt = window.customStudioPrompt;
  var editablePrompt = document.getElementById('editablePrompt');
  var promptToUse = null;
  
  if (editablePrompt && editablePrompt.value.trim()) {
    promptToUse = editablePrompt.value.trim();
  } else if (customPrompt) {
    promptToUse = customPrompt;
  } else if (window.lastGeneratedImage && window.lastGeneratedImage.prompt) {
    promptToUse = window.lastGeneratedImage.prompt;
  }
  
  if (!promptToUse) {
    showToast('No prompt to regenerate with', 'warning');
    return;
  }
  
  // Store the prompt for regeneration
  window.lastGeneratedImage = window.lastGeneratedImage || {};
  window.lastGeneratedImage.prompt = promptToUse;
  
  // Re-run the image operation with the prompt
  await runImageOperation();
}

// v9.1.14: Regenerate with user-edited prompt
async function regenerateWithEditedPrompt() {
  var editablePrompt = document.getElementById('editablePrompt');
  if (!editablePrompt || !editablePrompt.value.trim()) {
    showToast('No prompt to regenerate with', 'warning');
    return;
  }
  
  var btn = document.getElementById('runBtn');
  var studioLayout = document.querySelector('.studio-layout');
  var mainSidebar = document.querySelector('.sidebar');
  
  btn.disabled = true;
  btn.textContent = 'Regenerating Image...';
  btn.classList.add('running');
  if (studioLayout) studioLayout.classList.add('agent-thinking');
  if (mainSidebar) mainSidebar.classList.add('shimmer-active');
  
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var customPrompt = editablePrompt.value.trim();
  
  var outputContent = document.getElementById('studioOutputContent');
  var outputHeader = document.getElementById('studioOutputHeader');
  
  if (outputHeader) {
    outputHeader.innerHTML = '<div class="studio-selected-op-info"><div class="studio-selected-op-name">' + (selectedOp ? selectedOp.name : 'Custom Image') + '</div><div class="studio-selected-op-brand">' + brand.name + '</div></div>';
  }
  if (outputContent) {
    outputContent.innerHTML = '<div class="studio-image-generating"><div class="spinner"></div><div class="generating-text">Regenerating with edited prompt...</div></div>';
  }
  
  var startTime = Date.now();
  
  try {
    var result = await generateImage(customPrompt, {
      size: '1024x1024',
      quality: 'standard'
    });
    
    var genTime = ((Date.now() - startTime) / 1000).toFixed(1);
    var imageData = result.images[0];
    
    var outputHtml = '<div class="studio-output-meta">';
    outputHtml += '<span>' + new Date().toLocaleString() + '</span>';
    outputHtml += ' · <span style="color: #22c55e;">✓ Regenerated</span>';
    outputHtml += ' · <span>' + result.model + '</span>';
    outputHtml += ' · <span>' + genTime + 's</span>';
    outputHtml += '</div>';
    
    outputHtml += '<div class="studio-image-output">';
    var imgSrc = imageData.base64 ? 'data:image/png;base64,' + imageData.base64 : imageData.url;
    outputHtml += '<div class="generated-image-container">';
    outputHtml += '<img class="generated-image" src="' + imgSrc + '" alt="Regenerated image" />';
    outputHtml += '</div>';
    
    if (imageData.revisedPrompt) {
      outputHtml += '<div class="image-prompt"><strong>Revised Prompt:</strong> ' + imageData.revisedPrompt + '</div>';
      // Update editable prompt with revised version
      editablePrompt.value = imageData.revisedPrompt;
    }
    
    outputHtml += '<div class="image-actions">';
    outputHtml += '<button class="image-action-btn primary" onclick="downloadGeneratedImage()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>';
    outputHtml += '</div>';
    outputHtml += '</div>';
    
    if (outputContent) outputContent.innerHTML = outputHtml;
    
    window.lastGeneratedImage = {
      base64: imageData.base64,
      url: imageData.url,
      prompt: customPrompt,
      revisedPrompt: imageData.revisedPrompt,
      model: result.model,
      size: result.size,
      brand: brand.name,
      operation: selectedOp ? selectedOp.name : 'Custom'
    };
    
    showToast('Image regenerated in ' + genTime + 's', 'success');
    
  } catch (error) {
    console.error('[regenerateWithEditedPrompt] Error:', error);
    if (outputContent) {
      outputContent.innerHTML = '<div class="studio-image-error"><div class="error-icon">⚠️</div><div class="error-message">Regeneration failed</div><div class="error-detail">' + (error.message || 'Unknown error') + '</div></div>';
    }
    showToast('Regeneration failed: ' + error.message, 'error');
  }
  
  if (studioLayout) studioLayout.classList.remove('agent-thinking');
  if (mainSidebar) mainSidebar.classList.remove('shimmer-active');
  btn.disabled = false;
  btn.classList.remove('running');
  if (selectedOp && selectedOp.isImageOp) {
    btn.textContent = 'Generate Image: ' + selectedOp.name;
  } else {
    btn.textContent = selectedOp ? 'Execute: ' + selectedOp.name : 'Add Content from Library';
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// v9.1.14: GUIDED BUILDER FUNCTIONS
// Multi-turn conversational document creation
// ═══════════════════════════════════════════════════════════════════════════

var guidedBuilderState = {
  op: null,
  conversationHistory: [],
  collectedData: {},
  uploadedFiles: [],
  isGenerating: false
};

// Conversation flows for different document types
var guidedConversationFlows = {
  invoice: {
    title: 'PDF Invoice Generator',
    steps: [
      { question: "Let's create a professional invoice. First, what's your company name?", field: 'companyName' },
      { question: "Would you like to upload your company logo? (You can skip this)", field: 'logo', type: 'file', optional: true },
      { question: "Who is this invoice for? (Client name or company)", field: 'clientName' },
      { question: "What's the client's email address?", field: 'clientEmail' },
      { question: "What's the invoice number? (e.g., INV-001)", field: 'invoiceNumber' },
      { question: "Now let's add line items. Describe the first item/service and its price. Format: 'Description - $amount'", field: 'lineItems', type: 'list' },
      { question: "Add another line item, or type 'done' to continue:", field: 'lineItems', type: 'list', repeat: true },
      { question: "What are the payment terms? (e.g., Net 30, Due on receipt)", field: 'paymentTerms', options: ['Net 30', 'Net 15', 'Due on Receipt', 'Custom'] },
      { question: "Any additional notes for the invoice? (optional)", field: 'notes', optional: true }
    ]
  },
  proposal: {
    title: 'Proposal Builder',
    steps: [
      { question: "Let's build your proposal. What's the project or service name?", field: 'projectName' },
      { question: "Who is this proposal for? (Client name or company)", field: 'clientName' },
      { question: "Provide a brief executive summary (2-3 sentences):", field: 'summary' },
      { question: "What's the scope of work? Describe the main deliverables:", field: 'scope' },
      { question: "What's the proposed timeline? (e.g., 4 weeks, 3 months)", field: 'timeline' },
      { question: "What's the total project cost?", field: 'cost' },
      { question: "Any terms and conditions to include? (optional)", field: 'terms', optional: true }
    ]
  },
  contract: {
    title: 'Contract Generator',
    steps: [
      { question: "Let's draft a service contract. What type of services will be provided?", field: 'serviceType' },
      { question: "What's your company name (the service provider)?", field: 'providerName' },
      { question: "Who is the client?", field: 'clientName' },
      { question: "Describe the services to be delivered:", field: 'services' },
      { question: "What's the contract duration? (e.g., 6 months, 1 year)", field: 'duration' },
      { question: "What are the payment terms?", field: 'paymentTerms' },
      { question: "Any specific termination clauses? (optional)", field: 'termination', optional: true }
    ]
  },
  brandguide: {
    title: 'Brand Guidelines Builder',
    steps: [
      { question: "Let's create your brand guidelines. What's the brand name?", field: 'brandName' },
      { question: "Upload your primary logo (optional):", field: 'logo', type: 'file', optional: true },
      { question: "What are your primary brand colors? (e.g., #a89878, Navy Blue)", field: 'colors' },
      { question: "What fonts does your brand use? (e.g., Playfair Display for headings, Open Sans for body)", field: 'typography' },
      { question: "Describe your brand voice (e.g., Professional, Friendly, Authoritative):", field: 'voice' },
      { question: "What tone should communications have?", field: 'tone' },
      { question: "List 3-5 words your brand should always convey:", field: 'keywords' },
      { question: "List 3-5 words your brand should never use:", field: 'avoidWords' }
    ]
  }
};

function openGuidedBuilder(op) {
  var modal = document.getElementById('guidedBuilderModal');
  var titleEl = document.getElementById('guidedBuilderTitle');
  var chatHistory = document.getElementById('guidedChatHistory');
  var uploadArea = document.getElementById('guidedUploadArea');
  var generateBtn = document.getElementById('guidedGenerateBtn');
  
  if (!modal) return;
  
  // Reset state
  guidedBuilderState = {
    op: op,
    conversationHistory: [],
    collectedData: {},
    uploadedFiles: [],
    isGenerating: false,
    currentStep: 0,
    flow: guidedConversationFlows[op.conversationType] || guidedConversationFlows.invoice
  };
  
  // Set title
  if (titleEl) {
    titleEl.textContent = guidedBuilderState.flow.title || op.name;
  }
  
  // Clear chat history
  if (chatHistory) {
    chatHistory.innerHTML = '';
  }
  
  // Show/hide upload area based on first step
  if (uploadArea) {
    uploadArea.style.display = 'none';
  }
  
  // Disable generate button
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generate Document';
  }
  
  // Show modal
  modal.classList.add('show');
  
  // Start conversation with first question
  setTimeout(function() {
    askNextQuestion();
  }, 500);
}

function closeGuidedBuilder() {
  var modal = document.getElementById('guidedBuilderModal');
  if (modal) {
    modal.classList.remove('show');
  }
  guidedBuilderState = {
    op: null,
    conversationHistory: [],
    collectedData: {},
    uploadedFiles: [],
    isGenerating: false
  };
}

function askNextQuestion() {
  var flow = guidedBuilderState.flow;
  var step = flow.steps[guidedBuilderState.currentStep];
  
  if (!step) {
    // All questions answered, enable generate
    var generateBtn = document.getElementById('guidedGenerateBtn');
    if (generateBtn) {
      generateBtn.disabled = false;
    }
    addAssistantMessage("Great! I have all the information needed. Click 'Generate Document' to create your " + guidedBuilderState.op.name.toLowerCase() + ".");
    return;
  }
  
  var message = step.question;
  addAssistantMessage(message, step.options, step.type === 'file');
  
  // Show upload area if file step
  var uploadArea = document.getElementById('guidedUploadArea');
  if (uploadArea) {
    uploadArea.style.display = step.type === 'file' ? 'flex' : 'none';
  }
}

function addAssistantMessage(text, options, showUpload) {
  var chatHistory = document.getElementById('guidedChatHistory');
  if (!chatHistory) return;
  
  var msgDiv = document.createElement('div');
  msgDiv.className = 'guided-message assistant';
  
  var html = '<div class="guided-message-label">Assistant</div>';
  html += '<div class="guided-message-bubble">' + text;
  
  if (options && options.length > 0) {
    html += '<div class="guided-options">';
    options.forEach(function(opt) {
      var safeOpt = opt.replace(/"/g, '&quot;');
      html += '<button class="guided-option-btn" data-opt="' + safeOpt + '" onclick="selectGuidedOption(this.getAttribute(\'data-opt\'))">' + opt + '</button>';
    });
    html += '</div>';
  }
  
  html += '</div>';
  msgDiv.innerHTML = html;
  
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  
  guidedBuilderState.conversationHistory.push({ role: 'assistant', content: text });
}

function addUserMessage(text) {
  var chatHistory = document.getElementById('guidedChatHistory');
  if (!chatHistory) return;
  
  var msgDiv = document.createElement('div');
  msgDiv.className = 'guided-message user';
  msgDiv.innerHTML = '<div class="guided-message-label">You</div><div class="guided-message-bubble">' + escapeHtml(text) + '</div>'; // v30.1: XSS fix
  
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  
  guidedBuilderState.conversationHistory.push({ role: 'user', content: text });
}

function selectGuidedOption(option) {
  processUserInput(option);
}

function sendGuidedMessage() {
  var input = document.getElementById('guidedUserInput');
  if (!input || !input.value.trim()) return;
  
  var userText = input.value.trim();
  input.value = '';
  
  processUserInput(userText);
}

function processUserInput(text) {
  addUserMessage(text);
  
  var flow = guidedBuilderState.flow;
  var step = flow.steps[guidedBuilderState.currentStep];
  
  if (!step) return;
  
  // Handle "skip" for optional fields
  if (step.optional && (text.toLowerCase() === 'skip' || text.toLowerCase() === 'no' || text === '')) {
    guidedBuilderState.currentStep++;
    setTimeout(askNextQuestion, 500);
    return;
  }
  
  // Handle "done" for repeatable list fields
  if (step.repeat && text.toLowerCase() === 'done') {
    guidedBuilderState.currentStep++;
    setTimeout(askNextQuestion, 500);
    return;
  }
  
  // Store the data
  if (step.type === 'list') {
    if (!guidedBuilderState.collectedData[step.field]) {
      guidedBuilderState.collectedData[step.field] = [];
    }
    guidedBuilderState.collectedData[step.field].push(text);
    
    // If repeatable, don't advance step
    if (step.repeat) {
      setTimeout(askNextQuestion, 500);
      return;
    }
  } else {
    guidedBuilderState.collectedData[step.field] = text;
  }
  
  // Move to next step
  guidedBuilderState.currentStep++;
  setTimeout(askNextQuestion, 500);
}

function handleGuidedFileUpload(event) {
  var file = event.target.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function(e) {
    var flow = guidedBuilderState.flow;
    var step = flow.steps[guidedBuilderState.currentStep];
    
    if (step && step.field) {
      guidedBuilderState.collectedData[step.field] = {
        name: file.name,
        type: file.type,
        data: e.target.result
      };
      guidedBuilderState.uploadedFiles.push(file.name);
    }
    
    addUserMessage('📎 Uploaded: ' + file.name);
    
    // Move to next step
    guidedBuilderState.currentStep++;
    setTimeout(askNextQuestion, 500);
  };
  
  if (file.type.startsWith('image/')) {
    reader.readAsDataURL(file);
  } else {
    reader.readAsDataURL(file);
  }
}

async function generateGuidedDocument() {
  var generateBtn = document.getElementById('guidedGenerateBtn');
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
  }
  
  addAssistantMessage("Generating your document... This may take a moment.");
  
  var brandIdx = parseInt(document.getElementById('brand').value);
  var brand = brands[brandIdx];
  var provider = brand.provider || 'anthropic';
  var model = brand.model || 'claude-sonnet-4-6';
  var apiKey = await getApiKey(provider);
  
  if (!apiKey) {
    addAssistantMessage("Error: API key not configured. Please set up your API key in Settings.");
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Document';
    }
    return;
  }
  
  var documentType = guidedBuilderState.op.conversationType;
  var data = guidedBuilderState.collectedData;
  
  var prompt = buildDocumentPrompt(documentType, data, brand);
  
  try {
    var response = await callBrandAIGeneratorAPI(provider, model, apiKey, prompt);
    
    // Show the generated content in the output panel
    var outputContent = document.getElementById('studioOutputContent');
    var outputHeader = document.getElementById('studioOutputHeader');
    var outputActions = document.getElementById('studioOutputActions');
    
    if (outputHeader) {
      outputHeader.innerHTML = '<div class="studio-selected-op-info"><div class="studio-selected-op-name">' + guidedBuilderState.op.name + '</div><div class="studio-selected-op-brand">' + brand.name + '</div></div>';
    }
    
    if (outputContent) {
      outputContent.innerHTML = '<div class="studio-output-meta"><span>' + new Date().toLocaleString() + '</span> · <span style="color: #a78bfa;">GUIDED</span></div><div class="markdown-body" style="padding: var(--space-5);">' + marked.parse(response) + '</div>';
    }
    
    if (outputActions) outputActions.style.display = 'flex';
    
    // Create run record
    var run = {
      id: Date.now(),
      op: guidedBuilderState.op.name,
      brand: brand.name,
      plan: 'Guided Document: ' + guidedBuilderState.op.name,
      deliv: response,
      context: JSON.stringify(data),
      time: new Date().toLocaleString(),
      aiGenerated: true,
      isGuided: true
    };
    runs.push(run);
    saveRuns();
    window.currentRun = run;
    // v22.33: Populate hidden textarea for copyOutput()
    var _delivEl = document.getElementById('deliv');
    if (_delivEl) _delivEl.value = response;
    var _delivCanvas = document.getElementById('delivCanvas');
    if (_delivCanvas) _delivCanvas.innerHTML = markdownToHtml(response);
    if (typeof renderStudioRunHistory === 'function') renderStudioRunHistory();

    addAssistantMessage("✅ Document generated! You can see it in the output panel. I'll close this builder now.");

    showToast('Document generated successfully', 'success');

    setTimeout(function() {
      closeGuidedBuilder();
    }, 2000);
    
  } catch (err) {
    console.error('Guided document generation error:', err);
    addAssistantMessage("❌ Error generating document: " + err.message);
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Try Again';
    }
  }
}

function buildDocumentPrompt(type, data, brand) {
  var prompt = 'Create a professional ' + type + ' document based on the following information:\n\n';
  prompt += 'BRAND: ' + brand.name + '\n';
  prompt += 'BRAND VOICE: ' + (brand.voice || 'Professional') + '\n\n';
  prompt += 'COLLECTED INFORMATION:\n';
  
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      var value = data[key];
      if (Array.isArray(value)) {
        prompt += '- ' + key + ': ' + value.join(', ') + '\n';
      } else if (typeof value === 'object' && value.name) {
        prompt += '- ' + key + ': [File: ' + value.name + ']\n';
      } else {
        prompt += '- ' + key + ': ' + value + '\n';
      }
    }
  }
  
  prompt += '\n\nGenerate a complete, professional ' + type + ' document in Markdown format.';
  prompt += ' Include all standard sections appropriate for this type of document.';
  prompt += ' Make it look professional and ready to use.';
  
  if (type === 'invoice') {
    prompt += ' Include: header with company info, client details, invoice number, date, line items table with quantities/prices/totals, subtotal, tax if applicable, total due, payment terms, and footer notes.';
  } else if (type === 'proposal') {
    prompt += ' Include: cover page, executive summary, scope of work, deliverables, timeline, pricing, terms and conditions, and next steps.';
  } else if (type === 'contract') {
    prompt += ' Include: parties involved, services description, term and duration, compensation, payment terms, termination clause, confidentiality, and signature blocks.';
  } else if (type === 'brandguide') {
    prompt += ' Include: brand overview, logo usage guidelines, color palette with hex codes, typography specifications, voice and tone guidelines, do/don\'t examples, and usage examples.';
  }
  
  return prompt;
}

async function copyImageToClipboard() {
  if (!window.lastGeneratedImage) {
    showToast('No image to copy', 'warning');
    return;
  }
  
  try {
    var img = window.lastGeneratedImage;
    if (img.base64) {
      // Convert base64 to blob
      var byteCharacters = atob(img.base64);
      var byteNumbers = new Array(byteCharacters.length);
      for (var i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      var byteArray = new Uint8Array(byteNumbers);
      var blob = new Blob([byteArray], { type: 'image/png' });
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast('Image copied to clipboard', 'success');
    } else {
      showToast('Cannot copy URL-based images to clipboard', 'warning');
    }
  } catch (error) {
    console.error('Clipboard error:', error);
    showToast('Failed to copy image: ' + error.message, 'error');
  }
}

// v22.8: Deep Research operation handler — used by Research Agent ops (IDs 16-25)
// Full deep research flow: progress UI, brand context enrichment, startDeepResearch + pollDeepResearch
async function runDeepResearchOperation() {
  var btn = document.getElementById('studioRunBtn') || document.getElementById('runBtn');
  var outputPanel = document.getElementById('studioOutputContent');
  if (!outputPanel) return;

  if (btn) {
    btn.disabled = true;
    btn.classList.add('running');
    btn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;flex-shrink:0;margin:0;"></div><span style="margin-left:10px;">Researching...</span>';
  }

  // Add thinking animation
  var studioV2 = document.querySelector('.studio-v2');
  var mainSidebar = document.querySelector('.sidebar');
  if (studioV2) studioV2.classList.add('agent-thinking');
  if (mainSidebar) mainSidebar.classList.add('shimmer-active');

  var brandIdx = typeof studioSelectedBrand !== 'undefined' ? studioSelectedBrand : (typeof selectedBrand !== 'undefined' ? selectedBrand : 0);
  var brand = (typeof brands !== 'undefined' && brands[brandIdx]) ? brands[brandIdx] : { name: 'Brand' };
  var context = document.getElementById('studioContext') ? document.getElementById('studioContext').value : '';

  // Build query from operation + user context
  var query = selectedOp.name;
  if (selectedOp.desc) query += ': ' + selectedOp.desc;
  if (context) query += '\n\nAdditional context: ' + context;

  // Enrich with brand context (same pattern as handleDeepResearchChat)
  var enrichedQuery = query;
  try {
    var ctxParts = [];
    var bName = brand.shortName || brand.name;
    ctxParts.push('Business context: ' + bName + (brand.tagline ? ' - ' + brand.tagline : '') + (brand.industry ? ' (Industry: ' + brand.industry + ')' : ''));
    if (brand.location) ctxParts.push('Location: ' + brand.location);
    if (brand.audience) ctxParts.push('Target audience: ' + brand.audience);
    if (ctxParts.length > 0) {
      enrichedQuery = ctxParts.join('. ') + '.\n\nResearch request: ' + query;
    }
  } catch(ce) {}

  // Show progress UI
  var startTime = Date.now();
  outputPanel.innerHTML = '<div class="deep-research-card" style="border:1px solid rgba(168,139,250,0.3);border-radius:12px;padding:20px;background:linear-gradient(135deg,rgba(168,139,250,0.08),rgba(212,175,55,0.05));animation:pulse 2s ease infinite;">' +
    '<div style="display:flex;align-items:center;gap:8px;">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#a78bfa" stroke-width="2" style="animation:spin 2s linear infinite;"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
    '<span style="font-weight:600;color:#a78bfa;">Deep Research in Progress</span>' +
    '<span id="drTimer" style="font-size:12px;color:var(--text-muted);margin-left:auto;">0s</span>' +
    '</div>' +
    '<div style="margin-top:12px;font-size:13px;color:var(--text-secondary);">Gemini is conducting comprehensive research. This typically takes 1-5 minutes...</div>' +
    '</div>';
  // Timer update
  var timerInterval = setInterval(function() {
    var el = document.getElementById('drTimer');
    if (el) el.textContent = Math.round((Date.now() - startTime) / 1000) + 's';
  }, 1000);

  function cleanup() {
    clearInterval(timerInterval);
    if (studioV2) studioV2.classList.remove('agent-thinking');
    if (mainSidebar) mainSidebar.classList.remove('shimmer-active');
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('running');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Run Agent</span>';
    }
  }

  try {
    // v22.10: Use runDeepResearchFull with auto-retry
    var result = await runDeepResearchFull(enrichedQuery, function(status, elapsed) {
      var el = document.getElementById('drTimer');
      if (el) el.textContent = elapsed + 's' + (status && status !== 'unknown' ? ' (' + status + ')' : '');
      // Update message if retrying
      var msgEl = outputPanel.querySelector('.deep-research-card div:last-child');
      if (msgEl && status === 'cancelled') {
        msgEl.textContent = 'Deep Research at capacity, retrying automatically...';
      }
    }, 3);
    var resultText = result.text;
    var elapsed = result.elapsed;
    cleanup();

    // Render result card
    outputPanel.innerHTML = renderDeepResearchCard(resultText, elapsed);

    // v23.16: Save to in-memory runs array + agentCommands + localStorage
    try {
      var _drBrand = brands[brandIdx] ? (brands[brandIdx].shortName || brands[brandIdx].name) : 'Unknown';
      var runEntry = {
        id: Date.now(),
        op: selectedOp.name,
        brand: _drBrand,
        plan: 'Deep Research: ' + selectedOp.name,
        deliv: resultText, // v25.3: No truncation — save full content
        time: new Date().toLocaleString(),
        aiGenerated: true,
        source: 'studio'
      };
      runs.push(runEntry);
      window.currentRun = runEntry;
      if (typeof agentCommands !== 'undefined') {
        agentCommands.push({
          id: runEntry.id,
          op: selectedOp.name,
          brand: _drBrand,
          agent: 'Research',
          model: 'gemini-deep-research',
          result: resultText, // v25.3: No truncation
          time: new Date().toISOString(),
          source: 'studio'
        });
      }
      saveRuns();
    } catch(saveErr) { console.error('[DeepResearch] Save error:', saveErr); }

    showToast('Deep Research complete (' + elapsed + 's)', 'success');
    // Update run history sidebar
    if (typeof renderStudioRunHistory === 'function') renderStudioRunHistory();

  } catch(err) {
    cleanup();
    // v22.10: Show error with retry button
    var errMsg = err.message || (typeof err === 'string' ? err : 'Unknown error');
    outputPanel.innerHTML = '<div style="color:#f87171;padding:16px;border:1px solid rgba(248,113,113,0.3);border-radius:8px;">' +
      '<strong>Deep Research Failed</strong><br>' + escapeHtml(errMsg) +
      '<br><button onclick="runDeepResearchOperation()" style="margin-top:12px;padding:6px 16px;border-radius:8px;border:1px solid rgba(168,139,250,0.4);background:rgba(168,139,250,0.1);color:#a78bfa;font-size:12px;cursor:pointer;font-weight:500;">Try Again</button></div>';
    showToast('Deep Research failed: ' + errMsg, 'error');
  }
}

// v10.5.25: Run operation from new Studio UI
// v16.0 NOTE: runSelectedOperation() (below, async/streaming) and runOp() (~line 69824, callback-based)
// are TWO SEPARATE Studio execution paths that share NO code. runSelectedOperation() is used by the
// Studio V2 UI "Run Agent" button. runOp() is the legacy path. Changes to one do NOT affect the other.
// Both must save to runs[] and agentCommands[]. See CLAUDE.md troubleshooting for details.
async function runSelectedOperation() {
  if (!selectedOp) {
    showToast('Please select an operation first', 'warning');
    return;
  }

  // v22.37: Sync param values from DOM before run (onchange may not have fired)
  if (selectedOp.params && selectedOp.params.length > 0) {
    if (!currentParamValues[selectedOp.id]) currentParamValues[selectedOp.id] = {};
    var _paramInputs = document.querySelectorAll('.studio-param-input, .studio-param-select');
    for (var _pi = 0; _pi < _paramInputs.length; _pi++) {
      var _pEl = _paramInputs[_pi];
      if (_pEl.dataset && _pEl.dataset.paramId) {
        currentParamValues[selectedOp.id][_pEl.dataset.paramId] = _pEl.value || '';
      }
    }
  }

  // v21.15: Check if this is a video operation
  if (selectedOp.isVideoOp) {
    return runVideoOperation();
  }

  // v23.8: Check if this is an infographic operation
  if (selectedOp.isInfographicOp) {
    console.log("[runSelectedOperation] Detected infographic operation, routing to runInfographicOperation()");
    return runInfographicOperation();
  }

  // v22.9: Check if this is a deep research operation (forced or opt-in toggle)
  var _drToggle = document.getElementById('deepResearchToggle');
  if (selectedOp.requiresDeepResearch || (selectedOp.category === 'research' && _drToggle && _drToggle.checked)) {
    return runDeepResearchOperation();
  }

  // v10.5.25: Check if this is an image operation
  if (selectedOp.isImageOp) {
    console.log("[runSelectedOperation] Detected image operation, routing to runImageOperation()");
    return runImageOperation();
  }

  // v10.5.25: Check if this is a conversational/guided operation
  if (selectedOp.isConversational) {
    console.log("[runSelectedOperation] Detected conversational operation, opening guided builder");
    return openGuidedBuilder(selectedOp);
  }
  
  var btn = document.getElementById('studioRunBtn');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('running');
    btn.style.cssText = 'display:flex !important;align-items:center !important;justify-content:center !important;';
    btn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;flex-shrink:0;margin:0;"></div><span style="margin-left:10px;">Running...</span>';
  }
  
  // Add thinking animation
  var studioV2 = document.querySelector('.studio-v2');
  var mainSidebar = document.querySelector('.sidebar');
  if (studioV2) studioV2.classList.add('agent-thinking');
  if (mainSidebar) mainSidebar.classList.add('shimmer-active');
  
  var brandIdx = studioSelectedBrand;
  var brand = brands[brandIdx];
  var context = document.getElementById('studioContext') ? document.getElementById('studioContext').value : '';
  
  // Check if user edited the prompt directly
  var editArea = document.getElementById('studioPromptEdit');
  var userEditedPrompt = promptEditMode && editArea && editArea.value.trim();
  
  // Include attached content if any
  if (window.studioAttachedContent) {
    // v30.1: ES5 safe — no optional chaining or arrow functions
    var _sacMsgs = window.studioAttachedContent.messages;
    var attachedContent = window.studioAttachedContent.content ||
                          (_sacMsgs ? _sacMsgs.map(function(m) { return m.content; }).join('\n') : null) ||
                          window.studioAttachedContent.title || '';
    context += '\n\n--- ATTACHED CONTENT: ' + (window.studioAttachedContent.title || 'Document') + ' ---\n' + attachedContent + '\n--- END ---';
  }
  
  // v11.0.5: Include inventory context if products/services selected
  if (typeof getInventoryContextForPrompt === 'function') {
    context += getInventoryContextForPrompt();
  }
  
  // Add to recent
  addToRecent(selectedOp.id);
  
  // Determine active agent
  var activeAgent = null;
  if (currentAgent !== 'all') {
    activeAgent = agents.find(function(a) { return a.id === currentAgent; });
  } else {
    activeAgent = agents.find(function(a) { return a.category === selectedOp.category; });
  }
  
  // v10.5.25: Build system prompt based on mode
  // v11.0.5: Studio uses TASK CATEGORY to determine agent, not global LifeAI profile
  // v18.5: Raw output operations get a minimal system prompt
  var systemPrompt;
  if (selectedOp.isRawOutput) {
    var _rbn = brand.shortName || brand.name || 'Brand';
    systemPrompt = 'You are a social media copywriter for ' + _rbn + '. ' + (brand.desc ? brand.desc + ' ' : '') + 'Your ONLY job is to write the actual post text. Output NOTHING except the exact caption/post that will be published. No titles, no labels like "POST:" or "CAPTION:", no headers, no sections, no analysis, no publishing notes, no character counts, no engagement strategy, no hashtag advice, no tone descriptions, no markdown formatting, no bold text, no bullet points. NEVER use em-dashes or en-dashes in your writing. Just the raw post text and nothing else.';
  } else {
    var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    if (currentMode === 'life') {
      // Studio-specific: map task category to agent type
      var studioAgentType = mapCategoryToAgent(selectedOp.category);
      systemPrompt = buildLifeAISystemPromptForCategory(studioAgentType);
    } else {
      systemPrompt = buildBrandSystemPrompt(brand, activeAgent);
    }
  }
  
  // v23.3: Inject studio client context (4.5)
  if (typeof getStudioClientContext === 'function') {
    var _studioClientCtx = getStudioClientContext();
    if (_studioClientCtx) systemPrompt += _studioClientCtx;
  }

  // Build user prompt - use edited version if available
  var userPrompt;
  if (userEditedPrompt) {
    userPrompt = editArea.value;
  } else {
    userPrompt = selectedOp.prompt ? selectedOp.prompt.replace(/\{context\}/g, context) : selectedOp.name + '\n\nContext: ' + context;

    // v22.33: Include operation parameters in prompt
    var _paramStr = typeof getOperationParamsString === 'function' ? getOperationParamsString() : '';
    if (_paramStr) {
      userPrompt += _paramStr;
    }

    // v18.5: Raw output ops get a stripped-down directive
    if (selectedOp.isRawOutput) {
      userPrompt += '\n\n---\nYour entire response must be ONLY the post/caption text. No headers, no labels, no "POST:" prefix, no analysis sections, no publishing notes, no character counts, no engagement tips, no markdown. Just the exact words to publish.';
    } else {
      // v10.5.25: Add Studio output directive - prevent conversational responses
      userPrompt += '\n\n---\nIMPORTANT INSTRUCTION: This is a Studio task. Produce DIRECT, COMPLETE OUTPUT only. Do NOT ask questions, do NOT request more information, do NOT be conversational. Generate the actual content/output immediately as if you have all the information you need. If context is missing, make reasonable assumptions and produce complete output.';
    }
    
    // Get output length preference
    var outputLength = 'standard';
    var lengthBtns = document.querySelectorAll('.length-btn.active');
    if (lengthBtns.length > 0) {
      outputLength = lengthBtns[0].dataset.length || 'standard';
    }
    
    // v18.5: Social/raw output ops use character limits
    if (outputLength.indexOf('social-') === 0) {
      var charLimit = parseInt(outputLength.replace('social-', ''), 10) || 250;
      userPrompt += '\n\nCHARACTER LIMIT: Your entire response must be ' + charLimit + ' characters or fewer. Count carefully. This is a hard limit. Do not exceed it.';
    } else if (outputLength === 'brief') {
      userPrompt += '\n\nOUTPUT LENGTH: Keep your response BRIEF - around 300-500 words maximum. Be concise and focused.';
    } else if (outputLength === 'comprehensive' || outputLength === 'detailed') {
      userPrompt += '\n\nOUTPUT LENGTH: Provide a COMPREHENSIVE response - at least 1500-2000 words. Be thorough and detailed.';
    }
  }
  
  // Show running state in output
  var outputContent = document.getElementById('studioOutputContent');
  if (outputContent) {
    outputContent.innerHTML = '<div class="output-running"><div class="loading-spinner"></div><div class="output-running-text">Generating content...</div></div>';
  }
  
  try {
    // v10.5.25: Get provider and model - handle LifeAI mode differently
    var provider, model;
    var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    
    if (currentMode === 'life') {
      // LifeAI mode - use LifeAI settings
      provider = studioProviderOverride || lifeAISelectedProvider || 'anthropic';
      model = studioModelOverride || 'claude-sonnet-4-6';
    } else {
      // BrandAI mode - use brand settings
      provider = studioProviderOverride || (brand && brand.provider) || 'anthropic';
      model = studioModelOverride || (brand && brand.model) || 'claude-sonnet-4-6';
    }

    // v20.5: RoweOS AI — resolve to actual provider/model
    if (provider === 'roweos') {
      try {
        var _resolved = resolveRoweOSAI({ userMessage: userPrompt, systemPrompt: systemPrompt });
        provider = _resolved.provider;
        model = _resolved.model;
      } catch(routeErr) {
        console.warn('[RoweOS AI] Route error, falling back:', routeErr);
        provider = 'anthropic'; model = 'claude-sonnet-4-6';
      }
    }

    // v31.0: Preferred model override for intelligence ops (web search requires GPT-5.5)
    var currentOp = ops.filter(function(o) { return o.id === selectedOp.id; })[0]; // v30.1: Fix comparison — selectedOp is object, not ID
    if (currentOp && currentOp.preferredProvider && currentOp.preferredModel) {
      if (!studioProviderOverride && !studioModelOverride) {
        provider = currentOp.preferredProvider;
        model = currentOp.preferredModel;
      } else if (currentOp.preferredModel.indexOf('gpt-5.5') === 0 && !(model.indexOf('gpt-5.5') === 0 || model.indexOf('gpt-5.4') === 0)) {
        showToast('Web search not available with ' + model + '. Intelligence ops work best with GPT-5.5.', 'warning');
      }
    }

    // v23.5: Apply model tier filtering (skip if manual override or preferred model)
    if (!studioProviderOverride && !studioModelOverride && !(currentOp && currentOp.preferredModel)) {
      model = getModelForTier(provider, model);
    }

    // v10.5.25: Handle Nanobanana API key differently (uses dedicated storage)
    var apiKey;
    if (provider === 'nanobanana') {
      apiKey = getNanobananaKey();
    } else {
      apiKey = await getApiKey(provider);
    }

    if (!apiKey) {
      throw new Error('API key not configured for ' + provider + '. Go to Settings to add your key.');
    }

    // v23.5: Track model usage for transparency
    setLastModelUsed(provider, model);
    console.log('[runSelectedOperation] Calling API:', provider, model);
    
    // v16.4: Set up abort controller and stop button for Studio
    _streamAbortController = new AbortController();
    setSendButtonStopping('studioRunBtn');
    var _studioSignal = _streamAbortController.signal;

    // Use streaming API
    var fullResponse = '';

    await new Promise(function(resolve, reject) {
      var streamingFunctions = {
        'anthropic': callAnthropicStreaming,
        'openai': callOpenAIStreaming,
        'google': callGoogleStreaming,
        'nanobanana': callNanobananaStreaming  // v10.5.25: Nanobanana text streaming
      };

      var streamFunc = streamingFunctions[provider];
      if (!streamFunc) {
        reject(new Error('Unknown provider: ' + provider));
        return;
      }

      streamFunc(
        model,
        apiKey,
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        function(chunk, currentFullText) {
          // On chunk received - use the accumulated fullText
          fullResponse = currentFullText;
          if (outputContent) {
            try {
              // Use marked if available, otherwise plain text with line breaks
              var html = (typeof marked !== 'undefined' && marked.parse) 
                ? marked.parse(fullResponse) 
                : fullResponse.replace(/\n/g, '<br>');
              outputContent.innerHTML = '<div class="output-result">' + html + '</div>';
            } catch (e) {
              console.error('[Studio] Markdown parse error:', e);
              outputContent.innerHTML = '<div class="output-result">' + fullResponse.replace(/\n/g, '<br>') + '</div>';
            }
          }
        },
        function(finalText) {
          // On complete
          fullResponse = finalText;
          console.log('[Studio] Streaming complete, length:', finalText.length);
          resolve();
        },
        function(error) {
          // On error
          console.error('[Studio] Streaming error:', error);
          reject(new Error(error));
        },
        _studioSignal
      );
    });
    
    // Store for export
    window.lastStudioOutput = fullResponse;
    
    // v10.6: Detect checklist content and show import button
    // v23.14: Store checklist data for smart suggestions (no longer render standalone button)
    if (typeof detectChecklistInResponse === 'function' && detectChecklistInResponse(fullResponse)) {
      var items = extractChecklistItems(fullResponse);
      var title = extractChecklistTitle(fullResponse);

      if (items.length >= 2) {
        // Store for import function — smart suggestions will render the button
        window._pendingChecklistItems = items;
        window._pendingChecklistTitle = title;
        window._pendingChecklistRawText = fullResponse; // v11.0.5: Store raw text for section parsing
      }
    }
    
    showToast('Content generated successfully!', 'success');

    // v15.37: Save to runs array for Studio Run History + Tuning view
    var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
    var _brandLabel = currentMode === 'life' ? 'LifeAI' : (brand ? (brand.shortName || brand.name) : 'Unknown');
    var run = {
      id: Date.now(),
      op: selectedOp.name,
      contextTitle: getStudioContextTitle(selectedOp, _brandLabel) || selectedOp.name,
      brand: _brandLabel,
      plan: userPrompt,
      deliv: fullResponse,
      time: new Date().toLocaleString(),
      aiGenerated: true,
      mode: currentMode
    };
    runs.push(run);
    window.currentRun = run;
    // v22.33: Populate hidden textarea for copyOutput()
    var _delivEl = document.getElementById('deliv');
    if (_delivEl) _delivEl.value = fullResponse;
    var _delivCanvas = document.getElementById('delivCanvas');
    if (_delivCanvas) _delivCanvas.innerHTML = markdownToHtml(fullResponse);

    // v13.9: Save Studio run to agentCommands history for both modes
    try {
      var historyRecord = {
        id: run.id,
        brand: run.brand,
        mode: currentMode,
        command: selectedOp.name + (context ? ': ' + context.substring(0, 100) : ''),
        operation: selectedOp.name,
        source: 'studio',
        result: fullResponse || '',
        date: new Date().toISOString(),
        time: run.time,
        clientId: _studioAttachedClientId || '',
        conversation: [
          { role: 'user', content: userPrompt || context },
          { role: 'assistant', content: fullResponse }
        ]
      };
      if (typeof agentCommands !== 'undefined') {
        agentCommands.push(historyRecord);
      }
      saveRuns();
      // v23.3: Log dialogue entry for attached client
      if (_studioAttachedClientId && typeof clientAddDialogueEntry === 'function') {
        clientAddDialogueEntry(_studioAttachedClientId, 'Studio Session', (selectedOp.name || 'Studio') + ' - ' + (fullResponse || '').substring(0, 300));
      }
      // Also save to Automations Lab history
      if (typeof addAutoLabHistory === 'function') {
        addAutoLabHistory({ name: selectedOp.name, action: 'studio-run' }, true, fullResponse ? fullResponse.substring(0, 500) : '');
      }
    } catch(e) { console.error('[Studio] History save error:', e); }

    // v15.37: Refresh Studio sidebar history
    if (typeof renderStudioRunHistory === 'function') renderStudioRunHistory();

    // v17.0: Auto-show social publisher for social operations (V2 path)
    if (selectedOp && selectedOp.isSocialOp && fullResponse) {
      var publishPlatforms = (window._selectedSocialPlatforms && window._selectedSocialPlatforms.length > 0)
        ? window._selectedSocialPlatforms.slice()
        : ['x', 'threads', 'instagram', 'tiktok'];
      showSocialPublisher(fullResponse, publishPlatforms);
    }

    // v22.26: Auto-show email compose for email operations
    if (selectedOp && selectedOp.isEmailOp && fullResponse) {
      showEmailPublisher(fullResponse, selectedOp);
    }

    // v23.14: Smart suggestions at end of Studio session
    if (typeof renderSmartSuggestions === 'function' && run) {
      renderSmartSuggestions(run, selectedOp);
    }

  } catch (error) {
    console.error('[runSelectedOperation] Error:', error);
    if (outputContent) {
      outputContent.innerHTML = '<div class="output-error"><span class="error-icon">⚠</span> Error: ' + error.message + '</div>';
    }
    showToast('Error generating content: ' + error.message, 'error');
  } finally {
    // v16.4: Clear abort controller and restore button
    _streamAbortController = null;
    restoreSendButton('studioRunBtn');
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('running');
      btn.style.cssText = '';
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg><span>Run Agent</span>';
    }

    // Remove thinking animation
    if (studioV2) studioV2.classList.remove('agent-thinking');
    if (mainSidebar) mainSidebar.classList.remove('shimmer-active');
  }
}

async function runOp() {
  if (!selectedOp) {
    showToast('Please select an operation first', 'warning');
    return;
  }

  // v22.37: Sync param values from DOM before run
  if (selectedOp.params && selectedOp.params.length > 0) {
    if (!currentParamValues[selectedOp.id]) currentParamValues[selectedOp.id] = {};
    var _paramInputs2 = document.querySelectorAll('.studio-param-input, .studio-param-select');
    for (var _pi2 = 0; _pi2 < _paramInputs2.length; _pi2++) {
      var _pEl2 = _paramInputs2[_pi2];
      if (_pEl2.dataset && _pEl2.dataset.paramId) {
        currentParamValues[selectedOp.id][_pEl2.dataset.paramId] = _pEl2.value || '';
      }
    }
  }

  // v21.15: Check if this is a video operation
  if (selectedOp.isVideoOp) {
    return runVideoOperation();
  }

  // v23.8: Check if this is an infographic operation
  if (selectedOp.isInfographicOp) {
    console.log("[runOp] Detected infographic operation, routing to runInfographicOperation()");
    return runInfographicOperation();
  }

  // v22.9: Check if this is a deep research operation (forced or opt-in toggle)
  var _drToggle2 = document.getElementById('deepResearchToggle');
  if (selectedOp.requiresDeepResearch || (selectedOp.category === 'research' && _drToggle2 && _drToggle2.checked)) {
    return runDeepResearchOperation();
  }

  // v9.1.14: Check if this is an image operation
  if (selectedOp.isImageOp) {
    console.log("[runOp] Detected image operation, routing to runImageOperation()");
    return runImageOperation();
  }

  // v9.1.14: Check if this is a conversational/guided operation
  if (selectedOp.isConversational) {
    console.log("[runOp] Detected conversational operation, opening guided builder");
    return openGuidedBuilder(selectedOp);
  }

  var btn = document.getElementById('studioRunBtn') || document.getElementById('runBtn'); // v30.1: Try new ID first, null guard
  if (btn) { btn.disabled = true; btn.textContent = 'Running...'; btn.classList.add('running'); }
  
  // Add thinking animation to entire Studio layout and sidebar
  var studioLayout = document.querySelector('.studio-layout');
  var mainSidebar = document.querySelector('.sidebar');
  if (studioLayout) studioLayout.classList.add('agent-thinking');
  if (mainSidebar) mainSidebar.classList.add('shimmer-active');

  // v15.15: Safely resolve brand — prefer studioBrand, fallback to brand selector, then selectedBrand
  var studioBrandEl = document.getElementById('studioBrand');
  var mainBrandEl = document.getElementById('brand');
  var brandIdx = parseInt((studioBrandEl && studioBrandEl.value !== '' ? studioBrandEl.value : null) || (mainBrandEl && mainBrandEl.value !== '' ? mainBrandEl.value : null) || selectedBrand || 0);
  if (isNaN(brandIdx) || brandIdx < 0) brandIdx = 0;
  var brand = brands[brandIdx] || brands[0];
  var contextEl_tmp = document.getElementById('studioContext'); var context = contextEl_tmp ? contextEl_tmp.value : '';

  // v10.5.33: Include all attached files content
  var allFileContents = getAllStudioFileContents();
  if (allFileContents) {
    context += '\n\n' + allFileContents;
    // Clear files after including
    removeStudioFile();
  }

  // Add to recent
  addToRecent(selectedOp.id);

  // Determine active agent (use category-matching agent or current selection)
  var activeAgent = null;
  if (currentAgent !== 'all') {
    activeAgent = agents.find(function(a) { return a.id === currentAgent; });
  } else {
    // Auto-detect agent from operation category
    activeAgent = agents.find(function(a) { return a.category === selectedOp.category; });
  }
  
  var plan = '=== ' + selectedOp.name.toUpperCase() + ' PLAN ===\n';
  plan += 'Brand: ' + brand.name + '\n';
  plan += 'Tagline: ' + brand.tagline + '\n';
  plan += 'Voice: ' + brand.voice + '\n';
  plan += 'Category: ' + (selectedOp.category || 'operations') + '\n';
  if (activeAgent) {
    plan += 'Agent: ' + activeAgent.icon + ' ' + activeAgent.name + '\n';
  }
  plan += '\n';
  
  plan += 'Deliverables:\n';
  (selectedOp.outputs || []).forEach(function(o) { plan += '• ' + o + '\n'; }); // v30.1: Guard null outputs
  
  if (context) plan += '\nContext: ' + context;
  
  // Get template structure
  var templateStructure = generateOutputTemplate(selectedOp, brand, context, activeAgent);
  
  // Build AI prompt
  var aiPrompt = 'You are creating content for ' + brand.name + '.\n\n';
  aiPrompt += 'BRAND CONTEXT:\n';
  aiPrompt += '- Tagline: ' + brand.tagline + '\n';
  aiPrompt += '- Voice: ' + brand.voice + '\n';
  aiPrompt += '- Products: ' + (brand.products || brand.positioning || '') + '\n';
  aiPrompt += '- Audience: ' + brand.audience + '\n';
  aiPrompt += '- Promise: ' + brand.promise + '\n\n';
  
  aiPrompt += 'TASK: ' + selectedOp.name + '\n';
  aiPrompt += 'DELIVERABLES:\n';
  (selectedOp.outputs || []).forEach(function(o) { aiPrompt += '• ' + o + '\n'; }); // v30.1: Guard null outputs
  aiPrompt += '\n';
  
  // v13.3: Cross-system context injection
  var currentRunMode = getCurrentMode ? getCurrentMode() : (localStorage.getItem('roweos_mode') || 'brand');
  var isLifeModeRun = currentRunMode === 'life';
  var fullCtx = isLifeModeRun ? getFullLifeContext() : getFullBrandContext(brand);

  // Active goals context (if any)
  var goalCtx = isLifeModeRun ? (fullCtx.pulseGoals || []) : (fullCtx.goals || []);
  if (goalCtx.length > 0) {
    aiPrompt += '\nACTIVE GOALS (for context -- align output with these where relevant):\n';
    goalCtx.forEach(function(g) {
      aiPrompt += '- ' + g.title + ' (' + g.progress + '% complete)\n';
    });
  }

  // Workload context
  var todoCount = fullCtx.pendingTodos || 0;
  if (todoCount > 0) {
    aiPrompt += '\nCURRENT WORKLOAD: ' + todoCount + ' pending tasks';
    if (fullCtx.overdueTodos > 0) aiPrompt += ' (' + fullCtx.overdueTodos + ' overdue)';
    aiPrompt += '\n';
  }

  // Deep Identity injection (for richer brand ops)
  if (!isLifeModeRun && fullCtx.identityCards) {
    var deepFields = [];
    if (fullCtx.identityCards.essence) deepFields.push('Essence: ' + (fullCtx.identityCards.essence.owner || fullCtx.identityCards.essence.ai));
    if (fullCtx.identityCards.competitive) deepFields.push('Competitive Edge: ' + (fullCtx.identityCards.competitive.owner || fullCtx.identityCards.competitive.ai));
    if (fullCtx.vocabDo) deepFields.push('Vocabulary Do: ' + fullCtx.vocabDo);
    if (fullCtx.vocabDont) deepFields.push('Vocabulary Dont: ' + fullCtx.vocabDont);
    if (deepFields.length > 0) {
      aiPrompt += '\nDEEP BRAND IDENTITY:\n' + deepFields.join('\n') + '\n';
    }
  }

  // v9.1.14: Add operation parameters
  var paramsString = getOperationParamsString();
  if (paramsString) {
    aiPrompt += paramsString + '\n';
  }

  if (context) {
    aiPrompt += 'ADDITIONAL CONTEXT:\n' + context + '\n\n';
  }
  
  aiPrompt += 'TEMPLATE STRUCTURE TO FOLLOW:\n';
  aiPrompt += '```\n' + templateStructure + '\n```\n\n';
  
  aiPrompt += 'Using the template structure above as a guide, create polished, on-brand content for ' + brand.name + '. ';
  aiPrompt += 'Fill in all placeholders with real, specific content. ';
  aiPrompt += 'Maintain the structure and format, but make the content compelling and authentic to the brand voice.\n\n';
  
  // v9.1.14: Add output length instruction
  aiPrompt += 'OUTPUT LENGTH GUIDELINE: ' + getOutputLengthInstruction() + '\n\n';
  aiPrompt += 'OUTPUT ONLY THE FINAL CONTENT - no preamble, no explanation, just the completed deliverable.';
  
  // v9.1.14: Show the prompt in the Generated Prompt section
  var promptSection = document.getElementById('studioPromptSection');
  var editablePrompt = document.getElementById('editablePrompt');
  if (promptSection && editablePrompt) {
    promptSection.style.display = 'block';
    editablePrompt.value = aiPrompt;
  }
  
  // v30.1: Check LifeAI mode like runSelectedOperation does
  var _runOpMode = localStorage.getItem('roweos_app_mode') || 'brand';
  if (_runOpMode === 'life') {
    var provider = (typeof studioProviderOverride !== 'undefined' && studioProviderOverride) || (typeof lifeAISelectedProvider !== 'undefined' && lifeAISelectedProvider) || 'anthropic';
    var model = (typeof studioModelOverride !== 'undefined' && studioModelOverride) || 'claude-sonnet-4-6';
  } else {
    // v9.1.14: Get API settings - use override if set, otherwise use brand defaults
    var provider = brand.provider || 'anthropic';
    var model = brand.model || 'claude-sonnet-4-6';

    // Apply model override from controls if set
    if (studioModelOverride && studioProviderOverride) {
      model = studioModelOverride;
      provider = studioProviderOverride;
    }
  }

  // v20.5: RoweOS AI — resolve to actual provider/model
  if (provider === 'roweos') {
    try {
      var _resolved = resolveRoweOSAI({ userMessage: aiPrompt || '', systemPrompt: '' });
      provider = _resolved.provider;
      model = _resolved.model;
    } catch(routeErr) {
      console.warn('[RoweOS AI] Route error, falling back:', routeErr);
      provider = 'anthropic'; model = 'claude-sonnet-4-6';
    }
  }

  var apiKey = await getApiKey(provider);
  
  if (!apiKey) {
    showToast('API key for ' + provider + ' not configured', 'error');
    btn.disabled = false;
    btn.classList.remove('running');
    // v9.1.14: Different button text for image operations
    if (selectedOp.isImageOp) {
      btn.textContent = 'Generate Image: ' + selectedOp.name;
    } else {
      btn.textContent = 'Execute: ' + selectedOp.name;
    }
    if (studioLayout) studioLayout.classList.remove('agent-thinking');
    if (mainSidebar) mainSidebar.classList.remove('shimmer-active');
    return;
  }
  
  // v9.1.14: Initialize streaming output panel
  var outputContent = document.getElementById('studioOutputContent');
  var outputHeader = document.getElementById('studioOutputHeader');
  var outputActions = document.getElementById('studioOutputActions');
  
  if (outputContent) {
    var agentInfo = activeAgent ? activeAgent.icon + ' ' : '';
    if (outputHeader) {
      var _ctxTitle = (typeof getStudioContextTitle === 'function' ? getStudioContextTitle(selectedOp, brand ? (brand.shortName || brand.name) : '') : '') || selectedOp.name;
      outputHeader.innerHTML = '<div class="studio-selected-op-info"><div class="studio-selected-op-name">' + agentInfo + escapeHtml(_ctxTitle) + '</div><div class="studio-selected-op-brand">' + escapeHtml(brand.name) + '</div></div>';
    }
    // Show streaming placeholder with cursor
    outputContent.innerHTML = '<div class="studio-output-meta"><span>Generating...</span></div><div class="studio-output-canvas" id="studioStreamingCanvas"><span class="streaming-cursor"></span></div>';
  }
  
  // Call STREAMING API (v9.1.14)
  console.log('=== Studio STREAMING API Call ===');
  console.log('Provider:', provider);
  console.log('Model:', model);
  console.log('Output Length:', studioOutputLength);
  console.log('Operation:', selectedOp.name);
  
  var streamStartTime = Date.now();
  
  // v30.1: Declare in outer scope so both onComplete and onError can access
  var runMode = localStorage.getItem('roweos_app_mode') || 'brand';
  var _brandLabel2 = brand ? (brand.shortName || brand.name) : 'Unknown';

  callStudioAPIStreaming(provider, model, apiKey, aiPrompt,
    // onChunk - update UI progressively
    function(chunk, fullText) {
      var canvas = document.getElementById('studioStreamingCanvas');
      if (canvas) {
        canvas.innerHTML = markdownToHtml(fullText) + '<span class="streaming-cursor"></span>';
        canvas.scrollTop = canvas.scrollHeight;
      }
    },
    // onComplete - finalize output
    function(generatedContent) {
      var wordCount = generatedContent.split(/\s+/).filter(function(w) { return w.length > 0; }).length;
      var readingTime = Math.ceil(wordCount / 200);
      var genTime = ((Date.now() - streamStartTime) / 1000).toFixed(1);
      
      // v22.33: Clean meta — word count, read time, gen time
      var metaHtml = '<div class="studio-output-meta">';
      metaHtml += '<span>' + wordCount.toLocaleString() + ' words</span>';
      metaHtml += ' · <span>~' + readingTime + ' min read</span>';
      metaHtml += ' · <span>' + genTime + 's</span>';
      metaHtml += '</div>';
      
      // Update output with final content (no cursor)
      if (outputContent) {
        outputContent.innerHTML = metaHtml + '<div class="studio-output-canvas">' + markdownToHtml(generatedContent) + '</div>';
      }
      
      // v11.0.5: Track mode for separating History outputs (v30.1: moved var to outer scope)
      runMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';

      // Create run record (v30.1: _brandLabel2 declared in outer scope)
      _brandLabel2 = brand ? (brand.shortName || brand.name) : 'Unknown';
      var run = {
        id: Date.now(),
        op: selectedOp.name,
        contextTitle: getStudioContextTitle(selectedOp, _brandLabel2) || selectedOp.name,
        brand: _brandLabel2,
        agent: activeAgent ? activeAgent.id : null,
        agentName: activeAgent ? activeAgent.name : null,
        agentIcon: activeAgent ? activeAgent.icon : null,
        plan: plan,
        deliv: generatedContent || templateStructure,
        context: context,
        time: new Date().toLocaleString(),
        aiGenerated: true,
        mode: runMode  // v11.0.5: Track mode for History separation
      };
      runs.push(run);
      // v30.1: Removed duplicate saveRuns() — kept only the one inside history try block below

      // v15.15: Also save to agentCommands for History view + Firebase sync
      try {
        if (typeof agentCommands !== 'undefined') {
          agentCommands.push({
            id: run.id,
            brand: brand ? (brand.shortName || brand.name) : 'Unknown',
            mode: runMode,
            command: selectedOp.name + (context ? ': ' + context.substring(0, 100) : ''),
            operation: selectedOp.name,
            // v15.32: Store full content — truncation happens at sync layer
            result: generatedContent || templateStructure || '',
            source: 'studio',
            date: new Date().toISOString(),
            time: run.time,
            conversation: [
              { role: 'user', content: context || plan },
              { role: 'assistant', content: generatedContent || templateStructure }
            ]
          });
          saveRuns();
        }
      } catch(histErr) { console.warn('[Studio] History save error:', histErr); }

      // v30.1: Write to auto lab history (was missing from runOp path)
      if (typeof addAutoLabHistory === 'function') {
        addAutoLabHistory({ name: selectedOp.name, action: 'studio-run' }, true, (generatedContent || '').substring(0, 500));
      }

      // Update hidden elements for compatibility
      // v30.1: Null guard hidden elements
      var _planEl = document.getElementById('plan'); if (_planEl) _planEl.textContent = run.plan;
      var _delivEl = document.getElementById('deliv'); if (_delivEl) _delivEl.value = run.deliv;
      var _delivCanvas = document.getElementById('delivCanvas'); if (_delivCanvas) _delivCanvas.innerHTML = markdownToHtml(run.deliv);
      window.currentRun = run;

      // Show actions
      if (outputActions) outputActions.style.display = 'flex';

      showHistory();
      renderOperations();
      renderStudioRunHistory(); // v15.33: Refresh Studio sidebar history

      // v17.0: Auto-show social publisher for social operations
      if (typeof checkAndShowSocialPublisher === 'function' && selectedOp) {
        checkAndShowSocialPublisher(selectedOp.id, run.deliv || fullResponse);
      }

      // v23.14: Smart suggestions at end of Studio session
      if (typeof renderSmartSuggestions === 'function' && run) {
        renderSmartSuggestions(run, selectedOp);
      }

      // Remove thinking animation
      if (studioLayout) studioLayout.classList.remove('agent-thinking');
      if (mainSidebar) mainSidebar.classList.remove('shimmer-active');

      if (btn) { // v30.1: Null guard
        btn.disabled = false;
        btn.classList.remove('running');
        if (selectedOp.isImageOp) {
          btn.textContent = 'Generate Image: ' + selectedOp.name;
        } else {
          btn.textContent = 'Execute: ' + selectedOp.name;
        }
      }
      showToast('Agent task completed in ' + genTime + 's', 'success');
    },
    // onError - handle failure
    function(error) {
      console.error('Studio API error:', error);
      showToast('API error: ' + error + ' (showing template)', 'error');
      
      var run = {
        id: Date.now(),
        op: selectedOp.name,
        contextTitle: getStudioContextTitle(selectedOp, _brandLabel2) || selectedOp.name,
        brand: _brandLabel2,
        agent: activeAgent ? activeAgent.id : null,
        agentName: activeAgent ? activeAgent.name : null,
        agentIcon: activeAgent ? activeAgent.icon : null,
        plan: plan,
        deliv: '⚠️ **API Error:** ' + error + '\n\n---\n\n' + templateStructure,
        context: context,
        time: new Date().toLocaleString(),
        mode: runMode || localStorage.getItem('roweos_app_mode') || 'brand'  // v11.0.5
      };
      runs.push(run);
      saveRuns();
      showOutput(run);
      showHistory();
      renderOperations();
      
      // Remove thinking animation
      if (studioLayout) studioLayout.classList.remove('agent-thinking');
      if (mainSidebar) mainSidebar.classList.remove('shimmer-active');
      
      if (btn) { // v30.1: Null guard
        btn.disabled = false;
        btn.classList.remove('running');
        if (selectedOp.isImageOp) {
          btn.textContent = 'Generate Image: ' + selectedOp.name;
        } else {
          btn.textContent = 'Execute: ' + selectedOp.name;
        }
      }
    }
  );
}

// v23.14: Smart Studio Suggestions — context-aware post-session actions
var SMART_SUGGESTION_ICONS = {
  pdf: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13h4M10 17h4M8 9h1"/></svg>',
  email: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>',
  identity: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  focus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  automation: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
  save: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
  regenerate: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
  chat: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  rhythm: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>'
};

function getSmartSuggestions(run, selectedOp) {
  var suggestions = [];
  var content = (run && run.deliv) || '';
  var opName = (selectedOp && selectedOp.name) || (run && run.op) || '';
  var isImageOp = selectedOp && selectedOp.isImageOp;
  var isVideoOp = selectedOp && selectedOp.isVideoOp;
  var isSocialOp = selectedOp && selectedOp.isSocialOp;
  var isEmailOp = selectedOp && selectedOp.isEmailOp;
  var contentLower = content.substring(0, 2000).toLowerCase();
  var opLower = opName.toLowerCase();

  // 1. Save as PDF — always for text-based (primary, gold)
  if (!isImageOp && !isVideoOp && content.length > 100) {
    suggestions.push({ type: 'pdf', label: 'Save as PDF', primary: true });
  }

  // 2. Send Email — reports, pitches, proposals, summaries, newsletters, briefs
  var emailPatterns = /pitch|proposal|report|summary|newsletter|email|brief|memo|presentation|packet|deck|letter|welcome|outreach|follow.?up/i;
  if (!isSocialOp && (emailPatterns.test(opLower) || emailPatterns.test(contentLower.substring(0, 500)))) {
    suggestions.push({ type: 'email', label: 'Send as Email' });
  }

  // 3. Add to Identity — strategy, analysis, brand research, positioning
  var identityPatterns = /strategy|identity|brand|analysis|research|insight|positioning|audience|voice|messaging|competitive|persona|value.?prop|mission|vision/i;
  if (identityPatterns.test(opLower) || identityPatterns.test(contentLower.substring(0, 500))) {
    suggestions.push({ type: 'identity', label: 'Add to Identity' });
  }

  // 4. Create Focus Tasks — action items, checklists, task lists, plans
  if (typeof detectChecklistInResponse === 'function' && detectChecklistInResponse(content)) {
    suggestions.push({ type: 'focus', label: 'Create Focus Tasks' });
  } else {
    var taskPatterns = /task|step|action item|to.?do|checklist|plan|timeline|milestone|deadline|next steps|deliverable/i;
    if (taskPatterns.test(contentLower.substring(0, 1000))) {
      suggestions.push({ type: 'focus', label: 'Create Focus Tasks' });
    }
  }

  // 5. Create Automation — recurring, scheduled, campaigns
  var autoPatterns = /recurring|weekly|monthly|daily|schedule|automate|regular|ongoing|campaign|cadence|routine|series/i;
  if (autoPatterns.test(contentLower.substring(0, 1000)) || autoPatterns.test(opLower)) {
    suggestions.push({ type: 'automation', label: 'Create Automation' });
  }

  // 6. Chat with BrandAI — always for text-based outputs
  if (!isImageOp && !isVideoOp && content.length > 100) {
    suggestions.push({ type: 'chat', label: 'Chat with BrandAI' });
  }

  return suggestions;
}

function renderSmartSuggestions(run, selectedOp) {
  var outputContent = document.getElementById('studioOutputContent');
  if (!outputContent) return;
  var suggestions = getSmartSuggestions(run, selectedOp);

  // Remove any existing smart suggestions
  var existing = outputContent.querySelector('.studio-smart-suggestions');
  if (existing) existing.remove();

  if (suggestions.length === 0) return;

  // Build bottom pills
  var html = '<div class="studio-smart-suggestions">';
  for (var i = 0; i < suggestions.length; i++) {
    var s = suggestions[i];
    html += '<button class="studio-smart-pill' + (s.primary ? ' primary' : '') + '" onclick="handleSmartSuggestion(\'' + s.type + '\')">' +
      (SMART_SUGGESTION_ICONS[s.type] || '') + ' ' + escapeHtml(s.label) + '</button>';
  }
  html += '</div>';
  outputContent.insertAdjacentHTML('beforeend', html);

  // Build top dropdown with ALL actions
  renderSmartSuggestionsDropdown(suggestions);
}

function renderSmartSuggestionsDropdown(contextSuggestions) {
  // v23.14: Target the V2 output header actions area
  var outputSection = document.getElementById('studioOutputSection');
  var outputHeader = outputSection ? outputSection.querySelector('.studio-v2-output-actions') : null;
  if (!outputHeader) return;

  // Remove existing dropdown
  var existing = outputHeader.querySelector('.studio-suggestions-dropdown');
  if (existing) existing.remove();

  var allActions = [];
  // Context-aware suggestions first
  for (var i = 0; i < contextSuggestions.length; i++) {
    allActions.push(contextSuggestions[i]);
  }
  // Divider + standard actions
  var standardActions = [
    { type: 'divider' },
    { type: 'save', label: 'Save to Library' },
    { type: 'regenerate', label: 'Regenerate' },
    { type: 'chat', label: 'Chat with Output' },
    { type: 'rhythm', label: 'Add to Rhythm' },
    { type: 'share', label: 'Share' }
  ];

  var html = '<div class="studio-suggestions-dropdown">';
  html += '<button class="studio-suggestions-dropdown-btn" onclick="toggleSmartSuggestionsMenu(event)">';
  html += '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg> Actions';
  html += '</button>';
  html += '<div class="studio-suggestions-menu" id="studioSuggestionsMenu">';

  // Smart suggestions
  for (var j = 0; j < allActions.length; j++) {
    var a = allActions[j];
    html += '<div class="studio-suggestions-menu-item' + (a.primary ? ' gold' : '') + '" onclick="handleSmartSuggestion(\'' + a.type + '\');closeSmartSuggestionsMenu()">' +
      (SMART_SUGGESTION_ICONS[a.type] || '') + ' ' + escapeHtml(a.label) + '</div>';
  }

  // Standard actions
  for (var k = 0; k < standardActions.length; k++) {
    var sa = standardActions[k];
    if (sa.type === 'divider') {
      html += '<div class="studio-suggestions-divider"></div>';
    } else {
      html += '<div class="studio-suggestions-menu-item" onclick="handleSmartSuggestion(\'' + sa.type + '\');closeSmartSuggestionsMenu()">' +
        (SMART_SUGGESTION_ICONS[sa.type] || '') + ' ' + escapeHtml(sa.label) + '</div>';
    }
  }

  html += '</div></div>';
  outputHeader.insertAdjacentHTML('beforeend', html);
}

function toggleSmartSuggestionsMenu(e) {
  e.stopPropagation();
  var menu = document.getElementById('studioSuggestionsMenu');
  if (!menu) return;
  var isOpen = menu.classList.contains('open');
  menu.classList.toggle('open', !isOpen);
  if (!isOpen) {
    var closeHandler = function(ev) {
      if (!menu.contains(ev.target)) {
        menu.classList.remove('open');
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(function() { document.addEventListener('click', closeHandler); }, 0);
  }
}

function closeSmartSuggestionsMenu() {
  var menu = document.getElementById('studioSuggestionsMenu');
  if (menu) menu.classList.remove('open');
}

function handleSmartSuggestion(type) {
  switch (type) {
    case 'pdf':
      studioSmartExportPDF();
      break;
    case 'email':
      studioSmartSendEmail();
      break;
    case 'identity':
      studioSmartAddToIdentity();
      break;
    case 'focus':
      studioSmartCreateFocusTasks();
      break;
    case 'automation':
      studioSmartCreateAutomation();
      break;
    case 'save':
      save();
      break;
    case 'regenerate':
      regenerateOutput();
      break;
    case 'chat':
      chatWithStudioOutput();
      break;
    case 'rhythm':
      proposeSchedule();
      break;
    case 'share':
      shareOutput();
      break;
  }
}

// v23.14: Smart PDF export — auto-default for text Studio sessions
function studioSmartExportPDF() {
  // v23.16: Auto-save any pending edits before exporting
  var _outputContent = document.getElementById('studioOutputContent');
  if (_outputContent) {
    var _editCanvas = _outputContent.querySelector('[contenteditable="true"]');
    if (_editCanvas) saveOutputEdits();
  }
  if (window.currentRun && typeof universalPDFExport === 'function') {
    // v23.16: Use edited HTML if available (preserves rich text edits), else markdown
    var content = window.currentRun._editedHtml || window.currentRun.deliv;
    universalPDFExport(content, {
      title: window.currentRun.contextTitle || window.currentRun.op || 'Studio Export'
    });
  } else if (typeof exportStudioAsPDF === 'function') {
    exportStudioAsPDF(window.currentRun);
  } else {
    showToast('PDF export not available', 'error');
  }
}

// v23.14: Smart email — pre-fill compose with Studio output
function studioSmartSendEmail() {
  if (!window.currentRun || !window.currentRun.deliv) {
    showToast('No content to email', 'error');
    return;
  }
  var run = window.currentRun;
  // Store Studio content for template changes
  window._composerStudioContent = markdownToHtml(run.deliv);
  // Pre-fill the email composer
  if (typeof openModal === 'function') openModal('betaEmailPreviewModal');
  var subjectEl = document.getElementById('composerSubject');
  if (subjectEl) subjectEl.value = run.contextTitle || run.op || 'Studio Output';
  // Load branded template and inject Studio content
  var templateEl = document.getElementById('composerTemplate');
  if (templateEl) {
    templateEl.value = 'brand-professional';
    loadComposerTemplate('brand-professional');
  }
  // Load From options
  if (typeof renderMailComposeFrom === 'function') renderMailComposeFrom();
}

// v23.14: Smart identity — extract insights, show preview, then save on approval
function studioSmartAddToIdentity() {
  if (!window.currentRun || !window.currentRun.deliv) {
    showToast('No content to analyze', 'error');
    return;
  }
  var content = window.currentRun.deliv;
  var opName = window.currentRun.op || 'Studio Output';

  // Show extraction progress
  showToast('Extracting identity insights...', 'info');

  // Use AI to extract structured insights
  studioExtractIdentityInsights(content, opName, function(insights) {
    if (!insights || insights.length === 0) {
      showToast('No identity insights found in this content', 'info');
      return;
    }
    // Show approval modal
    studioShowIdentityApproval(insights, opName);
  });
}

function studioExtractIdentityInsights(content, opName, callback) {
  // Build extraction prompt
  var sections = ['essence', 'voice', 'audience', 'messaging', 'products', 'visual', 'competitive'];
  var brand = brands[typeof selectedBrand !== 'undefined' ? selectedBrand : 0];
  var brandName = brand ? (brand.shortName || brand.name) : 'brand';

  var prompt = 'Analyze this content and extract key insights that should be saved to the brand identity profile for ' + brandName + '.\n\n' +
    'Content from Studio operation "' + opName + '":\n\n' + content.substring(0, 8000) + '\n\n' +
    'Return a JSON array of insight objects. Each object should have:\n' +
    '- "section": one of ' + JSON.stringify(sections) + '\n' +
    '- "insight": a concise, actionable insight (1-3 sentences)\n\n' +
    'Only include sections where there are genuinely relevant insights. Return ONLY the JSON array, no other text.\n' +
    'Example: [{"section":"voice","insight":"Brand uses confident, direct tone with technical precision."}]';

  // Use the configured AI provider
  var apiKey = '';
  try { apiKey = localStorage.getItem('roweos_api_key') || ''; } catch(e) {}
  var model = 'claude-sonnet-4-20250514';

  if (!apiKey) {
    // Try OpenAI
    try { apiKey = localStorage.getItem('roweos_openai_key') || ''; } catch(e) {}
    if (apiKey) model = 'gpt-4o-mini';
  }
  if (!apiKey) {
    // Try Google
    try { apiKey = localStorage.getItem('roweos_google_key') || ''; } catch(e) {}
    if (apiKey) model = 'gemini-2.0-flash';
  }

  if (!apiKey) {
    // Fallback: simple keyword extraction without AI
    var fallbackInsights = [];
    var contentLower = content.toLowerCase();
    if (/brand voice|tone|language|style of communication/i.test(content)) {
      // v30.1: ES5 safe — no optional chaining
      var _voiceMatch = content.match(/[^.]*(?:voice|tone|language)[^.]*/i);
      fallbackInsights.push({ section: 'voice', insight: (_voiceMatch && _voiceMatch[0] ? _voiceMatch[0].trim() : null) || 'Voice insights extracted from ' + opName });
    }
    if (/target audience|customer|demographic|market segment/i.test(content)) {
      var _audMatch = content.match(/[^.]*(?:audience|customer|demographic)[^.]*/i);
      fallbackInsights.push({ section: 'audience', insight: (_audMatch && _audMatch[0] ? _audMatch[0].trim() : null) || 'Audience insights extracted from ' + opName });
    }
    if (/product|service|offering/i.test(content)) {
      var _prodMatch = content.match(/[^.]*(?:product|service|offering)[^.]*/i);
      fallbackInsights.push({ section: 'products', insight: (_prodMatch && _prodMatch[0] ? _prodMatch[0].trim() : null) || 'Product insights extracted from ' + opName });
    }
    callback(fallbackInsights);
    return;
  }

  // Call AI for structured extraction
  var isAnthropic = model.indexOf('claude') !== -1;
  var isGoogle = model.indexOf('gemini') !== -1;

  if (isAnthropic) {
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    }).then(function(r) { return r.json(); }).then(function(data) {
      try {
        var text = data.content && data.content[0] ? data.content[0].text : '';
        var jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) callback(JSON.parse(jsonMatch[0]));
        else callback([]);
      } catch(e) { console.error('[SmartSuggestions] Parse error:', e); callback([]); }
    }).catch(function(e) { console.error('[SmartSuggestions] API error:', e); callback([]); });
  } else if (isGoogle) {
    fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }).then(function(r) { return r.json(); }).then(function(data) {
      try {
        var text = data.candidates && data.candidates[0] ? data.candidates[0].content.parts[0].text : '';
        var jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) callback(JSON.parse(jsonMatch[0]));
        else callback([]);
      } catch(e) { callback([]); }
    }).catch(function() { callback([]); });
  } else {
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    }).then(function(r) { return r.json(); }).then(function(data) {
      try {
        var text = data.choices && data.choices[0] ? data.choices[0].message.content : '';
        var jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) callback(JSON.parse(jsonMatch[0]));
        else callback([]);
      } catch(e) { callback([]); }
    }).catch(function() { callback([]); });
  }
}

function studioShowIdentityApproval(insights, opName) {
  var sectionLabels = { essence: 'Brand Essence', voice: 'Brand Voice', audience: 'Target Audience', messaging: 'Key Messaging', products: 'Products & Services', visual: 'Visual Identity', competitive: 'Competitive Position' };

  var html = '<div style="padding:20px;">';
  html += '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Identity Insights from "' + escapeHtml(opName) + '"</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Review and approve the insights to add to your brand identity.</div>';
  html += '<div class="studio-identity-preview">';

  for (var i = 0; i < insights.length; i++) {
    var ins = insights[i];
    var sLabel = sectionLabels[ins.section] || ins.section;
    html += '<div class="insight-item">';
    html += '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;">';
    html += '<input type="checkbox" checked data-idx="' + i + '" style="margin-top:3px;accent-color:#a89878;">';
    html += '<div><div class="insight-section">' + escapeHtml(sLabel) + '</div>';
    html += '<div style="color:var(--text-primary);font-size:12px;">' + escapeHtml(ins.insight) + '</div></div>';
    html += '</label></div>';
  }

  html += '</div>';
  html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">';
  html += '<button class="btn btn-secondary" onclick="closeModal(\'studioIdentityApprovalModal\')" style="padding:8px 16px;font-size:12px;">Cancel</button>';
  html += '<button class="btn" onclick="studioApplyIdentityInsights()" style="padding:8px 16px;font-size:12px;background:var(--brand-accent,#a89878);color:#fff;border-color:var(--brand-accent,#a89878);">Apply Selected</button>';
  html += '</div></div>';

  // Store insights for apply function
  window._pendingIdentityInsights = insights;

  // Create or reuse modal
  var modal = document.getElementById('studioIdentityApprovalModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'studioIdentityApprovalModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = '<div class="modal" style="max-width:520px;">' +
      '<div class="modal-header"><div class="modal-title">' + SMART_SUGGESTION_ICONS.identity + ' Add to Identity</div>' +
      '<button class="modal-close" onclick="closeModal(\'studioIdentityApprovalModal\')">&times;</button></div>' +
      '<div id="studioIdentityApprovalBody"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById('studioIdentityApprovalBody').innerHTML = html;
  openModal('studioIdentityApprovalModal');
}

function studioApplyIdentityInsights() {
  var insights = window._pendingIdentityInsights || [];
  var container = document.getElementById('studioIdentityApprovalBody');
  var checkboxes = container ? container.querySelectorAll('input[type="checkbox"]') : [];
  var applied = 0;
  var brand = brands[typeof selectedBrand !== 'undefined' ? selectedBrand : 0];
  if (!brand) { showToast('No brand selected', 'error'); return; }
  if (!brand.identityData) brand.identityData = {};

  for (var i = 0; i < checkboxes.length; i++) {
    if (!checkboxes[i].checked) continue;
    var idx = parseInt(checkboxes[i].getAttribute('data-idx'));
    var ins = insights[idx];
    if (!ins || !ins.section || !ins.insight) continue;

    if (!brand.identityData[ins.section]) brand.identityData[ins.section] = {};
    var existingAi = brand.identityData[ins.section].ai || '';
    if (Array.isArray(existingAi)) {
      existingAi = existingAi.map(function(item) { return typeof item === 'string' ? item : (item.text || ''); }).join('\n');
    }
    brand.identityData[ins.section].ai = existingAi ? existingAi + '\n\n' + ins.insight : ins.insight;
    applied++;
  }

  if (applied > 0) {
    saveBrands();
    if (typeof updateIdentityBadges === 'function') {
      insights.forEach(function(ins) { updateIdentityBadges(ins.section); });
    }
    // v25.1: saveBrands() already writes through to Firestore
    showToast(applied + ' insight(s) added to Identity', 'success');
  }
  closeModal('studioIdentityApprovalModal');
}

// v23.14: Smart Focus Tasks — extract tasks from Studio output
function studioSmartCreateFocusTasks() {
  if (!window.currentRun || !window.currentRun.deliv) return;
  var content = window.currentRun.deliv;

  // Try checklist import flow if available
  if (typeof detectChecklistInResponse === 'function' && detectChecklistInResponse(content)) {
    var items = extractChecklistItems(content);
    var title = extractChecklistTitle(content);
    if (items.length >= 1) {
      window._pendingChecklistItems = items;
      window._pendingChecklistTitle = title;
      window._pendingChecklistRawText = content;
      if (typeof importChecklistFromStudio === 'function') {
        importChecklistFromStudio();
        return;
      }
    }
  }

  // Fallback: navigate to Focus and show toast
  showView('pulse'); // v28.8: signal retired, redirect to pulse
  showToast('Paste relevant tasks into Pulse from your Studio output', 'info');
}

// v23.14: Smart Automation — pre-fill automation from current operation
function studioSmartCreateAutomation() {
  if (!window.currentRun) return;
  var run = window.currentRun;
  // Navigate to Automations and pre-fill
  showView('automations');
  showToast('Create a new automation based on "' + (run.op || 'Studio output') + '"', 'info');
  // If there's a create automation function, call it with pre-fill data
  if (typeof openCreateAutomationModal === 'function') {
    setTimeout(function() {
      openCreateAutomationModal({ prefillOp: run.op, prefillContext: (run.context || '').substring(0, 500) });
    }, 300);
  }
}

function save() {
  // Check if we have BrandAI conversation content to save
  if (currentConversation && currentConversation.length > 0) {
    // Get the last assistant response
    var lastAssistant = null;
    for (var i = currentConversation.length - 1; i >= 0; i--) {
      if (currentConversation[i].role === 'assistant') {
        lastAssistant = currentConversation[i];
        break;
      }
    }
    
    if (lastAssistant) {
      openSaveLibraryModalForBrandAI(lastAssistant.content);
      return;
    }
  }
  
  // Check for Studio run output - open library modal
  if (window.currentRun && window.currentRun.deliv) {
    openSaveLibraryModalForStudio();
    return;
  }
  
  showToast('No content to save', 'warning');
}

function openSaveLibraryModalForStudio() {
  var run = window.currentRun;
  
  // Store the content to save
  window.pendingSaveContent = run.deliv;
  window.pendingSaveSource = 'studio';
  window.pendingSaveOperation = run.op;
  
  // v10.5.25: Mode-aware save
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var inLifeMode = currentMode === 'life';
  window.pendingSaveMode = currentMode;
  
  // Generate default name
  var defaultName = run.op + ' - ' + new Date().toLocaleDateString();
  document.getElementById('saveFileName').value = defaultName;

  refreshLibraryFromStorage(); // v15.33: Pick up sync changes
  if (inLifeMode) {
    window.pendingSaveBrandIdx = null;
    renderSaveFolderList(); // Mode-aware folder list
  } else {
    // v15.15: Get brand index — try name, shortName, then fallback to selectedBrand
    var brandIdx = selectedBrand || 0;
    for (var i = 0; i < brands.length; i++) {
      if (brands[i].name === run.brand || brands[i].shortName === run.brand) {
        brandIdx = i;
        break;
      }
    }
    window.pendingSaveBrandIdx = brandIdx;
    renderSaveFolderList();
  }

  document.getElementById('saveLibraryModal').classList.add('open');
}

function openSaveLibraryModalForBrandAI(content) {
  // Store the content to save
  window.pendingSaveContent = content;

  // v15.18: Snapshot conversation at open time
  if (typeof currentConversation !== 'undefined' && currentConversation && currentConversation.length > 0) {
    window.pendingSaveConversation = JSON.parse(JSON.stringify(currentConversation));
  }

  // v10.5.25: Mode-aware save - detect LifeAI mode
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var inLifeMode = currentMode === 'life';
  window.pendingSaveMode = currentMode;

  if (inLifeMode) {
    window.pendingSaveSource = 'lifeai';
    window.pendingSaveBrandIdx = null;
    
    // Generate default name for LifeAI
    var profile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
    var userName = profile && profile.name ? profile.name : 'LifeAI';
    var defaultName = userName + ' Chat - ' + new Date().toLocaleDateString();
    
    document.getElementById('saveFileName').value = defaultName;
    renderSaveFolderList(); // Mode-aware folder list
  } else {
    window.pendingSaveSource = 'brandai';
    
    // Get current brand from BrandAI selector
    var brandSelect = document.getElementById('agentBrand');
    var brandIdx = brandSelect ? parseInt(brandSelect.value) : 0;
    window.pendingSaveBrandIdx = brandIdx;
    
    // Generate default name
    var defaultName = 'BrandAI Output - ' + new Date().toLocaleDateString();
    
    document.getElementById('saveFileName').value = defaultName;
    renderSaveFolderList();
  }

  document.getElementById('saveLibraryModal').classList.add('open');
}

/**
 * v9.1.14: Save entire BrandAI conversation to Library
 * v11.0.5: Use AI-generated title if available
 */
// v25.1: Save menu — choose Folio or Library
function openChatSaveMenu(btn) {
  // Remove any existing save menu
  var existing = document.getElementById('chatSaveMenu');
  if (existing) { existing.remove(); return; }
  var menu = document.createElement('div');
  menu.id = 'chatSaveMenu';
  menu.style.cssText = 'position:fixed;z-index:100000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:4px;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,0.4);';
  menu.innerHTML = '<button onclick="event.stopPropagation();saveChatMsgToFolio(this);document.getElementById(\'chatSaveMenu\').remove();" style="display:block;width:100%;padding:10px 14px;background:transparent;border:none;color:var(--text-primary);cursor:pointer;text-align:left;font-size:13px;font-family:inherit;border-radius:var(--radius-sm);" ontouchstart="this.style.background=\'var(--bg-tertiary)\'" ontouchend="this.style.background=\'transparent\'"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:8px;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>Save to Folio</button>'
    + '<button onclick="event.stopPropagation();openSaveConversationToLibrary();document.getElementById(\'chatSaveMenu\').remove();" style="display:block;width:100%;padding:10px 14px;background:transparent;border:none;color:var(--text-primary);cursor:pointer;text-align:left;font-size:13px;font-family:inherit;border-radius:var(--radius-sm);" ontouchstart="this.style.background=\'var(--bg-tertiary)\'" ontouchend="this.style.background=\'transparent\'"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:8px;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>Save to Library</button>'
    + '<button onclick="event.stopPropagation();saveChatMsgAsGoal(this);document.getElementById(\'chatSaveMenu\').remove();" style="display:block;width:100%;padding:10px 14px;background:transparent;border:none;color:var(--text-primary);cursor:pointer;text-align:left;font-size:13px;font-family:inherit;border-radius:var(--radius-sm);" ontouchstart="this.style.background=\'var(--bg-tertiary)\'" ontouchend="this.style.background=\'transparent\'"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:8px;"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>Add as Goal</button>';
  // Position above the button using fixed positioning
  var rect = btn.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 160)) + 'px';
  menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
  document.body.appendChild(menu);
  // Prevent bubble toggle from closing actions
  event.stopPropagation();
  // Close on any tap outside
  setTimeout(function() {
    var _handler = function(e) {
      if (!e.target.closest('#chatSaveMenu')) {
        var m = document.getElementById('chatSaveMenu');
        if (m) m.remove();
        document.removeEventListener('click', _handler);
        document.removeEventListener('touchend', _handler);
      }
    };
    document.addEventListener('click', _handler);
    document.addEventListener('touchend', _handler);
  }, 50);
}

// v25.1: Save last AI message content to Folio
function saveChatMsgToFolio(btn) {
  if (!currentConversation || currentConversation.length === 0) {
    showToast('No conversation to save', 'warning');
    return;
  }
  // Find the last assistant message
  var lastAssistant = null;
  for (var i = currentConversation.length - 1; i >= 0; i--) {
    if (currentConversation[i].role === 'assistant') {
      lastAssistant = currentConversation[i];
      break;
    }
  }
  if (!lastAssistant) { showToast('No AI response to save', 'warning'); return; }
  var content = lastAssistant.content || '';
  if (typeof saveToFolio === 'function') {
    saveToFolio(content, 'Chat Response ' + new Date().toLocaleDateString(), 'folio-chat');
    showToast('Saved to Folio', 'success');
  } else {
    showToast('Folio not available', 'error');
  }
}

// v25.1: Save chat message as a Pulse goal
function saveChatMsgAsGoal(btn) {
  if (!currentConversation || currentConversation.length === 0) {
    showToast('No conversation to save', 'warning');
    return;
  }
  // Find the nearest assistant message from the button's message bubble
  var msgBubble = btn ? btn.closest('.conversation-message') : null;
  var content = '';
  if (msgBubble) {
    var contentEl = msgBubble.querySelector('.conversation-message-content');
    if (contentEl) content = contentEl.textContent || '';
  }
  // Fallback: get last assistant message
  if (!content) {
    for (var i = currentConversation.length - 1; i >= 0; i--) {
      if (currentConversation[i].role === 'assistant') {
        content = typeof currentConversation[i].content === 'string' ? currentConversation[i].content : '';
        break;
      }
    }
  }
  if (!content) { showToast('No AI response to create goal from', 'warning'); return; }
  // Extract a title from the first line or first sentence
  var titleText = content.split('\n')[0].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
  if (titleText.length > 80) titleText = titleText.substring(0, 77) + '...';
  if (!titleText) titleText = 'Goal from Chat';
  // Extract bullet points or numbered items as goal tasks
  var items = [];
  var lines = content.split('\n');
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li].trim();
    var match = line.match(/^(?:[-*]|\d+[.)])\s+(.+)/);
    if (match && match[1] && match[1].length > 3) {
      items.push({
        id: 'item_' + Date.now() + '_' + li,
        text: match[1].replace(/\*\*/g, '').substring(0, 200),
        completed: false
      });
    }
  }
  if (items.length === 0) {
    items.push({ id: 'item_' + Date.now(), text: 'Review and take action', completed: false });
  }
  var goal = {
    id: 'goal_' + Date.now(),
    title: titleText,
    category: 'Chat',
    progress: 0,
    items: items,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fromChat: true
  };
  var goals = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
  goals.push(goal);
  localStorage.setItem('roweos_pulse_goals', JSON.stringify(goals));
  if (typeof writeDB === 'function') {
    writeDB('pulse/main', { goals: JSON.stringify(goals) }, { category: 'goals' });
  }
  if (typeof pulseGoals !== 'undefined') {
    pulseGoals = goals;
  }
  showToast('Goal created in Pulse: ' + titleText, 'success');
  if (typeof renderPulseGoals === 'function') {
    setTimeout(renderPulseGoals, 100);
  }
}

function openSaveConversationToLibrary() {
  // Check if there's an active conversation
  if (!currentConversation || currentConversation.length === 0) {
    showToast('No conversation to save', 'warning');
    return;
  }
  
  // Format conversation as readable content
  var content = formatConversationForLibrary(currentConversation);
  
  // v10.5.25: Mode-aware save
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var inLifeMode = currentMode === 'life';
  window.pendingSaveMode = currentMode;
  
  // Store for save — v15.18: snapshot conversation array NOW (not at confirm time)
  // to prevent data loss if currentConversation is reset before user clicks Save
  window.pendingSaveContent = content;
  window.pendingSaveSource = 'conversation';
  window.pendingSaveConversation = JSON.parse(JSON.stringify(currentConversation));
  console.log('[SaveToLibrary] Snapshotted', currentConversation.length, 'messages at save-open time');
  
  // v11.0.5: Try to get AI-generated title from current history entry
  var aiGeneratedTitle = null;
  var targetIdx = window._continuedHistoryIndex;
  if (targetIdx === null || targetIdx === undefined) {
    targetIdx = window._currentPreliminaryIndex;
  }
  if (targetIdx === null || targetIdx === undefined) {
    targetIdx = agentCommands.length - 1;
  }
  if (targetIdx >= 0 && agentCommands[targetIdx]) {
    var historyEntry = agentCommands[targetIdx];
    // Check if title looks like AI-generated (not just truncated message)
    if (historyEntry.command && historyEntry.command.length < 100 && !historyEntry.command.includes('---')) {
      aiGeneratedTitle = historyEntry.command;
    }
  }
  
  // Generate default name - prioritize AI title
  var defaultName;
  var dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  if (aiGeneratedTitle) {
    // Use AI-generated title
    defaultName = aiGeneratedTitle;
    console.log('[SaveToLibrary] Using AI-generated title:', aiGeneratedTitle);
  } else {
    // Fallback to first user message
    var firstUserMsg = currentConversation.find(function(m) { return m.role === 'user'; });
    var preview = firstUserMsg ? (firstUserMsg.displayContent || firstUserMsg.content).substring(0, 50) : 'Conversation';
    if (preview.length === 50) preview += '...';
    preview = preview.replace(/[\n\r]/g, ' ').replace(/---.*$/, '').trim(); // Remove "--- ATTACHED FILE" part
    
    if (inLifeMode) {
      var profile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
      var userName = profile && profile.name ? profile.name : 'LifeAI';
      defaultName = userName + ' - ' + preview + ' (' + dateStr + ')';
    } else {
      var brandSelect = document.getElementById('agentBrand');
      var brandIdx = brandSelect ? parseInt(brandSelect.value) : selectedBrand;
      var brand = brands[brandIdx];
      var brandName = brand ? brand.name : 'Unknown';
      defaultName = brandName + ' - ' + preview + ' (' + dateStr + ')';
    }
  }
  
  if (inLifeMode) {
    window.pendingSaveBrandIdx = null;
    document.getElementById('saveFileName').value = defaultName;
    renderSaveFolderList(); // Mode-aware folder list
  } else {
    // Get current brand
    var brandSelect = document.getElementById('agentBrand');
    var brandIdx = brandSelect ? parseInt(brandSelect.value) : selectedBrand;
    var brand = brands[brandIdx];
    var brandName = brand ? brand.name : 'Unknown';
    
    window.pendingSaveBrandIdx = brandIdx;
    
    document.getElementById('saveFileName').value = defaultName;
    renderSaveFolderList();
  }

  document.getElementById('saveLibraryModal').classList.add('open');

  // Focus the filename input
  setTimeout(function() {
    document.getElementById('saveFileName').focus();
    document.getElementById('saveFileName').select();
  }, 100);
}

/**
 * v9.1.14: Format conversation for library storage with rich text
 */
function formatConversationForLibrary(conversation) {
  // v10.5.25: Mode-aware conversation formatting
  var currentMode = localStorage.getItem('roweos_app_mode') || localStorage.getItem('roweos_mode') || 'brand';
  var inLifeMode = currentMode === 'life';
  var timestamp = new Date().toLocaleString();
  
  var brandName, aiLabel;
  if (inLifeMode) {
    var profile = typeof getLifeAIProfile === 'function' ? getLifeAIProfile() : null;
    brandName = profile && profile.name ? profile.name : 'My Life';
    aiLabel = 'LifeAI';
  } else {
    var brand = brands[selectedBrand];
    brandName = brand ? brand.name : 'Unknown Brand';
    aiLabel = 'BrandAI';
  }
  
  // Store raw conversation JSON for "Continue" functionality
  var rawConversationJson = JSON.stringify(conversation);
  
  var html = '<div class="library-conversation" data-conversation=\'' + rawConversationJson.replace(/'/g, '&#39;') + '\'>';
  
  // Header with view toggle
  html += '<div class="library-convo-header">';
  html += '<div class="library-convo-info">';
  html += '<h2 class="library-convo-title">' + escapeHtml(brandName) + ' - ' + aiLabel + ' Conversation</h2>';
  html += '<p class="library-convo-meta">Saved ' + timestamp + ' • ' + conversation.length + ' messages</p>';
  html += '</div>';
  html += '<div class="library-convo-view-toggle">';
  html += '<button class="convo-view-btn active" data-view="bubble" onclick="toggleConvoView(this, \'bubble\')">Bubble</button>';
  html += '<button class="convo-view-btn" data-view="inline" onclick="toggleConvoView(this, \'inline\')">Inline</button>';
  html += '</div>';
  html += '</div>';
  
  html += '<div class="library-convo-messages" data-view="bubble">';
  
  conversation.forEach(function(msg, idx) {
    var isUser = msg.role === 'user';
    var roleLabel = isUser ? 'You' : aiLabel;
    var roleClass = isUser ? 'user-msg' : 'ai-msg';
    var aiTypeClass = inLifeMode ? 'life-ai' : 'brand-ai';
    
    // Use rich text formatting for assistant messages
    var formattedContent = isUser 
      ? escapeHtml(msg.content).replace(/\n/g, '<br>') 
      : formatMessageContent(msg.content);
    
    html += '<div class="convo-msg ' + roleClass + ' ' + (isUser ? '' : aiTypeClass) + '">';
    html += '<div class="convo-msg-label">' + roleLabel + '</div>';
    html += '<div class="convo-msg-bubble">';
    html += '<div class="convo-msg-content">' + formattedContent + '</div>';
    html += '</div>';
    html += '</div>';
  });
  
  html += '</div>';
  html += '</div>';
  
  return html;
}

// v15.30: renderSaveFolderListForBrand() removed — replaced by mode-aware renderSaveFolderList()

function proposeSchedule() {
  if (!window.currentRun) {
    showToast('No current run to schedule', 'warning');
    return;
  }
  
  var today = new Date();
  today.setDate(today.getDate() + 1);
  var dateStr = today.toISOString().slice(0, 10);
  
  calendar.push({
    id: Date.now(),
    title: window.currentRun.op,
    date: dateStr,
    status: 'proposed',
    brand: window.currentRun.brand,
    runId: window.currentRun.id,
    notes: window.currentRun.context || '',
    opName: window.currentRun.op
  });

  // v13.4: Fix - save to calendar, not runs
  saveCalendar();
  showToast('Scheduled for ' + dateStr + ' -- view in Calendar', 'success');
}

// v9.1.14: Toggle Automations section in Rhythm view
function toggleRhythmAutomations() {
  var content = document.getElementById('rhythmAutomationsContent');
  var toggle = document.getElementById('automationsSectionToggle');
  if (content && toggle) {
    content.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
  }
}

// v22.39: Toggle Auto-Pilot section — no-op now (always visible in grid)
function toggleAutoPilotSection() { /* no-op — grid layout always shows */ }

// v12.0.3: Clear all pending Auto-Pilot actions
function clearAutoPilotQueue() {
  var pending = autoPilotQueue.filter(function(a) { return a.status === 'pending'; });
  if (pending.length === 0) {
    showToast('No pending actions to clear', 'info');
    return;
  }
  pending.forEach(function(a) { a.status = 'dismissed'; });
  saveAutoPilotData();
  renderAutoPilotActions();
  showToast('Cleared ' + pending.length + ' pending action(s)', 'info');
}

// v9.1.14: Render automations list in Rhythm view
function renderRhythmAutomations() {
  var container = document.getElementById('rhythmScheduledTasksList');
  if (!container) return;
  
  var tasks = [];
  try { tasks = JSON.parse(localStorage.getItem('roweos_scheduled_tasks') || '[]'); } catch(e) { console.warn('[Rhythm] Corrupted scheduled tasks:', e.message); }

  if (tasks.length === 0) {
    container.innerHTML = '<div style="padding: var(--space-4); color: var(--text-tertiary); background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--text-base);">No scheduled automations yet. Click "Automation" to create one.</div>';
    return;
  }
  
  var html = '';
  tasks.forEach(function(task) {
    // v10.5.25: Extract date and time from scheduledDate
    var taskDate = task.scheduledDate ? task.scheduledDate.split('T')[0] : '';
    var _tParts = task.scheduledDate ? task.scheduledDate.split('T') : []; // v30.1: ES5 safe
    var taskTime = task.time || (_tParts[1] ? _tParts[1].substring(0, 5) : '');
    
    var scheduleText = task.frequency === 'daily' ? 'Daily @ ' + taskTime :
                       task.frequency === 'weekly' ? 'Weekly on ' + (task.dayOfWeek || 'Monday') + ' @ ' + taskTime :
                       task.frequency === 'monthly' ? 'Monthly on day ' + (task.dayOfMonth || '1') + ' @ ' + taskTime :
                       'On demand';
    
    html += '<div class="rhythm-automation-item">';
    html += '<div class="rhythm-automation-info">';
    html += '<div class="rhythm-automation-title">' + task.name + '</div>';
    html += '<div class="rhythm-automation-schedule">' + scheduleText + '</div>';
    html += '</div>';
    html += '<div class="rhythm-automation-actions">';
    html += '<button class="rhythm-automation-btn" onclick="runScheduledTask(\'' + task.id + '\')">Run</button>';
    html += '<button class="rhythm-automation-btn" onclick="deleteScheduledTask(\'' + task.id + '\')">×</button>';
    html += '</div>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

function changeWeek(dir) {
  currentWeekOffset += dir;
  renderCalendar();
}

function toggleCalendarView() {
  calendarView = calendarView === 'week' ? 'month' : 'week';
  document.getElementById('calViewToggle').textContent = calendarView === 'week' ? 'Month View' : 'Week View';
  renderCalendar();
}

function renderCalendar() {
  var c = document.getElementById('calendar');
  var display = document.getElementById('weekDisplay');
  
  var today = new Date();
  var todayStr = today.toISOString().slice(0, 10);
  
  if (calendarView === 'week') {
    var start = new Date(today);
    start.setDate(start.getDate() - start.getDay() + (currentWeekOffset * 7));
    
    var end = new Date(start);
    end.setDate(end.getDate() + 6);
    
    display.textContent = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    var html = '<div class="calendar-grid">';
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (var i = 0; i < 7; i++) {
      var day = new Date(start);
      day.setDate(day.getDate() + i);
      var dateStr = day.toISOString().slice(0, 10);
      var isToday = dateStr === todayStr;
      
      html += '<div class="calendar-day drop-zone' + (isToday ? ' is-today' : '') + '" data-date="' + dateStr + '" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">';
      
      if (isToday) {
        html += '<div class="calendar-day-header">' + days[i] + ' <span class="today-indicator">' + day.getDate() + '</span></div>';
      } else {
        html += '<div class="calendar-day-header">' + days[i] + ' ' + day.getDate() + '</div>';
      }
      
      // v25.2: Horizontal event cards with color borders
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
        html += '<div class="cal-event-card" onclick="' + (source !== 'roweos' ? 'openExternalEventDetail(\'' + ev.id + '\')' : 'openCalendarItem(' + ev.id + ')') + '" draggable="' + (source === 'roweos' ? 'true' : 'false') + '"' + (source === 'roweos' ? ' ondragstart="handleDragStart(event,\'' + ev.id + '\')"' : '') + '>';
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
      
      html += '</div>';
    }
    html += '</div>';
    c.innerHTML = html;
  } else {
    // Month view
    var monthDate = new Date(today.getFullYear(), today.getMonth() + currentWeekOffset, 1);
    display.textContent = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    var firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    var lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    var startDay = new Date(firstDay);
    startDay.setDate(startDay.getDate() - firstDay.getDay());
    
    var html = '<div class="calendar-month">';
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    days.forEach(function(d) {
      html += '<div style="text-align:center;font-weight:600;padding:12px 8px;color:#888;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">' + d + '</div>';
    });
    
    var current = new Date(startDay);
    for (var i = 0; i < 42; i++) {
      var dateStr = current.toISOString().slice(0, 10);
      var isOther = current.getMonth() !== monthDate.getMonth();
      var isToday = dateStr === todayStr;
      
      html += '<div class="calendar-month-day drop-zone' + (isOther ? ' other-month' : '') + (isToday ? ' is-today' : '') + '" data-date="' + dateStr + '" onclick="openDayView(\'' + dateStr + '\')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">';
      html += '<div class="calendar-month-day-number">' + current.getDate() + '</div>';

      // v12.2.6: Cap visible items per day cell to prevent overflow
      var MAX_DAY_ITEMS = 3;
      var dayItemCount = 0;
      var dayTotalItems = 0;

      // Count total items for this day
      // v16.12: Use merged calendar (native + external)
      var dayEvents = getCalendarEventsForDate(dateStr);
      var dayTodos = todos.filter(function(t) { return t.date === dateStr; });
      var scheduledTasks = getScheduledTasks();
      var dayAutos = scheduledTasks.filter(function(a) { return a.scheduledDate && a.scheduledDate.slice(0, 10) === dateStr; });
      dayTotalItems = dayEvents.length + dayTodos.length + dayAutos.length;

      // v25.2: Events as horizontal cards (month view)
      dayEvents.forEach(function(item) {
        if (dayItemCount >= MAX_DAY_ITEMS) return;
        dayItemCount++;
        var source = item.source || 'roweos';
        var calId = item.calendarId || (source + '_' + (item.calendarName || 'default'));
        var color = getCalendarColor(calId, source);
        var timeStr = item.allDay ? 'All day' : (item.time || '');
        var sourceLabel = source === 'google' ? 'Google' : source === 'icloud' ? 'iCloud' : source === 'outlook' ? 'Outlook' : '';
        var clickHandler = source !== 'roweos' ? 'openExternalEventDetail(\\\'' + item.id + '\\\')' : 'openCalendarItem(' + item.id + ')';
        html += '<div class="cal-event-card" onclick="event.stopPropagation(); ' + clickHandler + '" style="padding:3px 6px;margin-top:3px;">';
        html += '<div class="cal-event-border" style="background:' + color + ';height:18px;"></div>';
        html += '<span class="cal-event-time" style="font-size:9px;min-width:0;">' + escapeHtml(timeStr) + '</span>';
        html += '<span class="cal-event-title" style="font-size:10px;">' + escapeHtml((item.title || 'Untitled').substring(0, 15)) + '</span>';
        if (sourceLabel) html += '<span class="cal-event-source" style="font-size:8px;">' + sourceLabel + '</span>';
        html += '</div>';
      });

      // Tasks
      dayTodos.forEach(function(task) {
        if (dayItemCount >= MAX_DAY_ITEMS) return;
        dayItemCount++;
        var taskClass = task.completed ? 'completed' : '';
        html += '<div class="calendar-item task-item ' + taskClass + '" onclick="event.stopPropagation(); toggleRhythmTask(' + task.id + ')" style="padding:4px 8px;font-size:11px;cursor:pointer;background:rgba(106,184,148,0.1);border:1px solid rgba(106,184,148,0.3);border-radius:4px;margin-top:4px;' + (task.completed ? 'opacity:0.5;' : '') + '">'; // v30.1: No one-sided border
        html += '<div style="font-weight:500;display:flex;align-items:center;gap:4px;' + (task.completed ? 'text-decoration:line-through;' : '') + '"><span style="color:#6ab894">' + (task.completed ? '\u2611' : '\u2610') + '</span>' + escapeHtml((task.text || '').substring(0, 15)) + '</div>';
        html += '</div>';
      });

      // Automations
      dayAutos.forEach(function(automation) {
        if (dayItemCount >= MAX_DAY_ITEMS) return;
        dayItemCount++;
        html += '<div class="calendar-item automation-item" onclick="event.stopPropagation(); openScheduledTaskDetails(' + automation.id + ')" style="padding:4px 8px;font-size:11px;cursor:pointer;background:rgba(168,152,120,0.1);border:1px solid rgba(168,152,120,0.3);border-radius:4px;margin-top:4px;">'; // v30.1: No one-sided border
        html += '<div style="font-weight:500;display:flex;align-items:center;gap:4px;"><span style="color:#a89878">\u26A1</span>' + escapeHtml((automation.name || '').substring(0, 15)) + '</div>';
        html += '</div>';
      });

      // v12.2.6: Show "+N more" if items exceed cap
      var remaining = dayTotalItems - dayItemCount;
      if (remaining > 0) {
        html += '<div onclick="event.stopPropagation(); openDayView(\'' + dateStr + '\')" style="padding:2px 8px;font-size:10px;color:var(--accent);cursor:pointer;margin-top:2px;font-weight:600;">+' + remaining + ' more</div>';
      }

      html += '</div>';
      current.setDate(current.getDate() + 1);
    }
    
    html += '</div>';
    c.innerHTML = html;
  }
}

// v13.0: Per-brand accent color - reads from brand.brandColor, falls back to default gold
function getBrandColor(brandName) {
  if (!brandName) return '#a89878';
  // Look up brand by name and return its custom color
  for (var i = 0; i < brands.length; i++) {
    if (brands[i] && brands[i].name === brandName) {
      return brands[i].brandColor || '#a89878';
    }
  }
  return '#a89878';
}

// v25.2: Expand +N overflow badge to show all events in a day cell
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
      html += '<div class="cal-event-card" onclick="' + (source !== 'roweos' ? 'openExternalEventDetail(\'' + ev.id + '\')' : 'openCalendarItem(' + ev.id + ')') + '">';
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

// ═══════════════════════════════════════════════════════════════
// v16.12: EXTERNAL CALENDAR INTEGRATION STATE
// ═══════════════════════════════════════════════════════════════

// Google Calendar
var _gcalTokenClient = null;
var _gcalAccessToken = null;
var _gcalConnected = false;
var _gcalEvents = [];
var _gcalSyncInProgress = false;
// v23.2: Hardcoded RoweOS Google Client ID — users just sign in with their Google account
var GCAL_CLIENT_ID = '145599655206-or0g4iasoasppsdpu6pjlia6gh6jbe50.apps.googleusercontent.com';
// v28.5: Narrowed scope — calendar.events is sufficient and less likely to trigger "Access blocked"
var GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';
var GCAL_API_BASE = 'https://www.googleapis.com/calendar/v3';

// iCloud Calendar
var _icloudConnected = false;
var _icloudEvents = [];
var _icloudSyncInProgress = false;
var _icloudCalendars = [];

// v22.33: Outlook Calendar
var _outlookCalendars = []; // list of Outlook calendar objects

// v22.44: Multi-calendar management
var _gcalCalendars = []; // list of Google calendar objects
var _calendarVisibility = {}; // { calendarId: true/false }
var _defaultCalendarId = localStorage.getItem('roweos_default_calendar') || '';

// Merged calendar (native + external)
var _mergedCalendarEvents = [];

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

// v16.12: ES5 polyfill helpers
function _padStart(str, len, ch) {
  str = String(str);
  ch = ch || ' ';
  while (str.length < len) { str = ch + str; }
  return str;
}

function _shallowCopy(target, source) {
  if (!source) return target;
  for (var k in source) {
    if (source.hasOwnProperty(k)) { target[k] = source[k]; }
  }
  return target;
}

// ═══════════════════════════════════════════════════════════════
// v16.12: GOOGLE CALENDAR INTEGRATION
// ═══════════════════════════════════════════════════════════════

function initGoogleCalendarAuth() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    if (localStorage.getItem('roweos_debug') === 'true') console.log('[GCal] GIS library not loaded yet');
    return;
  }
  if (!GCAL_CLIENT_ID) {
    if (localStorage.getItem('roweos_debug') === 'true') console.log('[GCal] No Client ID configured');
    return;
  }
  try {
    _gcalTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID,
      scope: GCAL_SCOPES,
      callback: handleGCalTokenResponse,
      // v28.5: Catch popup/consent errors (e.g. "Access blocked" from Google Workspace)
      error_callback: function(err) {
        console.warn('[GCal] OAuth error:', err);
        var errType = (err && err.type) || 'unknown';
        if (errType === 'popup_failed_to_open') {
          showToast('Could not open Google sign-in popup. Check your popup blocker settings.', 'error');
        } else if (errType === 'popup_closed') {
          // User closed — no toast needed
        } else {
          showToast('Google Calendar: Sign-in error (' + errType + '). If you see "Access blocked", try with a personal Gmail account.', 'error');
        }
      }
    });
    // Try silent re-auth if previously connected
    if (localStorage.getItem('roweos_gcal_connected') === 'true') {
      _gcalTokenClient.requestAccessToken({ prompt: '' });
    }
  } catch (e) {
    console.warn('[GCal] Init error:', e.message);
  }
}

function handleGCalTokenResponse(resp) {
  if (resp.error) {
    console.warn('[GCal] Token error:', resp.error, resp.error_description || '');
    if (resp.error === 'popup_closed_by_user') return;
    _gcalConnected = false;
    localStorage.removeItem('roweos_gcal_connected');
    updateCalendarIntegrationUI();
    // v28.5: Show helpful error messages for common OAuth failures
    if (resp.error === 'access_denied' || resp.error === 'org_internal') {
      showToast('Google Calendar access was denied. If you see "Access blocked", your Google Workspace admin may need to allow this app, or try with a personal Gmail account.', 'error');
    } else if (resp.error === 'invalid_client') {
      showToast('Google Calendar configuration error. Please contact support.', 'error');
    } else {
      showToast('Google Calendar sign-in failed: ' + (resp.error_description || resp.error), 'error');
    }
    return;
  }
  _gcalAccessToken = resp.access_token;
  _gcalConnected = true;
  localStorage.setItem('roweos_gcal_connected', 'true');
  updateCalendarIntegrationUI();
  // v22.44: Fetch calendar list first, then sync events
  fetchGoogleCalendarList(function() {
    syncGoogleCalendarEvents();
  });
  showToast('Google Calendar connected', 'success');
}

// v18.4: Calendar scope toggle — shared vs per-brand/profile
function toggleCalendarScope(isPerScope) {
  localStorage.setItem('roweos_calendar_scope', isPerScope ? 'per_scope' : 'shared');
  var desc = document.getElementById('calendarScopeDesc');
  if (desc) desc.textContent = isPerScope ? 'Per brand / life profile' : 'Shared across all brands';
  showToast('Calendar scope: ' + (isPerScope ? 'per brand/profile' : 'shared'), 'info');
  writeDB('profile/main', { calendarScope: isPerScope ? 'per_scope' : 'shared' }); // v25.1
}

function loadCalendarScopeToggle() {
  var toggle = document.getElementById('calendarScopeToggle');
  if (!toggle) return;
  var scope = localStorage.getItem('roweos_calendar_scope') || 'shared';
  toggle.checked = scope === 'per_scope';
  var desc = document.getElementById('calendarScopeDesc');
  if (desc) desc.textContent = scope === 'per_scope' ? 'Per brand / life profile' : 'Shared across all brands';
}

function getCalendarCredentialKey(baseKey) {
  var scope = localStorage.getItem('roweos_calendar_scope') || 'shared';
  if (scope === 'per_scope') return baseKey + getSocialKeyScope();
  return baseKey;
}

function connectGoogleCalendar() {
  // v23.2: Client ID is now hardcoded — no user input needed
  if (!_gcalTokenClient) {
    initGoogleCalendarAuth();
  }
  if (_gcalTokenClient) {
    try {
      _gcalTokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (e) {
      console.error('[GCal] requestAccessToken error:', e);
      showToast('Google Calendar sign-in failed. Try refreshing the page.', 'error');
    }
  } else {
    showToast('Google Sign-In library not loaded. Check your internet connection.', 'error');
  }
}

function disconnectGoogleCalendar() {
  if (_gcalAccessToken) {
    try { google.accounts.oauth2.revoke(_gcalAccessToken); } catch (e) { /* ignore */ }
  }
  _gcalAccessToken = null;
  _gcalConnected = false;
  _gcalEvents = [];
  _gcalCalendars = [];
  localStorage.removeItem('roweos_gcal_connected');
  localStorage.removeItem('roweos_gcal_last_sync');
  rebuildMergedCalendar();
  renderCalendar();
  if (typeof renderRhythmDayPanel === 'function') renderRhythmDayPanel();
  updateCalendarIntegrationUI();
  showToast('Google Calendar disconnected', 'success');
}

function syncGoogleCalendarEvents(startDate, endDate) {
  if (!_gcalAccessToken || _gcalSyncInProgress) return;
  // v22.44: Use multi-calendar sync if calendar list loaded
  if (_gcalCalendars.length > 0 && !startDate && !endDate) {
    syncGoogleMultiCalendar();
    return;
  }
  _gcalSyncInProgress = true;
  updateCalendarIntegrationUI();

  var now = new Date();
  var start = startDate || new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var end = endDate || new Date(now.getFullYear(), now.getMonth() + 2, 0);
  var timeMin = start.toISOString();
  var timeMax = end.toISOString();

  var url = GCAL_API_BASE + '/calendars/primary/events?timeMin=' + encodeURIComponent(timeMin) +
    '&timeMax=' + encodeURIComponent(timeMax) + '&singleEvents=true&orderBy=startTime&maxResults=500';

  fetch(url, {
    headers: { 'Authorization': 'Bearer ' + _gcalAccessToken }
  }).then(function(resp) {
    if (resp.status === 401) {
      // Token expired — try silent re-auth
      if (_gcalTokenClient) {
        _gcalTokenClient.requestAccessToken({ prompt: '' });
      }
      _gcalSyncInProgress = false;
      updateCalendarIntegrationUI();
      return null;
    }
    return resp.json();
  }).then(function(data) {
    if (!data) return;
    if (data.error) {
      console.warn('[GCal] API error:', data.error.message);
      _gcalSyncInProgress = false;
      updateCalendarIntegrationUI();
      return;
    }
    var items = data.items || [];
    _gcalEvents = items.map(function(ev) { return convertGoogleEventToRhythm(ev); });
    localStorage.setItem('roweos_gcal_last_sync', new Date().toISOString());
    _gcalSyncInProgress = false;
    rebuildMergedCalendar();
    renderCalendar();
    if (typeof renderRhythmDayPanel === 'function') renderRhythmDayPanel();
    updateCalendarIntegrationUI();
    if (localStorage.getItem('roweos_debug') === 'true') console.log('[GCal] Synced ' + _gcalEvents.length + ' events');
  }).catch(function(err) {
    console.warn('[GCal] Sync error:', err.message);
    _gcalSyncInProgress = false;
    updateCalendarIntegrationUI();
  });
}

function convertGoogleEventToRhythm(gEvent) {
  var startObj = gEvent.start || {};
  var dateStr = '';
  var timeStr = '';
  if (startObj.dateTime) {
    // Timed event
    var dt = new Date(startObj.dateTime);
    dateStr = dt.getFullYear() + '-' + _padStart(dt.getMonth() + 1, 2, '0') + '-' + _padStart(dt.getDate(), 2, '0');
    timeStr = _padStart(dt.getHours(), 2, '0') + ':' + _padStart(dt.getMinutes(), 2, '0');
  } else if (startObj.date) {
    // All-day event
    dateStr = startObj.date;
    timeStr = '';
  }
  return {
    id: 'gcal_' + (gEvent.id || Date.now()),
    title: gEvent.summary || '(No title)',
    date: dateStr,
    time: timeStr,
    color: '#4285f4',
    source: 'google',
    status: 'confirmed',
    brand: '',
    googleEventId: gEvent.id,
    googleHtmlLink: gEvent.htmlLink || '',
    calendarId: gEvent.organizer ? gEvent.organizer.email : '',
    location: gEvent.location || '',
    description: gEvent.description || ''
  };
}

function pushEventToGoogleCalendar(event) {
  if (!_gcalAccessToken) {
    showToast('Connect Google Calendar first', 'error');
    return;
  }
  var gEvent = {
    summary: event.title,
    start: {},
    end: {}
  };
  if (event.time) {
    var dtStart = new Date(event.date + 'T' + event.time + ':00');
    var dtEnd = new Date(dtStart.getTime() + 3600000); // +1hr
    gEvent.start.dateTime = dtStart.toISOString();
    gEvent.start.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    gEvent.end.dateTime = dtEnd.toISOString();
    gEvent.end.timeZone = gEvent.start.timeZone;
  } else {
    gEvent.start.date = event.date;
    var endDate = new Date(event.date);
    endDate.setDate(endDate.getDate() + 1);
    gEvent.end.date = endDate.toISOString().slice(0, 10);
  }

  // v22.44: Use default calendar if set, otherwise primary
  var targetCalId = 'primary';
  if (_defaultCalendarId && _defaultCalendarId.indexOf('gcal_') === 0) {
    targetCalId = _defaultCalendarId.replace('gcal_', '');
  }
  var url = GCAL_API_BASE + '/calendars/' + encodeURIComponent(targetCalId) + '/events';
  var method = 'POST';
  // If event already has a googleEventId, update instead
  if (event.googleEventId) {
    url = GCAL_API_BASE + '/calendars/' + encodeURIComponent(event.calendarId || targetCalId) + '/events/' + encodeURIComponent(event.googleEventId);
    method = 'PUT';
  }

  fetch(url, {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + _gcalAccessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(gEvent)
  }).then(function(resp) { return resp.json(); })
  .then(function(data) {
    if (data.error) {
      showToast('Google Calendar error: ' + data.error.message, 'error');
      return;
    }
    showToast('Event pushed to Google Calendar', 'success');
    // Re-sync to pick up the new event
    syncGoogleCalendarEvents();
  }).catch(function(err) {
    showToast('Failed to push to Google Calendar', 'error');
  });
}

function deleteGoogleCalendarEvent(eventId) {
  if (!_gcalAccessToken || !eventId) return;
  var url = GCAL_API_BASE + '/calendars/primary/events/' + encodeURIComponent(eventId);
  fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + _gcalAccessToken }
  }).then(function(resp) {
    if (resp.ok || resp.status === 204) {
      showToast('Deleted from Google Calendar', 'success');
      syncGoogleCalendarEvents();
    }
  }).catch(function(err) {
    console.warn('[GCal] Delete error:', err.message);
  });
}

// ═══════════════════════════════════════════════════════════════
// v25.2: Outlook Calendar Write-Back (Microsoft Graph API)
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// v25.2: iCloud Calendar Write-Back (CalDAV via serverless proxy)
// ═══════════════════════════════════════════════════════════════

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
  var eventUrl = calHome.replace(/\/$/, '') + '/' + uid + '.ics';
  showToast('Saving to iCloud...', 'info');
  return caldavProxyRequest({
    url: eventUrl,
    method: 'PUT',
    auth: { username: appleId, password: appPwd },
    xmlBody: icsData,
    contentType: 'text/calendar; charset=utf-8',
    depth: '0'
  }).then(function(data) {
    if (data.status >= 200 && data.status < 300) {
      showToast('Event saved to iCloud', 'success');
      syncICloudCalendarEvents();
    } else {
      showToast('iCloud save failed: CalDAV returned ' + data.status, 'error');
    }
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
  var eventUrl = calHome.replace(/\/$/, '') + '/' + eventUid + '.ics';
  showToast('Deleting from iCloud...', 'info');
  return caldavProxyRequest({
    url: eventUrl,
    method: 'DELETE',
    auth: { username: appleId, password: appPwd },
    depth: '0'
  }).then(function(data) {
    if (data.status >= 200 && data.status < 300) {
      showToast('Deleted from iCloud', 'success');
      syncICloudCalendarEvents();
    } else {
      showToast('iCloud delete failed', 'error');
    }
  }).catch(function(err) { showToast('iCloud delete failed', 'error'); });
}

// ═══════════════════════════════════════════════════════════════
// v16.12: ICLOUD CALENDAR INTEGRATION (CalDAV via proxy)
// ═══════════════════════════════════════════════════════════════

function caldavProxyRequest(params) {
  if (localStorage.getItem('roweos_debug') === 'true') console.log('[CalDAV] Request:', params.method, params.url);
  return fetch('/api/caldav-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  }).then(function(resp) { return resp.json(); }).then(function(data) {
    if (localStorage.getItem('roweos_debug') === 'true') console.log('[CalDAV] Response:', data.status, data.error || '', 'finalUrl:', data.finalUrl || '');
    return data;
  });
}

function connectICloudCalendar() {
  var appleId = (document.getElementById('icloudAppleIdInput') || {}).value || localStorage.getItem('roweos_icloud_apple_id') || '';
  var appPw = (document.getElementById('icloudAppPasswordInput') || {}).value || localStorage.getItem('roweos_icloud_app_password') || '';

  if (!appleId || !appPw) {
    showToast('Enter your Apple ID and app-specific password', 'error');
    return;
  }

  // Save credentials
  localStorage.setItem('roweos_icloud_apple_id', appleId);
  localStorage.setItem('roweos_icloud_app_password', appPw);

  showToast('Testing iCloud connection...', 'info');

  // Test with PROPFIND on calendar home
  fetchICloudCalendars(appleId, appPw).then(function(calendars) {
    if (calendars && calendars.length >= 0) {
      _icloudConnected = true;
      _icloudCalendars = calendars;
      localStorage.setItem('roweos_icloud_connected', 'true');
      // v17.3: Persist calendar list so it survives reload/Firebase sync
      try { localStorage.setItem('roweos_icloud_calendars', JSON.stringify(calendars)); } catch(e) {}
      updateCalendarIntegrationUI();
      syncICloudCalendarEvents();
      showToast('iCloud Calendar connected (' + calendars.length + ' calendars found)', 'success');
    }
  }).catch(function(err) {
    showToast('iCloud connection failed: ' + err.message, 'error');
  });
}

function disconnectICloudCalendar() {
  _icloudConnected = false;
  _icloudEvents = [];
  _icloudCalendars = [];
  localStorage.removeItem('roweos_icloud_connected');
  localStorage.removeItem('roweos_icloud_calendars');
  localStorage.removeItem('roweos_icloud_last_sync');
  localStorage.removeItem('roweos_icloud_apple_id');
  localStorage.removeItem('roweos_icloud_app_password');
  rebuildMergedCalendar();
  renderCalendar();
  if (typeof renderRhythmDayPanel === 'function') renderRhythmDayPanel();
  updateCalendarIntegrationUI();
  showToast('iCloud Calendar disconnected', 'success');
}

// v22.33: OUTLOOK CALENDAR INTEGRATION (Microsoft Graph API)
var _outlookCalConnected = localStorage.getItem('roweos_outlook_cal_connected') === 'true';
var _outlookCalEvents = [];

function connectOutlookCalendar() {
  var clientId = '41b2af7a-e6d9-45f3-a508-b59f055e7043';
  var redirectUri = window.location.origin + '/social-callback.html';
  var scope = 'User.Read Calendars.ReadWrite offline_access';
  var uid = (typeof firebaseUser !== 'undefined' && firebaseUser) ? firebaseUser.uid : '';
  var state = 'outlook_calendar_' + Date.now();
  if (uid) state += '~u:' + uid;
  localStorage.setItem('roweos_outlook_cal_oauth_state', state);
  var authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize' +
    '?client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(scope) +
    '&state=' + encodeURIComponent(state);
  window.open(authUrl, 'outlook_cal_auth', 'width=500,height=700');
}

function disconnectOutlookCalendar() {
  _outlookCalConnected = false;
  _outlookCalEvents = [];
  _outlookCalendars = [];
  localStorage.removeItem('roweos_outlook_cal_connected');
  localStorage.removeItem('roweos_outlook_cal_token');
  localStorage.removeItem('roweos_outlook_cal_refresh_token');
  localStorage.removeItem('roweos_outlook_cal_email');
  localStorage.removeItem('roweos_outlook_cal_last_sync');
  rebuildMergedCalendar();
  renderCalendar();
  if (typeof renderRhythmDayPanel === 'function') renderRhythmDayPanel();
  updateCalendarIntegrationUI();
  showToast('Outlook Calendar disconnected', 'success');
}

function syncOutlookCalendarEvents(startDate, endDate) {
  var token = localStorage.getItem('roweos_outlook_cal_token');
  if (!token) { showToast('Outlook Calendar not connected', 'error'); return; }
  // v22.44: Use multi-calendar sync if calendar list loaded
  if (_outlookCalendars.length > 0 && !startDate && !endDate) {
    syncOutlookMultiCalendar();
    return;
  }

  var now = new Date();
  var start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var end = endDate || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

  showToast('Syncing Outlook Calendar...', 'info');

  fetch('https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=' + encodeURIComponent(start) + '&endDateTime=' + encodeURIComponent(end) + '&$top=200&$orderby=start/dateTime', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function(resp) {
    if (resp.status === 401) {
      // Token expired — try refresh
      refreshOutlookCalToken(function(newToken) {
        if (newToken) syncOutlookCalendarEvents(startDate, endDate);
        else showToast('Outlook Calendar session expired. Reconnect in Settings.', 'error');
      });
      return null;
    }
    return resp.json();
  }).then(function(data) {
    if (!data || !data.value) return;
    _outlookCalEvents = data.value.map(function(ev) {
      var startDt = ev.start && ev.start.dateTime ? new Date(ev.start.dateTime + (ev.start.timeZone === 'UTC' ? 'Z' : '')) : new Date();
      var endDt = ev.end && ev.end.dateTime ? new Date(ev.end.dateTime + (ev.end.timeZone === 'UTC' ? 'Z' : '')) : new Date();
      return {
        id: 'outlook_' + ev.id.substring(0, 20),
        title: ev.subject || 'Untitled',
        date: startDt.toISOString().split('T')[0],
        startTime: startDt.toTimeString().substring(0, 5),
        endTime: endDt.toTimeString().substring(0, 5),
        location: ev.location && ev.location.displayName ? ev.location.displayName : '',
        description: ev.bodyPreview || '',
        source: 'outlook',
        color: '#0078d4',
        allDay: ev.isAllDay || false,
        outlookEventId: ev.id
      };
    });
    localStorage.setItem('roweos_outlook_cal_last_sync', new Date().toISOString());
    rebuildMergedCalendar();
    renderCalendar();
    if (typeof renderRhythmDayPanel === 'function') renderRhythmDayPanel();
    showToast('Outlook Calendar synced (' + _outlookCalEvents.length + ' events)', 'success');
  }).catch(function(err) {
    console.error('[Outlook Calendar] Sync error:', err);
    showToast('Outlook Calendar sync failed', 'error');
  });
}

function refreshOutlookCalToken(callback) {
  var refreshToken = localStorage.getItem('roweos_outlook_cal_refresh_token');
  if (!refreshToken) { callback(null); return; }
  fetch('/api/gmail-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'outlook_refresh', refreshToken: refreshToken, scope: 'Calendars.ReadWrite' })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.access_token) {
      localStorage.setItem('roweos_outlook_cal_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('roweos_outlook_cal_refresh_token', data.refresh_token);
      callback(data.access_token);
    } else {
      callback(null);
    }
  }).catch(function() { callback(null); });
}

// v25.2: Old v22.39 duplicate Outlook functions removed — v25.2 versions at ~86448 are authoritative

// v22.39: Unified push — sends event to all connected external calendars
function pushEventToExternalCalendars(event) {
  var pushed = [];
  if (_gcalConnected && _gcalAccessToken) {
    pushEventToGoogleCalendar(event);
    pushed.push('Google');
  }
  if (_icloudConnected && _icloudCalendars.length > 0) {
    pushEventToICloudCalendar(event);
    pushed.push('iCloud');
  }
  if (_outlookCalConnected) {
    pushEventToOutlookCalendar(event);
    pushed.push('Outlook');
  }
  return pushed;
}

// v16.13: Full CalDAV discovery — principal → calendar-home-set → calendars
function discoverICloudCalendarHome(appleId, appPw) {
  // Step 1: PROPFIND root to get current-user-principal
  var rootUrl = 'https://caldav.icloud.com/';
  var principalXml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<d:propfind xmlns:d="DAV:">' +
    '<d:prop><d:current-user-principal/></d:prop>' +
    '</d:propfind>';

  return caldavProxyRequest({
    url: rootUrl,
    auth: { username: appleId, password: appPw },
    method: 'PROPFIND',
    depth: 0,
    xmlBody: principalXml
  }).then(function(data) {
    if (data.error) throw new Error(data.error);
    if (data.status === 401) throw new Error('Invalid credentials. Make sure you use an app-specific password.');
    // Parse principal href from response
    var principalHref = '';
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(data.body || '', 'application/xml');
      var principalEls = doc.getElementsByTagNameNS('DAV:', 'current-user-principal');
      if (principalEls.length) {
        var hrefEls = principalEls[0].getElementsByTagNameNS('DAV:', 'href');
        if (hrefEls.length) principalHref = hrefEls[0].textContent;
      }
    } catch (e) { /* fall through */ }

    if (!principalHref) {
      // Fallback: try direct calendar home with email
      if (localStorage.getItem('roweos_debug') === 'true') console.log('[iCloud] No principal found, using email fallback');
      return 'https://caldav.icloud.com/' + encodeURIComponent(appleId) + '/calendars/';
    }

    // Make principal URL absolute
    var principalUrl = principalHref;
    if (principalHref.indexOf('http') !== 0) {
      // v16.13: Use finalUrl from proxy (after redirect) to detect partition server
      var origin = 'https://caldav.icloud.com';
      if (data.finalUrl) {
        var originMatch = data.finalUrl.match(/^https:\/\/[^\/]+/);
        if (originMatch) origin = originMatch[0];
      }
      principalUrl = origin + principalHref;
    }

    if (localStorage.getItem('roweos_debug') === 'true') console.log('[iCloud] Principal URL:', principalUrl);

    // Step 2: PROPFIND principal to get calendar-home-set
    var homeSetXml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
      '<d:prop><c:calendar-home-set/></d:prop>' +
      '</d:propfind>';

    return caldavProxyRequest({
      url: principalUrl,
      auth: { username: appleId, password: appPw },
      method: 'PROPFIND',
      depth: 0,
      xmlBody: homeSetXml
    }).then(function(data2) {
      if (data2.error) throw new Error(data2.error);
      var calHome = '';
      try {
        var parser2 = new DOMParser();
        var doc2 = parser2.parseFromString(data2.body || '', 'application/xml');
        var homeSetEls = doc2.getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'calendar-home-set');
        if (homeSetEls.length) {
          var hrefEls2 = homeSetEls[0].getElementsByTagNameNS('DAV:', 'href');
          if (hrefEls2.length) calHome = hrefEls2[0].textContent;
        }
      } catch (e) { /* fall through */ }

      if (!calHome) {
        if (localStorage.getItem('roweos_debug') === 'true') console.log('[iCloud] No calendar-home-set found, using principal path fallback');
        // Derive from principal URL: replace /principal/ with /calendars/
        return principalUrl.replace(/\/principal\/?$/, '/calendars/');
      }

      // Make absolute
      if (calHome.indexOf('http') !== 0) {
        var principalOrigin = principalUrl.match(/^https?:\/\/[^\/]+/);
        calHome = (principalOrigin ? principalOrigin[0] : 'https://caldav.icloud.com') + calHome;
      }

      if (localStorage.getItem('roweos_debug') === 'true') console.log('[iCloud] Calendar home:', calHome);
      return calHome;
    });
  });
}

function fetchICloudCalendars(appleId, appPw) {
  return discoverICloudCalendarHome(appleId, appPw).then(function(calHomeUrl) {
    // v16.13: Cache discovered calendar home for event sync
    localStorage.setItem('roweos_icloud_cal_home', calHomeUrl);

    // Step 3: PROPFIND calendar home with Depth:1 to list calendars
    var xmlBody = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
      '<d:prop><d:displayname/><d:resourcetype/><cs:getctag/></d:prop>' +
      '</d:propfind>';

    return caldavProxyRequest({
      url: calHomeUrl,
      auth: { username: appleId, password: appPw },
      method: 'PROPFIND',
      depth: 1,
      xmlBody: xmlBody
    }).then(function(data) {
      if (data.error) throw new Error(data.error);
      if (data.status === 401) throw new Error('Invalid credentials. Make sure you use an app-specific password.');
      if (data.status === 404) throw new Error('Calendar home not found at ' + calHomeUrl);
      if (localStorage.getItem('roweos_debug') === 'true') console.log('[iCloud] PROPFIND calendars response status:', data.status, 'body length:', (data.body || '').length);
      return parseCalDAVMultistatus(data.body || '', calHomeUrl);
    });
  });
}

function syncICloudCalendarEvents() {
  if (_icloudSyncInProgress) return;
  var appleId = localStorage.getItem('roweos_icloud_apple_id') || '';
  var appPw = localStorage.getItem('roweos_icloud_app_password') || '';
  if (!appleId || !appPw) return;

  _icloudSyncInProgress = true;
  updateCalendarIntegrationUI();

  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  var startStr = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  var endStr = end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // If we have discovered calendars, fetch events from each
  var calUrls = _icloudCalendars.map(function(c) { return c.href; });
  if (calUrls.length === 0) {
    // v16.13: Fallback to discovered calendar home, then email-based guess
    var cachedHome = localStorage.getItem('roweos_icloud_cal_home');
    calUrls = [cachedHome || ('https://caldav.icloud.com/' + encodeURIComponent(appleId) + '/calendars/')];
  }

  var allEvents = [];
  var pending = calUrls.length;

  calUrls.forEach(function(calUrl) {
    var xmlBody = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
      '<d:prop><d:getetag/><c:calendar-data/></d:prop>' +
      '<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">' +
      '<c:time-range start="' + startStr + '" end="' + endStr + '"/>' +
      '</c:comp-filter></c:comp-filter></c:filter>' +
      '</c:calendar-query>';

    caldavProxyRequest({
      url: calUrl,
      auth: { username: appleId, password: appPw },
      method: 'REPORT',
      depth: 1,
      xmlBody: xmlBody,
      contentType: 'application/xml; charset=utf-8'
    }).then(function(data) {
      if (data.body && data.status < 400) {
        var events = parseCalDAVEvents(data.body, calUrl);
        allEvents = allEvents.concat(events);
      }
      pending--;
      if (pending <= 0) {
        _icloudEvents = allEvents;
        localStorage.setItem('roweos_icloud_last_sync', new Date().toISOString());
        _icloudSyncInProgress = false;
        rebuildMergedCalendar();
        renderCalendar();
        if (typeof renderRhythmDayPanel === 'function') renderRhythmDayPanel();
        updateCalendarIntegrationUI();
        if (localStorage.getItem('roweos_debug') === 'true') console.log('[iCloud] Synced ' + _icloudEvents.length + ' events');
      }
    }).catch(function(err) {
      console.warn('[iCloud] Fetch error for ' + calUrl + ':', err.message);
      pending--;
      if (pending <= 0) {
        _icloudEvents = allEvents;
        _icloudSyncInProgress = false;
        rebuildMergedCalendar();
        updateCalendarIntegrationUI();
      }
    });
  });
}

function parseCalDAVMultistatus(xml, baseUrl) {
  var calendars = [];
  try {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xml, 'application/xml');
    var responses = doc.getElementsByTagNameNS('DAV:', 'response');
    for (var i = 0; i < responses.length; i++) {
      var hrefEls = responses[i].getElementsByTagNameNS('DAV:', 'href');
      var rtEls = responses[i].getElementsByTagNameNS('DAV:', 'resourcetype');
      var nameEls = responses[i].getElementsByTagNameNS('DAV:', 'displayname');
      var href = hrefEls.length ? hrefEls[0].textContent : '';
      var isCalendar = false;
      if (rtEls.length) {
        var calNodes = rtEls[0].getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'calendar');
        isCalendar = calNodes.length > 0;
      }
      if (isCalendar && href) {
        var fullHref = href;
        // Make absolute if relative
        if (href.indexOf('http') !== 0) {
          var urlObj = new URL(baseUrl);
          fullHref = urlObj.origin + href;
        }
        calendars.push({
          href: fullHref,
          displayName: nameEls.length ? nameEls[0].textContent : 'Calendar'
        });
      }
    }
  } catch (e) {
    console.warn('[iCloud] XML parse error:', e.message);
  }
  return calendars;
}

function parseCalDAVEvents(xml, calHref) {
  var events = [];
  try {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xml, 'application/xml');
    var calDataEls = doc.getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'calendar-data');
    for (var i = 0; i < calDataEls.length; i++) {
      var icsText = calDataEls[i].textContent;
      if (!icsText) continue;
      // Use ical.js if available
      if (typeof ICAL !== 'undefined') {
        try {
          var jcalData = ICAL.parse(icsText);
          var comp = new ICAL.Component(jcalData);
          var vevents = comp.getAllSubcomponents('vevent');
          for (var j = 0; j < vevents.length; j++) {
            var vevent = new ICAL.Event(vevents[j]);
            var dtstart = vevent.startDate;
            var dateStr = '';
            var timeStr = '';
            if (dtstart) {
              dateStr = dtstart.year + '-' + _padStart(dtstart.month, 2, '0') + '-' + _padStart(dtstart.day, 2, '0');
              if (!dtstart.isDate) {
                timeStr = _padStart(dtstart.hour, 2, '0') + ':' + _padStart(dtstart.minute, 2, '0');
              }
            }
            events.push({
              id: 'icloud_' + (vevent.uid || Date.now() + '_' + j),
              title: vevent.summary || '(No title)',
              date: dateStr,
              time: timeStr,
              color: '#007aff',
              source: 'icloud',
              status: 'confirmed',
              brand: '',
              icloudUid: vevent.uid || '',
              icloudHref: calHref
            });
          }
        } catch (parseErr) {
          console.warn('[iCloud] ICS parse error:', parseErr.message);
        }
      } else {
        // Fallback: basic regex parsing
        var summaryMatch = icsText.match(/SUMMARY:(.*)/);
        var dtstartMatch = icsText.match(/DTSTART[^:]*:(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
        var uidMatch = icsText.match(/UID:(.*)/);
        if (dtstartMatch) {
          events.push({
            id: 'icloud_' + (uidMatch ? uidMatch[1].trim() : Date.now()),
            title: summaryMatch ? summaryMatch[1].trim() : '(No title)',
            date: dtstartMatch[1] + '-' + dtstartMatch[2] + '-' + dtstartMatch[3],
            time: dtstartMatch[4] ? (dtstartMatch[4] + ':' + dtstartMatch[5]) : '',
            color: '#007aff',
            source: 'icloud',
            status: 'confirmed',
            brand: '',
            icloudUid: uidMatch ? uidMatch[1].trim() : '',
            icloudHref: calHref
          });
        }
      }
    }
  } catch (e) {
    console.warn('[iCloud] Event parse error:', e.message);
  }
  return events;
}

// v25.2: Old duplicate iCloud push function removed — v25.2 version at ~86552 is authoritative

// ═══════════════════════════════════════════════════════════════
// v16.12: UNIFIED MERGE LAYER
// ═══════════════════════════════════════════════════════════════

function rebuildMergedCalendar() {
  var merged = [];

  // 1. Copy native events with source marker (respect visibility)
  if (isCalendarVisible('native')) {
    calendar.forEach(function(ev) {
      var copy = _shallowCopy({}, ev);
      if (!copy.source) copy.source = 'native';
      merged.push(copy);
    });
  }

  // 2. Append Google Calendar events (skip if native has matching googleEventId, respect visibility)
  _gcalEvents.forEach(function(gev) {
    var calKey = gev.calendarId ? ('gcal_' + gev.calendarId) : 'gcal_primary';
    if (!isCalendarVisible(calKey)) return;
    var isDupe = false;
    for (var i = 0; i < calendar.length; i++) {
      if (calendar[i].googleEventId && calendar[i].googleEventId === gev.googleEventId) {
        isDupe = true;
        break;
      }
    }
    if (!isDupe) merged.push(gev);
  });

  // 3. Append iCloud events (skip if native has matching icloudUid, respect visibility)
  _icloudEvents.forEach(function(iev) {
    var calKey = 'icloud_' + (iev.icloudHref || 'default');
    if (!isCalendarVisible(calKey)) return;
    var isDupe = false;
    for (var i = 0; i < calendar.length; i++) {
      if (calendar[i].icloudUid && calendar[i].icloudUid === iev.icloudUid) {
        isDupe = true;
        break;
      }
    }
    if (!isDupe) merged.push(iev);
  });

  // 4. v22.33: Append Outlook Calendar events (respect visibility)
  if (typeof _outlookCalEvents !== 'undefined') {
    _outlookCalEvents.forEach(function(oev) {
      var calKey = oev.calendarId ? ('outlook_' + oev.calendarId) : 'outlook_default';
      if (!isCalendarVisible(calKey)) return;
      merged.push(oev);
    });
  }

  _mergedCalendarEvents = merged;

  // Cache external events for offline use
  try {
    var extEvents = _gcalEvents.concat(_icloudEvents).concat(typeof _outlookCalEvents !== 'undefined' ? _outlookCalEvents : []);
    if (extEvents.length > 0) {
      localStorage.setItem('roweos_external_events_cache', JSON.stringify(extEvents));
    }
  } catch (e) { /* quota */ }
}

function getCalendarEventsForDate(dateStr) {
  // v22.39: Sort by time — all-day first, then chronological
  return _mergedCalendarEvents.filter(function(ev) { return ev.date === dateStr; }).sort(function(a, b) {
    var aTime = a.time || '';
    var bTime = b.time || '';
    if (!aTime && bTime) return -1;
    if (aTime && !bTime) return 1;
    return aTime.localeCompare(bTime);
  });
}

function loadCachedExternalEvents() {
  try {
    var cached = localStorage.getItem('roweos_external_events_cache');
    if (cached) {
      var events = JSON.parse(cached);
      events.forEach(function(ev) {
        if (ev.source === 'google') _gcalEvents.push(ev);
        else if (ev.source === 'icloud') _icloudEvents.push(ev);
        else if (ev.source === 'outlook') _outlookCalEvents.push(ev);
      });
    }
  } catch (e) { /* ignore */ }
  // Restore connected states
  _gcalConnected = localStorage.getItem('roweos_gcal_connected') === 'true';
  _icloudConnected = localStorage.getItem('roweos_icloud_connected') === 'true';
  // v17.3: Restore iCloud calendar list from localStorage
  try {
    var cachedCals = localStorage.getItem('roweos_icloud_calendars');
    if (cachedCals) _icloudCalendars = JSON.parse(cachedCals);
  } catch(e) {}
}

function syncAllExternalCalendars() {
  if (_gcalConnected) syncGoogleCalendarEvents();
  if (_icloudConnected) syncICloudCalendarEvents();
  if (_outlookCalConnected) syncOutlookCalendarEvents();
  if (!_gcalConnected && !_icloudConnected && !_outlookCalConnected) {
    showToast('No external calendars connected', 'info');
  }
}

// ═══════════════════════════════════════════════════════════════
// v22.44: MULTI-CALENDAR MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// --- Calendar list fetching ---

function fetchGoogleCalendarList(callback) {
  if (!_gcalAccessToken) return;
  fetch(GCAL_API_BASE + '/users/me/calendarList', {
    headers: { 'Authorization': 'Bearer ' + _gcalAccessToken }
  }).then(function(resp) { return resp.json(); }).then(function(data) {
    if (data.error) { console.warn('[GCal] Calendar list error:', data.error.message); return; }
    _gcalCalendars = (data.items || []).map(function(cal) {
      return {
        id: cal.id,
        name: cal.summary || cal.id,
        color: cal.backgroundColor || '#4285f4',
        primary: cal.primary || false,
        accessRole: cal.accessRole || 'reader',
        source: 'google'
      };
    });
    // Init visibility for new calendars (default: visible)
    _gcalCalendars.forEach(function(cal) {
      var key = 'gcal_' + cal.id;
      if (typeof _calendarVisibility[key] === 'undefined') _calendarVisibility[key] = true;
    });
    saveCalendarVisibility();
    if (callback) callback(_gcalCalendars);
    renderCalendarListUI();
  }).catch(function(err) { console.warn('[GCal] Calendar list fetch error:', err.message); });
}

function fetchOutlookCalendarList(callback) {
  var token = localStorage.getItem('roweos_outlook_cal_token');
  if (!token) return;
  fetch('https://graph.microsoft.com/v1.0/me/calendars', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function(resp) {
    if (resp.status === 401) {
      refreshOutlookCalToken(function(newToken) {
        if (newToken) fetchOutlookCalendarList(callback);
      });
      return null;
    }
    return resp.json();
  }).then(function(data) {
    if (!data || !data.value) return;
    _outlookCalendars = data.value.map(function(cal) {
      return {
        id: cal.id,
        name: cal.name || 'Calendar',
        color: cal.hexColor || '#0078d4',
        isDefault: cal.isDefaultCalendar || false,
        canEdit: cal.canEdit !== false,
        source: 'outlook'
      };
    });
    _outlookCalendars.forEach(function(cal) {
      var key = 'outlook_' + cal.id;
      if (typeof _calendarVisibility[key] === 'undefined') _calendarVisibility[key] = true;
    });
    saveCalendarVisibility();
    if (callback) callback(_outlookCalendars);
    renderCalendarListUI();
  }).catch(function(err) { console.warn('[Outlook] Calendar list fetch error:', err.message); });
}

// --- Visibility & Default management ---

function loadCalendarVisibility() {
  try {
    var saved = localStorage.getItem('roweos_calendar_visibility');
    if (saved) _calendarVisibility = JSON.parse(saved);
  } catch(e) { _calendarVisibility = {}; }
  // Also restore iCloud calendars visibility
  _icloudCalendars.forEach(function(cal) {
    var key = 'icloud_' + (cal.href || cal.displayName);
    if (typeof _calendarVisibility[key] === 'undefined') _calendarVisibility[key] = true;
  });
}

function saveCalendarVisibility() {
  try { localStorage.setItem('roweos_calendar_visibility', JSON.stringify(_calendarVisibility)); } catch(e) {}
  writeDB('profile/main', { calendarVisibility: _calendarVisibility }); // v25.1
}

function toggleCalendarVisibility(calKey) {
  _calendarVisibility[calKey] = !_calendarVisibility[calKey];
  saveCalendarVisibility();
  rebuildMergedCalendar();
  renderCalendar();
  if (typeof renderRhythmDayPanel === 'function') renderRhythmDayPanel();
  renderCalendarListUI();
}

function setDefaultCalendar(calId) {
  _defaultCalendarId = calId;
  localStorage.setItem('roweos_default_calendar', calId);
  writeDB('profile/main', { defaultCalendar: calId }); // v25.1
  renderCalendarListUI();
  showToast('Default calendar updated', 'success');
}

function isCalendarVisible(calKey) {
  return _calendarVisibility[calKey] !== false;
}

// --- Calendar list UI rendering (in Settings) ---

function renderCalendarListUI() {
  var container = document.getElementById('calendarListContainer');
  if (!container) return;
  var html = '';
  var chevronSvg = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>';

  // v24.24: Helper to build a calendar item row
  function calItem(key, color, vis, name, isDef, badge) {
    return '<div class="cal-list-item">' +
      '<div class="cal-list-item-left" onclick="toggleCalendarVisibility(\'' + escapeHtml(key) + '\')">' +
      '<span class="cal-list-swatch" style="background:' + escapeHtml(color) + ';opacity:' + (vis ? '1' : '0.3') + ';"></span>' +
      '<svg class="cal-list-check" viewBox="0 0 20 20" width="16" height="16" style="color:' + (vis ? 'var(--accent)' : 'var(--text-muted)') + ';">' +
      (vis ? '<rect x="2" y="2" width="16" height="16" rx="3" fill="currentColor" stroke="none"/><path d="M6 10l3 3 5-6" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' :
      '<rect x="2" y="2" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>') +
      '</svg>' +
      '<span class="cal-list-name" style="opacity:' + (vis ? '1' : '0.5') + ';">' + escapeHtml(name) + '</span>' +
      (badge ? '<span class="cal-list-badge">' + badge + '</span>' : '') +
      '</div>' +
      '<button class="cal-list-default-btn' + (isDef ? ' active' : '') + '" onclick="setDefaultCalendar(\'' + escapeHtml(key) + '\')" title="Set as default">' +
      '<svg viewBox="0 0 24 24" width="14" height="14"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="' + (isDef ? 'var(--accent)' : 'none') + '" stroke="' + (isDef ? 'var(--accent)' : 'var(--text-muted)') + '" stroke-width="2"/></svg>' +
      '</button></div>';
  }

  // v24.24: Helper for collapsible group card
  function groupCard(id, title, color, count, itemsHtml) {
    return '<div class="cal-list-group" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:8px;overflow:hidden;">' +
      '<div class="cal-list-group-title" style="color:' + color + ';display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;margin:0;" onclick="var b=document.getElementById(\'' + id + '\');var o=b.style.display!==\'none\';b.style.display=o?\'none\':\'block\';this.querySelector(\'svg\').style.transform=o?\'rotate(-90deg)\':\'\';">' +
      '<span style="display:flex;align-items:center;gap:6px;">' + title + '<span style="font-size:10px;color:var(--text-muted);font-weight:400;text-transform:none;letter-spacing:0;">' + count + '</span></span>' +
      chevronSvg +
      '</div>' +
      '<div id="' + id + '" style="padding:0 8px 8px;">' + itemsHtml + '</div>' +
      '</div>';
  }

  // Google Calendars
  if (_gcalConnected && _gcalCalendars.length > 0) {
    var gcalItems = '';
    _gcalCalendars.forEach(function(cal) {
      var key = 'gcal_' + cal.id;
      gcalItems += calItem(key, cal.color, isCalendarVisible(key), cal.name, _defaultCalendarId === key, cal.primary ? 'Primary' : '');
    });
    html += groupCard('calGroupGcal', 'Google', '#4285f4', _gcalCalendars.length, gcalItems);
  }

  // iCloud Calendars
  if (_icloudConnected && _icloudCalendars.length > 0) {
    var icloudItems = '';
    _icloudCalendars.forEach(function(cal) {
      var key = 'icloud_' + (cal.href || cal.displayName);
      icloudItems += calItem(key, '#007aff', isCalendarVisible(key), cal.displayName, _defaultCalendarId === key, '');
    });
    html += groupCard('calGroupIcloud', 'iCloud', '#007aff', _icloudCalendars.length, icloudItems);
  }

  // Outlook Calendars
  if (_outlookCalConnected && _outlookCalendars.length > 0) {
    var outlookItems = '';
    _outlookCalendars.forEach(function(cal) {
      var key = 'outlook_' + cal.id;
      outlookItems += calItem(key, cal.color, isCalendarVisible(key), cal.name, _defaultCalendarId === key, cal.isDefault ? 'Default' : '');
    });
    html += groupCard('calGroupOutlook', 'Outlook', '#0078d4', _outlookCalendars.length, outlookItems);
  }

  // Native calendar
  var nativeKey = 'native';
  var nativeVis = isCalendarVisible(nativeKey);
  var nativeDef = _defaultCalendarId === nativeKey || !_defaultCalendarId;
  var nativeItems = calItem('native', 'var(--accent)', nativeVis, 'Local Events', nativeDef, '');
  html += groupCard('calGroupNative', 'RoweOS', 'var(--accent)', '1', nativeItems);

  container.innerHTML = html;
}

// --- Multi-calendar sync helpers ---

function syncGoogleMultiCalendar() {
  if (!_gcalAccessToken || _gcalSyncInProgress) return;
  var visibleCals = _gcalCalendars.filter(function(cal) {
    return isCalendarVisible('gcal_' + cal.id);
  });
  if (visibleCals.length === 0) {
    _gcalEvents = [];
    rebuildMergedCalendar();
    return;
  }
  _gcalSyncInProgress = true;
  updateCalendarIntegrationUI();

  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  var timeMin = start.toISOString();
  var timeMax = end.toISOString();

  var allEvents = [];
  var pending = visibleCals.length;

  visibleCals.forEach(function(cal) {
    var url = GCAL_API_BASE + '/calendars/' + encodeURIComponent(cal.id) + '/events?timeMin=' + encodeURIComponent(timeMin) +
      '&timeMax=' + encodeURIComponent(timeMax) + '&singleEvents=true&orderBy=startTime&maxResults=500';
    fetch(url, {
      headers: { 'Authorization': 'Bearer ' + _gcalAccessToken }
    }).then(function(resp) {
      if (resp.status === 401 && _gcalTokenClient) {
        _gcalTokenClient.requestAccessToken({ prompt: '' });
        return null;
      }
      return resp.json();
    }).then(function(data) {
      if (data && data.items) {
        data.items.forEach(function(ev) {
          var converted = convertGoogleEventToRhythm(ev);
          converted.calendarId = cal.id;
          converted.calendarName = cal.name;
          converted.color = cal.color || '#4285f4';
          allEvents.push(converted);
        });
      }
      pending--;
      if (pending <= 0) {
        _gcalEvents = allEvents;
        localStorage.setItem('roweos_gcal_last_sync', new Date().toISOString());
        _gcalSyncInProgress = false;
        rebuildMergedCalendar();
        renderCalendar();
        if (typeof renderRhythmDayPanel === 'function') renderRhythmDayPanel();
        updateCalendarIntegrationUI();
        if (localStorage.getItem('roweos_debug') === 'true') console.log('[GCal] Multi-cal synced ' + allEvents.length + ' events from ' + visibleCals.length + ' calendars');
      }
    }).catch(function(err) {
      console.warn('[GCal] Sync error for ' + cal.name + ':', err.message);
      pending--;
      if (pending <= 0) {
        _gcalEvents = allEvents;
        _gcalSyncInProgress = false;
        rebuildMergedCalendar();
        updateCalendarIntegrationUI();
      }
    });
  });
}

function syncOutlookMultiCalendar() {
  var token = localStorage.getItem('roweos_outlook_cal_token');
  if (!token) return;
  var visibleCals = _outlookCalendars.filter(function(cal) {
    return isCalendarVisible('outlook_' + cal.id);
  });
  if (visibleCals.length === 0) {
    _outlookCalEvents = [];
    rebuildMergedCalendar();
    return;
  }

  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

  var allEvents = [];
  var pending = visibleCals.length;

  visibleCals.forEach(function(cal) {
    var url = 'https://graph.microsoft.com/v1.0/me/calendars/' + encodeURIComponent(cal.id) + '/calendarView?startDateTime=' + encodeURIComponent(start) + '&endDateTime=' + encodeURIComponent(end) + '&$top=200&$orderby=start/dateTime';
    fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function(resp) {
      if (resp.status === 401) {
        refreshOutlookCalToken(function(newToken) {
          if (newToken) syncOutlookMultiCalendar();
        });
        return null;
      }
      return resp.json();
    }).then(function(data) {
      if (data && data.value) {
        data.value.forEach(function(ev) {
          var startDt = ev.start && ev.start.dateTime ? new Date(ev.start.dateTime + (ev.start.timeZone === 'UTC' ? 'Z' : '')) : new Date();
          var endDt = ev.end && ev.end.dateTime ? new Date(ev.end.dateTime + (ev.end.timeZone === 'UTC' ? 'Z' : '')) : new Date();
          allEvents.push({
            id: 'outlook_' + ev.id.substring(0, 20),
            title: ev.subject || 'Untitled',
            date: startDt.toISOString().split('T')[0],
            startTime: startDt.toTimeString().substring(0, 5),
            endTime: endDt.toTimeString().substring(0, 5),
            location: ev.location && ev.location.displayName ? ev.location.displayName : '',
            description: ev.bodyPreview || '',
            source: 'outlook',
            color: cal.color || '#0078d4',
            allDay: ev.isAllDay || false,
            calendarId: cal.id,
            calendarName: cal.name,
            outlookEventId: ev.id
          });
        });
      }
      pending--;
      if (pending <= 0) {
        _outlookCalEvents = allEvents;
        localStorage.setItem('roweos_outlook_cal_last_sync', new Date().toISOString());
        rebuildMergedCalendar();
        renderCalendar();
        if (typeof renderRhythmDayPanel === 'function') renderRhythmDayPanel();
        showToast('Outlook Calendar synced (' + allEvents.length + ' events)', 'success');
      }
    }).catch(function(err) {
      console.warn('[Outlook] Sync error for ' + cal.name + ':', err.message);
      pending--;
      if (pending <= 0) {
        _outlookCalEvents = allEvents;
        rebuildMergedCalendar();
      }
    });
  });
}

// --- Event editing for external calendars ---

function updateGoogleCalendarEvent(event, updates) {
  if (!_gcalAccessToken || !event.googleEventId) return;
  var calId = event.calendarId || 'primary';
  var url = GCAL_API_BASE + '/calendars/' + encodeURIComponent(calId) + '/events/' + encodeURIComponent(event.googleEventId);

  // Fetch existing event first to patch
  fetch(url, {
    headers: { 'Authorization': 'Bearer ' + _gcalAccessToken }
  }).then(function(resp) { return resp.json(); }).then(function(gEvent) {
    if (gEvent.error) { showToast('Error: ' + gEvent.error.message, 'error'); return; }
    if (updates.title) gEvent.summary = updates.title;
    if (updates.date || updates.time) {
      var newDate = updates.date || event.date;
      var newTime = updates.time || event.time;
      if (newTime) {
        gEvent.start = { dateTime: newDate + 'T' + newTime + ':00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        var endDt = new Date(newDate + 'T' + newTime + ':00');
        endDt.setHours(endDt.getHours() + 1);
        gEvent.end = { dateTime: endDt.toISOString(), timeZone: gEvent.start.timeZone };
      } else {
        gEvent.start = { date: newDate };
        var nextDay = new Date(newDate);
        nextDay.setDate(nextDay.getDate() + 1);
        gEvent.end = { date: nextDay.toISOString().slice(0, 10) };
      }
    }
    if (updates.description !== undefined) gEvent.description = updates.description;
    if (updates.location !== undefined) gEvent.location = updates.location;

    return fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + _gcalAccessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(gEvent)
    });
  }).then(function(resp) {
    if (resp && resp.ok) {
      showToast('Google Calendar event updated', 'success');
      if (_gcalCalendars.length > 0) syncGoogleMultiCalendar();
      else syncGoogleCalendarEvents();
    }
  }).catch(function(err) { showToast('Failed to update Google event', 'error'); });
}

function updateOutlookCalendarEvent(event, updates) {
  var token = localStorage.getItem('roweos_outlook_cal_token');
  var eventId = event.outlookEventId || event.id.replace('outlook_', '');
  if (!token || !eventId) return;

  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
  var patch = {};
  if (updates.title) patch.subject = updates.title;
  if (updates.date || updates.time) {
    var newDate = updates.date || event.date;
    var newTime = updates.time || event.startTime || event.time;
    if (newTime) {
      patch.start = { dateTime: newDate + 'T' + newTime + ':00', timeZone: tz };
      var endDt = new Date(newDate + 'T' + newTime + ':00');
      endDt.setHours(endDt.getHours() + 1);
      patch.end = { dateTime: endDt.toISOString().slice(0, 19), timeZone: tz };
    }
  }
  if (updates.description !== undefined) patch.body = { contentType: 'Text', content: updates.description };
  if (updates.location !== undefined) patch.location = { displayName: updates.location };

  function doPatch(accessToken) {
    fetch('https://graph.microsoft.com/v1.0/me/events/' + encodeURIComponent(eventId), {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).then(function(resp) { return resp.json(); }).then(function(data) {
      if (data.error) { showToast('Outlook error: ' + (data.error.message || '').substring(0, 100), 'error'); return; }
      showToast('Outlook Calendar event updated', 'success');
      if (_outlookCalendars.length > 0) syncOutlookMultiCalendar();
      else syncOutlookCalendarEvents();
    }).catch(function(err) { showToast('Failed to update Outlook event', 'error'); });
  }

  fetch('https://graph.microsoft.com/v1.0/me/events/' + encodeURIComponent(eventId), {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  }).then(function(resp) {
    if (resp.status === 401) {
      refreshOutlookCalToken(function(newToken) { if (newToken) doPatch(newToken); });
      return null;
    }
    return resp.json();
  }).then(function(data) {
    if (!data) return;
    if (data.error) { showToast('Outlook error: ' + (data.error.message || '').substring(0, 100), 'error'); return; }
    showToast('Outlook Calendar event updated', 'success');
    if (_outlookCalendars.length > 0) syncOutlookMultiCalendar();
    else syncOutlookCalendarEvents();
  }).catch(function(err) { showToast('Failed to update Outlook event', 'error'); });
}

function updateICloudCalendarEvent(event, updates) {
  var appleId = localStorage.getItem('roweos_icloud_apple_id') || '';
  var appPw = localStorage.getItem('roweos_icloud_app_password') || '';
  if (!appleId || !appPw || !event.icloudUid) { showToast('Cannot update iCloud event', 'error'); return; }

  // Build updated ICS
  var uid = event.icloudUid;
  var now = new Date();
  var dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  var title = updates.title || event.title;
  var date = updates.date || event.date;
  var time = updates.time !== undefined ? updates.time : event.time;
  var dtstart = date.replace(/-/g, '');
  var dtend = '';
  if (time) {
    dtstart += 'T' + time.replace(/:/g, '') + '00';
    var endDt = new Date(date + 'T' + time + ':00');
    endDt.setHours(endDt.getHours() + 1);
    dtend = endDt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  } else {
    var nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    dtend = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
  }

  var ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RoweOS//EN\r\nBEGIN:VEVENT\r\n' +
    'UID:' + uid + '\r\n' +
    'DTSTAMP:' + dtstamp + '\r\n' +
    (time ? 'DTSTART:' + dtstart + '\r\nDTEND:' + dtend + '\r\n' : 'DTSTART;VALUE=DATE:' + dtstart + '\r\nDTEND;VALUE=DATE:' + dtend + '\r\n') +
    'SUMMARY:' + title + '\r\n' +
    'END:VEVENT\r\nEND:VCALENDAR';

  var calUrl = event.icloudHref || (_icloudCalendars.length > 0 ? _icloudCalendars[0].href : '');
  if (!calUrl) { showToast('Cannot find iCloud calendar URL', 'error'); return; }
  var eventUrl = calUrl + uid + '.ics';

  caldavProxyRequest({
    url: eventUrl,
    auth: { username: appleId, password: appPw },
    method: 'PUT',
    xmlBody: ics,
    contentType: 'text/calendar; charset=utf-8'
  }).then(function(data) {
    if (data.status >= 200 && data.status < 300) {
      showToast('iCloud Calendar event updated', 'success');
      syncICloudCalendarEvents();
    } else {
      showToast('iCloud update failed (status ' + data.status + ')', 'error');
    }
  }).catch(function(err) { showToast('Failed to update iCloud event', 'error'); });
}

function deleteICloudCalendarEvent(event) {
  var appleId = localStorage.getItem('roweos_icloud_apple_id') || '';
  var appPw = localStorage.getItem('roweos_icloud_app_password') || '';
  if (!appleId || !appPw || !event.icloudUid) return;
  var calUrl = event.icloudHref || (_icloudCalendars.length > 0 ? _icloudCalendars[0].href : '');
  if (!calUrl) return;
  var eventUrl = calUrl + event.icloudUid + '.ics';

  caldavProxyRequest({
    url: eventUrl,
    auth: { username: appleId, password: appPw },
    method: 'DELETE'
  }).then(function(data) {
    if (data.status >= 200 && data.status < 300 || data.status === 404) {
      showToast('Deleted from iCloud Calendar', 'success');
      syncICloudCalendarEvents();
    }
  }).catch(function(err) { console.warn('[iCloud] Delete error:', err.message); });
}

// --- Unified event edit modal ---

// v22.44: Open external event detail — editable for connected providers
function openExternalEventDetail(eventId) {
  var ev = null;
  for (var i = 0; i < _mergedCalendarEvents.length; i++) {
    if (_mergedCalendarEvents[i].id === eventId) {
      ev = _mergedCalendarEvents[i];
      break;
    }
  }
  if (!ev) return;

  // Store reference for save handler
  window._editingExternalEvent = ev;

  var sourceLabel = ev.source === 'google' ? 'Google Calendar' : ev.source === 'icloud' ? 'iCloud Calendar' : ev.source === 'outlook' ? 'Outlook Calendar' : 'External';
  var canEdit = (ev.source === 'google' && _gcalConnected) || (ev.source === 'icloud' && _icloudConnected) || (ev.source === 'outlook' && _outlookCalConnected);
  var timeVal = ev.time || ev.startTime || '';
  var calLabel = ev.calendarName ? ' (' + escapeHtml(ev.calendarName) + ')' : '';

  var html = '<div style="padding: var(--space-4);">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-3);">' +
    '<span style="width:10px;height:10px;border-radius:50%;background:' + (ev.color || 'var(--accent)') + ';flex-shrink:0;"></span>' +
    '<span style="color:' + (ev.color || 'var(--accent)') + ';font-size:var(--text-xs);font-weight:600;">' + sourceLabel + calLabel + '</span>' +
    '</div>';

  if (canEdit) {
    html += '<div style="margin-bottom:var(--space-3);">' +
      '<label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Title</label>' +
      '<input type="text" id="extEventTitle" class="input-field" value="' + escapeHtml(ev.title) + '" style="width:100%;">' +
      '</div>' +
      '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);">' +
      '<div style="flex:1;">' +
      '<label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Date</label>' +
      '<input type="date" id="extEventDate" class="input-field" value="' + escapeHtml(ev.date) + '" style="width:100%;">' +
      '</div>' +
      '<div style="flex:1;">' +
      '<label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Time</label>' +
      '<input type="time" id="extEventTime" class="input-field" value="' + escapeHtml(timeVal) + '" style="width:100%;">' +
      '</div>' +
      '</div>';
    if (ev.source !== 'icloud') {
      html += '<div style="margin-bottom:var(--space-3);">' +
        '<label style="font-size:var(--text-xs);color:var(--text-muted);display:block;margin-bottom:4px;">Location</label>' +
        '<input type="text" id="extEventLocation" class="input-field" value="' + escapeHtml(ev.location || '') + '" style="width:100%;">' +
        '</div>';
    }
  } else {
    html += '<h3 style="margin:0 0 var(--space-3);">' + escapeHtml(ev.title) + '</h3>' +
      '<div style="color:var(--text-muted);margin-bottom:var(--space-2);">Date: ' + escapeHtml(ev.date) + '</div>' +
      '<div style="color:var(--text-muted);margin-bottom:var(--space-3);">Time: ' + escapeHtml(timeVal || 'All day') + '</div>';
  }

  if (ev.googleHtmlLink) {
    html += '<a href="' + escapeHtml(ev.googleHtmlLink) + '" target="_blank" rel="noopener" style="color:#4285f4;text-decoration:underline;font-size:var(--text-sm);">Open in Google Calendar</a>';
  }

  html += '<div style="margin-top:var(--space-4);display:flex;justify-content:space-between;align-items:center;">';
  if (canEdit) {
    html += '<button class="btn btn-small" style="background:var(--error);border-color:var(--error);" onclick="deleteExternalEvent()">Delete</button>' +
      '<div style="display:flex;gap:var(--space-2);">' +
      '<button class="btn btn-secondary btn-small" onclick="closeModal(\'externalEventModal\')">Cancel</button>' +
      '<button class="btn btn-small" onclick="saveExternalEventEdits()">Save</button>' +
      '</div>';
  } else {
    html += '<div></div><button class="btn btn-secondary btn-small" onclick="closeModal(\'externalEventModal\')">Close</button>';
  }
  html += '</div></div>';

  var modal = document.getElementById('externalEventModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'externalEventModal';
    modal.className = 'modal-overlay';
    modal.onclick = function(e) { if (e.target === modal) closeModal('externalEventModal'); };
    document.body.appendChild(modal);
  }
  modal.innerHTML = '<div class="modal" style="max-width: 420px;">' + html + '</div>';
  modal.style.display = 'flex';
}

function saveExternalEventEdits() {
  var ev = window._editingExternalEvent;
  if (!ev) return;
  var titleEl = document.getElementById('extEventTitle');
  var dateEl = document.getElementById('extEventDate');
  var timeEl = document.getElementById('extEventTime');
  var locEl = document.getElementById('extEventLocation');

  var updates = {};
  if (titleEl && titleEl.value !== ev.title) updates.title = titleEl.value;
  if (dateEl && dateEl.value !== ev.date) updates.date = dateEl.value;
  if (timeEl && timeEl.value !== (ev.time || ev.startTime || '')) updates.time = timeEl.value;
  if (locEl && locEl.value !== (ev.location || '')) updates.location = locEl.value;

  if (Object.keys(updates).length === 0) {
    closeModal('externalEventModal');
    return;
  }

  if (ev.source === 'google') updateGoogleCalendarEvent(ev, updates);
  else if (ev.source === 'outlook') updateOutlookCalendarEvent(ev, updates);
  else if (ev.source === 'icloud') updateICloudCalendarEvent(ev, updates);

  closeModal('externalEventModal');
}

function deleteExternalEvent() {
  var ev = window._editingExternalEvent;
  if (!ev) return;
  if (!confirm('Delete this event from ' + (ev.source === 'google' ? 'Google' : ev.source === 'icloud' ? 'iCloud' : 'Outlook') + ' Calendar?')) return;

  if (ev.source === 'google') deleteGoogleCalendarEvent(ev.googleEventId);
  else if (ev.source === 'outlook') {
    var eid = ev.outlookEventId || ev.id.replace('outlook_', '');
    deleteOutlookCalendarEvent(eid);
  }
  else if (ev.source === 'icloud') deleteICloudCalendarEvent(ev);

  closeModal('externalEventModal');
}

// v16.12: Settings UI update
function updateCalendarIntegrationUI() {
  // Google Calendar
  var gcalStatusEl = document.getElementById('gcalSyncStatus');
  var gcalBtn = document.getElementById('gcalConnectBtn');
  var gcalLastSync = document.getElementById('gcalLastSync');
  var gcalSyncBtn = document.getElementById('gcalSyncNowBtn');

  if (gcalStatusEl) {
    if (_gcalSyncInProgress) {
      gcalStatusEl.textContent = 'Syncing...';
      gcalStatusEl.style.color = 'var(--accent)';
    } else if (_gcalConnected) {
      var gcalCalCount = _gcalCalendars.length ? ' / ' + _gcalCalendars.length + ' cal' : '';
      gcalStatusEl.textContent = 'Connected (' + _gcalEvents.length + ' events' + gcalCalCount + ')';
      gcalStatusEl.style.color = '#22c55e';
    } else {
      gcalStatusEl.textContent = 'Not connected';
      gcalStatusEl.style.color = 'var(--text-muted)';
    }
  }
  if (gcalBtn) {
    gcalBtn.textContent = _gcalConnected ? 'Disconnect' : 'Connect';
    gcalBtn.onclick = _gcalConnected ? disconnectGoogleCalendar : connectGoogleCalendar;
  }
  if (gcalLastSync) {
    var ls = localStorage.getItem('roweos_gcal_last_sync');
    gcalLastSync.textContent = ls ? new Date(ls).toLocaleString() : 'Never';
  }
  if (gcalSyncBtn) {
    gcalSyncBtn.style.display = _gcalConnected ? '' : 'none';
  }

  // iCloud Calendar
  var icloudStatusEl = document.getElementById('icloudSyncStatus');
  var icloudBtn = document.getElementById('icloudConnectBtn');
  var icloudLastSync = document.getElementById('icloudLastSync');
  var icloudSyncBtn = document.getElementById('icloudSyncNowBtn');
  var icloudCredsRow = document.getElementById('icloudCredsRow');

  if (icloudStatusEl) {
    if (_icloudSyncInProgress) {
      icloudStatusEl.textContent = 'Syncing...';
      icloudStatusEl.style.color = 'var(--accent)';
    } else if (_icloudConnected) {
      icloudStatusEl.textContent = 'Connected (' + _icloudCalendars.length + ' calendars, ' + _icloudEvents.length + ' events)';
      icloudStatusEl.style.color = '#22c55e';
    } else {
      icloudStatusEl.textContent = 'Not connected';
      icloudStatusEl.style.color = 'var(--text-muted)';
    }
  }
  if (icloudBtn) {
    icloudBtn.textContent = _icloudConnected ? 'Disconnect' : 'Connect';
    icloudBtn.onclick = _icloudConnected ? disconnectICloudCalendar : connectICloudCalendar;
  }
  if (icloudLastSync) {
    var ls2 = localStorage.getItem('roweos_icloud_last_sync');
    icloudLastSync.textContent = ls2 ? new Date(ls2).toLocaleString() : 'Never';
  }
  if (icloudSyncBtn) {
    icloudSyncBtn.style.display = _icloudConnected ? '' : 'none';
  }
  if (icloudCredsRow) {
    icloudCredsRow.style.display = _icloudConnected ? 'none' : '';
  }

  // Outlook Calendar
  var outlookStatusEl = document.getElementById('outlookCalSyncStatus');
  var outlookBtn = document.getElementById('outlookCalConnectBtn');
  var outlookLastSync = document.getElementById('outlookCalLastSync');
  var outlookSyncBtn = document.getElementById('outlookCalSyncNowBtn');

  if (outlookStatusEl) {
    if (_outlookCalConnected) {
      var oCalCount = _outlookCalendars.length ? ' / ' + _outlookCalendars.length + ' cal' : '';
      outlookStatusEl.textContent = 'Connected (' + _outlookCalEvents.length + ' events' + oCalCount + ')';
      outlookStatusEl.style.color = '#22c55e';
    } else {
      outlookStatusEl.textContent = 'Not connected';
      outlookStatusEl.style.color = 'var(--text-muted)';
    }
  }
  if (outlookBtn) {
    outlookBtn.textContent = _outlookCalConnected ? 'Disconnect' : 'Connect';
    outlookBtn.onclick = _outlookCalConnected ? disconnectOutlookCalendar : connectOutlookCalendar;
  }
  if (outlookLastSync) {
    var ls3 = localStorage.getItem('roweos_outlook_cal_last_sync');
    outlookLastSync.textContent = ls3 ? new Date(ls3).toLocaleString() : 'Never';
  }
  if (outlookSyncBtn) {
    outlookSyncBtn.style.display = _outlookCalConnected ? '' : 'none';
  }

  // Rhythm sync icon
  var rhythmSyncBtn = document.getElementById('rhythmCalSyncBtn');
  if (rhythmSyncBtn) {
    rhythmSyncBtn.style.display = (_gcalConnected || _icloudConnected || _outlookCalConnected) ? '' : 'none';
  }

  // v22.44: Update calendar list UI
  renderCalendarListUI();
}

