// v20.11: Cloud Scheduler — Vercel Cron Serverless Function
// Runs every 5 minutes via Vercel Cron to execute due automations for all opted-in users
// Uses Firestore REST API (no npm deps) — same pattern as stripe-webhook.js
// Auth: CRON_SECRET header for Vercel Cron, OR Authorization: Bearer for manual trigger
// Env: FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT (already configured)

// --- Config ---
var MAX_RESULT_LENGTH = 5000;
var TIME_WINDOW_MINUTES = 7; // cron runs every 5 min, allow 2 min buffer
var DEFAULT_TIMEZONE = 'America/Chicago';

// v20.13: Push notifications after task execution
var webpush = null;
try { webpush = require('web-push'); } catch(e) {}

async function sendPushToUser(uid, title, message, projectId, accessToken) {
  if (!webpush || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:jordan@therowecollection.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    // Read push subscriptions for user
    var subDocs = await firestoreList(projectId, accessToken, 'users/' + uid + '/push_subscriptions', 10);
    if (!subDocs || subDocs.length === 0) return;
    var payload = JSON.stringify({ title: title, body: message, tag: 'roweos-scheduler', type: 'automation' });
    for (var i = 0; i < subDocs.length; i++) {
      var f = subDocs[i].fields || {};
      if (f.enabled && f.enabled.booleanValue === false) continue;
      var sub = { endpoint: (f.endpoint && f.endpoint.stringValue) || '', keys: {} };
      try { sub.keys = JSON.parse((f.keys && f.keys.stringValue) || '{}'); } catch(e) {}
      if (!sub.endpoint) continue;
      try { await webpush.sendNotification(sub, payload); } catch(e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          try { await fetch('https://firestore.googleapis.com/v1/' + subDocs[i].name, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + accessToken } }); } catch(de) {}
        }
      }
    }
  } catch(e) { console.log('[Scheduler] Push send failed (non-fatal):', e.message); }
}

// --- JWT / Google Auth helpers (same as stripe-webhook.js) ---

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signJwt(header, payload, privateKeyPem) {
  var crypto = require('crypto');
  var headerB64 = base64url(JSON.stringify(header));
  var payloadB64 = base64url(JSON.stringify(payload));
  var unsigned = headerB64 + '.' + payloadB64;
  var sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  var signature = sign.sign(privateKeyPem, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return unsigned + '.' + signature;
}

async function getGoogleAccessToken(serviceAccount) {
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  var jwt = await signJwt(header, payload, serviceAccount.private_key);

  var resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Google token exchange failed: ' + resp.status + ' ' + errText);
  }

  var data = await resp.json();
  return data.access_token;
}

// --- Firestore REST helpers ---

function firestoreBaseUrl(projectId) {
  return 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents';
}

// Parse a single Firestore value to plain JS
function parseFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('mapValue' in val) return parseFirestoreDoc(val.mapValue.fields || {});
  if ('arrayValue' in val) {
    var arr = [];
    var elements = (val.arrayValue && val.arrayValue.values) || [];
    for (var i = 0; i < elements.length; i++) {
      arr.push(parseFirestoreValue(elements[i]));
    }
    return arr;
  }
  return null;
}

// Parse a Firestore document's fields to a plain JS object
function parseFirestoreDoc(fields) {
  if (!fields) return {};
  var obj = {};
  var keys = Object.keys(fields);
  for (var i = 0; i < keys.length; i++) {
    obj[keys[i]] = parseFirestoreValue(fields[keys[i]]);
  }
  return obj;
}

// Convert a plain JS value to Firestore value format
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    var values = [];
    for (var i = 0; i < val.length; i++) {
      values.push(toFirestoreValue(val[i]));
    }
    return { arrayValue: { values: values } };
  }
  if (typeof val === 'object') {
    var mapFields = {};
    var keys = Object.keys(val);
    for (var j = 0; j < keys.length; j++) {
      mapFields[keys[j]] = toFirestoreValue(val[keys[j]]);
    }
    return { mapValue: { fields: mapFields } };
  }
  return { stringValue: String(val) };
}

// Query Firestore collection with structured query
async function firestoreRunQuery(projectId, accessToken, queryBody) {
  var url = firestoreBaseUrl(projectId) + ':runQuery';
  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(queryBody)
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Firestore query failed: ' + resp.status + ' ' + errText);
  }

  return await resp.json();
}

// Get a Firestore document by path
async function firestoreGet(projectId, accessToken, docPath) {
  var url = firestoreBaseUrl(projectId) + '/' + docPath;
  var resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }
  });

  if (!resp.ok) {
    if (resp.status === 404) return null;
    var errText = await resp.text();
    throw new Error('Firestore get failed (' + docPath + '): ' + resp.status + ' ' + errText);
  }

  return await resp.json();
}

// List documents in a Firestore collection
async function firestoreList(projectId, accessToken, collectionPath, pageSize) {
  var url = firestoreBaseUrl(projectId) + '/' + collectionPath;
  if (pageSize) url += '?pageSize=' + pageSize;
  var resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }
  });

  if (!resp.ok) {
    if (resp.status === 404) return [];
    var errText = await resp.text();
    throw new Error('Firestore list failed (' + collectionPath + '): ' + resp.status + ' ' + errText);
  }

  var data = await resp.json();
  return data.documents || [];
}

// Write a document to Firestore (PATCH = create or overwrite)
async function firestoreSet(projectId, accessToken, docPath, fields) {
  var url = firestoreBaseUrl(projectId) + '/' + docPath;
  var firestoreFields = {};
  var keys = Object.keys(fields);
  for (var i = 0; i < keys.length; i++) {
    firestoreFields[keys[i]] = toFirestoreValue(fields[keys[i]]);
  }

  var resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: firestoreFields })
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Firestore write failed (' + docPath + '): ' + resp.status + ' ' + errText);
  }

  return await resp.json();
}

// Update specific fields on a Firestore document (with update mask)
async function firestoreUpdate(projectId, accessToken, docPath, fields) {
  var url = firestoreBaseUrl(projectId) + '/' + docPath;
  var firestoreFields = {};
  var updateMask = [];
  var keys = Object.keys(fields);
  for (var i = 0; i < keys.length; i++) {
    updateMask.push(keys[i]);
    firestoreFields[keys[i]] = toFirestoreValue(fields[keys[i]]);
  }

  var queryParams = updateMask.map(function(f) { return 'updateMask.fieldPaths=' + encodeURIComponent(f); }).join('&');
  var resp = await fetch(url + '?' + queryParams, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: firestoreFields })
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Firestore update failed (' + docPath + '): ' + resp.status + ' ' + errText);
  }

  return await resp.json();
}

// --- Time / Due-check helpers ---

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  var parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function daysSince(d1, d2) {
  var ms = d2.getTime() - d1.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// Get current time in a user's timezone
function getNowInTimezone(tz) {
  try {
    var str = new Date().toLocaleString('en-US', { timeZone: tz });
    return new Date(str);
  } catch (e) {
    // Fallback to server time if timezone is invalid
    return new Date();
  }
}

// Check if a task is due for execution
function isTaskDue(task, userTimezone) {
  if (!task.enabled) return false;

  var now = getNowInTimezone(userTimezone || DEFAULT_TIMEZONE);
  var currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  var freq = task.frequency || task.recurType || 'none';
  var taskTime = task.time || '09:00';
  var lastRun = task.lastRun ? new Date(task.lastRun) : null;
  var isDue = false;

  // Time window check: 0 to TIME_WINDOW_MINUTES minutes forward
  var timeDiff = timeToMinutes(currentTime) - timeToMinutes(taskTime);

  // Custom recurrence uses pure interval math
  if (freq === 'custom') {
    var cInterval = task.recurInterval || 1;
    var cUnit = task.recurUnit || 'days';
    if (!lastRun) {
      // First run: use time window like other types
      if (timeDiff >= 0 && timeDiff <= TIME_WINDOW_MINUTES) isDue = true;
    } else {
      var msSince = now.getTime() - lastRun.getTime();
      if (cUnit === 'minutes') {
        isDue = msSince >= cInterval * 60 * 1000;
      } else if (cUnit === 'hours') {
        isDue = msSince >= cInterval * 60 * 60 * 1000;
      } else if (cUnit === 'days') {
        isDue = msSince >= cInterval * 24 * 60 * 60 * 1000;
      } else if (cUnit === 'weeks') {
        isDue = msSince >= cInterval * 7 * 24 * 60 * 60 * 1000;
      } else if (cUnit === 'months') {
        var monthsDiff = (now.getFullYear() - lastRun.getFullYear()) * 12 + (now.getMonth() - lastRun.getMonth());
        isDue = monthsDiff >= cInterval;
      }
    }
  } else if (timeDiff >= 0 && timeDiff <= TIME_WINDOW_MINUTES) {
    if (freq === 'daily') {
      isDue = !lastRun || !isSameDay(lastRun, now);
    } else if (freq === 'weekly') {
      isDue = !lastRun || daysSince(lastRun, now) >= 7;
    } else if (freq === 'monthly') {
      isDue = !lastRun || (now.getMonth() !== lastRun.getMonth() || now.getFullYear() !== lastRun.getFullYear());
    } else if (freq === 'once' || freq === 'none') {
      if (task.scheduledDate) {
        var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        isDue = !lastRun && task.scheduledDate === todayStr;
      } else {
        isDue = !lastRun;
      }
    }
  }

  return isDue;
}

// --- AI API Call helpers ---

async function callAnthropicAPI(apiKey, model, systemPrompt, userPrompt) {
  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  var data = await resp.json();
  if (!resp.ok) {
    var errMsg = (data && data.error && data.error.message) || ('HTTP ' + resp.status);
    throw new Error('Anthropic API error: ' + errMsg);
  }

  return (data.content && data.content[0] && data.content[0].text) || '';
}

async function callOpenAIAPI(apiKey, model, systemPrompt, userPrompt) {
  var resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  var data = await resp.json();
  if (!resp.ok) {
    var errMsg = (data && data.error && data.error.message) || ('HTTP ' + resp.status);
    throw new Error('OpenAI API error: ' + errMsg);
  }

  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

async function callGoogleAPI(apiKey, model, systemPrompt, userPrompt) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + (model || 'gemini-2.5-flash') + ':generateContent?key=' + apiKey;
  var resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
      generationConfig: { maxOutputTokens: 4096 }
    })
  });

  var data = await resp.json();
  if (!resp.ok) {
    var errMsg = (data && data.error && data.error.message) || ('HTTP ' + resp.status);
    throw new Error('Google API error: ' + errMsg);
  }

  return (data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text) || '';
}

// Unified AI API call — dispatches to provider
async function makeAICall(provider, model, apiKey, systemPrompt, userPrompt) {
  if (provider === 'anthropic') {
    return await callAnthropicAPI(apiKey, model, systemPrompt, userPrompt);
  } else if (provider === 'openai') {
    return await callOpenAIAPI(apiKey, model, systemPrompt, userPrompt);
  } else if (provider === 'google') {
    return await callGoogleAPI(apiKey, model, systemPrompt, userPrompt);
  }
  throw new Error('Unknown AI provider: ' + provider);
}

// Call Google Gemini image generation API
async function callGeminiImageGen(apiKey, prompt, model) {
  var imageModel = model || 'gemini-2.0-flash-exp-image-generation';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + imageModel + ':generateContent?key=' + apiKey;

  var resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    })
  });

  var data = await resp.json();
  if (!resp.ok) {
    var errMsg = (data && data.error && data.error.message) || ('HTTP ' + resp.status);
    throw new Error('Gemini image gen error: ' + errMsg);
  }

  // Extract image from response parts
  var candidates = data.candidates || [];
  if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
    var parts = candidates[0].content.parts;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].inlineData && parts[i].inlineData.data) {
        return {
          base64: parts[i].inlineData.data,
          mimeType: parts[i].inlineData.mimeType || 'image/png'
        };
      }
    }
  }

  throw new Error('No image data in Gemini response');
}

// --- Brand / prompt building helpers ---

function buildSystemPrompt(brand) {
  var name = (brand && (brand.shortName || brand.name)) || 'Brand';
  var prompt = 'You are an expert AI assistant for ' + name + '.\n\n';
  prompt += 'BRAND CONTEXT:\n';
  prompt += '- Name: ' + (brand.name || name) + '\n';
  if (brand.tagline) prompt += '- Tagline: ' + brand.tagline + '\n';
  prompt += '- Voice: ' + (brand.voice || 'Professional and warm') + '\n';
  prompt += '- Audience: ' + (brand.audience || 'Discerning clients') + '\n';
  prompt += '- Positioning: ' + (brand.positioning || 'Excellence in every detail') + '\n';
  if (brand.values) prompt += '- Values: ' + brand.values + '\n';
  if (brand.desc) prompt += '- Description: ' + brand.desc + '\n';

  prompt += '\nGUIDELINES:\n';
  prompt += '- Maintain the brand voice consistently throughout your response\n';
  prompt += '- Be professional, thorough, and helpful\n';
  prompt += '- Focus on quality and attention to detail\n';
  prompt += '- Tailor content to the target audience\n';

  return prompt;
}

function buildTaskPrompt(task, brand) {
  // Handle studio / run_operation action
  if (task.action === 'studio' && task.target && task.target.operationId) {
    task = Object.assign({}, task, { action: 'run_operation', operationId: task.target.operationId });
  }

  // For run_operation, build operation-specific prompt
  // Note: We don't have access to the ops array on the server, so we use what's in the task
  if (task.action === 'run_operation') {
    var opPrompt = '[AUTOMATED TASK -- You MUST produce direct output only. Do NOT ask questions, seek clarification, or add meta-commentary. Just produce the requested content immediately.]\n\n';
    if (task.target && task.target.operationName) {
      opPrompt += 'TASK: ' + task.target.operationName + '\n';
    }
    if (task.target && task.target.operationDesc) {
      opPrompt += task.target.operationDesc + '\n';
    }
    if (task.target && task.target.outputs && task.target.outputs.length > 0) {
      opPrompt += '\nRequired Deliverables:\n';
      task.target.outputs.forEach(function(output) {
        opPrompt += '- ' + output + '\n';
      });
    }
    var _taskContext = (task.target && task.target.contextRef) || task.description || '';
    if (_taskContext) {
      opPrompt += '\nAdditional Context: ' + _taskContext;
    }
    opPrompt += '\n\nBegin your output now.';
    return opPrompt;
  }

  // Handle message action with brand context
  if (task.action === 'message') {
    var msgText = (task.target && task.target.text) || task.description || '';
    var msgPrompt = '[AUTOMATED TASK -- You MUST produce direct output only. Do NOT ask questions or add meta-commentary.]\n\n';
    if (brand) {
      msgPrompt += 'Brand: ' + (brand.shortName || brand.name) + '\n';
      if (brand.desc) msgPrompt += 'Description: ' + brand.desc + '\n';
      if (brand.voice) msgPrompt += 'Voice: ' + brand.voice + '\n';
      if (brand.positioning) msgPrompt += 'Positioning: ' + brand.positioning + '\n';
    }
    msgPrompt += '\nINSTRUCTION: ' + msgText;
    msgPrompt += '\n\nProduce your response now. Be thorough and actionable.';
    return msgPrompt;
  }

  // Fallback prompts for common action types
  var prompts = {
    'generate_report': 'Generate a comprehensive brand performance report. Include key metrics, insights, and recommendations for improvement.',
    'generate_content': 'Generate engaging social media content and blog post ideas for the brand. Include 3 social posts and 1 blog outline.',
    'consistency_check': 'Review and analyze brand voice consistency. Provide a checklist of brand guidelines compliance.',
    'competitor_analysis': 'Analyze top competitors and provide strategic insights on positioning and opportunities.',
    'audience_insights': 'Generate detailed audience insights including demographics, preferences, and engagement patterns.',
    'custom': task.description || task.name || 'Provide a helpful response for this brand task.'
  };

  var basePrompt = prompts[task.action] || prompts['custom'];
  return '[AUTOMATED TASK -- Produce direct, complete output only. No questions or meta-commentary.]\n\n' + basePrompt + '\n\nBegin your output now.';
}

// Resolve provider and model from brand settings + task config
function resolveProviderAndModel(task, brandSettings, apiKeys) {
  var provider = 'anthropic';
  var model = 'claude-sonnet-4-6';

  // Start from brand settings
  if (brandSettings && brandSettings.provider) provider = brandSettings.provider;
  if (brandSettings && brandSettings.model) model = brandSettings.model;

  // Task config overrides brand settings
  if (task.config && task.config.provider) provider = task.config.provider;
  if (task.config && task.config.model) model = task.config.model;

  // Resolve 'auto' / 'roweos' to actual provider
  if (model === 'auto' || provider === 'roweos') {
    provider = 'anthropic';
    model = 'claude-sonnet-4-6';
  }

  // Validate provider has an API key, fall back if not
  var validProviders = ['anthropic', 'openai', 'google'];
  if (validProviders.indexOf(provider) === -1) provider = 'anthropic';

  if (!apiKeys[provider]) {
    // Fall back to any available provider
    for (var i = 0; i < validProviders.length; i++) {
      if (apiKeys[validProviders[i]]) {
        provider = validProviders[i];
        // Set a reasonable default model for the fallback provider
        if (provider === 'anthropic') model = 'claude-sonnet-4-6';
        else if (provider === 'openai') model = 'gpt-4o';
        else if (provider === 'google') model = 'gemini-2.5-flash';
        break;
      }
    }
  }

  return { provider: provider, model: model };
}

// --- Social post helper ---

async function executeSocialPost(task, profileData, reqHost, projectId, googleAccessToken, uid) {
  var postContent = (task.target && task.target.text) ? task.target.text : (task.description || '');
  var postPlatforms = (task.target && task.target.platforms) ? task.target.platforms : [];

  if (!postContent) throw new Error('No content for social post');
  if (postPlatforms.length === 0) throw new Error('No platforms selected for post');

  // v20.12: Read social tokens from socialConnections (correct location) AND Firestore social_tokens subcollection
  var socialConns = (profileData && profileData.socialConnections) || {};
  var results = [];

  for (var p = 0; p < postPlatforms.length; p++) {
    var platform = postPlatforms[p];

    // TikTok is always clipboard-only, skip
    if (platform === 'tiktok') {
      results.push({ platform: platform, success: true, note: 'TikTok: copied (no API)' });
      continue;
    }

    var brandIdx = task.brandIdx !== undefined ? parseInt(task.brandIdx) : 0;
    var scKey = platform + '_brand_' + brandIdx;
    var tokenData = null;

    // v20.12: Try 1 — socialConnections in profile (synced from client)
    if (socialConns[scKey] && socialConns[scKey].token) {
      var rawToken = socialConns[scKey].token;
      if (typeof rawToken === 'string') {
        try { tokenData = JSON.parse(rawToken); } catch(e) { tokenData = null; }
      } else if (typeof rawToken === 'object') {
        tokenData = rawToken;
      }
    }

    // v20.12: Try 2 — Firestore social_tokens subcollection (written by social-auth endpoint)
    if ((!tokenData || !tokenData.accessToken) && projectId && googleAccessToken && uid) {
      try {
        var tokenDoc = await firestoreGet(projectId, googleAccessToken, 'users/' + uid + '/social_tokens/' + scKey);
        if (tokenDoc && tokenDoc.fields) {
          tokenData = parseFirestoreDoc(tokenDoc.fields);
        }
      } catch(e) {
        console.log('[Scheduler] social_tokens read failed for ' + scKey + ':', e.message);
      }
    }

    // v20.12: Try 3 — legacy settings keys (old format)
    if (!tokenData || !tokenData.accessToken) {
      var settings = (profileData && profileData.settings) || {};
      var legacyToken = settings['social_token_' + platform + '_brand_' + brandIdx] || settings['social_token_' + platform] || null;
      if (legacyToken) {
        if (typeof legacyToken === 'string') {
          try { tokenData = JSON.parse(legacyToken); } catch(e) { tokenData = { accessToken: legacyToken }; }
        } else {
          tokenData = legacyToken;
        }
      }
    }

    if (!tokenData || !tokenData.accessToken) {
      results.push({ platform: platform, success: false, error: 'No token found for ' + platform });
      continue;
    }

    // v20.12: Refresh X tokens if expired (X tokens last 2 hours)
    var baseUrl = reqHost ? ('https://' + reqHost) : 'https://roweos.vercel.app';
    if (platform === 'x' && tokenData.expiresAt) {
      var now = Date.now();
      var expAt = typeof tokenData.expiresAt === 'string' ? parseInt(tokenData.expiresAt) : tokenData.expiresAt;
      if (expAt < now + 300000 && tokenData.refreshToken) {
        try {
          console.log('[Scheduler] Refreshing expired X token for user ' + uid);
          var refreshResp = await fetch(baseUrl + '/api/social-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'x', action: 'refresh', refreshToken: tokenData.refreshToken, uid: uid, scope: '_brand_' + brandIdx })
          });
          var refreshData = await refreshResp.json();
          if (refreshData && refreshData.accessToken) {
            tokenData = refreshData;
            console.log('[Scheduler] X token refreshed successfully');
          } else {
            console.log('[Scheduler] X refresh returned no token:', JSON.stringify(refreshData).substring(0, 200));
          }
        } catch(refreshErr) {
          console.log('[Scheduler] X token refresh failed:', refreshErr.message);
        }
      }
    }

    try {
      // Call our own social-post endpoint
      var postBody = {
        platform: platform,
        accessToken: tokenData.accessToken,
        content: postContent,
        mediaIds: [],
        userId: tokenData.userId || ''
      };

      var postResp = await fetch(baseUrl + '/api/social-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody)
      });

      var postData = await postResp.json();
      if (postData.error) {
        results.push({ platform: platform, success: false, error: postData.error });
      } else {
        results.push({ platform: platform, success: true, postUrl: postData.postUrl || null });
      }
    } catch (postErr) {
      results.push({ platform: platform, success: false, error: postErr.message });
    }
  }

  // Build result summary
  var successCount = results.filter(function(r) { return r.success; }).length;
  var summary = 'Posted to ' + successCount + '/' + results.length + ' platforms.';
  results.forEach(function(r) {
    if (r.success) {
      summary += '\n  ' + r.platform + ': OK' + (r.postUrl ? ' (' + r.postUrl + ')' : '');
    } else {
      summary += '\n  ' + r.platform + ': FAILED - ' + r.error;
    }
  });

  return {
    success: successCount > 0,
    result: summary,
    postResults: results
  };
}

// --- Pipeline execution ---

async function executePipeline(task, brand, brandSettingsObj, apiKeys, profileData, projectId, accessToken, uid, reqHost) {
  var steps = task.steps || [];
  if (steps.length === 0) throw new Error('Pipeline has no steps');

  var context = {};
  if (brand) context.brandName = brand.shortName || brand.name;
  if (task.brandIdx !== undefined) context._brandIdx = parseInt(task.brandIdx);

  var completedSteps = [];
  var failedSteps = [];

  for (var s = 0; s < steps.length; s++) {
    var step = steps[s];
    var stepAction = step.action || 'studio';
    console.log('[Scheduler] Pipeline step ' + (s + 1) + '/' + steps.length + ': ' + stepAction + ' - ' + (step.name || ''));

    try {
      var stepResult = '';

      // Resolve template variables from previous steps: {{step1_output}}, {{step2_image}}, etc.
      var stepText = (step.target && step.target.text) || step.description || step.name || '';
      var stepKeys = Object.keys(context);
      for (var k = 0; k < stepKeys.length; k++) {
        var placeholder = '{{' + stepKeys[k] + '}}';
        if (typeof context[stepKeys[k]] === 'string' && stepText.indexOf(placeholder) !== -1) {
          stepText = stepText.split(placeholder).join(context[stepKeys[k]]);
        }
      }

      if (stepAction === 'studio' || stepAction === 'message' || stepAction === 'run_operation') {
        // AI call
        var pm = resolveProviderAndModel(step, brandSettingsObj, apiKeys);
        if (!apiKeys[pm.provider]) throw new Error('No API key for ' + pm.provider);

        var systemPrompt = buildSystemPrompt(brand);
        var userPrompt = '[AUTOMATED PIPELINE STEP ' + (s + 1) + '/' + steps.length + ']\n\n' + stepText + '\n\nProduce direct output only.';
        stepResult = await makeAICall(pm.provider, pm.model, apiKeys[pm.provider], systemPrompt, userPrompt);

      } else if (stepAction === 'image') {
        // Image generation
        if (!apiKeys.google) throw new Error('No Google API key for image generation');
        var imageModel = (step.config && step.config.imageModel) || 'gemini-2.0-flash-exp-image-generation';
        var imgResult = await callGeminiImageGen(apiKeys.google, stepText, imageModel);
        stepResult = '[Image generated: ' + (imgResult.mimeType || 'image/png') + ']';
        // Store image reference in context (but not the full base64 — too large)
        context['step' + (s + 1) + '_image'] = stepResult;

      } else if (stepAction === 'post') {
        // Social post
        var postTask = Object.assign({}, step, { brandIdx: task.brandIdx });
        if (step.target) postTask.target = step.target;
        if (!postTask.target) postTask.target = { text: stepText, platforms: [] };
        if (!postTask.target.text) postTask.target.text = stepText;

        // Inject previous step output as post content if template referenced
        var postResult = await executeSocialPost(postTask, profileData, reqHost);
        stepResult = postResult.result;

      } else if (stepAction === 'notify') {
        stepResult = 'Notification: ' + stepText;

      } else {
        // Default: treat as AI call
        var pm2 = resolveProviderAndModel(step, brandSettingsObj, apiKeys);
        if (!apiKeys[pm2.provider]) throw new Error('No API key for ' + pm2.provider);
        stepResult = await makeAICall(pm2.provider, pm2.model, apiKeys[pm2.provider], buildSystemPrompt(brand), stepText);
      }

      context['step' + (s + 1) + '_output'] = stepResult || '';
      completedSteps.push({ step: step, result: stepResult });
      console.log('[Scheduler] Pipeline step ' + (s + 1) + ' completed (' + (stepResult || '').substring(0, 100) + '...)');

    } catch (stepErr) {
      console.error('[Scheduler] Pipeline step ' + (s + 1) + ' failed:', stepErr.message);
      failedSteps.push({ step: step, error: stepErr.message });
      context['step' + (s + 1) + '_output'] = 'ERROR: ' + stepErr.message;
    }
  }

  return {
    completedSteps: completedSteps,
    failedSteps: failedSteps,
    context: context
  };
}

// --- Main task execution ---

async function executeTask(task, uid, apiKeys, brands, brandSettingsArr, profileData, projectId, accessToken, reqHost) {
  var brandIdx = task.brandIdx !== undefined && task.brandIdx !== '' ? parseInt(task.brandIdx) : 0;
  var brand = (brands && brands[brandIdx]) ? brands[brandIdx] : (brands && brands[0]) ? brands[0] : { name: 'Brand' };
  var brandSettingsObj = (brandSettingsArr && brandSettingsArr[brandIdx]) ? brandSettingsArr[brandIdx] : {};
  var taskName = task.name || 'Unnamed Task';
  var action = task.action || 'message';

  console.log('[Scheduler] Executing task "' + taskName + '" (action: ' + action + ') for user ' + uid);

  var result = '';
  var success = true;

  try {
    // --- Image generation ---
    if (action === 'image') {
      if (!apiKeys.google) throw new Error('No Google API key for image generation');
      var imgPrompt = (task.target && task.target.text) ? task.target.text : (task.name || 'Generate an image');
      var imgModel = (task.config && task.config.imageModel) || 'gemini-2.0-flash-exp-image-generation';
      var imgData = await callGeminiImageGen(apiKeys.google, imgPrompt, imgModel);
      result = 'Image generated successfully (' + (imgData.mimeType || 'image/png') + ')';
    }

    // --- Pipeline ---
    else if (task.type === 'pipeline' && task.steps && task.steps.length > 0) {
      var pipeResult = await executePipeline(task, brand, brandSettingsObj, apiKeys, profileData, projectId, accessToken, uid, reqHost);
      var failCount = pipeResult.failedSteps ? pipeResult.failedSteps.length : 0;
      var okCount = pipeResult.completedSteps ? pipeResult.completedSteps.length : task.steps.length;
      success = failCount === 0;
      result = 'Pipeline ' + (success ? 'completed' : 'completed with errors') + ' (' + okCount + '/' + task.steps.length + ' steps)';
      // Append step outputs
      if (pipeResult.context) {
        var ctxKeys = Object.keys(pipeResult.context);
        for (var ci = 0; ci < ctxKeys.length; ci++) {
          var cv = pipeResult.context[ctxKeys[ci]];
          if (typeof cv === 'string' && cv.length > 0 && cv.indexOf('data:image') !== 0 && ctxKeys[ci] !== 'brandName' && ctxKeys[ci] !== '_brandIdx') {
            result += '\n\n--- ' + ctxKeys[ci] + ' ---\n' + cv.substring(0, 2000);
          }
        }
      }
      if (pipeResult.failedSteps && pipeResult.failedSteps.length > 0) {
        result += '\n\nFailed Steps:';
        pipeResult.failedSteps.forEach(function(fs) {
          result += '\n- ' + (fs.step && fs.step.name || 'Unknown') + ': ' + (fs.error || 'Unknown error');
        });
      }
    }

    // --- Social post ---
    // v20.12: Pass projectId, accessToken, uid for Firestore token lookup + X token refresh
    else if (action === 'post') {
      var postResult = await executeSocialPost(task, profileData, reqHost, projectId, accessToken, uid);
      success = postResult.success;
      result = postResult.result;
    }

    // --- Create (todo) ---
    else if (action === 'create') {
      var todoText = (task.target && task.target.text) || task.description || task.name || '';
      // Write to user's Firestore todos (they'll pick it up on next sync)
      result = 'Todo created: ' + todoText;
      // We'll include it in cloud_results for the client to pick up and add locally
    }

    // --- Notify ---
    else if (action === 'notify') {
      var notifyText = (task.target && task.target.text) || task.description || task.name || '';
      result = 'Notification: ' + notifyText;
      // Client picks this up and shows toast / notification
    }

    // --- Pulse (goal update) ---
    else if (action === 'pulse') {
      var pulseText = (task.target && task.target.text) || task.description || '';
      result = 'Pulse goal update: ' + pulseText;
    }

    // --- AI-based actions (message, studio, run_operation, custom, etc.) ---
    else {
      var pm = resolveProviderAndModel(task, brandSettingsObj, apiKeys);
      if (!apiKeys[pm.provider]) throw new Error('No API key for provider: ' + pm.provider);

      var systemPrompt = buildSystemPrompt(brand);
      var userPrompt = buildTaskPrompt(task, brand);

      // Handle response length config
      var maxTokens = 4096;
      if (task.config && task.config.length) {
        var lengthMap = { short: 1024, medium: 2048, long: 4096, 'extra-long': 8192 };
        maxTokens = lengthMap[task.config.length] || 4096;
      }

      // Make the API call (maxTokens is baked into the sub-functions at 4096; for custom, re-call directly)
      if (maxTokens !== 4096) {
        // Direct call with custom max_tokens
        if (pm.provider === 'anthropic') {
          var aResp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKeys[pm.provider],
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: pm.model,
              max_tokens: maxTokens,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }]
            })
          });
          var aData = await aResp.json();
          if (!aResp.ok) throw new Error('Anthropic API error: ' + ((aData.error && aData.error.message) || aResp.status));
          result = (aData.content && aData.content[0] && aData.content[0].text) || '';
        } else if (pm.provider === 'openai') {
          var oResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + apiKeys[pm.provider]
            },
            body: JSON.stringify({
              model: pm.model,
              max_tokens: maxTokens,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ]
            })
          });
          var oData = await oResp.json();
          if (!oResp.ok) throw new Error('OpenAI API error: ' + ((oData.error && oData.error.message) || oResp.status));
          result = (oData.choices && oData.choices[0] && oData.choices[0].message && oData.choices[0].message.content) || '';
        } else if (pm.provider === 'google') {
          var gUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + pm.model + ':generateContent?key=' + apiKeys[pm.provider];
          var gResp = await fetch(gUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
              generationConfig: { maxOutputTokens: maxTokens }
            })
          });
          var gData = await gResp.json();
          if (!gResp.ok) throw new Error('Google API error: ' + ((gData.error && gData.error.message) || gResp.status));
          result = (gData.candidates && gData.candidates[0] && gData.candidates[0].content &&
            gData.candidates[0].content.parts && gData.candidates[0].content.parts[0] &&
            gData.candidates[0].content.parts[0].text) || '';
        }
      } else {
        result = await makeAICall(pm.provider, pm.model, apiKeys[pm.provider], systemPrompt, userPrompt);
      }
    }

  } catch (err) {
    success = false;
    result = 'Error: ' + err.message;
    console.error('[Scheduler] Task "' + taskName + '" failed:', err.message);
  }

  // Cap result length
  if (result && result.length > MAX_RESULT_LENGTH) {
    result = result.substring(0, MAX_RESULT_LENGTH) + '\n\n[Truncated at ' + MAX_RESULT_LENGTH + ' chars]';
  }

  return { success: success, result: result };
}

// --- Process a single user ---

async function processUser(uid, projectId, accessToken, reqHost) {
  console.log('[Scheduler] Processing user: ' + uid);

  var tasksExecuted = 0;
  var tasksFailed = 0;

  try {
    // 1. Read API keys from secure storage
    var secureDoc = await firestoreGet(projectId, accessToken, 'roweos_users/' + uid + '/secure/api_keys');
    if (!secureDoc || !secureDoc.fields) {
      console.log('[Scheduler] No secure doc for user ' + uid + ', skipping');
      return { executed: 0, failed: 0 };
    }

    var secureData = parseFirestoreDoc(secureDoc.fields);
    if (!secureData.cloudSchedulerEnabled) {
      console.log('[Scheduler] Cloud scheduler not enabled for user ' + uid + ', skipping');
      return { executed: 0, failed: 0 };
    }

    var apiKeys = {
      anthropic: secureData.anthropic || '',
      openai: secureData.openai || '',
      google: secureData.google || ''
    };

    if (!apiKeys.anthropic && !apiKeys.openai && !apiKeys.google) {
      console.log('[Scheduler] No API keys for user ' + uid + ', skipping');
      return { executed: 0, failed: 0 };
    }

    // 2. Read profile (brands, brandSettings, timezone)
    var profileDoc = await firestoreGet(projectId, accessToken, 'roweos_users/' + uid + '/profile/main');
    var profileData = {};
    if (profileDoc && profileDoc.fields) {
      profileData = parseFirestoreDoc(profileDoc.fields);
    }

    var brands = profileData.brands || [];
    var brandSettings = profileData.brandSettings || [];
    var timezone = (profileData.settings && profileData.settings.timezone) || DEFAULT_TIMEZONE;

    // 3. Read automations subcollection
    var automationDocs = await firestoreList(projectId, accessToken, 'roweos_users/' + uid + '/automations', 200);
    if (!automationDocs || automationDocs.length === 0) {
      console.log('[Scheduler] No automations for user ' + uid);
      return { executed: 0, failed: 0 };
    }

    console.log('[Scheduler] User ' + uid + ': found ' + automationDocs.length + ' automations, timezone: ' + timezone);

    // 4. Process each automation
    for (var a = 0; a < automationDocs.length; a++) {
      var autoDoc = automationDocs[a];
      if (!autoDoc.fields) continue;

      var task = parseFirestoreDoc(autoDoc.fields);

      // Extract doc ID from name path (projects/.../documents/automations/DOC_ID)
      var docName = autoDoc.name || '';
      var docIdParts = docName.split('/');
      var docId = docIdParts[docIdParts.length - 1];
      if (!task.id) task.id = docId;

      // Skip disabled tasks
      if (!task.enabled) continue;

      // 5. Check if task is due
      if (!isTaskDue(task, timezone)) continue;

      console.log('[Scheduler] Task due: "' + (task.name || docId) + '" (action: ' + (task.action || 'unknown') + ')');

      try {
        // 6. Execute the task
        var execResult = await executeTask(task, uid, apiKeys, brands, brandSettings, profileData, projectId, accessToken, reqHost);
        var now = new Date().toISOString();

        // 7. Write result to cloud_results subcollection
        var resultDocId = (task.id || docId || 'task') + '_' + Date.now();
        await firestoreSet(projectId, accessToken, 'roweos_users/' + uid + '/cloud_results/' + resultDocId, {
          taskId: String(task.id || docId || ''),
          taskName: task.name || 'Unnamed',
          brand: task.brand || (brands[0] && (brands[0].shortName || brands[0].name)) || '',
          action: task.action || 'message',
          result: execResult.result || '',
          success: execResult.success,
          timestamp: now,
          picked_up: false,
          executedBy: 'cloud'
        });

        // 8. Update automation's lastRun and lastExecutor in Firestore
        var autoDocPath = 'roweos_users/' + uid + '/automations/' + docId;
        await firestoreUpdate(projectId, accessToken, autoDocPath, {
          lastRun: now,
          lastExecutor: 'cloud'
        });

        if (execResult.success) {
          tasksExecuted++;
          console.log('[Scheduler] Task "' + (task.name || docId) + '" completed successfully');
          // v20.13: Send push notification on success
          try { await sendPushToUser(uid, 'Automation Complete', (task.name || 'Task') + ' ran successfully', projectId, accessToken); } catch(pe) {}
        } else {
          tasksFailed++;
          console.log('[Scheduler] Task "' + (task.name || docId) + '" completed with error: ' + (execResult.result || '').substring(0, 200));
          // v20.13: Send push notification on failure
          try { await sendPushToUser(uid, 'Automation Failed', (task.name || 'Task') + ' encountered an error', projectId, accessToken); } catch(pe) {}
        }

      } catch (taskErr) {
        tasksFailed++;
        console.error('[Scheduler] Task "' + (task.name || docId) + '" threw error:', taskErr.message);

        // Still write error to cloud_results so client knows what happened
        try {
          var errResultDocId = (task.id || docId || 'task') + '_err_' + Date.now();
          await firestoreSet(projectId, accessToken, 'roweos_users/' + uid + '/cloud_results/' + errResultDocId, {
            taskId: String(task.id || docId || ''),
            taskName: task.name || 'Unnamed',
            brand: task.brand || '',
            action: task.action || 'unknown',
            result: 'Error: ' + taskErr.message,
            success: false,
            timestamp: new Date().toISOString(),
            picked_up: false,
            executedBy: 'cloud'
          });

          // Update lastRun even on error to prevent retry loops
          var errAutoDocPath = 'roweos_users/' + uid + '/automations/' + docId;
          await firestoreUpdate(projectId, accessToken, errAutoDocPath, {
            lastRun: new Date().toISOString(),
            lastExecutor: 'cloud'
          });
        } catch (writeErr) {
          console.error('[Scheduler] Failed to write error result for task:', writeErr.message);
        }
      }
    }

  } catch (userErr) {
    console.error('[Scheduler] Error processing user ' + uid + ':', userErr.message);
    return { executed: tasksExecuted, failed: tasksFailed + 1, error: userErr.message };
  }

  return { executed: tasksExecuted, failed: tasksFailed };
}

// --- Main handler ---

export default async function handler(req, res) {
  var startTime = Date.now();

  // CORS headers
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- Auth check ---
  var cronSecret = process.env.CRON_SECRET || '';
  var authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';

  var isAuthorized = false;

  // Vercel Cron sends Authorization: Bearer {CRON_SECRET}
  if (cronSecret && authHeader === 'Bearer ' + cronSecret) {
    isAuthorized = true;
    console.log('[Scheduler] Authorized via CRON_SECRET');
  }

  // Also accept manual trigger with same secret
  if (!isAuthorized && cronSecret && req.headers['x-cron-secret'] === cronSecret) {
    isAuthorized = true;
    console.log('[Scheduler] Authorized via x-cron-secret header');
  }

  if (!isAuthorized) {
    console.warn('[Scheduler] Unauthorized request from:', req.headers['x-forwarded-for'] || 'unknown');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // --- Environment check ---
  var projectId = process.env.FIREBASE_PROJECT_ID;
  var serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!projectId || !serviceAccountJson) {
    console.error('[Scheduler] Missing FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT env vars');
    return res.status(500).json({ error: 'Server misconfigured: missing Firebase credentials' });
  }

  var serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    console.error('[Scheduler] Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    return res.status(500).json({ error: 'Server misconfigured: invalid service account JSON' });
  }

  try {
    // 1. Get Google access token
    console.log('[Scheduler] Getting Google access token...');
    var accessToken = await getGoogleAccessToken(serviceAccount);
    console.log('[Scheduler] Access token obtained');

    // 2. Query users with cloudSchedulerEnabled == true
    console.log('[Scheduler] Querying enabled users...');
    var queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'roweos_users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'cloudSchedulerEnabled' },
            op: 'EQUAL',
            value: { booleanValue: true }
          }
        },
        limit: 100
      }
    };

    var queryResults = await firestoreRunQuery(projectId, accessToken, queryBody);

    // Parse user UIDs from query results
    var userUids = [];
    if (queryResults && Array.isArray(queryResults)) {
      for (var i = 0; i < queryResults.length; i++) {
        var qDoc = queryResults[i];
        if (qDoc.document && qDoc.document.name) {
          // Extract UID from document path: .../roweos_users/UID
          var pathParts = qDoc.document.name.split('/');
          var uid = pathParts[pathParts.length - 1];
          if (uid && uid !== 'roweos_users') {
            userUids.push(uid);
          }
        }
      }
    }

    console.log('[Scheduler] Found ' + userUids.length + ' enabled user(s)');

    if (userUids.length === 0) {
      return res.status(200).json({
        ok: true,
        message: 'No users with cloud scheduler enabled',
        duration: Date.now() - startTime
      });
    }

    // 3. Process each user
    var totalExecuted = 0;
    var totalFailed = 0;
    var userResults = [];
    var reqHost = req.headers.host || 'roweos.vercel.app';

    for (var u = 0; u < userUids.length; u++) {
      var userResult = await processUser(userUids[u], projectId, accessToken, reqHost);
      totalExecuted += userResult.executed || 0;
      totalFailed += userResult.failed || 0;
      userResults.push({
        uid: userUids[u].substring(0, 8) + '...', // Truncate UID for privacy in logs
        executed: userResult.executed || 0,
        failed: userResult.failed || 0
      });
    }

    var durationMs = Date.now() - startTime;
    console.log('[Scheduler] Run complete in ' + durationMs + 'ms: ' + totalExecuted + ' executed, ' + totalFailed + ' failed across ' + userUids.length + ' user(s)');

    return res.status(200).json({
      ok: true,
      users: userUids.length,
      executed: totalExecuted,
      failed: totalFailed,
      duration: durationMs,
      details: userResults
    });

  } catch (err) {
    var durationMs2 = Date.now() - startTime;
    console.error('[Scheduler] Fatal error:', err.message, err.stack);
    return res.status(500).json({
      error: 'Scheduler error: ' + err.message,
      duration: durationMs2
    });
  }
}
