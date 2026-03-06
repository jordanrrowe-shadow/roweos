/**
 * RoweOS Cloud Functions — Pipeline Executor
 * v19.5: Multi-step workflow orchestration
 * Ported from client-side executeWorkflow() + executeWorkflowStep()
 */

var apiCaller = require('./api-caller');
var promptBuilder = require('./prompt-builder');
var socialPoster = require('./social-poster');
var imageGenerator = require('./image-generator');

/**
 * Resolve template variables in text: {{step0_output}}, {{step1_output|truncate:200}}
 * @param {string} text - Text with {{var}} placeholders
 * @param {Object} context - Key-value context object
 * @returns {string} Resolved text
 */
function resolveTemplateVars(text, context) {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(/\{\{(\w+)(?:\|truncate:(\d+))?\}\}/g, function(match, key, limit) {
    var val = context[key] || '';
    if (typeof val !== 'string') val = String(val);
    if (limit) val = val.substring(0, parseInt(limit));
    return val;
  });
}

/**
 * Execute a multi-step pipeline
 * @param {string} uid - Firebase user ID
 * @param {Object} task - Pipeline automation task (has task.steps array)
 * @param {Object} apiKeys - User's API keys
 * @param {Array} brands - User's brands array
 * @param {Array} allOps - Combined operations arrays
 * @returns {Object} { completedSteps, failedSteps, context }
 */
async function executePipeline(uid, task, apiKeys, brands, allOps) {
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

  var completedSteps = [];
  var failedSteps = [];

  console.log('[Pipeline] Starting pipeline:', task.name, '(' + steps.length + ' steps)');

  for (var i = 0; i < steps.length; i++) {
    var step = steps[i];
    var stepLabel = 'Step ' + (i + 1) + '/' + steps.length + ' (' + (step.action || 'ai') + ')';
    console.log('[Pipeline] Running', stepLabel);

    try {
      var result = await executeStep(uid, step, i, context, apiKeys, brands, allOps);
      var outputKey = step.outputKey || ('step' + i + '_output');
      context[outputKey] = result || '';
      completedSteps.push({ index: i, action: step.action, outputKey: outputKey });
      console.log('[Pipeline]', stepLabel, 'completed. Output length:', (result || '').length);
    } catch (err) {
      console.error('[Pipeline]', stepLabel, 'failed:', err.message);
      failedSteps.push({ index: i, action: step.action, error: err.message });
      break; // Stop pipeline on failure
    }
  }

  console.log('[Pipeline] Finished:', completedSteps.length, 'completed,', failedSteps.length, 'failed');
  return { completedSteps: completedSteps, failedSteps: failedSteps, context: context };
}

/**
 * Execute a single pipeline step
 * @param {string} uid - Firebase user ID
 * @param {Object} step - Step definition { action, prompt, config, ... }
 * @param {number} stepIndex - Step index in pipeline
 * @param {Object} context - Pipeline context with previous outputs
 * @param {Object} apiKeys - User's API keys
 * @param {Array} brands - User's brands array
 * @param {Array} allOps - Combined operations arrays
 * @returns {string} Step output text
 */
async function executeStep(uid, step, stepIndex, context, apiKeys, brands, allOps) {
  var action = step.action || 'studio';
  var brandIdx = context._brandIdx || 0;
  var brand = brands[brandIdx] || brands[0] || {};

  // Resolve template vars in prompt/text fields
  var stepPrompt = resolveTemplateVars(step.prompt || step.description || '', context);
  var stepText = resolveTemplateVars(step.text || '', context);

  // --- AI / Studio step ---
  if (action === 'studio' || action === 'ai' || action === 'message' || action === 'run_operation') {
    var provider = (step.config && step.config.provider) || 'anthropic';
    var model = (step.config && step.config.model) || 'claude-sonnet-4-6';
    var apiKey = apiKeys[provider];
    if (!apiKey) throw new Error('No API key for ' + provider);

    var taskOp = null;
    if (step.operationId) {
      taskOp = promptBuilder.findOperationById(step.operationId, allOps);
    }

    var systemPrompt;
    if (taskOp && taskOp.isRawOutput) {
      systemPrompt = promptBuilder.buildRawOutputPrompt(brand);
    } else {
      systemPrompt = promptBuilder.buildBrandSystemPrompt(brand, taskOp);
    }

    var userPrompt = stepPrompt || stepText || 'Generate content for ' + (brand.shortName || brand.name || 'the brand');

    // If this is an operation step, build the full operation prompt
    if (taskOp) {
      var opStep = Object.assign({}, step, {
        action: 'run_operation',
        operationId: step.operationId,
        target: step.target || {}
      });
      var builtPrompt = promptBuilder.buildTaskPrompt(opStep, allOps);
      if (builtPrompt) userPrompt = builtPrompt;
    }

    var response = await apiCaller.makeApiCall(provider, model, apiKey, systemPrompt, userPrompt);
    if (!response) throw new Error('Empty API response');
    return response;
  }

  // --- Post step ---
  if (action === 'post') {
    var helpers = require('./firestore-helpers');
    var postContent = stepText || stepPrompt || '';
    var platforms = step.platforms || (step.config && step.config.platforms) || [];
    if (typeof platforms === 'string') platforms = [platforms];

    if (!postContent || platforms.length === 0) {
      throw new Error('Post step missing content or platforms');
    }

    var scope = '_brand_' + brandIdx;
    var postResults = [];
    for (var p = 0; p < platforms.length; p++) {
      var platform = platforms[p];
      var tokenData = await helpers.getUserSocialToken(uid, platform, scope);
      if (!tokenData) {
        postResults.push(platform + ': not connected');
        continue;
      }
      // Check for image URL from previous pipeline step
      var imgUrl = null;
      if (step.imageFromStep !== undefined && context['step' + step.imageFromStep + '_output']) {
        var prevOutput = context['step' + step.imageFromStep + '_output'];
        // If previous step output looks like a URL, use it
        if (prevOutput.indexOf('https://') === 0) imgUrl = prevOutput;
      }
      var postResult = await socialPoster.postToSocial(platform, tokenData.accessToken, postContent, tokenData.userId, imgUrl);
      if (postResult.success) {
        postResults.push(platform + ': posted (' + (postResult.postUrl || postResult.postId) + ')');
      } else {
        postResults.push(platform + ': failed - ' + postResult.error);
      }
    }
    return postResults.join('\n');
  }

  // --- Image step ---
  if (action === 'image') {
    var googleKey = apiKeys.google;
    if (!googleKey) throw new Error('No Google API key for image generation');

    var imgPrompt = stepPrompt || stepText || 'Generate a brand image';
    var imgResult = await imageGenerator.generateImage(imgPrompt, googleKey, step.config);
    var imageUrl = await imageGenerator.uploadToStorage(uid, imgResult.images[0].base64, imgResult.images[0].mimeType);
    return imageUrl; // URL available as {{stepN_output}} for next step
  }

  // --- Notify step (no external action in cloud, just log) ---
  if (action === 'notify') {
    return 'Notification: ' + (stepText || stepPrompt || 'Pipeline step completed');
  }

  // --- Library step (client picks up from cloud_results) ---
  if (action === 'library') {
    return stepText || stepPrompt || 'Content saved to library';
  }

  // Unknown action — try as AI
  console.warn('[Pipeline] Unknown step action:', action, '— treating as AI');
  var fallbackKey = apiKeys.anthropic || apiKeys.openai || apiKeys.google;
  var fallbackProvider = apiKeys.anthropic ? 'anthropic' : apiKeys.openai ? 'openai' : 'google';
  if (!fallbackKey) throw new Error('No API key available');
  var sysPrompt = promptBuilder.buildBrandSystemPrompt(brand, null);
  var resp = await apiCaller.makeApiCall(fallbackProvider, 'claude-sonnet-4-6', fallbackKey, sysPrompt, stepPrompt || stepText || step.name || '');
  return resp || '';
}

module.exports = {
  executePipeline: executePipeline,
  executeStep: executeStep,
  resolveTemplateVars: resolveTemplateVars
};
