/**
 * RoweOS Cloud Functions — Task Executor
 * v19.1: Executes AI tasks server-side
 * v19.5: Added post, image, pipeline, create, notify, pulse action handlers
 * Ported from client-side executeScheduledTask() AI path (~line 127844)
 */

var helpers = require('./firestore-helpers');
var apiCaller = require('./api-caller');
var promptBuilder = require('./prompt-builder');
var socialPoster = require('./social-poster');
var imageGenerator = require('./image-generator');
var pipelineExecutor = require('./pipeline-executor');

/**
 * Execute a single task for a user
 * @param {string} uid - Firebase user ID
 * @param {Object} task - Automation task object
 * @param {Object} apiKeys - User's API keys
 * @returns {Object} Execution result { success, result, error }
 */
async function executeTask(uid, task, apiKeys) {
  var startTime = Date.now();
  console.log('[Executor] Running task:', task.name, 'action:', task.action || 'ai', 'for user:', uid);

  try {
    // Acquire lock to prevent concurrent execution
    var locked = await helpers.setCloudLock(uid, String(task.id), true);
    if (!locked) {
      console.log('[Executor] Task locked, skipping:', task.name);
      return { success: false, result: null, error: 'Task locked by concurrent execution' };
    }

    // Get brand data
    var brands = await helpers.getUserBrands(uid);
    var brandIdx = task.brandIdx !== undefined && task.brandIdx !== '' ? parseInt(task.brandIdx) : 0;
    var brand = brands[brandIdx] || brands[0];
    // v19.2: Set task.brand for history/logging
    task.brand = brand ? (brand.shortName || brand.name) : '';

    if (!brand) {
      await helpers.setCloudLock(uid, String(task.id), false);
      return { success: false, result: null, error: 'No brand found' };
    }

    // --- v19.5: Non-AI action handlers (before AI prompt-building) ---

    // Post action — social media posting
    if (task.action === 'post') {
      var postResult = await handlePostAction(uid, task, brandIdx);
      await finishTask(uid, task, brand, postResult, startTime);
      return postResult;
    }

    // Image action — Gemini image generation
    if (task.action === 'image') {
      var imgResult = await handleImageAction(uid, task, apiKeys);
      await finishTask(uid, task, brand, imgResult, startTime);
      return imgResult;
    }

    // Pipeline — multi-step workflow
    if (task.type === 'pipeline' && task.steps) {
      var pipeResult = await handlePipelineAction(uid, task, apiKeys, brands);
      await finishTask(uid, task, brand, pipeResult, startTime);
      return pipeResult;
    }

    // Create task (no AI) — client picks up from cloud_results
    if (task.action === 'create') {
      var taskText = (task.target && task.target.text) || task.name;
      var createResult = { success: true, result: 'Created task: ' + taskText, error: null };
      await finishTask(uid, task, brand, createResult, startTime);
      return createResult;
    }

    // Notify (no AI) — just write result
    if (task.action === 'notify') {
      var notifyText = (task.target && task.target.text) || task.name;
      var notifyResult = { success: true, result: 'Notification: ' + notifyText, error: null };
      await finishTask(uid, task, brand, notifyResult, startTime);
      return notifyResult;
    }

    // Pulse/goal update (no AI)
    if (task.action === 'pulse') {
      var pulseResult = { success: true, result: 'Goal update triggered', error: null };
      await finishTask(uid, task, brand, pulseResult, startTime);
      return pulseResult;
    }

    // --- AI path (original v19.1 logic) ---

    // Get brand settings for provider/model
    var brandSettings = await helpers.getUserBrandSettings(uid);
    var settings = brandSettings[String(brandIdx)] || { provider: 'anthropic', model: 'claude-sonnet-4-6' };
    var provider = settings.provider || 'anthropic';
    var model = settings.model || 'claude-sonnet-4-6';

    // Per-automation config overrides
    if (task.config && task.config.provider) {
      provider = task.config.provider;
      if (provider === 'anthropic') model = 'claude-sonnet-4-6';
      else if (provider === 'openai') model = 'gpt-4o';
      else if (provider === 'google') model = 'gemini-2.0-flash';
    }
    if (task.config && task.config.model) model = task.config.model;

    // Resolve API key
    var apiKey = apiKeys[provider];
    if (!apiKey) {
      await helpers.setCloudLock(uid, String(task.id), false);
      return { success: false, result: null, error: 'No API key for ' + provider };
    }

    // Build prompts — gather operations for lookup
    var customOps = await helpers.getUserCustomOps(uid);
    var generatedOps = await helpers.getUserGeneratedBrandOps(uid);
    var allOps = [].concat(customOps, generatedOps);

    // Build user prompt
    var userPrompt = promptBuilder.buildTaskPrompt(task, allOps);
    if (userPrompt === null) {
      // Reminder-only task — no AI call needed
      await helpers.setCloudLock(uid, String(task.id), false);
      return { success: true, result: 'Reminder: ' + task.name, error: null };
    }

    // Build system prompt
    var taskOp = task.operationId ? promptBuilder.findOperationById(task.operationId, allOps) : null;
    if (!taskOp && task.target && task.target.operationId) {
      taskOp = promptBuilder.findOperationById(task.target.operationId, allOps);
    }

    var systemPrompt;
    if (taskOp && taskOp.isRawOutput) {
      systemPrompt = promptBuilder.buildRawOutputPrompt(brand);
    } else {
      systemPrompt = promptBuilder.buildBrandSystemPrompt(brand, taskOp);
    }

    // Make the API call
    var response = await apiCaller.makeApiCall(provider, model, apiKey, systemPrompt, userPrompt);

    // Release lock
    await helpers.setCloudLock(uid, String(task.id), false);

    if (response) {
      var aiResult = { success: true, result: response, error: null };
      await writeResultAndUpdateLastRun(uid, task, brand, aiResult);
      var duration = Date.now() - startTime;
      console.log('[Executor] Task completed:', task.name, 'in', duration, 'ms');
      return aiResult;
    } else {
      await helpers.setCloudLock(uid, String(task.id), false);
      return { success: false, result: null, error: 'Empty API response' };
    }
  } catch (error) {
    console.error('[Executor] Task failed:', task.name, error.message);
    // Release lock on error
    try { await helpers.setCloudLock(uid, String(task.id), false); } catch (e) {}

    // Write failure result
    try {
      await helpers.writeCloudResult(uid, {
        taskId: task.id,
        taskName: task.name,
        brand: task.brand || '',
        action: task.action || 'ai',
        success: false,
        result: 'Error: ' + error.message
      });
    } catch (e) {
      console.error('[Executor] Failed to write error result:', e.message);
    }

    return { success: false, result: null, error: error.message };
  }
}

/**
 * Handle 'post' action — social media posting
 */
async function handlePostAction(uid, task, brandIdx) {
  var postContent = (task.target && task.target.text) || '';
  var platforms = (task.target && task.target.platforms) || [];
  if (typeof platforms === 'string') platforms = [platforms];

  if (!postContent || platforms.length === 0) {
    return { success: false, result: null, error: 'No content or platforms for post' };
  }

  var scope = '_brand_' + brandIdx;
  var results = [];
  var anySuccess = false;

  for (var i = 0; i < platforms.length; i++) {
    var platform = platforms[i];
    var tokenData = await helpers.getUserSocialToken(uid, platform, scope);
    if (!tokenData) {
      results.push(platform + ': not connected');
      continue;
    }
    var postResult = await socialPoster.postToSocial(
      platform, tokenData.accessToken, postContent, tokenData.userId, null
    );
    if (postResult.success) {
      anySuccess = true;
      results.push(platform + ': posted' + (postResult.postUrl ? ' (' + postResult.postUrl + ')' : ''));
    } else {
      results.push(platform + ': failed - ' + postResult.error);
    }
  }

  return {
    success: anySuccess,
    result: results.join('\n'),
    error: anySuccess ? null : 'All platforms failed'
  };
}

/**
 * Handle 'image' action — Gemini image generation + Storage upload
 */
async function handleImageAction(uid, task, apiKeys) {
  var imgPrompt = (task.target && task.target.text) || task.name;
  var googleKey = apiKeys.google;
  if (!googleKey) {
    return { success: false, result: null, error: 'No Google API key for image generation' };
  }

  var imgResult = await imageGenerator.generateImage(imgPrompt, googleKey, task.config);
  if (!imgResult.images || imgResult.images.length === 0) {
    return { success: false, result: null, error: 'No images returned from generator' };
  }
  var imageUrl = await imageGenerator.uploadToStorage(
    uid, imgResult.images[0].base64, imgResult.images[0].mimeType
  );

  return { success: true, result: imageUrl, imageUrl: imageUrl, error: null };
}

/**
 * Handle pipeline (multi-step workflow)
 */
async function handlePipelineAction(uid, task, apiKeys, brands) {
  var customOps = await helpers.getUserCustomOps(uid);
  var generatedOps = await helpers.getUserGeneratedBrandOps(uid);
  var allOps = [].concat(customOps, generatedOps);

  var pipeResult = await pipelineExecutor.executePipeline(uid, task, apiKeys, brands, allOps);
  var stepCount = task.steps.length;
  var failCount = pipeResult.failedSteps.length;
  var summary = failCount === 0
    ? 'Pipeline completed (' + stepCount + ' steps)'
    : 'Pipeline completed with ' + failCount + ' error(s) in ' + stepCount + ' steps';

  // Build detailed result from context
  var detailParts = [summary];
  for (var i = 0; i < pipeResult.completedSteps.length; i++) {
    var cs = pipeResult.completedSteps[i];
    var output = pipeResult.context[cs.outputKey] || '';
    if (output.length > 500) output = output.substring(0, 500) + '...';
    detailParts.push('Step ' + (cs.index + 1) + ' (' + cs.action + '): ' + output);
  }
  for (var j = 0; j < pipeResult.failedSteps.length; j++) {
    var fs = pipeResult.failedSteps[j];
    detailParts.push('Step ' + (fs.index + 1) + ' (' + fs.action + '): FAILED - ' + fs.error);
  }

  return {
    success: failCount === 0,
    result: detailParts.join('\n\n'),
    error: failCount > 0 ? 'Pipeline had failures' : null
  };
}

/**
 * Write cloud result + update lastRun for non-AI actions
 */
async function finishTask(uid, task, brand, result, startTime) {
  var duration = Date.now() - startTime;
  console.log('[Executor] Task completed:', task.name, 'in', duration, 'ms');
  await helpers.setCloudLock(uid, String(task.id), false);
  await writeResultAndUpdateLastRun(uid, task, brand, result);
}

/**
 * Write result to cloud_results and update automation lastRun
 */
async function writeResultAndUpdateLastRun(uid, task, brand, result) {
  var timestamp = new Date().toISOString();
  var cloudResult = {
    taskId: task.id,
    taskName: task.name,
    brand: (brand && (brand.shortName || brand.name)) || task.brand || '',
    action: task.action || 'ai',
    success: result.success,
    result: result.result || ''
  };
  // v19.5: Include imageUrl if present (for image actions)
  if (result.imageUrl) {
    cloudResult.imageUrl = result.imageUrl;
  }
  await helpers.writeCloudResult(uid, cloudResult);
  await helpers.updateAutomationLastRun(uid, String(task.id), timestamp);
}

module.exports = { executeTask: executeTask };
