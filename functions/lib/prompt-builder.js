/**
 * RoweOS Cloud Functions — Prompt Builder
 * v19.1: Server-side port of buildBrandSystemPrompt() (~line 66346)
 * and buildTaskPrompt() (~line 127980)
 */

/**
 * Build brand system prompt from Firestore brand data
 * Simplified server-side version — no localStorage, no DOM, no agent prompts
 * @param {Object} brand - Brand object from Firestore
 * @param {Object} operation - Optional operation object
 * @returns {string} System prompt
 */
function buildBrandSystemPrompt(brand, operation) {
  if (!brand) return 'You are a helpful AI assistant.';

  var systemPrompt = 'You are an expert AI assistant for ' + (brand.name || 'the brand') + '.\n\n' +
    'BRAND CONTEXT:\n' +
    '- Name: ' + (brand.name || 'N/A') + '\n' +
    '- Tagline: ' + (brand.tagline || 'N/A') + '\n' +
    '- Voice: ' + (brand.voice || 'Professional and warm') + '\n' +
    '- Audience: ' + (brand.audience || 'Discerning clients') + '\n' +
    '- Positioning: ' + (brand.positioning || 'Excellence in every detail') + '\n' +
    '- Values: ' + (brand.values || 'Quality, integrity, service');

  // Add additional brand fields
  var standardFields = ['name', 'tagline', 'voice', 'audience', 'positioning', 'values',
    'brandColor', 'brandColorLight', 'shortName', 'desc', 'brandIndex'];
  var keys = Object.keys(brand);
  var extras = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (standardFields.indexOf(key) === -1 && brand[key] && typeof brand[key] === 'string') {
      extras.push('- ' + key.charAt(0).toUpperCase() + key.slice(1) + ': ' + brand[key]);
    }
  }
  if (extras.length > 0) {
    systemPrompt += '\n\nADDITIONAL BRAND ELEMENTS:\n' + extras.join('\n');
  }

  systemPrompt += '\n\nGUIDELINES:\n' +
    '- Maintain the brand voice consistently throughout your response\n' +
    '- Be professional, thorough, and helpful\n' +
    '- Focus on quality and attention to detail\n' +
    '- Tailor content to the target audience';

  // v19.1: Always append automation directive for cloud-executed tasks
  systemPrompt += '\n\nIMPORTANT INSTRUCTION: This is a scheduled automation task running unattended. ' +
    'You MUST produce DIRECT, COMPLETE OUTPUT only. Do NOT ask questions, seek clarification, ' +
    'list what you could do, or add meta-commentary. Do NOT say you lack context or need more information. ' +
    'Work with what you have and produce actionable content immediately. Begin your output now.';

  return systemPrompt;
}

/**
 * Build raw output system prompt for social media content
 * @param {Object} brand - Brand object
 * @returns {string} System prompt
 */
function buildRawOutputPrompt(brand) {
  var bn = (brand && (brand.shortName || brand.name)) || 'Brand';
  var desc = brand && brand.desc ? brand.desc + ' ' : '';
  return 'You are a social media copywriter for ' + bn + '. ' + desc +
    'Your ONLY job is to write the actual post text. Output NOTHING except the exact caption/post ' +
    'that will be published. No titles, no labels, no headers, no sections, no analysis, no publishing notes, ' +
    'no character counts, no engagement strategy, no hashtag advice, no tone descriptions, no markdown formatting. ' +
    'NEVER use em-dashes or en-dashes in your writing. Just the raw post text and nothing else.';
}

/**
 * Build task user prompt from automation config
 * Server-side port of buildTaskPrompt() (~line 127980)
 * @param {Object} task - Automation task object
 * @param {Array} allOps - Combined operations arrays for lookup
 * @returns {string|null} User prompt or null for reminder-only tasks
 */
function buildTaskPrompt(task, allOps) {
  // Handle studio action
  if (task.action === 'studio' && task.target && task.target.operationId) {
    task = Object.assign({}, task, { action: 'run_operation', operationId: task.target.operationId });
  }

  // Resolve operation
  if (task.action === 'run_operation' && task.operationId) {
    var operation = findOperationById(task.operationId, allOps);
    if (operation) {
      var opPrompt = '[AUTOMATED TASK — You MUST produce direct output only. Do NOT ask questions, ' +
        'seek clarification, or add meta-commentary. Do NOT say you cannot execute operations. ' +
        'Just produce the requested content immediately.]\n\n';
      opPrompt += 'TASK: ' + operation.name + '\n';
      if (operation.desc) opPrompt += operation.desc + '\n';
      if (operation.isRawOutput) {
        opPrompt += '\nCRITICAL OUTPUT RULE: Your ENTIRE response must be ONLY the final content text. ' +
          'No titles, no headers, no section labels, no analysis, no brand voice scores, no tone analysis, ' +
          'no posting time suggestions, no markdown formatting, no explanations, no preamble. ' +
          'Output the raw text exactly as it should be published.\n';
      } else if (operation.outputs) {
        opPrompt += '\nRequired Deliverables:\n';
        for (var i = 0; i < operation.outputs.length; i++) {
          opPrompt += '- ' + operation.outputs[i] + '\n';
        }
      }
      var taskContext = (task.target && task.target.contextRef) || task.description || '';
      if (taskContext) {
        opPrompt += '\nAdditional Context: ' + taskContext;
      }
      if (task.target && task.target.referenceDoc && task.target.referenceDoc.content) {
        opPrompt += '\n\nReference Document (' + (task.target.referenceDoc.name || 'Attached') + '):\n' +
          task.target.referenceDoc.content;
      }
      opPrompt += '\n\nBegin your output now.';
      return opPrompt;
    }
  }

  // Handle message action
  if (task.action === 'message') {
    var msgText = (task.target && task.target.text) || task.description || '';
    var msgPrompt = '[AUTOMATED TASK — You MUST produce direct output only. Do NOT ask questions or add meta-commentary.]\n\n';
    msgPrompt += 'INSTRUCTION: ' + msgText;
    msgPrompt += '\n\nProduce your response now. Be thorough and actionable.';
    return msgPrompt;
  }

  var prompts = {
    'generate_report': 'Generate a comprehensive brand performance report. Include key metrics, insights, and recommendations for improvement. Format with clear sections.',
    'generate_content': 'Generate engaging social media content and blog post ideas for the brand. Include 3 social posts and 1 blog outline with compelling hooks.',
    'consistency_check': 'Review and analyze brand voice consistency. Provide a checklist of brand guidelines compliance and suggest improvements.',
    'competitor_analysis': 'Analyze top competitors and provide strategic insights on positioning, messaging, and opportunities.',
    'audience_insights': 'Generate detailed audience insights including demographics, preferences, and engagement patterns.',
    'custom': task.description || 'Generate a comprehensive status update for the brand. Include current priorities, actionable recommendations, and next steps.',
    'none': null
  };

  if (task.action === 'none') return null;

  var basePrompt = prompts[task.action] || prompts['custom'];

  if (task.description && task.action !== 'custom') {
    basePrompt += '\n\nAdditional context: ' + task.description;
  }

  // Append length instruction
  if (task.config && task.config.length && task.config.length !== 'standard') {
    var len = task.config.length;
    if (len === 'brief') basePrompt += '\n\nKeep response concise and brief, under 200 words.';
    else if (len === 'comprehensive') basePrompt += '\n\nProvide a thorough, comprehensive response.';
    else if (len.indexOf('social-') === 0) {
      var charLimit = len.replace('social-', '');
      basePrompt += '\n\nOutput must be under ' + charLimit + ' characters. This is for social media posting.';
    }
  }

  return basePrompt;
}

/**
 * Find operation by ID across all operation arrays
 * @param {string} operationId - Operation ID to find
 * @param {Array} allOps - Combined operations arrays
 * @returns {Object|null} Operation object or null
 */
function findOperationById(operationId, allOps) {
  if (!operationId || !allOps) return null;
  var idStr = String(operationId);
  for (var i = 0; i < allOps.length; i++) {
    if (String(allOps[i].id) === idStr) return allOps[i];
  }
  return null;
}

module.exports = {
  buildBrandSystemPrompt: buildBrandSystemPrompt,
  buildRawOutputPrompt: buildRawOutputPrompt,
  buildTaskPrompt: buildTaskPrompt,
  findOperationById: findOperationById
};
